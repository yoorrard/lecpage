// 교재 정확성: 교재 사실 대조(kit/facts.js), 키트가 지어 쓰던 말 지우기, 배포할 곳에 맞는 개인정보 안내, 배포 전 확인(운영안내.md),
// 안 쓰는 교재 쪽 그림 빼기·쓰는 바깥 곳만 여는 CSP·미리보기 CSP, 그려서 검수(낱말 가운데 줄바꿈·상자 밖 글·붙은 글·긴 쪽).
// 교재 대조와 새 그려서 검수는 모두 살펴볼 곳(warn): 강사·AI에게 알리기만 하고 막거나 고치지 않음(조립은 AI의 HTML·CSS에 아무것도 넣지 않음)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import * as K from '../src/kit/index.js';
import { materialToAIContext } from '../src/ingest/outline.js';
import { nodeRuntime, writeFiles } from '../node.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const CLI = path.join(HERE, '..', '..', 'scripts', 'lecpage.mjs');
const rt = nodeRuntime();
const IMG = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]);
const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require('playwright')); } catch { try { ({ chromium } = createRequire('/opt/node-tools/')('playwright')); } catch { /* 없음 */ } }
const skip = !chromium && 'playwright is not installed';

// 교재(prepare가 만드는 material.md 꼴)
const MAT = `# 교재 보조 글자

쪽 그림(site/material/p-NNN.webp)과 교재 원본이 먼저예요. 이 글은 찾기·옮겨 적기용이라 표·그림 속 글은 빠질 수 있어요.

교재: 연수자료.pdf(6쪽)

## p-001 · 연수자료.pdf 1쪽 · 생성형 AI로 수업 자료 만들기

2026 겨울 교원 직무연수
2026. 11. 20.(금) 14:00~17:00 새봄중학교 3층 컴퓨터실
강사: 한지우 (새봄중학교 정보부장)

## p-002 · 연수자료.pdf 2쪽 · 오늘의 흐름

14:00~14:20 여는 이야기
14:20~15:10 실습 1: 수업 지도안 초안
15:10~15:20 쉬는 시간

## p-003 · 연수자료.pdf 3쪽 · 좋은 요청 글

좋은 요청 글의 네 가지: 역할·상황·과제·형식
나쁜 예: " 수업 지도안 써 줘 "

## p-004 · 연수자료.pdf 4쪽 · 실습 1

“너는 중학교 2학년 국어 교사야. 설명문 쓰기 단원 3차시 45분 수업 지도안을
도입·전개·정리 표로 써 줘. 활동마다 시간과 준비물을 적어 줘.”
결과물 나눔: https://padlet.com/saebom/ai-lesson

## p-005 · 연수자료.pdf 5쪽 · 실습 2

이 단원의 선택형 문항 5개를 만들어 줘
문의: info@saebom.ms.kr · 02-123-4567 · 내선 302

## p-006 · 연수자료.pdf 6쪽 · 마무리

과제 마감 11월 27일(금) · 만족도 설문 https://forms.gle/example-survey
이수 기준: 출석 확인, 만족도 설문 제출
`;
const PROMPT = '너는 중학교 2학년 국어 교사야. 설명문 쓰기 단원 3차시 45분 수업 지도안을 도입·전개·정리 표로 써 줘. 활동마다 시간과 준비물을 적어 줘.';
const PAGE = (body) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>생성형 AI로 수업 자료 만들기</title><meta name="description" content="2026. 11. 20.(금) 새봄중학교 3층 컴퓨터실"></head><body><main><h1>생성형 AI로 수업 자료 만들기</h1>${body}</main></body></html>`;
// 교재를 맞게 옮긴 사이트(띄어쓰기·줄바꿈·따옴표가 다르고, 시각 범위로 셀 수 있는 50분, 네 가지 → 4가지, 문항 5개 → 5문항)
const GOOD = PAGE(`<section><h2>오늘</h2><dl><dt>일시</dt><dd>11월 20일(금) 오후 2시~5시</dd><dt>장소</dt><dd>새봄중학교 3층 컴퓨터실</dd><dt>강사</dt><dd>한지우 선생님</dd></dl>
<ol><li><time>14:00</time> 여는 이야기</li><li>14:20~15:10 실습 1 (50분)</li><li>15:10 쉬는 시간</li></ol></section>
<section><h2>좋은 요청 글</h2><p>4가지를 적어요: 역할·상황·과제·형식(교재 3쪽). 나쁜 예는 “수업 지도안 써 줘”예요.</p></section>
<section data-lp-step="s1" data-title="실습 1"><h2>실습 1</h2><button type="button" data-copy-text="${PROMPT.replace('도입·전개·정리', '도입 · 전개 · 정리')}">복사</button>
<pre id="p2">이 단원의
선택형 문항 5개를 만들어 줘</pre><button type="button" data-copy-target="#p2">복사</button><p>5문항을 만들어요. 결과는 <a href="https://padlet.com/saebom/ai-lesson">패들렛</a>에.</p></section>
<section><h2>마무리</h2><p>과제는 11. 27.(금)까지. 문의 <a href="mailto:info@saebom.ms.kr">info@saebom.ms.kr</a>, 내선 302</p><p><a href="https://forms.gle/example-survey">만족도 설문</a></p></section>`);
const META = { v: 2, title: '생성형 AI로 수업 자료 만들기', sessions: [{ date: '2026-11-20', start: '14:00', end: '17:00' }], venue: '새봄중학교 3층 컴퓨터실', instructors: [{ name: '한지우', org: '새봄중학교 정보부장' }], features: ['qa'], facts: [{ label: '장소', value: '새봄중학교 3층 컴퓨터실', page: 1 }, { label: '실습 1 나눔', value: 'https://padlet.com/saebom/ai-lesson', page: 4 }] };
const ids = (issues) => issues.map((x) => x.id);

// ── 교재 사실 대조 ──────────────────────────────────────
test('교재 대조: 교재를 맞게 옮긴 사이트는 걸리는 것이 없음(띄어쓰기·줄바꿈·따옴표·시각 범위 길이·한글 수·문항 5개↔5문항)', () => {
  const issues = K.checkFacts({ 'index.html': GOOD }, { materialText: MAT, meta: META });
  assert.deepEqual(issues, [], JSON.stringify(issues, null, 1));
  // 앱 보조 글자 꼴(## p.N)·pdftotext 꼴(\\f)도 쪽 번호를 읽음
  assert.deepEqual(K.materialPages('## p.1 제목\n글\n## p.2 둘\n둘째').map((p) => p.page), [1, 2]);
  assert.deepEqual(K.materialPages('첫 쪽\f둘째 쪽').map((p) => p.page), [1, 2]);
});

test('교재 대조: 지어낸 날짜·요일·장소·강사·시각·숫자·주소·메일·전화·쪽 번호는 살펴볼 곳(가장 가까운 교재 글과 쪽 번호를 함께)', () => {
  const bad = GOOD.replace('11월 20일(금)', '11월 21일(금)').replace('<dd>새봄중학교 3층 컴퓨터실</dd>', '<dd>새봄중학교 2층 강당</dd>').replace('한지우 선생님', '김민수 선생님').replace('<time>14:00</time>', '<time>14:05</time>')
    .replace('</main>', '<p>출석 90% 이상이면 이수예요. 도움: help@saebom.example.kr, 02-987-6543, <a href="https://www.youtube.com/watch?v=abc">영상</a>. 교재 41쪽 참고.</p></main>');
  const issues = K.checkFacts({ 'index.html': bad }, { materialText: MAT, meta: { ...META, sessions: [{ date: '2026-11-21', start: '14:00', end: '17:00' }], venue: '새봄중학교 2층 강당', instructors: [{ name: '김민수' }] } });
  const has = (id, re) => assert.ok(issues.some((x) => x.id === id && re.test(x.message_ko)), `${id} ${re} ← ${JSON.stringify(issues.map((x) => x.message_ko), null, 1)}`);
  has('fact-date', /"11월 21일\(금\)"이 교재에 없어요.*교재에 가까운 날짜: "2026\. 11\. 20\.\(금\)"\(교재 1쪽/);
  has('fact-weekday', /2026년 11월 21일은 토요일인데/);
  has('fact-venue', /"강당"/); has('fact-number', /"2층"이 교재에 없어요.*"3층"\(교재 1쪽/);
  has('fact-name', /강사 "김민수"가 교재에 없어요/);
  has('fact-time', /"14:05"가 교재에 없어요.*교재에 가까운 시각: "14:00"/);
  has('fact-number', /"90%"가 교재에 없어요/); has('fact-email', /help@saebom\.example\.kr/); has('fact-phone', /02-987-6543/);
  has('fact-url', /youtube\.com/); has('fact-page', /"41쪽"라고 적었는데 교재는 6쪽까지/);
  assert.ok(issues.every((x) => x.level === 'warn' && x.fix_hint_ko), '지어낸 사실은 살펴볼 곳(막지 않음)');
  // 연수 정보(lecpage.json)의 날짜·장소·강사도
  for (const sel of ['sessions[0].date', 'venue', 'instructors[0].name']) assert.ok(issues.some((x) => x.where.file === 'lecpage.json' && x.where.selector === sel), sel);
  // 같은 값은 파일마다 한 번
  assert.equal(issues.filter((x) => x.id === 'fact-date' && x.where.file === 'index.html').length, 1);
});

test('교재 대조: 복사 단추 원문이 교재와 다르면(고쳐 옮김·덧붙임) "원문과 달라요"(교재 원문·쪽과 함께), 교재에 없는 복사 글은 "교재에서 찾지 못한" — 모두 살펴볼 곳', () => {
  const changed = GOOD.replace('3차시 45분', '4차시 50분');
  const e = K.checkFacts({ 'index.html': changed }, { materialText: MAT });
  const copy = e.filter((x) => x.id === 'fact-copy');
  assert.equal(copy.length, 1); assert.equal(copy[0].level, 'warn', '알리기만(막지 않음)');
  assert.match(copy[0].message_ko, /교재 원문과 달라요.*4차시 50분.*교재 4쪽/);
  assert.equal(copy[0].where.selector, 'button');
  // 원문 뒤에 덧붙임
  const added = GOOD.replace('활동마다 시간과 준비물을 적어 줘.', '활동마다 시간과 준비물을 적어 줘. 표는 세 줄로.');
  assert.equal(K.checkFacts({ 'index.html': added }, { materialText: MAT }).filter((x) => x.id === 'fact-copy' && /원문과 달라요/.test(x.message_ko)).length, 1);
  // 교재에 없는 복사 글(AI가 만든 예시)·인용
  const own = GOOD.replace('</main>', '<button data-copy-text="오늘 배운 것을 세 줄로 정리해 줘">복사</button><p>“모든 학생은 AI 도구를 매일 쓰게 됩니다”</p></main>');
  const o = K.checkFacts({ 'index.html': own }, { materialText: MAT });
  assert.ok(o.some((x) => x.id === 'fact-copy' && /교재에서 찾지 못한 복사 버튼 글: "오늘 배운 것을/.test(x.message_ko)), JSON.stringify(o));
  // 교재와 같은 원문(띄어쓰기·따옴표·줄바꿈만 다름)은 통과: GOOD의 복사 단추·pre·“수업 지도안 써 줘”
  assert.deepEqual(K.checkFacts({ 'index.html': GOOD }, { materialText: MAT }).filter((x) => /copy|quote/.test(x.id)), []);
});

test('교재 대조: 강사가 알려 준 값(known·lecpage.teacher.json)은 교재에 있는 것으로 보고, 받아쓰기한 사이트는 살펴볼 곳', () => {
  const moved = GOOD.replace('11월 20일(금)', '11월 27일(금)').replace('</main>', '<p><a href="https://forms.gle/RealSurvey9">기관 설문</a></p></main>');
  assert.ok(K.checkFacts({ 'index.html': moved }, { materialText: MAT }).some((x) => x.id === 'fact-url'));
  assert.deepEqual(K.checkFacts({ 'index.html': moved }, { materialText: MAT, known: { surveyUrl: 'https://forms.gle/RealSurvey9', told: ['연수 날짜를 11월 27일(금)로 옮김'], live: { anonKey: '비밀 11월 30일' } } }), []);
  // 받아쓰기: 교재 글을 거의 다 옮김
  const long = Array.from({ length: 12 }, (_, i) => `<p>교재 설명 ${i + 1}: 생성형 AI는 많은 글을 읽고 다음 말을 예측하는 도구라서 초안·요약·바꿔 쓰기를 잘하지만 사실 확인과 우리 반 사정 알기는 못해요 그래서 교사의 검토가 꼭 필요해요.</p>`).join('');
  const mat = MAT + '\n## p-007 · 연수자료.pdf 7쪽 · 설명\n\n' + Array.from({ length: 12 }, (_, i) => `교재 설명 ${i + 1}: 생성형 AI는 많은 글을 읽고 다음 말을 예측하는 도구라서 초안·요약·바꿔 쓰기를 잘하지만 사실 확인과 우리 반 사정 알기는 못해요 그래서 교사의 검토가 꼭 필요해요.`).join('\n');
  const t = K.checkFacts({ 'index.html': GOOD.replace('</main>', long + '</main>') }, { materialText: mat }).find((x) => x.id === 'fact-transcribe');
  assert.ok(t && t.level === 'warn' && /교재를 거의 다 옮기고 있어요/.test(t.message_ko), JSON.stringify(t));
  assert.ok(!K.checkFacts({ 'index.html': GOOD }, { materialText: mat }).some((x) => x.id === 'fact-transcribe'), '할 일·원문만 옮긴 사이트는 받아쓰기가 아님');
});

test('검수(inspect): materialText를 주면 교재 대조 이슈(fact-*)도 함께, 주지 않으면 그대로', () => {
  const bad = { 'index.html': GOOD.replace('3차시 45분', '4차시 50분') };
  assert.ok(!K.inspect(bad, META).some((x) => x.id.startsWith('fact-')));
  const withMat = K.inspect(bad, META, { materialText: MAT });
  assert.ok(withMat.some((x) => x.id === 'fact-copy'));
  assert.ok(withMat.filter((x) => x.id.startsWith('fact-')).every((x) => x.level === 'warn'), '교재 대조는 막지 않음');
  assert.match(K.issuesForAi(withMat), /\[살펴볼 곳\] index\.html button: 복사 버튼 글이 교재 원문과 달라요/);
});

// ── 보조 글자: 꼬리표 없음 ─────────────────────────────────
test('보조 글자: material.md·앱 보조 글자에 [프롬프트] 같은 꼬리표가 붙지 않음(나쁜 예가 복사 단추가 되지 않게)', () => {
  const m = { files: [{ id: 'f1', name: 'a.pdf', pages: 1 }], pages: [{ file: 'f1', page: 1, title: '나쁜 예 / 좋은 예', paragraphs: [{ text: '나쁜 예: " 수업 지도안 써 줘 "' }, { text: '좋은 예: 역할·상황·과제·형식을 모두 적기' }] }] };
  const ctx = materialToAIContext(m);
  assert.ok(!/\[프롬프트\]/.test(ctx) && /나쁜 예: " 수업 지도안 써 줘 "/.test(ctx), ctx);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-prep-'));
  try {
    fs.writeFileSync(path.join(dir, '교재.md'), '# 실습\n\n나쁜 예: "수업 지도안 써 줘"\n\n좋은 예: 너는 중학교 2학년 국어 교사야. 지도안을 표로 써 줘.\n');
    const r = spawnSync(process.execPath, [CLI, 'prepare', path.join(dir, '교재.md'), '-o', path.join(dir, 'work'), '--no-slides', '--no-python'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const md = fs.readFileSync(path.join(dir, 'work', 'material.md'), 'utf8');
    assert.match(md, /나쁜 예: "수업 지도안 써 줘"/); assert.ok(!/\[프롬프트\]|\[prompt\]/i.test(md), md);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── 키트가 지어 쓰던 말 ────────────────────────────────────
test('키트·보조 쪽: 교재에 없는 이수 규칙(둘 다 눌러야·설문을 내야·출석 90%)·연습 모드의 보관 기간을 지어 쓰지 않음', () => {
  const site = { 'index.html': PAGE('<section><h2>출석</h2><div data-lp="attend"></div></section><section><h2>설문</h2><div data-lp="survey"></div></section>') };
  const meta = { ...META, features: ['attendance', 'survey'], admin: { kind: 'official', hours: 3 } };
  const local = K.assemble(site, meta, { runtime: rt });
  const http1 = K.assemble(site, meta, { runtime: rt, prev: { live: { provider: 'http', url: 'https://live.example.org', code: 'ABCD1234' } } });
  for (const r of [local, http1]) {
    const html = r.files['index.html'];
    assert.ok(!/둘 다 눌러야|설문을 내야 이수|이수가 확인돼요/.test(html), '지어낸 이수 규칙');
  }
  // 연습 모드: 기록이 이 브라우저에만 → 지우는 날을 말하지 않음. 서버: 실제로 지우는 때(마지막 기록 뒤 30일)
  assert.match(local.files['index.html'], /연습 모드라 이 브라우저에만 남아요/); assert.ok(!/30일 안에 지우는/.test(local.files['index.html']));
  assert.match(http1.files['index.html'], /마지막 기록 뒤 30일 안에 지우는 데 동의합니다/);
  assert.match(local.teacher['운영안내.md'], /연습 모드 기록은 이 브라우저에만 있어요/);
  // 강사 화면: 이수 기준(%)이 없으면 규칙을 말하지 않고 이수 칸을 비움
  const con = fs.readFileSync(path.join(HERE, '..', 'runtime', 'console.js'), 'utf8');
  assert.ok(!/기본값\)|\|\| 90, rateSet/.test(con), '90% 기본 규칙 글이 남아 있음');
  assert.match(con, /이수 기준\(출석 비율\)이 연수 정보에 없어 \\'이수\\' 칸은 비워 둬요/);
  const fn = new Function(`${/function noVerdict\(csv\) \{[\s\S]*?\n  \}/.exec(con)[0]}; return noVerdict;`)();
  assert.equal(fn('별명,이름,이수\nA,가,O\nB,나,확인 필요\nC,다,X'), '별명,이름,이수(기준 없음)\nA,가,\nB,나,\nC,다,');
  assert.equal(K.attendBox({ lead: 'L', after: 'A', done: true }).includes('이수'), false);
});

// ── 배포할 곳에 맞는 개인정보 안내 ──────────────────────────
test('개인정보 안내: 배포할 곳(host)에 맞는 처리자·보관 기간·사이트를 보내 주는 곳', () => {
  const site = { 'index.html': PAGE('<section><h2>질문</h2><div data-lp="qa"></div><div data-lp="attend"></div></section>') };
  const meta = { ...META, features: ['qa', 'attendance'] };
  const live = { live: { provider: 'http', url: 'https://lecpage-sites.lecpage.workers.dev/live', code: 'LEC12345' } };
  const inst = K.assemble(site, meta, { runtime: rt, prev: { ...live, privacy: { collect: ['nickname', 'name', 'school'], retentionDays: 90 } }, host: 'lecpage', hostDays: 60 });
  const p = inst.files['privacy.html'];
  assert.match(p, /lecpage 운영자\(바로 배포 서버 · Cloudflare\)/); assert.match(p, /lecpage 운영자가 강사를 대신해 저장만 합니다/);
  assert.match(p, /마지막 기록 뒤 60일/, '참여 기록은 사이트 보관 기간(60일)보다 오래 두지 않음'); assert.match(p, /사이트 보관 기간\(마지막 배포 뒤 60일\)이 먼저 끝나면 사이트와 함께/);
  assert.match(p, /사이트 파일은 lecpage 바로 배포 서버/); assert.match(p, /미국 등 Cloudflare 데이터센터가 있는 국가/);
  assert.equal(inst.blueprint.privacy.retentionDays, 60); assert.equal(inst.report.host, 'lecpage');
  assert.match(inst.teacher['운영안내.md'], /사이트는 마지막 배포 뒤 60일 보관돼요/);
  // 내 계정 Vercel + 내 Cloudflare 중계: 처리자는 Cloudflare, 사이트는 Vercel
  const ver = K.assemble(site, meta, { runtime: rt, prev: { live: { provider: 'http', url: 'https://my-live.alice.workers.dev', code: 'V1234567' } }, host: 'vercel' }).files['privacy.html'];
  assert.match(ver, /Cloudflare, Inc\./); assert.match(ver, /사이트 파일은 Vercel Inc\.\(미국 등\)가 보내 주며/); assert.ok(!/lecpage 운영자가/.test(ver));
  // 노트북 서버(LAN): 맡기는 곳·국외 이전 없음
  const lan = K.assemble(site, meta, { runtime: rt, prev: { live: { provider: 'http', url: 'http://192.168.0.10:8787', code: 'LAN12345' } }, host: 'lan' }).files['privacy.html'];
  assert.match(lan, /처리를 맡기는 곳도 없습니다/); assert.match(lan, /강사·기관의 컴퓨터가 보내 주며, 바깥 호스팅 회사는 없습니다/);
  // 배포할 곳을 모르면 예전 글(일반 문장)
  assert.match(K.assemble(site, meta, { runtime: rt, prev: live }).files['privacy.html'], /사이트 파일을 보내 주는 호스팅 회사/);
});

// ── 배포 전 확인 ────────────────────────────────────────
test('배포 전 확인: 예시 링크·오늘이거나 지난 날짜·설문 없는 이수 조건·연습 모드·사진이 운영안내.md 맨 위와 조립 결과에', () => {
  const site = { 'index.html': PAGE('<section><h2>안내</h2><p>이수 기준: 출석 확인, 만족도 설문 제출</p><p><a href="https://forms.gle/example-survey">설문</a> · forms.gle/example-survey</p><img src="assets/img/group.jpg" alt="지난 연수"></section><section><h2>질문</h2><div data-lp="qa"></div></section>'), 'assets/img/group.jpg': IMG };
  const r = K.assemble(site, META, { runtime: rt, today: '2026-11-20' });
  const codes = r.preflight.map((x) => x.code);
  assert.deepEqual(codes, ['placeholder-link', 'date-today', 'completion-no-survey', 'practice-mode', 'photos']);
  assert.match(r.preflight[0].message_ko, /예시 주소 같은 링크 1개: forms\.gle\/example-survey/);
  assert.match(r.preflight[4].message_ko, /사진 1장이 있어요\(group\.jpg\)/);
  const ops = r.teacher['운영안내.md'];
  assert.ok(ops.indexOf('## 배포 전 확인') < ops.indexOf('## 파일'));
  for (const x of r.preflight) assert.ok(ops.includes(x.message_ko), x.code);
  assert.equal(K.assemble(site, META, { runtime: rt, today: '2026-12-01' }).preflight[1].code, 'date-past');
  // 진짜 설문 주소(강사 값)·참여 서버·미리보기면 그 줄이 빠짐
  const ok = K.assemble({ 'index.html': PAGE('<section><h2>질문</h2><div data-lp="qa"></div></section>') }, META, { runtime: rt, today: '2026-11-01', prev: { surveyUrl: 'https://forms.gle/Real1', live: { provider: 'http', url: 'https://live.example.org', code: 'ABCD1234' } } });
  assert.deepEqual(ok.preflight, []); assert.match(ok.teacher['운영안내.md'], /자동 점검에서 걸린 것이 없어요/);
});

// ── 안 쓰는 교재 쪽 그림·CSP ───────────────────────────────
test('배포: 안 쓰는 교재 쪽 그림은 빼고(교재 넘기기·<img>·링크·CSS가 쓰는 쪽만), 미리보기와 스크립트가 쪽 주소를 만드는 사이트는 다 둠', () => {
  const pages = Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [`material/p-00${n}.webp`, IMG]));
  const site = { 'index.html': PAGE('<section><h2>교재</h2><div data-lp="deck" data-pages="1-2"></div><img src="material/p-005.webp" alt="5쪽"><a href="material/p-006.webp">6쪽 크게</a></section>'), ...pages };
  const r = K.assemble(site, META, { runtime: rt });
  assert.deepEqual(Object.keys(r.files).filter((p) => p.startsWith('material/')).sort(), ['material/p-001.webp', 'material/p-002.webp', 'material/p-005.webp', 'material/p-006.webp']);
  assert.deepEqual(r.report.droppedPages, [3, 4]);
  assert.equal(Object.keys(K.assemble(site, META, { runtime: rt, preview: true }).files).filter((p) => p.startsWith('material/')).length, 6, '미리보기는 다 둠');
  const dyn = { ...site, 'assets/site.js': "document.querySelector('img').src = 'material/p-' + String(n).padStart(3, '0') + '.webp';" };
  assert.equal(Object.keys(K.assemble(dyn, META, { runtime: rt }).files).filter((p) => p.startsWith('material/')).length, 6, '스크립트가 쪽 주소를 만들면 다 둠');
  // 교재 넘기기에 쪽을 정하지 않으면 다 씀
  assert.equal(K.assemble({ ...site, 'index.html': PAGE('<section><h2>교재</h2><div data-lp="deck"></div></section>') }, META, { runtime: rt }).report.droppedPages, undefined);
});

test('.lecpage: 지난번 배포한 곳(deploy.host)을 담고 열 때 돌려줌', () => {
  const p = K.packProjectV2({ site: { 'index.html': PAGE('<section><h2>a</h2></section>') }, meta: META, deploy: { host: 'cloudflare' } });
  const o = K.openProjectFile(p.bytes);
  assert.deepEqual(o.deploy, { host: 'cloudflare' });
  assert.equal(K.openProjectFile(K.packProjectV2({ site: { 'index.html': PAGE('') }, meta: META, deploy: { host: '<bad>' } }).bytes).deploy, null);
});

// ── 그려서 검수: 실제 AI 사이트에서 찾은 흠 ──────────────────
function serveDir(dir) {
  return http.createServer((req, res) => {
    const p = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
    if (!p.startsWith(dir) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html; charset=utf-8' : p.endsWith('.css') ? 'text/css' : 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
  });
}
async function rendered(html, width) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-facts-'));
  writeFiles(dir, { 'index.html': html });
  const srv = serveDir(dir); await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height: width < 600 ? 844 : 800 } });
    await page.goto(`http://127.0.0.1:${srv.address().port}/`);
    return await page.evaluate(`${K.inspectRenderedSource}({ file: 'index.html' })`);
  } finally { await browser.close(); srv.close(); fs.rmSync(dir, { recursive: true, force: true }); }
}
const DOC = (css, body) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>t</title><style>body{margin:0;font:16px/1.5 sans-serif}${css}</style></head><body><main><h1>t</h1>${body}</main></body></html>`;

test('브라우저: 짧은 이름표가 낱말 가운데서 갈리면 살펴볼 곳, 빈칸·다른 요소에서 나뉜 줄과 사이트가 keep-all을 준 때는 아님', { skip }, async () => {
  const nav = '<nav><a href="#a" class="n">연수 안내</a><a href="#b" class="n" style="width:52px">실습 1 (지도안)</a><a href="#c" class="n2"><b>1</b><span>표 정리</span></a></nav>';
  const css = '.n{display:inline-block;width:60px}.n2{display:flex;flex-direction:column;width:60px}';
  const found = (await rendered(DOC(css, nav), 1280)).filter((x) => x.id === 'label-split');
  assert.equal(found.length, 2, JSON.stringify(found));
  assert.match(found[0].message_ko, /이름표 "연수 안내"의 줄이 낱말 가운데서 바뀌어요\("연수 안\/내"\)/);
  assert.match(found[0].fix_hint_ko, /keep-all/);
  // 사이트 CSS가 word-break:keep-all이면 빈칸에서 넘어가 걸리지 않음
  assert.deepEqual((await rendered(DOC(css + 'body{word-break:keep-all;overflow-wrap:break-word}', nav), 1280)).filter((x) => x.id === 'label-split' && /연수 안내/.test(x.message_ko)), []);
});

test('브라우저: 고정 크기 상자(원형 배지) 밖으로 삐져나온 글은 살펴볼 곳, 글에 맞는 상자·말줄임은 아님', { skip }, async () => {
  const css = '.dot{width:32px;height:32px;border-radius:50%;background:#1f4e79;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0}.ok{min-width:32px;padding:0 8px;height:32px;border-radius:16px;background:#1f4e79;color:#fff;display:inline-flex;align-items:center}.el{width:60px;background:#eee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
  const found = (await rendered(DOC(css, '<ol><li><span class="dot">14:00~14:10</span> 여는 이야기</li><li><span class="dot">2</span> 실습</li><li><span class="ok">14:10~15:00</span></li><li><div class="el">아주 긴 제목이 말줄임으로</div></li></ol>'), 390)).filter((x) => x.id === 'text-out-of-box');
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].level, 'warn'); assert.match(found[0].message_ko, /"14:00~14:10": 글이 상자\(32×32px\) 밖으로 \d+px 삐져나와/);
});

test('브라우저: 바탕색 상자 가장자리에 붙은 글(안쪽 여백 0)은 살펴볼 곳, 여백이 있거나 밑줄 그러데이션·옅은 물빛은 아님', { skip }, async () => {
  const css = '.hero{background:#1f4e79;color:#fff;padding:3rem 0}.card{background:#1f4e79;color:#fff;padding:1rem}.ch{background:linear-gradient(#0b5e45,#0b5e45) left bottom/100% 3px no-repeat;padding-bottom:8px}.tint{background:#fafafa}';
  const found = (await rendered(DOC(css, '<div class="hero"><p>2026 겨울 교원 직무연수</p></div><div class="card"><p>여백이 있는 상자</p></div><header class="ch"><p>밑줄만 있는 머리</p></header><div class="tint"><p>아주 옅은 물빛</p></div>'), 1280)).filter((x) => x.id === 'text-glued');
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.match(found[0].message_ko, /"2026 겨울 교원 직무연수": 글이 바탕색 상자의 왼쪽 끝에 붙어 있어요/); assert.match(found[0].fix_hint_ko, /padding/);
});

test('브라우저: 휴대폰에서 강의 기능 칸을 빼고 10화면 넘게 긴 쪽은 살펴볼 곳(키트 칸 높이는 세지 않음)', { skip }, async () => {
  const long = (await rendered(DOC('', '<p style="height:9000px">긴 글</p>'), 390)).filter((x) => x.id === 'page-long');
  assert.equal(long.length, 1); assert.match(long[0].message_ko, /약 11화면/); assert.match(long[0].fix_hint_ko, /디자인 원칙 2번/);
  assert.deepEqual((await rendered(DOC('', '<p style="height:5000px">글</p><div class="lpk-w" style="height:5000px"></div>'), 390)).filter((x) => x.id === 'page-long'), [], '키트 칸은 세지 않음');
  assert.deepEqual((await rendered(DOC('', '<p style="height:9000px">긴 글</p>'), 1280)).filter((x) => x.id === 'page-long'), [], 'PC 폭은 재지 않음');
});
