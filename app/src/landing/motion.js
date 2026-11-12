// 첫 화면 움직임 도우미: 화면 안에 있을 때만 움직이고, '동작 줄이기'를 따릅니다.
import { useEffect, useState } from 'preact/hooks';

const RM = '(prefers-reduced-motion: reduce)';
export const isReduced = () => typeof matchMedia === 'function' && matchMedia(RM).matches;

/** 기기의 '동작 줄이기' 설정(바뀌면 따라 바뀜) */
export function useReduced() {
  const [r, setR] = useState(isReduced);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const m = matchMedia(RM), f = () => setR(m.matches);
    m.addEventListener?.('change', f);
    return () => m.removeEventListener?.('change', f);
  }, []);
  return r;
}

/** 요소가 화면 안(margin만큼 넉넉히)에 있는지. once면 한 번 들어온 뒤로는 계속 true */
export function useInView(ref, { margin = '0px', once = false } = {}) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (typeof IntersectionObserver !== 'function') { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => {
      setOn(e.isIntersecting);
      if (once && e.isIntersecting) io.disconnect();
    }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return on;
}

/**
 * 스크롤이 요소를 지나가는 정도(0~1)를 CSS 변수 --p로 씁니다. 화면 안에 있을 때만 스크롤을 듣습니다.
 * from: 요소 윗변이 화면 윗변에 닿을 때 0, 요소 아랫변이 화면 윗변에 닿을 때 1(첫 화면처럼 위에서 시작하는 요소용)
 */
export function useScrollVar(ref, { onChange } = {}) {
  useEffect(() => {
    const el = ref.current; if (!el || isReduced()) return;
    let raf = 0, last = -1, live = false;
    const tick = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
      if (Math.abs(p - last) < 0.002) return;
      last = p; el.style.setProperty('--p', p.toFixed(3)); onChange?.(p);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !live) { live = true; addEventListener('scroll', on, { passive: true }); on(); }
      else if (!e.isIntersecting && live) { live = false; removeEventListener('scroll', on); }
    }) : null;
    if (io) io.observe(el); else { addEventListener('scroll', on, { passive: true }); on(); }
    return () => { io?.disconnect(); removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, []);
}
