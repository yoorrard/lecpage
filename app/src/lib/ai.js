// AI 연결: 키는 기본적으로 이 탭의 메모리에만(새로 고침하면 사라짐), 원하면 이 기기에 암호화해 저장(WebCrypto, 꺼낼 수 없는 키).
// 키와 교재는 운영자 서버로 가지 않고, 브라우저에서 AI 회사로 바로 갑니다.
// 공개 API(다른 화면도 씀): PROVIDERS, loadKey, saveKey, forgetKey, models, generate, getActiveAI, detectProvider, checkKey
import { kv } from './db.js';
import { TIER_KO, catalogLoader, rankModels, geminiPaidOnly } from './ai-catalog.js';

// 화면에 먼저 보이는 것: ChatGPT(OpenAI) · Claude. Gemini(무료 등급)는 작은 버튼으로 — ai-guides.jsx의 GUIDE_ORDER·GUIDE_MORE. 값·주소·오류 모양은 각 회사 공식 문서와 맞춰 봄(2026-11-14, 근거는 docs/research/ai-facts-2026-11-14.md).
// OpenRouter는 고르는 화면에서 뺐습니다(hidden). 저장해 둔 연결과 붙여 넣은 sk-or- 키, 로그인에서 돌아오는 처리는 그대로 동작합니다.
export const PROVIDERS = {
  gemini: { name: 'Google Gemini', short: 'Gemini', free: true, keyUrl: 'https://aistudio.google.com/apikey', billingUrl: 'https://aistudio.google.com/billing', note: '무료 키로 넣은 내용은 구글 제품 개선에 쓰일 수 있어요. 학생 개인정보는 넣지 마세요.', images: true },
  openrouter: { name: 'OpenRouter', short: 'OpenRouter', hidden: true, free: true, keyUrl: 'https://openrouter.ai/settings/keys', billingUrl: 'https://openrouter.ai/settings/credits', note: '무료 모델은 하루 50번까지예요. 무료 모델 중에는 넣은 내용을 학습에 쓰는 곳도 있어요.', oauth: true, images: true },
  openai: { name: 'OpenAI', short: 'OpenAI', free: false, keyUrl: 'https://platform.openai.com/api-keys', billingUrl: 'https://platform.openai.com/settings/organization/billing/overview', note: '쓴 만큼 충전한 크레딧에서 나가요.', images: true },
  anthropic: { name: 'Anthropic Claude', short: 'Claude', free: false, keyUrl: 'https://platform.claude.com/settings/keys', billingUrl: 'https://platform.claude.com/settings/billing', note: '쓴 만큼 충전한 크레딧에서 나가요.', images: true },
};
/** 고르는 화면에 보이는 회사(이 순서대로) */
export const VISIBLE = ['openai', 'anthropic', 'gemini'].filter((id) => PROVIDERS[id] && !PROVIDERS[id].hidden);

// ── 만드는 길: 쓰던 AI 창(chat) · 키 연결(key). 한 번 고른 길을 이 브라우저에 기억해 다음에는 바로 그 길로 ──
const WAY = 'lecpage:ai-way';
export function getWay() { try { const v = localStorage.getItem(WAY); return v === 'chat' || v === 'key' ? v : ''; } catch { return ''; } }
export function setWay(v) { try { if (v === 'chat' || v === 'key') localStorage.setItem(WAY, v); else localStorage.removeItem(WAY); } catch { /* 저장 못 해도 이번에는 고른 대로 */ } }

/**
 * 쓰던 AI 창. prefill: 프롬프트를 입력 칸에 채운 채 여는 주소(공식 문서가 있는 Claude만, 그 길이 안일 때만).
 * Claude 문서(support.claude.com 'Open Claude Desktop with a link', 2026-11)는 q 값을 약 14,000자에서 자른다고 함 → 그보다 짧을 때만 씀.
 * ChatGPT ?q=는 공식 문서가 없어 쓰지 않음. 어느 쪽이든 프롬프트는 늘 클립보드에도 복사함(채워지지 않으면 붙여 넣으면 됨)
 */
export const PREFILL_MAX = 13900;
export const CHATBOTS = [
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai/new', prefill: (t) => (t && t.length <= PREFILL_MAX ? `https://claude.ai/new?q=${encodeURIComponent(t)}` : '') },
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app' },
];
const BOT = 'lecpage:chatbot';
export function getChatbot() { try { const v = localStorage.getItem(BOT) || ''; return CHATBOTS.some((b) => b.id === v) ? v : ''; } catch { return ''; } }
export function setChatbot(id) { try { localStorage.setItem(BOT, id); } catch { /* 저장 못 해도 됨 */ } }
/** 오류에서 AI 창 길로 넘어가는 버튼 이름: 그 회사의 AI 이름으로(결제 없음 → '쓰던 ChatGPT로 만들기') */
export function chatLabel(provider) { return provider === 'openai' ? '쓰던 ChatGPT로 만들기' : provider === 'anthropic' ? '쓰던 Claude로 만들기' : provider === 'gemini' ? '쓰던 Gemini로 만들기' : '쓰던 AI로 만들기'; }
/** 오류에서 넘어갈 때 먼저 내세울 AI 창 */
export const chatbotFor = (provider) => ({ openai: 'chatgpt', anthropic: 'claude', gemini: 'gemini' }[provider] || '');

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
  // 저장이 막힌 창(사생활 보호 등)이면 읽기는 '없음'으로(설정·연결 화면이 멈추지 않게. 저장하려 할 때 안내)
  if (mem.has(provider)) return { key: mem.get(provider), remembered: !!(await kv.get('ai:' + provider).catch(() => null)) };
  const rec = await kv.get('ai:' + provider).catch(() => null);
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
  if (PROVIDERS[provider]) { const s = await prefs(); delete s.models[provider]; delete s.picked[provider]; delete s.free[provider]; delete s.blocked[provider]; if (s.active === provider) s.active = ''; await kv.set('ai-prefs', s); }
}

// 고른 회사·모델(비밀 아님)
async function prefs() { const s = (await kv.get('ai-prefs').catch(() => null)) || {}; return { active: s.active || '', models: s.models || {}, free: s.free || {}, picked: s.picked || {}, blocked: s.blocked || {} }; }
/** 이 키로는 못 쓰는 모델로 확인된 것(예: Gemini 무료 등급에서 Gemini 4 Carbon·Argon). 고르는 칸에서 '유료 키 필요'로 보임 */
async function markBlocked(provider, id) {
  const s = await prefs(); const list = s.blocked[provider] || [];
  if (!list.includes(id)) { s.blocked[provider] = [...list, id].slice(-20); await kv.set('ai-prefs', s); }
}
/**
 * 생성(gen/job.js)에서 처음 모델이 이 키로 안 돼(무료 키에 유료 전용 모델 등) 바꾼 모델로 답을 받았을 때: 안 된 모델은 '유료 키 필요'로 기억하고,
 * Gemini는 무료 키로 적어 둠(checkKey·고르는 칸이 이 값을 씀 → 다음 만들기는 되는 모델로 바로 시작). 강사가 직접 고른 모델·지금 고른 회사는 그대로
 */
export async function rememberWorkingModel(provider, model, failed = []) {
  for (const id of failed) await markBlocked(provider, id);
  const s = await prefs();
  if (!s.picked[provider] && model) s.models[provider] = model;
  if (provider === 'gemini') s.free.gemini = true;
  await kv.set('ai-prefs', s);
}
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
/** 상태 코드·오류 코드·문구 → 오류 종류(생성 파이프라인 lib/gen도 씀). code: 회사가 준 코드들을 이어 붙인 글 */
export function classify(status, msg, code) {
  const m = `${code || ''} ${msg || ''}`;
  if (/FREE_TIER_VERIFICATION_REQUIRED|must be verified before/i.test(m)) return 'verify'; // Gemini 무료 등급: 휴대폰 확인이 필요한 프로젝트(403)
  if (/CORS requests are not allowed/i.test(m)) return 'no-browser'; // Claude: 브라우저에서 바로 부르지 못하게 막아 둔 조직(401)
  if (/anthropic-workspace-id|workspace ID|specify (a|the) workspace/i.test(m)) return 'workspace'; // Claude: Workspace를 고르지 않고 만든 키
  // 이번 달 쓸 수 있는 금액을 다 씀. Claude: 등급 한도 429(enforced_spend_limit_reached)·직접 정한 한도 400("You have reached your specified API usage limits")
  // OpenAI: 직접 정한 한도·OpenAI가 정한 한도 429(organization_/project_spend_limit_exceeded, organization_usage_limit_exceeded)
  if (/API usage limits|monthly API usage|enforced_spend_limit_reached|spend_limit_exceeded|usage_limit_exceeded/i.test(m)) return 'cap';
  if (status === 401 || /API_KEY_INVALID|API key not valid|invalid.?x-api-key|Incorrect API key|invalid_api_key|No auth credentials|User not found|authentication_error/i.test(m)) return 'bad-key';
  if (/location is not supported|unsupported_country|not available in your (country|region)|FAILED_PRECONDITION/i.test(m)) return 'region';
  // Gemini 한도 초과(429 RESOURCE_EXHAUSTED) 문구에는 "check your plan and billing details"가 들어 있어 결제 문제로 잘못 읽지 않게 뺌
  const gQuota = status === 429 && /RESOURCE_EXHAUSTED/.test(m);
  if (status === 402 || (!gQuota && /insufficient_quota|credit_balance_exhausted|credit balance is too low|Insufficient credits|billing|payment/i.test(m))) return 'billing'; // OpenAI 크레딧 없음은 429 credit_balance_exhausted(2026-11)
  if (status === 429 && /limit:\s*0\b/.test(m)) return 'no-access'; // 무료 키로는 못 쓰는 모델(한도 0)
  if (status === 429 && /per.?day|free-models-per-day|PerDay|daily|\bquota_exceeded\b/i.test(m)) return 'quota-day';
  if (status === 429 || /RESOURCE_EXHAUSTED|rate.?limit/i.test(m)) return 'quota';
  if (status === 403) return 'forbidden';
  if (status === 404 || /model.*(not found|does not exist)|No endpoints found/i.test(m)) return 'model';
  if (status === 413 || /context length|too long|maximum context|token count/i.test(m)) return 'too-long';
  if (status >= 500 || status === 529 || /overloaded/i.test(m)) return 'busy';
  return 'other';
}
/**
 * 학교·기관 망의 차단 화면: AI 회사 주소인데 JSON이 아니라 웹 페이지(HTML)가 옴(200이어도). 원문(영어 개발자 문구) 대신
 * 'blocked'(이 망에서 닿지 않음 → 쓰던 AI 창 길)로. 같은 규칙을 생성 파이프라인(lib/gen)도 씀
 */
// 5xx·429는 회사 쪽 CDN의 오류 화면일 수 있어 상태 코드대로(바쁨·한도) 둠
export const isBlockPage = (r) => r.status < 500 && r.status !== 429 && /text\/html|application\/xhtml/i.test(r.headers?.get?.('content-type') || '');
export async function readJson(r, provider) {
  if (isBlockPage(r)) throw new AiError('blocked', 'html page', { status: r.status, provider });
  const t = await r.text();
  try { return JSON.parse(t); } catch { throw new AiError(/^\s*</.test(t) ? 'blocked' : 'other', /^\s*</.test(t) ? 'html page' : '', { status: r.status, provider }); }
}
/** 실패한 응답(r.ok가 아님) → AiError를 던짐(gen/providers도 씀) */
export async function fail(r, provider) {
  if (isBlockPage(r)) throw new AiError('blocked', 'html page', { status: r.status, provider });
  const j0 = await r.json().catch(() => ({}));
  const j = (Array.isArray(j0) ? j0[0] : j0) || {}; // Gemini는 오류를 배열([{ error }])로 주기도 함(실제 402, 2026-11-20)
  const e = j.error || j;
  const msg = (typeof e === 'string' ? e : e.message) || `${PROVIDERS[provider]?.short || provider} 오류 ${r.status}`;
  // 오류 코드는 회사마다 자리가 다름: Gemini status, OpenAI code·type(크레딧 없음은 code credit_balance_exhausted, type insufficient_quota), Claude type·details.error_code
  const code = [e.status, e.code, e.type, e.details?.error_code].filter((x) => typeof x === 'string').join(' ');
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
  return readJson(r, provider);
}

/**
 * 오류 → 강사에게 보여 줄 안내. actions: pay(연결해 둔 유료 AI로 이어서) · connect(다른 AI 연결) · key(키 페이지) · billing(결제 페이지)
 * · link(돌려준 link.href 열기) · paste(쓰던 AI로 만들기. 버튼 이름은 chatLabel(provider)). 맨 앞 동작을 주 버튼으로 보여 줌
 */
export function explainError(err, provider) {
  const P = PROVIDERS[provider] || {};
  const k = err?.kind || (err?.name === 'TimeoutError' ? 'busy' : 'other');
  const paid = provider === 'openai' || provider === 'anthropic';
  const T = {
    'bad-key': ['키가 맞지 않아요.', `키를 끝까지 복사했는지 확인해 주세요. 지웠거나 오래된 키라면 ${P.short || ''} 키 페이지에서 새로 만들어 주세요.`, ['key', 'paste']],
    verify: ['구글이 휴대폰 확인을 요청했어요.', '확인 페이지에서 휴대폰 카메라로 QR을 찍으면 무료로 쓸 수 있어요. 어려우면 다른 AI를 연결하거나 쓰던 AI 창으로 만들어 주세요.', ['link', 'connect', 'paste']],
    forbidden: ['이 계정으로는 쓸 수 없어요.', provider === 'gemini' ? '학교·기관 구글 계정은 관리자가 막아 둔 경우가 많아요. 개인 구글 계정으로 키를 만들어 주세요.' : '계정 권한이나 지역 제한일 수 있어요. 다른 계정의 키를 쓰거나 다른 AI를 연결해 주세요.', ['key', 'connect']],
    'no-browser': ['이 계정은 브라우저에서 바로 쓸 수 없어요.', '조직 설정이 막아 두었어요. 개인 계정으로 만든 키를 쓰거나 다른 AI를 연결해 주세요.', ['connect', 'paste']],
    workspace: ['Workspace를 고르지 않고 만든 키예요.', 'Claude 키 페이지에서 키를 새로 만들 때 Workspace를 골라 주세요.', ['key']],
    region: ['이 지역이나 계정에서는 쓸 수 없어요.', '만 18세 이상 개인 계정인지 확인해 주세요. 안 되면 다른 AI를 연결해 주세요.', ['connect', 'paste']],
    billing: provider === 'gemini' ? ['결제가 연결된 프로젝트의 키예요.', '구글 AI Studio에서 크레딧을 충전해야 쓸 수 있어요. 결제를 연결하지 않은 프로젝트에서 키를 새로 만들면 무료로 쓸 수 있어요.', ['billing', 'key', 'connect', 'paste']]
      : provider === 'openrouter' ? ['크레딧이 없어요.', '무료 모델은 크레딧 없이 쓸 수 있어요. 다시 해도 안 되면 다른 AI를 연결해 주세요.', ['connect']]
        : ['API 크레딧이 없어요.', `${provider === 'openai' ? 'ChatGPT' : 'Claude'} 구독과 API 결제는 따로예요. 지금은 쓰던 ${provider === 'openai' ? 'ChatGPT' : 'Claude'} 창으로 만들 수 있어요. 키로 하려면 결제 페이지에서 크레딧을 충전해 주세요. 5달러면 사이트를 열 개 넘게 만들어요.`, ['paste', 'billing']],
    'quota-day': ['오늘 쓸 수 있는 무료 횟수를 다 썼어요.', `다른 모델로도 해 봤어요. ${provider === 'gemini' ? `한국 시간 ${geminiResetKo()}쯤 다시 채워져요.` : provider === 'openrouter' ? '한국 시간 오전 9시쯤 다시 채워져요.' : '내일 다시 돼요.'} 지금 이어서 하려면 다른 AI를 연결해 주세요.`, ['connect', 'paste']],
    quota: [paid ? '요청이 몰려 잠시 막혔어요.' : '무료 한도를 넘었어요.', '기다렸다가 다시 해 봤지만 안 됐어요. 몇 분 뒤에 다시 누르거나 다른 AI를 연결해 주세요.', ['connect', 'paste']],
    cap: ['이번 달에 쓸 수 있는 금액을 다 썼어요.', `다음 달에 다시 돼요. ${P.short || ''} 사이트에서 한도를 올릴 수도 있어요. 지금 이어서 하려면 다른 AI를 연결해 주세요.`, ['connect', 'paste']],
    model: ['고른 모델을 쓸 수 없어요.', '모델을 바꾸거나, 연결을 끊고 다시 연결해 주세요.', ['paste']],
    'no-access': ['이 모델은 지금 키로 쓸 수 없어요.', '무료 키로 쓸 수 있는 모델로 바꿔 주세요.', []],
    refusal: ['AI가 이 내용은 만들지 않겠다고 했어요.', '교재에 민감한 주제(보안·생물 실험 등)가 있으면 그럴 수 있어요. 다른 AI로 다시 해 보세요.', ['connect', 'paste']],
    'too-long': ['교재가 길어 한 번에 보내지 못했어요.', '교재를 나눠 넣거나, 쓰던 AI 창에 교재를 첨부해 만들어 주세요.', ['paste', 'connect']],
    busy: ['AI 서버가 바빠요.', '잠시 뒤에 다시 눌러 주세요.', ['paste']],
    network: ['AI 회사에 닿지 못했어요.', '인터넷 연결을 확인해 주세요. 학교망이 AI 사이트를 막았다면 휴대폰 핫스팟으로 바꿔 주세요.', ['paste']],
    // 만들기 전에 확인했더니 이 망에서 AI 회사 API에 닿지 않음(netcheck.js): 기다리지 않고 AI 창 길로
    blocked: [`이 망에서 ${P.short || 'AI'} API에 닿지 않아요.`, '학교·기관 망이 AI 회사 주소를 막은 것 같아요. 쓰던 AI 창으로 만들면 돼요. 휴대폰 핫스팟으로 바꾸면 키로도 돼요.', ['paste']],
    truncated: ['답이 중간에 끊겼어요.', '이어서 받아 봤지만 끝나지 않았어요. 다시 해 보거나 다른 AI를 골라 주세요.', ['connect', 'paste']],
    empty: ['AI가 빈 답을 보냈어요.', '다시 눌러 주세요.', []],
    other: ['AI가 답하지 못했어요.', err?.message || '', ['paste']],
  }[k] || ['AI가 답하지 못했어요.', err?.message || '', ['paste']];
  // 휴대폰 확인: 구글이 오류 문구에 넣어 준 확인 주소만 씀(다른 주소는 열지 않음)
  const link = k === 'verify' ? { href: (/https:\/\/aistudio\.google\.com\/verify\?project=\d+/.exec(err?.message || '') || ['https://aistudio.google.com/projects'])[0], label: '확인 페이지 열기' } : null;
  if (err?.paidOption || err?.lightOption) {
    const ways = [err.paidOption && `연결해 둔 ${err.paidOption.label}(유료)`, err.lightOption && `가벼운 모델(${err.lightOption.label})`].filter(Boolean).join('이나 ');
    return { kind: k, provider, link, title: k === 'verify' || k === 'cap' ? T[0] : '오늘 이 모델의 무료 한도를 다 썼어요.', body: `${ways}로 이어서 할 수 있어요.${err.lightOption ? ' 가벼운 모델은 구성과 문구가 단순해질 수 있어요.' : ''}`, actions: [err.paidOption && 'pay', err.lightOption && 'light', 'connect'].filter(Boolean), raw: err?.message || '' };
  }
  return { kind: k, provider, link, title: T[0], body: T[1], actions: T[2], raw: err?.message || '' };
}
/** Gemini 무료 횟수(하루 요청 수)는 미국 태평양 시간 자정에 다시 채워짐(공식 문서 Rate limits) → 한국 시간으로 여름 '오후 4시', 겨울 '오후 5시'. OpenRouter 무료 모델은 UTC 자정(한국 오전 9시) */
export function geminiResetKo(now = new Date()) {
  let h = 5;
  try { if (/PDT|GMT-7/.test(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', timeZoneName: 'short' }).format(now))) h = 4; } catch { /* 시간대를 모르면 겨울 기준 */ }
  return `오후 ${h}시`;
}

// ── Claude: Workspace를 고르지 않고 만든 키 ──
// 그런 키는 요청마다 anthropic-workspace-id 머리말이 있어야 합니다(공식 문서 Authentication > Select a workspace, 2026-11).
// 강사가 그 값을 찾아 넣을 일은 없게, 그 오류가 오면 조직의 Workspace 목록에서 Default를 찾아 한 번만 다시 보냅니다(이 탭에서만 기억).
const wsOf = new Map(); // 키 → workspace id
export const antHeaders = (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', ...(wsOf.get(key) ? { 'anthropic-workspace-id': wsOf.get(key) } : {}) });
export async function withWorkspace(key, signal, fn) {
  try { return await fn(); }
  catch (e) {
    if (!(e instanceof AiError) || e.kind !== 'workspace' || wsOf.has(key)) throw e;
    let w = null;
    try {
      const j = await send('anthropic', 'https://api.anthropic.com/v1/organizations/workspaces?include_default=true&limit=100', { signal, headers: antHeaders(key) });
      const list = (j.data || []).filter((x) => x && x.id && !x.archived_at);
      w = list.find((x) => x.name === 'Default') || list[0];
    } catch { /* 목록을 못 읽으면 처음 오류 그대로 */ }
    if (!w) throw e;
    wsOf.set(key, w.id);
    return fn();
  }
}

// ── 모델 목록·고르기(모델 이름을 코드에 박지 않고, 그때그때 목록에서 고름) ──
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
async function listRaw(provider, key, signal) {
  if (provider === 'gemini') {
    const j = await send(provider, `${GEMINI}/models?pageSize=200`, { signal, headers: { 'x-goog-api-key': key } });
    return (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => ({ id: m.name.replace(/^models\//, ''), label: m.displayName || m.name }));
  }
  if (provider === 'anthropic') {
    const j = await withWorkspace(key, signal, () => send(provider, 'https://api.anthropic.com/v1/models?limit=100', { signal, headers: antHeaders(key) }));
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
// 모델 이름은 몇 달마다 바뀝니다(2026-11: OpenAI GPT-6 Astra·GPT-6.1 Sol·Terra·GPT-6 Luna, Claude Fable 5.2·Opus 5.5·Sonnet 5.5·Haiku 5.5,
// Gemini 4 Carbon·Argon·Hydrogen — Gemini 4부터는 Pro·Flash라는 이름이 없음). 이름으로 고르면 금방 틀리므로 값과 출시일로 등급을 매깁니다.
// 값표(카탈로그)와 규칙은 ai-catalog.js 한 곳: 같은 출처의 ai-catalog.json(하루 한 번 자동으로 모음, scripts/ai-catalog) → OpenRouter 공개 목록이 오면 덮어씀
// → 둘 다 없으면 이름으로 어림. 키와 교재는 보내지 않음.
//   추천 = 고품질 등급에서 가장 새 모델(나온 지 2주가 안 된 것은 뒤로). 교재를 읽고 연수 흐름을 짜는 일은 가벼운 모델에서 결과가 눈에 띄게 단순해짐
//   공식 문서와 맞춰 봄(2026-11-14): OpenAI "지능과 비용의 균형은 GPT-6.1 Sol"(Astra는 5배 값의 최상위), Anthropic "잘 모르겠으면 Claude Opus 5.5",
//   Google: Gemini 4 Carbon·Argon은 무료 등급에서 안 되고 4 Hydrogen(2026-11-12 출시)·3.8 Flash 등은 됨. 어느 모델이 무료 등급에서 되는지는
//   공식 가격표에서 매일 모은 목록(ai-catalog.json의 geminiFree)을 씀 → 무료 키로 알게 되면 안 되는 모델을 써 보기 전부터 '유료 키 필요'로.
//   한 번 실패한 모델을 기억하는 것(markBlocked)은 두 번째 안전망
export { TIER_KO };
const catalog = catalogLoader();
async function rank(provider, list, freeTier) {
  return rankModels(provider, list, { cat: await catalog(), freeTier, blocked: (await prefs()).blocked[provider] || [] });
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

// ── 만들 수 있는지 확인(아주 작은 생성 한 번) ──
// 모델 목록은 결제·한도와 상관없이 열려서, 선불 크레딧이 0인 키(실제 Gemini 시험 2026-11-20: 모든 생성이 402)도 '연결했어요'가 뜨고
// 첫 생성에서야 막혔음. 그래서 고른 모델로 글자 몇 개만 받는 요청을 보내 결제·권한·한도·지역 오류를 연결할 때 알려 줌.
// 입력은 한 글자, 출력은 16토큰까지(생각 토큰 포함 한도)라 비용은 1원도 안 됨. OpenAI·Gemini는 저장하지 않게(store:false).
// '연결했어요'는 어느 모델이든 실제로 답(200)을 받았을 때만. 실제 무료 키 시험(2026-11-20): 추천 첫 모델(유료 전용)은 429 limit 0,
// 몇 모델은 몇 분 동안 503(사용량 폭주), 다른 모델은 200 → 모델 탓인 오류·붐빔은 다음 모델로 넘어가 되는 모델을 고름
const PROBE_MS = 20000;
/** Gemini 무료 키가 유료 전용 모델을 부를 때 오는 오류들(job.js SWAP과 같음) → 이 키로 못 쓰는 모델로 기억하고 무료 모델로 */
const PROBE_SWAP = ['no-access', 'model', 'quota-day', 'billing', 'forbidden', 'region'];
const PROBE_ACCOUNT = ['billing', 'forbidden', 'region'];
/** 그 모델만 지금 붐빔·잠깐 한도(키는 맞음): 그 모델은 건너뛰고 다음 모델로(기억하지 않음) */
const PROBE_BUSY = ['busy', 'quota', 'stall'];
const PROBE_TRIES = 4;
function probeRequest(provider, key, model) {
  const json = { 'content-type': 'application/json' };
  if (provider === 'anthropic') return { url: 'https://api.anthropic.com/v1/messages', init: { headers: { ...json, ...antHeaders(key) }, body: { model, max_tokens: 8, messages: [{ role: 'user', content: '1' }] } } };
  if (provider === 'openai') return { url: 'https://api.openai.com/v1/responses', init: { headers: { ...json, authorization: `Bearer ${key}` }, body: { model, input: '1', max_output_tokens: 16, store: false } } };
  if (provider === 'gemini') return { url: `${GEMINI}/models/${encodeURIComponent(model)}:generateContent`, init: { headers: { ...json, 'x-goog-api-key': key }, body: { contents: [{ role: 'user', parts: [{ text: '1' }] }], generationConfig: { maxOutputTokens: 16 }, store: false } } };
  if (provider === 'openrouter') return { url: 'https://openrouter.ai/api/v1/chat/completions', init: { headers: { ...json, authorization: `Bearer ${key}` }, body: { model, messages: [{ role: 'user', content: '1' }], max_tokens: 8 } } };
  return null;
}
/** 고른 모델로 아주 작은 생성 한 번. 답(200)을 받으면 끝, 아니면 AiError(20초가 넘으면 'stall') */
export async function probeModel(provider, key, model, { signal } = {}) {
  const q = probeRequest(provider, key, model);
  if (!q) return;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), PROBE_MS);
  const onAbort = () => ctl.abort();
  signal?.addEventListener?.('abort', onAbort, { once: true });
  try {
    const go = () => send(provider, q.url, { method: 'POST', ...q.init, body: JSON.stringify(q.init.body), signal: ctl.signal });
    await (provider === 'anthropic' ? withWorkspace(key, ctl.signal, go) : go());
  } catch (e) {
    if (signal?.aborted || e instanceof AiError) throw e;
    if (e?.name === 'AbortError' || e?.name === 'TimeoutError') throw new AiError('stall', 'probe timeout', { provider });
    throw e;
  } finally { clearTimeout(t); signal?.removeEventListener?.('abort', onAbort); }
}

/**
 * [연결 확인]: 키가 맞는지 물어보고(모델 목록), 쓸 모델을 고른 뒤 그 모델로 아주 작은 생성을 해 봄(probeModel). 답(200)을 받은 모델이 있어야 연결.
 *  - Gemini 무료 키가 유료 전용 모델에서 막히면(429 limit 0·403·402·400) 그 모델은 '유료 키 필요'로 기억하고 무료 모델로 다시. 되면 무료 키로 적어 둠.
 *    바꾼 모델도 같은 결제·권한 오류면(선불 크레딧 0이면 모든 모델이 402) 그 오류를 알림
 *  - 붐빔(503)·잠깐 한도·시간 넘김은 키 문제가 아님: 그 모델만 건너뛰고 다음 모델로(기억하지 않음). 모두 붐비면 '키는 맞는데 붐빔'으로 알림
 *  - 키·결제·권한 같은 계정 오류(다른 회사), 망 끊김은 그대로 알림
 * @returns {Promise<{models, model, freeTier, switched?: string, why?: 'free'|'busy', busy?: string[]}>} switched: 처음 고른 모델 대신 쓰게 된 모델(why: 무료 키라서·붐벼서), busy: 붐벼서 건너뛴 모델
 */
export async function checkKey(provider, key, { signal } = {}) {
  if (!key) throw new AiError('bad-key', 'empty', { provider });
  let freeTier = false;
  if (provider === 'openrouter') ({ freeTier } = await openRouterKeyInfo(key, signal));
  const s = await prefs();
  if (provider === 'gemini') freeTier = !!s.free.gemini; // 무료 키인지는 처음 만들 때(또는 아래 확인에서) 알게 됨(이 기기에 적어 둔 값)
  const raw = await listRaw(provider, key, signal);
  let list = await rank(provider, raw, freeTier);
  // 강사가 직접 고른 모델이 아직 있으면 그대로, 아니면 추천 모델
  const kept = s.picked[provider] && list.find((m) => m.id === s.models[provider] && !m.locked);
  // 목록에서 고를 모델이 없을 때만 Gemini 공식 별칭(-latest: 그 계열의 최신판을 가리킴)으로
  let model = (kept || list.find((m) => !m.locked) || {}).id || (provider === 'gemini' ? 'gemini-flash-latest' : '');
  if (!model) throw new AiError('model', 'no model', { provider });
  const first = model; const perm = []; const busy = []; let permErr = null; let busyErr = null;
  for (;;) {
    let e = null;
    try { await probeModel(provider, key, model, { signal }); break; } catch (x) { e = x; }
    if (!(e instanceof AiError)) throw e;
    if (provider === 'gemini' && PROBE_SWAP.includes(e.kind)) {
      // 바꾼 모델도 같은 계정 오류(결제·권한·지역)면 모델 탓이 아님: 처음 오류를 알림
      if (permErr && PROBE_ACCOUNT.includes(e.kind) && e.kind === permErr.kind) throw permErr;
      perm.push(model); permErr = permErr || e;
    } else if (PROBE_BUSY.includes(e.kind)) { busy.push(model); busyErr = busyErr || e; }
    else throw e;
    // 다음 모델: 이 키로 못 쓰는 모델이 나왔으면 무료 키로 보고 무료 모델 가운데서(추천 순)
    const pool = perm.length ? await rank(provider, raw, true) : list;
    const next = perm.length + busy.length < PROBE_TRIES && pool.find((m) => !m.locked && !perm.includes(m.id) && !busy.includes(m.id) && m.id !== model);
    if (!next) {
      if (permErr && !busy.length) throw permErr;
      // 남은 모델이 모두 붐빔: 키는 맞음. 연결했다고 하지 않고 잠시 뒤 다시(무료 키에서 막힌 모델은 그래도 기억)
      for (const id of perm) await markBlocked(provider, id);
      throw Object.assign(new AiError('busy', busyErr?.message || 'busy', { provider, status: busyErr?.status || 503 }), { keyOk: true });
    }
    model = next.id;
  }
  if (perm.length) {
    // 무료 키: 안 된 모델은 '유료 키 필요'로, 되는 모델을 쓸 모델로(강사가 직접 고른 모델이어도 그 모델은 이 키로 안 됨)
    freeTier = true;
    for (const id of perm) await markBlocked(provider, id);
    list = await rank(provider, raw, true);
  }
  // 붐벼서 건너뛴 모델은 기억하지 않음(이 키로 되는 모델). 이번에는 답한 모델로 시작(생성 쪽도 붐빈 모델을 잠시 피함, gen/job.js busyDetour)
  await setActive(provider, { model, freeTier, ...(perm.length ? { picked: false } : {}) });
  return { models: list, model, freeTier, ...(model !== first ? { switched: model, why: perm.length ? 'free' : 'busy' } : {}), ...(busy.length ? { busy } : {}) };
}

// ── Gemini 요청 본문 ──
/**
 * Gemini 요청 본문(생성 파이프라인 lib/gen도 씀). 공식 문서(2026-11) 기준:
 *  - temperature·topP는 Gemini 3.6 이후·4에서 무시되고 경고가 오며, 앞으로 400이 됨 → 보내지 않음
 *  - maxOutputTokens는 생각하는 토큰까지 합친 한도. Gemini 4는 32,768 이상을 권함(Carbon·Argon은 스트리밍 아닌 요청 한 번에 32,768까지)
 *  - 2026-10-26 뒤에 만든 유료 프로젝트는 요청을 기록(store)하는 것이 기본 → 교재가 키 주인의 기록에 남지 않게 store: false
 */
export function geminiBody(parts, maxTokens) {
  return { contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: Math.max(maxTokens, 32768) }, store: false };
}

/** 쓴 만큼 돈이 나가는 연결인지: OpenAI·Claude 키, 충전한 OpenRouter */
export const isPaidAI = (provider, freeTier) => provider === 'openai' || provider === 'anthropic' || (provider === 'openrouter' && !freeTier);

/**
 * AI 고르기 화면(components/AiPick.jsx): 보이는 회사마다 키가 연결돼 있는지와 고른 모델(비밀 아님 — 키 값은 돌려주지 않음)
 * @returns {Promise<Record<string, null|{ model: string, freeTier: boolean }>>}
 */
export async function aiStatus() {
  const s = await prefs(); const out = {};
  for (const provider of VISIBLE) { const { key } = await loadKey(provider); out[provider] = key ? { model: s.models[provider] || '', freeTier: !!s.free[provider] } : null; }
  return out;
}
