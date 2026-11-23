// Netlify 계정으로 연결(브라우저 로그인 한 번, 커넥트 없이): 티켓 만들기 → 새 창 [Authorize] → 토큰 → 이어서 배포 → 배포 취소.
// 가짜 api.netlify.com(티켓·사이트)과 가짜 app.netlify.com/authorize(새 창)로 앱 흐름을 끝까지. 토큰 길(접힌 '다른 방법')과 설정의 연결 창도 확인.
// 실행: BASE=<앱 주소> node tests/e2e/netlify-login.js
const { chromium, fs, mockAll, openShare, toastHas, watch } = require('./h3.js');
const path = require('path');
const OUT = path.resolve(process.env.OUT || path.join(__dirname, '../../.out/verify/shots'), 'netlify-login') + '/'; fs.mkdirSync(OUT, { recursive: true });
let fails = 0, passes = 0;
const ok = (name, cond, extra = '') => { cond ? passes++ : fails++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`); };
const TOKEN = 'nfp_FAKE_TOKEN_1234567890'; // h2.js의 가짜 Netlify가 받는 토큰
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const pick = async (p, label) => { if (!(await p.locator('.pub-opt').count()) && await p.locator('.pub-mode').count()) await p.click('.pub-mode:has-text("다른 곳에 배포")'); await p.click(`.pub-opt:has-text("${label}")`); };

/** 가짜 Netlify 로그인: 티켓(승인 전 null → 승인 true / 거절 false)·교환·사이트 삭제, 그리고 새 창의 승인 화면 */
async function mockLogin(ctx) {
  const nf = { tickets: 0, clientId: '', authorized: null, exchanged: 0, authHeaders: 0, deleted: [], opened: [] };
  await ctx.route(/^https:\/\/api\.netlify\.com\/api\/v1\/oauth\//, async (r) => {
    const req = r.request(); const u = new URL(req.url()); const m = req.method();
    const json = (o, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(o) });
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    if (req.headers().authorization) nf.authHeaders++; // 로그인 흐름에는 토큰을 보내지 않음
    if (u.pathname.endsWith('/oauth/tickets') && m === 'POST') { nf.tickets++; nf.clientId = u.searchParams.get('client_id') || ''; return json({ id: `tk${nf.tickets}abcdefgh`, client_id: nf.clientId, authorized: null, message: null }, 201); }
    if (/\/oauth\/tickets\/tk\d+abcdefgh$/.test(u.pathname) && m === 'GET') return json({ id: u.pathname.split('/').pop(), authorized: nf.authorized, message: null });
    if (/\/oauth\/tickets\/tk\d+abcdefgh\/exchange$/.test(u.pathname) && m === 'POST') { if (nf.authorized !== true) return json({ code: 401, message: 'Access Denied' }, 401); nf.exchanged++; return json({ id: 'tok1', access_token: TOKEN, user_id: 'u1' }); }
    return json({ code: 404, message: 'Not Found' }, 404);
  });
  await ctx.route(/^https:\/\/api\.netlify\.com\/api\/v1\/sites\/site1$/, async (r) => {
    const req = r.request();
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    if (req.method() !== 'DELETE') return r.fallback();
    nf.deleted.push(req.headers().authorization === `Bearer ${TOKEN}` ? 'site1' : 'bad-token');
    return r.fulfill({ status: 204, headers: cors });
  });
  await ctx.route(/^https:\/\/app\.netlify\.com\/authorize/, (r) => { nf.opened.push(r.request().url()); return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Authorize lecpage</title><button>Authorize</button>' }); });
  return nf;
}

(async () => {
  const b = await chromium.launch();
  // ── 배포하기 화면: [Netlify 계정으로 배포] 하나로 연결 + 배포 ──
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 }); const st = await mockAll(ctx); const nf = await mockLogin(ctx);
    const p = await ctx.newPage(); const errs = watch(p);
    await openShare(p);
    const order = (await p.locator('.pub-opt').allInnerTexts()).map((t) => t.replace(/\s+/g, ' '));
    ok('without the connector, a login-once place comes first', /^Netlify/.test(order[0] || '') && /로그인 한 번/.test(order[0] || ''), order.join(' | '));
    await pick(p, 'Netlify');
    await p.waitForSelector('.one-click button:has-text("Netlify 계정으로 배포")', { timeout: 15000 });
    const card = (await p.locator('.publish').innerText()).replace(/\s+/g, ' ');
    ok('netlify card: one button, login once, login stays in this browser', /Netlify 로그인 한 번으로 배포/.test(card) && /로그인 정보는 이 브라우저에만 저장돼요\. lecpage 운영자는 볼 수 없어요/.test(card), card.slice(0, 220));
    ok('netlify card: exactly one primary button to press', await p.locator('.publish .btn-primary:visible:not([disabled])').count() === 1, (await p.locator('.publish .btn-primary:visible').allInnerTexts()).join(' | '));
    ok('token steps are folded away as another way', await p.locator('.publish .run-alt:not([open]) > summary:has-text("토큰으로 연결")').count() === 1 && !(await p.locator('.publish .walk-h').first().isVisible().catch(() => false)));
    await p.fill('.publish .addr-name input', 'maum-nf');
    await p.locator('.publish').scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + '1-card.png' });
    // ① 참여 기능을 어떻게 할지는 다른 곳처럼 로그인 전에 한 번만 물음 → 답하면 새 창이 열리고 기다림 → [중지]
    await p.click('.one-click button:has-text("Netlify 계정으로 배포")');
    await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 8000 });
    ok('asks about participation before the login window opens (not after logging in)', nf.tickets === 0 && ctx.pages().length === 1, `tickets ${nf.tickets} pages ${ctx.pages().length}`);
    let [pop] = await Promise.all([ctx.waitForEvent('page'), p.click('dialog[open] button:has-text("참여 기능 없이")')]);
    await p.waitForFunction(() => /새 창에서 Netlify에 로그인하고 \[Authorize\]/.test(document.querySelector('.run-box')?.textContent || ''), null, { timeout: 15000 });
    await pop.waitForURL(/app\.netlify\.com\/authorize\?response_type=ticket&ticket=tk1abcdefgh/, { timeout: 10000 }).catch(() => { });
    ok('login window opens on the Netlify authorize page for this ticket', /response_type=ticket&ticket=tk1abcdefgh/.test(pop.url()) && nf.clientId.length > 20, pop.url());
    ok('waiting shows one line, a link to reopen the window, and [stop]', /authorize\?response_type=ticket/.test(await p.locator('.run-box a:has-text("로그인 창 열기")').getAttribute('href') || '') && await p.locator('.run-box button:has-text("중지")').count() === 1);
    await p.screenshot({ path: OUT + '2-waiting.png' });
    await p.click('.run-box button:has-text("중지")');
    await toastHas(p, /멈췄어요/);
    ok('[stop] returns to the card with nothing connected', await p.locator('.one-click button:has-text("Netlify 계정으로 배포"):not([disabled])').count() === 1 && await p.locator('.publish .conn-line').count() === 0);
    // ② Netlify에서 거절 → 까닭 + [다시 시도]
    nf.authorized = false;
    await Promise.all([ctx.waitForEvent('page'), p.click('.one-click button:has-text("Netlify 계정으로 배포")')]);
    await p.waitForSelector('.one-click .run-fail', { timeout: 15000 });
    const denied = (await p.locator('.one-click .run-fail').innerText()).replace(/\s+/g, ' ');
    ok('denied on Netlify → reason and one action', /허용하지 않았어요/.test(denied) && await p.locator('.one-click .run-fail button.btn-primary:has-text("다시 시도")').count() === 1, denied.slice(0, 140));
    await p.screenshot({ path: OUT + '3-denied.png' });
    // ③ [다시 시도] → 승인 → 연결되고 이어서 배포까지
    nf.authorized = null;
    [pop] = await Promise.all([ctx.waitForEvent('page'), p.click('.one-click .run-fail button:has-text("다시 시도")')]);
    await p.waitForSelector('.run-box', { timeout: 10000 });
    nf.authorized = true; // 새 창에서 [Authorize]
    await p.waitForFunction(() => document.querySelector('.success .big-url')?.textContent === 'https://maum-nf.netlify.app/', null, { timeout: 60000 });
    ok('no second question after logging in', await p.locator('dialog[open]').count() === 0);
    await p.waitForTimeout(500);
    ok('after deploying, focus lands on the result heading', await p.evaluate(() => document.activeElement?.id === 'done-h'), await p.evaluate(() => document.activeElement?.tagName + '#' + document.activeElement?.id));
    ok('authorize → connected and deployed in one go', nf.exchanged === 1 && st.nf.calls.some((c) => /^POST \/api\/v1\/sites/.test(c)), `calls ${st.nf.calls.filter((c) => /POST/.test(c)).join(',')}`);
    ok('login requests carry no token', nf.authHeaders === 0);
    await p.waitForTimeout(600);
    ok('login window closed after connecting', pop.isClosed());
    await p.screenshot({ path: OUT + '4-done.png', fullPage: true });
    // ④ 다음부터는 [다시 배포하기] 하나
    await p.locator('.publish').scrollIntoViewIfNeeded();
    if (!(await p.locator('.one-click').count())) await pick(p, 'Netlify');
    await p.waitForSelector('.one-click button:has-text("다시 배포하기")', { timeout: 15000 });
    ok('second time: connected line and only [redeploy]', await p.locator('.one-click .conn-line').count() === 1 && await p.locator('.one-click .run-alt').count() === 0 && await p.locator('.one-click .addr-name').count() === 0);
    await p.click('.one-click button:has-text("다시 배포하기")');
    await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => { });
    await toastHas(p, /같은 주소에 다시 배포/);
    ok('redeploys to the same site without logging in again', st.nf.calls.includes('POST /api/v1/sites/site1/deploys') && nf.tickets === 3);
    // ⑤ 배포 취소: 실제로 지움
    await p.click('.one-click button:has-text("배포 취소")');
    await p.waitForSelector('dialog[open] button.btn-danger:has-text("배포 취소")');
    await p.click('dialog[open] button.btn-danger:has-text("배포 취소")');
    await toastHas(p, /배포를 취소했어요/);
    ok('undeploy deletes the site with the login token', nf.deleted.join() === 'site1');
    ok('no script errors', errs.length === 0, JSON.stringify(errs).slice(0, 300));
    await ctx.close();
  } catch (e) { fails++; console.log('FAIL exception(deploy) :: ' + String(e && e.message || e).slice(0, 400)); }
  // ── 팝업이 막힌 브라우저: 화면의 [로그인 창 열기]로 이어 감. 토큰 길(다른 방법)도 그대로 ──
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }); await mockAll(ctx); const nf = await mockLogin(ctx);
    await ctx.addInitScript(() => { window.open = () => null; });
    const p = await ctx.newPage(); const errs = watch(p);
    await openShare(p); await pick(p, 'Netlify');
    await p.waitForSelector('.one-click button:has-text("Netlify 계정으로 배포")', { timeout: 15000 });
    ok('no overflow @390', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
    await p.click('.one-click button:has-text("Netlify 계정으로 배포")');
    await p.click('dialog[open] button:has-text("참여 기능 없이")', { timeout: 8000 });
    await p.waitForSelector('.run-box a:has-text("로그인 창 열기")', { timeout: 15000 });
    const blockedBox = (await p.locator('.run-box').innerText()).replace(/\s+/g, ' ');
    ok('popup blocked → says so, and [open the login window] is the primary, focused button', /새 창이 막혔어요\. \[로그인 창 열기\]를 눌러 주세요/.test(blockedBox) && !/새 창에서 Netlify에 로그인하고/.test(blockedBox)
      && await p.locator('.run-box a.btn-primary:has-text("로그인 창 열기")').count() === 1 && await p.evaluate(() => document.activeElement?.classList.contains('run-login')), blockedBox.slice(0, 120));
    ok('popup blocked → the link opens the same authorize page', /authorize\?response_type=ticket&ticket=tk1abcdefgh/.test(await p.locator('.run-box a:has-text("로그인 창 열기")').getAttribute('href') || ''));
    await p.locator('.run-box').scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + '5-blocked-390.png' });
    await p.click('.run-box button:has-text("중지")'); await toastHas(p, /멈췄어요/);
    // 다른 방법: 토큰으로 연결(예전 순서 그대로)
    await p.click('.publish .run-alt > summary:has-text("토큰으로 연결")');
    ok('another way: token steps, one open at a time', await p.locator('.publish .run-alt[open] .walk-b').count() === 1, (await p.locator('.publish .walk-h').allInnerTexts()).join(' / '));
    await p.click('.publish .walk-h:has-text("토큰 붙여넣기")');
    await p.fill('.publish .walk input[type=password]', TOKEN); await p.click('.publish .walk-b button:has-text("연결")');
    await p.waitForSelector('.publish .conn-line', { timeout: 10000 });
    ok('token path still connects', await p.locator('.one-click button.btn-lg:has-text("배포하기")').count() === 1 && nf.exchanged === 0);
    ok('no script errors (390)', errs.length === 0, JSON.stringify(errs).slice(0, 300));
    await ctx.close();
  } catch (e) { fails++; console.log('FAIL exception(blocked) :: ' + String(e && e.message || e).slice(0, 400)); }
  // ── 설정의 연결 창: [Netlify 계정으로 연결] ──
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 }); await mockAll(ctx); const nf = await mockLogin(ctx);
    const p = await ctx.newPage(); const errs = watch(p);
    await p.goto((process.env.BASE || 'http://localhost:4182/') + '#/settings'); await p.waitForTimeout(500);
    await p.click('.set-more:not([open]) > summary').catch(() => { });
    await p.click('.list-rows li:has-text("Netlify") button:text-is("연결")');
    await p.waitForSelector('dialog[open] button:has-text("Netlify 계정으로 연결")');
    await p.screenshot({ path: OUT + '6-settings.png' });
    await Promise.all([ctx.waitForEvent('page'), p.click('dialog[open] button:has-text("Netlify 계정으로 연결")')]);
    await p.waitForSelector('dialog[open] .run-box', { timeout: 10000 });
    nf.authorized = true;
    await p.waitForFunction(() => [...document.querySelectorAll('.list-rows li')].some((li) => /Netlify/.test(li.textContent) && /연결됨/.test(li.textContent)), null, { timeout: 15000 });
    ok('settings: one button connects Netlify and closes the dialog', await p.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 3000 }).then(() => true, () => false));
    ok('no script errors (settings)', errs.length === 0, JSON.stringify(errs).slice(0, 300));
    await ctx.close();
  } catch (e) { fails++; console.log('FAIL exception(settings) :: ' + String(e && e.message || e).slice(0, 400)); }
  // ── 운영 주소의 머리글(Cross-Origin-Opener-Policy: same-origin)에서도: 로그인 창이 Netlify로 넘어가면 앱은 그 창을 닫지 못함(브라우저가 두 창을 끊음) ──
  //    그래도 로그인 → 연결 → 이어서 배포가 되고, 기다리는 동안 '이 탭으로 돌아오면 이어서'라고 알려야 함
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 }); const st = await mockAll(ctx); const nf = await mockLogin(ctx);
    const base = new URL(process.env.BASE || 'http://localhost:4182/');
    await ctx.route((u) => u.origin === base.origin && (u.pathname === base.pathname || /\/index\.html$/.test(u.pathname)), async (r) => {
      const resp = await r.fetch();
      await r.fulfill({ response: resp, headers: { ...resp.headers(), 'cross-origin-opener-policy': 'same-origin' } });
    });
    const p = await ctx.newPage(); const errs = watch(p);
    await openShare(p);
    await pick(p, 'Netlify');
    await p.waitForSelector('.one-click button:has-text("Netlify 계정으로 배포")', { timeout: 15000 });
    await p.click('.one-click button:has-text("Netlify 계정으로 배포")');
    const [pop] = await Promise.all([ctx.waitForEvent('page'), p.click('dialog[open] button:has-text("참여 기능 없이")', { timeout: 8000 })]);
    await p.waitForSelector('.run-box', { timeout: 15000 });
    await pop.waitForURL(/app\.netlify\.com\/authorize\?response_type=ticket/, { timeout: 10000 }).catch(() => { });
    const cut = await p.evaluate(() => crossOriginIsolated === false && document.querySelector('.run-box') !== null) && /app\.netlify\.com\/authorize/.test(pop.url());
    const hint = (await p.locator('.run-box').innerText()).replace(/\s+/g, ' ');
    ok('COOP: waiting tells the user to come back to this tab', cut && /이 탭으로 돌아오면 이어서/.test(hint), hint.slice(0, 200));
    nf.authorized = true; // 새 창에서 [Authorize]
    await p.waitForFunction(() => /netlify\.app/.test(document.querySelector('.success .big-url')?.textContent || ''), null, { timeout: 60000 });
    ok('COOP: authorize → connected and deployed even though the app cannot close the login window', nf.exchanged === 1 && st.nf.calls.some((c) => /^POST \/api\/v1\/sites/.test(c)) && !pop.isClosed(), `exchanged ${nf.exchanged} popClosed ${pop.isClosed()}`);
    ok('no script errors (COOP)', errs.length === 0, JSON.stringify(errs).slice(0, 300));
    await ctx.close();
  } catch (e) { fails++; console.log('FAIL exception(coop) :: ' + String(e && e.message || e).slice(0, 400)); }
  await b.close();
  console.log(`\n${passes} pass, ${fails} fail`);
  process.exit(fails ? 1 : 0);
})();
