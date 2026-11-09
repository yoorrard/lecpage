// 빌드 전 준비: 견본 연수 사이트 2개를 엔진으로 빌드해 public/examples/에, 효과 데모를 public/fx-demo/에 넣습니다.
import { readFileSync, rmSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = join(HERE, '..', '..', 'skills', 'lecpage');
const PUB = join(HERE, '..', 'public');
const E = await import(pathToFileURL(join(SKILL, 'engine', 'src', 'index.js')).href);
const N = await import(pathToFileURL(join(SKILL, 'engine', 'node.js')).href);
rmSync(join(PUB, 'examples'), { recursive: true, force: true });
for (const id of ['sel-story', 'ai-lab']) {
  const bp = JSON.parse(readFileSync(join(SKILL, 'examples', `${id}.blueprint.json`), 'utf8'));
  const r = E.build(bp, { runtime: N.nodeRuntime(), assets: N.readAssetDir(join(SKILL, 'examples', 'assets', id), 'assets/') });
  if (r.errors.length) { console.error(id, r.errors); process.exit(1); }
  const out = join(PUB, 'examples', id);
  mkdirSync(out, { recursive: true });
  N.writeFiles(out, r.files);
  console.log(`견본 ${id}: 파일 ${Object.keys(r.files).length}개, 효과 ${r.report.effects.length}개`);
}
const fxSrc = join(SKILL, 'engine', 'runtime', 'fx');
if (existsSync(join(fxSrc, 'demo.html'))) { rmSync(join(PUB, 'fx-demo'), { recursive: true, force: true }); cpSync(fxSrc, join(PUB, 'fx-demo'), { recursive: true }); console.log('효과 데모 복사'); }
