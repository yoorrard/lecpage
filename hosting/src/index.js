// lecpage 바로 공개 호스트 — Worker 입구.
//   /api/*   JSON API(앱이 부름)            /s/<id>/…  올라온 사이트
//   /live/api/<코드>/…  실시간 방(질문·보드·투표). 사이트 화면이 같은 출처에서 부름
//   /, /report, /robots.txt 등은 public/ 의 정적 자산이라 이 코드를 거치지 않습니다.
// Worker는 길만 정하고, 무거운 일(검사·저장·HTML 손보기)은 Durable Object가 합니다(무료 요금제의 요청당 CPU 10ms).
import { config, expiryFrom } from './config.js';
import { HttpError, json, readJson, errorFrom, corsHeaders, preflight, withHeaders } from './http.js';
import { ID_RE, SHA256_RE, DEPLOY_RE, newId, newKey, sha256Hex, bearer, secretMatches } from './ids.js';
import { notFoundPage, methodNotAllowed } from './pages.js';
import { liveTarget, liveOriginOk, FILE_ALIAS, LIVE_PREFIX, LiveError } from './live/host.js';
import { Site } from './site.js';
import { Gate } from './gate.js';
import { Room, Guard } from './room.js';

export { Site, Gate, Room, Guard };

const siteStub = (env, id) => env.SITE.get(env.SITE.idFromName(id));
const gateStub = (env) => env.GATE.get(env.GATE.idFromName('gate'));
const post = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
/** DO 응답이 오류면 HttpError로 바꿔 던짐 */
async function ok(res) { if (!res.ok) throw await errorFrom(res); return res; }

// 하루 요청 예산(무료 요금제에서만 켜짐): 요청마다 Gate를 부르면 그것도 요청이라, 50건이나 30초마다 묶어서 알림
let cfgCache = null;
const cfgOf = (env) => (cfgCache && cfgCache.env === env ? cfgCache.cfg : (cfgCache = { env, cfg: config(env) }).cfg);
let seen = 0; let flushedAt = 0;
function tally(env, ctx) {
  if (!cfgOf(env).dailyRequestBudget) return;
  seen++;
  const now = Date.now();
  if (seen < 50 && now - flushedAt < 30000) return;
  const n = seen; seen = 0; flushedAt = now;
  ctx.waitUntil(gateStub(env).fetch('http://gate/tick', post({ n })).catch(() => { }));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname;
    tally(env, ctx);
    if (p.startsWith('/s/')) return serveSite(request, env, url);
    if (p === LIVE_PREFIX || p.startsWith(`${LIVE_PREFIX}/`) || FILE_ALIAS.test(p)) return live(request, env, url);
    if (p.startsWith('/api/')) return api(request, env, ctx, url);
    return notFoundPage(request.method === 'HEAD');
  },
};

// ── 사이트 내보내기 ─────────────────────────────────────────────
function serveSite(request, env, url) {
  const head = request.method === 'HEAD';
  const m = /^\/s\/([^/]+)(\/(.*))?$/.exec(url.pathname);
  if (!m || !ID_RE.test(m[1])) return notFoundPage(head); // 주소 모양이 아니면 DO를 깨우지 않음
  if (request.method !== 'GET' && !head) return methodNotAllowed();
  if (m[2] === undefined) return new Response(null, { status: 308, headers: { location: `/s/${m[1]}/${url.search}`, 'cache-control': 'no-store' } });
  const headers = {};
  for (const k of ['if-none-match', 'if-range', 'range']) { const v = request.headers.get(k); if (v) headers[k] = v; }
  return siteStub(env, m[1]).fetch(`http://site/file?p=${encodeURIComponent(m[3])}`, { method: request.method, headers });
}

// ── 실시간 방 ───────────────────────────────────────────────────
// 규칙(HTTP 프로토콜 v1)은 skills/lecpage/backends/cloudflare 그대로. 응답도 그 모양({ error, message })입니다.
function liveJson(status, body, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers } });
}
function live(request, env, url) {
  const cfg = config(env);
  try {
    if (!cfg.live) throw new LiveError(404, 'not_found', '이 서버는 실시간 방을 쓰지 않습니다.');
    const t = liveTarget(url.pathname);
    if (!t) throw new LiveError(404, 'not_found', '없는 주소입니다.');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'GET, HEAD, POST, PUT, PATCH, DELETE' } });
    if (t.kind === 'health') return liveJson(200, { ok: true, protocol: 1, uploads: cfg.liveUploads, runtime: 'cloudflare' });
    if (!liveOriginOk({ method: request.method, op: t.op, origin: request.headers.get('origin'), self: cfg.publicOrigin || url.origin })) {
      throw new LiveError(403, 'origin_not_allowed', '허용되지 않은 사이트에서 온 요청입니다.');
    }
    // 방(Durable Object)에는 '/api/<코드>/…' 경로로 넘김. WebSocket 연결(101)도 그대로 돌려줌
    const target = new URL(url);
    target.pathname = t.path;
    return env.ROOM.get(env.ROOM.idFromName(t.code)).fetch(new Request(target, request));
  } catch (e) {
    if (e instanceof LiveError) return liveJson(e.status, { error: e.code, message: e.message });
    console.error('live error', e?.stack || e);
    return liveJson(500, { error: 'server_error', message: '서버 오류가 났어요. 잠시 후 다시 시도해 주세요.' });
  }
}

// ── API ─────────────────────────────────────────────────────────
async function api(request, env, ctx, url) {
  const cfg = config(env);
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return preflight(origin, cfg.origins);
  let res;
  try {
    const self = cfg.publicOrigin || url.origin;
    // 브라우저가 보낸 요청이면 허용한 앱 주소에서만. 올라온 사이트(같은 출처)의 화면이 API를 부르는 것도 막음. 신고만 이 호스트의 신고 화면에서 받음
    if (origin && !cfg.origins.has(origin) && !(origin === self && url.pathname === '/api/report')) {
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
    // accepting: 지금 새 사이트를 받는지(무료 요금제에서 하루 요청 예산을 많이 썼으면 false). 못 물어보면 받는 것으로
    let accepting = true;
    if (cfg.dailyRequestBudget) { try { accepting = (await (await gateStub(env).fetch('http://gate/status')).json()).accepting !== false; } catch { /* 그대로 */ } }
    return json({
      ok: true, v: 1, plan: cfg.plan, accepting,
      limits: { maxBytes: cfg.maxBytes, maxFileBytes: cfg.maxFileBytes, maxFiles: cfg.maxFiles, days: cfg.days },
      report: `${self}/report`,
      ...(cfg.live ? { live: { url: `${self}${LIVE_PREFIX}`, uploads: cfg.liveUploads, maxUploadMb: cfg.liveMaxUploadMb } } : {}),
    });
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
    // 관리자 열쇠를 정하지 않았으면 관리 주소는 없는 것으로
    if (!cfg.adminKey) throw new HttpError('not_found', '없는 주소예요.');
    if (!(await secretMatches(bearer(request.headers.get('authorization')), cfg.adminKey))) throw new HttpError('unauthorized', '관리자 열쇠가 맞지 않아요.');
    if (b === 'reports' && parts.length === 2 && method === 'GET') return gateStub(env).fetch('http://gate/reports');
    if (b === 'sites' && parts.length === 2 && method === 'GET') return gateStub(env).fetch('http://gate/sites');
    if (b === 'sites' && parts.length >= 3) {
      if (!ID_RE.test(c)) throw new HttpError('not_found');
      if (parts.length === 3 && method === 'DELETE') return siteStub(env, c).fetch('http://site/admin-site', { method: 'DELETE' });
      if (d === 'block' && parts.length === 4 && method === 'POST') return siteStub(env, c).fetch(new Request('http://site/admin-block', request));
    }
    throw new HttpError('not_found', '없는 주소예요.');
  }

  throw new HttpError('not_found', '없는 주소예요.');
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
    const reserved = await gate.fetch('http://gate/reserve', post({ ip, id, created: now, expires }));
    if (reserved.status === 409) continue; // 같은 주소가 이미 있음(거의 없는 일) → 다시 뽑음
    await ok(reserved);
    const made = await siteStub(env, id).fetch('http://site/init', post({ id, keyHash: await sha256Hex(key), title, created: now, expires }));
    if (!made.ok) {
      await gate.fetch('http://gate/forget', post({ id }));
      if (made.status === 409) continue;
      throw await errorFrom(made);
    }
    return json({ id, key, url: `${self}/s/${id}/`, expiresAt: expires }, 201);
  }
  throw new HttpError('bad_request', '주소를 만들지 못했어요. 다시 해 주세요.', { status: 503 });
}

async function report(request, env, ctx, cfg, self) {
  const body = await readJson(request, 16 * 1024);
  const raw = typeof body.site === 'string' ? body.site.trim() : '';
  const id = ID_RE.test(raw) ? raw : (/\/s\/([0-9a-hjkmnp-tv-z]{10})(?:[/?#]|$)/.exec(raw) || [])[1];
  if (!id) throw new HttpError('bad_request', '신고할 사이트 주소를 확인해 주세요.');
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) throw new HttpError('bad_request', '신고하는 까닭을 적어 주세요.');
  if (reason.length > 2000) throw new HttpError('bad_request', '까닭은 2,000자까지 적을 수 있어요.');
  const contact = typeof body.contact === 'string' ? body.contact.trim() : '';
  if (contact.length > 200) throw new HttpError('bad_request', '연락처는 200자까지 적을 수 있어요.');
  const ip = request.headers.get('cf-connecting-ip') || '';
  const saved = await (await ok(await gateStub(env).fetch('http://gate/report', post({ ip, site: id, reason, contact })))).json();
  if (cfg.reportWebhook) {
    const link = `${self}/s/${id}/`;
    const text = `[lecpage 바로 공개 신고 #${saved.n}] ${link}\n${reason}\n연락처: ${contact || '없음'}`.slice(0, 1800);
    // text는 Slack, content는 Discord 웹훅이 읽는 이름
    ctx.waitUntil(fetch(cfg.reportWebhook, post({ text, content: text, n: saved.n, site: id, url: link, reason, contact, at: saved.at })).catch((e) => console.error('report webhook failed', e?.message)));
  }
  return json({ ok: true });
}
