import { useEffect, useRef, useState } from 'preact/hooks';
import { buildSite, previewHtml } from '../lib/engine.js';
import { blobs } from '../lib/db.js';
import { Seg } from './ui.jsx';

const assetCache = new Map();
export async function projectAssets(pid, fresh = false) {
  if (!fresh && assetCache.has(pid)) return assetCache.get(pid);
  const all = await blobs.all(pid);
  const a = {}; for (const [k, v] of Object.entries(all)) if (k.startsWith('assets/')) a[k] = v; // 교재 원본(src/)은 사이트에 넣지 않음
  assetCache.set(pid, a); return a;
}
export function dropAssetCache(pid) { assetCache.delete(pid); }

/**
 * 샌드박스 iframe 미리보기. allow-same-origin을 주지 않아 미리보기 안 코드는 앱 저장소(키·프로젝트)에 닿지 못합니다.
 */
export function Preview({ p, height, onPick }) {
  const [device, setDevice] = useState('desktop');
  const [page, setPage] = useState('index.html');
  const [html, setHtml] = useState('');
  const [size, setSize] = useState(0);
  const [focusable, setFocusable] = useState(false);
  const [picking, setPicking] = useState(false);
  const t = useRef(); const frame = useRef();
  const sendPick = (on) => { try { frame.current?.contentWindow?.postMessage({ type: 'lp-pick', on }, '*'); } catch { } };
  useEffect(() => {
    if (!onPick) return;
    const ids = new Set((p.blueprint?.sections || []).map((s) => s.id));
    const f = (e) => { if (e.source !== frame.current?.contentWindow) return; const d = e.data; if (d && d.type === 'lp-picked' && typeof d.id === 'string' && ids.has(d.id)) { onPick(d.id); } };
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
  const live = p.blueprint?.live?.provider && p.blueprint.live.provider !== 'none';
  return (
    <div class="preview">
      <div class="spread">
        <div class="row" style={{ gap: '6px' }}>
          <Seg label="기기" value={device} onChange={setDevice} options={[{ value: 'desktop', label: 'PC' }, { value: 'phone', label: '휴대폰' }]} />
          {onPick && page === 'index.html' && <button class={`btn btn-sm${picking ? ' btn-ink' : ''}`} aria-pressed={String(picking)} onClick={() => setPicking(!picking)} title="미리보기에서 칸을 누르면 그 칸을 고칠 수 있어요">{picking ? '고를 칸을 누르세요' : '눌러서 고치기'}</button>}
        </div>
        <Seg label="미리볼 화면" value={page} onChange={setPage} options={[{ value: 'index.html', label: '참가자' }, ...(live ? [{ value: 'console.html', label: '강사 화면' }] : []), { value: 'screen.html', label: '발표 화면' }, { value: 'check.html', label: '와이파이 점검' }]} />
      </div>
      <div class={`preview-frame${device === 'phone' ? ' phone' : ''}`} style={height ? { height } : undefined}>
        {html ? <iframe ref={frame} onLoad={() => sendPick(picking)} title="연수 사이트 미리보기" tabIndex={focusable ? 0 : -1} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals" srcdoc={html} loading="lazy" /> : <p class="muted" style={{ padding: '20px' }}>미리보기를 만드는 중…</p>}
      </div>
      <div class="spread small muted">
        <span>{live ? '참여 기능은 미리보기 안에서 시험해 볼 수 있어요.' : '고친 내용이 바로 반영돼요.'}{size ? ` · 사이트 크기 약 ${size >= 1000 ? (size / 1000).toFixed(1) + 'MB' : size + 'KB'}` : ''}</span>
        <button class="btn btn-sm btn-quiet" onClick={() => setFocusable(!focusable)} aria-pressed={String(focusable)}>{focusable ? '미리보기 키보드 끄기' : '미리보기 안을 키보드로 둘러보기'}</button>
      </div>
    </div>
  );
}
