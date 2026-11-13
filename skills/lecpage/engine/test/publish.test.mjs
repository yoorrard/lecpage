// publish(올리기+참여 기능 한 번에)를 가짜 wrangler로 끝까지 돌려 봅니다. 실제 계정·네트워크에 닿지 않습니다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, mkdirSync, statSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', '..', 'scripts', 'lecpage.mjs');
const EX = join(HERE, '..', '..', 'examples', 'data-lab.blueprint.json');
let dir, logFile;
const run = (args, env = {}) => {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd: dir, encoding: 'utf8', timeout: 120000, env: { ...process.env, LECPAGE_WRANGLER: join(HERE, 'fixtures', 'fake-wrangler.mjs'), FAKE_WRANGLER_LOG: logFile, CLOUDFLARE_API_TOKEN: '', ...env } });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
};

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'lecpage-pub-test-'));
  logFile = join(dir, 'wrangler.log');
  mkdirSync(join(dir, 'work'));
  copyFileSync(EX, join(dir, 'work', 'blueprint.json'));
  writeFileSync(join(dir, 'work', 'lecpage.state.json'), JSON.stringify({ out: '../dist', blueprint: 'blueprint.json' }));
  writeFileSync(join(dir, 'work', 'info.json'), JSON.stringify({ size: 30, skill: 'set' }));
  const b = spawnSync(process.execPath, [CLI, 'build', 'work/blueprint.json', '-o', 'dist'], { cwd: dir, encoding: 'utf8' });
  assert.equal(b.status, 0, b.stdout + b.stderr);
});
after(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

test('publish --dry-run: 순서와 강사가 할 일만 보여 주고 아무 파일도 바꾸지 않음', () => {
  const before = readFileSync(join(dir, 'work', 'info.json'), 'utf8');
  const r = run(['publish', 'work', '--live', '--features', 'qa,poll', '--dry-run', '--name', 'lec-test']);
  assert.equal(r.code, 0, r.out);
  for (const k of ['올리기 계획', '중계', 'secret put ADMIN_KEY', 'ALLOWED_ORIGINS', '강사가 할 일', 'wrangler@4 login']) assert.ok(r.out.includes(k), `${k} 없음\n${r.out}`);
  assert.equal(readFileSync(join(dir, 'work', 'info.json'), 'utf8'), before);
  assert.ok(!existsSync(join(dir, 'work', 'live-relay')));
  assert.ok(!existsSync(logFile), '가짜 wrangler도 부르지 않음');
});

test('publish --live: 중계 → 관리자 키(강사용 파일에만) → 다시 빌드 → 사이트 → 중계가 이 사이트만 받게', () => {
  const r = run(['publish', 'work', '--live', '--features', 'qa,poll', '--name', 'lec-test', '--no-verify', '--no-handouts', '--no-qa']);
  assert.equal(r.code, 0, r.out);
  const keyFile = join(dir, 'dist-강사용', '관리자-키.txt');
  assert.ok(existsSync(keyFile));
  const key = readFileSync(keyFile, 'utf8').trim();
  assert.ok(key.length >= 12);
  if (process.platform !== 'win32') assert.equal(statSync(keyFile).mode & 0o077, 0, '본인만 읽기');
  const log = readFileSync(logFile, 'utf8');
  assert.ok(!r.out.includes(key) && !log.includes(key), '관리자 키는 화면·기록에 없음');
  // 순서: secret → 중계 deploy → 사이트 deploy → 중계 deploy(ALLOWED_ORIGINS)
  const steps = log.trim().split('\n').filter((l) => !l.startsWith('whoami'));
  assert.match(steps[1], /^secret put ADMIN_KEY/);
  assert.match(steps[2], /^deploy -c wrangler\.toml$/);
  assert.match(steps[3], /^deploy --assets .*dist --name lec-test --compatibility-date \d{4}-\d\d-\d\d$/);
  assert.match(steps[4], /ALLOWED_ORIGINS:https:\/\/lec-test\.fake-account\.workers\.dev$/);
  const info = JSON.parse(readFileSync(join(dir, 'work', 'info.json'), 'utf8'));
  assert.equal(info.live.provider, 'http');
  assert.equal(info.live.url, 'https://lec-test-live.fake-account.workers.dev');
  assert.deepEqual(info.features, ['qa', 'poll']);
  const bp = JSON.parse(readFileSync(join(dir, 'work', 'blueprint.json'), 'utf8'));
  const toml = readFileSync(join(dir, 'work', 'live-relay', 'wrangler.toml'), 'utf8');
  assert.match(toml, /^name = "lec-test-live"$/m);
  assert.ok(toml.includes(`ALLOWED_CODES = "${bp.live.code}"`), '이 연수 코드만 받음');
  const html = readFileSync(join(dir, 'dist', 'index.html'), 'utf8');
  assert.ok(html.includes('lec-test-live.fake-account.workers.dev'), '사이트가 중계 주소로 다시 빌드됨');
  assert.ok(!existsSync(join(dir, 'dist', '관리자-키.txt')));
  const state = JSON.parse(readFileSync(join(dir, 'work', 'lecpage.state.json'), 'utf8'));
  assert.equal(state.deploy.url, 'https://lec-test.fake-account.workers.dev/');
  assert.ok(!JSON.stringify(state).includes(key));
  for (const k of ['올렸어요', 'console.html', '관리자 키 파일']) assert.ok(r.out.includes(k), `${k} 없음\n${r.out}`);
});

test('publish 다시: 중계에 관리자 키가 있으면 새로 만들지 않음', () => {
  const keyFile = join(dir, 'dist-강사용', '관리자-키.txt');
  const key = readFileSync(keyFile, 'utf8');
  const r = run(['publish', 'work', '--live', '--no-verify', '--no-handouts', '--no-qa'], { FAKE_HAS_SECRET: '1' });
  assert.equal(r.code, 0, r.out);
  assert.ok(r.out.includes('관리자 키 그대로'));
  assert.equal(readFileSync(keyFile, 'utf8'), key);
  assert.ok(r.out.includes('lec-test.fake-account.workers.dev'), '지난번 이름 그대로');
});

test('publish: Cloudflare가 아닌 곳은 한 줄 명령을 알려 주고 멈춤', () => {
  const r = run(['publish', 'work', '--host', 'vercel']);
  assert.notEqual(r.code, 0);
  assert.ok(r.out.includes('vercel'));
});
