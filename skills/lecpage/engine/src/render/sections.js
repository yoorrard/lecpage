// 섹션 렌더러: 섹션 객체 → HTML 문자열. 모든 섹션은 JS 없이도 내용이 다 보여야 합니다.
import { esc, br, href, host, md, fx, pad2, icon, koDate } from './html.js';

function head(s, ctx, fallbackTitle) {
  const title = s.title || fallbackTitle;
  if (!title && !s.lead) return '';
  return `<header class="lp-head">${title ? `<h2 class="lp-h2" id="${esc(s.id)}-h"${fx(ctx, 'section.title')}>${br(title)}</h2>` : ''}${s.lead ? `<p class="lp-lead">${br(s.lead)}</p>` : ''}</header>`;
}

function wrap(s, ctx, inner, extraAttrs = '') {
  const labelled = s.title ? ` aria-labelledby="${esc(s.id)}-h"` : '';
  const enter = ctx.design.effects?.['section.enter'] ? ` data-enter="${esc(ctx.design.effects['section.enter'])}"` : '';
  return `<section id="${esc(s.id)}" class="lp-sec lp-sec-${esc(s.type)}"${s.tone ? ` data-tone="${esc(s.tone)}"` : ''}${labelled}${enter}${extraAttrs}>\n<div class="lp-wrap">${inner}</div>\n</section>`;
}

function liveOff(ctx, what) {
  return ctx.live ? '' : `<p class="lp-note" data-live-off>${esc(what)}은(는) 실시간 연결이 켜진 사이트에서 쓸 수 있어요. 지금은 연결이 꺼져 있어요.</p>`;
}

// ── 첫 화면 ──────────────────────────────────────────────
function hero(s, ctx) {
  const m = ctx.bp.meta;
  const ins = ctx.bp.instructors[0];
  const meta = s.meta?.length ? s.meta : [
    m.date && { label: '일시', value: `${koDate(m.date)}${m.start ? ` ${m.start}${m.end ? `~${m.end}` : ''}` : ''}` },
    m.venue && { label: '장소', value: m.venue },
    ins && { label: '강사', value: `${ins.name}${ins.org ? ` · ${ins.org}` : ''}` },
  ].filter(Boolean);
  const ctas = s.ctas?.length ? s.ctas : defaultCtas(ctx);
  const graphic = ctx.design.graphic ? `<div class="lp-hero-graphic" data-fx="${esc(ctx.design.graphic)}" aria-hidden="true"></div>` : '';
  const overlay = ctx.design.effects?.['hero.graphic.overlay'] ? `<div class="lp-hero-overlay" data-fx="${esc(ctx.design.effects['hero.graphic.overlay'])}" aria-hidden="true"></div>` : '';
  const title = s.title || m.title;
  return `<section id="${esc(s.id)}" class="lp-sec lp-hero"${s.tone ? ` data-tone="${esc(s.tone)}"` : ''} aria-labelledby="${esc(s.id)}-h">
${graphic}${overlay}
<div class="lp-wrap lp-hero-inner">
  <div class="lp-hero-copy">
    ${s.eyebrow || m.organizer ? `<p class="lp-hero-eyebrow">${esc(s.eyebrow || m.organizer)}</p>` : ''}
    <h1 class="lp-h1" id="${esc(s.id)}-h"${fx(ctx, 'hero.title')}>${br(title)}</h1>
    ${s.subtitle || m.subtitle ? `<p class="lp-hero-sub">${br(s.subtitle || m.subtitle)}</p>` : ''}
    ${ctas.length ? `<div class="lp-ctas">${ctas.map((c, i) => `<a class="lp-btn ${i ? 'lp-btn-ghost' : 'lp-btn-primary'}" ${href(c.href)}${i ? '' : fx(ctx, 'hero.cta')}><span>${esc(c.label)}</span>${icon(/^https?:/.test(c.href) ? 'external' : 'arrow')}</a>`).join('')}</div>` : ''}
  </div>
  ${meta.length ? `<dl class="lp-hero-meta">${meta.map((x) => `<div><dt>${esc(x.label)}</dt><dd>${esc(x.value)}</dd></div>`).join('')}</dl>` : ''}
</div>
</section>`;
}
function defaultCtas(ctx) {
  const order = ['stations', 'deck', 'outline', 'schedule', 'tools'];
  const out = [];
  for (const t of order) { const sec = ctx.bp.sections.find((x) => x.type === t); if (sec) { out.push({ label: { stations: '실습 시작하기', deck: '교재 보기', outline: '오늘의 차례', schedule: '일정 보기', tools: '도구 바로 가기' }[t], href: '#' + sec.id }); if (out.length === 2) break; } }
  return out;
}

// ── 요약·메시지 ───────────────────────────────────────────
function glance(s, ctx) {
  return wrap(s, ctx, head(s, ctx) + `<dl class="lp-glance-grid">${s.items.map((i) => `<div class="lp-card lp-glance-item"><dt>${esc(i.label)}</dt><dd><span class="lp-num"${fx(ctx, 'numbers')}>${esc(i.value)}</span>${i.note ? `<small>${esc(i.note)}</small>` : ''}</dd></div>`).join('')}</dl>`);
}

function message(s, ctx) {
  let body;
  if (s.style === 'formula' && s.parts?.length) {
    const sr = s.parts.join(' 곱하기 ') + (s.result ? ' 는 ' + s.result : '');
    body = `<p class="lp-formula" aria-label="${esc(sr)}">${s.parts.map((p, i) => `<span class="lp-term" style="--i:${i}">${esc(p)}</span>`).join('<span class="lp-op" aria-hidden="true">×</span>')}${s.result ? `<span class="lp-op" aria-hidden="true">=</span><span class="lp-term lp-result">${esc(s.result)}</span>` : ''}</p>`;
    if (s.text) body += `<p class="lp-message-note">${br(s.text)}</p>`;
  } else if (s.style === 'quote') {
    body = `<blockquote class="lp-quote"><p${fx(ctx, 'message')}>${br(s.text)}</p>${s.cite ? `<cite>${esc(s.cite)}</cite>` : ''}</blockquote>`;
  } else {
    body = `<p class="lp-statement"${fx(ctx, 'message')}>${br(s.text)}</p>`;
  }
  if (s.note) body += `<p class="lp-message-note">${br(s.note)}</p>`;
  return wrap(s, ctx, (s.title ? head(s, ctx) : '') + body);
}

function steps5(s, ctx) {
  return wrap(s, ctx, head(s, ctx) + `<ol class="lp-steps5">${s.items.map((i, n) => `<li class="lp-card"><span class="lp-idx">${pad2(n + 1)}</span><h3>${esc(i.word)}</h3>${i.desc ? `<p>${esc(i.desc)}</p>` : ''}</li>`).join('')}</ol>${s.close ? `<p class="lp-close-line">${br(s.close)}</p>` : ''}`);
}

function outline(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '오늘의 차례') + `<ol class="lp-outline">${s.items.map((i, n) => {
    const target = i.target ? (i.target.startsWith('deck:') ? `#deck-p${i.target.slice(5)}` : '#' + i.target) : '';
    return `<li class="lp-card lp-outline-item"${fx(ctx, 'cards')}><span class="lp-outline-no">${pad2(n + 1)}</span><div><p class="lp-outline-part">${esc(i.part)}</p><h3>${esc(i.title)}</h3>${i.desc ? `<p>${esc(i.desc)}</p>` : ''}${i.tags.length ? `<ul class="lp-tags">${i.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}${target ? `<a class="lp-link" href="${esc(target)}">${target.startsWith('#deck-p') ? `교재 ${esc(i.target.slice(5))}쪽 보기` : '바로 가기'}${icon('arrow')}</a>` : ''}</div></li>`;
  }).join('')}</ol>`);
}

function schedule(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '일정') + `<ol class="lp-schedule"${fx(ctx, 'schedule')} data-date="${esc(ctx.bp.meta.date)}">${s.items.map((i) => `<li data-start="${esc(i.start)}" data-end="${esc(i.end)}"${i.date ? ` data-date="${esc(i.date)}"` : ''}><time>${esc(i.start)}${i.end ? `<span>~${esc(i.end)}</span>` : ''}</time><div><h3>${esc(i.title)}</h3>${i.desc ? `<p>${esc(i.desc)}</p>` : ''}</div>${i.part ? `<span class="lp-chip">${esc(i.part)}</span>` : ''}</li>`).join('')}</ol>`);
}

// ── 준비 ─────────────────────────────────────────────────
function readiness(s, ctx) {
  const checks = s.checks.length ? `<div class="lp-diag" data-diag='${esc(JSON.stringify(s.checks))}'><div class="lp-diag-h"><h3>접속 진단</h3><button class="lp-btn lp-btn-ghost" type="button" data-diag-run>지금 확인하기</button></div><ul class="lp-diag-list">${s.checks.map((c) => `<li data-url="${esc(c.url)}"><span class="lp-diag-dot" aria-hidden="true"></span><span>${esc(c.name)}</span><small>${esc(host(c.url))}</small><b class="lp-diag-state">확인 전</b></li>`).join('')}</ul><p class="lp-small">학교망에서 막힌 사이트가 있으면 결과 화면을 정보 담당 선생님께 보여 주세요.</p></div>` : '';
  return wrap(s, ctx, head(s, ctx, '시작 전에 준비해요') + `<ul class="lp-checklist" data-checklist="${esc(s.id)}">${s.items.map((i, n) => `<li><label><input type="checkbox" data-check="${n}"><span><b>${esc(i.label)}</b>${i.detail ? `<small>${br(i.detail)}</small>` : ''}</span></label>${i.url ? `<a class="lp-link" ${href(i.url)}>열기${icon('external')}</a>` : ''}</li>`).join('')}</ul>${checks}`);
}

// ── 교재 뷰어 ─────────────────────────────────────────────
function deck(s, ctx) {
  const toolMap = Object.fromEntries((ctx.bp.sections.find((x) => x.type === 'tools')?.items || []).map((t) => [t.name, t]));
  const slides = s.slides.map((sl, i) => {
    const tools = (sl.tools || []).map((n) => toolMap[n]).filter(Boolean);
    const media = sl.src ? `<img src="${esc(sl.src)}" alt="${esc(`${sl.page}쪽${sl.title ? ': ' + sl.title : ''}`)}" loading="${i < 2 ? 'eager' : 'lazy'}" decoding="async">` : `<div class="lp-slide-text"><h3>${esc(sl.title || `${sl.page}쪽`)}</h3>${sl.text ? `<p>${br(sl.text.slice(0, 600))}</p>` : ''}</div>`;
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
    <label class="lp-follow" hidden><input type="checkbox" data-deck-follow checked> 강사 화면 따라가기</label>
  </div>
  ${dl ? `<div class="lp-deck-dl">${dl}</div>` : ''}
  ${s.notice ? `<p class="lp-note">${br(s.notice)}</p>` : ''}
</div>`);
}

// ── 실습 스테이션 ─────────────────────────────────────────
function stations(s, ctx) {
  const n = s.items.length;
  const side = `<aside class="lp-st-side"><nav aria-label="실습 목차"><ol>${s.items.map((st, i) => `<li><a href="#st-${esc(st.id)}" data-st-link="${esc(st.id)}"><span class="lp-st-n">${pad2(i + 1)}</span><span class="lp-st-name">${esc(st.name)}</span><span class="lp-st-ck" aria-hidden="true"></span></a></li>`).join('')}</ol></nav>
<div class="lp-st-record"><div class="lp-st-record-h"><b>나의 실습 기록</b><span data-st-count>0 / ${n}</span></div><progress max="${n}" value="0" data-st-progress aria-label="실습 진행"></progress><button class="lp-textbtn" type="button" data-st-export>기록 내려받기 ${icon('download')}</button><small>완료 체크와 메모는 이 브라우저에만 저장돼요.</small></div></aside>`;
  const panels = s.items.map((st, i) => {
    const steps = st.steps.length ? `<ol class="lp-steps">${st.steps.map((x) => `<li>${br(x)}</li>`).join('')}</ol>` : '';
    const links = st.links.length ? `<div class="lp-st-links">${st.links.map((l) => `<a class="lp-btn lp-btn-ghost lp-btn-sm" ${href(l.url)}>${esc(l.label || host(l.url))}${icon('external')}</a>`).join('')}</div>` : '';
    const imgs = st.images.length ? `<details class="lp-st-images"><summary>화면 안내 보기 · ${st.images.length}장</summary><div class="lp-st-gallery">${st.images.map((im, k) => `<figure><a href="${esc(im.src)}" target="_blank" rel="noopener"><img src="${esc(im.src)}" alt="${esc(im.caption || `${st.name} 화면 ${k + 1}`)}" loading="lazy"></a>${im.caption ? `<figcaption>${esc(im.caption)}</figcaption>` : ''}</figure>`).join('')}</div></details>` : '';
    const prompts = st.prompts.length ? `<div class="lp-prompts"><h4>복사해서 바로 실습</h4>${st.prompts.map((p, k) => `<div class="lp-prompt"><div class="lp-prompt-h"><b>${esc(p.title || `프롬프트 ${k + 1}`)}</b><span><button class="lp-textbtn" type="button" data-restore hidden>원문으로</button><button class="lp-btn lp-btn-sm lp-btn-primary" type="button" data-copy${fx(ctx, 'celebrate') ? '' : ''}>${icon('copy')}<span>복사</span></button></span></div><textarea class="lp-prompt-text" data-prompt="${esc(st.id)}-${k}" rows="${Math.min(10, Math.max(3, Math.ceil(p.text.length / 46)))}" spellcheck="false" aria-label="${esc(p.title || '프롬프트')}">${esc(p.text)}</textarea></div>`).join('')}</div>` : '';
    const src = st.source?.pages?.length ? `<p class="lp-src">교재 ${st.source.pages.map((p) => `<a href="#deck-p${p}">${p}쪽</a>`).join(', ')}</p>` : '';
    return `<article class="lp-st" id="st-${esc(st.id)}" data-st="${esc(st.id)}" aria-labelledby="st-${esc(st.id)}-h">
<header class="lp-st-h"><span class="lp-st-big" aria-hidden="true">${pad2(i + 1)}</span><div>${st.tag ? `<span class="lp-chip">${esc(st.tag)}</span>` : ''}<h3 id="st-${esc(st.id)}-h">${esc(st.title)}</h3>${st.desc ? `<p>${br(st.desc)}</p>` : ''}${st.minutes ? `<small>${icon('clock')} 약 ${st.minutes}분</small>` : ''}</div></header>
${links}${steps}${st.note ? `<p class="lp-note">${br(st.note)}</p>` : ''}${imgs}${prompts}${src}
<div class="lp-st-done">
  ${st.outcome ? `<p class="lp-outcome"><b>여기까지 해 봤나요?</b> ${br(st.outcome)}</p>` : ''}
  <div class="lp-st-actions"><button class="lp-btn lp-btn-check" type="button" data-done aria-pressed="false"${fx(ctx, 'celebrate')}>${icon('check')}<span>완료 체크</span></button><button class="lp-btn lp-btn-ghost" type="button" data-stuck hidden>${icon('hand')}<span>막혔어요</span></button></div>
  <label class="lp-memo"><span>나의 적용 아이디어</span><textarea data-memo="${esc(st.id)}" rows="3" placeholder="내 수업이나 업무에 어떻게 써 볼까요?"></textarea></label>
</div>
<nav class="lp-st-pn" aria-label="실습 이동">${i > 0 ? `<a class="lp-btn lp-btn-ghost" href="#st-${esc(s.items[i - 1].id)}">${icon('left')}<span>이전 실습</span></a>` : '<span></span>'}${i < n - 1 ? `<a class="lp-btn lp-btn-ghost" href="#st-${esc(s.items[i + 1].id)}"><span>다음 실습</span>${icon('right')}</a>` : '<span></span>'}</nav>
</article>`;
  }).join('\n');
  return wrap(s, ctx, head(s, ctx, '실습') + `<div class="lp-st-shell" data-stations="${esc(s.id)}" data-layout="${esc(s.layout)}"${fx(ctx, 'progress') ? ` data-progress-fx="${esc(ctx.design.effects.progress)}"` : ''}>${side}<div class="lp-st-panels">${panels}</div></div>`);
}

// ── 도구·프롬프트 ─────────────────────────────────────────
function tools(s, ctx) {
  const hasDeck = ctx.bp.sections.some((x) => x.type === 'deck');
  return wrap(s, ctx, head(s, ctx, '함께 쓰는 도구') + `<ul class="lp-tools">${s.items.map((t) => `<li class="lp-card lp-tool"${fx(ctx, 'cards')}><div class="lp-tool-h"><span class="lp-tool-mark" aria-hidden="true">${esc([...t.name][0] || '·')}</span><div><h3>${esc(t.name)}</h3>${t.url ? `<small>${esc(host(t.url))}</small>` : ''}</div></div>${t.desc ? `<p>${esc(t.desc)}</p>` : ''}<div class="lp-tool-f">${t.pages.length ? `<span class="lp-pages">교재 ${t.pages.map((p) => hasDeck ? `<a href="#deck-p${p}">${p}</a>` : esc(p)).join(' ')}</span>` : '<span></span>'}${t.url ? `<a class="lp-icon-btn" ${href(t.url)} aria-label="${esc(t.name)} 열기">${icon('external')}</a>` : ''}</div></li>`).join('')}</ul>${s.notice ? `<p class="lp-note">${br(s.notice)}</p>` : ''}`);
}

function prompts(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '프롬프트 모음') + `<div class="lp-prompt-lib">${s.items.map((p, k) => `<div class="lp-prompt lp-card"><div class="lp-prompt-h"><b>${esc(p.title || `프롬프트 ${k + 1}`)}</b><span><button class="lp-textbtn" type="button" data-restore hidden>원문으로</button><button class="lp-btn lp-btn-sm lp-btn-primary" type="button" data-copy>${icon('copy')}<span>복사</span></button></span></div>${p.tags.length ? `<ul class="lp-tags">${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}<textarea class="lp-prompt-text" data-prompt="lib-${k}" rows="${Math.min(10, Math.max(3, Math.ceil(p.text.length / 46)))}" spellcheck="false" aria-label="${esc(p.title || '프롬프트')}">${esc(p.text)}</textarea></div>`).join('')}</div>`);
}

// ── 실시간 참여 ───────────────────────────────────────────
function qa(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '질문해 주세요') + `<div class="lp-qa" data-qa>
<form class="lp-compose" data-qa-form><label class="lp-sr" for="${esc(s.id)}-q">질문</label><textarea id="${esc(s.id)}-q" name="text" rows="2" maxlength="500" placeholder="궁금한 점을 남겨 주세요${s.anonymous ? ' (이름은 보이지 않아요)' : ''}" required></textarea><div class="lp-compose-f"><small data-count>0 / 500</small><button class="lp-btn lp-btn-primary" type="submit">${icon('up')}<span>질문 올리기</span></button></div></form>
<div class="lp-tabs" role="tablist" aria-label="정렬"><button role="tab" aria-selected="true" data-sort="votes">공감 많은 순</button><button role="tab" aria-selected="false" data-sort="new">최신 순</button></div>
<ul class="lp-qa-list" data-qa-list aria-live="polite"><li class="lp-empty">첫 질문을 남겨 주세요. 다른 사람의 질문에 공감을 누를 수도 있어요.</li></ul>
${liveOff(ctx, '실시간 질문')}</div>`);
}

function board(s, ctx) {
  const cats = s.categories.length ? s.categories : [{ id: 'work', label: '결과물' }, { id: 'reflection', label: '소감' }];
  if (!ctx.live && s.externalUrl) return wrap(s, ctx, head(s, ctx, '함께 나누는 보드') + `<p><a class="lp-btn lp-btn-primary" ${href(s.externalUrl)}>보드 열기${icon('external')}</a></p>`);
  return wrap(s, ctx, head(s, ctx, '함께 나누는 보드') + `<div class="lp-board" data-board data-max-files="${s.allowFiles ? s.maxFiles : 0}" data-moderation="${s.moderation ? 1 : 0}">
<div class="lp-board-bar"><div class="lp-tabs" role="tablist" aria-label="보드 분류"><button role="tab" aria-selected="true" data-cat="">전체</button>${cats.map((c) => `<button role="tab" aria-selected="false" data-cat="${esc(c.id)}">${esc(c.label)}</button>`).join('')}</div><button class="lp-btn lp-btn-primary" type="button" data-board-write>${icon('sparkle')}<span>글 올리기</span></button></div>
<form class="lp-compose lp-board-form" data-board-form hidden>
  <fieldset class="lp-seg"><legend class="lp-sr">분류</legend>${cats.map((c, i) => `<label><input type="radio" name="kind" value="${esc(c.id)}"${i ? '' : ' checked'}><span>${esc(c.label)}</span></label>`).join('')}</fieldset>
  <label><span class="lp-sr">내용</span><textarea name="text" rows="3" maxlength="1000" placeholder="나누고 싶은 내용을 적어 주세요" required></textarea></label>
  ${s.allowFiles ? `<label class="lp-file"><span>사진·PDF·음악·영상 (최대 ${s.maxFiles}개)</span><input type="file" name="files" multiple accept="image/*,application/pdf,audio/mpeg,video/mp4"></label>` : ''}
  <label class="lp-inline"><span>이용 조건</span><select name="license"><option value="own">내가 만든 자료</option><option value="cc">CC 라이선스</option><option value="kogl">공공누리</option><option value="permitted">이용 허락 받음</option></select></label>
  <p class="lp-small">학생 얼굴·이름 등 개인정보가 드러나는 자료는 올리지 말아 주세요.</p>
  <div class="lp-compose-f"><button class="lp-btn lp-btn-ghost" type="button" data-board-cancel>취소</button><button class="lp-btn lp-btn-primary" type="submit">올리기</button></div>
</form>
<ul class="lp-board-grid" data-board-list aria-live="polite"><li class="lp-empty">아직 올라온 글이 없어요. 첫 글을 올려 주세요.</li></ul>
${liveOff(ctx, '참여 보드')}${s.notice ? `<p class="lp-note">${br(s.notice)}</p>` : ''}</div>`);
}

function poll(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '함께 답해요') + `<div class="lp-poll" data-poll='${esc(JSON.stringify(s.items))}'><div class="lp-poll-live" data-poll-live><p class="lp-empty">강사가 투표를 열면 여기에 나타나요.</p></div>
<details class="lp-poll-list"><summary>준비된 질문 ${s.items.length}개 보기</summary><ol>${s.items.map((p) => `<li>${esc(p.question)}${p.options.length ? ` <small>(${p.options.map(esc).join(' / ')})</small>` : ''}</li>`).join('')}</ol></details>${liveOff(ctx, '투표')}</div>`);
}

function quiz(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '복습 퀴즈') + `<ol class="lp-quiz" data-quiz>${s.items.map((q, n) => `<li class="lp-card"><fieldset><legend><span class="lp-idx">${pad2(n + 1)}</span>${esc(q.q)}</legend>${q.options.map((o, k) => `<label><input type="radio" name="quiz-${esc(s.id)}-${n}" value="${k}" data-correct="${k === q.answer ? 1 : 0}"><span>${esc(o)}</span></label>`).join('')}</fieldset><p class="lp-quiz-fb" aria-live="polite" hidden data-explain="${esc(q.explain)}"></p></li>`).join('')}</ol>`);
}

function attendance(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '출석 확인') + `<div class="lp-attend" data-attend><p>연수를 시작할 때와 마칠 때 한 번씩 눌러 주세요.</p><div class="lp-ctas"><button class="lp-btn lp-btn-primary" type="button" data-attend="in">입실 확인</button><button class="lp-btn lp-btn-ghost" type="button" data-attend="out">퇴실 확인</button></div><p class="lp-small" data-attend-state></p>${liveOff(ctx, '출석 확인')}</div>`);
}

// ── 자료·사람 ─────────────────────────────────────────────
function materials(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '연수 자료') + `<ul class="lp-materials">${s.items.map((m) => `<li class="lp-card"><span class="lp-file-kind">${esc(m.kind || 'FILE')}</span><div><h3>${esc(m.title)}</h3>${m.desc ? `<p>${esc(m.desc)}</p>` : ''}${m.size ? `<small>${esc(m.size)}</small>` : ''}</div>${m.href ? `<a class="lp-btn lp-btn-ghost lp-btn-sm" ${href(m.href)}${/^https?:/.test(m.href) ? '' : ' download'}>${icon(/^https?:/.test(m.href) ? 'external' : 'download')}<span>${/^https?:/.test(m.href) ? '열기' : '내려받기'}</span></a>` : ''}</li>`).join('')}</ul>${s.notice ? `<div class="lp-notice-box"><b>자료 이용 안내</b><p>${br(s.notice)}</p></div>` : ''}`);
}

function instructor(s, ctx) {
  const list = ctx.bp.instructors;
  if (!list.length) return '';
  return wrap(s, ctx, head(s, ctx, list.length > 1 ? '강사 소개' : '강사 소개') + list.map((p) => `<div class="lp-person">
<div class="lp-card lp-person-card"${fx(ctx, 'cards')}>${p.photo ? `<img class="lp-avatar" src="${esc(p.photo)}" alt="${esc(p.name)} 사진">` : `<span class="lp-avatar lp-avatar-text" aria-hidden="true">${esc([...p.name][0] || '')}</span>`}<h3>${esc(p.name)}</h3>${p.role || p.org ? `<p class="lp-person-role">${esc([p.org, p.role].filter(Boolean).join(' '))}</p>` : ''}${p.tags.length ? `<ul class="lp-tags">${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}${p.bio ? `<p class="lp-person-bio">${br(p.bio)}</p>` : ''}
${p.email && p.showEmail ? `<div class="lp-contact"><span class="lp-email">${esc(p.email)}</span><button class="lp-btn lp-btn-sm lp-btn-ghost" type="button" data-copy-text="${esc(p.email)}">${icon('copy')}<span>주소 복사</span></button></div>` : ''}
${p.links.length ? `<div class="lp-person-links">${p.links.map((l) => `<a class="lp-link" ${href(l.url)}>${esc(l.label || host(l.url))}${icon('external')}</a>`).join('')}</div>` : ''}</div>
${p.timeline.length ? `<div class="lp-timeline">${p.timeline.map((g) => `<div class="lp-tl-group"><h4>${esc(g.group)}</h4><ul>${g.items.map((it) => `<li><span>${it.url ? `<a ${href(it.url)}>${esc(it.text)}</a>` : esc(it.text)}</span>${it.year ? `<small>${esc(it.year)}</small>` : ''}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}
</div>`).join(''));
}

function speakers(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '연사') + `<ul class="lp-speakers">${s.items.map((p) => `<li class="lp-card"${fx(ctx, 'cards')}>${p.photo ? `<img class="lp-avatar" src="${esc(p.photo)}" alt="${esc(p.name)} 사진" loading="lazy">` : `<span class="lp-avatar lp-avatar-text" aria-hidden="true">${esc([...p.name][0] || '')}</span>`}<h3>${esc(p.name)}</h3><p class="lp-person-role">${esc([p.org, p.role].filter(Boolean).join(' '))}</p>${p.talk ? `<p>${esc(p.talk)}</p>` : ''}${p.time ? `<small>${icon('clock')} ${esc(p.time)}</small>` : ''}</li>`).join('')}</ul>`);
}

function sessions(s, ctx) {
  const label = { done: '마침', now: '진행 중', next: '다음' };
  return wrap(s, ctx, head(s, ctx, '차시') + `<ol class="lp-sessions">${s.items.map((x) => `<li class="lp-card" data-status="${esc(x.status)}"><span class="lp-idx">${x.no}차시</span><div><h3>${esc(x.title)}</h3>${x.date ? `<small>${esc(koDate(x.date))}</small>` : ''}${x.desc ? `<p>${esc(x.desc)}</p>` : ''}${x.links.length ? `<div class="lp-st-links">${x.links.map((l) => `<a class="lp-link" ${href(l.url)}>${esc(l.label || '열기')}${icon('arrow')}</a>`).join('')}</div>` : ''}</div>${x.status ? `<span class="lp-chip">${label[x.status]}</span>` : ''}</li>`).join('')}</ol>`);
}

function survey(s, ctx) {
  const url = s.url;
  return wrap(s, ctx, `<div class="lp-survey lp-card">
<div><h2 class="lp-h2" id="${esc(s.id)}-h"${fx(ctx, 'section.title')}>${br(s.title || '만족도 조사에 참여해 주세요')}</h2>${s.lead ? `<p class="lp-lead">${br(s.lead)}</p>` : '<p class="lp-lead">오늘 연수에 대한 의견을 들려주세요. 다음 연수를 더 좋게 만드는 데 씁니다.</p>'}
${url ? `<a class="lp-btn lp-btn-primary lp-btn-lg" ${href(url)}${fx(ctx, 'hero.cta')}><span>바로 참여하기</span>${icon('external')}</a>` : '<p class="lp-note">설문 주소가 아직 없어요.</p>'}${url && s.qr ? '<p class="lp-small">QR을 찍기 어려우면 버튼을 눌러 주세요.</p>' : ''}</div>
${url && s.qr ? `<div class="lp-qr" data-qr="${esc(url)}" role="img" aria-label="설문 QR 코드"></div>` : ''}</div>`);
}

function closing(s, ctx) {
  const graphic = ctx.design.closingGraphic ? `<div class="lp-closing-graphic" data-fx="${esc(ctx.design.closingGraphic)}" aria-hidden="true"></div>` : '';
  return `<section id="${esc(s.id)}" class="lp-sec lp-closing"${s.tone ? ` data-tone="${esc(s.tone)}"` : ''}>${graphic}<div class="lp-wrap">${s.lead ? `<p class="lp-closing-lead">${br(s.lead)}</p>` : ''}<p class="lp-closing-text"${fx(ctx, 'closing.title')}>${br(s.text || ctx.bp.meta.title)}</p>${s.thanks ? `<p class="lp-closing-thanks">${br(s.thanks)}</p>` : ''}</div></section>`;
}

function faq(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '자주 묻는 질문') + `<div class="lp-faq">${s.items.map((i) => `<details class="lp-card"><summary>${esc(i.q)}</summary><div>${md(i.a)}</div></details>`).join('')}</div>`);
}
function glossary(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '용어 풀이') + `<dl class="lp-glossary">${s.items.map((i) => `<div><dt>${esc(i.term)}</dt><dd>${br(i.desc)}</dd></div>`).join('')}</dl>`);
}
function video(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '영상') + `<ul class="lp-videos">${s.items.map((v) => `<li class="lp-card"><a ${href(v.url)} class="lp-video-link">${v.thumb ? `<img src="${esc(v.thumb)}" alt="" loading="lazy">` : `<span class="lp-video-ph" aria-hidden="true">${icon('play')}</span>`}<span class="lp-video-t">${esc(v.title || host(v.url))}${v.length ? ` <small>${esc(v.length)}</small>` : ''}</span></a></li>`).join('')}</ul>`);
}
function gallery(s, ctx) {
  return wrap(s, ctx, head(s, ctx, '사진') + `<ul class="lp-gallery"${fx(ctx, 'gallery')}>${s.items.map((g) => `<li><figure><a href="${esc(g.src)}" target="_blank" rel="noopener"><img src="${esc(g.src)}" alt="${esc(g.caption)}" loading="lazy"></a>${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ''}</figure></li>`).join('')}</ul>`);
}
function reflection(s, ctx) {
  const prompts = s.prompts.length ? s.prompts : ['오늘 가장 기억에 남는 것', '다음 주 수업에서 해 볼 한 가지'];
  return wrap(s, ctx, head(s, ctx, '나의 기록') + `<form class="lp-reflect" data-reflect="${esc(s.id)}" onsubmit="return false">${prompts.map((p, i) => `<label><span>${esc(p)}</span><textarea rows="3" data-reflect-q="${i}"></textarea></label>`).join('')}<div class="lp-compose-f"><small>이 브라우저에만 저장돼요.</small><button class="lp-btn lp-btn-primary" type="button" data-reflect-save>${icon('download')}<span>내려받기</span></button></div></form>`);
}
function text(s, ctx) { return wrap(s, ctx, head(s, ctx) + `<div class="lp-prose">${md(s.md)}</div>`); }

export const RENDERERS = { hero, glance, message, steps5, outline, schedule, readiness, deck, stations, tools, prompts, qa, board, poll, quiz, materials, instructor, speakers, sessions, survey, closing, faq, glossary, video, gallery, reflection, attendance, text };

export function renderSection(s, ctx) {
  const fn = RENDERERS[s.type];
  return fn ? fn(s, ctx) : '';
}
