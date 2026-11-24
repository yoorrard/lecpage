// 바로 배포의 보관 기간과 연수 날: 언제 다시 배포해야 주소·QR 그대로 연수 날까지 열려 있는지.
// 다시 배포하면 그날부터 days일로 늘어나고, 보관 기간이 끝나 지워진 사이트는 새 주소로 다시 만들어짐(인쇄한 QR이 끊김).
// 그래서 알려 주는 날은 ① 지워지는 날보다 앞이고 ② 그날 다시 배포하면 연수 날이 끝날 때까지 닿는 날이어야 함.
export const DAY = 864e5;
const KST = 9 * 36e5;
const MARGIN = 5 * DAY; // 지워지기 며칠 전에 다시 배포하라고 알릴지
/** 그 때가 든 날(한국 시각)의 0시 */
const dayStart = (t) => Math.floor((t + KST) / DAY) * DAY - KST;

/**
 * now: 지금, days: 보관 일수, until: 지금 사이트가 지워지는 때(아직 배포 전이면 0 — 오늘 배포한다고 보고 셈), end: 연수 마지막 날이 끝나는 때(없으면 0)
 * → { gone: 이미 지워짐, short: 연수 날 전에 지워짐, again: 지금 다시 배포하면 늘어나는 때, enough: 지금 다시 배포하면 연수 날까지 닿음,
 *     at: 다시 배포할 날(그날 0시, 없으면 0), reach: 그날 한 번 다시 배포하면 연수 날까지 닿음(false면 그 뒤에도 지워지기 전에 또 다시 배포해야 함) }
 */
export function keepPlan({ now = Date.now(), days = 60, until = 0, end = 0 } = {}) {
  const keep = days * DAY; const again = now + keep;
  const dies = until || again;
  const gone = !!until && until <= now;
  const short = !!end && end > now && dies < end;
  const enough = !end || again >= end;
  let at = 0; let reach = false;
  if (short && !gone) {
    const today = dayStart(now);
    const last = dayStart(dies) - DAY; // 지워지는 날 하루 전(그날 안에는 언제 눌러도 지워지기 전)
    const lo = dayStart(end - keep - 1) + DAY; // 이날부터는 언제 다시 배포해도 연수 날이 끝날 때까지 열려 있음
    const first = Math.max(today, lo);
    const want = Math.max(today, dayStart(dies - MARGIN));
    if (first <= last) { reach = true; at = Math.min(last, Math.max(first, want)); }
    else at = Math.min(Math.max(today, last), want); // 한 번으로는 닿지 않음: 다음에 다시 배포할 날(지워지기 전)
  }
  return { until, gone, short, again, enough, at, reach, days, end };
}
