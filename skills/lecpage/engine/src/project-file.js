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

/**
 * .lecpage 파일의 크기·항목 수 위쪽 끝. 저장(writeStoredZipBlob)과 열기(readStoredZip·readStoredZipBlob)가 같은 숫자를 씀 → 저장된 파일은 다시 열림.
 * 크기는 ZIP의 32비트 크기·자리 한계(4GiB)에 여유를 둔 값. 넘는 연수는 저장하기 전에 알림(큰 교재를 따로 보관하라고)
 */
export const PROJECT_FILE_MAX = 3.9e9;
export const PROJECT_FILE_MAX_FILES = 5000;
const TOO_BIG_OPEN = '저장한 파일이 너무 커요(약 3.9GB까지). lecpage에서 큰 교재를 빼고 다시 저장한 파일을 열어 주세요.';
const NOT_OURS = 'lecpage에서 저장한 .lecpage 파일만 열 수 있어요. [파일로 저장]으로 만든 파일인지 확인해 주세요.';
const BAD_PATH = '파일 안의 경로가 올바르지 않아요. lecpage에서 다시 저장한 파일을 열어 주세요.';

let CRC_T = null;
/** CRC-32 이어 세기: c는 앞 조각까지의 값(처음 0xffffffff), 끝에 (c ^ 0xffffffff) >>> 0 */
function crcMore(c, u8) {
  if (!CRC_T) { CRC_T = new Uint32Array(256); for (let n = 0; n < 256; n++) { let x = n; for (let k = 0; k < 8; k++) x = x & 1 ? 0xedb88320 ^ (x >>> 1) : x >>> 1; CRC_T[n] = x >>> 0; } }
  for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
  return c;
}
const asBlob = (v) => (typeof Blob !== 'undefined' && v instanceof Blob ? v : new Blob([v]));
/** Blob의 CRC-32와 크기(조각조각 읽어 큰 파일도 메모리에 통째로 올리지 않음) */
export async function blobCrc(blob, chunk = 8 * 1024 * 1024) {
  let c = 0xffffffff;
  for (let p = 0; p < blob.size; p += chunk) c = crcMore(c, new Uint8Array(await blob.slice(p, p + chunk).arrayBuffer()));
  return { crc: (c ^ 0xffffffff) >>> 0, size: blob.size };
}

/**
 * 무압축 ZIP을 Blob으로 씀(큰 연수용): 항목을 하나씩 받아 Blob 조각으로 잇기만 하므로 연수 전체를 메모리에 올리지 않음.
 * add(이름, 글|바이트|Blob, { crc, size }?) — crc·size를 이미 알면 다시 읽지 않음. finish() → Blob(application/zip).
 * 다시 열 수 없는 크기(PROJECT_FILE_MAX·항목 수·항목 하나 4GiB)면 finish()가 화면에 그대로 보일 오류(err.friendly)를 던짐 → 저장하기 전에 알림
 */
export function storedZipWriter({ date = new Date(), maxBytes = PROJECT_FILE_MAX, maxFiles = PROJECT_FILE_MAX_FILES } = {}) {
  const enc = new TextEncoder();
  const time = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xffff;
  const day = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;
  const parts = []; const centrals = []; let offset = 0; let n = 0;
  return {
    /** 지금까지 담은 크기(머리 포함) */
    get size() { return offset; },
    async add(path, content, known = null) {
      const data = asBlob(content); const name = enc.encode(path);
      const { crc, size } = known && Number.isInteger(known.crc) && known.size === data.size ? known : await blobCrc(data);
      const lh = new Uint8Array(30 + name.length); const lv = new DataView(lh.buffer);
      lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, 0, true);
      lv.setUint16(10, time, true); lv.setUint16(12, day, true); lv.setUint32(14, crc, true); lv.setUint32(18, size >>> 0, true); lv.setUint32(22, size >>> 0, true);
      lv.setUint16(26, name.length, true); lv.setUint16(28, 0, true); lh.set(name, 30);
      const ch = new Uint8Array(46 + name.length); const cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
      cv.setUint16(12, time, true); cv.setUint16(14, day, true); cv.setUint32(16, crc, true); cv.setUint32(20, size >>> 0, true); cv.setUint32(24, size >>> 0, true);
      cv.setUint16(28, name.length, true); cv.setUint32(42, offset >>> 0, true); ch.set(name, 46);
      parts.push(lh, data); centrals.push(ch);
      offset += lh.length + size; n++;
      if (size > 0xfffffffe || offset > maxBytes || n > maxFiles) throw bad('연수가 너무 커서 파일 하나로 저장할 수 없어요(약 3.9GB까지). 큰 교재를 빼고 저장한 뒤, 그 교재 파일은 따로 보관해 주세요.');
    },
    finish() {
      const cdSize = centrals.reduce((a, c) => a + c.length, 0);
      const end = new Uint8Array(22); const ev = new DataView(end.buffer);
      ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, Math.min(n, 0xffff), true); ev.setUint16(10, Math.min(n, 0xffff), true); ev.setUint32(12, cdSize, true); ev.setUint32(16, offset >>> 0, true);
      return new Blob([...parts, ...centrals, end], { type: 'application/zip' });
    },
  };
}

/**
 * 무압축 ZIP을 Blob(파일)에서 읽음: 머리만 읽고 내용은 Blob 조각으로 돌려줌 → { 이름: Blob }. 큰 연수 파일을 메모리에 통째로 올리지 않음.
 * 규칙·오류는 readStoredZip과 같음(lecpage가 만든 무압축 ZIP만, 경로 확인, 크기·항목 수 한도)
 */
export async function readStoredZipBlob(blob, { maxFiles = PROJECT_FILE_MAX_FILES, maxBytes = PROJECT_FILE_MAX } = {}) {
  const out = {}; const dec = new TextDecoder(); let p = 0, n = 0, total = 0;
  const HEAD = 30 + 600; // 머리 30바이트 + 이름(보통 수십 바이트)까지 한 번에
  while (p + 30 <= blob.size) {
    let u8 = new Uint8Array(await blob.slice(p, Math.min(blob.size, p + HEAD)).arrayBuffer());
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    if (u8.length < 30 || dv.getUint32(0, true) !== 0x04034b50) break;
    const method = dv.getUint16(8, true), size = dv.getUint32(18, true), nameLen = dv.getUint16(26, true), extra = dv.getUint16(28, true);
    if (method !== 0) throw bad(NOT_OURS);
    if (u8.length < 30 + nameLen) u8 = new Uint8Array(await blob.slice(p, p + 30 + nameLen).arrayBuffer());
    const name = dec.decode(u8.subarray(30, 30 + nameLen));
    const start = p + 30 + nameLen + extra;
    if (name.includes('..') || name.startsWith('/')) throw bad(BAD_PATH);
    if (start + size > blob.size) throw bad(NOT_OURS);
    out[name] = blob.slice(start, start + size);
    total += size; n++; if (n > maxFiles || total > maxBytes) throw bad(TOO_BIG_OPEN);
    p = start + size;
  }
  return out;
}

/** 무압축 ZIP 읽기(lecpage가 만든 파일) — 다른 압축 ZIP은 거절 */
export function readStoredZip(buf, { maxFiles = PROJECT_FILE_MAX_FILES, maxBytes = PROJECT_FILE_MAX } = {}) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf); const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const out = {}; let p = 0, n = 0, total = 0; const dec = new TextDecoder();
  while (p + 30 <= u8.length && dv.getUint32(p, true) === 0x04034b50) {
    const method = dv.getUint16(p + 8, true), size = dv.getUint32(p + 18, true), nameLen = dv.getUint16(p + 26, true), extra = dv.getUint16(p + 28, true);
    if (method !== 0) throw bad(NOT_OURS);
    const name = dec.decode(u8.subarray(p + 30, p + 30 + nameLen));
    const start = p + 30 + nameLen + extra;
    if (name.includes('..') || name.startsWith('/')) throw bad(BAD_PATH);
    out[name] = u8.slice(start, start + size);
    total += size; n++; if (n > maxFiles || total > maxBytes) throw bad(TOO_BIG_OPEN);
    p = start + size;
  }
  return out;
}

/**
 * 저장할 때 한 벌만 담은 교재 쪽 그림을 되살릴 짝: project.json의 same { '뺀 경로': '담은 경로' }.
 * 앱은 교재를 넣을 때 그린 쪽 그림(assets/slides/slide-NNN)을 사이트용(site/material/p-NNN)으로 한 벌 더 두는데, 내용이 같으면 파일에는 사이트용만 담고
 * 여기에 짝을 적음. 받는 것은 이 두 자리의 같은 번호끼리만(그 밖의 경로는 무시) → [['assets/slides/slide-001.webp', 'site/material/p-001.webp'], …]
 */
export function sameEntries(j) {
  const s = j && typeof j.same === 'object' && j.same ? j.same : {}; const out = [];
  for (const [dst, src] of Object.entries(s)) {
    const a = /^assets\/slides\/slide-(\d{1,5})\.(webp|png|jpe?g)$/i.exec(String(dst)); const b = /^site\/material\/p-(\d{1,5})\.(webp|png|jpe?g)$/i.exec(String(src));
    if (a && b && +a[1] === +b[1]) out.push([dst, src]);
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
  for (const [dst, src] of sameEntries(j)) if (assets[dst] === undefined && zipFiles[src] !== undefined) assets[dst] = zipFiles[src];
  return { project: proj, blueprint: proj.blueprint || null, material: proj.material || null, assets, originals, formatVersion: +j.version || 0, engine: typeof j.engine === 'string' ? j.engine.slice(0, 20) : '' };
}
