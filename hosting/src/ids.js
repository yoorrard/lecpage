// 사이트 주소(id)와 수정 열쇠(key). WebCrypto만 써서 Worker와 Node(테스트)에서 같이 돕니다.

/** Crockford base32 소문자: 헷갈리는 i·l·o·u가 없음 */
export const ID_ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';
export const ID_LENGTH = 10;
export const ID_RE = /^[0-9a-hjkmnp-tv-z]{10}$/;
export const SHA256_RE = /^[0-9a-f]{64}$/;
export const DEPLOY_RE = /^[0-9a-hjkmnp-tv-z]{16}$/;

function randomBase32(len) {
  const r = crypto.getRandomValues(new Uint8Array(len));
  let s = '';
  for (let i = 0; i < len; i++) s += ID_ALPHABET[r[i] & 31]; // 256은 32의 배수라 치우침 없음
  return s;
}
/** 사이트 id: 10자(50비트) */
export const newId = () => randomBase32(ID_LENGTH);
/** 배포 id: 16자. 뜻 없는 값 */
export const newDeployId = () => randomBase32(16);

export function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
/** 수정 열쇠: 무작위 32바이트(base64url 43자). 서버에는 SHA-256만 남김 */
export const newKey = () => b64url(crypto.getRandomValues(new Uint8Array(32)));

export function hex(buf) {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of u) s += (b < 16 ? '0' : '') + b.toString(16);
  return s;
}
export async function sha256Hex(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return hex(await crypto.subtle.digest('SHA-256', bytes));
}

/** 길이가 같은 두 글자열을 걸리는 시간이 내용에 좌우되지 않게 비교 */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Authorization: Bearer <값> → 값(없으면 '') */
export function bearer(header) {
  const m = /^Bearer\s+([A-Za-z0-9._~+/=-]{1,512})\s*$/i.exec(String(header || ''));
  return m ? m[1] : '';
}
/** 받은 열쇠가 저장해 둔 해시와 맞는지. 둘 다 SHA-256 16진수로 바꾼 뒤 비교해 길이·내용이 새지 않음 */
export async function keyMatches(given, storedHash) {
  if (!given || !storedHash) return false;
  return safeEqual(await sha256Hex(given), storedHash);
}
/** 비밀 값끼리 비교(관리자 열쇠). 해시끼리 비교 */
export async function secretMatches(given, secret) {
  if (!given || !secret) return false;
  const [a, b] = await Promise.all([sha256Hex(given), sha256Hex(secret)]);
  return safeEqual(a, b);
}

/** 속도 제한용 주소 묶음: IPv4는 그대로, IPv6는 앞 64비트(한 가입자가 /64를 통째로 씀) */
export function ipBucket(ip) {
  const s = String(ip || '').trim().toLowerCase();
  if (!s) return 'unknown';
  if (!s.includes(':')) return s;
  const [head, tail = ''] = s.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const full = s.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  return full.slice(0, 4).map((x) => x.replace(/^0+(?=.)/, '')).join(':') + '::/64';
}
