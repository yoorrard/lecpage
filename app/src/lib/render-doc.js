// 브라우저 안에서 PPTX·DOCX·한글(HWP·HWPX) → 쪽 그림(WebP, 긴 변 1,600px). lecpage 커넥트(이 PC의 PowerPoint 등으로 PDF)가 없을 때 씀.
// - PPTX: @aiden0z/pptx-renderer(Apache-2.0)가 슬라이드를 HTML·SVG로 그림 → @zumer/snapdom(MIT)이 캔버스로 옮김
// - DOCX: docx-preview(Apache-2.0)가 쪽(구역)을 그림 → 쪽 높이로 잘라 옮김
// - HWP·HWPX: @rhwp/core(MIT, Rust+WebAssembly)가 쪽마다 캔버스에 바로 그림
// 실측(2026-11, Chromium·Firefox): 색 배경·도형·사진·표·차트·그라데이션이 LibreOffice로 바꾼 PDF와 거의 같음(r100/doc-render).
// 한글은 정부 보도자료 4건(HWP 2·HWPX 3, 표·사진·색 상자·2~11쪽)을 한컴이 만든 PDF와 견줘 쪽 수·줄바꿈·표·그림이 같음(r100/hwp).
// 그림이 모두 한 가지 색이면(브라우저가 그리지 못함) []를 돌려줌 → 앱은 글자만 보내고 'PDF로 저장해 올리면 더 정확해요'를 보여 줌
import { snapdom } from '@zumer/snapdom';
import { version as RHWP_VER } from '@rhwp/core/package.json';

const MAX_W = 1600;
const extOf = (name) => (String(name || '').split('.').pop() || '').toLowerCase();
export const RENDERABLE = new Set(['pptx', 'ppsx', 'potx', 'pptm', 'docx', 'docm', 'hwp', 'hwpx']);
export const canRenderDoc = (name) => RENDERABLE.has(extOf(name));

/** 화면 밖 무대(그려야 캔버스로 옮길 수 있어 display:none은 안 됨) */
function stage() {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  // 글꼴을 적지 않은 글은 PowerPoint·Word의 기본 한글 글꼴처럼(앱 글꼴이 섞이지 않게)
  el.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;background:#fff;z-index:-1;color:#000;font-family:"Malgun Gothic","맑은 고딕","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
  document.body.appendChild(el);
  return el;
}
const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const toBlob = (canvas) => new Promise((ok) => canvas.toBlob((b) => ok(b), 'image/webp', 0.82)); // 사파리는 WebP를 못 만들면 PNG로 돌려줌(형식은 blob.type으로)

/** 캔버스가 한 가지 색인지(드문드문 찍어 봄) */
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
 * @returns {Promise<{ page:number, blob:Blob, type:string }[]>} 그린 쪽 그림(못 그리면 [])
 * onProgress(done, total) · signal: [중지]를 누르면 그때까지 그린 쪽만
 */
export async function renderDocPages(name, bytes, { onProgress, signal, maxPages = 400 } = {}) {
  const ext = extOf(name);
  if (!RENDERABLE.has(ext) || typeof document === 'undefined') return [];
  const host = stage();
  try {
    const draw = /^p/.test(ext) ? pptxPages : /^hw/.test(ext) ? hwpPages : docxPages;
    const shots = await draw(bytes, host, { onProgress, signal, maxPages });
    if (shots.length && shots.every((s) => s.isBlank)) return [];
    return shots.map(({ page, blob }) => ({ page, blob, type: blob.type || 'image/png' }));
  } catch (e) {
    console.warn('[render-doc]', e);
    return [];
  } finally { host.remove(); }
}

async function pptxPages(bytes, host, { onProgress, signal, maxPages }) {
  const { PptxViewer, parseZip, buildPresentation, RECOMMENDED_ZIP_LIMITS } = await import('@aiden0z/pptx-renderer');
  const files = await parseZip(bytes.slice().buffer, RECOMMENDED_ZIP_LIMITS);
  const pres = buildPresentation(files);
  const viewer = new PptxViewer(host, { fitMode: 'none' });
  viewer.load(pres);
  const W = pres.width, H = pres.height;
  const hidden = new Set((pres.slides || []).map((s, i) => (s?.hidden ? i : -1)).filter((i) => i >= 0)); // 숨긴 슬라이드는 빼고(쪽 번호는 보이는 것만 이어서)
  const total = Math.min(maxPages, viewer.slideCount - hidden.size);
  const out = [];
  const scale = Math.min(3, MAX_W / W);
  for (let i = 0, n = 0; i < viewer.slideCount && n < total; i++) {
    if (signal?.aborted) break;
    if (hidden.has(i)) continue;
    const box = document.createElement('div');
    box.style.cssText = `width:${Math.round(W)}px;height:${Math.round(H)}px;overflow:hidden;position:relative;background:#fff`;
    host.appendChild(box);
    const handle = viewer.renderSlideToContainer(i, box, 1);
    try {
      await document.fonts?.ready; await frame();
      const { blob, isBlank } = await shoot(box, scale);
      if (blob) out.push({ page: ++n, blob, isBlank });
    } finally { try { handle?.dispose?.(); } catch { /* 넘김 */ } box.remove(); }
    onProgress?.(n, total);
  }
  try { viewer.destroy?.(); } catch { /* 넘김 */ }
  return out;
}

async function docxPages(bytes, host, { onProgress, signal, maxPages }) {
  const { renderAsync } = await import('docx-preview');
  const body = document.createElement('div'); host.appendChild(body);
  await renderAsync(bytes.slice(), body, null, { inWrapper: false, breakPages: true, experimental: true, renderHeaders: true, renderFooters: true, renderComments: false, useBase64URL: true });
  await document.fonts?.ready; await frame();
  // 구역(section.docx) 하나가 여러 쪽 길이면 쪽 높이로 자름(docx-preview는 줄 단위로 쪽을 나누지 않음)
  const parts = [];
  for (const sec of body.querySelectorAll('section.docx')) {
    const w = sec.offsetWidth || 794; const pageH = Math.round(w * 1.4142); const h = sec.offsetHeight || pageH;
    const n = Math.max(1, Math.ceil((h - 8) / pageH));
    for (let k = 0; k < n; k++) parts.push({ sec, w, pageH, k, n });
  }
  const total = Math.min(maxPages, parts.length);
  const out = [];
  const scale = Math.min(2, 1240 / Math.max(...parts.map((p) => p.w), 600)); // A4 150dpi 너비쯤
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) break;
    const { sec, w, pageH, k, n } = parts[i];
    let el = sec;
    if (n > 1) { // 창(쪽 높이)을 만들어 구역을 위로 밀어 넣고 그 창만 찍음
      el = document.createElement('div'); el.style.cssText = `width:${w}px;height:${pageH}px;overflow:hidden;position:relative;background:#fff`;
      const ph = sec.parentNode; const mark = document.createComment(''); ph.insertBefore(mark, sec);
      sec.style.position = 'absolute'; sec.style.left = '0'; sec.style.top = `${-k * pageH}px`; sec.style.margin = '0';
      el.appendChild(sec); host.appendChild(el);
      try { await frame(); const r = await shoot(el, scale); if (r.blob) out.push({ page: i + 1, ...r }); }
      finally { ph.insertBefore(sec, mark); mark.remove(); sec.style.position = sec.style.left = sec.style.top = sec.style.margin = ''; el.remove(); }
    } else { const r = await shoot(el, scale); if (r.blob) out.push({ page: i + 1, ...r }); }
    onProgress?.(i + 1, total);
  }
  return out;
}

// 한글(HWP·HWPX): rhwp 본체(WebAssembly 27.9MB, 받을 때 약 8.5MB)는 앱 배포의 한 파일 한도(25MiB)를 넘어 jsDelivr에서 같은 판(@rhwp/core 판 고정)을 받음.
// 받은 바이트의 SHA-256이 빌드 때 잰 값(설치한 @rhwp/core의 rhwp_bg.wasm, vite.config.js)과 같을 때만 씀.
// 못 받음·시간 초과·값이 다름·해석 실패면 [] → 앱은 글자만 보내고 'PDF로 저장해 올리면 더 정확해요'를 보여 줌
const RHWP_WASM = `https://cdn.jsdelivr.net/npm/@rhwp/core@${RHWP_VER}/rhwp_bg.wasm`;
const RHWP_WAIT = 90000; // 받기 한도(1Mbps 남짓인 망에서도 받는 길이)
let rhwpReady = null;
const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
function loadRhwp(signal) {
  if (!rhwpReady) {
    rhwpReady = (async () => {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), RHWP_WAIT);
      const stop = () => ctl.abort(); signal?.addEventListener('abort', stop);
      try {
        const [m, bin] = await Promise.all([import('@rhwp/core'), fetch(RHWP_WASM, { signal: ctl.signal, credentials: 'omit' }).then((r) => {
          if (!r.ok) throw new Error(`rhwp: HTTP ${r.status}`);
          return r.arrayBuffer();
        })]);
        if (hex(await crypto.subtle.digest('SHA-256', bin)) !== __RHWP_WASM_SHA256__) throw new Error('rhwp: 받은 파일의 SHA-256이 다름');
        await m.default({ module_or_path: bin });
        return m;
      } finally { clearTimeout(t); signal?.removeEventListener('abort', stop); }
    })();
    rhwpReady.catch(() => { rhwpReady = null; }); // 실패는 기억하지 않음(다음 한글 파일 때 다시 받음)
  }
  return rhwpReady;
}

async function hwpPages(bytes, _host, { onProgress, signal, maxPages }) {
  const m = await loadRhwp(signal);
  if (signal?.aborted) return [];
  const doc = new m.HwpDocument(bytes.slice());
  try {
    const total = Math.min(maxPages, doc.pageCount());
    const out = [];
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) break;
      let w = 794; try { w = JSON.parse(doc.getPageInfo(i)).width || w; } catch { /* A4 */ }
      const canvas = document.createElement('canvas');
      doc.renderPageToCanvas(i, canvas, Math.min(2, 1240 / w)); // A4 150dpi 너비쯤(DOCX와 같게)
      const isBlank = blank(canvas); const blob = await toBlob(canvas);
      canvas.width = canvas.height = 0;
      if (blob) out.push({ page: i + 1, blob, isBlank });
      onProgress?.(i + 1, total);
      await frame(); // 쪽 사이에 화면이 숨 돌리게
    }
    return out;
  } finally { try { doc.free(); } catch { /* 넘김 */ } }
}
