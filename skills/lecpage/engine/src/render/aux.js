// 보조 화면: 강사 화면(console) · 발표 화면(screen) · QR 안내문(poster) · 접속 확인(check) · 개인정보 처리 안내(privacy).
// 모두 참가자 화면과 같은 프리셋(색·글꼴·단추·상자 모양·모티프)을 이어받고, 쪽마다 쓰임에 맞춘 배치를 assets/aux.css가 맡습니다.
// 참가자가 쓴 글은 여기서 그리지 않습니다(런타임이 textContent로만 넣음).
import { esc, br, icon, koDate, host, md } from './html.js';
import { contactHtml, boardFiles } from './sections.js';
import { appShell } from './shell.js';
import { motifFamily } from '../design/layouts.js';
import { motifRule } from './body-graphic.js';

const PROVIDER_KO = { local: '리허설(이 브라우저 안에서만)', http: '참여 기능 서버', supabase: 'Supabase', sheets: '구글 시트' };
const themeBtn = () => `<button class="lp-icon-btn" type="button" data-theme-toggle aria-label="밝게·어둡게 바꾸기">${icon('sun')}</button>`;

/** 보조 화면 머리의 왼쪽(강사 화면과 같은 꼴): 무슨 화면인지(작게) + 연수 제목 */
const auxId = (ctx, label) => `<p class="lp-ax-id"><span class="lp-brand-dot" aria-hidden="true"></span><span><small>${esc(label)}</small><b>${esc(ctx.bp.meta.title)}</b></span></p>`;
const backBtn = () => `<a class="lp-btn lp-btn-ghost lp-btn-sm" href="index.html">참가자 화면으로</a>`;
/** 확인·안내 쪽(접속 확인·개인정보) 머리: 무슨 화면인지 + [참가자 화면으로] + 밝게·어둡게 */
function auxBar(ctx, label) {
  return `<header class="lp-ax-bar"><div class="lp-ax-in">
${auxId(ctx, label)}
<div class="lp-ax-act">${backBtn()}${themeBtn()}</div>
</div></header>`;
}
const motif = (ctx, seed) => motifRule(motifFamily(ctx.bp, ctx.design.preset), seed);

// ── 강사 화면 ─────────────────────────────────────────────
/**
 * 강사 화면 = 강사의 출발점. 들어가기 전에는 '강사용 화면이에요 → [참가자 화면으로]'와 열쇠 칸만 보이고,
 * 들어간 뒤에 위 띠에 [발표 화면 띄우기]와 [더보기](참가자 화면·QR 안내문·접속 확인·휴대폰에서 열기·도움말)가 나옴.
 */
export function renderConsole(ctx) {
  const bp = ctx.bp, m = bp.meta, prov = bp.live.provider;
  const item = (href, name, sub, ic) => `<li><a href="${href}" target="_blank" rel="noopener">${icon(ic)}<span><b>${name}</b><small>${sub}</small></span></a></li>`;
  const act = (attr, name, sub, ic, hidden) => `<li${hidden ? ' hidden' : ''}><button type="button" ${attr}>${icon(ic)}<span><b>${name}</b><small>${sub}</small></span></button></li>`;
  const inner = `<a class="lp-skip" href="#lp-con-main">본문 바로 가기</a>
<div class="lp-con" data-console data-provider="${esc(prov)}">
<header class="lp-con-bar"><div class="lp-con-bar-in">
<div class="lp-con-id"><span class="lp-brand-dot" aria-hidden="true"></span><h1><small>강사 화면</small><span>${esc(m.title)}</span></h1></div>
<p class="lp-con-conn" data-conn data-state="idle" role="status" hidden><i aria-hidden="true"></i><span data-conn-text>연결하는 중…</span></p>
<nav class="lp-con-go" aria-label="다른 화면" data-after-login hidden>
<button class="lp-btn lp-btn-primary lp-btn-sm" type="button" data-screen-open>${icon('monitor')}<span>발표 화면 띄우기</span></button>
<div class="lp-con-more" data-more>
<button class="lp-btn lp-btn-ghost lp-btn-sm" type="button" data-more-btn aria-expanded="false" aria-controls="lp-con-menu">${icon('menu')}<span>더보기</span></button>
<ul class="lp-con-menu" id="lp-con-menu" data-more-menu hidden>
${act('data-screen-window', '발표 화면 새 창', '이 노트북에서 창으로 열어요', 'expand', true)}
${item('index.html', '참가자 화면', '참가자가 보는 사이트', 'external')}
${item('poster.html', 'QR 안내문', 'A4로 인쇄해 붙여요', 'print')}
${item('check.html', '접속 확인', '전날, 연수 장소 Wi-Fi로', 'wifi')}
${ctx.live ? act('data-phone-open', '휴대폰에서 열기', '교실을 돌며 이 화면을 써요', 'phone') : ''}
${act('data-help-open', '도움말', '연수 전·중·후에 할 일', 'chat')}
</ul>
</div>
</nav>
<div class="lp-con-me">${themeBtn()}<button class="lp-btn lp-btn-ghost lp-btn-sm" type="button" data-logout hidden>${icon('logout')}<span>나가기</span></button></div>
</div></header>
<section class="lp-con-login" data-admin-box aria-labelledby="lp-login-h">
<form class="lp-card lp-con-login-card" data-admin-form novalidate>
<p class="lp-con-for"><span>강사용 화면이에요. 참가자라면</span><a class="lp-btn lp-btn-ghost lp-btn-sm" href="index.html">참가자 화면으로${icon('arrow')}</a></p>
<div class="lp-con-login-mark" aria-hidden="true">${motif(ctx, 'login')}</div>
<h2 id="lp-login-h">관리자 키</h2>
<p class="lp-con-login-lead">배포할 때 받은 관리자 키를 넣으면 질문·투표·타이머를 다룰 수 있어요.</p>
<label class="lp-con-field" for="lp-key">관리자 키</label>
<div class="lp-con-keyrow"><input id="lp-key" type="password" name="key" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="200" required aria-describedby="lp-key-msg lp-key-hint"><button class="lp-icon-btn" type="button" data-key-show aria-pressed="false" aria-label="키 보이기">${icon('eye')}</button></div>
<label class="lp-con-check"><input type="checkbox" name="remember" data-remember><span>이 기기에서 기억하기</span></label>
<p class="lp-con-hint" id="lp-key-hint" data-remember-hint>끄면 이 탭을 닫을 때 잊어요. 공용 컴퓨터에서는 켜지 마세요.</p>
<p class="lp-con-msg" id="lp-key-msg" data-key-msg role="alert"></p>
<button class="lp-btn lp-btn-primary lp-btn-lg" type="submit" data-key-go>들어가기</button>
${prov === 'local' ? '<p class="lp-con-hint">리허설 설정이에요. 아무 키나 넣어도 되고, 기록은 이 브라우저에만 남아요.</p>' : ''}
</form>
</section>
<main id="lp-con-main" class="lp-con-main" data-console-main hidden tabindex="-1" aria-label="연수 진행"></main>
<details class="lp-con-help" id="lp-con-help" data-console-help data-after-login hidden><summary>도움말 · 연수 전·중·후에 할 일</summary><div class="lp-prose">${md(opsGuide(ctx))}</div></details>
${ctx.live ? `<dialog class="lp-dialog lp-con-dlg lp-con-phone" data-phone-dialog aria-labelledby="lp-phone-h"><form method="dialog" class="lp-dialog-in">
<h2 id="lp-phone-h">휴대폰에서 열기</h2>
<p data-phone-lead>휴대폰 카메라로 QR을 찍으면 관리자 키를 넣지 않아도 강사 화면이 열려요. 교실을 돌며 질문·투표·타이머를 다뤄요.</p>
<div class="lp-con-phone-box" data-phone-box>
<div class="lp-qr" data-phone-qr role="img" aria-label="휴대폰용 강사 화면 QR 코드" hidden></div>
<div class="lp-con-phone-cover" data-phone-cover>${icon('lock')}<p>관리자 키가 든 QR이에요. 프로젝터나 화면 공유에 이 창이 비치지 않을 때 보이세요.</p><button type="button" class="lp-btn lp-btn-primary lp-btn-sm" data-phone-show>${icon('eye')}<span>QR 보이기</span></button></div>
</div>
<p class="lp-con-sub" data-phone-left></p>
<div class="lp-compose-f"><button class="lp-btn lp-btn-ghost" value="close">닫기</button></div>
</form></dialog>` : ''}
<dialog class="lp-dialog lp-con-dlg" data-purge-dialog aria-labelledby="lp-purge-h"><form method="dialog" class="lp-dialog-in">
<h2 id="lp-purge-h">모든 기록을 지울까요?</h2>
<p>참가자 명단·출석·질문·투표 응답·보드 글과 올린 파일·도움 요청·설문 응답이 서버에서 지워져요. 지운 뒤에는 되돌릴 수 없어요.</p>
<p class="lp-small">사이트와 관리자 키는 그대로예요. 필요한 기록은 먼저 CSV로 내려받으세요.${prov === 'sheets' ? ' 구글 시트는 지운 행도 버전 기록에 남아요. 다 쓰면 시트 파일째 지우고 드라이브 휴지통을 비워 주세요.' : ''}</p>
<div class="lp-compose-f"><button class="lp-btn lp-btn-ghost" value="cancel">닫기</button><button class="lp-btn lp-btn-danger" type="button" data-purge-go>${icon('close')}<span>모두 지우기</span></button></div>
</form></dialog>
<noscript><p class="lp-con-noscript">강사 화면은 자바스크립트를 켜야 쓸 수 있어요.</p></noscript>
<div class="lp-toast" data-toast role="status" aria-live="polite"></div>
</div>`;
  return appShell(ctx, { title: `강사 화면 · ${m.title}`, page: 'console', bodyClass: 'lp-body-con', inner, scripts: ['assets/qr.js', 'assets/live.js', 'assets/console.js'], blueprint: true });
}

// ── 발표 화면 ─────────────────────────────────────────────
/** 질문·투표가 없을 때의 무대(로비): 큰 연수 제목 + 세 단계. screen.js의 lobbyStage()와 같은 꼴(그려 둔 채로 열려 화면이 밀리지 않게) */
const SCREEN_STEPS = ['QR을 찍어 들어와요', '[질문]에 올려요', '마음에 드는 질문에 공감을 눌러요'];
function lobbyHtml(title, live) {
  const steps = SCREEN_STEPS.map((t, i) => `<li><b>${i + 1}</b><span>${esc(t)}</span></li>`).join('');
  return `<div class="lp-scr-empty"><p class="lp-scr-lobby-t" aria-hidden="true">${esc(title)}</p>${live ? `<ol class="lp-scr-steps">${steps}</ol>` : '<p class="lp-scr-empty-s">이름 뽑기·모둠·타이머는 오른쪽 위 [도구]에 있어요.</p>'}</div>`;
}
export function renderScreen(ctx) {
  const bp = ctx.bp, m = bp.meta, live = ctx.live;
  const signal = live && bp.live.features.includes('signal');
  const code = live ? `<p class="lp-scr-code">연수 코드 <b>${esc(bp.live.code)}</b></p>` : '';
  const inner = `<aside class="lp-scr-for" aria-label="참가자 안내"><span>프로젝터에 띄우는 발표 화면이에요.</span><a class="lp-btn lp-btn-ghost lp-btn-sm" href="index.html">참가자 화면으로${icon('arrow')}</a></aside>
<div class="lp-scr" data-screen data-lobby${live ? '' : ' data-offline'}>
<header class="lp-scr-top">
<h1 class="lp-scr-title"><span class="lp-brand-dot" aria-hidden="true"></span><span>${esc(m.title)}</span></h1>
${live ? '<p class="lp-scr-conn" data-conn data-state="idle"><i aria-hidden="true"></i><span data-conn-text>연결하는 중…</span></p>' : ''}
<div class="lp-scr-act">
<button class="lp-btn lp-btn-ghost lp-btn-sm" type="button" data-join-open>${icon('qr')}<span>QR 크게</span></button>
<button class="lp-btn lp-btn-ghost lp-btn-sm" type="button" data-fullscreen aria-pressed="false">${icon('expand')}<span>전체 화면</span></button>
<button class="lp-btn lp-btn-ghost lp-btn-sm lp-tools-btn" type="button" data-tools-open aria-expanded="false" aria-controls="lp-tools">${icon('tools')}<span>도구</span></button>
${themeBtn()}
</div>
</header>
<p class="lp-scr-notice" data-notice hidden role="status"></p>
<main class="lp-scr-stage" aria-label="발표 화면">
<section class="lp-stage" data-tool-stage hidden aria-live="polite" aria-labelledby="lp-stage-h"><div class="lp-stage-h"><h2 id="lp-stage-h" data-stage-title>도구</h2><button class="lp-btn lp-btn-ghost lp-btn-sm" type="button" data-stage-close>${icon('close')}<span>닫기</span></button></div><div data-stage-body></div></section>
<div class="lp-scr-main" data-screen-main aria-live="polite">${lobbyHtml(m.title, live)}</div>
</main>
<aside class="lp-scr-side" aria-label="참여 안내">
<div class="lp-scr-join">
<p class="lp-scr-join-h">휴대폰으로 참여</p>
<button class="lp-qr-zoom" type="button" data-join-zoom aria-haspopup="dialog" aria-label="참여 QR 코드 크게 보기"><span class="lp-qr" data-qr-join></span><span class="lp-qr-zoom-t">${icon('expand')}크게 보기</span></button>
<p class="lp-scr-url" data-join-url></p>
<p class="lp-scr-full" data-join-full hidden></p>
${code}
</div>
<div class="lp-scr-timer" data-timer hidden role="timer"><span class="lp-scr-timer-h">남은 시간</span><b data-timer-v></b></div>
<div class="lp-timers" data-timers hidden role="region" aria-label="타이머"></div>
${signal ? '<div class="lp-scr-signal" data-screen-signal hidden role="region" aria-label="이해 신호"></div>' : ''}
</aside>
<aside class="lp-drawer" id="lp-tools" data-tools hidden aria-labelledby="lp-tools-h"><div class="lp-drawer-h"><h2 id="lp-tools-h" tabindex="-1">도구</h2><button class="lp-icon-btn" type="button" data-tools-close aria-label="도구 닫기">${icon('close')}</button></div><div data-tools-body></div>
<p class="lp-drawer-links"><a class="lp-link" href="poster.html" target="_blank" rel="noopener">${icon('print')}QR 안내문 인쇄</a>${live ? `<a class="lp-link" href="console.html" target="_blank" rel="noopener">${icon('external')}강사 화면 열기</a>` : ''}</p></aside>
<div class="lp-reactions" data-reactions aria-hidden="true"></div></div>
<dialog class="lp-joinbig" data-joinbig aria-labelledby="lp-joinbig-h"><form method="dialog" class="lp-joinbig-in">
<div class="lp-qr" data-qr-big role="img" aria-label="참여 QR 코드"></div>
<div class="lp-joinbig-t"><h2 id="lp-joinbig-h">휴대폰 카메라로 QR을 찍어 주세요</h2><p class="lp-joinbig-url" data-join-url></p><p class="lp-joinbig-full" data-join-full hidden></p>${code}</div>
<button class="lp-btn lp-btn-ghost lp-joinbig-x" value="close">${icon('close')}<span>닫기</span></button></form></dialog>
<dialog class="lp-dialog lp-scr-go" data-fs-dialog aria-labelledby="lp-fs-h"><form method="dialog" class="lp-dialog-in">
<h2 id="lp-fs-h">프로젝터에 띄워요</h2>
<p>이 창을 프로젝터 화면으로 끌어다 놓고 [전체 화면]을 누르세요. 노트북 화면이 프로젝터에 그대로 비치면 바로 누르면 돼요.</p>
<div class="lp-compose-f"><button class="lp-btn lp-btn-ghost" value="close">창으로 보기</button><button class="lp-btn lp-btn-primary" type="button" data-fs-go autofocus>${icon('expand')}<span>전체 화면</span></button></div>
</form></dialog>
<div class="lp-toast" data-toast role="status" aria-live="polite"></div>`;
  return appShell(ctx, { title: `발표 화면 · ${m.title}`, page: 'screen', bodyClass: 'lp-body-scr', inner, scripts: ['assets/qr.js', live && 'assets/live.js', 'assets/screen.js'].filter(Boolean), blueprint: true });
}

// ── QR 안내문(인쇄) ────────────────────────────────────────
/**
 * A4 안내문 한 장 + 잘라 쓰는 자리 카드 8장(선택). 참가자 주소·QR은 lecpage.js가 그립니다.
 * 참가자 손에 가는 종이라 강사 화면 주소·QR은 싣지 않음(휴대폰으로 강사 화면을 여는 QR은 강사 화면 안에만)
 */
export function renderPoster(ctx) {
  const bp = ctx.bp, m = bp.meta;
  const when = m.date ? `${koDate(m.date)}${m.start ? ` ${m.start}${m.end ? `~${m.end}` : ''}` : ''}` : '';
  const code = ctx.live ? bp.live.code : '';
  const tlen = [...String(m.title || '')].length;
  const meta = when || m.venue ? `<dl class="lp-pst-meta">${when ? `<div><dt>일시</dt><dd>${esc(when)}</dd></div>` : ''}${m.venue ? `<div><dt>장소</dt><dd>${esc(m.venue)}</dd></div>` : ''}</dl>` : '';
  const mini = (i) => `<div class="lp-pst-mini"><p class="lp-pst-mini-t">${esc(m.title)}</p><div class="lp-pst-mini-qr lp-qr" data-qr-self role="img" aria-label="연수 사이트 QR 코드 ${i + 1}"></div><p class="lp-pst-mini-u" data-url-self></p>${code ? `<p class="lp-pst-mini-c">연수 코드 ${esc(code)}</p>` : ''}</div>`;
  const inner = `<header class="lp-pst-bar"><div class="lp-pst-bar-in">
${auxId(ctx, 'QR 안내문')}
<p class="lp-pst-bar-t">A4 한 장이에요. 흑백으로 인쇄해도 QR이 잘 찍혀요.</p>
<fieldset class="lp-pst-opts"><legend class="lp-sr">함께 인쇄할 것</legend>
<label class="lp-con-check"><input type="checkbox" data-part-print="cards"><span>자리 카드 8장(잘라 쓰기)</span></label>
</fieldset>
<button class="lp-btn lp-btn-primary" type="button" data-print>${icon('print')}<span>인쇄하기</span></button>
${backBtn()}
</div></header>
<main class="lp-pst" data-poster>
<div class="lp-pst-page"><section class="lp-pst-sheet lp-pst-a4" data-len="${tlen <= 12 ? 's' : tlen <= 26 ? 'm' : 'l'}" aria-labelledby="lp-poster-h">
<div class="lp-pst-head">
${m.organizer ? `<p class="lp-pst-org">${esc(m.organizer)}</p>` : ''}<h1 id="lp-poster-h">${br(m.title)}</h1>${m.subtitle ? `<p class="lp-pst-sub">${br(m.subtitle)}</p>` : ''}
<div class="lp-pst-rule" aria-hidden="true">${motif(ctx, 'poster')}</div>
</div>
${meta}
<div class="lp-pst-qr lp-qr" data-qr-self role="img" aria-label="연수 사이트 QR 코드"></div>
<p class="lp-pst-cta">휴대폰 카메라로 QR을 찍어 들어오세요</p>
<div class="lp-pst-type">
<p class="lp-pst-type-h">카메라가 안 되면 주소를 쳐 주세요</p>
<p class="lp-pst-url" data-url-self></p>
<p class="lp-pst-full" data-url-full hidden></p>
${code ? `<p class="lp-pst-code">연수 코드 <b>${esc(code)}</b></p>` : ''}
</div>
<div class="lp-pst-wifi">${icon('wifi')}<b>Wi-Fi</b><span>이름</span><i></i><span>암호</span><i></i></div>
</section></div>
<div class="lp-pst-page" data-part="cards"><section class="lp-pst-sheet lp-pst-cards" aria-label="자리 카드(잘라 쓰기)">
<p class="lp-pst-cut">${icon('scissors')}<span>점선을 따라 잘라 자리마다 놓아 주세요.</span></p>
<div class="lp-pst-grid">${Array.from({ length: 8 }, (_, i) => mini(i)).join('')}</div>
</section></div>
</main><div class="lp-toast" data-toast role="status" aria-live="polite"></div>`;
  return appShell(ctx, { title: `QR 안내문 · ${m.title}`, page: 'poster', bodyClass: 'lp-body-pst lp-cards-off', inner, scripts: ['assets/qr.js', 'assets/lecpage.js'] });
}

// ── 접속 확인 ─────────────────────────────────────────────
function bpTools(bp) {
  const t = bp.sections.find((s) => s.type === 'tools');
  return (t?.items || []).filter((x) => x.url).map((x) => ({ name: x.name, url: x.url }));
}
/**
 * 확인할 곳: { name, url, kind, need: 'must'|'nice', impact(막히면 생기는 일), fix(할 일) }.
 * 같은 호스트는 한 번만
 */
export function checkItems(ctx) {
  const bp = ctx.bp, out = [], seen = new Set();
  const add = (x) => { const h = host(x.url) || x.url; if (!h || seen.has(h)) return; seen.add(h); out.push(x); };
  // 참여 기능 서버는 주소를 찌르지 않고 check.js가 실제로 연결해 봄(실시간·새로 읽기 중 어느 방식인지까지)
  if (ctx.live && bp.live.provider === 'supabase') add({ name: 'Supabase 연결 도구', url: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/package.json', kind: 'lib', need: 'must', impact: '참여 기능이 연결되지 않아요.', fix: '기관 정보 담당자에게 cdn.jsdelivr.net을 열어 달라고 요청하세요.' });
  for (const t of [...(bp.sections.find((s) => s.type === 'readiness')?.checks || []), ...bpTools(bp).slice(0, 12)]) add({ name: t.name, url: t.url, kind: 'tool', need: 'must', impact: `실습에서 쓰는 ${t.name}이 열리지 않아요.`, fix: '연수 전에 열어 달라고 요청하거나 대신 쓸 도구를 준비하세요.' });
  const fontHosts = [...new Set(ctx.fontLinks.map((u) => host(u)).filter(Boolean))];
  for (const h of fontHosts) add({ name: h === 'fonts.googleapis.com' ? '구글 글꼴' : h === 'hangeul.pstatic.net' ? '네이버 글꼴' : '글꼴·효과 파일', url: h === 'fonts.googleapis.com' ? 'https://fonts.googleapis.com/css2?family=Jua' : h === 'cdn.jsdelivr.net' ? 'https://cdn.jsdelivr.net/npm/lenis@1.3.27/package.json' : `https://${h}/`, kind: 'font', need: 'nice', impact: '글꼴이 기본 글꼴로 보여요. 내용은 그대로예요.', fix: '괜찮으면 그대로 써도 돼요. 꼭 같은 글꼴이 필요하면 글꼴을 함께 담아 다시 만드세요.' });
  // 연수 정보에 적어 둔 '학교에서 막힌 곳'(audience.blocked): 주소면 함께 확인
  const asUrl = (b) => { const r = /^(?:https?:\/\/)?((?:[\w-]+\.)+[a-z]{2,})(\/\S*)?$/i.exec(String(b).trim()); return r ? `https://${r[1]}${r[2] || '/'}` : ''; };
  for (const b of bp.audience?.blocked || []) { const u = asUrl(b); if (u) add({ name: host(u), url: u, kind: 'blocked', need: 'must', impact: '연수 정보에 막힌 곳으로 적어 둔 사이트예요.', fix: '여기서도 막히면 다른 도구를 준비하거나 열어 달라고 요청하세요.' }); }
  return out;
}

export function renderCheck(ctx) {
  const bp = ctx.bp, items = checkItems(ctx);
  const blocked = (bp.audience?.blocked || []).filter((b) => !/^(?:https?:\/\/)?(?:[\w-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(String(b).trim()));
  const liveInfo = ctx.live ? { provider: bp.live.provider, name: PROVIDER_KO[bp.live.provider] || bp.live.provider } : null;
  const inner = `${auxBar(ctx, '접속 확인')}
<main class="lp-chk" data-check-page data-items='${esc(JSON.stringify(items))}'${liveInfo ? ` data-live-check='${esc(JSON.stringify(liveInfo))}'` : ''}>
<header class="lp-chk-head">
<h1>접속 확인</h1>
<p class="lp-chk-lead">이 기기와 지금 연결한 네트워크에서 연수에 쓰는 곳이 열리는지 봐요. 연수 전날, 연수 장소의 Wi-Fi로 열어 보세요.</p>
</header>
<section class="lp-chk-verdict" data-verdict data-state="wait" aria-labelledby="lp-verdict-h">
<div class="lp-chk-mark" aria-hidden="true"><span data-m="wait">${icon('refresh')}</span><span data-m="ok">${icon('check')}</span><span data-m="warn">${icon('alert')}</span><span data-m="fail">${icon('close')}</span></div>
<div class="lp-chk-say"><h2 id="lp-verdict-h" data-verdict-big aria-live="polite">확인하는 중…</h2><p data-verdict-sub>${items.length + (ctx.live ? 1 : 0) + 1}곳을 차례로 열어 봐요.</p></div>
<div class="lp-chk-do"><button class="lp-btn lp-btn-primary" type="button" data-diag-run>${icon('refresh')}<span>다시 확인</span></button><button class="lp-btn lp-btn-ghost" type="button" data-diag-copy>${icon('copy')}<span>결과 복사</span></button></div>
</section>
<div class="lp-chk-cols">
<section class="lp-chk-col" data-col="ok" aria-labelledby="lp-chk-ok"><h2 id="lp-chk-ok">되는 것 <span data-n="ok">0</span></h2><ul data-list="ok"><li class="lp-chk-none">확인하는 중…</li></ul></section>
<section class="lp-chk-col" data-col="fail" aria-labelledby="lp-chk-fail"><h2 id="lp-chk-fail">안 되는 것 <span data-n="fail">0</span></h2><ul data-list="fail"><li class="lp-chk-none">아직 없어요.</li></ul></section>
<section class="lp-chk-col" data-col="todo" aria-labelledby="lp-chk-todo"><h2 id="lp-chk-todo">할 일</h2><ol data-list="todo"><li class="lp-chk-none">확인이 끝나면 여기에 적어요.</li></ol></section>
</div>
${blocked.length ? `<p class="lp-chk-note"><b>연수 정보에 적어 둔 막힌 곳:</b> ${blocked.map((b) => esc(b)).join(' · ')}. 주소가 아니라 직접 확인할 수 없어요. 연수 전에 기관 정보 담당자에게 물어보세요.</p>` : ''}
<details class="lp-chk-more"><summary>이 기기 정보</summary><p data-env></p></details>
<p class="lp-chk-back"><a class="lp-link" href="index.html">연수 사이트로 돌아가기 ${icon('arrow')}</a></p>
</main>
<div class="lp-toast" data-toast role="status" aria-live="polite"></div>`;
  return appShell(ctx, { title: `접속 확인 · ${bp.meta.title}`, page: 'check', bodyClass: 'lp-body-doc', inner, scripts: [ctx.live && 'assets/live.js', 'assets/check.js'].filter(Boolean) });
}

// ── 개인정보 처리 안내 ─────────────────────────────────────
/** 이 사이트가 실제로 모으는 참여 기록(켜진 칸·기능만) */
export function activityItems(bp) {
  const has = (t) => bp.sections.some((s) => s.type === t);
  const on = (k) => bp.live.features.includes(k);
  const boards = bp.sections.filter((s) => s.type === 'board');
  return [
    (has('qa') || on('qa')) && '질문',
    boards.length && (boards.some((s) => boardFiles(s, bp)) ? '나눔 보드에 올린 글·파일' : '나눔 보드에 올린 글'),
    on('help') && '도움 요청과 자리 번호',
    on('progress') && '실습 진행 상태',
    (has('poll') || on('poll') || bp.live.features.length) && '투표 응답', // 강사 화면의 즉석 투표는 어느 참여 기능 사이트에서나 띄울 수 있음
    on('signal') && '신호등 응답',
    bp.sections.some((s) => s.type === 'survey' && s.questions?.length) && '설문 응답',
    (has('attendance') || on('attendance')) && '입실·퇴실 시각',
    quickAttendOn(bp) && '출석을 누른 시각',
  ].filter(Boolean);
}
function quickAttendOn(bp) {
  return bp.live.provider !== 'none' && bp.live.features.length > 0 && !bp.sections.some((s) => s.type === 'attendance') && !bp.live.features.includes('attendance');
}
export function defaultProcessors(bp) {
  const map = {
    supabase: [{ name: 'Supabase Inc.', contact: 'privacy@supabase.com', country: '미국(서버 지역은 강사가 선택)', purpose: '참여 기능 기록 저장' }],
    sheets: [{ name: 'Google LLC', contact: 'https://support.google.com/policies/contact/general_privacy_form', country: '미국', purpose: '구글 시트·드라이브에 응답 저장' }],
    http: [{ name: '참여 기능 서버 운영자(Cloudflare, Inc. 또는 자체 서버)', contact: /(^|\.)workers\.dev$/.test(host(bp.live.url)) ? 'privacyquestions@cloudflare.com' : '', country: 'Cloudflare: 미국 / 자체 서버: 서버 위치', purpose: '참여 기능 중계와 저장' }],
  };
  return map[bp.live.provider] || [];
}

/**
 * ⑦ [데이터 모두 지우기]가 실제로 얼마나 지우는지, 참여 기능을 맡은 곳마다 사실대로(‘복구할 수 없게’는 그런 곳에만).
 * 자체 서버(Node): 지운 칸을 0으로 덮고 로그(WAL)도 비움. Cloudflare(workers.dev·바로 배포): 저장소의 '시점 복원'용 기록이 30일 남음.
 * Supabase: 요금제의 백업 보관 기간 동안 백업에 남을 수 있음. 구글 시트: 행을 지워도 시트의 버전 기록에 남아 파일째 지워야 함.
 */
export function eraseFacts(bp) {
  const prov = bp.live.provider;
  const h = host(bp.live.url || '');
  if (prov === 'sheets') return { how: '시트에서 행을 지웁니다. 다만 구글 시트는 지운 행도 버전 기록에 남기므로, 연수가 끝나면 시트 파일째 지우고 드라이브 휴지통을 비워 복구할 수 없게 합니다. 올린 파일은 드라이브 휴지통으로 옮겨집니다.', sure: false };
  if (prov === 'supabase') return { how: '데이터베이스와 파일 저장소에서 지웁니다. 다만 Supabase가 만드는 백업에는 요금제의 백업 보관 기간 동안 남을 수 있습니다.', sure: false };
  if (prov === 'http' && (/(^|\.)workers\.dev$/.test(h) || /\/live\/?$/.test(String(bp.live.url || '')))) return { how: '서버에서 지웁니다. 다만 Cloudflare가 저장소 복원용으로 남기는 기록에 30일 동안 남았다가 사라집니다.', sure: false };
  if (prov === 'http') return { how: '서버에서 지운 자리를 0으로 덮어 복구할 수 없게 지웁니다.', sure: true };
  return { how: '', sure: false };
}

export function renderPrivacy(ctx) {
  const bp = ctx.bp, pv = bp.privacy, local = bp.live.provider === 'local';
  const items = { nickname: '별명', name: '이름', school: '소속(학교)', email: '이메일' };
  const procs = local ? [] : (pv.processors.length ? pv.processors : defaultProcessors(bp));
  const acts = activityItems(bp);
  const anonQa = bp.live.anonymous !== false && (bp.sections.some((s) => s.type === 'qa') || bp.live.features.includes('qa'));
  const who = bp.meta.organizer || bp.instructors[0]?.name || '연수 운영자';
  const contactRaw = pv.contact || bp.meta.contact || bp.instructors.find((i) => i.email && i.showEmail)?.email || '';
  const contact = contactHtml(contactRaw || '연수 운영자에게 문의해 주세요.');
  const collect = pv.collect.map((c) => items[c]).filter(Boolean);
  const rows = (p) => [['이전받는 자', `${esc(p.name)}${p.contact ? ` (${contactHtml(p.contact)})` : ''}`], ['이전 국가', esc(p.country)], ['이전 항목', '위 2의 항목 전부'], ['이전 시기·방법', '참여 기능을 쓸 때마다 네트워크로 전송'], ['이용 목적·보유 기간', `${esc(p.purpose)}, 위 3의 보유 기간까지`], ['거부 방법과 효과', '참여 기능을 쓰지 않으면 전송되지 않습니다. 이 경우 질문·투표 등은 쓸 수 없고, 안내와 교재는 그대로 볼 수 있습니다.']];
  const sum = [
    ['받는 정보', `${collect.join('·')}${pv.collect.includes('name') ? '' : ' (이름·연락처는 받지 않음)'}`],
    ['보관', local ? '이 브라우저 안에만(리허설)' : `연수가 끝나고 ${pv.retentionDays}일`],
    ['맡기는 곳', local ? '없음' : procs.length ? procs.map((p) => esc(p.name.replace(/\(.*\)$/, '').trim())).join(', ') : '없음'],
    ['지우기', local ? '브라우저의 사이트 데이터 삭제' : '강사가 강사 화면에서 바로 지울 수 있음'],
    ['문의', contactRaw ? contactHtml(contactRaw) : esc(who)],
  ];
  const inner = `${auxBar(ctx, '개인정보 처리 안내')}
<main class="lp-doc lp-prose">
<h1>개인정보 처리 안내</h1>
<p class="lp-doc-lead">「${esc(bp.meta.title)}」 연수의 참여 기능(질문·투표 등)이 어떤 정보를 받고 어떻게 다루는지 적은 안내입니다.</p>
<section class="lp-doc-sum" aria-labelledby="lp-sum-h"><h2 id="lp-sum-h">한눈에 보기</h2><dl>${sum.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></section>
<p><b>개인정보처리자</b> ${esc(who)}</p>
<p>이 연수를 운영하면서 아래 개인정보만 처리합니다. 이 사이트를 만든 도구인 lecpage의 운영자는 참가자 정보를 받거나 보관하지 않습니다.</p>
<h2>1. 처리 목적</h2><p>연수 중 질문·도움 요청·결과물 공유${pv.collect.includes('name') ? ', 출석 및 이수 확인' : ''}.</p>
<h2>2. 처리 항목</h2><p>${collect.join(', ')}, 참가자를 구분하는 임의 번호.</p>
<p>참여 기록: ${acts.length ? acts.join(', ') : '참여 중 남긴 글'}.</p>${anonQa ? `\n<p>익명 질문은 다른 참가자와 발표 화면에 이름이 보이지 않습니다. 다만 ${local ? '기록' : '서버'}에는 그 임의 번호와 함께 저장됩니다.</p>` : ''}
<p>주민등록번호·전화번호·생년월일은 받지 않습니다. 질문이나 글에 본인 또는 다른 사람의 개인정보를 적지 마세요.</p>${bp.live.provider === 'http' ? '\n<p>접속할 때 IP 주소가 서버에 전달되며, 잘못된 접근과 도배를 막는 횟수 제한에만 씁니다. IP 주소는 기록으로 남기지 않습니다.</p>' : ''}${bp.audience?.minor ? '\n<p>만 14세 미만 참가자도 쓸 수 있도록 별명만 받습니다. 이름 등 다른 개인정보와 파일은 받지 않습니다.</p>' : ''}
<h2>3. 보유 기간과 파기</h2>${local ? '<p>이 사이트는 리허설용 설정이라 참여 기록을 서버로 보내지 않고 이 브라우저 안에만 둡니다. 브라우저의 사이트 데이터를 지우면 함께 지워집니다.</p>' : `<p>연수 종료 후 ${pv.retentionDays}일까지 보관하고, 그 뒤 지체 없이 파기합니다. 서버의 기록과 올린 파일은 강사 화면의 [데이터 모두 지우기]로 지우고, 내려받은 명단 파일도 함께 지웁니다. ${eraseFacts(bp).how}${bp.live.provider === 'http' ? ` 마지막 기록 뒤 ${pv.retentionDays}일이 지나면 서버가 저절로 지웁니다.` : ''}</p>`}
<h2>4. 동의를 거부할 권리</h2><p>동의하지 않아도 사이트의 안내·교재·실습 화면은 그대로 쓸 수 있습니다.${pv.collect.includes('name') ? ' 다만 출석 확인 등 이름이 필요한 기능은 쓸 수 없습니다.' : ''}</p>
<h2>5. 참가자의 권리</h2><p>참가자는 자신의 개인정보를 열람·정정·삭제하거나 처리를 멈춰 달라고 요구할 수 있습니다. 아래 문의처로 연락하면 10일 안에 조치하고 알려 드립니다.${bp.audience?.minor ? ' 만 14세 미만은 법정대리인이 요구할 수 있습니다.' : ''}</p>
<h2>6. 제3자 제공, 처리 위탁, 국외 이전</h2>${procs.length ? `<p>제3자에게 제공하지 않습니다. 참여 기록을 저장하기 위해 아래 회사에 처리를 맡기며, 이 회사의 서버가 국외에 있을 수 있습니다.</p>${procs.map((p) => `<div class="lp-table-wrap"><table class="lp-table"><tbody>${rows(p).map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('')}</tbody></table></div>`).join('')}` : '<p>제3자에게 제공하지 않고, 처리를 맡기는 곳도 없습니다.</p>'}
<p>사이트 파일을 보내 주는 호스팅 회사와 글꼴·효과 파일을 보내 주는 CDN(jsDelivr, Google Fonts, 네이버)에 접속 기록(IP 주소 등)이 남을 수 있습니다.</p>
<h2>7. 안전 조치</h2><p>${local ? '참여 기록은 이 브라우저 밖으로 나가지 않습니다.' : '모든 전송은 암호화(HTTPS)됩니다. 기록은 관리자 키를 아는 강사만 볼 수 있고, 틀린 키를 여러 번 넣으면 잠시 막습니다.'} 글은 글자로만 보이고(링크·스크립트로 바뀌지 않음), 한 기기에서 너무 자주 보내면 잠시 막습니다. 필요한 항목만 받고 보유 기간이 지나면 지웁니다.</p>
<h2>8. 이 브라우저에 저장하는 정보</h2><p>별명과 임의 번호, 화면 설정을 이 브라우저의 저장소(localStorage)에 둡니다. 쿠키와 분석 도구는 쓰지 않습니다. 브라우저의 사이트 데이터 삭제로 지울 수 있습니다.</p>
<h2>9. 문의</h2><p>${contact}</p>
<p>침해 신고·상담: 개인정보침해신고센터(privacy.kisa.or.kr, 118), 개인정보 분쟁조정위원회(www.kopico.go.kr, 1833-6972)</p>
<p class="lp-doc-foot">${ctx.builtOn ? `시행일 ${esc(ctx.builtOn)} ` : ''}이 안내는 연수 설정에 맞춰 자동으로 만들어졌습니다. 소속 기관의 개인정보 처리방침이 따로 있으면 그 방침이 우선합니다.</p>
<p><a class="lp-link" href="index.html">연수 사이트로 돌아가기 ${icon('arrow')}</a></p>
</main>`;
  return appShell(ctx, { title: `개인정보 처리 안내 · ${bp.meta.title}`, page: 'privacy', bodyClass: 'lp-body-doc', inner, scripts: ['assets/check.js'] });
}

// ── 운영 안내(강사 화면 도움말·운영안내.md) ─────────────────
export function opsGuide(ctx) {
  const bp = ctx.bp;
  const live = ctx.live;
  const prov = live ? bp.live.provider : 'none';
  const days = bp.privacy.retentionDays;
  const sv = bp.sections.find((s) => s.type === 'survey' && !s.hidden);
  const svIn = live && sv?.questions?.length;
  const attendSec = bp.sections.some((s) => s.type === 'attendance') || bp.live.features.includes('attendance');
  const wake = { supabase: 'Supabase 무료 프로젝트는 7일 동안 쓰지 않으면 멈춰요. 연수 하루 전에 접속 확인(`check.html`)을 열어 깨워 두세요.', sheets: '구글 시트의 Apps Script 배포 주소가 바뀌지 않았는지 접속 확인(`check.html`)으로 확인하세요.', http: '참여 기능 서버가 켜져 있는지 접속 확인(`check.html`)으로 확인하세요.', local: '지금은 리허설 설정이라 참여 기록이 이 브라우저에만 남아요. 실제 연수 전에 참여 기능 서버를 연결해 다시 배포하세요.' }[prov];
  const before = [
    '사이트를 배포하면 주소와 QR이 나와요. 현장에 붙일 안내문은 QR 안내문(`poster.html`)을 인쇄하세요(자리마다 놓을 카드 8장도 함께 인쇄할 수 있어요). 짧은 주소를 따로 만들어도 QR에는 원래 주소가 들어가요.',
    '연수 장소의 Wi-Fi로 접속 확인(`check.html`)을 열어 막힌 곳이 없는지 확인하세요.',
    live && '관리자 키로 강사 화면에 들어가 참가자 화면과 함께 리허설하세요. 다른 기기로 질문을 올리고 즉석 투표를 띄워 보면 돼요. 강사 화면 위 [더보기]에 참가자 화면·QR 안내문·접속 확인이 모여 있어요.',
    live && wake,
    live && prov === 'http' && /(^|\.)workers\.dev$/.test(host(bp.live.url || '')) && 'Cloudflare 무료는 하루 10만 요청까지예요(한국 오전 9시에 다시 채워짐). 큰 연수 날이나 요청이 갑자기 몰려 한도가 바닥날 것 같으면 그날만 Workers 유료(월 $5)를 켜 두세요. 멈추지 않고 넘친 만큼만 붙어요.',
  ].filter(Boolean);
  const during = live ? [
    '프로젝터에는 발표 화면(`screen.html`)을 띄워요. 강사 화면 위 [발표 화면 띄우기]를 누르면 크롬·엣지는 프로젝터를 고르는 창이 떠요. 그 창이 없으면 새 창이 열리니 프로젝터 쪽으로 끌어다 놓고 [전체 화면]을 누르세요.',
    '발표 화면에는 질문과 투표 결과가 크게 보여요. 강사 화면의 [참여 QR 크게]를 켜면 발표 화면에 QR이 화면 가득 떠요.',
    '교실을 돌며 쓰려면 [더보기] → [휴대폰에서 열기]의 QR을 휴대폰으로 찍어요. 그 QR에는 관리자 키가 들어 있으니 프로젝터에 비치지 않을 때만 보이세요.',
    '교탁 컴퓨터만 있으면 짧은 주소로 들어가 위 메뉴의 QR 버튼 → [발표 화면]을 누르고, 강사 화면은 휴대폰으로 열어요.',
    '즉석 투표: 강사 화면의 투표 칸에 질문 한 줄과 보기를 2~5개 적고 [바로 띄우기]를 눌러요. [결과 공개]를 누르면 참가자 화면에도 막대로 보여요.',
    '타이머·공지를 보내면 참가자 화면과 발표 화면 위에 나타나요. "강사 따라 넘기기"를 켜면 지금 실습·쪽으로 참가자 화면이 움직여요.',
    '질문이나 보드 글이 지나치게 몰리면 [질문 받기]·[새 글 받기]를 꺼서 잠시 잠그고, 맞지 않는 글은 [숨기기]로 가려요.',
    '모두 들어왔으면 진행 칸의 [참여 받기]를 꺼 두세요. 낯선 기기가 더 들어오지 않고, 이미 들어온 사람은 그대로 써요.',
    bp.live.features.includes('help') && '도움 요청은 [갈게요] → [해결]로 처리해요.',
    attendSec ? '출석 칸의 입실·퇴실을 연수 시작과 끝에 한 번씩 누르게 안내하세요.' : '연수를 시작할 때 참가자 화면 오른쪽 아래의 [출석]을 한 번 누르게 안내하세요. 질문·투표를 하지 않은 사람도 명단에 남아요.',
  ].filter(Boolean) : ['프로젝터에 발표 화면(`screen.html`)이나 첫 화면의 QR을 띄워 접속을 안내하세요. 참가자 화면 위 메뉴의 QR 버튼 → [발표 화면]으로도 열려요.'];
  const survey = sv ? (svIn ? '설문 결과: 강사 화면의 [기록 내려받기] → [설문 응답].' : sv.url ? `설문 결과: 설문은 바깥 설문 주소(${sv.url})로 받아요. 그 설문을 만든 계정에서 응답을 내려받으세요(구글 설문지는 [응답] 탭의 ⋮ 메뉴에서 CSV로 받아요).` : '') : '';
  const after = live ? [
    `참가자 명단(별명): 강사 화면의 [기록 내려받기] → [참가자]. ${attendSec ? '입실·퇴실 시각은 [출석]에 있어요.' : '[출석]을 눌렀거나 질문·투표를 한 사람이 명단에 남아요. 누른 시각은 [출석]에 있어요.'}`,
    survey,
    '질문·투표 결과도 같은 곳에서 CSV로 받아요. 투표 응답 파일의 첫 열에는 질문 글이 들어가요.',
    `다 받은 뒤, 늦어도 연수가 끝나고 ${days}일 안에 강사 화면의 [데이터 모두 지우기]로 지우세요. 내려받은 CSV에도 별명이 들어 있으니 다 쓰면 지워 주세요.`,
    prov === 'sheets' && '구글 시트는 지운 행도 버전 기록에 남아요. 다 쓰면 시트 파일째 지우고 드라이브 휴지통을 비워 주세요.',
    '공용 컴퓨터에서 관리자 키를 기억하게 했다면 강사 화면의 [나가기]를 눌러 이 기기에서 지우세요.',
  ].filter(Boolean) : [survey || '사이트는 그대로 두면 자료 모음으로 쓸 수 있어요.'];
  const list = (a, num) => a.map((t, i) => `${num ? `${i + 1}.` : '-'} ${t}`).join('\n');
  return `## 연수 전\n${list(before, true)}\n\n## 연수 중\n${list(during)}\n\n## 연수 후\n${list(after)}\n- 연수 날짜가 지나면 참가자 화면 맨 위에 '끝난 연수' 줄이 떠요. 다시 보기·이수 처리 일정은 \`연수 후 안내\` 칸에 넣어 다시 배포하세요(미리보기: 주소 끝에 \`?phase=after\`).\n`;
}
