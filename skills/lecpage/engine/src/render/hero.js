// 첫 화면: 프리셋마다 다른 구성(composition). 꾸밈이 아니라 실제 내용(일시·실습·교재·일정·도구)으로 짭니다.
// 구성 이름은 프리셋 variants.hero → <html data-hero>와 .lp-hero--<이름>. 모양은 runtime/lecpage.css '첫 화면' 묶음.
//   cinema(밤하늘 서사) · worksheet(종이 워크북) · bento(유리 실험실) · poster(놀이터) · quiet(숲의 숨) · brief(공식 브리핑)
//   masthead(잉크 잡지) · sticker(도파민 팝) · board(칠판 교실) · spec(설계도) · zine(형광 인쇄) · invite(새벽빛)
//   keynote(어두운 키노트) · panel(깔끔한 기업형) · soft(부드러운 파스텔) · ticker(움직이는 글자) · column(따뜻한 미니멀)
//   살아 있는 첫 화면: collage(펼친 교재) · dial(하루 시계) · orbit(입체 궤도) · stream(돌과 물결)
//   배치가 다른 첫 화면(render/hero-graphic.js): ripple(번지는 파문·가운데) · minutes(시간 점묘·자료 그림) · mosaic(도형 모자이크·반반) · cover(표지 한 장·그림 가득) · vertical(세로쓰기·오른쪽) · offset(어긋난 격자)
// 규칙
//  - 값이 있는 것만 보여 줍니다(빈 칸·가짜 숫자 없음). 꾸밈 글자(큰 날짜 등)는 실제 값의 되풀이이고 aria-hidden.
//  - 모든 글은 JS 없이 읽히고, 움직임이 꺼져도 완성된 모습입니다.
//  - 연수 전·중·후(data-hero-state): 참가자 화면이 '시작까지 3일' · '지금 진행 중' · '끝난 연수'를 채웁니다.
//  - 두 구성이 같은 뼈대를 쓰지 않습니다(scripts/design-lint.mjs의 hero-skeleton 검사).
import { esc, br, href, fx, pad2, icon, koDate } from './html.js';
import { getPreset } from '../design/presets.js';
import { graphicHeroes } from './hero-graphic.js';

const WEEK = '일월화수목금토';
export function dateParts(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); if (!m) return null;
  const w = WEEK[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()];
  return { y: +m[1], m: +m[2], d: +m[3], w };
}
const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
/** 연수 길이: 정시간이면 '3시간', 두 시간 아래면 '90분', 나머지는 '2시간 30분'(숫자 세기 없음) */
export function duration(start, end) {
  const a = toMin(start), b = toMin(end); if (a === null || b === null || b <= a) return null;
  const n = b - a;
  if (n % 60 === 0) return { num: n / 60, unit: '시간' };
  if (n < 120) return { num: n, unit: '분' };
  return { text: `${Math.floor(n / 60)}시간 ${n % 60}분` };
}
const minText = (n) => (n >= 60 ? `${Math.floor(n / 60)}시간${n % 60 ? ` ${n % 60}분` : ''}` : `${n}분`);

/** 제목 강조: 여러 줄이면 마지막 줄, 한 줄이면 마지막 낱말(짧으면 두 낱말) */
export function titleHtml(t) {
  const lines = String(t || '').split('\n');
  if (lines.length > 1) return `${lines.slice(0, -1).map(esc).join('<br>')}<br><em class="lp-accent">${esc(lines[lines.length - 1])}</em>`;
  const w = lines[0].split(' ').filter(Boolean);
  if (w.length < 3) return esc(lines[0]);
  const k = [...w[w.length - 1]].length <= 2 ? 2 : 1;
  return `${esc(w.slice(0, -k).join(' '))} <em class="lp-accent">${esc(w.slice(-k).join(' '))}</em>`;
}

/** 첫 화면에 쓸 값 모으기(설계도에서 계산) */
function model(s, ctx, h) {
  const bp = ctx.bp, m = bp.meta;
  const sec = (t) => bp.sections.find((x) => x.type === t);
  const st = sec('stations'), deck = sec('deck'), tools = sec('tools'), sched = sec('schedule'), outline = sec('outline'), goals = sec('goals'), ready = sec('readiness'), mats = sec('materials');
  const ins = bp.instructors[0];
  const time = m.start ? `${m.start}${m.end ? `~${m.end}` : ''}` : '';
  const when = m.date ? `${koDate(m.date)}${time ? ` ${time}` : ''}` : '';
  const place = h.placeText(m);
  const custom = !!s.meta?.length;
  const meta = custom ? s.meta.slice() : [
    when && { k: 'when', label: '일시', value: when },
    place && { k: 'where', label: '장소', value: place },
    ins && { k: 'who', label: '강사', value: `${ins.name}${ins.org ? ` · ${ins.org}` : ''}` },
  ].filter(Boolean);
  // 이수 기준: 연수 목표 칸이 없을 때만 첫 화면에(같은 말을 두 번 하지 않게)
  const done = h.completionLine(ctx);
  if (done && !goals && !meta.some((x) => x.label === '이수')) meta.push({ k: 'done', label: '이수', value: done });
  const dur = duration(m.start, m.end);
  const nums = [
    dur && { k: 'dur', label: '시간', ...dur },
    st?.items.length && { k: 'st', label: '실습', num: st.items.length, unit: '개' },
    deck?.slides.length && { k: 'deck', label: '교재', num: deck.slides.length, unit: '쪽' },
    tools?.items.length && { k: 'tools', label: '도구', num: tools.items.length, unit: '가지' },
    outline?.items.length > 1 && { k: 'parts', label: '차례', num: outline.items.length, unit: '부' },
    ctx.live && bp.live.features.length && { k: 'live', label: '참여 기능', num: bp.live.features.length, unit: '가지' },
  ].filter(Boolean);
  const who = goals?.who && [...goals.who].length <= 64 ? goals.who : '';
  const prep = ready?.items.length ? ready.items.slice(0, 2).map((x) => x.label).join(' · ') + (ready.items.length > 2 ? ` 외 ${ready.items.length - 2}가지` : '') : '';
  const agenda = sched?.items.length ? sched.items.map((x) => ({ t: x.start, end: x.end, title: x.title }))
    : outline?.items.length ? outline.items.map((x) => ({ t: x.part, title: x.title })) : [];
  return {
    m, s, ctx, h, st, deck, tools, sched, outline, goals, mats, ins, meta, custom, nums, who, prep, agenda, time, when, place, done, dur,
    dp: dateParts(m.date), title: s.title || m.title, org: s.eyebrow || m.organizer || '', sub: s.subtitle || m.subtitle || '',
    id: esc(s.id),
  };
}

// ── 조각 ─────────────────────────────────────────────
const org = (M, cls = '') => (M.org ? `<p class="lp-hero-org${cls ? ' ' + cls : ''}">${esc(M.org)}</p>` : '');
/** 연수 전·중·후 한 줄. 날짜가 있을 때만 두고, 참가자 화면(lecpage.js initPhase)이 글을 채워 보여 줍니다 */
const state = (M) => (M.dp ? '<p class="lp-hero-state" data-hero-state hidden><i aria-hidden="true"></i><span data-hero-state-text></span></p>' : '');
const h1 = (M, cls = '') => `<h1 class="lp-h1${cls ? ' ' + cls : ''}" id="${M.id}-h"${fx(M.ctx, 'hero.title')}>${titleHtml(M.title)}</h1>`;
const sub = (M, cls = '') => (M.sub ? `<p class="lp-hero-sub${cls ? ' ' + cls : ''}">${br(M.sub)}</p>` : '');
function ctas(M, extra = []) {
  const { s, ctx, h, m } = M;
  const join = h.joinCta(ctx);
  const c0 = s.ctas?.length ? s.ctas : h.defaultCtas(ctx);
  const list = [...(join && !c0.some((c) => c.href === join.href) ? [join, ...c0] : c0), ...extra.filter((e) => !c0.some((c) => c.href === e.href))].slice(0, 3);
  // 연수가 끝나면: 입장 버튼 대신 '연수 후 안내'(있을 때)
  const fu = ctx.bp.sections.find((x) => x.type === 'followup');
  const after = fu ? `<a class="lp-btn lp-btn-primary" href="#${esc(fu.id)}" data-phase-show="after" hidden><span>연수 후 안내</span>${icon('arrow')}</a>` : '';
  if (!list.length && !after) return '';
  return `<div class="lp-ctas">${after}${list.map((c, i) => `<a class="lp-btn ${i ? 'lp-btn-ghost' : 'lp-btn-primary'}" ${href(c.href)}${i ? '' : fx(ctx, 'hero.cta')}${c.download ? ' download' : ''}${c.join || c.href === m.joinUrl ? ' data-phase-hide="after"' : ''}><span>${esc(c.label)}</span>${icon(c.download ? 'download' : /^https?:/.test(c.href) ? 'external' : 'arrow')}</a>`).join('')}</div>`;
}
/** 글 정보 한 칸: dd는 글자 그대로(검색·화면 낭독기·테스트가 같은 값을 봄) */
const cell = (x, cls = '') => `<div${cls ? ` class="${cls}"` : ''}${x.k ? ` data-k="${x.k}"` : ''}><dt>${esc(x.label)}</dt><dd>${x.url ? `<a ${href(x.url)}>${esc(x.value)}</a>` : esc(x.value)}</dd></div>`;
/** 숫자 한 칸: 큰 숫자 + 단위 */
const numCell = (M, x, cls = '') => `<div class="lp-gl${cls ? ' ' + cls : ''}" data-k="${x.k}"><dt>${esc(x.label)}</dt><dd>${x.text ? `<span class="lp-num lp-num-t">${esc(x.text)}</span>` : `<span class="lp-num"${fx(M.ctx, 'numbers')}>${x.num}</span><span class="lp-unit">${esc(x.unit)}</span>`}</dd></div>`;
const metaDl = (items, cls = '') => (items.length ? `<dl class="lp-hero-meta${cls ? ' ' + cls : ''}">${items.map((x) => cell(x)).join('')}</dl>` : '');
const pick = (M, ...ks) => ks.map((k) => M.nums.find((x) => x.k === k)).filter(Boolean);
const shortDate = (M) => (M.dp ? `${M.dp.m}. ${M.dp.d}.` : '');
const longDate = (M) => (M.dp ? `${M.dp.y}년 ${M.dp.m}월 ${M.dp.d}일 ${M.dp.w}요일` : '');
const isoDate = (M) => `${esc(M.m.date)}${M.m.start ? `T${esc(M.m.start)}` : ''}`;
/** 일시 칸을 크게: 날짜(크게) + 요일·시간 — 사용자가 meta를 직접 적었으면 그대로 */
function whenCell(M, cls) {
  if (M.custom || !M.dp) return '';
  return `<div class="${cls}" data-k="when"><dt>일시</dt><dd><b class="lp-date">${M.dp.m}. ${M.dp.d}.</b><span class="lp-date-sub">${M.dp.w}요일${M.time ? ` · ${esc(M.time)}` : ''}</span></dd></div>`;
}
const metaNoWhen = (M) => (M.custom || !M.dp ? M.meta : M.meta.filter((x) => x.k !== 'when'));
/** 큰 날짜(꾸밈): 실제 일시의 되풀이라 화면 낭독기에는 숨김 */
const bigDate = (M, cls) => (M.dp ? `<p class="${cls}" aria-hidden="true">${pad2(M.dp.m)}<i>.</i>${pad2(M.dp.d)}</p>` : '');
/** 흐르는 띠에 올릴 이름: 실제 도구 이름(둘 이상 있을 때만) */
const bandNames = (M) => { const n = (M.tools?.items || []).map((t) => t.name).filter(Boolean); return n.length >= 2 ? n : []; };
/** 도구 이름 띠. 아래 도구 칸과 같은 내용이라 화면 낭독기에는 숨김. 대표 효과가 '흐르는 띠'일 때만 흐름 */
function toolBand(M) {
  const names = bandNames(M);
  if (!names.length) return '';
  const sig = M.ctx.design.signature === 'marquee' ? ' data-fx="marquee" data-fx-opts=\'{"speed":42}\'' : '';
  return `<div class="lp-band" aria-hidden="true"><ul class="lp-band-list"${sig}>${names.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`;
}
/** 첫 화면이 도구 이름 띠를 직접 그리는지(그러면 첫 화면 아래 구분 띠는 생략) */
export function heroHasBand(ctx) {
  const comp = heroComposition(ctx);
  const tools = ctx.bp.sections.find((x) => x.type === 'tools');
  return comp === 'poster' && (tools?.items || []).filter((t) => t.name).length >= 2;
}

// ── 구성 ─────────────────────────────────────────────
const C = {};

/* 밤하늘 서사: 영화 첫 장면. 아주 큰 제목(한 낱말 강조) 뒤로 큰 날짜 윤곽, 아래 '한눈에 보기' 띠 */
C.cinema = (M) => {
  const cells = [...M.meta.filter((x) => x.k !== 'who'), ...pick(M, 'dur', 'st', 'deck', 'parts')].slice(0, 5);
  return `${bigDate(M, 'lp-cine-date')}
<div class="lp-wrap lp-hero-inner">
  <div class="lp-hero-top">${org(M)}${state(M)}</div>
  ${h1(M)}
  <div class="lp-hero-foot">${sub(M)}${ctas(M)}</div>
</div>
${cells.length ? `<div class="lp-hero-strip"><div class="lp-wrap"><p class="lp-strip-label">한눈에 보기</p><dl class="lp-hero-meta">${cells.map((x) => (x.value !== undefined ? cell(x) : numCell(M, x))).join('')}</dl></div></div>` : ''}`;
};

/* 종이 워크북: 제목 + 실제 '오늘의 실습지'(실습 목록·체크 칸·걸리는 시간). 완료하면 체크가 찍힘 */
C.worksheet = (M) => {
  let sheet = '';
  const items = M.st?.items || [];
  const date = M.dp ? `<p class="lp-sheet-d">${shortDate(M)}(${M.dp.w})</p>` : '';
  if (items.length) {
    const shown = items.slice(0, 5), total = items.reduce((a, x) => a + (x.minutes || 0), 0);
    const foot = [`실습 ${items.length}개`, total ? `약 ${minText(total)}` : '', items.length > shown.length ? `나머지 ${items.length - shown.length}개는 실습 칸에` : ''].filter(Boolean).join(' · ');
    sheet = `<aside class="lp-sheet" aria-label="오늘의 실습지"><div class="lp-sheet-h"><p class="lp-sheet-t">오늘의 실습지</p>${date}</div>
<ol class="lp-sheet-list">${shown.map((x, i) => `<li><a href="#st-${esc(x.id)}" data-hero-st="${esc(x.id)}"><i class="lp-sheet-box" aria-hidden="true"></i><span class="lp-sheet-n">${pad2(i + 1)}</span><span class="lp-sheet-name">${esc(x.name || x.title)}</span>${x.minutes ? `<span class="lp-sheet-min">${x.minutes}분</span>` : ''}</a></li>`).join('')}</ol>
<p class="lp-sheet-f">${esc(foot)}</p></aside>`;
  } else if (M.goals?.items.length || M.agenda.length) {
    const label = M.goals?.items.length ? '오늘의 목표' : '오늘의 차례';
    const list = M.goals?.items.length ? M.goals.items : M.agenda.map((a) => a.title);
    sheet = `<aside class="lp-sheet" aria-label="${label}"><div class="lp-sheet-h"><p class="lp-sheet-t">${label}</p>${date}</div>
<ol class="lp-sheet-list">${list.slice(0, 5).map((g, i) => `<li><span class="lp-sheet-row"><i class="lp-sheet-box" aria-hidden="true"></i><span class="lp-sheet-n">${pad2(i + 1)}</span><span class="lp-sheet-name">${esc(g)}</span></span></li>`).join('')}</ol>${list.length > 5 ? `<p class="lp-sheet-f">그리고 ${list.length - 5}가지 더</p>` : ''}</aside>`;
  }
  return `<div class="lp-wrap lp-hero-inner${sheet ? '' : ' is-solo'}">
  <div class="lp-hero-copy">${org(M)}${state(M)}${h1(M)}${sub(M)}${ctas(M)}${metaDl(M.meta)}</div>
  ${sheet}
</div>`;
};

/* 유리 실험실: 벤토 요약. 큰 제목 칸 + 일시·장소·강사 칸 + 숫자 칸, 실시간이면 '지금 올라온 질문' 칸. 유리는 칸에만 */
C.bento = (M) => {
  const spot = M.ctx.design.signature === 'spotlight' ? ' data-fx="spotlight" data-fx-opts=\'{"mode":"cards","items":".lp-tile"}\'' : '';
  const nums = pick(M, 'st', 'deck', 'dur', 'tools', 'parts').slice(0, 3);
  const live = M.ctx.live && M.ctx.bp.sections.some((x) => x.type === 'qa') ? `<div class="lp-tile lp-tile-live" data-k="live" data-hero-live hidden><dt>지금 올라온 질문</dt><dd><span class="lp-num" data-hero-live-n>0</span><span class="lp-unit">개</span></dd></div>` : '';
  const side = [whenCell(M, 'lp-tile lp-tile-when'), ...metaNoWhen(M).map((x) => cell(x, 'lp-tile'))].filter(Boolean);
  return `<div class="lp-wrap lp-hero-inner lp-bento"${spot}>
  <div class="lp-tile lp-tile-main">${org(M)}${state(M)}${h1(M)}${sub(M)}${ctas(M)}</div>
  ${side.length ? `<dl class="lp-hero-meta lp-bento-side">${side.join('')}</dl>` : ''}
  ${nums.length || live ? `<dl class="lp-bento-foot">${nums.map((x) => numCell(M, x, 'lp-tile lp-tile-num')).join('')}${live}</dl>` : ''}
</div>`;
};

/* 놀이터: 포스터. 기울어진 흰 제목 상자(딱딱한 그림자) + 원색 블록 + 아래 도구 이름 띠 */
C.poster = (M) => {
  const blocks = [whenCell(M, 'lp-block'), ...metaNoWhen(M).filter((x) => x.k !== 'who').map((x) => cell(x, 'lp-block')), ...pick(M, 'st', 'deck', 'dur').slice(0, 2).map((x) => numCell(M, x, 'lp-block'))].filter(Boolean).slice(0, 4);
  const ins = M.meta.find((x) => x.k === 'who');
  return `<div class="lp-wrap lp-hero-inner">
  <div class="lp-hero-top">${org(M)}${state(M)}</div>
  <div class="lp-poster-title">${h1(M)}</div>
  ${blocks.length ? `<dl class="lp-hero-meta lp-blocks">${blocks.join('')}</dl>` : ''}
  <div class="lp-poster-copy">${sub(M)}${ctas(M)}${ins ? metaDl([ins], 'lp-poster-who') : ''}</div>
</div>
${toolBand(M)}`;
};

/* 숲의 숨: 조용한 부리 글꼴. 넓은 여백, 오른쪽 아래 달력 한 장(날짜), 언덕 실루엣과 나이테 */
C.quiet = (M) => `<div class="lp-rings" aria-hidden="true"></div>
<div class="lp-wrap lp-hero-inner">
  <div class="lp-hero-copy">${org(M)}${state(M)}${h1(M)}${sub(M)}${ctas(M)}</div>
  <dl class="lp-hero-meta lp-quiet-meta">${whenCell(M, 'lp-leaf')}${metaNoWhen(M).map((x) => cell(x)).join('')}</dl>
</div>
<div class="lp-hills" aria-hidden="true"></div>`;

/* 공식 브리핑: 남색 머리띠(기관·날짜) + 세 칸 색 막대, 제목·정보 표(일시·장소·대상·이수), 아래 숫자 줄 */
C.brief = (M) => {
  const rows = [...M.meta.filter((x) => x.k === 'when' || x.k === 'where' || M.custom), ...(M.who ? [{ k: 'aud', label: '대상', value: M.who }] : []), ...M.meta.filter((x) => !M.custom && (x.k === 'done' || x.k === 'who'))];
  const mats = M.mats ? { label: '자료 받기', href: '#' + M.mats.id } : M.deck?.download?.href ? { label: '교재 받기', href: M.deck.download.href, download: !/^https?:/.test(M.deck.download.href) } : null;
  const gl = pick(M, 'dur', 'st', 'deck', 'parts', 'live').slice(0, 4);
  return `<div class="lp-brief-band"><div class="lp-wrap">${M.org ? `<p class="lp-hero-org">${esc(M.org)}</p>` : '<span></span>'}${M.dp ? `<p class="lp-brief-d"><time datetime="${isoDate(M)}">${longDate(M)}</time></p>` : ''}</div></div>
<div class="lp-wrap lp-hero-inner">
  <div class="lp-hero-copy">${state(M)}${h1(M)}${sub(M)}${ctas(M, mats ? [mats] : [])}</div>
  ${metaDl(rows, 'lp-brief-table')}
  ${gl.length ? `<dl class="lp-brief-glance">${gl.map((x) => numCell(M, x)).join('')}</dl>` : ''}
</div>`;
};

/* 잉크 잡지: 표제 띠(기관 · 날짜, 겹줄) + 아주 큰 명조 제목 + 세 단(머리글 | 정보 | 버튼과 숫자)과 세로 규칙선 */
C.masthead = (M) => {
  const meta = M.custom ? M.meta : [...(M.time ? [{ k: 'time', label: '시간', value: M.time }] : []), ...metaNoWhen(M)];
  const nums = pick(M, 'st', 'deck', 'parts', 'dur').slice(0, 3);
  return `<div class="lp-wrap lp-hero-inner">
  <div class="lp-mast">${M.org ? `<p class="lp-hero-org">${esc(M.org)}</p>` : '<span></span>'}${state(M)}${M.dp ? `<p class="lp-mast-d"><time datetime="${isoDate(M)}">${longDate(M)}</time></p>` : ''}</div>
  ${h1(M)}
  <div class="lp-mast-cols">${M.sub ? sub(M, 'lp-standfirst') : '<span></span>'}${metaDl(meta)}<div class="lp-mast-act">${ctas(M)}${nums.length ? `<p class="lp-mast-nums">${nums.map((x) => `<span>${esc(x.label)} <b>${x.text ? esc(x.text) : `${x.num}${esc(x.unit)}`}</b></span>`).join('')}</p>` : ''}</div></div>
</div>`;
};

/* 도파민 팝: 비대칭 포스터. 화면을 채우는 통통한 제목, 겹쳐 붙인 동그란 날짜 스티커와 숫자 딱지 */
C.sticker = (M) => {
  const stickers = [M.dp && !M.custom ? `<div class="lp-stk lp-stk-date" data-k="when"><dt>일시</dt><dd><b class="lp-date">${M.dp.m}. ${M.dp.d}.</b><span class="lp-date-sub">${M.dp.w}요일${M.time ? `<br>${esc(M.time)}` : ''}</span></dd></div>` : '', ...pick(M, 'st', 'deck', 'dur').slice(0, 1).map((x) => numCell(M, x, 'lp-stk lp-stk-num'))].filter(Boolean);
  return `<div class="lp-wrap lp-hero-inner">
  <div class="lp-hero-top">${org(M)}${state(M)}</div>
  ${h1(M)}
  ${stickers.length ? `<dl class="lp-stickers">${stickers.join('')}</dl>` : ''}
  <div class="lp-pop-row">${sub(M)}${ctas(M)}</div>
  ${metaDl(metaNoWhen(M), 'lp-pop-meta')}
</div>`;
};

/* 칠판 교실: 나무 틀 칠판에 분필 제목과 밑줄, 오른쪽에 '오늘의 차례'(실제 일정), 분필 받침, 칠판 아래 버튼과 정보 */
C.board = (M) => {
  const ag = M.agenda.slice(0, 5);
  const label = M.sched ? '오늘의 차례' : '오늘 나눌 이야기';
  const g = M.ctx.design.graphic ? `<div class="lp-hero-graphic" data-fx="${esc(M.ctx.design.graphic)}" data-fx-opts='{"count":4}' aria-hidden="true"></div>` : '';
  return `<div class="lp-wrap lp-hero-inner">
  <div class="lp-chalk${ag.length ? '' : ' is-solo'}">${g}
    <div class="lp-chalk-main">${org(M)}${state(M)}${h1(M)}<svg class="lp-chalk-line" viewBox="0 0 320 14" preserveAspectRatio="none" aria-hidden="true"><path d="M3 9c40-6 78-6 118-2s82 6 120 0 50-5 76-3"/></svg>${sub(M)}</div>
    ${ag.length ? `<div class="lp-chalk-agenda"><p class="lp-chalk-k">${label}</p><ol>${ag.map((a) => `<li>${a.t ? `<span class="lp-chalk-t">${esc(a.t)}</span>` : ''}<span>${esc(a.title)}</span></li>`).join('')}</ol>${M.agenda.length > ag.length ? `<p class="lp-chalk-more">그리고 ${M.agenda.length - ag.length}가지 더</p>` : ''}</div>` : ''}
    <div class="lp-chalk-tray" aria-hidden="true"><i></i><i></i><i></i><b></b></div>
  </div>
  <div class="lp-chalk-under">${ctas(M)}${metaDl(M.meta)}</div>
</div>`;
};

/* 설계도: 도면 표제란. 제목 아래 치수선(연수 시간), 오른쪽에 고정폭 이름표의 사양 표(시간·장소·대상·준비물·숫자) */
C.spec = (M) => {
  const cells = M.custom ? M.meta : [
    M.when && { k: 'when', label: '일시', value: M.when },
    M.place && { k: 'where', label: '장소', value: M.place },
    M.who && { k: 'aud', label: '대상', value: M.who },
    M.prep && { k: 'prep', label: '준비물', value: M.prep },
    ...M.meta.filter((x) => x.k === 'who' || x.k === 'done'),
  ].filter(Boolean);
  const nums = pick(M, 'st', 'deck', 'dur', 'tools').slice(0, 3);
  const dim = M.dur ? `<p class="lp-spec-dim" aria-hidden="true"><span>${M.dur.text ? esc(M.dur.text) : `${M.dur.num}${esc(M.dur.unit)}`}${M.time ? ` · ${esc(M.time)}` : ''}</span></p>` : '';
  return `<div class="lp-wrap lp-hero-inner">
  <div class="lp-spec-id">${M.org ? `<span class="lp-hero-org">${esc(M.org)}</span>` : '<span>연수 안내</span>'}${state(M)}${M.dp ? `<time datetime="${isoDate(M)}">${M.dp.y}-${pad2(M.dp.m)}-${pad2(M.dp.d)}</time>` : ''}</div>
  <div class="lp-hero-copy">${h1(M)}${dim}${sub(M)}${ctas(M)}</div>
  <dl class="lp-hero-meta lp-spec">${cells.map((x) => cell(x, 'lp-spec-c')).join('')}${nums.map((x) => numCell(M, x, 'lp-spec-c lp-spec-n')).join('')}</dl>
</div>`;
};

/* 형광 인쇄: 두 색 잉크. 판이 어긋난 굵은 제목, 망점 원, 비스듬한 도장(실습·교재 수), 고정폭 정보 줄 */
C.zine = (M) => {
  const stamp = pick(M, 'st', 'deck', 'dur').slice(0, 2);
  return `<div class="lp-halftone" aria-hidden="true"></div>
<div class="lp-wrap lp-hero-inner">
  <div class="lp-zine-top">${org(M)}${state(M)}${M.dp ? `<p class="lp-zine-d"><time datetime="${isoDate(M)}">${M.dp.y}. ${shortDate(M)} ${M.dp.w}</time></p>` : ''}</div>
  ${h1(M)}
  ${stamp.length ? `<dl class="lp-stamp">${stamp.map((x) => numCell(M, x)).join('')}</dl>` : ''}
  <div class="lp-zine-row"><div class="lp-zine-copy">${sub(M)}${ctas(M)}</div>${metaDl(M.meta)}</div>
</div>`;
};

/* 새벽빛: 초대장. 왼쪽 날짜 기둥(세로 규칙선) + 바탕 글꼴 제목, 지평선 위로 떠오르는 해 */
C.invite = (M) => `<div class="lp-sun" aria-hidden="true"><i></i></div>
<div class="lp-wrap lp-hero-inner${M.dp ? '' : ' is-solo'}">
  ${M.dp ? `<p class="lp-invite-date"><time datetime="${isoDate(M)}"><span class="lp-invite-m">${M.dp.m}월</span><b>${M.dp.d}</b><span class="lp-invite-w">${M.dp.w}요일</span>${M.time ? `<span class="lp-invite-t">${esc(M.time)}</span>` : ''}</time></p>` : ''}
  <div class="lp-hero-copy">${org(M)}${state(M)}${h1(M)}${sub(M)}${ctas(M)}${metaDl(metaNoWhen(M))}</div>
</div>`;

/* 어두운 키노트: 무대 조명 아래 아주 큰 제목(둘째 줄은 한 톤 낮게), 아래 지평선 불빛과 한 줄 정보 레일 */
C.keynote = (M) => {
  const rail = [...M.meta, ...pick(M, 'dur', 'st', 'deck', 'parts')].slice(0, 5);
  return `<div class="lp-key-light" aria-hidden="true"></div>
<div class="lp-wrap lp-hero-inner">
  <div class="lp-key-top">${org(M)}${state(M)}</div>
  <div class="lp-key-title">${h1(M)}${sub(M)}${ctas(M)}</div>
  ${rail.length ? `<dl class="lp-hero-meta lp-key-rail">${rail.map((x) => (x.value !== undefined ? cell(x) : numCell(M, x))).join('')}</dl>` : ''}
</div>`;
};

/* 깔끔한 기업형: 왼쪽 제목과 버튼, 오른쪽에 겹쳐 놓인 '오늘의 일정' 카드(실제 일정·차례) */
C.panel = (M) => {
  const ag = M.agenda.slice(0, 4); const label = M.sched ? '오늘의 일정' : '오늘의 차례';
  const card = ag.length ? `<aside class="lp-panel-card" aria-label="${label}"><p class="lp-panel-h"><b>${label}</b>${M.dp ? `<time datetime="${isoDate(M)}">${shortDate(M)} ${M.dp.w}</time>` : ''}</p><ol>${ag.map((a) => `<li>${a.t ? `<span class="lp-panel-t">${esc(a.t)}</span>` : ''}<span>${esc(a.title)}</span></li>`).join('')}</ol>${M.agenda.length > ag.length ? `<p class="lp-panel-more">그리고 ${M.agenda.length - ag.length}가지 더</p>` : ''}</aside>` : '';
  return `<div class="lp-wrap lp-hero-inner${card ? '' : ' is-solo'}">
  <div class="lp-hero-copy">${org(M)}${state(M)}${h1(M)}${sub(M)}${ctas(M)}${metaDl(M.meta)}</div>
  ${card}
</div>`;
};

/* 부드러운 파스텔: 아치·원·알약 도형을 겹쳐 놓고 아치 안에 날짜. 왼쪽에 둥근 제목 */
C.soft = (M) => `<div class="lp-wrap lp-hero-inner">
  <div class="lp-hero-copy">${org(M)}${state(M)}${h1(M)}${sub(M)}${ctas(M)}${metaDl(metaNoWhen(M))}</div>
  <div class="lp-soft-art"><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i>${M.dp && !M.custom ? `<p class="lp-soft-date"><time datetime="${isoDate(M)}"><b>${M.dp.m}.${M.dp.d}</b><span>${M.dp.w}요일${M.time ? ` · ${esc(M.time)}` : ''}</span></time></p>` : ''}</div>
</div>`;

/* 움직이는 글자: 화면을 넘치는 제목, 그 아래 윤곽선 메아리 줄(스크롤에 따라 옆으로 흐름), 굵은 선으로 나눈 정보 칸 */
C.ticker = (M) => {
  const echo = esc(String(M.title).replace(/\n/g, ' '));
  const cells = [...M.meta, ...pick(M, 'dur', 'st', 'deck')].slice(0, 4);
  return `<div class="lp-wrap lp-hero-inner">
  <div class="lp-hero-top">${org(M)}${state(M)}</div>
  ${h1(M)}
</div>
<p class="lp-kin-echo" aria-hidden="true"><span>${echo} · ${echo} · ${echo} · ${echo}</span></p>
<div class="lp-wrap lp-kin-foot">${sub(M)}${ctas(M)}${cells.length ? `<dl class="lp-hero-meta lp-kin-meta">${cells.map((x) => (x.value !== undefined ? cell(x) : numCell(M, x))).join('')}</dl>` : ''}</div>`;
};

/* 따뜻한 미니멀: 넓은 여백. 위에 가는 선, 왼쪽 단에 명조 제목, 오른쪽에 가는 큰 날짜 하나와 점선으로 이은 정보 */
C.column = (M) => `<div class="lp-wrap lp-hero-inner">
  <div class="lp-min-rule">${org(M)}${state(M)}</div>
  <div class="lp-hero-copy">${h1(M)}${sub(M)}${ctas(M)}</div>
  <div class="lp-min-side">${M.dp ? `<p class="lp-min-date" aria-hidden="true">${M.dp.d}</p>` : ''}${metaDl(M.meta, 'lp-min-meta')}</div>
</div>`;

// ── 살아 있는 첫 화면(쇼케이스): 글은 그대로 HTML, 그림은 서버에서 정지 모습으로 그려 두고 효과(runtime/fx)가 움직임·반응을 더함 ──
/** 구성이 직접 그리는 그림(효과 아이디). 디자인의 첫 화면 그래픽이 이것과 같으면 따로 그래픽 층을 두지 않음 */
export const OWN_ART = { collage: 'slide-fan', dial: 'schedule-dial', orbit: 'orbit-3d', stream: 'stream-lines', ripple: 'arc-ripple', minutes: 'minute-map' };
const artFx = (M, id) => (M.ctx.design.graphic === id ? ` data-fx="${id}"` : '');
/** 쇼케이스 공통 뼈대: 글 | 그림 | 정보. 넓은 화면은 글·정보 왼쪽에 그림 오른쪽, 좁은 화면은 글 → 그림 → 정보 */
const show = (M, art) => `<div class="lp-wrap lp-hero-inner lp-show${art ? '' : ' is-solo'}">
  <div class="lp-hero-copy">${org(M)}${state(M)}${h1(M)}${sub(M)}${ctas(M)}</div>
  ${art}
  ${metaDl(M.meta)}
</div>`;
// 같은 제목이면 같은 그림: runtime/fx/core.js의 hash·rand와 같은 셈(FNV-1a, mulberry32)
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const seeded = (seed) => { let a = (seed >>> 0) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
/** 연수 제목에서 나오는 난수(같은 제목이면 같은 값). 마무리의 그림 조각도 이것으로 그림 */
export const titleRandom = (title) => seeded(hashStr(String(title || 'lecpage').replace(/\s+/g, ' ').trim()));
const seedOf = (M) => String(M.m.title || M.title || 'lecpage').replace(/\s+/g, ' ').trim();

/* 펼친 교재: 교재 쪽을 부채처럼 펼친 3D 더미(쪽 그림이 있으면 그림, 없으면 글 카드). 교재가 없으면 실습·차례로. 누르면 그 쪽으로 감 */
function fanCards(M) {
  const strip = (t) => String(t || '').replace(/^\s*(?:PART|Part|파트)\s*\d{1,2}\s*[.:·\-–—]?\s*/, '').trim();
  const sl = (M.deck?.slides || []).slice(0, 5).map((x) => ({ no: x.page, title: strip(x.title) || `${x.page}쪽`, src: x.src, href: `#deck-p${x.page}` }));
  if (sl.length >= 2) return sl;
  const st = (M.st?.items || []).map((x, i) => ({ no: i + 1, title: x.title || x.name, href: `#st-${x.id}` }));
  return (st.length >= 2 ? st : (M.outline?.items || []).map((x, i) => ({ no: i + 1, title: x.title, href: `#${M.outline.id}` }))).slice(0, 5);
}
C.collage = (M) => {
  const cards = fanCards(M);
  const fan = cards.length >= 2 ? `<div class="lp-fan"${artFx(M, 'slide-fan')} style="--n:${cards.length}"><ol class="lp-fan-list" aria-label="${M.deck ? '교재 미리 보기' : '오늘의 차례'}">${cards.map((c, i) => `<li class="lp-fan-card" style="--i:${i}"><a class="lp-fan-face" href="${esc(c.href)}">${c.src ? `<img src="${esc(c.src)}" alt="${esc(`${c.no}쪽: ${c.title}`)}" loading="${i ? 'lazy' : 'eager'}" decoding="async">` : `<span class="lp-fan-pg" aria-hidden="true">${pad2(c.no)}</span><b>${esc(c.title)}</b>`}</a></li>`).join('')}</ol><button class="lp-btn lp-btn-ghost lp-btn-sm lp-fan-next" type="button" data-fan-next hidden><span>다음 장</span>${icon('right')}</button></div>` : '';
  return show(M, fan);
};

/* 하루 시계: 일정을 둥근 시계로. 순서마다 길이에 비례한 호, 바깥에 눈금과 시작 시각, 가운데에 전체 길이. 아래 목록이 같은 내용의 글(그림은 꾸밈) */
const REST = /쉬는|휴식|점심|식사|break|lunch/i;
function dialRows(M) {
  const rows = (M.sched?.items || []).map((x, n, all) => { const a = toMin(x.start), b = toMin(x.end) ?? toMin(all[n + 1]?.start); return { start: x.start, title: x.title, min: a !== null && b !== null && b > a && b - a <= 600 ? b - a : 0 }; });
  if (rows.length >= 2 && rows.length <= 12 && rows.every((r) => r.min) && !M.sched.items.some((x) => x.date)) return { rows, timed: true, href: '#' + M.sched.id };
  const parts = (M.outline?.items || M.st?.items || []).slice(0, 8).map((x) => ({ start: x.part || '', title: x.title, min: 1 }));
  return parts.length >= 2 ? { rows: parts, timed: false, href: '#' + (M.outline || M.st)?.id } : null;
}
C.dial = (M) => {
  const D = dialRows(M);
  let art = '';
  if (D) {
    const T = D.rows.reduce((s, r) => s + r.min, 0); let at = 0;
    const segs = D.rows.map((r, i) => {
      const len = (r.min / T) * 1000, th = (at / 1000) * 2 * Math.PI - Math.PI / 2;
      const seg = `<circle class="lp-dial-seg${D.timed && REST.test(r.title) ? ' is-rest' : ''}" style="--i:${i}" data-i="${i}" data-start="${esc(r.start)}" data-min="${D.timed ? r.min : ''}" data-title="${esc(r.title)}" cx="200" cy="200" r="150" pathLength="1000" stroke-dasharray="${Math.max(1, len - 4).toFixed(1)} 1000" stroke-dashoffset="${(-(at + 2)).toFixed(1)}"/>`;
      const cth = Math.cos(th), tick = D.timed && (i === 0 || len >= 70) ? `<text x="${(200 + cth * 187).toFixed(1)}" y="${(204 + Math.sin(th) * 190).toFixed(1)}"${Math.abs(cth) > 0.3 ? ` text-anchor="${cth > 0 ? 'start' : 'end'}"` : ''}>${esc(r.start)}</text>` : '';
      at += len; return { seg, tick };
    });
    // 바깥 눈금: 두 시간까지는 5분, 다섯 시간까지는 10분, 그 위로는 30분마다 한 칸
    const unit = T <= 120 ? 5 : T <= 300 ? 10 : 30, n = D.timed && T % unit === 0 ? T / unit : 0;
    const bezel = n ? `<circle class="lp-dial-bezel" cx="200" cy="200" r="172" pathLength="${n * 10}" stroke-dasharray=".3 9.7" stroke-dashoffset=".15"/>` : '';
    const dur = M.dur ? (M.dur.text ? `<b class="lp-dial-dt">${esc(M.dur.text)}</b>` : `<b>${M.dur.num}</b><span>${esc(M.dur.unit)}</span>`) : `<b>${D.rows.length}</b><span>${D.timed ? '순서' : '부'}</span>`;
    art = `<div class="lp-dial"${artFx(M, 'schedule-dial')} data-date="${D.timed ? esc(M.m.date) : ''}" style="--n:${D.rows.length};--r:${Math.ceil(D.rows.length / 2)}"><div class="lp-dial-ring"><svg viewBox="0 0 400 400" aria-hidden="true" focusable="false"><circle class="lp-dial-track" cx="200" cy="200" r="150"/><g transform="rotate(-90 200 200)">${bezel}${segs.map((x) => x.seg).join('')}</g><g class="lp-dial-ticks">${segs.map((x) => x.tick).join('')}</g><line class="lp-dial-hand" x1="200" y1="68" x2="200" y2="22"/></svg><p class="lp-dial-center" data-dial-center aria-hidden="true">${dur}${M.time ? `<small>${esc(M.time)}</small>` : ''}</p></div>
<ol class="lp-dial-list" aria-label="${D.timed ? '오늘의 일정' : '오늘의 차례'}">${D.rows.map((r, i) => `<li data-i="${i}"><a href="${esc(D.href)}">${r.start ? `<time>${esc(r.start)}</time>` : ''}<span>${esc(r.title)}</span>${D.timed ? `<small>${r.min}분</small>` : ''}</a></li>`).join('')}</ol></div>`;
  }
  return show(M, art);
};

/* 입체 궤도: 점으로 짠 입체 매듭(토러스 매듭 관)과 그 둘레를 도는 이 연수의 낱말. 정지 그림은 효과(orbit-3d)가 시작하는 각도 그대로라 움직임이 실려도 튀지 않음 */
/** 둘레에 띄울 낱말 3~5개: 차례의 꼬리표 → 실습 이름 → 도구 이름 → 차례·일정 제목(짧은 것만) */
function orbitWords(M) {
  const strip = (t) => String(t || '').replace(/^\s*(?:PART|Part|파트)\s*\d{1,2}\s*[.:·\-–—]?\s*/, '').replace(/^\s*(?:실습|활동|이야기)\s*[\d·,~\-]+\s*/, '').trim();
  const short = (t) => { const x = strip(t).split(/[,:(·]| - /)[0].trim(); return x && [...x].length <= 9 ? x : ''; };
  const oi = M.outline?.items || [];
  const tags = []; for (let k = 0; k < 3; k++) for (const x of oi) if (x.tags?.[k]) tags.push(x.tags[k]);
  const pool = [...tags, ...(M.st?.items || []).map((x) => x.name || x.title), ...(M.tools?.items || []).map((x) => x.name), ...oi.map((x) => x.title), ...(M.sched?.items || []).map((x) => x.title)];
  const out = [];
  for (const t of pool) { const w = short(t); if (w && !out.includes(w) && !REST.test(w)) out.push(w); if (out.length === 5) break; }
  return out.length >= 3 ? out : [];
}
// orbit-3d.js와 같은 값·같은 식. 세잎 매듭(trefoil) 관을 단면 M개 × 둘레 K줄의 점으로 짬. TW = 관을 한 바퀴 도는 동안 점 줄이 감기는 횟수
const KNOT = { M: 100, K: 8, RHO: 0.5, TW: 11, D: 9, S: 42, SPIN: 0.3, AX: 0.55, RT: 4.3, TILT: 1.2 };
/** 관의 뼈대: 단면마다 [중심, 법선, 종법선]. 법선은 비틀림 없이 옮겨 가고(평행 이동), 한 바퀴 뒤 어긋난 각(hol)을 돌려줌 */
export function knotFrames(M) {
  const at = (t) => [Math.sin(t) + 2 * Math.sin(2 * t), Math.cos(t) - 2 * Math.cos(2 * t), -Math.sin(3 * t)];
  const F = []; let n = [0, 0, 1], hol = 0;
  for (let i = 0; i <= M; i++) {
    const t = (i / M) * Math.PI * 2, a = at(t - 0.001), b = at(t + 0.001), c = at(t);
    let T = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const tl = Math.hypot(...T); T = T.map((v) => v / tl);
    const dt = n[0] * T[0] + n[1] * T[1] + n[2] * T[2]; n = [n[0] - dt * T[0], n[1] - dt * T[1], n[2] - dt * T[2]]; const nl = Math.hypot(...n); n = n.map((v) => v / nl);
    const B = [T[1] * n[2] - T[2] * n[1], T[2] * n[0] - T[0] * n[2], T[0] * n[1] - T[1] * n[0]];
    if (i < M) F.push([c, n, B]); else hol = Math.atan2(n[0] * F[0][2][0] + n[1] * F[0][2][1] + n[2] * F[0][2][2], n[0] * F[0][1][0] + n[1] * F[0][1][1] + n[2] * F[0][1][2]);
  }
  return { F, hol };
}
export function orbitArt(words = [], attr = '') {
  const { M: N, K, RHO, TW, D, S, SPIN, AX, RT, TILT } = KNOT, TAU = Math.PI * 2;
  const { F, hol } = knotFrames(N);
  const sz = Math.sin(SPIN), cz = Math.cos(SPIN), sx = Math.sin(AX), cx = Math.cos(AX);
  // 점: 색(주색·글자색·강조색) × 깊이 세 단계로 묶어 path 하나씩(점마다 요소를 두지 않음). 좌표는 800 격자의 정수
  const groups = {};
  for (let i = 0; i < N; i++) {
    const [c, n, B] = F[i];
    for (let j = 0; j < K; j++) {
      const f = (j / K) * TAU + (i / N) * (TW * TAU - hol), co = Math.cos(f) * RHO, si = Math.sin(f) * RHO;
      const x = c[0] + co * n[0] + si * B[0], y = c[1] + co * n[1] + si * B[1], z = c[2] + co * n[2] + si * B[2];
      const x1 = x * cz - y * sz, y0 = x * sz + y * cz, y1 = y0 * cx - z * sx, z2 = y0 * sx + z * cx, k = (D / (D + z2)) * S;
      (groups[(j === 0 ? 'a' : j === 4 ? 'f' : 'p') + (z2 < -0.9 ? 2 : z2 < 0.9 ? 1 : 0)] ||= []).push([Math.round((200 + x1 * k) * 2), Math.round((200 + y1 * k) * 2)]);
    }
  }
  const dots = Object.entries(groups).map(([g, list]) => { let px = 0, py = 0; return `<path class="lp-orbit-${g[0]}" data-z="${g[1]}" d="${list.map(([x, y], n) => { const q = `m${x - px} ${y - py}h${n % 2 ? '-' : ''}.01`; px = x; py = y; return q; }).join('').replace(/ -/g, '-')}"/>`; }).join(''); // 점 = 길이 .01짜리 선(둥근 끝). 오른쪽·왼쪽으로 번갈아 그어 자리가 밀리지 않음
  // 낱말이 도는 고리(기울어진 원)와 낱말 자리
  const ring = (a) => { const y0 = RT * Math.sin(a), z = y0 * Math.sin(TILT), k = (D / (D + z)) * S; return [200 + RT * Math.cos(a) * k, 200 + y0 * Math.cos(TILT) * k, z]; };
  let rp = ''; for (let i = 0; i < 60; i++) { const [x, y] = ring((i / 60) * TAU); rp += `${i ? 'L' : 'M'}${Math.round(x * 2)} ${Math.round(y * 2)}`; }
  const tags = words.length ? `<ul class="lp-orbit-tags">${words.map((w, i) => { const [x, y, z] = ring(0.62 + (i / words.length) * TAU); return `<li style="left:${(x / 4).toFixed(1)}%;top:${(y / 4).toFixed(1)}%;--x:${(x / 4).toFixed(1)};--z:${(0.5 - z / (2 * RT)).toFixed(2)}">${esc(w)}</li>`; }).join('')}</ul>` : '';
  return `<div class="lp-orbit"${attr} aria-hidden="true"><svg viewBox="0 0 800 800" focusable="false"><path class="lp-orbit-ring" d="${rp}Z"/>${dots}</svg>${tags}</div>`;
}
C.orbit = (M) => show(M, orbitArt(orbitWords(M), artFx(M, 'orbit-3d')));

/* 돌과 물결: 연수 제목에서 나온 그림. 돌 두세 개를 돌아 흐르는 물결 선(돌 둘레의 퍼텐셜 흐름) — 같은 제목이면 늘 같은 그림. 효과(stream-lines)가 실리면 선이 흐르고 포인터가 돌이 됨 */
/** 그림의 씨앗 값: stream-lines.js와 같은 순서로 뽑음 */
export function streamScene(seed) {
  const r = seeded(hashStr(seed));
  const th = (r() - 0.5) * 0.7, A = 9 + r() * 9, kx = 0.008 + r() * 0.006, ky = 0.006 + r() * 0.006, p1 = r() * 6.283, p2 = r() * 6.283;
  const st = [[150 + r() * 110, 140 + r() * 90, 54 + r() * 18]];
  const b = [84 + r() * 232, 372 + r() * 28, 26 + r() * 14]; st.push(b);
  const c = [276 + r() * 84, 84 + r() * 332, 11 + r() * 8];
  if (r() < 0.62 && st.every((s) => Math.hypot(s[0] - c[0], s[1] - c[1]) > s[2] + c[2] + 34)) st.push(c);
  return { th, A, kx, ky, p1, p2, st, off: r() * 11 };
}
/** 물결 선들: 흐름에 직각인 줄에서 11 간격으로 떠나 흐름을 따라감(선은 서로 만나지 않음) */
export function streamLines(sc, t = 0, extra = null) {
  const sn = Math.sin(sc.th), cs = Math.cos(sc.th), st = extra ? sc.st.concat([extra]) : sc.st, lines = [];
  const vel = (x, y) => {
    const a = sc.kx * x + sc.p1 + t, b = sc.ky * y + sc.p2;
    let px = -sn + sc.A * sc.kx * Math.cos(a) * Math.cos(b), py = cs - sc.A * sc.ky * Math.sin(a) * Math.sin(b);
    for (const s of st) { const dx = x - s[0], dy = y - s[1], d2 = dx * dx + dy * dy || 1, L = -dx * sn + dy * cs, q = (s[2] * s[2]) / (d2 * d2); px -= q * (-sn * d2 - 2 * L * dx); py -= q * (cs * d2 - 2 * L * dy); }
    const l = Math.hypot(px, py) || 1; return [py / l, -px / l];
  };
  const out = (p) => { for (const s of st) { const dx = p[0] - s[0], dy = p[1] - s[1], d = Math.hypot(dx, dy) || 1, m = s[2] + 2.5; if (d < m) { p[0] = s[0] + (dx / d) * m; p[1] = s[1] + (dy / d) * m; } } return p; };
  for (let s = -330 + sc.off; s < 330; s += 11) {
    let p = [200 - cs * 330 - sn * s, 250 - sn * 330 + cs * s]; const pts = [];
    for (let i = 0; i < 72; i++) {
      if (p[0] > -14 && p[0] < 414 && p[1] > -14 && p[1] < 514) pts.push(p[0], p[1]); else if (pts.length) break;
      const v = vel(p[0], p[1]), w = vel(p[0] + v[0] * 5, p[1] + v[1] * 5);
      p = out([p[0] + w[0] * 10, p[1] + w[1] * 10]);
    }
    lines.push(pts);
  }
  return lines;
}
export function streamArt(seed, attr = '') {
  const sc = streamScene(seed), lines = streamLines(sc);
  const d = (keep) => lines.filter((pts, i) => pts.length > 8 && keep(i)).map((pts) => { let x = Math.round(pts[0]), y = Math.round(pts[1]), s = `M${x} ${y}l`; for (let i = 2; i < pts.length; i += 2) { const nx = Math.round(pts[i]), ny = Math.round(pts[i + 1]); s += `${i > 2 ? ' ' : ''}${nx - x} ${ny - y}`; x = nx; y = ny; } return s; }).join('').replace(/ -/g, '-');
  return `<figure class="lp-stream"${attr} data-seed="${esc(seed)}" aria-hidden="true"><div class="lp-stream-plate"><svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" focusable="false">${sc.st.map((s, i) => `<circle class="lp-stream-s${i}" cx="${s[0].toFixed(1)}" cy="${s[1].toFixed(1)}" r="${s[2].toFixed(1)}"/>`).join('')}<path class="lp-stream-l" d="${d((i) => i % 6 !== 2)}"/><path class="lp-stream-l lp-stream-b" d="${d((i) => i % 6 === 2)}"/></svg></div><figcaption>연수 제목으로 그린 그림</figcaption></figure>`;
}
C.stream = (M) => show(M, streamArt(seedOf(M), artFx(M, 'stream-lines')));

// ── 배치가 다른 첫 화면 여섯 가지(가운데·오른쪽·세로쓰기·어긋난 격자·반반 화면·그림 가득) ──
Object.assign(C, graphicHeroes({ org, state, h1, sub, ctas, metaDl, cell, numCell, pick, seeded, hashStr, seedOf, longDate, shortDate, isoDate, dialRows, artFx, fx, REST }));

/** 다른 첫 화면에 꾸밈으로 얹을 때도 정지 그림을 먼저 그려 둠(효과가 꺼져도 완성된 모습) */
const DECOR_ART = { 'orbit-3d': () => orbitArt(), 'stream-lines': (M) => streamArt(seedOf(M)) };

/** 프리셋 구성 이름 → 렌더(옛 이름 stage·split·center·editorial도 받음) */
const ALIAS = { stage: 'cinema', split: 'worksheet', center: 'quiet', editorial: 'masthead' };
export const HERO_COMPOSITIONS = Object.keys(C);
export function heroComposition(ctx) {
  const v = getPreset(ctx.design.preset).variants.hero;
  return C[v] ? v : ALIAS[v] || 'cinema';
}

export function renderHero(s, ctx, helpers) {
  const comp = heroComposition(ctx);
  const M = model(s, ctx, helpers);
  // 칠판은 그래픽(분필 낙서)을 칠판 안에 그림
  const graphic = ctx.design.graphic && comp !== 'board' && OWN_ART[comp] !== ctx.design.graphic ? `<div class="lp-hero-graphic" data-fx="${esc(ctx.design.graphic)}" aria-hidden="true">${DECOR_ART[ctx.design.graphic]?.(M) || ''}</div>` : '';
  const ov = ctx.design.effects?.['hero.graphic.overlay'];
  const overlay = ov ? `<div class="lp-hero-overlay" data-fx="${esc(ov)}" aria-hidden="true"></div>` : '';
  return `<section id="${M.id}" class="lp-sec lp-hero lp-hero--${comp}"${s.tone ? ` data-tone="${esc(s.tone)}"` : ''} aria-labelledby="${M.id}-h">
${graphic}${overlay}
${C[comp](M)}
</section>`;
}
