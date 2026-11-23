// 짝 증명(GET /bridge/prove): 토큰을 보내기 전에 그 포트의 프로그램이 이 토큰을 아는 lecpage 커넥트인지 확인.
// 같은 PC의 다른 프로그램이 가까운 포트에서 커넥트인 척(토큰 없는 물음에 401 token) 답해도 짝 맞춤 토큰이 가지 않아야 함.
//   커넥트: scripts/studio.mjs(증명 끝점, findRunning) · 앱: app/src/lib/gen/local.js(bridgeRaw가 증명을 받은 뒤에만 토큰을 보냄)
// 포트는 4521~4539만 씀(가짜 서버). 커넥트는 빈 포트를 스스로 고름
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import http from 'node:http';
import { startStudio, findRunning, proofOf, proveSeen, savedToken, studioAgain, CAPS, PROVE_PATH } from '../../scripts/studio.mjs';

let T;
before(() => { T = mkdtempSync(join(tmpdir(), 'lp-prove-')); });
after(() => { rmSync(T, { recursive: true, force: true }); });
const NONCE = 'ab'.repeat(32);
const quiet = () => {};
const studio = (home) => startStudio({ port: 0, remote: true, appUrl: 'http://127.0.0.1:9', home: home || mkdtempSync(join(T, 'home-')), log: quiet });
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

/**
 * 커넥트가 아닌 프로그램. kind:
 *  'old'   토큰 없는 물음에 401 token(증명 길이 없는 예전 판 커넥트의 답 꼴 = 커넥트인 척하는 가짜의 답 꼴), 토큰이 오면 상태를 답함
 *  'relay' 증명 물음을 진짜 커넥트(to 포트)에 넘겨 받은 답을 그대로 돌려줌(중간에서 받아 넘기기), 그 밖은 'old'와 같음
 *  'other' 무엇에든 200 {}
 * got.tokens: 받은 짝 맞춤 토큰 수
 */
async function fake(port, kind, to = 0) {
  const got = { tokens: 0, proves: 0 };
  const srv = http.createServer(async (q, s) => {
    const u = new URL(q.url, 'http://x');
    const tk = q.headers['x-lecpage-bridge'];
    if (tk) got.tokens++;
    const json = (status, body) => { s.writeHead(status, { 'content-type': 'application/json', ...cors }); s.end(JSON.stringify(body)); };
    if (q.method === 'OPTIONS') { s.writeHead(204, cors); return s.end(); }
    if (kind === 'other') return json(200, {});
    if (kind === 'drop' && u.pathname === PROVE_PATH) return q.socket.destroy(); // 증명 물음은 끊어 버리고 나머지는 'old'처럼
    if (u.pathname === PROVE_PATH) {
      got.proves++;
      if (kind === 'relay') { const r = await fetch(`http://127.0.0.1:${to}${PROVE_PATH}${u.search}`); return json(r.status, await r.json()); }
      return json(401, { ok: false, error: 'token' });
    }
    if (!tk) return json(401, { ok: false, error: 'token', message_ko: '짝이 맞지 않아요.' });
    return json(200, { ok: true, version: '1.0.0', build: '1.0.0-old', caps: ['status-caps'], agents: [], chatgpt: { connected: false } });
  });
  await new Promise((ok, no) => { srv.once('error', no); srv.listen(port, '127.0.0.1', ok); });
  return { port: srv.address().port, got, close: () => new Promise((r) => { srv.closeAllConnections?.(); srv.close(r); }) };
}

test('증명 끝점: 토큰 없이 답하되 토큰을 내보이지 않음 · 답에 이 커넥트의 포트가 묶임 · 출처·꼴 검사', async () => {
  const st = await studio();
  try {
    const { token, port } = st.S;
    assert.ok(CAPS.includes('prove'));
    const r = await fetch(`${st.url}bridge/prove?nonce=${NONCE}`);
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.deepEqual(Object.keys(j).sort(), ['ok', 'proof']);
    assert.equal(j.proof, proofOf(token, port, NONCE));
    assert.notEqual(j.proof, proofOf(token, port + 1, NONCE), '다른 포트의 답으로는 쓸 수 없음');
    assert.notEqual(j.proof, proofOf('f'.repeat(64), port, NONCE));
    assert.ok(!JSON.stringify(j).includes(token));
    // 허용한 출처(lecpage.com)에는 CORS, 다른 출처는 거절
    const ok = await fetch(`${st.url}bridge/prove?nonce=${NONCE}`, { headers: { origin: 'https://lecpage.com' } });
    assert.equal(ok.status, 200); assert.equal(ok.headers.get('access-control-allow-origin'), 'https://lecpage.com');
    assert.equal((await fetch(`${st.url}bridge/prove?nonce=${NONCE}`, { headers: { origin: 'https://evil.example' } })).status, 403);
    assert.equal((await fetch(`${st.url}bridge/prove?nonce=${NONCE}`, { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
    for (const bad of ['', 'xyz', 'AB'.repeat(32), 'ab'.repeat(31), 'ab'.repeat(33)]) assert.equal((await fetch(`${st.url}bridge/prove?nonce=${bad}`)).status, 400, bad);
    // 증명 말고는 여전히 토큰이 있어야 함
    assert.equal((await fetch(`${st.url}bridge/status`)).status, 401);
    assert.equal((await fetch(`${st.url}bridge/prove?nonce=${NONCE}`, { method: 'POST', headers: { origin: 'https://lecpage.com' } })).status, 401, 'GET만 토큰 없이');
    assert.equal(proveSeen(st.S.home), true, '이 PC에서 증명 길이 있는 판을 켰음을 적어 둠');
    assert.equal(savedToken(st.S.home), token, '토큰은 그대로');
  } finally { await st.close(); }
});

test('켜진 커넥트 찾기(findRunning): 증명하는 내 커넥트만 · 커넥트인 척하는 곳과 다른 사용자의 커넥트에는 토큰을 보내지 않음', async () => {
  const mine = await studio(); const theirs = await studio(); // theirs: 같은 PC의 다른 사용자가 켠 커넥트(다른 토큰)
  const old = await fake(4521, 'old'); const relay = await fake(4522, 'relay', mine.S.port); const other = await fake(4523, 'other');
  try {
    const token = mine.S.token;
    const found = await findRunning(token, { ports: [other.port, relay.port, theirs.S.port, mine.S.port], strict: true });
    assert.equal(found?.port, mine.S.port);
    assert.equal(await findRunning(token, { ports: [theirs.S.port], strict: true }), null, '다른 사용자의 커넥트는 내 것이 아님');
    assert.equal(await findRunning(token, { ports: [theirs.S.port] }), null, '예전 판도 받는 때(strict 아님)에도 답이 틀린 곳은 아님');
    // 가짜: 예전 판인 척(401 token) · 진짜에게 받아 넘기기 · 아무 프로그램
    assert.equal(await findRunning(token, { ports: [old.port, relay.port, other.port], strict: true }), null);
    assert.equal(old.got.tokens + relay.got.tokens + other.got.tokens, 0, '증명하지 못한 곳에는 토큰이 가지 않음');
    assert.ok(relay.got.proves >= 1, '받아 넘긴 답은 포트가 달라 맞지 않음');
    assert.equal(await findRunning(token, { ports: [relay.port, other.port] }), null);
    assert.equal(relay.got.tokens + other.got.tokens, 0, '답이 틀린 곳은 strict가 아니어도 토큰을 받지 못함');
    // 증명 길이 없는 예전 판은 이 PC에서 새 판을 켠 적이 없을 때만(strict 아님) 지금처럼 받아들임
    const legacy = await findRunning(token, { ports: [old.port] });
    assert.equal(legacy?.port, old.port); assert.equal(old.got.tokens, 1);
    // studioAgain은 이 PC에서 새 판을 켠 적이 있으면(studio.json의 prove) strict로 찾음
    let asked = null;
    await studioAgain({ home: mine.S.home, find: async (t, o) => { asked = o; return null; }, log: quiet });
    assert.deepEqual(asked, { strict: true });
    const fresh = mkdtempSync(join(T, 'never-'));
    await studioAgain({ home: fresh, find: async (t, o) => { asked = o; return null; }, log: quiet });
    assert.deepEqual(asked, { strict: false });
    assert.ok(!readFileSync(join(mine.S.home, 'studio.json'), 'utf8').includes('.tmp'));
  } finally { await Promise.all([mine.close(), theirs.close(), old.close(), relay.close(), other.close()]); }
});

test('앱(local.js): 증명을 받은 뒤에만 토큰을 보냄 · 한 번 증명한 짝은 예전 판인 척하는 곳에 토큰을 보내지 않음 · 커넥트가 짝을 다시 열면 처음부터', async () => {
  // 브라우저 저장소 흉내(이 시험 파일만)
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } };
  globalThis.BroadcastChannel = undefined; // 앱 모듈이 불러올 때 여는 탭 사이 알림 채널은 Node에서 프로세스를 붙잡아 둠(이 시험과 무관)
  const L = await import('../../../../app/src/lib/gen/local.js');
  const st = await studio();
  const old = await fake(4524, 'old'); const relay = await fake(4525, 'relay', st.S.port); const other = await fake(4526, 'other');
  const token = st.S.token;
  const pair = (port, at = Date.now()) => { store.set('lecpage:pc', JSON.stringify({ token, port, ok: true, at })); L.forgetProofs(); };
  const call = async () => { try { const r = await L.bridgeRaw('/bridge/status'); return r.status; } catch (e) { return e.off ? 'off' : `error:${e.message}`; } };
  try {
    // 아직 증명한 적 없는 짝 + 증명 길이 없는 예전 판 꼴의 답: 지금처럼 씀(예전 판 커넥트와 계속 맞게)
    pair(old.port);
    assert.equal(await call(), 200); assert.equal(old.got.tokens, 1);
    assert.equal(store.has('lecpage:pc-proof'), false);
    // 진짜 커넥트: 증명을 받고 토큰을 보냄. 증명한 짝으로 표시
    pair(st.S.port);
    assert.equal(await call(), 200);
    assert.equal(JSON.parse(store.get('lecpage:pc-proof')).token, token);
    // 증명은 잠깐 기억함(요청마다 다시 묻지 않음)
    const before = relay.got.proves;
    assert.equal(await call(), 200); assert.equal(relay.got.proves, before);
    // 이제 같은 짝(같은 토큰)인데 그 포트에 예전 판인 척하는 프로그램이 있음 → 토큰을 보내지 않음
    const at = JSON.parse(store.get('lecpage:pc')).at;
    pair(old.port, at);
    assert.equal(await call(), 'off'); assert.equal(old.got.tokens, 1, '증명한 짝은 내려 앉지 않음');
    // 진짜에게 받아 넘기는 곳·아무 프로그램: 증명이 맞지 않아 토큰이 가지 않음(증명한 적 없는 짝이어도)
    pair(relay.port, at); assert.equal(await call(), 'off');
    pair(other.port, at); assert.equal(await call(), 'off');
    store.delete('lecpage:pc-proof');
    pair(relay.port, at); assert.equal(await call(), 'off');
    pair(other.port, at); assert.equal(await call(), 'off');
    assert.equal(relay.got.tokens + other.got.tokens, 0);
    // 닿지 않는 포트: 꺼짐
    pair(4539); assert.equal(await call(), 'off');
    // 증명 물음만 끊는 곳: 증명한 짝이면 토큰을 보내지 않음. 증명한 적 없는 짝이면 예전 판 꼴(토큰 없는 상태 물음에 401 token)로 보고 지금처럼
    const drop = await fake(4527, 'drop');
    try {
      store.set('lecpage:pc-proof', JSON.stringify({ token, at: Date.now() + 5000 }));
      pair(drop.port, at); assert.equal(await call(), 'off'); assert.equal(drop.got.tokens, 0);
      store.delete('lecpage:pc-proof');
      pair(drop.port, at); assert.equal(await call(), 200); assert.equal(drop.got.tokens, 1);
    } finally { await drop.close(); }
    // 커넥트가 연 #pair=…로 짝을 다시 기억하면(같은 토큰을 아는 쪽만 할 수 있음) 표시는 처음부터 → 예전 판 커넥트로 돌아간 사람도 다시 쓸 수 있음
    pair(st.S.port); assert.equal(await call(), 200); assert.ok(store.has('lecpage:pc-proof'));
    await new Promise((r) => setTimeout(r, 5));
    pair(old.port, Date.now() + 1000); // 증명한 때보다 나중에 다시 기억한 짝
    assert.equal(await call(), 200); assert.equal(old.got.tokens, 2);
  } finally { await Promise.all([st.close(), old.close(), relay.close(), other.close()]); delete globalThis.localStorage; }
});
