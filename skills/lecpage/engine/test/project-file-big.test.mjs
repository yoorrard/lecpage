// .lecpage 저장·열기(큰 연수): 저장한 파일은 반드시 다시 열림.
// 예전에는 저장에는 한도가 없고 열기만 300MB 한도여서, 큰 교재를 넣은 연수를 저장한 뒤 지우면 다시 열 수 없었음.
// → 저장(storedZipWriter)과 열기(readStoredZipBlob·readStoredZip)가 같은 한도를 쓰고, 둘 다 연수를 메모리에 통째로 올리지 않음(Blob 조각).
import test from 'node:test';
import assert from 'node:assert/strict';
import { storedZipWriter, readStoredZipBlob, readStoredZip, blobCrc, sameEntries, unpackProject, PROJECT_FILE_MAX, PROJECT_FILE_MAX_FILES, PROJECT_FORMAT } from '../src/project-file.js';
import { zipFiles } from '../src/zip-write.js';

const bytes = (n, seed = 1) => { const b = new Uint8Array(n); for (let i = 0; i < n; i++) b[i] = (i * 31 + seed) & 0xff; return b; };
const same = (a, b) => a.length === b.length && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;
const u8 = async (blob) => new Uint8Array(await blob.arrayBuffer());

test('저장 → 열기 왕복: 글·바이트·Blob 항목이 바이트까지 같고, 한글 이름·빈 항목도 그대로', async () => {
  const w = storedZipWriter({ date: new Date(2026, 10, 24, 10, 0, 0) });
  const items = { 'project.json': '{"format":"lecpage-project"}', 'src/큰 교재(최종).pptx': bytes(300000, 7), 'site/material/p-001.webp': new Blob([bytes(5000, 3)]), 'assets/files/빈.txt': new Uint8Array(0) };
  for (const [k, v] of Object.entries(items)) await w.add(k, v);
  const zip = w.finish();
  assert.ok(zip instanceof Blob); assert.equal(zip.type, 'application/zip');
  // 조각으로 읽기(앱): 내용은 파일의 조각(Blob)으로 돌아옴
  const got = await readStoredZipBlob(zip);
  assert.deepEqual(Object.keys(got), Object.keys(items));
  for (const k of Object.keys(items)) assert.ok(got[k] instanceof Blob, k);
  assert.equal(await got['project.json'].text(), items['project.json']);
  assert.ok(same(await u8(got['src/큰 교재(최종).pptx']), items['src/큰 교재(최종).pptx']));
  assert.ok(same(await u8(got['site/material/p-001.webp']), bytes(5000, 3)));
  assert.equal(got['assets/files/빈.txt'].size, 0);
  // 통째로 읽기(Skill CLI)도 같은 결과 + 예전 쓰기(zipFiles)로 만든 파일을 조각 읽기로 열어도 같음
  const whole = readStoredZip(await u8(zip));
  assert.ok(same(whole['src/큰 교재(최종).pptx'], items['src/큰 교재(최종).pptx']));
  const old = zipFiles({ 'project.json': '{}', 'src/a.pdf': bytes(1234, 5) });
  const viaBlob = await readStoredZipBlob(new Blob([old]));
  assert.ok(same(await u8(viaBlob['src/a.pdf']), bytes(1234, 5))); assert.equal(await viaBlob['project.json'].text(), '{}');
  // 새 쓰기와 예전 쓰기는 같은 내용이면 바이트까지 같은 파일
  const w2 = storedZipWriter({ date: new Date(2026, 10, 24, 10, 0, 0) });
  await w2.add('project.json', '{}'); await w2.add('src/a.pdf', bytes(1234, 5));
  assert.ok(same(await u8(w2.finish()), zipFiles({ 'project.json': '{}', 'src/a.pdf': bytes(1234, 5) }, { date: new Date(2026, 10, 24, 10, 0, 0) })));
});

test('큰 항목: CRC를 조각조각 세어도 한 번에 센 값과 같고(zip 머리의 값), 이미 아는 값을 주면 다시 읽지 않음', async () => {
  const big = bytes(3 * 1024 * 1024 + 17, 9);
  const viaChunks = await blobCrc(new Blob([big]), 64 * 1024);
  const whole = readStoredZip(zipFiles({ x: big }));
  assert.ok(same(whole.x, big));
  const dv = new DataView(zipFiles({ x: big }).buffer); assert.equal(viaChunks.crc, dv.getUint32(14, true)); assert.equal(viaChunks.size, big.length);
  let reads = 0; const spy = new Blob([big]); const slice = spy.slice.bind(spy); spy.slice = (...a) => { reads++; return slice(...a); };
  const w = storedZipWriter(); await w.add('x', spy, viaChunks); assert.equal(reads, 0, '아는 CRC·크기를 주면 내용을 읽지 않음');
  assert.ok(same((readStoredZip(await u8(w.finish()))).x, big));
});

test('한도: 저장과 열기가 같은 숫자 — 저장된 파일은 열리고, 넘는 연수는 저장하기 전에 알림(열 수 없는 파일을 만들지 않음)', async () => {
  assert.ok(PROJECT_FILE_MAX > 3e9 && PROJECT_FILE_MAX < 2 ** 32, 'ZIP 32비트 한계 안'); assert.ok(PROJECT_FILE_MAX_FILES >= 3000);
  // 작은 가짜 한도로: 딱 맞으면 저장되고 열림, 넘으면 저장 단계에서 알림
  const max = 10000;
  const w = storedZipWriter({ maxBytes: max, maxFiles: 5 });
  await w.add('a', bytes(4000)); await w.add('b', bytes(5000));
  const ok = w.finish();
  const opened = await readStoredZipBlob(ok, { maxBytes: max, maxFiles: 5 }); assert.deepEqual(Object.keys(opened), ['a', 'b']);
  assert.deepEqual(Object.keys(readStoredZip(await u8(ok), { maxBytes: max, maxFiles: 5 })), ['a', 'b']);
  const w2 = storedZipWriter({ maxBytes: max, maxFiles: 5 });
  await w2.add('a', bytes(6000));
  await assert.rejects(() => w2.add('b', bytes(6000)), (e) => e.friendly === true && /파일 하나로 저장할 수 없어요/.test(e.message) && /큰 교재를 빼고/.test(e.message));
  const w3 = storedZipWriter({ maxBytes: 1e6, maxFiles: 2 });
  await w3.add('a', 'x'); await w3.add('b', 'y'); await assert.rejects(() => w3.add('c', 'z'), (e) => e.friendly === true);
  // 열기 쪽도 같은 한도에서 사실대로 알림(예전 300MB 문구가 아님)
  const big = zipFiles({ a: bytes(9000), b: bytes(9000) });
  await assert.rejects(() => readStoredZipBlob(new Blob([big]), { maxBytes: max }), (e) => e.friendly === true && /너무 커요/.test(e.message) && !/300MB/.test(e.message));
  assert.throws(() => readStoredZip(big, { maxBytes: max }), (e) => e.friendly === true && !/300MB/.test(e.message));
  // 기본 한도는 예전(300MB)보다 넓음: 400MB짜리 머리(내용은 Blob 조각이라 읽지 않음)도 받음
  const w4 = storedZipWriter(); const filler = new Blob([new Uint8Array(1024)]);
  const fake = { size: 400e6, slice: () => filler, arrayBuffer: () => filler.arrayBuffer() };
  Object.setPrototypeOf(fake, Blob.prototype);
  await w4.add('src/big.pdf', fake, { crc: 0, size: 400e6 }); assert.equal(w4.size, 30 + 'src/big.pdf'.length + 400e6);
});

test('열기: lecpage가 만든 무압축 ZIP만 — 압축한 ZIP·경로가 이상한 파일·잘린 파일은 사실대로 거절', async () => {
  const good = zipFiles({ 'project.json': '{}' });
  const deflated = good.slice(); new DataView(deflated.buffer).setUint16(8, 8, true);
  await assert.rejects(() => readStoredZipBlob(new Blob([deflated])), (e) => e.friendly && /\.lecpage 파일만/.test(e.message));
  const evil = zipFiles({ '../x': 'a' });
  await assert.rejects(() => readStoredZipBlob(new Blob([evil])), (e) => e.friendly && /경로/.test(e.message));
  const cut = zipFiles({ 'project.json': '{}', 'src/a.pdf': bytes(5000) }).slice(0, 2000);
  await assert.rejects(() => readStoredZipBlob(new Blob([cut])), (e) => e.friendly === true);
  assert.deepEqual(Object.keys(await readStoredZipBlob(new Blob([new Uint8Array(10)]))), [], 'ZIP이 아니면 빈 목록(부른 쪽이 project.json 없음으로 알림)');
});

test('쪽 그림 한 벌만 담기(same): 같은 번호의 assets/slides ← site/material 짝만 받고, 열 때 되살림', () => {
  const j = { same: { 'assets/slides/slide-001.webp': 'site/material/p-001.webp', 'assets/slides/slide-012.png': 'site/material/p-012.png',
    'assets/slides/slide-002.webp': 'site/material/p-003.webp', 'src/a.pdf': 'site/material/p-001.webp', 'assets/slides/slide-004.webp': '../x', 'index.html': 'site/material/p-001.webp' } };
  assert.deepEqual(sameEntries(j), [['assets/slides/slide-001.webp', 'site/material/p-001.webp'], ['assets/slides/slide-012.png', 'site/material/p-012.png']]);
  assert.deepEqual(sameEntries({}), []); assert.deepEqual(sameEntries({ same: 'x' }), []); assert.deepEqual(sameEntries(null), []);
  // unpackProject(Skill CLI가 앱 파일을 읽을 때)도 되살림: 파일에 사이트용만 있어도 넣을 때 그린 쪽 그림이 나옴
  const enc = new TextEncoder();
  const files = { 'project.json': enc.encode(JSON.stringify({ format: PROJECT_FORMAT, version: 1, project: { title: 't', files: [] }, same: { 'assets/slides/slide-001.webp': 'site/material/p-001.webp' } })),
    'site/material/p-001.webp': bytes(100, 4), 'assets/slides/slide-002.webp': bytes(50, 5) };
  const u = unpackProject(files);
  assert.ok(same(u.assets['assets/slides/slide-001.webp'], bytes(100, 4)), '되살린 쪽 그림');
  assert.ok(same(u.assets['assets/slides/slide-002.webp'], bytes(50, 5)), '따로 담긴 쪽 그림은 그대로');
  // same이 없는 예전 파일은 예전 그대로
  const old = unpackProject({ 'project.json': enc.encode(JSON.stringify({ format: PROJECT_FORMAT, version: 1, project: { title: 't' } })), 'assets/slides/slide-001.webp': bytes(10) });
  assert.deepEqual(Object.keys(old.assets), ['assets/slides/slide-001.webp']);
});
