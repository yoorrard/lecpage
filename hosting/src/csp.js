// 사이트 파일에 붙이는 응답 머리글. 올라온 _headers는 쓰지 않고 전부 여기서 정합니다.
// HTML의 CSP는 두 가지입니다.
//  - 사이트 쪽(siteCsp): 첫 화면처럼 AI·강사가 쓴 쪽. 사이트가 직접 쓴 스크립트(assets/site.js 등)도 돌 수 있으므로
//    연결(connect-src)·그림·소리는 이 사이트와 그 사이트의 실시간 방으로만 좁힘. 스크립트는 'self'와 고정 라이브러리만(인라인은 막음)
//  - 보조 쪽(auxCsp): 엔진이 만드는 강사 화면·발표 화면·QR 안내문·접속 확인·개인정보 안내. 엔진 런타임만 돌고(sitecheck.js가 확인)
//    접속 확인은 바깥 도구가 열리는지 재야 해서 예전처럼 넓게 둠
// 사이트가 직접 쓴 스크립트는 사이트마다 출처가 갈리는 pages 보기에서만 받음(site.js). 모든 사이트가 같이 쓰는 이 호스트 주소에서는 내보내지 않음
import { ID_RE } from './ids.js';

/** 엔진이 글꼴을 불러오는 곳(engine/src/render/shell.js의 cspPolicy, design/fonts.js·kit/assemble.js FONT_CSS_HOSTS). test/csp.test.mjs가 엔진과 맞는지 확인 */
export const FONT_CSS_HOSTS = ['https://fonts.googleapis.com', 'https://cdn.jsdelivr.net', 'https://hangeul.pstatic.net'];
export const FONT_FILE_HOSTS = ['https://fonts.gstatic.com', 'https://cdn.jsdelivr.net', 'https://hangeul.pstatic.net'];
/** 버전까지 고정해 불러오는 라이브러리 경로(효과·Supabase). 엔진 render/shell.js의 LIB_SCRIPT_SOURCES와 같음(test/csp.test.mjs가 확인) */
export const LIB_SCRIPT_SOURCES = ['https://cdn.jsdelivr.net/npm/gsap@3.15.1/', 'https://cdn.jsdelivr.net/npm/lenis@1.3.27/', 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/', 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/'];
/** 사이트 쪽에 넣을 수 있는 영상 틀(유튜브는 쿠키 없는 주소만). 보조 쪽은 틀을 쓰지 않음 */
export const FRAME_HOSTS = ['https://www.youtube-nocookie.com', 'https://player.vimeo.com'];
/** 다른 사이트의 틀 안에 넣지 못하게 하는 강사용 화면(엔진의 _headers와 같음) */
export const NO_FRAME_PAGES = new Set(['console.html', 'screen.html', 'poster.html']);
/**
 * 창 사이 연결을 끊는 쪽(Cross-Origin-Opener-Policy: same-origin, 엔진 조립의 _headers와 같음): 관리자 키를 다루는 강사 화면·발표 화면.
 * 같은 출처의 사이트 스크립트가 window.open('console.html')로 연 창의 키 입력 칸·저장소에 손대지 못하게(COOP가 없는 쪽에서 열면 창 연결이 끊김)
 */
export const COOP_PAGES = new Set(['console.html', 'screen.html']);
/** 엔진이 만드는 보조 쪽(엔진 kit/aux-build.js가 만드는 쪽, kit/paths.js ENGINE_PAGES와 같음). 맨 위 폴더의 이 이름만 */
export const AUX_PAGES = new Set([...NO_FRAME_PAGES, 'check.html', 'privacy.html']);

const HOST_RE = /^https?:\/\/[a-z0-9.-]+(?::\d{1,5})?$/;
const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;
/** 사이트가 적을 수 있는 바깥 실시간 서버(강사 계정 서버 모양): Cloudflare Worker(workers.dev)·Supabase 프로젝트 */
const LIVE_HOST_RE = { http: /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+workers\.dev$/, supabase: /^[a-z0-9]{8,40}\.supabase\.co$/ };
/**
 * 강사가 자기 도메인에 둔 참여 기능 서버(backends/node-server·cloudflare, provider 'http'): 점이 있는 공개 도메인 이름만.
 * 마지막 이름이 글자로 시작해야 해서 IP 주소는 빠지고(IPv6는 URL 모양에서 빠짐), localhost·사내 이름(.local·.internal 등)도 뺌.
 * 그 사이트의 CSP에 그 출처 하나만 들어가므로(와일드카드 없음) 강사 계정 workers.dev 주소와 열리는 범위가 같음
 */
const OWN_HOST_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const PRIVATE_NAME_RE = /(?:^|\.)(?:localhost|local|localdomain|internal|intranet|lan|home|corp|private|test|example|invalid|onion|home\.arpa)$/;
const SHEETS = ['https://script.google.com', 'https://script.googleusercontent.com'];

/**
 * 사이트 자료(lp-data)의 live 칸이 가리키는 바깥 실시간 서버의 갈래(앱의 바로 배포 화면도 같은 코드로 판단: app/src/lib/deploy.js instantLiveOk).
 * 'account': 강사 계정 서버 모양(https의 workers.dev·supabase.co, 구글 시트) | 'own': 자기 도메인의 참여 기능 서버(https, provider 'http') | '': 열지 않음
 * @param {any} live { provider, url?, health? }
 * @param {string} [self] 이 호스트 주소(이 호스트의 방은 묶인 코드로 따로 넣으므로 뺌)
 * @returns {'account'|'own'|''}
 */
export function liveKind(live, self = '') {
  if (!live || typeof live !== 'object') return '';
  if (live.provider === 'sheets') return 'account';
  if (!LIVE_HOST_RE[live.provider]) return '';
  let u;
  try { u = new URL(String(live.url || live.health || '')); } catch { return ''; }
  if (u.protocol !== 'https:' || u.username || u.password || u.origin === self) return '';
  if (!u.port && LIVE_HOST_RE[live.provider].test(u.hostname)) return 'account';
  if (live.provider === 'http' && OWN_HOST_RE.test(u.hostname) && !PRIVATE_NAME_RE.test(u.hostname)) return 'own';
  return '';
}
/** 구글 시트 연결의 보드 사진(드라이브). 그림으로만(엔진 kit/assemble.js kitCsp와 같음) */
const SHEETS_IMG = ['https://drive.google.com', 'https://*.googleusercontent.com'];

/**
 * 사이트 자료(lp-data)의 live 칸 → 연결을 열 바깥 실시간 서버 출처. 엔진 render/shell.js의 liveOrigins와 같은 생각이되,
 * 주소는 liveKind가 받는 것(강사 계정 서버 모양, 자기 도메인의 https 참여 기능 서버)만. 출처 하나와 같은 호스트의 wss
 * @param {any} live { provider, url?, health? }
 * @param {string} [self] 이 호스트 주소
 * @returns {string[]}
 */
export function declaredLive(live, self = '') {
  const kind = liveKind(live, self);
  if (!kind) return [];
  if (live.provider === 'sheets') return [...SHEETS];
  const u = new URL(String(live.url || live.health));
  return [u.origin, `wss://${u.host}`];
}

/**
 * 사이트 쪽이 닿을 수 있는 곳: 이 사이트에 묶인 실시간 방(질문·투표·보드 파일)과 사이트가 적은 바깥 실시간 서버.
 * 방 주소는 코드까지 넣은 경로라 같은 호스트의 다른 방에는 닿지 못함(https·wss 모두 경로로 맞춤)
 * @param {{ host?: string, code?: string, site?: string, pages?: boolean, live?: string[] }} [c]
 *   host: 이 호스트 주소, code: 묶인 방 코드, site: 사이트 id, pages: Pages 보기(사이트 출처가 이 호스트와 다름 → 영상은 이 호스트에서),
 *   live: declaredLive가 돌려준 출처들
 * @returns {{ connect: string[], img: string[], media: string[] }}
 */
export function roomSources({ host = '', code = '', site = '', pages = false, live = [] } = {}) {
  const connect = []; const img = []; const media = [];
  if (HOST_RE.test(host)) {
    if (CODE_RE.test(code)) {
      const room = `${host}/live/api/${code}`;
      const file = `${host}/api/${code}/files/`; // 보드 사진·파일(live/host.js FILE_ALIAS)
      connect.push(room, `${room}/`, `${host.replace(/^http/, 'ws')}/live/api/${code}/`, file);
      img.push(file); media.push(file);
    }
    if (pages && ID_RE.test(site)) media.push(`${host}/s/${site}/`); // 영상·소리는 Pages가 이 호스트로 넘김(pages-site.js redirectsFile)
  }
  for (const o of live) {
    if (!/^(?:https|wss):\/\/[a-z0-9.-]+(?::\d{1,5})?$/.test(o)) continue;
    connect.push(o);
    if (o.startsWith('https:')) { img.push(o); media.push(o); } // 강사 계정 서버의 보드 파일
  }
  if (live.includes(SHEETS[0])) img.push(...SHEETS_IMG);
  return { connect: [...new Set(connect)], img: [...new Set(img)], media: [...new Set(media)] };
}

/**
 * 사이트 쪽 CSP(서버가 정함). 엔진 조립이 넣는 meta CSP(kit/assemble.js kitCsp)는 브라우저가 이것과 겹쳐(둘 다) 적용함.
 * 지시어와 출처는 kitCsp와 같고(test/csp.test.mjs가 비교), 서버는 더 좁게만: default-src 'none', 실시간 방은 출처 전체가 아니라 그 방 경로
 * @param {Parameters<typeof roomSources>[0]} [c]
 */
export function siteCsp(c = {}) {
  const r = roomSources(c);
  return [
    "default-src 'none'",
    `script-src 'self' ${LIB_SCRIPT_SOURCES.join(' ')}`,
    `style-src 'self' 'unsafe-inline' ${FONT_CSS_HOSTS.join(' ')}`,
    `font-src 'self' data: ${FONT_FILE_HOSTS.join(' ')}`,
    // blob: 엔진 런타임이 보드 사진을 줄일 때·암호 사이트가 풀어 낸 그림을 보일 때. 이 페이지가 만든 것만 가리켜 바깥으로 나가는 길이 아님
    `img-src ${["'self'", 'data:', 'blob:', ...r.img].join(' ')}`,
    `media-src ${["'self'", 'blob:', ...r.media].join(' ')}`,
    `connect-src ${["'self'", ...r.connect].join(' ')}`,
    `frame-src ${FRAME_HOSTS.join(' ')}`,
    "worker-src 'none'",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
    // 엔진은 이 지시어를 meta에 넣지 않음(http로 여는 내부망 서버에서 사이트가 깨짐). 여기는 늘 https라 서버가 붙임
    'upgrade-insecure-requests',
  ].join('; ');
}

/** 보조 쪽 CSP(예전 규칙 + 고정 라이브러리, 일꾼 스크립트 없음). noFrame: 다른 사이트의 틀에 넣지 못하게 */
export function auxCsp({ noFrame = false } = {}) {
  const p = [
    "default-src 'none'",
    `script-src 'self' ${LIB_SCRIPT_SOURCES.join(' ')}`,
    `style-src 'self' 'unsafe-inline' ${FONT_CSS_HOSTS.join(' ')}`,
    `font-src 'self' data: ${FONT_FILE_HOSTS.join(' ')}`,
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "connect-src 'self' https: wss:",
    "frame-src 'none'",
    "worker-src 'none'",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ];
  if (noFrame) p.push("frame-ancestors 'none'");
  return p.join('; ');
}

/**
 * HTML 하나의 CSP: 맨 위 폴더의 보조 쪽 이름이면 auxCsp, 나머지는 siteCsp
 * @param {string} path 사이트 안 경로
 * @param {Parameters<typeof roomSources>[0]} [c]
 */
export function htmlCsp(path, c = {}) {
  return AUX_PAGES.has(path) ? auxCsp({ noFrame: NO_FRAME_PAGES.has(path) }) : siteCsp(c);
}
/** SVG를 주소로 바로 열어도 스크립트가 돌지 않게 */
export const SVG_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
/** 호스트가 직접 만드는 안내 화면(404·기간 끝·가림) */
export const NOTICE_CSP = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
/** HTML을 고쳐서 내보내는 방식이 바뀌면 올려서 브라우저가 새로 받게 함 */
export const HTML_REV = 'r3';
/** 주소에 내용 지문(?v=)이 붙은 파일: 내용이 바뀌면 주소가 바뀌므로 브라우저가 1년 둠 */
export const IMMUTABLE = 'public, max-age=31536000, immutable';
/** 지문 없는 파일: 10분 둔 뒤 다시 물어봄(304) */
export const SHORT = 'public, max-age=600';

export const BASE_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'x-robots-tag': 'noindex, nofollow',
};

/**
 * HTML은 내보낼 때 다른 파일의 지문(?v=)·공지를 넣으므로 배포·공지가 바뀌면 etag도 바뀌어야 함 → tag에 담음
 * @param {string} [tag] HTML일 때 덧붙일 글자(배포 id 앞부분 등)
 */
export function etagOf(sha, type, tag = '') {
  return type.kind === 'html' ? `"${sha}${tag ? `-${tag}` : ''}-${HTML_REV}"` : `"${sha}"`;
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
 * @param {{ csp?: object, tag?: string, immutable?: boolean }} [opts] csp: htmlCsp에 넘길 값(roomSources), tag: HTML etag에 덧붙일 글자, immutable: 주소의 지문이 맞음
 * @returns {Record<string,string>}
 */
export function fileHeaders(path, type, sha, opts = {}) {
  const h = { ...BASE_HEADERS, 'content-type': type.type, etag: etagOf(sha, type, opts.tag) };
  if (type.kind === 'html') {
    const noFrame = NO_FRAME_PAGES.has(path);
    h['content-security-policy'] = htmlCsp(path, opts.csp);
    if (noFrame) h['x-frame-options'] = 'DENY';
    if (COOP_PAGES.has(path)) h['cross-origin-opener-policy'] = 'same-origin';
    h['cache-control'] = 'no-cache';
  } else {
    h['cache-control'] = opts.immutable ? IMMUTABLE : SHORT;
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
