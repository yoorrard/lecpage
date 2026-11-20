// 연수 날짜 글자를 한곳에서 계산합니다. QR 안내문·발표 화면·달력 파일(kit/aux-build.js icsFile)·연수 기간(shell.js phaseWindow)·
// 앱 배포 화면이 모두 이 함수를 써서 한 사이트에서 날짜가 둘로 갈리지 않게 합니다.
const WD = '일월화수목금토';
const ymd = (d) => /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
const wd = (m) => WD[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()];
const hm = (t) => (/^\d{1,2}:\d{2}$/.test(t || '') ? t : '');

/** 2026-12-03 → "2026. 12. 3.(목)" */
export function koDay(date) { const m = ymd(date); return m ? `${m[1]}. ${+m[2]}. ${+m[3]}.(${wd(m)})` : ''; }
/** 같은 해 안의 둘째 날짜: "12. 4.(금)"(해가 다르면 해까지) */
const laterDay = (date, firstYear) => { const m = ymd(date); return m ? `${m[1] === firstYear ? '' : `${m[1]}. `}${+m[2]}. ${+m[3]}.(${wd(m)})` : ''; };
const timeOf = (a, b) => (a ? `${a}${b ? `~${b}` : ''}` : '');

/**
 * 연수 날(하루 또는 여러 날)과 그날의 시각. meta.sessions에 날짜가 둘 이상이면 그 날들(날마다 시작·끝이 있으면 그 시각,
 * 없으면 meta.start·end), 아니면 meta.date 하루. → [{ date, start, end }] (날짜 순, 같은 날은 한 번)
 */
export function eventDays(meta = {}) {
  const ses = (Array.isArray(meta.sessions) ? meta.sessions : []).filter((s) => ymd(s?.date))
    .map((s) => ({ date: s.date, start: hm(s.start) || hm(meta.start), end: hm(s.end) || (hm(s.start) ? '' : hm(meta.end)) }));
  // meta.date(첫날)와 차시 날들을 합침(차시 목록에 첫날이 빠져 있어도). 같은 날은 차시에 적힌 시각이 먼저
  const all = [...ses, ...(ymd(meta.date) ? [{ date: meta.date, start: hm(meta.start), end: hm(meta.end) }] : [])];
  const seen = new Set();
  return all.filter((d) => !seen.has(d.date) && seen.add(d.date)).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 일시 한 줄. 하루: "2026. 12. 3.(목) 14:00~17:00". 여러 날·같은 시각: "2027. 1. 11.(월)~1. 15.(금) 09:30~12:30".
 * 여러 날인데 날마다 시각이 다르면(1박 2일 등) 날마다: "2026. 11. 20.(금) 14:00~17:00 · 11. 21.(토) 09:00~12:00"(세 날까지, 넘으면 기간만)
 * @param opts.time false면 시각 없이 날짜만(바닥글)
 */
export function whenText(meta = {}, { time = true } = {}) {
  const days = eventDays(meta);
  if (!days.length) return time ? timeOf(hm(meta.start), hm(meta.end)) : '';
  const first = days[0], last = days[days.length - 1], y = first.date.slice(0, 4);
  const sameTime = days.every((d) => d.start === first.start && d.end === first.end);
  if (days.length > 1 && !sameTime && time && days.length <= 3) return days.map((d, i) => [i ? laterDay(d.date, y) : koDay(d.date), timeOf(d.start, d.end)].filter(Boolean).join(' ')).join(' · ');
  const range = days.length > 1 ? `${koDay(first.date)}~${laterDay(last.date, y)}` : koDay(first.date);
  return [range, time && sameTime ? timeOf(first.start, first.end) : ''].filter(Boolean).join(' ');
}
