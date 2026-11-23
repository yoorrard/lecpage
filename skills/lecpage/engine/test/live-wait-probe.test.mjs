// 긴 대기의 기다림 올리기를 실제 브라우저 + Node 서버 + 사이에 낀 대리 서버로 봄(2026-11-24).
// 대리 서버는 웹소켓·SSE를 막고(묻기 방식이 됨), '조용히 끊는 망'은 오래 붙잡힌 요청의 답을 버리고 연결은 그대로 둠(답이 영영 오지 않음).
//   ① 조용히 끊는 망: 시험 요청만 돌아오지 않음. 실제 묻기는 처음 기다림 그대로라 강사가 바꾼 것(투표 열림)이 시험 중에도 뒤에도 전과 같은 빠르기로 옴
//   ② 끊지 않는 망: 시험 요청이 제때 돌아온 뒤에만 실제 묻기의 기다림을 올림. 올린 뒤에도 바뀐 것은 바로 오고, 쪽을 옮겨도 다시 시험하지 않음
// 빨리 보려고 사이트의 실시간 설정에 기다림 2초·시험할 값 4·6초·쉬는 틈 2초를 넣어 돌림(실제는 20초·30/45/55초·5초, 규칙은 같음. 가짜 창으로 보는 것은 live-fewer-requests).
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { writeFiles } from '../node.js';
import { kitBuild, tinySite } from './kit-site.mjs';
import { startNodeServer, api } from './live-helpers.mjs';

const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require('playwright')); } catch { try { ({ chromium } = createRequire('/opt/node-tools/')('playwright')); } catch { /* 없음 */ } }
const skip = !chromium && 'playwright is not installed';
const ADMIN = '기다림-시험-관리자키-2026';
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 20000, step = 50) => { const t0 = Date.now(); for (;;) { if (await fn()) return true; if (Date.now() - t0 > ms) return false; await sleep(step); } };
const P1 = '<p><a id="go" href="wrap.html">마무리</a></p><div data-lp="qa"></div><div data-lp="poll" data-id="p1" data-question="첫 투표" data-options=\'["가","나"]\'></div>';
const P2 = '<p><a id="back" href="index.html">처음</a></p><div data-lp="poll" data-id="p2" data-question="마무리 퀴즈" data-options=\'["하나","둘"]\'></div>';

/** 사이트를 조립하고, 쪽에 실린 실시간 설정에 짧은 기다림을 넣음(시험이 빨리 돌게) */
function build(code) {
  const site = tinySite(P1); site['wrap.html'] = tinySite(P2)['index.html'];
  const files = kitBuild({ site, meta: { features: ['qa', 'poll'], sessions: [{ date: today, start: '00:00', end: '23:59' }] }, prev: { live: { provider: 'http', url: '', code } }, today }).files;
  for (const k of Object.keys(files)) {
    if (!/\.html$/.test(k)) continue;
    const s = String(files[k]);
    if (!s.includes('"live":{')) continue;
    files[k] = s.replace('"live":{', '"live":{"waitS":2,"waitSteps":[4,6],').replace(/"pollMs":\d+/, '"pollMs":2000');
  }
  return files;
}

/** 사이에 낀 대리 서버. dropAfter(ms): 이보다 오래 걸린 답은 버리고 연결은 그대로 둠(조용히 끊는 망) */
function startProxy(target, { dropAfter = 0 } = {}) {
  const t = new URL(target); const log = [];
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (/\/events$/.test(u.pathname)) { res.writeHead(404); res.end(); return; } // SSE 막힘
    const e = { path: u.pathname.replace(/^\/api\/[^/]+/, ''), wait: Number(u.searchParams.get('wait')) || 0, probe: u.searchParams.get('probe') === '1', at: Date.now(), done: false, dropped: false, gone: false };
    if (u.pathname.startsWith('/api/') && u.pathname !== '/api/lan') log.push(e);
    const up = http.request({ host: t.hostname, port: t.port, path: req.url, method: req.method, headers: { ...req.headers, host: t.host } }, (ur) => {
      if (dropAfter && Date.now() - e.at >= dropAfter) { e.dropped = true; ur.resume(); return; }
      res.writeHead(ur.statusCode, ur.headers); ur.pipe(res);
      ur.on('end', () => { e.done = true; e.doneAt = Date.now(); });
    });
    up.on('error', () => { try { res.destroy(); } catch { /* 닫힘 */ } });
    req.pipe(up);
    res.on('close', () => { if (!e.done) { e.gone = true; up.destroy(); } }); // 브라우저가 그만둠
  });
  server.on('upgrade', (req, socket) => socket.destroy()); // 웹소켓 막힘
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => {
    const reals = () => log.filter((x) => x.path === '/snapshot' && x.wait && !x.probe);
    ok({
      url: `http://127.0.0.1:${server.address().port}`, log, reals, probes: () => log.filter((x) => x.probe),
      /** 실제 묻기 하나가 지금 붙잡혀 있는지 */
      flying: (w) => { const l = reals().at(-1); return !!l && !l.done && !l.gone && !l.dropped && (!w || l.wait === w) && Date.now() - l.at > 200; },
      close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); }),
    });
  }));
}

let srv, browser, dir, quiet, clean;
before(async () => {
  if (skip) return;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-wait-probe-'));
  writeFiles(path.join(dir, 'a'), build('QUIETNET'));
  writeFiles(path.join(dir, 'b'), build('CLEANNET'));
  srv = await startNodeServer({ adminKey: ADMIN, staticDir: dir });
  quiet = await startProxy(srv.url, { dropAfter: 3000 });
  clean = await startProxy(srv.url);
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); await quiet?.close(); await clean?.close(); await srv?.close(); if (dir) fs.rmSync(dir, { recursive: true, force: true }); });

const bandHas = (p, word, yes, ms = 15000) => p.waitForFunction(([w, y]) => (document.querySelector('[data-now-main]')?.textContent || '').includes(w) === y, [word, yes], { timeout: ms });
/** 강사가 투표를 열거나 닫은 때부터 이 화면의 '지금' 줄이 바뀔 때까지(ms). 실제 묻기가 붙잡혀 있는 때를 골라 바꿈(쉬는 틈에 바꾸면 전에도 그 틈만큼 걸림) */
async function reaction(page, proxy, code, open, w) {
  assert.ok(await until(() => proxy.flying(w), 20000), '실제 묻기가 붙잡혀 있는 때를 잡음');
  const t0 = Date.now();
  await api(srv.url, code).call('PUT', '/state', { admin: ADMIN, body: { openPoll: open ? 'p1' : null } });
  await bandHas(page, '첫 투표', open);
  return Date.now() - t0;
}

describe('긴 대기의 기다림 올리기(실제 브라우저)', { concurrency: true }, () => {
  test('조용히 끊는 망: 시험 요청만 돌아오지 않고, 강사가 바꾼 것은 시험 중에도 뒤에도 전과 같은 빠르기로 온다. 실제 묻기는 한 번도 길어지지 않는다', { skip, timeout: 150000 }, async (t) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
    try {
      await p.goto(quiet.url + '/a/index.html');
      assert.ok(await until(() => quiet.reals().length >= 1, 15000), '묻기 방식(웹소켓·SSE 막힘)으로 긴 대기를 씀');
      const lag = [];
      lag.push(await reaction(p, quiet, 'QUIETNET', true)); // 시험 전
      // 첫 시험 요청(가장 긴 값)이 나가 있는 동안
      assert.ok(await until(() => quiet.probes().length === 1, 40000), '조용해지면 시험 요청을 한 번 보냄');
      assert.equal(quiet.probes()[0].wait, 6);
      lag.push(await reaction(p, quiet, 'QUIETNET', false));
      await sleep(1500);
      if (!quiet.probes()[0].gone) lag.push(await reaction(p, quiet, 'QUIETNET', true));
      // 돌아오지 않음 → 그 값은 버리고 다음 값을 시험, 그것도 돌아오지 않음 → 올리지 않음
      assert.ok(await until(() => quiet.probes().length === 2, 60000), '다음 값을 시험');
      assert.equal(quiet.probes()[1].wait, 4);
      lag.push(await reaction(p, quiet, 'QUIETNET', !(await p.evaluate(() => (document.querySelector('[data-now-main]')?.textContent || '').includes('첫 투표')))));
      assert.ok(await until(() => quiet.probes()[1].gone, 20000));
      const n = quiet.reals().length;
      assert.ok(await until(() => quiet.reals().length >= n + 3, 30000));
      lag.push(await reaction(p, quiet, 'QUIETNET', !(await p.evaluate(() => (document.querySelector('[data-now-main]')?.textContent || '').includes('첫 투표')))));
      t.diagnostic(`조용히 끊는 망: 강사가 바꾼 것이 보일 때까지 ${lag.join('·')}ms(시험 전·시험 중·뒤), 실제 묻기 ${quiet.reals().length}번 모두 2초, 시험 요청 ${quiet.probes().map((x) => x.wait)}초`);
      assert.ok(lag.every((x) => x < 1500), `바뀐 것은 늘 바로 옴(${lag}ms)`);
      assert.ok(quiet.probes().every((x) => x.dropped && !x.done), '시험 요청은 망이 조용히 끊음');
      assert.ok(quiet.reals().every((x) => x.wait === 2), `실제 묻기는 한 번도 긴 기다림으로 가지 않음(${quiet.reals().map((x) => x.wait)})`);
      assert.ok(quiet.reals().every((x) => !x.dropped), '끊긴 실제 묻기가 없음');
      assert.equal(quiet.probes().length, 2, '더 시험하지 않음');
      assert.deepEqual(errs, []);
    } finally { await ctx.close(); }
  });

  test('끊지 않는 망: 시험 요청이 제때 돌아온 뒤에만 기다림을 올린다. 올린 뒤에도 바뀐 것은 바로 오고, 쪽을 옮겨도 다시 시험하지 않는다', { skip, timeout: 150000 }, async (t) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
    try {
      await p.goto(clean.url + '/b/index.html');
      assert.ok(await until(() => clean.probes().length === 1, 40000), '조용해지면 시험 요청을 한 번 보냄');
      const pr = clean.probes()[0];
      assert.equal(pr.wait, 6);
      // 시험 중: 실제 묻기는 2초 그대로, 바뀐 것은 바로
      const d1 = await reaction(p, clean, 'CLEANNET', true);
      assert.ok(d1 < 1500, `시험 중에도 바로 옴(${d1}ms)`);
      assert.ok(await until(() => pr.done, 15000), '시험 요청이 돌아옴');
      assert.ok(pr.doneAt - pr.at >= 5900 && pr.doneAt - pr.at < 9000, `청한 6초를 다 채우고 돌아옴(${pr.doneAt - pr.at}ms)`);
      assert.ok(clean.reals().filter((x) => x.at < pr.doneAt).every((x) => x.wait === 2), '시험이 끝나기 전의 실제 묻기는 모두 2초');
      // 올린 뒤: 6초 기다리는 도중에 바뀐 것도 바로
      assert.ok(await until(() => clean.reals().some((x) => x.wait === 6), 15000), '통과한 뒤에 실제 묻기를 6초로');
      const d2 = await reaction(p, clean, 'CLEANNET', false, 6);
      assert.ok(d2 < 1500, `올린 뒤에도 바로 옴(${d2}ms)`);
      t.diagnostic(`끊지 않는 망: 강사가 바꾼 것이 보일 때까지 시험 중 ${d1}ms·올린 뒤 ${d2}ms, 실제 묻기의 기다림 ${clean.reals().map((x) => x.wait).join(',')}초`);
      // 쪽을 옮김: 첫 긴 대기부터 6초, 시험 요청은 다시 보내지 않음
      const n = clean.reals().length;
      await p.click('#go'); await p.waitForURL(/wrap\.html/);
      assert.ok(await until(() => clean.reals().length >= n + 2, 30000));
      assert.ok(clean.reals().slice(n).filter((x) => x.at > Date.now() - 60000).slice(-2).every((x) => x.wait === 6), `옮긴 쪽도 확인된 기다림에서 이어감(${clean.reals().slice(n).map((x) => x.wait)})`);
      assert.equal(clean.probes().length, 1, '쪽을 옮겨도 다시 시험하지 않음');
      const t0 = Date.now(); assert.ok(await until(() => clean.flying(6), 20000));
      await api(srv.url, 'CLEANNET').call('PUT', '/state', { admin: ADMIN, body: { openPoll: 'p1' } });
      await bandHas(p, '첫 투표', true);
      assert.ok(Date.now() - t0 < 20000);
      assert.deepEqual(errs, []);
    } finally { await ctx.close(); }
  });
});
