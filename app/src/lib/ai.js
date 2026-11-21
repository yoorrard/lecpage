// AI 연결: 키는 기본적으로 이 탭의 메모리에만(새로 고침하면 사라짐), 원하면 이 기기에 암호화해 저장(WebCrypto, 꺼낼 수 없는 키).
// 키와 교재는 운영자 서버로 가지 않고, 브라우저에서 AI 회사로 바로 갑니다.
// 공개 API(다른 화면도 씀): PROVIDERS, loadKey, saveKey, forgetKey, models, generate, getActiveAI, detectProvider, checkKey
import { kv } from './db.js';
import { TIER_KO, catalogLoader, rankModels } from './ai-catalog.js';

// 사이트 만들기에 쓰는 AI: OpenAI(GPT) · Claude. 값·주소·오류 모양은 각 회사 공식 문서와 맞춰 봄(2026-11-14, 근거는 docs/research/ai-facts-2026-11-14.md).
// Gemini·OpenRouter 키로는 만들지 않음(만드는 길이 없음): 붙여 넣으면 연결 화면이 알려 줌(detectProvider), 다른 회사로 보내지 않음
export const PROVIDERS = {
  openai: { name: 'OpenAI', short: 'OpenAI', free: false, keyUrl: 'https://platform.openai.com/api-keys', billingUrl: 'https://platform.openai.com/settings/organization/billing/overview', note: '쓴 만큼 충전한 크레딧에서 나가요.', images: true },
  anthropic: { name: 'Anthropic Claude', short: 'Claude', free: false, keyUrl: 'https://platform.claude.com/settings/keys', billingUrl: 'https://platform.claude.com/settings/billing', note: '쓴 만큼 충전한 크레딧에서 나가요.', images: true },
};
/** 고르는 화면에 보이는 회사(이 순서대로) */
export const VISIBLE = ['openai', 'anthropic'].filter((id) => PROVIDERS[id] && !PROVIDERS[id].hidden);

/** 붙여 넣은 키의 앞부분으로 어느 회사 키인지 알아냄 */
export function detectProvider(key) {
  const k = String(key || '').trim();
  if (/^sk-or-/.test(k)) return 'openrouter-unsupported'; // OpenRouter 키: OpenAI로 보내지 않음
  if (/^sk-ant-/.test(k)) return 'anthropic';
  if (/^(AIza|AQ\.)/.test(k)) return 'gemini-unsupported'; // Gemini 키: 사이트 만들기에는 쓰지 않음(연결 화면이 알려 줌)
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
/** [모든 데이터 삭제] 뒤: 탭 메모리의 키와 암호화 열쇠도 버림(저장소를 비운 뒤 예전 열쇠로 다시 잠그지 않게) */
export function forgetAllKeys() { mem.clear(); cryptoKeyP = null; }

export async function forgetKey(provider) {
  mem.delete(provider); await kv.del('ai:' + provider);
  if (PROVIDERS[provider]) { const s = await prefs(); delete s.models[provider]; delete s.picked[provider]; delete s.free[provider]; delete s.blocked[provider]; if (s.active === provider) s.active = ''; await kv.set('ai-prefs', s); }
}

// 고른 회사·모델(비밀 아님)
async function prefs() { const s = (await kv.get('ai-prefs').catch(() => null)) || {}; return { active: s.active || '', models: s.models || {}, free: s.free || {}, picked: s.picked || {}, blocked: s.blocked || {} }; }
/** 이 키로는 못 쓰는 모델로 확인된 것. 고르는 칸에서 '유료 키 필요'로 보임 */
async function markBlocked(provider, id) {
  const s = await prefs(); const list = s.blocked[provider] || [];
  if (!list.includes(id)) { s.blocked[provider] = [...list, id].slice(-20); await kv.set('ai-prefs', s); }
}
/**
 * 생성(gen/job.js)에서 처음 모델이 이 키로 안 돼 바꾼 모델로 답을 받았을 때: 안 된 모델은 '쓸 수 없음'으로 기억하고
 * 다음 만들기는 되는 모델로 바로 시작. 강사가 직접 고른 모델·지금 고른 회사는 그대로
 */
export async function rememberWorkingModel(provider, model, failed = []) {
  for (const id of failed) await markBlocked(provider, id);
  const s = await prefs();
  if (!s.picked[provider] && model) s.models[provider] = model;
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
    return { provider, key, model, label: PROVIDERS[provider].name, freeTier, supportsImages: PROVIDERS[provider].images };
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
  if (/CORS requests are not allowed/i.test(m)) return 'no-browser'; // Claude: 브라우저에서 바로 부르지 못하게 막아 둔 조직(401)
  if (/anthropic-workspace-id|workspace ID|specify (a|the) workspace/i.test(m)) return 'workspace'; // Claude: Workspace를 고르지 않고 만든 키
  // 이번 달 쓸 수 있는 금액을 다 씀. Claude: 등급 한도 429(enforced_spend_limit_reached)·직접 정한 한도 400("You have reached your specified API usage limits")
  // OpenAI: 직접 정한 한도·OpenAI가 정한 한도 429(organization_/project_spend_limit_exceeded, organization_usage_limit_exceeded)
  if (/API usage limits|monthly API usage|enforced_spend_limit_reached|spend_limit_exceeded|usage_limit_exceeded/i.test(m)) return 'cap';
  if (status === 401 || /invalid.?x-api-key|Incorrect API key|invalid_api_key|authentication_error/i.test(m)) return 'bad-key';
  if (/unsupported_country|not available in your (country|region)/i.test(m)) return 'region';
  if (status === 402 || /insufficient_quota|credit_balance_exhausted|credit balance is too low|billing|payment/i.test(m)) return 'billing'; // OpenAI 크레딧 없음은 429 credit_balance_exhausted(2026-11)
  if (status === 429 && /per.?day|daily|\bquota_exceeded\b/i.test(m)) return 'quota-day';
  if (status === 429 || /rate.?limit/i.test(m)) return 'quota';
  if (status === 403) return 'forbidden';
  if (status === 404 || /model.*(not found|does not exist)/i.test(m)) return 'model';
  if (status === 413 || /context length|too long|maximum context|token count/i.test(m)) return 'too-long';
  if (status >= 500 || status === 529 || /overloaded/i.test(m)) return 'busy';
  return 'other';
}
/**
 * 학교·기관 망의 차단 화면: AI 회사 주소인데 JSON이 아니라 웹 페이지(HTML)가 옴(200이어도). 원문(영어 개발자 문구) 대신
 * 'blocked'(이 망에서 닿지 않음)로. 같은 규칙을 생성 파이프라인(lib/gen)도 씀
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
  const j = await r.json().catch(() => ({}));
  const e = j.error || j;
  const msg = (typeof e === 'string' ? e : e.message) || `${PROVIDERS[provider]?.short || provider} 오류 ${r.status}`;
  // 오류 코드는 회사마다 자리가 다름: OpenAI code·type(크레딧 없음은 code credit_balance_exhausted, type insufficient_quota), Claude type·details.error_code
  const code = [e.code, e.type, e.details?.error_code].filter((x) => typeof x === 'string').join(' ');
  // 얼마 뒤에 다시 하라는지: retry-after 헤더나 문구("retry in 34.2s")
  const retryAfter = Math.ceil(+r.headers.get('retry-after') || +(/retry in ([\d.]+)\s*s/i.exec(msg) || [])[1] || 0);
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
 * · link(돌려준 link.href 열기). 맨 앞 동작을 주 버튼으로 보여 줌
 */
export function explainError(err, provider) {
  const P = PROVIDERS[provider] || {};
  const k = err?.kind || (err?.name === 'TimeoutError' ? 'busy' : 'other');
  const paid = provider === 'openai' || provider === 'anthropic';
  const T = {
    'bad-key': ['키가 맞지 않아요.', `키를 끝까지 복사했는지 확인해 주세요. 지웠거나 오래된 키라면 ${P.short || ''} 키 페이지에서 새로 만들어 주세요.`, ['key', 'connect']],
    forbidden: ['이 계정으로는 쓸 수 없어요.', '계정 권한이나 지역 제한일 수 있어요. 다른 계정의 키를 쓰거나 다른 AI를 연결해 주세요.', ['key', 'connect']],
    'no-browser': ['이 계정은 브라우저에서 바로 쓸 수 없어요.', '조직 설정이 막아 두었어요. 개인 계정으로 만든 키를 쓰거나 다른 AI를 연결해 주세요.', ['connect']],
    workspace: ['Workspace를 고르지 않고 만든 키예요.', 'Claude 키 페이지에서 키를 새로 만들 때 Workspace를 골라 주세요.', ['key']],
    region: ['이 지역이나 계정에서는 쓸 수 없어요.', '만 18세 이상 개인 계정인지 확인해 주세요. 안 되면 다른 AI를 연결해 주세요.', ['connect']],
    billing: ['API 크레딧이 없어요.', `${provider === 'openai' ? 'ChatGPT' : 'Claude'} 구독과 API 결제는 따로예요. 구독으로 만들려면 ChatGPT·Claude 계정으로 연결해 주세요. 키로 하려면 결제 페이지에서 크레딧을 충전해 주세요. 5달러면 사이트를 열 개 넘게 만들어요.`, ['connect', 'billing']],
    'quota-day': ['오늘 쓸 수 있는 횟수를 다 썼어요.', '다른 모델로도 해 봤어요. 내일 다시 돼요. 지금 이어서 하려면 다른 AI를 연결해 주세요.', ['connect']],
    quota: [paid ? '요청이 몰려 잠시 막혔어요.' : '무료 한도를 넘었어요.', '기다렸다가 다시 해 봤지만 안 됐어요. 몇 분 뒤에 다시 누르거나 다른 AI를 연결해 주세요.', ['connect']],
    cap: ['이번 달에 쓸 수 있는 금액을 다 썼어요.', `다음 달에 다시 돼요. ${P.short || ''} 사이트에서 한도를 올릴 수도 있어요. 지금 이어서 하려면 다른 AI를 연결해 주세요.`, ['connect']],
    model: ['고른 모델을 쓸 수 없어요.', '모델을 바꾸거나, 연결을 끊고 다시 연결해 주세요.', ['connect']],
    'no-access': ['이 모델은 지금 키로 쓸 수 없어요.', '다른 모델로 바꿔 주세요.', []],
    refusal: ['AI가 이 내용은 만들지 않겠다고 했어요.', '교재에 민감한 주제(보안·생물 실험 등)가 있으면 그럴 수 있어요. 다른 AI로 다시 해 보세요.', ['connect']],
    'too-long': ['교재가 길어 한 번에 보내지 못했어요.', '교재를 나눠 넣거나 다른 AI로 만들어 주세요.', ['connect']],
    busy: ['AI 서버가 바빠요.', '잠시 뒤에 다시 누르거나 다른 AI를 골라 주세요.', ['connect']],
    network: ['AI 회사에 닿지 못했어요.', '인터넷 연결을 확인해 주세요. 기관·회사 망이 AI 사이트를 막았다면 휴대폰 핫스팟으로 바꿔 주세요.', []],
    // 만들기 전에 확인했더니 이 망에서 AI 회사 API에 닿지 않음(netcheck.js): 기다리지 않고 알려 줌
    blocked: [`이 망에서 ${P.short || 'AI'} API에 닿지 않아요.`, '기관·회사 망이 AI 회사 주소를 막은 것 같아요. 휴대폰 핫스팟으로 바꾸거나 ChatGPT·Claude 계정으로 연결해 주세요.', ['connect']],
    truncated: ['답이 중간에 끊겼어요.', '이어서 받아 봤지만 끝나지 않았어요. 다시 해 보거나 다른 AI를 골라 주세요.', ['connect']],
    empty: ['AI가 빈 답을 보냈어요.', '다시 눌러 주세요.', []],
    other: ['AI가 답하지 못했어요.', err?.message || '', ['connect']],
  }[k] || ['AI가 답하지 못했어요.', err?.message || '', ['connect']];
  const link = null;
  if (err?.paidOption || err?.lightOption) {
    const ways = [err.paidOption && `연결해 둔 ${err.paidOption.label}(유료)`, err.lightOption && `가벼운 모델(${err.lightOption.label})`].filter(Boolean).join('이나 ');
    return { kind: k, provider, link, title: k === 'cap' ? T[0] : '오늘 이 모델의 한도를 다 썼어요.', body: `${ways}로 이어서 할 수 있어요.${err.lightOption ? ' 가벼운 모델은 구성과 문구가 단순해질 수 있어요.' : ''}`, actions: [err.paidOption && 'pay', err.lightOption && 'light', 'connect'].filter(Boolean), raw: err?.message || '' };
  }
  return { kind: k, provider, link, title: T[0], body: T[1], actions: T[2], raw: err?.message || '' };
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
async function listRaw(provider, key, signal) {
  if (provider === 'anthropic') {
    const j = await withWorkspace(key, signal, () => send(provider, 'https://api.anthropic.com/v1/models?limit=100', { signal, headers: antHeaders(key) }));
    return (j.data || []).map((m) => ({ id: m.id, label: m.display_name || m.id }));
  }
  if (provider === 'openai') {
    const j = await send(provider, 'https://api.openai.com/v1/models', { signal, headers: { authorization: `Bearer ${key}` } });
    return (j.data || []).map((m) => ({ id: m.id, label: m.id }));
  }
  throw new AiError('model', `이 길로는 만들 수 없어요(${provider}).`, { provider });
}
// ── 모델 등급과 추천 ──
// 모델 이름은 몇 달마다 바뀝니다(2026-11: OpenAI GPT-6 Astra·GPT-6.1 Sol·Terra·GPT-6 Luna, Claude Fable 5.2·Opus 5.5·Sonnet 5.5·Haiku 5.5).
// 이름으로 고르면 금방 틀리므로 값과 출시일로 등급을 매깁니다.
// 값표(카탈로그)와 규칙은 ai-catalog.js 한 곳: 같은 출처의 ai-catalog.json(하루 한 번 자동으로 모음, scripts/ai-catalog) → OpenRouter 공개 목록이 오면 덮어씀
// → 둘 다 없으면 이름으로 어림. 키와 교재는 보내지 않음.
//   추천 = 고품질 등급에서 가장 새 모델(나온 지 2주가 안 된 것은 뒤로). 교재를 읽고 연수 흐름을 짜는 일은 가벼운 모델에서 결과가 눈에 띄게 단순해짐
//   공식 문서와 맞춰 봄(2026-11-14): OpenAI "지능과 비용의 균형은 GPT-6.1 Sol"(Astra는 5배 값의 최상위), Anthropic "잘 모르겠으면 Claude Opus 5.5".
//   한 번 실패한 모델은 기억해(markBlocked) 다음부터 '유료 키 필요'로
export { TIER_KO };
const catalog = catalogLoader();
async function rank(provider, list) {
  return rankModels(provider, list, { cat: await catalog(), blocked: (await prefs()).blocked[provider] || [] });
}
/** 고르는 칸에 보일 이름: '모델 · 추천 · 약 220원' */
export function modelText(m) {
  return `${m.label}${m.rec ? ' · 추천' : ` · ${TIER_KO[m.tier]}`}${m.won ? ` · 약 ${m.won.toLocaleString('ko-KR')}원` : ''}${m.locked ? ' · 유료 키 필요' : ''}`;
}

/** 고르는 칸의 모델 목록(두 번째 인자 뒤의 옵션은 예전 호출과 맞추려고 받기만 함) */
export async function models(provider, key) {
  return rank(provider, await listRaw(provider, key));
}

/**
 * [연결 확인]: 키가 맞는지 실제로 물어보고, 쓸 모델을 고름. 돈이 드는 생성은 하지 않음.
 * @returns {Promise<{models, model, freeTier}>}
 */
export async function checkKey(provider, key, { signal } = {}) {
  if (!key) throw new AiError('bad-key', 'empty', { provider });
  const freeTier = false; // 무료 등급이 있는 연결은 없음(화면은 이 값을 그대로 받음)
  const s = await prefs();
  const list = await rank(provider, await listRaw(provider, key, signal));
  // 강사가 직접 고른 모델이 아직 있으면 그대로, 아니면 추천 모델
  const kept = s.picked[provider] && list.find((m) => m.id === s.models[provider] && !m.locked);
  const model = (kept || list.find((m) => !m.locked) || {}).id || '';
  if (!model) throw new AiError('model', 'no model', { provider });
  await setActive(provider, { model, freeTier });
  return { models: list, model, freeTier };
}

/** 쓴 만큼 돈이 나가는 연결인지: OpenAI·Claude 키 */
export const isPaidAI = (provider) => provider === 'openai' || provider === 'anthropic';

/**
 * AI 고르기 화면(components/AiPick.jsx): 보이는 회사마다 키가 연결돼 있는지와 고른 모델(비밀 아님 — 키 값은 돌려주지 않음)
 * @returns {Promise<Record<string, null|{ model: string, freeTier: boolean }>>}
 */
export async function aiStatus() {
  const s = await prefs(); const out = {};
  for (const provider of VISIBLE) { const { key } = await loadKey(provider); out[provider] = key ? { model: s.models[provider] || '', freeTier: !!s.free[provider] } : null; }
  return out;
}
