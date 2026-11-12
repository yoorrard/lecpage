// 문서형 교재(한글·워드)와 감지 보강 테스트: 제목 상자(한 칸짜리 표), 각주, 머리표 붙은 이름표, 차시표, 행사 인원, 프롬프트 오탐
// 교재는 테스트 안에서 ZIP으로 조립합니다(지어낸 내용).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from '../vendor/fflate.js';
import { ingestFile, ingestText, materialToDraft, materialToAIContext } from '../src/ingest/index.js';

const TODAY = '2026-11-09';
const NS = 'xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"';
let pid = 0;
const hp = (inner, para = 0) => `<hp:p id="${++pid}" paraPrIDRef="${para}" styleIDRef="0">${inner.startsWith('<') ? inner : `<hp:run charPrIDRef="0"><hp:t>${inner}</hp:t></hp:run>`}</hp:p>`;
const hpTable = (rows) => `<hp:run charPrIDRef="0"><hp:tbl rowCnt="${rows.length}" colCnt="${rows[0].length}">${rows.map((r) => `<hp:tr>${r.map((c) => `<hp:tc><hp:subList>${hp(c)}</hp:subList></hp:tc>`).join('')}</hp:tr>`).join('')}</hp:tbl></hp:run>`;
const hwpx = (body) => zipSync({
  mimetype: strToU8('application/hwp+zip'),
  'Contents/header.xml': strToU8(`<hh:head ${NS}><hh:refList><hh:paraProperties><hh:paraPr id="0"><hh:heading type="NONE" idRef="0" level="0"/></hh:paraPr><hh:paraPr id="1"><hh:heading type="NUMBER" idRef="1" level="0"/></hh:paraPr></hh:paraProperties><hh:styles><hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0"/></hh:styles></hh:refList></hh:head>`),
  'Contents/section0.xml': strToU8(`<hs:sec ${NS}>${body.join('')}</hs:sec>`),
});
const footNote = (text) => `<hp:run charPrIDRef="0"><hp:ctrl><hp:footNote number="1"><hp:subList>${hp(`<hp:run charPrIDRef="0"><hp:ctrl><hp:autoNum num="1" numType="FOOTNOTE"/></hp:ctrl><hp:t> ${text}</hp:t></hp:run>`)}</hp:subList></hp:footNote></hp:ctrl></hp:run>`;
const header = (text) => `<hp:run charPrIDRef="0"><hp:ctrl><hp:header id="1"><hp:subList>${hp(text)}</hp:subList></hp:header></hp:ctrl></hp:run>`;

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const wp = (text, style = '') => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t>${text}</w:t></w:r></w:p>`;
const docx = (body, extra = {}) => zipSync({
  '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
  'word/document.xml': strToU8(`<w:document ${W}><w:body>${body.join('')}</w:body></w:document>`),
  'word/styles.xml': strToU8(`<w:styles ${W}><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>`),
  ...extra,
});

describe('한글 문서(HWPX) 구조', () => {
  const body = [
    hp(header('가온중학교 안전부') + hpTable([['2026학년도 안전사고 대응 연수 자료']])),
    hp('□ 일시: 2026. 12. 10.(목) 15:30~17:00'), hp('□ 장소: 가온중학교 시청각실'), hp('□ 대상: 전 교직원 48명'), hp('□ 강사: 나도담(가온중학교 안전부장)'),
    hp('Ⅰ. 연수 목적'), hp('가. 사고가 났을 때 무엇을 먼저 하는지 같은 순서로 안다.'), hp('나. 보고 기한과 기록 서식을 빠뜨리지 않는다.'),
    hp('Ⅱ. 대응 절차'),
    hp('현장 안전을 확보한다.', 1),
    hp(`<hp:run charPrIDRef="0"><hp:t>중대사고</hp:t></hp:run>${footNote('중대사고: 3주 이상 입원한 경우(가상 기준).')}<hp:run charPrIDRef="0"><hp:t>는 1시간 이내에 보고한다.</hp:t></hp:run>`, 1),
    hp('사고 경위서를 당일 작성한다.', 1),
    hp('Ⅲ. 문의'), hp(hpTable([['주의: 머리를 다친 학생은 반드시 보호자에게 알립니다.\n기록은 당일에 남깁니다.']])), hp('문의: 안전부 내선 300'),
  ];
  let m;
  test('맨 앞 한 칸짜리 표는 문서 제목, 뒤쪽 한 칸짜리 표는 본문 글', async () => {
    m = await ingestFile('safety.hwpx', hwpx(body), { today: TODAY });
    assert.deepEqual(m.errors, []);
    assert.equal(m.pages[0].title, '2026학년도 안전사고 대응 연수 자료');
    assert.equal(m.detected.title, '2026학년도 안전사고 대응 연수 자료');
    assert.equal(m.pages[0].tables.length, 0, '제목 상자는 표로 남지 않음');
    const last = m.pages[m.pages.length - 1];
    assert.ok(last.paragraphs.some((x) => x.text.startsWith('주의: 머리를 다친 학생은')), '강조 상자 글이 문단으로');
    assert.equal(last.tables.length, 0);
  });
  test('각주는 본문 뒤에 "(각주) …"로, 머리말은 읽지 않고, 자동 번호는 이어짐', () => {
    const p = m.pages.find((x) => x.title === 'Ⅱ. 대응 절차');
    const texts = p.paragraphs.map((x) => x.text);
    assert.ok(texts.includes('(각주) 중대사고: 3주 이상 입원한 경우(가상 기준).'));
    assert.ok(texts.includes('중대사고는 1시간 이내에 보고한다.'), '각주 글이 본문 문장에 섞이지 않음');
    assert.deepEqual(p.paragraphs.filter((x) => x.num).map((x) => x.num), [1, 2, 3]);
    assert.ok(!JSON.stringify(m.pages).includes('가온중학교 안전부"'), '머리말(쪽마다 되풀이되는 글)은 본문이 아님');
  });
  test('머리표(□)가 붙은 이름표 줄에서 강사·대상·인원', () => {
    assert.equal(m.detected.instructor?.name, '나도담');
    assert.equal(m.detected.instructor?.org, '가온중학교');
    assert.equal(m.detected.event.size, 48);
    const d = materialToDraft(m, { today: TODAY });
    assert.equal(d.audience.size, 48);
    assert.equal(d.meta.contact, '안전부 내선 300');
    const goals = d.sections.find((s) => s.type === 'goals');
    assert.deepEqual(goals.items, ['사고가 났을 때 무엇을 먼저 하는지 같은 순서로 안다.', '보고 기한과 기록 서식을 빠뜨리지 않는다.'], '"Ⅰ. 연수 목적" 아래 가.·나. 항목');
    assert.equal(goals.who, '전 교직원 48명');
  });
});

describe('워드 문서(DOCX) 구조', () => {
  test('각주·미주를 본문 뒤에, 숫자 제목 문서는 절마다 본문 칸이 됨', async () => {
    const body = [
      wp('교사 마음 돌봄 연수'), wp('일시: 2026년 12월 17일(목) 15:40~17:10'),
      wp('1. 왜 필요한가', 'Heading1'),
      `<w:p><w:r><w:t>가상의 설문에서 68%가 소진을 겪었습니다.</w:t></w:r><w:r><w:footnoteReference w:id="2"/></w:r></w:p>`,
      wp('2. 세 가지 사례', 'Heading1'), wp('6년 차 ㄱ 교사는 금요일에 민원 전화를 받았습니다.'),
      wp('3. 함께 나눌 질문', 'Heading1'), wp('가장 지쳤던 순간은 언제였나요?'),
      wp('4. 읽을거리', 'Heading1'), wp('문의: 연수운영팀 031-000-0000'),
    ];
    const m = await ingestFile('care.docx', docx(body, {
      'word/_rels/document.xml.rels': strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/></Relationships>'),
      'word/footnotes.xml': strToU8(`<w:footnotes ${W}><w:footnote w:type="separator" w:id="0"><w:p><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:id="2"><w:p><w:r><w:footnoteRef/></w:r><w:r><w:t xml:space="preserve"> 2026년 10월 조사, 응답 312명.</w:t></w:r></w:p></w:footnote></w:footnotes>`),
    }), { today: TODAY });
    assert.deepEqual(m.errors, []);
    const p = m.pages.find((x) => x.title === '1. 왜 필요한가');
    assert.deepEqual(p.paragraphs.map((x) => x.text), ['가상의 설문에서 68%가 소진을 겪었습니다.', '(각주) 2026년 10월 조사, 응답 312명.']);
    assert.deepEqual(m.detected.sections.map((s) => [s.label, s.title]), [['1', '왜 필요한가'], ['2', '세 가지 사례'], ['3', '함께 나눌 질문'], ['4', '읽을거리']]);
    const d = materialToDraft(m, { today: TODAY });
    // 문서 교재는 차례 칸을 따로 두지 않고, 본문 칸이 교재의 절 순서를 그대로 따름
    assert.ok(!d.sections.some((s) => s.type === 'outline'));
    assert.deepEqual(d.sections.filter((s) => s.type === 'text').map((s) => s.title), ['왜 필요한가', '세 가지 사례', '함께 나눌 질문', '읽을거리']);
    assert.match(d.sections.find((s) => s.title === '왜 필요한가').md, /68%가 소진을 겪었습니다\.\n\n※ 2026년 10월 조사/);
  });
  test('맨 앞 한 칸짜리 표는 문서 제목', async () => {
    const tbl = '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>신규 교사 연수 계획</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
    const m = await ingestFile('plan.docx', docx([tbl, wp('일시: 2026. 12. 3.(목) 14:00~17:00'), wp('장소: 가온초등학교 컴퓨터실')]), { today: TODAY });
    assert.equal(m.detected.title, '신규 교사 연수 계획');
    assert.equal(m.detected.event.date, '2026-12-03');
  });
});

describe('프롬프트 오탐 줄이기', () => {
  test('목표·안내·용어 풀이 줄은 프롬프트가 아님, 진짜 틀은 그대로', () => {
    const m = ingestText([
      '# 생성형 AI 수업 자료 만들기', '일시: 2026. 12. 3.(목) 14:00~17:00', '',
      '## 연수 목표', '- 수업 목표에 맞는 프롬프트를 4요소로 쓸 수 있다.', '- 생성 결과를 검토 기준 3가지로 고칠 수 있다.', '- 대상: 생성형 AI를 처음 써 보는 초등 교사', '',
      '## 과정 개요', '- 기간: 2027. 1. 11.(월) ~ 1. 15.(금)', '- 장소: 가온교육연수원 201호', '- 대상: 신규 임용 초등교사 40명', '- 이수 기준: 출석 80% 이상', '',
      '## 용어 정리', '프롬프트: AI에게 일을 시키려고 쓰는 글', '환각: AI가 사실이 아닌 내용을 그럴듯하게 지어내는 현상', '토큰: AI가 글을 세는 단위', '',
      '## 실습 1. 평가 문항 만들기', '1. notebooklm.google.com에 접속합니다.', '2. 아래 프롬프트를 입력합니다.', '', '역할: 너는 초등 과학 평가 전문가야.', '조건: 올린 지도서 범위 안에서만 출제해 줘.', '형식: 서술형 2문항을 표로 써 줘.',
    ].join('\n'), { markdown: true, today: TODAY });
    const prompts = m.detected.prompts.map((x) => x.text);
    assert.equal(prompts.length, 1, prompts.join(' / '));
    assert.ok(prompts[0].startsWith('역할: 너는 초등 과학 평가 전문가야.'));
    assert.deepEqual(m.detected.glossary.map((g) => g.term), ['프롬프트', '환각', '토큰']);
    const d = materialToDraft(m, { today: TODAY });
    const goals = d.sections.find((s) => s.type === 'goals');
    assert.equal(goals.items.length, 2, '"대상:" 줄은 목표가 아니라 대상');
    assert.equal(goals.who, '생성형 AI를 처음 써 보는 초등 교사');
    assert.ok(!materialToAIContext(m).includes('[프롬프트] - 수업 목표'), 'AI에 보내는 글에도 목표 줄을 프롬프트로 표시하지 않음');
  });
  test('"활동지 …" 제목에서 "활동"을 번호 머리말로 잘라 내지 않음', () => {
    const m = ingestText(['# AI 연수', '일시: 2026. 12. 3.(목) 14:00~17:00', '', '## 활동지 프롬프트 모음', '프롬프트 1: 낱말 풀이 5개를 초등학생 말투로 써 줘.', '프롬프트 2: 문장을 더 짧게 바꿔 줘.', '', '## 활동 2. 나누기', '1. 패들렛에 접속합니다.', '2. 결과를 올립니다.', '3. 댓글을 남깁니다.', '', '## 마무리', '수고하셨습니다.'].join('\n'), { markdown: true, today: TODAY });
    const names = materialToDraft(m, { today: TODAY }).sections.find((s) => s.type === 'stations').items.map((s) => s.name);
    assert.ok(names.includes('활동지 프롬프트 모음'), names.join(' / '));
    assert.ok(names.includes('나누기'), names.join(' / '));
  });
});

describe('핵심 메시지 후보', () => {
  test('사례 속 인용과 문서 소제목은 첫 화면 메시지로 올리지 않음', () => {
    const m = ingestText(['# 교사 마음 돌봄', '일시: 2026. 12. 17.(목) 15:40~17:10', '',
      '## 세 가지 사례', '6년 차 ㄱ 교사는 금요일 4교시 뒤 30분 동안 민원 전화를 받았습니다.', '“제가 뭘 잘못했는지 계속 찾게 되더라고요.”', '3년 차 ㄴ 교사는 학년 행사를 혼자 맡았습니다.', '',
      '## 함께 나눌 질문', '- 가장 지쳤던 순간은 언제였나요?', '', '## 읽을거리', '- 문의: 연수운영팀 031-000-0000'].join('\n'), { markdown: true, today: TODAY });
    const d = materialToDraft(m, { today: TODAY });
    assert.equal(d.sections.find((s) => s.type === 'message'), undefined);
    assert.ok(m.detected.messages.some((x) => x.text.startsWith('제가 뭘 잘못했는지')), '후보로는 남음(AI·사람이 고를 수 있게)');
  });
  test('"핵심: …" 줄은 그대로 메시지', () => {
    const m = ingestText(['# AI 연수', '일시: 2026. 12. 3.(목) 14:00~17:00', '', '## 왜 필요한가', '수업 준비 시간이 줄어듭니다.', '', '## 살펴볼 것', '검토 기준을 함께 봅니다.', '', '## 마무리', '핵심: AI는 초안을 쓰고, 판단은 교사가 합니다.', '수고하셨습니다.', '고맙습니다.'].join('\n'), { markdown: true, today: TODAY });
    assert.equal(materialToDraft(m, { today: TODAY }).sections.find((s) => s.type === 'message')?.text, 'AI는 초안을 쓰고, 판단은 교사가 합니다.');
  });
});

describe('행사·과정 신호', () => {
  test('설명회 + 참석 인원 → 행사형, 인원은 설계도에', () => {
    const m = ingestText(['# 2027 개정 교육과정 현장 설명회', '일시: 2026. 12. 22.(화) 14:00~16:30', '장소: 가온교육문화회관 대강당', '참석: 관내 초·중학교 교원 300명(온라인 동시 중계)', '', '## 핵심 변화', '- 학교 자율시간 연간 최대 68시간', '', '## 적용 일정', '- 2027년 초 1·2학년'].join('\n'), { markdown: true, today: TODAY });
    assert.equal(m.detected.event.size, 300);
    assert.equal(m.detected.archetype.primary, 'live');
    assert.equal(materialToDraft(m, { today: TODAY }).audience.size, 300);
  });
  test('인원이 적은 연수의 "대상 24명"은 유형을 바꾸지 않음', () => {
    const m = ingestText(['# 교사 마음 돌봄', '대상: 경력 3~10년 차 교사 24명', '', '## 사례', '- 6년 차 ㄱ 교사 이야기'].join('\n'), { markdown: true, today: TODAY });
    assert.equal(m.detected.event.size, 24);
    assert.equal(m.detected.archetype.primary, 'story');
  });
  test('차시표(표의 줄·제목 줄) → 차시 칸', async () => {
    const tbl = `<w:tbl>${[['차시', '날짜', '주제', '강사'], ['1차시', '1. 11.(월)', '학급 세우기', '나도담'], ['2차시', '1. 12.(화)', '학부모와 만나기', '한새벽'], ['3차시', '1. 13.(수)', '수업 설계의 기본', '나도담']]
      .map((r) => `<w:tr>${r.map((c) => `<w:tc><w:p><w:r><w:t>${c}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`;
    const m = await ingestFile('course.docx', docx([wp('2027 신규 교사 직무연수'), wp('기간: 2027. 1. 11.(월) ~ 1. 13.(수), 매일 09:30~12:30'), tbl]), { today: TODAY });
    assert.deepEqual(m.detected.sessions.map((s) => [s.no, s.date, s.title, s.desc]), [[1, '2027-01-11', '학급 세우기', '나도담'], [2, '2027-01-12', '학부모와 만나기', '한새벽'], [3, '2027-01-13', '수업 설계의 기본', '나도담']]);
    const d = materialToDraft(m, { today: TODAY });
    assert.equal(d.archetype.primary, 'course');
    assert.deepEqual(d.sections.find((s) => s.type === 'sessions').items.map((x) => x.title), ['학급 세우기', '학부모와 만나기', '수업 설계의 기본']);
    assert.equal(d.meta.sessions.length, 3);
  });
  test('본문에 "3차시"가 한 번 나온 것은 차시표가 아님', () => {
    const m = ingestText(['# 수업 나눔', '', '## 사례', '3차시 수업에서 모둠 활동을 했습니다.'].join('\n'), { markdown: true, today: TODAY });
    assert.deepEqual(m.detected.sessions, []);
  });
});
