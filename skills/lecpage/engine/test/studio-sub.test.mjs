// lecpage 커넥트(lecpage Connect, 예전 이름 lecpage studio)의 "구독으로 연결"(2026-11-21) 시험: lecpage.com 짝(CORS·토큰) · ChatGPT 계정(가짜 OpenAI, fixtures/fake-siwc.mjs) ·
// Claude Code·Codex 설치·로그인 창(가짜 터미널, 창이 없으면 이 프로그램 안에서) · 공식 명령 · 컴퓨터를 켤 때 켜기(Windows·macOS·Linux) · 브라우저 열기. 실제 계정·실제 터미널은 쓰지 않음.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, chmodSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import http from 'node:http';
import * as St from '../../scripts/studio.mjs';
import { createSiwc, siwcBody, verifyJwt } from '../../scripts/studio-siwc.mjs';
import { startFakeSiwc } from './fixtures/fake-siwc.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const posix = process.platform !== 'win32';
let T, DIST;
before(() => {
  T = mkdtempSync(join(tmpdir(), 'lp-studio-sub-'));
  DIST = join(T, 'dist'); mkdirSync(DIST);
  writeFileSync(join(DIST, 'index.html'), '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>앱</title></head><body><div id="app"></div></body></html>');
});
after(() => rmSync(T, { recursive: true, force: true }));

function req(port, method, path, { headers = {}, body } = {}) {
  return new Promise((ok, no) => {
    const data = body === undefined ? null : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    const r = http.request({ host: '127.0.0.1', port, method, path, headers: { host: `127.0.0.1:${port}`, ...(data ? { 'content-type': 'application/json', 'content-length': data.length } : {}), ...headers } }, (res) => {
      const ch = []; res.on('data', (c) => ch.push(c)); res.on('end', () => { const text = Buffer.concat(ch).toString('utf8'); ok({ status: res.statusCode, headers: res.headers, text, json: () => JSON.parse(text) }); });
    });
    r.on('error', no); if (data) r.write(data); r.end();
  });
}
/** 가짜 OpenAI의 로그인 화면을 지나 콜백 주소까지(브라우저가 하는 일) */
const follow = async (url) => new URL((await fetch(url, { redirect: 'manual' })).headers.get('location'));
function withEnv(vars, fn) {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  Object.assign(process.env, vars);
  const back = () => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } };
  return Promise.resolve().then(fn).finally(back);
}

test('짝 맞춤 토큰(이 PC 사용자 폴더에 한 번) · 허용 출처·사전 요청 · 공식 설치·로그인 명령 · 터미널 창(Windows·macOS·Linux) · 자동 시작 파일 · 브라우저 열기', async () => {
  const h = mkdtempSync(join(T, 'pair-'));
  const a = St.pairToken(h); assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(St.pairToken(h), a, '다시 켜도 같은 토큰(lecpage.com이 저절로 다시 붙음)');
  assert.notEqual(St.pairToken(h, { fresh: true }), a, '--new-token');
  if (posix) assert.equal(statSync(join(h, 'studio.json')).mode & 0o777, 0o600);
  const o = St.allowedOrigins('http://127.0.0.1:6600', { LECPAGE_STUDIO_ORIGINS: 'http://127.0.0.1:8010, javascript:alert(1)' });
  assert.ok(o.has('https://lecpage.com') && o.has('http://127.0.0.1:6600') && o.has('http://127.0.0.1:8010'));
  assert.ok(!o.has('javascript:alert(1)') && !o.has('http://lecpage.com'));
  const ok = { host: '127.0.0.1:6600', 'x-lecpage-bridge': 'a'.repeat(64) };
  const S = { hostPort: '127.0.0.1:6600', origin: 'http://127.0.0.1:6600', token: 'a'.repeat(64), origins: o };
  const R = (method, headers) => ({ method, headers });
  assert.equal(St.checkRequest(R('POST', { ...ok, origin: 'https://lecpage.com', 'sec-fetch-site': 'cross-site' }), S, { bridge: true }), null);
  assert.equal(St.checkRequest(R('POST', { ...ok, origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }), S, { bridge: true }).status, 403);
  assert.equal(St.checkRequest(R('POST', { ...ok, origin: 'https://lecpage.com', 'x-lecpage-bridge': 'b'.repeat(64) }), S, { bridge: true }).status, 401);
  assert.equal(St.checkRequest(R('GET', { ...ok, 'sec-fetch-site': 'cross-site' }), S, { bridge: true }).status, 403, 'Origin 없이 다른 사이트');
  assert.deepEqual(St.checkRequest(R('OPTIONS', { host: ok.host, origin: 'https://lecpage.com' }), S, { bridge: true }), { status: 204, preflight: true, origin: 'https://lecpage.com' });
  assert.equal(St.checkRequest(R('OPTIONS', { host: ok.host, origin: 'https://evil.example' }), S, { bridge: true }).status, 403);
  const c = St.corsHeaders('https://lecpage.com');
  assert.equal(c['access-control-allow-origin'], 'https://lecpage.com'); assert.equal(c['access-control-allow-private-network'], 'true'); assert.equal(c.vary, 'Origin');
  // 공식 문서 명령 그대로(설치 뒤 이어서 로그인). 찾은 실행 파일 경로는 따옴표로(사용자 입력은 들어가지 않음)
  const wi = St.terminalScript('claude', 'install', { platform: 'win32' });
  assert.match(wi, /irm https:\/\/claude\.ai\/install\.ps1 \| iex/); assert.match(wi, /\.local\\bin\\claude\.exe" auth login/);
  assert.match(St.terminalScript('claude', 'install', { platform: 'darwin' }), /curl -fsSL https:\/\/claude\.ai\/install\.sh \| bash && .*"\$HOME\/\.local\/bin\/claude" auth login/);
  assert.match(St.terminalScript('claude', 'login', { platform: 'win32', file: "C:\\Users\\O'Neil\\.local\\bin\\claude.exe" }), /& 'C:\\Users\\O''Neil\\\.local\\bin\\claude\.exe' auth login/);
  assert.match(St.terminalScript('codex', 'install', { platform: 'win32' }), /irm https:\/\/chatgpt\.com\/codex\/install\.ps1 \| iex.*Codex\\bin\\codex\.exe" login/);
  assert.match(St.terminalScript('codex', 'install', { platform: 'linux' }), /curl -fsSL https:\/\/chatgpt\.com\/codex\/install\.sh \| sh/);
  assert.match(St.terminalScript('claude', 'update', { platform: 'darwin', file: '/u/claude', needLogin: false }), /'\/u\/claude' update; echo/);
  assert.equal(St.autostartCommand('C:\\Users\\a\\AppData\\Local\\lecpage\\lecpage-studio.cmd'), 'cmd.exe /c start "lecpage" /min "C:\\Users\\a\\AppData\\Local\\lecpage\\lecpage-studio.cmd" --autostart');
  // 터미널 창: 윈도우는 새 콘솔(detached)의 PowerShell, mac은 .command 파일을 Terminal로, 리눅스는 화면이 있을 때 차례대로. 못 열면 명령을 돌려줌
  const calls = []; const spawnImpl = (cmd, args, opts) => { calls.push({ cmd, args, opts }); return { on() {}, unref() {} }; };
  assert.equal((await St.openTerminal('echo hi', { platform: 'win32', env: {}, spawnImpl, waitMs: 5 })).how, 'powershell');
  assert.equal(calls[0].cmd, 'powershell.exe'); assert.ok(calls[0].args.includes('-NoExit') && calls[0].opts.detached && calls[0].opts.windowsHide === false);
  assert.equal(Buffer.from(calls[0].args.at(-1), 'base64').toString('utf16le'), 'echo hi', '-EncodedCommand로 따옴표·한글을 그대로');
  assert.equal((await St.openTerminal('echo "hi"', { platform: 'darwin', env: {}, spawnImpl, waitMs: 5 })).how, 'terminal');
  assert.deepEqual(calls[1].args.slice(0, 2), ['-a', 'Terminal']); assert.equal(calls[1].cmd, 'open');
  const cmdFile = calls[1].args[2]; assert.match(cmdFile, /lecpage-connect-[0-9a-f]+\.command$/);
  assert.equal(readFileSync(cmdFile, 'utf8'), '#!/bin/bash\nrm -f "$0"\necho "hi"\nexec "${SHELL:-/bin/zsh}" -l\n', '따옴표를 고치지 않고 파일에 그대로');
  if (posix) assert.equal(statSync(cmdFile).mode & 0o777, 0o700); rmSync(cmdFile, { force: true });
  assert.deepEqual(await St.openTerminal('x', { platform: 'linux', env: { PATH: '' }, spawnImpl }), { ok: false, command: 'x' });
  if (posix) {
    // 리눅스: 화면이 없으면 터미널을 찾지 않음 · 있으면 x-terminal-emulator부터, 곧바로 실패하면(0이 아닌 코드) 다음 것
    const tb = mkdtempSync(join(T, 'terms-'));
    for (const t of ['x-terminal-emulator', 'konsole', 'xterm']) { writeFileSync(join(tb, t), '#!/bin/sh\n'); chmodSync(join(tb, t), 0o755); }
    assert.equal((await St.openTerminal('x', { platform: 'linux', env: { PATH: tb }, spawnImpl })).ok, false, 'DISPLAY·WAYLAND_DISPLAY가 없으면 창을 열지 않음');
    const tried = [];
    const quitFirst = (cmd, args) => { tried.push(cmd); const fail = cmd === 'x-terminal-emulator'; return { on(ev, f) { if (ev === 'exit' && fail) setTimeout(() => f(1), 5); }, unref() {} }; };
    const r = await St.openTerminal('echo 안녕', { platform: 'linux', env: { PATH: tb, DISPLAY: ':0' }, spawnImpl: quitFirst, waitMs: 60 });
    assert.deepEqual(r, { ok: true, how: 'konsole' }); assert.deepEqual(tried, ['x-terminal-emulator', 'konsole']);
    assert.deepEqual(St.LINUX_TERMINALS.map(([t]) => t).filter((t) => ['x-terminal-emulator', 'gnome-terminal', 'konsole', 'xterm'].includes(t)), ['x-terminal-emulator', 'gnome-terminal', 'konsole', 'xterm'], '정한 차례');
  }
  // 컴퓨터를 켤 때 켜기: macOS LaunchAgent plist · Linux XDG autostart .desktop(경로의 특수 문자는 명세대로)
  assert.equal(St.autostartFile({ HOME: '/Users/a' }, 'darwin'), '/Users/a/Library/LaunchAgents/com.lecpage.connect.plist');
  assert.equal(St.autostartFile({ HOME: '/home/a' }, 'linux'), '/home/a/.config/autostart/lecpage-connect.desktop');
  assert.equal(St.autostartFile({ HOME: '/home/a', XDG_CONFIG_HOME: '/x/cfg' }, 'linux'), '/x/cfg/autostart/lecpage-connect.desktop');
  const plist = St.autostartEntry('/Users/a/Library/Application Support/lecpage/lecpage-connect.sh', 'darwin', '/Users/a');
  assert.match(plist, /<key>Label<\/key><string>com\.lecpage\.connect<\/string>/);
  assert.match(plist, /<array><string>\/bin\/sh<\/string><string>\/Users\/a\/Library\/Application Support\/lecpage\/lecpage-connect\.sh<\/string><string>--autostart<\/string><\/array>/);
  assert.match(plist, /<key>RunAtLoad<\/key><true\/>/); assert.match(plist, /\/Users\/a\/\.local\/bin:\/opt\/homebrew\/bin/);
  assert.match(St.autostartEntry('/u/a&b<c>.sh', 'darwin', '/u'), /\/u\/a&amp;b&lt;c&gt;\.sh/);
  const desk = St.autostartEntry('/home/a b/.local/share/lecpage/lecpage-connect.sh', 'linux');
  assert.match(desk, /^\[Desktop Entry\]\nType=Application\n/); assert.match(desk, /\nName=lecpage 커넥트\n/); assert.match(desk, /\nTerminal=false\n/);
  assert.match(desk, /\nExec=\/bin\/sh "\/home\/a b\/\.local\/share\/lecpage\/lecpage-connect\.sh" --autostart\n/);
  assert.ok(St.autostartEntry('/h/$x"y`z%.sh', 'linux').includes('Exec=/bin/sh "/h/\\$x\\"y\\`z%%.sh" --autostart'));
  assert.deepEqual(await St.autostartState({}, 'linux'), { available: false, on: false }, '받은 실행 파일로 켰을 때만');
  if (posix) {
    const home = mkdtempSync(join(T, 'auto-')); const env = { HOME: home, LECPAGE_LAUNCHER: join(home, 'lecpage-connect.sh') };
    for (const plat of ['linux', 'darwin']) {
      const f = St.autostartFile(env, plat);
      assert.deepEqual(await St.autostartState(env, plat), { available: true, on: false });
      assert.deepEqual(await St.setAutostart(true, env, plat), { ok: true, available: true, on: true });
      assert.ok(readFileSync(f, 'utf8').includes(env.LECPAGE_LAUNCHER)); assert.deepEqual(await St.autostartState(env, plat), { available: true, on: true });
      assert.deepEqual(await St.setAutostart(false, env, plat), { ok: true, available: true, on: false });
      assert.throws(() => statSync(f), /ENOENT/, '끄면 파일을 지움');
    }
  }
  // 브라우저: Windows rundll32(= start) · macOS open · Linux xdg-open부터(화면이 있을 때만) · WSL wslview
  const u = 'https://lecpage.com/#pair=ab&port=6600';
  assert.deepEqual(St.browserCommands(u, { platform: 'win32', env: {} }), [['rundll32', ['url.dll,FileProtocolHandler', u]]]);
  assert.deepEqual(St.browserCommands(u, { platform: 'darwin', env: {} }), [['open', [u]]]);
  assert.deepEqual(St.browserCommands(u, { platform: 'linux', env: {} }), [], '화면이 없으면 열지 않고 주소를 보여 줌');
  assert.deepEqual(St.browserCommands(u, { platform: 'linux', env: { DISPLAY: ':0' } }).map(([c]) => c), ['xdg-open', 'gio', 'sensible-browser', 'x-www-browser']);
  assert.equal(St.browserCommands(u, { platform: 'linux', env: { WSL_DISTRO_NAME: 'Ubuntu' } })[0][0], 'wslview');
  const opened = []; const sp = (cmd, args) => { opened.push([cmd, ...args]); return { on() {}, unref() {} }; };
  assert.equal(await St.openBrowser(u, { platform: 'darwin', env: {}, spawnImpl: sp, waitMs: 5 }), true); assert.deepEqual(opened[0], ['open', u]);
  assert.equal(await St.openBrowser(u, { platform: 'linux', env: { PATH: '' }, spawnImpl: sp, waitMs: 5 }), false);
});

test('ChatGPT 요청 본문은 store:false·stream:true(금지 칸 뺌) · ID 토큰 확인(RS256·iss·aud·nonce·서명)', async () => {
  const b = siwcBody({ model: 'm', instructions: 'i', input: [{ role: 'system', content: 'x' }, { role: 'user', content: 'y' }], max_output_tokens: 9, background: true, temperature: 1, store: true, stream: false, previous_response_id: 'r', text: { format: { type: 'json_object' } } });
  assert.deepEqual(Object.keys(b).sort(), ['input', 'instructions', 'model', 'store', 'stream', 'text']);
  assert.equal(b.store, false); assert.equal(b.stream, true); assert.equal(b.input[0].role, 'developer');
  const f = await startFakeSiwc();
  try {
    const keys = await (await fetch(f.url + '/.well-known/jwks.json')).json();
    const verifier = 'v'.repeat(43);
    const au = new URL(f.url + '/api/accounts/authorize');
    for (const [k, v] of Object.entries({ client_id: 'dynamic_agent_client', redirect_uri: 'http://127.0.0.1:1/auth/callback', state: 's', nonce: 'n1', code_challenge: createHash('sha256').update(verifier).digest('base64url') })) au.searchParams.set(k, v);
    const loc = await follow(au);
    assert.equal(loc.searchParams.get('client_id'), 'oaiapp_test123');
    const tok = await (await fetch(f.url + '/api/accounts/oauth/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'authorization_code', client_id: 'oaiapp_test123', code: loc.searchParams.get('code'), code_verifier: verifier, redirect_uri: 'http://127.0.0.1:1/auth/callback', resource: 'https://api.openai.com/v1' }) })).json();
    const opt = { issuer: f.url, audience: 'oaiapp_test123', nonce: 'n1' };
    assert.equal(verifyJwt(tok.id_token, keys, opt).email, 'teacher@example.com');
    assert.throws(() => verifyJwt(tok.id_token, keys, { ...opt, audience: 'other' }), /대상/);
    assert.throws(() => verifyJwt(tok.id_token, keys, { ...opt, nonce: 'n2' }), /nonce/);
    assert.throws(() => verifyJwt(tok.id_token, keys, { ...opt, issuer: 'https://auth.openai.com' }), /발급자/);
    const [h, p, s] = tok.id_token.split('.');
    assert.throws(() => verifyJwt(`${h}.${p}.${s.slice(0, -4)}AAAA`, keys, opt), /서명/);
    assert.throws(() => verifyJwt(tok.id_token, keys, { ...opt, at: Date.now() + 2 * 3600e3 }), /만료/);
  } finally { await f.close(); }
});

test('ChatGPT 계정으로 연결(가짜 OpenAI): lecpage.com에서 로그인 → 콜백 → 토큰은 PC 파일에만 → 모델 → 답 중계 → 갱신 → 다시 로그인 → 연결 해제', { skip: !posix && 'POSIX만', timeout: 60000 }, async () => {
  const f = await startFakeSiwc({ answer: 'A'.repeat(5000) });
  const home = mkdtempSync(join(T, 'siwc-'));
  await withEnv({ LECPAGE_SIWC_AUTH_BASE: f.url, LECPAGE_SIWC_API_BASE: f.url }, async () => {
    const st = await St.startStudio({ port: 0, dist: DIST, home });
    const port = st.port;
    const L = { 'x-lecpage-bridge': st.S.token, origin: 'https://lecpage.com', 'sec-fetch-site': 'cross-site' };
    const noSecret = (txt) => { for (const t of [...f.st.access, ...f.st.refresh]) assert.ok(!txt.includes(t), '앱에 가는 글에 토큰 없음'); assert.ok(!/eyJ[\w-]+\.[\w-]+\./.test(txt), 'ID 토큰 없음'); };
    try {
      let s = await req(port, 'GET', '/bridge/status', { headers: L });
      assert.equal(s.status, 200); assert.equal(s.json().chatgpt.connected, false); assert.equal(s.headers['access-control-allow-origin'], 'https://lecpage.com');
      const au = new URL((await req(port, 'POST', '/bridge/chatgpt/login', { headers: L, body: {} })).json().url);
      assert.equal(au.origin + au.pathname, f.url + '/api/accounts/authorize');
      const q = Object.fromEntries(au.searchParams);
      assert.equal(q.client_id, 'dynamic_agent_client'); assert.equal(q.redirect_uri, `http://127.0.0.1:${port}/auth/callback`);
      assert.equal(q.scope, 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct'); assert.equal(q.resource, 'https://api.openai.com/v1');
      assert.equal(q.code_challenge_method, 'S256'); assert.match(q.ext_agent_host_id, /^urn:uuid:[0-9a-f-]{36}$/); assert.equal(q.agent_name_hint, 'lecpage'); assert.ok(q.state && q.nonce && !q.id_token_hint);
      assert.equal((await req(port, 'GET', '/auth/callback?code=x&state=nope')).status, 400, '모르는 state는 거절');
      // 브라우저가 OpenAI에서 돌아오는 것처럼(최상위 이동이라 토큰·Origin 없음). 잘못된 state가 앞의 로그인을 지웠으니 다시 눌러야 함
      const au2 = new URL((await req(port, 'POST', '/bridge/chatgpt/login', { headers: L, body: {} })).json().url);
      const cb = await follow(au2);
      const done = await req(port, 'GET', cb.pathname + cb.search);
      assert.equal(done.status, 200); assert.match(done.text, /ChatGPT 계정을 연결했어요/); noSecret(done.text);
      assert.equal((await req(port, 'GET', cb.pathname + cb.search)).status, 400, '같은 콜백을 두 번 쓰지 못함');
      s = await req(port, 'GET', '/bridge/status', { headers: L });
      const cg = s.json().chatgpt;
      assert.deepEqual([cg.connected, cg.plan, cg.email, cg.welcome], [true, true, 'teacher@example.com', true]); noSecret(s.text);
      const file = join(home, 'chatgpt.json');
      assert.equal(statSync(file).mode & 0o777, 0o600);
      const rec = JSON.parse(readFileSync(file, 'utf8'));
      assert.equal(rec.client_id, 'oaiapp_test123'); assert.ok(rec.access_token && rec.refresh_token && rec.id_token && rec.scopes.includes('chatgpt.tokens.use.direct'));
      assert.deepEqual((await req(port, 'GET', '/bridge/chatgpt/models', { headers: L })).json().models, [{ id: 'gpt-test', label: 'GPT 시험' }]);
      // 답 중계: 앱이 넣은 금지 칸은 lecpage 커넥트가 뺌
      const r1 = await req(port, 'POST', '/bridge/chatgpt/responses', { headers: L, body: { model: 'gpt-test', instructions: 'x', input: [{ role: 'user', content: [{ type: 'input_text', text: 'hi' }] }], max_output_tokens: 1000, background: true, temperature: 0.2 } });
      assert.equal(r1.status, 200); assert.match(r1.headers['content-type'], /text\/event-stream/); assert.match(r1.text, /response\.completed/); assert.equal(r1.headers['access-control-allow-origin'], 'https://lecpage.com'); noSecret(r1.text);
      const sent = f.st.calls.at(-1);
      assert.equal(sent.store, false); assert.equal(sent.stream, true); assert.ok(!('max_output_tokens' in sent) && !('background' in sent) && !('temperature' in sent));
      // access 토큰을 가짜가 거절 → 한 번 갱신하고 다시. 돌아가며 바뀌는 refresh 토큰을 저장
      f.st.access.clear();
      const r2 = await req(port, 'POST', '/bridge/chatgpt/responses', { headers: L, body: { model: 'gpt-test', input: [{ role: 'user', content: 'hi' }] } });
      assert.equal(r2.status, 200); assert.equal(f.st.refreshed, 1);
      assert.notEqual(JSON.parse(readFileSync(file, 'utf8')).refresh_token, rec.refresh_token);
      assert.equal((await req(port, 'POST', '/bridge/chatgpt/responses', { headers: { origin: 'https://lecpage.com' }, body: { model: 'gpt-test', input: [] } })).status, 401, '토큰 없이는 못 부름');
      assert.equal((await req(port, 'POST', '/bridge/chatgpt/responses', { headers: { ...L, origin: 'https://evil.example' }, body: { model: 'gpt-test', input: [] } })).status, 403, '다른 사이트는 못 부름');
      // 다시 로그인: 저장한 client_id로, 등록 이름은 빼고 hint를 줌. 같은 PC는 같은 host ID
      const q3 = Object.fromEntries(new URL((await req(port, 'POST', '/bridge/chatgpt/login', { headers: L, body: {} })).json().url).searchParams);
      assert.equal(q3.client_id, 'oaiapp_test123'); assert.ok(!q3.agent_name_hint && q3.id_token_hint && q3.login_hint === 'teacher@example.com'); assert.equal(q3.ext_agent_host_id, q.ext_agent_host_id);
      // 연결 해제: refresh 토큰을 취소하고 토큰만 지움(등록·host ID는 남김)
      const out = await req(port, 'DELETE', '/bridge/chatgpt', { headers: L });
      assert.equal(out.json().revoked, true); assert.equal(out.json().connected, false); assert.equal(f.st.revoked, 1);
      const left = JSON.parse(readFileSync(file, 'utf8'));
      assert.ok(!left.access_token && !left.refresh_token && left.client_id === 'oaiapp_test123');
      assert.equal((await req(port, 'POST', '/bridge/chatgpt/responses', { headers: L, body: { model: 'gpt-test', input: [] } })).json().error, 'not-connected');
    } finally { await st.close(); await f.close(); }
  });
});

test('ChatGPT 사용 한도·요금제 허락 없음: 다시 보내지 않게 코드·안내를 전하고, 다시 로그인하면 동의 화면을 다시', async () => {
  const f = await startFakeSiwc({ limit: true });
  try {
    const sw = createSiwc({ home: mkdtempSync(join(T, 'siwc2-')), port: 1, env: { LECPAGE_SIWC_AUTH_BASE: f.url, LECPAGE_SIWC_API_BASE: f.url } });
    assert.equal((await sw.callback((await follow(sw.startLogin().url)).searchParams)).ok, true);
    const res = { writeHead(s, h) { this.s = s; this.h = h; }, end(b) { this.b = b; }, on() {}, off() {} };
    await sw.responses({ model: 'gpt-test', input: [] }, {}, res, {});
    assert.equal(res.s, 429); const j = JSON.parse(res.b);
    assert.equal(j.code, 'subscription_sharing_usage_limit_exceeded'); assert.match(j.message_ko, /사용 한도/);
  } finally { await f.close(); }
  const g = await startFakeSiwc({ scopeNoPlan: true });
  try {
    const sw = createSiwc({ home: mkdtempSync(join(T, 'siwc3-')), port: 1, env: { LECPAGE_SIWC_AUTH_BASE: g.url, LECPAGE_SIWC_API_BASE: g.url } });
    const r = await sw.callback((await follow(sw.startLogin().url)).searchParams);
    assert.equal(r.ok, false); assert.match(r.message_ko, /허락하지 않았어요/);
    assert.deepEqual([sw.status().connected, sw.status().plan], [true, false]);
    assert.equal(new URL(sw.startLogin().url).searchParams.get('prompt'), 'consent');
  } finally { await g.close(); }
});

test('설치·로그인 버튼: 공식 명령을 보이는 터미널 창에서(가짜 터미널) · 없는 프로그램은 설치 + 이어서 로그인 · 있으면 로그인만', { skip: !posix && 'POSIX만', timeout: 60000 }, async () => {
  const term = join(T, 'term.log');
  const fakeTerm = join(T, 'fake-term'); writeFileSync(fakeTerm, `#!/bin/sh\nprintf '%s\\n---\\n' "$1" >> "${term}"\n`); chmodSync(fakeTerm, 0o755);
  const bin = join(T, 'bin-claude'); mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'claude'), `#!/bin/sh\nexec "${process.execPath}" "${join(HERE, 'fixtures', 'fake-agent.mjs')}" claude "$@"\n`); chmodSync(join(bin, 'claude'), 0o755);
  await withEnv({ PATH: `${bin}:/usr/bin:/bin`, LECPAGE_STUDIO_TERMINAL: fakeTerm, HOME: mkdtempSync(join(T, 'h-')), LOCALAPPDATA: '', APPDATA: '' }, async () => {
    const st = await St.startStudio({ port: 0, dist: DIST, home: mkdtempSync(join(T, 'agents-')) });
    const H = { 'x-lecpage-bridge': st.S.token, origin: 'https://lecpage.com' };
    try {
      const cx = (await req(st.port, 'GET', '/bridge/status?fresh', { headers: H })).json().agents.find((a) => a.id === 'codex');
      assert.equal(cx.installed, false); assert.equal(cx.need, 'install'); assert.equal(cx.file, undefined, '실행 파일 경로는 앱에 주지 않음');
      assert.deepEqual((await req(st.port, 'POST', '/bridge/agents/codex/install', { headers: H, body: {} })).json(), { ok: true, action: 'install', how: 'test' });
      await new Promise((r) => setTimeout(r, 400));
      assert.match(readFileSync(term, 'utf8'), /curl -fsSL https:\/\/chatgpt\.com\/codex\/install\.sh \| sh && .*codex" login/);
      assert.equal((await req(st.port, 'POST', '/bridge/agents/claude/login', { headers: H, body: {} })).status, 429, '3초 안에 또 누르면 기다리게');
      await new Promise((r) => setTimeout(r, 3100));
      assert.equal((await req(st.port, 'POST', '/bridge/agents/claude/install', { headers: H, body: {} })).json().action, 'login', '이미 설치돼 있으면 로그인만');
      await new Promise((r) => setTimeout(r, 400));
      assert.ok(readFileSync(term, 'utf8').includes(`'${join(bin, 'claude')}' auth login`));
      assert.equal((await req(st.port, 'POST', '/bridge/agents/evil/install', { headers: H, body: {} })).status, 404);
      assert.equal((await req(st.port, 'POST', '/bridge/agents/claude/login', { headers: { origin: 'https://lecpage.com' }, body: {} })).status, 401, '토큰 없이는 창을 못 엶');
      assert.equal((await req(st.port, 'GET', '/bridge/autostart', { headers: H })).json().available, false, '받은 실행 파일로 켰을 때만');
      assert.equal((await req(st.port, 'POST', '/bridge/autostart', { headers: H, body: { on: true } })).status, 409);
    } finally { await st.close(); }
  });
});

test('터미널 창을 못 열면(화면 없는 리눅스) 이 프로그램 안에서 돌리고 출력·입력을 앱으로 · 받은 실행 파일로 켰으면 자동 시작 켜고 끄기', { skip: process.platform !== 'linux' && '리눅스만', timeout: 60000 }, async () => {
  const bin = join(T, 'bin-inline'); mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'claude'), `#!/bin/sh\nexec "${process.execPath}" "${join(HERE, 'fixtures', 'fake-agent.mjs')}" claude "$@"\n`); chmodSync(join(bin, 'claude'), 0o755);
  const home = mkdtempSync(join(T, 'h-inline-')); const loginFile = join(home, 'logged-in');
  await withEnv({ PATH: `${bin}:/usr/bin:/bin`, LECPAGE_STUDIO_TERMINAL: '', DISPLAY: '', WAYLAND_DISPLAY: '', HOME: home, XDG_CONFIG_HOME: '', LECPAGE_LAUNCHER: join(home, 'lecpage-connect.sh'), FAKE_LOGIN_FILE: loginFile }, async () => {
    const st = await St.startStudio({ port: 0, dist: DIST, home: mkdtempSync(join(T, 'inline-')) });
    const H = { 'x-lecpage-bridge': st.S.token, origin: 'https://lecpage.com' };
    try {
      const before = (await req(st.port, 'GET', '/bridge/status?fresh', { headers: H })).json();
      assert.equal(before.agents.find((a) => a.id === 'claude').loggedIn, false); assert.equal(before.term, null);
      const r = (await req(st.port, 'POST', '/bridge/agents/claude/login', { headers: H, body: {} })).json();
      assert.equal(r.ok, false); assert.equal(r.how, 'inline'); assert.equal(r.action, 'login'); assert.match(r.message_ko, /lecpage 커넥트 안에서 Claude Code 로그인을 해요/); assert.match(r.command, /auth login/);
      let t = null;
      for (let i = 0; i < 100 && !/Paste code/.test(t?.output || ''); i++) { await new Promise((ok) => setTimeout(ok, 100)); t = (await req(st.port, 'GET', '/bridge/term', { headers: H })).json().term; }
      assert.equal(t.running, true); assert.equal(t.agent, 'claude'); assert.match(t.output, /lecpage: Claude Code에 내 계정으로 로그인해요/); assert.match(t.output, /Paste code here if prompted/);
      assert.equal((await req(st.port, 'GET', '/bridge/status', { headers: H })).json().term.running, true, '상태에도 돌고 있는지(출력은 /bridge/term에서만)');
      assert.equal((await req(st.port, 'POST', '/bridge/term/input', { headers: { origin: 'https://lecpage.com' }, body: { text: 'x' } })).status, 401, '토큰 없이는 입력 못 함');
      assert.equal((await req(st.port, 'POST', '/bridge/term/input', { headers: H, body: { text: 'code-123' } })).json().ok, true);
      for (let i = 0; i < 100 && t.running; i++) { await new Promise((ok) => setTimeout(ok, 100)); t = (await req(st.port, 'GET', '/bridge/term', { headers: H })).json().term; }
      assert.equal(t.code, 0); assert.match(t.output, /Login successful/); assert.match(t.output, /다 됐어요/);
      assert.equal(readFileSync(loginFile, 'utf8'), 'code-123');
      assert.equal((await req(st.port, 'GET', '/bridge/status?fresh', { headers: H })).json().agents.find((a) => a.id === 'claude').loggedIn, true, '끝나면 저절로 알아봄');
      assert.equal((await req(st.port, 'POST', '/bridge/term/input', { headers: H, body: { text: 'again' } })).status, 409, '끝난 뒤에는 입력 없음');
      // 자동 시작(리눅스 ~/.config/autostart): 켜기 → 파일 → 끄기 → 지움
      const f = join(home, '.config', 'autostart', 'lecpage-connect.desktop');
      assert.deepEqual((await req(st.port, 'GET', '/bridge/autostart', { headers: H })).json(), { ok: true, available: true, on: false });
      assert.deepEqual((await req(st.port, 'POST', '/bridge/autostart', { headers: H, body: { on: true } })).json(), { ok: true, available: true, on: true });
      assert.ok(readFileSync(f, 'utf8').includes(`Exec=/bin/sh "${join(home, 'lecpage-connect.sh')}" --autostart`));
      assert.equal((await req(st.port, 'GET', '/bridge/status', { headers: H })).json().autostart.on, true);
      assert.deepEqual((await req(st.port, 'POST', '/bridge/autostart', { headers: H, body: { on: false } })).json(), { ok: true, available: true, on: false });
      assert.throws(() => statSync(f), /ENOENT/);
    } finally { await st.close(); }
  });
});
