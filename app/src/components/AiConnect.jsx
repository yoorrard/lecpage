import { useEffect, useRef, useState } from 'preact/hooks';
import { Notice } from './ui.jsx';
import { PROVIDERS, saveKey, checkKey, getActiveAI, detectProvider, explainError, models, modelText, setActive, isPaidAI, setWay, chatLabel } from '../lib/ai.js';
import { KEY_GUIDES, GUIDE_ORDER, GUIDE_MORE, KeyPic } from '../lib/ai-guides.jsx';
import { toast } from '../lib/util.js';
import { reach } from '../lib/netcheck.js';

/** 키처럼 생긴 글인지(한 덩어리, 20자 이상). 처음 보는 모양의 키도 고른 회사 키로 확인해 볼 수 있게 */
const looksLikeKey = (s) => /^[\w.-]{20,300}$/.test(s);
const NO_COPY = '키 옆의 복사 버튼을 누르고 돌아와 다시 눌러 주세요.';

/**
 * 만드는 길 고르기(처음 한 번): 갖고 있는 것에 맞춰 두 길 중 하나. 고른 길은 기억해 두고(ai.js setWay) 다음에는 바로 그 길로 갑니다.
 *  - 쓰던 챗봇 창으로: 준비할 것·추가 비용 없음, 만들 때마다 복사·붙여넣기(AiPanel의 Paste)
 *  - API 키로: 처음 한 번 결제 등록과 키 복사, 그다음부터 버튼 한 번(AiConnect)
 */
export function AiChoose({ onChat, onKey }) {
  const pick = (way, go) => { setWay(way); go(); };
  return (
    <div class="ai-choose stack">
      <p class="ai-what">갖고 있는 것에 맞춰 골라요. 고른 방법은 기억해 둬요.</p>
      <div class="ai-routes">
        <button type="button" class="ai-route" data-way="chat" onClick={() => pick('chat', onChat)}>
          <span class="ai-route-h">쓰던 챗봇 창으로 만들기</span>
          <span class="ai-route-d">ChatGPT·Claude·Gemini 창에 프롬프트를 붙여 넣고 답을 가져와요.</span>
          <span class="ai-route-facts"><span>준비할 것 없음</span><span>추가 비용 없음</span><span>만들 때마다 복사·붙여넣기</span></span>
        </button>
        <button type="button" class="ai-route" data-way="key" onClick={() => pick('key', onKey)}>
          <span class="ai-route-h">API 키 연결하기</span>
          <span class="ai-route-d">처음 한 번 몇 분 걸려요. 그다음부터는 버튼 한 번으로 만들어요.</span>
          <span class="ai-route-facts"><span>API 결제 등록 필요</span><span>사이트 하나에 몇백 원쯤</span><span>무료 Gemini 키도 돼요</span></span>
        </button>
      </div>
      <p class="small muted">ChatGPT Plus·Claude Pro 구독과 API 결제는 따로예요. 구독만 있으면 챗봇 창으로 만드세요.</p>
    </div>
  );
}

/** 키 없이 쓰던 챗봇 창으로 만들 때의 상태 한 줄(교재 넣기 화면): 누르면 [방법 바꾸기] */
export function AiWayLine({ onSwap }) {
  return (
    <details class="ai-status ai-wayline">
      <summary>
        <span class="dot-ok" aria-hidden="true" />
        <span class="ai-status-t"><span><b>쓰던 챗봇 창</b>으로 만들어요</span><span class="small muted">만들 때마다 복사·붙여넣기</span></span>
        <span class="ai-status-more">바꾸기</span>
      </summary>
      <div class="ai-status-body stack">
        <p class="small muted">API 키를 연결하면 버튼 한 번으로 만들어요. 처음 한 번 결제 등록이 필요해요.</p>
        <div class="btn-row"><button type="button" class="btn btn-sm" onClick={onSwap}>API 키 연결하기</button></div>
      </div>
    </details>
  );
}

/**
 * AI 키 연결(처음 한 번). 한 번에 한 걸음만 보입니다: (유료면 크레딧 충전 →) 키 페이지 열기 → 돌아와서 [붙여넣기].
 * 페이지를 열고 돌아오면 다음 걸음으로 넘어가고 [붙여넣기]를 눈에 띄게 합니다. 클립보드는 버튼을 눌렀을 때만 읽습니다.
 * 어느 걸음에서든 키를 붙여 넣으면(Ctrl+V) 회사를 알아보고 바로 연결합니다.
 * 키는 이 브라우저에서 AI 회사로만 갑니다. onConnected(ai)로 연결된 정보를 돌려줍니다.
 */
export function AiConnect({ onConnected, onChat, onCancel, initial = '' }) {
  const [key, setKey] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState(KEY_GUIDES[initial] ? initial : GUIDE_ORDER[0]);
  const only = GUIDE_MORE.includes(initial); // 'Gemini 무료 키로 만들기'로 열면 그 길만(회사 고르기 없이)
  const [step, setStep] = useState(0); // 지금 보이는 걸음(마지막은 붙여넣기)
  const [opened, setOpened] = useState(-1); // 새 창으로 연 걸음 → 돌아오면 그다음 걸음으로
  const [back, setBack] = useState(false); // 키 페이지에서 돌아옴 → [붙여넣기]를 눈에 띄게
  const inputRef = useRef(); const pasteRef = useRef();
  // 고른 회사의 API가 이 망에서 열리는지(요청 한 번, 잠깐 기억). 막혔으면 키를 만들기 전에 알려 챗봇 창 길로
  const [netBad, setNetBad] = useState('');
  useEffect(() => { let off = false; setNetBad(''); reach('ai:' + tab).then((s) => { if (!off && s === 'blocked') setNetBad(tab); }); return () => { off = true; }; }, [tab]);
  const g = KEY_GUIDES[tab]; const last = g.steps.length; const cur = g.steps[step];
  const go = (n) => { setStep(Math.max(0, Math.min(last, n))); setErr(null); };
  const pick = (id) => { if (!KEY_GUIDES[id] || id === tab) return; setTab(id); setStep(0); setOpened(-1); setBack(false); setErr(null); };
  useEffect(() => {
    if (opened < 0) return;
    const f = () => {
      if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
      setStep((s) => (s === opened ? opened + 1 : s)); setOpened(-1);
      if (opened + 1 >= last) setBack(true);
    };
    addEventListener('focus', f); document.addEventListener('visibilitychange', f);
    return () => { removeEventListener('focus', f); document.removeEventListener('visibilitychange', f); };
  }, [opened, last]);
  // 붙여넣기 걸음으로 넘어오면 그 버튼에 초점(돌아와서 Enter만 눌러도 되게)
  useEffect(() => { if (step === last && back) pasteRef.current?.focus({ preventScroll: true }); }, [step, back, last]);

  /** 붙여 넣은 글이 키로 보이면 바로 연결(버튼을 한 번 덜 누르게). 키가 아닌 글은 칸에 남기지 않음 */
  function take(text) {
    const k = String(text || '').trim();
    if (!k) { setErr({ title: '복사한 것이 없어요.', body: NO_COPY }); return; }
    if (detectProvider(k)) { setKey(k); connect(k); return; }
    if (!looksLikeKey(k)) { setErr({ title: '복사한 글이 키가 아니에요.', body: NO_COPY }); return; }
    setStep(last); setKey(k); setErr({ soft: true, title: '처음 보는 모양의 키예요.', body: `${g.label} 키가 맞으면 [연결]을 눌러 주세요.` });
  }
  async function pasteKey() {
    try { take(await navigator.clipboard.readText()); }
    catch { setErr({ title: '브라우저가 붙여넣기를 막았어요.', body: matchMedia('(pointer: coarse)').matches ? '아래 칸을 길게 눌러 [붙여넣기]를 골라 주세요.' : '아래 칸을 누르고 Ctrl+V(맥은 ⌘V)로 붙여 넣어 주세요.' }); inputRef.current?.focus(); }
  }

  async function connect(k = key) {
    k = String(k || '').trim();
    const prov = detectProvider(k) || (looksLikeKey(k) ? tab : null);
    if (!prov) { setErr({ title: '키가 아닌 것 같아요.', body: '키를 처음부터 끝까지 복사했는지 확인해 주세요.' }); return; }
    setErr(null); setBusy(true);
    if (KEY_GUIDES[prov] && prov !== tab) { setTab(prov); setOpened(-1); }
    setStep(KEY_GUIDES[prov] ? KEY_GUIDES[prov].steps.length : last);
    try {
      await checkKey(prov, k);
      await saveKey(prov, k, remember);
      const a = await getActiveAI();
      setKey(''); setWay('key'); toast(`${PROVIDERS[prov].name}에 연결했어요.`);
      onConnected?.(a);
    } catch (e) { setErr(explainError(e, prov)); }
    setBusy(false);
  }
  /** 창 어디에서든 Ctrl+V로 키를 붙여 넣으면 받음(입력 칸은 제 처리대로) */
  function onAnyPaste(e) {
    if (e.target === inputRef.current || busy) return;
    const v = e.clipboardData?.getData('text'); if (!v) return;
    e.preventDefault(); take(v);
  }

  const prov = detectProvider(key);
  const names = [...g.steps.map((s) => s.title), '붙여넣기'];
  return (
    <div class="ai-connect stack" onPaste={onAnyPaste}>
      {!only && <div class="seg ai-tabs" role="group" aria-label="쓰는 AI">
        {GUIDE_ORDER.map((id) => <button type="button" aria-pressed={String(tab === id)} data-free={KEY_GUIDES[id].tag === '무료' ? '' : undefined} onClick={() => pick(id)}><b>{KEY_GUIDES[id].label}</b><small>{KEY_GUIDES[id].tag}</small></button>)}
      </div>}
      <p class="ai-what">{GUIDE_MORE.includes(tab) && !only && <b>{g.label} · </b>}{g.what}</p>
      {g.more?.length > 0 && <ul class="ai-more small" aria-label="무료로 쓸 때 알아 둘 점">{g.more.map((t) => <li>{t}</li>)}</ul>}
      {netBad === tab && <div role="status"><Notice kind="bad"><div class="stack" style={{ gap: '4px' }}>
        <b>이 망에서 {g.label} API에 닿지 않아요.</b>
        <span>학교·기관 망이 막은 것 같아요. 여기서는 키로 만들 수 없어요. 쓰던 챗봇 창으로 만들거나, 휴대폰 핫스팟으로 바꾼 뒤 다시 열어 주세요.</span>
        {onChat && <div class="btn-row"><button type="button" class="btn btn-sm btn-primary" onClick={() => { setWay('chat'); onChat(tab); }}>{chatLabel(tab)}</button></div>}
      </div></Notice></div>}
      <section class="key-card" aria-label={`${g.label} 연결 순서`}>
        <ol class="key-dots" aria-label="순서">
          {names.map((n, i) => <li><button type="button" class={i === step ? 'on' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined} aria-label={`${i + 1}. ${n}`} onClick={() => go(i)}><span class="n" aria-hidden="true">{i < step ? '✓' : i + 1}</span><span class="t">{n}</span></button></li>)}
        </ol>
        {cur ? (
          <div class="key-now" key={tab + step}>
            <div class="key-now-b">
              <h3 class="key-now-h">{cur.title}</h3>
              <p>{cur.text}</p>
              <div class="key-now-go">
                <a class="btn btn-primary btn-lg" href={cur.url} target="_blank" rel="noopener" onClick={() => { setOpened(step); setBack(false); }}>{cur.open}<span class="ext" aria-hidden="true">↗</span></a>
                <button type="button" class="btn-link" onClick={() => go(step + 1)}>{cur.skip} →</button>
              </div>
            </div>
            <KeyPic pic={cur.pic} />
          </div>
        ) : (
          <div class="key-now key-now-paste" key={tab + 'paste'}>
            <div class="key-now-b">
              <h3 class="key-now-h">붙여넣기</h3>
              <p>{busy ? '키를 확인하고 있어요.' : key ? (prov ? `${PROVIDERS[prov].name} 키예요.` : '넣은 키로 연결해 볼게요.') : '키를 복사했으면 누르세요. 바로 연결돼요.'}</p>
              <div class="key-now-go">
                <button ref={pasteRef} type="button" class={`btn btn-primary btn-lg${back && !key && !busy ? ' nudge' : ''}`} disabled={busy} aria-busy={busy ? 'true' : undefined} onClick={() => (key ? connect() : pasteKey())}>{busy ? '확인하는 중…' : key ? '연결' : '붙여넣기'}</button>
              </div>
              <input ref={inputRef} class="input key-input" type="password" aria-label="API 키" value={key} placeholder="또는 여기에 직접 붙여넣기" autoComplete="off" spellcheck={false} data-1p-ignore data-lpignore="true" data-form-type="other"
                onInput={(e) => { setKey(e.target.value.trim()); setErr(null); }}
                onPaste={(e) => { const v = e.clipboardData?.getData('text'); if (v && detectProvider(v.trim())) { e.preventDefault(); take(v); } }}
                onKeyDown={(e) => e.key === 'Enter' && key && !busy && connect()} />
              <label class="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>이 기기에서 기억하기 <span class="small muted">공용 PC에서는 끄세요.</span></span></label>
            </div>
          </div>
        )}
      </section>
      {err && <div role="alert"><Notice kind={err.soft ? '' : 'bad'}><div class="stack" style={{ gap: '4px' }}><b>{err.title}</b>{err.body && <span>{err.body}</span>}
        {(err.link || (onChat && err.actions?.includes('paste'))) && <div class="btn-row">
          {err.link && <a class="btn btn-sm" href={err.link.href} target="_blank" rel="noopener">{err.link.label}</a>}
          {onChat && err.actions?.includes('paste') && <button type="button" class="btn btn-sm" onClick={() => { setWay('chat'); onChat(err.provider); }}>{chatLabel(err.provider)}</button>}
        </div>}</div></Notice></div>}
      <details class="ai-tips">
        <summary class="small">잘 안 되나요?</summary>
        <ul class="small">{g.tips.map((t) => <li>{t}</li>)}</ul>
      </details>
      <p class="ai-trust small muted">키는 이 브라우저에서 AI 회사로만 가요. lecpage 운영자는 볼 수 없어요. <a href="#/help/ai" target="_blank" rel="noopener">자세히</a></p>
      {<div class="btn-row">
        {!only && GUIDE_MORE.filter((id) => id !== tab).map((id) => <button type="button" class="btn btn-sm btn-quiet" onClick={() => pick(id)}>{KEY_GUIDES[id].tag}로 하기({KEY_GUIDES[id].label})</button>)}
        {onChat && <button type="button" class="btn btn-sm btn-quiet" onClick={() => { setWay('chat'); onChat(); }}>쓰던 챗봇 창으로 만들기</button>}
        {onCancel && <button type="button" class="btn btn-sm btn-quiet" onClick={onCancel}>닫기</button>}
      </div>}
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
  // Gemini 키가 무료인지는 처음 만들 때 알게 됨. 그 전에는 '추천'을 붙이지 않음(무료 키에서는 Gemini 4가 안 되므로)
  const unsure = ai.provider === 'gemini' && !ai.freeTier;
  const hint = cur && cur.tier < 2 && list.some((m) => m.rec && m.id !== cur.id) ? '가벼운 모델은 빠르고 싸지만 구성과 문구가 단순해져요.'
    : ai.provider === 'gemini' ? (ai.freeTier ? '무료 키로 쓸 수 있는 가장 좋은 모델이에요. Gemini 4는 결제를 연결한 키만 돼요.' : '가장 좋은 모델부터 해 보고, 무료 키에서 안 되면 되는 모델로 알아서 바꿔요.')
      : cur?.free ? '무료 모델은 결과가 고르지 않아요.'
        : '추천은 품질과 값의 균형이 좋은 최신 모델이에요. 값은 사이트 하나를 만들 때의 어림이에요.';
  return (
    <label class="model-pick">
      <span>모델</span>
      <select class="input" value={ai.model} onChange={(e) => pick(e.target.value)} aria-describedby="model-hint">
        {!cur && ai.model && <option value={ai.model}>{ai.model}</option>}
        {list.slice(0, 30).map((m) => <option value={m.id} disabled={m.locked}>{modelText(unsure ? { ...m, rec: false } : m)}</option>)}
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
