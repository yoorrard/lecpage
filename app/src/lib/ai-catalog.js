// AI 모델 값표(카탈로그)와 등급·추천 규칙. 의존성 없는 순수 모듈이라 브라우저(ai.js)와
// 매일 갱신 스크립트(scripts/ai-catalog/refresh.mjs)·시험(scripts/ai-catalog/test)이 같은 규칙을 씁니다.
//
// 카탈로그를 읽는 순서(catalogLoader):
//   1) 같은 출처의 ai-catalog.json — 하루 한 번 GitHub Actions가 모아 앱과 함께 올림. 학교망에서도 닿고 작음(수십 KB)
//   2) OpenRouter 공개 목록(키 없음) — 오면 1)을 덮어씀(실시간이 더 새로움). 늦게 오면 다음 호출부터 씀
//   3) 둘 다 없으면 빈 카탈로그 → 이름 규칙(tierByName·verOf)으로 어림(마지막 안전망)

export const OR_MODELS = 'https://openrouter.ai/api/v1/models';
export const CATALOG_FILE = './ai-catalog.json';

// 글을 쓰는 대화 모델이 아닌 것(음성·그림·영상·음악·임베딩·에이전트·결정 API 전용)과 승인받은 곳만 쓰는 모델(cyber·rosalind)
export const SKIP = /tts|audio|image|vision|embed|live|realtime|transcribe|translate|search|instruct|codex|computer|robotics|nano|banana|omni|learnlm|gemma|guard|aqa|-exp|preview-\d\d-\d\d|deep-research|moderation|dall|whisper|sora|veo|lyria|decision|antigravity|cyber|rosalind/i;
export const TIER_KO = ['가벼움', '표준', '고품질', '최상위'];
export const OR_PREFIX = { openai: 'openai/', gemini: 'google/', anthropic: 'anthropic/', openrouter: '' };
// Anthropic 공식 문서 "잘 모르겠으면 Claude Opus"(2026-11-14). 판 번호가 아니라 계열 이름이라 새 판이 나와도 맞음
const PREFER = { anthropic: /opus/, openrouter: /^anthropic\/claude-opus/ };
export const FRESH_MS = 14 * 86400000;

/** 비교용 이름: 'models/'·날짜·판 꼬리를 떼고 점을 붙임표로(claude-opus-5.5 = claude-opus-5-5) */
export const normId = (id) => String(id).toLowerCase().replace(/^models\//, '').replace(/\./g, '-').replace(/-(?:\d{4}-\d{2}-\d{2}|\d{8}|\d{3})$/, '');
/** 등급(출력 100만 토큰 값): 최상위 $30~ · 고품질 $8~ · 표준 $3~ · 가벼움 그 아래 */
export const tierByPrice = (out) => (out >= 30 ? 3 : out >= 8 ? 2 : out >= 3 ? 1 : 0);
/** 값표가 하나도 없을 때만 쓰는 이름 어림(이름이 바뀌면 틀림) */
export const tierByName = (id) => (/astra|fable|mythos|ultra|daybreak-red/.test(id) ? 3 : /opus|sonnet|(?:^|[-/])sol(?:-|$)|carbon|argon|(?:^|-)pro(?:-|$)|daybreak-blue/.test(id) ? 2 : /(?:^|[-/.])(?:haiku|luna|mini|lite|small)(?:[-.]|$)/.test(id) ? 0 : 1);
/** 이름 속 판 번호(출시일을 모를 때 새 모델을 가리는 데 씀): claude-opus-5-5 → 5.05, gpt-6.1-sol → 6.01 */
export const verOf = (id) => { const m = /(?:^|[-/])(\d{1,2})(?:[.-](\d{1,2}))?(?=-|$)/.exec(normId(id)); return m ? +m[1] + (+m[2] || 0) / 100 : 0; };

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : NaN);
const okPrice = (x) => Number.isFinite(x) && x >= 0 && x <= 1000;

/** OpenRouter 공개 목록 → Map(normId → { in, out, created, text }). :batch 같은 변형은 빼고 :free는 둠 */
export function fromOpenRouter(j) {
  const m = new Map();
  for (const x of (j && Array.isArray(j.data) ? j.data : [])) {
    if (!x || typeof x.id !== 'string') continue;
    if (/:[\w-]+$/.test(x.id) && !/:free$/.test(x.id)) continue;
    const pin = +x.pricing?.prompt * 1e6, pout = +x.pricing?.completion * 1e6;
    const mods = x.architecture?.output_modalities;
    m.set(normId(x.id), { in: okPrice(pin) ? pin : 0, out: okPrice(pout) ? pout : 0, created: (+x.created || 0) * 1000, text: !Array.isArray(mods) || mods.every((t) => t === 'text') });
  }
  return m;
}

/**
 * 같은 출처의 ai-catalog.json → { map, gemini, updated }. 모양이 틀린 줄은 버리고, 파일 모양이 아예 다르면 null.
 * gemini(normId 모음, 없으면 null): free·paidOnly = Gemini 공식 가격표의 무료 등급 칸('Free of charge'·'Not available'),
 *   old = 모델 문서에서 폐기 예정·써 본 사용자만·종료로 적힌 것(추천하지 않음)
 */
export function fromFile(j) {
  if (!j || typeof j !== 'object' || j.schema !== 1 || !Array.isArray(j.models)) return null;
  const map = new Map();
  const put = (x, free) => {
    if (!x || typeof x.id !== 'string' || x.id.length > 120 || !/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*$/.test(x.id)) return;
    const pin = free ? 0 : num(x.in), pout = free ? 0 : num(x.out);
    if (!okPrice(pin) || !okPrice(pout)) return;
    const created = typeof x.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? Date.parse(x.date + 'T00:00:00Z') || 0 : 0;
    map.set(normId(x.id), { in: pin, out: pout, created, text: x.text !== false });
  };
  for (const x of j.models) put(x, false);
  for (const x of (Array.isArray(j.free) ? j.free : [])) put(x, true);
  const g = j.geminiFree && typeof j.geminiFree === 'object' ? j.geminiFree : {};
  const d = j.geminiDocs && typeof j.geminiDocs === 'object' ? j.geminiDocs : {};
  const ids = (a) => (Array.isArray(a) ? a.filter((s) => typeof s === 'string' && s.length < 120).map(normId) : []);
  const ok = Array.isArray(g.free) && g.free.length > 0 && Array.isArray(g.paidOnly);
  const old = new Set([...ids(d.legacy), ...ids(d.previous)]);
  const gemini = ok || old.size ? { free: new Set(ok ? ids(g.free) : []), paidOnly: new Set(ok ? ids(g.paidOnly) : []), old } : null;
  return { map, gemini, updated: typeof j.updated === 'string' ? j.updated : '' };
}

const EMPTY = Object.freeze({ map: new Map(), gemini: null, from: [] });
export const emptyCatalog = () => EMPTY;

/**
 * 카탈로그 읽기(한 번 읽으면 이 탭에서 다시 씀). 같은 출처 파일을 먼저 받고, OpenRouter 실시간 목록이
 * grace 안에 오면 덮어씀. 그보다 늦으면 파일로 먼저 답하고, 실시간 목록은 다음 호출부터 씀.
 * 파일이 없으면 실시간 목록을 기다림(예전과 같음). 둘 다 없으면 빈 카탈로그를 주고 다음 호출에 다시 받음.
 * @returns {() => Promise<{map: Map, gemini: null|{free:Set,paidOnly:Set}, from: string[]}>}
 */
export function catalogLoader({ fetchFn, file = CATALOG_FILE, live = OR_MODELS, grace = 2500, fileMs = 4000, liveMs = 8000 } = {}) {
  const f = fetchFn || ((...a) => globalThis.fetch(...a));
  const get = async (url, ms) => {
    const r = await f(url, { signal: AbortSignal.timeout(ms) });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  };
  const wait = (ms) => new Promise((res) => setTimeout(() => res(undefined), ms));
  let cur = null, pending = null;
  return function load() {
    if (cur) return Promise.resolve(cur);
    if (pending) return pending;
    pending = (async () => {
      const fileP = get(file, fileMs).then(fromFile).catch(() => null);
      const liveP = get(live, liveMs).then(fromOpenRouter).then((m) => (m.size ? m : null)).catch(() => null);
      const fd = await fileP;
      const ld = fd ? await Promise.race([liveP, wait(grace)]) : await liveP;
      const make = (l) => ({ map: new Map([...(fd ? fd.map : []), ...(l || [])]), gemini: fd ? fd.gemini : null, from: [fd && 'file', l && 'live'].filter(Boolean) });
      const out = make(ld || null);
      pending = null;
      if (!fd && !ld) return out; // 둘 다 못 받음: 이번에는 이름으로 어림하고 다음에 다시
      cur = out;
      if (ld === undefined) liveP.then((l) => { if (l) cur = make(l); }); // 늦게 온 실시간 목록
      return out;
    })();
    return pending;
  };
}

/**
 * 모델 목록에 등급·추천·어림 값을 붙이고 고르기 좋은 순서로(맨 앞이 추천). ai.js의 models()가 씀.
 * cat: catalogLoader 결과(없으면 이름 규칙) · blocked: 이 키로 못 쓴다고 확인된 모델 id
 * @returns {Array<{id,label,tier,rec,won,locked,free,created}>} won: 사이트 한 번 만들 때 어림 값(원, 입력 1만·출력 1만 4천 토큰, 1달러 1,400원). 무료로 쓰는 연결은 0
 */
export function rankModels(provider, list, { cat = EMPTY, freeTier = false, blocked = [], now = Date.now() } = {}) {
  const map = cat.map || new Map();
  const known = map.size > 0; // 값표가 있으면 이름 규칙을 쓰지 않음
  // Gemini 무료 키: 공식 가격표에서 '무료 등급에서 안 됨'인 모델은 써 보기 전부터 '유료 키 필요'
  const gd = provider === 'gemini' ? cat.gemini : null;
  const g = gd && freeTier && gd.free.size ? gd : null;
  const blockedIds = new Set(blocked);
  const rows = [];
  list.forEach((m, i) => {
    const id = m.id.toLowerCase();
    if (provider === 'openrouter') {
      if (freeTier ? !(m.free || id === 'openrouter/free') : !/^(anthropic|openai|google)\//.test(id)) return;
    } else if (SKIP.test(id) || (provider === 'openai' && (!/^gpt-/.test(id) || /-pro$/.test(id)))) return;
    if (provider === 'openrouter' && !freeTier && (SKIP.test(id) || /:[\w-]+$/.test(id))) return;
    const c = map.get(OR_PREFIX[provider] + normId(id));
    if (c && !c.text) return;
    const free = provider === 'openrouter' && !!freeTier;
    const tier = free ? 0 : c && c.out > 0 ? tierByPrice(c.out) : known ? 1 : tierByName(id);
    const locked = blockedIds.has(m.id) || !!(g && g.paidOnly.has(normId(id)));
    const won = free || provider === 'gemini' || !c ? 0 : Math.max(10, Math.round(((10000 * c.in + 14000 * c.out) / 1e6) * 1400 / 10) * 10);
    rows.push({ id: m.id, label: m.label || m.id, tier, rec: false, won, locked, free, created: c?.created || 0, gfree: !!(g && g.free.has(normId(id))), old: !!(gd && gd.old.has(normId(id))), i });
  });
  // 추천: 고품질 등급(없으면 그 아래에서 가장 높은 등급)에서 고름
  const usable = rows.filter((r) => !r.locked && !r.free);
  // Gemini 무료 키: 무료 등급 목록이 있으면 그 안에서, 없으면 표준 등급까지(고품질 등급은 대부분 결제를 등록한 키만 됨)
  const gPool = g ? usable.filter((r) => r.gfree) : [];
  const base0 = gPool.length ? gPool : usable;
  // 폐기 예정·써 본 사용자만 되는 Gemini 모델(문서에 적힌 것)은 다른 것이 있으면 추천하지 않음
  const base = base0.some((r) => !r.old) ? base0.filter((r) => !r.old) : base0;
  const cap = provider === 'gemini' && freeTier && !gPool.length ? 1 : 2;
  const top = Math.max(-1, ...base.filter((r) => r.tier <= cap).map((r) => r.tier));
  const pool = base.filter((r) => r.tier === top);
  const pref = PREFER[provider];
  const fresh = (r) => (r.created && now - r.created < FRESH_MS ? 1 : 0); // 나온 지 2주가 안 된 모델은 뒤로
  const score = (r) => [pref && pref.test(r.id.toLowerCase()) ? 0 : 1, fresh(r), -r.created, -verOf(r.id), r.id.length, r.i];
  const cmp = (a, b) => { const x = score(a), y = score(b); for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return x[k] - y[k]; return 0; };
  const rec = pool.sort(cmp)[0];
  if (rec) rec.rec = true;
  const order = { 2: 0, 3: 1, 1: 2, 0: 3 };
  // 같은 등급 안에서는 추천과 같은 기준(갓 나온 모델은 뒤로)으로: 무료 키가 못 쓰는 모델을 건너뛸 때(generateAuto) 추천과 같은 모델로 내려가게
  rows.sort((a, b) => (b.rec - a.rec) || (a.locked - b.locked) || (b.gfree - a.gfree) || (a.old - b.old) || (order[a.tier] - order[b.tier]) || (fresh(a) - fresh(b)) || (b.created - a.created) || (verOf(b.id) - verOf(a.id)) || (a.i - b.i));
  return rows.map(({ gfree, old, i, ...r }) => r);
}

/** Gemini 공식 가격표에 '무료 등급에서 안 됨'으로 적힌 모델인지(카탈로그가 없으면 false) */
export const geminiPaidOnly = (cat, id) => !!(cat && cat.gemini && cat.gemini.paidOnly.has(normId(id)));
