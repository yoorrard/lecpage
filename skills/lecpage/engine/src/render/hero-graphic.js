// 배치가 다른 첫 화면 여섯 가지(왼쪽 정렬이 아닌 문법): 글 정렬·그림이 이끄는 구성·세로쓰기·어긋난 격자·반반 화면
//   ripple(번지는 파문, 가운데 정렬) · minutes(시간 점묘, 자료 그림) · mosaic(도형 모자이크, 반반 화면)
//   cover(표지 한 장, 그림 가득) · vertical(세로쓰기, 오른쪽 정렬) · offset(어긋난 격자, 계단식 제목)
// 규칙은 hero.js와 같음: 글은 그대로 HTML, 그림은 서버가 정지 모습으로 그림, 사진이 한 장도 없어도 완성된 모습(그림은 연수 제목·일정에서 나옴).
// 본문 문법은 프리셋 variants.align → <html data-align>(runtime/lecpage.css '본문 정렬 문법').
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
/** 도형 모자이크(cols × rows). 같은 씨앗이면 같은 그림. 이웃한 칸에 같은 모양이 이어지지 않게 고름 */
export function mosaicSvg(rnd, cols, rows, cls = 'lp-mosaic-svg') {
  let out = ''; const prev = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    let t = Math.floor(rnd() * 9); const up = prev[(y - 1) * cols + x], left = x ? prev[y * cols + x - 1] : -1;
    if (t === up || t === left) t = (t + 1 + Math.floor(rnd() * 7)) % 9;
    if (t === up || t === left) t = (t + 1) % 9;
    prev[y * cols + x] = t;
    const c = 1 + Math.floor(rnd() * 4), b = rnd() < 0.3 ? ((c + 1) % 4) + 1 : 0, q = Math.floor(rnd() * 4);
    out += tile(t, c, b === c ? 0 : b, q, y * cols + x, x * 100, y * 100);
  }
  return `<svg class="${cls}" viewBox="0 0 ${cols * 100} ${rows * 100}" preserveAspectRatio="xMidYMid slice" focusable="false" aria-hidden="true">${out}</svg>`;
}

/** 번지는 파문의 씨앗 값: 물결이 번져 나오는 자리 셋 [cx, cy, 간격, 첫 반지름, 진하기, 고리 수] — arc-ripple.js가 같은 값을 읽음(data-r) */
export function rippleScene(rnd) {
  return [
    [600 + (rnd() - 0.5) * 70, 392 + (rnd() - 0.5) * 44, 50 + rnd() * 14, 26, 0.5, 11],
    [60 + rnd() * 260, 600 + rnd() * 190, 30 + rnd() * 10, 14, 0.44, 13],
    [900 + rnd() * 250, -10 + rnd() * 180, 36 + rnd() * 10, 18, 0.44, 12],
  ].map((s) => s.map((v) => Math.round(v * 10) / 10));
}
/** 고리 하나의 진하기: 안쪽에서 서서히 나타나 바깥으로 갈수록 옅어짐(k = 고리 번호 + 흐른 정도) */
export const rippleAlpha = (k, n, A) => Math.max(0, A * Math.min(1, k / 1.2) * Math.pow(Math.max(0, 1 - k / n), 1.15));
export function rippleArt(rnd, attr = '') {
  const g = rippleScene(rnd).map(([cx, cy, gap, base, A, n], i) => {
    const q = (i * 0.33) % 1; // 물결마다 번지는 박자가 다름(arc-ripple.js와 같은 값)
    let c = ''; for (let k = 0; k < n; k++) c += `<circle r="${(base + (k + q) * gap).toFixed(1)}" opacity="${rippleAlpha(k + q, n, A).toFixed(3)}"/>`;
    return `<g class="lp-rip-g${i}" transform="translate(${cx} ${cy})" data-r="${cx} ${cy} ${gap} ${base} ${A}">${c}</g>`;
  }).join('');
  return `<div class="lp-rip"${attr} aria-hidden="true"><svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" focusable="false">${g}</svg></div>`;
}

/** 세로쓰기 제목의 줄(= 세로 단) 나누기. 줄바꿈이 있으면 그대로, 없으면 낱말을 8자 안팎으로 묶음. 라틴 글자가 길거나 줄이 너무 길면 null(가로로 씀) */
export function verticalLines(title) {
  const t = String(title || '').trim();
  if (/[A-Za-z]{5,}/.test(t)) return null;
  let lines = t.split('\n').map((x) => x.trim()).filter(Boolean);
  if (lines.length === 1) {
    const out = ['']; for (const w of lines[0].split(/\s+/)) { const cur = out[out.length - 1]; if (cur && [...cur].length + [...w].length + 1 > 8) out.push(w); else out[out.length - 1] = cur ? `${cur} ${w}` : w; }
    lines = out;
  }
  if (lines.length > 4 || lines.some((l) => [...l].length > 11)) return null;
  return lines;
}

/** hero.js가 건네는 조각(P)으로 구성 여섯 가지를 만듦 */
export function graphicHeroes(P) {
  const { org, state, h1, sub, ctas, metaDl, cell, numCell, pick, seeded, hashStr, seedOf, longDate, shortDate, isoDate, dialRows, artFx, fx, REST } = P;
  const C = {};
  const rail = (M, cls, n = 4, ...ks) => { const r = [...M.meta, ...pick(M, ...ks)].slice(0, n); return r.length ? `<dl class="lp-hero-meta ${cls}">${r.map((x) => (x.value !== undefined ? cell(x) : numCell(M, x))).join('')}</dl>` : ''; };

  /* 번지는 파문: 모든 글이 가운데 축에. 뒤에서 물결 고리 세 벌이 번져 서로 겹침(제목에서 나온 자리). 효과(arc-ripple)가 실리면 고리가 번지고 누른 자리에서 새 물결이 생김 */
  C.ripple = (M) => `${rippleArt(seeded(hashStr(seedOf(M))), artFx(M, 'arc-ripple'))}
<div class="lp-wrap lp-hero-inner">
  <div class="lp-rip-top">${org(M)}${state(M)}</div>
  ${h1(M)}${sub(M)}${ctas(M)}
  ${rail(M, 'lp-rip-rail', 4, 'dur', 'st', 'deck')}
</div>`;

  /* 시간 점묘: 연수의 1분이 점 하나. 한 줄이 15분·30분·한 시간이고 순서마다 제 색, 쉬는 시간은 빈 점. 옆 목록이 같은 내용의 글(점은 꾸밈). 일정이 없으면 차례·실습을 한 줄씩 */
  C.minutes = (M) => {
    const D = dialRows(M);
    let art = '';
    if (D) {
      const T = D.rows.reduce((s, r) => s + r.min, 0), unit = !D.timed ? 1 : T <= 240 ? 1 : 5;
      const cells = []; // [색 번호(쉬는 시간은 r), 순서 번호]
      D.rows.forEach((r, i) => { const n = D.timed ? Math.max(1, Math.round(r.min / unit)) : 8; for (let k = 0; k < n; k++) cells.push(`<i class="${D.timed && REST.test(r.title) ? 'r' : 'c' + (i % 4)} g${i}"></i>`); });
      const per = !D.timed ? 8 : (unit === 1 ? [15, 20, 30, 60] : [12, 24]).find((c) => Math.ceil(cells.length / c) <= 6) || (unit === 1 ? 60 : 24);
      const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : 0; }, hhmm = (n) => `${pad2(Math.floor(n / 60) % 24)}:${pad2(n % 60)}`;
      let rows = '';
      for (let a = 0, n = 0; a < cells.length; a += per, n++) rows += `<div class="lp-min-row">${D.timed ? `<time>${hhmm(toMin(D.rows[0].start) + a * unit)}</time>` : `<time>${pad2(n + 1)}</time>`}<span class="lp-min-dots" style="--c:${per}">${cells.slice(a, a + per).join('')}</span></div>`;
      const key = D.timed ? `점 하나 = ${unit}분 · 한 줄 = ${per * unit >= 60 ? `${(per * unit) / 60}시간` : `${per * unit}분`}` : `한 줄 = ${M.outline ? '차례' : '실습'} 하나`;
      art = `<div class="lp-minmap"${artFx(M, 'minute-map')} data-date="${D.timed ? esc(M.m.date) : ''}" data-start="${D.timed ? esc(D.rows[0].start) : ''}" data-unit="${unit}">
<div class="lp-min-field" data-c="${per}" aria-hidden="true">${rows}</div>
<div class="lp-min-side"><ol class="lp-min-legend" aria-label="${D.timed ? '오늘의 일정' : '오늘의 차례'}">${D.rows.map((r, i) => `<li data-g="${i}"><a href="${esc(D.href)}"><i class="${D.timed && REST.test(r.title) ? 'r' : 'c' + (i % 4)}" aria-hidden="true"></i>${r.start ? `<time>${esc(r.start)}</time>` : ''}<span>${esc(r.title)}</span>${D.timed ? `<small>${r.min}분</small>` : ''}</a></li>`).join('')}</ol><p class="lp-min-key" data-min-key aria-hidden="true">${key}</p></div></div>`;
    }
    return `<div class="lp-wrap lp-hero-inner${art ? '' : ' is-solo'}">
  <div class="lp-min-top">${org(M)}${state(M)}${M.dp ? `<p class="lp-min-d"><time datetime="${isoDate(M)}">${M.dp.y}-${pad2(M.dp.m)}-${pad2(M.dp.d)} ${M.dp.w}</time></p>` : ''}</div>
  <div class="lp-hero-copy">${h1(M)}${sub(M)}${ctas(M)}</div>
  ${art}
  ${metaDl(M.meta.filter((x) => x.k !== 'when' || !M.dp || !art || !M.time).concat(art && M.dp && M.time ? [{ k: 'time', label: '시간', value: M.time }] : []))}
</div>`;
  };

  /* 도형 모자이크: 화면을 반으로. 한쪽은 제목에서 나온 도형 타일 그림(화면 끝까지), 한쪽은 글. 그림 모서리에 날짜 딱지. 타일에 마우스를 올리면 돌아감(CSS) */
  C.mosaic = (M) => {
    const date = M.dp && !M.custom ? `<p class="lp-mosaic-date"><time datetime="${isoDate(M)}"><b>${M.dp.m}.${M.dp.d}</b><span>${M.dp.w}요일${M.time ? ` · ${esc(M.time)}` : ''}</span></time></p>` : '';
    return `<div class="lp-mosaic">${mosaicSvg(seeded(hashStr(seedOf(M))), 5, 6)}${date}</div>
<div class="lp-wrap lp-hero-inner">
  <div class="lp-hero-copy">${org(M)}${state(M)}${h1(M)}${sub(M)}${ctas(M)}</div>
  ${metaDl(date ? M.meta.filter((x) => x.k !== 'when') : M.meta)}
</div>`;
  };

  /* 표지 한 장: 그림이 화면 위쪽을 가득 채우고 제목 판이 그림에 걸침. 교재 쪽 그림이 있으면 그 그림, 없으면 제목 첫 글자를 크게 자른 포스터(색면 + 원 + 줄) */
  C.cover = (M) => {
    const r = seeded(hashStr(seedOf(M)));
    const img = (M.deck?.slides || []).find((x) => x.src);
    const t = String(M.m.title || M.title || '').replace(/\s+/g, ' ').trim(), lat = /^[A-Za-z0-9]{2,}/.exec(t);
    const glyph = lat ? lat[0].slice(0, 2) : ([...t].find((ch) => /[\p{L}\p{N}]/u.test(ch)) || '');
    const vars = `--gx:${Math.round(40 + r() * 14)}%;--dx:${Math.round(10 + r() * 22)}%;--dy:${Math.round(22 + r() * 22)}%;--ds:${Math.round(22 + r() * 14)};--ba:${Math.round(-18 + r() * 36)}deg`;
    const fig = img ? `<figure class="lp-cover-fig has-img" aria-hidden="true"><img src="${esc(img.src)}" alt="" decoding="async"></figure>`
      : `<figure class="lp-cover-fig" style="${vars}" aria-hidden="true"><i class="lp-cover-bars"></i><i class="lp-cover-disc"></i><span class="lp-cover-glyph">${esc(glyph)}</span></figure>`;
    return `${fig}
<div class="lp-wrap lp-hero-inner">
  <div class="lp-cover-card"><div class="lp-cover-top">${org(M)}${state(M)}</div>${h1(M)}${sub(M)}${ctas(M)}</div>
  ${rail(M, 'lp-cover-rail', 4, 'dur', 'st', 'deck')}
</div>`;
  };

  /* 세로쓰기: 제목을 세로로(오른쪽에서 왼쪽으로 단이 이어짐). 뒤에 큰 원 하나, 글·버튼은 제목 옆에 오른쪽 맞춤, 날짜 도장. 라틴 글자가 긴 제목은 가로로(오른쪽 맞춤) */
  C.vertical = (M) => {
    const lines = verticalLines(M.title);
    const tcy = (s) => esc(s).replace(/(^|[^\dA-Za-z.])(\d{1,2})(?![\dA-Za-z.])/g, '$1<span class="lp-tcy">$2</span>');
    const title = lines
      ? `<h1 class="lp-h1 lp-vt-h" id="${M.id}-h"${fx(M.ctx, 'hero.title')} style="--len:${Math.max(...lines.map((l) => [...l].length))};--cols:${lines.length}">${lines.map((l, i) => `<span class="lp-vt-l${lines.length > 1 && i === lines.length - 1 ? ' lp-accent' : ''}">${tcy(l)}</span>`).join('')}</h1>`
      : h1(M);
    const seal = M.dp ? `<p class="lp-vt-seal"><time datetime="${isoDate(M)}"><b>${M.dp.m}월</b><b>${M.dp.d}일</b><span>${M.dp.w}</span></time></p>` : '';
    return `<i class="lp-vt-moon" aria-hidden="true"></i>
<div class="lp-wrap lp-hero-inner${lines ? '' : ' is-flat'}">
  <div class="lp-vt-title">${title}${seal}</div>
  <div class="lp-vt-copy">${org(M)}${state(M)}${sub(M)}${ctas(M)}</div>
  ${metaDl(M.meta)}
</div>`;
  };

  /* 어긋난 격자: 열두 칸 격자에 계단처럼 어긋난 제목(줄마다 한 칸씩 들여 씀)이 색면에 걸침. 왼쪽 가장자리에 세워 쓴 날짜, 아래에 칸을 달리한 정보·글·버튼 */
  C.offset = (M) => {
    const lines = String(M.title || '').split('\n');
    const words = lines.length > 1 ? lines : (() => { const w = lines[0].split(' ').filter(Boolean); if (w.length < 2) return lines; const cut = Math.ceil(w.length / 2); return [w.slice(0, cut).join(' '), w.slice(cut).join(' ')]; })();
    const title = `<h1 class="lp-h1 lp-off-h" id="${M.id}-h"${fx(M.ctx, 'hero.title')}>${words.map((l, i) => `<span class="lp-off-l${words.length > 1 && i === words.length - 1 ? ' lp-accent' : ''}" style="--n:${i}">${esc(l)}</span>`).join(' ')}</h1>`;
    const nums = pick(M, 'dur', 'st', 'deck', 'parts').slice(0, 2);
    return `<i class="lp-off-block" aria-hidden="true"></i>
${M.dp ? `<p class="lp-off-spine" aria-hidden="true">${M.dp.y}.${pad2(M.dp.m)}.${pad2(M.dp.d)} ${M.dp.w}${M.time ? ` — ${esc(M.time)}` : ''}</p>` : ''}
<div class="lp-wrap lp-hero-inner">
  <div class="lp-off-top">${org(M)}${state(M)}</div>
  ${title}
  <div class="lp-off-row">${metaDl(M.meta)}<div class="lp-off-copy">${sub(M)}${ctas(M)}</div>${nums.length ? `<dl class="lp-off-nums">${nums.map((x) => numCell(M, x)).join('')}</dl>` : ''}</div>
</div>`;
  };
  void longDate; void shortDate;
  return C;
}
