import { useEffect, useRef, useState } from 'preact/hooks';
import { buildSite } from '../lib/engine.js';

/**
 * 작은 실제 화면: 설계도를 엔진으로 그려 스크립트 없이(sandbox="") 보여 줘요. 모형이 아니라 실제 결과예요.
 *   focus: 섹션 id를 주면 그 섹션만 남겨 보여 줘요(본문 배치 비교). 'hero'나 빈 값이면 첫 화면.
 *   화면에 들어올 때만 만들고, 멀리 벗어나면 iframe을 내려놓아요(수십 장이 한꺼번에 메모리를 쓰지 않게).
 *   만들기는 한 번에 하나씩(줄 세움) 해서 많은 카드가 한꺼번에 보여도 화면이 멈추지 않아요.
 */
const cache = new Map(); // key → html (최근 40개)
const remember = (k, v) => { cache.delete(k); cache.set(k, v); if (cache.size > 40) cache.delete(cache.keys().next().value); };
let line = Promise.resolve();
const idle = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 400 }) : setTimeout(f, 30));
function queue(job) { const p = line.then(() => new Promise((r) => idle(() => job().then(r, r)))); line = p.catch(() => { }); return p; }

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };
function dataUrl(path, data) {
  const ext = (path.split('.').pop() || '').toLowerCase(); const type = MIME[ext]; if (!type) return '';
  if (typeof data === 'string') return `data:${type};charset=utf-8,${encodeURIComponent(data)}`;
  let bin = ''; const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(bin)}`;
}
/** 빌드 결과 → 스크립트를 뺀 한 파일 HTML(글꼴 주소는 그대로). focus면 그 섹션만 */
export function staticHtml(files, focus = '', { maxImageBytes = 1.5e6 } = {}) {
  let html = files['index.html'] || '';
  html = html.replace(/<link rel="stylesheet" href="(assets\/[^"]+)">/g, (m, p) => (files[p] !== undefined ? `<style>${files[p]}</style>` : ''));
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, '');
  let budget = maxImageBytes;
  html = html.replace(/(src|href)="((?:assets|media|slides)\/[^"]+)"/g, (m, attr, p) => {
    const data = files[p]; if (data === undefined || /\.(css|js)$/.test(p)) return m;
    const size = typeof data === 'string' ? data.length : data.byteLength; if (size > budget) return `${attr}="#"`;
    const u = dataUrl(p, data); if (!u) return m; budget -= size; return `${attr}="${u}"`;
  });
  const id = String(focus || '').replace(/["\\]/g, '');
  const crop = id && id !== 'hero' ? `main>:not([id="${id}"]){display:none!important}main>[id="${id}"]{margin:0!important}` : '';
  const hide = crop ? '.lp-nav,.lp-foot,.lp-dock,[data-dock]' : '.lp-dock,[data-dock]';
  return html.replace('</head>', () => `<style>${hide}{display:none!important}html,body{overflow:hidden!important;scroll-behavior:auto!important}${crop}</style></head>`);
}

/** 설계도 → 작은 화면용 설계도(움직임 0, 참여 기능 없음: 처음 모습 그대로 보이게) */
export function stillBp(bp) {
  return { ...bp, design: { ...(bp.design || {}), motion: 0 }, live: { ...(bp.live || {}), provider: 'none', features: [] } };
}
const keyOf = (bp, focus) => { try { return focus + '|' + JSON.stringify([bp.design, bp.meta?.title, bp.meta?.subtitle, bp.meta?.date, (bp.sections || []).map((s) => [s.id, s.type, s.layout, s.title])]); } catch { return ''; } };

/** html을 만들어 돌려줌(같은 것은 다시 만들지 않음) */
export function useStatic(bp, focus, on, assets) {
  const [html, setHtml] = useState('');
  const key = bp ? keyOf(bp, focus) : '';
  useEffect(() => {
    if (!on || !bp || !key) return;
    if (cache.has(key)) { setHtml(cache.get(key)); return; }
    let off = false;
    queue(async () => {
      if (off) return;
      const r = await buildSite(stillBp(bp), assets || {});
      if (r.errors?.length) return;
      const h = staticHtml(r.files, focus); remember(key, h); if (!off) setHtml(h);
    });
    return () => { off = true; };
  }, [key, on]);
  return html;
}

/**
 * @param bp 그릴 설계도(바꾼 뒤 모습이면 바꾼 설계도를 그대로)
 * @param focus 섹션 id(그 섹션만) · vw 그릴 폭(px) · ratio 가로:세로
 */
export function MiniSite({ bp, focus = '', vw = 1280, ratio = 1.6, assets, eager = false, class: cls = '' }) {
  const box = useRef(); const [near, setNear] = useState(eager); const [s, setS] = useState(0.2);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setS(e.contentRect.width / vw)); ro.observe(el);
    const io = eager ? null : new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: '300px' });
    io?.observe(el);
    return () => { ro.disconnect(); io?.disconnect(); };
  }, [vw, eager]);
  const html = useStatic(bp, focus, near, assets);
  const vh = Math.round(vw / ratio);
  return (
    <div class={`mini-site ${cls}`} ref={box} style={{ '--s': s, aspectRatio: String(ratio) }}>
      {html && near ? <iframe sandbox="" srcdoc={html} tabIndex={-1} aria-hidden="true" title="" style={{ width: vw + 'px', height: vh + 'px' }} /> : <span class="thumb-wait" />}
    </div>
  );
}
