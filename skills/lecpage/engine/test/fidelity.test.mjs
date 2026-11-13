// 교재 그대로(초안 충실도) 회귀 시험: 교재 조각을 작게 만들어 초안·감지·그리기를 확인합니다.
// 비교 측정에서 사람이 손으로 고친 9가지(목표 말끝·일정 칸·프롬프트 끝 버튼 글·프롬프트 순서·강사 소속·
// 숨긴 쪽 뒤 그림·지어낸 글·고정 안내 문구·강사용 발표자 노트)가 다시 생기지 않게 합니다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/index.js';
import { nodeRuntime } from '../node.js';
import { validate } from '../src/validate.js';
import { materialToDraft, detect } from '../src/ingest/index.js';
import { splitNotes } from '../src/ingest/signals.js';
import { pagesForImages } from '../src/ingest/util.js';
import { pruneUnusedCss } from '../src/css-prune.js';

// ── 교재 조각 만들기 ─────────────────────────────────
const para = (x, block = 1) => (typeof x === 'string' ? { text: x, level: 0, block } : { level: 0, block, ...x });
const slide = (n, title, lines = [], extra = {}) => ({
  file: 'deck1', page: n, kind: 'slide', title, layout: 'content', paragraphs: lines.map((l) => para(l)), notes: '', links: [], images: [], tables: [], ...extra,
});
const deck = (pages) => ({ version: 1, kind: 'material', files: [{ id: 'deck1', name: 'lesson.pptx', type: 'pptx', pages: pages.length, unit: 'slide', size: 1000 }], pages, design: {}, meta: {}, errors: [], warnings: [] });
const cover = slide(1, '생성형 AI로 수업 자료 만들기', ['일시: 2026. 12. 3.(목) 14:00~17:00', '장소: 새솔초등학교 2층 컴퓨터실', '주관: 다울교육지원청']);
const practice8 = slide(8, '실습 1. 제미나이로 학습 목표 다듬기', [
  { text: 'gemini.google.com에 접속해 Google 계정으로 로그인합니다.', num: 1 },
  { text: '아래 프롬프트를 복사해 입력창에 붙여 넣습니다.', num: 2 },
  { text: '답에서 어려운 낱말을 찾아 "5학년이 아는 말로 바꿔 줘"라고 다시 요청합니다.', num: 3 },
  para('프롬프트', 2), para("너는 초등학교 5학년 과학 교사야. '태양계와 별' 단원의 학습 목표를 3개 써 줘.", 2), para('제미나이 열기', 2),
], { links: [{ url: 'https://gemini.google.com/', label: '제미나이 열기' }], notes: '막히면: 로그인 화면이 반복되면 시크릿 창을 닫고 일반 창에서 다시 엽니다. 10분이 지나면 다음 단계로 넘어갑니다.' });
const practice11 = slide(11, '실습 2. 캔바로 활동지 만들기', [
  { text: 'canva.com에 접속해 교육용 계정으로 로그인합니다.', num: 1 },
  { text: '검색창에 "활동지"를 입력하고 A4 세로 템플릿을 고릅니다.', num: 2 },
  { text: 'PDF로 내려받아 저장합니다.', num: 3 },
  para('프롬프트: 5학년 학생이 행성의 크기를 비교하는 탐구 질문 3개를 만들어 줘.', 2), para('캔바 교육용', 2),
], { links: [{ url: 'https://www.canva.com/education', label: '캔바 교육용' }], notes: '교육용 계정 인증이 안 된 분은 무료 계정으로 진행. 유료 요소(왕관 표시)는 쓰지 않도록 안내.' });
const prompts12 = slide(12, '활동지 프롬프트 모음', [
  '프롬프트 1: 위 활동지에 들어갈 낱말 풀이 5개를 초등학생 말투로 써 줘.',
  '프롬프트 2: 같은 내용을 더 짧게 바꿔 줘.',
  '프롬프트 3: 활동지 마지막에 넣을 스스로 점검 문항 3개를 ○× 형식으로 만들어 줘.',
]);
const practice14 = slide(14, '실습 3. 노트북LM으로 평가 문항 만들기', [
  '① notebooklm.google.com에서 새 노트북을 만듭니다.', '② 지도서 PDF를 소스로 올립니다.', '③ 오른쪽 프롬프트를 입력해 서술형 문항 2개를 만듭니다.',
  para('역할: 너는 초등 과학 평가 전문가야.', 2), para('조건: 올린 지도서 범위 안에서만 출제해 줘.', 2), para('형식: 서술형 2문항, 채점 기준을 표로 써 줘.', 2), para('NotebookLM', 2),
], { links: [{ url: 'https://notebooklm.google.com/', label: 'NotebookLM' }] });
const lesson = () => deck([
  cover,
  slide(2, '강사 소개', ['서나래', '새솔초등학교 교사', '현) 다울 AI 수업 연구회 운영', '전) 디지털 선도학교 업무 담당', 'narae@example.com']),
  slide(3, '연수 목표', [{ text: '수업 목표에 맞는 프롬프트를 4요소로 쓸 수 있다.', bullet: true }, { text: '생성 결과를 검토 기준 3가지로 고칠 수 있다.', bullet: true }, { text: '대상: 생성형 AI를 처음 써 보는 초등 교사', bullet: true }]),
  slide(4, '오늘의 순서', [], { layout: 'title-only', tables: [{ rows: [['시간', '내용', '방식'], ['14:00~14:20', '열기: 프롬프트 4요소', '강의'], ['14:20~15:00', '실습 1. 학습 목표 다듬기', '개별 실습'], ['15:00~15:10', '쉬는 시간', ''], ['15:10~15:50', '실습 2. 활동지 만들기', '개별 실습'], ['15:50~16:30', '실습 3. 평가 문항 만들기', '짝 실습']] }] }),
  slide(5, 'PART 1. 프롬프트', [], { layout: 'section' }),
  practice8,
  slide(10, 'PART 2. 활동지', [], { layout: 'section' }),
  practice11, prompts12,
  slide(13, 'PART 3. 평가', [], { layout: 'section' }),
  practice14,
  slide(20, '강사 메모(숨김)', ['이 쪽은 발표 때 건너뜁니다.'], { hidden: true }),
  slide(21, '마무리', ['핵심: AI는 초안을 쓰고, 판단은 교사가 합니다.', '문의: 다울교육지원청 교육지원과 02-000-0000']),
]);
const draftOf = (m, info = {}) => materialToDraft(m, { today: '2026-11-01', ...info });
const sec = (d, type) => d.sections.find((s) => s.type === type);

describe('교재 그대로: 초안', () => {
  const d = draftOf(lesson());

  test('1. 목표는 교재 문장 그대로(말끝 "~할 수 있다."를 바꾸지 않음)', () => {
    assert.deepEqual(sec(d, 'goals').items, ['수업 목표에 맞는 프롬프트를 4요소로 쓸 수 있다.', '생성 결과를 검토 기준 3가지로 고칠 수 있다.']);
    assert.equal(sec(d, 'goals').who, '생성형 AI를 처음 써 보는 초등 교사');
  });

  test('2. 일정표의 내용·방식 칸을 한 줄로 합치지 않음', () => {
    const items = sec(d, 'schedule').items;
    assert.deepEqual(items.map((i) => [i.start, i.title, i.part]), [
      ['14:00', '열기: 프롬프트 4요소', '강의'], ['14:20', '실습 1. 학습 목표 다듬기', '개별 실습'], ['15:00', '쉬는 시간', ''],
      ['15:10', '실습 2. 활동지 만들기', '개별 실습'], ['15:50', '실습 3. 평가 문항 만들기', '짝 실습'],
    ]);
    assert.ok(!items.some((i) => /시간\s*내용\s*방식/.test(i.title)), '머리글 줄은 일정이 아님');
  });

  test('2. 담당 칸은 설명(desc)으로, 머리글이 없는 표도 칸을 합치지 않음', () => {
    const agenda = (rows) => detect(deck([cover, slide(2, '진행 순서', [], { tables: [{ rows }] })])).agenda.items;
    const a = agenda([['시간', '프로그램', '담당'], ['09:30~10:00', '개회 및 인사', '교육지원과장'], ['10:00~11:00', '기조 강연', '홍길동 교수']]);
    assert.deepEqual(a.map((i) => [i.text, i.desc]), [['개회 및 인사', '교육지원과장'], ['기조 강연', '홍길동 교수']]);
    const b = agenda([['14:00~14:30', '도입', '강의'], ['14:30~15:30', '모둠 활동', '모둠']]);
    assert.deepEqual(b.map((i) => [i.text, i.desc]), [['도입', '강의'], ['모둠 활동', '모둠']]);
  });

  test('3. 프롬프트 상자 안의 링크 글자("제미나이 열기", "NotebookLM")는 프롬프트가 아님', () => {
    const st = sec(d, 'stations').items;
    assert.equal(st[0].prompts[0].text, "너는 초등학교 5학년 과학 교사야. '태양계와 별' 단원의 학습 목표를 3개 써 줘.");
    const nb = st.find((x) => x.title.startsWith('실습 3'));
    assert.equal(nb.prompts[0].text, '역할: 너는 초등 과학 평가 전문가야.\n조건: 올린 지도서 범위 안에서만 출제해 줘.\n형식: 서술형 2문항, 채점 기준을 표로 써 줘.');
    assert.ok(!JSON.stringify(sec(d, 'prompts')).match(/제미나이 열기|\\nNotebookLM/));
  });

  test('4. 프롬프트는 교재의 읽는 순서대로(이름표 1·2·3, 따로 선 프롬프트가 단계 속 따옴표보다 먼저)', () => {
    const texts = sec(d, 'prompts').items.map((x) => x.text);
    const at = (s) => texts.findIndex((t) => t.startsWith(s));
    assert.ok(at('위 활동지') < at('같은 내용') && at('같은 내용') < at('활동지 마지막'), texts.join(' / '));
    assert.ok(at('너는 초등학교') < at('5학년이 아는 말로'), '이름표 프롬프트가 먼저');
    // 단계 없는 프롬프트 쪽은 앞 실습(실습 2)에 딸림: 교재의 실습 번호대로 실습 3개
    const st = sec(d, 'stations').items;
    assert.deepEqual(st.map((x) => x.title), ['실습 1. 제미나이로 학습 목표 다듬기', '실습 2. 캔바로 활동지 만들기', '실습 3. 노트북LM으로 평가 문항 만들기']);
    assert.deepEqual(st[1].prompts.map((p) => p.title), ['프롬프트', '활동지 프롬프트 모음 · 프롬프트 1', '활동지 프롬프트 모음 · 프롬프트 2', '활동지 프롬프트 모음 · 프롬프트 3']);
  });

  test('5. 강사 소속은 교재의 소속 줄 그대로, 약력 묶음도 현·전', () => {
    const p = d.instructors[0];
    assert.equal([p.org, p.role].filter(Boolean).join(' '), '새솔초등학교 교사');
    assert.deepEqual(p.timeline.map((t) => [t.group, t.items[0].text]), [['현', '다울 AI 수업 연구회 운영'], ['전', '디지털 선도학교 업무 담당']]);
  });

  test('7. 교재에 없는 글을 지어 넣지 않음(인사말·서명·계정 설명·이용 규칙)', () => {
    const json = JSON.stringify(d.sections);
    for (const s of ['함께해 주셔서 고맙습니다', '드림', '로그인 없이', '연수 목적으로만', '학습용으로만']) assert.ok(!json.includes(s), s);
    const c = sec(d, 'closing');
    assert.deepEqual([c.lead, c.text, c.thanks], ['핵심', 'AI는 초안을 쓰고, 판단은 교사가 합니다.', '']);
    // 도구 설명은 그 도구를 쓰는 교재의 실습 제목(계정·로그인 여부는 도구 목록 지식이라 싣지 않음)
    const tools = sec(d, 'tools').items;
    assert.deepEqual(tools.map((t) => t.name), ['Gemini', 'Canva', 'NotebookLM'], '교재에 나오는 차례');
    assert.equal(tools[0].desc, '실습 1. 제미나이로 학습 목표 다듬기');
    assert.ok(!tools.some((t) => /계정/.test(t.desc)));
    assert.equal(sec(d, 'deck').notice, undefined);
  });

  test('7. 마무리 문장이 없으면 인사말 대신 비워 둠(화면에는 연수 제목·날짜·주최)', () => {
    const m = lesson(); m.pages = m.pages.filter((p) => p.page !== 21);
    const c = sec(draftOf(m), 'closing');
    assert.deepEqual([c.lead, c.text, c.thanks], ['', '', '']);
    const html = E.build(validate(draftOf(m)).blueprint, { runtime: nodeRuntime() }).files['index.html'];
    assert.match(html, /<p class="lp-closing-text"[^>]*>생성형 AI로 수업 자료 만들기<\/p>/);
  });

  test('7. 준비물: 교재가 말한 계정만(설명은 교재 문장), 도구 목록에서만 아는 계정은 할 일로', () => {
    const r = sec(d, 'readiness');
    assert.deepEqual(r.items.map((i) => [i.label, i.detail]), [['Google 계정', 'gemini.google.com에 접속해 Google 계정으로 로그인합니다.']]);
    assert.ok(!r.items.some((i) => /브라우저/.test(i.label)), '교재에 없는 브라우저 안내는 싣지 않음');
    assert.ok(d._draft.todo.some((t) => t.includes('준비물에 넣을지') && t.includes('브라우저')));
  });

  test('9. 강사 말투 발표자 노트는 참가자 메모에 싣지 않고 강사용 운영안내로', () => {
    const st = sec(d, 'stations').items;
    assert.equal(st[0].note, '로그인 화면이 반복되면 시크릿 창을 닫고 일반 창에서 다시 엽니다.\n10분이 지나면 다음 단계로 넘어갑니다.');
    assert.equal(st[1].note, '');
    assert.equal(st[1].teacherNote, '교육용 계정 인증이 안 된 분은 무료 계정으로 진행.\n유료 요소(왕관 표시)는 쓰지 않도록 안내.');
    assert.ok(d._draft.todo.some((t) => t.includes('강사 메모 2건')));
    const { blueprint } = validate(d);
    assert.equal(blueprint.sections.find((s) => s.type === 'stations').items[1].teacherNote, st[1].teacherNote, '검증기가 지우지 않음');
    const r = E.build(blueprint, { runtime: nodeRuntime() });
    for (const [f, body] of Object.entries(r.files)) if (typeof body === 'string') assert.ok(!body.includes('왕관 표시'), `${f}에 강사 메모가 보임`);
    assert.match(r.teacher['운영안내.md'], /## 실습별 강사 메모[\s\S]*실습 2\. 캔바로 활동지 만들기[\s\S]*쓰지 않도록 안내\./);
  });
});

describe('교재 그대로: 조각 함수', () => {
  test('splitNotes: 해결 요령과 강사 메모 나누기', () => {
    assert.deepEqual(splitNotes('영상은 3분 이내로 고르도록 안내합니다.\n학교 계정 로그인이 안 되면 개인 계정을 써도 됩니다.'), { tips: ['학교 계정 로그인이 안 되면 개인 계정을 써도 됩니다.'], memos: ['영상은 3분 이내로 고르도록 안내합니다.'] });
    assert.deepEqual(splitNotes('역할→대상→과제→형식 순서로 설명. 예시는 다음 장에서.').tips, []);
    assert.deepEqual(splitNotes('개인정보를 넣지 않도록 주의합니다.').tips, ['개인정보를 넣지 않도록 주의합니다.'], '참가자에게 하는 주의는 해결 요령');
    assert.deepEqual(splitNotes('주의: 10분이 지나면 다음 단계로 넘어갑니다.').tips, ['10분이 지나면 다음 단계로 넘어갑니다.'], '"10분이"는 사람을 가리키는 "분이"가 아님');
  });

  test('6. 숨긴 쪽을 그리지 않은 변환이면 숨긴 쪽을 건너뛰고 그림을 맞춤', () => {
    const pages = Array.from({ length: 21 }, (_, i) => ({ page: i + 1, hidden: i + 1 === 20 }));
    assert.deepEqual(pagesForImages(pages, 20).map((p) => p.page).slice(-2), [19, 21], '그림 20장 = 보이는 쪽 20개');
    assert.equal(pagesForImages(pages, 21).length, 21, '숨긴 쪽도 그렸으면 모든 쪽');
    assert.equal(pagesForImages(pages, 21, true).length, 20, '짝 PDF가 숨긴 쪽을 뺐으면 보이는 쪽만');
  });

  test('가볍게: 런타임 CSS에서 이 사이트가 쓰지 않는 규칙만 뺌', () => {
    const css = '/*@v:goals.x*/.lp-a{color:red}.lp-b{color:blue}.lp-a:not(.lp-zz){x:1}[data-preset="p1"] .lp-a{x:2}[data-preset="p2"] .lp-a{x:3}'
      + '.lp-rip-g3{x:4}@media (min-width:9px){.lp-b{x:5}.lp-a{x:6}}@keyframes used{to{x:1}}@keyframes gone{to{x:1}}.lp-a{animation:used 1s}[data-theme="dark"] .lp-a{x:7}';
    const used = '<html data-preset="p1"><p class="lp-a">…</p><script>el.className = \'lp-rip-g\' + n;</script>';
    const out = pruneUnusedCss(css, used);
    for (const keep of ['/*@v:goals.x*/', '.lp-a{color:red}', '.lp-a:not(.lp-zz)', '[data-preset="p1"] .lp-a', '.lp-rip-g3', '@media (min-width:9px){.lp-a{x:6}}', '@keyframes used', '[data-theme="dark"] .lp-a']) assert.ok(out.includes(keep), keep);
    for (const drop of ['.lp-b', '[data-preset="p2"]', '@keyframes gone']) assert.ok(!out.includes(drop), drop);
    // 실제 빌드: 쓰는 규칙은 남고 크기는 절반 아래로
    const r = E.build(validate(draftOf(lesson())).blueprint, { runtime: nodeRuntime() });
    const full = E.build(validate(draftOf(lesson())).blueprint, { runtime: nodeRuntime(), keepAllCss: true }).files['assets/lecpage.css'];
    const small = r.files['assets/lecpage.css'];
    assert.ok(small.length < full.length * 0.5, `${small.length} / ${full.length}`);
    for (const cls of ['lp-st', 'lp-note', 'lp-schedule', 'lp-btn']) assert.ok(small.includes(`.${cls}{`) || small.includes(`.${cls} `) || small.includes(`.${cls},`), cls);
  });

  test('가볍게: 프리셋 기본 글꼴로 나눠 받기 없는 큰 글꼴(G마켓 산스 600KB·나눔바른고딕 1.6MB)을 쓰지 않음(교재가 그 글꼴일 때만)', () => {
    assert.ok(E.PRESETS.length > 10);
    for (const p of E.PRESETS) for (const f of [p.fonts, ...(p.fontAlts || [])]) for (const k of ['display', 'body']) assert.ok(!['gmarket', 'nanumBarun'].includes(f?.[k]), `${p.id} ${k} ${f?.[k]}`);
  });

  test('8. 고정 안내 문구: 설문 안내는 강사가 적었을 때만, 접속 확인은 중립적인 다음 할 일', () => {
    const bp = validate({ meta: { title: 't', date: '2026-12-03' }, sections: [{ type: 'hero' }, { type: 'readiness', items: [{ label: '크롬' }], checks: [{ name: 'Gemini', url: 'https://gemini.google.com' }] }, { type: 'survey', url: 'https://forms.gle/abc', qr: true }] }).blueprint;
    const html = E.build(bp, { runtime: nodeRuntime() }).files['index.html'];
    assert.ok(!html.includes('다음 연수를 준비하는 데'), '설문을 어디에 쓰는지 지어 말하지 않음');
    assert.ok(!html.includes('정보 담당 선생님'));
    assert.ok(html.includes('막힌 곳이 있으면 강사에게 알려 주세요.'));
  });
});
