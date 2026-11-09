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
