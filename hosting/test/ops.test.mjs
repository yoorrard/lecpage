// 운영 신뢰성: 운영자가 지켜보지 않아도 '알림이 오지 않으면 할 일 없음'이 되게 하는 장치들.
//  - 지우기: Pages API가 막혀도 '지웠어요'로 끝나지 않고 '지우는 중'(202)으로 남아 알람으로 다시(1분·10분…), 끝나면 기록까지 지움
//  - 알람 처리가 실패하면 1시간 뒤로 스스로 다시(공식 재시도 6번이 몇 분 안에 끝나도)
//  - 하루 점검(cron → Gate daily): 처리 안 된 신고·가린 지 25일·지우지 못한 사이트·AI 정보 파일 묵음을 웹훅 하나로, 월요일엔 주간 요약
//  - 신고 웹훅에는 번호·처리 링크만(내용·연락처는 보내지 않음), 저장 공간 여유, Pages _headers 100규칙, 이미 열린 SSE 닫기
// Durable Object는 흉내(test/fake-do.mjs), Pages API는 흉내 서버(test/fake-cf.mjs)로 돌립니다. 실제 workerd는 *.integration.test.mjs.
import { test, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { fakeCtx, fakeNamespace } from './fake-do.mjs';
import { startFakeCf, ACCOUNT, TOKEN } from './fake-cf.mjs';

const { Gate, BLOCK_WARN_DAYS } = await import('../src/gate.js');
const { Site, WIPE_RETRY_MS } = await import('../src/site.js');
const { Room } = await import('../src/room.js');
const { headerRules, headersFile, PAGES_HEADER_RULES } = await import('../src/pages-site.js');
const worker = (await import('../src/index.js')).default;

const DAY = 864e5; const HOUR = 3600e3; const MB = 1024 * 1024;
const sha = (s) => createHash('sha256').update(s).digest('hex');
const HOOK = 'https://hooks.example/alert';
const CAT = 'https://app.example/ai-catalog.json';
const ADMIN = 'https://admin.example/admin/';
const TUE = Date.parse('2026-11-17T00:07:00Z'); // 한국 화요일 오전 9시 7분(cron)
const MON = Date.parse('2026-11-16T00:07:00Z');
const ymd = (t) => new Date(t).toISOString().slice(0, 10);

// ── 바깥 요청 흉내: 웹훅(보낸 글 모음)·AI 정보 파일. 그 밖(흉내 Pages 서버)은 진짜로 ──
let sent; let hookStatus; let catalog; let realFetch;
beforeEach(() => {
  sent = []; hookStatus = 200; catalog = { status: 200, body: null, throw: false };
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url instanceof Request ? url.url : url);
    if (u.startsWith('https://hooks.example/')) { sent.push({ url: u, body: JSON.parse(init.body) }); return new Response('ok', { status: hookStatus }); }
    if (u === CAT) {
      if (catalog.throw) throw new TypeError('fetch failed');
      return new Response(JSON.stringify(catalog.body), { status: catalog.status, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(url, init);
  };
});
afterEach(() => { globalThis.fetch = realFetch; });

function gate(env = {}) {
  const ctx = fakeCtx(); const waits = [];
  ctx.waitUntil = (p) => waits.push(p);
  const g = new Gate(ctx, { DAILY_REQUEST_BUDGET: 1000, ALERT_WEBHOOK: HOOK, ADMIN_URL: ADMIN, CATALOG_URL: CAT, ...env });
  const call = async (method, op, body) => {
    const res = await g.fetch(new Request(`http://gate/${op}`, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }));
    return { status: res.status, body: await res.json() };
  };
  return { g, ctx, call, settle: () => Promise.all(waits.splice(0)) };
}
const reserve = (call, id, o = {}) => call('POST', 'reserve', { ip: '203.0.113.7', id, created: Date.now(), expires: Date.now() + 30 * DAY, title: `사이트 ${id}`, ...o });

// ── 하루 점검 ───────────────────────────────────────────────────
test('하루 점검: 처리 안 된 신고·가린 지 25일·지우지 못한 사이트·AI 정보 파일 묵음을 웹훅 하나로. 같은 날 두 번 불러도 한 번', async () => {
  const { g, ctx, call } = gate();
  await reserve(call, 'aaaaaaaaaa'); await reserve(call, 'bbbbbbbbbb');
  await call('POST', 'site', { id: 'aaaaaaaaaa', blocked: true });
  ctx.sql.exec('UPDATE sites SET blocked_at = ? WHERE id = ?', TUE - (BLOCK_WARN_DAYS + 1) * DAY, 'aaaaaaaaaa');
  await call('POST', 'report', { ip: '198.51.100.1', site: 'aaaaaaaaaa', reason: '저작권', contact: 'x@example.com' });
  ctx.sql.exec('UPDATE reports SET at = ?', TUE - 3 * DAY - HOUR);
  await call('POST', 'site', { id: 'bbbbbbbbbb', bytes: 0, wiping: TUE - 7 * HOUR });
  catalog.body = { schema: 1, updated: ymd(TUE - 9 * DAY), checked: ymd(TUE - 5 * DAY) };
  const r = await g.daily(TUE);
  assert.equal(r.sent, true); assert.equal(r.weekly, false);
  assert.equal(sent.length, 1, '웹훅은 한 번에 하나');
  const text = sent[0].body.text;
  assert.equal(sent[0].body.content, text, 'Slack(text)·Discord(content)');
  assert.match(text, /^\[lecpage 바로 배포\] 확인할 일 4가지/);
  assert.match(text, /처리 안 된 신고 1건\(가장 오래된 것 4일째\)/);
  assert.match(text, /가린 지 25일 넘은 사이트 1개\(가장 오래된 것 27일째\)\. 가린 날부터 30일 안에/);
  assert.match(text, /지우지 못한 사이트 1개\(Cloudflare Pages에 배포가 남음, 가장 오래된 것 7시간째/);
  assert.match(text, /AI 정보 파일이 5일째 그대로예요\(마지막 확인 2026-11-12\)/);
  assert.ok(text.endsWith(`관리 화면 ${ADMIN}`));
  assert.ok(!text.includes('x@example.com') && !text.includes('저작권'), '신고 내용·연락처는 보내지 않음');
  // 같은 날 다시(cron과 Gate 알람이 겹쳐도): 보내지 않음
  assert.equal((await g.daily(TUE + HOUR)).again, true);
  assert.equal(sent.length, 1);
  // 다음 날: 신고·가림·AI는 다시 알리고, 지우는 중은 사이트마다 한 번만(관리 화면에는 계속 보임)
  await g.daily(TUE + DAY);
  assert.equal(sent.length, 2);
  assert.match(sent[1].body.text, /확인할 일 3가지/); assert.ok(!/지우지 못한/.test(sent[1].body.text));
  assert.deepEqual(g.opsLines(TUE + DAY).map((x) => x.k), ['reports', 'blocked', 'wiping', 'catalog'], '관리 화면에는 지우는 중도 계속');
  const ops = (await call('GET', 'overview')).body.ops;
  assert.equal(ops.last.sent, true); assert.equal(ops.catalog.age, 5 + 1);
});

test('하루 점검: 월요일에는 이상이 없어도 주간 요약(웹훅이 살아 있다는 표시), 웹훅이 없으면 관리 화면에만', async () => {
  const { g, call } = gate();
  await reserve(call, 'cccccccccc');
  await call('POST', 'tick', { n: 120 });
  catalog.body = { schema: 1, updated: ymd(MON - 20 * DAY), checked: ymd(MON - DAY) };
  assert.equal((await g.daily(MON - DAY)).sent, false, '일요일·이상 없음: 보내지 않음');
  const r = await g.daily(MON);
  assert.equal(r.weekly, true); assert.equal(sent.length, 1);
  assert.match(sent[0].body.text, /^\[lecpage 바로 배포\] 주간 점검: 지난 7일 가장 바쁜 날 하루 예산의 \d+% · 새 사이트 \d+개 · 저장 0% · 신고 대기 0 · 가린 사이트 0 · 지우는 중 0\. 월요일마다 이 알림이 오면/);
  // 웹훅이 없음: 보내지 않지만 같은 글이 관리 화면에
  const quiet = gate({ ALERT_WEBHOOK: undefined });
  await reserve(quiet.call, 'dddddddddd');
  await quiet.call('POST', 'report', { ip: '198.51.100.9', site: 'dddddddddd', reason: '사칭', contact: '' });
  quiet.ctx.sql.exec('UPDATE reports SET at = ?', Date.now() - 2 * DAY);
  catalog.body = { schema: 1, updated: ymd(Date.now()) };
  const q = await quiet.g.daily(Date.now());
  assert.equal(q.sent, false); assert.equal(sent.length, 1);
  const o = (await quiet.call('GET', 'overview')).body;
  assert.equal(o.alerts.webhook, false);
  assert.match(o.ops.lines[0].text, /처리 안 된 신고 1건/);
});

test('하루 점검: AI 정보 파일을 한 번 못 받으면 넘기고, 이틀 연달아면 알림. 웹훅이 실패하면 관리 화면에 보임', async () => {
  const { g, call, settle } = gate();
  catalog.throw = true;
  await g.daily(TUE);
  assert.equal(sent.length, 0, '한 번 끊김은 알리지 않음');
  await g.daily(TUE + DAY);
  assert.equal(sent.length, 1); assert.match(sent[0].body.text, /AI 정보 파일을 2일째 받지 못했어요\(닿지 못함\): https:\/\/app\.example\/ai-catalog\.json/);
  catalog.throw = false; catalog.body = { schema: 1, updated: ymd(TUE + 2 * DAY) };
  hookStatus = 500;
  await g.daily(TUE + 2 * DAY); // 이상 없음 → 보내지 않음
  assert.equal(sent.length, 1);
  catalog.body = { schema: 1, updated: ymd(TUE + 6 * DAY) };
  await g.daily(TUE + 6 * DAY); // 월요일: 주간 요약을 보내다 실패
  await settle();
  const lines = (await call('GET', 'overview')).body.ops.lines;
  assert.ok(lines.some((x) => x.k === 'webhook' && /알림 웹훅을 보내지 못했어요\(.* · 응답 500\)/.test(x.text)), JSON.stringify(lines));
  assert.ok(!lines.some((x) => x.k === 'catalog'), '다시 받았으면 사라짐');
});

test('하루 점검: 기간이 하루 넘게 지났는데 목록에 남은 사이트는 그 사이트에 다시 지우라고 하고, 없어졌으면 목록에서 뺌(사이트 알람이 사라졌을 때)', async () => {
  const SITE = fakeNamespace(({ name, path }) => (path === '/expire' ? { gone: name !== 'ffffffffff' } : { ok: true }));
  const { g, call } = gate({ SITE });
  await reserve(call, 'eeeeeeeeee', { expires: Date.now() - 2 * DAY });
  await reserve(call, 'ffffffffff', { expires: Date.now() - 2 * DAY });
  await reserve(call, 'gggggggggg', { expires: Date.now() - HOUR }); // 아직 하루가 안 지남: 사이트 알람 몫
  await call('POST', 'site', { id: 'hhhhhhhhhh', wiping: 1 }); // 없는 줄은 무시
  const r = await g.daily(Date.now());
  assert.equal(r.swept, 1);
  assert.deepEqual(SITE.calls.map((c) => c.name).sort(), ['eeeeeeeeee', 'ffffffffff']);
  const ids = (await call('GET', 'sites')).body.sites.map((s) => s.id).sort();
  assert.deepEqual(ids, ['ffffffffff', 'gggggggggg'], '아직 지우지 못한 것은 남겨 두고 내일 다시');
});

test('Gate 알람: 하루 점검의 예비(cron이 26시간 넘게 안 오면), 실패해도 다음 알람은 다시 잡음', async () => {
  const { g, ctx } = gate();
  catalog.body = { schema: 1, updated: ymd(Date.now()) };
  await g.daily(Date.now() - 2 * HOUR, 'cron');
  await g.alarm();
  assert.ok(ctx.alarm > Date.now() + 23 * HOUR, '다음 날 알람');
  g.kvSet('cron', Date.now() - 30 * HOUR);
  g.kvSet('ops', { day: 0 });
  await g.alarm();
  assert.equal(g.kvGet('ops').via, 'alarm', 'cron이 오지 않으면 알람이 점검까지');
  g.housekeep = () => { throw new Error('DO 한도'); };
  ctx.storage.setAlarm(0);
  await g.alarm();
  assert.ok(ctx.alarm > Date.now() + 23 * HOUR, '실패해도 다음 알람');
});

test('가린 때: 가리면 적고 풀면 지움, 관리 화면 목록에 보임. 예전 판에서 가린 사이트는 감사 기록의 가린 때로', async () => {
  const { call } = gate();
  await reserve(call, 'jjjjjjjjjj');
  await call('POST', 'site', { id: 'jjjjjjjjjj', blocked: true });
  let s = (await call('GET', 'sites')).body.sites[0];
  assert.ok(s.blocked && Math.abs(s.blockedAt - Date.now()) < 5000);
  const at = s.blockedAt;
  await call('POST', 'site', { id: 'jjjjjjjjjj', bytes: 10 });
  assert.equal((await call('GET', 'sites')).body.sites[0].blockedAt, at, '다른 값을 바꿔도 가린 때는 그대로');
  await call('POST', 'site', { id: 'jjjjjjjjjj', blocked: false });
  s = (await call('GET', 'sites')).body.sites[0];
  assert.deepEqual([s.blocked, s.blockedAt], [false, 0]);
  // 예전 표(blocked_at 칸이 없음): 감사 기록의 마지막 가림 때를 가린 때로
  const ctx = fakeCtx();
  ctx.sql.exec(`CREATE TABLE sites (id TEXT PRIMARY KEY, bytes INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, expires INTEGER NOT NULL, blocked INTEGER NOT NULL DEFAULT 0, room_bytes INTEGER NOT NULL DEFAULT 0, code TEXT NOT NULL DEFAULT '') WITHOUT ROWID;
    CREATE TABLE audit (n INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, who TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL DEFAULT '', detail TEXT NOT NULL DEFAULT '');`);
  ctx.sql.exec('INSERT INTO sites (id, created, expires, blocked) VALUES (?, ?, ?, 1)', 'kkkkkkkkkk', 1, Date.now() + DAY);
  ctx.sql.exec("INSERT INTO audit (at, who, action, target) VALUES (?, 'op', 'site.block', 'kkkkkkkkkk')", 1234567);
  const old = new Gate(ctx, {});
  assert.equal(old.sites('')[0].blockedAt, 1234567);
});

test('저장 공간: 남은 자리가 사이트 하나의 최대 크기보다 작으면 새 사이트를 받지 않음(/api/info가 미리 알림, 만든 뒤 507로 빈 사이트가 남지 않게)', async () => {
  const { call } = gate({ MAX_TOTAL_BYTES: 200 * MB, MAX_BYTES: 40 * MB });
  await reserve(call, 'mmmmmmmmmm');
  await call('POST', 'site', { id: 'mmmmmmmmmm', bytes: 197 * MB });
  let st = (await call('GET', 'status')).body;
  assert.deepEqual([st.accepting, st.capacity.state], [true, 'open'], '아직 2MB(1% 여유) 넘게 남음');
  await call('POST', 'site', { id: 'mmmmmmmmmm', bytes: 199 * MB });
  st = (await call('GET', 'status')).body;
  assert.deepEqual([st.accepting, st.capacity.state, st.capacity.reason], [false, 'full', 'storage']);
  const r = await reserve(call, 'nnnnnnnnnn');
  assert.equal(r.status, 507); assert.equal(r.body.error.code, 'full'); assert.equal(r.body.error.reason, 'storage');
});

test('방이 깨어 있던 시간을 알리면 Gate가 오늘 DO duration 몫을 돌려줌. 횟수 기록(해시한 IP)은 한 시간에 한 번 지움', async () => {
  const { g, call, ctx } = gate();
  const r = await call('POST', 'site', { id: '', aw: 60000 });
  assert.ok(r.body.gbsPct > 57 && r.body.gbsPct < 58, String(r.body.gbsPct));
  assert.equal((await gate({ PLAN: 'paid', DAILY_REQUEST_BUDGET: '0' }).call('POST', 'site', { id: '', aw: 60000 })).body.gbsPct, undefined, '예산이 없으면 보내지 않음');
  ctx.sql.exec("INSERT INTO rl (k, n, exp) VALUES ('site:d:old:1', 1, ?)", Date.now() - 1000);
  g.purgedHour = Math.floor(Date.now() / HOUR) - 1;
  await call('POST', 'tick', { n: 1 });
  assert.equal(ctx.sql.exec('SELECT COUNT(*) AS n FROM rl WHERE exp < ?', Date.now()).one().n, 0);
});

// ── 신고 웹훅·cron ──────────────────────────────────────────────
test('신고 웹훅에는 번호와 처리 링크만(내용·연락처는 메신저로 보내지 않음). cron은 Gate 하루 점검을 부름', async () => {
  const GATE = fakeNamespace(({ path }) => (path === '/report' ? { ok: true, n: 7, at: 1 } : { ok: true }));
  const env = { GATE, SITE: fakeNamespace(() => ({})), ROOM: fakeNamespace(() => ({})), GUARD: fakeNamespace(() => ({})), REPORT_WEBHOOK: 'https://hooks.example/report', ADMIN_URL: ADMIN };
  const jobs = []; const ctx = { waitUntil: (p) => jobs.push(p) };
  const res = await worker.fetch(new Request('https://host.example/api/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ site: 'abcdefghjk', reason: '내 얼굴 사진을 허락 없이 올렸어요', contact: '010-0000-0000 me@example.com' }) }), env, ctx);
  await Promise.all(jobs);
  assert.equal(res.status, 200);
  const hook = sent.find((x) => x.url === 'https://hooks.example/report');
  assert.ok(hook);
  assert.equal(hook.body.text, `[lecpage 바로 배포] 신고 #7이 들어왔어요. 지체 없이 확인해 주세요: ${ADMIN}#reports`);
  const all = JSON.stringify(hook.body);
  assert.ok(!all.includes('사진') && !all.includes('me@example.com') && !all.includes('010') && !all.includes('abcdefghjk'), all);
  assert.ok(GATE.calls.some((c) => c.path === '/report' && c.body.contact.includes('me@example.com')), '내용·연락처는 Gate에만(90일)');
  jobs.length = 0;
  await worker.scheduled({ scheduledTime: 5 }, env, ctx);
  await Promise.all(jobs);
  assert.ok(GATE.calls.some((c) => c.path === '/daily' && c.method === 'POST'));
});

// ── 사이트 지우기(흉내 Pages API) ────────────────────────────────
let cf;
after(async () => { if (cf) await cf.stop(); });
async function pagesSite({ expires = Date.now() + 30 * DAY } = {}) {
  cf ||= await startFakeCf();
  cf.state.tokenOk = true;
  const ctx = fakeCtx(); ctx.waitUntil = () => { };
  const GATE = fakeNamespace(({ path }) => (path === '/deploy-check' ? { sites: 1, bytes: 0, paused: false } : { ok: true, total: 0 }));
  const env = {
    VIEW: 'pages', CF_ACCOUNT_ID: ACCOUNT, PAGES_PROJECT: 'lecpage-view', PAGES_TOKEN: TOKEN, PAGES_HOST: `127.0.0.1:${cf.port}`,
    PAGES_SITE_URL: `${cf.url}/__view/{branch}/`, CF_API_BASE: cf.api, GATE, ROOM: fakeNamespace(() => ({ ok: true })),
  };
  const site = new Site(ctx, env);
  const id = Array.from({ length: 10 }, () => 'abcdefghjk'[Math.floor(Math.random() * 10)]).join('');
  const key = randomUUID() + randomUUID();
  const init = await site.fetch(new Request('http://site/init', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, keyHash: sha(key), title: '시험', created: Date.now(), expires, view: 'pages' }) }));
  assert.equal(init.status, 200);
  // 이미 공개한 사이트처럼: 흉내 Pages에 이 브랜치 배포 둘(지난 것·지금 것)
  const mk = () => { const d = { id: randomUUID(), branch: `s-${id}`, manifest: { '/index.html': 'x' }, headers: '', redirects: '', project: 'lecpage-view', created: Date.now() + cf.state.deployments.size }; cf.state.deployments.set(d.id, d); return d.id; };
  const old = mk(); const cur = mk();
  site.savePs(site.load(), { url: `${cf.url}/__view/s-${id}/`, deps: [cur], hold: [old], man: null });
  const auth = { authorization: `Bearer ${key}` };
  const req = (method, op, body) => site.fetch(new Request(`http://site/${op}`, { method, headers: { ...auth, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }));
  return { site, ctx, GATE, id, key, req, branch: () => cf.deploymentsOf(`s-${id}`) };
}

test('지우기: Pages API가 막히면 204로 속이지 않고 202 "지우는 중" → 그동안 고치기·두 번째 주소는 닫힘 → 알람으로 다시(1분·10분…) → 풀리면 다 지우고 기록도 지움', async () => {
  const { site, ctx, GATE, id, req, branch } = await pagesSite();
  cf.state.tokenOk = false; // Pages API가 모두 403
  const t0 = Date.now();
  const r = await req('DELETE', 'site');
  assert.equal(r.status, 202);
  const j = await r.json();
  assert.equal(j.state, 'wiping'); assert.match(j.message_ko, /내리는 중이에요/);
  assert.equal(branch().length, 2, 'Pages에는 아직 남음(그래서 성공이라고 하지 않음)');
  assert.ok(Math.abs(ctx.alarm - (t0 + WIPE_RETRY_MS[0])) < 5000, '1분 뒤 다시');
  assert.ok(GATE.calls.some((c) => c.path === '/site' && c.body.id === id && c.body.wiping > 0 && c.body.bytes === 0), 'Gate에 지우는 중으로 알림(관리 화면·하루 점검)');
  assert.ok(!GATE.calls.some((c) => c.path === '/forget'), '아직 목록에서 빼지 않음');
  // 그동안: 두 번째 주소·방 상태·고치기는 이미 지운 사이트처럼
  assert.equal((await site.fetch(new Request('http://site/file?p=index.html'))).headers.get('x-lp-state'), 'gone');
  assert.equal((await (await site.fetch(new Request(`http://site/live-status?code=X`))).json()).alive, false);
  assert.equal((await req('POST', 'deploys', { files: { 'index.html': { sha256: sha('a'), size: 1 } } })).status, 404);
  assert.equal((await site.fetch(new Request('http://site/admin-block', { method: 'POST', body: JSON.stringify({ blocked: true }) }))).status, 409);
  // 강사가 다시 눌러도 같은 답(그때 한 번 더 해 봄), 알람은 뒤로 갈수록 길게
  assert.equal((await req('DELETE', 'site')).status, 202);
  await site.alarm();
  assert.ok(Math.abs(ctx.alarm - (Date.now() + WIPE_RETRY_MS[2])) < 5000, '세 번째는 1시간 뒤');
  assert.equal(site.wiping().n, 3);
  // 풀림 → 다음 알람에 다 지움
  cf.state.tokenOk = true;
  await site.alarm();
  assert.equal(branch().length, 0, 'Pages 배포가 모두 지워짐');
  assert.equal(site.load(), null, '기록도 지움');
  assert.ok(GATE.calls.some((c) => c.path === '/forget' && c.body.id === id));
  assert.equal((await req('DELETE', 'site')).status, 404);
});

test('보관 기간 끝: Pages API가 막혀 있으면 지우는 중으로 두었다가, 풀리면 "보관 기간이 끝났어요" 안내 하나만 남김', async () => {
  const { site, GATE, req, branch } = await pagesSite({ expires: Date.now() - 1000 });
  cf.state.tokenOk = false;
  await site.alarm();
  assert.ok(site.wiping()?.expired, '지우는 중(기간 끝)');
  assert.equal(branch().length, 2);
  cf.state.tokenOk = true;
  await site.alarm();
  const left = branch();
  assert.equal(left.length, 1, '안내 화면 하나만');
  assert.deepEqual(Object.keys(left[0].manifest).sort(), ['/404.html', '/index.html']);
  assert.equal(site.load(), null);
  assert.ok(GATE.calls.some((c) => c.path === '/forget'));
  assert.equal((await req('DELETE', 'site')).status, 404);
});

test('알람 처리가 실패하면 1시간 뒤로 스스로 다시 잡음(공식 재시도는 몇 분 안에 끝남). Gate 하루 점검의 expire도 같은 길', async () => {
  const ctx = fakeCtx(); ctx.waitUntil = () => { };
  const GATE = fakeNamespace(() => ({ ok: true }));
  const site = new Site(ctx, { GATE, ROOM: fakeNamespace(() => ({ ok: true })) });
  await site.fetch(new Request('http://site/init', { method: 'POST', body: JSON.stringify({ id: 'qqqqqqqqqq', keyHash: sha('k'), title: '', created: 1, expires: Date.now() - 1000, view: 'worker' }) }));
  const real = ctx.storage.deleteAll;
  ctx.storage.deleteAll = async () => { throw new Error('Exceeded allowed rows written'); };
  await site.alarm(); // 던지지 않음
  assert.ok(Math.abs(ctx.alarm - (Date.now() + HOUR)) < 5000);
  ctx.storage.deleteAll = real;
  const r = await (await site.fetch(new Request('http://site/expire', { method: 'POST' }))).json();
  assert.equal(r.gone, true);
  assert.equal(site.load(), null);
});

test('저장 공간이 배포 직전에 차면(507) 방금 만든 빈 사이트 기록을 남기지 않음. 이미 배포한 사이트는 그대로', async () => {
  const ctx = fakeCtx(); ctx.waitUntil = () => { };
  const GATE = fakeNamespace(({ path }) => (path === '/deploy-check' ? { sites: 9, bytes: 4096 * MB, paused: false } : { ok: true }));
  const site = new Site(ctx, { GATE, ROOM: fakeNamespace(() => ({ ok: true })) });
  const key = 'key-' + randomUUID();
  await site.fetch(new Request('http://site/init', { method: 'POST', body: JSON.stringify({ id: 'rrrrrrrrrr', keyHash: sha(key), title: '', created: 1, expires: Date.now() + DAY, view: 'worker' }) }));
  const r = await site.fetch(new Request('http://site/deploys', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ files: { 'index.html': { sha256: sha('<p>'), size: 3 } } }) }));
  assert.equal(r.status, 507); assert.equal((await r.json()).error.code, 'full');
  assert.equal(site.load(), null, '빈 사이트는 지움');
  assert.ok(GATE.calls.some((c) => c.path === '/forget' && c.body.id === 'rrrrrrrrrr'));
});

// ── Pages _headers 100규칙 ───────────────────────────────────────
test('Pages _headers: 보안 규칙을 앞에, 보통 사이트는 100개 한참 아래. 확장자 대소문자를 수십 가지로 늘리면 올리기 전에 거절', async () => {
  const normal = ['index.html', 'console.html', 'screen.html', 'poster.html', 'assets/a.css', 'assets/lecpage.js', 'assets/x.svg', 'assets/y.SVG', 'assets/files/명단.csv', 'assets/files/자료.PDF', 'assets/files/슬라이드.pptx', 'assets/files/양식.HWP', 'site.webmanifest'];
  const rules = headerRules(normal);
  assert.ok(rules.length < 25, String(rules.length));
  const pats = rules.map((r) => r[0]);
  assert.equal(pats[0], '/*');
  assert.ok(pats.indexOf('/console') < pats.indexOf('/*.css') && pats.indexOf('/*.SVG') < pats.indexOf('/*.css'), '틀 막기·SVG 가둠이 앞');
  assert.match(headersFile(normal), /^\/\*\n {2}! Access-Control-Allow-Origin\n/);
  // 128가지 대소문자(앞 점검 a4: 151파일 → 139규칙, 100 넘는 39개가 버려질 자리)
  const variants = []; for (let i = 0; i < 128; i++) variants.push([...'numbers'].map((c, k) => ((i >> k) & 1 ? c.toUpperCase() : c)).join(''));
  const evil = ['index.html', 'assets/x.svg', ...variants.slice(0, 120).map((v, i) => `assets/files/f${i}.${v}`)];
  assert.ok(headerRules(evil).length > PAGES_HEADER_RULES);
  assert.throws(() => headersFile(evil), /한도/);
  const { req } = await pagesSite();
  const files = Object.fromEntries(evil.map((p, i) => [p, { sha256: sha(`f${i}`), size: 1 }]));
  const r = await req('POST', 'deploys', { files });
  assert.equal(r.status, 400);
  const e = (await r.json()).error;
  assert.equal(e.code, 'bad_path'); assert.match(e.message_ko, /소문자로 맞춰/);
});

// ── 이미 열린 SSE ───────────────────────────────────────────────
test('방: 오늘 DO duration이 60%를 넘었다고 들으면 이미 열린 SSE도 닫음(런타임이 긴 대기로 내려감). 정리 알람이 실패해도 1시간 뒤 다시', async () => {
  const make = (gbsPct) => {
    const ctx = fakeCtx(); const jobs = []; ctx.waitUntil = (p) => jobs.push(p);
    const GATE = fakeNamespace(() => ({ ok: true, total: 0, gbsPct }));
    const room = new Room(ctx, { GATE, SITE: fakeNamespace(() => ({ ok: true })) });
    room.hostBind.set({ site: 'abcdefghjk', code: 'SSE123', expires: Date.now() + DAY });
    let closed = 0;
    const entry = { w: { write: async () => { }, close: async () => { closed++; } }, ip: '' };
    room.sse.add(entry);
    room.awake(Date.now() - 11 * 60e3); room.awake(Date.now()); // 10분 넘게 깨어 있음 → Gate에 알림
    return { room, ctx, jobs, closed: () => closed };
  };
  const busy = make(72);
  await Promise.all(busy.jobs);
  assert.equal(busy.closed(), 1); assert.equal(busy.room.sse.size, 0);
  const calm = make(30);
  await Promise.all(calm.jobs);
  assert.equal(calm.closed(), 0); assert.equal(calm.room.sse.size, 1);
  calm.room.hostBind.get = () => { throw new Error('SQL 한도'); };
  await calm.room.alarm();
  assert.ok(Math.abs(calm.ctx.alarm - (Date.now() + HOUR)) < 5000);
});
