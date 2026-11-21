// skill CLI(scripts/lecpage.mjs): 문구 검사·decide-infra·doctor·없어진 예전 명령 안내·앱 파일 풀기(예전 방식 연수)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { zipFiles } from '../src/zip-write.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', '..', 'scripts', 'lecpage.mjs');
let dir;
const run = (...a) => {
  const r = spawnSync(process.execPath, [CLI, ...a], { cwd: dir, encoding: 'utf8', timeout: 120000 });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
};
const json = (...a) => { const r = run(...a, '--json'); return { code: r.code, data: JSON.parse(r.out) }; };

before(() => { dir = mkdtempSync(join(tmpdir(), 'lecpage-cli-')); });
after(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

test('decide-infra: 연결해 둔 곳이 없으면 가입 없는 길(app work → 앱의 바로 배포)을 한 줄로', () => {
  writeFileSync(join(dir, 'i0.json'), JSON.stringify({ skill: 'set', size: 30, features: [], connected: [] }));
  assert.match(run('decide-infra', '-i', 'i0.json').out, /계정이 없으면 app work → .*lecpage\.com \[저장한 파일 열기\] → \[배포하기\]/);
  writeFileSync(join(dir, 'i1.json'), JSON.stringify({ skill: 'set', size: 30, features: [], connected: ['cloudflare'] }));
  assert.doesNotMatch(run('decide-infra', '-i', 'i1.json').out, /app work/);
});

test('doctor: 환경 점검(--json)', () => {
  const j = json('doctor');
  assert.equal(j.data.checks.find((c) => c.name === 'Node.js').ok, true);
  assert.ok(j.data.checks.every((c) => c.ok || c.fix), '없는 도구는 설치 방법을 줌');
});

test('예전 방식(설계도)의 명령은 없어졌다고 알리고 새 흐름을 안내(종료 코드 2)', () => {
  for (const c of ['make', 'build', 'patch', 'validate', 'qa', 'presets']) {
    const r = run(c, 'x');
    assert.equal(r.code, 2, c);
    assert.match(r.out, /예전 방식\(설계도\)의 명령이라 없어졌어요[\s\S]*prepare/, c);
  }
  assert.match(run('mak').out, /모르는 명령이에요: mak — 혹시 app\?|모르는 명령이에요: mak/);
});

test('app 연수.lecpage(예전 방식으로 만든 연수): 교재 쪽 그림·연수 정보·원본만 작업 폴더로, 사이트는 AI가 새로 씀', () => {
  const IMG = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]);
  const project = { title: '예전 연수', blueprint: { meta: { title: '예전 연수', date: '2026-12-03', start: '14:00' }, live: { provider: 'supabase', url: 'https://x.supabase.co', anonKey: 'secret', features: ['qa'] }, sections: [{ type: 'hero' }] },
    material: { files: [{ id: 'f1', name: '교재.pdf', type: 'pdf' }], pages: [{ file: 'f1', page: 1, title: '표지', image: 'assets/slides/slide-001.webp' }] } };
  writeFileSync(join(dir, 'old.lecpage'), zipFiles({ 'project.json': JSON.stringify({ format: 'lecpage-project', version: 1, project }), 'assets/slides/slide-001.webp': IMG, 'src/교재.pdf': new Uint8Array([37, 80, 68, 70]) }));
  const r = run('app', 'old.lecpage', '-o', 'w1');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /예전 방식으로 만든 연수예요[\s\S]*다음 prepare/);
  assert.ok(existsSync(join(dir, 'w1/site/material/p-001.webp')) && existsSync(join(dir, 'w1/src/교재.pdf')));
  assert.ok(!existsSync(join(dir, 'w1/site/index.html')), '예전 사이트는 옮기지 않음');
  const meta = JSON.parse(readFileSync(join(dir, 'w1/lecpage.json'), 'utf8'));
  assert.equal(meta.title, '예전 연수'); assert.equal(meta.sessions[0].date, '2026-12-03');
  assert.ok(!('live' in meta), '강사 값(참여 서버)은 lecpage.json에 쓰지 않음');
  assert.ok(!readFileSync(join(dir, 'w1/lecpage.json'), 'utf8').includes('secret'));
  assert.equal(run('app', 'old.lecpage', '-o', 'w1').code, 1, '이미 있으면 --force 없이 덮지 않음');
});
