// 첫 화면 아래 이야기에 쓰는 사실과 그림(늦게 받는 묶음). 숫자·이름은 빌드 때 엔진에서 읽고(vite.config.js의 landingFacts), 그림은 엔진이 만든 예시 사이트를 찍은 것(scripts/landing-shots.mjs).
// 첫 화면(HeroFold)은 이 파일을 받지 않아요(그림 목록·사실이 첫 JS에 들지 않게): hero-shot.js·example.js
import facts from 'virtual:lp-facts';

const files = import.meta.glob('./shots/*.webp', { eager: true, query: '?url', import: 'default' });
const meta = Object.values(import.meta.glob('./shots/shots.json', { eager: true, import: 'default' }))[0] || {};

/** 그림 주소(없으면 '') */
export const shot = (name) => files[`./shots/${name}.webp`] || '';
/** 그림 크기(자리를 미리 잡아 화면이 밀리지 않게) */
export const shotSize = (name) => meta[name] || { w: 1280, h: 800 };
/** 같은 내용을 디자인만 바꿔 찍은 것: [{id, name, desc, src, srcM}]. srcM은 휴대폰 크기로 찍은 판(없으면 '') */
export const SHOWCASE = (meta.showcase || []).map((id) => ({ id, ...(facts.designs[id] || { name: id, desc: '' }), src: shot(`show-${id}`), srcM: shot(`show-${id}-m`) })).filter((d) => d.src);
/** 말로 고치기 체험: 예시 연수에 그 말을 넣었을 때 앱이 낸 첫 안을 적용해 찍은 것 [{text, title, why, src}] */
export const SAYS = (meta.say || []).map((x) => ({ ...x, src: shot(x.shot) })).filter((x) => x.src);
export const PRESET_COUNT = facts.presets;
export const FX_COUNT = facts.fx;
export const LAYOUT_COUNT = facts.layouts;

export { EX } from './example.js';
