// 사이트 내용 구조·문구 테스트: 연수 목표, 연수 후 안내, 온라인 입장, 이수 기준, 차시 날짜, 문의처, 문구 점검
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../src/index.js';
import { nodeRuntime } from '../node.js';
import { validate, followupKind } from '../src/validate.js';
import { ingestText, materialToDraft } from '../src/ingest/index.js';
import { lintText, COPY_RULES } from '../src/prompt/copy-rules.js';
import { buildPrompt } from '../src/prompt/bridge.js';
import { DEFAULT_SURVEY, SECTION_DEFS } from '../src/schema/sections.js';
import { RENDERERS } from '../src/render/sections.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXDIR = join(HERE, '..', '..', 'examples');
const EX = (id) => JSON.parse(readFileSync(join(EXDIR, `${id}.blueprint.json`), 'utf8'));
const build = (bp) => E.build(bp, { runtime: nodeRuntime() });
const index = (bp) => build(bp).files['index.html'];
const data = (html) => JSON.parse(/<script type="application\/json" id="lp-data">([\s\S]*?)<\/script>/.exec(html)[1]);
const XSS = '<img src=x onerror=alert(1)>';

describe('검증: 새 칸(goals·followup)과 문의처', () => {
  test('goals: 문자열·{text} 둘 다 받고, 빈 항목은 빼고, 6개까지', () => {
    const { blueprint: b } = validate({ meta: { title: 't' }, sections: [{ type: 'hero' }, { type: 'goals', items: ['하나', { text: '둘' }, '', null, '셋', '넷', '다섯', '여섯', '일곱'], who: '중등 교사' }] });
    const g = b.sections.find((s) => s.type === 'goals');
    assert.deepEqual(g.items, ['하나', '둘', '셋', '넷', '다섯', '여섯']);
    assert.equal(g.who, '중등 교사');
    assert.equal(g.nav, '', '목표는 메뉴에 넣지 않음(첫 화면 바로 아래)');
  });
  test('goals: 항목이 없으면 빼고 알림', () => {
    const r = validate({ meta: { title: 't' }, sections: [{ type: 'hero' }, { type: 'goals', items: [], who: 'x' }] });
    assert.ok(!r.blueprint.sections.some((s) => s.type === 'goals'));
    assert.ok(r.warnings.some((w) => /연수 목표/.test(w.message_ko)));
  });
  test('followup: 위험한 주소는 버리고 종류는 주소로 짐작', () => {
    const { blueprint: b } = validate({ meta: { title: 't' }, sections: [{ type: 'hero' }, { type: 'followup', items: [
      { title: '다시 보기', url: 'https://youtu.be/abc' }, { title: '소통방', url: 'https://open.kakao.com/o/abc' },
      { title: '나쁜 링크', url: 'javascript:alert(1)' }, { title: '다음 연수', desc: '6월', kind: 'next' }, { title: '읽기', url: 'https://example.org', kind: 'read' },
      { title: '모르는 종류', url: 'https://example.org', kind: 'evil' },
    ] }] });
    const f = b.sections.find((s) => s.type === 'followup');
    assert.deepEqual(f.items.map((i) => [i.title, i.kind]), [['다시 보기', 'recording'], ['소통방', 'community'], ['다음 연수', 'next'], ['읽기', 'read'], ['모르는 종류', 'link']]);
    assert.ok(!JSON.stringify(f).includes('javascript:'));
  });
  test('followup: 항목 없이 이수 안내만 있어도 남김', () => {
    const { blueprint: b, warnings } = validate({ meta: { title: 't' }, sections: [{ type: 'hero' }, { type: 'followup', completion: '2주 안에 등록해요.' }] });
    assert.equal(b.sections.find((s) => s.type === 'followup').completion, '2주 안에 등록해요.');
    assert.deepEqual(warnings, []);
  });
  test('followupKind', () => {
    assert.equal(followupKind('https://www.youtube.com/watch?v=x'), 'recording');
    assert.equal(followupKind('https://band.us/band/1'), 'community');
    assert.equal(followupKind('https://example.org'), 'link');
  });
  test('meta.contact는 120자로 자르고 hero.meta에 링크(url)를 걸 수 있음', () => {
    const { blueprint: b } = validate({ meta: { title: 't', contact: 'x'.repeat(300) }, sections: [{ type: 'hero', meta: [{ label: '장소', value: '3층', url: 'https://map.example.org' }, { label: '나쁨', value: 'v', url: 'javascript:1' }] }] });
    assert.equal(b.meta.contact.length, 120);
    assert.equal(b.sections[0].meta[0].url, 'https://map.example.org/');
    assert.equal(b.sections[0].meta[1].url, undefined);
  });
});

describe('렌더: 새 칸과 자동 표시', () => {
  test('goals·followup·문의처의 내용은 이스케이프', () => {
    const html = index({ meta: { title: 't', contact: `${XSS} a@b.kr 031-123-4567` }, sections: [{ type: 'hero' },
      { type: 'goals', items: [XSS], who: XSS }, { type: 'followup', items: [{ title: XSS, desc: XSS, url: 'https://example.org' }], completion: XSS }] });
    assert.ok(!html.includes('<img src=x'));
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(html.includes('<a href="mailto:a@b.kr">a@b.kr</a>'), '이메일은 mailto 링크');
    assert.ok(html.includes('<a href="tel:0311234567">031-123-4567</a>'), '전화는 tel 링크');
    assert.ok(/<section id="followup"[^>]*data-followup/.test(html));
  });
  test('이수 기준: 직무연수(official)면 목표 칸에, 목표 칸이 없으면 첫 화면에', () => {
    const meta = { title: 't', date: '2026-12-16', admin: { kind: 'official', hours: 1.5, completionRate: 80 } };
    const withGoals = index({ meta, sections: [{ type: 'hero' }, { type: 'goals', items: ['표로 모아요'] }] });
    assert.match(withGoals, /<b>이수<\/b> 1시간 30분 · 출석 80% 이상/);
    assert.ok(!/<dt>이수<\/dt>/.test(withGoals), '같은 말을 두 번 하지 않음');
    const noGoals = index({ meta, sections: [{ type: 'hero' }] });
    assert.match(noGoals, /<dt>이수<\/dt><dd>1시간 30분 · 출석 80% 이상<\/dd>/);
    const school = index({ meta: { ...meta, admin: { kind: 'school' } }, sections: [{ type: 'hero' }] });
    assert.ok(!school.includes('<dt>이수</dt>'));
  });
  test('직무연수 + 사이트 안 설문이면 "설문 제출"이 이수 기준과 설문 칸에 보임', () => {
    const html = index({ meta: { title: 't', admin: { kind: 'official', hours: 3, completionRate: 90 } }, live: { provider: 'local', features: ['qa'] },
      sections: [{ type: 'hero' }, { type: 'survey', questions: DEFAULT_SURVEY }, { type: 'attendance' }] });
    assert.match(html, /3시간 · 출석 90% 이상 · 설문 제출/);
    assert.ok(html.includes('설문을 내야 이수가 확인돼요.'));
    assert.ok(html.includes('둘 다 눌러야 이수가 확인돼요.'));
  });
  test('온라인·혼합: 회의 입장 버튼이 맨 앞, 끝나면 숨김 표시. 오프라인은 버튼 없음', () => {
    const on = index({ meta: { title: 't', mode: 'hybrid', venue: '3층', joinUrl: 'https://us02web.zoom.us/j/123' }, sections: [{ type: 'hero', ctas: [{ label: '교재 보기', href: '#deck' }] }] });
    assert.match(on, /<a class="lp-btn lp-btn-primary" href="https:\/\/us02web\.zoom\.us\/j\/123"[^>]*data-phase-hide="after"><span>Zoom 입장<\/span>/);
    assert.match(on, /<dt>장소<\/dt><dd>3층 · 온라인 \(Zoom\)<\/dd>/);
    const meet = index({ meta: { title: 't', mode: 'online', joinUrl: 'https://meet.google.com/abc-defg-hij' }, sections: [{ type: 'hero' }] });
    assert.ok(meet.includes('Google Meet 입장'));
    const off = index({ meta: { title: 't', mode: 'offline', joinUrl: 'https://zoom.us/j/1' }, sections: [{ type: 'hero' }] });
    assert.ok(!off.includes('입장</span>'));
  });
  test('차시: 상태를 안 적으면 날짜로 자동 표시하게 표시, 차시마다 앵커', () => {
    const html = index({ meta: { title: 't' }, sections: [{ type: 'hero' }, { type: 'sessions', items: [{ title: '1회', date: '2026-11-01' }, { title: '2회', date: '2026-12-01' }] }] });
    assert.ok(html.includes('data-sessions-auto'));
    assert.match(html, /<li id="sessions-2" data-status="" data-date="2026-12-01">/);
    const manual = index({ meta: { title: 't' }, sections: [{ type: 'hero' }, { type: 'sessions', items: [{ title: '1회', date: '2026-11-01', status: 'done' }] }] });
    assert.ok(!manual.includes('data-sessions-auto'));
    assert.ok(manual.includes('>마침</span>'));
  });
  test('연수 기간(phase)과 끝난 뒤 줄: 날짜가 있으면 만들고, 가장 먼저 볼 칸으로 연결', () => {
    const html = index({ meta: { title: 't', date: '2026-12-16', start: '14:00', end: '17:00', sessions: [{ date: '2026-12-23', end: '16:00' }] },
      sections: [{ type: 'hero' }, { type: 'materials', items: [{ title: '교재' }] }, { type: 'followup', id: 'after', items: [{ title: '다시 보기', url: 'https://youtu.be/x' }] }] });
    assert.deepEqual(data(html).phase, { start: '2026-12-16T14:00', end: '2026-12-23T16:00' });
    assert.match(html, /data-phase-bar hidden[\s\S]*?2026\. 12\. 23\.\(수\)에 끝난 연수예요\.[\s\S]*?href="#after">연수 후 안내<\/a>/);
    const none = index({ meta: { title: 't' }, sections: [{ type: 'hero' }] });
    assert.equal(data(none).phase, null);
    assert.ok(!none.includes('data-phase-bar'));
  });
  test('바닥글에 문의처, 개인정보 안내의 문의는 문의처로', () => {
    const r = build({ meta: { title: 't', contact: '연수 담당 a@b.kr' }, live: { provider: 'local', features: ['qa'] }, sections: [{ type: 'hero' }, { type: 'qa' }] });
    assert.match(r.files['index.html'], /<p>문의 연수 담당 <a href="mailto:a@b\.kr">/);
    assert.ok(r.files['privacy.html'].includes('mailto:a@b.kr'));
  });
  test('모든 섹션 타입에 렌더러가 있음', () => {
    for (const t of Object.keys(SECTION_DEFS)) assert.equal(typeof RENDERERS[t], 'function', t);
  });
});

describe('초안(draft): 교재에서 채우기', () => {
  const MD = `# 데이터로 읽는 우리 반
일시: 2026년 12월 16일(수) 14:00~17:00
대상: 스프레드시트를 써 본 중등 교사
문의: 연수 담당 김하나 02-123-4567

# 연수 목표
- 흩어진 학습 기록을 표 하나로 모을 수 있다
- 차트로 우리 반의 흐름을 읽을 수 있다

# 실습 1. 표로 모으기
1. 시트를 새로 만든다
2. 기록을 붙여 넣는다
※ 학교 계정으로 로그인이 안 되면 개인 계정으로 들어가세요.
프롬프트: 목표: [단원명] 수업에 쓸 활동지를 만들어 줘.

# 참고 자료
- 다시 보기 영상 https://youtu.be/abc123
- 안내서 https://example.org/guide
`;
  const d = materialToDraft(ingestText(MD, { name: 'notes.md' }), { today: '2026-11-01' });
  const sec = (t) => d.sections.find((s) => s.type === t);
  test('연수 목표·대상: 목표 쪽에서 가져오고 해요체로', () => {
    assert.deepEqual(sec('goals').items, ['흩어진 학습 기록을 표 하나로 모을 수 있어요', '차트로 우리 반의 흐름을 읽을 수 있어요']);
    assert.equal(sec('goals').who, '스프레드시트를 써 본 중등 교사');
    assert.ok(!sec('goals').items.some((x) => x.includes('단원명')), '프롬프트 속 "목표:"는 연수 목표가 아님');
  });
  test('문의처, 실습의 막히는 곳 메모, 연수 후 링크', () => {
    assert.equal(d.meta.contact, '연수 담당 김하나 02-123-4567');
    const st = sec('stations').items[0];
    assert.equal(st.note, '학교 계정으로 로그인이 안 되면 개인 계정으로 들어가세요.');
    assert.ok(!st.desc.startsWith('※'));
    assert.deepEqual(sec('followup').items.map((i) => [i.title, i.kind]), [['다시 보기 영상', 'recording'], ['안내서', 'link']]);
  });
  test('설문은 기본 5문항, 마무리 앞', () => {
    assert.equal(sec('survey').questions.length, DEFAULT_SURVEY.length);
    const types = d.sections.map((s) => s.type);
    assert.ok(types.indexOf('survey') < types.indexOf('closing'));
    assert.deepEqual(validate(d).warnings, []);
  });
  test('목표가 없으면 지어내지 않고 할 일에 남김', () => {
    const d2 = materialToDraft(ingestText('# 연수\n그냥 메모'), { title: '연수' });
    assert.ok(!d2.sections.some((s) => s.type === 'goals'));
    assert.ok(d2._draft.todo.some((t) => t.includes('연수 목표')));
  });
});

describe('문구 규칙', () => {
  test('AI 말투·장식·풀어쓰기를 잡고, 평범한 문장은 통과', () => {
    const errs = (t, k) => lintText(t, k).filter((f) => f.level === 'error').map((f) => f.hit);
    assert.ok(errs('이 연수를 통해 AI 여정을 함께 탐험해 보아요!').length >= 3);
    assert.ok(errs('결과를 확인할 수 있습니다.').length);
    assert.ok(errs('QR 코드(Quick Response Code)를 찍어요').length);
    assert.ok(errs('핵심 포인트 🎉').length >= 2);
    assert.deepEqual(errs('교재와 프롬프트를 열어 보세요.'), []);
    assert.deepEqual(lintText('COUNTIFS로 학생별 미제출 횟수를 세세요.'), [], '함수 이름은 장식이 아님');
    assert.ok(lintText('TODAY\'S WORKSHOP').length, '영어 대문자 장식');
    assert.ok(lintText('프롬프트 모음 보기', 'nav').some((f) => f.why.includes('넘음')));
  });
  test('기본 문구(설문 기본 문항·섹션 이름)에 고칠 말투가 없음', () => {
    for (const q of DEFAULT_SURVEY) assert.deepEqual(lintText(q.q).filter((f) => f.level === 'error'), [], q.q);
    for (const d of Object.values(SECTION_DEFS)) { assert.deepEqual(lintText(d.label, 'title').filter((f) => f.level === 'error'), []); if (d.nav) assert.ok([...d.nav].length <= 5, d.nav); }
  });
  test('견본 설계도와 만든 사이트에 고칠 문구가 없음', async () => {
    const { lintBlueprint, lintHtml } = await import('../../scripts/copy-lint.mjs');
    for (const id of ['forest-story', 'data-lab']) {
      assert.deepEqual(lintBlueprint(EX(id)).filter((f) => f.level === 'error'), [], id);
      const r = build(EX(id));
      for (const f of ['index.html', 'console.html', 'screen.html', 'check.html']) assert.deepEqual(lintHtml(r.files[f], f).filter((x) => x.level === 'error'), [], `${id}/${f}`);
    }
  });
  test('AI 프롬프트에 문구 규칙과 새 칸 안내가 들어감', () => {
    const p = buildPrompt({ context: 'x' });
    assert.ok(p.includes('여정') && p.includes('를 통해') && p.includes('goals') && p.includes('followup'));
    assert.ok(COPY_RULES.length >= 10);
  });
});

describe('교재 읽기 보강: 기관 색·강사 줄', () => {
  test('기본 테마 색(Office·Google·Keynote)은 강조색으로 쓰지 않음', async () => {
    const { brandAccent } = await import('../src/ingest/draft.js');
    for (const c of ['#4F81BD', '#4472C4', '#5B9BD5', '#ED7D31', '#A5A5A5', '#FFC000', '#70AD47', '#156082', '#4285F4', '#007AFF']) assert.equal(brandAccent({ accent1: c }), '', c);
    assert.equal(brandAccent({ accent1: '#12306b' }), '#12306B', '기관 색은 씀');
    assert.equal(brandAccent({ accent1: '#808080' }), '', '회색은 뺌');
    const m = ingestText('# 연수\n본문'); m.design = { colors: { accent1: '#4F81BD' } };
    assert.equal(materialToDraft(m).design.accent, undefined);
  });
  test('md·txt의 "강사: 이름(소속)" 줄로 강사를 찾고, 그 줄을 장소로 오해하지 않음', async () => {
    const { parseInstructorLine } = await import('../src/ingest/detect.js');
    assert.deepEqual(parseInstructorLine('홍길동(○○초)'), { name: '홍길동', org: '○○초', role: '' });
    assert.deepEqual(parseInstructorLine('유영재 · 안산양지초등학교 교사'), { name: '유영재', org: '안산양지초등학교', role: '교사' });
    assert.deepEqual(parseInstructorLine('○○초 교사 홍길동'), { name: '홍길동', org: '○○초', role: '교사' });
    assert.equal(parseInstructorLine('실습 → 나눔'), null);
    const d = materialToDraft(ingestText('# 생성형 AI 수업\n일시: 2026. 11. 20.(금) 15:00~17:00\n강사: 홍길동(○○초)\n'), { today: '2026-11-01' });
    assert.equal(d.instructors[0].name, '홍길동');
    assert.deepEqual(d.sections[0].meta.find((x) => x.label === '강사'), { label: '강사', value: '홍길동 · ○○초' });
    const d2 = materialToDraft(ingestText('# 연수\n발표: 유영재 · 안산양지초등학교 교사\n'));
    assert.equal(d2.meta.venue, '', '강사 줄의 학교 이름은 장소가 아님');
  });
});
