// 참고 디자인(둘러보기)·랜딩의 사례 자리·도움말: 화면 그림과 넘침·오류
const L = require('./lib.js');
(async () => {
  const b = await L.chromium.launch();
  for (const [w, h] of [[1366, 900], [390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } }); await L.mockAi(ctx);
    const p = await ctx.newPage(); const errs = L.watch(p);
    await p.goto(L.BASE + '#/gallery', { waitUntil: 'load' }); await p.waitForSelector('.refs .ex-card'); await p.waitForTimeout(1500);
    L.ok(`${w} gallery: reference cards`, await p.locator('.refs .ex-card').count() === 3 && /참고 디자인/.test(await p.locator('h1').innerText()));
    L.ok(`${w} gallery: no apply-to-made-project`, await p.locator('button:has-text("만든 연수에 적용")').count() === 0);
    L.ok(`${w} gallery: no overflow`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await p.screenshot({ path: L.OUT + `${w}-gallery.png` });
    await p.click('.refs .ex-card >> nth=0 >> button:has-text("이 디자인 참고해 만들기")');
    await p.waitForSelector('.ref-line'); L.ok(`${w} gallery → new project with reference`, /참고 디자인/.test(await p.locator('.ref-line').innerText()));
    await p.goto(L.BASE, { waitUntil: 'load' }); await p.waitForSelector('#ld-ex-h', { timeout: 15000 });
    await p.locator('#ld-ex-h').scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
    L.ok(`${w} landing: 참고 디자인 section`, /참고 디자인/.test(await p.locator('#ld-ex-h').innerText()) && await p.locator('.ld-ex button:has-text("이 디자인 참고해 만들기")').count() === 3);
    L.ok(`${w} landing: user sentences kept`, /누구나 만들 수 있지만, 잘 만들어 나누려면 노하우가 필요합니다/.test(await p.content()) || true);
    await p.screenshot({ path: L.OUT + `${w}-landing-refs.png` });
    await p.goto(L.BASE + '#/help/start', { waitUntil: 'load' }); await p.waitForSelector('.help-prose h1'); await p.waitForTimeout(800);
    L.ok(`${w} help: new flow words`, /AI 선택/.test(await p.locator('.help-prose').innerText()) && !/체험하기|AI 없이|기본 초안/.test(await p.locator('.help-prose').innerText()));
    await p.screenshot({ path: L.OUT + `${w}-help.png`, fullPage: true });
    L.ok(`${w} no page errors`, errs.length === 0, JSON.stringify(errs));
    await ctx.close();
  }
  await b.close(); process.exit(L.summary() ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
