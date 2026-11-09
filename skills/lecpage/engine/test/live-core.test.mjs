// Unit tests for the client core (engine/runtime/live/core.js) and its parity with the server core.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { skillDir, liveDir } from './live-helpers.mjs';

const protoNode = path.join(skillDir, 'backends/node-server/lib/protocol.js');
const protoCf = path.join(skillDir, 'backends/cloudflare/src/protocol.js');

function fakeStorage() {
  const m = new Map();
  return {
    get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear(),
  };
}
/** A browser-ish global with core.js (+ extra scripts) loaded. Tabs may share one localStorage. */
function makeWindow({ storage = fakeStorage(), scripts = ['local.js'] } = {}) {
  const win = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, Promise, URL, TextEncoder, TextDecoder, Intl, JSON, Math, Date,
    crypto: globalThis.crypto, isSecureContext: true, BroadcastChannel, structuredClone, Uint8Array, Array, Object, String, Number, RegExp, Error,
    localStorage: storage, sessionStorage: fakeStorage(), addEventListener() {}, removeEventListener() {},
  };
  win.window = win; win.globalThis = win;
  vm.createContext(win);
  for (const f of ['core.js', ...scripts]) vm.runInContext(fs.readFileSync(path.join(liveDir, f), 'utf8'), win, { filename: f });
  return win;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 2000) { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await wait(10); } throw new Error('condition not met'); }

test('core: both server copies of protocol.js are identical', () => {
  assert.equal(fs.readFileSync(protoNode, 'utf8'), fs.readFileSync(protoCf, 'utf8'), 'copy backends/node-server/lib/protocol.js to backends/cloudflare/src/protocol.js');
});

test('core: limits and CSV export layout match the server core', async () => {
  const P = await import(protoNode);
  const { LecLive } = makeWindow();
  for (const k of ['nickname', 'name', 'school', 'question', 'post', 'chat', 'help', 'seat', 'id', 'option', 'answer', 'notice', 'license']) assert.equal(LecLive.limits[k], P.LIMITS[k], k);
  assert.deepEqual([...LecLive.emojis], P.EMOJIS);
  assert.deepEqual([...LecLive.cols], P.COLS);
  assert.deepEqual([...LecLive.uploadTypes].sort(), Object.keys(P.UPLOAD_TYPES).sort());
  const data = {
    participants: [{ id: 'p1', nickname: '김', name: '김선생', school: '한빛초', createdAt: 1, consentAt: 1 }, { id: 'p2', nickname: '=이', createdAt: 2 }],
    attendance: [{ by: 'p1', kind: 'in', at: 1000 }, { by: 'p1', kind: 'out', at: 5000 }],
    progress: [{ by: 'p1', station: 's1', status: 'done' }, { by: 'p2', station: 's2', status: 'stuck' }],
    questions: [{ createdAt: 3, text: '질문, "따옴표"\n줄바꿈', anonymous: true, votes: 2, status: 'open', pinned: true }],
    survey: [{ by: 'p1', answers: { q1: '좋음', q2: 5 }, updatedAt: 9 }], posts: [{ createdAt: 4, kind: 'post', text: '@글', nickname: '김', files: [{ url: 'https://x/a.png' }], likes: 1 }],
    help: [{ createdAt: 5, nickname: '김', station: 's1', seat: '1', message: '도와주세요', status: 'claimed', assignee: '보조' }],
    chat: [{ createdAt: 6, nickname: '김', text: '+안녕' }], answers: [{ poll: 'p', by: 'p2', value: ['가', '나'], updatedAt: 7 }],
  };
  for (const kind of P.EXPORT_KINDS) {
    const s = P.exportTable(kind, data); const c = LecLive.util.exportTable(kind, data);
    assert.equal(LecLive.util.toCsv(c.columns, c.rows), P.toCsv(s.columns, s.rows), kind);
  }
});

test('core: profanity masking (Korean spacing tricks, allow-list, opt-out)', () => {
  const { LecLive } = makeWindow({ scripts: [] });
  assert.equal(LecLive.mask('아 씨발 진짜'), '아 ** 진짜');
  assert.equal(LecLive.mask('씨 발'), '* *');
  assert.equal(LecLive.mask('시1발'), '***');
  assert.equal(LecLive.mask('수학의 시발점은 어디?'), '수학의 시발점은 어디?');
  assert.equal(LecLive.mask('What the FUCKING thing'), 'What the ******* thing');
  assert.equal(LecLive.mask('classic assessment'), 'classic assessment');
  assert.equal(LecLive.mask('ㅅㅂ', false), 'ㅅㅂ');
  assert.equal(LecLive.mask('바보야', { extra: ['바보'] }), '**야');
});

test('core + local: two tabs share data through BroadcastChannel; text is limited and masked', async () => {
  const storage = fakeStorage();
  const A = makeWindow({ storage }); const B = makeWindow({ storage });
  const code = 'T' + Math.random().toString(36).slice(2, 7);
  const a = A.LecLive.create({ provider: 'local', code }); const b = B.LecLive.create({ provider: 'local', code });
  assert.equal((await a.connect()).mode, 'local'); await b.connect();
  assert.equal(a.status, 'live');
  await a.join({ nickname: '  김선생님  ' });
  const seen = [];
  b.onChange('questions', (docs) => seen.push(docs.length));
  const q = await a.add('questions', { text: '씨발 너무 어려워요 ' + 'ㄱ'.repeat(600) });
  assert.equal([...q.text].length, 500, 'client clamps to the server limit');
  assert.match(q.text, /^\*\* 너무/);
  await until(() => b.store('questions').length === 1);
  assert.equal(b.store('questions')[0].text, q.text);
  assert.ok(seen.length >= 1);
  await b.vote(q.id); await b.vote(q.id);
  await until(() => a.get('questions', q.id).votes === 1);
  await b.setState({ notice: { text: '공지', level: 'info' } });
  await until(() => a.state.notice && a.state.notice.text === '공지');
  const csv = await a.exportCsv('questions');
  assert.ok(csv.startsWith('﻿작성 시각'));
  await a.purge();
  await until(() => b.store('questions').length === 0);
  a.close(); b.close();
});

test('core: offline writes are queued, persisted, delivered once (cid) and the store dedupes echoes', async () => {
  const win = makeWindow({ scripts: [] });
  const L = win.LecLive;
  const server = { docs: [], down: true, calls: 0, handler: null };
  L.register('fake', () => ({
    status: 'offline',
    subscribe(h) { server.handler = h; return () => {}; },
    connect() { return Promise.resolve({ mode: 'realtime' }); },
    join(p) { return Promise.resolve({ id: 'p1', token: 't1', nickname: p.nickname }); },
    snapshot() { return Promise.resolve({ now: 1, time: Date.now(), state: { slide: 1, updatedAt: 1 }, questions: server.docs.slice() }); },
    add(col, doc) {
      server.calls++;
      if (server.down) return Promise.reject(L.error('network', 'down', { status: 0 }));
      let d = server.docs.find((x) => x.cid === doc.cid);
      if (!d) { d = { ...doc, id: 'q' + server.docs.length, votes: 0, createdAt: 10, updatedAt: 10 }; server.docs.push(d); }
      server.handler({ type: 'add', col, doc: d }); // realtime echo arrives before the response
      return Promise.resolve(d);
    },
  }));
  const c = L.create({ provider: 'fake', code: 'QUEUE1' });
  await c.connect();
  assert.equal(c.status, 'live');
  await c.join({ nickname: '나' });
  const tmp = await c.add('questions', { text: '끊겼을 때' });
  assert.equal(tmp._pending, true);
  assert.equal(c.store('questions').length, 1);
  assert.equal(JSON.parse(win.localStorage.getItem(c._ns + ':queue')).length, 1, 'queue survives a reload');
  server.down = false;
  await c._flushQueue();
  const docs = c.store('questions');
  assert.equal(docs.length, 1, 'temp doc replaced, echo deduped');
  assert.equal(docs[0].id, 'q0'); assert.ok(!docs[0]._pending);
  assert.equal(server.docs.length, 1);
  assert.equal(c.mine('questions').length, 1, 'my question is remembered even though `by` is hidden');
  // an older update never overwrites a newer doc
  server.handler({ type: 'update', col: 'questions', doc: { ...docs[0], text: '옛날', updatedAt: 5 } });
  assert.equal(c.get('questions', 'q0').text, '끊겼을 때');
  // unknown reactions are dropped, known ones pass through
  const got = []; c.on('reaction', (r) => got.push(r.emoji));
  server.handler({ type: 'reaction', doc: { emoji: '<img>', count: 1 } });
  server.handler({ type: 'reaction', doc: { emoji: '👏', count: 3 } });
  assert.deepEqual(got, ['👏']);
  c.close();
});

test('core: sha256 fallback matches Web Crypto (file:// pages may lack crypto.subtle)', async () => {
  const { LecLive } = makeWindow({ scripts: [] });
  for (const s of ['', 'abc', '관리자키', 'x'.repeat(1000)]) {
    const web = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))).toString('hex');
    assert.equal(LecLive.util.sha256sync(s), web);
  }
});
