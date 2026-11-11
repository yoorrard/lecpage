// 받는 경로와 파일 형식. 형식은 확장자로만 정하고, 응답의 Content-Type도 여기 표에서만 나옵니다.

export const MAX_PATH = 200;
export const MAX_DEPTH = 8;
/** 엔진의 USER_ASSET과 같은 글자만: 영문·숫자·한글·밑줄·점·붙임표·괄호·대괄호·빈칸 */
const SEGMENT = /^[A-Za-z0-9_가-힣ㄱ-ㅎㅏ-ㅣ.\-()[\] ]+$/;
/** 목록에 있어도 받지 않고 넘기는 파일(응답 헤더는 서버가 정함) */
export const IGNORED = new Set(['_headers']);

const T = (type, more = {}) => ({ type, kind: 'file', ...more });
/** 확장자 → 응답 형식. kind: html(고쳐서 보냄)·js(런타임만)·svg(가둠)·file. download: 열지 않고 내려받게 */
export const TYPES = {
  html: T('text/html; charset=utf-8', { kind: 'html' }),
  css: T('text/css; charset=utf-8'),
  js: T('text/javascript; charset=utf-8', { kind: 'js' }),
  json: T('application/json; charset=utf-8'),
  webmanifest: T('application/manifest+json; charset=utf-8'),
  txt: T('text/plain; charset=utf-8'),
  svg: T('image/svg+xml', { kind: 'svg' }),
  png: T('image/png'), jpg: T('image/jpeg'), jpeg: T('image/jpeg'), webp: T('image/webp'), avif: T('image/avif'), gif: T('image/gif'), ico: T('image/x-icon'),
  woff2: T('font/woff2'),
  pdf: T('application/pdf'),
  // 엔진이 사이트에 넣어 주는 소리·영상(engine/src/build.js의 USER_ASSET)
  mp3: T('audio/mpeg'), m4a: T('audio/mp4'), mp4: T('video/mp4'), webm: T('video/webm'),
  // 원본·내려받기 자료(assets/media, assets/files): 브라우저에서 열지 않고 내려받기만
  ppt: T('application/vnd.ms-powerpoint', { download: true }),
  pptx: T('application/vnd.openxmlformats-officedocument.presentationml.presentation', { download: true }),
  ppsx: T('application/vnd.openxmlformats-officedocument.presentationml.slideshow', { download: true }),
  doc: T('application/msword', { download: true }),
  docx: T('application/vnd.openxmlformats-officedocument.wordprocessingml.document', { download: true }),
  xls: T('application/vnd.ms-excel', { download: true }),
  xlsx: T('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', { download: true }),
  hwp: T('application/x-hwp', { download: true }),
  hwpx: T('application/hwp+zip', { download: true }),
  key: T('application/vnd.apple.keynote', { download: true }),
  pages: T('application/vnd.apple.pages', { download: true }),
  numbers: T('application/vnd.apple.numbers', { download: true }),
  odt: T('application/vnd.oasis.opendocument.text', { download: true }),
  odp: T('application/vnd.oasis.opendocument.presentation', { download: true }),
  ods: T('application/vnd.oasis.opendocument.spreadsheet', { download: true }),
  csv: T('text/csv; charset=utf-8', { download: true }),
  md: T('text/markdown; charset=utf-8', { download: true }),
  zip: T('application/zip', { download: true }),
  // 암호로 잠근 사이트의 교재 그림·자료(engine/src/protect.js). unlock.js가 받아서 풂
  enc: T('application/octet-stream'),
};
/** 다른 출처에서 불러 쓸 일이 없는 형식(Cross-Origin-Resource-Policy: same-origin). 그림은 앱의 "열리는지 확인"과 미리보기 카드가 불러 감 */
const SAME_ORIGIN_ONLY = new Set(['js', 'css', 'json', 'webmanifest', 'woff2', 'enc']);

export function extOf(path) {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}
/** @returns {{type:string, kind:string, download?:boolean, ext:string, sameOrigin:boolean}|null} */
export function typeOf(path) {
  const ext = extOf(path);
  const t = Object.hasOwn(TYPES, ext) ? TYPES[ext] : null;
  return t ? { ...t, ext, sameOrigin: SAME_ORIGIN_ONLY.has(ext) } : null;
}

/** 경로가 받을 수 있는 모양인지. 문제없으면 '' , 아니면 이유(한국어) */
export function checkPath(path) {
  if (typeof path !== 'string' || !path) return '경로가 비었어요';
  if (path.length > MAX_PATH) return `경로가 너무 길어요(${MAX_PATH}자까지)`;
  if (path !== path.normalize('NFC')) return '한글은 완성형(NFC)이어야 해요';
  const parts = path.split('/');
  if (parts.length > MAX_DEPTH) return '폴더가 너무 깊어요';
  for (const s of parts) {
    if (!s) return '빈 폴더 이름이나 맨 앞·맨 끝 빗금은 쓸 수 없어요';
    if (!SEGMENT.test(s)) return '쓸 수 없는 글자가 있어요';
    if (s.startsWith('.') || s.endsWith('.') || s.startsWith(' ') || s.endsWith(' ')) return '이름이 점·빈칸으로 시작하거나 끝나면 안 돼요';
    if (s.includes('..')) return '점을 잇달아 쓸 수 없어요';
  }
  return '';
}

/** 주소의 /s/<id>/ 뒤쪽 → 파일 경로. 폴더면 index.html. 못 쓰는 주소면 null */
export function requestPath(rest) {
  let p;
  try { p = decodeURIComponent(String(rest || '')); } catch { return null; }
  if (p === '' || p.endsWith('/')) p += 'index.html';
  return checkPath(p) ? null : p;
}
