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
  if (PROVIDERS[provider]) { const s = await prefs(); delete s.models[provider]; delete s.picked[provider]; delete s.free[provider]; if (s.active === provider) s.active = ''; await kv.set('ai-prefs', s); }
}

// 고른 회사·모델(비밀 아님)
async function prefs() { const s = (await kv.get('ai-prefs')) || {}; return { active: s.active || '', models: s.models || {}, free: s.free || {}, picked: s.picked || {} }; }
/** picked: 강사가 직접 고른 모델인지(true면 추천이 바뀌어도 그대로 둠) */
export async function setActive(provider, { model, freeTier, picked } = {}) {
  const s = await prefs(); s.active = provider;
  if (model !== undefined) s.models[provider] = model;
  if (freeTier !== undefined) s.free[provider] = !!freeTier;
  if (picked !== undefined) s.picked[provider] = !!picked;
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
  if (status === 429 && /limit:\s*0\b/.test(m)) return 'no-access'; // 무료 키로는 못 쓰는 모델(한도 0)
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
    'no-access': ['이 모델은 지금 키로 쓸 수 없어요.', '무료 키로 쓸 수 있는 모델로 바꿔 주세요.', []],
    refusal: ['AI가 이 내용은 만들지 않겠다고 했어요.', '교재에 민감한 주제(보안·생물 실험 등)가 있으면 그럴 수 있어요. 다른 AI를 연결해 다시 해 보세요.', ['connect']],
    'too-long': ['교재가 길어 한 번에 보내지 못했어요.', "'문구만 다듬기'로 하면 훨씬 짧게 보내요.", []],
    busy: ['AI 서버가 바빠요.', '잠시 뒤에 다시 눌러 주세요.', []],
    network: ['AI 회사에 닿지 못했어요.', '인터넷 연결을 확인해 주세요. 학교망에서 AI 사이트가 막혀 있을 수 있어요. 그러면 휴대폰 핫스팟으로 바꿔 주세요.', ['paste']],
    truncated: ['답이 중간에 끊겼어요.', "'문구만 다듬기'로 하면 답이 짧아 끊기지 않아요.", []],
    empty: ['AI가 빈 답을 보냈어요.', '다시 눌러 주세요. 무료 모델이면 다른 모델이 대신 답할 수 있어요.', []],
    other: ['AI가 답하지 못했어요.', err?.message || '', ['paste']],
  }[k] || ['AI가 답하지 못했어요.', err?.message || '', ['paste']];
  if (err?.paidOption || err?.lightOption) {
    const ways = [err.paidOption && `연결해 둔 ${err.paidOption.label}(유료)`, err.lightOption && `가벼운 모델(${err.lightOption.label})`].filter(Boolean).join('이나 ');
    return { kind: k, provider, title: '오늘 이 모델의 무료 한도를 다 썼어요.', body: `${ways}로 이어서 할 수 있어요.${err.lightOption ? ' 가벼운 모델은 구성과 문구가 단순해질 수 있어요.' : ''}`, actions: [err.paidOption && 'pay', err.lightOption && 'light', 'connect'].filter(Boolean), raw: err?.message || '' };
  }
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
// ── 모델 등급과 추천 ──
// 모델 이름은 몇 달마다 바뀝니다(2026-11: OpenAI GPT-6 Sol·Terra·Luna, Gemini 4 Carbon·Argon …). 이름으로 고르면 금방 틀리므로
// 가격과 출시일을 OpenRouter 공개 목록에서 그때그때 읽어 등급을 매깁니다(키 없이 읽히고 운영자 서버를 거치지 않음). 못 읽으면 이름으로 어림.
//   등급(출력 100만 토큰 값): 최상위 $30~ · 고품질 $8~ · 표준 $3~ · 가벼움 그 아래
//   추천 = 고품질 등급에서 가장 새 모델(나온 지 2주가 안 된 것은 뒤로). 교재를 읽고 연수 흐름을 짜는 일은 가벼운 모델에서 결과가 눈에 띄게 단순해짐
const SKIP = /tts|audio|image|vision|embed|live|realtime|transcribe|translate|search|instruct|codex|computer|robotics|nano|banana|omni|learnlm|gemma|guard|aqa|-exp|preview-\d\d-\d\d|deep-research|moderation|dall|whisper|sora/i;
export const TIER_KO = ['가벼움', '표준', '고품질', '최상위'];
const OR_PREFIX = { openai: 'openai/', gemini: 'google/', anthropic: 'anthropic/', openrouter: '' };
const PREFER = { anthropic: /opus/, openrouter: /^anthropic\/claude-opus/ };
const FRESH_MS = 14 * 86400000;
const normId = (id) => String(id).toLowerCase().replace(/^models\//, '').replace(/\./g, '-').replace(/-(?:\d{4}-\d{2}-\d{2}|\d{8}|\d{3})$/, '');
const tierByPrice = (out) => (out >= 30 ? 3 : out >= 8 ? 2 : out >= 3 ? 1 : 0);
const tierByName = (id) => (/astra|fable|mythos|ultra|daybreak-red/.test(id) ? 3 : /opus|sonnet|(?:^|[-/])sol(?:-|$)|carbon|argon|(?:^|-)pro(?:-|$)|daybreak-blue/.test(id) ? 2 : /(?:^|[-/.])(?:haiku|luna|mini|lite|small)(?:[-.]|$)/.test(id) ? 0 : 1);
/** 이름 속 판 번호(가격 목록을 못 읽었을 때 새 모델을 가리는 데 씀): claude-opus-5-5 → 5.05, gpt-6.1-sol → 6.01 */
const verOf = (id) => { const m = /(?:^|[-/])(\d{1,2})(?:[.-](\d{1,2}))?(?=-|$)/.exec(normId(id)); return m ? +m[1] + (+m[2] || 0) / 100 : 0; };
let catalogP = null;
/** @returns {Promise<Map<string,{in:number,out:number,created:number,text:boolean}>>} 열쇠는 normId('회사/모델') */
function catalog() {
  if (!catalogP) {
    catalogP = (async () => {
      const m = new Map();
      try {
        const r = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(8000) });
        for (const x of (await r.json()).data || []) {
          if (/:[\w-]+$/.test(x.id)) continue; // :free·:batch 같은 변형
          const mods = x.architecture?.output_modalities;
          m.set(normId(x.id), { in: +x.pricing?.prompt * 1e6 || 0, out: +x.pricing?.completion * 1e6 || 0, created: (x.created || 0) * 1000, text: !Array.isArray(mods) || mods.every((t) => t === 'text') });
        }
      } catch { catalogP = null; } // 못 읽으면 이번에는 이름으로 어림하고, 다음에 다시 읽음
      return m;
    })();
  }
  return catalogP;
}
/**
 * 목록에 등급·추천·어림 값을 붙이고 고르기 좋은 순서로(맨 앞이 추천).
 * @returns {Promise<Array<{id,label,tier,rec,won,locked,free}>>} won: 사이트 한 번 만들 때 어림 값(원, 입력 1만·출력 1만 4천 토큰, 1달러 1,400원). 무료로 쓰는 연결은 0
 */
async function rank(provider, list, freeTier) {
  const cat = await catalog(); const now = Date.now();
  const rows = [];
  list.forEach((m, i) => {
    const id = m.id.toLowerCase();
    if (provider === 'openrouter') {
      if (freeTier ? !(m.free || id === 'openrouter/free') : !/^(anthropic|openai|google)\//.test(id)) return;
    } else if (SKIP.test(id) || (provider === 'openai' && (!/^gpt-/.test(id) || /-pro$/.test(id)))) return;
    if (provider === 'openrouter' && !freeTier && (SKIP.test(id) || /:[\w-]+$/.test(id))) return;
    const c = cat.get(OR_PREFIX[provider] + normId(id));
    if (c && !c.text) return;
    const free = provider === 'openrouter' && !!freeTier;
    const tier = free ? 0 : c && c.out > 0 ? tierByPrice(c.out) : tierByName(id);
    const paidOnly = provider === 'gemini' && !!freeTier && tier >= 2; // 무료 키로는 못 쓰는 모델
    const won = free || provider === 'gemini' || !c ? 0 : Math.max(10, Math.round(((10000 * c.in + 14000 * c.out) / 1e6) * 1400 / 10) * 10);
    rows.push({ id: m.id, label: m.label || m.id, tier, rec: false, won, locked: paidOnly, free, created: c?.created || 0, i });
  });
  // 추천: 고품질 등급(없으면 그 아래에서 가장 높은 등급)에서 고름
  const usable = rows.filter((r) => !r.locked && !r.free);
  const top = Math.max(-1, ...usable.filter((r) => r.tier <= 2).map((r) => r.tier));
  const pool = usable.filter((r) => r.tier === top);
  const pref = PREFER[provider];
  const score = (r) => [pref && pref.test(r.id.toLowerCase()) ? 0 : 1, r.created && now - r.created < FRESH_MS ? 1 : 0, -r.created, -verOf(r.id), r.id.length, r.i];
  const cmp = (a, b) => { const x = score(a), y = score(b); for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return x[k] - y[k]; return 0; };
  const rec = pool.sort(cmp)[0];
  if (rec) rec.rec = true;
  const order = { 2: 0, 3: 1, 1: 2, 0: 3 };
  return rows.sort((a, b) => (b.rec - a.rec) || (a.locked - b.locked) || (order[a.tier] - order[b.tier]) || (b.created - a.created) || (verOf(b.id) - verOf(a.id)) || (a.i - b.i));
}
/** 고르는 칸에 보일 이름: '모델 · 추천 · 약 220원' */
export function modelText(m) {
  return `${m.label}${m.rec ? ' · 추천' : m.free ? ' · 무료' : ` · ${TIER_KO[m.tier]}`}${m.won ? ` · 약 ${m.won.toLocaleString('ko-KR')}원` : ''}${m.locked ? ' · 유료 키 필요' : ''}`;
}

/** OpenRouter 키 정보(무료 계정인지 등) */
async function openRouterKeyInfo(key, signal) {
  const j = await send('openrouter', 'https://openrouter.ai/api/v1/key', { signal, headers: { authorization: `Bearer ${key}` } });
  const d = j.data || {};
  return { freeTier: d.is_free_tier === true, label: d.label || '' }; // 한 번도 충전하지 않은 계정 = 무료 모델만
}

export async function models(provider, key, { freeTier } = {}) {
  const list = await rank(provider, await listRaw(provider, key), freeTier);
  if (provider === 'openrouter' && freeTier && !list.some((m) => m.id === 'openrouter/free')) list.unshift({ id: 'openrouter/free', label: '무료 모델 자동 선택', tier: 0, rec: false, won: 0, locked: false, free: true });
  return list;
}

/**
 * [연결 확인]: 키가 맞는지 실제로 물어보고, 쓸 모델을 고름. 돈이 드는 생성은 하지 않음.
 * @returns {Promise<{models, model, freeTier}>}
 */
export async function checkKey(provider, key, { signal } = {}) {
  if (!key) throw new AiError('bad-key', 'empty', { provider });
  let freeTier = false;
  if (provider === 'openrouter') ({ freeTier } = await openRouterKeyInfo(key, signal));
  const s = await prefs();
  if (provider === 'gemini') freeTier = !!s.free.gemini; // 무료 키인지는 처음 만들 때 알게 됨(generateAuto)
  const list = await models(provider, key, { freeTier });
  // 강사가 직접 고른 모델이 아직 있으면 그대로, 아니면 추천 모델
  const kept = s.picked[provider] && list.find((m) => m.id === s.models[provider] && !m.locked);
  const model = (kept || list.find((m) => !m.locked) || {}).id || (provider === 'gemini' ? 'gemini-flash-latest' : '');
  if (!model) throw new AiError('model', 'no model', { provider });
  await setActive(provider, { model, freeTier });
  return { models: list, model, freeTier };
}

// ── Anthropic(스트리밍) ──
// 생각하는 토큰도 max_tokens에 들어가서 넉넉히 주고, 긴 요청이 중간에 끊기지 않게 스트리밍으로 받습니다.
// Claude 5 계열은 안전 분류기가 요청을 거절할 수 있어(보안·생물 주제 교재 등) 서버가 다른 모델로 이어받게 fallbacks를 켭니다.
// 이 값을 받지 않는 모델·환경이면(400이나 연결 실패) 기본 요청으로 한 번 더 보냅니다.
async function anthropic(key, model, prompt, maxTokens, signal) {
  const base = { model, max_tokens: Math.max(maxTokens, 32000), messages: [{ role: 'user', content: prompt }], stream: true };
  const headers = { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
  const extra = /claude-(opus|sonnet|fable)-5/.test(model);
  const call = async (plus) => {
    let r;
    try {
      r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal, headers: plus ? { ...headers, 'anthropic-beta': 'server-side-fallback-2026-07-01' } : headers, body: JSON.stringify(plus ? { ...base, fallbacks: 'default' } : base) });
    } catch (e) { if (e.name === 'AbortError' || e.name === 'TimeoutError') throw e; throw new AiError('network', e.message || 'Failed to fetch', { provider: 'anthropic' }); }
    if (!r.ok) await fail(r, 'anthropic');
    const reader = r.body.getReader(); const dec = new TextDecoder();
    let buf = '', text = '', stop = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let n;
      while ((n = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, n).trim(); buf = buf.slice(n + 1);
        if (!line.startsWith('data:')) continue;
        let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') text += ev.delta.text || '';
        else if (ev.type === 'message_delta') stop = ev.delta?.stop_reason || stop;
        else if (ev.type === 'error') throw new AiError(classify(ev.error?.type === 'overloaded_error' ? 529 : 0, ev.error?.message, ev.error?.type), ev.error?.message || 'stream error', { provider: 'anthropic' });
      }
    }
    if (stop === 'refusal') throw new AiError('refusal', 'refusal', { provider: 'anthropic' });
    return { text, cut: stop === 'max_tokens' };
  };
  if (!extra) return call(false);
  try { return await call(true); }
  catch (e) { if (e instanceof AiError && (e.status === 400 || e.kind === 'network')) return call(false); throw e; }
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
    ({ text, cut } = await anthropic(key, model, prompt, maxTokens, signal));
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
 *  2) 무료로 쓰는 연결(Gemini, OpenRouter 무료)이면 같은 키의 다음 모델로(무료 등급은 모델마다 한도가 따로).
 *     이 키로 못 쓰는 모델이면 아래 등급으로도 내려가고, 한도를 다 쓴 것이면 같은 등급 안에서만(더 가벼운 모델은 allowLight일 때만)
 *  3) 연결해 둔 다른 AI로. 돈이 드는 연결은 allowPaid일 때만(기본은 [설정]의 '무료 한도를 넘으면')
 * 끝까지 안 되면 처음 오류를 던지고, 건너뛴 길이 있으면 err.paidOption = { provider, label }, err.lightOption = { provider, id, label }을 붙임.
 * onStatus({ wait: 초 } | { model } | { provider, label, paid })로 지금 하는 일을 알림. 돌려주는 값에 실제로 답한 provider·model이 들어 있음.
 */
export async function generateAuto(o, { onStatus, allowPaid = getOnLimit() === 'pay', allowLight = false } = {}) {
  const s = await prefs();
  let lightOption = null;
  const attempt = async (provider, key, model0, { swap }) => {
    let model = model0, waits = 0, swaps = 0, list = null, noAccess = false;
    const tried = new Set();
    for (;;) {
      try {
        const out = { ...(await generate({ ...o, provider, key, model })), provider, model };
        // 무료 키로 못 쓰는 모델을 건너뛰고 됐으면 다음부터는 바로 그 모델로
        if (noAccess && !s.picked[provider]) await setActive(provider, { model, ...(provider === 'gemini' ? { freeTier: true } : {}) }).catch(() => { });
        return out;
      } catch (e) {
        if (!(e instanceof AiError)) throw e;
        if ((e.kind === 'quota' || e.kind === 'busy') && waits < 2 && (e.retryAfter || 0) <= 60) {
          const sec = Math.max(4, e.retryAfter || (waits ? 20 : 8)); waits++;
          onStatus?.({ wait: sec }); await sleep(sec * 1000, o.signal); continue;
        }
        const blocked = e.kind === 'no-access' || e.kind === 'model' || (e.kind === 'forbidden' && provider === 'gemini'); // 이 키로는 못 쓰는 모델
        if (!swap || !(blocked || LIMIT_KINDS.includes(e.kind)) || swaps >= (blocked ? 5 : 2)) throw e;
        let next = null;
        try {
          if (!model) model = s.models[provider] || '';
          tried.add(model);
          list = list || await models(provider, key, { freeTier: !!s.free[provider] });
          const cur = list.find((m) => m.id === model);
          const rest = list.filter((m) => !tried.has(m.id) && !m.locked);
          // 한도를 다 쓴 것이면 같은 등급 이상에서만 이어감. 더 가벼운 모델은 품질이 떨어지므로 강사에게 물어봄
          // 못 쓰는 모델이면 같은 등급의 다른 모델도 대개 못 쓰므로(무료 키) 바로 아래 등급으로
          next = blocked ? (cur && rest.find((m) => m.tier < cur.tier)) || rest[0] : allowLight || !cur ? rest[0] : rest.find((m) => m.tier >= cur.tier);
          if (!next && rest[0]) lightOption = lightOption || { provider, id: rest[0].id, label: rest[0].label };
        } catch { /* 목록을 못 받으면 넘기지 않음 */ }
        if (!next) throw e;
        if (blocked) noAccess = true;
        model = next.id; swaps++; waits = 0; onStatus?.({ model });
      }
    }
  };
  const paid0 = isPaidAI(o.provider, !!s.free[o.provider]);
  let first;
  try { return await attempt(o.provider, o.key, o.model, { swap: !paid0 }); }
  catch (e) { if (!(e instanceof AiError) || !(LIMIT_KINDS.includes(e.kind) || e.kind === 'no-access')) throw e; first = e; }
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
  if (lightOption) first.lightOption = lightOption;
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
