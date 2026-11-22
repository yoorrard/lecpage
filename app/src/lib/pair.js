// PC 프로그램과 짝 맞추기(첫 화면 묶음에 들어가므로 가져오는 것 없이). gen/local.js가 씀
// PC 프로그램이 켜며 https://lecpage.com/#pair=<토큰>&port=<포트>를 엶 → 이 브라우저에 기억하고 주소에서 바로 지움
// 쓰던 짝(커넥트가 그 토큰에 답한 적 있음, ok)은 다른 토큰으로 바로 덮지 않음: 아무 사이트나 #pair=<가짜>로 짝을 덮어 연결을 끊지 못하게
// 그 포트의 커넥트가 새 토큰에 답할 때만 바꿈(gen/local.js checkPairing)
export const PAIR = 'lecpage:pc';
/** 이 브라우저에 기억한 짝(lecpage.com에서 PC 프로그램과) → { token, port, ok } | null. ok: 커넥트가 이 토큰에 답한 적 있음 */
export function pairing() {
  try { const j = JSON.parse(localStorage.getItem(PAIR) || 'null'); return j && /^[0-9a-f]{64}$/.test(j.token) && j.port >= 1024 && j.port <= 65535 ? { token: j.token, port: +j.port, ok: j.ok === true } : null; } catch { return null; }
}
function save(p) { localStorage.setItem(PAIR, JSON.stringify({ token: p.token, port: +p.port, ok: !!p.ok, at: Date.now() })); }
let pending = null;
/**
 * 주소의 #pair=<토큰>&port=<포트>를 읽고 주소에서 바로 지움(방문 기록에 남지 않게). 앱이 처음 그리기 전에 부름
 * → ''(없음) | 'saved'(기억함: 짝이 없었거나 아직 답한 적 없는 짝이거나 같은 토큰) | 'check'(쓰던 짝과 다른 토큰: 확인한 뒤에만 바꿈, pendingPairing)
 */
export function capturePairing() {
  try {
    const m = /^#pair=([0-9a-f]{64})&port=(\d{4,5})$/.exec(location.hash || '');
    if (!m) return '';
    history.replaceState(null, '', location.pathname + location.search + '#/');
    const token = m[1]; const port = +m[2];
    if (!(port >= 1024 && port <= 65535)) return '';
    const cur = pairing();
    if (cur?.ok && cur.token !== token) { pending = { token, port }; return 'check'; }
    save({ token, port, ok: !!cur?.ok && cur.token === token });
    sessionStorage.setItem('lecpage:paired', '1');
    return 'saved';
  } catch { return ''; }
}
/** 확인을 기다리는 새 짝(capturePairing이 'check') → { token, port } | null */
export function pendingPairing() { return pending; }
/** 커넥트가 새 토큰에 답함 → 그 짝으로 바꿈 */
export function acceptPairing(p) {
  if (pending === p) pending = null;
  try { save({ ...p, ok: true }); sessionStorage.setItem('lecpage:paired', '1'); return true; } catch { return false; }
}
/** 커넥트가 이 토큰에 답함 → 쓰던 짝으로 표시(이제 다른 토큰으로 덮으려면 확인이 필요) */
export function confirmPairing(token) {
  const p = pairing(); if (!p || p.ok || p.token !== token) return;
  try { save({ ...p, ok: true }); } catch { /* 저장 못 하면 다음에 */ }
}
/** lecpage 커넥트가 켜지는 포트(scripts/studio.mjs PORT_RANGE의 앞쪽). 기억한 포트에 없을 때 살펴봄 */
export const PC_PORTS = Array.from({ length: 10 }, (_, i) => 6600 + i);
/** 같은 짝(토큰)인데 포트만 바뀜. token: 그 포트에서 답한 토큰(그사이 짝이 바뀌었으면 옮기지 않음) */
export function movePairing(port, token) {
  const p = pairing(); if (!p || (token && p.token !== token) || !(port >= 1024 && port <= 65535)) return;
  try { save({ ...p, port: +port, ok: p.ok || !!token }); } catch { /* 저장 못 하면 이번만 */ }
}
export function forgetPairing() { pending = null; try { localStorage.removeItem(PAIR); } catch { /* 없음 */ } }
/** 방금(이 탭에서) 짝을 맞췄는지 → 화면이 'PC 프로그램과 연결했어요'·권한 안내를 한 번 보여 줌 */
export function justPaired() { try { const v = sessionStorage.getItem('lecpage:paired') === '1'; sessionStorage.removeItem('lecpage:paired'); return v; } catch { return false; } }
