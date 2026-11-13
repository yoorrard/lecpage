import { useEffect, useRef, useState } from 'preact/hooks';
import { buildSite } from '../lib/engine.js';
import { staticHtml } from '../design-words/MiniSite.jsx';

/**
 * 디자인 미리보기: 강사의 실제 내용으로 그 디자인의 첫 화면을 만들어 작게 보여 줌(모형이 아니라 실제 결과).
 * 스크립트를 빼고(sandbox="") 그려 가볍고 안전합니다. 화면에 들어올 때만 만듭니다.
 * 평소에는 첫 화면만(틀 높이 800). 카드에 마우스를 올리거나 초점이 오면 틀을 본문 다섯 화면 분량으로 늘리고 천천히 내려가며 본문을 보여 줍니다(app.css .thumb-site.is-tour).
 * 늘 길게 그려 두지 않는 까닭: 첫 화면 높이가 화면 높이(svh)를 따르는 디자인이 있어, 틀이 길면 첫 화면 구성이 달라집니다.
 */
const THUMB_W = 1280, THUMB_H = 800, THUMB_PAGE = 4000;
export function SiteThumb({ bp, presetId, pressed }) {
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
  return (
    <div class={`thumb-site${tour ? ' is-tour' : ''}`} ref={box} style={{ '--s': s, '--pan': `${-(THUMB_PAGE - THUMB_H)}px` }}>
      {html ? <iframe sandbox="" srcdoc={html} tabIndex={-1} aria-hidden="true" title="" loading="lazy" style={{ width: THUMB_W + 'px', height: (tour ? THUMB_PAGE : THUMB_H) + 'px' }} /> : <span class="thumb-wait" />}
    </div>
  );
}
