// 'Made with Lecpage' 표시: 엔진 조립이 참가자 쪽에만 넣고(AI 요청문과 상관없이), 런타임이 보이고·닫고·자리를 잡음.
// 만든 파일만 보는 시험 + 실제 브라우저(왼쪽 아래에 떠서 따라다님·사이트의 누를 것 위에서 비켜 줌·아래 고정 단추와 '지금' 띠 비키기·휴대폰·낮은 화면의 맨 끝 한 줄·닫기·인쇄).
// 덤: 참여 기능 서버에 닿지 않을 때의 안내가 한 곳에만 붙는지(같은 키트 부품 묶음을 쓰는 참가자 화면)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { writeFiles } from '../node.js';
import { kitBuild, refSite } from './kit-site.mjs';

const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require('playwright')); } catch { try { ({ chromium } = createRequire('/opt/node-tools/')('playwright')); } catch { /* 없음 */ } }
const skip = !chromium && 'playwright is not installed';

const MADE = /<div class="lpk-made" data-lp-made hidden>[\s\S]*?<\/div>/;

test('조립: 참가자 쪽에만 한 번(키트 부품 묶음 맨 앞), 강사·발표 화면·QR 안내문·접속 확인·개인정보 안내에는 없음', () => {
  const r = kitBuild();
  const html = r.files['index.html'];
  assert.equal((html.match(/data-lp-made[\s>]/g) || []).length, 1);
  assert.match(html, /<div class="lpk lpk-chrome">\n<div class="lpk-made" data-lp-made hidden>/);
  const m = MADE.exec(html)[0];
  assert.match(m, /href="https:\/\/lecpage\.com\/" target="_blank" rel="noopener noreferrer"/);
  assert.match(m, /<span lang="en">Made with Lecpage<\/span>/);
  assert.match(m, /data-lp-made-close aria-label="Made with Lecpage 표시 닫기"/);
  assert.match(m, /<svg class="lpk-made-logo"[^>]*aria-hidden="true"/);
  for (const p of ['console.html', 'screen.html', 'poster.html', 'check.html', 'privacy.html']) if (r.files[p]) assert.doesNotMatch(r.files[p], /data-lp-made|Made with Lecpage/, p);
  assert.match(r.files['assets/kit.css'], /\.lpk\.lpk-chrome \.lpk-made\{position:fixed/);
  assert.match(r.files['assets/kit.css'], /@media print\{\.lpk\.lpk-chrome,\.lpk\.lpk-now\{display:none!important\}\}/, '인쇄에는 키트 부품 묶음째 빠짐');
});

test('조립: 참여 기능 없이 배포해도·미리보기에도·AI가 쓴 쪽이 여럿이어도 쪽마다 붙음', () => {
  const site = refSite();
  site['more.html'] = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>더 보기</title></head><body><main><h1>더 보기</h1></main></body></html>';
  for (const opts of [{ site }, { site, preview: true }, { site, prev: { live: { provider: 'none' } } }]) {
    const r = kitBuild(opts);
    for (const p of ['index.html', 'more.html']) assert.equal((r.files[p].match(/data-lp-made[\s>]/g) || []).length, 1, `${p} ${JSON.stringify(Object.keys(opts))}`);
  }
});

let browser, srv, dir, base;
before(async () => {
  if (skip) return;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-made-'));
  writeFiles(dir, kitBuild().files);
  // 사이트가 직접 만든 아래 고정 단추(전체 너비 막대)가 있는 판
  const site = refSite();
  site['index.html'] = site['index.html'].replace('</body>', '<div class="cta-bar"><a href="#top">맨 위로</a></div>\n</body>');
  site['assets/style.css'] = (site['assets/style.css'] || '') + '\n.cta-bar{position:fixed;left:0;right:0;bottom:0;height:72px;background:#222;color:#fff;display:flex;align-items:center;justify-content:center;z-index:50}\n';
  writeFiles(path.join(dir, 'bar'), kitBuild({ site }).files);
  // 자리 시험용 판(긴 글 사이에 왼쪽 끝 링크 하나)
  writeFiles(path.join(dir, 'calm'), kitBuild({ site: calmSite() }).files);
  // 참여 기능 서버에 닿지 않는 판(닫힌 포트)
  writeFiles(path.join(dir, 'down'), kitBuild({ prev: { live: { provider: 'http', url: 'http://127.0.0.1:9', code: 'DOWNTEST' } } }).files);
  const MIME = { html: 'text/html; charset=utf-8', css: 'text/css', js: 'text/javascript', svg: 'image/svg+xml', webp: 'image/webp', png: 'image/png', json: 'application/json' };
  srv = http.createServer((q, s) => {
    let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(dir, p);
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); s.end(); return; }
    s.writeHead(200, { 'content-type': MIME[f.split('.').pop()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s);
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${srv.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); srv?.close(); if (dir) fs.rmSync(dir, { recursive: true, force: true }); });

async function open(url, { width = 1280, height = 800, ...o } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, ...o });
  await ctx.route('https://lecpage.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>lecpage</title>' }));
  const page = await ctx.newPage(); page._errs = []; page.on('pageerror', (e) => page._errs.push(String(e)));
  await page.goto(url); await page.waitForSelector('[data-lp-made]:not([hidden])');
  await page.waitForTimeout(500); // 글꼴·자리 잡기
  return { ctx, page };
}
const rect = (page, sel) => page.evaluate((s) => { const n = document.querySelector(s); if (!n) return null; const r = n.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; }, sel);
const overlap = (a, b) => !!(a && b && b.width && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom);

const state = (page) => page.$eval('[data-lp-made]', (n) => { const cs = getComputedStyle(n); return { pos: cs.position, flow: n.classList.contains('is-flow'), yields: n.classList.contains('is-yield'), shown: +cs.opacity > 0.9 && cs.pointerEvents !== 'none' }; });
// 표시 한가운데를 눌렀을 때 표시가 받는지(다른 것 밑에 깔리지 않았는지)
const madeHit = (page) => page.evaluate(() => { const m = document.querySelector('[data-lp-made]'), a = m.querySelector('a'), r = a.getBoundingClientRect(), h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!h && m.contains(h); });
const down = async (page, y) => { await page.evaluate((v) => window.scrollTo(0, v === -1 ? document.documentElement.scrollHeight : v), y); await page.waitForTimeout(900); };
// 자리 시험용 사이트: 긴 글(누를 것 없음) 사이에 왼쪽 끝 링크 하나, 맨 끝에 참여 칸(참여 막대가 뜸)
function calmSite(extra = '', html = '') { return { 'index.html': `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>표시 자리 시험</title><style>body{margin:0;background:#fafafa;color:#111;font:16px/1.6 sans-serif}main{padding:16px}.tall{height:1600px;margin:0}.cta{display:block;width:260px;height:64px;background:#222;color:#fff}${extra}</style></head><body><main><h1>표시 자리 시험</h1><p class="tall">글만 있는 곳.</p><a class="cta" id="under" href="#went">왼쪽 아래를 지나는 링크</a><p class="tall" id="went">글만 있는 곳.</p><div data-lp="now"></div><p class="tall">글만 있는 곳.</p><div data-lp="qa"></div></main>${html}</body></html>` }; }

test('넓은 화면: 왼쪽 아래 구석에 떠서 스크롤을 따라다님(참여 막대와 같은 줄·겹치지 않음), 맨 끝 글을 덮지 않음, 누르면 lecpage.com이 새 탭으로, 키보드로 닿음', { skip }, async () => {
  const { ctx, page } = await open(base + '/calm/');
  try {
    // 첫 화면부터 보임(그 자리에 사이트의 누를 것이 없음)
    const s0 = await state(page);
    assert.deepEqual([s0.pos, s0.flow, s0.yields, s0.shown], ['fixed', false, false, true], JSON.stringify(s0));
    const m1 = await rect(page, '[data-lp-made]'), dock = await rect(page, '[data-dock]');
    assert.ok(Math.abs(m1.left - 12) < 1 && Math.abs(m1.bottom - (800 - 12)) < 1, '왼쪽 아래 구석(12px) ' + JSON.stringify(m1));
    assert.ok(dock.width > 0 && Math.abs(m1.bottom - dock.bottom) < 1 && !overlap(m1, dock) && dock.left > m1.right, '참여 막대와 같은 줄, 반대쪽 구석 ' + JSON.stringify({ m1, dock }));
    assert.ok(m1.height <= 32 && m1.width < 220, JSON.stringify(m1));
    // 스크롤을 따라다님: 문서를 내려도 화면의 같은 자리
    await down(page, 700);
    const m2 = await rect(page, '[data-lp-made]');
    assert.ok(Math.abs(m1.top - m2.top) < 1 && Math.abs(m1.left - m2.left) < 1, '화면의 같은 자리 ' + JSON.stringify({ m1, m2 }));
    assert.equal((await state(page)).shown, true);
    assert.equal(await madeHit(page), true, '다른 것 밑에 깔리지 않음');
    // 안쪽 여백: 로고 왼쪽과 닫기(×) 그림 오른쪽이 같게 보임(1.5px 안)
    const pad = await page.evaluate(() => {
      const m = document.querySelector('[data-lp-made]').getBoundingClientRect(), l = document.querySelector('.lpk-made-logo').getBoundingClientRect(), x = document.querySelector('[data-lp-made-close] svg').getBoundingClientRect();
      // 로고 그림은 16px 가운데 1.7px 안쪽에서, × 그림은 16px 가운데 4.7px 안쪽에서 시작함(viewBox)
      return { left: l.left - m.left + 1.7, right: m.right - x.right + 4.7 };
    });
    assert.ok(Math.abs(pad.left - pad.right) <= 1.5, '좌우 여백 ' + JSON.stringify(pad));
    const [pop] = await Promise.all([page.waitForEvent('popup'), page.click('[data-lp-made] a')]);
    assert.equal(pop.url(), 'https://lecpage.com/');
    await pop.close();
    // 누를 곳 크기(24px 이상)·이름
    const sizes = await page.$$eval('[data-lp-made] a, [data-lp-made] button', (ns) => ns.map((n) => { const r = n.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), n.getAttribute('aria-label') || n.textContent.trim()]; }));
    for (const [w, h, name] of sizes) assert.ok(w >= 24 && h >= 24 && name, JSON.stringify(sizes));
    assert.match(sizes[0][2], /Made with Lecpage\(새 탭에서 열려요\)/);
    await page.focus('[data-lp-made] a'); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-lp-made-close')), true);
    // 맨 끝: 마지막 글(키트 묶음 앞의 것)이 표시 밑에 깔리지 않음(참여 막대 몫으로 비워 둔 자리 안)
    await down(page, -1);
    const end = await page.evaluate(() => { const c = document.querySelector('.lpk.lpk-chrome'), m = document.querySelector('[data-lp-made]').getBoundingClientRect(); return { chromeTop: c.getBoundingClientRect().top, madeTop: m.top }; });
    assert.ok(end.chromeTop <= end.madeTop - 6, '맨 끝 글이 표시 위에서 끝남 ' + JSON.stringify(end));
    assert.equal((await state(page)).shown, true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, '가로 넘침 없음');
    assert.deepEqual(page._errs, []);
  } finally { await ctx.close(); }
});

test('사이트의 누를 것을 덮는 자리에서는 스스로 비켜 줌(눌림은 아래 것이 받음), 지나가면 다시 나타남. 낡은 판단으로 눌려도 lecpage.com을 열지 않고 비킴', { skip }, async () => {
  for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844, isMobile: true, hasTouch: true }]) {
    const { ctx, page } = await open(base + '/calm/', vp);
    try {
      await down(page, 300);
      assert.equal((await state(page)).shown, true, `${vp.width}: 글만 있는 곳에서는 보임`);
      // 링크가 표시 자리에 오도록 내림
      const m = await rect(page, '[data-lp-made]');
      await page.evaluate((mid) => { const a = document.querySelector('#under'), r = a.getBoundingClientRect(); window.scrollBy(0, r.top + r.height / 2 - mid); }, m.top + m.height / 2);
      await page.waitForTimeout(900);
      const s1 = await state(page);
      assert.deepEqual([s1.yields, s1.shown], [true, false], `${vp.width} ${JSON.stringify(s1)}`);
      const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, [m.left + m.width / 2, m.top + m.height / 2]);
      assert.equal(hit, 'under', `${vp.width}: 그 자리를 누르면 사이트 링크가 받음`);
      // 키보드로 들어오면 보이고, 나가면 다시 비킴
      await page.focus('[data-lp-made] a'); await page.waitForTimeout(450);
      assert.equal((await state(page)).shown, true, `${vp.width}: 포커스가 오면 보임`);
      await page.evaluate(() => document.activeElement.blur()); await page.waitForTimeout(450);
      assert.equal((await state(page)).shown, false, `${vp.width}: 포커스가 나가면 다시 비킴`);
      // 지나가면 다시 나타남
      await page.evaluate(() => window.scrollBy(0, 400)); await page.waitForTimeout(1300);
      const s2 = await state(page);
      assert.deepEqual([s2.yields, s2.shown], [false, true], `${vp.width} ${JSON.stringify(s2)}`);
      // 낡은 판단: 스크롤·크기 변화 없이 표시 밑에 단추가 생김 → 표시를 눌러도 새 탭이 열리지 않고 비켜 줌, 다시 누르면 단추가 받음
      const pages0 = ctx.pages().length;
      await page.evaluate(([x, y]) => {
        const b = document.createElement('button'); b.id = 'late-btn'; b.textContent = '늦게 생긴 단추';
        b.style.cssText = `position:absolute;left:${x - 60}px;top:${y + scrollY - 30}px;width:120px;height:60px;margin:0`;
        b.addEventListener('click', () => { window.__late = (window.__late || 0) + 1; });
        document.body.appendChild(b);
      }, [m.left + m.width / 2, m.top + m.height / 2]);
      await page.mouse.click(m.left + 60, m.top + m.height / 2);
      await page.waitForTimeout(500);
      assert.equal(ctx.pages().length, pages0, `${vp.width}: lecpage.com을 열지 않음`);
      assert.ok(await page.$('[data-lp-made]'), `${vp.width}: 닫히지도 않음`);
      assert.equal((await state(page)).shown, false, `${vp.width}: 비켜 줌`);
      await page.mouse.click(m.left + 60, m.top + m.height / 2);
      assert.equal(await page.evaluate(() => window.__late), 1, `${vp.width}: 다시 누르면 단추가 받음`);
      await page.evaluate(() => document.querySelector('#late-btn').remove());
      // 훑는 점 사이에 들어가는 아주 작은 링크(6px): 처음 누르면 비키고, 곧바로 다시 나타나 또 가로막지 않음 → 두 번째에는 링크가 받음
      // (자리는 런타임의 훑는 점 — 가로 20px쯤 간격·세로 27%·73% 줄 — 사이로 잡음. 그 간격을 바꾸면 이 링크의 자리도 함께 옮길 것: 훑기에 걸리면 '눌린 뒤 비킨 채로'를 더는 시험하지 못함)
      await page.evaluate(() => window.scrollBy(0, 60)); await page.waitForTimeout(1300);
      assert.equal((await state(page)).shown, true, `${vp.width}: 다시 보임`);
      await page.evaluate(([x, y]) => {
        const a = document.createElement('a'); a.id = 'tiny'; a.href = '#tiny-hit'; a.style.cssText = `position:absolute;left:${x}px;top:${y + scrollY}px;width:6px;height:6px;background:#c00`;
        a.addEventListener('click', (e) => { e.preventDefault(); window.__tiny = (window.__tiny || 0) + 1; });
        document.body.appendChild(a);
      }, [m.left + 11, m.top + 12]);
      await page.mouse.click(m.left + 14, m.top + 15); await page.waitForTimeout(800);
      assert.equal(ctx.pages().length, pages0, `${vp.width}: 작은 링크 위에서도 lecpage.com을 열지 않음`);
      assert.equal((await state(page)).shown, false, `${vp.width}: 눌린 뒤에는 비킨 채로(0.35초 뒤 다시 나타나지 않음)`);
      await page.mouse.click(m.left + 14, m.top + 15);
      assert.equal(await page.evaluate(() => window.__tiny), 1, `${vp.width}: 두 번째에는 작은 링크가 받음`);
      await page.evaluate(() => document.querySelector('#tiny').remove());
      // AI가 본문에 놓은 '지금' 띠(data-lp="now": 떠 있지 않고 글과 함께 흐름)의 단추 위에서도 비켜 줌
      await page.evaluate(() => { const band = document.querySelector('.lpk-now--placed'); band.innerHTML = '<div class="lp-now"><button type="button" id="nowbtn" style="min-height:44px;width:240px">3쪽 보기</button></div>'; document.getElementById('nowbtn').addEventListener('click', () => { window.__now = (window.__now || 0) + 1; }); });
      await page.evaluate((mid) => { const r = document.getElementById('nowbtn').getBoundingClientRect(); window.scrollBy(0, r.top + r.height / 2 - mid); }, m.top + m.height / 2);
      await page.waitForTimeout(1300);
      const s3 = await state(page);
      assert.deepEqual([s3.yields, s3.shown], [true, false], `${vp.width}: 본문에 놓은 띠의 단추 위 ${JSON.stringify(s3)}`);
      await page.mouse.click(m.left + 60, m.top + m.height / 2);
      assert.equal(await page.evaluate(() => window.__now), 1, `${vp.width}: 띠의 단추가 눌림`);
      assert.equal(ctx.pages().length, pages0);
      assert.deepEqual(page._errs, []);
    } finally { await ctx.close(); }
  }
});

test("사이트의 아래 고정 막대·'지금' 띠와 겹치지 않음(그 자리에 걸치면 그 위로 비켜 섬)", { skip }, async () => {
  // 사이트가 만든 아래 고정 막대(전체 너비 72px)가 있는 판: 막대 위로 올라가고, 참여 막대와도 겹치지 않음
  const { ctx, page } = await open(base + '/bar/');
  try {
    await down(page, 600);
    const s = await state(page);
    assert.deepEqual([s.pos, s.flow], ['fixed', false], JSON.stringify(s));
    const m = await rect(page, '[data-lp-made]'), bar = await rect(page, '.cta-bar'), dock = await rect(page, '[data-dock]');
    assert.ok(!overlap(m, bar) && !overlap(m, dock) && m.bottom <= bar.top - 8, JSON.stringify({ m, bar, dock }));
    assert.deepEqual(page._errs, []);
  } finally { await ctx.close(); }
  const show = (pg) => pg.evaluate(() => { const n = document.querySelector('[data-now]'); n.hidden = false; const b = n.querySelector('[data-now-main]'); if (b) b.textContent = '지금: 2부 실습 — 표를 모아 차트로 읽어요'; });
  // '지금' 띠: 참여 막대가 있으면 띠는 막대 줄 위에 뜸 → 왼쪽 구석의 표시와 겹치지 않음(중간 너비·넓은 화면 모두)
  for (const width of [760, 1280]) {
    const o = await open(base + '/', { width, height: 900 });
    try {
      // 먼저 맨 끝으로 내린 뒤 띠를 띄움(내리는 동안 투표 칸이 화면을 지나면 런타임이 띠를 다시 그려 억지로 띄운 띠를 감춤)
      await down(o.page, -1); await show(o.page); await o.page.waitForTimeout(900);
      await down(o.page, -1); await show(o.page); await o.page.waitForTimeout(900);
      const now = await rect(o.page, '.lpk.lpk-now'), m = await rect(o.page, '[data-lp-made]'), dock = await rect(o.page, '[data-dock]');
      assert.ok(now.height > 0, '띠가 보임');
      assert.ok(m.top >= 0 && m.bottom <= 900, `${width}: 화면 안 ` + JSON.stringify(m));
      assert.ok(!overlap(m, now) && !overlap(m, dock), `${width} ` + JSON.stringify({ m, now, dock }));
      assert.equal(await madeHit(o.page) || (await state(o.page)).yields, true);
      assert.deepEqual(o.page._errs, []);
    } finally { await o.ctx.close(); }
  }
});

test("휴대폰: 화면 폭 참여 막대 바로 위 왼쪽에 떠서 따라다님('지금' 띠가 뜨면 그 위로, 왼쪽 끝은 막대와 같게), 닫으면 이 브라우저에서 다시 안 보임(자리·눈금도 치움)", { skip }, async () => {
  const { ctx, page } = await open(base + '/', { width: 390, height: 844, isMobile: true, hasTouch: true });
  try {
    await down(page, 500);
    const s = await state(page);
    assert.deepEqual([s.pos, s.flow], ['fixed', false], JSON.stringify(s));
    const m0 = await rect(page, '[data-lp-made]'), dock = await rect(page, '[data-dock]');
    assert.ok(Math.abs(m0.left - dock.left) < 1 && m0.bottom <= dock.top - 8 && m0.bottom >= dock.top - 14 && m0.right <= 390, JSON.stringify({ m0, dock }));
    // 먼저 맨 끝으로 내린 뒤 띠를 띄움(내리는 동안 투표 칸이 화면을 지나면 런타임이 띠를 다시 그려 억지로 띄운 띠를 감춤)
    const show = () => page.evaluate(() => { const n = document.querySelector('[data-now]'); n.hidden = false; const b = n.querySelector('[data-now-main]'); if (b) b.textContent = '지금: 2부 실습 — 표를 모아 차트로 읽어요'; });
    await down(page, -1); await show(); await page.waitForTimeout(900);
    await down(page, -1); await show(); await page.waitForTimeout(900);
    const m = await rect(page, '[data-lp-made]'), now = await rect(page, '.lpk.lpk-now');
    assert.ok(m.bottom <= 844 && m.top >= 0, '화면 안 ' + JSON.stringify(m));
    assert.ok(now.height > 0 && !overlap(m, dock) && !overlap(m, now) && m.bottom <= now.top - 8, JSON.stringify({ m, dock, now }));
    assert.ok(Math.abs(m.left - now.left) < 1, '띠와 왼쪽 끝이 같음 ' + JSON.stringify({ m, now }));
    // 맨 끝에서는 비워 둔 자리 위라 보이고 눌림
    assert.equal((await state(page)).shown, true); assert.equal(await madeHit(page), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, '가로 넘침 없음');
    // 닫기: 포커스는 바로 앞의 누를 곳으로, 이 브라우저에 기억
    const h0 = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.focus('[data-lp-made-close]'); await page.keyboard.press('Enter');
    assert.equal(await page.$('[data-lp-made]'), null);
    assert.equal(await page.evaluate(() => localStorage.getItem('lp-made-off')), '1');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement !== document.body), true, '포커스가 사라지지 않음');
    assert.equal(await page.$('.lpk-made-base'), null, '자리 눈금도 치움');
    assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--lp-made-need')), '', '맨 끝에 비워 둔 자리도 되돌림');
    assert.ok(await page.evaluate(() => document.documentElement.scrollHeight) < h0, '맨 끝에 비워 둔 자리가 줄어듦');
    await page.reload(); await page.waitForTimeout(600);
    assert.equal(await page.$('[data-lp-made]'), null, '다시 열어도 안 보임');
    assert.equal(await page.$('.lpk-made-base'), null);
    assert.deepEqual(page._errs, []);
  } finally { await ctx.close(); }
});

test('낮은 화면(가로로 돌린 휴대폰): 떠 있지 않고 페이지 맨 끝 왼쪽에 한 줄(참여 막대에 가리지 않음). 세로로 돌리면 다시 떠서 따라다님', { skip }, async () => {
  const { ctx, page } = await open(base + '/', { width: 844, height: 390, isMobile: true, hasTouch: true });
  try {
    assert.deepEqual(await state(page).then((s) => [s.pos, s.flow, s.yields]), ['relative', true, false]);
    const top0 = await rect(page, '[data-lp-made]');
    assert.ok(top0.top >= 390, '첫 화면에는 없음 ' + JSON.stringify(top0));
    assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--lp-made-need')), '');
    await down(page, -1);
    const m = await rect(page, '[data-lp-made]'), dock = await rect(page, '[data-dock]');
    assert.ok(m.left <= 20 && m.top >= 0 && m.bottom <= 390 && !overlap(m, dock), JSON.stringify({ m, dock }));
    assert.equal(await madeHit(page), true);
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(900);
    await down(page, 500);
    const s = await state(page);
    assert.deepEqual([s.pos, s.flow], ['fixed', false], JSON.stringify(s));
    assert.deepEqual(page._errs, []);
  } finally { await ctx.close(); }
});

test('첫 화면: 표시 자리(왼쪽 아래)에 사이트의 단추가 있으면 비켜 있고 눌림은 그 단추가 받음. 참여 막대가 없는 사이트는 구석에 그대로', { skip }, async () => {
  // 참여 기능 없는 사이트(참여 막대 없음) + 화면을 꽉 채운 첫 화면의 왼쪽 아래에 단추
  const site = refSite();
  site['index.html'] = site['index.html'].replace(/<body([^>]*)>/, '<body$1><div class="first-screen"><a class="first-cta" href="#after-first">출석하고 시작하기</a></div><div id="after-first" class="after-first"></div>');
  site['assets/style.css'] = (site['assets/style.css'] || '') + '\n.first-screen{position:relative;height:100vh}.first-cta{position:absolute;left:10px;bottom:10px;display:block;padding:14px 22px;background:#222;color:#fff}.after-first{height:900px}\n';
  writeFiles(path.join(dir, 'first'), kitBuild({ site, prev: { live: { provider: 'none' } } }).files);
  for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844, isMobile: true, hasTouch: true }]) {
    const { ctx, page } = await open(base + '/first/', vp);
    try {
      const s0 = await state(page);
      assert.deepEqual([s0.pos, s0.flow, s0.yields, s0.shown], ['fixed', false, true, false], `${vp.width} ${JSON.stringify(s0)}`);
      const hit = await page.evaluate(() => { const r = document.querySelector('[data-lp-made]').getBoundingClientRect(), h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return h && h.className; });
      assert.equal(hit, 'first-cta', `${vp.width}: 사이트 단추가 눌림`);
      // 단추가 지나가면(글만 있는 곳) 나타남
      await down(page, vp.height + 200); await page.waitForTimeout(500);
      const s1 = await state(page);
      assert.deepEqual([s1.yields, s1.shown], [false, true], `${vp.width} ${JSON.stringify(s1)}`);
      // 맨 위로 돌아가면 다시 비킴(언제나 누를 것이 먼저)
      await down(page, 0); await page.waitForTimeout(500);
      assert.equal((await state(page)).shown, false, `${vp.width}: 다시 비킴`);
      assert.deepEqual(page._errs, []);
    } finally { await ctx.close(); }
  }
  // 그 자리에 누를 것이 없는 첫 화면에서는 처음부터 보임
  const plain = refSite();
  plain['index.html'] = plain['index.html'].replace(/<body([^>]*)>/, '<body$1><div class="first-screen"><p>첫 화면</p></div>');
  plain['assets/style.css'] = (plain['assets/style.css'] || '') + '\n.first-screen{position:relative;height:100vh}\n';
  writeFiles(path.join(dir, 'first-plain'), kitBuild({ site: plain, prev: { live: { provider: 'none' } } }).files);
  const { ctx, page } = await open(base + '/first-plain/', { width: 1280, height: 800 });
  try {
    const s = await state(page);
    assert.deepEqual([s.pos, s.flow, s.yields, s.shown], ['fixed', false, false, true], JSON.stringify(s));
    // 참여 막대가 없으면 왼쪽 아래 구석(12px) 그대로
    const m = await rect(page, '[data-lp-made]');
    assert.ok(Math.abs(m.left - 12) < 1 && Math.abs(m.bottom - (800 - 12)) < 1, JSON.stringify(m));
    assert.deepEqual(page._errs, []);
  } finally { await ctx.close(); }
});

test("사이트의 작은 고정 단추 위로는 비켜 서고, 글도 누를 것도 없는 고정 꾸밈은 막는 것으로 보지 않음. 닫기는 알약 안에서만 눌림, 휴대폰의 알림(토스트)은 표시 위에 뜸", { skip }, async () => {
  const none = { live: { provider: 'none' } };
  // ① 왼쪽 아래의 작은 고정 단추(48px, 표본 점 사이에 들어가는 크기): 표시가 그 위로 올라가 겹치지 않음
  writeFiles(path.join(dir, 'totop'), kitBuild({ site: calmSite('.totop{position:fixed;left:20px;bottom:20px;width:48px;height:48px;z-index:40}', '<button class="totop" type="button" aria-label="맨 위로">↑</button>'), prev: none }).files);
  for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844, isMobile: true, hasTouch: true }]) {
    const { ctx, page } = await open(base + '/totop/', vp);
    try {
      await down(page, 300);
      const m = await rect(page, '[data-lp-made]'), b = await rect(page, '.totop');
      assert.ok(!overlap(m, b) && m.bottom <= b.top - 8, `${vp.width} ${JSON.stringify({ m, b })}`);
      assert.equal(await page.evaluate(() => { const r = document.querySelector('.totop').getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + 6)?.className; }), 'totop', `${vp.width}: 단추가 그대로 눌림`);
      assert.deepEqual([(await state(page)).flow, (await state(page)).shown], [false, true], `${vp.width}`);
      assert.deepEqual(page._errs, []);
    } finally { await ctx.close(); }
  }
  // ② 구석의 고정 꾸밈(본문 뒤 z-index 음수 / 글도 누를 것도 없는 빈 칸): 표시는 구석 제자리에 그대로(맨 끝 한 줄로 밀려나지 않음)
  for (const [k, css] of [['back', '.blob{position:fixed;left:-120px;bottom:-120px;width:420px;height:420px;opacity:.35;z-index:-1;background:#c0f}'], ['empty', '.blob{position:fixed;left:0;bottom:0;width:300px;height:300px;opacity:.2;background:#0cf}']]) {
    writeFiles(path.join(dir, 'blob-' + k), kitBuild({ site: calmSite(css, '<div class="blob"></div>'), prev: none }).files);
    const { ctx, page } = await open(base + '/blob-' + k + '/', { width: 1280, height: 800 });
    try {
      await down(page, 300);
      const s = await state(page), m = await rect(page, '[data-lp-made]');
      assert.deepEqual([s.pos, s.flow, s.shown], ['fixed', false, true], `${k} ${JSON.stringify(s)}`);
      assert.ok(Math.abs(m.left - 12) < 1 && Math.abs(m.bottom - (800 - 12)) < 1, `${k}: 구석 제자리 ${JSON.stringify(m)}`);
    } finally { await ctx.close(); }
  }
  // ③ 닫기의 누르는 곳은 알약 안에서만: 바로 위·오른쪽 바깥(본문)을 눌러도 닫히지 않음, 안쪽 ×를 누르면 닫힘
  // ④ 휴대폰에서 알림(토스트)은 표시 위에 뜸(가로질러 덮지 않음)
  const { ctx, page } = await open(base + '/calm/', { width: 390, height: 844, isMobile: true, hasTouch: true });
  try {
    await down(page, 300);
    const m = await rect(page, '[data-lp-made]'), xr = await rect(page, '[data-lp-made-close]');
    await page.evaluate(() => { const t = document.querySelector('[data-toast]'); t.textContent = '복사했어요. 긴 알림 글이 두 줄이 되도록 조금 더 길게 적어 둔 시험용 알림이에요.'; t.classList.add('is-on'); });
    await page.waitForTimeout(500);
    const toast = await rect(page, '[data-toast]');
    assert.ok(toast.height > 0 && toast.bottom <= m.top, '알림이 표시 위에 뜸 ' + JSON.stringify({ toast, m }));
    await page.evaluate(() => document.querySelector('[data-toast]').classList.remove('is-on'));
    await page.mouse.click(xr.left + xr.width / 2, m.top - 3); await page.waitForTimeout(200);
    await page.mouse.click(m.right + 3, m.top + m.height / 2); await page.waitForTimeout(200);
    assert.ok(await page.$('[data-lp-made]'), '알약 밖을 눌러서는 닫히지 않음');
    assert.equal(await page.evaluate(() => localStorage.getItem('lp-made-off')), null);
    await page.mouse.click(xr.left + xr.width / 2, xr.top + xr.height / 2); await page.waitForTimeout(200);
    assert.equal(await page.$('[data-lp-made]'), null, '×를 누르면 닫힘');
    // 손가락·마우스로 닫았을 때는 초점을 옮기지 않음(키보드로 닫을 때만 앞의 누를 곳으로): 화면 밖 맨 끝의 입력 칸으로 가면 휴대폰 자판이 뜸
    assert.equal(await page.evaluate(() => document.activeElement === document.body || document.activeElement === null), true, '초점이 멀리 옮겨 가지 않음');
    assert.deepEqual(page._errs, []);
  } finally { await ctx.close(); }
});

test('인쇄·동작 줄이기·밝게/어둡게', { skip }, async () => {
  const { ctx, page } = await open(base + '/', { reducedMotion: 'reduce', colorScheme: 'dark' });
  try {
    assert.equal(await page.$eval('[data-lp-made]', (n) => getComputedStyle(n).animationName), 'none');
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.$eval('[data-lp-made]', (n) => n.getClientRects().length), 0, '인쇄에는 없음');
    await page.emulateMedia({ media: 'screen' });
    // 글자와 바탕의 대비(사이트 색 변수를 따름): 4.5:1 이상
    const c = await page.$eval('[data-lp-made]', (n) => {
      const parse = (s) => { const m = s.match(/[\d.]+/g).map(Number); return s.startsWith('color(') ? [m[0] * 255, m[1] * 255, m[2] * 255, m[3] ?? 1] : [m[0], m[1], m[2], m[3] ?? 1]; };
      const cs = getComputedStyle(n), fg = parse(cs.color), bg = parse(cs.backgroundColor);
      const mix = (a, b, t) => a.map((x, i) => i < 3 ? x * t + b[i] * (1 - t) : 1);
      const paper = bg; const fgOn = mix(fg, paper, fg[3]);
      const L = (c) => { const v = c.slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
      const a = L(fgOn), b = L(paper); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    assert.ok(c >= 4.5, `대비 ${c}`);
  } finally { await ctx.close(); }
});

test('꽉 찬 바닥글 아래: 키트 묶음(맨 끝 줄·참여 막대 자리)이 바닥글 색으로 이어짐. 틈이 있거나 좁거나 색을 알 수 없으면 그대로', { skip }, async () => {
  // 사이트 바탕은 밝은 색, 바닥글은 어두운 색(화면 너비를 다 채움)
  const page = (css, tail) => ({ 'index.html': `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>바닥글 시험</title><style>body{margin:0;background:#fafafa;color:#111}main{padding:16px;min-height:120vh}.ft{background:#123456;color:#fff;padding:32px 16px}.dark .ft{background:#000000}${css}</style></head><body><main><h1>바닥글 시험</h1><div data-lp="qa"></div></main>${tail || '<footer class="ft">바닥글</footer>'}</body></html>` });
  const cases = {
    full: ['', '', 'rgb(18, 52, 86)'],
    wrap: ['', '<div class="wrap"><footer class="ft">바닥글</footer></div>', 'rgb(18, 52, 86)'], // 바탕색 없는 묶음 안의 바닥글
    gap: ['.ft{margin-bottom:24px}', '', ''], // 바닥글 아래에 사이트 바탕이 보이는 틈
    narrow: ['.ft{max-width:300px;margin:0 auto}', '', ''], // 화면 너비를 다 채우지 않음
    grad: ['.ft{background:linear-gradient(#123456,#654321)}', '', ''], // 끝 색을 알 수 없음
  };
  for (const [k, [css, tail]] of Object.entries(cases)) writeFiles(path.join(dir, 'ft-' + k), kitBuild({ site: page(css, tail) }).files);
  for (const [k, [, , want]] of Object.entries(cases)) for (const width of [390, 1280]) {
    const { ctx, page: pg } = await open(`${base}/ft-${k}/`, { width, height: 800, isMobile: width < 500, hasTouch: width < 500 });
    try {
      await pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await pg.waitForTimeout(350);
      const r = await pg.evaluate(() => { const c = document.querySelector('.lpk.lpk-chrome'), f = document.querySelector('.ft'), cr = c.getBoundingClientRect(); return { tint: c.classList.contains('lpk-chrome--tint'), bg: getComputedStyle(c).backgroundColor, gap: Math.round(cr.top - f.getBoundingClientRect().bottom), h: Math.round(cr.height), end: Math.round(document.documentElement.scrollHeight - (cr.bottom + scrollY)) }; });
      assert.equal(r.tint, !!want, `${k} ${width} ${JSON.stringify(r)}`);
      if (want) { assert.equal(r.bg, want, `${k} ${width}`); assert.equal(r.gap, 0, '바닥글과 틈 없이 닿음'); assert.ok(r.h > 0 && r.end <= 1, '묶음이 페이지 맨 끝까지 ' + JSON.stringify(r)); }
      else assert.equal(r.bg, 'rgba(0, 0, 0, 0)', `${k} ${width}`);
      // 맨 끝에서 떠 있는 표시는 묶음이 비워 둔 자리(바닥글 색으로 이어 칠한 곳) 위에 놓임: 바닥글 글을 덮지 않음
      { const m = await rect(pg, '[data-lp-made]'), c = await rect(pg, '.lpk.lpk-chrome'); assert.ok(m.top >= c.top && m.bottom <= c.bottom, `${k} ${width} ${JSON.stringify({ m, c })}`); }
      if (k === 'full') {
        // 사이트가 밝게·어둡게를 바꾸면(html의 class) 바닥글 색을 다시 따라감
        await pg.evaluate(() => document.documentElement.classList.add('dark')); await pg.waitForTimeout(400);
        assert.equal(await pg.$eval('.lpk.lpk-chrome', (c) => getComputedStyle(c).backgroundColor), 'rgb(0, 0, 0)');
      }
      assert.deepEqual(pg._errs, []);
    } finally { await ctx.close(); }
  }
});

test('참여 기능 서버에 닿지 않으면 안내는 한 곳에만(첫 참여 칸 앞, role=status 하나)', { skip }, async () => {
  const { ctx, page } = await open(base + '/down/');
  try {
    await page.waitForSelector('[data-live-down]', { timeout: 15000 });
    await page.waitForTimeout(500);
    const r = await page.$$eval('[data-live-down]', (ns) => ns.map((n) => [n.getAttribute('role'), n.nextElementSibling && (n.nextElementSibling.matches('[data-qa],[data-board],[data-poll],[data-survey]'))]));
    assert.deepEqual(r, [['status', true]]);
    assert.ok(await page.$$eval('[data-qa],[data-board],[data-poll],[data-survey]', (ns) => ns.length) > 1, '참여 칸이 여럿인 사이트');
  } finally { await ctx.close(); }
});
