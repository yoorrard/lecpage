// 방마다 요청 상한(src/live/host.js RoomBudget): 정상 연수는 넉넉히, 사이트 스크립트가 방을 쉬지 않고 부르면 분·하루 몫에서 멈춤
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomBudget, roomCaps, ROOM_CAP } from '../src/live/host.js';
import { fakeSql } from './fake-do.mjs';
import { estimate } from '../src/capacity.js';

test('상한 크기: 참가자에 따라 늘고, 하루 예산의 70%를 넘지 않음', () => {
  assert.deepEqual(roomCaps(0), { day: ROOM_CAP.dayBase, minute: ROOM_CAP.minuteBase });
  assert.deepEqual(roomCaps(40), { day: 20000 + 1500 * 40, minute: 600 + 20 * 40 });
  assert.equal(roomCaps(40, { budget: 100000 }).day, 70000);
  assert.equal(roomCaps(10, { budget: 100000 }).day, 35000);
  assert.equal(roomCaps(9999).minute, 600 + 20 * 500, '500명에서 멈춤');
  // 정상 연수(capacity.js 어림, 웹소켓이 막힌 학교망에서 모두 긴 대기로 묻는 경우)는 하루 몫 안
  for (const [people, minutes] of [[40, 120], [50, 240], [100, 120], [300, 120]]) {
    const need = estimate({ people, minutes, live: true, network: 'restricted', longPoll: true });
    assert.ok(need < roomCaps(people).day, `${people}명 ${minutes}분: ${need} < ${roomCaps(people).day}`);
  }
});

test('분 몫·하루 몫을 넘으면 기다릴 초를 돌려주고, 날이 바뀌면(UTC 0시) 다시', () => {
  const b = new RoomBudget(fakeSql(), { every: 50 });
  const t0 = Date.parse('2026-11-20T10:00:05Z');
  let ok = 0;
  for (let i = 0; i < 700; i++) if (!b.hit({ people: 0, now: t0 })) ok++;
  assert.equal(ok, 600, '사람이 없으면 1분 600번');
  assert.equal(b.hit({ people: 0, now: t0 }), 55, '다음 분까지');
  assert.equal(b.hit({ people: 0, now: t0 + 60e3 }), 0, '다음 분에는 다시');
  // 하루 몫: 분마다 600번씩 쓰면 20,000번에서 멈추고 UTC 0시까지 기다림
  let t = t0 + 120e3; let n = 601; let wait = 0;
  while (!wait && n < 30000) { for (let i = 0; i < 600 && !wait; i++) { wait = b.hit({ people: 0, now: t }); if (!wait) n++; } t += 60e3; }
  assert.equal(n, 20000);
  assert.ok(wait > 3600 && wait <= 14 * 3600, String(wait));
  assert.equal(b.hit({ people: 0, now: Date.parse('2026-11-21T00:00:01Z') }), 0, '다음 날');
});

test('잠들었다 깨어도(새 객체) 저장한 하루 셈을 이어 감', () => {
  const sql = fakeSql(); const now = Date.parse('2026-11-20T03:00:00Z');
  const a = new RoomBudget(sql, { every: 100 });
  for (let i = 0; i < 450; i++) a.hit({ people: 10, now: now + i * 200 });
  const b = new RoomBudget(sql, { every: 100 });
  b.hit({ people: 10, now: now + 100e3 });
  assert.equal(b.n, 401, 'every(100)마다 적음 → 400 + 1');
  const c = new RoomBudget(sql); c.hit({ people: 10, now: Date.parse('2026-11-21T03:00:00Z') });
  assert.equal(c.n, 1, '다른 날이면 0부터');
});
