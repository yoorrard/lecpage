// 연수 하루에 이 서버가 받는 요청 어림. 예약(Gate)·상태 API·README 수용량 표가 같이 씁니다.
// 근거: 공식 한도(Workers Free 요청 10만/일, 정적 자산·Pages 정적 요청은 세지 않음) × 측정값(docs/research/admin-2026-11.md §2,
// README의 '40명 연수 2천~1만 2천', '웹소켓이 막힌 학교망 50명 2시간 4~7만').

export const EST = {
  /** 참가자 한 명이 연수 동안 Worker에 보내는 사이트 요청(첫 방문 6 + 교재 그림·자료 + 다시 열기). Worker 보기만. Pages 보기는 0 */
  viewWorker: 25,
  /** 참여 기능: 연결·참여·글쓰기·투표(실시간 연결이 될 때) */
  liveBase: 15,
  /** 실시간 연결이 막혀 묻기로 바뀐 참가자의 1분당 요청(5초, 빈 응답이 이어지면 10초. 측정 50명 2시간 4~7만 → 3.3~5.8) */
  pollPerMin: 5,
  /** 긴 대기(?wait=20, 바뀐 것이 있으면 바로 답)를 쓰는 런타임일 때(대기 20초 + 쉬는 5초 → 약 2.4, 활동이 있으면 더) */
  pollPerMinLong: 2.4,
  /** 실시간 연결이 막혀 묻기로 바뀌는 참가자 몫(앱의 '네트워크' 답). 학교망 restricted는 모두 묻기로 봄 */
  pollShare: { good: 0.2, slow: 0.5, restricted: 1 },
  /** 강사 화면·발표 화면 몫(참가자 몇 명 분) */
  teacherSeats: 2,
};
/** 예약된 연수의 어림이 하루 예산의 이 몫을 넘으면 그날 새 예약을 받지 않음(남은 몫은 예약 없이 오는 일과 어림 오차) */
export const BOOK_SHARE = 0.7;
export const DEFAULT_MINUTES = 120;
export const MAX_PEOPLE = 500;

/**
 * @param {{ people?: number, minutes?: number, live?: boolean, network?: string, view?: 'worker'|'pages', longPoll?: boolean }} b
 * @returns {number} 그날 Worker 요청 어림(정수)
 */
export function estimate({ people = 30, minutes = DEFAULT_MINUTES, live = false, network = 'good', view = 'worker', longPoll = false } = {}) {
  const n = Math.min(MAX_PEOPLE, Math.max(1, Math.round(Number(people) || 30))) + EST.teacherSeats;
  const min = Math.min(12 * 60, Math.max(10, Math.round(Number(minutes) || DEFAULT_MINUTES)));
  let r = view === 'pages' ? 0 : n * EST.viewWorker;
  if (live) {
    const share = EST.pollShare[network] ?? EST.pollShare.good;
    r += n * EST.liveBase + n * share * min * (longPoll ? EST.pollPerMinLong : EST.pollPerMin);
  }
  return Math.round(r);
}

/** 'YYYY-MM-DD' + 'HH:MM'(한국 시간) → 그 시각(밀리초). 시각이 없으면 오전 10시로 봄 */
export function kstTime(date, time = '') {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
  if (!m) return NaN;
  const t = /^(\d{1,2}):(\d{2})$/.exec(String(time || '')) || [0, '10', '00'];
  const [h, mi] = [Math.min(23, Number(t[1])), Math.min(59, Number(t[2]))];
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), h - 9, mi);
}
/** 앱이 보낸 예약 → 정리한 값(쓸 수 없으면 null) */
export function cleanBooking(b, now = Date.now()) {
  if (!b || typeof b !== 'object') return null;
  const at = kstTime(b.date, b.start);
  if (!Number.isFinite(at) || at < now - 12 * 3600e3 || at > now + 366 * 864e5) return null;
  let minutes = DEFAULT_MINUTES;
  const e = kstTime(b.date, b.end);
  if (b.end && Number.isFinite(e) && e > at) minutes = Math.round((e - at) / 60000);
  if (Number.isFinite(Number(b.minutes)) && Number(b.minutes) > 0) minutes = Number(b.minutes);
  return {
    at, minutes: Math.min(12 * 60, Math.max(10, Math.round(minutes))),
    people: Math.min(MAX_PEOPLE, Math.max(1, Math.round(Number(b.people) || 30))),
    live: !!b.live, network: ['good', 'slow', 'restricted'].includes(b.network) ? b.network : 'good',
  };
}
