import { useEffect, useRef } from 'preact/hooks';
import { isReduced } from './motion.js';
import { EX, shot, shotSize } from './facts.js';

/**
 * 첫 화면 그림: 교재 표지 한 장의 모서리(로고의 접힌 모서리)가 접혀 넘어가며, 밑에 깔린 연수 사이트가 드러나요.
 * 접히는 정도(--k, 표지 높이에 대한 비율) = 처음 열릴 때 + 스크롤로 첫 화면을 지나는 만큼 + 마우스 위치(마우스를 오른쪽으로 옮기면 더 넘어감).
 * 동작 줄이기: 중간쯤 접힌 정지 모습. 그림 전체가 꾸밈(aria-hidden)이고, 같은 내용은 글로 있어요.
 */
export function HeroFold() {
  const box = useRef();
  useEffect(() => {
    const el = box.current; if (!el) return;
    const fold = el.querySelector('.ld-fold');
    const hero = el.closest('.ld-hero') || el;
    const still = isReduced();
    let h = fold.offsetHeight, sp = 0, px = 0, open = still ? 1 : 0, raf = 0, last = '';
    const set = () => {
      raf = 0;
      // 0.16(로고만큼 작은 모서리) → 처음 열림 0.66 → 스크롤하면 0.94까지
      const k = still ? 0.66 : 0.16 + open * 0.5 + sp * 0.3 + px * 0.1;
      // --k(0~1)만 바꿈: 접힌 날개는 transform(scale)으로, 표지는 clip-path로 그려 자리 밀림이 없음
      const v = Math.min(0.94, Math.max(0.12, k)).toFixed(3);
      if (v !== last) { last = v; el.style.setProperty('--k', v); } // 화면 밖에서는 값이 그대로라 다시 그리지 않음
    };
    const req = () => { if (!raf) raf = requestAnimationFrame(set); };
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { h = fold.offsetHeight; el.style.setProperty('--h', `${h}px`); req(); }) : null;
    el.style.setProperty('--h', `${h}px`);
    ro?.observe(fold);
    set();
    if (still) return () => ro?.disconnect();
    // 처음 열림: 한 박자 쉬고 천천히(CSS 전환이 맡음)
    const t = setTimeout(() => { open = 1; el.classList.add('is-open'); req(); }, 350);
    const onScroll = () => { const r = hero.getBoundingClientRect(); sp = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height * 0.8))); req(); };
    addEventListener('scroll', onScroll, { passive: true });
    // 마우스를 따라 모서리가 조금 더(덜) 넘어감: 섬세한 포인터(마우스·트랙패드)에서만
    const fine = typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
    const onMove = (e) => { const r = el.getBoundingClientRect(); px = Math.max(-1, Math.min(1, ((e.clientX - (r.left + r.width / 2)) / innerWidth) * 2.5)); req(); };
    const onLeave = () => { px = 0; req(); };
    if (fine) { hero.addEventListener('pointermove', onMove); hero.addEventListener('pointerleave', onLeave); }
    return () => {
      clearTimeout(t); ro?.disconnect(); cancelAnimationFrame(raf);
      removeEventListener('scroll', onScroll);
      if (fine) { hero.removeEventListener('pointermove', onMove); hero.removeEventListener('pointerleave', onLeave); }
    };
  }, []);
  const src = shot('hero-data-lab'), sz = shotSize('hero-data-lab');
  return (
    <div class="ld-hero-vis" ref={box} aria-hidden="true">
      <div class="ld-fold">
        <div class="ld-fold-site">
          <i class="ld-bar"><b /><b /><b /><span>예시 연수 사이트</span></i>
          {src && <img src={src} alt="" width={sz.w} height={sz.h} decoding="async" />}
        </div>
        <div class="ld-sheet ld-cover">
          <small>연수 교재 · 1쪽</small>
          <b>{EX.title}</b>
          <span>{EX.lead}</span>
          <i class="ld-cover-rule" />
          <em>2026. 12. 16. · {EX.venue}</em>
          <i class="ld-cover-dots" />
        </div>
        <div class="ld-flap-wrap"><i class="ld-flap" /></div>
      </div>
      <p class="ld-hero-cap"><span>교재 한 장</span><i /><span>연수 사이트</span></p>
    </div>
  );
}
