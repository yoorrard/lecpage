// 사이트 → 미리보기 한 장 HTML(엔진 키트 assemble + previewHtml). 교재 쪽 그림은 blobs 'site/material/…'에서.
// 틀은 sandbox(allow-same-origin 없이)로 띄워야 사이트 코드가 앱 저장소(키·연수)에 닿지 못합니다.
import { blobs, projects } from '../db.js';
import { assemble, previewHtml, assembleOpts } from './kit.js';

/** 이 연수의 교재 쪽 그림 등(blobs 'site/…') → { 'material/p-001.webp': 바이트, … } */
export async function materialFiles(pid) {
  const out = {};
  const keys = (await blobs.keys(pid).catch(() => [])).filter((k) => k.startsWith('site/'));
  for (const k of keys) { const v = await blobs.get(pid, k); out[k.slice(5)] = v instanceof Blob ? new Uint8Array(await v.arrayBuffer()) : v; }
  return out;
}

/** 조립(미리보기·연습 모드): AI가 쓴 파일 + 교재 쪽 그림 → assemble 결과 */
export async function assembleSite(pid, site, meta, { project = null, preview = true, target = 'preview' } = {}) {
  const p = project || await projects.get(pid);
  const mat = await materialFiles(pid);
  const r = assemble({ ...mat, ...(site || {}) }, meta || p?.meta || {}, await assembleOpts(p, { preview, target }));
  return { ...r, material: mat };
}

/**
 * 미리보기용 한 장 HTML(화면 작업자가 바로 쓸 수 있게: <iframe sandbox="allow-scripts" srcdoc=…>).
 * page: 'index.html' | 'console.html' | 'screen.html' | 'poster.html' | 'check.html' …
 * @returns {Promise<string>}
 */
export async function sitePreviewHtml(pid, { page = 'index.html', site, meta, extraHead = '', extraBody = '' } = {}) {
  const p = await projects.get(pid);
  const { files } = await assembleSite(pid, site || p?.site || {}, meta || p?.meta || {}, { project: p });
  return previewHtml(files, page, { extraHead, extraBody });
}
