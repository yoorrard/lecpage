// .lecpage v2: 사이트 폴더 + lecpage.json + 교재 쪽 그림 + 원본 메타(교재 목록·쪽 제목)를 무압축 ZIP 하나로.
//   project.json { format:'lecpage-project', version:2, engine, kind:'site', title, meta, material:{pages}, sources, createdAt }
//   site/…   AI가 쓴 사이트 파일(index.html·assets/…·material/p-NNN.webp·files/…)
//   src/…    교재 원본(있으면)
// 앱이 [파일로 저장]한 파일(project.json version 1 안에 연수 하나)도 엶: 새 판 연수(사이트가 있음)는 v2와 같은 꼴로,
// 예전 판(설계도로 만든 연수)은 kind:'v1'로 알려 주고 upgradeV1이 연수 정보·교재 쪽 그림·원본을 v2 꼴로 옮김(사이트는 AI로 새로 만듦).
import { zipFiles } from '../zip-write.js';
import { readStoredZip, unpackProject, PROJECT_FORMAT, ENGINE_VERSION, newerVersion, srcKey, isAllowedAsset } from '../project-file.js';
import { readMeta } from './meta.js';
import { siteFileOk, pagePath } from './paths.js';

export const PROJECT_V2 = 2;
const bad = (m) => Object.assign(new Error(m), { friendly: true });
const td = new TextDecoder();
export const OLD_NOTE = '예전 방식으로 만든 연수예요. 교재와 연수 정보는 그대로 가져왔어요. 사이트는 AI로 새로 만들어 주세요.';

/**
 * v2 파일 만들기.
 * @param p { site:{경로:글|bytes}, meta(lecpage.json 객체), material:{pages:[{page,title,text}]}|null, sources:[{name,type,pages,size}], originals:[{name,bytes}], now }
 * @returns { bytes: Uint8Array(zip), files, dropped:[경로] }
 */
export function packProjectV2({ site = {}, meta = {}, material = null, sources = [], originals = [], deploy = null, now = Date.now() } = {}) {
  const files = {}; const dropped = [];
  const m = readMeta(meta, { prev: meta }).meta; // 부른 쪽(앱·CLI)이 준 강사 값은 그대로 담음
  // 강사 비밀은 담지 않음(참여 기능 키). 주소·공개 범위는 담되 여는 쪽이 강사 값으로 다시 받음
  const safeMeta = { ...m, live: m.live ? { provider: m.live.provider, url: m.live.url, code: m.live.code } : null };
  const pages = (material?.pages || []).slice(0, 2000).map((x) => ({ page: +x.page || 0, title: String(x.title || '').slice(0, 160), ...(x.text ? { text: String(x.text).slice(0, 4000) } : {}) })).filter((x) => x.page > 0);
  const project = { format: PROJECT_FORMAT, version: PROJECT_V2, engine: ENGINE_VERSION, kind: 'site', title: m.title, meta: safeMeta, material: { pages }, sources: sources.slice(0, 40).map((s) => ({ name: String(s.name || '').slice(0, 160), type: String(s.type || '').slice(0, 12), pages: +s.pages || 0, size: +s.size || 0 })), createdAt: now,
    // 지난번 배포한 곳(조립 opts.host: 개인정보 안내·운영안내가 그 방식에 맞게). 여는 쪽이 배포할 곳을 고를 때 처음 값으로 씀
    ...(deploy && typeof deploy.host === 'string' && /^[a-z-]{2,20}$/.test(deploy.host) ? { deploy: { host: deploy.host } } : {}) };
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
  // 파일 안의 강사 값(공개 범위·주소·참여 서버)은 남이 준 파일일 수 있어 meta에 넣지 않고 따로 돌려줌(앱이 강사에게 확인받고 씀)
  const meta = readMeta(j.meta || {}).meta;
  const teacherInFile = readMeta(j.meta || {}, { prev: j.meta || {} }).meta;
  return { kind: 'v2', site, meta, teacherInFile: { live: teacherInFile.live, siteUrl: teacherInFile.siteUrl, joinUrl: teacherInFile.joinUrl, shortUrl: teacherInFile.shortUrl, access: teacherInFile.access, surveyUrl: teacherInFile.surveyUrl, privacy: teacherInFile.privacy, keepUntil: teacherInFile.keepUntil }, material: { pages: Array.isArray(j.material?.pages) ? j.material.pages : [] }, sources: Array.isArray(j.sources) ? j.sources : [], originals, engine: typeof j.engine === 'string' ? j.engine.slice(0, 20) : '', formatVersion: PROJECT_V2, title: String(j.title || meta.title || ''), deploy: typeof j.deploy?.host === 'string' && /^[a-z-]{2,20}$/.test(j.deploy.host) ? { host: j.deploy.host } : null };
}

/** 파일 안 연수 정보 → { meta(강사 값 뺌), teacherInFile(강사 값: 부른 쪽이 강사에게 확인받고 씀) } */
function metaParts(raw) {
  const meta = readMeta(raw || {}).meta;
  const t = readMeta(raw || {}, { prev: raw || {} }).meta;
  return { meta, teacherInFile: { live: t.live, siteUrl: t.siteUrl, joinUrl: t.joinUrl, shortUrl: t.shortUrl, access: t.access, surveyUrl: t.surveyUrl, privacy: t.privacy, keepUntil: t.keepUntil } };
}
/** 앱이 저장한 새 판 연수(project.v 2 + site) → v2 꼴. 그림·자료실 파일은 'site/…', 원본은 'src/…' */
function fromAppProject(zip, u) {
  const p = u.project; const site = {};
  for (const [k, v] of Object.entries(p.site || {})) if (typeof v === 'string' && siteFileOk(k)) site[k] = v;
  for (const [k, v] of Object.entries(zip)) if (k.startsWith('site/') && siteFileOk(k.slice(5)) && !(k.slice(5) in site)) site[k.slice(5)] = v;
  const pages = (Array.isArray(p.material?.pages) ? p.material.pages : []).filter((x) => x && !x.file && +x.page > 0).map((x) => ({ page: +x.page, title: String(x.title || '').slice(0, 160) }));
  return { kind: 'v2', site, ...metaParts(p.meta), material: { pages }, sources: [], originals: u.originals.map((o) => ({ key: o.key, name: o.file, bytes: o.bytes })), engine: u.engine, title: String(p.title || p.meta?.title || '').slice(0, 160) };
}
/**
 * .lecpage 열기(v2·앱이 저장한 파일 모두). 예전 판(설계도로 만든 연수)이면 { kind:'v1', note, v1(unpackProject 결과) } — 부른 쪽이 upgradeV1으로 옮김
 * @param buf ArrayBuffer|Uint8Array
 */
export function openProjectFile(buf) {
  const zip = readStoredZip(buf);
  if (!zip['project.json']) throw bad('project.json이 없는 파일이에요. lecpage에서 저장한 .lecpage 파일인지 확인해 주세요.');
  let head; try { head = JSON.parse(td.decode(zip['project.json'])); } catch { throw bad('project.json을 읽지 못했어요. 앱에서 다시 저장한 파일을 열어 주세요.'); }
  if (head?.format !== PROJECT_FORMAT) throw bad('lecpage 연수 파일이 아니에요.');
  const newer = (+head.version || 0) > PROJECT_V2 || (head.engine && newerVersion(head.engine, ENGINE_VERSION));
  const note = newer ? `더 새 lecpage(${head.engine || `형식 ${head.version}`})로 만든 파일이에요. 지금 버전(${ENGINE_VERSION})은 새 칸·설정을 빠뜨릴 수 있어요.` : '';
  if (+head.version === PROJECT_V2 && head.kind === 'site') return { ...unpackProjectV2(zip), note };
  const u = unpackProject(zip);
  if (u.project?.v === 2 && u.project.site) return { ...fromAppProject(zip, u), note };
  return { kind: 'v1', old: true, note: OLD_NOTE + (note ? ' ' + note : ''), v1: u };
}

/**
 * 예전 판(설계도로 만든 연수) → v2 꼴: 연수 정보(meta v2), 교재 쪽 그림(assets/slides/… → material/p-NNN.webp), 자료실 파일, 원본, 쪽 제목.
 * 사이트(index.html)는 옮기지 않음(AI로 새로 만듦).
 * @param v1 openProjectFile(...).v1
 * @returns { meta, site:{ material/p-NNN.webp…, files/… }, material:{pages}, originals, note }
 */
export function upgradeV1(v1) {
  const bp = v1.blueprint || {}; const m = bp.meta || {};
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
  return { meta, site, material: { pages }, originals: v1.originals || [], note: OLD_NOTE };
}

