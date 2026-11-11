// Site: 사이트 하나마다 Durable Object 하나(SQLite 저장).
//  meta   사이트 정보 한 줄(열쇠 해시, 만든 때, 끝나는 때, 가림, 제목, 저장 크기, 지금 배포, 준비 중인 배포, 묶인 실시간 방 코드)
//  deploy 배포 목록(경로 → sha256·크기)을 JSON 한 줄로. 지금 것과 준비 중인 것만 남김
//  blob   파일 내용. sha256별로 1MiB씩 나눈 줄. 0번 줄은 내용이 맞는지 확인한 뒤 맨 나중에 쓰므로 "0번 줄이 있다 = 다 올라왔다"
// 표는 사이트를 만들 때(init)만 생깁니다. 없는 주소로 들어온 요청은 읽기만 하고 아무것도 쓰지 않습니다.
import { DurableObject } from 'cloudflare:workers';
import { config, expiryFrom, HOUR_MS, DAY_MS } from './config.js';
import { HttpError, json, noContent, readJson, errorFrom } from './http.js';
import { bearer, keyMatches, newDeployId, hex, SHA256_RE, DEPLOY_RE } from './ids.js';
import { checkManifest, missingBlobs, scriptBlobs } from './manifest.js';
import { typeOf, extOf, requestPath } from './paths.js';
import { isRuntimeJs } from './runtime.js';
import { SUPABASE_SDK } from './runtime-allow.js';
import { fileHeaders, etagMatches, parseRange, NO_FRAME_PAGES } from './csp.js';
import { rewriteHtml } from './rewrite.js';
import { gonePage, blockedPage, notFoundPage, noFilePage } from './pages.js';
import { normCode } from './live/host.js';

/** blob 한 줄의 크기(DO SQLite는 한 줄 2MB까지) */
export const CHUNK = 1024 * 1024;
const MANIFEST_MAX = 1024 * 1024;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY CHECK (id = 1), site TEXT NOT NULL, key_hash TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL, expires INTEGER NOT NULL, blocked INTEGER NOT NULL DEFAULT 0, block_reason TEXT NOT NULL DEFAULT '', bytes INTEGER NOT NULL DEFAULT 0, current TEXT, pending TEXT, live_code TEXT);
CREATE TABLE IF NOT EXISTS deploy (id TEXT PRIMARY KEY, created INTEGER NOT NULL, bytes INTEGER NOT NULL, stored INTEGER NOT NULL, files TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS blob (sha TEXT NOT NULL, i INTEGER NOT NULL, total INTEGER, data BLOB NOT NULL, PRIMARY KEY (sha, i)) WITHOUT ROWID;
`;

export class Site extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.cfg = config(env);
    this.meta = undefined; // undefined = 아직 안 봄, null = 없는 사이트
    this.manifests = new Map(); // 배포 id → 풀어 둔 목록
    this.uploading = new Map(); // sha256 → 올리는 중인 작업
    this.jsOk = new Set(); // 런타임으로 확인한 sha256
    this.deployTimes = [];
    this.liveTimes = [];
    this.queue = Promise.resolve();
  }

  async fetch(request) {
    const url = new URL(request.url);
    const [, op, arg = ''] = url.pathname.split('/');
    try {
      switch (`${request.method} ${op}`) {
        case 'GET file': case 'HEAD file': return this.serve(request, url);
        case 'POST init': return await this.init(request);
        case 'POST deploys': return await this.createDeploy(request);
        case 'PUT blobs': return await this.upload(request, arg);
        case 'POST publish': return await this.publish(request, arg);
        case 'DELETE site': return await this.remove(request, false);
        case 'DELETE admin-site': return await this.remove(request, true);
        case 'POST admin-block': return await this.block(request);
        case 'POST live': return await this.bindLive(request);
        case 'GET live-status': return this.liveStatus(url);
        default: throw new HttpError('not_found', '없는 주소예요.');
      }
    } catch (e) {
      if (e instanceof HttpError) return e.toResponse();
      throw e;
    }
  }

  // ── 상태 ────────────────────────────────────────────────────
  load() {
    if (this.meta !== undefined) return this.meta;
    const has = this.sql.exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'").toArray().length;
    this.meta = (has && this.sql.exec('SELECT * FROM meta WHERE id = 1').toArray()[0]) || null;
    return this.meta;
  }
  manifest(id) {
    let m = this.manifests.get(id);
    if (m) return m;
    const row = this.sql.exec('SELECT files, bytes, stored FROM deploy WHERE id = ?', id).toArray()[0];
    if (!row) return null;
    const list = JSON.parse(row.files);
    m = { list, files: new Map(list.map(([p, sha, size]) => [p, [sha, size]])), shas: new Map(list.map(([, sha, size]) => [sha, size])), js: scriptBlobs(list), bytes: row.bytes, stored: row.stored };
    this.manifests.set(id, m);
    return m;
  }
  /** 다 올라온 파일: sha256 → 크기 */
  blobSizes() {
    return new Map(this.sql.exec('SELECT sha, total FROM blob WHERE i = 0').toArray().map((r) => [r.sha, r.total]));
  }
  hasBlob(sha) { return this.sql.exec('SELECT 1 FROM blob WHERE sha = ? AND i = 0', sha).toArray().length > 0; }
  /** 목록을 바꾸는 일(배포 만들기·공개·지우기·가리기)은 한 번에 하나씩 */
  exclusive(fn) {
    const run = this.queue.then(fn);
    this.queue = run.catch(() => { });
    return run;
  }
  async gate(method, op, body) {
    const stub = this.env.GATE.get(this.env.GATE.idFromName('gate'));
    const res = await stub.fetch(`http://gate/${op}`, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) throw await errorFrom(res);
    return res.json();
  }
  async authed(request) {
    const meta = this.load();
    if (!meta || Date.now() >= meta.expires) throw new HttpError('not_found');
    if (!(await keyMatches(bearer(request.headers.get('authorization')), meta.key_hash))) throw new HttpError('unauthorized');
    return meta;
  }
  url(request, meta) { return `${request.headers.get('x-lp-origin') || ''}/s/${meta.site}/`; }
  /** 실시간 방(Room)에 호스트 안쪽 일을 시킴: bind·touch·wipe */
  async room(code, op, body) {
    const stub = this.env.ROOM.get(this.env.ROOM.idFromName(code));
    const res = await stub.fetch(`http://room/host/${op}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw await errorFrom(res);
    return res.json();
  }

  // ── 만들기 ───────────────────────────────────────────────────
  async init(request) {
    const { id, keyHash, title, created, expires } = await readJson(request, 4096);
    if (this.load()) throw new HttpError('bad_request', '이미 있는 주소예요.', { status: 409 });
    this.sql.exec(SCHEMA);
    this.sql.exec('INSERT INTO meta (id, site, key_hash, title, created, expires) VALUES (1, ?, ?, ?, ?, ?)', id, keyHash, String(title || ''), created, expires);
    await this.ctx.storage.setAlarm(expires);
    this.meta = undefined;
    this.load();
    return json({ ok: true });
  }

  // ── 배포 목록 받기 ───────────────────────────────────────────
  async createDeploy(request) {
    const first = await this.authed(request);
    if (first.blocked) throw new HttpError('blocked');
    const now = Date.now();
    this.deployTimes = this.deployTimes.filter((t) => t > now - HOUR_MS);
    if (this.deployTimes.length >= this.cfg.deploysPerHour) {
      throw new HttpError('rate_limited', '이 사이트를 너무 자주 올렸어요. 잠시 뒤에 다시 해 주세요.', { headers: { 'retry-after': String(Math.ceil((this.deployTimes[0] + HOUR_MS - now) / 1000)) } });
    }
    const man = checkManifest(await readJson(request, MANIFEST_MAX), this.cfg);
    return this.exclusive(async () => {
      const meta = this.load();
      if (!meta) throw new HttpError('not_found');
      const usage = await this.gate('GET', 'usage');
      if (usage.bytes - meta.bytes + man.stored > this.cfg.maxTotalBytes) throw new HttpError('full');
      const have = this.blobSizes();
      for (const [path, sha, size] of man.files) if (have.has(sha) && have.get(sha) !== size) throw new HttpError('bad_request', `size가 맞지 않아요: ${path}`);
      const id = newDeployId();
      const old = meta.pending && meta.pending !== meta.current ? meta.pending : null;
      this.ctx.storage.transactionSync(() => {
        if (old) this.sql.exec('DELETE FROM deploy WHERE id = ?', old);
        this.sql.exec('INSERT INTO deploy (id, created, bytes, stored, files) VALUES (?, ?, ?, ?, ?)', id, now, man.bytes, man.stored, JSON.stringify(man.files));
        this.sql.exec('UPDATE meta SET pending = ? WHERE id = 1', id);
      });
      if (old) this.manifests.delete(old);
      meta.pending = id;
      this.deployTimes.push(now);
      this.sweep();
      return json({ deploy: id, missing: missingBlobs(man.files, have) });
    });
  }

  // ── 실시간 방 묶기 ───────────────────────────────────────────
  /** POST /api/sites/:id/live { code, adminKeyHash, settings? } → 이 사이트에 방을 묶음(이미 묶인 코드면 관리자 키 해시·설정만 바꿈) */
  async bindLive(request) {
    const first = await this.authed(request);
    if (!this.cfg.live) throw new HttpError('not_found', '이 서버는 실시간 방을 쓰지 않아요.');
    if (first.blocked) throw new HttpError('blocked');
    const now = Date.now();
    this.liveTimes = this.liveTimes.filter((t) => t > now - HOUR_MS);
    if (this.liveTimes.length >= this.cfg.deploysPerHour) {
      throw new HttpError('rate_limited', '실시간 방을 너무 자주 바꿨어요. 잠시 뒤에 다시 해 주세요.', { headers: { 'retry-after': String(Math.ceil((this.liveTimes[0] + HOUR_MS - now) / 1000)) } });
    }
    this.liveTimes.push(now);
    const body = await readJson(request, 8192);
    let code;
    try { code = normCode(body.code); } catch { throw new HttpError('bad_request', '연수 코드는 영문·숫자 3~40자예요.'); }
    const adminKeyHash = typeof body.adminKeyHash === 'string' ? body.adminKeyHash.toLowerCase() : '';
    if (!SHA256_RE.test(adminKeyHash)) throw new HttpError('bad_request', 'adminKeyHash는 관리자 키의 SHA-256(16진수 64자)이어야 해요.');
    return this.exclusive(async () => {
      const meta = this.load();
      if (!meta) throw new HttpError('not_found');
      const prev = meta.live_code || null;
      // 이 사이트의 첫 방일 때만 하루 개수에 셈(코드를 바꾸는 것은 방 하나를 갈아 끼우는 것)
      if (!prev) await this.gate('POST', 'room', { id: meta.site });
      // 사이트에 먼저 적고 방을 묶음: 중간에 끊겨도 "사이트가 모르는 방"이 남지 않음(방은 기간 끝에 사이트에 물어보고 스스로 비움)
      const setCode = (c) => { this.sql.exec('UPDATE meta SET live_code = ? WHERE id = 1', c); meta.live_code = c; };
      if (prev !== code) setCode(code);
      let out;
      try {
        out = await this.room(code, 'bind', { site: meta.site, code, adminKeyHash, settings: body.settings, expires: meta.expires, blocked: !!meta.blocked });
      } catch (e) {
        if (prev !== code) setCode(prev);
        throw e;
      }
      // 코드를 바꿨으면 예전 방은 비움
      if (prev && prev !== code) { try { await this.room(prev, 'wipe', { site: meta.site }); } catch (e) { console.error('old room wipe failed', e?.message); } }
      try { await this.gate('POST', 'site', { id: meta.site, code }); } catch (e) { console.error('gate site update failed', e?.message); }
      return json({ url: `${request.headers.get('x-lp-origin') || ''}/live`, code: out.code });
    });
  }
  /** Room이 "이 사이트가 아직 살아 있고 이 코드를 쓰나?"를 물을 때 */
  liveStatus(url) {
    const meta = this.load();
    const alive = !!meta && Date.now() < meta.expires && meta.live_code === url.searchParams.get('code');
    return json({ alive, expires: alive ? meta.expires : 0, blocked: alive ? !!meta.blocked : false });
  }

  /** 지금 배포·준비 중인 배포·올리는 중인 것 말고는 지움 */
  sweep() {
    const meta = this.load();
    if (!meta) return;
    const keep = new Set(this.uploading.keys());
    for (const d of [meta.current, meta.pending]) {
      const m = d && this.manifest(d);
      if (m) for (const sha of m.shas.keys()) keep.add(sha);
    }
    for (const { sha } of this.sql.exec('SELECT DISTINCT sha FROM blob').toArray()) {
      if (!keep.has(sha)) { this.sql.exec('DELETE FROM blob WHERE sha = ?', sha); this.jsOk.delete(sha); }
    }
  }

  // ── 파일 받기 ────────────────────────────────────────────────
  async upload(request, sha) {
    const meta = await this.authed(request);
    if (meta.blocked) throw new HttpError('blocked');
    if (!SHA256_RE.test(sha)) throw new HttpError('bad_request', 'sha256이 맞지 않아요.');
    for (;;) {
      if (this.hasBlob(sha)) return noContent(); // 이미 있음(다시 보내도 됨)
      const busy = this.uploading.get(sha);
      if (!busy) break;
      await busy.catch(() => { });
    }
    const man = meta.pending ? this.manifest(meta.pending) : null;
    const size = man?.shas.get(sha);
    if (size === undefined) throw new HttpError('bad_request', '배포 목록에 없는 파일이에요. 목록(deploys)을 먼저 보내 주세요.');
    const declared = request.headers.get('content-length');
    if (declared !== null && Number(declared) !== size) {
      throw new HttpError(Number(declared) > size ? 'too_large' : 'bad_request', '목록에 적은 크기와 달라요.');
    }
    const job = this.receive(request, sha, size, man.js.has(sha));
    this.uploading.set(sha, job);
    try { await job; } finally { if (this.uploading.get(sha) === job) this.uploading.delete(sha); }
    return noContent();
  }

  async receive(request, sha, size, isScript) {
    const digest = new crypto.DigestStream('SHA-256');
    const hasher = digest.getWriter();
    let first = null; let index = 0; let got = 0; let stored = 0; let wrote = false;
    let buf = new Uint8Array(Math.min(size, CHUNK)); let fill = 0;
    const flush = () => {
      const part = fill === buf.length ? buf : buf.slice(0, fill);
      if (index === 0) first = part;
      else { this.sql.exec('INSERT OR REPLACE INTO blob (sha, i, total, data) VALUES (?, ?, NULL, ?)', sha, index, part); wrote = true; }
      index++; stored += fill;
      buf = new Uint8Array(Math.min(size - stored, CHUNK)); fill = 0;
    };
    try {
      if (request.body) {
        const reader = request.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          got += value.byteLength;
          if (got > size) { reader.cancel().catch(() => { }); throw new HttpError('too_large', '목록에 적은 크기보다 커요.'); }
          for (let o = 0; o < value.byteLength;) {
            const n = Math.min(buf.length - fill, value.byteLength - o);
            buf.set(value.subarray(o, o + n), fill); fill += n; o += n;
            if (fill === buf.length) flush();
          }
          await hasher.write(value);
        }
      }
      if (got !== size) throw new HttpError('bad_request', '목록에 적은 크기와 달라요.');
      if (fill > 0 || index === 0) flush();
      await hasher.close();
      if (hex(await digest.digest) !== sha) throw new HttpError('bad_request', '파일 내용이 sha256과 달라요.');
      if (isScript && !(await this.scriptOk(sha, first))) throw new HttpError('runtime_mismatch');
      // 받는 동안 목록이 바뀌었거나 사이트가 지워졌을 수 있음
      const meta = this.load();
      if (!meta) throw new HttpError('not_found');
      const wanted = [meta.pending, meta.current].some((d) => d && this.manifest(d)?.shas.has(sha));
      const rest = wanted ? this.sql.exec('SELECT COUNT(*) AS n FROM blob WHERE sha = ? AND i > 0', sha).one().n : -1;
      if (rest !== index - 1) throw new HttpError('bad_request', '올리는 사이에 배포 목록이 바뀌었어요. 처음부터 다시 해 주세요.', { status: 409 });
      this.sql.exec('INSERT OR REPLACE INTO blob (sha, i, total, data) VALUES (?, 0, ?, ?)', sha, size, first);
    } catch (e) {
      hasher.abort().catch(() => { });
      if (!this.load()) throw new HttpError('not_found'); // 받는 사이에 사이트가 지워짐
      if (wrote && !this.hasBlob(sha)) this.sql.exec('DELETE FROM blob WHERE sha = ?', sha);
      throw e;
    }
  }

  async scriptOk(sha, bytes) {
    if (this.jsOk.has(sha)) return true;
    const ok = await isRuntimeJs(bytes);
    if (ok) this.jsOk.add(sha);
    return ok;
  }

  // ── 공개 ─────────────────────────────────────────────────────
  async publish(request, deployId) {
    await this.authed(request);
    return this.exclusive(async () => {
      const meta = this.load();
      if (!meta) throw new HttpError('not_found');
      if (meta.blocked) throw new HttpError('blocked');
      // 이미 공개한 배포를 다시 부르면(응답을 못 받은 경우) 같은 답
      if (deployId && deployId === meta.current && deployId !== meta.pending) return json({ url: this.url(request, meta), expiresAt: meta.expires });
      const man = DEPLOY_RE.test(deployId) && deployId === meta.pending ? this.manifest(deployId) : null;
      if (!man) throw new HttpError('not_found', '없는 배포예요. 목록(deploys)부터 다시 보내 주세요.');
      const missing = missingBlobs(man.list, this.blobSizes());
      if (missing.length) throw new HttpError('missing_blobs', undefined, { missing });
      // 실행 파일은 여기서 한 번 더 확인(다른 이름으로 올려 둔 내용을 .js로 돌려 쓰는 길을 막음)
      for (const [sha, path] of man.js) {
        if (this.jsOk.has(sha)) continue;
        const row = this.sql.exec('SELECT data FROM blob WHERE sha = ? AND i = 0', sha).toArray()[0];
        if (!row || !(await this.scriptOk(sha, new Uint8Array(row.data)))) throw new HttpError('runtime_mismatch', `lecpage 실행 파일이 아니에요: ${path}`, { path });
      }
      if (this.load()?.pending !== deployId) throw new HttpError('not_found', '없는 배포예요. 목록(deploys)부터 다시 보내 주세요.');
      const now = Date.now(); const expires = expiryFrom(now, this.cfg.days); const prev = meta.current;
      this.ctx.storage.transactionSync(() => {
        this.sql.exec('UPDATE meta SET current = ?, pending = NULL, bytes = ?, expires = ? WHERE id = 1', deployId, man.stored, expires);
        if (prev && prev !== deployId) this.sql.exec('DELETE FROM deploy WHERE id = ?', prev);
      });
      Object.assign(meta, { current: deployId, pending: null, bytes: man.stored, expires });
      if (prev && prev !== deployId) this.manifests.delete(prev);
      await this.ctx.storage.setAlarm(expires);
      this.sweep();
      try { await this.gate('POST', 'site', { id: meta.site, bytes: man.stored, expires }); } catch (e) { console.error('gate site update failed', e?.message); }
      // 공개 기간이 늘었으니 방에도 알림(못 알려도 방이 끝날 때 사이트에 다시 물어봄)
      if (meta.live_code) { try { await this.room(meta.live_code, 'touch', { site: meta.site, expires }); } catch (e) { console.error('room touch failed', e?.message); } }
      return json({ url: this.url(request, meta), expiresAt: expires });
    });
  }

  // ── 지우기·가리기 ────────────────────────────────────────────
  async remove(request, admin) {
    if (admin) { if (!this.load()) throw new HttpError('not_found'); } else await this.authed(request);
    return this.exclusive(async () => { if (this.load()) await this.wipe(); return noContent(); });
  }
  async wipe() {
    const meta = this.load();
    const id = meta?.site;
    // 묶인 실시간 방(참가 기록·보드 파일)도 같이 지움. 실패해도 방이 기간 끝에 사이트를 확인하고 스스로 비움
    if (meta?.live_code) { try { await this.room(meta.live_code, 'wipe', { site: id }); } catch (e) { console.error('room wipe failed', e?.message); } }
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.meta = null; this.manifests.clear(); this.jsOk.clear(); this.deployTimes = [];
    if (id) { try { await this.gate('POST', 'forget', { id }); } catch (e) { console.error('gate forget failed', e?.message); } }
  }
  async block(request) {
    const body = await readJson(request, 8192);
    if (typeof body.blocked !== 'boolean') throw new HttpError('bad_request', 'blocked에 true나 false를 넣어 주세요.');
    return this.exclusive(async () => {
      const meta = this.load();
      if (!meta) throw new HttpError('not_found');
      const reason = body.blocked ? String(body.reason || '').slice(0, 500) : '';
      // 방부터 가림: 여기서 실패하면 사이트 상태도 바꾸지 않고 오류를 돌려줌(다시 하면 됨)
      if (meta.live_code) await this.room(meta.live_code, 'touch', { site: meta.site, blocked: body.blocked });
      this.sql.exec('UPDATE meta SET blocked = ?, block_reason = ? WHERE id = 1', body.blocked ? 1 : 0, reason);
      Object.assign(meta, { blocked: body.blocked ? 1 : 0, block_reason: reason });
      try { await this.gate('POST', 'site', { id: meta.site, blocked: body.blocked }); } catch (e) { console.error('gate site update failed', e?.message); }
      return json({ ok: true, id: meta.site, blocked: body.blocked, title: meta.title, expiresAt: meta.expires, liveCode: meta.live_code || null });
    });
  }
  /**
   * 쓰이는 사이트는 지우지 않음: 화면을 여는 방문이 있고 남은 기간이 절반 아래면 공개 기간을 다시 채움(사이트마다 보름에 한 번쯤만 씀).
   * 처음 만든 날부터 MAX_SITE_DAYS가 지나면 더 늘리지 않음. 가린 사이트는 늘리지 않음.
   */
  keepAlive(meta) {
    const c = this.cfg; const now = Date.now();
    if (!c.keepAlive || meta.blocked || meta.expires - now > (c.days * DAY_MS) / 2 || now - meta.created > c.maxSiteDays * DAY_MS) return;
    const expires = expiryFrom(now, c.days);
    this.sql.exec('UPDATE meta SET expires = ? WHERE id = 1', expires);
    meta.expires = expires;
    this.ctx.waitUntil((async () => {
      await this.ctx.storage.setAlarm(expires);
      try { await this.gate('POST', 'site', { id: meta.site, expires }); } catch (e) { console.error('gate site update failed', e?.message); }
      if (meta.live_code) { try { await this.room(meta.live_code, 'touch', { site: meta.site, expires }); } catch (e) { console.error('room touch failed', e?.message); } }
    })());
  }

  /** 공개 기간이 끝나면 전부 지움 */
  async alarm() {
    const meta = this.load();
    if (!meta) return;
    if (Date.now() >= meta.expires) await this.wipe();
    else await this.ctx.storage.setAlarm(meta.expires);
  }

  // ── 내보내기 ─────────────────────────────────────────────────
  serve(request, url) {
    const head = request.method === 'HEAD';
    const meta = this.load();
    if (!meta || Date.now() >= meta.expires) return gonePage(head);
    if (meta.blocked) return blockedPage(meta.site, head);
    const man = meta.current ? this.manifest(meta.current) : null;
    const path = requestPath(url.searchParams.get('p'));
    if (!man) return notFoundPage(head);
    let status = 200; let name = path; let hit = path ? man.files.get(path) : null;
    if (!hit && path && !extOf(path)) { name = `${path}.html`; hit = man.files.get(name); }
    if (!hit) {
      name = '404.html'; hit = man.files.get(name); status = 404;
      if (!hit) return noFilePage(head);
    }
    const [sha, size] = hit;
    const type = typeOf(name);
    const headers = fileHeaders(name, type, sha, { scripts: this.cfg.allowSupabaseSdk && SUPABASE_SDK ? [SUPABASE_SDK] : [] });
    if (status === 200 && etagMatches(request.headers.get('if-none-match'), headers.etag)) {
      delete headers['content-type'];
      return new Response(null, { status: 304, headers });
    }
    if (type.kind === 'html') {
      if (status === 200) this.keepAlive(meta);
      if (head) return new Response(null, { status, headers });
      return rewriteHtml(new Response(this.stream(sha, 0, size - 1), { status, headers }), meta.site, { reportLink: !NO_FRAME_PAGES.has(name) });
    }
    let range = status === 200 ? parseRange(request.headers.get('range'), size) : null;
    const ifRange = request.headers.get('if-range');
    if (range && ifRange && ifRange !== headers.etag) range = null;
    if (range === 'invalid') return new Response(null, { status: 416, headers: { ...headers, 'content-range': `bytes */${size}` } });
    const start = range ? range.start : 0; const end = range ? range.end : size - 1; const length = end - start + 1;
    if (range) { status = 206; headers['content-range'] = `bytes ${start}-${end}/${size}`; }
    if (head) return new Response(null, { status, headers: { ...headers, 'content-length': String(length) } });
    if (size <= CHUNK) {
      const row = this.sql.exec('SELECT data FROM blob WHERE sha = ? AND i = 0', sha).toArray()[0];
      if (!row) return noFilePage(false);
      const all = new Uint8Array(row.data);
      return new Response(range ? all.subarray(start, end + 1) : all, { status, headers });
    }
    return new Response(this.stream(sha, start, end).pipeThrough(new FixedLengthStream(length)), { status, headers });
  }

  /** sha256 내용의 [start, end] 구간을 줄 단위로 읽어 흘려보냄 */
  stream(sha, start, end) {
    const sql = this.sql;
    let i = Math.floor(Math.max(start, 0) / CHUNK);
    const last = Math.floor(end / CHUNK);
    return new ReadableStream({
      pull(c) {
        if (end < start || i > last) { c.close(); return; }
        const row = sql.exec('SELECT data FROM blob WHERE sha = ? AND i = ?', sha, i).toArray()[0];
        if (!row) { c.error(new Error('파일 조각이 없어요')); return; }
        const u = new Uint8Array(row.data); const base = i * CHUNK;
        const a = Math.max(start - base, 0); const b = Math.min(end - base + 1, u.length);
        c.enqueue(a === 0 && b === u.length ? u : u.subarray(a, b));
        if (++i > last) c.close();
      },
    });
  }
}
