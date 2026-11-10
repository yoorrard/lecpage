// 프리셋(압축 팔레트) → 계약 §3의 CSS 변수로 펼치기
import { mix, alpha, ensureContrast, readableOn, isHex, contrast } from './color.js';
import { fontStack, fontAssets, FONTS } from './fonts.js';
import { getPreset } from './presets.js';
import { PALETTE_BY_ID, FONT_PAIR_BY_ID } from './seeds.js';

/** 색 조합(seeds) → 프리셋 압축 팔레트 모양 */
function seedPalette(seed, theme) {
  const c = seed[theme];
  const card = theme === 'light' ? mix(c.background, '#ffffff', 0.7) : mix(c.background, c.foreground, 0.06);
  return {
    bg: c.background, fg: c.foreground, card, muted: mix(c.foreground, c.background, 0.38), border: c.border,
    primary: c.primary, primaryFg: c.primaryForeground || readableOn(c.primary), accent: c.accent, accent2: c.accent2 || c.accent, accent3: c.accent3 || c.accent,
    heroFrom: c.primary, heroTo: c.accent,
  };
}
/** 디자인 설정에 색 조합이 있으면 프리셋 사본의 색을 바꿈 */
export function presetWithOverrides(design = {}) {
  const base = getPreset(design.preset);
  const seed = PALETTE_BY_ID[design.palette];
  if (!seed) return base;
  return { ...base, light: seedPalette(seed, 'light'), dark: seedPalette(seed, 'dark') };
}

const SEMANTIC = {
  light: { success: '#13794a', warning: '#a15c00', danger: '#c22f3a' },
  dark: { success: '#5fd39a', warning: '#f5b041', danger: '#ff7b85' },
};

function shadowFor(style, theme, p) {
  const dark = theme === 'dark';
  switch (style) {
    case 'paper': return dark ? '0 1px 0 rgba(255,255,255,.05), 0 2px 0 rgba(0,0,0,.4)' : '0 1px 0 rgba(0,0,0,.08), 0 3px 0 rgba(0,0,0,.04)';
    case 'glow': return `0 10px 40px ${alpha(p.primary, dark ? 0.16 : 0.18)}`;
    case 'hard': return `4px 4px 0 ${p.border || p.fg}`;
    case 'pop': return `6px 6px 0 ${alpha(p.primary, 0.28)}`;
    case 'offset': return `3px 3px 0 ${p.accent}`;
    case 'flat': return 'none';
    default: return dark ? '0 1px 0 rgba(255,255,255,.04) inset, 0 12px 32px rgba(0,0,0,.35)' : '0 1px 2px rgba(20,20,40,.06), 0 10px 28px rgba(20,20,40,.08)';
  }
}

/** 브랜드 색으로 primary 덮어쓰기(대비 보정 포함) */
function applyAccent(pal, accent, theme) {
  if (!isHex(accent)) return pal;
  const out = { ...pal };
  let primary = accent;
  if (theme === 'light') primary = ensureContrast(accent, pal.bg, 3.2);
  else primary = ensureContrast(accent, pal.bg, 3.2);
  out.primary = primary;
  out.primaryFg = readableOn(primary, '#ffffff', '#111111');
  out.heroFrom = accent;
  return out;
}

export function themeTokens(preset, theme, opts = {}) {
  let p = { ...preset[theme] };
  if (opts.accent) p = applyAccent(p, opts.accent, theme);
  // 강조색은 작은 글자(번호·링크)로도 쓰므로 바탕과 4.5:1 이상
  p.primary = ensureContrast(p.primary, p.bg, 4.5);
  const border = p.border || mix(p.bg, p.fg, theme === 'dark' ? 0.18 : 0.14);
  const muted = ensureContrast(p.muted || mix(p.fg, p.bg, 0.35), p.bg, 4.5);
  const primaryFg = contrast(p.primary, p.primaryFg) >= 4.5 ? p.primaryFg : readableOn(p.primary);
  const sem = SEMANTIC[theme];
  return {
    '--background': p.bg,
    '--foreground': p.fg,
    '--card': p.card,
    '--card-foreground': p.fg,
    '--muted': mix(p.bg, p.fg, 0.06),
    '--muted-foreground': muted,
    '--primary': p.primary,
    '--primary-foreground': primaryFg,
    '--secondary': mix(p.bg, p.fg, 0.08),
    '--secondary-foreground': p.fg,
    '--accent': p.accent,
    '--accent-foreground': readableOn(p.accent),
    '--accent-2': p.accent2 || p.accent,
    '--accent-3': p.accent3 || p.accent,
    '--border': border,
    '--ring': p.primary,
    '--surface-2': mix(p.bg, p.fg, 0.035),
    '--success': ensureContrast(sem.success, p.bg, 4.5),
    '--warning': ensureContrast(sem.warning, p.bg, 4.5),
    '--danger': ensureContrast(sem.danger, p.bg, 4.5),
    '--hero-from': p.heroFrom || p.primary,
    '--hero-to': p.heroTo || p.accent,
    '--shadow': shadowFor(preset.shape.shadow, theme, { ...p, border }),
    '--selection': alpha(p.primary, 0.28),
  };
}

export function baseTokens(preset, opts = {}) {
  const f = { ...preset.fonts, ...(opts.fonts || {}) };
  const s = preset.shape;
  return {
    '--font-sans': fontStack(f.body),
    '--font-display': fontStack(f.display),
    '--font-mono': fontStack(f.mono),
    '--display-weight': String(f.displayWeight || 800),
    '--radius': s.radius + 'px', '--radius-sm': s.radiusSm + 'px', '--radius-lg': s.radiusLg + 'px',
    '--border-w': s.borderW + 'px',
    '--ease-out': 'cubic-bezier(.16,1,.3,1)', '--ease-in-out': 'cubic-bezier(.65,0,.35,1)',
    '--dur-1': '120ms', '--dur-2': '200ms', '--dur-3': '320ms', '--dur-4': '560ms', '--dur-5': '900ms',
    '--motion-scale': String([0, 0.5, 1, 1.5][opts.motion ?? preset.motion] ?? 1),
  };
}

const block = (sel, map) => `${sel}{${Object.entries(map).map(([k, v]) => `${k}:${v}`).join(';')}}`;

/** 디자인 설정 → theme.css 문자열 + 글꼴 링크 */
export function themeCSS(design = {}) {
  const preset = presetWithOverrides(design);
  const opts = { accent: design.accent, fonts: design.fonts && pickFontKeys(design.fonts), motion: design.motion };
  const light = themeTokens(preset, 'light', opts), dark = themeTokens(preset, 'dark', opts);
  const fonts = { ...preset.fonts, ...(opts.fonts || {}) };
  const assets = fontAssets([fonts.display, fonts.body, fonts.mono]);
  const pair = FONT_PAIR_BY_ID[design.fontPair];
  const base = baseTokens(preset, opts);
  // 제목 글꼴을 바꿨으면 그 글꼴에 있는 굵기로(한 굵기뿐인 글꼴에 가짜 굵게가 생기지 않게)
  if (fonts.display !== preset.fonts.display || FONTS[fonts.display]?.displayWeight) base['--display-weight'] = String(FONTS[fonts.display]?.displayWeight || (fonts.display !== preset.fonts.display ? 700 : preset.fonts.displayWeight || 800));
  if (pair) {
    base['--font-display'] = pair.display.stack || `'${pair.display.family}', sans-serif`;
    base['--font-sans'] = pair.body.stack || `'${pair.body.family}', sans-serif`;
    if (pair.display.weight) base['--display-weight'] = String(pair.display.weight);
    assets.links = [...new Set([pair.display.css, pair.body.css, ...assets.links.filter((u) => u === FONTS[fonts.mono]?.css)].filter(Boolean))];
  }
  const css = [
    `/* lecpage theme: ${preset.id} */`,
    assets.faceCss.trim(),
    block(':root', base),
    // 한 굵기뿐인 장식 제목 글꼴(검은고딕·주아·도현 등)은 자간을 거의 좁히지 않음(뭉개짐 방지)
    ['display', 'hand'].includes(FONTS[pair ? '' : fonts.display]?.kind) || (pair && pair.display.weight && pair.display.weight <= 400) ? 'html:root{--display-tracking:-.005em}' : '',
    block(':root[data-theme="light"],:root[data-theme="auto"]', { ...light, 'color-scheme': 'light' }),
    block(':root[data-theme="dark"]', { ...dark, 'color-scheme': 'dark' }),
    `@media (prefers-color-scheme: dark){${block(':root[data-theme="auto"]', { ...dark, 'color-scheme': 'dark' })}}`,
    // 톤 여정: 섹션마다 밤·새벽·낮 색을 따로 씀(밤하늘 서사 등)
    preset.variants.tones ? block(':root[data-tones] .lp-sec[data-tone="night"]', { ...dark, 'color-scheme': 'dark' }) : '',
    preset.variants.tones ? block(':root[data-tones] .lp-sec[data-tone="dawn"],:root[data-tones] .lp-sec[data-tone="day"]', { ...light, 'color-scheme': 'light' }) : '',
  ].filter(Boolean).join('\n');
  return { css, fontLinks: assets.links, preset };
}

function pickFontKeys(fonts) {
  const out = {};
  for (const k of ['display', 'body', 'mono']) if (fonts[k] && FONTS[fonts[k]]) out[k] = fonts[k];
  return out;
}

/** <html>에 붙일 data 속성들 */
export function htmlAttrs(design = {}) {
  const preset = getPreset(design.preset);
  const v = preset.variants;
  return {
    'data-preset': preset.id,
    'data-theme': design.theme && design.theme !== 'preset' ? design.theme : preset.theme,
    'data-motion': String(design.motion ?? preset.motion),
    'data-hero': v.hero, 'data-card': v.card, 'data-nav': v.nav, 'data-btn': v.btn, 'data-heading': v.heading,
  };
}
