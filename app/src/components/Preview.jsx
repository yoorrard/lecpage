import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { buildSite, previewHtml } from '../lib/engine.js';
import { blobs } from '../lib/db.js';

const assetCache = new Map();
export async function projectAssets(pid, fresh = false) {
  if (!fresh && assetCache.has(pid)) return assetCache.get(pid);
  const all = await blobs.all(pid);
  const a = {}; for (const [k, v] of Object.entries(all)) if (k.startsWith('assets/')) a[k] = v; // 교재 원본(src/)은 사이트에 넣지 않음
  assetCache.set(pid, a); return a;
}
export function dropAssetCache(pid) { assetCache.delete(pid); }

// 화면 크기(CSS 픽셀). 근거: docs/research/preview-responsive-2026-11.md
export const DEVICES = [
  { value: 'monitor', label: '모니터', w: 1920, h: 1080, icon: 'monitor' },
  { value: 'laptop', label: '노트북', w: 1536, h: 864, icon: 'laptop' },
  { value: 'tablet', label: '태블릿', w: 820, h: 1180, icon: 'tablet', rotate: true },
  { value: 'phone', label: '휴대폰', w: 360, h: 780, icon: 'phone', rotate: true }, // 국내에서 흔한 가장 좁은 갤럭시 폭
  { value: 'fit', label: '맞춤', icon: 'fit' },
];
const PAGES = [{ value: 'index.html', label: '참가자 화면' }, { value: 'console.html', label: '강사 화면', live: true }, { value: 'screen.html', label: '발표 화면' }, { value: 'poster.html', label: 'QR 안내문' }, { value: 'check.html', label: '접속 확인' }];

const store = {
  get(k, d) { try { return localStorage.getItem('lp-preview-' + k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('lp-preview-' + k, v); } catch { } },
};

const ICONS = {
  monitor: <><rect x="2.5" y="3.5" width="19" height="13" rx="1.5" /><path d="M8 20.5h8M12 16.5v4" /></>,
  laptop: <><rect x="4.5" y="4.5" width="15" height="10.5" rx="1.2" /><path d="M2 18.5h20" /></>,
  tablet: <><rect x="5" y="2.5" width="14" height="19" rx="2" /><path d="M11 18.5h2" /></>,
  phone: <><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18.5h2" /></>,
  fit: <><path d="M3 5v14M21 5v14" /><path d="M7 12h10M10 9l-3 3 3 3M14 9l3 3-3 3" /></>,
  rotate: <><path d="M4 12a8 8 0 0 1 13.6-5.7L20 8.5" /><path d="M20 3.5v5h-5" /><path d="M20 12a8 8 0 0 1-13.6 5.7L4 15.5" /><path d="M4 20.5v-5h5" /></>,
  expand: <><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></>,
  shrink: <><path d="M20 10h-6V4M4 14h6v6M14 10l7-7M10 14l-7 7" /></>,
};
export function Icon({ name, size = 18 }) {
  return <svg class="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONS[name]}</svg>;
}

/** 놓인 상자의 크기를 따라감 */
function useBox(ref) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => { const r = e.contentRect; setBox((b) => (Math.abs(b.w - r.width) < 1 && Math.abs(b.h - r.height) < 1 ? b : { w: r.width, h: r.height })); });
    ro.observe(el); return () => ro.disconnect();
  }, []);
  return box;
}

/**
 * 샌드박스 iframe 미리보기. allow-same-origin을 주지 않아 미리보기 안 코드는 앱 저장소(키·프로젝트)에 닿지 못합니다.
 * 고른 기기의 실제 폭으로 그린 뒤 칸에 맞게 줄여 보여 줘요(사이트의 반응형 규칙이 그대로 적용됨).
 */
export function Preview({ p, onPick, frameRef, marking, onMark }) {
  const [device, setDeviceRaw] = useState(() => store.get('device', typeof innerWidth === 'number' && innerWidth < 700 ? 'phone' : 'laptop'));
  const [land, setLandRaw] = useState(() => store.get('land', '') === '1');
  const [full, setFull] = useState(false);
  const [page, setPage] = useState('index.html');
  const [html, setHtml] = useState('');
  const [size, setSize] = useState(0);
  const [focusable, setFocusable] = useState(false);
  const [picking, setPicking] = useState(false);
  const t = useRef(); const frame = useRef(); const canvas = useRef(); const wasMarking = useRef(false);
  const box = useBox(canvas);
  const setDevice = (v) => { setDeviceRaw(v); store.set('device', v); };
  const setLand = (v) => { setLandRaw(v); store.set('land', v ? '1' : ''); };

  const sendPick = (on) => { try { frame.current?.contentWindow?.postMessage({ type: 'lp-pick', on }, '*'); } catch { } };
  useEffect(() => {
    if (!onPick) return;
    const ids = new Set((p.blueprint?.sections || []).map((s) => s.id));
    const f = (e) => { if (e.source !== frame.current?.contentWindow) return; const d = e.data; if (d && d.type === 'lp-picked' && typeof d.id === 'string' && ids.has(d.id)) { onPick(d.id); setFull(false); } };
    addEventListener('message', f); return () => removeEventListener('message', f);
  }, [onPick, p.blueprint]);
  useEffect(() => { sendPick(picking); }, [picking]);
  useEffect(() => {
    if (!p.blueprint) return;
    clearTimeout(t.current);
    t.current = setTimeout(async () => {
      const assets = await projectAssets(p.id);
      const r = await buildSite(p.blueprint, assets);
      if (r.errors?.length) { setHtml(`<p style="font:16px sans-serif;padding:24px">${r.errors.map((e) => e.message_ko).join('<br>')}</p>`); return; }
      setSize(r.report.sizeKB);
      const pg = r.files[page] ? page : 'index.html';
      setHtml(previewHtml(r.files, pg));
    }, 350);
    return () => clearTimeout(t.current);
  }, [p.blueprint, page]);
  // 크게 보기: Esc로 닫고, 표시를 마치면(대화창에 붙으면) 원래 크기로
  useEffect(() => {
    if (!full) return;
    const k = (e) => { if (e.key === 'Escape' && !marking) setFull(false); };
    addEventListener('keydown', k); document.documentElement.classList.add('pv-lock');
    return () => { removeEventListener('keydown', k); document.documentElement.classList.remove('pv-lock'); };
  }, [full, marking]);
  useEffect(() => { if (wasMarking.current && !marking) setFull(false); wasMarking.current = !!marking; }, [marking]);

  const live = p.blueprint?.live?.provider && p.blueprint.live.provider !== 'none';
  const pages = PAGES.filter((x) => !x.live || live);
  const d = DEVICES.find((x) => x.value === device) || DEVICES[1];
  const fit = d.value === 'fit';
  const turned = d.rotate && land;
  const vw = fit ? Math.round(box.w) : turned ? d.h : d.w;
  const vh = fit ? Math.round(box.h) : turned ? d.w : d.h;
  const scale = fit || !box.w ? 1 : Math.min(1, box.w / vw, box.h / vh) // box는 여백을 뺀 크기;
  const kind = fit ? 'fit' : d.icon;

  return (
    <div class={`preview${full ? ' full' : ''}`} role={full ? 'dialog' : undefined} aria-modal={full ? 'true' : undefined} aria-label={full ? '크게 보기' : undefined}>
      <div class="pv-bar">
        <div class="pv-actions">
          {onMark && <button class="btn btn-sm" disabled={!!marking} onClick={() => onMark('draw')} title="미리보기에 펜으로 표시해 AI에게 고쳐 달라고 해요">✎ 표시하기</button>}
          {onPick && page === 'index.html' && <button class={`btn btn-sm${picking ? ' btn-ink' : ' btn-quiet'}`} aria-pressed={String(picking)} onClick={() => setPicking(!picking)} title="미리보기에서 칸을 누르면 바로 고칠 수 있어요">{picking ? '고칠 칸을 누르세요' : '눌러서 고치기'}</button>}
        </div>
        <label class="pv-page"><span class="sr">미리볼 화면</span>
          <select value={page} onChange={(e) => setPage(e.target.value)}>{pages.map((x) => <option value={x.value}>{x.label}</option>)}</select>
        </label>
      </div>
      <div class={`pv-stage preview-frame${marking ? ' marking' : ''}`}>
        <div class="pv-tools">
          <div class="seg pv-devices" role="group" aria-label="화면 크기">
            {DEVICES.map((x) => (
              <button type="button" aria-pressed={String(device === x.value)} onClick={() => setDevice(x.value)} title={x.w ? `${x.label} ${x.w}×${x.h}` : '미리보기 크기 그대로'}>
                <Icon name={x.icon} /><span class="pv-label">{x.label}</span>
              </button>
            ))}
          </div>
          <button type="button" class="icon-btn" disabled={!d.rotate} aria-pressed={String(!!turned)} onClick={() => setLand(!land)} aria-label="가로로 돌리기" title={d.rotate ? (turned ? '세로로 보기' : '가로로 보기') : '태블릿·휴대폰에서 돌려 볼 수 있어요'}><Icon name="rotate" /></button>
          <span class="pv-size">{vw ? `${vw} × ${vh}` : ''}{box.w ? <span class="pv-zoom"> · {Math.round(scale * 100)}%</span> : ''}</span>
          <button type="button" class="icon-btn pv-full" aria-pressed={String(full)} onClick={() => setFull(!full)} aria-label={full ? '작게 보기' : '크게 보기'} title={full ? '작게 보기(Esc)' : '크게 보기'}><Icon name={full ? 'shrink' : 'expand'} /></button>
        </div>
        <div class={`pv-canvas ${fit ? 'is-fit' : ''}`} ref={canvas}>
          {html && box.w > 0 ? (
            <div class={`pv-device is-${kind}${turned ? ' is-land' : ''}`} style={fit ? undefined : { width: `${Math.round(vw * scale)}px`, height: `${Math.round(vh * scale)}px`, '--s': scale }}>
              <iframe
                ref={(el) => { frame.current = el; if (frameRef) frameRef.current = el; }}
                onLoad={() => sendPick(picking)}
                title="연수 사이트 미리보기"
                tabIndex={focusable ? 0 : -1}
                sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals"
                srcdoc={html}
                style={fit ? undefined : { width: `${vw}px`, height: `${vh}px`, transform: `scale(${scale})` }}
              />
            </div>
          ) : <p class="muted pv-wait">미리보기를 만드는 중…</p>}
        </div>
      </div>
      <div class="pv-foot small muted">
        <span>{live ? '참여 기능은 미리보기 안에서 시험해 볼 수 있어요.' : '고친 내용이 바로 반영돼요.'}{size ? ` 사이트 크기 약 ${size >= 1000 ? (size / 1000).toFixed(1) + 'MB' : size + 'KB'}` : ''}</span>
        <button class="btn btn-sm btn-quiet" onClick={() => setFocusable(!focusable)} aria-pressed={String(focusable)}>{focusable ? '키보드 둘러보기 끄기' : '키보드로 둘러보기'}</button>
      </div>
    </div>
  );
}
