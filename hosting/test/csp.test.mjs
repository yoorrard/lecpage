import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { htmlCsp, siteCsp, auxCsp, roomSources, declaredLive, fileHeaders, etagOf, etagMatches, parseRange, SVG_CSP, NOTICE_CSP, FONT_CSS_HOSTS, FONT_FILE_HOSTS, FRAME_HOSTS, LIB_SCRIPT_SOURCES, NO_FRAME_PAGES, AUX_PAGES, BASE_HEADERS } from '../src/csp.js';
import { typeOf } from '../src/paths.js';
import { isLocalSrc, isLibSrc, isDataScript, reportLinkHtml } from '../src/rewrite.js';
import { SUPABASE_SDK } from '../src/runtime-allow.js';
import { ENGINE } from './helpers.mjs';
import { pathToFileURL } from 'node:url';

const K = await import(pathToFileURL(join(ENGINE, 'src', 'kit', 'index.js')).href);
const N = await import(pathToFileURL(join(ENGINE, 'node.js')).href);
/** CSP 글 → { 지시어: [출처…] } */
const parse = (csp) => Object.fromEntries(csp.split(';').map((x) => x.trim().split(/\s+/)).filter((x) => x[0]).map(([d, ...v]) => [d, v]));
/** 출처 a가 출처 b 안에 드는지(같거나, b가 끝이 /인 경로·출처이고 a가 그 아래) */
const within = (a, b) => a === b || (/^[a-z]+:\/\/[^/]+$/.test(b) ? a.startsWith(b + '/') : b.endsWith('/') && a.startsWith(b));

const sha = 'a'.repeat(64);
const directive = (csp, name) => (csp.split(';').map((s) => s.trim()).find((s) => s.startsWith(name + ' ')) || '').slice(name.length + 1);

const HOST = 'https://lecpage-sites.example.workers.dev';
const ROOM = { host: HOST, code: 'SEL2026', site: 'abcdefghjk', pages: true };

test('사이트 쪽 CSP: 스크립트는 이 출처와 고정 라이브러리, 연결은 그 사이트의 방만', () => {
  const csp = siteCsp(ROOM);
  assert.equal(directive(csp, 'default-src'), "'none'");
  assert.equal(directive(csp, 'script-src'), `'self' ${LIB_SCRIPT_SOURCES.join(' ')}`);
  for (const bad of ["'unsafe-inline'", "'unsafe-eval'", 'https:', 'data:', 'blob:', '*', "'strict-dynamic'"]) assert.ok(!directive(csp, 'script-src').split(' ').includes(bad), bad);
  assert.ok(!directive(csp, 'script-src').split(' ').includes('https://cdn.jsdelivr.net'), 'jsdelivr 전체가 아니라 버전을 고정한 경로만');
  assert.equal(directive(csp, 'style-src'), "'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://hangeul.pstatic.net");
  assert.equal(directive(csp, 'font-src'), "'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net https://hangeul.pstatic.net");
  assert.equal(directive(csp, 'img-src'), `'self' data: blob: ${HOST}/api/SEL2026/files/`);
  assert.equal(directive(csp, 'media-src'), `'self' blob: ${HOST}/api/SEL2026/files/ ${HOST}/s/abcdefghjk/`);
  assert.equal(directive(csp, 'connect-src'), `'self' ${HOST}/live/api/SEL2026 ${HOST}/live/api/SEL2026/ wss://lecpage-sites.example.workers.dev/live/api/SEL2026/ ${HOST}/api/SEL2026/files/`);
  for (const d of ['img-src', 'media-src', 'connect-src']) for (const bad of ['https:', 'wss:', 'http:', '*', HOST, `${HOST}/`, `${HOST}/live/`]) assert.ok(!directive(csp, d).split(' ').includes(bad), `${d}: ${bad}`);
  assert.equal(directive(csp, 'frame-src'), 'https://www.youtube-nocookie.com https://player.vimeo.com');
  assert.equal(directive(csp, 'worker-src'), "'none'");
  assert.equal(directive(csp, 'manifest-src'), "'self'");
  assert.equal(directive(csp, 'base-uri'), "'none'");
  assert.equal(directive(csp, 'form-action'), "'none'");
  assert.equal(directive(csp, 'object-src'), "'none'");
  assert.ok(!csp.includes('frame-ancestors'), '사이트 쪽은 지금처럼 다른 사이트에 넣을 수 있음');
  // 방이 없으면 'self'만, worker 보기는 영상도 같은 출처
  assert.equal(directive(siteCsp(), 'connect-src'), "'self'");
  assert.equal(directive(siteCsp(), 'img-src'), "'self' data: blob:");
  assert.equal(directive(siteCsp({ ...ROOM, pages: false }), 'media-src'), `'self' blob: ${HOST}/api/SEL2026/files/`);
  assert.equal(directive(siteCsp({ host: 'http://127.0.0.1:6401', code: 'ABC' }), 'connect-src'), "'self' http://127.0.0.1:6401/live/api/ABC http://127.0.0.1:6401/live/api/ABC/ ws://127.0.0.1:6401/live/api/ABC/ http://127.0.0.1:6401/api/ABC/files/");
});

test('엔진 조립의 CSP(kit/assemble.js kitCsp)와 어긋나지 않음: 같은 지시어·출처, 서버는 더 좁게만', () => {
  const site = { 'index.html': '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>t</title></head><body><main><h1>t</h1><div data-lp="qa"></div><div data-lp="board"></div></main></body></html>' };
  const meta = { v: 2, title: '시험', features: ['qa', 'board'] };
  const cases = [
    { name: '이 호스트의 방', live: { provider: 'http', url: `${HOST}/live`, code: 'SEL2026' }, srv: { host: HOST, code: 'SEL2026', site: 'abcdefghjk', pages: true } },
    { name: '강사 계정 Cloudflare', live: { provider: 'http', url: 'https://lecpage-live.teacher.workers.dev', code: 'SEL2026' } },
    { name: 'Supabase', live: { provider: 'supabase', url: 'https://abcdefghijklmnop.supabase.co', anonKey: 'k', code: 'SEL2026' } },
    { name: '구글 시트', live: { provider: 'sheets', url: 'https://script.google.com/macros/s/x/exec', code: 'SEL2026' } },
  ];
  for (const c of cases) {
    const r = K.assemble(site, meta, { runtime: N.nodeRuntime(), prev: { live: c.live, access: 'link' }, today: '2026-11-20' });
    assert.deepEqual(r.errors, [], c.name);
    const eng = parse(r.csp);
    const srv = parse(siteCsp({ ...(c.srv || { host: HOST }), live: declaredLive(c.live, HOST) }));
    const strip = (v) => (v || []).filter((x) => x !== 'file:');
    for (const d of ['script-src', 'style-src', 'font-src', 'frame-src', 'worker-src', 'object-src', 'base-uri', 'form-action']) assert.deepEqual(srv[d], strip(eng[d]), `${c.name}: ${d}`);
    assert.deepEqual(srv['default-src'], ["'none'"], '서버는 default-src를 닫음(빠진 지시어가 열리지 않게)');
    for (const d of ['img-src', 'media-src', 'connect-src']) {
      for (const x of srv[d]) assert.ok(strip(eng[d]).some((y) => within(x, y)), `${c.name}: ${d}의 ${x}가 엔진 CSP 안에 있어야 함`);
      for (const y of strip(eng[d])) assert.ok(srv[d].some((x) => within(x, y)), `${c.name}: 엔진 ${d}의 ${y}에 닿는 길이 서버에도 있어야 함`);
    }
  }
});

test('사이트 쪽 CSP에 들어가는 값은 모양을 확인함(머리글을 깨뜨리지 못함)', () => {
  for (const bad of [{ host: 'https://h.example; script-src *', code: 'ABC' }, { host: 'javascript:alert(1)', code: 'ABC' }, { host: 'https://h.example/', code: 'ABC' }, { host: HOST, code: 'abc' }, { host: HOST, code: 'A B' }, { host: HOST, code: "ABC'" }, { host: HOST, code: 'AB' }]) {
    assert.deepEqual(roomSources(bad).connect, [], JSON.stringify(bad));
  }
  assert.deepEqual(roomSources({ host: HOST, site: '../x', pages: true }).media, []);
  assert.deepEqual(roomSources({ live: ['https://evil.example/x', "https://a.example 'unsafe-inline'", 'https:', 'data:', 'https://ok.workers.dev'] }).connect, ['https://ok.workers.dev']);
  const csp = siteCsp({ host: 'https://h.example; script-src *', code: 'X;Y' });
  assert.ok(!csp.includes('script-src *') && csp.split(';').length === 13, csp);
});

test('사이트가 적은 바깥 실시간 서버: 강사 계정 모양(workers.dev·supabase.co·Apps Script)만, 이 호스트는 빼고', () => {
  assert.deepEqual(declaredLive({ provider: 'http', url: 'https://lecpage-live.teacher.workers.dev/' }), ['https://lecpage-live.teacher.workers.dev', 'wss://lecpage-live.teacher.workers.dev']);
  assert.deepEqual(declaredLive({ provider: 'http', health: 'https://a.b.workers.dev/api/health' }), ['https://a.b.workers.dev', 'wss://a.b.workers.dev'], '암호 사이트의 공개 자료(health)');
  assert.deepEqual(declaredLive({ provider: 'supabase', url: 'https://abcdefghijklmnop.supabase.co' }), ['https://abcdefghijklmnop.supabase.co', 'wss://abcdefghijklmnop.supabase.co']);
  assert.deepEqual(declaredLive({ provider: 'sheets', url: 'https://script.google.com/macros/s/x/exec' }), ['https://script.google.com', 'https://script.googleusercontent.com']);
  assert.deepEqual(declaredLive({ provider: 'http', url: `${HOST}/live` }, HOST), [], '이 호스트의 방은 묶인 코드로만');
  for (const bad of [{ provider: 'http', url: 'https://evil.example' }, { provider: 'http', url: 'http://a.workers.dev' }, { provider: 'http', url: 'https://a.workers.dev:8443' }, { provider: 'http', url: 'https://u:p@a.workers.dev' },
    { provider: 'http', url: 'https://workers.dev.evil.example' }, { provider: 'supabase', url: 'https://abc.supabase.co.evil.example' }, { provider: 'supabase', url: 'https://a.workers.dev' }, { provider: 'local', url: 'https://a.workers.dev' }, { provider: 'http', url: 'not a url' }, null, 'x']) {
    assert.deepEqual(declaredLive(bad), [], JSON.stringify(bad));
  }
  const csp = siteCsp({ live: declaredLive({ provider: 'supabase', url: 'https://abcdefghijklmnop.supabase.co' }) });
  assert.equal(directive(csp, 'connect-src'), "'self' https://abcdefghijklmnop.supabase.co wss://abcdefghijklmnop.supabase.co");
  assert.equal(directive(csp, 'img-src'), "'self' data: blob: https://abcdefghijklmnop.supabase.co", '보드 파일');
  assert.equal(directive(siteCsp({ live: declaredLive({ provider: 'sheets' }) }), 'img-src'), "'self' data: blob: https://script.google.com https://script.googleusercontent.com https://drive.google.com https://*.googleusercontent.com", '시트 보드 사진(드라이브)');
});

test('보조 쪽 CSP: 예전 규칙 그대로 + 고정 라이브러리, 일꾼 스크립트 없음', () => {
  const csp = auxCsp();
  assert.equal(directive(csp, 'script-src'), `'self' ${LIB_SCRIPT_SOURCES.join(' ')}`);
  assert.equal(directive(csp, 'img-src'), "'self' data: blob: https:");
  assert.equal(directive(csp, 'media-src'), "'self' blob: https:");
  assert.equal(directive(csp, 'connect-src'), "'self' https: wss:", '접속 확인은 바깥 도구가 열리는지 잼');
  assert.equal(directive(csp, 'frame-src'), "'none'");
  assert.equal(directive(csp, 'worker-src'), "'none'");
  assert.equal(directive(csp, 'base-uri'), "'none'");
  assert.equal(directive(csp, 'form-action'), "'none'");
  assert.ok(!csp.includes('frame-ancestors'));
  assert.equal(directive(auxCsp({ noFrame: true }), 'frame-ancestors'), "'none'");
  // 어느 쪽에 어느 CSP
  assert.deepEqual([...AUX_PAGES].sort(), ['check.html', 'console.html', 'poster.html', 'privacy.html', 'screen.html']);
  for (const p of ['console.html', 'screen.html', 'poster.html']) assert.equal(htmlCsp(p, ROOM), auxCsp({ noFrame: true }), p);
  for (const p of ['check.html', 'privacy.html']) assert.equal(htmlCsp(p, ROOM), auxCsp(), p);
  for (const p of ['index.html', 'about.html', 'sub/console.html', 'Console.html', '404.html']) assert.equal(htmlCsp(p, ROOM), siteCsp(ROOM), p);
});

test('고정 라이브러리 = 엔진 LIB_SCRIPT_SOURCES, 런타임이 부르는 CDN 파일이 다 그 안에 있음', () => {
  const shell = readFileSync(join(ENGINE, 'src', 'render', 'shell.js'), 'utf8');
  const m = /export const LIB_SCRIPT_SOURCES = (\[[^\]]*\]);/.exec(shell);
  assert.ok(m, 'render/shell.js의 LIB_SCRIPT_SOURCES');
  assert.deepEqual(JSON.parse(m[1].replace(/'/g, '"')), LIB_SCRIPT_SOURCES, '엔진 목록이 바뀌면 src/csp.js도 맞춰 주세요');
  for (const u of LIB_SCRIPT_SOURCES) assert.match(u, /^https:\/\/cdn\.jsdelivr\.net\/npm\/(@[a-z0-9-]+\/)?[a-z0-9.-]+@\d+\.\d+\.\d+\/$/, `버전까지 고정한 경로: ${u}`);
  // 런타임이 부르는 CDN 파일: Supabase 연결 라이브러리(AI가 쓴 사이트는 키트 설명서의 gsap·lenis·ogl만)
  const urls = new Set([SUPABASE_SDK]);
  for (const f of ['live/supabase.js', 'lecpage.js', 'console.js', 'screen.js']) {
    for (const x of readFileSync(join(ENGINE, 'runtime', f), 'utf8').matchAll(/https:\/\/cdn\.jsdelivr\.net\/npm\/[^'"\s]+/g)) urls.add(x[0]);
  }
  assert.ok(SUPABASE_SDK && urls.size >= 1, [...urls].join(' '));
  for (const u of urls) assert.ok(isLibSrc(u), `CSP·HTML 손보기가 받는 라이브러리: ${u}`);
});

test('엔진이 쓰는 글꼴 호스트가 CSP에 다 있음(엔진이 바뀌면 여기서 알림)', () => {
  // 쪽 머리·CSP는 render/shell.js(참가자 화면과 보조 화면이 같이 씀)
  const pages = readFileSync(join(ENGINE, 'src', 'render', 'shell.js'), 'utf8');
  const body = pages.slice(pages.indexOf('export function cspPolicy'), pages.indexOf('export function headTags'));
  assert.ok(body.includes('style-src') && body.includes('font-src'), 'cspMeta를 찾지 못함');
  const fontsLine = /const fonts = '([^']+)'/.exec(body);
  assert.ok(fontsLine, 'cspMeta의 fonts 줄');
  for (const h of fontsLine[1].split(/\s+/)) assert.ok(FONT_CSS_HOSTS.includes(h), `style-src에 ${h}`);
  const fontSrc = /"font-src ([^"]+)"/.exec(body);
  assert.ok(fontSrc, 'cspMeta의 font-src 줄');
  for (const h of fontSrc[1].split(/\s+/).filter((x) => x.startsWith('https://'))) assert.ok(FONT_FILE_HOSTS.includes(h), `font-src에 ${h}`);
  // 엔진은 틀(iframe)을 쓰지 않음. AI가 쓴 사이트 쪽은 유튜브(쿠키 없는 주소)·비메오만
  assert.ok(/"frame-src 'none'"/.test(body), "엔진 cspMeta의 frame-src가 바뀌었으면 src/csp.js의 FRAME_HOSTS를 확인해 주세요");
  assert.deepEqual(FRAME_HOSTS, ['https://www.youtube-nocookie.com', 'https://player.vimeo.com']);
  // 글꼴 CSS 주소(fonts.js)의 호스트
  for (const f of ['fonts.js']) {
    const src = readFileSync(join(ENGINE, 'src', 'design', f), 'utf8');
    const hosts = new Set([...src.matchAll(/https:\/\/[a-z0-9.-]+/g)].map((m) => m[0]));
    assert.ok(hosts.size >= 2, f);
    for (const h of hosts) assert.ok(FONT_CSS_HOSTS.includes(h) || FONT_FILE_HOSTS.includes(h), `${f}: ${h}`);
  }
  // 엔진의 _headers가 틀에 못 넣게 하는 화면과 같음, 보조 쪽 목록도 엔진과 같음
  const paths = readFileSync(join(ENGINE, 'src', 'kit', 'paths.js'), 'utf8');
  const aux = /export const ENGINE_PAGES = \[([^\]]+)\]/.exec(paths);
  assert.ok(aux, 'kit/paths.js의 ENGINE_PAGES');
  assert.deepEqual(aux[1].split(',').map((x) => x.trim().replace(/^'|'$/g, '')).sort(), [...AUX_PAGES].sort());
  const asm = readFileSync(join(ENGINE, 'src', 'kit', 'assemble.js'), 'utf8');
  const m = /const auxPaths = \['\/console', '\/screen', '\/poster'\]\.flatMap\(\(x\) => \[x \+ '\.html', x\]\)/.exec(asm); // 엔진은 .html과 확장자 없는 주소 둘 다에 적음
  assert.ok(m, 'kit/assemble.js의 _headers 대상이 바뀌었으면 NO_FRAME_PAGES를 맞춰 주세요');
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
  assert.equal(html['content-security-policy'], siteCsp());
  assert.equal(fileHeaders('index.html', typeOf('index.html'), sha, { csp: ROOM })['content-security-policy'], siteCsp(ROOM));
  assert.equal(html['x-frame-options'], undefined);
  assert.equal(html['cross-origin-resource-policy'], undefined);
  assert.equal(html.etag, `"${sha}-r3"`);
  assert.equal(fileHeaders('index.html', typeOf('index.html'), sha, { tag: 'abcd1234' }).etag, `"${sha}-abcd1234-r3"`, '배포·공지가 바뀌면 HTML etag도 바뀜');
  assert.equal(fileHeaders('index.html', typeOf('index.html'), sha, { immutable: true })['cache-control'], 'no-cache', 'HTML은 지문이 있어도 오래 두지 않음');

  const consoleH = fileHeaders('console.html', typeOf('console.html'), sha, { csp: ROOM });
  assert.equal(consoleH['content-security-policy'], auxCsp({ noFrame: true }));
  assert.equal(fileHeaders('check.html', typeOf('check.html'), sha, { csp: ROOM })['content-security-policy'], auxCsp());
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
  for (const ok of ['https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/gsap.min.js', ' https://cdn.jsdelivr.net/npm/lenis@1.3.27/dist/lenis.min.js', 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/+esm', 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js']) assert.ok(isLibSrc(ok), ok);
  for (const bad of ['https://cdn.jsdelivr.net/npm/gsap@3.15.1/', 'https://cdn.jsdelivr.net/npm/gsap@3.15.1/../evil@1.0.0/x.js', 'https://cdn.jsdelivr.net/npm/gsap@3.15.1/%2e%2e/x.js', 'https://cdn.jsdelivr.net/npm/gsap@3.15.10/x.js', 'https://cdn.jsdelivr.net/npm/gsap@3/x.js',
    'https://cdn.jsdelivr.net/npm/gsap@3.15.1/a.js?x=1', 'https://cdn.jsdelivr.net/npm/gsap@3.15.1/a.js#x', 'https://cdn.jsdelivr.net/npm/gsap@3.15.1//a.js', 'https://cdn.jsdelivr.net/npm/gsap@3.15.1/a\\b.js', 'https://cdn.jsdelivr.net/gh/evil/x.js', 'http://cdn.jsdelivr.net/npm/gsap@3.15.1/a.js', 'HTTPS://CDN.JSDELIVR.NET/npm/gsap@3.15.1/a.js', '', null]) {
    assert.ok(!isLibSrc(bad), String(bad));
  }
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

test('강사·발표 화면은 창 연결을 끊음(COOP same-origin, 엔진 조립의 _headers와 같음). 사이트 쪽·QR 안내문은 붙이지 않음', () => {
  const sha = 'a'.repeat(64);
  for (const p of ['console.html', 'screen.html']) assert.equal(fileHeaders(p, typeOf(p), sha)['cross-origin-opener-policy'], 'same-origin', p);
  for (const p of ['index.html', 'poster.html', 'check.html']) assert.equal(fileHeaders(p, typeOf(p), sha)['cross-origin-opener-policy'], undefined, p);
  const eng = readFileSync(join(ENGINE, 'src', 'kit', 'assemble.js'), 'utf8');
  assert.match(eng, /console\|screen[\s\S]{0,80}Cross-Origin-Opener-Policy: same-origin/, '엔진 조립도 같은 두 쪽');
});
