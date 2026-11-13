// 넘침 처리: 단계(open·tight·full·paused), 공정 몫(기기·IP), 예약 우선, 참여 기능만 넘기기, Pages API 5분 창, 저장량 합계.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './fake-do.mjs';
import { tier, deviceOf, nearBooking, TIGHT_SHARE, NEXT_HOSTS, NEXT_LIVE } from '../src/fair.js';
import { config } from '../src/config.js';

const { Gate, kstDate } = await import('../src/gate.js');

let realFetch;
beforeEach(() => { realFetch = globalThis.fetch; globalThis.fetch = async () => new Response('ok'); });
afterEach(() => { globalThis.fetch = realFetch; });

function gate(env = {}) {
  const ctx = fakeCtx(); ctx.waitUntil = () => { };
  const g = new Gate(ctx, { DAILY_REQUEST_BUDGET: 100000, ...env });
  const call = async (method, op, body) => {
    const res = await g.fetch(new Request(`http://gate/${op}`, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }));
    return { status: res.status, body: await res.json(), headers: res.headers };
  };
  return { g, ctx, call };
}
let n = 0;
const id = () => `s${String(++n).padStart(9, '0')}`.replace(/[ilou]/g, 'x').slice(0, 10).replace(/^s/, 'a');
const day = (k) => kstDate(Date.now() + k * 864e5);
const reserve = (call, o = {}) => call('POST', 'reserve', { ip: '203.0.113.7', id: o.id || id(), created: Date.now(), expires: Date.now() + 864e5, title: 't', ...o });

test('단계: 45% 아래 open, 45~60% tight(예약한 연수만), 60% full, 멈춤·저장·Pages 대기', () => {
  const now = Date.UTC(2026, 10, 13, 3);
  assert.equal(tier({ budget: 100000, used: 10000, now }).state, 'open');
  const t = tier({ budget: 100000, used: 30000, reserved: 16000, now });
  assert.equal(t.state, 'tight'); assert.equal(t.onlyBooked, true); assert.equal(t.newSites, true); assert.equal(t.reason, 'tight');
  const f = tier({ budget: 100000, used: 61000, now });
  assert.deepEqual([f.state, f.reason, f.newSites, f.newRooms], ['full', 'budget', false, false]);
  assert.equal(f.resetAt, Date.UTC(2026, 10, 14), '한국 시간 오전 9시(00:00 UTC)에 다시');
  assert.equal(tier({ budget: 0, used: 1e9, now }).state, 'open', '유료(예산 0)는 요청 수로 막지 않음');
  assert.equal(tier({ budget: 100000, paused: true, now }).reason, 'paused');
  assert.equal(tier({ budget: 100000, storageFull: true, now }).reason, 'storage');
  const p = tier({ budget: 100000, pagesUntil: now + 60000, now });
  assert.deepEqual([p.reason, p.retryAt], ['pages_api', now + 60000]);
  const cap = tier({ budget: 100000, sitesLeft: 0, now });
  assert.deepEqual([cap.state, cap.reason, cap.newSites, cap.newRooms], ['full', 'daily_cap', false, true], '하루 사이트 상한이 차도 방은 됨');
  assert.ok(TIGHT_SHARE < 0.6);
  assert.equal(deviceOf('abc'), ''); assert.equal(deviceOf('A'.repeat(22)), 'A'.repeat(22)); assert.equal(deviceOf('a b'.repeat(10)), '');
  assert.equal(nearBooking({ at: Date.now() + 3 * 864e5 }), true); assert.equal(nearBooking({ at: Date.now() + 30 * 864e5 }), false); assert.equal(nearBooking(null), false);
});

test('기본 한도: pages 보기는 새 사이트·방 상한이 큼(새 사이트 하나가 드는 몫이 작음), 기기 몫', () => {
  const pagesEnv = { CF_ACCOUNT_ID: '0123456789abcdef0123456789abcdef', PAGES_PROJECT: 'p', PAGES_TOKEN: 'x'.repeat(30), PAGES_HOST: 'p.pages.dev' };
  const w = config({}); const p = config(pagesEnv); const pp = config({ ...pagesEnv, PLAN: 'paid' }); const wp = config({ PLAN: 'paid' });
  assert.deepEqual([w.dailySiteCap, w.dailyRoomCap], [30, 30]);
  assert.deepEqual([p.view, p.dailySiteCap, p.dailyRoomCap], ['pages', 200, 100]);
  assert.deepEqual([pp.dailySiteCap, pp.dailyRoomCap, pp.dailyRequestBudget], [1000, 1000, 0]);
  assert.deepEqual([wp.dailySiteCap, wp.dailyRoomCap], [300, 300]);
  assert.deepEqual([p.sitesPerDevice, pp.sitesPerDevice, p.sitesPerHourShared, p.sitesPerDayShared, p.pagesApiBudget], [5, 10, 30, 60, 900]);
  assert.equal(config({ DAILY_SITE_CAP: '7', ...pagesEnv }).dailySiteCap, 7, '운영자가 정한 값이 먼저');
  assert.deepEqual([config({}).pollRelay, config({ PLAN: 'paid' }).pollRelay, config({ POLL_RELAY: 'on' }).pollRelay, config({ PLAN: 'paid', POLL_RELAY: 'off' }).pollRelay], ['auto', 'auto', true, false], 'auto: 유료면 늘, 무료면 duration 50%부터(index.js가 그때그때)');
});

test('공정 몫: 기기 표가 있으면 기기마다 하루 5개, 같은 학교 IP는 넉넉히(강사 연수에 여럿이 한 공유기)', async () => {
  const { call } = gate({ SITES_PER_DEVICE: 2 });
  const dev = (k) => `device-${k}-0123456789abcdef`;
  const a1 = await reserve(call, { device: dev(1) });
  assert.equal(a1.status, 200); assert.deepEqual(a1.body.share, { scope: 'device', left: 1 });
  assert.equal((await reserve(call, { device: dev(1) })).status, 200);
  const over = await reserve(call, { device: dev(1) });
  assert.equal(over.status, 429); assert.equal(over.body.error.reason, 'device'); assert.equal(over.body.error.scope, 'you');
  assert.deepEqual(over.body.error.next, NEXT_HOSTS); assert.match(over.body.error.message_ko, /이 기기에서 오늘/);
  assert.ok(Number(over.headers.get('retry-after')) > 0);
  // 같은 IP의 다른 기기 11개: 기기 표가 없을 때의 IP 상한(시간 6개)을 넘어도 됨
  for (let k = 2; k < 13; k++) assert.equal((await reserve(call, { device: dev(k) })).status, 200, `기기 ${k}`);
  // 기기 표가 없는 예전 앱: IP마다 시간 6개(이미 13개가 이 IP)
  const old = await reserve(call, {});
  assert.equal(old.status, 429); assert.equal(old.body.error.reason, 'ip_hour'); assert.equal(old.body.error.scope, 'you');
  assert.equal((await reserve(call, { ip: '198.51.100.9' })).status, 200, '다른 IP는 됨');
});

test('공정 몫: 기기 표가 있어도 같은 IP는 시간 30개·하루 60개까지(기기 표를 바꿔 가며 쓰는 것 막기)', async () => {
  const { call } = gate({ SITES_PER_HOUR_SHARED: 3, SITES_PER_DAY_SHARED: 4 });
  for (let k = 0; k < 3; k++) assert.equal((await reserve(call, { device: `rotating-device-${k}-xxxxxxxx` })).status, 200);
  const r = await reserve(call, { device: 'rotating-device-9-xxxxxxxx' });
  assert.equal(r.status, 429); assert.equal(r.body.error.reason, 'ip_hour');
});

test('tight(붐빔): 연수 날짜가 2주 안인 사이트·방만 받고, 예약 없는 사이트는 내 계정으로', async () => {
  const { call } = gate({ SITES_PER_HOUR: 100, SITES_PER_DAY: 100 });
  await call('POST', 'tick', { n: 50000 }); // 50%
  const info = (await call('GET', 'status')).body;
  assert.equal(info.capacity.state, 'tight'); assert.equal(info.accepting, true, '예전 앱에는 받는다고(예약하면 되므로)');
  assert.deepEqual(info.capacity.next, NEXT_HOSTS); assert.deepEqual(info.capacity.liveNext, NEXT_LIVE);
  const plain = await reserve(call, {});
  assert.equal(plain.status, 429); assert.equal(plain.body.error.reason, 'tight'); assert.equal(plain.body.error.scope, 'everyone');
  assert.match(plain.body.error.message_ko, /연수 날짜가 14일 안/);
  const far = await reserve(call, { booking: { date: day(30), people: 30 } });
  assert.equal(far.status, 429, '한 달 뒤 연수는 나중에(그때 다시)');
  const near = await reserve(call, { booking: { date: day(3), people: 30, live: true } });
  assert.equal(near.status, 200, '가까운 연수는 받음');
  assert.equal(near.body.advice, undefined, '연수용이면 내 계정을 권하지 않음');
  // 방: 예약이 가까운 사이트만
  const nearId = JSON.parse(JSON.stringify(near.body)) && (await call('GET', 'sites')).body.sites[0].id;
  assert.equal((await call('POST', 'room', { id: nearId, code: 'ROOM01' })).status, 200);
  const r2 = await call('POST', 'room', { id: 'zzzzzzzzzz' });
  assert.equal(r2.status, 429); assert.equal(r2.body.error.reason, 'tight'); assert.deepEqual(r2.body.error.liveNext, NEXT_LIVE);
  assert.equal((await call('GET', 'sites')).body.sites[0].liveCode, 'ROOM01', '방을 받으면 Gate가 코드를 적음(따로 부르지 않음)');
});

test('full: 새 사이트·새 방은 거절(까닭·다시 될 때·넘길 곳), 다시 올리기는 됨', async () => {
  const { call } = gate();
  const s = await reserve(call, {});
  assert.equal(s.status, 200); assert.equal(s.body.advice.code, 'long_term', '예약 없는 사이트(오래 쓸 수 있음)는 내 계정도 권함');
  await call('POST', 'tick', { n: 61000 });
  const r = await reserve(call, { booking: { date: day(1), people: 20 } });
  assert.equal(r.status, 429); assert.equal(r.body.error.reason, 'budget'); assert.ok(r.body.error.retryAt > Date.now());
  assert.match(r.body.error.message_ko, /오전 9시에 다시/);
  const sid = (await call('GET', 'sites')).body.sites[0].id;
  const room = await call('POST', 'room', { id: sid });
  assert.equal(room.status, 429); assert.deepEqual(room.body.error.liveNext, NEXT_LIVE);
  const chk = await call('POST', 'deploy-check', { site: sid, pages: 7 });
  assert.equal(chk.status, 200, '이미 있는 사이트는 다시 올릴 수 있음(연수 당일 고치기)');
});

test('참여 기능만 넘기기(split): 그날 방이 차면 사이트는 받고 참여 기능만 강사 계정으로. 예전 앱은 예전처럼 거절', async () => {
  const { call } = gate({ SITES_PER_HOUR: 100, SITES_PER_DAY: 100, VIEW: 'worker' });
  const big = { date: day(4), start: '09:00', end: '12:00', people: 60, live: true, network: 'restricted' }; // 62자리 × (25 + 15 + 180분×5) ≈ 5.8만: 하나는 되고 둘은 예산 70% 넘음
  assert.equal((await reserve(call, { booking: big })).status, 200);
  const old = await reserve(call, { booking: big });
  assert.equal(old.status, 429); assert.equal(old.body.error.reason, 'booked'); assert.deepEqual(old.body.error.liveNext, NEXT_LIVE);
  const ok = await reserve(call, { booking: big, caps: ['split'], id: 'bbbbbbbbbb' });
  assert.equal(ok.status, 200);
  assert.deepEqual([ok.body.live.ok, ok.body.live.reason, ok.body.live.next], [false, 'booked', NEXT_LIVE]);
  const room = await call('POST', 'room', { id: 'bbbbbbbbbb' });
  assert.equal(room.status, 429); assert.equal(room.body.error.reason, 'booked', '넘긴 예약에는 방을 만들지 않음');
  const st = (await call('GET', `day?date=${day(4)}&site=bbbbbbbbbb`)).body;
  assert.equal(st.site.booking.liveDenied, true); assert.equal(st.site.booking.live, false);
});

test('Pages API 5분 창: 넘치면 줄 서기(pages_api + 다시 될 때), 429를 받으면 5분 멈춤', async () => {
  const { g, call } = gate({ PAGES_API_BUDGET: 20 });
  assert.equal((await call('POST', 'deploy-check', { site: 'x', pages: 15 })).status, 200);
  const q = await call('POST', 'deploy-check', { site: 'x', pages: 15 });
  assert.equal(q.status, 429); assert.equal(q.body.error.reason, 'pages_api');
  const ra = Number(q.headers.get('retry-after')); assert.ok(ra > 200 && ra <= 300, String(ra));
  assert.equal((await call('POST', 'deploy-check', { site: 'x', pages: 5 })).status, 200, '남은 몫 안이면 됨');
  assert.equal((await call('POST', 'deploy-check', { site: 'x', pages: 0 })).status, 200, 'Worker 보기(Pages 안 씀)는 상관없음');
  g.pwin = [];
  await call('POST', 'site', { id: '', pz: 1 });
  const held = await call('POST', 'deploy-check', { site: 'x', pages: 1 });
  assert.equal(held.status, 429); assert.equal(held.body.error.reason, 'pages_api');
  assert.equal((await call('GET', 'status')).body.capacity.reason, 'pages_api', '/api/info에도');
  assert.equal((await call('POST', 'room', { id: '' })).status, 200, '방은 Pages API를 안 써서 그대로');
});

test('저장량 합계: 메모리로 더하고 빼도 표를 훑은 값과 같음(사이트가 많아도 Gate가 행을 다 읽지 않음)', async () => {
  const { g, ctx, call } = gate({ SITES_PER_HOUR: 1000, SITES_PER_DAY: 1000, DAILY_SITE_CAP: 1000 });
  const ids = [];
  for (let k = 0; k < 30; k++) { const i = `c${String(k).padStart(9, '0')}`.replace(/[ilou0]/g, 'a'); ids.push(i); await reserve(call, { id: i, ip: `10.0.${k}.1` }); }
  for (const [k, i] of ids.entries()) await call('POST', 'site', { id: i, bytes: 1000 * (k + 1), roomBytes: k });
  await call('POST', 'site', { id: ids[3], bytes: 5 });
  await call('POST', 'forget', { id: ids[7] });
  const scan = () => ctx.sql.exec('SELECT COUNT(*) AS sites, COALESCE(SUM(bytes + room_bytes), 0) AS bytes FROM sites').one();
  assert.deepEqual(g.usage(), { sites: scan().sites, bytes: scan().bytes });
  g.tot = null;
  assert.deepEqual(g.usage(), { sites: 29, bytes: scan().bytes }, '다시 깨어나면 한 번 훑음');
});

test('경합: 50명이 동시에 만들어도 하루 상한·기기 몫을 정확히 지킴(확인과 적기 사이에 기다림이 없음)', async () => {
  const { call } = gate({ DAILY_SITE_CAP: 30, SITES_PER_HOUR: 1000, SITES_PER_DAY: 1000 });
  const res = await Promise.all(Array.from({ length: 50 }, (_, k) => reserve(call, { id: `d${String(k).padStart(9, 'x')}`.slice(0, 10), ip: `10.1.${k}.1` })));
  assert.equal(res.filter((r) => r.status === 200).length, 30);
  const no = res.filter((r) => r.status !== 200);
  assert.ok(no.every((r) => r.status === 429 && r.body.error.reason === 'daily_cap' && r.body.error.scope === 'everyone'), JSON.stringify(no[0]?.body));
  assert.equal((await call('GET', 'sites')).body.sites.length, 30);
  const { call: c2 } = gate({ SITES_PER_DEVICE: 3, SITES_PER_HOUR_SHARED: 1000, SITES_PER_DAY_SHARED: 1000 });
  const same = await Promise.all(Array.from({ length: 10 }, (_, k) => reserve(c2, { id: `e${String(k).padStart(9, 'x')}`.slice(0, 10), device: 'one-device-0123456789' })));
  assert.equal(same.filter((r) => r.status === 200).length, 3, '한 기기는 동시에 보내도 하루 3개');
});
