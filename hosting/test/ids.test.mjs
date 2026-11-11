import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { newId, newKey, newDeployId, ID_RE, DEPLOY_RE, ID_ALPHABET, sha256Hex, safeEqual, bearer, keyMatches, secretMatches, ipBucket, b64url } from '../src/ids.js';

test('사이트 id: 10자, 헷갈리는 글자 없는 소문자 base32', () => {
  assert.equal(ID_ALPHABET.length, 32);
  assert.equal(new Set(ID_ALPHABET).size, 32);
  for (const c of 'ilou') assert.ok(!ID_ALPHABET.includes(c), c);
  const seen = new Set(); const used = new Set();
  for (let i = 0; i < 2000; i++) {
    const id = newId();
    assert.match(id, ID_RE);
    assert.equal(id.length, 10);
    seen.add(id);
    for (const c of id) used.add(c);
  }
  assert.equal(seen.size, 2000, '겹치면 안 됨');
  assert.equal(used.size, 32, '글자표 전체가 고르게 쓰임');
  for (const bad of ['', 'abc', 'ABCDEFGHJK', 'abcdefghij', 'abcdefghjl', 'abcdefghjko', '../../../x', 'abcdefghj/']) assert.doesNotMatch(bad, ID_RE);
  assert.match(newDeployId(), DEPLOY_RE);
});

test('수정 열쇠: 32바이트 base64url, 서버에는 해시만', async () => {
  const k = newKey();
  assert.match(k, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(k, newKey());
  assert.equal(b64url(new Uint8Array([251, 255, 254])), '-__-');
  const h = await sha256Hex(k);
  assert.equal(h, createHash('sha256').update(k).digest('hex'));
  assert.equal(await sha256Hex(new Uint8Array([1, 2, 3])), createHash('sha256').update(Buffer.from([1, 2, 3])).digest('hex'));
  assert.ok(await keyMatches(k, h));
  assert.ok(!(await keyMatches(k + 'x', h)));
  assert.ok(!(await keyMatches('', h)));
  assert.ok(!(await keyMatches(k, '')));
  assert.ok(await secretMatches('admin-1', 'admin-1'));
  assert.ok(!(await secretMatches('admin-1', 'admin-2')));
  assert.ok(!(await secretMatches('', '')));
});

test('safeEqual·bearer', () => {
  assert.ok(safeEqual('abc', 'abc'));
  assert.ok(!safeEqual('abc', 'abd'));
  assert.ok(!safeEqual('abc', 'abcd'));
  assert.ok(!safeEqual('abc', undefined));
  assert.equal(bearer('Bearer abc-DEF_123'), 'abc-DEF_123');
  assert.equal(bearer('bearer   xyz '), 'xyz');
  assert.equal(bearer('Basic abc'), '');
  assert.equal(bearer('Bearer a b'), '');
  assert.equal(bearer(null), '');
});

test('ipBucket: IPv4는 그대로, IPv6는 /64', () => {
  assert.equal(ipBucket('203.0.113.7'), '203.0.113.7');
  assert.equal(ipBucket(''), 'unknown');
  assert.equal(ipBucket('2001:db8:1:2:aaaa:bbbb:cccc:dddd'), '2001:db8:1:2::/64');
  assert.equal(ipBucket('2001:0db8:0001:0002::1'), '2001:db8:1:2::/64');
  assert.equal(ipBucket('2001:db8::1'), '2001:db8:0:0::/64');
  assert.equal(ipBucket('2001:db8:1:2::1'), ipBucket('2001:db8:1:2:ffff:ffff:ffff:ffff'));
  assert.notEqual(ipBucket('2001:db8:1:2::1'), ipBucket('2001:db8:1:3::1'));
});
