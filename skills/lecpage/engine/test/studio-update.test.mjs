// lecpage 커넥트 새 판으로 바꾸기(scripts/studio-update.mjs + /bridge/update·/bridge/status의 caps·build). 받는 곳은 이 컴퓨터의 가짜 릴리스
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, generateKeyPairSync, sign as edSign } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import * as St from '../../scripts/studio.mjs';
import * as U from '../../scripts/studio-update.mjs';

let T, DIST;
before(() => {
  T = mkdtempSync(join(tmpdir(), 'lp-studio-update-'));
  DIST = join(T, 'dist'); mkdirSync(DIST);
  writeFileSync(join(DIST, 'index.html'), '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>앱</title></head><body></body></html>');
});
after(() => rmSync(T, { recursive: true, force: true }));

/** 작은 tar(ustar) 만들기: [[이름, 내용|null(폴더), 종류?]] → tar.gz */
function tarGz(entries) {
  const blocks = [];
  for (const [name, body, type] of entries) {
    const data = body == null ? Buffer.alloc(0) : Buffer.from(body);
    const h = Buffer.alloc(512);
    h.write(name.slice(0, 100), 0, 'utf8');
    h.write((body == null ? '0000755' : '0000644') + '\0', 100);
    h.write(data.length.toString(8).padStart(11, '0') + '\0', 124);
    h.write('        ', 148);
    h.write(type || (body == null ? '5' : '0'), 156);
    h.write('ustar\0', 257); h.write('00', 263);
    let sum = 0; for (const c of h) sum += c;
    h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
    blocks.push(h, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}
const pkg = (ver) => tarGz([['./', null], ['./VERSION', `${ver}\n`], ['./skills/', null], ['./skills/lecpage/scripts/lecpage.mjs', '// 새 판\n'], ['./lecpage-connect.sh', '#!/bin/sh\n']]);
/** 받은 묶음처럼 보이는 폴더(VERSION + skills/) */
function fakeRoot(ver) {
  const root = join(mkdtempSync(join(T, 'lp-')), 'studio');
  mkdirSync(join(root, 'skills', 'lecpage', 'scripts'), { recursive: true });
  writeFileSync(join(root, 'VERSION'), `${ver}\n`);
  writeFileSync(join(root, 'skills', 'lecpage', 'scripts', 'lecpage.mjs'), '// 예전 판\n');
  return root;
}
/** 가짜 릴리스: VERSION · lecpage-connect.tar.gz · .sha256 */
async function release(files) {
  const hits = [];
  const srv = http.createServer((q, s) => { hits.push(q.url); const f = files[q.url.slice(1)]; if (f === undefined) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': 'application/octet-stream' }); s.end(f); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${srv.address().port}`, hits, close: () => new Promise((r) => srv.close(r)) };
}
const sha = (b) => createHash('sha256').update(b).digest('hex');
/** 시험 때만 만드는 서명 키(저장소·릴리스와 무관) */
function keyPair() { const { publicKey, privateKey } = generateKeyPairSync('ed25519'); return { x: publicKey.export({ format: 'jwk' }).x, privateKey }; }
const sigOf = (buf, privateKey) => `${edSign(null, buf, privateKey).toString('base64')}\n`;
function req(port, method, path, { headers = {}, body } = {}) {
  return new Promise((ok, no) => {
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const r = http.request({ host: '127.0.0.1', port, method, path, headers: { host: `127.0.0.1:${port}`, ...(data ? { 'content-type': 'application/json', 'content-length': data.length } : {}), ...headers } }, (res) => {
      const ch = []; res.on('data', (c) => ch.push(c)); res.on('end', () => { const text = Buffer.concat(ch).toString('utf8'); ok({ status: res.statusCode, json: () => JSON.parse(text) }); });
    });
    r.on('error', no); if (data) r.write(data); r.end();
  });
}
async function studio(opts, fn) {
  const lines = [];
  const st = await St.startStudio({ port: 0, dist: DIST, home: mkdtempSync(join(T, 's-')), log: (l) => lines.push(l), ...opts });
  const H = { 'x-lecpage-bridge': st.S.token, origin: 'https://lecpage.com' };
  try { await fn(st, H, lines); } finally { await st.close(); }
}
async function until(port, H, pred, ms = 10000) {
  let s = null;
  for (const end = Date.now() + ms; Date.now() < end;) { s = (await req(port, 'GET', '/bridge/status', { headers: H })).json(); if (pred(s)) return s; await new Promise((r) => setTimeout(r, 50)); }
  throw new Error(`기다린 상태가 오지 않았어요: ${JSON.stringify(s?.update)}`);
}

test('상태에 판 이름(build)과 할 수 있는 것(caps): 앱이 예전 판을 알아보게. 저장소에서 켠 것은 스스로 바꾸지 않음', async () => {
  await studio({}, async (st, H) => {
    const s = (await req(st.port, 'GET', '/bridge/status', { headers: H })).json();
    assert.ok(Array.isArray(s.caps) && s.caps.includes('claude-setup') && s.caps.includes('update') && s.caps.includes('status-caps'));
    assert.match(s.build, /-dev$/);
    assert.equal(s.update.can, false);
    const r = await req(st.port, 'POST', '/bridge/update', { headers: H, body: {} });
    assert.equal(r.status, 409); assert.equal(r.json().error, 'update-unavailable'); assert.match(r.json().message_ko, /끄고 다시 켜/);
  });
});

test('새 판으로 바꾸기: 확인 → 받기(SHA-256) → 갈아 끼우기 → 같은 포트로 다시 켜기를 부름. 바꾸는 동안 다른 요청은 기다리게', async () => {
  const gz = pkg('1.2.0-new');
  const rel = await release({ VERSION: '1.2.0-new\n', 'lecpage-connect.tar.gz': gz, 'lecpage-connect.tar.gz.sha256': `${sha(gz)}  lecpage-connect.tar.gz\n` });
  const root = fakeRoot('1.1.0-old');
  let restarted = null;
  try {
    await studio({ root, release: { base: rel.base }, onRestart: (r) => { restarted = r; } }, async (st, H) => {
      const s0 = (await req(st.port, 'GET', '/bridge/status', { headers: H })).json();
      assert.equal(s0.build, '1.1.0-old'); assert.equal(s0.update.can, true);
      // 짝 맞춤 토큰·출처 확인은 다른 /bridge/*와 같음
      assert.equal((await req(st.port, 'POST', '/bridge/update', { headers: { origin: 'https://lecpage.com' }, body: {} })).status, 401);
      assert.equal((await req(st.port, 'POST', '/bridge/update', { headers: { ...H, origin: 'https://evil.example' }, body: {} })).status, 403);
      const g = (await req(st.port, 'GET', '/bridge/update', { headers: H })).json();
      assert.equal(g.update.latest, '1.2.0-new'); assert.equal(g.update.available, true);
      const p = await req(st.port, 'POST', '/bridge/update', { headers: H, body: {} });
      assert.equal(p.status, 202);
      const s1 = await until(st.port, H, (s) => s.update.state === 'restart');
      assert.equal(s1.update.to, '1.2.0-new');
      assert.equal((await req(st.port, 'POST', '/bridge/jobs', { headers: H, body: {} })).status, 503);
      for (let i = 0; i < 40 && !restarted; i++) await new Promise((r) => setTimeout(r, 50));
      assert.deepEqual({ from: restarted.from, to: restarted.to }, { from: '1.1.0-old', to: '1.2.0-new' });
      assert.equal(readFileSync(join(root, 'VERSION'), 'utf8').trim(), '1.2.0-new');
      assert.equal(readFileSync(join(root, 'skills', 'lecpage', 'scripts', 'lecpage.mjs'), 'utf8'), '// 새 판\n');
      assert.equal(readFileSync(join(`${root}.old`, 'VERSION'), 'utf8').trim(), '1.1.0-old');
      assert.ok(!existsSync(`${root}.new`));
    });
  } finally { await rel.close(); }
});

test('SHA-256이 다르면 아무것도 바꾸지 않음 · 이미 새 판이면 그대로 · 작업이 돌고 있으면 바꾸지 않음', async () => {
  const gz = pkg('1.2.0-new');
  const rel = await release({ VERSION: '1.2.0-new\n', 'lecpage-connect.tar.gz': gz, 'lecpage-connect.tar.gz.sha256': `${'0'.repeat(64)}  lecpage-connect.tar.gz\n` });
  const root = fakeRoot('1.1.0-old');
  try {
    await studio({ root, release: { base: rel.base }, onRestart: () => assert.fail('다시 켜면 안 됨') }, async (st, H) => {
      st.S.inflight = 1; // ChatGPT 요청 등이 도는 중
      const b = await req(st.port, 'POST', '/bridge/update', { headers: H, body: {} });
      assert.equal(b.status, 409); assert.equal(b.json().error, 'busy');
      st.S.inflight = 0;
      assert.equal((await req(st.port, 'POST', '/bridge/update', { headers: H, body: {} })).status, 202);
      const s = await until(st.port, H, (x) => x.update.state === 'error');
      assert.equal(s.update.error, 'sha256'); assert.match(s.update.error_ko, /SHA-256/);
      assert.equal(readFileSync(join(root, 'VERSION'), 'utf8').trim(), '1.1.0-old');
      assert.ok(!existsSync(`${root}.new`) && !existsSync(`${root}.old`));
    });
  } finally { await rel.close(); }
  const same = await release({ VERSION: '1.1.0-old\n' });
  try {
    await studio({ root, release: { base: same.base } }, async (st, H) => {
      const r = await req(st.port, 'POST', '/bridge/update', { headers: H, body: {} });
      assert.equal(r.status, 200); assert.equal(r.json().upToDate, true);
      assert.deepEqual(same.hits, ['/VERSION']);
    });
  } finally { await same.close(); }
});

test('두 번 동시에 눌러도(저절로 + 사람이 누름) 한 번만 받아 바꿈: 예전 판 보관(.old)이 새 판으로 덮이지 않음', async () => {
  const gz = pkg('1.2.0-new');
  const rel = await release({ VERSION: '1.2.0-new\n', 'lecpage-connect.tar.gz': gz, 'lecpage-connect.tar.gz.sha256': `${sha(gz)}  lecpage-connect.tar.gz\n` });
  const root = fakeRoot('1.1.0-old');
  let restarts = 0;
  try {
    await studio({ root, release: { base: rel.base }, onRestart: () => { restarts++; } }, async (st, H) => {
      const [a, b] = await Promise.all([req(st.port, 'POST', '/bridge/update', { headers: H, body: {} }), req(st.port, 'POST', '/bridge/update', { headers: H, body: {} })]);
      assert.deepEqual([a.status, b.status], [202, 202]);
      await until(st.port, H, (s) => s.update.state === 'restart');
      for (let i = 0; i < 40 && !restarts; i++) await new Promise((r) => setTimeout(r, 50));
      assert.equal(rel.hits.filter((h) => h === '/lecpage-connect.tar.gz').length, 1, '묶음은 한 번만 받음');
      assert.equal(restarts, 1);
      assert.equal(readFileSync(join(`${root}.old`, 'VERSION'), 'utf8').trim(), '1.1.0-old', '되돌릴 예전 판이 그대로');
      assert.equal(readFileSync(join(root, 'VERSION'), 'utf8').trim(), '1.2.0-new');
    });
  } finally { await rel.close(); }
});

test('저절로 바꾸기: 끝났는데 앱이 받아 가지 않은 결과가 있으면 기다림(다시 켜면 결과를 잃음) · 받아 간 뒤에는 바꿈 · 사람이 누르면 그대로', async () => {
  const gz = pkg('1.2.0-new');
  const rel = await release({ VERSION: '1.2.0-new\n', 'lecpage-connect.tar.gz': gz, 'lecpage-connect.tar.gz.sha256': `${sha(gz)}  lecpage-connect.tar.gz\n` });
  const root = fakeRoot('1.1.0-old');
  try {
    await studio({ root, release: { base: rel.base }, onRestart: () => {} }, async (st, H) => {
      const job = { id: 'j1', active: false, status: 'done', result: { ok: true, site: {} }, endedAt: Date.now(), collected: false, cleanup() {} };
      st.S.jobs.set(job.id, job); st.S.lastUse = 0;
      await st.autoTick();
      assert.equal(st.S.upd.state, 'idle'); assert.deepEqual(rel.hits, [], '받아 가지 않은 결과가 있으면 확인도 하지 않음');
      const got = await req(st.port, 'GET', '/bridge/jobs/j1/result', { headers: H });
      assert.equal(got.status, 200); assert.equal(job.collected, true, '앱이 결과를 받아 감');
      st.S.jobs.set('j0', { id: 'j0', active: false, status: 'done', result: { ok: true }, endedAt: Date.now() - 7 * 3600e3, cleanup() {} }); // 6시간 넘은 결과는 기다리지 않음
      st.S.lastUse = 0; // (결과를 받아 간 요청도 '쓰는 중'으로 셈) 10분 넘게 쓰지 않은 것처럼
      await st.autoTick();
      assert.ok(['download', 'install', 'restart'].includes(st.S.upd.state), st.S.upd.state);
      await until(st.port, H, (s) => s.update.state === 'restart');
    });
  } finally { await rel.close(); }
  const rel2 = await release({ VERSION: '1.3.0-new\n' });
  const root2 = fakeRoot('1.1.0-old');
  try {
    await studio({ root: root2, release: { base: rel2.base }, onRestart: () => {} }, async (st, H) => {
      st.S.jobs.set('j2', { id: 'j2', active: false, status: 'done', result: { ok: true }, endedAt: Date.now(), cleanup() {} });
      const r = await req(st.port, 'POST', '/bridge/update', { headers: H, body: {} });
      assert.equal(r.status, 202, '사람이 누른 [새 버전으로 바꾸기]는 받아 가지 않은 결과로 막지 않음');
    });
  } finally { await rel2.close(); }
});

test('바꾸기 실패는 까닭대로: 망 · SHA-256 · 묶음이 이상함 · 저장 공간 · 파일 바꾸기', async () => {
  assert.equal(St.updateErrorCode(new TypeError('fetch failed')), 'network');
  assert.equal(St.updateErrorCode(Object.assign(new Error('HTTP 404'), { code: 'http', status: 404 })), 'network');
  assert.equal(St.updateErrorCode(Object.assign(new Error('x'), { code: 'sha256' })), 'sha256');
  for (const code of ['tar', 'package', 'size', 'version', 'Z_DATA_ERROR']) assert.equal(St.updateErrorCode(Object.assign(new Error('x'), { code })), 'package', code);
  assert.equal(St.updateErrorCode(Object.assign(new Error('x'), { code: 'ENOSPC', syscall: 'write' })), 'disk');
  assert.equal(St.updateErrorCode(Object.assign(new Error('x'), { code: 'EACCES', syscall: 'mkdir' })), 'files');
  assert.equal(St.updateErrorCode(Object.assign(new Error('x'), { code: 'EPERM', syscall: 'rename' })), 'files');
  // 실제로: 묶음에 lecpage 커넥트가 없으면 'package'(망 탓이 아님)
  const gz = tarGz([['./VERSION', '1.2.0-bad\n']]);
  const rel = await release({ VERSION: '1.2.0-bad\n', 'lecpage-connect.tar.gz': gz, 'lecpage-connect.tar.gz.sha256': `${sha(gz)}  lecpage-connect.tar.gz\n` });
  const root = fakeRoot('1.1.0-old');
  try {
    await studio({ root, release: { base: rel.base }, onRestart: () => assert.fail('다시 켜면 안 됨') }, async (st, H) => {
      assert.equal((await req(st.port, 'POST', '/bridge/update', { headers: H, body: {} })).status, 202);
      const s = await until(st.port, H, (x) => x.update.state === 'error');
      assert.equal(s.update.error, 'package'); assert.match(s.update.error_ko, /올바르지 않아요/);
      assert.equal(readFileSync(join(root, 'VERSION'), 'utf8').trim(), '1.1.0-old');
    });
  } finally { await rel.close(); }
});

test('받는 곳은 https(시험만 127.0.0.1) · 묶음 밖 경로·링크는 풀지 않음', async () => {
  await assert.rejects(U.latestBuild({ base: 'http://example.com/x', fetchImpl: async () => assert.fail('부르면 안 됨') }), (e) => e.code === 'url');
  const redirected = async () => ({ ok: true, url: 'http://evil.example/VERSION', headers: new Headers(), arrayBuffer: async () => new ArrayBuffer(0) });
  await assert.rejects(U.latestBuild({ base: U.RELEASE, fetchImpl: redirected }), (e) => e.code === 'url');
  assert.equal(U.RELEASE.startsWith('https://github.com/'), true);
  const d = join(T, 'evil');
  assert.throws(() => U.untarGz(tarGz([['./ok.txt', 'ok'], ['../../escape.txt', 'x']]), d), /밖으로/);
  assert.throws(() => U.untarGz(tarGz([['/etc/x', 'x']]), join(T, 'evil2')), /밖으로/);
  assert.throws(() => U.untarGz(tarGz([['./link', '', '2']]), join(T, 'evil3')), /풀지 않는/);
  assert.ok(!existsSync(join(T, '..', 'escape.txt')));
  assert.equal(U.safeRel('./skills/a.md'), 'skills/a.md'); assert.equal(U.safeRel('C:/x'), null); assert.equal(U.safeRel('a/../../b'), null);
});

test('다시 켤 인자: 같은 포트 + 브라우저 열지 않기, 새 토큰은 빼서 짝이 그대로', () => {
  assert.deepEqual(U.restartArgv(['studio', '--autostart', '--new-token', '--port', '6601', '--open', 'local'], 6600), ['studio', '--autostart', '--port', '6600', '--no-open']);
  assert.deepEqual(U.restartArgv(['connect', '--port=7000', '--no-open', '--timeout', '30'], 7000), ['connect', '--timeout', '30', '--port', '7000', '--no-open']);
});

test('감독: 75로 끝나면 새 판을 다시 띄움 · 켜자마자 실패하면 예전 판으로 되돌려 한 번 더 · 그 밖에는 자식의 종료 코드로', async () => {
  const root = fakeRoot('2.0.0-bad');
  mkdirSync(`${root}.old/skills`, { recursive: true }); writeFileSync(join(`${root}.old`, 'VERSION'), '1.9.0-good\n');
  const spawned = []; const codes = [75, 1, 0];
  let exited = null;
  const spawnImpl = (cmd, args, o) => {
    const c = new EventEmitter(); c.kill = () => {};
    spawned.push({ args, env: o.env });
    setTimeout(() => c.emit('exit', codes[spawned.length - 1], null), 5);
    return c;
  };
  await new Promise((done) => {
    U.supervise({ cli: '/x/lecpage.mjs', argv: ['studio', '--port', '6600', '--no-open'], root, env: { A: '1' }, execArgv: [], spawnImpl, exit: (c) => { exited = c; done(); }, log: () => {} });
  });
  assert.equal(spawned.length, 3);
  assert.deepEqual(spawned[0].args, ['/x/lecpage.mjs', 'studio', '--port', '6600', '--no-open']);
  assert.equal(spawned[0].env.LECPAGE_CONNECT_CHILD, '1'); assert.equal(spawned[0].env.A, '1');
  assert.equal(spawned[2].env.LECPAGE_CONNECT_SKIP, '2.0.0-bad'); // 되돌린 뒤 저절로 다시 받지 않게
  assert.equal(readFileSync(join(root, 'VERSION'), 'utf8').trim(), '1.9.0-good');
  assert.equal(exited, 0);
});

test('서명 확인(ed25519): 맞는 서명만 · 키를 바꾸는 동안 여러 키·여러 줄 · 이상한 글·키는 거절', () => {
  const a = keyPair(); const b = keyPair();
  const buf = Buffer.from('묶음');
  assert.equal(U.verifySignature(buf, sigOf(buf, a.privateKey), [a.x]), true);
  assert.equal(U.verifySignature(buf, sigOf(buf, a.privateKey), [b.x]), false, '다른 키');
  assert.equal(U.verifySignature(Buffer.from('묶음!'), sigOf(buf, a.privateKey), [a.x]), false, '바뀐 묶음');
  assert.equal(U.verifySignature(buf, sigOf(buf, b.privateKey), [a.x, b.x]), true, '목록의 키 중 하나');
  assert.equal(U.verifySignature(buf, sigOf(buf, b.privateKey) + sigOf(buf, a.privateKey), [a.x]), true, '여러 줄 중 하나');
  for (const bad of ['', 'abc', 'A'.repeat(88), null, undefined]) assert.equal(U.verifySignature(buf, bad, [a.x]), false, String(bad));
  assert.equal(U.verifySignature(buf, sigOf(buf, a.privateKey), []), false, '키가 없으면 맞다고 하지 않음');
  assert.equal(U.verifySignature(buf, sigOf(buf, a.privateKey), ['not-a-key', a.x]), true, '이상한 키는 건너뜀');
  assert.ok(Array.isArray(U.SIGNING_KEYS) && U.SIGNING_KEYS.every((k) => U.KEY_RE.test(k)));
});

test('묶음 받기: 공개 키가 없으면 지금처럼 SHA-256만(.sig를 받지 않음) · 있으면 서명이 맞아야만, 없거나·틀리거나·다른 키면 거절(묶음이 올바르지 않아요)', async () => {
  const a = keyPair(); const b = keyPair();
  const gz = pkg('1.2.0-new');
  const files = { VERSION: '1.2.0-new\n', 'lecpage-connect.tar.gz': gz, 'lecpage-connect.tar.gz.sha256': `${sha(gz)}  lecpage-connect.tar.gz\n` };
  const rel = await release(files);
  const sigErr = (re) => (e) => e.code === 'package' && e.reason === 'signature' && re.test(e.message) && St.updateErrorCode(e) === 'package';
  try {
    assert.ok((await U.downloadVerified({ base: rel.base, keys: [] })).equals(gz));
    if (!U.SIGNING_KEYS.length) assert.ok((await U.downloadVerified({ base: rel.base })).equals(gz), '저장소에 공개 키가 없으면 기본도 SHA-256만');
    assert.ok(!rel.hits.some((h) => h.endsWith('.sig')), '키가 없으면 .sig를 받지 않음');
    await assert.rejects(U.downloadVerified({ base: rel.base, keys: [a.x] }), sigErr(/서명\(\.sig\)이 없어요/));
    files['lecpage-connect.tar.gz.sig'] = sigOf(gz, b.privateKey);
    await assert.rejects(U.downloadVerified({ base: rel.base, keys: [a.x] }), sigErr(/맞지 않아요/), '다른 키의 서명');
    files['lecpage-connect.tar.gz.sig'] = 'garbage\n';
    await assert.rejects(U.downloadVerified({ base: rel.base, keys: [a.x] }), sigErr(/맞지 않아요/), '서명이 아닌 글');
    // 릴리스 파일을 바꿀 수 있는 사람이 묶음과 .sha256을 함께 바꿔도, 비밀 키 없이는 맞는 서명을 만들 수 없음
    const evil = pkg('6.6.6-evil');
    Object.assign(files, { 'lecpage-connect.tar.gz': evil, 'lecpage-connect.tar.gz.sha256': `${sha(evil)}  lecpage-connect.tar.gz\n`, 'lecpage-connect.tar.gz.sig': sigOf(gz, a.privateKey) });
    await assert.rejects(U.downloadVerified({ base: rel.base, keys: [a.x] }), sigErr(/맞지 않아요/), 'SHA-256은 맞지만 서명이 다른 묶음');
    Object.assign(files, { 'lecpage-connect.tar.gz': gz, 'lecpage-connect.tar.gz.sha256': `${sha(gz)}  lecpage-connect.tar.gz\n` });
    assert.ok((await U.downloadVerified({ base: rel.base, keys: [b.x, a.x] })).equals(gz), '키를 바꾸는 동안: 목록의 키 하나로 맞으면 받음');
    // SHA-256이 틀리면 서명보다 먼저 거절(지금과 같은 까닭)
    files['lecpage-connect.tar.gz.sha256'] = `${'0'.repeat(64)}\n`;
    await assert.rejects(U.downloadVerified({ base: rel.base, keys: [a.x] }), (e) => e.code === 'sha256');
  } finally { await rel.close(); }
});

test('새 판으로 바꾸기(applyUpdate): 서명이 없거나 맞지 않으면 아무것도 바꾸지 않음(.new·.old도 남지 않음) · 맞으면 바꿈', async () => {
  const a = keyPair(); const b = keyPair();
  const gz = pkg('1.2.0-new');
  const files = { VERSION: '1.2.0-new\n', 'lecpage-connect.tar.gz': gz, 'lecpage-connect.tar.gz.sha256': `${sha(gz)}  lecpage-connect.tar.gz\n` };
  const rel = await release(files);
  const root = fakeRoot('1.1.0-old');
  const untouched = () => {
    assert.equal(readFileSync(join(root, 'VERSION'), 'utf8').trim(), '1.1.0-old');
    assert.equal(readFileSync(join(root, 'skills', 'lecpage', 'scripts', 'lecpage.mjs'), 'utf8'), '// 예전 판\n');
    assert.ok(!existsSync(`${root}.new`) && !existsSync(`${root}.old`));
  };
  try {
    const stages = [];
    await assert.rejects(U.applyUpdate({ root, base: rel.base, keys: [a.x], onStage: (s) => stages.push(s) }), (e) => e.reason === 'signature');
    assert.deepEqual(stages, ['download'], '확인 전에는 풀지 않음'); untouched();
    files['lecpage-connect.tar.gz.sig'] = sigOf(gz, b.privateKey);
    await assert.rejects(U.applyUpdate({ root, base: rel.base, keys: [a.x] }), (e) => e.reason === 'signature'); untouched();
    files['lecpage-connect.tar.gz.sig'] = sigOf(gz, a.privateKey);
    const r = await U.applyUpdate({ root, base: rel.base, keys: [a.x] });
    assert.deepEqual({ from: r.from, to: r.to }, { from: '1.1.0-old', to: '1.2.0-new' });
    assert.equal(readFileSync(join(root, 'skills', 'lecpage', 'scripts', 'lecpage.mjs'), 'utf8'), '// 새 판\n');
  } finally { await rel.close(); }
});

test('윈도우 자동 시작 복사본: 확인을 마친 묶음의 실행 파일로 바꾸고 다운로드 표시를 지움 · 머리 부분이 다르면(도는 중일 수 있음) 그대로 · 윈도우·받은 묶음에서만', () => {
  const cmd = (tag, head = 'powershell -NoProfile -Command "x"') => Buffer.from(`@echo off\r\nsetlocal\r\n${head}\r\nexit /b %RC%\r\n##PS##\r\n# ${tag}\r\n`);
  const root = fakeRoot('1.2.0-new');
  writeFileSync(join(root, 'lecpage-connect.cmd'), cmd('새 판'));
  const lp = mkdtempSync(join(T, 'lp-win-'));
  const launcher = join(lp, 'lecpage-connect.cmd'); const legacy = join(lp, 'lecpage-studio.cmd');
  writeFileSync(launcher, cmd('예전 판'));
  writeFileSync(`${launcher}:Zone.Identifier`, '[ZoneTransfer]\r\nZoneId=3\r\n'); // 윈도우의 대체 데이터 스트림 이름(여기서는 보통 파일로 흉내)
  writeFileSync(legacy, cmd('더 예전 판', 'powershell -NoProfile -Command "y"'));
  const env = { LECPAGE_LAUNCHER: launcher };
  assert.deepEqual(U.refreshLauncher({ root, env, platform: 'linux' }), [], '윈도우에서만');
  assert.deepEqual(U.refreshLauncher({ root, env: {}, platform: 'win32' }), [], '받은 실행 파일로 켰을 때만');
  assert.deepEqual(U.refreshLauncher({ root, env, platform: 'win32' }), [launcher]);
  assert.ok(readFileSync(launcher).equals(cmd('새 판')));
  assert.ok(!existsSync(`${launcher}:Zone.Identifier`), '묶음과 같은 내용이 된 복사본의 다운로드 표시를 지움');
  assert.match(readFileSync(legacy, 'utf8'), /더 예전 판/, '머리 부분이 다르면 바꾸지 않음(도는 중이면 cmd가 엉뚱한 자리를 읽음)');
  assert.ok(!existsSync(`${launcher}.new`));
  writeFileSync(`${launcher}:Zone.Identifier`, 'ZoneId=3');
  assert.deepEqual(U.refreshLauncher({ root, env, platform: 'win32' }), [], '이미 같으면 바꾸지 않음');
  assert.ok(!existsSync(`${launcher}:Zone.Identifier`), '같은 내용이면 표시만 지움');
  mkdirSync(join(root, '.git'));
  writeFileSync(launcher, cmd('예전 판'));
  assert.deepEqual(U.refreshLauncher({ root, env, platform: 'win32' }), [], '저장소에서 켠 것은 건드리지 않음');
  assert.equal(U.batchHead(Buffer.from('no marker')), null);
});
