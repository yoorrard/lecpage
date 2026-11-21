// 강의 기능 키트(약속 B): 자리 표시(data-lp="…")를 런타임(runtime/lecpage.js)이 아는 마크업으로 펼칩니다.
// 위젯 HTML은 엔진 템플릿(render/sections.js·pages.js)과 이 파일이 함께 씁니다(템플릿 렌더러를 지워도 위젯은 남음).
// 키트 사이트에서는 펼친 위젯을 class="lpk"로 감싸고 모양은 runtime/kit.css(.lpk 아래만)가 맡습니다.
import { esc, br, icon } from '../render/html.js';
import { josa } from '../words.js';

// ── 엔진·키트 공용 위젯 ──────────────────────────────────────
/** 반응 아이콘(선 그림). 실시간으로 주고받는 값은 그대로 이모지(프로토콜), 화면에는 선 아이콘 */
const svgIc = (p) => `<svg class="lp-ic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
export const REACTIONS = [
  { v: '👏', label: '박수', ic: svgIc('<path d="M8.2 12.6 5.4 9.8a1.4 1.4 0 0 1 2-2l3.4 3.4M9 9 7.2 7.2a1.4 1.4 0 0 1 2-2L13.6 9.6M11.4 7.4l-.9-.9a1.4 1.4 0 0 1 2-2l4.9 4.9a6.2 6.2 0 0 1 0 8.8l-.2.2a6.2 6.2 0 0 1-8.8 0l-3.2-3.2a1.4 1.4 0 0 1 2-2l1.7 1.7"/><path d="M17.2 2.8v2.1M20.6 4.2l-1.4 1.4M21.4 7.6h-2.1"/>') },
  { v: '💡', label: '좋은 생각', ic: svgIc('<path d="M9.2 18h5.6M10.2 21h3.6M12 3a6 6 0 0 0-3.7 10.7c.7.6 1.1 1.4 1.2 2.3h5c.1-.9.5-1.7 1.2-2.3A6 6 0 0 0 12 3z"/>') },
  { v: '❤️', label: '좋아요', ic: icon('heart') },
];
/** 이해 정도 신호: 도크에는 단추 하나(지금 보낸 신호), 누르면 글이 붙은 세 가지가 펼쳐짐 */
export const SIGNALS = [{ v: 'green', g: '✓', label: '이해했어요' }, { v: 'yellow', g: '?', label: '조금 헷갈려요' }, { v: 'red', g: '!', label: '모르겠어요' }];

// 참여 기능 없이 배포한 사이트(강사가 '참여 기능 없이 배포'를 고름): 누를 수 없는 칸 대신 참가자에게 한 줄
export const LIVE_OFF = '<p class="lp-note" data-live-off>이 사이트에서는 이 기능을 쓰지 않아요. 궁금한 점은 연수 중에 강사에게 직접 이야기해 주세요.</p>';
const liveOff = (live) => (live ? '' : LIVE_OFF);

/** 질문 받기(공감순·최신순) */
export function qaBox({ id = 'qa', anonymous = true, live = true } = {}) {
  return `<div class="lp-qa" data-qa>
<form class="lp-compose" data-qa-form><label class="lp-sr" for="${esc(id)}-q">질문</label><textarea id="${esc(id)}-q" name="text" rows="2" maxlength="500" placeholder="궁금한 점을 적어 주세요.${anonymous ? ' 이름은 보이지 않아요.' : ''}" required></textarea><div class="lp-compose-f"><small data-count>0 / 500</small><button class="lp-btn lp-btn-primary" type="submit">${icon('up')}<span>질문 올리기</span></button></div></form>
<div class="lp-tabs" role="group" aria-label="정렬"><button type="button" aria-pressed="true" data-sort="votes">공감순</button><button type="button" aria-pressed="false" data-sort="new">최신순</button></div>
<p class="lp-sr" role="status" data-list-news></p>
<ul class="lp-qa-list" data-qa-list><li class="lp-empty">아직 질문이 없어요. 첫 질문을 올려 주세요.</li></ul>
${liveOff(live)}</div>`;
}

export const DEFAULT_BOARD_CATS = [{ id: 'work', label: '결과물' }, { id: 'reflection', label: '소감' }];
/** 보드(글·사진). files: 파일을 받을지(boardFiles 결과) */
export function boardBox({ cats = DEFAULT_BOARD_CATS, files = false, maxFiles = 0, moderation = false, notice = '', live = true } = {}) {
  return `<div class="lp-board" data-board data-max-files="${files ? maxFiles : 0}" data-moderation="${moderation ? 1 : 0}">
<div class="lp-board-bar"><div class="lp-tabs" role="group" aria-label="보드 분류"><button type="button" aria-pressed="true" data-cat="">전체</button>${cats.map((c) => `<button type="button" aria-pressed="false" data-cat="${esc(c.id)}">${esc(c.label)}</button>`).join('')}</div><button class="lp-btn lp-btn-primary" type="button" data-board-write>${icon('sparkle')}<span>글 올리기</span></button></div>
<form class="lp-compose lp-board-form" data-board-form hidden>
  <fieldset class="lp-seg"><legend class="lp-sr">분류</legend>${cats.map((c, i) => `<label><input type="radio" name="kind" value="${esc(c.id)}"${i ? '' : ' checked'}><span>${esc(c.label)}</span></label>`).join('')}</fieldset>
  <label><span class="lp-sr">내용</span><textarea name="text" rows="3" maxlength="1000" placeholder="나누고 싶은 내용을 적어 주세요" required></textarea></label>
  ${files ? `<label class="lp-file"><span>사진·PDF·음악·영상 (${maxFiles}개까지)</span><input type="file" name="files" multiple accept="image/*,application/pdf,audio/mpeg,video/mp4"></label>` : ''}
  <label class="lp-inline"><span>이용 조건</span><select name="license"><option value="own">내가 만든 자료</option><option value="cc">CC 라이선스</option><option value="kogl">공공누리</option><option value="permitted">이용 허락 받음</option></select></label>
  <p class="lp-small">얼굴·이름 등 개인정보가 드러나는 자료는 올리지 말아 주세요.</p>
  <div class="lp-compose-f"><button class="lp-btn lp-btn-ghost" type="button" data-board-cancel>닫기</button><button class="lp-btn lp-btn-primary" type="submit">올리기</button></div>
</form>
<p class="lp-sr" role="status" data-list-news></p>
<ul class="lp-board-grid" data-board-list><li class="lp-empty">아직 올라온 글이 없어요. 첫 글을 올려 주세요.</li></ul>
${liveOff(live)}${notice ? `<p class="lp-note">${br(notice)}</p>` : ''}</div>`;
}

/** 투표: items([{id,question,kind,options}])는 강사 화면에서 열고 닫음. list: 준비된 질문 목록(엔진 투표 칸), ask: 자리 표시 하나의 질문(키트) */
export function pollBox(items, { live = true, list = true, ask = '', host = '강사' } = {}) {
  return `<div class="lp-poll" data-poll='${esc(JSON.stringify(items))}'>${ask ? `<p class="lpk-poll-q">${esc(ask)}</p>` : ''}<div class="lp-poll-live" data-poll-live><p class="lp-empty">${esc(josa(host, '이', '가'))} 투표를 열면 여기에 나타나요.</p></div>
${list ? `<details class="lp-poll-list"><summary>준비된 질문 ${items.length}개 보기</summary><ol>${items.map((p) => `<li>${esc(p.question)}${p.options.length ? ` <small>(${p.options.map(esc).join(' / ')})</small>` : ''}</li>`).join('')}</ol></details>` : ''}${liveOff(live)}</div>`;
}

/**
 * 출석(입실·퇴실). lead·after는 대상에 맞는 낱말(words.js attendLead·attendAfter).
 * 이수 조건(무엇을 눌러야 이수인지)은 키트가 지어 쓰지 않음: 교재·강사가 정한 조건은 AI가 사이트 글로 씀
 */
export function attendBox({ lead, after, live = true }) {
  return `<div class="lp-attend" data-attend><p data-phase-hide="after">${lead}</p><p data-phase-show="after" hidden>${after}</p><div class="lp-ctas" data-phase-hide="after"><button class="lp-btn lp-btn-primary" type="button" data-attend="in">입실 확인</button><button class="lp-btn lp-btn-ghost" type="button" data-attend="out">퇴실 확인</button></div><p class="lp-small" data-attend-state></p>${liveOff(live)}</div>`;
}

const pad2 = (n) => String(n).padStart(2, '0');
// 설문 항목 열쇠(결과 CSV의 열 이름): "1. 질문 앞부분"
export function surveyKey(q, n) { return `${n + 1}. ${[...String(q.q || '')].slice(0, 30).join('')}`.trim(); }
export const SCALE_KO = ['전혀 아니에요', '아니에요', '보통이에요', '그래요', '매우 그래요'];
/** 사이트 안 설문(별점·객관식·주관식). s: { id, questions:[{q,kind,options}] } */
export function surveyForm(s) {
  const qs = s.questions.map((q, n) => {
    const key = esc(surveyKey(q, n)); const name = `sv-${esc(s.id)}-${n}`;
    const qText = `<span class="lp-idx">${pad2(n + 1)}</span>${esc(q.q)}`;
    const legend = `<legend>${qText}</legend>`;
    if (q.kind === 'text') return `<li><label class="lp-sv-text"><span class="lp-sv-q">${qText}</span><textarea name="${name}" rows="3" maxlength="1000" data-sv-key="${key}"></textarea></label></li>`;
    const opts = q.kind === 'choice' ? q.options : (q.options.length >= 2 ? q.options : SCALE_KO);
    return `<li><fieldset class="lp-sv-${q.kind === 'choice' ? 'choice' : 'scale'}" data-sv-key="${key}">${legend}<div class="lp-sv-opts">${opts.map((o, k) => `<label><input type="radio" name="${name}" value="${esc(q.kind === 'scale' ? String(k + 1) : o)}"><span>${q.kind === 'scale' ? `<b>${k + 1}</b><i>${esc(o)}</i>` : esc(o)}</span></label>`).join('')}</div></fieldset></li>`;
  }).join('');
  return `<form class="lp-survey-form" data-survey="${esc(s.id)}" novalidate><ol class="lp-sv-list">${qs}</ol><div class="lp-compose-f"><small data-sv-state role="status">다시 내면 고쳐져요. 별명으로만 모여요.</small><button class="lp-btn lp-btn-primary" type="submit">제출하기</button></div></form>`;
}

/** '지금' 줄: 실시간 상태(열린 투표·공지·타이머·강사가 보는 실습/쪽). 보여 줄 게 없으면 숨김 */
export function nowInner() {
  return `<div class="lp-now-in" role="region" aria-label="지금 진행">
<span class="lp-now-tag" aria-hidden="true">지금</span>
<p class="lp-now-text" role="status"><b data-now-main></b><span data-now-sub></span></p>
<button class="lp-now-more" type="button" data-now-more aria-expanded="false" hidden>더 보기</button>
<span class="lp-now-timer" data-timer role="timer" hidden></span>
<a class="lp-btn lp-btn-primary lp-btn-sm lp-now-cta" data-now-cta href="#main" hidden></a>
</div>`;
}

/** 사이트 공유 대화상자(QR·주소·연수 코드). code: 참여 기능이 켜졌을 때만 */
export function shareDialog({ code = '', codeWord = '연수 코드', live = false } = {}) {
  return `<dialog class="lp-dialog" data-share-dialog aria-labelledby="lp-share-h"><form method="dialog" class="lp-dialog-in">
<h2 id="lp-share-h">사이트 공유</h2><div class="lp-qr lp-qr-lg" data-qr-self role="img" aria-label="이 페이지 QR 코드"></div>
<p class="lp-share-url" data-share-url></p><p class="lp-share-full" data-url-full hidden></p><p class="lp-small lp-share-off" data-url-off hidden>배포하면 여기에 참가자 주소와 QR이 나와요.</p>${live ? `<p class="lp-share-code">${esc(codeWord)} <b>${esc(code)}</b></p>` : ''}
<p class="lp-small lp-share-scr">프로젝터에는 <a href="screen.html">발표 화면</a>을 띄워요. QR${live ? '과 질문·투표 결과가' : '이'} 크게 보여요.</p>
<div class="lp-compose-f"><button class="lp-btn lp-btn-ghost" type="button" data-copy-url>${icon('copy')}<span>주소 복사</span></button><button class="lp-btn lp-btn-primary" value="close">닫기</button></div></form></dialog>`;
}

/**
 * 참여하기 대화상자(별명, 입실이면 이름·소속·동의). keep: 지우는 때(keepRule().short — 배포할 곳·참여 서버가 실제로 지우는 때),
 * local: 연습 모드(기록이 이 브라우저에만 남음 → 지우는 날을 말하지 않음)
 */
export function joinDialog({ anonymous = true, collect = ['nickname'], consent = true, official = false, keep = '', local = false } = {}) {
  const needName = collect.includes('name');
  const needSchool = collect.includes('school');
  const idWords = [needName && '이름', needSchool && '소속'].filter(Boolean).join('·');
  // 소속은 직무연수(이수 처리에 소속이 들어감)만 꼭 받고, 교내 연수·설명회 등은 선택(이름만 적어도 입실)
  const schoolMust = needSchool && (official || !needName);
  return `<dialog class="lp-dialog" data-join-dialog aria-labelledby="lp-join-h"><form class="lp-dialog-in" data-join-form>
<h2 id="lp-join-h">참여하기</h2><p class="lp-small" data-join-lead>${anonymous ? '보드 글에 보일 별명을 정해 주세요. 투표와 질문은 별명 없이 바로 돼요.' : '질문과 보드 글에 보일 별명을 정해 주세요.'}</p>
<label data-join-nick><span>별명</span><input name="nickname" maxlength="20" required autocomplete="nickname" aria-describedby="lp-join-err"></label>
<p class="lp-small" id="lp-join-err" data-join-err role="alert" style="color:var(--danger);font-weight:600" hidden></p>
${needName ? '<label data-join-id><span>이름</span><input name="name" maxlength="20" required autocomplete="name"></label>' : ''}
${needSchool ? `<label data-join-id><span>소속${schoolMust ? '' : ' · 선택'}</span><input name="school" maxlength="40"${schoolMust ? ' required' : ''} autocomplete="organization"></label>` : ''}
${consent && (needName || needSchool) ? `<label class="lp-consent" data-join-id><input type="checkbox" name="consent" required><span>${idWords}을 출석 확인에만 쓰${local ? '는 데 동의합니다. 연습 모드라 이 브라우저에만 남아요.' : keep ? `고 ${keep} 안에 지우는 데 동의합니다.` : '는 데 동의합니다.'} 동의하지 않으면 입실 기록만 남지 않아요(질문·투표는 그대로). <a href="privacy.html" target="_blank">자세히</a></span></label>` : ''}
<div class="lp-compose-f"><button class="lp-btn lp-btn-ghost" type="button" data-join-cancel>나중에</button><button class="lp-btn lp-btn-primary" type="submit" data-join-go>참여</button></div></form></dialog>`;
}

/**
 * 참여 막대(도크): 연결 상태 · 출석 · 도움 요청 · 질문 · 이해 정도 · 반응.
 * attend: false | 'quick'(한 번 누르기) | 'in'(입실), extra: 끝에 더할 단추(키트의 공유 단추)
 */
export function dockInner({ attend = false, help = false, qa = false, signal = false, reactions = false, extra = '' } = {}) {
  return `
  <span class="lp-live-dot" data-live-status title="연결 상태"></span>
  ${attend ? `<button class="lp-btn lp-btn-dock" type="button" data-dock-attend${attend === 'quick' ? '' : '="in"'} hidden>${icon('check')}<span>출석</span></button>` : ''}
  ${help ? `<button class="lp-btn lp-btn-dock" type="button" data-dock-help>${icon('hand')}<span>도움 요청</span></button>` : ''}
  ${qa ? `<button class="lp-btn lp-btn-dock lp-btn-dock-2" type="button" data-dock-qa>${icon('chat')}<span>질문</span></button>` : ''}
  ${signal ? `<div class="lp-fold lp-signal"><button type="button" class="lp-fold-btn" data-fold-toggle aria-expanded="false" aria-label="지금 이해 정도 보내기" title="이해 정도"><i data-signal-now aria-hidden="true"></i></button><div class="lp-fold-list" role="group" aria-label="지금 이해 정도">${SIGNALS.map((x) => `<button type="button" data-signal="${x.v}" aria-pressed="false"><i aria-hidden="true">${x.g}</i><span>${x.label}</span></button>`).join('')}</div></div>` : ''}
  ${reactions ? `<div class="lp-fold lp-react"><button type="button" class="lp-fold-btn" data-fold-toggle aria-expanded="false" aria-label="반응 보내기" title="반응">${REACTIONS[0].ic}</button><div class="lp-fold-list" role="group" aria-label="반응 보내기">${REACTIONS.map((r) => `<button type="button" data-react="${r.v}" aria-label="${r.label}" title="${r.label}">${r.ic}</button>`).join('')}</div></div>` : ''}${extra}
`;
}

/** 도움 요청 시트(자리·막힌 곳) */
export function helpSheet() {
  return `<dialog class="lp-dialog lp-sheet" data-help-dialog aria-labelledby="lp-help-h"><form class="lp-dialog-in" data-help-form>
<div class="lp-sheet-h"><h2 id="lp-help-h">도움 요청</h2><button class="lp-icon-btn" type="button" data-sheet-close aria-label="닫기">${icon('close')}</button></div>
<p class="lp-small">자리를 적으면 강사가 찾아가요. 적은 자리는 이 기기에 저장돼요.</p>
<label><span>자리</span><input name="seat" maxlength="20" autocomplete="off" placeholder="예: 3모둠, 창가 두 번째"></label>
<label><span>무엇이 막혔나요? (선택)</span><textarea name="message" rows="2" maxlength="300"></textarea></label>
<div class="lp-compose-f"><button class="lp-btn lp-btn-ghost" type="button" data-sheet-close>닫기</button><button class="lp-btn lp-btn-primary" type="submit">${icon('hand')}<span>요청하기</span></button></div></form></dialog>`;
}
export const TOAST = '<div class="lp-toast" data-toast role="status" aria-live="polite"></div>';

// ── 키트 자리 표시 ───────────────────────────────────────────
/** 쓸 수 있는 자리 표시(data-lp 값) */
export const KIT_TYPES = ['qa', 'poll', 'board', 'attend', 'survey', 'deck', 'materials', 'join', 'dock', 'now', 'share', 'notebook'];
/** 자리 표시 → 필요한 기능(lecpage.json features) */
export const TYPE_FEATURE = { qa: 'qa', poll: 'poll', board: 'board', attend: 'attendance', survey: 'survey', deck: 'deck', materials: 'materials' };

/** 아이디 꼴(엔진 validate.js slug와 같은 규칙: 강사 화면이 같은 아이디로 찾음) */
export function kitSlug(s, fallback) {
  return String(s ?? '').normalize('NFC').trim().slice(0, 40).toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '') || fallback;
}
/** "1-12" · "1-3,5,8-10" → [1,2,…] (최대 400쪽) */
export function parsePages(v, max = 400) {
  const out = [];
  for (const part of String(v || '').split(/[,\s]+/).filter(Boolean)) {
    const m = /^(\d{1,4})(?:\s*[-~–]\s*(\d{1,4}))?$/.exec(part);
    if (!m) continue;
    let a = +m[1], b = m[2] ? +m[2] : a; if (b < a) [a, b] = [b, a];
    for (let p = a; p <= b && out.length < max; p++) if (p >= 1 && !out.includes(p)) out.push(p);
  }
  return out;
}
export const pagePath = (n) => `material/p-${String(n).padStart(3, '0')}.webp`;

/** JSON 속성 읽기: 깨졌으면 { error } */
export function jsonAttr(v) {
  if (v === undefined || v === null || v === '') return { value: undefined };
  try { return { value: JSON.parse(v) }; } catch (e) { return { error: String(e.message).slice(0, 80) }; }
}
/** 보기 목록: JSON 배열 또는 '|'·줄바꿈으로 나눈 글 */
export function optionList(v) {
  const j = jsonAttr(v);
  if (j.error) { const parts = String(v).split(/\s*[|\n]\s*/).map((x) => x.trim()).filter(Boolean); return parts.length >= 2 ? { value: parts } : { error: j.error }; }
  return { value: Array.isArray(j.value) ? j.value.map((x) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)).filter(Boolean) : undefined };
}

/** 교재 쪽 넘기기(강사 따라 넘기기). pages: [{ page, src, title, text }] */
export function deckBox(pages, { label = '교재', host = '강사' } = {}) {
  const last = Math.max(...pages.map((x) => +x.page || 0), pages.length);
  const slides = pages.map((sl, i) => `<figure class="lp-slide" id="deck-p${sl.page}" data-page="${sl.page}" data-title="${esc(sl.title || '')}" data-text="${esc((sl.text || '').slice(0, 400))}"><img src="${esc(sl.src)}" alt="${esc(`${label} ${sl.page}쪽${sl.title ? ': ' + sl.title : ''}`)}" loading="${i < 2 ? 'eager' : 'lazy'}" decoding="async"><figcaption><span class="lp-slide-no">${sl.page}</span>${esc(sl.title || '')}</figcaption></figure>`).join('\n');
  return `<div class="lp-deck" data-deck>
  <div class="lp-deck-stage" tabindex="0" aria-roledescription="슬라이드" aria-label="${esc(label)} ${pages.length}쪽">${slides}</div>
  <div class="lp-deck-bar" hidden>
    <button class="lp-icon-btn" type="button" data-deck-prev aria-label="이전 쪽">${icon('left')}</button>
    <span class="lp-deck-count" aria-live="polite"><b data-deck-cur>${pages[0]?.page ?? 1}</b> / ${last}</span>
    <button class="lp-icon-btn" type="button" data-deck-next aria-label="다음 쪽">${icon('right')}</button>
    <span class="lp-grow"></span>
    <button class="lp-btn lp-btn-ghost lp-btn-sm" type="button" data-deck-overview>${icon('grid')}<span>전체 보기</span></button>
    <button class="lp-btn lp-btn-ghost lp-btn-sm" type="button" data-deck-full>${icon('expand')}<span>전체 화면</span></button>
    <label class="lp-follow" hidden><input type="checkbox" data-deck-follow checked> ${esc(host)} 따라 넘기기</label>
  </div>
</div>`;
}

/** 접속 QR·주소·연수 코드 */
export function joinBox({ live = false, code = '', codeWord = '연수 코드' } = {}) {
  return `<div class="lpk-join-in"><div class="lp-qr" data-qr-self role="img" aria-label="이 사이트 QR 코드"></div><div class="lpk-join-t"><p class="lpk-join-k">휴대폰 카메라로 QR을 찍거나 주소를 입력해요</p><p class="lpk-join-url" data-url-self></p><p class="lpk-join-full" data-url-full hidden></p>${live && code ? `<p class="lpk-join-code">${esc(codeWord)} <b>${esc(code)}</b></p>` : ''}<button class="lp-btn lp-btn-ghost lp-btn-sm" type="button" data-copy-url>${icon('copy')}<span>주소 복사</span></button></div></div>`;
}

/** 자료실: items([{title, href, desc, kind, size}]) + 강사가 연수 중에 더한 링크(data-live-materials, 런타임이 채움) */
export function materialsBox(items = [], { inner = '', host = '강사' } = {}) {
  const row = (m) => { const ext = /^https?:/.test(m.href); return `<li><span class="lp-file-kind">${esc(m.kind || (ext ? '링크' : 'FILE'))}</span><div><h3>${esc(m.title)}</h3>${m.desc ? `<p>${esc(m.desc)}</p>` : ''}${m.size ? `<small>${esc(m.size)}</small>` : ''}</div>${m.href ? `<a class="lp-btn lp-btn-ghost lp-btn-sm" href="${esc(m.href)}"${ext ? ' target="_blank" rel="noopener"' : ' download'}>${icon(ext ? 'external' : 'download')}<span>${ext ? '열기' : '다운로드'}</span></a>` : ''}</li>`; };
  return `${inner}${items.length ? `<ul class="lp-materials">${items.map(row).join('')}</ul>` : ''}<ul class="lp-materials lp-materials-live" data-live-materials aria-label="${esc(josa(host, '이', '가'))} 추가한 자료" hidden></ul>${items.length || inner.trim() ? '' : `<p class="lpk-empty" data-lpk-mats-empty>${esc(josa(host, '이', '가'))} 자료를 올리면 여기에 보여요.</p>`}`;
}

/** 실습 단계 끝: 완료 체크·도움 요청(진행 현황·도움 요청이 이 단계를 셈) */
export function stepFooter() {
  return `<div class="lpk lpk-step-f"><button class="lp-btn lp-btn-check" type="button" data-done aria-pressed="false">${icon('check')}<span>완료 체크</span></button><button class="lp-btn lp-btn-ghost" type="button" data-stuck hidden>${icon('hand')}<span>도움 요청</span></button></div>`;
}

/** 모음(이 기기에만): 사이트에서 복사한 프롬프트와 내가 적은 메모가 쌓이고 .txt로 받음. 목록은 런타임(lecpage.js initNotebook)이 그림 */
export function notebookBox({ id = 'lpk-nb' } = {}) {
  return `<div class="lp-nb" data-notebook>
<p class="lp-small">이 사이트에서 복사한 프롬프트가 여기에 모여요. 이 기기에만 저장돼요.</p>
<form class="lp-compose" data-nb-form><label class="lp-sr" for="${esc(id)}-t">메모</label><textarea id="${esc(id)}-t" name="text" rows="2" maxlength="4000" placeholder="고친 프롬프트나 메모를 적어 담아요" required></textarea><div class="lp-compose-f"><small data-nb-count></small><button class="lp-btn lp-btn-primary" type="submit">${icon('check')}<span>담기</span></button></div></form>
<p class="lp-sr" role="status" data-nb-news></p>
<ol class="lp-nb-list" data-nb-list><li class="lp-empty">아직 담은 글이 없어요. 프롬프트의 [복사]를 누르면 여기에 모여요.</li></ol>
<div class="lp-ctas lp-nb-f"><button class="lp-btn lp-btn-primary" type="button" data-nb-save disabled>${icon('download')}<span>.txt 다운로드</span></button><button class="lp-btn lp-btn-ghost" type="button" data-nb-copy disabled>${icon('copy')}<span>모두 복사</span></button><button class="lp-btn lp-btn-ghost" type="button" data-nb-clear disabled>${icon('close')}<span>모두 삭제</span></button></div>
</div>`;
}

/** 공유 단추(QR 대화상자 열기) */
export function shareButton() { return `<button class="lp-btn lp-btn-ghost lp-btn-sm lpk-share" type="button" data-share aria-haspopup="dialog">${icon('qr')}<span>QR 공유</span></button>`; }

/** 연수가 끝난 뒤 줄(끝난 날짜) */
export function phaseInner(text) {
  return `<div class="lp-now-in" role="region" aria-label="안내"><span class="lp-now-tag" aria-hidden="true">종료</span><p class="lp-now-text"><b>${esc(text)}</b></p></div>`;
}
