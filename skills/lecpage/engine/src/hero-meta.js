// 연수 날짜·장소·강사 글자를 한곳에서 계산합니다. 첫 화면(render/hero.js)·QR 안내문·바닥글·달력 파일(build.js icsFile)·
// 연수 기간(shell.js phaseWindow)이 모두 이 함수를 써서 한 사이트에서 날짜가 둘로 갈리지 않게 합니다.
// 초안(ingest/draft.js)과 연수 정보가 바뀌었을 때 옛 설계도의 첫 화면 줄을 다시 맞추는 일(syncHeroMeta)도 같은 모양을 씁니다.
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
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^\d{1,2}:\d{2}$/;
/**
 * 강사가 준 연수 날들 → [{date,start,end}] (날짜 순, 같은 날 한 번) 또는 null.
 * info.sessions: [{ date:'YYYY-MM-DD', start:'HH:MM', end:'HH:MM' }] (날마다 시각이 다를 때) · info.dates: ['YYYY-MM-DD', …]
 */
export function infoDays(info = {}) {
  const raw = Array.isArray(info.sessions) && info.sessions.length ? info.sessions : Array.isArray(info.dates) && info.dates.length ? info.dates.map((date) => ({ date })) : null;
  if (!raw) return null;
  const seen = new Set();
  const out = raw.map((x) => (typeof x === 'string' ? { date: x } : x || {})).filter((x) => YMD.test(x.date || '') && !seen.has(x.date) && seen.add(x.date))
    .map((x) => ({ date: x.date, start: HM.test(x.start || '') ? x.start : '', end: HM.test(x.end || '') ? x.end : '' })).sort((a, b) => a.date.localeCompare(b.date));
  return out.length ? out : null;
}

export function placeText(meta = {}) { return [meta.venue, meta.mode === 'online' || meta.mode === 'hybrid' ? '온라인' : ''].filter(Boolean).join(' · '); }
export function whoText(p) { return p?.name ? [p.name, [p.org, p.role].filter(Boolean).join(' ')].filter(Boolean).join(' · ') : ''; }
/** 첫 화면 기본 줄의 이름표(일시·장소·강사). 설계도의 hero.meta에 이 이름표가 있으면 강사가 쓴 줄로 보고 그대로 둠 */
export const BASE_LABELS = ['일시', '장소', '강사'];

/**
 * 연수 정보가 바뀌면 hero.meta의 일시·장소·강사 줄도 따라 바꿈(초안이 만든 글자 그대로일 때만. 강사가 손으로 고친 줄은 그대로).
 * 요즘 초안은 이 줄들을 적지 않고 화면이 연수 정보에서 그리지만, 예전 설계도·AI 답에 적힌 줄을 맞추려고 둠.
 * @param before 바꾸기 전 설계도  @param after 바꾼 뒤 설계도(이 객체의 hero.meta를 고침)
 */
export function syncHeroMeta(before, after) {
  const hero = (after?.sections || []).find((s) => s?.type === 'hero');
  if (!hero || !Array.isArray(hero.meta) || !hero.meta.length || !before) return after;
  const pairs = [['일시', whenText(before.meta), whenText(after.meta)], ['장소', placeText(before.meta), placeText(after.meta)], ['강사', whoText(before.instructors?.[0]), whoText(after.instructors?.[0])]];
  hero.meta = hero.meta.map((row) => {
    const p = pairs.find(([label, was, now]) => row?.label === label && was !== now && row.value === was);
    return p ? { ...row, value: p[2] } : row;
  }).filter((row) => row && row.value);
  return after;
}
