// 먼저 해보기: 대표 레퍼런스 '데이터로 읽는 우리 반'(skills/lecpage/references/designs/data-lab/)을 진짜 생성 파이프라인으로 다시 보여 주는 재료.
// 교재(material/교재.pdf)는 빌드 때 public/demo/로 옮겨지고(scripts/prepare.mjs), 체험 연수에 넣어 실제로 읽음(쪽 그림까지).
// AI 답 자리만 이 사이트의 파일로 채움(lib/gen/demo-answers.js): 사이트 전체를 파일마다 코드 블록으로 + 끝의 연수 정보.
// 파이프라인(lib/gen/job.js)이 실제와 똑같이 받아 나누고·합치고·조립·검수·저장하므로, 끝난 뒤 화면·편집·검수·배포 연습이 진짜와 같음.
import html from '../../../skills/lecpage/references/designs/data-lab/site/index.html?raw';
import css from '../../../skills/lecpage/references/designs/data-lab/site/assets/style.css?raw';
import js from '../../../skills/lecpage/references/designs/data-lab/site/assets/site.js?raw';
import meta from '../../../skills/lecpage/references/designs/data-lab/lecpage.json';
import { demoAnswers } from '../lib/gen/demo-answers.js';

export const DEMO_FILE = { name: '데이터로 읽는 우리 반_교재.pdf', url: 'demo/data-lab.pdf' };
/** 단계마다 AI 답을 받는 데 쓰는 시간(초, 체험이라 짧게) */
export const DEMO_PACE = { build: 7 };
/** 단계 이름 → 그 단계의 AI 답 */
export const demoAnswer = demoAnswers({ html, css, js, meta });
