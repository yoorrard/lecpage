import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpError, ERRORS, json, readJson, corsHeaders, preflight, errorFrom, withHeaders } from '../src/http.js';
import { config, DEFAULTS, expiryFrom } from '../src/config.js';

test('오류 모양: { error: { code, message_ko } } + 알맞은 상태 코드', async () => {
  const want = { bad_request: 400, unauthorized: 401, not_found: 404, too_large: 413, too_many_files: 413, bad_path: 400, bad_type: 415, runtime_mismatch: 422, rate_limited: 429, full: 507, blocked: 403, missing_blobs: 409, code_taken: 409 };
  assert.deepEqual(Object.keys(ERRORS).sort(), Object.keys(want).sort());
  for (const [code, status] of Object.entries(want)) {
    const r = new HttpError(code).toResponse();
    assert.equal(r.status, status, code);
    assert.equal(r.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    const j = await r.json();
    assert.deepEqual(Object.keys(j), ['error']);
    assert.equal(j.error.code, code);
    assert.ok(typeof j.error.message_ko === 'string' && /[가-힣]/.test(j.error.message_ko), code);
  }
  const r = new HttpError('missing_blobs', undefined, { missing: ['a'] }).toResponse();
  assert.deepEqual((await r.json()).error.missing, ['a']);
  const limited = new HttpError('rate_limited', '잠깐만요', { headers: { 'retry-after': '30' } }).toResponse();
  assert.equal(limited.headers.get('retry-after'), '30');
  assert.equal((await limited.json()).error.message_ko, '잠깐만요');
  const back = await errorFrom(new HttpError('too_large', '커요', { path: 'a.png', headers: { 'retry-after': '5' } }).toResponse());
  assert.equal(back.code, 'too_large'); assert.equal(back.status, 413); assert.equal(back.message, '커요'); assert.equal(back.extra.path, 'a.png'); assert.equal(back.headers['retry-after'], '5');
  assert.equal((await errorFrom(new Response('oops', { status: 500 }))).code, 'bad_request');
});

test('CORS: 허용한 출처만 되돌려 줌', () => {
  const allowed = config({}).origins;
  assert.deepEqual([...allowed], ['https://yoorrard.github.io', 'http://localhost:5173', 'http://localhost:4173']);
  const ok = corsHeaders('https://yoorrard.github.io', allowed);
  assert.equal(ok['access-control-allow-origin'], 'https://yoorrard.github.io');
  assert.equal(ok.vary, 'Origin');
  for (const o of ['https://evil.example', 'https://yoorrard.github.io.evil.example', 'http://yoorrard.github.io', 'null', '', null]) {
    assert.equal(corsHeaders(o, allowed)['access-control-allow-origin'], undefined, String(o));
  }
  const pre = preflight('http://localhost:5173', allowed);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal(pre.headers.get('access-control-allow-methods'), 'GET,POST,PUT,DELETE,OPTIONS');
  assert.equal(pre.headers.get('access-control-allow-headers'), 'authorization,content-type');
  assert.equal(pre.headers.get('access-control-max-age'), '86400');
  const no = preflight('https://evil.example', allowed);
  assert.equal(no.headers.get('access-control-allow-origin'), null);
  assert.equal(no.headers.get('access-control-allow-methods'), null);
  const custom = config({ ALLOWED_ORIGINS: ' https://lecpage.com/ , https://app.example ' }).origins;
  assert.deepEqual([...custom], ['https://lecpage.com', 'https://app.example']);
});

test('본문 읽기: 크기 제한, JSON 객체만', async () => {
  const req = (body, headers = {}) => new Request('http://x/', { method: 'POST', body, headers });
  assert.deepEqual(await readJson(req('{"a":1}')), { a: 1 });
  assert.deepEqual(await readJson(req(''), 100, { optional: true }), {});
  for (const bad of ['', 'x', '[1]', '"s"', '1', 'null', '{"a":']) await assert.rejects(() => readJson(req(bad)), (e) => e.code === 'bad_request', bad);
  await assert.rejects(() => readJson(req('{"a":"' + 'x'.repeat(200) + '"}'), 100), (e) => e.code === 'too_large');
  await assert.rejects(() => readJson(req(new Uint8Array([0x7b, 0xff, 0x7d]))), (e) => e.code === 'bad_request');
  const r = withHeaders(json({ ok: true }, 201), { 'x-test': '1' });
  assert.equal(r.status, 201); assert.equal(r.headers.get('x-test'), '1'); assert.deepEqual(await r.json(), { ok: true });
});

test('설정: 기본값과 환경 변수', () => {
  const d = config({});
  assert.equal(d.maxBytes, 40 * 1024 * 1024);
  assert.equal(d.maxFileBytes, 20 * 1024 * 1024);
  assert.equal(d.maxFiles, 600);
  assert.equal(d.days, 30);
  assert.equal(d.sitesPerHour, 6);
  assert.equal(d.sitesPerDay, 20);
  assert.equal(d.dailySiteCap, 30);
  assert.equal(d.maxTotalBytes, 4 * 1024 * 1024 * 1024);
  assert.equal(d.adminKey, '');
  assert.equal(d.reportWebhook, '');
  assert.equal(d.allowSupabaseSdk, false);
  const c = config({ MAX_BYTES: '1000', MAX_FILES: 5, SITE_DAYS: '7', SITES_PER_HOUR: 'abc', DAILY_SITE_CAP: '-1', MAX_TOTAL_BYTES: '', ADMIN_KEY: ' k ', REPORT_WEBHOOK: 'http://insecure.example/x', PUBLIC_ORIGIN: 'https://sites.example.com/path', ALLOW_SUPABASE_SDK: '1' });
  assert.equal(c.maxBytes, 1000); assert.equal(c.maxFiles, 5); assert.equal(c.days, 7);
  assert.equal(c.sitesPerHour, DEFAULTS.SITES_PER_HOUR, '숫자가 아니면 기본값');
  assert.equal(c.dailySiteCap, DEFAULTS.DAILY_SITE_CAP, '0 이하면 기본값');
  assert.equal(c.maxTotalBytes, DEFAULTS.MAX_TOTAL_BYTES);
  assert.equal(c.adminKey, 'k');
  assert.equal(c.reportWebhook, '', 'https만');
  assert.equal(c.publicOrigin, 'https://sites.example.com');
  assert.equal(c.allowSupabaseSdk, true);
  assert.equal(config({ REPORT_WEBHOOK: 'https://hooks.example/x' }).reportWebhook, 'https://hooks.example/x');
  assert.equal(expiryFrom(1000, 30), 1000 + 30 * 86400000);
});
