// 관리 화면 들어오기: Cloudflare Access가 앞에서 운영자 이메일을 확인하고, Worker가 Access가 붙여 준 토큰(JWT)을 한 번 더 확인합니다.
//  - 머리글 Cf-Access-Jwt-Assertion(RS256). 열쇠는 https://<팀>.cloudflareaccess.com/cdn-cgi/access/certs 에서 받아 1시간 둠
//  - iss = 팀 주소, aud = ACCESS_AUD, exp·nbf·iat는 1분 여유로, email이 있어야 함(서비스 토큰은 받지 않음)
// Access를 거치지 않은 요청(머리글을 지어낸 것)은 서명이 맞지 않아 막힙니다. WebCrypto만 써서 Worker와 Node(시험)에서 같이 돕니다.

export class AccessError extends Error {
  /** @param {string} reason 시험·기록용 짧은 까닭(토큰 내용은 담지 않음) */
  constructor(reason) { super(`access: ${reason}`); this.reason = reason; }
}

const te = new TextEncoder();
function b64urlBytes(s) {
  if (typeof s !== 'string' || !/^[A-Za-z0-9_-]*$/.test(s)) throw new AccessError('malformed');
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
}
function b64urlJson(s) {
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(b64urlBytes(s))); } catch { throw new AccessError('malformed'); }
}

/**
 * @param {string} token Cf-Access-Jwt-Assertion 값
 * @param {{ team: string, aud: string[], emails?: Set<string>, getKey: (team: string, kid: string) => Promise<CryptoKey|null>, now?: number, skewSec?: number }} o
 * @returns {Promise<{ email: string, sub: string }>}
 */
export async function verifyAccessJwt(token, { team, aud, emails, getKey, now = Date.now(), skewSec = 60 }) {
  if (!team || !aud?.length) throw new AccessError('not_configured');
  if (typeof token !== 'string' || !token || token.length > 8192) throw new AccessError('missing');
  const parts = token.split('.');
  if (parts.length !== 3) throw new AccessError('malformed');
  const header = b64urlJson(parts[0]);
  const payload = b64urlJson(parts[1]);
  if (!header || header.alg !== 'RS256') throw new AccessError('alg');
  if (typeof header.kid !== 'string' || !header.kid || header.kid.length > 200) throw new AccessError('kid');
  const key = await getKey(team, header.kid);
  if (!key) throw new AccessError('kid');
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(parts[2]), te.encode(`${parts[0]}.${parts[1]}`));
  if (!ok) throw new AccessError('signature');
  if (!payload || typeof payload !== 'object') throw new AccessError('malformed');
  if (payload.iss !== team) throw new AccessError('iss');
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.some((a) => typeof a === 'string' && aud.includes(a))) throw new AccessError('aud');
  const t = now / 1000;
  if (!Number.isFinite(payload.exp) || payload.exp <= t - skewSec) throw new AccessError('expired');
  if (payload.nbf !== undefined && (!Number.isFinite(payload.nbf) || payload.nbf > t + skewSec)) throw new AccessError('not_yet');
  if (payload.iat !== undefined && (!Number.isFinite(payload.iat) || payload.iat > t + skewSec)) throw new AccessError('not_yet');
  if (payload.type !== undefined && payload.type !== 'app') throw new AccessError('type');
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  if (!email || !email.includes('@') || email.length > 254) throw new AccessError('no_email');
  if (emails?.size && !emails.has(email)) throw new AccessError('email');
  return { email, sub: typeof payload.sub === 'string' ? payload.sub.slice(0, 100) : '' };
}

/**
 * 팀의 공개 열쇠 목록(JWKS)을 받아 두고 kid로 찾는 함수를 만듦. 모르는 kid면(열쇠 교체) 1분에 한 번까지만 다시 받음.
 * @param {{ fetch?: typeof fetch, ttlMs?: number, now?: () => number }} [o]
 */
export function jwksCache({ fetch: f = (...a) => fetch(...a), ttlMs = 3600e3, now = () => Date.now() } = {}) {
  const cache = new Map(); // team → { at, keys: Map<kid, CryptoKey> }
  const loading = new Map();
  async function load(team) {
    const res = await f(`${team}/cdn-cgi/access/certs`, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new AccessError('jwks_http');
    const j = await res.json();
    const keys = new Map();
    for (const k of Array.isArray(j?.keys) ? j.keys : []) {
      if (!k || k.kty !== 'RSA' || typeof k.kid !== 'string' || typeof k.n !== 'string' || typeof k.e !== 'string') continue;
      if (k.alg && k.alg !== 'RS256') continue;
      if (k.use && k.use !== 'sig') continue;
      try { keys.set(k.kid, await crypto.subtle.importKey('jwk', { kty: 'RSA', n: k.n, e: k.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])); } catch { /* 깨진 열쇠는 건너뜀 */ }
    }
    if (!keys.size) throw new AccessError('jwks_empty');
    return { at: now(), keys };
  }
  return async function getKey(team, kid) {
    let e = cache.get(team);
    const stale = !e || now() - e.at > ttlMs;
    const miss = e && !e.keys.has(kid) && now() - e.at > 60e3;
    if (stale || miss) {
      let p = loading.get(team);
      if (!p) { p = load(team).finally(() => loading.delete(team)); loading.set(team, p); }
      try { e = await p; cache.set(team, e); } catch (err) { if (!e) throw err; /* 받아 둔 열쇠로 계속 */ }
    }
    return e.keys.get(kid) || null;
  };
}

/**
 * 관리 화면 API의 CSRF 막기. 모든 요청: 우리 머리글(x-lecpage-admin: 1)이 있어야 함 — 다른 사이트는 이 머리글을 붙이려면
 * 사전 확인(preflight)을 거쳐야 하는데 관리 API는 CORS를 열지 않으므로 보낼 수 없음. 상태를 바꾸는 요청은 더해서
 * Origin이 이 호스트와 같고(Sec-Fetch-Site가 있으면 same-origin), 본문은 JSON.
 * @returns {string} 막는 까닭, 괜찮으면 ''
 */
export function csrfProblem(request, selfOrigin) {
  const h = request.headers;
  if (h.get('x-lecpage-admin') !== '1') return 'header';
  const site = h.get('sec-fetch-site');
  if (site && site !== 'same-origin') return 'fetch_site';
  if (request.method === 'GET' || request.method === 'HEAD') return '';
  if (h.get('origin') !== selfOrigin) return 'origin';
  if (request.method !== 'DELETE' && !/^application\/json(\s*;|$)/i.test(h.get('content-type') || '')) return 'content_type';
  return '';
}

/** 관리 화면(HTML·JS·CSS·JSON)에 붙이는 머리글: 인라인 스크립트 없음, 틀에 못 넣음, 저장 안 함 */
export const ADMIN_CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; require-trusted-types-for 'script'";
export const ADMIN_HEADERS = {
  'content-security-policy': ADMIN_CSP,
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cache-control': 'no-store',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'x-robots-tag': 'noindex, nofollow',
};
