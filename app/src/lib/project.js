// 프로젝트 만들기·저장·내보내기(.lecpage = 무압축 ZIP: project.json + 자산 파일)
import { projects, blobs } from './db.js';
import { uid } from './util.js';
import { zipFiles } from '@engine/src/zip-write.js';

// 예시 설계도는 필요할 때만 불러옵니다(첫 화면을 가볍게)
export async function loadExample(id) {
  const m = id === 'sel-story'
    ? await import('../../../skills/lecpage/examples/sel-story.blueprint.json')
    : await import('../../../skills/lecpage/examples/data-lab.blueprint.json');
  return JSON.parse(JSON.stringify(m.default));
}

export const DEFAULT_INFO = {
  title: '', subtitle: '', organizer: '', date: '', start: '', end: '', venue: '', mode: 'offline',
  size: 25, format: '', features: [], devices: ['laptop'], network: 'good',
  minor: false, admin: 'school', commercial: false, completionRate: 80,
  surveyUrl: '', instructorName: '', instructorOrg: '', instructorBio: '', instructorEmail: '', contact: '', joinUrl: '',
};

/** 첫 화면에 놓은 교재 파일을 '교재 넣기' 화면으로 넘길 때 잠시 보관 */
const pending = new Map();
export function setPendingFiles(id, files) { pending.set(id, Array.from(files || [])); }
export function takePendingFiles(id) { const f = pending.get(id) || []; pending.delete(id); return f; }

/** 옛 7단계 번호 → 새 3단계(교재 넣기·살펴보고 고치기·공개하기) */
export const stageOf = (n) => (n <= 2 ? 1 : n <= 5 ? 2 : 3);

export async function newProject(kind = 'blank', exampleId = 'data-lab') {
  const id = uid(10);
  const p = { id, title: '', step: 1, stage: 1, createdAt: Date.now(), files: [], material: null, info: { ...DEFAULT_INFO }, blueprint: null, deploy: {} };
  if (kind === 'example') {
    const { sanitizeImported } = await import('./blueprint.js');
    const bp = sanitizeImported(await loadExample(exampleId));
    p.blueprint = bp;
    p.title = bp.meta.title; p.stage = 2; p.fromExample = exampleId;
    Object.assign(p.info, { title: bp.meta.title, subtitle: bp.meta.subtitle, organizer: bp.meta.organizer, date: bp.meta.date, start: bp.meta.start, end: bp.meta.end, venue: bp.meta.venue, size: bp.audience.size <= 30 ? 25 : bp.audience.size <= 100 ? 60 : 200, features: bp.live.features, admin: bp.meta.admin?.kind || 'school' });
  }
  await projects.put(p);
  return p;
}

/** 프로젝트 지우기(교재·그림 포함) */
export async function deleteProject(id) { await projects.remove(id); }

/** 프로젝트 복제(교재·그림 포함) */
export async function duplicateProject(p0) {
  const id = uid(10);
  const p = { ...JSON.parse(JSON.stringify(p0)), id, title: (p0.title || '이름 없는 연수') + ' (사본)', createdAt: Date.now(), deploy: {} };
  if (p.blueprint?.meta) p.blueprint.meta.title = p.title;
  if (p.info) p.info.title = p.title;
  if (p.blueprint?.live) { const { E } = await import('./engine.js'); p.blueprint.live.code = E.randomCode(); }
  await projects.put(p);
  const assets = await blobs.all(p0.id);
  for (const [k, v] of Object.entries(assets)) await blobs.put(id, k, v);
  return p;
}


export async function exportProjectFile(p) {
  const assets = await blobs.all(p.id);
  const files = { 'project.json': JSON.stringify({ format: 'lecpage-project', version: 1, project: { ...p, deploy: undefined } }, null, 2) };
  for (const [k, v] of Object.entries(assets)) files[k] = v;
  return zipFiles(files);
}

/** 프로젝트 파일에서 받는 자료: 교재 그림·원본 문서·사진·소리·영상만(스크립트·SVG·HTML 금지, 엔진 파일 덮어쓰기 방지) */
export const ALLOWED_ASSET = /^(?:assets\/)?(?:slides|media)\/[^/]{1,140}\.(png|jpe?g|gif|webp|avif|pdf|mp3|m4a|mp4|webm|pptx|ppsx|docx|hwpx|xlsx|txt|zip)$/i;

/** 무압축 ZIP 읽기(lecpage가 만든 파일) — 다른 압축 ZIP은 거절 */
export function readStoredZip(buf, { maxFiles = 3000, maxBytes = 300e6 } = {}) {
  const u8 = new Uint8Array(buf); const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const out = {}; let p = 0, n = 0, total = 0; const dec = new TextDecoder();
  while (p + 30 <= u8.length && dv.getUint32(p, true) === 0x04034b50) {
    const method = dv.getUint16(p + 8, true), size = dv.getUint32(p + 18, true), nameLen = dv.getUint16(p + 26, true), extra = dv.getUint16(p + 28, true);
    if (method !== 0) throw new Error('lecpage가 만든 프로젝트 파일만 열 수 있어요.');
    const name = dec.decode(u8.subarray(p + 30, p + 30 + nameLen));
    const start = p + 30 + nameLen + extra;
    if (name.includes('..') || name.startsWith('/')) throw new Error('파일 경로가 올바르지 않아요.');
    out[name] = u8.slice(start, start + size);
    total += size; n++; if (n > maxFiles || total > maxBytes) throw new Error('프로젝트 파일이 너무 커요.');
    p = start + size;
  }
  return out;
}

export async function importProjectFile(file) {
  const buf = await file.arrayBuffer();
  let proj, assets = {};
  if (/\.json$/i.test(file.name)) {
    const j = JSON.parse(new TextDecoder().decode(buf));
    if (j.format === 'lecpage-project') proj = j.project;
    else { proj = { title: j.meta?.title || '', files: [], info: { ...DEFAULT_INFO, title: j.meta?.title || '' }, blueprint: j }; }
  } else {
    const files = readStoredZip(buf);
    const pj = files['project.json']; if (!pj) throw new Error('project.json이 없는 파일이에요.');
    const j = JSON.parse(new TextDecoder().decode(pj)); proj = j.project;
    for (const [k, v] of Object.entries(files)) if (k !== 'project.json' && ALLOWED_ASSET.test(k) && !k.includes('..')) assets[k] = v;
  }
  // 남이 준 파일: 실시간 연결·QR 주소는 다시 정하게 비우고, 자료는 그림·문서만 받음
  const { sanitizeImported } = await import('./blueprint.js');
  const id = uid(10);
  const p = { ...proj, id, createdAt: Date.now(), deploy: {}, stage: proj?.blueprint ? 2 : 1, imported: true };
  p.blueprint = sanitizeImported(p.blueprint);
  await projects.put(p);
  for (const [k, v] of Object.entries(assets)) await blobs.put(id, k, v);
  return p;
}
