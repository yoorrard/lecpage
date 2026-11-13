// 설정 스크립트(npm run setup): 흉내 Cloudflare API(test/fake-cf.mjs)와 흉내 wrangler로 처음부터 끝까지, 다시 돌려도 안전한지,
// 멈춘 곳을 쉬운 말로 알려 주는지, 비밀 값을 화면에 찍지 않는지.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, statSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HOSTING } from './helpers.mjs';
import { startFakeCf, ACCOUNT, TOKEN } from './fake-cf.mjs';
import { setup, SITES, ADMIN } from '../scripts/setup.mjs';

const cf = await startFakeCf();
const home = mkdtempSync(join(tmpdir(), 'lecpage-setup-'));
after(async () => { await cf.stop(); rmSync(home, { recursive: true, force: true }); });

const OP = 'operator@example.com';
function io() {
  const lines = [];
  return {
    lines, text: () => lines.join('\n'),
    log: (s = '') => lines.push(String(s)),
    interactive: false,
    ask: async () => { throw new Error('묻지 않아야 함'); },
    // 흉내 Cloudflare가 같은 프로세스에서 돌므로 기다리는 동안 이벤트 고리를 막지 않게(spawnSync를 쓰면 서로 기다림)
    run: (cmd, args, o = {}) => new Promise((res) => {
      const c = spawn(cmd, args, { cwd: HOSTING, env: o.env, stdio: ['pipe', 'pipe', 'pipe'] });
      let out = ''; c.stdout.on('data', (d) => { out += d; }); c.stderr.on('data', (d) => { out += d; });
      c.on('close', (status) => res({ status, out }));
      c.stdin.end(o.input ?? '');
    }),
    fetch: (...a) => fetch(...a),
    home,
  };
}
const ENV = (extra = {}) => ({ PATH: process.env.PATH, CF_API_BASE: cf.api, LECPAGE_WRANGLER: join(HOSTING, 'test', 'fake-wrangler.mjs'), LECPAGE_HOME: home, LECPAGE_SKIP_VERIFY: '1', ...extra });
const writes = () => cf.state.calls.filter(([m]) => m !== 'GET').length;

test('토큰이 없고 묻지 못하면: 1단계에서 멈추고 만들 토큰 권한을 알려 줌', async () => {
  const o = io();
  const r = await setup(['--yes'], { env: ENV(), io: o });
  assert.equal(r.ok, false); assert.equal(r.failedAt, '로그인 확인');
  assert.match(o.text(), /✗ 멈춘 곳: 1\/8 로그인 확인/);
  assert.match(o.text(), /Account · Workers Scripts · Edit/);
  assert.match(o.text(), /Account · Access: Apps and Policies · Edit/);
  assert.match(o.text(), /다시 돌리면 이어서/);
});

test('--dry-run: Cloudflare에 아무것도 쓰지 않음', async () => {
  const before = writes();
  const o = io();
  const r = await setup(['--dry-run', '--yes', '--webhook', 'none'], { env: ENV({ CLOUDFLARE_API_TOKEN: TOKEN }), io: o });
  assert.equal(r.ok, true, o.text());
  assert.equal(writes(), before, '읽기만');
  assert.ok(o.text().includes('(dry-run) Pages 프로젝트') || o.text().includes('사이트 주소 모양'), o.text());
});

test('처음: 하위 도메인·Pages·배포·비밀 값·관리 Worker. Zero Trust가 아직이면 그 한 단계만 안내', async () => {
  const o = io();
  const r = await setup(['--yes', '--subdomain', 'lecpage-test', '--webhook', 'https://hooks.example/abc'], { env: ENV({ CLOUDFLARE_API_TOKEN: TOKEN }), io: o });
  assert.equal(r.ok, true, o.text());
  assert.equal(cf.state.subdomain, 'lecpage-test');
  const s = cf.state.scripts.get(SITES).secrets;
  for (const k of ['ADMIN_KEY', 'REPORT_WEBHOOK', 'VIEW', 'CF_ACCOUNT_ID', 'PAGES_PROJECT', 'PAGES_HOST', 'PAGES_TOKEN']) assert.ok(s.has(k), k);
  assert.equal(s.get('VIEW'), 'pages'); assert.equal(s.get('CF_ACCOUNT_ID'), ACCOUNT); assert.equal(s.get('PAGES_HOST'), 'lecpage-view.pages.dev');
  // Worker가 쓸 토큰: 이 계정의 Pages Write만
  const tok = cf.state.tokens.find((t) => t.value === s.get('PAGES_TOKEN'));
  assert.deepEqual(tok.policies, [{ effect: 'allow', resources: { [`com.cloudflare.api.account.${ACCOUNT}`]: '*' }, permission_groups: [{ id: 'pg-pages-write' }] }]);
  // ADMIN_KEY: 파일(0600)에만, 화면에는 없음
  const file = join(home, '.lecpage', ACCOUNT, 'admin-key');
  const key = readFileSync(file, 'utf8').trim();
  assert.match(key, /^[0-9a-f]{64}$/); assert.equal(s.get('ADMIN_KEY'), key);
  assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.ok(!o.text().includes(key) && !o.text().includes(s.get('PAGES_TOKEN')) && !o.text().includes(TOKEN), '비밀 값을 찍지 않음');
  // 본 배포(없는 주소 안내)
  assert.equal(cf.deploymentsOf('main').length, 1);
  // 관리 Worker는 배포했지만 Access는 Zero Trust 가입 뒤
  assert.ok(cf.state.scripts.has(ADMIN));
  assert.match(o.text(), /Zero Trust\(무료\)를 한 번 켜야 해요/); assert.match(o.text(), /결제 수단 입력\(무료 요금제도 입력은 받지만 청구하지 않음\)/);
  assert.match(o.text(), /VITE_PUBLISH_API=https:\/\/lecpage-sites\.lecpage-test\.workers\.dev/);
  const saved = JSON.parse(readFileSync(join(home, '.lecpage', ACCOUNT, 'setup.json'), 'utf8'));
  assert.equal(saved.view, 'pages'); assert.ok(!JSON.stringify(saved).includes('@'));
});

test('다시: Zero Trust를 켠 뒤 이메일을 주면 Access만 이어서. 이미 된 것은 건너뜀(멱등)', async () => {
  cf.state.accessOrg = { auth_domain: 'lecpage-test.cloudflareaccess.com' };
  const tokens = cf.state.tokens.length; const key = cf.state.scripts.get(SITES).secrets.get('ADMIN_KEY');
  const o = io();
  const r = await setup(['--yes', '--webhook', 'none'], { env: ENV({ CLOUDFLARE_API_TOKEN: TOKEN, LECPAGE_EMAIL: OP }), io: o });
  assert.equal(r.ok, true, o.text());
  assert.equal(cf.state.tokens.length, tokens, '토큰을 또 만들지 않음');
  assert.equal(cf.state.scripts.get(SITES).secrets.get('ADMIN_KEY'), key, 'ADMIN_KEY 그대로');
  assert.equal(cf.deploymentsOf('main').length, 1, '본 배포 그대로');
  assert.equal(cf.state.accessApps.length, 1);
  const app = cf.state.accessApps[0];
  assert.deepEqual(app.destinations, [{ type: 'worker', worker_id: cf.state.scripts.get(ADMIN).id }], '도메인 없이 Worker 단위');
  assert.deepEqual(app.policies[0].include, [{ email: { email: OP } }]);
  const a = cf.state.scripts.get(ADMIN).secrets;
  assert.equal(a.get('ACCESS_AUD'), app.aud); assert.equal(a.get('ACCESS_EMAILS'), OP); assert.equal(a.get('ACCESS_TEAM_DOMAIN'), 'lecpage-test.cloudflareaccess.com');
  assert.ok(!o.text().includes(OP), '이메일은 가려서만 보여 줌'); assert.match(o.text(), /o\*\*\*@example\.com/);
  assert.match(o.text(), /관리 화면: https:\/\/lecpage-admin\.lecpage-test\.workers\.dev\/admin\//);
  // 한 번 더 돌려도 Access 앱이 늘지 않음
  const r2 = await setup(['--yes', '--webhook', 'none'], { env: ENV({ CLOUDFLARE_API_TOKEN: TOKEN, LECPAGE_EMAIL: OP }), io: io() });
  assert.equal(r2.ok, true); assert.equal(cf.state.accessApps.length, 1);
});

test('내 도메인(선택): Worker 도메인과 WAF 속도 제한 규칙 1개, 다시 돌리면 건너뜀', async () => {
  cf.state.zones = [{ id: 'zone1', name: 'example.kr' }];
  const o = io();
  const r = await setup(['--yes', '--webhook', 'none', '--domain', 'sites.example.kr'], { env: ENV({ CLOUDFLARE_API_TOKEN: TOKEN }), io: o });
  assert.equal(r.ok, true, o.text());
  assert.deepEqual(cf.state.domains, [{ hostname: 'sites.example.kr', service: SITES, zone_id: 'zone1', environment: 'production' }]);
  assert.equal(cf.state.scripts.get(SITES).secrets.get('PUBLIC_ORIGIN'), 'https://sites.example.kr');
  const rules = cf.state.rulesets.get('zone1').rules;
  assert.equal(rules.length, 1); assert.equal(rules[0].ratelimit.requests_per_period, 400); assert.equal(rules[0].ratelimit.period, 10);
  assert.match(o.text(), /VITE_PUBLISH_API=https:\/\/sites\.example\.kr/);
  await setup(['--yes', '--webhook', 'none', '--domain', 'sites.example.kr'], { env: ENV({ CLOUDFLARE_API_TOKEN: TOKEN }), io: io() });
  assert.equal(cf.state.rulesets.get('zone1').rules.length, 1);
});

test('실패하면 어디서 멈췄는지와 다음 할 일', async () => {
  const o = io();
  const r = await setup(['--yes', '--webhook', 'none'], { env: ENV({ CLOUDFLARE_API_TOKEN: TOKEN, FAKE_WRANGLER_FAIL: 'deploy' }), io: o });
  assert.equal(r.ok, false);
  assert.match(o.text(), /✗ 멈춘 곳: 4\/8 바로 공개 Worker 배포/);
  assert.match(o.text(), /다음에 할 일: 위에 찍힌 wrangler 오류를 보세요/);
  // 권한이 모자란 토큰
  cf.state.tokenOk = false;
  const o2 = io();
  const r2 = await setup(['--yes'], { env: ENV({ CLOUDFLARE_API_TOKEN: TOKEN }), io: o2 });
  cf.state.tokenOk = true;
  assert.equal(r2.ok, false); assert.match(o2.text(), /토큰 권한이 모자라요/);
});

test('npm run setup -- --help', () => {
  const r = spawnSync(process.execPath, [join(HOSTING, 'scripts', 'setup.mjs'), '--help'], { encoding: 'utf8' });
  assert.equal(r.status, 0); assert.match(r.stdout, /명령 한 번으로 켭니다/);
  assert.ok(existsSync(join(HOSTING, 'wrangler.admin.jsonc')));
});
