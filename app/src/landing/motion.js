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
