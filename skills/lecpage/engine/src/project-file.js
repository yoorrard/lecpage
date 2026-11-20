// .lecpage 파일: 앱의 [파일로 저장]·[저장한 파일 열기]와 skill CLI(`lecpage.mjs app`)가 함께 쓰는 형식.
// 무압축 ZIP 하나에 project.json(연수 하나: 사이트·연수 정보·교재 목록)과 자료(쪽 그림·자료실 파일·교재 원본)를 담아요.
// AI 에이전트(Skill)가 만든 사이트 파일은 v2 꼴(kit/project-v2.js). 비밀 값(관리자 키·참여 기능 키·사이트 암호)은 담지 않아요.
// 앱 첫 화면이 이 파일을 읽으므로 다른 엔진 모듈을 불러오지 않아요(가볍게).

import { VERSION } from './version.js';

export const PROJECT_FORMAT = 'lecpage-project';
export const PROJECT_VERSION = 1;
/** 파일을 만든 lecpage 판(앱·skill이 project.json의 engine에 적음). 여는 쪽이 자기 판보다 새 파일이면 한 줄로 알림(versionNote) */
export const ENGINE_VERSION = VERSION;
const verNum = (v) => String(v || '').split('.').map((x) => parseInt(x, 10) || 0);
/** a가 b보다 새 판이면 true(1.10.0 > 1.9.0) */
export function newerVersion(a, b) { const x = verNum(a), y = verNum(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; }
/**
 * 연 파일이 지금 판보다 새 lecpage로 만든 것이면 알림 한 줄('' = 할 일 없음). 형식 판(version)·엔진 판(engine)을 봄.
 * 예전 판으로 만든 파일은 그대로 읽으므로 알리지 않음
 * @param file unpackProject 결과의 { formatVersion, engine }  @param how 새 판 받는 법(부른 쪽이 앱·skill에 맞게)
 */
export function versionNote({ formatVersion, engine } = {}, how = '') {
  const newer = (+formatVersion || 0) > PROJECT_VERSION || (engine && newerVersion(engine, ENGINE_VERSION));
  return newer ? `더 새 lecpage(${engine || `형식 ${formatVersion}`})로 만든 파일이에요. 지금 판(${ENGINE_VERSION})은 새 칸·설정을 빠뜨릴 수 있어요${how ? ` — ${how}` : ''}.` : '';
}
/** 앱 주소: 스킬이 만든 파일을 열 곳 */
export const APP_URL = 'https://lecpage.com/';

/** 앱의 연수 정보 기본값(앱 '교재 넣기'·'연수 정보' 칸) */
export const DEFAULT_INFO = {
  title: '', subtitle: '', organizer: '', date: '', start: '', end: '', venue: '', mode: 'offline',
  size: 25, format: '', features: [], devices: ['laptop'], network: 'good',
  minor: false, admin: 'school', completionRate: '', // 이수 기준(%)은 교재·강사가 정한 값만(빈 값이면 사이트에 %를 쓰지 않고 이수자 명단은 90%로 셈)
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

/**
 * 앱이 [파일로 저장]한 .lecpage(project.json { format, version:1, project }) 안의 파일들 → 연수와 자료.
 * @returns { project, blueprint(예전 판이면), material, assets: {'assets/…'|'site/…': bytes}, originals: [{ key, file, name, bytes }], formatVersion, engine }
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
  return { project: proj, blueprint: proj.blueprint || null, material: proj.material || null, assets, originals, formatVersion: +j.version || 0, engine: typeof j.engine === 'string' ? j.engine.slice(0, 20) : '' };
}
