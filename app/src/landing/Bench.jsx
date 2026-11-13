// '그냥 AI에게 맡길 때'와 lecpage를 잰 값. src/data/benchmark.json을 읽어 그리고, 파일이 없거나 값이 하나도 없으면 이 구간은 나오지 않아요.
// 형식: docs/research/landing-2026-11.md '비교 수치(benchmark.json)'. 두 값을 나란히 놓는 조용한 막대(항목마다 자기 단위의 척도).
const files = import.meta.glob('../data/benchmark.json', { eager: true, import: 'default' });
const REPO = 'https://github.com/yoorrard/lecpage/blob/main/';

const num = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
/** 값이 제대로 있는 항목만(이름·두 값·잰 날짜) */
export function benchItems(data = Object.values(files)[0]) {
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.filter((x) => x && typeof x.name === 'string' && x.name.trim() && num(x.baseline) && num(x.lecpage) && /^\d{4}-\d{2}-\d{2}$/.test(String(x.measured || '')));
}
/** compact: 만 단위로 줄여 씀(2,630만). 만보다 작은 값은 그대로(6,643) */
export function fmt(v, { digits, compact } = {}) {
  if (compact && v >= 10000) return new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: digits ?? 0, useGrouping: true }).format(v);
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: digits ?? (v < 10 ? 2 : v < 100 ? 1 : 0) }).format(v);
}
const link = (m) => (!m ? '' : /^https:\/\//.test(m) ? m : /^[\w./#-]+$/.test(m) ? REPO + m.replace(/^\.?\//, '') : '');

export function Bench() {
  const data = Object.values(files)[0];
  const items = benchItems(data);
  if (!items.length) return null;
  const base = data.baseline || 'AI에게 그냥 맡길 때';
  return (
    <div class="ld-bench">
      <h3 id="ld-bench-h">잰 값</h3>
      <p class="ld-bench-legend" aria-hidden="true"><span class="k-base">{base}</span><span class="k-lp">lecpage</span></p>
      <table class="ld-bench-t" aria-labelledby="ld-bench-h">
        <thead><tr><th scope="col">항목</th><th scope="col">{base}</th><th scope="col">lecpage</th><th scope="col">잰 날짜·조건</th></tr></thead>
        <tbody>
          {items.map((x) => {
            const max = Math.max(x.baseline, x.lecpage) || 1, u = x.unit || '' /* 단위는 숫자에 붙여 씀(docs/writing.md 5절) */, href = link(x.method);
            const about = (k) => (Array.isArray(x.approx) && x.approx.includes(k) ? '약 ' : '');
            const val = (k) => `${about(k)}${fmt(x[k], x)}${u}`;
            return (
              <tr>
                <th scope="row">{x.name}{x.better && <small>{x.better === 'higher' ? '높을수록 좋음' : '낮을수록 좋음'}</small>}</th>
                <td class="b-base" data-k={base}><span class="ld-bar-v">{val('baseline')}</span><i style={{ '--w': x.baseline / max }} aria-hidden="true" /></td>
                <td class="b-lp" data-k="lecpage"><span class="ld-bar-v">{val('lecpage')}</span><i style={{ '--w': x.lecpage / max }} aria-hidden="true" /></td>
                <td class="b-meta"><time datetime={x.measured}>{x.measured}</time>{x.conditions && <span>{x.conditions}</span>}{href && <a href={href} target="_blank" rel="noopener">재는 방법</a>}{x.note && <span>{x.note}</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
