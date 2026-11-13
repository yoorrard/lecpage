import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Field, Progress } from '../components/ui.jsx';
import { Mascot } from '../components/Mascot.jsx';
import { Preview } from '../components/Preview.jsx';
import { QR } from '../components/QR.jsx';
import { loadExample, newProject } from '../lib/project.js';
import { sanitizeImported } from '../lib/blueprint.js';
import { copy, toast } from '../lib/util.js';
import { buildSite, previewHtml } from '../lib/engine.js';
import { SayFix } from '../design-words/SayFix.jsx';
import { applyWords } from '../design-words/words.js';
import { setTry, useBus } from '../design-words/bus.js';

// 체험하기: 예시 교재로 '교재 넣기 → 살펴보고 고치기 → 배포하기'를 그대로 따라 해 봅니다.
// AI 답과 배포는 흉내만 냅니다. 키가 필요 없고, 어디로도 보내지 않으며, 프로젝트로 저장하지 않습니다(이 화면의 메모리에만 있음).
const EXAMPLE = 'data-lab';
const STEPS = ['교재 넣기', '살펴보고 고치기', '배포하기'];
const TIP = [
  '예시 교재와 연수 정보가 들어 있어요. [AI로 사이트 만들기]를 눌러 보세요.',
  '[너무 심심해요]처럼 보이는 느낌을 눌러 보세요. 바꾼 모습을 보고 [적용하기]를 누르면 미리보기가 바뀌어요.',
  '[배포하기]를 누르면 주소와 QR이 나와요.',
];
const exampleUrl = () => new URL(`examples/${EXAMPLE}/index.html`, location.href.split('#')[0]).href;

export function Demo() {
  const [bp, setBp] = useState(null);
  const [step, setStep] = useState(1);
  const [making, setMaking] = useState(false); // AI가 만드는 중(흉내)
  const [pub, setPub] = useState(''); // '' | 'busy' | 'done'
  const [pct, setPct] = useState(0);
  const [hist, setHist] = useState([]); // 말로 고치기 되돌리기(이 화면 안에서만)
  const [applied, setApplied] = useState('');
  const bus = useBus('demo');
  const timers = useRef([]);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => { loadExample(EXAMPLE).then((b) => setBp(sanitizeImported(b))); return () => timers.current.forEach(clearTimeout); }, []);
  useEffect(() => { document.querySelector('.demo h1')?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, [step]);
  // 누를 곳 안내(코치 마크): 지금 누를 버튼 하나에 테두리와 '여기를 눌러요'. 말로 하는 안내는 위의 안내 줄(role=status)이 함.
  // 따로 라이브러리를 쓰지 않음(Driver.js는 MIT·약 5KB지만 체험 한 화면에는 이것으로 충분, Shepherd는 AGPL·상용 이중 라이선스라 뺌)
  const [coach, setCoach] = useState(() => { try { return localStorage.getItem('lecpage:coach') !== 'off'; } catch { return true; } });
  const toggleCoach = () => { const v = !coach; setCoach(v); try { localStorage.setItem('lecpage:coach', v ? 'on' : 'off'); } catch { } };
  useEffect(() => {
    const clear = () => document.querySelectorAll('[data-coach]').forEach((e) => e.removeAttribute('data-coach'));
    if (!coach) { clear(); return undefined; }
    let last = null;
    const target = () => {
      const q = (sel) => document.querySelector(sel);
      if (step === 1) return q('.demo .make-bar .btn-primary');
      if (step === 2) return making ? null : q('.demo .fix-card.is-done') ? q('.demo .head-tools .btn-primary') : q('.demo .fix-card .btn-primary') || q('.demo .sayfix .chip');
      return pub === 'done' ? q('.demo .demo-done a.btn-primary') : pub ? null : q('.demo .demo-pub .btn-primary');
    };
    const tick = () => {
      const el = target(); if (el === last) return;
      clear(); last = el;
      if (el) { el.setAttribute('data-coach', ''); const r = el.getBoundingClientRect(); if (r.bottom > innerHeight || r.top < 0) el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
    };
    tick(); const t = setInterval(tick, 400);
    return () => { clearInterval(t); clear(); };
  }, [coach, step, making, pub]);
  const p = useMemo(() => ({ id: 'demo', blueprint: bp }), [bp]);
  const meta = bp?.meta || {};
  const hero = bp?.sections.find((s) => s.type === 'hero') || {};
  const setMeta = (patch) => setBp((b) => ({ ...b, meta: { ...b.meta, ...patch } }));
  const setHero = (patch) => setBp((b) => ({ ...b, sections: b.sections.map((s) => (s.type === 'hero' ? { ...s, ...patch } : s)) }));
  const applyFix = (f) => { setHist((h) => [...h, bp]); setBp((b) => applyWords(b, f.ids)); setApplied(f.key); setTry('demo', null); };
  const undoFix = () => { const last = hist[hist.length - 1]; if (!last) return; setBp(last); setHist(hist.slice(0, -1)); setApplied(''); };
  const tryFix = (f) => setTry('demo', f ? { key: f.key, bp: applyWords(bp, f.ids), label: f.title, focus: f.focus, apply: () => applyFix(f) } : null);

  function make() { setMaking(true); setStep(2); later(() => setMaking(false), 2600); }
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
  async function startReal(kind) { const np = await newProject(kind, EXAMPLE); location.hash = `#/p/${np.id}/${kind === 'example' ? 2 : 1}`; }

  const url = exampleUrl();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(meta.date || '') ? new Date(meta.date + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }) : '';
  const when = [day, [meta.start, meta.end].filter(Boolean).join('~')].filter(Boolean).join(' ');
  const invite = `[${meta.title}] 연수 사이트예요.\n${[when, meta.venue].filter(Boolean).join(' · ')}\n아래 주소로 들어오세요.\n${url}`;

  return (
    <div class="wiz demo">
      <aside class="demo-bar" aria-label="체험 안내">
        <span class="demo-tag">체험</span>
        <span class="demo-bar-t"><b>예시 자료로 해 보는 연습이에요.</b> 어디로도 보내지 않고, 저장하지 않아요.</span>
        <button type="button" class="btn btn-sm btn-quiet" aria-pressed={String(coach)} onClick={toggleCoach}>누를 곳 안내</button>
        <a class="btn btn-sm" href="#/">체험 끝내기</a>
      </aside>
      <header class="wiz-head">
        <p class="wiz-title">{meta.title || '체험하기'}</p>
        <ol class="stepper" aria-label="만드는 순서">
          {STEPS.map((name, i) => <li><a href="#/demo" class={i + 1 < step ? 'done' : ''} aria-current={i + 1 === step ? 'step' : undefined} aria-disabled={i + 1 > step ? 'true' : undefined} onClick={(e) => { e.preventDefault(); if (i + 1 < step && !making && pub !== 'busy') setStep(i + 1); }}><span class="n">{i + 1}</span><span class="t">{name}</span></a></li>)}
        </ol>
        <span />
      </header>
      <p class="demo-tip" role="status"><span class="demo-tip-n">{step}/3</span>{making ? 'AI가 만드는 동안 잠깐 기다려요. 실제로는 1~2분 걸려요.' : pub === 'done' ? '여기까지가 전부예요. 이제 내 교재로 해 보세요.' : TIP[step - 1]}</p>
      {!bp ? <p class="muted">불러오는 중…</p> : (
        <div class="wiz-main">
          {step === 1 && <>
            <div class="step-head"><div class="step-head-t"><h1 tabIndex={-1}>교재를 넣으면 AI가 사이트를 만들어요</h1><p>실제로는 PPT·PDF·한글(HWP·HWPX)·워드 파일을 여기에 놓아요.</p></div></div>
            <ul class="files" aria-label="교재 파일(예시)">
              <li><span class="kind">PPTX</span><div><b>{meta.title}.pptx</b><div class="small muted">예시 교재 · 2.4MB · 32쪽</div></div><span class="tag tag-butter">예시</span></li>
            </ul>
            <section class="block">
              <h2 class="h-sub">연수 정보 <span class="small muted">교재에서 찾은 값을 채웠어요</span></h2>
              <div class="form-grid">
                <Field label="연수명"><input value={meta.title} onInput={(e) => setMeta({ title: e.target.value })} maxLength={160} /></Field>
                <Field label="날짜"><input type="date" value={meta.date} onInput={(e) => setMeta({ date: e.target.value })} /></Field>
                <Field label="장소"><input value={meta.venue} onInput={(e) => setMeta({ venue: e.target.value })} maxLength={120} /></Field>
              </div>
            </section>
            <div class="make-bar"><button class="btn btn-primary btn-lg nudge" disabled={!meta.title?.trim()} onClick={make}>AI로 사이트 만들기 →</button></div>
            <p class="small muted ai-priv">실제로 만들 때는 AI를 한 번 연결해요. 체험에서는 미리 만들어 둔 결과를 보여 줘요.</p>
          </>}
          {step === 2 && <>
            <div class="step-head"><div class="step-head-t"><h1 tabIndex={-1}>살펴보고 고치기</h1></div>
              <div class="btn-row head-tools"><button class={`btn btn-primary${making ? '' : ' nudge'}`} disabled={making} onClick={() => setStep(3)}>배포하기 →</button></div></div>
            {making ? (
              <div class="demo-wait" role="status"><Mascot size={84} mood="think" look /><b>AI가 교재를 읽고 연수 흐름과 문구를 짜고 있어요</b><span class="small muted">체험이라 실제로 보내지는 않아요.</span></div>
            ) : (
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
            )}
          </>}
          {step === 3 && <>
            <div class="step-head"><div class="step-head-t"><h1 tabIndex={-1}>배포하기</h1><p>실제로는 처음 한 번만 배포할 곳을 연결해요. 고친 뒤 다시 배포해도 주소는 그대로예요.</p></div></div>
            {pub !== 'done' ? (
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
                  <div class="btn-row"><button class="btn btn-primary btn-lg" onClick={() => startReal('blank')}>내 교재로 시작하기</button><button class="btn" onClick={() => startReal('example')}>이 예시를 고쳐 쓰기</button><button class="btn btn-quiet" onClick={() => { setPub(''); setStep(1); }}>처음부터 다시 체험</button></div>
                </div>
              </section>
            )}
          </>}
        </div>
      )}
    </div>
  );
}
