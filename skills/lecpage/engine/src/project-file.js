// .lecpage 파일: 앱의 [파일로 저장]·[저장한 파일 열기]와 skill CLI(`lecpage.mjs app`)가 함께 쓰는 형식.
// 무압축 ZIP 하나에 project.json(연수 하나: 설계도·연수 정보·교재 해석·교재 목록)과 자료(쪽 그림·교재 그림·자료실 파일·교재 원본)를 담아요.
// 비밀 값(관리자 키·참여 기능 키·사이트 암호)은 담지 않고, 여는 쪽(앱 importProjectFile)이 설계도를 다시 정리해요(intake.js sanitizeImported).
// 앱 첫 화면이 이 파일을 읽으므로 다른 엔진 모듈을 불러오지 않아요(가볍게).

export const PROJECT_FORMAT = 'lecpage-project';
export const PROJECT_VERSION = 1;
/** 앱 주소: 스킬이 만든 파일을 열 곳 */
export const APP_URL = 'https://yoorrard.github.io/lecpage/';

/** 앱의 연수 정보 기본값(앱 '교재 넣기'·'연수 정보' 칸) */
export const DEFAULT_INFO = {
  title: '', subtitle: '', organizer: '', date: '', start: '', end: '', venue: '', mode: 'offline',
  size: 25, format: '', features: [], devices: ['laptop'], network: 'good',
  minor: false, admin: 'school', commercial: false, completionRate: 80,
  surveyUrl: '', instructorName: '', instructorOrg: '', instructorBio: '', instructorEmail: '', contact: '', joinUrl: '',
};

/**
 * 파일에서 받는 자료: 교재 쪽 그림·교재 그림(assets/slides·media), 자료실 파일(assets/files, 엔진 build.js USER_ASSET과 같은 규칙),
 * 교재 원본(src/). 스크립트·SVG·HTML은 받지 않아요(엔진 파일 덮어쓰기 방지). 하위 폴더도 받지 않아요
 */
export const ALLOWED_ASSET = new RegExp('^(?:'
  + '(?:assets/)?(?:slides|media)/[^/]{1,140}\\.(?:png|jpe?g|gif|webp|avif|pdf|mp3|m4a|mp4|webm|pptx|ppsx|docx|hwpx|xlsx|txt|zip)'
  + '|assets/files/[\\w가-힣ㄱ-ㅎㅏ-ㅣ.\\-()\\[\\] ]{1,140}\\.(?:png|jpe?g|gif|webp|avif|pdf|mp3|m4a|mp4|webm|pptx?|ppsx|docx?|hwpx?|xlsx?|csv|txt|md|zip|key|pages|numbers|odt|odp|ods)'
  + '|src/[^/]{1,140}\\.(?:pptx|ppsx|pdf|hwpx|docx|txt|md|hwp|ppt|doc)'
  + ')$', 'i');
export const isAllowedAsset = (k) => typeof k === 'string' && ALLOWED_ASSET.test(k) && !k.includes('..');

/** 교재 원본의 보관 이름(앱 '교재 넣기'와 같은 규칙: src/<이름>) */
export const srcKey = (name) => 'src/' + String(name || '').replace(/[^\w가-힣.\-]+/g, '_').slice(0, 120);
/** 내려받는 파일 이름(앱 [파일로 저장]과 같은 규칙) */
export const projectFileName = (title) => String(title || 'lecpage').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60) + '.lecpage';

/** 화면에 그대로 보여 줄 오류(무슨 일인지 + 할 일) */
const bad = (m) => Object.assign(new Error(m), { friendly: true });

/** 무압축 ZIP 읽기(lecpage가 만든 파일) — 다른 압축 ZIP은 거절 */
export function readStoredZip(buf, { maxFiles = 3000, maxBytes = 300e6 } = {}) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf); const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const out = {}; let p = 0, n = 0, total = 0; const dec = new TextDecoder();
  while (p + 30 <= u8.length && dv.getUint32(p, true) === 0x04034b50) {
    const method = dv.getUint16(p + 8, true), size = dv.getUint32(p + 18, true), nameLen = dv.getUint16(p + 26, true), extra = dv.getUint16(p + 28, true);
    if (method !== 0) throw bad('lecpage에서 저장한 .lecpage 파일만 열 수 있어요. [파일로 저장]으로 만든 파일인지 확인해 주세요.');
    const name = dec.decode(u8.subarray(p + 30, p + 30 + nameLen));
    const start = p + 30 + nameLen + extra;
    if (name.includes('..') || name.startsWith('/')) throw bad('파일 안의 경로가 올바르지 않아요. lecpage에서 다시 저장한 파일을 열어 주세요.');
    out[name] = u8.slice(start, start + size);
    total += size; n++; if (n > maxFiles || total > maxBytes) throw bad('저장한 파일이 너무 커요(300MB까지). 교재 파일을 줄여 다시 저장해 주세요.');
    p = start + size;
  }
  return out;
}

const sizeBucket = (n) => (!(n > 0) ? DEFAULT_INFO.size : n <= 30 ? 25 : n <= 100 ? 60 : n <= 300 ? 200 : 500);
const APP_FORMATS = ['lecture', 'practice', 'conference', 'course'];
const str = (v) => (typeof v === 'string' ? v : '');

/**
 * 설계도(+ 스킬의 info.json) → 앱의 연수 정보. 앱은 연수 정보를 고칠 때 이 값으로 설계도 meta를 다시 씀(syncInfo)이라
 * 설계도와 같은 값이어야 해요. 접속 주소(joinUrl)는 가져온 파일에서 받지 않으므로(UNTRUSTED_META) 비워 둬요
 */
export function appInfoFrom(bp = {}, info = {}) {
  const m = bp.meta || {}; const a = bp.audience || {}; const ins = (bp.instructors || [])[0] || {};
  return {
    ...DEFAULT_INFO,
    title: str(m.title), subtitle: str(m.subtitle), organizer: str(m.organizer), date: str(m.date), start: str(m.start), end: str(m.end),
    venue: str(m.venue), mode: ['offline', 'online', 'hybrid'].includes(m.mode) ? m.mode : DEFAULT_INFO.mode, contact: str(m.contact),
    size: sizeBucket(+a.size), devices: Array.isArray(a.devices) && a.devices.length ? a.devices.slice(0, 6) : DEFAULT_INFO.devices,
    network: ['good', 'slow', 'restricted', 'offline'].includes(a.network) ? a.network : DEFAULT_INFO.network, minor: !!a.minor,
    admin: m.admin?.kind || DEFAULT_INFO.admin, completionRate: +m.admin?.completionRate || DEFAULT_INFO.completionRate,
    features: Array.isArray(bp.live?.features) ? bp.live.features.slice() : [],
    format: APP_FORMATS.includes(info.format) ? info.format : '',
    commercial: !!info.commercial,
    instructorName: str(ins.name), instructorOrg: str(ins.org), instructorBio: str(ins.bio), instructorEmail: str(ins.email),
    ...(str(info.request) ? { request: info.request.slice(0, 600) } : {}),
    joinUrl: '', surveyUrl: '',
  };
}

/** 앱의 연수 정보 → 스킬의 info.json(빈 값은 뺌: patch -i가 빈 값으로 설계도를 지우지 않게). 접속 주소는 강사에게 다시 받음 */
export function workInfoFrom(info = {}) {
  const out = {};
  for (const [k, v] of Object.entries(info || {})) {
    if (k === 'joinUrl' || v === '' || v === null || v === undefined) continue;
    if (['string', 'number', 'boolean'].includes(typeof v) || Array.isArray(v)) out[k] = v;
  }
  return out;
}

const pad3 = (n) => String(n).padStart(3, '0');
/**
 * 쪽 그림 이름을 앱과 같게: assets/slides/slide-<쪽 번호>.<확장자>(교재가 여러 개면 <파일 id>-slide-…).
 * 스킬은 숨긴 쪽을 건너뛰며 차례로 번호를 매기고 교재마다 하위 폴더를 쓰는데, 앱은 쪽 번호 그대로·한 폴더를 써요
 * @returns Map(옛 경로 → 새 경로)
 */
export function slideRenames(material) {
  const pages = (material?.pages || []).filter((p) => typeof p?.image === 'string' && /^assets\/slides\//.test(p.image));
  const files = new Set(pages.map((p) => p.file));
  const map = new Map(); const used = new Set();
  for (const p of pages) {
    if (map.has(p.image)) continue;
    const ext = (/\.(\w+)$/.exec(p.image)?.[1] || 'webp').toLowerCase();
    const id = String(p.file || '').replace(/[^\w-]/g, '').slice(0, 20);
    let to = `assets/slides/${files.size > 1 && id ? id + '-' : ''}slide-${pad3(p.page)}.${ext}`;
    if (used.has(to) || !(p.page > 0)) to = 'assets/slides/' + p.image.slice('assets/slides/'.length).replace(/\//g, '-');
    map.set(p.image, to); used.add(to);
  }
  return map;
}

/** 값 속 경로 글자를 바꿈(설계도·교재 해석의 그림 주소) */
function renamePaths(x, map) {
  if (!map.size) return x;
  const walk = (v) => (typeof v === 'string' ? (map.has(v) ? map.get(v) : v) : Array.isArray(v) ? v.map(walk) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, w]) => [k, walk(w)])) : v);
  return walk(x);
}

/**
 * 스킬 작업 폴더 → .lecpage에 넣을 파일들(앱이 스스로 만든 연수와 같은 모양).
 * @param blueprint 설계도(부른 쪽이 sanitizeImported로 비밀·접속 주소를 정리해서 줌)
 * @param material 교재 해석(material.json) 또는 null
 * @param info 스킬의 info.json(형식·요청 사항만 씀)
 * @param assets { 'assets/slides/…': bytes, … } 작업 폴더의 자료
 * @param originals [{ name, bytes }] 교재 원본(없으면 빈 배열)
 * @param summary 교재 한 줄 요약(앱 '교재 넣기'에 보임)
 * @returns { files: {'project.json': 글, …자료}, project, counts, dropped }
 */
export function packProject({ blueprint, material = null, info = {}, assets = {}, originals = [], summary = '', now = Date.now(), origin = 'skill' }) {
  const map = slideRenames(material);
  const bp = renamePaths(blueprint, map);
  let mat = null;
  if (material) {
    mat = renamePaths(material, map);
    // 이 컴퓨터의 파일 경로는 담지 않음(개인 폴더 이름이 드러남)
    mat.files = (mat.files || []).map(({ path, ...f }) => f);
  }
  const files = {}; const dropped = [];
  const counts = { slides: 0, media: 0, files: 0, originals: 0 };
  for (const [k0, v] of Object.entries(assets)) {
    const k = map.get(k0) || (/^assets\/(slides|media|files)\//.test(k0) ? k0.replace(/^(assets\/(?:slides|media|files)\/)(.*)$/, (_, a, b) => a + b.replace(/\//g, '-')) : k0);
    if (!isAllowedAsset(k)) { dropped.push(k0); continue; }
    files[k] = v; counts[k.startsWith('assets/slides/') ? 'slides' : k.startsWith('assets/media/') ? 'media' : 'files']++;
  }
  const srcKeys = new Map();
  for (const o of originals) {
    const k = srcKey(o.name);
    if (!isAllowedAsset(k) || files[k]) { dropped.push(o.name); continue; }
    files[k] = o.bytes; srcKeys.set(o.name, k); counts.originals++;
  }
  // 교재 목록: 앱 '교재 넣기'의 파일 줄과 같은 모양(링크로 받은 교재는 빼요)
  const list = (mat?.files || []).filter((f) => f.type !== 'link').map((f) => {
    const ext = (/\.(\w+)$/.exec(f.name || '')?.[1] || f.type || '').toLowerCase();
    return { name: f.name, ...(srcKeys.has(f.name) ? { key: srcKeys.get(f.name) } : {}), size: f.size || 0, ext, pages: f.pages || 0, errors: [] };
  });
  const title = str(bp?.meta?.title);
  const project = {
    title, stage: 2, createdAt: now, origin,
    files: list, material: mat, info: appInfoFrom(bp, info), blueprint: bp,
    autoFilled: {}, infoTouched: true, slidesMade: counts.slides, summary: summary || '',
    draftFormat: APP_FORMATS.includes(info.format) ? info.format : '', visited: {},
  };
  files['project.json'] = JSON.stringify({ format: PROJECT_FORMAT, version: PROJECT_VERSION, project }, null, 2);
  // project.json을 맨 앞에(사람이 ZIP을 열어 볼 때)
  const ordered = { 'project.json': files['project.json'] };
  for (const [k, v] of Object.entries(files)) if (k !== 'project.json') ordered[k] = v;
  return { files: ordered, project, counts, dropped };
}

/**
 * .lecpage 안의 파일들 → 스킬 작업 폴더에 쓸 것. 비밀·접속 주소는 받지 않음(설계도는 부른 쪽이 sanitizeImported로 다시 정리).
 * @returns { project, blueprint, material, info, assets: {'assets/…': bytes}, originals: [{ key, file, name, bytes }] }
 */
export function unpackProject(zipFiles) {
  const pj = zipFiles['project.json'];
  if (!pj) throw bad('project.json이 없는 파일이에요. lecpage에서 저장한 .lecpage 파일인지 확인해 주세요.');
  let j; try { j = JSON.parse(new TextDecoder().decode(pj)); } catch { throw bad('project.json을 읽지 못했어요. 앱에서 다시 [파일로 저장]해 주세요.'); }
  if (j?.format !== PROJECT_FORMAT || !j.project || typeof j.project !== 'object') throw bad('lecpage 연수 파일이 아니에요. 앱에서 [파일로 저장]으로 만든 파일을 주세요.');
  const proj = j.project;
  const assets = {}; const originals = [];
  const names = new Map((proj.files || []).filter((f) => f?.key).map((f) => [f.key, f.name]));
  for (const [k, v] of Object.entries(zipFiles)) {
    if (k === 'project.json' || !isAllowedAsset(k)) continue;
    if (k.startsWith('src/')) originals.push({ key: k, file: k.slice(4), name: names.get(k) || k.slice(4), bytes: v });
    else assets[k.startsWith('assets/') ? k : 'assets/' + k] = v;
  }
  return { project: proj, blueprint: proj.blueprint || null, material: proj.material || null, info: workInfoFrom(proj.info), assets, originals };
}
