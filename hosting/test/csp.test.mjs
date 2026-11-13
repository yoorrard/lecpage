import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { htmlCsp, fileHeaders, etagOf, etagMatches, parseRange, SVG_CSP, NOTICE_CSP, FONT_CSS_HOSTS, FONT_FILE_HOSTS, FRAME_HOSTS, NO_FRAME_PAGES, BASE_HEADERS } from '../src/csp.js';
import { typeOf } from '../src/paths.js';
import { isLocalSrc, isDataScript, reportLinkHtml } from '../src/rewrite.js';
import { ENGINE } from './helpers.mjs';

const sha = 'a'.repeat(64);
const directive = (csp, name) => (csp.split(';').map((s) => s.trim()).find((s) => s.startsWith(name + ' ')) || '').slice(name.length + 1);

test('HTML CSP: 스크립트는 이 출처뿐', () => {
  const csp = htmlCsp();
  assert.equal(directive(csp, 'default-src'), "'none'");
  assert.equal(directive(csp, 'script-src'), "'self'");
  for (const bad of ["'unsafe-inline'", "'unsafe-eval'", 'https:', 'data:', 'blob:', '*', 'cdn.jsdelivr.net']) assert.ok(!directive(csp, 'script-src').includes(bad), bad);
  assert.equal(directive(csp, 'style-src'), "'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://hangeul.pstatic.net");
  assert.equal(directive(csp, 'font-src'), "'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net https://hangeul.pstatic.net");
  assert.equal(directive(csp, 'img-src'), "'self' data: blob: https:");
  assert.equal(directive(csp, 'media-src'), "'self' blob: https:");
  assert.equal(directive(csp, 'connect-src'), "'self' https: wss:");
  assert.equal(directive(csp, 'frame-src'), "'none'");
  assert.equal(directive(csp, 'manifest-src'), "'self'");
  assert.equal(directive(csp, 'base-uri'), "'none'");
  assert.equal(directive(csp, 'form-action'), "'none'");
  assert.equal(directive(csp, 'object-src'), "'none'");
  assert.ok(!csp.includes('frame-ancestors'));
  assert.equal(directive(htmlCsp({ noFrame: true }), 'frame-ancestors'), "'none'");
});

test('더 허용하는 스크립트는 파일 하나를 가리키는 https 주소만', () => {
  const sdk = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js';
  assert.equal(directive(htmlCsp({ scripts: [sdk] }), 'script-src'), `'self' ${sdk}`);
  for (const bad of ['https://cdn.jsdelivr.net/', 'https://cdn.jsdelivr.net/npm/', 'https://cdn.jsdelivr.net', "'unsafe-inline'", 'https:', '*', 'http://x.example/a.js', "https://x.example/a.js; script-src *", 'https://x.example/a.js https://evil.example/', 'https://x.example/a.js?x=1']) {
    assert.equal(directive(htmlCsp({ scripts: [bad] }), 'script-src'), "'self'", bad);
  }
});

test('엔진이 쓰는 글꼴 호스트가 CSP에 다 있음(엔진이 바뀌면 여기서 알림)', () => {
  const pages = readFileSync(join(ENGINE, 'src', 'render', 'pages.js'), 'utf8');
  const body = pages.slice(pages.indexOf('function cspMeta'), pages.indexOf('function headTags'));
  assert.ok(body.includes('style-src') && body.includes('font-src'), 'cspMeta를 찾지 못함');
  const fontsLine = /const fonts = '([^']+)'/.exec(body);
  assert.ok(fontsLine, 'cspMeta의 fonts 줄');
  for (const h of fontsLine[1].split(/\s+/)) assert.ok(FONT_CSS_HOSTS.includes(h), `style-src에 ${h}`);
  const fontSrc = /"font-src ([^"]+)"/.exec(body);
  assert.ok(fontSrc, 'cspMeta의 font-src 줄');
  for (const h of fontSrc[1].split(/\s+/).filter((x) => x.startsWith('https://'))) assert.ok(FONT_FILE_HOSTS.includes(h), `font-src에 ${h}`);
  // 엔진은 틀(iframe)을 쓰지 않음. 쓰게 되면 FRAME_HOSTS를 채워야 함
  assert.ok(/"frame-src 'none'"/.test(body), "엔진 cspMeta의 frame-src가 'none'이 아니면 src/csp.js의 FRAME_HOSTS를 맞춰 주세요");
  assert.deepEqual(FRAME_HOSTS, []);
  // 글꼴 CSS 주소(fonts.js, seeds.js)의 호스트
  for (const f of ['fonts.js', 'seeds.js']) {
    const src = readFileSync(join(ENGINE, 'src', 'design', f), 'utf8');
    const hosts = new Set([...src.matchAll(/https:\/\/[a-z0-9.-]+/g)].map((m) => m[0]));
    assert.ok(hosts.size >= 2, f);
    for (const h of hosts) assert.ok(FONT_CSS_HOSTS.includes(h) || FONT_FILE_HOSTS.includes(h), `${f}: ${h}`);
  }
  // 엔진의 _headers가 틀에 못 넣게 하는 화면과 같음
  const build = readFileSync(join(ENGINE, 'src', 'build.js'), 'utf8');
  const m = /\['\/console', '\/screen', '\/poster'\]\.flatMap\(\(p\) => \[p \+ '\.html', p\]\)/.exec(build); // 엔진은 .html과 확장자 없는 주소 둘 다에 적음
  assert.ok(m, 'build.js의 _headers 대상이 바뀌었으면 NO_FRAME_PAGES를 맞춰 주세요');
  assert.deepEqual([...NO_FRAME_PAGES].sort(), ['console.html', 'poster.html', 'screen.html']);
});

test('파일별 응답 머리글', () => {
  const html = fileHeaders('index.html', typeOf('index.html'), sha);
  for (const [k, v] of Object.entries(BASE_HEADERS)) assert.equal(html[k], v);
  assert.equal(html['x-content-type-options'], 'nosniff');
  assert.equal(html['x-robots-tag'], 'noindex, nofollow');
  assert.equal(html['referrer-policy'], 'strict-origin-when-cross-origin');
  assert.equal(html['permissions-policy'], 'camera=(), microphone=(), geolocation=()');
  assert.equal(html['content-type'], 'text/html; charset=utf-8');
  assert.equal(html['cache-control'], 'no-cache');
  assert.equal(html['content-security-policy'], htmlCsp());
  assert.equal(html['x-frame-options'], undefined);
  assert.equal(html['cross-origin-resource-policy'], undefined);
  assert.equal(html.etag, `"${sha}-r2"`);
  assert.equal(fileHeaders('index.html', typeOf('index.html'), sha, { tag: 'abcd1234' }).etag, `"${sha}-abcd1234-r2"`, '배포·공지가 바뀌면 HTML etag도 바뀜');
  assert.equal(fileHeaders('index.html', typeOf('index.html'), sha, { immutable: true })['cache-control'], 'no-cache', 'HTML은 지문이 있어도 오래 두지 않음');

  const consoleH = fileHeaders('console.html', typeOf('console.html'), sha);
  assert.ok(consoleH['content-security-policy'].endsWith("frame-ancestors 'none'"));
  assert.equal(consoleH['x-frame-options'], 'DENY');
  assert.equal(fileHeaders('sub/console.html', typeOf('sub/console.html'), sha)['x-frame-options'], undefined, '맨 위 화면만');

  const js = fileHeaders('assets/lecpage.js', typeOf('assets/lecpage.js'), sha);
  assert.equal(js['content-type'], 'text/javascript; charset=utf-8');
  assert.equal(js['cache-control'], 'public, max-age=600');
  assert.equal(fileHeaders('assets/lecpage.js', typeOf('assets/lecpage.js'), sha, { immutable: true })['cache-control'], 'public, max-age=31536000, immutable', '주소의 지문이 맞으면 1년');
  assert.equal(js['cross-origin-resource-policy'], 'same-origin');
  assert.equal(js.etag, `"${sha}"`);
  assert.equal(js['content-security-policy'], undefined);

  const svg = fileHeaders('assets/favicon.svg', typeOf('assets/favicon.svg'), sha);
  assert.equal(svg['content-security-policy'], "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  assert.equal(svg['content-security-policy'], SVG_CSP);
  assert.equal(svg['cross-origin-resource-policy'], undefined, '앱이 다른 출처에서 그림으로 불러 열리는지 확인함');

  const pptx = fileHeaders('assets/media/a.pptx', typeOf('assets/media/a.pptx'), sha);
  assert.equal(pptx['content-disposition'], 'attachment');
  assert.equal(fileHeaders('a.pdf', typeOf('a.pdf'), sha)['content-disposition'], undefined);
  assert.ok(NOTICE_CSP.includes("default-src 'none'") && !NOTICE_CSP.includes('script-src'));
});

test('ETag·If-None-Match', () => {
  assert.equal(etagOf(sha, typeOf('a.png')), `"${sha}"`);
  assert.ok(etagMatches(`"${sha}"`, `"${sha}"`));
  assert.ok(etagMatches(`W/"${sha}"`, `"${sha}"`));
  assert.ok(etagMatches(`"x", "${sha}"`, `"${sha}"`));
  assert.ok(etagMatches('*', `"${sha}"`));
  assert.ok(!etagMatches(`"${sha}-r1"`, `"${sha}"`));
  assert.ok(!etagMatches('', `"${sha}"`));
  assert.ok(!etagMatches(null, `"${sha}"`));
});

test('Range', () => {
  assert.equal(parseRange(null, 100), null);
  assert.equal(parseRange('items=0-5', 100), null);
  assert.equal(parseRange('bytes=0-5,10-20', 100), null, '여러 구간은 전체로');
  assert.deepEqual(parseRange('bytes=0-9', 100), { start: 0, end: 9 });
  assert.deepEqual(parseRange('bytes=90-', 100), { start: 90, end: 99 });
  assert.deepEqual(parseRange('bytes=90-500', 100), { start: 90, end: 99 });
  assert.deepEqual(parseRange('bytes=-10', 100), { start: 90, end: 99 });
  assert.deepEqual(parseRange('bytes=-500', 100), { start: 0, end: 99 });
  assert.equal(parseRange('bytes=100-', 100), 'invalid');
  assert.equal(parseRange('bytes=50-10', 100), 'invalid');
  assert.equal(parseRange('bytes=-0', 100), 'invalid');
  assert.equal(parseRange('bytes=0-', 0), 'invalid');
});

test('HTML 손보기 판단: 어떤 <script>를 남기나', () => {
  for (const ok of ['assets/lecpage.js', './assets/boot.js', 'assets/fx.js?v=2', '../other/assets/qr.js', ' assets/live.js ']) assert.ok(isLocalSrc(ok), ok);
  for (const bad of ['', '  ', null, undefined, 'https://evil.example/x.js', 'HTTPS://evil.example/x.js', '//evil.example/x.js', '/report.js', '/s/abc/assets/x.js', 'data:text/javascript,alert(1)', 'javascript:alert(1)', 'blob:https://x/1', 'ht\ntps://evil.example/x.js', '\t//evil.example/x.js', '\\\\evil.example\\x.js', 'assets\\x.js', 'x:y', 'a\u0000b.js']) {
    assert.ok(!isLocalSrc(bad), JSON.stringify(bad));
  }
  assert.ok(isDataScript('application/json'));
  assert.ok(isDataScript(' Application/JSON '));
  assert.ok(isDataScript('application/ld+json'));
  for (const t of ['', null, 'text/javascript', 'module', 'application/javascript', 'importmap', 'speculationrules', 'text/plain']) assert.ok(!isDataScript(t), String(t));
});

test('신고 링크', () => {
  const inFooter = reportLinkHtml('abcdefghjk', { inFooter: true });
  assert.match(inFooter, /^<a href="\/report\?site=abcdefghjk" rel="nofollow noopener" target="_blank" data-host-report>신고<\/a>$/);
  const end = reportLinkHtml('abcdefghjk', { inFooter: false });
  assert.ok(end.includes('href="/report?site=abcdefghjk"') && end.includes('@media print'));
  assert.ok(!/<script/i.test(end));
});
