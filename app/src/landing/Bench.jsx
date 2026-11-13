import { useRef } from 'preact/hooks';
import { useReduced } from './motion.js';
import { useSeen, useTween } from './motion-more.js';

// '그냥 AI 에이전트에 맡길 때'와 lecpage를 잰 값. src/data/benchmark.json을 읽어 '왜 lecpage' 결론 한 줄 아래에 그려요.
// 형식: docs/research/landing-2026-11.md 5장 '비교 수치(benchmark.json)'. 강사가 할 일(id: setup)은 장부의 합계 줄(Why.jsx Tally)이 쓰고, 나머지는 여기서 숫자로.
// 파일이 없거나 제대로 된 값이 하나도 없으면 수치는 나오지 않아요(장부와 결론 한 줄은 그대로).
const files = import.meta.glob('../data/benchmark.json', { eager: true, import: 'default' });
const REPO = 'https://github.com/yoorrard/lecpage/blob/main/';
export const BENCH = Object.values(files)[0] || {};

const num = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
/** 값이 제대로 있는 항목만(이름·두 값·잰 날짜) */
export function benchItems(data = BENCH) {
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.filter((x) => x && typeof x.name === 'string' && x.name.trim() && num(x.baseline) && num(x.lecpage) && /^\d{4}-\d{2}-\d{2}$/.test(String(x.measured || '')));
}
/** compact: 만 단위로 줄여 씀(2,630만). 만보다 작은 값은 그대로(6,643) */
export function fmt(v, { digits, compact } = {}) {
  if (compact && v >= 10000) return new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: digits ?? 0, useGrouping: true }).format(v);
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: digits ?? (v < 10 ? 2 : v < 100 ? 1 : 0) }).format(v);
}
const link = (m) => (!m ? '' : /^https:\/\//.test(m) ? m : /^[\w./#-]+$/.test(m) ? REPO + m.replace(/^\.?\//, '') : '');
const about = (x, k) => (Array.isArray(x.approx) && x.approx.includes(k) ? '약 ' : '');

/** 한 항목: 그냥 맡길 때 값은 0부터 세어 올라가고(쌓인 만큼), lecpage 값은 그대로. 세는 숫자는 꾸밈이고 끝 값은 화면 낭독기용 글로 */
function Metric({ x, on, reduced, base }) {
  const c = useTween(on ? x.baseline : 0, reduced, 1300);
  const u = x.unit || '';
  return (
    <div class="ld-m">
      <dt>{x.name}</dt>
      <dd>
        <span class="ld-sr">{base} {about(x, 'baseline')}{fmt(x.baseline, x)}{u}, lecpage {about(x, 'lecpage')}{fmt(x.lecpage, x)}{u}</span>
        <span class="ld-m-v" aria-hidden="true">
          <span class="ld-m-base"><span class="ld-m-ghost">{about(x, 'baseline')}{fmt(x.baseline, x)}</span><span>{about(x, 'baseline')}{fmt(reduced ? x.baseline : Math.round(c), x)}</span></span>
          <i class="ld-m-to" />
          <b class="ld-m-lp">{about(x, 'lecpage') && <small class="ld-m-ab">약</small>}{fmt(x.lecpage, x)}{u && <small>{u}</small>}</b>
        </span>
      </dd>
    </div>
  );
}

/** 결론 아래 잰 값(할 일을 뺀 것) + 잰 날짜·조건·재는 방법. 조건은 재는 방법(같은 절)마다 한 번만, 할 일의 조건은 합계 줄의 * 풀이로 */
export function Bench() {
  const box = useRef();
  const reduced = useReduced();
  const on = useSeen(box, { once: true, amount: 0.5 });
  const all = benchItems();
  // AI 비용을 먼저(결론 한 줄의 '토큰'을 한 숫자로), 그다음 읽은 글·쓴 글
  const items = all.filter((x) => x.id !== 'setup').sort((a, b) => (b.id === 'cost') - (a.id === 'cost'));
  if (!items.length) return null;
  const base = BENCH.baseline || 'AI 에이전트에 그냥 맡길 때';
  const conds = [], seen = new Set();
  for (const x of items) { const key = String(x.method || x.id); if (x.conditions && !seen.has(key)) { seen.add(key); conds.push(x.conditions); } }
  const dates = [...new Set(all.map((x) => x.measured))].join(', ');
  const href = link(String(items.find((x) => x.method)?.method || '').split('#')[0]);
  const setup = all.find((x) => x.id === 'setup');
  return (
    <div class="ld-bench" ref={box}>
      <p class="ld-bench-legend" aria-hidden="true"><span class="k-base">{base}</span><span class="k-lp">lecpage</span></p>
      <dl class="ld-ms">{items.map((x) => <Metric x={x} on={on} reduced={reduced} base={base} />)}</dl>
      <p class="ld-bench-foot">{setup?.conditions && <>* {setup.conditions}. </>}<time datetime={all[0].measured}>{dates}</time> 측정. {conds.join(' · ')}{href && <> · <a href={href} target="_blank" rel="noopener">재는 방법</a></>}</p>
    </div>
  );
}
