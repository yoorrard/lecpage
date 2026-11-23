// 앱 CSP 검사: script-src에 'unsafe-inline'이 다시 들어오지 않았는지, 빌드한 index.html의 인라인 스크립트와 해시가 맞는지,
// _headers(앱 화면·격리 틀)와 격리 틀(public/frame/index.html)의 CSP가 규칙대로인지. 규칙은 build/csp.js(checkCsp, 빌드 플러그인도 같은 것을 씀).
//   node app/scripts/csp-check.mjs            소스(index.html·public) + 빌드본(app/dist가 있으면)
//   node app/scripts/csp-check.mjs <dist 폴더> 그 빌드본도
// 도우미가 실제로 걸러 내는지도 함께 확인(되돌린 CSP·틀린 해시를 넣어 봄). 고칠 곳이 있으면 종료 코드 1
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkCsp, hashIndexHtml, inlineScripts, sha256, metaCsp, directive } from '../build/csp.js';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const { LIB_SCRIPT_SOURCES: libs } = await import(pathToFileURL(join(APP, '..', 'skills', 'lecpage', 'engine', 'src', 'render', 'shell.js')).href);
const read = (p) => readFileSync(p, 'utf8');
let bad = 0;
const report = (name, list) => { if (list.length) { bad += list.length; console.error(`✗ ${name}\n  - ${list.join('\n  - ')}`); } else console.log(`✓ ${name}`); };

// 1 소스
const src = { index: read(join(APP, 'index.html')), frame: read(join(APP, 'public', 'frame', 'index.html')), headers: read(join(APP, 'public', '_headers')) };
report('소스(index.html · public/frame/index.html · public/_headers)', checkCsp({ ...src, libs }));

// 2 빌드본
const dist = process.argv[2] ? resolve(process.argv[2]) : join(APP, 'dist');
if (existsSync(join(dist, 'index.html'))) {
  const built = { index: read(join(dist, 'index.html')), frame: read(join(dist, 'frame', 'index.html')), headers: existsSync(join(dist, '_headers')) ? read(join(dist, '_headers')) : undefined };
  report(`빌드본(${dist})`, checkCsp({ ...built, libs, built: true }));
  const n = inlineScripts(built.index).length;
  console.log(`  인라인 스크립트 ${n}개 · script-src ${(directive(metaCsp(built.index), 'script-src') || []).join(' ')}`);
} else if (process.argv[2]) { bad++; console.error(`✗ 빌드본이 없어요: ${dist}`); }
else console.log('· 빌드본(app/dist)이 없어 소스만 봤어요');

// 3 검사가 실제로 걸러 내는지(스스로 확인)
const self = [];
const sample = src.index.replace('</head>', '<script>console.log(1)</script>\n</head>');
const hashed = hashIndexHtml(sample);
if (!hashed.csp.includes(sha256('console.log(1)'))) self.push('해시를 넣지 못함');
if (checkCsp({ index: hashed.html, frame: src.frame, libs, built: true }).length) self.push('맞는 해시인데 걸림');
if (!checkCsp({ index: sample, frame: src.frame, libs, built: true }).some((x) => /해시/.test(x))) self.push('해시가 없는 인라인 스크립트를 지나침');
if (!checkCsp({ index: hashed.html.replace('console.log(1)', 'console.log(2)'), frame: src.frame, libs, built: true }).some((x) => /해시/.test(x))) self.push('글이 바뀐 인라인 스크립트를 지나침');
if (!checkCsp({ index: src.index.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"), frame: src.frame, libs }).some((x) => /unsafe-inline/.test(x))) self.push("'unsafe-inline'을 지나침");
if (!checkCsp({ index: src.index, frame: src.frame.replace(" 'unsafe-inline' 'wasm-unsafe-eval'", " 'wasm-unsafe-eval'"), libs }).some((x) => /frame/.test(x))) self.push("격리 틀의 'unsafe-inline' 빠짐을 지나침");
if (!checkCsp({ index: src.index, frame: src.frame, libs: [...libs, 'https://cdn.jsdelivr.net/npm/new-lib@1.0.0/'] }).some((x) => /LIB_SCRIPT_SOURCES/.test(x))) self.push('엔진 라이브러리 경로가 달라진 것을 지나침');
if (!checkCsp({ ...src, headers: src.headers.replace(/\/frame\/\n(?:\s+.*\n)+/, ''), libs }).some((x) => /\/frame\//.test(x))) self.push('_headers의 /frame/ 규칙 빠짐을 지나침');
report('검사 도우미 스스로 확인', self);

if (bad) { console.error(`\n고칠 곳 ${bad}`); process.exit(1); }
console.log('\n고칠 곳 0');
