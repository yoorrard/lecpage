// 첫 화면의 일시·장소·강사 줄 글자. 초안(ingest/draft.js)이 hero.meta를 따로 적을 때와,
// 연수 정보가 바뀌었을 때 그 줄을 다시 맞출 때(intake.js syncHeroMeta) 같은 모양을 쓰려고 한곳에 둡니다.
const WD = '일월화수목금토';
const ymd = (d) => /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
const wd = (m) => WD[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()];

/** 2026-12-03 → "2026. 12. 3.(목)" */
export function koDay(date) { const m = ymd(date); return m ? `${m[1]}. ${+m[2]}. ${+m[3]}.(${wd(m)})` : ''; }
const timeText = (m) => (m.start ? `${m.start}${m.end ? `~${m.end}` : ''}` : '');
/** 일시: 하루면 "2026. 12. 3.(목) 14:00~17:00", 차시 날짜가 여러 날이면 "2027. 1. 11.(월)~1. 15.(금) 09:30~12:30" */
export function whenText(meta = {}) {
  const days = (meta.sessions || []).map((s) => s.date).filter(Boolean).sort();
  const first = days[0] || meta.date, last = days[days.length - 1];
  const a = koDay(first);
  if (!a) return timeText(meta);
  const b = last && last !== first ? ymd(last) : null;
  const range = b ? `${a}~${b[1] === first.slice(0, 4) ? '' : `${b[1]}. `}${+b[2]}. ${+b[3]}.(${wd(b)})` : a;
  return [range, timeText(meta)].filter(Boolean).join(' ');
}
export function placeText(meta = {}) { return [meta.venue, meta.mode === 'online' || meta.mode === 'hybrid' ? '온라인' : ''].filter(Boolean).join(' · '); }
export function whoText(p) { return p?.name ? [p.name, [p.org, p.role].filter(Boolean).join(' ')].filter(Boolean).join(' · ') : ''; }

/**
 * 연수 정보가 바뀌면 hero.meta의 일시·장소·강사 줄도 따라 바꿈(초안이 만든 글자 그대로일 때만. 강사가 손으로 고친 줄은 그대로).
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
