// 배포 흐름(flow2): 교재 원본 다운로드 선택 → 바로 배포 → 다른 곳(가짜 Vercel)에도 배포 → 대표 주소 바꾸기 → QR·강사 화면 링크가 따라감.
// 앱은 VITE_PUBLISH_API=https://publish.mock.test 로 빌드한 것(BASE2). 가짜 Vercel·is.gd는 h2.js(mockAll)
const L = require('./lib.js');
const H = require('./h2.js');
const OUT = process.env.SHOTS || L.OUT;
const BASE = process.env.BASE2 || 'http://localhost:6302/';
const ANSWER = '```html\n<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>교재 흐름 시험</title></head><body><main><section id="a" data-title="첫 화면"><h1>교재 흐름 시험</h1><div data-lp="qa"></div></section></main></body></html>\n```';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
async function instantServer(ctx) {
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, async (r) => {
    const u = new URL(r.request().url()); const m = r.request().method();
    if (u.host !== 'publish.mock.test') return r.fallback();
    const json = (o, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(o) });
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    if (u.pathname === '/api/info') return json({ ok: true, v: 1, plan: 'free', accepting: true, view: 'pages', keepAlive: true, siteScripts: true, limits: { maxBytes: 30e6, maxFileBytes: 10e6, maxFiles: 400, days: 60 } });
    if (u.pathname === '/api/sites' && m === 'POST') return json({ id: 'site1', key: 'k1', url: 'https://s-site1.example.pages.dev/', expiresAt: Date.now() + 60 * 864e5 });
    if (/\/deploys$/.test(u.pathname)) return json({ deploy: 'd1', missing: [] });
    if (/\/publish$/.test(u.pathname)) return json({ url: 'https://s-site1.example.pages.dev/', expiresAt: Date.now() + 60 * 864e5 });
    return json({}, 404);
  });
}
async function shot(p, name, sel) { try { if (sel) await p.locator(sel).first().scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + name + '.png' }); } catch (e) { console.log('shot fail', name, e.message); } }
async function run(b, width) {
  const tag = String(width);
  const ctx = await b.newContext({ viewport: { width, height: width < 600 ? 844 : 900 } });
  await H.mockAll(ctx); await instantServer(ctx);
  const p = await ctx.newPage(); const errs = L.watch(p);
  await p.goto(BASE, { waitUntil: 'load' });
  await p.setInputFiles('.ld-hero input[type=file][multiple]', [L.FIX + '/workshop.pdf']);
  await p.waitForSelector('.ai-nokey .btn:not([disabled])', { timeout: 90000 });
  L.ok(`[${tag}] original-download option`, await p.locator('text=교재 원본도 참가자가 내려받게').count() === 1);
  await p.click('.ai-nokey button:has-text("쓰던 ChatGPT로")');
  await p.fill('#chat-way textarea', ANSWER); await p.click('#chat-way button:has-text("이 답으로 만들기")');
  await p.waitForSelector('.st-info button:has-text("이 정보가 맞아요")', { timeout: 30000 }); await p.click('.st-info button:has-text("이 정보가 맞아요")');
  await p.click('.head-tools button:has-text("배포하기")'); await p.waitForSelector('.publish', { timeout: 30000 }); await p.waitForTimeout(1500);
  // 3) 바로 배포: 큰 단추 두 개(바로 배포 · 다른 곳에 배포)
  L.ok(`[${tag}] two mode buttons`, await p.locator('.pub-mode').count() === 2 && /바로 배포/.test(await p.locator('.pub-mode').first().innerText()) && /다른 곳에 배포/.test(await p.locator('.pub-mode').nth(1).innerText()));
  await shot(p, `r100-publish-modes-${tag}`, '.pub-modes');
  await H.publish(p);
  await p.waitForSelector('.success .big-url', { timeout: 60000 });
  L.ok(`[${tag}] instant address`, /s-site1\.example\.pages\.dev/.test(await p.locator('.success .big-url').innerText()));
  L.ok(`[${tag}] sites list shows 바로 배포 as 대표`, /바로 배포[\s\S]*대표 주소/.test(await p.locator('.sites').innerText()));
  await shot(p, `r100-success-${tag}`, '.sites');
  // 4) 다른 곳(Vercel)에도 배포
  await p.click('.sites button:has-text("다른 곳에도 배포")');
  await p.waitForTimeout(500);
  await p.click('.pub-opt:has-text("Vercel")');
  await p.click('.publish .walk-b button:has-text("이미 가입했어요")').catch(() => {});
  await p.evaluate(() => navigator.clipboard?.writeText?.('vcp_FAKE_TOKEN_1234567890').catch(() => { }));
  await H.connect(p, 'vcp_FAKE_TOKEN_1234567890');
  await p.waitForSelector('.publish .conn-line', { timeout: 15000 });
  await p.fill('.publish .addr-name input', 'maum-class').catch(() => {});
  await shot(p, `r100-publish-other-${tag}`, '.publish');
  await H.publish(p);
  await p.waitForFunction(() => /maum-class\.vercel\.app/.test(document.querySelector('.success .big-url')?.textContent || ''), null, { timeout: 60000 });
  L.ok(`[${tag}] two sites remembered, Vercel is 대표`, await p.locator('.sites li').count() === 2 && /Vercel[\s\S]*대표 주소/.test(await p.locator('.sites li.is-main').innerText()));
  // 5) 대표 주소를 바로 배포로 되돌림 → 주소·QR·강사 화면 링크가 따라감
  await p.click('.sites li:has-text("바로 배포") button:has-text("대표 주소로 쓰기")');
  await p.waitForFunction(() => /s-site1\.example\.pages\.dev/.test(document.querySelector('.success .big-url')?.textContent || ''), null, { timeout: 10000 });
  const hrefs = await p.$$eval('.success a[href$="screen.html"], .success a[href$="poster.html"]', (a) => a.map((x) => x.href));
  L.ok(`[${tag}] instructor screen·poster links follow 대표`, hrefs.length >= 2 && hrefs.every((h) => h.startsWith('https://s-site1.example.pages.dev/')), hrefs.join(','));
  L.ok(`[${tag}] 대표 switched back to 바로 배포`, /바로 배포[\s\S]*대표 주소/.test(await p.locator('.sites li.is-main').innerText()));
  const rec = await p.evaluate(() => new Promise((res) => { const q = indexedDB.databases ? indexedDB.databases() : Promise.resolve([]); q.then(() => res(null)); }));
  void rec;
  await shot(p, `r100-success-switched-${tag}`, '.sites');
  L.ok(`[${tag}] no page errors`, errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}
(async () => {
  const b = await L.chromium.launch();
  for (const w of [1280, 390]) await run(b, w);
  await b.close();
  process.exit(L.summary() ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
