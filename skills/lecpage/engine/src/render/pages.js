// 페이지 조립: index(참가자) · console(강사) · screen(프로젝터) · check(접속 진단) · privacy · poster(인쇄용 QR 안내문)
import { esc, br, href, icon, koDate, host } from './html.js';
import { renderSection } from './sections.js';
import { htmlAttrs } from '../design/tokens.js';
import { getPreset } from '../design/presets.js';
import { SECTION_DEFS } from '../schema/sections.js';
import { fxInfo } from '../decide/design.js';

/** 구분 띠: 첫 화면 아래에 흐르는 띠(marquee)나 선·물결 장식 */
function dividerBand(ctx) {
  const id = ctx.design.effects?.divider; if (!id) return '';
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

function headTags(ctx, title, extraCss = [], page = 'app') {
  const m = ctx.bp.meta;
  const desc = m.description || m.subtitle || `${m.title} 연수 안내`;
  const bg = ctx.themeColor;
  return `<meta charset="utf-8">
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
  };
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
    ${ctx.design.motion > 0 ? `<button class="lp-icon-btn" type="button" data-motion-toggle aria-pressed="false" aria-label="움직임 멈추기">${icon('pause')}</button>` : ''}
    <button class="lp-icon-btn" type="button" data-theme-toggle aria-label="밝게·어둡게 바꾸기">${icon('sun')}</button>
  </div>
</div>
${nowBar(ctx)}
${ctx.design.effects?.progress === 'guided-progress' ? '<div class="lp-scrollbar" data-fx="guided-progress"></div>' : '<div class="lp-scrollbar" data-scrollbar aria-hidden="true"></div>'}
</header>`;
}

function footer(ctx) {
  const m = ctx.bp.meta;
  const links = ctx.bp.sections.filter((s) => s.nav && s.type !== 'hero');
  const collects = ctx.bp.privacy.collect.some((c) => c !== 'nickname') && ctx.live;
  return `<footer class="lp-foot"><div class="lp-wrap">
<div class="lp-foot-main"><p class="lp-foot-title">${esc(m.title)}</p>${m.organizer ? `<p>${esc(m.organizer)}</p>` : ''}${m.date ? `<p>${esc(koDate(m.date))}${m.venue ? ` · ${esc(m.venue)}` : ''}</p>` : ''}</div>
${links.length ? `<nav class="lp-foot-links" aria-label="바닥글 메뉴">${links.map((s) => `<a href="#${esc(s.id)}">${esc(s.nav)}</a>`).join('')}</nav>` : ''}
<div class="lp-foot-meta">${collects || ctx.live ? '<a href="privacy.html">개인정보 처리 안내</a>' : ''}<a href="check.html">접속 진단</a><span>lecpage로 만들었어요</span><a href="#main" class="lp-totop">맨 위로 ${icon('up')}</a></div>
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
<p class="lp-small">강사나 도우미 선생님이 자리로 갈게요. 자리는 이 기기에 기억해 두어요.</p>
<label><span>자리</span><input name="seat" maxlength="20" autocomplete="off" placeholder="예: 3모둠, 창가 두 번째"></label>
<label><span>무엇이 막혔나요? (적지 않아도 돼요)</span><textarea name="message" rows="2" maxlength="300"></textarea></label>
<div class="lp-compose-f"><button class="lp-btn lp-btn-ghost" type="button" data-sheet-close>취소</button><button class="lp-btn lp-btn-primary" type="submit">${icon('hand')}<span>도움 요청 보내기</span></button></div></form></dialog>`;
}

function dialogs(ctx) {
  const pv = ctx.bp.privacy;
  const needName = pv.collect.includes('name');
  const needSchool = pv.collect.includes('school');
  return `<dialog class="lp-dialog" data-share-dialog aria-labelledby="lp-share-h"><form method="dialog" class="lp-dialog-in">
<h2 id="lp-share-h">이 연수 사이트 공유</h2><div class="lp-qr lp-qr-lg" data-qr-self role="img" aria-label="이 페이지 QR 코드"></div>
<p class="lp-share-url" data-share-url></p><p class="lp-small lp-share-off" data-url-off hidden>인터넷에 올리면 여기에 참가자 주소와 QR이 나와요.</p>${ctx.live ? `<p class="lp-share-code">참여 코드 <b>${esc(ctx.bp.live.code)}</b></p>` : ''}
<div class="lp-compose-f"><button class="lp-btn lp-btn-ghost" type="button" data-copy-url>${icon('copy')}<span>주소 복사</span></button><button class="lp-btn lp-btn-primary" value="close">닫기</button></div></form></dialog>
${ctx.live ? `<dialog class="lp-dialog" data-join-dialog aria-labelledby="lp-join-h"><form class="lp-dialog-in" data-join-form>
<h2 id="lp-join-h">참여하기</h2><p class="lp-small">질문·막혔어요·보드에 쓰일 이름을 정해 주세요.${ctx.bp.live.anonymous ? ' 질문은 이름 없이 올라가요.' : ''}</p>
<label><span>별명</span><input name="nickname" maxlength="20" required autocomplete="nickname"></label>
${needName ? '<label><span>이름</span><input name="name" maxlength="20" required autocomplete="name"></label>' : ''}
${needSchool ? '<label><span>소속(학교)</span><input name="school" maxlength="40" required autocomplete="organization"></label>' : ''}
${pv.consent && (needName || needSchool) ? `<label class="lp-consent"><input type="checkbox" name="consent" required><span>이름·소속을 연수 출석 확인에만 쓰고, 연수가 끝나고 ${pv.retentionDays}일 뒤 지우는 데 동의합니다. 동의하지 않으면 출석 확인을 할 수 없어요. <a href="privacy.html" target="_blank">자세히</a></span></label>` : ''}
<div class="lp-compose-f"><button class="lp-btn lp-btn-ghost" type="button" data-join-cancel>나중에</button><button class="lp-btn lp-btn-primary" type="submit">참여</button></div></form></dialog>
<aside class="lp-dock" data-dock hidden aria-label="참여 도구">
  <span class="lp-live-dot" data-live-status title="연결 상태"></span>
  ${ctx.bp.live.features.includes('help') ? `<button class="lp-btn lp-btn-dock" type="button" data-dock-help>${icon('hand')}<span>막혔어요</span></button>` : ''}
  ${ctx.bp.live.features.includes('qa') ? `<button class="lp-btn lp-btn-dock lp-btn-dock-2" type="button" data-dock-qa>${icon('chat')}<span>질문</span></button>` : ''}
  ${ctx.bp.live.features.includes('signal') ? `<div class="lp-signal" role="group" aria-label="지금 이해 정도"><button type="button" data-signal="green" aria-pressed="false" title="이해했어요"><i aria-hidden="true">✓</i><span class="lp-sr">이해했어요</span></button><button type="button" data-signal="yellow" aria-pressed="false" title="조금 헷갈려요"><i aria-hidden="true">?</i><span class="lp-sr">조금 헷갈려요</span></button><button type="button" data-signal="red" aria-pressed="false" title="도와주세요"><i aria-hidden="true">!</i><span class="lp-sr">도와주세요</span></button></div>` : ''}
  ${ctx.bp.live.features.includes('reactions') ? `<div class="lp-react" role="group" aria-label="반응 보내기"><button type="button" class="lp-react-toggle" data-react-toggle aria-expanded="false" aria-label="반응 고르기">👏</button><div class="lp-react-list" data-react-list><button type="button" data-react="👏" aria-label="박수">👏</button><button type="button" data-react="💡" aria-label="좋은 생각">💡</button><button type="button" data-react="❤️" aria-label="좋아요">❤️</button></div></div>` : ''}
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
  const scripts = ['assets/qr.js', ctx.hasFx && 'assets/fx.js', ctx.live && 'assets/live.js', 'assets/lecpage.js'].filter(Boolean);
  return `<!doctype html>
<html lang="ko" ${attrs(htmlAttrs(ctx.design))}${ctx.design.signature === 'tone-journey' ? ' data-tones="1"' : ''}${ctx.design.motion > 0 ? ' data-pause-btn="nav"' : ''}>
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
${jsonScript('lp-blueprint', { sections: ctx.bp.sections.map((s) => ({ id: s.id, type: s.type, title: s.title, items: s.type === 'poll' ? s.items : undefined, slides: s.type === 'deck' ? s.slides.length : undefined, moderation: s.type === 'board' ? !!s.moderation : undefined })), stations: (ctx.bp.sections.find((s) => s.type === 'stations')?.items || []).map((x) => ({ id: x.id, name: x.name, title: x.title })), deck: ctx.bp.sections.find((s) => s.type === 'deck')?.slides.length || 0 })}
${scripts.map((s) => `<script src="${s}" defer></script>`).join('\n')}
</body>
</html>
`;
}

export function renderConsole(ctx) {
  const inner = `<div class="lp-app" data-console>
<header class="lp-app-h"><div><p class="lp-small">강사 콘솔</p><h1>${esc(ctx.bp.meta.title)}</h1></div><div class="lp-app-h-act"><a class="lp-btn lp-btn-ghost lp-btn-sm" href="screen.html" target="_blank" rel="opener">${icon('expand')}<span>프로젝터 화면</span></a><a class="lp-btn lp-btn-ghost lp-btn-sm" href="index.html" target="_blank">${icon('external')}<span>참가자 화면</span></a><a class="lp-btn lp-btn-ghost lp-btn-sm" href="poster.html" target="_blank">${icon('print')}<span>QR 안내문 인쇄</span></a></div></header>
<form class="lp-card lp-login" data-admin-form><h2>관리자 키 입력</h2><p class="lp-small">배포할 때 만든 관리자 키를 넣어 주세요. 키는 이 탭에만 기억합니다.</p><label><span class="lp-sr">관리자 키</span><input type="password" name="key" autocomplete="current-password" required></label><button class="lp-btn lp-btn-primary" type="submit">시작</button>${ctx.bp.live.provider === 'local' ? '<p class="lp-small">미리보기 모드에서는 아무 키나 넣어도 됩니다.</p>' : ''}</form>
<main class="lp-console" data-console-main hidden></main>
<div class="lp-toast" data-toast role="status" aria-live="polite"></div></div>`;
  return appShell(ctx, `강사 콘솔 · ${ctx.bp.meta.title}`, 'lp-body-app', inner, ['assets/qr.js', 'assets/live.js', 'assets/console.js']);
}

export function renderScreen(ctx) {
  const signal = ctx.live && ctx.bp.live.features.includes('signal');
  const inner = `<div class="lp-screen" data-screen>
<header class="lp-screen-h"><h1>${esc(ctx.bp.meta.title)}</h1><div class="lp-screen-join"><div class="lp-qr" data-qr-join role="img" aria-label="참여 QR 코드"></div><div><p class="lp-small">휴대폰 카메라로 찍거나 주소로 들어오세요</p><p class="lp-screen-url" data-join-url></p>${ctx.live ? `<p class="lp-screen-code">참여 코드 <b>${esc(ctx.bp.live.code)}</b></p>` : ''}</div></div>
<button class="lp-btn lp-btn-ghost lp-tools-btn" type="button" data-tools-open aria-expanded="false" aria-controls="lp-tools">${icon('tools')}<span>도구</span></button></header>
<main class="lp-screen-body">
<div class="lp-screen-notice" data-notice hidden role="status"></div>
<div class="lp-screen-timer" data-timer hidden></div>
<div class="lp-timers" data-timers hidden role="region" aria-label="타이머"></div>
${signal ? '<div class="lp-screen-signal" data-screen-signal hidden role="region" aria-label="이해 신호"></div>' : ''}
<section class="lp-stage" data-tool-stage hidden aria-live="polite" aria-labelledby="lp-stage-h"><div class="lp-stage-h"><h2 id="lp-stage-h" data-stage-title></h2><button class="lp-btn lp-btn-ghost lp-btn-sm" type="button" data-stage-close>${icon('close')}<span>닫기</span></button></div><div data-stage-body></div></section>
<div class="lp-screen-main" data-screen-main><p class="lp-empty">${ctx.live ? '질문과 투표 결과가 여기에 크게 보여요.' : '오른쪽 위 도구 버튼으로 이름 뽑기·모둠 만들기·타이머를 쓸 수 있어요.'}</p></div>
</main>
<aside class="lp-drawer" id="lp-tools" data-tools hidden aria-labelledby="lp-tools-h"><div class="lp-drawer-h"><h2 id="lp-tools-h" tabindex="-1">도구</h2><button class="lp-icon-btn" type="button" data-tools-close aria-label="도구 닫기">${icon('close')}</button></div><div data-tools-body></div>
<p class="lp-drawer-links"><a class="lp-link" href="poster.html" target="_blank">${icon('print')}QR 안내문 인쇄</a>${ctx.live ? `<a class="lp-link" href="console.html" target="_blank">${icon('external')}강사 콘솔</a>` : ''}</p></aside>
<div class="lp-reactions" data-reactions aria-hidden="true"></div></div>
<div class="lp-toast" data-toast role="status" aria-live="polite"></div>`;
  return appShell(ctx, `프로젝터 · ${ctx.bp.meta.title}`, 'lp-body-screen', inner, ['assets/qr.js', ctx.live && 'assets/live.js', 'assets/screen.js'].filter(Boolean));
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
${code ? `<p class="lp-poster-code">참여 코드 <b>${esc(code)}</b></p>` : ''}
<div class="lp-poster-wifi"><b>Wi-Fi</b><span>이름</span><i></i><span>암호</span><i></i></div>
</section>
<section class="lp-poster-card" data-teacher-card aria-labelledby="lp-card-h">
<p class="lp-poster-only">강사만</p><h2 id="lp-card-h">강사 카드 · ${esc(m.title)}</h2>
<p class="lp-small">이 카드는 강사만 보세요. 벽에 붙이지 말고, 관리자 키는 적지 마세요.</p>
<div class="lp-card-grid">${ctx.live ? `<div class="lp-qr" data-qr-page="console.html" role="img" aria-label="강사 콘솔 QR 코드"></div>` : ''}<dl>
${ctx.live ? `<div><dt>강사 콘솔</dt><dd data-url-page="console.html"></dd></div>` : ''}<div><dt>프로젝터 화면</dt><dd data-url-page="screen.html"></dd></div><div><dt>접속 진단</dt><dd data-url-page="check.html"></dd></div>${code ? `<div><dt>참여 코드</dt><dd>${esc(code)}</dd></div>` : ''}</dl></div>
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
  const inner = `<main class="lp-wrap lp-check"><h1 class="lp-h2">접속 진단</h1><p class="lp-lead">연수에 필요한 사이트가 이 기기와 네트워크에서 열리는지 확인합니다. 결과를 정보 담당 선생님께 보여 주면 차단을 풀 때 도움이 됩니다.</p>
<div class="lp-diag lp-card" data-diag='${esc(JSON.stringify(uniq))}' data-diag-auto data-live-check="${ctx.live ? 1 : 0}"><div class="lp-diag-h"><h2>확인 항목 ${uniq.length}개</h2><button class="lp-btn lp-btn-primary" type="button" data-diag-run>다시 확인</button></div>
<ul class="lp-diag-list">${uniq.map((c) => `<li data-url="${esc(c.url)}"><span class="lp-diag-dot" aria-hidden="true"></span><span>${esc(c.name)}</span><small>${esc(host(c.url))}</small><b class="lp-diag-state">확인 전</b></li>`).join('')}</ul>
${ctx.live ? '<p class="lp-small" data-live-diag>실시간 연결 방식: 확인 중…</p>' : ''}
<p class="lp-small" data-env></p><button class="lp-btn lp-btn-ghost" type="button" data-diag-copy>${icon('copy')}<span>결과 복사</span></button></div>
<p><a class="lp-link" href="index.html">연수 사이트로 돌아가기 ${icon('arrow')}</a></p></main><div class="lp-toast" data-toast role="status" aria-live="polite"></div>`;
  return appShell(ctx, `접속 진단 · ${ctx.bp.meta.title}`, 'lp-body-check', inner, [ctx.live && 'assets/live.js', 'assets/lecpage.js'].filter(Boolean));
}
function bpTools(bp) {
  const t = bp.sections.find((s) => s.type === 'tools');
  return (t?.items || []).filter((x) => x.url).map((x) => ({ name: x.name, url: x.url }));
}

export function renderPrivacy(ctx) {
  const bp = ctx.bp, pv = bp.privacy;
  const items = { nickname: '별명', name: '이름', school: '소속(학교)', email: '이메일' };
  const procs = pv.processors.length ? pv.processors : defaultProcessors(bp);
  const inner = `<main class="lp-wrap lp-prose lp-privacy"><h1 class="lp-h2">개인정보 처리 안내</h1>
<p>${esc(bp.meta.organizer || bp.instructors[0]?.name || '연수 운영자')}는 「${esc(bp.meta.title)}」 연수를 운영하면서 아래와 같이 최소한의 정보만 처리합니다.</p>
<h2>1. 처리 목적</h2><p>연수 중 질문·도움 요청·결과물 공유${pv.collect.includes('name') ? ', 출석 및 이수 확인' : ''}.</p>
<h2>2. 처리 항목</h2><p>${pv.collect.map((c) => items[c]).filter(Boolean).join(', ')} / 참여 중 작성한 질문·글·파일, 실습 진행 상태.</p>
<h2>3. 보유 기간</h2><p>연수 종료 후 ${pv.retentionDays}일. 기간이 지나면 지체 없이 파기합니다.</p>
<h2>4. 거부할 권리</h2><p>동의하지 않아도 사이트의 안내·교재·실습 화면은 그대로 쓸 수 있습니다. 다만 출석 확인 등 이름이 필요한 기능은 쓸 수 없습니다.</p>
<h2>5. 처리 위탁 및 국외 이전</h2>${procs.length ? `<ul>${procs.map((p) => `<li>${esc(p.name)} (${esc(p.country)}) – ${esc(p.purpose)}</li>`).join('')}</ul>` : '<p>없음</p>'}
<h2>6. 문의</h2><p>${esc(pv.contact || bp.instructors.find((i) => i.email)?.email || '연수 운영자에게 문의해 주세요.')}</p>
<p class="lp-small">이 안내는 lecpage가 연수 설정에서 자동으로 만들었습니다. 기관의 개인정보 처리방침이 있으면 그것을 따릅니다.</p>
<p><a class="lp-link" href="index.html">연수 사이트로 돌아가기</a></p></main>`;
  return appShell(ctx, `개인정보 처리 안내 · ${bp.meta.title}`, 'lp-body-doc', inner, []);
}
function defaultProcessors(bp) {
  const map = {
    supabase: [{ name: 'Supabase Inc.', country: '미국(서버 지역은 강사가 선택)', purpose: '실시간 기능 데이터 저장' }],
    sheets: [{ name: 'Google LLC', country: '미국', purpose: '구글 시트·드라이브에 응답 저장' }],
    http: [{ name: '실시간 서버 운영자(Cloudflare Inc. 또는 자체 서버)', country: 'Cloudflare: 미국 / 자체 서버: 서버 위치', purpose: '실시간 기능 중계와 저장' }],
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
- 시그니처 효과: ${ctx.design.signature || '없음'} · 첫 화면 그래픽: ${ctx.design.graphic || '없음'} · 마무리 그래픽: ${ctx.design.closingGraphic || '없음'}
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
${(ctx.design._notes || []).length ? `\n## 결정 메모\n${ctx.design._notes.map((n) => `- ${n}`).join('\n')}\n` : ''}`;
}

export function opsDoc(ctx, infra) {
  const bp = ctx.bp;
  const live = ctx.live;
  return `# 운영 안내 — ${bp.meta.title}

${bp.meta.date ? `연수일: ${koDate(bp.meta.date)} ${bp.meta.start || ''}${bp.meta.end ? '~' + bp.meta.end : ''}\n` : ''}참여 코드: **${bp.live.code}**${live ? ` · 실시간 방식: ${bp.live.provider}` : ' · 실시간 기능 없음'}

## 파일
- \`index.html\` 참가자 화면 · \`console.html\` 강사 콘솔 · \`screen.html\` 프로젝터 화면 · \`check.html\` 접속 진단${live ? ' · `privacy.html` 개인정보 처리 안내' : ''}

## 연수 전
1. 사이트를 배포하고 주소를 단축 주소·QR로 만듭니다.
2. 연수 장소의 와이파이로 \`check.html\`을 열어 막힌 사이트가 없는지 확인합니다.
${live ? `3. 관리자 키로 \`console.html\`에 들어가 참가자 화면과 함께 리허설합니다(두 기기로 질문·막혔어요를 보내 보세요).\n4. ${bp.live.provider === 'supabase' ? 'Supabase 무료 프로젝트는 7일 동안 사용이 없으면 멈춥니다. 연수 하루 전 접속 진단으로 깨어 있는지 확인합니다.' : bp.live.provider === 'sheets' ? '구글 시트의 Apps Script 배포 주소가 바뀌지 않았는지 확인합니다.' : '서버가 켜져 있는지 확인합니다.'}\n` : ''}
## 연수 중
${live ? '- 콘솔에서 진행 현황(누가 어디까지 했는지)과 막힌 사람을 봅니다. 도움 요청은 "맡기" → "해결"로 처리합니다.\n- 타이머·공지를 보내면 참가자 화면 위에 나타납니다. "강사 따라가기"를 켜면 지금 단계·쪽으로 참가자 화면이 움직입니다.\n- 프로젝터에는 `screen.html`을 띄웁니다.\n' : '- 프로젝터에 첫 화면의 QR(공유 버튼)을 띄워 접속을 안내합니다.\n'}
## 연수 후
- 만족도 조사 응답을 확인합니다.
${live ? `- 콘솔에서 출석·진행·질문 기록을 CSV로 내려받습니다.\n- 보유 기간(${bp.privacy.retentionDays}일)이 지나면 콘솔의 "데이터 모두 지우기"를 누릅니다.\n- 계속 공개할 사이트라면 실시간 기능을 끄고 다시 만들어 정적 아카이브로 바꿉니다.\n` : '- 사이트는 그대로 두면 자료 아카이브로 쓸 수 있습니다.\n'}
${infra ? `## 운영 방식 결정 이유\n${infra.reasons.map((r) => `- ${r}`).join('\n')}\n${infra.warnings.length ? `\n주의\n${infra.warnings.map((w) => `- ${w}`).join('\n')}\n` : ''}` : ''}`;
}

export function sectionLabel(type) { return SECTION_DEFS[type]?.label || type; }
