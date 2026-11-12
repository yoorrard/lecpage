// 본문 그림: 교재의 값(일정·목표·단계·숫자·차시)으로 그리는 도식과, 컨셉 모티프를 본문·마무리에 되풀이하는 그림.
// 모두 서버가 정지 모습으로 그린 SVG(사진·외부 그림 없음). 색은 CSS가 토큰으로 입힘(runtime/body.css .lp-motif). 내용은 옆의 글이 그대로 담고, 그림은 꾸밈(aria-hidden).
import { esc, pad2 } from './html.js';

const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const seeded = (seed) => { let a = (seed >>> 0) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const R = (v) => Math.round(v * 10) / 10;
const pickC = (r, set = 'abc') => set[Math.floor(r() * set.length)];

/** 모티프 가족마다 그리는 법: (난수, 너비, 높이, 옵션) → SVG 안쪽. 채움 a b c(주·강조·강조2) f(글자색) · 선 sa sb sc sf */
const MOTIF = {
  rings(r, w, h) {
    let o = '';
    for (let i = 0; i < 3; i++) { const cx = r() * w, cy = r() * h, gap = 13 + r() * 11, k = 5 + Math.floor(r() * 4); for (let j = 1; j <= k; j++) o += `<circle class="s${'abc'[i]}" cx="${R(cx)}" cy="${R(cy)}" r="${R(j * gap)}" opacity="${R(1 - j / (k + 1.5))}"/>`; }
    return o;
  },
  dots(r, w, h) {
    let o = `<defs><pattern id="lpm-dot" width="20" height="20" patternUnits="userSpaceOnUse"><circle class="f" cx="10" cy="10" r="2"/></pattern></defs><rect width="${w}" height="${h}" fill="url(#lpm-dot)" opacity=".5"/>`;
    const rows = Math.floor(h / 20), cols = Math.floor(w / 20);
    for (let y = 0; y < rows; y++) { let x = Math.floor(r() * cols * 0.5); const n = 2 + Math.floor(r() * (cols * 0.4)); const c = pickC(r); if (r() < 0.62) for (let k = 0; k < n && x + k < cols; k++) o += `<circle class="${c}" cx="${(x + k) * 20 + 10}" cy="${y * 20 + 10}" r="5"/>`; }
    return o;
  },
  tiles(r, w, h) {
    const s = 80, S = ['M0 0h80A80 80 0 0 1 0 80z', 'M0 0A40 40 0 0 0 80 0z', 'M0 0h80L0 80z', 'M10 10h60v60H10z', 'M40 8a32 32 0 1 0 .1 0z', 'M0 80A80 80 0 0 1 80 0A80 80 0 0 1 0 80z'];
    let o = '';
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) { if (r() < 0.16) continue; o += `<path class="${pickC(r, 'abcf')}" d="${S[Math.floor(r() * S.length)]}" transform="translate(${x} ${y}) rotate(${Math.floor(r() * 4) * 90} 40 40)"/>`; }
    return o;
  },
  waves(r, w, h) {
    let o = ''; const n = Math.max(5, Math.round(h / 34)), sx = 0.2 + r() * 0.6, sy = 0.3 + r() * 0.4;
    for (let i = 0; i < n; i++) { const y = (h / (n + 1)) * (i + 1), a = 10 + r() * 16, d = Math.abs(y - h * sy) < 40 ? 26 : 0; o += `<path class="s${i % 3 === 1 ? 'a' : 'f'}" d="M0 ${R(y)}C${R(w * sx * 0.5)} ${R(y - a)} ${R(w * sx - 40)} ${R(y + a + d)} ${R(w * sx)} ${R(y + (y < h * sy ? -d : d))}S${R(w * 0.85)} ${R(y - a)} ${w} ${R(y + a * 0.4)}" opacity="${R(0.35 + (i % 3 === 1 ? 0.5 : 0.2))}"/>`; }
    return o + `<ellipse class="b" cx="${R(w * sx)}" cy="${R(h * sy)}" rx="${R(22 + r() * 16)}" ry="${R(15 + r() * 8)}"/>`;
  },
  arcs(r, w, h) {
    let o = ''; const cx = R(w * (0.3 + r() * 0.4)), cy = R(h * (0.4 + r() * 0.3)), m = Math.min(w, h);
    for (let i = 0; i < 6; i++) { const rad = R(m * 0.14 + i * m * 0.085), len = R(18 + r() * 46); o += `<circle class="s${'abcfab'[i]}" cx="${cx}" cy="${cy}" r="${rad}" pathLength="100" stroke-dasharray="${len} 100" transform="rotate(${Math.round(r() * 360)} ${cx} ${cy})" opacity="${R(1 - i * 0.11)}"/>`; }
    return o + `<circle class="a" cx="${cx}" cy="${cy}" r="${R(m * 0.035)}"/>`;
  },
  blocks(r, w, h) {
    const u = Math.round(Math.min(w, h) / 4); let o = '';
    for (let i = 0; i < 5; i++) { const bw = (1 + Math.floor(r() * 2)) * u, bh = (1 + Math.floor(r() * 2)) * u; o += `<rect class="${'abcfa'[i]}" x="${Math.floor(r() * Math.max(1, (w - bw) / u)) * u}" y="${Math.floor(r() * Math.max(1, (h - bh) / u)) * u}" width="${bw}" height="${bh}" opacity="${i === 3 ? 0.12 : R(0.78 - i * 0.08)}"/>`; }
    return o + `<circle class="c" cx="${R(w * (0.2 + r() * 0.6))}" cy="${R(h * (0.2 + r() * 0.6))}" r="${R(u * 0.55)}"/>`;
  },
  stars(r, w, h) {
    let o = '';
    for (let i = 0; i < 30; i++) { const big = r() < 0.14; o += `<circle class="${big ? pickC(r, 'bc') : 'f'}" cx="${R(r() * w)}" cy="${R(r() * h * 0.8)}" r="${big ? R(2.4 + r() * 2) : R(0.7 + r() * 1.1)}" opacity="${R(0.35 + r() * 0.6)}"/>`; }
    return o + `<ellipse class="sa" cx="${R(w / 2)}" cy="${R(h * 1.9)}" rx="${R(w * 0.95)}" ry="${R(h * 1.05)}"/><ellipse class="sb" cx="${R(w / 2)}" cy="${R(h * 1.98)}" rx="${R(w * 0.95)}" ry="${R(h * 1.05)}" opacity=".5"/>`;
  },
  glyph(r, w, h, o = {}) {
    const g = esc(o.glyph || ''), m = Math.min(w, h);
    return `<rect class="b" x="${R(w * (0.06 + r() * 0.3))}" y="0" width="${R(w * 0.16)}" height="${h}" opacity=".9"/><circle class="c" cx="${R(w * (0.62 + r() * 0.2))}" cy="${R(h * (0.24 + r() * 0.2))}" r="${R(m * 0.17)}"/>${g ? `<text class="a lp-motif-g" x="${R(w * 0.5)}" y="${R(h * 0.86)}" font-size="${R(m * 0.98)}" text-anchor="middle">${g}</text>` : `<path class="a" d="M0 ${R(h * 0.62)}h${w}v${R(h * 0.1)}H0z"/>`}`;
  },
  grid(r, w, h) {
    let o = `<defs><pattern id="lpm-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path class="sf" d="M24 0H0V24" opacity=".28"/></pattern></defs><rect width="${w}" height="${h}" fill="url(#lpm-grid)"/>`;
    for (let i = 0; i < 3; i++) { const x = Math.floor(r() * (w / 24 - 6)) * 24, y = Math.floor(r() * (h / 24 - 4)) * 24, bw = (3 + Math.floor(r() * 4)) * 24, bh = (2 + Math.floor(r() * 3)) * 24; o += `<rect class="s${'abc'[i]}" x="${x}" y="${y}" width="${bw}" height="${bh}"/><path class="s${'abc'[i]}" d="M${x} ${y + bh + 10}h${bw}M${x} ${y + bh + 5}v10M${x + bw} ${y + bh + 5}v10"/>`; }
    return o;
  },
};
export const MOTIF_FAMILIES = Object.keys(MOTIF);
/** 컨셉 모티프 그림 한 장. 같은 씨앗이면 같은 그림. lite = 바탕에 옅게 까는 작은 판(점·타일 수를 줄여 크기를 아낌) */
export function motifSvg(family, seed, { w = 400, h = 300, cls = '', glyph = '', lite = false } = {}) {
  const f = MOTIF[family] ? family : 'rings';
  const [W, H] = lite && /^(dots|tiles|stars)$/.test(f) ? [Math.round(w * 0.6), Math.round(h * 0.6)] : [w, h];
  return `<svg class="lp-motif lp-motif--${f}${cls ? ' ' + cls : ''}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${MOTIF[f](seeded(hashStr(String(seed))), W, H, { glyph })}</svg>`;
}
/** 낱말 그물: 가운데 고리와 둘레 n개 자리로 가는 살(낱말 글자는 HTML이 얹음). 자리는 render/body-variants.js와 같은 각도 */
export function webSvg(n) {
  const pts = Array.from({ length: n }, (_, i) => { const a = (i / n) * 2 * Math.PI - Math.PI / 2; return [R(200 + Math.cos(a) * 152), R(200 + Math.sin(a) * 152)]; });
  return `<svg class="lp-gw-svg" viewBox="0 0 400 400" aria-hidden="true" focusable="false"><circle class="lp-gw-ring" cx="200" cy="200" r="152"/><circle class="lp-gw-core" cx="200" cy="200" r="62"/>${pts.map((p, i) => `<path class="lp-gw-spoke" data-seg style="--i:${i}" d="M${R(200 + (p[0] - 200) * 0.41)} ${R(200 + (p[1] - 200) * 0.41)}L${p[0]} ${p[1]}"/>`).join('')}</svg>`;
}
/** 구분 장식(인쇄소의 꽃 장식처럼 짧게): 모티프 가족의 한 줄 */
export function motifRule(family, seed) {
  const r = seeded(hashStr('rule' + seed)), w = 240, h = 24; let o = '';
  if (family === 'dots' || family === 'stars') for (let i = 0; i < 12; i++) o += `<circle class="${i % 5 === 2 ? 'a' : i % 7 === 4 ? 'b' : 'f'}" cx="${10 + i * 20}" cy="12" r="${i % 5 === 2 ? 5 : 2.4}"/>`;
  else if (family === 'tiles' || family === 'blocks') for (let i = 0; i < 6; i++) o += i % 2 ? `<circle class="${pickC(r)}" cx="${i * 40 + 12}" cy="12" r="11"/>` : `<path class="${pickC(r)}" d="M${i * 40} 0h24v24h-24z"/>`;
  else if (family === 'waves') o = '<path class="sa" d="M0 12c20-14 40-14 60 0s40 14 60 0 40-14 60 0 40 14 60 0"/><path class="sf" d="M0 19c20-14 40-14 60 0s40 14 60 0 40-14 60 0 40 14 60 0" opacity=".35"/>';
  else if (family === 'grid') o = '<path class="sf" d="M0 12h240M0 6v12M60 8v8M120 6v12M180 8v8M240 6v12" opacity=".55"/><path class="sa" d="M60 12h60"/>';
  else if (family === 'glyph') o = '<path class="a" d="M0 4h56v5H0z"/><path class="f" d="M0 14h240v1.5H0z" opacity=".5"/>';
  else for (let i = 0; i < 5; i++) o += `<path class="s${'abcab'[i]}" d="M${i * 44 + 2} 22a20 20 0 0 1 40 0" opacity="${R(1 - i * 0.14)}"/>`;
  return `<svg class="lp-motif lp-mrule" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false">${o}</svg>`;
}

/** 여정의 길 한 토막(한 정류장의 높이만큼 늘어남): 짝수 번째는 오른쪽, 홀수 번째는 왼쪽으로 굽음. last면 길이 정류장에서 끝남 */
export function roadSvg(i, last) {
  const x = i % 2 ? 22 : 78, d = `M50 0C50 26 ${x} 22 ${x} 50${last ? '' : `S50 74 50 100`}`;
  return `<svg class="lp-jr-road" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path class="lp-jr-bed" d="${d}"/><path class="lp-jr-line" pathLength="100" d="${d}"/></svg>`;
}

/** 시계판: 한 바퀴 = 전체 길이. 순서마다 길이에 비례한 호(data-seg: 지금 순서 표시와 가리킴 반응이 붙음), 바깥에 시작 시각 */
export function clockSvg(rows, rest) {
  const T = rows.reduce((s, r) => s + r.min, 0) || 1; let at = 0, segs = '', ticks = '';
  rows.forEach((r, i) => {
    const len = (r.min / T) * 1000, th = (at / 1000) * 2 * Math.PI - Math.PI / 2, c = Math.cos(th), s = Math.sin(th);
    segs += `<circle class="lp-clk-seg c${i % 4}${rest(r) ? ' is-rest' : ''}" data-seg style="--i:${i}" cx="200" cy="200" r="142" pathLength="1000" stroke-dasharray="${Math.max(1, len - 5).toFixed(1)} 1000" stroke-dashoffset="${(-(at + 2.5)).toFixed(1)}"/>`;
    if (i === 0 || len >= 60) ticks += `<text x="${(200 + c * 182).toFixed(1)}" y="${(205 + s * 184).toFixed(1)}" text-anchor="${Math.abs(c) < 0.3 ? 'middle' : c > 0 ? 'start' : 'end'}">${esc(r.start)}</text>`;
    ticks += `<path d="M${(200 + c * 160).toFixed(1)} ${(200 + s * 160).toFixed(1)}L${(200 + c * 170).toFixed(1)} ${(200 + s * 170).toFixed(1)}"/>`;
    at += len;
  });
  return `<svg viewBox="-36 -8 472 416" aria-hidden="true" focusable="false"><circle class="lp-clk-track" cx="200" cy="200" r="142"/><g transform="rotate(-90 200 200)">${segs}</g><g class="lp-clk-ticks">${ticks}</g></svg>`;
}

/** 둥근 고리: 요소 n개가 고리 위에 고르게 놓이고 서로 이어짐(다각형). 번호는 옆 목록의 번호와 같음 */
export function wheelSvg(n) {
  const pts = Array.from({ length: n }, (_, i) => { const a = (i / n) * 2 * Math.PI - Math.PI / 2; return [R(200 + Math.cos(a) * 150), R(200 + Math.sin(a) * 150)]; });
  return `<svg class="lp-wh-ring" viewBox="0 0 400 400" aria-hidden="true" focusable="false"><circle class="lp-wh-track" cx="200" cy="200" r="150"/>${n > 2 ? `<polygon class="lp-wh-web" points="${pts.map((p) => p.join(',')).join(' ')}"/>` : ''}${pts.map((p, i) => `<g class="lp-wh-node" data-seg style="--i:${i}"><circle cx="${p[0]}" cy="${p[1]}" r="27"/><text x="${p[0]}" y="${p[1] + 8}" text-anchor="middle">${pad2(i + 1)}</text></g>`).join('')}<text class="lp-wh-n" x="200" y="226" text-anchor="middle">${n}</text></svg>`;
}

/** 그림 숫자: 퍼센트는 도넛, 분·시간은 시계 고리(한 바퀴 = 60분), 40 이하의 개수는 점 묶음. 그릴 수 없는 값은 '' */
export function tallySvg(num, unit) {
  const v = parseFloat(String(num).replace(/,/g, '')); if (!Number.isFinite(v) || v <= 0) return '';
  const svg = (inner, vb = '0 0 120 120') => `<svg class="lp-tl-svg" viewBox="${vb}" aria-hidden="true" focusable="false">${inner}</svg>`;
  if (/%|퍼센트/.test(unit) && v <= 100) return svg(`<circle class="t" cx="60" cy="60" r="46"/><circle class="v" cx="60" cy="60" r="46" pathLength="100" stroke-dasharray="${R(v)} 100" transform="rotate(-90 60 60)"/>`);
  const min = /^분/.test(unit) ? v : /^시간/.test(unit) ? v * 60 : 0;
  if (min && min <= 600) {
    const turns = min / 60, full = Math.min(4, Math.floor(turns)), part = turns - Math.floor(turns); let o = '';
    for (let i = 0; i <= full && i < 5; i++) { const rad = 50 - i * 10, f = i < full ? 100 : R(part * 100); if (rad < 8 || (i === full && !f)) break; o += `<circle class="t" cx="60" cy="60" r="${rad}"/><circle class="v" cx="60" cy="60" r="${rad}" pathLength="100" stroke-dasharray="${f} 100" transform="rotate(-90 60 60)"/>`; }
    return svg(o + '<path class="h" d="M60 60V22"/><circle class="d" cx="60" cy="60" r="3.5"/>');
  }
  if (Number.isInteger(v) && v <= 40) {
    const per = v <= 5 ? v : v <= 12 ? Math.ceil(v / 2) : v <= 24 ? 6 : 8, rows = Math.ceil(v / per), g = 120 / Math.max(per, 4); let o = '';
    for (let i = 0; i < v; i++) o += `<circle class="d" cx="${R((i % per) * g + g / 2)}" cy="${R(Math.floor(i / per) * g + g / 2)}" r="${R(g * 0.32)}"/>`;
    return svg(o, `0 0 ${R(Math.max(per, 4) * g)} ${R(rows * g)}`);
  }
  return '';
}

export { hashStr, seeded };
