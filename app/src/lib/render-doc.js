// 브라우저 안에서 PPTX·DOCX·한글(HWP·HWPX) → 쪽 그림(WebP, 긴 변 1,600px). lecpage 커넥트(이 PC의 PowerPoint 등으로 PDF)가 없을 때 씀.
// - PPTX: @aiden0z/pptx-renderer(Apache-2.0)가 슬라이드를 HTML·SVG로 그림 → @zumer/snapdom(MIT)이 캔버스로 옮김
// - DOCX: docx-preview(Apache-2.0)가 쪽(구역)을 그림 → 쪽 높이로 잘라 옮김. 출처 없는 sandbox 틀 안에서(docxPages, build/docx-frame.js)
// - HWP·HWPX: @rhwp/core(MIT, Rust+WebAssembly)가 쪽마다 캔버스에 바로 그림
// 실측(2026-11, Chromium·Firefox): 색 배경·도형·사진·표·차트·그라데이션이 LibreOffice로 바꾼 PDF와 거의 같음(r100/doc-render).
// 한글은 정부 보도자료 4건(HWP 2·HWPX 3, 표·사진·색 상자·2~11쪽)을 한컴이 만든 PDF와 견줘 쪽 수·줄바꿈·표·그림이 같음(r100/hwp).
// 그림이 모두 한 가지 색이면(브라우저가 그리지 못함) []를 돌려줌 → 앱은 글자만 보내고 'PDF로 저장해 올리면 더 정확해요'를 보여 줌
import { snapdom } from '@zumer/snapdom';
import { version as RHWP_VER } from '@rhwp/core/package.json';
import { FRAME_SRC, frameEvent, sendHtml, postInner } from './sandbox-frame.js';

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
  const host = /^p/.test(ext) ? stage() : null; // DOCX는 sandbox 틀 안, 한글은 캔버스에 바로 그림
  try {
    const draw = /^p/.test(ext) ? pptxPages : /^hw/.test(ext) ? hwpPages : docxPages;
    const shots = await draw(bytes, host, { onProgress, signal, maxPages });
    if (shots.length && shots.every((s) => s.isBlank)) return [];
    return shots.map(({ page, blob }) => ({ page, blob, type: blob.type || 'image/png' }));
  } catch (e) {
    console.warn('[render-doc]', e);
    return [];
  } finally { host?.remove(); }
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
  try { // 중간에 실패해도 뷰어가 만든 것(그림 주소 등)은 정리
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
  } finally { try { viewer.destroy?.(); } catch { /* 넘김 */ } }
  return out;
}

// DOCX: docx-preview는 문서에 적힌 스타일·글꼴 이름을 그대로 CSS로 넣으므로(이스케이프 없음) 앱 화면에서 그리지 않고
// 출처 없는 sandbox 틀(allow-scripts만, allow-same-origin 없음)에서 그리고 찍음 → 교재의 CSS·글이 앱 화면을 바꾸거나 앱 저장소·연결 토큰에 닿지 못함.
// 틀 안 코드(build/docx-frame.js + docx-preview + snapdom)는 vite.config.js가 한 덩어리 글로 묶어 둠(virtual:lecpage-docx-frame).
// 틀은 격리 틀(public/frame/, sandbox-frame.js)의 안쪽 srcdoc 틀: 아래 시작 글(인라인 스크립트)과 넘겨받은 코드는 틀 문서의 CSP로 돌고, 앱 CSP에는 인라인 스크립트가 없음.
// 받은 것은 모양을 확인하고(쪽 번호·그림 Blob·크기) 그림만 씀. 틀이 20초 안에 준비되지 않거나 2분 동안 아무 말이 없으면(틀이 멈춤) 그때까지 받은 쪽만
const DOCX_IDLE = 120000;
const DOCX_BOOT_WAIT = 20000;
const DOCX_MAX_BLOB = 30 * 1024 * 1024;
const DOCX_BOOT = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff;color:#000;font-family:"Malgun Gothic","맑은 고딕","Apple SD Gothic Neo","Noto Sans KR",sans-serif}</style></head><body><script>
addEventListener('message',function(e){if(e.source!==parent)return;var d=e.data||{};if(d.type!=='lp-docx-run'||window.lpDocxFrame)return;
function send(m){try{parent.postMessage(m,'*')}catch(x){parent.postMessage({type:'lp-docx-done',error:String(x&&x.message||x)},'*')}}
var s=document.createElement('script');s.textContent=d.code;document.head.appendChild(s);
if(!window.lpDocxFrame||typeof lpDocxFrame.run!=='function'){send({type:'lp-docx-done',error:'frame code did not load'});return}
lpDocxFrame.run(d.bytes,d.opts||{},send).then(function(){send({type:'lp-docx-done'})},function(x){send({type:'lp-docx-done',error:String(x&&x.message||x)})})});
parent.postMessage({type:'lp-docx-ready'},'*');
<\/script></body></html>`;

async function docxPages(bytes, _host, { onProgress, signal, maxPages }) {
  const { default: code } = await import('virtual:lecpage-docx-frame');
  if (signal?.aborted) return [];
  return new Promise((resolve) => {
    const out = []; const seen = new Set(); let timer = 0; let over = false; let started = false;
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-scripts');
    f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1; f.title = 'lecpage-docx';
    // 그려야 찍을 수 있어 display:none은 안 됨. 화면 밖, 쪽(A4 794px·가로 1123px)이 들어가는 넓이
    f.style.cssText = 'position:fixed;left:-100000px;top:0;width:1600px;height:1200px;border:0;opacity:0;pointer-events:none';
    const finish = () => {
      if (over) return; over = true;
      clearTimeout(timer); removeEventListener('message', onMsg); signal?.removeEventListener('abort', finish); f.remove();
      resolve(out.sort((a, b) => a.page - b.page));
    };
    const idle = (ms = DOCX_IDLE) => { clearTimeout(timer); timer = setTimeout(finish, ms); };
    function onMsg(e) {
      if (over) return;
      const ev = frameEvent(e, f);
      if (!ev) return;
      if (ev.kind === 'ready') { idle(DOCX_BOOT_WAIT); sendHtml(f, DOCX_BOOT, { title: 'lecpage-docx' }); return; } // 틀 문서가 준비됨 → 시작 글을 넣음
      if (ev.kind !== 'msg') return;
      const d = ev.data && typeof ev.data === 'object' ? ev.data : {};
      idle();
      if (d.type === 'lp-docx-ready' && !started) {
        started = true;
        const buf = new Uint8Array(bytes).slice().buffer; // 늘 새 사본을 넘김(부른 쪽 바이트는 그대로)
        postInner(f, { type: 'lp-docx-run', code, bytes: buf, opts: { maxPages } }, [buf]);
      } else if (d.type === 'lp-docx-page') {
        const ok = Number.isInteger(d.page) && d.page >= 1 && d.page <= maxPages && !seen.has(d.page)
          && d.blob instanceof Blob && d.blob.size > 0 && d.blob.size <= DOCX_MAX_BLOB && /^image\/(webp|png)$/.test(d.blob.type);
        if (ok) { seen.add(d.page); out.push({ page: d.page, blob: d.blob, isBlank: d.isBlank === true }); }
      } else if (d.type === 'lp-docx-progress') {
        if (Number.isInteger(d.done) && Number.isInteger(d.total) && d.total >= 0 && d.total <= maxPages && d.done <= d.total) onProgress?.(d.done, d.total);
      } else if (d.type === 'lp-docx-done') {
        if (d.error) console.warn('[render-doc] docx', String(d.error).slice(0, 300));
        finish();
      }
    }
    addEventListener('message', onMsg);
    signal?.addEventListener('abort', finish); // [중지]: 그때까지 받은 쪽만
    idle(DOCX_BOOT_WAIT);
    f.src = FRAME_SRC;
    document.body.appendChild(f);
  });
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
