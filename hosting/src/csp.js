// 사이트 파일에 붙이는 응답 머리글. 올라온 _headers는 쓰지 않고 전부 여기서 정합니다.
// 모든 사이트가 한 출처를 같이 쓰므로 script-src는 'self'뿐입니다(올라온 .js는 엔진 런타임만 받음 → src/runtime.js).

/** 엔진이 글꼴을 불러오는 곳(engine/src/render/pages.js의 cspMeta, design/fonts.js·seeds.js). test/csp.test.mjs가 엔진과 맞는지 확인 */
export const FONT_CSS_HOSTS = ['https://fonts.googleapis.com', 'https://cdn.jsdelivr.net', 'https://hangeul.pstatic.net'];
export const FONT_FILE_HOSTS = ['https://fonts.gstatic.com', 'https://cdn.jsdelivr.net', 'https://hangeul.pstatic.net'];
/** 엔진은 영상을 틀(iframe)로 넣지 않음(cspMeta가 frame-src 'none'). 넣게 되면 여기에 호스트를 추가 */
export const FRAME_HOSTS = [];
/** 다른 사이트의 틀 안에 넣지 못하게 하는 강사용 화면(엔진의 _headers와 같음) */
export const NO_FRAME_PAGES = new Set(['console.html', 'screen.html', 'poster.html']);

/**
 * @param {{ noFrame?: boolean, scripts?: string[] }} [o] scripts = 'self' 말고 더 허용할 스크립트 주소(파일 하나를 가리키는 전체 주소만. 기본은 없음)
 */
export function htmlCsp({ noFrame = false, scripts = [] } = {}) {
  const extra = scripts.filter((u) => /^https:\/\/[a-z0-9.-]+\/[A-Za-z0-9@_.\/-]+\.js$/.test(u));
  const p = [
    "default-src 'none'",
    `script-src 'self'${extra.length ? ` ${extra.join(' ')}` : ''}`,
    `style-src 'self' 'unsafe-inline' ${FONT_CSS_HOSTS.join(' ')}`,
    `font-src 'self' data: ${FONT_FILE_HOSTS.join(' ')}`,
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "connect-src 'self' https: wss:",
    `frame-src ${FRAME_HOSTS.length ? FRAME_HOSTS.join(' ') : "'none'"}`,
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ];
  if (noFrame) p.push("frame-ancestors 'none'");
  return p.join('; ');
}
/** SVG를 주소로 바로 열어도 스크립트가 돌지 않게 */
export const SVG_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
/** 호스트가 직접 만드는 안내 화면(404·기간 끝·가림) */
export const NOTICE_CSP = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
/** HTML을 고쳐서 내보내는 방식이 바뀌면 올려서 브라우저가 새로 받게 함 */
export const HTML_REV = 'r1';

export const BASE_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'x-robots-tag': 'noindex, nofollow',
};

export function etagOf(sha, type) {
  return type.kind === 'html' ? `"${sha}-${HTML_REV}"` : `"${sha}"`;
}

/** If-None-Match 값에 이 etag가 있는지(약한 비교) */
export function etagMatches(header, etag) {
  if (!header) return false;
  return header.split(',').some((t) => { const v = t.trim().replace(/^W\//, ''); return v === '*' || v === etag; });
}

/**
 * @param {string} path 사이트 안 경로
 * @param {{type:string, kind:string, download?:boolean, sameOrigin:boolean}} type typeOf(path)
 * @param {string} sha
 * @param {{ scripts?: string[] }} [opts] htmlCsp에 넘길 값
 * @returns {Record<string,string>}
 */
export function fileHeaders(path, type, sha, opts = {}) {
  const h = { ...BASE_HEADERS, 'content-type': type.type, etag: etagOf(sha, type) };
  if (type.kind === 'html') {
    const noFrame = NO_FRAME_PAGES.has(path);
    h['content-security-policy'] = htmlCsp({ noFrame, scripts: opts.scripts });
    if (noFrame) h['x-frame-options'] = 'DENY';
    h['cache-control'] = 'no-cache';
  } else {
    h['cache-control'] = 'public, max-age=600';
    h['accept-ranges'] = 'bytes';
    if (type.kind === 'svg') h['content-security-policy'] = SVG_CSP;
    if (type.sameOrigin) h['cross-origin-resource-policy'] = 'same-origin';
    if (type.download) h['content-disposition'] = 'attachment';
  }
  return h;
}

/**
 * Range: bytes=a-b | a- | -n (하나만).
 * @returns {null | {start:number,end:number} | 'invalid'} null이면 전체를 보냄
 */
export function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return null; // 모르는 모양은 무시하고 전체
  if (size === 0) return 'invalid';
  let start; let end;
  if (m[1] === '') { const n = Number(m[2]); if (n === 0) return 'invalid'; start = Math.max(0, size - n); end = size - 1; }
  else { start = Number(m[1]); end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1); }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) return 'invalid';
  return { start, end };
}
