// VIEW=pages: 사이트 파일 보기를 Cloudflare Pages 미리보기 배포로 내보낼 때 쓰는 규칙들.
//  - 사이트마다 브랜치 's-<id>' → 별칭 주소 https://s-<id>.<프로젝트>.pages.dev (사이트마다 출처가 갈림)
//  - 정적 요청은 Workers 하루 요청 수에 들지 않음(공식 문서: 정적 자산 요청은 무료·무제한)
//  - 응답 머리글은 서버가 만든 _headers로만(올라온 _headers는 쓰지 않음), 형식은 확장자 표(paths.js)로만
//  - 영상·소리(mp3·m4a·mp4·webm)는 Pages에 올리지 않고 Worker가 내보냄: Pages는 Range 요청에 206을 주지 않아 iPhone Safari에서 영상이 안 열릴 수 있음
//    → _redirects로 Worker 주소(/s/<id>/…)로 넘김
import { htmlCsp, SVG_CSP, NO_FRAME_PAGES, BASE_HEADERS } from './csp.js';
import { TYPES, extOf } from './paths.js';
import { pageHtml } from './pages.js';

/** Pages에 올리지 않고 Durable Object에 두는 형식(Worker가 Range까지 맞춰 내보냄) */
export const MEDIA_EXT = new Set(['mp3', 'm4a', 'mp4', 'webm']);
/** 사이트 안 파일이 어디에 있나: 'blob'(Durable Object) | 'pages' */
export const isMedia = (path) => MEDIA_EXT.has(extOf(path));
export const branchOf = (id) => `s-${id}`;
/** 다른 출처에서 불러 쓸 일이 없는 형식(paths.js의 SAME_ORIGIN_ONLY와 같음) */
const SAME_ORIGIN_EXT = new Set(['js', 'css', 'json', 'webmanifest', 'woff2', 'enc']);

/**
 * 사이트 주소 틀: 기본 'https://{branch}.<PAGES_HOST>/'. 시험에서는 'http://{branch}.localhost:<포트>/'
 * @param {{ siteUrl: string }} pages
 */
export const siteUrlOf = (pages, id) => pages.siteUrl.replace('{branch}', branchOf(id));
/** 실시간 방 CORS: 이 틀로 만든 사이트 출처만 받는 정규식 */
export function siteOriginRe(template) {
  try {
    const u = new URL(template.replace('{branch}', 'zzbranchzz'));
    const esc = u.origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('zzbranchzz', 's-[0-9a-hjkmnp-tv-z]{10}');
    return new RegExp(`^${esc}$`);
  } catch { return null; }
}

/** 검색 로봇은 막고 링크 미리보기 봇만 읽게(호스트 robots.txt와 같은 정책. 사이트가 보낸 robots.txt 대신 씀) */
export const ROBOTS = `# 검색에는 내보내지 않고, 메신저·SNS의 링크 미리보기 카드만 읽게 합니다.
User-agent: facebookexternalhit
User-agent: Facebot
User-agent: Twitterbot
User-agent: Slackbot-LinkExpanding
User-agent: Discordbot
User-agent: TelegramBot
User-agent: LinkedInBot
User-agent: WhatsApp
User-agent: kakaotalk-scrap
User-agent: Iframely
Allow: /

User-agent: *
Disallow: /
`;

/**
 * 사이트의 _headers. 사이트에 실제로 있는 확장자(대소문자 그대로)마다 규칙을 만듦(100개 한도 안).
 * @param {string[]} paths 사이트 안 경로(Pages에 올리는 것)
 * @param {{ scripts?: string[] }} [o] htmlCsp에 더할 스크립트 주소
 */
export function headersFile(paths, { scripts = [] } = {}) {
  const lines = [];
  const rule = (pattern, hs) => { lines.push(pattern); for (const h of hs) lines.push(`  ${h}`); };
  rule('/*', [
    '! Access-Control-Allow-Origin',
    `Content-Security-Policy: ${htmlCsp({ scripts })}`,
    `X-Content-Type-Options: ${BASE_HEADERS['x-content-type-options']}`,
    `Referrer-Policy: ${BASE_HEADERS['referrer-policy']}`,
    `Permissions-Policy: ${BASE_HEADERS['permissions-policy']}`,
    `X-Robots-Tag: ${BASE_HEADERS['x-robots-tag']}`,
  ]);
  const exts = new Set();
  for (const p of paths) { const name = p.slice(p.lastIndexOf('/') + 1); const dot = name.lastIndexOf('.'); if (dot > 0) exts.add(name.slice(dot + 1)); }
  for (const e of [...exts].sort()) {
    const low = e.toLowerCase(); const t = TYPES[low];
    if (!t) continue;
    const hs = [];
    if (t.kind === 'svg') hs.push('! Content-Security-Policy', `Content-Security-Policy: ${SVG_CSP}`);
    if (SAME_ORIGIN_EXT.has(low)) hs.push('Cross-Origin-Resource-Policy: same-origin');
    if (t.download) hs.push('Content-Disposition: attachment');
    if (hs.length && /^[A-Za-z0-9]+$/.test(e)) rule(`/*.${e}`, hs);
  }
  // 강사용 화면은 다른 사이트의 틀 안에 넣지 못하게. Pages는 /console.html을 /console로 넘기므로 둘 다
  for (const f of [...NO_FRAME_PAGES].sort()) {
    const bare = f.replace(/\.html$/, '');
    for (const p of [`/${f}`, `/${bare}`]) rule(p, ['X-Frame-Options: DENY', '! Content-Security-Policy', `Content-Security-Policy: ${htmlCsp({ noFrame: true, scripts })}`]);
  }
  return `${lines.join('\n')}\n`;
}

/** 경로를 주소 모양으로(빗금은 그대로, 나머지는 퍼센트 인코딩) */
const encPath = (p) => p.split('/').map(encodeURIComponent).join('/');
/**
 * 영상·소리는 Worker 주소로 넘기는 _redirects(정적 규칙, 2,000개 한도). 주소 그대로인 모양과 인코딩한 모양을 둘 다
 * @param {string[]} mediaPaths
 * @param {string} workerSite 'https://<호스트>/s/<id>/'
 */
export function redirectsFile(mediaPaths, workerSite) {
  const out = [];
  for (const p of mediaPaths) {
    const enc = `/${encPath(p)}`; const to = `${workerSite}${encPath(p)}`;
    out.push(`${enc} ${to} 302`);
    const raw = `/${p}`;
    if (raw !== enc && !/\s/.test(raw)) out.push(`${raw} ${to} 302`);
  }
  return out.length ? `${out.join('\n')}\n` : '';
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reportA = (reportUrl, id) => `<a href="${esc(`${reportUrl}?site=${encodeURIComponent(id)}`)}" rel="nofollow noopener">신고·문의</a>`;

/** 사이트에 404.html이 없을 때 넣는 화면(없으면 Pages가 모든 주소에 첫 화면을 보여 줌) */
export const noFileHtml = () => pageHtml('이 사이트에 없는 페이지예요', ['주소를 다시 확인해 주세요.'], '<a href="./">사이트 첫 화면으로</a>');
/** 신고로 가려 둔 동안 이 브랜치에 올리는 화면 */
export const blockedHtml = (id, reportUrl) => pageHtml('잠시 가려 둔 사이트예요', ['신고가 들어와서 확인하는 동안 열리지 않게 해 두었어요.', '이 사이트를 올린 분이고 사정을 알리고 싶다면 아래 화면에서 알려 주세요.'], reportA(reportUrl, id));
/** 지운 뒤(가장 최근 배포를 지우지 못할 때) 남기는 화면. 프로젝트의 본 배포(없는 주소)도 같은 화면 */
export const goneHtml = (home = '') => pageHtml('이 사이트는 보관 기간이 끝났어요', ['보관 기간이 지나면 사이트와 파일이 지워져요. 주소가 맞는지도 한 번 확인해 주세요.', '다시 보려면 사이트를 만든 강사에게 새 주소를 물어봐 주세요.'], home ? `<a href="${esc(home)}">이곳은 어떤 곳인가요?</a>` : '');
/** 안내 화면만 있는 배포의 _headers */
export const NOTICE_HEADERS = `/*\n  ! Access-Control-Allow-Origin\n  Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'\n  X-Frame-Options: DENY\n  X-Content-Type-Options: nosniff\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: no-store\n`;

/** 확장자 → Pages에 알려 줄 형식(paths.js 표). 모르면 octet-stream */
export const contentTypeOf = (path) => TYPES[extOf(path)]?.type || 'application/octet-stream';
/** Pages 열쇠 계산에 쓰는 확장자(파일 이름 그대로, 대소문자 유지. wrangler는 path.extname) */
export function rawExt(path) {
  const name = path.slice(path.lastIndexOf('/') + 1); const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1) : '';
}
