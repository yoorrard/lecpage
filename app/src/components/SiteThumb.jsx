import { useEffect, useRef, useState } from 'preact/hooks';
import { buildSite, previewHtml } from '../lib/engine.js';

/**
 * 디자인 미리보기: 강사의 실제 내용으로 그 디자인의 첫 화면을 만들어 작게 보여 줌(모형이 아니라 실제 결과).
 * 스크립트 없이(sandbox="") 그려 가볍고 안전합니다. 화면에 들어올 때만 만듭니다.
 * 틀은 첫 화면만큼이지만 그림은 본문 네 화면 분량까지 그려 두고, 카드에 마우스를 올리거나 초점이 오면 천천히 내려가며 본문을 보여 줍니다(app.css .thumb-site).
 */
const THUMB_W = 1280, THUMB_H = 800, THUMB_PAGE = 4000;
export function SiteThumb({ bp, presetId, pressed }) {
  const box = useRef(); const [vis, setVis] = useState(false); const [html, setHtml] = useState(''); const [s, setS] = useState(0.15);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); io.disconnect(); } }, { rootMargin: '200px' });
    const ro = new ResizeObserver(([e]) => setS(e.contentRect.width / THUMB_W));
    io.observe(el); ro.observe(el); return () => { io.disconnect(); ro.disconnect(); };
  }, []);
  const d = bp.design || {};
  const key = [presetId, pressed ? [d.palette, d.accent, d.fontPair, d.theme, d.fontFrom].join('|') : '', bp.meta?.title, bp.meta?.subtitle, bp.meta?.date, bp.meta?.venue].join('~');
  useEffect(() => {
    if (!vis) return; let off = false;
    const t = setTimeout(async () => {
      const design = pressed ? { ...d, preset: presetId, motion: 0 } : { ...d, preset: presetId, motion: 0, palette: '', accent: '', fontPair: '', graphic: undefined, signature: '', effects: {} };
      const b = { ...bp, design, live: { ...(bp.live || {}), provider: 'none', features: [] } };
      try { const r = await buildSite(b, {}); if (!off && !r.errors?.length) setHtml(previewHtml(r.files, 'index.html')); } catch { }
    }, 120);
    return () => { off = true; clearTimeout(t); };
  }, [vis, key]);
  return (
    <div class="thumb-site" ref={box} style={{ '--s': s, '--pan': `${-(THUMB_PAGE - THUMB_H)}px` }}>
      {html ? <iframe sandbox="" srcdoc={html} tabIndex={-1} aria-hidden="true" title="" loading="lazy" style={{ width: THUMB_W + 'px', height: THUMB_PAGE + 'px' }} /> : <span class="thumb-wait" />}
    </div>
  );
}
