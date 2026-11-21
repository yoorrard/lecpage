// 새 흐름 접근성: axe(WCAG 2.1 AA)로 교재 넣기·만드는 중·완성 화면 탭마다·배포 화면을 밝게/어둡게, PC/휴대폰에서. 가로 넘침도.
// + 키보드: Tab으로 AI 카드 단추에 닿고 초점이 보이는지, 목록의 ↑↓가 키보드로 되는지
const L = require('./lib.js');
const axeSrc = L.fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
let total = 0;
async function check(p, label) {
  await p.addScriptTag({ content: axeSrc });
  const r = await p.evaluate(async () => {
    const res = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] }, resultTypes: ['violations'], exclude: [['iframe']] });
    return { v: res.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes.slice(0, 2).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n')[1]) })), over: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  total += r.v.length + (r.over ? 1 : 0);
  console.log(`${label}: ${r.v.length}${r.over ? ' OVERFLOW' : ''}`); for (const v of r.v) console.log('  -', v.id, v.impact, v.n, JSON.stringify(v.ex).slice(0, 400));
}
(async () => {
  const b = await L.chromium.launch();
  for (const scheme of ['light', 'dark']) for (const [w, h] of [[1366, 900], [390, 844]]) {
    const tag = `[${scheme} ${w}]`;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1 });
    await L.mockAi(ctx); await ctx.addInitScript(() => { window.open = () => null; });
    const p = await ctx.newPage(); const errs = L.watch(p);
    process.env.SPEED = '0.6';
    await L.startWithFile(p);
    await check(p, `${tag} start`);
    await p.click('details.ai-more:not([open]) > summary').catch(() => {}); await p.click('.ai-card:has(h3:text-is("Claude")) button:has-text("API 키 연결")');
    await p.waitForSelector('dialog[open] .consent'); await check(p, `${tag} consent dialog`); await L.consent(p);
    await p.waitForSelector('dialog[open] .ai-connect');
    await check(p, `${tag} key dialog`);
    await p.click('dialog[open] .key-dots li:last-child button');
    await p.fill('dialog[open] input[type=password]', 'AIzaSyFAKEKEY_1234567890abcdefghijklmnopq');
    await p.click('dialog[open] .key-now button:has-text("연결")');
    await p.waitForSelector('.making'); await p.click('.making button:has-text("중지")'); await p.waitForSelector('.making button:has-text("계속 만들기")');
    await check(p, `${tag} making (paused)`);
    await p.click('.making button:has-text("계속 만들기")');
    await L.waitStudio(p);
    await p.waitForTimeout(1800); await check(p, `${tag} studio`);
    await p.click('.st-info [data-k="when-0"] .prop-v'); await p.waitForTimeout(300); await check(p, `${tag} studio info when`); await p.keyboard.press('Escape');
    if (w > 900) { await p.click('.sec2 >> nth=4 >> .sec2-tw'); await p.click('.sec2 >> nth=4 >> .kit-row >> nth=0'); await p.waitForTimeout(300); await check(p, `${tag} studio outline + item form`); await p.keyboard.press('Escape'); await p.click('.sec2 >> nth=4 >> .sec2-tw'); }
    else { await p.click('.st-switch button:has-text("미리보기")'); await p.waitForTimeout(800); await check(p, `${tag} studio preview`); await p.click('.st-switch button:has-text("수정")'); }
    if (w > 900 && scheme === 'light') {
      // 키보드: 목록의 ↑↓
      const before = await p.locator('.sec2-name .ttl').allInnerTexts();
      await p.focus('.sec2 >> nth=1 >> button[aria-label$="아래로"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
      const after = await p.locator('.sec2-name .ttl').allInnerTexts();
      L.ok('keyboard: move section with Enter', after[2] === before[1], after.join(','));
      const f = await p.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.className);
      L.ok('keyboard: focus follows moved item', /아래로|sec2-name/.test(f || ''), f);
    }
    await p.click('.head-tools button:has-text("배포하기")'); await p.waitForSelector('.publish, .ready');
    await p.waitForTimeout(500); await check(p, `${tag} share`);
    if (errs.length) { console.log('errors', errs); total++; }
    await ctx.close();
  }
  // 키보드: 첫 화면에서 Tab으로 AI 카드 단추까지, 초점 테두리
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }); await L.mockAi(ctx);
  const p = await ctx.newPage(); await L.startWithFile(p);
  await p.focus('.start-files input.input');
  let hit = ''; for (let i = 0; i < 6 && !hit; i++) { await p.keyboard.press('Tab'); hit = await p.evaluate(() => (document.activeElement?.closest('.ai-sub') ? document.activeElement.textContent : '')); }
  const ring = await p.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2 ? 'outline' : s.boxShadow !== 'none' ? 'shadow' : ''; });
  L.ok('keyboard: Tab reaches AI card buttons with visible focus', !!hit && !!ring, `${hit} / ${ring}`);
  await b.close();
  console.log('\naxe violations total:', total);
  process.exit(total || L.summary() ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
