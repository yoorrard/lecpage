// 교재 건네기: AI가 원본을 직접 읽게.
// - PDF: 원본 파일(blobs 'src/*')을 그대로(세 회사 모두 받음)
// - PPTX·DOCX: Gemini는 원본 그대로(Gemini 4가 쪽 그림으로 읽음), 다른 회사는 쪽 그림(같은 교재의 PDF본이 있으면) + 보조 글자
// - HWP/HWPX·글 파일: 보조 글자 + "PDF로 저장해 넣으면 더 정확해요"
// - 보조 글자: 코드가 뽑은 글이라 '참고용, 틀릴 수 있음'으로 표시
// - 회사별 크기 한도를 넘으면 쪽을 골라 그림으로 담고 알림(level이 오를수록 더 작게: 'too-long' 오류가 오면 job이 level을 올려 다시)
// 사이트용 교재 쪽 그림은 blobs 'site/material/p-NNN.webp'(이미 만든 assets/slides/*를 옮기거나 PDF에서 새로 그림, 긴 변 1,600px)
import { blobs } from '../db.js';
import { materialToAIContext } from '@engine/src/ingest/outline.js';
import { LIMITS, pdfPageLimit } from './providers/index.js';

const OFFICE_MIME = {
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint', doc: 'application/msword', odt: 'application/vnd.oasis.opendocument.text', odp: 'application/vnd.oasis.opendocument.presentation',
};
export const SITE_MATERIAL = 'site/material/';
const pageName = (n, ext = 'webp') => `p-${String(n).padStart(3, '0')}.${ext}`;
const extOf = (name) => (String(name || '').split('.').pop() || '').toLowerCase();
const sizeOf = (v) => (v == null ? 0 : typeof v === 'string' ? v.length : v.byteLength ?? v.size ?? 0);
const toBytes = async (v) => (v instanceof Blob ? new Uint8Array(await v.arrayBuffer()) : v);

/** 교재 파일 목록(사진 줄·읽지 못한 파일 빼고) */
export function sourceFiles(project) {
  return (project.files || []).filter((f) => f.key && !f.photos && !(f.errors || []).length);
}

/**
 * 사이트용 교재 쪽 그림 준비 → { list: ['material/p-001.webp', …], from: 파일 이름 }
 * 이미 있으면 그대로. assets/slides/(교재를 넣을 때 그린 것)가 있으면 옮기고, 없으면 첫 PDF를 새로 그림(최대 400쪽).
 */
export async function preparePageImages(pid, project, { signal, onProgress } = {}) {
  const keys = await blobs.keys(pid).catch(() => []);
  const have = keys.filter((k) => k.startsWith(SITE_MATERIAL)).sort();
  const pdf = sourceFiles(project).filter((f) => f.ext === 'pdf').sort((a, b) => (b.pages || 0) - (a.pages || 0))[0];
  if (have.length) return { list: have.map((k) => k.slice(5)), from: pdf?.name || '' };
  const slides = keys.filter((k) => /^assets\/slides\/slide-\d+\.(webp|png|jpg)$/.test(k)).sort();
  if (slides.length) {
    for (const k of slides) {
      const n = +/slide-(\d+)/.exec(k)[1]; const ext = extOf(k);
      const v = await blobs.get(pid, k);
      if (v) await blobs.put(pid, SITE_MATERIAL + pageName(n, ext), v);
    }
    return preparePageImages(pid, project, { signal });
  }
  if (!pdf) return { list: [], from: '' };
  const bytes = await toBytes(await blobs.get(pid, pdf.key).catch(() => null));
  if (!bytes || !bytes.byteLength) return { list: [], from: '' };
  const ing = await import('../ingest.js');
  const shots = await ing.renderSlides(bytes.slice(), onProgress, signal);
  for (const s of shots) await blobs.put(pid, SITE_MATERIAL + pageName(s.page, s.type === 'image/png' ? 'png' : s.type === 'image/jpeg' ? 'jpg' : 'webp'), s.blob);
  const list = (await blobs.keys(pid)).filter((k) => k.startsWith(SITE_MATERIAL)).sort().map((k) => k.slice(5));
  return { list, from: pdf.name };
}

/** 쪽 고르기: 앞쪽(표지·목차)과 끝쪽을 넣고 나머지는 고르게 */
export function pickPages(total, max) {
  if (total <= max) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set([1, 2, 3, total].filter((n) => n >= 1 && n <= total));
  const rest = Math.max(0, max - keep.size);
  for (let i = 0; i < rest; i++) keep.add(Math.min(total, Math.max(1, Math.round(4 + (i * (total - 5)) / Math.max(1, rest - 1)))));
  return [...keep].sort((a, b) => a - b).slice(0, max);
}

/**
 * 한 작업에서 단계마다 똑같이 쓰는 교재 꾸러미. level: 0 원본 우선, 1 쪽 그림 위주(원본이 크거나 'too-long'), 2 더 적은 쪽 그림 + 글
 * @returns {Promise<{ parts, files, siteImages, siteImagesFrom, sentPages, text, notes, level, bytes }>}
 */
export async function packMaterial(pid, project, { provider, model = '', level = 0, siteImages = [], siteImagesFrom = '', intro } = {}) {
  const L = LIMITS[provider] || LIMITS.openai;
  const notes = []; const files = []; const parts = []; let bytes = 0; let images = 0;
  const src = sourceFiles(project);
  const coveredByPdf = new Set(src.filter((f) => f.ext === 'pdf').map((f) => f.name.replace(/\.pdf$/i, '').toLowerCase()));
  let needImages = false; let textFor = 0;
  for (const f of src) {
    const ext = f.ext || extOf(f.name);
    const data = await blobs.get(pid, f.key).catch(() => null);
    const size = sizeOf(data);
    const row = { name: f.name, pages: f.pages || 0, ext, sent: 'none' };
    files.push(row);
    if (!data || !size) { row.sent = 'text'; textFor++; continue; }
    if (ext === 'pdf') {
      const okSize = size <= L.pdfBytes && bytes + size <= L.totalBytes;
      const okPages = !f.pages || f.pages <= pdfPageLimit(provider, model);
      if (level === 0 && okSize && okPages) { parts.push({ kind: 'pdf', data, name: f.name }); bytes += size; row.sent = 'original'; continue; }
      row.sent = 'images'; needImages = true;
      notes.push(level === 0 ? `${f.name}: 파일이 커서(${Math.round(size / 1e6)}MB${f.pages ? `·${f.pages}쪽` : ''}) 쪽 그림으로 보냈어요.` : `${f.name}: AI 회사가 한 번에 받는 크기를 넘어 쪽 그림으로 보냈어요.`);
      continue;
    }
    if (OFFICE_MIME[ext]) {
      if (L.office && level <= 1 && size <= L.pdfBytes && bytes + size <= L.totalBytes) { parts.push({ kind: 'doc', data, mime: OFFICE_MIME[ext], name: f.name }); bytes += size; row.sent = 'original'; continue; }
      if (coveredByPdf.has(f.name.replace(/\.\w+$/, '').toLowerCase())) { row.sent = 'images'; needImages = true; continue; } // 같은 교재의 PDF본을 함께 넣음
      row.sent = 'text'; textFor++;
      notes.push(`${f.name}: 글자만 보냈어요. PowerPoint·한글에서 PDF로 저장해 함께 넣으면 그림까지 읽어 더 정확해요.`);
      continue;
    }
    row.sent = 'text'; textFor++;
    if (/^hw/.test(ext)) notes.push(`${f.name}: 글자만 보냈어요. 한글에서 PDF로 저장해 함께 넣으면 더 정확해요.`);
  }
  // 쪽 그림: 원본을 못 보낸 PDF(또는 PDF본이 있는 PPTX)가 있을 때, 한도 안에서 쪽을 골라
  const sentPages = [];
  if (needImages && siteImages.length) {
    const cap = Math.min(L.images, level >= 2 ? 12 : 60);
    const picks = pickPages(siteImages.length, cap);
    for (const n of picks) {
      const path = siteImages[n - 1]; if (!path) continue;
      const v = await blobs.get(pid, 'site/' + path).catch(() => null);
      const sz = sizeOf(v);
      if (!v || bytes + sz > L.totalBytes) break;
      parts.push({ kind: 'image', data: v, mime: /\.png$/.test(path) ? 'image/png' : /\.jpe?g$/.test(path) ? 'image/jpeg' : 'image/webp', name: path });
      bytes += sz; images++; sentPages.push(n);
    }
    if (sentPages.length < siteImages.length) notes.push(`교재 ${siteImages.length}쪽 중 ${sentPages.length}쪽을 골라 그림으로 보냈어요.`);
  } else if (needImages) {
    for (const r of files) if (r.sent === 'images') { r.sent = 'text'; textFor++; }
  }
  // 보조 글자: 원본을 보냈으면 짧게(AI가 원본을 읽음), 글만 보낸 것이 있으면 길게
  const anyOriginal = files.some((r) => r.sent === 'original');
  const maxChars = level >= 2 ? 12000 : textFor || images ? 40000 : anyOriginal ? 8000 : 24000;
  let text = '';
  if (project.material) { try { text = materialToAIContext(project.material, { maxChars, header: false, notes: !anyOriginal }); } catch { text = ''; } }
  const pack = { parts, files, siteImages, siteImagesFrom, sentPages, text, notes, level, bytes, images };
  // 교재 앞부분 글(단계마다 같음) → 마지막에 캐시 표시
  if (intro) parts.push({ kind: 'text', text: intro(pack), cache: true });
  return pack;
}
