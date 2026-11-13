// Protocol v1 tests against the zero-dependency Node server (backends/node-server).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startNodeServer, protocolSuite, api, tmpDir, PNG_1PX, sseUntil, wsOpen, nodeServerDir } from './live-helpers.mjs';

const ADMIN = '관리자-키-1234-node';
const KEY = 'test-admin-key-k';
let srv;
before(async () => { srv = await startNodeServer({ adminKey: ADMIN }); });
after(async () => { await srv?.close(); });

protocolSuite('node', () => ({ base: srv.url, adminKey: ADMIN }));

test('node: health and unknown routes', async () => {
  const h = await (await fetch(srv.url + '/api/health')).json();
  assert.equal(h.ok, true); assert.equal(h.protocol, 1);
  const r = await api(srv.url, 'HEALTHX').call('GET', '/nothing-here');
  assert.equal(r.status, 404);
  const ws = await api(srv.url, 'HEALTHX').call('GET', '/ws');
  assert.equal(ws.status, 426);
});

test('node: shared-relay mode — setup token, /init, per-training admin keys', async () => {
  const relay = await startNodeServer({ setupToken: 'setup-secret' });
  try {
    const a = api(relay.url, 'RELAY1');
    assert.equal((await a.call('POST', '/join', { body: { nickname: 'x' } })).status, 404, 'unknown training before init');
    const hash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('강사A키'))).toString('hex');
    assert.equal((await a.call('POST', '/init', { body: { adminKeyHash: hash } })).status, 403);
    assert.equal((await a.call('POST', '/init', { setup: 'wrong', body: { adminKeyHash: hash } })).status, 403);
    assert.equal((await a.call('POST', '/init', { setup: 'setup-secret', body: { adminKeyHash: 'abc' } })).status, 400);
    const ok = await a.call('POST', '/init', { setup: 'setup-secret', body: { adminKeyHash: hash, settings: { retentionDays: 7, maxUploadMb: 1 } } });
    assert.equal(ok.status, 201); assert.equal(ok.body.settings.retentionDays, 7);
    assert.equal((await a.call('POST', '/init', { setup: 'setup-secret', body: { adminKeyHash: hash } })).status, 401, 're-init needs the current admin key');
    const p = (await a.call('POST', '/join', { body: { nickname: '참가' } })).body;
    assert.ok(p.token);
    assert.equal((await a.call('PUT', '/state', { admin: '강사A키', body: { slide: 1 } })).status, 200);
    const other = api(relay.url, 'RELAY2');
    assert.equal((await other.call('PUT', '/state', { admin: '강사A키', body: { slide: 1 } })).status, 404, 'key is per training');
    // per-training upload limit (1 MB)
    const big = new Uint8Array(1024 * 1024 + 10); big.set(PNG_1PX);
    const fd = new FormData(); fd.append('file', new Blob([big], { type: 'image/png' }), 'big.png');
    const up = await a.call('POST', '/upload', { token: p.token, body: fd });
    assert.equal(up.status, 413);
  } finally { await relay.close(); }
});

test('node: CORS restricted to configured origins', async () => {
  const s = await startNodeServer({ adminKey: KEY, origins: ['https://site.example'] });
  try {
    const pre = await fetch(s.url + '/api/CORS1/questions', { method: 'OPTIONS', headers: { origin: 'https://site.example', 'access-control-request-method': 'POST' } });
    assert.equal(pre.status, 204); assert.equal(pre.headers.get('access-control-allow-origin'), 'https://site.example');
    assert.match(pre.headers.get('access-control-allow-headers'), /X-Lec-Token/);
    const evil = await fetch(s.url + '/api/CORS1/snapshot', { headers: { origin: 'https://evil.example' } });
    assert.equal(evil.headers.get('access-control-allow-origin'), null);
    const post = await fetch(s.url + '/api/CORS1/join', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' });
    assert.equal(post.status, 403);
    const good = await fetch(s.url + '/api/CORS1/join', { method: 'POST', headers: { origin: 'https://site.example', 'content-type': 'application/json' }, body: '{"nickname":"a"}' });
    assert.equal(good.status, 201);
  } finally { await s.close(); }
});

test('node: serves the static site safely and keeps the API on the same origin', async () => {
  const site = tmpDir('lec-site-');
  fs.writeFileSync(path.join(site, 'index.html'), '<!doctype html><title>연수</title>');
  fs.mkdirSync(path.join(site, 'assets'));
  fs.writeFileSync(path.join(site, 'assets', 'live.js'), 'window.x=1');
  fs.writeFileSync(path.join(site, '.env'), 'SECRET=1');
  fs.writeFileSync(path.join(site, '운영안내.md'), '# 운영 메모');
  fs.writeFileSync(path.join(site, 'DESIGN.md'), '# design');
  fs.writeFileSync(path.join(site, 'lecpage.blueprint.json'), '{}');
  fs.mkdirSync(path.join(site, '.git')); fs.writeFileSync(path.join(site, '.git', 'config'), '[core]');
  const s = await startNodeServer({ adminKey: KEY, staticDir: site });
  try {
    const home = await fetch(s.url + '/');
    assert.equal(home.status, 200); assert.match(home.headers.get('content-type'), /text\/html/); assert.equal(home.headers.get('cache-control'), 'no-cache');
    const js = await fetch(s.url + '/assets/live.js');
    assert.match(js.headers.get('content-type'), /javascript/);
    assert.equal((await fetch(s.url + '/.env')).status, 404, 'dotfiles hidden');
    assert.equal((await fetch(s.url + '/.git/config')).status, 404, 'dot-directories hidden');
    assert.equal((await fetch(s.url + '/' + encodeURIComponent('운영안내.md'))).status, 404, 'operator notes hidden');
    assert.equal((await fetch(s.url + '/DESIGN.MD')).status, 404);
    assert.equal((await fetch(s.url + '/lecpage.blueprint.json')).status, 404);
    assert.notEqual((await fetch(s.url + '/..%2f..%2fetc/passwd')).status, 200);
    assert.equal((await fetch(s.url + '/assets/../../server.mjs')).status, 404);
    assert.equal((await fetch(s.url + '/api/STAT1/state')).status, 200);
  } finally { await s.close(); }
});

test('node: retention cleanup removes idle trainings and their files', async () => {
  const s = await startNodeServer({ adminKey: KEY, retentionDays: 1 });
  try {
    const a = api(s.url, 'OLD1');
    const p = (await a.call('POST', '/join', { body: { nickname: 'x' } })).body;
    const fd = new FormData(); fd.append('file', new Blob([PNG_1PX], { type: 'image/png' }), 'a.png');
    assert.equal((await a.call('POST', '/upload', { token: p.token, body: fd })).status, 201);
    s.core.db.run(`UPDATE trainings SET last_at = ? WHERE code = ?`, Date.now() - 2 * 864e5, 'OLD1');
    const removed = s.core.cleanup();
    assert.deepEqual(removed.map((r) => r.code), ['OLD1']);
    assert.equal(removed[0].files.length, 1);
    const snap = (await a.call('GET', '/snapshot?since=0', { admin: KEY })).body;
    assert.equal(snap.participants.length, 0);
  } finally { await s.close(); }
});

test('node: SSE keeps working for many listeners and does not leak private events', async () => {
  const a = api(srv.url, 'SSEMANY');
  const listeners = Array.from({ length: 20 }, () => sseUntil(a.root + '/events', (m) => m.type === 'add' && m.col === 'chat', 6000));
  await new Promise((r) => setTimeout(r, 400));
  const p = (await a.call('POST', '/join', { body: { nickname: '채팅' } })).body;
  await a.call('POST', '/chat', { token: p.token, body: { text: '안녕하세요' } });
  const all = await Promise.all(listeners);
  for (const { msg, msgs } of all) {
    assert.equal(msg.doc.text, '안녕하세요');
    assert.ok(!msgs.some((m) => m.col === 'participants'));
  }
});

test('node + http adapter (no browser): checkAdmin is not fooled by a participant token', async () => {
  const { default: vm } = await import('node:vm');
  const { liveDir } = await import('./live-helpers.mjs');
  const win = { console, setTimeout, clearTimeout, setInterval, clearInterval, Promise, URL, TextEncoder, Intl, JSON, Math, Date, fetch, crypto: globalThis.crypto, Uint8Array, Array, Object, String, Number, RegExp, Error, AbortController, addEventListener() {}, removeEventListener() {} };
  win.window = win; vm.createContext(win);
  for (const f of ['core.js', 'http.js']) vm.runInContext(fs.readFileSync(path.join(liveDir, f), 'utf8'), win);
  const c = win.LecLive.create({ provider: 'http', url: srv.url, code: 'CHKADM', identity: 'session' });
  await c.join({ nickname: '참가자' });
  await c.setAdminKey('틀린-키');
  assert.equal(await c.checkAdmin(), false);
  await c.setAdminKey(ADMIN);
  assert.equal(await c.checkAdmin(), true);
  const st = await c.setState({ slide: 9 });
  assert.equal(st.slide, 9);
  c.close();
});

test('node + http adapter: 즉석 투표(polls 모음)와 출석 한 번 누르기 — 강사가 만들고, 참가자가 읽고 답하고, 명단에 남음', async () => {
  const { default: vm } = await import('node:vm');
  const { liveDir } = await import('./live-helpers.mjs');
  const mk = () => {
    const win = { console, setTimeout, clearTimeout, setInterval, clearInterval, Promise, URL, TextEncoder, Intl, JSON, Math, Date, fetch, crypto: globalThis.crypto, Uint8Array, Array, Object, String, Number, RegExp, Error };
    win.window = win; vm.createContext(win);
    for (const f of ['core.js', 'http.js']) vm.runInContext(fs.readFileSync(path.join(liveDir, f), 'utf8'), win);
    return win;
  };
  // connect()는 실시간 연결을 열어 두므로 부르지 않음(요청마다 서버에 바로 묻는 방식으로 시험)
  const admin = mk().LecLive.create({ provider: 'http', url: srv.url, code: 'QUICK1', identity: 'session' });
  await admin.setAdminKey(ADMIN);
  const poll = await admin.add('polls', { question: '지금 몇 번 실습?', kind: 'choice', options: ['1번', '2번', '3번'], open: true });
  assert.ok(poll.id);
  await admin.setState({ openPoll: poll.id });
  const p = mk().LecLive.create({ provider: 'http', url: srv.url, code: 'QUICK1', identity: 'session' });
  const polls = await p.list('polls', {});
  assert.equal(JSON.stringify(polls.map((x) => [x.question, x.options.length])), JSON.stringify([['지금 몇 번 실습?', 3]]));
  assert.equal((await p.getState()).openPoll, poll.id);
  await p.join({ nickname: '출석만한사람' });
  await p.add('attendance', { kind: 'in' });
  await p.add('answers', { poll: poll.id, value: '2번' });
  const csv = await admin.exportCsv('participants');
  assert.ok(csv.includes('출석만한사람'));
  assert.ok((await admin.exportCsv('attendance')).includes('출석만한사람'));
  // 닫은 투표에 늦은 답을 받지 않는 규칙은 protocolSuite의 closed polls 시험이 봄
  await admin.update('polls', poll.id, { open: false });
  admin.close(); p.close();
});

// ---------------------------------------------------------------- security regressions (2026-11 review)
const ip = (n) => ({ 'x-forwarded-for': n });

test('node (H4): wrong admin keys are throttled per (code, IP) and per IP, over HTTP and WebSocket', async () => {
  const s = await startNodeServer({ adminKey: KEY, trustedProxies: 1 });
  try {
    const a = api(s.url, 'BRUTE1');
    await a.call('POST', '/join', { body: { nickname: 'x' }, headers: ip('10.1.1.1') });
    const codes = [];
    for (let i = 0; i < 12; i++) codes.push((await a.call('PUT', '/state', { admin: 'guess-' + i, body: { slide: 1 }, headers: ip('10.1.1.1') })).status);
    assert.deepEqual(codes.slice(0, 10), Array(10).fill(403));
    assert.deepEqual(codes.slice(10), [429, 429]);
    const locked = await a.call('PUT', '/state', { admin: KEY, body: { slide: 1 }, headers: ip('10.1.1.1') });
    assert.equal(locked.status, 429, 'while locked even the right key is refused (no oracle)');
    assert.ok(Number(locked.headers.get('retry-after')) > 60);
    // a wrong key on a read also counts (it would otherwise silently fall back to the public view)
    assert.equal((await a.call('GET', '/snapshot?since=0', { admin: 'guess', headers: ip('10.1.1.1') })).status, 429);
    assert.equal((await a.call('PUT', '/state', { admin: KEY, body: { slide: 2 }, headers: ip('10.2.2.2') })).status, 200, 'other IPs are not affected');
    // per IP across codes: 20 wrong keys spread over many codes lock that IP everywhere
    for (let i = 0; i < 20; i++) await api(s.url, 'SPRAY' + i).call('GET', '/participants', { admin: 'guess', headers: ip('10.3.3.3') });
    assert.equal((await api(s.url, 'SPRAYX').call('GET', '/participants', { admin: KEY, headers: ip('10.3.3.3') })).status, 429);
    // WebSocket: three wrong auth messages close the socket; when the IP is locked, auth answers rate_limited
    const wsUrl = a.root.replace(/^http/, 'ws') + '/ws';
    const w1 = await wsOpen(wsUrl, { headers: ip('10.4.4.4') });
    for (let i = 0; i < 5; i++) w1.ws.send(JSON.stringify({ type: 'auth', admin: 'nope-' + i }));
    assert.equal(await w1.closed, 1008);
    assert.equal(w1.msgs.filter((m) => m.type === 'auth' && m.ok === false).length, 3);
    const w2 = await wsOpen(wsUrl, { headers: ip('10.3.3.3') });
    w2.ws.send(JSON.stringify({ type: 'auth', admin: KEY }));
    const r = await w2.next((m) => m.type === 'auth');
    assert.equal(r.ok, false); assert.equal(r.error, 'rate_limited'); assert.ok(r.retryAfter > 0);
    assert.equal(await w2.closed, 1008);
    const w3 = await wsOpen(wsUrl, { admin: KEY, headers: ip('10.5.5.5') });
    assert.equal((await w3.next((m) => m.type === 'auth')).ok, true);
    w3.close();
  } finally { await s.close(); }
});

test('node (M3): the client IP is the socket address unless trusted proxies are set; then read from the right', async () => {
  const direct = await startNodeServer({ adminKey: KEY, rate: { joinIp: [3, 600e3], create: [1000, 3600e3] } });
  try {
    const a = api(direct.url, 'XFF1');
    for (let i = 0; i < 3; i++) assert.equal((await a.call('POST', '/join', { body: { nickname: 'a' + i } })).status, 201);
    assert.equal((await a.call('POST', '/join', { body: { nickname: 'b' } })).status, 429);
    assert.equal((await a.call('POST', '/join', { body: { nickname: 'c' }, headers: ip('6.6.6.6') })).status, 429, 'X-Forwarded-For is ignored without trusted proxies');
  } finally { await direct.close(); }
  const proxied = await startNodeServer({ adminKey: KEY, trustedProxies: 1, rate: { joinIp: [3, 600e3], create: [1000, 3600e3] } });
  try {
    const a = api(proxied.url, 'XFF2');
    for (let i = 0; i < 3; i++) assert.equal((await a.call('POST', '/join', { body: { nickname: 'a' + i }, headers: ip('10.0.0.1') })).status, 201);
    assert.equal((await a.call('POST', '/join', { body: { nickname: 'b' }, headers: ip('6.6.6.' + 7 + ', 10.0.0.1') })).status, 429, 'a spoofed left-most entry does not help');
    assert.equal((await a.call('POST', '/join', { body: { nickname: 'c' }, headers: ip('10.0.0.1, 10.0.0.2') })).status, 201, 'the right-most entry (added by the proxy) is the client');
  } finally { await proxied.close(); }
});

test('node (H4): weak or example admin keys and setup tokens are refused at start-up; a generated key goes to a 0600 file', async () => {
  for (const bad of [{ adminKey: 'change-me-관리자키' }, { adminKey: 'short-key' }, { adminKey: 'aaaaaaaaaaaaaaaa' }, { setupToken: 'abc' },
    { adminKeyHash: Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('change-me-관리자키'))).toString('hex') }]) {
    await assert.rejects(startNodeServer(bad), /쓸 수 없습니다|예시 키|12자/, JSON.stringify(bad));
  }
  const logs = []; const orig = console.log; console.log = (...x) => logs.push(x.join(' '));
  let s;
  try { s = await startNodeServer({ generateKey: true }); } finally { console.log = orig; }
  try {
    const file = path.join(s.dataDir, 'admin-key.txt');
    assert.match(logs.join('\n'), /admin-key\.txt/, 'the log says where the key is');
    const key = fs.readFileSync(file, 'utf8').trim();
    assert.ok(key.length >= 16);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.ok(!logs.join('\n').includes(key), 'the key itself never reaches the logs');
    assert.equal((await api(s.url, 'GEN1').call('PUT', '/state', { admin: key, body: { slide: 1 } })).status, 200);
  } finally { await s.close(); }
});

test('node (M2): per-training participant cap, per-IP socket cap, soft read limit', async () => {
  const s = await startNodeServer({ adminKey: KEY, maxParticipants: 2, maxSocketsPerIp: 2, rate: { read: [30, 60e3], create: [1000, 3600e3] } });
  try {
    const a = api(s.url, 'CAP1');
    assert.equal((await a.call('POST', '/join', { body: { nickname: 'a' } })).status, 201);
    assert.equal((await a.call('POST', '/join', { body: { nickname: 'b' } })).status, 201);
    const full = await a.call('POST', '/join', { body: { nickname: 'c' } });
    assert.equal(full.status, 403); assert.equal(full.body.error, 'room_full');
    const ctl = new AbortController();
    const open = () => fetch(a.root + '/events', { signal: ctl.signal });
    const s1 = await open(); const s2 = await open(); const s3 = await open();
    assert.equal(s1.status, 200); assert.equal(s2.status, 200); assert.equal(s3.status, 429, 'third realtime connection from one IP');
    ctl.abort();
    let last = 0;
    for (let i = 0; i < 40 && last !== 429; i++) last = (await a.call('GET', '/state')).status;
    assert.equal(last, 429, 'reads are throttled per IP (soft)');
  } finally { await s.close(); }
});

test('node (H3): removing a post deletes the stored bytes; never-attached uploads are swept', async () => {
  const s = await startNodeServer({ adminKey: KEY });
  try {
    const a = api(s.url, 'BYTES1');
    const p = (await a.call('POST', '/join', { body: { nickname: 'x' } })).body;
    const send = () => { const fd = new FormData(); fd.append('file', new Blob([PNG_1PX], { type: 'image/png' }), 'a.png'); return a.call('POST', '/upload', { token: p.token, body: fd }); };
    const up = (await send()).body; const orphan = (await send()).body;
    const dir = path.join(s.dataDir, 'uploads', 'BYTES1');
    const name = up.url.split('/').pop();
    const post = (await a.call('POST', '/posts', { token: p.token, body: { text: 'x', files: [{ url: up.url, name: 'a.png', type: 'image/png', size: 1 }] } })).body;
    assert.ok(fs.existsSync(path.join(dir, name)));
    await a.call('DELETE', `/posts/${post.id}`, { admin: KEY });
    assert.ok(!fs.existsSync(path.join(dir, name)), 'bytes deleted with the post');
    s.core.db.run(`UPDATE files SET created_at = ? WHERE code = ?`, Date.now() - 2 * 864e5, 'BYTES1');
    const swept = s.core.sweepOrphans();
    assert.deepEqual(swept.map((x) => x.name), [orphan.url.split('/').pop()]);
  } finally { await s.close(); }
});

test('core (M2): with lazySchema, reads of an unknown code create no tables; the first allowed write does', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { LiveCore } = await import(path.join(nodeServerDir, 'lib/protocol.js'));
  const raw = new DatabaseSync(':memory:');
  const db = { all: (q, ...p) => raw.prepare(q).all(...p), get: (q, ...p) => raw.prepare(q).get(...p), run: (q, ...p) => { raw.prepare(q).run(...p); }, tx: (fn) => fn() };
  const tables = () => raw.prepare(`SELECT COUNT(*) AS n FROM sqlite_master`).get().n;
  let created = 0;
  const core = new LiveCore({ db, config: { lazySchema: true, onSchema: () => { created++; } } });
  const H = (o = {}) => ({ get: (k) => o[k] ?? null });
  const req = (method, rest, extra = {}) => core.handle({ method, code: 'LAZY1', rest, query: new URLSearchParams('since=0'), headers: H(), body: extra.body ?? null, ip: '1.2.3.4' });
  assert.equal((await req('GET', ['snapshot'])).status, 200);
  assert.equal((await req('GET', ['state'])).status, 200);
  await assert.rejects(req('POST', ['join'], { body: { nickname: 'x' } }), (e) => e.status === 404);
  assert.equal(tables(), 0, 'nothing stored for an unknown code');
  const auto = new LiveCore({ db, config: { lazySchema: true, adminKeyHash: 'a'.repeat(64), onSchema: () => { created++; } } });
  const r = await auto.handle({ method: 'POST', code: 'LAZY1', rest: ['join'], query: new URLSearchParams(), headers: H(), body: { nickname: 'x' }, ip: '1.2.3.4' });
  assert.equal(r.status, 201); assert.ok(tables() > 0); assert.equal(created, 1);
});
