// 페이지 조립: index(참가자). 보조 화면(console·screen·poster·check·privacy)은 aux.js, 같이 쓰는 머리·CSP는 shell.js
export { renderConsole, renderScreen, renderPoster, renderCheck, renderPrivacy, opsGuide } from './aux.js';
export { phaseWindow, LIB_SCRIPT_SOURCES, cspPolicy, eventJsonLd } from './shell.js';
import { esc, br, href, icon, koDate, host } from './html.js';
import { renderSection, contactHtml, boardFiles } from './sections.js';
import { heroHasBand } from './hero.js';
import { htmlAttrs } from '../design/tokens.js';
import { attrs, jsonScript, headTags, siteData, phaseWindow } from './shell.js';
import { renderConsole, renderScreen, renderPoster, renderCheck, renderPrivacy, opsGuide } from './aux.js';
import { deriveConcept } from '../decide/concept.js';
import { getPreset, presetPlan } from '../design/presets.js';
import { FONTS } from '../design/fonts.js';
import { SECTION_DEFS } from '../schema/sections.js';
import { fxInfo } from '../decide/design.js';
import { md } from './markdown.js';

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

/** 이해 정도 신호: 도크에는 단추 하나(지금 보낸 신호), 누르면 글이 붙은 세 가지가 펼쳐짐 */
const SIGNALS = [{ v: 'green', g: '✓', label: '이해했어요' }, { v: 'yellow', g: '?', label: '조금 헷갈려요' }, { v: 'red', g: '!', label: '모르겠어요' }];

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
<p class="lp-small">자리를 적으면 강사가 찾아가요. 적은 자리는 이 기기에 저장돼요.</p>
<label><span>자리</span><input name="seat" maxlength="20" autocomplete="off" placeholder="예: 3모둠, 창가 두 번째"></label>
<label><span>무엇이 막혔나요? (선택)</span><textarea name="message" rows="2" maxlength="300"></textarea></label>
<div class="lp-compose-f"><button class="lp-btn lp-btn-ghost" type="button" data-sheet-close>닫기</button><button class="lp-btn lp-btn-primary" type="submit">${icon('hand')}<span>요청하기</span></button></div></form></dialog>`;
}

/**
 * 도크의 '출석' 한 번 누르기: 질문·투표를 하지 않은 사람도 참가자 명단(별명)에 남게 함.
 * 끝난 연수에는 도크가 뜨지 않음. 별명만 받고 동의 흐름은 참여하기 창 그대로
 */
export function quickAttend(bp) {
  return bp.live.provider !== 'none' && bp.live.features.length > 0 && !bp.sections.some((s) => s.type === 'attendance') && !bp.live.features.includes('attendance');
}
/** 출석 칸(입실·퇴실)이 있는 연수: 연수 시간에 아직 입실하지 않았으면 도크의 [출석]이 입실을 바로 보냄(칸까지 내려가 찾지 않게) */
const dockAttend = (bp) => quickAttend(bp) || (bp.live.provider !== 'none' && bp.sections.some((s) => s.type === 'attendance'));

function dialogs(ctx) {
  const pv = ctx.bp.privacy;
  const needName = pv.collect.includes('name');
  const needSchool = pv.collect.includes('school');
  return `<dialog class="lp-dialog" data-share-dialog aria-labelledby="lp-share-h"><form method="dialog" class="lp-dialog-in">
<h2 id="lp-share-h">사이트 공유</h2><div class="lp-qr lp-qr-lg" data-qr-self role="img" aria-label="이 페이지 QR 코드"></div>
<p class="lp-share-url" data-share-url></p><p class="lp-share-full" data-url-full hidden></p><p class="lp-small lp-share-off" data-url-off hidden>배포하면 여기에 참가자 주소와 QR이 나와요.</p>${ctx.live ? `<p class="lp-share-code">연수 코드 <b>${esc(ctx.bp.live.code)}</b></p>` : ''}
<p class="lp-small lp-share-scr">프로젝터에는 <a href="screen.html">발표 화면</a>을 띄워요. QR${ctx.live ? '과 질문·투표 결과가' : '이'} 크게 보여요.</p>
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
  ${dockAttend(ctx.bp) ? `<button class="lp-btn lp-btn-dock" type="button" data-dock-attend${quickAttend(ctx.bp) ? '' : '="in"'} hidden>${icon('check')}<span>출석</span></button>` : ''}
  ${ctx.bp.live.features.includes('help') ? `<button class="lp-btn lp-btn-dock" type="button" data-dock-help>${icon('hand')}<span>도움 요청</span></button>` : ''}
  ${ctx.bp.live.features.includes('qa') ? `<button class="lp-btn lp-btn-dock lp-btn-dock-2" type="button" data-dock-qa>${icon('chat')}<span>질문</span></button>` : ''}
  ${ctx.bp.live.features.includes('signal') ? `<div class="lp-fold lp-signal"><button type="button" class="lp-fold-btn" data-fold-toggle aria-expanded="false" aria-label="지금 이해 정도 보내기" title="이해 정도"><i data-signal-now aria-hidden="true"></i></button><div class="lp-fold-list" role="group" aria-label="지금 이해 정도">${SIGNALS.map((x) => `<button type="button" data-signal="${x.v}" aria-pressed="false"><i aria-hidden="true">${x.g}</i><span>${x.label}</span></button>`).join('')}</div></div>` : ''}
  ${ctx.bp.live.features.includes('reactions') ? `<div class="lp-fold lp-react"><button type="button" class="lp-fold-btn" data-fold-toggle aria-expanded="false" aria-label="반응 보내기" title="반응">${REACTIONS[0].ic}</button><div class="lp-fold-list" role="group" aria-label="반응 보내기">${REACTIONS.map((r) => `<button type="button" data-react="${r.v}" aria-label="${r.label}" title="${r.label}">${r.ic}</button>`).join('')}</div></div>` : ''}
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

// ── 문서 ─────────────────────────────────────────────────
/** DESIGN.md의 컨셉 단락: 한 줄 컨셉(참가자가 겪는 경험)·모티프·근거. 설계도에 없으면 주제에서 규칙으로 세운 것을 적음 */
function conceptBlock(ctx, p) {
  const bp = ctx.bp;
  const c = bp.concept || deriveConcept({ title: bp.meta.title, subtitle: bp.meta.subtitle, topics: bp.design?.topics || [], archetype: bp.archetype?.primary, admin: bp.meta.admin?.kind });
  const by = { ai: 'AI가 교재를 읽고 세움', teacher: '강사가 정함', auto: '주제에서 자동으로 세움' }[c.source] || '';
  const plan = presetPlan(p);
  const KO = { rise: '떠오름', fade: '번짐', side: '옆에서', wipe: '왼쪽부터 펼침', clip: '위에서 펼침', scale: '살짝 커짐', drop: '내려앉음', flip: '넘어옴' };
  const enter = Object.entries(plan.enter).map(([k, v]) => `${k === 'default' ? '기본' : SECTION_DEFS[k]?.label || k} ${KO[v] || v}`).join(' · ');
  return `## 컨셉
- 한 줄 컨셉: **${c.idea}**${by ? ` (${by})` : ''}
- 모티프: ${c.motif || '없음'}${c.keywords?.length ? ` · 핵심 낱말: ${c.keywords.join(', ')}` : ''}
${c.why ? `- 근거: ${c.why}\n` : ''}${c.preset && c.preset !== p.id ? `- 컨셉이 권한 디자인은 ${getPreset(c.preset).name_ko}(\`${c.preset}\`)이고, 지금은 ${p.name_ko}을(를) 쓰고 있습니다.\n` : ''}- 화면의 모든 선택(색·글꼴·그림·움직임·섹션)은 이 컨셉에 맞는지로 판단합니다. 컨셉과 어긋나는 꾸밈은 넣지 않습니다.

## 페이지 연출 계획(첫 화면 밖)
- 섹션이 들어올 때: ${enter}
- 글은 들어온 뒤 멈추고, 한 화면에 큰 움직임은 하나만. 0단계 정적 · 1단계 등장과 가리킴 반응 · 2단계 스크롤 연동 · 3단계 장면 연출.

`;
}

export function designDoc(ctx) {
  const p = getPreset(ctx.design.preset);
  const fxName = (id) => { const f = id && fxInfo(id); return f?.name_ko ? `${f.name_ko}(\`${id}\`)` : id || '없음'; };
  const fx = Object.entries(ctx.design.effects || {}).map(([k, v]) => `| ${k} | ${fxName(v)} |`).join('\n');
  const fk = { ...p.fonts, ...(ctx.design.fonts || {}) }; // 실제로 쓰인 글꼴(교재 글꼴·직접 고른 글꼴이 프리셋보다 먼저)
  const fl = (k) => (k ? `${FONTS[k]?.label || k}(\`${k}\`)` : '프리셋 기본');
  return `# DESIGN.md — ${ctx.bp.meta.title}

이 파일은 이 연수 사이트의 디자인 규칙입니다. 어떤 AI나 사람이 고치더라도 이 규칙을 지키면 일관성이 유지됩니다.

${conceptBlock(ctx, p)}- 프리셋: **${p.name_ko}** (\`${p.id}\`) — ${p.desc_ko}
- 테마: ${ctx.design.theme && ctx.design.theme !== 'preset' ? ctx.design.theme : p.theme} · 페이지 연출: ${ctx.design.motion}단계 (0 정적 · 1 차분 · 2 보통 · 3 스크롤 연출)
- 대표 효과: ${fxName(ctx.design.signature)} · 첫 화면 그래픽: ${fxName(ctx.design.graphic)} · 마무리 그래픽: ${fxName(ctx.design.closingGraphic)}
- 글꼴: 제목 ${fl(fk.display)}, 본문 ${fl(fk.body)}, 숫자·영문 ${fl(fk.num)}, 고정폭 ${fl(fk.mono)}
- 토큰: 색·글꼴·모양 값은 함께 받은 \`tokens.json\`(DTCG 형식)에 있습니다. 다른 도구로 옮길 때 그 파일을 씁니다.
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
- 눈에 띄는 효과는 첫 화면·섹션 시작·마무리에만, 대표 효과는 하나만. 같은 배치의 섹션을 세 번 넘게 잇지 않습니다.
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
 * 강사 안내(연수 전·중·후). 운영안내.md와 강사 화면의 '도움말'이 같은 글을 씁니다.
 * 강사 화면(console.html)은 누구나 열 수 있는 파일이라, 강사 메모처럼 강사만 볼 내용은 넣지 않습니다(운영안내.md에만).
 */
/**
 * 운영안내.md(강사용 폴더, 올리지 않음). 운영 방식은 실제로 연결한 live.provider를 따릅니다.
 * infra(decideInfra 결과)는 추천이 연결한 방식과 같으면 주의만, 다르면 추천한 방식을 한 줄로 덧붙입니다.
 */
export function opsDoc(ctx, infra) {
  const bp = ctx.bp;
  const live = ctx.live;
  const prov = live ? bp.live.provider : 'none';
  const name = PROVIDER_KO[prov] || prov;
  const same = !!infra && infra.liveProvider === prov;
  const rec = infra && !same ? infra.backendInfo?.name_ko : '';
  const files = ['`index.html` 참가자 화면', live && '`console.html` 강사 화면(도움말에 이 안내가 함께 있어요)', '`screen.html` 발표 화면', '`check.html` 접속 확인', '`poster.html` QR 안내문 인쇄', live && '`privacy.html` 개인정보 처리 안내'].filter(Boolean);
  // 발표자 노트의 진행 메모(참가자 화면·강사 화면에는 싣지 않음): 실습별로 강사만 보는 이 문서에
  const memos = (bp.sections.find((s) => s.type === 'stations')?.items || []).filter((x) => x.teacherNote)
    .map((x) => `- **${x.title}**${x.source?.pages?.length ? ` (${x.source.pages.join('·')}쪽)` : ''}\n${x.teacherNote.split('\n').map((t) => `  - ${t}`).join('\n')}`);
  const memoDoc = memos.length ? `\n## 실습별 강사 메모(발표자 노트)\n참가자 화면과 강사 화면에는 보이지 않아요.\n${memos.join('\n')}\n` : '';
  return `# 운영 안내 — ${bp.meta.title}

${bp.meta.date ? `연수일: ${koDate(bp.meta.date)} ${bp.meta.start || ''}${bp.meta.end ? '~' + bp.meta.end : ''}\n` : ''}연수 코드: **${bp.live.code}** · 실시간 방식: ${live ? name : '없음'}

## 파일
- ${files.join(' · ')}

${opsGuide(ctx)}${memoDoc}
## 운영 방식: ${name}
- ${PROVIDER_WHY[prov] || ''}
${rec ? `- 연수 정보(인원·기능)로 추천한 방식: ${rec}\n` : ''}${same && infra.warnings.length ? `\n주의\n${infra.warnings.map((w) => `- ${w}`).join('\n')}\n` : ''}`;
}

export function sectionLabel(type) { return SECTION_DEFS[type]?.label || type; }
