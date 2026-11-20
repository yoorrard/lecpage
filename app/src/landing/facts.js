// 첫 화면 아래 이야기에 쓰는 그림(늦게 받는 묶음). 그림은 대표 레퍼런스 사이트(AI가 교재로 만든 것)를 찍은 것(scripts/landing-shots.mjs).
// 첫 화면(HeroFold)은 이 파일을 받지 않아요(그림 목록이 첫 JS에 들지 않게): hero-shot.js·example.js
const files = import.meta.glob('./shots/*.webp', { eager: true, query: '?url', import: 'default' });
const meta = Object.values(import.meta.glob('./shots/shots.json', { eager: true, import: 'default' }))[0] || {};

/** 그림 주소(없으면 '') */
export const shot = (name) => files[`./shots/${name}.webp`] || '';
/** 그림 크기(자리를 미리 잡아 화면이 밀리지 않게) */
export const shotSize = (name) => meta[name] || { w: 1280, h: 800 };

export { EX } from './example.js';
