#!/usr/bin/env node
// AI 정보 매일 갱신: 공개 목록에서 모델 값·출시일과 Gemini 무료 등급을 모아 app/public/ai-catalog.json을 새로 쓰고,
// 앱이 기대는 사실(문서·코드에 적힌 모델 이름, 키 화면 주소, 브라우저 직접 호출)을 점검해 사람이 볼 일을 모읍니다.
// 의존성 없음(Node 22의 fetch). GitHub Actions(.github/workflows/ai-catalog.yml)가 하루 한 번 돌립니다.
//
//   node scripts/ai-catalog/refresh.mjs                 모으기·검사·쓰기·점검(요약을 화면에)
//   --report <파일>   점검 결과 마크다운(이슈 본문)을 파일로     --dry   파일을 쓰지 않음
//   --no-check        주소·CORS 점검을 건너뜀(모으기·검사·이름 점검만)
// 바꾸는 파일은 app/public/ai-catalog.json 하나뿐이고, 검사에 하나라도 걸리면 그 파일도 그대로 둡니다.
// GITHUB_OUTPUT이 있으면 status(updated|unchanged|rejected)·problems(사람이 볼 일 수)를 적습니다.
import { readFileSync, writeFileSync, appendFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SOURCES, GOOGLE_HOSTS, ORIGIN, CORS_TARGETS, parseOpenRouter, parseModelsDev, parseGooglePricing, parseGoogleModels, buildCatalog, validateCatalog,
  checkGemini, serialize, sameData, scanNames, missingNames, simulateRecs, preflight, checkLink, appUrls, renderReport, countModels, dayOf,
} from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT = 'app/public/ai-catalog.json';
const MAX_BODY = 20 * 1024 * 1024;

/** 받아 오기: 시간 제한·크기 제한·두 번까지(연결 실패·5xx·429). 4xx는 바로 실패(주소가 바뀌었을 수 있음) */
async function fetchBody(fetchFn, url, { json = false, headers = {}, tries = 2, pause = 3000 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetchFn(url, { headers: { 'user-agent': 'ai-catalog-refresh/1', ...headers }, signal: AbortSignal.timeout(30000), redirect: 'follow' });
      if (r.status >= 400 && r.status < 500 && r.status !== 429) { const e = new Error(`${r.status}`); e.hard = true; throw e; }
      if (!r.ok) throw new Error(`${r.status}`);
      const text = await r.text();
      if (text.length > MAX_BODY) { const e = new Error('너무 큼'); e.hard = true; throw e; }
      return { body: json ? JSON.parse(text) : text, url: r.url || url, headers: r.headers };
    } catch (e) {
      last = e;
      if (e.hard || e instanceof SyntaxError) break;
      if (i + 1 < tries) await new Promise((res) => setTimeout(res, pause));
    }
  }
  throw last;
}
const why = (e) => (e instanceof SyntaxError ? 'JSON이 아님' : e?.message || String(e));

/** 코드·문서 중 모델 이름을 찾을 곳: 앱 화면·주석(app/src)과 README */
export function repoFacts(root = ROOT) {
  const files = [];
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) { if (n !== 'node_modules') walk(p); continue; }
      if (/\.(js|jsx)$/.test(n)) files.push(p);
    }
  };
  walk(join(root, 'app', 'src'));
  if (existsSync(join(root, 'README.md'))) files.push(join(root, 'README.md'));
  const rel = (p) => relative(root, p).split(sep).join('/');
  const aiJs = readFileSync(join(root, 'app', 'src', 'lib', 'ai.js'), 'utf8');
  return { files: files.map((p) => ({ path: rel(p), text: readFileSync(p, 'utf8') })), urls: appUrls(aiJs) };
}

/**
 * 한 번 돌리기. 시험에서는 fetchFn·repo·prevText를 넣고 write=false로 부름.
 * @returns {Promise<{status, catalog, text, report, problems, notes}>}
 */
export async function run({ fetchFn = globalThis.fetch, root = ROOT, repo, prevText, now = new Date(), check = true, write = true, pause = 3000 } = {}) {
  const today = dayOf(now);
  const outPath = join(root, OUT);
  if (prevText === undefined) prevText = existsSync(outPath) ? readFileSync(outPath, 'utf8') : '';
  let prev = null;
  try { prev = prevText ? JSON.parse(prevText) : null; } catch { prev = null; }
  if (prev && (prev.schema !== 1 || !Array.isArray(prev.models))) prev = null;
  const problems = [], notes = [];
  if (prevText && !prev) problems.push(`지금 ${OUT}을 읽지 못했어요(모양이 깨짐). 이번 판은 앞 판과 견주지 않고 만들어요.`);
  // 받기 실패: 연결·혼잡(일시적)은 참고로, 4xx·모양이 다름(주소가 바뀌었거나 형식이 바뀜)은 사람이 볼 일로
  const failed = (label, e) => (e?.hard || e instanceof SyntaxError || e?.shape ? problems : notes).push(`${label} 받지 못했어요(${why(e)}). 앞 판 값을 그대로 써요.`);

  // 1) 모으기
  const got = {}; const ok = { openrouter: false, modelsdev: false, googlePricing: false, googleModels: false };
  let orHeaders = null;
  try {
    const r = await fetchBody(fetchFn, SOURCES.openrouter, { json: true, headers: { origin: ORIGIN }, pause });
    got.or = parseOpenRouter(r.body, today); orHeaders = r.headers; ok.openrouter = true;
    if (got.or.dropped > Math.max(10, r.body.data.length * 0.1)) problems.push(`OpenRouter 목록에서 모양이 이상한 줄이 ${got.or.dropped}개예요(형식이 바뀌었을 수 있어요).`);
  } catch (e) { if (/data 배열/.test(e.message)) e.shape = true; failed('OpenRouter 모델 목록을', e); delete got.or; }
  try {
    const r = await fetchBody(fetchFn, SOURCES.modelsdev, { json: true, pause });
    got.md = parseModelsDev(r.body, today); ok.modelsdev = true;
  } catch (e) { if (/회사 목록/.test(e.message)) e.shape = true; failed('models.dev 목록을', e); delete got.md; }
  const google = async (urls, parse, label, key) => {
    let lastErr;
    for (const u of urls) {
      try {
        const r = await fetchBody(fetchFn, u, { pause });
        const host = new URL(r.url).host;
        if (!GOOGLE_HOSTS.includes(host)) { const e = new Error(`다른 곳(${host})으로 넘어감`); e.hard = true; throw e; }
        got[key] = parse(r.body); ok[label] = true; return;
      } catch (e) { lastErr = e; }
    }
    failed(label === 'googlePricing' ? 'Gemini 가격표를' : 'Gemini 모델 문서를', lastErr);
  };
  await google(SOURCES.googlePricing, parseGooglePricing, 'googlePricing', 'pricing');
  await google(SOURCES.googleModels, parseGoogleModels, 'googleModels', 'docs');

  // 2) 새 판 만들기와 검사
  const { catalog, kept } = buildCatalog(got, prev, today);
  if (got.pricing && kept.includes('Gemini 무료 등급')) problems.push(`Gemini 가격표를 읽었지만 무료 등급 표가 검사에 걸려 앞 판 값을 썼어요: ${checkGemini({ free: got.pricing.free, paidOnly: got.pricing.paidOnly }, prev?.geminiFree).join(' / ')}. 표 모양이 바뀌었는지 scripts/ai-catalog/lib.mjs의 parseGooglePricing을 봐 주세요.`);
  if (got.docs && kept.includes('Gemini 모델 문서')) problems.push('Gemini 모델 문서를 읽었지만 모델 코드를 거의 찾지 못해 앞 판 값을 썼어요. 문서 모양이 바뀌었는지 parseGoogleModels를 봐 주세요.');
  if (got.pricing?.unknown?.length) notes.push(`Gemini 가격표에서 무료 여부를 읽지 못한 모델: ${got.pricing.unknown.join(', ')}`);
  const errs = validateCatalog(catalog, prev, today);
  let status = 'unchanged';
  let final = prev;
  if (errs.length) { status = 'rejected'; problems.push(`검사에 걸려 ${OUT}을 바꾸지 않았어요(아래 '갱신을 거부한 까닭').`); }
  else if (!sameData(catalog, prev)) { status = 'updated'; final = catalog; }
  else final = { ...catalog, updated: prev.updated };
  const text = serialize(final || catalog);
  if (status === 'updated' && write) writeFileSync(outPath, text);

  // 3) 점검(사람이 볼 일)
  const view = final || catalog; // 거부됐으면 앞 판 기준(앞 판도 없으면 새 판)
  const facts = repo || repoFacts(root);
  for (const m of missingNames(scanNames(facts.files), view)) {
    problems.push(`문서·코드에 적힌 모델 이름이 지금 목록에 없어요${m.previous ? '(Gemini 문서의 이전 모델로 옮겨짐)' : ''}: \`${m.id}\` — ${m.where.join(', ')}. 이름이 바뀌었으면 안내 문구와 주석을 고쳐 주세요.`);
  }
  const recs = simulateRecs(view, now.getTime());
  // 어제 앞 판으로 본 추천과 견줌: 자료가 바뀐 것과 '나온 지 2주' 창이 지난 것 모두 알림
  const before = prev ? simulateRecs(prev, now.getTime() - 86400000) : null;
  const RN = { openai: 'OpenAI', anthropic: 'Claude', gemini: 'Gemini(유료 키)', geminiFree: 'Gemini 무료 키' };
  for (const k of Object.keys(RN)) {
    if (!recs[k]) problems.push(`${RN[k]}: 앱이 추천할 모델을 값표에서 찾지 못해요(고품질·표준 등급 모델이 없음). 값표와 ai-catalog.js의 rankModels를 봐 주세요.`);
    else if (before && before[k] && before[k] !== recs[k]) problems.push(`${RN[k]} 추천이 바뀌었어요: ${before[k]} → ${recs[k]}. 앱은 알아서 따라가요. 문서(ai-facts)의 추천 이름과 안내 문구를 확인해 주세요.`);
  }
  const pg = prev?.geminiFree, ng = view.geminiFree;
  if (pg && ng && [pg.free, pg.paidOnly, ng.free, ng.paidOnly].every(Array.isArray)) {
    const add = ng.free.filter((c) => !pg.free.includes(c)), del = pg.free.filter((c) => !ng.free.includes(c));
    const addP = ng.paidOnly.filter((c) => !pg.paidOnly.includes(c)), delP = pg.paidOnly.filter((c) => !ng.paidOnly.includes(c));
    if (add.length || del.length || addP.length || delP.length) problems.push(`Gemini 무료 등급 목록이 바뀌었어요(무료 +${add.join(',') || '없음'} −${del.join(',') || '없음'} · 유료 전용 +${addP.join(',') || '없음'} −${delP.join(',') || '없음'}). 앱은 알아서 따라가요. 키 연결 창의 Gemini 안내(ai-guides.jsx·AiConnect.jsx)가 맞는지 봐 주세요.`);
  }
  if (prev && status === 'updated') {
    const old = new Set(prev.models.map((m) => m.id));
    const fresh = catalog.models.filter((m) => !old.has(m.id)).map((m) => m.id);
    if (fresh.length) notes.push(`새로 생긴 모델 ${fresh.length}개: ${fresh.slice(0, 12).join(', ')}${fresh.length > 12 ? ' …' : ''}`);
    const now2 = new Set(catalog.models.map((m) => m.id));
    const gone = prev.models.filter((m) => !now2.has(m.id)).map((m) => m.id);
    if (gone.length) notes.push(`목록에서 빠진 모델 ${gone.length}개: ${gone.slice(0, 12).join(', ')}${gone.length > 12 ? ' …' : ''}`);
  }
  if (check) {
    if (orHeaders) {
      const acao = orHeaders.get('access-control-allow-origin');
      if (acao !== '*' && acao !== ORIGIN) problems.push(`OpenRouter 공개 모델 목록이 브라우저(lecpage.com)에서 읽히지 않아요(허용 출처 ${acao || '없음'}). 앱은 같은 출처의 ai-catalog.json으로 버텨요.`);
    }
    const cors = await Promise.all(CORS_TARGETS.map(async (t) => ({ t, r: await preflight(fetchFn, t) })));
    for (const { t, r } of cors) {
      if (r.level === 'bad') problems.push(`${t.name}(${t.url}): 브라우저에서 바로 부를 수 없게 바뀌었어요 — ${r.msg}. 그 회사 키로는 만들 수 없게 되니 ai.js와 안내를 살펴 주세요.`);
      else if (r.level === 'unknown') notes.push(`${t.name} CORS 확인 못 함: ${r.msg}`);
    }
    const links = await Promise.all(facts.urls.map(async (u) => ({ u, r: await checkLink(fetchFn, u) })));
    for (const { u, r } of links) {
      if (r.level === 'bad') problems.push(`앱이 여는 주소가 열리지 않아요(${r.msg}): ${u}. ai.js의 PROVIDERS·CHATBOTS 주소와 키 안내(ai-guides.jsx)를 고쳐 주세요.`);
      else if (r.level === 'unknown') notes.push(`주소 확인 못 함 ${u}: ${r.msg}`);
    }
  } else notes.push('주소·CORS 점검을 건너뛰었어요(--no-check).');

  const c = countModels(view.models || []);
  const report = renderReport({ status, today, counts: { ...c, free: (view.free || []).length }, sources: ok, kept, recs, geminiFree: view.geminiFree, problems, notes, rejected: errs });
  return { status, catalog: final || catalog, text, report: report.text, digest: report.digest, problems, notes, errors: errs };
}

// ── 명령줄 ──
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : ''; };
  try {
    const r = await run({ check: !args.includes('--no-check'), write: !args.includes('--dry') });
    console.log(r.report);
    if (opt('--report')) writeFileSync(opt('--report'), r.report);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `status=${r.status}\nproblems=${r.problems.length}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, r.report);
  } catch (e) {
    console.error('AI 정보 갱신이 멈췄어요:', e?.stack || e);
    process.exit(2);
  }
}
