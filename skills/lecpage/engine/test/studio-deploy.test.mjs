// lecpage 커넥트의 Cloudflare 한 번에 배포(scripts/studio-deploy.mjs, /bridge/cloudflare/*) 시험.
// 실제 wrangler·Cloudflare 대신 가짜(fixtures/fake-wrangler-cf.mjs)와 이 파일의 가짜 API·가짜 workers.dev로 끝까지:
// 로그인 기다림 → 계정 → 새 계정의 workers.dev 이름 → 참여 기능 서버 → 사이트 → 지우기. 포트는 4341~4350만 씀.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, statSync, readdirSync, realpathSync, mkdirSync, utimesSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { startStudio, CAPS } from '../../scripts/studio.mjs';
import { safeRel, findJson, explain, RELAY_NAME, cleanWork, workRoot, wranglerLoginFiles } from '../../scripts/studio-deploy.mjs';
import { redact, findUrl, toolDir } from '../../scripts/publish.mjs';

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
      if ((!w[2] || w[2] === '/') && k.index) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(k.index); } // 사이트의 첫 화면
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

// ── 독립 검토에서 고친 것 ──────────────────────────────────────────────
const LEC_INDEX = '<!doctype html><html><head><meta charset="utf-8"><meta name="generator" content="lecpage 1.1.0"><title>연수</title></head><body></body></html>';
const site1 = async (r, name, more = {}, index = '<!doctype html><title>t</title>') => { const d = await r.post('draft'); assert.equal((await r.put(d.draft, 'index.html', index)).status, 200); return r.post('site', { draft: d.draft, name, ...more }); };

test('순수 함수(고침): 오류 번호는 [code: N] 꼴만 · 넓은 낱말로 잘못 짚지 않음 · JSON 꼴 비밀 가림 · 짧은 이름의 주소 찾기', () => {
  assert.equal(explain('Authentication error [code: 10000]').code, 'login-needed');
  assert.equal(explain('Uploaded 10000 files (10034 KiB)').code, 'failed', '맨 숫자는 오류 번호가 아님');
  assert.equal(explain('The deployment preview link has expired').code, 'failed', 'expired만으로 로그인 문제로 보지 않음');
  assert.equal(explain('Your login session has expired, please log in').code, 'login-needed');
  assert.equal(explain('Deploying to the Cloudflare network …done').code, 'failed', 'network라는 낱말만으로 망 문제로 보지 않음');
  assert.equal(explain('TypeError: fetch failed').code, 'network');
  assert.equal(redact('{"type":"api_key","key":"0123456789abcdef0123456789abcdef01234","email":"a@b.c"}'), '{"type":"api_key","key":"***","email":"a@b.c"}');
  assert.ok(!redact('{\n  "token": "v1.0-abcdefghijklmnop"\n}').includes('abcdefghijklmnop'));
  assert.equal(findUrl('문서 https://developers.cloudflare.com/a/b 와 https://a.acct.workers.dev', 'a'), 'https://a.acct.workers.dev');
  assert.equal(findUrl('문서 https://developers.cloudflare.com/a/b', 'a'), '', '이름이 든 다른 주소를 고르지 않음');
  assert.equal(findUrl('http://127.0.0.1:4000/w/lec-10/', 'lec-1'), '');
});

test('배포 도구는 이 PC 사용자 폴더 안 작업 폴더에서 돎(공용 임시 폴더 바로 아래가 아님) · 빈 package.json·wrangler.toml · 끝나면 치움', async () => {
  const r = await rig();
  const cwdLog = join(dirname(r.file), 'cwd.log'); process.env.FAKE_WRANGLER_CWD = cwdLog;
  try {
    assert.equal((await r.post('relay', { adminKey: KEY1 })).status, 202);
    assert.equal((await r.until()).phase, 'done');
    assert.equal((await site1(r, 'lec-work')).status, 202);
    assert.equal((await r.until()).phase, 'done');
    const rows = readFileSync(cwdLog, 'utf8').trim().split('\n').map((l) => l.split('\t'));
    assert.ok(rows.length >= 5, String(rows.length));
    const root = realpathSync(join(r.home, 'work'));
    for (const [cwd, pkg, toml] of rows) {
      assert.ok(cwd.startsWith(root + sep), `${cwd} 는 ${root} 안이어야`);
      assert.equal(pkg, 'true', 'npm이 위로 올라가지 않게 빈 package.json'); assert.equal(toml, 'true', 'wrangler가 위쪽 설정을 읽지 않게 wrangler.toml');
    }
    if (process.platform !== 'win32') assert.equal(statSync(root).mode & 0o777, 0o700, '본인만 드나듦');
    assert.ok(existsSync(join(root, 'package.json')));
    assert.deepEqual(readdirSync(root).filter((n) => n.startsWith('lecpage-studio-')), [], '끝난 작업 폴더와 받아 둔 사이트 파일을 치움');
    assert.equal(r.state().workers['lec-work'].files, 1, '올릴 파일에 작업용 파일이 섞이지 않음');
    // 지난 실행이 남긴 작업 폴더는 켤 때 치움(6시간 넘은 것만)
    const old = join(root, 'lecpage-studio-cf-old1'), fresh = join(root, 'lecpage-studio-cf-new1');
    mkdirSync(old); mkdirSync(fresh); const past = new Date(Date.now() - 7 * 3600e3); utimesSync(old, past, past);
    cleanWork(r.st.S);
    assert.equal(existsSync(old), false); assert.equal(existsSync(fresh), true);
    assert.equal(workRoot(r.st.S), join(r.home, 'work'));
    // Skill CLI의 작업 폴더도 같은 꼴
    const td = toolDir('lecpage-test-');
    try { assert.ok(existsSync(join(td, 'package.json')) && existsSync(join(td, 'wrangler.toml'))); } finally { rmSync(td, { recursive: true, force: true }); }
  } finally { delete process.env.FAKE_WRANGLER_CWD; await r.close(); }
});

test('전역 API 키로 로그인된 PC: 키를 앱·기록에 내보내지 않고 할 일을 알려 줌', async () => {
  const SECRET = '0123456789abcdef0123456789abcdef01234';
  const r = await rig({ apiKey: SECRET });
  try {
    await r.post('relay', { adminKey: KEY1 });
    const d = await r.until();
    assert.equal(d.error.code, 'env-key', JSON.stringify(d.error));
    assert.match(d.error.message_ko, /CLOUDFLARE_API_KEY/);
    assert.ok(!JSON.stringify(d).includes(SECRET) && !r.lines.join('\n').includes(SECRET), '키가 앱·기록에 없음');
    assert.ok(!/deploy|secret put/.test(r.wlog()));
  } finally { await r.close(); }
});

test('같은 주소로 다시(again): 이 커넥트가 올린 적 없는 이름은 그 주소에 lecpage 사이트가 있을 때만 덮음', async () => {
  const r = await rig({ workers: { 'my-api': { secrets: [], deploys: 3, assets: true, files: 9, index: '<!doctype html><title>회사 API 문서</title>' }, 'old-lec': { secrets: [], deploys: 1, assets: true, files: 2, index: LEC_INDEX } } });
  try {
    await site1(r, 'my-api');
    assert.equal((await r.until()).error.code, 'name-taken');
    await site1(r, 'my-api', { again: true }); // 앱의 기록(남이 준 연수 파일에도 들어 있을 수 있음)이 '같은 주소'라고 해도
    const d = await r.until();
    assert.equal(d.error.code, 'exists', JSON.stringify(d));
    assert.match(d.error.message_ko, /덮어쓰지 않았어요/);
    assert.equal(r.state().workers['my-api'].deploys, 3, '강사의 다른 Worker를 덮지 않음');
    assert.ok(!/deploy my-api/.test(r.wlog()));
    // 다른 PC에서 올린 lecpage 사이트(첫 화면에 lecpage 표시)는 같은 주소로 다시 올릴 수 있고, 그 뒤로는 이 커넥트의 것
    await site1(r, 'old-lec', { again: true }, LEC_INDEX);
    const d2 = await r.until();
    assert.equal(d2.phase, 'done', JSON.stringify(d2));
    assert.equal(r.state().workers['old-lec'].deploys, 2);
    assert.ok(JSON.parse(readFileSync(join(r.home, 'cloudflare.json'), 'utf8')).accounts[ACC1].sites.includes('old-lec'));
  } finally { await r.close(); }
});

test('있던 참여 기능 서버는 이 PC에서 주소가 안 열려도 다시 올리지 않음(까닭을 나눠 알림) · 만들다 만 것만 다시 올림', async () => {
  const r = await rig();
  try {
    await r.post('relay', { adminKey: KEY1 }); assert.equal((await r.until()).phase, 'done');
    assert.equal(r.state().workers[RELAY_NAME].deploys, 1);
    // 서버가 200이 아닌 답을 함
    r.patch({ down: [RELAY_NAME] });
    await r.post('relay', { adminKey: KEY2 });
    const d = await r.until();
    assert.equal(d.error.code, 'relay-down', JSON.stringify(d));
    assert.equal(r.state().workers[RELAY_NAME].deploys, 1, '우리가 만든 서버여도 다시 올리지 않음(강사가 붙인 설정을 덮지 않게)');
    assert.equal(r.state().workers[RELAY_NAME].key, 'len20:K1', '관리자 키도 그대로');
    // 이 PC의 망에서 주소에 닿지 못함(기관 망이 workers.dev를 막음)
    r.patch({ down: [] });
    r.st.S.cfOpts = { ...r.st.S.cfOpts, urlBase: 'http://127.0.0.1:9/w/' };
    await r.post('relay', { adminKey: KEY2 });
    const d2 = await r.until();
    assert.equal(d2.error.code, 'relay-unreachable', JSON.stringify(d2));
    assert.match(d2.error.message_ko, /다른 인터넷/);
    assert.equal(r.state().workers[RELAY_NAME].deploys, 1);
    assert.ok(!/deploy lecpage-live[^\n]*\n[\s\S]*deploy lecpage-live/.test(r.wlog()), '한 번만 올림');
  } finally { await r.close(); }
  // 만들다 만 것(스크립트만 있고 관리자 키가 없음)은 다시 올리고 키를 넣음
  const r2 = await rig({ workers: { [RELAY_NAME]: { secrets: [], deploys: 1 } } });
  try {
    await r2.post('relay', { adminKey: KEY1 });
    const d = await r2.until();
    assert.equal(d.phase, 'done', JSON.stringify(d));
    assert.equal(d.result.relay.created, true); assert.equal(r2.state().workers[RELAY_NAME].deploys, 2); assert.equal(r2.state().workers[RELAY_NAME].key, 'len20:K1');
  } finally { await r2.close(); }
});

test('관리자 키: 결과에서 한 번만 내주고 · 그 밖의 답에는 싣지 않으며 · 로그아웃하면 이 PC에서도 지움', async () => {
  const r = await rig();
  try {
    const s = await r.post('relay', { adminKey: KEY1 });
    assert.ok(!JSON.stringify(s).includes(KEY1));
    const d = await r.until();
    assert.equal(d.result.relay.key, KEY1, '끝난 결과를 받아 갈 때 한 번');
    const again = await r.get();
    assert.equal(again.phase, 'done'); assert.equal(again.result.relay.url, d.result.relay.url);
    assert.ok(!JSON.stringify(again).includes(KEY1), '다시 물으면 키는 없음');
    assert.ok(!JSON.stringify(await r.post('answer', { account: ACC1 })).includes(KEY1));
    const f = join(r.home, 'cloudflare.json');
    assert.equal(JSON.parse(readFileSync(f, 'utf8')).accounts[ACC1].relay.key, KEY1, '이 PC에는 기억(같은 PC의 다른 브라우저에서도 쓰게)');
    // 다음 일의 결과로는 다시 받을 수 있음(짝이 맞는 앱만 시작할 수 있음)
    await r.post('relay', { adminKey: KEY2 });
    assert.equal((await r.until()).result.relay.key, KEY1);
    await site1(r, 'lec-keep'); assert.equal((await r.until()).phase, 'done');
    await r.post('logout');
    assert.deepEqual((await r.until()).result, { loggedOut: true });
    const st = JSON.parse(readFileSync(f, 'utf8'));
    assert.ok(!JSON.stringify(st).includes(KEY1), '로그아웃하면 이 PC에 둔 관리자 키를 지움');
    assert.equal(st.account, undefined);
    assert.deepEqual(st.accounts[ACC1].sites, ['lec-keep'], '올린 사이트 기록은 남김(다시 로그인하면 지울 수 있게)');
    if (process.platform !== 'win32') assert.equal(statSync(f).mode & 0o777, 0o600);
    assert.deepEqual(readdirSync(r.home).filter((n) => /\.tmp$/.test(n)), [], '임시 파일을 남기지 않음');
  } finally { await r.close(); }
});

test('잠깐 기억해 둔 토큰이 그사이 끝났으면 기억을 버리고 한 번 다시 함(로그인 창 없이 실패로 끝내지 않음)', async () => {
  const r = await rig();
  try {
    await r.post('relay', { adminKey: KEY1 }); assert.equal((await r.until()).phase, 'done');
    const n = r.wlog().split('\n').filter((l) => l.startsWith('whoami')).length;
    r.patch({ token: 'cf-oauth-' + 'y'.repeat(40) }); // Cloudflare 쪽에서 토큰이 바뀜(기억한 토큰은 이제 401)
    await site1(r, 'lec-fresh');
    const d = await r.until();
    assert.equal(d.phase, 'done', JSON.stringify(d));
    assert.equal(r.wlog().split('\n').filter((l) => l.startsWith('whoami')).length, n + 1, '로그인 상태를 다시 확인함');
    assert.ok(r.state().workers['lec-fresh']);
  } finally { await r.close(); }
});

test('지우기는 그 사이트를 올린 계정에서(기억한 계정이 그사이 바뀌어도) · 다른 계정의 것은 까닭을 알림', async () => {
  const r = await rig({ accounts: [{ id: ACC1, name: '개인' }, { id: ACC2, name: '○○연수원' }] });
  try {
    await site1(r, 'lec-acc');
    await r.until((v) => v.ask?.kind === 'account');
    assert.equal((await r.post('answer', { account: ACC1 })).status, 200);
    assert.equal((await r.until()).phase, 'done');
    const f = join(r.home, 'cloudflare.json');
    const st = JSON.parse(readFileSync(f, 'utf8')); st.account = ACC2; writeFileSync(f, JSON.stringify(st)); // 그 뒤 다른 계정을 골라 씀
    r.st.S.cf.auth = null; // 잠깐 기억해 둔 로그인도 지남
    const before = r.wlog().length;
    await r.post('delete', { name: 'lec-acc' });
    const d = await r.until();
    assert.deepEqual(d.result, { deleted: 'lec-acc', relay: false }, JSON.stringify(d));
    assert.match(r.wlog().slice(before), /delete lec-acc @aaaa/, '올린 계정에서 지움');
    assert.equal(r.state().workers['lec-acc'], undefined);
    // 그 계정을 이 로그인으로 쓸 수 없으면(다른 사람으로 로그인) 지운 것으로 끝내지 않고 알림
    await site1(r, 'lec-acc2'); assert.equal((await r.until()).phase, 'done'); // 기억한 계정 ACC2에
    r.patch({ accounts: [{ id: ACC1, name: '개인' }] }); r.st.S.cf.auth = null;
    await r.post('delete', { name: 'lec-acc2' });
    const d2 = await r.until();
    assert.equal(d2.error.code, 'other-account', JSON.stringify(d2));
    assert.ok(r.state().workers['lec-acc2'], '지우지 않음');
  } finally { await r.close(); }
});

test('배포 도구가 손자 프로세스에 출력을 넘긴 채 끝나도 일이 끝남(끝없이 도는 중으로 남지 않음)', { timeout: 30000 }, async () => {
  const r = await rig();
  // whoami 때 출력을 쥔 손자 프로세스를 남기는 wrangler(나머지는 가짜 wrangler 그대로)
  const wrap = join(dirname(r.file), 'wrap.mjs');
  writeFileSync(wrap, `import { spawn, spawnSync } from 'node:child_process';\nconst a = process.argv.slice(2);\nif (a[0] === 'whoami') spawn(process.execPath, ['-e', 'setTimeout(() => {}, 12000)'], { stdio: 'inherit', detached: true }).unref();\nconst r = spawnSync(process.execPath, [${JSON.stringify(FAKE)}, ...a], { stdio: 'inherit' });\nprocess.exit(r.status ?? 1);\n`);
  r.st.S.cfOpts = { ...r.st.S.cfOpts, wrangler: wrap };
  try {
    const t0 = Date.now();
    await r.post('relay', { adminKey: KEY1 });
    const d = await r.until((v) => !v.running, 11000);
    assert.equal(d.phase, 'done', JSON.stringify(d));
    assert.ok(Date.now() - t0 < 11000, '손자 프로세스(12초)를 기다리지 않음');
  } finally { await r.close(); }
});

test('wrangler 로그인 파일 자리(도구를 실행하지 않고 봄): 예전 자리와 설정 폴더, 운영체제마다', () => {
  assert.deepEqual(wranglerLoginFiles({ env: {}, platform: 'linux', home: '/home/k' }), [
    '/home/k/.wrangler/config/default.toml', '/home/k/.wrangler/config/default.enc',
    '/home/k/.config/.wrangler/config/default.toml', '/home/k/.config/.wrangler/config/default.enc']);
  assert.ok(wranglerLoginFiles({ env: { XDG_CONFIG_HOME: '/x/cfg' }, platform: 'linux', home: '/home/k' }).includes('/x/cfg/.wrangler/config/default.toml'));
  assert.ok(wranglerLoginFiles({ env: {}, platform: 'darwin', home: '/Users/k' }).includes('/Users/k/Library/Preferences/.wrangler/config/default.toml'));
  const win = wranglerLoginFiles({ env: { APPDATA: 'C:\\Users\\k\\AppData\\Roaming' }, platform: 'win32', home: 'C:\\Users\\k' });
  assert.ok(win.includes('C:\\Users\\k\\.wrangler\\config\\default.toml'));
  assert.ok(win.includes('C:\\Users\\k\\AppData\\Roaming\\xdg.config\\.wrangler\\config\\default.enc'));
  assert.ok(wranglerLoginFiles({ env: {}, platform: 'win32', home: 'C:\\Users\\k' }).includes('C:\\Users\\k\\AppData\\Roaming\\xdg.config\\.wrangler\\config\\default.toml'));
});

test('status의 hosts: 이 커넥트에 지울 로그인·관리자 키가 있을 때만 · 로그인 파일이 없으면 로그아웃하려고 wrangler를 부르지 않음', async () => {
  const r = await rig();
  try {
    const hosts = async () => (await (await fetch(`${r.st.url}bridge/status`, { headers: r.H })).json()).hosts;
    const count = (re) => r.wlog().split('\n').filter((l) => re.test(l)).length;
    const state = () => JSON.parse(readFileSync(join(r.home, 'cloudflare.json'), 'utf8'));
    const login = join(r.home, 'wrangler-default.toml');
    r.st.S.cfOpts = { ...r.st.S.cfOpts, loginFiles: [login] };
    assert.deepEqual(await hosts(), { cloudflare: false, vercel: false }, '써 본 적 없는 커넥트');
    // 강사가 따로 쓰는 wrangler 로그인만 있는 PC: 커넥트가 쓴 적 없는 로그인은 지울 것으로 치지 않음
    writeFileSync(login, 'oauth_token = "x"\n');
    assert.equal((await hosts()).cloudflare, false);
    // 이 커넥트로 참여 기능 서버를 만듦 → 로그인을 쓰고 있고 관리자 키도 이 PC에 있음
    await r.post('relay', { adminKey: KEY1 });
    assert.equal((await r.until()).phase, 'done');
    assert.equal(state().login, true);
    assert.equal((await hosts()).cloudflare, true);
    // 로그아웃이 실패하면(망 끊김) 관리자 키는 지워도 로그인이 남았다는 표시는 남음 → 앱이 '지우지 못했어요'로 알릴 수 있음
    r.patch({ fail: { logout: 'getaddrinfo ENOTFOUND dash.cloudflare.com' } });
    await r.post('logout');
    assert.equal((await r.until()).error.code, 'network');
    assert.ok(!JSON.stringify(state()).includes(KEY1));
    assert.equal((await hosts()).cloudflare, true, '로그인 파일과 표시가 남음');
    // 로그아웃 성공: 표시도 지움(가짜 wrangler는 파일을 지우지 않지만, 커넥트가 쓰던 로그인은 이제 없음)
    r.patch({ fail: null });
    await r.post('logout');
    assert.deepEqual((await r.until()).result, { loggedOut: true });
    assert.equal(state().login, undefined);
    assert.equal((await hosts()).cloudflare, false);
    assert.equal(count(/^logout/), 2);
    // 로그인 파일이 없는 PC: 로그아웃하려고 도구를 부르지(새로 받지) 않고 바로 끝남
    rmSync(login, { force: true });
    await r.post('logout');
    assert.deepEqual((await r.until()).result, { loggedOut: true });
    assert.equal(count(/^logout/), 2, 'wrangler를 부르지 않음');
    assert.equal(r.state().loggedIn, false);
  } finally { await r.close(); }
});
