export const uid = (n = 10) => {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  const b = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, (x) => a[x % a.length]).join('');
};
export const fmtBytes = (n) => (n > 1e6 ? (n / 1e6).toFixed(1) + 'MB' : n > 1e3 ? Math.round(n / 1e3) + 'KB' : n + 'B');
export const fmtDate = (t) => (t ? new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
export function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

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
