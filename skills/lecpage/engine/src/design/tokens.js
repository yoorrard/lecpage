// 프리셋(압축 팔레트) → 계약 §3의 CSS 변수로 펼치기
import { mix, alpha, ensureContrast, readableOn, isHex, contrast } from './color.js';
import { fontStack, fontAssets, FONTS } from './fonts.js';
import { getPreset } from './presets.js';

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
  const preset = getPreset(design.preset);
  const opts = { accent: design.accent, fonts: design.fonts && pickFontKeys(design.fonts), motion: design.motion };
  const light = themeTokens(preset, 'light', opts), dark = themeTokens(preset, 'dark', opts);
  const fonts = { ...preset.fonts, ...(opts.fonts || {}) };
  const assets = fontAssets([fonts.display, fonts.body, fonts.mono]);
  const css = [
    `/* lecpage theme: ${preset.id} */`,
    assets.faceCss.trim(),
    block(':root', baseTokens(preset, opts)),
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
