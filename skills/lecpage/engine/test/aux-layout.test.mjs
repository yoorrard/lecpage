// 강사·발표·접속 확인 화면의 배치: 수업 중 자주 누르는 공지·타이머가 첫 화면에, 읽는 숫자(참가자·도움 요청·신호·실습 막힘)는 맨 위 띠에.
// 발표 화면은 질문·투표가 없으면 로비(참여 QR을 화면 높이의 절반쯤, 큰 연수 제목, 주소 한 줄), 첫 질문이 오면 지금 배치로.
// 접속 확인의 '없어도 연수는 할 수 있어요'가 첫 칸(1.5rem)에 들어가 한 글자씩 세로로 서지 않게.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import * as E from '../src/index.js';
import { nodeRuntime, writeFiles } from '../node.js';
import { startNodeServer, here } from './live-helpers.mjs';

const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require('playwright')); } catch { try { ({ chromium } = createRequire('/opt/node-tools/')('playwright')); } catch { /* 없음 */ } }
const skip = !chromium && 'playwright is not installed';

const ADMIN = '배치-시험용-관리자키-2026-48';
const SITE = 'https://s-7k2m9x4q1z.lecpage-sites.pages.dev/'; // 바로 배포 주소 길이(36자)
const EX = JSON.parse(fs.readFileSync(path.join(here, '../../examples/data-lab.blueprint.json'), 'utf8'));
let srv, browser, site, files;

before(async () => {
  site = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-layout-'));
  srv = skip ? null : await startNodeServer({ adminKey: ADMIN, staticDir: site });
  const bp = structuredClone(EX);
  bp.live = { features: ['qa', 'help', 'progress', 'poll', 'signal'], provider: 'http', url: srv ? srv.url : 'https://live.example.com', code: 'LAYOUT' };
  bp.meta = { ...bp.meta, date: '2099-12-30', siteUrl: SITE };
  const r = E.build(bp, { runtime: nodeRuntime() });
  assert.deepEqual(r.errors, []);
  files = r.files; writeFiles(site, r.files);
  if (!skip) browser = await chromium.launch();
});
after(async () => { await browser?.close(); await srv?.close(); if (site) fs.rmSync(site, { recursive: true, force: true }); });

const open = async (ctx, p) => { const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page._errs = errs; await page.goto(srv.url + '/' + p); return page; };
const top = (page, sel) => page.evaluate((s) => { const n = document.querySelector(s); return n ? n.getBoundingClientRect().top + scrollY : null; }, sel);

test('만든 발표 화면: 빈 제목(h2) 없음, 휴대폰용 안내 줄도 랜드마크 안, 처음부터 로비(큰 연수 제목 + 세 단계)', () => {
  const html = files['screen.html'];
  assert.doesNotMatch(html, /<h2[^>]*>\s*<\/h2>/);
  assert.match(html, /<aside class="lp-scr-for" aria-label="[^"]+">/);
  assert.match(html, /class="lp-scr" data-screen data-lobby/);
  assert.match(html, /class="lp-scr-lobby-t" aria-hidden="true">데이터로 읽는 우리 반</);
  assert.equal((html.match(/<ol class="lp-scr-steps">[\s\S]*?<\/ol>/)[0].match(/<li>/g) || []).length, 3);
});

test('강사 화면 1280×750: 공지·타이머가 첫 화면 안, 도움 요청보다 위. 맨 위 띠에 참가자·도움 요청·신호·실습 막힘', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 750 } });
  const par = await browser.newContext();
  try {
    const p = await open(par, 'index.html');
    await p.waitForFunction(() => window.LecLive && LecLive.current && LecLive.current());
    const st = JSON.parse(/id="lp-blueprint"[^>]*>([\s\S]*?)<\/script>/.exec(files['console.html'])[1]).stations.map((s) => s.id);
    await p.evaluate(async (st) => { const c = LecLive.current(); await c.join({ nickname: '수빈' }); await c.add('progress', { station: st[0], status: 'stuck' }); await c.add('help', { station: st[0], seat: '3모둠', nickname: '수빈' }); }, st);
    const c = await open(ctx, 'console.html');
    await c.fill('#lp-key', ADMIN); await c.click('[data-key-go]');
    await c.waitForSelector('#lp-p-help .lp-con-item', { timeout: 10000 });
    const notice = await top(c, '#lp-p-run input[aria-label="공지 문구"]'), timer = await top(c, '[data-k="t1"]'), help = await top(c, '#lp-p-help');
    assert.ok(notice < 750 - 44 && timer < 750 - 40, `공지 ${notice}·타이머 ${timer}는 첫 화면(750) 안`);
    assert.ok(timer < help, `타이머 ${timer} < 도움 요청 ${help}`);
    const strip = await c.locator('.lp-con-strip').innerText();
    for (const k of ['참가자', '도움 요청', '모르겠어요', '실습 막힘']) assert.match(strip, new RegExp(k));
    assert.match(await c.locator('[data-k="kpi실습 막힘"]').innerText(), /1/);
    assert.ok((await top(c, '#lp-p-signal')) < (await top(c, '#lp-p-lead')), '읽는 것(신호) 다음에 가끔 쓰는 폼(이끌기·자료 링크)');
    assert.deepEqual(await c.locator('#lp-p-run h3').allInnerTexts(), ['공지', '타이머']);
    assert.deepEqual(await c.locator('#lp-p-lead h3').allInnerTexts(), ['이끌기', '자료 링크']);
    // 휴대폰(한 단): 공지·타이머 → 도움 요청 → 질문·투표 → 신호·실습 진행 → 보드 → 이끌기·자료 링크 → 기록
    await c.setViewportSize({ width: 390, height: 844 }); await c.waitForTimeout(200);
    const order = await c.evaluate(() => [...document.querySelectorAll('.lp-con-panel')].map((n) => [n.getAttribute('data-area'), n.getBoundingClientRect().top]).sort((a, b) => a[1] - b[1]).map((x) => x[0]));
    assert.deepEqual(order, ['run', 'help', 'qa', 'poll', 'signal', 'heat', 'board', 'lead', 'data']);
    assert.match(await c.locator('.lp-con-net-ck').innerText(), /이 기기에서는 아직 접속 확인을 하지 않았어요/);
    assert.deepEqual([...c._errs, ...p._errs], []);
  } finally { await ctx.close(); await par.close(); }
});

test('발표 화면 1920×1080: 질문이 없으면 로비(QR 높이 절반쯤, 주소 한 줄), 첫 질문이 오면 지금 배치, 질문을 숨기면 다시 로비', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const par = await browser.newContext();
  try {
    const s = await open(ctx, 'screen.html');
    await s.waitForTimeout(800);
    const lobby = () => s.evaluate(() => {
      const q = document.querySelector('.lp-scr-side .lp-qr').getBoundingClientRect(), u = document.querySelector('.lp-scr-side [data-join-url]');
      return { on: document.querySelector('.lp-scr').hasAttribute('data-lobby'), qr: q.height / innerHeight, one: u.scrollWidth <= u.clientWidth + 1 && u.getBoundingClientRect().height < parseFloat(getComputedStyle(u).lineHeight) * 1.5, text: u.textContent };
    });
    let L = await lobby();
    assert.equal(L.on, true);
    assert.ok(L.qr >= 0.45, 'QR이 화면 높이의 ' + L.qr.toFixed(2));
    assert.ok(L.one, '주소 한 줄: ' + L.text);
    assert.equal(L.text, 's-7k2m9x4q1z.lecpage-sites.pages.dev');
    const p = await open(par, 'index.html');
    await p.waitForFunction(() => window.LecLive && LecLive.current && LecLive.current());
    const qid = await p.evaluate(async () => { const c = LecLive.current(); await c.join({ nickname: '지호' }); const d = await c.add('questions', { text: '차트 축 이름은 어디서 바꾸나요?', anonymous: true }); return d.id; });
    await s.waitForSelector('.lp-scr-q-t', { timeout: 10000 });
    L = await lobby();
    assert.equal(L.on, false);
    assert.ok(L.qr < 0.45, '질문이 오면 레일이 좁아짐 ' + L.qr.toFixed(2));
    // 좁은 레일에서 주소가 넘치면 점·빗금 뒤에서만 줄바꿈(조각이 끊기지 않음)
    const lines = await s.evaluate(() => [...document.querySelectorAll('.lp-scr-side [data-join-url] > span')].map((n) => [n.textContent, n.getClientRects().length]));
    assert.ok(lines.every(([, n]) => n === 1), JSON.stringify(lines));
    const adm = await open(ctx, 'console.html'); await adm.fill('#lp-key', ADMIN); await adm.click('[data-key-go]');
    await adm.waitForSelector(`[data-k="hide${qid}"]`, { timeout: 10000 }); await adm.click(`[data-k="hide${qid}"]`);
    await s.waitForFunction(() => document.querySelector('.lp-scr').hasAttribute('data-lobby'), null, { timeout: 10000 });
    assert.deepEqual([...s._errs, ...p._errs, ...adm._errs], []);
  } finally { await ctx.close(); await par.close(); }
});

test('접속 확인: 없어도 되는 곳이 막혀도 \'없어도 연수는 할 수 있어요\'가 둘째 칸에 한 줄로', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // 이 기기 저장소를 막으면 '없어도 되는' 막힘 한 줄이 생김
  await ctx.addInitScript(() => { Storage.prototype.setItem = function () { throw new Error('blocked'); }; });
  try {
    const k = await open(ctx, 'check.html');
    await k.waitForFunction(() => document.querySelector('[data-verdict]').getAttribute('data-state') !== 'wait', null, { timeout: 30000 });
    const em = await k.evaluate(() => { const n = document.querySelector('[data-list="fail"] li em'); if (!n) return null; const b = n.getBoundingClientRect(), b0 = n.parentElement.querySelector('b').getBoundingClientRect(); return { h: b.height, lh: parseFloat(getComputedStyle(n).lineHeight) || 20, left: b.left, bLeft: b0.left, text: n.textContent }; });
    assert.ok(em, '없어도 되는 막힘 줄');
    assert.equal(em.text, '없어도 연수는 할 수 있어요');
    assert.ok(Math.abs(em.left - em.bLeft) < 1, '이름과 같은 칸');
    assert.ok(em.h < em.lh * 1.6, `한 줄(${em.h}px)`);
    assert.deepEqual(k._errs, []);
  } finally { await ctx.close(); }
});
