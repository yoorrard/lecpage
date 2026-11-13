// 관리 Worker(lecpage-admin): 운영자 관리 화면만 내보내는 작은 Worker. 바로 배포 Worker(lecpage-sites)의 Durable Object(Gate·Site)에
// script_name으로 묶여 같은 자료를 봅니다(wrangler.admin.jsonc).
//  - 도메인 없이: 이 Worker의 workers.dev 주소 전체를 Cloudflare Access(Worker 단위 앱)가 지킴. 설정 스크립트가 API로 켬(scripts/setup.mjs)
//  - 여기서 한 번 더 확인: ACCESS_TEAM_DOMAIN이 있으면 Access 토큰(JWT) 서명·AUD·만료를 확인(access.js),
//    없으면 ctx.access(Access가 인증한 요청에만 있음)의 AUD와 이메일을 확인. 이메일(ACCESS_EMAILS, 비밀 값)이 맞아야 함
//  - Access 설정이 없으면 모든 주소가 404(닫힌 채로 시작)
//  - 정적 자산을 쓰지 않음(정적 자산이 있으면 ctx.access가 오지 않음). 화면 파일은 src/admin-ui.js(배포할 때 만듦)
import { config } from './config.js';
import { admin } from './admin.js';
import { AccessError, verifyAccessJwt, jwksCache } from './access.js';
import { notFoundPage } from './pages.js';
import { ADMIN_UI } from './admin-ui.js';

const getKey = jwksCache();
let cfgCache = null;

/** 관리 Worker의 Access 설정: JWT(팀 도메인+AUD) 또는 ctx.access(AUD+이메일). 둘 다 아니면 null(닫힘) */
export function adminAccess(env) {
  const cfg = config(env);
  if (cfg.access) return { mode: 'jwt', cfg };
  const aud = String(env.ACCESS_AUD ?? '').split(',').map((s) => s.trim()).filter((s) => /^[A-Za-z0-9]{16,128}$/.test(s));
  const emails = new Set(String(env.ACCESS_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter((s) => s.includes('@')));
  if (!aud.length || !emails.size) return null;
  return { mode: 'ctx', cfg: { ...cfg, access: { team: '', aud, emails } } };
}

/** ctx.access로 확인. AUD가 맞고, 이메일이 ACCESS_EMAILS 안이어야 함 */
export async function verifyCtxAccess(ctx, access) {
  const a = ctx?.access;
  if (!a) throw new AccessError('missing');
  if (a.aud && !access.aud.includes(a.aud)) throw new AccessError('aud');
  let id = null;
  try { id = typeof a.getIdentity === 'function' ? await a.getIdentity() : null; } catch { throw new AccessError('identity'); }
  const email = typeof id?.email === 'string' ? id.email.trim().toLowerCase() : '';
  if (!email || !email.includes('@')) throw new AccessError('no_email');
  if (!access.emails.has(email)) throw new AccessError('email');
  return { email, sub: '' };
}

export function asset(path, method) {
  const f = ADMIN_UI[path];
  if (!f) return null;
  return new Response(method === 'HEAD' ? null : f[1], { status: 200, headers: { 'content-type': f[0] } });
}

export default {
  async fetch(request, env, ctx, testing = {}) {
    const url = new URL(request.url);
    if (!cfgCache || cfgCache.env !== env) cfgCache = { env, a: adminAccess(env) };
    const a = cfgCache.a;
    const head = request.method === 'HEAD';
    if (!a) return notFoundPage(head);
    if (url.protocol === 'http:' && !/^(localhost|127\.0\.0\.1)$/.test(url.hostname)) { url.protocol = 'https:'; return Response.redirect(url.href, 308); }
    if (url.pathname === '/' || url.pathname === '') return new Response(null, { status: 308, headers: { location: '/admin/', 'cache-control': 'no-store' } });
    if (url.pathname !== '/admin' && !url.pathname.startsWith('/admin/')) return notFoundPage(head);
    const verify = a.mode === 'ctx'
      ? (req) => verifyCtxAccess(ctx, a.cfg.access)
      : (req) => verifyAccessJwt(req.headers.get('cf-access-jwt-assertion') || '', { ...a.cfg.access, getKey: testing.getKey || getKey }).then(async (me) => {
        // JWT로 확인한 뒤에도 ctx.access가 있으면 같은 사람인지 봄
        if (ctx?.access && typeof ctx.access.getIdentity === 'function') {
          const id = await ctx.access.getIdentity().catch(() => null);
          if (id?.email && id.email.trim().toLowerCase() !== me.email) throw new AccessError('mismatch');
        }
        return me;
      });
    const res = await admin(request, env, url, a.cfg, {
      gate: () => env.GATE.get(env.GATE.idFromName('gate')),
      site: (id) => env.SITE.get(env.SITE.idFromName(id)),
      onNoticeChange: () => { }, // 바로 배포 Worker의 공지 캐시는 1분 뒤 저절로 바뀜
      verify, asset,
    });
    if (url.protocol !== 'https:') return res;
    const out = new Response(res.body, res);
    out.headers.set('strict-transport-security', 'max-age=31536000');
    return out;
  },
};
