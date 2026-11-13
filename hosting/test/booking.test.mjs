// 연수 예약형 수용량: 어림(capacity.js), Gate의 예약·그날 상태·앞으로 7일 표, 예약된 날 새 일을 일찍 멈춤. 긴 대기 판단.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './fake-do.mjs';
import { estimate, cleanBooking, kstTime, EST, BOOK_SHARE } from '../src/capacity.js';

const { Gate, kstDate } = await import('../src/gate.js');
const { snapshotChanged } = await import('../src/room.js');

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
const day = (n) => kstDate(Date.now() + n * 864e5);
const reserve = (call, id, booking) => call('POST', 'reserve', { ip: `203.0.113.${id.charCodeAt(0) % 200}`, id, created: Date.now(), expires: Date.now() + 864e5, title: id, booking });

test('어림: Pages 보기는 사이트 요청 0, 참여 기능·학교망 묻기가 대부분', () => {
  const w = estimate({ people: 40, view: 'worker' }); const p = estimate({ people: 40, view: 'pages' });
  assert.equal(w, 42 * EST.viewWorker); assert.equal(p, 0);
  const schoolPoll = estimate({ people: 40, minutes: 120, live: true, network: 'restricted', view: 'pages' });
  assert.equal(schoolPoll, Math.round(42 * EST.liveBase + 42 * 120 * EST.pollPerMin));
  assert.ok(estimate({ people: 40, minutes: 120, live: true, network: 'restricted', view: 'pages', longPoll: true }) < schoolPoll * 0.75, '긴 대기면 4분의 3 아래(측정 1분 3.4 대 5)');
  assert.ok(estimate({ people: 40, live: true, network: 'good', view: 'pages' }) < schoolPoll / 3, '실시간 연결이 되는 곳은 훨씬 적음');
});

test('예약 값 정리: 한국 시각, 끝 시각으로 길이, 지난 날·1년 넘는 날은 버림', () => {
  assert.equal(kstTime('2026-11-20', '09:30'), Date.UTC(2026, 10, 20, 0, 30));
  assert.equal(kstTime('2026-11-20'), Date.UTC(2026, 10, 20, 1, 0), '시각이 없으면 오전 10시');
  const now = Date.UTC(2026, 10, 13);
  assert.deepEqual(cleanBooking({ date: '2026-11-20', start: '13:00', end: '16:30', people: 45, live: 1, network: 'restricted' }, now), { at: Date.UTC(2026, 10, 20, 4), minutes: 210, people: 45, live: true, network: 'restricted' });
  assert.equal(cleanBooking({ date: '2026-11-01' }, now), null);
  assert.equal(cleanBooking({ date: '2028-01-01' }, now), null);
  assert.equal(cleanBooking({ date: 'tomorrow' }, now), null);
  assert.equal(cleanBooking({ date: '2026-11-20', people: 99999 }, now).people, 500);
});

test('예약: 그날 어림이 예산의 70%를 넘으면 만들 때 알림(다른 날·Pages 보기 사이트 연수는 그대로)', async () => {
  const { call } = gate({ VIEW: 'worker', SITES_PER_HOUR: 100, SITES_PER_DAY: 100, POLL_LONG: 'off' }); // 예전 5초 묻기 어림으로(긴 대기 기본값은 아래 시험)
  const big = { date: day(7), start: '10:00', end: '12:00', people: 60, live: true, network: 'restricted' }; // 62 × (25 + 15 + 120×5) ≈ 3.9만
  assert.equal((await reserve(call, 'aaaaaaaaaa', big)).status, 200);
  const st = (await call('GET', `day?date=${day(7)}`)).body.day;
  assert.equal(st.trainings, 1); assert.equal(st.people, 60); assert.ok(st.est > 39000 && st.est < 40000); assert.equal(st.ok, true);
  const no = await reserve(call, 'bbbbbbbbbb', big);
  assert.equal(no.status, 429); assert.equal(no.body.error.reason, 'booked'); assert.equal(no.body.error.day, day(7));
  assert.match(no.body.error.message_ko, /^\d+월 \d+일은 바로 공개에 예약된 연수가 많아\(1개\)/);
  assert.equal((await call('GET', 'sites')).body.sites.length, 1, '거절되면 사이트도 만들지 않음');
  assert.equal((await reserve(call, 'cccccccccc', { ...big, date: day(8) })).status, 200, '다른 날은 됨');
  assert.equal((await reserve(call, 'dddddddddd', { ...big, live: false })).status, 200, '참여 기능이 없는 연수는 작음');
  // 다시 올리며 날짜를 바꾸면 갈아 끼움(같은 사이트는 두 번 세지 않음)
  assert.equal((await call('POST', 'book', { site: 'aaaaaaaaaa', booking: { ...big, people: 30 } })).status, 200);
  assert.ok((await call('GET', `day?date=${day(7)}`)).body.day.est < 25000);
  // 앞으로 7일 표
  const up = (await call('GET', 'overview')).body.upcoming;
  assert.equal(up.length, 7); assert.equal(up[0].date, day(0));
  assert.equal(up.find((u) => u.date === day(7)), undefined, '7일 뒤는 표 밖(오늘~6일 뒤)');
  // 지우면 예약도
  await call('POST', 'forget', { id: 'cccccccccc' });
  assert.equal((await call('GET', `day?date=${day(8)}`)).body.day.trainings, 0);
});

test('예약된 연수가 있는 날은 새 일을 일찍 멈춤(오늘 아직 끝나지 않은 몫만큼)', async () => {
  const { g, call } = gate({ VIEW: 'pages', POLL_LONG: 'off' });
  assert.equal(g.accepting(), true);
  const later = new Date(Date.now() + 3 * 3600e3);
  const date = kstDate(later.getTime()); const hh = new Date(later.getTime() + 9 * 3600e3).toISOString().slice(11, 16);
  // 이 시험은 '오늘'(UTC 날짜)이 바뀌는 시각 근처면 건너뜀
  if (Math.floor(later.getTime() / 864e5) !== Math.floor(Date.now() / 864e5)) return;
  assert.equal((await call('POST', 'book', { site: 'eeeeeeeeee', booking: { date, start: hh, people: 100, live: true, network: 'restricted', minutes: 120 } })).status, 200);
  const left = g.reservedLeft();
  assert.ok(left > 50000 && left < BOOK_SHARE * 100000, String(left));
  await call('POST', 'tick', { n: 10000 });
  assert.equal(g.accepting(), false, '쓴 것 1만 + 예약 6만여 ≥ 예산 60%');
  const s = (await call('GET', 'status')).body;
  assert.equal(s.accepting, false); assert.equal(s.reserved, left);
});

test('그날 상태: 사이트 상태(가림·없음)와 예약', async () => {
  const { call } = gate({ VIEW: 'pages' });
  await reserve(call, 'ffffffffff', { date: day(3), people: 20 });
  const s = (await call('GET', `day?date=${day(3)}&site=ffffffffff`)).body;
  assert.equal(s.site.state, 'open'); assert.equal(s.site.booking.people, 20); assert.equal(s.site.booking.date, day(3));
  assert.equal((await call('GET', 'day?site=gggggggggg')).body.site.state, 'gone');
  assert.equal(s.today.date, kstDate(Date.now()));
});

test('긴 대기 어림이 기본(POLL_LONG 없으면 on, "off"면 예전 5초 묻기 어림)', async () => {
  const big = { date: day(7), start: '10:00', end: '12:00', people: 60, live: true, network: 'restricted' };
  const on = gate({ VIEW: 'worker', SITES_PER_HOUR: 100, SITES_PER_DAY: 100 });
  await reserve(on.call, 'kkkkkkkkkk', big);
  const estOn = (await on.call('GET', `day?date=${day(7)}`)).body.day.est;
  const off = gate({ VIEW: 'worker', SITES_PER_HOUR: 100, SITES_PER_DAY: 100, POLL_LONG: 'off' });
  await reserve(off.call, 'kkkkkkkkkk', big);
  const estOff = (await off.call('GET', `day?date=${day(7)}`)).body.day.est;
  assert.ok(estOn < estOff * 0.75, `${estOn} < ${estOff} × 0.75`);
  assert.equal((await reserve(on.call, 'mmmmmmmmmm', big)).status, 200, '긴 대기 어림이면 같은 날 60명 학교망 연수 둘도 받음');
});

test('유료 요금제(예산 0)는 예약으로 막지 않음', async () => {
  const { call } = gate({ PLAN: 'paid', DAILY_REQUEST_BUDGET: undefined });
  const big = { date: day(5), people: 500, live: true, network: 'restricted', minutes: 600 };
  assert.equal((await call('POST', 'book', { site: 'hhhhhhhhhh', booking: big })).status, 200);
  assert.equal((await call('POST', 'book', { site: 'jjjjjjjjjj', booking: big })).status, 200);
});

test('긴 대기: 바뀐 것이 없을 때만 기다림', () => {
  const empty = { state: { updatedAt: 100 }, now: 200, since: 150, full: false, removed: [], questions: [], posts: [] };
  assert.equal(snapshotChanged(empty, 150), false);
  assert.equal(snapshotChanged({ ...empty, questions: [{ id: 'q' }] }, 150), true);
  assert.equal(snapshotChanged({ ...empty, removed: [{ col: 'posts', id: 'p' }] }, 150), true);
  assert.equal(snapshotChanged({ ...empty, state: { updatedAt: 160 } }, 150), true, '진행 상태가 바뀜');
  assert.equal(snapshotChanged({ ...empty, full: true }, 150), true);
  assert.equal(snapshotChanged(null, 1), true);
});
