// 첫 화면에 띄우는 사례 셋(skills/lecpage/references/designs/<id>/: AI가 교재 원본을 읽고 Skill 흐름 그대로 만든 강의 운영 사이트).
// 그림은 scripts/landing-shots.mjs가 public/examples/<id>/(엔진으로 조립한 실제 사이트)를 찍은 것. 순서·쪽 번호를 바꾸면 그 스크립트도 함께.
// 첫 화면 묶음에 들어가므로 글자는 짧게 여기에 두고, 분위기 설명 같은 긴 글은 data/references.js(늦게 받는 묶음)에서 읽어요.
import SIZE from './shots/shots.json';

const URLS = import.meta.glob('./shots/*.webp', { eager: true, import: 'default', query: '?url' });
const url = (name) => URLS[`./shots/${name}.webp`] || '';
const size = (name) => SIZE[name] || { w: 0, h: 0 };
/** 그림 하나: { src, w, h } */
export const shot = (name) => ({ src: url(name), ...size(name) });

/** id · 사이트 이름 · 짧은 이름(고르기 단추) · 교재 쪽수 · 결(디자인 기법) · 대표색 둘(첫 화면 뒤 빛) */
export const SHOWCASES = [
  { id: 'neo-teach', name: '질문이 먼저, AI는 그다음', short: '신경망 네온', pages: 17, kind: 'AI 시대 수업 설계 연수', look: ['WebGL 신경망', '접혀 오르는 제목', '유리 띠'], c1: '#ff6a3d', c2: '#3fb8ff', dark: true },
  { id: 'picture-heart', name: '그림책 한 장, 마음 한 뼘', short: '그림책 콜라주', pages: 16, kind: '그림책 사회정서학습 연수', look: ['찢은 종이 콜라주', '3D로 넘기는 책', '그린 캐릭터'], c1: '#e0563b', c2: '#7fae6a' },
  { id: 'data-pulse', name: '학교 데이터로 수업 바꾸기', short: '스위스 격자', pages: 16, kind: '데이터 리터러시 연수', look: ['스위스 격자', '아주 큰 숫자', '만지는 차트'], c1: '#f2441a', c2: '#9aa0a6', dark: true },
];
/** 대표 사례(neo-teach) 교재에서 쓰는 쪽(landing-shots.mjs SLIDES와 같게) */
export const SLIDES = [1, 3, 5, 8, 10, 12, 15];
export const siteUrl = (id, page = 'index.html') => `examples/${id}/${page}`;
