import { useState } from 'preact/hooks';
import { Field, Notice } from './ui.jsx';
import { PROVIDERS, saveKey, checkKey, getActiveAI, detectProvider, explainError, openRouterStart } from '../lib/ai.js';
import { KeyGuides } from '../lib/ai-guides.jsx';
import { toast } from '../lib/util.js';

/**
 * AI 연결(처음 한 번). 쉬운 순서로: ① OpenRouter 로그인(키 복사 없음) ② 키 붙여넣기(회사 자동 인식) ③ 쓰던 챗봇에 붙여넣기.
 * 키는 이 브라우저에서 AI 회사로만 갑니다. onConnected(ai)로 연결된 정보를 돌려줍니다.
 */
export function AiConnect({ onConnected, onPaste, onCancel, onBeforeLogin }) {
  const [key, setKey] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [guide, setGuide] = useState('');
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

  return (
    <div class="ai-connect stack">
      <ol class="ai-ways">
        <li>
          <div class="ai-way-h"><b>OpenRouter로 로그인</b><span class="tag tag-lav">가장 쉬워요</span></div>
          <p class="small muted">처음이면 이 방법이 편해요. 구글 계정으로 로그인하고 <b>Authorize</b>를 누르면 돌아와요. 키를 복사할 필요가 없고, 무료 모델은 하루 50번까지예요.</p>
          <div><button class="btn btn-primary" onClick={() => { onBeforeLogin?.(); openRouterStart({ remember }); }}>OpenRouter로 로그인</button></div>
        </li>
        <li>
          <div class="ai-way-h"><b>API 키 붙여넣기</b><span class="small muted">Gemini는 무료</span></div>
          <ol class="how small">
            <li><a class="btn btn-sm" href={PROVIDERS.gemini.keyUrl} target="_blank" rel="noopener">Gemini 키 만들기 열기</a> 구글 계정으로 로그인해요.</li>
            <li><b>API 키 만들기</b>(Create API key)를 누르고, 나온 키를 <b>복사</b>해요.</li>
            <li>여기로 돌아와 <button type="button" class="btn btn-sm btn-primary" disabled={busy} onClick={pasteKey}>{busy ? '확인하는 중…' : '붙여넣기'}</button>를 누르면 바로 연결돼요.</li>
          </ol>
          <Field label="API 키" hint={key ? (prov ? `${PROVIDERS[prov].name} 키예요.` : '어느 회사 키인지 모르겠어요. 끝까지 복사했는지 확인해 주세요.') : 'OpenAI·Claude 키도 돼요. ChatGPT·Gemini 앱 구독과는 따로예요.'}>
            <input type="password" value={key} onInput={(e) => { setKey(e.target.value.trim()); setErr(null); }} onPaste={(e) => { const t = e.clipboardData?.getData('text'); if (t && detectProvider(t.trim())) { e.preventDefault(); take(t); } }} onKeyDown={(e) => e.key === 'Enter' && key && connect()} autoComplete="off" spellcheck={false} placeholder="AQ.… / AIza… / sk-…" />
          </Field>
          {key && !busy && <div class="btn-row"><button class="btn" onClick={() => connect()}>연결</button></div>}
          <details open={!!guide} onToggle={(e) => setGuide(e.target.open ? guide || prov || 'gemini' : '')}>
            <summary class="small">키 만드는 법 자세히</summary>
            <KeyGuides open={guide || prov || 'gemini'} />
          </details>
        </li>
      </ol>
      {err && <Notice kind="bad"><div class="stack" style={{ gap: '4px' }}><b>{err.title}</b>{err.body && <span>{err.body}</span>}</div></Notice>}
      <label class="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>이 기기에서 기억하기 <span class="small muted">공용 PC에서는 끄세요.</span></span></label>
      <ul class="ai-safe small muted">
        <li>키는 이 브라우저에서 AI 회사로만 가요. lecpage 운영자는 볼 수 없어요.</li>
        <li>교재의 글이 고른 AI 회사로 전송돼요. 학생 이름 같은 개인정보는 교재에서 지우고 넣어 주세요.</li>
        <li>기억하기를 켜면 암호화해 이 기기에만 저장해요. [설정]에서 언제든 지울 수 있어요.</li>
      </ul>
      {(onPaste || onCancel) && <div class="btn-row">
        {onPaste && <button type="button" class="btn btn-sm btn-quiet" onClick={onPaste}>가입·키 없이: 쓰던 챗봇에 붙여넣기</button>}
        {onCancel && <button type="button" class="btn btn-sm btn-quiet" onClick={onCancel}>취소</button>}
      </div>}
    </div>
  );
}
