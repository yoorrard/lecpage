// lecpage 커넥트(lecpage Connect, 예전 이름 lecpage studio, scripts/studio.mjs) 시험.
// 진짜 claude·codex 대신 PATH 앞에 둔 가짜(fixtures/fake-agent.mjs)로 끝까지: 띄우기 → 토큰·Origin·Host 거절 → status →
// jobs(교재 PDF) → events → result(site·meta·issues) → DELETE·임시 폴더 지움 → 시간 한도·멈추기. 포트는 6600~6649만 씀.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, mkdirSync, chmodSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import { createRequire } from 'node:module';
import * as St from '../../scripts/studio.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', '..', 'scripts', 'lecpage.mjs');
const PDF = join(HERE, 'fixtures', 'workshop.pdf');
const REAL_DIST = join(HERE, '..', '..', '..', '..', 'app', 'dist');
const posix = process.platform !== 'win32';
let T, BIN, DIST, LOG;
const procs = [];
let firstToken = '';

before(() => {
  T = mkdtempSync(join(tmpdir(), 'lp-studio-test-'));
  BIN = join(T, 'bin'); DIST = join(T, 'dist'); LOG = join(T, 'agent.log');
  mkdirSync(BIN); mkdirSync(join(DIST, 'assets'), { recursive: true });
  for (const a of ['claude', 'codex']) {
    writeFileSync(join(BIN, a), `#!/bin/sh\nexec "${process.execPath}" "${join(HERE, 'fixtures', 'fake-agent.mjs')}" ${a} "$@"\n`);
    chmodSync(join(BIN, a), 0o755);
  }
  writeFileSync(join(DIST, 'index.html'), '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>앱</title></head><body><div id="app"></div></body></html>');
  writeFileSync(join(DIST, '404.html'), '<!doctype html><title>없음</title>');
  writeFileSync(join(DIST, 'assets', 'app-abcdef12.js'), 'console.log(1)');
  copyFileSync(join(HERE, '..', '..', '..', '..', 'app', 'public', '_headers'), join(DIST, '_headers'));
});
after(() => { for (const p of procs) { try { p.kill('SIGTERM'); } catch { /* 끝남 */ } } rmSync(T, { recursive: true, force: true }); });

/** lecpage 커넥트 띄우기 → { port, url, p }. cmd: connect(새 이름) 또는 studio(예전 이름) */
async function launch(env = {}, args = ['--dist', DIST], cmd = 'studio') {
  // NODE_USE_ENV_PROXY: 프록시 환경에서 CLI가 자기를 다시 띄우지 않게(시험이 끄는 프로세스 = lecpage 커넥트)
  // 짝 맞춤 토큰·ChatGPT 자격 폴더는 띄울 때마다 새 임시 폴더(실제 사용자 폴더를 건드리지 않게)
  const p = spawn(process.execPath, [CLI, cmd, '--no-open', '--json', ...args], { env: { ...process.env, NODE_USE_ENV_PROXY: '1', PATH: `${BIN}:${process.env.PATH}`, FAKE_AGENT_LOG: LOG, LECPAGE_STUDIO_SHOTS: '0', LECPAGE_STUDIO_HOME: mkdtempSync(join(T, 'home-')), ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  procs.push(p);
  let err = '';
  p.stderr.on('data', (d) => { err += d; });
  const line = await new Promise((ok, no) => {
    let b = '';
    p.stdout.on('data', (d) => { b += d; const i = b.indexOf('\n'); if (i >= 0) ok(b.slice(0, i)); });
    p.on('exit', (c) => no(new Error(`studio exit ${c}: ${err}`)));
    setTimeout(() => no(new Error('studio start timeout ' + err)), 30000).unref();
  });
  const j = JSON.parse(line);
  assert.ok(j.port >= 6600 && j.port <= 6649, '포트 범위 ' + j.port);
  return { p, ...j };
}
/** 날 요청(Host·Origin 머리글을 마음대로) */
function req(port, method, path, { headers = {}, body, host } = {}) {
  return new Promise((ok, no) => {
    const data = body === undefined ? null : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    const r = http.request({ host: '127.0.0.1', port, method, path, headers: { host: host || `127.0.0.1:${port}`, ...(data ? { 'content-type': 'application/json', 'content-length': data.length } : {}), ...headers } }, (res) => {
      const ch = []; res.on('data', (c) => ch.push(c)); res.on('end', () => { const text = Buffer.concat(ch).toString('utf8'); ok({ status: res.statusCode, headers: res.headers, text, json: () => JSON.parse(text) }); });
    });
    r.on('error', no);
    if (data) r.write(data);
    r.end();
  });
}
async function tokenOf(port) { const r = await req(port, 'GET', '/'); return r.text.match(/<meta name="lecpage-bridge" content="([0-9a-f]{64})">/)[1]; }
/** SSE 끝까지 받아 이벤트 목록 */
function events(port, token, id, timeout = 90000) {
  return new Promise((ok, no) => {
    const r = http.get({ host: '127.0.0.1', port, path: `/bridge/jobs/${id}/events`, headers: { 'x-lecpage-bridge': token } }, (res) => {
      assert.match(res.headers['content-type'], /text\/event-stream/);
      let b = ''; res.setEncoding('utf8'); res.on('data', (c) => { b += c; });
      res.on('end', () => ok(b.split('\n\n').map((m) => m.split('\n').find((l) => l.startsWith('data: '))).filter(Boolean).map((l) => JSON.parse(l.slice(6)))));
    });
    r.on('error', no);
    r.setTimeout(timeout, () => { r.destroy(); no(new Error('events timeout')); });
  });
}
const readLog = () => (existsSync(LOG) ? readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const waitFor = async (fn, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 100)); } return null; };

// ── 순수 함수 ───────────────────────────────────────────────────────────
test('윈도우: PATHEXT로 .cmd 찾기 → npm 심을 풀어 셸 없이 node로(.exe는 그대로)', () => {
  const env = { PATH: 'C:\\Tools;C:\\Users\\홍 길동\\AppData\\Roaming\\npm', PATHEXT: '.COM;.EXE;.BAT;.CMD' };
  const shim = 'C:\\Users\\홍 길동\\AppData\\Roaming\\npm\\claude.cmd';
  assert.equal(St.findExecutable('claude', { env, platform: 'win32', exists: (p) => p === shim }), shim);
  assert.equal(St.findExecutable('claude', { env, platform: 'win32', exists: () => false, extra: ['C:\\Users\\홍 길동\\.local\\bin'] }), null);
  const npmShim = '@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\n\r\nIF EXIST "%dp0%\\node.exe" (\r\n  SET "_prog=%dp0%\\node.exe"\r\n) ELSE (\r\n  SET "_prog=node"\r\n  SET PATHEXT=%PATHEXT:;.JS;=;%\r\n)\r\n\r\nendLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\node_modules\\@anthropic-ai\\claude-code\\cli.js" %*\r\n';
  assert.deepEqual(St.parseCmdShim(npmShim, shim), { file: 'C:\\Users\\홍 길동\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js', node: true });
  const spec = St.launchSpec(shim, ['-p', '글'], { platform: 'win32', read: () => npmShim, node: 'C:\\node\\node.exe' });
  assert.deepEqual(spec, { command: 'C:\\node\\node.exe', args: ['C:\\Users\\홍 길동\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js', '-p', '글'] });
  const exeShim = '@ECHO off\r\n"%dp0%\\node_modules\\@openai\\codex\\vendor\\codex.exe"   %*\r\n';
  assert.deepEqual(St.launchSpec('C:\\npm\\codex.cmd', ['exec'], { platform: 'win32', read: () => exeShim }), { command: 'C:\\npm\\node_modules\\@openai\\codex\\vendor\\codex.exe', args: ['exec'] });
  assert.deepEqual(St.launchSpec('C:\\x\\claude.exe', ['a'], { platform: 'win32' }), { command: 'C:\\x\\claude.exe', args: ['a'] });
  assert.throws(() => St.launchSpec('C:\\x\\odd.cmd', [], { platform: 'win32', read: () => 'echo hi' }));
});

test('판 비교·교재 이름·_headers·토큰 넣기', () => {
  assert.ok(St.versionAtLeast('2.1.320', St.CLAUDE_MIN) && St.versionAtLeast('2.2.0', '2.1.314') && !St.versionAtLeast('2.1.248', '2.1.314'));
  assert.equal(St.safeName('../../교재 1.pdf'), '교재 1.pdf');
  assert.equal(St.safeName('C:\\x\\con.pdf'), '_con.pdf');
  assert.equal(St.safeName('a<b>:"c".PPTX'), 'a_b___c_.PPTX');
  assert.equal(St.safeName('run.exe'), null);
  assert.equal(St.safeName('...'), null);
  const rules = St.parseHeadersFile(readFileSync(join(DIST, '_headers'), 'utf8'));
  const root = St.headersFor(rules, '/');
  assert.match(root['content-security-policy'], /frame-ancestors 'none'/);
  assert.equal(root['strict-transport-security'], undefined);
  assert.match(St.headersFor(rules, '/assets/app-abcdef12.js')['cache-control'], /immutable/);
  assert.match(St.headersFor(rules, '/examples/data-lab/index.html')['content-security-policy'], /frame-ancestors 'self'/);
  const html = St.injectToken('<html><head><meta name="lecpage-bridge" content="old"><title>t</title></head></html>', 'a'.repeat(64));
  assert.equal(html.match(/lecpage-bridge/g).length, 1);
  assert.match(html, /<head>\n<meta name="lecpage-bridge" content="a{64}">/);
});

test('요청 검사: Host 정확히·Origin 정확히·다른 사이트·토큰', () => {
  const S = { hostPort: '127.0.0.1:6600', origin: 'http://127.0.0.1:6600', token: 'b'.repeat(64) };
  const R = (method, headers) => ({ method, headers: { host: '127.0.0.1:6600', ...headers } });
  const ok = { 'x-lecpage-bridge': S.token };
  assert.equal(St.checkRequest(R('GET', ok), S, { bridge: true }), null);
  assert.equal(St.checkRequest(R('POST', { ...ok, origin: S.origin, 'sec-fetch-site': 'same-origin' }), S, { bridge: true }), null);
  assert.equal(St.checkRequest(R('GET', { ...ok, host: 'evil.example:6600' }), S, { bridge: false }).status, 421);
  assert.equal(St.checkRequest(R('GET', { ...ok, host: 'localhost:6600' }), S, { bridge: true }).status, 421);
  assert.equal(St.checkRequest(R('GET', { ...ok, origin: 'http://127.0.0.1:6601' }), S, { bridge: true }).status, 403);
  assert.equal(St.checkRequest(R('GET', { ...ok, origin: 'null' }), S, { bridge: true }).status, 403);
  assert.equal(St.checkRequest(R('GET', { ...ok, 'sec-fetch-site': 'cross-site' }), S, { bridge: true }).status, 403);
  assert.equal(St.checkRequest(R('POST', ok), S, { bridge: true }).status, 403);
  assert.equal(St.checkRequest(R('OPTIONS', { ...ok, origin: S.origin }), S, { bridge: true }).status, 403);
  assert.equal(St.checkRequest(R('GET', { 'x-lecpage-bridge': 'b'.repeat(63) + 'c' }), S, { bridge: true }).status, 401);
  assert.equal(St.checkRequest(R('GET', {}), S, { bridge: true }).status, 401);
  assert.equal(St.checkRequest(R('GET', {}), S, { bridge: false }), null);
});

test('에이전트 인자: 공식 옵션 이름(Claude: 도구·검수 명령만 허용·밖 막기·훅 끔·MCP 없음, Codex: workspace-write)', () => {
  const a = St.agentArgs('claude', { ws: '/w', platform: 'linux' });
  const after = (k) => a[a.indexOf(k) + 1];
  assert.equal(a[0], '-p');
  assert.equal(after('--output-format'), 'stream-json');
  assert.ok(a.includes('--verbose') && a.includes('--restricted') && a.includes('--strict-mcp-config') && a.includes('--no-session-persistence'));
  assert.equal(after('--tools'), 'Read,Write,Edit,Glob,Grep,Bash');
  assert.deepEqual(a.slice(a.indexOf('--allowedTools') + 1, a.indexOf('--disallowedTools')), ['Read', 'Write', 'Edit', 'Glob', 'Grep', `Bash(${St.CHECK_CMD})`]);
  assert.equal(after('--disallowedTools'), 'mcp__*');
  assert.equal(after('--permission-mode'), 'dontAsk');
  assert.equal(after('--permission-prompts'), 'none');
  const s = JSON.parse(after('--settings'));
  assert.equal(s.disableAllHooks, true);
  assert.equal(s.permissions.blockReadsOutsideWorkingDirectories, true);
  assert.equal(s.permissions.blockWritesOutsideWorkingDirectories, true);
  assert.ok(!a.includes('--bare'), '--bare는 구독 로그인을 읽지 않음');
  const w = St.agentArgs('claude', { ws: 'C:\\w', platform: 'win32' });
  assert.equal(w[w.indexOf('--tools') + 1], 'Read,Write,Edit,Glob,Grep,Bash,PowerShell');
  assert.ok(w.includes(`PowerShell(${St.CHECK_CMD})`));
  assert.deepEqual(St.agentArgs('codex', { ws: '/w' }).slice(0, 8), ['exec', '--json', '--cd', '/w', '--sandbox', 'workspace-write', '--skip-git-repo-check', '--ephemeral']);
  const t = St.taskText({ kind: 'make', materials: ['교재.pdf'], pages: 3, images: 3, request: '따뜻하게' });
  assert.ok(t.includes('```\n' + St.CHECK_CMD + '\n```'), '작업 지시의 검수 명령 = 허용 규칙');
  assert.match(t, /p-001 ~ p-003/);
  assert.ok(!/material\.md/.test(t), 'PDF 교재면 코드가 뽑은 글자를 알리지 않음(원본을 직접 읽음)');
  assert.match(St.taskText({ kind: 'make', materials: ['교재.hwpx'], pages: 2, images: 0, md: true }), /work\/material\.md/);
});

test('단계 줄이기: claude stream-json·codex JSONL → 사람이 읽을 단계(같은 단계는 한 번), 허용 밖 도구는 멈춤', () => {
  const evs = [];
  const s = new St.Stager((e) => evs.push(e), { agent: 'claude', ws: '/w' });
  s.step('start');
  s.claude({ type: 'system', subtype: 'init', tools: ['Read', 'Bash'], mcp_servers: [] });
  s.claude({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: '/w/kit.md' } }, { type: 'tool_use', name: 'Read', input: { file_path: '/etc/passwd' } }] } });
  s.claude({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Write', input: { file_path: '/w/work/site/assets/style.css' } }, { type: 'tool_use', name: 'Write', input: { file_path: '/w/work/site/index.html' } }, { type: 'tool_use', name: 'Bash', input: { command: St.CHECK_CMD } }, { type: 'tool_use', name: 'Edit', input: { file_path: '/w/work/site/index.html' } }, { type: 'tool_use', name: 'Edit', input: { file_path: '/w/work/site/index.html' } }] } });
  s.claude({ type: 'system', subtype: 'api_retry', error: 'rate_limit' });
  s.claude({ type: 'result', subtype: 'success', is_error: false, num_turns: 4, total_cost_usd: 0.5, result: '끝' });
  assert.deepEqual(evs.filter((e) => e.type === 'step').map((e) => e.name), ['start', 'read', 'design', 'write', 'check', 'fix']);
  assert.equal(evs[0].label_ko, 'Claude Code 켜는 중…');
  assert.ok(evs.some((e) => e.text === '읽는 중: passwd'), '작업 폴더 밖 경로는 이름만');
  assert.ok(evs.some((e) => /사용 한도/.test(e.text || '')));
  assert.equal(s.summary.turns, 4);
  assert.equal(s.unsafe, '');
  s.claude({ type: 'system', subtype: 'init', tools: ['Read', 'mcp__x__y'], mcp_servers: [{ name: 'x' }] });
  assert.match(s.unsafe, /허용하지 않은 도구/);
  const ce = [];
  const c = new St.Stager((e) => ce.push(e), { agent: 'codex', ws: '/w' });
  c.codex({ type: 'item.started', item: { type: 'command_execution', command: 'bash -lc "cat work/material.md"' } });
  c.codex({ type: 'item.completed', item: { type: 'file_change', changes: [{ path: '/w/work/lecpage.json', kind: 'add' }] } });
  c.codex({ type: 'item.started', item: { type: 'command_execution', command: `bash -lc '${St.CHECK_CMD}'` } });
  c.codex({ type: 'turn.failed', error: { message: '한도' } });
  assert.deepEqual(ce.filter((e) => e.type === 'step').map((e) => e.name), ['read', 'meta', 'check']);
  assert.equal(c.summary.ok, false);
  // 실제 실행(2026-11-21)에서 본 순서: 쓰기 전에 검수부터 돌려 본 뒤 사이트를 씀 → '검수 결과대로 고치는 중'이 아니라 '사이트 쓰는 중'
  const pe = [];
  const pre = new St.Stager((e) => pe.push(e), { agent: 'claude', ws: '/w' });
  pre.command(St.CHECK_CMD);
  pre.write('/w/work/site/index.html');
  pre.command(St.CHECK_CMD);
  pre.write('/w/work/site/index.html');
  assert.deepEqual(pe.filter((e) => e.type === 'step').map((e) => e.name), ['check', 'write', 'check', 'fix']);
});

// ── 띄워서 끝까지 ─────────────────────────────────────────────────────────
test('띄우기(새 이름 connect) → 앱 파일(토큰 넣기·_headers·경로 막기) → 거절(토큰·Origin·Host) → status', { skip: !posix && '셸 스크립트 가짜는 POSIX에서만' }, async () => {
  const st = await launch({}, ['--dist', DIST], 'connect');
  const { port } = st;
  assert.equal(st.app, 'dist');
  assert.equal(st.url, `http://127.0.0.1:${port}/`);
  assert.ok(!JSON.stringify(st).match(/[0-9a-f]{64}/), '터미널(JSON)에 토큰 없음');
  const home = await req(port, 'GET', '/');
  assert.equal(home.status, 200);
  assert.match(home.text, /<div id="app">/);
  assert.equal(home.headers['cache-control'], 'no-store');
  assert.equal(home.headers['x-frame-options'], 'DENY');
  assert.match(home.headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.equal(home.headers['cross-origin-resource-policy'], 'same-origin', '토큰이 든 첫 화면은 다른 출처가 불러 쓰지 못하게');
  assert.equal(home.headers['cross-origin-opener-policy'], 'same-origin');
  const token = await tokenOf(port);
  assert.equal(await tokenOf(port), token, '한 번 띄운 동안은 같은 토큰');
  if (firstToken) assert.notEqual(token, firstToken, '띄울 때마다 새 토큰'); else firstToken = token;
  const js = await req(port, 'GET', '/assets/app-abcdef12.js');
  assert.equal(js.status, 200); assert.match(js.headers['cache-control'], /immutable/); assert.match(js.headers['content-type'], /javascript/);
  assert.equal((await req(port, 'GET', '/nope')).status, 404);
  assert.equal((await req(port, 'GET', '/..%2f..%2fetc%2fpasswd')).status, 404);
  assert.equal((await req(port, 'GET', '/', { host: 'evil.example:' + port })).status, 421, 'DNS 리바인딩');
  const lh = await req(port, 'GET', '/x?y=1', { host: 'localhost:' + port });
  assert.equal(lh.status, 307); assert.equal(lh.headers.location, `http://127.0.0.1:${port}/x?y=1`);
  const H = { 'x-lecpage-bridge': token };
  assert.equal((await req(port, 'GET', '/bridge/status')).status, 401);
  assert.equal((await req(port, 'GET', '/bridge/status', { headers: { 'x-lecpage-bridge': 'f'.repeat(64) } })).status, 401);
  // lecpage.com(허용 목록)은 받음 + 그 출처에만 CORS. 다른 사이트는 거절(CORS 머리글 없음)
  const fromSite = await req(port, 'GET', '/bridge/status', { headers: { ...H, origin: 'https://lecpage.com', 'sec-fetch-site': 'cross-site' } });
  assert.equal(fromSite.status, 200); assert.equal(fromSite.headers['access-control-allow-origin'], 'https://lecpage.com'); assert.equal(fromSite.headers.vary, 'Origin');
  assert.equal((await req(port, 'GET', '/bridge/status', { headers: { origin: 'https://lecpage.com' } })).status, 401, 'lecpage.com이어도 토큰은 있어야 함');
  const evil = await req(port, 'GET', '/bridge/status', { headers: { ...H, origin: 'https://lecpage.com.evil.example' } });
  assert.equal(evil.status, 403); assert.equal(evil.headers['access-control-allow-origin'], undefined);
  const pre = await req(port, 'OPTIONS', '/bridge/chatgpt/responses', { headers: { origin: 'https://lecpage.com', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,x-lecpage-bridge', 'access-control-request-private-network': 'true' } });
  assert.equal(pre.status, 204); assert.equal(pre.headers['access-control-allow-origin'], 'https://lecpage.com'); assert.equal(pre.headers['access-control-allow-private-network'], 'true'); assert.match(pre.headers['access-control-allow-headers'], /X-Lecpage-Bridge/);
  assert.equal((await req(port, 'GET', '/bridge/status', { headers: { ...H, 'sec-fetch-site': 'cross-site' } })).status, 403);
  assert.equal((await req(port, 'GET', '/bridge/status', { headers: H, host: 'localhost:' + port })).status, 421);
  assert.equal((await req(port, 'OPTIONS', '/bridge/jobs', { headers: { origin: 'http://evil.example', 'access-control-request-method': 'POST' } })).status, 403);
  const noOrigin = await req(port, 'POST', '/bridge/jobs', { headers: H, body: { agent: 'claude' } });
  assert.equal(noOrigin.status, 403);
  assert.equal(noOrigin.headers['access-control-allow-origin'], undefined);
  const O = { ...H, origin: `http://127.0.0.1:${port}` };
  assert.equal((await req(port, 'POST', '/bridge/jobs', { headers: { ...O, 'content-type': 'text/plain' }, body: '{}' })).status, 415);
  const s = await req(port, 'GET', '/bridge/status', { headers: H });
  assert.equal(s.status, 200);
  const sj = s.json();
  assert.equal(sj.ok, true); assert.ok(sj.version);
  const cl = sj.agents.find((a) => a.id === 'claude'), cx = sj.agents.find((a) => a.id === 'codex');
  assert.deepEqual([cl.installed, cl.version, cl.auth, cl.loggedIn, cl.ready], [true, '2.1.320', 'subscription', true, true]);
  assert.deepEqual([cx.installed, cx.version, cx.auth, cx.ready], [true, '0.130.0', 'subscription', true]);
  assert.equal(cl.file, undefined, '실행 파일 경로(사용자 이름)는 앱에 주지 않음');
  assert.match(sj.policy_ko.claude, /Claude Code를 그대로/);
  // 잘못된 작업 요청
  const bad = async (body) => (await req(port, 'POST', '/bridge/jobs', { headers: O, body })).json();
  assert.match((await bad({ agent: 'gpt' })).message_ko, /claude/);
  assert.match((await bad({ agent: 'claude', kind: 'make', files: [] })).message_ko, /교재 파일/);
  assert.match((await bad({ agent: 'claude', files: [{ name: 'x.exe', base64: 'AA==' }] })).message_ko, /받지 않는 파일/);
  assert.match((await bad({ agent: 'claude', kind: 'edit', site: {} })).message_ko, /index\.html/);
  st.p.kill('SIGTERM');
});

test('두 번 켜면(같은 사용자): 둘째는 켜진 커넥트를 알려 주고 끝남(다른 포트에 또 띄우지 않음) · 새 판으로 다시 켜는 것(감독)은 그대로 새로', { skip: !posix && 'POSIX만', timeout: 60000 }, async () => {
  const home = mkdtempSync(join(T, 'twice-'));
  const env = { LECPAGE_STUDIO_HOME: home };
  const first = await launch(env, []);
  try {
    const second = await launch(env, []);
    assert.equal(second.running, true, JSON.stringify(second));
    assert.equal(second.port, first.port, '켜진 것의 주소');
    assert.equal(await new Promise((ok) => (second.p.exitCode !== null ? ok(second.p.exitCode) : second.p.on('exit', ok))), 0, '둘째는 바로 끝남');
    assert.equal((await req(first.port, 'GET', '/bridge/status', { headers: { 'x-lecpage-bridge': await tokenOf(first.port) } })).status, 200, '첫째는 그대로');
    // 포트를 정해 켜는 것(새 판으로 다시 켤 때 감독이 쓰는 꼴: --port <같은 포트>, LECPAGE_CONNECT_RESTARTED=1)은 찾지 않고 새로 켬
    const other = await launch({ ...env, LECPAGE_CONNECT_RESTARTED: '1' }, ['--port', String(first.port + 1 <= 6649 ? first.port + 1 : first.port - 1)]);
    assert.notEqual(other.running, true); assert.notEqual(other.port, first.port);
    other.p.kill('SIGTERM');
  } finally { first.p.kill('SIGTERM'); }
});

// 구독 계정 길에서 PDF 교재로 만들 때 이 PC에 PDF 읽기 도구가 없어 작업이 멈추던 것(실제 사용자 신고, 2026-11-22):
// 커넥트 묶음에 pdf.js를 넣었고(package.sh), 그래도 미리 읽기가 안 되면 원본 PDF·앱이 그린 쪽 그림으로 멈추지 않고 이어 감
test('jobs: PDF 읽기 도구가 없는 PC에서도 PDF 교재로 만들기가 멈추지 않음(원본·앱 쪽 그림으로 이어 감, 어려운 말 없음)', { skip: !posix && '셸 스크립트 가짜는 POSIX에서만', timeout: 180000 }, async () => {
  rmSync(LOG, { force: true });
  const st = await launch({ LECPAGE_NO_PDFJS: '1', LECPAGE_NO_PYTHON: '1' }); // pdf.js도 파이썬 보조 도구도 없는 PC
  const { port } = st;
  const token = await tokenOf(port);
  const O = { 'x-lecpage-bridge': token, origin: `http://127.0.0.1:${port}` };
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const body = { agent: 'claude', kind: 'make', request: '', meta: { title: '' }, files: [{ name: '연수 교재.pdf', type: 'application/pdf', base64: readFileSync(PDF).toString('base64') }], site: { 'material/p-001.png': { base64: png.toString('base64') } } };
  const r = await req(port, 'POST', '/bridge/jobs', { headers: O, body });
  assert.equal(r.status, 202, r.text);
  const evs = await events(port, token, r.json().jobId);
  const last = evs.at(-1);
  assert.equal(last.type, 'done', JSON.stringify(evs.filter((e) => e.type !== 'log').slice(-3)));
  assert.ok(evs.some((e) => e.type === 'log' && /미리 읽기를 건너뛰었어요/.test(e.text)), '건너뛴 까닭은 기록에만 ' + JSON.stringify(evs.map((e) => e.type === 'log' ? 'log:' + e.text.slice(0, 80) : e.type + ':' + (e.name || ''))));
  assert.ok(!evs.some((e) => /pdfjs|npm i|PyMuPDF|python/i.test(JSON.stringify(e.type === 'log' ? '' : e))), '사용자에게 보이는 단계·결과에 개발자 말이 없음');
});

// 받는 교재 형식 전부를 같은 눈으로(운영자 요청, 2026-11-23): 변환·그리기 도구가 없는 PC(묶음과 Node뿐)에서 에이전트가 실제로 받는 것과
// 작업 지시가 어긋나지 않는지. 앱이 그려 보낸 쪽 그림의 주인, 쪽 그림이 없는 교재, 읽지 못한 교재, 에이전트가 볼 수 없는 걸린 링크 주소, 통째로 못 여는 큰 PDF.
// (형식마다 읽히는지·쪽 번호 맞춤의 자세한 경우는 prepare-formats.test.mjs)
test('jobs: 변환·그리기 도구가 없는 PC에서 형식마다 작업 지시가 있는 그대로(쪽 그림의 주인·없는 것·읽지 못한 교재·걸린 링크 주소·큰 PDF)', { skip: !posix && '셸 스크립트 가짜는 POSIX에서만', timeout: 300000 }, async () => {
  const st = await launch({ PATH: BIN, LECPAGE_NO_PYTHON: '1' }); // PATH에 가짜 에이전트뿐: LibreOffice·pdftoppm·파이썬을 찾지 못함
  const { port } = st;
  const token = await tokenOf(port);
  const O = { 'x-lecpage-bridge': token, origin: `http://127.0.0.1:${port}` };
  const fx = (n) => readFileSync(join(HERE, 'fixtures', n));
  const file = (name, bytes, more = {}) => ({ name, base64: Buffer.from(bytes).toString('base64'), ...more });
  const shots = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`material/p-${String(i + 1).padStart(3, '0')}.webp`, { base64: 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==' }]));
  const oldPpt = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(1200)]); // 예전 파워포인트(.ppt)처럼 보이는 파일
  const run = async (files, site) => {
    rmSync(LOG, { force: true });
    const r = await req(port, 'POST', '/bridge/jobs', { headers: O, body: { agent: 'claude', kind: 'make', request: '', meta: { title: '' }, files, ...(site ? { site } : {}) } });
    assert.equal(r.status, 202, r.text);
    const evs = await events(port, token, r.json().jobId);
    await req(port, 'DELETE', `/bridge/jobs/${r.json().jobId}`, { headers: O });
    assert.ok(!evs.some((e) => e.type !== 'log' && /pdfjs|npm i|PyMuPDF|python|LibreOffice|pdftoppm|poppler/i.test(JSON.stringify(e))), '사용자에게 보이는 단계·결과에 개발자 말이 없음');
    return { evs, last: evs.at(-1), got: readLog().find((l) => l.id === 'claude' && l.argv) };
  };
  const heads = (md) => String(md || '').split('\n').filter((l) => l.startsWith('## '));
  try {
    // 1) PPTX + 앱이 그려 보낸 쪽 그림: 그 그림 그대로(다시 그리지 않음), 보조 글자의 쪽 번호가 그림 번호와 맞고 '쪽 그림 없음'이라고 하지 않음
    let x = await run([file('강의.pptx', fx('workshop.pptx'))], shots(13));
    assert.equal(x.last.type, 'done', JSON.stringify(x.evs.slice(-2)));
    assert.match(x.got.task, /교재 쪽 그림: `work\/site\/material\/` \(p-001 ~ p-013, \.webp\) — 사이트에 그대로/);
    assert.match(x.got.task, /`work\/material\.md` \(쪽 그림에 없는 것만 찾아요/);
    assert.match(x.got.task, /걸린 링크 주소\(쪽 그림과 PDF에서는 보이지 않아요\): `work\/links\.md`/);
    assert.equal(x.got.shots.length, 13);
    assert.ok(heads(x.got.md).length === 13 && heads(x.got.md).every((h, i) => h.startsWith(`## p-${String(i + 1).padStart(3, '0')} · 강의.pptx ${i + 1}쪽`)), heads(x.got.md).slice(0, 2).join(' / '));
    assert.ok(!/쪽 그림 없음/.test(x.got.md));
    assert.match(x.got.links, /강의\.pptx 8쪽: 제미나이 바로가기 → https:\/\/gemini\.google\.com\//);

    // 2) PPTX만(앱이 쪽 그림을 못 보냄): 쪽 그림 줄이 없고, 보조 글자가 '쪽 그림에 없는 것만'이라고 하지 않음
    x = await run([file('강의.pptx', fx('workshop.pptx'))]);
    assert.equal(x.last.type, 'done');
    assert.ok(!/교재 쪽 그림:/.test(x.got.task), '없는 쪽 그림을 있다고 하지 않음');
    assert.match(x.got.task, /`work\/material\.md` \(쪽 그림이 없는 교재예요/);
    assert.match(heads(x.got.md)[0], /\(쪽 그림 없음\)$/);

    // 3) 한글 + 앱 쪽 그림 4장(읽은 '부분'은 3개): 그림 범위는 실제 그림대로, 부분 번호를 그림 번호라고 하지 않음
    x = await run([file('계획.hwp', fx('plan.hwp'))], shots(4));
    assert.equal(x.last.type, 'done');
    assert.match(x.got.task, /\(p-001 ~ p-004, \.webp\)/);
    assert.ok(heads(x.got.md).every((h) => /^## 계획\.hwp \d번째 부분/.test(h)), heads(x.got.md).join(' / '));
    assert.match(x.got.md, /계획\.hwp를 쪽마다 그린 것이라 아래 번호와는 차례가 달라요/);

    // 4) 교재 여럿: 쪽 그림은 앱이 알려 준 교재 하나의 것 · 다른 교재는 쪽 그림이 없다고 · 읽지 못한 교재는 말없이 빼지 않음
    x = await run([file('강의.pptx', fx('workshop.pptx')), file('안내.docx', fx('guide.docx'), { pageImages: true }), file('옛날.ppt', oldPpt)], shots(2));
    assert.equal(x.last.type, 'done', JSON.stringify(x.evs.slice(-2)));
    assert.match(x.got.task, /\(p-001 ~ p-002, \.webp\) — `안내\.docx`의 쪽 그림이에요\. 사이트에 그대로/);
    assert.match(x.got.task, /쪽 그림이 없는 교재: `강의\.pptx`\n/);
    assert.match(x.got.task, /읽지 못한 교재: `옛날\.ppt` — 파일을 열지 못해/);
    assert.ok(x.evs.some((e) => e.type === 'log' && /읽지 못한 교재는 빼고 만들어요: 옛날\.ppt/.test(e.text)));
    assert.ok(heads(x.got.md).every((h) => !/^## p-/.test(h)), '워드의 쪽 그림 번호를 슬라이드에 붙이지 않음');

    // 5) 예전 앱(어느 교재의 쪽 그림인지 알려 주지 않음) + 교재 둘: 모른다고 적음
    x = await run([file('강의.pptx', fx('workshop.pptx')), file('안내.docx', fx('guide.docx'))], shots(2));
    assert.match(x.got.task, /\(p-001 ~ p-002, \.webp\) — 넣은 교재 가운데 하나의 쪽 그림이에요\./);
    assert.ok(!/쪽 그림이 없는 교재:/.test(x.got.task));
    assert.match(x.got.md, /쪽 그림이 어느 교재의 몇 쪽인지는 여기 적혀 있지 않아요/);

    // 5-2) 새 앱(교재마다 그려 이어서 번호를 매겨 보냄, pageImages { first, count }): 어느 번호가 어느 교재의 것인지 그대로 · 슬라이드는 쪽마다 맞춤
    x = await run([file('강의.pptx', fx('workshop.pptx'), { pageImages: { first: 1, count: 13 } }), file('안내.docx', fx('guide.docx'), { pageImages: { first: 14, count: 2 } })], shots(15));
    assert.equal(x.last.type, 'done', JSON.stringify(x.evs.slice(-2)));
    assert.match(x.got.task, /\(p-001 ~ p-015, \.webp\) — 교재마다 이어서 번호를 매겼어요\(`강의\.pptx` p-001~p-013, `안내\.docx` p-014~p-015\)\. 사이트에 그대로/);
    assert.ok(!/쪽 그림이 없는 교재:|넣은 교재 가운데 하나/.test(x.got.task));
    assert.match(x.got.md, /교재마다 이어서 번호를 매겼어요\(강의\.pptx p-001~p-013, 안내\.docx p-014~p-015\)/);
    assert.ok(heads(x.got.md).some((h) => /^## p-013 · 강의\.pptx 13쪽/.test(h)) && heads(x.got.md).every((h) => !/^## p-01[45]/.test(h)), '워드의 쪽 그림 번호를 부분에 붙이지 않음');
    // 묶음 표시가 틀린 값이면(음수·글자) 받지 않고 예전처럼 '모름'으로
    x = await run([file('강의.pptx', fx('workshop.pptx'), { pageImages: { first: 0, count: 13 } }), file('안내.docx', fx('guide.docx'), { pageImages: 'yes' })], shots(2));
    assert.match(x.got.task, /넣은 교재 가운데 하나의 쪽 그림이에요\./);

    // 6) 읽지 못하는 교재 하나뿐: 어느 파일이 왜 안 됐고 무엇을 하면 되는지 쉬운 말로
    x = await run([file('옛날.ppt', oldPpt)]);
    assert.equal(x.last.type, 'error'); assert.equal(x.last.code, 'prepare');
    assert.match(x.last.error, /^'옛날\.ppt' 교재를 읽지 못했어요\. 예전 파워포인트 파일\(\.ppt\)은 바로 읽을 수 없어요\..*PDF/);
    assert.equal(x.got, undefined, '에이전트를 켜지 않음');

    // 7) PDF: 보조 글자는 없고, 원본을 읽어도 나오지 않는 걸린 링크 주소만 따로
    x = await run([file('연수 교재.pdf', readFileSync(PDF))], shots(13));
    assert.equal(x.last.type, 'done');
    assert.ok(!/material\.md/.test(x.got.task) && x.got.md === null, 'PDF 교재면 보조 글자 없음');
    assert.match(x.got.task, /`work\/links\.md`/);
    assert.match(x.got.links, /연수 교재\.pdf 11쪽: NotebookLM 열기 → https:\/\/notebooklm\.google\.com\//);

    // 8) 20MB가 넘는 PDF + 쪽별로 여는 도구(poppler)가 없는 PC: Claude Code가 원본을 열지 못하므로(통째로는 20MB까지, 실측) 코드가 뽑은 글을 두고 그대로 알림
    const big = Buffer.concat([readFileSync(PDF), Buffer.from('\n'), Buffer.alloc(21 * 1024 * 1024, '%pad\n')]);
    x = await run([file('큰 교재.pdf', big)]);
    assert.equal(x.last.type, 'done', JSON.stringify(x.evs.slice(-2)));
    assert.match(x.got.task, /20MB가 넘는 PDF\(`큰 교재\.pdf`\)는 이 PC에서 원본이 열리지 않을 수 있어, 코드가 뽑은 글자를 `work\/material\.md`에 넣었어요/);
    assert.ok(!/PDF가 아닌 교재에서 코드가 뽑은 글자/.test(x.got.task));
    assert.equal(heads(x.got.md).length, 13); assert.match(heads(x.got.md)[0], /^## p-001 · 큰 교재\.pdf 1쪽/);
  } finally { st.p.kill('SIGTERM'); }
});

test('jobs: Claude로 교재 PDF → events(단계) → result(site·meta·issues) → DELETE, 에이전트는 빈 임시 폴더·옵션 그대로·검수 명령 실행', { skip: !posix && '셸 스크립트 가짜는 POSIX에서만', timeout: 180000 }, async () => {
  rmSync(LOG, { force: true });
  const st = await launch();
  const { port } = st;
  const token = await tokenOf(port);
  const O = { 'x-lecpage-bridge': token, origin: `http://127.0.0.1:${port}` };
  const body = { agent: 'claude', kind: 'make', request: '따뜻한 색으로', reference: { title: '기록', mood: '차분함' }, meta: { title: '', venue: '본관', live: { provider: 'supabase', url: 'https://x.supabase.co', anonKey: 'k' }, siteUrl: 'https://a.example' }, files: [{ name: '연수 교재.pdf', type: 'application/pdf', base64: readFileSync(PDF).toString('base64') }] };
  const r = await req(port, 'POST', '/bridge/jobs', { headers: O, body });
  assert.equal(r.status, 202, r.text);
  const { jobId } = r.json();
  assert.ok(jobId);
  const busy = await req(port, 'POST', '/bridge/jobs', { headers: O, body: { ...body, agent: 'codex' } });
  assert.equal(busy.status, 409); assert.equal(busy.json().error, 'busy');
  const evs = await events(port, token, jobId);
  const steps = evs.filter((e) => e.type === 'step').map((e) => e.name);
  for (const s of ['prepare', 'start', 'read', 'design', 'write', 'meta', 'check', 'final']) assert.ok(steps.includes(s), `${s} in ${steps}`);
  assert.ok(evs.every((e) => e.type !== 'step' || e.label_ko), '단계마다 한국어 이름');
  const last = evs.at(-1);
  assert.equal(last.type, 'done', JSON.stringify(evs.slice(-3)));
  assert.equal(last.summary.errors, 0);
  // 다시 붙으면(Last-Event-ID) 그 뒤만
  const again = await new Promise((ok) => http.get({ host: '127.0.0.1', port, path: `/bridge/jobs/${jobId}/events`, headers: { 'x-lecpage-bridge': token, 'last-event-id': String(last.seq - 1) } }, (res) => { let b = ''; res.on('data', (c) => { b += c; }); res.on('end', () => ok(b)); }));
  assert.equal((again.match(/^data: /gm) || []).length, 1);
  const snap = (await req(port, 'GET', `/bridge/jobs/${jobId}`, { headers: O })).json();
  assert.equal(snap.status, 'done');
  const res = await req(port, 'GET', `/bridge/jobs/${jobId}/result`, { headers: O });
  assert.equal(res.status, 200);
  const R = res.json();
  assert.match(R.site['index.html'], /data-lp="qa"/);
  assert.equal(typeof R.site['assets/style.css'], 'string');
  // 쪽 그림은 pdftoppm(poppler)이 있을 때만 그려짐(없으면 그 단계만 건너뜀, SKILL.md compatibility)
  // webp로 바꿀 도구(cwebp·PIL)가 없는 PC에서는 png로 남음(render-slides.mjs)
  if (!spawnSync('pdftoppm', ['-v'], { encoding: 'utf8' }).error) {
    const pg = R.site['material/p-001.webp'] || R.site['material/p-001.png'];
    assert.ok(pg?.base64, '쪽 그림은 base64');
    assert.match(pg.type, /^image\/(webp|png)$/);
  }
  assert.equal(R.meta.title, '시험 연수');
  assert.equal(R.meta.venue, '본관');
  assert.equal(R.meta.live, undefined, '강사 값(참여 서버)은 에이전트에게 주지 않음');
  assert.equal(R.meta.siteUrl, undefined);
  assert.ok(Array.isArray(R.issues));
  assert.equal(R.material.pages.length, 13);
  assert.equal(R.agent.auth, 'subscription');
  // 가짜가 받은 것
  const run = readLog().find((l) => l.id === 'claude' && l.argv);
  assert.deepEqual(run.argv, St.agentArgs('claude', { ws: run.cwd }));
  // 끼어들지 않음: 작업 폴더에는 할 일·키트 설명·교재·작업 폴더만(디자인 규칙·레퍼런스 사이트를 넣지 않음)
  const library = existsSync(join(HERE, '..', '..', 'references', 'design-library.md')) ? ['design-library.md'] : []; // 디자인 서재(필요하면 참고)
  assert.deepEqual(run.files.sort(), ['TASK.md', 'kit.md', ...library, 'material', 'work'].sort(), '훅·.mcp.json 없는 빈 폴더');
  if (library.length) assert.match(run.task, /design-library\.md.*따를 의무 없음/);
  assert.ok(run.cwd.includes(St.TMP_PREFIX));
  assert.match(run.task, /material\/연수 교재\.pdf/);
  assert.ok(!/material\.md/.test(run.task), 'PDF 교재면 보조 글자 줄 없음');
  assert.match(run.task, /따뜻한 색으로/);
  assert.match(run.task, /차분함/);
  assert.ok(!/supabase|anonKey|a\.example/.test(run.task));
  const chk = readLog().find((l) => l.check);
  assert.equal(chk.check.cmd, St.CHECK_CMD);
  assert.equal(chk.check.status, 0, chk.check.err);
  assert.match(chk.check.out, /조립 work\/dist/);
  assert.ok(!existsSync(dirname(run.cwd)), '끝난 작업의 임시 폴더는 지움');
  const del = await req(port, 'DELETE', `/bridge/jobs/${jobId}`, { headers: O });
  assert.deepEqual(del.json(), { ok: true, stopped: false });
  assert.equal((await req(port, 'GET', `/bridge/jobs/${jobId}/result`, { headers: O })).status, 404);
  assert.equal((await req(port, 'DELETE', `/bridge/jobs/${jobId}`, { headers: { ...O, origin: 'http://evil.example' } })).status, 403);

  // Codex로 고치기(교재 없이 지금 사이트만)
  rmSync(LOG, { force: true });
  const site = { 'index.html': R.site['index.html'], 'assets/style.css': R.site['assets/style.css'], 'material/p-001.webp': R.site['material/p-001.webp'] || R.site['material/p-001.png'] || { base64: 'UklGRg==', type: 'image/webp' }, 'console.html': 'x', '.env': 'x' };
  const e = await req(port, 'POST', '/bridge/jobs', { headers: O, body: { agent: 'codex', kind: 'edit', request: '맨 아래에 섹션을 하나 더해 주세요', target: 'intro', meta: R.meta, site } });
  assert.equal(e.status, 202, e.text);
  const ev2 = await events(port, token, e.json().jobId);
  assert.equal(ev2.at(-1).type, 'done', JSON.stringify(ev2.slice(-3)));
  assert.equal(ev2.at(-1).label_ko, '다 고쳤어요');
  const R2 = (await req(port, 'GET', `/bridge/jobs/${e.json().jobId}/result`, { headers: O })).json();
  assert.match(R2.site['index.html'], /더한 섹션/);
  assert.equal(R2.site['console.html'], undefined, '엔진 쪽 이름은 받지 않음');
  const cr = readLog().find((l) => l.id === 'codex' && l.argv);
  assert.deepEqual(cr.argv, St.agentArgs('codex', { ws: cr.cwd }));
  assert.match(cr.task, /강의 사이트 고치기/);
  assert.match(cr.task, /id="intro"/);
  assert.match(cr.task, /p-001 ~ p-001/, '앱이 보낸 쪽 그림도 작업 지시에');
  assert.ok(!/material\.md/.test(cr.task), '교재 없이 고치면 보조 글자 줄 없음');
  assert.ok(!cr.files.includes('.env'));

  // 고치기 + 앱이 쪽 그림을 골라 보냄(pagesKept): 받지 않은 번호에 빈 자리 그림을 두고(사이트가 모든 쪽을 가리켜도 확인이 걸리지 않게) 작업 지시에 그대로 알림. 결과에는 넣지 않음
  rmSync(LOG, { force: true });
  const pg = site['material/p-001.webp'];
  const eK = await req(port, 'POST', '/bridge/jobs', { headers: O, body: { agent: 'codex', kind: 'edit', request: '제목을 짧게 해 주세요', meta: R.meta, pagesKept: 6, site: { 'index.html': R.site['index.html'], 'assets/style.css': R.site['assets/style.css'], 'material/p-001.webp': pg, 'material/p-006.webp': pg } } });
  assert.equal(eK.status, 202, eK.text);
  const evK = await events(port, token, eK.json().jobId);
  assert.equal(evK.at(-1).type, 'done', JSON.stringify(evK.slice(-3)));
  const crK = readLog().find((l) => l.id === 'codex' && l.argv);
  assert.deepEqual((crK.shots || []).filter((n) => /^p-\d+\./.test(n)).sort(), ['p-001.webp', 'p-002.webp', 'p-003.webp', 'p-004.webp', 'p-005.webp', 'p-006.webp'], '에이전트가 볼 때는 모든 번호에 그림이 있음');
  assert.match(crK.task, /p-001 ~ p-006, 그중 2장, \.webp\).*여기에는 2장만 받았고\(나머지 번호에는 빈 자리 그림을 두었어요\), 배포한 사이트에는 p-001~p-006 모든 쪽 그림이 들어가요/);
  const RK = (await req(port, 'GET', `/bridge/jobs/${eK.json().jobId}/result`, { headers: O })).json();
  assert.deepEqual(Object.keys(RK.site).filter((k) => k.startsWith('material/')).sort(), ['material/p-001.webp', 'material/p-006.webp'], '빈 자리 그림은 결과에 없음(앱의 진짜 그림을 덮지 않음)');
  assert.ok(!(RK.dropped || []).some((x) => /material\/p-00[2-5]/.test(x)), '뺐다고 알리지도 않음');
  assert.ok(St.CAPS.includes('pages-kept'), '앱이 이 커넥트에는 골라 보내도 된다고 앎');

  // 에이전트가 사이트를 못 쓰면 오류, 허용 밖 도구가 켜져 있으면 멈춤
  const fail1 = await req(port, 'POST', '/bridge/jobs', { headers: O, body: { agent: 'claude', kind: 'edit', request: '[fake:nosite]', site: { 'index.html': '<!doctype html>' } } });
  // 고치기는 index.html이 이미 있어 "못 씀"이 아니라 끝까지 감 → 새로 만들기로 시험
  await events(port, token, fail1.json().jobId);
  const f2 = await req(port, 'POST', '/bridge/jobs', { headers: O, body: { agent: 'claude', request: '[fake:nosite]', files: [{ name: 'a.md', base64: Buffer.from('# 연수\n\n내용').toString('base64') }] } });
  const ev3 = await events(port, token, f2.json().jobId);
  assert.equal(ev3.at(-1).type, 'error'); assert.equal(ev3.at(-1).code, 'agent');
  assert.match(ev3.at(-1).error, /사이트를 쓰지 못했어요/);
  assert.equal((await req(port, 'GET', `/bridge/jobs/${f2.json().jobId}/result`, { headers: O })).status, 409);
  const f3 = await req(port, 'POST', '/bridge/jobs', { headers: O, body: { agent: 'claude', request: '[fake:mcp]', files: [{ name: 'a.md', base64: Buffer.from('# 연수').toString('base64') }] } });
  const ev4 = await events(port, token, f3.json().jobId);
  assert.equal(ev4.at(-1).code, 'unsafe');
  st.p.kill('SIGTERM');
});

test('작업 시간 한도·멈추기(DELETE)·교재 크기 한도·API 키 알림·낡은 Claude Code', { skip: !posix && '셸 스크립트 가짜는 POSIX에서만', timeout: 120000 }, async () => {
  rmSync(LOG, { force: true });
  const st = await launch({ LECPAGE_STUDIO_JOB_MS: '2500', LECPAGE_STUDIO_MATERIAL_MB: '1', ANTHROPIC_API_KEY: 'sk-test-not-real', FAKE_CLAUDE_VERSION: '2.1.200' });
  const { port } = st;
  const token = await tokenOf(port);
  const H = { 'x-lecpage-bridge': token }, O = { ...H, origin: `http://127.0.0.1:${port}` };
  const cl = (await req(port, 'GET', '/bridge/status', { headers: H })).json().agents.find((a) => a.id === 'claude');
  assert.equal(cl.auth, 'api-key');
  assert.equal(cl.ready, false);
  assert.match(cl.note_ko, /2\.1\.314/); assert.match(cl.note_ko, /ANTHROPIC_API_KEY/);
  const nr = await req(port, 'POST', '/bridge/jobs', { headers: O, body: { agent: 'claude', files: [{ name: 'a.md', base64: 'IyBh' }] } });
  assert.equal(nr.status, 409); assert.equal(nr.json().error, 'agent-not-ready');
  // 크기 한도
  const big = await req(port, 'POST', '/bridge/jobs', { headers: O, body: { agent: 'codex', files: [{ name: 'a.pdf', base64: Buffer.alloc(1.5 * 1024 * 1024).toString('base64') }] } });
  assert.equal(big.status, 400); assert.match(big.json().message_ko, /1MB까지/);
  const huge = await new Promise((ok) => { const r = http.request({ host: '127.0.0.1', port, method: 'POST', path: '/bridge/jobs', headers: { ...O, host: `127.0.0.1:${port}`, 'content-type': 'application/json', 'content-length': String(900 * 1024 * 1024) } }, (res) => { res.resume(); ok(res.statusCode); }); r.on('error', () => ok('reset')); r.write('{'); });
  assert.equal(huge, 413);
  // 시간 한도: 끝나지 않는 에이전트 → 2.5초 뒤 멈추고 프로세스·임시 폴더 정리
  const site = { 'index.html': '<!doctype html><html lang="ko"><head><title>t</title></head><body><h1>t</h1></body></html>' };
  const t0 = Date.now();
  const h1 = await req(port, 'POST', '/bridge/jobs', { headers: O, body: { agent: 'codex', kind: 'edit', request: '[fake:hang]', site } });
  assert.equal(h1.status, 202, h1.text);
  const ev = await events(port, token, h1.json().jobId, 30000);
  assert.equal(ev.at(-1).type, 'error'); assert.equal(ev.at(-1).code, 'timeout');
  assert.match(ev.at(-1).error, /분이 지나 작업을 멈췄어요/);
  assert.ok(Date.now() - t0 < 15000);
  const hang = readLog().find((l) => l.id === 'codex' && l.argv);
  assert.ok(await waitFor(() => !alive(hang.pid)), '에이전트 프로세스가 꺼짐');
  assert.ok(!existsSync(dirname(hang.cwd)), '임시 폴더 지움');
  assert.equal((await req(port, 'GET', `/bridge/jobs/${h1.json().jobId}`, { headers: H })).json().status, 'error');
  // 멈추기: 도는 중에 DELETE
  rmSync(LOG, { force: true });
  const h2 = await req(port, 'POST', '/bridge/jobs', { headers: O, body: { agent: 'codex', kind: 'edit', request: '[fake:hang]', site } });
  const id2 = h2.json().jobId;
  const evP = events(port, token, id2, 30000);
  const run = await waitFor(() => readLog().find((l) => l.id === 'codex' && l.argv));
  assert.ok(run && alive(run.pid));
  const del = await req(port, 'DELETE', `/bridge/jobs/${id2}`, { headers: O });
  assert.deepEqual(del.json(), { ok: true, stopped: true });
  const ev2 = await evP;
  assert.equal(ev2.at(-1).type, 'error'); assert.equal(ev2.at(-1).code, 'stopped');
  assert.ok(await waitFor(() => !alive(run.pid)), '멈추면 에이전트 프로세스도 꺼짐');
  assert.ok(!existsSync(dirname(run.cwd)));
  assert.equal((await req(port, 'GET', `/bridge/jobs/${id2}`, { headers: H })).status, 404);
  // 끄면(Ctrl+C) 남은 것 없이
  st.p.kill('SIGINT');
  assert.equal(await new Promise((ok) => st.p.on('exit', ok)), 0);
});

test('실제 앱 빌드(app/dist)를 보여 주고 브라우저 안에서 /bridge/status·SSE가 됨(CSP connect-src self)', { skip: (!existsSync(join(REAL_DIST, 'index.html')) && 'app/dist 없음(cd app && npm run build)') || (!posix && 'POSIX만'), timeout: 120000 }, async (t) => {
  let pw = null;
  try { pw = createRequire(import.meta.url)('playwright'); } catch { /* 없음(NODE_PATH의 전역 설치도 찾음) */ }
  const st = await launch({}, []); // --dist 없이: 저장소의 app/dist를 고름
  assert.equal(st.app, 'dist');
  const home = await req(st.port, 'GET', '/');
  assert.match(home.text, /<div id="app">/);
  assert.match(home.text, /<meta name="lecpage-bridge" content="[0-9a-f]{64}">/);
  assert.match(home.text, /connect-src 'self'/);
  if (!pw) { t.diagnostic('Playwright 없음: 브라우저 시험은 건너뜀'); st.p.kill('SIGTERM'); return; }
  const browser = await pw.chromium.launch();
  try {
    const page = await browser.newPage();
    const csp = [];
    page.on('console', (m) => { if (/Content Security Policy|Refused/.test(m.text())) csp.push(m.text()); });
    await page.goto(st.url, { waitUntil: 'domcontentloaded' });
    const out = await page.evaluate(async () => {
      const token = document.querySelector('meta[name="lecpage-bridge"]').content;
      const H = { 'X-Lecpage-Bridge': token };
      const s = await fetch('/bridge/status', { headers: H });
      const j = await s.json();
      const p = await fetch('/bridge/jobs', { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ agent: 'codex', kind: 'edit', site: { 'index.html': '<!doctype html><html lang="ko"><head><title>t</title></head><body><h1>t</h1></body></html>' } }) });
      const { jobId } = await p.json();
      const ev = await fetch(`/bridge/jobs/${jobId}/events`, { headers: H });
      const text = await ev.text();
      const noTok = (await fetch('/bridge/status')).status;
      return { status: s.status, agents: j.agents.map((a) => a.id), post: p.status, last: text.trim().split('\n\n').pop(), noTok };
    });
    assert.equal(out.status, 200);
    assert.deepEqual(out.agents, ['claude', 'codex']);
    assert.equal(out.post, 202, '브라우저가 보낸 Origin·Sec-Fetch-Site로 받음');
    assert.match(out.last, /"type":"done"/);
    assert.equal(out.noTok, 401);
    assert.deepEqual(csp, []);
    t.diagnostic(`브라우저: status ${out.status} · 작업 ${out.post} · 토큰 없이 ${out.noTok}`);
  } finally { await browser.close(); st.p.kill('SIGTERM'); }
});

test('빌드본이 없으면 앱 파일을 받아 같은 출처로(받은 HTML에 토큰·보안 머리글 그대로·같은 곳 이동만·못 받으면 안내 쪽)', { skip: !posix && 'POSIX만' }, async () => {
  // lecpage.com 대신 이 컴퓨터의 작은 서버(포트도 6600~6649 안)
  const up = http.createServer((q, s) => {
    if (q.url === '/') return s.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "frame-ancestors 'none'", 'strict-transport-security': 'max-age=1', 'set-cookie': 'a=1' }).end('<!doctype html><html><head><title>원격</title></head><body><div id="app"></div></body></html>');
    if (q.url === '/assets/app-abcdef12.js') return s.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'public, max-age=31536000, immutable' }).end('console.log(2)');
    if (q.url === '/help') return s.writeHead(301, { location: `http://127.0.0.1:${up.address().port}/help/` }).end();
    if (q.url === '/away') return s.writeHead(302, { location: 'https://evil.example/' }).end();
    s.writeHead(404, { 'content-type': 'text/html' }).end('<!doctype html><title>없음</title>');
  });
  let upPort = 0;
  for (let p = 6649; p >= 6600 && !upPort; p--) { try { await new Promise((ok, no) => { up.once('error', no); up.listen(p, '127.0.0.1', ok); }); upPort = p; } catch { /* 다음 */ } }
  try {
    const st = await launch({ LECPAGE_STUDIO_APP_URL: `http://127.0.0.1:${upPort}` }, ['--remote']);
    assert.equal(st.app, 'remote');
    const home = await req(st.port, 'GET', '/');
    assert.equal(home.status, 200);
    assert.match(home.text, /<head>\n<meta name="lecpage-bridge" content="[0-9a-f]{64}"><title>원격/);
    assert.equal(home.headers['cache-control'], 'no-store');
    assert.equal(home.headers['content-security-policy'], "frame-ancestors 'none'");
    assert.equal(home.headers['strict-transport-security'], undefined);
    assert.equal(home.headers['set-cookie'], undefined);
    assert.equal(home.headers['cross-origin-resource-policy'], 'same-origin', '받은 머리글에 없어도 첫 화면에는 늘');
    const js = await req(st.port, 'GET', '/assets/app-abcdef12.js');
    assert.equal(js.text, 'console.log(2)'); assert.match(js.headers['cache-control'], /immutable/);
    const mv = await req(st.port, 'GET', '/help');
    assert.equal(mv.status, 308); assert.equal(mv.headers.location, '/help/');
    assert.equal((await req(st.port, 'GET', '/away')).status, 502, '다른 곳으로 보내는 이동은 따르지 않음');
    assert.equal((await req(st.port, 'GET', '/nope')).status, 404);
    const token = home.text.match(/content="([0-9a-f]{64})"/)[1];
    assert.equal((await req(st.port, 'GET', '/bridge/status', { headers: { 'x-lecpage-bridge': token } })).json().app, 'remote');
    up.closeAllConnections?.();
    await new Promise((ok) => up.close(ok));
    const down = await req(st.port, 'GET', '/');
    assert.equal(down.status, 503);
    assert.match(down.text, /앱 파일을 받지 못했어요/);
    assert.match(down.text, /Claude Code를 그대로/);
    st.p.kill('SIGTERM');
  } finally { if (up.listening) up.close(); }
});
