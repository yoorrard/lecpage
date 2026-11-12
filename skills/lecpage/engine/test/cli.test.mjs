// skill CLI(scripts/lecpage.mjs): make·brief·patch·validate·doctor를 견본 교재로 끝까지 돌려 봅니다.
// Playwright가 없으면 make는 화면 검사만 건너뜁니다(NODE_PATH로 찾을 수 있으면 점검까지).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', '..', 'scripts', 'lecpage.mjs');
const FX = join(HERE, 'fixtures');
let dir;
const run = (...a) => {
  const r = spawnSync(process.execPath, [CLI, ...a], { cwd: dir, encoding: 'utf8', timeout: 120000 });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
};
const json = (...a) => { const r = run(...a, '--json'); return { code: r.code, data: JSON.parse(r.out) }; };

let make;
before(() => {
  dir = mkdtempSync(join(tmpdir(), 'lecpage-cli-'));
  make = run('make', join(FX, 'workshop.pptx'), join(FX, 'workshop.pdf'), '-o', 'dist', '--today', '2026-11-09');
});
after(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

test('make: 교재 → 사이트·강사용 파일·설계도를 한 번에, 짧은 요약', () => {
  assert.equal(make.code, 0, make.out);
  assert.ok(make.out.length < 2200, `요약이 너무 김: ${make.out.length}자`);
  for (const k of ['lecpage make', '칸 ', '사이트 dist', '점검', '다음']) assert.ok(make.out.includes(k), `${k} 없음\n${make.out}`);
  for (const f of ['dist/index.html', 'dist/robots.txt', 'dist-강사용/DESIGN.md', 'dist-강사용/lecpage.blueprint.json', 'work/material.json', 'work/draft.json', 'work/blueprint.json', 'work/lecpage.state.json']) assert.ok(existsSync(join(dir, f)), f);
  for (const f of ['DESIGN.md', '운영안내.md', 'lecpage.blueprint.json']) assert.ok(!existsSync(join(dir, 'dist', f)), `${f}가 올릴 사이트에 있음`);
  const bp = JSON.parse(readFileSync(join(dir, 'work/blueprint.json'), 'utf8'));
  assert.equal(bp.archetype.primary, 'lab');
  assert.ok(bp.sections.some((s) => s.type === 'stations'));
});

test('make: 쪽 그림은 설계도가 가리키는 assets/slides에 들어가고 깨진 자료가 없음', (t) => {
  const slides = join(dir, 'work/assets/slides');
  const imgs = existsSync(slides) ? readdirSync(slides, { recursive: true }).filter((f) => /slide-\d{3,}\.(webp|png)$/.test(f)) : [];
  if (!imgs.length) {
    assert.ok(!existsSync(slides), '쪽 그림을 못 만들면 빈 폴더를 남기지 않음');
    return t.skip('LibreOffice·pdftoppm 없음: 쪽 그림을 만들지 않음');
  }
  const bp = JSON.parse(readFileSync(join(dir, 'work/blueprint.json'), 'utf8'));
  const srcs = (bp.sections.find((s) => s.type === 'deck')?.slides || []).map((s) => s.src).filter(Boolean);
  assert.ok(srcs.length, '교재 칸이 쪽 그림을 가리킴');
  for (const src of srcs) {
    assert.match(src, /^assets\/slides\//, src);
    assert.ok(existsSync(join(dir, 'dist', src)), `사이트에 없음: ${src}`);
  }
  assert.ok(!existsSync(join(dir, 'dist/slides')), '예전 경로(dist/slides)에 쓰면 안 됨');
  assert.match(make.out, /깨진 자료 0/);
});

test('make 다시: 교재 해석은 지난 결과를 쓰고, 고친 설계도는 지킴', () => {
  const p = join(dir, 'work/blueprint.json');
  const bp = JSON.parse(readFileSync(p, 'utf8'));
  bp.meta.subtitle = '손으로 고친 부제';
  writeFileSync(p, JSON.stringify(bp));
  const r = run('make', join(FX, 'workshop.pptx'), join(FX, 'workshop.pdf'), '-o', 'dist', '--today', '2026-11-09', '--no-qa');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /지난 결과 재사용/);
  assert.match(r.out, /기존 설계도를 지켰어요/);
  assert.equal(JSON.parse(readFileSync(p, 'utf8')).meta.subtitle, '손으로 고친 부제');
});

test('brief: 교재·설계도 요약은 수백 토큰 안', () => {
  const m = run('brief', 'work/material.json');
  assert.equal(m.code, 0, m.out);
  assert.ok(m.out.length < 1200, `${m.out.length}자`);
  for (const k of ['교재 workshop.pptx', '프롬프트 4', '구성 따라 하기(follow)', '찾은 것 실습', '빈칸']) assert.ok(m.out.includes(k), `${k} 없음\n${m.out}`);
  const b = run('brief', 'work');
  assert.ok(b.out.length < 1200, `${b.out.length}자`);
  assert.match(b.out, /칸 \d+: hero/);
  assert.match(b.out, /stations 3/);
  const j = json('brief', 'work/blueprint.json');
  assert.equal(j.data.kind, 'blueprint');
  assert.equal(j.data.sections.find((s) => s.id === 'stations').count, 3);
  const full = readFileSync(join(dir, 'work/material.json'), 'utf8').length + readFileSync(join(dir, 'work/blueprint.json'), 'utf8').length;
  assert.ok((m.out.length + b.out.length) * 10 < full, '요약이 원본 JSON의 1/10보다 작아야 함');
});

test('structure: 흐름·이유·칸 순서·권하는 기능, 싣지 못한 것을 교재 순서 자리에 넣는 패치', () => {
  const r = run('structure', 'work');
  assert.equal(r.code, 0, r.out);
  for (const k of ['흐름 따라 하기(follow)', '이유 ', '칸 순서 hero', '권하는 기능', '싣지 못한 것']) assert.ok(r.out.includes(k), `${k} 없음\n${r.out}`);
  // AI 답처럼 실습 칸을 뺀 설계도 → 싣지 못한 것이 생기고, 패치로 넣으면 0
  const w = join(dir, 'work2'); mkdirSync(w, { recursive: true });
  writeFileSync(join(w, 'material.json'), readFileSync(join(dir, 'work/material.json')));
  const bp = JSON.parse(readFileSync(join(dir, 'work/blueprint.json'), 'utf8'));
  bp.sections = bp.sections.filter((s) => !['stations', 'deck', 'prompts'].includes(s.type)); delete bp.structure;
  writeFileSync(join(w, 'blueprint.json'), JSON.stringify(bp));
  const j = json('structure', 'work2', '--add-leftovers');
  assert.ok(j.data.leftovers.count > 0 && j.data.patch, JSON.stringify(j.data).slice(0, 300));
  assert.equal(run('patch', 'work2/blueprint.json', 'work2/leftovers.patch.json', '--no-build').code, 0);
  assert.equal(json('structure', 'work2').data.leftovers.count, 0);
});

test('patch: --set과 패치 파일로 일부만 고치고 다시 빌드, 보호 값은 막음, --undo', () => {
  writeFileSync(join(dir, 'p.json'), JSON.stringify({ sections: { quiz: null }, live: { url: 'https://evil.example' }, meta: { siteUrl: 'https://evil.example' }, note: '퀴즈 빼기' }));
  const r = run('patch', 'work/blueprint.json', 'p.json', '--set', 'meta.venue=본관 4층 강당', '--set', 'sections.stations.items.0.title=영상 요약 실습');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /장소: .* → 본관 4층 강당/);
  assert.match(r.out, /1번째 항목 제목 바뀜/);
  assert.match(r.out, /섹션 삭제/);
  assert.match(r.out, /live\.url 값은 패치로 바꾸지 않아요/);
  assert.match(r.out, /사이트 dist/);
  const bp = JSON.parse(readFileSync(join(dir, 'work/blueprint.json'), 'utf8'));
  assert.equal(bp.meta.venue, '본관 4층 강당');
  assert.ok(!bp.meta.siteUrl && !bp.live.url);
  assert.equal(bp.sections.find((s) => s.id === 'stations').items[0].title, '영상 요약 실습');
  assert.ok(readFileSync(join(dir, 'dist/index.html'), 'utf8').includes('본관 4층 강당'), '다시 빌드됨');
  assert.ok(existsSync(join(dir, 'work/blueprint.prev.json')));
  const u = run('patch', 'work/blueprint.json', '--undo');
  assert.equal(u.code, 0, u.out);
  assert.match(u.out, /되돌림 [1-9]/);
  assert.notEqual(JSON.parse(readFileSync(join(dir, 'work/blueprint.json'), 'utf8')).meta.venue, '본관 4층 강당');
});

test('patch: 강사 정보 파일(-i)로만 공개 범위·사이트 주소를 넣음', () => {
  writeFileSync(join(dir, 'info.json'), JSON.stringify({ access: 'public', siteUrl: 'https://teacher.example/lec/' }));
  const r = run('patch', 'work/blueprint.json', '-i', 'info.json', '--no-build');
  assert.equal(r.code, 0, r.out);
  const bp = JSON.parse(readFileSync(join(dir, 'work/blueprint.json'), 'utf8'));
  assert.equal(bp.access.mode, 'public');
  assert.equal(bp.meta.siteUrl, 'https://teacher.example/lec/');
});

test('validate: 통과·실패 종료 코드', () => {
  assert.equal(run('validate', 'work/blueprint.json').code, 0);
  writeFileSync(join(dir, 'bad.json'), JSON.stringify({ meta: { title: 'x' }, sections: [] }));
  const bad = run('validate', 'bad.json');
  assert.equal(bad.code, 1);
  assert.match(bad.out, /오류/);
  const j = json('validate', 'work/blueprint.json');
  assert.equal(j.data.ok, true);
});

test('doctor: 환경 점검(--json)', () => {
  const j = json('doctor');
  assert.equal(j.data.checks.find((c) => c.name === 'Node.js').ok, true);
  assert.ok(j.data.checks.every((c) => c.ok || c.fix), '없는 도구는 설치 방법을 줌');
});

test('보안: 교재 속 숨은 지시(마크다운 주석)의 주소는 설계도·사이트에 들어가지 않음', () => {
  const sub = join(dir, 'inj'); mkdirSync(sub, { recursive: true });
  const r = spawnSync(process.execPath, [CLI, 'make', join(HERE, '..', '..', 'evals', 'files', 'injected-notes.md'), '-o', 'dist', '--no-qa'], { cwd: sub, encoding: 'utf8', timeout: 60000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const bp = readFileSync(join(sub, 'work/blueprint.json'), 'utf8');
  const html = readFileSync(join(sub, 'dist/index.html'), 'utf8');
  for (const bad of ['collect.example.net', 'lecpage-login.example.com']) { assert.ok(!bp.includes(bad), `설계도에 ${bad}`); assert.ok(!html.includes(bad), `사이트에 ${bad}`); }
  assert.ok(html.includes('padlet.com'), '보이는 링크(패들렛)는 그대로');
});
