// 참고 디자인(완성 견본·디자인 사전·담기)·랜딩의 사례 자리·도움말: 화면 그림과 넘침·오류
// 디자인 사전: 분류·찾기·크게 보기·담기 → 교재 넣기 화면의 '담은 디자인' → AI에게 주는 글에 들어가는지(가짜 AI로 요청 본문 확인)
const L = require('./lib.js');
(async () => {
  const b = await L.chromium.launch();
  for (const [w, h] of [[1280, 900], [390, 844]]) {
    const sent = []; // 가짜 AI가 받은 만들기 요청 본문
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await L.mockAi(ctx, async (r, u) => { if (/api\.anthropic\.com\/v1\/messages/.test(u) && r.request().method() === 'POST') sent.push(r.request().postData() || ''); return false; });
    const p = await ctx.newPage(); const errs = L.watch(p);
    await p.goto(L.BASE + '#/gallery', { waitUntil: 'load' }); await p.waitForSelector('.refs .ex-card'); await p.waitForSelector('.dd-card'); await p.waitForTimeout(1500);
    L.ok(`${w} gallery: showcase cards`, await p.locator('.refs .ex-card').count() === 3 && /참고 디자인/.test(await p.locator('h1').innerText()));
    const all = await p.locator('.dd-card').count();
    L.ok(`${w} dict: 100+ items`, all >= 100, String(all));
    L.ok(`${w} gallery: no apply-to-made-project`, await p.locator('button:has-text("만든 연수에 적용")').count() === 0);
    L.ok(`${w} gallery: no overflow`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    // 분류
    await p.click('.dd-cats button:has-text("움직임")');
    const motion = await p.locator('.dd-card').count();
    const label = await p.locator('.dd-cats button[aria-pressed="true"] span').innerText();
    L.ok(`${w} dict: category filter`, motion > 10 && motion < all && String(motion) === label.trim(), `${motion}/${label}`);
    await p.click('.dd-cats button:has-text("전체")');
    // 찾기
    await p.fill('.dd-q', '유리');
    await p.waitForTimeout(200);
    L.ok(`${w} dict: search`, /글래스모피즘/.test(await p.locator('.dd-grid').innerText()) && await p.locator('.dd-card').count() < 8);
    await p.fill('.dd-q', '');
    // 미리보기(화면에 든 것만 iframe)
    await p.locator('#dd-h').scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, 300)); await p.waitForTimeout(1800);
    const frames = await p.locator('.dd-card iframe').count();
    L.ok(`${w} dict: lazy previews`, frames >= 2 && frames < 40, String(frames));
    await p.screenshot({ path: L.OUT + `${w}-gallery-dict.png` });
    // 크게 보기 → 담기
    await p.click('.dd-card >> nth=0 >> .dd-hit');
    await p.waitForSelector('dialog.dd-dlg[open] .dd-stage iframe'); await p.waitForTimeout(1200);
    await p.screenshot({ path: L.OUT + `${w}-gallery-detail.png` });
    await p.click('dialog.dd-dlg[open] .dd-acts .dd-add');
    L.ok(`${w} dict: add from detail`, (await p.locator('.dd-cart-btn .dd-n').innerText()).trim() === '1');
    await p.click('dialog.dd-dlg[open] button:has-text("다음")');
    L.ok(`${w} dict: detail next`, /2\//.test(await p.locator('dialog.dd-dlg[open] .dd-cat').innerText()));
    await p.click('dialog.dd-dlg[open] .dlg-x'); await p.waitForTimeout(300);
    await p.click('.dd-card >> nth=3 >> .dd-add');
    L.ok(`${w} dict: add from card + header count`, (await p.locator('.dd-cart-btn .dd-n').innerText()).trim() === '2' && (await p.locator('.top nav .nav-n').innerText()).trim() === '2');
    // 담은 디자인 → 만들기
    await p.click('.dd-cart-btn'); await p.waitForSelector('dialog.dd-cart[open] li');
    L.ok(`${w} cart: list`, await p.locator('dialog.dd-cart[open] li').count() === 2);
    await p.screenshot({ path: L.OUT + `${w}-gallery-cart.png` });
    await p.click('dialog.dd-cart[open] button:has-text("담은 디자인으로 만들기")');
    await p.waitForSelector('.picks li', { timeout: 15000 });
    L.ok(`${w} start: picks chips`, await p.locator('.picks li').count() === 2 && /담은 디자인 2개/.test(await p.locator('.picks-line').innerText()));
    await p.screenshot({ path: L.OUT + `${w}-start-picks.png` });
    // 완성 견본으로 시작(예전 흐름 그대로)
    await p.goto(L.BASE + '#/gallery', { waitUntil: 'load' }); await p.waitForSelector('.refs .ex-card');
    await p.click('.refs .ex-card >> nth=0 >> button:has-text("이 디자인 참고해 만들기")');
    await p.waitForSelector('.ref-line'); L.ok(`${w} gallery → new project with reference`, /참고 디자인/.test(await p.locator('.ref-line').innerText()) && await p.locator('.picks li').count() === 2);
    if (w === 1280) {
      // 교재를 넣고 가짜 AI로 만들기 → 요청 본문에 담은 디자인
      await L.startWithFile(p);
      await p.waitForSelector('.picks li');
      await L.connectAi(p);
      for (let i = 0; i < 60 && !sent.length; i++) await p.waitForTimeout(500);
      const body = sent.find((x) => /작업 단계: build/.test(x)) || '';
      L.ok(`${w} request: picks in build prompt`, /강사가 고른 디자인 참고/.test(body) && /편집·잡지/.test(body), body ? '' : 'no request');
    }
    await p.goto(L.BASE, { waitUntil: 'load' }); await p.waitForSelector('#ld-ex-h', { timeout: 15000 });
    await p.locator('#ld-ex-h').scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
    L.ok(`${w} landing: 참고 디자인 section`, /참고 디자인/.test(await p.locator('#ld-ex-h').innerText()) && await p.locator('.ld-ex button:has-text("이 디자인 참고해 만들기")').count() === 3);
    await p.screenshot({ path: L.OUT + `${w}-landing-refs.png` });
    await p.goto(L.BASE + '#/help/start', { waitUntil: 'load' }); await p.waitForSelector('.help-prose h1'); await p.waitForTimeout(800);
    L.ok(`${w} help: new flow words`, /AI 선택/.test(await p.locator('.help-prose').innerText()) && !/체험하기|AI 없이|기본 초안/.test(await p.locator('.help-prose').innerText()));
    await p.screenshot({ path: L.OUT + `${w}-help.png`, fullPage: true });
    L.ok(`${w} no page errors`, errs.length === 0, JSON.stringify(errs));
    await ctx.close();
  }
  await b.close(); process.exit(L.summary() ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
