// 교재 해석을 브라우저 안에서: pdf.js는 앱에 함께 묶어(외부 CDN 없이) 학교망에서도 동작
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ingestFile, mergeMaterials, materialToJSON, summarizeMaterial, materialToDraft, materialToAIContext, ACCEPT } from '@engine/src/ingest/index.js';
import { renderPdfPages, slideFileName } from '@engine/src/ingest/render-pdf-browser.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
globalThis.pdfjsLib = pdfjsLib;

export { ACCEPT, mergeMaterials, materialToJSON, summarizeMaterial, materialToDraft, materialToAIContext, slideFileName };

export async function readFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const m = await ingestFile(file.name, bytes, { pdfjsLib, withImages: false });
  return { material: m, bytes };
}

export async function renderSlides(bytes, onProgress) {
  return renderPdfPages(bytes, { pdfjsLib, scale: 1.5, maxWidth: 1600, type: 'image/webp', quality: 0.82, onProgress });
}
