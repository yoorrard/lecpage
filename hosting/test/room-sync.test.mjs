// 방(Room)에 더한 것(2026-11-24): 소켓으로 받는 동기화(LiveRoom.wsSync)도 HTTP 요청과 같은 문을 지남(묶임·가림·방 요청 상한),
// 방이 쓴 행 수를 Gate에 알림(무료 하루 10만 행. 방은 곧 잠들어 쌓아 둘 수 없으므로 300행 단위로 어림), 긴 대기 상한을 답에 실음. Durable Object는 흉내(test/fake-do.mjs), 규칙은 실제 코드.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fakeCtx, fakeNamespace } from './fake-do.mjs';

const { Room, MAX_WAIT_S, ROWS_UNIT } = await import('../src/room.js');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const KEY = '강사키-2027-봄-연수'; const SITE = 'abcdefghjk'; const day = 86400000;

function makeRoom() {
  const ctx = fakeCtx();
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
  return { room, call, bind, socket, sync, GATE_NS };
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
  assert.equal(http.waitMax, MAX_WAIT_S, 'HTTP 답에는 긴 대기 상한(초)'); assert.equal(MAX_WAIT_S, 55);
  const { waitMax, now: n1, ...h } = http; const { now: n2, ...s } = ok.doc;
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

test('시험 요청(snapshot?…&probe=1): 방에 글이 올라와도 청한 시간을 다 채우고 자료 없이 답한다. Worker가 대신 기다릴 때는 방에 묻지 않는다', async () => {
  const { room, call, bind } = makeRoom();
  assert.equal((await bind()).status, 200);
  const j = await call('POST', '/api/AB12CD/join', { json: { nickname: '봄날' } });
  const cur = (await call('GET', '/api/AB12CD/snapshot?since=0')).body.now;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // 방 안에서 기다림(무료 기본): 보통 긴 대기는 글이 올라오면 바로, 시험 요청은 끝까지
  let t0 = Date.now();
  const pr = room.fetch(new Request(`https://sites.example/api/AB12CD/snapshot?since=${cur}&wait=1&probe=1&n=1`, { headers: { 'cf-connecting-ip': '203.0.113.9' } }));
  const lp = call('GET', `/api/AB12CD/snapshot?since=${cur}&wait=20`);
  await sleep(150);
  assert.equal(room.busy(), true, '시험 요청을 붙잡는 동안 방은 깨어 있음(그 시간을 셈)');
  await call('POST', '/api/AB12CD/questions', { json: { text: '시험 요청 중에 올린 질문' }, token: j.body.token });
  const woke = await lp;
  assert.ok(Date.now() - t0 < 900, `보통 긴 대기는 바로 답함(${Date.now() - t0}ms)`); assert.equal(woke.body.questions.length, 1);
  const res = await pr; const body = await res.json();
  assert.ok(Date.now() - t0 >= 950, `시험 요청은 끝까지 붙잡음(${Date.now() - t0}ms)`);
  assert.equal(res.status, 200); assert.deepEqual(Object.keys(body).sort(), ['held', 'probe', 'waitMax'], '자료를 싣지 않음');
  assert.equal(body.probe, true); assert.equal(body.waitMax, MAX_WAIT_S); assert.ok(body.held >= 950);
  assert.equal(res.headers.get('timing-allow-origin'), '*');
  assert.equal(room.busy(), false);
  // 묶이지 않은 방·가려진 방은 시험 요청도 받지 않음(다른 요청과 같은 문)
  await call('POST', '/host/touch', { json: { site: SITE, expires: Date.now() + day, blocked: true } });
  assert.equal((await call('GET', `/api/AB12CD/snapshot?since=${cur}&wait=1&probe=1`)).status, 403);
  // Worker가 대신 기다릴 때(relayWait): 방에 묻지 않고 Worker가 붙잡았다 답함
  const { relayWait } = await import('../../skills/lecpage/backends/cloudflare/src/longpoll.js');
  let asked = 0; const stub = { fetch: async () => { asked++; return new Response('{}'); } };
  t0 = Date.now();
  const r2 = await relayWait(stub, new Request(`https://sites.example/api/AB12CD/snapshot?since=${cur}&wait=1&probe=1`), 1);
  const b2 = await r2.json();
  assert.equal(asked, 0, '방(Durable Object)에 묻지 않음'); assert.ok(Date.now() - t0 >= 950);
  assert.equal(b2.probe, true); assert.equal(r2.headers.get('timing-allow-origin'), '*');
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
