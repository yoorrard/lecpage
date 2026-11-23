// 수업 한 번의 서버 요청 줄이기(2026-11-24). 줄여도 동작은 같아야 함: 바뀐 것은 생기는 즉시 오고, 예전 서버·예전 런타임과 계속 맞음.
//   ① 긴 대기의 기다림을 올림: 실제 묻기는 확인된 기다림(처음 20초) 그대로 두고, 더 긴 기다림이 되는 망인지는 따로 보내는 시험 요청(probe=1)으로
//      확인한 뒤에만(서버가 상한을 알려 줄 때만, HTTP/1.1로 올 때만). 알아보는 동안에도 올린 뒤에도 바뀐 것이 늦게 보이는 일이 없음.
//      확인된 값은 탭·기기에 기억하고, 망이 바뀌었을 수 있으면 버리고 다시 시험함
//   ② 가려진 참가자 화면은 묻기를 쉼(다시 보이면 바로), 강사 화면은 그대로
//   ③ 웹소켓으로 동기화를 받음(서버의 hello가 caps에 'sync'를 실을 때만), 쪽을 옮겨 온 화면은 상태를 따로 묻지 않음
//   ④ 서버: 소켓 동기화는 참가자에게 GET snapshot이 주는 것과 같고 관리자 것은 주지 않음, 분당 횟수, 답에 긴 대기 상한(waitMax)
// 런타임은 가짜 fetch·가짜 WebSocket으로(브라우저 없이), 서버는 실제 Node 서버로.
import { test, before, after, describe } from 'node:test';
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
 * session·local: 저장소에 미리 든 값(storage: false면 저장소를 못 쓰는 환경), proto: 답을 실어 온 프로토콜(자원 시간 기록의 nextHopProtocol. null이면 기록이 없는 브라우저),
 * clock.skew(ms): 이 창의 시계를 그만큼 앞당김(1분 가려짐·하루 지남을 기다리지 않고 봄)
 */
function makeWindow({ fetch, WebSocket, session = {}, local = {}, storage = true, proto = 'http/1.1', clock = { skew: 0 } } = {}) {
  const docOn = {}; const winOn = {}; const observers = [];
  const doc = { visibilityState: 'visible', addEventListener: (n, f) => { (docOn[n] ||= []).push(f); }, removeEventListener() {}, createElement: () => ({}), head: { appendChild() {} } };
  doc.show = (v) => { doc.visibilityState = v ? 'visible' : 'hidden'; (docOn.visibilitychange || []).forEach((f) => f()); };
  class SkewDate extends Date { constructor(...a) { if (a.length) super(...a); else super(Date.now() + clock.skew); } static now() { return Date.now() + clock.skew; } }
  // 요청이 끝나면 조금 뒤에 자원 시간 기록이 옴(브라우저처럼)
  const timed = fetch && ((url, init) => fetch(url, init).finally(() => { if (proto !== null) setTimeout(() => observers.forEach((cb) => cb({ getEntries: () => [{ name: String(url), nextHopProtocol: proto }] })), 15); }));
  const win = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, Promise, URL, TextEncoder, TextDecoder, Intl, JSON, Math, Date: SkewDate,
    crypto: globalThis.crypto, isSecureContext: true, Uint8Array, Array, Object, String, Number, RegExp, Error, AbortController,
    localStorage: storage ? fakeStorage(local) : null, sessionStorage: storage ? fakeStorage(session) : null, addEventListener: (n, f) => { (winOn[n] ||= []).push(f); }, removeEventListener() {}, fetch: timed, document: doc,
    location: { href: 'https://site.example/index.html' }, navigator: {},
  };
  if (proto !== null) win.PerformanceObserver = function (cb) { this.observe = () => { observers.push(cb); }; this.disconnect = () => {}; };
  if (WebSocket) win.WebSocket = WebSocket;
  win.window = win; win.globalThis = win;
  vm.createContext(win);
  for (const f of ['core.js', 'http.js']) vm.runInContext(fs.readFileSync(path.join(liveDir, f), 'utf8'), win, { filename: f });
  win.fire = (n, ev) => (winOn[n] || []).forEach((f) => f(ev));
  win.clock = clock;
  /** 이 창이 기억한 기다림({ tab, device }) */
  win.waitMem = () => { const pick = (s) => { if (!s) return null; const k = Object.keys(s.dump()).find((x) => /:wait$/.test(x)); return k ? JSON.parse(s.getItem(k)) : null; }; return { tab: pick(win.sessionStorage), device: pick(win.localStorage) }; };
  return win;
}
/**
 * 실시간 방 흉내(묻기 방식): snapshot?wait=를 바뀔 때까지(또는 wait초) 붙잡음. 시험 요청(probe=1)은 바뀌어도 wait초를 다 채우고 { probe: true }로 답함.
 * opt(도중에 바꿀 수 있음) — waitMax: 답에 실을 상한(없으면 예전 서버), silentAt(초): 이만큼 붙잡힌 요청은 망이 답 없이 끊음(답이 영영 오지 않음: 조용히 끊는 프록시),
 * cutAt(초): 이보다 긴 실제 묻기는 cutAfter(ms) 뒤에 망이 끊음(오류가 옴), early(초): 이보다 긴 실제 묻기를 일찍 빈 답으로 돌려줌, probeOld: 시험 요청을 모르는 서버(보통 긴 대기로 답함)
 */
function fakeRoom(o = {}) {
  const opt = { waitMax: 0, silentAt: 0, cutAt: 0, cutAfter: 1200, early: 0, probeOld: false, ...o };
  let now = 100; const log = []; const waiters = new Set(); const questions = [];
  const snap = (since) => ({ now, state: { updatedAt: 1 }, questions: questions.filter((q) => q.updatedAt > since), ...(opt.waitMax ? { waitMax: opt.waitMax } : {}) });
  const gone = () => Object.assign(new Error('aborted'), { name: 'AbortError' });
  /** ms 동안 붙잡음. 깨울 수 있는 것(wakeable)은 글이 올라오면 바로 → true */
  const hold = (ms, init, wakeable) => new Promise((r) => {
    const x = { r: () => r(true), t: setTimeout(() => { waiters.delete(x); r(false); }, ms) };
    if (wakeable) waiters.add(x);
    init.signal?.addEventListener('abort', () => { clearTimeout(x.t); waiters.delete(x); r(false); });
  });
  /** 답이 영영 오지 않음(런타임이 그만둘 때까지) */
  const never = (init) => new Promise((_, no) => { if (init.signal?.aborted) no(gone()); else init.signal?.addEventListener('abort', () => no(gone())); });
  const answer = async (u, p, init) => {
    if (p === '/state') return res({ updatedAt: 1 });
    if (p !== '/snapshot') return res({ error: 'not_found' }, { status: 404 });
    const since = Number(u.searchParams.get('since')) || 0; const w = Number(u.searchParams.get('wait')) || 0;
    const probe = u.searchParams.get('probe') === '1' && !opt.probeOld;
    if (w && since > 0 && (probe || !questions.some((q) => q.updatedAt > since))) {
      if (!probe && opt.cutAt && w >= opt.cutAt) { await sleep(opt.cutAfter); throw new TypeError('network cut'); }
      if (!probe && opt.early && w >= opt.early) { await sleep(300); return res(snap(since)); }
      const limit = opt.silentAt && w >= opt.silentAt ? opt.silentAt : 0; const t0 = Date.now();
      const woke = await hold((limit || w) * 1000, init, !probe);
      if (init.signal?.aborted) throw gone();
      if (limit && !woke) return never(init);
      if (probe) return res({ probe: true, held: Date.now() - t0, waitMax: opt.waitMax });
    }
    return res(snap(since));
  };
  const fetch = async (url, init = {}) => {
    const u = new URL(url); const p = u.pathname.replace(/^.*\/api\/[A-Z0-9]+/, '');
    const h = init.headers || {};
    const e = { at: Date.now(), p, wait: Number(u.searchParams.get('wait')) || 0, probe: u.searchParams.get('probe') === '1', admin: !!h['X-Lec-Admin'], headers: Object.keys(h).length > 0, done: false, doneAt: 0 };
    log.push(e);
    try { return await answer(u, p, init); } finally { e.done = true; e.doneAt = Date.now(); }
  };
  const push = (text) => { now += 10; questions.push({ id: 'q' + now, text, createdAt: now, updatedAt: now }); for (const x of [...waiters]) { clearTimeout(x.t); waiters.delete(x); x.r(); } };
  const reals = () => log.filter((x) => x.p === '/snapshot' && x.wait && !x.probe);
  return {
    opt, fetch, log, push, reals, probes: () => log.filter((x) => x.probe),
    /** 실제 묻기의 기다림들 */
    waits: () => reals().map((x) => x.wait), snaps: () => log.filter((x) => x.p === '/snapshot' && !x.probe),
    /** 실제 묻기 하나가 지금 붙잡혀 있는지(기다림 w로) */
    flying: (w) => { const l = reals().at(-1); return !!l && !l.done && (!w || l.wait === w) && Date.now() - l.at > 150; },
  };
}
const poller = (room, extra = {}, win = {}) => {
  const W = makeWindow({ fetch: room.fetch, ...win });
  const c = W.LecLive.create({ provider: 'http', url: 'https://live.example/live', code: 'WAIT1', transports: ['poll'], pollMs: 2000, waitS: 1, waitSteps: [2, 3], ...extra });
  return { W, c };
};

/** 글이 올라온 때부터 이 화면이 받을 때까지(ms). 실제 묻기가 붙잡혀 있는 때를 골라 올림(쉬는 틈에 올리면 전에도 그 틈만큼 걸림) */
async function reaction(room, c, text, w) {
  assert.ok(await until(() => room.flying(w), 12000), `실제 묻기가 붙잡혀 있는 때를 잡음(${text})`);
  const got = new Promise((ok) => { const off = c.on('change:questions', (list) => { if (list.some((q) => q.text === text)) { off && off(); ok(Date.now()); } }); });
  const t0 = Date.now(); room.push(text);
  const at = await Promise.race([got, sleep(4000).then(() => 0)]);
  return at ? at - t0 : Infinity;
}

// 서로 기대지 않는 시험들(방·창이 따로)이라 함께 돌림: 기다리는 시간이 대부분이라 하나씩 돌리면 4분쯤 걸림
describe('긴 대기의 기다림 올리기', { concurrency: true }, () => {
test('긴 대기: 실제 묻기는 확인된 기다림 그대로 두고, 따로 보낸 시험 요청이 제때 온전히 돌아온 뒤에만 올린다. 시험 중에도 올린 뒤에도 바뀐 것은 바로 온다', { timeout: 90000 }, async () => {
  const room = fakeRoom({ waitMax: 3 });
  const { W, c } = poller(room);
  await c.connect();
  // 조용한 긴 대기가 두 번 온전히 돌아온 뒤에 시험 요청 하나(가장 긴 값부터), 머리글 없이
  assert.ok(await until(() => room.probes().length === 1, 20000), '시험 요청이 한 번 감');
  const pr = room.probes()[0];
  assert.equal(pr.wait, 3); assert.equal(pr.headers, false, '시험 요청은 토큰·키 없이');
  const first = room.reals().filter((x) => x.at < pr.at);
  assert.ok(first.length >= 2 && first.every((x) => x.wait === 1), `시험 전의 실제 묻기는 1초씩(${first.map((x) => x.wait)})`);
  assert.equal(c.netInfo().probe, 3); assert.equal(c.netInfo().wait, 1, '시험 중에도 실제 묻기는 확인된 기다림');
  // 시험 중에 올라온 글: 실제 묻기가 그 자리에서 받음(시험 요청은 그대로 붙잡혀 있음)
  const d1 = await reaction(room, c, '시험 중에 온 질문');
  assert.ok(d1 < 700, `시험 중에도 바로 받음(${d1}ms)`);
  assert.equal(pr.done, false, '방에 일이 생겨도 시험 요청은 끝까지 붙잡힘');
  // 시험 요청이 제때 온전히 돌아옴 → 그다음 실제 묻기부터 3초
  assert.ok(await until(() => c.netInfo().wait === 3, 8000), '시험이 통과한 뒤에 올림');
  assert.ok(pr.done && pr.doneAt - pr.at >= 2900, `시험 요청은 3초를 다 채움(${pr.doneAt - pr.at}ms)`);
  assert.ok(room.reals().filter((x) => x.at < pr.doneAt).every((x) => x.wait === 1), '시험이 끝나기 전의 실제 묻기는 모두 1초');
  // 올린 뒤: 3초 기다리는 도중에 올라온 글도 바로
  const d2 = await reaction(room, c, '올린 뒤에 온 질문', 3);
  assert.ok(d2 < 700, `올린 뒤에도 바로 받음(${d2}ms)`);
  // 처음 통과한 값이 끝: 더 시험하지 않고, 탭과 기기에 기억함
  const n = room.reals().length;
  assert.ok(await until(() => room.reals().length >= n + 2, 15000));
  assert.equal(room.probes().length, 1, '시험 요청은 한 번뿐');
  assert.ok(room.reals().slice(n).every((x) => x.wait === 3));
  assert.equal(c.netInfo().transport, 'long'); assert.equal(c.netInfo().left, 0);
  const mem = W.waitMem();
  assert.equal(mem.tab.w, 3); assert.equal(mem.tab.d, 1); assert.equal(mem.device.w, 3);
  c.close();
});

test('긴 대기: 예전 서버(상한을 알려 주지 않음·시험 요청을 모름)에서는 올리지 않는다. 연결 하나를 같이 쓰는 망(h2)·기록이 없는 브라우저·저장소를 못 쓰는 환경에서도', { timeout: 90000 }, async () => {
  // 상한을 알려 주지 않는 예전 서버: 시험 요청을 보내지 않음
  const old = fakeRoom({ waitMax: 0 });
  // 상한은 알려 주지만 시험 요청을 모르는 서버(보통 긴 대기로 답함): 그 답으로는 올리지 않음
  const half = fakeRoom({ waitMax: 3, probeOld: true });
  const h2 = fakeRoom({ waitMax: 3 }); const none = fakeRoom({ waitMax: 3 }); const nost = fakeRoom({ waitMax: 3 });
  const a = poller(old); const b = poller(half); const d = poller(h2, {}, { proto: 'h2' }); const e = poller(none, {}, { proto: null }); const f = poller(nost, {}, { storage: false });
  await Promise.all([a, b, d, e, f].map((x) => x.c.connect()));
  assert.ok(await until(() => half.probes().length === 2 && half.probes().every((x) => x.done), 40000), `시험 요청을 모르는 서버: 큰 값부터 하나씩 해 보고 그만둠(${half.probes().map((x) => x.wait)})`);
  assert.deepEqual(half.probes().map((x) => x.wait), [3, 2]);
  const n = half.reals().length;
  assert.ok(await until(() => half.reals().length >= n + 3 && old.reals().length >= 6 && h2.reals().length >= 6 && none.reals().length >= 6 && nost.reals().length >= 6, 30000));
  for (const [name, r, x] of [['예전 서버', old, a], ['시험 요청을 모르는 서버', half, b], ['h2', h2, d], ['기록 없는 브라우저', none, e], ['저장소 없음', nost, f]]) {
    assert.ok(r.waits().every((w) => w === 1), `${name}: 실제 묻기는 늘 처음 기다림(${r.waits()})`);
    assert.equal(x.c.netInfo().wait, 1); assert.equal(x.c.netInfo().transport, 'long', `${name}: 긴 대기는 그대로`);
  }
  assert.equal(old.probes().length, 0); assert.equal(h2.probes().length, 0, '연결을 같이 쓰는 망에서는 시험이 뜻이 없어 보내지 않음');
  assert.equal(none.probes().length, 0); assert.equal(nost.probes().length, 0);
  assert.equal(half.probes().length, 2, '모두 안 되면 더 시험하지 않음');
  assert.equal(b.W.waitMem().device.w, 1, '올리지 못한 기기로 기억(하루 동안 다시 시험하지 않음)');
  assert.equal(d.W.waitMem().device, null, 'h2는 기기에 적지 않음(다른 망에서는 될 수 있음)');
  [a, b, d, e, f].forEach((x) => x.c.close());
});

test('긴 대기: 조용히 끊는 망(답 없이 끊음)에서는 시험 요청만 돌아오지 않고, 실제 묻기는 한 번도 늦지 않는다. 올리지 않고 그 기기에 하루 기억한다', { timeout: 120000 }, async () => {
  // 2초 넘게 붙잡힌 요청은 답이 영영 오지 않는 망. 실제 묻기(1초)는 잘 됨
  const room = fakeRoom({ waitMax: 3, silentAt: 2 });
  const { W, c } = poller(room);
  const statuses = []; c.on('status', (s) => statuses.push(s));
  await c.connect();
  const lag = [];
  assert.ok(await until(() => room.probes().length === 1, 20000));
  lag.push(await reaction(room, c, '첫 시험 중 1')); await sleep(2500); lag.push(await reaction(room, c, '첫 시험 중 2'));
  // 첫 시험(3초)은 돌아오지 않음 → 그 값은 버리고, 다시 조용해지면 다음 값(2초)을 시험
  assert.ok(await until(() => room.probes().length === 2, 40000), '다음 값을 시험');
  assert.deepEqual(room.probes().map((x) => x.wait), [3, 2]);
  lag.push(await reaction(room, c, '둘째 시험 중'));
  assert.ok(await until(() => c.netInfo().left === 0 && !c.netInfo().probe, 30000), '시험을 마침');
  lag.push(await reaction(room, c, '시험을 마친 뒤'));
  assert.ok(lag.every((x) => x < 700), `바뀐 것은 늘 바로 옴(${lag}ms)`);
  assert.ok(room.waits().every((w) => w === 1), `실제 묻기는 한 번도 긴 기다림으로 가지 않음(${room.waits()})`);
  assert.equal(c.netInfo().wait, 1); assert.equal(c.netInfo().transport, 'long', '긴 대기는 그대로(간격 묻기로 내려가지 않음)');
  assert.ok(!statuses.includes('offline'), '끊김으로 보이지 않음');
  assert.equal(W.waitMem().device.w, 1);
  c.close();
  // 같은 기기의 새 탭: 하루 동안 다시 시험하지 않음
  const again = poller(room, {}, { local: W.localStorage.dump() });
  let n = room.reals().length; await again.c.connect();
  assert.ok(await until(() => room.reals().length >= n + 4, 30000));
  assert.equal(room.probes().length, 2, '새 탭에서도 다시 시험하지 않음');
  again.c.close();
  // 하루가 지나면 다시 시험
  const later = poller(room, {}, { local: W.localStorage.dump(), clock: { skew: 25 * 3600e3 } });
  n = room.reals().length; await later.c.connect();
  assert.ok(await until(() => room.probes().length === 3, 30000), '하루 뒤에는 다시 시험');
  later.c.close();
});

test('긴 대기: 올린 기다림의 실제 묻기가 끊기면 바로 처음 기다림으로 돌아가 쉬는 틈 없이 다시 묻고, 다시 시험한다. 두 번 끊기면 그 기기에서 하루 동안 올리지 않는다', { timeout: 120000 }, async () => {
  const room = fakeRoom({ waitMax: 3 });
  const { W, c } = poller(room);
  const statuses = []; c.on('status', (s) => statuses.push(s));
  await c.connect();
  assert.ok(await until(() => c.netInfo().wait === 3, 30000), '시험이 통과해 3초로 올림');
  // 이제부터 3초 묻기를 망이 1.2초 뒤에 끊음(오류가 옴)
  room.opt.cutAt = 3;
  assert.ok(await until(() => room.reals().some((x) => x.wait === 3 && x.done && x.at > Date.now() - 20000 && room.reals().indexOf(x) < room.reals().length - 1 && room.opt.cutAt), 15000));
  const cut = room.reals().filter((x) => x.wait === 3).at(-1); const next = room.reals()[room.reals().indexOf(cut) + 1];
  assert.equal(next.wait, 1, '끊기면 바로 처음 기다림으로');
  assert.ok(next.at - cut.at < 2300, `쉬는 틈 없이 바로 다시 물음(${next.at - cut.at}ms — 틈을 두면 2900ms 이상)`);
  assert.equal(c.netInfo().wait, 1); assert.equal(c.netInfo().transport, 'long', '간격 묻기로 내려가지 않음');
  assert.ok(!statuses.includes('offline'), '끊김으로 보이지 않음');
  assert.equal(W.waitMem().device.c, 1);
  // 한 번은 다시 시험함(시험 요청은 잘 돌아옴) → 다시 3초
  room.opt.cutAt = 0;
  assert.ok(await until(() => room.probes().length === 2 && c.netInfo().wait === 3, 30000), '다시 시험해 통과하면 다시 올림');
  // 이번에는 3초 묻기가 일찍 빈 답으로 돌아옴(프록시가 대신 답함) → 두 번째: 이 기기에서는 더 올리지 않음
  room.opt.early = 3;
  assert.ok(await until(() => c.netInfo().wait === 1 && c.netInfo().left === 0, 15000));
  room.opt.early = 0;
  const n = room.reals().length;
  assert.ok(await until(() => room.reals().length >= n + 4, 30000));
  assert.ok(room.reals().slice(n).every((x) => x.wait === 1)); assert.equal(room.probes().length, 2, '더 시험하지 않음');
  assert.equal(c.netInfo().transport, 'long');
  const mem = W.waitMem();
  assert.equal(mem.device.w, 1); assert.equal(mem.device.c, 2);
  c.close();
});

test('긴 대기: 확인된 값은 쪽을 옮기거나 새로 고쳐도 다시 시험하지 않고 이어 쓴다. 새 탭은 그 값 하나만 다시 시험하고, 망이 바뀌었을 수 있으면 버리고 다시 시험한다', { timeout: 150000 }, async () => {
  const room = fakeRoom({ waitMax: 3 });
  const one = poller(room);
  await one.c.connect();
  assert.ok(await until(() => one.c.netInfo().wait === 3 && room.reals().some((x) => x.wait === 3 && x.done), 30000));
  const session = one.W.sessionStorage.dump(); const local = one.W.localStorage.dump();
  one.c.close();
  // ① 같은 탭의 다음 쪽·새로 고침: 첫 긴 대기부터 3초, 시험 요청 없음
  let n = room.reals().length; let p = room.probes().length;
  const two = poller(room, {}, { session, local });
  const st = []; two.c.on('status', (s) => st.push(s));
  await two.c.connect();
  assert.ok(await until(() => room.reals().length >= n + 2, 15000));
  assert.ok(room.reals().slice(n).every((x) => x.wait === 3), `다음 쪽은 확인된 기다림에서 이어감(${room.reals().slice(n).map((x) => x.wait)})`);
  assert.equal(room.probes().length, p, '쪽을 옮겨도 다시 시험하지 않음');
  // ② 망이 다시 붙음(online 사건: 망이 바뀌었을 수 있음) → 3초로 보내 둔 묻기를 그만두고 바로 1초로, 다시 시험
  assert.ok(await until(() => room.flying(3), 12000));
  n = room.reals().length; const t0 = Date.now(); two.W.fire('online');
  assert.ok(await until(() => room.reals().length > n, 3000));
  assert.equal(room.reals()[n].wait, 1); assert.ok(room.reals()[n].at - t0 < 1000, `확인을 버리면 바로 처음 기다림으로 다시 물음(${room.reals()[n].at - t0}ms)`);
  assert.equal(two.c.netInfo().transport, 'long'); assert.ok(!st.includes('offline'), '끊김으로 보이지 않음');
  assert.ok(await until(() => room.probes().length === p + 1 && two.c.netInfo().wait === 3, 30000), '다시 시험해 통과하면 다시 올림');
  assert.equal(room.probes().at(-1).wait, 3);
  // ③ 1분 넘게 가려졌다 다시 보임(그 사이 망이 바뀌었을 수 있음) → 버리고 다시 시험. 잠깐 가려진 것은 그대로
  p = room.probes().length;
  two.W.document.show(false); await sleep(300); two.W.document.show(true); await sleep(300);
  assert.equal(two.c.netInfo().wait, 3, '잠깐 가려진 것은 그대로');
  two.W.document.show(false); await sleep(200); two.W.clock.skew += 61000; two.W.document.show(true);
  assert.ok(await until(() => two.c.netInfo().wait === 1, 3000), '1분 넘게 가려졌다 돌아오면 처음 기다림으로');
  assert.ok(await until(() => room.probes().length === p + 1 && two.c.netInfo().wait === 3, 40000));
  two.c.close();
  // ④ 같은 기기의 새 탭(기기 기억만 있음): 1초로 시작해 기억한 값 하나만 시험한 뒤 올림
  n = room.reals().length; p = room.probes().length;
  const three = poller(room, {}, { local: two.W.localStorage.dump() });
  await three.c.connect();
  assert.ok(await until(() => three.c.netInfo().wait === 3, 30000));
  assert.equal(room.probes().length, p + 1); assert.equal(room.probes().at(-1).wait, 3);
  assert.ok(room.reals().slice(n).filter((x) => x.at < room.probes().at(-1).doneAt).every((x) => x.wait === 1), '시험이 끝나기 전에는 1초');
  // ⑤ 2분 넘게 묻지 않은 탭(오래 두었다 돌아온 쪽): 기억한 값을 바로 쓰지 않고 다시 시험
  const stale = three.W.sessionStorage.dump();
  for (const k of Object.keys(stale)) if (/:wait$/.test(k)) stale[k] = JSON.stringify({ ...JSON.parse(stale[k]), t: Date.now() - 130000 });
  three.c.close();
  n = room.reals().length; p = room.probes().length;
  const four = poller(room, {}, { session: stale, local: three.W.localStorage.dump() });
  await four.c.connect();
  assert.ok(await until(() => room.reals().length >= n + 2, 15000));
  assert.ok(room.reals().slice(n, n + 2).every((x) => x.wait === 1), '오래된 기억은 바로 쓰지 않음');
  assert.ok(await until(() => room.probes().length === p + 1, 20000));
  four.c.close();
});

test('긴 대기: 가려진 동안 끝난 시험은 믿지 않고, 다시 조용해지면 그 값을 다시 시험한다', { timeout: 90000 }, async () => {
  const room = fakeRoom({ waitMax: 3 });
  const { W, c } = poller(room);
  await c.connect();
  assert.ok(await until(() => room.probes().length === 1, 20000));
  W.document.show(false);
  assert.ok(await until(() => room.probes()[0].done, 8000));
  await sleep(400);
  W.document.show(true);
  try {
    assert.equal(c.netInfo().wait, 1, '가려진 동안 끝난 시험으로는 올리지 않음');
    assert.ok(await until(() => room.probes().length === 2 && c.netInfo().wait === 3, 40000), '다시 보이고 조용해지면 그 값을 다시 시험');
    assert.equal(room.probes()[1].wait, 3);
  } finally { c.close(); }
});
});

test('가려진 화면: 참가자는 묻기를 쉬고(5분에 한 번), 다시 보이면 바로 한 번 묻는다. 강사 화면은 가려져도 지금처럼 이어 간다', { timeout: 40000 }, async () => {
  const room = fakeRoom({ waitMax: 0 });
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
  const room2 = fakeRoom({ waitMax: 0 });
  const { W: W3, c: c3 } = poller(room2);
  c3.setAdminKey('강사-키-시험-0001');
  await c3.connect();
  W3.document.show(false);
  assert.ok(await until(() => c3.netInfo().every >= 20000, 12000));
  assert.ok(c3.netInfo().every <= 45000, `강사 화면은 30초쯤(${c3.netInfo().every}ms)`);
  c3.close();
  // 발표 화면처럼 restHidden을 켜지 않은 화면(관리자 키 없이 연 것 포함): 가려져도 전처럼 1분 간격
  const room3 = fakeRoom({ waitMax: 0 });
  const { W: W4, c: c4 } = poller(room3);
  await c4.connect();
  W4.document.show(false);
  assert.ok(await until(() => c4.netInfo().every >= 45000, 12000));
  assert.ok(c4.netInfo().every <= 75000, `켜지 않은 화면은 전처럼 1분쯤(${c4.netInfo().every}ms)`);
  c4.close();
});

// ── 웹소켓으로 동기화 ─────────────────────────────────────────────
/** 가짜 WebSocket: 열리면 hello(caps)를 보내고, 받은 메시지를 기록. sync 요청에는 reply가 답함(없으면 답하지 않음) */
function fakeWsClass({ caps, reply } = {}) {
  const socks = [];
  class FakeWS {
    constructor(url) {
      this.url = url; this.readyState = 0; this.sent = []; socks.push(this);
      setTimeout(() => { this.readyState = 1; this.onopen?.(); this.onmessage?.({ data: JSON.stringify({ type: 'hello', now: Date.now(), mode: 'ws', protocol: 1, ...(caps ? { caps } : {}) }) }); }, 5);
    }
    send(m) {
      this.sent.push(m);
      if (m === 'ping') return void setTimeout(() => this.onmessage?.({ data: 'pong' }), 1);
      let o; try { o = JSON.parse(m); } catch { return; }
      if (o.type === 'sync' && reply) { const r = reply(o); if (r) setTimeout(() => this.onmessage?.({ data: JSON.stringify({ type: 'sync', id: o.id, ...r }) }), 5); }
    }
    close() { this.readyState = 3; this.onclose?.(); }
  }
  return { FakeWS, socks, syncs: () => socks.flatMap((s) => s.sent).filter((m) => /"type":"sync"/.test(m)).map((m) => JSON.parse(m)) };
}
const snapDoc = (since) => ({ now: 500, since, full: since === 0, state: { updatedAt: 0, slide: 3 }, questions: since ? [] : [{ id: 'q1', text: '소켓으로 온 질문', createdAt: 400, updatedAt: 400 }], removed: [] });
function httpRoom() {
  const log = [];
  const fetch = async (url) => { const u = new URL(url); const p = u.pathname.replace(/^.*\/api\/[A-Z0-9]+/, ''); log.push(p); if (p === '/state') return res({ updatedAt: 0, slide: 3 }); if (p === '/snapshot') return res(snapDoc(Number(u.searchParams.get('since')) || 0)); return res({ error: 'not_found' }, { status: 404 }); };
  return { fetch, log };
}
const wsClient = (W) => W.LecLive.create({ provider: 'http', url: 'https://live.example/live', code: 'SYNC1' });

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
  const { waitMax, now: n1, ...h } = viaHttp; const { now: n2, ...s } = r.doc;
  assert.equal(waitMax, 55, 'HTTP 답에는 긴 대기 상한');
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

test('서버: 긴 대기는 청한 만큼만 붙잡고(예전 런타임의 값은 그대로), 바뀌면 바로 답한다', { timeout: 30000 }, async () => {
  const A = api(srv.url, 'SYNCB');
  await A.call('PUT', '/state', { admin: ADMIN, body: { slide: 1 } });
  const me = (await A.call('POST', '/join', { body: { nickname: '가을' } })).body;
  const cur = (await A.call('GET', '/snapshot?since=0')).body.now;
  let t0 = Date.now();
  const held = await A.call('GET', `/snapshot?since=${cur}&wait=2`);
  assert.ok(Date.now() - t0 >= 1800 && Date.now() - t0 < 4000, `2초를 청하면 2초(${Date.now() - t0}ms)`);
  assert.equal(held.body.waitMax, 55);
  t0 = Date.now();
  const p = A.call('GET', `/snapshot?since=${held.body.now}&wait=50`);
  await sleep(400); await A.call('POST', '/questions', { token: me.token, body: { text: '기다리는 중에 올린 질문' } });
  const woke = await p;
  assert.ok(Date.now() - t0 < 2500, `50초를 청해도 바뀌면 바로(${Date.now() - t0}ms)`);
  assert.equal(woke.body.questions.length, 1);
  // 시험 요청(probe=1): 방에 글이 올라와도 청한 시간을 다 채우고 자료 없이 답함. 토큰 없이 보내도 됨
  t0 = Date.now();
  const pr = A.call('GET', `/snapshot?since=${woke.body.now}&wait=2&probe=1&n=1`);
  await sleep(300); await A.call('POST', '/questions', { token: me.token, body: { text: '시험 요청 중에 올린 질문' } });
  const probed = await pr;
  assert.ok(Date.now() - t0 >= 1900 && Date.now() - t0 < 4000, `시험 요청은 끝까지 붙잡음(${Date.now() - t0}ms)`);
  assert.deepEqual(Object.keys(probed.body).sort(), ['held', 'probe', 'waitMax'], '자료를 싣지 않음');
  assert.equal(probed.body.probe, true); assert.ok(probed.body.held >= 1900); assert.equal(probed.body.waitMax, 55);
  // 런타임이 답을 실어 온 프로토콜을 볼 수 있게(다른 출처의 사이트에서도)
  assert.equal(probed.headers.get('timing-allow-origin'), '*'); assert.equal(woke.headers.get('timing-allow-origin'), '*');
  // 시험 요청이 붙잡혀 있어도 보통 긴 대기는 전처럼 바뀌면 바로 답함
  const cur2 = (await A.call('GET', '/snapshot?since=0')).body.now;
  const pr2 = A.call('GET', `/snapshot?since=${cur2}&wait=3&probe=1&n=2`);
  t0 = Date.now();
  const lp = A.call('GET', `/snapshot?since=${cur2}&wait=20`);
  await sleep(300); await A.call('POST', '/questions', { token: me.token, body: { text: '둘이 같이 기다리는 중' } });
  assert.equal((await lp).body.questions.length, 1); assert.ok(Date.now() - t0 < 2000);
  assert.equal((await pr2).body.probe, true);
});
