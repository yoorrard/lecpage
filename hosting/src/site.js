// Site: 사이트 하나마다 Durable Object 하나(SQLite 저장).
//  meta   사이트 정보 한 줄(열쇠 해시, 만든 때, 끝나는 때, 가림, 제목, 저장 크기, 지금 배포, 준비 중인 배포, 묶인 실시간 방 코드)
//  deploy 배포 목록(경로 → sha256·크기)을 JSON 한 줄로. 지금 것과 준비 중인 것만 남김
//  blob   파일 내용. sha256별로 1MiB씩 나눈 줄. 0번 줄은 내용이 맞는지 확인한 뒤 맨 나중에 쓰므로 "0번 줄이 있다 = 다 올라왔다"
//  passet (VIEW=pages) Pages에 올린 파일: sha256·확장자 → Pages 열쇠. 내용은 두지 않음
//         (작은 파일은 받을 때 메모리에만 두었다가 공개할 때 한 번에 올리고 그때 적음 → deferred)
// 표는 사이트를 만들 때(init)만 생깁니다. 없는 주소로 들어온 요청은 읽기만 하고 아무것도 쓰지 않습니다.
//
// 보기(view)는 사이트를 만들 때 정해져 바뀌지 않습니다.
//  worker: 모든 파일을 여기 두고 Worker가 /s/<id>/로 내보냄
//  pages : HTML(손보기 전 원본)과 영상·소리만 여기 두고, 나머지는 받을 때 검사한 뒤 바로 Pages에 올림.
//          공개할 때 HTML을 손봐 올리고 브랜치 s-<id>에 배포 → https://s-<id>.<프로젝트>.pages.dev (pages-site.js)
import { DurableObject } from 'cloudflare:workers';
import { config, expiryFrom, HOUR_MS, DAY_MS } from './config.js';
import { HttpError, json, noContent, readJson, errorFrom } from './http.js';
import { bearer, keyMatches, newDeployId, hex, SHA256_RE, DEPLOY_RE } from './ids.js';
import { checkManifest, missingBlobs, scriptBlobs } from './manifest.js';
import { typeOf, extOf, requestPath } from './paths.js';
import { isRuntimeJs } from './runtime.js';
import { SUPABASE_SDK, STATIC_RUNTIME, PAGES_RUNTIME } from './runtime-allow.js';
import { fileHeaders, etagMatches, parseRange, NO_FRAME_PAGES } from './csp.js';
import { rewriteHtml } from './rewrite.js';
import { gonePage, blockedPage, notFoundPage, noFilePage } from './pages.js';
import { normCode } from './live/host.js';
import { PagesClient, deploySite } from './pages-api.js';
import { pagesHash, base64Parts } from './blake3.js';
import { isMedia, branchOf, siteUrlOf, headersFile, redirectsFile, ROBOTS, noFileHtml, blockedHtml, goneHtml, NOTICE_HEADERS, contentTypeOf, rawExt, fontHashed, fontsHashed } from './pages-site.js';

/** blob 한 줄의 크기(DO SQLite는 한 줄 2MB까지) */
export const CHUNK = 1024 * 1024;
/** 정적 사본(/rt/)이 있는 런타임 파일 */
const RT = new Set(STATIC_RUNTIME || []);
/**
 * Pages 보기: 이 크기 아래의 파일(CSS·작은 그림·글꼴 등)은 받을 때 바로 Pages에 올리지 않고 메모리에 잠깐 두었다가 공개할 때 HTML과 한 번에 올림.
 * 파일마다 Pages API를 1~2번 부르던 것이 공개 한 번에 1번으로 줄어 Cloudflare API 한도(5분에 1,200번)에 덜 닿고, 저장소에 쓰지 않아 행 쓰기(무료 하루 10만)도 늘지 않음.
 * 그사이 이 객체가 내려가 메모리가 비면 공개할 때 missing_blobs로 그 파일만 다시 받음(앱이 알아서 다시 보냄)
 */
export const DEFER_MAX = 512 * 1024;
/** 사이트 하나가 메모리에 잠깐 두는 파일 합계(넘으면 받을 때 바로 Pages에 올림) */
const DEFER_TOTAL = 16 * 1024 * 1024;
/** Pages 보기에서 올려받지 않는 파일(호스트 정책으로 바꿔 넣음) */
const PAGES_SKIP = new Set(['robots.txt']);
/** 공개 한 번에 드는 Pages API 어림(토큰·확인·올리기·열쇠 적기·배포·준비 확인·지난 배포 지우기) */
const PUBLISH_CALLS = 7;
/** 미리보기 카드 그림으로 쓸 만한 크기(작은 아이콘은 뺌) */
const OG_MIN_BYTES = 8000;
const MANIFEST_MAX = 1024 * 1024;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY CHECK (id = 1), site TEXT NOT NULL, key_hash TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL, expires INTEGER NOT NULL, blocked INTEGER NOT NULL DEFAULT 0, block_reason TEXT NOT NULL DEFAULT '', bytes INTEGER NOT NULL DEFAULT 0, current TEXT, pending TEXT, live_code TEXT, view TEXT NOT NULL DEFAULT 'worker', pstate TEXT);
CREATE TABLE IF NOT EXISTS passet (sha TEXT NOT NULL, ext TEXT NOT NULL, phash TEXT NOT NULL, size INTEGER NOT NULL, PRIMARY KEY (sha, ext)) WITHOUT ROWID;
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
    this.ogCache = new Map(); // 배포 id → 미리보기 카드 그림 경로('' = 없음)
    this.deferred = new Map(); // (Pages 보기) 공개할 때 한 번에 올릴 작은 파일: sha256 → { bytes, items: [{ ext, hash, parts, contentType }] }
    this.deferredBytes = 0;
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
    if (has) this.migrate();
    this.meta = (has && this.sql.exec('SELECT * FROM meta WHERE id = 1').toArray()[0]) || null;
    return this.meta;
  }
  /** 이 판 전에 만든 사이트의 표에 새 칸·표를 더함(있는 사이트에서만, 한 번) */
  migrate() {
    const cols = new Set(this.sql.exec('PRAGMA table_info(meta)').toArray().map((r) => r.name));
    if (!cols.has('view')) this.sql.exec("ALTER TABLE meta ADD COLUMN view TEXT NOT NULL DEFAULT 'worker'");
    if (!cols.has('pstate')) this.sql.exec('ALTER TABLE meta ADD COLUMN pstate TEXT');
    if (!cols.has('view') || !cols.has('pstate')) this.sql.exec(SCHEMA);
  }
  /** VIEW=pages로 만든 사이트인지 */
  isPages(meta = this.load()) { return !!meta && meta.view === 'pages'; }
  /** Pages 상태: { url, self(이 호스트 주소), deps: [배포 id…], man: { manifest, headers, redirects } | null(가림을 풀 때 다시 배포), hold: [안내 화면·못 지운 배포 id…] } */
  ps(meta = this.load()) {
    let v = null;
    try { v = meta?.pstate ? JSON.parse(meta.pstate) : null; } catch { v = null; }
    return { url: '', deps: [], man: null, hold: [], ...(v || {}) };
  }
  savePs(meta, st) { const j = JSON.stringify(st); this.sql.exec('UPDATE meta SET pstate = ? WHERE id = 1', j); meta.pstate = j; }
  pc() {
    const p = this.cfg.pagesCfg;
    if (!p) throw new HttpError('bad_request', 'Pages 설정(PAGES_TOKEN 등)이 없어 이 사이트를 다룰 수 없어요. 운영자에게 알려 주세요.', { status: 503 });
    if (!this.pagesClient) this.pagesClient = new PagesClient({ api: p.api, accountId: p.accountId, project: p.project, token: p.token });
    return this.pagesClient;
  }
  /** 지난번 알린 뒤 Pages API를 부른 횟수와 방(Room)을 부른 횟수(Gate가 하루 숫자 pc·pz·rc에 더함) */
  pagesDelta() {
    const p = this.pagesClient || { calls: 0, limited: 0 };
    const d = { pc: p.calls - (this.pcSent || 0), pz: p.limited - (this.pzSent || 0), rc: (this.roomCalls || 0) - (this.rcSent || 0) };
    this.pcSent = p.calls; this.pzSent = p.limited; this.rcSent = this.roomCalls || 0;
    return d;
  }
  /** 여기(Durable Object)에 내용을 두는 파일인지: Worker 보기는 전부, Pages 보기는 HTML(원본)과 영상·소리 */
  keepsHere(meta, path) { return !this.isPages(meta) || typeOf(path)?.kind === 'html' || isMedia(path); }
  passet(sha, ext) { return this.sql.exec('SELECT phash FROM passet WHERE sha = ? AND ext = ?', sha, ext).toArray()[0]?.phash || ''; }
  deferredItem(sha, ext) { return this.deferred.get(sha)?.items.find((x) => x.ext === ext) || null; }
  /** Pages 보기: 엔진 런타임 그대로인 .js는 모든 사이트가 같아 Pages 열쇠를 미리 앎(scripts/gen-runtime.mjs) → 올려받지 않음 */
  knownRuntime(files) {
    for (const [path, sha, size] of files) {
      const ph = PAGES_RUNTIME?.[sha];
      if (!ph || rawExt(path) !== 'js' || this.passet(sha, 'js')) continue;
      this.sql.exec('INSERT OR REPLACE INTO passet (sha, ext, phash, size) VALUES (?, ?, ?, ?)', sha, 'js', ph, size);
      this.jsOk.add(sha);
    }
  }
  /** 이번 배포에 드는 Pages API 어림(Gate의 5분 창): 공개 한 번 + 큰 파일마다 확인·올리기 */
  pagesEstimate(meta, files, missing) {
    const want = new Set(missing); let big = 0;
    for (const [path, sha, size] of files) if (want.has(sha) && !this.keepsHere(meta, path) && size > DEFER_MAX) { big++; want.delete(sha); }
    return PUBLISH_CALLS + 2 * big;
  }
  /** 목록에서 아직 받지 않은 sha256(겹치지 않게, 목록 순서대로). Pages 보기는 Pages에 올린 기록도 봄 */
  missingFor(meta, files, have = this.blobSizes()) {
    if (!this.isPages(meta)) return missingBlobs(files, have);
    const out = []; const seen = new Set();
    for (const [path, sha] of files) {
      if (PAGES_SKIP.has(path)) continue;
      const ok = this.keepsHere(meta, path) ? have.has(sha) : !!this.passet(sha, rawExt(path)) || !!this.deferredItem(sha, rawExt(path));
      if (!ok && !seen.has(sha)) { seen.add(sha); out.push(sha); }
    }
    return out;
  }
  /** 여기에 두는 파일의 크기 합(전체 저장량 상한에 드는 몫) */
  keptBytes(meta, files) {
    const sizes = new Map();
    for (const [path, sha, size] of files) if (this.keepsHere(meta, path)) sizes.set(sha, size);
    let n = 0; for (const v of sizes.values()) n += v;
    return n;
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
    this.roomCalls = (this.roomCalls || 0) + 1;
    const stub = this.env.ROOM.get(this.env.ROOM.idFromName(code));
    const res = await stub.fetch(`http://room/host/${op}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw await errorFrom(res);
    return res.json();
  }

  // ── 만들기 ───────────────────────────────────────────────────
  async init(request) {
    const { id, keyHash, title, created, expires, view } = await readJson(request, 4096);
    if (this.load()) throw new HttpError('bad_request', '이미 있는 주소예요.', { status: 409 });
    this.sql.exec(SCHEMA);
    this.sql.exec('INSERT INTO meta (id, site, key_hash, title, created, expires, view) VALUES (1, ?, ?, ?, ?, ?, ?)', id, keyHash, String(title || ''), created, expires, view === 'pages' ? 'pages' : 'worker');
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
    const body = await readJson(request, MANIFEST_MAX);
    const man = checkManifest(body, this.cfg);
    return this.exclusive(async () => {
      const meta = this.load();
      if (!meta) throw new HttpError('not_found');
      if (this.isPages(meta)) this.knownRuntime(man.files);
      const have = this.blobSizes();
      for (const [path, sha, size] of man.files) if (have.has(sha) && have.get(sha) !== size) throw new HttpError('bad_request', `size가 맞지 않아요: ${path}`);
      const missing = this.missingFor(meta, man.files, have);
      // Gate에 한 번만 물음: 운영자 멈춤(다시 배포도 받지 않음, 이미 공개한 판은 그대로 열림) · Pages API 5분 창 · 연수 날짜·인원(그날이 찼으면 올리기 전에 알림, 바뀌면 갈아 끼움) · 저장량
      const chk = await this.gate('POST', 'deploy-check', {
        site: meta.site, booking: body.booking && typeof body.booking === 'object' ? body.booking : null,
        pages: this.isPages(meta) ? this.pagesEstimate(meta, man.files, missing) : 0, split: Array.isArray(body.caps) && body.caps.includes('split'),
      });
      const keep = this.keptBytes(meta, man.files);
      if (chk.bytes - meta.bytes + keep > this.cfg.maxTotalBytes) throw new HttpError('full');
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
      return json({ deploy: id, missing, ...(chk.live ? { live: chk.live } : {}) });
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
      // 이 사이트의 첫 방일 때만 하루 개수에 셈(코드를 바꾸는 것은 방 하나를 갈아 끼우는 것). Gate가 이때 코드도 적음(따로 부르지 않음)
      if (!prev) await this.gate('POST', 'room', { id: meta.site, code });
      // 사이트에 먼저 적고 방을 묶음: 중간에 끊겨도 "사이트가 모르는 방"이 남지 않음(방은 기간 끝에 사이트에 물어보고 스스로 비움)
      const setCode = (c) => { this.sql.exec('UPDATE meta SET live_code = ? WHERE id = 1', c); meta.live_code = c; };
      if (prev !== code) setCode(code);
      let out;
      try {
        out = await this.room(code, 'bind', { site: meta.site, code, adminKeyHash, settings: body.settings, expires: meta.expires, blocked: !!meta.blocked });
      } catch (e) {
        if (prev !== code) setCode(prev);
        if (!prev) { try { await this.gate('POST', 'site', { id: meta.site, code: '' }); } catch { /* 관리 화면 숫자만 어긋남 */ } }
        throw e;
      }
      // 코드를 바꿨으면 예전 방은 비우고 Gate에 새 코드를 적음
      if (prev && prev !== code) {
        try { await this.room(prev, 'wipe', { site: meta.site }); } catch (e) { console.error('old room wipe failed', e?.message); }
        try { await this.gate('POST', 'site', { id: meta.site, code, ...this.pagesDelta() }); } catch (e) { console.error('gate site update failed', e?.message); }
      }
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
    if (this.isPages(meta)) for (const { sha } of this.sql.exec('SELECT DISTINCT sha FROM passet').toArray()) if (!keep.has(sha)) this.sql.exec('DELETE FROM passet WHERE sha = ?', sha);
    for (const [sha, d] of this.deferred) if (!keep.has(sha)) { this.deferred.delete(sha); this.deferredBytes -= d.bytes.length; }
  }

  // ── 파일 받기 ────────────────────────────────────────────────
  async upload(request, sha) {
    const meta = await this.authed(request);
    if (meta.blocked) throw new HttpError('blocked');
    if (!SHA256_RE.test(sha)) throw new HttpError('bad_request', 'sha256이 맞지 않아요.');
    for (;;) {
      if (!this.isPages(meta) && this.hasBlob(sha)) return noContent(); // 이미 있음(다시 보내도 됨). Pages 보기는 uploadPages가 봄
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
    if (this.isPages(meta)) return this.uploadPages(request, meta, man, sha, size);
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

  // ── VIEW=pages: 받기 ─────────────────────────────────────────
  /**
   * 파일 하나를 받아 내용을 확인한 뒤, 여기 둘 것(HTML 원본·영상·소리)은 blob에, 나머지는 바로 Pages에 올리고 열쇠만 적어 둠.
   * 같은 내용이 확장자가 다른 이름으로 여러 번 나오면 확장자마다 열쇠가 다름(Pages 열쇠에 확장자가 들어감).
   * 큰 파일을 여럿 한꺼번에 들고 있지 않게 한 번에 하나씩(Durable Object 메모리 128MB).
   */
  async uploadPages(request, meta, man, sha, size) {
    const paths = man.list.filter(([p, s]) => s === sha && !PAGES_SKIP.has(p)).map(([p]) => p);
    const exts = [...new Set(paths.filter((p) => !this.keepsHere(meta, p)).map(rawExt))].filter((e) => !this.passet(sha, e));
    // 작은 파일은 메모리에 두었다가 공개할 때 한 번에 올림
    const defer = exts.length > 0 && size <= DEFER_MAX && this.deferredBytes + size <= DEFER_TOTAL;
    const needBlob = paths.some((p) => this.keepsHere(meta, p)) && !this.hasBlob(sha);
    if (!needBlob && !exts.length) { request.body?.cancel().catch(() => { }); return noContent(); }
    const run = this.pagesQueue = (this.pagesQueue || Promise.resolve()).catch(() => { }).then(async () => {
      const bytes = await readAll(request, size);
      if (hex(await crypto.subtle.digest('SHA-256', bytes)) !== sha) throw new HttpError('bad_request', '파일 내용이 sha256과 달라요.');
      if (man.js.has(sha) && !(await this.scriptOk(sha, bytes))) throw new HttpError('runtime_mismatch');
      if (!this.load()) throw new HttpError('not_found'); // 받는 사이에 사이트가 지워짐
      const parts = exts.length ? base64Parts(bytes) : null;
      const items = exts.map((e) => ({ ext: e, hash: pagesHash(bytes, e, parts), parts, contentType: contentTypeOf(paths.find((p) => rawExt(p) === e)) }));
      if (needBlob && !this.hasBlob(sha)) {
        // 0번 줄을 맨 나중에(= 다 들어옴)
        this.ctx.storage.transactionSync(() => {
          for (let i = 1, o = CHUNK; o < bytes.length; i++, o += CHUNK) this.sql.exec('INSERT OR REPLACE INTO blob (sha, i, total, data) VALUES (?, ?, NULL, ?)', sha, i, bytes.slice(o, o + CHUNK));
          this.sql.exec('INSERT OR REPLACE INTO blob (sha, i, total, data) VALUES (?, 0, ?, ?)', sha, size, bytes.slice(0, CHUNK));
        });
      }
      if (defer && !this.deferred.has(sha)) { this.deferred.set(sha, { bytes, items }); this.deferredBytes += bytes.length; }
      else if (defer) { const d = this.deferred.get(sha); for (const x of items) if (!d.items.some((y) => y.ext === x.ext)) d.items.push(x); }
      if (exts.length && !defer) {
        const pc = this.pc();
        const missing = new Set(await pc.checkMissing(items.map((x) => x.hash)));
        const up = items.filter((x) => missing.has(x.hash));
        if (up.length) await pc.upload(up);
        for (const x of items) this.sql.exec('INSERT OR REPLACE INTO passet (sha, ext, phash, size) VALUES (?, ?, ?, ?)', sha, x.ext, x.hash, size);
      }
    });
    try { await run; } catch (e) { throw await this.pagesFail(e, `파일을 Cloudflare Pages에 올리지 못했어요. 잠시 뒤 다시 해 주세요. (${e?.step || ''})`); }
    return noContent();
  }

  // ── 공개 ─────────────────────────────────────────────────────
  async publish(request, deployId) {
    await this.authed(request);
    return this.exclusive(async () => {
      const meta = this.load();
      if (!meta) throw new HttpError('not_found');
      if (meta.blocked) throw new HttpError('blocked');
      // 이미 공개한 배포를 다시 부르면(응답을 못 받은 경우) 같은 답
      if (deployId && deployId === meta.current && deployId !== meta.pending) return json(this.published(request, meta));
      const man = DEPLOY_RE.test(deployId) && deployId === meta.pending ? this.manifest(deployId) : null;
      if (!man) throw new HttpError('not_found', '없는 배포예요. 목록(deploys)부터 다시 보내 주세요.');
      const missing = this.missingFor(meta, man.list);
      if (missing.length) throw new HttpError('missing_blobs', undefined, { missing });
      if (this.isPages(meta)) return this.publishPages(request, meta, deployId, man);
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
      try { await this.gate('POST', 'site', { id: meta.site, bytes: man.stored, expires, published: true, ...this.pagesDelta() }); } catch (e) { console.error('gate site update failed', e?.message); }
      // 보관 기간이 늘었으니 방에도 알림(못 알려도 방이 끝날 때 사이트에 다시 물어봄)
      if (meta.live_code) { try { await this.room(meta.live_code, 'touch', { site: meta.site, expires }); } catch (e) { console.error('room touch failed', e?.message); } }
      return json({ url: this.url(request, meta), expiresAt: expires });
    });
  }
  /** 공개한 뒤 돌려주는 값. Pages 보기는 Pages 주소와, 학교망에서 pages.dev가 막혔을 때 쓸 이 호스트의 주소(altUrl) */
  published(request, meta) {
    if (!this.isPages(meta)) return { url: this.url(request, meta), expiresAt: meta.expires };
    return { url: this.ps(meta).url || this.siteUrl(meta), altUrl: this.url(request, meta), expiresAt: meta.expires, view: 'pages' };
  }
  siteUrl(meta) { return this.cfg.pagesCfg ? siteUrlOf(this.cfg.pagesCfg, meta.site) : ''; }

  // ── VIEW=pages: 공개 ─────────────────────────────────────────
  /** HTML을 손봐(신고 링크·미리보기 카드) Pages에 올리고, 브랜치 s-<id>에 배포. 지난 배포는 지움 */
  async publishPages(request, meta, deployId, man) {
    const self = request.headers.get('x-lp-origin') || '';
    const id = meta.site; const url = this.siteUrl(meta);
    const manifest = {}; const extra = []; const media = []; const paths = []; const deferred = new Map(); const lostHere = new Set(); // deferred: Pages 열쇠 → 메모리에서 올린 파일
    const add = (path, bytes) => {
      const parts = base64Parts(bytes); const hash = pagesHash(bytes, rawExt(path), parts);
      manifest[`/${path}`] = hash; extra.push({ hash, parts, contentType: contentTypeOf(path) }); paths.push(path);
    };
    const og = this.ogImageFor(deployId, man);
    for (const [path, sha] of man.list) {
      if (isMedia(path)) { media.push(path); continue; }
      if (path === 'robots.txt') continue; // 호스트 정책으로 바꿈(아래)
      if (typeOf(path)?.kind === 'html') {
        const res = rewriteHtml(new Response(this.stream(sha, 0, man.files.get(path)[1] - 1), { headers: { 'content-type': 'text/html; charset=utf-8' } }), id, {
          reportLink: !NO_FRAME_PAGES.has(path), path, files: null, rt: null, notices: [],
          siteBase: url, reportUrl: `${self}/report`, ogImage: path === 'index.html' ? og : '',
        });
        add(path, new Uint8Array(await res.arrayBuffer()));
        continue;
      }
      const ph = this.passet(sha, rawExt(path));
      if (ph) { manifest[`/${path}`] = ph; paths.push(path); continue; }
      // 받을 때 메모리에 둔 작은 파일: 이번에 HTML과 같이 올림. 메모리가 비었으면(객체가 내려감) 그 파일만 다시 받음
      const d = this.deferredItem(sha, rawExt(path));
      if (!d) { lostHere.add(sha); continue; }
      manifest[`/${path}`] = d.hash; paths.push(path);
      if (!deferred.has(d.hash)) { deferred.set(d.hash, { sha, ext: d.ext, size: this.deferred.get(sha).bytes.length }); extra.push(d); }
    }
    if (lostHere.size) throw new HttpError('missing_blobs', undefined, { missing: [...lostHere] });
    const te = new TextEncoder();
    add('robots.txt', te.encode(ROBOTS));
    if (!man.files.has('404.html')) add('404.html', te.encode(noFileHtml()));
    const headers = headersFile(paths, { scripts: this.cfg.allowSupabaseSdk && SUPABASE_SDK ? [SUPABASE_SDK] : [], fontsHashed: fontsHashed(man.list) });
    const redirects = redirectsFile(media, `${self}/s/${id}/`);
    const pc = this.pc();
    const { deployment, lost } = await this.pagesCall(() => deploySite(pc, { branch: branchOf(id), manifest, extra, headers, redirects, message: `lecpage ${id}` }));
    if (lost.length) {
      // Pages에서 사라진 파일(올린 뒤 오래 배포하지 않은 것): 기록을 지우고 다시 받음
      const lostSet = new Set(lost); const again = new Set();
      for (const r of this.sql.exec('SELECT sha, ext, phash FROM passet').toArray()) if (lostSet.has(r.phash)) { again.add(r.sha); this.sql.exec('DELETE FROM passet WHERE sha = ? AND ext = ?', r.sha, r.ext); }
      throw new HttpError('missing_blobs', undefined, { missing: [...again] });
    }
    if (this.load()?.pending !== deployId) throw new HttpError('not_found', '없는 배포예요. 목록(deploys)부터 다시 보내 주세요.');
    const now = Date.now(); const expires = expiryFrom(now, this.cfg.days); const prev = meta.current;
    const st = this.ps(meta);
    const old = [...st.deps, ...st.hold];
    st.url = url; st.self = self; st.deps = [deployment.id]; st.hold = []; st.man = { manifest, headers, redirects };
    const kept = this.keptBytes(meta, man.list);
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('UPDATE meta SET current = ?, pending = NULL, bytes = ?, expires = ? WHERE id = 1', deployId, kept, expires);
      if (prev && prev !== deployId) this.sql.exec('DELETE FROM deploy WHERE id = ?', prev);
      this.savePs(meta, st);
      // 같이 올린 작은 파일: 이제 Pages에 있으니 열쇠를 적고 메모리에서 뺌
      for (const [hash, x] of deferred) this.sql.exec('INSERT OR REPLACE INTO passet (sha, ext, phash, size) VALUES (?, ?, ?, ?)', x.sha, x.ext, hash, x.size);
    });
    for (const x of deferred.values()) { const d = this.deferred.get(x.sha); if (d) { this.deferred.delete(x.sha); this.deferredBytes -= d.bytes.length; } }
    Object.assign(meta, { current: deployId, pending: null, bytes: kept, expires });
    if (prev && prev !== deployId) this.manifests.delete(prev);
    await this.ctx.storage.setAlarm(expires);
    this.sweep();
    // 지난 배포(각자 고유 주소가 있음)는 지움. 못 지운 것은 다음 공개·지우기 때 다시
    const left = await this.dropDeployments(old.filter((d) => d !== deployment.id));
    if (left.length) { const s2 = this.ps(meta); s2.hold = left; this.savePs(meta, s2); }
    try { await this.gate('POST', 'site', { id, bytes: kept, expires, published: true, ...this.pagesDelta() }); } catch (e) { console.error('gate site update failed', e?.message); }
    if (meta.live_code) { try { await this.room(meta.live_code, 'touch', { site: id, expires }); } catch (e) { console.error('room touch failed', e?.message); } }
    return json(this.published(request, meta));
  }
  /** Pages API 오류를 앱이 알아듣는 오류로 */
  async pagesCall(fn) {
    try { return await fn(); } catch (e) { throw await this.pagesFail(e, 'Cloudflare Pages에 배포하지 못했어요. 잠시 뒤 다시 해 주세요.'); }
  }
  /**
   * Pages API 실패 → 오류. 429(그 계정의 API가 5분 막힘)면 Gate에 바로 알려 5분 동안 새 배포를 줄 세우고(다른 강사가 같은 벽에 부딪히지 않게),
   * 앱에는 rate_limited + reason 'pages_api' + retry-after로(앱의 [다시 배포]로 이어짐)
   */
  async pagesFail(e, message) {
    if (e instanceof HttpError || !e?.step) return e;
    console.error('pages error', e.step, e.status, e.code);
    if (e.status === 429) {
      try { await this.gate('POST', 'site', { id: this.load()?.site || '', ...this.pagesDelta() }); } catch { /* 다음 알림 때 */ }
      return new HttpError('rate_limited', '배포하는 사람이 한꺼번에 많아 Cloudflare가 잠시 쉬게 했어요. 2~5분 뒤 다시 배포해 주세요. 이미 배포한 사이트는 그대로 열려요.', { reason: 'pages_api', scope: 'everyone', retryAt: Date.now() + 300e3, headers: { 'retry-after': '300' } });
    }
    return new HttpError('bad_request', message, { status: 502 });
  }
  /** 배포들을 지움(별칭이 걸린 것도). 못 지운 id를 돌려줌 */
  async dropDeployments(ids) {
    const left = [];
    for (const d of ids) { try { await this.pc().deleteDeployment(d, true); } catch (e) { if (e?.status !== 404) { left.push(d); console.error('pages delete failed', e?.step, e?.status, e?.code); } } }
    return left;
  }
  /** 브랜치에 안내 화면 하나만 배포(가림·지움). 배포 id */
  async placeholder(meta, html) {
    const te = new TextEncoder(); const manifest = {}; const extra = [];
    for (const p of ['index.html', '404.html']) {
      const bytes = te.encode(html); const parts = base64Parts(bytes); const hash = pagesHash(bytes, 'html', parts);
      manifest[`/${p}`] = hash; if (!extra.some((x) => x.hash === hash)) extra.push({ hash, parts, contentType: contentTypeOf(p) });
    }
    const { deployment } = await this.pagesCall(() => deploySite(this.pc(), { branch: branchOf(meta.site), manifest, extra, headers: NOTICE_HEADERS, message: 'lecpage notice' }));
    return deployment.id;
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
    if (this.isPages(meta)) await this.wipePages(meta);
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.meta = null; this.manifests.clear(); this.jsOk.clear(); this.deployTimes = []; this.deferred.clear(); this.deferredBytes = 0;
    if (id) { try { await this.gate('POST', 'forget', { id, ...this.pagesDelta() }); } catch (e) { console.error('gate forget failed', e?.message); } }
  }
  /**
   * Pages에 있는 이 사이트의 배포를 모두 지움. 가장 최근 배포를 못 지우면(별칭) 안내 화면을 올린 뒤 나머지를 지움.
   * 실패해도 여기 기록은 지움(같은 브랜치 이름을 다시 쓰지 않으므로 남은 배포는 운영자가 대시보드에서 지울 수 있음)
   */
  async wipePages(meta) {
    if (!this.cfg.pagesCfg) { console.error('pages wipe skipped: no PAGES config', meta.site); return; }
    const st = this.ps(meta);
    let left = await this.dropDeployments([...st.deps, ...st.hold]);
    if (!left.length) return;
    try {
      const g = await this.placeholder(meta, goneHtml());
      left = await this.dropDeployments(left.filter((d) => d !== g));
      if (left.length) console.error('pages deployments left', meta.site, left.length);
    } catch (e) { console.error('pages wipe placeholder failed', e?.message); }
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
      // Pages 보기: 가리면 브랜치에 안내 화면을 올림(지난 배포는 풀 때 다시 쓰려고 둠). 풀면 마지막 공개 목록으로 다시 배포
      let restored;
      if (this.isPages(meta) && !!meta.blocked !== body.blocked) restored = body.blocked ? await this.holdPages(meta) : await this.releasePages(meta);
      this.sql.exec('UPDATE meta SET blocked = ?, block_reason = ? WHERE id = 1', body.blocked ? 1 : 0, reason);
      Object.assign(meta, { blocked: body.blocked ? 1 : 0, block_reason: reason });
      try { await this.gate('POST', 'site', { id: meta.site, blocked: body.blocked, ...this.pagesDelta() }); } catch (e) { console.error('gate site update failed', e?.message); }
      return json({ ok: true, id: meta.site, blocked: body.blocked, title: meta.title, expiresAt: meta.expires, liveCode: meta.live_code || null, ...(restored === false ? { restored: false, note: 'Pages에서 지난 파일을 찾지 못해 다시 열지 못했어요. 강사가 다시 배포하면 열려요.' } : {}) });
    });
  }
  async holdPages(meta) {
    if (!meta.current) return undefined; // 아직 공개 전: 가릴 배포가 없음
    const st = this.ps(meta);
    const d = await this.placeholder(meta, blockedHtml(meta.site, `${this.cfg.publicOrigin || st.self || ''}/report`));
    st.hold = [...st.hold, d]; this.savePs(meta, st);
    return undefined;
  }
  /** 가림을 풂: 마지막으로 공개한 목록으로 다시 배포하고 안내 화면 배포를 지움. 파일이 사라졌으면 false */
  async releasePages(meta) {
    const st = this.ps(meta);
    if (!st.man) return undefined;
    const { deployment, lost } = await this.pagesCall(() => deploySite(this.pc(), { branch: branchOf(meta.site), manifest: st.man.manifest, headers: st.man.headers, redirects: st.man.redirects, message: `lecpage ${meta.site}` }));
    if (lost.length) return false;
    const left = await this.dropDeployments([...st.deps, ...st.hold]);
    st.deps = [deployment.id]; st.hold = left; this.savePs(meta, st);
    return true;
  }

  /**
   * 쓰이는 사이트는 지우지 않음: 화면을 여는 방문이 있고 남은 기간이 절반 아래면 보관 기간을 다시 채움(사이트마다 보름에 한 번쯤만 씀).
   * 처음 만든 날부터 MAX_SITE_DAYS가 지나면 더 늘리지 않음. 가린 사이트는 늘리지 않음.
   */
  keepAlive(meta) {
    const c = this.cfg; const now = Date.now();
    if (!c.keepAlive || this.isPages(meta) || meta.blocked || meta.expires - now > (c.days * DAY_MS) / 2 || now - meta.created > c.maxSiteDays * DAY_MS) return;
    const expires = expiryFrom(now, c.days);
    this.sql.exec('UPDATE meta SET expires = ? WHERE id = 1', expires);
    meta.expires = expires;
    this.ctx.waitUntil((async () => {
      await this.ctx.storage.setAlarm(expires);
      try { await this.gate('POST', 'site', { id: meta.site, expires }); } catch (e) { console.error('gate site update failed', e?.message); }
      if (meta.live_code) { try { await this.room(meta.live_code, 'touch', { site: meta.site, expires }); } catch (e) { console.error('room touch failed', e?.message); } }
    })());
  }

  /** 보관 기간이 끝나면 전부 지움 */
  async alarm() {
    const meta = this.load();
    if (!meta) return;
    if (Date.now() >= meta.expires) await this.wipe();
    else await this.ctx.storage.setAlarm(meta.expires);
  }

  /**
   * 링크 미리보기 카드 그림: 첫 화면(index.html)에 og:image가 없으면, 처음 나오는 사이트 안 그림(png·jpg·webp, 8KB 넘는 것).
   * 배포마다 한 번만 읽고 기억함
   */
  ogImageFor(deployId, man) {
    if (this.ogCache.has(deployId)) return this.ogCache.get(deployId);
    let found = '';
    const hit = man.files.get('index.html');
    if (hit) {
      const row = this.sql.exec('SELECT data FROM blob WHERE sha = ? AND i = 0', hit[0]).toArray()[0];
      const html = row ? new TextDecoder().decode(new Uint8Array(row.data)) : '';
      if (!/<meta[^>]+property=["']og:image["']/i.test(html)) {
        for (const m of html.matchAll(/<img\b[^>]*?\ssrc=["']([^"'?#]+\.(?:png|jpe?g|webp))["']/gi)) {
          const p = m[1].replace(/^\.\//, '');
          let path; try { path = decodeURI(p); } catch { continue; }
          const f = man.files.get(path);
          if (f && f[1] >= OG_MIN_BYTES) { found = p; break; }
        }
      }
    }
    if (this.ogCache.size > 8) this.ogCache.clear();
    this.ogCache.set(deployId, found);
    return found;
  }

  // ── 내보내기 ─────────────────────────────────────────────────
  serve(request, url) {
    const head = request.method === 'HEAD';
    const meta = this.load();
    if (!meta || Date.now() >= meta.expires) {
      // Worker가 짧게 기억해 같은 없는 주소로 이 객체를 다시 깨우지 않게 함(밖으로는 내보내지 않음)
      const r = gonePage(head); r.headers.set('x-lp-state', 'gone'); return r;
    }
    if (meta.blocked) return blockedPage(meta.site, head);
    const man = meta.current ? this.manifest(meta.current) : null;
    const path = requestPath(url.searchParams.get('p'));
    if (!man) return notFoundPage(head);
    // Pages 보기: 영상·소리만 여기서, 나머지는 Worker가 Pages에서 가져와 내보냄(학교망에서 pages.dev가 막혔을 때 쓰는 이 호스트 주소)
    if (this.isPages(meta) && !(path && isMedia(path) && man.files.has(path))) {
      const pu = this.ps(meta).url;
      return pu ? new Response(null, { status: 204, headers: { 'x-lp-proxy': pu, 'cache-control': 'no-store' } }) : notFoundPage(head);
    }
    let status = 200; let name = path; let hit = path ? man.files.get(path) : null;
    if (!hit && path && !extOf(path)) { name = `${path}.html`; hit = man.files.get(name); }
    if (!hit) {
      name = '404.html'; hit = man.files.get(name); status = 404;
      if (!hit) return noFilePage(head);
    }
    const [sha, size] = hit;
    const type = typeOf(name);
    // 강사 화면에 붙일 운영자 공지(Worker가 넘겨 줌). 공지가 바뀌면 etag도 바뀌게 공지 id를 넣음
    let notices = [];
    if (type.kind === 'html' && name === 'console.html') {
      try { notices = JSON.parse(decodeURIComponent(request.headers.get('x-lp-notice') || '') || '[]'); } catch { notices = []; }
      if (!Array.isArray(notices)) notices = [];
    }
    const tag = type.kind === 'html' ? `${String(meta.current).slice(0, 8)}${notices.length ? `.${notices.map((n) => n.id).join('.')}` : ''}` : '';
    const v = url.searchParams.get('v') || '';
    const headers = fileHeaders(name, type, sha, { tag, immutable: status === 200 && ((v.length >= 8 && sha.startsWith(v)) || fontHashed(name, sha)), scripts: this.cfg.allowSupabaseSdk && SUPABASE_SDK ? [SUPABASE_SDK] : [] });
    if (status === 200 && etagMatches(request.headers.get('if-none-match'), headers.etag)) {
      delete headers['content-type'];
      return new Response(null, { status: 304, headers });
    }
    if (type.kind === 'html') {
      if (status === 200) this.keepAlive(meta);
      if (head) return new Response(null, { status, headers });
      return rewriteHtml(new Response(this.stream(sha, 0, size - 1), { status, headers }), meta.site, {
        reportLink: !NO_FRAME_PAGES.has(name), path: name, files: man.files, rt: RT, notices,
        origin: request.headers.get('x-lp-origin') || '', ogImage: name === 'index.html' ? this.ogImageFor(meta.current, man) : '',
      });
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

/** 요청 본문을 정확히 size바이트까지 읽음(넘거나 모자라면 오류) */
async function readAll(request, size) {
  const out = new Uint8Array(size); let got = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (got + value.byteLength > size) { reader.cancel().catch(() => { }); throw new HttpError('too_large', '목록에 적은 크기보다 커요.'); }
      out.set(value, got); got += value.byteLength;
    }
  }
  if (got !== size) throw new HttpError('bad_request', '목록에 적은 크기와 달라요.');
  return out;
}
