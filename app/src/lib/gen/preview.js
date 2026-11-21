// 연수 → 조립(엔진 키트 assemble) 한 곳: 미리보기(components/Preview.jsx)·검수(job.js inspectSite)·배포(pages/steps/Share.jsx)가 함께 씀.
// 사이트 글(p.site) + 이 연수 저장소의 'site/…'(교재 쪽 그림·올린 사진·자료실 파일)을 합쳐 조립합니다.
// 미리보기 틀은 sandbox(allow-same-origin 없이)로 띄워야 사이트 코드가 앱 저장소(키·연수)에 닿지 못합니다.
import { blobs, projects } from '../db.js';
import { assemble, assembleOpts, rehearsalPrev } from './kit.js';

/** 이 연수의 사이트 바이트 파일(blobs 'site/…') → { 'material/p-001.webp': 바이트, … } */
export async function materialFiles(pid) {
  const out = {};
  const keys = (await blobs.keys(pid).catch(() => [])).filter((k) => k.startsWith('site/'));
  const kept = filesCache.get(pid) || new Map(); filesCache.set(pid, kept);
  for (const k of [...kept.keys()]) if (!keys.includes(k)) kept.delete(k);
  for (const k of keys) {
    if (kept.has(k)) { out[k.slice(5)] = kept.get(k); continue; }
    const r = await blobs.get(pid, k); const v = r instanceof Blob ? new Uint8Array(await r.arrayBuffer()) : r;
    out[k.slice(5)] = v;
    if (k.startsWith('site/files/')) kept.set(k, v); // 자료 파일은 크고 이름이 겹치지 않아(같은 이름이면 ' (2)') 한 번 읽은 것을 둠: 고칠 때마다 다시 읽지 않게
  }
  return out;
}
const filesCache = new Map(); // pid → Map(저장소 키 → 바이트)

/**
 * 연수 조립. target 'preview'(미리보기·검수: 참여 기능은 이 기기 안 연습) | 'zip' | 'hosted'(배포).
 * site·meta: 연수 것 대신 쓸 것(고친 판을 검수할 때), prev: 강사 값(배포 때 화면이 정한 실시간 방·주소, 미리보기는 연습용),
 * extra: 덧붙일 파일(교재 원본을 자료실에), materials: 자료실 목록
 * @returns {Promise<{ files, warnings, errors, meta, collected, … , material }>}
 */
export async function assembleProject(p, { site, meta, target = 'preview', prev, extra = null, materials, host = '' } = {}) {
  const mat = await materialFiles(p.id);
  const m = meta || p.meta || {};
  // 자료실: 강사가 [자료 추가]로 올린 것(p.materials, 파일은 저장소 'site/files/…') + 부른 쪽이 더한 것(배포 화면의 교재 원본)
  const own = ownMaterials(p, mat);
  const more = (Array.isArray(materials) ? materials : []).filter((x) => x && !own.some((o) => o.href === x.href)).map((x) => (typeof x.size === 'number' ? { ...x, size: sizeText(x.size) } : x));
  const r = assemble({ ...mat, ...(site || p.site || {}), ...(extra || {}) }, m, await assembleOpts(p, { target, host, prev: prev === undefined ? (target === 'preview' ? rehearsalPrev(m) : m) : prev, materials: [...own, ...more] }));
  return { ...r, material: mat };
}

/** 크기(바이트) → '1.2MB'·'340KB' */
export const sizeText = (n) => (!(n > 0) ? '' : n >= 1e6 ? `${(n / 1e6).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1e3))}KB`);
/** 연수의 자료 목록(p.materials) 중 파일이 저장소에 있는 것 → 키트 자료실 꼴 */
export function ownMaterials(p, files = {}) {
  return (Array.isArray(p?.materials) ? p.materials : []).filter((x) => x?.href && (files[x.href] !== undefined || p.site?.[x.href] !== undefined))
    .map((x) => ({ title: x.title || x.href.split('/').pop(), href: x.href, desc: x.desc || '', kind: x.kind || '', size: sizeText(x.size) }));
}

/** 검수용(job.js): pid로 연수를 읽어 조립 */
export async function assembleSite(pid, site, meta, { project = null } = {}) {
  const p = project || await projects.get(pid);
  return assembleProject({ ...(p || {}), id: pid }, { site, meta });
}
