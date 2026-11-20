// 연수 당일 참가자 화면(키트 사이트): 입실 창(이름·소속·동의만, 별명 없음), 투표·질문은 창 없이,
// 열어 둔 화면이 시작·끝 시각을 지나면 단계가 저절로 바뀌고 끝나면 출석·도크를 내림, 새로 고침해도 입실 기록이 보임. 실제 Node 서버(http 방식)와 브라우저로.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import * as E from '../src/index.js';
import { nodeRuntime, writeFiles } from '../node.js';
import { startNodeServer } from './live-helpers.mjs';
import { tinySite } from './kit-site.mjs';

const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require('playwright')); } catch { try { ({ chromium } = createRequire('/opt/node-tools/')('playwright')); } catch { /* 없음 */ } }
const skip = !chromium && 'playwright is not installed';

let srv, browser, site;
const SITE = tinySite('<section><h2>출석</h2><div data-lp="attend"></div></section><section><h2>질문</h2><div data-lp="qa"></div></section><section><h2>투표</h2><div data-lp="poll" data-id="w" data-kind="word" data-question="한 낱말로?"></div></section>');
const META = { v: 2, title: '생성형 AI로 수업 자료 만들기', sessions: [{ date: '2026-11-20', start: '14:00', end: '17:00' }], venue: '새봄중학교 3층 컴퓨터실', admin: { kind: 'official', completionRate: 90, hours: 3 }, features: ['qa', 'poll', 'attendance'] };
const PREV = (url) => ({ live: { provider: 'http', url, code: 'ATTPHASE' }, privacy: { collect: ['nickname', 'name', 'school'], consent: true, retentionDays: 30 } });
before(async () => {
  if (skip) return;
  site = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-att-'));
  srv = await startNodeServer({ adminKey: '출석-시험용-관리자키-31', staticDir: site });
  const r = E.assemble(SITE, META, { runtime: nodeRuntime(), prev: PREV(srv.url) });
  assert.deepEqual(r.errors, []);
  writeFiles(site, r.files);
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); await srv?.close(); if (site) fs.rmSync(site, { recursive: true, force: true }); });

const at = (hm) => new Date(`2026-11-20T${hm}:00+09:00`);
async function open(ctx, time) {
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page._errs = errs;
  await page.clock.install({ time: at(time) });
  await page.goto(srv.url + '/index.html');
  await page.waitForSelector('html[data-phase]');
  return page;
}
const vis = (page, sel) => page.evaluate((s) => { const n = document.querySelector(s); return !!n && !n.hidden && !!n.offsetParent; }, sel);

test('열어 둔 화면도 시각이 지나면 단계가 바뀜(시작 전 → 진행 중 → 끝남), 끝나면 출석 단추·도크를 내림', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  try {
    const p = await open(ctx, '13:10');
    assert.equal(await p.getAttribute('html', 'data-phase'), 'before');
    // 14:01: 새로 고침하지 않아도 '진행 중'으로
    await p.clock.fastForward('51:00'); await p.clock.runFor(31000);
    assert.equal(await p.getAttribute('html', 'data-phase'), 'during');
    assert.equal(await vis(p, '[data-attend="in"]'), true);
    // 17:01: 끝난 연수로 — 출석 단추·도크가 사라지고 까닭 한 줄
    await p.clock.fastForward('03:00:00'); await p.clock.runFor(31000);
    assert.equal(await p.getAttribute('html', 'data-phase'), 'after');
    assert.equal(await vis(p, '[data-attend="in"]'), false);
    assert.equal(await vis(p, '[data-dock]'), false, '끝난 연수에는 도크를 내림');
    assert.deepEqual(p._errs, []);
  } finally { await ctx.close(); }
});

test('입실: [입실] → 이름·소속·동의만(별명 칸 없음) → 기록, 새로 고침해도 입실 시각이 보임', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  try {
    const p = await open(ctx, '14:02');
    await p.click('[data-attend="in"]');
    const dlg = p.locator('[data-join-dialog][open]');
    await dlg.waitFor();
    assert.equal(await dlg.locator('[data-join-nick]').isVisible(), false, '입실 창에 별명 칸 없음');
    assert.equal(await dlg.locator('input[name=name]').isVisible(), true);
    assert.equal(await dlg.locator('[data-join-go]').textContent(), '입실');
    assert.match(await dlg.locator('[data-join-lead]').textContent(), /이름·소속/);
    await dlg.locator('input[name=name]').fill('한지우');
    await dlg.locator('input[name=school]').fill('새봄중학교');
    await dlg.locator('input[name=consent]').check();
    await dlg.locator('[data-join-go]').click();
    await p.waitForFunction(() => /입실 확인/.test(document.querySelector('[data-attend-state]')?.textContent || ''));
    const me = await p.evaluate(() => JSON.parse(localStorage.getItem('lp-ATTPHASE:me')));
    assert.ok(me.named && me.auto && /^참가자\d+$/.test(me.nickname), '이름은 출석에만, 남에게 보이는 별명은 자동: ' + JSON.stringify(me));
    await p.reload(); await p.waitForSelector('html[data-phase]');
    assert.match(await p.textContent('[data-attend-state]'), /입실 확인/, '새로 고침해도 입실 기록이 보임');
    assert.equal(await p.getAttribute('[data-attend="in"]', 'aria-pressed'), 'true');
    assert.deepEqual(p._errs, []);
  } finally { await ctx.close(); }
});

test('질문은 별명 창 없이 바로 올라감(서버가 참가자 번호로 한 사람을 가림)', { skip }, async () => {
  const ctx = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  try {
    const p = await open(ctx, '14:30');
    await p.fill('[data-qa-form] textarea', '실습 파일은 어디에 있나요?');
    await p.click('[data-qa-form] [type=submit]');
    await p.waitForSelector('[data-qa-list] .lp-qa-item', { timeout: 10000 });
    assert.equal(await p.locator('[data-join-dialog][open]').count(), 0, '질문 전에 별명 창이 뜨지 않음');
    assert.deepEqual(p._errs, []);
  } finally { await ctx.close(); }
});
