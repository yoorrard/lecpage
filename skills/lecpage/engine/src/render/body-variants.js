// 본문 배치 변형의 렌더러: 섹션 종류마다 구조가 다른 배치(design/layouts.js BODY_VARIANTS).
// 기본 변형(목록의 첫째)은 sections.js·content.js의 원래 렌더러가 그리고, 여기에는 그 밖의 변형만 둡니다.
// 규칙: 내용은 그대로(지어내지 않음) · 그림은 꾸밈(aria-hidden) · JS 없이도 내용이 다 보임 · 인쇄에서 다 펼쳐짐.
import { motifSvg, roadSvg, clockSvg, wheelSvg, tallySvg, webSvg } from './body-graphic.js';
import { inlineMd } from './markdown.js';

const REST = /쉬는|휴식|점심|식사|break|lunch/i;
/** 제목의 첫 글자(모티프 '큰 글자' 가족이 씀) */
export const firstGlyph = (t) => { const s = String(t || '').trim(), lat = /^[A-Za-z0-9]{2,}/.exec(s); return lat ? lat[0].slice(0, 2) : ([...s].find((ch) => /[\p{L}\p{N}]/u.test(ch)) || ''); };

export function bodyVariants(H) {
  const { esc, br, pad2, icon, href, host, koDate, fx, md, sourceLine, itemFx, groupFx, completionLine, bentoSpans, hasDeck, famOf } = H;
  /** 이 연수의 모티프 그림(컨셉 모티프 가족 × 연수 제목). key마다 다른 그림 */
  const motif = (ctx, key, o = {}) => motifSvg(famOf(ctx), `${ctx.bp.meta.title}|${key}`, { glyph: firstGlyph(ctx.bp.meta.title), ...o });
  const slidesOf = (ctx) => ctx.bp.sections.find((x) => x.type === 'deck')?.slides || [];
  const goalMeta = (s, ctx) => { const done = completionLine(ctx), rows = [s.who && ['대상', s.who], done && ['이수', done]].filter(Boolean); return rows.length ? `<div class="lp-goal-meta">${rows.map(([k, v]) => `<p><b>${k}</b> ${esc(v)}</p>`).join('')}</div>` : ''; };
  /**
   * 넘김(낱말 넘김): 위에 낱말 줄(같은 쪽 안 링크), 아래에 판이 옆으로 늘어선 띠(가로 스크롤 스냅).
   * 아무것도 숨기지 않음: JS가 없으면 링크가 그 판으로 데려가고 띠는 손으로 밀어 넘김. JS는 부드럽게 넘기고 지금 판을 표시만 함.
   * 판이 모두 한 줄에 같은 높이로 서 있어 넘겨도 아래 내용이 밀리지 않음(CLS 0). 인쇄에서는 세로로 다 펼쳐짐
   */
  const pager = (sid, label, items, cls = '') => `<div class="lp-tb${cls}" data-pager><nav class="lp-tb-list" aria-label="${esc(label)}">${items.map((x, i) => `<a href="#${esc(sid)}-p${i}"${i ? '' : ' aria-current="true"'}><span class="lp-tb-n" aria-hidden="true">${pad2(i + 1)}</span><span>${esc(x.tab)}</span></a>`).join('')}</nav><div class="lp-tb-panels" tabindex="0" role="group" aria-label="${esc(label)}, 옆으로 넘겨 보기">${items.map((x, i) => `<article class="lp-tb-panel" id="${esc(sid)}-p${i}">${x.panel}</article>`).join('')}</div></div>`;
  const tags = (list) => (list?.length ? `<ul class="lp-tags">${list.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '');

  const VB = {};

  // ── 연수 목표 ────────────────────────────────────────────
  VB.goals = {
    /* 선언문: 한 문장씩 아주 크게. 스크롤에 맞춰 지금 읽는 문장이 또렷해짐 */
    manifesto: (s, ctx) => `<div class="lp-goals lp-goals--alt"><ol class="lp-say" style="--n:${s.items.length}">${s.items.map((g, i) => `<li style="--i:${i}"><span class="lp-say-no" aria-hidden="true">${pad2(i + 1)}</span><p>${esc(g)}</p></li>`).join('')}</ol>${goalMeta(s, ctx)}</div>`,
    /* 여정: 굽은 길 위의 정류장. 길은 정류장 높이만큼 늘어나는 토막 그림 */
    journey: (s, ctx) => `<div class="lp-goals lp-goals--alt"><ol class="lp-jr" data-diagram style="--n:${s.items.length}">${s.items.map((g, i) => `<li style="--i:${i}">${roadSvg(i, i === s.items.length - 1)}<span class="lp-jr-pin" aria-hidden="true">${i + 1}</span><p>${esc(g)}</p></li>`).join('')}</ol>${goalMeta(s, ctx)}</div>`,
    /* 체크 카드 벤토: 크기가 다른 칸, 칸마다 체크 고리 */
    bento: (s, ctx) => { const sp = bentoSpans(s.items.length); return `<div class="lp-goals lp-goals--alt"><ol class="lp-gb" style="--n:${s.items.length}"${groupFx(ctx)}>${s.items.map((g, i) => `<li data-w="${sp[i]}"${itemFx(ctx)}><svg class="lp-gb-ck" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="21"/><path pathLength="1" d="M14 25l7 7 13-15"/></svg><span class="lp-gb-no" aria-hidden="true">${pad2(i + 1)}</span><p>${esc(g)}</p></li>`).join('')}</ol>${goalMeta(s, ctx)}</div>`; },
    /* 세로 단: 옆으로 나란한 기둥, 기둥마다 큰 윤곽 숫자 */
    columns: (s, ctx) => { const n = s.items.length; return `<div class="lp-goals lp-goals--alt"><ol class="lp-gc" style="--n:${n};--c:${n <= 4 ? n : Math.ceil(n / 2)}">${s.items.map((g, i) => `<li style="--i:${i}"><span class="lp-gc-no" aria-hidden="true">${i + 1}</span><p>${esc(g)}</p></li>`).join('')}</ol>${goalMeta(s, ctx)}</div>`; },
  };

  // ── 한눈에 보기 ──────────────────────────────────────────
  const fig = (p, ctx) => `<span class="lp-fig"><span class="lp-num"${fx(ctx, 'numbers')}>${esc(p.num)}</span>${p.unit ? `<span class="lp-unit">${esc(p.unit)}</span>` : ''}</span>`;
  VB.glance = {
    /* 그림 숫자: 값만큼 점·고리를 그림(퍼센트 도넛 · 분·시간 시계 고리 · 개수 점 묶음) */
    tally: (s, ctx, { numParts }) => `<dl class="lp-tl" data-diagram style="--n:${s.items.length}">${s.items.map((i) => { const p = numParts(i.value), art = tallySvg(p.num, p.unit); return `<div class="lp-tl-item${art ? '' : ' is-plain'}">${art ? `<span class="lp-tl-art" aria-hidden="true">${art}</span>` : ''}<dt>${esc(i.label)}</dt><dd>${fig(p, ctx)}${i.note ? `<small>${esc(i.note)}</small>` : ''}</dd></div>`; }).join('')}</dl>`,
    /* 점선 사양표: 이름 ···· 값 */
    spec: (s, ctx, { numParts }) => `<dl class="lp-spec">${s.items.map((i) => { const p = numParts(i.value); return `<div><dt>${esc(i.label)}${i.note ? `<small>${esc(i.note)}</small>` : ''}</dt><dd>${fig(p, ctx)}</dd></div>`; }).join('')}</dl>`,
  };

  // ── 핵심 단계 ────────────────────────────────────────────
  const stepLi = (i, n) => `<li style="--i:${n}"><span class="lp-idx" aria-hidden="true">${pad2(n + 1)}</span><h3>${esc(i.word)}</h3>${i.desc ? `<p>${esc(i.desc)}</p>` : ''}</li>`;
  const closeLine = (s) => (s.close ? `<p class="lp-close-line">${br(s.close)}</p>` : '');
  VB.steps5 = {
    /* 둥근 고리: 요소가 고리 위에 고르게 놓임. 목록의 줄을 가리키면 고리의 그 점이 켜짐 */
    wheel: (s) => `<div class="lp-wh" data-diagram data-linked style="--n:${s.items.length}">${wheelSvg(s.items.length)}<ol class="lp-wh-list">${s.items.map(stepLi).join('')}</ol></div>${closeLine(s)}`,
    /* 화살표 흐름도: 앞 단계가 다음 단계를 가리킴 */
    flow: (s) => `<ol class="lp-fl" data-diagram data-art style="--n:${s.items.length}">${s.items.map(stepLi).join('')}</ol>${closeLine(s)}`,
    /* 낱말 넘김: 낱말을 누르면 그 풀이가 크게 */
    tabs: (s) => pager(s.id, s.title || '핵심 단계', s.items.map((i, n) => ({ tab: i.word, panel: `<span class="lp-idx" aria-hidden="true">${pad2(n + 1)} / ${pad2(s.items.length)}</span><h3>${esc(i.word)}</h3>${i.desc ? `<p>${esc(i.desc)}</p>` : ''}` })), ' lp-tb--words') + closeLine(s),
  };

  // ── 차례 ─────────────────────────────────────────────────
  const outlineBits = (i, ctx) => {
    const target = i.target ? (i.target.startsWith('deck:') ? `#deck-p${i.target.slice(5)}` : '#' + i.target) : '';
    const sl = i.target?.startsWith('deck:') ? slidesOf(ctx).find((x) => String(x.page) === i.target.slice(5)) : null;
    return { target, img: sl?.src || '', page: i.target?.startsWith('deck:') ? i.target.slice(5) : '', link: target ? `<a class="lp-link" href="${esc(target)}">${target.startsWith('#deck-p') ? `교재 ${esc(i.target.slice(5))}쪽 보기` : '바로 가기'}${icon('arrow')}</a>` : '' };
  };
  const outlineBody = (i, b) => `${i.part ? `<p class="lp-outline-part">${esc(i.part)}</p>` : ''}<h3>${esc(i.title)}</h3>${i.desc ? `<p class="lp-ol-d">${esc(i.desc)}</p>` : ''}${tags(i.tags)}${b.link}`;
  const outlineArt = (i, n, b, ctx, s) => `<div class="lp-ol-art${b.img ? ' has-img' : ''}" aria-hidden="true">${b.img ? `<img src="${esc(b.img)}" alt="" loading="lazy" decoding="async">` : motif(ctx, `${s.id}${n}`, { w: 480, h: 300 })}<span class="lp-ol-no">${pad2(n + 1)}</span></div>`;
  VB.outline = {
    /* 좌우 번갈아: 그림(교재 쪽 그림, 없으면 모티프 그림)과 글이 줄마다 자리를 바꿈 */
    zigzag: (s, ctx) => `<ol class="lp-zz" style="--n:${s.items.length}">${s.items.map((i, n) => { const b = outlineBits(i, ctx); return `<li class="lp-zz-item" style="--i:${n}">${outlineArt(i, n, b, ctx, s)}<div class="lp-zz-body">${outlineBody(i, b)}</div></li>`; }).join('')}</ol>`,
    /* 벤토 격자: 크기가 다른 칸에 번호·제목·설명 */
    bento: (s, ctx) => { const sp = bentoSpans(s.items.length); return `<ol class="lp-ob" style="--n:${s.items.length}"${groupFx(ctx)}>${s.items.map((i, n) => `<li data-w="${sp[n]}"${itemFx(ctx)}><span class="lp-ob-no" aria-hidden="true">${pad2(n + 1)}</span><div class="lp-ob-b">${outlineBody(i, outlineBits(i, ctx))}</div></li>`).join('')}</ol>`; },
    /* 책 차례: 번호 · 제목 ····· 쪽 */
    toc: (s, ctx) => `<ol class="lp-toc"${fx(ctx, 'list')}>${s.items.map((i, n) => { const b = outlineBits(i, ctx); return `<li><span class="lp-toc-no" aria-hidden="true">${pad2(n + 1)}</span><div class="lp-toc-b"><h3>${esc(i.title)}</h3>${i.desc ? `<p>${esc(i.desc)}</p>` : ''}${tags(i.tags)}</div><span class="lp-toc-dots" aria-hidden="true"></span><span class="lp-toc-pg">${b.target ? `<a href="${esc(b.target)}">${b.page ? `교재 ${esc(b.page)}쪽` : '바로 가기'}</a>` : esc(i.part || '')}</span></li>`; }).join('')}</ol>`,
    /* 필름 띠: 가로로 넘겨 보는 장면들(키보드 방향키·터치 밀기·단추) */
    filmstrip: (s, ctx) => `<div class="lp-film" data-film><ol class="lp-film-track" tabindex="0" aria-label="${esc(s.title || '오늘의 차례')}, 가로로 넘겨 보기" style="--n:${s.items.length}">${s.items.map((i, n) => { const b = outlineBits(i, ctx); return `<li class="lp-film-card" style="--i:${n}">${outlineArt(i, n, b, ctx, s)}<div class="lp-film-b">${outlineBody(i, b)}</div></li>`; }).join('')}</ol><div class="lp-film-nav" hidden><button class="lp-icon-btn" type="button" data-film-prev aria-label="이전 장면">${icon('left')}</button><span class="lp-film-count" aria-hidden="true"><b data-film-cur>1</b> / ${s.items.length}</span><button class="lp-icon-btn" type="button" data-film-next aria-label="다음 장면">${icon('right')}</button></div></div>`,
  };

  // ── 일정(시간 도식): 모두 data-sched 목록이라 참가자 화면이 지금·지난 순서를 표시함 ──
  const schedAttr = (i, min) => ` data-start="${esc(i.start)}" data-end="${esc(i.end)}"${i.date ? ` data-date="${esc(i.date)}"` : ''}${min ? ` style="--min:${min}"` : ''}`;
  const whenText = (i) => `${esc(i.start)}${i.end ? `<span>~${esc(i.end)}</span>` : ''}`;
  VB.schedule = {
    /* 가로 트랙: 길이에 비례한 시간 축 + 그 아래 번호가 같은 순서 카드. 카드를 가리키면 축의 그 구간이 켜짐 */
    track: (s, ctx, { mins }) => `<div class="lp-trk" data-diagram data-linked><div class="lp-trk-bar" data-art aria-hidden="true">${s.items.map((i, n) => `<i data-seg class="${REST.test(i.title) ? 'is-rest' : `c${n % 2}`}" style="--min:${mins[n]};--k:${n}"><b>${n + 1}</b><em>${esc(i.start)}</em></i>`).join('')}<span class="lp-trk-end">${esc(s.items[s.items.length - 1].end || '')}</span></div><ol class="lp-trk-list" data-sched data-date="${esc(ctx.bp.meta.date)}" tabindex="0" aria-label="${esc(s.title || '일정')}">${s.items.map((i, n) => `<li${schedAttr(i, mins[n])}><span class="lp-trk-no" aria-hidden="true">${n + 1}</span><time>${whenText(i)}</time><h3>${esc(i.title)}</h3>${i.desc ? `<p>${esc(i.desc)}</p>` : ''}<span class="lp-trk-min">${[i.part ? esc(i.part) : '', `${mins[n]}분`].filter(Boolean).join(' · ')}</span></li>`).join('')}</ol></div>`,
    /* 시계판: 한 바퀴가 연수 전체. 순서마다 길이만큼의 호 */
    clock: (s, ctx, { mins }) => { const T = mins.reduce((a, b) => a + b, 0), h = Math.floor(T / 60), m = T % 60; return `<div class="lp-clk" data-diagram data-linked><div class="lp-clk-face" aria-hidden="true">${clockSvg(s.items.map((i, n) => ({ start: i.start, title: i.title, min: mins[n] })), (r) => REST.test(r.title))}<p class="lp-clk-center">${h ? `<b>${h}</b><span>시간</span>` : ''}${m ? `<b>${m}</b><span>분</span>` : ''}</p></div><ol class="lp-clk-list" data-sched data-date="${esc(ctx.bp.meta.date)}">${s.items.map((i, n) => `<li${schedAttr(i, mins[n])}><i class="lp-clk-key ${REST.test(i.title) ? 'is-rest' : `c${n % 4}`}" aria-hidden="true"></i><time>${whenText(i)}</time><div><h3>${esc(i.title)}</h3>${i.desc ? `<p>${esc(i.desc)}</p>` : ''}</div><span class="lp-clk-min">${mins[n]}분</span></li>`).join('')}</ol></div>`; },
    /* 시간표: 시간 | 순서 | 내용 | 길이. 좁은 화면에서는 줄마다 카드 */
    table: (s, ctx, { mins }) => { const hasDesc = s.items.some((i) => i.desc), hasMin = mins.some(Boolean) || s.items.some((i) => i.part); return `<div class="lp-tbl-wrap" data-mode="cards"><table class="lp-tbl lp-stbl" data-sched data-date="${esc(ctx.bp.meta.date)}"><thead><tr><th scope="col">시간</th><th scope="col">순서</th>${hasDesc ? '<th scope="col">내용</th>' : ''}${hasMin ? '<th scope="col">길이</th>' : ''}</tr></thead><tbody>${s.items.map((i, n) => `<tr${schedAttr(i, 0)}><th scope="row"><time>${i.date ? `<small>${esc(koDate(i.date))}</small> ` : ''}${esc(i.start)}${i.end ? `~${esc(i.end)}` : ''}</time></th><td class="lp-stbl-t">${esc(i.title)}</td>${hasDesc ? `<td${i.desc ? '' : ' data-empty'}>${esc(i.desc)}</td>` : ''}${hasMin ? `<td class="lp-stbl-m"${i.part || mins[n] ? '' : ' data-empty'}>${[i.part ? esc(i.part) : '', mins[n] ? `${mins[n]}분` : ''].filter(Boolean).join(' · ')}</td>` : ''}</tr>`).join('')}</tbody></table></div>`; },
    /* 블록 쌓기: 길이만큼 높은 색 블록(하루 달력처럼). 쉬는 시간은 빗금 */
    blocks: (s, ctx, { mins }) => `<ol class="lp-blk" data-sched data-diagram data-art data-date="${esc(ctx.bp.meta.date)}">${s.items.map((i, n) => `<li class="${REST.test(i.title) ? 'is-rest' : `c${n % 3}`}"${schedAttr(i, mins[n])}><time>${whenText(i)}</time><div><h3>${esc(i.title)}</h3>${i.desc ? `<p>${esc(i.desc)}</p>` : ''}</div><span class="lp-blk-min">${[i.part ? esc(i.part) : '', `${mins[n]}분`].filter(Boolean).join(' · ')}</span></li>`).join('')}</ol>`,
  };

  // ── 도구 ─────────────────────────────────────────────────
  const toolName = (t) => (t.url ? `<a ${href(t.url)}>${esc(t.name)}${icon('external')}</a>` : esc(t.name));
  const toolPages = (t, ctx) => (t.pages.length ? `<span class="lp-pages">교재 ${t.pages.map((p) => (hasDeck(ctx) ? `<a href="#deck-p${p}">${p}</a>` : esc(p))).join('·')}쪽</span>` : '');
  const notice = (s) => (s.notice ? `<p class="lp-note">${br(s.notice)}</p>` : '');
  VB.tools = {
    /* 줄 색인: 번호 | 큰 이름 | 설명 | 주소 */
    rows: (s, ctx) => `<ol class="lp-trw"${fx(ctx, 'list')}>${s.items.map((t, n) => `<li><span class="lp-trw-no" aria-hidden="true">${pad2(n + 1)}</span><h3>${toolName(t)}</h3><div class="lp-trw-d">${t.desc ? `<p>${esc(t.desc)}</p>` : ''}${toolPages(t, ctx)}</div>${t.url ? `<span class="lp-tools-host">${esc(host(t.url))}</span>` : ''}</li>`).join('')}</ol>${notice(s)}`,
    /* 표 타일: 이름이 크게 적힌 표 한 장, 점선 아래 떼는 쪽에 주소(이름 첫 글자 딱지 같은 가짜 로고는 쓰지 않음) */
    tiles: (s, ctx) => `<ol class="lp-tt" style="--n:${s.items.length}"${groupFx(ctx)}>${s.items.map((t, n) => `<li class="c${n % 3}"${itemFx(ctx)}><h3>${toolName(t)}</h3>${t.url ? `<span class="lp-tools-host">${esc(host(t.url))}</span>` : ''}${t.desc ? `<p>${esc(t.desc)}</p>` : ''}${toolPages(t, ctx)}</li>`).join('')}</ol>${notice(s)}`,
  };

  // ── 자료·연수 후 안내(같은 배치): rows = [{ kind, title, desc, size, url, download }] ──
  const fileBtn = (m) => (m.url ? `<a class="lp-btn lp-btn-ghost lp-btn-sm" ${href(m.url)}${m.download ? ' download' : ''}>${icon(m.download ? 'download' : /^https?:/.test(m.url) ? 'external' : 'arrow')}<span>${m.download ? '내려받기' : '열기'}</span></a>` : '');
  const fileRow = (m, cls = '') => `<li${cls}><span class="lp-file-kind">${esc(m.kind)}</span><div><h3>${esc(m.title)}</h3>${m.desc ? `<p>${br(m.desc)}</p>` : ''}${m.size ? `<small>${esc(m.size)}</small>` : ''}</div>${fileBtn(m)}</li>`;
  VB.materials = {
    /* 책장: 자료 제목이 책등으로 꽂힌 그림(꾸밈) + 그 아래 두 단 목록 */
    shelf: (s, ctx, { rows }) => `<div class="lp-shelfw" data-linked><div class="lp-shelf" data-art aria-hidden="true">${rows.map((m, n) => `<span class="lp-book c${n % 4}" data-seg style="--i:${n};--h:${62 + ((n * 37 + m.title.length * 11) % 38)};--w:${[1, 1.35, 0.8, 1.15, 0.95][(n + m.title.length) % 5]}"><b>${esc(m.title)}</b><i>${esc(m.kind)}</i></span>`).join('')}</div><ul class="lp-shelf-list"${fx(ctx, 'list')}>${rows.map((m) => fileRow(m)).join('')}</ul></div>`,
    /* 파일 더미: 종이가 겹친 카드(뒤에 두 장이 비스듬히). 가리키면 반듯해짐 */
    pile: (s, ctx, { rows }) => `<ul class="lp-pile" style="--n:${rows.length}"${fx(ctx, 'list')}>${rows.map((m, n) => fileRow(m, ` style="--i:${n}"`)).join('')}</ul>`,
  };

  // ── 강사 ─────────────────────────────────────────────────
  const person = (p, ctx) => ({
    avatar: p.photo ? `<img class="lp-avatar" src="${esc(p.photo)}" alt="${esc(p.name)} 사진">` : `<span class="lp-avatar lp-avatar-text" aria-hidden="true">${esc([...p.name][0] || '')}</span>`,
    role: p.role || p.org ? `<p class="lp-person-role">${esc([p.org, p.role].filter(Boolean).join(' '))}</p>` : '',
    tags: tags(p.tags), bio: p.bio ? `<p class="lp-person-bio">${br(p.bio)}</p>` : '',
    contact: p.email && p.showEmail ? `<div class="lp-contact"><span class="lp-email">${esc(p.email)}</span><button class="lp-btn lp-btn-sm lp-btn-ghost" type="button" data-copy-text="${esc(p.email)}">${icon('copy')}<span>주소 복사</span></button></div>` : '',
    links: p.links.length ? `<div class="lp-person-links">${p.links.map((l) => `<a class="lp-link" ${href(l.url)}>${esc(l.label || host(l.url))}${icon('external')}</a>`).join('')}</div>` : '',
    groups: p.timeline.map((g) => `<div class="lp-tl-group"><h4>${esc(g.group)}</h4><ul>${g.items.map((it) => `<li><span>${it.url ? `<a ${href(it.url)}>${esc(it.text)}</a>` : esc(it.text)}</span>${it.year ? `<small>${esc(it.year)}</small>` : ''}</li>`).join('')}</ul></div>`),
    ctx,
  });
  VB.instructor = {
    /* 명함: 테두리 카드 한 장(이름·소속·연락처) + 그 아래 이력을 옆으로 나란히 */
    card: (s, ctx) => ctx.bp.instructors.map((p) => { const P = person(p, ctx); return `<div class="lp-bcw"><div class="lp-bc">${P.avatar}<div class="lp-bc-id"><h3>${esc(p.name)}</h3>${P.role}${P.tags}</div><div class="lp-bc-reach">${P.contact}${P.links}</div></div>${P.bio}${P.groups.length ? `<div class="lp-bc-tl" style="--n:${P.groups.length}">${P.groups.join('')}</div>` : ''}</div>`; }).join(''),
    /* 큰 얼굴: 사진(없으면 이름 첫 글자와 모티프 그림)이 한쪽을 채우고, 소개말이 크게 */
    portrait: (s, ctx) => ctx.bp.instructors.map((p, n) => { const P = person(p, ctx); return `<div class="lp-pt"><div class="lp-pt-face${p.photo ? ' has-img' : ''}" data-art${p.photo ? '' : ' aria-hidden="true"'}>${p.photo ? `<img src="${esc(p.photo)}" alt="${esc(p.name)} 사진" loading="lazy">` : `${motif(ctx, `${s.id}face${n}`, { w: 360, h: 440 })}<span class="lp-pt-glyph">${esc([...p.name][0] || '')}</span>`}</div><div class="lp-pt-body"><h3>${esc(p.name)}</h3>${P.role}${p.bio ? `<p class="lp-pt-bio">${br(p.bio)}</p>` : ''}${P.tags}${P.contact}${P.links}${P.groups.length ? `<div class="lp-timeline">${P.groups.join('')}</div>` : ''}</div></div>`; }).join(''),
  };
  VB.speakers = {
    /* 발표 순서 줄: 시간 | 이름·소속 | 발표 제목 */
    lineup: (s) => `<ol class="lp-lineup">${s.items.map((p) => `<li><span class="lp-lineup-t">${p.time ? esc(p.time) : ''}</span>${p.photo ? `<img class="lp-avatar" src="${esc(p.photo)}" alt="${esc(p.name)} 사진" loading="lazy">` : `<span class="lp-avatar lp-avatar-text" aria-hidden="true">${esc([...p.name][0] || '')}</span>`}<div><h3>${esc(p.name)}</h3><p class="lp-person-role">${esc([p.org, p.role].filter(Boolean).join(' '))}</p></div>${p.talk ? `<p class="lp-lineup-talk">${esc(p.talk)}</p>` : ''}</li>`).join('')}</ol>`,
  };

  // ── 차시 ─────────────────────────────────────────────────
  const sessLi = (s, x, label, inner) => `<li id="${esc(s.id)}-${x.no}" data-status="${esc(x.status)}"${x.date ? ` data-date="${esc(x.date)}"` : ''}>${inner}<span class="lp-chip" data-session-chip${x.status ? '' : ' hidden'}>${x.status ? label[x.status] : ''}</span></li>`;
  const sessBody = (x) => `<h3>${esc(x.title)}</h3>${x.desc ? `<p>${esc(x.desc)}</p>` : ''}${x.links.length ? `<div class="lp-st-links">${x.links.map((l) => `<a class="lp-link" ${href(l.url)}>${esc(l.label || '열기')}${icon('arrow')}</a>`).join('')}</div>` : ''}`;
  const SL = { done: '마침', now: '진행 중', next: '다음' };
  VB.sessions = {
    /* 진행 지도: 차시가 한 줄의 길 위에 점으로. 지난 차시는 채워지고 지금 차시는 크게 */
    map: (s, ctx, { auto }) => `<ol class="lp-smap" data-diagram data-art${auto ? ' data-sessions-auto' : ''} style="--n:${s.items.length}">${s.items.map((x) => sessLi(s, x, SL, `<span class="lp-smap-dot" aria-hidden="true">${x.no}</span><div class="lp-smap-b">${x.date ? `<small>${esc(koDate(x.date))}</small>` : `<small>${x.no}차시</small>`}${sessBody(x)}</div>`)).join('')}</ol>`,
    /* 달력 칸: 날짜를 크게 쓴 칸 */
    grid: (s, ctx, { auto }) => `<ol class="lp-sgrid"${auto ? ' data-sessions-auto' : ''}>${s.items.map((x) => { const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(x.date || ''); return sessLi(s, x, SL, `<p class="lp-sgrid-d">${d ? `<b>${+d[2]}.${+d[3]}</b><span>${esc(koDate(x.date).replace(/^.*\(|\).*$/g, '') || '')}</span>` : `<b>${x.no}</b><span>차시</span>`}</p><div class="lp-sgrid-b">${d ? `<small>${x.no}차시</small>` : ''}${sessBody(x)}</div>`); }).join('')}</ol>`,
  };

  // ── 자주 묻는 질문 ───────────────────────────────────────
  VB.faq = {
    /* 두 단 펼침: 질문과 답을 모두 펼쳐 두 단으로 */
    twocol: (s) => `<dl class="lp-fq2">${s.items.map((i, n) => `<div><dt><span class="lp-fq2-q" aria-hidden="true">Q${n + 1}</span>${esc(i.q)}</dt><dd>${md(i.a)}</dd></div>`).join('')}</dl>`,
    /* 질문 색인: 왼쪽에 붙박이 질문 색인(누르면 그 답으로), 오른쪽에 질문과 답이 모두 펼쳐짐. 읽는 자리의 질문이 색인에서 켜짐 */
    index: (s) => `<div class="lp-fqi" data-spy><nav class="lp-fqi-nav" aria-label="${esc(s.title || '자주 묻는 질문')} 색인"><ol>${s.items.map((i, n) => `<li><a href="#${esc(s.id)}-q${n}"><span class="lp-fqi-n" aria-hidden="true">Q${n + 1}</span><span>${esc(i.q)}</span></a></li>`).join('')}</ol></nav><div class="lp-fqi-list">${s.items.map((i, n) => `<div class="lp-fqi-item" id="${esc(s.id)}-q${n}"><h3><span class="lp-fqi-n" aria-hidden="true">Q${n + 1}</span>${esc(i.q)}</h3><div class="lp-fqi-a">${md(i.a)}</div></div>`).join('')}</div></div>`,
  };

  // ── 용어 ─────────────────────────────────────────────────
  VB.glossary = {
    /* 낱말 카드: 큰 첫 글자가 뒤에 깔린 카드 */
    cards: (s, ctx) => `<dl class="lp-gcards"${groupFx(ctx)}>${s.items.map((i, n) => `<div class="c${n % 3}"${itemFx(ctx)}><span class="lp-gl-mark" aria-hidden="true">${esc([...i.term.trim()][0] || '')}</span><dt>${esc(i.term)}</dt><dd>${br(i.desc)}</dd></div>`).join('')}</dl>`,
    /* 사전 두 단: 낱말 굵게, 풀이는 들여쓰기 */
    dict: (s) => `<dl class="lp-dict">${s.items.map((i) => `<div><dt>${esc(i.term)}</dt><dd>${br(i.desc)}</dd></div>`).join('')}</dl>`,
    /* 낱말 그물: 연수 제목(첫 줄)을 가운데 두고 낱말이 둘레에 놓인 도식(꾸밈) + 옆에 낱말과 풀이. 도식의 번호와 목록 번호가 같음 */
    web: (s, ctx) => { const c = String(ctx.bp.meta.title || '').split(/\n|[,·:]\s/)[0].replace(/[,.·:]+$/, '').trim(); /* 제목의 앞 토막(줄바꿈·쉼표 앞) */ return `<div class="lp-gw" data-diagram data-linked style="--n:${s.items.length}"><div class="lp-gw-art" aria-hidden="true">${webSvg(s.items.length)}<span class="lp-gw-c">${esc([...c].length <= 12 ? c : firstGlyph(c))}</span>${s.items.map((i, n) => { const a = (n / s.items.length) * 2 * Math.PI - Math.PI / 2; return `<span class="lp-gw-n" data-node style="--x:${(50 + Math.cos(a) * 38).toFixed(1)}%;--y:${(50 + Math.sin(a) * 38).toFixed(1)}%"><b>${n + 1}</b>${esc([...i.term].length > 9 ? [...i.term].slice(0, 8).join('') + '…' : i.term)}</span>`; }).join('')}</div><dl class="lp-gw-list">${s.items.map((i, n) => `<div><dt><span class="lp-gw-k" aria-hidden="true">${n + 1}</span>${esc(i.term)}</dt><dd>${br(i.desc)}</dd></div>`).join('')}</dl></div>`; },
  };

  // ── 절차 ─────────────────────────────────────────────────
  const procMeta = (i) => { const m = [i.time && `<span><span class="lp-sr">시간 </span>${esc(i.time)}</span>`, i.who && `<span><span class="lp-sr">담당 </span>${esc(i.who)}</span>`].filter(Boolean).join(''); return m ? `<p class="lp-proc-meta">${m}</p>` : ''; };
  const procLi = (cls) => (i, n) => `<li style="--i:${n}"><span class="${cls}" aria-hidden="true">${pad2(n + 1)}</span><h3>${esc(i.title)}</h3>${i.desc ? `<p>${br(i.desc)}</p>` : ''}${procMeta(i)}</li>`;
  const procClose = (s) => (s.close ? `<p class="lp-note">${br(s.close)}</p>` : '');
  VB.procedure = {
    /* 단계 흐름도: 상자와 화살표 */
    flow: (s) => `<ol class="lp-pf" data-diagram data-art style="--n:${s.items.length}">${s.items.map(procLi('lp-pf-no')).join('')}</ol>${procClose(s)}`,
    /* 번호 카드: 큰 윤곽 번호가 붙은 카드 격자 */
    cards: (s) => `<ol class="lp-pc" style="--n:${s.items.length}">${s.items.map(procLi('lp-pc-no')).join('')}</ol>${procClose(s)}`,
  };

  // ── 사례 ─────────────────────────────────────────────────
  const unq = (q) => br(String(q).replace(/^[“"‘']|[”"’']$/g, ''));
  VB.cases = {
    /* 인용 카드: 말이 먼저 크게, 그 아래 누가·무슨 사례인지 */
    quote: (s) => `<div class="lp-cqs" style="--n:${s.items.length}">${s.items.map((c) => `<article class="lp-cq${c.quote ? '' : ' is-plain'}">${c.quote ? `<blockquote class="lp-cq-q"><p>${unq(c.quote)}</p>${c.cite ? `<cite>${esc(c.cite)}</cite>` : ''}</blockquote>` : ''}${c.title || c.body ? `<div class="lp-cq-b">${c.title ? `<h3>${esc(c.title)}</h3>` : ''}${c.body ? `<p>${br(c.body)}</p>` : ''}</div>` : ''}</article>`).join('')}</div>`,
    /* 붙인 쪽지: 살짝 기운 종이 쪽지(테이프) */
    notes: (s) => `<div class="lp-cns" style="--n:${s.items.length}">${s.items.map((c, n) => `<article class="lp-cn c${n % 3}" style="--i:${n}">${c.title ? `<h3>${esc(c.title)}</h3>` : ''}${c.body ? `<p>${br(c.body)}</p>` : ''}${c.quote ? `<blockquote class="lp-bq"><p>${unq(c.quote)}</p>${c.cite ? `<cite>${esc(c.cite)}</cite>` : ''}</blockquote>` : ''}</article>`).join('')}</div>`,
  };

  // ── 함께 나눌 질문 ───────────────────────────────────────
  const rules = (s) => (s.rules.length ? `<div class="lp-discuss-rules"><h3>진행 규칙</h3><ul>${s.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>` : '');
  const dNote = (s) => (s.note ? `<p class="lp-note">${br(s.note)}</p>` : '');
  VB.discuss = {
    /* 큰 물음표: 물음표 하나가 크게 서고, 질문이 큰 글자로 */
    bigq: (s) => `<div class="lp-bq2"><span class="lp-bq2-mark" data-art aria-hidden="true">?</span><ol class="lp-bq2-list">${s.items.map((q, n) => `<li><span class="lp-bq2-no" aria-hidden="true">Q${n + 1}</span><p>${esc(q)}</p></li>`).join('')}</ol>${rules(s)}</div>${dNote(s)}`,
    /* 말풍선: 질문이 좌우에서 번갈아 건네는 말풍선으로 */
    bubbles: (s) => `<div class="lp-bubw"><ol class="lp-bub">${s.items.map((q, n) => `<li style="--i:${n}"><span class="lp-bub-no" aria-hidden="true">${n + 1}</span><p>${esc(q)}</p></li>`).join('')}</ol>${rules(s)}</div>${dNote(s)}`,
  };

  // ── 표 ───────────────────────────────────────────────────
  VB.table = {
    /* 줄 카드: 한 줄이 카드 한 장(첫 칸이 제목, 나머지는 이름표 + 값) */
    rowcards: (s) => `<div class="lp-rc" role="list" aria-label="${esc(s.title || '표')}">${s.rows.map((r) => `<div role="listitem"><h3>${inlineMd(r[0] ?? '')}</h3><dl>${r.slice(1).map((c, k) => (String(c ?? '').trim() ? `<div>${s.head[k + 1] ? `<dt>${inlineMd(s.head[k + 1])}</dt>` : ''}<dd>${inlineMd(c)}</dd></div>` : '')).join('')}</dl></div>`).join('')}</div>`,
    /* 비교 열: 견주는 것마다 한 단(머리글이 단 제목, 첫 칸이 기준) */
    compare: (s) => `<div class="lp-cmp" role="list" aria-label="${esc(s.title || '표')}" style="--n:${s.head.length - 1};--rows:${s.rows.length}">${s.head.slice(1).map((h, k) => `<div role="listitem" class="c${k % 3}"><h3>${inlineMd(h)}</h3><dl>${s.rows.map((r) => `<div><dt>${inlineMd(r[0] ?? '')}</dt><dd${String(r[k + 1] ?? '').trim() ? '' : ' data-empty'}>${inlineMd(r[k + 1] ?? '') || '–'}</dd></div>`).join('')}</dl></div>`).join('')}</div>`,
  };

  // ── 교재: 쪽 색인(쪽 제목으로 찾아 들어감). 무대 옆에 놓임 ──
  VB.deck = {
    rail: (s) => `<nav class="lp-deck-idx" aria-label="교재 쪽 색인"><ol>${s.slides.map((sl) => `<li><a href="#deck-p${sl.page}"><span aria-hidden="true">${pad2(sl.page)}</span>${esc(sl.title || `${sl.page}쪽`)}</a></li>`).join('')}</ol></nav>`,
  };

  void sourceLine;
  return { VB, motif, goalMeta };
}
