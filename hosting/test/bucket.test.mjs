import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeSql } from './fake-do.mjs';
import { SqlBucket, CHUNK } from '../src/live/bucket.js';

const bytes = (n, seed = 1) => { const u = new Uint8Array(n); let x = seed; for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; u[i] = x & 255; } return u; };
const read = async (obj) => new Uint8Array(await new Response(obj.body).arrayBuffer());
const make = (opts = {}) => { const sql = fakeSql(); return { sql, b: new SqlBucket(sql, { maxObjectBytes: 10 * CHUNK, maxTotalBytes: 20 * CHUNK, tx: sql.tx, ...opts }) }; };

test('표는 처음 올릴 때만 생김: 읽기·지우기·목록은 아무것도 쓰지 않음', async () => {
  const { sql, b } = make();
  assert.equal(await b.get('AB12CD/x.png'), null);
  await b.delete('AB12CD/x.png');
  await b.delete(['a', 'b']);
  assert.deepEqual(await b.list({ prefix: 'AB12CD/' }), { objects: [], truncated: false });
  assert.deepEqual(b.usage(), { count: 0, bytes: 0 });
  assert.deepEqual(sql.tables(), []);
  assert.equal(sql.writes, 0);
  await b.put('AB12CD/x.png', bytes(10));
  assert.deepEqual(sql.tables(), ['host_file']);
});

test('올리고 받기: 한 줄짜리, 여러 줄짜리, 형식·크기·etag', async () => {
  const { b } = make();
  const small = bytes(1234, 7); const big = bytes(2 * CHUNK + 4321, 9);
  const p = await b.put('AB12CD/aaaaaaaaaaaaaaaaaaaaaaaa.png', small, { httpMetadata: { contentType: 'image/png' } });
  assert.equal(p.size, 1234);
  assert.match(p.httpEtag, /^"[0-9a-f]{32}"$/);
  await b.put('AB12CD/bbbbbbbbbbbbbbbbbbbbbbbb.mp4', big, { httpMetadata: { contentType: 'video/mp4' } });
  const g = await b.get('AB12CD/aaaaaaaaaaaaaaaaaaaaaaaa.png');
  assert.equal(g.size, 1234); assert.equal(g.httpMetadata.contentType, 'image/png'); assert.equal(g.httpEtag, p.httpEtag); assert.equal(g.range, undefined);
  assert.deepEqual(await read(g), small);
  const g2 = await b.get('AB12CD/bbbbbbbbbbbbbbbbbbbbbbbb.mp4');
  assert.equal(g2.size, big.length);
  assert.deepEqual(await read(g2), big);
  assert.deepEqual(new Uint8Array(await (await b.get('AB12CD/bbbbbbbbbbbbbbbbbbbbbbbb.mp4')).arrayBuffer()), big);
  assert.deepEqual(b.usage(), { count: 2, bytes: 1234 + big.length });
  // ArrayBuffer·글자열도 받음
  await b.put('k/buf', small.buffer); assert.deepEqual(await read(await b.get('k/buf')), small);
  await b.put('k/str', '한글'); assert.equal(new TextDecoder().decode(await read(await b.get('k/str'))), '한글');
  // 빈 파일
  await b.put('k/empty', new Uint8Array(0)); const e = await b.get('k/empty'); assert.equal(e.size, 0); assert.equal((await read(e)).length, 0);
});

test('Range: 요청 머리글(R2처럼)과 { offset, length, suffix }', async () => {
  const { b } = make();
  const big = bytes(2 * CHUNK + 100, 3);
  await b.put('R/f.mp4', big);
  const h = (v) => new Headers(v ? { range: v } : {});
  let g = await b.get('R/f.mp4', { range: h(`bytes=${CHUNK - 5}-${CHUNK + 4}`) });
  assert.deepEqual(g.range, { offset: CHUNK - 5, length: 10 });
  assert.deepEqual(await read(g), big.subarray(CHUNK - 5, CHUNK + 5), '줄 경계를 넘는 구간');
  g = await b.get('R/f.mp4', { range: h('bytes=-100') });
  assert.deepEqual(g.range, { offset: 2 * CHUNK, length: 100 });
  assert.deepEqual(await read(g), big.subarray(2 * CHUNK));
  g = await b.get('R/f.mp4', { range: h(`bytes=${2 * CHUNK}-`) });
  assert.deepEqual(await read(g), big.subarray(2 * CHUNK));
  g = await b.get('R/f.mp4', { range: h() });
  assert.equal(g.range, undefined); assert.equal((await read(g)).length, big.length);
  g = await b.get('R/f.mp4', { range: h('bytes=99999999-') });
  assert.equal(g.range, undefined, '못 맞추는 구간은 전체로');
  g = await b.get('R/f.mp4', { range: { offset: 10, length: 20 } });
  assert.deepEqual(g.range, { offset: 10, length: 20 }); assert.deepEqual(await read(g), big.subarray(10, 30));
  g = await b.get('R/f.mp4', { range: { suffix: 7 } });
  assert.deepEqual(await read(g), big.subarray(big.length - 7));
});

test('지우기·목록(prefix, 이어 보기)', async () => {
  const { b } = make();
  for (const k of ['A1B2C3/1.png', 'A1B2C3/2.png', 'A1B2C3/3.png', 'A1B2C3X/9.png', 'Z_%/1.png']) await b.put(k, bytes(10));
  let l = await b.list({ prefix: 'A1B2C3/' });
  assert.deepEqual(l.objects.map((o) => o.key), ['A1B2C3/1.png', 'A1B2C3/2.png', 'A1B2C3/3.png']);
  assert.equal(l.truncated, false);
  assert.deepEqual((await b.list({ prefix: 'Z_%/' })).objects.map((o) => o.key), ['Z_%/1.png'], '%·_는 글자 그대로');
  assert.equal((await b.list({ prefix: 'A_B2C3/' })).objects.length, 0);
  const p1 = await b.list({ prefix: 'A1B2C3/', limit: 2 });
  assert.equal(p1.truncated, true); assert.equal(p1.objects.length, 2);
  const p2 = await b.list({ prefix: 'A1B2C3/', limit: 2, cursor: p1.cursor });
  assert.deepEqual(p2.objects.map((o) => o.key), ['A1B2C3/3.png']); assert.equal(p2.truncated, false);
  await b.delete('A1B2C3/2.png');
  await b.delete(['A1B2C3/1.png', 'A1B2C3/없는것.png']);
  assert.deepEqual((await b.list({ prefix: 'A1B2C3/' })).objects.map((o) => o.key), ['A1B2C3/3.png']);
  assert.equal(await b.get('A1B2C3/1.png'), null);
  assert.equal(b.usage().count, 3);
  assert.equal((await b.list()).objects.length, 3);
});

test('한도: 파일 하나, 방 전체. 같은 이름으로 다시 올리면 바꿔 셈', async () => {
  const { b } = make({ maxObjectBytes: 2 * CHUNK, maxTotalBytes: 5 * CHUNK });
  await assert.rejects(() => b.put('L/big', bytes(2 * CHUNK + 1)), (e) => e.status === 413 && e.code === 'too_large');
  await b.put('L/a', bytes(2 * CHUNK)); await b.put('L/b', bytes(2 * CHUNK));
  await assert.rejects(() => b.put('L/c', bytes(CHUNK + 1)), (e) => e.status === 507 && e.code === 'storage_full' && /[가-힣]/.test(e.message));
  assert.equal(await b.get('L/c'), null, '거절한 파일은 남지 않음');
  await b.put('L/c', bytes(CHUNK));
  assert.equal(b.usage().bytes, 5 * CHUNK);
  await b.put('L/a', bytes(CHUNK, 5)); // 2MiB짜리를 1MiB로 바꿈
  assert.equal(b.usage().bytes, 4 * CHUNK);
  assert.deepEqual(await read(await b.get('L/a')), bytes(CHUNK, 5), '예전 조각이 남지 않음');
  await b.put('L/d', bytes(CHUNK));
  await assert.rejects(() => b.put('L/e', bytes(1)), (e) => e.code === 'storage_full');
  await b.delete('L/b');
  await b.put('L/e', bytes(1));
});
