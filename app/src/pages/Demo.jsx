import { useEffect, useRef, useState } from 'preact/hooks';
import { Field } from '../components/ui.jsx';
import { Mascot } from '../components/Mascot.jsx';

// 체험하기: 예시 교재로 '교재 넣기 → 살펴보고 고치기 → 배포하기'를 그대로 따라 해 봅니다.
// 1단계는 실제 기본 길(쓰던 AI 창: [ChatGPT 열기]로 프롬프트 복사·AI 창 → 답 아래 [복사] → [답 넣기])과 같은 모양이고,
// AI 창과 배포는 흉내만 냅니다. 키가 필요 없고, 어디로도 보내지 않으며, 프로젝트로 저장하지 않습니다(이 화면의 메모리에만 있음).
// 2·3단계(미리보기·엔진·QR)는 DemoWork.jsx로 나눠 1단계를 그린 다음 틈에 받아요(첫 화면이 엔진을 기다리지 않게).
const STEPS = ['교재 넣기', '살펴보고 고치기', '배포하기'];
const BOTS = [{ id: 'chatgpt', name: 'ChatGPT', host: 'chatgpt.com' }, { id: 'claude', name: 'Claude', host: 'claude.ai' }, { id: 'gemini', name: 'Gemini', host: 'gemini.google.com' }];
const TIP1 = {
  send: '예시 교재와 연수 정보가 들어 있어요. [ChatGPT 열기]를 눌러 보세요.',
  typing: '프롬프트를 AI 창에 붙여 넣고 보냈어요. AI가 답을 쓰고 있어요.',
  ai: 'AI 답이 나왔어요. 답 아래의 [복사]를 누르세요.',
  paste: '답을 복사했어요. lecpage로 돌아와 [답 넣기]를 누르세요.',
};
const TIP = [
  '',
  '[너무 심심해요]처럼 보이는 느낌을 눌러 보세요. 바꾼 모습을 보고 [적용하기]를 누르면 미리보기가 바뀌어요.',
  '[배포하기]를 누르면 주소와 QR이 나와요.',
];
const exampleBp = () => import('../../../skills/lecpage/examples/data-lab.blueprint.json').then((m) => JSON.parse(JSON.stringify(m.default)));
const exampleUrl = () => new URL('examples/data-lab/index.html', location.href.split('#')[0]).href;
/**
 * 코치 꼬리표('여기를 눌러요') 자리: 아래 → 위 → 오른쪽 → 왼쪽 가운데 화면 안에 들고 다른 단추·글을 덮지 않는 첫 자리.
 * 빈자리가 없으면(좁은 화면의 칩 사이) 대상 아래를 꼬리표만큼 벌려 그 자리에 둠. 화면에 붙은 줄(sticky) 안이면 그 줄 안의 것만 피하고 화면 밖으로는 안 나가게.
 * keep: 지금 자리가 아직 비어 있으면 그대로 둠(둘레가 바뀌어 덮게 될 때만 옮겨서 꼬리표가 출렁이지 않게)
 */
function placeCoach(el, keep = false) {
  if (keep && el.hasAttribute('data-coach-room')) return;
  const cur = el.getAttribute('data-coach');
  if (!cur) el.setAttribute('data-coach', 'below');
  const st = getComputedStyle(el, '::after'), n = (v) => parseFloat(v) || 0, bb = st.boxSizing === 'border-box';
  const w = n(st.width) + (bb ? 0 : n(st.paddingLeft) + n(st.paddingRight)) || 110, h = n(st.height) + (bb ? 0 : n(st.paddingTop) + n(st.paddingBottom)) || 24;
  const r = el.getBoundingClientRect(), G = 10, cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
  const at = { below: [cx - w / 2, r.bottom + G], above: [cx - w / 2, r.top - G - h], right: [r.right + G, cy - h / 2], left: [r.left - G - w, cy - h / 2] };
  let pin = null;
  for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) if (/sticky|fixed/.test(getComputedStyle(e).position)) { pin = e; break; }
  const others = [...document.querySelectorAll('button,.btn,.chip,a,input,textarea,select,p,label,h1,h2,h3,li')]
    .filter((o) => o !== el && !el.contains(o) && !o.contains(el) && (!pin || pin.contains(o)) && !o.querySelector('button,.btn,.chip,p,li'))
    .map((o) => o.getBoundingClientRect()).filter((q) => q.width > 1 && q.height > 1);
  const hits = (side) => {
    const [x, y] = at[side];
    if (x < 0 || x + w > document.documentElement.clientWidth || y + scrollY < 0 || (pin && (y < 0 || y + h > innerHeight))) return Infinity;
    let hit = 0;
    for (const q of others) { const ix = Math.min(x + w, q.right) - Math.max(x, q.left), iy = Math.min(y + h, q.bottom) - Math.max(y, q.top); if (ix > 1 && iy > 1) hit += ix * iy; }
    return hit;
  };
  if (keep && cur && at[cur] && !hits(cur)) return;
  let best = 'below', least = Infinity;
  for (const side of Object.keys(at)) { const hit = hits(side); if (hit < least) { least = hit; best = side; } if (!hit) break; }
  el.removeAttribute('data-coach-room');
  if (least && !pin) { best = 'below'; el.setAttribute('data-coach-room', ''); }
  el.setAttribute('data-coach', best);
}

/** 흉내 낸 AI 창: 붙여 넣은 프롬프트(첫 줄만) → AI가 쓴 답(설계도 앞부분) + 답 아래 [복사] */
function FakeChat({ bot, bp, typing, onCopy }) {
  const m = bp.meta || {};
  const one = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  const secs = (bp.sections || []).slice(0, 3).map((s) => `    { "type": "${s.type}", "title": "${one(s.title || m.title).slice(0, 18)}" }`);
  const code = ['{', `  "meta": { "title": "${one(m.title)}", … },`, '  "sections": [', secs.join(',\n') + ',', '    …', '  ]', '}'].join('\n');
  return (
    <div class="demo-ai" role="group" aria-label={`${bot.name} 창(체험용 흉내)`}>
      <div class="demo-ai-bar" aria-hidden="true"><i /><i /><i /><span>{bot.host}</span><em>체험용 흉내</em></div>
      <div class="demo-ai-body">
        <p class="demo-ai-me">너는 한국 강의·연수 사이트를 설계하는 편집자다. … <span>(lecpage가 복사한 프롬프트. 교재 32쪽과 연수 정보가 이어져요)</span></p>
        {typing ? <p class="demo-ai-typing"><span class="rc-dots" aria-hidden="true"><i /><i /><i /></span> 답을 쓰는 중이에요. 실제로는 1~2분 걸려요.</p> : <div class="demo-ai-ans">
          <p>교재를 읽고 연수 설계도를 짰어요.</p>
          <pre class="demo-ai-code" aria-label="AI 답(설계도 앞부분)">{code}</pre>
          <div class="demo-ai-tools"><button type="button" class="btn btn-sm demo-ai-copy" onClick={onCopy}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>복사</button></div>
        </div>}
      </div>
    </div>
  );
}

export function Demo() {
  const [bp, setBp] = useState(null);
  const [W, setW] = useState(null); // 2·3단계 묶음(DemoWork.jsx)
  const [step, setStep] = useState(1);
  const [chat, setChat] = useState('send'); // 1단계 쓰던 AI 창: send(AI 창 열기) → ai(흉내 낸 창에 답) → paste([답 넣기])
  const [bot, setBot] = useState(null);
  const [typing, setTyping] = useState(false);
  const [making, setMaking] = useState(false); // 답으로 사이트를 조립하는 중(흉내)
  const [pub, setPub] = useState(''); // '' | 'busy' | 'done'
  const [hist, setHist] = useState([]); // 말로 고치기 되돌리기(이 화면 안에서만)
  const [applied, setApplied] = useState('');
  const timers = useRef([]);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => {
    let off = false;
    const raw = exampleBp();
    raw.then((b) => { if (!off) setBp((cur) => cur || b); }, () => { });
    // 2·3단계는 1단계를 그린 다음 틈에 받음. 받으면 예시 설계도를 앱이 가져온 설계도처럼 거름(1단계에서 고친 연수 정보는 그대로)
    const id = requestAnimationFrame(() => setTimeout(() => Promise.all([raw, import('./DemoWork.jsx')]).then(([b, m]) => { if (off) return; setW(() => m); setBp((cur) => m.sanitize(cur || b)); }, () => { }), 0));
    return () => { off = true; cancelAnimationFrame(id); timers.current.forEach(clearTimeout); };
  }, []);
  useEffect(() => { document.querySelector('.demo h1')?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, [step]);
  // 누를 곳 안내(코치 마크): 지금 누를 버튼 하나에 테두리와 '여기를 눌러요'. 말로 하는 안내는 위의 안내 줄(role=status)이 함(2단계는 안내 줄이 말하는 [너무 심심해요] 칩).
  // 따로 라이브러리를 쓰지 않음(Driver.js는 MIT·약 5KB지만 체험 한 화면에는 이것으로 충분, Shepherd는 AGPL·상용 이중 라이선스라 뺌)
  const [coach, setCoach] = useState(() => { try { return localStorage.getItem('lecpage:coach') !== 'off'; } catch { return true; } });
  const toggleCoach = () => { const v = !coach; setCoach(v); try { localStorage.setItem('lecpage:coach', v ? 'on' : 'off'); } catch { } };
  useEffect(() => {
    const clear = () => document.querySelectorAll('[data-coach]').forEach((e) => { e.removeAttribute('data-coach'); e.removeAttribute('data-coach-room'); });
    if (!coach) { clear(); return undefined; }
    let last = null;
    const target = () => {
      const q = (sel) => document.querySelector(sel);
      if (step === 1) return chat === 'send' ? q('.demo .chat-bots .chat-bot') : chat === 'ai' ? (typing ? null : q('.demo .demo-ai-copy')) : q('.demo .make-bar .btn-primary');
      if (step === 2) return making || !W ? null : q('.demo .fix-card.is-done') ? q('.demo .head-tools .btn-primary') : q('.demo .fix-card .btn-primary') || [...document.querySelectorAll('.demo .sayfix .chip')].find((c) => c.textContent === '너무 심심해요') || q('.demo .sayfix .chip');
      return pub === 'done' ? q('.demo .demo-done a.btn-primary') : pub ? null : q('.demo .demo-pub .btn-primary');
    };
    const tick = () => {
      const el = target(); if (el === last) { if (el) placeCoach(el, true); return; }
      clear(); last = el;
      if (el) { placeCoach(el); const r = el.getBoundingClientRect(); if (r.bottom > innerHeight || r.top < 0) el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
    };
    let rt = 0;
    const onResize = () => { clearTimeout(rt); rt = setTimeout(() => last?.isConnected && placeCoach(last), 150); };
    tick(); const t = setInterval(tick, 400); addEventListener('resize', onResize);
    return () => { clearInterval(t); clearTimeout(rt); removeEventListener('resize', onResize); clear(); };
  }, [coach, step, making, pub, chat, typing, !!W]);
  const meta = bp?.meta || {};
  const setMeta = (patch) => setBp((b) => ({ ...b, meta: { ...b.meta, ...patch } }));

  /** [ChatGPT 열기] 등: 실제로는 프롬프트를 복사하고 AI 창을 엶. 체험은 흉내 낸 창을 열고 잠깐 뒤 답을 보여 줌 */
  function openBot(b) { setBot(b); setChat('ai'); setTyping(true); later(() => setTyping(false), 1300); }
  /** [답 넣기]: 실제로는 복사한 답을 읽어 바로 사이트를 만듦(몇 초). 체험은 미리 만든 답으로 */
  function make() { setMaking(true); setStep(2); later(() => setMaking(false), 1200); }

  const url = exampleUrl();
  const tip = step === 1 ? TIP1[chat === 'ai' && typing ? 'typing' : chat]
    : making || !W ? 'AI 답으로 사이트를 조립하고 있어요. 실제로도 몇 초면 돼요.' : pub === 'done' ? '여기까지가 전부예요. 이제 내 교재로 해 보세요.' : TIP[step - 1];
  const dots = ['AI에게 보내기', '답 넣기'];
  const at = chat === 'paste' ? 1 : 0;
  const ready = !!meta.title?.trim();

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
      <p class="demo-tip" role="status"><span class="demo-tip-n">{step}/3</span>{tip}</p>
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
            <section class="make-card demo-make" aria-labelledby="demo-make-h">
              <div class="stack make-head"><h2 class="h-sub" id="demo-make-h">AI로 만들기</h2>
                <p class="small muted">쓰던 ChatGPT·Claude·Gemini 창에 보내고 답을 가져와요. 키는 필요 없어요.</p></div>
              <section class="key-card chat-card" aria-label="쓰던 AI로 만드는 순서">
                <ol class="key-dots" aria-label="순서">
                  {dots.map((n, i) => <li><button type="button" class={i === at ? 'on' : i < at ? 'done' : ''} aria-current={i === at ? 'step' : undefined} aria-label={`${i + 1}. ${n}`} onClick={() => setChat(i ? 'paste' : bot ? 'ai' : 'send')}><span class="n" aria-hidden="true">{i < at ? '✓' : i + 1}</span><span class="t">{n}</span></button></li>)}
                </ol>
                {chat === 'send' && <div class="key-now"><div class="key-now-b">
                  <p>누르면 프롬프트가 복사되고 AI 창이 열려요. 입력 칸에 붙여 넣고 보내세요.</p>
                  <div class="btn-row chat-bots">
                    {BOTS.map((b) => <button type="button" class="btn chat-bot" disabled={!ready} onClick={() => openBot(b)}>{b.name} 열기<span class="ext" aria-hidden="true">↗</span></button>)}
                  </div>
                </div></div>}
                {chat === 'ai' && bot && <div class="key-now"><div class="key-now-b">
                  <FakeChat bot={bot} bp={bp} typing={typing} onCopy={() => setChat('paste')} />
                </div></div>}
                {chat === 'paste' && <div class="key-now key-now-paste"><div class="key-now-b">
                  <p>답이 다 나오면 답 아래의 복사 버튼을 누르고 돌아와 누르세요.</p>
                  <div class="key-now-go make-bar"><button type="button" class="btn btn-primary btn-lg nudge" disabled={!ready} onClick={make}>답 넣기</button></div>
                  <div class="btn-row"><button type="button" class="btn-link" onClick={() => setChat(bot ? 'ai' : 'send')}>← AI 창 다시 열기</button></div>
                </div></div>}
              </section>
              <p class="small muted">체험에서는 실제 AI 창 대신 흉내 낸 창이 열리고, 미리 만든 답을 보여 줘요.</p>
            </section>
          </>}
          {step === 2 && <>
            <div class="step-head"><div class="step-head-t"><h1 tabIndex={-1}>살펴보고 고치기</h1></div>
              <div class="btn-row head-tools"><button class={`btn btn-primary${making || !W ? '' : ' nudge'}`} disabled={making || !W} onClick={() => setStep(3)}>배포하기 →</button></div></div>
            {making || !W ? (
              <div class="demo-wait" role="status"><Mascot size={84} mood="think" look /><b>AI 답으로 사이트를 조립하고 있어요</b><span class="small muted">체험이라 실제로 보내지는 않아요.</span></div>
            ) : <W.DemoEdit bp={bp} setBp={setBp} hist={hist} setHist={setHist} applied={applied} setApplied={setApplied} />}
          </>}
          {step === 3 && <>
            <div class="step-head"><div class="step-head-t"><h1 tabIndex={-1}>배포하기</h1><p>실제로는 처음 한 번만 배포할 곳을 연결해요. 고친 뒤 다시 배포해도 주소는 그대로예요.</p></div></div>
            {W ? <W.DemoPublish bp={bp} pub={pub} setPub={setPub} url={url} onAgain={() => { setPub(''); setChat('send'); setBot(null); setStep(1); }} /> : <p class="muted">불러오는 중…</p>}
          </>}
        </div>
      )}
    </div>
  );
}
