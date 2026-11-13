#!/usr/bin/env node
// lecpage CLI — Node 22 이상. qa·options만 Playwright를 쓰고, 없으면 그 단계만 건너뜁니다.
// 기본 출력은 짧은 요약, --json을 붙이면 기계용 JSON.
//
//   make <교재...> [-i info.json] [-o dist] [--preset id] [--password 암호] [--no-qa] [--fresh] [--bundle-fonts]
//        교재 → 해석 → 초안 → 검증 → 빌드 → 점검을 한 번에(작업 파일은 dist 옆 work/)
//        다시 부르면 교재 해석은 재사용, 고친 설계도는 유지(--fresh: 설계도를 새 초안으로)
//        --bundle-fonts: 글꼴 CDN이 막힌 학교망용. 쓰인 글자가 든 글꼴 조각을 사이트 안에 담음(쪽을 열 때 외부 요청 0, 다시 만들 때도 이어짐)
//   brief [blueprint.json|material.json|work]        짧은 요약: 칸 id·개수·구성·빈칸·싣지 못한 것·주의·글꼴
//   structure [work|blueprint.json] [-i info.json] [--add-leftovers]   구성 정하기: 흐름·이유·칸 순서·권하는 기능·싣지 못한 것
//   patch <blueprint.json> [patch.json|'{…}'] [--set 경로=값 …] [-i info.json] [--undo] [--no-build]
//        일부만 고치고 검증·다시 빌드(형식: references/cli.md)
//   options <blueprint.json> [--presets a,b,c] [--mood calm,bold]   디자인 3안 빌드 → 비교 그림 한 장(분위기: calm·warm·bold·minimal·playful·formal·tech…)
//   doctor                                           환경 점검과 설치 방법
//   review <dist> [--port 4180]                      사이트를 띄우고 강사의 '수정 요청'(펜·네모 표시+글)을 work/feedback/에 모음
//   build <blueprint.json> -o dist [--assets 폴더] [-i info.json] [--password 암호] [--bundle-fonts]
//   validate <blueprint.json> · qa <dist> [--password 암호] · serve <dist> [--port 4173] · pack <dist> -o site.zip
//   draft <material.json> [-i info.json] -o draft.json · prompt <material.json> -o prompt.txt
//   guard <AI 답.json|txt> <material.json> [-i info.json] [-o blueprint.json]   AI 답의 교재 글(프롬프트·단계·일정·FAQ·목표·주소)을 교재대로
//   design <blueprint.json>                          컨셉(한 줄·모티프·권하는 디자인)과 디자인 순위·적용된 효과
//   decide-infra -i info.json · presets · effects
//   app [work] [-o 연수.lecpage]                   앱(웹)으로 넘기기: 설계도·연수 정보·교재 해석·쪽 그림을 앱이 여는 파일 하나로(비밀 값은 빼요)
//   app 연수.lecpage [-o work] [--force]            앱에서 [파일로 저장]한 연수를 작업 폴더로 풀어 이어서 작업
//   publish [work] [--host cloudflare|onpod] [--live] [--name 이름] [--dry-run] [--temporary] [--no-handouts]
//        강사 Cloudflare 계정에 올리기. --live: 참여 기능 중계도 같은 계정에(관리자 키는 강사용 폴더에만) → 사이트를 이어 다시 빌드 → 올림 → 주소 확인 → 안내물
//        --host onpod: Onpod(한국 서비스)에 사이트만(ONPOD_TOKEN). --host를 빼면 지난번에 올린 곳에 같은 주소로
//   handouts <올린 주소|dist> [-o 폴더] [--password 암호]   QR-안내문.pdf·강사-카드.pdf·발표화면.png(Playwright 필요)
import { readFileSync, writeFileSync, existsSync, statSync, createReadStream, mkdirSync, rmSync, readdirSync, copyFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, extname, resolve, dirname, relative, isAbsolute, basename } from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(HERE, '..', 'engine');
const imp = (p) => import(pathToFileURL(join(ENGINE, p)).href);
const E = await imp('src/index.js');
const N = await imp('node.js');
const { USER_ASSET } = await imp('src/build.js');

// ── 인자 ─────────────────────────────────────────
const BOOL = new Set(['json', 'add-leftovers', 'fresh', 'reingest', 'no-qa', 'no-slides', 'no-build', 'undo', 'qa', 'help', 'commercial', 'minor', 'keep-design', 'no-python', 'force', 'live', 'dry-run', 'no-handouts', 'no-verify', 'temporary', 'bundle-fonts']);
const [cmd, ...rest] = process.argv.slice(2);
const args = { _: [], set: [] };
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a === '-o' || a === '-i') args[a.slice(1)] = rest[++i];
  else if (a === '-h') args.help = true;
  else if (a.startsWith('--')) {
    const [k, inline] = a.slice(2).split(/=(.*)/s);
    if (BOOL.has(k)) args[k] = true;
    else { const v = inline !== undefined ? inline : rest[++i]; if (k === 'set') args.set.push(v); else args[k] = v; }
  } else args._.push(a);
}
const JSON_OUT = !!args.json;

// ── 공통 ─────────────────────────────────────────
const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { fail(`JSON을 읽지 못했어요: ${p} (${e.code === 'ENOENT' ? '파일 없음' : e.message})`); } };
const writeJson = (p, v) => { mkdirSync(dirname(resolve(p)), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2) + '\n'); };
const rel = (p) => { if (!p) return ''; const r = relative(process.cwd(), p); if (!r) return '.'; return !r.startsWith('..') && !isAbsolute(r) ? r : p; };
const fail = (m, extra = {}) => { if (JSON_OUT) console.log(JSON.stringify({ ok: false, error: m, ...extra })); else console.error('오류: ' + m); process.exit(1); };
const say = (lines, json) => { if (JSON_OUT) console.log(JSON.stringify(json)); else console.log(lines.filter((l) => l !== null && l !== undefined && l !== '').join('\n')); };
const cut = (s, n = 40) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const plural = (list, n = 4, sep = ' · ') => (list.length > n ? [...list.slice(0, n), `외 ${list.length - n}`] : list).join(sep);
const statePath = (work) => join(work, 'lecpage.state.json');
const loadState = (work) => { try { return JSON.parse(readFileSync(statePath(work), 'utf8')); } catch { return {}; } };
const saveState = (work, s) => writeJson(statePath(work), { ...loadState(work), ...s, updated: new Date().toISOString() });
const ARCH_KO = { story: '강의형', lab: '실습형', live: '행사형', course: '과정형' };
const FLOW_PATH = (f) => E.FLOW_INFO[f]?.path || '';
const ACCESS_KO = { link: '주소를 받은 사람만', public: '누구나(검색 허용)', password: '암호' };

async function ingestCli() { return imp('src/ingest/cli.js'); }
async function ingestApi() { return imp('src/ingest/index.js'); }

/** Playwright: ESM import → NODE_PATH(require) 순서로 찾음. 없으면 null */
async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 아래 */ }
  try { return createRequire(import.meta.url)('playwright'); } catch { return null; }
}

/** 자료 폴더 → 빌드 자료. 설계도는 assets/slides/…·assets/media/…를 가리키므로 앞에 assets/를 맞춰 붙임 */
function assetFiles(dir) {
  const raw = N.readAssetDir(dir, '');
  const out = {};
  for (const [k, v] of Object.entries(raw)) { const key = k.startsWith('assets/') ? k : 'assets/' + k; if (USER_ASSET.test(key)) out[key] = v; }
  return out;
}

/** 빌드해 쓰기. 예전 빌드가 남긴 엔진 파일(꺼진 기능의 화면 등)은 지움(CNAME 같은 남의 파일은 그대로) */
async function buildSite(bp, { out, assets = '', info = null, password = '', fonts = !!args['bundle-fonts'] }) {
  const r = E.build(bp, { runtime: N.nodeRuntime(), assets: assets && existsSync(assets) ? assetFiles(assets) : {}, infra: info && (info.size || info.features) ? info : null });
  if (r.errors.length) return { ok: false, errors: r.errors, warnings: r.warnings };
  const dir = resolve(out);
  password = password || process.env.LECPAGE_PASSWORD || '';
  if (r.blueprint.access.mode === 'password' && !password) return { ok: false, errors: [{ path: 'access', message_ko: '암호 보호 설계도예요. --password 값이나 LECPAGE_PASSWORD 환경 변수를 주세요.' }], warnings: r.warnings };
  let files = r.files;
  // 글꼴 함께 담기(--bundle-fonts): 글꼴 CDN이 막힌 학교망용. 쓰인 글자가 든 글꼴 조각만 assets/fonts/로(쪽을 열 때 외부 요청 0)
  if (fonts) {
    const fb = await E.bundleFonts(files);
    files = fb.files;
    r.warnings.push({ path: 'fonts', message_ko: fb.report.ok ? `글꼴 함께 담기: 외부 글꼴 ${fb.report.external}곳 → 사이트 안 파일 ${fb.report.bundled}개(${Math.round(fb.report.bytes / 1024)}KB)` : `글꼴을 받지 못해 CDN 주소 그대로 뒀어요(${fb.report.skipped.join(', ')})${(process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY ? ' — 프록시를 거치는 곳이면 NODE_USE_ENV_PROXY=1 을 붙여 다시 실행하세요' : ''}` });
    if (fb.report.ok) r.report.sizeKB += Math.round(fb.report.bytes / 1024);
  }
  if (password) {
    const adv = E.passwordAdvice(password);
    if (adv.level !== 'good') r.warnings.push({ path: 'access.password', message_ko: adv.message.replace('[새로 만들기]로 바꾸거나 ', '') });
    const { webcrypto } = await import('node:crypto');
    files = await E.protectSite(files, password, { runtime: N.nodeRuntime(), title: r.blueprint.meta.title, crypto: webcrypto });
  }
  if (existsSync(join(dir, 'assets', 'lecpage.js'))) {
    for (const f of Object.keys(N.readAssetDir(dir, ''))) {
      const engineMade = /^[^/]+\.html$/.test(f) || /^(assets|slides|media)\//.test(f) || ['_headers', 'robots.txt'].includes(f);
      if (engineMade && !(f in files)) rmSync(join(dir, f), { force: true });
    }
  }
  const n = N.writeFiles(dir, files).length;
  const tdir = dir + '-강사용';
  N.writeFiles(tdir, r.teacher);
  for (const f of Object.keys(r.teacher)) rmSync(join(dir, f), { force: true }); // 올리면 공개되는 강사용 파일
  return { ok: true, dir, tdir, files: n, sizeKB: r.report.sizeKB, report: r.report, warnings: r.warnings, access: password ? 'password' : r.blueprint.access.mode, blueprint: r.blueprint, design: r.design };
}

const buildLine = (b) => `사이트 ${rel(b.dir)} (파일 ${b.files}개, ${b.sizeKB}KB) · 디자인 ${b.report.preset} · 움직임 ${b.report.motion} · 참여 기능 ${b.report.live === 'none' ? '없음' : b.report.live} · 공개 ${ACCESS_KO[b.access] || b.access}`;

/** 정적 파일 서버(serve·qa 공용). 폴더 밖으로 나가는 경로와 잘못된 % 는 막음 */
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.enc': 'application/octet-stream' };
function staticServer(dir) {
  return createServer((req, res) => {
    let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end('bad request'); }
    if (p.endsWith('/')) p += 'index.html';
    const f = join(dir, p); const r = relative(dir, f);
    if (r.startsWith('..') || isAbsolute(r) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); createReadStream(f).pipe(res);
  });
}

// ── 점검(qa) ─────────────────────────────────────
/** 사이트 안 상대 주소(src·href·자료 경로)가 실제 파일을 가리키는지 */
function brokenRefs(dir) {
  const bad = new Set();
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.html'))) {
    const html = readFileSync(join(dir, f), 'utf8');
    const refs = [...html.matchAll(/\s(?:src|href)="([^"#?]+)[^"]*"/g)].map((m) => m[1]).filter((u) => !/^(?:[a-z][\w+.-]*:|\/\/|\/)/i.test(u));
    refs.push(...[...html.matchAll(/"((?:assets\/)?(?:slides|media)\/[^"\\]+)"/g)].map((m) => m[1]));
    for (const u of refs) { let p; try { p = decodeURIComponent(u); } catch { p = u; } if (!existsSync(join(dir, p))) bad.add(p); }
  }
  return [...bad];
}

/**
 * 다른 작업이 만드는 검사기. 없으면 건너뜀.
 *   design-lint.mjs: lintPage(page) — 브라우저 화면에서(밝은 화면 PC·휴대폰)
 *   copy-lint.mjs:   lintHtml(html, file) — 만든 페이지 글에서(브라우저 없이도)
 * blocking: 디자인 검사 error는 점검 실패. 문구는 교재 원문이 섞여 있어 알림만
 */
async function loadLinters() {
  const list = [];
  for (const [name, file, blocking] of [['디자인', 'design-lint.mjs', true], ['겹침', 'overlap-lint.mjs', true], ['문구', 'copy-lint.mjs', false]]) {
    const p = join(HERE, file);
    if (!existsSync(p)) { list.push({ name, status: 'missing', issues: [] }); continue; }
    try {
      const mod = await import(pathToFileURL(p).href);
      const page = mod.lintPage || (typeof mod.default === 'function' ? mod.default : null);
      if (page) list.push({ name, page, blocking, status: 'ok', issues: [] });
      else if (mod.lintHtml) list.push({ name, html: mod.lintHtml, blocking, status: 'ok', issues: [] });
      else list.push({ name, status: 'missing', issues: [] });
    } catch (e) { list.push({ name, status: 'error', error: cut(e.message, 80), issues: [] }); }
  }
  return list;
}
function lintIssues(res) {
  const arr = Array.isArray(res) ? res : res?.issues || res?.problems || res?.findings || [];
  return arr.map((x) => (typeof x === 'string' ? { level: 'warn', message: x } : {
    level: /err|high|fail/i.test(x.level || x.severity || '') ? 'error' : 'warn',
    message: x.message_ko || x.message || x.msg || (x.why ? `${x.hit ? `"${cut(x.hit, 24)}" ` : ''}${x.why}${x.fix ? ` → ${x.fix}` : ''}` : x.rule || JSON.stringify(x)),
    where: x.selector || x.where || x.path || '',
  }));
}
const addIssues = (L, list) => { for (const it of list) if (!L.issues.some((x) => x.message === it.message)) L.issues.push(it); };

/** 참가자 첫 화면이 처음 받는 자기 파일(HTML + 연결된 CSS·JS)의 전송 크기(gzip). 목표 200KB */
function firstLoad(dir) {
  try {
    const html = readFileSync(join(dir, 'index.html'));
    const refs = [...String(html).matchAll(/<(?:link[^>]+rel="stylesheet"[^>]+href|script[^>]+src)="([^"#?]+)"/g)].map((m) => m[1]).filter((u) => !/^(https?:)?\/\//.test(u));
    let bytes = gzipSync(html).length; const files = ['index.html'];
    for (const u of new Set(refs)) { const f = join(dir, u); if (existsSync(f)) { bytes += gzipSync(readFileSync(f)).length; files.push(u); } }
    return { kb: Math.round(bytes / 1024), files };
  } catch { return null; }
}

async function runQa(dir, { outDir, password = '' } = {}) {
  dir = resolve(dir);
  if (!existsSync(join(dir, 'index.html'))) return { ok: false, error: `${rel(dir)}에 index.html이 없어요.` };
  outDir = resolve(outDir || join(dir, '..', 'qa'));
  const broken = brokenRefs(dir);
  const res = { ok: true, dir, outDir, views: [], broken, lint: [], shots: [], skipped: '', weight: firstLoad(dir) };
  const protectedSite = /lp-locked|unlock\.js/.test(readFileSync(join(dir, 'index.html'), 'utf8'));
  const unlock = protectedSite && password; // 암호를 알면 #k=로 열어 실제 내용을 점검
  const linters = protectedSite && !unlock ? [] : await loadLinters();
  // 글 검사(브라우저 없이): 참가자·강사가 보는 페이지
  for (const L of linters.filter((x) => x.html && protectedSite)) L.status = 'skipped';
  for (const L of linters.filter((x) => x.html && !protectedSite)) {
    try { for (const f of readdirSync(dir).filter((x) => /^(index|console|screen|check|poster)\.html$/.test(x))) addIssues(L, lintIssues(L.html(readFileSync(join(dir, f), 'utf8'), f))); }
    catch (e) { L.status = 'error'; L.error = cut(e.message, 80); }
  }
  const finish = () => {
    res.lint = linters.map(({ name, status, issues = [], error, blocking }) => ({ name, status, issues, error, blocking: !!blocking }));
    const badViews = res.views.filter((r) => r.errors.length || r.overflow || r.imgsNoAlt || r.h1 !== 1 || r.btnNoName);
    res.ok = !badViews.length && !broken.length && !res.lint.some((l) => l.blocking && l.issues.some((i) => i.level === 'error'));
    if (res.views.length) writeJson(join(outDir, 'report.json'), res);
    return res;
  };
  const pw = await loadPlaywright();
  if (!pw) { res.skipped = 'Playwright 없음'; return finish(); }
  let browser;
  try { browser = await pw.chromium.launch(); } catch { res.skipped = 'Chromium 실행 실패(npx playwright install chromium)'; return finish(); }
  mkdirSync(outDir, { recursive: true });
  // 실제 호스팅처럼 http로 엶(127.0.0.1은 보안 컨텍스트라 암호 풀기·fetch가 동작)
  const server = staticServer(dir);
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}/`;
  // 앱 미리보기 기기와 같은 크기: PC 1280, 태블릿 820×1180, 휴대폰 360×780
  for (const [w, h, name] of [[1280, 860, 'desktop'], [820, 1180, 'tablet'], [360, 780, 'phone']]) {
    for (const scheme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: scheme });
      const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
      await page.goto(base + 'index.html' + (unlock ? '#k=' + encodeURIComponent(password) : ''), { waitUntil: 'load', timeout: 20000 }).catch(() => {});
      if (unlock) await page.waitForSelector('main', { timeout: 15000 }).catch(() => errs.push('암호로 열지 못했어요'));
      await page.waitForTimeout(700);
      const m = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, imgsNoAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).length, h1: document.querySelectorAll('h1').length, btnNoName: [...document.querySelectorAll('button')].filter((b) => !(b.textContent.trim() || b.getAttribute('aria-label') || b.getAttribute('title'))).length }));
      const shot = join(outDir, `${name}-${scheme}.png`);
      await page.screenshot({ path: shot, fullPage: false });
      res.shots.push(shot);
      const v = { view: `${name}-${scheme}`, errors: errs.filter((e) => !/net::ERR|Failed to load resource/.test(e)), ...m };
      if (protectedSite && !unlock) v.h1 = 1; // 잠금 화면은 h1 검사 제외
      res.views.push(v);
      if (scheme === 'light') for (const L of linters.filter((x) => x.page && x.status === 'ok')) {
        try { addIssues(L, lintIssues(await L.page(page, { view: name, dir }))); }
        catch (e) { L.status = 'error'; L.error = cut(e.message, 80); }
      }
      await page.close();
    }
  }
  await browser.close();
  server.close();
  return finish();
}

function qaLines(q) {
  if (q.error) return [`점검 ✕ ${q.error}`];
  const lines = [];
  const problems = [];
  for (const v of q.views) {
    const p = [v.errors.length && `스크립트 오류 ${v.errors.length}(${cut(v.errors[0], 50)})`, v.overflow && '가로 넘침', v.imgsNoAlt && `대체 텍스트 없는 그림 ${v.imgsNoAlt}`, v.h1 !== 1 && `h1 ${v.h1}개`, v.btnNoName && `이름 없는 버튼 ${v.btnNoName}`].filter(Boolean);
    if (p.length) problems.push(`  ${v.view}: ${p.join(', ')}`);
  }
  if (q.broken.length) problems.push(`  깨진 자료 ${q.broken.length}: ${plural(q.broken.map((b) => cut(b, 40)), 3, ', ')}`);
  const missing = q.lint.filter((l) => l.status === 'missing').map((l) => l.name);
  const count = (l) => { const e = l.issues.filter((i) => i.level === 'error').length; return l.issues.length ? `${e ? `고칠 곳 ${e}` : ''}${e && l.issues.length > e ? '·' : ''}${l.issues.length > e ? `살필 곳 ${l.issues.length - e}` : ''}` : '이상 없음'; };
  const lint = [...q.lint.map((l) => (l.status === 'missing' ? '' : l.status === 'skipped' ? `${l.name} 검사 건너뜀(암호 페이지)` : l.status === 'error' ? `${l.name} 검사 실패(${l.error})` : `${l.name} ${count(l)}`)).filter(Boolean), missing.length ? `${missing.join('·')} 검사 없음(건너뜀)` : ''].filter(Boolean);
  const head = q.skipped ? `점검 ${q.broken.length ? '✕' : '△'} 화면 검사 건너뜀(${q.skipped}) · 깨진 자료 ${q.broken.length}` : `점검 ${q.ok ? '✓ 통과' : '✕ 문제 있음'} · ${q.views.length}화면(휴대폰·태블릿·PC × 밝게·어둡게) · 깨진 자료 ${q.broken.length}${lint.length ? ' · ' + lint.join(' · ') : ''}`;
  lines.push(head + (q.weight ? ` · 첫 화면 ${q.weight.kb}KB` : ''), ...problems);
  if (q.weight?.kb > 200) lines.push(`  첫 화면 파일이 ${q.weight.kb}KB예요(목표 200KB). 효과를 줄이거나 움직임을 낮춰 보세요.`);
  // 자세히는 고칠 곳(error)과 디자인 검사만. 문구 '살필 곳'은 개수만(교재 원문이 섞여 있어 참고용, qa/report.json)
  for (const l of q.lint) {
    const shown = l.issues.filter((it) => it.level === 'error' || l.blocking);
    for (const it of shown.slice(0, 3)) lines.push(`  ${l.name} ${it.level === 'error' ? '고침' : '살핌'}: ${cut(it.message, 70)}${it.where ? ` (${cut(it.where, 30)})` : ''}`);
    if (shown.length > 3) lines.push(`  ${l.name} 외 ${shown.length - 3}건(${rel(join(q.outDir, 'report.json'))})`);
  }
  if (q.shots.length) lines.push(`  스크린샷 ${rel(q.outDir)}/*.png ${q.shots.length}장 — 직접 열어 보세요`);
  return lines;
}

// ── 요약(brief) ──────────────────────────────────
const pagesOf = (x) => (x?.refs?.length ? x.refs.map((r) => r.page) : x?.pages?.length ? x.pages : x?.page ? [x.page] : []);
const pg = (list) => { const u = [...new Set(list)].sort((a, b) => a - b); return u.length ? 'p' + (u.length > 4 ? `${u.slice(0, 4).join(',')}…` : u.join(',')) : ''; };

/** 교재 글꼴 한 줄: 교재 제목·본문 글꼴 → 사이트가 쓸 웹 글꼴(엔진 대응표 fontsFromSource) */
function fontLine(src, design = {}) {
  if (design?.fontFrom === 'preset') return '글꼴 프리셋 글꼴(교재 글꼴 안 씀)';
  if (design?.fontPair) return `글꼴 글꼴 짝 ${design.fontPair}`;
  if (!src || !(src.display?.name || src.body?.name)) return '';
  const fm = typeof E.fontsFromSource === 'function' ? E.fontsFromSource(src) : null;
  const groups = new Map();
  for (const role of ['display', 'body']) {
    const name = src[role]?.name; if (!name) continue;
    const m = fm?.match?.[role];
    const to = !m ? '' : m.system ? '프로그램 기본 글꼴이라 프리셋 글꼴' : `${m.label}${m.exact ? '(같은 글꼴)' : '(비슷한 무료 글꼴)'}`;
    const k = name + '|' + to;
    groups.set(k, { name, to, roles: [...(groups.get(k)?.roles || []), role === 'display' ? '제목' : '본문'] });
  }
  return '글꼴 교재 ' + [...groups.values()].map((g) => `${g.name}(${g.roles.join('·')})${g.to ? ' → ' + g.to : ''}`).join(' · ');
}

function briefMaterial(m) {
  const d = m.detected || {};
  const ev = d.event || {};
  const files = (m.files || []).map((f) => `${f.name}(${f.renderOf ? '쪽 그림용' : `${f.pages}${{ slide: '장', page: '쪽', section: '절', link: '' }[f.unit] ?? '쪽'}`})`);
  const st = d.stats || {};
  const renderOnly = new Set((m.files || []).filter((f) => f.renderOf).map((f) => f.id));
  const rendered = (m.pages || []).filter((p) => p.image && !renderOnly.has(p.file)).length;
  const missing = [];
  if (!d.title) missing.push('연수명');
  if (!ev.date) missing.push('날짜');
  if (!ev.start) missing.push('시간');
  if (!ev.venue && ev.mode !== 'online') missing.push('장소');
  if (!d.instructor?.name) missing.push('강사');
  const lines = [
    `교재 ${files.join(' + ')} · 그림 ${st.images ?? 0} · 표 ${st.tables ?? 0} · 노트 ${st.notes ?? 0}${st.hidden ? ` · 숨김 ${st.hidden}` : ''}${rendered ? ` · 쪽 그림 ${rendered}` : ''}`,
    `연수명 ${cut(d.title || '(못 찾음)', 50)}${d.subtitle ? ` / ${cut(d.subtitle, 40)}` : ''}`,
    `일시 ${[ev.date, ev.weekday && `(${ev.weekday})`, ev.start && `${ev.start}${ev.end ? '~' + ev.end : ''}`].filter(Boolean).join(' ') || '?'} · 장소 ${cut(ev.venue || '?', 30)} · 주관 ${cut(ev.organizer || '?', 24)}${ev.page ? ` (p${ev.page})` : ''}`,
    `강사 ${d.instructor?.name ? `${d.instructor.name}${d.instructor.role ? ' ' + cut(d.instructor.role, 20) : ''} (p${d.instructor.page})` : '없음'}`,
    d.sections?.length ? `구성 ${plural(d.sections.map((s) => `${cut(s.title || s.label, 18)}(p${s.page})`), 5)}` : '',
    `실습 ${d.practice ? `${d.practice.count}쪽(${Math.round(d.practice.ratio * 100)}%)` : '0'} · 단계 ${d.steps?.length || 0}묶음 ${pg((d.steps || []).map((s) => s.page))} · 프롬프트 ${d.prompts?.length || 0} ${pg((d.prompts || []).flatMap(pagesOf))} · 링크 ${d.links?.length || 0}`,
    d.tools?.length ? `도구 ${plural(d.tools.map((t) => `${t.name}${pagesOf(t).length ? `(${pg(pagesOf(t))})` : ''}`), 6)}` : '',
    `그 밖 퀴즈 ${d.quiz?.length || 0} · 질문답 ${d.faq?.length || 0} · 용어 ${d.glossary?.length || 0} · 핵심 문장 ${d.messages?.length || 0}`,
    E.foundSummary(d, 8).length ? `찾은 것 ${E.foundSummary(d, 8).join(' · ')}` : '',
    [...(d.addresses?.join || []), ...(d.addresses?.survey || [])].length ? `교재에서 찾은 주소(강사 확인 뒤 info.json에) ${[...(d.addresses.join || []).map((a) => `${a.why} ${a.url} → joinUrl`), ...(d.addresses.survey || []).map((a) => `${a.why} ${a.url} → surveyUrl`)].join(' · ')}` : '',
    d.signals ? (() => { const st = E.decideStructure({}, m); return `구성 ${st.label}(${st.flow}) — ${cut(st.reasons[0] || "", 60)}${st.suggested.length ? ` · 권하는 기능 ${st.suggested.map((x) => x.feature).join(",")}` : ""}`; })() : d.archetype ? `유형 ${ARCH_KO[d.archetype.primary] || d.archetype.primary}(${d.archetype.primary}) — ${cut(d.archetype.reason_ko, 60)}` : "",
    fontLine(d.fonts || (m.design?.fontsUsed?.[0] ? { body: { name: m.design.fontsUsed[0].name } } : null)),
    missing.length ? `빈칸 ${missing.join(', ')} → 강사에게 묻기` : '빈칸 없음',
    ...(m.errors || []).map((e) => `오류 ${e.file ? e.file + ': ' : ''}${cut(e.message_ko, 90)}`),
    ...(m.warnings || []).filter((w) => w.code !== 'python-fallback').map((w) => `알림 ${cut(w.message_ko, 90)}`),
  ];
  return { lines, json: { kind: 'material', files: m.files?.map((f) => ({ id: f.id, name: f.name, type: f.type, pages: f.pages, renderOf: f.renderOf })), title: d.title, event: ev, instructor: d.instructor?.name || '', counts: { prompts: d.prompts?.length || 0, steps: d.steps?.length || 0, tools: d.tools?.length || 0, quiz: d.quiz?.length || 0, practicePages: d.practice?.count || 0, slideImages: rendered }, archetype: d.archetype?.primary, fonts: d.fonts || null, missing, errors: m.errors, warnings: m.warnings } };
}

/** 설계도 빈칸: 사람이 채울 정보(지어내지 않을 것) */
function blueprintGaps(bp, raw = {}) {
  const g = [];
  const m = bp.meta;
  if (!raw.meta?.title) g.push('연수명');
  if (!m.date) g.push('날짜(meta.date)');
  if (!m.start) g.push('시간(meta.start·end)');
  if (!m.venue && m.mode !== 'online') g.push('장소(meta.venue)');
  if (!bp.instructors.length) g.push('강사(instructors)');
  const st = bp.sections.find((s) => s.type === 'stations');
  if (st && st.items.some((i) => !i.source?.pages?.length)) g.push('실습 쪽 번호(source.pages)');
  const live = bp.sections.filter((s) => ['qa', 'board', 'poll', 'attendance'].includes(s.type));
  if (live.length && bp.live.provider === 'none') g.push(`참여 기능 연결(${live.map((s) => s.type).join('·')} → decide-infra)`);
  if (bp.live.provider === 'local') g.push('참여 기능 서버(지금은 한 기기 미리보기 local → decide-infra, 주소는 info.json live로)');
  else if (['supabase', 'sheets', 'http'].includes(bp.live.provider) && !bp.live.url) g.push(`참여 기능 주소(live.url, ${bp.live.provider})`);
  const sv = bp.sections.find((s) => s.type === 'survey');
  if (sv && !sv.url && bp.live.provider === 'none') g.push('설문 주소(survey.url) 또는 참여 기능');
  return g;
}

function briefBlueprint(raw) {
  const { blueprint: bp, errors, warnings } = E.validate(raw);
  const def = E.SECTION_DEFS;
  const secs = bp.sections.map((s) => {
    const list = def[s.type]?.list;
    const n = list && Array.isArray(s[list]) ? s[list].length : null;
    return `${s.id === s.type ? s.id : `${s.id}(${s.type})`}${n !== null ? ' ' + n : ''}`;
  });
  const hidden = (Array.isArray(raw.sections) ? raw.sections : []).filter((s) => s?.hidden).map((s) => s.id || s.type);
  const st = bp.sections.find((s) => s.type === 'stations');
  const m = bp.meta;
  const gaps = blueprintGaps(bp, raw);
  const rd = E.resolveDesign(bp);
  const sr = bp.structure;
  const lo = sr?.leftovers?.count || 0;
  const lines = [
    `설계도 「${cut(m.title, 40)}」 · ${ARCH_KO[bp.archetype.primary]}(${bp.archetype.primary}) · 디자인 ${rd.preset} · 움직임 ${rd.motion} · 공개 ${bp.access.mode} · 참여 ${bp.live.provider}${bp.live.features.length ? `(${bp.live.features.join(',')})` : ''}`,
    `일시 ${[m.date, m.start && `${m.start}~${m.end}`].filter(Boolean).join(' ') || '?'} · 장소 ${cut(m.venue || '?', 30)} · 강사 ${bp.instructors.map((p) => p.name).join(', ') || '?'}`,
    sr ? `구성 ${sr.label}(${sr.flow}) — ${cut(sr.reasons[0] || '', 70)}${sr.suggested.length ? ` · 권하는 기능 ${sr.suggested.map((x) => x.feature).join(',')}` : ''}` : '',
    `칸 ${bp.sections.length}: ${secs.join(' · ')}${hidden.length ? ` | 숨김: ${hidden.join(', ')}` : ''}`,
    lo ? `싣지 못한 것 ${lo}개(교재에 있는데 어느 칸에도 없음): ${plural(sr.leftovers.items.map((x) => `p${x.page} ${cut(x.text, 24)}`), 3, ' / ')} → structure --add-leftovers` : '',
    st ? `실습 ${st.items.map((it, i) => `[${i}]${cut(it.name || it.title, 14)}(단계 ${it.steps.length}·프롬프트 ${it.prompts.length}${it.source?.pages?.length ? '·' + pg(it.source.pages) : ''})`).join(' ')}` : '',
    fontLine(raw.design?.sourceFonts || (raw._draft?.detectedFonts?.[0] ? { body: { name: raw._draft.detectedFonts[0] } } : null), raw.design),
    gaps.length ? `빈칸 ${gaps.join(', ')}` : '빈칸 없음',
    ...errors.map((e) => `오류 ${e.path}: ${cut(e.message_ko, 80)}`),
    warnings.length ? `주의 ${warnings.length}: ${plural(warnings.map((w) => cut(w.message_ko, 60)), 3, ' / ')}` : '',
  ];
  return { lines, json: { kind: 'blueprint', title: m.title, archetype: bp.archetype.primary, structure: sr ? { flow: sr.flow, reasons: sr.reasons, suggested: sr.suggested.map((x) => x.feature), leftovers: lo } : null, preset: bp.design.preset, access: bp.access.mode, live: bp.live.provider, sections: bp.sections.map((s) => { const list = def[s.type]?.list; return { id: s.id, type: s.type, title: s.title, count: list ? s[list]?.length ?? 0 : undefined }; }), hidden, gaps, errors, warnings } };
}

function briefAny(p) {
  let file = resolve(p || 'work');
  if (existsSync(file) && statSync(file).isDirectory()) {
    const c = ['blueprint.json', 'material.json'].map((f) => join(file, f)).find(existsSync);
    if (!c) fail(`${rel(file)}에 blueprint.json·material.json이 없어요.`);
    file = c;
  }
  const data = readJson(file);
  return data?.kind === 'lecpage-material' ? briefMaterial(data) : briefBlueprint(data);
}

/**
 * 교재 반영 점검 한 줄(+빠진 것 3개까지): 교재의 프롬프트·실습 단계·링크·질문답·줄이 설계도의 보이는 칸에 있는지.
 * 엔진이 대조하므로 에이전트는 교재와 사이트를 손으로 맞춰 보지 않습니다.
 */
function coverageLines(work, raw) {
  const mp = join(work, 'material.json');
  if (!existsSync(mp)) return [];
  let c; try { c = E.materialCoverage(JSON.parse(readFileSync(mp, 'utf8')), E.validate(raw).blueprint); } catch { return []; }
  const part = (label, x) => (x.total ? `${label} ${x.total - x.miss.length}/${x.total}` : '');
  const head = [part('프롬프트', c.prompts), part('실습 단계', c.steps), part('링크', c.links), part('질문답', c.faq), c.lines.total ? `교재 줄 ${c.lines.total - c.lines.missing}/${c.lines.total}` : ''].filter(Boolean).join(' · ');
  const miss = [...c.prompts.miss.map((x) => ['프롬프트', x]), ...c.steps.miss.map((x) => ['단계', x]), ...c.links.miss.map((x) => ['링크', x]), ...c.faq.miss.map((x) => ['질문답', x]), ...c.lines.items.map((x) => ['줄', x])];
  return [
    `교재 반영 ${c.missing ? '△' : '✓'} ${head} · ${c.missing ? `빠진 것 ${c.missing}` : '빠진 것 없음(손으로 대조하지 않아도 돼요)'}`,
    ...miss.slice(0, 3).map(([k, x]) => `  빠짐 ${k}${x.page ? ` p${x.page}` : ''} ${x.text}`),
    c.lines.missing ? `  교재 줄 ${c.lines.missing}개는 structure --add-leftovers로 글 칸에 넣을 수 있어요` : '',
    c.held?.length ? `  교재의 접속·설문 주소 ${c.held.length}개는 강사 확인 뒤 info.json(joinUrl·surveyUrl)에: ${plural(c.held.map((u) => cut(u, 40)), 2, ', ')}` : '',
  ];
}

// ── 패치 ─────────────────────────────────────────
/** --set 경로=값 → 패치. 경로: meta.venue, design.preset, sections.<칸 id>.title, sections.stations.items.0.title */
function setToPatch(raw, expr) {
  const i = expr.indexOf('=');
  if (i < 1) fail(`--set은 경로=값 모양이어야 해요: ${expr}`);
  const path = expr.slice(0, i).trim().split('.').filter(Boolean);
  let value = expr.slice(i + 1);
  try { value = JSON.parse(value); } catch { /* 글자 그대로 */ }
  const patch = {};
  if (path[0] === 'sections') {
    if (path.length < 3) fail(`칸은 sections.<칸 id>.<필드> 로 적어 주세요: ${expr}`);
    const [, id, key, ...deeper] = path;
    const sec = E.withSectionIds(raw.sections).find((s) => s?.id === id);
    if (!sec && deeper.length) fail(`"${id}" 칸이 없어요. brief로 칸 id를 확인해 주세요.`);
    patch.sections = { [id]: { [key]: deeper.length ? setDeep(structuredClone(sec[key] ?? {}), deeper, value) : value } };
    return patch;
  }
  // 배열을 만나면 그 배열을 통째로(병합 규칙상 배열은 바꿈) 넣음
  let src = raw, node = patch;
  for (let k = 0; k < path.length; k++) {
    const key = path[k];
    if (k === path.length - 1) { node[key] = value; break; }
    const next = src?.[key];
    if (Array.isArray(next)) { node[key] = setDeep(structuredClone(next), path.slice(k + 1), value); break; }
    node = node[key] = {}; src = next;
  }
  return patch;
}
function setDeep(obj, path, value) {
  let o = obj;
  for (let k = 0; k < path.length - 1; k++) { const key = /^\d+$/.test(path[k]) ? +path[k] : path[k]; if (o[key] === undefined || o[key] === null) o[key] = /^\d+$/.test(path[k + 1]) ? [] : {}; o = o[key]; }
  const last = /^\d+$/.test(path.at(-1)) ? +path.at(-1) : path.at(-1);
  if (value === null && !Array.isArray(o)) delete o[last]; else o[last] = value;
  return obj;
}
function mergePatches(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (k === 'add') out.add = [...(out.add || []), ...[].concat(v)];
    else if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = mergePatches(out[k], v);
    else out[k] = v;
  }
  return out;
}

// ── 앱과 주고받기(app) ─────────────────────────
const NOT_PACKED = '참여 기능 연결·관리자 키·사이트 암호·온라인 접속 주소';
async function toAppFile(P, work) {
  const bpPath = join(work, 'blueprint.json');
  if (!existsSync(bpPath)) fail(`${rel(work)}에 blueprint.json이 없어요. make로 먼저 만들어 주세요.`);
  const raw = readJson(bpPath);
  const v = E.validate(raw);
  if (v.errors.length) fail('설계도 검증 실패: ' + v.errors.map((e) => `${e.path} ${e.message_ko}`).join(' / '));
  const state = loadState(work);
  const infoPath = args.i ? resolve(args.i) : state.info ? resolve(work, state.info) : join(work, 'info.json');
  const info = existsSync(infoPath) ? readJson(infoPath) : {};
  const material = existsSync(join(work, 'material.json')) ? readJson(join(work, 'material.json')) : null;
  const assets = N.readAssetDir(state.assets ? resolve(work, state.assets) : join(work, 'assets'), 'assets/');
  // 교재 원본: make에 준 파일(100MB까지, 앱과 같은 한도). 앱에서 교재를 빼거나 원본을 자료로 올릴 때 씀
  const originals = [], big = [];
  for (const f of state.inputs || []) {
    if (/^https?:/i.test(f) || !existsSync(f) || !statSync(f).isFile()) continue;
    if (statSync(f).size > 100e6) { big.push(basename(f)); continue; }
    originals.push({ name: basename(f), bytes: new Uint8Array(readFileSync(f)) });
  }
  const summary = material ? (await ingestApi()).summarizeMaterial(material) : '';
  // 비밀·접속 주소는 담지 않음: 앱이 열 때도 같은 규칙으로 다시 정리함(sanitizeImported)
  const r = P.packProject({ blueprint: E.sanitizeImported(raw), material, info, assets, originals, summary });
  const out = resolve(args.o || join(dirname(work), P.projectFileName(raw.meta?.title)));
  const zip = E.zipFiles(r.files);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, zip);
  const kb = Math.round(zip.length / 1024);
  const c = r.counts;
  say([
    `앱으로 넘길 파일 ✓ ${rel(out)} (${kb >= 1024 ? (kb / 1024).toFixed(1) + 'MB' : kb + 'KB'})`,
    `담은 것 설계도(칸 ${v.blueprint.sections.length}) · 연수 정보 · ${material ? `교재 해석(${material.pages?.length || 0}쪽)` : '교재 해석 없음'} · 쪽 그림 ${c.slides} · 교재 그림 ${c.media}${c.files ? ` · 자료실 파일 ${c.files}` : ''} · 교재 원본 ${c.originals}`,
    `담지 않은 것 ${NOT_PACKED}(앱에서 다시 정해요)`,
    r.dropped.length || big.length ? `뺀 자료 ${r.dropped.length + big.length}: ${plural([...r.dropped.map((x) => basename(x)), ...big.map((x) => x + '(100MB 넘음)')], 3, ', ')}` : '',
    `강사에게 ${P.APP_URL} 를 열고 [저장한 파일 열기]로 이 파일을 열면 디자인·참여 기능·공개를 화면에서 이어 해요.`,
  ], { ok: true, file: out, kb, counts: c, dropped: [...r.dropped, ...big], app: P.APP_URL });
}

async function fromAppFile(P, file) {
  let u;
  try { u = P.unpackProject(P.readStoredZip(readFileSync(file))); } catch (e) { fail(e.friendly ? e.message : `파일을 읽지 못했어요: ${e.message}`); }
  if (!u.blueprint || typeof u.blueprint !== 'object') fail('설계도가 없는 파일이에요. 앱에서 사이트 초안을 만든 뒤 [파일로 저장]해 주세요.');
  const work = resolve(args.o || 'work');
  if (existsSync(join(work, 'blueprint.json')) && !args.force) fail(`${rel(work)}에 설계도가 이미 있어요. 다른 폴더를 -o로 주거나, 덮어쓰려면 --force를 붙여 주세요.`);
  const bp = E.sanitizeImported(u.blueprint);
  const v = E.validate(bp);
  if (v.errors.length) fail('설계도 검증 실패: ' + v.errors.map((e) => `${e.path} ${e.message_ko}`).join(' / '));
  writeJson(join(work, 'blueprint.json'), bp);
  if (u.material) writeJson(join(work, 'material.json'), u.material);
  writeJson(join(work, 'info.json'), u.info);
  N.writeFiles(work, u.assets);
  const inputs = [];
  for (const o of u.originals) { const f = join(work, 'src', o.file); N.writeFiles(join(work, 'src'), { [o.file]: o.bytes }); inputs.push(f); }
  const out = resolve(dirname(work), 'dist');
  saveState(work, { out: relative(work, out), assets: 'assets', info: 'info.json', blueprint: 'blueprint.json', inputs, from: 'app' });
  const slides = Object.keys(u.assets).filter((k) => k.startsWith('assets/slides/')).length;
  let b = null, skip = '';
  if (bp.access?.mode === 'password' && !args.password && !process.env.LECPAGE_PASSWORD) skip = '암호 보호 연수라 빌드는 건너뜀(--password로 patch 하면 빌드해요)';
  else { b = await buildSite(bp, { out, assets: join(work, 'assets'), info: u.info, password: args.password }); if (!b.ok) { skip = '빌드 못 함: ' + b.errors.map((e) => e.message_ko).join(' '); b = null; } }
  say([
    `앱에서 저장한 연수 ✓ 「${cut(bp.meta?.title || '이름 없음', 40)}」 → ${rel(work)}(설계도·연수 정보·${u.material ? '교재 해석' : '교재 해석 없음'}) · 쪽 그림 ${slides} · 교재 원본 ${inputs.length}${inputs.length ? `(${rel(join(work, 'src'))})` : ''}`,
    `받지 않은 것 ${NOT_PACKED}. 쓰려면 강사에게 다시 받아 ${rel(join(work, 'info.json'))}에 넣어요`,
    b ? buildLine(b) : skip,
    `다음 brief ${rel(work)} · patch ${rel(join(work, 'blueprint.json'))} --set 경로=값`,
  ], { ok: true, work, blueprint: join(work, 'blueprint.json'), slides, originals: inputs, build: b && { dir: b.dir, sizeKB: b.sizeKB }, skipped: skip });
}

// ── 명령 ─────────────────────────────────────────
const helpers = () => ({ args, E, N, rel, fail, say, readJson, writeJson, loadState, saveState, loadPlaywright, staticServer });
const commands = {
  async make() {
    const t0 = Date.now();
    const inputs = args._.map((p) => (/^https?:/i.test(p) ? p : resolve(p)));
    if (!inputs.length) fail('교재 파일을 주세요. 예: lecpage.mjs make 교재.pptx 교재.pdf -o dist');
    const out = resolve(args.o || 'dist');
    const work = resolve(args.work || join(dirname(out), 'work'));
    const material = join(work, 'material.json'), draftPath = join(work, 'draft.json'), bpPath = join(work, 'blueprint.json'), assets = join(work, 'assets');
    mkdirSync(work, { recursive: true });
    const state = loadState(work);
    const steps = [];

    // 1) 교재 해석(같은 파일이면 지난 결과를 다시 씀: 쪽 그림 만들기가 가장 느림)
    const key = JSON.stringify([inputs.map((p) => { try { const s = statSync(p); return [p, s.size, Math.round(s.mtimeMs)]; } catch { return [p]; } }), !args['no-slides'], args.today || '', E.VERSION]);
    let m;
    if (!args.reingest && state.ingestKey === key && existsSync(material)) { m = readJson(material); steps.push('교재 해석: 지난 결과 재사용(교재가 바뀌면 다시 읽음)'); }
    else {
      const C = await ingestCli();
      m = await C.ingestPaths(inputs, { withImages: true, today: args.today || undefined, python: !args['no-python'] });
      if (m.pages.length && !args['no-slides']) await C.attachSlides(m, join(assets, 'slides'), material);
      await C.writeMaterial(m, material, { imagesDir: join(assets, 'media') });
      m = readJson(material);
      saveState(work, { ingestKey: key });
    }
    if (!m.pages?.length) fail('교재에서 읽은 내용이 없어요. ' + (m.errors || []).map((e) => e.message_ko).join(' '), { errors: m.errors });

    // 2) 초안과 설계도(이미 고친 설계도가 있으면 지키고, --fresh면 새로)
    const info = args.i ? readJson(args.i) : {};
    const api = await ingestApi();
    // 인터뷰 답 → 초안 입력(엔진 intake.js, 앱과 같은 규칙). 쪽 그림·그림 경로는 교재 해석이 적어 둔 것을 씀
    const draft = api.materialToDraft(m, { ...E.draftInfo({ ...info, archetype: info.archetype || E.archetypeFor(info, m) || undefined, today: args.today || undefined }, false), imageBase: undefined });
    writeJson(draftPath, draft);
    let raw, kept = false;
    if (existsSync(bpPath) && !args.fresh) { raw = readJson(bpPath); kept = true; } else raw = E.applyInfo(draft, info, m, null);
    if (args.preset) { raw.design = { ...(raw.design || {}), preset: args.preset }; delete raw._presetAuto; }
    E.applyTeacherValues(raw, info, { access: args.access, password: args.password });
    writeJson(bpPath, raw);

    // 3) 검증·빌드
    const v = E.validate(raw);
    if (v.errors.length) fail('설계도 검증 실패: ' + v.errors.map((e) => `${e.path} ${e.message_ko}`).join(' / '));
    const fonts = !!args["bundle-fonts"] || !!loadState(work).bundleFonts;
    const b = await buildSite(raw, { out, assets, info: Object.keys(info).length ? info : null, password: args.password, fonts });
    if (!b.ok) fail(b.errors.map((e) => e.message_ko).join(' '));
    // 경로는 work 기준 상대 경로로(work 폴더를 복사해 patch해도 원래 폴더의 dist를 덮어쓰지 않게). 글꼴 함께 담기는 다시 만들 때도 이어짐
    saveState(work, { out: relative(work, out), assets: relative(work, assets), info: args.i ? relative(work, resolve(args.i)) : '', blueprint: 'blueprint.json', inputs, ...(fonts ? { bundleFonts: true } : {}) });

    // 4) 점검
    const q = args['no-qa'] ? null : await runQa(out, { outDir: join(dirname(out), 'qa'), password: args.password || process.env.LECPAGE_PASSWORD || '' });
    const bm = briefMaterial(m), bb = briefBlueprint(raw);
    const sec = ((Date.now() - t0) / 1000).toFixed(0);
    const base = dirname(out);
    const sh = (p) => { const r = relative(base, p); return r && !r.startsWith('..') && !isAbsolute(r) ? r : p; };
    const bpShort = sh(bpPath);
    const lines = [
      `lecpage make ${q && !q.ok ? '△' : '✓'} ${sec}초 · 폴더 ${rel(base)}: ${sh(out)}(올릴 사이트) · ${sh(b.tdir)}(강사용, 올리지 않음) · ${sh(work)}(설계도·교재 해석)${q && q.shots.length ? ` · ${sh(q.outDir)}(스크린샷)` : ''}`,
      ...steps,
      bm.lines[0], bm.lines[5],
      kept ? `${bpShort}: 기존 설계도를 지켰어요(새 초안은 draft.json, 새 초안으로 바꾸려면 --fresh)` : '',
      ...bb.lines.filter((l) => !l.startsWith('싣지 못한 것')),
      ...coverageLines(work, raw),
      buildLine(b).replace(rel(b.dir), sh(b.dir)),
      ...(q ? qaLines(q).filter((l) => !l.includes('스크린샷')) : ['점검 건너뜀(--no-qa)']),
      `다음${rel(base) === '.' ? '' : `(${rel(base)} 폴더에서)`} 내용 확인 → patch ${bpShort} --set 경로=값 · 디자인 비교 options ${bpShort} · 미리보기 serve ${sh(out)}`,
    ];
    say(lines, { ok: !q || q.ok, seconds: +sec, work, blueprint: bpPath, kept, material: bm.json, brief: bb.json, build: { dir: b.dir, teacherDir: b.tdir, files: b.files, sizeKB: b.sizeKB, ...b.report }, qa: q });
    process.exitCode = q && !q.ok ? 1 : 0;
  },

  brief() { const r = briefAny(args._[0]); say(r.lines, r.json); },

  /** 구성 정하기: 교재 신호(+ info.json 형식·컨셉) → 흐름·칸 순서·이유·권하는 기능·싣지 못한 것. --add-leftovers면 그것을 글 칸으로 넣는 패치를 씀 */
  async structure() {
    let p = resolve(args._[0] || 'work');
    const dir = existsSync(p) && statSync(p).isDirectory() ? p : dirname(p);
    const bpPath = existsSync(p) && !statSync(p).isDirectory() && !/material\.json$/.test(p) ? p : join(dir, 'blueprint.json');
    const matPath = /material\.json$/.test(p) ? p : join(dir, 'material.json');
    if (!existsSync(matPath)) fail(`${rel(matPath)}가 없어요. make로 교재를 먼저 읽어 주세요.`);
    const m = readJson(matPath);
    const info = args.i ? readJson(args.i) : {};
    const raw = existsSync(bpPath) ? readJson(bpPath) : null;
    const api = await ingestApi();
    const bp = raw ? E.validate(raw).blueprint : E.validate(api.materialToDraft(m, E.draftInfo({ ...info, today: args.today || undefined }, false))).blueprint;
    const st = E.structureFor(bp, info, m, E.findLeftovers(m, bp, { max: 40 }));
    const kept = raw && bp.structure ? bp.structure : null;
    const order = bp.sections.filter((s) => !s.hidden).map((s) => s.type);
    const lines = [
      `흐름 ${st.label}(${st.flow})${kept && kept.flow !== st.flow ? ` · 설계도에는 ${kept.label}(${kept.flow})` : ''} — ${FLOW_PATH(st.flow)}`,
      ...st.reasons.map((r) => '이유 ' + r),
      `찾은 것 ${E.foundSummary(m.detected || {}, 10).join(' · ') || '없음'}`,
      `칸 순서 ${order.join(' > ')}`,
      st.suggested.length ? `권하는 기능(강사가 고르면 켬: info.json features) ${st.suggested.map((x) => `${x.feature} ${x.label} — ${cut(x.reason, 50)}`).join(' / ')}` : '권하는 기능 없음',
      st.leftovers.count ? `싣지 못한 것 ${st.leftovers.count}개: ${plural(st.leftovers.items.map((x) => `p${x.page} ${cut(x.text, 30)}`), 5, ' / ')}` : '싣지 못한 것 없음',
    ];
    let patchFile = '';
    if (args['add-leftovers'] && st.leftovers.count) {
      const add = E.leftoverAdds(bp, st.leftovers); // 교재 순서 자리(그 쪽 앞의 마지막 본문 칸 뒤)
      patchFile = join(dir, 'leftovers.patch.json');
      writeJson(patchFile, { note: '교재에 있는데 싣지 못한 것을 글 칸으로', add });
      lines.push(`패치 → ${rel(patchFile)} (글 칸 ${add.length}개). 넣으려면 patch ${rel(bpPath)} ${rel(patchFile)}`);
    }
    say(lines, { ok: true, ...st, order, found: E.foundSummary(m.detected || {}, 10), patch: patchFile || undefined });
  },

  async patch() {
    const bpPath = resolve(args._[0] || 'work/blueprint.json');
    const prev = bpPath.replace(/\.json$/, '') + '.prev.json';
    const work = dirname(bpPath);
    const state = loadState(work);
    let undoFrom = null;
    if (args.undo) {
      if (!existsSync(prev)) fail('되돌릴 이전 판이 없어요.');
      undoFrom = readJson(bpPath);
      const cur = readFileSync(bpPath, 'utf8'); copyFileSync(prev, bpPath); writeFileSync(prev, cur);
    }
    const before = readJson(bpPath);
    let patch = {};
    if (!args.undo) {
      const src = args._[1];
      if (src) patch = src.trim().startsWith('{') ? (() => { try { return JSON.parse(src); } catch (e) { fail('패치 JSON을 읽지 못했어요: ' + e.message); } })() : readJson(src);
      for (const s of args.set) patch = mergePatches(patch, setToPatch(before, s));
      if (!src && !args.set.length && !args.i) fail('고칠 내용을 주세요: patch.json 파일, \'{"meta":{…}}\', 또는 --set 경로=값');
    }
    const r = E.applyBlueprintPatch(before, patch);
    if (args.i) { const info = readJson(args.i); r.raw = E.applyTeacherValues(E.syncInfo(r.raw, info), info, { access: args.access }); }
    const final = args.i ? E.validate(r.raw) : { errors: r.errors, warnings: r.warnings.filter((w) => w.kind !== 'patch') };
    const pw = r.warnings.filter((w) => w.kind === 'patch');
    if (final.errors.length) fail('검증 실패로 저장하지 않았어요: ' + final.errors.map((e) => `${e.path} ${e.message_ko}`).join(' / '), { warnings: pw });
    const changes = E.diffSummary(undoFrom || before, r.raw);
    if (!args.undo && changes.length) { writeFileSync(prev, readFileSync(bpPath)); writeJson(bpPath, r.raw); }
    const out = args.o ? resolve(args.o) : state.out ? resolve(work, state.out) : '';
    let b = null, q = null, skip = '';
    if (!changes.length) skip = '바뀐 것이 없어 다시 빌드하지 않았어요.';
    else if (args['no-build']) skip = '빌드 건너뜀(--no-build)';
    else if (!out) skip = '빌드할 곳을 모름: -o dist 를 붙이면 다시 빌드해요.';
    else {
      b = await buildSite(r.raw, { out, assets: state.assets ? resolve(work, state.assets) : join(work, 'assets'), info: state.info && existsSync(resolve(work, state.info)) ? readJson(resolve(work, state.info)) : null, password: args.password, fonts: !!args['bundle-fonts'] || !!state.bundleFonts });
      if (!b.ok) { skip = '빌드 못 함: ' + b.errors.map((e) => e.message_ko).join(' '); b = null; }
      else if (args.qa) q = await runQa(out, { password: args.password || process.env.LECPAGE_PASSWORD || '' });
    }
    const lines = [
      `${args.undo ? '되돌림' : '고침'} ${changes.length}건 → ${rel(bpPath)}${changes.length && !args.undo ? ` (이전 판 ${basename(prev)}, --undo로 되돌리기)` : ''}${r.note ? ` · ${r.note}` : ''}`,
      ...changes.map((c) => '- ' + c),
      ...pw.map((w) => `주의 ${w.message_ko}`),
      `검증 ✓${final.warnings.length ? ` (주의 ${final.warnings.length}: ${plural(final.warnings.map((w) => cut(w.message_ko, 50)), 2, ' / ')})` : ''}`,
      b ? buildLine(b) : skip,
      ...(changes.length ? coverageLines(work, r.raw) : []),
      ...(q ? qaLines(q) : []),
    ];
    say(lines, { ok: true, blueprint: bpPath, changes, note: r.note, patchWarnings: pw, warnings: final.warnings, build: b && { dir: b.dir, sizeKB: b.sizeKB, ...b.report }, skipped: skip, qa: q });
  },

  async options() {
    const bpPath = resolve(args._[0] || 'work/blueprint.json');
    const raw = readJson(bpPath);
    const work = dirname(bpPath);
    const state = loadState(work);
    const { blueprint: bp } = E.validate(raw);
    const topics = bp.design.topics.length ? bp.design.topics : E.detectTopics(bp.meta.title + ' ' + bp.meta.subtitle);
    // --mood calm,bold: 강사가 말한 느낌으로 순위를 바로 매김(설계도를 먼저 고치지 않아도 됨)
    const moods = args.mood ? String(args.mood).split(',').map((s) => s.trim()).filter(Boolean) : bp.design.mood.length ? bp.design.mood : E.moodsForTopics(topics);
    const ranked = E.rankPresets({ moods, topics, archetype: bp.archetype.primary, admin: bp.meta.admin.kind, minor: bp.audience.minor }, E.PRESETS.length);
    const ids = args.presets ? String(args.presets).split(',').map((s) => s.trim()).filter((id) => E.PRESET_IDS.includes(id)) : ranked.slice(0, 3).map((r) => r.id);
    if (!ids.length) fail(`프리셋 이름을 확인해 주세요: ${E.PRESET_IDS.join(', ')}`);
    const outDir = resolve(args.o || join(work, 'options'));
    const assets = args.assets || (state.assets ? resolve(work, state.assets) : join(work, 'assets'));
    const results = [];
    for (const id of ids) {
      const v = structuredClone(raw);
      v.design = { ...(v.design || {}), preset: id };
      if (!args['keep-design']) for (const k of ['effects', 'signature', 'graphic', 'closingGraphic', 'palette', 'fontPair']) delete v.design[k];
      v.access = { mode: 'link' }; // 미리보기는 잠그지 않음
      const b = await buildSite(v, { out: join(outDir, id), assets });
      if (!b.ok) { results.push({ id, error: b.errors.map((e) => e.message_ko).join(' ') }); continue; }
      rmSync(b.tdir, { recursive: true, force: true });
      const p = E.getPreset(id); const rk = ranked.find((r) => r.id === id);
      results.push({ id, name: p.name_ko, desc: p.desc_ko, why: rk?.why || [], score: rk?.score ?? 0, motion: b.report.motion, signature: b.design.signature || '', effects: b.report.effects, dir: b.dir });
    }
    // 비교 그림 한 장: 안마다 PC 첫 화면·PC 본문·휴대폰 첫 화면
    let sheet = '', skipped = '';
    const pw = await loadPlaywright();
    let browser = null;
    if (pw) { try { browser = await pw.chromium.launch(); } catch { skipped = 'Chromium 실행 실패(npx playwright install chromium)'; } } else skipped = 'Playwright 없음(doctor 참고)';
    if (browser) {
      for (const r of results.filter((x) => !x.error)) {
        const url = pathToFileURL(join(r.dir, 'index.html')).href;
        for (const [w, h, name, scroll] of [[1280, 800, 'pc', false], [1280, 800, 'pc2', true], [360, 780, 'phone', false]]) {
          const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
          await page.goto(url, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
          if (scroll) await page.evaluate(() => { const s = document.querySelectorAll('main > section, main section.lp-sec'); (s[2] || s[1])?.scrollIntoView(); });
          await page.waitForTimeout(500);
          r[name] = join(r.dir, `..`, `${r.id}-${name}.png`);
          await page.screenshot({ path: r[name] });
          await page.close();
        }
      }
      const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const cols = results.filter((x) => !x.error && x.pc).map((r, i) => `<figure><figcaption><b>${i + 1}</b> ${esc(r.name)} <code>${esc(r.id)}</code></figcaption><img src="${basename(r.pc)}"><div class="row"><img class="ph" src="${basename(r.phone)}"><img class="p2" src="${basename(r.pc2)}"></div></figure>`).join('');
      const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#e9e9ee;font:15px/1.4 system-ui,sans-serif;display:flex;gap:16px;width:max-content}figure{margin:0;width:500px;background:#fff;border-radius:10px;padding:10px;box-shadow:0 1px 3px #0002}figcaption{margin:0 0 8px;font-size:17px}figcaption b{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#111;color:#fff;margin-right:4px}code{color:#555;font-size:13px}img{display:block;width:100%;border:1px solid #ddd;border-radius:6px}.row{display:flex;gap:8px;margin-top:8px;align-items:flex-start}.ph{width:150px}.p2{flex:1;width:auto;min-width:0}</style>${cols}`;
      const htmlPath = join(outDir, 'contact-sheet.html');
      writeFileSync(htmlPath, html);
      const page = await browser.newPage({ viewport: { width: 1600, height: 300 }, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
      sheet = join(outDir, 'contact-sheet.png');
      await page.screenshot({ path: sheet, fullPage: true });
      await page.close(); await browser.close();
    }
    const fl = fontLine(raw.design?.sourceFonts, raw.design);
    const lines = [
      `디자인 ${results.length}안${sheet ? ` → ${rel(sheet)} (한 장에 PC·본문·휴대폰)` : ` (비교 그림 건너뜀: ${skipped})`}`,
      ...results.map((r, i) => (r.error ? `${i + 1} ${r.id} ✕ ${r.error}` : `${i + 1} ${r.id} ${r.name} — ${cut(r.desc, 34)} · ${r.why.length ? r.why.join('·') : '기본 추천'} · 움직임 ${r.motion}${r.signature ? ` · 대표 효과 ${r.signature}` : ''}`)),
      fl && fl.startsWith('글꼴 교재') ? `${fl.replace('글꼴 교재', '글꼴 세 안 모두 교재를 따름:')} (끄기: --set design.fontFrom=preset)` : fl,
      `고르면 patch ${rel(bpPath)} --set design.preset=<id> · 각 안 미리보기 ${rel(outDir)}/<id>/index.html`,
    ];
    say(lines, { ok: true, sheet, skipped, options: results.map(({ pc, pc2, phone, ...r }) => ({ ...r, shots: { pc, pc2, phone } })) });
  },

  /** 앱(웹)과 주고받기: 작업 폴더 → <연수 이름>.lecpage(앱 [저장한 파일 열기]), 앱에서 저장한 .lecpage → 작업 폴더 */
  async app() {
    const P = await imp('src/project-file.js');
    const src = resolve(args._[0] || 'work');
    if (!existsSync(src)) fail(`${rel(src)}가 없어요. make로 만든 작업 폴더(work)나 앱에서 저장한 .lecpage 파일을 주세요.`);
    return statSync(src).isFile() && !/\.json$/i.test(src) ? fromAppFile(P, src) : toAppFile(P, statSync(src).isFile() ? dirname(src) : src);
  },

  /** 만든 사이트를 띄우고 '수정 요청'(펜·네모로 표시 + 글)을 work/feedback/에 모음. AI는 그 파일을 읽고 patch로 고침 */
  async review() { const { startReviewServer } = await import('./review-server.mjs'); await startReviewServer(resolve(args._[0] || 'dist'), { port: +args.port || 4180, out: args.out }); },
  async doctor() {
    const has = (bin) => spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8' }).status === 0;
    const os = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'win' : 'linux';
    const fix = (o) => o[os] || o.linux;
    const checks = [];
    const major = +process.versions.node.split('.')[0];
    checks.push({ name: 'Node.js', ok: major >= 22, need: true, info: process.versions.node, use: '모든 명령', fix: fix({ linux: 'nvm install 22 (또는 https://nodejs.org)', mac: 'brew install node@22', win: 'winget install OpenJS.NodeJS.LTS' }) });
    const pw = await loadPlaywright();
    let chromium = false;
    if (pw) { try { const p = pw.chromium.executablePath(); chromium = !!p && existsSync(p); } catch { chromium = false; } }
    checks.push({ name: 'Playwright', ok: !!pw && chromium, info: pw ? (chromium ? 'chromium 있음' : 'chromium 없음') : '', use: '점검(qa)·디자인 비교(options)', fix: pw ? 'npx playwright install chromium' : 'npm i -D playwright && npx playwright install chromium' });
    const soffice = has('soffice') || has('libreoffice') || existsSync('/Applications/LibreOffice.app/Contents/MacOS/soffice');
    checks.push({ name: 'LibreOffice', ok: soffice, use: 'PPTX·HWPX·DOCX 쪽 그림(PDF를 함께 주면 없어도 됨)', fix: fix({ linux: 'sudo apt-get install -y libreoffice-impress', mac: 'brew install --cask libreoffice', win: 'winget install TheDocumentFoundation.LibreOffice' }) });
    checks.push({ name: 'pdftoppm', ok: has('pdftoppm'), use: '쪽 그림(교재 보기)', fix: fix({ linux: 'sudo apt-get install -y poppler-utils', mac: 'brew install poppler', win: 'winget install oschwartz10612.Poppler' }) });
    checks.push({ name: 'cwebp', ok: has('cwebp'), use: '쪽 그림 용량 줄이기(없으면 PNG)', fix: fix({ linux: 'sudo apt-get install -y webp', mac: 'brew install webp', win: 'winget install Google.Libwebp' }) });
    const py = spawnSync('python3', ['-c', 'import pymupdf'], { encoding: 'utf8' }).status === 0 || spawnSync('python3', ['-c', 'import fitz'], { encoding: 'utf8' }).status === 0;
    let pdfjs = false; try { createRequire(import.meta.url).resolve('pdfjs-dist/package.json'); pdfjs = true; } catch { /* 없음 */ }
    checks.push({ name: 'PDF 읽기', ok: py || pdfjs, info: pdfjs ? 'pdfjs-dist' : py ? 'PyMuPDF' : '', use: 'PDF 교재 글 읽기', fix: 'pip install pymupdf (또는 npm i pdfjs-dist)' });
    if (os !== 'win' && has('fc-list')) {
      const ko = spawnSync('fc-list', [':lang=ko', 'family'], { encoding: 'utf8' }).stdout?.trim().split('\n').filter(Boolean).length || 0;
      checks.push({ name: '한글 글꼴', ok: ko > 0, info: ko ? `${ko}종` : '', use: '쪽 그림의 한글이 깨지지 않게', fix: fix({ linux: 'sudo apt-get install -y fonts-noto-cjk fonts-nanum', mac: '기본 포함' }) });
    }
    const lines = checks.map((c) => `${c.ok ? '✓' : c.need ? '✕' : '–'} ${c.name}${c.info ? ` ${c.info}` : ''}${c.ok ? '' : ` — ${c.use}: ${c.fix}`}`);
    const missing = checks.filter((c) => !c.ok);
    lines.push(missing.some((c) => c.need) ? '필수 도구가 없어요. 위 명령으로 설치해 주세요.' : missing.length ? '만들기는 돼요. – 표시는 그 기능만 건너뛰어요.' : '모두 준비됐어요.');
    say(lines, { ok: !missing.some((c) => c.need), checks });
    process.exitCode = missing.some((c) => c.need) ? 1 : 0;
  },

  presets() {
    if (JSON_OUT) return say([], E.PRESETS.map((p) => ({ id: p.id, name: p.name_ko, desc: p.desc_ko, moods: p.moods, topics: p.topics, motion: p.motion, layout: p.layout || 'left', showcase: !!p.showcase })));
    for (const p of E.PRESETS) console.log(`${p.id.padEnd(15)} ${p.name_ko} — ${p.desc_ko} [${E.LAYOUT_KO[p.layout] || '왼쪽 정렬'} · ${p.moods.join(',')} · ${p.topics.join(',')} · 움직임 ${p.motion}]`);
  },
  effects() {
    if (JSON_OUT) return say([], E.FX.map((f) => ({ id: f.id, level: f.level, name: f.name_ko, slots: f.slots, libs: f.libs })));
    for (const f of E.FX) console.log(`${String(f.id).padEnd(20)} L${f.level} ${f.name_ko}  [${(f.slots || []).join(', ')}]${f.libs?.length ? ' (외부 라이브러리)' : ''}`);
  },

  async draft() {
    const api = await ingestApi();
    const material = readJson(args._[0]); const info = args.i ? readJson(args.i) : {};
    const d = api.materialToDraft(material, info);
    const o = args.o || 'draft.json'; writeJson(o, d);
    say([`초안 → ${rel(resolve(o))} · 칸 ${d.sections.length}`, d._draft?.todo?.length ? `빈칸 ${d._draft.todo.join(' ')}` : ''], { ok: true, file: resolve(o), sections: d.sections.length, todo: d._draft?.todo || [] });
  },
  async prompt() {
    const api = await ingestApi();
    const material = args._[0] ? readJson(args._[0]) : null; const info = args.i ? readJson(args.i) : {};
    const context = material ? api.materialToAIContext(material, { maxChars: 60000 }) : '';
    const draft = material ? api.materialToDraft(material, info) : null;
    const text = E.buildPrompt({ context, info, draft, material });
    if (!args.o) return console.log(text);
    writeFileSync(args.o, text); say([`프롬프트 → ${args.o} (${text.length}자)`], { ok: true, file: resolve(args.o), chars: text.length });
  },

  /** AI 답(설계도 JSON 또는 챗봇 답 글)을 교재 초안과 견줘 교재 글을 지킴(교재 지킴이) */
  async guard() {
    const api = await ingestApi();
    const text = readFileSync(args._[0], 'utf8');
    const read = E.readAnswer(text);
    if (read.kind !== 'ok') { say([`AI 답을 읽지 못했어요(${read.kind}).`], { ok: false, kind: read.kind }); process.exit(1); }
    const material = readJson(args._[1]); const info = args.i ? readJson(args.i) : {};
    const draft = api.materialToDraft(material, E.draftInfo(info));
    const { blueprint, restored } = E.guardMaterial(read.json, draft, { material, allowUrls: [info.joinUrl, info.surveyUrl].filter(Boolean) });
    const bp = E.keepDraftParts(blueprint, draft);
    const o = args.o || 'blueprint.json'; writeJson(o, bp);
    say([`교재 지킴이 → ${rel(resolve(o))} · 되돌린 곳 ${E.restoredCount(restored)}${restored.length > E.restoredCount(restored) ? `(채운 목록 ${restored.length - E.restoredCount(restored)})` : ''}`,
      ...restored.filter((r) => !r.quiet).slice(0, 12).map((r) => `- ${r.where}: ${cut(r.before || '(없음)', 40)} → ${cut(r.after || '(뺌)', 40)}`)],
    { ok: true, file: resolve(o), restored });
  },

  validate() {
    const r = E.validate(readJson(args._[0]));
    if (args.o) writeJson(args.o, r.blueprint);
    const lines = [r.errors.length ? `검증 ✕ 오류 ${r.errors.length}` : `검증 ✓ 칸 ${r.blueprint.sections.length}${r.warnings.length ? ` · 주의 ${r.warnings.length}` : ''}`,
      ...r.errors.map((e) => `오류 ${e.path}: ${e.message_ko}`), ...r.warnings.slice(0, 8).map((w) => `주의 ${w.path}: ${w.message_ko}`), r.warnings.length > 8 ? `주의 외 ${r.warnings.length - 8}건(--json)` : ''];
    say(lines, { ok: !r.errors.length, errors: r.errors, warnings: r.warnings, sections: r.blueprint.sections.length });
    process.exit(r.errors.length ? 1 : 0);
  },

  decideInfra() {
    const info = args.i ? readJson(args.i) : { size: +args.size || 30, features: String(args.features || '').split(',').filter(Boolean), skill: args.skill || 'click', duration: args.duration || 'day', network: args.network || 'good', infra: String(args.infra || '').split(',').filter(Boolean), commercial: !!args.commercial, minor: !!args.minor };
    const r = E.decideInfra(info);
    // 맨 앞 올릴 곳의 한 줄 명령·안내 파일과 백엔드 만드는 안내(skill 폴더 기준 경로)
    const GUIDE = { vercel: 'vercel', cloudflare: 'cloudflare', onpod: 'onpod', 'github-pages': 'github-pages', netlify: 'netlify', firebase: 'firebase', s3: 'aws-s3-cloudfront', server: 'own-server-nginx-caddy', lan: 'local-lan-classroom', zip: 'zip-usb-offline' };
    const BACKEND = { sheets: 'apps-script', supabase: 'supabase', cloudflare: 'cloudflare', server: 'node-server', lan: 'node-server' };
    const top = r.hostInfo[0];
    // publish가 대신 올리는 곳(Cloudflare·Onpod)은 그 명령을, 나머지는 한 줄 명령과 안내 파일
    const how = top ? (['cloudflare', 'onpod'].includes(top.id) ? `publish work${top.id === 'onpod' ? ' --host onpod' : ''} (먼저 --dry-run) · references/deploy/${top.id}.md` : [top.cli, GUIDE[top.id] && `references/deploy/${GUIDE[top.id]}.md`].filter(Boolean).join(' · ')) : '';
    say([
      `추천 ${r.backendInfo.name_ko}(${r.backend}, ${r.backendInfo.cost}${r.teacherSteps != null && r.backend !== 'none' ? `, 강사가 할 일 약 ${r.teacherSteps}번` : ''}) × 올릴 곳 ${r.hostInfo.map((h) => `${h.name_ko}(${h.id})`).join(' · ')}${r.hostSteps === 0 ? ' (첫째 곳은 이미 연결돼 강사가 더 할 일 없음)' : r.hostSteps != null ? ` (첫째 곳 강사가 할 일 약 ${r.hostSteps}번)` : ''}`,
      ...r.reasons.map((x) => '이유 ' + x), ...r.hostReasons.map((x) => '이유(올릴 곳) ' + x),
      how ? `올리기 ${how}` : '',
      // 무료 한도를 넘으면 어떻게 되는지(멈추는지, 유료로 이어지는지). 강사에게 한 줄로 전하고 고르게 함
      [top?.atLimit_ko && `${top.name_ko}: ${top.atLimit_ko}`, r.backendInfo.atLimit_ko && `${r.backendInfo.name_ko}: ${r.backendInfo.atLimit_ko}`].filter(Boolean).map((x) => '한도 ' + x).join('\n'),
      ...r.warnings.map((x) => '주의 ' + x),
      r.alternatives.length ? `대안 ${r.alternatives.join(', ')}` : '',
      r.backend === 'cloudflare' && top?.id === 'cloudflare' ? `한 번에 publish work --live --features ${(info.features || []).join(',') || 'qa,poll'} (먼저 --dry-run)` : `설계도 live.provider=${r.liveProvider}${BACKEND[r.backend] ? ` · 만들기 backends/${BACKEND[r.backend]}/README.md · 주소·키는 info.json의 live로` : ''}`,
    ], r);
  },

  design() {
    const { blueprint: bp } = E.validate(readJson(args._[0]));
    const ranked = E.rankPresets({ moods: bp.design.mood, topics: bp.design.topics.length ? bp.design.topics : E.detectTopics(bp.meta.title + ' ' + bp.meta.subtitle), archetype: bp.archetype.primary, admin: bp.meta.admin.kind, minor: bp.audience.minor });
    const d = E.resolveDesign(bp);
    // 컨셉 먼저: 설계도에 concept가 있으면 그것을, 없으면 주제에서 규칙으로 세운 것을 보여 줌(고치려면 patch --set concept.idea=… 등)
    const concept = bp.concept || E.deriveConcept({ title: bp.meta.title, subtitle: bp.meta.subtitle, topics: bp.design.topics, archetype: bp.archetype.primary, admin: bp.meta.admin.kind });
    say([`컨셉${bp.concept ? '' : '(설계도에 없어 주제에서 세움)'} ${concept.idea}`, `  모티프 ${concept.motif || '없음'} · 권하는 디자인 ${concept.preset || '없음'}${concept.sections?.length ? ` · 어울리는 칸 ${concept.sections.join(',')}` : ''}${concept.features?.length ? ` · 참여 기능 ${concept.features.join(',')}` : ''}`, concept.why ? `  근거 ${concept.why}` : '',
      ...ranked.map((r, i) => `${i + 1} ${r.id} ${r.name_ko} — ${r.why.join('·') || '기본'}`),
      `적용 ${d.preset} · 움직임 ${d.motion}${d.signature ? ` · 대표 효과 ${d.signature}` : ''} · 효과 ${Object.entries(d.effects).map(([k, v]) => `${k}=${v}`).join(', ')}`,
      ...d._notes.map((n) => '메모 ' + n)], { concept, ranked, resolved: d });
  },

  async build() {
    if (!args._[0]) fail('설계도 파일을 지정해 주세요.');
    const b = await buildSite(readJson(args._[0]), { out: args.o || 'dist', assets: args.assets ? resolve(args.assets) : '', info: args.i ? readJson(args.i) : null, password: args.password });
    if (!b.ok) { say([...b.warnings.map((w) => `주의 ${w.path}: ${w.message_ko}`), ...b.errors.map((e) => `오류 ${e.path}: ${e.message_ko}`)], { ok: false, errors: b.errors, warnings: b.warnings }); process.exit(1); }
    say([buildLine(b), `강사용 파일(올리지 않음) ${rel(b.tdir)}`, b.access === 'password' ? '암호 보호: 참가자 QR은 주소 뒤에 #k=암호 를 붙이면 바로 열려요.' : '',
      b.warnings.length ? `주의 ${b.warnings.length}: ${plural(b.warnings.map((w) => cut(w.message_ko, 60)), 3, ' / ')}` : ''],
    { ok: true, dir: b.dir, teacherDir: b.tdir, files: b.files, sizeKB: b.sizeKB, access: b.access, ...b.report, warnings: b.warnings });
  },

  async qa() {
    const q = await runQa(args._[0] || 'dist', { outDir: args.out, password: args.password || process.env.LECPAGE_PASSWORD || '' });
    say(qaLines(q), q);
    process.exitCode = q.ok ? 0 : 1;
  },

  serve() {
    const port = +args.port || 4173;
    staticServer(resolve(args._[0] || 'dist')).listen(port, args.host || '127.0.0.1', () => console.log(`미리보기: http://localhost:${port}/  (끝내려면 Ctrl+C${args.host ? '' : ' · 같은 와이파이의 다른 기기에서 보려면 --host 0.0.0.0'})`));
  },

  /** 올리기: Cloudflare 계정 하나에 사이트(+ --live면 참여 기능 중계)를 올리고 주소 확인·안내물까지(scripts/publish.mjs) */
  async publish() { const { publishCmd } = await import('./publish.mjs'); await publishCmd(helpers()); },
  /** 올린 주소 → 강사용 폴더에 QR-안내문.pdf·강사-카드.pdf·발표화면.png */
  async handouts() { const { handoutsCmd } = await import('./publish.mjs'); await handoutsCmd(helpers()); },

  pack() {
    const dir = resolve(args._[0] || 'dist');
    const files = N.readAssetDir(dir, '');
    const zip = E.zipFiles(files);
    const target = args.o || 'site.zip'; writeFileSync(target, zip);
    say([`→ ${target} (${Math.round(zip.length / 1024)}KB, 파일 ${Object.keys(files).length}개)`], { ok: true, file: resolve(target), kb: Math.round(zip.length / 1024), files: Object.keys(files).length });
  },
};
commands['decide-infra'] = commands.decideInfra;
delete commands.decideInfra;

if (!cmd || args.help && !commands[cmd] || !commands[cmd]) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1).filter((l, i, a) => a.slice(0, i + 1).every((x) => x.startsWith('//'))).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exitCode = cmd && !['help', '-h', '--help'].includes(cmd) ? 2 : 0;
} else await commands[cmd]();
