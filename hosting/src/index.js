// lecpage 바로 공개 호스트 — Worker 입구.
//   /api/*   JSON API(앱이 부름)            /s/<id>/…  올라온 사이트
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
import { Room, Guard } from './room.js';

export { Site, Gate, Room, Guard };

const siteStub = (env, id) => env.SITE.get(env.SITE.idFromName(id));
const gateStub = (env) => env.GATE.get(env.GATE.idFromName('gate'));
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
/** Gate가 마지막으로 알려 준 오늘 예산 사용률(%). 덜 급한 일(앱 이용 합계 받기)을 미룰 때 씀 */
let budgetPct = 0;
function flush(env, ctx, force = false) {
  const batch = T.take(Date.now(), force);
  if (!batch) return;
  ctx.waitUntil(gateStub(env).fetch('http://gate/tick', post(batch))
    .then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && Number.isFinite(j.pct)) budgetPct = j.pct; })
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
      else if (kind === 'admin') res = await admin(request, env, url, cfg, { gate: () => gateStub(env), site: (id) => siteStub(env, id), onNoticeChange: () => noticeMem.clear() });
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
// 없는 사이트(공개 기간 끝·지움)를 1분 기억: 같은 주소를 두드려도 Durable Object를 깨우지 않음
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
    return done(await env.ROOM.get(env.ROOM.idFromName(t.code)).fetch(new Request(target, request)));
  } catch (e) {
    if (e instanceof LiveError) return done(liveJson(e.status, { error: e.code, message: e.message }));
    console.error('live error', e?.stack || e);
    return done(liveJson(500, { error: 'server_error', message: '서버 오류가 났어요. 잠시 후 다시 시도해 주세요.' }));
  }
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
    // 브라우저가 보낸 요청이면 허용한 앱 주소에서만. 올라온 사이트(같은 출처)의 화면이 API를 부르는 것도 막음. 신고만 이 호스트의 신고 화면에서 받음
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
    let accepting = true; let paused = false;
    try { const s = await (await gateStub(env).fetch('http://gate/status')).json(); accepting = s.accepting !== false; paused = !!s.paused; } catch { /* 그대로 */ }
    return json({
      ok: true, v: 1, plan: cfg.plan, accepting, ...(paused ? { paused } : {}),
      // view: 사이트를 내보내는 곳(pages: 사이트마다 다른 주소, 방문이 하루 한도에 들지 않음). keepAlive: 방문이 있으면 공개 기간을 다시 채우는지
      view: cfg.view, keepAlive: cfg.keepAlive,
      limits: { maxBytes: cfg.maxBytes, maxFileBytes: cfg.maxFileBytes, maxFiles: cfg.maxFiles, days: cfg.days },
      report: `${self}/report`,
      ...(cfg.live ? { live: { url: `${self}${LIVE_PREFIX}`, uploads: cfg.liveUploads, maxUploadMb: cfg.liveMaxUploadMb } } : {}),
    });
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
  const title = typeof body.title === 'string' ? body.title.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 120) : '';
  const now = Date.now();
  const expires = expiryFrom(now, cfg.days);
  const ip = request.headers.get('cf-connecting-ip') || '';
  const gate = gateStub(env);
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = newId(); const key = newKey();
    const url = cfg.pages ? siteUrlOf(cfg.pages, id) : `${self}/s/${id}/`;
    const reserved = await gate.fetch('http://gate/reserve', post({ ip, id, created: now, expires, title, url }));
    if (reserved.status === 409) continue; // 같은 주소가 이미 있음(거의 없는 일) → 다시 뽑음
    await ok(reserved);
    const made = await siteStub(env, id).fetch('http://site/init', post({ id, keyHash: await sha256Hex(key), title, created: now, expires, view: cfg.pages ? 'pages' : 'worker' }));
    if (!made.ok) {
      await gate.fetch('http://gate/forget', post({ id }));
      if (made.status === 409) continue;
      throw await errorFrom(made);
    }
    return json({ id, key, url, expiresAt: expires, ...(cfg.pages ? { altUrl: `${self}/s/${id}/`, view: 'pages' } : {}) }, 201);
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
    const text = `[lecpage 바로 공개 신고 #${saved.n}] ${link}\n${reason}\n연락처: ${contact || '없음'}\n처리: ${self}/admin/`.slice(0, 1800);
    // text는 Slack, content는 Discord 웹훅이 읽는 이름
    ctx.waitUntil(fetch(cfg.reportWebhook, post({ text, content: text, n: saved.n, site: id, url: link, reason, contact, at: saved.at })).catch((e) => console.error('report webhook failed', e?.message)));
  }
  return json({ ok: true });
}
