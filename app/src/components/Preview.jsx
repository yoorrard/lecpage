import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { blobs } from '../lib/db.js';
import { loadRuntime } from '../lib/engine.js';
import { assemble, previewHtml } from '../lib/studio.js';
import { annotate } from '../lib/site-doc.js';
import { siteFiles } from '../lib/site-meta.js';

// 완성 뒤 미리보기(docs/plan-ai-first.md §8): 조립된 실제 사이트(참여 기능은 연습 모드)를 샌드박스 iframe에.
// allow-same-origin을 주지 않아 미리보기 안 코드는 앱 저장소(키·연수)에 닿지 못함. 고른 기기의 실제 폭으로 그린 뒤 칸에 맞게 줄여 보여 줌.
// [글 고치기]를 켜면 미리보기의 글자를 눌러 바로 고치고(번호 data-lpe로 원본의 같은 자리에 씀), 그림을 누르면 바꾸기 창이 열림.

const assetCache = new Map();
/** 교재 쪽 그림 등(assets/…): 배포 화면이 예전 연수 파일을 만들 때도 씀 */
export async function projectAssets(pid, fresh = false) {
  if (!fresh && assetCache.has(pid)) return assetCache.get(pid);
  const keys = (await blobs.keys(pid)).filter((k) => k.startsWith('assets/') && (fresh || !k.startsWith('assets/files/')));
  const a = {};
  for (const k of keys) { const v = await blobs.get(pid, k); a[k] = v instanceof Blob ? new Uint8Array(await v.arrayBuffer()) : v; }
  if (!fresh) assetCache.set(pid, a);
  return a;
}
export function dropAssetCache(pid) { assetCache.delete(pid); }

// 화면 크기(CSS 픽셀). 근거: docs/research/preview-responsive-2026-11.md
export const DEVICES = [
  { value: 'phone', label: '휴대폰', w: 390, h: 844, icon: 'phone', rotate: true },
  { value: 'tablet', label: '태블릿', w: 820, h: 1180, icon: 'tablet', rotate: true },
  { value: 'laptop', label: 'PC', w: 1366, h: 768, icon: 'laptop' },
  { value: 'fit', label: '맞춤', icon: 'fit' },
];
export const PAGES = [{ value: 'index.html', label: '참가자 화면' }, { value: 'console.html', label: '강사 화면' }, { value: 'screen.html', label: '발표 화면' }, { value: 'poster.html', label: 'QR 안내문' }, { value: 'check.html', label: '접속 확인' }];

const store = {
  get(k, d) { try { return localStorage.getItem('lp-preview-' + k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('lp-preview-' + k, v); } catch { } },
};
const ICONS = {
  laptop: <><rect x="4.5" y="4.5" width="15" height="10.5" rx="1.2" /><path d="M2 18.5h20" /></>,
  tablet: <><rect x="5" y="2.5" width="14" height="19" rx="2" /><path d="M11 18.5h2" /></>,
  phone: <><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18.5h2" /></>,
  fit: <><path d="M3 5v14M21 5v14" /><path d="M7 12h10M10 9l-3 3 3 3M14 9l3 3-3 3" /></>,
  rotate: <><path d="M4 12a8 8 0 0 1 13.6-5.7L20 8.5" /><path d="M20 3.5v5h-5" /><path d="M20 12a8 8 0 0 1-13.6 5.7L4 15.5" /><path d="M4 20.5v-5h5" /></>,
  expand: <><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></>,
  shrink: <><path d="M20 10h-6V4M4 14h6v6M14 10l7-7M10 14l-7 7" /></>,
  pen: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>,
};
export function Icon({ name, size = 18 }) {
  return <svg class="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONS[name]}</svg>;
}

function useBox(ref) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => { const r = e.contentRect; setBox((b) => (Math.abs(b.w - r.width) < 1 && Math.abs(b.h - r.height) < 1 ? b : { w: r.width, h: r.height })); });
    ro.observe(el); return () => ro.disconnect();
  }, []);
  return box;
}

/** 미리보기는 늘 리허설: 실제 참여 기능 서버가 연결돼 있어도 이 기기 안 연습(local)으로(시험 글이 실제 참가자 기록에 섞이지 않게) */
const TEACHER = ['siteUrl', 'joinUrl', 'shortUrl', 'access', 'surveyUrl', 'privacy', 'keepUntil'];
export const rehearsalPrev = (m = {}) => ({ ...Object.fromEntries(TEACHER.filter((k) => m[k] !== undefined && m[k] !== null).map((k) => [k, m[k]])), live: { provider: 'local', url: '', code: m.live?.code || 'PREVIEW1' } });

/** 미리보기 안 도구: 글 고치기(누르면 그 자리에서 고침 → 바뀐 글을 앱으로), 그림 누르기, 섹션으로 옮기기·반짝, 스크롤 자리 */
const EDIT_JS = `<script>(function(){var on=false,cur=null;var st=document.createElement('style');st.textContent='html.lp-editing [data-lpe]{cursor:text}html.lp-editing [data-lpe]:hover,html.lp-editing [data-lpe]:focus-visible{outline:2px dashed #5B49B0;outline-offset:2px}html.lp-editing img[data-lpe]{cursor:pointer}[contenteditable=true]{outline:2px solid #5B49B0!important;outline-offset:2px;background:rgba(91,73,176,.06)}.lp-flash{animation:lpflash 1.4s ease}@keyframes lpflash{0%,60%{box-shadow:inset 0 0 0 4px #5B49B0}100%{box-shadow:inset 0 0 0 4px transparent}}';document.head.appendChild(st);
function setOn(v){on=v;document.documentElement.classList.toggle('lp-editing',on);document.querySelectorAll('[data-lpe]').forEach(function(e){if(on){e.setAttribute('tabindex','0');}else{e.removeAttribute('tabindex');}});if(!on&&cur)cur.blur();}
function send(m){parent.postMessage(m,'*');}
function start(el){if(el.tagName==='IMG'){send({type:'lp-img',n:+el.getAttribute('data-lpe')});return;}if(cur===el)return;cur=el;var before=el.innerHTML;el.setAttribute('contenteditable','true');el.focus();try{var r=document.createRange();r.selectNodeContents(el);r.collapse(false);var s=getSelection();s.removeAllRanges();s.addRange(r);}catch(x){}
function done(){el.removeEventListener('blur',done);el.removeEventListener('keydown',key);el.removeAttribute('contenteditable');cur=null;if(el.innerHTML!==before)send({type:'lp-text',n:+el.getAttribute('data-lpe'),html:el.innerHTML});}
function key(ev){if(ev.key==='Escape'){el.innerHTML=before;el.blur();}else if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();el.blur();}}
el.addEventListener('blur',done);el.addEventListener('keydown',key);}
document.addEventListener('click',function(e){if(!on)return;var el=e.target.closest&&e.target.closest('[data-lpe]');if(!el){var a=e.target.closest&&e.target.closest('a,button,form');if(a)e.preventDefault();return;}e.preventDefault();e.stopPropagation();start(el);},true);
document.addEventListener('keydown',function(e){if(!on||cur)return;var el=e.target.closest&&e.target.closest('[data-lpe]');if(el&&(e.key==='Enter'||e.key==='F2')){e.preventDefault();start(el);}},true);
addEventListener('message',function(e){if(e.source!==parent)return;var d=e.data||{};if(d.type==='lp-edit')setOn(!!d.on);if(d.type==='lp-goto'&&typeof d.y==='number')scrollTo(0,d.y);if(d.type==='lp-scroll'&&typeof d.key==='string'){var t=document.querySelector('[data-lps="'+(window.CSS&&CSS.escape?CSS.escape(d.key):d.key)+'"]');if(t){t.scrollIntoView({block:'start'});t.classList.remove('lp-flash');void t.offsetWidth;t.classList.add('lp-flash');}}});
var tm=0;addEventListener('scroll',function(){clearTimeout(tm);tm=setTimeout(function(){send({type:'lp-y',y:scrollY});},120);},{passive:true});})();<\/script>`;

/**
 * p: 연수(site·meta), ver: 그림이 바뀌면 올림(다시 읽기), editing·setEditing: 글 고치기,
 * onText(n, html)·onImage(n): 미리보기에서 고친 글·누른 그림, quiet: 미리보기를 다시 그리지 않을 index.html(방금 미리보기에서 고친 글), goto: { key, n } 섹션으로
 */
export function SitePreview({ p, ver = 0, editing, setEditing, onText, onImage, quiet, goto }) {
  const [device, setDeviceRaw] = useState(() => store.get('device2', typeof innerWidth === 'number' && innerWidth < 700 ? 'phone' : 'laptop'));
  const [land, setLand] = useState(false);
  const [full, setFull] = useState(false);
  const [page, setPage] = useState('index.html');
  const [html, setHtml] = useState('');
  const [err, setErr] = useState('');
  const [focusable, setFocusable] = useState(false);
  const frame = useRef(); const canvas = useRef(); const y = useRef(0); const t = useRef();
  const box = useBox(canvas);
  const setDevice = (v) => { setDeviceRaw(v); store.set('device2', v); };
  const post = (msg) => { try { frame.current?.contentWindow?.postMessage(msg, '*'); } catch { } };
  // 다시 그리기(조립 → 한 파일). 미리보기에서 막 고친 글은 이미 화면에 있으니 다시 그리지 않음
  useEffect(() => {
    if (!p.site) return undefined;
    if (page === 'index.html' && quiet && quiet.current === p.site['index.html'] && html) return undefined;
    clearTimeout(t.current);
    t.current = setTimeout(async () => {
      try {
        const site = await siteFiles(p);
        site['index.html'] = annotate(site['index.html'] || '');
        const r = assemble(site, p.meta || {}, { runtime: await loadRuntime(), preview: true, target: 'preview', prev: rehearsalPrev(p.meta || {}), material: p.material ? { pages: (p.material.pages || []).map((x, i) => ({ page: x.page || i + 1, title: x.title || '', text: '' })) } : null });
        if (!r.files?.['index.html']) { setErr((r.errors || r.warnings || []).map((x) => x.message_ko).join(' ') || '미리보기를 그리지 못했어요.'); return; }
        const pg = r.files[page] ? page : 'index.html';
        setHtml(previewHtml(r.files, pg, pg === 'index.html' ? { extraBody: EDIT_JS } : {})); setErr('');
      } catch (e) { console.error(e); setErr('미리보기를 그리지 못했어요. 새로 고침해 주세요.'); }
    }, 250);
    return () => clearTimeout(t.current);
  }, [p.site, p.meta, page, ver]);
  useEffect(() => {
    const f = (e) => {
      if (e.source !== frame.current?.contentWindow) return;
      const d = e.data || {};
      if (d.type === 'lp-y' && typeof d.y === 'number') y.current = d.y;
      else if (d.type === 'lp-text' && Number.isInteger(d.n) && typeof d.html === 'string') onText?.(d.n, d.html.slice(0, 20000));
      else if (d.type === 'lp-img' && Number.isInteger(d.n)) { setFull(false); onImage?.(d.n); }
    };
    addEventListener('message', f); return () => removeEventListener('message', f);
  }, [onText, onImage]);
  useEffect(() => { post({ type: 'lp-edit', on: !!editing && page === 'index.html' }); }, [editing, page]);
  useEffect(() => { if (goto?.key) { if (page !== 'index.html') setPage('index.html'); else post({ type: 'lp-scroll', key: goto.key }); } }, [goto?.n]);
  useEffect(() => {
    if (!full) return undefined;
    const k = (e) => { if (e.key === 'Escape') setFull(false); };
    addEventListener('keydown', k); document.documentElement.classList.add('pv-lock');
    return () => { removeEventListener('keydown', k); document.documentElement.classList.remove('pv-lock'); };
  }, [full]);
  const d = DEVICES.find((x) => x.value === device) || DEVICES[2];
  const fit = d.value === 'fit'; const turned = d.rotate && land;
  const vw = fit ? Math.round(box.w) : turned ? d.h : d.w;
  const vh = fit ? Math.round(box.h) : turned ? d.w : d.h;
  const scale = fit || !box.w ? 1 : Math.min(1, box.w / vw, box.h / vh);
  const editable = page === 'index.html' && !!setEditing;
  return (
    <div class={`preview${full ? ' full' : ''}`} role={full ? 'dialog' : undefined} aria-modal={full ? 'true' : undefined} aria-label={full ? '크게 보기' : undefined}>
      <div class="pv-bar">
        <div class="pv-actions">
          {editable && <button type="button" class={`btn btn-sm${editing ? ' btn-ink' : ''}`} aria-pressed={String(!!editing)} onClick={() => { setEditing(!editing); if (!editing) setFocusable(true); }} title="미리보기의 글자를 눌러 바로 고쳐요. 그림을 누르면 바꿀 수 있어요."><Icon name="pen" size={16} /> {editing ? '글 고치는 중' : '글 고치기'}</button>}
        </div>
        <label class="pv-page"><span class="sr">미리볼 화면</span>
          <select value={page} onChange={(e) => { setPage(e.target.value); }}>{PAGES.map((x) => <option value={x.value}>{x.label}</option>)}</select>
        </label>
      </div>
      {editing && editable && <p class="pv-edit-note small" role="status">고칠 글자를 누르고 쓰세요. Enter로 마치고 Esc로 그만둬요. 그림을 누르면 바꿀 수 있어요.</p>}
      <div class="pv-stage preview-frame">
        <div class="pv-tools">
          <div class="seg pv-devices" role="group" aria-label="화면 크기">
            {DEVICES.map((x) => <button type="button" aria-pressed={String(d.value === x.value)} onClick={() => setDevice(x.value)} title={x.w ? `${x.label} ${x.w}×${x.h}` : '미리보기 크기 그대로'}><Icon name={x.icon} /><span class="pv-label">{x.label}</span></button>)}
          </div>
          <button type="button" class="icon-btn" disabled={!d.rotate} aria-pressed={String(!!turned)} onClick={() => setLand(!land)} aria-label="가로로 돌리기" title={d.rotate ? (turned ? '세로로 보기' : '가로로 보기') : '태블릿·휴대폰에서 돌려 볼 수 있어요'}><Icon name="rotate" /></button>
          <span class="pv-size">{vw ? `${vw} × ${vh}` : ''}{box.w ? <span class="pv-zoom"> · {Math.round(scale * 100)}%</span> : ''}</span>
          <button type="button" class="icon-btn pv-full" aria-pressed={String(full)} onClick={() => setFull(!full)} aria-label={full ? '작게 보기' : '크게 보기'} title={full ? '작게 보기(Esc)' : '크게 보기'}><Icon name={full ? 'shrink' : 'expand'} /></button>
        </div>
        <div class={`pv-canvas ${fit ? 'is-fit' : ''}`} ref={canvas}>
          {err ? <p class="pv-wait" role="alert">{err}</p> : html && box.w > 0 ? (
            <div class={`pv-device is-${fit ? 'fit' : d.icon}${turned ? ' is-land' : ''}`} style={fit ? undefined : { width: `${Math.round(vw * scale)}px`, height: `${Math.round(vh * scale)}px`, '--s': scale }}>
              <iframe ref={frame} onLoad={() => { post({ type: 'lp-edit', on: !!editing && page === 'index.html' }); if (y.current) post({ type: 'lp-goto', y: y.current }); }}
                title="연수 사이트 미리보기" tabIndex={focusable ? 0 : -1}
                sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals" srcdoc={html}
                style={fit ? undefined : { width: `${vw}px`, height: `${vh}px`, transform: `scale(${scale})` }} />
            </div>
          ) : <p class="muted pv-wait">미리보기를 만드는 중…</p>}
        </div>
      </div>
      <div class="pv-foot small muted">
        <span>참여 기능은 연습 모드라 이 화면에서만 보여요.</span>
        <button class="btn btn-sm btn-quiet" onClick={() => setFocusable(!focusable)} aria-pressed={String(focusable)}>{focusable ? '키보드 둘러보기 끄기' : '키보드로 둘러보기'}</button>
      </div>
    </div>
  );
}
