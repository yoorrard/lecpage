// 보안 검토(2026-11b) 회귀 시험: 글 칸 소제목의 느려짐, 교재 읽기의 느려짐, 강사 확인 전 주소, 짧은 주소와 QR.
// 근거: docs/research/security-review-2026-11b.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { zipSync, strToU8 } from '../vendor/fflate.js';
import * as E from '../src/index.js';
import { mdStr } from '../src/validate.js';
import { keepUrlText } from '../src/ingest/compose.js';
import { ingestFile, ingestText, materialToDraft } from '../src/ingest/index.js';
import { nodeRuntime, writeFiles } from '../node.js';

const ms = (fn) => { const t = performance.now(); fn(); return performance.now() - t; };
const site = (sections, meta = {}) => E.build({ meta: { title: '연수', ...meta }, sections: [{ type: 'hero' }, ...sections] }, { runtime: nodeRuntime() });

test('글 칸·FAQ 답: 소제목 줄의 긴 빈칸이 빌드를 멈추지 않음(줄여도 보이는 글자는 같음)', () => {
  const evil = '# 제목' + ' '.repeat(5900) + '끝';
  const t = ms(() => {
    const r = site([{ type: 'text', title: '글', md: evil }, { type: 'faq', title: '묻고 답하기', items: [{ q: '질문', a: '## 답' + ' '.repeat(1100) + '끝' }] }]);
    assert.equal(r.errors?.length || 0, 0);
    assert.match(r.files['index.html'], /<h3>제목 끝<\/h3>/);
  });
  assert.ok(t < 3000, `빌드 ${Math.round(t)}ms`); // 고치기 전에는 1분 넘게 걸림
  // 소제목이 아닌 줄(코드 들여쓰기·본문 빈칸)은 그대로
  assert.equal(mdStr('```\n    code\n```\n본문   여러 칸\n# 소제목    둘', 6000), '```\n    code\n```\n본문   여러 칸\n# 소제목 둘');
  assert.equal(mdStr('문단\r\n\r\n#  a  #', 100), '문단\n\n# a #');
});

test('교재 읽기: 띄어쓰기 없는 아주 긴 낱말에서 멈추지 않음(주최 줄·이메일 찾기)', () => {
  for (const ch of ['가', 'a', 'a1', '.']) {
    const s = ch.repeat(Math.ceil(60000 / ch.length));
    const t = ms(() => ingestText(`${s}\n\n${s}`, { today: '2026-11-12' }));
    assert.ok(t < 4000, `${ch}: ${Math.round(t)}ms`); // 고치기 전에는 '가' 10초·'a1' 1분 넘게
  }
  // 찾는 결과는 그대로
  const m = ingestText('# AI 수업 연수\n\n서울특별시교육청\n\n강사 소개\n\n홍길동\n\n가온초등학교 교사\n\n메일: gil.dong+lec@gaon.example.kr', { today: '2026-11-12' });
  assert.equal(m.detected.event.organizer, '서울특별시교육청');
});

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const wp = (t, style = '') => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
const docx = (paras, extra = {}) => zipSync({
  '[Content_Types].xml': strToU8('<Types/>'),
  'word/document.xml': strToU8(`<w:document ${W}><w:body>${paras.join('')}</w:body></w:document>`),
  'word/styles.xml': strToU8(`<w:styles ${W}><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>`),
  ...extra,
});

test('교재에서 찾은 회의·설문 주소: 강사가 확인하기 전에는 초안 사이트에서 링크가 되지 않음(글자는 남음)', async () => {
  const ZOOM = 'https://zoom.us/j/9876543210?pwd=abc', FORM = 'https://forms.gle/AbCdEfGhIjKlMn';
  const m = await ingestFile('a.docx', docx([
    wp('학교폭력 사안 처리 연수', 'Heading1'), wp('일시: 2026. 12. 10.(목) 15:30~17:00'),
    wp('1. 연수 안내', 'Heading1'), wp('온라인으로 함께하실 분은 아래 주소로 들어오세요.'), wp(`줌 입장: ${ZOOM}.`), wp(`만족도 조사: ${FORM}`),
    wp('2. 처리 절차', 'Heading1'), wp('사안을 알게 되면 바로 보고합니다. 서식은 https://example.org/form 에 있습니다.'),
    wp('3. 문의', 'Heading1'), wp('문의는 교무실로 합니다.'),
  ]), { today: '2026-11-12' });
  assert.deepEqual([m.detected.addresses.join[0]?.url, m.detected.addresses.survey[0]?.url], [ZOOM, FORM]);
  const draft = materialToDraft(m, E.draftInfo({ title: '연수', today: '2026-11-12' }, false));
  assert.equal(draft.meta.joinUrl, '');
  const html = E.build(draft, { runtime: nodeRuntime() }).files['index.html'];
  for (const host of ['zoom.us', 'forms.gle']) {
    assert.ok(html.includes(host), `${host} 글자는 남음`);
    assert.ok(!new RegExp(`href="[^"]*${host.replace('.', '\\.')}`).test(html), `${host}로 가는 링크 없음`);
  }
  assert.match(html, /href="https:\/\/example\.org\/form"/, '그 밖의 교재 주소는 그대로 링크');
  // 단위: 주소로 시작하는 덩어리를 감싸고 문장부호는 밖에 둠, 다른 주소는 그대로
  const skip = new Set([ZOOM]);
  assert.equal(keepUrlText(`입장: ${ZOOM}. 또는 ${ZOOM}&x=1 / https://a.example`, skip), `입장: \`${ZOOM}\`. 또는 \`${ZOOM}&x=1\` / https://a.example`);
  assert.equal(keepUrlText('주소 없음', skip), '주소 없음');
});

test('개인정보 설정: AI 답·가져온 파일이 받을 정보·동의·처리자 목록을 바꾸지 못함(강사가 정한 값만)', () => {
  const ai = { meta: { title: 'AI' }, sections: [{ type: 'hero' }, { type: 'qa' }],
    privacy: { collect: ['nickname', 'name', 'school', 'email'], retentionDays: 365, consent: false, processors: [{ name: '가짜 처리자', country: '어딘가' }], contact: 'evil@example.com' } };
  // 처음 만들 때: 기본값(별명만·30일·동의 받음·처리자 없음)
  let bp = E.applyInfo(structuredClone(ai), { title: '연수', features: ['qa'] }, null, null);
  assert.deepEqual(bp.privacy, { collect: ['nickname'], retentionDays: 30, consent: true, processors: [] });
  // 다시 만들 때: 강사가 고른 값(이름·소속, 60일)을 지킴
  const prev = { privacy: { collect: ['nickname', 'name', 'school'], retentionDays: 60, consent: true, processors: [] }, live: { features: ['qa'] } };
  bp = E.applyInfo(structuredClone(ai), { title: '연수', features: ['qa'] }, null, prev);
  assert.deepEqual(bp.privacy, prev.privacy);
  // 출석을 켜면 이름·소속(동의 상자와 함께)
  bp = E.applyInfo(structuredClone(ai), { title: '연수', features: ['attendance'] }, null, null);
  assert.deepEqual([bp.privacy.collect, bp.privacy.consent], [['nickname', 'name', 'school'], true]);
  // 가져온 파일: 받을 정보·보관 기간은 받고(앱에서 보임), 동의 생략·처리자·문의처는 버림
  const imp = E.sanitizeImported(structuredClone(ai));
  assert.deepEqual(imp.privacy, { collect: ['nickname', 'name', 'school', 'email'], retentionDays: 365, consent: true, processors: [] });
  const html = E.build({ ...imp, live: { provider: 'local', features: ['qa'] } }, { runtime: nodeRuntime() }).files['privacy.html'];
  assert.match(html, /365일/);
  assert.ok(!html.includes('가짜 처리자') && !html.includes('evil@example.com'));
});

// 런타임: 짧은 주소는 손으로 칠 글자에만. 파일로 연 안내문에서도 QR·복사에 짧은 주소를 넣지 않음(브라우저가 있을 때만)
const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require('playwright')); } catch { /* 없음 */ }
test('짧은 주소: 파일로 연 안내문·발표 화면에서도 QR·복사에는 넣지 않음', { skip: !chromium && 'playwright is not installed' }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lp-short-'));
  const browser = await chromium.launch();
  let srv;
  try {
    const bp = { meta: { title: '연수', shortUrl: 'https://is.gd/tomika' }, sections: [{ type: 'hero' }, { type: 'qa' }], live: { provider: 'local', features: ['qa'] } };
    const r = E.build(bp, { runtime: nodeRuntime() });
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
    // 올린 사이트(http): QR·복사는 그 페이지 주소, 짧은 주소는 글자로
    srv = createServer((q, s) => { const f = path.join(dir, decodeURIComponent(q.url.split('?')[0].split('#')[0]) || 'index.html'); if (!f.startsWith(dir) || !existsSync(f)) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8' }); s.end(readFileSync(f)); }).listen(0);
    const base = `http://127.0.0.1:${srv.address().port}/`;
    page = await open(base + 'poster.html' + K);
    await page.waitForFunction(() => window.LecPage?.urls && document.querySelector('[data-qr-self] svg'), null, { timeout: 15000 });
    const join = await page.evaluate(() => window.LecPage.urls.join());
    assert.ok(join.startsWith(base) && join.includes('#k='), join);
    assert.equal((await page.textContent('[data-url-self]')).trim(), 'is.gd/tomika');
  } finally {
    await browser.close(); srv?.close(); rmSync(dir, { recursive: true, force: true });
  }
});
