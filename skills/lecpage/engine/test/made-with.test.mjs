// 'Made with Lecpage' 표시: 엔진 조립이 참가자 쪽에만 넣고(AI 요청문과 상관없이), 런타임이 보이고·닫고·자리를 잡음.
// 만든 파일만 보는 시험 + 실제 브라우저(넓은 화면 구석·사이트의 아래 고정 단추 비키기·'지금' 띠·휴대폰 맨 끝·닫기·인쇄).
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

test('넓은 화면: 떠 있지 않고 페이지 맨 끝에 한 줄(본문·누를 곳을 덮지 않음, 참여 막대와 겹치지 않음), 누르면 lecpage.com이 새 탭으로, 키보드로 닿음', { skip }, async () => {
  const { ctx, page } = await open(base + '/');
  try {
    assert.equal(await page.$eval('[data-lp-made]', (n) => [getComputedStyle(n).position, n.classList.contains('is-flow')].join()), 'relative,true');
    // 첫 화면에는 없고(본문 글·단추를 덮지 않음) 문서와 함께 움직임(떠다니지 않음)
    const top0 = await rect(page, '[data-lp-made]');
    assert.ok(top0.top >= 800, '첫 화면에는 없음 ' + JSON.stringify(top0));
    await page.evaluate(() => window.scrollTo(0, 600)); await page.waitForTimeout(400);
    const mid = await rect(page, '[data-lp-made]');
    assert.ok(Math.abs((top0.top - 600) - mid.top) < 2, '문서와 함께 움직임 ' + JSON.stringify({ top0, mid }));
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(400);
    const m = await rect(page, '[data-lp-made]');
    assert.ok(m.left <= 20 && m.top >= 0 && m.bottom <= 800 && m.height <= 32 && m.width < 220, JSON.stringify(m));
    assert.ok(!overlap(m, await rect(page, '[data-dock]')), '참여 막대와 겹침');
    const [pop] = await Promise.all([page.waitForEvent('popup'), page.click('[data-lp-made] a')]);
    assert.equal(pop.url(), 'https://lecpage.com/');
    await pop.close();
    // 누를 곳 크기(24px 이상)·이름
    const sizes = await page.$$eval('[data-lp-made] a, [data-lp-made] button', (ns) => ns.map((n) => { const r = n.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), n.getAttribute('aria-label') || n.textContent.trim()]; }));
    for (const [w, h, name] of sizes) assert.ok(w >= 24 && h >= 24 && name, JSON.stringify(sizes));
    assert.match(sizes[0][2], /Made with Lecpage\(새 탭에서 열려요\)/);
    await page.focus('[data-lp-made] a'); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-lp-made-close')), true);
    assert.deepEqual(page._errs, []);
  } finally { await ctx.close(); }
});

test('사이트의 아래 고정 막대가 있어도 그 위에 떠서 올라타지 않고, \'지금\' 띠가 떠 있어도 맨 끝 줄과 겹치지 않음', { skip }, async () => {
  const { ctx, page } = await open(base + '/bar/');
  try {
    // 사이트가 만든 아래 고정 막대가 있는 판: 떠 있지 않으므로 스크롤하는 동안 막대·본문 어디에도 올라타지 않음(맨 끝 한 줄)
    assert.equal(await page.$eval('[data-lp-made]', (n) => [getComputedStyle(n).position, n.classList.contains('is-flow')].join()), 'relative,true');
    const m = await rect(page, '[data-lp-made]');
    assert.ok(m.top >= 800, '첫 화면에는 없음 ' + JSON.stringify(m));
    await page.close();
  } finally { await ctx.close(); }
  // '지금' 띠: 중간 너비(띠가 왼쪽 끝까지 닿음)에서 띠를 띄우고 맨 끝까지 내려도 겹치지 않게(묶음이 띠 높이만큼 자리를 비움)
  const o = await open(base + '/', { width: 760, height: 900 });
  try {
    // 먼저 맨 끝으로 내린 뒤 띠를 띄움(내리는 동안 투표 칸이 화면을 지나면 런타임이 띠를 다시 그려 억지로 띄운 띠를 감춤)
    const show = () => o.page.evaluate(() => { const n = document.querySelector('[data-now]'); n.hidden = false; const b = n.querySelector('[data-now-main]'); if (b) b.textContent = '지금: 2부 실습 — 표를 모아 차트로 읽어요'; });
    await o.page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await o.page.waitForTimeout(500);
    await show(); await o.page.waitForTimeout(500);
    // 띠 높이만큼 묶음이 자리를 비우면 문서가 길어짐 → 다시 맨 끝으로
    await o.page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await o.page.waitForTimeout(400); await show(); await o.page.waitForTimeout(200);
    const now = await rect(o.page, '.lpk.lpk-now'), m = await rect(o.page, '[data-lp-made]');
    assert.ok(now.height > 0, '띠가 보임');
    assert.ok(m.top >= 0 && m.bottom <= 900, '맨 끝에서 보임 ' + JSON.stringify(m));
    assert.ok(!overlap(m, now), JSON.stringify({ m, now }));
  } finally { await o.ctx.close(); }
});

test('휴대폰: 떠 있지 않고 페이지 맨 끝에 한 줄(참여 막대·\'지금\' 띠에 가리지 않음), 닫으면 이 브라우저에서 다시 안 보임', { skip }, async () => {
  const { ctx, page } = await open(base + '/', { width: 390, height: 844, isMobile: true, hasTouch: true });
  try {
    assert.equal(await page.$eval('[data-lp-made]', (n) => [getComputedStyle(n).position, n.classList.contains('is-flow')].join()), 'relative,true');
    await page.evaluate(() => { const n = document.querySelector('[data-now]'); n.hidden = false; });
    await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(400);
    const m = await rect(page, '[data-lp-made]'), dock = await rect(page, '[data-dock]'), now = await rect(page, '.lpk.lpk-now');
    assert.ok(m.bottom <= 844 && m.top >= 0, '맨 끝에서 보임 ' + JSON.stringify(m));
    assert.ok(!overlap(m, dock) && !overlap(m, now), JSON.stringify({ m, dock, now }));
    // 닫기: 포커스는 바로 앞의 누를 곳으로, 이 브라우저에 기억
    await page.focus('[data-lp-made-close]'); await page.keyboard.press('Enter');
    assert.equal(await page.$('[data-lp-made]'), null);
    assert.equal(await page.evaluate(() => localStorage.getItem('lp-made-off')), '1');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement !== document.body), true, '포커스가 사라지지 않음');
    await page.reload(); await page.waitForTimeout(600);
    assert.equal(await page.$('[data-lp-made]'), null, '다시 열어도 안 보임');
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
      // 표시 줄은 묶음 안에서 그대로 보이고(휴대폰: 맨 끝 한 줄) 닫을 수 있음
      if (width === 390) { const m = await rect(pg, '[data-lp-made]'), c = await rect(pg, '.lpk.lpk-chrome'); assert.ok(m.top >= c.top - 29 && m.bottom <= c.bottom, JSON.stringify({ m, c })); }
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
