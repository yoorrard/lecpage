// Browser smoke tests for the live adapters (Playwright + Chromium).
// Two pages with the 'local' adapter (same browser) and two separate browser contexts with the 'http' adapter
// against the Node server; a question posted on one page must appear on the other.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { startNodeServer, liveDir } from './live-helpers.mjs';

const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require('playwright')); } catch { /* not installed */ }
const skip = !chromium && 'playwright is not installed';

const ADMIN = '강사키-브라우저-테스트용';
let srv; let browser;
before(async () => {
  if (skip) return;
  srv = await startNodeServer({ adminKey: ADMIN, staticDir: liveDir });
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); await srv?.close(); });

const demo = (q) => `${srv.url}/demo.html?${new URLSearchParams(q)}`;
async function ready(page) {
  await page.waitForFunction(() => document.body.dataset.ready, null, { timeout: 15000 });
  assert.equal(await page.evaluate(() => document.body.dataset.ready), '1', await page.textContent('#log'));
}
async function ask(page, text, nickname = '질문자') {
  await page.fill('#nickname', nickname);
  await page.click('#btn-join');
  await page.waitForFunction(() => document.getElementById('me').textContent !== '-');
  await page.fill('#question', text);
  await page.click('#btn-ask');
}
const seeQuestion = (page, text, timeout = 8000) => page.locator('#questions li .t').filter({ hasText: text }).first().waitFor({ timeout });

test('browser: local adapter syncs two tabs (BroadcastChannel + localStorage)', { skip }, async () => {
  const ctx = await browser.newContext();
  try {
    const q = { provider: 'local', code: 'PWLOCAL', autoconnect: '1' };
    const a = await ctx.newPage(); const b = await ctx.newPage();
    await a.goto(demo(q)); await b.goto(demo(q));
    await ready(a); await ready(b);
    assert.equal(await a.textContent('#status'), 'live');
    await ask(a, '로컬 탭 질문입니다');
    await seeQuestion(b, '로컬 탭 질문입니다');
    // HTML is shown as text, never parsed
    await ask(a, '<b id="xss">굵게</b>');
    await seeQuestion(b, '<b id="xss">굵게</b>');
    assert.equal(await b.$('#xss'), null);
    // state from the "console" tab reaches the other tab
    await a.fill('#notice', '모둠 활동 시작');
    await a.click('#btn-state');
    await b.waitForFunction(() => document.getElementById('state').textContent.includes('모둠 활동 시작'));
    // a vote shows up in both
    await b.click('#questions li:has-text("로컬 탭 질문입니다") button');
    await a.waitForSelector('#questions li:has-text("로컬 탭 질문입니다") .m:has-text("공감 1")');
  } finally { await ctx.close(); }
});

test('browser: local adapter also works from file://', { skip }, async () => {
  const ctx = await browser.newContext();
  try {
    const url = pathToFileURL(path.join(liveDir, 'demo.html')).href + '?provider=local&code=PWFILE&autoconnect=1';
    const a = await ctx.newPage(); const b = await ctx.newPage();
    await a.goto(url); await b.goto(url);
    await ready(a); await ready(b);
    await ask(a, '파일로 연 페이지');
    await seeQuestion(b, '파일로 연 페이지');
  } finally { await ctx.close(); }
});

for (const [label, extra, expectMode] of [
  ['WebSocket', {}, /realtime \(ws\)/],
  ['SSE', { transports: 'sse' }, /realtime \(sse\)/],
  ['polling', { transports: 'poll', pollMs: '2000' }, /polling/],
]) {
  test(`browser: http adapter over ${label} syncs two devices`, { skip }, async () => {
    const code = 'PW' + label.slice(0, 4).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
    const c1 = await browser.newContext(); const c2 = await browser.newContext();
    try {
      const a = await c1.newPage(); const b = await c2.newPage();
      await a.goto(demo({ provider: 'http', url: srv.url, code, adminKey: ADMIN, autoconnect: '1', ...extra }));
      await b.goto(demo({ provider: 'http', url: srv.url, code, autoconnect: '1', ...extra }));
      await ready(a); await ready(b);
      assert.match(await a.textContent('#mode'), expectMode);
      await ask(a, `${label} 질문`);
      await seeQuestion(b, `${label} 질문`);
      await b.fill('#nickname', '공감러'); await b.click('#btn-join');
      await b.waitForFunction(() => document.getElementById('me').textContent !== '-');
      await b.click(`#questions li:has-text("${label} 질문") button`);
      await a.waitForSelector(`#questions li:has-text("${label} 질문") .m:has-text("공감 1")`, { timeout: 8000 });
      await a.fill('#notice', `${label} 공지`); await a.click('#btn-state');
      await b.waitForFunction((t) => document.getElementById('state').textContent.includes(t), `${label} 공지`, { timeout: 8000 });
    } finally { await c1.close(); await c2.close(); }
  });
}

test('browser: http adapter falls back to SSE when WebSockets are blocked', { skip }, async () => {
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    await page.routeWebSocket(/\/ws$/, (ws) => ws.close()); // a school proxy that kills WebSockets
    await page.goto(demo({ provider: 'http', url: srv.url, code: 'PWBLOCK', autoconnect: '1' }));
    await ready(page);
    assert.match(await page.textContent('#mode'), /realtime \(sse\)/);
  } finally { await ctx.close(); }
});

test('browser: writes made offline are queued and delivered after reconnect', { skip }, async () => {
  const code = 'PWQ' + Math.random().toString(36).slice(2, 7).toUpperCase();
  const c1 = await browser.newContext(); const c2 = await browser.newContext();
  try {
    const a = await c1.newPage(); const b = await c2.newPage();
    const q = { provider: 'http', url: srv.url, code, autoconnect: '1', transports: 'poll', pollMs: '2000' };
    await a.goto(demo(q)); await b.goto(demo(q));
    await ready(a); await ready(b);
    await a.fill('#nickname', '오프라인'); await a.click('#btn-join');
    await a.waitForFunction(() => document.getElementById('me').textContent !== '-');
    await c1.setOffline(true);
    await a.fill('#question', '끊겼을 때 쓴 질문'); await a.click('#btn-ask');
    await a.waitForSelector('#questions li:has-text("끊겼을 때 쓴 질문") .m:has-text("보내는 중")', { timeout: 15000 });
    assert.equal(await a.textContent('#queue'), '1');
    await c1.setOffline(false);
    await seeQuestion(b, '끊겼을 때 쓴 질문', 30000);
    await a.waitForFunction(() => document.getElementById('queue').textContent === '0', null, { timeout: 15000 });
    const texts = await b.$$eval('#questions li .t', (els) => els.map((e) => e.textContent));
    assert.equal(texts.filter((t) => t === '끊겼을 때 쓴 질문').length, 1, 'delivered exactly once');
  } finally { await c1.close(); await c2.close(); }
});

// Optional: the same two-device check against the Cloudflare Worker (wrangler dev), cross-origin.
const CF = process.env.LEC_CF_URL;
test('browser: http adapter against the Cloudflare Worker (WebSocket Hibernation)', { skip: skip || (!CF && 'LEC_CF_URL not set') }, async () => {
  const code = 'PWCF' + Math.random().toString(36).slice(2, 7).toUpperCase();
  const c1 = await browser.newContext(); const c2 = await browser.newContext();
  try {
    const a = await c1.newPage(); const b = await c2.newPage();
    await a.goto(demo({ provider: 'http', url: CF, code, adminKey: process.env.LEC_CF_ADMIN || '', autoconnect: '1' }));
    await b.goto(demo({ provider: 'http', url: CF, code, autoconnect: '1' }));
    await ready(a); await ready(b);
    assert.match(await b.textContent('#mode'), /realtime \(ws\)/);
    await ask(a, '워커로 보낸 질문');
    await seeQuestion(b, '워커로 보낸 질문');
    await a.fill('#notice', '워커 공지'); await a.click('#btn-state');
    await b.waitForFunction(() => document.getElementById('state').textContent.includes('워커 공지'), null, { timeout: 8000 });
  } finally { await c1.close(); await c2.close(); }
});
