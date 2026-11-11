// 첫 화면: 프리셋마다 다른 구성(composition). 꾸밈이 아니라 실제 내용(일시·실습·교재·일정·도구)으로 짭니다.
// 구성 이름은 프리셋 variants.hero → <html data-hero>와 .lp-hero--<이름>. 모양은 runtime/lecpage.css '첫 화면' 묶음.
//   cinema(밤하늘 서사) · worksheet(종이 워크북) · bento(유리 실험실) · poster(놀이터) · quiet(숲의 숨) · brief(공식 브리핑)
//   masthead(잉크 잡지) · sticker(도파민 팝) · board(칠판 교실) · spec(설계도) · zine(형광 인쇄) · invite(새벽빛)
// 규칙
//  - 값이 있는 것만 보여 줍니다(빈 칸·가짜 숫자 없음). 꾸밈 글자(큰 날짜 등)는 실제 값의 되풀이이고 aria-hidden.
//  - 모든 글은 JS 없이 읽히고, 움직임이 꺼져도 완성된 모습입니다.
//  - 연수 전·중·후(data-hero-state): 참가자 화면이 '시작까지 3일' · '지금 진행 중' · '끝난 연수'를 채웁니다.
//  - 두 구성이 같은 뼈대를 쓰지 않습니다(scripts/design-lint.mjs의 hero-skeleton 검사).
import { esc, br, href, fx, pad2, icon, koDate } from './html.js';
import { getPreset } from '../design/presets.js';

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
  const graphic = ctx.design.graphic && comp !== 'board' ? `<div class="lp-hero-graphic" data-fx="${esc(ctx.design.graphic)}" aria-hidden="true"></div>` : '';
  const ov = ctx.design.effects?.['hero.graphic.overlay'];
  const overlay = ov ? `<div class="lp-hero-overlay" data-fx="${esc(ov)}" aria-hidden="true"></div>` : '';
  return `<section id="${M.id}" class="lp-sec lp-hero lp-hero--${comp}"${s.tone ? ` data-tone="${esc(s.tone)}"` : ''} aria-labelledby="${M.id}-h">
${graphic}${overlay}
${C[comp](M)}
</section>`;
}
