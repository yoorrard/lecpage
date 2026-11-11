// AI 연결: 키는 기본적으로 이 탭의 메모리에만(새로 고침하면 사라짐), 원하면 이 기기에 암호화해 저장(WebCrypto, 꺼낼 수 없는 키).
// 키와 교재는 운영자 서버로 가지 않고, 브라우저에서 AI 회사로 바로 갑니다.
// 공개 API(다른 화면도 씀): PROVIDERS, loadKey, saveKey, forgetKey, models, generate, getActiveAI, detectProvider, checkKey
import { kv } from './db.js';

export const PROVIDERS = {
  gemini: { name: 'Google Gemini', short: 'Gemini', free: true, keyUrl: 'https://aistudio.google.com/api-keys', billingUrl: 'https://aistudio.google.com/usage', note: '무료 등급은 넣은 내용이 구글 제품 개선에 쓰일 수 있어요. 학생 개인정보는 넣지 마세요.', modelHint: /flash/i, prefix: 'AQ.… 또는 AIza…', images: true },
  openrouter: { name: 'OpenRouter', short: 'OpenRouter', free: true, keyUrl: 'https://openrouter.ai/settings/keys', billingUrl: 'https://openrouter.ai/settings/credits', note: '무료 모델은 하루 50번까지예요. 무료 모델 중에는 넣은 내용을 학습에 쓰는 곳도 있어요.', modelHint: /gemini.*flash|claude|gpt/i, oauth: true, prefix: 'sk-or-v1-…', images: true },
  openai: { name: 'OpenAI', short: 'OpenAI', free: false, keyUrl: 'https://platform.openai.com/api-keys', billingUrl: 'https://platform.openai.com/settings/organization/billing/overview', note: '쓴 만큼 크레딧에서 나가요. ChatGPT 구독과는 별개예요.', modelHint: /^gpt-/i, prefix: 'sk-proj-…', images: true },
  anthropic: { name: 'Anthropic Claude', short: 'Claude', free: false, keyUrl: 'https://platform.claude.com/settings/keys', billingUrl: 'https://platform.claude.com/settings/billing', note: '쓴 만큼 크레딧에서 나가요. Claude 구독(Pro·Max)과는 별개예요.', modelHint: /sonnet/i, prefix: 'sk-ant-…', images: true },
};

/** 붙여 넣은 키의 앞부분으로 어느 회사 키인지 알아냄 */
export function detectProvider(key) {
  const k = String(key || '').trim();
  if (/^sk-or-/.test(k)) return 'openrouter';
  if (/^sk-ant-/.test(k)) return 'anthropic';
  if (/^(AIza|AQ\.)/.test(k)) return 'gemini';
  if (/^sk-/.test(k)) return 'openai';
  return null;
}

// ── 키 보관 ──
const mem = new Map(); // 탭 메모리(저장소에 남기지 않음)
let cryptoKeyP = null;
async function deviceKey() {
  if (cryptoKeyP) return cryptoKeyP;
  cryptoKeyP = (async () => {
    let k = await kv.get('device-key');
    if (!k) { k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); await kv.set('device-key', k); }
    return k;
  })();
  return cryptoKeyP;
}

export async function saveKey(provider, key, remember) {
  if (key) mem.set(provider, key); else mem.delete(provider);
  if (remember && key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deviceKey(), new TextEncoder().encode(key));
    await kv.set('ai:' + provider, { iv, ct });
  } else await kv.del('ai:' + provider);
}
export async function loadKey(provider) {
  if (mem.has(provider)) return { key: mem.get(provider), remembered: !!(await kv.get('ai:' + provider)) };
  const rec = await kv.get('ai:' + provider);
  if (!rec) return { key: '', remembered: false };
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv }, await deviceKey(), rec.ct);
    const key = new TextDecoder().decode(pt);
    mem.set(provider, key);
    return { key, remembered: true };
  } catch { return { key: '', remembered: false }; }
}
export async function forgetKey(provider) {
  mem.delete(provider); await kv.del('ai:' + provider);
  if (PROVIDERS[provider]) { const s = await prefs(); delete s.models[provider]; if (s.active === provider) s.active = ''; await kv.set('ai-prefs', s); }
}

// 고른 회사·모델(비밀 아님)
async function prefs() { const s = (await kv.get('ai-prefs')) || {}; return { active: s.active || '', models: s.models || {}, free: s.free || {} }; }
export async function setActive(provider, { model, freeTier } = {}) {
  const s = await prefs(); s.active = provider;
  if (model !== undefined) s.models[provider] = model;
  if (freeTier !== undefined) s.free[provider] = !!freeTier;
  await kv.set('ai-prefs', s);
}

/**
 * 지금 연결된 AI(없으면 null). 다른 기능(수정 요청 등)이 같은 연결을 씀.
 * @returns {Promise<null|{provider,key,model,label,freeTier,supportsImages}>}
 */
export async function getActiveAI() {
  const s = await prefs();
  const order = [s.active, ...Object.keys(PROVIDERS)].filter((x, i, a) => x && PROVIDERS[x] && a.indexOf(x) === i);
  for (const provider of order) {
    const { key } = await loadKey(provider);
    if (!key) continue;
    const freeTier = !!s.free[provider];
    const model = s.models[provider] || '';
    return { provider, key, model, label: PROVIDERS[provider].name, freeTier, supportsImages: provider === 'openrouter' ? !freeTier : PROVIDERS[provider].images };
  }
  return null;
}

// ── 오류: 상태 코드와 메시지로 종류를 가려 쉬운 안내로 바꿈 ──
export class AiError extends Error {
  constructor(kind, message, { status = 0, provider = '', retryAfter = 0 } = {}) { super(message); this.kind = kind; this.status = status; this.provider = provider; this.retryAfter = retryAfter; }
}
function classify(status, msg, code) {
  const m = `${code || ''} ${msg || ''}`;
  if (status === 401 || /API_KEY_INVALID|API key not valid|invalid.?x-api-key|Incorrect API key|invalid_api_key|No auth credentials|User not found|authentication_error/i.test(m)) return 'bad-key';
  if (/location is not supported|unsupported_country|not available in your (country|region)|FAILED_PRECONDITION/i.test(m)) return 'region';
  if (status === 402 || /insufficient_quota|credit balance is too low|Insufficient credits|billing|payment/i.test(m)) return 'billing';
  if (status === 429 && /per.?day|free-models-per-day|PerDay|daily/i.test(m)) return 'quota-day';
  if (status === 429 || /RESOURCE_EXHAUSTED|rate.?limit/i.test(m)) return 'quota';
  if (status === 403) return 'forbidden';
  if (status === 404 || /model.*(not found|does not exist)|No endpoints found/i.test(m)) return 'model';
  if (status === 413 || /context length|too long|maximum context|token count/i.test(m)) return 'too-long';
  if (status >= 500 || status === 529 || /overloaded/i.test(m)) return 'busy';
  return 'other';
}
async function fail(r, provider) {
  const j = await r.json().catch(() => ({}));
  const e = j.error || j;
  const msg = (typeof e === 'string' ? e : e.message) || `${PROVIDERS[provider]?.short || provider} 오류 ${r.status}`;
  const code = e.status || e.code || e.type || '';
  // 얼마 뒤에 다시 하라는지: retry-after 헤더, Gemini의 RetryInfo("retryDelay":"34s")나 문구("retry in 34.2s")
  const d = (Array.isArray(e.details) ? e.details : []).map((x) => x && x.retryDelay).find(Boolean);
  const retryAfter = Math.ceil(+r.headers.get('retry-after') || parseFloat(d) || +(/retry in ([\d.]+)\s*s/i.exec(msg) || [])[1] || 0);
  throw new AiError(classify(r.status, msg, code), msg, { status: r.status, provider, retryAfter });
}
async function send(provider, url, init) {
  let r;
  try { r = await fetch(url, init); }
  catch (e) { if (e.name === 'AbortError' || e.name === 'TimeoutError') throw e; throw new AiError('network', e.message || 'Failed to fetch', { provider }); }
  if (!r.ok) await fail(r, provider);
  return r.json();
}

/** 오류 → 강사에게 보여 줄 안내. actions: pay(연결해 둔 유료 AI로 이어서) · connect(다른 AI 연결) · key(키 페이지) · billing(결제 페이지) · paste(키 없이, 마지막 수단) */
export function explainError(err, provider) {
  const P = PROVIDERS[provider] || {};
  const k = err?.kind || (err?.name === 'TimeoutError' ? 'busy' : 'other');
  const T = {
    'bad-key': ['키가 맞지 않아요.', `키를 끝까지 복사했는지 확인해 주세요. 지운 키라면 ${P.short || ''} 키 페이지에서 새로 만들어 붙여 넣어 주세요.`, ['key']],
    forbidden: ['이 계정으로는 쓸 수 없어요.', provider === 'gemini' ? '학교·기관 구글 계정은 관리자가 AI Studio를 막아 둔 경우가 많아요. 개인 구글 계정으로 키를 만들어 주세요.' : '계정 권한이나 지역 제한일 수 있어요. 다른 계정의 키를 쓰거나 다른 AI를 연결해 주세요.', ['key', 'connect']],
    region: ['이 지역이나 계정에서는 쓸 수 없어요.', '만 18세 이상 개인 계정인지 확인해 주세요. 안 되면 다른 AI를 연결해 주세요.', ['connect', 'paste']],
    billing: ['크레딧이 없어요.', provider === 'openrouter' ? '무료 모델은 크레딧 없이 쓸 수 있어요. 다시 해도 안 되면 Gemini 키(무료)를 연결해 주세요.' : `${P.short || ''} 결제 페이지에서 크레딧을 충전해야 해요(최소 5달러). 결제 없이 하려면 Gemini 키(무료)를 연결해 주세요.`, provider === 'openrouter' ? ['connect'] : ['billing', 'connect']],
    'quota-day': ['오늘 쓸 수 있는 무료 횟수를 다 썼어요.', '다른 모델로도 해 봤어요. 내일 다시 되고, 지금 이어서 하려면 다른 AI를 연결해 주세요.', ['connect', 'paste']],
    quota: ['요청이 너무 많거나 무료 한도를 넘었어요.', '기다렸다가 다시 해 봤지만 안 됐어요. 몇 분 뒤에 다시 누르거나 다른 AI를 연결해 주세요.', ['connect', 'paste']],
    model: ['고른 모델을 쓸 수 없어요.', '모델을 바꾸거나, 연결을 끊고 다시 연결해 주세요.', []],
    'too-long': ['교재가 길어 한 번에 보내지 못했어요.', "'문구만 다듬기'로 하면 훨씬 짧게 보내요.", []],
    busy: ['AI 서버가 바빠요.', '잠시 뒤에 다시 눌러 주세요.', []],
    network: ['AI 회사에 닿지 못했어요.', '인터넷 연결을 확인해 주세요. 학교망에서 AI 사이트가 막혀 있을 수 있어요. 그러면 휴대폰 핫스팟으로 바꿔 주세요.', ['paste']],
    truncated: ['답이 중간에 끊겼어요.', "'문구만 다듬기'로 하면 답이 짧아 끊기지 않아요.", []],
    empty: ['AI가 빈 답을 보냈어요.', '다시 눌러 주세요. 무료 모델이면 다른 모델이 대신 답할 수 있어요.', []],
    other: ['AI가 답하지 못했어요.', err?.message || '', ['paste']],
  }[k] || ['AI가 답하지 못했어요.', err?.message || '', ['paste']];
  if (err?.paidOption) return { kind: k, provider, title: '무료 한도를 다 썼어요.', body: `연결해 둔 ${err.paidOption.label}(유료)로 이어서 할 수 있어요.`, actions: ['pay', 'connect'], paidOption: err.paidOption, raw: err?.message || '' };
  return { kind: k, provider, title: T[0], body: T[1], actions: T[2], raw: err?.message || '' };
}

// ── 모델 목록·고르기(모델 이름을 코드에 박지 않고, 그때그때 목록에서 고름) ──
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
async function listRaw(provider, key, signal) {
  if (provider === 'gemini') {
    const j = await send(provider, `${GEMINI}/models?pageSize=200`, { signal, headers: { 'x-goog-api-key': key } });
    return (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => ({ id: m.name.replace(/^models\//, ''), label: m.displayName || m.name }));
  }
  if (provider === 'anthropic') {
    const j = await send(provider, 'https://api.anthropic.com/v1/models?limit=100', { signal, headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } });
    return (j.data || []).map((m) => ({ id: m.id, label: m.display_name || m.id }));
  }
  if (provider === 'openai') {
    const j = await send(provider, 'https://api.openai.com/v1/models', { signal, headers: { authorization: `Bearer ${key}` } });
    return (j.data || []).map((m) => ({ id: m.id, label: m.id }));
  }
  const j = await send(provider, 'https://openrouter.ai/api/v1/models', { signal });
  return (j.data || []).map((m) => ({ id: m.id, label: m.name || m.id, free: /:free$/.test(m.id) || (m.pricing && +m.pricing.prompt === 0 && +m.pricing.completion === 0) }));
}
const ver = (id) => { const m = /(\d+(?:\.\d+)?)/.exec(id); return m ? parseFloat(m[1]) : 0; };
const SKIP = /tts|audio|image|vision|embed|live|realtime|transcribe|search|instruct|codex|computer|robotics|nano|learnlm|gemma|aqa|-exp|preview-\d\d-\d\d|deep-research|moderation|dall|whisper|sora/i;
/** 목록을 '쓰기 좋은 순서'로 정렬(맨 앞이 자동으로 고르는 모델) */
function rank(provider, list, freeTier) {
  const score = (m) => {
    const id = m.id.toLowerCase();
    if (SKIP.test(id)) return -100;
    if (provider === 'gemini') return id === 'gemini-flash-latest' ? 100 : /^gemini-[\d.]+-flash$/.test(id) ? 50 + ver(id) : /flash$/.test(id) && !/lite/.test(id) ? 30 + ver(id) : /flash/.test(id) ? 10 : 0;
    if (provider === 'openai') return /^gpt-[\d.]+-mini$/.test(id) ? 60 + ver(id) : /^gpt-[\d.]+$/.test(id) ? 40 + ver(id) : /^gpt-4o-mini$/.test(id) ? 35 : /^gpt-/.test(id) ? 5 : -50;
    if (provider === 'anthropic') return /sonnet/.test(id) ? 50 : /haiku/.test(id) ? 30 : 10; // 목록이 새것부터라 같은 점수면 앞이 최신
    if (freeTier) return id === 'openrouter/free' ? 100 : m.free ? (/gemini|deepseek|qwen|llama|gpt-oss/.test(id) ? 40 : 20) : -100;
    return /^google\/gemini-[\d.]+-flash$/.test(id) ? 60 + ver(id) : /^anthropic\/claude-sonnet/.test(id) ? 50 + ver(id) : /^openai\/gpt-[\d.]+-mini$/.test(id) ? 45 + ver(id) : 0;
  };
  return list.map((m, i) => ({ m, s: score(m), i })).filter((x) => x.s > -100).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.m);
}

/** OpenRouter 키 정보(무료 계정인지 등) */
async function openRouterKeyInfo(key, signal) {
  const j = await send('openrouter', 'https://openrouter.ai/api/v1/key', { signal, headers: { authorization: `Bearer ${key}` } });
  const d = j.data || {};
  return { freeTier: d.is_free_tier === true, label: d.label || '' }; // 한 번도 충전하지 않은 계정 = 무료 모델만
}

export async function models(provider, key, { freeTier } = {}) {
  return rank(provider, await listRaw(provider, key), freeTier);
}

/**
 * [연결 확인]: 키가 맞는지 실제로 물어보고, 쓸 모델을 고름. 돈이 드는 생성은 하지 않음.
 * @returns {Promise<{models, model, freeTier}>}
 */
export async function checkKey(provider, key, { signal } = {}) {
  if (!key) throw new AiError('bad-key', 'empty', { provider });
  let freeTier = false;
  if (provider === 'openrouter') ({ freeTier } = await openRouterKeyInfo(key, signal));
  const list = await models(provider, key, { freeTier });
  if (provider === 'openrouter' && freeTier && !list.some((m) => m.id === 'openrouter/free')) list.unshift({ id: 'openrouter/free', label: '무료 모델 자동 선택' });
  const model = list[0]?.id || (provider === 'gemini' ? 'gemini-flash-latest' : '');
  if (!model) throw new AiError('model', 'no model', { provider });
  await setActive(provider, { model, freeTier });
  return { models: list, model, freeTier };
}

// ── 생성 ──
/**
 * 브라우저에서 사용자 키로 바로 호출. 상태 코드별로 AiError를 던짐.
 * @returns {Promise<{text}>}
 */
export async function generate({ provider, key, model, prompt, signal, maxTokens = 16000 }) {
  const P = PROVIDERS[provider]; if (!P) throw new AiError('other', 'unknown provider');
  if (!model) { const s = await prefs(); model = s.models[provider] || (await checkKey(provider, key, { signal })).model; }
  let text = '', cut = false;
  if (provider === 'gemini') {
    const j = await send(provider, `${GEMINI}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: maxTokens, temperature: 0.4 } }),
    });
    const c = j.candidates?.[0];
    if (!c && j.promptFeedback?.blockReason) throw new AiError('other', `차단됨(${j.promptFeedback.blockReason})`, { provider });
    text = (c?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
    cut = c?.finishReason === 'MAX_TOKENS';
  } else if (provider === 'anthropic') {
    const j = await send(provider, 'https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
    });
    text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('');
    cut = j.stop_reason === 'max_tokens';
  } else {
    const openai = provider === 'openai';
    const j = await send(provider, openai ? 'https://api.openai.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, ...(openai ? {} : { 'X-Title': 'lecpage' }) },
      // OpenAI 최신 모델은 max_tokens 대신 max_completion_tokens. OpenRouter 무료 모델은 response_format을 못 받는 곳이 있어 뺌
      body: JSON.stringify(openai
        ? { model, messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, max_completion_tokens: maxTokens }
        : { model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens }),
    });
    const ch = j.choices?.[0];
    if (!ch && j.error) throw new AiError(classify(j.error.code || 0, j.error.message), j.error.message, { provider });
    text = ch?.message?.content || '';
    cut = ch?.finish_reason === 'length';
  }
  if (!text.trim()) throw new AiError(cut ? 'truncated' : 'empty', 'empty', { provider });
  return { text, cut };
}

const sleep = (ms, signal) => new Promise((res, rej) => {
  if (signal?.aborted) return rej(new DOMException('aborted', 'AbortError'));
  const t = setTimeout(res, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('aborted', 'AbortError')); }, { once: true });
});
// 무료 한도를 넘으면: 'stop'(무료 안에서만 이어감, 기본) | 'pay'(연결해 둔 유료 키·크레딧으로 이어감)
export function getOnLimit() { try { return localStorage.getItem('lecpage:on-limit') === 'pay' ? 'pay' : 'stop'; } catch { return 'stop'; } }
export function setOnLimit(v) { try { localStorage.setItem('lecpage:on-limit', v === 'pay' ? 'pay' : 'stop'); } catch { /* 저장 못 해도 이번에는 기본대로 */ } }
/** 쓴 만큼 돈이 나가는 연결인지: OpenAI·Claude 키, 충전한 OpenRouter */
export const isPaidAI = (provider, freeTier) => provider === 'openai' || provider === 'anthropic' || (provider === 'openrouter' && !freeTier);
const LIMIT_KINDS = ['quota', 'quota-day', 'busy', 'model', 'empty'];

/**
 * generate + 한도·혼잡을 알아서 넘김(강사가 다시 누르지 않게). 순서:
 *  1) 분당 한도·서버 혼잡: 알려 준 시간(최대 60초)만큼 기다렸다 다시, 두 번까지
 *  2) 무료로 쓰는 연결(Gemini, OpenRouter 무료)이면 같은 키의 다음 모델로, 두 번까지(무료 등급은 모델마다 한도가 따로)
 *  3) 연결해 둔 다른 AI로. 돈이 드는 연결은 allowPaid일 때만(기본은 [설정]의 '무료 한도를 넘으면')
 * 끝까지 안 되면 처음 오류를 던지고, 건너뛴 유료 연결이 있으면 err.paidOption = { provider, label }을 붙임.
 * onStatus({ wait: 초 } | { model } | { provider, label, paid })로 지금 하는 일을 알림. 돌려주는 값에 실제로 답한 provider·model이 들어 있음.
 */
export async function generateAuto(o, { onStatus, allowPaid = getOnLimit() === 'pay' } = {}) {
  const s = await prefs();
  const attempt = async (provider, key, model0, { swap }) => {
    let model = model0, waits = 0, swaps = 0, list = null;
    const tried = new Set();
    for (;;) {
      try { return { ...(await generate({ ...o, provider, key, model })), provider, model }; }
      catch (e) {
        if (!(e instanceof AiError)) throw e;
        if ((e.kind === 'quota' || e.kind === 'busy') && waits < 2 && (e.retryAfter || 0) <= 60) {
          const sec = Math.max(4, e.retryAfter || (waits ? 20 : 8)); waits++;
          onStatus?.({ wait: sec }); await sleep(sec * 1000, o.signal); continue;
        }
        if (!swap || !LIMIT_KINDS.includes(e.kind) || swaps >= 2) throw e;
        let next = null;
        try {
          if (!model) model = s.models[provider] || '';
          tried.add(model);
          list = list || await models(provider, key, { freeTier: !!s.free[provider] });
          next = list.find((m) => !tried.has(m.id));
        } catch { /* 목록을 못 받으면 넘기지 않음 */ }
        if (!next) throw e;
        model = next.id; swaps++; waits = 0; onStatus?.({ model });
      }
    }
  };
  const paid0 = isPaidAI(o.provider, !!s.free[o.provider]);
  let first;
  try { return await attempt(o.provider, o.key, o.model, { swap: !paid0 }); }
  catch (e) { if (!(e instanceof AiError) || !LIMIT_KINDS.includes(e.kind)) throw e; first = e; }
  // 연결해 둔 다른 AI(무료 먼저)
  let paidOption = null;
  const others = Object.keys(PROVIDERS).filter((x) => x !== o.provider).sort((a, b) => isPaidAI(a, !!s.free[a]) - isPaidAI(b, !!s.free[b]));
  for (const provider of others) {
    const { key } = await loadKey(provider);
    if (!key) continue;
    const paid = isPaidAI(provider, !!s.free[provider]);
    if (paid && !allowPaid) { paidOption = paidOption || { provider, label: PROVIDERS[provider].name }; continue; }
    onStatus?.({ provider, label: PROVIDERS[provider].name, paid });
    try { return await attempt(provider, key, s.models[provider] || '', { swap: !paid }); }
    catch (e) { if (e.name === 'AbortError' || e.name === 'TimeoutError') throw e; }
  }
  if (paidOption) first.paidOption = paidOption;
  throw first;
}

// ── OpenRouter 로그인(OAuth PKCE): 버튼 한 번으로 사용자 소유 키 받기 ──
function b64url(bytes) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
export async function openRouterStart({ remember = false } = {}) {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  sessionStorage.setItem('lecpage:or-verifier', verifier);
  sessionStorage.setItem('lecpage:or-return', location.hash || '#/');
  sessionStorage.setItem('lecpage:or-remember', remember ? '1' : '');
  const cb = location.origin + location.pathname;
  location.href = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(cb)}&code_challenge=${challenge}&code_challenge_method=S256`;
}
export async function openRouterFinish() {
  const url = new URL(location.href);
  const code = url.searchParams.get('code');
  const verifier = sessionStorage.getItem('lecpage:or-verifier');
  if (!code || !verifier) return null;
  sessionStorage.removeItem('lecpage:or-verifier');
  const back = sessionStorage.getItem('lecpage:or-return') || '#/';
  history.replaceState(null, '', location.pathname + back);
  window.dispatchEvent(new HashChangeEvent('hashchange')); // replaceState는 hashchange를 안 일으킴 → 하던 화면으로 바로 돌아가게
  const j = await send('openrouter', 'https://openrouter.ai/api/v1/auth/keys', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }) })
    .catch((e) => { throw new Error('OpenRouter 연결에 실패했어요. 다시 눌러 주세요. (' + e.message + ')'); });
  if (!j.key) throw new Error('OpenRouter 연결에 실패했어요. 다시 눌러 주세요.');
  await saveKey('openrouter', j.key, sessionStorage.getItem('lecpage:or-remember') === '1');
  await checkKey('openrouter', j.key).catch(() => setActive('openrouter'));
  sessionStorage.setItem('lecpage:ai-resume', '1'); // 돌아온 화면에서 AI 창을 다시 엶
  window.dispatchEvent(new Event('lecpage:ai-connected'));
  return j.key;
}
/** OpenRouter에서 막 돌아왔으면 true(한 번만) */
export function takeAiResume() { try { const v = sessionStorage.getItem('lecpage:ai-resume'); sessionStorage.removeItem('lecpage:ai-resume'); return v === '1'; } catch { return false; } }
