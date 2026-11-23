// lecpage 커넥트로 도는 배포·배포 취소 화면의 가장자리(가짜 커넥트: 주소만 흉내, 실제 커넥트 없이 화면의 약속만 봄).
//   ① 도는 동안 배포할 곳을 바꿀 수 없고(진행·[중지]가 사라지지 않음), 3단계를 떠나면 기다리던 일을 멈춤(DELETE) → 돌아오면 버튼이 살아 있음
//   ② 배포 → 같은 이름이 이 PC의 커넥트가 올린 것이 아니라는 답(not-ours) → [다른 이름으로 배포] 하나(그 사이트를 덮지 않음)
//   ③ 배포 취소: 로그인이 풀려 승인을 기다리는 동안 창 안에 진행·[로그인 창 열기]·[중지] → [중지] → 다시 → 실제 삭제
//   ④ 파일로 가져온 연수에 적혀 온 이름(carried): 배포 전에 한 번 물음 → [다른 이름으로 배포]
//   ⑤ 커넥트가 꺼진 채 토큰으로 배포 취소: 커넥트로 올린 프로젝트를 토큰이 찾지 못하면(404) '취소했어요'라고 하지 않음
// 실행: BASE=<앱 미리보기 주소> node tests/e2e/connect-ui.js
const { chromium, fs, BASE, mockAll, openShare, connect, toastHas, watch } = require('./h3.js');
const L = require('./lib.js');
const path = require('path');
const OUT = path.resolve(process.env.OUT || path.join(__dirname, '../../.out/verify/shots'), 'connect-ui') + '/'; fs.mkdirSync(OUT, { recursive: true });
let fails = 0, passes = 0;
const ok = (name, cond, extra = '') => { cond ? passes++ : fails++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`); };
const TOKEN = 'e'.repeat(64); const PORT = 6621;
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const pick = async (p, label) => { if (!(await p.locator('.pub-opt').count()) && await p.locator('.pub-mode').count()) await p.click('.pub-mode:has-text("다른 곳에 배포")'); await p.click(`.pub-opt:has-text("${label}")`); };
const skipLive = (p) => p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => { });

/** 가짜 커넥트: B.vc(지금 상태) · B.on[일](body) → 그 일을 시작했을 때의 상태 · B.calls · B.posts(받은 본문) · B.off(꺼짐) */
async function bridge(ctx) {
  const B = { vc: { running: false, phase: 'idle' }, on: {}, calls: [], posts: [], off: false, n: 0 };
  await ctx.addInitScript(([tk, port]) => { try { if (!sessionStorage.getItem('lp-seeded')) { localStorage.setItem('lecpage:pc', JSON.stringify({ token: tk, port, at: Date.now() })); sessionStorage.setItem('lp-seeded', '1'); } } catch { /* 넘김 */ } }, [TOKEN, PORT]);
  await ctx.route(new RegExp(`^http://127\\.0\\.0\\.1:${PORT}/`), (r) => {
    const req = r.request(); const u = new URL(req.url()); const m = req.method();
    if (B.off) return r.abort('connectionrefused');
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const send = (o, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(o) });
    if (req.headers()['x-lecpage-bridge'] !== TOKEN) return send({ ok: false, error: 'token' }, 401);
    if (u.pathname === '/bridge/status') return send({ ok: true, version: '1.1.0', caps: ['status-caps', 'cloudflare', 'vercel'], agents: [{ id: 'claude', installed: false }, { id: 'codex', installed: false }] });
    B.calls.push(`${m} ${u.pathname}`);
    if (u.pathname === '/bridge/vercel' && m === 'GET') return send({ ok: true, vc: B.vc });
    if (u.pathname === '/bridge/vercel' && m === 'DELETE') { if (B.vc.running) B.vc = { ...B.vc, running: false, ask: undefined, error: { code: 'cancelled', message_ko: '멈췄어요.' } }; return send({ ok: true, vc: B.vc }); }
    if (u.pathname === '/bridge/vercel/draft' && m === 'POST') return send({ ok: true, draft: 'd' + (++B.n) });
    if (u.pathname === '/bridge/vercel/files' && m === 'POST') return send({ ok: true });
    const sub = (/^\/bridge\/vercel\/(site|delete|open|logout)$/.exec(u.pathname) || [])[1];
    if (sub && m === 'POST') {
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch { /* 빈 본문 */ }
      B.posts.push({ sub, body });
      B.vc = { id: 'j' + (++B.n), kind: sub, seconds: 1, ...(B.on[sub] ? B.on[sub](body) : { running: false, result: {} }) };
      return send({ ok: true, vc: B.vc }, 202);
    }
    return send({ ok: false, error: 'not-found' }, 404);
  });
  return B;
}
const done = (name) => ({ running: false, phase: 'wait', result: { site: { url: `https://${name}.vercel.app/`, name, projectId: 'prj_' + name, opened: true }, account: { name: '김강사' } } });
const waitCall = async (p, B, call, ms = 8000) => { for (const t0 = Date.now(); Date.now() - t0 < ms;) { if (B.calls.includes(call)) return true; await p.waitForTimeout(100); } return false; };
/** 저장된 연수의 Vercel 배포 기록에 '파일로 가져옴(carried)' 표시를 켜거나 끔(앱의 CSP가 eval을 막으므로 넘긴 글을 실행하지 않고 값만 넘김) */
const setCarried = (p, pid, on) => p.evaluate(([id, yes]) => new Promise((res) => {
  const q = indexedDB.open('lecpage'); q.onerror = () => res(false);
  q.onsuccess = () => {
    const st = q.result.transaction('projects', 'readwrite').objectStore('projects'); const g = st.get(id);
    g.onerror = () => res(false);
    g.onsuccess = () => { const v = g.result; if (!v?.deploy?.vercel) return res(false); if (yes) v.deploy.vercel.carried = true; else delete v.deploy.vercel.carried; const w = st.put(v); w.onsuccess = () => res(true); w.onerror = () => res(false); };
  };
}), [pid, on]);
const openVercel = async (p) => { await p.locator('.publish').scrollIntoViewIfNeeded(); await p.waitForTimeout(400); if (!(await p.locator('.pub-opt:has-text("Vercel") input:checked').count())) await pick(p, 'Vercel'); };

(async () => {
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 }); await mockAll(ctx); const B = await bridge(ctx);
    // ⑤에서 씀: 연결해 둔 토큰으로는 그 프로젝트가 없다고 답함(다른 팀에 있음)
    await ctx.route(/^https:\/\/api\.vercel\.com\/v9\/projects\/[^/?]+(\?.*)?$/, (r) => (r.request().method() === 'DELETE' ? r.fulfill({ status: 404, contentType: 'application/json', headers: cors, body: JSON.stringify({ error: { code: 'not_found', message: 'Project not found.' } }) }) : r.fallback()));
    const p = await ctx.newPage(); const errs = watch(p);
    await openShare(p); const pid = L.pidOf(p);
    await pick(p, 'Vercel');
    await p.waitForSelector('.one-click button:has-text("Vercel 계정으로 배포")', { timeout: 15000 });

    // ── ① 도는 동안 배포할 곳을 바꿀 수 없고, 떠나면 멈춤 ──
    B.on.site = () => ({ running: true, phase: 'login', loginUrl: 'https://vercel.com/oauth/device?user_code=ABCD-EFGH' });
    await p.fill('.publish .addr-name input', 'lec-one');
    await p.click('.one-click button:has-text("Vercel 계정으로 배포")'); await skipLive(p);
    await p.waitForSelector('.run-box:has-text("Vercel에 로그인")', { timeout: 20000 });
    ok('while it runs: other deploy targets cannot be picked, progress and [stop] stay', await p.locator('.pub-opt input[type=radio]:not(:checked):not([disabled])').count() === 0 && await p.locator('.pub-opt input[type=radio]:checked').count() === 1 && await p.locator('.run-box button:has-text("중지")').count() === 1 && await p.locator('.run-box a:has-text("로그인 창 열기")').count() === 1);
    await p.screenshot({ path: OUT + '1-running.png' });
    const before = B.calls.length;
    await p.evaluate((id) => { location.hash = `#/p/${id}/2`; }, pid);
    ok('leaving the step stops the waiting job on the 커넥트', await waitCall(p, B, 'DELETE /bridge/vercel') && B.calls.slice(before).includes('DELETE /bridge/vercel'), B.calls.slice(before).join(','));
    await p.waitForTimeout(600);
    await p.evaluate((id) => { location.hash = `#/p/${id}/3`; }, pid);
    await p.waitForSelector('.publish', { timeout: 20000 }); await openVercel(p);
    ok('back on the step: the button is live again, nothing was deployed', await p.waitForSelector('.one-click button.btn-lg:has-text("Vercel 계정으로 배포"):not([disabled])', { timeout: 10000 }).then(() => true, () => false) && await p.locator('.success .big-url').count() === 0);

    // ── ② 배포 → 다시 배포에 not-ours → [다른 이름으로 배포] ──
    B.on.site = (o) => done(o.name);
    await p.fill('.publish .addr-name input', 'lec-one');
    await p.click('.one-click button:has-text("Vercel 계정으로 배포")'); await skipLive(p);
    await p.waitForFunction(() => document.querySelector('.success .big-url')?.textContent === 'https://lec-one.vercel.app/', null, { timeout: 60000 });
    await openVercel(p);
    await p.waitForSelector('.one-click button:has-text("다시 배포하기")', { timeout: 15000 });
    B.on.site = () => ({ running: false, phase: 'site', error: { code: 'not-ours', message_ko: '이 PC에서 올린 사이트가 아니에요.' } });
    await p.click('.one-click button:has-text("다시 배포하기")'); await skipLive(p);
    await p.waitForSelector('.one-click .run-fail', { timeout: 20000 });
    const nf = (await p.locator('.one-click .run-fail').innerText()).replace(/\s+/g, ' ');
    ok('not ours: says it did not overwrite and offers one action', /같은 이름이 이미 있어요/.test(nf) && /덮지 않도록 멈췄어요/.test(nf) && await p.locator('.one-click .run-fail button.btn-primary:has-text("다른 이름으로 배포")').count() === 1 && B.posts.at(-1).body.again === true, nf.slice(0, 160));
    await p.screenshot({ path: OUT + '2-not-ours.png' });
    await p.click('.one-click .run-fail button:has-text("다른 이름으로 배포")');
    await p.waitForSelector('.publish .addr-name input', { timeout: 5000 });
    await p.waitForTimeout(300); // 알림이 사라진 뒤 초점을 옮김(짧게 뒤)
    const focused = await p.evaluate(() => { const a = document.activeElement; return !!a && a !== document.body && !!a.closest('.one-click'); });
    ok('after the notice button: a name field appears and focus stays in the card', focused && await p.locator('.one-click .run-fail').count() === 0);
    B.on.site = (o) => done(o.name);
    await p.fill('.publish .addr-name input', 'lec-two');
    await p.click('.one-click button.btn-lg'); await skipLive(p);
    await p.waitForFunction(() => document.querySelector('.success .big-url')?.textContent === 'https://lec-two.vercel.app/', null, { timeout: 60000 });
    ok('deploying under another name is a new deployment, not an overwrite', B.posts.at(-1).sub === 'site' && B.posts.at(-1).body.again === false && B.posts.at(-1).body.name === 'lec-two', JSON.stringify(B.posts.at(-1)));

    // ── ③ 배포 취소: 승인을 기다리는 동안 창 안에 진행·[중지] ──
    await openVercel(p);
    await p.waitForSelector('.one-click button:has-text("배포 취소")', { timeout: 15000 });
    await p.click('.one-click button:has-text("배포 취소")');
    await p.waitForSelector('dialog[open] button.btn-danger:has-text("배포 취소")');
    B.on.delete = () => ({ running: true, phase: 'login', loginUrl: 'https://vercel.com/oauth/device?user_code=WXYZ-1234' });
    await p.click('dialog[open] button.btn-danger:has-text("배포 취소")');
    await p.waitForSelector('dialog[open] .run-box:has-text("Vercel에 로그인")', { timeout: 15000 });
    ok('undeploy while signed out: the dialog shows the wait, a login link and [stop]', await p.locator('dialog[open] .run-box a:has-text("로그인 창 열기")').count() === 1 && await p.locator('dialog[open] .run-box button:has-text("중지")').count() === 1);
    await p.screenshot({ path: OUT + '3-undeploy-wait.png' });
    await p.click('dialog[open] .run-box button:has-text("중지")');
    ok('[stop] in the dialog: back to the question, no false "cancelled" notice', await p.waitForSelector('dialog[open] button.btn-danger:has-text("배포 취소"):not([disabled])', { timeout: 10000 }).then(() => true, () => false) && await p.locator('dialog[open] [role=alert]').count() === 0 && await p.locator('.success .big-url').count() === 1);
    B.on.delete = (o) => ({ running: false, phase: 'delete', result: { deleted: o.name } });
    await p.click('dialog[open] button.btn-danger:has-text("배포 취소")');
    await toastHas(p, /배포를 취소했어요/);
    ok('undeploy through the 커넥트 deletes that project', B.posts.at(-1).sub === 'delete' && B.posts.at(-1).body.name === 'lec-two');

    // ── ④ 파일로 가져온 연수에 적혀 온 이름: 배포 전에 한 번 물음 ──
    await openVercel(p);
    B.on.site = (o) => done(o.name);
    await p.waitForSelector('.one-click button.btn-lg:not([disabled])', { timeout: 15000 });
    if (await p.locator('.publish .addr-name input').count()) await p.fill('.publish .addr-name input', 'lec-three');
    await p.click('.one-click button.btn-lg'); await skipLive(p);
    await p.waitForFunction(() => document.querySelector('.success .big-url')?.textContent === 'https://lec-three.vercel.app/', null, { timeout: 60000 });
    await p.waitForTimeout(1200); // 연수 기록 저장
    ok('test setup: mark the saved record as carried in from a file', await setCarried(p, pid, true));
    await p.reload({ waitUntil: 'load' }); await p.waitForSelector('.publish', { timeout: 30000 }); await openVercel(p);
    await p.waitForSelector('.one-click button.btn-lg:not([disabled])', { timeout: 15000 });
    const sitesBefore = B.posts.filter((x) => x.sub === 'site').length;
    await p.click('.one-click button.btn-lg');
    await p.waitForSelector('dialog[open]:has-text("가져온 주소 이름으로 배포할까요")', { timeout: 10000 });
    const ask = (await p.locator('dialog[open]').innerText()).replace(/\s+/g, ' ');
    ok('carried name: asks before deploying onto it, nothing sent yet', /lec-three/.test(ask) && /그 사이트가 이 연수로 바뀌어요/.test(ask) && B.posts.filter((x) => x.sub === 'site').length === sitesBefore, ask.slice(0, 160));
    await p.screenshot({ path: OUT + '4-carried.png' });
    await p.click('dialog[open] button:has-text("다른 이름으로 배포")');
    ok('carried name → [another name]: a name field, still nothing sent', await p.waitForSelector('.publish .addr-name input', { timeout: 5000 }).then(() => true, () => false) && B.posts.filter((x) => x.sub === 'site').length === sitesBefore);

    // ── ⑤ 커넥트가 꺼진 채 토큰으로 배포 취소: 토큰이 그 프로젝트를 찾지 못하면 '취소했어요'라고 하지 않음 ──
    await setCarried(p, pid, false);
    B.off = true;
    await p.reload({ waitUntil: 'load' }); await p.waitForSelector('.publish', { timeout: 30000 });
    await p.locator('.publish').scrollIntoViewIfNeeded(); if (!(await p.locator('.publish .walk-h').count())) await pick(p, 'Vercel');
    await connect(p, 'vcp_FAKE_TOKEN_1234567890'); // h2.js의 가짜 Vercel이 받는 토큰
    await p.waitForSelector('.publish .conn-line', { timeout: 15000 });
    await p.click('.sites .sites-x');
    await p.waitForSelector('dialog[open] button.btn-danger', { timeout: 10000 });
    await p.click('dialog[open] button.btn-danger');
    await p.waitForSelector('dialog[open] [role=alert]', { timeout: 15000 });
    const miss = (await p.locator('dialog[open] [role=alert]').innerText()).replace(/\s+/g, ' ');
    ok('token cannot find a 커넥트-made project: no false success, tells to turn the 커넥트 on', /커넥트를 켠 뒤/.test(miss) && await p.locator('.success .big-url').count() === 1 && await p.locator('dialog[open] button.btn-danger:has-text("목록에서 삭제")').count() === 1, miss.slice(0, 200));
    await p.screenshot({ path: OUT + '5-token-miss.png' });
    ok('no script errors', errs.length === 0, JSON.stringify(errs).slice(0, 300));
    await ctx.close();
  } catch (e) { fails++; console.log('FAIL exception :: ' + String(e && e.stack || e).slice(0, 600)); }
  await b.close();
  console.log(`\n${passes} pass, ${fails} fail`);
  process.exit(fails ? 1 : 0);
})();
