// 참여 기능 × 배포할 곳(live-hosts): 바로 배포가 아닌 곳에 배포할 때 참여 기능 안내와, 바로 배포 방을 다른 곳 사이트에 넣지 않는지.
// 앱은 VITE_PUBLISH_API=https://publish.mock.test 로 빌드한 것(BASE2, flow2와 같은 서버). 가짜 바로 배포 서버는 참여 기능 방까지 맡음(운영 서버처럼 info.live)
const L = require('./lib.js');
const H = require('./h2.js');
const OUT = process.env.SHOTS || L.OUT;
const BASE = process.env.BASE2 || 'http://localhost:6302/';
const ANSWER = '```html\n<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>참여 시험</title></head><body><main><section id="a" data-title="첫 화면"><h1>참여 시험</h1><div data-lp="qa"></div><div data-lp="poll" data-question="좋아요?" data-options=\'["네","아니요"]\'></div><div data-lp="attend"></div></section></main></body></html>\n```\n```lecpage.json\n{"v":2,"title":"참여 시험","sessions":[{"date":"2026-12-09","start":"14:00","end":"17:00"}],"features":["qa","poll","attendance"]}\n```';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const LIVE = 'https://publish.mock.test/live';
async function instantServer(ctx) {
  await ctx.route(/^https?:\/\/publish\.mock\.test/, async (r) => {
    const u = new URL(r.request().url()); const m = r.request().method();
    const json = (o, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(o) });
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    if (u.pathname === '/api/info') return json({ ok: true, v: 1, plan: 'free', accepting: true, view: 'pages', keepAlive: true, siteScripts: true, limits: { maxBytes: 30e6, maxFileBytes: 10e6, maxFiles: 400, days: 60 }, live: { url: LIVE, uploads: true } });
    if (u.pathname === '/api/sites' && m === 'POST') return json({ id: 'site1', key: 'k1', url: 'https://s-site1.example.pages.dev/', expiresAt: Date.now() + 60 * 864e5 });
    if (/\/deploys$/.test(u.pathname)) return json({ deploy: 'd1', missing: [] });
    if (/\/publish$/.test(u.pathname)) return json({ url: 'https://s-site1.example.pages.dev/', expiresAt: Date.now() + 60 * 864e5 });
    return json({ ok: true });
  });
}
async function run(b, width) {
  const tag = String(width);
  const ctx = await b.newContext({ viewport: { width, height: width < 600 ? 844 : 900 } });
  const st = await H.mockAll(ctx); await instantServer(ctx);
  const p = await ctx.newPage(); const errs = L.watch(p);
  await p.goto(BASE, { waitUntil: 'load' });
  await p.setInputFiles('.ld-hero input[type=file][multiple]', [L.FIX + '/workshop.pdf']);
  await L.aiReady(p);
  await L.makeWith(p, ANSWER); await p.click('.st-info button:has-text("이 정보가 맞아요")');
  await p.click('.head-tools button:has-text("배포하기")'); await p.waitForSelector('.publish', { timeout: 30000 }); await p.waitForTimeout(1200);
  // 1) 다른 곳(Vercel)을 고르면 그 자리에서 참여 기능 안내 + 할 일 셋
  L.ok(`[${tag}] no notice while 바로 배포 is picked`, await p.locator('.pub-live').count() === 0);
  await p.click('.pub-mode:has-text("다른 곳에 배포")'); await p.waitForTimeout(300);
  await p.click('.pub-opt:has-text("Vercel")'); await p.waitForTimeout(300);
  const note = await p.locator('.pub-live').innerText().catch(() => '');
  L.ok(`[${tag}] notice right under the host choice`, /Vercel에서는 참여 기능을 따로 연결해야 해요/.test(note) && /질문·투표·출석이 모이지 않아요/.test(note), note.replace(/\s+/g, ' ').slice(0, 80));
  L.ok(`[${tag}] three actions`, await p.locator('.pub-live button').count() === 3);
  L.ok(`[${tag}] checklist row says what is needed`, /Vercel에 배포하려면 연결해야 해요/.test(await p.locator('#live-setup .ready-s').innerText()));
  await p.locator('.pub-live').scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + `live-hosts-notice-${tag}.png` });
  // ZIP도 같은 안내
  await p.click('.pub-opt:has-text("ZIP 다운로드")'); await p.waitForTimeout(200);
  L.ok(`[${tag}] ZIP gets the notice too`, /ZIP으로 직접 올리면 참여 기능을/.test(await p.locator('.pub-live').innerText().catch(() => '')));
  // [바로 배포로 바꾸기] → 바로 배포(참여 기능 방까지)
  await p.click('.pub-live button:has-text("바로 배포로 바꾸기")'); await p.waitForTimeout(300);
  L.ok(`[${tag}] switched to 바로 배포`, await p.locator('.pub-mode-main.is-on').count() === 1 && await p.locator('.pub-live').count() === 0);
  await H.publish(p);
  await p.waitForSelector('.success .big-url', { timeout: 60000 });
  // 2) 바로 배포한 뒤 다른 곳(Vercel)에도: 바로 배포 방은 그곳에서 안 되므로 그렇게 알리고, 참여 기능 없이 올림
  await p.click('.sites button:has-text("다른 곳에도 배포")'); await p.waitForTimeout(400);
  await p.click('.pub-opt:has-text("Vercel")'); await p.waitForTimeout(300);
  L.ok(`[${tag}] instant room: notice says it works only on the instant site`, /Vercel 사이트에서는 참여 기능이 꺼져요/.test(await p.locator('.pub-live').innerText().catch(() => '')));
  await p.click('.pub-live button:has-text("참여 기능 없이 배포")');
  L.ok(`[${tag}] skip line with undo`, /없이 배포해요/.test(await p.locator('.pub-live-skip').innerText().catch(() => '')));
  await p.click('.publish .walk-b button:has-text("이미 가입했어요")').catch(() => { });
  await H.connect(p, 'vcp_FAKE_TOKEN_1234567890');
  await p.waitForSelector('.publish .conn-line', { timeout: 15000 });
  await p.fill('.publish .addr-name input', 'maum-class').catch(() => { });
  await H.publish(p);
  await p.waitForFunction(() => document.querySelectorAll('.sites li').length === 2, null, { timeout: 60000 });
  const index = String(st.site['index.html'] || '');
  L.ok(`[${tag}] Vercel site has no instant-room address`, index.length > 0 && !index.includes(LIVE) && !Object.values(st.site).some((v) => String(v).includes(LIVE)), `${index.length}B`);
  L.ok(`[${tag}] 대표 stays on 바로 배포 (it has participation)`, /s-site1\.example\.pages\.dev/.test(await p.locator('.success .big-url').innerText()));
  L.ok(`[${tag}] Vercel row tagged 참여 기능 없음 + note`, /참여 기능 없음/.test(await p.locator('.sites li:has-text("Vercel")').innerText()) && /대표 주소에서만/.test(await p.locator('.sites').innerText()));
  await p.locator('.sites').scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + `live-hosts-sites-${tag}.png` });
  // 3) 참여 기능 없는 곳을 대표로 바꾸려 하면 확인(기본은 그대로 두기)
  await p.click('.sites li:has-text("Vercel") button:has-text("대표 주소로 쓰기")');
  await p.waitForSelector('dialog[open]', { timeout: 5000 }).catch(() => { });
  L.ok(`[${tag}] confirm before making a site without participation the 대표`, /참여 기능이 없어요/.test(await p.locator('dialog[open] h2').innerText().catch(() => '')));
  await p.click('dialog[open] button:has-text("그대로 두기")');
  L.ok(`[${tag}] kept`, /s-site1\.example\.pages\.dev/.test(await p.locator('.success .big-url').innerText()));
  L.ok(`[${tag}] no page errors`, errs.length === 0, JSON.stringify(errs).slice(0, 200));
  await ctx.close();
}
// AI가 lecpage.json에 features를 적지 않아도(실제 AI 답이 대개 그럼) 사이트의 자리 표시(질문·투표·출석)를 보고 참여 기능을 켜서, 바로 배포에 방을 붙임
async function noFeatures(b) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await H.mockAll(ctx); await instantServer(ctx);
  const p = await ctx.newPage(); const errs = L.watch(p);
  await p.goto(BASE, { waitUntil: 'load' });
  await p.setInputFiles('.ld-hero input[type=file][multiple]', [L.FIX + '/workshop.pdf']);
  await L.aiReady(p);
  await L.makeWith(p, ANSWER.replace(',"features":["qa","poll","attendance"]', '')); await p.click('.st-info button:has-text("이 정보가 맞아요")');
  const pid = L.pidOf(p);
  await p.click('.head-tools button:has-text("배포하기")'); await p.waitForSelector('.publish', { timeout: 30000 }); await p.waitForTimeout(1200);
  const row = await p.locator('#live-setup .ready-s').innerText().catch(() => '');
  L.ok('[no features] placeholders turn participation on', !/꺼져 있어요/.test(row) && /질문 받기/.test(row) && /바로 배포하면 함께 켜져요/.test(row), row);
  await H.publish(p);
  await p.waitForSelector('.success .big-url', { timeout: 60000 });
  const pr = await L.readProject(p, pid);
  L.ok('[no features] 바로 배포 attached the instant room', pr?.meta?.live?.url === LIVE && pr?.meta?.live?.provider === 'http', JSON.stringify(pr?.meta?.live || {}).slice(0, 120));
  L.ok('[no features] no page errors', errs.length === 0, JSON.stringify(errs).slice(0, 200));
  await ctx.close();
}
(async () => {
  const b = await L.chromium.launch();
  try { for (const w of [1280, 390]) await run(b, w); await noFeatures(b); } catch (e) { console.log('SCRIPT ERROR', e.message); }
  await b.close();
})();
