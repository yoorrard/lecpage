// lecpage 커넥트의 Cloudflare 한 번에 배포(scripts/studio-deploy.mjs, /bridge/cloudflare/*) 시험.
// 실제 wrangler·Cloudflare 대신 가짜(fixtures/fake-wrangler-cf.mjs)와 이 파일의 가짜 API·가짜 workers.dev로 끝까지:
// 로그인 기다림 → 계정 → 새 계정의 workers.dev 이름 → 참여 기능 서버 → 사이트 → 지우기. 포트는 4341~4350만 씀.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { startStudio, CAPS } from '../../scripts/studio.mjs';
import { safeRel, findJson, explain, RELAY_NAME } from '../../scripts/studio-deploy.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FAKE = join(HERE, 'fixtures', 'fake-wrangler-cf.mjs');
const API_PORT = 4350;
const ACC1 = 'a'.repeat(32), ACC2 = 'b'.repeat(32);
const TOKEN = 'cf-oauth-' + 'x'.repeat(40);
const KEY1 = 'K1' + 'a'.repeat(18), KEY2 = 'K2' + 'b'.repeat(18), KEY3 = 'K3' + 'c'.repeat(18);
let T, apiServer;
const PORT0 = 4341;
let nextPort = PORT0;
const taken = new Set(['busy-name']);

/** 가짜 Cloudflare API + 가짜 workers.dev(같은 상태 파일을 봄) */
function fakeCloudflare(stateOf) {
  return http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    const w = u.pathname.match(/^\/w\/([a-z0-9-]+)(\/.*)?$/);
    const file = req.headers['x-state'] || stateOf.current;
    let s; try { s = JSON.parse(readFileSync(file, 'utf8')); } catch { return send(500, {}); }
    if (w) { // https://<이름>.<계정>.workers.dev 자리
      const k = s.workers?.[w[1]];
      if (!k || k.draft || s.down?.includes(w[1])) return send(404, { ok: false });
      return send(200, { ok: true, runtime: 'cloudflare' });
    }
    if (req.headers.authorization !== `Bearer ${s.token}`) return send(403, { success: false, errors: [{ code: 10000, message: 'Authentication error' }] });
    const sub = u.pathname.match(/^\/accounts\/([a-f0-9]{32})\/workers\/subdomain$/);
    const sec = u.pathname.match(/^\/accounts\/([a-f0-9]{32})\/workers\/scripts\/([a-z0-9-]+)\/secrets$/);
    if (sub && req.method === 'GET') return s.sub ? send(200, { success: true, result: { subdomain: s.sub } }) : send(404, { success: false, errors: [{ code: 10007, message: 'not found' }] });
    if (sub && req.method === 'PUT') {
      let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => {
        const want = JSON.parse(b).subdomain;
        if (taken.has(want)) return send(409, { success: false, errors: [{ code: 10031, message: 'subdomain unavailable' }] });
        s.sub = want; writeFileSync(file, JSON.stringify(s)); send(200, { success: true, result: { subdomain: want } });
      });
      return undefined;
    }
    if (sec && req.method === 'GET') { const k = s.workers?.[sec[2]]; return k ? send(200, { success: true, result: k.secrets.map((name) => ({ name, type: 'secret_text' })) }) : send(404, { success: false, errors: [{ code: 10007, message: 'This Worker does not exist' }] }); }
    return send(404, { success: false, errors: [{ code: 7003, message: 'no route' }] });
  });
}
const cur = { current: '' };
before(async () => {
  T = mkdtempSync(join(tmpdir(), 'lp-cf-test-'));
  apiServer = fakeCloudflare(cur);
  await new Promise((ok) => apiServer.listen(API_PORT, '127.0.0.1', ok));
});
after(async () => { await new Promise((ok) => apiServer.close(ok)); rmSync(T, { recursive: true, force: true }); });

/** 가짜 계정 하나 + 커넥트 하나 */
async function rig(state = {}, { home } = {}) {
  const dir = mkdtempSync(join(T, 'r-'));
  const file = state.file || join(dir, 'cf.json'); const logFile = join(dir, 'wrangler.log');
  if (!state.file) writeFileSync(file, JSON.stringify({ loggedIn: true, approve: false, accounts: [{ id: ACC1, name: "Teacher's Account" }], sub: 'teacher', workers: {}, token: TOKEN, ...state }));
  cur.current = file;
  process.env.FAKE_CF_STATE = file; process.env.FAKE_WRANGLER_LOG = logFile;
  const lines = [];
  let st;
  for (let n = 0, pt = nextPort; ; n++, pt = pt >= 4349 ? PORT0 : pt + 1) { // 4341~4349 가운데 비어 있는 포트(이 파일의 다른 커넥트·다른 프로그램이 쓰고 있으면 다음 번호)
    try { st = await startStudio({ port: pt, remote: true, appUrl: 'http://127.0.0.1:9', home: home || mkdtempSync(join(dir, 'home-')), log: (l) => lines.push(l) }); break; }
    catch (e) { if (e.code !== 'EADDRINUSE' || n >= 8) throw e; }
  }
  nextPort = st.port >= 4349 ? PORT0 : st.port + 1; // 다음 커넥트는 다른 포트부터(같은 포트를 바로 다시 쓰면 fetch가 끊긴 연결을 다시 잡음)
  st.S.cfOpts = { wrangler: FAKE, api: `http://127.0.0.1:${API_PORT}`, urlBase: `http://127.0.0.1:${API_PORT}/w/`, open: false };
  const H = { 'x-lecpage-bridge': st.S.token, origin: 'https://lecpage.com', connection: 'close' };
  const base = `${st.url}bridge/cloudflare`;
  const get = async () => (await (await fetch(base, { headers: H })).json()).cf;
  const post = async (path, body) => { const r = await fetch(`${base}/${path}`, { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify(body || {}) }); return { status: r.status, ...(await r.json()) }; };
  const put = async (draft, path, data) => { const r = await fetch(`${base}/files?draft=${draft}&path=${encodeURIComponent(path)}`, { method: 'POST', headers: { ...H, 'content-type': 'application/octet-stream' }, body: Buffer.from(data) }); return { status: r.status, ...(await r.json()) }; };
  /** 물음이 나오거나(ask) 끝날 때까지 */
  const until = async (pred = (v) => !v.running, ms = 20000) => { const t0 = Date.now(); for (;;) { const v = await get(); if (pred(v)) return v; if (Date.now() - t0 > ms) throw new Error('기다리다 끝남: ' + JSON.stringify(v)); await new Promise((r) => setTimeout(r, 40)); } };
  const state2 = () => JSON.parse(readFileSync(file, 'utf8'));
  const patch = (o) => writeFileSync(file, JSON.stringify({ ...state2(), ...o }));
  const wlog = () => (existsSync(logFile) ? readFileSync(logFile, 'utf8') : '');
  return { st, H, base, get, post, put, until, file, state: state2, patch, wlog, lines, home: st.S.home, close: () => st.close() };
}

test('순수 함수: 경로 검사 · JSON 찾기 · 실패 까닭', () => {
  for (const ok of ['index.html', 'pages/001.webp', 'files/교재 1.pdf', '.well-known/x.txt', 'a/b/c.d.e']) assert.equal(safeRel(ok), ok.normalize('NFC'), ok);
  for (const bad of ['', '../x', 'a/../b', '/etc/passwd', 'a\\b', 'C:/x', 'a//b', 'a/./b', 'x/', 'con', 'a/NUL.txt', 'a/b.', 'a/ b', 'a\u0000b', 'q?x', 'a'.repeat(401)]) assert.equal(safeRel(bad), '', JSON.stringify(bad));
  assert.deepEqual(findJson('▲ [WARNING] Proxy {env}\n\n{"loggedIn":false}\n'), { loggedIn: false });
  assert.deepEqual(findJson(' ⛅️ wrangler\n{\n  "loggedIn": true,\n  "accounts": [{ "id": "x" }]\n}\n'), { loggedIn: true, accounts: [{ id: 'x' }] });
  assert.equal(findJson('nothing here'), null);
  assert.equal(explain('You need to verify your email address to use Workers. [code: 10034]').code, 'email');
  assert.equal(explain('npm error code E404').code, 'tool');
  assert.equal(explain('getaddrinfo ENOTFOUND api.cloudflare.com').code, 'network');
  assert.equal(explain('Error: listen EADDRINUSE: address already in use 127.0.0.1:8976').code, 'login-busy');
  assert.equal(explain('weird').code, 'failed');
  assert.ok(!/abcdefghij1234567890XYZ/.test(explain('token: abcdefghij1234567890XYZ failed').detail), '토큰 모양은 가림');
});

test('짝 토큰 없이는 받지 않음 · caps에 cloudflare · 처음 상태', async () => {
  const r = await rig();
  try {
    assert.ok(CAPS.includes('cloudflare'));
    assert.equal((await fetch(r.base, { headers: { origin: 'https://lecpage.com' } })).status, 401);
    assert.equal((await fetch(r.base, { headers: { ...r.H, origin: 'https://evil.example' } })).status, 403);
    assert.equal((await fetch(`${r.base}/relay`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://lecpage.com' }, body: '{}' })).status, 401);
    assert.deepEqual(await r.get(), { running: false, phase: 'idle' });
    assert.equal((await r.post('nope')).status, 404);
    assert.equal((await r.post('site', { name: 'Bad Name!', draft: 'x' })).error, 'bad-name');
    assert.equal((await r.post('site', { name: 'x; rm -rf /', draft: 'x' })).error, 'bad-name');
    assert.equal(r.wlog(), '', '잘못된 요청으로는 wrangler를 부르지 않음');
  } finally { await r.close(); }
});

test('참여 기능 서버: 처음이면 로그인을 기다렸다가 만들고 관리자 키를 넣음 → 다음에는 그대로 씀(다시 올리지 않음)', async () => {
  const r = await rig({ loggedIn: false });
  try {
    const s = await r.post('relay', { adminKey: KEY1 });
    assert.equal(s.status, 202);
    assert.equal((await r.post('relay', { adminKey: KEY2 })).status, 409, '한 번에 하나');
    const w = await r.until((v) => v.phase === 'login' && v.loginUrl);
    assert.match(w.loginUrl, /oauth2\/auth/);
    assert.ok(w.running);
    r.patch({ approve: true }); // 브라우저에서 [Allow]
    const d = await r.until();
    assert.equal(d.phase, 'done', JSON.stringify(d));
    assert.deepEqual(d.result.relay, { url: `http://127.0.0.1:${API_PORT}/w/${RELAY_NAME}`, name: RELAY_NAME, created: true, key: KEY1 });
    assert.equal(d.result.account.name, "Teacher's Account");
    assert.ok(!JSON.stringify(d).includes(TOKEN), '토큰은 앱에 가지 않음');
    const log1 = r.wlog();
    assert.equal(log1, 'whoami\nlogin\nwhoami\nauth token @aaaa\ndeploy lecpage-live @aaaa\nsecret put lecpage-live @aaaa\n  ADMIN_KEY (길이 20)\n');
    assert.ok(!log1.includes(KEY1) && !r.lines.join('\n').includes(KEY1) && !r.lines.join('\n').includes(TOKEN), '키·토큰은 기록에 없음');
    assert.equal(r.state().workers[RELAY_NAME].key, 'len20:K1');
    const f = join(r.home, 'cloudflare.json');
    assert.equal(JSON.parse(readFileSync(f, 'utf8')).accounts[ACC1].relay.key, KEY1);
    if (process.platform !== 'win32') assert.equal(statSync(f).mode & 0o777, 0o600, '본인만 읽기');
    // 두 번째: 있는 서버를 그대로(키는 이 PC가 기억한 것)
    await r.post('relay', { adminKey: KEY2 });
    const d2 = await r.until();
    assert.deepEqual(d2.result.relay, { url: d.result.relay.url, name: RELAY_NAME, created: false, key: KEY1 });
    assert.equal(r.state().workers[RELAY_NAME].deploys, 1, '다시 올리지 않음');
    assert.equal(r.state().workers[RELAY_NAME].key, 'len20:K1', '키도 그대로');
    assert.ok(!/login/.test(r.wlog().slice(log1.length)), '다시 로그인하지 않음');
  } finally { await r.close(); }
});

test('다른 PC에서 만든 서버(이 PC는 키를 모름): 건드리지 않고 알려 줌 → rotate로만 새 키', async () => {
  const r = await rig({ workers: { [RELAY_NAME]: { secrets: ['ADMIN_KEY'], key: 'len20:ZZ', deploys: 1 } } });
  try {
    await r.post('relay', { adminKey: KEY2 });
    const d = await r.until();
    assert.deepEqual(d.result.relay, { url: `http://127.0.0.1:${API_PORT}/w/${RELAY_NAME}`, name: RELAY_NAME, created: false, keyUnknown: true });
    assert.equal(r.state().workers[RELAY_NAME].key, 'len20:ZZ');
    assert.ok(!/deploy|secret put/.test(r.wlog()));
    await r.post('relay', { adminKey: KEY3, rotate: true });
    const d2 = await r.until();
    assert.equal(d2.result.relay.key, KEY3);
    assert.equal(r.state().workers[RELAY_NAME].key, 'len20:K3');
    assert.equal(r.state().workers[RELAY_NAME].deploys, 1, '코드·설정은 그대로');
    // 답이 없는 남의 서버는 덮지 않음
    r.patch({ down: [RELAY_NAME] });
    const home2 = mkdtempSync(join(T, 'other-pc-'));
    const r2 = await rig({ file: r.file }, { home: home2 });
    try {
      await r2.post('relay', { adminKey: KEY1 });
      const d3 = await r2.until();
      assert.equal(d3.error.code, 'relay-down');
      assert.equal(r2.state().workers[RELAY_NAME].deploys, 1);
    } finally { await r2.close(); }
  } finally { await r.close(); }
});

test('새 계정: workers.dev 이름을 앱에 한 번 물음(잘못된 이름·이미 쓰는 이름은 다시) · 메일 미확인은 할 일을 알려 줌', async () => {
  const r = await rig({ sub: '' });
  try {
    await r.post('relay', { adminKey: KEY1 });
    const a = await r.until((v) => !!v.ask);
    assert.equal(a.ask.kind, 'subdomain'); assert.match(a.ask.suggest, /^lec-[a-f0-9]{6}$/);
    assert.equal((await r.post('answer', { account: ACC1 })).status, 409, '물음과 다른 답은 받지 않음');
    await r.post('answer', { subdomain: 'Bad_Name' });
    assert.equal((await r.until((v) => v.ask?.problem)).ask.problem, 'invalid');
    await r.post('answer', { subdomain: 'busy-name' });
    assert.equal((await r.until((v) => v.ask?.problem === 'taken')).ask.problem, 'taken');
    await r.post('answer', { subdomain: 'kim-class' });
    const d = await r.until();
    assert.equal(d.phase, 'done', JSON.stringify(d));
    assert.equal(r.state().sub, 'kim-class');
    assert.ok(r.lines.some((l) => /workers\.dev 이름을 정했어요/.test(l)));
  } finally { await r.close(); }
  const e = await rig({ fail: { deploy: 'email' } });
  try {
    await e.post('relay', { adminKey: KEY1 });
    const d = await e.until();
    assert.equal(d.phase, 'error'); assert.equal(d.error.code, 'email'); assert.match(d.error.message_ko, /확인 메일/);
  } finally { await e.close(); }
});

test('계정이 여럿: 앱에서 한 번 고르고(목록에 있는 것만) 다음부터는 묻지 않음', async () => {
  const r = await rig({ accounts: [{ id: ACC1, name: '개인' }, { id: ACC2, name: '○○연수원' }] });
  try {
    await r.post('relay', { adminKey: KEY1 });
    const a = await r.until((v) => !!v.ask);
    assert.deepEqual(a.ask, { kind: 'account', accounts: [{ id: ACC1, name: '개인' }, { id: ACC2, name: '○○연수원' }] });
    assert.equal((await r.post('answer', { account: 'c'.repeat(32) })).status, 409);
    assert.equal((await r.post('answer', { account: ACC2 })).status, 200);
    const d = await r.until();
    assert.equal(d.phase, 'done', JSON.stringify(d)); assert.equal(d.result.account.name, '○○연수원');
    assert.match(r.wlog(), /deploy lecpage-live @bbbb/, '고른 계정으로');
    r.st.S.cf.auth = null; // 5분 기억이 지난 뒤
    await r.post('relay', { adminKey: KEY2 });
    const d2 = await r.until((v) => !v.running || !!v.ask);
    assert.equal(d2.phase, 'done', '다시 묻지 않음');
  } finally { await r.close(); }
});

test('사이트: 파일을 받아 올림 · 위험한 경로는 거절 · 남이 쓰는 이름은 덮지 않음 · 지우기는 이 커넥트가 올린 것만', async () => {
  const r = await rig({ workers: { 'my-blog': { secrets: [], deploys: 3 } } });
  try {
    const dr = await r.post('draft');
    assert.match(dr.draft, /^[a-f0-9]{16}$/);
    assert.equal((await r.put(dr.draft, 'index.html', '<!doctype html><title>연수</title>')).status, 200);
    assert.equal((await r.put(dr.draft, 'pages/001.webp', 'img')).status, 200);
    for (const bad of ['../evil.txt', '/abs.txt', 'a\\b.txt', 'x/../../y']) assert.equal((await r.put(dr.draft, bad, 'x')).error, 'bad-path', bad);
    assert.equal((await r.put('0'.repeat(16), 'a.txt', 'x')).error, 'no-draft');
    assert.equal((await r.post('site', { draft: dr.draft, name: RELAY_NAME })).status, 202);
    assert.equal((await r.until()).error.code, 'name-taken', '참여 기능 서버 이름은 사이트로 못 씀');
    await r.post('site', { draft: dr.draft, name: 'my-blog' });
    const t = await r.until();
    assert.equal(t.error.code, 'name-taken'); assert.equal(r.state().workers['my-blog'].deploys, 3, '남의 Worker는 그대로');
    await r.post('site', { draft: dr.draft, name: 'lec-20261123-ab12' });
    const d = await r.until();
    assert.equal(d.phase, 'done', JSON.stringify(d));
    assert.deepEqual(d.result.site, { url: `http://127.0.0.1:${API_PORT}/w/lec-20261123-ab12/`, name: 'lec-20261123-ab12', ready: true });
    const w = r.state().workers['lec-20261123-ab12'];
    assert.equal(w.files, 2); assert.match(w.index, /연수/);
    assert.equal((await r.put(dr.draft, 'late.txt', 'x')).error, 'no-draft', '올린 뒤 받은 자리는 지움');
    // 같은 이름에 다시(이 커넥트가 올린 것이라 묻지 않고)
    const d2r = await r.post('draft'); await r.put(d2r.draft, 'index.html', '<!doctype html><title>고침</title>');
    await r.post('site', { draft: d2r.draft, name: 'lec-20261123-ab12' });
    assert.equal((await r.until()).phase, 'done'); assert.equal(r.state().workers['lec-20261123-ab12'].deploys, 2);
    // 지우기
    await r.post('delete', { name: 'my-blog' });
    assert.equal((await r.until()).error.code, 'not-ours'); assert.ok(r.state().workers['my-blog']);
    await r.post('delete', { name: 'lec-20261123-ab12' });
    const del = await r.until();
    assert.deepEqual(del.result, { deleted: 'lec-20261123-ab12', relay: false });
    assert.ok(!r.state().workers['lec-20261123-ab12']);
    await r.post('delete', { name: 'lec-20261123-ab12' });
    assert.equal((await r.until()).error.code, 'not-ours', '지운 뒤에는 목록에 없음');
  } finally { await r.close(); }
});

test('지울 때 참여 기능 서버도 함께(relay) · 로그인 기다리다 멈추면 wrangler도 끝남 · 로그아웃', async () => {
  const r = await rig();
  try {
    await r.post('relay', { adminKey: KEY1 }); await r.until();
    const dr = await r.post('draft'); await r.put(dr.draft, 'index.html', '<!doctype html>');
    await r.post('site', { draft: dr.draft, name: 'lec-a' }); await r.until();
    await r.post('delete', { name: 'lec-a', relay: true });
    assert.deepEqual((await r.until()).result, { deleted: 'lec-a', relay: true });
    assert.deepEqual(Object.keys(r.state().workers), []);
    assert.equal(JSON.parse(readFileSync(join(r.home, 'cloudflare.json'), 'utf8')).accounts[ACC1].relay, undefined);
    await r.post('logout');
    assert.deepEqual((await r.until()).result, { loggedOut: true });
    assert.equal(r.state().loggedIn, false);
    await r.post('relay', { adminKey: KEY1 });
    await r.until((v) => v.phase === 'login' && v.loginUrl);
    const c = await (await fetch(r.base, { method: 'DELETE', headers: r.H })).json();
    assert.equal(c.cf.running, false); assert.equal(c.cf.error.code, 'cancelled');
    assert.equal(r.st.S.inflight || 0, 0, '끝나면 쓰는 중 표시를 내림');
    assert.equal(r.st.S.cf.task.procs.size, 0, '기다리던 wrangler를 끔');
  } finally { await r.close(); }
});
