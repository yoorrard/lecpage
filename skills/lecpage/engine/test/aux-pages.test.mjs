// 보조 화면(강사·발표·안내문·접속 확인·개인정보)이 실제로 도는지: 만든 사이트를 Node 서버(http 방식, 같은 주소에서 사이트도 보냄)와
// 리허설(local)로 열어 브라우저로 누름. 참가자 글이 강사·발표 화면을 깨뜨리지 못하는지, 잠그기·닫힌 투표·CSV 수식 막기·관리자 키 다루기도 봄.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import * as E from '../src/index.js';
import { nodeRuntime, writeFiles } from '../node.js';
import { startNodeServer, here } from './live-helpers.mjs';

const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require('playwright')); } catch { try { ({ chromium } = createRequire('/opt/node-tools/')('playwright')); } catch { /* 없음 */ } }
const skip = !chromium && 'playwright is not installed';

const ADMIN = '보조화면-시험용-관리자키-77';
const EX = JSON.parse(fs.readFileSync(path.join(here, '../../examples/data-lab.blueprint.json'), 'utf8'));
let srv, browser, site;

function blueprint(live) {
  const bp = structuredClone(EX);
  bp.live = { features: ['qa', 'help', 'progress', 'board', 'poll', 'reactions', 'signal'], ...live };
  return bp;
}
before(async () => {
  if (skip) return;
  site = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-aux-'));
  srv = await startNodeServer({ adminKey: ADMIN, staticDir: site });
  const r = E.build(blueprint({ provider: 'http', url: srv.url, code: 'AUXTEST' }), { runtime: nodeRuntime() });
  assert.deepEqual(r.errors, []);
  writeFiles(site, r.files);
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); await srv?.close(); if (site) fs.rmSync(site, { recursive: true, force: true }); });

const open = async (ctx, p) => { const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page._errs = errs; await page.goto(srv.url + '/' + p); return page; };
async function login(page, key, remember = false) {
  await page.fill('#lp-key', key);
  if (remember) await page.check('[data-remember]');
  await page.click('[data-key-go]');
}
async function join(page, nickname) {
  // 참가자: 질문 칸에서 참여하기 창을 거쳐 질문을 올림
  await page.locator('[data-qa-form] textarea').scrollIntoViewIfNeeded();
  return nickname;
}
async function ask(page, text, nickname) {
  await page.fill('[data-qa-form] textarea', text);
  await page.click('[data-qa-form] [type=submit]');
  const dlg = page.locator('[data-join-dialog][open]');
  if (await dlg.count()) { await dlg.locator('input[name=nickname]').fill(nickname); await dlg.locator('[type=submit]').click(); }
}

test('강사 화면: 틀린 키는 늦추고 주소·화면에 남기지 않음, 맞는 키는 이 탭에만(기억하기를 고를 때만 이 기기에)', { skip }, async () => {
  const ctx = await browser.newContext();
  try {
    const c = await open(ctx, 'console.html');
    for (let i = 0; i < 3; i++) { await login(c, '틀린-키-' + i + '-xxxxxxxx'); await c.waitForFunction(() => document.querySelector('[data-key-msg]').textContent.length > 0); }
    assert.match(await c.textContent('[data-key-msg]'), /관리자 키가 맞지 않아요/);
    assert.equal(await c.getAttribute('[data-key-go]', 'disabled'), '', '세 번 틀리면 잠시 기다리게 함');
    assert.match(await c.textContent('[data-key-go]'), /초 뒤에 다시/);
    assert.ok(!c.url().includes('키'), '주소에 키가 없음');
    // 새 탭에서 맞는 키(기억하기 끔): sessionStorage만
    const d = await open(ctx, 'console.html');
    await login(d, ADMIN);
    await d.waitForSelector('[data-console-main]:not([hidden]) .lp-con-strip');
    const where = await d.evaluate(() => ({ s: Object.keys(sessionStorage).filter((k) => k.startsWith('lp-admin:')).length, l: Object.keys(localStorage).filter((k) => k.startsWith('lp-admin:')).length, html: document.documentElement.outerHTML }));
    assert.deepEqual([where.s, where.l], [1, 0]);
    assert.ok(!where.html.includes(ADMIN), '화면(DOM)에 키가 없음');
    assert.equal(await d.inputValue('#lp-key'), '', '입력칸도 비움');
    assert.match(await d.textContent('[data-conn-text]'), /연결됨/);
    // [나가기]: 이 기기에서 지움
    await d.click('[data-logout]');
    await d.waitForSelector('[data-admin-form]');
    assert.equal(await d.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('lp-admin:')).length), 0);
    // 기억하기: localStorage에도, 다시 열면 바로 들어감
    await login(d, ADMIN, true);
    await d.waitForSelector('[data-console-main]:not([hidden]) .lp-con-strip');
    assert.equal(await d.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('lp-admin:')).length), 1);
    const e = await ctx.newPage(); await e.goto(srv.url + '/console.html');
    await e.waitForSelector('[data-console-main]:not([hidden]) .lp-con-strip');
    await e.click('[data-logout]');
    await e.waitForSelector('[data-admin-form]');
    assert.equal(await e.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('lp-admin:')).length), 0);
    assert.deepEqual([...c._errs, ...d._errs], []);
  } finally { await ctx.close(); }
});

test('참가자 글: 강사·발표 화면에서 글자로만, 보이지 않는 글자·방향 바꿈·쌓인 결합 부호는 빼고, 발표 화면은 주소를 가림', { skip }, async () => {
  const adm = await browser.newContext(); const par = await browser.newContext();
  try {
    const c = await open(adm, 'console.html'); await login(c, ADMIN);
    await c.waitForSelector('[data-console-main]:not([hidden]) .lp-con-strip');
    const s = await open(adm, 'screen.html');
    const p = await open(par, 'index.html');
    const evil = '<img src=x onerror="window.__x=1">공식 자료는 https://evil.example.com/a 에서\u202E받으세요\u200B Z\u0301\u0302\u0303\u0304\u0305';
    await ask(p, evil, '하늘\u3164');
    await c.waitForSelector('.lp-con-list .lp-con-t:has-text("공식 자료는")', { timeout: 10000 });
    const ct = await c.textContent('.lp-con-list .lp-con-t');
    assert.ok(ct.includes('<img src=x'), '글자 그대로');
    assert.ok(!/[\u202E\u200B]/.test(ct) && !/\u0303\u0304/.test(ct), '보이지 않는 글자·쌓인 부호 없음: ' + JSON.stringify(ct));
    assert.match(await c.textContent('.lp-con-list .lp-con-m'), /링크 있음/);
    await s.waitForSelector('.lp-scr-q-t', { timeout: 10000 });
    const st = await s.textContent('.lp-scr-q-t');
    assert.ok(st.includes('(링크)') && !st.includes('evil.example.com'), st);
    for (const pg of [c, s, p]) assert.equal(await pg.evaluate(() => window.__x || document.querySelectorAll('img[src="x"]').length), 0);
    // 고정·숨기기가 발표 화면에 바로
    await c.click('.lp-con-list .lp-con-a button:has-text("숨기기")');
    await s.waitForSelector('.lp-scr-empty', { timeout: 10000 });
  } finally { await adm.close(); await par.close(); }
});

test('잠그기·즉석 투표·결과 공개·닫힌 투표에 늦은 답·CSV 수식 막기·모두 지우기', { skip }, async () => {
  const adm = await browser.newContext({ acceptDownloads: true }); const par = await browser.newContext();
  try {
    const c = await open(adm, 'console.html'); await login(c, ADMIN);
    await c.waitForSelector('[data-console-main]:not([hidden]) .lp-con-strip');
    const s = await open(adm, 'screen.html');
    const p = await open(par, 'index.html');
    // 수식으로 읽힐 질문
    await ask(p, '=HYPERLINK("https://evil.example.com","눌러")', '바다');
    await c.waitForSelector('.lp-con-list .lp-con-t:has-text("HYPERLINK")', { timeout: 10000 });
    // 질문 받기 잠그기 → 참가자 화면에 안내, 서버도 거절
    await c.click('[data-k="lock-qa"]');
    await p.waitForSelector('[data-qa] [data-lock-note]:not([hidden])', { timeout: 10000 });
    assert.equal(await p.isDisabled('[data-qa-form] textarea'), true);
    const res = await p.evaluate(() => LecLive.current().add('questions', { text: '잠긴 뒤에 몰래' }).then(() => 'ok', (e) => e.code));
    assert.equal(res, 'locked');
    await c.click('[data-k="lock-qa"]');
    await p.waitForFunction(() => !document.querySelector('[data-qa-form] textarea').disabled, null, { timeout: 10000 });
    // 즉석 투표 → 참가자 답 → 결과 공개 → 발표 화면 막대
    await c.click('.lp-con-quick > summary');
    await c.fill('#lp-qp-q', '지금 몇 번 실습?');
    const opts = c.locator('.lp-con-opts input');
    await opts.nth(0).fill('1번'); await opts.nth(1).fill('2번');
    await c.click('.lp-con-quick [type=submit]');
    await p.waitForSelector('text=지금 몇 번 실습?', { timeout: 10000 });
    await s.waitForSelector('.lp-scr-wait', { timeout: 10000 });
    const pid = await c.evaluate(() => LecLive.current().state.openPoll);
    const ans = await p.evaluate((id) => LecLive.current().add('answers', { poll: id, value: '2번' }).then((d) => d && d.id ? 'ok' : 'none', (e) => e.code), pid);
    assert.equal(ans, 'ok');
    await c.click('.lp-con-poll button:has-text("결과 공개")');
    await s.waitForSelector('.lp-scr-bar.is-top:has-text("2번")', { timeout: 10000 });
    // 투표 닫기 → 늦은 답은 거절(오류로 알림)
    await c.click('.lp-con-poll button:has-text("투표 닫기")');
    await p.waitForFunction((id) => { const q = LecLive.current().get('polls', id); return q && q.open === false; }, pid, { timeout: 10000 });
    const late = await p.evaluate((id) => LecLive.current().add('answers', { poll: id, value: '1번' }).then(() => 'ok', (e) => e.code), pid);
    assert.equal(late, 'poll_closed');
    // CSV: 질문 칸이 =로 시작하면 ' 를 붙여 내려받음
    const [dl] = await Promise.all([c.waitForEvent('download'), c.click('[data-k="dlquestions"]')]);
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    assert.ok(csv.includes("'=HYPERLINK"), csv);
    assert.ok(!/(^|,)"?=HYPERLINK/m.test(csv));
    // 모두 지우기: 확인 창을 거쳐
    await c.click('[data-k="purge"]');
    await c.waitForSelector('[data-purge-dialog][open]');
    await c.click('[data-purge-go]');
    await c.waitForSelector('.lp-con-list .lp-con-empty', { timeout: 10000 });
    await s.waitForSelector('.lp-scr-empty', { timeout: 10000 });
    assert.deepEqual([...c._errs, ...s._errs, ...p._errs], []);
  } finally { await adm.close(); await par.close(); }
});

test('접속 확인: 참여 기능 서버에 실제로 연결해 결과를 세 갈래로, 개인정보 안내는 연결한 방식대로', { skip }, async () => {
  const ctx = await browser.newContext();
  // 바깥 주소(도구·글꼴)는 막음: 막힌 것으로 나와야 함
  await ctx.route('**/*', (rt) => (rt.request().url().startsWith(srv.url) ? rt.continue() : rt.abort()));
  try {
    const k = await open(ctx, 'check.html');
    await k.waitForFunction(() => document.querySelector('[data-verdict]').getAttribute('data-state') !== 'wait', null, { timeout: 30000 });
    assert.equal(await k.getAttribute('[data-verdict]', 'data-state'), 'fail');
    assert.match(await k.textContent('[data-list="ok"]'), /참여 기능\(질문·투표\)/);
    assert.match(await k.textContent('[data-list="fail"]'), /Google Sheets|Gemini|Looker/);
    assert.ok((await k.locator('[data-list="todo"] li').count()) >= 2);
    const pv = await open(ctx, 'privacy.html');
    const txt = await pv.textContent('main');
    assert.match(txt, /참여 기능 서버 운영자/); assert.match(txt, /30일/); assert.match(txt, /IP 주소는 기록으로 남기지 않습니다/);
    assert.deepEqual([...k._errs, ...pv._errs], []);
  } finally { await ctx.close(); }
});

test('리허설(local): 아무 키로 들어가고 네 화면이 오류 없이 열림, 안내문은 A4 한 장 + 강사 카드', { skip }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-aux-local-'));
  const r = E.build(blueprint({ provider: 'local', code: 'AUXLOCAL' }), { runtime: nodeRuntime() });
  writeFiles(dir, r.files);
  const ctx = await browser.newContext();
  await ctx.route('**/*', (rt) => (/^(file:|data:|blob:)/.test(rt.request().url()) ? rt.continue() : rt.abort()));
  try {
    const go = async (p) => { const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page._errs = errs; await page.goto(pathToFileURL(path.join(dir, p)).href); return page; };
    const c = await go('console.html'); await login(c, '아무거나');
    await c.waitForSelector('[data-console-main]:not([hidden]) .lp-con-strip');
    assert.match(await c.textContent('[data-conn-text]'), /리허설/);
    await c.fill('.lp-con-panel[data-area="run"] form input', '5분 뒤 다시 모여요');
    await c.click('.lp-con-panel[data-area="run"] form button[type=submit]');
    const s = await go('screen.html');
    await s.waitForSelector('[data-notice]:not([hidden])', { timeout: 10000 });
    assert.match(await s.textContent('[data-notice]'), /5분 뒤 다시 모여요/);
    const po = await go('poster.html');
    assert.equal(await po.locator('.lp-pst-page:visible').count(), 2, '안내문 + 강사 카드(자리 카드는 고를 때만)');
    await po.check('[data-part-print="cards"]');
    assert.equal(await po.locator('.lp-pst-page:visible').count(), 3);
    const k = await go('check.html');
    await k.waitForFunction(() => document.querySelector('[data-verdict]').getAttribute('data-state') !== 'wait', null, { timeout: 30000 });
    assert.match(await k.textContent('[data-list="todo"]'), /참여 기능 서버를 연결/);
    for (const pg of [c, s, po, k]) assert.deepEqual(pg._errs, []);
  } finally { await ctx.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
