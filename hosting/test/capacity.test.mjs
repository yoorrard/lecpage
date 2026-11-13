// 수용량 모형: 공식 요금으로 월 비용, 사용자 수별 쓰는 몫·먼저 차는 것, 관리 화면 추세(언제 무료가 차나·권하는 행동)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costOf, scenario, freeMaxUsers, trainingCost, forecast, FREE, PAID } from '../src/capacity.js';

test('유료 월 비용: 포함분 안이면 $5, 넘는 만큼 공식 요금', () => {
  assert.equal(costOf({}).total, 5);
  assert.equal(costOf({ workerReq: 10e6, doReq: 1e6, doGbs: 400000, rows: 50e6, storageMB: 5 * 1024 }).total, 5, '포함분까지는 $5');
  const c = costOf({ workerReq: 20e6, doReq: 3e6 });
  assert.equal(c.items.workerReq, 3); assert.equal(c.items.doReq, 0.3); assert.equal(c.total, 8.3);
  assert.equal(costOf({ doGbs: 1.4e6 }).items.doGbs, 12.5);
  assert.equal(costOf({ storageMB: 15 * 1024 }).items.storage, 2);
  assert.equal(PAID.workerReq.perM, 0.3); assert.equal(FREE.doGbs, 13000);
});

test('연수 한 번: 학교망 묻기가 가장 큼, 긴 대기는 요청이 적고(방 안이면 duration, Worker가 대신이면 DO 요청)', () => {
  const site = trainingCost({ live: false });
  const good = trainingCost({ live: true, network: 'good' });
  const school = trainingCost({ live: true, network: 'restricted' });
  const longIn = trainingCost({ live: true, network: 'restricted', longPoll: true });
  const longRelay = trainingCost({ live: true, network: 'restricted', longPoll: true, relay: true });
  assert.ok(site.workerReq < 50, '참여 기능 없는 Pages 사이트는 올리기만');
  assert.ok(good.workerReq < school.workerReq / 4);
  assert.ok(longIn.workerReq < school.workerReq * 0.75, '긴 대기(측정 1분 3.4)는 묻기 5초보다 적음');
  assert.ok(longIn.doGbs > 800, '방 안 긴 대기는 연수 내내 깨어 있음(2시간 ≈ 900 GB-s)');
  assert.ok(longRelay.doGbs < 20 && longRelay.doReq > longIn.doReq, 'Worker가 대신 기다리면 duration 대신 DO 요청');
});

test('사용자 수: 늘수록 비용이 늘고, 참여 기능을 강사 계정으로 넘기면 운영자 몫은 사이트만', () => {
  const a = scenario({ users: 1000 }); const b = scenario({ users: 10000 }); const c = scenario({ users: 100000 });
  assert.ok(a.paid.total < b.paid.total && b.paid.total < c.paid.total);
  assert.equal(a.trainings, 1400); assert.equal(a.peakTrainings, 140);
  assert.ok(['workerReq', 'doReq'].includes(a.first.resource), '참여 기능이 있으면 요청이 먼저 참');
  const siteOnly = scenario({ users: 100000, liveShare: 0 });
  assert.ok(siteOnly.paid.total < c.paid.total / 10);
  assert.ok(freeMaxUsers({ liveShare: 0 }) > 20 * freeMaxUsers(), '사이트만이면 무료로 훨씬 많이');
  assert.ok(freeMaxUsers() > 0);
});

const days = (list) => list.map((req, i) => ({ day: i, req, ds: Math.round(req * 0.5), dr: Math.round(req * 0.5), g: 10, new: 3 })).concat([{ day: 99, req: 0, new: 0 }]);
test('추세: 오르면 언제 빠듯해지는지와 유료 비용, 낮고 평평하면 할 일 없음', () => {
  const rising = forecast(days(Array.from({ length: 28 }, (_, i) => 30000 + i * 1000)), { plan: 'free', budget: 100000, dailySiteCap: 200 });
  assert.equal(rising.action, 'upgrade'); assert.ok(rising.trend.perDay > 900 && rising.trend.perDay < 1100);
  assert.ok(rising.trend.daysToStop >= 2 && rising.trend.daysToStop <= 5, JSON.stringify(rising.trend)); assert.equal(rising.busyDays, 7);
  assert.match(rising.text, /Workers Paid로 올리면 이번 달 약 \$/);
  const flat = forecast(days(Array.from({ length: 28 }, () => 8000)), { plan: 'free', budget: 100000, dailySiteCap: 200 });
  assert.equal(flat.action, 'none'); assert.equal(flat.trend.daysToStop, null); assert.match(flat.text, /무료로 충분해요/);
  assert.ok(flat.month.workerReq > 200000 && flat.paidCost.total === 5);
  const capped = forecast(days(Array.from({ length: 28 }, () => 8000)).map((d) => ({ ...d, new: 30 })), { plan: 'free', budget: 100000, dailySiteCap: 30 });
  assert.equal(capped.action, 'raise_caps');
  const spike = days(Array.from({ length: 28 }, () => 8000)); spike[spike.length - 1].new = 80;
  assert.equal(forecast(spike, { plan: 'free', budget: 100000 }).action, 'pause_new', '오늘 새 사이트가 평소의 3배 넘게 몰림');
  const paid = forecast(days(Array.from({ length: 28 }, () => 400000)), { plan: 'paid', budget: 0, dailySiteCap: 1000 });
  assert.equal(paid.action, 'none'); assert.match(paid.text, /유료 요금제예요/); assert.ok(paid.paidCost.total > 5);
});
