// 관리 화면 들어오기: Cloudflare Access 토큰(JWT) 확인, 열쇠 목록 캐시, CSRF 막기, 팀 도메인 모양
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyAccessJwt, jwksCache, csrfProblem, AccessError, ADMIN_CSP, ADMIN_HEADERS } from '../src/access.js';
import { accessConfig, normTeam } from '../src/config.js';
import { makeIssuer } from './jwt-helpers.mjs';

const TEAM = 'https://lecpage-test.cloudflareaccess.com';
const AUD = 'a'.repeat(64);
const iss = await makeIssuer();
const other = await makeIssuer(); // 다른 열쇠(가짜 Access)

const getKey = jwksCache({ fetch: async (url) => { assert.equal(url, `${TEAM}/cdn-cgi/access/certs`); return new Response(JSON.stringify(iss.jwks)); } });
const opts = (o = {}) => ({ team: TEAM, aud: [AUD], getKey, ...o });
const now = Math.floor(Date.now() / 1000);
const good = (claims = {}) => iss.sign({ aud: [AUD], email: 'Operator@Example.com', exp: now + 600, iat: now - 5, nbf: now - 5, iss: TEAM, sub: 'u-1', type: 'app', ...claims });
const fails = async (token, reason, o) => assert.rejects(verifyAccessJwt(token, opts(o)), (e) => e instanceof AccessError && e.reason === reason, reason);

test('Access JWT: 맞으면 이메일(소문자)과 sub', async () => {
  assert.deepEqual(await verifyAccessJwt(await good(), opts()), { email: 'operator@example.com', sub: 'u-1' });
  assert.deepEqual(await verifyAccessJwt(await good({ aud: AUD }), opts()), { email: 'operator@example.com', sub: 'u-1' }, 'aud가 글자 하나여도');
  // 시계가 조금 어긋나도(1분 안)
  assert.ok(await verifyAccessJwt(await good({ exp: now - 30 }), opts()));
  assert.ok(await verifyAccessJwt(await good({ iat: now + 30, nbf: now + 30 }), opts()));
});

test('Access JWT: 서명·열쇠가 다르면 거절', async () => {
  // 같은 kid로 다른 열쇠가 서명(공격자가 지어낸 토큰)
  const forged = await other.sign({ aud: [AUD], email: 'x@example.com', exp: now + 600, iss: TEAM }, { kid: iss.kid });
  await fails(forged, 'signature');
  // 모르는 kid
  await fails(await other.sign({ aud: [AUD], email: 'x@example.com', exp: now + 600, iss: TEAM }), 'kid');
  // 내용을 바꿈(서명은 그대로)
  const t = (await good()).split('.');
  const body = JSON.parse(Buffer.from(t[1], 'base64url').toString()); body.email = 'attacker@example.com';
  await fails([t[0], Buffer.from(JSON.stringify(body)).toString('base64url'), t[2]].join('.'), 'signature');
});

test('Access JWT: 만료·아직 아님·다른 AUD·다른 팀·형식', async () => {
  await fails(await good({ exp: now - 120 }), 'expired');
  await fails(await good({ exp: undefined }), 'expired');
  await fails(await good({ nbf: now + 600 }), 'not_yet');
  await fails(await good({ iat: now + 600 }), 'not_yet');
  await fails(await good({ aud: ['b'.repeat(64)] }), 'aud');
  await fails(await good({ aud: [] }), 'aud');
  await fails(await good({ iss: 'https://other-team.cloudflareaccess.com' }), 'iss');
  await fails(await good({ email: undefined, common_name: 'svc.token' }), 'no_email'); // 서비스 토큰은 받지 않음
  await fails(await good({ type: 'org' }), 'type');
  await fails('', 'missing');
  await fails('a.b', 'malformed');
  await fails('###.###.###', 'malformed');
  await fails('x'.repeat(9000), 'missing');
  // alg 바꾸기(none·HS256)
  const t = (await good()).split('.');
  for (const alg of ['none', 'HS256', 'RS512']) {
    const head = Buffer.from(JSON.stringify({ alg, kid: iss.kid, typ: 'JWT' })).toString('base64url');
    await fails(`${head}.${t[1]}.${t[2]}`, 'alg');
    await fails(`${head}.${t[1]}.`, 'alg');
  }
  // 설정이 없으면
  await assert.rejects(verifyAccessJwt(await good(), { ...opts(), aud: [] }), (e) => e.reason === 'not_configured');
});

test('Access JWT: 이메일 목록(ACCESS_EMAILS)을 두면 한 번 더 확인', async () => {
  assert.ok(await verifyAccessJwt(await good(), opts({ emails: new Set(['operator@example.com']) })));
  await fails(await good(), 'email', { emails: new Set(['someone-else@example.com']) });
});

test('열쇠 목록(JWKS) 캐시: 1시간 두고, 모르는 kid면 1분에 한 번만 다시 받음, 못 받으면 받아 둔 것으로', async () => {
  let calls = 0; let t = 1_000_000; let fail = false; let keys = iss.jwks;
  const gk = jwksCache({ now: () => t, fetch: async () => { calls++; if (fail) return new Response('no', { status: 500 }); return new Response(JSON.stringify(keys)); } });
  assert.ok(await gk(TEAM, iss.kid)); assert.equal(calls, 1);
  assert.ok(await gk(TEAM, iss.kid)); assert.equal(calls, 1, '캐시');
  assert.equal(await gk(TEAM, 'unknown'), null); assert.equal(calls, 1, '방금 받았으면 다시 받지 않음');
  t += 61_000; assert.equal(await gk(TEAM, 'unknown'), null); assert.equal(calls, 2, '1분 지나면 다시 받아 봄(열쇠 교체)');
  keys = { keys: [...iss.jwks.keys, ...other.jwks.keys] };
  t += 61_000; assert.ok(await gk(TEAM, other.kid)); assert.equal(calls, 3, '새 열쇠');
  fail = true; t += 3600_001; assert.ok(await gk(TEAM, iss.kid), '못 받으면 받아 둔 열쇠로'); assert.equal(calls, 4);
  const empty = jwksCache({ fetch: async () => new Response(JSON.stringify({ keys: [{ kty: 'EC', kid: 'x' }] })) });
  await assert.rejects(empty(TEAM, 'x'), (e) => e.reason === 'jwks_empty');
  const down = jwksCache({ fetch: async () => new Response('', { status: 502 }) });
  await assert.rejects(down(TEAM, 'x'), (e) => e.reason === 'jwks_http');
});

test('팀 도메인: cloudflareaccess.com 아래만(로컬 시험은 127.0.0.1·localhost http만)', () => {
  assert.equal(normTeam('lecpage.cloudflareaccess.com'), 'https://lecpage.cloudflareaccess.com');
  assert.equal(normTeam('https://LecPage.cloudflareaccess.com/'), 'https://lecpage.cloudflareaccess.com');
  assert.equal(normTeam('http://127.0.0.1:8788'), 'http://127.0.0.1:8788');
  for (const bad of ['', 'https://evil.example', 'evil.com/.cloudflareaccess.com', 'http://lecpage.cloudflareaccess.com', 'https://a.b.cloudflareaccess.com', 'https://lecpage.cloudflareaccess.com.evil.com', 'http://10.0.0.1:80', 'https://127.0.0.1:8788']) assert.equal(normTeam(bad), '', bad);
  assert.equal(accessConfig({}), null, '설정이 없으면 관리 화면 없음');
  assert.equal(accessConfig({ ACCESS_TEAM_DOMAIN: 'x.cloudflareaccess.com' }), null, 'AUD가 없으면 없음');
  assert.equal(accessConfig({ ACCESS_TEAM_DOMAIN: 'evil.com', ACCESS_AUD: AUD }), null);
  const c = accessConfig({ ACCESS_TEAM_DOMAIN: 'x.cloudflareaccess.com', ACCESS_AUD: `${AUD}, bad aud, ${'c'.repeat(64)}`, ACCESS_EMAILS: 'A@x.com, nope' });
  assert.deepEqual(c.aud, [AUD, 'c'.repeat(64)]); assert.deepEqual([...c.emails], ['a@x.com']);
});

test('CSRF: 우리 머리글 + 같은 출처 + JSON', () => {
  const self = 'https://host.example';
  const req = (method, headers) => new Request(`${self}/admin/api/x`, { method, headers });
  const H = { 'x-lecpage-admin': '1' };
  assert.equal(csrfProblem(req('GET', H), self), '');
  assert.equal(csrfProblem(req('GET', {}), self), 'header', '머리글 없으면(다른 사이트의 <img>·<form>·<script>)');
  assert.equal(csrfProblem(req('GET', { ...H, 'sec-fetch-site': 'cross-site' }), self), 'fetch_site');
  assert.equal(csrfProblem(req('POST', { ...H, origin: self, 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' }), self), '');
  assert.equal(csrfProblem(req('POST', { ...H, origin: 'https://evil.example', 'content-type': 'application/json' }), self), 'origin');
  assert.equal(csrfProblem(req('POST', { ...H, 'content-type': 'application/json' }), self), 'origin', 'Origin이 없으면 거절');
  assert.equal(csrfProblem(req('POST', { ...H, origin: 'null', 'content-type': 'application/json' }), self), 'origin');
  assert.equal(csrfProblem(req('POST', { ...H, origin: self, 'content-type': 'text/plain' }), self), 'content_type', '<form>이 보낼 수 있는 형식은 거절');
  assert.equal(csrfProblem(req('POST', { ...H, origin: self, 'content-type': 'application/x-www-form-urlencoded' }), self), 'content_type');
  assert.equal(csrfProblem(req('POST', { origin: self, 'content-type': 'application/json' }), self), 'header');
  assert.equal(csrfProblem(req('POST', { ...H, origin: self, 'content-type': 'application/json', 'sec-fetch-site': 'same-site' }), self), 'fetch_site', '하위 도메인에서 와도 거절');
});

test('관리 화면 머리글: 인라인 스크립트 없음·틀에 못 넣음·저장 안 함', () => {
  assert.ok(ADMIN_CSP.includes("script-src 'self'") && !ADMIN_CSP.includes('unsafe-inline') && !ADMIN_CSP.includes('unsafe-eval'));
  assert.ok(ADMIN_CSP.includes("frame-ancestors 'none'") && ADMIN_CSP.includes("form-action 'none'") && ADMIN_CSP.includes("require-trusted-types-for 'script'"));
  assert.equal(ADMIN_HEADERS['cache-control'], 'no-store');
  assert.equal(ADMIN_HEADERS['x-frame-options'], 'DENY');
  assert.equal(ADMIN_HEADERS['referrer-policy'], 'no-referrer');
});
