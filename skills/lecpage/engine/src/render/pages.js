// 페이지 조립: index(참가자) · console(강사 화면) · screen(발표 화면) · check(접속 확인) · privacy · poster(인쇄용 QR 안내문)
import { esc, br, href, icon, koDate, host } from './html.js';
import { renderSection, contactHtml, boardFiles } from './sections.js';
import { heroHasBand } from './hero.js';
import { htmlAttrs } from '../design/tokens.js';
import { getPreset } from '../design/presets.js';
import { SECTION_DEFS } from '../schema/sections.js';
import { fxInfo } from '../decide/design.js';

/** 구분 띠: 첫 화면 아래에 흐르는 띠(marquee)나 선·물결 장식 */
function dividerBand(ctx) {
  const id = ctx.design.effects?.divider; if (!id) return '';
  if (heroHasBand(ctx)) return ''; // 첫 화면이 도구 이름 띠를 직접 그리면 같은 띠를 두 번 두지 않음
  const bp = ctx.bp;
  const words = [];
  for (const s of bp.sections) {
    if (s.type === 'tools') words.push(...s.items.map((t) => t.name));
    if (s.type === 'outline') words.push(...s.items.map((t) => t.title));
    if (s.type === 'stations') words.push(...s.items.map((t) => t.name));
  }
  const list = [...new Set(words.filter(Boolean))].slice(0, 12);
  if (!list.length) list.push(...bp.sections.filter((s) => s.nav).map((s) => s.nav));
  if (!list.length) list.push(bp.meta.title);
  return `<div class="lp-divider" data-fx="${esc(id)}" aria-hidden="true">${list.map((w) => `<span>${esc(w)}</span>`).join('')}</div>`;
}

const VERSION = '1.0.0';

function attrs(map) { return Object.entries(map).map(([k, v]) => `${k}="${esc(v)}"`).join(' '); }
function jsonScript(id, data) {
  return `<script type="application/json" id="${id}">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

/** 검색 노출: 'public'인 참가자 화면만 허용. 나머지 페이지는 늘 noindex */
function robotsMeta(ctx, page) {
  return page === 'index' && ctx.bp.access?.mode === 'public' ? '' : '<meta name="robots" content="noindex, nofollow">';
}

/** 생성 사이트 보안 정책(CSP): 스크립트는 이 사이트와 지문을 고정한 라이브러리 경로만, 플러그인·base 바꾸기·틀 넣기 금지.
 * file:은 USB·ZIP으로 열 때를 위해. 실시간 서버가 http(교실 LAN)면 그 주소도 허용 */
export const LIB_SCRIPT_SOURCES = ['https://cdn.jsdelivr.net/npm/gsap@3.15.1/', 'https://cdn.jsdelivr.net/npm/lenis@1.3.27/', 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/', 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/'];
function cspMeta(ctx) {
  let lan = '';
  try { const u = new URL(ctx.bp.live?.url || ''); if (u.protocol === 'http:') lan = ` ${u.origin} ws://${u.host}`; } catch { /* 없음 */ }
  const fonts = 'https://fonts.googleapis.com https://cdn.jsdelivr.net https://hangeul.pstatic.net';
  const p = [
    "default-src 'self' file:",
    `script-src 'self' file: ${LIB_SCRIPT_SOURCES.join(' ')}`,
    `style-src 'self' file: 'unsafe-inline' ${fonts}`,
    "font-src 'self' file: data: https://fonts.gstatic.com https://cdn.jsdelivr.net https://hangeul.pstatic.net",
    "img-src 'self' file: data: blob: https:",
    "media-src 'self' file: blob: https:",
    `connect-src 'self' file: https: wss:${lan}`,
    "frame-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'self'",
  ];
  return `<meta http-equiv="Content-Security-Policy" content="${p.join('; ')}">`;
}

function headTags(ctx, title, extraCss = [], page = 'app') {
  const m = ctx.bp.meta;
  const desc = m.description || m.subtitle || `${m.title} 연수 안내`;
  const bg = ctx.themeColor;
  return `<meta charset="utf-8">
${cspMeta(ctx)}
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:locale" content="ko_KR">
<meta property="og:title" content="${esc(m.title)}"><meta property="og:description" content="${esc(desc)}">
${ctx.ogImage ? `<meta property="og:image" content="${esc(ctx.ogImage)}"><meta name="twitter:card" content="summary_large_image">` : ''}
<meta name="theme-color" content="${esc(bg)}">
<meta name="generator" content="lecpage ${VERSION}">
${robotsMeta(ctx, page)}
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
${ctx.fontLinks.map((u) => `<link rel="stylesheet" href="${esc(u)}" crossorigin>`).join('\n')}
<link rel="stylesheet" href="assets/theme.css">
<link rel="stylesheet" href="assets/lecpage.css">
${ctx.hasFx ? '<link rel="stylesheet" href="assets/fx.css">' : ''}
${extraCss.map((c) => `<link rel="stylesheet" href="${c}">`).join('\n')}
<script src="assets/boot.js"></script>`;
}

function siteData(ctx) {
  const bp = ctx.bp;
  const st = bp.sections.find((s) => s.type === 'stations');
  return {
    v: VERSION, title: bp.meta.title, date: bp.meta.date, start: bp.meta.start, end: bp.meta.end, siteUrl: bp.meta.siteUrl || bp.meta.shortUrl || '',
    key: 'lp-' + bp.live.code,
    live: ctx.live ? { provider: bp.live.provider, url: bp.live.url, anonKey: bp.live.anonKey, code: bp.live.code, features: bp.live.features, anonymous: bp.live.anonymous, pollMs: bp.live.pollMs } : null,
    privacy: { collect: bp.privacy.collect, consent: bp.privacy.consent, retentionDays: bp.privacy.retentionDays },
    stations: st ? st.items.map((x) => ({ id: x.id, name: x.name })) : [],
    motion: ctx.design.motion,
    base: bp.meta.siteUrl || '',
    admin: { completionRate: bp.meta.admin?.completionRate ?? 90 },
    survey: ctx.live ? bp.sections.filter((s) => s.type === 'survey').reduce((n, s) => n + (s.questions?.length || 0), 0) : 0,
    phase: phaseWindow(bp),
  };
}

/** 연수 기간(현지 시각): 첫날 시작 ~ 마지막 날 끝. 끝난 뒤에는 참가자 화면이 '연수 후' 보기로 바뀜 */
export function phaseWindow(bp) {
  const m = bp.meta, ses = m.sessions || [];
  const dates = [m.date, ...ses.map((x) => x.date), ...bp.sections.filter((s) => s.type === 'sessions').flatMap((s) => s.items.map((x) => x.date))].filter(Boolean).sort();
  if (!dates.length) return null;
  const last = dates[dates.length - 1], lastSes = ses.find((x) => x.date === last);
  return { start: `${dates[0]}T${m.start || '00:00'}`, end: `${last}T${lastSes?.end || m.end || '23:59'}` };
}

/** 연수가 끝난 뒤 맨 위에 뜨는 줄: 끝난 날짜와 가장 먼저 볼 칸(연수 후 안내 > 자료 > 교재 > 설문) */
function phaseBar(ctx) {
  const w = phaseWindow(ctx.bp); if (!w) return '';
  const find = (t) => ctx.bp.sections.find((s) => s.type === t);
  const go = [['followup', '연수 후 안내'], ['materials', '자료 받기'], ['deck', '교재 다시 보기'], ['survey', '설문 참여']].map(([t, label]) => find(t) && { id: find(t).id, label }).find(Boolean);
  return `<div class="lp-now lp-phase" data-phase-bar hidden><div class="lp-now-in" role="region" aria-label="연수 안내">
<span class="lp-now-tag" aria-hidden="true">종료</span>
<p class="lp-now-text"><b>${esc(koDate(w.end.slice(0, 10)))}에 끝난 연수예요.</b></p>
${go ? `<a class="lp-btn lp-btn-primary lp-btn-sm lp-now-cta" href="#${esc(go.id)}">${esc(go.label)}</a>` : ''}
</div></div>`;
}

/** 메뉴 고르기: 데스크톱은 6개까지(실습·질문·교재는 늘 남김), 나머지는 '더보기'. 목차 시트에는 전부 */
const KEEP_NAV = ['stations', 'qa', 'deck'];
export function splitNav(links, max = 6) {
  if (links.length <= max + 1) return { shown: links, more: [] };
  const keep = links.filter((s) => KEEP_NAV.includes(s.type)).slice(0, max);
  const room = Math.max(0, max - keep.length);
  const others = links.filter((s) => !keep.includes(s)).slice(0, room);
  const shown = links.filter((s) => keep.includes(s) || others.includes(s));
  return { shown, more: links.filter((s) => !shown.includes(s)) };
}
const navLink = (s) => `<a href="#${esc(s.id)}" data-nav-link="${esc(s.id)}">${esc(s.nav)}</a>`;

/** '지금' 줄: 실시간 상태(열린 투표·공지·타이머·강사가 보는 실습/쪽)를 한 줄로. 보여 줄 게 없으면 숨김 */
function nowBar(ctx) {
  if (!ctx.live) return '';
  return `<div class="lp-now" data-now hidden><div class="lp-now-in" role="region" aria-label="지금 진행">
<span class="lp-now-tag" aria-hidden="true">지금</span>
<p class="lp-now-text" role="status"><b data-now-main></b><span data-now-sub></span></p>
<span class="lp-now-timer" data-timer role="timer" hidden></span>
<a class="lp-btn lp-btn-primary lp-btn-sm lp-now-cta" data-now-cta href="#main" hidden></a>
</div></div>`;
}

/** 가벼운 모드 아이콘(깃털): 움직임을 차분 단계로 낮추고 무거운 효과(WebGL·외부 라이브러리)를 끕니다 */
const LITE_ICON = '<svg class="lp-ic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 4c-7 0-12 4-12 10v2l-3 4M8 16h4c4 0 8-4 8-12M8 16l6-6"/></svg>';

/** 반응 아이콘(선 그림). 실시간으로 주고받는 값은 그대로 이모지(프로토콜), 화면에는 사이트의 선 아이콘으로 보여 줌 */
const svgIc = (p) => `<svg class="lp-ic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
export const REACTIONS = [
  { v: '👏', label: '박수', ic: svgIc('<path d="M8.2 12.6 5.4 9.8a1.4 1.4 0 0 1 2-2l3.4 3.4M9 9 7.2 7.2a1.4 1.4 0 0 1 2-2L13.6 9.6M11.4 7.4l-.9-.9a1.4 1.4 0 0 1 2-2l4.9 4.9a6.2 6.2 0 0 1 0 8.8l-.2.2a6.2 6.2 0 0 1-8.8 0l-3.2-3.2a1.4 1.4 0 0 1 2-2l1.7 1.7"/><path d="M17.2 2.8v2.1M20.6 4.2l-1.4 1.4M21.4 7.6h-2.1"/>') },
  { v: '💡', label: '좋은 생각', ic: svgIc('<path d="M9.2 18h5.6M10.2 21h3.6M12 3a6 6 0 0 0-3.7 10.7c.7.6 1.1 1.4 1.2 2.3h5c.1-.9.5-1.7 1.2-2.3A6 6 0 0 0 12 3z"/>') },
  { v: '❤️', label: '좋아요', ic: icon('heart') },
];

function nav(ctx) {
  const links = ctx.bp.sections.filter((s) => s.nav && s.type !== 'hero');
  const brand = ctx.design.brandName || ctx.bp.meta.title;
  const { shown, more } = splitNav(links);
  const moreMenu = more.length ? `<details class="lp-more" data-more><summary aria-label="메뉴 더보기">더보기${icon('down')}</summary><ul class="lp-more-list">${more.map((s) => `<li>${navLink(s)}</li>`).join('')}</ul></details>` : '';
  return `<header class="lp-nav" data-nav>
<div class="lp-nav-in">
  <a class="lp-brand" href="#main">${ctx.design.logo ? `<img src="${esc(ctx.design.logo)}" alt="" width="28" height="28">` : '<span class="lp-brand-dot" aria-hidden="true"></span>'}<span>${esc(brand)}</span></a>
  ${links.length ? `<nav class="lp-nav-links" aria-label="영역 바로 가기"><div class="lp-nav-scroll">${shown.map(navLink).join('')}</div>${moreMenu}</nav>` : '<span></span>'}
  <div class="lp-nav-act">
    ${links.length ? `<button class="lp-btn lp-btn-ghost lp-btn-sm lp-toc-btn" type="button" data-toc-open aria-haspopup="dialog">${icon('menu')}<span>목차</span></button>` : ''}
    <button class="lp-icon-btn" type="button" data-share aria-label="QR 코드로 공유">${icon('qr')}</button>
    ${ctx.design.motion > 0 ? `<button class="lp-btn lp-btn-ghost lp-btn-sm lp-lite-btn" type="button" data-lite-toggle aria-pressed="false" title="움직임을 줄이고 무거운 효과를 꺼요">${LITE_ICON}<span>가벼운 모드</span></button>` : ''}
    <button class="lp-icon-btn" type="button" data-theme-toggle aria-label="밝게·어둡게 바꾸기">${icon('sun')}</button>
  </div>
</div>
${nowBar(ctx)}${phaseBar(ctx)}
${ctx.design.effects?.progress === 'guided-progress' ? '<div class="lp-scrollbar" data-fx="guided-progress"></div>' : '<div class="lp-scrollbar" data-scrollbar aria-hidden="true"></div>'}
</header>`;
}

function footer(ctx) {
  const m = ctx.bp.meta;
  const links = ctx.bp.sections.filter((s) => s.nav && s.type !== 'hero');
  const collects = ctx.bp.privacy.collect.some((c) => c !== 'nickname') && ctx.live;
  return `<footer class="lp-foot"><div class="lp-wrap">
<div class="lp-foot-main"><p class="lp-foot-title">${esc(m.title)}</p>${m.organizer ? `<p>${esc(m.organizer)}</p>` : ''}${m.date ? `<p>${esc(koDate(m.date))}${m.venue ? ` · ${esc(m.venue)}` : ''}</p>` : ''}${m.contact ? `<p>문의 ${contactHtml(m.contact)}</p>` : ''}</div>
${links.length ? `<nav class="lp-foot-links" aria-label="바닥글 메뉴">${links.map((s) => `<a href="#${esc(s.id)}">${esc(s.nav)}</a>`).join('')}</nav>` : ''}
<div class="lp-foot-meta">${collects || ctx.live ? '<a href="privacy.html">개인정보 처리 안내</a>' : ''}<a href="check.html">접속 확인</a><span>lecpage로 만들었어요</span><a href="#main" class="lp-totop">맨 위로 ${icon('up')}</a></div>
</div></footer>`;
}

function tocSheet(ctx) {
  const links = ctx.bp.sections.filter((s) => s.nav && s.type !== 'hero');
  if (!links.length) return '';
  return `<dialog class="lp-dialog lp-sheet" data-toc-sheet aria-labelledby="lp-toc-h"><div class="lp-dialog-in">
<div class="lp-sheet-h"><h2 id="lp-toc-h">목차</h2><button class="lp-icon-btn" type="button" data-sheet-close aria-label="목차 닫기">${icon('close')}</button></div>
<nav aria-label="목차"><ol class="lp-toc-list">${links.map((s) => `<li><a href="#${esc(s.id)}" data-toc-link="${esc(s.id)}">${esc(s.nav)}</a></li>`).join('')}</ol></nav></div></dialog>`;
}

function helpSheet(ctx) {
  if (!ctx.live || !ctx.bp.live.features.includes('help')) return '';
  return `<dialog class="lp-dialog lp-sheet" data-help-dialog aria-labelledby="lp-help-h"><form class="lp-dialog-in" data-help-form>
<div class="lp-sheet-h"><h2 id="lp-help-h">도움 요청</h2><button class="lp-icon-btn" type="button" data-sheet-close aria-label="닫기">${icon('close')}</button></div>
<p class="lp-small">강사가 자리로 갈게요. 자리는 이 기기에 저장돼요.</p>
<label><span>자리</span><input name="seat" maxlength="20" autocomplete="off" placeholder="예: 3모둠, 창가 두 번째"></label>
<label><span>무엇이 막혔나요? (선택)</span><textarea name="message" rows="2" maxlength="300"></textarea></label>
<div class="lp-compose-f"><button class="lp-btn lp-btn-ghost" type="button" data-sheet-close>취소</button><button class="lp-btn lp-btn-primary" type="submit">${icon('hand')}<span>요청하기</span></button></div></form></dialog>`;
}

function dialogs(ctx) {
  const pv = ctx.bp.privacy;
  const needName = pv.collect.includes('name');
  const needSchool = pv.collect.includes('school');
  return `<dialog class="lp-dialog" data-share-dialog aria-labelledby="lp-share-h"><form method="dialog" class="lp-dialog-in">
<h2 id="lp-share-h">사이트 공유</h2><div class="lp-qr lp-qr-lg" data-qr-self role="img" aria-label="이 페이지 QR 코드"></div>
<p class="lp-share-url" data-share-url></p><p class="lp-small lp-share-off" data-url-off hidden>인터넷에 올리면 여기에 참가자 주소와 QR이 나와요.</p>${ctx.live ? `<p class="lp-share-code">연수 코드 <b>${esc(ctx.bp.live.code)}</b></p>` : ''}
<div class="lp-compose-f"><button class="lp-btn lp-btn-ghost" type="button" data-copy-url>${icon('copy')}<span>주소 복사</span></button><button class="lp-btn lp-btn-primary" value="close">닫기</button></div></form></dialog>
${ctx.live ? `<dialog class="lp-dialog" data-join-dialog aria-labelledby="lp-join-h"><form class="lp-dialog-in" data-join-form>
<h2 id="lp-join-h">참여하기</h2><p class="lp-small">질문·보드·도움 요청에 쓸 별명을 정해 주세요.${ctx.bp.live.anonymous ? ' 질문은 이름 없이 올라가요.' : ''}</p>
<label><span>별명</span><input name="nickname" maxlength="20" required autocomplete="nickname"></label>
${needName ? '<label><span>이름</span><input name="name" maxlength="20" required autocomplete="name"></label>' : ''}
${needSchool ? '<label><span>소속(학교)</span><input name="school" maxlength="40" required autocomplete="organization"></label>' : ''}
${pv.consent && (needName || needSchool) ? `<label class="lp-consent"><input type="checkbox" name="consent" required><span>이름·소속을 출석 확인에만 쓰고, 연수가 끝나고 ${pv.retentionDays}일 뒤 지우는 데 동의합니다. 동의하지 않으면 참여 기능을 쓸 수 없어요. 안내와 교재는 그대로 볼 수 있어요. <a href="privacy.html" target="_blank">자세히</a></span></label>` : ''}
<div class="lp-compose-f"><button class="lp-btn lp-btn-ghost" type="button" data-join-cancel>나중에</button><button class="lp-btn lp-btn-primary" type="submit">참여</button></div></form></dialog>
<aside class="lp-dock" data-dock hidden aria-label="참여 도구">
  <span class="lp-live-dot" data-live-status title="연결 상태"></span>
  ${ctx.bp.live.features.includes('help') ? `<button class="lp-btn lp-btn-dock" type="button" data-dock-help>${icon('hand')}<span>도움 요청</span></button>` : ''}
  ${ctx.bp.live.features.includes('qa') ? `<button class="lp-btn lp-btn-dock lp-btn-dock-2" type="button" data-dock-qa>${icon('chat')}<span>질문</span></button>` : ''}
  ${ctx.bp.live.features.includes('signal') ? `<div class="lp-signal" role="group" aria-label="지금 이해 정도"><button type="button" data-signal="green" aria-pressed="false" title="이해했어요"><i aria-hidden="true">✓</i><span class="lp-sr">이해했어요</span></button><button type="button" data-signal="yellow" aria-pressed="false" title="조금 헷갈려요"><i aria-hidden="true">?</i><span class="lp-sr">조금 헷갈려요</span></button><button type="button" data-signal="red" aria-pressed="false" title="모르겠어요"><i aria-hidden="true">!</i><span class="lp-sr">모르겠어요</span></button></div>` : ''}
  ${ctx.bp.live.features.includes('reactions') ? `<div class="lp-react" role="group" aria-label="반응 보내기"><button type="button" class="lp-react-toggle" data-react-toggle aria-expanded="false" aria-label="반응 고르기">${REACTIONS[0].ic}</button><div class="lp-react-list" data-react-list>${REACTIONS.map((r) => `<button type="button" data-react="${r.v}" aria-label="${r.label}" title="${r.label}">${r.ic}</button>`).join('')}</div></div>` : ''}
</aside><div class="lp-reactions" data-reactions aria-hidden="true"></div>` : ''}
${tocSheet(ctx)}${helpSheet(ctx)}
<div class="lp-toast" data-toast role="status" aria-live="polite"></div>`;
}

export function renderIndex(ctx) {
  const bp = ctx.bp;
  const parts = bp.sections.map((s) => renderSection(s, ctx));
  const div = dividerBand(ctx);
  if (div) { const hi = bp.sections.findIndex((s) => s.type === 'hero'); parts.splice(hi + 1, 0, div); }
  const body = parts.join('\n\n');
  const pageFx = ctx.design.signature && (fxInfo(ctx.design.signature)?.slots || []).includes('scroll') ? ctx.design.signature : '';
  // QR 그리기(qr.js, 56KB)는 처음에 싣지 않음: 공유 대화상자를 열거나 QR 칸이 화면에 가까워지면 lecpage.js가 불러옴
  const scripts = [ctx.hasFx && 'assets/fx.js', ctx.live && 'assets/live.js', 'assets/lecpage.js'].filter(Boolean);
  return `<!doctype html>
<html lang="ko" ${attrs({ ...htmlAttrs(ctx.design), 'data-rest': String(ctx.design.rest ?? ctx.design.motion ?? 1) })}${ctx.design.signature ? ` data-signature="${esc(ctx.design.signature)}"` : ''}${ctx.design.signature === 'tone-journey' ? ' data-tones="1"' : ''}${ctx.design.motion > 0 ? ' data-pause-btn="nav"' : ''}>
<head>
${headTags(ctx, bp.meta.title, [], 'index')}
</head>
<body${pageFx ? ` data-fx="${esc(pageFx)}"` : ''}>
<a class="lp-skip" href="#main">본문 바로 가기</a>
${nav(ctx)}
<main id="main">
${body}
</main>
${footer(ctx)}
${dialogs(ctx)}
${jsonScript('lp-data', siteData(ctx))}
${ctx.design.effects?.cursor ? `<div class="lp-cursor-host" data-fx="${esc(ctx.design.effects.cursor)}" aria-hidden="true"></div>` : ''}
${ctx.design.effects?.scroll ? `<div hidden data-fx="${esc(ctx.design.effects.scroll)}"></div>` : ''}
${scripts.map((s) => `<script src="${s}" defer></script>`).join('\n')}
</body>
</html>
`;
}

function appShell(ctx, title, bodyClass, inner, scripts) {
  return `<!doctype html>
<html lang="ko" ${attrs({ ...htmlAttrs(ctx.design), 'data-motion': '1' })}>
<head>
${headTags(ctx, title)}
</head>
<body class="${bodyClass}">
${inner}
${jsonScript('lp-data', siteData(ctx))}
${jsonScript('lp-blueprint', { sections: ctx.bp.sections.map((s) => ({ id: s.id, type: s.type, title: s.title, items: s.type === 'poll' ? s.items : undefined, slides: s.type === 'deck' ? s.slides.length : undefined, moderation: s.type === 'board' ? !!s.moderation : undefined, allowFiles: s.type === 'board' ? boardFiles(s, ctx.bp) : undefined })), stations: (ctx.bp.sections.find((s) => s.type === 'stations')?.items || []).map((x) => ({ id: x.id, name: x.name, title: x.title })), deck: ctx.bp.sections.find((s) => s.type === 'deck')?.slides.length || 0 })}
${scripts.map((s) => `<script src="${s}" defer></script>`).join('\n')}
</body>
</html>
`;
}

export function renderConsole(ctx) {
  const inner = `<div class="lp-app" data-console>
<header class="lp-app-h"><div><p class="lp-small">강사 화면</p><h1>${esc(ctx.bp.meta.title)}</h1></div><div class="lp-app-h-act"><a class="lp-btn lp-btn-ghost lp-btn-sm" href="screen.html" target="_blank" rel="opener">${icon('expand')}<span>발표 화면</span></a><a class="lp-btn lp-btn-ghost lp-btn-sm" href="index.html" target="_blank">${icon('external')}<span>참가자 화면</span></a><a class="lp-btn lp-btn-ghost lp-btn-sm" href="poster.html" target="_blank">${icon('print')}<span>QR 안내문 인쇄</span></a></div></header>
<form class="lp-card lp-login" data-admin-form><h2>관리자 키</h2><p class="lp-small">배포할 때 만든 관리자 키를 넣어 주세요. 키는 이 탭에만 남아요.</p><label><span class="lp-sr">관리자 키</span><input type="password" name="key" autocomplete="current-password" required></label><button class="lp-btn lp-btn-primary" type="submit">들어가기</button>${ctx.bp.live.provider === 'local' ? '<p class="lp-small">미리보기에서는 아무 키나 넣어도 돼요.</p>' : ''}</form>
<main class="lp-console" data-console-main hidden></main>
<div class="lp-toast" data-toast role="status" aria-live="polite"></div></div>`;
  return appShell(ctx, `강사 화면 · ${ctx.bp.meta.title}`, 'lp-body-app', inner, ['assets/qr.js', 'assets/live.js', 'assets/console.js']);
}

export function renderScreen(ctx) {
  const signal = ctx.live && ctx.bp.live.features.includes('signal');
  const inner = `<div class="lp-screen" data-screen>
<header class="lp-screen-h"><h1>${esc(ctx.bp.meta.title)}</h1><div class="lp-screen-join"><div class="lp-qr" data-qr-join role="img" aria-label="참여 QR 코드"></div><div><p class="lp-small">휴대폰 카메라로 찍거나 주소로 들어오세요</p><p class="lp-screen-url" data-join-url></p>${ctx.live ? `<p class="lp-screen-code">연수 코드 <b>${esc(ctx.bp.live.code)}</b></p>` : ''}</div></div>
<button class="lp-btn lp-btn-ghost lp-tools-btn" type="button" data-tools-open aria-expanded="false" aria-controls="lp-tools">${icon('tools')}<span>도구</span></button></header>
<main class="lp-screen-body">
<div class="lp-screen-notice" data-notice hidden role="status"></div>
<div class="lp-screen-timer" data-timer hidden></div>
<div class="lp-timers" data-timers hidden role="region" aria-label="타이머"></div>
${signal ? '<div class="lp-screen-signal" data-screen-signal hidden role="region" aria-label="이해 신호"></div>' : ''}
<section class="lp-stage" data-tool-stage hidden aria-live="polite" aria-labelledby="lp-stage-h"><div class="lp-stage-h"><h2 id="lp-stage-h" data-stage-title></h2><button class="lp-btn lp-btn-ghost lp-btn-sm" type="button" data-stage-close>${icon('close')}<span>닫기</span></button></div><div data-stage-body></div></section>
<div class="lp-screen-main" data-screen-main><p class="lp-empty">${ctx.live ? '질문과 투표 결과가 여기에 크게 보여요.' : '오른쪽 위 도구에서 이름 뽑기·모둠·타이머를 쓸 수 있어요.'}</p></div>
</main>
<aside class="lp-drawer" id="lp-tools" data-tools hidden aria-labelledby="lp-tools-h"><div class="lp-drawer-h"><h2 id="lp-tools-h" tabindex="-1">도구</h2><button class="lp-icon-btn" type="button" data-tools-close aria-label="도구 닫기">${icon('close')}</button></div><div data-tools-body></div>
<p class="lp-drawer-links"><a class="lp-link" href="poster.html" target="_blank">${icon('print')}QR 안내문 인쇄</a>${ctx.live ? `<a class="lp-link" href="console.html" target="_blank">${icon('external')}강사 화면</a>` : ''}</p></aside>
<div class="lp-reactions" data-reactions aria-hidden="true"></div></div>
<div class="lp-toast" data-toast role="status" aria-live="polite"></div>`;
  return appShell(ctx, `발표 화면 · ${ctx.bp.meta.title}`, 'lp-body-screen', inner, ['assets/qr.js', ctx.live && 'assets/live.js', 'assets/screen.js'].filter(Boolean));
}

/** 인쇄용 QR 안내문(A4 한 장) + 강사 카드(반 장, 따로 인쇄). 참가자 주소·QR은 lecpage.js가 그립니다. */
export function renderPoster(ctx) {
  const m = ctx.bp.meta;
  const when = m.date ? `${koDate(m.date)}${m.start ? ` ${m.start}${m.end ? `~${m.end}` : ''}` : ''}` : '';
  const code = ctx.live ? ctx.bp.live.code : '';
  const inner = `<header class="lp-poster-bar"><p class="lp-small">A4 한 장으로 인쇄돼요. 강사 카드는 따로 한 장에 나와요.</p><label class="lp-row"><input type="checkbox" data-card-print checked><span>강사 카드도 인쇄</span></label><button class="lp-btn lp-btn-primary" type="button" data-print>${icon('print')}<span>인쇄하기</span></button><a class="lp-link" href="index.html">연수 사이트로</a></header>
<main class="lp-poster" data-poster>
<section class="lp-poster-page" aria-labelledby="lp-poster-h">
${m.organizer ? `<p class="lp-poster-org">${esc(m.organizer)}</p>` : ''}<h1 id="lp-poster-h">${br(m.title)}</h1>${m.subtitle ? `<p class="lp-poster-sub">${br(m.subtitle)}</p>` : ''}
${when || m.venue ? `<dl class="lp-poster-meta">${when ? `<div><dt>일시</dt><dd>${esc(when)}</dd></div>` : ''}${m.venue ? `<div><dt>장소</dt><dd>${esc(m.venue)}</dd></div>` : ''}</dl>` : ''}
<div class="lp-poster-qr lp-qr" data-qr-self role="img" aria-label="연수 사이트 QR 코드"></div>
<p class="lp-poster-cta">휴대폰 카메라로 QR을 찍어 들어오세요</p>
<p class="lp-poster-url" data-url-self></p>
${code ? `<p class="lp-poster-code">연수 코드 <b>${esc(code)}</b></p>` : ''}
<div class="lp-poster-wifi"><b>Wi-Fi</b><span>이름</span><i></i><span>암호</span><i></i></div>
</section>
<section class="lp-poster-card" data-teacher-card aria-labelledby="lp-card-h">
<p class="lp-poster-only">강사만</p><h2 id="lp-card-h">강사 카드 · ${esc(m.title)}</h2>
<p class="lp-small">이 카드는 강사만 보세요. 벽에 붙이지 말고, 관리자 키는 적지 마세요.</p>
<div class="lp-card-grid">${ctx.live ? `<div class="lp-qr" data-qr-page="console.html" role="img" aria-label="강사 화면 QR 코드"></div>` : ''}<dl>
${ctx.live ? `<div><dt>강사 화면</dt><dd data-url-page="console.html"></dd></div>` : ''}<div><dt>발표 화면</dt><dd data-url-page="screen.html"></dd></div><div><dt>접속 확인</dt><dd data-url-page="check.html"></dd></div>${code ? `<div><dt>연수 코드</dt><dd>${esc(code)}</dd></div>` : ''}</dl></div>
</section>
</main><div class="lp-toast" data-toast role="status" aria-live="polite"></div>`;
  return appShell(ctx, `QR 안내문 · ${m.title}`, 'lp-body-poster', inner, ['assets/qr.js', 'assets/lecpage.js']);
}

export function renderCheck(ctx) {
  const ready = ctx.bp.sections.find((s) => s.type === 'readiness');
  const checks = [
    { name: '글꼴·라이브러리 CDN', url: 'https://cdn.jsdelivr.net/npm/lenis@1.3.27/package.json' },
    ...(ctx.fontLinks.some((u) => u.includes('fonts.googleapis.com')) ? [{ name: '구글 글꼴', url: 'https://fonts.googleapis.com/css2?family=Jua' }] : []),
    ...(ctx.live && ctx.bp.live.url ? [{ name: '실시간 서버', url: ctx.bp.live.url }] : []),
    ...((ready?.checks) || []),
    ...(bpTools(ctx.bp).slice(0, 12)),
  ];
  const uniq = []; const seen = new Set();
  for (const c of checks) { const h = host(c.url) || c.url; if (!seen.has(h)) { seen.add(h); uniq.push(c); } }
  // 연수 정보에 적어 둔 '학교에서 막힌 곳'(audience.blocked): 주소면 함께 확인하고, 그 밖의 말(예: websocket)은 글로만 알려 줌
  const blocked = ctx.bp.audience?.blocked || [];
  const asUrl = (b) => { const m = /^(?:https?:\/\/)?((?:[\w-]+\.)+[a-z]{2,})(\/\S*)?$/i.exec(String(b).trim()); return m ? `https://${m[1]}${m[2] || '/'}` : ''; };
  for (const b of blocked) { const u = asUrl(b); if (u && !seen.has(host(u))) { seen.add(host(u)); uniq.push({ name: host(u), url: u, known: true }); } }
  const blockedNote = blocked.length ? `<div class="lp-notice-box lp-check-blocked"><b>미리 알려 준 막힌 곳 ${blocked.length}곳</b><p>${blocked.map((b) => esc(b)).join(' · ')}</p><p>연수 정보에 적어 둔 곳이에요. 여기서도 막힘으로 나오면 다른 도구를 준비하거나 정보 담당 선생님께 열어 달라고 요청하세요.</p></div>` : '';
  const inner = `<main class="lp-wrap lp-check"><h1 class="lp-h2">접속 확인</h1><p class="lp-lead">연수에 쓰는 사이트가 이 기기와 네트워크에서 열리는지 확인해요. 막힌 곳이 있으면 결과를 복사해 정보 담당 선생님께 보내 주세요.</p>
<div class="lp-diag lp-card" data-diag='${esc(JSON.stringify(uniq))}' data-diag-auto data-live-check="${ctx.live ? 1 : 0}"><div class="lp-diag-h"><h2>확인 항목 ${uniq.length}개</h2><button class="lp-btn lp-btn-primary" type="button" data-diag-run>다시 확인</button></div>
<ul class="lp-diag-list">${uniq.map((c) => `<li data-url="${esc(c.url)}"${c.known ? ' data-known-blocked' : ''}><span class="lp-diag-dot" aria-hidden="true"></span><span>${esc(c.name)}${c.known ? ' <em class="lp-diag-known">막힌 곳으로 적어 둠</em>' : ''}</span><small>${esc(host(c.url))}</small><b class="lp-diag-state">확인 전</b></li>`).join('')}</ul>
${blockedNote}
${ctx.live ? '<p class="lp-small" data-live-diag>실시간 연결 방식: 확인 중…</p>' : ''}
<p class="lp-small" data-env></p><button class="lp-btn lp-btn-ghost" type="button" data-diag-copy>${icon('copy')}<span>결과 복사</span></button></div>
<p><a class="lp-link" href="index.html">연수 사이트로 돌아가기 ${icon('arrow')}</a></p></main><div class="lp-toast" data-toast role="status" aria-live="polite"></div>`;
  return appShell(ctx, `접속 확인 · ${ctx.bp.meta.title}`, 'lp-body-check', inner, [ctx.live && 'assets/live.js', 'assets/lecpage.js'].filter(Boolean));
}
function bpTools(bp) {
  const t = bp.sections.find((s) => s.type === 'tools');
  return (t?.items || []).filter((x) => x.url).map((x) => ({ name: x.name, url: x.url }));
}

export function renderPrivacy(ctx) {
  const bp = ctx.bp, pv = bp.privacy;
  const items = { nickname: '별명', name: '이름', school: '소속(학교)', email: '이메일' };
  const procs = pv.processors.length ? pv.processors : defaultProcessors(bp);
  const acts = activityItems(bp);
  const anonQa = bp.live.anonymous !== false && (bp.sections.some((s) => s.type === 'qa') || bp.live.features.includes('qa'));
  const who = bp.meta.organizer || bp.instructors[0]?.name || '연수 운영자';
  const contact = contactHtml(pv.contact || bp.meta.contact || bp.instructors.find((i) => i.email && i.showEmail)?.email || '연수 운영자에게 문의해 주세요.');
  const rows = (p) => [['이전받는 자', `${esc(p.name)}${p.contact ? ` (${contactHtml(p.contact)})` : ''}`], ['이전 국가', esc(p.country)], ['이전 항목', '위 2의 항목 전부'], ['이전 시기·방법', '참여 기능을 쓸 때마다 네트워크로 전송'], ['이용 목적·보유 기간', `${esc(p.purpose)}, 위 3의 보유 기간까지`], ['거부 방법과 효과', '참여 기능을 쓰지 않으면 전송되지 않습니다. 이 경우 질문·투표 등은 쓸 수 없고, 안내와 교재는 그대로 볼 수 있습니다.']];
  const inner = `<main class="lp-wrap lp-prose lp-privacy"><h1 class="lp-h2">개인정보 처리 안내</h1>
<p><b>개인정보처리자</b> ${esc(who)}</p>
<p>「${esc(bp.meta.title)}」 연수를 운영하면서 아래 개인정보만 처리합니다. 이 사이트를 만든 도구인 lecpage의 운영자는 참가자 정보를 받거나 보관하지 않습니다.</p>
<h2>1. 처리 목적</h2><p>연수 중 질문·도움 요청·결과물 공유${pv.collect.includes('name') ? ', 출석 및 이수 확인' : ''}.</p>
<h2>2. 처리 항목</h2><p>${pv.collect.map((c) => items[c]).filter(Boolean).join(', ')}, 참가자를 구분하는 임의 번호.</p>
<p>참여 기록: ${acts.length ? acts.join(', ') : '참여 중 남긴 글'}.</p>${anonQa ? '\n<p>익명 질문은 다른 참가자와 발표 화면에 이름이 보이지 않습니다. 다만 서버에는 그 임의 번호와 함께 저장됩니다.</p>' : ''}
<p>주민등록번호·전화번호·생년월일은 받지 않습니다. 질문이나 글에 본인 또는 다른 사람의 개인정보를 적지 마세요.</p>${bp.live.provider === 'http' ? '\n<p>접속할 때 IP 주소가 서버에 전달되며, 잘못된 접근을 막는 횟수 제한에만 씁니다.</p>' : ''}${bp.audience?.minor ? '\n<p>만 14세 미만 참가자는 별명만 입력합니다. 이름 등 다른 개인정보는 받지 않습니다.</p>' : ''}
<h2>3. 보유 기간과 파기</h2><p>연수 종료 후 ${pv.retentionDays}일까지 보관하고, 그 뒤 지체 없이 파기합니다. 서버의 기록과 올린 파일은 강사 화면의 '데이터 모두 지우기'로 복구할 수 없게 지우고, 내려받은 명단 파일도 함께 지웁니다.</p>
<h2>4. 동의를 거부할 권리</h2><p>동의하지 않아도 사이트의 안내·교재·실습 화면은 그대로 쓸 수 있습니다. 다만 출석 확인 등 이름이 필요한 기능은 쓸 수 없습니다.</p>
<h2>5. 참가자의 권리</h2><p>참가자는 자신의 개인정보를 열람·정정·삭제하거나 처리를 멈춰 달라고 요구할 수 있습니다. 아래 문의처로 연락하면 10일 안에 조치하고 알려 드립니다.${bp.audience?.minor ? ' 만 14세 미만은 법정대리인이 요구할 수 있습니다.' : ''}</p>
<h2>6. 제3자 제공, 처리 위탁, 국외 이전</h2>${procs.length ? `<p>제3자에게 제공하지 않습니다. 참여 기록을 저장하기 위해 아래 회사에 처리를 맡기며, 이 회사의 서버가 국외에 있을 수 있습니다.</p>${procs.map((p) => `<div class="lp-table-wrap"><table class="lp-table"><tbody>${rows(p).map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('')}</tbody></table></div>`).join('')}` : '<p>제3자에게 제공하지 않고, 처리를 맡기는 곳도 없습니다.</p>'}
<p>사이트 파일을 보내 주는 호스팅 회사와 글꼴·효과 파일을 보내 주는 CDN(jsDelivr, Google Fonts, 네이버)에 접속 기록(IP 주소 등)이 남을 수 있습니다.</p>
<h2>7. 안전 조치</h2><p>모든 전송은 암호화(HTTPS)됩니다. 기록은 관리자 키를 아는 강사만 볼 수 있고, 틀린 키를 여러 번 넣으면 잠시 막습니다. 필요한 항목만 받고 보유 기간이 지나면 지웁니다.</p>
<h2>8. 이 브라우저에 저장하는 정보</h2><p>별명과 임의 번호, 화면 설정을 이 브라우저의 저장소(localStorage)에 둡니다. 쿠키와 분석 도구는 쓰지 않습니다. 브라우저의 사이트 데이터 삭제로 지울 수 있습니다.</p>
<h2>9. 문의</h2><p>${contact}</p>
<p>침해 신고·상담: 개인정보침해신고센터(privacy.kisa.or.kr, 118), 개인정보 분쟁조정위원회(www.kopico.go.kr, 1833-6972)</p>
<p class="lp-small">${ctx.builtOn ? `시행일 ${esc(ctx.builtOn)}. ` : ''}이 안내는 연수 설정에 맞춰 자동으로 만들어졌습니다. 소속 기관의 개인정보 처리방침이 따로 있으면 그 방침이 우선합니다.</p>
<p><a class="lp-link" href="index.html">연수 사이트로 돌아가기</a></p></main>`;
  return appShell(ctx, `개인정보 처리 안내 · ${bp.meta.title}`, 'lp-body-doc', inner, []);
}
/** 이 사이트가 실제로 모으는 참여 기록(켜진 칸·기능만) */
function activityItems(bp) {
  const has = (t) => bp.sections.some((s) => s.type === t);
  const on = (k) => bp.live.features.includes(k);
  const boards = bp.sections.filter((s) => s.type === 'board');
  return [
    (has('qa') || on('qa')) && '질문',
    boards.length && (boards.some((s) => boardFiles(s, bp)) ? '나눔 보드에 올린 글·파일' : '나눔 보드에 올린 글'),
    on('help') && '도움 요청과 자리 번호',
    on('progress') && '실습 진행 상태',
    (has('poll') || on('poll')) && '투표 응답',
    on('signal') && '신호등 응답',
    bp.sections.some((s) => s.type === 'survey' && s.questions?.length) && '설문 응답',
    (has('attendance') || on('attendance')) && '입실·퇴실 시각',
  ].filter(Boolean);
}
function defaultProcessors(bp) {
  const map = {
    supabase: [{ name: 'Supabase Inc.', contact: 'privacy@supabase.com', country: '미국(서버 지역은 강사가 선택)', purpose: '실시간 기능 데이터 저장' }],
    sheets: [{ name: 'Google LLC', contact: 'https://support.google.com/policies/contact/general_privacy_form', country: '미국', purpose: '구글 시트·드라이브에 응답 저장' }],
    http: [{ name: '실시간 서버 운영자(Cloudflare, Inc. 또는 자체 서버)', contact: /(^|\.)workers\.dev$/.test(host(bp.live.url)) ? 'privacyquestions@cloudflare.com' : '', country: 'Cloudflare: 미국 / 자체 서버: 서버 위치', purpose: '실시간 기능 중계와 저장' }],
  };
  return map[bp.live.provider] || [];
}

// ── 문서 ─────────────────────────────────────────────────
export function designDoc(ctx) {
  const p = getPreset(ctx.design.preset);
  const fx = Object.entries(ctx.design.effects || {}).map(([k, v]) => `| ${k} | ${v} |`).join('\n');
  return `# DESIGN.md — ${ctx.bp.meta.title}

이 파일은 이 연수 사이트의 디자인 규칙입니다. 어떤 AI나 사람이 고치더라도 이 규칙을 지키면 일관성이 유지됩니다.

- 프리셋: **${p.name_ko}** (\`${p.id}\`) — ${p.desc_ko}
- 테마: ${ctx.design.theme && ctx.design.theme !== 'preset' ? ctx.design.theme : p.theme} · 모션 단계: ${ctx.design.motion} (0 정지 · 1 차분 · 2 보통 · 3 화려)
- 대표 효과: ${ctx.design.signature || '없음'} · 첫 화면 그래픽: ${ctx.design.graphic || '없음'} · 마무리 그래픽: ${ctx.design.closingGraphic || '없음'}
- 글꼴: 제목 ${p.fonts.display}, 본문 ${p.fonts.body}, 숫자·코드 ${p.fonts.mono}
${ctx.design.accent ? `- 기관 강조색: ${ctx.design.accent}\n` : ''}
## 색과 모양
색은 \`assets/theme.css\`의 CSS 변수만 씁니다(--background, --foreground, --primary, --accent …). 새 색을 직접 쓰지 않습니다.
모서리 ${p.shape.radius}px, 테두리 ${p.shape.borderW}px, 그림자 스타일 ${p.shape.shadow}. 부품 변형: 첫 화면 ${p.variants.hero}, 카드 ${p.variants.card}, 메뉴 ${p.variants.nav}, 버튼 ${p.variants.btn}.

## 슬롯별 효과
| 슬롯 | 효과 |
|---|---|
${fx || '| - | - |'}

## 지킬 것
- 실습·질문·교재 화면은 모션 1단계를 넘지 않습니다.
- 화려한 효과는 첫 화면·섹션 시작·마무리에만, 시그니처는 하나만.
- 동작 줄이기 설정과 '움직임 멈춤' 버튼을 항상 존중합니다.
- 글자 대비 4.5:1 이상, 한글 줄바꿈은 낱말 단위(word-break: keep-all).
- 보라→파랑 그라데이션 첫 화면, 똑같은 카드 3장 나열, 흔한 AI 이미지를 피합니다.
- 상자는 꼭 필요할 때만 씁니다. 알약 모양 꼬리표, 상자 한쪽 색 띠, 상자 속 상자, 그라데이션 글자, 이모지 아이콘을 쓰지 않습니다(lecpage \`references/design-quality.md\`, 검사: \`scripts/design-lint.mjs\`).
${(ctx.design._notes || []).length ? `\n## 결정 메모\n${ctx.design._notes.map((n) => `- ${n}`).join('\n')}\n` : ''}`;
}

/** 실시간 방식(live.provider) → 강사에게 보이는 이름과 한 줄 설명 */
const PROVIDER_KO = { sheets: '구글 시트', supabase: 'Supabase', http: '내 서버·Cloudflare', local: '이 컴퓨터에서만 시험', none: '없음' };
const PROVIDER_WHY = {
  sheets: '구글 시트(Apps Script)에 연결했습니다. 기록이 강사의 구글 시트에 쌓이고, 화면은 5~10초마다 새로 읽습니다. 50명 안팎까지 알맞습니다.',
  supabase: 'Supabase에 연결했습니다. 질문·진행 현황이 바로 바뀌고, 기록은 강사의 Supabase 프로젝트에 쌓입니다. 100명 안팎까지 알맞습니다.',
  http: '내 서버 또는 Cloudflare에 연결했습니다. 기록은 그 서버에 쌓입니다.',
  local: '실시간 서버에 연결하지 않았습니다. 한 브라우저 안에서만 이어지는 시험용이라 참가자 기기끼리는 이어지지 않습니다. 연수 전에 서버를 연결하고 다시 만드세요.',
  none: '실시간 기능을 쓰지 않습니다. 완료 체크·메모는 참가자 각자의 브라우저에 저장됩니다.',
};

/**
 * 운영안내.md. 운영 방식은 실제로 연결한 live.provider를 따릅니다.
 * infra(decideInfra 결과)는 추천이 연결한 방식과 같으면 주의만, 다르면 추천한 방식을 한 줄로 덧붙입니다.
 */
export function opsDoc(ctx, infra) {
  const bp = ctx.bp;
  const live = ctx.live;
  const prov = live ? bp.live.provider : 'none';
  const name = PROVIDER_KO[prov] || prov;
  const same = !!infra && infra.liveProvider === prov;
  const rec = infra && !same ? infra.backendInfo?.name_ko : '';
  const files = ['`index.html` 참가자 화면', live && '`console.html` 강사 화면', '`screen.html` 발표 화면', '`check.html` 접속 확인', '`poster.html` QR 안내문 인쇄', live && '`privacy.html` 개인정보 처리 안내'].filter(Boolean);
  const before = { supabase: 'Supabase 무료 프로젝트는 7일 동안 사용이 없으면 멈춥니다. 연수 하루 전 접속 확인(`check.html`)으로 깨어 있는지 봅니다.', sheets: '구글 시트의 Apps Script 배포 주소가 바뀌지 않았는지 확인합니다.', http: '서버가 켜져 있는지 확인합니다.', local: '실시간 서버를 연결했는지 확인합니다. 지금은 참가자 기기끼리 이어지지 않습니다.' }[prov];
  return `# 운영 안내 — ${bp.meta.title}

${bp.meta.date ? `연수일: ${koDate(bp.meta.date)} ${bp.meta.start || ''}${bp.meta.end ? '~' + bp.meta.end : ''}\n` : ''}연수 코드: **${bp.live.code}** · 실시간 방식: ${live ? name : '없음'}

## 파일
- ${files.join(' · ')}

## 연수 전
1. 사이트를 배포하고 주소를 단축 주소·QR로 만듭니다. 현장에 붙일 안내문은 \`poster.html\`을 인쇄합니다.
2. 연수 장소의 와이파이로 \`check.html\`을 열어 막힌 사이트가 없는지 확인합니다.
${live ? `3. 관리자 키로 강사 화면(\`console.html\`)에 들어가 참가자 화면과 함께 리허설합니다(두 기기로 질문·도움 요청을 보내 보세요).\n${before ? `4. ${before}\n` : ''}` : ''}
## 연수 중
${live ? '- 강사 화면에서 진행 현황(누가 어디까지 했는지)과 도움 요청한 사람을 봅니다. 도움 요청은 "맡기" → "해결"로 처리합니다.\n- 타이머·공지를 보내면 참가자 화면 위에 나타납니다. "강사 따라가기"를 켜면 지금 단계·쪽으로 참가자 화면이 움직입니다.\n- 프로젝터에는 발표 화면(`screen.html`)을 띄웁니다.\n' : '- 프로젝터에 첫 화면의 QR(공유 버튼)을 띄워 접속을 안내합니다.\n'}
## 연수 후
- 만족도 조사 응답을 확인합니다.
${live ? `- 강사 화면에서 출석·진행·질문 기록을 CSV로 내려받습니다.\n- 보유 기간(${bp.privacy.retentionDays}일)이 지나면 강사 화면의 "데이터 모두 지우기"를 누릅니다.\n- 계속 공개할 사이트라면 실시간 기능을 끄고 다시 만들어 정적 아카이브로 바꿉니다.\n` : '- 사이트는 그대로 두면 자료 아카이브로 쓸 수 있습니다.\n'}- 연수 날짜가 지나면 참가자 화면 맨 위에 '끝난 연수' 줄이 뜨고, \`연수 후 안내\` 칸이 첫 화면 바로 아래로 올라옵니다. 다시 보기 영상·소통방·이수 처리 일정을 그 칸에 넣어 다시 빌드하세요(미리 보기: 주소 끝에 \`?phase=after\`).

## 운영 방식: ${name}
- ${PROVIDER_WHY[prov] || ''}
${rec ? `- 연수 정보(인원·기능)로 추천한 방식: ${rec}\n` : ''}${same && infra.warnings.length ? `\n주의\n${infra.warnings.map((w) => `- ${w}`).join('\n')}\n` : ''}`;
}

export function sectionLabel(type) { return SECTION_DEFS[type]?.label || type; }
