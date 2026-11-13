import { useEffect, useRef, useState } from 'preact/hooks';
import { useInView, useReduced } from './motion.js';
import { SAYS, shot, shotSize } from './facts.js';

/**
 * 말로 고치기 체험: 예시 말을 누르면 그 말이 적히고, 앱이 고른 첫 안대로 바뀐 실제 화면으로 넘어가요(View Transitions로 왼쪽부터 다시 그려짐).
 * 그림은 앱의 말로 고치기(design-words)가 이 예시 연수에 내는 첫 안을 엔진으로 그려 찍은 것(scripts/landing-shots.mjs). 이 화면은 엔진을 받지 않아요.
 * 동작 줄이기: 글자를 하나씩 적지 않고, 바로 바뀌어요.
 */
export function SayDemo() {
  const box = useRef(); const img = useRef(); const timer = useRef(0); const wait = useRef(0);
  const [cur, setCur] = useState(-1); // -1 = 처음 모습
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const reduced = useReduced();
  const near = useInView(box, { margin: '700px 0px', once: true });
  const base = shot('site-data-lab'), sz = shotSize('site-data-lab');
  // 바뀔 그림을 미리 받아 둠(누르는 순간 비어 보이지 않게)
  useEffect(() => { if (near) SAYS.forEach((s) => { const n = new Image(); n.src = s.src; }); }, [near]);
  useEffect(() => () => { clearInterval(timer.current); clearTimeout(wait.current); }, []);
  if (!SAYS.length || !base) return null;
  function swap(n) {
    const el = img.current; const src = n < 0 ? base : SAYS[n].src;
    if (el && document.startViewTransition && !reduced) {
      el.style.viewTransitionName = 'ld-say'; // 이 그림만 넘김(다른 그림은 가만히)
      const vt = document.startViewTransition(async () => { el.src = src; try { await el.decode(); } catch { } setCur(n); });
      vt.finished?.finally(() => { el.style.viewTransitionName = ''; }).catch(() => { });
    } else setCur(n);
  }
  function pick(n) {
    if (busy || n === cur) return;
    clearInterval(timer.current); clearTimeout(wait.current);
    if (n < 0) { setTyped(''); swap(-1); return; }
    const text = SAYS[n].text;
    if (reduced) { setTyped(text); swap(n); return; }
    setBusy(true); let k = 0;
    timer.current = setInterval(() => {
      k += 1; setTyped(text.slice(0, k));
      if (k >= text.length) { clearInterval(timer.current); wait.current = setTimeout(() => { swap(n); setBusy(false); }, 260); }
    }, 38);
  }
  const f = SAYS[cur];
  return (
    <section class="ld-say" ref={box} aria-labelledby="ld-say-h">
      <header class="ld-head">
        <h2 id="ld-say-h">마음에 안 들면<br />말로 고쳐요</h2>
        <p class="ld-sub">보이는 느낌을 적으면 고칠 곳을 찾아 바꾼 모습을 바로 보여 줘요. AI를 부르지 않아서 기다리지 않고 토큰도 들지 않아요.</p>
      </header>
      <div class="ld-say-grid">
        <div class="ld-say-ask">
          <p class="ld-say-line" aria-hidden="true"><span>{typed || '예시 말을 골라 보세요'}</span><i class={busy ? 'is-typing' : ''} /></p>
          <div class="ld-say-chips" role="group" aria-label="예시 말">
            {SAYS.map((s, n) => <button type="button" class="ld-say-chip" aria-pressed={cur === n ? 'true' : 'false'} onClick={() => pick(n)}>{s.text}</button>)}
          </div>
          <div class="ld-say-out" aria-live="polite">
            {f ? <><p class="ld-say-what"><small>고친 곳</small><b>{f.title}</b></p><p class="ld-say-why">{f.why}</p></>
              : <p class="ld-say-why">앱에서는 느낌을 직접 적어도 돼요. 고칠 곳을 두세 가지 찾아 ‘지금’과 ‘바꾸면’을 나란히 보여 줘요.</p>}
          </div>
          {cur >= 0 && <button type="button" class="btn btn-sm btn-quiet ld-say-reset" onClick={() => pick(-1)}>처음 모습 보기</button>}
        </div>
        <figure class="ld-frame ld-say-frame">
          <i class="ld-bar"><b /><b /><b /><span>데이터로 읽는 우리 반</span><em>{f ? '바꾼 모습' : '지금'}</em></i>
          <img ref={img} src={near ? (f ? f.src : base) : undefined} alt={f ? `‘${f.text}’로 고친 뒤의 첫 화면(${f.title})` : '예시 연수 사이트의 지금 첫 화면'} width={sz.w} height={sz.h} decoding="async" />
        </figure>
      </div>
    </section>
  );
}
