export const uid = (n = 10) => {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  const b = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, (x) => a[x % a.length]).join('');
};
export const fmtBytes = (n) => (n >= 1e9 ? (n / 1e9).toFixed(1) + 'GB' : n > 1e6 ? (n / 1e6).toFixed(1) + 'MB' : n > 1e3 ? Math.round(n / 1e3) + 'KB' : n + 'B');
export const fmtDate = (t) => (t ? new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
/** 시각(밀리초) → 한국 시각을 사람이 읽기 쉽게: '오늘 오전 9시', '내일 오전 9시', '11월 14일 오후 3시 5분'. 분은 올림. day: false면 날은 뺌 */
export function koTime(t, { now = Date.now(), day = true } = {}) {
  const k = (x) => new Date(Math.ceil(x / 60000) * 60000 + 9 * 3600e3); // UTC 값으로 한국 시각을 읽음(기기 시간대와 상관없이)
  const d = k(t); const n = k(now);
  const h = d.getUTCHours(); const m = d.getUTCMinutes();
  const time = `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시${m ? ` ${m}분` : ''}`;
  if (!day) return time;
  const gap = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())) / 864e5);
  return `${gap === 0 ? '오늘' : gap === 1 ? '내일' : `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`} ${time}`;
}
/** 마지막 부름만 ms 뒤에 실행. .flush()는 기다리는 것을 바로 실행(탭을 닫거나 화면을 떠날 때) */
export function debounce(fn, ms) {
  let t = 0; let last = null;
  const d = (...a) => { last = a; clearTimeout(t); t = setTimeout(() => { t = 0; fn(...a); }, ms); };
  d.flush = () => { if (!t) return; clearTimeout(t); t = 0; fn(...last); };
  return d;
}

// 토스트(앱 전체에서 하나)
const listeners = new Set();
export function toast(msg) { listeners.forEach((l) => l(msg)); }
export function onToast(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export async function copy(text, ok = '복사했어요.') {
  try { await navigator.clipboard.writeText(text); toast(ok); return true; } catch { toast('복사하지 못했어요. 직접 선택해 복사해 주세요.'); return false; }
}

export function saveFile(name, data, type = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function randomKey(len = 20) {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(len)), (x) => a[x % a.length]).join('').replace(/(.{5})(?=.)/g, '$1-');
}
export async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}
export const safeName = (s) => String(s || 'lecpage').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60);
