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
import { titleLen } from '../src/render/hero.js';
import { startNodeServer, here, api, LAN_ARGS, viaLan } from './live-helpers.mjs';

const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require('playwright')); } catch { try { ({ chromium } = createRequire('/opt/node-tools/')('playwright')); } catch { /* 없음 */ } }
const skip = !chromium && 'playwright is not installed';
const ADMIN = '참여화면-시험용-관리자키-77';
const SEL = JSON.parse(fs.readFileSync(path.join(here, '../../examples/sel-story.blueprint.json'), 'utf8'));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const build = (mut = (b) => b) => { const bp = mut(structuredClone(SEL)); const r = E.build(bp, { runtime: nodeRuntime() }); assert.deepEqual(r.errors, []); return r.files; };

let srv, browser, site;
before(async () => {
  if (skip) return;
  site = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-live-ux-'));
  srv = await startNodeServer({ adminKey: ADMIN, staticDir: site });
  writeFiles(site, build((b) => { b.meta = { ...b.meta, date: today(), start: '00:00', end: '23:59' }; b.live = { provider: 'http', url: '', code: 'LIVEUX', features: ['qa', 'board', 'poll'] }; return b; }));
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

test('만든 파일: 긴 공식 연수명은 제목 글자 한 단계, 빈 강사 칸은 메뉴에서도 빠짐, 건너뛰기 링크가 본문에 초점, 달력 파일에 주소·알림', () => {
  const longName = '2026학년도 2학기 디지털 기반 교육혁신 역량 강화를 위한 초·중·고 교원 대상 생성형 인공지능 활용 수업 설계와 평가 혁신 실천 사례 나눔 직무연수(심화 과정)';
  const f = build((b) => { b.live = { provider: 'http', url: 'https://live.example.kr', code: 'FILES1', features: ['qa'] }; b.meta.title = longName; const h = b.sections.find((s) => s.type === 'hero'); if (h) h.title = longName; b.instructors = []; b.meta.siteUrl = 'https://lec.example.kr/sel/'; b.meta.date = '2026-12-01'; b.meta.start = '14:00'; return b; });
  assert.match(f['index.html'], /<h1 class="lp-h1[^"]*"[^>]*data-tlen="xlong"/);
  assert.deepEqual([titleLen('마음이 먼저 도착하는 교실'), titleLen('2026 초등 교원 디지털 역량 강화 직무연수 심화 과정 제2기 운영'), titleLen(longName)], ['', 'long', 'xlong']);
  assert.doesNotMatch(f['index.html'], /href="#instructor"/, '그려지지 않는 칸으로 가는 링크 없음');
  assert.match(f['index.html'], /<main id="main" tabindex="-1">/);
  const ics = f['assets/event.ics'];
  assert.match(ics, /\r\nURL:https:\/\/lec\.example\.kr\/sel\/\r\n/); assert.match(ics, /BEGIN:VALARM\r\nACTION:DISPLAY\r\n[\s\S]*TRIGGER:-PT30M/);
  assert.ok(ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75), '75바이트에서 접음');
  assert.match(f['assets/lecpage.css'], /@media print\{[^@]*main button[^{]*\{display:none!important\}/);
  assert.match(f['console.html'], /data-key-lost>키를 잃어버렸으면: [^<]*lecpage 앱의 \[내 연수\]/);
  const lan = build((b) => { b.live = { provider: 'http', url: '', code: 'KEYLAN', features: ['qa'] }; return b; });
  assert.match(lan['console.html'], /data-key-lost>키를 잃어버렸으면: 서버를 켠 컴퓨터의 data\/admin-key\.txt/);
  assert.doesNotMatch(f['index.html'], /data-big=/, '보통 연수는 그대로');
  const big = build((b) => { const d = b.sections.find((s) => s.type === 'deck'); d.slides = Array.from({ length: 220 }, (_, i) => ({ page: i + 1, title: `${i + 1}쪽`, text: '본문 글이 깁니다. '.repeat(30) })); return b; });
  assert.match(big['index.html'], /<html [^>]*data-big="1"/, '큰 연수는 화면 밖 칸 그리기를 미룸');
});
