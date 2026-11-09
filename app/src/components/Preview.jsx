import { useEffect, useRef, useState } from 'preact/hooks';
import { buildSite, previewHtml } from '../lib/engine.js';
import { blobs } from '../lib/db.js';
import { Seg } from './ui.jsx';

const assetCache = new Map();
export async function projectAssets(pid, fresh = false) {
  if (!fresh && assetCache.has(pid)) return assetCache.get(pid);
  const a = await blobs.all(pid); assetCache.set(pid, a); return a;
}
export function dropAssetCache(pid) { assetCache.delete(pid); }

/**
 * 샌드박스 iframe 미리보기. allow-same-origin을 주지 않아 미리보기 안 코드는 앱 저장소(키·프로젝트)에 닿지 못합니다.
 */
export function Preview({ p, height }) {
  const [device, setDevice] = useState('desktop');
  const [page, setPage] = useState('index.html');
  const [html, setHtml] = useState('');
  const [report, setReport] = useState(null);
  const t = useRef();
  useEffect(() => {
    if (!p.blueprint) return;
    clearTimeout(t.current);
    t.current = setTimeout(async () => {
      const assets = await projectAssets(p.id);
      const r = buildSite(p.blueprint, assets);
      if (r.errors?.length) { setHtml(`<p style="font:16px sans-serif;padding:24px">${r.errors.map((e) => e.message_ko).join('<br>')}</p>`); return; }
      setReport(r.report);
      const pg = r.files[page] ? page : 'index.html';
      setHtml(previewHtml(r.files, pg));
    }, 350);
    return () => clearTimeout(t.current);
  }, [p.blueprint, page]);
  const live = p.blueprint?.live?.provider && p.blueprint.live.provider !== 'none';
  return (
    <div class="preview">
      <div class="spread">
        <Seg label="기기" value={device} onChange={setDevice} options={[{ value: 'desktop', label: 'PC' }, { value: 'phone', label: '휴대폰' }]} />
        <Seg label="페이지" value={page} onChange={setPage} options={[{ value: 'index.html', label: '참가자' }, ...(live ? [{ value: 'console.html', label: '강사 콘솔' }] : []), { value: 'screen.html', label: '프로젝터' }, { value: 'check.html', label: '접속 진단' }]} />
      </div>
      <div class={`preview-frame${device === 'phone' ? ' phone' : ''}`} style={height ? { height } : undefined}>
        {html ? <iframe title="연수 사이트 미리보기" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals" srcdoc={html} loading="lazy" /> : <p class="muted" style={{ padding: '20px' }}>미리보기를 만드는 중…</p>}
      </div>
      {report && <p class="small muted">프리셋 {report.preset} · 모션 {report.motion}단계 · 효과 {report.effects.length}개 · 약 {report.sizeKB}KB{live ? ' · 미리보기의 실시간 기능은 이 화면 안에서만 동작해요' : ''}</p>}
    </div>
  );
}
