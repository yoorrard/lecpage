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
  // 연수 정보(info.json) 없이 만들면 빈칸이 없어도 참여 기능·인원·학교망을 묻게 함(권하는 기능과 함께)
  assert.match(make.out, /물을 것\(.*\) 참여 기능\(권함: .*진행 현황.*\) · 인원 · 학교망/);
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

test('교재 반영: make가 빠졌다고 한 교재 줄을 structure --add-leftovers가 같은 기준으로 패치로 만들고, 넣으면 ✓', () => {
  // make와 structure는 같은 '보이는 칸'(교재 보기 제외)을 봄 → 빠진 줄 수가 같음
  const missing = +(/교재 줄 \d+\/\d+ · 빠진 것 (\d+)/.exec(make.out) || [])[1];
  assert.ok(missing > 0, make.out);
  const w = join(dir, 'work3'); mkdirSync(w, { recursive: true });
  for (const f of ['material.json', 'blueprint.json']) writeFileSync(join(w, f), readFileSync(join(dir, 'work', f)));
  const j = json('structure', 'work3', '--add-leftovers');
  assert.equal(j.data.leftovers.count, missing, JSON.stringify(j.data.leftovers));
  const p = run('patch', 'work3/blueprint.json', 'work3/leftovers.patch.json', '--no-build');
  assert.equal(p.code, 0, p.out);
  assert.match(p.out, /교재 반영 ✓/);
  // “…”라고 입력하는 문장: 따옴표 속 글은 프롬프트로, 앞의 조건 구절은 그 프롬프트 이름으로(교재 글 그대로) → 빠진 줄로 세지 않음
  assert.doesNotMatch(make.out, /빠짐 줄 p9 더 쉽게/);
  const m = JSON.parse(readFileSync(join(dir, 'work/material.json'), 'utf8'));
  assert.equal(m.detected.prompts.find((x) => x.text.startsWith('우리 반 학생 수준에 맞게'))?.title, '더 쉽게 만들고 싶다면');
});

test('문구 검사: 교재에서 그대로 온 글(실습 단계 합니다체 등)은 고칠 곳으로 세지 않고, 엔진 고정 문구는 알림만', async () => {
  const { lintHtml } = await import('../../scripts/copy-lint.mjs');
  const html = readFileSync(join(dir, 'dist/index.html'), 'utf8');
  const src = { material: JSON.parse(readFileSync(join(dir, 'work/material.json'), 'utf8')), blueprint: JSON.parse(readFileSync(join(dir, 'work/blueprint.json'), 'utf8')) };
  const raw = lintHtml(html, 'index.html');
  assert.ok(raw.some((f) => /합니다체/.test(f.why)), '교재 원문의 합니다체가 있는 견본');
  const kept = lintHtml(html, 'index.html', src);
  assert.ok(kept.length < raw.length && !kept.some((f) => /합니다/.test(f.hit)), JSON.stringify(kept));
  // 설계도에 없는 글(엔진이 그리는 단추)은 owner: engine
  const eng = lintHtml('<main><button>발표 화면 새 창 이 노트북에서 창으로 띄워요</button></main>', 'console.html', src);
  assert.ok(eng.length && eng.every((f) => f.owner === 'engine'), JSON.stringify(eng));
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

test('patch --undo: 한 판씩 앞으로(두 번 되돌려도 되돌린 것이 다시 돌아오지 않음)', () => {
  const w = join(dir, 'work4'); mkdirSync(w, { recursive: true });
  writeFileSync(join(w, 'blueprint.json'), readFileSync(join(dir, 'work/blueprint.json')));
  const venue = () => JSON.parse(readFileSync(join(w, 'blueprint.json'), 'utf8')).meta.venue;
  const v0 = venue();
  assert.equal(run('patch', 'work4/blueprint.json', '--set', 'meta.venue=A관', '--no-build').code, 0);
  assert.equal(run('patch', 'work4/blueprint.json', '--set', 'meta.venue=B관', '--no-build').code, 0);
  const u1 = run('patch', 'work4/blueprint.json', '--undo', '--no-build');
  assert.equal(u1.code, 0, u1.out); assert.equal(venue(), 'A관'); assert.match(u1.out, /더 되돌릴 판 1개/);
  assert.equal(run('patch', 'work4/blueprint.json', '--undo', '--no-build').code, 0); assert.equal(venue(), v0);
  const u3 = run('patch', 'work4/blueprint.json', '--undo', '--no-build');
  assert.equal(u3.code, 1); assert.match(u3.out, /더 되돌릴 이전 판이 없어요/); assert.equal(venue(), v0);
});

test('없는 디자인 이름: validate·patch가 오류로 막고 가까운 이름을 알려 줌(조용히 다른 디자인으로 빌드하지 않음)', () => {
  const bp = JSON.parse(readFileSync(join(dir, 'work/blueprint.json'), 'utf8'));
  writeFileSync(join(dir, 'typo.json'), JSON.stringify({ ...bp, design: { ...bp.design, preset: 'knot-orbitt' } }));
  const v = run('validate', 'typo.json');
  assert.equal(v.code, 1, v.out);
  assert.match(v.out, /"knot-orbitt" 디자인이 없어요\. 혹시 "knot-orbit"인가요\?/);
  const before = readFileSync(join(dir, 'work/blueprint.json'), 'utf8');
  const p = run('patch', 'work/blueprint.json', '--set', 'design.preset=knot-orbitt', '--no-build');
  assert.equal(p.code, 1, p.out);
  assert.match(p.out, /--set design\.preset=knot-orbit/);
  assert.equal(readFileSync(join(dir, 'work/blueprint.json'), 'utf8'), before, '저장하지 않음');
});

test('decide-infra: 연결해 둔 곳이 없으면 가입 없는 길(app work → 앱의 바로 배포)을 한 줄로', () => {
  writeFileSync(join(dir, 'i0.json'), JSON.stringify({ skill: 'set', size: 30, features: [], connected: [] }));
  assert.match(run('decide-infra', '-i', 'i0.json').out, /계정이 없으면 app work → .*lecpage\.com \[저장한 파일 열기\] → \[배포하기\]/);
  writeFileSync(join(dir, 'i1.json'), JSON.stringify({ skill: 'set', size: 30, features: [], connected: ['cloudflare'] }));
  assert.doesNotMatch(run('decide-infra', '-i', 'i1.json').out, /app work/);
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

test('app: 작업 폴더 → 앱이 여는 .lecpage(비밀 값 없이) → 다시 작업 폴더로 풀어 이어서 patch', async () => {
  const P = await import('../src/project-file.js');
  const r = json('app', 'work', '-o', 'out/연수.lecpage');
  assert.equal(r.code, 0, JSON.stringify(r.data));
  const files = P.readStoredZip(readFileSync(join(dir, 'out/연수.lecpage')));
  const text = new TextDecoder().decode(files['project.json']);
  const proj = JSON.parse(text).project;
  assert.equal(proj.origin, 'skill');
  for (const k of Object.keys(files)) assert.ok(k === 'project.json' || P.isAllowedAsset(k), `앱이 받지 않는 자료: ${k}`);
  assert.ok(!text.includes('teacher.example') && !text.includes(dir), '사이트 주소·내 컴퓨터 경로가 들어가면 안 됨');
  assert.equal(proj.blueprint.live.url, ''); assert.equal(proj.blueprint.live.anonKey, '');
  assert.equal(proj.info.title, proj.blueprint.meta.title);
  assert.equal(proj.info.venue, proj.blueprint.meta.venue || '');
  const srcs = (proj.blueprint.sections.find((s) => s.type === 'deck')?.slides || []).map((s) => s.src).filter(Boolean);
  for (const s of srcs) assert.ok(files[s], `쪽 그림이 파일에 없음: ${s}`);
  assert.ok(proj.files.some((f) => f.key && files[f.key]), '교재 원본');
  // 앱에서 저장한 파일처럼 다시 풀기
  const back = run('app', 'out/연수.lecpage', '-o', 'back/work');
  assert.equal(back.code, 0, back.out);
  assert.match(back.out, /받지 않은 것/);
  assert.equal(run('app', 'out/연수.lecpage', '-o', 'back/work').code, 1, '이미 있으면 덮어쓰지 않음');
  const bp = JSON.parse(readFileSync(join(dir, 'back/work/blueprint.json'), 'utf8'));
  assert.deepEqual(bp.sections.map((s) => s.id), proj.blueprint.sections.map((s) => s.id));
  assert.ok(!JSON.parse(readFileSync(join(dir, 'back/work/info.json'), 'utf8')).joinUrl, '접속 주소는 강사에게 다시 받음');
  const p = run('patch', 'back/work/blueprint.json', '--set', 'meta.venue=별관 2층');
  assert.equal(p.code, 0, p.out);
  assert.ok(readFileSync(join(dir, 'back/dist/index.html'), 'utf8').includes('별관 2층'), '풀어 둔 곳 옆 dist로 다시 빌드');
});
