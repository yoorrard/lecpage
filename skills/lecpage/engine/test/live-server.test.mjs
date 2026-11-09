// Protocol v1 tests against the zero-dependency Node server (backends/node-server).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startNodeServer, protocolSuite, api, tmpDir, PNG_1PX, sseUntil } from './live-helpers.mjs';

const ADMIN = '관리자-키-1234';
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
  const s = await startNodeServer({ adminKey: 'k', origins: ['https://site.example'] });
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
  const s = await startNodeServer({ adminKey: 'k', staticDir: site });
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
  const s = await startNodeServer({ adminKey: 'k', retentionDays: 1 });
  try {
    const a = api(s.url, 'OLD1');
    const p = (await a.call('POST', '/join', { body: { nickname: 'x' } })).body;
    const fd = new FormData(); fd.append('file', new Blob([PNG_1PX], { type: 'image/png' }), 'a.png');
    assert.equal((await a.call('POST', '/upload', { token: p.token, body: fd })).status, 201);
    s.core.db.run(`UPDATE trainings SET last_at = ? WHERE code = ?`, Date.now() - 2 * 864e5, 'OLD1');
    const removed = s.core.cleanup();
    assert.deepEqual(removed.map((r) => r.code), ['OLD1']);
    assert.equal(removed[0].files.length, 1);
    const snap = (await a.call('GET', '/snapshot?since=0', { admin: 'k' })).body;
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
