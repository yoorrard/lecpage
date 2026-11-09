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
}
