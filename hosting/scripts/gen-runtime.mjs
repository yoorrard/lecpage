#!/usr/bin/env node
// 엔진 런타임(skills/lecpage/engine/runtime)에서 "받아도 되는 스크립트 조각" 목록을 만들어 src/runtime-allow.js에 씁니다.
// 호스트는 올라온 .js가 이 조각 하나이거나, 조각들을 '\n;\n'로 이은 것일 때만 받습니다(src/runtime.js).
// 조각마다 길이·앞머리·SHA-256만 두므로 Worker 묶음이 커지지 않습니다.
//
//   node scripts/gen-runtime.mjs          현재 런타임(+ runtime-history.json에 적어 둔 이전 판)으로 목록 생성
//   node scripts/gen-runtime.mjs --keep   지금 런타임을 runtime-history.json에 적어 둠(새 판을 낸 뒤에도 예전 앱이 올릴 수 있게)
//   node scripts/gen-runtime.mjs --check  파일을 쓰지 않고, 이미 있는 목록이 최신인지 확인(다르면 종료 코드 1)
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pagesHash } from '../src/blake3.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOSTING = join(HERE, '..');
const ENGINE = join(HOSTING, '..', 'skills', 'lecpage', 'engine');
const RUNTIME = join(ENGINE, 'runtime');
// 시험할 때만 다른 곳에 쓰게 바꿈
const OUT = process.env.LECPAGE_RUNTIME_OUT || join(HOSTING, 'src', 'runtime-allow.js');
const HISTORY = process.env.LECPAGE_RUNTIME_HISTORY || join(HOSTING, 'runtime-history.json');
// 사이트들이 같이 쓰는 런타임 파일의 정적 사본(public/rt/<sha256>.js). Worker 요청 수에 들지 않는 정적 자산으로 내보내고, 모든 사이트가 브라우저 캐시를 같이 씀
const RT_DIR = process.env.LECPAGE_RT_DIR || join(HOSTING, 'public', 'rt');
export const HEAD_LEN = 32;
/** 사이트에 들어가지 않는 런타임(앱 미리보기의 검토 도구)은 받지 않음 */
const SKIP_DIRS = new Set(['review']);

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
/** 줄바꿈을 LF로 맞춘 뒤 잼(Windows에서 받은 저장소로 앱을 빌드해도 맞도록). src/runtime.js도 같은 정규화를 함 */
const norm = (s) => s.replace(/\r\n/g, '\n');
export function segment(name, text) {
  const t = norm(text);
  return { name, len: t.length, head: t.slice(0, HEAD_LEN), sha256: sha256(t) };
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { if (!SKIP_DIRS.has(name)) walk(full, out); } else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

/** build.js가 fx.js 끝에 붙이는 시작 코드(런타임 파일이 아니라 build.js 안의 글자열) */
function fxTrailer() {
  const src = readFileSync(join(ENGINE, 'src', 'build.js'), 'utf8');
  const m = /parts\.push\('(if\(window\.LecFX\)[^'\\\n]*)'\)/.exec(src);
  if (!m) throw new Error('engine/src/build.js에서 fx.js 끝에 붙는 시작 코드를 찾지 못했어요. build.js가 바뀌었으면 scripts/gen-runtime.mjs의 fxTrailer()를 맞춰 주세요.');
  return m[1];
}

/** Supabase 연결이 불러오는 라이브러리 주소(runtime/live/supabase.js에 버전까지 고정돼 있음). 운영자가 ALLOW_SUPABASE_SDK를 켰을 때만 CSP에 넣음 */
export function supabaseSdk() {
  const f = join(RUNTIME, 'live', 'supabase.js');
  const m = existsSync(f) ? /['"](https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@\d+\.\d+\.\d+\/[A-Za-z0-9_./-]+\.js)['"]/.exec(readFileSync(f, 'utf8')) : null;
  return m ? m[1] : '';
}

export function currentSegments() {
  if (!existsSync(RUNTIME)) throw new Error(`엔진 런타임 폴더가 없어요: ${RUNTIME}`);
  const segs = walk(RUNTIME).map((f) => segment(relative(RUNTIME, f).split(sep).join('/'), readFileSync(f, 'utf8')));
  segs.push(segment('build.js#fx-start', fxTrailer()));
  if (segs.some((s) => !s.len)) throw new Error('빈 런타임 파일이 있어요.');
  return segs;
}

function readHistory() {
  if (!existsSync(HISTORY)) return [];
  const j = JSON.parse(readFileSync(HISTORY, 'utf8'));
  return Array.isArray(j.segments) ? j.segments.filter((s) => s && typeof s.sha256 === 'string' && Number.isInteger(s.len) && typeof s.head === 'string') : [];
}

/** 엔진이 사이트에 '그대로' 넣는 런타임 파일(engine/src/build.js·protect.js). live.js는 core + 제공자 하나 */
const WHOLE_FILES = ['boot.js', 'lecpage.js', 'screen.js', 'console.js', 'unlock.js', 'vendor/qrcode.js'];
export function staticFiles() {
  const read = (n) => norm(readFileSync(join(RUNTIME, n), 'utf8'));
  const out = WHOLE_FILES.filter((n) => existsSync(join(RUNTIME, n))).map((n) => ({ name: n, text: read(n) }));
  const liveDir = join(RUNTIME, 'live');
  if (existsSync(join(liveDir, 'core.js'))) {
    for (const p of readdirSync(liveDir).sort()) if (p.endsWith('.js') && p !== 'core.js') out.push({ name: `live.js(${p})`, text: [read('live/core.js'), read(`live/${p}`)].join('\n;\n') });
  }
  return out.map((f) => ({ ...f, sha256: sha256(f.text) }));
}
/**
 * Pages 보기: 엔진이 사이트에 그대로 넣는 런타임 파일(.js)의 Pages 자산 열쇠(blake3(base64 + 'js') 앞 32자).
 * 모든 사이트가 같은 내용이라, 서버가 이 열쇠를 미리 알면 사이트마다 이 파일들을 다시 올려받지 않음(새 사이트 하나에 Worker·DO 요청 7개, Pages API 호출 7~14개 덜 씀).
 * Pages에 아직 없으면(처음 한 번) 공개할 때 missing_blobs로 그 파일만 받음
 */
export function pagesRuntime(statics = staticFiles()) {
  const te = new TextEncoder();
  const files = [...statics];
  if (existsSync(join(RUNTIME, 'check.js'))) { const text = norm(readFileSync(join(RUNTIME, 'check.js'), 'utf8')); files.push({ name: 'check.js', text, sha256: sha256(text) }); }
  return files.map((f) => ({ name: f.name, sha256: f.sha256, phash: pagesHash(te.encode(f.text), 'js') }));
}
function writeStatic(files) {
  mkdirSync(RT_DIR, { recursive: true });
  const want = new Set(files.map((f) => `${f.sha256}.js`));
  for (const name of readdirSync(RT_DIR)) if (!want.has(name)) unlinkSync(join(RT_DIR, name));
  for (const f of files) {
    const p = join(RT_DIR, `${f.sha256}.js`);
    if (!existsSync(p) || readFileSync(p, 'utf8') !== f.text) writeFileSync(p, f.text);
  }
}

function render(segs, version, sdk, statics = [], pagesRt = []) {
  const rows = segs.map((s) => `  [${JSON.stringify(s.name)}, ${s.len}, ${JSON.stringify(s.head)}, '${s.sha256}'],`).join('\n');
  return `// 자동으로 만든 파일입니다. 고치지 마세요 → node scripts/gen-runtime.mjs\n// 엔진 런타임 조각: [이름, 길이(UTF-16), 앞 ${HEAD_LEN}자, SHA-256(UTF-8, 줄바꿈 LF)]\nexport const RUNTIME_VERSION = '${version}';\n/** Supabase 라이브러리 주소(엔진이 고정한 버전) */\nexport const SUPABASE_SDK = ${JSON.stringify(sdk)};\nexport const RUNTIME_SEGMENTS = [\n${rows}\n];\n/** 정적 자산(public/rt/<sha256>.js)으로도 있는 런타임 파일. 사이트 HTML이 이 내용의 파일을 부르면 /rt/로 바꿔 내보냄 */\nexport const STATIC_RUNTIME = [\n${statics.map((f) => `  '${f.sha256}', // ${f.name}`).join('\n')}\n];\n/** Pages 보기: 사이트에 그대로 들어가는 런타임 파일의 Pages 자산 열쇠(sha256 → blake3 열쇠, 확장자 js). 미리 알아 다시 올려받지 않음 */\nexport const PAGES_RUNTIME = {\n${pagesRt.map((f) => `  '${f.sha256}': '${f.phash}', // ${f.name}`).join('\n')}\n};\n`;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const cur = currentSegments();
  // 지금 런타임의 지문(조각 해시를 이름순으로 이어 다시 해시). /api/info에는 내지 않고 로그·진단용
  const version = sha256(cur.map((s) => `${s.name}:${s.sha256}`).join('\n')).slice(0, 12);
  let history = readHistory();

  if (args.has('--keep')) {
    const today = new Date().toISOString().slice(0, 10);
    const seen = new Set(history.map((s) => s.sha256));
    const add = cur.filter((s) => !seen.has(s.sha256)).map((s) => ({ ...s, kept: today }));
    history = [...history, ...add];
    writeFileSync(HISTORY, JSON.stringify({ note: '예전 엔진 런타임 조각. 여기 적힌 것도 받습니다. 보안 문제로 막아야 하는 판은 지우세요.', segments: history }, null, 1) + '\n');
    console.log(`runtime-history.json: ${add.length}개 추가(모두 ${history.length}개)`);
  }

  const have = new Set(cur.map((s) => s.sha256));
  const old = history.filter((s) => !have.has(s.sha256)).map((s) => ({ ...s, name: `${s.name}@${s.kept || 'old'}` }));
  const statics = staticFiles();
  const text = render([...cur, ...old], version, supabaseSdk(), statics, pagesRuntime(statics));
  const before = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (args.has('--check')) {
    if (before !== text) { console.error('src/runtime-allow.js가 엔진 런타임과 달라요. node scripts/gen-runtime.mjs 를 실행하세요.'); process.exit(1); }
    return;
  }
  // 내용이 같으면 쓰지 않음(wrangler dev가 src를 지켜보다가 다시 빌드하는 고리를 막음)
  if (before !== text) writeFileSync(OUT, text);
  writeStatic(statics);
  console.log(`runtime-allow.js: 조각 ${cur.length}개${old.length ? ` + 이전 판 ${old.length}개` : ''} · 런타임 ${version}${before === text ? ' (변동 없음)' : ''}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
