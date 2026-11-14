import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { buildSite, previewHtml } from '../lib/engine.js';

/**
 * 작은 실제 화면: 설계도를 엔진으로 그려 스크립트 없이(sandbox="") 보여 줘요. 모형이 아니라 실제 결과예요.
 *   focus: 섹션 id를 주면 그 섹션만 남겨 보여 줘요(본문 배치 비교). 'hero'나 빈 값이면 첫 화면.
 *   화면에 들어올 때만 만들고, 멀리 벗어나면 iframe을 내려놓아요(수십 장이 한꺼번에 메모리를 쓰지 않게).
 *   만들기는 한 번에 하나씩(줄 세움) 해서 많은 카드가 한꺼번에 보여도 화면이 멈추지 않아요.
 */
const cache = new Map(); // key → html (최근 40개)
const remember = (k, v) => { cache.delete(k); cache.set(k, v); if (cache.size > 40) cache.delete(cache.keys().next().value); };
// 만들기 줄: 한 번에 하나, 사이사이 화면에 양보. 먼저 볼 것(말로 고치기의 안·크게 보기)은 줄 앞에 섬
const jobs = []; let busy = false;
const yieldNow = () => new Promise((r) => setTimeout(r, 0));
async function pump() {
  if (busy) return; busy = true;
  while (jobs.length) { const job = jobs.shift(); try { await job(); } catch { /* 한 장이 실패해도 나머지는 그림 */ } await yieldNow(); }
  busy = false;
}
function queue(job, first = false) { if (first) jobs.unshift(job); else jobs.push(job); pump(); }
/** 짧은 지문(FNV-1a): 설계도 전체가 같으면 같은 그림 */
function hash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36) + s.length.toString(36); }

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

/** 움직이는 카드에 덧붙이는 CSS: 도크·멈춤 단추를 숨기고, 스크롤 막대 없이 */
const LIVE_CSS = '.lp-dock,[data-dock],.fx-toggle{display:none!important}html,body{overflow:hidden!important;scroll-behavior:auto!important}';
/** 움직이는 카드의 '본문 둘러보기': 앱이 {type:'lp-tour', on}을 보내면 잠깐 첫 화면을 보여 준 뒤 사이트 안에서 천천히 내려가고(등장·스크롤 연동 효과가 실제로 돎), 끄면 맨 위로. 동작 줄이기에서는 하지 않음 */
const TOUR_JS = `<script>(function(){var on=0,t0=0,raf=0,tm=0;if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;document.documentElement.style.scrollBehavior='auto';function step(t){if(!on)return;if(!t0)t0=t;var m=document.documentElement.scrollHeight-innerHeight,y=Math.min(m,(t-t0)*0.38);scrollTo(0,y);if(y<m)raf=requestAnimationFrame(step);}addEventListener('message',function(e){if(e.source!==parent)return;var d=e.data||{};if(d.type!=='lp-tour')return;cancelAnimationFrame(raf);clearTimeout(tm);on=d.on?1:0;t0=0;if(on)tm=setTimeout(function(){raf=requestAnimationFrame(step);},900);else scrollTo(0,0);});})();<\/script>`;
/**
 * 빌드 결과 → 움직임을 살린 한 파일 HTML(사이트 스크립트 포함). 디자인을 보여 주는 카드에서 첫 화면 그림·등장 효과가 실제로 돌게 함.
 * sandbox="allow-scripts"(같은 출처 권한 없음)에서만 씀: 앱의 저장소·쿠키에 닿지 못함. 캔버스 해상도는 1배(작게 줄여 보여 주므로)
 */
export function liveHtml(files) {
  const h = previewHtml(files, 'index.html', { lean: true, extraCss: LIVE_CSS, dpr: 1 });
  return h.includes('</body>') ? h.replace('</body>', () => TOUR_JS + '</body>') : h + TOUR_JS;
}
const liveCache = new Map();
/** 움직이는 html(같은 설계도는 다시 만들지 않음, 최근 12개). on일 때만 만듦 */
export function useLive(bp, on, assets) {
  const [html, setHtml] = useState('');
  const key = useMemo(() => (bp ? keyOf(bp, 'live') : ''), [bp]);
  useEffect(() => {
    if (!on || !bp || !key) { setHtml(''); return; }
    if (liveCache.has(key)) { setHtml(liveCache.get(key)); return; }
    let off = false;
    queue(async () => {
      if (off) return;
      const r = await buildSite({ ...bp, live: { ...(bp.live || {}), provider: 'none', features: [] } }, assets || {});
      if (r.errors?.length) return;
      const h = liveHtml(r.files); liveCache.delete(key); liveCache.set(key, h); if (liveCache.size > 12) liveCache.delete(liveCache.keys().next().value);
      if (!off) setHtml(h);
    }, true);
    return () => { off = true; };
  }, [key, on]);
  return html;
}
/**
 * 정지 그림 위에 움직이는 화면을 겹침. 움직이는 화면은 첫 화면 등장(제목이 떠오름 등)이 끝난 뒤에 서서히 드러남:
 * 정지 그림과 같은 모습에서 바뀌므로 글이 두 겹으로 비치거나, 다 보이던 제목이 사라졌다 다시 들어오며 튀지 않음.
 * tour면 사이트 안에서 본문까지 천천히 내려감(정지 그림처럼 틀을 길게 늘려 미는 대신 실제 스크롤이라 효과가 제대로 돎)
 */
const SETTLE = 1300;
/** alone: 밑에 정지 그림이 없음(늘 움직이는 카드) → 다 읽히면 바로 보임(첫 화면 등장도 그대로 보임) */
export function LiveLayer({ html, title = '', style, tour = false, alone = false }) {
  const [shown, setShown] = useState(false); const ref = useRef(); const timer = useRef(0);
  const post = (on) => { try { ref.current?.contentWindow?.postMessage({ type: 'lp-tour', on }, '*'); } catch { } };
  useEffect(() => { setShown(false); return () => clearTimeout(timer.current); }, [html]);
  useEffect(() => { if (shown) post(tour); }, [tour, shown]);
  const loaded = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setShown(true), alone ? 0 : SETTLE); };
  return html ? <iframe ref={ref} class={`is-live${shown ? ' is-on' : ''}`} sandbox="allow-scripts" srcdoc={html} tabIndex={-1} aria-hidden="true" title={title} onLoad={loaded} style={style} /> : null;
}

/** 설계도 → 작은 화면용 설계도(움직임 0, 참여 기능 없음: 처음 모습 그대로 보이게) */
export function stillBp(bp) {
  return { ...bp, design: { ...(bp.design || {}), motion: 0 }, live: { ...(bp.live || {}), provider: 'none', features: [] } };
}
const keyOf = (bp, focus) => { try { return focus + '|' + hash(JSON.stringify(bp)); } catch { return ''; } };

/** html을 만들어 돌려줌(같은 것은 다시 만들지 않음). first면 줄 앞에 섬 */
export function useStatic(bp, focus, on, assets, first = false) {
  const [html, setHtml] = useState('');
  const key = useMemo(() => (bp ? keyOf(bp, focus) : ''), [bp, focus]);
  useEffect(() => {
    if (!on || !bp || !key) return;
    if (cache.has(key)) { setHtml(cache.get(key)); return; }
    let off = false;
    queue(async () => {
      if (off) return;
      const r = await buildSite(stillBp(bp), assets || {});
      if (r.errors?.length) return;
      const h = staticHtml(r.files, focus); remember(key, h); if (!off) setHtml(h);
    }, first);
    return () => { off = true; };
  }, [key, on]);
  return html;
}

/**
 * @param bp 그릴 설계도(바꾼 뒤 모습이면 바꾼 설계도를 그대로)
 * @param focus 섹션 id(그 섹션만) · vw 그릴 폭(px) · ratio 가로:세로
 * @param tour 카드에 포인터·초점이 오면 사이트 스크립트를 돌린 화면을 겹쳐 첫 화면 그림·등장 효과가 실제로 움직이고,
 *   잠깐 뒤 그 안에서 본문까지 천천히 내려감(첫 화면 전체를 보여 줄 때만. 동작 줄이기면 내려가지 않음)
 * @param live 늘 움직이는 화면으로(한 화면에 한두 장만: 지금 고른 디자인·크게 보기)
 */
const PAGE = 4000;
export function MiniSite({ bp, focus = '', vw = 1280, ratio = 1.6, assets, eager = false, first = false, tour = false, live = false, class: cls = '' }) {
  const box = useRef(); const [near, setNear] = useState(eager); const [s, setS] = useState(0.2); const [touring, setTouring] = useState(false);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setS(e.contentRect.width / vw)); ro.observe(el);
    const io = eager ? null : new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: '300px' });
    io?.observe(el);
    const card = tour ? el.closest('.word-card, .dict-now, .thumb') : null;
    const on = () => setTouring(true), off = () => setTouring(false);
    if (card) { card.addEventListener('pointerenter', on); card.addEventListener('pointerleave', off); card.addEventListener('focusin', on); card.addEventListener('focusout', off); }
    return () => { ro.disconnect(); io?.disconnect(); if (card) { card.removeEventListener('pointerenter', on); card.removeEventListener('pointerleave', off); card.removeEventListener('focusin', on); card.removeEventListener('focusout', off); } };
  }, [vw, eager, tour]);
  // 늘 움직이는 카드(live)는 정지 그림을 따로 그리지 않음: 같은 사이트를 두 장 그리면 글꼴도 두 번 받음
  // (스크립트 없는 sandbox iframe은 출처가 서로 달라 브라우저가 글꼴을 함께 쓰지 못함. 둘러보기 휴대폰 첫 화면 글꼴 약 1.5MB의 절반)
  const alone = live && !focus;
  const html = useStatic(bp, focus, near && !alone, assets, first || eager);
  const lh = useLive(bp, near && !focus && (live || touring), assets);
  const vh = Math.round(vw / ratio);
  // 움직이는 화면이 있으면 둘러보기도 그 안에서(실제 스크롤). 없을 때만 정지 그림의 틀을 늘려 밂
  const pan = touring && !lh;
  return (
    <div class={`mini-site ${cls}${pan ? ' is-tour' : ''}`} ref={box} style={{ '--s': s, '--pan': `${-(PAGE - vh)}px`, aspectRatio: String(ratio) }}>
      {alone ? (lh && near ? null : <span class="thumb-wait" />)
        : html && near ? <iframe sandbox="" srcdoc={html} tabIndex={-1} aria-hidden="true" title="" style={{ width: vw + 'px', height: (pan ? PAGE : vh) + 'px' }} /> : <span class="thumb-wait" />}
      {(alone || html) && near && <LiveLayer html={lh} tour={touring} alone={alone} style={{ width: vw + 'px', height: vh + 'px' }} />}
    </div>
  );
}
