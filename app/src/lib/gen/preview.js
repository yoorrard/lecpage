// 연수 → 조립(엔진 키트 assemble) 한 곳: 미리보기(components/Preview.jsx)·검수(job.js inspectSite)·배포(pages/steps/Share.jsx)가 함께 씀.
// 사이트 글(p.site) + 이 연수 저장소의 'site/…'(교재 쪽 그림·올린 사진·자료실 파일)을 합쳐 조립합니다.
// 미리보기 틀은 sandbox(allow-same-origin 없이)로 띄워야 사이트 코드가 앱 저장소(키·연수)에 닿지 못합니다.
import { blobs, projects } from '../db.js';
import { assemble, assembleOpts, rehearsalPrev } from './kit.js';

/** 이 연수의 사이트 바이트 파일(blobs 'site/…') → { 'material/p-001.webp': 바이트, … } */
export async function materialFiles(pid) {
  const out = {};
  const keys = (await blobs.keys(pid).catch(() => [])).filter((k) => k.startsWith('site/'));
  for (const k of keys) { const v = await blobs.get(pid, k); out[k.slice(5)] = v instanceof Blob ? new Uint8Array(await v.arrayBuffer()) : v; }
  return out;
}

/**
 * 연수 조립. target 'preview'(미리보기·검수: 참여 기능은 이 기기 안 연습) | 'zip' | 'hosted'(배포).
 * site·meta: 연수 것 대신 쓸 것(고친 판을 검수할 때), prev: 강사 값(배포 때 화면이 정한 실시간 방·주소, 미리보기는 연습용),
 * extra: 덧붙일 파일(교재 원본을 자료실에), materials: 자료실 목록
 * @returns {Promise<{ files, warnings, errors, meta, collected, … , material }>}
 */
export async function assembleProject(p, { site, meta, target = 'preview', prev, extra = null, materials } = {}) {
  const mat = await materialFiles(p.id);
  const m = meta || p.meta || {};
  const r = assemble({ ...mat, ...(site || p.site || {}), ...(extra || {}) }, m, await assembleOpts(p, { target, prev: prev === undefined ? (target === 'preview' ? rehearsalPrev(m) : m) : prev, materials }));
  return { ...r, material: mat };
}

/** 검수용(job.js): pid로 연수를 읽어 조립 */
export async function assembleSite(pid, site, meta, { project = null } = {}) {
  const p = project || await projects.get(pid);
  return assembleProject({ ...(p || {}), id: pid }, { site, meta });
}
