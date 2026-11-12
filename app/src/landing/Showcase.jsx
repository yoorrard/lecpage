import { useEffect, useRef, useState } from 'preact/hooks';
import { useInView, useReduced } from './motion.js';
import { SHOWCASE, PRESET_COUNT } from './facts.js';

/**
 * 같은 연수 내용을 디자인만 바꿔 엔진으로 만든 실제 첫 화면. 이름을 누르면 그 디자인으로 바뀌어요(View Transitions로 접히듯 넘어감).
 * 화면 안에 있을 때만 몇 초마다 다음 디자인으로 넘어가고, 멈춤 버튼이 있어요. 마우스를 올리거나 버튼에 초점이 있으면 멈춰요.
 * 동작 줄이기: 저절로 넘어가지 않고, 바뀔 때도 움직임 없이 바로 바뀌어요.
 */
const EVERY = 4200;
export function Showcase() {
  const box = useRef(); const img = useRef(); const viaVT = useRef(false);
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const [hold, setHold] = useState(false);
  const reduced = useReduced();
  const on = useInView(box, { margin: '-15% 0px' });
  const near = useInView(box, { margin: '600px 0px', once: true });
  const list = SHOWCASE;
  const cur = list[i] || list[0];
  // 다음 그림을 미리 받아 둠(바뀔 때 비어 보이지 않게)
  useEffect(() => { if (near && list.length) { const n = new Image(); n.src = list[(i + 1) % list.length].src; } }, [near, i]);
  // View Transitions 없이 바뀔 때: 새 그림을 살짝 겹쳐 드러냄(불투명도만)
  useEffect(() => {
    const el = img.current; if (!el || reduced || viaVT.current) { viaVT.current = false; return; }
    const show = () => el.animate?.([{ opacity: 0.2 }, { opacity: 1 }], { duration: 650, easing: 'cubic-bezier(.16,1,.3,1)' });
    if (el.complete) show(); else el.addEventListener('load', show, { once: true });
  }, [i]);
  useEffect(() => {
    if (!on || !auto || hold || reduced || list.length < 2) return;
    const t = setTimeout(() => go((i + 1) % list.length, false), EVERY);
    return () => clearTimeout(t);
  }, [on, auto, hold, reduced, i]);
  function go(n, byHand) {
    if (n === i) return;
    const el = img.current;
    // 손으로 고를 때만 View Transitions(스크롤 중에 저절로 넘어갈 때는 가볍게 겹쳐 바꿈)
    if (byHand && el && document.startViewTransition && !reduced) {
      viaVT.current = true;
      const vt = document.startViewTransition(async () => { el.src = list[n].src; try { await el.decode(); } catch { } setI(n); });
      vt.finished?.catch(() => { });
    } else setI(n);
  }
  if (!list.length) return null;
  return (
    <section class="ld-show" ref={box} aria-labelledby="ld-show-h">
      <header class="ld-head">
        <p class="ld-kicker">디자인 {PRESET_COUNT}가지</p>
        <h2 id="ld-show-h">같은 연수, 디자인만 바꿔 보면</h2>
        <p class="ld-sub">디자인마다 첫 화면 구성·글 배치·글꼴이 달라요. 아래는 같은 연수 내용을 디자인만 바꿔 lecpage가 만든 실제 화면이에요. 교재를 넣으면 주제와 분위기에 맞는 것을 먼저 골라 줘요.</p>
      </header>
      <div class="ld-show-stage" onPointerEnter={() => setHold(true)} onPointerLeave={() => setHold(false)} onFocusCapture={() => setHold(true)} onBlurCapture={() => setHold(false)}>
        <figure class="ld-frame">
          <i class="ld-bar"><b /><b /><b /><span>마음이 먼저 도착하는 교실</span></i>
          <img ref={img} class="ld-show-img" src={near ? cur.src : undefined} alt={`'${cur.name}' 디자인으로 만든 첫 화면`} width="1280" height="800" decoding="async" />
          <figcaption class="ld-show-cap"><b>{cur.name}</b><span>{cur.desc}</span></figcaption>
        </figure>
        <div class="ld-show-pick">
          <div class="ld-show-names" role="group" aria-label="디자인 고르기">
            {list.map((d, n) => <button type="button" class="ld-name" aria-pressed={n === i ? 'true' : 'false'} onClick={() => go(n, true)}>{d.name}</button>)}
          </div>
          <div class="ld-show-foot">
            {!reduced && <button type="button" class="btn btn-sm btn-quiet ld-auto" onClick={() => setAuto(!auto)}>{auto ? '저절로 넘기기 멈추기' : '저절로 넘기기'}</button>}
            <a class="btn btn-sm" href="#/gallery">디자인 {PRESET_COUNT}가지 모두 보기</a>
          </div>
        </div>
      </div>
    </section>
  );
}
