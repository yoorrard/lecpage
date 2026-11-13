// 강의 페이지 화면 잇기(강사 화면이 출발점)와 '참가자가 강사용 화면에 섞이지 않게'를 실제 브라우저로 봄.
// 만든 사이트를 Node 서버(http 방식, 같은 주소에서 사이트도 보냄)로 열고 강사·발표·참가자 화면을 함께 누름.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { createRequire } from 'node:module';
import * as E from '../src/index.js';
import { nodeRuntime, writeFiles } from '../node.js';
import { startNodeServer, here } from './live-helpers.mjs';

const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require('playwright')); } catch { try { ({ chromium } = createRequire('/opt/node-tools/')('playwright')); } catch { /* 없음 */ } }
const skip = !chromium && 'playwright is not installed';

const ADMIN = '화면잇기-시험용-관리자키-61';
const EX = JSON.parse(fs.readFileSync(path.join(here, '../../examples/data-lab.blueprint.json'), 'utf8'));
const blueprint = (live) => { const bp = structuredClone(EX); bp.live = { features: ['qa', 'help', 'poll', 'signal'], ...live }; return bp; };
let srv, browser, site, files;

/** QR에 넣은 글자를 엿봄(qr.js의 addData를 감쌈) */
const spyQR = () => { let real; Object.defineProperty(window, 'qrcode', { configurable: true, get() { return real; }, set(v) { real = new Proxy(v, { apply(t, th, args) { const q = t.apply(th, args); const ad = q.addData; q.addData = function (d) { (window.__qr = window.__qr || []).push(String(d)); return ad.apply(this, arguments); }; return q; } }); } }); };

before(async () => {
  site = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-ux-'));
  srv = skip ? null : await startNodeServer({ adminKey: ADMIN, staticDir: site });
  const r = E.build(blueprint({ provider: 'http', url: srv ? srv.url : 'https://live.example.com', code: 'UXJOIN' }), { runtime: nodeRuntime() });
  assert.deepEqual(r.errors, []);
  files = r.files; writeFiles(site, r.files);
  if (!skip) browser = await chromium.launch();
});
after(async () => { await browser?.close(); await srv?.close(); if (site) fs.rmSync(site, { recursive: true, force: true }); });

const open = async (ctx, p) => { const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page._errs = errs; await page.goto(srv.url + '/' + p); return page; };
async function login(page) { await page.fill('#lp-key', ADMIN); await page.click('[data-key-go]'); await page.waitForSelector('[data-console-main]:not([hidden]) .lp-con-strip'); }

test('만든 쪽: 안내문에 강사 화면 주소·QR이 없고, 참가자 공유 창은 발표 화면만, 발표 화면도 같은 창 정책(COOP)', () => {
  assert.doesNotMatch(files['poster.html'], /console|강사 카드|data-qr-page|data-url-page/);
  assert.doesNotMatch(files['index.html'], /href="console\.html"/);
  assert.match(files['index.html'], /data-share-dialog[\s\S]*href="screen\.html"/);
  assert.match(files['console.html'], /class="lp-con-for"[\s\S]*href="index\.html"/);
  assert.match(files['console.html'], /data-after-login hidden/);
  assert.match(files['screen.html'], /class="lp-scr-for"[\s\S]*href="index\.html"/);
  assert.match(files._headers, /^\/screen\.html\n[\s\S]*?Cross-Origin-Opener-Policy: same-origin/m);
  for (const p of ['console.html', 'screen.html', 'poster.html', 'check.html', 'privacy.html']) assert.match(files[p], /<meta name="robots" content="noindex, nofollow">/, p);
});

test('참가자가 강사용 주소로 오면: 강사 화면은 열쇠 칸과 [참가자 화면으로]만, 발표 화면은 휴대폰에서 같은 길', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const c = await open(ctx, 'console.html');
    const box = await c.locator('.lp-con-for').boundingBox();
    assert.ok(box && box.y + box.height < 844, '첫 화면 안에 보임');
    assert.equal(await c.locator('[data-screen-open]:visible, [data-more-btn]:visible, .lp-con-help:visible, [data-conn]:visible').count(), 0, '강사용 버튼·도움말·연결 상태는 들어간 뒤에만');
    await c.click('.lp-con-for a'); await c.waitForURL(/\/(index\.html)?$/);
    const s = await open(ctx, 'screen.html');
    assert.ok(await s.locator('.lp-scr-for').isVisible(), '휴대폰 폭에서는 프로젝터용이라는 줄');
    await s.setViewportSize({ width: 1280, height: 720 });
    assert.ok(await s.locator('.lp-scr-for').isHidden(), '프로젝터 폭에서는 안 보임');
    assert.equal(await s.locator('[data-fs-dialog][open]').count(), 0, '주소로 직접 연 발표 화면에는 전체 화면 안내가 뜨지 않음');
    assert.deepEqual([...c._errs, ...s._errs], []);
  } finally { await ctx.close(); }
});

test('강사 화면이 출발점: [발표 화면 띄우기]는 새 창 하나(다시 누르면 앞으로만)·전체 화면 안내, [참여 QR 크게]가 발표 화면에 바로', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const c = await open(ctx, 'console.html'); await login(c);
    await c.click('[data-more-btn]');
    assert.deepEqual(await c.locator('[data-more-menu] li:not([hidden]) b').allTextContents(), ['참가자 화면', 'QR 안내문', '접속 확인', '휴대폰에서 열기', '도움말']);
    await c.keyboard.press('Escape');
    assert.ok(await c.locator('[data-more-menu]').isHidden());
    const [s] = await Promise.all([ctx.waitForEvent('page'), c.click('[data-screen-open]')]);
    s._errs = []; s.on('pageerror', (e) => s._errs.push(String(e)));
    await s.waitForSelector('[data-fs-dialog][open]', { timeout: 10000 });
    assert.equal(await s.evaluate(() => window.name), 'lp-screen');
    assert.match(await c.textContent('.lp-con-stage'), /새 창으로 열었어요/);
    const n = ctx.pages().length; await c.click('[data-screen-open]'); await c.waitForTimeout(300);
    assert.equal(ctx.pages().length, n, '다시 눌러도 창이 하나');
    await s.click('[data-fs-dialog] button[value="close"]');
    await c.click('[data-k="qrbig"]');
    await s.waitForSelector('[data-joinbig][open]', { timeout: 10000 });
    assert.match(await c.textContent('.lp-con-stage'), /QR 크게/);
    // 발표 화면에서 닫으면(강사 화면이 연 창이라 키가 있음) 강사 화면의 스위치도 꺼짐
    await s.click('[data-joinbig] .lp-joinbig-x');
    await c.waitForFunction(() => document.querySelector('[data-k="qrbig"]').getAttribute('aria-checked') === 'false', null, { timeout: 10000 });
    assert.deepEqual([...c._errs, ...s._errs], []);
  } finally { await ctx.close(); }
});

test('프로젝터가 이어진 크롬(Presentation API): 고른 화면에 screen.html, [발표 화면 끄기], 더보기에 새 창 길', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    class Conn extends EventTarget { constructor() { super(); this.state = 'connected'; } terminate() { this.state = 'terminated'; this.dispatchEvent(new Event('terminate')); } }
    window.PresentationRequest = class { constructor(u) { this.u = u; } getAvailability() { return Promise.resolve({ value: true }); } start() { window.__pres = this.u; return Promise.resolve(new Conn()); } };
    if (!navigator.presentation) Object.defineProperty(navigator, 'presentation', { value: {} });
  });
  try {
    const c = await open(ctx, 'console.html'); await login(c);
    await c.click('[data-screen-open]');
    await c.waitForFunction(() => window.__pres);
    assert.deepEqual(await c.evaluate(() => window.__pres), ['screen.html']);
    assert.ok(await c.locator('[data-k="presoff"]').isVisible());
    await c.click('[data-more-btn]'); assert.ok(await c.locator('[data-screen-window]').isVisible()); await c.keyboard.press('Escape');
    await c.click('[data-k="presoff"]');
    assert.ok(await c.locator('[data-k="presoff"]').isHidden());
    assert.deepEqual(c._errs, []);
  } finally { await ctx.close(); }
});

test('휴대폰에서 열기: QR은 누를 때만·떠나면 가림, 찍으면 키 없이 들어가고 주소에서 키를 지움(이 탭에만)', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(spyQR);
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  try {
    const c = await open(ctx, 'console.html'); await login(c);
    await c.click('[data-more-btn]'); await c.click('[data-phone-open]');
    assert.ok(await c.locator('[data-phone-qr]').isHidden(), '처음에는 가림');
    await c.evaluate(() => { window.__qr = []; });
    await c.click('[data-phone-show]');
    assert.ok(await c.locator('[data-phone-qr] svg').isVisible());
    const u = (await c.evaluate(() => window.__qr)).find((x) => /#key=/.test(x));
    assert.equal(u, srv.url + '/console.html#key=' + encodeURIComponent(ADMIN));
    assert.ok(!(await c.content()).includes(ADMIN), 'DOM에 키 글자는 없음');
    await c.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.ok(await c.locator('[data-phone-qr]').isHidden(), '창을 떠나면 다시 가림');
    const p = await phone.newPage(); p._errs = []; p.on('pageerror', (e) => p._errs.push(String(e)));
    await p.goto(u);
    await p.waitForSelector('[data-console-main]:not([hidden]) .lp-con-strip', { timeout: 10000 });
    assert.ok(!p.url().includes('key='), '주소에서 키를 지움: ' + p.url());
    assert.deepEqual(await p.evaluate(() => [Object.keys(sessionStorage).filter((k) => k.startsWith('lp-admin:')).length, Object.keys(localStorage).filter((k) => k.startsWith('lp-admin:')).length]), [1, 0]);
    // 틀린 키가 든 QR: 들어가지 않고 열쇠 칸으로
    const q = await phone.newPage(); await q.goto(srv.url + '/console.html#key=wrong-key-xxxxx');
    await q.waitForFunction(() => document.querySelector('[data-key-msg]').textContent.length > 0, null, { timeout: 10000 });
    assert.match(await q.textContent('[data-key-msg]'), /QR에 든 관리자 키가 맞지 않아요/);
    assert.ok(!q.url().includes('key='));
    assert.deepEqual([...c._errs, ...p._errs], []);
  } finally { await ctx.close(); await phone.close(); }
});

test('연수가 끝나면 맨 위에 [기록·정리로], 확장자 없는 주소(/poster·/screen·/console)에서도 QR은 참가자 화면', { skip }, async () => {
  // Cloudflare Pages처럼 /poster.html을 /poster로 보내는 곳
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
  const cs = await new Promise((done) => { const s = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; else if (!path.extname(p)) p += '.html';
    const f = path.resolve(site, '.' + p); if (!f.startsWith(path.resolve(site)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
  }).listen(0, '127.0.0.1', () => done(s)); });
  const base = `http://127.0.0.1:${cs.address().port}/`;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(spyQR);
  try {
    for (const pg of ['poster', 'screen']) {
      const r = await ctx.newPage(); await r.goto(base + pg); await r.waitForFunction(() => (window.__qr || []).length > 0, null, { timeout: 10000 });
      assert.deepEqual([...new Set(await r.evaluate(() => window.__qr))], [base], pg);
    }
    const c = await ctx.newPage(); await c.goto(base + 'console?phase=after'); await login(c);
    assert.deepEqual([...new Set(await c.evaluate(() => window.__qr))], [base], 'console');
    assert.ok(await c.locator('.lp-con-after').isVisible());
    await c.click('.lp-con-after a'); await c.waitForTimeout(300);
    const top = await c.evaluate(() => document.querySelector('#lp-p-data').getBoundingClientRect().top);
    assert.ok(top >= 0 && top < 200, '기록·정리 칸으로: ' + top);
  } finally { await ctx.close(); cs.close(); }
});
