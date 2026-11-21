// AI 값표 갱신의 순수 함수들(네트워크·파일 없음). refresh.mjs가 부르고, test/가 저장해 둔 표본으로 시험합니다.
// 가져온 글은 데이터로만 다룹니다: 모델 id(정해진 모양)·숫자·날짜·참거짓만 뽑고, 이름·설명·HTML은 버립니다.
import { createHash } from 'node:crypto';
import { normId, fromFile, rankModels } from '../../app/src/lib/ai-catalog.js';

export const SOURCES = {
  openrouter: 'https://openrouter.ai/api/v1/models',
  modelsdev: 'https://models.dev/api.json',
};
export const ABOUT = {
  note: 'AI 모델 값표(OpenAI·Claude, 입력·출력 100만 토큰당 달러, 출시일, 글 출력 여부, 문맥 길이). scripts/ai-catalog/refresh.mjs가 하루 한 번 만들어요. 손으로 고치지 마세요.',
  sources: {
    openrouter: 'https://openrouter.ai/api/v1/models',
    modelsdev: 'https://models.dev/api.json (MIT License, Copyright (c) 2025 models.dev)',
  },
};

/** 검사 기준. 하나라도 어기면 파일을 바꾸지 않음 */
export const LIMITS = {
  minModels: { openai: 8, anthropic: 4 }, // 회사별 최소 모델 수(2026-11-14: OpenAI 80여·Claude 30여)
  maxVanish: 0.3, // 한 번에 사라져도 되는 비율(회사별, 앞 판 모델이 5개 이상일 때)
  maxPrice: 1000, // 100만 토큰당 달러
  maxModels: 2000,
  maxBytes: 96 * 1024,
  maxPriceShift: 5, // 회사마다 두 판에 다 있는 모델의 값 비율 가운데 값이 1/5~5배 밖이면 거부(단위·형식이 바뀐 것)
  minPriceCompare: 5, // 그 비교에 필요한 같은 모델 수
};
/** 확인한 날(checked)을 새로 적는 간격(일). 값이 같으면 이틀에 한 번만 커밋해 앱 배포가 날마다 생기지 않게. 하루 점검(hosting gate.js)은 3일 넘게 묵으면 알림 */
export const CHECK_EVERY_DAYS = 2;
/** 두 출처를 모두 받은 마지막 날이 이 날 수보다 오래면 '사람이 볼 일'(하루 점검의 기준과 같음) */
export const STALE_DAYS = 3;
/** 앱 추천 칸 이름(점검 글) */
export const REC_NAMES = { openai: 'OpenAI', anthropic: 'Claude' };
const PROVS = ['openai', 'anthropic'];
export const ID_RE = /^(openai|anthropic)\/[a-z0-9][a-z0-9._-]{0,100}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const round = (x) => Math.round(x * 1e4) / 1e4;
const okPrice = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= LIMITS.maxPrice;
const okCtx = (x) => (Number.isInteger(x) && x > 0 && x <= 1e8 ? x : null);
const dayOf = (d) => d.toISOString().slice(0, 10);
function okDate(s, today) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return null;
  const t = Date.parse(s + 'T00:00:00Z');
  if (!Number.isFinite(t) || s < '2015-01-01' || t > Date.parse(today + 'T00:00:00Z') + 2 * 86400000) return null;
  return s;
}
const provOf = (id) => id.split('/')[0];
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const times = (r) => (r < 1 ? `1/${Math.round(1 / r)}` : `${Math.round(r * 10) / 10}`);
/** 두 날짜('YYYY-MM-DD') 사이 날 수 */
export const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

/** OpenRouter 공개 목록 → { models, dropped }. 모양이 아예 다르면 throw */
export function parseOpenRouter(j, today) {
  if (!j || !Array.isArray(j.data)) throw new Error('OpenRouter: data 배열이 없어요');
  const models = []; let dropped = 0;
  for (const x of j.data) {
    if (!x || typeof x.id !== 'string') { dropped++; continue; }
    const id = x.id;
    const mods = x.architecture?.output_modalities;
    const text = !Array.isArray(mods) || (mods.length > 0 && mods.every((t) => t === 'text'));
    const date = Number.isFinite(+x.created) && +x.created > 0 ? okDate(dayOf(new Date(+x.created * 1000)), today) : null;
    const ctx = okCtx(x.context_length);
    if (/:[\w-]+$/.test(id)) continue; // :free·:batch 같은 변형(값이 다름)
    if (!PROVS.includes(provOf(id))) continue;
    if (!ID_RE.test(id)) { dropped++; continue; }
    const pin = +x.pricing?.prompt * 1e6, pout = +x.pricing?.completion * 1e6;
    if (!okPrice(pin) || !okPrice(pout)) { dropped++; continue; } // 값이 '그때그때'(-1)이거나 이상함
    models.push({ id, in: round(pin), out: round(pout), date, text, ctx, src: 'or' });
  }
  return { models, dropped };
}

/** models.dev(MIT) → { models, dropped }. openai·anthropic만, 값이 있는 것만 */
export function parseModelsDev(j, today) {
  if (!j || typeof j !== 'object' || !PROVS.some((p) => j[p] && typeof j[p].models === 'object')) throw new Error('models.dev: 회사 목록이 없어요');
  const models = []; let dropped = 0;
  for (const p of PROVS) {
    for (const m of Object.values(j[p]?.models || {})) {
      if (!m || typeof m.id !== 'string') { dropped++; continue; }
      const id = `${p}/${m.id}`;
      if (!ID_RE.test(id)) { dropped++; continue; }
      const pin = m.cost?.input, pout = m.cost?.output;
      if (!okPrice(pin) || !okPrice(pout)) continue; // 값을 모르는 모델은 넣지 않음
      const out = m.modalities?.output;
      models.push({ id, in: round(pin), out: round(pout), date: okDate(m.release_date, today), text: !Array.isArray(out) || (out.length > 0 && out.every((t) => t === 'text')), ctx: okCtx(m.limit?.context), src: 'md' });
    }
  }
  return { models, dropped };
}

/** 두 출처를 합침: OpenRouter가 먼저, models.dev는 OpenRouter에 없는 모델만(같은 모델 판단은 normId) */
export function mergeModels(primary, secondary) {
  const seen = new Map();
  for (const m of primary) if (!seen.has(normId(m.id))) seen.set(normId(m.id), m);
  for (const m of secondary) if (!seen.has(normId(m.id))) seen.set(normId(m.id), m);
  return [...seen.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const count = (models) => Object.fromEntries(PROVS.map((p) => [p, models.filter((m) => m && typeof m.id === 'string' && provOf(m.id) === p).length]));
/** 전체 검사 → 어긴 것 목록(비어 있으면 통과) */
export function validateCatalog(c, prev, today) {
  const errs = [];
  if (!c || c.schema !== 1 || typeof c.updated !== 'string' || !DATE_RE.test(c.updated)) return ['파일 모양(schema·updated)이 달라요'];
  if (c.checked !== undefined && okDate(c.checked, today) === null) return ['확인한 날(checked) 모양이 달라요'];
  if (!Array.isArray(c.models) || c.models.length > LIMITS.maxModels) return ['models 배열이 없거나 너무 커요'];
  const keys = new Set();
  for (const m of c.models) {
    const bad = !m || !ID_RE.test(m.id) || !okPrice(m.in) || !okPrice(m.out) || (m.date !== null && okDate(m.date, today) === null)
      || typeof m.text !== 'boolean' || (m.ctx !== null && okCtx(m.ctx) === null) || !['or', 'md'].includes(m.src);
    if (bad) { errs.push(`모델 줄 모양이 이상해요: ${JSON.stringify(m).slice(0, 120)}`); continue; }
    const k = normId(m.id);
    if (keys.has(k)) errs.push(`같은 모델이 두 번 있어요: ${m.id}`);
    keys.add(k);
  }
  const n = count(c.models);
  for (const p of PROVS) if (n[p] < LIMITS.minModels[p]) errs.push(`${p} 모델이 ${n[p]}개뿐이에요(최소 ${LIMITS.minModels[p]}개)`);
  if (prev && Array.isArray(prev.models)) {
    for (const p of PROVS) {
      const before = prev.models.filter((m) => m && typeof m.id === 'string' && provOf(m.id) === p).map((m) => normId(m.id));
      if (before.length < 5) continue;
      const gone = before.filter((k) => !keys.has(k)).length;
      if (gone / before.length > LIMITS.maxVanish) errs.push(`${p} 모델 ${before.length}개 중 ${gone}개가 한 번에 사라졌어요(${Math.round((gone / before.length) * 100)}%, 기준 ${LIMITS.maxVanish * 100}%)`);
    }
    // 값 급변: 같은 모델의 (입력+출력) 값이 회사마다 한꺼번에 크게 바뀌면(1/1000 같은 단위 실수) 거부. 모델 한두 개의 값 내림은 통과
    const was = new Map(prev.models.filter((m) => m && typeof m.id === 'string' && okPrice(m.in) && okPrice(m.out)).map((m) => [normId(m.id), m]));
    for (const p of PROVS) {
      const ratios = [];
      for (const m of c.models) {
        if (!m || typeof m.id !== 'string' || provOf(m.id) !== p || !okPrice(m.in) || !okPrice(m.out)) continue;
        const o = was.get(normId(m.id));
        if (o && o.in + o.out > 0) ratios.push((m.in + m.out) / (o.in + o.out));
      }
      if (ratios.length < LIMITS.minPriceCompare) continue;
      const r = median(ratios);
      if (r < 1 / LIMITS.maxPriceShift || r > LIMITS.maxPriceShift) errs.push(`${p} 모델 값이 한꺼번에 앞 판의 ${times(r)}배가 됐어요(두 판에 다 있는 ${ratios.length}개의 가운데 값, 기준 1/${LIMITS.maxPriceShift}~${LIMITS.maxPriceShift}배). 단위나 형식이 바뀌었을 수 있어요`);
    }
    // 추천이 비면 거부: 앞 판에서는 앱이 고를 모델이 있었는데 이번 판에는 없음(모든 모델이 그림 전용으로 바뀌는 등)
    try {
      const at = Date.parse(`${today}T00:00:00Z`);
      const before = simulateRecs(prev, at); const now = simulateRecs(c, at);
      for (const k of Object.keys(REC_NAMES)) if (before[k] && !now[k]) errs.push(`${REC_NAMES[k]}: 앞 판에는 앱이 추천할 모델(${before[k]})이 있었는데 이번 판에는 없어요`);
    } catch { /* 앞 판 모양이 달라 견줄 수 없음(위 검사가 이미 걸러 냄) */ }
  }
  if (Buffer.byteLength(serialize(c)) > LIMITS.maxBytes) errs.push(`파일이 ${LIMITS.maxBytes / 1024}KB보다 커요`);
  // 앱이 실제로 이 파일을 읽을 수 있는지(같은 해석 함수로)
  const app = fromFile(JSON.parse(serialize(c)));
  if (!app || app.map.size < c.models.length * 0.9) errs.push('앱의 해석 함수(fromFile)가 이 파일을 제대로 읽지 못해요');
  return errs;
}

/** 줄마다 모델 하나(바뀐 곳이 잘 보이게). 같은 내용이면 같은 글 */
export function serialize(c) {
  const arr = (a) => (a.length ? `[\n${a.map((x) => '    ' + JSON.stringify(x)).join(',\n')}\n  ]` : '[]');
  return `{\n  "schema": 1,\n  "updated": ${JSON.stringify(c.updated)},\n${typeof c.checked === 'string' ? `  "checked": ${JSON.stringify(c.checked)},\n` : ''}  "about": ${JSON.stringify(c.about)},\n`
    + `  "models": ${arr(c.models)}\n}\n`;
}
/** updated·checked(날짜)를 뺀 내용이 같은지 */
export const sameData = (a, b) => !!a && !!b && serialize({ ...a, updated: '', checked: undefined }) === serialize({ ...b, updated: '', checked: undefined });

/**
 * 출처별 결과로 새 판을 만듦. 못 받은 출처는 앞 판의 그 출처 몫을 그대로 씀(하루 끊겨도 모델이 사라지지 않게).
 * got: { or?: {models}, md?: {models} } · 실패한 것은 빠짐
 * @returns {{ catalog, kept: string[] }} kept: 앞 판 값을 쓴 칸
 */
export function buildCatalog(got, prev, today) {
  const kept = [];
  const prevModels = Array.isArray(prev?.models) ? prev.models.filter((m) => m && typeof m.id === 'string') : [];
  const orModels = got.or ? got.or.models : (kept.push('OpenRouter 모델'), prevModels.filter((m) => m.src === 'or'));
  const mdModels = got.md ? got.md.models : (kept.push('models.dev 모델'), prevModels.filter((m) => m.src === 'md'));
  const catalog = { schema: 1, updated: today, about: ABOUT, models: mergeModels(orModels, mdModels) };
  return { catalog, kept };
}

// ── 점검(사람이 볼 일) ──
/** 코드·문서에서 모델 이름을 찾음: id 모양(gpt-6.1-sol)과 화면 이름(GPT-6.1 Sol, Claude Opus 5.5) */
export function scanNames(files) {
  const out = [];
  const add = (id, file, line) => out.push({ id: id.toLowerCase(), file, line });
  for (const { path, text } of files) {
    String(text).split('\n').forEach((ln, i) => {
      if (/ai-catalog-ok/.test(ln)) return; // 일부러 옛 이름을 적은 줄
      for (const m of ln.matchAll(/\b(gpt-\d(?:[a-z0-9.-]*[a-z0-9])?|claude-[a-z]+-\d(?:[a-z0-9-]*[a-z0-9])?)\b/g)) add(m[1], path, i + 1);
      for (const m of ln.matchAll(/\bGPT-(\d+(?:\.\d+)?) ([A-Z][a-z]+(?:·[A-Z][a-z]+(?![\w-]))*)/g)) for (const w of m[2].split('·')) add(`gpt-${m[1]}-${w}`, path, i + 1);
      for (const m of ln.matchAll(/\bClaude ((?:Opus|Sonnet|Haiku|Fable) \d+(?:\.\d+)?(?:·(?:Opus|Sonnet|Haiku|Fable) \d+(?:\.\d+)?)*)/g)) for (const w of m[1].split('·')) { const [f, v] = w.split(' '); add(`claude-${f}-${v}`, path, i + 1); }
    });
  }
  return out;
}
/** 찾은 이름 중 지금 값표에 없는 것 */
export function missingNames(found, c) {
  const have = new Set((c.models || []).filter((m) => m && typeof m.id === 'string').map((m) => normId(m.id.split('/').slice(1).join('/'))));
  const by = new Map();
  for (const f of found) {
    const k = normId(f.id);
    if (have.has(k)) continue;
    const e = by.get(k) || { id: f.id, where: [] };
    if (e.where.length < 3) e.where.push(`${f.file}:${f.line}`);
    by.set(k, e);
  }
  return [...by.values()];
}
/** 앱 규칙(rankModels)으로 회사별 추천을 어림: 그 회사 모델 전부를 키의 목록으로 보고 고름 */
export function simulateRecs(c, now = Date.now()) {
  const cat = fromFile(JSON.parse(serialize(c)));
  const list = (p) => (c.models || []).filter((m) => m && typeof m.id === 'string' && provOf(m.id) === p).map((m) => ({ id: m.id.slice(p.length + 1) }));
  const rec = (p) => (rankModels(p, list(p), { cat, now }).find((r) => r.rec) || {}).id || '';
  return { openai: rec('openai'), anthropic: rec('anthropic') };
}

// ── 주소·CORS 점검(fetchFn을 받아 시험에서는 흉내 응답으로) ──
export const ORIGIN = 'https://lecpage.com';
/** 앱(ai.js)이 브라우저에서 바로 부르는 곳과 보내는 머리글. ai.js를 고치면 여기도 맞춤 */
export const CORS_TARGETS = [
  { name: 'OpenAI 모델 목록', url: 'https://api.openai.com/v1/models', method: 'GET', headers: ['authorization'] },
  { name: 'OpenAI 만들기', url: 'https://api.openai.com/v1/responses', method: 'POST', headers: ['authorization', 'content-type'] },
  { name: 'Claude 모델 목록', url: 'https://api.anthropic.com/v1/models?limit=100', method: 'GET', headers: ['anthropic-dangerous-direct-browser-access', 'anthropic-version', 'anthropic-workspace-id', 'x-api-key'] },
  { name: 'Claude 만들기', url: 'https://api.anthropic.com/v1/messages', method: 'POST', headers: ['anthropic-beta', 'anthropic-dangerous-direct-browser-access', 'anthropic-version', 'content-type', 'x-api-key'] },
];
const drop = (r) => { try { r.body?.cancel?.(); } catch { /* 이미 닫힘 */ } };
/** CORS 사전 요청 한 번 → { level: 'ok'|'bad'|'unknown', msg } */
export async function preflight(fetchFn, t, ms = 15000) {
  let r;
  try { r = await fetchFn(t.url, { method: 'OPTIONS', redirect: 'manual', signal: AbortSignal.timeout(ms), headers: { origin: ORIGIN, 'access-control-request-method': t.method, 'access-control-request-headers': t.headers.join(',') } }); }
  catch (e) { return { level: 'unknown', msg: `닿지 못함(${e.name || e.message})` }; }
  drop(r);
  if (r.status >= 500 || r.status === 429) return { level: 'unknown', msg: `서버 응답 ${r.status}` };
  if (r.status < 200 || r.status >= 300) return { level: 'bad', msg: `사전 요청에 ${r.status}로 답함` };
  const acao = r.headers.get('access-control-allow-origin');
  if (acao !== '*' && acao !== ORIGIN) return { level: 'bad', msg: `허용 출처가 없음(${acao || '빈 값'})` };
  const allow = (r.headers.get('access-control-allow-headers') || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  // '*'는 authorization을 덮지 않음(Fetch 표준)
  const missing = t.headers.filter((h) => !allow.includes(h) && !(allow.includes('*') && h !== 'authorization'));
  if (missing.length) return { level: 'bad', msg: `허용하지 않는 머리글: ${missing.join(', ')}` };
  const am = (r.headers.get('access-control-allow-methods') || '').toUpperCase();
  if (am && !am.includes('*') && !am.split(',').map((s) => s.trim()).includes(t.method)) return { level: 'bad', msg: `허용하지 않는 방식: ${t.method}` };
  return { level: 'ok', msg: '' };
}
/** 사람이 여는 주소(키·결제 화면) → 200이나 로그인 화면으로 넘어가면 ok, 404·410이면 bad, 봇 막기(403)·혼잡은 unknown */
export async function checkLink(fetchFn, url, ms = 15000) {
  let u = url;
  for (let hop = 0; hop < 6; hop++) {
    let r;
    try { r = await fetchFn(u, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(ms), headers: { accept: 'text/html', 'user-agent': 'Mozilla/5.0 (compatible; ai-catalog-check/1)' } }); }
    catch (e) { return { level: 'unknown', msg: `닿지 못함(${e.name || e.message})` }; }
    drop(r);
    const loc = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && loc) { u = new URL(loc, u).href; continue; }
    if (r.status >= 200 && r.status < 300) return { level: 'ok', msg: u === url ? '200' : `→ ${new URL(u).host}${/log.?in|sign.?in|auth/i.test(u) ? '(로그인 화면)' : ''}` };
    if (r.status === 404 || r.status === 410) return { level: 'bad', msg: `${r.status}${u === url ? '' : ` (${u})`}` };
    return { level: 'unknown', msg: `${r.status}${r.headers.get('cf-mitigated') ? '(봇 확인 화면)' : ''}` };
  }
  return { level: 'unknown', msg: '넘겨주기가 너무 많음' };
}
/** ai.js에서 사람이 여는 주소를 뽑음(PROVIDERS의 keyUrl·billingUrl, CHATBOTS의 url) */
export function appUrls(aiJs) {
  const urls = new Set();
  for (const m of String(aiJs).matchAll(/\b(?:keyUrl|billingUrl|url): '(https:\/\/[^'\s]+)'/g)) urls.add(m[1]);
  return [...urls];
}

/** 점검 결과 → 이슈·요약에 쓸 마크다운. 같은 문제 목록이면 digest가 같음(이슈에 같은 글을 되풀이하지 않게) */
export function renderReport({ status, today, counts, sources, kept, recs, problems, notes, rejected, checked = '' }) {
  const digest = createHash('sha256').update(problems.join('\n')).digest('hex').slice(0, 16);
  const yn = (ok) => (ok ? '받음' : '못 받음');
  const L = [
    `## AI 정보 점검 (${today})`, '',
    `- 결과: ${{ updated: '갱신함', checked: '값은 그대로(확인한 날만 새로 적음)', unchanged: '바뀐 것 없음', rejected: '갱신 거부(파일은 그대로)' }[status] || status}`,
    `- 모델 수: OpenAI ${counts.openai} · Claude ${counts.anthropic}`,
    `- 출처: OpenRouter ${yn(sources.openrouter)} · models.dev ${yn(sources.modelsdev)}${kept.length ? ` (앞 판 값 유지: ${kept.join(', ')})` : ''}`,
    ...(checked ? [`- 두 출처를 모두 받은 마지막 날: ${checked}${checked === today ? '(오늘)' : `(${daysBetween(checked, today)}일 전)`}`] : []),
    `- 앱 추천(어림): OpenAI ${recs.openai || '없음'} · Claude ${recs.anthropic || '없음'}`,
  ];
  if (rejected?.length) L.push('', '### 갱신을 거부한 까닭', ...rejected.map((e) => `- ${e}`));
  if (problems.length) L.push('', '### 사람이 볼 일', ...problems.map((p) => `- ${p}`));
  if (notes.length) L.push('', '### 참고', ...notes.map((p) => `- ${p}`));
  L.push('', '할 일과 끄는 법: docs/operations.md §12 · 근거: docs/research/ai-facts-2026-11-14.md §7', '', `<!-- ai-catalog-digest: ${digest} -->`);
  return { text: L.join('\n') + '\n', digest };
}
export { count as countModels, dayOf };
