// PDF 표 되살리기 시험: pdf.js 글 조각(위치)을 직접 만들어 buildPage에 넣고, 표·두 단 글·목록·이름표 양식을 가립니다.
// 앱 길(pdf.js)과 CLI 보조 길(ingest.py, PyMuPDF)이 같은 표를 내는지도 견본 workshop.pdf로 봅니다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { buildPage } from '../src/ingest/pdf.js';
import { ingestFile, detect } from '../src/ingest/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FX = join(HERE, 'fixtures');
const SCRIPTS = join(HERE, '..', '..', 'scripts');
const H = 842, W = 595;
const vp = { width: W, height: H, scale: 1, transform: [1, 0, 0, -1, 0, H] };
const ctx = { fileId: 'deck1' };
// 글 조각 하나: 한글·한자 폭 1글자, 그 밖 0.55글자
const wOf = (s, size) => [...s].reduce((a, c) => a + (/[가-힣　-鿿]/.test(c) ? 1 : c === ' ' ? 0.25 : 0.55), 0) * size;
const item = (str, x, y, size = 10) => ({ str, x, y, size, transform: [size, 0, 0, size, x, H - y], width: wOf(str, size), fontName: 'g_d0_f1' });
/** 한 줄에 여러 칸: [[x, 글], …] */
const row = (y, cells, size = 10) => cells.map(([x, s]) => item(s, x, y, size));
const page = (items) => buildPage({}, items, [], vp, 1, ctx);

describe('PDF 표 되살리기(pdf.js 길)', () => {
  test('차시표: 칸 자리로 표를 만들고, 칸 안에서 글자 단위로 줄바꿈된 글은 위 줄에 붙임', () => {
    const X = [60, 120, 200, 300, 360];
    const items = [
      item('2027 신규 교사 직무연수 안내', 60, 60, 20),
      item('3. 차시표', 60, 110, 14),
      ...row(140, [[X[0], '차시'], [X[1], '날짜'], [X[2], '주제'], [X[3], '강사'], [X[4], '방식']]),
      ...row(165, [[X[0], '1차시'], [X[1], '1. 11.(월)'], [X[2], '학급 세우기: 첫'], [X[3], '서나래'], [X[4], '강의·실습']]),
      ...row(178, [[X[2], '2주']]),
      ...row(203, [[X[0], '2차시'], [X[1], '1. 12.(화)'], [X[2], '학부모와 만나'], [X[3], '한도담'], [X[4], '역할극']]),
      ...row(216, [[X[2], '기']]),
      ...row(241, [[X[0], '3차시'], [X[1], '1. 13.(수)'], [X[2], '생활지도와 학'], [X[3], '윤가온'], [X[4], '사례 토의']]),
      ...row(254, [[X[2], '교폭력 사안 처']]),
      ...row(267, [[X[2], '리']]),
      item('표 아래 문단입니다. 표와 섞이지 않아야 합니다.', 60, 300),
    ];
    const p = page(items);
    assert.equal(p.title, '2027 신규 교사 직무연수 안내');
    assert.equal(p.tables.length, 1);
    assert.deepEqual(p.tables[0].rows, [
      ['차시', '날짜', '주제', '강사', '방식'],
      ['1차시', '1. 11.(월)', '학급 세우기: 첫 2주', '서나래', '강의·실습'],
      ['2차시', '1. 12.(화)', '학부모와 만나기', '한도담', '역할극'],
      ['3차시', '1. 13.(수)', '생활지도와 학교폭력 사안 처리', '윤가온', '사례 토의'],
    ]);
    assert.deepEqual(p.paragraphs.map((x) => x.text), ['3. 차시표', '표 아래 문단입니다. 표와 섞이지 않아야 합니다.']);
    // 감지: 표의 차시 줄에서 제목·날짜·강사
    const d = detect({ files: [{ id: 'deck1', type: 'pdf' }], pages: [p] }, { today: '2026-11-13' });
    assert.deepEqual(d.sessions.map((s) => [s.no, s.date, s.title]), [[1, '2027-01-11', '학급 세우기: 첫 2주'], [2, '2027-01-12', '학부모와 만나기'], [3, '2027-01-13', '생활지도와 학교폭력 사안 처리']]);
    assert.match(d.sessions[0].desc, /서나래/);
  });

  test('어절 단위로 줄바꿈된 칸은 띄어서 이음', () => {
    const items = [
      ...row(100, [[60, '구분'], [140, '내용']]),
      ...row(120, [[60, '목표'], [140, '학급 규칙을 정하고']]),
      ...row(133, [[140, '첫 주 일과표를 씁니다']]),
      ...row(153, [[60, '준비물'], [140, '노트북과 명렬표']]),
      ...row(173, [[60, '과제'], [140, '운영 계획서 한 쪽 쓰기']]),
    ];
    const p = page(items);
    assert.deepEqual(p.tables[0].rows[1], ['목표', '학급 규칙을 정하고 첫 주 일과표를 씁니다']);
    assert.equal(p.tables[0].rows.length, 4);
  });

  test('두 단 문서는 표로 묶지 않음', () => {
    const left = '학교 안전 교육은 학생이 스스로 위험을 알아차리고';
    const right = '교사는 계절과 학년에 맞춰 사례를 고르고 실제로';
    const items = [];
    for (let i = 0; i < 12; i++) items.push(item(left, 50, 100 + i * 14), item(right, 320, 100 + i * 14));
    const p = page(items);
    assert.equal(p.tables.length, 0);
    assert.equal(p.paragraphs.length > 0, true);
  });

  test('세 단 문서(칸 폭이 같고 모든 줄이 꽉 참)도 표로 묶지 않음', () => {
    const items = [];
    const words = ['스스로 위험을 알아차', '피하는 힘을 기르는 데', '적이 있습니다 교사는'];
    for (let i = 0; i < 10; i++) for (let c = 0; c < 3; c++) items.push(item(words[(i + c) % 3], 50 + c * 170, 100 + i * 14));
    assert.equal(page(items).tables.length, 0);
  });

  test('머리표·번호 목록(탭으로 띄움)은 표가 아님', () => {
    const items = [];
    ['노트북을 켜고 와이파이에 연결합니다.', '크롬 브라우저를 엽니다.', '모둠 게시판에 의견을 남깁니다.'].forEach((t, i) => items.push(item(`${i + 1}.`, 60, 100 + i * 16), item(t, 90, 100 + i * 16)));
    ['학생 명렬표', '활동지 30장', '보드마커'].forEach((t, i) => items.push(item('', 60, 160 + i * 16), item(t, 90, 160 + i * 16)));
    const p = page(items);
    assert.equal(p.tables.length, 0);
    assert.ok(p.paragraphs.some((x) => x.text.includes('크롬 브라우저를 엽니다.')));
  });

  test('이름표 양식("기간:" 칸 + 값)은 문단으로 남음', () => {
    const items = [
      item('연수 안내', 60, 60, 20),
      ...row(100, [[60, '기간:'], [130, '2027. 3. 4.(수) ~ 3. 25.(수)']]),
      ...row(116, [[60, '장소:'], [130, '한빛초등학교 시청각실']]),
      ...row(132, [[60, '대상:'], [130, '3~4학년 담임 교사 20명']]),
    ];
    const p = page(items);
    assert.equal(p.tables.length, 0);
    assert.ok(p.paragraphs.some((x) => x.text === '장소: 한빛초등학교 시청각실'));
  });

  test('번호 목록 옆의 글상자(나란한 두 덩이)는 표가 아님', () => {
    const items = [
      ...row(100, [[60, '1. 제미나이에 접속해 로그인합니다.'], [330, '프롬프트']]),
      ...row(116, [[60, '2. 아래 글을 붙여 넣습니다.'], [330, '너는 초등학교 5학년 교사야.']]),
      ...row(132, [[60, '3. 어려운 낱말을 다시 묻습니다.'], [330, '학습 목표를 3개 써 줘.']]),
    ];
    assert.equal(page(items).tables.length, 0);
  });
});

describe('PDF 표: 앱 길과 CLI 보조 길이 같은 표', () => {
  const py = spawnSync('python3', ['-c', 'import pymupdf'], { encoding: 'utf8' }).status === 0 || spawnSync('python3', ['-c', 'import fitz'], { encoding: 'utf8' }).status === 0;
  test('workshop.pdf 5쪽 도구 표(파이썬 보조 스크립트)', { skip: !py && 'PyMuPDF 없음' }, () => {
    const tmp = mkdtempSync(join(tmpdir(), 'lecpage-pdf-'));
    try {
      const out = join(tmp, 'm.json');
      const r = spawnSync('python3', ['-I', join(SCRIPTS, 'ingest.py'), join(FX, 'workshop.pdf'), '-o', out], { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
      const m = JSON.parse(readFileSync(out, 'utf8'));
      assert.deepEqual(m.pages[4].tables[0].rows, [['도구', '잘하는 일', '계정'], ['Gemini', '검색·요약', 'Google 계정'], ['ChatGPT', '글쓰기', '이메일'], ['Claude', '긴 글 분석', '이메일']]);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });
  test('workshop.pdf 5쪽 도구 표(pdf.js, PDFJS_DIST 지정 시)', { skip: !process.env.PDFJS_DIST && 'PDFJS_DIST 없음' }, async () => {
    const base = process.env.PDFJS_DIST;
    const pdfjsLib = await import(join(base, 'legacy/build/pdf.mjs'));
    const m = await ingestFile('workshop.pdf', new Uint8Array(readFileSync(join(FX, 'workshop.pdf'))), { pdfjsLib, cMapUrl: join(base, 'cmaps/'), standardFontDataUrl: join(base, 'standard_fonts/') });
    assert.deepEqual(m.pages[4].tables[0].rows, [['도구', '잘하는 일', '계정'], ['Gemini', '검색·요약', 'Google 계정'], ['ChatGPT', '글쓰기', '이메일'], ['Claude', '긴 글 분석', '이메일']]);
  });
});
