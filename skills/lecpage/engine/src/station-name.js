// 실습 짧은 이름(메뉴·진행 현황·첫 화면 실습지에 쓰는 이름). 초안(ingest/draft.js)과 검증(validate.js)이 같은 규칙을 써서
// 교재로 바로 만든 사이트와 AI가 짠 사이트(이름을 비워 둔 답)의 실습 이름이 같게 합니다.
//  "실습 2-1 활동지" → "활동지", "활동 3: 라면 끓이기 순서도" → "라면 끓이기 순서도"
//  번호를 떼면 뜻이 없는 이름("실습 1-1 단계" → "단계")이나 다른 실습과 겹치는 이름("실습 1 나눔"·"실습 2 나눔" → "나눔")은 제목 그대로
const PREFIX = /^(?:실습|활동|미션|과제)(?:\s*\d{1,2}(?:\s*[-–.]\s*\d{1,2})?\s*[.:)\-–]?\s*|\s*[.:)\-–]\s*|\s+(?=\S))/;
const GENERIC = /^(?:단계|순서|방법|하기|해\s*보기|따라\s*하기|활동|실습|나눔|공유|정리|마무리|소개|안내|준비|확인|검토|결과|예시|요청\s*글|프롬프트|\d+)$/;

function cut(s, n) { const a = [...String(s || '')]; return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join(''); }

/** 제목 하나 → 짧은 이름(30자 안). 떼어 낼 것이 없거나 뜻이 없어지면 제목 그대로 */
export function stationName(title) {
  const t = String(title || '').replace(/\s+/g, ' ').trim();
  const rest = t.replace(PREFIX, '').trim();
  return cut(rest && rest !== t && !GENERIC.test(rest) && [...rest].length >= 2 ? rest : t, 30);
}

/** 실습 목록 전체의 짧은 이름: 겹치는 이름은 제목 그대로(진행 현황에서 두 '나눔'이 헷갈리지 않게) */
export function stationNames(titles) {
  const names = titles.map(stationName);
  const count = new Map(); for (const n of names) count.set(n, (count.get(n) || 0) + 1);
  return names.map((n, i) => (count.get(n) > 1 && titles[i] && n !== cut(titles[i], 30) ? cut(String(titles[i]).trim(), 30) : n));
}
