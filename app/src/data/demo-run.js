// 먼저 해보기: 예시 교재(public/demo/example.pdf)로 AI가 만든 결과를 진행 단계와 함께 다시 보여 주는 녹화.
// 지금 사이트는 임시(data/temp-site.js). 레퍼런스 사이트·실제 생성 녹화가 오면 site·meta·steps만 그것으로 바꿈(화면은 그대로).
import { tempSite } from './temp-site.js';

export const DEMO_FILE = { name: '데이터로 읽는 우리 반_교재.pdf', url: 'demo/example.pdf' };

/** 실제로 걸린 시간(초)과 단계 이름(생성 API의 step과 같은 꼴) */
export const DEMO_STEPS = [
  { name: 'plan', label_ko: '교재 읽고 설계하기', sec: 52 },
  { name: 'design', label_ko: '디자인 정하기', sec: 34 },
  { name: 'sections:1', label_ko: '섹션 만들기 1/2', sec: 61 },
  { name: 'sections:2', label_ko: '섹션 만들기 2/2', sec: 57 },
  { name: 'check', label_ko: '조립하고 검수하기', sec: 26 },
];

export function demoResult(figure = '') {
  const t = tempSite({
    title: '데이터로 읽는 우리 반',
    eyebrow: '디지털 수업 역량 강화 연수',
    headline: '기록은 쌓였는데, 읽을 시간이 없다면',
    subtitle: '흩어진 학습 기록을 표로 모으고, 차트로 읽고, 다음 수업을 바꾸는 3시간 실습이에요.',
    date: '2027-03-10', start: '14:00', end: '17:00',
    venue: '한빛교육연수원 3층 디지털실습실',
    organizer: '한빛교육연수원 · 예시 연수',
    instructor: { name: '유영재', org: '수업 기록 연구회' },
    pages: 6, figure,
    flow: [['14:00', '여는 이야기', '우리 반 기록은 어디에 흩어져 있을까요?'], ['14:20', '표로 모으기', '출결·과제·쪽지 시험을 한 표로 모아요.'], ['15:10', '차트로 읽기', '같은 표를 세 가지 차트로 그려 봐요.'], ['16:20', '다음 수업 바꾸기', '읽은 것을 수업 계획 한 줄로 옮겨요.']],
    goals: [['한 장의 표', '흩어진 기록을 한 표로 모으는 틀을 가져가요.'], ['읽히는 차트', '무엇을 볼지 먼저 정하고 차트를 고르는 법을 익혀요.'], ['수업 한 줄', '기록에서 찾은 것을 다음 수업 계획 한 줄로 바꿔요.']],
    steps: [
      ['1단계: 기록 모으기', ['예시 시트를 내 드라이브에 사본으로 저장해요.', '출결·과제·쪽지 시험 탭을 한 표로 합쳐요.'], '이 세 표를 학생 이름 기준으로 한 표로 합쳐 줘. 빈칸은 비워 둬.'],
      ['2단계: 차트로 읽기', ['합친 표에서 볼 것을 하나 정해요.', '막대·꺾은선·점 그래프 가운데 맞는 것을 골라요.'], '과제 제출률이 낮은 주를 찾을 수 있는 차트를 추천하고 이유를 한 줄로 써 줘.'],
    ],
    poll: ['우리 반 기록 가운데 가장 먼저 모아 볼 것은?', ['출결', '과제 제출', '쪽지 시험']],
    closing: '기록이 학생을 더 잘 보는 창이 되기를',
    facts: [{ label: '연수명', value: '데이터로 읽는 우리 반', page: 1 }, { label: '날짜', value: '2027-03-10', page: 1 }, { label: '시간', value: '14:00~17:00', page: 1 }, { label: '장소', value: '한빛교육연수원 3층 디지털실습실', page: 1 }, { label: '강사', value: '유영재', page: 1 }],
  });
  return t;
}
