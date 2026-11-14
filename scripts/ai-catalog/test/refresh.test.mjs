// AI 값표 갱신 스크립트 시험: 저장해 둔 표본(fixtures, 실제 응답과 같은 모양)으로 네트워크 없이
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseOpenRouter, parseModelsDev, mergeModels, parseGooglePricing, parseGoogleModels, buildCatalog, validateCatalog, serialize, sameData,
  scanNames, missingNames, simulateRecs, preflight, checkLink, appUrls, renderReport, SOURCES, CORS_TARGETS,
} from '../lib.mjs';
import { run } from '../refresh.mjs';

const FX = new URL('./fixtures/', import.meta.url);
const raw = (n) => readFileSync(new URL(n, FX), 'utf8');
const TODAY = '2026-11-14';
const NOW = new Date('2026-11-14T03:00:00Z');
const OR = JSON.parse(raw('openrouter.json'));
const MD = JSON.parse(raw('modelsdev.json'));
const GP = raw('google-pricing.md');
const GM = raw('google-models.md');
const got = () => ({ or: parseOpenRouter(OR, TODAY), md: parseModelsDev(MD, TODAY), pricing: parseGooglePricing(GP), docs: parseGoogleModels(GM) });
const good = () => buildCatalog(got(), null, TODAY).catalog;

test('OpenRouter: 큰 세 회사 모델과 무료 모델만, 변형·이상한 줄은 뺌', () => {
  const r = parseOpenRouter(OR, TODAY);
  const ids = r.models.map((m) => m.id);
  assert.ok(ids.includes('openai/gpt-6.1-sol') && ids.includes('anthropic/claude-opus-5.5') && ids.includes('google/gemini-4-hydrogen'));
  assert.ok(!ids.some((x) => x.includes(':')), ':batch 변형은 빠짐');
  assert.ok(!ids.includes('openrouter/auto'), '큰 세 회사가 아니고 값이 -1');
  assert.deepEqual(r.free.map((m) => m.id).sort(), ['google/gemma-4-31b-it:free', 'meta-llama/llama-5-70b:free']);
  assert.equal(r.dropped, 2, '대문자·빈칸 id, 숫자가 아닌 값');
  const sol = r.models.find((m) => m.id === 'openai/gpt-6.1-sol');
  assert.deepEqual(sol, { id: 'openai/gpt-6.1-sol', in: 2, out: 10, date: '2026-09-29', text: true, ctx: 400000, src: 'or' });
  assert.equal(r.models.find((m) => m.id === 'google/gemini-3.8-flash').in, 0.83, '값은 소수 넷째 자리까지');
  assert.equal(r.models.find((m) => m.id === 'openai/gpt-5-image').text, false, '그림을 내는 모델은 text:false');
  assert.ok(!JSON.stringify(r).includes('<b>'), '설명 글(HTML)은 담지 않음');
  assert.throws(() => parseOpenRouter({ models: [] }, TODAY), /data 배열/);
});

test('models.dev: 값이 있는 모델만, OpenRouter에 이미 있는 모델은 OpenRouter 값으로', () => {
  const md = parseModelsDev(MD, TODAY);
  assert.ok(md.models.every((m) => m.src === 'md'));
  assert.ok(!md.models.some((m) => m.id.includes('gpt-nocost') || m.id.startsWith('somebody/')));
  const merged = mergeModels(parseOpenRouter(OR, TODAY).models, md.models);
  const opus = merged.filter((m) => /claude-opus-5[.-]5/.test(m.id));
  assert.equal(opus.length, 1, 'claude-opus-5.5와 claude-opus-5-5는 같은 모델');
  assert.equal(opus[0].src, 'or');
  assert.ok(merged.some((m) => m.id === 'openai/o9-mini' && m.src === 'md'), 'OpenRouter에 없는 모델은 models.dev에서');
  assert.deepEqual(merged.map((m) => m.id), [...merged.map((m) => m.id)].sort(), 'id 순서');
});

test('Gemini 가격표: 무료 등급 칸으로 무료·유료 전용을 가림(Markdoc 표·옛 파이프 표·여러 코드 한 절)', () => {
  const p = parseGooglePricing(GP);
  assert.deepEqual(p.free, ['gemini-3.1-flash-live-preview', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.8-live', 'gemini-4-hydrogen']);
  assert.deepEqual(p.paidOnly, ['gemini-3.1-pro-preview', 'gemini-3.1-pro-preview-customtools', 'gemini-4-carbon']);
  assert.deepEqual(p.unknown, ['gemini-mystery-1'], '읽지 못한 칸은 어느 쪽에도 넣지 않음');
  assert.deepEqual(parseGooglePricing('# nothing here\n'), { free: [], paidOnly: [], unknown: [] });
});

test('Gemini 모델 문서: 지금 모델·옛 모델(폐기 예정·써 본 사용자만)·종료', () => {
  const d = parseGoogleModels(GM);
  assert.deepEqual(d.current, ['gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-4-argon', 'gemini-4-carbon', 'gemini-4-hydrogen']);
  assert.deepEqual(d.legacy, ['gemini-2.5-flash-lite', 'gemini-2.5-pro']);
  assert.deepEqual(d.previous, ['gemini-2.0-flash', 'imagen-4.0-generate']);
});

test('새 판: 검사 통과·한 줄에 모델 하나·같은 내용이면 같은 글', () => {
  const c = good();
  assert.deepEqual(validateCatalog(c, null, TODAY), []);
  const text = serialize(c);
  assert.ok(text.length < 20000);
  assert.ok(/\n {4}\{"id":"anthropic\/claude-fable-5\.2",/.test(text));
  assert.deepEqual(JSON.parse(text).geminiFree.paidOnly, ['gemini-3.1-pro-preview', 'gemini-3.1-pro-preview-customtools', 'gemini-4-carbon']);
  assert.ok(sameData(c, { ...JSON.parse(text), updated: '2020-01-01' }), 'updated만 다르면 같은 내용');
  assert.equal(serialize(JSON.parse(text)), text);
});

test('검사: 깨진 자료는 거부', () => {
  const base = good();
  const bad = (f) => { const c = JSON.parse(serialize(base)); f(c); return validateCatalog(c, null, TODAY); };
  assert.match(bad((c) => { c.models = 'x'; }).join(), /models 배열/);
  assert.match(bad((c) => { c.models[0].in = -1; }).join(), /모양이 이상/);
  assert.match(bad((c) => { c.models[0].out = 5000; }).join(), /모양이 이상/);
  assert.match(bad((c) => { c.models[0].id = 'openai/<script>'; }).join(), /모양이 이상/);
  assert.match(bad((c) => { c.models[0].date = '2099-01-01'; }).join(), /모양이 이상/);
  assert.match(bad((c) => { c.models.push({ ...c.models[0] }); }).join(), /두 번/);
  assert.match(bad((c) => { c.models = c.models.filter((m) => !m.id.startsWith('anthropic/')); }).join(), /anthropic 모델이 0개/);
  assert.match(bad((c) => { c.geminiFree.free = ['gemini-4-hydrogen']; }).join(), /무료 등급 모델이 1개/);
  assert.match(bad((c) => { c.geminiFree.free.push('gemini-4-carbon'); }).join(), /같은 모델/);
  assert.match(bad((c) => { c.geminiDocs = { current: [] }; }).join(), /모델 문서/);
  assert.match(bad((c) => { c.schema = 2; }).join(), /schema/);
});

test('검사: 한 번에 30% 넘게 사라지면 거부(급감)', () => {
  const prev = good();
  const now = JSON.parse(serialize(prev));
  const openai = now.models.filter((m) => m.id.startsWith('openai/'));
  const drop = new Set(openai.slice(0, Math.ceil(openai.length * 0.4)).map((m) => m.id));
  now.models = now.models.filter((m) => !drop.has(m.id));
  // 최소 수 검사와 섞이지 않게 기준을 넘는 수만 남김
  const errs = validateCatalog(now, prev, TODAY).join(' / ');
  assert.match(errs, /openai 모델 \d+개 중 \d+개가 한 번에 사라졌어요/);
  // 조금(1개) 사라지는 것은 통과
  const small = JSON.parse(serialize(prev));
  small.models = small.models.filter((m) => m.id !== 'openai/gpt-4o');
  assert.ok(!/사라졌어요/.test(validateCatalog(small, prev, TODAY).join()));
  // Gemini 무료 목록이 반 넘게 사라져도 거부
  const g = JSON.parse(serialize(prev));
  g.geminiFree.free = ['gemini-4-hydrogen', 'gemini-new-1'];
  assert.match(validateCatalog(g, prev, TODAY).join(), /한 번에 사라졌어요/);
});

test('못 받은 출처는 앞 판의 그 몫을 그대로(하루 끊겨도 모델이 사라지지 않음)', () => {
  const prev = good();
  const { catalog, kept } = buildCatalog({ md: parseModelsDev(MD, TODAY), docs: parseGoogleModels(GM) }, prev, TODAY);
  assert.deepEqual(kept, ['OpenRouter 모델', 'Gemini 무료 등급']);
  assert.ok(sameData(catalog, prev));
  // 가격표를 받았지만 표가 깨짐(무료 0개) → 그 칸만 앞 판
  const broken = buildCatalog({ ...got(), pricing: { free: [], paidOnly: [], unknown: [] } }, prev, TODAY);
  assert.deepEqual(broken.kept, ['Gemini 무료 등급']);
  assert.deepEqual(broken.catalog.geminiFree, prev.geminiFree);
});

test('이름 점검: id와 화면 이름(가운뎃점 목록 포함)을 찾고, 목록에 없는 것만 알림', () => {
  const found = scanNames([
    { path: 'a.jsx', text: 'Gemini 4 Carbon·Argon은 결제한 키만. 무료는 Gemini 3.8 Flash까지.\n// GPT-6.1 Sol·Terra·GPT-6 Luna, Claude Fable 5.2·Opus 5.5\n' },
    { path: 'b.js', text: "const x = 'gemini-9-zircon'; // 새 모델\nconst y = 'claude-opus-4-1'; // ai-catalog-ok: 일부러 옛 이름\nGemini 4는 이름이 바뀜" },
  ]);
  const ids = found.map((f) => f.id);
  for (const id of ['gemini-4-carbon', 'gemini-4-argon', 'gemini-3.8-flash', 'gpt-6.1-sol', 'gpt-6.1-terra', 'gpt-6-luna', 'claude-fable-5.2', 'claude-opus-5.5', 'gemini-9-zircon']) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes('claude-opus-4-1'), 'ai-catalog-ok 줄은 건너뜀');
  const miss = missingNames(found, good());
  assert.deepEqual(miss.map((m) => m.id), ['gemini-9-zircon']);
  assert.deepEqual(miss[0].where, ['b.js:1']);
});

test('추천 어림: 앱과 같은 규칙(rankModels)으로', () => {
  const r = simulateRecs(good(), NOW.getTime());
  assert.equal(r.openai, 'gpt-6.1-sol');
  assert.equal(r.anthropic, 'claude-opus-5.5');
  assert.equal(r.gemini, 'gemini-4-argon', 'Carbon은 나온 지 2주가 안 됨');
  assert.equal(r.geminiFree, 'gemini-3.8-flash', '무료 등급 목록 안에서, Hydrogen은 2주가 안 됨');
  assert.equal(simulateRecs(good(), Date.parse('2026-11-27T00:00:00Z')).geminiFree, 'gemini-4-hydrogen');
});

// ── 주소·CORS ──
const res = (status, headers = {}) => new Response(status === 204 || (status >= 300 && status < 400) ? null : 'x', { status, headers });
test('CORS 사전 요청: 허용 출처·머리글을 봄. *는 authorization을 덮지 않음', async () => {
  const t = { url: 'https://api.example/v1', method: 'POST', headers: ['authorization', 'content-type'] };
  const ok = await preflight(async () => res(204, { 'access-control-allow-origin': 'https://lecpage.com', 'access-control-allow-headers': 'authorization, content-type' }), t);
  assert.equal(ok.level, 'ok');
  assert.equal((await preflight(async () => res(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }), t)).level, 'bad');
  assert.equal((await preflight(async () => res(204, { 'access-control-allow-headers': 'authorization,content-type' }), t)).level, 'bad', '허용 출처 없음');
  assert.equal((await preflight(async () => res(403), t)).level, 'bad');
  assert.equal((await preflight(async () => res(503), t)).level, 'unknown');
  assert.equal((await preflight(async () => { throw new TypeError('fetch failed'); }, t)).level, 'unknown');
});
test('주소 점검: 200·로그인 화면은 ok, 404는 bad, 봇 막기는 unknown', async () => {
  const seq = (list) => { let i = 0; return async () => list[i++]; };
  assert.equal((await checkLink(seq([res(302, { location: 'https://accounts.example/ServiceLogin?x=1' }), res(200)]), 'https://a.example/key')).level, 'ok');
  assert.equal((await checkLink(seq([res(404)]), 'https://a.example/key')).level, 'bad');
  assert.equal((await checkLink(seq([res(403, { 'cf-mitigated': 'challenge' })]), 'https://a.example/key')).level, 'unknown');
  assert.deepEqual(appUrls("keyUrl: 'https://k.example/keys', billingUrl: 'https://k.example/billing' url: 'https://chat.example/'"), ['https://k.example/keys', 'https://k.example/billing', 'https://chat.example/']);
});

// ── 한 번 돌리기(흉내 응답) ──
function fakeNet({ or = OR, orStatus = 200, cors = 'ok', link = 200, fail = [] } = {}) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push(`${init.method || 'GET'} ${url}`);
    if (fail.some((f) => url.includes(f))) throw new TypeError('fetch failed');
    if (init.method === 'OPTIONS') return cors === 'ok' ? res(204, { 'access-control-allow-origin': 'https://lecpage.com', 'access-control-allow-headers': CORS_TARGETS.flatMap((t) => t.headers).join(',') }) : res(204, {});
    const body = url === SOURCES.openrouter ? (orStatus === 200 ? JSON.stringify(or) : 'no') : url === SOURCES.modelsdev ? JSON.stringify(MD) : url === SOURCES.googlePricing[0] ? GP : url === SOURCES.googleModels[0] ? GM : null;
    if (body !== null) { const r = new Response(body, { status: url === SOURCES.openrouter ? orStatus : 200, headers: { 'access-control-allow-origin': '*' } }); return r; }
    return res(link);
  };
  fn.calls = calls;
  return fn;
}
const repo = (extra = '') => ({ files: [{ path: 'app/src/x.jsx', text: `Gemini 4 Carbon·Argon은 결제한 키만 돼요. ${extra}` }], urls: ['https://aistudio.example/apikey'] });

test('run: 처음 → 갱신함, 같은 자료로 다시 → 바뀐 것 없음(문제 0)', async () => {
  const a = await run({ fetchFn: fakeNet(), repo: repo(), prevText: '', now: NOW, write: false, pause: 1 });
  assert.equal(a.status, 'updated');
  assert.deepEqual(a.problems, []);
  assert.match(a.report, /결과: 갱신함/);
  assert.match(a.report, /ai-catalog-digest: [0-9a-f]{16}/);
  const b = await run({ fetchFn: fakeNet(), repo: repo(), prevText: a.text, now: new Date('2026-11-15T03:00:00Z'), write: false, pause: 1 });
  assert.equal(b.status, 'unchanged');
  assert.equal(b.text, a.text, '바뀐 것이 없으면 updated 날짜도 그대로');
  assert.deepEqual(b.problems, []);
});

test('run: 급감 자료는 거부하고 파일은 그대로, 사람이 볼 일로', async () => {
  const a = await run({ fetchFn: fakeNet(), repo: repo(), prevText: '', now: NOW, write: false, pause: 1 });
  const shrunk = { data: OR.data.filter((x) => !/^anthropic\/claude-(opus|sonnet)/.test(x.id)) };
  const b = await run({ fetchFn: fakeNet({ or: shrunk }), repo: repo(), prevText: a.text, now: NOW, write: false, pause: 1 });
  assert.equal(b.status, 'rejected');
  assert.equal(b.text, a.text);
  assert.ok(b.problems.some((p) => /바꾸지 않았어요/.test(p)));
  assert.match(b.report, /갱신을 거부한 까닭[\s\S]*anthropic 모델/);
});

test('run: 받기 실패 — 연결 실패는 참고, 404는 사람이 볼 일. 앞 판 값 유지', async () => {
  const a = await run({ fetchFn: fakeNet(), repo: repo(), prevText: '', now: NOW, write: false, pause: 1 });
  const net = await run({ fetchFn: fakeNet({ fail: ['openrouter.ai/api/v1/models'] }), repo: repo(), prevText: a.text, now: NOW, write: false, pause: 1 });
  assert.equal(net.status, 'unchanged');
  assert.deepEqual(net.problems, []);
  assert.ok(net.notes.some((n) => /OpenRouter 모델 목록을 받지 못했어요/.test(n)));
  const gone = await run({ fetchFn: fakeNet({ orStatus: 404 }), repo: repo(), prevText: a.text, now: NOW, write: false, pause: 1 });
  assert.ok(gone.problems.some((p) => /OpenRouter 모델 목록을 받지 못했어요\(404\)/.test(p)));
});

test('run: 이름·CORS·주소 점검이 어긋나면 사람이 볼 일로(같은 문제면 digest가 같음)', async () => {
  const a = await run({ fetchFn: fakeNet({ cors: 'bad', link: 404 }), repo: repo('새 모델 gemini-9-zircon'), prevText: '', now: NOW, write: false, pause: 1 });
  assert.ok(a.problems.some((p) => /gemini-9-zircon/.test(p)));
  assert.ok(a.problems.some((p) => /Claude 만들기.*허용 출처가 없음/.test(p)));
  assert.ok(a.problems.some((p) => /열리지 않아요\(404\): https:\/\/aistudio\.example\/apikey/.test(p)));
  const b = await run({ fetchFn: fakeNet({ cors: 'bad', link: 404 }), repo: repo('새 모델 gemini-9-zircon'), prevText: '', now: NOW, write: false, pause: 1 });
  assert.equal(a.digest, b.digest);
  const blocked = await run({ fetchFn: fakeNet({ link: 403 }), repo: repo(), prevText: '', now: NOW, write: false, pause: 1 });
  assert.deepEqual(blocked.problems, [], '봇 막기(403)는 참고로만');
});

test('run: 추천·Gemini 무료 목록이 바뀌면 한 번 알림', async () => {
  const a = await run({ fetchFn: fakeNet(), repo: repo(), prevText: '', now: NOW, write: false, pause: 1 });
  const prev = JSON.parse(a.text);
  prev.geminiFree.free = prev.geminiFree.free.filter((c) => c !== 'gemini-3.8-live');
  const b = await run({ fetchFn: fakeNet(), repo: repo(), prevText: serialize(prev), now: new Date('2026-11-26T12:00:00Z'), write: false, pause: 1 });
  assert.ok(b.problems.some((p) => /Gemini 무료 키 추천이 바뀌었어요: gemini-3\.8-flash → gemini-4-hydrogen/.test(p)), b.problems.join('\n'));
  assert.ok(b.problems.some((p) => /Gemini 무료 등급 목록이 바뀌었어요\(무료 \+gemini-3\.8-live/.test(p)));
});

test('보고서: 문제가 없으면 사람이 볼 일 칸이 없음', () => {
  const r = renderReport({ status: 'unchanged', today: TODAY, counts: { openai: 1, anthropic: 1, google: 1, free: 0 }, sources: {}, kept: [], recs: {}, geminiFree: null, problems: [], notes: [] });
  assert.ok(!/사람이 볼 일/.test(r.text));
});
