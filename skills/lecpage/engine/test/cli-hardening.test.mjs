// skill CLI 다듬기 회귀 시험(2026-11 점검): 도움말은 실행하지 않음·모르는 옵션·값 빠진 옵션·실패 종료 코드·스택 없는 오류·
// 위쪽 package.json이 commonjs여도 동작·판 표시·담아 둔 라이브러리·셸 없는 실행, 그리고 변이 시험이 놓친 곳(작은따옴표 이스케이프, 암호 반복 수).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, readdirSync, cpSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, webcrypto } from 'node:crypto';
import { crc32 } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as E from '../src/index.js';
import { nodeRuntime } from '../node.js';
import { esc } from '../src/render/html.js';
import { PROTECT_ITERATIONS } from '../src/protect.js';
import { kitBuild } from './kit-site.mjs';
import * as P from '../src/project-file.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = join(HERE, '..', '..');
const CLI = join(SKILL, 'scripts', 'lecpage.mjs');
const FX = join(HERE, 'fixtures');
// 인터넷 없이(글꼴 받기·주소 확인이 바로 실패하게): 닿지 않는 프록시
const OFFLINE = { NODE_USE_ENV_PROXY: '1', HTTPS_PROXY: 'http://127.0.0.1:9', https_proxy: 'http://127.0.0.1:9', HTTP_PROXY: 'http://127.0.0.1:9', http_proxy: 'http://127.0.0.1:9', NO_PROXY: '', no_proxy: '' };
let dir;
const run = (args, o = {}) => {
  const r = spawnSync(process.execPath, [o.cli || CLI, ...args], { cwd: o.cwd || dir, encoding: 'utf8', timeout: 120000, env: { ...process.env, ...OFFLINE, ...(o.env || {}) } });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || ''), stdout: r.stdout || '' };
};
const STACK = /\n\s+at\s|node:internal|TypeError|ReferenceError|Cannot read prop/;

/** 작업 폴더 하나: prepare(쪽 그림 없이) → 에이전트가 쓴 것처럼 site/index.html·lecpage.json → check(조립, 화면 그림 없이) */
function makeWork(name) {
  const r = run(['prepare', join(FX, 'notes.md'), '-o', name, '--no-slides']);
  assert.equal(r.code, 0, r.out);
  writeFileSync(join(dir, name, 'site', 'index.html'), '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>실습 메모</title></head><body><main><h1>실습 메모</h1><div data-lp="qa"></div></main></body></html>');
  writeFileSync(join(dir, name, 'lecpage.json'), JSON.stringify({ v: 2, title: '실습 메모', sessions: [{ date: '2026-12-03', start: '14:00', end: '16:00' }], features: ['qa'] }));
  run(['check', name, '--no-shots']);
  assert.ok(existsSync(join(dir, name, 'dist', 'index.html')));
}

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'lecpage-hard-'));
  makeWork('work');
});
after(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

test('H1: 위쪽 폴더 package.json이 "type":"commonjs"여도(npm init -y) 모든 명령이 돎 — engine/package.json의 type:module', () => {
  const proj = mkdtempSync(join(tmpdir(), 'lecpage-cjs-'));
  try {
    writeFileSync(join(proj, 'package.json'), JSON.stringify({ name: 'proj', version: '1.0.0', type: 'commonjs' }));
    const sk = join(proj, '.claude', 'skills', 'lecpage');
    cpSync(SKILL, sk, { recursive: true, filter: (p) => !/[\\/]engine[\\/]test([\\/]|$)|[\\/]node_modules([\\/]|$)/.test(relative(SKILL, p) ? p : '') });
    const cli = join(sk, 'scripts', 'lecpage.mjs');
    for (const args of [['prepare', join(FX, 'notes.md'), '-o', 'work', '--no-slides'], ['decide-infra'], ['--version']]) {
      const r = run(args, { cwd: proj, cli });
      assert.equal(r.code, 0, `${args[0]}: ${r.out}`);
      assert.doesNotMatch(r.out, /SyntaxError|MODULE_TYPELESS|Unexpected token 'export'/);
    }
    assert.equal(JSON.parse(readFileSync(join(SKILL, 'engine', 'package.json'), 'utf8')).type, 'module');
  } finally { rmSync(proj, { recursive: true, force: true }); }
});

test('H2: <명령> --help는 그 명령 도움말만 보이고 아무것도 실행하지 않음(prepare·check·publish·pack·app …)', () => {
  const log = join(dir, 'wrangler-help.log');
  const before = new Set(readdirSync(dir));
  for (const c of ['prepare', 'check', 'preview', 'publish', 'pack', 'app', 'serve', 'handouts', 'decide-infra', 'studio']) {
    for (const h of ['--help', '-h']) {
      const r = run([c, h], { env: { LECPAGE_WRANGLER: join(FX, 'fake-wrangler.mjs'), FAKE_WRANGLER_LOG: log } });
      assert.equal(r.code, 0, `${c} ${h}: ${r.out}`);
      assert.match(r.out, new RegExp(`(?:^|\\n)  (?:[^\\n]*· )?${c}(?: |$)`, 'm'), `${c} 줄이 없음:\n${r.out}`);
      assert.ok(r.out.split('\n').length < 14, `${c} 도움말이 그 명령만이 아님(${r.out.split('\n').length}줄)`);
    }
  }
  assert.ok(!existsSync(log), 'publish --help가 wrangler를 불렀음');
  assert.deepEqual(new Set(readdirSync(dir)), before, '도움말이 파일을 만들거나 지웠음');
  assert.equal(run(['help', 'check']).code, 0);
  const all = run(['--help']);
  assert.equal(all.code, 0); assert.match(all.out, /종료 코드/);
});

test('M5: 모르는 옵션은 비슷한 이름과 함께 멈추고, 값 옵션에 값이 없으면 멈춤(암호 없이 만들지 않음)', () => {
  const t1 = run(['prepare', '--no-slide', join(FX, 'notes.md')]);
  assert.equal(t1.code, 2); assert.match(t1.out, /혹시 --no-slides/);
  const pw = run(['pack', 'work', '-o', 'pw.zip', '--password']);
  assert.equal(pw.code, 2); assert.match(pw.out, /--password 뒤에 값이 없어요/);
  assert.ok(!existsSync(join(dir, 'pw.zip')), '값 없는 --password로 사이트를 만들었음');
  const short = run(['pack', 'work', '-o', 'pw.zip', '--password', 'ab']);
  assert.equal(short.code, 2); assert.match(short.out, /4자 이상/);
  const port = run(['serve', 'work', '--port', 'abc']);
  assert.equal(port.code, 2); assert.match(port.out, /--port는 숫자/);
  const other = run(['check', 'work', '--live']);
  assert.equal(other.code, 2); assert.match(other.out, /publish 명령의 옵션/);
  const typo = run(['prepar', 'x.md']);
  assert.equal(typo.code, 2); assert.match(typo.out, /혹시 prepare/);
  for (const r of [t1, pw, short, port, other, typo]) assert.doesNotMatch(r.out, STACK);
});

test('M4: 오류는 스택 없이 한국어 한 줄 + 다음 할 일(인자 없음·없는 파일·작업 폴더가 아님·없는 폴더)', () => {
  const cases = [
    [['prepare'], 1, /교재 파일을 주세요/],
    [['prepare', '없는교재.pdf', '-o', 'w-none'], 1, /읽은 내용이 없어요|없어요/],
    [['check', '없는폴더'], 1, /index\.html이 없어요/],
    [['app', '없는폴더'], 1, /없어요/],
    [['app', 'work/site'], 1, /작업 폴더가 아니에요/],
    [['serve', '없는폴더', '--port', '5942'], 1, /사이트가 없어요/],
  ];
  for (const [args, code, re] of cases) {
    const r = run(args);
    assert.equal(r.code, code, `${args.join(' ')}: ${r.out}`);
    assert.match(r.out, re, args.join(' '));
    assert.doesNotMatch(r.out, STACK, args.join(' '));
  }
  const pk = run(['pack', 'work', '-o', 'new-folder/site.zip']);
  assert.equal(pk.code, 0, pk.out); assert.ok(existsSync(join(dir, 'new-folder/site.zip')));
});

test('M6: 실패면 0이 아닌 종료 코드(없는 폴더 pack·열리지 않는 주소 handouts)', () => {
  const p = run(['pack', '없는폴더']);
  assert.equal(p.code, 1); assert.match(p.out, /사이트가 없어요/); assert.ok(!existsSync(join(dir, 'site.zip')));
  const h = run(['handouts', 'http://127.0.0.1:5943/']);
  assert.equal(h.code, 1); assert.match(h.out, /주소가 열리지 않아요/); assert.doesNotMatch(h.out, STACK);
});

/** GHSA-px8p-9vwx-vf98 재현: 중앙 디렉터리 압축 크기가 0xFFFFFFFF(ZIP64)인데 ZIP64 추가 필드가 없는 232바이트 PPTX */
function zip64Dos() {
  const pack = (spec) => { const parts = spec.map(([t, v]) => { const b = Buffer.alloc({ I: 4, H: 2, Q: 8 }[t]); if (t === 'I') b.writeUInt32LE(v); else if (t === 'H') b.writeUInt16LE(v); else b.writeBigUInt64LE(BigInt(v)); return b; }); return Buffer.concat(parts); };
  const name = Buffer.from('ppt/slides/slide1.xml'), data = Buffer.from('<p:sld/>'), crc = crc32(data);
  const local = Buffer.concat([pack([['I', 0x04034b50], ['H', 20], ['H', 0], ['H', 0], ['H', 0], ['H', 0], ['I', crc], ['I', data.length], ['I', data.length], ['H', name.length], ['H', 0]]), name, data]);
  const extra = Buffer.concat([pack([['H', 0x9999], ['H', 4]]), Buffer.alloc(4)]);
  const cd = Buffer.concat([pack([['I', 0x02014b50], ['H', 20], ['H', 20], ['H', 0], ['H', 0], ['H', 0], ['H', 0], ['I', crc], ['I', 0xFFFFFFFF], ['I', data.length], ['H', name.length], ['H', extra.length], ['H', 0], ['H', 0], ['H', 0], ['I', 0], ['I', 0]]), name, extra]);
  const z64 = pack([['I', 0x06064b50], ['Q', 44], ['H', 45], ['H', 45], ['I', 0], ['I', 0], ['Q', 1], ['Q', 1], ['Q', cd.length], ['Q', local.length]]);
  const loc = pack([['I', 0x07064b50], ['I', 0], ['Q', local.length + cd.length], ['I', 1]]);
  const eocd = pack([['I', 0x06054b50], ['H', 0], ['H', 0], ['H', 1], ['H', 1], ['I', cd.length], ['I', 0xFFFFFFFF], ['H', 0]]);
  return Buffer.concat([local, cd, z64, loc, eocd]);
}

test('H5: 망가진 ZIP64 교재(232바이트)로 멈추지 않고 곧바로 "손상" 오류(fflate 0.8.3)', () => {
  const f = join(dir, '교재.pptx'); writeFileSync(f, zip64Dos());
  assert.equal(readFileSync(f).length, 232);
  const code = `import(${JSON.stringify(pathToFileURL(join(HERE, '..', 'src', 'ingest', 'index.js')).href)}).then(async (I) => { const m = await I.ingestFile('교재.pptx', new Uint8Array(require('fs').readFileSync(${JSON.stringify(f)})), {}); console.log(m.errors.map((e) => e.code).join(',')); })`;
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8', timeout: 15000 });
  assert.equal(r.signal, null, '교재 해석이 끝나지 않음(fflate 무한 반복)');
  assert.match(r.stdout, /corrupt/, r.stdout + r.stderr);
  assert.ok(Date.now() - t0 < 10000);
  const made = run(['prepare', f, '-o', 'zwork', '--no-slides']);
  assert.equal(made.code, 1); assert.match(made.out, /손상|열 수 없어요/); assert.doesNotMatch(made.out, STACK);
});

test('L14: 담아 둔 라이브러리 표(VENDOR.json)가 파일·머리말·고지와 같고, 판을 고정하지 않은 npx는 까닭이 적힌 것뿐', () => {
  const t = JSON.parse(readFileSync(join(HERE, '..', 'vendor', 'VENDOR.json'), 'utf8'));
  for (const f of t.files) {
    const body = readFileSync(join(SKILL, f.path));
    assert.equal(createHash('sha256').update(body).digest('hex'), f.sha256, `${f.path}가 바뀌었는데 VENDOR.json을 고치지 않음`);
    assert.match(body.subarray(0, 400).toString(), new RegExp(`${f.name.replace(/-/g, '\\-')} ${f.version.replace(/\./g, '\\.')}`), `${f.path} 머리말 판`);
    assert.match(readFileSync(join(SKILL, '..', '..', 'THIRD_PARTY_NOTICES.md'), 'utf8'), new RegExp(`${f.name}\\]\\([^)]*\\)[^|]*\\| ${f.version.replace(/\./g, '\\.')} \\|`), `THIRD_PARTY_NOTICES의 ${f.name} 판`);
  }
  const ff = t.files.find((f) => f.name === 'fflate');
  const src = readFileSync(join(SKILL, ff.path), 'utf8');
  assert.equal(createHash('sha256').update(src.slice(src.indexOf('\n */\n') + 5)).digest('hex'), ff.originalSha256, 'fflate 본문이 원본과 다름');
  assert.ok(!/^0\.(?:[0-7]\.|8\.[0-2]$)/.test(ff.version), 'fflate 0.8.2 이하는 GHSA-px8p-9vwx-vf98');
  const loose = [];
  const walk = (d) => { for (const n of readdirSync(d, { withFileTypes: true })) { const p = join(d, n.name); if (n.isDirectory()) { if (!['test', 'node_modules', 'vendor'].includes(n.name)) walk(p); } else if (/\.(md|m?js)$/.test(n.name)) for (const m of readFileSync(p, 'utf8').matchAll(/npx (?:--yes )?(@?[a-z][\w./-]*)@latest/g)) loose.push(m[1]); } };
  walk(SKILL);
  const allowed = t.tools.filter((x) => x.version === 'latest').map((x) => x.name);
  assert.deepEqual([...new Set(loose)].filter((n) => !allowed.includes(n)), []);
});

test('M9: --version은 engine/package.json 판 하나, 엔진 VERSION도 같음, 더 새 lecpage로 만든 .lecpage는 한 줄로 알림', async () => {
  const ver = JSON.parse(readFileSync(join(HERE, '..', 'package.json'), 'utf8')).version;
  assert.equal(E.VERSION, ver); assert.equal(P.ENGINE_VERSION, ver);
  const r = run(['--version']); assert.equal(r.code, 0); assert.match(r.out, new RegExp(`lecpage ${ver.replace(/\./g, '\\.')}`)); assert.match(r.out, /claude plugin update lecpage@lecpage/);
  assert.match(run(['doctor']).out, new RegExp(`^lecpage ${ver.replace(/\./g, '\\.')}`));
  assert.equal(P.newerVersion('1.10.0', '1.9.3'), true); assert.equal(P.newerVersion('1.0.0', ver), false);
  assert.equal(P.versionNote({ formatVersion: 1, engine: ver }), '');
  assert.match(P.versionNote({ formatVersion: 1, engine: '99.0.0' }, 'skill 새로 받기'), /더 새 lecpage\(99\.0\.0\).*skill 새로 받기/);
  // 앱으로 넘기는 파일에 판을 적고, 더 새 판 파일을 풀면 알림
  const a = run(['app', 'work', '-o', 'x.lecpage']); assert.equal(a.code, 0, a.out);
  const files = P.readStoredZip(readFileSync(join(dir, 'x.lecpage')));
  const pj = JSON.parse(new TextDecoder().decode(files['project.json']));
  assert.equal(pj.engine, ver);
  pj.engine = '99.0.0'; files['project.json'] = new TextEncoder().encode(JSON.stringify(pj));
  writeFileSync(join(dir, 'new.lecpage'), E.zipFiles(files));
  const b = run(['app', 'new.lecpage', '-o', 'work-new']); assert.equal(b.code, 0, b.out);
  assert.match(b.out, /알림 더 새 lecpage\(99\.0\.0\)/);
  assert.equal(E.kit.openProjectFile(E.zipFiles(files)).engine, '99.0.0');
});

test('M13 변이: esc가 작은따옴표를 바꿈(작은따옴표 속성 안에서 깨지지 않게)', () => {
  assert.equal(esc(`it's "<b>"&`), 'it&#39;s &quot;&lt;b&gt;&quot;&amp;');
});

test('M13 변이: 암호 사이트는 PBKDF2 60만 회 이상으로 잠금(반복 수가 말없이 줄면 실패)', async () => {
  assert.ok(PROTECT_ITERATIONS >= 600000, `PROTECT_ITERATIONS ${PROTECT_ITERATIONS}`);
  const r = kitBuild();
  const out = await E.protectSite(r.files, '숲속바다햇살4821', { runtime: nodeRuntime(), title: 't', crypto: webcrypto });
  const payload = JSON.parse(/<script type="application\/json" id="lp-locked">([\s\S]*?)<\/script>/.exec(out['index.html'])[1]);
  assert.ok(payload.iter >= 600000, `잠근 쪽의 반복 수 ${payload.iter}`);
});

test('M10: 셸 없이 — 쪽 그림은 bash 없이 Node가 프로그램을 바로 부르고, npx는 npx-cli.js(윈도우는 cmd.exe에 인자를 막아)', async () => {
  assert.ok(!existsSync(join(SKILL, 'scripts', 'render_slides.sh')));
  for (const f of ['engine/src/ingest/cli.js', 'scripts/render-slides.mjs', 'scripts/publish.mjs', 'scripts/lecpage.mjs']) assert.doesNotMatch(readFileSync(join(SKILL, f), 'utf8'), /spawnSync\(\s*'(?:bash|sh)'|'npx\.cmd'/, f);
  const { npxCommand } = await import(pathToFileURL(join(SKILL, 'scripts', 'publish.mjs')).href);
  const here = npxCommand(['--version']);
  assert.ok(here.cmd === process.execPath && /npx-cli\.js$/.test(here.args[0]), JSON.stringify(here));
  const win = npxCommand(['--yes', 'wrangler@4.151.3', 'deploy', '--assets', 'C:\\Users\\선생님\\My Site & Co\\dist'], { platform: 'win32', execPath: 'C:\\nope\\node.exe', env: { ComSpec: 'C:\\Windows\\system32\\cmd.exe' }, exists: () => false });
  assert.equal(win.cmd, 'C:\\Windows\\system32\\cmd.exe'); assert.deepEqual(win.args.slice(0, 3), ['/d', '/s', '/c']); assert.equal(win.opts.windowsVerbatimArguments, true);
  assert.match(win.args[3], /\^&/, '& 같은 cmd 특수 글자를 막음');
  const off = npxCommand(['x'], { platform: 'win32', execPath: 'C:\\Program Files\\nodejs\\node.exe', env: {}, exists: (p) => p === 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npx-cli.js' });
  assert.deepEqual([off.cmd, off.args[0]], ['C:\\Program Files\\nodejs\\node.exe', 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npx-cli.js']);
});

test('M2: 오래 걸리는 prepare는 stderr에 진행 줄(요약·--json은 그대로)', () => {
  assert.match(readFileSync(join(SKILL, 'scripts', 'kit-cmds.mjs'), 'utf8'), /console\.error\(`… 쪽 그림/);
  const r = spawnSync(process.execPath, [CLI, 'prepare', join(FX, 'notes.md'), '-o', 'jwork', '--no-slides', '--json'], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...OFFLINE } });
  assert.equal(r.status, 0); assert.doesNotThrow(() => JSON.parse(r.stdout));
});

test('copy-lint 단독 실행: 작업 폴더면 보조 글자(material.md)에 있는 교재 원문(실습 단계·프롬프트)은 세지 않음', () => {
  const work = join(dir, 'lint'); mkdirSync(join(work, 'site'), { recursive: true });
  writeFileSync(join(work, 'site', 'index.html'), '<main><h1>실습</h1><ol><li>결과에서 사실과 다른 숫자가 없는지 확인합니다.</li></ol></main>');
  const lint = (args) => spawnSync(process.execPath, [join(SKILL, 'scripts', 'copy-lint.mjs'), ...args], { encoding: 'utf8' });
  assert.match(lint([work]).stdout, /합니다체/); // 보조 글자가 없으면 셈
  writeFileSync(join(work, 'material.md'), '## p-003\n결과에서 사실과 다른 숫자가 없는지 확인합니다.\n');
  assert.match(lint([work]).stdout, /고칠 곳이 없어요/);
});
