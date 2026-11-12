// 섹션 렌더러: 섹션 객체 → HTML 문자열. 모든 섹션은 JS 없이도 내용이 다 보여야 합니다.
import { esc, br, href, host, md, fx, pad2, icon, koDate } from './html.js';
import { renderHero, heroComposition, dateParts, titleRandom } from './hero.js';
import { mosaicSvg } from './hero-graphic.js';
import { getPreset, presetPlan } from '../design/presets.js';
import { contentRenderers, CONTENT_LAYOUTS } from './content.js'; // 본문 칸(절차·사례·질문·표·글)
import { variantOf, motifFamily } from '../design/layouts.js'; // 본문 배치 변형(섹션 종류마다 구조가 다른 배치)
import { bodyVariants, firstGlyph } from './body-variants.js';
import { motifSvg, motifRule } from './body-graphic.js';
import { inlineMd } from './markdown.js';

/** 실습·질문·교재처럼 따라 하며 쓰는 칸: 움직임은 차분 단계(1)까지만 */
export const CALM_TYPES = ['stations', 'qa', 'deck', 'board', 'poll', 'prompts'];
const hasDeck = (ctx) => ctx.bp.sections.some((x) => x.type === 'deck');
const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };

/** 원본 표시("교재가 원본이다"): 교재 n쪽. 교재 칸이 있으면 그 쪽으로 가는 링크 */
export function sourceLine(source, ctx, cls = 'lp-src') {
  const pages = source?.pages || [];
  if (!pages.length) return '';
  const deck = hasDeck(ctx);
  return `<p class="${cls}">교재 ${pages.map((p) => (deck ? `<a href="#deck-p${p}">${p}쪽</a>` : `${p}쪽`)).join(', ')}</p>`;
}

/** 섹션 번호(제목 옆 작은 표시): 첫 화면·마무리를 뺀 칸의 순서. 프리셋마다 모양이 다름(CSS) */
function secNo(s, ctx) {
  const list = ctx.bp.sections.filter((x) => x.type !== 'hero' && x.type !== 'closing');
  const i = list.indexOf(s);
  return i < 0 ? list.findIndex((x) => x.id === s.id) + 1 : i + 1;
}

/**
 * 섹션이 화면에 들어올 때의 움직임(프리셋의 페이지 연출 계획 plan.enter): 프리셋마다 기본 방식이 다르고 섹션 종류에 따라 바뀜.
 * 모두 reveal-up 효과의 방식(mode)이라 차분 단계(1)부터 실리고, 글은 들어온 뒤 멈춤. 정적 단계(0)에는 붙이지 않음.
 * 따라 하는 칸(head = true)은 머리만 조용히(fade·rise). 그 밖의 칸은 머리의 줄과 내용의 낱개(목록 줄·카드)가 짧게 차례로.
 * 같은 요소를 두 가지가 움직이지 않게 뺌: 스크롤에 맞춰 겹쳐 쌓이는 차례(보통 단계부터), 스크롤에 맞춰 켜지는 계단(스크롤 연출),
 * 선이 그려지는 일정 줄, 제 효과가 있는 섹션 제목.
 */
const ENTER_ITEMS = {
  ledger: '.lp-goal-list > li, .lp-goal-meta', figures: '.lp-glance-item', steps: '.lp-steps5 > li, .lp-close-line', stack: '.lp-outline-item',
  timeline: '.lp-sched-bar, .lp-schedule > li', checklist: '.lp-checklist > li', bento: '.lp-tools-item', files: '.lp-materials > li, .lp-wrap > .lp-note',
  accordion: '.lp-faq > details', profile: '.lp-person-card, .lp-tl-group', people: '.lp-speakers > li', course: '.lp-sessions > li', index: '.lp-glossary > div',
  media: '.lp-gallery > li, .lp-videos > li', form: '.lp-sv-list > li',
};
function enterFx(s, ctx, head) {
  const rest = ctx.design.rest ?? ctx.design.motion ?? 1;
  if (rest < 1) return '';
  const plan = presetPlan(getPreset(ctx.design.preset)).enter;
  let mode = plan[s.type] || plan.default;
  if (head) return ` data-fx="reveal-up" data-fx-opts='${esc(JSON.stringify({ mode: mode === 'rise' || mode === 'side' ? mode : 'fade', each: true }))}'`;
  const layout = LAYOUTS[s.type] || 'prose', fxs = ctx.design.effects || {};
  // 배치 변형: 그 배치의 낱개와 어울리는 방식(프리셋이 그 섹션 종류에 떠오르기가 아닌 방식을 따로 정했으면 그것)
  const v = variantOf(s, ctx.design.preset);
  if (v.meta && !v.isDefault) {
    const m = (plan[s.type] && plan[s.type] !== 'rise' ? plan[s.type] : '') || v.meta.mode || plan.default;
    const own = rest >= 2 ? v.meta.enter2 : v.meta.enter;
    const items = [fxs['section.title'] ? '.lp-head > :not(.lp-h2)' : '.lp-head > *', own].filter(Boolean).join(', ');
    return ` data-fx="reveal-up" data-fx-opts='${esc(JSON.stringify({ mode: m, items }))}'`;
  }
  let body = ENTER_ITEMS[layout] || '.lp-wrap > :not(.lp-head)';
  if (layout === 'stack' && (rest >= 2 || fxs.cards === 'stack-cards')) body = '';
  if (layout === 'steps' && rest >= 3) body = '.lp-close-line';
  if (layout === 'timeline' && fxs.schedule) body = '.lp-sched-bar';
  const items = [fxs['section.title'] ? '.lp-head > :not(.lp-h2)' : '.lp-head > *', body].filter(Boolean).join(', ');
  return ` data-fx="reveal-up" data-fx-opts='${esc(JSON.stringify({ mode, items }))}'`;
}

/**
 * 섹션 머리: 번호(+메뉴 이름) · 제목 · 설명 · 원본 쪽. 모양은 프리셋마다 다름(<html data-head>, runtime/lecpage.css '섹션 머리').
 * 번호 줄은 메뉴와 같은 정보라 화면 낭독기에는 숨김
 */
function head(s, ctx, fallbackTitle) {
  const title = s.title || fallbackTitle;
  if (!title && !s.lead) return '';
  const no = secNo(s, ctx);
  // 따라 하는 칸(실습·질문·교재 등)의 제목에는 움직이는 효과를 붙이지 않음
  const tfx = CALM_TYPES.includes(s.type) ? '' : fx(ctx, 'section.title');
  const label = s.nav && s.nav !== title ? s.nav : '';
  const k = no > 0 && title ? `<p class="lp-head-k" aria-hidden="true"><span class="lp-head-no">${pad2(no)}</span>${label ? `<span class="lp-head-label">${esc(label)}</span>` : ''}</p>` : '';
  return `<header class="lp-head"${CALM_TYPES.includes(s.type) ? enterFx(s, ctx, true) : ''}>${k}${title ? `<h2 class="lp-h2" id="${esc(s.id)}-h"${tfx}>${br(title)}</h2>` : ''}${s.lead ? `<p class="lp-lead">${br(s.lead)}</p>` : ''}${sourceLine(s.source, ctx)}</header>`;
}

/**
 * 섹션 배치(data-layout): 내용이 모양을 정함. 같은 배치가 줄지어 나오지 않게 함(scripts/design-lint.mjs 'layout-repeat').
 * 줄 목록 계열(ROWS)은 머리 왼쪽·목록 오른쪽(split)이 기본이고, 연달아 나오면 한 칸 걸러 머리 위·두 단 목록(wide)으로 바꿈
 */
export const LAYOUTS = {
  goals: 'ledger', glance: 'figures', message: 'statement', steps5: 'steps', outline: 'stack', schedule: 'timeline', readiness: 'checklist',
  deck: 'viewer', stations: 'workbench', tools: 'bento', prompts: 'library', qa: 'thread', board: 'wall', poll: 'panel', quiz: 'quiz', attendance: 'gate',
  materials: 'files', instructor: 'profile', speakers: 'people', sessions: 'course', survey: 'form', followup: 'files', closing: 'finale',
  faq: 'accordion', glossary: 'index', video: 'media', gallery: 'media', reflection: 'journal', text: 'prose',
};
Object.assign(LAYOUTS, CONTENT_LAYOUTS);
const ROWS = ['schedule', 'faq', 'materials', 'followup', 'sessions'];
/** 옅은 바탕을 까는 칸(색 흐름): 차례·교재·실습·강사·용어·연사 */
const TINTED = ['outline', 'deck', 'stations', 'instructor', 'glossary', 'speakers'];
export function frameOf(s, ctx) {
  if (s.type === 'message' || s.type === 'closing') return 'band';
  if (!ROWS.includes(s.type)) return 'stack';
  const list = ctx.bp.sections; const i = list.indexOf(s);
  let run = 0; for (let k = i - 1; k >= 0 && ROWS.includes(list[k].type); k--) run++;
  return run % 2 ? 'wide' : 'split';
}
/** 화면 폭을 채우는 띠(핵심 메시지·마무리)의 바탕: 프리셋 variants.band. invert면 그 자리만 반대 테마 색(theme.css .lp-invert) */
function bandClass(ctx) { return getPreset(ctx.design.preset).variants.band === 'invert' ? ' lp-bleed lp-invert' : ' lp-bleed'; }

/** 컨셉 모티프의 그림 가족: 컨셉의 motif 글 → 프리셋 */
export const famOf = (ctx) => motifFamily(ctx.bp, ctx.design.preset);
/**
 * 모티프 되풀이(꾸밈, aria-hidden): 바탕이 같은 두 섹션 사이에는 모티프 한 줄을 구분 장식으로, 옅은 바탕 칸의 구석에는 모티프 그림을 옅게.
 * 그림 크기를 지키려고 구분 장식은 한 칸 걸러, 구석 그림은 앞의 두 칸에만
 */
function motifDeco(s, ctx, frame, calm) {
  if (calm || frame === 'band' || ctx.design.motion === 0 && ctx.design.rest === 0) return '';
  const list = ctx.bp.sections, i = list.indexOf(s), prev = list[i - 1], fam = famOf(ctx);
  const plain = (x) => x && x.type !== 'hero' && !TINTED.includes(x.type) && !['message', 'closing'].includes(x.type) && !CALM_TYPES.includes(x.type);
  let out = '';
  if (plain(s) && plain(prev) && secNo(s, ctx) % 2 === 1) out += `<div class="lp-mrule-w" aria-hidden="true">${motifRule(fam, s.id)}</div>`;
  if (TINTED.includes(s.type) && list.filter((x) => TINTED.includes(x.type) && !CALM_TYPES.includes(x.type)).indexOf(s) < 2) out += `<div class="lp-mbg" aria-hidden="true">${motifSvg(fam, `${ctx.bp.meta.title}|bg|${s.id}`, { w: 480, h: 320, glyph: firstGlyph(s.title || ctx.bp.meta.title), lite: true })}</div>`;
  return out;
}

function wrap(s, ctx, inner, extraAttrs = '') {
  const labelled = s.title ? ` aria-labelledby="${esc(s.id)}-h"` : '';
  const enterId = ctx.design.effects?.['section.enter'];
  const calm = CALM_TYPES.includes(s.type);
  const v = variantOf(s, ctx.design.preset);
  const frame0 = frameOf(s, ctx), frame = v.meta?.frame === 'full' && frame0 !== 'band' ? 'full' : frame0;
  // 선생님이 섹션 등장 효과를 직접 골랐으면 그것을, 아니면 프리셋의 페이지 연출 계획대로(화면 폭 띠는 제 움직임이 따로 있음)
  const enter = calm || frame === 'band' ? '' : enterId ? ` data-fx="${esc(enterId)}"` : enterFx(s, ctx, false);
  const preset = getPreset(ctx.design.preset);
  const cls = `lp-sec lp-sec-${esc(s.type)}${frame === 'band' ? bandClass(ctx) : ''}${TINTED.includes(s.type) ? ' lp-tinted' : ''}`;
  // '움직이는 글자' 프리셋: 섹션 제목이 뒤에서 윤곽선으로 크게 메아리침(CSS가 data-echo를 읽음). 따라 하는 칸에는 두지 않음
  const echo = !calm && s.title && frame !== 'band' && preset.variants.hero === 'ticker' ? ` data-echo="${esc(String(s.title).replace(/\n/g, ' ').slice(0, 40))}"` : '';
  // '표지 한 장' 프리셋: 섹션 제목의 첫 글자가 뒤에 크게 깔림(첫 화면 포스터의 되풀이). '시간 점묘': 섹션 위 점 줄에 지나온 섹션만큼 색 점(--no)
  const glyph = !calm && s.title && frame !== 'band' && preset.variants.hero === 'cover' ? ` data-glyph="${esc([...String(s.title).trim()].find((ch) => /[\p{L}\p{N}]/u.test(ch)) || '')}"` : '';
  const no = preset.variants.align === 'ledger' && frame !== 'band' ? ` style="--no:${secNo(s, ctx)}"` : '';
  // 배치 변형: data-variant(구조) · data-lead(주인공: 글·숫자·그림·도식·조작) · data-stance(이 섹션만 가운데·오른쪽)
  const vat = v.meta ? ` data-variant="${esc(v.variant)}" data-lead="${v.meta.lead}"${v.stance ? ` data-stance="${v.stance}"` : ''}` : '';
  const layout = v.meta && !v.isDefault ? v.variant : LAYOUTS[s.type] || 'prose';
  return `<section id="${esc(s.id)}" class="${cls}" data-layout="${esc(layout)}" data-frame="${frame}"${vat}${echo}${glyph}${no}${calm ? ' data-calm' : ''}${s.tone ? ` data-tone="${esc(s.tone)}"` : ''}${labelled}${enter}${extraAttrs}>\n${motifDeco(s, ctx, frame, calm)}<div class="lp-wrap">${inner}</div>\n</section>`;
}

// ── 배치 변형으로 그리기(기본 배치가 아닐 때). 기본 배치는 아래 섹션별 함수가 그대로 그림 ──
let VBC = null;
const VB = () => VBC || (VBC = bodyVariants({ esc, br, pad2, icon, href, host, koDate, fx, md, sourceLine, itemFx, groupFx, completionLine, bentoSpans, hasDeck, famOf }));
const FALLBACK = { goals: '연수 목표', outline: '오늘의 차례', schedule: '일정', tools: '도구 모음', materials: '연수 자료', followup: '연수 후 안내', instructor: '강사 소개', speakers: '연사', sessions: '차시', faq: '자주 묻는 질문', glossary: '용어 풀이', procedure: '절차', cases: '사례', discuss: '함께 나눌 질문' };
/** 일정 순서마다 걸리는 분(끝 시각이 없으면 다음 순서의 시작까지). 알 수 없으면 0 */
function schedMins(s) {
  return s.items.map((i, n) => { const a = toMin(i.start), b = toMin(i.end) ?? toMin(s.items[n + 1]?.start); return a !== null && b !== null && b > a && b - a <= 600 ? b - a : 0; });
}
function variantSection(s, ctx) {
  const v = variantOf(s, ctx.design.preset);
  if (!v.meta || v.isDefault || ['deck', 'message', 'closing'].includes(s.type)) return null;
  const fn = VB().VB[v.type]?.[v.variant];
  if (!fn) return null; // 모양만 바뀌는 배치(따라 하는 칸·교재·메시지·마무리)는 원래 함수가 data-variant를 달고 그림
  let body = '';
  if (s.type === 'schedule') body = fn(s, ctx, { mins: schedMins(s) }); // 시간 도식은 모든 길이를 알 때만 고름(layouts.js knownDay)
  else if (s.type === 'glance') body = fn(s, ctx, { numParts });
  else if (s.type === 'materials') body = fn(s, ctx, { rows: s.items.map((m) => ({ kind: m.kind || 'FILE', title: m.title, desc: m.desc, size: m.size, url: m.href, download: !!m.href && !/^https?:/.test(m.href) })) }) + (s.notice ? `<div class="lp-notice-box"><b>자료 이용 안내</b><p>${br(s.notice)}</p></div>` : '');
  else if (s.type === 'followup') {
    const contact = ctx.bp.meta.contact;
    body = (s.items.length ? fn(s, ctx, { rows: s.items.map((i) => ({ kind: FOLLOWUP_KIND[i.kind] || '링크', title: i.title, desc: i.desc, url: i.url })) }) : '') + (s.completion ? `<div class="lp-notice-box"><b>이수 안내</b><p>${br(s.completion)}</p></div>` : '') + (contact ? `<p class="lp-note">문의: ${contactHtml(contact)}</p>` : '');
    return wrap(s, ctx, head(s, ctx, FALLBACK.followup) + body, ' data-followup');
  } else if (s.type === 'sessions') body = fn(s, ctx, { auto: !s.items.some((x) => x.status) && s.items.some((x) => x.date) });
  else if (s.type === 'instructor') { if (!ctx.bp.instructors.length) return ''; body = fn(s, ctx); }
  else if (s.type === 'table') body = fn(s, ctx) + (s.note ? `<p class="lp-note">${inlineMd(s.note)}</p>` : '');
  else body = fn(s, ctx);
  return wrap(s, ctx, head(s, ctx, FALLBACK[s.type]) + body);
}

function liveOff(ctx) {
  return ctx.live ? '' : '<p class="lp-note" data-live-off>실시간 연결을 켜면 여기서 쓸 수 있어요.</p>';
}

/** 이수 기준(교육청 승인 직무연수일 때만): "3시간 · 출석 80% 이상 · 설문 제출" */
export function completionLine(ctx) {
  const a = ctx.bp.meta.admin || {};
  if (a.kind !== 'official') return '';
  const h = +a.hours || 0, hm = h % 1 ? `${Math.floor(h) ? `${Math.floor(h)}시간 ` : ''}${Math.round((h % 1) * 60)}분` : h ? `${h}시간` : '';
  const survey = ctx.live && ctx.bp.sections.some((s) => s.type === 'survey' && s.questions?.length);
  return [hm, a.completionRate ? `출석 ${a.completionRate}% 이상` : '', survey ? '설문 제출' : ''].filter(Boolean).join(' · ');
}

/** 온라인 회의 서비스 이름(입장 버튼·장소 표시용) */
const JOIN_NAMES = [[/(^|\.)zoom\.us$/, 'Zoom'], [/^meet\.google\.com$/, 'Google Meet'], [/^teams\.(microsoft|live)\.com$/, 'Teams'], [/(^|\.)webex\.com$/, 'Webex']];
export function joinName(url) { const h = host(url); for (const [re, n] of JOIN_NAMES) if (re.test(h)) return n; return ''; }
function joinCta(ctx) {
  const m = ctx.bp.meta;
  return m.joinUrl && m.mode !== 'offline' ? { label: `${joinName(m.joinUrl) || '온라인'} 입장`, href: m.joinUrl, join: true } : null;
}
function placeText(m) {
  const on = m.mode === 'offline' ? '' : `온라인${joinName(m.joinUrl) ? ` (${joinName(m.joinUrl)})` : ''}`;
  return [m.venue, on].filter(Boolean).join(' · ');
}

// ── 첫 화면: 프리셋마다 다른 구성(render/hero.js) ──────────────
function hero(s, ctx) { return renderHero(s, ctx, { placeText, completionLine, joinCta, defaultCtas }); }
function defaultCtas(ctx) {
  const order = ['stations', 'deck', 'outline', 'schedule', 'tools'];
  const out = [];
  for (const t of order) { const sec = ctx.bp.sections.find((x) => x.type === t); if (sec) { out.push({ label: { stations: '실습 시작하기', deck: '교재 보기', outline: '차례 보기', schedule: '일정 보기', tools: '도구 보기' }[t], href: '#' + sec.id }); if (out.length === 2) break; } }
  return out;
}

// ── 연수 목표: 마치면 할 수 있는 것, 대상, 이수 기준 ────────────
function goals(s, ctx) {
  const done = completionLine(ctx);
  const rows = [s.who && ['대상', s.who], done && ['이수', done]].filter(Boolean);
  // 큰 번호 + 문장. 번호는 꾸밈(순서는 <ol>이 알려 줌)이라 화면 낭독기에는 숨김
  return wrap(s, ctx, head(s, ctx, '연수 목표') + `<div class="lp-goals">
<ol class="lp-goal-list">${s.items.map((g, i) => `<li><span class="lp-goal-no" aria-hidden="true">${pad2(i + 1)}</span><p>${esc(g)}</p></li>`).join('')}</ol>
${rows.length ? `<div class="lp-goal-meta">${rows.map(([k, v]) => `<p><b>${k}</b> ${esc(v)}</p>`).join('')}</div>` : ''}
</div>`);
}

// ── 요약·메시지 ───────────────────────────────────────────
/** 숫자와 단위를 나눔("90분" → 90 + 분): 숫자는 아주 크게, 단위는 작게. 숫자로 시작하지 않으면 그대로 */
function numParts(v) {
  const m = /^(-?\d[\d,.]*)(\s*)(\D.{0,11})?$/.exec(String(v ?? '').trim());
  return m && m[3] ? { num: m[1], unit: m[3].trim() } : { num: String(v ?? ''), unit: '' };
}
function glance(s, ctx) {
  return wrap(s, ctx, head(s, ctx) + `<dl class="lp-glance-grid" style="--n:${s.items.length}">${s.items.map((i) => { const p = numParts(i.value); return `<div class="lp-glance-item"><dt>${esc(i.label)}</dt><dd><span class="lp-fig"><span class="lp-num"${fx(ctx, 'numbers')}>${esc(p.num)}</span>${p.unit ? `<span class="lp-unit">${esc(p.unit)}</span>` : ''}</span>${i.note ? `<small>${esc(i.note)}</small>` : ''}</dd></div>`; }).join('')}</dl>`);
}

/** 문장을 낱말 조각으로: 보통 단계부터 스크롤에 맞춰 낱말이 차례로 진해짐(CSS). 조각을 못 쓰는 환경에서도 같은 글 */
function words(text) {
  let i = 0;
  const html = String(text || '').split('\n').map((line) => line.split(/(\s+)/).map((w) => (/^\s*$/.test(w) ? w : `<span class="lp-w" style="--i:${i++}">${esc(w)}</span>`)).join('')).join('<br>');
  return { html, n: i };
}
/**
 * 핵심 메시지: 화면 폭을 채우는 띠에 큰 글자로.
 *  - 문장·인용: 보통 단계부터 스크롤에 맞춰 낱말이 차례로 진해짐(CSS). 효과가 따로 정해져 있으면 그 효과
 *  - 공식: 세로셈처럼 한 줄에 한 항씩 쌓고, 줄을 긋고, 답을 강조색으로
 * JS가 없거나 움직임이 꺼져 있으면 처음부터 다 진하게 보임
 */
function message(s, ctx) {
  let body, aside = '';
  // '스크롤 글 차오름'은 아직 차지 않은 낱말도 읽히는 진하기(0.45)에서 시작
  const mfx = fx(ctx, 'message', ctx.design.effects?.message === 'scroll-fill' ? { min: 0.45 } : undefined);
  const filled = (t) => { if (mfx) return { attr: mfx, html: br(t) }; const w = words(t); return { attr: ` style="--n:${Math.max(1, w.n)}"`, html: w.html }; };
  if (s.style === 'formula' && s.parts?.length) {
    const sr = s.parts.join(' 곱하기 ') + (s.result ? ' 는 ' + s.result : '');
    const n = s.parts.length + (s.result ? 1 : 0);
    body = `<p class="lp-formula" style="--n:${n}"><span class="lp-sr">${esc(sr)}</span><span class="lp-formula-rows" aria-hidden="true">${s.parts.map((p, i) => `<span class="lp-op" style="--i:${i}">${i ? '×' : ''}</span><span class="lp-term" style="--i:${i}">${esc(p)}</span>`).join('')}${s.result ? `<span class="lp-op lp-eq" style="--i:${s.parts.length}">=</span><span class="lp-term lp-result" style="--i:${s.parts.length}">${esc(s.result)}</span>` : ''}</span></p>`;
    if (s.text) aside += `<p class="lp-message-note">${br(s.text)}</p>`;
  } else if (s.style === 'quote') {
    const f = filled(s.text);
    body = `<blockquote class="lp-quote"><p${f.attr}>${f.html}</p>${s.cite ? `<cite>${esc(s.cite)}</cite>` : ''}</blockquote>`;
  } else {
    const f = filled(s.text);
    body = `<p class="lp-statement"${f.attr}>${f.html}</p>`;
  }
  if (s.note) aside += `<p class="lp-message-note">${br(s.note)}</p>`;
  const src = s.title ? '' : sourceLine(s.source, ctx);
  // 가운데 무대: 문장 뒤에 이 연수의 모티프 그림이 크게 깔림(꾸밈). 문장은 그림이 비켜 준 가운데 판 위
  const stage = variantOf(s, ctx.design.preset).variant === 'stage' ? `<div class="lp-stage-art" aria-hidden="true">${motifSvg(famOf(ctx), `${ctx.bp.meta.title}|stage|${s.id}`, { w: 960, h: 540, glyph: firstGlyph(ctx.bp.meta.title) })}</div>` : '';
  return wrap(s, ctx, `${s.title ? head(s, ctx) : ''}${stage}<div class="lp-message">${body}${aside || src ? `<div class="lp-message-side">${aside}${src}</div>` : ''}</div>`, ` data-style="${esc(s.style || 'statement')}"`);
}

function steps5(s, ctx) {
  return wrap(s, ctx, head(s, ctx) + `<ol class="lp-steps5" style="--n:${s.items.length}">${s.items.map((i, n) => `<li style="--i:${n}"><span class="lp-idx" aria-hidden="true">${pad2(n + 1)}</span><h3>${esc(i.word)}</h3>${i.desc ? `<p>${esc(i.desc)}</p>` : ''}</li>`).join('')}</ol>${s.close ? `<p class="lp-close-line">${br(s.close)}</p>` : ''}`);
}

/** 카드 칸 효과: '쌓이는 카드'는 목록 전체에(차례에서만), 그 밖의 효과는 항목마다 */
const cardsFx = (ctx) => ctx.design.effects?.cards || '';
const itemFx = (ctx) => (cardsFx(ctx) && cardsFx(ctx) !== 'stack-cards' && cardsFx(ctx) !== 'spotlight' ? fx(ctx, 'cards') : '');
/** 카드 조명(spotlight)은 목록 전체에 한 번: 포인터 가까운 카드의 테두리가 빛남 */
const groupFx = (ctx) => (cardsFx(ctx) === 'spotlight' ? ` data-fx="spotlight" data-fx-opts='{"mode":"cards"}'` : '');
/** 차례: 큰 번호가 붙은 넓은 판. 보통 단계부터 넓은 화면에서 판이 차례로 겹쳐 쌓임(CSS sticky, 움직임이 꺼지면 그냥 목록) */
function outline(s, ctx) {
  const stack = cardsFx(ctx) === 'stack-cards' ? ` data-fx="stack-cards" data-fx-opts='{"top":"104px"}'` : '';
  // 교재 쪽 그림이 있으면 그 부가 시작하는 쪽을 작은 그림으로(교재가 원본)
  const slides = ctx.bp.sections.find((x) => x.type === 'deck')?.slides || [];
  const thumb = (t) => { const sl = t && t.startsWith('deck:') ? slides.find((x) => String(x.page) === t.slice(5)) : null; return sl?.src ? `<img class="lp-outline-thumb" src="${esc(sl.src)}" alt="" loading="lazy" decoding="async">` : ''; };
  return wrap(s, ctx, head(s, ctx, '오늘의 차례') + `<ol class="lp-outline" style="--n:${s.items.length}"${stack || groupFx(ctx)}>${s.items.map((i, n) => {
    const target = i.target ? (i.target.startsWith('deck:') ? `#deck-p${i.target.slice(5)}` : '#' + i.target) : '';
    return `<li class="lp-outline-item" style="--i:${n}"${itemFx(ctx)}><span class="lp-outline-no" aria-hidden="true">${pad2(n + 1)}</span><div class="lp-outline-body">${i.part ? `<p class="lp-outline-part">${esc(i.part)}</p>` : ''}<h3>${esc(i.title)}</h3>${i.desc ? `<p>${esc(i.desc)}</p>` : ''}</div><div class="lp-outline-side">${thumb(i.target)}${i.tags.length ? `<ul class="lp-tags">${i.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}${target ? `<a class="lp-link" href="${esc(target)}">${target.startsWith('#deck-p') ? `교재 ${esc(i.target.slice(5))}쪽 보기` : '바로 가기'}${icon('arrow')}</a>` : ''}</div></li>`;
  }).join('')}</ol>`);
}

/**
 * 일정: 시간 레일. 큰 시각(고정폭) | 점과 선 | 내용 | 걸리는 시간. 줄 높이가 걸리는 시간에 비례(--min).
 * 모든 순서의 길이를 알 수 있고 하루 안이면 위에 '시간 막대'(길이에 비례한 칸)를 둠 — 실제 값의 그림이라 화면 낭독기에는 숨김
 */
function schedule(s, ctx) {
  const mins = s.items.map((i, n) => {
    const a = toMin(i.start), b = toMin(i.end) ?? toMin(s.items[n + 1]?.start);
    return a !== null && b !== null && b > a && b - a <= 600 ? b - a : 0;
  });
  const rows = s.items.map((i, n) => {
    const min = mins[n];
    return `<li data-start="${esc(i.start)}" data-end="${esc(i.end)}"${i.date ? ` data-date="${esc(i.date)}"` : ''}${min ? ` style="--min:${min}"` : ''}><time>${esc(i.start)}${i.end ? `<span>~${esc(i.end)}</span>` : ''}</time><div><h3>${esc(i.title)}</h3>${i.desc ? `<p>${esc(i.desc)}</p>` : ''}</div>${i.part || min ? `<span class="lp-schedule-part">${[i.part ? esc(i.part) : '', min ? `<span class="lp-schedule-min">${min}분</span>` : ''].filter(Boolean).join(' · ')}</span>` : ''}</li>`;
  }).join('');
  const oneDay = !s.items.some((i) => i.date) && s.items.length > 1 && s.items.length <= 12 && mins.every(Boolean);
  const bar = oneDay ? `<div class="lp-sched-bar" aria-hidden="true">${s.items.map((i, n) => `<i style="--min:${mins[n]}"><b>${esc(i.start)}</b></i>`).join('')}<em>${esc(s.items[s.items.length - 1].end || '')}</em></div>` : '';
  return wrap(s, ctx, head(s, ctx, '일정') + `<div class="lp-sched">${bar}<ol class="lp-schedule"${fx(ctx, 'schedule')} data-date="${esc(ctx.bp.meta.date)}">${rows}</ol></div>`);
}

// ── 준비 ─────────────────────────────────────────────────
function readiness(s, ctx) {
  const checks = s.checks.length ? `<div class="lp-diag" data-diag='${esc(JSON.stringify(s.checks))}'><div class="lp-diag-h"><h3>접속 확인</h3><button class="lp-btn lp-btn-ghost" type="button" data-diag-run>확인하기</button></div><ul class="lp-diag-list">${s.checks.map((c) => `<li data-url="${esc(c.url)}"><span class="lp-diag-dot" aria-hidden="true"></span><span>${esc(c.name)}</span><small>${esc(host(c.url))}</small><b class="lp-diag-state">확인 전</b></li>`).join('')}</ul><p class="lp-small">막힌 곳이 있으면 이 화면을 정보 담당 선생님께 보여 주세요.</p></div>` : '';
  return wrap(s, ctx, head(s, ctx, '시작 전에 준비해요') + `<div class="lp-ready${checks ? '' : ' is-solo'}"><ul class="lp-checklist" data-checklist="${esc(s.id)}">${s.items.map((i, n) => `<li><label><input type="checkbox" data-check="${n}"><span><b>${esc(i.label)}</b>${i.detail ? `<small>${br(i.detail)}</small>` : ''}</span></label>${i.url ? `<a class="lp-link" ${href(i.url)}>열기${icon('external')}</a>` : ''}</li>`).join('')}</ul>${checks}</div>`);
}

// ── 교재 보기 ─────────────────────────────────────────────
/** 쪽 제목 앞의 부 표시("PART 01 …", "1부 …", "제2장 …")를 떼어 냄 → { part, title } */
export function slidePart(title) {
  const m = /^\s*((?:PART|Part|파트|CHAPTER|Chapter)\s*\d{1,2}|제?\s*\d{1,2}\s*(?:부|장|차시|교시))\s*[.:·\-–—]?\s+(.+)$/.exec(title || '');
  return m ? { part: m[1].replace(/\s+/g, ' ').trim(), title: m[2].trim() } : { part: '', title: (title || '').trim() };
}
/**
 * 쪽 글을 슬라이드 모양으로 나눔(글자는 그대로, 묶는 방식만 정함)
 *  - 여러 줄 → 글머리 목록 · "가 → 나 → 다" → 흐름(순서 목록) · "가 · 나 · 다"(셋 이상, 짧은 낱말) → 낱말 줄(앞 문장은 머리글) · 그 밖 → 문단
 */
export function slideBody(text) {
  const t = String(text || '').slice(0, 600).trim();
  if (!t) return '';
  const lines = t.split('\n').map((x) => x.replace(/^\s*[-•·*▪◦‣]\s*/, '').trim()).filter(Boolean);
  if (lines.length > 1) return `<ul class="lp-slide-points">${lines.slice(0, 7).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  const flow = t.split(/\s*(?:→|->|⇒)\s*/);
  if (flow.length >= 3 && flow.every((x) => x && [...x].length <= 24)) return `<ol class="lp-slide-flow">${flow.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
  const kw = t.split(/\s+·\s+/);
  if (kw.length >= 3) {
    // 첫 조각에 문장이 붙어 있으면("…않습니다. 다섯 역량: 자기 인식") 문장은 머리글로
    const m = /^(.*[.?!:。])\s*([^.?!:。]+)$/.exec(kw[0]);
    const lead = m ? m[1].trim() : ''; const first = m ? m[2].trim() : kw[0];
    const items = [first, ...kw.slice(1)];
    if (items.every((x) => x && [...x].length <= 18)) return `${lead ? `<p class="lp-slide-lead">${esc(lead)}</p>` : ''}<ul class="lp-slide-kw">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  }
  return `<p class="lp-slide-lead">${br(t)}</p>`;
}
/** 그림이 없는 쪽: 16:9 슬라이드 한 장(표지 · 부 시작 · 본문). 위에 교재 이름과 쪽, 아래 구석에 큰 쪽 번호 */
function textSlide(sl, i, total, deckName) {
  const { part, title } = slidePart(sl.title);
  const kind = i === 0 ? 'cover' : part ? 'part' : 'body';
  return `<div class="lp-slide-text" data-kind="${kind}"><p class="lp-slide-top" aria-hidden="true"><span>${esc(deckName)}</span><span>${sl.page} / ${total}</span></p><div class="lp-slide-main">${part ? `<p class="lp-slide-part">${esc(part)}</p>` : ''}<h3>${esc(title || `${sl.page}쪽`)}</h3>${slideBody(sl.text)}</div><span class="lp-slide-pg" aria-hidden="true">${pad2(sl.page)}</span></div>`;
}

function deck(s, ctx) {
  const toolMap = Object.fromEntries((ctx.bp.sections.find((x) => x.type === 'tools')?.items || []).map((t) => [t.name, t]));
  const deckName = ctx.design.brandName || ctx.bp.meta.title;
  const slides = s.slides.map((sl, i) => {
    const tools = (sl.tools || []).map((n) => toolMap[n]).filter(Boolean);
    const media = sl.src ? `<img src="${esc(sl.src)}" alt="${esc(`${sl.page}쪽${sl.title ? ': ' + sl.title : ''}`)}" loading="${i < 2 ? 'eager' : 'lazy'}" decoding="async">` : textSlide(sl, i, s.slides.length, deckName);
    return `<figure class="lp-slide" id="deck-p${sl.page}" data-page="${sl.page}" data-title="${esc(sl.title)}" data-text="${esc((sl.text || '').slice(0, 400))}">${media}<figcaption><span class="lp-slide-no">${sl.page}</span>${esc(sl.title)}${tools.length ? `<span class="lp-slide-tools">${tools.map((t) => `<a ${href(t.url)}>${esc(t.name)}${icon('external')}</a>`).join('')}</span>` : ''}</figcaption></figure>`;
  }).join('\n');
  const dl = s.download?.href ? `<a class="lp-btn lp-btn-ghost" ${href(s.download.href)} download>${icon('download')}<span>${esc(s.download.label || '교재 내려받기')}${s.download.size ? ` · ${esc(s.download.size)}` : ''}</span></a>` : '';
  return wrap(s, ctx, head(s, ctx, '연수 교재') + `<div class="lp-deck" data-deck>
  <div class="lp-deck-stage" tabindex="0" aria-roledescription="슬라이드" aria-label="교재 ${s.slides.length}쪽">${slides}</div>
  <div class="lp-deck-bar" hidden>
    <button class="lp-icon-btn" type="button" data-deck-prev aria-label="이전 쪽">${icon('left')}</button>
    <span class="lp-deck-count" aria-live="polite"><b data-deck-cur>1</b> / ${s.slides.length}</span>
    <button class="lp-icon-btn" type="button" data-deck-next aria-label="다음 쪽">${icon('right')}</button>
    <span class="lp-grow"></span>
    <button class="lp-btn lp-btn-ghost lp-btn-sm" type="button" data-deck-overview>${icon('grid')}<span>전체 보기</span></button>
    <button class="lp-btn lp-btn-ghost lp-btn-sm" type="button" data-deck-full>${icon('expand')}<span>전체 화면</span></button>
    <label class="lp-follow" hidden><input type="checkbox" data-deck-follow checked> 강사 따라 넘기기</label>
  </div>
  ${dl ? `<div class="lp-deck-dl">${dl}</div>` : ''}
  ${s.notice ? `<p class="lp-note">${br(s.notice)}</p>` : ''}
</div>${variantOf(s, ctx.design.preset).variant === 'rail' ? VB().VB.deck.rail(s) : ''}`);
}

// ── 실습 ─────────────────────────────────────────────────
function stations(s, ctx) {
  const n = s.items.length;
  const side = `<aside class="lp-st-side"><nav aria-label="실습 목차"><ol>${s.items.map((st, i) => `<li><a href="#st-${esc(st.id)}" data-st-link="${esc(st.id)}"><span class="lp-st-n">${pad2(i + 1)}</span><span class="lp-st-name">${esc(st.name)}</span><span class="lp-st-ck" aria-hidden="true"></span></a></li>`).join('')}</ol></nav>
<div class="lp-st-record"><div class="lp-st-record-h"><b>나의 실습 기록</b><span data-st-count>0 / ${n}</span></div><progress max="${n}" value="0" data-st-progress aria-label="실습 진행"></progress><button class="lp-textbtn" type="button" data-st-export>기록 내려받기 ${icon('download')}</button><small>완료 체크와 메모는 이 브라우저에만 저장돼요.</small></div></aside>`;
  const panels = s.items.map((st, i) => {
    const steps = st.steps.length ? `<ol class="lp-steps">${st.steps.map((x) => `<li>${br(x)}</li>`).join('')}</ol>` : '';
    const links = st.links.length ? `<div class="lp-st-links">${st.links.map((l) => `<a class="lp-btn lp-btn-ghost lp-btn-sm" ${href(l.url)}>${esc(l.label || host(l.url))}${icon('external')}</a>`).join('')}</div>` : '';
    const imgs = st.images.length ? `<details class="lp-st-images"><summary>화면 안내 보기 · ${st.images.length}장</summary><div class="lp-st-gallery">${st.images.map((im, k) => `<figure><a href="${esc(im.src)}" target="_blank" rel="noopener"><img src="${esc(im.src)}" alt="${esc(im.caption || `${st.name} 화면 ${k + 1}`)}" loading="lazy"></a>${im.caption ? `<figcaption>${esc(im.caption)}</figcaption>` : ''}</figure>`).join('')}</div></details>` : '';
    const prompts = st.prompts.length ? `<div class="lp-prompts"><h4>프롬프트</h4>${st.prompts.map((p, k) => `<div class="lp-prompt"><div class="lp-prompt-h"><b>${esc(p.title || `프롬프트 ${k + 1}`)}</b><span><button class="lp-textbtn" type="button" data-restore hidden>원문으로</button><button class="lp-btn lp-btn-sm lp-btn-primary" type="button" data-copy>${icon('copy')}<span>복사</span></button></span></div><textarea class="lp-prompt-text" data-prompt="${esc(st.id)}-${k}" rows="${Math.min(10, Math.max(3, Math.ceil(p.text.length / 46)))}" spellcheck="false" aria-label="${esc(p.title || '프롬프트')}">${esc(p.text)}</textarea>${sourceLine(p.source, ctx)}</div>`).join('')}</div>` : '';
    const src = sourceLine(st.source, ctx);
    return `<article class="lp-st" id="st-${esc(st.id)}" data-st="${esc(st.id)}" aria-labelledby="st-${esc(st.id)}-h">
<header class="lp-st-h"><span class="lp-st-big" aria-hidden="true">${pad2(i + 1)}</span><div>${st.tag ? `<span class="lp-st-tag">${esc(st.tag)}</span>` : ''}<h3 id="st-${esc(st.id)}-h">${esc(st.title)}</h3>${st.desc ? `<p>${br(st.desc)}</p>` : ''}${st.minutes ? `<small>${icon('clock')} 약 ${st.minutes}분</small>` : ''}</div></header>
${links}${steps}${st.note ? `<p class="lp-note">${br(st.note)}</p>` : ''}${imgs}${prompts}${src}
<div class="lp-st-done">
  ${st.outcome ? `<p class="lp-outcome"><b>여기까지 됐나요?</b> ${br(st.outcome)}</p>` : ''}
  <div class="lp-st-actions"><button class="lp-btn lp-btn-check" type="button" data-done aria-pressed="false">${icon('check', 'lp-check-draw')}<span>완료 체크</span></button><button class="lp-btn lp-btn-ghost" type="button" data-stuck hidden>${icon('hand')}<span>도움 요청</span></button></div>
  <label class="lp-memo"><span>메모</span><textarea data-memo="${esc(st.id)}" rows="3" placeholder="내 수업이나 업무에 어떻게 쓸지 적어 두세요."></textarea></label>
</div>
<nav class="lp-st-pn" aria-label="실습 이동">${i > 0 ? `<a class="lp-btn lp-btn-ghost" href="#st-${esc(s.items[i - 1].id)}">${icon('left')}<span>이전 실습</span></a>` : '<span></span>'}${i < n - 1 ? `<a class="lp-btn lp-btn-ghost" href="#st-${esc(s.items[i + 1].id)}"><span>다음 실습</span>${icon('right')}</a>` : '<span></span>'}</nav>
</article>`;
  }).join('\n');
  return wrap(s, ctx, head(s, ctx, '실습') + `<div class="lp-st-shell" data-stations="${esc(s.id)}" data-layout="${esc(s.layout)}"${fx(ctx, 'progress') ? ` data-progress-fx="${esc(ctx.design.effects.progress)}"` : ''}>${side}<div class="lp-st-panels">${panels}</div></div>`);
}

// ── 도구·프롬프트 ─────────────────────────────────────────
/** 도구 칸 너비(12칸 격자): 두 칸씩 7·5, 5·7로 엇갈리고, 하나 남으면 한 줄 전체. 똑같은 칸이 줄지어 서지 않게 */
export function bentoSpans(n) {
  const out = [];
  for (let i = 0; i < n; i += 2) { if (i + 1 >= n) out.push(12); else out.push(...((i / 2) % 2 ? [5, 7] : [7, 5])); }
  return out;
}
/** 도구: 크기가 다른 칸(벤토). 이름을 크게, 주소는 고정폭으로, 칸 전체가 링크. 구석의 큰 첫 글자는 꾸밈 */
function tools(s, ctx) {
  const deck = hasDeck(ctx);
  const spans = bentoSpans(s.items.length);
  return wrap(s, ctx, head(s, ctx, '도구 모음') + `<ol class="lp-tools" style="--n:${s.items.length}"${groupFx(ctx)}>${s.items.map((t, n) => `<li class="lp-tools-item" data-w="${spans[n]}"${itemFx(ctx)}><span class="lp-tools-no" aria-hidden="true">${pad2(n + 1)}</span><h3>${t.url ? `<a ${href(t.url)}>${esc(t.name)}${icon('external')}</a>` : esc(t.name)}</h3>${t.url ? `<span class="lp-tools-host">${esc(host(t.url))}</span>` : ''}${t.desc ? `<p>${esc(t.desc)}</p>` : ''}${t.pages.length ? `<span class="lp-pages">교재 ${t.pages.map((p) => deck ? `<a href="#deck-p${p}">${p}</a>` : esc(p)).join('·')}쪽</span>` : ''}<span class="lp-tools-mark" aria-hidden="true">${esc([...t.name.trim()][0] || '')}</span></li>`).join('')}</ol>${s.notice ? `<p class="lp-note">${br(s.notice)}</p>` : ''}`);
}

function prompts(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '프롬프트 모음') + `<div class="lp-prompt-lib">${s.items.map((p, k) => `<div class="lp-prompt"><div class="lp-prompt-h"><b>${esc(p.title || `프롬프트 ${k + 1}`)}</b><span><button class="lp-textbtn" type="button" data-restore hidden>원문으로</button><button class="lp-btn lp-btn-sm lp-btn-primary" type="button" data-copy>${icon('copy')}<span>복사</span></button></span></div>${p.tags.length ? `<ul class="lp-tags">${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}<textarea class="lp-prompt-text" data-prompt="lib-${k}" rows="${Math.min(10, Math.max(3, Math.ceil(p.text.length / 46)))}" spellcheck="false" aria-label="${esc(p.title || '프롬프트')}">${esc(p.text)}</textarea>${sourceLine(p.source, ctx)}</div>`).join('')}</div>`);
}

// ── 실시간 참여 ───────────────────────────────────────────
function qa(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '질문') + `<div class="lp-qa" data-qa>
<form class="lp-compose" data-qa-form><label class="lp-sr" for="${esc(s.id)}-q">질문</label><textarea id="${esc(s.id)}-q" name="text" rows="2" maxlength="500" placeholder="궁금한 점을 적어 주세요.${s.anonymous ? ' 이름은 보이지 않아요.' : ''}" required></textarea><div class="lp-compose-f"><small data-count>0 / 500</small><button class="lp-btn lp-btn-primary" type="submit">${icon('up')}<span>질문 올리기</span></button></div></form>
<div class="lp-tabs" role="tablist" aria-label="정렬"><button role="tab" aria-selected="true" data-sort="votes">공감순</button><button role="tab" aria-selected="false" data-sort="new">최신순</button></div>
<ul class="lp-qa-list" data-qa-list aria-live="polite"><li class="lp-empty">아직 질문이 없어요. 첫 질문을 올려 주세요.</li></ul>
${liveOff(ctx)}</div>`);
}

/**
 * 보드에서 파일을 받을지: 보드 설정(allowFiles·maxFiles) + 실시간 서버가 파일을 받는지(live.uploads).
 * live.uploads가 없으면 구글 시트만 꺼짐으로 봄(Apps Script는 '파일 올리기 켜기'를 눌러야 받음).
 */
export function boardFiles(s, bp) {
  if (!s?.allowFiles || !(s.maxFiles > 0)) return false;
  const up = bp?.live?.uploads;
  return typeof up === 'boolean' ? up : bp?.live?.provider !== 'sheets';
}

function board(s, ctx) {
  const cats = s.categories.length ? s.categories : [{ id: 'work', label: '결과물' }, { id: 'reflection', label: '소감' }];
  if (!ctx.live && s.externalUrl) return wrap(s, ctx, head(s, ctx, '나눔 보드') + `<p><a class="lp-btn lp-btn-primary" ${href(s.externalUrl)}>보드 열기${icon('external')}</a></p>`);
  const files = boardFiles(s, ctx.bp);
  return wrap(s, ctx, head(s, ctx, '나눔 보드') + `<div class="lp-board" data-board data-max-files="${files ? s.maxFiles : 0}" data-moderation="${s.moderation ? 1 : 0}">
<div class="lp-board-bar"><div class="lp-tabs" role="tablist" aria-label="보드 분류"><button role="tab" aria-selected="true" data-cat="">전체</button>${cats.map((c) => `<button role="tab" aria-selected="false" data-cat="${esc(c.id)}">${esc(c.label)}</button>`).join('')}</div><button class="lp-btn lp-btn-primary" type="button" data-board-write>${icon('sparkle')}<span>글 올리기</span></button></div>
<form class="lp-compose lp-board-form" data-board-form hidden>
  <fieldset class="lp-seg"><legend class="lp-sr">분류</legend>${cats.map((c, i) => `<label><input type="radio" name="kind" value="${esc(c.id)}"${i ? '' : ' checked'}><span>${esc(c.label)}</span></label>`).join('')}</fieldset>
  <label><span class="lp-sr">내용</span><textarea name="text" rows="3" maxlength="1000" placeholder="나누고 싶은 내용을 적어 주세요" required></textarea></label>
  ${files ? `<label class="lp-file"><span>파일 (사진·PDF·음악·영상, ${s.maxFiles}개까지)</span><input type="file" name="files" multiple accept="image/*,application/pdf,audio/mpeg,video/mp4"></label>` : ''}
  <label class="lp-inline"><span>이용 조건</span><select name="license"><option value="own">내가 만든 자료</option><option value="cc">CC 라이선스</option><option value="kogl">공공누리</option><option value="permitted">이용 허락 받음</option></select></label>
  <p class="lp-small">학생 얼굴·이름 등 개인정보가 드러나는 자료는 올리지 말아 주세요.</p>
  <div class="lp-compose-f"><button class="lp-btn lp-btn-ghost" type="button" data-board-cancel>취소</button><button class="lp-btn lp-btn-primary" type="submit">올리기</button></div>
</form>
<ul class="lp-board-grid" data-board-list aria-live="polite"><li class="lp-empty">아직 올라온 글이 없어요. 첫 글을 올려 주세요.</li></ul>
${liveOff(ctx)}${s.notice ? `<p class="lp-note">${br(s.notice)}</p>` : ''}</div>`);
}

function poll(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '투표') + `<div class="lp-poll" data-poll='${esc(JSON.stringify(s.items))}'><div class="lp-poll-live" data-poll-live><p class="lp-empty">강사가 투표를 열면 여기에 나타나요.</p></div>
<details class="lp-poll-list"><summary>준비된 질문 ${s.items.length}개 보기</summary><ol>${s.items.map((p) => `<li>${esc(p.question)}${p.options.length ? ` <small>(${p.options.map(esc).join(' / ')})</small>` : ''}</li>`).join('')}</ol></details>${liveOff(ctx)}</div>`);
}

function quiz(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '복습 퀴즈') + `<ol class="lp-quiz" data-quiz>${s.items.map((q, n) => `<li><fieldset><legend><span class="lp-idx">${pad2(n + 1)}</span>${esc(q.q)}</legend>${q.options.map((o, k) => `<label><input type="radio" name="quiz-${esc(s.id)}-${n}" value="${k}" data-correct="${k === q.answer ? 1 : 0}"><span>${esc(o)}</span></label>`).join('')}</fieldset><p class="lp-quiz-fb" aria-live="polite" hidden data-explain="${esc(q.explain)}"></p></li>`).join('')}</ol>`);
}

function attendance(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '출석 확인') + `<div class="lp-attend" data-attend><p>연수를 시작할 때와 마칠 때 한 번씩 눌러 주세요.${completionLine(ctx) ? ' 둘 다 눌러야 이수가 확인돼요.' : ''}</p><div class="lp-ctas"><button class="lp-btn lp-btn-primary" type="button" data-attend="in">입실 확인</button><button class="lp-btn lp-btn-ghost" type="button" data-attend="out">퇴실 확인</button></div><p class="lp-small" data-attend-state></p>${liveOff(ctx)}</div>`);
}

// ── 자료·사람 ─────────────────────────────────────────────
function materials(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '연수 자료') + `<ul class="lp-materials"${fx(ctx, 'list')}>${s.items.map((m) => `<li><span class="lp-file-kind">${esc(m.kind || 'FILE')}</span><div><h3>${esc(m.title)}</h3>${m.desc ? `<p>${esc(m.desc)}</p>` : ''}${m.size ? `<small>${esc(m.size)}</small>` : ''}</div>${m.href ? `<a class="lp-btn lp-btn-ghost lp-btn-sm" ${href(m.href)}${/^https?:/.test(m.href) ? '' : ' download'}>${icon(/^https?:/.test(m.href) ? 'external' : 'download')}<span>${/^https?:/.test(m.href) ? '열기' : '내려받기'}</span></a>` : ''}</li>`).join('')}</ul>${s.notice ? `<div class="lp-notice-box"><b>자료 이용 안내</b><p>${br(s.notice)}</p></div>` : ''}`);
}

function instructor(s, ctx) {
  const list = ctx.bp.instructors;
  if (!list.length) return '';
  return wrap(s, ctx, head(s, ctx, '강사 소개') + list.map((p) => `<div class="lp-person">
<div class="lp-person-card"${itemFx(ctx)}>${p.photo ? `<img class="lp-avatar" src="${esc(p.photo)}" alt="${esc(p.name)} 사진">` : `<span class="lp-avatar lp-avatar-text" aria-hidden="true">${esc([...p.name][0] || '')}</span>`}<h3>${esc(p.name)}</h3>${p.role || p.org ? `<p class="lp-person-role">${esc([p.org, p.role].filter(Boolean).join(' '))}</p>` : ''}${p.tags.length ? `<ul class="lp-tags">${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}${p.bio ? `<p class="lp-person-bio">${br(p.bio)}</p>` : ''}
${p.email && p.showEmail ? `<div class="lp-contact"><span class="lp-email">${esc(p.email)}</span><button class="lp-btn lp-btn-sm lp-btn-ghost" type="button" data-copy-text="${esc(p.email)}">${icon('copy')}<span>주소 복사</span></button></div>` : ''}
${p.links.length ? `<div class="lp-person-links">${p.links.map((l) => `<a class="lp-link" ${href(l.url)}>${esc(l.label || host(l.url))}${icon('external')}</a>`).join('')}</div>` : ''}</div>
${p.timeline.length ? `<div class="lp-timeline">${p.timeline.map((g) => `<div class="lp-tl-group"><h4>${esc(g.group)}</h4><ul>${g.items.map((it) => `<li><span>${it.url ? `<a ${href(it.url)}>${esc(it.text)}</a>` : esc(it.text)}</span>${it.year ? `<small>${esc(it.year)}</small>` : ''}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}
</div>`).join(''));
}

function speakers(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '연사') + `<ul class="lp-speakers"${groupFx(ctx)}>${s.items.map((p) => `<li${itemFx(ctx)}>${p.photo ? `<img class="lp-avatar" src="${esc(p.photo)}" alt="${esc(p.name)} 사진" loading="lazy">` : `<span class="lp-avatar lp-avatar-text" aria-hidden="true">${esc([...p.name][0] || '')}</span>`}<h3>${esc(p.name)}</h3><p class="lp-person-role">${esc([p.org, p.role].filter(Boolean).join(' '))}</p>${p.talk ? `<p>${esc(p.talk)}</p>` : ''}${p.time ? `<small>${icon('clock')} ${esc(p.time)}</small>` : ''}</li>`).join('')}</ul>`);
}

function sessions(s, ctx) {
  const label = { done: '마침', now: '진행 중', next: '다음' };
  // 상태를 직접 적지 않았으면 날짜를 보고 참가자 화면이 마침·오늘·다음을 표시
  const auto = !s.items.some((x) => x.status) && s.items.some((x) => x.date);
  return wrap(s, ctx, head(s, ctx, '차시') + `<ol class="lp-sessions"${auto ? ' data-sessions-auto' : ''}>${s.items.map((x) => `<li id="${esc(s.id)}-${x.no}" data-status="${esc(x.status)}"${x.date ? ` data-date="${esc(x.date)}"` : ''}><span class="lp-idx">${x.no}차시</span><div><h3>${esc(x.title)}</h3>${x.date ? `<small>${esc(koDate(x.date))}</small>` : ''}${x.desc ? `<p>${esc(x.desc)}</p>` : ''}${x.links.length ? `<div class="lp-st-links">${x.links.map((l) => `<a class="lp-link" ${href(l.url)}>${esc(l.label || '열기')}${icon('arrow')}</a>`).join('')}</div>` : ''}</div><span class="lp-chip" data-session-chip${x.status ? '' : ' hidden'}>${x.status ? label[x.status] : ''}</span></li>`).join('')}</ol>`);
}

// 설문 항목 열쇠(결과 CSV의 열 이름): "1. 질문 앞부분"
export function surveyKey(q, n) { return `${n + 1}. ${[...String(q.q || '')].slice(0, 30).join('')}`.trim(); }
const SCALE_KO = ['전혀 아니에요', '아니에요', '보통이에요', '그래요', '매우 그래요'];

function surveyForm(s) {
  const qs = s.questions.map((q, n) => {
    const key = esc(surveyKey(q, n)); const name = `sv-${esc(s.id)}-${n}`;
    const qText = `<span class="lp-idx">${pad2(n + 1)}</span>${esc(q.q)}`;
    const legend = `<legend>${qText}</legend>`;
    if (q.kind === 'text') return `<li><label class="lp-sv-text"><span class="lp-sv-q">${qText}</span><textarea name="${name}" rows="3" maxlength="1000" data-sv-key="${key}"></textarea></label></li>`;
    const opts = q.kind === 'choice' ? q.options : (q.options.length >= 2 ? q.options : SCALE_KO);
    return `<li><fieldset class="lp-sv-${q.kind === 'choice' ? 'choice' : 'scale'}" data-sv-key="${key}">${legend}<div class="lp-sv-opts">${opts.map((o, k) => `<label><input type="radio" name="${name}" value="${esc(q.kind === 'scale' ? String(k + 1) : o)}"><span>${q.kind === 'scale' ? `<b>${k + 1}</b><i>${esc(o)}</i>` : esc(o)}</span></label>`).join('')}</div></fieldset></li>`;
  }).join('');
  return `<form class="lp-survey-form" data-survey="${esc(s.id)}" novalidate><ol class="lp-sv-list">${qs}</ol><div class="lp-compose-f"><small data-sv-state>다시 내면 고쳐져요. 별명으로만 모여요.</small><button class="lp-btn lp-btn-primary" type="submit">제출하기</button></div></form>`;
}

function survey(s, ctx) {
  const url = s.url;
  const inner = s.questions.length && ctx.live;
  const title = `<h2 class="lp-h2" id="${esc(s.id)}-h"${fx(ctx, 'section.title')}>${br(s.title || '만족도 조사')}</h2>`;
  const defLead = '의견은 다음 연수를 준비하는 데 써요.';
  const lead = `<p class="lp-lead">${br(s.lead || defLead)}</p>`;
  if (inner) {
    return wrap({ ...s, title: s.title || '만족도 조사' }, ctx, `${head({ ...s, title: s.title || '만족도 조사', lead: s.lead || defLead }, ctx)}${completionLine(ctx) ? '<p class="lp-note">설문을 내야 이수가 확인돼요.</p>' : ''}${surveyForm(s)}${url ? `<p class="lp-small">기관 설문도 있어요. <a class="lp-link" ${href(url)}>기관 설문 열기${icon('external')}</a></p>` : ''}`);
  }
  return wrap(s, ctx, `<div class="lp-survey">
<div>${title}${lead}
${url ? `<a class="lp-btn lp-btn-primary lp-btn-lg" ${href(url)}${fx(ctx, 'hero.cta')}><span>설문 열기</span>${icon('external')}</a>` : '<p class="lp-note">설문 주소가 아직 없어요.</p>'}${url && s.qr ? '<p class="lp-small">QR을 찍기 어려우면 버튼을 눌러 주세요.</p>' : ''}</div>
${url && s.qr ? `<div class="lp-qr" data-qr="${esc(url)}" role="img" aria-label="설문 QR 코드"></div>` : ''}</div>`);
}

// ── 연수 후 안내: 다시 보기·소통방·이수 안내. 연수가 끝나면 참가자 화면이 이 칸을 첫 화면 바로 아래로 올림 ──
const FOLLOWUP_KIND = { recording: '영상', community: '소통', next: '다음', read: '읽기', link: '링크' };
function followup(s, ctx) {
  const contact = ctx.bp.meta.contact;
  return wrap(s, ctx, head(s, ctx, '연수 후 안내') + `${s.items.length ? `<ul class="lp-materials lp-followup"${fx(ctx, 'list')}>${s.items.map((i) => `<li><span class="lp-file-kind">${FOLLOWUP_KIND[i.kind] || '링크'}</span><div><h3>${esc(i.title)}</h3>${i.desc ? `<p>${br(i.desc)}</p>` : ''}</div>${i.url ? `<a class="lp-btn lp-btn-ghost lp-btn-sm" ${href(i.url)}>${icon(/^https?:/.test(i.url) ? 'external' : 'arrow')}<span>열기</span></a>` : ''}</li>`).join('')}</ul>` : ''}${s.completion ? `<div class="lp-notice-box"><b>이수 안내</b><p>${br(s.completion)}</p></div>` : ''}${contact ? `<p class="lp-note">문의: ${contactHtml(contact)}</p>` : ''}`, ' data-followup');
}
/** 문의처: 이메일·전화번호는 눌러서 바로 연결 */
export function contactHtml(c) {
  return esc(c).replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, (e) => `<a href="mailto:${e}">${e}</a>`).replace(/(?<![\d-])(0\d{1,2}-\d{3,4}-\d{4})(?![\d-])/g, (t) => `<a href="tel:${t.replace(/-/g, '')}">${t}</a>`);
}

/** 마무리 띠에 흐를 낱말: 이 연수의 실제 내용(차례·실습·핵심 단계 이름). 셋 넘게 있을 때만 */
function closingWords(ctx) {
  const out = [];
  for (const x of ctx.bp.sections) {
    if (x.type === 'outline') out.push(...x.items.map((i) => i.title));
    if (x.type === 'stations') out.push(...x.items.map((i) => i.name || i.title));
    if (x.type === 'steps5') out.push(...x.items.map((i) => i.word));
  }
  const list = [...new Set(out.filter((w) => w && [...w].length <= 22))].slice(0, 10);
  return list.length >= 3 ? list : [];
}
/**
 * 마무리: 화면 폭을 채우는 띠에 아주 큰 문장. 프리셋의 첫 화면 구성(heroComposition)에서 쓴 표식을 한 번 더 써서 끝을 맺음
 * (밤하늘의 큰 날짜 윤곽 · 초대장의 해 · 숲의 언덕 · 형광 인쇄의 망점 · 칠판 틀 · 설계도의 치수선 …).
 * 꾸밈 조각은 모두 aria-hidden. 스크롤 연출 단계에서는 이 연수의 낱말이 아래 띠로 흐름(CSS, 가벼운 모드·동작 줄이기에서는 멈춘 목록)
 */
function closing(s, ctx) {
  const graphic = ctx.design.closingGraphic ? `<div class="lp-closing-graphic" data-fx="${esc(ctx.design.closingGraphic)}" aria-hidden="true"></div>` : '';
  const m = ctx.bp.meta;
  const comp = heroComposition(ctx);
  const text = s.text || m.title;
  const dp = dateParts(m.date);
  // 서명 줄: 실제 값만(연수명은 마무리 문장과 다를 때, 날짜·주최)
  const sign = [text !== m.title ? m.title : '', m.date ? koDate(m.date) : '', m.organizer].filter(Boolean);
  const deco = {
    cinema: dp ? `<p class="lp-cine-date" aria-hidden="true">${pad2(dp.m)}<i>.</i>${pad2(dp.d)}</p>` : '',
    quiet: '<div class="lp-rings" aria-hidden="true"></div><div class="lp-hills" aria-hidden="true"></div>',
    zine: '<div class="lp-halftone" aria-hidden="true"></div>',
    invite: '<div class="lp-sun" aria-hidden="true"><i></i></div>',
    board: '<div class="lp-chalk-tray" aria-hidden="true"><i></i><i></i><i></i><b></b></div>',
    sticker: dp ? `<p class="lp-closing-stk" aria-hidden="true"><b>${dp.m}. ${dp.d}.</b><span>${dp.w}요일</span></p>` : '',
    worksheet: '<span class="lp-closing-check" aria-hidden="true"></span>',
    mosaic: `<div class="lp-closing-tiles" aria-hidden="true">${mosaicSvg(titleRandom(m.title), 14, 1)}</div>`,
    vertical: '<i class="lp-vt-moon" aria-hidden="true"></i>',
    offset: '<i class="lp-off-block" aria-hidden="true"></i>',
    cover: `<span class="lp-closing-glyph" aria-hidden="true">${esc([...String(text).trim()].find((ch) => /[\p{L}\p{N}]/u.test(ch)) || '')}</span>`,
    minutes: '<div class="lp-closing-dots" aria-hidden="true"></div>',
  }[comp] || '';
  const wordsList = ctx.design.motion >= 3 ? closingWords(ctx) : [];
  const band = wordsList.length ? `<div class="lp-closing-band" aria-hidden="true"><ul>${[0, 1].map(() => wordsList.map((w) => `<li>${esc(w)}</li>`).join('')).join('')}</ul></div>` : '';
  // 배치 변형: finale 큰 문장(기본, 첫 화면 표식의 되풀이) · poster 이 연수의 모티프 그림이 띠를 채우고 문장은 그 위 판에 · card 가운데 서명 카드
  const v = variantOf(s, ctx.design.preset), vid = v.variant || 'finale';
  const art = vid === 'poster' ? `<div class="lp-poster-art" aria-hidden="true">${motifSvg(famOf(ctx), `${m.title}|closing`, { w: 1440, h: 720, glyph: firstGlyph(text) })}</div>` : deco;
  const inner = `${s.lead ? `<p class="lp-closing-lead">${br(s.lead)}</p>` : ''}<p class="lp-closing-text"${fx(ctx, 'closing.title')}>${br(text)}</p>${s.thanks || sign.length ? `<div class="lp-closing-foot">${s.thanks ? `<p class="lp-closing-thanks">${br(s.thanks)}</p>` : ''}${sign.length ? `<p class="lp-closing-sign">${sign.map((x) => `<span>${esc(x)}</span>`).join('')}</p>` : ''}</div>` : ''}`;
  const stance = v.stance ? ` data-stance="${v.stance}"` : '';
  return `<section id="${esc(s.id)}" class="lp-sec lp-closing lp-closing--${comp}${bandClass(ctx)}" data-layout="${vid === 'finale' ? 'finale' : vid}" data-frame="band" data-variant="${vid}" data-lead="${v.meta?.lead || 'text'}"${stance}${s.tone ? ` data-tone="${esc(s.tone)}"` : ''}>${vid === 'poster' ? '' : graphic}${art}<div class="lp-wrap">${vid === 'card' ? `<div class="lp-closing-card">${inner}</div>` : inner}</div>${band}</section>`;
}

function faq(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '자주 묻는 질문') + `<div class="lp-faq">${s.items.map((i) => `<details><summary><span>${esc(i.q)}</span></summary><div>${md(i.a)}</div></details>`).join('')}</div>`);
}
function glossary(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '용어 풀이') + `<dl class="lp-glossary">${s.items.map((i) => `<div><dt>${esc(i.term)}</dt><dd>${br(i.desc)}</dd></div>`).join('')}</dl>`);
}
function video(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '영상') + `<ul class="lp-videos">${s.items.map((v) => `<li><a ${href(v.url)} class="lp-video-link">${v.thumb ? `<img src="${esc(v.thumb)}" alt="" loading="lazy">` : `<span class="lp-video-ph" aria-hidden="true">${icon('play')}</span>`}<span class="lp-video-t">${esc(v.title || host(v.url))}${v.length ? ` <small>${esc(v.length)}</small>` : ''}</span></a></li>`).join('')}</ul>`);
}
function gallery(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '사진') + `<ul class="lp-gallery"${fx(ctx, 'gallery')}>${s.items.map((g) => `<li><figure><a href="${esc(g.src)}" target="_blank" rel="noopener"><img src="${esc(g.src)}" alt="${esc(g.caption)}" loading="lazy"></a>${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ''}</figure></li>`).join('')}</ul>`);
}
function reflection(s, ctx) {
  const prompts = s.prompts.length ? s.prompts : ['오늘 가장 기억에 남는 것', '다음 주 수업에서 해 볼 한 가지'];
  return wrap(s, ctx, head(s, ctx, '나의 기록') + `<form class="lp-reflect" data-reflect="${esc(s.id)}">${prompts.map((p, i) => `<label><span>${esc(p)}</span><textarea rows="3" data-reflect-q="${i}"></textarea></label>`).join('')}<div class="lp-compose-f"><small>이 브라우저에만 저장돼요.</small><button class="lp-btn lp-btn-primary" type="button" data-reflect-save>${icon('download')}<span>내려받기</span></button></div></form>`);
}
function text(s, ctx) { return wrap(s, ctx, head(s, ctx) + `<div class="lp-prose">${md(s.md)}</div>`); }

export const RENDERERS = { hero, goals, glance, message, steps5, outline, schedule, readiness, deck, stations, tools, prompts, qa, board, poll, quiz, materials, instructor, speakers, sessions, survey, followup, closing, faq, glossary, video, gallery, reflection, attendance, text, ...contentRenderers({ wrap, head }) };

export function renderSection(s, ctx) {
  const fn = RENDERERS[s.type];
  if (!fn) return '';
  return variantSection(s, ctx) ?? fn(s, ctx);
}
