// 강의 진행(리허설·연습 모드, 서버 없이 한 브라우저 안): 발표 화면이 교재 쪽을 크게 띄우고 강사 화면과 같이 넘기는지(리모컨 키),
// 키 하나로 겹쳐 띄우기, 출석 명단 손으로 더하기·고치기, 교재 쪽에 묶은 퀴즈의 정답 공개, 복사한 프롬프트 모음(.txt).
// 실제 서버(여러 기기)로 같은 흐름은 live-helpers.mjs(명단 규칙)와 aux-pages.test.mjs가 봄.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { writeFiles } from '../node.js';
import { kitBuild, refSite } from './kit-site.mjs';
import { startNodeServer, joinDialogReady } from './live-helpers.mjs';

const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require('playwright')); } catch { try { ({ chromium } = createRequire('/opt/node-tools/')('playwright')); } catch { /* 없음 */ } }
const skip = !chromium && 'playwright is not installed';

let srv, browser, dir;
before(async () => {
  if (skip) return;
  const s = refSite();
  // 레퍼런스(data-lab)에 퀴즈 하나를 교재 4쪽에 묶어 더함(정답 '꺾은선')
  s['index.html'] = s['index.html'].replace('<h3 class="side-h quiz-h">세 문제로 확인</h3>', '<h3 class="side-h quiz-h">세 문제로 확인</h3><div data-lp="poll" data-id="chart" data-page="4" data-answer="꺾은선" data-question="주마다 점수 변화를 보여 줄 차트는?" data-options=\'["막대","꺾은선","원"]\'></div>');
  const r = kitBuild({ site: s, preview: true });
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-run-'));
  writeFiles(dir, r.files);
  srv = await startNodeServer({ adminKey: '강의진행-시험용-관리자키-77', staticDir: dir });
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); await srv?.close(); if (dir) fs.rmSync(dir, { recursive: true, force: true }); });

const open = async (ctx, p, size) => { const page = await ctx.newPage(); if (size) await page.setViewportSize(size); page._errs = []; page.on('pageerror', (e) => page._errs.push(String(e))); await page.goto(srv.url + '/' + p); return page; };
const src = (s) => s.getAttribute('[data-scr-img]', 'src');

test('리허설: 발표 화면이 교재 쪽을 강사 화면·참가자와 같이 넘기고(리모컨 키), 키 하나로 겹쳐 띄우고, 명단·퀴즈·모음이 돈다', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  try {
    const c = await open(ctx, 'console.html');
    await c.fill('#lp-key', '아무 키'); await c.click('[data-key-go]');
    await c.waitForSelector('#lp-p-pres .lp-con-pageno');
    const s = await open(ctx, 'screen.html', { width: 1280, height: 720 });
    const p = await open(ctx, 'index.html', { width: 390, height: 844 });
    // 시작 전: 발표 화면은 참여 안내(로비), 강사 화면은 '시작 전'. [다음 쪽] → 1쪽부터
    await s.waitForSelector('.lp-scr-empty'); assert.equal(await s.locator('[data-scr-deck]').isHidden(), true);
    assert.equal(await c.textContent('.lp-con-pageno'), '시작 전');
    await c.click('[data-k="pnext"]');
    await s.waitForSelector('[data-scr-deck]:not([hidden])');
    assert.match(await src(s), /p-001\.webp$/);
    // 강사 화면 [다음 쪽] → 발표 화면·참가자(따라 넘기기는 처음부터 켜짐)
    await c.click('[data-k="pnext"]');
    await s.waitForFunction(() => /p-002\.webp$/.test(document.querySelector('[data-scr-img]').getAttribute('src')), null, { timeout: 5000 });
    await p.waitForFunction(() => document.querySelector('[data-deck-cur]').textContent.trim() === '2', null, { timeout: 5000 });
    // 발표 화면 리모컨(PageDown) → 강사 화면도 3쪽, 숫자 + Enter → 그 쪽
    await s.bringToFront(); await s.keyboard.press('PageDown');
    await c.waitForFunction(() => /^3 \//.test(document.querySelector('.lp-con-pageno').textContent), null, { timeout: 5000 });
    await s.keyboard.press('4'); await s.keyboard.press('Enter');
    await c.waitForFunction(() => /^4 \//.test(document.querySelector('.lp-con-pageno').textContent), null, { timeout: 5000 });
    // 키 하나로: T 큰 타이머, B 가리기, Esc 교재로, ? 단축키
    await s.keyboard.press('t'); await s.waitForSelector('.lp-scr-ov.is-timer');
    await c.waitForSelector('[data-k="ov-timer"][aria-pressed="true"]');
    await s.keyboard.press('b'); await s.waitForSelector('.lp-scr-ov.is-blank');
    await s.keyboard.press('Escape'); await s.waitForSelector('[data-scr-deck]:not([hidden])');
    assert.equal(await s.locator('.lp-scr-ov').isHidden(), true);
    await s.keyboard.press('?'); assert.equal(await s.locator('[data-keys-dialog]').evaluate((d) => d.open), true);
    await s.keyboard.press('Escape');
    // 강사 화면의 리모컨 키(입력 칸 밖): PageUp → 3쪽
    await c.bringToFront(); await c.evaluate(() => document.activeElement && document.activeElement.blur());
    await c.keyboard.press('PageUp');
    await s.waitForFunction(() => /p-003\.webp$/.test(document.querySelector('[data-scr-img]').getAttribute('src')), null, { timeout: 5000 });
    // 출석: 참가자 입실(이름·소속·동의) + 휴대폰 없는 사람 손으로 더하기 → 명단, 퇴실 처리
    // 연수 날이 오기 전의 리허설이면 '연수 날은 ○월 ○일이에요. 그래도 지금 입실을 기록할까요?'를 한 번 물음 → 확인하면 그대로 기록
    const asked = []; p.on('dialog', (d) => { asked.push(d.message()); d.accept(); });
    await p.bringToFront(); await p.locator('button[data-attend="in"]').first().click();
    await joinDialogReady(p); // 창의 첫 초점이 놓인 뒤에 적음(먼저 적으면 소속에 적을 글이 가끔 이름 칸에 들어가('김하나새온중') 이 시험이 단독으로도 15번에 1번 실패했음)
    await p.fill('[data-join-dialog] input[name="name"]', '김하나'); await p.fill('[data-join-dialog] input[name="school"]', '새온중');
    assert.deepEqual([await p.inputValue('[data-join-dialog] input[name="name"]'), await p.inputValue('[data-join-dialog] input[name="school"]')], ['김하나', '새온중'], '적은 글이 제 칸에 들어감');
    assert.ok(asked.length <= 1 && asked.every((m) => /연수 날은 \d+월 \d+일이에요/.test(m)), JSON.stringify(asked));
    await p.check('[data-join-dialog] input[name="consent"]'); await p.click('[data-join-go]');
    await c.bringToFront();
    await c.waitForSelector('#lp-p-att tbody tr:has-text("김하나")', { timeout: 5000 });
    await c.click('#lp-p-att summary');
    await c.fill('#lp-p-att input[aria-label="이름"]', '박세나'); await c.check('#lp-p-att input[type="checkbox"]');
    await c.click('#lp-p-att button:has-text("추가하고 입실로 적기")');
    await c.waitForSelector('#lp-p-att tbody tr:has-text("박세나")', { timeout: 5000 });
    await c.locator('#lp-p-att tbody tr', { hasText: '김하나' }).locator('button:has-text("퇴실")').click();
    await c.waitForFunction(() => /김하나.*\d\d:\d\d.*\d\d:\d\d/.test(document.querySelector('#lp-p-att tbody').textContent.replace(/\s+/g, ' ')), null, { timeout: 5000 });
    assert.match(await c.locator('[data-k="kpi입실"]').innerText(), /2/);
    // 퀴즈: 4쪽으로 가면 발표 칸에 [바로 열기] → 참가자 답 → 정답 공개
    await c.click('[data-k="pnext"]');
    await c.click('#lp-p-pres .lp-con-now-poll button:has-text("바로 열기")');
    await s.waitForSelector('.lp-scr-pq', { timeout: 5000 });
    const box = p.locator('[data-poll-live]', { hasText: '주마다' });
    await box.locator('button', { hasText: '막대' }).click();
    await c.click('#lp-p-poll button:has-text("정답 공개")');
    await p.waitForFunction(() => /정답은 ‘꺾은선’/.test([...document.querySelectorAll('[data-poll-live]')].map((n) => n.textContent).join(' ')), null, { timeout: 5000 });
    await s.waitForSelector('.lp-scr-bar.is-answer:has-text("꺾은선")', { timeout: 5000 });
    // 정답은 공개하기 전에 참가자·발표 화면 어디에도 없었음(조립 결과)
    assert.ok(!fs.readFileSync(path.join(dir, 'index.html'), 'utf8').includes('data-answer'));
    assert.deepEqual([...c._errs, ...s._errs, ...p._errs], []);
  } finally { await ctx.close(); }
});

test('모음: 복사한 프롬프트(키트 복사 단추·사이트가 복사하는 data-copy)와 메모를 이 기기에 모으고 .txt로', { skip }, async () => {
  const s = refSite();
  s['index.html'] = s['index.html'].replace('<h3 class="side-h quiz-h">세 문제로 확인</h3>', '<h3 class="side-h quiz-h">세 문제로 확인</h3><button type="button" data-copy-text="오늘 배운 함수 세 개를 정리해 줘" data-title="정리 프롬프트">복사</button>');
  writeFiles(path.join(dir, 'nb'), kitBuild({ site: s, preview: true }).files);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  try {
    const p = await open(ctx, 'nb/index.html');
    await p.locator('button[data-copy="p1"]').click(); // 사이트 스크립트가 복사, 모음에는 키트가 담음
    await p.locator('button[data-copy-text]').click();
    assert.equal(await p.evaluate(() => navigator.clipboard.readText()), '오늘 배운 함수 세 개를 정리해 줘');
    const nb = p.locator('[data-notebook]');
    await nb.locator('textarea').fill('3반에서 해 볼 것'); await nb.locator('button[type="submit"]').click();
    assert.deepEqual(await nb.locator('.lp-nb-src').allInnerTexts(), ['가명 예시 데이터 만들기', '정리 프롬프트', '내 메모']);
    // 같은 글을 다시 복사하면 한 번만(맨 아래로)
    await p.locator('button[data-copy="p1"]').click();
    assert.equal(await nb.locator('.lp-nb-list > li').count(), 3);
    // 사이트의 다른 탭에서도 같은 모음
    const q = await open(ctx, 'nb/index.html');
    assert.equal(await q.locator('[data-notebook] .lp-nb-list > li').count(), 3);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-nb-save]')]);
    const txt = fs.readFileSync(await dl.path(), 'utf8');
    assert.match(txt, /■ 01 정리 프롬프트\n오늘 배운 함수 세 개를 정리해 줘/);
    assert.match(txt, /■ 03 가명 예시 데이터 만들기\n중학교 2학년/);
    await nb.locator('.lp-nb-list > li').first().locator('button:has-text("빼기")').click();
    assert.equal(await nb.locator('.lp-nb-list > li').count(), 2);
    assert.deepEqual([...p._errs, ...q._errs], []);
  } finally { await ctx.close(); }
});
