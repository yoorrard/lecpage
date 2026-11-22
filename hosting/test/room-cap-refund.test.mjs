// 방 묶기가 실패하면(이미 쓰는 코드 등) Gate가 센 하루 방 개수를 돌려놓음: 실패를 되풀이해 모두의 하루 방 몫을 다 쓰지 못하게
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fakeCtx, fakeNamespace } from './fake-do.mjs';
// fake-do.mjs가 cloudflare: 모듈을 흉내 내므로 그 뒤에 불러옴
const { Gate } = await import('../src/gate.js');
const { Site } = await import('../src/site.js');

const sha = (s) => createHash('sha256').update(s).digest('hex');

test('실패한 방 묶기는 하루 방 몫을 쓰지 않음(code_taken을 되풀이해도 새 방이 막히지 않음)', async () => {
  const gctx = fakeCtx(); gctx.waitUntil = () => {};
  const gate = new Gate(gctx, { DAILY_ROOM_CAP: '3', DAILY_REQUEST_BUDGET: '100000' });
  const GATE = { idFromName: (n) => ({ n }), get: () => ({ fetch: (u, i) => gate.fetch(u instanceof Request ? u : new Request(u, i)) }) };
  const ROOM = fakeNamespace(() => new Response(JSON.stringify({ error: { code: 'code_taken', message_ko: 'taken' } }), { status: 409, headers: { 'content-type': 'application/json' } }));
  const ctx = fakeCtx(); ctx.waitUntil = () => {};
  const site = new Site(ctx, { GATE, ROOM, LIVE: 'on' });
  const key = 'k'.repeat(40);
  await site.fetch(new Request('http://site/init', { method: 'POST', body: JSON.stringify({ id: 'abcdefghjk', keyHash: sha(key), title: '', created: Date.now(), expires: Date.now() + 864e5, view: 'worker' }) }));
  const codes = [];
  for (let i = 0; i < 6; i++) {
    const r = await site.fetch(new Request('http://site/live', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ code: 'TAKEN1', adminKeyHash: sha('x') }) }));
    codes.push(`${r.status}:${(await r.json()).error?.code}`);
  }
  assert.deepEqual(codes, Array(6).fill('409:code_taken'), '하루 몫(3)을 넘겨 실패해도 429가 아님');
  const st = await (await gate.fetch(new Request('http://gate/status'))).json();
  assert.equal(st.capacity.newRooms, true);
  assert.equal(site.load().live_code, null);
});
