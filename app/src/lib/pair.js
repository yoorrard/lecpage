// PC 프로그램과 짝 맞추기(첫 화면 묶음에 들어가므로 가져오는 것 없이). gen/local.js가 씀
// PC 프로그램이 켜며 https://lecpage.com/#pair=<토큰>&port=<포트>를 엶 → 이 브라우저에 기억하고 주소에서 바로 지움
export const PAIR = 'lecpage:pc';
/** 이 브라우저에 기억한 짝(lecpage.com에서 PC 프로그램과) → { token, port } | null */
export function pairing() {
  try { const j = JSON.parse(localStorage.getItem(PAIR) || 'null'); return j && /^[0-9a-f]{64}$/.test(j.token) && j.port >= 1024 && j.port <= 65535 ? { token: j.token, port: +j.port } : null; } catch { return null; }
}
/** 주소의 #pair=<토큰>&port=<포트>를 읽어 기억하고 주소에서 바로 지움(방문 기록에 남지 않게). 앱이 처음 그리기 전에 부름 */
export function capturePairing() {
  try {
    const m = /^#pair=([0-9a-f]{64})&port=(\d{4,5})$/.exec(location.hash || '');
    if (!m) return false;
    history.replaceState(null, '', location.pathname + location.search + '#/');
    if (!(+m[2] >= 1024 && +m[2] <= 65535)) return false;
    localStorage.setItem(PAIR, JSON.stringify({ token: m[1], port: +m[2], at: Date.now() }));
    sessionStorage.setItem('lecpage:paired', '1');
    return true;
  } catch { return false; }
}
/** lecpage 커넥트가 켜지는 포트(scripts/studio.mjs PORT_RANGE의 앞쪽). 기억한 포트에 없을 때 살펴봄 */
export const PC_PORTS = Array.from({ length: 10 }, (_, i) => 6600 + i);
/** 같은 짝(토큰)인데 포트만 바뀜 */
export function movePairing(port) {
  const p = pairing(); if (!p || !(port >= 1024 && port <= 65535)) return;
  try { localStorage.setItem(PAIR, JSON.stringify({ token: p.token, port: +port, at: Date.now() })); } catch { /* 저장 못 하면 이번만 */ }
}
export function forgetPairing() { try { localStorage.removeItem(PAIR); } catch { /* 없음 */ } }
/** 방금(이 탭에서) 짝을 맞췄는지 → 화면이 'PC 프로그램과 연결했어요'·권한 안내를 한 번 보여 줌 */
export function justPaired() { try { const v = sessionStorage.getItem('lecpage:paired') === '1'; sessionStorage.removeItem('lecpage:paired'); return v; } catch { return false; } }
