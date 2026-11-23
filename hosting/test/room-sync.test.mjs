// 방(Room)에 더한 것(2026-11-24): 소켓으로 받는 동기화(LiveRoom.wsSync)도 HTTP 요청과 같은 문을 지남(묶임·가림·방 요청 상한),
// 방이 쓴 행 수를 Gate에 알림(무료 하루 10만 행. 방은 곧 잠들어 쌓아 둘 수 없으므로 300행 단위로 어림),
// 긴 대기를 Worker가 대신 기다릴 때(relayWait) 끝까지 붙잡았다 보내는 답의 now는 보내는 때의 시각(런타임이 이 값으로 시계를 맞춤).
// Durable Object는 흉내(test/fake-do.mjs), 규칙은 실제 코드.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fakeCtx, fakeNamespace } from './fake-do.mjs';

const { Room, MAX_WAIT_S, ROWS_UNIT } = await import('../src/room.js');
const { relayWait, NOW_WAIT_MS } = await import('../../skills/lecpage/backends/cloudflare/src/longpoll.js');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const KEY = '강사키-2027-봄-연수'; const SITE = 'abcdefghjk'; const day = 86400000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeRoom() {
  const ctx = fakeCtx();
  // 방의 저장소가 쓴 행 수(실제 Durable Object의 cursor.rowsWritten 흉내): 쓰는 문장마다 SQLite가 바꾼 행 수. written: 그 합
  const rawExec = ctx.sql.exec.bind(ctx.sql); const counted = { written: 0 };
  ctx.sql.exec = (q, ...p) => {
    const cur = rawExec(q, ...p);
    cur.rowsWritten = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(q) ? Number(rawExec('SELECT changes() AS n').toArray()[0].n) || 0 : 0;
    counted.written += cur.rowsWritten;
    return cur;
  };
  // 방에 붙은 소켓(긴 대기를 Worker가 대신 기다릴 때 방이 건네는 소켓)을 꼬리표와 함께 기억
  ctx.acceptWebSocket = (ws, tags = []) => { ws.tags = tags; ctx.sockets.push(ws); };
  ctx.getWebSockets = (tag) => ctx.sockets.filter((ws) => !ws.closed && (!tag || (ws.tags || []).includes(tag)));
  const SITE_NS = fakeNamespace(() => ({ alive: false }));
  const GATE_NS = fakeNamespace(() => ({ ok: true, total: 0 }));
  const room = new Room(ctx, { ADMIN_KEY: 'operator-admin-key-0001', SITE: SITE_NS, GATE: GATE_NS });
  const call = async (method, path, { json, token, admin } = {}) => {
    const h = { 'cf-connecting-ip': '203.0.113.9' };
    if (token) h['x-lec-token'] = token;
    if (admin) h['x-lec-admin'] = encodeURIComponent(admin);
    let body;
    if (json !== undefined) { body = JSON.stringify(json); h['content-type'] = 'application/json'; h['content-length'] = String(new TextEncoder().encode(body).length); }
    const res = await room.fetch(new Request(`https://sites.example${path}`, { method, headers: h, body }));
    let parsed = null; try { parsed = await res.json(); } catch { /* 없음 */ }
    return { status: res.status, body: parsed };
  };
  const bind = (over = {}) => call('POST', '/host/bind', { json: { site: SITE, code: 'AB12CD', adminKeyHash: sha(KEY), expires: Date.now() + 30 * day, ...over } });
  /** 방에 붙은 소켓 흉내: 방이 보낸 것을 모음 */
  const socket = (att = { admin: false, code: 'AB12CD', ip: '203.0.113.9', origin: 'https://sites.example' }) => {
    const sent = [];
    return { sent, deserializeAttachment: () => att, serializeAttachment(a) { att = a; }, send: (m) => sent.push(JSON.parse(m)), close() {} };
  };
  const sync = async (ws, o) => { await room.webSocketMessage(ws, JSON.stringify({ type: 'sync', ...o })); return ws.sent[ws.sent.length - 1]; };
  /**
   * Worker가 대신 기다리는 긴 대기(relayWait)를 Node에서 돌림: 방이 만드는 소켓 쌍(WebSocketPair)과 101 답을 흉내 냄.
   * Worker 쪽 끝의 send → 방의 webSocketMessage, 방 쪽 끝의 send·close → Worker 쪽의 message·close(받기 시작한 뒤에 차례로)
   */
  const asked = []; // Worker가 소켓으로 방에 보낸 메시지
  const relay = async (path, { token } = {}) => {
    const RealResponse = globalThis.Response; const hadPair = globalThis.WebSocketPair;
    class Response101 extends RealResponse {
      constructor(body, init) {
        if (init && init.status === 101) { super(null, { headers: init.headers }); Object.defineProperty(this, 'status', { value: 101 }); this.webSocket = init.webSocket; } else super(body, init);
      }
    }
    globalThis.WebSocketPair = class {
      constructor() {
        const on = {}; const queue = []; let accepted = false; let att = null;
        const flush = () => { if (!accepted) return; while (queue.length) { const [n, ev] = queue.shift(); (on[n] || []).forEach((f) => f(ev)); } };
        const push = (n, ev) => { queue.push([n, ev]); setTimeout(flush, 0); };
        const server = {
          closed: false, serializeAttachment(a) { att = a; }, deserializeAttachment: () => att,
          send(m) { if (server.closed) throw new Error('closed'); push('message', { data: m }); },
          close() { if (server.closed) return; server.closed = true; push('close', {}); },
        };
        const client = {
          accept() { accepted = true; setTimeout(flush, 0); }, addEventListener: (n, f) => { (on[n] ||= []).push(f); },
          send(m) { if (server.closed) throw new Error('closed'); asked.push(m); Promise.resolve().then(() => room.webSocketMessage(server, m)); },
          close() { server.closed = true; },
        };
        this[0] = client; this[1] = server;
      }
    };
    globalThis.Response = Response101;
    try {
      const h = { 'cf-connecting-ip': '203.0.113.9' }; if (token) h['x-lec-token'] = token;
      const url = `https://sites.example${path}`;
      const res = await relayWait({ fetch: (req) => room.fetch(req) }, new Request(url, { headers: h }), Number(new URL(url).searchParams.get('wait')));
      return { status: res.status, body: await res.json() };
    } finally { globalThis.Response = RealResponse; if (hadPair === undefined) delete globalThis.WebSocketPair; else globalThis.WebSocketPair = hadPair; }
  };
  return { room, call, bind, socket, sync, relay, asked, counted, GATE_NS };
}

test('소켓 동기화: 묶인 방에서만, 참가자에게 GET snapshot이 주는 것과 같게. 가려지거나 방 요청 상한이 차면 HTTP 때와 같은 오류', async () => {
  const { room, call, bind, socket, sync } = makeRoom();
  const ws = socket();
  // 묶이지 않은 방
  const none = await sync(ws, { id: '1', since: 0 });
  assert.equal(none.ok, false); assert.equal(none.error, 'unknown_training'); assert.equal(none.status, 404);
  assert.equal((await bind()).status, 200);
  const j = await call('POST', '/api/AB12CD/join', { json: { nickname: '봄날' } });
  await call('POST', '/api/AB12CD/questions', { json: { text: '쉬는 시간은 언제인가요?' }, token: j.body.token });
  const ok = await sync(ws, { id: '2', since: 0, token: j.body.token });
  assert.equal(ok.type, 'sync'); assert.equal(ok.id, '2'); assert.equal(ok.ok, true);
  const http = (await call('GET', '/api/AB12CD/snapshot?since=0', { token: j.body.token })).body;
  assert.equal(MAX_WAIT_S, 25, '긴 대기 상한은 전과 같음'); assert.equal(http.waitMax, undefined);
  const { now: n1, ...h } = http; const { now: n2, ...s } = ok.doc;
  assert.deepEqual(s, h, '소켓으로 받은 것 = HTTP로 받은 것');
  assert.equal(ok.doc.questions.length, 1); assert.equal(ok.doc.me.id, j.body.id);
  assert.ok(!ok.doc.participants || !ok.doc.participants.length, '참가자 명단은 주지 않음');
  // 방 요청 상한: 소켓 동기화도 셈, 차면 429 room_busy
  const hit = room.hostBudget.hit.bind(room.hostBudget);
  let counted = 0; let full = false;
  room.hostBudget.hit = (o) => { counted++; return full ? 30 : hit(o); };
  assert.equal((await sync(ws, { id: '3', since: ok.doc.now })).ok, true); assert.equal(counted, 1, '소켓 동기화도 방 요청으로 셈');
  full = true;
  const busy = await sync(ws, { id: '4', since: ok.doc.now });
  assert.equal(busy.ok, false); assert.equal(busy.error, 'room_busy'); assert.equal(busy.status, 429); assert.equal(busy.retryAfter, 30);
  full = false;
  // 가려진 방
  await call('POST', '/host/touch', { json: { site: SITE, expires: Date.now() + day, blocked: true } });
  const hidden = await sync(socket(), { id: '5', since: 0 });
  assert.equal(hidden.ok, false); assert.equal(hidden.error, 'blocked'); assert.equal(hidden.status, 403);
  // 긴 대기를 기다리는 소켓(Worker가 붙잡은 것)에는 답하지 않음
  await call('POST', '/host/touch', { json: { site: SITE, expires: Date.now() + day, blocked: false } });
  const relay = socket({ admin: false, wait: true });
  await room.webSocketMessage(relay, JSON.stringify({ type: 'sync', id: '6', since: 0 }));
  assert.equal(relay.sent.length, 0);
});

test('긴 대기를 Worker가 대신 기다릴 때(relayWait): 끝까지 붙잡았다 보내는 답의 now는 보내는 때의 시각이고, 그 now를 다음 물음의 기준으로 써도 놓치는 것이 없다', { timeout: 30000 }, async (t) => {
  const { room, call, bind, relay, asked } = makeRoom();
  assert.equal((await bind()).status, 200);
  const j = await call('POST', '/api/AB12CD/join', { json: { nickname: '봄날' } });
  const tok = j.body.token;
  const ask = (text) => call('POST', '/api/AB12CD/questions', { json: { text }, token: tok });
  const cur = (await call('GET', '/api/AB12CD/snapshot?since=0', { token: tok })).body.now;
  // ① 조용한 방: 1초를 다 기다린 답. 그 답은 기다리기 시작할 때 만든 것이지만 now는 보내는 때(런타임이 이 값으로 시계를 맞춤 — 전에는 기다린 만큼 뒤처짐)
  let t0 = Date.now();
  const quiet = await relay(`/api/AB12CD/snapshot?since=${cur}&wait=1`, { token: tok });
  const lag = Date.now() - quiet.body.now;
  assert.equal(quiet.status, 200); assert.ok(Date.now() - t0 >= 950, '끝까지 기다림');
  assert.ok(lag >= 0 && lag < 300, `붙잡았다 보낸 답의 now는 보낸 때(${lag}ms 전 — 기다리기 시작한 때면 1000ms 전)`);
  assert.equal(quiet.body.questions.length, 0); assert.equal(quiet.body.me.id, j.body.id);
  assert.deepEqual(asked, ['n'], '방에는 소켓 메시지 하나로 물음(요청을 더 보내지 않음)');
  // ② 그 now를 기준으로 다시 물음: 그 뒤에 올라온 글을 바로 받음
  t0 = Date.now();
  const p2 = relay(`/api/AB12CD/snapshot?since=${quiet.body.now}&wait=5`, { token: tok });
  await sleep(150); await ask('기다리는 중에 올린 질문');
  const woke = await p2;
  assert.ok(Date.now() - t0 < 1500, `바뀌면 바로(${Date.now() - t0}ms)`); assert.equal(woke.body.questions.length, 1);
  // ③ 기다리는 소켓을 깨우지 못한 쓰기(깨우는 알림 없이 적힌 글): 방이 '바뀜'으로 답해 Worker가 다시 묻고, 그 글이 답에 실림(now만 앞서 가서 놓치는 일이 없음)
  const wake = room.wake; room.wake = () => { };
  const p3 = relay(`/api/AB12CD/snapshot?since=${woke.body.now}&wait=1`, { token: tok });
  await sleep(150); await ask('깨우지 못한 글');
  room.wake = wake;
  const late = await p3;
  assert.deepEqual(late.body.questions.map((q) => q.text), ['깨우지 못한 글']);
  // ④ 방이 시각을 알려 주지 않음(배포 중의 예전 방): 조금 기다린 뒤 처음 만든 답을 그대로 보냄(전과 같은 답 — 기준으로는 안전)
  const now0 = room.relayNow; room.relayNow = async () => { };
  t0 = Date.now();
  const old = await relay(`/api/AB12CD/snapshot?since=${late.body.now}&wait=1`, { token: tok });
  room.relayNow = now0;
  assert.ok(Date.now() - t0 >= 950 + NOW_WAIT_MS - 100 && Date.now() - t0 < 950 + NOW_WAIT_MS + 1500, `시각을 ${NOW_WAIT_MS}ms 기다린 뒤 답함(${Date.now() - t0}ms)`);
  assert.ok(old.body.now >= late.body.now && old.body.now < t0 + 300, '처음 만든 답 그대로');
  assert.equal(old.body.questions.length, 0);
  // 보통 소켓(참가자의 실시간 소켓)이 보낸 'n'에는 답하지 않음
  const plain = { sent: [], deserializeAttachment: () => ({ admin: false, code: 'AB12CD' }), send(m) { this.sent.push(m); }, close() { } };
  await room.webSocketMessage(plain, 'n');
  assert.equal(plain.sent.length, 0);
  t.diagnostic(`붙잡았다 보낸 답의 now: 보낸 때보다 ${lag}ms 전(전에는 기다린 시간만큼 — 20초 기다림이면 20초 — 전)`);
});

test('방이 쓴 행 수: 방의 저장소가 실제로 쓴 행을 세고(글·출석·참여), 요청이 끝날 때 Gate에 알린다. 읽기만 한 요청은 세지 않는다', async () => {
  const { room, call, bind, counted, GATE_NS } = makeRoom();
  assert.equal((await bind()).status, 200);
  const rows = () => GATE_NS.calls.filter((c) => c.path === '/site' && c.body && c.body.rw);
  const settle = () => new Promise((r) => setTimeout(r, 30)); // 알림은 답을 보낸 뒤에 감(waitUntil)
  room.rowsRand = () => 0; // 나머지가 있으면 늘 한 단위로(알림이 가는지 보려고)
  await call('GET', '/api/AB12CD/snapshot?since=0'); await settle();
  GATE_NS.calls.length = 0;
  // 읽기만: 쓴 행이 없음
  let seen = room.rowsWritten; let all = counted.written;
  await call('GET', '/api/AB12CD/snapshot?since=0'); await call('GET', '/api/AB12CD/state'); await settle();
  assert.equal(room.rowsWritten, seen, '읽기는 쓴 행으로 세지 않음'); assert.equal(rows().length, 0);
  // 참여 + 질문 셋 + 출석: 저장소가 쓴 행(문장마다 SQLite가 바꾼 행 수)을 그대로 셈
  const j = await call('POST', '/api/AB12CD/join', { json: { nickname: '봄날' } });
  for (const text of ['첫 질문', '둘째 질문', '셋째 질문']) await call('POST', '/api/AB12CD/questions', { json: { text }, token: j.body.token });
  await call('POST', '/api/AB12CD/attendance', { json: { kind: 'in' }, token: j.body.token });
  await settle();
  const wrote = room.rowsWritten - seen;
  assert.ok(wrote >= 5, `참가자 하나·질문 셋·출석 하나 → 적어도 5행(${wrote}행)`);
  assert.equal(wrote, counted.written - all, `방이 센 행 = 저장소가 쓴 행(${wrote} · ${counted.written - all})`);
  assert.ok(rows().length >= 1 && rows().every((c) => c.body.id === SITE && c.body.rw === ROWS_UNIT), `쓴 요청 뒤에 Gate에 알림(${rows().length}번)`);
  assert.equal(room.rowsSeen, room.rowsWritten, '알린 행은 다시 알리지 않음');
});

test('방이 쓴 행 수: 요청이 끝날 때 그 사이 쓴 행을 300행 단위로 어림해 Gate에 알린다(POST site { id, rw }). 방이 잠들어 기억이 지워져도 덜 세지 않는다', async () => {
  const { room, call, bind, GATE_NS } = makeRoom();
  assert.equal((await bind()).status, 200);
  assert.equal(ROWS_UNIT, 300);
  const rows = () => GATE_NS.calls.filter((c) => c.path === '/site' && c.body && c.body.rw);
  const settle = () => new Promise((r) => setTimeout(r, 30)); // 알림은 답을 보낸 뒤에 감(waitUntil)
  const sum = () => rows().reduce((a, c) => a + c.body.rw, 0);
  room.rowsSeen = room.rowsWritten; // 묶을 때 쓴 행은 빼고 봄
  let dice = 0.99; room.rowsRand = () => dice;
  room.rowsWritten += 120; // 방의 저장소가 쓴 행(LiveRoom이 셈)
  await call('GET', '/api/AB12CD/snapshot'); await settle();
  assert.equal(rows().length, 0, '120행: 0.4의 확률 — 이번에는 알리지 않음(Gate 요청은 300행에 하나꼴)');
  await call('GET', '/api/AB12CD/snapshot'); await settle();
  assert.equal(rows().length, 0, '이미 본 행은 다시 보지 않음');
  dice = 0.39; room.rowsWritten += 120;
  await call('GET', '/api/AB12CD/snapshot'); await settle();
  assert.equal(rows().length, 1); assert.deepEqual(rows()[0].body, { id: SITE, rw: 300 }, '0.4의 확률에 들면 한 단위(300행)');
  // 한 번에 많이 쓴 요청: 300행이 넘는 몫은 그대로
  dice = 0.99; room.rowsWritten += 750;
  await call('GET', '/api/AB12CD/snapshot'); await settle();
  assert.equal(rows().length, 2); assert.equal(rows()[1].body.rw, 600);
  // 기댓값 = 실제 쓴 행: 방이 요청마다 잠들었다 깨어도(기억이 지워져도) 덜 세지 않음. 4행씩 3,000번(12,000행), 고르게 퍼진 수열로 굴림
  GATE_NS.calls.length = 0; let k = 0;
  room.rowsRand = () => (++k * 0.618033988749895) % 1;
  for (let i = 0; i < 3000; i++) { room.rowsWritten = 4; room.rowsSeen = 0; room.rowsDue({ site: SITE }); }
  await settle();
  assert.ok(Math.abs(sum() - 12000) <= 900, `어림한 합 ${sum()}행(실제 12000행)`);
  assert.ok(rows().length >= 37 && rows().length <= 43, `Gate 요청은 300행에 하나꼴(${rows().length}번)`);
  // 실제 난수로도 한쪽으로 쏠리지 않음: 12만 행 → ±25%(표준편차 5%의 다섯 배) 안
  GATE_NS.calls.length = 0; room.rowsRand = null;
  for (let i = 0; i < 30000; i++) { room.rowsWritten = 4; room.rowsSeen = 0; room.rowsDue({ site: SITE }); }
  await settle();
  assert.ok(Math.abs(sum() - 120000) <= 30000, `난수로 어림한 합 ${sum()}행(실제 120000행)`);
});
