import { useEffect, useRef, useState } from 'preact/hooks';
import { Notice, Field, Seg } from './ui.jsx';
import { Mascot } from './Mascot.jsx';
import { E } from '../lib/engine.js';
import { makePrompt, looksTruncated } from '../lib/blueprint.js';
import { PROVIDERS, loadKey, saveKey, forgetKey, models, generate, openRouterStart } from '../lib/ai.js';
import { copy, toast } from '../lib/util.js';

/**
 * AI로 초안 다듬기(선택). 방법 1: 쓰는 챗봇에 붙여넣기(무료) · 방법 2: AI 키로 바로(고급)
 * 결과 설계도는 onBlueprint로 넘김(강사 입력·실시간 설정은 부르는 쪽 applyInfo가 지킴)
 */
export function AiPanel({ p, onBlueprint }) {
  const [mode, setMode] = useState('paste');
  const [ing, setIng] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { import('../lib/ingest.js').then(setIng); }, []);
  function accept(raw) {
    let bp;
    try { bp = typeof raw === 'string' ? E.extractJson(raw) : raw; }
    catch {
      setErr(looksTruncated(raw)
        ? '답이 중간에 끊겼어요. 챗봇에 "계속"이라고 보내고, 이어진 답을 지금 붙여 넣은 글 바로 뒤에 이어 붙여 주세요.'
        : '답에서 사이트 내용을 찾지 못했어요. 챗봇 답 아래의 [복사] 버튼으로 답 전체를 복사해 붙여 넣어 주세요.');
      return;
    }
    const v = E.validate(bp);
    if (v.errors.length) { setErr(v.errors.map((x) => x.message_ko).join(' ')); return; }
    setErr(''); onBlueprint(bp);
  }
  return (
    <div class="stack">
      <div class="stack" style={{ gap: '6px' }}>
        <h2 class="h-sub">AI로 더 다듬어 만들기</h2>
        <p class="small muted">교재 요약과 지금 초안을 AI에게 보내 문구와 흐름을 다듬어요. 실시간 연결·공개 설정은 AI가 바꾸지 못해요.</p>
      </div>
      <Seg label="방법" value={mode} onChange={(v) => { setMode(v); setErr(''); }} options={[{ value: 'paste', label: '쓰는 챗봇에 붙여넣기(무료)' }, { value: 'key', label: 'AI 키로 바로(고급)' }]} />
      {mode === 'paste' ? <Paste p={p} ing={ing} onApply={accept} /> : <KeyMode prompt={() => (ing ? makePrompt(p, ing) : '')} onResult={accept} setErr={setErr} />}
      {err && <Notice kind="bad">{err}</Notice>}
    </div>
  );
}

function Paste({ p, ing, onApply }) {
  const [answer, setAnswer] = useState('');
  const prompt = ing ? makePrompt(p, ing) : '';
  return (
    <div class="stack">
      <ol class="how">
        <li><b>지시문을 복사해요.</b> <button class="btn btn-primary btn-sm" disabled={!ing} onClick={() => copy(prompt, '지시문을 복사했어요. 챗봇에 붙여 넣으세요.')}>지시문 복사</button>
          <details><summary class="small">지시문 내용 보기({prompt.length.toLocaleString()}자)</summary><div class="prompt-box" aria-label="지시문 미리보기">{ing ? prompt.slice(0, 2000) + (prompt.length > 2000 ? '\n…' : '') : '준비하는 중…'}</div></details>
          {prompt.length > 30000 && <p class="small muted">길이가 길어요. 무료 챗봇은 중간에 답을 멈출 수 있어요. 그러면 "계속"이라고 보내 주세요.</p>}</li>
        <li><b>챗봇에 붙여 넣고 보내요.</b> <span class="btn-row" style={{ display: 'inline-flex' }}><a class="btn btn-sm" href="https://chatgpt.com/" target="_blank" rel="noopener">ChatGPT</a><a class="btn btn-sm" href="https://gemini.google.com/" target="_blank" rel="noopener">Gemini</a><a class="btn btn-sm" href="https://claude.ai/new" target="_blank" rel="noopener">Claude</a></span></li>
        <li><b>챗봇 답 아래의 [복사] 버튼을 눌러 통째로 붙여 넣어요.</b>
          <textarea class="input code" rows={7} value={answer} onInput={(e) => setAnswer(e.target.value)} placeholder="챗봇 답을 여기에 붙여 넣으세요" aria-label="챗봇의 답" /></li>
      </ol>
      <div><button class="btn btn-primary" disabled={!answer.trim()} onClick={() => onApply(answer)}>이 답으로 만들기</button></div>
    </div>
  );
}

function KeyMode({ prompt, onResult, setErr }) {
  const [prov, setProv] = useState('gemini');
  const [key, setKey] = useState('');
  const [remember, setRemember] = useState(false);
  const [list, setList] = useState([]);
  const [model, setModel] = useState('');
  const [busy, setBusy] = useState(false);
  const ctrl = useRef(null);
  useEffect(() => { loadKey(prov).then(({ key: k, remembered }) => { setKey(k); setRemember(remembered); setList([]); setModel(''); if (k) loadModels(k); }); }, [prov]);
  async function loadModels(k = key) {
    try { const l = await models(prov, k); setList(l); setModel((l[0] && l[0].id) || ''); } catch (e) { setErr('키를 확인하지 못했어요: ' + e.message); }
  }
  async function run() {
    setErr(''); setBusy(true); ctrl.current = new AbortController();
    try {
      await saveKey(prov, key, remember);
      let m = model; if (!m) { const l = await models(prov, key); m = l[0]?.id; setList(l); setModel(m || ''); }
      const { text } = await generate({ provider: prov, key, model: m, prompt: prompt(), signal: ctrl.current.signal });
      onResult(text);
    } catch (e) { if (e.name !== 'AbortError') setErr('만들지 못했어요: ' + e.message); }
    setBusy(false);
  }
  const P = PROVIDERS[prov];
  return (
    <div class="stack">
      <div class="chips">{Object.entries(PROVIDERS).map(([id, v]) => <button class="chip" aria-pressed={String(prov === id)} onClick={() => setProv(id)}>{v.name}{v.free ? ' (무료 키)' : ''}</button>)}</div>
      <Notice kind="lav">{P.note}</Notice>
      {prov === 'openrouter' && !key && <div><button class="btn" onClick={openRouterStart}>OpenRouter로 로그인해 키 받기</button></div>}
      <Field label={`${P.name} 키`} hint={<a href={P.keyUrl} target="_blank" rel="noopener">키 발급 페이지 열기</a>}>
        <input type="password" value={key} onInput={(e) => setKey(e.target.value.trim())} onChange={() => key && loadModels()} autoComplete="off" placeholder="키를 붙여 넣으세요" />
      </Field>
      {list.length > 1 && <details><summary class="small">모델 바꾸기(자동으로 골랐어요: {list.find((x) => x.id === model)?.label || model})</summary><select value={model} onChange={(e) => setModel(e.target.value)}>{list.map((m) => <option value={m.id}>{m.label}</option>)}</select></details>}
      <label class="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>이 기기에서 키 기억하기 <span class="small muted">(암호화해 이 브라우저에만 저장. 공용 PC에서는 끄세요)</span></span></label>
      <div class="btn-row">
        <button class="btn btn-primary" disabled={!key || busy} onClick={run}>{busy ? '만드는 중… (1~2분)' : 'AI로 만들기'}</button>
        {busy && <button class="btn btn-quiet" onClick={() => ctrl.current?.abort()}>멈추기</button>}
        {key && <button class="btn btn-sm btn-quiet" onClick={async () => { await forgetKey(prov); setKey(''); setList([]); toast('키를 지웠어요.'); }}>키 지우기</button>}
      </div>
      {busy && <div class="row"><Mascot size={56} mood="think" look /><span class="muted">교재를 읽고 연수 흐름을 짜는 중이에요.</span></div>}
    </div>
  );
}
