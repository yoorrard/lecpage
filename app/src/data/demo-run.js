// 먼저 해보기: 실제 서비스와 같은 화면·같은 생성 파이프라인에 AI 답 자리만 미리 받은 답으로 채워요(어디로도 보내지 않음).
// 교재(demo/ai-lesson.pdf): 가상의 교원 연수 '생성형 AI로 수업 자료 만들기' 30쪽(학교·강사·주소는 지어낸 것, 개인정보 없음).
//   빌드 때 해시 붙은 파일로 나가고, 체험 연수에 넣어 실제로 읽음(쪽 그림까지).
// AI 답(demo/answer.txt): 같은 교재로 키 길의 한 번 요청(교재 원본 + 목표 한 문장 + 강의 기능 + 배포 조건)을 보내 실제로 받은 답 그대로
//   (2026-11-21, Claude). 사이트 전체를 파일마다 코드 블록으로 + 끝의 연수 정보. 고치지 않음: 교재에 있던 예시 주소·지난 날짜도 그대로라
//   배포 전 확인 알림까지 실제와 같아요. 파이프라인(lib/gen/job.js)이 받아 나누고·조립·검수·저장하므로 끝난 뒤 편집·배포 연습도 진짜와 같음.
import answer from './demo/answer.txt?raw';
import pdf from './demo/ai-lesson.pdf?url';

export const DEMO_FILE = { name: '생성형 AI로 수업 자료 만들기_교재.pdf', url: pdf };
/** 단계마다 AI 답을 받는 데 쓰는 시간(초, 체험이라 짧게) */
export const DEMO_PACE = { build: 7 };
/** 단계 이름 → 그 단계의 AI 답(만들기 한 번뿐) */
export const demoAnswer = (step = {}) => (step.name === 'build' ? answer : '');
