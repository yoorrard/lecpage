import { useState } from 'preact/hooks';
import { Field, Notice, Seg } from './ui.jsx';
import { PROVIDERS, saveKey, checkKey, getActiveAI, detectProvider, explainError, openRouterStart } from '../lib/ai.js';
import { KEY_GUIDES } from '../lib/ai-guides.jsx';
import { toast } from '../lib/util.js';

const TABS = [{ value: 'gemini', label: 'Gemini (무료)' }, { value: 'openai', label: 'ChatGPT (OpenAI)' }, { value: 'anthropic', label: 'Claude' }, { value: 'openrouter', label: '로그인으로 (OpenRouter)' }];

/**
 * AI 연결(처음 한 번). 키 연결이 기본: 쓰는 AI를 고르면 그 회사 키 만드는 순서와 [붙여넣기](회사 자동 인식, 바로 연결)가 나옴. OpenRouter는 로그인만.
 * 키는 이 브라우저에서 AI 회사로만 갑니다. onConnected(ai)로 연결된 정보를 돌려줍니다.
 */
export function AiConnect({ onConnected, onPaste, onCancel, onBeforeLogin }) {
  const [key, setKey] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState('gemini');
  const setGuide = (id) => { if (KEY_GUIDES[id]) setTab(id); }; // 오류가 나면 그 회사 안내로
  const prov = detectProvider(key);
  /** 붙여 넣은 글이 키로 보이면 바로 연결(단추를 한 번 덜 누르게) */
  function take(text) { const k = String(text || '').trim(); if (!k) return; setKey(k); setErr(null); if (detectProvider(k)) connect(k); }
  async function pasteKey() {
    try { take(await navigator.clipboard.readText()); }
    catch { setErr({ title: '붙여넣기 권한이 없어요.', body: '입력 칸을 누르고 Ctrl+V(맥은 ⌘V)로 붙여 넣어 주세요.' }); }
  }

  async function connect(k = key) {
    const prov = detectProvider(k);
    if (!prov) { setErr({ title: '어느 회사 키인지 알 수 없어요.', body: '키를 처음부터 끝까지 복사했는지 확인해 주세요.' }); setGuide('gemini'); return; }
    setErr(null); setBusy(true);
    try {
      await checkKey(prov, k);
      await saveKey(prov, k, remember);
      const a = await getActiveAI();
      setKey(''); toast(`${PROVIDERS[prov].name}에 연결했어요.`);
      onConnected?.(a);
    } catch (e) { const x = explainError(e, prov); setErr(x); if (['bad-key', 'forbidden', 'region'].includes(x.kind)) setGuide(prov); }
    setBusy(false);
  }

  const g = KEY_GUIDES[tab];
  return (
    <div class="ai-connect stack">
      <Seg label="쓰는 AI" value={tab} onChange={(v) => { setTab(v); setErr(null); }} options={TABS} />
      {tab === 'openrouter' ? (
        <div class="ai-way stack">
          <p>구글 계정으로 로그인하고 <b>Authorize</b>를 누르면 돌아와요. 키를 복사할 필요가 없어요. 무료 모델은 하루 50번까지이고, 크레딧을 충전하면 GPT·Claude 모델도 골라 쓸 수 있어요.</p>
          <div><button class="btn btn-primary" onClick={() => { onBeforeLogin?.(); openRouterStart({ remember }); }}>OpenRouter로 로그인</button></div>
        </div>
      ) : (
        <div class="ai-way stack">
          {(tab === 'openai' || tab === 'anthropic') && (
            <p class="ai-nokey small"><span>API 키는 {tab === 'openai' ? 'ChatGPT' : 'Claude'} 구독과 따로 충전해요(최소 5달러). 무료로 하려면 Gemini 키가 가장 쉬워요.</span>
              <button type="button" class="btn btn-sm" onClick={() => { setTab('gemini'); setErr(null); }}>Gemini로 하기</button></p>
          )}
          <ol class="how small">
            {g.steps.slice(0, -1).map((st, i) => <li key={i}>{i === 0 ? <><a class="btn btn-sm" href={PROVIDERS[tab].keyUrl} target="_blank" rel="noopener">{PROVIDERS[tab].short} 키 만들기 열기</a> 로그인해요.{tab === 'openai' ? ' ChatGPT 계정 그대로 돼요.' : ''}</> : st}</li>)}
            <li>키를 <b>복사</b>하고 여기로 돌아와 <button type="button" class="btn btn-sm btn-primary" disabled={busy} onClick={pasteKey}>{busy ? '확인하는 중…' : '붙여넣기'}</button>를 누르면 바로 연결돼요.</li>
          </ol>
          <Field label="API 키" hint={key ? (prov ? `${PROVIDERS[prov].name} 키예요.` : '어느 회사 키인지 모르겠어요. 끝까지 복사했는지 확인해 주세요.') : g.notes[0]}>
            <input type="password" value={key} onInput={(e) => { setKey(e.target.value.trim()); setErr(null); }} onPaste={(e) => { const t = e.clipboardData?.getData('text'); if (t && detectProvider(t.trim())) { e.preventDefault(); take(t); } }} onKeyDown={(e) => e.key === 'Enter' && key && connect()} autoComplete="off" spellcheck={false} placeholder={PROVIDERS[tab].prefix || ''} />
          </Field>
          {key && !busy && <div class="btn-row"><button class="btn" onClick={() => connect()}>연결</button></div>}
        </div>
      )}
      {err && <Notice kind="bad"><div class="stack" style={{ gap: '4px' }}><b>{err.title}</b>{err.body && <span>{err.body}</span>}</div></Notice>}
      <label class="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>이 기기에서 기억하기 <span class="small muted">공용 PC에서는 끄세요.</span></span></label>
      <ul class="ai-safe small muted">
        <li>키는 이 브라우저에서 AI 회사로만 가요. lecpage 운영자는 볼 수 없어요.</li>
        <li>교재의 글이 고른 AI 회사로 전송돼요. 학생 이름 같은 개인정보는 교재에서 지우고 넣어 주세요.</li>
        <li>기억하기를 켜면 암호화해 이 기기에만 저장해요. [설정]에서 언제든 지울 수 있어요.</li>
      </ul>
      {(onPaste || onCancel) && <div class="btn-row">
        {onPaste && <button type="button" class="btn btn-sm btn-quiet" onClick={onPaste}>키 없이 하는 방법</button>}
        {onCancel && <button type="button" class="btn btn-sm btn-quiet" onClick={onCancel}>취소</button>}
      </div>}
    </div>
  );
}
