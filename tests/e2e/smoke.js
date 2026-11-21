const L = require('./lib.js');
(async () => {
  const b = await L.chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1366, height: 860 } });
  await L.mockAi(ctx);
  const p = await ctx.newPage(); const errs = L.watch(p);
  await L.startWithFile(p);
  await p.screenshot({ path: L.OUT + 'smoke-01-start.png', fullPage: true });
  L.ok('no preview before AI', await p.locator('.preview, .sec2-list').count() === 0);
  await L.connectGemini(p);
  await p.waitForTimeout(3000); await p.screenshot({ path: L.OUT + 'smoke-01b.png' }); console.log('errs so far', errs, await p.locator('dialog[open]').innerText().catch(() => 'no dialog'));
  await p.waitForSelector('.making', { timeout: 20000 });
  await p.screenshot({ path: L.OUT + 'smoke-02-making.png', fullPage: true });
  L.ok('no preview while making', await p.locator('.preview, .sec2-list').count() === 0);
  await L.waitStudio(p);
  await p.screenshot({ path: L.OUT + 'smoke-03-studio.png' });
  console.log('errors', errs);
  await b.close();
  process.exit(L.summary());
})().catch((e) => { console.error(e); process.exit(1); });
