// 체험하기의 2·3단계(살펴보고 고치기·배포하기): 미리보기·엔진·말로 고치기·QR을 쓰는 무거운 부분.
// 1단계(교재 넣기)를 먼저 그리고 그다음 틈에 받아요(Demo.jsx). 그래서 체험의 첫 화면이 엔진을 기다리지 않아요.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Field, Progress } from '../components/ui.jsx';
import { Preview } from '../components/Preview.jsx';
import { QR } from '../components/QR.jsx';
import { newProject } from '../lib/project.js';
import { copy, toast } from '../lib/util.js';
import { buildSite, previewHtml } from '../lib/engine.js';
import { SayFix } from '../design-words/SayFix.jsx';
import { applyWords } from '../design-words/words.js';
import { setTry, useBus } from '../design-words/bus.js';

export { sanitizeImported as sanitize } from '../lib/blueprint.js';

/** 2단계 본문: AI 결과 띠 + 고쳐 보기(연수명·첫 화면 제목·디자인 말로 고치기) + 미리보기 */
export function DemoEdit({ bp, setBp, hist, setHist, applied, setApplied }) {
  const p = useMemo(() => ({ id: 'demo', blueprint: bp }), [bp]);
  const bus = useBus('demo');
  const meta = bp.meta || {};
  const hero = bp.sections.find((s) => s.type === 'hero') || {};
  const setMeta = (patch) => setBp((b) => ({ ...b, meta: { ...b.meta, ...patch } }));
  const setHero = (patch) => setBp((b) => ({ ...b, sections: b.sections.map((s) => (s.type === 'hero' ? { ...s, ...patch } : s)) }));
  const applyFix = (f) => { setHist((h) => [...h, bp]); setBp((b) => applyWords(b, f.ids)); setApplied(f.key); setTry('demo', null); };
  const undoFix = () => { const last = hist[hist.length - 1]; if (!last) return; setBp(last); setHist(hist.slice(0, -1)); setApplied(''); };
  const tryFix = (f) => setTry('demo', f ? { key: f.key, bp: applyWords(bp, f.ids), label: f.title, focus: f.focus, apply: () => applyFix(f) } : null);
  return (
    <>
      <div class="ai-job ok" role="status"><span class="ai-job-t"><b>AI가 교재에 맞게 사이트를 짰어요.</b><small>섹션 {bp.sections.length}개를 만들었어요. 실제 화면에서는 내용·디자인·참여 기능을 모두 고칠 수 있어요.</small></span></div>
      <div class="workspace">
        <div class="ws-panel">
          <div class="stack demo-edit">
            <h2 class="h-sub">고쳐 보기</h2>
            <Field label="연수명"><input value={meta.title} onInput={(e) => setMeta({ title: e.target.value })} maxLength={160} /></Field>
            <Field label="첫 화면 제목"><textarea class="ta-short" rows={2} value={hero.title || ''} onInput={(e) => setHero({ title: e.target.value })} maxLength={120} /></Field>
            <SayFix bp={bp} onApply={applyFix} onUndo={undoFix} applied={applied} onTry={tryFix} tried={bus.try?.key} title="디자인 말로 고치기" desc="예시를 눌러 보세요. 실제 앱의 [디자인] 탭에서도 이렇게 바로 바뀌어요." idp="demosay" />
          </div>
        </div>
        <Preview p={p} />
      </div>
    </>
  );
}

/** 3단계 본문: 공개 범위 → [배포하기](흉내) → 주소·QR·카톡 안내 문구 → 내 교재로 시작 */
export function DemoPublish({ bp, pub, setPub, url, onAgain }) {
  const [pct, setPct] = useState(0);
  const timers = useRef([]);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const meta = bp.meta || {};
  function publish() {
    setPub('busy'); setPct(12);
    later(() => setPct(55), 500); later(() => setPct(90), 1100); later(() => { setPct(100); setPub('done'); }, 1700);
  }
  /**
   * 사이트 열어 보기: 방금 고친 체험 사이트를 실제 배포본과 같은 파일로 만들어 새 탭에 엶(한 파일로 묶어 blob 주소로).
   * 새 탭은 누르는 순간 열어 두고(팝업 막힘 방지) 다 만들면 채움. 만들지 못하면 미리 만들어 둔 예시 사이트로
   */
  async function openSite(e) {
    e.preventDefault();
    const w = window.open('', '_blank');
    try {
      const r = await buildSite({ ...bp, live: { ...(bp.live || {}), provider: 'local' } }, {});
      if (r.errors?.length) throw new Error('build');
      const blob = URL.createObjectURL(new Blob([previewHtml(r.files, 'index.html')], { type: 'text/html' }));
      if (w) w.location.href = blob; else window.open(blob, '_blank');
      setTimeout(() => URL.revokeObjectURL(blob), 60000);
    } catch { if (w) w.location.href = url; else window.open(url, '_blank', 'noopener'); toast('예시 사이트를 열었어요.'); }
  }
  async function startReal(kind) { const np = await newProject(kind, 'data-lab'); location.hash = `#/p/${np.id}/${kind === 'example' ? 2 : 1}`; }
  const day = /^\d{4}-\d{2}-\d{2}$/.test(meta.date || '') ? new Date(meta.date + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }) : '';
  const when = [day, [meta.start, meta.end].filter(Boolean).join('~')].filter(Boolean).join(' ');
  const invite = `[${meta.title}] 연수 사이트예요.\n${[when, meta.venue].filter(Boolean).join(' · ')}\n아래 주소로 들어오세요.\n${url}`;
  return pub !== 'done' ? (
    <section class="demo-pub">
      <p><b>공개 범위</b> 주소를 받은 사람만 <span class="small muted">기본값이에요. 암호를 걸거나 누구나 보게 할 수도 있어요.</span></p>
      <div class="make-bar"><button class={`btn btn-primary btn-lg${pub ? '' : ' nudge'}`} disabled={!!pub} onClick={publish}>{pub ? '배포하는 중…' : '배포하기'}</button></div>
      {pub === 'busy' && <div class="demo-progress" role="status"><Progress pct={pct} /><span class="small muted">사이트를 배포하는 흉내를 내고 있어요.</span></div>}
    </section>
  ) : (
    <section class="demo-done">
      <div class="demo-done-main">
        <div class="qr-box"><QR text={url} size={168} label="예시 사이트 QR" /></div>
        <div class="stack">
          <h2 class="h-sub">주소와 QR이 나왔어요</h2>
          <p class="demo-url"><a href={url} target="_blank" rel="noopener">{url.replace(/^https?:\/\//, '')}</a></p>
          <p class="small muted">[사이트 열어 보기]는 방금 고친 그대로 보여 줘요. 체험이라 실제로 배포하지는 않았고, 주소와 QR은 미리 만든 예시 사이트로 이어져요.</p>
          <div class="btn-row"><a class="btn btn-sm btn-primary" href={url} target="_blank" rel="noopener" onClick={openSite}>사이트 열어 보기</a><button class="btn btn-sm" onClick={() => copy(invite, '안내 문구를 복사했어요.')}>카톡 안내 문구 복사</button></div>
        </div>
      </div>
      <pre class="prompt-box demo-invite" aria-label="카톡 안내 문구">{invite}</pre>
      <div class="demo-next">
        <b>이제 내 교재로 해 보세요.</b>
        <div class="btn-row"><button class="btn btn-primary btn-lg" onClick={() => startReal('blank')}>내 교재로 시작하기</button><button class="btn btn-lg" onClick={() => startReal('example')}>이 예시를 고쳐 쓰기</button><button class="btn btn-quiet" onClick={onAgain}>처음부터 다시 체험</button></div>
      </div>
    </section>
  );
}
