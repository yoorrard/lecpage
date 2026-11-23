// 내 Cloudflare 계정에 한 번에(lecpage 커넥트 경유): 실제 커넥트(scripts/studio.mjs)가 앱 빌드본을 보여 주고,
// wrangler와 Cloudflare만 가짜(engine/test/fixtures/fake-wrangler-cf.mjs + 이 파일의 가짜 API·workers.dev)로 앱 흐름을 끝까지.
//   배포하기 → Cloudflare → [Cloudflare 계정으로 배포] → 로그인 기다림 → (가짜 [Allow]) → 주소 + 참여 기능 연결 → 다시 배포 → 배포 취소
//   + 참여 기능만: 다른 연수의 참여 기능 연결에서 [Cloudflare 계정으로 연결]
// 실행: DIST=<앱 빌드본> node tests/e2e/cf-connect.js   (포트 4351~4352)
const path = require('path'); const os = require('os'); const http = require('http'); const fs = require('fs');
const { pathToFileURL } = require('url');
const ROOT = path.resolve(__dirname, '../..');
const DIST = path.resolve(process.env.DIST || path.join(ROOT, 'app/dist'));
const PORT = 4351, CF = 4352;
process.env.BASE = `http://127.0.0.1:${PORT}/`;
const { chromium, mockAll, openShare, toastHas, watch } = require('./h3.js');
const OUT = path.resolve(process.env.OUT || path.join(ROOT, '.out/verify/shots'), 'cf-connect') + '/'; fs.mkdirSync(OUT, { recursive: true });
let fails = 0, passes = 0;
const ok = (name, cond, extra = '') => { cond ? passes++ : fails++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`); };
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-cf-e2e-'));
const STATE = path.join(T, 'cf.json'); const WLOG = path.join(T, 'wrangler.log');
const ACC = 'a'.repeat(32), TOKEN = 'cf-oauth-' + 'x'.repeat(40);
const read = () => JSON.parse(fs.readFileSync(STATE, 'utf8'));
const patch = (o) => fs.writeFileSync(STATE, JSON.stringify({ ...read(), ...o }));
fs.writeFileSync(STATE, JSON.stringify({ loggedIn: false, approve: false, accounts: [{ id: ACC, name: '김강사 계정' }], sub: 'teacher', workers: {}, token: TOKEN }));
const admin = []; // 참여 기능 서버가 받은 /init(관리자 키 길이만)

/** 가짜 Cloudflare API + 가짜 workers.dev(사이트·참여 기능 서버). 브라우저도 부르므로 CORS를 붙임 */
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const fake = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); const s = read();
  const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json', ...cors }); res.end(JSON.stringify(body)); };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const w = u.pathname.match(/^\/w\/([a-z0-9-]+)(\/.*)?$/);
  if (w) {
    const k = s.workers?.[w[1]];
    if (!k || k.draft) return send(404, { ok: false });
    if (/\/api\/[^/]+\/init$/.test(w[2] || '')) { admin.push({ code: w[2].split('/')[2], key: decodeURIComponent(req.headers['x-lec-admin'] || '').length }); return send(200, { ok: true }); }
    return send(200, { ok: true, protocol: 1, runtime: 'cloudflare', uploads: false });
  }
  if (req.headers.authorization !== `Bearer ${s.token}`) return send(403, { success: false, errors: [{ code: 10000, message: 'Authentication error' }] });
  if (/\/workers\/subdomain$/.test(u.pathname)) return send(200, { success: true, result: { subdomain: s.sub } });
  const sec = u.pathname.match(/\/workers\/scripts\/([a-z0-9-]+)\/secrets$/);
  if (sec) { const k = s.workers?.[sec[1]]; return k ? send(200, { success: true, result: k.secrets.map((name) => ({ name, type: 'secret_text' })) }) : send(404, { success: false, errors: [{ code: 10007, message: 'not found' }] }); }
  return send(404, { success: false, errors: [{ code: 7003 }] });
});

(async () => {
  await new Promise((r) => fake.listen(CF, '127.0.0.1', r));
  process.env.FAKE_CF_STATE = STATE; process.env.FAKE_WRANGLER_LOG = WLOG;
  const St = await import(pathToFileURL(path.join(ROOT, 'skills/lecpage/scripts/studio.mjs')).href);
  const lines = [];
  const st = await St.startStudio({ port: PORT, dist: DIST, home: path.join(T, 'home'), log: (l) => lines.push(l) });
  st.S.cfOpts = { wrangler: path.join(ROOT, 'skills/lecpage/engine/test/fixtures/fake-wrangler-cf.mjs'), api: `http://127.0.0.1:${CF}`, urlBase: `http://127.0.0.1:${CF}/w/`, open: false };
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 }); await mockAll(ctx);
    await ctx.route(/^http:\/\/127\.0\.0\.1:435[12]\//, (r) => r.continue()); // 실제 커넥트와 가짜 Cloudflare는 그대로(mockAll은 localhost 밖을 모두 가짜로 받음)
    const p = await ctx.newPage(); const errs = watch(p);
    await openShare(p);
    if (!(await p.locator('.pub-opt').count()) && await p.locator('.pub-mode').count()) await p.click('.pub-mode:has-text("다른 곳에 배포")');
    await p.click('.pub-opt:has-text("Cloudflare")');
    await p.waitForSelector('.one-click button:has-text("Cloudflare 계정으로 배포")', { timeout: 15000 });
    const card = (await p.locator('.publish').innerText()).replace(/\s+/g, ' ');
    const liveOn = /참여 기능 서버도 내 계정에 만들어요/.test(card);
    // 이 연수는 참여 기능이 켜져 있고 연결 전이므로 서버를 함께 만들어야 함(아래 `liveOn` 조건의 단언들이 건너뛰어지지 않게 여기서 못 박음)
    ok('participation server is made together with the site', liveOn, card.slice(0, 200));
    ok('cloudflare card: one button, login once', /로그인 한 번으로 사이트와 참여 기능을/.test(card) && /처음 한 번만 브라우저에서 Cloudflare에 로그인/.test(card), card.slice(0, 200));
    ok('no separate "connect participation" box when the relay is made together', !liveOn || await p.locator('.pub-live').count() === 0);
    ok('manual ZIP steps are folded away', await p.locator('.publish .run-alt:not([open])').count() === 1 && !(await p.locator('.publish .walk-h').first().isVisible().catch(() => false)));
    await p.fill('.publish .addr-name input', 'maum-class');
    await p.locator('.publish').scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + '1-card.png' });
    await p.click('.one-click button:has-text("Cloudflare 계정으로 배포")');
    // 처음: 로그인을 기다림 → 가짜 [Allow]
    await p.waitForFunction(() => /브라우저에서 Cloudflare에 로그인하고/.test(document.querySelector('.run-box')?.textContent || ''), null, { timeout: 20000 });
    ok('waits for the Cloudflare login with a link to reopen it', await p.locator('.run-box a:has-text("로그인 창 열기")').count() === 1);
    await p.screenshot({ path: OUT + '2-login.png' });
    patch({ approve: true });
    await p.waitForFunction((want) => document.querySelector('.success .big-url')?.textContent === want, `http://127.0.0.1:${CF}/w/maum-class/`, { timeout: 60000 });
    const s1 = read();
    ok('site deployed to my account under the chosen name', s1.workers['maum-class']?.assets === true && s1.workers['maum-class'].files > 3, JSON.stringify({ files: s1.workers['maum-class']?.files }));
    if (liveOn) {
      ok('participation server created with an admin key', s1.workers['lecpage-live']?.secrets.includes('ADMIN_KEY') && /^len2\d:/.test(s1.workers['lecpage-live'].key));
      ok('this training registered on the server with that key', admin.length >= 1 && admin[0].key >= 20 && /^[A-Z0-9]{4,}$/.test(admin[0].code), JSON.stringify(admin[0]));
      await p.click('#live-setup button:has-text("바꾸기")').catch(() => { });
      await p.waitForTimeout(400);
      const row = (await p.locator('#live-setup').innerText().catch(() => '')).replace(/\s+/g, ' ');
      ok('app shows participation as connected to my Cloudflare server', /내 서버·Cloudflare에 연결돼 있어요/.test(row) && row.includes(`127.0.0.1:${CF}/w/lecpage-live`), row.slice(0, 200));
    }
    const wl = fs.readFileSync(WLOG, 'utf8');
    ok('admin key and token never reach logs', !/[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}/.test(wl + lines.join('\n')) && !(wl + lines.join('\n')).includes(TOKEN), wl.replace(/\n/g, ' | ').slice(0, 300));
    await p.screenshot({ path: OUT + '3-done.png', fullPage: true });
    // 다시 배포: 버튼 하나, 로그인·이름 없이 같은 주소
    await p.locator('.publish').scrollIntoViewIfNeeded();
    if (!(await p.locator('.one-click').count())) { if (await p.locator('.pub-mode:has-text("다른 곳에 배포")').count()) await p.click('.pub-mode:has-text("다른 곳에 배포")'); await p.click('.pub-opt:has-text("Cloudflare")'); }
    await p.waitForSelector('.one-click button:has-text("다시 배포하기")', { timeout: 15000 });
    ok('second time: only [redeploy], no name field', await p.locator('.one-click .addr-name').count() === 0);
    await p.click('.one-click button:has-text("다시 배포하기")');
    await toastHas(p, /같은 주소에 다시 배포/);
    ok('redeployed to the same name without logging in again', read().workers['maum-class'].deploys === 2 && (fs.readFileSync(WLOG, 'utf8').match(/^login/gm) || []).length === 1);
    ok('participation server was reused, not redeployed', !liveOn || read().workers['lecpage-live'].deploys === 1);
    // 배포 취소: 실제로 지움
    await p.waitForSelector('.one-click button:has-text("배포 취소")');
    await p.click('.one-click button:has-text("배포 취소")');
    await p.waitForSelector('dialog[open] button.btn-danger:has-text("배포 취소")');
    ok('undeploy asks about the participation server only as an option', !liveOn || await p.locator('dialog[open] label:has-text("참여 기능 서버도 삭제") input:not(:checked)').count() === 1);
    await p.screenshot({ path: OUT + '4-undeploy.png' });
    await p.click('dialog[open] button.btn-danger:has-text("배포 취소")');
    await toastHas(p, /배포를 취소했어요/);
    const s2 = read();
    ok('site deleted from my account, participation server kept', !s2.workers['maum-class'] && (!liveOn || !!s2.workers['lecpage-live']));
    // 참여 기능만 한 번에(Vercel·Netlify·GitHub·ZIP으로 배포하는 사람의 길): 연결을 끊고 [Cloudflare 계정으로 연결] 하나로 다시 — 주소·관리자 키를 옮겨 적지 않음
    if (liveOn) {
      if (!(await p.locator('#live-setup button:has-text("연결 바꾸기")').count())) await p.click('#live-setup button:has-text("바꾸기")');
      await p.click('#live-setup button:has-text("연결 바꾸기")');
      await p.waitForSelector('#live-setup button:has-text("Cloudflare 계정으로 연결")', { timeout: 10000 });
      ok('live setup: one button, manual steps and other ways folded away', await p.locator('#live-setup .one-click > .run-alt:not([open])').count() === 1 && await p.locator('#live-setup .live-others:not([open])').count() === 1 && !(await p.locator('#live-setup .walk-h').first().isVisible().catch(() => false)));
      await p.locator('#live-setup').scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + '5-live-one-click.png' });
      const before = admin.length;
      await p.click('#live-setup button:has-text("Cloudflare 계정으로 연결")');
      await toastHas(p, /참여 기능 서버에 연결했어요/);
      const row = (await p.locator('#live-setup').innerText()).replace(/\s+/g, ' ');
      ok('live setup: connected to the existing server without retyping anything', /내 서버·Cloudflare에 연결돼 있어요/.test(row) && read().workers['lecpage-live'].deploys === 1 && admin.length > before, row.slice(0, 160));
    }
    // 연결 해제: 이 PC의 Cloudflare 로그인을 지움
    await p.locator('.publish').scrollIntoViewIfNeeded();
    if (!(await p.locator('.one-click').count())) { if (await p.locator('.pub-mode:has-text("다른 곳에 배포")').count()) await p.click('.pub-mode:has-text("다른 곳에 배포")'); await p.click('.pub-opt:has-text("Cloudflare")'); }
    await p.waitForSelector('.one-click .conn-line button:has-text("연결 해제")', { timeout: 10000 });
    await p.click('.one-click .conn-line button:has-text("연결 해제")');
    await toastHas(p, /Cloudflare 로그인을 지웠어요/);
    ok('disconnect signs this PC out of Cloudflare', read().loggedIn === false && await p.locator('.one-click button:has-text("Cloudflare 계정으로 배포")').count() === 1);
    ok('no script errors', errs.length === 0, JSON.stringify(errs).slice(0, 300));
    await ctx.close();
  } catch (e) { fails++; console.log('FAIL exception :: ' + String(e && e.message || e).slice(0, 400)); }
  await b.close(); await st.close(); fake.close();
  try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* 넘김 */ }
  console.log(`\n${passes} pass, ${fails} fail`);
  process.exit(fails ? 1 : 0);
})();
