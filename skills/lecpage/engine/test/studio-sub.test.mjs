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
  // 개발 주소(Vite 5173·4173)는 받은 묶음(배포판)에서는 믿지 않음: 저장소에서 켰거나(dev) LECPAGE_STUDIO_DEV=1일 때만
  assert.ok(!o.has('http://localhost:5173') && !o.has('http://localhost:4173') && !St.APP_ORIGINS.some((x) => /localhost/.test(x)));
  assert.ok(St.allowedOrigins('http://127.0.0.1:6600', {}, { dev: true }).has('http://localhost:5173') && St.allowedOrigins('http://127.0.0.1:6600', { LECPAGE_STUDIO_DEV: '1' }).has('http://localhost:4173'));
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

test('다른 브라우저와 짝 맞추기(/pair): 허용한 앱 주소(lecpage.com)로만 보내고 토큰은 # 뒤 · 틀·fetch는 거절 · 예비 주소(다른 GitHub Pages와 같은 출처)는 믿지 않음', async () => {
  const st = await St.startStudio({ port: 0, dist: DIST, home: mkdtempSync(join(T, 'pair2-')) });
  const pair = (app, headers = {}) => req(st.port, 'GET', '/pair' + (app === undefined ? '' : '?app=' + encodeURIComponent(app)), { headers });
  const nav = { 'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'cross-site' };
  const frag = `#pair=${st.S.token}&port=${st.port}`;
  try {
    assert.ok(!St.APP_ORIGINS.includes('https://yoorrard.github.io') && !St.allowedOrigins('http://127.0.0.1:6600').has('https://yoorrard.github.io'));
    assert.ok(St.allowedOrigins('http://127.0.0.1:6600').has('https://lecpage.github.io'), '전용 예비 주소는 믿음');
    const r = await pair('https://lecpage.com/', nav);
    assert.equal(r.status, 302); assert.equal(r.headers.location, `https://lecpage.com/${frag}`);
    assert.equal(r.headers['access-control-allow-origin'], undefined, 'CORS 없음(다른 사이트가 이동할 곳을 읽지 못함)'); assert.equal(r.headers['cache-control'], 'no-store'); assert.equal(r.headers['referrer-policy'], 'no-referrer');
    assert.equal((await pair(undefined)).headers.location, `https://lecpage.com/${frag}`, '앱 주소가 없으면 켤 때 여는 곳');
    for (const bad of ['https://evil.example/', 'https://yoorrard.github.io/lecpage/', 'https://yoorrard.github.io/other-site/', 'http://yoorrard.github.io/lecpage/', `http://127.0.0.1:${st.port}/`, 'https://lecpage.com.evil.example/', 'https://u:p@lecpage.com/', 'javascript:alert(1)']) assert.equal((await pair(bad, nav)).status, 400, bad);
    assert.equal((await pair('https://lecpage.com/', { 'sec-fetch-dest': 'iframe', 'sec-fetch-mode': 'navigate' })).status, 403, '틀 안에서는 안 됨');
    assert.equal((await pair('https://lecpage.com/', { 'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors', origin: 'https://lecpage.com' })).status, 403, 'fetch로는 안 됨');
    assert.equal((await pair('https://lecpage.com/', { ...nav, host: `evil.example:${st.port}` })).status, 421, 'DNS 리바인딩');
    const m = await req(st.port, 'GET', '/bridge/status', { headers: { 'x-lecpage-bridge': st.S.token, origin: 'https://yoorrard.github.io', 'sec-fetch-site': 'cross-site' } });
    assert.equal(m.status, 403, '토큰이 맞아도 예비 주소 출처는 거절'); assert.equal(m.headers['access-control-allow-origin'], undefined);
    const s = await req(st.port, 'GET', '/bridge/status', { headers: { 'x-lecpage-bridge': st.S.token, origin: 'https://lecpage.com', 'sec-fetch-site': 'cross-site' } });
    assert.equal(s.status, 200); assert.equal(s.headers['access-control-allow-origin'], 'https://lecpage.com');
    assert.equal(s.json().limits.twinPdf, true);
    // 짝 없는 브라우저: 토큰 없이 부르면 401 token(허용한 출처는 읽을 수 있게 CORS) → 앱의 [이 브라우저와 연결]이 이것으로 포트를 찾음
    const u = await req(st.port, 'GET', '/bridge/status', { headers: { origin: 'https://lecpage.com', 'sec-fetch-site': 'cross-site' } });
    assert.equal(u.status, 401); assert.equal(u.json().error, 'token'); assert.equal(u.headers['access-control-allow-origin'], 'https://lecpage.com'); assert.ok(!u.text.includes(st.S.token));
  } finally { await st.close(); }
});

test('lecpage.com 짝 맞춤(app/src/lib/pair.js): 쓰던 짝은 다른 토큰의 #pair=로 바로 덮지 않음(확인 뒤에만) · 처음·같은 토큰·답한 적 없는 짝은 바로 · 주소에서는 늘 지움', async () => {
  const mk = (m) => ({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) });
  const store = new Map(); const sess = new Map(); const loc = { hash: '', pathname: '/', search: '' };
  const G = { localStorage: mk(store), sessionStorage: mk(sess), location: loc, history: { replaceState: (_s, _t, u) => { loc.hash = u.slice(u.indexOf('#')); } } };
  const saved = Object.fromEntries(Object.keys(G).map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k, v] of Object.entries(G)) Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  try {
    const P = await import('../../../../app/src/lib/pair.js');
    const A = 'a'.repeat(64), B = 'b'.repeat(64);
    const go = (h) => { loc.hash = h; const r = P.capturePairing(); assert.equal(loc.hash, h ? '#/' : h, '주소에서 바로 지움'); return r; };
    assert.equal(go(''), '');
    assert.equal(go(`#pair=${A}&port=6600`), 'saved', '처음 짝');
    assert.deepEqual(P.pairing(), { token: A, port: 6600, ok: false }); assert.equal(sess.get('lecpage:paired'), '1');
    assert.equal(go(`#pair=${B}&port=6601`), 'saved', '아직 답한 적 없는 짝은 바로 바뀜(끊길 연결이 없음, Safari 포함)');
    assert.equal(P.pairing().token, B);
    go(`#pair=${A}&port=6600`);
    P.confirmPairing(B); assert.equal(P.pairing().ok, false, '다른 토큰의 답은 표시하지 않음');
    P.confirmPairing(A); assert.deepEqual(P.pairing(), { token: A, port: 6600, ok: true });
    sess.clear();
    assert.equal(go(`#pair=${B}&port=6601`), 'check', '쓰던 짝 + 다른 토큰: 확인 뒤에만');
    assert.deepEqual(P.pairing(), { token: A, port: 6600, ok: true }, '쓰던 짝 그대로');
    assert.deepEqual(P.pendingPairing(), { token: B, port: 6601 }); assert.equal(sess.get('lecpage:paired'), undefined, '바뀌지 않았으니 방금 짝 맞춤 아님');
    assert.equal(go(`#pair=${A}&port=6602`), 'saved', '같은 토큰은 포트만 바뀜');
    assert.deepEqual(P.pairing(), { token: A, port: 6602, ok: true });
    assert.equal(P.acceptPairing(P.pendingPairing()), true, '커넥트가 새 토큰에 답함 → 바꿈');
    assert.deepEqual(P.pairing(), { token: B, port: 6601, ok: true }); assert.equal(P.pendingPairing(), null);
    P.movePairing(6605, A); assert.equal(P.pairing().port, 6601, '그사이 바뀐 짝은 예전 토큰의 포트로 옮기지 않음');
    P.movePairing(6605, B); assert.equal(P.pairing().port, 6605);
    assert.equal(go(`#pair=${A}&port=99999`), '', '포트가 이상하면 기억하지 않음(주소에서는 지움)');
    loc.hash = '#pair=zz&port=6600'; assert.equal(P.capturePairing(), '', '짝 꼴이 아니면 그대로(앱 주소로 읽음)');
    P.forgetPairing(); assert.equal(P.pairing(), null);
  } finally {
    for (const [k, d] of Object.entries(saved)) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; }
  }
});

test('두 번 켤 때: 같은 토큰으로 켜진 커넥트를 찾아 그것으로 lecpage.com을 엶(둘째를 띄우지 않음) · 다른 프로그램에는 토큰을 보내지 않음 · --new-token은 거절 · 예전 판은 스스로 바꾸게', { timeout: 60000 }, async () => {
  const home = mkdtempSync(join(T, 'again-'));
  assert.equal(St.savedToken(home), '', '토큰이 없으면 만들지 않음');
  assert.throws(() => statSync(join(home, 'studio.json')), /ENOENT/);
  assert.equal(await St.studioAgain({ home }), false, '토큰이 없으면 찾지 않고 새로 켬');
  // 범위 안의 다른 프로그램: 토큰을 받으면 안 됨
  let leaked = 0;
  const other = http.createServer((q, s) => { if (q.headers['x-lecpage-bridge']) leaked++; s.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>다른 프로그램</title>'); });
  let otherPort = 0;
  for (let p = 6649; p >= 6600 && !otherPort; p--) { try { await new Promise((ok, no) => { other.once('error', no); other.listen(p, '127.0.0.1', ok); }); otherPort = p; } catch { /* 다음 */ } }
  const st = await St.startStudio({ port: 0, dist: DIST, home });
  try {
    const token = St.savedToken(home);
    assert.equal(token, st.S.token, '켜진 커넥트가 쓰는 토큰');
    const found = await St.findRunning(token);
    assert.equal(found?.port, st.port); assert.equal(found.status.build, st.S.build);
    assert.equal(await St.findRunning('f'.repeat(64), { ports: [st.port, otherPort] }), null, '다른 토큰(다른 사용자)이면 못 찾음 → 새로 켬');
    assert.equal(leaked, 0, '토큰 없이 먼저 물어 lecpage 커넥트처럼 답하는 곳에만 토큰을 보냄');
    const run = async (args) => { const opened = [], logs = [], fails = []; const r = await St.studioAgain({ home, args, root: st.S.root, open: async (u) => { opened.push(u); return true; }, log: (m) => logs.push(m), fail: (m) => fails.push(m) }); return { r, opened, logs, fails }; };
    let o = await run({});
    assert.equal(o.r, true, '켜진 것을 씀');
    assert.equal(o.opened.length, 1); assert.ok(o.opened[0].endsWith(`/#pair=${token}&port=${st.port}`), o.opened[0]);
    assert.match(o.logs.join('\n'), /이미 켜져 있어요/);
    o = await run({ autostart: true }); assert.equal(o.r, true); assert.deepEqual(o.opened, [], '자동 시작은 브라우저를 열지 않음');
    o = await run({ 'no-open': true }); assert.deepEqual(o.opened, []);
    o = await run({ open: 'local' }); assert.deepEqual(o.opened, [`http://127.0.0.1:${st.port}/`]);
    o = await run({ 'new-token': true }); assert.match(o.fails.join(), /이미 켜져 있어요.*--new-token/, '켜진 것은 예전 토큰을 계속 받으니 먼저 닫게'); assert.deepEqual(o.opened, []);
    assert.equal((await req(st.port, 'GET', '/bridge/status', { headers: { 'x-lecpage-bridge': token } })).status, 200, '켜진 커넥트는 그대로');
    // 실행 파일이 새 판을 받았는데 켜진 것이 스스로 바꿀 수 없는 판(저장소에서 켬): 지금처럼 새 판을 따로 켬
    const newer = mkdtempSync(join(T, 'root-')); writeFileSync(join(newer, 'VERSION'), 'zz-new\n');
    const logs = [];
    assert.equal(await St.studioAgain({ home, root: newer, log: (m) => logs.push(m), open: async () => true }), false);
    assert.match(logs.join(), /예전 버전 lecpage 커넥트가 켜져 있어요/);
  } finally { await st.close(); other.close(); }
  // 켜진 것이 예전 판이고 스스로 바꿀 수 있으면: 새 판으로 바꾸게 하고(같은 토큰으로 다시 켜짐) 다시 켜진 것을 씀
  const h2 = mkdtempSync(join(T, 'again2-')); const tk = St.pairToken(h2);
  const root = mkdtempSync(join(T, 'root2-')); writeFileSync(join(root, 'VERSION'), 'b2\n');
  const seen = []; let n = 0;
  const statusOf = (build, state) => ({ ok: true, build, caps: ['status-caps', 'update'], update: { can: true, state }, agents: [] });
  const find = async (t) => { assert.equal(t, tk); n++; return n === 1 ? { port: 6611, status: statusOf('b1', 'idle') } : n === 2 ? null : n === 3 ? { port: 6611, status: statusOf('b1', 'restart') } : { port: 6611, status: statusOf('b2', 'idle') }; };
  const ask = async (port, o) => { seen.push([port, o.method, o.path, o.headers.origin, o.headers['x-lecpage-bridge'] === tk]); return { status: 202, json: { ok: true } }; };
  const opened = [];
  assert.equal(await St.studioAgain({ home: h2, root, find, ask, wait: async () => {}, open: async (u) => { opened.push(u); return true; }, log: () => {} }), true);
  assert.deepEqual(seen, [[6611, 'POST', '/bridge/update', 'http://127.0.0.1:6611', true]], '켜진 것에게 새 판으로 바꾸라고(같은 출처·토큰)');
  assert.equal(n, 4, '다시 켜져 새 판으로 답할 때까지 기다림');
  assert.ok(opened[0].endsWith(`#pair=${tk}&port=6611`));
  // 만드는 중이라 못 바꿈(409 busy): 켜진 판 그대로 씀
  n = 0; const busy = await St.studioAgain({ home: h2, root, find: async () => ({ port: 6611, status: statusOf('b1', 'idle') }), ask: async () => ({ status: 409, json: { error: 'busy' } }), open: async () => true, log: () => {} });
  assert.equal(busy, true);
  // 실행 파일이 새 판(latest)을 보고도 묶음을 갈아 끼우지 않고 넘김(켜진 커넥트 밑의 파일을 바꾸지 않음): 켜진 것이 이 묶음과 같은 판이어도
  // 그 판이 아니면 스스로 바꾸게 부탁함(받아 가지 않은 결과가 있으면 바꾸지 않게 keep). 이미 그 판이면 부탁하지 않음
  const same = mkdtempSync(join(T, 'root3-')); writeFileSync(join(same, 'VERSION'), 'b1\n');
  const asked = []; n = 0;
  const find2 = async () => { n++; return n === 1 ? { port: 6612, status: statusOf('b1', 'idle') } : { port: 6612, status: statusOf('b3', 'idle') }; };
  const ask2 = async (port, o) => { asked.push([o.method, o.path, o.body]); return { status: 202, json: { ok: true } }; };
  assert.equal(await St.studioAgain({ home: h2, root: same, latest: 'b3', find: find2, ask: ask2, wait: async () => {}, open: async () => true, log: () => {} }), true);
  assert.deepEqual(asked, [['POST', '/bridge/update', { keep: true }]]);
  asked.length = 0;
  assert.equal(await St.studioAgain({ home: h2, root: same, latest: 'b1', find: async () => ({ port: 6612, status: statusOf('b1', 'idle') }), ask: ask2, open: async () => true, log: () => {} }), true);
  assert.equal(await St.studioAgain({ home: h2, root: same, latest: 'not a version!', find: async () => ({ port: 6612, status: statusOf('b1', 'idle') }), ask: ask2, open: async () => true, log: () => {} }), true);
  assert.deepEqual(asked, [], '같은 판이거나 판 이름 꼴이 아니면 부탁하지 않음');
  // 스스로 바꿀 수 없는 커넥트(저장소에서 켬)가 이 묶음과 같은 판이면: 둘째를 띄우지 않고 그대로 씀
  const cant = { ok: true, build: 'b1', caps: ['status-caps'], update: { can: false }, agents: [] };
  assert.equal(await St.studioAgain({ home: h2, root: same, latest: 'b3', find: async () => ({ port: 6612, status: cant }), ask: ask2, open: async () => true, log: () => {} }), true);
  assert.deepEqual(asked, []);
});

test('보안 머리글: 이 주소의 화면·글은 Cross-Origin-Resource-Policy: same-origin(토큰이 든 첫 화면 포함) · /bridge/*·앱 부품·참고 디자인은 그대로(CORS·미리보기 틀)', async () => {
  const dist = mkdtempSync(join(T, 'corp-'));
  mkdirSync(join(dist, 'assets')); mkdirSync(join(dist, 'examples', 'x'), { recursive: true });
  writeFileSync(join(dist, 'index.html'), '<!doctype html><html><head><title>앱</title></head><body></body></html>');
  writeFileSync(join(dist, 'help.html'), '<!doctype html><title>도움말</title>');
  writeFileSync(join(dist, 'assets', 'a.js'), 'console.log(1)');
  writeFileSync(join(dist, 'examples', 'x', 'index.html'), '<!doctype html><title>예시</title>');
  writeFileSync(join(dist, 'examples', 'x', 'p.png'), 'x');
  const st = await St.startStudio({ port: 0, dist, home: mkdtempSync(join(T, 'corp-h-')) });
  const corp = async (path, o) => (await req(st.port, 'GET', path, o)).headers['cross-origin-resource-policy'];
  try {
    const home = await req(st.port, 'GET', '/');
    assert.equal(home.headers['cross-origin-resource-policy'], 'same-origin'); assert.equal(home.headers['cache-control'], 'no-store');
    assert.equal(home.headers['x-frame-options'], 'DENY'); assert.equal(home.headers['x-content-type-options'], 'nosniff');
    assert.equal(await corp('/help.html'), 'same-origin');
    const nf = await req(st.port, 'GET', '/nope');
    assert.equal(nf.status, 404); assert.match(nf.headers['content-type'], /text\/plain/); assert.equal(nf.headers['cross-origin-resource-policy'], 'same-origin');
    assert.equal(await corp('/', { headers: { host: `evil.example:${st.port}` } }), 'same-origin', '421 안내 글도');
    assert.equal(await corp('/assets/a.js'), undefined, '앱 부품은 미리보기 틀(불투명 출처)이 받음');
    assert.equal(await corp('/examples/x/'), undefined, '참고 디자인(sandbox)');
    assert.equal(await corp('/examples/x/p.png'), undefined);
    const b = await req(st.port, 'GET', '/bridge/status', { headers: { 'x-lecpage-bridge': st.S.token, origin: 'https://lecpage.com', 'sec-fetch-site': 'cross-site' } });
    assert.equal(b.status, 200); assert.equal(b.headers['access-control-allow-origin'], 'https://lecpage.com'); assert.equal(b.headers['cross-origin-resource-policy'], undefined, 'lecpage.com이 CORS로 부르는 길은 그대로');
    const u = await req(st.port, 'GET', '/bridge/status', { headers: { origin: 'https://lecpage.com', 'sec-fetch-site': 'cross-site' } });
    assert.equal(u.status, 401); assert.equal(u.headers['access-control-allow-origin'], 'https://lecpage.com');
    assert.deepEqual(St.pageCorp({ 'content-type': 'application/json' }), { 'content-type': 'application/json' });
    assert.equal(St.pageCorp({ 'content-type': 'text/html', 'access-control-allow-origin': '*' })['cross-origin-resource-policy'], undefined);
  } finally { await st.close(); }
});

test('교재 개수: 원본과 같은 이름의 PDF는 하나로(PPTX 11개 + 만든 PDF 11개 = 11개) · 다른 교재는 20개까지', async () => {
  const f = (n) => ({ name: n, type: 'application/octet-stream', base64: 'JVBERi0x' });
  const twins = []; for (let i = 1; i <= 11; i++) twins.push(f(`강의${i}.pptx`), f(`강의${i}.pdf`));
  const ok = await St.validateJob({ agent: 'claude', files: twins });
  assert.equal(ok.error, undefined, ok.error); assert.equal(ok.materials.length, 22);
  const many = []; for (let i = 1; i <= 21; i++) many.push(f(`교재${i}.pdf`));
  assert.match((await St.validateJob({ agent: 'claude', files: many })).error, /20개까지/);
  const raw = []; for (let i = 1; i <= 41; i++) raw.push(f(`a${i}.pdf`));
  assert.match((await St.validateJob({ agent: 'claude', files: raw })).error, /20개까지/);
  assert.equal(St.materialItems(['a.pptx', 'A.pdf', 'b.docx']), 2);
});

test('ChatGPT 모델 목록: OpenAI가 잠깐 안 되면(5xx·429) 502·503(다시 로그인 아님) · 401은 한 번 새로 받아 보고도 안 될 때만 not-connected', async () => {
  const home = mkdtempSync(join(T, 'models-'));
  const credit = () => writeFileSync(join(home, 'chatgpt.json'), JSON.stringify({ email: 't@example.com', client_id: 'oaiapp_x', access_token: 'at-1', refresh_token: 'rt-1', expires_in: 3600, saved_at: new Date().toISOString(), scopes: ['chatgpt.tokens.use.direct'] }));
  credit();
  let models = 503; let refresh = 400; const hits = [];
  const fetchImpl = async (url) => {
    const u = String(url); hits.push(new URL(u).pathname);
    if (u.endsWith('/v1/models')) return new Response(models === 200 ? JSON.stringify({ models: [{ slug: 'm1', display_name: 'M1' }] }) : '{}', { status: models, headers: { 'content-type': 'application/json' } });
    if (u.endsWith('/oauth/token')) return refresh === 200 ? new Response(JSON.stringify({ access_token: 'at-2', refresh_token: 'rt-2', expires_in: 3600 }), { status: 200 }) : new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
    return new Response('', { status: 404 });
  };
  const st = await St.startStudio({ port: 0, dist: DIST, home, fetchImpl });
  const L = { 'x-lecpage-bridge': st.S.token, origin: 'https://lecpage.com', 'sec-fetch-site': 'cross-site' };
  const get = () => req(st.port, 'GET', '/bridge/chatgpt/models', { headers: L });
  try {
    let r = await get(); assert.equal(r.status, 503); assert.equal(r.json().error, 'models-unavailable'); assert.match(r.json().message_ko, /잠시 뒤/);
    models = 429; r = await get(); assert.equal(r.status, 503);
    models = 404; r = await get(); assert.equal(r.status, 502); assert.equal(r.json().error, 'models-unavailable');
    models = 200; r = await get(); assert.equal(r.status, 200); assert.deepEqual(r.json().models, [{ id: 'm1', label: 'M1' }]);
    // 401: 새로 받기(refresh)를 한 번 해 보고, 그것도 안 되면(invalid_grant) not-connected
    const sw = createSiwc({ home, port: 1, fetchImpl: (u) => { models = 401; return fetchImpl(u); } });
    hits.length = 0;
    assert.equal(await sw.models(), null); assert.ok(hits.includes('/api/accounts/oauth/token'), '한 번 새로 받아 봄');
    // 401인데 새로 받으면 됨 → 다시 불러 목록
    credit(); refresh = 200; let n = 0;
    const sw2 = createSiwc({ home, port: 1, fetchImpl: async (url) => { const u = String(url); if (u.endsWith('/v1/models')) return new Response(++n === 1 ? '{}' : JSON.stringify({ models: [{ slug: 'm2' }] }), { status: n === 1 ? 401 : 200 }); return fetchImpl(url); } });
    assert.deepEqual(await sw2.models(), [{ id: 'm2', label: 'm2' }]);
  } finally { await st.close(); }
});

test('Codex가 lecpage가 쓰기엔 예전 판(need install): [업데이트]는 공식 설치 명령으로 새 판 + 로그인(로그인만 하지 않음)', { skip: !posix && 'POSIX만', timeout: 60000 }, async () => {
  const term = join(T, 'term-codex.log');
  const fakeTerm = join(T, 'fake-term-codex'); writeFileSync(fakeTerm, `#!/bin/sh\nprintf '%s\\n---\\n' "$1" >> "${term}"\n`); chmodSync(fakeTerm, 0o755);
  const bin = join(T, 'bin-codex-old'); mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'codex'), `#!/bin/sh\nexec "${process.execPath}" "${join(HERE, 'fixtures', 'fake-agent.mjs')}" codex "$@"\n`); chmodSync(join(bin, 'codex'), 0o755);
  await withEnv({ PATH: `${bin}:/usr/bin:/bin`, LECPAGE_STUDIO_TERMINAL: fakeTerm, FAKE_CODEX_VERSION: '0.100.0', HOME: mkdtempSync(join(T, 'h-cx-')), LOCALAPPDATA: '', APPDATA: '' }, async () => {
    const st = await St.startStudio({ port: 0, dist: DIST, home: mkdtempSync(join(T, 'cx-old-')) });
    const H = { 'x-lecpage-bridge': st.S.token, origin: 'https://lecpage.com' };
    try {
      const cx = (await req(st.port, 'GET', '/bridge/status?fresh', { headers: H })).json().agents.find((a) => a.id === 'codex');
      assert.deepEqual([cx.installed, cx.need, cx.ready], [true, 'install', false]); assert.match(cx.note_ko, /\[업데이트\]/);
      const r = (await req(st.port, 'POST', '/bridge/agents/codex/install', { headers: H, body: {} })).json();
      assert.equal(r.action, 'install');
      await new Promise((ok) => setTimeout(ok, 400));
      assert.match(readFileSync(term, 'utf8'), /curl -fsSL https:\/\/chatgpt\.com\/codex\/install\.sh \| sh && .*codex" login/);
    } finally { await st.close(); }
  });
});

test('결과 바이너리: 문서·묶음은 강사가 준 파일과 같을 때만, 그림·글꼴·소리는 그 형식일 때만(이 PC 파일이 이름만 바꿔 사이트에 실리지 않게)', () => {
  const b64 = (b) => ({ base64: Buffer.from(b).toString('base64') });
  const sha = (b) => createHash('sha256').update(Buffer.from(b)).digest('hex');
  const given = Buffer.from('%PDF-1.7 강사 교재'); const photo = Buffer.from('not really a jpeg but the teacher gave it');
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]), Buffer.alloc(20)]);
  const key = Buffer.from('-----BEGIN OPENSSH PRIVATE KEY-----\nabc');
  const site = {
    'index.html': '<p>hi</p>',
    'files/교재.pdf': b64(given), 'assets/img/photo.jpg': b64(photo), 'assets/chart.png': b64(png), 'material/p-001.webp': b64(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')])),
    'files/secret.pdf': b64(Buffer.from('%PDF-1.4 PC 문서')), 'files/keys.zip': b64(Buffer.from('PK\x03\x04...')), 'assets/x.png': b64(key), 'assets/f.woff2': b64(key), 'files/x.mp3': b64(key),
  };
  const out = St.foreignBinaries(site, new Set([sha(given), sha(photo)])).sort();
  assert.deepEqual(out, ['assets/f.woff2', 'assets/x.png', 'files/keys.zip', 'files/secret.pdf', 'files/x.mp3']);
});
