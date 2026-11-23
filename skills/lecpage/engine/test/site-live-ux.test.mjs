// 강의 사이트(생성물) 참여 화면을 실제 브라우저로: 남의 응답이 와도 치던 낱말이 남는지, 질문 목록이 화면 읽기 알림을 쏟아내지 않는지,
// '지금' 띠(긴 공지·끝난 타이머·새 자료·답한 뒤), localhost로 연 발표 화면의 QR(같은 와이파이 주소 / 바꾸는 법).
// + 만든 파일만 보는 시험(긴 연수명 제목 단계, 빈 강사 칸 메뉴, 달력 파일, 인쇄, 관리자 키 분실 안내, 큰 연수 표시).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as E from '../src/index.js';
import { nodeRuntime, writeFiles } from '../node.js';
import { bpBuild } from './kit-site.mjs';
import { startNodeServer, here, api, LAN_ARGS, viaLan } from './live-helpers.mjs';

const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require('playwright')); } catch { try { ({ chromium } = createRequire('/opt/node-tools/')('playwright')); } catch { /* 없음 */ } }
const skip = !chromium && 'playwright is not installed';
const ADMIN = '참여화면-시험용-관리자키-77';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
/** 레퍼런스 사이트(data-lab)를 조립한 파일(kit-site.mjs) */
const build = (bp) => { const r = bpBuild(bp); assert.deepEqual(r.errors, []); return r.files; };

let srv, browser, site;
before(async () => {
  if (skip) return;
  site = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-live-ux-'));
  srv = await startNodeServer({ adminKey: ADMIN, staticDir: site });
  writeFiles(site, build({ meta: { date: today(), start: '00:00', end: '23:59' }, live: { provider: 'http', url: '', code: 'LIVEUX', features: ['qa', 'board', 'poll'] } }));
  browser = await chromium.launch({ args: LAN_ARGS });
});
after(async () => { await browser?.close(); await srv?.close(); if (site) fs.rmSync(site, { recursive: true, force: true }); });

const A = () => api(srv.url, 'LIVEUX');
const put = (body) => A().call('PUT', '/state', { admin: ADMIN, body });
async function phonePage() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); p._errs = []; p.on('pageerror', (e) => p._errs.push(String(e)));
  await p.goto(viaLan(srv.url) + '/'); await p.waitForFunction(() => document.querySelector('[data-live-status]')?.getAttribute('data-state') === 'live', null, { timeout: 15000 });
  return { ctx, p };
}
async function joinIfAsked(p, nick) { await p.waitForTimeout(400); if (await p.locator('[data-join-dialog][open]').count()) { await p.fill('[data-join-dialog] input[name=nickname]', nick); await p.click('[data-join-dialog] button[type=submit]'); await p.waitForTimeout(800); } }
const other = async (nick) => (await A().call('POST', '/join', { body: { nickname: nick } })).body.token;

test('워드클라우드: 낱말을 치는 동안 남의 응답이 와도 칸이 지워지지 않고, 답하면 결과 공개 뒤 같은 낱말을 함께 셈', { skip }, async () => {
  const { ctx, p } = await phonePage();
  try {
    await put({ openPoll: 'word', ui: { reveal: null } });
    await p.waitForSelector('[data-poll-live] input');
    await p.click('[data-poll-live] input'); await p.keyboard.type('맑');
    for (const [n, v] of [['끼어든 사람', '흐림'], ['또 끼어든 사람', '맑 음']]) await A().call('POST', '/answers', { token: await other(n), body: { poll: 'word', value: v } });
    await p.waitForTimeout(1500);
    assert.equal(await p.inputValue('[data-poll-live] input'), '맑', '남의 응답에 지워지지 않음');
    assert.equal(await p.evaluate(() => document.activeElement?.tagName), 'INPUT', '초점도 그대로');
    await p.keyboard.type('음'); await p.click('[data-poll-live] button[type=submit]'); await joinIfAsked(p, '워드');
    await p.waitForSelector('[data-poll-live] .lp-note');
    // 공개 전에는 남의 값이 오지 않음(서버가 봉인), 공개하면 다시 받아 와 그림('맑 음'과 '맑음'은 같은 낱말)
    await put({ ui: { reveal: 'word' } });
    await p.waitForFunction(() => document.querySelectorAll('[data-poll-live] .lp-cloud span').length >= 2, null, { timeout: 10000 });
    const cloud = await p.evaluate(() => [...document.querySelectorAll('[data-poll-live] .lp-cloud span')].map((s) => [s.textContent, s.title]));
    assert.deepEqual(cloud.find((c) => c[0] === '맑음'), ['맑음', '2명']);
    assert.deepEqual(p._errs, []);
  } finally { await put({ openPoll: '', ui: { reveal: null } }); await ctx.close(); }
});

test('질문·보드 목록은 알림 영역이 아님: 남의 공감에 목록을 다시 읽지 않고, 새 글만 숨은 한 줄로 짧게 · 정렬·분류는 눌림 단추', { skip }, async () => {
  const { ctx, p } = await phonePage();
  try {
    assert.equal(await p.locator('[data-qa-list][aria-live], [data-board-list][aria-live]').count(), 0);
    assert.equal(await p.locator('.lp-tabs [role="tab"]').count(), 0);
    assert.deepEqual(await p.locator('[data-qa] .lp-tabs button').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-pressed'))), ['true', 'false']);
    const t = await other('묻는 사람');
    const q = (await A().call('POST', '/questions', { token: t, body: { text: '첫 질문', anonymous: true } })).body;
    await p.waitForFunction(() => document.querySelectorAll('[data-qa-list] > li[data-id]').length === 1, null, { timeout: 8000 });
    const node = await p.evaluateHandle(() => document.querySelector('[data-qa-list] > li[data-id]'));
    await p.evaluate(() => { window.__said = []; const live = [...document.querySelectorAll('[aria-live], [role="status"]')]; new MutationObserver((ms) => ms.forEach((m) => { const box = live.find((l) => l.contains(m.target)); if (box && box.textContent) window.__said.push(box.textContent); })).observe(document.body, { subtree: true, childList: true, characterData: true }); });
    const t2 = await other('공감하는 사람');
    await A().call('POST', `/questions/${q.id}/vote`, { token: t2 });
    await p.waitForFunction(() => document.querySelector('[data-qa-list] .lp-vote b')?.textContent === '1', null, { timeout: 8000 });
    assert.ok(await p.evaluate((n) => n.isConnected, node), '공감 수만 바꾸고 항목은 그대로(다시 만들지 않음)');
    await A().call('POST', '/questions', { token: t, body: { text: '둘째 질문', anonymous: true } });
    await p.waitForFunction(() => /^새 질문 [12]개$/.test(document.querySelector('[data-qa] [data-list-news]')?.textContent || ''), null, { timeout: 8000 });
    const said = await p.evaluate(() => window.__said);
    assert.ok(said.every((s) => s.length < 40), '긴 목록을 다시 읽지 않음: ' + JSON.stringify(said));
    assert.deepEqual(p._errs, []);
  } finally { await ctx.close(); }
});

test('보드 글쓰기 양식: 닫거나 올린 뒤 초점이 [글 올리기] 단추로 돌아감(숨겨진 양식에 남지 않음)', { skip }, async () => {
  const { ctx, p } = await phonePage();
  try {
    const act = () => p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'body' : a.hasAttribute('data-board-write') ? 'write' : a.tagName; });
    await p.focus('[data-board-write]'); await p.keyboard.press('Enter'); await joinIfAsked(p, '초점');
    await p.waitForSelector('[data-board-form]:not([hidden]) textarea');
    assert.equal(await act(), 'TEXTAREA', '열면 글 칸으로');
    await p.focus('[data-board-cancel]'); await p.keyboard.press('Enter');
    assert.equal(await p.locator('[data-board-form]').isHidden(), true); assert.equal(await act(), 'write', '닫은 뒤');
    await p.keyboard.press('Enter'); await p.waitForSelector('[data-board-form]:not([hidden]) textarea');
    await p.fill('[data-board-form] textarea', '초점이 돌아오는지 보는 글'); await p.focus('[data-board-form] button[type=submit]'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => /초점이 돌아오는지 보는 글/.test(document.querySelector('[data-board-list]').textContent), null, { timeout: 10000 });
    assert.equal(await p.locator('[data-board-form]').isHidden(), true); assert.equal(await act(), 'write', '올린 뒤');
    assert.deepEqual(p._errs, []);
  } finally { await ctx.close(); }
});

test("'지금' 띠: 긴 공지는 [더 보기]로 펼치고, 끝난 타이머는 '끝났어요' 뒤 사라지며, 연수 중에 더한 자료는 한 번 알림", { skip }, async () => {
  const { ctx, p } = await phonePage();
  try {
    const long = '점심은 본관 2층 학생식당에서 12시 10분부터 먹어요. 식권은 등록대에서 받아 주세요. 오후 순서는 1시 정각에 시청각실에서 다시 시작하고, 실습 노트북은 그대로 두고 가셔도 돼요.';
    await put({ notice: { text: long, level: 'info' } });
    await p.waitForSelector('[data-now-more]:not([hidden])', { timeout: 8000 });
    const clip = await p.evaluate(() => { const b = document.querySelector('[data-now-main]'); return b.scrollHeight > b.clientHeight + 2; });
    assert.ok(clip, '휴대폰에서는 두 줄로 잘림');
    await p.click('[data-now-more]');
    assert.ok(await p.evaluate(() => { const b = document.querySelector('[data-now-main]'); return b.scrollHeight <= b.clientHeight + 2; }), '펼치면 다 보임');
    assert.equal(await p.getAttribute('[data-now-more]', 'aria-expanded'), 'true');
    await put({ notice: null, timer: { endsAt: Date.now() + 1500, label: '토의', running: true } });
    await p.waitForFunction(() => document.querySelector('[data-timer]')?.textContent === '토의 끝났어요', null, { timeout: 8000 });
    await put({ timer: { endsAt: Date.now() - 100000, label: '토의', running: true } });
    await p.waitForFunction(() => document.querySelector('[data-timer]').hidden, null, { timeout: 8000 });
    await put({ timer: null, ui: { m1: 'https://example.com/sheet 실습 예시 시트' } });
    await p.waitForFunction(() => document.querySelector('[data-now-main]')?.textContent === '새 자료: 실습 예시 시트', null, { timeout: 8000 });
    assert.deepEqual(await p.evaluate(() => { const a = document.querySelector('[data-now-cta]'); return [a.textContent, a.getAttribute('href'), a.target, a.rel]; }), ['자료 열기', 'https://example.com/sheet', '_blank', 'noopener noreferrer']);
    const again = await ctx.newPage(); await again.goto(viaLan(srv.url) + '/'); await again.waitForTimeout(2500);
    assert.equal(await again.evaluate(() => document.querySelector('[data-now-main]').textContent), '', '처음부터 있던 자료는 띠에 올리지 않음');
    assert.deepEqual(p._errs, []);
  } finally { await put({ notice: null, timer: null, ui: { m1: null } }); await ctx.close(); }
});

test('localhost로 연 발표 화면: 같은 와이파이 주소를 알면 그 주소로 QR, 모르면 QR 대신 바꾸는 법', { skip }, async () => {
  const all = await startNodeServer({ adminKey: ADMIN, staticDir: site, host: '0.0.0.0' });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  try {
    const lan = (await (await fetch(`http://127.0.0.1:${all.port}/api/lan`)).json()).urls[0];
    const s = await ctx.newPage(); await s.goto(`http://127.0.0.1:${all.port}/screen.html`);
    if (lan) {
      await s.waitForFunction((u) => document.querySelector('[data-join-url]')?.textContent.includes(u), lan.replace(/^http:\/\//, '').replace(/\/$/, ''), { timeout: 8000 });
      assert.equal(await s.locator('[data-qr-join] svg').count(), 1);
    }
    const o = await ctx.newPage(); await o.goto(srv.url + '/screen.html'); await o.waitForTimeout(1500);
    assert.equal(await o.locator('[data-qr-join] svg').count(), 0, '127.0.0.1 QR은 만들지 않음');
    assert.match(await o.textContent('[data-qr-join]'), /이 컴퓨터에서만 열려요.*와이파이 주소/);
  } finally { await ctx.close(); await all.close(); }
});

test('만든 파일: 달력 파일에 주소·알림(75바이트에서 접음), 인쇄할 때 단추는 숨김, 강사 화면에 키를 잃어버렸을 때 길', () => {
  const f = build({ live: { provider: 'http', url: 'https://live.example.kr', code: 'FILES1', features: ['qa'] }, meta: { siteUrl: 'https://lec.example.kr/sel/' } });
  const ics = f['assets/event.ics'];
  assert.match(ics, /\r\nURL:https:\/\/lec\.example\.kr\/sel\/\r\n/); assert.match(ics, /BEGIN:VALARM\r\nACTION:DISPLAY\r\n[\s\S]*TRIGGER:-PT30M/);
  assert.ok(ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75), '75바이트에서 접음');
  assert.match(f['assets/lecpage.css'], /@media print\{[^@]*main button[^{]*\{display:none!important\}/);
  assert.match(f['console.html'], /data-key-lost>키를 잃어버렸으면: [^<]*lecpage 앱의 \[내 연수\]/);
  const lan = build({ live: { provider: 'http', url: '', code: 'KEYLAN', features: ['qa'] } });
  assert.match(lan['console.html'], /data-key-lost>키를 잃어버렸으면: 서버를 켠 컴퓨터의 data\/admin-key\.txt/);
});
