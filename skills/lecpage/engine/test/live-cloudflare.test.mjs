// Runs the protocol v1 suite against the Cloudflare Worker + Durable Object.
// Skipped unless a running Worker is given, e.g.:
//   cd skills/lecpage/backends/cloudflare && npm ci && npx wrangler dev --port 8788 --var ADMIN_KEY:cf-test-admin-key-2026 --var NEW_CODES_PER_HOUR:100000
//   LEC_CF_URL=http://127.0.0.1:8788 LEC_CF_ADMIN='cf-test-admin-key-2026' node --test skills/lecpage/engine/test/live-cloudflare.test.mjs
// With an R2 binding (uncomment [[r2_buckets]]; wrangler dev simulates it) add LEC_CF_UPLOADS=1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { protocolSuite, api, PNG_1PX, wsOpen } from './live-helpers.mjs';

const base = process.env.LEC_CF_URL;
const adminKey = process.env.LEC_CF_ADMIN || '';
const uploads = process.env.LEC_CF_UPLOADS === '1';

if (!base) {
  test('cloudflare: skipped (set LEC_CF_URL to a running `wrangler dev`)', { skip: 'LEC_CF_URL not set' }, () => {});
} else {
  protocolSuite('cloudflare', () => ({ base, adminKey }), { uploads });

  test('cloudflare: health reports the runtime', async () => {
    const h = await (await fetch(base + '/api/health')).json();
    assert.equal(h.ok, true); assert.equal(h.runtime, 'cloudflare');
  });

  if (!uploads) test('cloudflare: without an R2 binding uploads are disabled gracefully', async () => {
    const a = api(base, 'CFNOR2' + Math.random().toString(36).slice(2, 5).toUpperCase());
    const p = (await a.call('POST', '/join', { body: { nickname: 'x' } })).body;
    const fd = new FormData(); fd.append('file', new Blob([PNG_1PX], { type: 'image/png' }), 'a.png');
    const r = await a.call('POST', '/upload', { token: p.token, body: fd });
    assert.equal(r.status, 503); assert.equal(r.body.error, 'uploads_disabled');
  });

  // Security regressions. wrangler dev passes CF-Connecting-IP through, so tests can act as different clients
  // (on Cloudflare the edge overwrites it). Each run uses fresh IPs, so a locked IP never blocks the next run.
  const fakeIp = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  test('cloudflare (H4): wrong admin keys over many codes lock that IP everywhere (Guard object)', async () => {
    const ipA = fakeIp(); const tag = Math.random().toString(36).slice(2, 6).toUpperCase();
    for (let i = 0; i < 20; i++) await api(base, 'SPRAY' + tag + i).call('GET', '/participants', { admin: 'guess-' + i, headers: { 'CF-Connecting-IP': ipA } });
    const locked = await api(base, 'SPRAYX' + tag).call('GET', '/participants', { admin: adminKey, headers: { 'CF-Connecting-IP': ipA } });
    assert.equal(locked.status, 429); assert.ok(Number(locked.headers.get('retry-after')) > 60);
    assert.equal((await api(base, 'SPRAYX' + tag).call('GET', '/participants', { admin: adminKey, headers: { 'CF-Connecting-IP': fakeIp() } })).status, 200);
  });
  test('cloudflare (H4): three wrong WebSocket auths close the socket', async () => {
    const a = api(base, 'WSA' + Math.random().toString(36).slice(2, 7).toUpperCase());
    const w = await wsOpen(a.root.replace(/^http/, 'ws') + '/ws', { headers: { 'CF-Connecting-IP': fakeIp() } });
    for (let i = 0; i < 5; i++) w.ws.send(JSON.stringify({ type: 'auth', admin: 'nope-' + i }));
    assert.equal(await w.closed, 1008);
    assert.equal(w.msgs.filter((m) => m.type === 'auth').length, 3);
  });

  // 2026-11-24: 소켓 하나로 받는 동기화(요청 수 줄이기). 예전 런타임이 쓰는 것은 그대로. 긴 대기는 전과 같고, 붙잡았다 보내는 답의 now만 보내는 때의 시각으로
  test('cloudflare: 소켓 동기화는 GET snapshot과 같은 답이고, 긴 대기는 청한 만큼만 붙잡으며 바뀌면 바로 답한다. 붙잡았다 보낸 답의 now는 보낸 때', { timeout: 40000 }, async () => {
    const a = api(base, 'SYNC' + Math.random().toString(36).slice(2, 7).toUpperCase());
    await a.call('PUT', '/state', { admin: adminKey, body: { slide: 2 } });
    const me = (await a.call('POST', '/join', { body: { nickname: '봄날' } })).body;
    await a.call('POST', '/questions', { token: me.token, body: { text: '쉬는 시간은 언제인가요?' } });
    await a.call('POST', '/attendance', { token: me.token, body: { kind: 'in' } });
    const w = await wsOpen(a.root.replace(/^http/, 'ws') + '/ws');
    const hello = await w.next((m) => m.type === 'hello');
    assert.ok(hello.now > 0 && hello.mode === 'ws' && hello.protocol, '예전 런타임이 읽는 칸은 그대로');
    assert.deepEqual(hello.caps, ['sync']);
    w.ws.send('ping'); await w.next((m) => m.type === 'pong-text');
    w.ws.send(JSON.stringify({ type: 'sync', id: 'a1', since: 0, token: me.token }));
    const r = await w.next((m) => m.type === 'sync' && m.id === 'a1');
    const http = (await a.call('GET', '/snapshot?since=0', { token: me.token })).body;
    assert.equal(r.ok, true);
    const { now: n1, ...h } = http; const { now: n2, ...s } = r.doc;
    assert.deepEqual(s, h, '소켓으로 받은 것 = HTTP로 받은 것');
    assert.equal(r.doc.me.id, me.id); assert.equal(r.doc.questions.length, 1); assert.equal(r.doc.attendance.length, 1);
    assert.ok(!r.doc.participants || !r.doc.participants.length, '참가자 명단은 주지 않음');
    w.ws.send(JSON.stringify({ type: 'sync', id: 'a2', since: r.doc.now, token: me.token }));
    const inc = await w.next((m) => m.type === 'sync' && m.id === 'a2');
    assert.equal(inc.doc.questions.length, 0); assert.equal(inc.doc.full, false);
    for (let i = 0; i < 40; i++) w.ws.send(JSON.stringify({ type: 'sync', id: 'b' + i, since: r.doc.now }));
    const last = await w.next((m) => m.type === 'sync' && m.id === 'b39');
    assert.equal(last.ok, false); assert.equal(last.error, 'rate_limited'); assert.equal(last.status, 429);
    // 소켓으로 오는 변경 알림은 전과 같음
    await a.call('POST', '/questions', { token: me.token, body: { text: '둘째 질문' } });
    await w.next((m) => m.type !== 'sync' && m.type !== 'hello' && m.type !== 'pong-text');
    w.close();
    // 긴 대기(Worker가 대신 기다림): 끝까지 붙잡았다 보낸 답의 now는 기다리기 시작한 때가 아니라 보낸 때(런타임이 이 값으로 시계를 맞춤)
    const cur = (await a.call('GET', '/snapshot?since=0', { token: me.token })).body.now;
    let t0 = Date.now();
    const held = await a.call('GET', `/snapshot?since=${cur}&wait=2`, { token: me.token });
    assert.ok(Date.now() - t0 >= 1800 && Date.now() - t0 < 5000, `2초를 청하면 2초(${Date.now() - t0}ms)`);
    assert.ok(held.body.now - cur >= 1800, `붙잡았다 보낸 답의 now는 보낸 때(기다리기 시작한 때보다 ${held.body.now - cur}ms 뒤)`);
    assert.equal(held.body.questions.length, 0); assert.equal(held.body.waitMax, undefined);
    t0 = Date.now();
    const p = a.call('GET', `/snapshot?since=${held.body.now}&wait=20`, { token: me.token });
    await new Promise((res) => setTimeout(res, 500));
    await a.call('POST', '/questions', { token: me.token, body: { text: '기다리는 중에 올린 질문' } });
    const woke = await p;
    assert.ok(Date.now() - t0 < 3000, `바뀌면 바로(${Date.now() - t0}ms)`);
    assert.equal(woke.body.questions.length, 1, '새 now를 다음 물음의 기준으로 써도 그 뒤에 생긴 것을 놓치지 않음');
  });
}
