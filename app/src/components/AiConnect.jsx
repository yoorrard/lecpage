import { useEffect, useRef, useState } from 'preact/hooks';
import { Notice } from './ui.jsx';
import { PROVIDERS, saveKey, checkKey, getActiveAI, detectProvider, explainError, models, modelText, setActive, isPaidAI } from '../lib/ai.js';
import { KEY_GUIDES, KeyPic } from '../lib/ai-guides.jsx';
import { toast } from '../lib/util.js';

// 고를 수 있는 AI. what: 그 키로 무엇을 얻는지 한 줄(무료와 유료의 차이를 숨기지 않음. 값은 추천 모델 기준 어림, ai.js의 rank)
// OpenRouter는 목록에서 뺐지만, 저장해 둔 연결과 붙여 넣은 sk-or- 키는 그대로 동작합니다.
const PAID = '고품질 모델로 만들어 구성과 문구가 더 꼼꼼해요. 사이트 하나에 몇백 원쯤 들어요.';
const TABS = [
  { value: 'gemini', label: 'Gemini', tag: '무료', what: '구글의 Flash 모델로 만들어요. 연수 사이트를 짜기에 충분하고, 유료 모델은 구성과 문구가 더 꼼꼼해요.' },
  { value: 'openai', label: 'ChatGPT', tag: '유료', what: PAID, plan: 'ChatGPT 구독' },
  { value: 'anthropic', label: 'Claude', tag: '유료', what: PAID, plan: 'Claude 구독' },
];
/** 키처럼 생긴 글인지(한 덩어리, 20자 이상). 처음 보는 모양의 키도 고른 회사 키로 확인해 볼 수 있게 */
const looksLikeKey = (s) => /^[\w.-]{20,300}$/.test(s);

/**
 * AI 연결(처음 한 번). 두 걸음: ① [키 만들기 열기] → ② 돌아와서 [붙여넣기](회사 자동 인식, 바로 연결).
 * 키 페이지를 열고 돌아오면 [붙여넣기]를 눈에 띄게 합니다. 클립보드는 단추를 눌렀을 때만 읽습니다.
 * 키는 이 브라우저에서 AI 회사로만 갑니다. onConnected(ai)로 연결된 정보를 돌려줍니다.
 */
export function AiConnect({ onConnected, onPaste, onCancel }) {
  const [key, setKey] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState('gemini');
  const [opened, setOpened] = useState(false); // 키 페이지를 열었음 → 다음 걸음은 붙여넣기
  const [back, setBack] = useState(false); // 키 페이지에서 돌아옴 → [붙여넣기]를 눈에 띄게
  const inputRef = useRef(); const pasteRef = useRef();
  const setGuide = (id) => { if (KEY_GUIDES[id]) setTab(id); }; // 붙여 넣은 키의 회사 안내로
  useEffect(() => {
    if (!opened) return;
    const f = () => { if (document.visibilityState === 'visible' && document.hasFocus()) { setBack(true); pasteRef.current?.focus({ preventScroll: true }); } };
    addEventListener('focus', f); document.addEventListener('visibilitychange', f);
    return () => { removeEventListener('focus', f); document.removeEventListener('visibilitychange', f); };
  }, [opened]);

  /** 붙여 넣은 글이 키로 보이면 바로 연결(단추를 한 번 덜 누르게). 키가 아닌 글은 칸에 남기지 않음 */
  function take(text) {
    const k = String(text || '').trim();
    if (!k) { setErr({ title: '복사한 것이 없어요.', body: '키 옆의 복사 단추를 누르고 돌아와 다시 눌러 주세요.' }); return; }
    if (detectProvider(k)) { setKey(k); connect(k); return; }
    if (!looksLikeKey(k)) { setErr({ title: '복사한 글이 키가 아니에요.', body: '키 옆의 복사 단추를 누르고 돌아와 다시 눌러 주세요.' }); return; }
    setKey(k); setErr({ soft: true, title: '처음 보는 모양의 키예요.', body: `${PROVIDERS[tab].short} 키가 맞으면 [연결]을 눌러 주세요.` });
  }
  async function pasteKey() {
    try { take(await navigator.clipboard.readText()); }
    catch { setErr({ title: '브라우저가 붙여넣기를 막았어요.', body: matchMedia('(pointer: coarse)').matches ? '칸을 길게 눌러 [붙여넣기]를 골라 주세요.' : '칸을 누르고 Ctrl+V(맥은 ⌘V)로 붙여 넣어 주세요.' }); inputRef.current?.focus(); }
  }

  async function connect(k = key) {
    k = String(k || '').trim();
    const prov = detectProvider(k) || (looksLikeKey(k) ? tab : null);
    if (!prov) { setErr({ title: '키가 아닌 것 같아요.', body: '키를 처음부터 끝까지 복사했는지 확인해 주세요.' }); return; }
    setErr(null); setBusy(true); setGuide(prov);
    try {
      await checkKey(prov, k);
      await saveKey(prov, k, remember);
      const a = await getActiveAI();
      setKey(''); toast(`${PROVIDERS[prov].name}에 연결했어요.`);
      onConnected?.(a);
    } catch (e) { setErr(explainError(e, prov)); }
    setBusy(false);
  }

  const t = TABS.find((x) => x.value === tab); const P = PROVIDERS[tab]; const prov = detectProvider(key);
  const step = opened || key ? 2 : 1;
  return (
    <div class="ai-connect stack">
      <div class="seg ai-tabs" role="group" aria-label="쓰는 AI">
        {TABS.map((o) => <button type="button" aria-pressed={String(tab === o.value)} data-free={o.tag === '무료' ? '' : undefined} onClick={() => { setTab(o.value); setErr(null); setOpened(false); setBack(false); }}><b>{o.label}</b><small>{o.tag}</small></button>)}
      </div>
      <p class="ai-what">{t.what}</p>
      <ol class="key-steps">
        <li class={step === 1 ? 'on' : 'done'}>
          <span class="n" aria-hidden="true">{step === 1 ? '1' : '✓'}</span>
          <div class="key-step-b">
            <b>키 만들기</b>
            <p class="small">{KEY_GUIDES[tab].quick}</p>
            {t.plan && <p class="small muted">{t.plan}과는 별개예요. 처음이면 <a href={P.billingUrl} target="_blank" rel="noopener">크레딧 충전</a>(최소 5달러)이 먼저예요.</p>}
            <div><a class={`btn${step === 1 ? ' btn-primary' : ' btn-sm'}`} href={P.keyUrl} target="_blank" rel="noopener" onClick={() => { setOpened(true); setBack(false); }}>{step === 1 ? `${P.short} 키 만들기 열기` : '키 페이지 다시 열기'}</a></div>
          </div>
          <KeyPic id={tab} />
        </li>
        <li class={step === 2 ? 'on' : ''}>
          <span class="n" aria-hidden="true">2</span>
          <div class="key-step-b">
            <b>돌아와서 붙여넣기</b>
            <div class="key-paste">
              <input ref={inputRef} class="input" type="password" aria-label="API 키" value={key} placeholder="여기에 붙여 넣어도 돼요" autoComplete="off" spellcheck={false} data-1p-ignore data-lpignore="true" data-form-type="other"
                onInput={(e) => { setKey(e.target.value.trim()); setErr(null); }}
                onPaste={(e) => { const v = e.clipboardData?.getData('text'); if (v && detectProvider(v.trim())) { e.preventDefault(); take(v); } }}
                onKeyDown={(e) => e.key === 'Enter' && key && !busy && connect()} />
              <button ref={pasteRef} type="button" class={`btn${step === 2 ? ' btn-primary' : ''}${back && !key && !busy ? ' nudge' : ''}`} disabled={busy} onClick={() => (key ? connect() : pasteKey())}>{busy ? '확인하는 중…' : key ? '연결' : '붙여넣기'}</button>
            </div>
            <p class="small muted">{key && !busy && prov ? `${PROVIDERS[prov].name} 키예요.` : back && !key ? '키를 복사했으면 [붙여넣기]를 누르세요. 바로 연결돼요.' : '복사한 키를 붙여 넣으면 바로 연결돼요.'}</p>
          </div>
        </li>
      </ol>
      {err && <div role="alert"><Notice kind={err.soft ? '' : 'bad'}><div class="stack" style={{ gap: '4px' }}><b>{err.title}</b>{err.body && <span>{err.body}</span>}</div></Notice></div>}
      <label class="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>이 기기에서 기억하기 <span class="small muted">공용 PC에서는 끄세요.</span></span></label>
      <details class="ai-trust">
        <summary class="small">키는 이 브라우저에서 AI 회사로만 가요. lecpage 운영자는 볼 수 없어요.</summary>
        <ul class="small muted">
          <li>만들 때 교재의 글이 고른 AI 회사로 가요. 학생 이름 같은 개인정보는 지우고 넣어 주세요.{tab === 'gemini' ? ' 무료 키로 넣은 내용은 구글 제품 개선에 쓰일 수 있어요.' : ''}</li>
          <li>기억하기를 켜면 암호화해 이 기기에만 저장해요. [설정]에서 언제든 지울 수 있어요.</li>
        </ul>
      </details>
      <div class="btn-row">
        {onPaste && <button type="button" class="btn btn-sm btn-quiet" onClick={onPaste}>키 없이, 쓰던 챗봇으로 만들기</button>}
        <a class="btn btn-sm btn-quiet" href="#/help/ai" target="_blank" rel="noopener">도움말</a>
        {onCancel && <button type="button" class="btn btn-sm btn-quiet" onClick={onCancel}>취소</button>}
      </div>
    </div>
  );
}

/** 그 회사에서 지금 쓸 수 있는 모델 목록(맨 앞이 추천, ai.js의 rank). 강사가 직접 고른 적이 없으면 추천 모델로 맞춰 둡니다 */
function useModels(ai, onChange) {
  const [list, setList] = useState(null);
  useEffect(() => {
    let off = false; setList(null);
    models(ai.provider, ai.key, { freeTier: ai.freeTier }).then(async (l) => {
      if (off) return; setList(l);
      const a = await getActiveAI(); // 연결 확인 때 고른 값과 다르면(추천이 바뀜) 맞춤
      if (!off && a && a.provider === ai.provider && a.model !== ai.model) onChange?.(a);
    }).catch(() => { if (!off) setList([]); });
    return () => { off = true; };
  }, [ai.provider, ai.key, ai.freeTier]);
  return list;
}

/** 만들 때 쓸 모델 고르기. onChange(ai)로 바뀐 연결을 돌려줍니다 */
function ModelPick({ ai, list, onChange }) {
  const cur = list.find((m) => m.id === ai.model);
  const pick = async (id) => { await setActive(ai.provider, { model: id, picked: true }); onChange?.({ ...ai, model: id }); };
  const hint = cur && cur.tier < 2 && list.some((m) => m.rec && m.id !== cur.id) ? '가벼운 모델은 빠르고 싸지만 구성과 문구가 단순해져요.'
    : ai.provider === 'gemini' ? (ai.freeTier ? '무료 키로 쓸 수 있는 가장 좋은 모델이에요. 더 높은 등급은 결제를 등록한 키만 돼요.' : '무료 키에서 안 되는 모델이면, 무료로 되는 가장 좋은 모델로 알아서 바꿔요.')
      : cur?.free ? '무료 모델은 결과가 고르지 않아요. Gemini 키(무료)가 더 좋아요.'
        : '추천은 연수 흐름을 짜기에 품질이 좋은 최신 모델이에요. 값은 사이트 하나를 만들 때의 어림이에요.';
  return (
    <label class="model-pick">
      <span>모델</span>
      <select class="input" value={ai.model} onChange={(e) => pick(e.target.value)} aria-describedby="model-hint">
        {!cur && ai.model && <option value={ai.model}>{ai.model}</option>}
        {list.slice(0, 30).map((m) => <option value={m.id} disabled={m.locked}>{modelText(m)}</option>)}
      </select>
      <small id="model-hint">{hint}</small>
    </label>
  );
}

/**
 * 연결된 AI 한 줄: '● Google Gemini에 연결됨 · 모델 · 무료/값'. 누르면 모델 고르기와 [다른 AI 연결]·[연결 끊기]가 펼쳐집니다.
 * 모델은 앱이 가장 좋은 것으로 골라 두므로 평소에는 펼칠 일이 없습니다. children: 펼친 곳에 더 넣을 것(저장 설정 등)
 */
export function AiStatus({ ai, onChange, onSwap, onDisconnect, swapLabel = '다른 AI 연결', children }) {
  const list = useModels(ai, onChange);
  const cur = list?.find((m) => m.id === ai.model);
  const cost = !list ? '' : ai.provider === 'gemini' ? (ai.freeTier ? '무료' : '') : cur?.free ? '무료' : isPaidAI(ai.provider, ai.freeTier) ? (cur?.won ? `사이트 하나에 약 ${cur.won.toLocaleString('ko-KR')}원` : '쓴 만큼 결제') : '';
  // Gemini 키가 무료인지는 처음 만들 때 알게 됨(ai.js generateAuto). 그 전에는 모델 이름을 내세우지 않음(무료 키면 바뀌므로)
  const name = ai.provider === 'gemini' && !ai.freeTier ? '' : cur?.label || ai.model;
  return (
    <details class="ai-status">
      <summary>
        <span class="dot-ok" aria-hidden="true" />
        <span class="ai-status-t"><span><b>{ai.label}</b>에 연결됨</span><span class="small muted">{list === null ? '모델 확인 중…' : [name, cost].filter(Boolean).join(' · ')}</span></span>
        <span class="ai-status-more">바꾸기</span>
      </summary>
      <div class="ai-status-body stack">
        {!!list?.length && <ModelPick ai={ai} list={list} onChange={onChange} />}
        {children}
        <div class="btn-row">
          {onSwap && <button type="button" class="btn btn-sm" onClick={onSwap}>{swapLabel}</button>}
          {onDisconnect && <button type="button" class="btn btn-sm btn-quiet" onClick={onDisconnect}>연결 끊기</button>}
        </div>
      </div>
    </details>
  );
}
