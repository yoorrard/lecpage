import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Notice, Seg } from './ui.jsx';
import { Mascot } from './Mascot.jsx';
import { E } from '../lib/engine.js';
import { makePrompt, makeDraft, looksTruncated, guardAnswer } from '../lib/blueprint.js';
import { polishTargets, makePolishPrompt, applyPolish } from '../lib/polish.js';
import { PROVIDERS, loadKey, saveKey, forgetKey, generateAuto, getActiveAI, explainError, takeAiResume, CHATBOTS, getChatbot, setChatbot, chatLabel, chatbotFor, setWay } from '../lib/ai.js';
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

const touch = () => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } };

/**
 * 누르는 그 순간(사용자 동작 안에서) 글을 복사. 새 창이 열리면 이 창이 초점을 잃어 비동기 복사가 막히는 브라우저가 있어,
 * 열린 대화상자 안에 잠깐 글 칸을 두고 execCommand로 먼저 복사하고, 안 되면 Clipboard API로 다시 해 봄
 */
function copyNow(text) {
  const host = document.querySelector('dialog[open]') || document.body; const was = document.activeElement;
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.setAttribute('aria-hidden', 'true');
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
  host.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
  let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove(); was?.focus?.({ preventScroll: true });
  if (!ok) navigator.clipboard?.writeText(text).catch(() => {});
  return ok;
}

/**
 * AI로 만들기·다듬기. 방법: 연결한 AI로 바로(키) / 쓰던 챗봇 창에 붙여넣기.
 * 처음 만들 때(교재 넣기 단계)는 쓰던 챗봇 창 길만 보여 줌(키 길은 AiConnect). onKey가 있으면 [API 키로 바꾸기]
 * start: { how: 'paste'|'connect', full, bot, make } — 오류에서 넘어올 때 고를 길·전체 다시 짜기·먼저 내세울 챗봇. make: 사이트가 있어도 '처음 만들기' 화면(교재 넣기 단계의 다시 만들기)
 * onBlueprint(bp, { polish, count, restored }) — polish면 문구만 바뀐 설계도, 아니면 AI가 짠 설계도(부르는 쪽이 applyInfo로 강사 값을 지킴).
 * 어느 쪽이든 교재 지킴이(guardAnswer)를 거친 뒤이고, restored는 교재대로 되돌린 곳
 */
export function AiPanel({ p, onBlueprint, start = null, onKey = null }) {
  const [ing, setIng] = useState(null);
  const [ai, setAi] = useState(undefined); // undefined: 확인 중 · null: 연결 없음
  const first = !p.blueprint || !!start?.make; // 처음 만들기(쓰던 챗봇 창 길만) · 아니면 다듬기(키·챗봇 고르기, 문구만 다듬기 선택)
  const [how, setHow] = useState(start?.how || '');
  const [full, setFull] = useState(start?.full ?? first);
  const [err, setErr] = useState(null);
  const [partial, setPartial] = useState(''); // 끊긴 답: 이어진 답을 넣으면 뒤에 붙임
  const [swap, setSwap] = useState(0); // 오류에서 [다른 AI 연결]을 누르면 연결 화면으로
  const [pay, setPay] = useState(0); // 오류에서 [유료로 이어서 하기]를 누르면 이번 한 번만 유료 연결로
  const [bot, setBot] = useState(start?.bot || '');
  useEffect(() => {
    import('../lib/ingest.js').then(setIng);
    getActiveAI().then((a) => { setAi(a); if (!start?.how) setHow(!first && a ? 'connect' : 'paste'); });
  }, []);
  const base = useRef(null);
  if (ing && !base.current) base.current = p.blueprint || makeDraft(p, ing);
  const targets = base.current ? polishTargets(base.current) : [];
  const prompt = () => (!ing ? '' : full ? makePrompt(p, ing) : makePolishPrompt(base.current, targets));

  /** 붙여 넣거나 받은 답 → 설계도. 받을 수 없으면 무엇이 문제인지와 다음 할 일(err) */
  function accept(raw) {
    setErr(null);
    const text = partial ? E.joinAnswer(partial, raw) : String(raw || '');
    const r = E.readAnswer(text);
    if (r.kind === 'empty') { setErr({ title: '붙여 넣은 답이 없어요.', body: '챗봇 답 아래의 복사 버튼을 누르고 다시 넣어 주세요.' }); return; }
    if (r.kind === 'cut') {
      setPartial(text);
      setErr({ title: partial ? '아직 끊긴 데가 있어요.' : '답이 중간에 끊겼어요.', body: '[이어 쓰기 요청 복사]를 눌러 챗봇에 보내고, 이어진 답을 복사해 [이어진 답 넣기]를 누르세요. 앞의 답은 기억해 둬요.', actions: ['continue'] });
      return;
    }
    if (r.kind === 'prompt') { setErr({ title: '붙여 넣은 글이 프롬프트예요.', body: '챗봇이 쓴 답을 복사해 주세요. 답 아래의 복사 버튼을 누르면 돼요.' }); return; }
    if (r.kind === 'question') { setErr({ title: '챗봇이 답 대신 질문을 했어요.', body: '[다시 요청 글 복사]를 눌러 챗봇에 보내면 바로 써 줘요. 모르는 것은 빈칸으로 두라고 적혀 있어요.', actions: ['jsononly'] }); return; }
    if (r.kind === 'talk') { setErr({ title: '챗봇이 설명만 하고 사이트 내용을 쓰지 않았어요.', body: '[다시 요청 글 복사]를 눌러 챗봇에 보내 주세요.', actions: ['jsononly'] }); return; }
    setPartial('');
    const json = r.json;
    if (Array.isArray(json.changes) || (!full && !Array.isArray(json.sections))) {
      const pr = applyPolish(base.current, targets, json);
      if (!pr.count) { setErr({ title: '바꿀 문구가 없대요.', body: '지금 문구가 괜찮다는 뜻이에요. 구성까지 바꾸려면 위의 체크를 켜고 다시 해 보세요.' }); return; }
      const g = guardAnswer(pr.blueprint, p, ing, base.current);
      onBlueprint(g.blueprint, { polish: true, count: pr.count, restored: g.restored }); return;
    }
    if (!Array.isArray(json.sections)) { setErr({ title: '답의 형식이 달라요.', body: '프롬프트를 다시 복사해 새 대화에 붙여 넣어 주세요.' }); return; }
    const v = E.validate(json);
    if (v.errors.length) { setErr({ title: '답에 고칠 점이 있어요.', body: v.errors.map((x) => x.message_ko).join(' ') }); return; }
    // 교재 지킴이: 프롬프트 원문·단계·일정·FAQ·목표·교재 주소는 교재대로, 교재 보기의 쪽 그림·쪽 글은 교재에서
    const g = guardAnswer(json, p, ing, base.current);
    onBlueprint(g.blueprint, { polish: false, restored: g.restored });
  }
  const toPaste = (provider) => { setWay('chat'); setHow('paste'); setErr(null); if (chatbotFor(provider)) setBot(chatbotFor(provider)); };

  return (
    <div class="stack ai-panel">
      {!first ? <>
        <div class="stack" style={{ gap: '4px' }}>
          <h2 class="h-sub">AI로 다듬기</h2>
          <p class="small muted">마음에 안 들면 [되돌리기]로 돌아가요. 참여 기능 연결과 공개 설정은 그대로예요.</p>
        </div>
        <label class="check"><input type="checkbox" checked={full} onChange={(e) => { setFull(e.target.checked); setErr(null); setPartial(''); }} />
          <span>섹션 구성과 순서까지 새로 짜기 <span class="small muted">끄면 문구만 빠르게 다듬어요.</span></span></label>
        {ai !== undefined && <Seg label="방법" value={how} onChange={(v) => { setHow(v); setErr(null); }} options={[{ value: 'connect', label: ai ? `${PROVIDERS[ai.provider].short}로 바로` : 'API 키로' }, { value: 'paste', label: '쓰던 챗봇 창으로' }]} />}
      </> : (
        // 처음 만들 때(교재 넣기 단계): 고를 것 없이 두 걸음만
        <div class="stack" style={{ gap: '4px' }}>
          <h2 class="h-sub" tabIndex={-1} data-autofocus>쓰던 챗봇 창으로 만들기</h2>
          <p class="small muted">준비할 것 없어요. 챗봇에 프롬프트를 붙여 넣고, 답을 복사해 와요. 무료 챗봇도 돼요.</p>
        </div>
      )}
      {(how === 'paste' || first) && <Paste ready={!!ing} prompt={prompt} full={full} first={first} bot={bot} partial={partial} onApply={accept} onRestart={() => { setPartial(''); setErr(null); }} err={err} />}
      {how === 'connect' && !first && <Connect ai={ai} setAi={setAi} full={full} ready={!!ing} prompt={prompt} onResult={accept} setErr={setErr} swap={swap} pay={pay} onChat={toPaste} />}
      {err && how === 'connect' && !first && <ErrorBox e={err} provider={ai?.provider} onPaste={() => toPaste(err.provider || ai?.provider)} onConnect={() => { setHow('connect'); setSwap((n) => n + 1); setErr(null); }} onPay={() => { setErr(null); setPay({ n: Date.now() }); }} onLight={() => { setErr(null); setPay({ n: Date.now(), light: true }); }} />}
      {first && onKey && <div class="btn-row ai-other"><button type="button" class="btn btn-sm btn-quiet" onClick={onKey}>API 키 연결로 바꾸기</button></div>}
    </div>
  );
}

/** 오류 안내 + 할 일 버튼. 맨 앞 동작이 주 버튼(예: 결제 없음 → [쓰던 ChatGPT로 만들기]) */
export function ErrorBox({ e, provider, onPaste, onConnect, onPay, onLight }) {
  const prov = e.provider || provider;
  const P = PROVIDERS[prov] || {};
  const first = e.actions?.[0];
  const cls = (a) => `btn btn-sm${a === first ? ' btn-primary' : ''}`;
  return (
    <Notice kind="bad">
      <div class="stack" style={{ gap: '6px' }} role="alert">
        <b>{e.title}</b>{e.body && <span>{e.body}</span>}
        {e.actions?.length > 0 && <div class="btn-row">
          {e.actions.includes('paste') && onPaste && <button class={cls('paste')} onClick={onPaste}>{chatLabel(prov)}</button>}
          {e.actions.includes('pay') && onPay && <button class={cls('pay')} onClick={onPay}>유료로 이어서 하기</button>}
          {e.actions.includes('light') && onLight && <button class={cls('light')} onClick={onLight}>가벼운 모델로 이어서</button>}
          {e.actions.includes('connect') && onConnect && <button class={cls('connect')} onClick={onConnect}>다른 AI 연결</button>}
          {e.actions.includes('key') && P.keyUrl && <a class={cls('key')} href={P.keyUrl} target="_blank" rel="noopener">{P.short} 키 페이지 열기</a>}
          {e.actions.includes('link') && e.link && <a class={cls('link')} href={e.link.href} target="_blank" rel="noopener">{e.link.label}</a>}
          {e.actions.includes('billing') && P.billingUrl && <a class={cls('billing')} href={P.billingUrl} target="_blank" rel="noopener">{P.short} 결제 페이지 열기</a>}
        </div>}
        {e.raw && e.raw !== e.body && <details><summary class="small">원래 오류 문구</summary><span class="small mono" style={{ wordBreak: 'break-all' }}>{e.raw}</span></details>}
      </div>
    </Notice>
  );
}

/**
 * 쓰던 챗봇 창: ① [ChatGPT 열기] 한 번에 프롬프트가 복사되고 새 창이 열림(Claude는 프롬프트가 짧으면 입력 칸까지 채움)
 * → ② 돌아오면 [답 넣기]에 초점, 누르면 클립보드의 답을 읽어 바로 적용(창 어디서든 Ctrl+V도 됨).
 * 답이 끊겼으면 이어 쓰기 요청 글을 복사해 주고, 이어진 답을 넣으면 앞의 답 뒤에 붙임. 클립보드는 누를 때만 읽음
 */
function Paste({ ready, prompt, full, first, bot: want, partial, onApply, onRestart, err }) {
  const [answer, setAnswer] = useState('');
  const [step, setStep] = useState(0);
  const [sent, setSent] = useState('');
  const [back, setBack] = useState(false);
  const [bot, setBot] = useState(want || getChatbot());
  useEffect(() => { if (want) setBot(want); }, [want]);
  const pasteRef = useRef(); const taRef = useRef();
  const text = useMemo(() => (ready ? prompt() : ''), [ready, full]);
  const bots = [...CHATBOTS].sort((a, b) => (b.id === bot) - (a.id === bot));
  useEffect(() => { if (partial) { setStep(1); setAnswer(''); } }, [partial]);
  useEffect(() => { if (err) setStep(1); }, [err]); // 받을 수 없는 답이면 그 안내가 보이는 걸음으로
  useEffect(() => {
    if (!sent) return;
    const f = () => { if (document.visibilityState === 'visible' && document.hasFocus()) { setStep(1); setBack(true); setSent(''); } };
    addEventListener('focus', f); document.addEventListener('visibilitychange', f);
    return () => { removeEventListener('focus', f); document.removeEventListener('visibilitychange', f); };
  }, [sent]);
  useEffect(() => { if (step === 1 && back) pasteRef.current?.focus({ preventScroll: true }); }, [step, back]);

  /** 챗봇 열기(링크): 누르는 순간 프롬프트를 복사하고, 링크가 새 창을 엶 */
  function send(b, prefilled) {
    copyNow(text);
    setChatbot(b.id); setBot(b.id); setSent(b.id); setBack(false);
    toast(prefilled ? 'Claude 입력 칸에 프롬프트를 채웠어요. 보내기를 누르세요.' : `프롬프트를 복사했어요. ${b.name} 입력 칸에 붙여 넣으세요.`);
  }
  /** 챗봇 답을 클립보드에서 읽어 바로 적용(누를 때만 읽음) */
  async function pasteAnswer() {
    let v = '';
    try { v = (await navigator.clipboard.readText()).trim(); }
    catch { toast(touch() ? '아래 칸을 길게 눌러 [붙여넣기]를 골라 주세요.' : '아래 칸을 누르고 Ctrl+V(맥은 ⌘V)로 붙여 넣어 주세요.'); taRef.current?.focus(); return; }
    if (!v) { toast('복사한 답이 없어요. 챗봇 답 아래의 복사 버튼을 눌러 주세요.'); return; }
    setAnswer(''); onApply(v);
  }
  /** 창 어디서든 Ctrl+V로 답을 넣으면 바로 적용(글 칸은 제 처리대로) */
  function onAnyPaste(e) {
    if (e.target === taRef.current || !ready) return;
    const v = e.clipboardData?.getData('text'); if (!v?.trim()) return;
    e.preventDefault(); onApply(v);
  }
  /** 챗봇에 보낼 짧은 글(이어 쓰기·다시 요청)을 복사. 챗봇에서 돌아오면 [답 넣기]에 다시 초점 */
  const askCopy = (t, msg) => { copy(t, msg); setSent('ask'); setBack(false); };
  const names = ['챗봇에 보내기', partial ? '이어진 답 넣기' : '답 넣기'];
  return (
    <section class="key-card chat-card" aria-label="쓰던 챗봇 창으로 만드는 순서" onPaste={onAnyPaste}>
      <ol class="key-dots" aria-label="순서">
        {names.map((n, i) => <li><button type="button" class={i === step ? 'on' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}><span class="n" aria-hidden="true">{i < step ? '✓' : i + 1}</span><span class="t">{n}</span></button></li>)}
      </ol>
      {step === 0 ? (
        <div class="key-now"><div class="key-now-b">
          <h3 class="key-now-h">챗봇에 보내기</h3>
          <p>누르면 프롬프트가 복사되고 챗봇이 새 창으로 열려요. 입력 칸에 붙여 넣고{touch() ? '(길게 눌러 붙여넣기)' : '(Ctrl+V)'} 보내세요.</p>
          <div class="btn-row chat-bots">
            {bots.map((b, i) => {
              const pre = b.prefill?.(text) || '';
              return <a class={`btn${i === 0 ? ' btn-primary btn-lg' : ''}`} href={pre || b.url} target="_blank" rel="noopener" aria-disabled={!ready ? 'true' : undefined}
                onClick={(e) => { if (!ready) { e.preventDefault(); return; } send(b, !!pre); }}>{b.name} 열기<span class="ext" aria-hidden="true">↗</span></a>;
            })}
          </div>
          {CHATBOTS.find((b) => b.id === 'claude').prefill(text) && <p class="small muted">Claude는 입력 칸에 프롬프트가 채워진 채로 열려요. 비어 있으면 붙여 넣으세요.</p>}
          <div><button type="button" class="btn-link" disabled={!ready} onClick={() => { copyNow(text); toast('복사했어요. 챗봇에 붙여 넣으세요.'); setStep(1); }}>프롬프트만 복사 →</button></div>
          {full && text.length > 30000 && <p class="small muted">교재가 길어 무료 챗봇은 답을 중간에 멈출 수 있어요. 그러면 [이어 쓰기 요청 복사]로 이어 받아요.</p>}
          <p class="small muted">교재의 글이 고른 챗봇 회사로 가요. 학생 이름 같은 개인정보는 지우고 넣어 주세요.</p>
        </div></div>
      ) : (
        <div class="key-now key-now-paste"><div class="key-now-b">
          <h3 class="key-now-h">{partial ? '이어진 답 넣기' : '답 넣기'}</h3>
          <p>{partial ? '챗봇이 이어서 쓴 답을 복사하고 돌아와 누르세요. 앞의 답 뒤에 붙여요.' : `답이 다 나오면 답 아래의 복사 버튼을 누르고 돌아와 누르세요.${touch() ? '' : ' Ctrl+V로 넣어도 돼요.'}`}</p>
          {err && <AnswerError e={err} onAsk={askCopy} />}
          <div class="key-now-go"><button ref={pasteRef} type="button" class={`btn btn-primary btn-lg${back && !answer ? ' nudge' : ''}`} disabled={!ready} onClick={pasteAnswer}>{partial ? '이어진 답 넣기' : '답 넣기'}</button></div>
          <textarea ref={taRef} class="input ta-short" rows={2} value={answer} onInput={(e) => setAnswer(e.target.value)} placeholder="또는 여기에 직접 붙여넣기" aria-label={partial ? '챗봇이 이어서 쓴 답' : '챗봇의 답'} />
          {answer.trim() && <div><button type="button" class="btn btn-primary" onClick={() => { const v = answer; setAnswer(''); onApply(v); }}>{partial ? '이어서 붙이기' : first ? '이 답으로 만들기' : '이 답으로 바꾸기'}</button></div>}
          <div class="btn-row">
            <button type="button" class="btn-link" onClick={() => setStep(0)}>← 챗봇 다시 열기</button>
            {partial && <button type="button" class="btn-link" onClick={onRestart}>처음 답부터 다시 넣기</button>}
          </div>
        </div></div>
      )}
    </section>
  );
}

/** 붙여 넣은 답을 받을 수 없을 때: 무엇이 문제인지 + 챗봇에 보낼 짧은 글 복사 */
function AnswerError({ e, onAsk }) {
  return (
    <div role="alert" class="answer-err">
      <Notice kind="bad"><div class="stack" style={{ gap: '6px' }}>
        <b>{e.title}</b>{e.body && <span>{e.body}</span>}
        {e.actions?.includes('continue') && <div><button type="button" class="btn btn-sm btn-primary" onClick={() => onAsk(E.CONTINUE_ASK, '복사했어요. 챗봇에 보내세요.')}>이어 쓰기 요청 복사</button></div>}
        {e.actions?.includes('jsononly') && <div><button type="button" class="btn btn-sm btn-primary" onClick={() => onAsk(E.JSON_ONLY_ASK, '복사했어요. 챗봇에 보내세요.')}>다시 요청 글 복사</button></div>}
      </div></Notice>
    </div>
  );
}

function Connect({ ai, setAi, full, ready, prompt, onResult, setErr, swap, pay, onChat }) {
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
  return <AiConnect onConnected={(a) => { setAi(a); setEdit(false); setErr(null); }} onChat={onChat} onCancel={ai ? () => setEdit(false) : undefined} />;
}

/**
 * 교재대로 되돌린 곳 한 줄 + [보기](곳마다 전후, 그곳만 AI 답으로 되돌리기). AI로 만들기가 끝난 띠(Edit.jsx)에 붙음
 * restored: guardAnswer가 돌려준 목록 · undone: 이미 AI 답으로 되돌린 id · onUndo(r): 그곳만 AI 답으로
 */
export function GuardNote({ restored = [], undone = [], onUndo }) {
  const list = restored.filter((r) => !r.quiet);
  const [open, setOpen] = useState(false);
  if (!list.length) return null;
  const left = list.filter((r) => !undone.includes(r.id)).length;
  const show = (v) => (v ? String(v) : '');
  return (
    <div class="guard-note">
      <span>{left ? `교재와 달라진 ${left}곳을 교재대로 되돌렸어요.` : '모두 AI 답으로 되돌렸어요.'}</span>
      <button type="button" class="btn btn-sm btn-quiet" aria-expanded={open ? 'true' : 'false'} onClick={() => setOpen(!open)}>{open ? '접기' : '보기'}</button>
      {open && <ul class="guard-list">
        {list.map((r) => {
          const off = undone.includes(r.id);
          return (
            <li class={off ? 'off' : ''}>
              <b>{r.where}</b>
              <div class="guard-diff">
                <span class="g-ai"><small>AI 답</small>{show(r.before) || <em>없음</em>}</span>
                <span class="g-src"><small>교재</small>{show(r.after) || <em>뺌(교재에 없음)</em>}</span>
              </div>
              {off ? <small class="muted">AI 답으로 되돌렸어요.</small> : <button type="button" class="btn btn-sm" onClick={() => onUndo?.(r)}>AI 답으로 되돌리기</button>}
            </li>
          );
        })}
      </ul>}
    </div>
  );
}
