// 프로젝트 만들기·저장·내보내기(.lecpage = 무압축 ZIP: project.json + 자산 파일)
import { projects, blobs } from './db.js';
import { uid } from './util.js';
import { E } from './engine.js';
import aiLab from '../../../skills/lecpage/examples/ai-lab.blueprint.json';
import selStory from '../../../skills/lecpage/examples/sel-story.blueprint.json';

export const EXAMPLES = { 'ai-lab': aiLab, 'sel-story': selStory };

export const DEFAULT_INFO = {
  title: '', subtitle: '', organizer: '', date: '', start: '', end: '', venue: '', mode: 'offline',
  size: 30, format: 'workshop', features: ['qa', 'help', 'progress'], devices: ['laptop'], network: 'good',
  mood: [], motion: 2, accent: '', skill: 'click', infra: [], duration: 'day', minor: false, admin: 'school', commercial: false,
  surveyUrl: '', instructorName: '', instructorOrg: '', instructorBio: '', instructorEmail: '',
};

export async function newProject(kind = 'blank', exampleId = 'ai-lab') {
  const id = uid(10);
  const p = { id, title: '', step: 1, createdAt: Date.now(), files: [], material: null, info: { ...DEFAULT_INFO }, blueprint: null, deploy: {} };
  if (kind === 'example') {
    const bp = EXAMPLES[exampleId] || aiLab;
    p.blueprint = JSON.parse(JSON.stringify(bp));
    p.title = bp.meta.title; p.step = 5;
    Object.assign(p.info, { title: bp.meta.title, subtitle: bp.meta.subtitle, organizer: bp.meta.organizer, date: bp.meta.date, start: bp.meta.start, end: bp.meta.end, venue: bp.meta.venue, size: bp.audience.size, features: bp.live.features });
  }
  await projects.put(p);
  return p;
}

export async function saveProject(p) { await projects.put(p); return p; }

export async function exportProjectFile(p) {
  const assets = await blobs.all(p.id);
  const files = { 'project.json': JSON.stringify({ format: 'lecpage-project', version: 1, project: { ...p, deploy: undefined } }, null, 2) };
  for (const [k, v] of Object.entries(assets)) files[k] = v;
  return E.zipFiles(files);
}

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
    else { proj = { title: j.meta?.title || '', step: 4, files: [], info: { ...DEFAULT_INFO, title: j.meta?.title || '' }, blueprint: j }; }
  } else {
    const files = readStoredZip(buf);
    const pj = files['project.json']; if (!pj) throw new Error('project.json이 없는 파일이에요.');
    const j = JSON.parse(new TextDecoder().decode(pj)); proj = j.project;
    for (const [k, v] of Object.entries(files)) if (k !== 'project.json' && /^(assets|media|slides)\//.test(k)) assets[k] = v;
  }
  const id = uid(10);
  const p = { ...proj, id, createdAt: Date.now(), deploy: {} };
  await projects.put(p);
  for (const [k, v] of Object.entries(assets)) await blobs.put(id, k, v);
  return p;
}
