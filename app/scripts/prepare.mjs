// 빌드 전 준비: 참고 디자인(레퍼런스 사이트, skills/lecpage/references/designs/<id>/)을 엔진 키트 assemble로 조립해 public/examples/<id>/에,
// 먼저 해보기 교재(대표 레퍼런스의 material/*.pdf)를 public/demo/<id>.pdf에, 효과 데모를 public/fx-demo/에 넣습니다.
// 레퍼런스 폴더: site/(AI가 쓴 사이트) · lecpage.json(연수 정보) · notes.json(분위기 설명) · material/(교재 원본·pages.json 쪽 제목)
// 참여 기능은 이 기기 안 연습(local)이라 서버 없이 둘러볼 수 있어요. 앱은 data/references.js가 notes.json을 읽어 목록을 만듦.
import { readFileSync, rmSync, mkdirSync, cpSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = join(HERE, '..', '..', 'skills', 'lecpage');
const PUB = join(HERE, '..', 'public');
const DESIGNS = join(SKILL, 'references', 'designs');
const K = await import(pathToFileURL(join(SKILL, 'engine', 'src', 'kit', 'index.js')).href);
const N = await import(pathToFileURL(join(SKILL, 'engine', 'node.js')).href);
const TEXT = /\.(html|css|m?js|json|txt|vtt|md)$/i;
const readJson = (p, d = null) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return d; } };

rmSync(join(PUB, 'examples'), { recursive: true, force: true });
rmSync(join(PUB, 'demo'), { recursive: true, force: true });
const ids = existsSync(DESIGNS) ? readdirSync(DESIGNS, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(DESIGNS, d.name, 'site', 'index.html'))).map((d) => d.name).sort() : [];
for (const id of ids) {
  const dir = join(DESIGNS, id);
  const raw = N.readAssetDir(join(dir, 'site'), '');
  const site = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, TEXT.test(k) ? new TextDecoder().decode(v) : v]));
  const meta = readJson(join(dir, 'lecpage.json'), {});
  const pages = readJson(join(dir, 'material', 'pages.json'), []);
  const r = K.assemble(site, meta, { runtime: N.nodeRuntime(), target: 'zip', prev: { access: 'public', live: { provider: 'local', url: '', code: 'EXAMPLE1' } }, material: { pages } });
  if (r.errors?.length) { console.error(id, r.errors); process.exit(1); }
  const out = join(PUB, 'examples', id);
  mkdirSync(out, { recursive: true });
  N.writeFiles(out, r.files);
  const pdf = existsSync(join(dir, 'material')) ? readdirSync(join(dir, 'material')).find((n) => /\.pdf$/i.test(n)) : '';
  if (pdf) { mkdirSync(join(PUB, 'demo'), { recursive: true }); copyFileSync(join(dir, 'material', pdf), join(PUB, 'demo', `${id}.pdf`)); }
  console.log(`참고 디자인 ${id}: 파일 ${Object.keys(r.files).length}개${r.warnings?.length ? `, 알림 ${r.warnings.length}개` : ''}${pdf ? ', 교재 PDF' : ''}`);
}
const fxSrc = join(SKILL, 'engine', 'runtime', 'fx');
if (existsSync(join(fxSrc, 'demo.html'))) { rmSync(join(PUB, 'fx-demo'), { recursive: true, force: true }); cpSync(fxSrc, join(PUB, 'fx-demo'), { recursive: true }); console.log('효과 데모 복사'); }
