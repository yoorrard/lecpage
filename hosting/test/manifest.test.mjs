import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkManifest, missingBlobs, scriptBlobs } from '../src/manifest.js';
import { HttpError } from '../src/http.js';
import { config } from '../src/config.js';

const L = config({});
const sha = (c) => String(c).repeat(64).slice(0, 64);
const f = (c, size = 10) => ({ sha256: sha(c), size });
const code = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof HttpError, String(e)); return `${e.code}/${e.status}`; } return 'ok'; };
const base = { 'index.html': f('a') };

test('맞는 목록', () => {
  const m = checkManifest({ files: { 'index.html': f('a', 100), 'assets/lecpage.js': f('b', 50), 'assets/copy.js': f('b', 50), 'assets/media/사진 (1).png': f('c', 7), _headers: { sha256: 'x', size: 'y' } } }, L);
  assert.deepEqual(m.files.map((x) => x[0]), ['assets/copy.js', 'assets/lecpage.js', 'assets/media/사진 (1).png', 'index.html']);
  assert.equal(m.bytes, 207);
  assert.equal(m.stored, 157, '같은 내용은 한 번만 셈');
});

test('오류 코드', () => {
  const cases = [
    [null, 'bad_request/400'], [{}, 'bad_request/400'], [{ files: [] }, 'bad_request/400'], [{ files: {} }, 'bad_request/400'], [{ files: { _headers: f('a') } }, 'bad_request/400'],
    [{ files: { 'a.html': f('a') } }, 'bad_request/400'], // index.html 없음
    [{ files: { ...base, '../x.html': f('b') } }, 'bad_path/400'],
    [{ files: { ...base, '/x.html': f('b') } }, 'bad_path/400'],
    [{ files: { ...base, 'a/.env': f('b') } }, 'bad_path/400'],
    [{ files: { ...base, 'x.php': f('b') } }, 'bad_type/415'],
    [{ files: { ...base, 'DESIGN.md': f('b') } }, 'bad_type/415'],
    [{ files: { ...base, noext: f('b') } }, 'bad_type/415'],
    [{ files: { ...base, 'a.png': { sha256: 'ABC', size: 1 } } }, 'bad_request/400'],
    [{ files: { ...base, 'a.png': { sha256: sha('A'), size: 1 } } }, 'bad_request/400'], // 대문자 16진수
    [{ files: { ...base, 'a.png': { sha256: sha('a'), size: -1 } } }, 'bad_request/400'],
    [{ files: { ...base, 'a.png': { sha256: sha('a'), size: 1.5 } } }, 'bad_request/400'],
    [{ files: { ...base, 'a.png': { sha256: sha('a'), size: '10' } } }, 'bad_request/400'],
    [{ files: { ...base, 'a.png': null } }, 'bad_request/400'],
    [{ files: { ...base, 'a.png': f('a', 11) } }, 'bad_request/400'], // 같은 sha256인데 크기가 다름
    [{ files: { ...base, 'a.png': f('b', L.maxFileBytes + 1) } }, 'too_large/413'],
    [{ files: { ...base, 'a.png': f('b', L.maxFileBytes), 'b.png': f('c', L.maxFileBytes), 'c.png': f('d', 1024 * 1024) } }, 'too_large/413'], // 합계
    [{ files: { ...base, 'assets/big.js': f('b', 1024 * 1024 + 1) } }, 'runtime_mismatch/422'],
    [{ files: Object.fromEntries([['index.html', f('a')], ...Array.from({ length: L.maxFiles }, (_, i) => [`p${i}.png`, f('b')])]) }, 'too_many_files/413'],
  ];
  for (const [body, want] of cases) assert.equal(code(() => checkManifest(body, L)), want, JSON.stringify(body).slice(0, 120));
  assert.equal(code(() => checkManifest({ files: Object.fromEntries([['index.html', f('a')], ...Array.from({ length: L.maxFiles - 1 }, (_, i) => [`p${i}.png`, f('b')])]) }, L)), 'ok', '한도까지는 됨');
  assert.equal(code(() => checkManifest({ files: { ...base, 'a.png': f('b', L.maxFileBytes) } }, L)), 'ok');
});

test('한도는 환경 변수로 바뀜', () => {
  const small = config({ MAX_FILES: '2', MAX_FILE_BYTES: '100', MAX_BYTES: '150' });
  assert.equal(code(() => checkManifest({ files: { ...base, 'a.png': f('b'), 'b.png': f('c') } }, small)), 'too_many_files/413');
  assert.equal(code(() => checkManifest({ files: { ...base, 'a.png': f('b', 101) } }, small)), 'too_large/413');
  assert.equal(code(() => checkManifest({ files: { 'index.html': f('a', 100), 'a.png': f('b', 51) } }, small)), 'too_large/413');
  assert.equal(code(() => checkManifest({ files: { 'index.html': f('a', 100), 'a.png': f('b', 50) } }, small)), 'ok');
});

test('없는 파일만 고름', () => {
  const files = [['a.html', sha('a'), 1], ['b.png', sha('b'), 1], ['c.png', sha('b'), 1], ['d.png', sha('c'), 1]];
  assert.deepEqual(missingBlobs(files, new Map()), [sha('a'), sha('b'), sha('c')]);
  assert.deepEqual(missingBlobs(files, new Map([[sha('a'), 1], [sha('c'), 1]])), [sha('b')]);
  assert.deepEqual(missingBlobs(files, new Set([sha('a'), sha('b'), sha('c')])), []);
});

test('.js로 나갈 내용 고르기', () => {
  const m = scriptBlobs([['assets/a.js', sha('a'), 1], ['assets/A.JS', sha('b'), 1], ['assets/a.json', sha('c'), 1], ['x.js.txt', sha('d'), 1], ['assets/copy.js', sha('a'), 1]]);
  assert.deepEqual([...m.keys()], [sha('a'), sha('b')]);
});
