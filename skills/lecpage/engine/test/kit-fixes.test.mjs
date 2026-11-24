// 키트·조립·검수 흠 고치기(레퍼런스·Skill 실제 제작·화면 작업에서 찾은 것):
// 쪽 제목 고치기(lecpage.json pages)와 뽑기, 강조색 위 글자색 자동, 실습 진행 표시, check 화면 그림(늦은 그림·움직임), 보조 쪽 색·제목 글꼴,
// '종료' 줄, 키트 위젯(390), 글꼴 함께 담기·암호 잠그기(조립 결과), 그려서 검수의 말줄임·이름표 누를 곳.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
import * as K from '../src/kit/index.js';
import * as E from '../src/index.js';
import { buildPage } from '../src/ingest/pdf.js';
import { nodeRuntime, writeFiles } from '../node.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const SKILL = path.join(HERE, '..', '..');
const CLI = path.join(SKILL, 'scripts', 'lecpage.mjs');
const REF = path.join(SKILL, 'engine', 'test', 'fixtures', 'ref-site');
const rt = nodeRuntime();
const WEBP = fs.readFileSync(path.join(REF, 'site', 'material', 'p-001.webp'));
const PAGE = (body, head = '') => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>시험 연수</title>${head}</head><body><main><h1>시험 연수</h1>${body}</main></body></html>`;
const META = { v: 2, title: '시험 연수', sessions: [{ date: '2026-12-03', start: '14:00', end: '17:00' }], features: ['qa', 'poll', 'help', 'survey', 'deck'], theme: { accent: '#b33a1f', ink: '#1a1d21', paper: '#f7f5ef' } };
const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require('playwright')); } catch { /* 없음 */ }
const skip = !chromium && 'playwright is not installed';
function serveDir(dir) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
  return http.createServer((req, res) => {
    const p = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
    if (!p.startsWith(dir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
  });
}
async function withSite(files, fn, { width = 390, scheme = 'light' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-kitfix-'));
  writeFiles(dir, files);
  const srv = serveDir(dir); await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 800 }, colorScheme: scheme });
    await fn(await ctx.newPage(), `http://127.0.0.1:${srv.address().port}/`);
  } finally { await browser.close(); srv.close(); fs.rmSync(dir, { recursive: true, force: true }); }
}

// ── 1. 쪽 제목 ──────────────────────────────────────────
test('쪽 제목: lecpage.json pages가 교재에서 뽑은 제목을 덮고(쓴 쪽만, 빈 글이면 제목 없음), 엉킨 제목은 비움', () => {
  const { meta, warnings } = K.readMeta({ ...META, pages: [{ page: 1, title: '표지 · 데이터로 읽는 우리 반' }, { page: 3, title: '' }, { page: 'x' }, { n: 2, title: '들어가며' }] });
  assert.deepEqual(meta.pages, [{ page: 1, title: '표지 · 데이터로 읽는 우리 반' }, { page: 2, title: '들어가며' }, { page: 3, title: '' }]);
  assert.ok(warnings.some((w) => w.code === 'pages-page'));
  assert.equal(K.readMeta(META).meta.pages, undefined, '없으면 칸도 없음');
  assert.equal(K.tangledTitle('데이터로 A 날짜 B 번호 C 활동 D 점수 E 제출 읽는 우리 반'), true);
  assert.equal(K.tangledTitle('실습 1. 제미나이로 영상 요약하기'), false);
  const site = { 'index.html': PAGE('<section><h2>교재</h2><div data-lp="deck" data-pages="1-4"></div></section>'), ...Object.fromEntries([1, 2, 3, 4].map((n) => [`material/p-00${n}.webp`, WEBP])) };
  const material = { pages: [{ page: 1, title: '데이터로 A 날짜 B 번호 C 활동 읽는 우리 반' }, { page: 2, title: '기록은 쌓였는데' }, { page: 3, title: '세 시간' }, { page: 4, title: '시작 전에' }] };
  const r = K.assemble(site, { ...META, pages: [{ page: 1, title: '표지 · 데이터로 읽는 우리 반' }, { page: 3, title: '' }] }, { runtime: rt, material });
  const titles = [...r.files['index.html'].matchAll(/<figure class="lp-slide"[^>]*data-page="(\d+)" data-title="([^"]*)"/g)].map((m) => [+m[1], m[2]]);
  assert.deepEqual(titles, [[1, '표지 · 데이터로 읽는 우리 반'], [2, '기록은 쌓였는데'], [3, ''], [4, '시작 전에']]);
  assert.deepEqual(r.collected.untitled, [3]);
  // 엉킨 제목은 pages가 없어도 비움
  const r2 = K.assemble(site, META, { runtime: rt, material });
  assert.match(r2.files['index.html'], /data-page="1" data-title=""/);
  // 강사 화면 쪽 목록(설계도)도 같은 제목
  assert.equal(r.blueprint.sections.find((s) => s.type === 'deck').slides[0].title, '표지 · 데이터로 읽는 우리 반');
});

test('쪽 제목 뽑기(pdf.js 길): 같은 높이의 작은 표 머리·큰 번호를 섞지 않고, 두 단 제목은 " · ", 셋 이상 갈리면 비움', () => {
  const H = 540, vp = { width: 960, height: H, scale: 1, transform: [1, 0, 0, -1, 0, H] };
  const it = (str, x, y, size) => ({ str, transform: [size, 0, 0, size, x, H - y], width: [...str].length * size * 0.9, fontName: 'f' });
  const page = (items) => buildPage({}, items, [], vp, 1, { fileId: 'deck1' });
  // 표지: 큰 제목 두 줄 + 첫 줄과 같은 높이의 작은 표 머리
  const cover = page([it('데이터로', 60, 186, 69), ...['A 날짜', 'B 번호', 'C 활동', 'D 점수', 'E 제출'].map((t, i) => it(t, 577 + i * 66, 184, 9)), it('읽는 우리 반', 60, 260, 69), it('흩어진 학습 기록을 표로 모으고', 60, 300, 15.8)]);
  assert.equal(cover.title, '데이터로 읽는 우리 반');
  // 부 시작: 아주 큰 번호 '1'과 제목이 같은 높이
  assert.equal(page([it('1', 60, 238, 135), it('한 줄에', 150, 238, 48), it('한 번의 기록', 150, 294, 48), it('모양이 같아야 셀 수 있어요.', 150, 335, 15)]).title, '한 줄에 한 번의 기록');
  // 두 단 제목
  assert.equal(page([it('오늘 쓰는 말 네 개', 60, 112, 30), it('세 문제', 504, 112, 30), it('피벗 테이블', 60, 154, 11.6)]).title, '오늘 쓰는 말 네 개 · 세 문제');
  // 큰 글자가 셋 이상으로 갈림 → 엉킨 제목이라 비움
  assert.equal(page([it('가', 60, 112, 30), it('나', 400, 112, 30), it('다', 800, 112, 30), it('본문 글이에요', 60, 160, 12)]).title, '');
});

test('쪽 제목 뽑기(ingest.py 길): 레퍼런스 교재 PDF에서 엉키던 제목(표 머리·큰 번호·두 단)', { skip: spawnSync('python3', ['-c', 'import fitz'], { encoding: 'utf8' }).status !== 0 && 'PyMuPDF가 없음' }, () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-py-'));
  try {
    const r = spawnSync('python3', [path.join(SKILL, 'scripts', 'ingest.py'), path.join(REF, 'material', '교재.pdf'), '-o', path.join(out, 'm.json')], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const m = JSON.parse(fs.readFileSync(path.join(out, 'm.json'), 'utf8'));
    const t = Object.fromEntries(m.pages.map((p) => [p.page, p.title]));
    assert.equal(t[1], '데이터로 읽는 우리 반');
    assert.equal(t[3], '세 시간, 다섯 번의 실습');
    assert.equal(t[5], '한 줄에 한 번의 기록');
    assert.equal(t[10], '차트는 질문에서 시작해요');
    assert.equal(t[12], '한눈에 보이게 그리기');
    assert.equal(t[16], '오늘 쓰는 말 네 개 · 세 문제');
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

// ── 2·3·7. 키트 CSS·런타임 ──────────────────────────────
test('접속 확인: 앱의 미리보기(출처 없는 틀)에서는 재지 않고 배포한 사이트에서 하라고 알림(틀 때문에 저장소·바깥 주소가 막혀 잘못 알리던 것)', () => {
  const js = fs.readFileSync(path.join(SKILL, 'engine', 'runtime', 'check.js'), 'utf8');
  const at = js.indexOf("getAttribute('data-lp-preview') === '1'"); const run = js.lastIndexOf('\n  go();');
  assert.ok(at > 0 && run > at, '미리보기 표시를 먼저 보고 그다음에 확인을 시작');
  assert.match(js.slice(at, run), /미리보기에서는 확인하지 않아요[\s\S]*배포한 사이트에서 해요[\s\S]*return;/);
});
test('키트 CSS: 강조색 위 글자는 강조색 밝기로(상대 색), --lp-on-accent로 정할 수 있고, 옛 브라우저는 조립 값', () => {
  const css = fs.readFileSync(path.join(SKILL, 'engine', 'runtime', 'kit.css'), 'utf8');
  assert.match(css, /@supports \(color:color\(from red srgb-linear r g b\)\)\{\s*\.lpk\{\s*--_on-auto:color\(from var\(--_acf\) srgb-linear clamp\(0,\(\.1791 - /);
  // 칠하는 자리의 강조색(--_acf)은 currentColor로 내려가지 않음: 강조색·글자색을 정하지 않은 사이트에서 주 단추([입실 확인])가 흰 바탕에 흰 글자가 되던 것
  assert.match(css, /--_acf:var\(--lp-accent,var\(--lpk-accent,var\(--lp-ink,var\(--lpk-ink,CanvasText\)\)\)\);/);
  assert.match(css, /\.lpk \.lp-btn-primary\{background:var\(--_acf\);border-color:var\(--_acf\);color:var\(--_on\)\}/);
  assert.ok(!/background:var\(--_ac\);[^}]*color:var\(--_on\)/.test(css), '글자를 올리는 칠은 모두 --_acf');
  assert.match(css, /--_on:var\(--lp-on-accent,var\(--_on-auto,var\(--lpk-on-accent,Canvas\)\)\)/);
  assert.match(css, /\.lpk \.lp-follow\{[^}]*min-height:44px/);
  // 만족도 다섯 칸: 화면이 넓어도 카드 안에서 칸이 좁으면 '보통이에/요'로 쪼개지지 않게 설문 너비로도 가운데 이름을 숨김
  assert.match(css, /\.lpk \.lp-sv-scale \.lp-sv-opts\{container-type:inline-size\}\s*@container \(max-width:21rem\)\{[^@]*label:not\(:first-child\):not\(:last-child\) i\{position:absolute/);
  const r = K.assemble({ 'index.html': PAGE('<section><h2>질문</h2><div data-lp="qa"></div></section>') }, { ...META, theme: { accent: '#f08a6c' } }, { runtime: rt });
  assert.match(r.files['assets/kit.css'], /--lpk-on-accent:#000000/, '밝은 강조색이면 검정');
  const kit = fs.readFileSync(path.join(SKILL, 'references', 'kit.md'), 'utf8');
  for (const k of ['data-st-link', 'data-st-count', 'data-st-progress', '.lp-st.is-active', '--lp-on-accent', 'fontHeading', '"pages"'.replace(/"/g, '')]) assert.ok(kit.includes(k), k);
});

test('학부모 설명회(audience parents): 참가자 화면이 진행자를 "발표자"로 부르고, 이수가 없으니 도크에 출석 한 번 누르기를 붙이지 않음', () => {
  const site = { 'index.html': PAGE('<section><h2>순서</h2><div data-lp="poll" data-question="가장 궁금한 것은?" data-options=\'["평가","학교생활"]\'></div></section><section><h2>질문</h2><div data-lp="qa"></div></section><section><h2>자료</h2><div data-lp="materials"></div></section>') };
  const meta = { ...META, title: '신입생 학부모 설명회', audience: 'parents', features: ['qa', 'poll', 'materials'] };
  const files = K.assemble(site, meta, { runtime: rt }).files;
  const html = files['index.html'];
  assert.match(files['privacy.html'], /이 설명회를 운영하면서[\s\S]*설명회 중 질문[\s\S]*설명회 사이트로 돌아가기/);
  assert.doesNotMatch(files['privacy.html'], /연수(를|를 운영| 중| 사이트| 설정)/);
  assert.match(html, /발표자가 투표를 열면/);
  assert.match(html, /"host":"발표자"/);
  assert.doesNotMatch(html, /강사가 (투표|자료)/);
  assert.doesNotMatch(html, /data-dock-attend/);
  // 교사 연수는 그대로(강사·출석 한 번 누르기)
  const t = K.assemble(site, { ...meta, title: '시험 연수', audience: 'teachers' }, { runtime: rt }).files['index.html'];
  assert.match(t, /강사가 투표를 열면/);
  assert.match(t, /data-dock-attend/);
});

test('브라우저: 어두운 모드에서 강조색을 밝게 바꿔도 주 단추 글자 4.5:1 이상, 실습 진행 막대 최대=단계 수, 390에서 교재·설문 위젯이 겹침·작은 누를 곳 없음', { skip }, async () => {
  const site = {
    'index.html': PAGE(`<nav><p>내 진행 <b data-st-count></b></p><progress data-st-progress aria-label="완료한 실습"></progress><a href="#st-s1" data-st-link="s1">1</a> <a href="#st-s2" data-st-link="s2">2</a></nav>
<section data-lp-step="s1" data-title="1단계: 열기"><h2>1단계</h2><p>열어요.</p></section><section data-lp-step="s2" data-title="2단계: 쓰기"><h2>2단계</h2><p>써요.</p></section>
<section><h2>질문</h2><div data-lp="qa"></div></section><section><h2>교재</h2><div data-lp="deck" data-pages="1-3"></div></section>
<section><h2>설문</h2><div data-lp="survey" data-questions='[{"q":"연수에 전반적으로 만족하시나요?","kind":"scale"},{"q":"진행 속도는 어땠나요?","kind":"choice","options":["빨랐어요","알맞았어요","느렸어요"]}]'></div></section>`, '<link rel="stylesheet" href="assets/style.css">'),
    'assets/style.css': ':root{--lp-accent:#b33a1f;--lp-ink:#1a1d21;--lp-paper:#f7f5ef}@media (prefers-color-scheme:dark){:root{--lp-accent:#f08a6c;--lp-ink:#ece8df;--lp-paper:#202327}}body{background:var(--lp-paper);color:var(--lp-ink);margin:0;padding:0 16px;font-family:sans-serif}',
    'material/p-001.webp': WEBP, 'material/p-002.webp': WEBP, 'material/p-003.webp': WEBP,
  };
  const r = K.assemble(site, META, { runtime: rt });
  await withSite(r.files, async (page, base) => {
    await page.goto(base + '?phase=during');
    await page.waitForSelector('.lp-deck.is-ready');
    const ratio = await page.evaluate(() => {
      const b = document.querySelector('[data-qa-form] .lp-btn-primary'); const cs = getComputedStyle(b);
      const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
      const rgb = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
      const lum = (c) => { const a = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };
      const [x, y] = [lum(rgb(cs.color)), lum(rgb(cs.backgroundColor))];
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    });
    assert.ok(ratio >= 4.5, `어두운 모드 주 단추 대비 ${ratio.toFixed(2)}`);
    assert.deepEqual(await page.evaluate(() => { const p = document.querySelector('[data-st-progress]'); return [p.max, p.value, document.querySelector('[data-st-count]').textContent]; }), [2, 0, '0 / 2']);
    await page.click('[data-st="s1"] [data-done]');
    assert.equal(await page.evaluate(() => document.querySelector('[data-st-link="s1"]').classList.contains('is-done')), true);
    assert.equal(await page.evaluate(() => document.querySelector('[data-st-progress]').value), 1);
    // '강사 따라 넘기기'가 보일 때(참여 서버에 이어졌을 때)도 누를 곳이 충분히 큼
    await page.evaluate(() => { document.querySelector('.lp-follow').hidden = false; });
    await K.settlePage(page);
    const issues = await page.evaluate(`${K.inspectRenderedSource}({ file: 'index.html' })`);
    const kitIssues = issues.filter((x) => /data-lp="(deck|survey)"|lp-deck|lp-sv|lp-follow/.test(x.where.selector + x.message_ko));
    assert.deepEqual(kitIssues, [], JSON.stringify(kitIssues));
    const follow = await page.evaluate(() => { const r = document.querySelector('.lp-follow').getBoundingClientRect(); return [r.width, r.height]; });
    assert.ok(follow[1] >= 44, '따라 넘기기 높이 ' + follow[1]);
  }, { scheme: 'dark' });
});

// ── 4. check 화면 그림: 늦게 받는 그림·화면에 들어와야 도는 움직임 ──
test('브라우저: settlePage 뒤에는 lazy 그림이 받아지고, 화면에 들어와야 도는 움직임이 끝 상태(전체 그림이 빈 그림·시작 전 모습이 아님)', { skip }, async () => {
  const filler = Array.from({ length: 8 }, (_, i) => `<section><h2>칸 ${i + 1}</h2><p style="height:500px">글</p></section>`).join('');
  const files = {
    'index.html': `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>t</title><style>html{scroll-behavior:smooth}.rv{opacity:0;transform:translateY(40px);transition:opacity 3s,transform 3s}.rv.in{opacity:1;transform:none}</style></head><body><main><h1>t</h1>${filler}<section><h2>끝</h2><img id="late" src="p.webp" loading="lazy" width="300" height="170" alt="교재"><p class="rv" id="rv">들어오면 보이는 글</p></section></main>
<script>new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)e.target.classList.add('in')})}).observe(document.getElementById('rv'))</script></body></html>`,
    'p.webp': WEBP,
  };
  await withSite(files, async (page, base) => {
    await page.goto(base);
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => document.getElementById('late').complete && document.getElementById('late').naturalWidth > 0), false, '처음에는 아직 안 받음');
    await K.settlePage(page);
    const st = await page.evaluate(() => ({ img: document.getElementById('late').naturalWidth, op: getComputedStyle(document.getElementById('rv')).opacity, y: scrollY }));
    assert.ok(st.img > 0, '그림을 받음');
    assert.equal(st.op, '1', '움직임 끝 상태');
    assert.equal(st.y, 0, '맨 위로 돌아옴(부드러운 스크롤 설정과 상관없이)');
  });
});

// ── 5·9. 보조 쪽 색·제목 글꼴 ───────────────────────────
test('보조 쪽: 장식색(accent·accent-2·accent-3)도 사이트 색(바탕·글자·강조)에서만, 밝게·어둡게 양쪽, theme.fontHeading이 제목 글꼴', () => {
  const r = K.assemble({ 'index.html': PAGE('<section><h2>질문</h2><div data-lp="qa"></div></section>') }, { ...META, theme: { ...META.theme, font: 'IBM Plex Sans KR', fontHeading: 'Noto Serif KR' } }, { runtime: rt });
  const css = r.files['assets/theme.css'];
  const last = (theme) => { const all = [...css.matchAll(new RegExp(`:root\\[data-theme="${theme}"\\]\\{([^}]*)\\}`, 'g'))]; return Object.fromEntries(all.pop()[1].split(';').map((x) => x.split(':'))); };
  const L = last('light'), D = last('dark');
  assert.equal(L['--background'], '#f7f5ef'); assert.equal(L['--foreground'], '#1a1d21'); assert.equal(L['--primary'], '#b33a1f');
  for (const t of [L, D]) for (const k of ['--accent', '--accent-2', '--accent-3']) assert.ok(t[k] && !['#8fa5ff', '#ff7a59', '#ffc247', '#6c82ff', '#ff9a80', '#ffd166'].includes(t[k]), `${k} ${t[k]}`);
  assert.equal(D['--background'], '#1a1d21', '어두운 쪽은 잉크 바탕');
  assert.equal(D['--foreground'], '#f7f5ef', '종이 글자');
  assert.ok(E.contrast(D['--primary'], D['--background']) >= 4.5);
  assert.match(css, /--font-display:'Noto Serif KR'/);
  assert.match(r.files['poster.html'], /family=Noto\+Serif\+KR/);
  // 사이트 CSS의 --lp-font-heading도 받음
  const r2 = K.assemble({ 'index.html': PAGE('<p>글</p>', '<style>:root{--lp-font-heading:\'Gowun Batang\',serif}</style>') }, META, { runtime: rt });
  assert.match(r2.files['assets/theme.css'], /--font-display:'Gowun Batang'/);
});

// ── 6. '종료' 줄 ─────────────────────────────────────────
test('끝난 연수 줄: 자리를 정한 지금 줄(data-lp="now")에도 들어가고, 키트 상자 밖에 있으면 런타임이 키트 상자에 넣어 모양을 갖춤', { skip }, async () => {
  const ended = { ...META, sessions: [{ date: '2026-11-04', start: '15:10', end: '16:40' }] };
  const placed = K.assemble({ 'index.html': PAGE('<div data-lp="now"></div><section><h2>질문</h2><div data-lp="qa"></div></section>') }, ended, { runtime: rt });
  assert.match(placed.files['index.html'], /class="lpk lpk-now lpk-now--placed"[^>]*>[\s\S]*?data-phase-bar hidden[\s\S]*?2026\. 11\. 4\./);
  // 조립 결과를 사이트에 다시 옮겨 쓰는 등으로 '종료' 줄이 키트 상자 밖에 놓인 경우
  const r = K.assemble({ 'index.html': PAGE('<section><h2>질문</h2><div data-lp="qa"></div></section>') }, ended, { runtime: rt });
  const html = r.files['index.html'].replace(/<div class="lpk lpk-now">([\s\S]*?)<\/div>\n<\/div>/, (m) => m).replace(/(<div class="lp-now lp-phase" data-phase-bar hidden>[\s\S]*?<\/p><\/div><\/div>)/, '').replace('<main>', '<main><div class="lp-now lp-phase" data-phase-bar hidden><div class="lp-now-in"><span class="lp-now-tag">종료</span><p class="lp-now-text"><b>끝난 연수예요.</b></p></div></div>');
  await withSite({ ...r.files, 'index.html': html }, async (page, base) => {
    await page.goto(base + '?phase=after');
    await page.waitForFunction(() => { const b = document.querySelector('[data-phase-bar]'); return b && !b.hidden; });
    const st = await page.evaluate(() => { const b = document.querySelector('[data-phase-bar]'); const box = b.closest('.lpk'); return { inKit: !!box, pos: box && getComputedStyle(box).position, count: document.querySelectorAll('[data-phase-bar]').length }; });
    assert.deepEqual(st, { inKit: true, pos: 'fixed', count: 1 });
  });
});

// ── 8. 글꼴 함께 담기·암호 잠그기(조립 결과) ─────────────────
test('글꼴 함께 담기: AI가 쓴 <link>(속성 차례·따옴표·crossorigin 없음)와 CSS @import도 알아보고 사이트 안 fonts.css로, 미리 잇기는 뺌', async () => {
  const site = {
    'index.html': PAGE('<section><h2>질문</h2><div data-lp="qa"></div></section>', `<link rel="preconnect" href="https://fonts.googleapis.com"><link href='https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@700&display=swap' rel=stylesheet><link rel="stylesheet" href="assets/style.css">`),
    'assets/style.css': `@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;700&display=swap");\nbody{font-family:'IBM Plex Sans KR'}h1{font-family:'Gowun Batang'}`,
  };
  const r = K.assemble(site, META, { runtime: rt });
  const asked = [];
  const fakeFetch = async (u) => {
    asked.push(u);
    if (/fonts\.googleapis\.com/.test(u)) { const fam = /family=([^:&]+)/.exec(u)[1].replace(/\+/g, ' '); return new Response(`@font-face{font-family:'${fam}';font-style:normal;font-weight:400;src:url(https://fonts.gstatic.com/s/${fam.replace(/ /g, '')}.woff2) format('woff2');unicode-range:U+AC00-D7A3}`); }
    return new Response(new Uint8Array([119, 79, 70, 50, 0, 1, 0, 0, 1, 2, 3, 4]));
  };
  const fb = await E.bundleFonts(r.files, { fetch: fakeFetch, subset: false });
  assert.equal(fb.report.ok, true);
  const html = fb.files['index.html'];
  assert.doesNotMatch(html, /<link[^>]*fonts\.(googleapis|gstatic)\.com/, '쪽에 바깥 글꼴 링크·미리 잇기가 남지 않음');
  assert.match(html, /<link rel="stylesheet" href="assets\/fonts\.css">/);
  assert.doesNotMatch(fb.files['assets/style.css'], /@import/, 'CSS의 @import도 뺌');
  assert.match(fb.files['assets/fonts.css'], /Gowun Batang/);
  assert.match(fb.files['assets/fonts.css'], /IBM Plex Sans KR/);
  assert.ok(asked.some((u) => /Gowun\+Batang/.test(u)) && asked.some((u) => /IBM\+Plex\+Sans\+KR/.test(u)));
});

test('암호 잠그기(키트 조립 결과): 맨 위 모든 쪽(AI가 쓴 다른 쪽도)·강사·발표·안내문을 잠그고 교재 쪽 그림·자료실 파일은 .enc, 접속 확인·개인정보 안내는 열어 둠', async () => {
  const site = {
    'index.html': PAGE(`<section><h2>교재</h2><img src='material/p-001.webp' srcset='material/p-001.webp 1x' alt="1쪽"><div data-lp="deck" data-pages="1-2"></div><div data-lp="qa"></div></section><a href="./files/a.pdf">자료</a>`),
    'day2.html': PAGE('<section><h2>둘째 날</h2><p>둘째 날 내용</p></section>'),
    'material/p-001.webp': WEBP, 'material/p-002.webp': WEBP, 'files/a.pdf': new Uint8Array([37, 80, 68, 70]),
  };
  const r = K.assemble(site, META, { runtime: rt });
  const out = await E.protectSite(r.files, '봄비연필운동장', { runtime: rt, title: '시험 연수', crypto: webcrypto, iterations: 1000 });
  for (const p of ['index.html', 'day2.html', 'console.html', 'screen.html', 'poster.html']) assert.match(out[p], /id="lp-locked"/, p);
  for (const p of ['check.html', 'privacy.html']) assert.doesNotMatch(out[p], /id="lp-locked"/, p);
  assert.ok(!out['day2.html'].includes('둘째 날 내용'));
  for (const p of ['material/p-001.webp', 'material/p-002.webp', 'files/a.pdf']) { assert.ok(out[p + '.enc'], p); assert.equal(out[p], undefined, p); }
});

test('CLI 새 흐름: publish --password는 잠근 사이트를 올리고(--dry-run은 계획에 적음), pack --password도 잠금', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-kitfix-cli-'));
  const env = { ...process.env, HTTPS_PROXY: '', https_proxy: '', LECPAGE_WRANGLER: path.join(HERE, 'fixtures', 'fake-wrangler.mjs'), FAKE_WRANGLER_LOG: path.join(dir, 'w.log'), CLOUDFLARE_API_TOKEN: '', LECPAGE_PASSWORD: '' };
  const run = (args) => { const r = spawnSync(process.execPath, [CLI, ...args], { cwd: dir, encoding: 'utf8', timeout: 120000, env }); return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }; };
  try {
    fs.mkdirSync(path.join(dir, 'work/site/material'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'work/site/index.html'), PAGE('<section><h2>교재</h2><div data-lp="deck" data-pages="1"></div></section>'));
    fs.writeFileSync(path.join(dir, 'work/site/material/p-001.webp'), WEBP);
    fs.writeFileSync(path.join(dir, 'work/lecpage.json'), JSON.stringify({ ...META, features: ['deck'] }));
    const dry = run(['publish', 'work', '--dry-run', '--password', '봄비연필운동장', '--no-bundle-fonts']);
    assert.equal(dry.code, 0, dry.out);
    assert.match(dry.out, /암호로 잠그기/);
    const r = run(['publish', 'work', '--password', '봄비연필운동장', '--no-bundle-fonts', '--no-verify', '--no-handouts', '--name', 'lec-pw']);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /암호로 잠금: 쪽 \d+개·자료 1개/);
    assert.match(fs.readFileSync(path.join(dir, 'work/dist/index.html'), 'utf8'), /id="lp-locked"/);
    assert.ok(fs.existsSync(path.join(dir, 'work/dist/material/p-001.webp.enc')));
    // 공개 범위가 암호인데 암호를 주지 않으면 멈춤
    fs.writeFileSync(path.join(dir, 'work/lecpage.teacher.json'), JSON.stringify({ access: 'password' }));
    assert.equal(run(['pack', 'work', '-o', 'a.zip']).code, 1);
    const p = run(['pack', 'work', '-o', 'b.zip', '--password', '봄비연필운동장']);
    assert.equal(p.code, 0, p.out);
    assert.ok(fs.readFileSync(path.join(dir, 'b.zip')).includes(Buffer.from('p-001.webp.enc')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── 그려서 검수: 말줄임 글은 겹침이 아님, 이름표 안 고르기 칸은 이름표 크기로 ──
test('브라우저: 말줄임(…)으로 줄인 글은 보이는 부분으로 겹침을 재고, 이름표가 작은 고르기 칸은 작은 누를 곳', { skip }, async () => {
  await withSite({ 'index.html': '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>t</title></head><body style="margin:0"><main><h1>t</h1><section><h2>머리</h2><div style="display:flex;width:300px"><span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">아주아주 긴 제목이 여기 들어가서 옆 단추까지 가요 정말 길어요</span><button style="min-width:60px;min-height:44px">차례</button></div><label style="font-size:12px;line-height:1"><input type="checkbox"> 작은 이름표</label></section></main></body></html>' }, async (page, base) => {
    await page.goto(base);
    const found = await page.evaluate(`${K.inspectRenderedSource}({ file: 'index.html' })`);
    assert.deepEqual(found.filter((x) => x.id === 'overlap-text'), [], JSON.stringify(found));
    assert.ok(found.some((x) => x.id === 'small-target' && /작은 이름표|input/.test(x.message_ko + x.where.selector)), JSON.stringify(found));
  });
});

// 실제 실행(2026-11-21, 회사 신입 온보딩 교재)에서 본 것: 입실 창이 '소속(학교)'라 학교 밖 연수에 맞지 않음 → 어느 연수에나 맞게 '소속'
test('입실 창의 소속 칸: 학교로 못 박지 않음(회사·기관 연수에도)', async () => {
  const { joinDialog } = await import('../src/kit/widgets.js');
  const html = joinDialog({ collect: ['nickname', 'name', 'school'], official: true });
  assert.match(html, /<span>소속<\/span><input name="school"/);
  assert.ok(!html.includes('(학교)'));
  assert.match(joinDialog({ collect: ['nickname', 'name', 'school'] }), /<span>소속 · 선택<\/span>/);
});

// 강의 당일 점검(2026-11-24, 운영 서버): 한 쪽에만 data-lp="now"를 둔 두 쪽 사이트에서 다른 쪽에는 '지금' 줄이 아예 없어
// 공지·타이머·[투표하러 가기]가 그 쪽 참가자에게 보이지 않았음(자리를 정했는지를 사이트 전체로 봄). 참여 막대·공유 단추도 같은 꼴
test('자리를 정한 키트 부품(지금 줄·참여 막대·공유)은 그 쪽에서만: 다른 쪽은 저절로 붙는 기본 자리를 그대로 받음', () => {
  const one = PAGE('<section><h2>질문</h2><div data-lp="qa"></div></section><div data-lp="share"></div>');
  const two = PAGE('<div data-lp="now"></div><div data-lp="dock"></div><section><h2>퀴즈</h2><div data-lp="poll" data-question="맞는 것은?" data-options=\'["가","나"]\'></div></section>');
  const r = K.assemble({ 'index.html': one, 'practice.html': two }, { ...META, features: ['qa', 'poll', 'help'] }, { runtime: rt, prev: { live: { provider: 'http', url: 'https://live.example.kr', code: 'NOWPAGE' } } });
  assert.deepEqual(r.errors, []);
  const idx = r.files['index.html'], pr = r.files['practice.html'];
  const count = (s, re) => (s.match(re) || []).length;
  // '지금' 줄: 쪽마다 하나씩
  assert.equal(count(idx, /<div class="lp-now" data-now hidden>/g), 1, "자리를 정하지 않은 쪽에도 '지금' 줄");
  assert.match(idx, /<div class="lpk lpk-now"><div class="lp-now" data-now hidden>/, '기본 자리(몸 맨 앞)');
  assert.equal(count(pr, /<div class="lp-now" data-now hidden>/g), 1, '자리를 정한 쪽은 그 자리 하나뿐');
  assert.match(pr, /lpk-now--placed/); assert.doesNotMatch(idx, /lpk-now--placed/);
  // 참여 막대: 쪽마다 하나씩(정한 쪽은 그 자리, 다른 쪽은 기본)
  assert.equal(count(idx, /<aside class="lp-dock" data-dock/g), 1, '자리를 정하지 않은 쪽에도 참여 막대');
  assert.equal(count(pr, /<aside class="lp-dock" data-dock/g), 1);
  assert.match(pr, /lpk-dock--placed/); assert.doesNotMatch(idx, /lpk-dock--placed/);
  // 공유 단추: 자리를 정한 쪽(index)은 막대에 또 두지 않고, 정하지 않은 쪽은 기본 막대에 둠 — practice는 막대 자리를 정했으므로 그 막대 그대로
  assert.doesNotMatch(idx, /lpk-dock-share/);
  const three = K.assemble({ 'index.html': one, 'practice.html': PAGE('<section><h2>질문</h2><div data-lp="qa"></div></section>') }, { ...META, features: ['qa', 'help'] }, { runtime: rt, prev: { live: { provider: 'http', url: 'https://live.example.kr', code: 'NOWPAGE' } } });
  assert.match(three.files['practice.html'], /lpk-dock-share/, '공유 자리를 정하지 않은 쪽의 막대에는 공유 단추');
  assert.doesNotMatch(three.files['index.html'], /lpk-dock-share/);
});
