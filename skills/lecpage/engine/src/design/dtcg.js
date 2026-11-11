// 디자인 토큰 내보내기: W3C Design Tokens(DTCG 2025.10) 형식 JSON.
// 사이트가 실제로 쓰는 CSS 변수(shadcn/ui 이름: --background, --primary …)와 같은 값을 담아,
// 다른 도구(Figma 변수·Style Dictionary 등)나 AI가 같은 규칙으로 이어서 작업할 수 있게 합니다.
import { presetWithOverrides, themeTokens, baseTokens } from './tokens.js';
import { parseHex, ramp12 } from './color.js';

const color = (hex, desc) => {
  const c = parseHex(hex); if (!c) return null;
  return { $type: 'color', $value: { colorSpace: 'srgb', components: [c.r, c.g, c.b].map((v) => +(v / 255).toFixed(4)), hex: String(hex).toLowerCase() }, ...(desc ? { $description: desc } : {}) };
};
const px = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? { $type: 'dimension', $value: { value: n, unit: 'px' } } : null; };
const ms = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? { $type: 'duration', $value: { value: n, unit: 'ms' } } : null; };
const bezier = (v) => { const m = /cubic-bezier\(([^)]+)\)/.exec(v || ''); const a = m ? m[1].split(',').map(Number) : null; return a && a.length === 4 && a.every(Number.isFinite) ? { $type: 'cubicBezier', $value: a } : null; };
const family = (v) => ({ $type: 'fontFamily', $value: String(v || '').split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean) });
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v));

const COLOR_KEYS = ['background', 'foreground', 'card', 'card-foreground', 'muted', 'muted-foreground', 'primary', 'primary-foreground', 'secondary', 'secondary-foreground', 'accent', 'accent-foreground', 'accent-2', 'accent-3', 'border', 'ring', 'surface-2', 'success', 'warning', 'danger'];
const RAMP_USE = ['바탕', '바탕(옅은 면)', '연한 면', '연한 면(올렸을 때)', '연한 면(눌렀을 때)', '가는 선', '선', '선(올렸을 때)', '채운 색(고른 색)', '채운 색(올렸을 때)', '글자', '글자(진하게)'];

/**
 * 설계도의 design → DTCG 토큰 객체.
 * @param {object} design 설계도 design(프리셋·색 조합·강조색·글꼴 등). resolveDesign 결과를 넘기면 교재 글꼴까지 반영됩니다.
 */
export function designTokens(design = {}) {
  const preset = presetWithOverrides(design);
  const opts = { accent: design.accent, fonts: design.fonts, motion: design.motion };
  const light = themeTokens(preset, 'light', opts), dark = themeTokens(preset, 'dark', opts);
  const base = baseTokens(preset, opts);
  const group = (t) => clean(Object.fromEntries(COLOR_KEYS.map((k) => [k, color(t['--' + k])])));
  const seed = design.accent && parseHex(design.accent) ? design.accent : light['--primary'];
  const ramp = ramp12(seed);
  const rampGroup = (list) => Object.fromEntries(list.map((hex, i) => [String(i + 1), color(hex, RAMP_USE[i])]));
  return {
    $description: `lecpage 디자인 토큰(${preset.id}). 사이트의 CSS 변수와 같은 값입니다. 고칠 때는 설계도(design)를 고치고 다시 빌드하세요.`,
    color: {
      light: group(light), dark: group(dark),
      ...(ramp ? { ramp: { $description: `기준 색 ${seed}에서 만든 12단계(OKLCH). 9단계가 기준 색입니다.`, light: rampGroup(ramp.light), dark: rampGroup(ramp.dark) } } : {}),
    },
    font: clean({
      display: family(base['--font-display']), body: family(base['--font-sans']), mono: family(base['--font-mono']),
      'display-weight': { $type: 'fontWeight', $value: Number(base['--display-weight']) || 700 },
    }),
    radius: clean({ base: px(base['--radius']), sm: px(base['--radius-sm']), lg: px(base['--radius-lg']) }),
    border: clean({ width: px(base['--border-w']) }),
    motion: clean({
      duration: clean({ 1: ms(base['--dur-1']), 2: ms(base['--dur-2']), 3: ms(base['--dur-3']), 4: ms(base['--dur-4']), 5: ms(base['--dur-5']) }),
      easing: clean({ out: bezier(base['--ease-out']), 'in-out': bezier(base['--ease-in-out']) }),
      scale: { $type: 'number', $value: Number(base['--motion-scale']) || 0, $description: '움직임 세기(0 없음 · 0.5 차분 · 1 보통 · 1.5 화려)' },
    }),
  };
}
