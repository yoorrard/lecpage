// 참고 디자인의 머리(제목·안내 한 줄). 첫 화면 묶음에 들어 있어, 둘러보기 조각·엔진을 받는 동안에도 이것을 먼저 그림(main.jsx Lazy).
// 휴대폰에서 엔진 묶음(약 480KB)을 기다리느라 첫 글이 4초 넘게 늦던 것(점검 2026-11 M6). 낱말 수는 빌드 때 계산(vite.config.js landingFacts)
export function GalleryHead({ count }) {
  return <div class="step-head"><div class="step-head-t"><h1>참고 디자인</h1><p>강의 사이트 사례와 디자인 낱말 {count}개를 봐요. 고른 것은 AI가 참고만 하고, 내 교재에 맞게 새로 만들어요. 고르지 않아도 돼요.</p></div></div>;
}
