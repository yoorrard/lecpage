// 본문 칸 테스트: 글 칸의 마크다운(표·인용·강조 상자), 절차·사례·함께 나눌 질문·표 칸, 날것 기호가 화면에 안 보이는지
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/index.js';
import { nodeRuntime } from '../node.js';
import { validate } from '../src/validate.js';
import { md, inlineMd, tableHtml } from '../src/render/markdown.js';
import { parseBlocks, mdIssues } from '../src/md-syntax.js';
import { SECTION_DEFS } from '../src/schema/sections.js';
import { RENDERERS, LAYOUTS } from '../src/render/sections.js';
import { layoutRuns } from '../../scripts/design-lint.mjs';

const build = (bp) => E.build(bp, { runtime: nodeRuntime() });
/** 화면에 보이는 글자만(태그·스크립트·속성 값 제외) */
const visible = (html) => String(html).replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, '\n').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
/** 참가자 화면에 보이면 안 되는 마크다운 날것: 표 줄(| a |), 구분 줄(|---|), 줄 머리 >, **, ###, ``` */
const RAW = /^\s*\|.*\|\s*$|\|\s*:?-{2,}|^\s*>\s?\S|\*\*|^#{1,6}\s|```|^\s*[-*]\s+\S|^\s*\d+[.)]\s+\S/m;
const section = (bp, id) => new RegExp(`<section id="${id}"[\\s\\S]*?</section>`).exec(build(bp).files['index.html'])?.[0] || '';
const BODY = [
  { id: 'proc', type: 'procedure', title: '대응 절차', lead: '발견한 사람이 1단계부터 시작해요.', items: [{ title: '현장 안전 확보', desc: '2차 사고를 막는다.' }, { title: '보호자 연락', desc: '담임이 전화한다.', time: '10분 이내', who: '담임' }, '기록과 보고'], close: '끝나면 교감에게 알려요.' },
  { id: 'crit', type: 'table', title: '판단 기준', head: ['구분', '기준', '조치'], rows: [['경미', '보건실 처치로 끝남', '보건일지 기록'], ['중대', '3주 이상 입원', '119 이송\n현장 보존']], note: '**가상** 기준이에요.' },
  { id: 'cases', type: 'cases', title: '세 가지 사례', items: [{ title: '민원 전화 뒤의 오후', body: '6년 차 ㄱ 교사는 30분 동안 전화를 받았습니다.', quote: '“제가 뭘 잘못했는지 계속 찾게 되더라고요.”', cite: 'ㄱ 교사' }, { title: '혼자 남은 학년 회의', body: '3년 차 ㄴ 교사는 행사를 혼자 맡았습니다.' }] },
  { id: 'disc', type: 'discuss', title: '함께 나눌 질문', items: ['가장 지쳤던 순간은 언제였나요?', { q: '나를 버티게 한 것은 무엇이었나요?' }], rules: ['4명씩 한 모둠으로 앉습니다.', '조언보다 질문을 먼저 합니다.'] },
  { id: 'txt', type: 'text', title: '서식과 문의', md: '붙임 서식은 두 가지예요.\n\n- 붙임 1. 사고 경위서\n- 붙임 2. 보호자 통지문\n\n| 구분 | 기한 |\n|---|---|\n| 전화 | 10분 이내 |\n| 문자 | 30분 이내 |\n\n> 쉬는 것도 수업 준비입니다.\n> — 한도담\n\n> [!예시] 보호자 통지문\n> ○○ 학생이 발목을 다쳐 병원으로 옮겼습니다.' },
];
const bpWith = (sections, design = {}) => ({ meta: { title: '본문 칸 시험' }, design, sections: [{ type: 'hero' }, ...sections, { type: 'closing', text: '끝' }] });

describe('글 칸의 마크다운', () => {
  test('표: 구분 줄을 그리지 않고 머리글·줄 머리·칸으로 나눔', () => {
    const html = md('| 구분 | 기준 |\n|---|:--:|\n| 경미 | 보건실 |\n| 중대 | 119<br>이송 |');
    assert.match(html, /<table class="lp-tbl" role="table">/);
    assert.match(html, /<th role="columnheader" scope="col">구분<\/th>/);
    assert.match(html, /<th role="rowheader" scope="row">경미<\/th>/);
    assert.match(html, /119<br>이송/, '칸 안 <br>은 줄바꿈');
    assert.ok(!RAW.test(visible(html)), visible(html));
  });
  test('표: 구분 줄이 없어도, 앞뒤 세로줄이 없어도 표로 그림', () => {
    assert.match(md('| 가 | 나 |\n| 1 | 2 |'), /<thead/);
    const loose = md('가 | 나\n--- | ---\n1 | 2');
    assert.match(loose, /<td role="cell">/); assert.ok(!visible(loose).includes('---'));
    assert.match(md('| 혼자 | 한 줄 |'), /<table/, '한 줄짜리도 세로줄을 보이지 않음');
  });
  test('표: 칸 4개까지는 휴대폰에서 줄마다 카드, 5개부터는 가로로 미는 상자(초점 받을 수 있게)', () => {
    assert.match(tableHtml({ head: ['a', 'b'], rows: [['1', '2']] }), /data-mode="cards"/);
    const wide = tableHtml({ head: ['a', 'b', 'c', 'd', 'e'], rows: [['1', '2', '3', '4', '5']], label: '차시표' });
    assert.match(wide, /data-mode="scroll"[^>]*role="region" aria-label="차시표" tabindex="0"/);
    assert.match(tableHtml({ head: ['구분', '기준'], rows: [['경미', '']] }), /<td role="cell" data-empty>/, '빈 칸은 카드에서 숨김');
    assert.equal(tableHtml({ head: ['a'], rows: [] }), '');
  });
  test('인용과 강조 상자', () => {
    const q = md('> 쉬는 것도 수업 준비입니다.\n> — 한도담');
    assert.match(q, /<blockquote class="lp-bq"><p>쉬는 것도 수업 준비입니다\.<\/p><cite>한도담<\/cite><\/blockquote>/);
    const c = md('> [!주의] 꼭 확인\n> 머리를 부딪치면 **반드시** 기록해요.');
    assert.match(c, /<div class="lp-callout" data-kind="warning" role="note">/);
    assert.match(c, /<b>주의<\/b><span>꼭 확인<\/span>/);
    assert.match(c, /<strong>반드시<\/strong>/);
    const ex = md('> [!예시] 통지문\n> ○○ 학생이 다쳤습니다.');
    assert.match(ex, /data-copy-text="○○ 학생이 다쳤습니다\."/, '예시 상자에는 복사 버튼');
    assert.match(md('> [!NOTE]\n> 영어 이름도 받음'), /data-kind="note"/);
  });
  test('목록·소제목·가로줄·코드: 기호가 화면에 남지 않음', () => {
    const html = md('## 제목\n\n- 가\n  - 가1\n- 나\n\n1. 하나\n2. 둘\n\n---\n\n```\na | b\n```\n\n#### 작은 제목\n~~지움~~ __굵게__');
    assert.match(html, /<h3>제목<\/h3>/); assert.match(html, /<ul><li>가<ul><li>가1<\/li><\/ul><\/li><li>나<\/li><\/ul>/);
    assert.match(html, /<ol><li>하나<\/li><li>둘<\/li><\/ol>/); assert.match(html, /<hr>/); assert.match(html, /<pre class="lp-pre"><code>a \| b<\/code><\/pre>/);
    assert.match(html, /<h4>작은 제목<\/h4>/); assert.match(html, /<s>지움<\/s> <strong>굵게<\/strong>/);
  });
  test('줄 안: 링크는 안전한 주소만, 주소만 적어도 눌리고, 태그는 글자로', () => {
    assert.match(inlineMd('[안내](https://a.example/x?b=1&c=2)'), /<a href="https:\/\/a\.example\/x\?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">안내<\/a>/);
    assert.equal(inlineMd('[나쁜](javascript:alert(1))'), '나쁜)');
    assert.match(inlineMd('자료실: https://a.example/new2027.'), /<a href="https:\/\/a\.example\/new2027"[^>]*>https:\/\/a\.example\/new2027<\/a>\./);
    assert.equal(inlineMd('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
    assert.equal(inlineMd('![그림 설명](a.png) 뒤'), '그림 설명 뒤');
  });
  test('여러 가지를 섞어도 날것 기호가 보이지 않음', () => {
    const nasty = [
      '| 구분 | 기준 |\n|---|---|\n| 경미 | 보건실 |\n\n> 인용\n\n**굵게**',
      '>인용 붙여 씀\n>둘째 줄',
      '| a | b |\n|:--|--:|\n| 1 | 2 |\n| 3 |',
      '### 제목\n> [!TIP] 팁\n> - 목록\n> - 둘',
      '1) 하나\n2) 둘\n\n* 별표 목록\n* 둘',
      '```js\nconst a = 1;\n```\n끝',
      '> > 겹친 인용',
    ];
    for (const src of nasty) assert.ok(!RAW.test(visible(md(src))), `${JSON.stringify(src)} → ${visible(md(src))}`);
  });
  test('parseBlocks: 블록 종류', () => {
    assert.deepEqual(parseBlocks('문단\n\n- 가\n\n| a |\n|---|\n| 1 |\n\n> 인용\n\n> [!중요]\n> 본문').map((b) => b.type), ['p', 'ul', 'table', 'quote', 'callout']);
  });
});

describe('검증: 그리지 못하는 문법과 새 칸', () => {
  test('글 칸·FAQ 답의 HTML 태그·그림·각주·체크 상자는 주의로 알림', () => {
    assert.deepEqual(mdIssues('<b>굵게</b> ![그림](a.png) 각주[^1]\n- [ ] 할 일').map((x) => x.code), ['html', 'image', 'footnote', 'task']);
    assert.deepEqual(mdIssues('줄바꿈<br>은 됨\n\n```\n<b>코드 안</b>\n```\n`<i>`'), []);
    const r = validate(bpWith([{ type: 'text', title: '글', md: '<div>상자</div>' }, { type: 'faq', items: [{ q: '질문', a: '![그림](x.png)' }] }]));
    const mdw = r.warnings.filter((w) => w.kind === 'md');
    assert.equal(mdw.length, 2);
    assert.match(mdw[0].message_ko, /"글": HTML 태그/); assert.match(mdw[1].path, /items\[0\]\.a/);
  });
  test('절차·사례·질문·표: 글자만 적은 항목도 받고, 빈 칸은 뺌', () => {
    const { blueprint: b, warnings } = validate(bpWith([...BODY, { type: 'table', title: '빈 표', head: ['a'], rows: [] }, { type: 'text', title: '빈 글', md: ' ' }]));
    const get = (t) => b.sections.find((s) => s.type === t);
    assert.deepEqual(get('procedure').items.map((i) => i.title), ['현장 안전 확보', '보호자 연락', '기록과 보고']);
    assert.equal(get('procedure').items[1].time, '10분 이내'); assert.equal(get('procedure').items[1].who, '담임');
    assert.deepEqual(get('discuss').items, ['가장 지쳤던 순간은 언제였나요?', '나를 버티게 한 것은 무엇이었나요?']);
    assert.equal(get('cases').items.length, 2);
    assert.deepEqual(get('table').head, ['구분', '기준', '조치']);
    assert.equal(b.sections.filter((s) => s.type === 'table').length, 1);
    assert.ok(!b.sections.some((s) => s.title === '빈 글'));
    assert.equal(warnings.filter((w) => /내용이 없어 뺐어요/.test(w.message_ko)).length, 2);
    for (const t of ['procedure', 'cases', 'discuss', 'table']) { assert.ok(SECTION_DEFS[t].label); assert.equal(typeof RENDERERS[t], 'function'); assert.ok(LAYOUTS[t]); }
  });
  test('위험한 값은 이스케이프됨', () => {
    const X = '<img src=x onerror=alert(1)>';
    const html = build(bpWith([{ type: 'procedure', title: X, items: [{ title: X, desc: X, time: X, who: X }] }, { type: 'cases', items: [{ title: X, body: X, quote: X, cite: X }] }, { type: 'discuss', items: [X], rules: [X] }, { type: 'table', head: [X], rows: [[X]], note: X }, { type: 'text', md: `${X}\n\n| ${X} |\n|---|\n| ${X} |\n\n> ${X}\n\n> [!예시] ${X}\n> ${X}` }])).files['index.html'];
    assert.ok(!/<img src=x/.test(html));
  });
});

describe('본문 칸 그리기', () => {
  test('절차: 번호 단계, 시간·담당은 있을 때만', () => {
    const html = section(bpWith(BODY), 'proc');
    assert.match(html, /data-layout="procedure" data-frame="split"/);
    assert.equal((html.match(/<li style="--i:/g) || []).length, 3);
    assert.match(html, /<h3>보호자 연락<\/h3><p>담임이 전화한다\.<\/p><\/div><p class="lp-proc-meta"><span><span class="lp-sr">시간 <\/span>10분 이내<\/span><span><span class="lp-sr">담당 <\/span>담임<\/span><\/p>/);
    assert.ok(!/현장 안전 확보[\s\S]{0,80}lp-proc-meta/.test(html.split('보호자 연락')[0]));
  });
  test('사례: 제목·본문·인용(따옴표는 꾸밈이라 값에서 뗌)', () => {
    const html = section(bpWith(BODY), 'cases');
    assert.match(html, /<blockquote class="lp-bq"><p>제가 뭘 잘못했는지 계속 찾게 되더라고요\.<\/p><cite>ㄱ 교사<\/cite><\/blockquote>/);
    assert.equal((html.match(/<article class="lp-case">/g) || []).length, 2);
  });
  test('함께 나눌 질문: 질문 목록과 진행 규칙', () => {
    const html = section(bpWith(BODY), 'disc');
    assert.match(html, /<ol class="lp-discuss-q"/); assert.match(html, /<h3>진행 규칙<\/h3><ul><li>4명씩 한 모둠으로 앉습니다\.<\/li>/);
    assert.match(section(bpWith([{ id: 'd2', type: 'discuss', items: ['하나?'] }]), 'd2'), /class="lp-discuss is-solo"/);
  });
  test('표 칸: 제목이 표 이름, 설명은 아래', () => {
    const html = section(bpWith(BODY), 'crit');
    assert.match(html, /<table class="lp-tbl" role="table" aria-label="판단 기준">/);
    assert.match(html, /119 이송<br>현장 보존/); assert.match(html, /<p class="lp-note"><strong>가상<\/strong> 기준이에요\.<\/p>/);
  });
  test('글 칸이 이어지면 틀을 번갈아 써서 같은 배치가 셋 이어지지 않음', () => {
    const three = bpWith([1, 2, 3, 4].map((n) => ({ id: `t${n}`, type: 'text', title: `글 ${n}`, md: `문단 ${n}` })));
    const html = build(three).files['index.html'];
    assert.deepEqual([1, 2, 3, 4].map((n) => /data-frame="(\w+)"/.exec(section(three, `t${n}`))[1]), ['split', 'stack', 'split', 'stack']);
    assert.ok(layoutRuns(html).max < 3, JSON.stringify(layoutRuns(html)));
  });
  test('모든 디자인 프리셋에서 본문 칸이 그려지고 날것 기호가 없음', () => {
    for (const p of E.PRESET_IDS) {
      const r = build(bpWith(BODY, { preset: p }));
      assert.equal(r.errors.length, 0, p);
      const html = r.files['index.html'];
      const main = /<main[\s\S]*<\/main>/.exec(html)[0];
      for (const id of ['proc', 'crit', 'cases', 'disc', 'txt']) assert.ok(main.includes(`<section id="${id}"`), `${p} ${id}`);
      const body = BODY.map((s) => section(bpWith(BODY, { preset: p }), s.id)).join('\n');
      assert.ok(!RAW.test(visible(body)), `${p}: ${RAW.exec(visible(body))?.[0]}`);
    }
  });
  test('런타임 CSS에 본문 칸 묶음이 있고 한쪽 색 띠·알약을 쓰지 않음', () => {
    const css = nodeRuntime().read('lecpage.css');
    const part = css.slice(css.indexOf('본문 칸: 절차(procedure)'));
    for (const c of ['.lp-proc', '.lp-case', '.lp-bq', '.lp-discuss-q', '.lp-tbl-wrap[data-mode="cards"]', '.lp-callout', '@media print']) assert.ok(part.includes(c), c);
    assert.ok(!/border-left:\s*\d/.test(part)); assert.ok(!/border-radius:\s*999/.test(part));
  });
});
