// 익명 이용 합계: 바로 공개 서버(운영자)가 켜져 있을 때만, 하루 단위 숫자를 하나 더하라고 알립니다.
// 보내는 것은 { e: 무슨 일, k: 갈래 } 뿐입니다. 식별자·쿠키·교재 내용·주소·키는 보내지 않고, 서버도 IP를 남기지 않습니다.
// 설정에서 끌 수 있고, 브라우저의 '추적 안 함'(DNT·GPC)을 켰으면 보내지 않습니다. 근거: docs/legal/privacy.md 9-1
const API = String(import.meta.env?.VITE_PUBLISH_API || '').replace(/\/+$/, '');
const OFF_KEY = 'lecpage:stats-off';
const OPEN_KEY = 'lecpage:stats-open-day';
/** 개인정보 처리방침에 알린 뒤 7일이 지난 날부터 보냄 */
const FROM = Date.parse('2026-11-20T00:00:00+09:00');

export const statsAvailable = () => !!API;
export function statsOff() { try { return localStorage.getItem(OFF_KEY) === '1'; } catch { return false; } }
export function setStatsOff(off) { try { if (off) localStorage.setItem(OFF_KEY, '1'); else localStorage.removeItem(OFF_KEY); } catch { /* 저장소를 못 쓰면 보내지 않음과 같음 */ } }
function blocked() {
  if (!API || Date.now() < FROM || statsOff()) return true;
  const n = typeof navigator === 'undefined' ? null : navigator;
  return !n || !n.sendBeacon || n.globalPrivacyControl === true || n.doNotTrack === '1' || (typeof window !== 'undefined' && window.doNotTrack === '1');
}

/**
 * @param {'open'|'make'|'publish'} e
 * @param {string} [k] make: 'key'|'chat', publish: 'instant'|'vercel'|'github'|'netlify'
 */
export function track(e, k = '') {
  try {
    if (blocked()) return;
    navigator.sendBeacon(`${API}/api/stats`, JSON.stringify(k ? { e, k } : { e })); // 글자 본문(text/plain)이라 사전 확인 요청이 없음
  } catch { /* 합계는 빠져도 됨 */ }
}

/** 앱 열기: 하루에 한 번만(날짜는 이 브라우저에만 적어 둠) */
export function trackOpenOncePerDay() {
  if (blocked()) return;
  const today = new Date().toISOString().slice(0, 10); // 서버의 하루(UTC, 한국 시간 오전 9시에 바뀜)와 맞춤
  try { if (localStorage.getItem(OPEN_KEY) === today) return; localStorage.setItem(OPEN_KEY, today); } catch { return; }
  track('open');
}
