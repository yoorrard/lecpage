// 내 PC 연결 프로그램(lecpage studio, scripts/studio.mjs) 시험.
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

/** 연결 프로그램 띄우기 → { port, url, p } */
async function launch(env = {}, args = ['--dist', DIST]) {
  // NODE_USE_ENV_PROXY: 프록시 환경에서 CLI가 자기를 다시 띄우지 않게(시험이 끄는 프로세스 = 연결 프로그램)
  const p = spawn(process.execPath, [CLI, 'studio', '--no-open', '--json', ...args], { env: { ...process.env, NODE_USE_ENV_PROXY: '1', PATH: `${BIN}:${process.env.PATH}`, FAKE_AGENT_LOG: LOG, LECPAGE_STUDIO_SHOTS: '0', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
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
});

// ── 띄워서 끝까지 ─────────────────────────────────────────────────────────
test('띄우기 → 앱 파일(토큰 넣기·_headers·경로 막기) → 거절(토큰·Origin·Host) → status', { skip: !posix && '셸 스크립트 가짜는 POSIX에서만' }, async () => {
  const st = await launch();
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
  assert.equal((await req(port, 'GET', '/bridge/status', { headers: { ...H, origin: 'https://lecpage.com' } })).status, 403);
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
  assert.match(sj.policy_ko.claude, /선택 기능/);
  // 잘못된 작업 요청
  const bad = async (body) => (await req(port, 'POST', '/bridge/jobs', { headers: O, body })).json();
  assert.match((await bad({ agent: 'gpt' })).message_ko, /claude/);
  assert.match((await bad({ agent: 'claude', kind: 'make', files: [] })).message_ko, /교재 파일/);
  assert.match((await bad({ agent: 'claude', files: [{ name: 'x.exe', base64: 'AA==' }] })).message_ko, /받지 않는 파일/);
  assert.match((await bad({ agent: 'claude', kind: 'edit', site: {} })).message_ko, /index\.html/);
  st.p.kill('SIGTERM');
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
  if (!spawnSync('pdftoppm', ['-v'], { encoding: 'utf8' }).error) {
    assert.ok(R.site['material/p-001.webp']?.base64, '쪽 그림은 base64');
    assert.equal(R.site['material/p-001.webp'].type, 'image/webp');
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
  // 끼어들지 않음: 작업 폴더에는 할 일·키트 설명·교재·작업 폴더만(디자인 원칙·레퍼런스 사이트를 넣지 않음)
  const library = existsSync(join(HERE, '..', '..', 'references', 'design-library.md')) ? ['design-library.md'] : []; // 디자인 서재(필요하면 참고)
  assert.deepEqual(run.files.sort(), ['TASK.md', 'kit.md', ...library, 'material', 'work'].sort(), '훅·.mcp.json 없는 빈 폴더');
  if (library.length) assert.match(run.task, /design-library\.md.*따를 의무 없음/);
  assert.ok(run.cwd.includes(St.TMP_PREFIX));
  assert.match(run.task, /material\/연수 교재\.pdf/);
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
  const site = { 'index.html': R.site['index.html'], 'assets/style.css': R.site['assets/style.css'], 'material/p-001.webp': R.site['material/p-001.webp'], 'console.html': 'x', '.env': 'x' };
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
    assert.match(down.text, /선택 기능/);
    st.p.kill('SIGTERM');
  } finally { if (up.listening) up.close(); }
});
