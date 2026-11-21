// 새 흐름 e2e 공용: AI 회사 API를 가짜로(키 확인만 통과), 교재 넣기 → AI 고르기(가짜 생성) → 완성까지
const { chromium } = require('./pw.js');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:6301/';
const S = __dirname;
const OUT = process.env.OUT || require('path').resolve(__dirname, '../../.out/verify/shots') + '/';
const FIX = require('path').resolve(__dirname, '../../skills/lecpage/engine/test/fixtures');
fs.mkdirSync(OUT, { recursive: true });
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`); return cond; };
const summary = () => { console.log(`\n${pass} pass, ${fail} fail`); return fail; };

// 진짜 생성 파이프라인(app/src/lib/gen)용 가짜 Claude: 단계(build 한 번에 만들기·fix 검수 고치기·edit 수정 요청)마다 그럴듯한 답(r100/gen/mock-site.mjs)을 스트림 꼴로.
// 요청 글에 '#실패'가 있으면(geminiFails.on일 때, 이름은 예전 그대로) 만들기 단계를 매번 503으로(오류 안내 화면 확인용, 지운 뒤 [이어서 만들기]하면 됨)
let SITE = null;
const geminiFails = { on: false };
async function aiAnswer(body) {
  SITE = SITE || await import(S + '/mock/mock-site.mjs');
  const all = (body.messages || []).flatMap((m) => (Array.isArray(m.content) ? m.content : [{ type: 'text', text: m.content }])).map((x) => x.text || '').join('\n');
  const m = /작업 단계: (build|fix|edit)/.exec(all); const step = m ? m[1] : '';
  if (step === 'build' && /#실패/.test(all) && geminiFails.on) return null; // 강사 요청은 build 글에 들어감
  let text = '';
  if (step === 'build') text = SITE.buildAnswer();
  else if (step === 'fix') text = SITE.fixAnswer([...new Set([...all.matchAll(/<section id="([\w-]+)"/g)].map((x) => x[1]))]);
  else if (step === 'edit') text = /lecpage 검수에서/.test(all) ? SITE.fixAnswer([...new Set([...all.matchAll(/<section id="([\w-]+)"/g)].map((x) => x[1]))]) : SITE.editAnswer((/강사 요청:\n([^\n]+)/.exec(all) || [])[1] || '');
  const ev = (type, o) => `event: ${type}\ndata: ${JSON.stringify({ type, ...o })}\n\n`;
  return ev('message_start', { message: { usage: { input_tokens: 1 } } }) + ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text } }) + ev('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } }) + ev('message_stop', {});
}
/** AI 회사 API를 가짜로 답함: 키 확인·모델 목록 + Claude 생성 스트림(실제 AI 호출 없음). 재시도 기다림은 짧게(시험 손잡이) */
async function mockAi(ctx, extra, { fallback = false } = {}) {
  await ctx.addInitScript(() => { globalThis.__lpGenTest = { backoff: 0.01, saveMs: 300 }; });
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, async (r) => {
    const u = r.request().url();
    if (extra) { const done = await extra(r, u); if (done) return; }
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    if (/api\.anthropic\.com\/v1\/messages/.test(u) && r.request().method() === 'POST') {
      await new Promise((ok) => setTimeout(ok, Number(process.env.AI_DELAY || 1500))); // 실제처럼 조금 걸리게(멈추기·진행 화면을 볼 틈)
      const sse = await aiAnswer(JSON.parse(r.request().postData() || '{}'));
      return sse === null ? r.fulfill({ status: 503, contentType: 'application/json', headers: cors, body: JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }) })
        : r.fulfill({ status: 200, contentType: 'text/event-stream', headers: cors, body: sse });
    }
    if (/api\.openai\.com\/healthz|api\.anthropic\.com\/api\/hello/.test(u)) return r.fulfill({ status: 200, headers: cors, body: '' });
    if (/api\.anthropic\.com\/v1\/models/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ data: [{ id: 'claude-opus-5-5', display_name: 'Claude Opus 5.5' }] }) });
    if (fallback) return r.fallback();
    return r.abort();
  });
}

function watch(p) {
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_|net::|Failed to load resource|favicon|\[gen\]/.test(m.text())) errs.push('console: ' + m.text()); });
  return errs;
}

/** 첫 화면에서 교재를 넣고 교재 넣기 화면이 다 읽을 때까지 */
async function startWithFile(p, files = [FIX + '/workshop.pdf']) {
  await p.goto(BASE, { waitUntil: 'load' });
  await p.setInputFiles('.ld-hero input[type=file][multiple]', files);
  await p.waitForSelector('.files li', { timeout: 60000 });
  await p.waitForFunction(() => !document.querySelector('.drop b')?.textContent.includes('중') && !document.querySelector('.files')?.textContent.includes('읽는 중'), null, { timeout: 90000 });
  await p.waitForSelector('.ai-nokey .btn:not([disabled])', { timeout: 30000 });
}

/** 처음 연결하는 길이면 동의 창(체크 하나 + [연결])에 동의함. 이미 동의했으면 그냥 지나감 */
async function consent(p, timeout = 3000) {
  const on = await p.waitForSelector('dialog[open] .consent', { timeout }).then(() => true, () => false);
  if (!on) return false;
  await p.check('dialog[open] .consent input[type=checkbox]');
  await p.click('dialog[open] .consent button:has-text("연결")');
  return true;
}
/** Claude 카드의 [키로 연결] → (처음이면 동의) → 가짜 키 → 연결되면 바로 만들기 시작(예전 이름 connectGemini도 같은 함수) */
async function connectAi(p) {
  await p.click('details.ai-more:not([open]) > summary').catch(() => {}); await p.click('.ai-card:has(h3:text-is("Claude")) button:has-text("API 키 연결")');
  await consent(p);
  await p.waitForSelector('dialog[open] .ai-connect');
  await p.click('dialog[open] .key-dots li:last-child button');
  await p.fill('dialog[open] input[type=password]', 'sk-ant-api03-FAKEKEY_1234567890abcdefghijklmnopqrstuvwxyz');
  await p.click('dialog[open] .key-now button:has-text("연결")');
}
const connectGemini = connectAi;

/** 만드는 중 화면이 끝나고 완성 화면(목록)이 열릴 때까지 */
async function waitStudio(p, timeout = 60000) { await p.waitForSelector('.st .st-panel .st-info', { timeout }); if ((p.viewportSize()?.width || 1366) > 960) await p.waitForSelector('.pv-device iframe', { timeout: 30000 }); await p.waitForTimeout(600); }

/** IndexedDB의 그 연수 */
async function readProject(p, id) {
  return p.evaluate((pid) => new Promise((res) => { const q = indexedDB.open('lecpage'); q.onsuccess = () => { const t = q.result.transaction('projects').objectStore('projects').get(pid); t.onsuccess = () => res(t.result); }; }), id);
}
const pidOf = (p) => (/#\/p\/([^/]+)/.exec(p.url()) || [])[1];

module.exports = { consent, chromium, fs, BASE, S, OUT, FIX, ok, summary, mockAi, geminiFails, watch, startWithFile, connectGemini, connectAi, waitStudio, readProject, pidOf, cors };
