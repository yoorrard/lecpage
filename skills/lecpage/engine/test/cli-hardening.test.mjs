// skill CLI 다듬기 회귀 시험(2026-11 점검): 도움말은 실행하지 않음·모르는 옵션·값 빠진 옵션·실패 종료 코드·스택 없는 오류·
// 위쪽 package.json이 commonjs여도 동작·판 표시·강사만 정하는 값·담아 둔 라이브러리·셸 없는 실행, 그리고 변이 시험이 놓친 네 곳
// (작은따옴표 이스케이프, 암호 반복 수, 첫 화면 움직임 규칙, 두 자리 단계 번호).
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
import { ingestText } from '../src/ingest/index.js';
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

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'lecpage-hard-'));
  const r = run(['make', join(FX, 'notes.md'), '-o', 'dist', '--no-qa', '--today', '2026-11-09']);
  assert.equal(r.code, 0, r.out);
});
after(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

test('H1: 위쪽 폴더 package.json이 "type":"commonjs"여도(npm init -y) 모든 명령이 돎 — engine/package.json의 type:module', () => {
  const proj = mkdtempSync(join(tmpdir(), 'lecpage-cjs-'));
  try {
    writeFileSync(join(proj, 'package.json'), JSON.stringify({ name: 'proj', version: '1.0.0', type: 'commonjs' }));
    const sk = join(proj, '.claude', 'skills', 'lecpage');
    cpSync(SKILL, sk, { recursive: true, filter: (p) => !/[\\/]engine[\\/]test([\\/]|$)|[\\/]node_modules([\\/]|$)/.test(relative(SKILL, p) ? p : '') });
    const cli = join(sk, 'scripts', 'lecpage.mjs');
    for (const args of [['make', join(FX, 'notes.md'), '-o', 'dist', '--no-qa'], ['brief', 'work'], ['--version']]) {
      const r = run(args, { cwd: proj, cli });
      assert.equal(r.code, 0, `${args[0]}: ${r.out}`);
      assert.doesNotMatch(r.out, /SyntaxError|MODULE_TYPELESS|Unexpected token 'export'/);
    }
    assert.equal(JSON.parse(readFileSync(join(SKILL, 'engine', 'package.json'), 'utf8')).type, 'module');
  } finally { rmSync(proj, { recursive: true, force: true }); }
});

test('H2: <명령> --help는 그 명령 도움말만 보이고 아무것도 실행하지 않음(publish·pack·app·make·patch …)', () => {
  const log = join(dir, 'wrangler-help.log');
  const before = new Set(readdirSync(dir));
  for (const c of ['make', 'patch', 'publish', 'pack', 'app', 'options', 'serve', 'review', 'handouts', 'build', 'guard', 'decide-infra']) {
    for (const h of ['--help', '-h']) {
      const r = run([c, h], { env: { LECPAGE_WRANGLER: join(FX, 'fake-wrangler.mjs'), FAKE_WRANGLER_LOG: log } });
      assert.equal(r.code, 0, `${c} ${h}: ${r.out}`);
      assert.match(r.out, new RegExp(`(?:^|\\n)  (?:[^\\n]*· )?${c}(?: |$)`, 'm'), `${c} 줄이 없음:\n${r.out}`);
      assert.ok(r.out.split('\n').length < 14, `${c} 도움말이 그 명령만이 아님(${r.out.split('\n').length}줄)`);
    }
  }
  assert.ok(!existsSync(log), 'publish --help가 wrangler를 불렀음');
  assert.deepEqual(new Set(readdirSync(dir)), before, '도움말이 파일을 만들거나 지웠음');
  assert.equal(run(['help', 'patch']).code, 0);
  const all = run(['--help']);
  assert.equal(all.code, 0); assert.match(all.out, /종료 코드/);
});

test('M5: 모르는 옵션은 비슷한 이름과 함께 멈추고, 값 옵션에 값이 없으면 멈춤(암호 없이 만들지 않음)', () => {
  const t0 = run(['make', join(FX, 'notes.md'), '--freash', '--no-qa']);
  assert.equal(t0.code, 2); assert.match(t0.out, /--freash.*혹시 --fresh/);
  const t1 = run(['make', '--no-slide', join(FX, 'notes.md'), '--no-qa']);
  assert.equal(t1.code, 2); assert.match(t1.out, /혹시 --no-slides/);
  const pw = run(['make', join(FX, 'notes.md'), '-o', 'pwdist', '--no-qa', '--password']);
  assert.equal(pw.code, 2); assert.match(pw.out, /--password 뒤에 값이 없어요/);
  assert.ok(!existsSync(join(dir, 'pwdist')), '값 없는 --password로 사이트를 만들었음');
  const short = run(['make', join(FX, 'notes.md'), '-o', 'pwdist', '--no-qa', '--password', 'ab']);
  assert.equal(short.code, 2); assert.match(short.out, /4자 이상/);
  const port = run(['serve', 'dist', '--port', 'abc']);
  assert.equal(port.code, 2); assert.match(port.out, /--port는 숫자/);
  const other = run(['make', join(FX, 'notes.md'), '--mood', 'calm']);
  assert.equal(other.code, 2); assert.match(other.out, /options 명령의 옵션/);
  const typo = run(['mak', 'x.md']);
  assert.equal(typo.code, 2); assert.match(typo.out, /혹시 make/);
  for (const r of [t0, t1, pw, short, port, other, typo]) assert.doesNotMatch(r.out, STACK);
});

test('M11: SKILL.md 그대로 --set 경로=값 여러 개를 한 번에(--set a=1 b=2 c=3)', () => {
  const r = run(['patch', 'work/blueprint.json', '--set', 'concept.idea=손으로 해 보는 연수', 'concept.motif=톱니', 'concept.why=교재가 실습 위주라', '--no-build']);
  assert.equal(r.code, 0, r.out);
  const bp = JSON.parse(readFileSync(join(dir, 'work/blueprint.json'), 'utf8'));
  assert.equal(bp.concept.idea, '손으로 해 보는 연수'); assert.equal(bp.concept.motif, '톱니'); assert.equal(bp.concept.why, '교재가 실습 위주라');
  run(['patch', 'work/blueprint.json', '--undo', '--no-build']);
});

test('M4: 오류는 스택 없이 한국어 한 줄 + 다음 할 일(인자 없음·없는 파일·건너뛴 번호·파일 자리의 -o·없는 폴더)', () => {
  const cases = [
    [['guard'], 2, /AI 답 파일과 교재 해석/],
    [['guard', '없는답.txt', 'work/material.json'], 1, /파일이나 폴더가 없어요/],
    [['validate'], 2, /설계도 파일을 주세요/],
    [['design'], 2, /설계도 파일을 주세요/],
    [['draft'], 2, /교재 해석 파일을 주세요/],
    [['patch', 'work/blueprint.json', '--set', 'sections.prompts.items.9.title=x', '--no-build'], 1, /번호는 0~|있어요/],
    [['make', join(FX, 'notes.md'), '-o', join(FX, 'notes.md'), '--no-qa'], 1, /파일이에요/],
    [['make', join(FX, 'notes.md'), '-o', join(FX, 'notes.md', 'dist'), '--no-qa'], 1, /폴더가 들어갈 자리에 파일/],
    [['review', '없는폴더', '--port', '5941'], 1, /index.html이 없어요/],
    [['serve', '없는폴더', '--port', '5942'], 1, /사이트가 없어요/],
  ];
  for (const [args, code, re] of cases) {
    const r = run(args);
    assert.equal(r.code, code, `${args.join(' ')}: ${r.out}`);
    assert.match(r.out, re, args.join(' '));
    assert.doesNotMatch(r.out, STACK, args.join(' '));
  }
  const pk = run(['pack', 'dist', '-o', 'new-folder/site.zip']);
  assert.equal(pk.code, 0, pk.out); assert.ok(existsSync(join(dir, 'new-folder/site.zip')));
});

test('M6: 실패면 0이 아닌 종료 코드(없는 폴더 pack·열리지 않는 주소 handouts·받지 못한 주소 교재)', () => {
  const p = run(['pack', '없는폴더']);
  assert.equal(p.code, 1); assert.match(p.out, /사이트가 없어요/); assert.ok(!existsSync(join(dir, 'site.zip')));
  const h = run(['handouts', 'http://127.0.0.1:5943/']);
  assert.equal(h.code, 1); assert.match(h.out, /주소가 열리지 않아요/); assert.doesNotMatch(h.out, STACK);
  const u = run(['make', 'http://127.0.0.1:5944/x.md', '-o', 'udist', '--no-qa']);
  assert.equal(u.code, 1); assert.match(u.out, /교재 주소를 받지 못했어요/); assert.ok(!existsSync(join(dir, 'udist')));
});

test('M7: validate가 null·글자 항목에서 멈추지 않고 빼며 주의로 알림', () => {
  const ex = JSON.parse(readFileSync(join(FX, 'body-all.blueprint.json'), 'utf8'));
  for (const s of ex.sections) for (const k of Object.keys(s)) if (Array.isArray(s[k])) {
    const bp = structuredClone(ex); bp.sections.find((x) => x.type === s.type)[k] = [null, 0, 'x', [null]];
    assert.doesNotThrow(() => E.validate(bp), `${s.type}.${k}`);
    assert.doesNotThrow(() => E.build(bp, { runtime: nodeRuntime() }), `build ${s.type}.${k}`);
  }
  const bp = structuredClone(ex); bp.instructors = [null, { name: '김하늘' }]; bp.sections.find((x) => x.type === 'faq').items.push(null);
  const v = E.validate(bp);
  assert.equal(v.blueprint.instructors.length, 1);
  assert.ok(v.warnings.some((w) => /빈 항목 1개/.test(w.message_ko)), JSON.stringify(v.warnings.map((w) => w.message_ko)));
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
  const made = run(['make', f, '-o', 'zdist', '--no-qa']);
  assert.equal(made.code, 1); assert.match(made.out, /손상|열 수 없어요/);
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
  assert.equal(P.unpackProject(files).engine, '99.0.0');
});

test('H6: CLI guard도 앱과 같은 applyInfo — AI 답의 참여 서버·연수 코드·공개 범위·QR 주소·로고·설문 주소는 받지 않음', () => {
  const draft = JSON.parse(readFileSync(join(dir, 'work/draft.json'), 'utf8'));
  const evil = structuredClone(draft);
  evil.live = { provider: 'http', url: 'https://collect.evil-example.net/api', code: 'HACK0001', anonKey: 'k', features: ['qa'] };
  evil.meta = { ...evil.meta, siteUrl: 'https://phish.evil-example.net/', joinUrl: 'https://phish.evil-example.net/j', shortUrl: 'https://phish.evil-example.net/s' };
  evil.access = { mode: 'public' };
  evil.design = { ...(evil.design || {}), logo: 'https://cdn.evil-example.net/logo.png' };
  evil.sections.push({ type: 'survey', url: 'https://phish.evil-example.net/survey', questions: [] });
  writeFileSync(join(dir, 'evil.json'), JSON.stringify(evil));
  writeFileSync(join(dir, 'info-g.json'), JSON.stringify({ surveyUrl: 'https://forms.gle/teacher', access: 'link' }));
  const r = run(['guard', 'evil.json', 'work/material.json', '-i', 'info-g.json', '-o', 'guarded.json']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /강사만 정하는 값은 AI 답에서 받지 않았어요: .*참여 기능 서버.*공개 범위.*로고.*설문 주소/);
  const g = JSON.parse(readFileSync(join(dir, 'guarded.json'), 'utf8'));
  assert.equal(g.live.url, ''); assert.notEqual(g.live.code, 'HACK0001'); assert.equal(g.access.mode, 'link');
  for (const k of ['siteUrl', 'joinUrl', 'shortUrl']) assert.ok(!g.meta[k], k);
  assert.ok(!g.design.logo);
  assert.deepEqual(g.sections.filter((s) => s.type === 'survey').map((s) => s.url), ['https://forms.gle/teacher']);
  assert.doesNotMatch(JSON.stringify(g), /evil-example/);
  // 공용 규칙: 강사가 정한 로고·설문 주소(prev·info)는 지킴, 사이트 안 그림 경로도 지킴
  const bp = { design: { logo: 'assets/media/logo.png' }, sections: [{ type: 'survey', url: 'https://forms.gle/old' }] };
  assert.deepEqual(E.keepTeacherLinks(bp, {}, { sections: [{ type: 'survey', url: 'https://forms.gle/old' }] }), []);
  assert.deepEqual(E.keepTeacherLinks({ design: { logo: 'https://x.example/l.png' }, sections: [] }, { logo: 'https://x.example/l.png' }), []);
});

test('M13 변이: esc가 작은따옴표를 바꿈(작은따옴표 속성 안에서 깨지지 않게)', () => {
  assert.equal(esc(`it's "<b>"&`), 'it&#39;s &quot;&lt;b&gt;&quot;&amp;');
});

test('M13 변이: 암호 사이트는 PBKDF2 60만 회 이상으로 잠금(반복 수가 말없이 줄면 실패)', async () => {
  assert.ok(PROTECT_ITERATIONS >= 600000, `PROTECT_ITERATIONS ${PROTECT_ITERATIONS}`);
  const r = E.build(JSON.parse(readFileSync(join(SKILL, 'examples', 'data-lab.blueprint.json'), 'utf8')), { runtime: nodeRuntime() });
  const out = await E.protectSite(r.files, '숲속바다햇살4821', { runtime: nodeRuntime(), title: 't', crypto: webcrypto });
  const payload = JSON.parse(/<script type="application\/json" id="lp-locked">([\s\S]*?)<\/script>/.exec(out['index.html'])[1]);
  assert.ok(payload.iter >= 600000, `잠근 쪽의 반복 수 ${payload.iter}`);
});

test('M13 변이: 실습 단계 번호가 두 자리(10. 11. 12.)여도 모두 읽음', async () => {
  const steps = ['구글 계정으로 로그인합니다.', '새 문서를 엽니다.', '제목을 적습니다.', '표를 넣습니다.', '첫 줄에 날짜를 적습니다.', '둘째 줄에 할 일을 적습니다.', '셋째 줄에 담당자를 적습니다.', '글꼴 크기를 12로 바꿉니다.', '공유 버튼을 누릅니다.', '모둠원에게 보기 권한을 줍니다.', '링크를 복사해 게시판에 올립니다.', '친구 문서에 댓글을 하나 남깁니다.'];
  const m = ingestText(`# 문서 협업 실습\n\n## 실습 1. 공유 문서 만들기\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n## 실습 2. 댓글 달기\n1. 댓글을 엽니다.\n2. 의견을 적습니다.\n`, 'steps.md');
  const got = (await m).detected.steps.map((s) => s.items.length);
  assert.equal(got[0], 12, JSON.stringify(got));
});

test('M13 변이·M8: 첫 화면 판정은 시각이 아니라 사건으로(judgeHero) — 사건이 없으면 hero-no-motion, 도는 효과가 멈추면 hero-still', async () => {
  const { judgeHero } = await import(pathToFileURL(join(SKILL, 'scripts', 'motion-check.mjs')).href);
  const loopFx = [{ id: 'starfield', st: 'on', hero: true, inView: true }];
  const none = judgeHero({ ev: [], late: {}, fx: [], motion: '2' });
  assert.deepEqual(none.findings.map((f) => f.rule), ['hero-no-motion']);
  // 등장 사건이 언제 있었든(측정이 늦어도) 정상. 동작 줄이기용 0.01ms 애니메이션은 움직임으로 치지 않음
  assert.deepEqual(judgeHero({ ev: [['transitionrun', 5200, 'opacity', 600]], late: {}, fx: [], motion: '2' }).findings, []);
  assert.equal(judgeHero({ ev: [['animationstart', 30, 'in', 0]], late: {}, fx: [], motion: '2' }).findings[0]?.rule, 'hero-no-motion');
  assert.deepEqual(judgeHero({ ev: [], late: {}, fx: [{ id: 'split-reveal', st: 'shown', hero: true }], motion: '1' }).findings, [], '먼저 그려진 제목(shownTitle)은 문제 아님');
  assert.deepEqual(judgeHero({ ev: [], late: {}, fx: [], motion: '0' }).findings, []);
  assert.deepEqual(judgeHero({ ev: [], late: {}, fx: [], motion: '2', rm: true }).findings, []);
  // 도는 효과: 등장 뒤에도 그리기·바뀜·도는 CSS가 있으면 loop, 없으면 hero-still
  assert.equal(judgeHero({ ev: [['animationstart', 10, 'a', 300]], late: { draws: 90 }, fx: loopFx, motion: '2' }).kind, 'loop');
  assert.deepEqual(judgeHero({ ev: [['animationstart', 10, 'a', 300]], late: { draws: 0 }, fx: loopFx, motion: '2' }).findings.map((f) => f.rule), ['hero-still']);
  assert.equal(judgeHero({ ev: [], late: { infinite: 1 }, fx: loopFx, motion: '2' }).findings.length, 0);
  // 같은 기록이면 같은 판정(문구에 측정값을 넣지 않아 실행마다 같음)
  const a = judgeHero({ ev: [], late: { draws: 1 }, fx: loopFx, motion: '2' }), b = judgeHero({ ev: [], late: { draws: 2 }, fx: loopFx, motion: '2' });
  assert.deepEqual(a.findings, b.findings);
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

test('M2: 오래 걸리는 make는 stderr에 진행 줄(요약·--json은 그대로)', () => {
  const src = readFileSync(CLI, 'utf8');
  assert.match(src, /console\.error\(`… \$\{msg\}/);
  const r = spawnSync(process.execPath, [CLI, 'make', join(FX, 'notes.md'), '-o', 'jdist', '--no-qa', '--json'], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...OFFLINE } });
  assert.equal(r.status, 0); assert.doesNotThrow(() => JSON.parse(r.stdout));
});

test('copy-lint 단독 실행: 설계도 옆 material.json이 있으면 교재 원문(실습 단계·프롬프트)은 세지 않음', () => {
  const work = join(dir, 'lint'); mkdirSync(work, { recursive: true });
  const material = { kind: 'lecpage-material', pages: [{ page: 1, title: '', paragraphs: [{ text: '결과에서 사실과 다른 숫자가 없는지 확인합니다.' }], tables: [], notes: '' }] };
  const bp = { meta: { title: '연수' }, sections: [{ type: 'stations', items: [{ title: '실습', steps: ['결과에서 사실과 다른 숫자가 없는지 확인합니다.'] }] }] };
  writeFileSync(join(work, 'blueprint.json'), JSON.stringify(bp));
  const lint = (args) => spawnSync(process.execPath, [join(SKILL, 'scripts', 'copy-lint.mjs'), ...args], { encoding: 'utf8' });
  assert.match(lint([join(work, 'blueprint.json')]).stdout, /합니다체/); // 교재 해석이 없으면 셈
  writeFileSync(join(work, 'material.json'), JSON.stringify(material));
  assert.match(lint([join(work, 'blueprint.json')]).stdout, /고칠 곳이 없어요/);
});

test('make: 교재 알림(링크만·읽지 못한 파일)을 요약에 한 줄씩, 함께 준 사진은 사진 칸 패치로, 사진만이면 CLI 길로 안내', () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63f8cf00000301010018dd8db40000000049454e44ae426082', 'hex');
  writeFileSync(join(dir, '단체사진.png'), png);
  const only = run(['make', '단체사진.png', '-o', 'pdist', '--no-qa']);
  assert.equal(only.code, 1); assert.match(only.out, /교재.*와 함께 주면 사진은 사이트 사진 칸으로/); assert.doesNotMatch(only.out, /자료실에 올려/);
  const mixed = run(['make', join(FX, 'notes.md'), '단체사진.png', '-o', 'pdist2/dist', '--no-qa']);
  assert.equal(mixed.code, 0, mixed.out);
  assert.match(mixed.out, /사진 1장은 교재로 읽지 않았어요 → 사진 칸으로 넣으려면 patch .*photos\.patch\.json/);
  assert.ok(existsSync(join(dir, 'pdist2/work/assets/media/단체사진.png')));
  const pa = run(['patch', 'pdist2/work/blueprint.json', 'pdist2/work/photos.patch.json']);
  assert.equal(pa.code, 0, pa.out); assert.match(pa.out, /섹션 추가/);
  assert.match(readFileSync(join(dir, 'pdist2/dist/index.html'), 'utf8'), /assets\/media\/단체사진\.png/);
  const link = run(['make', 'https://padlet.com/example/board', '-o', 'ldist/dist', '--no-qa']);
  assert.equal(link.code, 0, link.out); assert.match(link.out, /\n  알림 .*링크만으로는 내용을 읽을 수 없어요/);
});

test('빈칸 강사: 학생 수업은 선생님, 설명회는 발표자(있으면) — 엔진 wordsFor', () => {
  const mk = (kind, title) => { const p = join(dir, `who-${kind}.json`); writeFileSync(p, JSON.stringify({ meta: { title, admin: { kind } }, sections: [{ type: 'text', md: '안내' }] })); return run(['brief', p]).out; };
  assert.match(mk('student', '3학년 과학 수업'), /빈칸 .*선생님\(instructors\)/);
  assert.match(mk('conference', '학부모 설명회'), /빈칸 .*발표자\(instructors, 있으면\)/);
  assert.match(mk('school', '교원 연수'), /빈칸 .*강사\(instructors\)/);
});

test('L11: patch --set이 검증에서 버려질 값(날짜·색 모양이 틀림)은 바뀜으로 저장하지 않고 고칠 모양을 알려 줌', () => {
  const before = readFileSync(join(dir, 'work/blueprint.json'), 'utf8');
  const d = run(['patch', 'work/blueprint.json', '--set', 'meta.date=내일', '--no-build']);
  assert.equal(d.code, 1); assert.match(d.out, /YYYY-MM-DD/);
  const c = run(['patch', 'work/blueprint.json', '--set', 'design.accent=빨강', '--no-build']);
  assert.equal(c.code, 1); assert.match(c.out, /#RRGGBB/);
  assert.equal(readFileSync(join(dir, 'work/blueprint.json'), 'utf8'), before);
});
