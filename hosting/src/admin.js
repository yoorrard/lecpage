// 운영자 관리 화면(/admin)과 그 API(/admin/api/…).
//  - 앞에서 Cloudflare Access가 운영자 이메일만 들여보내고(정책은 대시보드에서), 여기서 Access 토큰(JWT)을 다시 확인함
//  - Access를 켜지 않았으면(ACCESS_TEAM_DOMAIN·ACCESS_AUD 없음) /admin 전체가 404
//  - 화면 파일(public/admin/)은 정적 자산이지만 run_worker_first로 이 코드를 거쳐서만 나감
//  - 상태를 바꾸는 요청은 CSRF를 막고(csrfProblem), 누가 언제 무엇을 했는지 감사 기록에 남김
// curl용 ADMIN_KEY(/api/admin/…)는 index.js에 그대로 있고, 이 화면과 열쇠를 나눠 씁니다.
import { verifyAccessJwt, jwksCache, csrfProblem, ADMIN_HEADERS, AccessError } from './access.js';
import { HttpError, json, readJson, errorFrom } from './http.js';
import { ID_RE } from './ids.js';
import { notFoundPage } from './pages.js';

const getKey = jwksCache();
/** 관리 화면이 내보내는 파일(이것 말고는 404) */
const FILES = { '/admin/': '/admin/', '/admin/app.js': '/admin/app.js', '/admin/app.css': '/admin/app.css' };

const withAdminHeaders = (res) => {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(ADMIN_HEADERS)) out.headers.set(k, v);
  return out;
};
const deny = (api, status = 403, message = 'Cloudflare Access로 로그인한 운영자만 들어올 수 있어요.') => withAdminHeaders(api
  ? json({ error: { code: status === 503 ? 'bad_request' : 'unauthorized', message_ko: message } }, status)
  : new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>관리 화면</title><p>${message}</p>\n`, { status, headers: { 'content-type': 'text/html; charset=utf-8' } }));

/**
 * @param {Request} request
 * @param {object} env
 * @param {URL} url
 * @param {ReturnType<import('./config.js').config>} cfg
 * @param {{ gate: () => any, site: (id: string) => any, onNoticeChange: () => void }} d
 * @param {{ getKey?: Function }} [testing]
 */
export async function admin(request, env, url, cfg, d, testing = {}) {
  const head = request.method === 'HEAD';
  if (!cfg.access) return notFoundPage(head);
  const api = url.pathname.startsWith('/admin/api/');
  let me;
  try {
    me = await verifyAccessJwt(request.headers.get('cf-access-jwt-assertion') || '', { ...cfg.access, getKey: testing.getKey || getKey });
  } catch (e) {
    if (!(e instanceof AccessError)) throw e;
    console.warn('admin access denied:', e.reason); // 까닭만 남기고 토큰·이메일은 남기지 않음
    if (/^jwks_/.test(e.reason)) return deny(api, 503, 'Cloudflare Access 열쇠를 받지 못했어요. 잠시 뒤 다시 해 주세요.');
    return deny(api);
  }
  if (url.pathname === '/admin') return new Response(null, { status: 308, headers: { location: '/admin/', 'cache-control': 'no-store' } });
  if (api) {
    try {
      const why = csrfProblem(request, url.origin);
      if (why) { console.warn('admin csrf blocked:', why); throw new HttpError('unauthorized', '관리 화면에서 보낸 요청이 아니에요. 화면을 새로 고쳐 주세요.', { status: 403 }); }
      return withAdminHeaders(await adminApi(request, url, cfg, d, me));
    } catch (e) {
      if (e instanceof HttpError) return withAdminHeaders(e.toResponse());
      console.error('admin api error', e?.stack || e);
      return withAdminHeaders(json({ error: { code: 'bad_request', message_ko: '서버에서 문제가 생겼어요.' } }, 500));
    }
  }
  const file = FILES[url.pathname];
  if (!file || !env.ASSETS) return notFoundPage(head);
  if (request.method !== 'GET' && !head) return withAdminHeaders(new Response('GET만 받아요.\n', { status: 405, headers: { allow: 'GET, HEAD' } }));
  const res = await env.ASSETS.fetch(new Request(new URL(file, url), { method: request.method }));
  return withAdminHeaders(res);
}

const post = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
async function ok(res) { if (!res.ok) throw await errorFrom(res); return res; }

async function adminApi(request, url, cfg, d, me) {
  const parts = url.pathname.split('/').slice(3); // '/admin/api/…' 뒤
  const [a, b, c] = parts;
  const m = request.method;
  const gate = d.gate();
  const who = me.email;
  const audit = (action, target, detail = '') => gate.fetch('http://gate/audit', post({ who, action, target, detail })).catch((e) => console.error('audit failed', e?.message));

  if (m === 'GET') {
    if (a === 'me' && parts.length === 1) return json({ email: me.email });
    if (a === 'overview' && parts.length === 1) {
      const o = await (await ok(await gate.fetch('http://gate/overview'))).json();
      return json({ ...o, me: me.email });
    }
    if (a === 'sites' && parts.length === 1) return ok(await gate.fetch(`http://gate/sites?q=${encodeURIComponent(url.searchParams.get('q') || '')}`));
    if (a === 'reports' && parts.length === 1) return ok(await gate.fetch('http://gate/reports'));
    if (a === 'notices' && parts.length === 1) return ok(await gate.fetch('http://gate/admin-notices'));
    if (a === 'audit' && parts.length === 1) return ok(await gate.fetch('http://gate/audit'));
    throw new HttpError('not_found', '없는 주소예요.');
  }
  if (m !== 'POST') throw new HttpError('not_found', '없는 주소예요.');
  const body = await readJson(request, 16 * 1024, { optional: true });

  if (a === 'sites' && ID_RE.test(b || '') && parts.length === 3) {
    if (c === 'block') {
      if (typeof body.blocked !== 'boolean') throw new HttpError('bad_request', 'blocked에 true나 false를 넣어 주세요.');
      const reason = String(body.reason || '').slice(0, 500);
      const res = await ok(await d.site(b).fetch('http://site/admin-block', post({ blocked: body.blocked, reason })));
      await audit(body.blocked ? 'site.block' : 'site.unblock', b, reason);
      return res;
    }
    if (c === 'delete') {
      // 되돌릴 수 없는 일: 화면에서 사이트 주소를 한 번 더 받음
      if (body.confirm !== b) throw new HttpError('bad_request', '지울 사이트 주소(10자)를 한 번 더 적어 주세요.');
      await ok(await d.site(b).fetch('http://site/admin-site', { method: 'DELETE' }));
      await audit('site.delete', b, String(body.reason || '').slice(0, 300));
      return json({ ok: true, id: b });
    }
  }
  if (a === 'reports' && /^\d{1,9}$/.test(b || '') && parts.length === 2) {
    return ok(await gate.fetch('http://gate/report-status', post({ n: Number(b), status: body.status, who })));
  }
  if (a === 'notices') {
    let res;
    if (parts.length === 1) res = await gate.fetch('http://gate/notice', post({ ...body, id: undefined, who }));
    else if (/^\d{1,9}$/.test(b || '') && parts.length === 2) res = await gate.fetch('http://gate/notice', post({ ...body, id: Number(b), who }));
    else if (/^\d{1,9}$/.test(b || '') && c === 'off' && parts.length === 3) res = await gate.fetch('http://gate/notice-off', post({ id: Number(b), who }));
    if (res) { await ok(res); d.onNoticeChange(); return res; }
  }
  if (a === 'uploads' && parts.length === 1) return ok(await gate.fetch('http://gate/uploads', post({ paused: body.paused, reason: body.reason, who })));
  throw new HttpError('not_found', '없는 주소예요.');
}
