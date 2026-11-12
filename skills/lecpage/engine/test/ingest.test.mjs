// 교재 해석(ingest) 테스트: node --test skills/lecpage/engine/test
// 견본 교재는 test/fixtures/make_fixtures.py로 다시 만들 수 있습니다.
// PDF를 JS(pdf.js)로도 확인하려면 PDFJS_DIST=<pdfjs-dist 폴더> 를 주세요(없으면 파이썬 대체 경로만 확인).
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { zipSync, strToU8 } from '../vendor/fflate.js';
import {
  ingestFile, mergeMaterials, ingestText, ingestUrl, ingestPaths, materialToDraft, materialToAIContext, materialToJSON,
  detect, TOOLS, matchToolsInText, toolForUrl, parseKoreanDates, parseTimeRange, normText, exportUrlFor, imageFileName,
} from '../src/ingest/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FX = join(HERE, 'fixtures');
const SCRIPTS = join(HERE, '..', '..', 'scripts');
const read = (f) => readFileSync(join(FX, f));
const TODAY = '2026-11-09';
const key = (s) => String(s).replace(/\s+/g, '');
const hasPython = spawnSync('python3', ['-c', 'import pymupdf'], { encoding: 'utf8' }).status === 0
  || spawnSync('python3', ['-c', 'import fitz'], { encoding: 'utf8' }).status === 0;
const HANGUL_ERR = /[가-힣]/;

let validate = null;
try { ({ validate } = await import('../src/validate.js')); } catch { /* 검증기가 아직 없으면 기본 모양만 확인 */ }

let pdfjsLib = null;
if (process.env.PDFJS_DIST) {
  try { pdfjsLib = await import(join(process.env.PDFJS_DIST, 'legacy/build/pdf.mjs')); } catch { pdfjsLib = null; }
}

// ── PPTX ──────────────────────────────────────────────
describe('PPTX', () => {
  let m;
  before(async () => { m = await ingestFile('workshop.pptx', read('workshop.pptx'), { today: TODAY, withImages: true }); });

  test('슬라이드 순서·제목·레이아웃', () => {
    assert.deepEqual(m.errors, []);
    assert.equal(m.files[0].type, 'pptx');
    assert.equal(m.files[0].id, 'deck1');
    assert.equal(m.pages.length, 13);
    assert.equal(m.files[0].pages, 13);
    assert.equal(m.pages[0].title, '생성형 AI로 여는 우리 반 수업');
    assert.equal(m.pages[0].layout, 'title');
    assert.equal(m.pages[3].layout, 'section');
    assert.equal(m.pages[7].title, '실습 1. 제미나이로 영상 요약하기');
    assert.equal(m.pages[11].title, '확인 퀴즈');
    assert.deepEqual(m.pages.map((p) => p.page), Array.from({ length: 13 }, (_, i) => i + 1));
  });

  test('문단 수준·자동 번호·노트·링크', () => {
    const p8 = m.pages[7];
    const nums = p8.paragraphs.filter((x) => x.num).map((x) => x.num);
    assert.deepEqual(nums, [1, 2, 3, 4]);
    assert.ok(p8.paragraphs.some((x) => x.text === '프롬프트: 이 영상을 한국어로 요약해줘'));
    assert.match(p8.notes, /3분 이내/);
    assert.deepEqual(p8.links.map((l) => [l.url, l.label]), [['https://gemini.google.com/', '제미나이 바로가기']]); // 글 속 주소와 중복 제거
    assert.equal(m.pages[10].links[0].label, 'NotebookLM 열기');
    assert.ok(m.pages[2].paragraphs.every((x) => x.bullet), '본문 자리표시자는 글머리표 상속');
  });

  test('그림(바이트)·표·반복 문구', () => {
    const im = m.pages[7].images[0];
    assert.equal(im.id, 'deck1-p8-1');
    assert.equal(im.mime, 'image/png');
    assert.ok(im.bytes instanceof Uint8Array && im.bytes[0] === 0x89 && im.bytes[1] === 0x50, 'PNG 바이트');
    assert.ok(im.width > 100 && im.share > 0);
    assert.equal(m.pages[4].tables[0].rows.length, 4);
    assert.deepEqual(m.pages[4].tables[0].rows[1], ['Gemini', '검색·요약', 'Google 계정']);
    assert.deepEqual(m.boilerplate.map((b) => b.text), ['○○교육지원청 AI 연수']);
    assert.ok(!m.pages.some((p) => p.paragraphs.some((x) => x.text === '○○교육지원청 AI 연수')));
  });

  test('디자인: 테마 색·글꼴·쪽 비율', () => {
    assert.equal(m.design.colors.accent1, '#4F81BD');
    assert.equal(m.design.fonts.major.latin, 'Calibri');
    assert.equal(m.design.fonts.major.ea, '맑은 고딕');
    assert.equal(m.design.fontsUsed[0].name, '맑은 고딕');
    assert.equal(m.design.slideSize.ratio, '16:9');
  });

  test('JSON으로 바꾸면 바이트가 빠짐', () => {
    const j = materialToJSON(m, { imageSrc: (im) => 'media/' + imageFileName(im) });
    const s = JSON.stringify(j);
    assert.ok(!s.includes('"bytes"'));
    assert.equal(j.pages[7].images[0].src, 'media/deck1-p8-1.png');
    assert.ok(s.length < 200000);
  });
});

// ── 감지 ──────────────────────────────────────────────
describe('감지(detect)', () => {
  let d;
  before(async () => { d = (await ingestFile('workshop.pptx', read('workshop.pptx'), { today: TODAY })).detected; });

  test('일시·장소·주최', () => {
    assert.equal(d.event.date, '2026-11-04');
    assert.equal(d.event.weekday, '수');
    assert.equal(d.event.start, '15:10');
    assert.equal(d.event.end, '16:40');
    assert.equal(d.event.venue, '한빛초등학교 본관 3층 시청각실');
    assert.equal(d.event.organizer, '서울특별시교육청');
    assert.equal(d.event.mode, 'offline');
    assert.equal(d.title, '생성형 AI로 여는 우리 반 수업');
  });

  test('강사·차례·부(Part)', () => {
    assert.equal(d.instructor.name, '김하늘');
    assert.equal(d.instructor.email, 'hanul.kim@example.com');
    assert.equal(d.instructor.org, '한빛초등학교');
    assert.equal(d.instructor.page, 2);
    assert.equal(d.agenda.page, 3);
    assert.equal(d.agenda.items.length, 4);
    assert.deepEqual(d.sections.map((s) => [s.label, s.title, s.page]), [
      ['PART 1', '생성형 AI 이해하기', 4], ['PART 2', '제미나이로 수업 자료 만들기', 7], ['PART 3', 'NotebookLM으로 자료 정리하기', 10],
    ]);
    assert.deepEqual(d.sections[1].pages, [7, 8, 9]);
  });

  test('프롬프트(이름표·틀·따옴표·요청 어미)', () => {
    const texts = d.prompts.map((p) => p.text);
    assert.ok(texts.includes('이 영상을 한국어로 요약해줘'));
    assert.ok(texts.includes('우리 반 학생 수준에 맞게 더 쉬운 말로 바꿔줘'));
    assert.ok(texts.includes('5학년 2학기 과학 성취기준을 표로 정리해줘'), 'STEP 표시·"질문하기:" 이름표는 떼어 냄');
    const tmpl = d.prompts.find((p) => p.cue === 'template');
    assert.equal(tmpl.text, '역할: 너는 초등학교 5학년 과학 교사야.\n목표: [단원명] 수업에 쓸 활동지를 만들어 줘.\n형식: 표로 정리하고 문항은 5개로 해 줘.');
    assert.ok(!texts.some((t) => /패들렛에 공유합니다|붙여 넣으세요/.test(t)), '참가자 안내문은 프롬프트가 아님');
  });

  test('프롬프트와 참가자 안내 구분', () => {
    const cases = [
      ['오늘 배운 내용에 대한 소감을 작성해 주세요.', false], ['결과를 패들렛에 올려 주세요.', false],
      ['다음 중 알맞은 것을 고르시오.', false], ['여러분도 꼭 한번 직접 해 봐', false],
      ['선생님들, 오늘 배운 내용을 요약해 주세요.', false], ['아래 링크에 접속해 주세요.', false],
      ['초등학생 수준으로 광합성을 쉽게 설명해 주세요.', true], ['우리 반 학급 규칙 5가지를 만들어 주세요.', true],
      ['이 글을 영어로 번역해 주세요.', true], ['수업 아이디어를 추천해줘', true], ['방금 만든 활동지를 표로 정리해 줘.', true],
    ];
    const t = ingestText(cases.map(([l]) => '- ' + l).join('\n'), { markdown: true });
    const found = t.detected.prompts.map((p) => p.text);
    for (const [line, expected] of cases) assert.equal(found.some((f) => line.includes(f)), expected, line);
  });

  test('실습 단계', () => {
    const s8 = d.steps.find((s) => s.page === 8);
    assert.equal(s8.items.length, 4);
    assert.equal(s8.items[1], '유튜브 영상 주소를 복사합니다.');
    const s11 = d.steps.find((s) => s.page === 11);
    assert.deepEqual(s11.items.slice(0, 2), ['notebooklm.google.com 접속', '교육과정 PDF 업로드']);
    assert.ok(d.steps.find((s) => s.page === 9).items.includes('결과를 구글 문서로 내보내기'));
    assert.ok(!d.steps.some((s) => s.page === 3), '차례 쪽은 단계가 아님');
  });

  test('링크·도구', () => {
    const urls = d.links.map((l) => l.url);
    assert.ok(urls.includes('https://gemini.google.com/'));
    assert.ok(urls.includes('https://notebooklm.google.com/'));
    assert.equal(d.links.find((l) => l.url.includes('forms.gle')).kind, 'form');
    const ids = d.tools.map((t) => t.id);
    for (const id of ['gemini', 'notebooklm', 'padlet', 'youtube', 'chatgpt', 'claude']) assert.ok(ids.includes(id), id);
    assert.equal(ids[0], 'gemini');
    assert.ok(!ids.includes('digital-textbook'), '강사 약력 속 낱말은 도구로 세지 않음');
    const g = d.tools[0];
    assert.equal(g.url, 'https://gemini.google.com');
    assert.equal(g.account, 'google');
    assert.ok(g.pages.includes(8) && g.refs.some((r) => r.file === 'deck1' && r.page === 8));
  });

  test('퀴즈·용어·핵심 문장', () => {
    assert.equal(d.quiz.length, 1);
    assert.deepEqual(d.quiz[0].options, ['빠른 속도', '할루시네이션', '화려한 디자인', '무료 사용']);
    assert.equal(d.quiz[0].answer, 1);
    assert.match(d.quiz[0].explain, /그럴듯하게/);
    assert.deepEqual(d.glossary.map((g) => g.term), ['생성형 AI (Generative AI)', '할루시네이션 (Hallucination)']);
    assert.equal(d.messages[0].text, 'AI는 선생님을 대신하지 않습니다. 선생님의 시간을 돌려줍니다!');
    assert.ok(d.messages.some((m) => m.closing));
  });

  test('실습 비율 → 유형 힌트', () => {
    assert.deepEqual(d.practice.pages.map((p) => p.page), [8, 9, 11]);
    assert.equal(d.practice.ratio, 0.5);
    assert.equal(d.archetype.primary, 'lab');
    assert.ok(HANGUL_ERR.test(d.archetype.reason_ko));
  });
});

// ── 설계도 초안·AI 요약 ───────────────────────────────────
describe('초안(draft)·AI 요약(outline)', () => {
  let m, draft;
  before(async () => {
    m = await ingestFile('workshop.pptx', read('workshop.pptx'), { today: TODAY });
    draft = materialToDraft(m, { slidesBase: 'assets/slides/', surveyUrl: 'https://forms.gle/abcdEFGH123' });
  });

  test('설계도 기본 모양(§2)', () => {
    assert.equal(draft.version, 1);
    assert.equal(draft.meta.title, '생성형 AI로 여는 우리 반 수업');
    assert.equal(draft.meta.date, '2026-11-04');
    assert.equal(draft.meta.admin.hours, 1.5);
    assert.equal(draft.archetype.primary, 'lab');
    assert.equal(draft.sections[0].type, 'hero');
    const ids = draft.sections.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, 'id 중복 없음');
    const types = draft.sections.map((s) => s.type);
    for (const t of ['hero', 'readiness', 'outline', 'stations', 'prompts', 'tools', 'deck', 'quiz', 'instructor', 'survey', 'closing']) assert.ok(types.includes(t), t);
    assert.ok(!types.includes('materials'), '받을 주소가 없는 교재 파일 이름은 자료실에 보이지 않음');
    assert.ok(materialToDraft(m, { deckHref: 'assets/media/workshop.pptx' }).sections.some((s) => s.type === 'materials' && s.items[0].href === 'assets/media/workshop.pptx'));
    assert.equal(draft.instructors[0].name, '김하늘');
    assert.equal(draft.instructors[0].showEmail, false, '이메일은 기본으로 숨김');
    assert.deepEqual(draft.sources, [{ id: 'deck1', name: 'workshop.pptx', pages: 13 }]);
  });

  test('실습 스테이션·교재 뷰어', () => {
    const st = draft.sections.find((s) => s.type === 'stations');
    assert.equal(st.items.length, 3);
    assert.equal(st.items[0].name, '제미나이로 영상 요약하기');
    assert.equal(st.items[0].tag, 'PART 2');
    assert.equal(st.items[0].steps.length, 4);
    assert.equal(st.items[0].prompts[0].text, '이 영상을 한국어로 요약해줘');
    assert.deepEqual(st.items[0].source, { file: 'deck1', pages: [8] });
    assert.equal(st.items[0].links[0].url, 'https://gemini.google.com/');
    const deck = draft.sections.find((s) => s.type === 'deck');
    assert.equal(deck.slides.length, 13);
    assert.equal(deck.slides[7].src, 'assets/slides/slide-008.webp');
    assert.ok(deck.slides[7].tools.includes('Gemini'));
    const quiz = draft.sections.find((s) => s.type === 'quiz');
    assert.equal(quiz.items[0].answer, 1);
  });

  test('엔진 검증기(validate) 통과', { skip: !validate && '검증기 없음' }, () => {
    const r = validate(draft);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, []);
    assert.equal(r.blueprint.sections.find((s) => s.type === 'stations').items[0].prompts.length, 1);
  });

  test('AI 요약: 쪽 번호·프롬프트 원문 유지·길이 예산', () => {
    const full = materialToAIContext(m);
    assert.match(full, /## p\.8 \[실습\] 실습 1\. 제미나이로 영상 요약하기/);
    assert.ok(full.includes('[프롬프트] 프롬프트: 이 영상을 한국어로 요약해줘'));
    assert.ok(full.includes('목표: [단원명] 수업에 쓸 활동지를 만들어 줘.'));
    assert.ok(full.includes('> 노트: 영상은 3분 이내'));
    assert.equal(full.split('○○교육지원청 AI 연수').length - 1, 1, '반복 문구는 머리말에 한 번만');
    for (const budget of [3000, 1500, 600]) {
      const small = materialToAIContext(m, { maxChars: budget });
      assert.ok(small.length <= budget, `${budget} 이하: ${small.length}`);
      if (budget >= 1500) assert.ok(small.includes('이 영상을 한국어로 요약해줘'), `${budget}에도 프롬프트 유지`);
    }
  });

  test('감지 정보가 없어도 초안 생성(빈 자료)', () => {
    const t = ingestText('그냥 짧은 메모');
    const dr = materialToDraft(t, { title: '내 연수' });
    assert.equal(dr.meta.title, '내 연수');
    assert.equal(dr.sections[0].type, 'hero');
  });
});

// ── DOCX·HWPX·MD·TXT ───────────────────────────────────
describe('문서형 자료', () => {
  test('DOCX: 제목 스타일로 나누기·목록·링크·표·그림', async () => {
    const m = await ingestFile('guide.docx', read('guide.docx'), { today: TODAY });
    assert.deepEqual(m.errors, []);
    assert.equal(m.files[0].type, 'docx');
    assert.equal(m.files[0].unit, 'section');
    assert.deepEqual(m.pages.map((p) => p.title), ['AI 연수 운영 안내서', '1. 연수 개요', '2. 실습 준비', '3. 실습 순서', '4. 도구 정리']);
    assert.ok(m.pages[2].paragraphs.every((x) => x.bullet));
    assert.deepEqual(m.pages[3].paragraphs.filter((x) => x.num).map((x) => x.num), [1, 2, 3]);
    assert.deepEqual(m.pages[3].links, [{ url: 'https://padlet.com/example/ai-training', label: '우리 연수 보드' }]);
    assert.equal(m.pages[4].tables[0].rows[2][0], 'Padlet');
    assert.equal(m.pages[4].images[0].path, 'word/media/image1.png');
    const d = m.detected;
    assert.equal(d.event.date, '2026-11-04');
    assert.equal(d.event.start, '15:10');
    assert.equal(d.event.end, '16:40');
    assert.deepEqual(d.prompts.map((p) => p.text), ['우리 학교 운동회 안내문을 학부모용으로 써줘']);
    assert.equal(d.steps[0].items.length, 3);
    assert.ok(d.tools.some((t) => t.id === 'padlet'));
  });

  test('HWPX: 본문·개요 제목·하이퍼링크 필드·표·그림·쪽 나눔', async () => {
    const m = await ingestFile('plan.hwpx', read('plan.hwpx'), { today: TODAY, withImages: true });
    assert.deepEqual(m.errors, []);
    assert.equal(m.files[0].type, 'hwpx');
    assert.equal(m.files[0].title, '교사 AI 연수 계획');
    assert.equal(m.files[0].author, '김하늘');
    assert.deepEqual(m.pages.map((p) => p.title), ['교사 AI 연수 계획', '실습 안내', '마무리']);
    assert.deepEqual(m.pages[0].links, [{ url: 'https://gemini.google.com/', label: '제미나이' }]);
    assert.deepEqual(m.pages[0].tables[0].rows, [['시간', '내용'], ['15:10~15:40', '패들렛으로 의견 모으기']]);
    assert.equal(m.pages[0].images[0].alt, '연수 장소 사진');
    assert.ok(m.pages[0].images[0].bytes.length > 100);
    assert.equal(m.pages[2].paragraphs[0].text, '배운 점을 한 줄로 남겨 주세요.\n감사합니다.', '줄바꿈 유지');
    assert.equal(m.design.fonts.major.ea, '함초롬바탕');
    const d = m.detected;
    assert.equal(d.event.date, '2026-11-04');
    assert.equal(d.event.venue, '한빛초등학교 시청각실');
    assert.deepEqual(d.prompts.map((p) => p.text), ['우리 반 의견을 세 문장으로 요약해줘']);
    assert.deepEqual(d.steps[0].items, ['패들렛에 접속합니다.', '모둠별 게시판에 의견을 남깁니다.', '제미나이로 의견을 요약합니다.']);
  });

  test('Markdown: 제목·코드 블록 프롬프트·링크', async () => {
    const m = await ingestFile('notes.md', read('notes.md'));
    assert.deepEqual(m.pages.map((p) => p.title), ['실습 메모', '프롬프트 모음', '링크']);
    assert.equal(m.pages[1].paragraphs[0].role, 'code');
    assert.match(m.detected.prompts[0].text, /^역할: 너는 중학교 국어 교사야\.\n목표: \[작품명\]/);
    assert.deepEqual(m.pages[2].links, [{ url: 'https://padlet.com/example/board', label: '패들렛 보드' }]);
  });

  test('TXT(EUC-KR)도 읽기', async () => {
    let bytes;
    try { bytes = new Uint8Array(Buffer.from('7JWI64WV', 'base64')); } catch { bytes = null; }
    // "안녕"을 CP949로: BE C8 B3 E7
    const cp949 = new Uint8Array([0xBE, 0xC8, 0xB3, 0xE7, 0x0A, 0xC7, 0xC1, 0xB7, 0xD2, 0xC7, 0xC1, 0xC6, 0xAE, 0x3A, 0x20, 0xBF, 0xE4, 0xBE, 0xE0, 0xC7, 0xD8, 0xC1, 0xE0]);
    const m = await ingestFile('memo.txt', cp949);
    assert.deepEqual(m.errors, []);
    assert.equal(m.pages[0].title, '안녕');
    assert.equal(m.pages[0].paragraphs[0].text, '프롬프트: 요약해줘');
    assert.ok(bytes);
  });

  test('붙여 넣은 글(ingestText)', () => {
    const m = ingestText('# AI 연수\n일시: 11월 4일(수) 15:10~16:40\n\n## 실습\n1. 패들렛 접속\n2. "학급 규칙을 정리해줘"라고 입력', { markdown: true, today: TODAY });
    assert.equal(m.files[0].type, 'md');
    assert.equal(m.detected.event.date, '2026-11-04', '연도 없는 날짜는 요일로 연도 추정');
    assert.ok(m.detected.prompts.some((p) => p.text === '학급 규칙을 정리해줘'));
  });
});

// ── PDF ───────────────────────────────────────────────
describe('PDF', () => {
  test('Node에 pdf.js가 없으면 needs-pdfjs(파이썬 대체 신호)', { skip: !!pdfjsLib && 'pdf.js 있음' }, async () => {
    const m = await ingestFile('workshop.pdf', read('workshop.pdf'));
    if (m.pages.length) return; // pdfjs-dist가 설치된 환경
    assert.equal(m.errors[0].code, 'needs-pdfjs');
    assert.equal(m.errors[0].fallback, 'python');
    assert.ok(HANGUL_ERR.test(m.errors[0].message_ko));
  });

  test('pdf.js로 읽기(PDFJS_DIST 지정 시)', { skip: !pdfjsLib && 'PDFJS_DIST 없음' }, async () => {
    const base = process.env.PDFJS_DIST;
    const m = await ingestFile('workshop.pdf', read('workshop.pdf'), { today: TODAY, pdfjsLib, cMapUrl: join(base, 'cmaps/'), standardFontDataUrl: join(base, 'standard_fonts/') });
    assert.deepEqual(m.errors, []);
    assert.equal(m.pages.length, 13);
    assert.equal(key(m.pages[7].title), key('실습 1. 제미나이로 영상 요약하기'));
    assert.equal(m.pages[7].links[0].label, '제미나이 바로가기');
    const d = m.detected;
    assert.equal(d.event.date, '2026-11-04');
    assert.ok(d.prompts.some((p) => key(p.text) === key('이 영상을 한국어로 요약해줘')));
    assert.equal(d.sections.length, 3);
    assert.equal(d.archetype.primary, 'lab');
  });

  test('파이썬 보조 스크립트(ingest.py)로 같은 모양', { skip: !hasPython && 'PyMuPDF 없음' }, async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'lecpage-test-'));
    try {
      const out = join(tmp, 'm.json');
      const r = spawnSync('python3', ['-I', join(SCRIPTS, 'ingest.py'), join(FX, 'workshop.pdf'), '-o', out, '--images', join(tmp, 'img')], { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
      const m = JSON.parse(readFileSync(out, 'utf8'));
      assert.equal(m.kind, 'lecpage-material');
      assert.equal(m.version, 1);
      assert.equal(m.files[0].type, 'pdf');
      assert.equal(m.pages.length, 13);
      for (const k of ['file', 'page', 'kind', 'title', 'paragraphs', 'notes', 'links', 'images', 'tables']) assert.ok(k in m.pages[0], k);
      assert.equal(m.pages[1].images[0].src, 'img/deck1-p2-1.png');
      // JS 감지를 파이썬 결과에 그대로 적용
      const d = detect(m, { today: TODAY });
      assert.equal(d.event.date, '2026-11-04');
      assert.equal(d.event.start, '15:10');
      assert.ok(d.prompts.some((p) => key(p.text) === key('이 영상을 한국어로 요약해줘')));
      assert.ok(d.tools.some((t) => t.id === 'notebooklm'));
      assert.deepEqual(d.sections.map((s) => s.label), ['PART 1', 'PART 2', 'PART 3']);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });

  test('ingestPaths: PDF는 파이썬으로 대신 읽고, PPTX와 짝지음(renderOf)', { skip: !hasPython && !pdfjsLib && 'PDF 도구 없음' }, async () => {
    const m = await ingestPaths([join(FX, 'workshop.pptx'), join(FX, 'workshop.pdf')], { today: TODAY, pdfjsLib: pdfjsLib || undefined, withImages: true });
    assert.deepEqual(m.errors, []);
    assert.deepEqual(m.files.map((f) => f.id), ['deck1', 'deck2']);
    assert.equal(m.files[1].renderOf, 'deck1');
    assert.equal(m.files[0].renderSource, 'deck2');
    assert.equal(m.detected.prompts.filter((p) => key(p.text) === key('이 영상을 한국어로 요약해줘')).length, 1, 'PDF본은 감지에서 제외');
    const ids = m.pages.flatMap((p) => p.images.map((im) => im.id));
    assert.equal(new Set(ids).size, ids.length, '그림 id 중복 없음');
    const draft = materialToDraft(m);
    assert.equal(draft.sections.find((s) => s.type === 'deck').slides.length, 13);
  });
});

// ── 합치기·링크 ───────────────────────────────────────────
describe('합치기·링크', () => {
  test('mergeMaterials: id 겹침 해결·그림 id 바꿈·다시 감지', async () => {
    const a = await ingestFile('a.pptx', read('workshop.pptx'), { detect: false });
    const b = await ingestFile('b.pptx', read('workshop.pptx'), { detect: false });
    const c = await ingestFile('guide.docx', read('guide.docx'), { detect: false });
    const m = mergeMaterials([c, a, b], { today: TODAY });
    assert.deepEqual(m.files.map((f) => f.id), ['deck1', 'deck2', 'doc1'], '슬라이드 자료가 앞으로');
    assert.equal(m.pages.length, 13 + 13 + 5);
    assert.ok(m.pages.filter((p) => p.file === 'deck2').every((p) => p.images.every((im) => im.id.startsWith('deck2-'))));
    assert.ok(m.detected);
    assert.equal(m.detected.event.date, '2026-11-04');
    const pad = m.detected.tools.find((t) => t.id === 'padlet');
    assert.ok(pad.refs.some((r) => r.file === 'doc1') && pad.refs.some((r) => r.file === 'deck1'));
  });

  test('구글 슬라이드 링크 → PPTX 내보내기 주소, 받기 실패 시 링크만', async () => {
    const url = 'https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOp/edit#slide=id.p';
    assert.equal(exportUrlFor(url).url, 'https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOp/export/pptx');
    const bytes = read('workshop.pptx');
    const ok = await ingestUrl(url, { fetch: async () => ({ ok: true, headers: new Map(), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }), today: TODAY });
    assert.equal(ok.pages.length, 13);
    assert.equal(ok.files[0].url, url);
    const fail = await ingestUrl(url, { fetch: async () => { throw new TypeError('Failed to fetch'); } });
    assert.equal(fail.files[0].type, 'link');
    assert.equal(fail.warnings[0].code, 'link-fetch-failed');
    const padlet = await ingestUrl('https://padlet.com/example/board', { fetch: null });
    assert.equal(padlet.pages[0].title, 'Padlet');
    assert.equal(padlet.warnings[0].code, 'link-only');
    const bad = await ingestUrl('javascript:alert(1)');
    assert.equal(bad.errors[0].code, 'bad-url');
  });
});

// ── 오류·안전 ─────────────────────────────────────────────
describe('오류는 던지지 않고 한국어 안내로', () => {
  const cfb = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, ...new Array(600).fill(0)]);
  const cases = [
    ['빈 파일', 'a.pptx', new Uint8Array(0), 'empty'],
    ['예전 한글', '계획.hwp', cfb, 'legacy-hwp'],
    ['예전 한글 3.0', '옛날.hwp', strToU8('HWP Document File V3.00 \x1a\x01\x02\x03\x04\x05'), 'legacy-hwp'],
    ['예전 파워포인트', '교재.ppt', cfb, 'legacy-ppt'],
    ['예전 워드', '안내.doc', cfb, 'legacy-doc'],
    ['암호 걸린 PPTX', '교재.pptx', cfb, 'encrypted'],
    ['DRM(소프트캠프)', '교재.pptx', strToU8('SCDSA002\x00\x00\x00' + 'x'.repeat(100)), 'drm'],
    ['DRM(알 수 없는 바이너리)', '교재.pptx', new Uint8Array(2000).map((_, i) => (i * 37) % 256), 'drm'],
    ['손상된 ZIP', '교재.pptx', read('workshop.pptx').subarray(0, 4000), 'corrupt'],
    ['엑셀', '명단.xlsx', zipSync({ 'xl/workbook.xml': strToU8('<workbook/>'), '[Content_Types].xml': strToU8('<Types/>') }), 'spreadsheet'],
    ['알 수 없는 ZIP', '묶음.zip', zipSync({ 'a.txt': strToU8('hello') }), 'unsupported'],
    ['알 수 없는 바이너리', 'x.bin', new Uint8Array(3000).map((_, i) => (i * 91) % 256), 'unsupported'],
  ];
  for (const [label, name, bytes, code] of cases) {
    test(label, async () => {
      const m = await ingestFile(name, bytes);
      assert.equal(m.errors.length, 1, JSON.stringify(m.errors));
      assert.equal(m.errors[0].code, code);
      assert.ok(HANGUL_ERR.test(m.errors[0].message_ko));
      assert.equal(m.pages.length, 0);
      assert.equal(m.detected, null);
    });
  }

  test('크기 제한(maxBytes)', async () => {
    const m = await ingestFile('교재.pptx', read('workshop.pptx'), { maxBytes: 10_000 });
    assert.equal(m.errors[0].code, 'too-large');
    assert.match(m.errors[0].message_ko, /MB/);
  });

  test('압축 폭탄 방지(선언된 압축 해제 크기 합계)', async () => {
    const big = new Uint8Array(30 * 1024 * 1024); // 0으로 가득: 압축하면 매우 작음
    const bomb = zipSync({ 'ppt/presentation.xml': strToU8('<p:presentation/>'), 'ppt/media/big.bin': big }, { level: 9 });
    assert.ok(bomb.length < 200_000);
    const m = await ingestFile('bomb.pptx', bomb, { limits: { maxUncompressed: 5 * 1024 * 1024 } });
    assert.equal(m.errors[0].code, 'zip-bomb');
  });

  test('깨진 XML이 있어도 읽을 수 있는 만큼', async () => {
    const zip = zipSync({
      '[Content_Types].xml': strToU8('<Types/>'),
      'ppt/presentation.xml': strToU8('<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>'),
      'ppt/_rels/presentation.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Type="http://x/slide" Target="slides/slide1.xml"/></Relationships>'),
      'ppt/slides/slide1.xml': strToU8('<p:sld xmlns:p="p" xmlns:a="a"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="t"/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>깨진 &amp; 제목</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:txBody><a:p><a:r><a:t>닫히지 않은 글'),
    });
    const m = await ingestFile('broken.pptx', zip);
    assert.deepEqual(m.errors, []);
    assert.equal(m.pages[0].title, '깨진 & 제목');
    assert.equal(m.pages[0].paragraphs[0].text, '닫히지 않은 글');
  });
});

// ── 도구 목록·날짜·글자 ──────────────────────────────────────
describe('도구 목록·날짜·글자 정리', () => {
  test('도구 80개 이상, 필수 필드', () => {
    assert.ok(TOOLS.length >= 80, `${TOOLS.length}`);
    assert.equal(new Set(TOOLS.map((t) => t.id)).size, TOOLS.length);
    for (const t of TOOLS) {
      assert.ok(t.id && t.name && Array.isArray(t.aliases) && t.category && t.icon, t.id);
      assert.equal(typeof t.accountNeeded, 'boolean', t.id);
      assert.ok(t.url === '' || /^https:\/\//.test(t.url), t.id);
      assert.ok(t.minors, t.id);
    }
    for (const id of ['gemini', 'chatgpt', 'claude', 'notebooklm', 'canva', 'miricanvas', 'padlet', 'thinkerbell', 'classtool', 'class123', 'hiclass', 'classting', 'elearning', 'wedorang', 'kahoot', 'wayground', 'mentimeter', 'slido', 'suno', 'vrew', 'gamma', 'wrtn', 'clova-note', 'papago', 'deepl', 'scratch', 'entry', 'microbit', 'cospaces', 'thinglink', 'book-creator', 'flip', 'google-earth', 'teachable-machine', 'quickdraw', 'autodraw', 'scroobly', 'classify', 'hi-learning', 'toctocmath', 'digital-textbook', 'aidt', 'notion', 'miro', 'figma', 'perplexity', 'copilot', 'ideogram', 'midjourney', 'firefly', 'capcut', 'canva-code', 'apps-script']) {
      assert.ok(TOOLS.some((t) => t.id === id), id);
    }
  });

  test('한국어 조사 경계·헷갈리는 낱말', () => {
    const m = matchToolsInText('제미나이로 요약하고 패들렛에 올려요. 노트북LM에서 정리. 감마선 실험과 플립러닝, from scratch, 미로찾기. 구글 클래스룸에 공유');
    const ids = [...m.keys()].sort();
    assert.deepEqual(ids, ['gemini', 'google-classroom', 'notebooklm', 'padlet']);
    assert.equal(toolForUrl('https://docs.google.com/forms/d/e/abc/viewform').id, 'google-forms');
    assert.equal(toolForUrl('https://app.sli.do/event/x').id, 'slido');
    assert.equal(toolForUrl('https://www.figma.com/board/abc').id, 'figjam');
    assert.equal(toolForUrl('https://example.com'), null);
  });

  test('한국 날짜 형식', () => {
    const d = (s, y = 2026) => parseKoreanDates(s, y).map((x) => [x.date, x.weekdayOk]);
    assert.deepEqual(d('2026. 11. 4.(수) 15:10~16:40'), [['2026-11-04', true]]);
    assert.deepEqual(d('2026년 11월 4일 수요일'), [['2026-11-04', true]]);
    assert.deepEqual(d('일시: 2026-11-04'), [['2026-11-04', null]]);
    assert.deepEqual(d('11월 4일(수)'), [['2026-11-04', true]]);
    assert.deepEqual(d('11. 4.(수)'), [['2026-11-04', true]]);
    assert.deepEqual(d('1월 6일(수)', 2026), [['2027-01-06', true]], '요일로 다음 해 추정(2026-01-06은 화요일)');
    assert.deepEqual(d('1월 7일(수)', 2026), [['2026-01-07', true]]);
    assert.deepEqual(d('26. 11. 4.(수)'), [['2026-11-04', true]]);
    assert.deepEqual(d('버전 3.14.15 와 1.2.3'), []);
    assert.deepEqual(d('2026. 2. 30.'), [], '없는 날짜');
  });

  test('시간 범위', () => {
    const t = (s) => { const r = parseTimeRange(s); return r && [r.start, r.end]; };
    assert.deepEqual(t('15:10~16:40'), ['15:10', '16:40']);
    assert.deepEqual(t('15:10 - 16:40'), ['15:10', '16:40']);
    assert.deepEqual(t('오후 3시 10분 ~ 4시 40분'), ['15:10', '16:40']);
    assert.deepEqual(t('3시~5시'), ['15:00', '17:00']);
    assert.deepEqual(t('오전 9시 30분부터 12시까지'), ['09:30', '12:00']);
    assert.deepEqual(t('14:00-16:00(2시간)'), ['14:00', '16:00']);
    assert.deepEqual(t('시작 14:30'), ['14:30', '']);
    assert.equal(parseTimeRange('1. 2. 3.'), null);
  });

  test('글자 정리: NFC·보이지 않는 글자·공백·줄바꿈', () => {
    const nfd = '한글'.normalize('NFD');
    assert.equal(normText(nfd), '한글');
    assert.equal(normText('  안녕  하세요​\r\n\n\n\n다음\t줄  '), '안녕 하세요\n\n다음 줄');
  });
});

// ── CLI ───────────────────────────────────────────────
describe('CLI', () => {
  test('scripts/ingest.mjs: material.json·초안·요약·그림 쓰기', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'lecpage-cli-'));
    try {
      const out = join(tmp, 'material.json');
      const r = spawnSync(process.execPath, [join(SCRIPTS, 'ingest.mjs'), join(FX, 'workshop.pptx'), join(FX, 'plan.hwpx'), '-o', out, '--images', join(tmp, 'media'), '--draft', join(tmp, 'draft.json'), '--context', join(tmp, 'ctx.txt'), '--today', TODAY], { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr + r.stdout);
      assert.match(r.stdout, /교재 해석: workshop\.pptx\(13장\)/);
      const m = JSON.parse(readFileSync(out, 'utf8'));
      assert.deepEqual(m.files.map((f) => f.id), ['deck1', 'doc1']);
      assert.equal(m.pages.find((p) => p.file === 'deck1' && p.page === 8).images[0].src, 'media/deck1-p8-1.png');
      assert.ok(existsSync(join(tmp, 'media', 'deck1-p8-1.png')));
      assert.ok(readdirSync(join(tmp, 'media')).includes('doc1-img1.png'));
      assert.equal(JSON.parse(readFileSync(join(tmp, 'draft.json'), 'utf8')).version, 1);
      assert.match(readFileSync(join(tmp, 'ctx.txt'), 'utf8'), /\[쪽별 내용\]/);
      const bad = spawnSync(process.execPath, [join(SCRIPTS, 'ingest.mjs'), join(tmp, '없는파일.pptx'), '-o', join(tmp, 'x.json')], { encoding: 'utf8' });
      assert.equal(bad.status, 1);
      assert.match(bad.stdout, /not-found/);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });

  test('render_slides.sh: PDF → slide-001.*', { skip: spawnSync('sh', ['-c', 'command -v pdftoppm'], { encoding: 'utf8' }).status !== 0 && 'pdftoppm 없음' }, () => {
    const tmp = mkdtempSync(join(tmpdir(), 'lecpage-render-'));
    try {
      const r = spawnSync('bash', [join(SCRIPTS, 'render_slides.sh'), join(FX, 'workshop.pdf'), tmp, '40'], { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
      const files = readdirSync(tmp).sort();
      assert.equal(files.length, 13);
      assert.match(files[0], /^slide-001\.(webp|png)$/);
      assert.match(files[12], /^slide-013\./);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });
});
