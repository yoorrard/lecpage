// Room: 연수 코드마다 하나씩 있는 실시간 방(질문·보드·투표·진행).
// 방의 규칙과 저장은 skills/lecpage/backends/cloudflare/src/index.js 의 LiveRoom을 그대로 물려받아 쓰고,
// 여기서는 호스트에 얹는 데 필요한 것만 더합니다:
//   - 사이트에 묶인 코드만 열림(묶이지 않은 코드는 아무것도 쓰지 않고 404)
//   - 사이트가 가려지면 방도 가려지고, 사이트가 지워지거나 보관 기간이 끝나면 방과 올린 파일도 지워짐
//   - R2가 없으면 올린 파일을 이 방의 SQLite에 담음(src/live/bucket.js)
//   - 방이 쓰는 저장량을 Gate에 알려 전체 한도에 넣음
//   - 긴 대기(long-poll)는 LiveRoom이 맡음(backends/cloudflare/src: Worker가 기다리는 relayWait은 longpoll.js, 방 안에서 기다리는 longPoll은 index.js).
//     여기서는 기다리는 동안 깨어 있던 시간을 Gate에 알리고(waitersChanged), 기다린 뒤 사이트가 가려졌거나 없어졌으면 답하지 않음(afterWait)
import { LiveRoom, Guard } from '../../skills/lecpage/backends/cloudflare/src/index.js';
import { MAX_WAIT_S, snapshotChanged } from '../../skills/lecpage/backends/cloudflare/src/longpoll.js';
import { config } from './config.js';
import { HttpError, json, readJson } from './http.js';
import { SqlBucket } from './live/bucket.js';
import { HostBind, bindRoom, roomEnv, maxRetentionDays, translate, LiveError } from './live/host.js';

export { Guard, MAX_WAIT_S, snapshotChanged };

const DAY = 864e5;
const MB = 1024 * 1024;

/** 실시간 규칙의 오류 모양({ error, message }) */
function liveError(status, error, message) {
  return new Response(JSON.stringify({ error, message }), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}

export class Room extends LiveRoom {
  constructor(ctx, env) {
    const cfg = config(env);
    const r2 = env.UPLOADS && typeof env.UPLOADS.put === 'function' ? env.UPLOADS : null;
    const bucket = r2 ? null : new SqlBucket(ctx.storage.sql, { maxObjectBytes: cfg.liveMaxUploadMb * MB, maxTotalBytes: cfg.liveRoomBytes, tx: (fn) => ctx.storage.transactionSync(fn) });
    // 방 등록(init)에 쓰는 설정 토큰. 객체가 깨어날 때마다 새로 만들고 밖으로 내보내지 않음
    const setupToken = crypto.randomUUID() + crypto.randomUUID();
    super(ctx, roomEnv(env, cfg, { uploads: r2 || bucket, setupToken }));
    this.hostEnv = env;
    this.hostCfg = cfg;
    this.hostBucket = bucket;
    this.hostToken = setupToken;
    this.hostBind = new HostBind(ctx.storage.sql);
    this.hostFull = false; // 전체 저장 공간이 찼으면 파일을 더 받지 않음
    this.awakeMs = 0; this.awakeMark = 0; // 깨어 있던 시간(SSE·방 안 긴 대기): 무료 하루 duration 몫을 Gate가 알게
  }

  // ── 깨어 있던 시간 ────────────────────────────────────────────
  // SSE 연결이 열려 있거나 방 안에서 긴 대기가 기다리는 동안 이 방은 잠들 수 없어 duration(128MB × 초)을 씀.
  // 10분 쌓일 때마다, 그리고 아무도 기다리지 않게 되면 Gate에 알림(방 하나가 2시간에 Gate 요청 12번쯤)
  busy() { return this.sse.size > 0 || this.waiters.size > 0; }
  awake(now = Date.now()) {
    if (this.awakeMark) this.awakeMs += now - this.awakeMark;
    this.awakeMark = this.busy() ? now : 0;
    if (this.awakeMs >= 600e3 || (!this.awakeMark && this.awakeMs >= 30e3)) {
      const aw = Math.round(this.awakeMs / 1000); this.awakeMs = 0;
      const b = this.hostBind.get();
      if (b) this.ctx.waitUntil?.(this.reportAwake(b.site, aw));
    }
  }
  async reportAwake(site, aw) {
    try {
      const gate = this.hostEnv.GATE.get(this.hostEnv.GATE.idFromName('gate'));
      await gate.fetch('http://gate/site', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: site, aw }) });
    } catch (e) { console.error('room awake report failed', e?.message); }
  }
  openSse(ip) { const res = super.openSse(ip); this.awake(); return res; }
  sendSse(text) { super.sendSse(text); this.awake(); }

  async core() {
    const core = await super.core();
    core.cfg.maxRetentionDays = maxRetentionDays(this.hostCfg); // 방 자료는 사이트 보관 기간보다 오래 두지 않음
    return core;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/host/')) return this.hostOp(request, url.pathname.slice(6));
    const b = this.hostBind.get();
    if (!b) return liveError(404, 'unknown_training', '아직 준비되지 않은 연수 코드입니다.');
    if (b.blocked) return liveError(403, 'blocked', '신고가 들어와 잠시 가려 둔 연수예요.');
    if (Date.now() >= b.expires && !(await this.stillAlive(b))) return liveError(404, 'unknown_training', '보관 기간이 끝난 연수예요.');
    return super.fetch(request); // 긴 대기도 LiveRoom이 맡음
  }

  // ── 긴 대기(LiveRoom)에 덧붙이는 것 ─────────────────────────
  waitersChanged() { this.awake(); }
  /** 방 안에서 기다린 뒤: 그사이 사이트가 지워졌거나 가려졌으면 답하지 않음 */
  async afterWait() {
    const b = this.hostBind.get();
    if (!b) return liveError(404, 'unknown_training', '보관 기간이 끝난 연수예요.');
    if (b.blocked) return liveError(403, 'blocked', '신고가 들어와 잠시 가려 둔 연수예요.');
    return null;
  }

  // ── 호스트 안에서만 부르는 일(Site → Room) ───────────────────
  async hostOp(request, op) {
    try {
      const body = await readJson(request, 16 * 1024);
      if (op === 'bind') {
        const core = await this.core();
        const out = await bindRoom({ core, bind: this.hostBind, setupToken: this.hostToken, maxDays: maxRetentionDays(this.hostCfg) }, body);
        this.alarmAt = 0;
        await this.scheduleCleanup(core, out.code);
        return json({ ok: true, ...out });
      }
      const b = this.hostBind.get();
      if (!b || b.site !== body.site) return json({ ok: false });
      if (op === 'touch') {
        const next = this.hostBind.patch({ expires: body.expires, blocked: body.blocked });
        if (next.blocked) this.hangUp(1008, 'blocked');
        this.alarmAt = 0;
        const core = await this.core();
        await this.scheduleCleanup(core, b.code);
        return json({ ok: true });
      }
      if (op === 'wipe') { await this.wipeAll(); return json({ ok: true }); }
      throw new HttpError('not_found', '없는 주소예요.');
    } catch (e) {
      const t = translate(e);
      if (t instanceof HttpError) return t.toResponse();
      throw e;
    }
  }

  /** 묶인 사이트가 아직 살아 있는지 사이트에 물어봄(기간이 늘었으면 받아 적음). 없어졌으면 방을 비움 */
  async stillAlive(b) {
    let status;
    try {
      const site = this.hostEnv.SITE.get(this.hostEnv.SITE.idFromName(b.site));
      const res = await site.fetch(`http://site/live-status?code=${encodeURIComponent(b.code)}`);
      if (!res.ok) return false;
      status = await res.json();
    } catch { return false; } // 확인하지 못함: 이번 요청만 닫고, 지우지는 않음
    if (status.alive && status.expires > Date.now()) {
      this.hostBind.patch({ expires: status.expires, blocked: status.blocked });
      this.alarmAt = 0;
      return !status.blocked;
    }
    await this.wipeAll();
    return false;
  }

  hangUp(code, reason) {
    this.wake();
    for (const ws of this.ctx.getWebSockets()) { try { ws.close(code, reason); } catch { /* 이미 닫힘 */ } }
    for (const x of this.sse) { try { x.w.close().catch(() => { }); } catch { /* 이미 닫힘 */ } }
    this.sse.clear();
  }

  /** 방의 모든 것(참가자·질문·보드·올린 파일·알람)을 지움 */
  async wipeAll() {
    const b = this.hostBind.get();
    this.hangUp(1001, 'gone');
    if (b && !this.hostBucket && this.env.UPLOADS) { try { await super.deleteFiles(b.code); } catch (e) { console.error('room files delete failed', e?.message); } }
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.forget();
    if (b) await this.report(b.site, 0);
  }
  forget() {
    this.corePromise = null; this.alarmAt = 0; this.hostFull = false;
    this.hostBind.reset();
    if (this.hostBucket) this.hostBucket.ready = false;
  }

  /** 이 방이 쓰는 저장량을 Gate에 알림. 전체가 찼는지도 같이 받아 둠 */
  async report(site, bytes) {
    try {
      const b = site ? { site } : this.hostBind.get();
      if (!b) return;
      const gate = this.hostEnv.GATE.get(this.hostEnv.GATE.idFromName('gate'));
      const res = await gate.fetch('http://gate/site', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: b.site, roomBytes: bytes ?? this.ctx.storage.sql.databaseSize }) });
      const j = res.ok ? await res.json() : null;
      if (j && Number.isFinite(j.total)) this.hostFull = j.total > this.hostCfg.maxTotalBytes;
    } catch (e) { console.error('room usage report failed', e?.message); }
  }

  // ── LiveRoom의 동작에 덧붙이는 것 ────────────────────────────
  async upload(core, code, request, ip) {
    if (this.hostFull) throw new LiveError(507, 'storage_full', '바로 배포 저장 공간이 가득 차서 지금은 파일을 올릴 수 없어요.');
    const res = await super.upload(core, code, request, ip);
    await this.report();
    return res;
  }
  async deleteNames(code, names) {
    await super.deleteNames(code, names);
    if (names && names.length) await this.report();
  }
  async deleteFiles(code) {
    await super.deleteFiles(code);
    await this.report();
  }
  /** 정리 알람은 사이트 보관 기간이 끝나는 때를 넘기지 않음 */
  async scheduleCleanup(core, code) {
    const b = this.hostBind.get();
    if (!b) return super.scheduleCleanup(core, code);
    const t = core.trainingOrNull(code);
    if (!t) return;
    const due = Math.min(Date.now() + core.retentionDays(t) * DAY, b.expires) + 3600e3;
    if (this.alarmAt && Math.abs(this.alarmAt - due) <= DAY / 2) return;
    const cur = await this.ctx.storage.getAlarm();
    if (!cur || Math.abs(cur - due) > DAY / 2) { await this.ctx.storage.setAlarm(due); this.alarmAt = due; } else this.alarmAt = cur;
  }
  async alarm() {
    const b = this.hostBind.get();
    if (b && Date.now() >= b.expires && !(await this.stillAlive(b)) && !this.hostBind.get()) return; // 사이트가 없어져 방을 비움
    await super.alarm();
    // 오래 쓰지 않아 LiveRoom이 스스로 비웠을 수 있음
    this.hostBind.reset();
    if (this.hostBucket) this.hostBucket.ready = false;
    if (b && !this.hostBind.get()) { this.forget(); await this.report(b.site, 0); }
  }
}
