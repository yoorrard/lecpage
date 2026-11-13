// 항목 고치기: 섹션 종류마다 '무엇을 어떤 입력으로 고칠지' 적은 표(SPEC)를 보고 그리는 편집기.
// 글자 수 제한은 엔진 validate.js와 같게, 주소는 엔진 safeUrl로 확인합니다(안전한 주소만 설계도에 넣음).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { E } from '../lib/engine.js';
import { toast } from '../lib/util.js';
import './ItemEditor.css';

// ── 입력 종류: text · textarea · url · time · date · number · select · boolean · tags(쉼표) · lines(한 줄에 하나) · list ──
const text = (key, label, max, o) => ({ key, label, kind: 'text', max, ...o });
const area = (key, label, max, o) => ({ key, label, kind: 'textarea', max, rows: 2, ...o });
const link = (key, label, o) => ({ key, label, kind: 'url', ph: 'https://', ...o });
const time = (key, label) => ({ key, label, kind: 'time', short: true });
const day = (key, label) => ({ key, label, kind: 'date', short: true });
const count = (key, label, min, max, o) => ({ key, label, kind: 'number', min, max, short: true, ...o });
const choose = (key, label, options, o) => ({ key, label, kind: 'select', options, short: true, ...o });
const tags = (key, label, each, limit, o) => ({ key, label, kind: 'tags', each, limit, ph: '쉼표로 나눠 써요', ...o });
const lines = (key, label, each, limit, o) => ({ key, label, kind: 'lines', each, limit, rows: 3, ...o });
const list = (key, label, o) => ({ key, label, kind: 'list', ...o });
const grid = (key, label, o) => ({ key, label, kind: 'grid', ...o }); // 표: 첫 줄은 머리글, 칸은 | 로 나눔

const txt = (v) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const has = (v) => !!txt(v).trim();
const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 6)}`;
const firstLine = (v) => txt(v).split('\n')[0];
const safe = (v) => (has(v) ? E.safeUrl(v) : '');
const host = (v) => { const u = safe(v); if (!/^https?:/.test(u)) return u.startsWith('#') ? u : ''; try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };
const fileName = (v) => txt(v).split(/[/?#]/).filter(Boolean).pop() || '';
// 엔진과 같은 방식으로 시각·날짜를 읽음(입력 칸에 맞는 모양으로)
const clock = (v) => { const m = /^(\d{1,2}):(\d{2})/.exec(txt(v)); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''; };
const isoDate = (v) => { const m = /^(\d{4})[-./ ]\s*(\d{1,2})[-./ ]\s*(\d{1,2})/.exec(txt(v)); return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : ''; };
const shortDate = (v) => { const d = isoDate(v); return d ? `${+d.slice(5, 7)}.${+d.slice(8)}` : ''; };
const label = (opts, v) => (opts.find(([k]) => k === v) || [])[1] || '';

const LEAD = area('lead', '안내 문장', 300);
const LEAD_IF = { ...LEAD, when: (s) => s.lead !== undefined }; // 안내 문장을 잘 안 쓰는 섹션: 이미 있을 때만
const LINKS = list('links', '링크', { noun: '링크', pair: true, limit: 10, item: [text('label', '이름', 80, { alias: 'title', ph: '이름' }), link('url', '주소', { alias: 'href' })], make: () => ({ label: '', url: '' }) });
const POLL_KINDS = [['choice', '하나 고르기'], ['word', '워드클라우드'], ['scale', '1~5점']];
const STYLES = [['statement', '문장'], ['formula', '공식'], ['quote', '인용']];
const STATUS = [['', '자동'], ['done', '마침'], ['now', '진행 중'], ['next', '다음']];
const FOLLOW = [['', '자동'], ['recording', '다시 보기'], ['community', '소통방'], ['next', '다음 연수'], ['read', '읽을거리'], ['link', '링크']];

/**
 * 섹션 종류별 고칠 값. 목록(list)은 of:'text'면 글 한 줄짜리, 아니면 item(필드 표)을 가진 항목.
 * limit·each·max는 validate.js의 slice·str 길이와 같음. ok는 사이트에 보일 조건(엔진이 빈 항목을 뺌).
 */
export const SPEC = {
  hero: [
    text('eyebrow', '작은 제목', 80, { ph: '비우면 주최 기관이 보여요' }),
    list('ctas', '버튼', { limit: 3, empty: '비워 두면 알아서 골라요.', item: [text('label', '이름', 30, { ph: '예: 일정 보기' }), link('href', '주소', { ph: '이동할 섹션 또는 https://', anchors: true })], make: () => ({ label: '', href: '' }), sum: (x) => x.label, meta: (x) => x.href, ok: (x) => has(x.label) }),
  ],
  message: [
    choose('style', '모양', STYLES, { def: 'statement' }),
    list('parts', '공식', { of: 'text', each: 30, limit: 6, ph: (i) => `낱말 ${i + 1}`, when: (s) => s.style === 'formula' }),
    text('result', '결과', 40, { ph: '예: 살아 있는 교과서', when: (s) => s.style === 'formula' }),
    area('text', '문장', 600, { rows: 3, ph: '핵심 메시지를 한 문장으로' }),
    text('cite', '출처', 80, { ph: '예: 레이첼 카슨', when: (s) => s.style === 'quote' }),
  ],
  closing: [
    area('lead', '앞 문장', 200, { ph: '예: 나무 한 그루를 오래 바라본 아이는' }),
    area('text', '문장', 200, { ph: '비우면 연수명이 보여요' }),
    text('thanks', '인사', 200, { ph: '예: 함께해 주셔서 감사합니다.' }),
  ],
  goals: [
    LEAD,
    list('items', '목표', { of: 'text', each: 120, limit: 6, ph: '예: 내일 바로 쓸 활동을 하나 고를 수 있어요' }),
    text('who', '대상', 160, { ph: '예: AI를 처음 써 보는 실무자' }),
  ],
  glance: [
    LEAD_IF,
    list('items', '숫자', { limit: 8, item: [text('value', '숫자', 20, { short: true, ph: '예: 90분' }), text('label', '이름', 40, { short: true, ph: '예: 연수 시간' }), text('note', '설명', 80)], make: () => ({ value: '', label: '', note: '' }), sum: (x) => [x.value, x.label].filter(has).join(' '), ok: (x) => has(x.value) }),
  ],
  steps5: [
    area('lead', '안내 문장', 200),
    list('items', '단계', { limit: 8, item: [text('word', '낱말', 20, { alias: 'title', ph: '예: 멈추기' }), text('desc', '설명', 120)], make: () => ({ word: '', desc: '' }), sum: (x) => x.word ?? x.title, ok: (x) => has(x.word ?? x.title) }),
    text('close', '맺는 말', 200),
  ],
  outline: [
    LEAD,
    list('items', '차례', { limit: 8, item: [text('part', '구분', 20, { short: true, ph: (i) => `PART ${i + 1}` }), text('title', '제목', 80), area('desc', '설명', 200), tags('tags', '태그', 20, 6)], make: () => ({ part: '', title: '', desc: '', tags: [] }), sum: (x) => x.title, meta: (x, i) => x.part || `PART ${i + 1}`, ok: (x) => has(x.title) }),
  ],
  schedule: [
    LEAD_IF,
    list('items', '일정', { item: [time('start', '시작'), time('end', '끝'), text('part', '구분', 20, { short: true, ph: '예: 1부' }), text('title', '제목', 100, { ph: '예: 여는 이야기' }), text('desc', '설명', 200)],
      make: (items) => ({ start: clock(items[items.length - 1]?.end), end: '', title: '', desc: '' }), // 앞 일정이 끝난 시각부터
      sum: (x) => x.title, meta: (x) => (clock(x.start) ? clock(x.start) + (clock(x.end) ? `~${clock(x.end)}` : '') : ''), ok: (x) => has(x.title) }),
  ],
  readiness: [
    LEAD,
    list('items', '할 일', { item: [text('label', '할 일', 120, { alias: 'title', ph: '예: 개인 구글 계정으로 로그인' }), area('detail', '설명', 300), link('url', '주소')], make: () => ({ label: '', detail: '', url: '' }), sum: (x) => x.label ?? x.title, meta: (x) => host(x.url), ok: (x) => has(x.label ?? x.title) }),
    list('checks', '접속 확인', { limit: 20, item: [text('name', '이름', 40, { ph: '예: Gemini' }), link('url', '주소')], make: () => ({ name: '', url: '' }), sum: (x) => x.name || host(x.url), meta: (x) => host(x.url), ok: (x) => !!safe(x.url) }),
  ],
  deck: [
    LEAD,
    list('slides', '쪽', { fixed: true, item: [text('title', '제목', 120), area('text', '내용', 1500, { rows: 3 })], no: (x, i) => x.page ?? i + 1, sum: (x) => x.title || firstLine(x.text) }),
    area('notice', '참고', 400),
  ],
  stations: [
    LEAD,
    list('items', '실습', { limit: 60, item: [
      text('name', '목차 이름', 30, { ph: '예: 첫 대화' }),
      text('title', '제목', 100),
      area('desc', '설명', 400, { alias: 'sub' }),
      lines('steps', '단계', 500, 20, { ph: '한 줄에 하나씩 써요' }),
      list('prompts', '프롬프트', { noun: '프롬프트', limit: 12, item: [text('title', '이름', 80, { ph: '프롬프트 이름' }), area('text', '내용', 4000, { rows: 3, ph: '복사해서 쓸 프롬프트' })], make: () => ({ title: '', text: '' }) }),
      LINKS,
      text('outcome', '확인 문장', 300, { alias: 'out', ph: '예: 내 계정으로 첫 대화를 시작했어요' }),
      count('minutes', '시간(분)', 0, 600),
    ], make: () => ({ id: uid('st'), name: '', title: '', steps: [], prompts: [], outcome: '' }), sum: (x) => x.name || x.title, meta: (x) => (x.steps?.length ? `단계 ${x.steps.length}` : ''), ok: (x) => has(x.title) || has(x.name) }),
  ],
  tools: [
    LEAD,
    list('items', '도구', { item: [text('name', '이름', 40, { ph: '예: Gemini' }), link('url', '주소'), area('desc', '설명', 200)], make: () => ({ name: '', url: '', desc: '' }), sum: (x) => x.name, meta: (x) => host(x.url), ok: (x) => has(x.name) }),
    area('notice', '참고', 300),
  ],
  prompts: [
    LEAD,
    list('items', '프롬프트', { item: [text('title', '제목', 80, { ph: '예: 아이디어 얻기' }), area('text', '프롬프트', 4000, { rows: 4 }), tags('tags', '태그', 20, 6)], make: () => ({ title: '', text: '', tags: [] }), sum: (x) => x.title || firstLine(x.text), ok: (x) => has(x.text) }),
  ],
  qa: [LEAD],
  board: [
    LEAD,
    list('categories', '분류', { inline: true, limit: 6, item: [text('label', '이름', 20, { ph: '예: 결과물' })], make: () => ({ id: uid('c'), label: '' }) }),
    link('externalUrl', '외부 보드', { ph: '예: https://padlet.com/…', hint: '참여 기능을 안 쓸 때 이 주소를 열어요.' }),
  ],
  poll: [
    LEAD_IF,
    list('items', '질문', { limit: 20, item: [
      text('question', '질문', 200, { ph: '예: 오늘 연수를 한 낱말로 말하면?' }),
      choose('kind', '방식', POLL_KINDS, { def: 'choice', also: (v, x) => (v === 'choice' && !(x.options || []).some(has) ? { options: ['', ''] } : null) }),
      list('options', '보기', { of: 'text', each: 60, limit: 10, noun: '보기', ph: (i) => `보기 ${i + 1}`, when: (x) => (x.kind || 'choice') === 'choice' }),
    ], make: () => ({ id: uid('q'), question: '', kind: 'choice', options: ['', ''] }), sum: (x) => x.question, meta: (x) => label(POLL_KINDS, x.kind || 'choice'), ok: (x) => has(x.question) }),
  ],
  quiz: [
    LEAD,
    list('items', '문제', { limit: 30, item: [
      area('q', '질문', 300, { alias: 'question' }),
      list('options', '보기', { of: 'text', each: 120, limit: 6, min: 2, noun: '보기', answer: 'answer', ph: (i) => `보기 ${i + 1}`, hint: '○를 눌러 정답을 골라요.' }),
      area('explain', '해설', 400, { ph: '답을 고르면 보여요' }),
    ], make: () => ({ q: '', options: ['', ''], answer: 0, explain: '' }), sum: (x) => firstLine(x.q ?? x.question), ok: (x) => has(x.q ?? x.question) && (x.options || []).filter(has).length >= 2 }),
  ],
  materials: [
    LEAD,
    list('items', '자료', { item: [text('title', '이름', 100, { ph: '예: 연수 교재' }), link('href', '주소', { alias: 'url' }), area('desc', '설명', 300), text('kind', '종류', 12, { short: true, ph: '예: PDF' }), text('size', '크기', 20, { short: true, ph: '예: 2MB' })], make: () => ({ title: '', href: '', desc: '' }), sum: (x) => x.title, meta: (x) => txt(x.kind).toUpperCase() || host(x.href ?? x.url), ok: (x) => has(x.title) }),
    area('notice', '이용 안내', 500),
  ],
  instructor: [LEAD],
  speakers: [
    LEAD_IF,
    list('items', '연사', { item: [text('name', '이름', 40), text('org', '소속', 60, { short: true }), text('role', '직함', 60, { short: true }), text('talk', '발표', 120), text('time', '시간', 20, { short: true, ph: '예: 14:00' }), link('photo', '사진 주소')], make: () => ({ name: '', org: '', role: '', talk: '' }), sum: (x) => x.name, meta: (x) => x.org, ok: (x) => has(x.name) }),
  ],
  sessions: [
    LEAD_IF,
    list('items', '차시', { item: [count('no', '번호', 1, 999, { ph: (i) => String(i + 1) }), day('date', '날짜'), choose('status', '상태', STATUS, { def: '' }), text('title', '제목', 120), area('desc', '설명', 300), LINKS], make: () => ({ date: '', title: '', desc: '', links: [] }), no: (x, i) => x.no || i + 1, sum: (x) => x.title, meta: (x) => shortDate(x.date), ok: (x) => has(x.title) }),
  ],
  followup: [
    LEAD,
    list('items', '안내', { limit: 12, item: [text('title', '제목', 80, { alias: 'label', ph: '예: 다시 보기 영상' }), link('url', '주소', { alias: 'href' }), area('desc', '설명', 200), choose('kind', '종류', FOLLOW, { def: '' })], make: () => ({ title: '', url: '', desc: '' }), sum: (x) => x.title ?? x.label, meta: (x) => label(FOLLOW, x.kind || ''), ok: (x) => has(x.title ?? x.label) && (!!safe(x.url ?? x.href) || has(x.desc)) }),
    area('completion', '이수 안내', 300),
  ],
  faq: [
    LEAD_IF,
    list('items', '질문', { item: [text('q', '질문', 200, { ph: '예: 자료는 어디서 받나요?' }), area('a', '답', 1200, { rows: 3 })], make: () => ({ q: '', a: '' }), sum: (x) => x.q, ok: (x) => has(x.q) && has(x.a) }),
  ],
  glossary: [
    LEAD_IF,
    list('items', '용어', { item: [text('term', '용어', 60), area('desc', '설명', 400)], make: () => ({ term: '', desc: '' }), sum: (x) => x.term, ok: (x) => has(x.term) }),
  ],
  video: [
    LEAD_IF,
    list('items', '영상', { item: [text('title', '제목', 120), link('url', '주소', { ph: 'https://www.youtube.com/…' }), text('length', '길이', 12, { short: true, ph: '예: 12:30' }), link('thumb', '썸네일')], make: () => ({ title: '', url: '' }), sum: (x) => x.title || host(x.url), meta: (x) => x.length, ok: (x) => !!safe(x.url) }),
  ],
  gallery: [
    LEAD_IF,
    list('items', '사진', { item: [link('src', '사진 주소'), text('caption', '설명', 160)], make: () => ({ src: '', caption: '' }), sum: (x) => x.caption || fileName(x.src), ok: (x) => !!safe(x.src) }),
  ],
  reflection: [
    LEAD,
    list('prompts', '질문', { of: 'text', each: 200, limit: 8, ph: '예: 오늘 가장 기억에 남는 것', empty: '비워 두면 기본 질문이 나와요.' }),
  ],
  attendance: [LEAD],
  text: [area('md', '본문', 6000, { rows: 8, ph: '여기에 글을 써요.', hint: '**굵게** · - 목록 · | 표 | · > 인용 · > [!참고] 상자 · [링크](https://…)' })],
  procedure: [
    LEAD,
    list('items', '단계', { limit: 20, norm: (x) => (typeof x === 'string' ? { title: x } : x), item: [text('title', '단계', 160, { ph: '예: 담당자에게 연락하기' }), area('desc', '설명', 500), text('time', '시간', 24, { short: true, ph: '예: 10분 이내' }), text('who', '담당', 40, { short: true, ph: '예: 담임' })],
      make: () => ({ title: '', desc: '', time: '', who: '' }), sum: (x) => x.title, meta: (x) => [x.time, x.who].filter(has).join(' · '), ok: (x) => has(x.title) }),
    area('close', '맺는 말', 300),
  ],
  cases: [
    LEAD_IF,
    list('items', '사례', { limit: 12, norm: (x) => (typeof x === 'string' ? { body: x } : x), item: [text('title', '제목', 100), area('body', '본문', 1200, { rows: 3 }), area('quote', '인용', 300, { ph: '사례 속 사람의 말' }), text('cite', '말한 사람', 60, { short: true })],
      make: () => ({ title: '', body: '', quote: '', cite: '' }), sum: (x) => x.title || firstLine(x.body), ok: (x) => has(x.title) || has(x.body) || has(x.quote) }),
  ],
  discuss: [
    LEAD,
    list('items', '질문', { of: 'text', each: 240, limit: 12, ph: '예: 가장 기억에 남는 순간은 언제였나요?' }),
    list('rules', '진행 규칙', { of: 'text', each: 200, limit: 8, ph: '예: 4명씩 한 모둠으로 앉아요', empty: '비워 두면 질문만 보여요.' }),
    area('note', '참고', 300),
  ],
  table: [
    LEAD_IF,
    grid('rows', '표 내용', { hint: '첫 줄은 머리글이에요. 칸은 | 로 나누고, 줄을 바꾸면 표의 다음 줄이 돼요.' }),
    area('note', '설명', 400),
  ],
};

export const hasItemEditor = (type) => !!SPEC[type];

/**
 * 되돌리기 한 묶음: 입력 칸에 들어오면 준비(arm), 처음 바뀔 때 한 번만 저장(touch).
 * 더하기·빼기·옮기기처럼 한 번에 끝나는 일은 바로 저장(now). 글자마다 쌓이지 않게.
 */
export function useUndoBurst(pushUndo, base = '') {
  const st = useRef({ armed: false });
  st.current.push = pushUndo; st.current.base = base;
  return useMemo(() => ({
    arm() { st.current.armed = true; },
    touch() { if (!st.current.armed) return; st.current.armed = false; st.current.push?.(`${st.current.base} 고치기`.trim()); },
    now(what = '고치기') { st.current.armed = false; st.current.push?.(`${st.current.base} ${what}`.trim()); },
  }), []);
}
const NO_UNDO = { arm() {}, touch() {}, now() {} };
const isTyping = (el) => /^(INPUT|TEXTAREA)$/.test(el?.tagName) && !/^(checkbox|radio)$/.test(el.type);

/** 섹션 하나의 내용 고치기. set(patch)는 섹션에 합쳐 넣음 */
export function ItemEditor({ s, set, u, anchors = [] }) {
  const spec = SPEC[s?.type];
  if (!spec) return null;
  const ctx = { u: u || NO_UNDO, anchors };
  return (
    <div class="ie" onFocusCapture={(e) => { if (isTyping(e.target)) ctx.u.arm(); }}>
      <Fields fields={spec} obj={s} patch={set} ctx={ctx} depth={0} />
    </div>
  );
}

const read = (obj, f) => { const v = obj?.[f.key]; return v === undefined && f.alias ? obj?.[f.alias] : v; };
const write = (f, v) => (f.alias ? { [f.key]: v, [f.alias]: undefined } : { [f.key]: v });

/** 필드 표대로 그림. 짧은 값(시각·숫자·고르기)은 한 줄에 나란히 */
function Fields({ fields, obj, patch, ctx, depth, idx = 0, bare = false }) {
  const out = []; let row = [];
  const flush = () => { if (row.length) out.push(<div class="ie-short" key={`row-${row[0].key}`}>{row}</div>); row = []; };
  for (const f of fields) {
    if (f.when && !f.when(obj || {})) continue;
    const el = <Control key={f.key} f={f} obj={obj} patch={patch} ctx={ctx} depth={depth} idx={idx} bare={bare} />;
    if (f.short && !bare) row.push(el); else { flush(); out.push(el); }
  }
  flush();
  return out;
}

function Control({ f, obj, patch, ctx, depth, idx, bare }) {
  const { u } = ctx;
  const v = read(obj, f);
  const put = (val, extra) => { u.touch(); patch({ ...write(f, val), ...(extra || {}) }); };
  const ph = typeof f.ph === 'function' ? f.ph(idx, obj) : f.ph;
  const a = { class: 'input', placeholder: ph, 'aria-label': bare ? f.label : undefined };
  if (f.kind === 'list') return <List f={f} value={v} parent={obj} onChange={put} ctx={ctx} depth={depth} />;
  if (f.kind === 'grid') return <GridField f={f} obj={obj} onChange={(p) => { u.touch(); patch(p); }} />;
  if (f.kind === 'url') return <UrlField f={f} value={txt(v)} onChange={put} ctx={ctx} bare={bare} a={a} />;
  if (f.kind === 'boolean') {
    const on = f.def ? v !== false : !!v;
    return <label class="check ie-check"><input type="checkbox" checked={on} onChange={(e) => { u.now(); put(e.currentTarget.checked); }} /><span>{f.label}</span></label>;
  }
  let input;
  if (f.kind === 'textarea') input = <Area {...a} rows={f.rows} maxLength={f.max} value={txt(v)} onInput={(e) => put(e.currentTarget.value)} />;
  else if (f.kind === 'time') input = <input {...a} type="time" value={clock(v)} onInput={(e) => put(e.currentTarget.value)} />;
  else if (f.kind === 'date') input = <input {...a} type="date" value={isoDate(v)} onInput={(e) => put(e.currentTarget.value)} />;
  else if (f.kind === 'number') input = <input {...a} type="number" inputMode="numeric" min={f.min} max={f.max} value={v ?? ''} onInput={(e) => { const t = e.currentTarget.value; put(t === '' ? undefined : Number(t)); }} />;
  else if (f.kind === 'select') input = <select {...a} value={v ?? f.def ?? ''} onChange={(e) => { u.now(); const val = e.currentTarget.value; put(val, f.also?.(val, obj || {})); }}>{f.options.map(([k, t]) => <option value={k}>{t}</option>)}</select>;
  else if (f.kind === 'tags') {
    const parse = (t) => t.split(/[,，、]/).map((x) => x.trim().slice(0, f.each)).filter(Boolean).slice(0, f.limit);
    input = <Draft {...a} value={Array.isArray(v) ? v.join(', ') : ''} maxLength={f.limit * (f.each + 2)} parse={parse} onChange={put} />;
  } else if (f.kind === 'lines') {
    const parse = (t) => t.split('\n').map((x) => x.trim().slice(0, f.each)).filter(Boolean).slice(0, f.limit);
    input = <Draft {...a} area rows={f.rows} value={Array.isArray(v) ? v.join('\n') : ''} maxLength={f.limit * (f.each + 1)} parse={parse} onChange={put} />;
  } else input = <input {...a} type="text" maxLength={f.max} value={txt(v)} onInput={(e) => put(e.currentTarget.value)} />;
  if (bare) return input;
  return <label class="field ie-f"><span>{f.label}</span>{input}{f.hint && <small>{f.hint}</small>}</label>;
}

/** 글이 늘면 함께 길어지는 글상자 */
function Area({ value, rows = 2, ...rest }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const el = ref.current; if (!el || !el.scrollHeight) return;
    el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return <textarea ref={ref} rows={rows} value={value} {...rest} />;
}

/** 쉼표·줄로 나누는 값: 쓰는 동안은 쓴 그대로 두고(쉼표·빈 줄이 사라지지 않게), 설계도에는 나눈 목록을 넣음 */
function Draft({ value, parse, onChange, area, ...rest }) {
  const [draft, setDraft] = useState(value);
  const typing = useRef(false);
  useEffect(() => { if (!typing.current) setDraft(value); }, [value]);
  const El = area ? Area : 'input';
  return <El {...rest} value={draft} onFocus={() => { typing.current = true; }} onBlur={() => { typing.current = false; setDraft(value); }} onInput={(e) => { const t = e.currentTarget.value; setDraft(t); onChange(parse(t)); }} />;
}

const cellsOf = (line) => { let t = line.trim(); if (t.startsWith('|')) t = t.slice(1); if (t.endsWith('|')) t = t.slice(0, -1); return t.split('|').map((c) => c.trim().slice(0, 400)).slice(0, 8); };
const rowText = (r) => (Array.isArray(r) ? r : []).map((c) => txt(c).replace(/\n/g, '<br>')).join(' | ');
/** 표(머리글 + 줄): 글상자 하나로 고침. 첫 줄이 머리글(head), 나머지가 줄(rows). 칸 안 줄바꿈은 <br> */
function GridField({ f, obj, onChange }) {
  const value = [rowText(obj?.head), ...(Array.isArray(obj?.rows) ? obj.rows : []).map(rowText)].join('\n');
  const parse = (t) => { const ls = t.split('\n'); return { head: cellsOf(ls[0] || '').map((c) => c.slice(0, 60)), rows: ls.slice(1).filter((l) => l.trim()).slice(0, 60).map(cellsOf) }; };
  const [draft, setDraft] = useState(value);
  const typing = useRef(false);
  useEffect(() => { if (!typing.current) setDraft(value); }, [value]);
  return (
    <label class="field ie-f"><span>{f.label}</span>
      <Area class="input ie-grid" rows={5} value={draft} placeholder={'구분 | 기준 | 조치\n경미 | 보건실 처치 | 보건일지 기록'} spellcheck={false}
        onFocus={() => { typing.current = true; }} onBlur={() => { typing.current = false; setDraft(value); }}
        onInput={(e) => { const t = e.currentTarget.value; setDraft(t); onChange(parse(t)); }} />
      {f.hint && <small>{f.hint}</small>}
    </label>
  );
}

const blankUrl = (t) => !t || /^https?:\/\/$/i.test(t);
const BAD_SCHEME = /^\s*(javascript|data|vbscript|file|blob):/i;

/** 주소: 엔진 safeUrl을 통과한 값만 설계도에 넣고, 아니면 작은 오류를 보여 줌(javascript: 등은 절대 넣지 않음) */
function UrlField({ f, value, onChange, ctx, bare, a }) {
  const [draft, setDraft] = useState(value);
  const [done, setDone] = useState(true); // 다 쓴 뒤에만 오류 표시
  const typing = useRef(false);
  useEffect(() => { if (!typing.current) setDraft(value); }, [value]);
  const listId = useMemo(() => (f.anchors ? uid('ie-dl') : null), []);
  const t = draft.trim();
  const ok = blankUrl(t) ? '' : E.safeUrl(t);
  const err = done && !blankUrl(t) && !ok ? (BAD_SCHEME.test(t) ? '이 주소는 쓸 수 없어요.' : '주소를 확인해 주세요.') : '';
  const onInput = (e) => {
    const x = e.currentTarget.value; setDraft(x); setDone(false);
    const y = x.trim(); const next = blankUrl(y) || !E.safeUrl(y) ? '' : y;
    if (next !== value) onChange(next);
  };
  const onBlur = () => {
    typing.current = false; setDone(true);
    // gemini.google.com처럼 앞부분 없이 쓴 주소는 https://를 붙여 둠
    if (ok && ok !== t && !/^[a-z][a-z\d+.-]*:|^#|^(assets|media|slides)\//i.test(t)) { setDraft(ok); onChange(ok); }
  };
  const input = <input {...a} type="text" inputMode="url" autoComplete="off" autoCapitalize="off" spellcheck={false} maxLength={2048} value={draft} list={listId && ctx.anchors.length ? listId : undefined}
    aria-invalid={err ? 'true' : undefined} onFocus={() => { typing.current = true; }} onBlur={onBlur} onInput={onInput} />;
  const extra = <>
    {err && <small class="ie-err" role="alert">{err}</small>}
    {listId && ctx.anchors.length > 0 && <datalist id={listId}>{ctx.anchors.map((x) => <option value={x.value}>{x.label}</option>)}</datalist>}
  </>;
  if (bare) return <div class="ie-bare">{input}{extra}</div>;
  return <label class="field ie-f"><span>{f.label}</span>{input}{extra}{f.hint && !err && <small>{f.hint}</small>}</label>;
}

const strOf = (x) => (x && typeof x === 'object' ? txt(x.text ?? x.title) : txt(x));
const blankItem = (x) => (x && typeof x === 'object' ? !Object.values(x).some((v) => (Array.isArray(v) ? v.length : has(v))) : !has(x));

/**
 * 목록 하나. 맨 위 목록의 항목은 접었다 펴는 줄(하나만 펼침), 글 한 줄짜리와 항목 안 목록은 바로 고치는 줄.
 * onChange(next, extra): extra는 같은 항목에 함께 넣을 값(퀴즈 정답 번호처럼)
 */
function List({ f, value, parent, onChange, ctx, depth }) {
  const { u } = ctx;
  const items = Array.isArray(value) ? value : [];
  const strings = f.of === 'text';
  const fold = depth === 0 && !strings && !f.inline;
  const [open, setOpen] = useState(() => (fold && items.length === 1 ? 0 : -1));
  const ol = useRef(); const focus = useRef(null);
  const radio = useMemo(() => uid('ie-ans'), []);
  useEffect(() => {
    const want = focus.current; if (!want) return; focus.current = null;
    const li = ol.current?.children[want.i];
    const el = (want.sel && li?.querySelector(`${want.sel}:not(:disabled)`)) || li?.querySelector('input:not([type=radio]):not([type=checkbox]),textarea,select') || li?.querySelector('button');
    el?.focus();
  });
  const limit = f.limit ?? 200, min = f.min ?? 0, edit = !f.fixed;
  const noun = depth === 0 ? '항목' : (f.noun || '항목');
  const ans = f.answer ? Math.max(0, Number(parent?.[f.answer]) || 0) : -1;
  const keep = (fn) => (f.answer ? { [f.answer]: fn(ans) } : undefined); // 정답 번호가 같은 보기를 따라가게
  const commit = (next, extra) => onChange(next, extra);

  const add = (at = items.length) => {
    if (items.length >= limit) return;
    u.now(`${noun} 추가`);
    const n = items.slice(); n.splice(at, 0, strings ? '' : f.make ? f.make(items) : {});
    focus.current = { i: at }; if (fold) setOpen(at);
    commit(n, keep((x) => (x >= at && at < items.length ? x + 1 : x)));
  };
  const move = (i, d) => {
    const j = i + d; if (j < 0 || j >= items.length) return;
    u.now(`${noun} 옮기기`);
    const n = items.slice(); [n[i], n[j]] = [n[j], n[i]];
    if (open === i) setOpen(j); else if (open === j) setOpen(i);
    focus.current = { i: j, sel: d < 0 ? '[data-act=up]' : '[data-act=down]' };
    commit(n, keep((x) => (x === i ? j : x === j ? i : x)));
  };
  const remove = (i, quiet = false) => {
    if (items.length <= min) return;
    const empty = blankItem(items[i]);
    u.now(`${noun} 빼기`);
    setOpen(open === i ? -1 : open > i ? open - 1 : open);
    if (items.length > 1) focus.current = fold ? { i: Math.min(i, items.length - 2), sel: '.ie-sum' } : { i: Math.max(0, i - 1) };
    commit(items.filter((_, k) => k !== i), keep((x) => (x === i ? 0 : x > i ? x - 1 : x)));
    if (depth === 0 && !empty && !quiet) toast('항목을 뺐어요. [되돌리기]로 되살릴 수 있어요.');
  };
  const putItem = (i, v) => commit(items.map((x, k) => (k === i ? v : x)));
  const patchItem = (i) => (p) => commit(items.map((x, k) => (k === i ? { ...(f.norm ? f.norm(x) : x), ...p } : x)));
  const acts = (i, moveToo) => (
    <span class="ie-acts">
      {moveToo && <>
        <button type="button" class="icon-btn" data-act="up" aria-label={`${f.label} ${i + 1} 위로`} title="위로" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
        <button type="button" class="icon-btn" data-act="down" aria-label={`${f.label} ${i + 1} 아래로`} title="아래로" disabled={i === items.length - 1} onClick={() => move(i, 1)}>↓</button>
      </>}
      <button type="button" class="icon-btn" data-act="del" aria-label={`${f.label} ${i + 1} 빼기`} title="빼기" disabled={items.length <= min} onClick={() => remove(i)}>✕</button>
    </span>
  );

  const rows = items.map((x0, i) => {
    const x = f.norm ? f.norm(x0) : x0;
    if (fold) {
      const isOpen = open === i;
      const ok = f.ok ? f.ok(x) : true;
      const sum = txt(f.sum ? f.sum(x, i) : '').trim();
      return (
        <li class="ie-item" data-open={isOpen ? 'true' : undefined} data-off={ok ? undefined : 'true'}>
          <div class="ie-head">
            <button type="button" class="ie-sum" aria-expanded={String(isOpen)} onClick={() => setOpen(isOpen ? -1 : i)}>
              <span class="ie-no">{f.no ? f.no(x, i) : i + 1}</span>
              <span class="ie-ttl">{sum || '새 항목'}</span>
              <span class="ie-meta">{ok ? txt(f.meta?.(x, i)) : '안 보임'}</span>
            </button>
            {isOpen && edit && acts(i, true)}
          </div>
          {isOpen && <div class="ie-body"><Fields fields={f.item} obj={x} patch={patchItem(i)} ctx={ctx} depth={depth + 1} idx={i} /></div>}
        </li>
      );
    }
    const isAns = f.answer && ans === i;
    return (
      <li class={`ie-line${f.answer ? ' ie-q' : ''}`} data-answer={isAns ? 'true' : undefined}>
        {f.answer && <input type="radio" class="ie-radio" name={radio} checked={isAns} title="정답" aria-label={`${f.label} ${i + 1}을 정답으로`} onChange={() => { u.now('정답 바꾸기'); commit(items, { [f.answer]: i }); }} />}
        <div class={`ie-line-f${f.pair ? ' ie-pair' : ''}`}>
          {strings
            ? <Area class="input ie-one" rows={1} value={strOf(x)} maxLength={f.each} placeholder={typeof f.ph === 'function' ? f.ph(i) : f.ph} aria-label={`${f.label} ${i + 1}`}
              onInput={(e) => { u.touch(); putItem(i, e.currentTarget.value.replace(/\n/g, ' ')); }}
              onKeyDown={(e) => {
                if (e.isComposing || e.keyCode === 229) return; // 한글 조합 중
                if (e.key === 'Enter' && edit) { e.preventDefault(); add(i + 1); } // 엔터: 아래에 새 줄
                else if (e.key === 'Backspace' && !e.currentTarget.value && edit && items.length > Math.max(min, 1)) { e.preventDefault(); remove(i, true); }
              }} />
            : <Fields fields={f.item} obj={x} patch={patchItem(i)} ctx={ctx} depth={depth + 1} idx={i} bare />}
        </div>
        {edit && acts(i, depth === 0)}
      </li>
    );
  });

  return (
    <div class={`ie-list${depth ? ' ie-sub' : ''}`}>
      <div class="ie-list-h"><span>{f.label}</span>{f.hint && items.length > 0 && <small>{f.hint}</small>}</div>
      {items.length > 0 && <ol ref={ol} class={fold ? 'ie-items' : 'ie-lines'} aria-label={f.label}>{rows}</ol>}
      {!items.length && f.empty && <p class="ie-empty">{f.empty}</p>}
      {edit && <div class="ie-foot">
        <button type="button" class="btn btn-sm btn-quiet ie-add" disabled={items.length >= limit} onClick={() => add()}>{items.length >= limit ? `최대 ${limit}개` : `+ ${noun} 추가`}</button>
      </div>}
    </div>
  );
}
