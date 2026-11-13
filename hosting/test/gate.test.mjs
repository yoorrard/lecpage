// Gate(호스트 전체에 하나뿐인 Durable Object)의 하루 숫자·예산 알림·새 업로드 멈춤·공지·신고 처리·감사 기록.
// Durable Object는 흉내(test/fake-do.mjs)로 돌립니다. 실제 workerd에서는 integration.test.mjs가 확인합니다.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './fake-do.mjs';

const { Gate, dayOf } = await import('../src/gate.js');

let sent = []; let realFetch;
beforeEach(() => { sent = []; realFetch = globalThis.fetch; globalThis.fetch = async (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return new Response('ok'); }; });
afterEach(() => { globalThis.fetch = realFetch; });

function gate(env = {}) {
  const ctx = fakeCtx();
  const waits = [];
  ctx.waitUntil = (p) => waits.push(p);
  const g = new Gate(ctx, { DAILY_REQUEST_BUDGET: 1000, ALERT_WEBHOOK: 'https://hooks.example/alert', ...env });
  const call = async (method, op, body) => {
    const res = await g.fetch(new Request(`http://gate/${op}`, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }));
    return { status: res.status, body: await res.json() };
  };
  return { g, ctx, call, waits };
}
const reserve = (call, id, ip = '203.0.113.7') => call('POST', 'reserve', { ip, id, created: Date.now(), expires: Date.now() + 864e5, title: `사이트 ${id}` });

test('하루 숫자: Worker가 묶어 보낸 요청 수·갈래·앱 이용 합계를 오늘 줄에 더함(한 번에 한 줄 쓰기)', async () => {
  const { call, ctx } = gate({ STATS_DAILY_CAP: 5 });
  const w0 = ctx.sql.writes;
  const r = await call('POST', 'tick', { n: 50, c: { site: 30, api: 10, live: 9, err: 1, edge: 12, evil: 99 }, s: { 'a:open': 3, 'a:make:key': 1, 'a:hack': 100, __proto__: { x: 1 } } });
  assert.equal(r.status, 200); assert.equal(r.body.pct, 5);
  assert.equal(ctx.sql.writes - w0, 1, '한 줄만 씀');
  await call('POST', 'tick', { n: 25, c: { site: 25 }, s: { 'a:open': 9 } });
  await call('POST', 'tick', { n: -5, c: { site: 1e12 } });
  const o = (await call('GET', 'overview')).body;
  const t = o.today;
  assert.equal(t.req, 75); assert.equal(t.site, 30 + 25 + 100000, '한 번에 더하는 값은 상한까지'); assert.equal(t.api, 10); assert.equal(t.live, 9); assert.equal(t.err, 1); assert.equal(t.edge, 12);
  assert.equal(t.evil, undefined, '모르는 갈래는 버림');
  assert.equal(t['a:open'], 5, '앱 이용 합계는 항목마다 하루 상한(STATS_DAILY_CAP)까지');
  assert.equal(t['a:make:key'], 1); assert.equal(t['a:hack'], undefined);
  assert.equal(o.days.length, 30); assert.equal(o.days[29].date, new Date(dayOf(Date.now()) * 864e5).toISOString().slice(0, 10));
  assert.equal(o.plan, 'free'); assert.equal(o.budget, 1000);
});

test('앱 이용 합계를 끄면(STATS=off) 받지 않음', async () => {
  const { call } = gate({ STATS: 'off' });
  await call('POST', 'tick', { n: 1, s: { 'a:open': 1 } });
  const o = (await call('GET', 'overview')).body;
  assert.equal(o.today['a:open'], undefined); assert.equal(o.stats, false);
});

test('하루 예산 알림: 넘침 단계와 같게 45·60·80·95%를 처음 넘을 때 한 번씩 웹훅', async () => {
  const { call } = gate();
  await call('POST', 'tick', { n: 449 });
  assert.equal(sent.length, 0);
  await call('POST', 'tick', { n: 1 });
  assert.equal(sent.length, 1); assert.equal(sent[0].url, 'https://hooks.example/alert');
  assert.match(sent[0].body.text, /45%를 넘었어요\(450 \/ 1,000\)/); assert.equal(sent[0].body.content, sent[0].body.text, 'Slack(text)·Discord(content)');
  assert.match(sent[0].body.text, /붐빔: 연수 날짜가 14일 안인 사이트·방만/);
  await call('POST', 'tick', { n: 50 });
  assert.equal(sent.length, 1, '같은 단계는 다시 안 보냄');
  await call('POST', 'tick', { n: 450 }); // 950 → 60·80%를 건너 95%까지 한 번에
  assert.equal(sent.length, 2); assert.match(sent[1].body.text, /95%/); assert.match(sent[1].body.text, /오류 1027/);
  assert.equal((await call('GET', 'status')).body.accepting, false, '60%를 넘었으니 새 사이트는 받지 않음');
  // 웹훅이 없거나 유료면 보내지 않음
  const paid = gate({ PLAN: 'paid', DAILY_REQUEST_BUDGET: undefined });
  await paid.call('POST', 'tick', { n: 100000 });
  assert.equal(sent.length, 2);
  const none = gate({ ALERT_WEBHOOK: undefined });
  await none.call('POST', 'tick', { n: 1000 });
  assert.equal(sent.length, 2);
  // 웹훅을 따로 안 정하면 신고 웹훅으로
  const rep = gate({ ALERT_WEBHOOK: undefined, REPORT_WEBHOOK: 'https://hooks.example/report' });
  await rep.call('POST', 'tick', { n: 600 });
  assert.equal(sent.at(-1).url, 'https://hooks.example/report'); assert.match(sent.at(-1).body.text, /60%.*새 사이트·새 방은 받지 않고/);
});

test('새 업로드 멈춤: 새 사이트·새 방을 막고(rate_limited, 503), 풀면 다시 받음. 감사 기록', async () => {
  const { call } = gate();
  assert.equal((await reserve(call, 'aaaaaaaaaa')).status, 200);
  assert.equal((await call('POST', 'uploads', { paused: 'yes' })).status, 400);
  const p = await call('POST', 'uploads', { paused: true, reason: '스팸이 몰림\n점검', who: 'op@example.com' });
  assert.equal(p.status, 200); assert.equal(p.body.reason, '스팸이 몰림 점검');
  const st = (await call('GET', 'status')).body;
  assert.deepEqual([st.accepting, st.paused], [false, true]);
  assert.equal((await call('GET', 'usage')).body.paused, true, '사이트 다시 올리기도 이것을 보고 막음');
  const r = await reserve(call, 'bbbbbbbbbb');
  assert.equal(r.status, 503); assert.equal(r.body.error.code, 'rate_limited'); assert.match(r.body.error.message_ko, /운영자가 잠시 새 업로드를 멈췄어요/);
  const room = await call('POST', 'room', { id: 'aaaaaaaaaa' });
  assert.equal(room.status, 503);
  await call('POST', 'uploads', { paused: false, who: 'op@example.com' });
  assert.equal((await reserve(call, 'cccccccccc')).status, 200);
  const audit = (await call('GET', 'audit')).body.audit;
  assert.deepEqual(audit.map((a) => [a.action, a.who]), [['uploads.resume', 'op@example.com'], ['uploads.pause', 'op@example.com']]);
  assert.equal(audit[1].detail, '스팸이 몰림 점검');
  const o = (await call('GET', 'overview')).body;
  assert.equal(o.today.new, 2, '새 사이트 수'); assert.equal(o.uploads.paused, false);
});

test('공지: 만들기·고치기·끄기, 대상·기간에 맞는 것만 내보냄, 감사 기록', async () => {
  const { call } = gate();
  const now = Date.now();
  const mk = (b) => call('POST', 'notice', { title: '점검', body: '본문', targets: ['app'], who: 'op@example.com', ...b });
  assert.equal((await mk({ title: '' })).status, 400);
  assert.equal((await mk({ link: 'javascript:alert(1)' })).status, 400);
  const a = (await mk({ link: 'https://github.com/yoorrard/lecpage', linkLabel: '알아보기' })).body.id;
  const b = (await mk({ title: '강사용', targets: ['teacher'] })).body.id;
  await mk({ title: '나중', starts: now + 864e5, ends: now + 2 * 864e5 });
  await mk({ title: '꺼 둠', active: false });
  const app = (await call('GET', 'notices?for=app')).body.notices;
  assert.deepEqual(app.map((n) => n.title), ['점검']);
  assert.deepEqual(app[0], { id: `n${a}-1`, title: '점검', body: '본문', ends: app[0].ends, link: 'https://github.com/yoorrard/lecpage', linkLabel: '알아보기', linkHost: 'github.com' });
  assert.deepEqual((await call('GET', 'notices?for=teacher')).body.notices.map((n) => n.title), ['강사용']);
  // 고치면 rev가 올라 앱이 다시 보여 줌(id가 바뀜)
  assert.equal((await mk({ id: a, title: '점검(고침)' })).status, 200);
  assert.equal((await call('GET', 'notices?for=app')).body.notices[0].id, `n${a}-2`);
  assert.equal((await mk({ id: 9999 })).status, 404);
  assert.equal((await call('POST', 'notice-off', { id: b, who: 'op@example.com' })).status, 200);
  assert.deepEqual((await call('GET', 'notices?for=teacher')).body.notices, []);
  const all = (await call('GET', 'admin-notices')).body;
  assert.equal(all.notices.length, 4); assert.equal(all.limits.title, 60);
  const audit = (await call('GET', 'audit')).body.audit.map((x) => x.action);
  assert.deepEqual(audit, ['notice.off', 'notice.update', 'notice.create', 'notice.create', 'notice.create', 'notice.create']);
  assert.equal((await call('POST', 'audit', { who: 'x', action: 'DROP TABLE' })).status, 400, '감사 기록 형식');
});

test('신고: 처리 상태와 사이트 상태를 같이, 처리하면 감사 기록', async () => {
  const { call } = gate();
  await reserve(call, 'dddddddddd');
  const r1 = (await call('POST', 'report', { ip: '198.51.100.1', site: 'dddddddddd', reason: '저작권', contact: '' })).body.n;
  await call('POST', 'report', { ip: '198.51.100.2', site: 'eeeeeeeeee', reason: '없는 사이트', contact: '' });
  await call('POST', 'site', { id: 'dddddddddd', blocked: true });
  let list = (await call('GET', 'reports')).body.reports;
  assert.deepEqual(list.map((r) => [r.site, r.status, r.siteState]), [['eeeeeeeeee', 'open', 'gone'], ['dddddddddd', 'open', 'blocked']]);
  assert.equal((await call('POST', 'report-status', { n: r1, status: 'weird' })).status, 400);
  assert.equal((await call('POST', 'report-status', { n: 999, status: 'done' })).status, 404);
  assert.equal((await call('POST', 'report-status', { n: r1, status: 'done', who: 'op@example.com' })).status, 200);
  list = (await call('GET', 'reports?status=open')).body.reports;
  assert.deepEqual(list.map((r) => r.site), ['eeeeeeeeee']);
  const o = (await call('GET', 'overview')).body;
  assert.equal(o.reports.open, 1); assert.equal(o.sites.blocked, 1); assert.equal(o.today.rep, 2);
  assert.equal((await call('GET', 'audit')).body.audit[0].action, 'report.done');
});

test('사이트 목록: 제목·주소로 찾기(LIKE 특수 글자는 글자로), 공개 수', async () => {
  const { call } = gate();
  await reserve(call, 'ffffffffff');
  await call('POST', 'reserve', { ip: '203.0.113.9', id: 'gggggggggg', created: Date.now(), expires: Date.now() + 864e5, title: '100%_특별 연수' });
  await call('POST', 'site', { id: 'gggggggggg', bytes: 5000, published: true });
  assert.deepEqual((await call('GET', 'sites?q=fff')).body.sites.map((s) => s.id), ['ffffffffff']);
  assert.deepEqual((await call('GET', 'sites?q=100%25_')).body.sites.map((s) => s.id), ['gggggggggg']);
  assert.deepEqual((await call('GET', 'sites?q=%25')).body.sites.map((s) => s.id), ['gggggggggg'], '% 하나는 모든 것이 아니라 글자 %');
  const o = (await call('GET', 'overview')).body;
  assert.equal(o.today.pub, 1); assert.equal(o.sites.alive, 2); assert.equal(o.sites.published, 1); assert.equal(o.sites.bytes, 5000);
});

test('저장량 알림: 상한의 80%를 넘으면 하루 한 번', async () => {
  const { call } = gate({ MAX_TOTAL_BYTES: 10000 });
  await reserve(call, 'hhhhhhhhhh');
  await call('POST', 'site', { id: 'hhhhhhhhhh', bytes: 7000 });
  assert.equal(sent.length, 0);
  await call('POST', 'site', { id: 'hhhhhhhhhh', bytes: 8500 });
  assert.equal(sent.length, 1); assert.match(sent[0].body.text, /저장량이 상한의 85%/);
  await call('POST', 'site', { id: 'hhhhhhhhhh', bytes: 9000 });
  assert.equal(sent.length, 1, '같은 날 한 번');
});
