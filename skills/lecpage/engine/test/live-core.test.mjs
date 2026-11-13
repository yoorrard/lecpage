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

test('supabase adapter (fake supabase-js): ticks fetch by rev cursor, flush nudges, polling fallback, error mapping', async () => {
  const calls = []; const channels = []; let created = null; let subscribeStatus = 'SUBSCRIBED';
  const rows = []; let rev = 0;
  const handlers = {
    lec_snapshot: (a) => ({ data: { now: rev, time: Date.now(), state: { slide: 1, updatedAt: 1 }, questions: rows.filter((r) => r.rev > a.p_since).map(({ rev: _r, ...d }) => d) } }),
    lec_admin_snapshot: (a) => (a.p_admin === 'k' ? handlers.lec_snapshot(a) : { error: { code: 'PT403', message: 'admin_required', hint: '관리자 키가 필요합니다.' }, status: 403 }),
    lec_mine: () => ({ data: { me: { id: 'p1' }, attendance: [], survey: [] } }),
    lec_join: () => ({ data: { id: 'p1', token: 't'.repeat(64), nickname: '나', _flush: 0 } }),
    lec_add: (a) => {
      if (a.p_doc.text === 'spam') return { error: { code: 'PT429', message: 'rate_limited', hint: '잠시 후 다시 시도해 주세요.' }, status: 429 };
      rev++; const d = { id: 'q' + rev, text: a.p_doc.text, cid: a.p_doc.cid, votes: 0, createdAt: rev, updatedAt: rev, rev };
      rows.push(d); const { rev: _r, ...out } = d; return { data: { ...out, _flush: rev > 1 ? 120 : 0 } };
    },
    lec_flush: () => ({ data: { _flush: 0 } }),
    lec_reactions: () => ({ data: { rx: reactSeq, r: { '👏': 4 } } }),
  };
  let reactSeq = 0;
  const fake = {
    rpc(name, args) { calls.push([name, args]); return Promise.resolve({ status: 200, error: null, ...(handlers[name] || (() => ({ data: null })))(args) }); },
    channel(topic, opts) {
      const ch = { topic, opts, cbs: [], on(t, f, cb) { this.cbs.push(cb); return this; }, subscribe(cb) { this.statusCb = cb; setTimeout(() => cb(subscribeStatus), 5); return this; }, fire(p) { this.cbs.forEach((cb) => cb({ type: 'broadcast', event: 'tick', payload: p })); } };
      channels.push(ch); return ch;
    },
    removeChannel() {}, removeAllChannels() {},
  };
  function win() {
    const w = makeWindow({ scripts: ['supabase.js'] });
    w.supabase = { createClient: (url, key, opts) => { created = { url, key, opts }; return fake; } };
    w.document = { createElement: () => ({}), head: { appendChild: (el) => setTimeout(() => el.onload(), 1) }, addEventListener() {}, visibilityState: 'visible' };
    return w;
  }
  const W = win();
  const c = W.LecLive.create({ provider: 'supabase', url: 'https://abc.supabase.co', anonKey: 'sb_publishable_x', code: 'sb1', throttle: false });
  const info = await c.connect();
  assert.equal(info.mode, 'realtime'); assert.equal(c.status, 'live');
  assert.equal(created.opts.global.headers['x-lec-code'], 'SB1');
  assert.equal(created.opts.auth.persistSession, false);
  assert.equal(channels[0].topic, 'lec:SB1'); assert.equal(channels[0].opts.config.private, false);
  await c.join({ nickname: '나' });
  const q1 = await c.add('questions', { text: '첫 질문' });
  assert.equal(q1._flush, undefined, '_flush is stripped');
  await c.add('questions', { text: '둘째' });
  await new Promise((r) => setTimeout(r, 250));
  assert.ok(calls.some(([n]) => n === 'lec_flush'), 'a pending tick is nudged out by the writer');
  // someone else's write → tick → fetch rows newer than my cursor
  await c.sync();
  rows.push({ id: 'q99', text: '남의 질문', votes: 0, createdAt: 99, updatedAt: 99, rev: ++rev });
  const before = calls.filter(([n]) => n === 'lec_snapshot').length;
  const reacts = []; c.on('reaction', (r) => reacts.push(r));
  reactSeq = 1;
  channels[0].fire({ rev, rx: 1, r: { '👏': 50, '🔥': 50 } });
  await new Promise((r) => setTimeout(r, 900));
  const snaps = calls.filter(([n]) => n === 'lec_snapshot');
  assert.equal(snaps.length, before + 1);
  assert.ok(snaps.at(-1)[1].p_since > 0, 'incremental fetch');
  assert.ok(c.get('questions', 'q99'));
  assert.deepEqual(reacts.map((r) => [r.emoji, r.count]), [['👏', 4]], 'counts come from lec_reactions, never from the payload');
  channels[0].fire({ rx: 1, r: { '🔥': 50 } });
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(reacts.length, 1, 'a replayed or forged batch number shows nothing');
  // stale/forged tick (rev not newer) causes no fetch
  channels[0].fire({ rev: 1 });
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(calls.filter(([n]) => n === 'lec_snapshot').length, before + 1);
  // M1: a flood of forged hints (huge rev, reset) costs at most one read per back-off step, not one per message
  const n0 = calls.filter(([n]) => n === 'lec_snapshot').length;
  for (let i = 0; i < 30; i++) channels[0].fire(i % 2 ? { rev: 1e15 } : { reset: true });
  await new Promise((r) => setTimeout(r, 2200));
  const n1 = calls.filter(([n]) => n === 'lec_snapshot').length;
  assert.ok(n1 - n0 >= 1 && n1 - n0 <= 2, 'forged ticks: ' + (n1 - n0) + ' reads');
  // the gap doubled (≥ 3 s from the last read, which was ≤ 0.5 s into the first flood): nothing for a while now
  for (let i = 0; i < 30; i++) channels[0].fire({ rev: 1e15 });
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(calls.filter(([n]) => n === 'lec_snapshot').length, n1, 'hints that brought nothing new back off');
  await new Promise((r) => setTimeout(r, 1500));
  assert.ok(calls.filter(([n]) => n === 'lec_snapshot').length <= n1 + 1, 'still at most one read per back-off step');
  // PT429 → LiveError status 429, not queued
  await assert.rejects(c.add('questions', { text: 'spam' }), (e) => e.status === 429 && e.code === 'rate_limited');
  c.close();
  // realtime blocked → polling
  subscribeStatus = 'CHANNEL_ERROR';
  const W2 = win();
  const c2 = W2.LecLive.create({ provider: 'supabase', url: 'https://abc.supabase.co', anonKey: 'k', code: 'SB1', adminKey: 'k' });
  assert.equal((await c2.connect()).mode, 'polling');
  assert.equal(c2.status, 'polling');
  assert.ok(calls.some(([n, a]) => n === 'lec_admin_snapshot' && a.p_admin === 'k'));
  c2.close();
});

test('자료 링크: 강사가 연수 중에 덧붙인 주소는 state.ui(m1…m8)에 담기고, https만 받으며 서버 상태 규칙을 통과한다', async () => {
  const win = makeWindow(); const X = win.LecLive.util.ext;
  let st = { ui: {} };
  const add = (url, title) => { const p = X.materialAdd(st, url, title); if (!p.error) st = { ui: { ...st.ui, ...p.ui } }; return p; };
  assert.ok(add('drive.google.com/file/d/abc/view', '활동지 PDF').ui.m1.startsWith('https://drive.google.com/file/d/abc/view 활동지'));
  assert.match(add('javascript:alert(1)', '나쁜 주소').error, /https/);
  assert.match(add('http://example.com/a', '암호화 안 됨').error, /https/);
  assert.match(add('https://example.com/' + 'a'.repeat(200), '긴 주소').error, /길어요/);
  add('https://youtu.be/xyz', '');
  const list = X.materials(st);
  assert.equal(list.length, 2); assert.equal(list[0].title, '활동지 PDF'); assert.equal(list[1].title, 'youtu.be/xyz');
  // 값은 200자 안, 서버의 상태 규칙(cleanStatePatch)을 그대로 통과
  const { cleanStatePatch } = await import(protoNode);
  const cleaned = cleanStatePatch({ ui: st.ui });
  assert.equal(cleaned.ui.m1, st.ui.m1);
  for (let i = 0; i < 6; i++) add(`https://example.com/${i}`, `자료 ${i}`);
  assert.match(add('https://example.com/9', '아홉째').error, /8개/);
  st = { ui: { ...st.ui, ...X.materialRemove(1).ui } };
  assert.equal(X.materials(st).length, 7);
  // 서버가 바꿔 놓은 값(주소가 아닌 글)은 버림
  assert.equal(X.materials({ ui: { m1: '<script>alert(1)</script>', m2: 'https://ok.example/x 좋아요' } }).length, 1);
});

test('core (①): an accepted key becomes a session; requests carry it; an expired session falls back to the key once', async () => {
  const win = makeWindow({ scripts: [] }); const { LecLive } = win;
  const KEY = 'k-123456789012'; let valid = null; const seen = [];
  LecLive.register('fake', (config, ctx) => {
    const a = { status: 'live' };
    a.subscribe = () => () => {};
    a.connect = async () => ({ mode: 'realtime' });
    a.snapshot = async () => {
      const k = ctx.adminKey(); seen.push(k);
      if (k && k !== KEY && k !== valid) throw LecLive.error('session_expired', '다시', { status: 401 });
      return { now: 1, state: {} };
    };
    a.checkAdmin = async () => { const k = ctx.adminKey(); seen.push('check:' + k); return k === KEY || k === valid; };
    a.adminSession = async (key) => { assert.equal(key, KEY, 'the session is asked for with the key itself'); valid = 'lps1.' + 'a'.repeat(43); return { session: valid, expiresAt: Date.now() + 3600e3 }; };
    return a;
  });
  const c = LecLive.create({ provider: 'fake', code: 'S1' });
  await c.connect();
  assert.equal(await c.useAdminKey(KEY), true);
  assert.equal(seen.at(-1), valid, 'after the key is accepted, requests carry the session');
  // reload in the same tab: the stored session is used without a key attempt
  const c2 = LecLive.create({ provider: 'fake', code: 'S1' }); await c2.connect(); seen.length = 0;
  assert.equal(await c2.useAdminKey(KEY), true);
  assert.equal(seen[0], 'check:' + valid);
  // the server forgot the session (new key, wiped): one retry with the key, then a fresh session
  valid = 'lps1.' + 'z'.repeat(43); seen.length = 0;
  await c2.sync(true);
  assert.deepEqual(seen.slice(0, 2), ['lps1.' + 'a'.repeat(43), KEY]);
  await wait(10);
  assert.equal(win.sessionStorage.getItem('lecLive:fake:' + LecLive.util.hashStr('') + ':S1:asess') !== null, true);
  // logout drops the session
  await c2.setAdminKey(null);
  assert.equal(win.sessionStorage.getItem('lecLive:fake:' + LecLive.util.hashStr('') + ':S1:asess'), null);
});

test('core (②⑧): one vote per respondent on every screen; completion merges the same name·school and keeps first in / last out', async () => {
  const P = await import(protoNode);
  const { LecLive } = makeWindow();
  const X = LecLive.util.ext;
  assert.deepEqual({ ...X.tally([{ value: ['A', 'A', 'A', 'A', 'A'] }, { value: 'B' }, { value: 'A' }, { value: ['B'] }]) }, { A: 2, B: 2 });
  const data = {
    participants: [
      { id: 'p1', nickname: '폰', name: '홍길동', school: '한빛초', createdAt: 1 },
      { id: 'p2', nickname: '노트북', name: '홍길동', school: '한빛초', createdAt: 2 },
      { id: 'p3', nickname: '별명만', createdAt: 3 },
      { id: 'p4', nickname: '동명이인', name: '홍길동', school: '푸른초', createdAt: 4 },
    ],
    attendance: [{ by: 'p1', kind: 'in', at: Date.UTC(2026, 10, 13, 0, 5) }, { by: 'p2', kind: 'in', at: Date.UTC(2026, 10, 13, 0, 30) }, { by: 'p2', kind: 'out', at: Date.UTC(2026, 10, 13, 6, 0) }, { by: 'p1', kind: 'out', at: Date.UTC(2026, 10, 13, 3, 0) }],
    progress: [{ by: 'p1', station: 's1', status: 'done' }, { by: 'p2', station: 's2', status: 'done' }],
    survey: [{ by: 'p2', answers: { q: 1 } }],
  };
  const opts = { date: '2026-11-13', start: '09:00', end: '15:00', rate: 90, survey: true };
  const s = P.exportTable('completion', data, 'Asia/Seoul', opts); const c = LecLive.util.exportTable('completion', data, 'Asia/Seoul', opts);
  assert.equal(LecLive.util.toCsv(c.columns, c.rows), P.toCsv(s.columns, s.rows), 'client and server agree');
  assert.equal(s.rows.length, 3, 'same name·school on two devices → one row; another school stays separate');
  assert.deepEqual(s.rows[0], ['폰 / 노트북', '홍길동', '한빛초', '2026-11-13 09:05:00', '2026-11-13 15:00:00', 355, '2 / 2', 'O', 'O']);
});

test('protect (③): the pages left open carry no live url, code or key; check only probes /api/health', async () => {
  const { publicSiteData } = await import(path.join(skillDir, 'engine/src/protect.js'));
  const http = publicSiteData({ key: 'lp-AB12CD', title: 't', live: { provider: 'http', url: 'https://lec.example.workers.dev', code: 'AB12CD', anonKey: '', features: ['qa'], pollMs: 5000 } });
  assert.deepEqual(http.live, { provider: 'http', features: ['qa'], health: 'https://lec.example.workers.dev/api/health' }); assert.equal(http.key, '');
  assert.equal(publicSiteData({ live: { provider: 'http', url: 'https://sites.example/live', code: 'X' } }).live.health, 'https://sites.example/live/api/health');
  const sb = publicSiteData({ live: { provider: 'supabase', url: 'https://abc.supabase.co', anonKey: 'sb_publishable_x', code: 'AB12CD' } });
  assert.equal(sb.live.health, 'https://abc.supabase.co/auth/v1/health'); assert.ok(!JSON.stringify(sb).includes('sb_publishable_x')); assert.ok(!JSON.stringify(sb).includes('AB12CD'));
  assert.equal(publicSiteData({ live: { provider: 'sheets', url: 'https://script.google.com/macros/s/AKfy123/exec', code: 'C1' } }).live.health, 'https://script.google.com/');
});
