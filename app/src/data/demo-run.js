// 먼저 해보기: 예시 교재(public/demo/example.pdf = 엔진 시험용 workshop.pdf, 13쪽)로 AI 에이전트가 만든 결과를 진행 단계와 함께 다시 보여 주는 녹화.
// 사이트는 kit 작업자가 이 교재로 만든 잡지형 사이트(data/fixtures/mag). 레퍼런스 사이트·실제 생성 녹화가 오면 steps·사이트만 바꿈(화면은 그대로).
import { mockSite } from './mock-sites.js';

export const DEMO_FILE = { name: '생성형 AI로 여는 우리 반 수업_교재.pdf', url: 'demo/example.pdf' };

/** 실제로 걸린 시간(초)과 단계 이름(생성 API의 step과 같은 꼴) */
export const DEMO_STEPS = [
  { name: 'plan', label_ko: '교재 읽고 설계하기', sec: 52 },
  { name: 'design', label_ko: '디자인 정하기', sec: 34 },
  { name: 'sections:1', label_ko: '섹션 만들기 1/2', sec: 61 },
  { name: 'sections:2', label_ko: '섹션 만들기 2/2', sec: 57 },
  { name: 'check', label_ko: '조립하고 검수하기', sec: 26 },
];

/** @returns {Promise<{ site, meta }>} meta는 AI 답 그대로(강사 칸은 받는 쪽이 readMeta로 버림) */
export const demoResult = () => mockSite('mag');
