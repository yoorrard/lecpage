// 쪽이 여럿인 사이트(실제 브라우저 + Node 서버):
//   ① 강사가 다른 쪽에 있는 투표를 열면 이 쪽의 '지금' 줄이 [투표하러 가기]로 알리고, 가면 그 투표가 바로 화면 안에 있음
//      (2026-11-24 실제 운영 실측: 첫 쪽 참가자는 다른 쪽의 퀴즈가 열린 것을 알 길이 없었음). 이 쪽의 투표·즉석 투표·한 쪽짜리 사이트는 그대로
//   ② 쪽을 옮길 때의 서버 요청: 웹소켓 연결 하나(HTTP 0번). 옮긴 뒤 화면(상태·'지금' 줄·내 응답)은 전과 같음
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { writeFiles } from '../node.js';
import { kitBuild, tinySite } from './kit-site.mjs';
import { startNodeServer, api } from './live-helpers.mjs';

const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require('playwright')); } catch { try { ({ chromium } = createRequire('/opt/node-tools/')('playwright')); } catch { /* 없음 */ } }
const skip = !chromium && 'playwright is not installed';
const ADMIN = '다른-쪽-투표-시험-관리자키-24'; const CODE = 'TWOPAGE';
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const P1 = '<p><a id="go" href="wrap.html">마무리</a></p><div data-lp="qa"></div><section id="s1"><h2>투표</h2><div data-lp="poll" data-id="p1" data-question="첫 투표" data-options=\'["가","나"]\'></div></section>';
const P2 = '<p><a id="back" href="index.html">처음</a></p><div style="height:1400px"></div><section id="s2"><h2>퀴즈</h2><div data-lp="poll" data-id="p2" data-question="마무리 퀴즈" data-options=\'["하나","둘","셋"]\'></div></section>';
const meta = { features: ['qa', 'poll'], sessions: [{ date: today, start: '00:00', end: '23:59' }] };
const build = (site, code) => kitBuild({ site, meta, prev: { live: { provider: 'http', url: '', code } }, today }).files;

let srv, browser, dir;
before(async () => {
  if (skip) return;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-two-page-'));
  const site = tinySite(P1); site['wrap.html'] = tinySite(P2)['index.html'];
  writeFiles(dir, build(site, CODE));
  writeFiles(path.join(dir, 'one'), build(tinySite(P1.replace('<p><a id="go" href="wrap.html">마무리</a></p>', '')), 'ONEPAGE'));
  srv = await startNodeServer({ adminKey: ADMIN, staticDir: dir });
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); await srv?.close(); if (dir) fs.rmSync(dir, { recursive: true, force: true }); });

const A = () => api(srv.url, CODE);
const put = (body) => A().call('PUT', '/state', { admin: ADMIN, body });
const band = (p) => p.evaluate(() => { const n = document.querySelector('[data-now]'); const a = n && n.querySelector('[data-now-cta]'); return { hidden: !n || n.hidden, main: (n?.querySelector('[data-now-main]')?.textContent || '').trim(), sub: (n?.querySelector('[data-now-sub]')?.textContent || '').trim(), cta: a && !a.hidden ? a.textContent.trim() : '', href: a && !a.hidden ? a.getAttribute('href') : '' }; });
const bandIs = (p, re, ms = 8000) => p.waitForFunction((src) => new RegExp(src).test(document.querySelector('[data-now-main]')?.textContent || ''), re.source, { timeout: ms });
/** 이 쪽이 서버에 보낸 것: /api/ HTTP 요청(이 PC 주소를 묻는 /api/lan은 뺌)과 웹소켓 연결 수 */
function counter(page) {
  const c = { http: [], ws: 0 };
  page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/') && u.pathname !== '/api/lan') c.http.push(r.method() + ' ' + u.pathname.replace(/^\/api\/[^/]+/, '')); });
  page.on('websocket', () => { c.ws++; });
  c.take = () => { const r = { http: c.http.slice(), ws: c.ws }; c.http.length = 0; c.ws = 0; return r; };
  return c;
}

test('다른 쪽에 있는 투표가 열리면 이 쪽의 지금 줄이 알리고, [투표하러 가기]로 가면 그 투표가 화면 안에 있다', { skip, timeout: 90000 }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(srv.url + '/index.html');
  // 조립: 쪽이 여럿이면 투표가 있는 쪽을 쪽마다 실음(정답·보기는 싣지 않음)
  const polls = await p.evaluate(() => JSON.parse(document.querySelector('#lp-data').textContent).polls);
  assert.deepEqual(polls, [{ id: 'p1', q: '첫 투표', page: 'index.html' }, { id: 'p2', q: '마무리 퀴즈', page: 'wrap.html' }]);
  // 이 쪽의 투표: 전과 같음
  await put({ openPoll: 'p1' }); await bandIs(p, /첫 투표/);
  let b = await band(p);
  assert.equal(b.main, '투표: 첫 투표'); assert.ok(b.cta === '' || b.cta === '투표하기', `이 쪽의 투표는 [투표하기]이거나(안 보일 때) 단추 없음(보일 때): ${b.cta}`);
  assert.ok(!/wrap\.html/.test(b.href || ''));
  // 다른 쪽의 투표
  const t0 = Date.now(); await put({ openPoll: 'p2' }); await bandIs(p, /마무리 퀴즈/);
  assert.ok(Date.now() - t0 < 3000, '열리면 바로 알림');
  b = await band(p);
  assert.equal(b.hidden, false); assert.equal(b.main, '투표: 마무리 퀴즈'); assert.equal(b.cta, '투표하러 가기'); assert.equal(b.href, 'wrap.html#lp-poll');
  await p.click('[data-now-cta]'); await p.waitForURL(/wrap\.html/);
  // 가면 열린 투표의 보기가 화면 안에 있고(쪽 아래 1400px에 있어도), 주소의 표시는 지워짐
  await p.waitForFunction(() => { const o = document.querySelector('[data-poll-live] input, [data-poll-live] button'); if (!o) return false; const r = o.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }, null, { timeout: 10000 });
  assert.equal(new URL(p.url()).hash, '');
  // 답하고 처음 쪽으로: 응답했다는 줄, 단추 없음(결과는 강사가 공개하면)
  await p.locator('[data-poll-live] label, [data-poll-live] button').first().click();
  const send = p.locator('[data-poll-live] button[type=submit], [data-poll-live] [data-poll-send]').first();
  if (await send.count()) await send.click().catch(() => { });
  await p.waitForFunction(() => /응답했어요/.test(document.querySelector('[data-now-sub]')?.textContent || '') || /응답했어요|보냈어요|답했어요/.test(document.querySelector('[data-poll-live]')?.textContent || ''), null, { timeout: 8000 });
  await p.click('#back'); await p.waitForURL(/index\.html/); await bandIs(p, /마무리 퀴즈/);
  b = await band(p);
  assert.match(b.sub, /응답했어요/); assert.equal(b.cta, '', '답한 뒤에는 갈 단추를 두지 않음');
  await put({ openPoll: 'p2', revealed: { p2: true } });
  await p.waitForFunction(() => document.querySelector('[data-now-cta]') && !document.querySelector('[data-now-cta]').hidden, null, { timeout: 8000 }).catch(() => { });
  b = await band(p);
  if (b.cta) { assert.equal(b.cta, '결과 보기'); assert.equal(b.href, 'wrap.html#lp-poll'); }
  // 닫으면 줄에서 내려감
  await put({ openPoll: null }); await p.waitForFunction(() => !/마무리 퀴즈/.test(document.querySelector('[data-now-main]')?.textContent || ''), null, { timeout: 8000 });
  assert.deepEqual(errs, []);
  await ctx.close();
});

test('한 쪽짜리 사이트는 그대로다: 투표 목록을 싣지 않고, 열린 투표는 전처럼 그 자리에', { skip, timeout: 60000 }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(srv.url + '/one/index.html');
  assert.equal(await p.evaluate(() => 'polls' in JSON.parse(document.querySelector('#lp-data').textContent)), false);
  await api(srv.url, 'ONEPAGE').call('PUT', '/state', { admin: ADMIN, body: { openPoll: 'p1' } });
  await bandIs(p, /첫 투표/);
  assert.equal((await band(p)).main, '투표: 첫 투표');
  assert.deepEqual(errs, []);
  await ctx.close();
});

test('서버 요청 수: 처음 접속은 상태 확인 하나 + 소켓 하나, 쪽을 옮기면 소켓 하나뿐. 옮긴 뒤 화면은 전과 같다', { skip, timeout: 90000 }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e))); const c = counter(p);
  await put({ openPoll: 'p1', slide: 0 });
  await p.goto(srv.url + '/index.html'); await bandIs(p, /첫 투표/); await p.waitForTimeout(1500);
  const first = c.take();
  assert.deepEqual(first.http, ['GET /state'], `처음 접속의 HTTP 요청(${first.http})`); assert.equal(first.ws, 1);
  // 쪽 이동
  await p.click('#go'); await p.waitForURL(/wrap\.html/); await bandIs(p, /첫 투표/); await p.waitForTimeout(1500);
  const nav = c.take();
  assert.deepEqual(nav.http, [], `쪽 이동의 HTTP 요청은 0번(${nav.http})`); assert.equal(nav.ws, 1, '소켓 연결 하나');
  // 옮긴 쪽에서도 열린 투표(처음 쪽의 것)를 알림
  let b = await band(p);
  assert.equal(b.main, '투표: 첫 투표'); assert.equal(b.cta, '투표하러 가기'); assert.equal(b.href, 'index.html#lp-poll');
  // 실시간: 강사가 바꾸면 바로
  const t0 = Date.now(); await put({ openPoll: 'p2' }); await bandIs(p, /마무리 퀴즈/, 4000);
  assert.ok(Date.now() - t0 < 2000, `바뀐 것은 바로 옴(${Date.now() - t0}ms)`);
  assert.deepEqual(c.take().http, [], '상태가 바뀌어도 따로 묻지 않음(소켓으로 옴)');
  // 돌아옴: 다시 소켓 하나
  await p.click('#back'); await p.waitForURL(/index\.html/); await bandIs(p, /마무리 퀴즈/); await p.waitForTimeout(1200);
  const back = c.take();
  assert.deepEqual(back.http, []); assert.equal(back.ws, 1);
  // 질문 올리기(쓰기)는 전처럼 HTTP 한 번씩
  await put({ openPoll: null });
  assert.deepEqual(errs, []);
  await ctx.close();
});
