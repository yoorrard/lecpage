// 교재 지킴이(guardMaterial) 회귀 시험: AI가 교재 글을 고쳐 쓰거나 빼거나 주소를 지어내도 교재대로 돌아오는지.
// 교재는 지어낸 짧은 글(마크다운)입니다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/index.js';
import { ingestText, materialToDraft } from '../src/ingest/index.js';

const TODAY = '2026-11-01';
const TEXT = `# 생성형 AI로 수업 자료 만들기
일시: 2026. 12. 3.(목) 14:00~17:00
장소: 새솔초등학교 컴퓨터실

## 연수 목표
- 수업 목표에 맞는 프롬프트를 4요소로 쓸 수 있다.
- 활동지와 평가 문항을 30분 안에 만들 수 있다.

## 오늘의 순서
| 시간 | 내용 |
|---|---|
| 14:00~14:20 | 열기: 프롬프트 4요소 |
| 14:20~15:00 | 실습 1. 학습 목표 다듬기 |
| 15:00~15:10 | 쉬는 시간 |

## 실습 1. 제미나이로 학습 목표 다듬기
1. gemini.google.com에 접속해 Google 계정으로 로그인합니다.
2. 아래 프롬프트를 복사해 입력창에 붙여 넣습니다.
3. 완성한 학습 목표 3개를 메모장에 붙여 둡니다.

프롬프트: 너는 초등학교 5학년 과학 교사야. 학습 목표를 학생이 이해할 말로 3개 써 줘.

[제미나이 열기](https://gemini.google.com/)

## 실습 2. 캔바로 활동지 만들기
1. canva.com에 접속해 교육용 계정으로 로그인합니다.
2. 검색창에 "활동지"를 입력하고 A4 세로 템플릿을 고릅니다.
3. PDF로 내려받아 저장합니다.

프롬프트: 5학년 학생이 행성의 크기를 비교하는 탐구 질문 3개를 만들어 줘.

[캔바 교육용](https://www.canva.com/education)

## 자주 묻는 질문
Q. 학생 이름이나 성적을 넣어도 되나요?
A. 넣지 않습니다. 개인정보는 지우고 씁니다.
Q. 무료 계정으로도 되나요?
A. 오늘 실습은 모두 무료 기능으로 합니다.
`;
const material = ingestText(TEXT, { name: 'notes.md', today: TODAY });
const draft = materialToDraft(material, { today: TODAY });
const sec = (bp, t) => bp.sections.find((s) => s.type === t);
const clone = (x) => JSON.parse(JSON.stringify(x));
/** 흉내 AI 답: 초안을 바탕으로 AI가 다듬은 것처럼(제목·소개·순서를 바꿈) */
function aiAnswer() {
  const bp = clone(draft);
  delete bp._draft;
  bp.concept = { idea: '한 줄 프롬프트가 활동지가 되는 오후', preset: 'paper-workbook' };
  sec(bp, 'hero').title = 'AI로 수업 자료 만들기';
  const st = sec(bp, 'stations');
  st.items.forEach((it) => { it.desc = '다듬은 소개 글이에요.'; it.outcome = '여기까지 됐나요?'; });
  bp.sections.reverse(); // 섹션 순서는 AI 답을 따름
  return bp;
}

describe('교재 지킴이', () => {
  test('초안에 지킬 것이 들어 있음(시험 교재 확인)', () => {
    assert.ok(sec(draft, 'goals')?.items.length >= 2, 'goals');
    assert.ok(sec(draft, 'schedule')?.items.length >= 3, 'schedule');
    assert.ok(sec(draft, 'faq')?.items.length >= 2, 'faq');
    const st = sec(draft, 'stations');
    assert.ok(st?.items.length >= 2 && st.items[0].steps.length >= 3 && st.items[0].prompts.length >= 1, 'stations');
  });

  test('잘 옮긴 답은 그대로(다듬은 제목·소개·순서도 그대로)', () => {
    const ai = aiAnswer();
    const { blueprint, restored } = E.guardMaterial(ai, draft, { material });
    assert.deepEqual(restored, []);
    assert.equal(sec(blueprint, 'hero').title, 'AI로 수업 자료 만들기');
    assert.equal(blueprint.sections[0].type, ai.sections[0].type, '순서');
    assert.equal(sec(blueprint, 'stations').items[0].desc, '다듬은 소개 글이에요.');
  });

  test('고쳐 쓴 프롬프트는 원문으로, 앞뒤 버튼 이름만 덜어 낸 것은 그대로', () => {
    const ai = aiAnswer();
    const it = sec(ai, 'stations').items[0];
    const orig = it.prompts[0].text;
    it.prompts[0].text = orig.replace('써 줘', '작성해 주세요') + ' 친절하게 설명해 주세요.';
    const { blueprint, restored } = E.guardMaterial(ai, draft, { material });
    assert.equal(sec(blueprint, 'stations').items[0].prompts[0].text, orig);
    const r = restored.find((x) => x.kind === 'prompt');
    assert.ok(r && r.before.includes('작성해 주세요') && r.after === orig, JSON.stringify(restored));
    // 초안 프롬프트 끝에 버튼 이름이 붙어 있어도 AI가 뺀 것은 받아 줌
    const d2 = clone(draft); sec(d2, 'stations').items[0].prompts[0].text = orig + '\n제미나이 열기';
    assert.deepEqual(E.guardMaterial(aiAnswer(), d2, { material }).restored.filter((x) => x.kind === 'prompt'), []);
  });

  test('빠진 단계는 제자리에, 교재에 없는 단계는 뺌', () => {
    const ai = aiAnswer();
    const it = sec(ai, 'stations').items[0];
    const want = clone(it.steps);
    it.steps.splice(1, 1);
    it.steps.push('결과를 친구와 나눠 보세요.');
    const { blueprint, restored } = E.guardMaterial(ai, draft, { material });
    assert.deepEqual(sec(blueprint, 'stations').items[0].steps, want);
    assert.equal(restored.filter((x) => x.kind === 'step').length, 2);
  });

  test('빠진 FAQ는 다시, 고친 답은 교재대로', () => {
    const ai = aiAnswer();
    const f = sec(ai, 'faq');
    const want = clone(f.items);
    f.items.splice(1, 1);
    f.items[0].a = '안 돼요.';
    const { blueprint, restored } = E.guardMaterial(ai, draft, { material });
    assert.deepEqual(sec(blueprint, 'faq').items, want);
    assert.deepEqual(restored.map((x) => x.kind).sort(), ['faq', 'faq']);
  });

  test('빠진 칸(FAQ·일정)은 초안 순서를 보고 알맞은 자리에', () => {
    const ai = aiAnswer();
    ai.sections = ai.sections.filter((s) => !['faq', 'schedule'].includes(s.type));
    const { blueprint, restored } = E.guardMaterial(ai, draft, { material });
    assert.ok(sec(blueprint, 'faq') && sec(blueprint, 'schedule'));
    assert.equal(restored.filter((x) => x.kind === 'section').length, 2);
  });

  test('일정: 바뀐 시각은 교재대로, 지어낸 줄은 뺌, 제목을 내용·방식으로 나눈 것은 그대로', () => {
    const ai = aiAnswer();
    const sc = sec(ai, 'schedule');
    sc.items[1].start = '14:30';
    sc.items.push({ start: '16:50', end: '17:00', title: '단체 사진' });
    sc.items[0].title = '열기'; sc.items[0].part = '프롬프트 4요소';
    const { blueprint, restored } = E.guardMaterial(ai, draft, { material });
    const items = sec(blueprint, 'schedule').items;
    assert.equal(items[1].start, sec(draft, 'schedule').items[1].start);
    assert.ok(!items.some((x) => x.title === '단체 사진'));
    assert.equal(items[0].title, '열기', '나눠 옮긴 제목은 둠');
    assert.equal(restored.length, 2, JSON.stringify(restored));
  });

  test('목표 문장은 말끝까지 교재대로', () => {
    const ai = aiAnswer();
    const g = sec(ai, 'goals');
    const want = clone(g.items);
    g.items[0] = g.items[0].replace(/다\.?$/, '어요');
    const { blueprint } = E.guardMaterial(ai, draft, { material });
    assert.deepEqual(sec(blueprint, 'goals').items, want);
  });

  test('지어낸 주소는 빼고(링크 목록은 항목째, 도구는 주소만), 교재의 링크는 되살림', () => {
    const ai = aiAnswer();
    const it = sec(ai, 'stations').items[0];
    const keepUrl = it.links[0].url;
    it.links = [{ label: '구글 로그인', url: 'https://accounts.google.com' }];
    ai.sections.push({ id: 'tools-more', type: 'tools', items: [{ name: '패들렛', url: 'https://padlet.com', desc: '보드' }] });
    ai.sections.push({ id: 'more', type: 'text', md: '[교재 사이트](https://example.org/x) 와 [제미나이](https://gemini.google.com/)' });
    const { blueprint, restored } = E.guardMaterial(ai, draft, { material, allowUrls: [] });
    const links = sec(blueprint, 'stations').items[0].links;
    assert.ok(!links.some((l) => /accounts\.google/.test(l.url)) && links.some((l) => l.url === keepUrl), JSON.stringify(links));
    const more = blueprint.sections.find((s) => s.id === 'tools-more');
    assert.equal(more.items[0].url, '');
    assert.equal(more.items[0].name, '패들렛');
    assert.equal(sec(blueprint, 'text').md, '교재 사이트 와 [제미나이](https://gemini.google.com/)');
    assert.ok(restored.filter((x) => x.kind === 'link').length >= 4, JSON.stringify(restored));
    // 강사가 넣은 주소는 그대로
    const ai2 = aiAnswer(); ai2.sections.push({ id: 'tools-more', type: 'tools', items: [{ name: '우리 보드', url: 'https://padlet.com/our-board' }] });
    assert.equal(E.guardMaterial(ai2, draft, { material, allowUrls: ['https://padlet.com/our-board'] }).blueprint.sections.find((s) => s.id === 'tools-more').items[0].url, 'https://padlet.com/our-board');
  });

  test('비워 둔 프롬프트 모음은 조용히 채움(알림에 세지 않음)', () => {
    const d = clone(draft);
    const all = sec(d, 'stations').items.flatMap((it) => it.prompts);
    d.sections.push({ id: 'prompts', type: 'prompts', items: all.map((p) => ({ title: p.title, text: p.text })) });
    const ai = aiAnswer(); ai.sections.push({ id: 'prompts', type: 'prompts', title: '프롬프트 모음' });
    const { blueprint, restored } = E.guardMaterial(ai, d, { material });
    assert.equal(sec(blueprint, 'prompts').items.length, all.length);
    assert.equal(E.restoredCount(restored), 0);
  });

  test('빠진 실습 칸은 다시, 그곳만 AI 답으로 되돌리기', () => {
    const ai = aiAnswer();
    const st = sec(ai, 'stations');
    const lost = st.items.pop();
    const g = E.guardMaterial(ai, draft, { material });
    const items = sec(g.blueprint, 'stations').items;
    assert.equal(items.length, st.items.length + 1);
    assert.equal(items[items.length - 1].title, lost.title);
    const r = g.restored.find((x) => x.kind === 'station');
    const back = E.undoRestore(g.blueprint, r);
    assert.equal(sec(back, 'stations').items.length, st.items.length);
    // 바뀐 프롬프트 하나만 되돌리기
    const ai2 = aiAnswer(); const p = sec(ai2, 'stations').items[0].prompts[0]; p.text = '바꾼 프롬프트';
    const g2 = E.guardMaterial(ai2, draft, { material });
    const b2 = E.undoRestore(g2.blueprint, g2.restored.find((x) => x.kind === 'prompt'));
    assert.equal(sec(b2, 'stations').items[0].prompts[0].text, '바꾼 프롬프트');
  });

  test('AI 답 읽기: 코드 블록·앞뒤 설명·대화 전체에서 답만', () => {
    const bp = { version: 1, meta: { title: '연수' }, concept: { idea: '한 줄' }, sections: [{ type: 'hero', title: '연수' }] };
    const J = JSON.stringify(bp, null, 2);
    const prompt = E.buildPrompt({ context: '## p.1 교재\n본문', info: { title: '연수' }, draft, material });
    assert.equal(E.readAnswer('좋아요, 만들었어요.\n```json\n' + J + '\n```\n더 필요하면 말씀하세요.').json.concept.idea, '한 줄');
    // 대화 전체(프롬프트 + 답): 프롬프트 안의 초안 JSON이 아니라 답을 고름
    const r = E.readAnswer(prompt + '\n\nChatGPT의 말:\n' + J);
    assert.equal(r.kind, 'ok'); assert.equal(r.json.concept.idea, '한 줄');
    assert.equal(E.readAnswer(prompt).kind, 'prompt');
    // 끊긴 답·질문·설명만 한 답
    assert.equal(E.readAnswer(J.slice(0, 60)).kind, 'cut');
    assert.equal(E.readAnswer(prompt + '\n' + J.slice(0, 60)).kind, 'cut', '대화 전체 + 끊긴 답');
    assert.equal(E.readAnswer('몇 가지 여쭤볼게요. 대상 학년은 몇 학년인가요?').kind, 'question');
    assert.equal(E.readAnswer('이 연수는 실습 위주로 구성하면 좋겠습니다.').kind, 'talk');
    assert.equal(E.readAnswer('   ').kind, 'empty');
    // 이어 쓴 답 붙이기: 겹친 곳은 한 번만, 앞 설명은 빼고, 처음부터 다시 쓴 답이면 그것만
    const a = J.slice(0, 70); const rest = J.slice(70);
    assert.deepEqual(JSON.parse(E.joinAnswer(a, rest)), bp);
    assert.deepEqual(JSON.parse(E.joinAnswer(a, '```json\n' + J.slice(55))), bp, '겹침');
    assert.deepEqual(JSON.parse(E.joinAnswer(a, '이어서 쓸게요.\n' + rest)), bp, '앞 설명');
    assert.deepEqual(JSON.parse(E.joinAnswer(a, J)), bp, '처음부터 다시');
    assert.equal(E.readAnswer(E.joinAnswer(a, rest)).kind, 'ok');
  });

  test('초안이 없으면 그대로', () => {
    const ai = aiAnswer();
    assert.equal(E.guardMaterial(ai, null).blueprint, ai);
  });
});
