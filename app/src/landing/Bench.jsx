// 'AI에게 그냥 맡길 때'와 lecpage를 재어 본 값. src/data/benchmark.json을 읽어 그리고, 파일이 없거나 값이 하나도 없으면 이 구간은 나오지 않아요.
// 형식: docs/research/landing-2026-11.md '비교 수치(benchmark.json)'. 두 값을 나란히 놓는 조용한 막대(항목마다 자기 단위의 척도).
const files = import.meta.glob('../data/benchmark.json', { eager: true, import: 'default' });
const REPO = 'https://github.com/yoorrard/lecpage/blob/main/';

const num = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
/** 값이 제대로 있는 항목만(이름·두 값·잰 날짜) */
export function benchItems(data = Object.values(files)[0]) {
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.filter((x) => x && typeof x.name === 'string' && x.name.trim() && num(x.baseline) && num(x.lecpage) && /^\d{4}-\d{2}-\d{2}$/.test(String(x.measured || '')));
}
const fmt = (v, digits) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: digits ?? (v < 10 ? 2 : v < 100 ? 1 : 0) }).format(v);
const link = (m) => (!m ? '' : /^https:\/\//.test(m) ? m : /^[\w./#-]+$/.test(m) ? REPO + m.replace(/^\.?\//, '') : '');

export function Bench() {
  const data = Object.values(files)[0];
  const items = benchItems(data);
  if (!items.length) return null;
  const base = data.baseline || 'AI에게 그냥 맡길 때';
  return (
    <div class="ld-bench">
      <h3 id="ld-bench-h">재어 본 값</h3>
      <p class="ld-bench-legend" aria-hidden="true"><span class="k-base">{base}</span><span class="k-lp">lecpage</span></p>
      <table class="ld-bench-t" aria-labelledby="ld-bench-h">
        <thead><tr><th scope="col">항목</th><th scope="col">{base}</th><th scope="col">lecpage</th><th scope="col">잰 날짜·조건</th></tr></thead>
        <tbody>
          {items.map((x) => {
            const max = Math.max(x.baseline, x.lecpage) || 1, u = !x.unit ? '' : x.unit === '%' ? '%' : ` ${x.unit}`, href = link(x.method);
            return (
              <tr>
                <th scope="row">{x.name}{x.better && <small>{x.better === 'higher' ? '높을수록 좋음' : '낮을수록 좋음'}</small>}</th>
                <td class="b-base"><span class="ld-bar-v">{fmt(x.baseline, x.digits)}{u}</span><i style={{ '--w': x.baseline / max }} aria-hidden="true" /></td>
                <td class="b-lp"><span class="ld-bar-v">{fmt(x.lecpage, x.digits)}{u}</span><i style={{ '--w': x.lecpage / max }} aria-hidden="true" /></td>
                <td class="b-meta"><time datetime={x.measured}>{x.measured}</time>{x.conditions && <span>{x.conditions}</span>}{href && <a href={href} target="_blank" rel="noopener">재는 방법</a>}{x.note && <span>{x.note}</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
