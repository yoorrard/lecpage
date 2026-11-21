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
  const m = await ingestFile(file.name, bytes, { pdfjsLib, withImages: false, ...PDF_ASSETS });
  return { material: friendlier(m, file.name, bytes), bytes };
}

/** signal: [멈추기]를 누르면 그때까지 그린 쪽만 돌려받음(엔진이 멈춤) */
export async function renderSlides(bytes, onProgress, signal) {
  return renderPdfPages(bytes, { pdfjsLib, scale: 1.5, maxWidth: 1600, type: 'image/webp', quality: 0.82, onProgress, signal, ...PDF_ASSETS });
}
