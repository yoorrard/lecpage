// 첫 화면 그림 두 판(넓은 화면·좁은 화면). 그림 목록 전체(facts.js)를 받지 않으려고 따로 둠.
// 크기는 scripts/landing-shots.mjs가 찍는 폭(760·520, 16:10)과 같아야 해요(자리를 미리 잡아 밀림이 없게).
import big from './shots/hero-data-lab.webp?url';
import small from './shots/hero-data-lab-s.webp?url';

export const HERO = { big, small, big_w: 760, big_h: 475, small_w: 520, small_h: 325 };
