// 연수 당일 참가자 화면(키트 사이트): 입실 창(이름·소속·동의만, 별명 없음), 투표·질문은 창 없이,
// 열어 둔 화면이 시작·끝 시각을 지나면 단계가 저절로 바뀌고, 출석·도크·'지금' 줄은 끝 시각 뒤 2시간까지 그대로 두었다가 내림(끝 시각을 넘겨 이어지는 강의),
// 퇴실도 입실과 같은 창을 거침(이름 없는 출석 기록이 생기지 않게), 새로 고침해도 입실 기록이 보임. 실제 Node 서버(http 방식)와 브라우저로.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import * as E from '../src/index.js';
import { nodeRuntime, writeFiles } from '../node.js';
import { startNodeServer, api } from './live-helpers.mjs';
import { tinySite } from './kit-site.mjs';

const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require('playwright')); } catch { try { ({ chromium } = createRequire('/opt/node-tools/')('playwright')); } catch { /* 없음 */ } }
const skip = !chromium && 'playwright is not installed';

let srv, browser, site;
const SITE = tinySite('<section><h2>출석</h2><div data-lp="attend"></div></section><section><h2>질문</h2><div data-lp="qa"></div></section><section><h2>투표</h2><div data-lp="poll" data-id="w" data-kind="word" data-question="한 낱말로?"></div></section>');
const META = { v: 2, title: '생성형 AI로 수업 자료 만들기', sessions: [{ date: '2026-11-20', start: '14:00', end: '17:00' }], venue: '새봄중학교 3층 컴퓨터실', admin: { kind: 'official', completionRate: 90, hours: 3 }, features: ['qa', 'poll', 'attendance'] };
const PREV = (url) => ({ live: { provider: 'http', url, code: 'ATTPHASE' }, privacy: { collect: ['nickname', 'name', 'school'], consent: true, retentionDays: 30 } });
const ADMIN = '출석-시험용-관리자키-31';
before(async () => {
  if (skip) return;
  site = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-att-'));
  srv = await startNodeServer({ adminKey: ADMIN, staticDir: site });
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
/** 떠 있는 부품(position: fixed — offsetParent가 없음)이 보이는지 */
const shown = (page, sel) => page.evaluate((s) => { const n = document.querySelector(s); if (!n || n.hidden) return false; const c = getComputedStyle(n), r = n.getBoundingClientRect(); return c.display !== 'none' && c.visibility !== 'hidden' && r.width > 0 && r.height > 0; }, sel);
/** 입실 창에 이름·소속(직무연수라 꼭 적음)을 적고 동의한 뒤 누름 */
async function fillJoin(p, name) {
  const dlg = p.locator('[data-join-dialog][open]'); await dlg.waitFor();
  await dlg.locator('input[name=name]').fill(name); await dlg.locator('input[name=school]').fill('새봄중학교');
  await dlg.locator('input[name=consent]').check(); await dlg.locator('[data-join-go]').click();
  return dlg;
}

test('열어 둔 화면도 시각이 지나면 단계가 바뀜(시작 전 → 진행 중 → 끝남). 출석 단추·도크는 끝 시각 뒤 2시간까지 두었다가 내림', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  try {
    const p = await open(ctx, '13:10');
    assert.equal(await p.getAttribute('html', 'data-phase'), 'before');
    // 14:01: 새로 고침하지 않아도 '진행 중'으로
    await p.clock.fastForward('51:00'); await p.clock.runFor(31000);
    assert.equal(await p.getAttribute('html', 'data-phase'), 'during');
    assert.equal(await vis(p, '[data-attend="in"]'), true);
    // 17:01: 단계는 '끝남'(연수 후 안내는 이때 바뀜)이지만 출석 단추·도크는 그대로 — 강의가 끝 시각을 넘겨 이어질 수 있음
    await p.clock.fastForward('03:00:00'); await p.clock.runFor(31000);
    assert.equal(await p.getAttribute('html', 'data-phase'), 'after');
    assert.equal(await p.getAttribute('html', 'data-lp-closed'), null);
    assert.equal(await vis(p, '[data-attend="in"]'), true, '끝 시각 직후에는 출석 단추가 그대로');
    assert.equal(await vis(p, '[data-attend="out"]'), true);
    assert.equal(await shown(p, '[data-dock]'), true, '도크도 그대로');
    assert.equal(await shown(p, '[data-dock-attend]'), true, '아직 입실하지 않았으면 도크의 [출석]도');
    assert.equal(await shown(p, '[data-phase-bar]'), false, "'종료' 줄은 아직");
    // 18:57: 끝 시각 + 1시간 57분 — 아직 그대로(앞에서 흘려보낸 31초들을 더해 17:02 → 18:57)
    await p.clock.fastForward('01:55:00'); await p.clock.runFor(31000);
    assert.equal(await vis(p, '[data-attend="out"]'), true);
    assert.equal(await p.getAttribute('html', 'data-lp-closed'), null);
    // 19:01: 끝 시각 + 2시간을 넘김 — 출석 단추·도크가 사라지고 까닭 한 줄과 '종료' 줄
    await p.clock.fastForward('03:00'); await p.clock.runFor(31000);
    assert.equal(await p.getAttribute('html', 'data-lp-closed'), '');
    assert.equal(await vis(p, '[data-attend="in"]'), false);
    assert.equal(await vis(p, '[data-attend="out"]'), false);
    assert.equal(await p.locator('.lp-attend [data-phase-show="after"]').isVisible(), true, '끝난 연수라 출석은 받지 않는다는 한 줄');
    assert.equal(await shown(p, '[data-dock]'), false, '끝난 연수(끝 시각 + 2시간 뒤)에는 도크를 내림');
    assert.equal(await shown(p, '[data-phase-bar]'), true, "'종료' 줄");
    // 2시간이 지난 뒤에 연 화면도 같은 모습
    const late = await open(ctx, '19:30');
    assert.equal(await late.getAttribute('html', 'data-lp-closed'), '');
    assert.equal(await vis(late, '[data-attend="out"]'), false);
    assert.equal(await shown(late, '[data-dock]'), false);
    // 미리 보기(?phase=after)는 바로 끝난 모습
    const pv = await ctx.newPage(); await pv.goto(srv.url + '/index.html?phase=after'); await pv.waitForSelector('html[data-lp-closed]');
    assert.equal(await vis(pv, '[data-attend="in"]'), false);
    assert.deepEqual(p._errs, []); assert.deepEqual(late._errs, []);
  } finally { await ctx.close(); }
});

test('끝 시각을 넘겨 진행하는 강의(16:59:40 → 17:00:20): 공지·타이머·열린 투표·출석 단추·도크가 사라지지 않고 [퇴실 확인]이 됨', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  const A = api(srv.url, 'ATTPHASE');
  try {
    const p = await open(ctx, '16:59');
    await p.click('[data-attend="in"]'); await fillJoin(p, '끝나고도 남은 사람');
    await p.waitForFunction(() => /입실 확인/.test(document.querySelector('[data-attend-state]')?.textContent || ''));
    // 강사: 공지 + 5분 타이머 + 투표 열기
    const put = await A.call('PUT', '/state', { admin: ADMIN, body: { notice: { text: '5분만 더 할게요. 끝나면 퇴실 확인을 눌러 주세요.', level: 'info' }, timer: { endsAt: Date.now() + 5 * 60000, label: '', running: true }, openPoll: 'w' } });
    assert.equal(put.status, 200, JSON.stringify(put.body));
    const bandOk = () => { const n = document.querySelector('[data-now]'), t = n && n.querySelector('[data-timer]'); return !!n && !n.hidden && /5분만 더 할게요/.test(n.textContent) && !!t && !t.hidden && /\d:\d\d/.test(t.textContent); };
    await p.waitForFunction(bandOk, null, { timeout: 10000 });
    assert.equal(await p.locator('[data-poll-live] input').count(), 1, '열린 투표(낱말)');
    // 16:59 → 17:00:20 무렵: 끝 시각을 넘김(단계 확인은 30초마다 — 31초를 더 흘려 그 확인이 한 번 돌게)
    await p.clock.fastForward('01:20'); await p.clock.runFor(31000);
    assert.equal(await p.getAttribute('html', 'data-phase'), 'after', '단계는 끝남');
    assert.equal(await p.evaluate(bandOk), true, "'지금' 줄의 공지·타이머가 그대로");
    assert.equal(await vis(p, '[data-attend="out"]'), true, '[퇴실 확인]이 그대로');
    assert.equal(await shown(p, '[data-dock]'), true, '참여 막대가 그대로');
    assert.equal(await shown(p, '[data-phase-bar]'), false, "'종료' 줄은 뜨지 않음");
    assert.equal(await p.locator('.lp-attend [data-phase-show="after"]').isVisible(), false, "'끝난 연수라 출석은 받지 않아요'는 뜨지 않음");
    assert.equal(await p.locator('[data-poll-live] input').count(), 1, '투표도 그대로');
    // 퇴실: 창 없이(이미 이름으로 입실) 기록
    await p.click('[data-attend="out"]');
    await p.waitForFunction(() => /퇴실 확인/.test(document.querySelector('[data-attend-state]')?.textContent || ''), null, { timeout: 10000 });
    const who = (await A.call('GET', '/participants', { admin: ADMIN })).body.find((x) => x.name === '끝나고도 남은 사람');
    const att = (await A.call('GET', '/attendance', { admin: ADMIN })).body.filter((x) => x.by === who.id).map((x) => x.kind).sort();
    assert.deepEqual(att, ['in', 'out'], '입실·퇴실이 그 이름으로 서버에');
    assert.deepEqual(p._errs, []);
  } finally { await A.call('PUT', '/state', { admin: ADMIN, body: { notice: null, timer: null, openPoll: null } }); await ctx.close(); }
});

test('퇴실: 입실하지 않은 사람이 [퇴실 확인]을 누르면 입실과 같은 창 — [나중에]면 아무것도 적지 않고(알림도 없음), 적으면 그 이름으로 기록됨. 가로로 든 휴대폰에서도 단추가 보임', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: true, hasTouch: true });
  const A = api(srv.url, 'ATTPHASE');
  try {
    const before = (await A.call('GET', '/participants', { admin: ADMIN })).body.length;
    const p = await open(ctx, '16:30');
    await p.click('[data-attend="out"]');
    const dlg = p.locator('[data-join-dialog][open]'); await dlg.waitFor();
    assert.equal(await dlg.locator('[data-join-go]').textContent(), '퇴실');
    assert.match(await dlg.locator('[data-join-lead]').textContent(), /퇴실 확인에 쓸 이름·소속/);
    // 844×390: 창 안은 스크롤되고 단추 줄은 늘 화면 안(전에는 [나중에]·[입실]이 화면 아래로 잘림)
    const box = await p.evaluate(() => {
      const d = document.querySelector('[data-join-dialog]'), go = d.querySelector('[data-join-go]'), no = d.querySelector('[data-join-cancel]');
      const r = go.getBoundingClientRect(), c = no.getBoundingClientRect();
      const hit = (q) => document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
      return { vh: innerHeight, goBottom: r.bottom, noBottom: c.bottom, goHit: hit(r) === go, noHit: hit(c) === no, scrolls: d.scrollHeight > d.clientHeight };
    });
    assert.ok(box.goBottom <= box.vh && box.noBottom <= box.vh && box.goHit && box.noHit, '단추 줄이 화면 안에서 눌림: ' + JSON.stringify(box));
    // [나중에]: 아무것도 적지 않음
    await dlg.locator('[data-join-cancel]').click();
    await p.clock.runFor(1500);
    assert.equal((await p.textContent('[data-toast]')).trim(), '', "'퇴실을 확인했어요' 같은 알림이 없음");
    assert.equal((await p.textContent('[data-attend-state]')).trim(), '');
    assert.equal(await p.evaluate(() => localStorage.getItem('lp-ATTPHASE:me')), null, '참여하지 않음');
    assert.equal((await A.call('GET', '/participants', { admin: ADMIN })).body.length, before, "서버에 이름 없는 '참가자NNN'이 생기지 않음");
    // 이름을 적으면 그 이름으로 퇴실
    await p.click('[data-attend="out"]'); await fillJoin(p, '퇴실만 누른 사람');
    await p.waitForFunction(() => /퇴실 확인/.test(document.querySelector('[data-attend-state]')?.textContent || ''), null, { timeout: 10000 }).catch(async (e) => {
      throw new Error(e.message.split('\n')[0] + ' — ' + JSON.stringify(await p.evaluate(() => ({ open: document.querySelector('[data-join-dialog]').open, err: document.querySelector('[data-join-err]').textContent, toast: document.querySelector('[data-toast]').textContent, dot: document.querySelector('[data-live-status]')?.getAttribute('data-state'), phase: document.documentElement.getAttribute('data-phase') }))));
    });
    const all = (await A.call('GET', '/participants', { admin: ADMIN })).body;
    assert.equal(all.length, before + 1);
    const who = all.find((x) => x.name === '퇴실만 누른 사람'); assert.ok(who && who.consentAt, '이름·동의가 함께');
    assert.deepEqual((await A.call('GET', '/attendance', { admin: ADMIN })).body.filter((x) => x.by === who.id).map((x) => x.kind), ['out']);
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
