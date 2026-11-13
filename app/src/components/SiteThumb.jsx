import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { buildSite } from '../lib/engine.js';
import { staticHtml, useLive, LiveLayer } from '../design-words/MiniSite.jsx';

/**
 * 디자인 미리보기: 강사의 실제 내용으로 그 디자인의 첫 화면을 만들어 작게 보여 줌(모형이 아니라 실제 결과).
 * 스크립트를 빼고(sandbox="") 그려 가볍고 안전합니다. 화면에 들어올 때만 만듭니다.
 * 평소에는 첫 화면만(틀 높이 800). 카드에 마우스를 올리거나 초점이 오면 틀을 본문 다섯 화면 분량으로 늘리고 천천히 내려가며 본문을 보여 줍니다(app.css .thumb-site.is-tour).
 * 늘 길게 그려 두지 않는 까닭: 첫 화면 높이가 화면 높이(svh)를 따르는 디자인이 있어, 틀이 길면 첫 화면 구성이 달라집니다.
 * 움직임: 지금 고른 디자인(pressed)·크게 비교(live)·마우스를 올린 카드는 사이트 스크립트를 돌린 화면을 정지 그림 위에 겹쳐,
 * 첫 화면 그림(물결·궤도·파문 등)과 등장 효과가 실제로 움직입니다(sandbox="allow-scripts", 같은 출처 권한 없음). 나머지 카드는 가벼운 정지 그림.
 */
const THUMB_W = 1280, THUMB_H = 800, THUMB_PAGE = 4000;
export function SiteThumb({ bp, presetId, pressed, live = false }) {
  const box = useRef(); const [vis, setVis] = useState(false); const [html, setHtml] = useState(''); const [s, setS] = useState(0.15); const [tour, setTour] = useState(false);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); io.disconnect(); } }, { rootMargin: '200px' });
    const ro = new ResizeObserver(([e]) => setS(e.contentRect.width / THUMB_W));
    io.observe(el); ro.observe(el);
    // 카드(.thumb)에 포인터·초점이 오면 본문 둘러보기
    const card = el.closest('.thumb'), on = () => setTour(true), off = () => setTour(false);
    if (card) { card.addEventListener('pointerenter', on); card.addEventListener('pointerleave', off); card.addEventListener('focus', on); card.addEventListener('blur', off); }
    return () => { io.disconnect(); ro.disconnect(); if (card) { card.removeEventListener('pointerenter', on); card.removeEventListener('pointerleave', off); card.removeEventListener('focus', on); card.removeEventListener('blur', off); } };
  }, []);
  const d = bp.design || {};
  const key = [presetId, pressed ? [d.palette, d.accent, d.fontPair, d.theme, d.fontFrom].join('|') : '', bp.meta?.title, bp.meta?.subtitle, bp.meta?.date, bp.meta?.venue].join('~');
  useEffect(() => {
    if (!vis) return; let off = false;
    const t = setTimeout(async () => {
      const design = pressed ? { ...d, preset: presetId, motion: 0 } : { ...d, preset: presetId, motion: 0, palette: '', accent: '', fontPair: '', graphic: undefined, signature: '', effects: {} };
      const b = { ...bp, design, live: { ...(bp.live || {}), provider: 'none', features: [] } };
      try { const r = await buildSite(b, {}); if (!off && !r.errors?.length) setHtml(staticHtml(r.files)); } catch { }
    }, 120);
    return () => { off = true; clearTimeout(t); };
  }, [vis, key]);
  // 움직이는 화면용 설계도: 정지 그림과 같은 디자인이되 움직임은 그 디자인의 단계 그대로
  const liveBp = useMemo(() => (pressed ? { ...bp, design: { ...d, preset: presetId } } : { ...bp, design: { ...d, preset: presetId, motion: undefined, palette: '', accent: '', fontPair: '', graphic: undefined, signature: '', effects: {} } }), [key]);
  const lh = useLive(liveBp, vis && !!html && (live || pressed || tour));
  const pan = tour && !lh; // 움직이는 화면이 있으면 둘러보기는 그 안에서(실제 스크롤)
  return (
    <div class={`thumb-site${pan ? ' is-tour' : ''}`} ref={box} style={{ '--s': s, '--pan': `${-(THUMB_PAGE - THUMB_H)}px` }}>
      {html ? <iframe sandbox="" srcdoc={html} tabIndex={-1} aria-hidden="true" title="" loading="lazy" style={{ width: THUMB_W + 'px', height: (pan ? THUMB_PAGE : THUMB_H) + 'px' }} /> : <span class="thumb-wait" />}
      {html && <LiveLayer html={lh} tour={tour} style={{ width: THUMB_W + 'px', height: THUMB_H + 'px' }} />}
    </div>
  );
}
