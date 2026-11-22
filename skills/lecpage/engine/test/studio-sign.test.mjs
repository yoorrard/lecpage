// lecpage 커넥트 묶음 서명(ed25519): 공개 키 목록이 세 곳(studio-update.mjs·lecpage-connect.cmd·.sh)에서 같은지, 실행 파일의 서명 확인,
// 운영자 스크립트(scripts/studio-launcher/signing-key.mjs: new·add·remove·sign), .sh 실행 파일을 이 컴퓨터의 가짜 릴리스로 끝까지.
// 키는 시험 때만 만들어 쓰고 버림(저장소·릴리스와 무관)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, existsSync, statSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, generateKeyPairSync, sign as edSign } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import * as U from '../../scripts/studio-update.mjs';
import * as K from '../../../../scripts/studio-launcher/signing-key.mjs';

const ROOT = K.ROOT;
const SH = join(ROOT, 'scripts', 'studio-launcher', 'lecpage-connect.sh');
const CMD = join(ROOT, 'scripts', 'studio-launcher', 'lecpage-connect.cmd');
let T;
before(() => { T = mkdtempSync(join(tmpdir(), 'lp-studio-sign-')); });
after(() => rmSync(T, { recursive: true, force: true }));

function keyPair() { const { publicKey, privateKey } = generateKeyPairSync('ed25519'); return { x: publicKey.export({ format: 'jwk' }).x, privateKey, pem: privateKey.export({ type: 'pkcs8', format: 'pem' }) }; }
const sigOf = (buf, privateKey) => `${edSign(null, buf, privateKey).toString('base64')}\n`;
const sha = (b) => createHash('sha256').update(b).digest('hex');
/** 공개 키 목록이 박힌 세 파일만 같은 자리에 복사한 가짜 저장소 */
function fakeRepo() {
  const r = mkdtempSync(join(T, 'repo-'));
  for (const e of K.KEY_FILES) { mkdirSync(dirname(join(r, e.file)), { recursive: true }); cpSync(join(ROOT, e.file), join(r, e.file)); }
  return r;
}
const verifyJs = {
  sh: () => readFileSync(SH, 'utf8').match(/^VERIFY_JS="(.*)"$/m)?.[1],
  cmd: () => readFileSync(CMD, 'utf8').match(/^\$VerifyJs = @'\r?\n([^\r\n]*)\r?\n'@\r?$/m)?.[1],
};

test('공개 키 목록: 세 곳(기준 studio-update.mjs, 실행 파일 둘)이 같고 모두 올바른 ed25519 키', () => {
  const all = K.readKeys();
  assert.deepEqual(Object.keys(all), K.KEY_FILES.map((e) => e.file));
  for (const [file, keys] of Object.entries(all)) assert.deepEqual(keys, U.SIGNING_KEYS, `${file}의 목록이 studio-update.mjs와 달라요. signing-key.mjs add·remove로 함께 고쳐요`);
  assert.deepEqual(K.embeddedKeys(), U.SIGNING_KEYS);
});

test('실행 파일 두 개의 서명 확인 글이 같고, 셸·PowerShell 5.1이 건드릴 글자가 없으며, 맞는 서명만 통과', () => {
  const js = verifyJs.sh();
  assert.ok(js, 'lecpage-connect.sh의 VERIFY_JS');
  assert.equal(verifyJs.cmd(), js, 'lecpage-connect.cmd의 $VerifyJs가 .sh와 같아야 해요');
  // 셸 큰따옴표 안: $·역따옴표·큰따옴표·느낌표 없음. PowerShell 5.1이 실행 파일에 인자로 넘길 때: 큰따옴표 없음·역슬래시로 끝나지 않음
  assert.doesNotMatch(js, /["$`!]/); assert.doesNotMatch(js, /\\$/);
  const a = keyPair(); const b = keyPair();
  const d = mkdtempSync(join(T, 'vjs-'));
  const file = join(d, 'pkg.tgz'); writeFileSync(file, '묶음');
  const run = (sig, keys) => {
    const sigFile = join(d, 'pkg.sig');
    rmSync(sigFile, { force: true }); if (sig != null) writeFileSync(sigFile, sig);
    return spawnSync(process.execPath, ['-e', js], { env: { LECPAGE_VERIFY_FILE: file, LECPAGE_VERIFY_SIG: sigFile, LECPAGE_VERIFY_KEYS: keys.join(' ') } }).status;
  };
  const good = sigOf(Buffer.from('묶음'), a.privateKey);
  assert.equal(run(good, [a.x]), 0);
  assert.equal(run(good, [b.x]), 1, '다른 키');
  assert.equal(run(good, [b.x, a.x]), 0, '키 목록 중 하나');
  assert.equal(run(sigOf(Buffer.from('묶음'), b.privateKey) + good, [a.x]), 0, '여러 줄 중 하나');
  assert.equal(run(sigOf(Buffer.from('다른 묶음'), a.privateKey), [a.x]), 1, '바뀐 묶음');
  assert.equal(run(null, [a.x]), 1, '.sig 없음');
  assert.equal(run('garbage\n', [a.x]), 1);
  assert.equal(run(good, []), 1, '키가 없으면 통과시키지 않음(실행 파일은 키가 있을 때만 부름)');
  assert.equal(run(good, ['not-a-key', a.x]), 0, '이상한 키는 건너뜀');
});

test('Windows 실행 파일: 배치 머리 부분은 그대로(도는 중에 새것으로 바뀌어도 cmd가 같은 자리를 이어 읽게) · 확인 → 표시 지우기 → 풀기 순서', () => {
  const crlf = readFileSync(CMD, 'utf8').replace(/\r?\n/g, '\r\n');
  // 이미 깔린 자동 시작 복사본(lecpage-connect.cmd)과 같은 머리 부분. 바꾸면 도는 중인 복사본을 바꿀 때 cmd가 엉뚱한 줄을 읽음:
  // 꼭 바꿔야 하면 studio-update.mjs refreshLauncher·실행 파일의 머리 부분 비교가 그 복사본을 건너뜀(사용자가 새 실행 파일을 직접 켤 때 바뀜)
  const pinned = [
    '@echo off',
    'setlocal',
    'rem lecpage Connect for Windows. Double-click: prepares Node.js (first time), gets the latest lecpage Connect, starts it, opens lecpage.com.',
    'rem The batch part stays ASCII; the PowerShell part below (after the marker line) holds the Korean messages.',
    'set "LECPAGE_SELF=%~f0"',
    'set "LECPAGE_ARGS=%*"',
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=[IO.File]::ReadAllText($env:LECPAGE_SELF,[Text.Encoding]::UTF8); $i=$s.IndexOf('#'+'#PS#'+'#'); iex $s.Substring($i)"`,
    'set "RC=%ERRORLEVEL%"',
    'if not "%RC%"=="0" pause',
    'exit /b %RC%',
    '',
  ].join('\r\n');
  assert.equal(U.batchHead(Buffer.from(crlf)).toString('latin1'), pinned);
  const ps = crlf.slice(crlf.indexOf('##PS##'));
  const at = (s, from = 0) => { const i = ps.indexOf(s, from); assert.ok(i >= 0, s); return i; };
  const upd = at("Invoke-WebRequest -Uri \"$Base/lecpage-connect.zip\"");
  const seq = ['(Sha $zip) -ne $want', 'SigOk $node $zip $sig', 'Unblock-File -LiteralPath $zip', 'Expand-Archive -LiteralPath $zip'];
  seq.reduce((from, s) => { const i = at(s, from); return i + 1; }, upd);
  // 자동 시작 복사본: 묶음 안의 실행 파일에서, 표시 지우기는 묶음에서 온 것만
  assert.match(ps, /\$src = Join-Path \$app 'lecpage-connect\.cmd'/);
  assert.match(ps, /if \(\$fromPkg\) \{ Unblock-File -LiteralPath \$dst \}/);
  assert.match(ps, /\(Head \$src\) -cne \(Head \$dst\)/);
  assert.equal((ps.match(/Unblock-File/g) || []).length, 3, 'Unblock-File은 실행 파일이 받아 확인한 파일과 그 복사본에만');
});

test('sign(워크플로): 공개 키도 비밀도 없으면 건너뜀 · 공개 키가 있는데 비밀이 없거나 다른 키면 실패 · 맞으면 .sig를 쓰고 커넥트가 받아들임', () => {
  const repo = fakeRepo();
  const a = keyPair(); const b = keyPair();
  const out = mkdtempSync(join(T, 'out-'));
  const f = join(out, 'lecpage-connect.tar.gz'); writeFileSync(f, '묶음 바이트');
  const logs = []; const log = (m) => logs.push(m);
  K.writeKeys([], repo);
  assert.deepEqual(K.runSign({ files: [f], pem: '', root: repo, log }), { signed: [], skipped: true });
  assert.ok(!existsSync(`${f}.sig`));
  // 키를 넣기 전에 비밀만 먼저 등록해 둔 경우: 서명은 올리지만(실행 파일은 아직 확인하지 않음) 실패하지 않음
  assert.equal(K.runSign({ files: [f], pem: a.pem, root: repo, log }).signed.length, 1);
  rmSync(`${f}.sig`);
  K.writeKeys([a.x], repo);
  assert.throws(() => K.runSign({ files: [f], pem: '', root: repo, log }), /비밀 CONNECT_SIGNING_KEY가 없어요/);
  assert.throws(() => K.runSign({ files: [f], pem: b.pem, root: repo, log }), /어느 것과도 맞지 않아요/);
  assert.throws(() => K.runSign({ files: [f], pem: 'not a pem', root: repo, log }), /읽지 못했어요/);
  const rsa = generateKeyPairSync('rsa', { modulusLength: 1024 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
  assert.throws(() => K.runSign({ files: [f], pem: rsa, root: repo, log }), /ed25519가 아닌 키/);
  assert.throws(() => K.runSign({ files: [f], pem: '-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n', root: repo, log }), /읽지 못했어요/);
  assert.ok(!existsSync(`${f}.sig`), '실패하면 .sig를 쓰지 않음');
  const r = K.runSign({ files: [f], pem: a.pem, root: repo, log });
  assert.deepEqual(r.signed, [`${f}.sig`]);
  assert.match(readFileSync(`${f}.sig`, 'utf8'), /^[A-Za-z0-9+/]{86}==\n$/);
  assert.equal(U.verifySignature(readFileSync(f), readFileSync(`${f}.sig`, 'utf8'), [a.x]), true);
  assert.deepEqual(K.verifyFiles([f], repo), [{ file: f, ok: true }]);
  writeFileSync(f, '바뀐 묶음');
  assert.deepEqual(K.verifyFiles([f], repo), [{ file: f, ok: false }]);
  assert.ok(logs.every((m) => !m.includes('PRIVATE KEY')), '비밀 키를 기록에 내지 않음');
  // 키를 바꾸는 동안: 비밀에 예전 키·새 키를 이어 붙이면 둘 다로 서명(한 줄에 하나) → 예전 목록만 가진 실행 파일·커넥트도 받음
  K.writeKeys([a.x, b.x], repo);
  writeFileSync(f, '묶음 바이트');
  assert.deepEqual(K.runSign({ files: [f], pem: a.pem + b.pem, root: repo, log }).keys, [a.x, b.x]);
  const two = readFileSync(`${f}.sig`, 'utf8');
  assert.equal(two.trim().split('\n').length, 2);
  for (const k of [[a.x], [b.x]]) assert.equal(U.verifySignature(readFileSync(f), two, k), true, k[0]);
  assert.throws(() => K.runSign({ files: [f], pem: a.pem + keyPair().pem, root: repo, log }), /어느 것과도 맞지 않아요/, '목록에 없는 키가 섞이면 실패');
  // CLI: GitHub Actions에서는 실패를 ::error::로
  const errs = [];
  assert.equal(K.main(['sign', f], { env: { GITHUB_ACTIONS: 'true' }, log, err: (m) => errs.push(m) }), K.embeddedKeys().length ? 1 : 0);
});

test('new(운영자 PC): 비밀 키는 저장소 밖 0600 파일(덮지 않음), 공개 키는 세 곳에, 화면에는 비밀 키 대신 GitHub 비밀 등록 명령', () => {
  const repo = fakeRepo(); K.writeKeys([], repo);
  const home = mkdtempSync(join(T, 'home-'));
  const out = join(home, '.lecpage', 'connect-signing-key.pem');
  const logs = [];
  assert.throws(() => K.newKey({ out: join(repo, 'key.pem'), root: repo, log: () => {} }), /저장소 밖/);
  assert.throws(() => K.newKey({ out: join(repo, 'sub', 'key.pem'), root: repo, log: () => {} }), /저장소 밖/);
  const r = K.newKey({ out, root: repo, platform: 'linux', log: (m) => logs.push(m) });
  const pem = readFileSync(out, 'utf8');
  assert.match(pem, /^-----BEGIN PRIVATE KEY-----\n/);
  if (process.platform !== 'win32') { assert.equal(statSync(out).mode & 0o777, 0o600); assert.equal(statSync(dirname(out)).mode & 0o077, 0); }
  assert.deepEqual(Object.values(K.readKeys(repo)), [[r.publicKey], [r.publicKey], [r.publicKey]]);
  const text = logs.join('\n');
  assert.ok(!text.includes('PRIVATE KEY') && !text.includes(pem.split('\n')[1]), '화면에 비밀 키가 없음');
  assert.ok(text.includes(`gh secret set CONNECT_SIGNING_KEY --repo yoorrard/lecpage < '${out}'`), text);
  assert.ok(text.includes(r.publicKey));
  assert.match(K.secretCommand("C:\\Users\\O'Neil\\.lecpage\\k.pem", 'win32'), /^Get-Content -Raw 'C:\\Users\\O''Neil\\\.lecpage\\k\.pem' \| gh secret set CONNECT_SIGNING_KEY --repo yoorrard\/lecpage$/);
  assert.throws(() => K.newKey({ out, root: repo, log: () => {} }), /이미 키 파일이 있어요/, '있는 키를 덮지 않음');
  assert.equal(readFileSync(out, 'utf8'), pem);
  // 만든 키로 서명하면 그 저장소의 공개 키로 맞음
  const f = join(home, 'b.zip'); writeFileSync(f, 'zip');
  K.runSign({ files: [f], pem, root: repo, log: () => {} });
  assert.deepEqual(K.verifyFiles([f], repo), [{ file: f, ok: true }]);
  // 두 번째 키(키 바꾸기): 목록에 더하고, 비밀은 예전 키·새 키를 이어 붙여 등록하라고 안내
  const out2 = join(home, '.lecpage', 'connect-signing-key-2.pem'); const logs2 = [];
  const r2 = K.newKey({ out: out2, root: repo, platform: 'linux', log: (m) => logs2.push(m) });
  assert.deepEqual(K.embeddedKeys(repo), [r.publicKey, r2.publicKey]);
  assert.ok(logs2.join('\n').includes(`cat '<예전 키 파일>' '${out2}' | gh secret set CONNECT_SIGNING_KEY --repo yoorrard/lecpage`), logs2.join('\n'));
  assert.equal(K.secretCommand(['a.pem', 'b.pem'], 'win32'), "Get-Content -Raw 'a.pem','b.pem' | gh secret set CONNECT_SIGNING_KEY --repo yoorrard/lecpage");
  assert.equal(K.runSign({ files: [f], pem: pem + readFileSync(out2, 'utf8'), root: repo, log: () => {} }).keys.length, 2);
});

test('add·remove(키 바꾸기): 새 키를 먼저 넣고 예전 키를 뺌 · 잘못된 키·같은 키는 거절 · 세 곳이 서로 다르면 sign이 거절', () => {
  const repo = fakeRepo(); K.writeKeys([], repo);
  const a = keyPair(); const b = keyPair();
  assert.deepEqual(K.addKey(a.x, repo), [a.x]);
  assert.deepEqual(K.addKey(b.x, repo), [a.x, b.x]);
  assert.match(readFileSync(join(repo, 'scripts/studio-launcher/lecpage-connect.sh'), 'utf8'), new RegExp(`^  SIGNING_KEYS='${a.x} ${b.x}'$`, 'm'));
  assert.match(readFileSync(join(repo, 'scripts/studio-launcher/lecpage-connect.cmd'), 'utf8'), new RegExp(`^\\$SigningKeys = @\\('${a.x}', '${b.x}'\\)$`, 'm'));
  assert.match(readFileSync(join(repo, 'skills/lecpage/scripts/studio-update.mjs'), 'utf8'), new RegExp(`^export const SIGNING_KEYS = \\['${a.x}', '${b.x}'\\];$`, 'm'));
  assert.throws(() => K.addKey(a.x, repo), /이미/);
  assert.throws(() => K.addKey('short', repo), /꼴이 아니에요/);
  assert.throws(() => K.removeKey(keyPair().x, repo), /들어 있지 않은/);
  assert.deepEqual(K.removeKey(a.x, repo), [b.x]);
  assert.deepEqual(K.removeKey(b.x, repo), []);
  // 한 곳만 손으로 고친 경우
  const shFile = join(repo, 'scripts/studio-launcher/lecpage-connect.sh');
  writeFileSync(shFile, K.withKeys(K.KEY_FILES[1], readFileSync(shFile, 'utf8'), [a.x]));
  assert.throws(() => K.embeddedKeys(repo), /서로 달라요/);
  assert.throws(() => K.runSign({ files: [shFile], pem: a.pem, root: repo, log: () => {} }), /서로 달라요/);
});

// ── .sh 실행 파일을 가짜 릴리스(127.0.0.1)로 끝까지: 받기 → SHA-256 → 서명 → 풀기 → 자동 시작 복사본(LECPAGE_DRY_RUN=1이라 켜기 직전에 멈춤) ──
const canSh = process.platform !== 'win32' && spawnSync('sh', ['-c', 'command -v curl && command -v tar']).status === 0;
function bundle(ver) {
  const d = mkdtempSync(join(T, 'pkg-'));
  mkdirSync(join(d, 'skills', 'lecpage', 'scripts'), { recursive: true });
  writeFileSync(join(d, 'VERSION'), `${ver}\n`);
  writeFileSync(join(d, 'skills', 'lecpage', 'scripts', 'lecpage.mjs'), `// ${ver}\n`);
  writeFileSync(join(d, 'lecpage-connect.sh'), `#!/bin/sh\n# 묶음 안의 실행 파일 ${ver}\n`);
  const out = join(T, `${ver}-${Math.random().toString(36).slice(2)}.tgz`);
  assert.equal(spawnSync('tar', ['-czf', out, '-C', d, '.']).status, 0);
  return readFileSync(out);
}
async function release(files) {
  const hits = [];
  const srv = http.createServer((q, s) => { hits.push(q.url); const f = files[q.url.slice(1)]; if (f === undefined) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': 'application/octet-stream' }); s.end(f); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${srv.address().port}`, hits, close: () => new Promise((r) => srv.close(r)) };
}
function runLauncher(file, home, base) {
  const env = { PATH: `${dirname(process.execPath)}:/usr/bin:/bin`, HOME: home, XDG_DATA_HOME: join(home, 'data'), LECPAGE_RELEASE_BASE: base, LECPAGE_DRY_RUN: '1', NO_PROXY: '127.0.0.1', no_proxy: '127.0.0.1', LANG: 'C.UTF-8' };
  return new Promise((ok) => {
    const c = spawn('sh', [file], { env }); let out = '';
    c.stdout.on('data', (b) => { out += b; }); c.stderr.on('data', (b) => { out += b; });
    c.on('exit', (code) => ok({ code, out }));
  });
}
const lpDir = (home) => (process.platform === 'darwin' ? join(home, 'Library', 'Application Support', 'lecpage') : join(home, 'data', 'lecpage'));

test('.sh 실행 파일 + 가짜 릴리스: 공개 키가 없으면 지금처럼 SHA-256만 · 있으면 맞는 서명만 받고, 없거나 틀리면 있던 판으로(처음이면 멈춤)', { skip: !canSh && 'sh·curl·tar가 있는 macOS·Linux에서만' }, async () => {
  const a = keyPair(); const b = keyPair();
  const gz = bundle('2.0.0-new');
  const files = { VERSION: '2.0.0-new\n', 'lecpage-connect.tar.gz': gz, 'lecpage-connect.tar.gz.sha256': `${sha(gz)}  lecpage-connect.tar.gz\n` };
  const rel = await release(files);
  const keyed = join(mkdtempSync(join(T, 'launcher-')), 'lecpage-connect.sh');
  writeFileSync(keyed, K.withKeys(K.KEY_FILES[1], readFileSync(SH, 'utf8'), [b.x, a.x]));
  try {
    if (!U.SIGNING_KEYS.length) {
      // 저장소의 실행 파일 그대로(공개 키 없음): .sig 없이 받음, .sig를 찾지도 않음
      const h0 = mkdtempSync(join(T, 'h-'));
      const r0 = await runLauncher(SH, h0, rel.base);
      assert.equal(r0.code, 0, r0.out); assert.match(r0.out, /점검: /);
      assert.equal(readFileSync(join(lpDir(h0), 'studio', 'VERSION'), 'utf8').trim(), '2.0.0-new');
      assert.ok(!rel.hits.some((x) => x.endsWith('.sig')));
    }
    // 공개 키가 든 실행 파일, 처음 설치: 다른 키의 서명이면 받지 않고 멈춤(아무것도 풀지 않음)
    files['lecpage-connect.tar.gz.sig'] = sigOf(gz, keyPair().privateKey);
    const h1 = mkdtempSync(join(T, 'h-'));
    const r1 = await runLauncher(keyed, h1, rel.base);
    assert.equal(r1.code, 1, r1.out); assert.match(r1.out, /서명을 확인하지 못했어요/); assert.match(r1.out, /받지 못했어요/);
    assert.ok(!existsSync(join(lpDir(h1), 'studio')));
    // 맞는 서명(목록의 두 번째 키): 받아서 풀고, 자동 시작 복사본은 확인을 마친 묶음 안의 실행 파일로
    files['lecpage-connect.tar.gz.sig'] = sigOf(gz, a.privateKey);
    const r2 = await runLauncher(keyed, h1, rel.base);
    assert.equal(r2.code, 0, r2.out); assert.match(r2.out, /점검: /);
    assert.equal(readFileSync(join(lpDir(h1), 'studio', 'VERSION'), 'utf8').trim(), '2.0.0-new');
    assert.match(readFileSync(join(lpDir(h1), 'lecpage-connect.sh'), 'utf8'), /묶음 안의 실행 파일 2\.0\.0-new/);
    // 릴리스 파일을 바꿀 수 있는 사람이 묶음·.sha256·VERSION을 바꾸고 .sig를 지움 → 있던 판 그대로 켬
    const evil = bundle('6.6.6-evil');
    Object.assign(files, { VERSION: '6.6.6-evil\n', 'lecpage-connect.tar.gz': evil, 'lecpage-connect.tar.gz.sha256': `${sha(evil)}  lecpage-connect.tar.gz\n` });
    delete files['lecpage-connect.tar.gz.sig'];
    const r3 = await runLauncher(keyed, h1, rel.base);
    assert.equal(r3.code, 0, r3.out); assert.match(r3.out, /서명을 확인하지 못했어요/); assert.match(r3.out, /있던 판으로/);
    assert.equal(readFileSync(join(lpDir(h1), 'studio', 'VERSION'), 'utf8').trim(), '2.0.0-new');
    // 예전 묶음의 맞는 서명을 붙여도 안 됨
    files['lecpage-connect.tar.gz.sig'] = sigOf(gz, a.privateKey);
    const r4 = await runLauncher(keyed, h1, rel.base);
    assert.match(r4.out, /있던 판으로/);
    assert.equal(readFileSync(join(lpDir(h1), 'studio', 'VERSION'), 'utf8').trim(), '2.0.0-new');
  } finally { await rel.close(); }
});
