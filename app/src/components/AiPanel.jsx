import { useEffect, useRef, useState } from 'preact/hooks';
import { Notice, Field, Seg } from './ui.jsx';
import { Mascot } from './Mascot.jsx';
import { E } from '../lib/engine.js';
import { makePrompt, makeDraft, looksTruncated } from '../lib/blueprint.js';
import { polishTargets, makePolishPrompt, applyPolish, isPolishReply } from '../lib/polish.js';
import { PROVIDERS, loadKey, saveKey, forgetKey, generate, checkKey, getActiveAI, setActive, detectProvider, explainError, openRouterStart, takeAiResume, models as listModels } from '../lib/ai.js';
import { KeyGuides } from '../lib/ai-guides.jsx';
import { copy, toast } from '../lib/util.js';

/** OpenRouter 로그인에서 돌아오면 AI 창을 다시 엶 */
export function useAiResume(open) {
  useEffect(() => {
    if (takeAiResume()) open(true);
    const f = () => { if (takeAiResume()) open(true); };
    addEventListener('lecpage:ai-connected', f); return () => removeEventListener('lecpage:ai-connected', f);
  }, []);
}

const CHATBOTS = [['ChatGPT', 'https://chatgpt.com/'], ['Gemini', 'https://gemini.google.com/app'], ['Claude', 'https://claude.ai/new']];
/** AI가 다시 짠 설계도에도 교재 글꼴 정보를 이어 줌 */
const keepFontFields = (bp, base) => {
  const sf = base?.design?.sourceFonts; if (!bp || !sf || bp.design?.sourceFonts) return bp;
  return { ...bp, design: { ...(bp.design || {}), sourceFonts: sf } };
};

/**
 * AI로 다듬기(선택). 기본은 '문구만 다듬기'(짧은 지시문·짧은 답). 방법: 쓰는 챗봇에 붙여넣기 / AI 연결(OpenRouter 로그인·API 키)
 * onBlueprint(bp, { polish, count }) — polish면 문구만 바뀐 설계도(그대로 써도 됨), 아니면 AI가 짠 설계도(부르는 쪽이 applyInfo로 강사 값을 지킴)
 */
export function AiPanel({ p, onBlueprint }) {
  const [ing, setIng] = useState(null);
  const [ai, setAi] = useState(undefined); // undefined: 확인 중 · null: 연결 없음
  const [how, setHow] = useState('');
  const [full, setFull] = useState(!p.blueprint);
  const [err, setErr] = useState(null);
  useEffect(() => {
    import('../lib/ingest.js').then(setIng);
    getActiveAI().then((a) => { setAi(a); setHow(a ? 'connect' : 'paste'); });
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
    if (!bp || typeof bp !== 'object' || !Array.isArray(bp.sections)) { setErr({ title: '답의 형식이 달라요.', body: '지시문을 다시 복사해 새 대화에 붙여 넣어 주세요.', actions: [] }); return; }
    const v = E.validate(bp);
    if (v.errors.length) { setErr({ title: '답에 고칠 점이 있어요.', body: v.errors.map((x) => x.message_ko).join(' '), actions: [] }); return; }
    onBlueprint(keepFontFields(bp, base.current), { polish: false });
  }

  return (
    <div class="stack ai-panel">
      <div class="stack" style={{ gap: '4px' }}>
        <h2 class="h-sub">AI로 다듬기</h2>
        <p class="small muted">참여 기능 연결과 공개 설정은 바뀌지 않아요. 마음에 안 들면 되돌릴 수 있어요.</p>
      </div>
      <label class="check"><input type="checkbox" checked={full} onChange={(e) => { setFull(e.target.checked); setErr(null); }} />
        <span>칸 구성과 순서까지 새로 짜기 <span class="small muted">끄면 제목과 안내 문장만 빠르게 다듬어요.</span></span></label>
      {ai !== undefined && <Seg label="방법" value={how} onChange={(v) => { setHow(v); setErr(null); }} options={[{ value: 'paste', label: '챗봇에 붙여넣기' }, { value: 'connect', label: ai ? `AI 연결됨 · ${PROVIDERS[ai.provider].short}` : 'AI 연결' }]} />}
      {how === 'paste' && <Paste ready={!!ing} prompt={prompt} full={full} onApply={accept} />}
      {how === 'connect' && <Connect ai={ai} setAi={setAi} full={full} ready={!!ing} prompt={prompt} onResult={accept} setErr={setErr} />}
      {err && <ErrorBox e={err} provider={ai?.provider} onPaste={() => { setHow('paste'); setErr(null); }} />}
    </div>
  );
}

function ErrorBox({ e, provider, onPaste }) {
  const P = PROVIDERS[e.provider || provider] || {};
  return (
    <Notice kind="bad">
      <div class="stack" style={{ gap: '6px' }}>
        <b>{e.title}</b>{e.body && <span>{e.body}</span>}
        {e.actions?.length > 0 && <div class="btn-row">
          {e.actions.includes('paste') && <button class="btn btn-sm" onClick={onPaste}>챗봇에 붙여넣기로 하기</button>}
          {e.actions.includes('key') && P.keyUrl && <a class="btn btn-sm" href={P.keyUrl} target="_blank" rel="noopener">{P.short} 키 페이지 열기</a>}
          {e.actions.includes('billing') && P.billingUrl && <a class="btn btn-sm" href={P.billingUrl} target="_blank" rel="noopener">결제 페이지 열기</a>}
        </div>}
        {e.raw && e.raw !== e.body && <details><summary class="small">원래 오류 문구</summary><span class="small mono" style={{ wordBreak: 'break-all' }}>{e.raw}</span></details>}
      </div>
    </Notice>
  );
}

function Paste({ ready, prompt, full, onApply }) {
  const [answer, setAnswer] = useState('');
  const text = ready ? prompt() : '';
  return (
    <div class="stack">
      <ol class="how">
        <li><b>지시문을 복사해요.</b> <button class="btn btn-primary btn-sm" disabled={!ready} onClick={() => copy(text, '복사했어요. 챗봇에 붙여 넣으세요.')}>지시문 복사</button> <span class="small muted">{text.length.toLocaleString()}자</span>
          {full && text.length > 30000 && <p class="small muted">길어서 무료 챗봇은 답을 중간에 멈출 수 있어요. 그러면 "계속"이라고 보내 주세요.</p>}</li>
        <li><b>챗봇에 붙여 넣고 보내요.</b> <span class="links">{CHATBOTS.map(([n, u]) => <a href={u} target="_blank" rel="noopener">{n}</a>)}</span></li>
        <li><b>답을 통째로 복사해 붙여 넣어요.</b> <span class="small muted">답 아래 복사 아이콘을 누르면 돼요.</span>
          <textarea class="input" rows={5} value={answer} onInput={(e) => setAnswer(e.target.value)} placeholder="챗봇 답을 여기에 붙여 넣으세요" aria-label="챗봇의 답" /></li>
      </ol>
      <div><button class="btn btn-primary" disabled={!answer.trim()} onClick={() => onApply(answer)}>이 답으로 바꾸기</button></div>
    </div>
  );
}

function Connect({ ai, setAi, full, ready, prompt, onResult, setErr }) {
  const [edit, setEdit] = useState(!ai);
  const [key, setKey] = useState('');
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState('');
  const [list, setList] = useState(null);
  const [guide, setGuide] = useState('');
  const ctrl = useRef(null);
  const prov = detectProvider(key);
  useEffect(() => { if (ai) loadKey(ai.provider).then((r) => setRemember(r.remembered)); }, [ai?.provider]);

  async function connect() {
    if (!prov) { setErr({ title: '어느 회사 키인지 알 수 없어요.', body: '키를 처음부터 끝까지 복사했는지 확인해 주세요. 아래 만드는 법을 참고하세요.', actions: [] }); return; }
    setErr(null); setBusy('check');
    try {
      const r = await checkKey(prov, key);
      await saveKey(prov, key, remember);
      const a = await getActiveAI(); setAi(a); setEdit(false); setKey(''); setList(r.models);
      toast(`${PROVIDERS[prov].name}에 연결했어요.`);
    } catch (e) { const x = explainError(e, prov); setErr(x); if (['bad-key', 'forbidden', 'region'].includes(x.kind)) setGuide(prov); }
    setBusy('');
  }
  async function run() {
    setErr(null); setBusy('run'); ctrl.current = new AbortController();
    try {
      const big = ['gemini', 'openai'].includes(ai.provider) ? 2 : 1;
      const { text, cut } = await generate({ provider: ai.provider, key: ai.key, model: ai.model, prompt: prompt(), signal: ctrl.current.signal, maxTokens: (full ? 16000 : 8000) * big });
      if (cut && looksTruncated(text)) setErr(explainError({ kind: 'truncated' }, ai.provider)); else onResult(text);
    } catch (e) { if (e.name !== 'AbortError') setErr(explainError(e, ai.provider)); }
    setBusy('');
  }
  async function disconnect() { await forgetKey(ai.provider); setAi(await getActiveAI()); setEdit(true); setList(null); toast('연결을 끊었어요.'); }
  async function pickModel(m) { await setActive(ai.provider, { model: m }); setAi({ ...ai, model: m }); }
  async function loadList() { if (list) return; try { setList(await listModels(ai.provider, ai.key, { freeTier: ai.freeTier })); } catch (e) { setErr(explainError(e, ai.provider)); } }

  if (ai && !edit) {
    return (
      <div class="stack">
        <div class="conn-row">
          <span class="dot-ok" aria-hidden="true" /><span><b>{ai.label}</b>에 연결됨<span class="small muted"> · {ai.model || '자동'}</span></span>
          <span class="conn-tools"><button class="btn btn-sm btn-quiet" onClick={() => setEdit(true)}>다른 키 쓰기</button><button class="btn btn-sm btn-quiet" onClick={disconnect}>연결 끊기</button></span>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary btn-lg" disabled={!ready || !!busy} onClick={run}>{busy ? (full ? '다시 짜는 중… (1~2분)' : '다듬는 중…') : full ? 'AI로 새로 짜기' : 'AI로 문구 다듬기'}</button>
          {busy && <button class="btn btn-quiet" onClick={() => ctrl.current?.abort()}>멈추기</button>}
        </div>
        {busy && <div class="row"><Mascot size={48} mood="think" look /><span class="muted">{full ? '교재를 읽고 연수 흐름을 짜고 있어요.' : '문구를 읽고 다듬고 있어요.'}</span></div>}
        <details onToggle={(e) => e.target.open && loadList()}>
          <summary class="small">모델·저장 설정</summary>
          <div class="stack" style={{ gap: '10px', marginTop: '10px' }}>
            {list && list.length > 1 && <Field label="모델"><select value={ai.model} onChange={(e) => pickModel(e.target.value)}>{list.slice(0, 40).map((m) => <option value={m.id}>{m.label}</option>)}</select></Field>}
            <label class="check"><input type="checkbox" checked={remember} onChange={async (e) => { setRemember(e.target.checked); await saveKey(ai.provider, ai.key, e.target.checked); }} /><span>이 기기에서 기억하기 <span class="small muted">공용 PC에서는 끄세요.</span></span></label>
            <p class="small muted">{PROVIDERS[ai.provider].note}</p>
          </div>
        </details>
      </div>
    );
  }
  return (
    <div class="stack">
      <div class="stack" style={{ gap: '6px' }}>
        <div><button class="btn btn-primary" onClick={() => openRouterStart({ remember })}>OpenRouter로 로그인</button></div>
        <p class="small muted">구글 계정으로 로그인하고 <b>Authorize</b>를 누르면 이 화면으로 돌아와요. 무료 모델은 하루 50번까지예요.</p>
      </div>
      <div class="or-line"><span>또는 API 키 붙여넣기</span></div>
      <Field label="API 키" hint={key ? (prov ? `${PROVIDERS[prov].name} 키예요.` : '어느 회사 키인지 모르겠어요. 끝까지 복사했는지 확인해 주세요.') : 'Gemini·OpenAI·Claude·OpenRouter 키를 넣으면 알아서 구분해요.'}>
        <input type="password" value={key} onInput={(e) => { setKey(e.target.value.trim()); setErr(null); }} onKeyDown={(e) => e.key === 'Enter' && key && connect()} autoComplete="off" spellcheck={false} placeholder="AQ.… / AIza… / sk-…" />
      </Field>
      <label class="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>이 기기에서 기억하기 <span class="small muted">공용 PC에서는 끄세요.</span></span></label>
      <div class="btn-row">
        <button class="btn" disabled={!key || !!busy} onClick={connect}>{busy === 'check' ? '확인하는 중…' : '연결 확인'}</button>
        {ai && <button class="btn btn-quiet btn-sm" onClick={() => setEdit(false)}>취소</button>}
      </div>
      <details open={!!guide} onToggle={(e) => setGuide(e.target.open ? guide || prov || 'gemini' : '')}>
        <summary class="small">API 키 만드는 법</summary>
        <p class="small muted" style={{ margin: '8px 0' }}>결제 없이 쓰려면 Gemini(무료)가 가장 쉬워요.</p>
        <KeyGuides open={guide || prov || 'gemini'} />
      </details>
    </div>
  );
}
