// Skill CLI: 강사 값 access: "password"(공개 범위 암호)인 작업 폴더에서 check·pack이 문서대로 도는지,
// serve --live가 참여 기능 서버를 실제로 잇는지, prepare가 알리는 쪽 수가 놓인 쪽 그림과 어긋나지 않는지.
// 실제 계정·네트워크에 닿지 않습니다. PDF 교재를 쓰지 않아 pdfjs-dist가 없어도 돕니다.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', '..', 'scripts', 'lecpage.mjs');
const FX = join(HERE, 'fixtures');
const T = mkdtempSync(join(tmpdir(), 'lp-access-'));
after(() => rmSync(T, { recursive: true, force: true }));
const OFFLINE = { HTTPS_PROXY: '', https_proxy: '', HTTP_PROXY: '', http_proxy: '' };
const PW = 'correct horse battery staple 2026';
const PAGE = (body) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>시험 연수</title><link rel="stylesheet" href="assets/style.css"></head><body><main><h1>시험 연수</h1>${body}</main></body></html>`;
const locked = (file) => existsSync(file) && /id="lp-locked"/.test(readFileSync(file, 'utf8'));

/** 에이전트가 쓴 작업 폴더(사이트 한 쪽 + 연수 정보). teacher: lecpage.teacher.json에 적을 강사 값 */
function setup(teacher) {
  const dir = mkdtempSync(join(T, 'w-'));
  const work = join(dir, 'work');
  mkdirSync(join(work, 'site', 'assets'), { recursive: true });
  writeFileSync(join(work, 'site', 'index.html'), PAGE('<section id="q"><h2>질문</h2><div data-lp="qa"></div></section>'));
  writeFileSync(join(work, 'site', 'assets', 'style.css'), ':root{--lp-accent:#1e4e79;--lp-ink:#16212c;--lp-paper:#ffffff}body{font-family:sans-serif;color:var(--lp-ink);background:var(--lp-paper)}');
  writeFileSync(join(work, 'lecpage.json'), JSON.stringify({ v: 2, title: '시험 연수', sessions: [{ date: '2026-12-03', start: '14:00', end: '17:00' }], features: ['qa'] }));
  const teach = (v) => writeFileSync(join(work, 'lecpage.teacher.json'), JSON.stringify(v));
  if (teacher) teach(teacher);
  const run = (args, env = {}) => { const r = spawnSync(process.execPath, [CLI, ...args], { cwd: dir, encoding: 'utf8', timeout: 180000, env: { ...process.env, ...OFFLINE, LECPAGE_PASSWORD: '', ...env } }); return { code: r.status, out: `${r.stdout}${r.stderr}` }; };
  return { dir, work, run, teach };
}

test('check: 공개 범위가 암호여도 암호 없이 살펴봄 — 잠그기 전 사이트는 검수용 폴더에만, 올릴 work/dist에는 두지 않음', () => {
  const { work, run } = setup({ access: 'password' });
  const r = run(['check', 'work', '--no-shots']);
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /예상하지 못한 오류/);
  assert.match(r.out, /조립 work\/\.lecpage\/check-site: 쪽 1/, '조립한 곳을 빈칸으로 두지 않음');
  assert.match(r.out, /공개 범위 암호.*pack·publish에 --password\(또는 LECPAGE_PASSWORD\)/);
  assert.ok(existsSync(join(work, '.lecpage', 'check-site', 'index.html')) && !locked(join(work, '.lecpage', 'check-site', 'index.html')));
  assert.ok(!existsSync(join(work, 'dist', 'index.html')), '잠그지 않은 사이트를 올리는 폴더에 쓰지 않음');
  assert.ok(existsSync(join(work, 'check', 'issues.md')) && existsSync(join(work, 'dist-강사용', '운영안내.md')));
  const j = JSON.parse(run(['check', 'work', '--no-shots', '--json']).out.trim().split('\n').pop());
  assert.equal(j.ok, true); assert.equal(j.needsPassword, true); assert.match(j.dist, /check-site$/);
});

test('check: 화면 그림까지(브라우저가 있으면) 암호 없이 끝까지 돎', () => {
  const { work, run } = setup({ access: 'password' });
  const r = run(['check', 'work', '--no-tiles']);
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /예상하지 못한 오류|must be of type string/);
  if (!/화면 검수·그림을 건너뛰었어요|화면 검수를 건너뛰었어요/.test(r.out)) assert.ok(existsSync(join(work, 'check', 'index-390.png')), r.out);
});

test('pack: 암호가 없으면 멈추고(종료 코드 1), --password·LECPAGE_PASSWORD면 잠가서 work/dist에 — 그 뒤 check는 잠근 dist를 그대로 둠', () => {
  const { dir, work, run } = setup({ access: 'password' });
  const no = run(['pack', 'work', '-o', 'site.zip']);
  assert.equal(no.code, 1, no.out);
  assert.match(no.out, /공개 범위가 암호.*--password 값이나 LECPAGE_PASSWORD/);
  assert.ok(!existsSync(join(dir, 'site.zip')));
  const yes = run(['pack', 'work', '-o', 'site.zip', '--password', PW]);
  assert.equal(yes.code, 0, yes.out);
  assert.match(yes.out, /암호로 잠금: 쪽 \d+개/);
  assert.ok(locked(join(work, 'dist', 'index.html')));
  assert.equal(run(['pack', 'work', '-o', 'env.zip'], { LECPAGE_PASSWORD: PW }).code, 0);
  const c = run(['check', 'work', '--no-shots']);
  assert.equal(c.code, 0, c.out);
  assert.doesNotMatch(c.out, /비웠어요/);
  assert.ok(locked(join(work, 'dist', 'index.html')), '잠근 dist는 check가 건드리지 않음');
});

test('check: 암호를 정하기 전에 조립해 둔 잠그지 않은 work/dist는 공개 범위가 암호가 되면 비움', () => {
  const { work, run, teach } = setup(null);
  assert.equal(run(['check', 'work', '--no-shots']).code, 0);
  assert.ok(existsSync(join(work, 'dist', 'index.html')) && !locked(join(work, 'dist', 'index.html')), '공개 범위가 링크면 지금처럼 work/dist에 조립');
  teach({ access: 'password' });
  const r = run(['check', 'work', '--no-shots']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /잠그지 않은 예전 work\/dist는 비웠어요/);
  assert.ok(!existsSync(join(work, 'dist', 'index.html')));
});

test('serve --live: 교실용 사이트는 참여 기능 서버를 같은 주소로 잇고(연습 모드가 아님), 올리는 work/dist는 그대로', async () => {
  const { dir, work, run } = setup(null);
  assert.equal(run(['check', 'work', '--no-shots']).code, 0);
  const port = await new Promise((ok) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
  const child = spawn(process.execPath, [CLI, 'serve', 'work', '--live', '--port', String(port), '--host', '127.0.0.1'], { cwd: dir, env: { ...process.env, ...OFFLINE }, stdio: 'ignore' });
  const site = join(work, '.lecpage', 'live-site', 'index.html');
  try {
    for (let i = 0; i < 150 && !existsSync(site); i++) await new Promise((ok) => setTimeout(ok, 100));
    assert.ok(existsSync(site), 'serve --live가 교실용 사이트를 조립함');
    const liveOf = (file) => JSON.parse((/"live":(\{[^}]*\})/.exec(readFileSync(file, 'utf8')) || [])[1] || '{}');
    assert.equal(liveOf(site).provider, 'http');
    assert.equal(liveOf(site).url, '');
    assert.equal(liveOf(join(work, 'dist', 'index.html')).provider, 'local', '올리는 dist는 강사 값 그대로(연결 전이면 연습 모드)');
  } finally { child.kill('SIGINT'); await new Promise((ok) => { child.on('exit', ok); setTimeout(ok, 5000); }); }
});

// ── prepare가 알리는 쪽 수 ─────────────────────────────────────
const WEBP = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
const pad3 = (n) => String(n).padStart(3, '0');
/** 이 PC의 프로그램(LibreOffice 등)에 기대지 않게: 쪽 그림은 미리 놓아 두거나(given) --no-slides */
function prepare(files, { given = 0, sets = null, flags = [] } = {}) {
  const work = mkdtempSync(join(T, 'p-'));
  if (given) { mkdirSync(join(work, 'site', 'material'), { recursive: true }); for (let i = 1; i <= given; i++) writeFileSync(join(work, 'site', 'material', `p-${pad3(i)}.webp`), WEBP); }
  const base = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^lecpage_/i.test(k)));
  const env = { ...base, ...OFFLINE, ...(given ? { LECPAGE_GIVEN_IMAGES: '1', ...(sets ? { LECPAGE_GIVEN_IMAGES_SETS: JSON.stringify(sets) } : {}) } : {}) };
  const one = (more) => spawnSync(process.execPath, [CLI, 'prepare', ...files.map((n) => join(FX, n)), '-o', work, '--no-python', ...flags, ...more], { encoding: 'utf8', timeout: 180000, env });
  const text = one([]); const json = one(['--json']);
  return { code: text.status, line: String(text.stdout).split('\n')[0], out: `${text.stdout}${text.stderr}`, j: JSON.parse(String(json.stdout).trim().split('\n').pop()) };
}

test('prepare: 슬라이드 13쪽 + 워드(5개 부분, 쪽 그림 1장)는 "교재 14쪽" 한 번 — 워드의 부분을 쪽으로 세지 않음', () => {
  const p = prepare(['workshop.pptx', 'guide.docx'], { given: 14, sets: [{ name: 'workshop.pptx', first: 1, count: 13 }, { name: 'guide.docx', first: 14, count: 1 }] });
  assert.equal(p.code, 0, p.out);
  assert.match(p.line, /^준비 .*: 교재 14쪽\(쪽 그림 site\/material\/p-001~p-014\)/, p.line);
  assert.doesNotMatch(p.line, /18쪽|쪽 그림 \d+장/, '쪽 수와 쪽 그림 수를 따로 적어 어긋나게 하지 않음');
  // 기계용 JSON은 그대로(커넥트가 읽음): 교재마다 읽은 단위 수와 쪽 그림 수
  assert.deepEqual(p.j.files.map((f) => [f.name, f.unit, f.pages, f.images]), [['workshop.pptx', 'slide', 13, 13], ['guide.docx', 'section', 5, 1]]);
  assert.equal(p.j.images, 14);
});

test('prepare: 쪽 그림이 없는 워드는 쪽 수가 아니라 "글로 읽은 교재 … N개 부분", 쪽 그림이 없는 슬라이드는 쪽 수와 0장을 함께', () => {
  const d = prepare(['guide.docx'], { flags: ['--no-slides'] });
  assert.equal(d.code, 0, d.out);
  assert.match(d.line, /^준비 .*: 글로 읽은 교재 guide\.docx 5개 부분\(쪽 그림 없음\)/, d.line);
  assert.doesNotMatch(d.line, /교재 \d+쪽/);
  const s = prepare(['workshop.pptx'], { flags: ['--no-slides'] });
  assert.match(s.line, /^준비 .*: 교재 13쪽 · 쪽 그림 0장\(site\/material\/\)/, s.line);
  const both = prepare(['workshop.pptx', 'guide.docx'], { given: 13, sets: [{ name: 'workshop.pptx', first: 1, count: 13 }] });
  assert.match(both.line, /^준비 .*: 교재 13쪽\(쪽 그림 site\/material\/p-001~p-013\) · 글로 읽은 교재 guide\.docx 5개 부분\(쪽 그림 없음\)/, both.line);
});
