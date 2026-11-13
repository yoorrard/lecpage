// 교재 값의 숫자 읽기: 표·한눈에 칸을 도표로 그려도 되는지(지어내지 않음) 판단합니다.
// 칸의 글이 '숫자 + 단위' 하나뿐일 때만 숫자로 봅니다("약 30분 안", "3~5명", "2025년"은 숫자로 보지 않음 → 도표를 그리지 않음).

const UNITS = '%|퍼센트|명|개|회|건|시간|분|초|일|주|개월|년|점|곳|교|개교|학교|학급|반|원|천 원|만 원|억 원|천원|만원|억원|배|쪽|차시|단계|kg|km|m|cm|GB|MB';
const NUM_RE = new RegExp(`^([+-]?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?)\\s*(${UNITS})?$`);
const plain = (v) => String(v ?? '').replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();

/** '45%' → { n: 45, unit: '%', raw: '45%' } · 숫자 하나 + 단위가 아니면 null */
export function parseNum(v) {
  const raw = plain(v);
  const m = NUM_RE.exec(raw);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  if (m[2] === '년' && n >= 1900 && n <= 2100 && !m[1].includes(',')) return null; // '2025년'은 양이 아니라 해(연도)
  return Number.isFinite(n) ? { n, unit: (m[2] || '').replace(/\s/g, '').replace('퍼센트', '%'), raw } : null;
}

/**
 * 표 → 도표 계획. 첫 칸이 이름(글)이고, 나머지 칸이 모두 '모든 줄이 숫자 + 같은 단위'일 때만(수치 표).
 *  - 도넛: 숫자 칸 하나 · 단위 % · 합 98~102 · 2~6줄(부분이 전체를 나눔)
 *  - 막대: 숫자 칸 1~3개(같은 단위) · 2~12줄 · 0 이상
 * @returns {{ kind:'donut'|'bars', cols:number[], unit:string, max:number } | null}
 */
export function tableChart(head = [], rows = []) {
  if (!Array.isArray(rows) || rows.length < 2 || rows.length > 12) return null;
  const n = Math.max(head.length, ...rows.map((r) => r.length));
  if (n < 2 || rows.some((r) => !plain(r[0]) || parseNum(r[0]))) return null; // 첫 칸은 이름
  const cols = [];
  let unit = null;
  for (let k = 1; k < n; k++) {
    const ps = rows.map((r) => parseNum(r[k]));
    if (ps.some((p) => !p || p.n < 0)) continue;
    const u = ps[0].unit;
    if (ps.some((p) => p.unit !== u)) continue;
    if (unit !== null && u !== unit) continue; // 단위가 다른 칸은 한 도표에 두지 않음
    unit = u; cols.push(k);
  }
  // 수치 표만: 첫 칸 밖의 모든 칸이 숫자일 때(글 칸이 섞인 표를 도표로 바꾸면 기준·조치 같은 글이 '표로 보기' 뒤로 숨음)
  if (!cols.length || cols.length > 3 || cols.length !== n - 1) return null;
  const vals = rows.flatMap((r) => cols.map((k) => parseNum(r[k]).n));
  const max = Math.max(...vals);
  if (!(max > 0)) return null;
  const sum = rows.reduce((a, r) => a + parseNum(r[cols[0]]).n, 0);
  const kind = cols.length === 1 && unit === '%' && rows.length <= 6 && sum >= 98 && sum <= 102 ? 'donut' : 'bars';
  return { kind, cols, unit, max };
}

/**
 * 한눈에 칸 → 막대 견줌: 모든 값이 숫자 + 같은 단위(단위가 있어야 함: '4'와 '3'은 단계 수·사례 수처럼 다른 것일 수 있음)이고 2~8개일 때만
 */
export function glanceSeries(items = []) {
  if (!Array.isArray(items) || items.length < 2 || items.length > 8) return null;
  const ps = items.map((i) => parseNum(i.value));
  if (ps.some((p) => !p || p.n < 0) || !ps[0].unit || ps.some((p) => p.unit !== ps[0].unit)) return null;
  const max = Math.max(...ps.map((p) => p.n));
  return max > 0 ? { unit: ps[0].unit, max, vals: ps } : null;
}
