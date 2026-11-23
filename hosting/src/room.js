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
import { config, SSE_STOP_PCT } from './config.js';
import { HttpError, json, readJson } from './http.js';
import { SqlBucket } from './live/bucket.js';
import { HostBind, RoomBudget, bindRoom, roomEnv, maxRetentionDays, translate, LiveError } from './live/host.js';

export { Guard, MAX_WAIT_S, snapshotChanged };

const DAY = 864e5;
const MB = 1024 * 1024;
/** 방이 쓴 행을 Gate에 알리는 단위(행). Gate 요청은 쓴 행 이만큼에 하나꼴 */
export const ROWS_UNIT = 300;

/** 실시간 규칙의 오류 모양({ error, message }). extra: 본문에 덧붙일 값(429의 retryAfter: 머리글을 못 읽는 곳에서도 런타임이 기다릴 초를 앎) */
function liveError(status, error, message, headers = {}, extra = {}) {
  return new Response(JSON.stringify({ error, message, ...extra }), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers } });
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
    this.hostBudget = new RoomBudget(ctx.storage.sql); // 방마다 분·하루 요청 상한(live/host.js ROOM_CAP)
    this.peopleN = 0;
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
      const res = await gate.fetch('http://gate/site', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: site, aw }) });
      const j = res.ok ? await res.json() : null;
      // 무료 하루 DO 시간(duration)이 빠듯하면 이미 열린 SSE도 닫음(새 SSE는 Worker가 이미 받지 않음): 런타임이 다시 붙으려다 긴 대기로 내려가고,
      // 긴 대기는 Worker가 대신 기다려 방이 잠듦. 방 기능과 사이트는 그대로(묻기 방식만 바뀜). 방은 깨어 있던 시간을 10분마다 알리므로 길어야 10분 뒤
      if (j && Number(j.gbsPct) >= SSE_STOP_PCT && this.sse.size) this.closeSse();
    } catch (e) { console.error('room awake report failed', e?.message); }
  }
  closeSse() {
    for (const x of this.sse) { try { x.w.close().catch(() => { }); } catch { /* 이미 닫힘 */ } }
    this.sse.clear();
    this.awake();
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
    const wait = (await this.fromTeacher(request, b)) ? 0 : await this.overBudget(b);
    if (wait) return liveError(429, 'room_busy', '이 연수 방에 요청이 너무 많이 와서 잠시 멈췄어요. 사이트가 같은 요청을 너무 자주 보내는지 확인해 주세요.', { 'retry-after': String(wait) }, { retryAfter: wait });
    const res = await super.fetch(request); // 긴 대기도 LiveRoom이 맡음
    this.rowsDue(b);
    return res;
  }
  /**
   * 소켓으로 온 동기화(LiveRoom.wsSync)도 HTTP 요청과 같은 문을 지남: 묶인 사이트가 살아 있고 가려지지 않았으며 방 요청 상한 안일 때만.
   * 거절하면 런타임이 HTTP 때와 같은 오류로 다룸
   */
  async syncGate() {
    const b = this.hostBind.get();
    if (!b) return { error: 'unknown_training', message: '아직 준비되지 않은 연수 코드입니다.', status: 404 };
    if (b.blocked) return { error: 'blocked', message: '신고가 들어와 잠시 가려 둔 연수예요.', status: 403 };
    if (Date.now() >= b.expires && !(await this.stillAlive(b))) return { error: 'unknown_training', message: '보관 기간이 끝난 연수예요.', status: 404 };
    const wait = await this.overBudget(b);
    if (wait) return { error: 'room_busy', message: '이 연수 방에 요청이 너무 많이 와서 잠시 멈췄어요. 사이트가 같은 요청을 너무 자주 보내는지 확인해 주세요.', status: 429, retryAfter: wait };
    return null;
  }

  // ── 쓴 행 수 ─────────────────────────────────────────────────
  // 무료 요금제는 하루에 쓴 행 수(모든 객체 합쳐 10만)에 한도가 있음. 방이 쓴 행(글·출석·투표 답)을 Gate에 알려 전체 몫에 넣음.
  // 방은 조용하면 10초쯤 뒤 잠들어 기억(this.rowsWritten)이 지워지므로 쌓아 두었다가 알릴 수 없고, 쓸 때마다 알리면 Gate 요청이 배로 늚.
  // 그래서 요청이 끝날 때마다 그 사이 쓴 n행을 ROWS_UNIT행 단위로 어림해 알림: ROWS_UNIT이 넘는 몫은 그대로, 나머지는 (나머지 ÷ ROWS_UNIT)의 확률로 한 단위.
  // 기댓값이 실제 쓴 행과 같고(덜 세지도 더 세지도 않음), Gate 요청은 쓴 행 ROWS_UNIT개에 하나꼴. 하루 6만 행이면 오차는 7%쯤
  rowsDue(b) {
    const n = (this.rowsWritten || 0) - (this.rowsSeen || 0);
    if (!(n > 0) || !b) return;
    this.rowsSeen = this.rowsWritten;
    const whole = Math.floor(n / ROWS_UNIT);
    const rw = (whole + ((this.rowsRand || Math.random)() < (n - whole * ROWS_UNIT) / ROWS_UNIT ? 1 : 0)) * ROWS_UNIT;
    if (rw) this.ctx.waitUntil?.(this.reportRows(b.site, rw));
  }
  async reportRows(site, rw) {
    try {
      const gate = this.hostEnv.GATE.get(this.hostEnv.GATE.idFromName('gate'));
      await gate.fetch('http://gate/site', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: site, rw }) });
    } catch (e) { console.error('room rows report failed', e?.message); }
  }
  /**
   * 강사 화면의 요청인지: X-Lec-Admin이 이 방의 관리자 키(또는 강사 세션)와 맞을 때만. 강사 요청은 방 요청 상한에 세지 않음(넘쳐도 기록을 받아 갈 수 있게).
   * 머리글만 붙인 요청(빈 값·아무 글자·아주 긴 값)은 참가자 요청과 똑같이 셈: 머리글 하나로 상한을 비켜 가지 못하게
   */
  async fromTeacher(request, b) {
    const h = request.headers.get('x-lec-admin');
    if (!h || h.length > 600) return false;
    try { const core = await this.core(); return core.isAdmin(core.trainingOrNull(b.code), await core.credentials(request.headers)) === true; } catch { return false; }
  }
  /** 방마다 요청 상한(live/host.js RoomBudget): 받으면 0, 넘쳤으면 기다릴 초. 참가자 수는 방의 셈(메모리, 들어올 때마다 맞춰짐)을 그대로 써서 한꺼번에 들어와도 따라감 */
  async overBudget(b) {
    try { this.peopleN = (await this.core()).count(b.code, 'participants'); } catch { /* 못 세면 지난 값 */ }
    return this.hostBudget.hit({ people: this.peopleN, budget: this.hostCfg.dailyRequestBudget || 0 });
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
      // 강사가 내리기·다시 배포 전에 보는 기록 수(내용은 주지 않음). 아직 아무도 쓰지 않은 방은 표가 없어 모두 0
      if (op === 'counts') {
        const core = await this.core();
        const counts = Object.fromEntries(['participants', 'attendance', 'questions', 'posts', 'answers', 'survey'].map((c) => [c, core.count(b.code, c)]));
        return json({ ok: true, counts, last: core.ready ? core._maxStamp(b.code) : 0 });
      }
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
    this.hostBind.reset(); this.hostBudget.reset();
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
  /** 정리 알람. 실패하면 1시간 뒤로 스스로 다시 잡음(공식 재시도는 2초부터 6번뿐이라 무료 하루 한도가 찬 시간에 걸리면 다시 오지 않음) */
  async alarm() {
    try {
      const b = this.hostBind.get();
      if (b && Date.now() >= b.expires && !(await this.stillAlive(b)) && !this.hostBind.get()) return; // 사이트가 없어져 방을 비움
      await super.alarm();
      this.rowsDue(b); // 정리하며 지운 행도 쓴 행
      // 오래 쓰지 않아 LiveRoom이 스스로 비웠을 수 있음
      this.hostBind.reset();
      if (this.hostBucket) this.hostBucket.ready = false;
      if (b && !this.hostBind.get()) { this.forget(); await this.report(b.site, 0); }
    } catch (e) {
      console.error('room alarm failed', e?.message);
      await this.ctx.storage.setAlarm(Date.now() + 3600e3);
    }
  }
}
