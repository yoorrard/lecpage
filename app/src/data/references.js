// 참고 디자인(레퍼런스 사이트, docs/plan-ai-first.md §11): 완성도 높은 강의 사이트 사례. 고르면 AI가 분위기만 참고함(따를 의무 없음).
// 자리와 문구만 준비해 둔 것: 다른 작업자가 AI로 새로 만든 사이트(서로 다른 주제·교재 디자인 2~6개)가 오면 이 목록만 바꿈.
// 지금은 예전 예시 사이트 둘(public/img·examples/)을 씀. 랜딩(landing/More.jsx)과 참고 디자인 화면(pages/Gallery.jsx)이 함께 씀.
export const REFERENCES = [
  { id: 'data-lab', title: '데이터로 읽는 우리 반', kind: '디지털 연수 · 실습형 3시간', desc: '실습 단계·도움 요청·진행 현황, 차분한 점 지도', img: 'img/example-data-lab.webp', url: 'examples/data-lab/index.html' },
  { id: 'sel-story', title: '마음이 먼저 도착하는 교실', kind: '사회정서학습 연수 · 강의형 90분', desc: '핵심 메시지·교재 보기·투표와 나눔 보드, 따뜻한 이야기', img: 'img/example-sel-story.webp', url: 'examples/sel-story/index.html' },
];
