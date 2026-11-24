// 바로 배포 보관 기간과 연수 날(app/src/lib/keep-dates.js): 알려 주는 '다시 배포할 날'은
//  ① 지워지는 날보다 앞이고(지워진 뒤 다시 배포하면 새 주소라 인쇄한 QR이 끊김) ② 그날 다시 배포하면 연수 날이 끝날 때까지 열려 있어야 함.
// 한 번으로 닿지 않으면 reach=false(화면이 그렇게 말하고 다음 할 일을 알림).
import test from 'node:test';
import assert from 'node:assert/strict';

const { keepPlan, DAY } = await import(new URL('../../../../app/src/lib/keep-dates.js', import.meta.url).href);
const kst = (s) => Date.parse(`${s}+09:00`);
const dayEnd = (d) => kst(`${d}T00:00:00`) + DAY; // 연수 날이 끝나는 때(다음 날 0시)
const ymd = (t) => new Date(t + 9 * 36e5).toISOString().slice(0, 10);
const now = kst('2026-11-24T08:28:00');
const days = 60;

test('연수가 가까움(10일 뒤): 보관 기간 안이라 알릴 것이 없음', () => {
  const pre = keepPlan({ now, days, until: 0, end: dayEnd('2026-12-04') });
  assert.equal(pre.short, false); assert.equal(pre.at, 0);
  const done = keepPlan({ now, days, until: now + days * DAY, end: dayEnd('2026-12-04') });
  assert.equal(done.short, false); assert.equal(done.gone, false); assert.equal(done.at, 0);
});

test('연수가 78일 뒤: 한 번 다시 배포로 닿고, 알려 주는 날은 지워지기 전', () => {
  const until = now + days * DAY; // 2027-01-23 08:28
  const end = dayEnd('2027-02-10');
  for (const x of [keepPlan({ now, days, until, end }), keepPlan({ now, days, until: 0, end })]) { // 배포한 뒤 · 배포 전(오늘 배포한다고 봄)
    assert.equal(x.short, true); assert.equal(x.enough, false); assert.equal(x.reach, true);
    assert.equal(ymd(x.at), '2027-01-18'); // 지워지기 5일 전
    assert.ok(x.at + DAY <= until, '그날 안에 언제 눌러도 지워지기 전');
    assert.ok(x.at + days * DAY >= end, '그날 0시에 눌러도 연수 날이 끝날 때까지 열려 있음');
  }
});

test('한 번으로 닿는 마지막 경계: 여유 5일을 못 두면 닿는 가장 이른 날', () => {
  const until = now + days * DAY; // 2027-01-23
  const x = keepPlan({ now, days, until, end: dayEnd('2027-03-21') }); // 01-21에 다시 배포해야 03-22 0시까지 닿음
  assert.equal(x.reach, true); assert.equal(ymd(x.at), '2027-01-21');
  assert.ok(x.at + DAY <= until); assert.ok(x.at + days * DAY >= x.end);
});

test('연수가 150일 뒤: 한 번으로는 닿지 않음 — 그래도 다음에 다시 배포할 날은 지워지기 전', () => {
  const until = now + days * DAY;
  const end = dayEnd('2027-04-23');
  for (const x of [keepPlan({ now, days, until, end }), keepPlan({ now, days, until: 0, end })]) {
    assert.equal(x.short, true); assert.equal(x.reach, false);
    assert.equal(ymd(x.at), '2027-01-18');
    assert.ok(x.at + DAY <= until);
    assert.ok(x.at + days * DAY < end, '한 번으로는 연수 날에 닿지 않음');
  }
});

test('지금 다시 배포하면 닿는 때(enough): 다시 배포할 날이 오늘보다 앞서지 않음', () => {
  const later = kst('2027-01-10T10:00:00'); // 지워지기 13일 전, 연수(02-10)까지 31일
  const x = keepPlan({ now: later, days, until: now + days * DAY, end: dayEnd('2027-02-10') });
  assert.equal(x.short, true); assert.equal(x.enough, true); assert.equal(x.reach, true);
  assert.ok(x.at >= kst('2027-01-10T00:00:00')); assert.ok(x.at + DAY <= x.until);
});

test('지워지는 날이 내일: 다시 배포할 날은 오늘', () => {
  const t = kst('2027-01-22T15:00:00');
  const x = keepPlan({ now: t, days, until: now + days * DAY, end: dayEnd('2027-02-10') });
  assert.equal(x.reach, true); assert.equal(ymd(x.at), '2027-01-22');
});

test('이미 지워짐·연수 날짜 없음', () => {
  const gone = keepPlan({ now: kst('2027-01-25T00:00:00'), days, until: now + days * DAY, end: dayEnd('2027-02-10') });
  assert.equal(gone.gone, true); assert.equal(gone.at, 0);
  const noDate = keepPlan({ now, days, until: now + days * DAY, end: 0 });
  assert.equal(noDate.short, false); assert.equal(noDate.enough, true); assert.equal(noDate.at, 0);
});
