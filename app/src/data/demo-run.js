// 먼저 해보기: 실제 서비스와 같은 화면·같은 생성 파이프라인에 AI 답 자리만 미리 만든 답으로 채워요(어디로도 보내지 않음).
// 교재(demo/neo-teach.pdf): 참고 디자인 '질문이 먼저, AI는 그다음'의 교재 그대로(skills/lecpage/references/designs/neo-teach/material/교재.pdf,
//   16:9 17쪽, 기관·강사·연락처는 지어낸 예시). 빌드 때 해시 붙은 파일로 나가고, 체험 연수에 넣어 실제로 읽음(쪽 그림까지).
// AI 답: 같은 사례의 사이트 글 파일(index.html·lab.html·assets/style.css·assets/site.js)과 연수 정보(lecpage.json)를 키 길의 한 번 답 꼴
//   (파일마다 코드 블록 하나, 여는 줄에 경로, 맨 끝 ```lecpage.json: lib/gen/demo-answers.js)로 빌드 때 묶음. 파이프라인(lib/gen/job.js)이
//   받아 나누고·조립·검수·저장하므로 끝난 뒤 미리보기(여러 쪽 오가기)·편집·배포 연습도 진짜와 같음. 교재 쪽 그림은 교재에서 새로 그림.
import { demoAnswers } from '../lib/gen/demo-answers.js';
import meta from '../../../skills/lecpage/references/designs/neo-teach/lecpage.json';
import pdf from './demo/neo-teach.pdf?url';

const RAW = import.meta.glob('../../../skills/lecpage/references/designs/neo-teach/site/**/*.{html,css,js,txt}', { query: '?raw', import: 'default', eager: true });
const files = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k.replace(/^.*\/neo-teach\/site\//, ''), v]));

export const DEMO_FILE = { name: '질문이 먼저, AI는 그다음_교재.pdf', url: pdf };
// 사이트가 가리키는 자료 파일(사례의 site/files/ 그대로: 수업 설계 캔버스·실습 프롬프트 모음). AI 답(글 파일)에는 들어가지 않으므로 체험 연수의
// 사이트 파일로 따로 넣어 둠(lib/demo.js openDemo) — 없으면 체험이 끝난 화면에 '링크 files/…가 가리키는 파일이 없어요'가 꼭 고칠 곳으로 뜸
const FILE_URLS = import.meta.glob('../../../skills/lecpage/references/designs/neo-teach/site/files/*', { query: '?url', import: 'default', eager: true });
export const DEMO_SITE_FILES = Object.entries(FILE_URLS).map(([k, url]) => ({ path: 'files/' + k.split('/').pop(), url }));
/** 단계마다 AI 답을 받는 데 쓰는 시간(초, 체험이라 짧게) */
export const DEMO_PACE = { build: 7 };
/** 단계 이름 → 그 단계의 AI 답(만들기 한 번뿐) */
export const demoAnswer = demoAnswers({ files, meta });
