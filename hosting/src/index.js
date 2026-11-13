// lecpage 바로 배포 호스트 — Worker 입구.
//   /api/*   JSON API(앱이 부름)            /s/<id>/…  배포한 사이트
//   /live/api/<코드>/…  실시간 방(질문·보드·투표). 사이트 화면이 같은 출처에서 부름
//   /admin, /admin/api/…  운영자 관리 화면(Cloudflare Access 뒤. 켜지 않았으면 404) → admin.js
//   /, /report, /robots.txt, /rt/<sha>.js 등은 public/ 의 정적 자산이라 이 코드를 거치지 않습니다(요청 수에도 들지 않음).
// Worker는 길만 정하고, 무거운 일(검사·저장·HTML 손보기)은 Durable Object가 합니다(무료 요금제의 요청당 CPU 10ms).
import { config, expiryFrom, EXTRA_WORK_SHARE } from './config.js';
import { HttpError, json, readJson, errorFrom, corsHeaders, preflight, withHeaders } from './http.js';
import { ID_RE, SHA256_RE, DEPLOY_RE, newId, newKey, sha256Hex, bearer, secretMatches } from './ids.js';
import { notFoundPage, gonePage, methodNotAllowed } from './pages.js';
import { liveTarget, liveOriginOk, FILE_ALIAS, LIVE_PREFIX, LiveError } from './live/host.js';
import { Tally, MinuteLimiter, appStatKey } from './tally.js';
import { admin } from './admin.js';
import { extOf } from './paths.js';
import { siteUrlOf, siteOriginRe } from './pages-site.js';
import { Site } from './site.js';
import { Gate } from './gate.js';
import { Room, Guard, MAX_WAIT_S } from './room.js';

export { Site, Gate, Room, Guard };

/** Durable Object 요청을 셈(DO 하루 한도 어림): Site ds, Room dr, Gate dg */
const counted = (stub, k) => ({ fetch: (...a) => { T.mark(k); return stub.fetch(...a); } });
const siteStub = (env, id) => counted(env.SITE.get(env.SITE.idFromName(id)), 'ds');
const gateStub = (env) => counted(env.GATE.get(env.GATE.idFromName('gate')), 'dg');
const roomStub = (env, code) => counted(env.ROOM.get(env.ROOM.idFromName(code)), 'dr');
const post = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
/** DO 응답이 오류면 HttpError로 바꿔 던짐 */
async function ok(res) { if (!res.ok) throw await errorFrom(res); return res; }

let cfgCache = null;
const cfgOf = (env) => {
  if (cfgCache && cfgCache.env === env) return cfgCache.cfg;
  const cfg = config(env);
  // VIEW=pages 사이트의 출처(https://s-<id>.<프로젝트>.pages.dev): 실시간 방 CORS
  cfg.siteOriginRe = cfg.pagesCfg ? siteOriginRe(cfg.pagesCfg.siteUrl) : null;
  cfgCache = { env, cfg };
  return cfg;
};

// ── 하루 숫자 세기(isolate마다 모아서 Gate에 한 번에) ─────────────────
const T = new Tally();
const statLimit = new MinuteLimiter(20);
/** Gate가 마지막으로 알려 준 오늘 예산 사용률(%, 세 한도 중 가장 빠듯한 것). 덜 급한 일(앱 이용 합계 받기)을 미룰 때 씀 */
let budgetPct = 0;
/** 오늘 DO duration 몫(%, 무료). 50%부터 긴 대기를 Worker가 대신, 60%부터 새 SSE는 받지 않음(런타임이 긴 대기로 내려감) */
let gbsPct = 0;
function flush(env, ctx, force = false) {
  const batch = T.take(Date.now(), force);
  if (!batch) return;
  ctx.waitUntil(env.GATE.get(env.GATE.idFromName('gate')).fetch('http://gate/tick', post(batch)) // 세는 일 자체는 Gate가 gt로 셈
    .then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (j && Number.isFinite(j.pct)) budgetPct = j.pct;
      if (j && Number.isFinite(j.gbsPct)) gbsPct = j.gbsPct;
      // 단계·멈춤이 바뀌었으면 /api/info의 20초 기억을 버림
      const c = statusCache?.body;
      if (j && c && (j.state !== c.capacity?.state || !!j.paused !== !!c.paused)) statusCache = null;
    })
    .catch(() => { }));
}
function kindOf(p) {
  if (p.startsWith('/s/')) return 'site';
  if (p.startsWith('/api/') && !FILE_ALIAS.test(p)) return 'api';
  if (p === LIVE_PREFIX || p.startsWith(`${LIVE_PREFIX}/`) || FILE_ALIAS.test(p)) return 'live';
  if (p === '/admin' || p.startsWith('/admin/')) return 'admin';
  return 'bot';
}
const isLocalHost = (h) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname;
    const kind = kindOf(p);
    T.hit(kind);
    // 내 도메인에 http로 들어오면 https로(로컬 개발은 그대로)
    if (url.protocol === 'http:' && !isLocalHost(url.hostname)) { url.protocol = 'https:'; return Response.redirect(url.href, 308); }
    const cfg = cfgOf(env);
    T.every = cfg.tallyEvery;
    let res;
    try {
      if (kind === 'site') res = await serveSite(request, env, ctx, url, cfg);
      else if (kind === 'live') return count(live(request, env, url, cfg), env, ctx); // WebSocket(101)은 감싸지 않음
      else if (kind === 'api') res = await api(request, env, ctx, url, cfg);
      else if (kind === 'admin') res = await admin(request, env, url, cfg, { gate: () => gateStub(env), site: (id) => siteStub(env, id), onNoticeChange: () => noticeMem.clear(), onUploadsChange: () => { statusCache = null; } });
      else res = notFoundPage(request.method === 'HEAD');
    } catch (e) {
      T.mark('err'); flush(env, ctx);
      throw e;
    }
    count(res, env, ctx);
    return url.protocol === 'https:' ? secure(res) : res;
  },
};
function count(res, env, ctx) {
  const done = (r) => { if (r.status >= 500) T.mark('err'); else if (r.status === 429) T.mark('lim'); flush(env, ctx); return r; };
  return res instanceof Promise ? res.then(done) : done(res);
}
/** 모든 응답에 HSTS(https로만). DO가 준 응답은 머리글을 못 바꾸므로 감쌈 */
function secure(res) {
  if (res.status === 101 || res.webSocket) return res;
  const out = new Response(res.body, res);
  out.headers.set('strict-transport-security', 'max-age=31536000');
  return out;
}

// ── 사이트 내보내기 ─────────────────────────────────────────────
// 없는 사이트(보관 기간 끝·지움)를 1분 기억: 같은 주소를 두드려도 Durable Object를 깨우지 않음
const goneMem = new Map();
const GONE_MS = 60000;
// 사이트 파일 응답을 Cloudflare 데이터센터 캐시(Cache API)에 10분 둠. 내 도메인을 붙였을 때만 동작(workers.dev에서는 아무 일도 안 함)
const EDGE_TTL = 'public, max-age=600';
const CACHE_OK_TYPES = new Set(['css', 'js', 'png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'ico', 'svg', 'woff2', 'json', 'webmanifest', 'txt']);

async function serveSite(request, env, ctx, url, cfg) {
  const head = request.method === 'HEAD';
  const m = /^\/s\/([^/]+)(\/(.*))?$/.exec(url.pathname);
  if (!m || !ID_RE.test(m[1])) { T.mark('bot'); return notFoundPage(head); } // 주소 모양이 아니면 DO를 깨우지 않음
  if (request.method !== 'GET' && !head) { T.mark('bot'); return methodNotAllowed(); }
  const id = m[1];
  if (m[2] === undefined) return new Response(null, { status: 308, headers: { location: `/s/${id}/${url.search}`, 'cache-control': 'no-store' } });
  const g = goneMem.get(id);
  if (g && g > Date.now()) { T.mark('bot'); return gonePage(head); }
  const path = m[3];
  const v = url.searchParams.get('v') || '';
  // 데이터센터 캐시: 지문(?v=)만 붙었거나 물음표가 없는 HTML 아닌 파일. Range·HEAD는 그대로 보냄
  const search = [...url.searchParams.keys()];
  const cacheable = !head && !request.headers.has('range') && CACHE_OK_TYPES.has(extOf(path)) && (search.length === 0 || (search.length === 1 && /^[0-9a-f]{8,64}$/.test(v)));
  const cache = cacheable && typeof caches !== 'undefined' ? caches.default : null;
  const key = cache ? new Request(`${url.origin}${url.pathname}${v ? `?v=${v}` : ''}`) : null;
  if (cache) {
    const hit = await cache.match(key).catch(() => null);
    if (hit) { T.mark('edge'); return fromEdge(hit, request); }
  }
  const headers = { 'x-lp-origin': cfg.publicOrigin || url.origin };
  for (const k of ['if-none-match', 'if-range', 'range']) { const x = request.headers.get(k); if (x) headers[k] = x; }
  if (/^console(\.html)?$/.test(path)) {
    const list = await noticesFor(env, 'teacher').catch(() => []);
    if (list.length) headers['x-lp-notice'] = encodeURIComponent(JSON.stringify(list));
  }
  let res = await siteStub(env, id).fetch(`http://site/file?p=${encodeURIComponent(path)}${v ? `&v=${encodeURIComponent(v)}` : ''}`, { method: request.method, headers });
  const proxy = res.headers.get('x-lp-proxy');
  if (proxy) res = await fromPages(request, proxy, id, path);
  if (res.headers.get('x-lp-state') === 'gone') {
    if (goneMem.size > 5000) goneMem.clear();
    goneMem.set(id, Date.now() + GONE_MS);
    const out = new Response(res.body, res); out.headers.delete('x-lp-state'); return out;
  }
  if (cache && res.status === 200 && /^public/.test(res.headers.get('cache-control') || '')) {
    const copy = new Response(res.clone().body, res);
    copy.headers.set('x-lp-cc', res.headers.get('cache-control'));
    copy.headers.set('cache-control', EDGE_TTL); // 가린 사이트의 파일이 데이터센터에 오래 남지 않게 10분만
    ctx.waitUntil(cache.put(key, copy).catch(() => { }));
  }
  return res;
}
/**
 * VIEW=pages 사이트를 이 호스트 주소(/s/<id>/…)로 열 때: Pages에서 가져와 내보냄. 학교망이 pages.dev를 막았을 때 쓰는 두 번째 주소.
 * Pages의 머리글(CSP 등 우리가 만든 _headers)을 그대로 쓰고, 이 호스트 주소로 넘기는 것만 고침.
 */
async function fromPages(request, base, id, path) {
  const target = new URL(path || '', base);
  if (!target.href.startsWith(base)) return notFoundPage(request.method === 'HEAD');
  const h = new Headers();
  for (const k of ['if-none-match', 'accept', 'accept-language', 'user-agent']) { const x = request.headers.get(k); if (x) h.set(k, x); }
  let r;
  try { r = await fetch(target.href, { method: request.method === 'HEAD' ? 'HEAD' : 'GET', headers: h, redirect: 'manual' }); }
  catch { return new Response('사이트를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.\n', { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } }); }
  const out = new Response(r.body, r);
  for (const k of ['access-control-allow-origin', 'set-cookie', 'report-to', 'nel', 'server-timing']) out.headers.delete(k);
  const loc = r.headers.get('location');
  if (loc) {
    // Pages가 /x.html → /x로 넘김: 이 호스트의 /s/<id>/x로. 다른 곳(영상·소리 → 이 호스트)은 그대로
    try { const u = new URL(loc, target); if (u.href.startsWith(base)) out.headers.set('location', `/s/${id}/${u.href.slice(base.length)}`); } catch { /* 그대로 */ }
  }
  return out;
}
/** 캐시에서 꺼낸 응답 → 브라우저에 줄 모양(원래 Cache-Control, 304) */
function fromEdge(hit, request) {
  const h = new Headers(hit.headers);
  h.set('cache-control', h.get('x-lp-cc') || EDGE_TTL); h.delete('x-lp-cc');
  for (const k of ['cf-cache-status', 'age', 'expires']) h.delete(k);
  const inm = request.headers.get('if-none-match');
  if (inm && inm.split(',').some((t) => t.trim().replace(/^W\//, '') === h.get('etag'))) { h.delete('content-type'); h.delete('content-length'); return new Response(null, { status: 304, headers: h }); }
  return new Response(hit.body, { status: 200, headers: h });
}

// ── 공지(운영자 → 앱·강사 화면) ─────────────────────────────────
const noticeMem = new Map(); // 대상 → { at, list }. isolate마다 1분
async function noticesFor(env, target) {
  const c = noticeMem.get(target);
  if (c && Date.now() - c.at < 60000) return c.list;
  const res = await gateStub(env).fetch(`http://gate/notices?for=${target}`);
  const list = res.ok ? (await res.json()).notices || [] : [];
  noticeMem.set(target, { at: Date.now(), list });
  return list;
}

// ── 실시간 방 ───────────────────────────────────────────────────
// 규칙(HTTP 프로토콜 v1)은 skills/lecpage/backends/cloudflare 그대로. 응답도 그 모양({ error, message })입니다.
function liveJson(status, body, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers } });
}
/** 묻기 간격 권고(밀리초). 무료 요금제에서 하루 예산 50%를 넘으면 10초, 80%를 넘으면 20초 */
function pollHint(cfg, pct = budgetPct) {
  if (!cfg.dailyRequestBudget) return 5000;
  return pct >= 80 ? 20000 : pct >= 50 ? 10000 : 5000;
}
/** VIEW=pages 사이트(다른 출처)가 방을 부를 때 붙이는 CORS 머리글. 그 밖의 출처에는 붙이지 않음 */
const LIVE_CORS_BASE = { 'access-control-allow-methods': 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS', 'access-control-allow-headers': 'Content-Type, X-Lec-Token, X-Lec-Admin, X-Lec-Filename', 'access-control-max-age': '86400', vary: 'Origin' };
function liveCors(origin, cfg) {
  return origin && cfg.siteOriginRe && cfg.siteOriginRe.test(origin) ? { ...LIVE_CORS_BASE, 'access-control-allow-origin': origin } : null;
}
async function live(request, env, url, cfg) {
  const cors = liveCors(request.headers.get('origin'), cfg);
  const done = (res) => (cors && res.status !== 101 && !res.webSocket ? withHeaders(res, cors) : res);
  try {
    if (!cfg.live) throw new LiveError(404, 'not_found', '이 서버는 실시간 방을 쓰지 않습니다.');
    const t = liveTarget(url.pathname);
    if (!t) throw new LiveError(404, 'not_found', '없는 주소입니다.');
    if (request.method === 'OPTIONS') return done(new Response(null, { status: 204, headers: { allow: 'GET, HEAD, POST, PUT, PATCH, DELETE' } }));
    if (t.kind === 'health') return done(liveJson(200, { ok: true, protocol: 1, uploads: cfg.liveUploads, runtime: 'cloudflare' }));
    if (!liveOriginOk({ method: request.method, op: t.op, origin: request.headers.get('origin'), self: cfg.publicOrigin || url.origin, sites: cfg.siteOriginRe })) {
      throw new LiveError(403, 'origin_not_allowed', '허용되지 않은 사이트에서 온 요청입니다.');
    }
    // 방(Durable Object)에는 '/api/<코드>/…' 경로로 넘김. WebSocket 연결(101)도 그대로 돌려줌
    const target = new URL(url);
    target.pathname = t.path;
    const fwd = new Request(target, request);
    fwd.headers.delete('x-lp-relay'); // 안쪽 표시는 Worker만 붙임
    // 무료에서 duration이 빠듯하면 새 SSE(연결 내내 방이 깨어 있음)는 받지 않음 → 런타임이 긴 대기로 내려가고, 긴 대기는 Worker가 대신
    if (t.op === 'events' && request.method === 'GET' && cfg.dailyRequestBudget && gbsPct >= 60) throw new LiveError(503, 'busy', '지금은 실시간 연결이 붐벼요. 잠시 묻기 방식으로 이어 갈게요.');
    const relay = cfg.pollRelay === true || (cfg.pollRelay === 'auto' && (!cfg.dailyRequestBudget || gbsPct >= 50));
    const longPoll = relay && t.op === 'snapshot' && request.method === 'GET' && Number(url.searchParams.get('since')) > 0 && Number(url.searchParams.get('wait')) > 0;
    const res = longPoll ? await relayWait(env, fwd, t.code, Number(url.searchParams.get('wait'))) : await roomStub(env, t.code).fetch(fwd);
    // 묻기 간격 권고(런타임이 따르면): 하루 예산을 많이 쓸수록 길게
    if (t.op === 'snapshot' && request.method === 'GET' && res.status === 200) return done(withHeaders(res, { 'x-lec-poll-ms': String(pollHint(cfg)), ...(cors ? { 'access-control-expose-headers': 'X-Lec-Poll-Ms' } : {}) }));
    return done(res);
  } catch (e) {
    if (e instanceof LiveError) return done(liveJson(e.status, { error: e.code, message: e.message }));
    console.error('live error', e?.stack || e);
    return done(liveJson(500, { error: 'server_error', message: '서버 오류가 났어요. 잠시 후 다시 시도해 주세요.' }));
  }
}

/**
 * 긴 대기를 Worker가 대신 기다림(방은 잠듦 → Durable Object 시간 과금 없음). Worker는 기다리는 시간에 과금되지 않음(공식: Workers 요금은 요청·CPU).
 * 방이 101 + WebSocket을 주면: 첫 글 = 지금 snapshot(바뀐 것 없음). 그 뒤 글이 오거나 닫히면 바뀐 것 → 한 번 더 물어 답함. 시간이 다 되면 첫 글로 답함.
 * 방이 101이 아니면(바뀐 것이 이미 있음·오류·대기 자리 없음) 그 답을 그대로.
 */
async function relayWait(env, fwd, code, waitS) {
  const h = new Headers(fwd.headers);
  h.set('upgrade', 'websocket'); h.set('x-lp-relay', '1');
  const res = await roomStub(env, code).fetch(new Request(fwd.url, { method: 'GET', headers: h }));
  const ws = res.webSocket;
  if (res.status !== 101 || !ws) return res;
  T.mark('dr'); // 웹소켓이 닫힐 때 방이 받는 이벤트도 DO 요청으로 셈(문서에 없어 보수적으로)
  ws.accept();
  const CHANGED = Symbol('changed');
  const got = await new Promise((resolve) => {
    let first = null; let over = false;
    const finish = (v) => { if (over) return; over = true; clearTimeout(timer); try { ws.close(1000, 'done'); } catch { /* 이미 닫힘 */ } resolve(v); };
    const timer = setTimeout(() => finish(first ?? CHANGED), Math.min(MAX_WAIT_S, Math.max(1, waitS)) * 1000);
    ws.addEventListener('message', (m) => { if (first === null && typeof m.data === 'string' && m.data !== 'c') first = m.data; else finish(CHANGED); });
    ws.addEventListener('close', () => finish(CHANGED));
    ws.addEventListener('error', () => finish(CHANGED));
  });
  if (got !== CHANGED) return new Response(got, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
  const plain = new URL(fwd.url); plain.searchParams.delete('wait');
  return roomStub(env, code).fetch(new Request(plain, { method: 'GET', headers: fwd.headers }));
}

// ── API ─────────────────────────────────────────────────────────
/** 같은 호스트의 화면(신고 화면)에서 부를 수 있는 API */
const SELF_OK = new Set(['/api/report']);
async function api(request, env, ctx, url, cfg) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return preflight(origin, cfg.origins);
  let res;
  try {
    const self = cfg.publicOrigin || url.origin;
    // 브라우저가 보낸 요청이면 허용한 앱 주소에서만. 배포한 사이트(같은 출처)의 화면이 API를 부르는 것도 막음. 신고만 이 호스트의 신고 화면에서 받음
    if (origin && !cfg.origins.has(origin) && !(origin === self && SELF_OK.has(url.pathname))) {
      throw new HttpError('unauthorized', '허용하지 않은 곳에서 온 요청이에요.', { status: 403 });
    }
    res = await route(request, env, ctx, url, cfg, self);
  } catch (e) {
    if (e instanceof HttpError) res = e.toResponse();
    else { console.error('api error', e?.stack || e); res = json({ error: { code: 'bad_request', message_ko: '서버에서 문제가 생겼어요. 잠시 뒤에 다시 해 주세요.' } }, 500); }
  }
  return withHeaders(res, corsHeaders(origin, cfg.origins));
}

async function route(request, env, ctx, url, cfg, self) {
  const method = request.method;
  const parts = url.pathname.split('/').slice(2); // '/api/…' 뒤
  const [a, b, c, d, e] = parts;

  if (a === 'info' && parts.length === 1 && method === 'GET') {
    // accepting: 지금 새 사이트를 받는지(하루 요청 예산을 많이 썼거나 운영자가 멈췄으면 false). 못 물어보면 받는 것으로
    // capacity: 단계(open·tight·full·paused)·까닭·넘길 곳(fair.js). 앱이 배포 화면을 열 때 이것으로 처음부터 알맞은 길을 고름
    // 앱이 켜질 때마다 부르므로 isolate에 20초 두고 브라우저에도 30초(Gate 요청을 줄임)
    const s = await gateStatus(env);
    const accepting = s ? s.accepting !== false : true; const paused = !!s?.paused;
    return json({
      ok: true, v: 1, plan: cfg.plan, accepting, ...(paused ? { paused } : {}), ...(s?.capacity ? { capacity: s.capacity } : {}),
      // view: 사이트를 내보내는 곳(pages: 사이트마다 다른 주소, 방문이 하루 한도에 들지 않음). keepAlive: 방문이 있으면 보관 기간을 다시 채우는지
      view: cfg.view, keepAlive: cfg.keepAlive,
      limits: { maxBytes: cfg.maxBytes, maxFileBytes: cfg.maxFileBytes, maxFiles: cfg.maxFiles, days: cfg.days },
      report: `${self}/report`,
      ...(cfg.live ? { live: { url: `${self}${LIVE_PREFIX}`, uploads: cfg.liveUploads, maxUploadMb: cfg.liveMaxUploadMb } } : {}),
    }, 200, { 'cache-control': 'public, max-age=30' });
  }

  // 팝업 공지: 앱이 켜질 때 한 번 부름. 글자만(제목·본문·https 링크 하나)
  if (a === 'notice' && parts.length === 1 && method === 'GET') {
    const target = url.searchParams.get('for') === 'teacher' ? 'teacher' : 'app';
    const list = await noticesFor(env, target).catch(() => []);
    return json({ notices: list }, 200, { 'cache-control': 'public, max-age=60' });
  }

  // 앱 익명 이용 합계(sendBeacon). 개인을 알아볼 수 있는 것은 받지도 남기지도 않고, 표에 있는 항목의 하루 숫자만 더함
  if (a === 'stats' && parts.length === 1 && method === 'POST') {
    const quiet = new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
    if (!cfg.stats || !request.headers.get('origin')) return quiet;
    if (cfg.dailyRequestBudget && budgetPct >= EXTRA_WORK_SHARE * 100) return quiet; // 예산이 빠듯하면 Gate를 부르지 않고 버림
    const key = appStatKey(await smallText(request, 200));
    if (key && statLimit.ok(request.headers.get('cf-connecting-ip') || '')) T.stat(key);
    return quiet;
  }

  // 상태: 앱의 '배포 전 점검'·'연수 전날 점검'. 오늘·그날(date) 남은 몫, 사이트·참여 기능 방 상태. 1분 캐시(브라우저·이 isolate)
  if (a === 'status' && parts.length === 1 && method === 'GET') return status(env, url, cfg);

  if (a === 'sites' && parts.length === 1 && method === 'POST') return createSite(request, env, cfg, self);

  if (a === 'sites' && parts.length >= 2) {
    if (!ID_RE.test(b)) throw new HttpError('not_found');
    const site = siteStub(env, b);
    const forward = (path) => {
      const req = new Request(`http://site/${path}`, request);
      req.headers.set('x-lp-origin', self);
      return site.fetch(req);
    };
    const size = Number(request.headers.get('content-length') || 0);
    if (parts.length === 2 && method === 'DELETE') return forward('site');
    if (c === 'deploys' && parts.length === 3 && method === 'POST') return forward('deploys');
    if (c === 'live' && parts.length === 3 && method === 'POST') return forward('live');
    if (c === 'deploys' && e === 'publish' && parts.length === 5 && method === 'POST') {
      if (!DEPLOY_RE.test(d)) throw new HttpError('not_found', '없는 배포예요. 목록(deploys)부터 다시 보내 주세요.');
      return forward(`publish/${d}`);
    }
    if (c === 'blobs' && parts.length === 4 && method === 'PUT') {
      if (!SHA256_RE.test(d)) throw new HttpError('bad_request', 'sha256이 맞지 않아요.');
      if (size > cfg.maxFileBytes) throw new HttpError('too_large');
      return forward(`blobs/${d}`);
    }
    throw new HttpError('not_found', '없는 주소예요.');
  }

  if (a === 'report' && parts.length === 1 && method === 'POST') return report(request, env, ctx, cfg, self);

  if (a === 'admin') {
    // curl용 관리자 열쇠. 정하지 않았으면 관리 주소는 없는 것으로. (관리 화면 /admin은 Access로 따로 들어옴)
    if (!cfg.adminKey) throw new HttpError('not_found', '없는 주소예요.');
    if (!(await secretMatches(bearer(request.headers.get('authorization')), cfg.adminKey))) throw new HttpError('unauthorized', '관리자 열쇠가 맞지 않아요.');
    const gate = gateStub(env);
    const audit = (action, target, detail = '') => gate.fetch('http://gate/audit', post({ who: 'ADMIN_KEY(curl)', action, target, detail })).catch(() => { });
    if (b === 'reports' && parts.length === 2 && method === 'GET') return gate.fetch('http://gate/reports');
    if (b === 'sites' && parts.length === 2 && method === 'GET') return gate.fetch('http://gate/sites');
    if (b === 'stats' && parts.length === 2 && method === 'GET') return gate.fetch('http://gate/overview');
    if (b === 'uploads' && parts.length === 2 && method === 'POST') {
      const body = await readJson(request, 4096);
      statusCache = null;
      return gate.fetch('http://gate/uploads', post({ paused: body.paused, reason: body.reason, who: 'ADMIN_KEY(curl)' }));
    }
    if (b === 'sites' && parts.length >= 3) {
      if (!ID_RE.test(c)) throw new HttpError('not_found');
      if (parts.length === 3 && method === 'DELETE') {
        const res = await siteStub(env, c).fetch('http://site/admin-site', { method: 'DELETE' });
        if (res.ok) await audit('site.delete', c);
        return res;
      }
      if (d === 'block' && parts.length === 4 && method === 'POST') {
        const body = await readJson(request, 8192);
        const res = await siteStub(env, c).fetch('http://site/admin-block', post(body));
        if (res.ok) await audit(body.blocked ? 'site.block' : 'site.unblock', c, String(body.reason || '').slice(0, 300));
        return res;
      }
    }
    throw new HttpError('not_found', '없는 주소예요.');
  }

  throw new HttpError('not_found', '없는 주소예요.');
}

/** Gate의 지금 단계. isolate마다 20초 기억(앱이 켜질 때마다 부르는 /api/info가 Gate를 매번 깨우지 않게) */
let statusCache = null;
async function gateStatus(env) {
  if (statusCache && Date.now() - statusCache.at < 20000) return statusCache.body;
  try {
    const body = await (await gateStub(env).fetch('http://gate/status')).json();
    statusCache = { at: Date.now(), body };
    return body;
  } catch { return statusCache?.body || null; }
}
const statusMem = new Map(); // 쿼리 → { at, body }
async function status(env, url, cfg) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('date') || '') ? url.searchParams.get('date') : '';
  const site = ID_RE.test(url.searchParams.get('site') || '') ? url.searchParams.get('site') : '';
  const k = `${date}|${site}`;
  const hit = statusMem.get(k);
  let body = hit && Date.now() - hit.at < 30000 ? hit.body : null;
  if (!body) {
    const g = await (await ok(await gateStub(env).fetch(`http://gate/day?date=${date}&site=${site}`))).json();
    body = { ok: true, view: cfg.view, plan: cfg.plan, live: cfg.live, ...g };
    if (statusMem.size > 500) statusMem.clear();
    statusMem.set(k, { at: Date.now(), body });
  }
  return json(body, 200, { 'cache-control': 'public, max-age=60' });
}

/** 본문을 max바이트까지만 글자로(넘으면 '') */
async function smallText(request, max) {
  if (Number(request.headers.get('content-length') || 0) > max || !request.body) return '';
  const reader = request.body.getReader(); const chunks = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { reader.cancel().catch(() => { }); return ''; }
    chunks.push(value);
  }
  const all = new Uint8Array(size); let o = 0;
  for (const c of chunks) { all.set(c, o); o += c.byteLength; }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(all); } catch { return ''; }
}

async function createSite(request, env, cfg, self) {
  const body = await readJson(request, 4096, { optional: true });
  const booking = body.booking && typeof body.booking === 'object' ? body.booking : null;
  const title = typeof body.title === 'string' ? body.title.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 120) : '';
  const now = Date.now();
  const expires = expiryFrom(now, cfg.days);
  const ip = request.headers.get('cf-connecting-ip') || '';
  const gate = gateStub(env);
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = newId(); const key = newKey();
    const url = cfg.pages ? siteUrlOf(cfg.pages, id) : `${self}/s/${id}/`;
    const reserved = await gate.fetch('http://gate/reserve', post({ ip, id, created: now, expires, title, url, booking, device: body.device, caps: Array.isArray(body.caps) ? body.caps.slice(0, 8) : undefined }));
    if (reserved.status === 409) continue; // 같은 주소가 이미 있음(거의 없는 일) → 다시 뽑음
    // share: 이 기기·주소의 오늘 남은 몫, live: 그날 방이 차서 참여 기능만 강사 계정으로(앱이 caps에 'split'을 보냈을 때), advice: 오래 쓸 사이트면 내 계정을 권함
    const r = await (await ok(reserved)).json();
    const signals = { ...(r.share ? { share: r.share } : {}), ...(r.live ? { live: r.live } : {}), ...(r.advice ? { advice: r.advice } : {}) };
    const made = await siteStub(env, id).fetch('http://site/init', post({ id, keyHash: await sha256Hex(key), title, created: now, expires, view: cfg.pages ? 'pages' : 'worker' }));
    if (!made.ok) {
      await gate.fetch('http://gate/forget', post({ id }));
      if (made.status === 409) continue;
      throw await errorFrom(made);
    }
    return json({ id, key, url, expiresAt: expires, ...(cfg.pages ? { altUrl: `${self}/s/${id}/`, view: 'pages' } : {}), ...signals }, 201);
  }
  throw new HttpError('bad_request', '주소를 만들지 못했어요. 다시 해 주세요.', { status: 503 });
}

async function report(request, env, ctx, cfg, self) {
  const body = await readJson(request, 16 * 1024);
  const raw = typeof body.site === 'string' ? body.site.trim() : '';
  // 사이트 id, 이 호스트의 /s/<id>/ 주소, VIEW=pages 주소(s-<id>.…)를 받음
  const id = ID_RE.test(raw) ? raw : (/\/s\/([0-9a-hjkmnp-tv-z]{10})(?:[/?#]|$)/.exec(raw) || /(?:^|[/.])s-([0-9a-hjkmnp-tv-z]{10})(?:[./]|$)/.exec(raw) || [])[1];
  if (!id) throw new HttpError('bad_request', '신고할 사이트 주소를 확인해 주세요.');
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) throw new HttpError('bad_request', '신고하는 까닭을 적어 주세요.');
  if (reason.length > 2000) throw new HttpError('bad_request', '까닭은 2,000자까지 적을 수 있어요.');
  const contact = typeof body.contact === 'string' ? body.contact.trim() : '';
  if (contact.length > 200) throw new HttpError('bad_request', '연락처는 200자까지 적을 수 있어요.');
  const ip = request.headers.get('cf-connecting-ip') || '';
  const saved = await (await ok(await gateStub(env).fetch('http://gate/report', post({ ip, site: id, reason, contact })))).json();
  if (cfg.reportWebhook) {
    const link = cfg.pagesCfg && raw.includes(`s-${id}.`) ? siteUrlOf(cfg.pagesCfg, id) : `${self}/s/${id}/`;
    const text = `[lecpage 바로 배포 신고 #${saved.n}] ${link}\n${reason}\n연락처: ${contact || '없음'}\n처리: ${self}/admin/`.slice(0, 1800);
    // text는 Slack, content는 Discord 웹훅이 읽는 이름
    ctx.waitUntil(fetch(cfg.reportWebhook, post({ text, content: text, n: saved.n, site: id, url: link, reason, contact, at: saved.at })).catch((e) => console.error('report webhook failed', e?.message)));
  }
  return json({ ok: true });
}
