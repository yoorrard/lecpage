// Skill 새 흐름(사이트 폴더 작업): prepare → 에이전트가 쓴 work/site + lecpage.json → app·pack·publish·handouts가 조립 결과로 동작.
// 실제 계정·네트워크에 닿지 않습니다(가짜 wrangler).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = join(HERE, '..', '..');
const CLI = join(SKILL, 'scripts', 'lecpage.mjs');
const FX = join(HERE, 'fixtures');
const OFFLINE = { HTTPS_PROXY: '', https_proxy: '', HTTP_PROXY: '', http_proxy: '' };
const PAGE = (body) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>시험 연수</title><link rel="stylesheet" href="assets/style.css"></head><body><main><h1>시험 연수</h1>${body}</main><footer><a href="assets/event.ics">달력에 넣기</a></footer></body></html>`;

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'lp-skillv2-'));
  const run = (args, env = {}) => { const r = spawnSync(process.execPath, [CLI, ...args], { cwd: dir, encoding: 'utf8', timeout: 120000, env: { ...process.env, ...OFFLINE, LECPAGE_WRANGLER: join(FX, 'fake-wrangler.mjs'), FAKE_WRANGLER_LOG: join(dir, 'wrangler.log'), CLOUDFLARE_API_TOKEN: '', ...env } }); return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }; };
  const p = run(['prepare', join(FX, 'workshop.pdf'), '-o', 'work', '--no-slides']);
  assert.equal(p.code, 0, p.out);
  mkdirSync(join(dir, 'work/site/assets'), { recursive: true });
  writeFileSync(join(dir, 'work/site/index.html'), PAGE('<section id="q"><h2>질문</h2><div data-lp="qa"></div></section><section data-lp-step="s1" data-title="1단계: 열기"><h2>1단계: 열기</h2><p>열어요.</p><button type="button" data-copy-text="이 영상을 한국어로 요약해줘">복사</button></section>'));
  writeFileSync(join(dir, 'work/site/assets/style.css'), ':root{--lp-accent:#1e4e79;--lp-ink:#16212c;--lp-paper:#ffffff}body{font-family:sans-serif;color:var(--lp-ink);background:var(--lp-paper)}');
  writeFileSync(join(dir, 'work/lecpage.json'), JSON.stringify({ v: 2, title: '시험 연수', sessions: [{ date: '2026-12-03', start: '14:00', end: '17:00' }], features: ['qa', 'help'], siteUrl: 'https://evil.example.com/' }));
  return { dir, run };
}

test('새 흐름 check: 조립 결과 work/dist, 강사용 운영안내는 work/dist-강사용, 일정 파일 링크는 깨진 링크가 아님, 교재 원문 글은 문구 점검에서 뺌', () => {
  const { dir, run } = setup();
  try {
    const r = run(['check', 'work', '--no-shots', '--json']);
    const j = JSON.parse(r.out.trim().split('\n').pop());
    assert.equal(r.code, 0, r.out);
    assert.ok(!j.issues.some((x) => x.id === 'broken-link'), JSON.stringify(j.issues));
    assert.ok(existsSync(join(dir, 'work/dist/index.html')) && existsSync(join(dir, 'work/dist/console.html')));
    assert.ok(existsSync(join(dir, 'work/dist-강사용/운영안내.md')));
    assert.ok(!existsSync(join(dir, 'work/dist/운영안내.md')));
    // 강사 값은 lecpage.json에 써도 쓰지 않음
    assert.ok(!readFileSync(join(dir, 'work/dist/index.html'), 'utf8').includes('evil.example.com'));
    // 다시 조립해도 배포 설정 파일(GitHub Pages·Vercel)은 남김
    writeFileSync(join(dir, 'work/dist/CNAME'), 'lec.example.kr'); writeFileSync(join(dir, 'work/dist/vercel.json'), '{}'); mkdirSync(join(dir, 'work/dist/.git'), { recursive: true });
    assert.equal(run(['check', 'work', '--no-shots']).code, 0);
    for (const f of ['CNAME', 'vercel.json', '.git']) assert.ok(existsSync(join(dir, 'work/dist', f)), f);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('새 흐름 app: work → .lecpage v2(사이트·쪽 제목·원본, 참여 기능 키 없음) → 다른 폴더로 풀면 사이트 그대로, 파일 속 강사 값은 따로', () => {
  const { dir, run } = setup();
  try {
    writeFileSync(join(dir, 'work/lecpage.teacher.json'), JSON.stringify({ access: 'link', live: { provider: 'supabase', url: 'https://abcd.supabase.co', anonKey: 'secret-anon-key-123', code: 'AB12CD' } }));
    const a = run(['app', 'work', '-o', 'out.lecpage']);
    assert.equal(a.code, 0, a.out);
    const zip = readFileSync(join(dir, 'out.lecpage'));
    assert.ok(!zip.includes(Buffer.from('secret-anon-key-123')), '참여 기능 키를 담지 않음');
    assert.ok(zip.includes(Buffer.from('"version": 2')));
    const u = run(['app', 'out.lecpage', '-o', 'work2']);
    assert.equal(u.code, 0, u.out);
    assert.equal(readFileSync(join(dir, 'work2/site/index.html'), 'utf8'), readFileSync(join(dir, 'work/site/index.html'), 'utf8'));
    assert.equal(JSON.parse(readFileSync(join(dir, 'work2/lecpage.json'), 'utf8')).title, '시험 연수');
    assert.ok(!existsSync(join(dir, 'work2/lecpage.teacher.json')), '파일 속 강사 값을 그대로 쓰지 않음');
    assert.match(JSON.parse(readFileSync(join(dir, 'work2/lecpage.teacher.from-file.json'), 'utf8')).live.url, /^https:\/\/abcd\.supabase\.co\/?$/);
    assert.ok(existsSync(join(dir, 'work2/src/workshop.pdf')), '교재 원본');
    assert.equal(run(['app', 'out.lecpage', '-o', 'work2']).code, 1, '이미 있으면 --force 없이 덮지 않음');
    assert.equal(run(['check', 'work2', '--no-shots']).code, 0);
    // pack: 작업 폴더를 주면 조립해서 ZIP
    const p = run(['pack', 'work', '-o', 'site.zip']);
    assert.equal(p.code, 0, p.out);
    assert.ok(readFileSync(join(dir, 'site.zip')).includes(Buffer.from('console.html')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('새 흐름 publish: 연습 모드 알림 → --live면 중계 → lecpage.teacher.json에 주소·코드 → 다시 조립 → 올림, --features는 없는 옵션(암호는 kit-fixes 시험)', () => {
  const { dir, run } = setup();
  try {
    const dry = run(['publish', 'work', '--dry-run']);
    assert.equal(dry.code, 0, dry.out);
    assert.match(dry.out, /연습 모드라 배포한 사이트에서는 기록이 모이지 않아요/);
    assert.match(dry.out, /--assets work\/dist/);
    assert.match(run(['publish', 'work', '--dry-run', '--password', '봄비연필운동장']).out, /암호로 잠그기/);
    assert.equal(run(['publish', 'work', '--features', 'qa,poll']).code, 2, '--features는 없는 옵션(참여 기능은 lecpage.json features와 자리 표시로)');
    const r = run(['publish', 'work', '--live', '--name', 'lec-v2', '--no-verify', '--no-handouts', '--no-bundle-fonts']);
    assert.equal(r.code, 0, r.out);
    const t = JSON.parse(readFileSync(join(dir, 'work/lecpage.teacher.json'), 'utf8'));
    assert.equal(t.live.provider, 'http');
    assert.equal(t.live.url, 'https://lec-v2-live.fake-account.workers.dev');
    assert.match(t.live.code, /^[A-Z0-9]{4,12}$/);
    assert.ok(readFileSync(join(dir, 'work/dist/index.html'), 'utf8').includes('lec-v2-live.fake-account.workers.dev'), '사이트가 중계 주소로 다시 조립됨');
    assert.ok(existsSync(join(dir, 'work/dist-강사용/관리자-키.txt')));
    assert.ok(!existsSync(join(dir, 'work/dist/관리자-키.txt')));
    const log = readFileSync(join(dir, 'wrangler.log'), 'utf8');
    assert.match(log, new RegExp(`deploy --assets ${join(dir, 'work/dist').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} --name lec-v2`));
    assert.match(log, /ALLOWED_ORIGINS:https:\/\/lec-v2\.fake-account\.workers\.dev/);
    assert.doesNotMatch(r.out, /연습 모드/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('prepare: PPTX와 같은 내용의 PDF를 함께 주면 쪽을 두 번 세지 않고, 교재 목록에 원본 경로를 적음', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lp-skillv2p-'));
  try {
    const r = spawnSync(process.execPath, [CLI, 'prepare', join(FX, 'workshop.pptx'), join(FX, 'workshop.pdf'), '-o', join(dir, 'work'), '--no-slides', '--json'], { encoding: 'utf8', env: { ...process.env, ...OFFLINE } });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.equal(JSON.parse(r.stdout.trim().split('\n').pop()).pages, 13);
    const md = readFileSync(join(dir, 'work/material.md'), 'utf8'); // PPTX(발표자 노트)는 보조 글자를 둠. 같은 내용의 PDF는 쪽 그림용이라 세지 않음
    assert.equal((md.match(/^## p-/gm) || []).length, 13);
    assert.ok(!/workshop\.pdf/.test(md.split('\n').filter((l) => l.startsWith('## p-')).join('\n')), 'PDF 쪽은 보조 글자에 없음');
    const src = JSON.parse(readFileSync(join(dir, 'work/.lecpage/sources.json'), 'utf8'));
    assert.deepEqual(src.map((s) => s.name), ['workshop.pptx', 'workshop.pdf']);
    assert.ok(src.every((s) => s.path && existsSync(s.path)));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Skill 문서: SKILL.md가 가리키는 references가 모두 있고, 지운 설계도·템플릿 문서를 가리키지 않음', () => {
  const skill = readFileSync(join(SKILL, 'SKILL.md'), 'utf8');
  const refs = [...new Set([...skill.matchAll(/references\/([\w./<>-]+\.md|designs\/)/g)].map((m) => m[1]).filter((x) => !x.includes('<')))];
  assert.ok(refs.length >= 6, refs.join(','));
  for (const r of refs) assert.ok(existsSync(join(SKILL, 'references', r)), r);
  for (const old of ['blueprint.md', 'modules.md', 'concept.md', 'design-quality.md', 'references/design.md', ' make ', 'patch ']) assert.ok(!skill.includes(old), old);
  const refDir = readdirSync(join(SKILL, 'references'));
  for (const gone of ['blueprint.md', 'modules.md', 'design.md', 'concept.md', 'design-quality.md', 'design-principles.md', 'copywriting.md', 'qa-checklist.md']) assert.ok(!refDir.includes(gone), gone);
  for (const gone of ['design-principles', 'copywriting', 'qa-checklist']) assert.ok(!skill.includes(gone), gone); // 디자인·문구 규칙과 점검표를 꼭 읽게 하지 않음(AI가 정함)
  assert.ok(skill.length < 7000, `SKILL.md ${skill.length}자`);
});
