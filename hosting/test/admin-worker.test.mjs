// 관리 Worker(lecpage-admin): 도메인 없이 workers.dev 전체를 Access가 지키고, Worker가 ctx.access(또는 JWT)로 한 번 더 확인
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fakeCtx } from './fake-do.mjs';
import { HOSTING } from './helpers.mjs';
import { makeIssuer } from './jwt-helpers.mjs';
import { jwksCache, ADMIN_CSP } from '../src/access.js';

before(() => execFileSync(process.execPath, [join(HOSTING, 'scripts', 'gen-admin.mjs')]));
const { default: worker, adminAccess } = await import('../src/admin-worker.js');
const { Gate } = await import('../src/gate.js');

const AUD = 'b'.repeat(64);
const OP = 'operator@example.com';
function env(extra = {}) {
  const g = new Gate(fakeCtx(), { DAILY_REQUEST_BUDGET: 1000 });
  const ns = (obj) => ({ idFromName: (n) => n, get: () => ({ fetch: (u, init) => obj.fetch(new Request(u, init)) }) });
  return { GATE: ns(g), SITE: ns({ fetch: async () => new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } }) }), ...extra };
}
const access = (email, aud = AUD) => ({ access: { aud, getIdentity: async () => ({ email }) } });
const go = (e, path, ctx = {}, init = {}) => worker.fetch(new Request(`https://lecpage-admin.acct.workers.dev${path}`, init), e, ctx);

test('Access 설정이 없으면 모든 주소가 404(닫힌 채로 시작)', async () => {
  const e = env();
  assert.equal(adminAccess(e), null);
  for (const p of ['/', '/admin/', '/admin/api/overview']) assert.equal((await go(e, p, access(OP))).status, 404);
  assert.equal(adminAccess(env({ ACCESS_AUD: AUD })), null, '이메일 없이 AUD만으로는 열지 않음');
});

test('ctx.access: AUD와 운영자 이메일이 맞아야 들어옴', async () => {
  const e = env({ ACCESS_AUD: AUD, ACCESS_EMAILS: 'Operator@Example.com' });
  assert.equal(adminAccess(e).mode, 'ctx');
  assert.equal((await go(e, '/admin/', {})).status, 403, 'Access를 거치지 않음');
  assert.equal((await go(e, '/admin/', access(OP, 'c'.repeat(64)))).status, 403, '다른 Access 앱');
  assert.equal((await go(e, '/admin/', access('someone@example.com'))).status, 403, '다른 이메일');
  const root = await go(e, '/', access(OP));
  assert.equal(root.status, 308); assert.equal(root.headers.get('location'), '/admin/');
  const page = await go(e, '/admin/', access(OP));
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('content-security-policy'), ADMIN_CSP);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.match(await page.text(), /<script src="app.js"|<script src="\/admin\/app.js"/);
  assert.equal((await go(e, '/admin/app.js', access(OP))).headers.get('content-type'), 'text/javascript; charset=utf-8');
  const o = await go(e, '/admin/api/overview', access(OP), { headers: { 'x-lecpage-admin': '1' } });
  assert.equal(o.status, 200);
  const j = await o.json();
  assert.equal(j.me, OP); assert.equal(j.upcoming.length, 7);
  assert.equal((await go(e, '/admin/api/overview', access(OP))).status, 403, 'CSRF 머리글 없으면 막음');
  assert.equal((await go(e, '/s/abc/', access(OP))).status, 404, '관리 화면 말고는 없음');
});

test('JWT(팀 도메인이 있을 때): 서명을 확인하고, ctx.access가 다른 사람이면 막음', async () => {
  const iss = await makeIssuer();
  const TEAM = 'https://lecpage-test.cloudflareaccess.com';
  const getKey = jwksCache({ fetch: async () => new Response(JSON.stringify(iss.jwks)) });
  const e = env({ ACCESS_TEAM_DOMAIN: 'lecpage-test.cloudflareaccess.com', ACCESS_AUD: AUD, ACCESS_EMAILS: OP });
  assert.equal(adminAccess(e).mode, 'jwt');
  const now = Math.floor(Date.now() / 1000);
  const token = await iss.sign({ aud: [AUD], email: OP, exp: now + 600, iss: TEAM, type: 'app' });
  const req = (ctx) => worker.fetch(new Request('https://lecpage-admin.acct.workers.dev/admin/', { headers: { 'cf-access-jwt-assertion': token } }), e, ctx, { getKey });
  assert.equal((await req({})).status, 200);
  assert.equal((await req(access(OP))).status, 200);
  assert.equal((await req(access('other@example.com'))).status, 403);
  assert.equal((await worker.fetch(new Request('https://lecpage-admin.acct.workers.dev/admin/'), e, access(OP), { getKey })).status, 403, '토큰 없으면 막음');
});
