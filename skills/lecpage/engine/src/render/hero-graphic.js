// 그림이 이끄는 첫 화면(이미지·그래픽 중심): cover(번지는 파문) · mosaic(도형 모자이크) · plate(도판 잡지) · minutes(시간 점묘)
// 규칙은 hero.js와 같음: 글은 그대로 HTML, 그림은 서버가 정지 모습으로 그림, 사진이 한 장도 없어도 완성된 모습(그림은 연수 제목·일정에서 나옴).
// 교재 쪽 그림(deck.slides[].src)이 있으면 그 그림을 쓰고, 없으면 만든 그림을 씀. 본문 장치는 runtime/lecpage.css '[data-preset]' 묶음과 sections.js bodyArt.
import { esc, pad2 } from './html.js';

/** 도형 타일 하나(100×100): 모양 t(0~8) · 색 c(1~4) · 바탕 b(0~4) · 돌림 q(0~3). 색은 CSS(.lp-tile .c1 …)가 토큰으로 입힘 */
function tile(t, c, b, q, n, x, y) {
  const d = (c % 4) + 1;
  const S = [
    `<path class="c${c}" d="M0 0h100A100 100 0 0 1 0 100z"/>`, // 부채꼴
    `<path class="c${c}" d="M0 0A50 50 0 0 0 100 0z"/><path class="c${d}" d="M0 100A50 50 0 0 1 100 100z"/>`, // 반원 둘
    `<circle class="c${c}" cx="50" cy="50" r="36"/><circle class="t0" cx="50" cy="50" r="13"/>`, // 고리
    `<path class="c${c}" d="M0 0h100L0 100z"/>`, // 세모
    `<path class="c${c}" d="M0 4h100v14H0zM0 30h100v14H0zM0 56h100v14H0zM0 82h100v14H0z"/>`, // 줄무늬
    `<g class="c${c}">${[20, 50, 80].map((cy) => [20, 50, 80].map((cx) => `<circle cx="${cx}" cy="${cy}" r="8"/>`).join('')).join('')}</g>`, // 점 아홉
    `<g class="s${c}"><path d="M92 0A92 92 0 0 1 0 92"/><path d="M62 0A62 62 0 0 1 0 62"/><path d="M32 0A32 32 0 0 1 0 32"/></g>`, // 겹친 호
    `<path class="c${c}" d="M0 100A100 100 0 0 1 100 0A100 100 0 0 1 0 100z"/>`, // 잎
    `<rect class="c${c}" x="20" y="20" width="60" height="60"/><circle class="c${d}" cx="50" cy="50" r="15"/>`, // 네모 안 원
  ];
  return `<g class="lp-tile" transform="translate(${x} ${y})" style="--i:${n}"><rect class="t${b}" width="100" height="100"/><g class="lp-tile-s"><g transform="rotate(${q * 90} 50 50)">${S[t]}</g></g></g>`;
}
/** 도형 모자이크(cols × rows). 같은 씨앗이면 같은 그림. skip(x, y)가 참인 칸은 바탕만 둠 */
export function mosaicSvg(rnd, cols, rows, cls = 'lp-mosaic-svg', skip = () => false) {
  let out = '';
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const t = Math.floor(rnd() * 9), c = 1 + Math.floor(rnd() * 4), b = rnd() < 0.3 ? ((c + 1) % 4) + 1 : 0, q = Math.floor(rnd() * 4);
    out += skip(x, y) ? `<rect class="t0" x="${x * 100}" y="${y * 100}" width="100" height="100"/>` : tile(t, c, b === c ? 0 : b, q, y * cols + x, x * 100, y * 100);
  }
  return `<svg class="${cls}" viewBox="0 0 ${cols * 100} ${rows * 100}" preserveAspectRatio="xMidYMid slice" focusable="false" aria-hidden="true">${out}</svg>`;
}

/** hero.js가 건네는 조각(P)으로 구성 네 가지를 만듦 */
export function graphicHeroes(P) {
  const { org, state, h1, sub, ctas, metaDl, cell, numCell, pick, seeded, hashStr, seedOf, longDate, isoDate, dialRows, artFx, REST } = P;
  const C = {};

  /* 번지는 파문: 화면 가득한 표지. 교재 쪽 그림이 있으면 그 그림, 없으면 제목에서 나온 파문(겹친 동심원 세 벌). 글은 아래쪽 어두운 막 위에 놓임 */
  C.cover = (M) => {
    const r = seeded(hashStr(seedOf(M))), pc = (a, b) => `${Math.round(a + r() * (b - a))}%`;
    const vars = `--ax:${pc(2, 28)};--ay:${pc(74, 108)};--bx:${pc(72, 104)};--by:${pc(-10, 24)};--cx:${pc(40, 68)};--cy:${pc(100, 132)};--g1:${11 + Math.round(r() * 5)}px;--g2:${16 + Math.round(r() * 6)}px;--g3:${24 + Math.round(r() * 8)}px`;
    const img = (M.deck?.slides || []).find((x) => x.src);
    const rail = [...M.meta, ...pick(M, 'dur', 'st', 'deck')].slice(0, 4);
    return `<div class="lp-cover-art${img ? ' has-img' : ''}"${artFx(M, 'arc-ripple')} style="${vars}" aria-hidden="true">${img ? `<img src="${esc(img.src)}" alt="" decoding="async">` : ''}<i></i></div>
<div class="lp-wrap lp-hero-inner">
  <div class="lp-cover-top">${org(M)}${state(M)}</div>
  <div class="lp-cover-main">${h1(M)}<div class="lp-cover-side">${sub(M)}${ctas(M)}</div></div>
  ${rail.length ? `<dl class="lp-hero-meta lp-cover-rail">${rail.map((x) => (x.value !== undefined ? cell(x) : numCell(M, x))).join('')}</dl>` : ''}
</div>
${M.dp ? `<p class="lp-cover-spine" aria-hidden="true">${longDate(M)}${M.time ? ` · ${esc(M.time)}` : ''}</p>` : ''}`;
  };

  /* 도형 모자이크: 제목에서 나온 도형 타일 그림(5×4). 왼쪽 아래 두 칸은 날짜 딱지. 타일에 마우스를 올리면 돌아감(CSS) */
  C.mosaic = (M) => {
    const date = M.dp && !M.custom ? `<p class="lp-mosaic-date"><time datetime="${isoDate(M)}"><b>${M.dp.m}.${M.dp.d}</b><span>${M.dp.w}요일${M.time ? ` · ${esc(M.time)}` : ''}</span></time></p>` : '';
    const art = `<div class="lp-mosaic">${mosaicSvg(seeded(hashStr(seedOf(M))), 5, 4, 'lp-mosaic-svg', (x, y) => !!date && y === 3 && x < 2)}${date}</div>`;
    return `<div class="lp-wrap lp-hero-inner">
  <div class="lp-hero-copy">${org(M)}${state(M)}${h1(M)}${sub(M)}${ctas(M)}</div>
  ${art}
  ${metaDl(date ? M.meta.filter((x) => x.k !== 'when') : M.meta)}
</div>`;
  };

  /* 도판 잡지: 표제 줄 + 큰 명조 제목 + 큰 도판 한 장(교재 첫 쪽 그림, 없으면 첫 쪽 글, 교재가 없으면 날짜). 도판에는 재단선과 캡션 */
  C.plate = (M) => {
    const sl = M.deck?.slides || [], first = sl.find((x) => x.src) || sl[0];
    const strip = (t) => String(t || '').replace(/^\s*(?:PART|Part|파트)\s*\d{1,2}\s*[.:·\-–—]?\s*/, '').trim();
    let body = '', cap = '';
    if (first?.src) { body = `<a class="lp-plate-face" href="#deck-p${first.page}"><img src="${esc(first.src)}" alt="${esc(`${first.page}쪽: ${strip(first.title)}`)}" decoding="async"></a>`; cap = `교재 ${first.page}쪽${first.title ? ` · ${esc(strip(first.title))}` : ''}`; }
    else if (first) { const tx = String(first.text || ''); body = `<a class="lp-plate-face lp-plate-text" href="#deck-p${first.page}"><span class="lp-plate-pg" aria-hidden="true">${pad2(first.page)}</span><b>${esc(strip(first.title) || `${first.page}쪽`)}</b>${tx ? `<span class="lp-plate-tx">${esc([...tx].length > 84 ? [...tx].slice(0, 82).join('') + '…' : tx)}</span>` : ''}</a>`; cap = `교재 ${first.page}쪽`; }
    else if (M.dp) { body = `<div class="lp-plate-face lp-plate-day" aria-hidden="true"><b>${pad2(M.dp.m)}.${pad2(M.dp.d)}</b><span>${M.dp.w}요일${M.time ? ` · ${esc(M.time)}` : ''}</span></div>`; cap = esc(longDate(M)); }
    const fig = body ? `<figure class="lp-plate">${body}<figcaption><span>도판 1</span>${cap}</figcaption></figure>` : '';
    return `<div class="lp-wrap lp-hero-inner${fig ? '' : ' is-solo'}">
  <div class="lp-plate-mast">${M.org ? `<p class="lp-hero-org">${esc(M.org)}</p>` : '<span></span>'}${state(M)}${M.dp ? `<p class="lp-plate-d"><time datetime="${isoDate(M)}">${longDate(M)}</time></p>` : ''}</div>
  <div class="lp-plate-title">${h1(M)}${sub(M, 'lp-standfirst')}</div>
  ${fig}
  <div class="lp-plate-foot">${ctas(M)}${metaDl(M.custom ? M.meta : M.meta.filter((x) => x.k !== 'when' || !M.dp).concat(M.time && M.dp ? [{ k: 'time', label: '시간', value: M.time }] : []))}</div>
</div>`;
  };

  /* 시간 점묘: 연수의 1분을 점 하나로. 순서마다 제 색, 쉬는 시간은 빈 점. 옆 목록이 같은 내용의 글(점은 꾸밈). 일정이 없으면 차례·실습을 한 줄씩 */
  C.minutes = (M) => {
    const D = dialRows(M);
    let art = '';
    if (D) {
      const T = D.rows.reduce((s, r) => s + r.min, 0), unit = !D.timed ? 1 : T <= 240 ? 1 : 5;
      let dots = '';
      D.rows.forEach((r, i) => { const n = D.timed ? Math.max(1, Math.round(r.min / unit)) : 6; const cls = D.timed && REST.test(r.title) ? 'r' : 's' + (i % 4); for (let k = 0; k < n; k++) dots += `<i class="${cls}" data-s="${i}"></i>`; });
      const total = D.timed ? Math.round(T / unit) : D.rows.length * 6, cols = !D.timed ? 6 : total <= 60 ? 10 : total <= 120 ? 15 : 20;
      const key = D.timed ? `점 하나 = ${unit}분 · 모두 ${T % 60 ? `${T}분` : `${T / 60}시간`}` : `한 줄 = ${M.outline ? '차례' : '실습'} 하나`;
      art = `<div class="lp-minmap"${artFx(M, 'minute-map')} data-date="${D.timed ? esc(M.m.date) : ''}" data-start="${D.timed ? esc(D.rows[0].start) : ''}" data-unit="${unit}">
<div class="lp-min-dots" style="--cols:${cols}" aria-hidden="true">${dots}</div>
<div class="lp-min-side"><ol class="lp-min-legend" aria-label="${D.timed ? '오늘의 일정' : '오늘의 차례'}">${D.rows.map((r, i) => `<li data-s="${i}"><a href="${esc(D.href)}"><i class="${D.timed && REST.test(r.title) ? 'r' : 's' + (i % 4)}" aria-hidden="true"></i>${r.start ? `<time>${esc(r.start)}</time>` : ''}<span>${esc(r.title)}</span>${D.timed ? `<small>${r.min}분</small>` : ''}</a></li>`).join('')}</ol><p class="lp-min-key" aria-hidden="true">${key}</p></div></div>`;
    }
    return `<div class="lp-wrap lp-hero-inner${art ? '' : ' is-solo'}">
  <div class="lp-min-top">${org(M)}${state(M)}${M.dp ? `<p class="lp-min-d"><time datetime="${isoDate(M)}">${M.dp.y}-${pad2(M.dp.m)}-${pad2(M.dp.d)} ${M.dp.w}</time></p>` : ''}</div>
  <div class="lp-hero-copy">${h1(M)}${sub(M)}${ctas(M)}${metaDl(M.meta.filter((x) => x.k !== 'when' || !M.dp || !art))}</div>
  ${art}
</div>`;
  };
  return C;
}
