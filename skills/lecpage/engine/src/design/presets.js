// 보조 쪽(강사 화면·발표 화면·QR 안내문·접속 확인·개인정보 안내)의 틀 두 벌: 밝은 바탕(corporate-clean)과 어두운 바탕(keynote-dark).
// 사이트 색(연수 정보 theme)은 조립이 이 위에 덮습니다(kit/assemble.js auxThemeOverride). tokens.js가 CSS 변수로 펼침.
// 팔레트는 압축형(bg, fg, card, muted, primary, primaryFg, accent, accent2, accent3, heroFrom, heroTo), 글꼴은 design/fonts.js 키,
// variants는 <html data-*>(lecpage.css가 단추·상자·머리 모양을 고름), shape은 모서리·테두리·그림자.
export const PRESETS = [
  {
    id: 'corporate-clean', theme: 'light', motion: 1,
    fonts: { display: 'suit', body: 'suit', num: 'sora', mono: 'plexMono', displayWeight: 800 },
    light: { bg: '#ffffff', fg: '#0a2540', card: '#ffffff', muted: '#4f6076', primary: '#4353d9', primaryFg: '#ffffff', accent: '#ff7a59', accent2: '#8fa5ff', accent3: '#ffc247', heroFrom: '#e9edff', heroTo: '#ffffff' },
    dark: { bg: '#0a1626', fg: '#eaf0f8', card: '#11203a', muted: '#a6b4c8', primary: '#93a0ff', primaryFg: '#0a1626', accent: '#ff9a80', accent2: '#6c82ff', accent3: '#ffd166', heroFrom: '#14274a', heroTo: '#0a1626' },
    shape: { radius: 12, radiusSm: 8, radiusLg: 20, borderW: 1, shadow: 'soft' },
    variants: { hero: 'panel', head: 'chapter', band: 'tint', card: 'paper', nav: 'bar', btn: 'pill', heading: 'heavy', tones: false },
  },
  {
    id: 'keynote-dark', theme: 'dark', motion: 3,
    fonts: { display: 'wanted', body: 'wanted', num: 'geist', mono: 'jetbrains', displayWeight: 800 },
    light: { bg: '#fbfbfd', fg: '#1d1d1f', card: '#ffffff', muted: '#5c5c66', primary: '#4a3fd0', primaryFg: '#ffffff', accent: '#d9541e', accent2: '#0a77b8', accent3: '#7a4fd0', heroFrom: '#6f5cff', heroTo: '#ff8a5c' },
    dark: { bg: '#08080b', fg: '#f5f5f7', card: '#131318', muted: '#a1a1aa', primary: '#9b8cff', primaryFg: '#0b0920', accent: '#ff8a5c', accent2: '#5ad1ff', accent3: '#c9a7ff', heroFrom: '#6f5cff', heroTo: '#ff8a5c' },
    shape: { radius: 18, radiusSm: 10, radiusLg: 28, borderW: 1, shadow: 'soft' },
    variants: { hero: 'keynote', head: 'chapter', band: 'glow', card: 'glass', nav: 'pill', btn: 'pill', heading: 'display', tones: false, align: 'center' },
  },
];

export function getPreset(id) { return PRESETS.find((p) => p.id === id) || PRESETS[0]; }
