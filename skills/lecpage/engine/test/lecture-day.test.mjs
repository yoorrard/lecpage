// 강의 당일 점검(2026-11-24, 운영 서버에 올린 두 쪽 사이트를 참가자 휴대폰 넷·강사 화면·발표 화면으로 돌려 봄)에서 찾아 고친 것.
// 실제 Node 서버(http 방식)와 브라우저로:
//   · [강사 따라 넘기기]를 다시 켜면 바로 강사가 보는 쪽으로, 교재를 보고 있으면 '지금' 줄이 '교재 N쪽 [N쪽 보기]'를 또 말하지 않음
//   · 실습 진행: 다른 쪽의 [투표하러 가기]로 들어와 지나친 단계를 '하는 중'으로 적지 않고, 강사 화면은 사람 수로 셈(사람×단계가 아님)
//   · 강사 화면: 시작 전 한 줄이 발표 화면에 실제로 떠 있는 것과 맞고, 퇴실만 적힌 사람의 [입실]이 퇴실보다 늦은 입실을 적지 않음
//   · 배포한 곳이 body 끝에 붙이는 '신고' 줄이 참여 막대 밑에 깔리지 않음, 접속 확인·개인정보 안내가 320~360px에서 옆으로 넘치지 않음
// (끝 시각을 넘긴 강의·퇴실 창은 attend-phase, 쪽마다의 '지금' 줄은 kit-fixes, 긴 대기·조용히 죽은 망은 live-fewer-requests, 강사 화면이 참가자로 등록되지 않는 것은 live-server)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import * as E from '../src/index.js';
import { nodeRuntime, writeFiles } from '../node.js';
import { startNodeServer, api } from './live-helpers.mjs';
import { REF } from './kit-site.mjs';

const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require('playwright')); } catch { try { ({ chromium } = createRequire('/opt/node-tools/')('playwright')); } catch { /* 없음 */ } }
const skip = !chromium && 'playwright is not installed';

const ADMIN = '강의당일-시험용-관리자키-58';
const CODE = 'LECDAY';
const WEBP = fs.readFileSync(path.join(REF, 'site', 'material', 'p-001.webp'));
const PAGE = (title, body) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;font-family:sans-serif}main{padding:0 16px}.tall{min-height:900px}section{padding:24px 0}</style></head><body><header><nav><a href="index.html">오늘</a> <a href="practice.html">실습</a></nav></header><main>${body}</main><footer><p>강의 당일 시험</p></footer></body></html>`;
const SITE = {
  // 첫 화면이 길어 교재는 화면 아래에 있음(맨 위에서는 교재가 보이지 않음)
  'index.html': PAGE('강의 당일 시험', '<section class="tall"><h1>강의 당일 시험</h1><div data-lp="attend"></div></section><section id="deck"><h2>교재 슬라이드</h2><div data-lp="deck" data-pages="1-3"></div></section><section><h2>질문</h2><div data-lp="qa"></div></section><section><h2>투표</h2><div data-lp="poll" data-question="써 봤나요?" data-options=\'["네","아니요"]\'></div></section>'),
  'practice.html': PAGE('실습', '<section><h1>실습</h1></section><section class="tall" data-lp-step="s1" data-title="1단계: 프롬프트 쓰기"><h2>1단계: 프롬프트 쓰기</h2><p>써 봐요.</p></section><section class="tall" data-lp-step="s2" data-title="2단계: 다듬기"><h2>2단계: 다듬기</h2><p>고쳐요.</p></section><section id="quiz"><h2>퀴즈</h2><div data-lp="poll" data-question="아닌 것은?" data-options=\'["역할","분량 제한 없음"]\' data-answer="2"></div></section><section class="tall"><h2>끝</h2></section>'),
  'material/p-001.webp': WEBP, 'material/p-002.webp': WEBP, 'material/p-003.webp': WEBP,
};
const META = { v: 2, title: '강의 당일 시험', sessions: [{ date: '2026-11-24', start: '00:05', end: '23:55' }], features: ['qa', 'poll', 'attendance', 'help', 'progress', 'deck'] };
const KO = { locale: 'ko-KR', timezoneId: 'Asia/Seoul' };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...KO };

let srv, browser, site, A, pollIds;
before(async () => {
  if (skip) return;
  site = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-day-'));
  srv = await startNodeServer({ adminKey: ADMIN, staticDir: site });
  const r = E.assemble(SITE, META, { runtime: nodeRuntime(), prev: { live: { provider: 'http', url: srv.url, code: CODE }, privacy: { collect: ['nickname', 'name', 'school'], consent: true, retentionDays: 30 } }, today: '2026-11-24' });
  assert.deepEqual(r.errors, []);
  writeFiles(site, r.files);
  // 바로 배포가 하듯 body 끝에 '신고' 줄을 붙인 사본(hosting/src/rewrite.js reportLinkHtml의 바닥글 없는 꼴)
  const report = '<p data-host-report style="margin:0;padding:10px 16px;text-align:center;font:12px/1.4 system-ui,sans-serif"><style>@media print{[data-host-report]{display:none}}</style><a href="/report?site=x" rel="nofollow noopener" target="_blank" style="color:inherit">신고</a></p>';
  fs.writeFileSync(path.join(site, 'hosted.html'), String(r.files['index.html']).replace(/<\/body>/i, report + '</body>'));
  pollIds = [...String(r.files['practice.html']).matchAll(/&quot;id&quot;:&quot;([^&]+)&quot;/g)].map((m) => m[1]);
  A = api(srv.url, CODE);
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); await srv?.close(); if (site) fs.rmSync(site, { recursive: true, force: true }); });

const put = (body) => A.call('PUT', '/state', { admin: ADMIN, body });
const live = (p) => p.waitForFunction(() => /^(live|polling)$/.test(document.querySelector('[data-live-status]')?.getAttribute('data-state') || ''), null, { timeout: 15000 });
// 참가자 화면의 시계는 연수 날 낮에 맞춰 둠(attend-phase와 같은 방식 — 시간은 그 시각부터 평소처럼 흐름): 진짜 날짜를 그대로 쓰면
// 연수 날(2026-11-24) 끝 + 2시간이 지난 뒤로는 참여 막대·'지금' 줄이 닫혀 이 시험이 날짜 때문에 깨짐
const DAY_NOON = new Date('2026-11-24T10:00:00+09:00');
async function openPage(ctx, file = 'index.html') {
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p._errs = errs;
  await p.clock.install({ time: DAY_NOON });
  await p.goto(srv.url + '/' + file); await live(p);
  return p;
}
async function login(ctx) {
  const c = await ctx.newPage(); const errs = []; c.on('pageerror', (e) => errs.push(String(e))); c._errs = errs;
  await c.goto(srv.url + '/console.html'); await c.fill('#lp-key', ADMIN); await c.click('[data-key-go]');
  await c.waitForSelector('[data-console-main]:not([hidden])', { timeout: 20000 });
  return c;
}
/** '지금' 줄: 감춰져 있으면 '', 아니면 '글 | 단추' */
const band = (p) => p.evaluate(() => { const n = document.querySelector('[data-now]'); if (!n || n.hidden) return ''; const a = n.querySelector('[data-now-cta]'); return n.querySelector('[data-now-main]').textContent + ' | ' + (a.hidden ? '' : a.textContent); });
const cur = (p) => p.textContent('[data-deck-cur]');
const text = (p, sel) => p.evaluate((s) => (document.querySelector(s)?.innerText || '').replace(/\s+/g, ' ').trim(), sel);

test("따라 넘기기를 다시 켜면 바로 강사가 보는 쪽으로 · 교재를 보고 있으면 '지금' 줄이 '교재 N쪽'을 또 말하지 않음", { skip }, async () => {
  const ctx = await browser.newContext(PHONE);
  try {
    await put({ slide: 2, follow: true, step: null, openPoll: null, notice: null, timer: null });
    const p = await openPage(ctx);
    await p.waitForFunction(() => document.querySelector('[data-deck-cur]').textContent === '2');
    // 맨 위(교재가 화면 밖): 강사가 보는 쪽을 알리고 그리 가는 단추
    await p.waitForFunction(() => /교재 2쪽/.test(document.querySelector('[data-now]')?.textContent || ''));
    assert.equal(await band(p), '교재 2쪽 | 2쪽 보기');
    // 교재 그림 칸이 화면 가운데에 보이고 이미 그 쪽: 띠를 내림(교재를 가리지 않게)
    await p.evaluate(() => document.querySelector('.lp-deck-stage').scrollIntoView({ block: 'center' }));
    await p.waitForFunction(() => document.querySelector('[data-now]').hidden, null, { timeout: 5000 });
    // 따라 넘기기를 끄면 강사가 넘겨도 그대로이고, 띠가 강사의 쪽을 알림(교재가 보여도 — 다른 쪽을 보고 있으므로)
    await p.uncheck('[data-deck-follow]');
    await put({ slide: 3 });
    await p.waitForFunction(() => /교재 3쪽/.test(document.querySelector('[data-now]')?.textContent || ''), null, { timeout: 8000 });
    assert.equal(await cur(p), '2'); assert.equal(await band(p), '교재 3쪽 | 3쪽 보기');
    // 다시 켜면 강사의 다음 넘김을 기다리지 않고 바로 3쪽으로(전에는 강사가 또 넘길 때까지 그대로였음), 띠도 내려감
    await p.check('[data-deck-follow]');
    await p.waitForFunction(() => document.querySelector('[data-deck-cur]').textContent === '3', null, { timeout: 1500 });
    await p.waitForFunction(() => document.querySelector('[data-now]').hidden, null, { timeout: 3000 });
    // 공지가 있으면 교재를 보고 있어도 띠는 공지를 보임('교재 N쪽'과 그 단추는 빼고)
    await put({ notice: { text: '10분 쉬어요', level: 'info' } });
    await p.waitForFunction(() => /10분 쉬어요/.test(document.querySelector('[data-now]')?.textContent || ''), null, { timeout: 8000 });
    assert.equal(await band(p), '10분 쉬어요 | ');
    // 참가자가 직접 다른 쪽으로 넘기면 다시 강사의 쪽을 알림
    await p.click('[data-deck-prev]');
    await p.waitForFunction(() => /3쪽 보기/.test(document.querySelector('[data-now-cta]')?.textContent || ''), null, { timeout: 3000 });
    assert.deepEqual(p._errs, []);
  } finally { await put({ notice: null, slide: 0 }); await ctx.close(); }
});

test("실습 진행: [투표하러 가기]로 들어와 지나친 단계는 '하는 중'으로 적지 않고, 강사 화면은 사람 수로 셈(참가자 N명 기준과 맞음)", { skip, timeout: 120000 }, async () => {
  const ctx = await browser.newContext(PHONE); const cc = await browser.newContext({ viewport: { width: 1366, height: 900 }, ...KO });
  try {
    await put({ openPoll: null, slide: 0, step: null });
    const c = await login(cc);
    const p = await openPage(ctx);
    // 참여(질문 하나) → 2쪽의 퀴즈가 열림 → '지금' 줄의 [투표하러 가기]
    await p.fill('[data-qa-form] textarea', '실습은 어디서 하나요?'); await p.click('[data-qa-form] [type=submit]');
    await p.waitForSelector('[data-qa-list] .lp-qa-item', { timeout: 10000 });
    const me = await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).id, 'lp-' + CODE + ':me');
    await put({ openPoll: pollIds[0] });
    await p.waitForFunction(() => /투표하러 가기/.test(document.querySelector('[data-now-cta]')?.textContent || ''), null, { timeout: 8000 });
    await Promise.all([p.waitForNavigation({ waitUntil: 'load' }), p.click('[data-now-cta]')]);
    await p.waitForSelector('.lp-poll-opts button', { timeout: 15000 });
    // 런타임이 투표 칸을 화면 가운데로 옮길 때까지 기다린 뒤 누름(Playwright의 click은 제 스크롤로 그 움직임을 끊어 투표 칸이 화면 아래에 걸린 채 멈춤)
    await p.waitForFunction(() => { const r = document.querySelector('[data-poll-live]').getBoundingClientRect(); return r.top > innerHeight * 0.15 && r.bottom < innerHeight * 0.75; }, null, { timeout: 8000 });
    await p.waitForTimeout(600);
    await p.evaluate(() => document.querySelector('.lp-poll-opts button').click());
    await p.waitForTimeout(4500); // 머무는 시간(3초)보다 오래 기다려도
    const mine = async () => (await A.call('GET', '/progress', { admin: ADMIN })).body.filter((x) => x.by === me).map((x) => x.station + ':' + x.status).sort();
    assert.deepEqual(await mine(), [], '쪽을 열고 투표 칸으로 내려갔을 뿐인 단계는 적지 않음(전에는 두 단계 모두 하는 중)');
    assert.match(await text(c, '[data-k="kpi실습 막힘"]'), /모두 완료 0명 · 하는 중 0명/);
    // 1단계를 실제로 봄(화면 가운데에 3초 넘게) → 하는 중 1명
    await p.evaluate(() => document.querySelector('[data-st="s1"]').scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(4200);
    assert.deepEqual(await mine(), ['s1:doing']);
    // 2단계로 넘어감(1단계는 완료를 누르지 않음): 서버 기록은 둘 다 '하는 중'이지만 한 사람은 한 단계에서만 센다
    await p.evaluate(() => document.querySelector('[data-st="s2"]').scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(4200);
    assert.deepEqual(await mine(), ['s1:doing', 's2:doing']);
    await c.waitForFunction(() => /다듬기 완료 0 · 하는 중 1/.test(document.querySelector('#lp-p-heat').innerText.replace(/\s+/g, ' ')), null, { timeout: 8000 });
    const heat = await text(c, '#lp-p-heat');
    assert.match(heat, /프롬프트 쓰기 완료 0 · 하는 중 0 다듬기 완료 0 · 하는 중 1/, heat);
    assert.match(heat, /참가자 1명 기준/);
    assert.match(await text(c, '[data-k="kpi실습 막힘"]'), /모두 완료 0명 · 하는 중 1명/, '띠도 사람 수(전에는 하는 중 2 — 참가자 1명보다 많음)');
    // 두 단계를 모두 끝냄 → 모두 완료 1명
    await p.click('[data-st="s2"] [data-done]'); await p.evaluate(() => document.querySelector('[data-st="s1"] [data-done]').scrollIntoView({ block: 'center' })); await p.click('[data-st="s1"] [data-done]');
    await c.waitForFunction(() => /모두 완료 1명 · 하는 중 0명/.test(document.querySelector('[data-k="kpi실습 막힘"]').innerText.replace(/\s+/g, ' ')), null, { timeout: 8000 });
    assert.match(await text(c, '#lp-p-heat'), /프롬프트 쓰기 완료 1 · 하는 중 0 다듬기 완료 1 · 하는 중 0/);
    assert.deepEqual(p._errs, []); assert.deepEqual(c._errs, []);
  } finally { await put({ openPoll: null }); await ctx.close(); await cc.close(); }
});

test('강사 화면: 시작 전 한 줄이 발표 화면에 실제로 떠 있는 것과 맞고, 퇴실만 적힌 사람의 [입실]은 고치는 칸을 엶(퇴실보다 늦은 입실을 적지 않음)', { skip, timeout: 90000 }, async () => {
  const cc = await browser.newContext({ viewport: { width: 1366, height: 900 }, ...KO });
  try {
    await put({ slide: 0, openPoll: null, notice: null, timer: null, ui: {} });
    // 열린 질문을 모두 답변 완료로(앞 시험이 남긴 것) → 발표 화면은 참여 안내(큰 QR)
    for (const q of (await A.call('GET', '/questions', { admin: ADMIN })).body) await A.call('PATCH', '/questions/' + q.id, { admin: ADMIN, body: { status: 'answered' } });
    const c = await login(cc);
    await c.waitForFunction(() => /참여 안내\(큰 QR\)가 떠 있어요/.test(document.querySelector('.lp-con-before')?.textContent || ''), null, { timeout: 8000 });
    const scr = await cc.newPage(); await scr.goto(srv.url + '/screen.html'); await scr.waitForSelector('[data-screen][data-lobby]', { timeout: 10000 });
    // 질문이 올라오면 발표 화면은 큰 QR이 아니라 질문 목록 — 강사 화면의 한 줄도 그렇게 말함
    const who = (await A.call('POST', '/join', { body: { nickname: '' } })).body;
    await A.call('POST', '/questions', { token: who.token, body: { text: '시작 전에 올린 질문', anonymous: true } });
    await scr.waitForFunction(() => !document.querySelector('[data-screen]').hasAttribute('data-lobby') && /시작 전에 올린 질문/.test(document.querySelector('[data-screen-main]').textContent), null, { timeout: 10000 });
    await c.waitForFunction(() => /질문 1개가 떠 있어요/.test(document.querySelector('.lp-con-before')?.textContent || ''), null, { timeout: 8000 });
    assert.doesNotMatch(await text(c, '.lp-con-before'), /큰 QR/);
    // 퇴실만 적힌 사람: [입실]은 지금 시각으로 적지 않고 고치는 칸을 열어 시각을 적게 함
    const late = (await A.call('POST', '/join', { body: { nickname: '', name: '퇴실만 있는 사람', consent: true } })).body;
    await A.call('POST', '/attendance', { token: late.token, body: { kind: 'out' } });
    const row = c.locator('#lp-p-att tr', { hasText: '퇴실만 있는 사람' });
    await row.waitFor({ timeout: 10000 });
    await row.locator('button', { hasText: /^입실$/ }).click();
    await c.waitForSelector('#lp-p-att .lp-con-edit input[type=time]', { timeout: 5000 });
    assert.match(await text(c, '[data-toast]'), /퇴실이 먼저 적혀 있어요\. 입실 시각을 적어 주세요/);
    assert.equal(await c.evaluate(() => document.activeElement?.type), 'time', '입실 시각 칸에 초점');
    await c.waitForTimeout(800);
    assert.deepEqual((await A.call('GET', '/attendance', { admin: ADMIN })).body.filter((x) => x.by === late.id).map((x) => x.kind), ['out'], '입실은 아직 적지 않음');
    assert.deepEqual(c._errs, []);
  } finally { await cc.close(); }
});

test("배포한 곳이 붙이는 '신고' 줄: 참여 막대 밑에 깔리지 않고 맨 끝에서 눌림(비워 둔 자리를 그 줄 아래로 옮김)", { skip }, async () => {
  for (const vp of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const ctx = await browser.newContext({ ...PHONE, viewport: vp });
    try {
      const p = await openPage(ctx, 'hosted.html');
      await p.waitForFunction(() => { const d = document.querySelector('[data-dock]'); return d && !d.hidden; });
      await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(500);
      const st = await p.evaluate(() => {
        const a = document.querySelector('[data-host-report] a'), r = a.getBoundingClientRect(), d = document.querySelector('[data-dock]').getBoundingClientRect();
        const m = document.querySelector('[data-lp-made] a'), mr = m.getBoundingClientRect();
        const hit = (q) => document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
        return { link: [Math.round(r.top), Math.round(r.bottom)], dockTop: Math.round(d.top), linkHit: hit(r) === a, madeHit: hit(mr) === m || m.contains(hit(mr)), over: document.documentElement.scrollWidth - innerWidth };
      });
      assert.ok(st.linkHit && st.link[1] <= st.dockTop, `${vp.width}×${vp.height}: '신고'가 막대 위에서 눌림 ${JSON.stringify(st)}`);
      assert.ok(st.madeHit, `${vp.width}: 'Made with Lecpage'도 그대로 눌림`);
      assert.equal(st.over, 0);
      assert.deepEqual(p._errs, []);
    } finally { await ctx.close(); }
  }
});

test('접속 확인·개인정보 안내: 320~360px 휴대폰에서 옆으로 넘치지 않음(머리의 단추 묶음이 밀려 나가지 않음)', { skip }, async () => {
  for (const w of [320, 340, 360, 390]) {
    const ctx = await browser.newContext({ ...PHONE, viewport: { width: w, height: 640 } });
    try {
      const p = await ctx.newPage();
      for (const f of ['privacy.html', 'check.html']) {
        await p.goto(srv.url + '/' + f); await p.waitForSelector('.lp-ax-act [data-theme-toggle]');
        const st = await p.evaluate(() => { const b = document.querySelector('.lp-ax-act [data-theme-toggle]').getBoundingClientRect(); return { iw: innerWidth, sw: document.documentElement.scrollWidth, btnRight: Math.round(b.right) }; });
        assert.ok(st.iw === w && st.sw <= w && st.btnRight <= w, `${f} @${w}: ${JSON.stringify(st)}`);
      }
    } finally { await ctx.close(); }
  }
});

// 독립 검토(2026-11-24): 즉석 투표를 닫는 요청이 끝내 실패하면 조용히 넘어가 서버에는 열린 채 남았음(늦은 답을 받음).
// 잠깐 끊긴 것은 연결 쪽이 조금 뒤 다시 보내고(모두 세 번까지), 그래도 안 되면 강사 화면이 알림
test('강사 화면: 즉석 투표 닫기가 한 번 실패하면 조금 뒤 다시 보내고, 그래도 안 되면 알림(조용히 넘기지 않음)', { skip, timeout: 90000 }, async () => {
  const cc = await browser.newContext({ viewport: { width: 1366, height: 900 }, ...KO });
  const Q = '닫기를 다시 보내는지 보는 즉석 투표';
  const doc = async () => (await A.call('GET', '/polls', { admin: ADMIN })).body.find((x) => x.question === Q);
  const until = async (fn, ms = 10000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v || Date.now() - t0 > ms) return v; await new Promise((r) => setTimeout(r, 150)); } }; // eslint-disable-line no-await-in-loop
  try {
    await put({ slide: 0, openPoll: null, notice: null, timer: null });
    const c = await login(cc);
    await c.click('.lp-con-quick summary');
    await c.fill('#lp-qp-q', Q);
    const opts = c.locator('.lp-con-quick .lp-con-opts input'); await opts.nth(0).fill('가'); await opts.nth(1).fill('나');
    await c.click('.lp-con-quick [type=submit]');
    const made = await until(doc); assert.ok(made && made.open === true, '즉석 투표가 열림');
    const close = c.locator('button', { hasText: /^투표 닫기$/ }); await close.waitFor({ timeout: 10000 });
    // ① 닫는 요청이 한 번 끊김 → 조금 뒤 다시 보내 서버에서도 닫힘
    let fail = 1; const tried = [];
    await c.route('**/api/' + CODE + '/polls/*', (route) => {
      if (route.request().method() !== 'PATCH') return route.continue();
      tried.push(Date.now());
      if (fail > 0) { fail--; return route.abort('failed'); }
      return route.continue();
    });
    await close.click();
    assert.ok(await until(async () => (await doc()).open === false), '다시 보내 서버에서도 닫힘');
    assert.equal(tried.length, 2, '한 번 실패 + 한 번 더');
    assert.ok(tried[1] - tried[0] >= 400, `조금 뒤에 다시(${tried[1] - tried[0]}ms)`);
    assert.doesNotMatch(await text(c, '[data-toast]'), /처리하지 못했어요/);
    // ② 다시 열었다가 닫는데 번번이 끊김 → 세 번까지 보낸 뒤 알림(서버에는 열린 채이므로 강사가 알아야 함 — 전에는 아무 말이 없었음)
    const li = c.locator('.lp-con-polls li', { hasText: Q }).filter({ hasText: '닫힘' }); await li.waitFor({ timeout: 10000 }); // 강사 화면도 닫힌 것을 앎
    await li.locator('button', { hasText: /^열기$/ }).click();
    assert.ok(await until(async () => (await doc()).open === true), '다시 엶');
    await close.waitFor({ timeout: 10000 });
    await c.waitForTimeout(500); // 여는 요청의 답(열린 투표)이 강사 화면에 닿을 틈
    fail = 99; tried.length = 0;
    await close.click();
    await c.waitForFunction(() => /처리하지 못했어요/.test(document.querySelector('[data-toast]').textContent), null, { timeout: 15000 });
    assert.equal(tried.length, 3, '세 번까지만 보냄');
    assert.equal((await doc()).open, true, '서버에는 열린 채');
    assert.deepEqual(c._errs, []);
  } finally { await put({ openPoll: null }); await cc.close(); }
});
