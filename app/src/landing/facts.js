// 첫 화면에 쓰는 사실과 그림. 숫자·이름은 빌드 때 엔진에서 읽고(vite.config.js의 landingFacts), 그림은 엔진이 만든 예시 사이트를 찍은 것(scripts/landing-shots.mjs).
import facts from 'virtual:lp-facts';

const files = import.meta.glob('./shots/*.webp', { eager: true, query: '?url', import: 'default' });
const meta = Object.values(import.meta.glob('./shots/shots.json', { eager: true, import: 'default' }))[0] || {};

/** 그림 주소(없으면 '') */
export const shot = (name) => files[`./shots/${name}.webp`] || '';
/** 그림 크기(자리를 미리 잡아 화면이 밀리지 않게) */
export const shotSize = (name) => meta[name] || { w: 1280, h: 800 };
/** 같은 내용을 디자인만 바꿔 찍은 것: [{id, name, desc, src}] */
export const SHOWCASE = (meta.showcase || []).map((id) => ({ id, ...(facts.designs[id] || { name: id, desc: '' }), src: shot(`show-${id}`) })).filter((d) => d.src);
export const PRESET_COUNT = facts.presets;
export const FX_COUNT = facts.fx;

// 예시 연수 '데이터로 읽는 우리 반'(skills/lecpage/examples/data-lab.blueprint.json)에서 옮긴 값
export const EX = {
  title: '데이터로 읽는 우리 반',
  file: '데이터로 읽는 우리 반.pdf',
  pages: 24,
  // copy-ok: 예시 연수의 한 줄 소개 원문 그대로(인용)
  lead: '흩어진 학습 기록을 표로 모으고, 차트로 읽고, 다음 수업을 바꿉니다.',
  when: '12월 16일 14:00~17:00',
  venue: '한빛교육연수원 3층',
  concept: '흩어진 기록이 점 하나하나로 모여 무늬가 되는 것을 보는 시간',
  motif: '1분을 점 하나로 찍은 시간 지도',
  design: '시간 점묘',
  // 실습 다섯 개와 근거 쪽
  stations: [['흩어진 기록을 한 표로', '4~5쪽'], ['숫자 세 개로 반 전체 보기', '8~9쪽'], ['한눈에 보이게 그리기', '12~13쪽'], ['AI에게 묻고, 교사가 판단하기', '16~17쪽'], ['다음 수업에서 바꿀 한 가지', '20쪽']],
  // 하루 일정(분): 들어가며 15 · 실습 1·2 65 · 쉬는 시간 10 · 실습 3·4 60 · 실습 5 20 · 마무리 10 = 180분
  minutes: [[15, 'a'], [65, 'b'], [10, ''], [60, 'c'], [20, 'a'], [10, 'b']],
  poll: { q: '우리 반 기록 중 가장 먼저 보고 싶은 것은?', options: ['과제 제출', '형성평가 점수', '질문·발표', '출결'] },
};
