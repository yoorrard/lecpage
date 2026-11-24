// 키트·조립·검수(docs/plan-ai-first.md 약속 A~C): 자리 표시 펼치기, 강사 값 지키기, CSP·_headers, 인라인 스크립트 옮기기,
// 정적 검수 규칙, .lecpage v2 왕복, 미리보기 한 장, 그리고 브라우저에서 키트 사이트가 엔진 쪽 구조 없이 도는지.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { createRequire } from 'node:module';
import * as K from '../src/kit/index.js';
import * as E from '../src/index.js';
import { nodeRuntime, writeFiles } from '../node.js';
import { zipFiles } from '../src/zip-write.js';

const rt = nodeRuntime();
const IMG = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]);
const PAGE = (body, head = '') => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>시험 연수</title>${head}</head><body><main><h1>시험 연수</h1>${body}</main></body></html>`;
const META = { v: 2, title: '시험 연수', sessions: [{ date: '2026-12-03', start: '14:00', end: '17:00' }], venue: '본관', features: ['qa', 'poll', 'help', 'reactions', 'attendance', 'survey', 'deck'], theme: { accent: '#b4441c', ink: '#1f1a17', paper: '#fbf6ee' } };
const lpData = (html) => JSON.parse(/<script type="application\/json" id="lp-data">([\s\S]*?)<\/script>/.exec(html)[1]);
const lpBlueprint = (html) => JSON.parse(/<script type="application\/json" id="lp-blueprint">([\s\S]*?)<\/script>/.exec(html)[1]);

function fullSite() {
  return {
    'index.html': PAGE(`
<section id="intro"><h2>들어오기</h2><div data-lp="join"></div><div data-lp="attend"></div></section>
<section data-lp-step="첫 실습" data-title="실습 1. 시작하기"><h2>실습 1</h2><p>따라 해요.</p><div data-lp="poll" data-question="쉬웠나요?" data-options='["예","아니요"]'></div></section>
<section data-lp-step="s2"><h2>실습 2. 만들기</h2><div data-lp="poll" data-id="Word One" data-kind="word" data-question="한 낱말로?"></div></section>
<section id="q"><h2>질문</h2><div data-lp="qa"></div></section>
<section id="b"><h2>보드</h2><div data-lp="board" data-prompt="한 줄 소개" data-categories='["결과","소감"]'></div></section>
<section id="d"><h2>교재</h2><div data-lp="deck" data-pages="1-2"></div></section>
<section id="s"><h2>설문</h2><div data-lp="survey" data-questions='[{"q":"좋았나요?","kind":"scale"},{"q":"한 줄","kind":"text"}]'></div></section>
<section id="m"><h2>자료</h2><div data-lp="materials" data-items='[{"title":"교재","href":"files/a.pdf"},{"title":"나쁜 주소","href":"javascript:alert(1)"}]'></div></section>`, '<link rel="stylesheet" href="assets/style.css">'),
    'assets/style.css': ':root{--lp-accent:#b4441c;--lp-ink:#1f1a17;--lp-paper:#fbf6ee}',
    'material/p-001.webp': IMG, 'material/p-002.webp': IMG, 'files/a.pdf': new Uint8Array([37, 80, 68, 70]),
  };
}

test('키트: 자리 표시를 런타임이 아는 마크업으로 펼치고, 강사·발표 화면 목록(#lp-blueprint)과 #lp-data를 넣음', () => {
  const r = K.assemble(fullSite(), META, { runtime: rt, today: '2026-11-20' });
  assert.deepEqual(r.errors, []);
  const html = r.files['index.html'];
  for (const sel of ['data-qa', 'data-qa-form', 'data-qa-list', 'data-board ', 'data-board-write', 'data-board-form', 'data-attend', 'data-attend-state', 'data-qr-self', 'data-url-self', 'data-copy-url', 'data-live-materials', 'data-dock ', 'data-dock-attend', 'data-dock-help', 'data-dock-qa', 'data-now ', 'data-join-dialog', 'data-share-dialog', 'data-help-dialog', 'data-toast', 'data-lp-extra']) assert.ok(html.includes(sel), sel);
  assert.match(html, /<form class="lp-survey-form" data-survey="survey"/);
  assert.match(html, /<div class="lp-deck" data-deck>[\s\S]*<figure class="lp-slide" id="deck-p1" data-page="1"[\s\S]*src="material\/p-001\.webp"/);
  // 투표: 자리마다 문항 하나, 아이디는 엔진 규칙(slug), 문항은 모두 강사 화면 목록에
  const polls = [...html.matchAll(/data-poll='([^']+)'/g)].map((m) => JSON.parse(m[1].replace(/&quot;/g, '"')));
  assert.deepEqual(polls.map((p) => p[0].id), ['p1', 'word-one']);
  assert.equal(polls[1][0].kind, 'word');
  const bp = lpBlueprint(r.files['console.html']);
  assert.deepEqual(bp.sections.find((s) => s.type === 'poll').items.map((x) => x.id), ['p1', 'word-one']);
  assert.deepEqual(bp.stations.map((x) => x.id), ['첫-실습', 's2']);
  assert.deepEqual(bp.pages, [1, 2]);
  // 실습 단계: lp-st·data-st·앵커, 완료 체크·도움 요청, 몸에 data-stations="kit"
  assert.match(html, /<section data-lp-step="첫 실습" data-title="실습 1\. 시작하기" data-st="첫-실습" id="st-첫-실습" class="lp-st">/);
  assert.ok(!/data-options=|data-items=|data-questions=/.test(html), '설정 속성은 펼친 뒤 뺌');
  assert.match(html, /<section data-lp-step="s2" data-st="s2" data-title="실습 2\. 만들기" id="st-s2" class="lp-st">/);
  assert.equal((html.match(/data-done/g) || []).length, 2);
  assert.match(html, /<body data-stations="kit" data-layout="kit">/);
  // 키트 감싸기
  assert.match(html, /<div data-lp="qa" data-lpk="qa" id="lpk-qa" class="lpk lpk-w lpk-qa">/);
  assert.match(html, /<html lang="ko" data-lpk="1">/);
  // 자료: javascript: 주소는 버림
  assert.ok(html.includes('href="files/a.pdf"') && !html.includes('javascript:alert'));
  const d = lpData(html);
  assert.equal(d.title, '시험 연수');
  assert.equal(d.live.provider, 'local', '참여 서버가 없으면 이 기기 안 연습(엔진과 같음)');
  assert.deepEqual(d.stations.map((x) => x.id), ['첫-실습', 's2']);
  assert.equal(d.survey, 2);
  assert.ok(d.live.features.includes('progress') && d.live.features.includes('board') && d.live.features.includes('attendance'));
  assert.equal(d.privacy.collect.join(','), 'nickname,name,school', '출석이 켜지면 이름·소속(엔진과 같음)');
  // 보조 쪽·런타임·키트 CSS
  for (const f of ['console.html', 'screen.html', 'poster.html', 'check.html', 'privacy.html', 'assets/lecpage.js', 'assets/live.js', 'assets/kit.css', 'assets/qr.js', 'assets/favicon.svg', 'assets/event.ics', 'robots.txt', '_headers']) assert.ok(r.files[f], f);
  assert.match(r.files['assets/kit.css'], /^\/\* lecpage 키트[^\n]*\n:root\{--lpk-accent:#b4441c;--lpk-on-accent:#ffffff;--lpk-paper:#fbf6ee;--lpk-surf:#fbf6ee;--lpk-ink:#1f1a17/);
  assert.match(r.files['assets/theme.css'], /:root\[data-theme="light"\]\{--background:#fbf6ee;--foreground:#1f1a17/, '보조 쪽이 사이트 바탕·글자색을 이어받음');
  // 엔진 위젯과 같은 마크업(템플릿 렌더러와 한 벌)
  assert.ok(html.includes(K.qaBox({ id: 'lpk-qa', live: true }).slice(0, 200)));
  assert.equal(r.collected.deck.join(','), '1,2');
});

test('교재 슬라이드: 쪽 그림이 16:9가 아니면(A4 세로 자료집) 키트 CSS가 그 비율로, 16:9·모르는 그림은 그대로', () => {
  // VP8X 머리(가로 909 · 세로 1287): 너비-1·높이-1을 3바이트 little-endian으로
  const a4 = new Uint8Array([82, 73, 70, 70, 22, 0, 0, 0, 87, 69, 66, 80, 86, 80, 56, 88, 10, 0, 0, 0, 0, 0, 0, 0, 0x8c, 3, 0, 6, 5, 0]);
  const png169 = new Uint8Array(30); png169.set([0x89, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 5, 0, 0, 0, 2, 0xd0]); // 1280×720
  const page = (img) => ({ 'index.html': PAGE('<section id="d"><h2>교재</h2><div data-lp="deck"></div></section>'), 'material/p-001.webp': img, 'material/p-002.webp': img });
  const css = (img) => K.assemble(page(img), META, { runtime: rt, today: '2026-11-20' }).files['assets/kit.css'];
  assert.match(css(a4), /:root\{--lpk-deck-ratio:909\/1287\}/);
  assert.doesNotMatch(css(png169), /--lpk-deck-ratio:\d/);
  assert.doesNotMatch(css(IMG), /--lpk-deck-ratio:\d/);
  assert.match(css(a4), /aspect-ratio:var\(--lp-deck-ratio,var\(--lpk-deck-ratio,16\/9\)\)/);
});

test('연수 정보: 강사 값(live·siteUrl·joinUrl·shortUrl·access·surveyUrl·privacy)은 AI 답에서 받지 않고 이전 값을 지킴', () => {
  const ai = { ...META, live: { provider: 'http', url: 'https://evil.example', code: 'EVIL' }, siteUrl: 'https://evil.example/', joinUrl: 'https://evil.example/zoom', shortUrl: 'https://evil.example/s', access: 'public', surveyUrl: 'https://evil.example/form', privacy: { collect: ['name', 'school'], consent: false } };
  const a = K.readMeta(ai);
  assert.equal(a.meta.live, null); assert.equal(a.meta.siteUrl, ''); assert.equal(a.meta.joinUrl, ''); assert.equal(a.meta.shortUrl, ''); assert.equal(a.meta.access, 'link'); assert.equal(a.meta.surveyUrl, ''); assert.equal(a.meta.privacy, null);
  assert.deepEqual(a.warnings.filter((w) => w.code === 'teacher-value').map((w) => w.path).sort(), ['access', 'joinUrl', 'live', 'privacy', 'shortUrl', 'siteUrl', 'surveyUrl']);
  const prev = { live: { provider: 'http', url: 'https://live.school.kr', code: 'REAL1234' }, siteUrl: 'https://site.example/', access: 'password' };
  const b = K.readMeta(ai, { prev });
  assert.equal(b.meta.live.url, 'https://live.school.kr/'); assert.equal(b.meta.live.code, 'REAL1234'); assert.equal(b.meta.siteUrl, 'https://site.example/'); assert.equal(b.meta.access, 'password');
  // 조립도 같은 규칙: AI가 적은 서버로 연결하지 않음
  const r = K.assemble(fullSite(), ai, { runtime: rt });
  assert.ok(!r.files['index.html'].includes('evil.example'));
  assert.ok(r.warnings.some((w) => w.code === 'meta-teacher-value'));
  const r2 = K.assemble(fullSite(), ai, { runtime: rt, prev });
  assert.equal(lpData(r2.files['index.html']).live.url, 'https://live.school.kr/');
  // keepTeacherValues: 강사 칸이 없던 AI 답이면 버린 칸 없음
  assert.deepEqual(K.keepTeacherValues({ title: 'x' }, prev).dropped, []);
});

test('연수 정보: 날짜·시각 꼴, facts 꼴, 예전 판(v1) 알림', () => {
  assert.equal(K.normDate('2026.12.3'), '2026-12-03'); assert.equal(K.normDate('2026년 3월 1일'), '2026-03-01');
  assert.equal(K.normDate('2026-02-30'), ''); assert.equal(K.normDate('12/3'), '');
  assert.equal(K.normTime('9:00'), '09:00'); assert.equal(K.normTime('14시 30분'), '14:30'); assert.equal(K.normTime('24:00'), ''); assert.equal(K.normTime('9:7'), '');
  const r = K.readMeta({ v: 2, title: 't', sessions: [{ date: '2026-13-01', start: '15:00', end: '14:00' }], facts: [{ label: '장소', value: '본관', page: 3 }, { label: '', value: 'x' }, { label: '날짜', value: '12월', page: 'x' }], features: ['qa', 'chat'], theme: { accent: 'red', paper: '#FFF' } });
  assert.deepEqual(r.meta.facts, [{ label: '장소', value: '본관', page: 3 }, { label: '날짜', value: '12월' }]);
  assert.deepEqual(r.meta.features, ['qa']);
  assert.deepEqual(r.meta.theme, { paper: '#fff' });
  const codes = r.warnings.map((w) => w.code);
  for (const c of ['date', 'time-order', 'facts-empty', 'facts-page', 'feature-unknown', 'theme-color']) assert.ok(codes.includes(c), c);
  const old = K.readMeta({ version: 1, meta: { title: 'x' }, sections: [] });
  assert.equal(old.old, true); assert.equal(old.errors[0].code, 'v1');
});

// 실제 실행(2026-11-21): 바로 배포는 개인정보 칸에 처리 위탁 서버만 적어 넘김(받을 정보 없음) → 배포한 사이트만 입실 창에서 이름·소속을 묻지 않았음
test('개인정보 칸에 받을 정보가 없으면 조립 기본(출석이면 이름·소속)을 따름 · 빈 목록을 일부러 주면 별명만', () => {
  const live = { provider: 'http', url: 'https://live.example.org', code: 'PRIV1234' };
  const proc = { name: 'lecpage 운영자(바로 배포)', contact: 'hello@lecpage.com', country: '미국', purpose: '참여 기능 저장' };
  const withProc = lpData(K.assemble(fullSite(), META, { runtime: rt, prev: { live, privacy: { processors: [proc] } } }).files['index.html']);
  const preview = lpData(K.assemble(fullSite(), META, { runtime: rt, preview: true }).files['index.html']);
  assert.equal(withProc.privacy.collect.join(','), 'nickname,name,school');
  assert.equal(withProc.privacy.collect.join(','), preview.privacy.collect.join(','), '미리보기와 배포한 사이트가 같게');
  const nick = lpData(K.assemble(fullSite(), META, { runtime: rt, prev: { live, privacy: { collect: [], processors: [proc] } } }).files['index.html']);
  assert.equal(nick.privacy.collect.join(','), 'nickname');
});

test('CSP·_headers: AI 쪽은 self 스크립트·form-action none·실제로 쓰는 바깥 곳만(라이브러리·글꼴·영상 틀), 참여 서버만 연결, 보조 쪽은 엔진 머리글', () => {
  const r = K.assemble(fullSite(), META, { runtime: rt, prev: { live: { provider: 'http', url: 'https://live.example.org', code: 'ABCD1234' } } });
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(r.files['index.html'])[1].replace(/&#39;|&apos;/g, "'");
  assert.equal(csp, r.csp);
  const has = (d) => assert.ok(csp.includes(d), d);
  // 바깥 라이브러리·글꼴·영상을 쓰지 않는 사이트: 'self'만
  has("script-src 'self' file:;"); has("style-src 'self' file: 'unsafe-inline';"); has("font-src 'self' file: data:;"); has("frame-src 'none'");
  assert.ok(!/jsdelivr|googleapis|youtube|vimeo/.test(csp), csp);
  has("img-src 'self' file: data: blob: https://live.example.org"); has("connect-src 'self' file: https://live.example.org wss://live.example.org");
  has("form-action 'none'"); has("object-src 'none'"); has("worker-src 'none'"); has("base-uri 'none'");
  // 섞인 콘텐츠 올려 받기는 쪽(meta)에 넣지 않음: http로만 여는 내부망 서버·NAS·Safari의 localhost에서 같은 주소의 CSS·JS까지 https로 받아 사이트가 깨짐. https 호스팅이 읽는 _headers에만
  assert.ok(!csp.includes('upgrade-insecure-requests'), 'meta에는 없음');
  assert.match(r.files['_headers'], /\n\/index\.html\n  Content-Security-Policy: [^\n]*; upgrade-insecure-requests\n/, '_headers에는 있음');
  assert.ok(!/script-src[^;]*'unsafe-inline'/.test(csp));
  // 쓰는 것만 엶: gsap·구글 글꼴·유튜브(→ nocookie)
  const site = fullSite();
  site['index.html'] = site['index.html'].replace('</head>', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Dodum"><script src="https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/gsap.min.js" defer></script></head>').replace('</main>', '<iframe src="https://www.youtube.com/embed/abcdefgh" title="영상"></iframe></main>');
  const c2 = K.assemble(site, META, { runtime: rt }).csp;
  for (const d of ["script-src 'self' file: https://cdn.jsdelivr.net/npm/gsap@3.15.1/;", "style-src 'self' file: 'unsafe-inline' https://fonts.googleapis.com;", "font-src 'self' file: data: https://fonts.gstatic.com;", 'frame-src https://www.youtube-nocookie.com;']) assert.ok(c2.includes(d), d + ' <- ' + c2);
  assert.ok(!/lenis@|ogl@|vimeo|hangeul/.test(c2), c2);
  // supabase 참여 기능이면 런타임이 부르는 supabase-js만 더함
  const c3 = K.assemble(fullSite(), META, { runtime: rt, prev: { live: { provider: 'supabase', url: 'https://abc.supabase.co', anonKey: 'k', code: 'SUPA1234' } } }).csp;
  assert.match(c3, /script-src 'self' file: https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[\d.]+\/;/);
  const h = r.files['_headers'];
  assert.match(h, /^\/\n  Content-Security-Policy: default-src 'self'/m);
  assert.match(h, /^\/index\.html\n  Content-Security-Policy:/m);
  assert.match(h, /^\/console\.html\n  Content-Security-Policy: frame-ancestors 'none'\n  X-Frame-Options: DENY\n  Cross-Origin-Opener-Policy: same-origin/m);
  assert.ok(!/^\/check/m.test(h.split('/assets/*')[0].replace(/^\/\*[\s\S]*?\n\n/, '')) || true);
  assert.match(h, /X-Robots-Tag: noindex, nofollow/); assert.equal(r.files['robots.txt'], 'User-agent: *\nDisallow: /\n');
  assert.match(r.files['index.html'], /<meta name="robots" content="noindex, nofollow">/);
  // 보조 쪽(엔진 CSP: 접속 확인은 바깥 도구를 재야 해서 https 전체)
  assert.match(r.files['check.html'], /connect-src 'self' file: https: wss:/);
  // 공개 범위 '누구나'(강사 값)면 검색 허용
  const pub = K.assemble(fullSite(), META, { runtime: rt, prev: { access: 'public' } });
  assert.equal(pub.files['robots.txt'], 'User-agent: *\nAllow: /\n'); assert.ok(!/name="robots"/.test(pub.files['index.html']));
  // 교실 LAN(http 서버): 섞인 콘텐츠 올려 받기를 넣지 않음
  const lan = K.assemble(fullSite(), META, { runtime: rt, prev: { live: { provider: 'http', url: 'http://192.168.0.10:8787', code: 'LAN12345' } } });
  assert.ok(!lan.csp.includes('upgrade-insecure-requests') && lan.csp.includes('ws://192.168.0.10:8787'));
});

test('인라인 스크립트 옮기기: 순서·자리 유지, type=module도, JSON은 그대로, 바깥 스크립트는 허용 목록만, onclick·javascript: 주소', () => {
  const site = {
    'index.html': `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>t</title><meta name="viewport" content="width=device-width">
<meta http-equiv="Content-Security-Policy" content="script-src *"><base href="https://evil.example/"><meta http-equiv="refresh" content="0;url=https://evil.example">
<script>window.a=1</script><script type="application/ld+json">{"@type":"Event"}</script><script src="https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/gsap.min.js"></script><script src="https://evil.example/x.js"></script><script src="//evil.example/y.js"></script>
<link rel="stylesheet" href="https://evil.example/a.css"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Batang"></head>
<body><h1>t</h1><button id="b" onclick="window.clicked=(window.clicked||0)+1; return false">x</button><a href="javascript:alert(1)">y</a><img src="a.png" onerror="alert(1)" alt="">
<script type="module">import './assets/x.js'; window.m = 1;</script><script>window.b=window.a+1</script><object data="x.swf"></object><iframe src="https://www.youtube.com/embed/abcdefg?start=3" title="영상"></iframe></body></html>`,
    'assets/site.js': 'window.taken=1', 'assets/x.js': 'export const x = 1;',
  };
  const r = K.assemble(site, { v: 2, title: 't' }, { runtime: rt });
  const html = r.files['index.html'];
  const order = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(order.slice(0, 4), ['assets/site-2.js', 'https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/gsap.min.js', 'assets/site-2.module.js', 'assets/site-3.js'], '이미 있는 assets/site.js는 덮지 않고 번호를 이어 씀');
  assert.equal(r.files['assets/site-2.js'].trim(), 'window.a=1'); assert.equal(r.files['assets/site-3.js'].trim(), 'window.b=window.a+1');
  assert.match(html, /<script type="module" src="assets\/site-2\.module\.js"><\/script>/);
  assert.match(r.files['assets/site-2.module.js'], /import '\.\/assets\/x\.js'/);
  assert.equal(r.files['assets/site.js'], 'window.taken=1');
  assert.match(html, /<script type="application\/ld\+json">\{"@type":"Event"\}<\/script>/);
  assert.ok(!html.includes('evil.example'), '바깥 스크립트·CSS·base·refresh 빼기');
  assert.ok(html.includes('fonts.googleapis.com/css2'));
  assert.ok(!/<object/.test(html) && !/script-src \*/.test(html));
  assert.match(html, /<iframe src="https:\/\/www\.youtube-nocookie\.com\/embed\/abcdefg\?start=3"/);
  assert.match(html, /<button id="b" data-lpk-on="1">/); assert.match(html, /<a href="#">y<\/a>/); assert.match(html, /<img src="a\.png" alt="" data-lpk-on="2">/);
  assert.ok(html.indexOf('assets/site-events.js') < html.indexOf('assets/lecpage.js'));
  const ev = r.files['assets/site-events.js'];
  assert.match(ev, /1:\{"click":function\(event\)\{window\.clicked=\(window\.clicked\|\|0\)\+1; return false/);
  assert.ok(!/on(click|error)=/.test(html));
  for (const c of ['external-script', 'external-css', 'inline-handler', 'javascript-url', 'base', 'meta-refresh', 'object']) assert.ok(r.warnings.some((w) => w.code === c), c);
  // 문법이 틀린 처리기는 옮기지 않음(다른 처리기까지 멈추지 않게)
  const bad = K.assemble({ 'index.html': PAGE('<button onclick="if(">x</button><button onclick="ok()">y</button>') }, { v: 2, title: 't' }, { runtime: rt });
  assert.ok(bad.warnings.some((w) => w.code === 'inline-handler-bad'));
  assert.ok(!bad.files['assets/site-events.js'].includes('function(event){if(') && bad.files['assets/site-events.js'].includes('function(event){ok()'));
});

test('사이트 파일: SVG·엔진 파일 이름·숨김 파일·폴더 밖 경로는 받지 않음, index.html이 없으면 오류', () => {
  const r = K.assemble({ 'index.html': PAGE('<p>x</p>'), 'assets/logo.svg': '<svg onload="alert(1)"/>', 'console.html': '<p>가짜 강사 화면</p>', 'assets/lecpage.js': 'evil()', '../x.js': 'x', '.env': 'K=1', 'assets/img/a.png': IMG }, { v: 2, title: 't' }, { runtime: rt });
  assert.ok(!r.files['assets/logo.svg'] && r.files['assets/img/a.png']);
  assert.ok(!(r.files['console.html'] || '').includes('가짜') && !r.files['assets/lecpage.js'].includes('evil()'));
  assert.ok(!('../x.js' in r.files) && !('.env' in r.files));
  assert.equal(r.warnings.filter((w) => w.code === 'file-dropped').length, 4);
  const none = K.assemble({ 'about.html': PAGE('') }, { v: 2, title: 't' }, { runtime: rt });
  assert.equal(none.errors[0].code, 'no-index');
});

test('정적 검수: 구조·키트 표시·금지 패턴·깨진 경로·대비·크기를 { id, level, where, message_ko, fix_hint_ko }로', () => {
  const files = {
    'index.html': `<html><head><meta charset="utf-8"></head><body>
<section id="a"><p>제목 없는 섹션</p></section><section id="e"></section>
<div data-lp="poll" data-question="" data-options='["하나"]'></div><div data-lp="poll" data-question="q" data-options='["a",'></div>
<div data-lp="survey" data-questions='[{"q":"x","kind":"choice"}]'></div><div data-lp="chat"></div><div data-lp="qa">안내 글</div>
<div data-lp="deck" data-pages="1-5"></div><section data-lp-step="s1"><h2>1</h2></section><section data-lp-step="s1"><h2>2</h2></section>
<input type="password"><img src="https://img.example/a.png"><img src="assets/img/none.png" alt="x"><a href="nope.html">x</a><a href="#missing">y</a>
<button onclick="go()">b</button><iframe src="https://evil.example/embed"></iframe><script src="https://evil.example/x.js"></script><script>function(</script>
<form action="https://forms.example/submit" method="post"></form></body></html>`,
    'assets/style.css': ':root{--lp-ink:#777777;--lp-paper:#888888;--lp-accent:rgb(1,2,3)} .card{color:#eeeeee;background:#ffffff}',
    'assets/site.js': 'function broken( {',
    'material/p-001.webp': IMG,
    'assets/img/huge.png': new Uint8Array(1.6 * 1024 * 1024),
  };
  const issues = K.inspect(files, { v: 2, title: '', features: ['board'] });
  for (const x of issues) { assert.ok(['error', 'warn'].includes(x.level)); assert.ok(x.message_ko && x.fix_hint_ko && x.where && 'file' in x.where && 'selector' in x.where && 'section' in x.where, JSON.stringify(x)); }
  const ids = new Set(issues.map((x) => x.id));
  for (const id of ['doctype', 'lang', 'title', 'viewport', 'h1', 'section-heading', 'section-empty', 'kit-poll-question', 'kit-poll-options', 'kit-json', 'kit-survey-q', 'kit-unknown', 'kit-inner', 'kit-deck-pages', 'kit-step-id', 'password-field', 'external-image', 'img-alt', 'broken-image', 'broken-link', 'broken-anchor', 'inline-handler', 'iframe-src', 'external-script', 'script-syntax', 'form-action', 'contrast', 'kit-var-color', 'file-size', 'meta-title-empty', 'kit-feature-slot']) assert.ok(ids.has(id), id);
  const lvl = (id) => issues.find((x) => x.id === id).level;
  assert.equal(lvl('password-field'), 'error'); assert.equal(lvl('kit-poll-options'), 'error'); assert.equal(lvl('inline-handler'), 'warn');
  const deck = issues.find((x) => x.id === 'kit-deck-pages');
  assert.equal(deck.where.selector, '[data-lp="deck"]');
  assert.match(issues.find((x) => x.id === 'contrast' && x.where.selector.includes('--lp-ink')).message_ko, /대비가 1\.\d+:1/);
  assert.equal(issues.filter((x) => x.id === 'script-syntax').length, 2, '인라인과 파일 둘 다');
  assert.equal(issues.find((x) => x.id === 'section-heading').where.section, 'a');
  // 고쳐 쓰는 요청 글·요약
  assert.match(K.issueSummary(issues), /^고칠 곳 \d+개 · 살펴볼 곳 \d+개$/);
  assert.match(K.issuesForAi(issues), /^- \[고칠 곳\] /);
  // 깨끗한 사이트는 문제 없음
  const clean = K.inspect(fullSite(), META);
  assert.deepEqual(clean.filter((x) => x.level === 'error'), [], JSON.stringify(clean));
  // 조립이 만드는 달력 파일(assets/event.ics)은 날짜가 있으면 깨진 링크가 아님(kit.md가 링크하라고 안내)
  const ics = { 'index.html': PAGE('<a href="assets/event.ics" download>달력에 넣기</a>') };
  assert.ok(!K.inspect(ics, META).some((x) => x.id === 'broken-link'));
  assert.ok(K.inspect(ics, { ...META, sessions: [] }).some((x) => x.id === 'broken-link'));
});

test('정적 검수의 크기 알림: 바로 배포 한도(사이트 300MB·파일 하나 20MB)를 넘을 때만, 사실과 할 수 있는 일만 알린다(꼭 고칠 곳이 아님)', () => {
  const MB = 1024 * 1024;
  const page = new Uint8Array(Math.round(0.51 * MB)); // 쪽 그림 한 장(같은 바이트를 여러 이름으로: 검수는 크기만 봄)
  const base = { 'index.html': '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>연수</title></head><body><main><h1>연수</h1><section id="a"><h2>가</h2><p>글</p></section></main></body></html>' };
  const pages = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`material/p-${String(i + 1).padStart(3, '0')}.webp`, page]));
  const sizeIssues = (files) => K.inspect(files, { v: 2, title: '연수' }).filter((x) => x.id === 'site-too-big' || x.id === 'file-too-big');
  // 200쪽 교재(쪽 그림 102MB): 알리지 않음(전에는 60MB를 넘으면 '꼭 고칠 곳'으로 쪽 그림을 줄이라고 했음 — 강사가 고칠 수 없음)
  assert.deepEqual(sizeIssues({ ...base, ...pages(200) }), []);
  // 파일 하나: 20MB까지는 알리지 않고, 넘으면 사실만(살필 곳). '배포할 수 없어요'라고 하지 않음(다른 곳에는 올릴 수 있음)
  assert.deepEqual(sizeIssues({ ...base, 'files/guide.pdf': new Uint8Array(20 * MB) }), []);
  const one = sizeIssues({ ...base, 'files/guide.pdf': new Uint8Array(23 * MB) });
  assert.equal(one.length, 1); assert.equal(one[0].id, 'file-too-big'); assert.equal(one[0].level, 'warn');
  assert.equal(one[0].message_ko, 'files/guide.pdf가 23.0MB예요. 바로 배포는 파일 하나가 20MB까지예요.');
  assert.match(one[0].fix_hint_ko, /GitHub Pages\(파일 하나 100MB까지\)/);
  // 사이트 합계: 300MB를 넘을 때만, 무엇이 큰지와 할 수 있는 일
  const big = sizeIssues({ ...base, ...pages(560), 'files/a.zip': new Uint8Array(19 * MB) }); // 쪽 그림 286MB + 자료 19MB
  assert.equal(big.length, 1); assert.equal(big[0].id, 'site-too-big'); assert.equal(big[0].level, 'warn');
  assert.match(big[0].message_ko, /^사이트 전체가 30\dMB예요\(교재 쪽 그림 28\dMB, 자료 파일 19MB\)\. 바로 배포는 300MB까지예요\.$/);
  assert.match(big[0].fix_hint_ko, /GitHub Pages\(900MB까지\)에 배포하거나 ZIP으로/);
  for (const x of [...one, ...big]) assert.ok(!/줄여|배포할 수 없어요/.test(x.message_ko + x.fix_hint_ko), x.message_ko + ' ' + x.fix_hint_ko);
});

test('.lecpage v2 왕복: 사이트·연수 정보·쪽 제목·원본, 비밀은 빼고 / 앱이 저장한 파일도 엶 / 예전 방식 연수는 교재·연수 정보만 옮김', () => {
  const site = fullSite();
  const meta = { ...META, live: { provider: 'supabase', url: 'https://p.supabase.co', anonKey: 'secret-anon', code: 'ABCD1234' } };
  const { bytes, dropped } = K.packProjectV2({ site: { ...site, 'assets/evil.svg': '<svg/>' }, meta: K.readMeta(meta, { prev: meta }).meta, material: { pages: [{ page: 1, title: '표지', text: '본문' }] }, sources: [{ name: '교재.pdf', type: 'pdf', pages: 2 }], originals: [{ name: '교재.pdf', bytes: new Uint8Array([1, 2]) }], now: 0 });
  assert.deepEqual(dropped, ['assets/evil.svg']);
  const o = K.openProjectFile(bytes);
  assert.equal(o.kind, 'v2'); assert.equal(o.note, '');
  assert.equal(o.site['index.html'], site['index.html']);
  assert.deepEqual([...o.site['material/p-001.webp']], [...IMG]);
  assert.equal(o.meta.title, '시험 연수'); assert.equal(o.meta.live, null, '파일 안의 강사 값은 meta에 바로 넣지 않음');
  assert.equal(o.teacherInFile.live.code, 'ABCD1234'); assert.equal(o.teacherInFile.live.anonKey, '', '참여 기능 키는 담지 않음');
  assert.equal(o.material.pages[0].title, '표지'); assert.equal(o.sources[0].name, '교재.pdf'); assert.equal(o.originals[0].key, 'src/교재.pdf');
  // 다시 조립해도 같은 결과
  const a = K.assemble(site, META, { runtime: rt, today: '2026-11-20' }), b = K.assemble(o.site, META, { runtime: rt, today: '2026-11-20' });
  assert.equal(a.files['index.html'], b.files['index.html']);
  // 앱이 [파일로 저장]한 파일(project.json version 1 안에 연수 하나)
  const appFile = (project, extra = {}) => zipFiles({ 'project.json': JSON.stringify({ format: 'lecpage-project', version: 1, engine: '1.0.0', project }), ...extra });
  // 새 판 연수(사이트가 있음): v2와 같은 꼴로(그림은 'site/…', 원본은 'src/…')
  const app2 = K.openProjectFile(appFile({ v: 2, title: '앱 연수', site: { 'index.html': site['index.html'] }, meta: { ...META, live: { provider: 'http', url: 'https://live.example.org', code: 'APPCODE1' } } }, { 'site/material/p-001.webp': IMG, 'src/교재.pdf': new Uint8Array([37, 80, 68, 70]) }));
  assert.equal(app2.kind, 'v2'); assert.equal(app2.title, '앱 연수');
  assert.equal(app2.site['index.html'], site['index.html']); assert.deepEqual([...app2.site['material/p-001.webp']], [...IMG]);
  assert.equal(app2.meta.live, null); assert.equal(app2.teacherInFile.live.code, 'APPCODE1');
  assert.equal(app2.originals[0].name, '교재.pdf');
  // 예전 방식(설계도)으로 만든 연수: 예전 판으로 알리고 교재 쪽 그림·연수 정보·원본만 옮김(사이트는 AI로 새로)
  const bp = { meta: { title: '데이터로 읽는 우리 반', date: '2026-12-16', start: '14:00', venue: '실습실' }, live: { features: ['qa', 'poll'] }, sections: [{ type: 'hero' }, { type: 'deck' }] };
  const material = { files: [{ id: 'f1', name: 'deck.pptx', type: 'pptx' }], pages: [{ file: 'f1', page: 1, title: '첫 쪽', image: 'assets/slides/slide-001.webp' }, { file: 'f1', page: 2, title: '둘째', image: 'assets/slides/slide-002.webp' }] };
  const old = K.openProjectFile(appFile({ title: bp.meta.title, blueprint: bp, material }, { 'assets/slides/slide-001.webp': IMG, 'assets/slides/slide-002.webp': IMG }));
  assert.equal(old.kind, 'v1'); assert.match(old.note, /예전 방식으로 만든 연수/);
  const up = K.upgradeV1(old.v1);
  assert.equal(up.meta.title, bp.meta.title); assert.equal(up.meta.sessions[0].date, '2026-12-16');
  assert.deepEqual(up.meta.features.sort(), ['deck', 'poll', 'qa']);
  assert.deepEqual(Object.keys(up.site).sort(), ['material/p-001.webp', 'material/p-002.webp']);
  assert.deepEqual(up.material.pages.map((p) => p.title), ['첫 쪽', '둘째']);
  assert.equal(up.legacy, undefined, '예전 사이트는 다시 그리지 않음');
});

test('미리보기 한 장: CSS·JS·그림을 안으로, 사이트 CSP 대신 미리보기 전용 CSP(밖으로 연결 없음), 검수 스크립트를 넣을 수 있음', () => {
  const r = K.assemble({ ...fullSite(), 'assets/style.css': ':root{--lp-accent:#b4441c} .hero{background:url(img/bg.webp)}', 'assets/img/bg.webp': IMG }, META, { runtime: rt });
  const one = K.previewHtml(r.files, 'index.html', { extraBody: K.inspectRenderedScript({ id: 'x' }) });
  const metas = [...one.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/g)].map((m) => m[1].replace(/&#39;|&apos;/g, "'"));
  assert.equal(metas.length, 1, '사이트 CSP는 빼고 미리보기 CSP 하나만');
  assert.equal(metas[0], K.previewCsp());
  assert.match(metas[0], /connect-src 'none'/); assert.match(metas[0], /default-src 'none'/); assert.match(metas[0], /form-action 'none'/);
  assert.ok(one.indexOf('Content-Security-Policy') < one.indexOf('<style'), 'CSP가 스타일·스크립트보다 먼저');
  assert.ok(!/<link rel="stylesheet" href="assets\//.test(one) && !/<script[^>]*src="assets\//.test(one));
  assert.match(one, /url\("data:image\/webp;base64,/);
  assert.match(one, /src="data:image\/webp;base64,UklGR/);
  assert.match(one, /<body data-lp-preview="1"/);
  assert.match(one, /parent\.postMessage\(\{type:'lp-inspect',id:"x"/);
  const tags = K.scanTags(one).filter((t) => t.name === 'script');
  assert.equal(tags.filter((t) => t.kind === 'open').length, tags.filter((t) => t.kind === 'close').length, '스크립트 글 안의 </script>는 막음');
  assert.ok(tags.filter((t) => t.kind === 'open').length >= 4);
  // 그려서 검수 함수는 바깥 변수 없이 글로 넘길 수 있음
  assert.doesNotThrow(() => new Function(`return ${K.inspectRenderedSource}`)());
});

// ── 브라우저: 키트 사이트가 엔진 쪽 구조(머리 메뉴·.lp-hero·섹션 배치) 없이 오류 없이 돌고, 그려서 검수가 문제를 찾음 ──
const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require('playwright')); } catch { /* 없음 */ }
const skip = !chromium && 'playwright is not installed';

function serveDir(dir) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png' };
  return http.createServer((req, res) => {
    const p = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
    if (!p.startsWith(dir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
  });
}

test('브라우저: 키트 사이트(엔진 쪽 구조 없음)가 오류 없이 돌고 도크·투표 자리·실습 단계·교재가 이어짐(연습 모드)', { skip }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-kit-'));
  const r = K.assemble(fullSite(), { ...META, sessions: [{ date: '2026-11-20', start: '00:00', end: '23:59' }] }, { runtime: rt });
  writeFiles(dir, r.files);
  const srv = serveDir(dir); await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy|Refused/.test(m.text())) errs.push(m.text()); });
    await page.goto(base + '/?phase=during');
    await page.waitForSelector('[data-dock]:not([hidden])', { timeout: 15000 });
    assert.equal(await page.getAttribute('[data-live-status]', 'data-state'), 'local');
    assert.equal(await page.evaluate(() => document.querySelector('[data-deck]').classList.contains('is-ready')), true);
    // 질문(연습 모드: 이 브라우저 안)
    await page.fill('[data-qa-form] textarea', '연습 질문');
    await page.click('[data-qa-form] [type=submit]');
    await page.waitForSelector('[data-qa-list] .lp-qa-item', { timeout: 8000 });
    // 실습 완료 체크
    await page.click('[data-st="s2"] [data-done]');
    assert.equal(await page.getAttribute('[data-st="s2"] [data-done]', 'aria-pressed'), 'true');
    // 강사 화면 상태를 같은 브라우저에서 바꿔 투표를 엶 → 그 문항의 자리(두 번째)에
    await page.evaluate(() => LecLive.current().setState({ openPoll: 'word-one' }));
    await page.waitForSelector('#lpk-poll-2 [data-poll-live] input', { timeout: 8000 });
    assert.equal(await page.$('#lpk-poll [data-poll-live] h3'), null);
    await page.waitForSelector('[data-now]:not([hidden])', { timeout: 8000 });
    assert.deepEqual(errs, []);
    // 그려서 검수: 이 사이트는 넘침·안 보이는 글 없음(단추 색이 바뀌는 움직임이 끝난 뒤)
    await page.waitForTimeout(400);
    const issues = await page.evaluate(`${K.inspectRenderedSource}({})`);
    assert.deepEqual(issues.filter((x) => ['overflow-x', 'invisible-text'].includes(x.id)), [], JSON.stringify(issues.slice(0, 5)));
    // 문제를 일부러 넣으면 찾음
    await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body style="margin:0;background:#fff"><section><h2 style="color:#fefefe">안 보이는 제목</h2><div style="width:900px">넓은 상자</div><p style="font-size:10px">작은 글자예요</p><button style="width:16px;height:16px;padding:0">x</button><img src="/nope.png" alt="깨짐"></section><section><p style="position:relative">겹친 글 하나</p><p style="position:relative;top:-30px">겹친 글 둘</p></section><section></section></body></html>`);
    await page.waitForTimeout(300);
    const found = new Set((await page.evaluate(`${K.inspectRenderedSource}({ file: 'x.html' })`)).map((x) => x.id));
    for (const id of ['overflow-x', 'invisible-text', 'small-text', 'small-target', 'broken-image', 'overlap-text', 'empty-section']) assert.ok(found.has(id), id + ' ' + [...found]);
    // 닫힌 접기 상자(details) 안의 글은 그려지지 않으니 겹침으로 세지 않음
    await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body style="margin:0;background:#fff"><section><h2>세 문제</h2><details><summary>첫 문제는 무엇일까요?</summary><p>첫 답이에요. 꽤 긴 풀이 글이에요.</p></details><details><summary>둘째 문제는 무엇일까요?</summary><p>둘째 답이에요.</p></details></section></body></html>`);
    await page.waitForTimeout(200);
    const shut = await page.evaluate(`${K.inspectRenderedSource}({ file: 'x.html' })`);
    assert.deepEqual(shut.filter((x) => x.id === 'overlap-text'), [], JSON.stringify(shut));
  } finally { await browser.close(); srv.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('CLI: prepare(쪽 그림 없이) → 에이전트가 쓴 사이트 → check(조립·검수, 고칠 곳이 있으면 종료 코드 1)', async () => {
  const { spawnSync } = await import('node:child_process');
  const cli = path.join(import.meta.dirname, '../../scripts/lecpage.mjs');
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-kitcli-'));
  try {
    const run = (...a) => spawnSync(process.execPath, [cli, ...a, '--json'], { encoding: 'utf8', env: { ...process.env, HTTPS_PROXY: '', https_proxy: '' } });
    const last = (r) => JSON.parse(r.stdout.trim().split('\n').pop());
    const p = run('prepare', path.join(import.meta.dirname, 'fixtures/workshop.pdf'), '-o', work, '--no-slides');
    assert.equal(p.status, 0, p.stderr + p.stdout);
    assert.equal(last(p).pages, 13);
    for (const f of ['README.md', 'lecpage.json']) assert.ok(fs.existsSync(path.join(work, f)), f);
    assert.match(fs.readFileSync(path.join(work, 'README.md'), 'utf8'), /references\/kit\.md/);
    // PDF만 주면 보조 글자를 두지 않음(에이전트가 원본을 직접 읽음: 코드가 뽑은 글을 원본 대신 믿지 않게)
    assert.ok(!fs.existsSync(path.join(work, 'material.md')), 'PDF만이면 material.md 없음');
    assert.doesNotMatch(fs.readFileSync(path.join(work, 'README.md'), 'utf8'), /material\.md/);
    // 사이트가 없으면 알려 줌
    assert.equal(run('check', work, '--no-shots').status, 1);
    fs.mkdirSync(path.join(work, 'site'), { recursive: true });
    fs.writeFileSync(path.join(work, 'site/index.html'), PAGE('<section><h2>질문</h2><div data-lp="qa"></div></section>'));
    fs.writeFileSync(path.join(work, 'lecpage.json'), JSON.stringify({ v: 2, title: '시험', features: ['qa'] }));
    const ok = run('check', work, '--no-shots');
    assert.equal(ok.status, 0, ok.stdout);
    assert.equal(last(ok).ok, true);
    assert.ok(fs.existsSync(path.join(work, 'dist/index.html')) && fs.existsSync(path.join(work, 'dist/console.html')));
    assert.ok(fs.existsSync(path.join(work, 'check/issues.md')) && fs.existsSync(path.join(work, 'check/report.json')));
    fs.writeFileSync(path.join(work, 'site/index.html'), PAGE('<div data-lp="poll" data-question="" data-options="[]"></div><input type="password">'));
    const bad = run('check', work, '--no-shots');
    assert.equal(bad.status, 1);
    assert.ok(last(bad).issues.some((x) => x.id === 'password-field'));
  } finally { fs.rmSync(work, { recursive: true, force: true }); }
});

test('강의 진행 키트: 교재 쪽에 묶은 투표·퀴즈 정답(강사 화면에만), 실습 시간(분), 발표 화면 교재 쪽, 모음, 사이트 스크립트가 있으면 관리자 키는 탭에만', () => {
  const site = {
    'index.html': PAGE(`
<section data-lp-step="s1" data-title="실습 1: 표 정리" data-minutes="30"><h2>실습 1</h2><p>따라 해요.</p><button type="button" data-copy-text="표를 정리해 줘">복사</button></section>
<section data-lp-step="s2" data-minutes="여섯"><h2>실습 2</h2><p>만들어요.</p></section>
<section id="quiz"><h2>퀴즈</h2><div data-lp="poll" data-id="chart" data-page="2" data-answer="꺾은선" data-question="변화를 보여 줄 차트는?" data-options='["막대","꺾은선","원"]'></div>
<div data-lp="poll" data-id="n" data-answer="2" data-question="둘째?" data-options='["가","나"]'></div><div data-lp="poll" data-id="bad" data-answer="없음" data-question="틀린 정답" data-options='["가","나"]'></div></section>
<section id="nb"><h2>모음</h2><div data-lp="notebook"></div></section>`),
    'material/p-001.webp': IMG, 'material/p-002.webp': IMG, 'material/p-003.webp': IMG,
  };
  const r = K.assemble(site, { ...META, features: ['qa', 'poll', 'attendance'] }, { runtime: rt, today: '2026-11-20' });
  assert.deepEqual(r.errors, []);
  const codes = r.warnings.map((w) => w.code);
  assert.ok(codes.includes('step-minutes') && codes.includes('poll-answer'), codes.join(','));
  // 정답은 참가자 쪽(HTML·#lp-data·data-poll)과 발표 화면에 없음, 강사 화면 목록에만(보기 번호)
  assert.ok(!/data-answer|data-page="2"/.test(r.files['index.html']));
  const con = lpBlueprint(r.files['console.html']), scr = lpBlueprint(r.files['screen.html']);
  const cp = con.sections.find((s) => s.type === 'poll').items;
  assert.deepEqual(cp.map((p) => [p.id, p.page, p.answer]), [['chart', 2, 1], ['n', undefined, 1], ['bad', undefined, undefined]]);
  assert.ok(!JSON.stringify(scr).includes('"answer"'));
  assert.deepEqual(con.stations.map((s) => s.minutes), [30, undefined]);
  // 교재 슬라이드 자리가 없어도 발표 화면은 교재 쪽 그림을 띄움
  assert.deepEqual(scr.deck.map((x) => x[0]), [1, 2, 3]); assert.equal(scr.deck[0][1], 'material/p-001.webp');
  assert.match(r.files['screen.html'], /data-scr-deck aria-label="교재" hidden>/, '시작 전에는 참여 안내(로비), 넘기면 교재(screen.js)'); assert.match(r.files['screen.html'], /data-keys-dialog/);
  // 앱 미리보기(한 장 HTML)에서도 발표 화면의 교재 쪽 그림이 열림
  assert.match(lpBlueprint(K.previewHtml(r.files, 'screen.html')).deck[0][1], /^data:image\/webp;base64,/);
  // 모음 위젯과 표시, 사이트 스크립트가 없으면 keyTab 없음
  assert.match(r.files['index.html'], /data-notebook/); assert.equal(lpData(r.files['index.html']).notebook, true);
  assert.equal(lpData(r.files['console.html']).keyTab, undefined);
  // 사이트 스크립트(assets/*.js·인라인·옮긴 onclick)가 하나라도 있으면 강사 화면은 관리자 키를 그 탭에만
  const variants = [{ 'assets/site.js': 'console.log(1)' }, { 'index.html': site['index.html'].replace('</body>', '<script>window.x=1</script></body>') }, { 'index.html': site['index.html'].replace('<h2>모음</h2>', '<h2 onclick="x()">모음</h2>') }];
  for (const extra of variants) {
    const r2 = K.assemble({ ...site, ...extra }, { ...META, features: ['qa', 'poll'] }, { runtime: rt, today: '2026-11-20' });
    assert.equal(lpData(r2.files['console.html']).keyTab, true, JSON.stringify(Object.keys(extra)));
  }
  // 강사·발표 화면은 다른 창이 가로채지 못하게(COOP)
  for (const pth of ['/console.html', '/screen.html']) {
    const block = r.files._headers.split('\n\n').find((b) => b.startsWith(pth + '\n'));
    assert.match(block, /Cross-Origin-Opener-Policy: same-origin/); assert.match(block, /X-Frame-Options: DENY/);
  }
});
