// lecpage 커넥트의 "Claude 계정 연결을 터미널 없이"(2026-11-21) 시험: 없으면 공식 설치 명령을 창 없이(가짜 설치, fixtures/fake-installer.mjs) →
// 진행 막대(받는 파일 크기 / 공식 목록 크기) → `claude auth login`(가짜 claude) → 코드 붙여넣기·저절로 끝남 → 연결 확인.
// 실패 안내(인터넷 없음·보안 프로그램·로그인 취소·틀린 코드)와 Claude 데스크톱 앱에 든 Claude Code 찾기. 실제 계정·실제 설치는 쓰지 않음.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import * as St from '../../scripts/studio.mjs';
import { classifyFailure, installSpec, downloading, SETUP_ERRORS } from '../../scripts/studio-setup.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const AGENT = join(HERE, 'fixtures', 'fake-agent.mjs');
const INSTALLER = [process.execPath, [join(HERE, 'fixtures', 'fake-installer.mjs')]];
const linux = process.platform === 'linux';
let T, DIST;
before(() => {
  T = mkdtempSync(join(tmpdir(), 'lp-studio-setup-'));
  DIST = join(T, 'dist'); mkdirSync(DIST);
  writeFileSync(join(DIST, 'index.html'), '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>앱</title></head><body></body></html>');
});
after(() => rmSync(T, { recursive: true, force: true }));

function req(port, method, path, { headers = {}, body } = {}) {
  return new Promise((ok, no) => {
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const r = http.request({ host: '127.0.0.1', port, method, path, headers: { host: `127.0.0.1:${port}`, ...(data ? { 'content-type': 'application/json', 'content-length': data.length } : {}), ...headers } }, (res) => {
      const ch = []; res.on('data', (c) => ch.push(c)); res.on('end', () => { const text = Buffer.concat(ch).toString('utf8'); ok({ status: res.statusCode, json: () => JSON.parse(text) }); });
    });
    r.on('error', no); if (data) r.write(data); r.end();
  });
}
function withEnv(vars, fn) {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  Object.assign(process.env, vars);
  const back = () => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } };
  return Promise.resolve().then(fn).finally(back);
}
const fakeClaude = (dir) => { mkdirSync(dir, { recursive: true }); const f = join(dir, 'claude'); writeFileSync(f, `#!/bin/sh\nexec "${process.execPath}" "${AGENT}" claude "$@"\n`); chmodSync(f, 0o755); return f; };
/** 공식 목록(manifest) 대신: 받을 파일 크기 600000 */
const fakeFetch = async (url) => ({ json: async () => (/manifest\.json$/.test(url) ? { platforms: { 'linux-x64': { size: 600000 } } } : {}) });
async function until(port, H, pred, ms = 15000) {
  let s = null;
  for (const end = Date.now() + ms; Date.now() < end;) { s = (await req(port, 'GET', '/bridge/setup', { headers: H })).json().setup; if (pred(s)) return s; await new Promise((r) => setTimeout(r, 60)); }
  throw new Error(`기다린 상태가 오지 않았어요: ${JSON.stringify(s)}`);
}
async function studio(env, fn, opts = {}) {
  const lines = [];
  await withEnv({ LECPAGE_STUDIO_TERMINAL: '', DISPLAY: '', WAYLAND_DISPLAY: '', XDG_CONFIG_HOME: '', ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '', LOCALAPPDATA: '', APPDATA: '', ...env }, async () => {
    if (!process.env.ANTHROPIC_API_KEY) delete process.env.ANTHROPIC_API_KEY;
    if (!process.env.ANTHROPIC_AUTH_TOKEN) delete process.env.ANTHROPIC_AUTH_TOKEN;
    const st = await St.startStudio({ port: 0, dist: DIST, home: mkdtempSync(join(T, 's-')), installer: INSTALLER, fetchImpl: fakeFetch, log: (l) => lines.push(l), ...opts });
    const H = { 'x-lecpage-bridge': st.S.token, origin: 'https://lecpage.com' };
    try { await fn(st, H, lines); } finally { await st.close(); }
  });
}

test('실패 출력 → 안내(인터넷 없음·보안 프로그램·로그인 취소·틀린 코드·메모리)', () => {
  assert.equal(classifyFailure('install', 'curl: (6) Could not resolve host: claude.ai', 6), 'offline');
  assert.equal(classifyFailure('install', 'Invoke-RestMethod : The remote name could not be resolved: \'claude.ai\'', 1), 'offline');
  assert.equal(classifyFailure('install', 'curl: (60) SSL certificate problem: unable to get local issuer certificate', 60), 'blocked');
  assert.equal(classifyFailure('install', 'This script contains malicious content and has been blocked by your antivirus software.', 1), 'blocked');
  assert.equal(classifyFailure('install', 'Failed to get a valid version from downloads.claude.ai (got unexpected content).', 1), 'blocked');
  assert.equal(classifyFailure('install', 'Killed', 137), 'memory');
  assert.equal(classifyFailure('install', '알 수 없음', 1), 'install-failed');
  assert.equal(classifyFailure('login', "Couldn't log in: That code wasn't accepted.", 1), 'bad-code');
  assert.equal(classifyFailure('login', "Couldn't log in: access_denied", 1), 'cancelled');
  assert.equal(classifyFailure('login', 'getaddrinfo ENOTFOUND claude.ai', 1), 'offline');
  assert.equal(classifyFailure('login', '???', 1), 'login-failed');
  for (const [k, e] of Object.entries(SETUP_ERRORS)) { assert.ok(e.title_ko && e.message_ko, k); assert.match(e.message_ko, /요\.$/, `${k}: 해요체`); }
});

test('공식 설치 명령을 창 없이: Windows는 PowerShell(TLS 1.2·진행 표시 끔) · macOS·Linux는 pipefail(curl 실패도 실패) · curl이 없으면 wget', () => {
  const [w, wa] = installSpec(St.OFFICIAL.claude, { platform: 'win32' });
  assert.equal(w, 'powershell.exe'); assert.ok(wa.includes('-NonInteractive'));
  assert.match(wa.at(-1), /SecurityProtocol.*3072.*\$ProgressPreference = 'SilentlyContinue'; irm https:\/\/claude\.ai\/install\.ps1 \| iex$/);
  assert.deepEqual(installSpec(St.OFFICIAL.claude, { platform: 'darwin' }), ['bash', ['-c', 'set -o pipefail; curl -fsSL https://claude.ai/install.sh | bash']]);
  assert.deepEqual(installSpec(St.OFFICIAL.claude, { platform: 'linux', has: (n) => n !== 'curl' })[1], ['-c', 'set -o pipefail; wget -qO- https://claude.ai/install.sh | bash']);
});

test('받는 중인 파일 이름 읽기(진행 막대): 판·기기·zst·.exe', () => {
  const at = (names, bytes = 5) => downloading('/h', { list: () => names, size: () => bytes });
  assert.deepEqual(at(['claude-2.1.330-linux-x64']), { version: '2.1.330', platform: 'linux-x64', zst: false, bytes: 5 });
  assert.deepEqual(at(['claude-2.1.330-darwin-arm64.zst']), { version: '2.1.330', platform: 'darwin-arm64', zst: true, bytes: 5 });
  assert.deepEqual(at(['claude-2.1.330-win32-x64.exe']), { version: '2.1.330', platform: 'win32-x64', zst: false, bytes: 5 });
  assert.deepEqual(at(['claude-2.1.330-linux-arm64-musl']), { version: '2.1.330', platform: 'linux-arm64-musl', zst: false, bytes: 5 });
  assert.equal(at(['other.txt']), null);
  assert.equal(downloading('/없는/폴더'), null);
});

test('Claude 데스크톱 앱에 든 Claude Code 찾기: 가장 새 판 · macOS .app 안 · Windows %APPDATA%·Microsoft Store 판 · Linux ~/.config', () => {
  const fs = (files) => ({ exists: (f) => files.includes(f), list: (d) => [...new Set(files.filter((f) => f.startsWith(d + (d.includes('\\') ? '\\' : '/'))).map((f) => f.slice(d.length + 1).split(/[\\/]/)[0]))] });
  const mac = '/Users/a/Library/Application Support/Claude/claude-code';
  assert.equal(St.desktopClaude({ platform: 'darwin', home: '/Users/a', env: {}, ...fs([`${mac}/2.1.119/claude.app/Contents/MacOS/claude`, `${mac}/2.1.330/claude.app/Contents/MacOS/claude`, `${mac}/2.1.40/claude`]) }), `${mac}/2.1.330/claude.app/Contents/MacOS/claude`);
  assert.equal(St.desktopClaude({ platform: 'darwin', home: '/Users/a', env: {}, ...fs([`${mac}/2.1.90/claude`]) }), `${mac}/2.1.90/claude`, '예전 자리');
  const win = 'C:\\Users\\a\\AppData\\Roaming\\Claude\\claude-code';
  assert.equal(St.desktopClaude({ platform: 'win32', home: 'C:\\Users\\a', env: { APPDATA: 'C:\\Users\\a\\AppData\\Roaming' }, ...fs([`${win}\\2.1.119\\claude.exe`, `${win}\\2.1.330\\claude.exe`]) }), `${win}\\2.1.330\\claude.exe`);
  const store = 'C:\\Users\\a\\AppData\\Local\\Packages\\Claude_pzs8sxrjxfjjc\\LocalCache\\Roaming\\Claude\\claude-code';
  assert.equal(St.desktopClaude({ platform: 'win32', home: 'C:\\Users\\a', env: { LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local' }, ...fs([`${store}\\2.1.320\\claude.exe`, 'C:\\Users\\a\\AppData\\Local\\Packages\\Other_1\\x']) }), `${store}\\2.1.320\\claude.exe`);
  assert.equal(St.desktopClaude({ platform: 'linux', home: '/home/a', env: {}, ...fs(['/home/a/.config/Claude/claude-code/2.1.330/claude']) }), '/home/a/.config/Claude/claude-code/2.1.330/claude');
  assert.equal(St.desktopClaude({ platform: 'win32', home: 'C:\\Users\\a', env: {}, ...fs([]) }), null);
});

test('없음 → 창 없이 설치(진행 막대) → 브라우저 로그인 → 코드 붙여넣기 → 연결됨 · 코드는 기록하지 않음', { skip: !linux && '리눅스만', timeout: 60000 }, async () => {
  const home = mkdtempSync(join(T, 'h-new-'));
  await studio({ PATH: '/usr/bin:/bin', HOME: home, FAKE_LOGIN_FILE: join(home, 'logged-in') }, async (st, H, lines) => {
    const s0 = (await req(st.port, 'GET', '/bridge/status?fresh', { headers: H })).json();
    assert.deepEqual([s0.agents[0].installed, s0.agents[0].need, s0.setup], [false, 'install', null]);
    assert.match(s0.agents[0].note_ko, /자동 설치/);
    assert.equal((await req(st.port, 'POST', '/bridge/agents/claude/setup', { headers: { origin: 'https://lecpage.com' }, body: {} })).status, 401, '토큰 없이는 못 함');
    assert.equal((await req(st.port, 'POST', '/bridge/agents/codex/setup', { headers: H, body: {} })).status, 404, 'Claude만');
    const r = (await req(st.port, 'POST', '/bridge/agents/claude/setup', { headers: H, body: {} })).json();
    assert.equal(r.ok, true); assert.equal(r.setup.running, true);
    assert.equal((await req(st.port, 'POST', '/bridge/agents/claude/setup', { headers: H, body: {} })).json().setup.startedAt, r.setup.startedAt, '하는 중에 또 누르면 같은 것');
    const mid = await until(st.port, H, (s) => s.step === 'install' && s.progress?.total === 600000 && s.progress.done > 0 && s.progress.done < 600000);
    assert.equal(mid.progress.phase, 'download');
    const lg = await until(st.port, H, (s) => s.step === 'login' && s.waitingCode && s.loginUrl);
    assert.equal(lg.install, 'done'); assert.equal(lg.loginUrl, 'https://claude.ai/oauth/authorize?z-fakecode');
    assert.equal((await req(st.port, 'GET', '/bridge/status', { headers: H })).json().setup.step, 'login', '상태에도(새로 고쳐도 이어 그림)');
    const bad = await req(st.port, 'POST', '/bridge/setup/code', { headers: H, body: { code: '코드 없이' } });
    assert.equal(bad.status, 400); assert.equal(bad.json().error, 'bad-code');
    assert.equal((await req(st.port, 'POST', '/bridge/setup/code', { headers: H, body: { code: '  abcd1234#state5678 ' } })).json().ok, true);
    const done = await until(st.port, H, (s) => !s.running);
    assert.equal(done.step, 'done'); assert.equal(done.error, null);
    const cl = (await req(st.port, 'GET', '/bridge/status?fresh', { headers: H })).json().agents[0];
    assert.deepEqual([cl.installed, cl.loggedIn, cl.ready], [true, true, true]);
    assert.ok(!lines.join('\n').includes('abcd1234'), '받은 코드는 lecpage 커넥트 창 기록에 남기지 않음');
    assert.ok(lines.some((l) => /창 없이/.test(l)) && lines.some((l) => /연결했어요/.test(l)));
    assert.equal((await req(st.port, 'POST', '/bridge/setup/code', { headers: H, body: { code: 'abcd#efgh' } })).status, 409, '끝난 뒤에는 받지 않음');
  });
});

test('이미 설치돼 있으면 설치 건너뜀 · 브라우저에서 로그인하면(localhost로 돌아옴) 코드 없이 저절로 끝남', { skip: !linux && '리눅스만', timeout: 60000 }, async () => {
  const home = mkdtempSync(join(T, 'h-auto-')); const bin = join(T, 'bin-auto'); fakeClaude(bin);
  await studio({ PATH: `${bin}:/usr/bin:/bin`, HOME: home, FAKE_LOGIN_FILE: join(home, 'logged-in'), FAKE_LOGIN_AUTO_MS: '700' }, async (st, H) => {
    await req(st.port, 'POST', '/bridge/agents/claude/setup', { headers: H, body: {} });
    const s = await until(st.port, H, (x) => !x.running);
    assert.deepEqual([s.step, s.install, s.codeSent], ['done', 'skip', false]);
  });
});

test('실패 안내: 인터넷 없음 · 보안 프로그램 · 로그인 취소 · 틀린 코드 · [취소]', { skip: !linux && '리눅스만', timeout: 90000 }, async () => {
  for (const [mode, code] of [['offline', 'offline'], ['blocked', 'blocked']]) {
    const home = mkdtempSync(join(T, `h-${mode}-`));
    await studio({ PATH: '/usr/bin:/bin', HOME: home, FAKE_INSTALL_MODE: mode }, async (st, H) => {
      await req(st.port, 'POST', '/bridge/agents/claude/setup', { headers: H, body: {} });
      const s = await until(st.port, H, (x) => !x.running);
      assert.equal(s.step, 'error'); assert.equal(s.error.code, code); assert.equal(s.error.at, 'install');
      assert.equal(s.error.title_ko, SETUP_ERRORS[code].title_ko); assert.match(s.tail, /curl: \(/, '자세한 내용(마지막 출력)');
      assert.equal((await req(st.port, 'GET', '/bridge/status', { headers: H })).json().setup.tail, undefined, '상태에는 출력을 싣지 않음');
    });
  }
  const bin = join(T, 'bin-fail'); fakeClaude(bin);
  const home = mkdtempSync(join(T, 'h-cancel-'));
  await studio({ PATH: `${bin}:/usr/bin:/bin`, HOME: home, FAKE_LOGIN_FILE: join(home, 'logged-in'), FAKE_LOGIN_CANCEL_MS: '400' }, async (st, H) => {
    await req(st.port, 'POST', '/bridge/agents/claude/setup', { headers: H, body: {} });
    const s = await until(st.port, H, (x) => !x.running);
    assert.deepEqual([s.step, s.error.code, s.error.at], ['error', 'cancelled', 'login']);
  });
  const home2 = mkdtempSync(join(T, 'h-bad-'));
  await studio({ PATH: `${bin}:/usr/bin:/bin`, HOME: home2, FAKE_LOGIN_FILE: join(home2, 'logged-in') }, async (st, H) => {
    await req(st.port, 'POST', '/bridge/agents/claude/setup', { headers: H, body: {} });
    await until(st.port, H, (x) => x.waitingCode);
    assert.equal((await req(st.port, 'POST', '/bridge/setup/code', { headers: H, body: { code: 'badcode#bad12345' } })).json().ok, true);
    const s = await until(st.port, H, (x) => !x.running);
    assert.equal(s.error.code, 'bad-code');
    // 다시 시도 → 로그인 기다리는 중에 [취소]
    await req(st.port, 'POST', '/bridge/agents/claude/setup', { headers: H, body: {} });
    await until(st.port, H, (x) => x.running && x.waitingCode);
    const stopped = (await req(st.port, 'DELETE', '/bridge/setup', { headers: H })).json().setup;
    assert.deepEqual([stopped.running, stopped.step, stopped.error], [false, 'stopped', null]);
  });
});

test('Claude 데스크톱 앱만 있으면 설치 없이 그 안의 Claude Code로(로그인만)', { skip: !linux && '리눅스만', timeout: 60000 }, async () => {
  const home = mkdtempSync(join(T, 'h-desk-'));
  fakeClaude(join(home, '.config', 'Claude', 'claude-code', '2.1.330'));
  await studio({ PATH: '/usr/bin:/bin', HOME: home, FAKE_LOGIN_FILE: join(home, 'logged-in'), FAKE_LOGIN_AUTO_MS: '300' }, async (st, H) => {
    const cl = (await req(st.port, 'GET', '/bridge/status?fresh', { headers: H })).json().agents[0];
    assert.deepEqual([cl.installed, cl.from, cl.need], [true, 'desktop', 'login']);
    await req(st.port, 'POST', '/bridge/agents/claude/setup', { headers: H, body: {} });
    const s = await until(st.port, H, (x) => !x.running);
    assert.deepEqual([s.step, s.install, s.from], ['done', 'skip', 'desktop']);
  });
});
