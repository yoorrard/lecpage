// publish(올리기+참여 기능 한 번에)를 가짜 wrangler로 끝까지 돌려 봅니다. 실제 계정·네트워크에 닿지 않습니다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, mkdirSync, statSync, copyFileSync, cpSync } from 'node:fs';
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

// ── Onpod: 가짜 onpod CLI로(실제 계정에 닿지 않음). 앞 시험의 상태를 건드리지 않게 따로 복사한 폴더에서 ──
let odir, ologFile;
const orun = (args, env = {}) => {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd: odir, encoding: 'utf8', timeout: 120000, env: { ...process.env, LECPAGE_ONPOD: join(HERE, 'fixtures', 'fake-onpod.mjs'), FAKE_ONPOD_LOG: ologFile, LECPAGE_WRANGLER: join(HERE, 'fixtures', 'fake-wrangler.mjs'), FAKE_WRANGLER_LOG: join(odir, 'wrangler.log'), ONPOD_TOKEN: '', CLOUDFLARE_API_TOKEN: '', ...env } });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
};
const ofresh = () => {
  odir = mkdtempSync(join(tmpdir(), 'lecpage-onpod-test-'));
  ologFile = join(odir, 'onpod.log');
  cpSync(join(dir, 'work'), join(odir, 'work'), { recursive: true, filter: (s) => !s.includes('live-relay') });
  cpSync(join(dir, 'dist'), join(odir, 'dist'), { recursive: true });
  writeFileSync(join(odir, 'work', 'lecpage.state.json'), JSON.stringify({ out: '../dist', blueprint: 'blueprint.json' }));
};
after(() => { if (odir) rmSync(odir, { recursive: true, force: true }); });

test('publish --host onpod --dry-run: 순서·강사가 할 일(가입·API 키·환경 변수)만, onpod을 부르지 않음', () => {
  ofresh();
  const r = orun(['publish', 'work', '--host', 'onpod', '--name', 'lec-onpod', '--dry-run']);
  assert.equal(r.code, 0, r.out);
  for (const k of ['Onpod', 'static deploy', 'lec-onpod.onpod.ai', 'console.onpod.ai/signup', 'ONPOD_TOKEN', '사이트 10개', 'llms.txt']) assert.ok(r.out.includes(k), `${k} 없음\n${r.out}`);
  assert.ok(!existsSync(ologFile), '가짜 onpod도 부르지 않음');
});

test('publish --host onpod: _headers를 빼고 검색 제외 파일을 더한 사본을 올림, 토큰은 출력에 없음, 다음엔 --host 없이 같은 곳', () => {
  const token = 'op_u_FAKE1234567890abcdef';
  const r = orun(['publish', 'work', '--host', 'onpod', '--name', 'lec-onpod', '--no-verify', '--no-handouts'], { ONPOD_TOKEN: token });
  assert.equal(r.code, 0, r.out);
  assert.ok(!r.out.includes(token), '토큰이 화면에 없음');
  const log = readFileSync(ologFile, 'utf8');
  assert.ok(!log.includes('whoami'), '토큰이 있으면 로그인 확인을 건너뜀');
  assert.match(log, /^static deploy <dir> --name lec-onpod --no-spa --no-verify token=op_u_$/m);
  const files = log.match(/^files (.*)$/m)[1].split(',');
  for (const f of ['index.html', 'check.html', 'robots.txt', 'llms.txt', 'sitemap.xml', 'assets/lecpage.js']) assert.ok(files.includes(f), f);
  assert.ok(!files.includes('_headers'), 'Onpod은 _headers를 읽지 않아 올리지 않음');
  assert.ok(!existsSync(join(odir, 'dist', 'llms.txt')) && existsSync(join(odir, 'dist', '_headers')), 'dist는 그대로');
  const state = JSON.parse(readFileSync(join(odir, 'work', 'lecpage.state.json'), 'utf8'));
  assert.deepEqual([state.deploy.host, state.deploy.name, state.deploy.url], ['onpod', 'lec-onpod', 'https://lec-onpod.onpod.ai/']);
  assert.ok(r.out.includes('올렸어요 ✓ https://lec-onpod.onpod.ai/'));
  // 다시: --host·--name 없이도 Onpod·같은 이름
  const again = orun(['publish', 'work', '--no-verify', '--no-handouts'], { ONPOD_TOKEN: token });
  assert.equal(again.code, 0, again.out);
  assert.equal(readFileSync(ologFile, 'utf8').match(/--name lec-onpod/g).length, 2);
});

test('publish --host onpod: 로그인이 없으면 할 일을 알려 주고 멈춤, 이름이 이미 쓰이면 --name 안내, --live는 Cloudflare로', () => {
  const noauth = orun(['publish', 'work', '--host', 'onpod', '--no-verify', '--no-handouts'], { FAKE_ONPOD_NOAUTH: '1' });
  assert.notEqual(noauth.code, 0);
  assert.ok(noauth.out.includes('ONPOD_TOKEN') && noauth.out.includes('console.onpod.ai/signup'), noauth.out);
  const taken = orun(['publish', 'work', '--host', 'onpod', '--name', 'taken-name', '--no-verify', '--no-handouts'], { ONPOD_TOKEN: 'op_u_x0000000000', FAKE_ONPOD_TAKEN: '1' });
  assert.notEqual(taken.code, 0);
  assert.match(taken.out, /이미 다른 사람이 써요.*--name/);
  const live = orun(['publish', 'work', '--host', 'onpod', '--live']);
  assert.notEqual(live.code, 0);
  assert.ok(live.out.includes('--host cloudflare --live'), live.out);
});

test('publish --host onpod: Cloudflare 참여 기능 중계가 있으면 새 주소도 받게 고침(지난 주소와 함께)', () => {
  cpSync(join(dir, 'work', 'live-relay'), join(odir, 'work', 'live-relay'), { recursive: true });
  writeFileSync(join(odir, 'work', 'lecpage.state.json'), JSON.stringify({ out: '../dist', blueprint: 'blueprint.json', deploy: { host: 'cloudflare', name: 'lec-test', url: 'https://lec-test.fake-account.workers.dev/', relay: { name: 'lec-test-live', url: 'https://lec-test-live.fake-account.workers.dev' } } }));
  const r = orun(['publish', 'work', '--host', 'onpod', '--name', 'lec-moved', '--no-verify', '--no-handouts'], { ONPOD_TOKEN: 'op_u_x0000000000' });
  assert.equal(r.code, 0, r.out);
  assert.match(readFileSync(join(odir, 'wrangler.log'), 'utf8'), /ALLOWED_ORIGINS:https:\/\/lec-test\.fake-account\.workers\.dev,https:\/\/lec-moved\.onpod\.ai$/m);
  assert.ok(r.out.includes('새 주소도 받아요'));
  const state = JSON.parse(readFileSync(join(odir, 'work', 'lecpage.state.json'), 'utf8'));
  assert.equal(state.deploy.relay.name, 'lec-test-live', '중계 정보는 그대로');
});

test('Onpod 사본: 공개 연수는 첫 화면만 담은 sitemap과 robots.txt의 Sitemap 줄, 비공개는 짧은 llms.txt·빈 sitemap', async () => {
  const { onpodStage } = await import('../../scripts/publish.mjs');
  const src = mkdtempSync(join(tmpdir(), 'lecpage-stage-src-'));
  writeFileSync(join(src, 'index.html'), '<!doctype html>'); writeFileSync(join(src, '_headers'), '/*\n  X: y\n'); writeFileSync(join(src, '.lecpage-site'), 'x');
  writeFileSync(join(src, 'robots.txt'), 'User-agent: *\nAllow: /\n');
  const pub = onpodStage(src, { publicSite: true, url: 'https://lec-a.onpod.ai/' });
  assert.match(readFileSync(join(pub.stage, 'sitemap.xml'), 'utf8'), /<loc>https:\/\/lec-a\.onpod\.ai\/<\/loc>/);
  assert.match(readFileSync(join(pub.stage, 'robots.txt'), 'utf8'), /^Sitemap: https:\/\/lec-a\.onpod\.ai\/sitemap\.xml$/m);
  assert.ok(!existsSync(join(pub.stage, 'llms.txt')) && !existsSync(join(pub.stage, '_headers')) && !existsSync(join(pub.stage, '.lecpage-site')));
  writeFileSync(join(src, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  const priv = onpodStage(src, { publicSite: false, url: 'https://lec-a.onpod.ai/' });
  assert.ok(!/<url>/.test(readFileSync(join(priv.stage, 'sitemap.xml'), 'utf8')), '쪽 목록 없음');
  assert.match(readFileSync(join(priv.stage, 'llms.txt'), 'utf8'), /^# /);
  assert.equal(readFileSync(join(priv.stage, 'robots.txt'), 'utf8'), 'User-agent: *\nDisallow: /\n');
  for (const d of [src, pub.stage, priv.stage]) rmSync(d, { recursive: true, force: true });
});
