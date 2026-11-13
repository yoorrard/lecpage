// 아래 이야기(늦게 받는 묶음)에만 쓰는 움직임 도우미. 첫 화면 JS(motion.js는 첫 화면 그림도 씀)에 들지 않게 따로 둠.
import { useEffect, useRef, useState } from 'preact/hooks';

/** CSS 스크롤 타임라인(animation-timeline: view())을 쓰는 브라우저인지 */
export const hasScrollTimeline = () => typeof CSS !== 'undefined' && !!CSS.supports?.('animation-timeline: view()');

/**
 * 요소의 amount(0~1)만큼이 화면에 보이는지(요소가 화면보다 크면 화면의 그만큼을 채울 때). once면 한 번 보인 뒤로는 계속 true.
 * 움직임이 화면 가장자리(요소가 막 들어온 때)가 아니라 화면 안에서 시작하게 씀(motion.js useInView는 조금이라도 들어오면 true)
 */
export function useSeen(ref, { amount = 0.5, once = false } = {}) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (typeof IntersectionObserver !== 'function') { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => {
      const vh = e.rootBounds?.height || innerHeight;
      const v = e.isIntersecting && (e.intersectionRatio >= amount - 0.001 || e.intersectionRect.height >= vh * amount);
      setOn(v);
      if (once && v) io.disconnect();
    }, { threshold: Array.from({ length: 11 }, (_, i) => i / 10) });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return on;
}

/**
 * 스크롤 타임라인이 없는 브라우저의 대신: 요소가 화면에 반쯤 들어오면 한 번 is-in을 붙여 CSS 전환으로 같은 모습까지(landing-more.css .ld-ink).
 * 스크롤 타임라인이 있거나 동작 줄이기면 아무것도 하지 않음(CSS가 맡거나 완성된 모습)
 */
export function useInk(ref) {
  const on = useSeen(ref, { once: true, amount: 0.5 });
  useEffect(() => { if (on && !hasScrollTimeline()) ref.current?.classList.add('is-in'); }, [on]);
}

/** 숫자가 바뀌면 전 값에서 새 값까지 세며 따라감(ms). 동작 줄이기면 바로 새 값 */
export function useTween(v, reduced, ms = 520) {
  const [x, setX] = useState(v);
  const from = useRef(v);
  useEffect(() => {
    if (reduced || typeof requestAnimationFrame !== 'function') { from.current = v; setX(v); return; }
    const a = from.current, t0 = performance.now(); let raf = 0;
    const step = (now) => {
      const k = Math.min(1, Math.max(0, (now - t0) / ms)), e = 1 - Math.pow(1 - k, 3);
      const cur = a + (v - a) * e; from.current = cur; setX(cur);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [v, reduced]);
  return x;
}

/** 미디어 쿼리가 맞는지(바뀌면 따라 바뀜) */
export function useMedia(q) {
  const get = () => typeof matchMedia === 'function' && matchMedia(q).matches;
  const [m, setM] = useState(get);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(q), f = () => setM(mq.matches);
    f(); mq.addEventListener?.('change', f);
    return () => mq.removeEventListener?.('change', f);
  }, [q]);
  return m;
}
