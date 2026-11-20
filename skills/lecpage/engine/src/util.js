// 엔진 공통 작은 도구: 글 다듬기·안전한 주소·연수 코드. 키트(조립·보조 쪽)·마크다운·앱이 함께 씁니다.

/** 글 칸 다듬기: NFC, 제어 문자 빼기, 앞뒤 빈칸, 길이(넘으면 …) */
export function str(v, max = 1200) {
  if (v === undefined || v === null) return '';
  let s = typeof v === 'string' ? v : (typeof v === 'number' ? String(v) : '');
  s = s.normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** 링크 허용 목록: http(s), mailto, 같은 문서 안 앵커(#...), 상대 경로(assets/...) */
export function safeUrl(v) {
  const s = str(v, 2048);
  if (!s) return '';
  if (/^#[\w\-:.가-힣]*$/.test(s)) return s;
  if (/^(assets|media|slides)\/[\w\-./가-힣%]+$/i.test(s)) return s;
  if (/^mailto:[^\s<>"]+$/i.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
  } catch { /* 아래로 */ }
  if (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(s)) return 'https://' + s; // gemini.google.com 처럼 프로토콜 없이 쓴 경우
  return '';
}

/** 무작위 연수 코드(헷갈리는 글자 제외, 기본 10자 ≈ 50비트). 같은 서버를 여러 연수가 함께 써도 남이 짐작할 수 없게 */
export function randomCode(n = 10) {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const u = new Uint32Array(n);
  (globalThis.crypto || {}).getRandomValues ? globalThis.crypto.getRandomValues(u) : u.forEach((_, i) => { u[i] = Math.floor(Math.random() * 2 ** 32); });
  return Array.from(u, (x) => A[x % A.length]).join('');
}

/** 6자리 참여 코드(헷갈리는 글자 제외). 연수 정보에 코드가 없을 때만 쓰는 예비값(제목·날짜로 정해지므로 짐작될 수 있음) */
export function makeCode(seed = '') {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let h = 2166136261 >>> 0;
  const s = String(seed) + (seed ? '' : Math.random());
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  let out = '';
  for (let i = 0; i < 6; i++) { out += A[h % A.length]; h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0; }
  return out;
}
