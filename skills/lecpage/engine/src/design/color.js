// 색 계산 도구: hex 파싱, 섞기, 명도 대비(WCAG), 읽기 좋은 글자색 고르기
export function parseHex(hex) {
  let h = String(hex || '').trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export function toHex({ r, g, b }) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

export function isHex(v) { return parseHex(v) !== null; }

/** a를 b 쪽으로 t만큼 섞기 (0 = a, 1 = b) */
export function mix(a, b, t) {
  const A = parseHex(a), B = parseHex(b);
  if (!A || !B) return a;
  return toHex({ r: A.r + (B.r - A.r) * t, g: A.g + (B.g - A.g) * t, b: A.b + (B.b - A.b) * t });
}

function lin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
export function luminance(hex) {
  const c = parseHex(hex); if (!c) return 0;
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}
export function contrast(a, b) {
  const L1 = luminance(a), L2 = luminance(b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

/** 배경 위에서 더 잘 읽히는 글자색(밝은 후보/어두운 후보 중) */
export function readableOn(bg, light = '#ffffff', dark = '#111111') {
  return contrast(bg, light) >= contrast(bg, dark) ? light : dark;
}

/** fg가 bg 위에서 target 대비에 못 미치면 bg에서 멀어지는 쪽으로 조금씩 조정 */
export function ensureContrast(fg, bg, target = 4.5) {
  if (!isHex(fg) || !isHex(bg)) return fg;
  let out = fg;
  const toward = luminance(bg) > 0.4 ? '#000000' : '#ffffff';
  for (let i = 0; i < 20 && contrast(out, bg) < target; i++) out = mix(out, toward, 0.12);
  return out;
}

export function alpha(hex, a) {
  const c = parseHex(hex); if (!c) return hex;
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

// ── OKLCH: 눈에 고르게 보이는 색 공간. 기관 색 하나로 12단계 색띠를 만들 때 씁니다 ──
const cbrt = Math.cbrt;
const toLinear = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const fromLinear = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

/** hex → { l(0~1), c, h(도) } */
export function toOklch(hex) {
  const p = parseHex(hex); if (!p) return null;
  const r = toLinear(p.r), g = toLinear(p.g), b = toLinear(p.b);
  const l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(A, B);
  return { l: L, c, h: c < 1e-4 ? 0 : (Math.atan2(B, A) * 180 / Math.PI + 360) % 360 };
}
function oklchToLinear({ l, c, h }) {
  const a = c * Math.cos(h * Math.PI / 180), b = c * Math.sin(h * Math.PI / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_, -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_, -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_];
}
const inGamut = (rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
/** { l, c, h } → hex. sRGB 밖이면 밝기·색상은 두고 채도만 줄여 맞춤 */
export function fromOklch({ l, c, h }) {
  const L = Math.max(0, Math.min(1, l));
  let lo = 0, hi = Math.max(0, c), rgb = oklchToLinear({ l: L, c: hi, h });
  if (!inGamut(rgb)) {
    for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (inGamut(oklchToLinear({ l: L, c: mid, h }))) lo = mid; else hi = mid; }
    rgb = oklchToLinear({ l: L, c: lo, h });
  }
  return toHex({ r: fromLinear(Math.max(0, Math.min(1, rgb[0]))), g: fromLinear(Math.max(0, Math.min(1, rgb[1]))), b: fromLinear(Math.max(0, Math.min(1, rgb[2]))) });
}

// 단계별 밝기·채도 비율. 1~2 바탕, 3~5 연한 면, 6~8 선, 9~10 채운 색(9 = 고른 색), 11~12 글자
const RAMP_L = { light: [0.992, 0.978, 0.953, 0.927, 0.897, 0.86, 0.805, 0.725, null, null, 0.5, 0.27], dark: [0.17, 0.2, 0.245, 0.28, 0.315, 0.355, 0.415, 0.5, null, null, 0.8, 0.94] };
const RAMP_C = [0.04, 0.09, 0.2, 0.3, 0.4, 0.5, 0.62, 0.8, 1, 0.96, 0.9, 0.45];

/**
 * 색 하나 → 12단계 색띠 { light: [12 hex], dark: [12 hex] }.
 * 9단계가 고른 색(밝기가 극단이면 조금 당김), 11단계는 1단계 바탕 위에서 4.5:1 이상, 12단계는 7:1 이상입니다.
 */
export function ramp12(hex) {
  const base = toOklch(hex); if (!base) return null;
  const out = {};
  for (const theme of ['light', 'dark']) {
    const dark = theme === 'dark';
    const l9 = dark ? Math.max(0.55, Math.min(0.82, base.l)) : Math.max(0.42, Math.min(0.72, base.l));
    const l10 = dark ? Math.min(0.9, l9 + 0.045) : Math.max(0.3, l9 - 0.045);
    const steps = RAMP_L[theme].map((L, i) => fromOklch({ l: L ?? (i === 8 ? l9 : l10), c: base.c * RAMP_C[i] * (dark && i < 8 ? 0.85 : 1), h: base.h }));
    steps[10] = ensureContrast(steps[10], steps[0], 4.5);
    steps[11] = ensureContrast(steps[11], steps[0], 7);
    out[theme] = steps;
  }
  return out;
}
