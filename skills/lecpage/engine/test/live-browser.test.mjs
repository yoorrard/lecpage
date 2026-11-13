// Browser smoke tests for the live adapters (Playwright + Chromium).
// Two pages with the 'local' adapter (same browser) and two separate browser contexts with the 'http' adapter
// against the Node server; a question posted on one page must appear on the other.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
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

test('browser (④): photos are drawn again before upload — no EXIF GPS, long side 1600; PNG metadata chunks cut, pixels kept', { skip }, async () => {
  const code = 'PWUP' + Math.random().toString(36).slice(2, 7).toUpperCase();
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    await page.goto(demo({ provider: 'http', url: srv.url, code, autoconnect: '1' }));
    await ready(page);
    const out = await page.evaluate(async () => {
      const live = LecLive.current();
      await live.join({ nickname: '사진' });
      const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#3a7'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(10, 10, w / 3, h / 3); return c; };
      const blobOf = (c, type) => new Promise((r) => c.toBlob(r, type, 0.95));
      const bytes = async (b) => new Uint8Array(await b.arrayBuffer());
      const gps = new TextEncoder().encode('Exif\0\0MM\0*GPSLatitude=37.5665N;GPSLongitude=126.9780E');
      // a 3000×2000 JPEG with an APP1 Exif segment right after SOI
      const jpg = await bytes(await blobOf(canvas(3000, 2000), 'image/jpeg'));
      const seg = new Uint8Array([0xff, 0xe1, (gps.length + 2) >> 8, (gps.length + 2) & 255]);
      const withExif = new Blob([jpg.subarray(0, 2), seg, gps, jpg.subarray(2)], { type: 'image/jpeg' });
      const up1 = await live.upload(new File([withExif], 'IMG_0001.jpg', { type: 'image/jpeg' }));
      // a 1200×800 PNG with a tEXt chunk
      const png = await bytes(await blobOf(canvas(1200, 800), 'image/png'));
      const txt = new TextEncoder().encode('tEXtComment\0GPSLatitude=37.5665N');
      const len = txt.length - 4; const chunk = new Uint8Array(12 + len);
      chunk.set([len >>> 24, (len >> 16) & 255, (len >> 8) & 255, len & 255], 0); chunk.set(txt, 4);
      const withText = new Blob([png.subarray(0, 33), chunk, png.subarray(33)], { type: 'image/png' });
      const up2 = await live.upload(new File([withText], 'diagram.png', { type: 'image/png' }));
      return { up1, up2, txtIn: new TextDecoder('latin1').decode(await bytes(withText)).includes('GPSLatitude') };
    });
    // uploads are served only once a post uses them: read what the server stored instead
    const stored = (u) => fs.readFileSync(path.join(srv.dataDir, 'uploads', code, u.split('/').pop()));
    const j = stored(out.up1.url);
    assert.equal(out.up1.type, 'image/jpeg'); assert.ok(!j.includes(Buffer.from('GPSLatitude')), 'no GPS in the stored photo');
    assert.ok(j.length < 400 * 1024, 'a few hundred KB at most: ' + j.length);
    // JPEG size from the SOF0 marker
    let i = 2, w = 0, h = 0; while (i < j.length) { if (j[i] !== 0xff) { i++; continue; } const m = j[i + 1]; if (m >= 0xc0 && m <= 0xc2) { h = j.readUInt16BE(i + 5); w = j.readUInt16BE(i + 7); break; } i += 2 + j.readUInt16BE(i + 2); }
    assert.deepEqual([w, h], [1600, 1067]);
    assert.ok(out.txtIn);
    const p = stored(out.up2.url);
    assert.equal(out.up2.type, 'image/png'); assert.ok(!p.includes(Buffer.from('GPSLatitude')), 'PNG text chunk removed');
    assert.deepEqual([p.readUInt32BE(16), p.readUInt32BE(20)], [1200, 800], 'PNG pixels as they were');
  } finally { await ctx.close(); }
});

test('browser (결함 3): a server that goes down shows offline; when it is back the page returns to WebSocket', { skip }, async () => {
  const s1 = await startNodeServer({ adminKey: ADMIN, staticDir: liveDir });
  const port = s1.port; const url = `http://127.0.0.1:${port}`;
  const ctx = await browser.newContext(); let s2 = null;
  try {
    const page = await ctx.newPage();
    await page.goto(`${srv.url}/demo.html?${new URLSearchParams({ provider: 'http', url, code: 'PWDOWN', autoconnect: '1' })}`);
    await ready(page);
    assert.match(await page.textContent('#mode'), /realtime \(ws\)/);
    await s1.close();
    await page.waitForFunction(() => document.getElementById('status').textContent === 'offline', null, { timeout: 20000 });
    s2 = await startNodeServer({ adminKey: ADMIN, port });
    await page.waitForFunction(() => document.getElementById('status').textContent === 'live', null, { timeout: 70000 });
    assert.equal(await page.evaluate(() => LecLive.current()._adapter.transport()), 'ws', 'back on WebSocket, not stuck polling');
  } finally { await ctx.close(); await s2?.close(); }
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
