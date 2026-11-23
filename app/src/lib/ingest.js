// 교재 해석을 브라우저 안에서: pdf.js는 앱에 함께 묶어(외부 CDN 없이) 학교망에서도 동작
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ingestFile, mergeMaterials, materialToJSON } from '@engine/src/ingest/index.js';
import { renderPdfPages, slideFileName } from '@engine/src/ingest/render-pdf-browser.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
globalThis.pdfjsLib = pdfjsLib;

export { mergeMaterials, materialToJSON, slideFileName };

// 글꼴을 담지 않은 한글 PDF(공문·예전 PDF)용 CMap·표준 글꼴: 빌드가 같은 출처 pdfjs/ 아래에 둠(vite.config.js pdfjsAssets). 그런 PDF를 열 때만 받음
const PDF_ASSETS = (() => {
  try { const base = new URL('./pdfjs/', document.baseURI).href; return { cMapUrl: base + 'cmaps/', cMapPacked: true, standardFontDataUrl: base + 'standard_fonts/' }; } catch { return {}; }
})();

/**
 * 엔진 안내를 앱 자리에 맞게 다듬음(엔진 문구는 Skill CLI와 함께 씀):
 * - 확장자만 .pdf·.pptx 등인 글 파일: 엔진은 문서 보안(DRM)으로 짐작하지만, 앞부분이 글자뿐이면 '그 형식이 아니에요'
 * - 한쇼(.show): 손상 안내 대신 한쇼에서 PDF·PPTX로 저장하는 법
 */
function friendlier(m, name, bytes) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  for (const e of m.errors || []) {
    if (ext === 'show' || ext === 'shw') e.message_ko = '한쇼 파일은 바로 읽을 수 없어요. 한쇼에서 [다른 이름으로 저장]을 눌러 PDF나 PowerPoint(.pptx)로 저장한 뒤 올려 주세요.';
    else if (e.code === 'drm' && looksText(bytes)) e.message_ko = `이름은 .${ext} 파일인데 안에는 글자만 들어 있어요. 원본 프로그램에서 ${ext === 'pdf' ? 'PDF로' : '그 형식으로'} 다시 저장해 올려 주세요. 메모장 글이면 .txt로 바꿔 넣으면 돼요.`;
  }
  return m;
}
const looksText = (b) => {
  const head = b.subarray(0, 512);
  if (!head.length) return false;
  let bad = 0; for (const c of head) if (c < 9 || (c > 13 && c < 32)) bad++;
  return bad === 0;
};

export async function readFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { material: await readBytes(file.name, bytes), bytes };
}
/** 바이트로 읽기(커넥트가 바꿔 준 PDF처럼 파일이 없는 것) */
export async function readBytes(name, bytes) {
  const m = await ingestFile(name, bytes, { pdfjsLib, withImages: false, ...PDF_ASSETS });
  return friendlier(m, name, bytes);
}

// PDF가 아닌 교재의 쪽 그림: 커넥트(이 PC의 PowerPoint 등으로 PDF) → 브라우저 안 그리기 → 없음(글자만)
export { convertWithConnect, CONVERTIBLE } from './convert.js';
/** 브라우저 안에서 그릴 수 있는 형식(render-doc.js RENDERABLE과 같게) */
export const canRenderDoc = (name) => /\.(pptx|ppsx|potx|pptm|docx|docm|hwp|hwpx)$/i.test(String(name || ''));
/** PPTX·DOCX·한글을 브라우저 안에서 쪽 그림으로(그리기 도구는 그때 받음) */
export async function renderDoc(name, bytes, onProgress, signal, maxPages = 400) {
  const { renderDocPages } = await import('./render-doc.js');
  return renderDocPages(name, bytes, { onProgress, signal, maxPages });
}

/** signal: [멈추기]를 누르면 그때까지 그린 쪽만 돌려받음(엔진이 멈춤). maxPages: 앞에서부터 몇 쪽까지(교재가 여럿이면 남은 몫) */
export async function renderSlides(bytes, onProgress, signal, maxPages = 400) {
  return renderPdfPages(bytes, { pdfjsLib, scale: 1.5, maxWidth: 1600, type: 'image/webp', quality: 0.82, onProgress, signal, maxPages, ...PDF_ASSETS });
}
