// '그냥 AI 에이전트에 맡길 때'와 lecpage를 잰 값(src/data/benchmark.json). 지금은 배포·질문·투표 준비로 강사가 할 일(id: setup)만 써요:
// 장부의 합계 줄(Why.jsx Tally)이 그 수를, 결론 한 줄 아래가 조건·잰 날짜를 보여요. 형식: docs/research/landing-2026-11.md 5장.
// AI 중심 개편(2026-11-20)으로 AI가 교재 원본을 직접 읽고 사이트 전체를 한 번에 쓰게 돼, 예전 흐름에서 잰 토큰·비용 값은 지웠어요(다시 재면 넣음).
// 같은 교재·같은 AI로 견준 결과(2026-11-21)는 Compare.jsx에 따로 있어요.
const files = import.meta.glob('../data/benchmark.json', { eager: true, import: 'default' });
export const BENCH = Object.values(files)[0] || {};

const num = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
/** 값이 제대로 있는 항목만(이름·두 값·잰 날짜) */
export function benchItems(data = BENCH) {
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.filter((x) => x && typeof x.name === 'string' && x.name.trim() && num(x.baseline) && num(x.lecpage) && /^\d{4}-\d{2}-\d{2}$/.test(String(x.measured || '')));
}
/** 숫자 쓰기(10보다 작으면 소수 둘째 자리까지) */
export function fmt(v, { digits } = {}) {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: digits ?? (v < 10 ? 2 : v < 100 ? 1 : 0) }).format(v);
}
