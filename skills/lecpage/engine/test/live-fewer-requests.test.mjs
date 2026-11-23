// 수업 한 번의 서버 요청 줄이기(2026-11-24). 줄여도 동작은 같아야 함: 바뀐 것은 생기는 즉시 오고, 예전 서버·예전 런타임과 계속 맞음.
//   ① 긴 대기는 전과 똑같음(기다림 20초·시간제한 기다림+10초, 따로 보내는 요청 없음). 시계는 바로 온 답으로만 맞춤:
//      서버가 붙잡았다 보낸 답의 now는 기다리기 시작한 때일 수 있어(Worker가 대신 기다린 긴 대기) 그것으로 맞추면 타이머가 기다린 만큼 늦게 감
//   ② 가려진 참가자 화면은 묻기를 쉼(다시 보이면 바로), 강사 화면은 그대로
//   ③ 웹소켓으로 동기화를 받음(서버의 hello가 caps에 'sync'를 실을 때만. 답이 늦으면 HTTP로도 묻고 먼저 온 답 하나만 씀),
//      쪽을 옮겨 온 화면은 상태를 따로 묻지 않고 소켓부터(hello가 늦으면 상태도 함께 물어, 서버가 닿지 않는 것을 전과 같은 때에 알림)
//   ④ 서버: 소켓 동기화는 참가자에게 GET snapshot이 주는 것과 같고 관리자 것은 주지 않음, 분당 횟수. 긴 대기는 전과 같음
// 런타임은 가짜 fetch·가짜 WebSocket으로(브라우저 없이), 서버는 실제 Node 서버로.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { liveDir, startNodeServer, api } from './live-helpers.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 8000, step = 40) => { const t0 = Date.now(); for (;;) { if (await fn()) return true; if (Date.now() - t0 > ms) return false; await sleep(step); } };
const res = (body, { status = 200, headers = {} } = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

function fakeStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear(), dump: () => Object.fromEntries(m) };
}
/**
 * 런타임을 넣은 가짜 창. doc.show(v): 보임 상태를 바꾸고 visibilitychange를 알림.
 * session·local: 저장소에 미리 든 값, EventSource: SSE 흉내(없으면 SSE는 곧바로 안 됨)
 */
function makeWindow({ fetch, WebSocket, EventSource, session = {}, local = {} } = {}) {
  const docOn = {}; const winOn = {};
  const doc = { visibilityState: 'visible', addEventListener: (n, f) => { (docOn[n] ||= []).push(f); }, removeEventListener() {}, createElement: () => ({}), head: { appendChild() {} } };
  doc.show = (v) => { doc.visibilityState = v ? 'visible' : 'hidden'; (docOn.visibilitychange || []).forEach((f) => f()); };
  const win = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, Promise, URL, TextEncoder, TextDecoder, Intl, JSON, Math, Date,
    crypto: globalThis.crypto, isSecureContext: true, Uint8Array, Array, Object, String, Number, RegExp, Error, AbortController,
    localStorage: fakeStorage(local), sessionStorage: fakeStorage(session), addEventListener: (n, f) => { (winOn[n] ||= []).push(f); }, removeEventListener() {}, fetch, document: doc,
    location: { href: 'https://site.example/index.html' }, navigator: {},
  };
  if (WebSocket) win.WebSocket = WebSocket;
  if (EventSource) win.EventSource = EventSource;
  win.window = win; win.globalThis = win;
  vm.createContext(win);
  for (const f of ['core.js', 'http.js']) vm.runInContext(fs.readFileSync(path.join(liveDir, f), 'utf8'), win, { filename: f });
  win.fire = (n, ev) => (winOn[n] || []).forEach((f) => f(ev));
  return win;
}
/**
 * 실시간 방 흉내(묻기 방식): snapshot?wait=를 바뀔 때까지(또는 wait초) 붙잡음. 답의 now는 서버 시계(이 PC 시계 + ahead).
 * opt(도중에 바꿀 수 있음) — ahead(ms): 서버 시계가 이 창보다 앞선 만큼,
 * stale: 끝까지 붙잡았다 보내는 답에 기다리기 시작한 때의 now를 실음(긴 대기를 Worker가 대신 기다리는 예전 서버의 답), hang: 긴 대기에 영영 답하지 않음
 */
function fakeRoom(o = {}) {
  const opt = { ahead: 0, stale: false, hang: false, ...o };
  let last = 0; const tick = () => (last = Math.max(Date.now() + opt.ahead, last + 1));
  const log = []; const waiters = new Set(); const questions = [];
  const snap = (since) => ({ now: tick(), state: { updatedAt: 1 }, questions: questions.filter((q) => q.updatedAt > since) });
  const gone = () => Object.assign(new Error('aborted'), { name: 'AbortError' });
  /** ms 동안 붙잡음. 글이 올라오면 바로 → true */
  const hold = (ms, init) => new Promise((r) => {
    const x = { r: () => r(true), t: setTimeout(() => { waiters.delete(x); r(false); }, ms) };
    waiters.add(x);
    init.signal?.addEventListener('abort', () => { clearTimeout(x.t); waiters.delete(x); r(false); });
  });
  /** 답이 영영 오지 않음(런타임이 그만둘 때까지) */
  const never = (init) => new Promise((_, no) => { if (init.signal?.aborted) no(gone()); else init.signal?.addEventListener('abort', () => no(gone())); });
  const answer = async (u, p, init) => {
    if (p === '/state') return res({ updatedAt: 1 });
    if (p !== '/snapshot') return res({ error: 'not_found' }, { status: 404 });
    const since = Number(u.searchParams.get('since')) || 0; const w = Number(u.searchParams.get('wait')) || 0;
    if (w && since > 0 && !questions.some((q) => q.updatedAt > since)) {
      if (opt.hang) return never(init);
      const first = snap(since);
      const woke = await hold(w * 1000, init);
      if (init.signal?.aborted) throw gone();
      if (!woke && opt.stale) return res(first);
    }
    return res(snap(since));
  };
  const fetch = async (url, init = {}) => {
    const u = new URL(url); const p = u.pathname.replace(/^.*\/api\/[A-Z0-9]+/, '');
    const h = init.headers || {};
    const e = { at: Date.now(), p, query: u.search, wait: Number(u.searchParams.get('wait')) || 0, admin: !!h['X-Lec-Admin'], done: false, doneAt: 0 };
    log.push(e);
    try { return await answer(u, p, init); } finally { e.done = true; e.doneAt = Date.now(); }
  };
  const push = (text) => { const t = tick(); questions.push({ id: 'q' + t, text, createdAt: t, updatedAt: t }); for (const x of [...waiters]) { clearTimeout(x.t); waiters.delete(x); x.r(); } };
  const reals = () => log.filter((x) => x.p === '/snapshot' && x.wait);
  return {
    opt, fetch, log, push, reals,
    /** 긴 대기의 기다림들 */
    waits: () => reals().map((x) => x.wait), snaps: () => log.filter((x) => x.p === '/snapshot'),
    /** 긴 대기 하나가 지금 붙잡혀 있는지 */
    flying: () => { const l = reals().at(-1); return !!l && !l.done && Date.now() - l.at > 150; },
  };
}
/** 시험이 만든 연결들: 시험이 도중에 실패해도 끝에 모두 닫음(남은 타이머가 시험 과정을 붙잡지 않게) */
const opened = [];
const keep = (c) => { opened.push(c); return c; };
after(() => { for (const c of opened) { try { c.close(); } catch { /* 이미 닫힘 */ } } });
const poller = (room, extra = {}, win = {}) => {
  const W = makeWindow({ fetch: room.fetch, ...win });
  const c = keep(W.LecLive.create({ provider: 'http', url: 'https://live.example/live', code: 'WAIT1', transports: ['poll'], pollMs: 2000, waitS: 2, ...extra }));
  return { W, c };
};

/** 글이 올라온 때부터 이 화면이 받을 때까지(ms). 긴 대기가 붙잡혀 있는 때를 골라 올림(쉬는 틈에 올리면 그 틈만큼 걸림) */
async function reaction(room, c, text) {
  assert.ok(await until(() => room.flying(), 12000), `긴 대기가 붙잡혀 있는 때를 잡음(${text})`);
  const got = new Promise((ok) => { const off = c.on('change:questions', (list) => { if (list.some((q) => q.text === text)) { off && off(); ok(Date.now()); } }); });
  const t0 = Date.now(); room.push(text);
  const at = await Promise.race([got, sleep(4000).then(() => 0)]);
  return at ? at - t0 : Infinity;
}

test('긴 대기는 전과 같다: 정한 기다림으로만 묻고(따로 보내는 요청·기억 없음), 바뀐 것은 바로 오며, 답이 없으면 기다림+10초에 그만둔다', { timeout: 60000 }, async () => {
  const room = fakeRoom();
  const { W, c } = poller(room);
  await c.connect();
  assert.ok(await until(() => room.reals().filter((x) => x.done).length >= 2, 20000));
  const d = await reaction(room, c, '긴 대기 중에 온 질문');
  assert.ok(d < 700, `바뀐 것은 바로 받음(${d}ms)`);
  assert.ok(await until(() => room.reals().filter((x) => x.done).length >= 4, 20000));
  assert.ok(room.waits().every((w) => w === 2), `늘 정한 기다림(${room.waits()})`);
  assert.ok(room.snaps().every((x) => /^\?since=\d+(&wait=2)?$/.test(x.query)), `snapshot 요청은 since·wait뿐(${[...new Set(room.snaps().map((x) => x.query.replace(/\d{6,}/, 'N')))]})`);
  assert.deepEqual(room.log.filter((x) => x.p !== '/snapshot').map((x) => x.p), ['/state'], '그 밖의 요청은 처음의 상태 확인 하나');
  const ni = c.netInfo();
  assert.deepEqual(Object.keys(ni).sort(), ['every', 'hint', 'longOk', 'provider', 'status', 'transport', 'wait']);
  assert.equal(ni.transport, 'long'); assert.equal(ni.wait, 2);
  assert.ok(!Object.keys({ ...W.sessionStorage.dump(), ...W.localStorage.dump() }).some((k) => /:wait$/.test(k)), '기다림을 저장소에 적지 않음');
  // 답이 영영 오지 않는 긴 대기: 기다림 + 10초에 그만둠(전과 같은 시간제한)
  assert.ok(await until(() => room.flying(), 12000)); await until(() => !room.flying(), 12000);
  room.opt.hang = true;
  const n = room.reals().length;
  assert.ok(await until(() => room.reals().length > n, 8000));
  const hung = room.reals()[n];
  assert.ok(await until(() => hung.done, 16000), '시간제한이 있음');
  assert.ok(hung.doneAt - hung.at >= 11500 && hung.doneAt - hung.at <= 13500, `기다림 2초 + 10초 뒤에 그만둠(${hung.doneAt - hung.at}ms)`);
  c.close();
});

test('시계: 서버가 붙잡았다 보낸 답으로는 맞추지 않는다(그 답의 now는 기다리기 시작한 때일 수 있음 — 타이머가 기다린 만큼 늦게 가지 않게). 바로 온 답으로는 맞춘다', { timeout: 60000 }, async () => {
  // 서버 시계가 이 기기보다 5초 앞섬. 끝까지 붙잡았다 보내는 답은 기다리기 시작한 때의 now를 실음(긴 대기를 Worker가 대신 기다리는 예전 서버)
  const room = fakeRoom({ ahead: 5000, stale: true });
  const { c } = poller(room);
  await c.connect();
  /** 이 화면이 아는 서버 시각의 오차(ms): 0이면 맞음, 음수면 뒤처짐 */
  const err = () => c.now() - (Date.now() + room.opt.ahead);
  assert.ok(Math.abs(err()) < 300, `첫 동기화로 시계를 맞춤(${err()}ms)`);
  let worst = 0; const iv = setInterval(() => { worst = Math.min(worst, err()); }, 50);
  assert.ok(await until(() => room.reals().filter((x) => x.done && x.doneAt - x.at >= 1900).length >= 3, 30000), '끝까지 붙잡힌 긴 대기가 세 번 돌아옴');
  await sleep(300); clearInterval(iv);
  assert.ok(worst > -300, `붙잡았다 보낸 답이 시계를 뒤로 돌리지 않음(가장 뒤처진 때 ${worst}ms — 그 답으로 맞추면 -2000ms)`);
  // 바로 온 답(쉬는 틈에 생긴 것을 다음 묻기가 곧바로 받음)으로는 맞춤: 서버 시계가 9초 앞선 것으로 바뀜
  assert.ok(await until(() => room.flying(), 12000)); assert.ok(await until(() => !room.flying(), 12000));
  room.opt.ahead = 9000; room.push('쉬는 틈에 온 질문');
  assert.ok(await until(() => Math.abs(err()) < 300, 8000), `바로 온 답으로 시계를 맞춤(${err()}ms)`);
  c.close();
});

test('가려진 화면: 참가자는 묻기를 쉬고(5분에 한 번), 다시 보이면 바로 한 번 묻는다. 강사 화면은 가려져도 지금처럼 이어 간다', { timeout: 40000 }, async () => {
  const room = fakeRoom();
  const { W, c } = poller(room, { restHidden: true }); // 참가자 화면(lecpage.js)이 켜는 값
  await c.connect();
  assert.ok(await until(() => room.snaps().length >= 2, 10000));
  W.document.show(false);
  // 가려진 뒤 길어야 한 번 더 묻고(기다리던 것) 쉼
  assert.ok(await until(() => c.netInfo().every >= 240000, 12000), `다음 묻기는 몇 분 뒤(${c.netInfo().every}ms)`);
  const n = room.snaps().length; await sleep(4500);
  assert.equal(room.snaps().length, n, '쉬는 동안 묻지 않음');
  const t0 = Date.now(); W.document.show(true);
  assert.ok(await until(() => room.snaps().length > n, 3000), '다시 보이면 바로 한 번');
  assert.ok(Date.now() - t0 < 1500);
  // 창이 다시 앞에 옴(visibilitychange 없이): 쉬고 있을 때만 당김, 평소에는 묻기를 늘리지 않음
  await sleep(300); const k = room.snaps().length; W.fire('focus'); W.fire('pageshow'); await sleep(400);
  assert.ok(room.snaps().length <= k + 1, '평소의 창 오가기로 묻기가 늘지 않음');
  c.close();
  // 강사 화면(관리자 키): 가려져도 30초 간격으로 이어 감
  const room2 = fakeRoom();
  const { W: W3, c: c3 } = poller(room2);
  c3.setAdminKey('강사-키-시험-0001');
  await c3.connect();
  W3.document.show(false);
  assert.ok(await until(() => c3.netInfo().every >= 20000, 12000));
  assert.ok(c3.netInfo().every <= 45000, `강사 화면은 30초쯤(${c3.netInfo().every}ms)`);
  c3.close();
  // 발표 화면처럼 restHidden을 켜지 않은 화면(관리자 키 없이 연 것 포함): 가려져도 전처럼 1분 간격
  const room3 = fakeRoom();
  const { W: W4, c: c4 } = poller(room3);
  await c4.connect();
  W4.document.show(false);
  assert.ok(await until(() => c4.netInfo().every >= 45000, 12000));
  assert.ok(c4.netInfo().every <= 75000, `켜지 않은 화면은 전처럼 1분쯤(${c4.netInfo().every}ms)`);
  c4.close();
});

// ── 웹소켓으로 동기화 ─────────────────────────────────────────────
/**
 * 가짜 WebSocket: 열리면 hello(caps)를 보내고(helloAfter ms 뒤. open: false면 영영 열리지 않음), 받은 메시지를 기록.
 * sync 요청에는 reply가 replyAfter ms 뒤에 답함(없으면 답하지 않음)
 */
function fakeWsClass({ caps, reply, helloAfter = 5, replyAfter = 5, open = true } = {}) {
  const socks = [];
  class FakeWS {
    constructor(url) {
      this.url = url; this.readyState = 0; this.sent = []; socks.push(this);
      if (open) setTimeout(() => { if (this.readyState === 3) return; this.readyState = 1; this.onopen?.(); this.onmessage?.({ data: JSON.stringify({ type: 'hello', now: Date.now(), mode: 'ws', protocol: 1, ...(caps ? { caps } : {}) }) }); }, helloAfter);
    }
    send(m) {
      this.sent.push(m);
      if (m === 'ping') return void setTimeout(() => this.onmessage?.({ data: 'pong' }), 1);
      let o; try { o = JSON.parse(m); } catch { return; }
      if (o.type === 'sync' && reply) { const r = reply(o); if (r) setTimeout(() => this.onmessage?.({ data: JSON.stringify({ type: 'sync', id: o.id, ...r }) }), replyAfter); }
    }
    close() { this.readyState = 3; this.onclose?.(); }
  }
  return { FakeWS, socks, syncs: () => socks.flatMap((s) => s.sent).filter((m) => /"type":"sync"/.test(m)).map((m) => JSON.parse(m)) };
}
/** 영영 열리지 않는 SSE(막힌 망·닿지 않는 서버) */
class HangES { close() {} }
const snapDoc = (since, text = '소켓으로 온 질문') => ({ now: 500, since, full: since === 0, state: { updatedAt: 0, slide: 3 }, questions: since ? [] : [{ id: 'q1', text, createdAt: 400, updatedAt: 400 }], removed: [] });
/** HTTP 쪽 흉내. snapAfter(ms): snapshot 답이 걸리는 시간, text: 그 답에 실리는 질문(소켓으로 온 답과 가려 보게), dead: 아무 답도 오지 않음(런타임이 그만둘 때까지) */
function httpRoom({ snapAfter = 0, text, dead = false } = {}) {
  const log = [];
  const hang = (init) => new Promise((_, no) => { init?.signal?.addEventListener('abort', () => no(Object.assign(new Error('aborted'), { name: 'AbortError' }))); });
  const fetch = async (url, init) => {
    const u = new URL(url); const p = u.pathname.replace(/^.*\/api\/[A-Z0-9]+/, ''); log.push(p);
    if (dead) return hang(init);
    if (p === '/state') return res({ updatedAt: 0, slide: 3 });
    if (p === '/snapshot') { if (snapAfter) await sleep(snapAfter); return res(snapDoc(Number(u.searchParams.get('since')) || 0, text)); }
    return res({ error: 'not_found' }, { status: 404 });
  };
  return { fetch, log };
}
const wsClient = (W) => keep(W.LecLive.create({ provider: 'http', url: 'https://live.example/live', code: 'SYNC1' }));
const syncOk = (o) => ({ ok: true, doc: snapDoc(o.since) });

test('소켓 동기화: 서버가 caps에 sync를 실으면 snapshot을 HTTP로 묻지 않고, 상태도 다시 묻지 않는다. 쪽을 옮겨 온 화면은 요청이 소켓 하나뿐', { timeout: 30000 }, async () => {
  const http = httpRoom(); const ws = fakeWsClass({ caps: ['sync'], reply: (o) => ({ ok: true, doc: snapDoc(o.since) }) });
  const W = makeWindow({ fetch: http.fetch, WebSocket: ws.FakeWS });
  const c = wsClient(W);
  const info = await c.connect();
  assert.equal(info.transport, 'ws');
  assert.deepEqual(http.log, ['/state'], '처음 접속: 상태 확인 한 번 + 소켓(동기화는 소켓으로)');
  assert.equal(ws.syncs().length, 1); assert.equal(ws.syncs()[0].since, 0);
  assert.equal((await c.list('questions'))[0].text, '소켓으로 온 질문', '받은 것은 HTTP 때와 같음');
  const st = await c.getState();
  assert.equal(st.slide, 3); assert.deepEqual(http.log, ['/state'], '첫 동기화가 상태를 받아 왔으면 다시 묻지 않음(강사가 아직 아무것도 바꾸지 않은 방 포함)');
  c.close();
  // 같은 탭의 다음 쪽: 상태를 따로 묻지 않고 소켓부터
  const http2 = httpRoom(); const ws2 = fakeWsClass({ caps: ['sync'], reply: (o) => ({ ok: true, doc: snapDoc(o.since) }) });
  const W2 = makeWindow({ fetch: http2.fetch, WebSocket: ws2.FakeWS, session: W.sessionStorage.dump() });
  const c2 = wsClient(W2);
  assert.equal((await c2.connect()).transport, 'ws');
  await c2.getState();
  assert.deepEqual(http2.log, [], '쪽 이동: HTTP 요청 0번(소켓 연결 하나 + 소켓 메시지 하나)');
  assert.equal((await c2.getState()).slide, 3); assert.equal((await c2.list('questions')).length, 1);
  c2.close();
});

test('소켓 동기화: 예전 서버(caps 없음)·답이 없는 소켓·소켓으로 못 주는 답은 그 자리에서 HTTP로 받는다. 강사 화면은 늘 HTTP', { timeout: 40000 }, async () => {
  // 예전 서버
  const h1 = httpRoom(); const w1 = fakeWsClass({});
  const c1 = wsClient(makeWindow({ fetch: h1.fetch, WebSocket: w1.FakeWS }));
  await c1.connect();
  assert.deepEqual(h1.log, ['/state', '/snapshot'], '예전 서버: 지금과 같은 요청');
  assert.equal(w1.syncs().length, 0); c1.close();
  // 답이 없는 소켓: 기다린 뒤 HTTP로, 두 번 이어지면 그 화면에서는 HTTP로만
  const h2 = httpRoom(); const w2 = fakeWsClass({ caps: ['sync'] });
  const c2 = wsClient(makeWindow({ fetch: h2.fetch, WebSocket: w2.FakeWS }));
  await c2.connect();
  assert.deepEqual(h2.log, ['/state', '/snapshot'], '답이 없으면 HTTP로 받음');
  assert.equal((await c2.list('questions')).length, 1);
  await c2.sync(); await c2.sync();
  assert.equal(w2.syncs().length, 2, '두 번 답이 없으면 더 묻지 않음');
  c2.close();
  // 너무 커서 소켓으로 못 주는 답
  const h3 = httpRoom(); const w3 = fakeWsClass({ caps: ['sync'], reply: () => ({ ok: false, error: 'too_big', status: 413 }) });
  const c3 = wsClient(makeWindow({ fetch: h3.fetch, WebSocket: w3.FakeWS }));
  await c3.connect();
  assert.deepEqual(h3.log, ['/state', '/snapshot']); c3.close();
  // 서버가 거절(방이 붐빔): HTTP 때와 같은 오류로 다룸(조용히 HTTP로 다시 묻지 않음)
  const h4 = httpRoom(); const w4 = fakeWsClass({ caps: ['sync'], reply: () => ({ ok: false, error: 'room_busy', message: '붐벼요', status: 429, retryAfter: 30 }) });
  const c4 = wsClient(makeWindow({ fetch: h4.fetch, WebSocket: w4.FakeWS }));
  await c4.connect();
  assert.deepEqual(h4.log, ['/state'], '거절은 HTTP로 돌려 묻지 않음');
  assert.equal(c4.lastError && c4.lastError.code, 'room_busy'); assert.equal(c4.lastError.status, 429);
  c4.close();
  // 강사 화면
  const h5 = httpRoom(); const w5 = fakeWsClass({ caps: ['sync'], reply: (o) => ({ ok: true, doc: snapDoc(o.since) }) });
  const W5 = makeWindow({ fetch: h5.fetch, WebSocket: w5.FakeWS, session: { 'x': '1' } });
  const c5 = wsClient(W5); c5.setAdminKey('강사-키-시험-0001');
  await c5.connect();
  assert.ok(h5.log.includes('/snapshot') && h5.log.includes('/state'), `강사 화면은 상태 확인과 snapshot을 HTTP로(${h5.log})`);
  assert.equal(w5.syncs().length, 0); c5.close();
});

test('소켓 동기화: 답이 늦으면 HTTP로도 묻고 먼저 온 온전한 답 하나만 쓴다(늦게 온 소켓 답도 받음). 소켓으로 온 서버 오류(5xx)는 그 자리에서 HTTP로', { timeout: 60000 }, async (t) => {
  const texts = async (c) => Array.from((await c.list('questions')).map((q) => q.text)); // 가짜 창 안의 배열 → 이쪽 배열(견줄 수 있게)
  // ① 소켓 답이 5.6초에 옴(느린 망의 큰 답), HTTP 답은 더 늦음(5초에 물어 4초 뒤): 소켓 답을 쓰고, 뒤에 온 HTTP 답은 버림
  const h1 = httpRoom({ snapAfter: 4000, text: 'HTTP로 온 질문' }); const w1 = fakeWsClass({ caps: ['sync'], reply: syncOk, replyAfter: 5600 });
  const c1 = wsClient(makeWindow({ fetch: h1.fetch, WebSocket: w1.FakeWS }));
  let t0 = Date.now(); await c1.connect(); const d1 = Date.now() - t0;
  assert.ok(d1 >= 5500 && d1 < 7500, `늦게 온 소켓 답을 씀(${d1}ms — HTTP 답만 기다리면 9초)`);
  assert.deepEqual(h1.log, ['/state', '/snapshot'], '5초에 HTTP로도 물음');
  assert.deepEqual(await texts(c1), ['소켓으로 온 질문']);
  await sleep(4000);
  assert.deepEqual(await texts(c1), ['소켓으로 온 질문'], '뒤에 온 HTTP 답은 합치지 않음(답 하나만)');
  c1.close();
  // ② HTTP 답이 먼저 오고 소켓 답이 그 뒤에 옴: HTTP 답을 쓰고, 뒤에 온 소켓 답은 버림
  const h2 = httpRoom({ text: 'HTTP로 온 질문' }); const w2 = fakeWsClass({ caps: ['sync'], reply: syncOk, replyAfter: 6500 });
  const c2 = wsClient(makeWindow({ fetch: h2.fetch, WebSocket: w2.FakeWS }));
  t0 = Date.now(); await c2.connect(); const d2 = Date.now() - t0;
  assert.ok(d2 >= 4900 && d2 < 6300, `5초에 HTTP로 물어 그 답을 씀(${d2}ms)`);
  assert.deepEqual(await texts(c2), ['HTTP로 온 질문']);
  await sleep(2200);
  assert.deepEqual(await texts(c2), ['HTTP로 온 질문'], '뒤에 온 소켓 답은 합치지 않음');
  c2.close();
  // ③ 소켓으로 온 서버 오류(5xx): 기다리지 않고 HTTP로 받음
  const h3 = httpRoom({ text: 'HTTP로 온 질문' }); const w3 = fakeWsClass({ caps: ['sync'], reply: () => ({ ok: false, error: 'server_error', message: '서버 오류가 났어요.', status: 500 }) });
  const c3 = wsClient(makeWindow({ fetch: h3.fetch, WebSocket: w3.FakeWS }));
  t0 = Date.now(); await c3.connect(); const d3 = Date.now() - t0;
  assert.ok(d3 < 2000, `바로 HTTP로(${d3}ms)`);
  assert.deepEqual(h3.log, ['/state', '/snapshot']); assert.deepEqual(await texts(c3), ['HTTP로 온 질문']);
  c3.close();
  t.diagnostic(`첫 동기화까지 — 늦은 소켓 답 ${d1}ms(HTTP만 기다리면 9초), HTTP가 먼저 ${d2}ms, 소켓의 5xx ${d3}ms`);
});

test('소켓부터 여는 접속(쪽을 옮겨 온 화면): hello가 늦으면 상태도 함께 물어, 서버가 닿지 않는 것을 상태부터 묻던 때와 같은 때에 알린다', { timeout: 60000 }, async (t) => {
  // 이 탭에서 방금 전까지 웹소켓이 됨
  const h0 = httpRoom(); const w0 = fakeWsClass({ caps: ['sync'], reply: syncOk });
  const W0 = makeWindow({ fetch: h0.fetch, WebSocket: w0.FakeWS }); const c0 = wsClient(W0);
  await c0.connect(); c0.close();
  const tab = W0.sessionStorage.dump();
  // ① hello가 늦게(2.5초) 오는 소켓: 1.5초에 상태를 HTTP로 한 번 묻고, 소켓으로 이어짐(동기화는 소켓으로)
  const h1 = httpRoom(); const w1 = fakeWsClass({ caps: ['sync'], reply: syncOk, helloAfter: 2500 });
  const c1 = wsClient(makeWindow({ fetch: h1.fetch, WebSocket: w1.FakeWS, session: tab }));
  assert.equal((await c1.connect()).transport, 'ws'); assert.deepEqual(h1.log, ['/state']); c1.close();
  // ② 소켓·SSE가 막힌 망(HTTP는 됨): 상태는 한 번만 묻고 묻기 방식으로 내려감
  const h2 = httpRoom(); const w2 = fakeWsClass({ open: false });
  const c2 = wsClient(makeWindow({ fetch: h2.fetch, WebSocket: w2.FakeWS, session: tab }));
  let t0 = Date.now(); const info = await c2.connect(); const d2 = Date.now() - t0;
  assert.equal(info.transport, 'poll'); assert.equal(h2.log.filter((p) => p === '/state').length, 1, '상태는 한 번만 물음');
  assert.ok(d2 < 5500, `소켓을 기다린 4초 뒤 바로 묻기 방식으로(${d2}ms)`);
  c2.close();
  // ③ 서버가 닿지 않음(소켓·SSE·HTTP 모두 답이 없음): 처음 '연결 끊김'과 그만두는 때가 상태부터 묻는 접속(전의 방식)과 같음
  const dead = async (session) => {
    const h = httpRoom({ dead: true }); const w = fakeWsClass({ open: false });
    const c = wsClient(makeWindow({ fetch: h.fetch, WebSocket: w.FakeWS, EventSource: HangES, session }));
    const s0 = Date.now(); let first = 0; c.on('status', (s) => { if (s === 'offline' && !first) first = Date.now() - s0; });
    await assert.rejects(c.connect());
    const out = { first, gaveUp: Date.now() - s0, states: h.log.filter((p) => p === '/state').length, sockets: w.socks.length };
    c.close();
    return out;
  };
  const [old, fast] = await Promise.all([dead({}), dead(tab)]);
  t.diagnostic(`서버가 닿지 않을 때 — 상태부터 묻는 접속: 처음 끊김 ${old.first}ms·그만둠 ${old.gaveUp}ms, 소켓부터 여는 접속: 처음 끊김 ${fast.first}ms·그만둠 ${fast.gaveUp}ms`);
  assert.equal(old.sockets, 0); assert.ok(fast.sockets >= 1, '소켓부터 열어 봄');
  assert.ok(fast.first >= 7500 && fast.first <= 8800, `처음 끊김은 8초쯤(${fast.first}ms)`);
  assert.ok(Math.abs(fast.first - old.first) < 600, `전과 같은 때(${fast.first}ms · 전 ${old.first}ms)`);
  assert.ok(Math.abs(fast.gaveUp - old.gaveUp) < 1500, `그만두는 때도 같음(${fast.gaveUp}ms · 전 ${old.gaveUp}ms)`);
  assert.equal(fast.states, old.states, '상태 확인 요청 수도 같음');
});

// ── 서버 ─────────────────────────────────────────────────────────
const ADMIN = '요청-줄이기-시험-관리자키-24';
let srv;
before(async () => { srv = await startNodeServer({ adminKey: ADMIN }); });
after(async () => { await srv?.close(); });
const openWs = (code) => new Promise((ok, no) => {
  const s = new WebSocket(srv.url.replace(/^http/, 'ws') + '/api/' + code + '/ws'); const got = []; const wait = [];
  s.onmessage = (e) => { let m = e.data; try { m = JSON.parse(e.data); } catch { /* 글 그대로 */ } got.push(m); wait.splice(0).forEach((f) => f()); };
  s.onerror = () => no(new Error('ws'));
  s.next = async (pred, ms = 4000) => { const t0 = Date.now(); for (;;) { const i = got.findIndex(pred); if (i >= 0) return got.splice(i, 1)[0]; if (Date.now() - t0 > ms) throw new Error('소켓 답 없음'); await Promise.race([new Promise((r) => wait.push(r)), sleep(200)]); } };
  s.onopen = () => ok(s);
});

test('서버: 소켓 동기화는 참가자에게 GET snapshot이 주는 것과 같고, 관리자 것은 주지 않으며, 예전 런타임이 쓰는 것은 그대로다', { timeout: 30000 }, async () => {
  const A = api(srv.url, 'SYNCA');
  await A.call('PUT', '/state', { admin: ADMIN, body: { slide: 2 } });
  const me = (await A.call('POST', '/join', { body: { nickname: '봄날' } })).body;
  const other = (await A.call('POST', '/join', { body: { nickname: '여름' } })).body;
  await A.call('POST', '/questions', { token: me.token, body: { text: '쉬는 시간은 언제인가요?' } });
  await A.call('POST', '/attendance', { token: me.token, body: { kind: 'in' } });
  await A.call('POST', '/attendance', { token: other.token, body: { kind: 'in' } });
  const ws = await openWs('SYNCA');
  const hello = await ws.next((m) => m && m.type === 'hello');
  assert.ok(hello.now > 0 && hello.mode === 'ws' && hello.protocol, '예전 런타임이 읽는 칸은 그대로');
  assert.deepEqual(hello.caps, ['sync']);
  ws.send('ping'); assert.equal(await ws.next((m) => m === 'pong'), 'pong');
  // 내 토큰으로: HTTP와 같은 답
  ws.send(JSON.stringify({ type: 'sync', id: 'a1', since: 0, token: me.token }));
  const r = await ws.next((m) => m && m.type === 'sync' && m.id === 'a1');
  const viaHttp = (await A.call('GET', '/snapshot?since=0', { token: me.token })).body;
  assert.equal(r.ok, true);
  const { now: n1, ...h } = viaHttp; const { now: n2, ...s } = r.doc;
  assert.ok(Math.abs(n1 - n2) < 5000);
  assert.deepEqual(s, h, '소켓으로 받은 것 = HTTP로 받은 것');
  assert.equal(r.doc.questions.length, 1); assert.equal(r.doc.attendance.length, 1, '내 출석만'); assert.equal(r.doc.me.id, me.id);
  assert.ok(!r.doc.participants || !r.doc.participants.length, '참가자 명단은 주지 않음');
  // 토큰 없이: 공개된 것만. 관리자 소켓이어도 동기화는 참가자 보기
  ws.send(JSON.stringify({ type: 'sync', id: 'a2', since: 0 }));
  const pub = await ws.next((m) => m && m.type === 'sync' && m.id === 'a2');
  assert.ok(pub.ok && !pub.doc.me && (!pub.doc.attendance || !pub.doc.attendance.length));
  ws.send(JSON.stringify({ type: 'auth', admin: ADMIN })); assert.equal((await ws.next((m) => m && m.type === 'auth')).ok, true);
  ws.send(JSON.stringify({ type: 'sync', id: 'a3', since: 0 }));
  const adm = await ws.next((m) => m && m.type === 'sync' && m.id === 'a3');
  assert.ok(adm.ok && (!adm.doc.participants || !adm.doc.participants.length), '관리자 소켓에도 명단을 싣지 않음(강사 화면은 HTTP로 받음)');
  // since: 바뀐 것만
  ws.send(JSON.stringify({ type: 'sync', id: 'a4', since: r.doc.now, token: me.token }));
  const inc = await ws.next((m) => m && m.type === 'sync' && m.id === 'a4');
  assert.equal(inc.doc.questions.length, 0); assert.equal(inc.doc.full, false);
  // 분당 횟수
  for (let i = 0; i < 40; i++) ws.send(JSON.stringify({ type: 'sync', id: 'b' + i, since: r.doc.now }));
  const last = await ws.next((m) => m && m.type === 'sync' && m.id === 'b39');
  assert.equal(last.ok, false); assert.equal(last.error, 'rate_limited'); assert.equal(last.status, 429); assert.ok(last.retryAfter > 0);
  ws.close();
});

test('서버: 긴 대기는 전과 같다 — 청한 만큼만 붙잡고 바뀌면 바로 답하며, 붙잡았다 보내는 답의 now는 보내는 때의 시각이다', { timeout: 30000 }, async () => {
  const A = api(srv.url, 'SYNCB');
  await A.call('PUT', '/state', { admin: ADMIN, body: { slide: 1 } });
  const me = (await A.call('POST', '/join', { body: { nickname: '가을' } })).body;
  const cur = (await A.call('GET', '/snapshot?since=0')).body.now;
  let t0 = Date.now();
  const held = await A.call('GET', `/snapshot?since=${cur}&wait=2`);
  assert.ok(Date.now() - t0 >= 1800 && Date.now() - t0 < 4000, `2초를 청하면 2초(${Date.now() - t0}ms)`);
  // 런타임은 이 now로 시계를 맞춤(예전 런타임은 붙잡았다 온 답으로도): 기다리기 시작한 때가 아니라 답을 보내는 때여야 타이머가 늦게 가지 않음
  assert.ok(Math.abs(held.body.now - Date.now()) < 500, `붙잡았다 보낸 답의 now는 보낸 때(${held.body.now - Date.now()}ms)`);
  assert.deepEqual(Object.keys(held.body).filter((k) => /wait|probe/i.test(k)), [], '답에 기다림에 대한 칸은 없음');
  assert.equal(held.headers.get('timing-allow-origin'), null);
  t0 = Date.now();
  const p = A.call('GET', `/snapshot?since=${held.body.now}&wait=50`);
  await sleep(400); await A.call('POST', '/questions', { token: me.token, body: { text: '기다리는 중에 올린 질문' } });
  const woke = await p;
  assert.ok(Date.now() - t0 < 2500, `바뀌면 바로(${Date.now() - t0}ms)`);
  assert.equal(woke.body.questions.length, 1);
  // 모르는 값이 붙어도(…&probe=1) 보통 긴 대기: 바뀌면 바로, 자료와 함께
  t0 = Date.now();
  const lp = A.call('GET', `/snapshot?since=${woke.body.now}&wait=20&probe=1`);
  await sleep(300); await A.call('POST', '/questions', { token: me.token, body: { text: '둘째 질문' } });
  const r2 = await lp;
  assert.ok(Date.now() - t0 < 2000); assert.equal(r2.body.questions.length, 1); assert.equal(r2.body.probe, undefined);
});
