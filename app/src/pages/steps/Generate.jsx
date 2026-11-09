import { useEffect, useRef, useState } from 'preact/hooks';
import { StepHead, StepFoot } from '../Project.jsx';
import { Sheet, Notice, Field } from '../../components/ui.jsx';
import { Mascot } from '../../components/Mascot.jsx';
import { E } from '../../lib/engine.js';
import { applyInfo, makeDraft, makePrompt } from '../../lib/blueprint.js';
import { PROVIDERS, loadKey, saveKey, forgetKey, models, generate, openRouterStart } from '../../lib/ai.js';
import { copy, toast } from '../../lib/util.js';

const METHODS = [
  { id: 'paste', title: '쓰고 있는 챗봇에 붙여넣기', tag: '추천 · 무료', desc: '프롬프트를 복사해 ChatGPT·Gemini·Claude에 붙여 넣고, 나온 답을 다시 붙여 넣어요. 키가 필요 없어요.' },
  { id: 'key', title: '내 API 키로 바로 만들기', tag: 'Gemini 무료 키 가능', desc: '키를 한 번 넣으면 버튼 하나로 끝나요. 키는 이 브라우저에서 AI 회사로만 가요.' },
  { id: 'draft', title: 'AI 없이 자동 초안', tag: '가장 빠름', desc: '교재에서 찾은 쪽·단계·프롬프트로 바로 초안을 만들어요. 나중에 직접 다듬어요.' },
];

export function StepGenerate({ p, update, go }) {
  const [method, setMethod] = useState(p.aiMethod || 'paste');
  const [ing, setIng] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);
  useEffect(() => { import('../../lib/ingest.js').then(setIng); }, []);
  useEffect(() => { if (ing && method === 'paste') setPrompt(makePrompt(p, ing)); }, [ing, method]);

  function accept(raw, how) {
    let bp;
    try { bp = typeof raw === 'string' ? E.extractJson(raw) : raw; } catch (e) { setErr('답에서 설계도(JSON)를 찾지 못했어요. 챗봇 답을 처음부터 끝까지 그대로 붙여 넣어 주세요.'); return; }
    const merged = applyInfo(bp, p.info, p.material);
    const v = E.validate(merged);
    if (v.errors.length) { setErr(v.errors.map((x) => x.message_ko).join(' ')); return; }
    setErr(''); setResult({ how, warnings: v.warnings, sections: v.blueprint.sections.length });
    update({ blueprint: merged, aiMethod: method });
    toast('설계도를 만들었어요.');
  }

  return (
    <>
      <StepHead title="AI로 연수 사이트를 설계해요" desc="교재 내용과 연수 정보로 '연수 설계도'를 만들어요. 화면은 lecpage가 설계도대로 조립해요." />
      <div class="grid grid-3">
        {METHODS.map((m) => (
          <button class="card pick method" aria-pressed={String(method === m.id)} onClick={() => { setMethod(m.id); setErr(''); }}>
            <span class="tag tag-lav">{m.tag}</span><h3>{m.title}</h3><p>{m.desc}</p>
          </button>
        ))}
      </div>
      <Sheet>
        {method === 'paste' && <Paste prompt={prompt} answer={answer} setAnswer={setAnswer} onApply={() => accept(answer, 'paste')} ready={!!ing} />}
        {method === 'key' && <KeyMode prompt={() => (ing ? makePrompt(p, ing) : '')} busy={busy} setBusy={setBusy} onResult={(t) => accept(t, 'key')} setErr={setErr} />}
        {method === 'draft' && (
          <div class="stack">
            <p>교재에서 찾은 정보로 바로 설계도를 만들어요. 문구는 교재 문장을 그대로 쓰고, 다음 단계에서 고칠 수 있어요.</p>
            <div><button class="btn btn-primary" disabled={!ing} onClick={() => { const bp = makeDraft(p, ing); accept(bp, 'draft'); }}>자동 초안 만들기</button></div>
          </div>
        )}
        {err && <div style={{ marginTop: '14px' }}><Notice kind="bad">{err}</Notice></div>}
        {(result || p.blueprint) && !err && (
          <div class="stack" style={{ marginTop: '16px' }}>
            <Notice kind="ok"><Mascot size={36} mood="happy" /><span>설계도가 준비됐어요. 섹션 {(p.blueprint?.sections || []).length}개{result?.warnings?.length ? ` · 자동으로 고친 곳 ${result.warnings.length}개` : ''}.</span></Notice>
            {result?.warnings?.length > 0 && <details><summary class="small">고친 내용 보기</summary><ul class="warnings">{result.warnings.map((w) => <li>· {w.message_ko}</li>)}</ul></details>}
          </div>
        )}
      </Sheet>
      <StepFoot go={go} prev={2} next={4} nextLabel="다음: 내용 다듬기" disabled={!p.blueprint} />
    </>
  );
}

function Paste({ prompt, answer, setAnswer, onApply, ready }) {
  return (
    <div class="stack">
      <h2 style={{ fontSize: '1.25rem' }}>1. 프롬프트를 복사해요</h2>
      <p class="small muted">교재 요약과 연수 정보가 담긴 지시문이에요. 길이 {prompt.length.toLocaleString()}자. 무료 챗봇은 너무 길면 잘릴 수 있어요.</p>
      <div class="prompt-box" aria-label="프롬프트 미리보기">{ready ? prompt.slice(0, 1500) + (prompt.length > 1500 ? '\n…' : '') : '교재를 준비하는 중…'}</div>
      <div class="btn-row">
        <button class="btn btn-primary" disabled={!ready} onClick={() => copy(prompt, '프롬프트를 복사했어요. 챗봇에 붙여 넣으세요.')}>프롬프트 복사</button>
        <a class="btn btn-sm" href="https://chatgpt.com/" target="_blank" rel="noopener">ChatGPT 열기</a>
        <a class="btn btn-sm" href="https://gemini.google.com/" target="_blank" rel="noopener">Gemini 열기</a>
        <a class="btn btn-sm" href="https://claude.ai/new" target="_blank" rel="noopener">Claude 열기</a>
      </div>
      <h2 style={{ fontSize: '1.25rem', marginTop: '8px' }}>2. 챗봇의 답을 붙여 넣어요</h2>
      <textarea class="input code" rows={8} value={answer} onInput={(e) => setAnswer(e.target.value)} placeholder='{ "version": 1, "meta": { ... } } 처럼 시작하는 답 전체를 붙여 넣으세요' aria-label="챗봇의 답" />
      <div><button class="btn btn-primary" disabled={!answer.trim()} onClick={onApply}>설계도로 쓰기</button></div>
    </div>
  );
}

function KeyMode({ prompt, busy, setBusy, onResult, setErr }) {
  const [prov, setProv] = useState('gemini');
  const [key, setKey] = useState('');
  const [remember, setRemember] = useState(false);
  const [list, setList] = useState([]);
  const [model, setModel] = useState('');
  const ctrl = useRef(null);
  useEffect(() => { loadKey(prov).then(({ key: k, remembered }) => { setKey(k); setRemember(remembered); setList([]); setModel(''); if (k) loadModels(k); }); }, [prov]);
  async function loadModels(k = key) {
    try { const l = await models(prov, k); setList(l); setModel((l[0] && l[0].id) || ''); } catch (e) { setErr('모델 목록을 불러오지 못했어요: ' + e.message); }
  }
  async function run() {
    setErr(''); setBusy(true); ctrl.current = new AbortController();
    try {
      await saveKey(prov, key, remember);
      const { text } = await generate({ provider: prov, key, model, prompt: prompt(), signal: ctrl.current.signal });
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
      <div class="form-grid">
        <Field label={`${P.name} API 키`} hint={<a href={P.keyUrl} target="_blank" rel="noopener">키 발급 페이지 열기</a>}>
          <input type="password" value={key} onInput={(e) => setKey(e.target.value.trim())} autoComplete="off" placeholder="키를 붙여 넣으세요" />
        </Field>
        <Field label="모델">
          <div class="row"><select value={model} onChange={(e) => setModel(e.target.value)} style={{ flex: 1 }}>{list.length ? list.map((m) => <option value={m.id}>{m.label}</option>) : <option value="">키를 넣고 불러오기</option>}</select><button class="btn btn-sm" disabled={!key} onClick={() => loadModels()}>불러오기</button></div>
        </Field>
      </div>
      <label class="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>이 기기에서 키 기억하기 <span class="small muted">(암호화해 이 브라우저에만 저장. 공용 PC에서는 끄세요)</span></span></label>
      <div class="btn-row">
        <button class="btn btn-primary" disabled={!key || !model || busy} onClick={run}>{busy ? '만드는 중… (1~2분)' : '설계도 만들기'}</button>
        {busy && <button class="btn btn-quiet" onClick={() => ctrl.current?.abort()}>멈추기</button>}
        {key && <button class="btn btn-sm btn-quiet" onClick={async () => { await forgetKey(prov); setKey(''); setList([]); toast('키를 지웠어요.'); }}>키 지우기</button>}
      </div>
      {busy && <div class="row"><Mascot size={56} mood="think" look /><span class="muted">교재를 읽고 연수 흐름을 짜는 중이에요.</span></div>}
    </div>
  );
}
