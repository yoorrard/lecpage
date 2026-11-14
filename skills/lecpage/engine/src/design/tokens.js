// 프리셋(압축 팔레트) → 계약 §3의 CSS 변수로 펼치기
import { mix, alpha, ensureContrast, readableOn, isHex, contrast, luminance } from './color.js';
import { fontStack, fontAssets, fontNeeds, FONTS } from './fonts.js';
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
  // 강조색·흐린 글자는 작은 글자(번호·링크·메모)로도 쓰므로 그 글자가 놓이는 모든 바탕과 4.5:1 이상:
  // 바탕·카드·옅은 띠(--surface-2, 색 띠 섹션)·--muted. 바탕만 보면 색 띠 섹션에서 4.4:1로 떨어짐
  // 바탕 기준으로 맞춘 뒤, 남은 바탕에서 모자라면 꼭 필요한 만큼만 더 진하게(색이 크게 바뀌지 않게)
  const grounds = [p.bg, p.card, mix(p.bg, p.fg, 0.035), mix(p.bg, p.fg, 0.06)].filter(isHex);
  const worst = (c) => grounds.reduce((w, g) => (contrast(c, g) < contrast(c, w) ? g : w), grounds[0]);
  const enough = (c) => {
    const g = worst(c);
    if (!isHex(c) || !g || contrast(c, g) >= 4.5) return c;
    const to = luminance(g) > 0.4 ? '#000000' : '#ffffff';
    let lo = 0, hi = 1;
    for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (contrast(mix(c, to, m), g) >= 4.5) hi = m; else lo = m; }
    return mix(c, to, hi);
  };
  p.primary = enough(ensureContrast(p.primary, p.bg, 4.5));
  const border = p.border || mix(p.bg, p.fg, theme === 'dark' ? 0.18 : 0.14);
  const muted = enough(ensureContrast(p.muted || mix(p.fg, p.bg, 0.35), p.bg, 4.5));
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
    '--accent-2-foreground': readableOn(p.accent2 || p.accent),
    '--accent-3': p.accent3 || p.accent,
    '--accent-3-foreground': readableOn(p.accent3 || p.accent),
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
    // 숫자·영문 제목: 라틴 글꼴을 앞에, 한글(단위·낱말)은 제목 글꼴로 이어 받음
    '--font-num': f.num && FONTS[f.num] ? `'${FONTS[f.num].family}', ${fontStack(f.display)}` : fontStack(f.display),
    '--display-weight': String(f.displayWeight || 800),
    '--num-weight': String(FONTS[f.num]?.numWeight || FONTS[f.display]?.displayWeight || f.displayWeight || 800), // 숫자 글꼴에 있는 굵기(가짜 굵게 방지)
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
  // 큰 강조색 면(마무리 색 띠·교재 표지 쪽·도구 첫 칸): 밝은 화면은 강조색 그대로, 어두운 화면은 카드 바탕에 강조색을 조금 섞은 깊은 면 + 밝은 글자(눈부시지 않게)
  const light = { ...themeTokens(preset, 'light', opts) }, dark = { ...themeTokens(preset, 'dark', opts) };
  light['--band-fg'] = light['--primary-foreground']; light['--band-mix'] = '100%';
  dark['--band-fg'] = dark['--foreground']; dark['--band-mix'] = '26%';
  // 어두운 무대(교재 '무대' 배치): 밝은 화면은 글자색에 가까운 어두운 면, 어두운 화면은 바탕보다 한 단 깊은 면(밝은 띠로 뒤집히지 않게)
  light['--stage'] = mix(light['--foreground'], light['--background'], 0.06); light['--on-stage'] = light['--background'];
  dark['--stage'] = mix(dark['--background'], '#000000', 0.45); dark['--on-stage'] = dark['--foreground'];
  // 반전 띠(.lp-invert)가 어두운 화면에서 밝은 띠로 바뀌면 눈부심 → 어두운 화면에서는 한 단 떠 있는 어두운 면
  const darkRaised = { ...dark, '--background': mix(dark['--background'], dark['--foreground'], 0.06), 'color-scheme': 'dark' };
  // 어두운 장면이 정체인 디자인(밤하늘·유리 실험실·키노트 등)은 밝은 화면에서도 첫 화면과 마무리만 어두운 장면으로 가둠(본문은 밝게)
  const darkScene = preset.theme === 'dark' ? block(':root[data-theme="light"] :is(.lp-hero,.lp-closing),:root[data-theme="auto"] :is(.lp-hero,.lp-closing)', { ...dark, 'color-scheme': 'dark' }) : '';
  const fonts = { ...preset.fonts, ...(opts.fonts || {}) };
  const pair = FONT_PAIR_BY_ID[design.fontPair];
  const base = baseTokens(preset, opts);
  // 제목 굵기: 그 글꼴에 있는 굵기로(한 굵기뿐인 글꼴에 가짜 굵게가 생기지 않게). 프리셋 안 대안 글꼴(fontAlts)은 제 굵기를 가져옴
  const changed = fonts.display !== preset.fonts.display;
  const dw = FONTS[fonts.display]?.displayWeight || (changed ? design.fonts?.displayWeight || 700 : preset.fonts.displayWeight || 800);
  if (changed || FONTS[fonts.display]?.displayWeight) base['--display-weight'] = String(dw);
  // 글꼴 파일: 역할마다 실제 쓰는 굵기만(글꼴당 최대 2개)
  let assets = fontAssets([fonts.display, fonts.body, fonts.num, fonts.mono], fontNeeds(fonts, dw));
  if (pair) {
    // 글꼴 짝: key가 있으면 글꼴 목록(FONTS)의 주소·굵기 파일을 쓰고, 없으면 짝에 적힌 스타일시트를 씀
    const side = (x) => (x.key && FONTS[x.key] ? { stack: fontStack(x.key), key: x.key } : { stack: x.stack || `'${x.family}', sans-serif`, css: x.css });
    const dsp = side(pair.display), bod = side(pair.body);
    base['--font-display'] = dsp.stack; base['--font-sans'] = bod.stack;
    if (fonts.num && FONTS[fonts.num]) base['--font-num'] = `'${FONTS[fonts.num].family}', ${dsp.stack}`;
    const pw = pair.display.weight || FONTS[dsp.key]?.displayWeight || 700;
    base['--display-weight'] = String(pw);
    const keyed = fontAssets([dsp.key, bod.key, fonts.num, fonts.mono], fontNeeds({ display: dsp.key, body: bod.key, num: fonts.num, mono: fonts.mono }, pw));
    assets = { faceCss: keyed.faceCss, links: [...new Set([dsp.css, bod.css, ...keyed.links].filter(Boolean))] };
  }
  const css = [
    `/* lecpage theme: ${preset.id} */`,
    assets.faceCss.trim(),
    block(':root', base),
    // 한 굵기뿐인 장식 제목 글꼴(검은고딕·주아·도현 등)은 자간을 거의 좁히지 않음(뭉개짐 방지)
    ['display', 'hand', 'rounded'].includes(FONTS[pair ? pair.display.key || '' : fonts.display]?.kind) || (pair && pair.display.weight && pair.display.weight <= 400) ? 'html:root{--display-tracking:-.005em}' : '',
    block(':root[data-theme="light"],:root[data-theme="auto"]', { ...light, 'color-scheme': 'light' }),
    block(':root[data-theme="dark"]', { ...dark, 'color-scheme': 'dark' }),
    `@media (prefers-color-scheme: dark){${block(':root[data-theme="auto"]', { ...dark, 'color-scheme': 'dark' })}}`,
    // 톤 여정: 섹션마다 밤·새벽·낮 색을 따로 씀(밤하늘 서사 등)
    preset.variants.tones ? block(':root[data-tones] .lp-sec[data-tone="night"]', { ...dark, 'color-scheme': 'dark' }) : '',
    preset.variants.tones ? block(':root[data-tones] .lp-sec[data-tone="dawn"],:root[data-tones] .lp-sec[data-tone="day"]', { ...light, 'color-scheme': 'light' }) : '',
    // 반전 띠(.lp-invert): 밝은 쪽 안에서는 어두운 띠, 어두운 쪽 안에서는 한 단 떠 있는 어두운 면. 대비는 두 테마 모두 검사된 값
    block(':root[data-theme="light"] .lp-invert,:root[data-theme="auto"] .lp-invert', { ...dark, 'color-scheme': 'dark' }),
    block(':root[data-theme="dark"] .lp-invert', darkRaised),
    `@media (prefers-color-scheme: dark){${block(':root[data-theme="auto"] .lp-invert', darkRaised)}}`,
    darkScene,
  ].filter(Boolean).join('\n');
  return { css, fontLinks: assets.links, preset };
}

function pickFontKeys(fonts) {
  const out = {};
  for (const k of ['display', 'body', 'num', 'mono']) if (fonts[k] && FONTS[fonts[k]]) out[k] = fonts[k];
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
    'data-head': v.head || 'chapter', 'data-band': v.band || 'tint',
    // 본문 정렬 문법(왼쪽이 기본이라 왼쪽이면 속성을 두지 않음)
    ...(v.align && v.align !== 'left' ? { 'data-align': v.align } : {}),
  };
}
