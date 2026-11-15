// 여정 점검(2026-11-14)에서 나온 교재 읽기·연수 정보·사이트 문구 결함의 회귀 시험.
// 3시간 한 번 연수 교재의 '과제 마감'·'다음 연수' 날짜, 학부모 설명회의 해 없는 마감일, 'N월 N주', 한 줄에 붙은 날짜와 장소,
// PDF 글 조각 틈('AI 로'), 대상에 맞는 낱말, 앱 길과 skill 길의 같은 감지, 설문 하나, 원격·1박 2일 안내문.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../src/index.js';
import { nodeRuntime } from '../node.js';
import { ingestText, materialToDraft, detectedInfo } from '../src/ingest/index.js';
import { detect } from '../src/ingest/detect.js';
import { tidyPdfLine } from '../src/ingest/pdf.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TODAY = '2026-11-14';
const build = (bp, o = {}) => E.build(bp, { runtime: nodeRuntime(), today: TODAY, ...o });
const data = (html) => JSON.parse(/<script type="application\/json" id="lp-data">([\s\S]*?)<\/script>/.exec(html)[1]);
const md = (lines) => ingestText(lines.join('\n'), { markdown: true, today: TODAY });
const site = (bp) => { const b = E.applyInfo(bp, {}, null, null); return build(b); };

// 여정 교재(지어낸 것)를 글로: 3시간 한 번 연수인데 과제 마감·다음 연수 날짜가 들어 있음
const JOURNEY = [
  '# 생성형 AI로 수업 자료 만들기', '2026 겨울 교원 직무연수', '2026. 11. 20.(금) 14:00~17:00 새봄중학교 3층 컴퓨터실', '강사: 한지우 (새봄중학교 정보부장)', '',
  '## 오늘의 흐름', '- 14:00~14:20 여는 이야기', '- 14:20~15:10 실습 1: 수업 지도안 초안 만들기', '- 15:10~15:20 쉬는 시간', '- 15:20~16:50 실습 2: 활동지 만들기', '- 16:50~17:00 나눔과 마무리', '',
  '## 실습 1-1 단계', '1. 쓰던 AI 도구를 엽니다.', '2. 아래 요청 글을 복사해 붙여 넣습니다.', '3. 학년·과목·단원을 내 수업으로 바꿉니다.', '',
  '## 실습 1-2 검토하기', '1. 성취기준과 맞는지 확인합니다.', '2. 시간 배분이 현실적인지 봅니다.', '',
  '## 과제(선택)', '결과물을 11월 27일(금)까지 패들렛에 올리기', '',
  '## 만족도 설문', '연수 이수 처리를 위해 꼭 내 주세요 https://forms.gle/example-survey', '',
  '## 실습 2 나눔', '모둠별로 가장 잘 나온 문항 하나 고르기', '구글 설문에 올리기 https://forms.gle/example-saebom', '',
  '## 고맙습니다', '다음 연수: 12월 11일(금) AI로 생활기록부 문장 다듬기',
];

describe('H1 차시 날짜: 일정 문맥의 날짜만', () => {
  test('3시간 한 번 연수: 과제 마감·다음 연수 날짜는 차시가 아님 → 하루짜리, 과정형 아님, 표지·QR 안내문·달력이 같은 하루', () => {
    const m = md(JOURNEY);
    assert.equal(m.detected.event.date, '2026-11-20');
    assert.equal(m.detected.event.dates, undefined, JSON.stringify(m.detected.event));
    const d = materialToDraft(m, { today: TODAY });
    assert.deepEqual(d.meta.sessions, []);
    assert.notEqual(d.structure.flow, 'course');
    const r = build(E.applyInfo(d, {}, m, null));
    const hero = r.files['index.html'].match(/<dt>일시<\/dt><dd>([^<]*)<\/dd>/)?.[1];
    assert.equal(hero, '2026. 11. 20.(금) 14:00~17:00');
    assert.ok(r.files['poster.html'].includes('<dd>2026. 11. 20.(금) 14:00~17:00</dd>'), '안내문도 같은 날짜');
    assert.equal((r.files['assets/event.ics'].match(/BEGIN:VEVENT/g) || []).length, 1);
    assert.deepEqual(data(r.files['index.html']).phase, { start: '2026-11-20T14:00', end: '2026-11-20T17:00' });
  });
  test('실습 1 한 칸(50분)이 실습 쪽 여럿에 걸치면 쪽마다 50분을 적지 않음(합이 연수 시간보다 길어지지 않게)', () => {
    const d = materialToDraft(md(JOURNEY), { today: TODAY });
    const st = d.sections.find((s) => s.type === 'stations').items;
    const total = st.reduce((a, x) => a + x.minutes, 0);
    assert.ok(total <= 180, `실습 시간 합 ${total}분`);
    assert.ok(st.filter((x) => /^실습 1/.test(x.title)).every((x) => !x.minutes), JSON.stringify(st.map((x) => [x.title, x.minutes])));
  });
  test('여러 날 과정(일차 표시·날짜+시각)은 그대로 여러 날', () => {
    const m = md(['# 신규 교사 연수', '## 일정', '- 1일차 2027. 1. 11.(월) 09:30~12:30 학급 세우기', '- 2일차 2027. 1. 12.(화) 09:30~12:30 학부모와 만나기', '- 3일차 2027. 1. 13.(수) 09:30~12:30 수업 설계', '', '## 과제', '- 제출 기한: 2027. 1. 20.(수)']);
    assert.deepEqual(m.detected.event.dates, ['2027-01-11', '2027-01-12', '2027-01-13'], '제출 기한은 빠짐');
  });
  test('학부모 설명회: 해 없는 "2월 25일까지"는 다음 해 행사의 마감일 → 날짜 범위가 생기지 않음', () => {
    const m = md(['# 2027학년도 새봄중학교 신입생 학부모 설명회', '일시: 2027. 2. 20.(토) 10:00~11:30', '장소: 새봄중학교 강당', '', '## 준비물 안내', '- 교복 맞춤: 2월 25일까지 지정 업체 방문']);
    assert.equal(m.detected.event.date, '2027-02-20');
    assert.equal(m.detected.event.dates, undefined);
    const d = materialToDraft(m, { today: TODAY });
    const hero = build(E.applyInfo(d, {}, m, null)).files['index.html'];
    assert.ok(!/2026\. 2\. 25/.test(hero) && !/~2027/.test(hero), '1년 앞선 날짜·범위 없음');
  });
  test('"2027년 3월 2주"(그달 둘째 주)·"9월 1주"는 날짜가 아님', () => {
    assert.equal(detect(md(['# 설명회', '일시: 2026년 12월 10일(목) 19:00~20:30', '- 2027년 3월 2주: 진로 검사', '- 2027년 9월 1주: 수강 신청 확정']), { today: TODAY }).event.dates, undefined);
    assert.equal(md(['# t', '2027년 3월 2주: 진로 검사']).detected.event.date, '');
  });
  test('날짜를 바꿔 다시 만들면(2기) 첫 화면·안내문이 새 날짜를 따름 — 예전 차시 날짜는 남지 않음', () => {
    const bp = E.validate({ meta: { title: 't', date: '2026-11-20', start: '14:00', end: '17:00', sessions: [{ date: '2026-11-20' }, { date: '2026-11-27' }, { date: '2026-12-11' }] }, sections: [{ type: 'hero', meta: [{ label: '일시', value: '2026. 11. 20.(금)~12. 11.(금) 14:00~17:00' }] }] }).blueprint;
    const next = E.syncInfo(bp, { date: '2027-01-15' }, ['date']);
    assert.deepEqual(next.meta.sessions, []);
    const r = build(next);
    assert.ok(r.files['index.html'].includes('2027. 1. 15.(금) 14:00~17:00') && !r.files['index.html'].includes('12. 11.'), '첫 화면');
    assert.ok(r.files['poster.html'].includes('2027. 1. 15.(금)'));
    // 강사가 준 여러 날(info.dates·sessions)은 그대로 여러 날
    const two = E.syncInfo(bp, { sessions: [{ date: '2027-01-15', start: '14:00', end: '17:00' }, { date: '2027-01-16', start: '09:00', end: '12:00' }] }, ['sessions']);
    assert.equal(two.meta.date, '2027-01-15');
    assert.equal(E.whenText(two.meta), '2027. 1. 15.(금) 14:00~17:00 · 1. 16.(토) 09:00~12:00');
  });
});

describe('앱 작업자가 넘긴 것: 날짜·보관 끝·사진·강사 화면 글', () => {
  test('강사가 준 날짜(info.date)가 교재에서 찾은 차시 날짜에 없으면 그 날짜들로 덮지 않음, patch로 첫날만 바꿔도 차시를 맞춤', () => {
    const course = md(['# 연수', '## 일정', '- 1차시 2027. 1. 11.(월) 09:30~12:30', '- 2차시 2027. 1. 18.(월) 09:30~12:30']);
    const d = materialToDraft(course, { today: TODAY, date: '2027-03-02' });
    assert.equal(d.meta.date, '2027-03-02');
    assert.deepEqual(d.meta.sessions, []);
    assert.equal(materialToDraft(course, { today: TODAY, date: '2027-01-11' }).meta.sessions.length, 2, '교재 날짜에 든 날이면 그대로 과정');
    const bp = { meta: { title: 't', date: '2027-01-11', sessions: [{ no: 1, date: '2027-01-11' }, { no: 2, date: '2027-01-18' }] }, sections: [{ type: 'hero' }] };
    assert.deepEqual(E.applyBlueprintPatch(bp, { meta: { date: '2027-03-02' } }).raw.meta.sessions, []);
    assert.equal(E.applyBlueprintPatch(bp, { meta: { date: '2027-01-18' } }).raw.meta.sessions.length, 2, '차시 날짜 가운데 하나로 바꾸면 그대로');
  });
  test('사이트 보관 끝 예정일(meta.keepUntil): 검증이 받고 강사 화면이 한 줄로(연수 날보다 이르면 다시 배포 안내)', () => {
    const r = build({ meta: { title: 't', date: '2027-01-20', keepUntil: '2027-01-14' }, live: { provider: 'local', features: ['qa'] }, sections: [{ type: 'hero' }, { type: 'qa' }] });
    assert.equal(data(r.files['index.html']).keepUntil, '2027-01-14');
    assert.ok(r.files['assets/console.js'].includes("'사이트는 ' + (+ku[2]) + '월 '") && r.files['assets/console.js'].includes('연수 날보다 먼저 닫혀요'));
    assert.equal(E.validate({ meta: { title: 't', keepUntil: '내일' } }).blueprint.meta.keepUntil, undefined, '날짜가 아니면 버림');
  });
  test('사진 파일은 "형식을 바꿔 올려" 대신 자료실 안내, 강사 화면 스크립트 문자열에 </body>가 그대로 없음', async () => {
    const { ingestFile } = await import('../src/ingest/index.js');
    const m = await ingestFile('칠판.jpg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]), {});
    assert.equal(m.errors[0]?.code, 'image-file');
    assert.match(m.errors[0].message_ko, /자료실/);
    const r = build({ meta: { title: 't' }, live: { provider: 'local', features: ['qa'] }, sections: [{ type: 'hero' }, { type: 'qa' }] });
    assert.ok(!r.files['assets/console.js'].includes('</body>'));
  });
});

describe('L4 원격·1박 2일', () => {
  test('1박 2일 날마다 다른 시각: 첫 화면·안내문·달력(두 건)이 같은 날짜, 그날 시간에만 출석', () => {
    const d = materialToDraft(md(JOURNEY), { today: TODAY, sessions: [{ date: '2026-11-20', start: '14:00', end: '17:00' }, { date: '2026-11-21', start: '09:00', end: '12:00' }] });
    const r = build(E.applyInfo(d, {}, null, null));
    const when = '2026. 11. 20.(금) 14:00~17:00 · 11. 21.(토) 09:00~12:00';
    assert.ok(r.files['index.html'].includes(when) && r.files['poster.html'].includes(when));
    assert.equal((r.files['assets/event.ics'].match(/BEGIN:VEVENT/g) || []).length, 2);
    assert.deepEqual(data(r.files['index.html']).phase.days, [{ start: '2026-11-20T14:00', end: '2026-11-20T17:00' }, { start: '2026-11-21T09:00', end: '2026-11-21T12:00' }]);
  });
  test('원격(온라인만) 연수 QR 안내문: Wi-Fi 칸 없이 회의 입장 주소, "카메라로 QR" 대신 주소 먼저', () => {
    const on = build({ meta: { title: 't', date: '2026-12-01', mode: 'online', joinUrl: 'https://zoom.us/j/1234567890' }, sections: [{ type: 'hero' }] }).files['poster.html'];
    assert.ok(!on.includes('lp-pst-wifi') && on.includes('Zoom 입장') && on.includes('zoom.us/j/1234567890'));
    assert.ok(!on.includes('휴대폰 카메라로 QR을 찍어 들어오세요'));
    const off = build({ meta: { title: 't', date: '2026-12-01' }, sections: [{ type: 'hero' }] }).files['poster.html'];
    assert.ok(off.includes('lp-pst-wifi') && off.includes('휴대폰 카메라로 QR을 찍어 들어오세요'));
  });
});

describe('M2 장소·연수명', () => {
  test('날짜·시각과 한 줄에 붙은 장소, 둘째 교재 첫 쪽의 "장소:"를 찾음', () => {
    const m = { files: [{ id: 'deck1', name: 'a.pdf', type: 'pdf' }], pages: [{ file: 'deck1', page: 1, title: '생성형 AI 로 수업 자료 만들기', paragraphs: [{ text: '2026. 11. 20.(금) 14:00~17:00 새봄중학교 3층 컴퓨터실' }] }, { file: 'deck1', page: 2, title: '목표', paragraphs: [{ text: '요청 글을 쓸 수 있다' }] }] };
    assert.equal(detect(m, { today: TODAY }).event.venue, '새봄중학교 3층 컴퓨터실');
    const two = { files: [{ id: 'deck1', name: 'a.pdf', type: 'pdf' }, { id: 'doc1', name: 'b.hwpx', type: 'hwpx' }], pages: [
      ...Array.from({ length: 8 }, (_, i) => ({ file: 'deck1', page: i + 1, title: i ? `쪽 ${i + 1}` : '생성형 AI 로 수업 자료 만들기', paragraphs: [{ text: i ? '내용' : '2026. 11. 20.(금) 14:00~17:00' }] })),
      { file: 'doc1', page: 1, title: '운영 계획', paragraphs: [{ text: '연수명: 생성형 AI로 수업 자료 만들기' }, { text: '장소: 새봄중학교 3층 컴퓨터실' }] }, { file: 'doc1', page: 2, title: '문의', paragraphs: [{ text: '정보부' }] }] };
    const d = detect(two, { today: TODAY });
    assert.equal(d.event.venue, '새봄중학교 3층 컴퓨터실');
    assert.equal(d.title, '생성형 AI로 수업 자료 만들기', '"연수명:" 이름표가 띄어쓰기만 다르면 그 값');
  });
  test('PDF 글 조각 틈: 영문 뒤 조사·숫자 뒤 단위·요일 괄호(pdf.js 길과 파이썬 길이 같음)', () => {
    const cases = [['생성형 AI 로 수업 자료 만들기', '생성형 AI로 수업 자료 만들기'], ['결과물을 11 월 27일 (금) 까지', '결과물을 11월 27일(금) 까지'], ['수업 지도안 1 부', '수업 지도안 1부'], ['AI 로봇 만들기', 'AI 로봇 만들기'], ['PPT 를 열고', 'PPT를 열고']];
    for (const [a, b] of cases) assert.equal(tidyPdfLine(a), b, a);
    const py = spawnSync('python3', ['-I', '-c', `import importlib.util,json,sys\nspec=importlib.util.spec_from_file_location('i', ${JSON.stringify(join(HERE, '../../scripts/ingest.py'))}); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)\nprint(json.dumps([m.tidy(x) for x in json.loads(sys.argv[1])], ensure_ascii=False))`, JSON.stringify(cases.map((c) => c[0]))], { encoding: 'utf8' });
    if (py.status === 0) assert.deepEqual(JSON.parse(py.stdout), cases.map((c) => c[1]), '파이썬 보조 길도 같은 결과');
  });
});

describe('skill H3: 교재에 없는 사실을 넣지 않음', () => {
  const C = ['# 2027학년도 고교학점제 운영 안내 설명회', '가람고등학교 교육과정부', '일시: 2026년 12월 10일(목) 19:00~20:30', '장소: 가람고등학교 시청각실', '대상: 2027학년도 신입생 학부모', '',
    '## 1. 고교학점제란', '학생이 진로에 따라 과목을 고르고, 이수 기준을 채운 과목의 학점을 모아 졸업하는 제도입니다.', '',
    '## 3. 수강 신청 일정', '- 2027년 3월 2주: 진로 검사와 상담', '- 2027년 5월 4주: 과목 설명회', '- 2027년 6월 2주: 1차 수강 신청', '- 2027년 9월 1주: 수강 신청 확정', '',
    '## 4. 자주 묻는 질문', 'Q. 우리 학교에 없는 과목은 어떻게 듣나요?', 'A. 온라인학교와 공동교육과정으로 들을 수 있고, 학점으로 인정됩니다.'];
  test('정책 설명회: 직무연수·출석 90%·온라인·여러 날·과정형이 아님', () => {
    const m = md(C);
    const d = materialToDraft(m, { today: TODAY });
    assert.equal(m.detected.kind, 'conference');
    assert.equal(d.meta.admin.kind, 'conference');
    assert.equal(d.meta.admin.completionRate, 0);
    assert.equal(d.meta.mode, 'offline', '본문의 "온라인학교"로 혼합 수업이 되지 않음');
    assert.equal(m.detected.event.dates, undefined);
    assert.notEqual(d.structure.flow, 'course');
    const html = build(E.applyInfo(d, {}, m, null)).files['index.html'];
    assert.ok(!/출석 \d+% 이상/.test(html) && !html.includes('· 온라인'), '첫 화면에 지어낸 출석 기준·온라인 없음');
  });
  test('직무연수라도 교재에 출석 %가 없으면 사이트에 %를 쓰지 않고, 강사 화면 이수자 명단은 90%로 세며 그 사실을 적음', () => {
    const r = build({ meta: { title: 't', date: '2026-12-01', start: '14:00', end: '17:00', admin: { kind: 'official', hours: 3 } }, live: { provider: 'local', features: ['attendance'] }, sections: [{ type: 'hero' }, { type: 'attendance' }] });
    assert.ok(!/출석 \d+% 이상/.test(r.files['index.html']));
    const dd = data(r.files['index.html']);
    assert.deepEqual(dd.admin, { completionRate: 90, rateSet: false });
    assert.ok(r.files['assets/console.js'].includes('이수 기준을 정하지 않아 기본값'));
  });
});

describe('M5 대상에 맞는 낱말', () => {
  const kinds = (kind, title) => build({ meta: { title, date: '2026-11-26', admin: { kind } }, live: { provider: 'local', features: ['qa', 'attendance'] }, instructors: [{ name: '김하늘' }],
    sections: [{ type: 'hero' }, { type: 'goals', title: '연수 목표', items: ['순서도 기호를 안다'] }, { type: 'attendance' }, { type: 'followup', nav: '연수 후', items: [{ title: '다시 보기', url: 'https://youtu.be/x' }] }, { type: 'instructor', nav: '강사', title: '강사 소개' }] });
  test('학생 수업: 수업 목표·수업 코드·선생님, 끝나면 "끝난 수업"', () => {
    const r = kinds('student', '중1 정보: 알고리즘으로 생각하기');
    const h = r.files['index.html'];
    for (const s of ['수업 목표', '선생님 소개', '수업 후 안내', '수업 코드', '수업을 시작할 때와 마칠 때', '끝난 수업이라']) assert.ok(h.includes(s), s);
    for (const s of ['연수 목표', '강사 소개', '연수 코드', '연수를 시작할 때']) assert.ok(!h.includes(s), s);
    assert.equal(data(h).words.ended, '끝난 수업');
    assert.ok(r.files['poster.html'].includes('수업 코드') && !r.files['poster.html'].includes('연수 코드'));
    assert.ok(r.files['screen.html'].includes('수업 코드'));
  });
  test('학부모 설명회: 설명회 낱말, 교사 연수는 그대로 "연수"', () => {
    const h = kinds('conference', '신입생 학부모 설명회').files['index.html'];
    for (const s of ['오늘 다룰 내용', '발표자 소개', '설명회 후 안내', '설명회 코드']) assert.ok(h.includes(s), s);
    const t = kinds('official', '직무연수').files['index.html'];
    for (const s of ['연수 목표', '강사 소개', '연수 코드']) assert.ok(t.includes(s), s);
  });
  test('대상 추정: 학생 수업·설명회·학부모 연수', () => {
    assert.equal(md(['# 중1 정보: 알고리즘으로 생각하기 (3차시)', '수업 일시: 2026. 11. 26.(목) 3교시']).detected.kind, 'student');
    assert.equal(md(['# 신입생 학부모 설명회', '일시: 2027. 2. 20.(토) 10:00~11:30']).detected.kind, 'conference');
    assert.equal(md(['# 우리 아이 스마트폰, 함께 정하는 약속', '2026학년도 학부모 연수', '일시: 2026. 11. 28.(토) 10:00~11:30']).detected.kind, 'school');
    assert.equal(md(['# 학생 평가 바로 알기', '2026 교원 연수']).detected.kind, 'school', '교사 연수의 "학생" 낱말로 학생 수업이 되지 않음');
    // 교재의 목표 머리말은 그대로 칸 제목으로
    assert.equal(materialToDraft(md(['# 중1 정보', '## 오늘 배울 것', '- 순서도 기호를 안다', '- 생활 속 문제를 순서도로 나타낸다']), { today: TODAY }).sections.find((s) => s.type === 'goals').title, '오늘 배울 것');
  });
});

describe('M6·M7 앱 길과 skill 길이 같은 감지', () => {
  test('detectedInfo(앱 교재 넣기 빈칸 채우기)와 초안(skill)이 같은 연수 정보', () => {
    const m = md(JOURNEY);
    const i = detectedInfo(m.detected);
    const d = materialToDraft(m, { today: TODAY });
    for (const k of ['title', 'date', 'start', 'end', 'venue']) assert.equal(i[k], d.meta[k], k);
    assert.equal(i.admin, d.meta.admin.kind);
    assert.equal(i.admin, 'official');
    assert.equal(i.completionRate, '');
    assert.equal(i.instructorName, d.instructors[0].name);
    assert.equal(i.instructorOrg, '새봄중학교');
    // 앱이 그 값을 연수 정보로 넘기면 초안도 같은 값(이수 기준 기본 %를 앱이 따로 넣지 않음)
    const app = materialToDraft(m, E.draftInfo({ ...i }));
    assert.equal(app.meta.admin.kind, 'official');
    assert.equal(app.meta.admin.completionRate, 0);
  });
  test('실습 짧은 이름: 초안과 이름을 비운 AI 답이 같은 규칙(번호만 떼면 뜻이 없거나 겹치면 제목 그대로)', () => {
    const d = materialToDraft(md(JOURNEY), { today: TODAY });
    const names = d.sections.find((s) => s.type === 'stations').items.map((x) => x.name);
    assert.ok(names.includes('실습 1-1 단계') && names.includes('검토하기') && !names.includes('1 단계'), names.join());
    const ai = E.validate({ meta: { title: 't' }, sections: [{ type: 'stations', items: [{ title: '실습 2-1 활동지', steps: ['a'] }, { title: '실습 1 나눔', steps: ['a'] }, { title: '실습 2 나눔', steps: ['b'] }] }] }).blueprint;
    assert.deepEqual(ai.sections.find((x) => x.type === 'stations').items.map((x) => x.name), ['활동지', '실습 1 나눔', '실습 2 나눔']);
  });
  test('강사 이름만 고쳐도 교재에서 찾은 소속·직함은 지킴', () => {
    const bp = { meta: { title: 't' }, instructors: [{ name: '한지우', org: '새봄중학교', role: '정보부장' }], sections: [{ type: 'hero' }] };
    const next = E.syncInfo(bp, { instructorName: '한지우 선생님', instructorOrg: '' }, ['instructorName']);
    assert.deepEqual([next.instructors[0].name, next.instructors[0].org, next.instructors[0].role], ['한지우 선생님', '새봄중학교', '정보부장']);
    assert.equal(E.syncInfo(bp, { instructorName: '한지우', instructorOrg: '' }, ['instructorOrg']).instructors[0].org, '', '소속 칸을 비웠다고 알려 주면 비움');
  });
});

describe('M8 설문 하나·M1 출석 안내', () => {
  test('실습 제출용 폼은 설문 후보가 아니고, 만족도 설문 주소가 먼저', () => {
    const s = md(JOURNEY).detected.addresses.survey;
    assert.deepEqual(s.map((x) => x.url), ['https://forms.gle/example-survey']);
    assert.equal(s[0].satisfaction, true);
  });
  test('기관 설문 주소를 주면 사이트 기본 문항을 함께 싣지 않음(설문 하나)', () => {
    const bp = E.applyInfo({ meta: { title: 't' }, sections: [{ type: 'hero' }] }, { features: ['qa'], surveyUrl: 'https://forms.gle/abc' });
    const sv = bp.sections.filter((s) => s.type === 'survey');
    assert.equal(sv.length, 1);
    assert.equal(sv[0].url, 'https://forms.gle/abc');
    assert.equal(sv[0].questions.length, 0);
    const own = E.applyInfo({ meta: { title: 't' }, sections: [{ type: 'hero' }] }, { features: ['qa'] });
    assert.equal(own.sections.find((s) => s.type === 'survey').questions.length, 5, '주소가 없으면 사이트 설문');
  });
  test('직무연수인데 출석이 꺼져 있으면 엔진이 알림(앱 체크리스트·skill 요약), skill은 차시 날짜도 한 번 물음', () => {
    const bp = E.validate({ meta: { title: 't', admin: { kind: 'official' } }, live: { features: [] }, sections: [{ type: 'hero' }] }).blueprint;
    const a = E.setupAdvice(bp);
    assert.deepEqual(a.map((x) => x.code), ['attendance-off', 'rate-unset']);
    assert.deepEqual(a[0].fix.features, ['attendance']);
    assert.deepEqual(E.setupAdvice(E.validate({ meta: { title: 't', admin: { kind: 'official', completionRate: 90 } }, live: { features: ['attendance'] }, sections: [{ type: 'hero' }, { type: 'attendance' }] }).blueprint), []);
    const course = md(['# 연수', '## 일정', '- 1차시 2027. 1. 11.(월) 09:30~12:30', '- 2차시 2027. 1. 18.(월) 09:30~12:30']);
    assert.deepEqual(E.intakeAsks({ material: course, blueprint: bp, info: {} }).map((x) => x.key), ['dates', 'completionRate']);
    assert.match(E.intakeAsks({ material: course, info: {} })[0].ask_ko, /1\. 11\.·1\. 18\./);
    assert.deepEqual(E.intakeAsks({ material: course, info: { dates: ['2027-01-11'] } }), [], '강사가 날짜를 주면 묻지 않음');
  });
});

describe('L5·L7 같은 말', () => {
  test('기록 보관 기준: 강사 화면도 개인정보 안내·참여 동의와 같은 한 문장(마지막 기록 뒤 N일)', () => {
    const r = build({ meta: { title: 't' }, live: { provider: 'http', url: 'https://x.example/live', features: ['qa', 'attendance'] }, privacy: { collect: ['nickname', 'name', 'school'], retentionDays: 30 }, sections: [{ type: 'hero' }, { type: 'qa' }, { type: 'attendance' }] });
    const keep = data(r.files['index.html']).privacy.keep;
    assert.equal(keep, '마지막 기록 뒤 30일');
    assert.ok(r.files['privacy.html'].includes(keep) && r.files['index.html'].includes(keep));
    assert.ok(!r.files['assets/console.js'].includes('연수가 끝나고 '), '강사 화면의 다른 기준 문장 없음');
  });
  test('참여 창 안내는 별명이 쓰이는 곳만(투표·질문은 창 없이), 소속은 직무연수만 꼭', () => {
    const bp = (kind) => ({ meta: { title: 't', admin: { kind } }, live: { provider: 'local', features: ['qa', 'poll', 'board', 'attendance'] }, privacy: { collect: ['nickname', 'name', 'school'] }, sections: [{ type: 'hero' }, { type: 'attendance' }, { type: 'board' }] });
    const school = build(bp('school')).files['index.html'];
    assert.match(school, /data-join-lead>보드 글에 보일 별명을 정해 주세요\. 투표와 질문은 별명 없이 바로 돼요\./);
    assert.match(school, /<span>소속\(학교\) · 선택<\/span><input name="school" maxlength="40" autocomplete/);
    assert.match(build(bp('official')).files['index.html'], /<span>소속\(학교\)<\/span><input name="school" maxlength="40" required/);
  });
  test('첫 화면 줄의 [출석]은 출석을 받는 사이트에만(그리기는 숨긴 채, 연수 시간에 참가자 화면이 보임)', () => {
    const on = build({ meta: { title: 't', date: '2026-11-20', start: '14:00' }, live: { provider: 'local', features: ['attendance'] }, sections: [{ type: 'hero' }, { type: 'attendance' }] }).files['index.html'];
    assert.match(on, /data-hero-state hidden>[\s\S]*?<button class="lp-btn lp-btn-primary lp-btn-sm lp-hero-attend" type="button" data-hero-attend hidden>/);
    const off = build({ meta: { title: 't', date: '2026-11-20', start: '14:00' }, sections: [{ type: 'hero' }] }).files['index.html'];
    assert.ok(!off.includes('data-hero-attend'));
  });
});

describe('skill M1·M3·L2·L4 교재 읽기', () => {
  test('코드 블록(프롬프트) 뒤에 이어지는 번호 단계도 같은 실습 단계로', () => {
    const m = md(['# 실습 1. 보고서 만들기', '1. 엑셀 파일을 엽니다.', '2. 표를 고릅니다.', '3. 아래 프롬프트를 그대로 넣습니다.', '```', '이 표에서 사실과 다른 숫자를 찾아 줘.', '```', '4. 결과에서 사실과 다른 숫자가 없는지 확인합니다.']);
    assert.equal(m.detected.steps[0].items.length, 4);
  });
  test('싣지 못한 것: 표 머리줄·이미 실린 Q. 질문은 세지 않음', () => {
    const m = md(['# 안내', '## 세부 일정', '| 시간 | 내용 | 비고 |', '|---|---|---|', '| 14:00~14:20 | 여는 이야기 | 강의 |', '| 14:20~15:10 | 실습 1 | 개인 |', '', '## 자주 묻는 질문', 'Q. 유료로 써야 하나요?', 'A. 오늘 실습은 무료 범위에서 해요.']);
    const d = materialToDraft(m, { today: TODAY });
    const lo = E.findLeftovers(m, d, { max: 20 });
    assert.ok(!lo.items.some((x) => /시간 \| 내용 \| 비고|^Q\./.test(x.text)), JSON.stringify(lo.items));
  });
  test('실습 설명 자리의 글머리 목록은 첫 줄만이 아니라 목록 전체(이름표 줄과 함께)', () => {
    const d = materialToDraft(md(['# 우리 아이 스마트폰 약속', '## 1. 왜 약속인가', '스스로 정한 규칙을 더 잘 지킵니다.', '## 3. 가족 약속 만들기 실습', '1) 아이와 함께 지금 쓰는 시간을 사흘 동안 적어 봅니다.', '2) 꼭 지키고 싶은 것 한 가지씩을 서로 말합니다.', '3) 시간, 장소, 내용 세 가지로 약속을 적습니다.', '', '약속 예시', '- 저녁 식사 자리에는 가족 모두 스마트폰을 두고 옵니다.', '- 잠자기 한 시간 전에는 거실 충전함에 둡니다.', '- 새 앱은 부모와 함께 살펴본 뒤에 깝니다.', '## 4. 약속이 깨졌을 때', '화내기 전에 까닭을 먼저 묻습니다.']), { today: TODAY });
    const desc = d.sections.find((s) => s.type === 'stations')?.items[0].desc || '';
    assert.ok(desc.includes('잠자기 한 시간 전') && desc.includes('새 앱은'), desc);
  });
  test('문장 한가운데의 주소: 앞 낱말이 링크 이름이 되지 않고, 꺾쇠 줄은 용어가 아님', () => {
    const m = md(['# 자료', '- 참여 기능 서버 주소를 https://collect.example.net/api 로 설정하세요.', '- 패들렛: https://padlet.com/example/ethics', "<script>fetch('https://evil.example/x')</script>: 이것은 용어가 아니다"]);
    const lab = Object.fromEntries(m.detected.links.map((l) => [l.url, l.label]));
    assert.equal(lab['https://collect.example.net/api'], 'collect.example.net');
    assert.equal(lab['https://padlet.com/example/ethics'], '패들렛');
    assert.ok(!m.detected.glossary.some((g) => g.term.includes('<')));
  });
});
