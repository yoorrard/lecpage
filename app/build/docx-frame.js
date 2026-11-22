// DOCX → 쪽 그림을 그리는 틀 안 코드. vite.config.js(docxFrame)가 docx-preview·snapdom과 함께 한 덩어리 글(전역 lpDocxFrame)로 묶고,
// app/src/lib/render-doc.js가 출처 없는 sandbox 틀(allow-scripts만, srcdoc)에 넣어 돌립니다.
// docx-preview는 문서에 적힌 스타일 이름·글꼴 이름을 그대로 CSS로 넣으므로 앱 화면이 아니라 이 틀 안에서만 그리게 함:
// 교재의 CSS·글이 앱 화면을 바꾸거나 앱 저장소(교재·키)·연결 토큰에 닿지 못함. 부모에는 쪽 그림(Blob)과 진행만 postMessage로 보냄
import { renderAsync } from 'docx-preview';
import { snapdom } from '@zumer/snapdom';

// 화면 밖 틀은 브라우저가 requestAnimationFrame을 멈춰 둘 수 있어(다른 출처 틀) 50ms면 넘어감
const tick = () => new Promise((r) => {
  let done = false; const go = () => { if (!done) { done = true; r(); } };
  try { requestAnimationFrame(() => setTimeout(go, 0)); } catch { /* 없음 */ }
  setTimeout(go, 50);
});
const toBlob = (canvas) => new Promise((ok) => canvas.toBlob((b) => ok(b), 'image/webp', 0.82)); // 사파리는 WebP를 못 만들면 PNG로 돌려줌(형식은 blob.type으로)

/** 캔버스가 한 가지 색인지(드문드문 찍어 봄). render-doc.js의 blank와 같음 */
function blank(canvas) {
  try {
    const w = 24, h = 14; const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(canvas, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data;
    for (let i = 4; i < d.length; i += 4) if (Math.abs(d[i] - d[0]) + Math.abs(d[i + 1] - d[1]) + Math.abs(d[i + 2] - d[2]) > 24) return false;
    return true;
  } catch { return false; }
}

async function shoot(el, scale) {
  const canvas = await snapdom.toCanvas(el, { scale, backgroundColor: '#ffffff', embedFonts: true, fast: true });
  const isBlank = blank(canvas);
  const blob = await toBlob(canvas);
  canvas.width = canvas.height = 0; // 메모리 바로 돌려줌(큰 교재)
  return { blob, isBlank };
}

/**
 * bytes: DOCX(ArrayBuffer), maxPages, send(msg): 부모로 보냄
 * 보내는 것: { type: 'lp-docx-page', page, blob, isBlank } · { type: 'lp-docx-progress', done, total }
 */
export async function run(bytes, { maxPages = 400 } = {}, send) {
  const host = document.body;
  const body = document.createElement('div'); host.appendChild(body);
  await renderAsync(bytes, body, null, { inWrapper: false, breakPages: true, experimental: true, renderHeaders: true, renderFooters: true, renderComments: false, useBase64URL: true });
  await document.fonts?.ready; await tick();
  // 구역(section.docx) 하나가 여러 쪽 길이면 쪽 높이로 자름(docx-preview는 줄 단위로 쪽을 나누지 않음)
  const parts = [];
  for (const sec of body.querySelectorAll('section.docx')) {
    const w = sec.offsetWidth || 794; const pageH = Math.round(w * 1.4142); const h = sec.offsetHeight || pageH;
    const n = Math.max(1, Math.ceil((h - 8) / pageH));
    for (let k = 0; k < n; k++) parts.push({ sec, w, pageH, k, n });
  }
  const total = Math.min(maxPages, parts.length);
  const scale = Math.min(2, 1240 / Math.max(...parts.map((p) => p.w), 600)); // A4 150dpi 너비쯤
  for (let i = 0; i < total; i++) {
    const { sec, w, pageH, k, n } = parts[i];
    let r;
    if (n > 1) { // 창(쪽 높이)을 만들어 구역을 위로 밀어 넣고 그 창만 찍음
      const el = document.createElement('div'); el.style.cssText = `width:${w}px;height:${pageH}px;overflow:hidden;position:relative;background:#fff`;
      const ph = sec.parentNode; const mark = document.createComment(''); ph.insertBefore(mark, sec);
      sec.style.position = 'absolute'; sec.style.left = '0'; sec.style.top = `${-k * pageH}px`; sec.style.margin = '0';
      el.appendChild(sec); host.appendChild(el);
      try { await tick(); r = await shoot(el, scale); }
      finally { ph.insertBefore(sec, mark); mark.remove(); sec.style.position = sec.style.left = sec.style.top = sec.style.margin = ''; el.remove(); }
    } else r = await shoot(sec, scale);
    if (r.blob) send({ type: 'lp-docx-page', page: i + 1, blob: r.blob, isBlank: r.isBlank });
    send({ type: 'lp-docx-progress', done: i + 1, total });
  }
}
