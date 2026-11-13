// 학교망 대비 런타임: 웹소켓·SSE가 막힌 망에서 묻기 요청을 줄이는 규칙(긴 대기·서버 권고·숨김·변화 없음)과
// 참여 기능 서버가 아예 안 될 때의 대체(Supabase 라이브러리 차단 → REST). 가짜 fetch로 서버를 흉내 냄(브라우저 없이).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { liveDir } from './live-helpers.mjs';

function fakeStorage() {
  const m = new Map();
  return {
    get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear(),
  };
}
function makeWindow(scripts, { fetch, doc } = {}) {
  const win = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, Promise, URL, TextEncoder, TextDecoder, Intl, JSON, Math, Date,
    crypto: globalThis.crypto, isSecureContext: true, Uint8Array, Array, Object, String, Number, RegExp, Error, AbortController,
    localStorage: fakeStorage(), sessionStorage: fakeStorage(), addEventListener() {}, removeEventListener() {}, fetch,
    document: doc || { visibilityState: 'visible', addEventListener() {}, createElement: () => ({}), head: { appendChild() {} } },
  };
  win.window = win; win.globalThis = win;
  vm.createContext(win);
  for (const f of ['core.js', ...scripts]) vm.runInContext(fs.readFileSync(path.join(liveDir, f), 'utf8'), win, { filename: f });
  return win;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = (body, { status = 200, headers = {} } = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

/** 실시간 방 흉내: holds=true면 snapshot?wait=를 바뀔 때까지(또는 wait초) 붙잡음. 요청마다 [시각, 경로] 기록 */
function fakeRoom({ holds = true, hint = 0 } = {}) {
  let now = 100; const log = []; const waiters = new Set(); const questions = [];
  const snap = (since) => ({ now, state: { updatedAt: 1 }, questions: questions.filter((q) => q.updatedAt > since) });
  const fetch = async (url, init = {}) => {
    const u = new URL(url); const p = u.pathname.replace(/^.*\/api\/[A-Z0-9]+/, '');
    log.push([Date.now(), p + u.search]);
    const h = hint ? { 'X-Lec-Poll-Ms': String(hint) } : {};
    if (p === '/state') return res({ updatedAt: 1 });
    if (p === '/snapshot') {
      const since = Number(u.searchParams.get('since')) || 0; const w = Number(u.searchParams.get('wait')) || 0;
      if (holds && w && since > 0 && !questions.some((q) => q.updatedAt > since)) {
        await new Promise((r) => { const x = { r, t: setTimeout(() => { waiters.delete(x); r(); }, w * 1000) }; waiters.add(x); init.signal?.addEventListener('abort', () => { clearTimeout(x.t); waiters.delete(x); r(); }); });
        if (init.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      }
      return res(snap(since), { headers: h });
    }
    return res({ error: 'not_found' }, { status: 404 });
  };
  const push = (text) => { now += 10; questions.push({ id: 'q' + now, text, createdAt: now, updatedAt: now }); for (const x of waiters) { clearTimeout(x.t); x.r(); } waiters.clear(); };
  return { fetch, log, push, snaps: () => log.filter(([, p]) => p.startsWith('/snapshot')) };
}

test('학교망 묻기: 웹소켓·SSE가 막히면 긴 대기(?wait=)로 묻고, 바뀌면 바로 받고, 서버 권고(X-Lec-Poll-Ms)를 쉬는 틈의 아래 한도로 쓴다', async () => {
  const room = fakeRoom({ holds: true, hint: 2500 });
  const W = makeWindow(['http.js'], { fetch: room.fetch });
  const c = W.LecLive.create({ provider: 'http', url: 'https://live.example/live', code: 'LONG1', transports: ['poll'], pollMs: 2000, waitS: 2 });
  const nets = []; c.on('net', (n) => nets.push(n.transport));
  const info = await c.connect();
  assert.equal(info.mode, 'polling');
  await sleep(6500);
  const lp = room.snaps().filter(([, p]) => /wait=2\b/.test(p));
  assert.ok(lp.length >= 1, '긴 대기 요청: ' + JSON.stringify(room.log));
  assert.equal(c.netInfo().transport, 'long');
  assert.equal(c.netInfo().hint, 2500, '서버 권고를 읽음');
  assert.ok(nets.includes('long'), "강사 화면이 들을 'net' 사건");
  // 대기 중에 글이 올라오면 기다리지 않고 바로 받음
  const t0 = Date.now(); room.push('학교망에서 올린 질문');
  while (!c.get('questions', 'q110') && Date.now() - t0 < 5000) await sleep(20); // eslint-disable-line no-await-in-loop
  assert.ok(c.get('questions', 'q110'), '바뀐 것이 오면 바로');
  assert.ok(Date.now() - t0 < 2600, '붙잡힌 요청이 바로 답함(' + (Date.now() - t0) + 'ms)');
  // 쉬는 틈: 이어지는 묻기 사이가 서버 권고(2.5초) 아래로 내려가지 않음
  await sleep(5000);
  const times = room.snaps().map(([t]) => t);
  const gaps = times.slice(2).map((t, i) => t - times[i + 1]);
  assert.ok(gaps.every((g) => g >= 2500 * 0.85 - 20), '간격 ' + gaps.join(','));
  c.close();
});

test('학교망 묻기: 긴 대기를 모르는 서버(바로 답함)는 빈 답 두 번 뒤 간격 묻기로 내려가고, 화면이 숨겨지면 1분으로 늘린다', async () => {
  const room = fakeRoom({ holds: false });
  const doc = { visibilityState: 'visible', listeners: {}, addEventListener(t, f) { this.listeners[t] = f; } };
  const W = makeWindow(['http.js'], { fetch: room.fetch, doc });
  const c = W.LecLive.create({ provider: 'http', url: 'https://live.example/live', code: 'SHORT1', transports: ['poll'], pollMs: 2000, waitS: 2 });
  await c.connect();
  await sleep(7000);
  assert.equal(c.netInfo().transport, 'poll', '바로 답하는 서버 → 간격 묻기');
  const n1 = room.snaps().length;
  assert.ok(n1 >= 3 && n1 <= 6, '7초 동안 묻기 ' + n1 + '번(간격 2초, 헛돌지 않음)');
  // 숨겨진 화면: 다음 묻기가 1분 뒤로
  doc.visibilityState = 'hidden';
  await sleep(2600);
  const n2 = room.snaps().length;
  await sleep(3000);
  assert.equal(room.snaps().length, n2, '숨겨진 동안 묻지 않음');
  assert.ok(c.netInfo().every >= 60000 * 0.8 || c.netInfo().every <= 2600, '다음 간격 ' + c.netInfo().every);
  // 다시 보이면 바로 물음
  doc.visibilityState = 'visible'; doc.listeners.visibilitychange();
  await sleep(400);
  assert.equal(room.snaps().length, n2 + 1, '보이면 바로 한 번');
  c.close();
});

test('묻기 간격 규칙(pollDelay): 오류는 두 배씩 1분까지, 바뀐 것 없이 이어지면 1.5·2·3배로 20초까지, 서버 권고가 아래 한도', () => {
  const W = makeWindow([]);
  const d = W.LecLive.util.pollDelay;
  assert.equal(d(5000, {}), 5000);
  assert.equal(d(5000, { empty: 7 }), 7500);
  assert.equal(d(5000, { empty: 13 }), 10000);
  assert.equal(d(5000, { empty: 30 }), 15000);
  assert.equal(d(7000, { empty: 30 }), 20000);
  assert.equal(d(5000, { hint: 20000, empty: 30 }), 20000);
  assert.equal(d(5000, { hint: 10000 }), 10000);
  assert.equal(d(5000, { err: 1 }), 10000);
  assert.equal(d(5000, { err: 9 }), 60000);
  W.document.visibilityState = 'hidden';
  assert.equal(d(5000, {}), 60000);
  assert.equal(d(5000, { admin: true }), 30000, '강사 화면은 숨겨져도 30초');
});

test('Supabase: 라이브러리 주소(cdn.jsdelivr.net)가 막힌 망이면 같은 RPC를 REST로 불러 묻기로 이어 간다', async () => {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const u = new URL(url); calls.push([u.pathname, init.headers, init.body ? JSON.parse(init.body) : null]);
    const name = u.pathname.replace('/rest/v1/rpc/', '');
    if (name === 'lec_snapshot') return res({ now: 5, time: Date.now(), state: { slide: 2, updatedAt: 1 }, questions: [{ id: 'q1', text: '첫 질문', createdAt: 1, updatedAt: 1 }] });
    if (name === 'lec_reactions') return res({ rx: 0 });
    if (name === 'lec_join') return res({ id: 'p1', token: 't'.repeat(64), nickname: '나' });
    if (name === 'lec_add') return res({ code: 'PT429', message: 'rate_limited', hint: '잠시 후 다시 시도해 주세요.' }, { status: 400 });
    return res(null);
  };
  // <script> 불러오기가 실패하는 문서(막힌 CDN)
  const doc = { visibilityState: 'visible', addEventListener() {}, createElement: () => ({}), head: { appendChild: (el) => setTimeout(() => el.onerror(), 1) } };
  const W = makeWindow(['supabase.js'], { fetch, doc });
  const c = W.LecLive.create({ provider: 'supabase', url: 'https://abc.supabase.co', anonKey: 'sb_publishable_x', code: 'sb1', throttle: false });
  const info = await c.connect();
  assert.equal(info.mode, 'polling', '실시간 없이 묻기');
  assert.equal(c.netInfo().lib, 'rest');
  assert.ok(c.get('questions', 'q1'), 'REST로 읽은 글');
  const [p0, h0] = calls[0];
  assert.equal(p0, '/rest/v1/rpc/lec_snapshot');
  assert.equal(h0.apikey, 'sb_publishable_x'); assert.equal(h0['x-lec-code'], 'SB1');
  await c.join({ nickname: '나' });
  await assert.rejects(c.add('questions', { text: '스팸' }), (e) => e.status === 429, 'PostgREST 오류도 같은 오류 규칙');
  c.close();
});
