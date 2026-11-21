// 교재를 PDF로 바꾸기: lecpage 커넥트가 켜져 있으면 이 PC에 깔린 PowerPoint·한글·Keynote·Word·LibreOffice로(가장 정확).
// 짝이 없거나 꺼져 있거나 바꿀 프로그램이 없으면 null → 앱은 브라우저 안 그리기(render-doc.js)나 글자만으로.
// 경로: GET·POST /bridge/convert (skills/lecpage/scripts/studio-convert.mjs)
import { bridgeAvailable, bridgeRaw, bridgeSameOrigin, lnaPermission } from './gen/local.js';

export const CONVERTIBLE = new Set(['pptx', 'ppt', 'ppsx', 'pps', 'pptm', 'potx', 'odp', 'key', 'docx', 'doc', 'docm', 'odt', 'rtf', 'hwp', 'hwpx']);
const extOf = (name) => (String(name || '').split('.').pop() || '').toLowerCase();

let known = null; // { at, exts }
/** 커넥트가 바꿀 수 있는 형식 → { pptx: ['powerpoint', …], … } | null(커넥트 없음·꺼짐) */
export async function connectConverters() {
  if (!bridgeAvailable()) return null;
  if (known && Date.now() - known.at < 60000) return known.exts;
  // 교재를 넣는 중에 브라우저가 '로컬 네트워크 접근'을 새로 묻지 않게: 이미 허락한 경우만(이 화면이 이 PC 주소면 묻지 않음)
  if (!bridgeSameOrigin()) {
    const p = await lnaPermission();
    const local = /^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname);
    if (p === 'denied' || (p === 'prompt' && !local)) return null;
  }
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
  try {
    const r = await bridgeRaw('/bridge/convert', { signal: ctl.signal });
    if (!r.ok) return null; // 예전 커넥트(이 경로 없음)
    const j = await r.json();
    known = { at: Date.now(), exts: j.exts || {} };
    return known.exts;
  } catch { return null; } finally { clearTimeout(t); }
}

const fromB64 = (s) => { const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };

/**
 * → { ok:true, pdf: Uint8Array, via, app } | { ok:false, message_ko } | null(커넥트가 없거나 이 형식을 바꿀 프로그램이 없음)
 */
export async function convertWithConnect(name, bytes, { signal } = {}) {
  const ext = extOf(name);
  if (!CONVERTIBLE.has(ext)) return null;
  const exts = await connectConverters();
  if (!exts?.[ext]?.length) return null;
  try {
    const r = await bridgeRaw('/bridge/convert?name=' + encodeURIComponent(name), { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: bytes, signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok || typeof j.pdf !== 'string') return { ok: false, message_ko: j.message_ko || '' };
    return { ok: true, pdf: fromB64(j.pdf), via: j.via || '', app: j.app || '' };
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    return null;
  }
}
