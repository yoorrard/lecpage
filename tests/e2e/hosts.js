// GitHub Pages·Netlify·Cloudflare(ZIP 끌어 놓기)·파일로 받기·참여 기능 연결·설정의 연결 창을 가짜 API로 확인
const { chromium, fs, ROOT, BASE, mockAll, openShare, connect, publish, toastHas, watch } = require('./h3.js');
const OUT = require('path').resolve(__dirname, '../../.out/verify/shots/hosts') + '/'; fs.mkdirSync(OUT, { recursive: true });
const ok = (name, cond, extra = '') => console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`);
// 올릴 곳 목록은 지금 화면에서 [다른 곳에 올리기]를 눌러야 펼쳐짐(예전 화면은 늘 펼쳐 있음)
const pick = async (p, label) => { if (!(await p.locator('.pub-opt').count()) && await p.locator('.pub-mode').count()) await p.click('.pub-mode:has-text("다른 곳에 배포")'); await p.click(`.pub-opt:has-text("${label}")`); };
(async () => {
  const b = await chromium.launch();
  // ── GitHub Pages ──
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }); const st = await mockAll(ctx);
    const p = await ctx.newPage(); const errs = watch(p);
    await openShare(p); await pick(p, 'GitHub Pages');
    console.log('github about:', (await p.locator('.pub-about').innerText()).replace(/\s+/g, ' '));
    await p.click('.publish .walk-b button:has-text("이미 가입했어요")');
    ok('github token link prefilled', /personal-access-tokens\/new\?name=lecpage-deploy.*administration=write&contents=write&pages=write/.test(await p.locator('.publish .walk-b a.btn-primary').getAttribute('href')));
    await connect(p, 'github_pat_WRONG_000000000000');
    await p.waitForFunction(() => /GitHub 토큰이 맞지/.test(document.querySelector('.publish .err')?.textContent || ''), null, { timeout: 10000 }).then(() => ok('github bad token → plain error', true)).catch(async () => ok('github bad token → plain error', false, await p.locator('.publish .err').innerText().catch(() => '')));
    await connect(p, 'github_pat_FAKE_TOKEN_1234567890');
    await p.waitForSelector('.publish .conn-line');
    await p.fill('.publish .addr-name input', 'maum-class');
    await p.locator('.publish').scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + 'github-connected.png' });
    await publish(p);
    await p.waitForSelector('.success .big-url', { timeout: 60000 });
    ok('github published', await p.locator('.success .big-url').innerText() === 'https://teacher.github.io/maum-class/', await p.locator('.toast').innerText().catch(() => ''));
    ok('github repo has site + marker', st.gh.repos['maum-class']?.files?.includes('index.html') && st.gh.repos['maum-class'].files.includes('.lecpage-site') && st.gh.repos['maum-class'].files.includes('.nojekyll'));
    // 다른 곳(Netlify)에 올리면 주소가 바뀌므로 짧은 주소가 지워져야 함
    await p.click('.short button:has-text("짧은 주소 만들기")'); await p.waitForSelector('.short-url');
    await pick(p, 'Netlify');
    console.log('netlify about:', (await p.locator('.pub-about').innerText()).replace(/\s+/g, ' '));
    await connect(p, 'nfp_WRONG_TOKEN_0000000000');
    await p.waitForFunction(() => /Netlify 토큰이 맞지/.test(document.querySelector('.publish .err')?.textContent || ''), null, { timeout: 10000 }).then(() => ok('netlify bad token → plain error', true)).catch(() => ok('netlify bad token → plain error', false));
    await connect(p, 'nfp_FAKE_TOKEN_1234567890');
    await p.waitForSelector('.publish .conn-line');
    await p.fill('.publish .addr-name input', 'maum-nf');
    await publish(p);
    await p.waitForFunction(() => document.querySelector('.success .big-url')?.textContent === 'https://maum-nf.netlify.app/', null, { timeout: 60000 });
    ok('netlify published', true, `calls ${st.nf.calls.filter((c) => /POST/.test(c)).join(',')} zip ${st.nf.zip}B`);
    await p.waitForTimeout(500);
    ok('short link cleared when the site address changed', await p.locator('.short-url').count() === 0 && await p.locator('.short button:has-text("짧은 주소 만들기")').count() === 1);
    // 다시 올리기 → 같은 사이트
    await publish(p); await toastHas(p, /같은 주소/);
    ok('netlify redeploy to same site', st.nf.calls.includes('POST /api/v1/sites/site1/deploys'));
    console.log('errors', errs); await ctx.close();
  }
  // ── Cloudflare(직접)·파일로 받기 ──
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true }); await mockAll(ctx);
    const p = await ctx.newPage(); const errs = watch(p);
    await openShare(p); await pick(p, 'Cloudflare');
    console.log('cloudflare steps:', (await p.locator('.publish .walk-h').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')).join(' / '));
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), (async () => { await p.click('.publish .walk-b button:has-text("사이트 ZIP 다운로드")'); await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => {}); })()]);
    const zsize = fs.statSync(await dl.path()).size; ok('zip downloaded', zsize > 100000, `${dl.suggestedFilename()} ${zsize}B`);
    ok('moved to next step after download', /Cloudflare(에서 올릴| 배포) 화면 열기/.test(await p.locator('.publish .walk li.on .walk-h').innerText()));
    await p.locator('.publish').scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + 'cloudflare-step2.png' });
    await p.click('.publish .walk-h:has-text("주소 적기")');
    await p.fill('.publish .walk-b input', 'https://maum-class.pages.dev');
    await p.click('.publish .walk-b button:has-text("주소 저장")');
    await p.waitForSelector('.success .big-url');
    ok('manual url saved', await p.locator('.success .big-url').innerText() === 'https://maum-class.pages.dev/');
    await pick(p, 'ZIP 다운로드');
    console.log('zip steps:', (await p.locator('.publish .walk-h').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')).join(' / '), '|', (await p.locator('.pub-about').innerText()).replace(/\s+/g, ' '));
    console.log('errors', errs); await ctx.close();
  }
  // ── 참여 기능 연결(세 방법) + 설정의 연결 창: 1440·390 ──
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }); await mockAll(ctx);
    const p = await ctx.newPage(); const errs = watch(p);
    await openShare(p);
    if (w === 390) { ok('no overflow @390 before publish', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))); await p.locator('h2:has-text("어디에 공개할까요?"), .ready-t:has-text("올릴 곳"), .ready-t:has-text("배포할 곳")').first().evaluate((n) => n.scrollIntoView({ block: 'start' })); await p.waitForTimeout(200); await p.screenshot({ path: OUT + '390-where.png' }); await p.click('.publish .walk-b button:has-text("이미 가입했어요")'); await p.locator('.publish .walk').evaluate((n) => n.scrollIntoView({ block: 'start' })); await p.screenshot({ path: OUT + '390-token.png' }); }
    if (await p.locator('#live-setup > summary').count()) await p.click('#live-setup > summary'); // 지금 화면은 체크리스트 첫 줄에 펼쳐 있음
    // 다른 곳에 배포할 때는 배포할 곳 바로 아래 안내가 할 일을 알려 주고 이 줄은 접혀 있음 → [연결]로 펼침
    if (await p.locator('#live-setup .ready-h button:text-is("연결")').count()) await p.click('#live-setup .ready-h button:text-is("연결")');
    for (const m of ['구글 시트', 'Supabase', '내 서버·Cloudflare']) {
      await p.click(`#live-setup .seg button:has-text("${m}")`); await p.waitForTimeout(200);
      const n = await p.locator('#live-setup .walk > li').count();
      for (let i = 0; i < n; i++) { await p.locator('#live-setup .walk-h').nth(i).click(); await p.waitForTimeout(60); }
      ok(`${w} live ${m}: ${n} steps, one open`, await p.locator('#live-setup .walk-b').count() === 1, (await p.locator('#live-setup .walk-h').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')).join(' / '));
      ok(`${w} live ${m}: no overflow`, !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
    }
    await p.click('#live-setup .seg button:has-text("구글 시트")'); await p.waitForTimeout(150);
    await p.locator('#live-setup').evaluate((n) => n.scrollIntoView({ block: 'start' })); await p.waitForTimeout(200); await p.screenshot({ path: OUT + `${w}-live-sheets.png` });
    // 잘못된 주소 → 쉬운 말
    await p.locator('#live-setup .walk-h').last().click();
    await p.fill('#live-setup .walk-b input[type=url]', 'https://example.com/x'); await p.click('#live-setup .walk-b button:has-text("연결 확인")');
    await p.waitForSelector('#live-setup .notice.bad', { timeout: 15000 });
    ok(`${w} live bad url → plain message`, /script\.google\.com/.test(await p.locator('#live-setup .notice.bad').innerText()));
    // 설정 → 연결 창
    await p.goto(BASE + '#/settings'); await p.waitForTimeout(500);
    await p.click('.set-more:not([open]) > summary').catch(() => {}); await p.click('.list-rows li:has-text("GitHub Pages") button:text-is("연결")'); await p.waitForSelector('dialog[open] .walk');
    await p.click('dialog[open] .walk-b button:has-text("이미 가입했어요")'); await p.waitForTimeout(150);
    await p.screenshot({ path: OUT + `${w}-settings-connect.png` });
    await connect(p, 'github_pat_FAKE_TOKEN_1234567890', 'dialog[open]');
    await p.waitForFunction(() => [...document.querySelectorAll('.list-rows li')].some((li) => /GitHub Pages/.test(li.textContent) && /연결됨/.test(li.textContent)), null, { timeout: 10000 }).then(() => ok(`${w} settings connect`, true)).catch(() => ok(`${w} settings connect`, false));
    // 창은 '연결됨'을 그린 뒤 다음 틈에 닫힘(Dialog의 useEffect) → 잠깐 기다려 봄
    ok(`${w} settings dialog closed`, await p.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 3000 }).then(() => true, () => false));
    console.log(w, 'errors', errs); await ctx.close();
  }
  await b.close();
})().catch((e) => { console.log('SCRIPT ERROR', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
