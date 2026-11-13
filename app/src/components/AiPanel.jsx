import { useEffect, useRef, useState } from 'preact/hooks';
import { Notice, Seg } from './ui.jsx';
import { Mascot } from './Mascot.jsx';
import { E } from '../lib/engine.js';
import { makePrompt, makeDraft, looksTruncated, keepFontFields } from '../lib/blueprint.js';
import { polishTargets, makePolishPrompt, applyPolish, isPolishReply } from '../lib/polish.js';
import { PROVIDERS, loadKey, saveKey, forgetKey, generateAuto, getActiveAI, explainError, takeAiResume } from '../lib/ai.js';
import { AiConnect, AiStatus } from './AiConnect.jsx';
import { copy, toast } from '../lib/util.js';

/** OpenRouter 로그인에서 돌아오면 AI 창을 다시 엶 */
export function useAiResume(open) {
  useEffect(() => {
    if (takeAiResume()) open(true);
    const f = () => { if (takeAiResume()) open(true); };
    addEventListener('lecpage:ai-connected', f); return () => removeEventListener('lecpage:ai-connected', f);
  }, []);
}

const CHATBOTS = [['ChatGPT', 'https://chatgpt.com/'], ['Claude', 'https://claude.ai/new'], ['Gemini', 'https://gemini.google.com/app']];

/**
 * AI로 다듬기(선택). 기본은 '문구만 다듬기'(짧은 프롬프트·짧은 답). 방법: 연결한 AI로 바로 / 쓰던 챗봇에 붙여넣기(키 없이)
 * onBlueprint(bp, { polish, count }) — polish면 문구만 바뀐 설계도(그대로 써도 됨), 아니면 AI가 짠 설계도(부르는 쪽이 applyInfo로 강사 값을 지킴)
 */
export function AiPanel({ p, onBlueprint }) {
  const [ing, setIng] = useState(null);
  const [ai, setAi] = useState(undefined); // undefined: 확인 중 · null: 연결 없음
  const [how, setHow] = useState('');
  const [full, setFull] = useState(!p.blueprint);
  const [err, setErr] = useState(null);
  const [swap, setSwap] = useState(0); // 오류에서 [다른 AI 연결]을 누르면 연결 화면으로
  const [pay, setPay] = useState(0); // 오류에서 [유료로 이어서 하기]를 누르면 이번 한 번만 유료 연결로
  useEffect(() => {
    import('../lib/ingest.js').then(setIng);
    getActiveAI().then((a) => { setAi(a); setHow(p.blueprint ? 'connect' : 'paste'); });
  }, []);
  const base = useRef(null);
  if (ing && !base.current) base.current = p.blueprint || makeDraft(p, ing);
  const targets = base.current ? polishTargets(base.current) : [];
  const prompt = () => (!ing ? '' : full ? makePrompt(p, ing) : makePolishPrompt(base.current, targets));

  function accept(raw) {
    setErr(null);
    const text = String(raw || '');
    if (!full || isPolishReply(text)) {
      if (isPolishReply(text)) {
        const r = applyPolish(base.current, targets, text);
        if (!r.count) { setErr({ title: '바꿀 문구가 없대요.', body: '지금 문구가 괜찮다는 뜻이에요. 구성까지 바꾸려면 위의 체크를 켜고 다시 해 보세요.', actions: [] }); return; }
        onBlueprint(r.blueprint, { polish: true, count: r.count }); return;
      }
    }
    let bp;
    try { bp = E.extractJson(text); }
    catch {
      setErr(looksTruncated(text)
        ? { title: '답이 중간에 끊겼어요.', body: '챗봇에 "계속"이라고 보내고, 이어진 답을 붙여 넣은 글 바로 뒤에 붙여 주세요. 체크를 끄고 문구만 다듬으면 답이 짧아요.', actions: [] }
        : { title: '답에서 사이트 내용을 찾지 못했어요.', body: '챗봇 답 아래의 복사 아이콘으로 답 전체를 복사해 붙여 넣어 주세요.', actions: [] });
      return;
    }
    if (!bp || typeof bp !== 'object' || !Array.isArray(bp.sections)) { setErr({ title: '답의 형식이 달라요.', body: '프롬프트를 다시 복사해 새 대화에 붙여 넣어 주세요.', actions: [] }); return; }
    const v = E.validate(bp);
    if (v.errors.length) { setErr({ title: '답에 고칠 점이 있어요.', body: v.errors.map((x) => x.message_ko).join(' '), actions: [] }); return; }
    onBlueprint(keepFontFields(bp, base.current, p, ing), { polish: false }); // 교재 보기의 쪽 그림·쪽 글은 교재에서
  }

  return (
    <div class="stack ai-panel">
      {p.blueprint ? <>
        <div class="stack" style={{ gap: '4px' }}>
          <h2 class="h-sub">AI로 다듬기</h2>
          <p class="small muted">마음에 안 들면 [되돌리기]로 돌아가요. 참여 기능 연결과 공개 설정은 그대로예요.</p>
        </div>
        <label class="check"><input type="checkbox" checked={full} onChange={(e) => { setFull(e.target.checked); setErr(null); }} />
          <span>섹션 구성과 순서까지 새로 짜기 <span class="small muted">끄면 문구만 빠르게 다듬어요.</span></span></label>
        {ai !== undefined && <Seg label="방법" value={how} onChange={(v) => { setHow(v); setErr(null); }} options={[{ value: 'connect', label: ai ? `${PROVIDERS[ai.provider].short}로 바로` : 'AI 연결하기' }, { value: 'paste', label: '쓰던 챗봇으로(키 없이)' }]} />}
      </> : (
        // 처음 만들 때(교재 넣기 단계): 고를 것 없이 세 걸음만
        <div class="stack" style={{ gap: '4px' }}>
          <h2 class="h-sub">키 없이 만들기</h2>
          <p class="small muted">쓰던 챗봇에 물어보고 답을 복사해 와요. 무료 챗봇도 돼요.</p>
        </div>
      )}
      {(how === 'paste' || !p.blueprint) && <Paste ready={!!ing} prompt={prompt} full={full} first={!p.blueprint} onApply={accept} />}
      {how === 'connect' && p.blueprint && <Connect ai={ai} setAi={setAi} full={full} ready={!!ing} prompt={prompt} onResult={accept} setErr={setErr} swap={swap} pay={pay} />}
      {err && <ErrorBox e={err} provider={ai?.provider} onPaste={() => { setHow('paste'); setErr(null); }} onConnect={p.blueprint ? () => { setHow('connect'); setSwap((n) => n + 1); setErr(null); } : null} onPay={() => { setErr(null); setPay({ n: Date.now() }); }} onLight={() => { setErr(null); setPay({ n: Date.now(), light: true }); }} />}
    </div>
  );
}

function ErrorBox({ e, provider, onPaste, onConnect, onPay, onLight }) {
  const P = PROVIDERS[e.provider || provider] || {};
  return (
    <Notice kind="bad">
      <div class="stack" style={{ gap: '6px' }}>
        <b>{e.title}</b>{e.body && <span>{e.body}</span>}
        {e.actions?.length > 0 && <div class="btn-row">
          {e.actions.includes('pay') && onPay && <button class="btn btn-sm btn-primary" onClick={onPay}>유료로 이어서 하기</button>}
          {e.actions.includes('light') && onLight && <button class="btn btn-sm" onClick={onLight}>가벼운 모델로 이어서</button>}
          {e.actions.includes('connect') && onConnect && <button class="btn btn-sm" onClick={onConnect}>다른 AI 연결</button>}
          {e.actions.includes('key') && P.keyUrl && <a class="btn btn-sm" href={P.keyUrl} target="_blank" rel="noopener">{P.short} 키 페이지 열기</a>}
          {e.actions.includes('link') && e.link && <a class="btn btn-sm" href={e.link.href} target="_blank" rel="noopener">{e.link.label}</a>}
          {e.actions.includes('billing') && P.billingUrl && <a class="btn btn-sm" href={P.billingUrl} target="_blank" rel="noopener">결제 페이지 열기</a>}
          {e.actions.includes('paste') && <button class="btn btn-sm btn-quiet" onClick={onPaste}>쓰던 챗봇으로 하기</button>}
        </div>}
        {e.raw && e.raw !== e.body && <details><summary class="small">원래 오류 문구</summary><span class="small mono" style={{ wordBreak: 'break-all' }}>{e.raw}</span></details>}
      </div>
    </Notice>
  );
}

/** 키 없이: ① 챗봇 열기(프롬프트가 복사됨) → ② 돌아와서 답 붙여넣기. 한 번에 한 걸음만 보이고, 챗봇에서 돌아오면 ②로 넘어가 [답 붙여넣기]를 눈에 띄게 함 */
function Paste({ ready, prompt, full, first, onApply }) {
  const [answer, setAnswer] = useState('');
  const [step, setStep] = useState(0);
  const [sent, setSent] = useState(false);
  const [back, setBack] = useState(false);
  const pasteRef = useRef();
  const text = ready ? prompt() : '';
  useEffect(() => {
    if (!sent) return;
    const f = () => { if (document.visibilityState === 'visible' && document.hasFocus()) { setStep(1); setBack(true); setSent(false); } };
    addEventListener('focus', f); document.addEventListener('visibilitychange', f);
    return () => { removeEventListener('focus', f); document.removeEventListener('visibilitychange', f); };
  }, [sent]);
  useEffect(() => { if (step === 1 && back) pasteRef.current?.focus({ preventScroll: true }); }, [step, back]);
  /** 프롬프트를 복사하고 그 챗봇을 새 창으로 엶(누르는 동작 한 번) */
  async function send(url) {
    try { await navigator.clipboard.writeText(text); } catch { copy(text); }
    setSent(true); setBack(false); window.open(url, '_blank', 'noopener');
  }
  /** 챗봇 답을 클립보드에서 읽어 바로 적용 */
  async function pasteAnswer() {
    try { const v = (await navigator.clipboard.readText()).trim(); if (!v) { toast('복사한 답이 없어요. 챗봇 답 아래의 복사 버튼을 눌러 주세요.'); return; } setAnswer(v); onApply(v); }
    catch { toast('아래 칸을 누르고 Ctrl+V(맥은 ⌘V)로 붙여 넣어 주세요.'); }
  }
  return (
    <section class="key-card" aria-label="키 없이 만드는 순서">
      <ol class="key-dots" aria-label="순서">
        {['챗봇에 물어보기', '답 붙여넣기'].map((n, i) => <li><button type="button" class={i === step ? 'on' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}><span class="n" aria-hidden="true">{i < step ? '✓' : i + 1}</span><span class="t">{n}</span></button></li>)}
      </ol>
      {step === 0 ? (
        <div class="key-now"><div class="key-now-b">
          <h3 class="key-now-h">챗봇에 물어보기</h3>
          <p>누르면 프롬프트가 복사돼요. 열린 챗봇의 입력 칸에 붙여 넣고(Ctrl+V) 보내세요.</p>
          <div class="btn-row">{CHATBOTS.map(([n, u]) => <button type="button" class="btn" disabled={!ready} onClick={() => send(u)}>{n} 열기</button>)}</div>
          <div><button type="button" class="btn-link" disabled={!ready} onClick={() => { copy(text, '복사했어요. 챗봇에 붙여 넣으세요.'); setStep(1); }}>프롬프트만 복사 →</button></div>
          {full && text.length > 30000 && <p class="small muted">교재가 길어 무료 챗봇은 답을 중간에 멈출 수 있어요. 그러면 "계속"이라고 보내 주세요.</p>}
        </div></div>
      ) : (
        <div class="key-now key-now-paste"><div class="key-now-b">
          <h3 class="key-now-h">답 붙여넣기</h3>
          <p>답이 다 나오면 답 아래의 복사 버튼을 누르고 돌아와요.</p>
          <div class="key-now-go"><button ref={pasteRef} type="button" class={`btn btn-primary btn-lg${back && !answer ? ' nudge' : ''}`} disabled={!ready} onClick={pasteAnswer}>답 붙여넣기</button></div>
          <textarea class="input ta-short" rows={2} value={answer} onInput={(e) => setAnswer(e.target.value)} placeholder="또는 여기에 직접 붙여넣기" aria-label="챗봇의 답" />
          {answer.trim() && <div><button type="button" class="btn btn-primary" onClick={() => onApply(answer)}>{first ? '이 답으로 만들기' : '이 답으로 바꾸기'}</button></div>}
        </div></div>
      )}
    </section>
  );
}

function Connect({ ai, setAi, full, ready, prompt, onResult, setErr, swap, pay }) {
  const [edit, setEdit] = useState(!ai);
  useEffect(() => { if (swap) setEdit(true); }, [swap]);
  useEffect(() => { if (pay && ai) run(pay.light ? 'light' : true); }, [pay]);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState(''); // 한도라 기다리는 중 · 다른 모델로
  const ctrl = useRef(null);
  useEffect(() => { if (ai) loadKey(ai.provider).then((r) => setRemember(r.remembered)); }, [ai?.provider]);

  async function run(allowPaid) {
    setErr(null); setBusy('run'); ctrl.current = new AbortController();
    try {
      const big = ['gemini', 'openai'].includes(ai.provider) ? 2 : 1;
      const { text, cut } = await generateAuto({ provider: ai.provider, key: ai.key, model: ai.model, prompt: prompt(), signal: ctrl.current.signal, maxTokens: (full ? 16000 : 8000) * big },
        { ...(allowPaid === true ? { allowPaid: true } : allowPaid === 'light' ? { allowLight: true } : {}), onStatus: (st) => setNote(st.wait ? `무료 한도라 ${st.wait}초 기다렸다가 이어서 해요.` : st.provider ? `${st.label}로 이어서 하고 있어요.` : '다른 모델로 이어서 하고 있어요.') });
      if (cut && looksTruncated(text)) setErr(explainError({ kind: 'truncated' }, ai.provider)); else onResult(text);
    } catch (e) { if (e.name !== 'AbortError') setErr(explainError(e, ai.provider)); }
    setBusy(''); setNote('');
  }
  async function disconnect() { await forgetKey(ai.provider); setAi(await getActiveAI()); setEdit(true); toast('연결을 끊었어요.'); }

  if (ai && !edit) {
    return (
      <div class="stack">
        <AiStatus ai={ai} onChange={setAi} onSwap={() => setEdit(true)} swapLabel="다른 키 쓰기" onDisconnect={disconnect}>
          <label class="check"><input type="checkbox" checked={remember} onChange={async (e) => { setRemember(e.target.checked); await saveKey(ai.provider, ai.key, e.target.checked); }} /><span>이 기기에서 기억하기 <span class="small muted">공용 PC에서는 끄세요.</span></span></label>
          <p class="small muted">{PROVIDERS[ai.provider].note}</p>
        </AiStatus>
        <div class="btn-row">
          <button class="btn btn-primary btn-lg" disabled={!ready || !!busy} aria-busy={busy ? 'true' : undefined} onClick={() => run()}>{busy ? (full ? '다시 짜는 중…' : '다듬는 중…') : full ? 'AI로 새로 짜기' : 'AI로 문구 다듬기'}</button>
          {busy && <button class="btn btn-quiet" onClick={() => ctrl.current?.abort()}>멈추기</button>}
        </div>
        {busy && <div class="row" role="status"><Mascot size={48} mood="think" look /><span class="muted">{note || (full ? '교재를 읽고 연수 흐름을 짜고 있어요. 1~2분 걸려요.' : '문구를 읽고 다듬고 있어요.')}</span></div>}
      </div>
    );
  }
  return <AiConnect onConnected={(a) => { setAi(a); setEdit(false); setErr(null); }} onCancel={ai ? () => setEdit(false) : undefined} />;
}
