import { useEffect, useRef, useState } from 'preact/hooks';
import { buildSite, previewHtml } from '../lib/engine.js';
import { labelCss } from './words.js';

let LABELS = '';
const labels = () => LABELS || (LABELS = labelCss());

/**
 * 움직이는 실제 화면(크게 보기): 설계도를 그대로 그려 스크립트까지 돌려요. 잠깐 첫 화면을 보여 준 뒤 본문 끝까지 천천히 내려가요(손을 대면 멈춤).
 * [배치 이름 보기]를 켜면 섹션마다 본문 배치 이름이 붙어요. focus를 주면 그 섹션부터 보여요.
 */
export function LiveSite({ bp, title = '디자인 미리보기', focus = '' }) {
  const box = useRef(); const frame = useRef();
  const [html, setHtml] = useState(''); const [s, setS] = useState(0.5); const [run, setRun] = useState(0); const [named, setNamed] = useState(false);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setS(e.contentRect.width / 1280)); ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => {
    let off = false; setHtml('');
    const b = { ...bp, live: { ...(bp.live || {}), provider: 'none', features: [] } };
    buildSite(b, {}).then((r) => { if (!off && !r.errors?.length) setHtml(previewHtml(r.files, 'index.html', { tour: !focus, extraCss: labels() })); }).catch(() => { });
    return () => { off = true; };
  }, [bp, run]);
  const post = (m) => { try { frame.current?.contentWindow?.postMessage(m, '*'); } catch { } };
  useEffect(() => { post({ type: 'lp-labels', on: named }); }, [named]);
  return (
    <div class="preset-live" ref={box} style={{ '--s': s }}>
      {html ? <iframe ref={frame} sandbox="allow-scripts" srcdoc={html} title={title} onLoad={() => { post({ type: 'lp-labels', on: named }); if (focus) post({ type: 'lp-scroll', id: focus }); }} style={{ width: '1280px', height: '720px' }} /> : <span class="thumb-wait" />}
      <button type="button" class="btn btn-sm label-toggle" aria-pressed={String(named)} onClick={() => setNamed(!named)}>{named ? '배치 이름 끄기' : '배치 이름 보기'}</button>
      {!focus && <button type="button" class="btn btn-sm preset-live-tour" onClick={() => setRun(run + 1)}>처음부터 다시 둘러보기</button>}
    </div>
  );
}
