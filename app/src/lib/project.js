// 프로젝트 만들기·저장·내보내기(.lecpage = 무압축 ZIP: project.json + 자산 파일)
import { projects, blobs } from './db.js';
import { uid } from './util.js';
import { zipFiles } from '@engine/src/zip-write.js';
import { DEFAULT_INFO, ALLOWED_ASSET, isAllowedAsset, readStoredZip, appInfoFrom, PROJECT_FORMAT, PROJECT_VERSION } from '@engine/src/project-file.js';

// .lecpage 형식(받는 자료·ZIP 읽기·연수 정보 기본값)은 skill CLI(`lecpage.mjs app`)와 함께 쓰는 엔진 규칙
export { DEFAULT_INFO, ALLOWED_ASSET, readStoredZip };

// 예시 설계도는 필요할 때만 불러옵니다(첫 화면을 가볍게)
export async function loadExample(id) {
  const m = id === 'sel-story'
    ? await import('../../../skills/lecpage/examples/sel-story.blueprint.json')
    : await import('../../../skills/lecpage/examples/data-lab.blueprint.json');
  return JSON.parse(JSON.stringify(m.default));
}

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
  const files = { 'project.json': JSON.stringify({ format: PROJECT_FORMAT, version: PROJECT_VERSION, project: { ...p, deploy: undefined } }, null, 2) };
  for (const [k, v] of Object.entries(assets)) files[k] = v;
  return zipFiles(files);
}

/** 화면에 그대로 보여 줄 오류(무슨 일인지 + 할 일). 그 밖의 오류(JSON 깨짐 등)는 부른 쪽이 쉬운 말로 바꿔요 */
const bad = (m) => Object.assign(new Error(m), { friendly: true });

export async function importProjectFile(file) {
  const buf = await file.arrayBuffer();
  let proj, assets = {};
  if (/\.json$/i.test(file.name)) {
    const j = JSON.parse(new TextDecoder().decode(buf));
    if (j.format === PROJECT_FORMAT) proj = j.project;
    // 설계도만 받으면 연수 정보를 설계도에서 채움(연수 정보를 고칠 때 빈 칸이 설계도의 날짜·장소를 지우지 않게)
    else { proj = { title: j.meta?.title || '', files: [], info: appInfoFrom(j && typeof j === 'object' ? j : {}), blueprint: j }; }
  } else {
    const files = readStoredZip(buf);
    const pj = files['project.json']; if (!pj) throw bad('project.json이 없는 파일이에요. lecpage에서 저장한 .lecpage 파일인지 확인해 주세요.');
    const j = JSON.parse(new TextDecoder().decode(pj)); proj = j.project;
    for (const [k, v] of Object.entries(files)) if (k !== 'project.json' && isAllowedAsset(k)) assets[k] = v;
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
