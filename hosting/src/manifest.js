// 배포 목록({ files: { 경로: { sha256, size } } }) 검사와 "아직 없는 파일" 계산
import { HttpError } from './http.js';
import { checkPath, typeOf, IGNORED } from './paths.js';
import { SHA256_RE } from './ids.js';
import { MAX_JS_BYTES } from './runtime.js';

/**
 * @param {any} body 요청 본문
 * @param {{maxBytes:number, maxFileBytes:number, maxFiles:number}} limits
 * @returns {{ files: Array<[string, string, number]>, bytes: number, stored: number }}
 *   files = [경로, sha256, 크기][] (경로순), bytes = 파일 크기 합, stored = 같은 내용을 한 번만 센 크기
 */
export function checkManifest(body, limits) {
  const src = body && typeof body === 'object' ? body.files : null;
  if (!src || typeof src !== 'object' || Array.isArray(src)) throw new HttpError('bad_request', 'files에 올릴 파일 목록을 넣어 주세요.');
  const entries = Object.entries(src).filter(([p]) => !IGNORED.has(p));
  if (!entries.length) throw new HttpError('bad_request', '올릴 파일이 없어요.');
  if (entries.length > limits.maxFiles) throw new HttpError('too_many_files', `파일이 너무 많아요(${limits.maxFiles}개까지).`);
  const files = []; const sizes = new Map(); let bytes = 0;
  for (const [path, v] of entries) {
    const why = checkPath(path);
    if (why) throw new HttpError('bad_path', `올릴 수 없는 파일 이름이에요: ${show(path)} (${why})`, { path: show(path) });
    const type = typeOf(path);
    if (!type) throw new HttpError('bad_type', `올릴 수 없는 파일 형식이에요: ${path}`, { path });
    if (!v || typeof v !== 'object' || typeof v.sha256 !== 'string' || !SHA256_RE.test(v.sha256)) throw new HttpError('bad_request', `sha256이 맞지 않아요: ${path}`);
    if (!Number.isSafeInteger(v.size) || v.size < 0) throw new HttpError('bad_request', `size가 맞지 않아요: ${path}`);
    if (v.size > limits.maxFileBytes) throw new HttpError('too_large', `파일 하나가 너무 커요(${mb(limits.maxFileBytes)}까지): ${path}`, { path });
    if (type.kind === 'js' && v.size > MAX_JS_BYTES) throw new HttpError('runtime_mismatch', `lecpage 실행 파일이 아니에요: ${path}`, { path });
    if (sizes.has(v.sha256) && sizes.get(v.sha256) !== v.size) throw new HttpError('bad_request', `같은 sha256인데 size가 달라요: ${path}`);
    sizes.set(v.sha256, v.size);
    bytes += v.size;
    files.push([path, v.sha256, v.size]);
  }
  if (bytes > limits.maxBytes) throw new HttpError('too_large', `사이트가 너무 커요(${mb(limits.maxBytes)}까지).`);
  if (!Object.hasOwn(src, 'index.html')) throw new HttpError('bad_request', 'index.html이 있어야 해요.');
  files.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  let stored = 0;
  for (const n of sizes.values()) stored += n;
  return { files, bytes, stored };
}

/** 목록에 있는데 서버에 없는 sha256(겹치지 않게, 목록 순서대로) */
export function missingBlobs(files, have) {
  const out = []; const seen = new Set();
  for (const [, sha] of files) {
    if (seen.has(sha)) continue;
    seen.add(sha);
    if (!have.has(sha)) out.push(sha);
  }
  return out;
}

/** 목록에서 .js로 나갈 sha256 */
export function scriptBlobs(files) {
  const out = new Map();
  for (const [path, sha] of files) if (typeOf(path)?.kind === 'js' && !out.has(sha)) out.set(sha, path);
  return out;
}

const mb = (n) => `${Math.round(n / 1024 / 1024 * 10) / 10}MB`;
/** 오류 글에 넣을 때: 길이를 줄이고 제어 문자를 뺌 */
const show = (s) => String(s).replace(/[\u0000-\u001f\u007f]/g, '?').slice(0, 120);
