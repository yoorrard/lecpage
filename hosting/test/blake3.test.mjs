// Pages 자산 열쇠(blake3)가 wrangler가 쓰는 blake3-wasm과 같은지
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { blake3Hex, pagesHash, base64Parts } from '../src/blake3.js';

const require = createRequire(import.meta.url);
let b3 = null;
try { b3 = require('blake3-wasm'); } catch { /* wrangler를 설치하지 않았으면 건너뜀 */ }

test('blake3: 길이마다 blake3-wasm과 같음(덩어리·트리 경계 포함)', { skip: !b3 && 'blake3-wasm 없음(hosting에서 npm install)' }, () => {
  for (const n of [0, 1, 63, 64, 65, 1023, 1024, 1025, 2048, 2049, 3072, 4096, 5000, 16384, 31744, 65537, 300001]) {
    const d = randomBytes(n);
    assert.equal(blake3Hex(new Uint8Array(d)), b3.hash(d).toString('hex'), `길이 ${n}`);
  }
  assert.equal(blake3Hex('abc'), b3.hash('abc').toString('hex'));
});

test('Pages 열쇠 = blake3(base64 + 확장자) 앞 32자(wrangler hashFile과 같음)', { skip: !b3 && 'blake3-wasm 없음' }, () => {
  for (const n of [0, 2, 3, 4, 65535, 65536, 200000]) {
    const d = randomBytes(n);
    for (const ext of ['png', 'html', 'JPG', '']) {
      assert.equal(pagesHash(new Uint8Array(d), ext), b3.hash(d.toString('base64') + ext).toString('hex').slice(0, 32), `${n} ${ext}`);
    }
  }
});

test('base64 조각을 이으면 전체 base64', () => {
  const d = randomBytes(200003);
  assert.equal(base64Parts(new Uint8Array(d), 3 * 1000).join(''), d.toString('base64'));
  assert.deepEqual(base64Parts(new Uint8Array(0)), ['']);
});
