// Runs the protocol v1 suite against the Cloudflare Worker + Durable Object.
// Skipped unless a running Worker is given, e.g.:
//   cd skills/lecpage/backends/cloudflare && cp .dev.vars.example .dev.vars && npx wrangler dev --port 8788
//   LEC_CF_URL=http://127.0.0.1:8788 LEC_CF_ADMIN='change-me-관리자키' node --test skills/lecpage/engine/test/live-cloudflare.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { protocolSuite, api, PNG_1PX } from './live-helpers.mjs';

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
}
