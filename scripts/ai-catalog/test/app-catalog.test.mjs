// 앱 쪽 시험: 값표를 읽는 순서(같은 출처 → 실시간 → 이름), 등급·추천(rankModels), 지금 올라가는 ai-catalog.json
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalogLoader, fromFile, fromOpenRouter, rankModels, CATALOG_FILE, OR_MODELS } from '../../../app/src/lib/ai-catalog.js';
import { validateCatalog, simulateRecs } from '../lib.mjs';

const root = new URL('../../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const NOW = Date.parse('2026-11-14T03:00:00Z');
const FILE = {
  schema: 1, updated: '2026-11-13',
  models: [
    { id: 'openai/gpt-6.1-sol', in: 2, out: 10, date: '2026-09-29', text: true, ctx: 400000, src: 'or' },
    { id: 'openai/gpt-6-luna', in: 0.1, out: 0.5, date: '2026-09-22', text: true, ctx: 400000, src: 'or' },
    { id: 'anthropic/claude-opus-5.5', in: 4, out: 20, date: '2026-09-22', text: true, ctx: 1000000, src: 'or' },
    { id: 'anthropic/claude-sonnet-5.5', in: 2, out: 10, date: '2026-09-28', text: true, ctx: 1000000, src: 'or' },
    { id: 'anthropic/claude-mythos-6', in: 10, out: 50, date: '2026-11-10', text: true, ctx: 1000000, src: 'or' },
    { id: 'openai/gpt-6.2-sol', in: 2, out: 10, date: '2026-11-10', text: true, ctx: 400000, src: 'or' },
    { id: 'openai/gpt-image-3', in: 5, out: 40, date: '2026-10-06', text: false, ctx: 65536, src: 'or' },
    { id: 'bad id', in: 1, out: 1 }, { id: 'openai/neg', in: -1, out: 1 },
  ],
};
const LIVE = { data: [
  { id: 'openai/gpt-6.1-sol', created: 1790000000, pricing: { prompt: '0.000003', completion: '0.000015' }, architecture: { output_modalities: ['text'] } },
  { id: 'openai/gpt-7-sol', created: 1794000000, pricing: { prompt: '0.000002', completion: '0.00001' }, architecture: { output_modalities: ['text'] } },
  { id: 'openai/gpt-7-sol:batch', created: 1794000000, pricing: { prompt: '0.000001', completion: '0.000005' } },
] };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const later = (ms, v) => new Promise((res) => setTimeout(() => res(v), ms));
function net({ file = FILE, live = LIVE, fileMs = 0, liveMs = 0, fileFail = false, liveFail = false } = {}) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    if (url === CATALOG_FILE) { await later(fileMs); if (fileFail) throw new TypeError('fetch failed'); return json(file); }
    if (url === OR_MODELS) { await later(liveMs); if (liveFail) throw new TypeError('fetch failed'); return json(live); }
    throw new Error('unexpected ' + url);
  };
  fn.calls = calls;
  return fn;
}
const names = (rows) => rows.map((r) => r.id);

test('읽는 순서: 같은 출처 파일 → 실시간 목록이 덮어씀', async () => {
  const load = catalogLoader({ fetchFn: net(), grace: 200 });
  const c = await load();
  assert.deepEqual(c.from, ['file', 'live']);
  assert.equal(c.map.get('openai/gpt-6-1-sol').out, 15, '실시간 값이 파일 값을 덮어씀');
  assert.ok(c.map.has('openai/gpt-7-sol'), '실시간에만 있는 모델');
  assert.ok(!c.map.has('openai/gpt-7-sol:batch'));
  assert.ok(c.map.has('anthropic/claude-opus-5-5'), '파일에만 있는 모델도 남음');
  assert.equal(await load(), c, '한 번 읽으면 다시 씀');
});

test('실시간 목록이 늦으면 파일로 먼저 답하고, 다음 호출부터 실시간 값', async () => {
  const fetchFn = net({ liveMs: 120 });
  const load = catalogLoader({ fetchFn, grace: 20 });
  const first = await load();
  assert.deepEqual(first.from, ['file']);
  assert.equal(first.map.get('openai/gpt-6-1-sol').out, 10);
  await later(200);
  const second = await load();
  assert.deepEqual(second.from, ['file', 'live']);
  assert.equal(second.map.get('openai/gpt-6-1-sol').out, 15);
  assert.equal(fetchFn.calls.length, 2, '다시 받지 않음');
});

test('파일이 없으면 실시간 목록만, 둘 다 없으면 빈 값표(이름 규칙)이고 다음에 다시 받음', async () => {
  const onlyLive = await catalogLoader({ fetchFn: net({ fileFail: true }), grace: 10 })();
  assert.deepEqual(onlyLive.from, ['live']);
  const fetchFn = net({ fileFail: true, liveFail: true });
  const load = catalogLoader({ fetchFn, grace: 10 });
  const none = await load();
  assert.equal(none.map.size, 0);
  assert.deepEqual(none.from, []);
  await load();
  assert.equal(fetchFn.calls.length, 4, '둘 다 실패하면 다음 호출에 다시 받음');
  // 파일 모양이 다르면 없는 것으로
  const odd = await catalogLoader({ fetchFn: net({ file: { schema: 2 }, liveFail: true }), grace: 10 })();
  assert.equal(odd.map.size, 0);
});

test('fromFile: 모양이 틀린 줄은 버림, 예전 파일의 Gemini·무료 칸은 읽지 않음', () => {
  const c = fromFile({ ...FILE, free: [{ id: 'google/gemma-4-31b-it:free', date: '2026-04-02', text: true }], geminiFree: { free: ['x'], paidOnly: [] } });
  assert.ok(!c.map.has('bad id') && !c.map.has('openai/neg'));
  assert.ok(!c.map.has('google/gemma-4-31b-it:free'));
  assert.equal(c.map.get('openai/gpt-image-3').text, false);
  assert.deepEqual(Object.keys(c).sort(), ['map', 'updated']);
  assert.equal(fromFile(null), null);
  assert.equal(fromFile({ schema: 1, models: 'x' }), null);
  assert.equal(fromOpenRouter({}).size, 0);
});

const OPENAI = ['gpt-6.1-sol', 'gpt-6-luna', 'gpt-6.1-sol-pro', 'gpt-realtime-2', 'text-embedding-4'].map((id) => ({ id }));
const CLAUDE = ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5'].map((id) => ({ id }));

test('값표가 없으면 이름 규칙(마지막 안전망)', () => {
  const o = rankModels('openai', OPENAI, { now: NOW });
  assert.deepEqual(names(o), ['gpt-6.1-sol', 'gpt-6-luna'], '-pro·음성·임베딩은 뺌');
  assert.equal(o[0].rec && o[0].tier, 2);
  assert.equal(rankModels('anthropic', CLAUDE, { now: NOW })[0].id, 'claude-opus-5-5', 'Opus를 앞에');
});

test('값표가 있으면 값·출시일로, 값표에 없는 모델에 이름 규칙을 쓰지 않음', () => {
  const cat = fromFile(FILE);
  const o = rankModels('openai', [...OPENAI, { id: 'gpt-6.2-sol' }, { id: 'gpt-image-3' }, { id: 'gpt-6-nova' }], { cat, now: NOW });
  assert.equal(o[0].id, 'gpt-6.1-sol', '고품질에서 가장 새 모델, 나온 지 2주가 안 된 6.2는 뒤로');
  assert.equal(rankModels('openai', [...OPENAI, { id: 'gpt-6.2-sol' }], { cat, now: Date.parse('2026-11-27T00:00:00Z') })[0].id, 'gpt-6.2-sol');
  assert.ok(!o.some((r) => r.locked), '실패한 적이 없으면 잠그지 않음');
  assert.ok(!names(o).includes('gpt-image-3'), '그림만 내는 모델은 뺌');
  assert.equal(o.find((r) => r.id === 'gpt-6-nova').tier, 1, '값표에 없는 모델은 표준(이름으로 어림하지 않음)');
  assert.equal(o.find((r) => r.id === 'gpt-6.1-sol').won, 220);
  assert.equal(rankModels('anthropic', CLAUDE, { cat, now: NOW })[0].id, 'claude-opus-5-5', '최상위(Mythos)가 아니라 고품질 Opus를 추천');
  // 실패 기억: 이 키로 안 된 모델은 잠그고 다음 모델을 추천
  const b = rankModels('openai', OPENAI, { cat, blocked: ['gpt-6.1-sol'], now: NOW });
  assert.ok(b.find((r) => r.id === 'gpt-6.1-sol').locked);
  assert.notEqual(b[0].id, 'gpt-6.1-sol');
});

test('지금 올라가는 ai-catalog.json: 검사 통과, 앱이 읽고 회사마다 추천이 나옴', () => {
  const text = read('app/public/ai-catalog.json');
  const j = JSON.parse(text);
  assert.ok(Buffer.byteLength(text) < 96 * 1024);
  assert.deepEqual(validateCatalog(j, null, new Date().toISOString().slice(0, 10)), []);
  const c = fromFile(j);
  assert.ok(c.map.size >= 30);
  assert.ok(!j.models.some((m) => !/^(openai|anthropic)\//.test(m.id)) && !('geminiFree' in j) && !('free' in j), '만들기에 쓰는 두 회사 값만');
  const r = simulateRecs(j);
  for (const k of ['openai', 'anthropic']) assert.ok(r[k], k);
});

test('ai-catalog.json을 오래 붙잡지 않음: 서비스 워커는 해시 붙은 빌드 자산만 캐시 우선, 헤더는 no-cache', () => {
  const sw = read('app/public/sw.js');
  assert.match(sw, /u\.pathname\.startsWith\(scope \+ 'assets\/'\) && \/-\[\\w-\]\{8,\}\\\.\\w\+\$\/\.test\(u\.pathname\)/);
  assert.ok(!/ai-catalog/.test(sw));
  assert.match(read('app/public/_headers'), /\/ai-catalog\.json\n {2}Cache-Control: no-cache/);
  assert.match(read('app/src/lib/ai.js'), /catalogLoader\(\)/);
});
