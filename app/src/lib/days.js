// 연수 날짜(하루 또는 여러 날 차시). 엔진이 받는 꼴: blueprint.meta.date = 첫날, meta.sessions = [{ no, date, start, end, title }](두 날 이상일 때만).
// 첫 화면의 일시 줄은 meta.sessions의 첫날~마지막 날로 그려져서(engine/src/hero-meta.js whenText), 날짜를 고칠 때 sessions도 함께 맞춰야 표지가 바뀜
import { syncInfo } from './blueprint.js';
import { E } from './engine.js';

const ok = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

/** 지금 설계도의 연수 날짜들(정렬, 겹침 없이). 차시 날짜가 둘 이상이면 그 날짜들, 아니면 첫날 하나 */
export function trainingDays(bp) {
  const ses = [...new Set((bp?.meta?.sessions || []).map((x) => x?.date).filter(ok))].sort();
  return ses.length >= 2 ? ses : ok(bp?.meta?.date) ? [bp.meta.date] : [];
}

/**
 * 날짜 목록을 바꾸는 patch(update에 넘김). 하나면 하루짜리(sessions 비움), 둘 이상이면 차시 날짜.
 * 이미 있던 차시의 시작·끝·제목은 같은 날짜에 그대로 둠. 일시 줄(hero.meta)은 초안이 만든 글자 그대로일 때만 새 날짜로
 */
export function daysPatch(cur, list) {
  const ds = [...new Set((list || []).filter(ok))].sort();
  const info = { ...cur.info, date: ds[0] || '' };
  if (!cur.blueprint) return { info, infoTouched: true };
  const prev = cur.blueprint.meta?.sessions || [];
  const sessions = ds.length >= 2 ? ds.map((date, i) => { const was = prev.find((x) => x?.date === date) || {}; return { no: i + 1, date, start: was.start || '', end: was.end || '', title: was.title || '' }; }) : [];
  const bp = syncInfo(cur.blueprint, info, { date: info.date });
  bp.meta = { ...bp.meta, sessions };
  E.syncHeroMeta(cur.blueprint, bp);
  return { info, infoTouched: true, blueprint: bp };
}

/** 다음 날짜 하나 더(마지막 날 + 7일: 주마다 하는 차시가 흔함) */
export function nextDay(days) {
  const last = days[days.length - 1];
  if (!ok(last)) return '';
  const d = new Date(`${last}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}
