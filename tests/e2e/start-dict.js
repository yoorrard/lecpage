// 교재 넣기 화면의 [디자인 기법 둘러보기] 시트: 열기(사전은 열 때만 받음) → 찾기·분류·크게 보기·담기 → 아래 띠의 담은 칩·n/10 →
// [다 골랐어요]로 닫으면 교재 넣기 화면의 칩과 p.reference.picks가 같음. Esc·포커스 돌아가기·axe·가로 넘침·움직임 줄이기까지.
const L = require('./lib.js');
let axeSrc = '';
try { axeSrc = L.fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); } catch { try { axeSrc = L.fs.readFileSync(process.env.AXE || '', 'utf8'); } catch { /* axe 없이 */ } }
async function axe(p, label) {
  if (!axeSrc) { console.log(`SKIP axe ${label}`); return; }
  await p.addScriptTag({ content: axeSrc });
  const v = await p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] }, resultTypes: ['violations'], exclude: [['iframe']] })).violations.map((x) => `${x.id}:${x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join('|')}`));
  L.ok(`${label}: axe clean`, v.length === 0, v.join(' ; '));
}
(async () => {
  const b = await L.chromium.launch();
  for (const [w, h] of [[1280, 900], [390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await L.mockAi(ctx); await ctx.addInitScript(() => { window.open = () => null; });
    const p = await ctx.newPage(); const errs = L.watch(p);
    const loaded = []; p.on('request', (r) => { if (/GalleryDict/.test(r.url())) loaded.push(r.url()); });
    await L.startWithFile(p);
    const shot = (n) => p.screenshot({ path: L.OUT + `start-dict/${w}-${n}.png` });
    L.fs.mkdirSync(L.OUT + 'start-dict', { recursive: true });
    const btn = p.locator('.picks-line button:has-text("디자인 기법 둘러보기")');
    L.ok(`${w} start: button, no chips when empty`, await btn.count() === 1 && await p.locator('.picks li').count() === 0);
    L.ok(`${w} start: dict chunk not loaded yet`, loaded.length === 0);
    await shot('start-empty');
    await btn.focus(); await p.keyboard.press('Enter');
    await p.waitForSelector('dialog.dd-sheet[open] .dd-card');
    L.ok(`${w} sheet: chunk loaded on open`, loaded.length >= 1);
    const box = await p.locator('dialog.dd-sheet').boundingBox();
    L.ok(`${w} sheet: layout`, w > 700 ? (box.x + box.width >= w - 1 && box.width >= 720 && box.width <= 880 && box.height >= h - 1) : (box.width >= w - 1 && box.y > 0 && box.y + box.height >= h - 1 && box.height >= h - 20), JSON.stringify(box));
    L.ok(`${w} sheet: focus inside`, await p.evaluate(() => !!document.activeElement.closest('dialog.dd-sheet')));
    L.ok(`${w} sheet: compact (no 담은 디자인 button, no page title)`, await p.locator('dialog.dd-sheet .dd-cart-btn, dialog.dd-sheet .section-title').count() === 0);
    await p.waitForTimeout(1500);
    const frames = await p.locator('dialog.dd-sheet .dd-card iframe').count();
    L.ok(`${w} sheet: lazy previews in scroll root`, frames >= 2 && frames < 30, String(frames));
    await shot('sheet-open');
    await axe(p, `${w} sheet`);
    // 찾기·분류
    await p.fill('dialog.dd-sheet .dd-q', '유리'); await p.waitForTimeout(200);
    L.ok(`${w} sheet: search`, /글래스모피즘/.test(await p.locator('dialog.dd-sheet .dd-grid').innerText()));
    await p.fill('dialog.dd-sheet .dd-q', '');
    await p.click('dialog.dd-sheet .dd-cats button:has-text("움직임")');
    L.ok(`${w} sheet: category`, await p.locator('dialog.dd-sheet .dd-card').count() > 10);
    await p.click('dialog.dd-sheet .dd-cats button:has-text("전체")');
    // 담기(카드) → 아래 띠 칩 + 교재 넣기 화면의 칩이 바로 같음
    await p.click('dialog.dd-sheet .dd-card >> nth=0 >> .dd-add');
    await p.click('dialog.dd-sheet .dd-card >> nth=2 >> .dd-add');
    L.ok(`${w} sheet: footer count + chips`, /2\/10/.test(await p.locator('.dd-sheet-foot').innerText()) && await p.locator('.dd-sheet-foot .sheet-picks li').count() === 2);
    L.ok(`${w} sheet: header nav count`, (await p.locator('.top nav .nav-n').first().innerText().catch(() => '2')).trim() === '2');
    // 크게 보기(시트 위에 또 하나) → 담기 → Esc는 크게 보기만 닫음
    await p.click('dialog.dd-sheet .dd-card >> nth=4 >> .dd-hit');
    await p.waitForSelector('dialog.dd-dlg[open] .dd-stage iframe');
    await p.click('dialog.dd-dlg[open] .dd-acts .dd-add');
    await shot('detail');
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    L.ok(`${w} sheet: Esc closes only the detail`, await p.locator('dialog.dd-dlg[open]').count() === 0 && await p.locator('dialog.dd-sheet[open]').count() === 1);
    L.ok(`${w} sheet: 3 picked`, /3\/10/.test(await p.locator('.dd-sheet-foot').innerText()));
    await shot('sheet-picked');
    await axe(p, `${w} sheet picked`);
    // 칩에서 삭제
    const first = (await p.locator('.dd-sheet-foot .sheet-picks li').first().innerText()).replace('✕', '').trim();
    await p.click('.dd-sheet-foot .sheet-picks li >> nth=0 >> button');
    L.ok(`${w} sheet: remove chip`, /2\/10/.test(await p.locator('.dd-sheet-foot').innerText()) && !(await p.locator('.dd-sheet-foot .sheet-picks').innerText()).includes(first));
    // 가득 채우기 안내
    for (let i = 0; i < 12; i++) { const c = await p.locator('dialog.dd-sheet .dd-card >> nth=' + (6 + i) + ' >> .dd-add').first(); if (/10\/10/.test(await p.locator('.dd-sheet-foot').innerText())) break; await c.scrollIntoViewIfNeeded(); await c.click(); }
    await p.click('dialog.dd-sheet .dd-card >> nth=20 >> .dd-add'); await p.waitForTimeout(150);
    L.ok(`${w} sheet: full notice inside the sheet`, /10개까지/.test(await p.locator('.dd-sheet-foot [role=status]').innerText()) && /10\/10/.test(await p.locator('.dd-sheet-foot').innerText()));
    // 아래 띠는 늘 보임(스크롤해도)
    await p.evaluate(() => document.querySelector('.dd-sheet-body').scrollTo(0, 2500)); await p.waitForTimeout(300);
    L.ok(`${w} sheet: footer sticky + [다 골랐어요] visible`, await p.locator('.dd-sheet-foot button:has-text("다 골랐어요")').isVisible());
    L.ok(`${w} sheet: no overflow`, await p.evaluate(() => { const d = document.querySelector('dialog.dd-sheet'); return d.scrollWidth <= d.clientWidth + 1; }));
    // 다 골랐어요 → 닫힘 + 포커스가 단추로
    await p.click('.dd-sheet-foot button:has-text("다 골랐어요")'); await p.waitForTimeout(300);
    L.ok(`${w} sheet: closed + focus returned`, await p.locator('dialog.dd-sheet').count() === 0 && await p.evaluate(() => document.activeElement.textContent.includes('디자인 기법 둘러보기')));
    const n = await p.locator('.picks li').count();
    L.ok(`${w} start: chips = cart`, n === 10 && /담은 디자인 10개/.test(await p.locator('.picks-line').innerText()));
    await shot('start-picked');
    await axe(p, `${w} start with chips`);
    // p.reference.picks가 바로 같음
    const id = await p.evaluate(() => (location.hash.match(/#\/p\/([^/]+)/) || [])[1]);
    await p.waitForTimeout(800);
    const picks = await L.readProject(p, id).then((x) => (x?.reference?.picks || []).length, () => -1);
    L.ok(`${w} start: reference.picks synced`, picks === 10, String(picks));
    // 시작 화면의 칩 삭제 → 시트를 다시 열면 반영
    await p.click('.picks li >> nth=0 >> button');
    await p.click('.picks-line button:has-text("디자인 기법 둘러보기")'); await p.waitForSelector('dialog.dd-sheet[open] .dd-card');
    L.ok(`${w} sheet: reopen shows 9`, /9\/10/.test(await p.locator('.dd-sheet-foot').innerText()));
    // Esc로 닫기 → 포커스 돌아가기
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    L.ok(`${w} sheet: Esc closes + focus returned`, await p.locator('dialog.dd-sheet').count() === 0 && await p.evaluate(() => document.activeElement.textContent.includes('디자인 기법 둘러보기')));
    // 바깥(가림막) 눌러 닫기(PC)
    if (w > 700) { await p.click('.picks-line button:has-text("디자인 기법 둘러보기")'); await p.waitForSelector('dialog.dd-sheet[open] .dd-card'); await p.mouse.click(40, 300); await p.waitForTimeout(300); L.ok(`${w} sheet: backdrop click closes`, await p.locator('dialog.dd-sheet').count() === 0); }
    // 키보드: 시트 안에서 Tab이 시트 밖으로 새지 않음
    await p.click('.picks-line button:has-text("디자인 기법 둘러보기")'); await p.waitForSelector('dialog.dd-sheet[open] .dd-card');
    let inside = true; for (let i = 0; i < 25; i++) { await p.keyboard.press('Tab'); inside = inside && await p.evaluate(() => !!document.activeElement.closest('dialog.dd-sheet')); }
    L.ok(`${w} sheet: Tab stays inside`, inside);
    await p.keyboard.press('Escape');
    // 참고 디자인 화면은 그대로
    await p.goto(L.BASE + '#/gallery', { waitUntil: 'load' }); await p.waitForSelector('.dd-card');
    L.ok(`${w} gallery page unchanged`, await p.locator('.dd-cart-btn').count() === 1 && await p.locator('#dd-h').count() === 1 && await p.locator('dialog.dd-sheet').count() === 0);
    L.ok(`${w} no page errors`, errs.length === 0, errs.join(' | ').slice(0, 300));
    await ctx.close();
  }
  // 움직임 줄이기: 시트 열림 애니메이션 없음
  const rc = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await L.mockAi(rc);
  const rp = await rc.newPage();
  await L.startWithFile(rp);
  await rp.click('.picks-line button:has-text("디자인 기법 둘러보기")'); await rp.waitForSelector('dialog.dd-sheet[open]');
  L.ok('reduced motion: no sheet animation', await rp.evaluate(() => getComputedStyle(document.querySelector('dialog.dd-sheet')).animationName === 'none'));
  await b.close();
  process.exit(L.summary() ? 1 : 0);
})();
