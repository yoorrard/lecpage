// 무료 하루 한도는 Worker 요청·DO 요청·DO duration이 따로: 단계는 가장 빠듯한 것으로, 방이 깨어 있던 시간(SSE·방 안 긴 대기)을 재서 Gate에 알림.
// (긴 대기가 기본인 런타임에서 참가자가 적은 연수가 여럿이면 요청은 60% 아래인데 duration이 먼저 넘칠 수 있음)
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, fakeNamespace } from './fake-do.mjs';
import { estimate, GBS_TO_REQ } from '../src/capacity.js';

const { Gate } = await import('../src/gate.js');
const { Room } = await import('../src/room.js');

let realFetch;
beforeEach(() => { realFetch = globalThis.fetch; globalThis.fetch = async () => new Response('ok'); });
afterEach(() => { globalThis.fetch = realFetch; });

function gate(env = {}) {
  const ctx = fakeCtx(); ctx.waitUntil = () => { };
  const g = new Gate(ctx, { DAILY_REQUEST_BUDGET: 100000, ...env });
  const call = async (method, op, body) => {
    const res = await g.fetch(new Request(`http://gate/${op}`, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }));
    return { status: res.status, body: await res.json() };
  };
  return { g, call };
}

test('예약 어림: 방 안 긴 대기는 duration(2시간 ≈ 900 GB-s)을 요청 단위로 바꿔 더 큰 쪽, Worker가 대신이면 DO 요청 2배', () => {
  const small = { people: 20, minutes: 120, live: true, network: 'good', view: 'pages', longPoll: true };
  const inRoom = estimate(small); const relay = estimate({ ...small, relay: true });
  assert.ok(Math.abs(inRoom - Math.round(900 * GBS_TO_REQ)) <= 1, `작은 연수도 방이 내내 깨어 있으면 하루 duration의 7%: ${inRoom}`);
  assert.ok(relay < inRoom, 'Worker가 대신이면 작은 연수는 요청 몫만');
  const school = { people: 40, minutes: 120, live: true, network: 'restricted', view: 'pages', longPoll: true };
  assert.ok(estimate({ ...school, relay: true }) > estimate(school), '학교망 큰 연수는 DO 요청(묻기마다 2)이 더 큼');
  assert.equal(estimate({ ...small, live: false }), 0, 'Pages 보기 사이트만이면 0');
});

test('단계: Worker 요청이 적어도 DO duration·DO 요청이 빠듯하면 tight·full(가장 빠듯한 한도로)', async () => {
  const { call } = gate();
  await call('POST', 'tick', { n: 10000 }); // Worker 10%
  assert.equal((await call('GET', 'status')).body.capacity.state, 'open');
  // 방이 깨어 있던 시간: 5만 초 × 0.125GB = 6,250 GB-s = 무료 하루의 48% → 요청 단위로 4.8만
  await call('POST', 'site', { id: '', aw: 50000 });
  const t = await call('POST', 'tick', { n: 1 });
  assert.ok(t.body.gbsPct > 47 && t.body.gbsPct < 49, String(t.body.gbsPct));
  assert.ok(t.body.pct > 47, 'pct는 세 한도 중 가장 빠듯한 것');
  assert.equal((await call('GET', 'status')).body.capacity.state, 'tight');
  await call('POST', 'site', { id: '', aw: 20000 });
  const s = (await call('GET', 'status')).body;
  assert.equal(s.capacity.state, 'full'); assert.equal(s.capacity.reason, 'budget');
  // DO 요청이 Worker 요청보다 많을 때(긴 대기를 Worker가 대신)
  const g2 = gate();
  await g2.call('POST', 'tick', { n: 20000, c: { dr: 62000, ds: 100 } });
  assert.equal((await g2.call('GET', 'status')).body.capacity.state, 'full');
});

test('방: SSE·방 안 긴 대기로 깨어 있던 시간을 10분마다·끝날 때 Gate에 알림', async () => {
  const ctx = fakeCtx(); const jobs = []; ctx.waitUntil = (p) => jobs.push(p);
  const GATE = fakeNamespace(() => ({ ok: true, total: 0 }));
  const room = new Room(ctx, { GATE, SITE: fakeNamespace(() => ({ ok: true })) });
  room.hostBind.set({ site: 'abcdefghjk', code: 'AW1234', expires: Date.now() + 864e5 });
  const t0 = Date.now();
  const entry = { w: { write: async () => { } }, ip: '' };
  room.sse.add(entry); room.awake(t0);
  room.awake(t0 + 5 * 60e3);
  assert.equal(GATE.calls.length, 0, '10분이 안 됐으면 아직');
  room.awake(t0 + 11 * 60e3);
  await Promise.all(jobs);
  assert.equal(GATE.calls.length, 1); assert.deepEqual(GATE.calls[0].body, { id: 'abcdefghjk', aw: 660 });
  room.awake(t0 + 12 * 60e3);
  room.sse.delete(entry); room.awake(t0 + 13 * 60e3); // 연결이 끊김 → 남은 2분을 알림
  await Promise.all(jobs);
  assert.equal(GATE.calls.length, 2); assert.equal(GATE.calls[1].body.aw, 120);
  room.awake(t0 + 60 * 60e3);
  assert.equal(GATE.calls.length, 2, '아무도 없으면 세지 않음(방이 잠듦)');
});
