// 보안 검토(2026-11b) 회귀 시험: 교재 읽기의 느려짐, 마크다운 소제목의 느려짐, 짧은 주소와 QR.
// 근거: docs/research/security-review-2026-11b.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import * as E from '../src/index.js';
import { ingestText } from '../src/ingest/index.js';
import { nodeRuntime, writeFiles } from '../node.js';
import { tinySite } from './kit-site.mjs';

const ms = (fn) => { const t = performance.now(); fn(); return performance.now() - t; };

test('교재 읽기: 띄어쓰기 없는 아주 긴 낱말에서 멈추지 않음', () => {
  for (const ch of ['가', 'a', 'a1', '.']) {
    const s = ch.repeat(Math.ceil(60000 / ch.length));
    const t = ms(() => ingestText(`${s}\n\n${s}`, { today: '2026-11-12' }));
    assert.ok(t < 4000, `${ch}: ${Math.round(t)}ms`); // 고치기 전에는 '가' 10초·'a1' 1분 넘게
  }
  // 읽은 결과는 그대로
  const m = ingestText('# AI 수업 연수\n\n서울특별시교육청\n\n메일: gil.dong+lec@gaon.example.kr', { markdown: true });
  assert.equal(m.pages[0].title, 'AI 수업 연수');
});

test('M1 근본: 소제목 정규식이 빈칸이 길어도 빠르고, 닫는 #만 뗌', async () => {
  const { parseBlocks } = await import('../src/md-syntax.js');
  const t0 = Date.now();
  const b = parseBlocks('# a' + ' '.repeat(6000) + 'x');
  assert.ok(Date.now() - t0 < 200);
  assert.equal(b[0].type, 'h');
  assert.equal(parseBlocks('## 제목 ##')[0].text, '제목');
  assert.equal(parseBlocks('## C#')[0].text, 'C#');
});

test('L4: 코드와 붙은 주소에서 자리 표시 글자가 남지 않음', async () => {
  const { inlineMd } = await import('../src/render/markdown.js');
  const out = inlineMd('https://ok.example/`c` [a](https://x.example/`d`)');
  assert.ok(!out.includes('\u0000'));
  assert.ok(out.includes('<code>c</code>') && out.includes('<code>d</code>'));
});

// 런타임: 짧은 주소는 손으로 칠 글자에만. 파일로 연 안내문에서도 QR·복사에 짧은 주소를 넣지 않음(브라우저가 있을 때만)
const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require('playwright')); } catch { /* 없음 */ }test('짧은 주소: 파일로 연 안내문·발표 화면에서도 QR·복사에는 넣지 않음 · localhost로 연 쪽은 와이파이 주소로(모르면 바꾸는 법)', { skip: !chromium && 'playwright is not installed' }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lp-short-'));
  // 올린 사이트(http): 암호 보호 쪽은 Web Crypto가 필요해 이 컴퓨터 주소(127.0.0.1, 안전한 곳)로 엶. 이 주소는 휴대폰에서 열리지 않으므로
  // QR·복사에는 서버가 알려 주는 같은 와이파이 주소(/api/lan, Node 서버 흉내)를 씀
  let lan = '';
  const srv = createServer((q, s) => { if (q.url === '/api/lan') { s.writeHead(200, { 'content-type': 'application/json' }); s.end(JSON.stringify({ urls: lan ? [lan] : [] })); return; } const f = path.join(dir, decodeURIComponent(q.url.split('?')[0].split('#')[0]) || 'index.html'); if (!f.startsWith(dir) || !existsSync(f)) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8' }); s.end(readFileSync(f)); }).listen(0);
  await new Promise((r) => srv.once('listening', r));
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch();
  try {
    const r = E.assemble(tinySite('<div data-lp="qa"></div>'), { v: 2, title: '연수', features: ['qa'] }, { runtime: nodeRuntime(), prev: { shortUrl: 'https://is.gd/tomika' } });
    const files = await E.protectSite(r.files, '암호1234', { runtime: nodeRuntime(), title: '연수' });
    writeFiles(dir, files);
    const ctx = await browser.newContext();
    // 바깥 주소(글꼴·라이브러리)는 막음: 시험은 인터넷 없이
    await ctx.route('**/*', (rt) => (/^(file:|data:|blob:|http:\/\/127\.0\.0\.1)/.test(rt.request().url()) ? rt.continue() : rt.abort()));
    // 쪽마다 새 탭으로 엶(암호 보호 쪽은 열면서 주소의 #k=를 지움)
    const open = async (u) => { const pg = await ctx.newPage(); await pg.goto(u, { waitUntil: 'commit' }); return pg; };
    const K = '#k=' + encodeURIComponent('암호1234');
    // 파일로 연 안내문: 짧은 주소는 글자로, QR은 없음, 복사할 주소도 없음
    let page = await open(pathToFileURL(path.join(dir, 'poster.html')).href + K);
    await page.waitForFunction(() => window.LecPage?.urls && document.querySelector('[data-url-self]')?.textContent, null, { timeout: 15000 });
    assert.equal(await page.evaluate(() => window.LecPage.urls.join()), '');
    assert.equal((await page.textContent('[data-url-self]')).trim(), 'is.gd/tomika');
    assert.equal(await page.locator('[data-qr-self] svg').count(), 0);
    // 발표 화면: QR 없음(짧은 주소는 글자로)
    page = await open(pathToFileURL(path.join(dir, 'screen.html')).href + K);
    await page.waitForFunction(() => document.querySelector('[data-join-url]')?.textContent.includes('is.gd'), null, { timeout: 15000 });
    assert.equal(await page.locator('[data-qr-join] svg').count(), 0);
    // 서버가 와이파이 주소를 모르면: QR 대신 바꾸는 법, 복사할 주소 없음(127.0.0.1을 QR에 넣지 않음)
    page = await open(base + 'poster.html' + K);
    await page.waitForFunction(() => window.LecPage?.urls && document.querySelector('[data-qr-self] .lp-qr-off'), null, { timeout: 15000 });
    assert.equal(await page.evaluate(() => window.LecPage.urls.join()), '');
    assert.match(await page.textContent('[data-qr-self]'), /이 컴퓨터에서만 열려요/);
    // 와이파이 주소를 알면: QR·복사는 그 주소(+#k=), 짧은 주소는 글자로
    lan = `http://192.168.0.10:${srv.address().port}/`;
    page = await open(base + 'poster.html' + K);
    await page.waitForFunction(() => window.LecPage?.urls && document.querySelector('[data-qr-self] svg'), null, { timeout: 15000 });
    const join = await page.evaluate(() => window.LecPage.urls.join());
    assert.ok(join.startsWith(lan) && join.includes('#k='), join);
    assert.equal((await page.textContent('[data-url-self]')).trim(), 'is.gd/tomika');
  } finally {
    await browser.close(); srv?.close(); rmSync(dir, { recursive: true, force: true });
  }
});
