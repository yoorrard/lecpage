// 디자인 사전(참고 디자인 화면, pages/GalleryDict.jsx): 웹 디자인 용어·형식·움직임·글꼴·색·효과를 실제로 돌아가는 작은 미리보기와 함께.
// 미리보기는 sandbox iframe(srcdoc, allow-scripts만)에서 돌아요. 앱의 CSP를 그대로 물려받아 인라인 스크립트·CSS, 구글 폰트·jsDelivr 글꼴만 씀
// (바깥 그림·스크립트 없음). 글꼴은 구글 폰트 css2의 text=로 그 미리보기에 쓴 글자만 받아 가볍게.
// 항목: { id, cat, ko, en, desc(한 줄), fit(강의 사이트에 어울릴 때), tech(핵심 기법, AI에게 건넴), tags, f(구글 폰트), links(jsDelivr CSS), css, html, js, scroll(안쪽 스크롤 자동), ptr(손가락 대신 움직이는 포인터) }
import STYLE from './style.js';
import LAYOUT from './layout.js';
import UI from './ui.js';
import MOTION from './motion.js';
import TYPE from './type.js';
import COLOR from './color.js';
import EFFECT from './effect.js';
import LECTURE from './lecture.js';

export const CATEGORIES = [
  { id: 'style', ko: '스타일', en: 'Art direction', items: STYLE },
  { id: 'layout', ko: '레이아웃·구성', en: 'Layout', items: LAYOUT },
  { id: 'ui', ko: 'UI 패턴·부품', en: 'UI patterns', items: UI },
  { id: 'motion', ko: '움직임·상호작용', en: 'Motion', items: MOTION },
  { id: 'type', ko: '글꼴·타이포그래피', en: 'Typography', items: TYPE },
  { id: 'color', ko: '색', en: 'Color', items: COLOR },
  { id: 'effect', ko: '효과·질감', en: 'Effects', items: EFFECT },
  { id: 'lecture', ko: '강의 사이트 패턴', en: 'Lecture patterns', items: LECTURE },
];
export const ITEMS = CATEGORIES.flatMap((c) => c.items.map((it) => ({ ...it, cat: c.id })));
export const catOf = (id) => CATEGORIES.find((c) => c.id === id);

/** 검색: 이름·영어 용어·한 줄·태그·기법·분류(띄어쓰기·대소문자 무시) */
const norm = (s) => String(s || '').toLowerCase().replace(/[\s·・\-_/()]+/g, '');
const hay = new Map(ITEMS.map((it) => [it.id, norm([it.ko, it.en, it.desc, it.fit, it.tech, ...(it.tags || []), catOf(it.cat).ko, catOf(it.cat).en].join(' '))]));
export function searchItems(q, cat = '') {
  const words = String(q || '').trim().split(/\s+/).map(norm).filter(Boolean);
  return ITEMS.filter((it) => (!cat || it.cat === cat) && words.every((w) => hay.get(it.id).includes(w)));
}

// ── 미리보기 문서 ──
const BASE = `*,*::before,*::after{box-sizing:border-box}html,body{margin:0;height:100%}
body{font:15px/1.5 'Pretendard','Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',system-ui,sans-serif;word-break:keep-all;overflow-wrap:break-word;-webkit-font-smoothing:antialiased;overflow:hidden;color:#16140f;background:#f4f1ea}
.ctr{position:absolute;inset:0;display:grid;place-items:center;padding:clamp(14px,5vw,44px)}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
button{font:inherit;color:inherit}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:1ms!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:1ms!important;scroll-behavior:auto!important}}`;
// RM: 움직임 줄이기. ghost(el, f): 마우스가 없거나 쉬면 리사주 곡선으로 움직이는 가짜 포인터(0~1). autoScroll(el): 안쪽 스크롤을 천천히 오르내림(손대면 잠시 멈춤)
const HELP_ALL = 'var RM=matchMedia("(prefers-reduced-motion: reduce)").matches;';
const HELP_PTR = 'function ghost(el,f){var last=-9e9;el.addEventListener("pointermove",function(e){last=performance.now();var r=el.getBoundingClientRect();f((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height,true)});el.addEventListener("pointerleave",function(){last=0});(function loop(t){if(performance.now()-last>1600){var a=(t||0)/1000;f(.5+.34*Math.cos(a*.9),.5+.3*Math.sin(a*1.4),false)}if(!RM)requestAnimationFrame(loop)})(0)}';
const HELP_SCROLL = 'function autoScroll(sc){var dir=1,hold=40,user=0,pos=0;["wheel","pointerdown","touchstart","keydown"].forEach(function(k){sc.addEventListener(k,function(){user=Date.now()},{passive:true})});function step(){if(Date.now()-user>2600){var max=sc.scrollHeight-sc.clientHeight,max2=sc.scrollWidth-sc.clientWidth,v=max2>max;if(hold>0)hold--;else{pos=(v?sc.scrollLeft:sc.scrollTop)+dir*Math.max(1,(v?sc.clientWidth:sc.clientHeight)/260);if(v)sc.scrollLeft=pos;else sc.scrollTop=pos;var m=v?max2:max;if(pos>=m-1){dir=-1;hold=70}else if(pos<=0){dir=1;hold=70}}}else hold=20;requestAnimationFrame(step)}if(!RM)step()}';

/** 구글 폰트 주소(그 미리보기에 쓴 글자만) */
function fontHref(fams, text) {
  const chars = [...new Set([...text].filter((ch) => ch.charCodeAt(0) > 32))].join('') + '0123456789';
  return `https://fonts.googleapis.com/css2?${fams.map((f) => 'family=' + f.replace(/ /g, '+')).join('&')}&text=${encodeURIComponent(chars)}&display=swap`;
}
const esc = (s) => String(s).replace(/<\/(script)/gi, '<\\/$1');

/** 항목 → iframe srcdoc */
export function srcdocOf(it) {
  const text = (it.html || '') + (it.js || '') + (it.fontText || '');
  const fonts = it.f?.length ? `<link rel="stylesheet" href="${fontHref(it.f, text.replace(/<[^>]+>/g, ''))}">` : '';
  const links = (it.links || []).map((h) => `<link rel="stylesheet" href="${h}">`).join('');
  const js = HELP_ALL + (it.ptr ? HELP_PTR : '') + (it.scroll ? HELP_SCROLL : '') + (it.js || '');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${fonts}${links}<style>${BASE}${it.css || ''}</style></head><body>${it.html || ''}<script>${esc(js)}</script></body></html>`;
}
