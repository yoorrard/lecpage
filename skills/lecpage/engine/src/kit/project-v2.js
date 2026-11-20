// .lecpage v2: 사이트 폴더 + lecpage.json + 교재 쪽 그림 + 원본 메타(교재 목록·쪽 제목)를 무압축 ZIP 하나로.
//   project.json { format:'lecpage-project', version:2, engine, kind:'site', title, meta, material:{pages}, sources, createdAt }
//   site/…   AI가 쓴 사이트 파일(index.html·assets/…·material/p-NNN.webp·files/…)
//   src/…    교재 원본(있으면)
// v1(설계도) 파일을 열면 kind:'v1'로 알려 주고(예전 판), upgradeV1으로 연수 정보·교재 쪽 그림·원본을 v2 꼴로 옮기고
// 예전 사이트는 지금 엔진으로 빌드해 legacy로 줍니다(AI로 새로 만들 때까지 그대로 볼 수 있게).
// 가벼운 모듈: 열기(openProjectFile)는 엔진 빌드를 불러오지 않음. upgradeV1만 build를 받아 씀(부른 쪽이 넘김).
import { zipFiles } from '../zip-write.js';
import { readStoredZip, unpackProject, PROJECT_FORMAT, ENGINE_VERSION, newerVersion, srcKey, isAllowedAsset } from '../project-file.js';
import { readMeta } from './meta.js';
import { siteFileOk, pagePath } from './paths.js';

export const PROJECT_V2 = 2;
const bad = (m) => Object.assign(new Error(m), { friendly: true });
const td = new TextDecoder();
export const OLD_NOTE = '예전 판(설계도)으로 만든 파일이에요. 교재와 연수 정보는 그대로 가져왔어요. 사이트는 AI로 새로 만들어 주세요(예전 사이트는 그대로 볼 수 있어요).';

/**
 * v2 파일 만들기.
 * @param p { site:{경로:글|bytes}, meta(lecpage.json 객체), material:{pages:[{page,title,text}]}|null, sources:[{name,type,pages,size}], originals:[{name,bytes}], now }
 * @returns { bytes: Uint8Array(zip), files, dropped:[경로] }
 */
export function packProjectV2({ site = {}, meta = {}, material = null, sources = [], originals = [], now = Date.now() } = {}) {
  const files = {}; const dropped = [];
  const m = readMeta(meta).meta;
  // 강사 비밀은 담지 않음(참여 기능 키). 주소·공개 범위는 담되 여는 쪽이 강사 값으로 다시 받음
  const safeMeta = { ...m, live: m.live ? { provider: m.live.provider, url: m.live.url, code: m.live.code } : null };
  const pages = (material?.pages || []).slice(0, 2000).map((x) => ({ page: +x.page || 0, title: String(x.title || '').slice(0, 160), ...(x.text ? { text: String(x.text).slice(0, 4000) } : {}) })).filter((x) => x.page > 0);
  const project = { format: PROJECT_FORMAT, version: PROJECT_V2, engine: ENGINE_VERSION, kind: 'site', title: m.title, meta: safeMeta, material: { pages }, sources: sources.slice(0, 40).map((s) => ({ name: String(s.name || '').slice(0, 160), type: String(s.type || '').slice(0, 12), pages: +s.pages || 0, size: +s.size || 0 })), createdAt: now };
  files['project.json'] = JSON.stringify(project, null, 2);
  for (const [k, v] of Object.entries(site)) { if (siteFileOk(k)) files['site/' + k] = v; else dropped.push(k); }
  for (const o of originals) { const k = srcKey(o.name); if (isAllowedAsset(k) && !files[k]) files[k] = o.bytes; else dropped.push(o.name); }
  return { bytes: zipFiles(files, { date: new Date(now) }), files, dropped };
}

/** v2 파일 안의 파일들 → { site, meta, material, sources, originals, engine, formatVersion } */
export function unpackProjectV2(zip) {
  let j; try { j = JSON.parse(td.decode(zip['project.json'])); } catch { throw bad('project.json을 읽지 못했어요. 앱에서 다시 저장해 주세요.'); }
  if (j?.format !== PROJECT_FORMAT || +j.version !== PROJECT_V2 || j.kind !== 'site') throw bad('lecpage 사이트 파일(v2)이 아니에요.');
  const site = {}; const originals = [];
  for (const [k, v] of Object.entries(zip)) {
    if (k.startsWith('site/')) { const p = k.slice(5); if (siteFileOk(p)) site[p] = /\.(html|css|m?js|json|txt|vtt)$/i.test(p) ? td.decode(v) : v; }
    else if (k.startsWith('src/') && isAllowedAsset(k)) originals.push({ key: k, name: k.slice(4), bytes: v });
  }
  const meta = readMeta(j.meta || {}, { prev: j.meta || {} }).meta; // 파일 안의 강사 값은 여는 쪽이 다시 확인(앱: 이 기기 값과 비교)
  return { kind: 'v2', site, meta, material: { pages: Array.isArray(j.material?.pages) ? j.material.pages : [] }, sources: Array.isArray(j.sources) ? j.sources : [], originals, engine: typeof j.engine === 'string' ? j.engine.slice(0, 20) : '', formatVersion: PROJECT_V2, title: String(j.title || meta.title || '') };
}

/**
 * .lecpage 열기(v1·v2 모두). v1이면 { kind:'v1', note, v1(unpackProject 결과) } — 부른 쪽이 upgradeV1으로 옮김
 * @param buf ArrayBuffer|Uint8Array
 */
export function openProjectFile(buf) {
  const zip = readStoredZip(buf);
  if (!zip['project.json']) throw bad('project.json이 없는 파일이에요. lecpage에서 저장한 .lecpage 파일인지 확인해 주세요.');
  let head; try { head = JSON.parse(td.decode(zip['project.json'])); } catch { throw bad('project.json을 읽지 못했어요.'); }
  if (head?.format !== PROJECT_FORMAT) throw bad('lecpage 연수 파일이 아니에요.');
  const newer = (+head.version || 0) > PROJECT_V2 || (head.engine && newerVersion(head.engine, ENGINE_VERSION));
  const note = newer ? `더 새 lecpage(${head.engine || `형식 ${head.version}`})로 만든 파일이에요. 지금 판(${ENGINE_VERSION})은 새 칸·설정을 빠뜨릴 수 있어요.` : '';
  if (+head.version === PROJECT_V2 && head.kind === 'site') return { ...unpackProjectV2(zip), note };
  return { kind: 'v1', old: true, note: OLD_NOTE + (note ? ' ' + note : ''), v1: unpackProject(zip) };
}

/**
 * 예전 판(v1) → v2 꼴: 연수 정보(meta v2), 교재 쪽 그림(assets/slides/… → material/p-NNN.webp), 원본, 쪽 제목.
 * build를 주면 예전 사이트를 지금 엔진으로 빌드한 파일(legacy)도 줌(AI로 새로 만들기 전까지 볼 수 있게).
 * @param v1 openProjectFile(...).v1  @param opts { build, runtime, today }
 * @returns { meta, site:{ material/p-NNN.webp… }, material:{pages}, originals, legacy: files|null, warnings }
 */
export function upgradeV1(v1, { build = null, runtime = null, today = '' } = {}) {
  const bp = v1.blueprint || {}; const m = bp.meta || {}; const warnings = [];
  const days = [...(Array.isArray(m.sessions) ? m.sessions : []), ...(m.date ? [{ date: m.date, start: m.start, end: m.end }] : [])];
  const feats = new Set((bp.live?.features || []).filter((f) => ['qa', 'poll', 'board', 'attendance', 'help', 'reactions', 'signal', 'progress'].includes(f)));
  for (const s of bp.sections || []) {
    if (['qa', 'poll', 'board', 'attendance'].includes(s?.type)) feats.add(s.type);
    if (s?.type === 'deck') feats.add('deck');
    if (s?.type === 'materials') feats.add('materials');
    if (s?.type === 'survey' && s.questions?.length) feats.add('survey');
  }
  const meta = readMeta({
    v: 2, title: m.title, subtitle: m.subtitle, organizer: m.organizer, description: m.description, contact: m.contact,
    sessions: days, venue: m.venue, mode: m.mode === 'hybrid' ? 'blended' : m.mode,
    audience: bp.audience?.minor ? 'students' : 'teachers',
    ...(m.admin?.kind ? { admin: m.admin } : {}),
    instructors: (bp.instructors || []).map((p) => ({ name: p.name, org: p.org, role: p.role })),
    features: [...feats], theme: bp.design?.accent ? { accent: bp.design.accent } : {}, facts: [],
  }).meta;
  // 교재 쪽 그림: material.pages[].image(assets/slides/…) → 쪽 번호 차례로 material/p-NNN.webp
  const site = {}; const pages = [];
  const mpages = Array.isArray(v1.material?.pages) ? v1.material.pages : [];
  let n = 0;
  for (const p of mpages) {
    const img = typeof p?.image === 'string' ? (p.image.startsWith('assets/') ? p.image : 'assets/' + p.image) : '';
    const bytes = img && v1.assets[img];
    n++;
    if (bytes) { const to = pagePath(n).replace(/\.webp$/, /\.png$/i.test(img) ? '.png' : /\.jpe?g$/i.test(img) ? '.jpg' : '.webp'); site[to] = bytes; }
    pages.push({ page: n, title: String(p?.title || '').slice(0, 160), ...(p?.text ? { text: String(p.text).slice(0, 4000) } : {}) });
  }
  for (const [k, v] of Object.entries(v1.assets || {})) { const f = /^assets\/files\/(.+)$/.exec(k); if (f) site['files/' + f[1]] = v; }
  let legacy = null;
  if (build && runtime && v1.blueprint) {
    try {
      const r = build(v1.blueprint, { runtime, assets: v1.assets, today });
      if (r.errors?.length) warnings.push(...r.errors.map((e) => e.message_ko)); else legacy = r.files;
    } catch (e) { warnings.push(`예전 사이트를 다시 만들지 못했어요: ${String(e.message).slice(0, 80)}`); }
  }
  return { meta, site, material: { pages }, originals: v1.originals || [], legacy, warnings, note: OLD_NOTE };
}

