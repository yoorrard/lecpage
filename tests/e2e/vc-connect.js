// 내 Vercel 계정에 한 번에(lecpage 커넥트 경유): 실제 커넥트(scripts/studio.mjs)가 앱 빌드본을 보여 주고,
// Vercel CLI만 가짜(engine/test/fixtures/fake-vercel.mjs + 이 파일의 가짜 사이트 주소)로 앱 흐름을 끝까지.
//   배포하기 → Vercel → [Vercel 계정으로 배포] → 로그인 기다림 → (가짜 허용) → 주소(배포 보호 풂) → 다시 배포 → 배포 보호 끄기 → 배포 취소 → 연결 해제
// 실행: DIST=<앱 빌드본> node tests/e2e/vc-connect.js   (포트 4433~4434)
const path = require('path'); const os = require('os'); const http = require('http'); const fs = require('fs');
const { pathToFileURL } = require('url');
const ROOT = path.resolve(__dirname, '../..');
const DIST = path.resolve(process.env.DIST || path.join(ROOT, 'app/dist'));
const PORT = 4433, SITE = 4434;
process.env.BASE = `http://127.0.0.1:${PORT}/`;
const { chromium, mockAll, openShare, toastHas, watch } = require('./h3.js');
const OUT = path.resolve(process.env.OUT || path.join(ROOT, '.out/verify/shots'), 'vc-connect') + '/'; fs.mkdirSync(OUT, { recursive: true });
let fails = 0, passes = 0;
const ok = (name, cond, extra = '') => { cond ? passes++ : fails++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`); };
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-vc-e2e-'));
const STATE = path.join(T, 'vc.json'); const VLOG = path.join(T, 'vercel.log');
const read = () => JSON.parse(fs.readFileSync(STATE, 'utf8'));
const patch = (o) => fs.writeFileSync(STATE, JSON.stringify({ ...read(), ...o }));
fs.writeFileSync(STATE, JSON.stringify({ loggedIn: false, approve: false, teams: ['teacher-projects'], projects: {}, sso: true }));

/** 가짜 <이름>.vercel.app: 프로젝트가 있고 보호가 풀려 있으면 200(보호가 걸려 있으면 401). 브라우저도 부르므로 CORS를 붙임 */
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const fake = http.createServer((req, res) => {
  const m = new URL(req.url, 'http://x').pathname.match(/^\/v\/([a-z0-9-]+)\//);
  const p = m && read().projects?.[m[1]];
  res.writeHead(!p ? 404 : p.sso ? 401 : 200, { 'content-type': 'text/html', ...cors }); res.end(p ? '<!doctype html><title>site</title>' : 'none');
});
const pickVercel = async (p) => {
  if (!(await p.locator('.pub-opt').count()) && await p.locator('.pub-mode').count()) await p.click('.pub-mode:has-text("다른 곳에 배포")');
  await p.click('.pub-opt:has-text("Vercel")');
};

(async () => {
  await new Promise((r) => fake.listen(SITE, '127.0.0.1', r));
  process.env.FAKE_VC_STATE = STATE; process.env.FAKE_VERCEL_LOG = VLOG;
  const St = await import(pathToFileURL(path.join(ROOT, 'skills/lecpage/scripts/studio.mjs')).href);
  const lines = [];
  const st = await St.startStudio({ port: PORT, dist: DIST, home: path.join(T, 'home'), log: (l) => lines.push(l) });
  st.S.vcOpts = { vercel: path.join(ROOT, 'skills/lecpage/engine/test/fixtures/fake-vercel.mjs'), urlBase: `http://127.0.0.1:${SITE}/v/`, open: false };
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 }); await mockAll(ctx);
    await ctx.route(/^http:\/\/127\.0\.0\.1:443[34]\//, (r) => r.continue()); // 실제 커넥트와 가짜 사이트 주소는 그대로(mockAll은 localhost 밖을 모두 가짜로 받음)
    const p = await ctx.newPage(); const errs = watch(p);
    await openShare(p);
    await pickVercel(p);
    await p.waitForSelector('.one-click button:has-text("Vercel 계정으로 배포")', { timeout: 15000 });
    const card = (await p.locator('.publish').innerText()).replace(/\s+/g, ' ');
    ok('vercel card: one button, login once, login stays on this PC', /Vercel 로그인 한 번으로 배포/.test(card) && /로그인 정보는 이 PC에만 저장돼요/.test(card), card.slice(0, 220));
    ok('list shows how each place connects', /로그인 한 번/.test(await p.locator('.pub-opt:has-text("Vercel")').innerText()) && /토큰 연결/.test(await p.locator('.pub-opt:has-text("GitHub Pages")').innerText()));
    ok('token steps are folded away as another way', await p.locator('.publish .run-alt:not([open]) > summary:has-text("토큰으로 연결")').count() === 1 && !(await p.locator('.publish .walk-h').first().isVisible().catch(() => false)));
    await p.fill('.publish .addr-name input', 'maum-vc');
    await p.locator('.publish').scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + '1-card.png' });
    await p.click('.one-click button:has-text("Vercel 계정으로 배포")');
    await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => { });
    // 처음: 로그인을 기다림 → 가짜 허용
    await p.waitForFunction(() => /브라우저에서 Vercel에 로그인하고/.test(document.querySelector('.run-box')?.textContent || ''), null, { timeout: 30000 });
    ok('waits for the Vercel login with a link to reopen it', /^https:\/\/vercel\.com\/oauth\/device/.test(await p.locator('.run-box a:has-text("로그인 창 열기")').getAttribute('href') || ''));
    await p.screenshot({ path: OUT + '2-login.png' });
    patch({ approve: true });
    await p.waitForFunction((want) => document.querySelector('.success .big-url')?.textContent === want, `http://127.0.0.1:${SITE}/v/maum-vc/`, { timeout: 60000 });
    const s1 = read();
    ok('site deployed to my account under the chosen name', s1.projects['maum-vc']?.files > 3 && s1.projects['maum-vc'].vercelJson === true, JSON.stringify(s1.projects['maum-vc']));
    ok('deployment protection turned off so participants can open it', s1.projects['maum-vc'].sso === false);
    const all = fs.readFileSync(VLOG, 'utf8') + lines.join('\n');
    ok('account mail never reaches logs', !/teacher@example\.com/.test(all), fs.readFileSync(VLOG, 'utf8').replace(/\n/g, ' | ').slice(0, 300));
    await p.screenshot({ path: OUT + '3-done.png', fullPage: true });
    // 다시 배포: 버튼 하나, 로그인·이름 없이 같은 주소
    await p.locator('.publish').scrollIntoViewIfNeeded();
    if (!(await p.locator('.one-click').count())) await pickVercel(p);
    await p.waitForSelector('.one-click button:has-text("다시 배포하기")', { timeout: 15000 });
    ok('second time: only [redeploy], no name field, no token steps', await p.locator('.one-click .addr-name').count() === 0 && await p.locator('.one-click .run-alt').count() === 0);
    await p.click('.one-click button:has-text("다시 배포하기")');
    await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => { });
    await toastHas(p, /같은 주소에 다시 배포/);
    ok('redeployed to the same project without logging in again', read().projects['maum-vc'].deploys === 2 && (fs.readFileSync(VLOG, 'utf8').match(/^login$/gm) || []).length === 1);
    // 배포 보호 끄기(강사가 Vercel에서 다시 켠 경우)
    patch({ projects: { 'maum-vc': { ...read().projects['maum-vc'], sso: true } } });
    await p.waitForSelector('.one-click button:has-text("배포 보호 끄기")');
    await p.click('.one-click button:has-text("배포 보호 끄기")');
    await toastHas(p, /이제 로그인 없이 열려요/);
    ok('[turn off protection] works through the connector', read().projects['maum-vc'].sso === false);
    // 배포 취소: 실제로 지움
    await p.click('.one-click button:has-text("배포 취소")');
    await p.waitForSelector('dialog[open] button.btn-danger:has-text("배포 취소")');
    await p.screenshot({ path: OUT + '4-undeploy.png' });
    await p.click('dialog[open] button.btn-danger:has-text("배포 취소")');
    await toastHas(p, /배포를 취소했어요/);
    ok('project deleted from my account', !read().projects['maum-vc']);
    // 연결 해제: 이 PC의 Vercel 로그인을 지움
    await p.locator('.publish').scrollIntoViewIfNeeded();
    if (!(await p.locator('.one-click').count())) await pickVercel(p);
    await p.waitForSelector('.one-click .conn-line button:has-text("연결 해제")', { timeout: 10000 });
    await p.click('.one-click .conn-line button:has-text("연결 해제")');
    await toastHas(p, /Vercel 로그인을 지웠어요/);
    ok('disconnect signs this PC out of Vercel', read().loggedIn === false && await p.locator('.one-click button:has-text("Vercel 계정으로 배포")').count() === 1);
    // 실패: 까닭 + 누를 곳 하나([토큰으로 연결]이 접힌 토큰 순서를 엶)
    patch({ loggedIn: true, fail: { deploy: 'Something broke' } });
    await p.fill('.publish .addr-name input', 'maum-vc2');
    await p.click('.one-click button:has-text("Vercel 계정으로 배포")');
    await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => { });
    await p.waitForSelector('.one-click .run-fail', { timeout: 30000 });
    const failText = (await p.locator('.one-click .run-fail').innerText()).replace(/\s+/g, ' ');
    ok('failure shows a reason and one action', /Vercel에서 끝내지 못했어요/.test(failText) && await p.locator('.one-click .run-fail button.btn-primary').count() === 1, failText.slice(0, 160));
    await p.screenshot({ path: OUT + '5-fail.png' });
    await p.click('.one-click .run-fail button:has-text("토큰으로 연결")');
    ok('[connect with a token] opens the token steps', await p.locator('.one-click .run-alt[open] .walk-h').first().isVisible().catch(() => false));
    ok('no script errors', errs.length === 0, JSON.stringify(errs).slice(0, 300));
    await ctx.close();
  } catch (e) { fails++; console.log('FAIL exception :: ' + String(e && e.message || e).slice(0, 400)); }
  await b.close(); await st.close(); fake.close();
  try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* 넘김 */ }
  console.log(`\n${passes} pass, ${fails} fail`);
  process.exit(fails ? 1 : 0);
})();
