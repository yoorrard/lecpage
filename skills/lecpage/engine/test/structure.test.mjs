// 구성 정하기 테스트: 교재 신호 → 흐름·칸 순서·이유·권하는 기능, 싣지 못한 것, 순서 가드레일, 컨셉 연결, AI 답에 초안 이어 주기.
// 교재는 지어낸 짧은 글(마크다운)입니다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/index.js';
import { nodeRuntime } from '../node.js';
import { ingestText, materialToDraft } from '../src/ingest/index.js';
import { decideStructure, cleanStructure, checkOrder, linkConcept, structureFor, FLOW_INFO, SIGNAL_TABLE } from '../src/decide/structure.js';
import { findLeftovers, leftoversToSections } from '../src/ingest/compose.js';
import { foundSummary } from '../src/ingest/signals.js';
import { FLOWS } from '../src/schema/sections.js';

const TODAY = '2026-11-01';
const DISCUSS = `# 교사 마음 돌봄 연수
일시: 2026. 12. 17.(목) 15:40~17:10
장소: 가온초 도서실

## 세 가지 사례
사례 1. 첫해의 밤
3년 차 ㄱ 교사는 밤마다 수업을 다시 짰다.
"제가 뭘 잘못했는지 계속 찾게 되더라고요."
사례 2. 회의 뒤
ㄴ 교사는 회의가 끝나면 말이 없어졌다.
사례 3. 쉬는 시간
ㄷ 교사는 쉬는 시간에도 일을 했다.

## 함께 나눌 질문
1. 나를 지치게 하는 것은 무엇인가요?
2. 나를 다시 일으키는 것은 무엇인가요?
3. 동료에게 받고 싶은 도움은 무엇인가요?

## 토론 규칙
- 끝까지 듣기
- 고치려 하지 않기

## 성찰 일지
- 오늘 나에게 고마웠던 일을 적어 보세요.
- 다음 주에 해 볼 한 가지를 적어 보세요.
`;
const PROC = `# 학교 안전사고 대응 연수
일시: 2026. 12. 10.(목) 15:30~17:00
장소: 가온중학교 시청각실
강사: 나도담(가온중학교 안전부장)

## 연수 목적
- 사고가 났을 때 무엇을 먼저 하는지 같은 순서로 안다.
- 보고 기한과 기록 서식을 빠뜨리지 않는다.

## 대응 절차
1. 현장 안전을 확보한다.
2. 119와 보건실에 알린다.
3. 보호자에게 연락한다.
4. 중대사고는 1시간 이내에 교육청에 보고한다.
5. 사고 경위서를 당일 작성한다.

## 판단 기준
| 구분 | 기준 | 조치 |
|---|---|---|
| 경미 | 보건실 처치로 끝남 | 담임에게 알림 |
| 중대 | 병원 이송 | 1시간 이내 보고 |

## 자주 묻는 질문
Q. 보호자 연락이 안 되면요?
A. 비상 연락처 순서대로 연락합니다.
`;
const EVENT = `# 2027 교육과정 설명회
일시: 2027. 2. 18.(목) 14:00~16:30
장소: 다울교육청 대강당
대상: 초등 교원 300명

## 진행 순서
14:00~14:10 여는 말 교육지원과장
14:10~14:50 바뀌는 점 윤가온 장학사
14:50~15:30 학교 적용 한빛나 수석교사
15:30~16:00 질의응답

## 발표자
윤가온
다울교육청 장학사
한빛나
가온중학교 수석교사
`;
const COURSE = `# 신규 교사 직무연수(15시간)
기간: 2027. 1. 11.(월) ~ 1. 15.(금) 09:30~12:30
장소: 누리별연수원 201호

## 과정 개요
연수 시간: 15시간
이수 기준: 출석 80% 이상 + 과제 제출

## 차시
1차시 학급 세우기
첫날 15분 인사와 자리 정하기
2차시 학부모와 만나기
상담 순서 익히기
3차시 수업 설계의 기본
도입·전개·정리 나누기

## 과제와 이수 처리
과제: 학급 운영 계획서 1쪽
이수 결과는 1. 29.(금)에 나이스에 등록됩니다.
`;
const mat = (text, name = 'notes.md') => ingestText(text, { name, today: TODAY });
const types = (bp) => bp.sections.filter((s) => !s.hidden).map((s) => s.type);
const before = (list, a, b) => list.indexOf(a) >= 0 && list.indexOf(a) < list.indexOf(b);

describe('구성 정하기: 신호 → 흐름', () => {
  test('사례·질문·성찰이 있는 문서 → 사례·토론 흐름, 교재의 절 순서대로, 나눔 보드를 권하기만 함', () => {
    const m = mat(DISCUSS);
    const d = materialToDraft(m, { today: TODAY });
    const t = types(d);
    assert.equal(d.structure.flow, 'discussion');
    assert.ok(before(t, 'cases', 'discuss') && before(t, 'discuss', 'reflection'), t.join('>'));
    assert.deepEqual(d.sections.find((s) => s.type === 'discuss').rules, ['끝까지 듣기', '고치려 하지 않기'], '토론 규칙은 질문 칸의 진행 규칙으로');
    assert.equal(d.sections.find((s) => s.type === 'cases').items[0].quote, '제가 뭘 잘못했는지 계속 찾게 되더라고요.');
    assert.deepEqual(d.structure.suggested.map((x) => x.feature), ['board']);
    assert.ok(!t.includes('board') && !d.live.features.length, '실시간 기능은 강사가 원할 때만 켜짐(권하기만)');
    assert.ok(d.structure.reasons.length >= 1 && d.structure.reasons.every((r) => r.length <= 160));
    assert.deepEqual(foundSummary(m.detected), ['사례 3개', '질문 3개', '성찰 질문 2개']);
    assert.deepEqual(E.validate(d).warnings, []);
  });
  test('번호 단계 + 표가 있는 문서 → 절차·기준 흐름(목표 → 절차 → 표 → FAQ), 실습 기능은 권하지 않음', () => {
    const d = materialToDraft(mat(PROC), { today: TODAY });
    const t = types(d);
    assert.equal(d.structure.flow, 'procedure');
    assert.ok(before(t, 'goals', 'procedure') && before(t, 'procedure', 'table') && before(t, 'table', 'faq'), t.join('>'));
    const proc = d.sections.find((s) => s.type === 'procedure');
    assert.equal(proc.items.length, 5);
    assert.equal(proc.items[3].time, '1시간 이내');
    const tb = d.sections.find((s) => s.type === 'table');
    assert.deepEqual(tb.head, ['구분', '기준', '조치']);
    assert.equal(tb.rows.length, 2);
    assert.ok(!d.structure.suggested.some((x) => ['progress', 'help'].includes(x.feature)));
  });
  test('참석 300명·발표자 여럿 → 행사 흐름: 일정 → 발표자, 진행 순서·발표자 절은 글 칸으로 되풀이하지 않음, 질문 받기·투표를 권함', () => {
    const m = mat(EVENT);
    const d = materialToDraft(m, { today: TODAY });
    const t = types(d);
    assert.equal(d.structure.flow, 'event');
    assert.ok(before(t, 'schedule', 'speakers'), t.join('>'));
    assert.ok(!t.includes('text'), t.join('>'));
    assert.deepEqual(d.sections.find((s) => s.type === 'speakers').items.map((x) => x.name), ['윤가온', '한빛나']);
    assert.deepEqual(d.sections.find((s) => s.type === 'schedule').items.slice(0, 2).map((x) => [x.title, x.desc]), [['여는 말', '교육지원과장'], ['바뀌는 점', '윤가온 장학사']], '일정표의 담당은 설명으로');
    assert.ok(!t.includes('instructor'), '발표자가 여럿이면 강사 칸 대신 발표자 칸');
    assert.deepEqual(d.structure.suggested.map((x) => x.feature), ['qa', 'poll']);
    assert.match(d.structure.suggested[0].reason, /질의응답/);
    assert.ok(foundSummary(m.detected).includes('발표자 2명'));
  });
  test('차시가 있는 직무연수 → 과정 흐름, 출석을 권함, 과제·이수 처리는 연수 후 안내로', () => {
    const d = materialToDraft(mat(COURSE), { today: TODAY });
    const t = types(d);
    assert.equal(d.structure.flow, 'course');
    assert.ok(t.includes('sessions') && t.includes('followup'));
    assert.deepEqual(d.structure.suggested.map((x) => x.feature), ['attendance']);
    const fu = d.sections.find((s) => s.type === 'followup');
    assert.match(fu.completion, /나이스에 등록/);
    assert.match(fu.items[0].desc, /학급 운영 계획서/);
  });
  test('강사가 고른 형식이 신호와 다르면 형식을 따르고, 이유에 적음', () => {
    const st = decideStructure({ format: 'conference' }, mat(DISCUSS));
    assert.equal(st.flow, 'event');
    assert.match(st.reasons[0], /설명회·컨퍼런스/);
    assert.equal(st.archetype.primary, 'live');
  });
  test('컨셉: 신호가 약한 교재는 컨셉이 고른 칸으로 흐름을 정하고 이유에 컨셉을 적음. 재료가 없으면 바꾸지 않음', () => {
    const plain = mat('# 수업 나눔\n## 들어가며\n오늘은 서로의 수업 이야기를 들어요.\n## 생각해 볼 질문\n- 내 수업에서 가장 좋았던 순간은 언제였나요?\n- 다음에 바꿔 보고 싶은 것은 무엇인가요?\n');
    const base = decideStructure({}, plain);
    assert.equal(base.flow, 'source');
    const c = { idea: '서로의 수업 이야기를 듣고 나누는 시간', sections: ['cases', 'discuss'], features: ['board', 'poll'], source: 'ai' };
    const st = decideStructure({}, plain, c);
    assert.equal(st.flow, 'discussion');
    assert.ok(st.reasons.some((r) => /컨셉\("서로의 수업 이야기/.test(r)), st.reasons.join(' / '));
    assert.deepEqual(st.suggested.map((x) => x.feature), ['board', 'poll'], '신호에서 이유를 찾은 기능이 먼저, 그다음 컨셉이 고른 기능');
    assert.match(st.suggested[1].reason, /컨셉/);
    assert.equal(decideStructure({}, mat(PROC), c).flow, 'procedure', '신호가 분명하면 컨셉이 흐름을 바꾸지 않음');
    assert.equal(decideStructure({}, mat('# 연수\n## 안내\n그냥 메모'), c).flow, 'source', '교재에 사례·질문이 없으면 그 흐름으로 가지 않음');
  });
  test('교재 없이도(신호 없음) 동작: 강의 흐름, 컨셉은 문자열이어도 됨', () => {
    const st = decideStructure({}, null, '함께 만드는 수업');
    assert.ok(FLOWS.includes(st.flow));
    assert.ok(st.reasons.length >= 1);
  });
  test('흐름 표와 신호 표: 모든 흐름에 이름·때·순서가 있고 첫 칸은 첫 화면', () => {
    for (const f of FLOWS) { assert.ok(FLOW_INFO[f]?.label && FLOW_INFO[f].when && FLOW_INFO[f].path, f); assert.equal(FLOW_INFO[f].order[0], 'hero'); assert.ok(FLOW_INFO[f].order.includes('*')); }
    assert.ok(SIGNAL_TABLE.length >= 12 && SIGNAL_TABLE.every((r) => r.length === 3));
  });
});

describe('구성 결과(structure)와 가드레일', () => {
  test('cleanStructure: 모르는 흐름은 버리고, 글자는 줄이고, 권하는 기능은 아는 것만', () => {
    assert.equal(cleanStructure({ flow: 'nope' }), null);
    const s = cleanStructure({ flow: 'event', reasons: ['<b>큰 행사</b>', '', 'x'.repeat(300)], suggested: [{ feature: 'qa', reason: '질문' }, { feature: 'hack' }], leftovers: { count: 3, items: [{ page: 2, text: '남은 줄' }] }, source: 'ai' });
    assert.equal(s.label, '행사');
    assert.equal(s.reasons[0], 'b큰 행사/b');
    assert.equal(s.reasons[1].length, 160);
    assert.deepEqual(s.suggested.map((x) => x.feature), ['qa']);
    assert.equal(s.leftovers.count, 3);
    assert.equal(s.source, 'ai');
    const v = E.validate({ meta: { title: 't' }, structure: s, sections: [{ type: 'hero' }] });
    assert.equal(v.blueprint.structure.flow, 'event', '검증을 지나도 남음');
  });
  test('순서 가드레일: 목표가 본문 뒤, 설문이 마무리 뒤, 본문이 자료 뒤면 알리기만(옮기지 않음)', () => {
    const v = E.validate({ meta: { title: 't' }, sections: [{ type: 'hero' }, { type: 'text', title: '본문', md: '글' }, { type: 'goals', items: ['하나'] }, { type: 'materials', items: [{ title: '자료', href: 'https://a.example/x' }] }, { type: 'cases', items: [{ title: '사례', body: '글' }] }, { type: 'closing', text: '끝' }, { type: 'survey', url: 'https://forms.gle/x' }] });
    const msgs = v.warnings.filter((w) => w.kind === 'order').map((w) => w.message_ko).join(' / ');
    assert.match(msgs, /연수 목표가/);
    assert.match(msgs, /만족도 조사가 마무리 뒤/);
    assert.match(msgs, /자료·연수 후 안내 뒤/);
    assert.deepEqual(v.blueprint.sections.map((s) => s.type), ['hero', 'text', 'goals', 'materials', 'cases', 'closing', 'survey']);
    assert.deepEqual(checkOrder([{ type: 'hero' }, { type: 'goals' }, { type: 'procedure' }, { type: 'survey' }, { type: 'closing' }]), []);
  });
  test('컨셉 연결: 규칙으로 세운 컨셉은 실제로 고른 칸·권한 기능으로 채우고, AI·선생님이 적은 값은 지킴', () => {
    const st = { suggested: [{ feature: 'board' }] };
    const secs = [{ type: 'hero' }, { type: 'cases' }, { type: 'discuss' }, { type: 'closing' }];
    assert.deepEqual(linkConcept({ idea: 'x', sections: ['stations'], features: [], source: 'auto' }, st, secs), { idea: 'x', sections: ['cases', 'discuss'], features: ['board'], source: 'auto' });
    const ai = linkConcept({ idea: 'x', sections: ['reflection'], features: ['poll'], source: 'ai' }, st, secs);
    assert.deepEqual([ai.sections, ai.features], [['reflection'], ['poll']]);
  });
  test('applyInfo: 초안의 흐름·이유는 그대로, 컨셉의 칸·기능이 구성과 맞음', () => {
    const m = mat(DISCUSS);
    const d = materialToDraft(m, E.draftInfo({ today: TODAY }));
    const bp = E.applyInfo({ ...d, _presetAuto: true }, {}, m, null);
    assert.equal(bp.structure.flow, 'discussion');
    assert.deepEqual(bp.structure.reasons, d.structure.reasons);
    assert.ok(bp.concept.sections.includes('cases') && bp.concept.features.includes('board'), JSON.stringify(bp.concept));
    assert.equal(E.validate(bp).errors.length, 0);
  });
});

describe('교재에 있는데 싣지 못한 것', () => {
  test('AI 답이 뺀 문단을 세고, 누르면 본문 칸(글)으로 넣을 수 있음', () => {
    const m = mat(DISCUSS);
    const ai = { meta: { title: '교사 마음 돌봄 연수', date: '2026-12-17', venue: '가온초 도서실' }, sections: [{ type: 'hero' }, { type: 'discuss', items: ['나를 지치게 하는 것은 무엇인가요?', '나를 다시 일으키는 것은 무엇인가요?', '동료에게 받고 싶은 도움은 무엇인가요?'] }] };
    const lo = findLeftovers(m, ai);
    assert.ok(lo.count >= 5, JSON.stringify(lo));
    assert.ok(lo.items.some((x) => /밤마다 수업을 다시 짰다/.test(x.text)));
    assert.ok(!lo.items.some((x) => /일시|장소/.test(x.text)), '첫 화면 정보 줄은 연수 정보로 실림');
    const add = leftoversToSections(lo);
    assert.ok(add.length >= 2 && add.every((s) => s.type === 'text' && s.md && s.source.pages.length === 1));
    const v = E.validate({ ...ai, sections: [...ai.sections, ...add] });
    assert.equal(v.errors.length, 0);
    assert.equal(findLeftovers(m, v.blueprint).count, 0, '넣은 뒤에는 0');
    const st = structureFor(E.applyInfo(ai, {}, m, null), {}, m, lo);
    assert.equal(st.leftovers.count, lo.count);
  });
  test('교재 보기(deck)에만 있는 줄은 싣지 못한 것: make의 교재 반영과 같은 기준(structure --add-leftovers가 패치로 만들 수 있게)', () => {
    const m = mat(DISCUSS);
    const d = materialToDraft(m, { today: TODAY });
    const deck = { type: 'deck', slides: m.pages.map((p) => ({ page: p.page, text: (p.paragraphs || []).map((x) => x.text).join('\n') })) };
    const only = { ...d, sections: [d.sections[0], deck] };
    const lo = findLeftovers(m, only);
    assert.ok(lo.count >= 5, JSON.stringify(lo));
    assert.equal(E.materialCoverage(m, only).lines.missing, lo.count);
    assert.equal(findLeftovers(m, { ...only, sections: [...only.sections, ...leftoversToSections(findLeftovers(m, only, { max: 99 }))] }).count, 0, '넣은 뒤에는 0');
  });
  test('AI 없는 초안은 교재 5종 모양(사례·절차·행사·과정)에서 싣지 못한 것이 없음', () => {
    for (const t of [DISCUSS, PROC, EVENT, COURSE]) {
      const d = materialToDraft(mat(t), { today: TODAY });
      assert.equal(d.structure.leftovers.count, 0, `${d.meta.title}: ${JSON.stringify(d.structure.leftovers.items)}`);
    }
  });
});

describe('AI 답에 초안을 이어 주기(keepDraftParts)', () => {
  test('교재 보기의 쪽 그림·쪽 글·쪽별 도구는 초안 것으로, AI 답에서는 안내 글만 받음. 교재 보기가 없으면 넣음', () => {
    const draft = { design: { sourceFonts: { body: { name: '나눔고딕' } } }, sources: [{ id: 'deck1', name: 'a.pptx', pages: 2 }], sections: [{ id: 'hero', type: 'hero' }, { id: 'deck', type: 'deck', nav: '교재', slides: [{ page: 1, src: 'assets/slides/slide-001.webp', title: '하나', text: '첫 쪽 글', tools: ['Padlet'] }, { page: 2, src: 'assets/slides/slide-002.webp', title: '둘', text: '둘째 쪽', tools: [] }] }] };
    const ai = { sections: [{ type: 'hero' }, { type: 'deck', title: '교재', lead: '넘기며 보세요.', slides: [{ page: 1, title: '하나' }] }, { type: 'closing' }] };
    const out = E.keepDraftParts(ai, draft);
    const deck = out.sections.find((s) => s.type === 'deck');
    assert.equal(deck.slides.length, 2);
    assert.equal(deck.slides[0].src, 'assets/slides/slide-001.webp');
    assert.deepEqual(deck.slides[0].tools, ['Padlet']);
    assert.equal(deck.lead, '넘기며 보세요.');
    assert.equal(out.design.sourceFonts.body.name, '나눔고딕');
    const none = E.keepDraftParts({ sections: [{ type: 'hero' }, { type: 'faq', items: [] }, { type: 'closing' }] }, draft);
    assert.deepEqual(none.sections.map((s) => s.type), ['hero', 'deck', 'faq', 'closing']);
  });
});

describe('한 곳 고치기 뒤 첫 화면(P1-7)', () => {
  test('patch로 장소를 바꾸면 첫 화면에 따로 적힌 장소 줄도 바뀜(손으로 고친 줄은 그대로)', () => {
    const d = materialToDraft(mat(EVENT), { today: TODAY });
    const hero = d.sections.find((s) => s.type === 'hero');
    assert.ok(hero.meta.some((x) => x.label === '장소' && x.value === '다울교육청 대강당'), JSON.stringify(hero.meta));
    hero.meta.push({ label: '주차', value: '지하 2층' });
    const r = E.applyBlueprintPatch(d, { meta: { venue: '다울교육청 별관 강당' } });
    const meta = r.raw.sections.find((s) => s.type === 'hero').meta;
    assert.equal(meta.find((x) => x.label === '장소').value, '다울교육청 별관 강당');
    assert.equal(meta.find((x) => x.label === '주차').value, '지하 2층');
    const html = E.build(r.raw, { runtime: nodeRuntime() }).files['index.html'];
    assert.ok(!html.includes('다울교육청 대강당'), '옛 장소가 남지 않음');
  });
});

describe('AI 프롬프트: 컨셉 → 흐름 → 칸 구성', () => {
  test('흐름·신호 표·새 칸·글 칸 문법이 들어가고, 초안의 군살(엔진 메모·실시간·메일·교재 쪽)은 빠짐', () => {
    const m = mat(DISCUSS);
    const draft = materialToDraft(m, { today: TODAY, instructor: { name: '나도담', email: 'dodam@example.com' } });
    const p = E.buildPrompt({ context: '[쪽 1] 교재', info: { title: '연수' }, draft, material: m });
    for (const s of ['### 구성 정하기(컨셉 → 흐름 → 칸)', '사례·토론(discussion)', '"structure":{flow:', '- procedure (절차):', '- cases (사례):', '- discuss (함께 나눌 질문):', '- table (표):', '### 글 칸 문법(text.md)', '[!예시]', '찾은 것: 사례 3개 · 질문 3개 · 성찰 질문 2개', '흐름: 사례·토론(discussion)']) assert.ok(p.includes(s), s);
    assert.ok(p.indexOf('### 컨셉 먼저(concept)') < p.indexOf('### 구성 정하기') && p.indexOf('### 구성 정하기') < p.indexOf('### 섹션 타입과 필드'), '컨셉 → 흐름 → 칸 순서');
    const dj = p.slice(p.indexOf('## 참고: 자동으로 만든 초안'), p.indexOf('## 교재 내용'));
    for (const s of ['"_draft"', '"live"', '"privacy"', 'dodam@example.com', '"leftovers"', '"slides"']) assert.ok(!dj.includes(s), s);
    assert.ok(!p.includes('joinUrl(온라인'), '회의 주소는 강사가 확인한 값만');
    assert.match(p, /이 교재에 맞는 6종/);
    assert.match(p, /교재나 연수 정보에 적힌 값을 쓰고, 둘 다에 없으면 비운다/);
  });
  test('숨긴 쪽은 AI에 보내지 않음', async () => {
    const { materialToAIContext } = await import('../src/ingest/index.js');
    const m = mat('# 연수\n## 보이는 쪽\n보이는 글\n## 숨길 쪽\n숨길 글');
    m.pages[m.pages.length - 1].hidden = true;
    const ctx = materialToAIContext(m);
    assert.ok(ctx.includes('보이는 글') && !ctx.includes('숨길 글'));
  });
});
