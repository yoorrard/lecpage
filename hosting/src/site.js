// Site: 사이트 하나마다 Durable Object 하나(SQLite 저장).
//  meta   사이트 정보 한 줄(열쇠 해시, 만든 때, 끝나는 때, 가림, 제목, 저장 크기, 지금 배포, 준비 중인 배포, 묶인 실시간 방 코드)
//  deploy 배포 목록(경로 → sha256·크기)을 JSON 한 줄로. 지금 것과 준비 중인 것만 남김
//  blob   파일 내용. sha256별로 1MiB씩 나눈 줄. 0번 줄은 내용이 맞는지 확인한 뒤 맨 나중에 쓰므로 "0번 줄이 있다 = 다 올라왔다"
//  ppack  (VIEW=pages) Pages에 올린 파일: sha256·확장자 → Pages 열쇠·크기. 내용은 두지 않음. 묶음 몇 줄로 저장(JSON, 메모리에서 읽고 씀 → pa·writePa)
//         (작은 파일은 받을 때 메모리에만 두었다가 공개할 때 한 번에 올리고 그때 적음 → deferred)
//  passet 이 판(2026-11-24) 전에 만든 사이트의 같은 표(파일 하나에 한 줄). 그대로 읽고, 다음에 쓸 때 ppack으로 옮긴 뒤 표를 비움(dropLegacy: 줄마다 지우지 않고 표째로).
//         새 사이트에도 빈 표를 만들어 둠: 이 판 전의 코드는 이 표가 있다고 보고 읽으므로, 예전 판으로 되돌려도 새 사이트가 그대로 다뤄지게(빈 표 = 파일을 다시 받음)
//  jsk    (VIEW=pages) 받은 .js가 사이트가 직접 쓴 스크립트인지(own=1) 엔진 런타임인지(0). 줄이 없으면 예전 판에서 받은 런타임
//         내용을 두지 않으므로 공개할 때(보조 쪽 검사)·두 번째 주소로 내보낼 때(직접 쓴 스크립트는 내보내지 않음) 이 표를 봄
// 표는 사이트를 만들 때(init)만 생깁니다. 없는 주소로 들어온 요청은 읽기만 하고 아무것도 쓰지 않습니다.
//
// 보기(view)는 사이트를 만들 때 정해져 바뀌지 않습니다.
//  worker: 모든 파일을 여기 두고 Worker가 /s/<id>/로 내보냄. 모든 사이트가 한 출처라 .js는 엔진 런타임만 받음
//  pages : HTML(손보기 전 원본)과 영상·소리만 여기 두고, 나머지는 받을 때 검사한 뒤 바로 Pages에 올림.
//          공개할 때 HTML을 손봐 올리고 브랜치 s-<id>에 배포 → https://s-<id>.<프로젝트>.pages.dev (pages-site.js)
//          사이트마다 출처가 갈려 사이트가 직접 쓴 스크립트(assets/site.js 등)도 검사해 받음(sitecheck.js). 이 호스트 주소(/s/<id>/)로는 내보내지 않음
import { DurableObject } from 'cloudflare:workers';
import { config, expiryFrom, HOUR_MS, DAY_MS } from './config.js';
import { HttpError, json, noContent, readJson, errorFrom } from './http.js';
import { bearer, keyMatches, newDeployId, hex, SHA256_RE, DEPLOY_RE } from './ids.js';
import { checkManifest, missingBlobs, scriptBlobs } from './manifest.js';
import { typeOf, extOf, requestPath } from './paths.js';
import { isRuntimeJs, looksLikeRuntime } from './runtime.js';
import { STATIC_RUNTIME, PAGES_RUNTIME } from './runtime-allow.js';
import { fileHeaders, etagMatches, parseRange, NO_FRAME_PAGES, declaredLive } from './csp.js';
import { checkHtml, checkCss, checkOwnScript, pageData } from './sitecheck.js';
import { rewriteHtml } from './rewrite.js';
import { gonePage, removedPage, blockedPage, notFoundPage, noFilePage } from './pages.js';
import { normCode } from './live/host.js';
import { PagesClient, deploySite } from './pages-api.js';
import { pagesHash, base64Parts } from './blake3.js';
import { isMedia, branchOf, siteUrlOf, headersFile, headerRules, PAGES_HEADER_RULES, redirectsFile, ROBOTS, noFileHtml, blockedHtml, goneHtml, removedHtml, NOTICE_HEADERS, contentTypeOf, rawExt, fontHashed, fontsHashed } from './pages-site.js';

/** blob 한 줄의 크기(DO SQLite는 한 줄 2MB까지) */
export const CHUNK = 1024 * 1024;
/** 정적 사본(/rt/)이 있는 런타임 파일 */
const RT = new Set(STATIC_RUNTIME || []);
/**
 * Pages 보기: 이 크기 아래의 파일(CSS·작은 그림·글꼴 등)은 받을 때 바로 Pages에 올리지 않고 메모리에 잠깐 두었다가 공개할 때 HTML과 한 번에 올림.
 * 파일마다 Pages API를 1~2번 부르던 것이 공개 한 번에 1번으로 줄어 Cloudflare API 한도(5분에 1,200번)에 덜 닿고, 저장소에 쓰지 않아 행 쓰기(무료 하루 10만)도 늘지 않음.
 * 그사이 이 객체가 내려가 메모리가 비면 공개할 때 missing_blobs로 그 파일만 다시 받음(앱이 알아서 다시 보냄)
 */
export const DEFER_MAX = 4 * 1024 * 1024;
/**
 * 사이트 하나가 메모리에 잠깐 두는 파일 합계. 차면 그때까지 모은 것을 Pages에 한 번에 올리고(flushPool: 확인·올리기·열쇠 적기 3번) 다시 모음.
 * 예전에는 차고 난 뒤의 파일을 하나씩 올려(파일마다 3번) 쪽 그림 수백 장짜리 사이트가 Cloudflare API 5분 한도(1,200번)에 닿을 수 있었음
 */
export const DEFER_TOTAL = 16 * 1024 * 1024;
/** 묶음 요청(PUT blobs, 파일 여럿)의 머리(파일 목록 JSON) 한도와 파일 수 */
export const BUNDLE_HEAD_MAX = 64 * 1024;
export const BUNDLE_FILES = 700;
/** 묶음 안의 파일 하나만 실패로 돌려주는 오류(그 파일의 내용 문제). 나머지(사이트가 없음·붐빔·Cloudflare 오류)는 요청 전체의 오류 */
const BUNDLE_FILE_ERRORS = new Set(['bad_request', 'too_large', 'runtime_mismatch', 'script_not_allowed', 'unsafe_site', 'bad_type', 'bad_path']);
/** Pages 보기에서 올려받지 않는 파일(호스트 정책으로 바꿔 넣음) */
const PAGES_SKIP = new Set(['robots.txt']);
/** 공개 한 번에 드는 Pages API 어림(토큰·확인·올리기·열쇠 적기·배포·준비 확인·지난 배포 지우기) */
const PUBLISH_CALLS = 7;
/** 큰 파일(DEFER_MAX 넘는 것) 하나를 받을 때 드는 Pages API(확인·올리기·열쇠 적기). Gate의 5분 창이 실제보다 적게 세지 않게 */
const BIG_FILE_CALLS = 3;
/** 예전 배포에만 있던 경로를 적어 두는 수(안내 화면 배포가 덮음. Pages 배포 한 번의 파일 수 한도보다 훨씬 작게) */
const PAST_PATHS = 2000;
/** 그 경로들의 글자 수 합 상한(오래된 것부터 버림): 사이트 상태 한 줄(pstate)이 저장소의 줄 크기 한도(2MB)에 닿지 않게. 보통 사이트는 수천 자라 닿지 않음 */
const PAST_CHARS = 200000;
/** 미리보기 카드 그림으로 쓸 만한 크기(작은 아이콘은 뺌) */
const OG_MIN_BYTES = 8000;
const MANIFEST_MAX = 1024 * 1024;
/**
 * 지우기에서 Pages 배포를 다 지우지 못했을 때 다시 해 볼 때까지(뒤로 갈수록 길게, 그 뒤로는 하루마다). 그동안 이 사이트는 '지우는 중':
 * 두 번째 주소·방·고치기는 바로 닫히고, Gate 목록과 관리 화면에 '지우는 중'으로 남음. 6시간이 지나도 안 되면 하루 점검이 웹훅으로 한 번 알림
 */
export const WIPE_RETRY_MS = [60e3, 10 * 60e3, HOUR_MS, 6 * HOUR_MS, DAY_MS];
/**
 * 답이 끊긴 '배포 만들기'(우리는 실패로 알지만 Cloudflare에는 생겼을 수 있음, pstate.orphan = 그때)가 늦게 끝날 수 있다고 보는 시간.
 * 우리가 기다리는 시간(90초)과 Cloudflare 쪽 처리 시간을 넉넉히 넘김. 이 시간이 지나기 전에는 '모르는 배포가 더 생길 수 있음'으로 다룸
 * (Pages는 브랜치 주소를 그 브랜치의 가장 최근 배포에 붙이므로, 내린 뒤에 늦게 생긴 배포가 안내 화면 대신 나올 수 있음 → 이 시간이 지난 뒤 한 번 더 확인)
 */
const ORPHAN_SETTLE_MS = 5 * 60e3;
/** 모르는 배포를 찾을 때 보는 배포 목록 쪽 수(한 쪽 25개, 최근 것부터). 생긴 직후에 찾으므로 몇 쪽이면 닿음. 못 닿으면 표시를 남겨 내릴 때 안내 화면으로 덮음 */
const STRAY_PAGES = 4;
/** 내릴 때 목록을 못 받아도(Cloudflare 오류) 이만큼만 다시 해 보고 끝냄(주소는 이미 안내 화면으로 덮여 있음) */
const STRAY_TRIES = 3;
/** 시각 비교 여유(우리 시계로 적은 때(orphan)와 Cloudflare가 적은 created_on을 견줄 때) */
const STRAY_SKEW_MS = 5000;
const WIPING_MSG = '사이트를 내리는 중이에요. Cloudflare가 잠시 답하지 않아 서버가 몇 분 안에 다시 해서 지워요. 이 주소는 그동안에도 고치거나 다시 배포할 수 없어요.';

/** 예전 자산 표(파일 하나에 한 줄). 2026-11-23까지의 판(운영 5029d91)이 쓰던 모양 그대로: 그 판은 이 표가 없으면 읽다가 멈춤 */
const PASSET_SCHEMA = 'CREATE TABLE IF NOT EXISTS passet (sha TEXT NOT NULL, ext TEXT NOT NULL, phash TEXT NOT NULL, size INTEGER NOT NULL, PRIMARY KEY (sha, ext)) WITHOUT ROWID';
const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY CHECK (id = 1), site TEXT NOT NULL, key_hash TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL, expires INTEGER NOT NULL, blocked INTEGER NOT NULL DEFAULT 0, block_reason TEXT NOT NULL DEFAULT '', bytes INTEGER NOT NULL DEFAULT 0, current TEXT, pending TEXT, live_code TEXT, view TEXT NOT NULL DEFAULT 'worker', pstate TEXT);
${PASSET_SCHEMA};
CREATE TABLE IF NOT EXISTS deploy (id TEXT PRIMARY KEY, created INTEGER NOT NULL, bytes INTEGER NOT NULL, stored INTEGER NOT NULL, files TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS blob (sha TEXT NOT NULL, i INTEGER NOT NULL, total INTEGER, data BLOB NOT NULL, PRIMARY KEY (sha, i)) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS jsk (sha TEXT PRIMARY KEY, own INTEGER NOT NULL) WITHOUT ROWID;
`;
/** 사이트 쪽 HTML에서 실시간 서버 주소를 찾아볼 쪽 수(사이트 자료 lp-data). 엔진 사이트는 6쪽 안팎 */
const LIVE_SCAN_PAGES = 30;
/**
 * (Pages 보기) 자산 표(내용 sha256·확장자 → Pages 열쇠·크기)는 묶음 몇 줄(ppack: i, data = JSON [[sha, ext, phash, size], …])로 저장.
 * 예전에는 파일 하나에 한 줄(passet)이라 새 사이트 한 번에 수백 줄(글꼴 조각), 3,000개 사이트는 3,000줄을 썼음(무료 하루 10만 줄, 지울 때도 같은 만큼).
 * 묶음 한 줄은 저장소의 줄 크기 한도(2MB)에 닿지 않게 이 글자 수에서 나눔(3,000개가 약 35만 자라 보통 한 줄)
 */
const PACK_CHARS = 900000;
const PACK_SCHEMA = 'CREATE TABLE IF NOT EXISTS ppack (i INTEGER PRIMARY KEY, data TEXT NOT NULL)';
const paKey = (sha, ext) => `${sha}|${ext}`;

export class Site extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // 쓴 행 수를 셈(무료 하루 10만 행, 지우기도 쓴 행): 사이트 파일이 수백 개면(글꼴 조각) 새 배포 한 번에 수백 행이라
    // Gate가 오늘 몫에 넣을 수 있게 pagesDelta로 알림. exec의 동작은 그대로(돌려준 커서를 그대로 넘김)
    // (문장 여럿을 한 번에 실행하면 커서가 마지막 문장의 행만 알려 줌 — 표를 만드는 SCHEMA뿐이고 몇 줄이라 따로 세지 않음)
    const raw = ctx.storage.sql;
    this.rowsW = 0; this.rwSent = 0;
    this.sql = { exec: (...a) => { const c = raw.exec(...a); const n = c.rowsWritten; if (n > 0) this.rowsW += n; return c; } };
    this.cfg = config(env);
    this.meta = undefined; // undefined = 아직 안 봄, null = 없는 사이트
    this.manifests = new Map(); // 배포 id → 풀어 둔 목록
    this.uploading = new Map(); // sha256 → 올리는 중인 작업
    this.jsOk = new Set(); // 런타임으로 확인한 sha256
    this.jskMem = new Map(); // (Pages 보기) sha256 → 사이트가 직접 쓴 스크립트인지(jsk 표를 읽은 것)
    this.liveMem = new Map(); // 배포 id → 사이트가 적은 바깥 실시간 서버 출처(csp.js declaredLive)
    this.deployTimes = [];
    this.liveTimes = [];
    this.queue = Promise.resolve();
    this.ogCache = new Map(); // 배포 id → 미리보기 카드 그림 경로('' = 없음)
    this.deferred = new Map(); // (Pages 보기) 공개할 때 한 번에 올릴 작은 파일: sha256 → { size, items: [{ ext, hash, parts, contentType }] }. 내용은 parts(base64)만 둠(원본 바이트까지 두면 메모리를 두 배로 씀)
    this.deferredBytes = 0;
    this.deferMax = this.cfg.deferMax || DEFER_MAX;
    this.deferTotal = this.cfg.deferTotal || DEFER_TOTAL;
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
        case 'PUT bundle': return await this.uploadBundle(request);
        case 'POST publish': return await this.publish(request, arg);
        case 'DELETE site': return await this.remove(request, false);
        case 'DELETE admin-site': return await this.remove(request, true);
        case 'POST admin-block': return await this.block(request);
        case 'POST live': return await this.bindLive(request);
        case 'GET live-status': return this.liveStatus(url);
        case 'GET records': return await this.records(request);
        case 'POST expire': return await this.expireCheck(); // Gate 하루 점검: 기간이 지났는데 아직 목록에 있는 사이트
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
    else this.sql.exec('CREATE TABLE IF NOT EXISTS jsk (sha TEXT PRIMARY KEY, own INTEGER NOT NULL) WITHOUT ROWID'); // 사이트 스크립트를 받기 전에 만든 사이트
  }
  /** VIEW=pages로 만든 사이트인지 */
  isPages(meta = this.load()) { return !!meta && meta.view === 'pages'; }
  /** Pages 상태: { url, self(이 호스트 주소), deps: [배포 id…], man: { manifest, headers, redirects } | null(가림을 풀 때 다시 배포), hold: [안내 화면·못 지운 배포 id…], past: [예전 배포에만 있던 경로…](안내 화면이 덮음) } */
  ps(meta = this.load()) {
    let v = null;
    try { v = meta?.pstate ? JSON.parse(meta.pstate) : null; } catch { v = null; }
    return { url: '', deps: [], man: null, hold: [], past: [], ...(v || {}) };
  }
  savePs(meta, st) { const j = JSON.stringify(st); this.sql.exec('UPDATE meta SET pstate = ? WHERE id = 1', j); meta.pstate = j; }
  /** 지우는 중이면 { at, n, expired }(Pages 배포를 다 못 지워 알람으로 다시 하는 중), 아니면 null */
  wiping(meta = this.load()) { return meta && meta.pstate ? this.ps(meta).wiping || null : null; }
  /** 살아 있는 사이트(지우는 중이 아님) */
  alive(meta = this.load()) { return !!meta && !this.wiping(meta); }
  pc() {
    const p = this.cfg.pagesCfg;
    if (!p) throw new HttpError('bad_request', 'Pages 설정(PAGES_TOKEN 등)이 없어 이 사이트를 다룰 수 없어요. 운영자에게 알려 주세요.', { status: 503 });
    if (!this.pagesClient) this.pagesClient = new PagesClient({ api: p.api, accountId: p.accountId, project: p.project, token: p.token, timeout: p.timeoutMs });
    return this.pagesClient;
  }
  /** 지난번 알린 뒤 Pages API를 부른 횟수와 방(Room)을 부른 횟수(Gate가 하루 숫자 pc·pz·rc에 더함) */
  pagesDelta() {
    const p = this.pagesClient || { calls: 0, limited: 0 };
    const d = { pc: p.calls - (this.pcSent || 0), pz: p.limited - (this.pzSent || 0), rc: (this.roomCalls || 0) - (this.rcSent || 0), rw: this.rowsW - this.rwSent };
    this.pcSent = p.calls; this.pzSent = p.limited; this.rcSent = this.roomCalls || 0; this.rwSent = this.rowsW;
    return d;
  }
  /** 여기(Durable Object)에 내용을 두는 파일인지: Worker 보기는 전부, Pages 보기는 HTML(원본)과 영상·소리 */
  keepsHere(meta, path) { return !this.isPages(meta) || typeOf(path)?.kind === 'html' || isMedia(path); }
  /**
   * 자산 표를 메모리로: 묶음(ppack)과, 이 판 전에 만든 사이트의 예전 줄(passet, 파일 하나에 한 줄)을 함께 읽음. 예전 줄은 다음에 쓸 때 묶음으로 옮기고 표를 비움(writePa, 한 거래).
   * 둘 다 있으면 묶음이 나중 것이라 묶음이 이김(옮기기는 한 거래라 실제로는 겹치지 않음).
   * 읽은 줄은 다 꺼내 둠(toArray): 읽는 커서가 열린 채로 남아 있으면 그 표를 지우지(dropLegacy) 못함
   */
  pa() {
    if (this.paMap) return this.paMap;
    const m = new Map(); let legacy = 0; let chunks = 0;
    const tables = new Set(this.sql.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('passet', 'ppack')").toArray().map((r) => r.name));
    if (tables.has('passet')) for (const r of this.sql.exec('SELECT sha, ext, phash, size FROM passet').toArray()) { m.set(paKey(r.sha, r.ext), [r.phash, r.size]); legacy++; }
    if (tables.has('ppack')) {
      for (const r of this.sql.exec('SELECT data FROM ppack ORDER BY i').toArray()) {
        chunks++;
        let list = [];
        try { list = JSON.parse(r.data); } catch { list = []; } // 읽지 못한 묶음: 그 파일들만 다시 받음(missing_blobs)
        for (const e of Array.isArray(list) ? list : []) if (Array.isArray(e) && typeof e[0] === 'string' && typeof e[2] === 'string') m.set(paKey(e[0], String(e[1] ?? '')), [e[2], +e[3] || 0]);
      }
    }
    this.paMap = m; this.paLegacy = legacy; this.paChunks = chunks; this.paDirty = false; this.paTable = tables.has('ppack');
    return m;
  }
  passet(sha, ext) { return this.pa().get(paKey(sha, ext))?.[0] || ''; }
  /** 자산 표에 적음(메모리). 저장은 flushPa·writePa가 묶음으로 */
  paSet(sha, ext, phash, size) {
    const m = this.pa(); const k = paKey(sha, ext); const cur = m.get(k);
    if (cur && cur[0] === phash && cur[1] === size) return;
    m.set(k, [phash, size]); this.paDirty = true;
  }
  /** 자산 표에서 뺌(메모리). keep(sha, ext, phash)이 false인 것 */
  paKeep(keep) {
    const m = this.pa();
    for (const [k, v] of m) { const i = k.indexOf('|'); if (!keep(k.slice(0, i), k.slice(i + 1), v[0])) { m.delete(k); this.paDirty = true; } }
  }
  /** 묶음 표를 만듦(처음 한 번, 거래 밖에서) */
  paReady() { if (!this.paTable) { this.sql.exec(PACK_SCHEMA); this.paTable = true; } }
  /**
   * 예전 줄(passet)을 한꺼번에 비움(거래 안에서 부름): 표를 지우고 빈 표로 다시 만듦. 거래가 되돌려지면 예전 줄도 그대로 돌아옴.
   * 줄마다 지우면(DELETE) 줄 수만큼 쓴 행으로 청구되지만(실측: 300줄 = 300행, 보통 사이트 약 580줄) 표 지우기는 0행·다시 만들기 2행.
   * 빈 표를 남기는 까닭은 PASSET_SCHEMA(예전 판으로 되돌렸을 때)
   */
  dropLegacy() { this.sql.exec('DROP TABLE passet'); this.sql.exec(PASSET_SCHEMA); }
  /** 바뀐 자산 표를 묶음 줄로 씀(거래 안에서 부름. 먼저 paReady). 예전 줄(passet)이 있으면 같은 거래에서 비움 → 옮기다 끊겨도 한쪽으로만 읽힘 */
  writePa() {
    if (!this.paMap || (!this.paDirty && !this.paLegacy)) return;
    const rows = []; let cur = []; let len = 2;
    for (const [k, v] of this.paMap) {
      const i = k.indexOf('|'); const e = [k.slice(0, i), k.slice(i + 1), v[0], v[1]]; const add = k.length + String(v[0]).length + String(v[1]).length + 12;
      if (len + add > PACK_CHARS && cur.length) { rows.push(cur); cur = []; len = 2; }
      cur.push(e); len += add;
    }
    if (cur.length) rows.push(cur);
    rows.forEach((r, i) => this.sql.exec('INSERT OR REPLACE INTO ppack (i, data) VALUES (?, ?)', i, JSON.stringify(r)));
    if (this.paChunks > rows.length) this.sql.exec('DELETE FROM ppack WHERE i >= ?', rows.length);
    if (this.paLegacy) this.dropLegacy();
    this.paChunks = rows.length; this.paLegacy = 0; this.paDirty = false;
  }
  /** 바뀐 자산 표를 저장(바뀐 것이 없으면 아무것도 쓰지 않음) */
  flushPa() {
    if (!this.paMap || !this.paDirty) return;
    this.paReady();
    this.ctx.storage.transactionSync(() => this.writePa());
  }
  /** 알람 잡기: 쓴 행 하나로 청구됨(Cloudflare 요금 안내) → 쓴 행 수에 넣음 */
  alarmSet(t) { this.rowsW += 1; return this.ctx.storage.setAlarm(t); }
  /**
   * 저장소를 통째로 지움. 지우기도 쓴 행으로 청구되므로(통째 지우기를 줄마다 세는지는 요금 안내에 없어, 세는 쪽으로) 지우기 전 줄 수를 쓴 행 수에 더함.
   * 자산 표를 묶음으로 쓴 뒤로는 사이트 하나가 열몇 줄이라 넉넉히 세어도 작음.
   * 예전 줄(passet, 파일 하나에 한 줄)이 남은 사이트는 그 표를 먼저 표째로 비움(dropLegacy): 통째 지우기가 그 줄들을 줄마다 지우지 않게, 세는 수에도 들지 않게
   */
  async dropAll() {
    try {
      const names = this.sql.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('meta', 'deploy', 'blob', 'jsk', 'ppack', 'passet', 'gone')").toArray().map((r) => r.name);
      if (names.includes('passet') && this.sql.exec('SELECT 1 FROM passet LIMIT 1').toArray().length) this.ctx.storage.transactionSync(() => this.dropLegacy());
      for (const t of names) this.rowsW += this.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`).one().n;
    } catch (e) { console.error('row count before deleteAll failed', e?.message); }
    await this.ctx.storage.deleteAll();
    this.paReset();
  }
  /** 메모리 자산 표를 버림(지웠을 때: 다음에 다시 읽음) */
  paReset() { this.paMap = null; this.paLegacy = 0; this.paChunks = 0; this.paDirty = false; this.paTable = false; }
  deferredItem(sha, ext) { return this.deferred.get(sha)?.items.find((x) => x.ext === ext) || null; }
  /** Pages 보기: 엔진 런타임 그대로인 .js는 모든 사이트가 같아 Pages 열쇠를 미리 앎(scripts/gen-runtime.mjs) → 올려받지 않음 */
  knownRuntime(files) {
    for (const [path, sha, size] of files) {
      const ph = PAGES_RUNTIME?.[sha];
      if (!ph || rawExt(path) !== 'js' || this.passet(sha, 'js')) continue;
      this.paSet(sha, 'js', ph, size); // 저장은 이 요청 끝의 sweep이 한 번에(끊겨도 다음 목록 받기 때 다시 채움)
      this.jsOk.add(sha);
    }
  }
  /** 이번 배포에 드는 Pages API 어림(Gate의 5분 창): 공개 한 번 + 큰 파일마다 확인·올리기 */
  pagesEstimate(meta, files, missing) {
    const want = new Set(missing); let big = 0; let small = 0;
    for (const [path, sha, size] of files) {
      if (!want.has(sha) || this.keepsHere(meta, path)) continue;
      want.delete(sha);
      if (size > this.deferMax) big++; else small += size;
    }
    // 작은 파일은 DEFER_TOTAL만큼 모일 때마다 한 번에 올림(마지막 남은 것은 공개할 때 같이)
    return PUBLISH_CALLS + BIG_FILE_CALLS * (big + Math.floor(small / this.deferTotal));
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
  /** 여기 둔 파일 내용 전부(HTML·CSS 검사, 사이트 자료 읽기) */
  blobBytes(sha, size) {
    const out = new Uint8Array(size); let o = 0;
    for (const r of this.sql.exec('SELECT data FROM blob WHERE sha = ? ORDER BY i', sha)) { const u = new Uint8Array(r.data); if (o + u.length > size) break; out.set(u, o); o += u.length; }
    if (o !== size) throw new HttpError('missing_blobs', undefined, { missing: [sha] });
    return out;
  }
  /** (Pages 보기) 받은 .js가 사이트가 직접 쓴 스크립트인지. jsk에 줄이 없으면 런타임(예전 판에서 받은 것) */
  isOwnJs(sha) {
    if (!this.jskMem.has(sha)) this.jskMem.set(sha, this.sql.exec('SELECT own FROM jsk WHERE sha = ?', sha).toArray()[0]?.own === 1);
    return this.jskMem.get(sha);
  }
  /**
   * 받은 .js 하나 검사. 엔진 런타임 그대로면 'runtime'. 런타임처럼 시작하는데 다르면 앱과 서버의 판이 어긋났거나 손댄 것(runtime_mismatch: 앱이 새로 고친 뒤 다시).
   * 그 밖은 사이트가 직접 쓴 스크립트: pages 보기는 검사(sitecheck.js)한 뒤 'own', worker 보기는 모든 사이트가 한 출처라 받지 않음
   */
  async classifyJs(meta, sha, bytes, path) {
    if (this.jsOk.has(sha)) return 'runtime';
    if (await isRuntimeJs(bytes)) { this.jsOk.add(sha); return 'runtime'; }
    if (looksLikeRuntime(bytes)) throw new HttpError('runtime_mismatch', undefined, { path });
    if (!this.isPages(meta)) throw new HttpError('script_not_allowed', `이 바로 배포 서버는 사이트가 직접 쓴 스크립트를 받지 않아요(${path}). 모든 사이트가 한 주소를 같이 써서 다른 사이트에 영향을 줄 수 있어요. 내 계정으로 배포하거나 운영자에게 알려 주세요.`, { path });
    checkOwnScript(bytes, path);
    return 'own';
  }
  /**
   * 공개 전 검사: HTML(두 보기 모두, sitecheck.js)과 CSS(worker 보기. pages 보기는 받을 때 봄).
   * 보조 쪽에 사이트가 직접 쓴 스크립트가 있는지·엔진 비밀번호 칸이 있는 쪽에 그런 스크립트가 있는지는 jsk 표로 앎
   */
  checkSite(meta, man) {
    const pages = this.isPages(meta);
    const isOwnScript = (p) => { const f = pages ? man.files.get(p) : null; return !!f && typeOf(p)?.kind === 'js' && this.isOwnJs(f[0]); };
    const td = new TextDecoder();
    for (const [path, sha, size] of man.list) {
      const kind = typeOf(path)?.kind;
      if (kind === 'html') checkHtml(td.decode(this.blobBytes(sha, size)), path, { isOwnScript });
      else if (!pages && extOf(path) === 'css') checkCss(td.decode(this.blobBytes(sha, size)), path);
    }
  }
  /** 사이트 자료(lp-data)에 적힌 바깥 실시간 서버(강사 계정)의 출처. 첫 화면부터 보고 처음 찾은 것. 배포마다 한 번 읽어 기억 */
  liveOf(deployId, man, self) {
    const k = `${deployId}|${self}`;
    if (this.liveMem.has(k)) return this.liveMem.get(k);
    const order = ['index.html', 'check.html', 'privacy.html', ...man.list.map(([p]) => p).filter((p) => typeOf(p)?.kind === 'html')];
    const td = new TextDecoder(); let out = []; let n = 0;
    for (const path of new Set(order)) {
      const f = man.files.get(path);
      if (!f || !this.hasBlob(f[0])) continue;
      if (n++ >= LIVE_SCAN_PAGES) break;
      const live = pageData(td.decode(this.blobBytes(f[0], f[1])))?.live;
      if (live && typeof live === 'object' && live.provider) { out = declaredLive(live, self); break; }
    }
    if (this.liveMem.size > 8) this.liveMem.clear();
    this.liveMem.set(k, out);
    return out;
  }
  /** 사이트 쪽 CSP에 넣을 것(csp.js roomSources): 이 호스트 주소, 묶인 방 코드, 사이트 id, 보기, 바깥 실시간 서버 */
  cspCtx(meta, deployId, man, self) {
    return { host: self, code: meta.live_code || '', site: meta.site, pages: this.isPages(meta), live: this.liveOf(deployId, man, self) };
  }
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
  /** wiping: 지우는 중인 사이트도 받음(지우기를 다시 부를 때만) */
  async authed(request, { wiping = false } = {}) {
    const meta = this.load();
    if (!meta || Date.now() >= meta.expires || (!wiping && this.wiping(meta))) throw new HttpError('not_found');
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
    await this.alarmSet(expires);
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
    // 한도는 이 사이트의 보기로 고름: worker 보기 사이트(파일을 모두 이 객체 저장소에 둠)는 서버가 지금 pages 보기여도 worker 한도까지만.
    // 서버가 worker 보기면 운영자가 정한 한도(MAX_BYTES·MAX_FILES) 그대로 — /api/info가 알려 주는 숫자와 같게
    const workerSiteOnPages = !this.isPages(first) && this.cfg.view === 'pages';
    const man = checkManifest(body, workerSiteOnPages ? { ...this.cfg, maxBytes: Math.min(this.cfg.maxBytes, this.cfg.workerMaxBytes), maxFiles: Math.min(this.cfg.maxFiles, this.cfg.workerMaxFiles) } : this.cfg);
    // Pages _headers는 규칙 100개까지(넘는 규칙은 버려짐): 확장자 대소문자 모양이 너무 여러 가지면 올리기 전에 거절(보안 규칙이 빠지지 않게)
    if (this.isPages(first) && headerRules(man.files.map(([p]) => p)).length > PAGES_HEADER_RULES) {
      throw new HttpError('bad_path', '파일 이름 끝(.png 같은 확장자)의 대문자·소문자 모양이 너무 여러 가지예요. 확장자를 소문자로 맞춰 다시 배포해 주세요.');
    }
    return this.exclusive(async () => {
      const meta = this.load();
      if (!this.alive(meta)) throw new HttpError('not_found');
      if (this.isPages(meta)) this.knownRuntime(man.files);
      const have = this.blobSizes();
      for (const [path, sha, size] of man.files) if (have.has(sha) && have.get(sha) !== size) throw new HttpError('bad_request', `size가 맞지 않아요: ${path}`);
      const missing = this.missingFor(meta, man.files, have);
      const keep = this.keptBytes(meta, man.files);
      // Pages 보기: 영상·소리는 이 객체 저장소에 둠(Range 요청 때문에) → 사이트 하나가 전체 저장량을 다 쓰지 않게 합계를 따로 봄(HTML은 작아서 같이 셈)
      if (this.isPages(meta) && keep > this.cfg.maxMediaBytes) {
        throw new HttpError('too_large', `영상·소리 파일은 모두 합쳐 ${Math.round(this.cfg.maxMediaBytes / 1024 / 1024)}MB까지예요. 영상은 유튜브 같은 곳에 올려 링크로 넣어 주세요.`);
      }
      // Gate에 한 번만 물음: 운영자 멈춤(다시 배포도 받지 않음, 이미 공개한 판은 그대로 열림) · Pages API 5분 창 · 연수 날짜·인원(그날이 찼으면 올리기 전에 알림, 바뀌면 갈아 끼움) · 저장량
      const chk = await this.gate('POST', 'deploy-check', {
        site: meta.site, booking: body.booking && typeof body.booking === 'object' ? body.booking : null,
        pages: this.isPages(meta) ? this.pagesEstimate(meta, man.files, missing) : 0, split: Array.isArray(body.caps) && body.caps.includes('split'),
      });
      if (chk.bytes - meta.bytes + keep > this.cfg.maxTotalBytes) {
        // 아직 한 번도 배포하지 않은 사이트(방금 만든 빈 사이트)면 기록을 남기지 않음. 앱은 다음에 새 주소로 다시 만듦
        if (!meta.current) await this.wipe();
        throw new HttpError('full');
      }
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
      if (!this.alive(meta)) throw new HttpError('not_found');
      const prev = meta.live_code || null;
      // 이 사이트의 첫 방일 때만 하루 개수에 셈(코드를 바꾸는 것은 방 하나를 갈아 끼우는 것). Gate가 이때 코드도 적음(따로 부르지 않음)
      const counted = prev ? null : await this.gate('POST', 'room', { id: meta.site, code });
      // 사이트에 먼저 적고 방을 묶음: 중간에 끊겨도 "사이트가 모르는 방"이 남지 않음(방은 기간 끝에 사이트에 물어보고 스스로 비움)
      const setCode = (c) => { this.sql.exec('UPDATE meta SET live_code = ? WHERE id = 1', c); meta.live_code = c; };
      if (prev !== code) setCode(code);
      let out;
      try {
        out = await this.room(code, 'bind', { site: meta.site, code, adminKeyHash, settings: body.settings, expires: meta.expires, blocked: !!meta.blocked });
      } catch (e) {
        if (prev !== code) setCode(prev);
        if (!prev) {
          try { await this.gate('POST', 'site', { id: meta.site, code: '' }); } catch { /* 관리 화면 숫자만 어긋남 */ }
          if (Number.isSafeInteger(counted?.day)) { try { await this.gate('POST', 'room-undo', { day: counted.day }); } catch { /* 하루 몫 하나만 어긋남 */ } }
        }
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
    const alive = this.alive(meta) && Date.now() < meta.expires && meta.live_code === url.searchParams.get('code');
    return json({ alive, expires: alive ? meta.expires : 0, blocked: alive ? !!meta.blocked : false });
  }

  /**
   * 강사(사이트 열쇠)가 [사이트 내리기]·다시 배포 전에 보는 참여 기록 수(참가자·출석·질문·보드 글·투표 답·설문)와 마지막 기록 때.
   * 내용은 주지 않음(강사 화면에서 봄). 방이 없으면 live: false
   */
  async records(request) {
    const meta = await this.authed(request);
    if (!meta.live_code) return json({ ok: true, live: false });
    let r = null;
    try { r = await this.room(meta.live_code, 'counts', { site: meta.site }); } catch (e) { console.error('room counts failed', e?.message); }
    return json({ ok: true, live: true, ...(r?.ok ? { counts: r.counts, last: r.last || 0 } : {}) });
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
    for (const { sha } of this.sql.exec('SELECT sha FROM jsk').toArray()) if (!keep.has(sha)) { this.sql.exec('DELETE FROM jsk WHERE sha = ?', sha); this.jskMem.delete(sha); }
    if (this.isPages(meta)) { this.paKeep((sha) => keep.has(sha)); this.flushPa(); }
    for (const [sha, d] of this.deferred) if (!keep.has(sha)) { this.deferred.delete(sha); this.deferredBytes -= d.size; }
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
    const job = this.receive(request, sha, size, man.js.get(sha));
    this.uploading.set(sha, job);
    try { await job; } finally { if (this.uploading.get(sha) === job) this.uploading.delete(sha); }
    return noContent();
  }

  /** @param {string} [jsPath] 이 내용이 .js로도 나가면 그 경로(엔진 런타임인지 확인) */
  async receive(request, sha, size, jsPath) {
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
      if (jsPath) await this.classifyJs(this.load(), sha, first, jsPath); // .js는 1MB(= 첫 줄)까지
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

  // ── VIEW=pages: 받기 ─────────────────────────────────────────
  /**
   * 파일 하나를 받아 내용을 확인한 뒤, 여기 둘 것(HTML 원본·영상·소리)은 blob에, 나머지는 바로 Pages에 올리고 열쇠만 적어 둠.
   * 같은 내용이 확장자가 다른 이름으로 여러 번 나오면 확장자마다 열쇠가 다름(Pages 열쇠에 확장자가 들어감).
   * 큰 파일을 여럿 한꺼번에 들고 있지 않게 한 번에 하나씩(Durable Object 메모리 128MB).
   */
  async uploadPages(request, meta, man, sha, size) {
    if (!this.pagesNeed(meta, man, sha)) { request.body?.cancel().catch(() => { }); return noContent(); }
    const run = this.pagesQueue = (this.pagesQueue || Promise.resolve()).catch(() => { }).then(async () => this.takePages(meta, man, sha, size, await readAll(request, size)));
    try { await run; } catch (e) { throw await this.pagesFail(e, '파일을 Cloudflare Pages에 올리지 못했어요. 잠시 뒤 다시 배포해 주세요.'); }
    return noContent();
  }
  /** (Pages 보기) 이 내용을 더 받아야 하는지: 여기 둘 것도 없고 Pages에 올릴 확장자도 없으면 null */
  pagesNeed(meta, man, sha) {
    const paths = man.list.filter(([p, s]) => s === sha && !PAGES_SKIP.has(p)).map(([p]) => p);
    const exts = [...new Set(paths.filter((p) => !this.keepsHere(meta, p)).map(rawExt))].filter((e) => !this.passet(sha, e));
    const needBlob = paths.some((p) => this.keepsHere(meta, p)) && !this.hasBlob(sha);
    return needBlob || exts.length ? { paths, exts, needBlob } : null;
  }
  /**
   * (Pages 보기) 받은 내용 하나를 확인해 여기(blob) 또는 Pages로. pagesQueue 안에서만 부름(한 번에 하나씩: 나란히 온 요청들이 같은 남은 자리를 보고 합계를 넘기지 않게).
   * 작은 파일(DEFER_MAX 이하)은 메모리에 모아 두었다가 한 번에 올림: 자리가 모자라면 그때까지 모은 것을 먼저 올리고(flushPool), 남은 것은 공개할 때 HTML과 같이
   * @param {Uint8Array} bytes 요청 본문
   */
  async takePages(meta, man, sha, size, bytes) {
      const need = this.pagesNeed(meta, man, sha);
      if (!need) return;
      const { paths, exts, needBlob } = need;
      const defer = exts.length > 0 && size <= this.deferMax;
      if (hex(await crypto.subtle.digest('SHA-256', bytes)) !== sha) throw new HttpError('bad_request', '파일 내용이 sha256과 달라요.');
      if (defer && !this.deferred.has(sha) && this.deferredBytes + size > this.deferTotal) await this.flushPool();
      // .js: 엔진 런타임 또는 검사를 마친 사이트 스크립트(표에 적어 둠). CSS: 글자 가림 검사. 걸리면 Pages에 올리지 않음
      const jsPath = man.js.get(sha);
      const own = jsPath ? (await this.classifyJs(meta, sha, bytes, jsPath)) === 'own' : false;
      const cssPath = paths.find((p) => extOf(p) === 'css');
      if (cssPath) checkCss(new TextDecoder().decode(bytes), cssPath);
      if (!this.load()) throw new HttpError('not_found'); // 받는 사이에 사이트가 지워짐
      if (own) { this.sql.exec('INSERT OR REPLACE INTO jsk (sha, own) VALUES (?, 1)', sha); this.jskMem.set(sha, true); }
      const parts = exts.length ? base64Parts(bytes) : null;
      const items = exts.map((e) => ({ ext: e, hash: pagesHash(bytes, e, parts), parts, contentType: contentTypeOf(paths.find((p) => rawExt(p) === e)) }));
      if (needBlob && !this.hasBlob(sha)) {
        // 0번 줄을 맨 나중에(= 다 들어옴)
        this.ctx.storage.transactionSync(() => {
          for (let i = 1, o = CHUNK; o < bytes.length; i++, o += CHUNK) this.sql.exec('INSERT OR REPLACE INTO blob (sha, i, total, data) VALUES (?, ?, NULL, ?)', sha, i, bytes.slice(o, o + CHUNK));
          this.sql.exec('INSERT OR REPLACE INTO blob (sha, i, total, data) VALUES (?, 0, ?, ?)', sha, size, bytes.slice(0, CHUNK));
        });
      }
      if (defer && !this.deferred.has(sha)) { this.deferred.set(sha, { size, items }); this.deferredBytes += size; }
      else if (defer) { const d = this.deferred.get(sha); for (const x of items) if (!d.items.some((y) => y.ext === x.ext)) d.items.push(x); }
      bytes = null; // 아래에서 Pages에 올리는 동안 원본을 붙들지 않음(큰 파일 하나가 원본 + base64 + 보내는 본문으로 메모리를 세 번 쓰지 않게)
      if (exts.length && !defer) {
        const pc = this.pc();
        const missing = new Set(await pc.checkMissing(items.map((x) => x.hash)));
        const up = items.filter((x) => missing.has(x.hash));
        if (up.length) {
          await pc.upload(up);
          // 올린 열쇠를 등록(upsert-hashes): Pages는 등록한 열쇠만 '있다'고 답함. 올리기만 하면 공개할 때 check-missing이 다시 '없음'이라 해서
          // 큰 파일(512KB 넘는 쪽 그림·사진·글꼴·교재 원본)이 든 사이트는 배포가 끝나지 않았음(2026-11-23 실제 서버에서 확인). 순간 오류면 PagesClient가 한 번 더 하고(twice), 그래도 안 되면 이 파일 받기를 실패로
          await pc.upsertHashes(up.map((x) => x.hash));
        }
        for (const x of items) this.paSet(sha, x.ext, x.hash, size);
        this.flushPa();
      }
  }
  /**
   * (Pages 보기) 메모리에 모아 둔 작은 파일을 Pages에 한 번에 올리고 열쇠를 적음(확인·올리기·열쇠 적기 3번). pagesQueue 안에서만 부름.
   * 실패하면 모아 둔 것은 그대로 둠(이번 요청만 실패 → 앱이 다시 보냄. 이미 모은 파일은 다시 받지 않음)
   */
  async flushPool() {
    const all = [...this.deferred].flatMap(([sha, d]) => d.items.map((x) => ({ sha, size: d.size, x })));
    if (!all.length) return;
    const pc = this.pc();
    const missing = new Set(await pc.checkMissing([...new Set(all.map((a) => a.x.hash))]));
    const seen = new Set(); const up = [];
    for (const a of all) if (missing.has(a.x.hash) && !seen.has(a.x.hash)) { seen.add(a.x.hash); up.push(a.x); }
    if (up.length) { await pc.upload(up); await pc.upsertHashes(up.map((x) => x.hash)); }
    if (!this.load()) throw new HttpError('not_found'); // 올리는 사이에 사이트가 지워짐
    for (const a of all) this.paSet(a.sha, a.x.ext, a.x.hash, a.size);
    this.flushPa();
    for (const a of all) { const d = this.deferred.get(a.sha); if (d) { this.deferred.delete(a.sha); this.deferredBytes -= d.size; } }
  }
  /**
   * PUT blobs(작은 파일 여럿을 요청 하나에): 본문 = [머리 길이 4바이트(큰 끝)] [머리 JSON: [[sha256, 크기], …]] [내용을 그 순서대로 이어 붙임].
   * 파일마다 하는 일은 파일 하나를 받을 때(upload)와 같음: 목록에 있는지·크기·sha256·스크립트와 CSS 검사. 이미 받은 파일은 건너뜀.
   * 한 파일의 내용 문제(sha256이 다름·받을 수 없는 내용)는 그 파일만 failed로 돌려주고 나머지는 받음 → 앱이 그 파일을 하나씩 다시 보내면 그때 까닭이 그대로 나감.
   * 요청 전체의 문제(묶음 모양이 틀림·사이트가 지워짐·Cloudflare 오류)는 오류 응답: 앞에서 받은 파일은 받은 채로라 다시 배포하면 이어짐
   * @returns 200 { ok: true, got: 받은 수, failed: [{ sha256, code, message_ko }] }
   */
  async uploadBundle(request) {
    const meta = await this.authed(request);
    if (meta.blocked) throw new HttpError('blocked');
    const limit = this.cfg.bundleBytes; const item = Math.min(this.cfg.bundleItemBytes, limit, this.cfg.maxFileBytes);
    if (!limit) throw new HttpError('not_found', '없는 주소예요.');
    const man = meta.pending ? this.manifest(meta.pending) : null;
    if (!man) throw new HttpError('bad_request', '배포 목록에 없는 파일이에요. 목록(deploys)을 먼저 보내 주세요.');
    const max = limit + BUNDLE_HEAD_MAX + 4;
    const declared = request.headers.get('content-length');
    if (declared !== null && Number(declared) > max) throw new HttpError('too_large', '묶음이 너무 커요.');
    const bad = (why = '묶음 모양이 맞지 않아요.') => new HttpError('bad_request', why);
    const failed = []; let got = 0;
    const work = async () => {
      const body = await readUpTo(request, max);
      if (body.length < 4) throw bad();
      const n = new DataView(body.buffer, body.byteOffset, 4).getUint32(0);
      if (n < 2 || n > BUNDLE_HEAD_MAX || 4 + n > body.length) throw bad();
      let list;
      try { list = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body.subarray(4, 4 + n))); } catch { throw bad(); }
      if (!Array.isArray(list) || !list.length || list.length > BUNDLE_FILES) throw bad();
      let total = 0; const seen = new Set();
      for (const it of list) {
        if (!Array.isArray(it) || typeof it[0] !== 'string' || !SHA256_RE.test(it[0]) || !Number.isSafeInteger(it[1]) || it[1] < 0 || it[1] > item || seen.has(it[0])) throw bad();
        seen.add(it[0]); total += it[1];
      }
      if (total > limit) throw new HttpError('too_large', '묶음이 너무 커요.');
      if (4 + n + total !== body.length) throw bad('묶음에 적은 크기와 내용의 길이가 달라요.');
      let o = 4 + n;
      for (const [sha, size] of list) {
        const bytes = body.subarray(o, o + size); o += size;
        try {
          if (man.shas.get(sha) !== size) throw new HttpError('bad_request', man.shas.has(sha) ? '목록에 적은 크기와 달라요.' : '배포 목록에 없는 파일이에요. 목록(deploys)을 먼저 보내 주세요.');
          if (this.isPages(meta)) await this.takePages(meta, man, sha, size, bytes);
          else if (!this.hasBlob(sha)) await this.receive({ body: new Blob([bytes]).stream() }, sha, size, man.js.get(sha));
          got++;
        } catch (e) {
          if (!(e instanceof HttpError) || !BUNDLE_FILE_ERRORS.has(e.code) || e.status >= 500 || e.status === 409) throw e;
          failed.push({ sha256: sha, code: e.code, message_ko: e.message });
        }
      }
    };
    // Pages 보기는 다른 올리기와 같은 줄에서(한 번에 하나씩: 메모리에 모으는 합계를 함께 봄), Worker 보기는 바로
    const pages = this.isPages(meta);
    const run = pages ? (this.pagesQueue = (this.pagesQueue || Promise.resolve()).catch(() => { }).then(work)) : work();
    try { await run; } catch (e) { throw pages ? await this.pagesFail(e, '파일을 Cloudflare Pages에 올리지 못했어요. 잠시 뒤 다시 배포해 주세요.') : e; }
    return json({ ok: true, got, failed });
  }

  // ── 공개 ─────────────────────────────────────────────────────
  async publish(request, deployId) {
    await this.authed(request);
    return this.exclusive(async () => {
      const meta = this.load();
      if (!this.alive(meta)) throw new HttpError('not_found');
      if (meta.blocked) throw new HttpError('blocked');
      // 이미 공개한 배포를 다시 부르면(응답을 못 받은 경우) 같은 답
      if (deployId && deployId === meta.current && deployId !== meta.pending) return json(this.published(request, meta));
      const man = DEPLOY_RE.test(deployId) && deployId === meta.pending ? this.manifest(deployId) : null;
      if (!man) throw new HttpError('not_found', '없는 배포예요. 목록(deploys)부터 다시 보내 주세요.');
      const missing = this.missingFor(meta, man.list);
      if (missing.length) throw new HttpError('missing_blobs', undefined, { missing });
      if (this.isPages(meta)) return this.publishPages(request, meta, deployId, man);
      // 실행 파일은 여기서 한 번 더 확인(다른 이름으로 올려 둔 내용을 .js로 돌려 쓰는 길을 막음). HTML·CSS 검사도 여기서
      for (const [sha, path] of man.js) {
        if (this.jsOk.has(sha)) continue;
        const row = this.sql.exec('SELECT data FROM blob WHERE sha = ? AND i = 0', sha).toArray()[0];
        if (!row) throw new HttpError('missing_blobs', undefined, { missing: [sha] });
        await this.classifyJs(meta, sha, new Uint8Array(row.data), path);
      }
      this.checkSite(meta, man);
      if (this.load()?.pending !== deployId) throw new HttpError('not_found', '없는 배포예요. 목록(deploys)부터 다시 보내 주세요.');
      const now = Date.now(); const expires = expiryFrom(now, this.cfg.days); const prev = meta.current;
      this.ctx.storage.transactionSync(() => {
        this.sql.exec('UPDATE meta SET current = ?, pending = NULL, bytes = ?, expires = ? WHERE id = 1', deployId, man.stored, expires);
        if (prev && prev !== deployId) this.sql.exec('DELETE FROM deploy WHERE id = ?', prev);
      });
      Object.assign(meta, { current: deployId, pending: null, bytes: man.stored, expires });
      if (prev && prev !== deployId) this.manifests.delete(prev);
      await this.alarmSet(expires);
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
    this.checkSite(meta, man); // HTML 검사(걸리면 Pages에 아무것도 올리지 않음)
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
      if (!deferred.has(d.hash)) { deferred.set(d.hash, { sha, ext: d.ext, size: this.deferred.get(sha).size }); extra.push(d); }
    }
    if (lostHere.size) throw new HttpError('missing_blobs', undefined, { missing: [...lostHere] });
    const te = new TextEncoder();
    add('robots.txt', te.encode(ROBOTS));
    if (!man.files.has('404.html')) add('404.html', te.encode(noFileHtml()));
    const headers = headersFile(paths, { csp: this.cspCtx(meta, deployId, man, self), fontsHashed: fontsHashed(man.list) });
    const redirects = redirectsFile(media, `${self}/s/${id}/`);
    const pc = this.pc();
    // 우리가 id를 모르는 배포가 Cloudflare에 생길 수 있는 때를 적어 둠 → 내릴 때 그 주소를 안내 화면으로 꼭 덮음(wipePages).
    //  trying: 배포를 만드는 중(이 객체가 도중에 내려가면 남음 → 다음 공개 때 orphan으로). orphan: 배포 만들기가 답 없이 끊겼거나 5xx(생겼을 수 있음)
    //  둘 다 그때의 시각(예전 판은 1). 모르는 배포는 strays가 목록에서 찾아 정리함(tidyOrphan·wipePages)
    const mark = (fn) => { const s0 = this.ps(meta); const before = JSON.stringify([s0.trying, s0.orphan]); fn(s0); if (JSON.stringify([s0.trying, s0.orphan]) !== before) this.savePs(meta, s0); };
    mark((s0) => { if (s0.trying) s0.orphan = Math.max(+s0.orphan || 0, +s0.trying || 1); s0.trying = Date.now(); });
    let deployment; let lost;
    try { ({ deployment, lost } = await deploySite(pc, { branch: branchOf(id), manifest, extra, headers, redirects, message: `lecpage ${id}` })); }
    catch (e) {
      const maybe = e?.step === 'deployments' && !(e.status >= 400 && e.status < 500);
      mark((s0) => { delete s0.trying; if (maybe) s0.orphan = Date.now(); });
      // 다시 배포하지 않아도 조금 뒤 알람이 그 배포를 찾아 적어 둠(tidyOrphan)
      if (maybe) { try { await this.alarmSet(this.alarmAt(meta)); } catch (e2) { console.error('orphan alarm failed', e2?.message); } }
      throw await this.pagesFail(e, 'Cloudflare Pages에 배포하지 못했어요. 잠시 뒤 다시 해 주세요.');
    }
    if (lost.length) {
      mark((s0) => { delete s0.trying; }); // 배포를 만들기 전에 멈춤
      // Pages에서 사라진 파일(올린 뒤 오래 배포하지 않은 것): 기록을 지우고 다시 받음
      const lostSet = new Set(lost); const again = new Set();
      this.paKeep((sha, ext, phash) => { if (!lostSet.has(phash)) return true; again.add(sha); return false; });
      this.flushPa();
      throw new HttpError('missing_blobs', undefined, { missing: [...again] });
    }
    if (this.load()?.pending !== deployId) throw new HttpError('not_found', '없는 배포예요. 목록(deploys)부터 다시 보내 주세요.');
    const now = Date.now(); const expires = expiryFrom(now, this.cfg.days); const prev = meta.current;
    const st = this.ps(meta);
    const old = [...st.deps, ...st.hold];
    // 예전 배포에만 있던 경로도 적어 둠: 지우거나 가릴 때 안내 화면이 그 주소까지 덮게(Pages가 남겨 둔 예전 파일이 나오지 않게, placeholder)
    st.past = [...new Set([...(st.past || []), ...Object.keys(st.man?.manifest || {})])].filter((x) => !(x in manifest)).slice(-PAST_PATHS);
    for (let room = PAST_CHARS, i = st.past.length - 1; i >= 0; i--) { room -= st.past[i].length; if (room < 0) { st.past = st.past.slice(i + 1); break; } }
    st.url = url; st.self = self; st.deps = [deployment.id]; st.hold = []; st.man = { manifest, headers, redirects }; delete st.trying;
    st.depAt = Date.parse(deployment.created_on) || 0; // 이 배포가 생긴 때(Cloudflare가 적은 값. 모르는 배포가 이보다 먼저인지 나중인지 가림)
    const kept = this.keptBytes(meta, man.list);
    // 같이 올린 작은 파일: 이제 Pages에 있으니 열쇠를 적고 메모리에서 뺌
    for (const [hash, x] of deferred) this.paSet(x.sha, x.ext, hash, x.size);
    this.paReady();
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('UPDATE meta SET current = ?, pending = NULL, bytes = ?, expires = ? WHERE id = 1', deployId, kept, expires);
      if (prev && prev !== deployId) this.sql.exec('DELETE FROM deploy WHERE id = ?', prev);
      this.savePs(meta, st);
      this.writePa();
    });
    for (const x of deferred.values()) { const d = this.deferred.get(x.sha); if (d) { this.deferred.delete(x.sha); this.deferredBytes -= d.size; } }
    Object.assign(meta, { current: deployId, pending: null, bytes: kept, expires });
    if (prev && prev !== deployId) this.manifests.delete(prev);
    await this.alarmSet(this.alarmAt(meta));
    this.sweep();
    // 지난 배포(각자 고유 주소가 있음)는 지움. 못 지운 것은 다음 공개·지우기 때 다시
    const left = await this.dropDeployments(old.filter((d) => d !== deployment.id));
    if (left.length) { const s2 = this.ps(meta); s2.hold = left; this.savePs(meta, s2); }
    // 답이 끊긴 '배포 만들기'가 남긴 배포(우리가 id를 모름)가 있을 수 있으면 지금 찾아 지움(공개 응답은 기다리지 않음. 방금 생긴 것이라 목록 앞쪽에 있음)
    if (this.ps(meta).orphan) this.ctx.waitUntil(this.exclusive(() => this.tidyOrphan()).catch((e) => console.error('orphan tidy failed', e?.message)));
    let g = null;
    try { g = await this.gate('POST', 'site', { id, bytes: kept, expires, published: true, pagesRoot: 'ask', ...this.pagesDelta() }); } catch (e) { console.error('gate site update failed', e?.message); }
    if (g?.pagesRoot) this.ctx.waitUntil(this.pagesRoot()); // 공개 응답은 기다리지 않음
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
    // step: 어느 호출에서 막혔는지(운영자가 원인을 볼 때. 사람이 읽는 글에는 넣지 않음)
    // reason은 넣지 않음: 앱은 reason이 있으면 '붐빔'으로 보고 내 계정 배포로 넘김. 이것은 잠깐의 실패라 [다시 배포]로 이어져야 함
    return new HttpError('bad_request', message, { status: 502, step: String(e.step) });
  }
  /** 배포들을 지움(별칭이 걸린 것도). 못 지운 id를 돌려줌 */
  async dropDeployments(ids) {
    const left = [];
    for (const d of ids) { try { await this.pc().deleteDeployment(d, true); } catch (e) { if (e?.status !== 404) { left.push(d); console.error('pages delete failed', e?.step, e?.status, e?.code); } } }
    return left;
  }
  get settleMs() { return this.cfg.pagesCfg?.settleMs || ORPHAN_SETTLE_MS; }
  /** 모르는 배포가 생겼을 수 있는 때(없으면 0). 예전 판이 적은 표시(1)는 '언제인지 모름'(1) */
  orphanAt(st) { return Math.max(+st.orphan || 0, +st.trying || 0); }
  /** 다음 알람: 보관 기간 끝. 모르는 배포를 아직 정리하지 못했으면 그보다 먼저 한 번(생길 수 있는 시간이 지난 직후, tidyOrphan) */
  alarmAt(meta) {
    const st = this.ps(meta); const at = +st.orphan || 0;
    return at > 1 && st.tidied !== at ? Math.min(meta.expires, at + this.settleMs + 1000) : meta.expires;
  }
  /**
   * 이 사이트 브랜치에 있는, 우리가 id를 모르는 배포를 찾음(답이 끊긴 '배포 만들기'가 남긴 것). known: 아는 배포 id, since: 생겼을 수 있는 때.
   * 배포 목록(최근에 만든 것부터)을 STRAY_PAGES쪽까지 봄. 돌려줌: { found: [{ id, at(생긴 때, 모르면 0) }], scanned: since보다 앞선 데까지(또는 끝까지) 봤는지 }.
   * 목록을 못 받으면 던짐(PagesError)
   */
  async strays(meta, known, since) {
    const branch = branchOf(meta.site); const skip = new Set((known || []).filter(Boolean)); const found = [];
    const mine = (d) => d?.deployment_trigger?.metadata?.branch === branch;
    for (let page = 1; page <= STRAY_PAGES; page++) {
      const list = await this.pc().listDeployments(page);
      if (!Array.isArray(list) || !list.length) return { found, scanned: true };
      let oldest = Infinity;
      for (const d of list) {
        const at = Date.parse(d?.created_on) || 0;
        if (at && at < oldest) oldest = at;
        if (d?.id && !skip.has(d.id) && mine(d)) { skip.add(d.id); found.push({ id: String(d.id), at }); }
      }
      // 최근 것부터 나오므로 이 쪽에서 가장 오래된 것이 since보다 앞서면 더 볼 것이 없음(since를 모르면 STRAY_PAGES쪽까지만 봄)
      if (since > 1 && oldest < since - this.settleMs - STRAY_SKEW_MS) return { found, scanned: true };
    }
    return { found, scanned: false };
  }
  /**
   * 공개해 둔(또는 공개하다 만) 사이트에서 모르는 배포를 정리. 다음 공개 직후와, 생길 수 있는 시간이 지난 뒤 알람에서 한 번 부름(내릴 때는 wipePages가 함).
   * 지금 배포보다 먼저 생긴 것은 지움(그 배포의 고유 주소에 내용이 남지 않게). 나중에 생긴 것은 브랜치 주소가 거기 붙어 있을 수 있어 지금은 지우지 않고
   * id만 적어 둠(hold → 다음 공개·내릴 때 지움). 생길 수 있는 시간이 지났고 그때까지의 목록을 다 봤으면 표시(orphan)를 지움.
   * 다 못 봤으면 표시를 남김 → 내릴 때 안내 화면으로 꼭 덮음
   */
  async tidyOrphan() {
    const meta = this.load();
    if (!meta || this.wiping(meta) || !this.isPages(meta) || !this.cfg.pagesCfg) return;
    const st = this.ps(meta); const at = +st.orphan || 0;
    if (at <= 1) return; // 언제인지 모르는 예전 표시: 목록에서 찾을 길이 없음(내릴 때 안내 화면으로 덮음)
    const settled = Date.now() >= at + this.settleMs;
    let r = null;
    try { r = await this.strays(meta, [...st.deps, ...st.hold, st.gone], at); } catch (e) { console.error('pages stray list failed', e?.step, e?.status, e?.code); }
    const cur = st.deps.length ? +st.depAt || 0 : 0; // 둘 다 Cloudflare가 적은 created_on이라 그대로 견줌. 모르면 '먼저'로 보지 않음
    const older = r ? r.found.filter((d) => cur && d.at && d.at < cur) : [];
    const left = older.length ? await this.dropDeployments(older.map((d) => d.id)) : [];
    const gone = new Set(older.map((d) => d.id).filter((d) => !left.includes(d)));
    const s2 = this.ps(meta);
    if (r) s2.hold = [...new Set([...s2.hold, ...r.found.map((d) => d.id).filter((d) => !gone.has(d))])];
    if (settled) { if (r?.scanned) delete s2.orphan; else s2.tidied = at; } // 다 못 봤으면 알람으로 다시 하지 않음(표시는 남김)
    this.savePs(meta, s2);
    try { await this.gate('POST', 'site', { id: meta.site, ...this.pagesDelta() }); } catch { /* 다음 알림 때 */ }
  }
  /**
   * 브랜치에 안내 화면 하나만 배포(가림·지움). 배포 id.
   * 사이트에 있던 경로(지금·예전 배포)를 모두 안내 화면으로 채움: Pages는 지금 배포에 없는 경로를 예전에 내보낸 파일로 답해 줌
   * (데이터센터마다 최대 7일, 'asset preservation'). 경로가 있으면 그 파일(안내 화면)을 내보내므로 지운 사이트의 그림·스크립트가 나오지 않음
   */
  async placeholder(meta, html) {
    const st = this.ps(meta);
    const paths = [...Object.keys(st.man?.manifest || {}), ...(st.past || [])];
    const { deployment } = await this.pagesCall(() => this.noticeDeploy(branchOf(meta.site), html, 'lecpage notice', paths));
    // 이 안내 화면이 생긴 때(Cloudflare가 적은 값. 못 읽으면 조금 앞당겨 잡아, 비슷한 때 생긴 모르는 배포를 '나중'으로 봄)
    this.noticeAt = Date.parse(deployment.created_on) || Date.now() - STRAY_SKEW_MS;
    return deployment.id;
  }
  /** 안내 화면 한 장(index.html = 404.html)만 있는 배포. paths: 같은 안내 화면으로 채울 경로('/…') */
  noticeDeploy(branch, html, message, paths = []) {
    const bytes = new TextEncoder().encode(html); const parts = base64Parts(bytes); const hash = pagesHash(bytes, 'html', parts);
    const manifest = Object.fromEntries([...paths, '/index.html', '/404.html'].map((x) => [x, hash]));
    return deploySite(this.pc(), { branch, manifest, extra: [{ hash, parts, contentType: contentTypeOf('index.html') }], headers: NOTICE_HEADERS, message });
  }
  /**
   * Pages 프로젝트의 첫 주소(…pages.dev 뿌리)에 본 배포(production)가 없으면 '보관 기간이 끝났어요' 안내 화면을 올림.
   * 설정 스크립트(npm run setup)가 올리지만 프록시가 Authorization 머리글을 바꾸는 환경에서는 못 올림 → 처음 공개할 때 한 번(Gate가 한 Site에만 맡김)
   */
  async pagesRoot() {
    let result = 'failed';
    try {
      const pr = await this.pc().getProject();
      if (pr?.canonical_deployment) result = 'had';
      else { await this.noticeDeploy(pr?.production_branch || 'main', goneHtml(this.cfg.publicOrigin ? `${this.cfg.publicOrigin}/` : ''), 'lecpage 안내 화면'); result = 'made'; }
    } catch (e) { console.error('pages root notice failed', e?.step, e?.status, e?.code); }
    try { await this.gate('POST', 'site', { id: '', pagesRoot: result, ...this.pagesDelta() }); } catch (e) { console.error('gate pages-root update failed', e?.message); }
    return result;
  }

  // ── 지우기·가리기 ────────────────────────────────────────────
  /**
   * 지우기(강사 [지금 내리기]·관리 화면). 다 지웠으면 204, Pages 배포가 남아 '지우는 중'이 되면 202 { state: 'wiping' }(서버가 알람으로 다시 함).
   * 지우는 중인 사이트를 다시 지우라고 하면 바로 한 번 더 해 봄
   */
  async remove(request, admin) {
    if (admin) { if (!this.load()) throw new HttpError('not_found'); } else await this.authed(request, { wiping: true });
    return this.exclusive(async () => {
      const meta = this.load();
      if (!meta) return noContent();
      const w = this.wiping(meta);
      // 강사가 내리면 보관 기간이 남은 동안 그 주소에 '강사가 사이트를 내렸어요'(운영자 지움·보관 기간 끝과 나눔)
      const why = admin ? '' : w ? w.why || '' : 'removed';
      return (await this.wipeAndMark(meta, w ? w.expired : false, why)) ? noContent() : json({ ok: true, state: 'wiping', message_ko: WIPING_MSG }, 202);
    });
  }
  /** 지우고, 강사가 내린 사이트면 다 지운 뒤 내린 표시를 남김. 다 지웠으면 true(지우는 중이면 false — 알람이 다시 하며 끝나면 표시를 남김) */
  async wipeAndMark(meta, expired, why) {
    const until = meta.expires;
    const done = await this.wipe(expired, why);
    if (done && why === 'removed' && until > Date.now()) await this.markRemoved(until);
    return done;
  }
  /** 내린 표시(작은 표 하나). meta 표가 없으니 load()는 그대로 null(없는 사이트) */
  async markRemoved(until) {
    this.sql.exec('CREATE TABLE IF NOT EXISTS gone (id INTEGER PRIMARY KEY, why TEXT NOT NULL, until INTEGER NOT NULL)');
    this.sql.exec("INSERT OR REPLACE INTO gone (id, why, until) VALUES (1, 'removed', ?)", until);
    this.goneMark = { why: 'removed', until };
    await this.alarmSet(until);
  }
  /** 없는 사이트의 까닭: 'removed'(강사가 내림, 보관 기간 안) 또는 ''(보관 기간 끝·없는 주소) */
  goneWhy() {
    if (this.goneMark === undefined) {
      const has = this.sql.exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'gone'").toArray().length;
      this.goneMark = (has && this.sql.exec('SELECT why, until FROM gone WHERE id = 1').toArray()[0]) || null;
    }
    return this.goneMark && this.goneMark.until > Date.now() ? this.goneMark.why : '';
  }
  /**
   * 사이트를 지움: 실시간 방 → (Pages 보기) Pages 배포 → 여기 기록 → Gate 목록. expired: 보관 기간이 끝나 지움, why 'removed': 강사가 내림
   * (둘 다 Pages 주소에 그 안내 화면을 남김). Pages 배포를 다 지우지 못하면 여기 파일은 지우고 '지우는 중'으로 남겨 알람으로 다시 함(holdWipe). 다 지웠으면 true
   */
  async wipe(expired = false, why = '') {
    const meta = this.load();
    if (!meta) return true;
    const id = meta.site;
    // 묶인 실시간 방(참가 기록·보드 파일)도 같이 지움. 실패해도 방이 기간 끝에 사이트를 확인하고 스스로 비움
    if (meta.live_code) { try { await this.room(meta.live_code, 'wipe', { site: id }); } catch (e) { console.error('room wipe failed', e?.message); } }
    if (this.isPages(meta) && !(await this.wipePages(meta, expired, why))) { await this.holdWipe(meta, expired, why); return false; }
    await this.ctx.storage.deleteAlarm();
    await this.dropAll();
    this.meta = null; this.manifests.clear(); this.jsOk.clear(); this.jskMem.clear(); this.liveMem.clear(); this.deployTimes = []; this.deferred.clear(); this.deferredBytes = 0;
    if (id) { try { await this.gate('POST', 'forget', { id, ...this.pagesDelta() }); } catch (e) { console.error('gate forget failed', e?.message); } }
    return true;
  }
  /**
   * Pages에 있는 이 사이트의 배포를 모두 지움. 보관 기간이 끝났거나(expired) 강사가 내렸거나(why 'removed') 가장 최근 배포를 못 지우면(별칭)
   * 안내 화면('보관 기간이 끝났어요' / '강사가 사이트를 내렸어요') 하나를 그 브랜치에 올린 뒤 나머지를 지움(배포가 하나도 없으면 그 주소가 Cloudflare 영어 404가 됨).
   * 안내 화면은 남겨 둠(st.gone). 사이트 내용이 든 배포가 하나도 남지 않으면 true. 남으면 그 id를 적어 두고 false(다음에 그것만 다시)
   */
  async wipePages(meta, expired = false, why = '') {
    if (!this.cfg.pagesCfg) { console.error('pages wipe: no PAGES config', meta.site); return false; }
    const st = this.ps(meta);
    const removed = why === 'removed';
    let gone = st.gone || '';
    // orphan: 만들었는지 모르는 배포가 있을 수 있음(publishPages). 우리가 아는 배포를 다 지우면 그 주소가 그 배포로 돌아갈 수 있으니 안내 화면을 꼭 올려 덮음
    const at = this.orphanAt(st); const orphan = at > 0;
    const html = removed ? removedHtml() : goneHtml();
    const all = [...st.deps, ...st.hold].filter((d) => d && d !== gone);
    let left = (expired || removed || orphan) && !gone ? all : await this.dropDeployments(all);
    if ((left.length || orphan) && !gone) { try { gone = await this.placeholder(meta, html); st.goneAt = this.noticeAt; } catch (e) { console.error('pages wipe placeholder failed', e?.message); } }
    if (left.length) left = await this.dropDeployments(left);
    // 모르는 배포를 목록에서 찾아 지움: 안내 화면이 브랜치 주소를 덮어도 그 배포의 고유 주소(<해시>.…pages.dev)에는 내용이 남아 있으므로.
    // 안내 화면이 올라가 있을 때만(그 브랜치의 가장 최근 배포를 지워도 주소가 비지 않게)
    let wait = false;
    if (orphan && gone) {
      const settle = this.settleMs;
      const fresh = at > 1 && Date.now() < at + settle; // 늦게 끝난 '배포 만들기'가 아직 더 생길 수 있음
      let r = null;
      try { r = await this.strays(meta, [gone], at); } catch (e) { console.error('pages stray list failed', e?.step, e?.status, e?.code); }
      if (r?.found.length) {
        // 안내 화면보다 나중에 생긴 배포는 브랜치 주소를 가져갔을 수 있음(Pages는 브랜치 주소를 가장 최근 배포에 붙임) → 지운 뒤 안내 화면을 다시 올림
        if (r.found.some((d) => !d.at || d.at >= (+st.goneAt || 0))) st.late = 1;
        left = [...left, ...(await this.dropDeployments(r.found.map((d) => d.id)))];
      }
      // 목록을 못 받았고 안내 화면을 '더 생길 수 있는 동안'에 올렸으면: 그 뒤에 생긴 배포가 있었을 수 있으니 한 번 다시 올림
      if (!r && !fresh && at > 1 && (+st.goneAt || 0) < at + settle + STRAY_SKEW_MS) st.late = 1;
      if (st.late && !left.length) {
        try {
          const again = await this.placeholder(meta, html); const old = gone;
          gone = again; st.goneAt = this.noticeAt; delete st.late;
          left = await this.dropDeployments([old]);
        } catch (e) { console.error('pages wipe placeholder (again) failed', e?.message); }
      }
      if (!fresh) st.strayN = (st.strayN || 0) + 1;
      // 더 생길 수 있는 동안은 기다렸다가 한 번 더 확인(holdWipe의 알람). 그 뒤에도 목록을 못 받았거나 안내 화면을 다시 못 올렸으면 STRAY_TRIES번까지만 다시 함
      // (그 뒤로는 끝냄: 브랜치 주소는 안내 화면으로 덮여 있음). 언제인지 모르는 예전 표시(1)는 기다리지 않음
      wait = at > 1 && (fresh || ((!r || !!st.late) && st.strayN < STRAY_TRIES));
    }
    st.deps = []; st.hold = left; st.gone = gone; this.savePs(meta, st);
    if (left.length) console.error('pages deployments left', meta.site, left.length);
    return !left.length && !(orphan && !gone) && !wait;
  }
  /**
   * 지우는 중으로 둠: 여기 파일·배포 목록은 지금 지우고(저장량 0, 두 번째 주소는 404, 고치기·방은 닫힘) 사이트 줄과 남은 Pages 배포 id만 남김.
   * 알람으로 다시(WIPE_RETRY_MS). 처음 한 번 Gate에 알려 관리 화면에 '지우는 중'으로 보이게 함
   */
  async holdWipe(meta, expired, why = '') {
    const now = Date.now();
    const st = this.ps(meta);
    const w = { at: now, n: 0, ...(st.wiping || {}) };
    w.n += 1; w.expired = !!(w.expired || expired); w.last = now; if (why) w.why = why;
    st.wiping = w;
    const pa = this.pa(); // 예전 줄(passet)·묶음(ppack) 가운데 있는 표만 비움(예전 줄은 표째로: dropLegacy)
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM blob'); this.sql.exec('DELETE FROM deploy'); this.sql.exec('DELETE FROM jsk');
      if (this.paLegacy) this.dropLegacy();
      if (this.paTable) this.sql.exec('DELETE FROM ppack');
      pa.clear(); this.paLegacy = 0; this.paChunks = 0; this.paDirty = false;
      this.sql.exec('UPDATE meta SET current = NULL, pending = NULL, bytes = 0, live_code = NULL WHERE id = 1');
      this.savePs(meta, st);
    });
    Object.assign(meta, { current: null, pending: null, bytes: 0, live_code: null });
    this.manifests.clear(); this.jsOk.clear(); this.jskMem.clear(); this.liveMem.clear(); this.deferred.clear(); this.deferredBytes = 0;
    await this.alarmSet(now + WIPE_RETRY_MS[Math.min(w.n, WIPE_RETRY_MS.length) - 1]);
    if (w.n === 1) { try { await this.gate('POST', 'site', { id: meta.site, bytes: 0, wiping: w.at, ...this.pagesDelta() }); } catch (e) { console.error('gate wiping update failed', e?.message); } }
  }
  /** Gate 하루 점검이 부름: 기간이 지났으면(또는 지우는 중이면) 지금 지움. 사이트가 없어졌는지 돌려줌 */
  async expireCheck() {
    return this.exclusive(async () => {
      const meta = this.load();
      if (!meta) return json({ gone: true });
      const w = this.wiping(meta);
      if (w || Date.now() >= meta.expires) await this.wipeAndMark(meta, w ? w.expired : true, w ? w.why || '' : '');
      else await this.alarmSet(Math.max(this.alarmAt(meta), Date.now() + 1000));
      return json({ gone: !this.load() });
    });
  }
  async block(request) {
    const body = await readJson(request, 8192);
    if (typeof body.blocked !== 'boolean') throw new HttpError('bad_request', 'blocked에 true나 false를 넣어 주세요.');
    return this.exclusive(async () => {
      const meta = this.load();
      if (!meta) throw new HttpError('not_found');
      if (this.wiping(meta)) throw new HttpError('bad_request', '지우는 중인 사이트예요. 다 지우면 목록에서 사라져요.', { status: 409 });
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
      await this.alarmSet(expires);
      try { await this.gate('POST', 'site', { id: meta.site, expires }); } catch (e) { console.error('gate site update failed', e?.message); }
      if (meta.live_code) { try { await this.room(meta.live_code, 'touch', { site: meta.site, expires }); } catch (e) { console.error('room touch failed', e?.message); } }
    })());
  }

  /**
   * 보관 기간이 끝나면 전부 지움. 지우는 중이면 다시 해 봄.
   * 실패하면 1시간 뒤로 스스로 다시 잡음: 공식 재시도는 2초부터 6번(몇 분)뿐이라, 무료 하루 한도가 찬 시간에 걸리면 다 실패하고 다시 오지 않음
   * (그래도 놓치면 Gate 하루 점검이 기간 지난 사이트를 다시 지우라고 함)
   */
  async alarm() {
    try {
      const meta = this.load();
      if (!meta) { // 내린 표시는 보관 기간이 끝나면 지움(그 뒤로는 '보관 기간이 끝났어요')
        if (this.goneWhy()) await this.alarmSet(this.goneMark.until);
        else { await this.dropAll(); this.goneMark = undefined; }
        return;
      }
      const w = this.wiping(meta);
      if (w || Date.now() >= meta.expires) await this.exclusive(() => this.wipeAndMark(meta, w ? w.expired : true, w ? w.why || '' : ''));
      else {
        // 보관 기간 전에 울린 알람: 답이 끊긴 '배포 만들기'가 남긴 배포를 정리할 때(alarmAt)
        const st = this.ps(meta); const at = +st.orphan || 0;
        if (at > 1 && st.tidied !== at && Date.now() >= at + this.settleMs) await this.exclusive(() => this.tidyOrphan());
        const m2 = this.load();
        if (m2 && !this.wiping(m2)) { const next = this.alarmAt(m2); await this.alarmSet(next > Date.now() ? next : m2.expires); } // 정리를 못 했어도 알람이 바로 다시 울리지 않게
      }
    } catch (e) {
      console.error('site alarm failed', e?.message);
      await this.alarmSet(Date.now() + HOUR_MS);
    }
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
    if (!this.alive(meta) || Date.now() >= meta.expires) {
      // Worker가 짧게 기억해 같은 없는 주소로 이 객체를 다시 깨우지 않게 함(밖으로는 내보내지 않음)
      const removed = !meta && this.goneWhy() === 'removed';
      const r = removed ? removedPage(head) : gonePage(head); r.headers.set('x-lp-state', removed ? 'removed' : 'gone'); return r;
    }
    if (meta.blocked) return blockedPage(meta.site, head);
    const man = meta.current ? this.manifest(meta.current) : null;
    const path = requestPath(url.searchParams.get('p'));
    if (!man) return notFoundPage(head);
    // Pages 보기: 영상·소리만 여기서, 나머지는 Worker가 Pages에서 가져와 내보냄(학교망에서 pages.dev가 막혔을 때 쓰는 이 호스트 주소).
    // 이 주소는 모든 사이트가 같이 쓰는 출처라 사이트가 직접 쓴 스크립트는 내보내지 않음(엔진 런타임만). 못 쓰는 경로·목록에 없는 .js는 Pages에 묻지 않음
    if (this.isPages(meta) && !(path && isMedia(path) && man.files.has(path))) {
      if (!path) return noFilePage(head);
      if (typeOf(path)?.kind === 'js') { const f = man.files.get(path); if (!f || this.isOwnJs(f[0])) return noFilePage(head); }
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
    const origin = request.headers.get('x-lp-origin') || '';
    const csp = type.kind === 'html' ? this.cspCtx(meta, meta.current, man, origin) : undefined;
    const headers = fileHeaders(name, type, sha, { tag, immutable: status === 200 && ((v.length >= 8 && sha.startsWith(v)) || fontHashed(name, sha)), csp });
    if (status === 200 && etagMatches(request.headers.get('if-none-match'), headers.etag)) {
      delete headers['content-type'];
      return new Response(null, { status: 304, headers });
    }
    if (type.kind === 'html') {
      if (status === 200) this.keepAlive(meta);
      if (head) return new Response(null, { status, headers });
      return rewriteHtml(new Response(this.stream(sha, 0, size - 1), { status, headers }), meta.site, {
        reportLink: !NO_FRAME_PAGES.has(name), path: name, files: man.files, rt: RT, notices,
        origin, ogImage: name === 'index.html' ? this.ogImageFor(meta.current, man) : '',
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
  return readInto(request, size);
}
/** 본문을 끝까지 읽음(묶음: 길이를 미리 알면 한 번만 잡고, 모르면 모았다가 이어 붙임). max를 넘으면 too_large */
async function readUpTo(request, max) {
  const declared = Number(request.headers?.get?.('content-length'));
  if (Number.isSafeInteger(declared) && declared >= 0 && declared <= max && request.headers.get("content-length") !== null) return readInto(request, declared);
  const chunks = []; let got = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.byteLength;
      if (got > max) { reader.cancel().catch(() => { }); throw new HttpError('too_large', '묶음이 너무 커요.'); }
      chunks.push(value);
    }
  }
  const out = new Uint8Array(got); let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out;
}
async function readInto(request, size) {
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
