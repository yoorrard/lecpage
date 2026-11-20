#!/usr/bin/env node
// 레퍼런스 사이트(skills/lecpage/references/designs/<id>/)를 Skill 흐름 그대로 조립·검수: 작업 폴더 사본(.out/<id>/)에
// site/·lecpage.json을 두고 `lecpage.mjs check`(조립 + 정적 검수 + Playwright가 있으면 390·1280 화면 검수)를 돌림.
// 고칠 곳이 하나라도 있으면 종료 코드 1. 레퍼런스 폴더는 건드리지 않음(조립 결과·검수 그림은 사본 쪽에).
//   node scripts/check-references.mjs [id …]   (npm run examples)
import { cpSync, existsSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESIGNS = join(ROOT, 'skills', 'lecpage', 'references', 'designs');
const CLI = join(ROOT, 'skills', 'lecpage', 'scripts', 'lecpage.mjs');
const ids = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(DESIGNS, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(DESIGNS, d.name, 'site', 'index.html'))).map((d) => d.name);
let bad = 0;
for (const id of ids) {
  const work = join(ROOT, '.out', id);
  rmSync(work, { recursive: true, force: true }); mkdirSync(work, { recursive: true });
  cpSync(join(DESIGNS, id, 'site'), join(work, 'site'), { recursive: true });
  cpSync(join(DESIGNS, id, 'lecpage.json'), join(work, 'lecpage.json'));
  const r = spawnSync(process.execPath, [CLI, 'check', work, '--no-tiles'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  const head = String(r.stdout || '').split('\n').filter((l) => /^(조립|검수|고칠 곳)/.test(l));
  console.log(`${r.status === 0 ? '✓' : '✕'} ${id}: ${head.join(' / ') || String(r.stdout).trim().split('\n')[0]}`);
  if (r.status !== 0) bad++;
}
if (!ids.length) { console.error('레퍼런스 사이트가 없어요(references/designs/<id>/site/index.html).'); process.exit(1); }
process.exit(bad ? 1 : 0);
