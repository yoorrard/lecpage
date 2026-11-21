// 첫 화면 움직임 도우미(작게): 동작 줄이기 · 화면에 들어오면 표시 · 구간 스크롤 진행도.
// 규칙: transform·opacity·clip-path만 바꾸고, 값은 CSS 변수 하나로 넘겨 CSS가 그림(다시 그리기 없음). 화면 밖에서는 멈춤.
// 동작 줄이기(prefers-reduced-motion)면 모든 장면이 완성된 정지 모습이에요(CSS의 .ld-still).
import { useEffect } from 'preact/hooks';

const mq = (q) => typeof matchMedia === 'function' && matchMedia(q).matches;
export const isReduced = () => mq('(prefers-reduced-motion: reduce)');
export const isFine = () => mq('(hover: hover) and (pointer: fine)');

/** ref의 요소가 화면에 들어오면 class 'is-in'(한 번), 화면에 있는 동안 'is-on'(멈춤·재생용). onChange(on)도 부름 */
export function useInView(ref, { margin = '0px 0px -12% 0px', onChange } = {}) {
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (typeof IntersectionObserver !== 'function') { el.classList.add('is-in', 'is-on'); onChange?.(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) el.classList.add('is-in');
      el.classList.toggle('is-on', e.isIntersecting); onChange?.(e.isIntersecting);
    }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, []);
}

/**
 * 구간 스크롤 진행도(CSS 변수 name, 0~scale). 동작 줄이기면 scale(끝 모습)로 고정.
 * mode 'pin'(sticky 장면): 구간 윗변이 화면 위에 닿을 때 0 → 아랫변이 화면 아래에 닿을 때 1
 * mode 'read'(읽히며 켜지는 글): 윗변이 화면 아래 90%에 올 때 0 → 화면 40%에 올 때 1
 */
export function useProgress(ref, name = '--p', { scale = 1, mode = 'pin' } = {}) {
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (isReduced()) { el.style.setProperty(name, String(scale)); return; }
    let raf = 0, on = false, last = '';
    const set = () => {
      raf = 0;
      const r = el.getBoundingClientRect(), H = innerHeight;
      const k = mode === 'read' ? (H * 0.9 - r.top) / (H * 0.5) : -r.top / Math.max(1, r.height - H);
      const v = (Math.min(1, Math.max(0, k)) * scale).toFixed(3);
      if (v !== last) { last = v; el.style.setProperty(name, v); }
    };
    const req = () => { if (on && !raf) raf = requestAnimationFrame(set); };
    const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([e]) => { on = e.isIntersecting; req(); }, { rootMargin: '20% 0px' }) : null;
    if (io) io.observe(el); else on = true;
    set();
    addEventListener('scroll', req, { passive: true }); addEventListener('resize', req);
    return () => { io?.disconnect(); cancelAnimationFrame(raf); removeEventListener('scroll', req); removeEventListener('resize', req); };
  }, []);
}
