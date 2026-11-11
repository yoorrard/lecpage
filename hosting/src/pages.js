// 호스트가 직접 보여 주는 작은 안내 화면(없는 주소·공개 기간 끝·가려 둠)
import { BASE_HEADERS, NOTICE_CSP } from './csp.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page(title, lines, links = '') {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font-family:system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;background:#f6f5f2;color:#1f1d1a;word-break:keep-all;line-height:1.6}
main{max-width:30rem}
h1{font-size:1.4rem;line-height:1.35;margin:0 0 .5rem}
p{margin:.4rem 0;color:#55514a}
a{color:inherit}
.s{margin-top:1.2rem;font-size:.9rem}
@media (prefers-color-scheme:dark){body{background:#171614;color:#f1efe9}p{color:#b9b4aa}}
</style>
</head>
<body>
<main>
<h1>${esc(title)}</h1>
${lines.map((l) => `<p>${esc(l)}</p>`).join('\n')}
${links ? `<p class="s">${links}</p>` : ''}
</main>
</body>
</html>
`;
}

function notice(status, html, head = false) {
  return new Response(head ? null : html, {
    status,
    headers: { ...BASE_HEADERS, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': NOTICE_CSP, 'x-frame-options': 'DENY' },
  });
}

const HOME = '<a href="/">이곳은 어떤 곳인가요?</a>';
const reportLink = (id) => `<a href="/report${id ? `?site=${encodeURIComponent(id)}` : ''}">신고·문의</a>`;

/** 없는 주소 */
export const notFoundPage = (head) => notice(404, page('찾는 페이지가 없어요', ['주소를 다시 확인해 주세요.'], HOME), head);
/** 공개 기간이 끝났거나 지운 사이트(없는 사이트 주소도 같은 화면) */
export const gonePage = (head) => notice(404, page('이 사이트는 공개 기간이 끝났어요', ['공개 기간이 지나면 사이트와 파일이 지워져요. 주소가 맞는지도 한 번 확인해 주세요.', '다시 보려면 사이트를 만든 강사에게 새 주소를 물어봐 주세요.'], HOME), head);
/** 사이트는 있는데 그 파일이 없을 때 */
export const noFilePage = (head) => notice(404, page('이 사이트에 없는 페이지예요', ['주소를 다시 확인해 주세요.'], '<a href="./">사이트 첫 화면으로</a>'), head);
/** 신고로 가려 둔 사이트 */
export const blockedPage = (id, head) => notice(451, page('잠시 가려 둔 사이트예요', ['신고가 들어와서 확인하는 동안 열리지 않게 해 두었어요.', '이 사이트를 올린 분이고 사정을 알리고 싶다면 아래 화면에서 알려 주세요.'], reportLink(id)), head);
export const methodNotAllowed = () => new Response('GET만 받아요.\n', { status: 405, headers: { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
