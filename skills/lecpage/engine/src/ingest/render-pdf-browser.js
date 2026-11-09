// 브라우저에서 PDF 쪽을 그림으로(교재 뷰어용). 서버로 올리지 않고 사용자의 기기에서만 그립니다.
//   const shots = await renderPdfPages(bytes, { scale: 1.5, type: 'image/webp', quality: 0.82 });
//   shots → [{ page, blob, width, height, type }]
// pdfjsLib: opts.pdfjsLib 또는 globalThis.pdfjsLib(앱이 jsDelivr 버전 고정 URL로 불러 둠, workerSrc 설정 포함).
// 사파리처럼 webp 인코딩을 못 하면 PNG(또는 JPEG)로 저장되며, 결과의 type에 실제 형식이 들어 있습니다.

/**
 * @param {Uint8Array|ArrayBuffer|Blob} bytes PDF
 * @param {object} [opts]
 * @param {number} [opts.scale=1.5]      확대 배율(1 = 72dpi). maxWidth가 있으면 그 폭을 넘지 않게 줄임
 * @param {number} [opts.maxWidth=1600]  그림 최대 폭(px)
 * @param {string} [opts.type='image/webp']
 * @param {number} [opts.quality=0.82]
 * @param {number[]} [opts.pages]        그릴 쪽(1부터). 없으면 전부
 * @param {number} [opts.maxPages=400]
 * @param {(done:number,total:number)=>void} [opts.onProgress]
 * @param {AbortSignal} [opts.signal]
 * @param {object} [opts.pdfjsLib]
 * @param {string} [opts.cMapUrl]  한글 CID 글꼴용 CMap 주소(예: https://cdn.jsdelivr.net/npm/pdfjs-dist@<버전>/cmaps/)
 * @returns {Promise<Array<{page:number, blob:Blob, width:number, height:number, type:string}>>}
 */
export async function renderPdfPages(bytes, opts = {}) {
  const lib = opts.pdfjsLib || globalThis.pdfjsLib;
  if (!lib || typeof lib.getDocument !== 'function') {
    const e = new Error('needs-pdfjs');
    e.code = 'needs-pdfjs';
    e.message_ko = 'PDF를 그리는 도구(pdf.js)를 불러오지 못했어요. 새로 고침한 뒤 다시 해 주세요.';
    throw e;
  }
  const { scale = 1.5, maxWidth = 1600, type = 'image/webp', quality = 0.82, maxPages = 400, onProgress, signal } = opts;
  let data = bytes;
  if (data && typeof data.arrayBuffer === 'function' && !(data instanceof Uint8Array)) data = new Uint8Array(await data.arrayBuffer());
  else if (data instanceof ArrayBuffer) data = new Uint8Array(data);
  const params = { data: new Uint8Array(data), isEvalSupported: false, cMapPacked: true };
  if (opts.cMapUrl) params.cMapUrl = opts.cMapUrl;
  if (opts.standardFontDataUrl) params.standardFontDataUrl = opts.standardFontDataUrl;
  const doc = await lib.getDocument(params).promise;
  const list = (opts.pages && opts.pages.length ? opts.pages : Array.from({ length: doc.numPages }, (_, i) => i + 1))
    .filter((n) => n >= 1 && n <= doc.numPages).slice(0, maxPages);
  const out = [];
  try {
    for (let i = 0; i < list.length; i++) {
      if (signal?.aborted) break;
      const page = await doc.getPage(list[i]);
      const base = page.getViewport({ scale: 1 });
      const s = Math.min(scale, maxWidth / base.width);
      const vp = page.getViewport({ scale: s });
      const w = Math.ceil(vp.width), h = Math.ceil(vp.height);
      const canvas = makeCanvas(w, h);
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const blob = await toBlob(canvas, type, quality);
      out.push({ page: list[i], blob, width: w, height: h, type: blob.type || type });
      page.cleanup();
      if (canvas.width) { canvas.width = 0; canvas.height = 0; } // 메모리 반환
      onProgress?.(i + 1, list.length);
    }
  } finally {
    try { await doc.destroy(); } catch { /* 무시 */ }
  }
  return out;
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

async function toBlob(canvas, type, quality) {
  if (typeof canvas.convertToBlob === 'function') {
    try {
      const b = await canvas.convertToBlob({ type, quality });
      if (b && b.type === type) return b;
    } catch { /* 아래로 */ }
    return canvas.convertToBlob({ type: 'image/png' });
  }
  const b = await new Promise((res) => canvas.toBlob(res, type, quality));
  if (b && b.type === type) return b;
  return new Promise((res) => canvas.toBlob(res, 'image/png'));
}

/** 그림 파일 이름: slide-001.webp */
export function slideFileName(page, type = 'image/webp') {
  const ext = type === 'image/png' ? 'png' : type === 'image/jpeg' ? 'jpg' : 'webp';
  return `slide-${String(page).padStart(3, '0')}.${ext}`;
}
