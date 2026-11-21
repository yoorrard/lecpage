// 디자인 사전 미리보기에서 여러 번 쓰는 조각(그림 파일 없이 data: SVG로)
/** 그레인(종이 결·잡티) */
export const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
export const grainCss = (sel = 'body', op = 0.22, blend = 'multiply') => `${sel}::after{content:"";position:fixed;inset:0;pointer-events:none;opacity:${op};mix-blend-mode:${blend};background:${GRAIN}}`;
/** 씨앗 있는 무작위(늘 같은 그림) — 미리보기 JS 앞에 붙여 씀 */
export const RND = 'var seed=7;function rnd(){seed=(seed*16807)%2147483647;return seed/2147483647}';
/** 캔버스 크기 맞추기(dpr 2까지) */
export const FIT = 'function fit(c){var d=Math.min(2,devicePixelRatio||1),r=c.getBoundingClientRect();c.width=Math.max(1,r.width*d);c.height=Math.max(1,r.height*d);var x=c.getContext("2d");x.setTransform(d,0,0,d,0,0);return {x:x,w:r.width,h:r.height}}';
