// 실시간 방을 호스트에 얹는 논리. Durable Object는 흉내(test/fake-do.mjs)로, 규칙 코드는 실제 것(backends/cloudflare)으로 돌립니다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fakeCtx, fakeSql, fakeNamespace } from './fake-do.mjs';
import { liveTarget, liveOriginOk, roomEnv, maxRetentionDays, HostBind, bindRoom, translate, LiveError, FILE_ALIAS } from '../src/live/host.js';
import { HttpError } from '../src/http.js';
import { config } from '../src/config.js';

const { LiveCore } = await import('../../skills/lecpage/backends/cloudflare/src/protocol.js');
const { Room } = await import('../src/room.js');

const sha = (s) => createHash('sha256').update(s).digest('hex');
const KEY = '강사키-2027-봄-연수'; const KEY2 = 'another-teacher-key-77';
const SITE = 'abcdefghjk'; const OTHER = 'zyxwvtsrqp';
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
const day = 86400000;

// ── 주소·출처 ───────────────────────────────────────────────────
test('주소 → 방: /live/api/<코드>/…, 보드 파일은 /api/<코드>/files/<이름>도', () => {
  assert.deepEqual(liveTarget('/live/api/health'), { kind: 'health' });
  assert.deepEqual(liveTarget('/live/api/q7gmcz/snapshot'), { kind: 'room', code: 'Q7GMCZ', path: '/api/q7gmcz/snapshot', op: 'snapshot' });
  assert.deepEqual(liveTarget('/live/api/Q7GMCZ/questions/abc/vote'), { kind: 'room', code: 'Q7GMCZ', path: '/api/Q7GMCZ/questions/abc/vote', op: 'questions' });
  assert.deepEqual(liveTarget('/live/api/Q7GMCZ/ws'), { kind: 'room', code: 'Q7GMCZ', path: '/api/Q7GMCZ/ws', op: 'ws' });
  assert.deepEqual(liveTarget('/live/api/Q7GMCZ'), { kind: 'room', code: 'Q7GMCZ', path: '/api/Q7GMCZ', op: '' });
  const f = '/api/Q7GMCZ/files/0123456789abcdef01234567.png';
  assert.deepEqual(liveTarget(f), { kind: 'room', code: 'Q7GMCZ', path: f, op: 'files' });
  assert.deepEqual(liveTarget('/live' + f), { kind: 'room', code: 'Q7GMCZ', path: f, op: 'files' });
  for (const p of ['/live', '/live/', '/live/x', '/livex/api/Q7GMCZ/snapshot', '/api/info', '/api/sites', '/api/sites/abcdefghjk/blobs/' + 'a'.repeat(64), '/api/q7gmcz/files/0123456789abcdef01234567.png', '/api/Q7GMCZ/files/x.svg', '/api/Q7GMCZ/files/0123456789abcdef01234567.html', '/api/Q7GMCZ/snapshot', '/api/Q7GMCZ/files/0123456789abcdef01234567.png/x']) {
    assert.equal(liveTarget(p), null, p);
  }
  assert.ok(!FILE_ALIAS.test('/api/admin/files/0123456789abcdef01234567.png'), '호스트 API(소문자)와 겹치지 않음');
  for (const p of ['/live/api/a/snapshot', '/live/api/%zz/snapshot', '/live/api/ab cd/snapshot', '/live/api/' + 'A'.repeat(41) + '/x', '/live/api//x']) {
    assert.throws(() => liveTarget(p), (e) => e instanceof LiveError && e.status === 400 && e.code === 'bad_code', p);
  }
  // 방 등록(init)은 밖에서 부를 수 없음
  assert.throws(() => liveTarget('/live/api/Q7GMCZ/init'), (e) => e instanceof LiveError && e.status === 404);
});

test('출처: 이 호스트의 사이트(또는 브라우저가 아닌 곳)만 쓰기·실시간 연결', () => {
  const self = 'https://sites.example';
  assert.ok(liveOriginOk({ method: 'POST', op: 'join', origin: self, self }));
  assert.ok(liveOriginOk({ method: 'POST', op: 'join', origin: null, self }));
  assert.ok(liveOriginOk({ method: 'GET', op: 'ws', origin: self, self }));
  assert.ok(liveOriginOk({ method: 'GET', op: 'snapshot', origin: 'https://evil.example', self }), '읽기는 규칙대로 받음(다른 출처는 응답을 못 읽음)');
  assert.ok(!liveOriginOk({ method: 'GET', op: 'ws', origin: 'https://evil.example', self }));
  assert.ok(!liveOriginOk({ method: 'POST', op: 'questions', origin: 'https://evil.example', self }));
  assert.ok(!liveOriginOk({ method: 'DELETE', op: '', origin: 'null', self }));
  assert.ok(!liveOriginOk({ method: 'POST', op: 'upload', origin: 'https://sites.example.evil.example', self }));
});

test('방에 넘기는 환경: 운영자 열쇠는 넘어가지 않고, 코드가 저절로 생기는 방식은 꺼 둠', () => {
  const env = { ADMIN_KEY: 'operator-admin-key-0001', ADMIN_KEY_HASH: sha('x'), SETUP_TOKEN: 'from-outside', OPEN_INIT: 'true', ALLOWED_CODES: 'AB12CD', ALLOWED_ORIGINS: 'https://a', REPORT_WEBHOOK: 'https://hook', GUARD: { g: 1 }, UPLOADS: { r2: 1 }, SITE_DAYS: '14' };
  const up = { shim: 1 };
  const r = roomEnv(env, config(env), { uploads: up, setupToken: 'inner-token' });
  assert.deepEqual(Object.keys(r).sort(), ['ALLOWED_CODES', 'GUARD', 'MAX_PARTICIPANTS', 'MAX_SOCKETS_PER_IP', 'MAX_UPLOAD_MB', 'OPEN_INIT', 'RETENTION_DAYS', 'SETUP_TOKEN', 'UPLOADS']);
  assert.equal(r.ADMIN_KEY, undefined); assert.equal(r.ADMIN_KEY_HASH, undefined);
  assert.equal(r.SETUP_TOKEN, 'inner-token'); assert.equal(r.OPEN_INIT, 'false'); assert.equal(r.ALLOWED_CODES, '');
  assert.equal(r.GUARD, env.GUARD); assert.equal(r.UPLOADS, up);
  assert.equal(r.RETENTION_DAYS, '14'); assert.equal(r.MAX_UPLOAD_MB, '10'); assert.equal(r.MAX_PARTICIPANTS, '300'); assert.equal(r.MAX_SOCKETS_PER_IP, '500');
  assert.equal(roomEnv({ LIVE_UPLOADS: 'off' }, config({ LIVE_UPLOADS: 'off' }), { uploads: up, setupToken: 't' }).UPLOADS, undefined);
  assert.equal(maxRetentionDays(config({ SITE_DAYS: '0.5' })), 1);
  const c = config({ LIVE_MAX_UPLOAD_MB: '3', LIVE_ROOM_MB: '50', LIVE_MAX_PARTICIPANTS: '40', LIVE_SOCKETS_PER_IP: '80', DAILY_ROOM_CAP: '7' });
  assert.deepEqual([c.liveMaxUploadMb, c.liveRoomBytes, c.liveMaxParticipants, c.liveSocketsPerIp, c.dailyRoomCap], [3, 50 * 1024 * 1024, 40, 80, 7]);
  assert.equal(config({}).live, true); assert.equal(config({}).liveUploads, true); assert.equal(config({}).dailyRoomCap, 30);
  for (const v of ['off', 'OFF', '0', 'false', 'no']) { assert.equal(config({ LIVE: v }).live, false, v); assert.equal(config({ LIVE: v }).liveUploads, false); }
});

// ── 묶기(규칙 코드의 LiveCore + SQLite) ─────────────────────────
function coreOn(sql, setupToken) {
  const db = { all: (q, ...p) => sql.exec(q, ...p).toArray(), get: (q, ...p) => sql.exec(q, ...p).toArray()[0], run: (q, ...p) => { sql.exec(q, ...p); }, tx: (fn) => sql.tx(fn) };
  return new LiveCore({ db, config: { adminKeyHash: null, setupTokenHash: sha(setupToken), openInit: false, allowedCodes: null, retentionDays: 30, maxRetentionDays: 30, lazySchema: true } });
}

test('묶기: 새 방, 같은 사이트가 다시(관리자 키만 바꿈), 다른 사이트는 거절', async () => {
  const sql = fakeSql(); const bind = new HostBind(sql); const core = coreOn(sql, 'tok');
  const room = { core, bind, setupToken: 'tok', maxDays: 30 };
  assert.equal(bind.get(), null);
  assert.equal(sql.writes, 0, '묶기 전에는 아무것도 쓰지 않음');
  const exp = Date.now() + 30 * day;
  const a = await bindRoom(room, { site: SITE, code: 'ab12cd', adminKeyHash: sha(KEY), settings: { retentionDays: 365, uploads: true, moderation: true, maxUploadMb: 999, title: '<b>' }, expires: exp });
  assert.deepEqual(a, { created: true, code: 'AB12CD', settings: { retentionDays: 30, uploads: true, moderation: true } }, '보관일은 공개 기간까지만, 모르는 설정은 버림');
  assert.deepEqual({ ...bind.get() }, { site: SITE, code: 'AB12CD', expires: exp, blocked: 0 });
  assert.equal(core.trainingOrNull('AB12CD').admin_hash, sha(KEY));
  // 같은 사이트: 지금 관리자 키 없이 해시를 바꿈. settings를 안 보내면 그대로
  const b = await bindRoom(room, { site: SITE, code: 'AB12CD', adminKeyHash: sha(KEY2), expires: exp + day });
  assert.equal(b.created, false);
  assert.deepEqual(b.settings, { retentionDays: 30, uploads: true, moderation: true });
  assert.equal(core.trainingOrNull('AB12CD').admin_hash, sha(KEY2));
  assert.equal(bind.get().expires, exp + day);
  const c = await bindRoom(room, { site: SITE, code: 'AB12CD', adminKeyHash: sha(KEY2), settings: { uploads: false, retentionDays: 7 }, expires: exp });
  assert.deepEqual(c.settings, { retentionDays: 7, uploads: false, moderation: true });
  // 다른 사이트
  await assert.rejects(() => bindRoom(room, { site: OTHER, code: 'AB12CD', adminKeyHash: sha(KEY), expires: exp }), (e) => e instanceof HttpError && e.code === 'code_taken' && e.status === 409);
  assert.equal(core.trainingOrNull('AB12CD').admin_hash, sha(KEY2), '거절하면 아무것도 바뀌지 않음');
  assert.equal(bind.get().site, SITE);
});

test('묶기: 잘못된 값은 bad_request, 실패하면 묶이지 않음', async () => {
  const sql = fakeSql(); const bind = new HostBind(sql); const core = coreOn(sql, 'tok');
  const room = { core, bind, setupToken: 'tok', maxDays: 30 };
  const exp = Date.now() + day;
  const bad = [
    { code: 'AB12CD', adminKeyHash: 'nope' },
    { code: 'AB12CD', adminKeyHash: sha('change-me') }, // 예시 키
    { code: 'AB12CD', adminKeyHash: sha('admin') },
    { code: 'AB12CD', adminKeyHash: sha(KEY), settings: { retentionDays: 0 } },
    { code: 'AB12CD', adminKeyHash: sha(KEY), settings: { retentionDays: 'x' } },
    { code: 'AB12CD', adminKeyHash: sha(KEY), settings: { uploads: 'yes' } },
  ];
  for (const b of bad) {
    await assert.rejects(() => bindRoom(room, { site: SITE, expires: exp, ...b }), (e) => e instanceof HttpError && e.code === 'bad_request' && e.status === 400 && e.message.length > 3, JSON.stringify(b).slice(0, 80));
    assert.equal(bind.get(), null);
  }
  await assert.rejects(() => bindRoom(room, { site: SITE, expires: exp, code: 'a b', adminKeyHash: sha(KEY) }), (e) => e instanceof LiveError && e.code === 'bad_code');
  // 설정 토큰이 다르면(밖에서 흉내 낼 수 없음) 규칙 코드가 막음
  await assert.rejects(() => bindRoom({ ...room, setupToken: 'wrong' }, { site: SITE, expires: exp, code: 'AB12CD', adminKeyHash: sha(KEY) }), (e) => e instanceof HttpError && e.code === 'bad_request');
  assert.equal(core.trainingOrNull('AB12CD'), null);
  assert.ok(translate(new LiveError(429, 'rate_limited', '잠시', { retryAfter: 9 })).headers['retry-after'] === '9');
  const other = new Error('x'); assert.equal(translate(other), other);
});

// ── Room(Durable Object 흉내 위에서) ─────────────────────────────
function makeRoom(extraEnv = {}, { siteAlive = () => ({ alive: false }), total = 0 } = {}) {
  const ctx = fakeCtx();
  const SITE_NS = fakeNamespace(({ path, query }) => (path === '/live-status' ? siteAlive(query.get('code')) : { ok: true }));
  const GATE_NS = fakeNamespace(() => ({ ok: true, total: typeof total === 'function' ? total() : total }));
  const env = { ADMIN_KEY: 'operator-admin-key-0001', SITE: SITE_NS, GATE: GATE_NS, ...extraEnv };
  const room = new Room(ctx, env);
  const call = async (method, path, { json, raw, headers = {}, token, admin } = {}) => {
    const h = { 'cf-connecting-ip': '203.0.113.9', ...headers };
    if (token) h['x-lec-token'] = token;
    if (admin) h['x-lec-admin'] = encodeURIComponent(admin);
    let body;
    if (json !== undefined) { body = JSON.stringify(json); h['content-type'] = 'application/json'; h['content-length'] = String(new TextEncoder().encode(body).length); }
    if (raw !== undefined) { body = raw; h['content-type'] = 'application/octet-stream'; h['content-length'] = String(raw.byteLength); }
    const res = await room.fetch(new Request(`https://sites.example${path}`, { method, headers: h, body }));
    const buf = new Uint8Array(await res.arrayBuffer());
    let parsed = null; try { parsed = JSON.parse(new TextDecoder().decode(buf)); } catch { /* 파일 */ }
    return { status: res.status, headers: res.headers, body: parsed, bytes: buf };
  };
  const bind = (over = {}) => call('POST', '/host/bind', { json: { site: SITE, code: 'AB12CD', adminKeyHash: sha(KEY), expires: Date.now() + 30 * day, ...over } });
  return { ctx, env, room, call, bind, SITE_NS, GATE_NS };
}

test('묶이지 않은 코드: 404, 저장소에 아무것도 생기지 않음', async () => {
  const { ctx, call, SITE_NS, GATE_NS } = makeRoom();
  for (const [m, p, o] of [['GET', '/api/AB12CD/snapshot'], ['GET', '/api/AB12CD/state'], ['POST', '/api/AB12CD/join', { json: { nickname: '봄' } }], ['POST', '/api/AB12CD/init', { json: { adminKeyHash: sha(KEY) } }], ['PUT', '/api/AB12CD/state', { json: { slide: 1 }, admin: 'operator-admin-key-0001' }], ['POST', '/api/AB12CD/upload', { raw: PNG }], ['GET', '/api/AB12CD/files/0123456789abcdef01234567.png']]) {
    const r = await call(m, p, o);
    assert.equal(r.status, 404, `${m} ${p}`);
    assert.equal(r.body.error, 'unknown_training');
  }
  assert.deepEqual(ctx.sql.tables(), []);
  assert.equal(ctx.sql.writes, 0);
  assert.equal(ctx.alarm, null);
  assert.equal(SITE_NS.calls.length + GATE_NS.calls.length, 0);
});

test('방 쓰기: 묶기 → 참여 → 질문 → 강사가 봄. 운영자 열쇠로는 방을 못 다룸', async () => {
  const { ctx, call, bind } = makeRoom();
  const b = await bind({ settings: { moderation: false } });
  assert.equal(b.status, 200); assert.equal(b.body.created, true); assert.equal(b.body.code, 'AB12CD');
  assert.ok(ctx.sql.tables().includes('trainings') && ctx.sql.tables().includes('host_bind'));
  assert.ok(ctx.alarm > Date.now(), '정리 알람이 잡힘');
  assert.ok(ctx.alarm <= Date.now() + 30 * day + 3700e3, '정리 알람은 사이트 공개 기간 끝을 넘기지 않음');

  const j = await call('POST', '/api/AB12CD/join', { json: { nickname: '봄날' } });
  assert.equal(j.status, 201); assert.ok(j.body.token && j.body.id);
  const q = await call('POST', '/api/AB12CD/questions', { json: { text: '쉬는 시간은 언제인가요?' }, token: j.body.token });
  assert.equal(q.status, 201, JSON.stringify(q.body));
  // 참가자·아무나: 질문은 보이고 참가자 명단은 안 보임
  const pub = await call('GET', '/api/AB12CD/snapshot');
  assert.equal(pub.status, 200);
  assert.equal(pub.body.questions.length, 1); assert.equal(pub.body.questions[0].text, '쉬는 시간은 언제인가요?');
  assert.ok(!pub.body.participants || pub.body.participants.length === 0);
  // 강사 키
  const adm = await call('GET', '/api/AB12CD/snapshot', { admin: KEY });
  assert.equal(adm.body.participants.length, 1); assert.equal(adm.body.participants[0].nickname, '봄날');
  // 운영자(호스트)의 ADMIN_KEY는 방의 관리자 키가 아님
  const op = await call('GET', '/api/AB12CD/snapshot', { admin: 'operator-admin-key-0001' });
  assert.ok(!op.body.participants || op.body.participants.length === 0);
  const opWrite = await call('PUT', '/api/AB12CD/state', { json: { slide: 3 }, admin: 'operator-admin-key-0001' });
  assert.equal(opWrite.status, 403);
  const okWrite = await call('PUT', '/api/AB12CD/state', { json: { slide: 3 }, admin: KEY });
  assert.equal(okWrite.status, 200, JSON.stringify(okWrite.body));
  // 다른 코드는 이 방(객체)에서 만들어지지 않음
  const other = await call('POST', '/api/ZZ99ZZ/join', { json: { nickname: '봄' } });
  assert.equal(other.status, 404);
  // 다른 사이트가 같은 코드를 달라고 하면 거절
  const taken = await call('POST', '/host/bind', { json: { site: OTHER, code: 'AB12CD', adminKeyHash: sha(KEY2), expires: Date.now() + day } });
  assert.equal(taken.status, 409); assert.equal(taken.body.error.code, 'code_taken');
  // 같은 사이트가 관리자 키를 바꿈: 참가 기록은 그대로, 예전 키는 안 통함
  assert.equal((await bind({ adminKeyHash: sha(KEY2) })).body.created, false);
  assert.equal((await call('PUT', '/api/AB12CD/state', { json: { slide: 4 }, admin: KEY })).status, 403);
  assert.equal((await call('GET', '/api/AB12CD/snapshot', { admin: KEY2 })).body.participants.length, 1);
});

test('보드 파일: R2 없이 올리고, 글에 붙은 동안만 보임. 저장량을 Gate에 알림', async () => {
  const { call, bind, GATE_NS, room } = makeRoom();
  await bind();
  const j = await call('POST', '/api/AB12CD/join', { json: { nickname: '사진사' } });
  const up = await call('POST', '/api/AB12CD/upload', { raw: PNG, token: j.body.token, headers: { 'x-lec-filename': encodeURIComponent('우리 반.png') } });
  assert.equal(up.status, 201, JSON.stringify(up.body));
  assert.match(up.body.url, /^\/api\/AB12CD\/files\/[a-f0-9]{24}\.png$/);
  assert.equal(up.body.type, 'image/png'); assert.equal(up.body.size, PNG.length);
  assert.equal((await call('GET', up.body.url)).status, 404, '글에 붙기 전에는 안 보임');
  const post = await call('POST', '/api/AB12CD/posts', { json: { text: '오늘 활동', files: [{ url: up.body.url, name: up.body.name, type: up.body.type, size: up.body.size }] }, token: j.body.token });
  assert.equal(post.status, 201, JSON.stringify(post.body));
  const got = await call('GET', up.body.url);
  assert.equal(got.status, 200);
  assert.deepEqual(got.bytes, PNG);
  assert.equal(got.headers.get('content-type'), 'image/png');
  assert.equal(got.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(got.headers.get('content-security-policy').includes('sandbox'));
  const part = await call('GET', up.body.url, { headers: { range: 'bytes=1-3' } });
  assert.equal(part.status, 206); assert.deepEqual(part.bytes, PNG.subarray(1, 4)); assert.equal(part.headers.get('content-range'), `bytes 1-3/${PNG.length}`);
  // 형식은 내용으로 가림: HTML·SVG·스크립트는 이름을 바꿔도 거절
  for (const evil of ['<!doctype html><script>alert(1)</script>', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'alert(1)']) {
    const r = await call('POST', '/api/AB12CD/upload', { raw: new TextEncoder().encode(evil), token: j.body.token, headers: { 'x-lec-filename': 'a.png' } });
    assert.equal(r.status, 415, evil.slice(0, 20));
  }
  assert.equal((await call('POST', '/api/AB12CD/upload', { raw: PNG })).status, 401, '참여한 사람만');
  // Gate에 방 저장량을 알림
  const reports = GATE_NS.calls.filter((c) => c.path === '/site' && c.body.id === SITE && c.body.roomBytes > 0);
  assert.ok(reports.length >= 1);
  assert.equal(room.hostBucket.usage().count, 1);
  // 글을 지우면 파일도 지움
  const del = await call('DELETE', `/api/AB12CD/posts/${post.body.id}`, { admin: KEY });
  assert.equal(del.status, 200, JSON.stringify(del.body));
  assert.equal((await call('GET', up.body.url)).status, 404);
  assert.equal(room.hostBucket.usage().count, 0);
});

test('한도: 파일 하나·방 전체·참가자 수, 전체 저장 공간이 차면 올리기 멈춤', async () => {
  let total = 0;
  const { call, bind } = makeRoom({ LIVE_MAX_UPLOAD_MB: '1', LIVE_ROOM_MB: '1', LIVE_MAX_PARTICIPANTS: '2', MAX_TOTAL_BYTES: '1000' }, { total: () => total });
  await bind();
  const a = await call('POST', '/api/AB12CD/join', { json: { nickname: '하나' } });
  const b = await call('POST', '/api/AB12CD/join', { json: { nickname: '둘' } });
  assert.equal(b.status, 201);
  const c = await call('POST', '/api/AB12CD/join', { json: { nickname: '셋' } });
  assert.equal(c.status, 403); assert.equal(c.body.error, 'room_full');
  const big = (n) => { const u = new Uint8Array(n); u.set(PNG.subarray(0, 16)); return u; };
  assert.equal((await call('POST', '/api/AB12CD/upload', { raw: big(1024 * 1024 + 70000), token: a.body.token })).status, 413);
  assert.equal((await call('POST', '/api/AB12CD/upload', { raw: big(600 * 1024), token: a.body.token })).status, 201);
  const full = await call('POST', '/api/AB12CD/upload', { raw: big(600 * 1024), token: b.body.token });
  assert.equal(full.status, 507); assert.equal(full.body.error, 'storage_full');
  // 호스트 전체가 찼다고 Gate가 알려 주면 그다음부터는 받지 않음
  total = 5000;
  assert.equal((await call('POST', '/api/AB12CD/upload', { raw: big(1000), token: b.body.token })).status, 201);
  const stop = await call('POST', '/api/AB12CD/upload', { raw: big(1000), token: b.body.token });
  assert.equal(stop.status, 507); assert.equal(stop.body.error, 'storage_full');
});

test('파일 올리기를 끈 서버(LIVE_UPLOADS=off)', async () => {
  const { call, bind } = makeRoom({ LIVE_UPLOADS: 'off' });
  await bind();
  const j = await call('POST', '/api/AB12CD/join', { json: { nickname: '봄' } });
  const r = await call('POST', '/api/AB12CD/upload', { raw: PNG, token: j.body.token });
  assert.equal(r.status, 503); assert.equal(r.body.error, 'uploads_disabled');
});

test('가리기: 사이트를 가리면 방도 닫히고, 풀면 다시 열림', async () => {
  const { call, bind, ctx } = makeRoom();
  await bind();
  const closed = [];
  ctx.sockets.push({ close: (code, reason) => closed.push([code, reason]) });
  assert.equal((await call('POST', '/host/touch', { json: { site: OTHER, blocked: true } })).body.ok, false, '다른 사이트의 요청은 무시');
  assert.equal((await call('GET', '/api/AB12CD/snapshot')).status, 200);
  assert.equal((await call('POST', '/host/touch', { json: { site: SITE, blocked: true } })).body.ok, true);
  assert.deepEqual(closed, [[1008, 'blocked']], '열려 있던 실시간 연결을 끊음');
  for (const [m, p, o] of [['GET', '/api/AB12CD/snapshot'], ['POST', '/api/AB12CD/join', { json: { nickname: '봄' } }], ['GET', '/api/AB12CD/snapshot', { admin: KEY }]]) {
    const r = await call(m, p, o);
    assert.equal(r.status, 403); assert.equal(r.body.error, 'blocked');
  }
  await call('POST', '/host/touch', { json: { site: SITE, blocked: false } });
  assert.equal((await call('GET', '/api/AB12CD/snapshot')).status, 200);
});

test('지우기: 사이트가 지워지면 방·파일·알람이 모두 사라짐', async () => {
  const { call, bind, ctx, GATE_NS } = makeRoom();
  await bind();
  const j = await call('POST', '/api/AB12CD/join', { json: { nickname: '봄' } });
  await call('POST', '/api/AB12CD/upload', { raw: PNG, token: j.body.token });
  assert.ok(ctx.sql.tables().includes('host_file'));
  assert.equal((await call('POST', '/host/wipe', { json: { site: OTHER } })).body.ok, false);
  assert.ok(ctx.sql.tables().length > 0, '다른 사이트는 못 지움');
  assert.equal((await call('POST', '/host/wipe', { json: { site: SITE } })).body.ok, true);
  assert.deepEqual(ctx.sql.tables(), []);
  assert.equal(ctx.alarm, null);
  assert.equal((await call('GET', '/api/AB12CD/snapshot')).status, 404);
  assert.deepEqual(GATE_NS.calls.at(-1).body, { id: SITE, roomBytes: 0 });
  // 비운 뒤에는 다른 사이트가 그 코드를 쓸 수 있음
  const again = await call('POST', '/host/bind', { json: { site: OTHER, code: 'AB12CD', adminKeyHash: sha(KEY2), expires: Date.now() + day } });
  assert.equal(again.status, 200); assert.equal(again.body.created, true);
  assert.equal((await call('GET', '/api/AB12CD/snapshot', { admin: KEY2 })).body.participants.length, 0, '예전 참가 기록은 없음');
});

test('공개 기간: 끝나면 사이트에 물어보고, 늘었으면 이어 쓰고 없어졌으면 비움', async () => {
  let alive = { alive: true, expires: Date.now() + 10 * day, blocked: false };
  const { call, bind, ctx, room, SITE_NS } = makeRoom({}, { siteAlive: () => alive });
  await bind({ expires: Date.now() - 1000 }); // 방이 아는 기간은 이미 지남
  const r = await call('GET', '/api/AB12CD/snapshot');
  assert.equal(r.status, 200, '사이트가 살아 있으면(다시 올려 기간이 늘어남) 이어 씀');
  assert.deepEqual(SITE_NS.calls.at(-1), { name: SITE, method: 'GET', path: '/live-status', query: { code: 'AB12CD' }, body: null });
  assert.equal(room.hostBind.get().expires, alive.expires);
  const n = SITE_NS.calls.length;
  await call('GET', '/api/AB12CD/snapshot');
  assert.equal(SITE_NS.calls.length, n, '기간 안에서는 다시 묻지 않음');
  // 사이트가 없어짐
  room.hostBind.patch({ expires: Date.now() - 1 });
  alive = { alive: false };
  const gone = await call('GET', '/api/AB12CD/snapshot');
  assert.equal(gone.status, 404);
  assert.deepEqual(ctx.sql.tables(), []);
});

test('알람: 사이트가 없어졌으면 비우고, 살아 있으면 규칙대로 정리만', async () => {
  let alive = { alive: false };
  const { bind, ctx, room } = makeRoom({}, { siteAlive: () => alive });
  await bind({ expires: Date.now() - 1000 });
  await room.alarm();
  assert.deepEqual(ctx.sql.tables(), []);
  assert.equal(ctx.alarm, null);
  // 살아 있는 방: 알람이 돌아도 남고, 다음 알람이 잡힘
  alive = { alive: true, expires: Date.now() + 5 * day, blocked: false };
  await bind({ expires: Date.now() + 5 * day });
  await room.alarm();
  assert.ok(ctx.sql.tables().includes('trainings'));
  assert.ok(ctx.alarm > Date.now() && ctx.alarm <= Date.now() + 5 * day + 3700e3);
  // 묶이지 않은 빈 객체의 알람은 조용히 끝남
  const empty = makeRoom();
  await empty.room.alarm();
  assert.deepEqual(empty.ctx.sql.tables(), []);
});
