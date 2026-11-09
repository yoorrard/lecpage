#!/usr/bin/env node
// lecpage CLI — Node 22 이상. qa·options만 Playwright를 쓰고, 없으면 그 단계만 건너뜁니다.
// 기본 출력은 짧은 요약, --json을 붙이면 기계용 JSON.
//
//   make <교재...> [-i info.json] [-o dist] [--preset id] [--password 암호] [--no-qa] [--fresh]
//        교재 → 해석 → 초안 → 검증 → 빌드 → 점검을 한 번에(작업 파일은 dist 옆 work/)
//        다시 부르면 교재 해석은 재사용, 고친 설계도는 유지(--fresh: 설계도를 새 초안으로)
//   brief [blueprint.json|material.json|work]        짧은 요약: 칸 id·개수·빈칸·주의·글꼴
//   patch <blueprint.json> [patch.json|'{…}'] [--set 경로=값 …] [-i info.json] [--undo] [--no-build]
//        일부만 고치고 검증·다시 빌드(형식: references/cli.md)
//   options <blueprint.json> [--presets a,b,c]       디자인 3안 빌드 → 비교 그림 한 장
//   doctor                                           환경 점검과 설치 방법
//   build <blueprint.json> -o dist [--assets 폴더] [-i info.json] [--password 암호]
//   validate <blueprint.json> · qa <dist> · serve <dist> [--port 4173] · pack <dist> -o site.zip
//   draft <material.json> [-i info.json] -o draft.json · prompt <material.json> -o prompt.txt
//   design <blueprint.json> · decide-infra -i info.json · presets · effects
import { readFileSync, writeFileSync, existsSync, statSync, createReadStream, mkdirSync, rmSync, readdirSync, copyFileSync } from 'node:fs';
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
const BOOL = new Set(['json', 'fresh', 'reingest', 'no-qa', 'no-slides', 'no-build', 'undo', 'qa', 'help', 'commercial', 'minor', 'keep-design', 'no-python']);
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
const ARCH_KO = { story: '이야기형', lab: '실습형', live: '라이브형', course: '과정형' };
const ACCESS_KO = { link: '주소를 받은 사람만', public: '누구나(검색 허용)', password: '암호' };

async function ingestCli() { return imp('src/ingest/cli.js'); }
async function ingestApi() { return imp('src/ingest/index.js'); }

/** Playwright: ESM import → NODE_PATH(require) 순서로 찾음. 없으면 null */
async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 아래 */ }
  try { return createRequire(import.meta.url)('playwright'); } catch { return null; }
}

/** 강사에게 직접 받은 값만 설계도에 넣음(패치·교재로는 못 바꿈): 공개 범위, 사이트·참여 주소, 실시간 연결 */
function applyTeacherInfo(bp, info = {}, opts = {}) {
  const access = opts.access || info.access || (opts.password ? 'password' : '');
  if (['link', 'public', 'password'].includes(access)) bp.access = { mode: access };
  bp.meta = bp.meta || {};
  for (const k of ['siteUrl', 'joinUrl', 'shortUrl']) if (info[k]) bp.meta[k] = info[k];
  if (info.live && typeof info.live === 'object') {
    bp.live = { ...(bp.live || {}) };
    for (const k of ['provider', 'url', 'anonKey', 'code', 'features']) if (info.live[k] !== undefined) bp.live[k] = info.live[k];
  }
  return bp;
}

/** 인터뷰 답(info.json, references/intake.md 키)을 초안 입력으로: 형식→유형(칸 순서), 대상 */
function draftInfo(info = {}, material = null) {
  const d = { ...info };
  if (info.format && !info.archetype) {
    const ev = material?.detected?.event || {};
    const mins = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : NaN; };
    const dur = mins(info.end || ev.end) - mins(info.start || ev.start);
    d.archetype = E.decideArchetype({ format: info.format, size: info.size, durationMin: dur > 0 ? dur : undefined, practiceRatio: material?.detected?.practice?.ratio }).primary;
  }
  d.audience = { ...(info.audience || {}), ...(info.devices ? { devices: [].concat(info.devices) } : {}), ...(info.network ? { network: info.network === 'offline' ? 'restricted' : info.network } : {}), ...(info.minor !== undefined ? { minor: !!info.minor } : {}) };
  if (info.admin) d.adminKind = info.admin;
  return d;
}

const LIVE_KEYS = ['qa', 'help', 'progress', 'board', 'poll', 'attendance', 'reactions', 'chat', 'signal'];
/** 인터뷰 답 중 초안이 쓰지 않는 것(분위기·움직임·강조색·참여 기능)을 설계도에. info에 있는 키만 바꿈 */
function applyIntake(bp, info = {}) {
  bp.design = { ...(bp.design || {}) };
  if (info.mood) { const m = E.moodFromWords([].concat(info.mood)); if (m.length) bp.design.mood = m; }
  if (info.motion !== undefined && info.motion !== '') bp.design.motion = +info.motion;
  if ('accent' in info) { if (info.accent) bp.design.accent = info.accent; else delete bp.design.accent; }
  if (info.logo) bp.design.logo = info.logo;
  if (info.preset) bp.design.preset = info.preset;
  if (info.admin) bp.meta = { ...(bp.meta || {}), admin: { ...(bp.meta?.admin || {}), kind: info.admin } };
  if (!Array.isArray(info.features)) return bp;
  // 참여 기능 → 칸(질문·보드·투표·출석·설문)과 live.features. 연결 전에는 local(한 기기 미리보기)
  const f = info.features.flatMap((x) => String(x).split('+'));
  const on = (k) => f.includes(k);
  bp.sections = Array.isArray(bp.sections) ? bp.sections : [];
  const has = (t) => bp.sections.some((s) => s?.type === t);
  const before = (types, sec) => { const i = bp.sections.findIndex((s) => types.includes(s?.type)); bp.sections.splice(i < 0 ? bp.sections.length : i, 0, sec); };
  if (on('attendance') && !has('attendance')) before(['readiness', 'outline', 'stations'], { id: 'attendance', type: 'attendance', title: '출석 확인' });
  if (on('poll') && !has('poll')) before(['qa', 'board', 'materials', 'instructor', 'closing', 'survey'], { id: 'poll', type: 'poll', title: '함께 답해요', items: [{ id: 'word', question: '오늘 연수를 한 낱말로 말하면?', kind: 'word', options: [] }] });
  if (on('qa') && !has('qa')) before(['board', 'materials', 'instructor', 'closing', 'survey'], { id: 'qa', type: 'qa', title: '궁금한 점을 남겨 주세요' });
  if (on('board') && !has('board')) before(['materials', 'instructor', 'closing', 'survey'], { id: 'board', type: 'board', title: '함께 나누는 보드', categories: [{ id: 'work', label: '결과물' }, { id: 'reflection', label: '소감' }], allowFiles: !info.minor });
  bp.sections = bp.sections.filter((s) => !['qa', 'board', 'attendance'].includes(s?.type) || on(s.type));
  const liveOn = f.some((x) => LIVE_KEYS.includes(x));
  if (liveOn && !has('survey')) bp.sections.push({ id: 'survey', type: 'survey', title: '만족도 조사에 참여해 주세요', url: info.surveyUrl || '', qr: true, questions: E.DEFAULT_SURVEY.map((q) => ({ ...q })) });
  if (liveOn) bp.sections.forEach((s) => { if (s?.type === 'survey' && !s.questions?.length) s.questions = E.DEFAULT_SURVEY.map((q) => ({ ...q })); });
  const prev = bp.live || {};
  bp.live = { ...prev, features: f.filter((x) => LIVE_KEYS.includes(x)), provider: liveOn ? (prev.provider && prev.provider !== 'none' ? prev.provider : 'local') : 'none' };
  bp.privacy = { ...(bp.privacy || {}), collect: info.minor ? ['nickname'] : on('attendance') ? ['nickname', 'name', 'school'] : ['nickname'] };
  return bp;
}

/** 자료 폴더 → 빌드 자료. 설계도는 assets/slides/…·assets/media/…를 가리키므로 앞에 assets/를 맞춰 붙임 */
function assetFiles(dir) {
  const raw = N.readAssetDir(dir, '');
  const out = {};
  for (const [k, v] of Object.entries(raw)) { const key = k.startsWith('assets/') ? k : 'assets/' + k; if (USER_ASSET.test(key)) out[key] = v; }
  return out;
}

/** 빌드해 쓰기. 예전 빌드가 남긴 엔진 파일(꺼진 기능의 화면 등)은 지움(CNAME 같은 남의 파일은 그대로) */
async function buildSite(bp, { out, assets = '', info = null, password = '' }) {
  const r = E.build(bp, { runtime: N.nodeRuntime(), assets: assets && existsSync(assets) ? assetFiles(assets) : {}, infra: info && (info.size || info.features) ? info : null });
  if (r.errors.length) return { ok: false, errors: r.errors, warnings: r.warnings };
  const dir = resolve(out);
  password = password || process.env.LECPAGE_PASSWORD || '';
  if (r.blueprint.access.mode === 'password' && !password) return { ok: false, errors: [{ path: 'access', message_ko: '암호 보호 설계도예요. --password 값이나 LECPAGE_PASSWORD 환경 변수를 주세요.' }], warnings: r.warnings };
  let files = r.files;
  if (password) {
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

/** 다른 작업이 만드는 검사기(scripts/design-lint.mjs·copy-lint.mjs). 없으면 건너뜀 */
async function loadLinters() {
  const list = [];
  for (const [name, file] of [['디자인', 'design-lint.mjs'], ['문구', 'copy-lint.mjs']]) {
    const p = join(HERE, file);
    if (!existsSync(p)) { list.push({ name, status: 'missing' }); continue; }
    try {
      const mod = await import(pathToFileURL(p).href);
      const fn = mod.lintPage || mod.lint || mod.default;
      list.push(typeof fn === 'function' ? { name, fn, status: 'ok' } : { name, status: 'missing' });
    } catch (e) { list.push({ name, status: 'error', error: cut(e.message, 80) }); }
  }
  return list;
}
function lintIssues(res) {
  const arr = Array.isArray(res) ? res : res?.issues || res?.problems || res?.findings || [];
  return arr.map((x) => (typeof x === 'string' ? { level: 'warn', message: x } : { level: /err|high|fail/i.test(x.level || x.severity || '') ? 'error' : 'warn', message: x.message_ko || x.message || x.msg || x.rule || JSON.stringify(x), where: x.selector || x.where || x.path || '' }));
}

async function runQa(dir, { outDir } = {}) {
  dir = resolve(dir);
  if (!existsSync(join(dir, 'index.html'))) return { ok: false, error: `${rel(dir)}에 index.html이 없어요.` };
  outDir = resolve(outDir || join(dir, '..', 'qa'));
  const broken = brokenRefs(dir);
  const res = { ok: true, dir, outDir, views: [], broken, lint: [], shots: [], skipped: '' };
  const protectedSite = /lp-locked|unlock\.js/.test(readFileSync(join(dir, 'index.html'), 'utf8'));
  const pw = await loadPlaywright();
  if (!pw) { res.skipped = 'Playwright 없음'; res.ok = !broken.length; return res; }
  let browser;
  try { browser = await pw.chromium.launch(); } catch (e) { res.skipped = 'Chromium 실행 실패(npx playwright install chromium)'; res.ok = !broken.length; return res; }
  mkdirSync(outDir, { recursive: true });
  const linters = protectedSite ? [] : await loadLinters();
  for (const [w, h, name] of [[1280, 860, 'desktop'], [390, 844, 'phone']]) {
    for (const scheme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: scheme });
      const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
      await page.goto(pathToFileURL(join(dir, 'index.html')).href, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(700);
      const m = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, imgsNoAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).length, h1: document.querySelectorAll('h1').length, btnNoName: [...document.querySelectorAll('button')].filter((b) => !(b.textContent.trim() || b.getAttribute('aria-label') || b.getAttribute('title'))).length }));
      const shot = join(outDir, `${name}-${scheme}.png`);
      await page.screenshot({ path: shot, fullPage: false });
      res.shots.push(shot);
      const v = { view: `${name}-${scheme}`, errors: errs.filter((e) => !/net::ERR|Failed to load resource/.test(e)), ...m };
      if (protectedSite) v.h1 = 1; // 잠금 화면은 h1 검사 제외
      res.views.push(v);
      if (scheme === 'light') for (const L of linters.filter((x) => x.fn)) {
        try { for (const it of lintIssues(await L.fn(page, { view: name, dir }))) { L.issues = L.issues || []; if (!L.issues.some((x) => x.message === it.message)) L.issues.push(it); } }
        catch (e) { L.status = 'error'; L.error = cut(e.message, 80); }
      }
      await page.close();
    }
  }
  await browser.close();
  res.lint = linters.map(({ name, status, issues = [], error }) => ({ name, status, issues, error }));
  const badViews = res.views.filter((r) => r.errors.length || r.overflow || r.imgsNoAlt || r.h1 !== 1 || r.btnNoName);
  res.ok = !badViews.length && !broken.length && !res.lint.some((l) => l.issues.some((i) => i.level === 'error'));
  writeJson(join(outDir, 'report.json'), res);
  return res;
}

function qaLines(q) {
  if (q.error) return [`점검 ✗ ${q.error}`];
  const lines = [];
  const problems = [];
  for (const v of q.views) {
    const p = [v.errors.length && `스크립트 오류 ${v.errors.length}(${cut(v.errors[0], 50)})`, v.overflow && '가로 넘침', v.imgsNoAlt && `대체 텍스트 없는 그림 ${v.imgsNoAlt}`, v.h1 !== 1 && `h1 ${v.h1}개`, v.btnNoName && `이름 없는 버튼 ${v.btnNoName}`].filter(Boolean);
    if (p.length) problems.push(`  ${v.view}: ${p.join(', ')}`);
  }
  if (q.broken.length) problems.push(`  깨진 자료 ${q.broken.length}: ${plural(q.broken.map((b) => cut(b, 40)), 3, ', ')}`);
  const missing = q.lint.filter((l) => l.status === 'missing').map((l) => l.name);
  const lint = [...q.lint.map((l) => (l.status === 'missing' ? '' : l.status === 'error' ? `${l.name} 검사 실패(${l.error})` : `${l.name} 검사 ${l.issues.length ? `${l.issues.length}건` : '이상 없음'}`)).filter(Boolean), missing.length ? `${missing.join('·')} 검사 없음(건너뜀)` : ''].filter(Boolean);
  const head = q.skipped ? `점검 ${q.broken.length ? '✗' : '△'} 화면 검사 건너뜀(${q.skipped}) · 깨진 자료 ${q.broken.length}` : `점검 ${q.ok ? '✓ 통과' : '✗ 문제 있음'} · ${q.views.length}화면(휴대폰·PC × 밝게·어둡게) · 깨진 자료 ${q.broken.length}${lint.length ? ' · ' + lint.join(' · ') : ''}`;
  lines.push(head, ...problems);
  for (const l of q.lint) for (const it of l.issues.slice(0, 3)) lines.push(`  ${l.name}: ${cut(it.message, 70)}${it.where ? ` (${cut(it.where, 30)})` : ''}`);
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
    d.archetype ? `유형 ${ARCH_KO[d.archetype.primary] || d.archetype.primary}(${d.archetype.primary}) — ${cut(d.archetype.reason_ko, 60)}` : '',
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
  const lines = [
    `설계도 「${cut(m.title, 40)}」 · ${ARCH_KO[bp.archetype.primary]}(${bp.archetype.primary}) · 디자인 ${rd.preset} · 움직임 ${rd.motion} · 공개 ${bp.access.mode} · 참여 ${bp.live.provider}${bp.live.features.length ? `(${bp.live.features.join(',')})` : ''}`,
    `일시 ${[m.date, m.start && `${m.start}~${m.end}`].filter(Boolean).join(' ') || '?'} · 장소 ${cut(m.venue || '?', 30)} · 강사 ${bp.instructors.map((p) => p.name).join(', ') || '?'}`,
    `칸 ${bp.sections.length}: ${secs.join(' · ')}${hidden.length ? ` | 숨김: ${hidden.join(', ')}` : ''}`,
    st ? `실습 ${st.items.map((it, i) => `[${i}]${cut(it.name || it.title, 14)}(단계 ${it.steps.length}·프롬프트 ${it.prompts.length}${it.source?.pages?.length ? '·' + pg(it.source.pages) : ''})`).join(' ')}` : '',
    fontLine(raw.design?.sourceFonts || (raw._draft?.detectedFonts?.[0] ? { body: { name: raw._draft.detectedFonts[0] } } : null), raw.design),
    gaps.length ? `빈칸 ${gaps.join(', ')}` : '빈칸 없음',
    ...errors.map((e) => `오류 ${e.path}: ${cut(e.message_ko, 80)}`),
    warnings.length ? `주의 ${warnings.length}: ${plural(warnings.map((w) => cut(w.message_ko, 60)), 3, ' / ')}` : '',
  ];
  return { lines, json: { kind: 'blueprint', title: m.title, archetype: bp.archetype.primary, preset: bp.design.preset, access: bp.access.mode, live: bp.live.provider, sections: bp.sections.map((s) => { const list = def[s.type]?.list; return { id: s.id, type: s.type, title: s.title, count: list ? s[list]?.length ?? 0 : undefined }; }), hidden, gaps, errors, warnings } };
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

// ── 명령 ─────────────────────────────────────────
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
    const draft = api.materialToDraft(m, { today: args.today || undefined, ...draftInfo(info, m) });
    writeJson(draftPath, draft);
    let raw, kept = false;
    if (existsSync(bpPath) && !args.fresh) { raw = readJson(bpPath); kept = true; } else raw = applyIntake(structuredClone(draft), info);
    if (args.preset) raw.design = { ...(raw.design || {}), preset: args.preset };
    applyTeacherInfo(raw, info, { access: args.access, password: args.password });
    writeJson(bpPath, raw);

    // 3) 검증·빌드
    const v = E.validate(raw);
    if (v.errors.length) fail('설계도 검증 실패: ' + v.errors.map((e) => `${e.path} ${e.message_ko}`).join(' / '));
    const b = await buildSite(raw, { out, assets, info: Object.keys(info).length ? info : null, password: args.password });
    if (!b.ok) fail(b.errors.map((e) => e.message_ko).join(' '));
    saveState(work, { out, assets, info: args.i ? resolve(args.i) : '', blueprint: bpPath, inputs });

    // 4) 점검
    const q = args['no-qa'] ? null : await runQa(out, { outDir: join(dirname(out), 'qa') });
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
      ...bb.lines,
      buildLine(b).replace(rel(b.dir), sh(b.dir)),
      ...(q ? qaLines(q).filter((l) => !l.includes('스크린샷')) : ['점검 건너뜀(--no-qa)']),
      `다음 내용 확인 → patch ${bpShort} --set 경로=값 · 디자인 비교 options ${bpShort} · 미리보기 serve ${sh(out)}`,
    ];
    say(lines, { ok: !q || q.ok, seconds: +sec, work, blueprint: bpPath, kept, material: bm.json, brief: bb.json, build: { dir: b.dir, teacherDir: b.tdir, files: b.files, sizeKB: b.sizeKB, ...b.report }, qa: q });
    process.exitCode = q && !q.ok ? 1 : 0;
  },

  brief() { const r = briefAny(args._[0]); say(r.lines, r.json); },

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
    if (args.i) { const info = readJson(args.i); applyIntake(r.raw, info); applyTeacherInfo(r.raw, info, { access: args.access }); }
    const final = args.i ? E.validate(r.raw) : { errors: r.errors, warnings: r.warnings.filter((w) => w.kind !== 'patch') };
    const pw = r.warnings.filter((w) => w.kind === 'patch');
    if (final.errors.length) fail('검증 실패로 저장하지 않았어요: ' + final.errors.map((e) => `${e.path} ${e.message_ko}`).join(' / '), { warnings: pw });
    const changes = E.diffSummary(undoFrom || before, r.raw);
    if (!args.undo && changes.length) { writeFileSync(prev, readFileSync(bpPath)); writeJson(bpPath, r.raw); }
    const out = args.o ? resolve(args.o) : state.out;
    let b = null, q = null, skip = '';
    if (!changes.length) skip = '바뀐 것이 없어 다시 빌드하지 않았어요.';
    else if (args['no-build']) skip = '빌드 건너뜀(--no-build)';
    else if (!out) skip = '빌드할 곳을 모름: -o dist 를 붙이면 다시 빌드해요.';
    else {
      b = await buildSite(r.raw, { out, assets: state.assets || join(work, 'assets'), info: state.info && existsSync(state.info) ? readJson(state.info) : null, password: args.password });
      if (!b.ok) { skip = '빌드 못 함: ' + b.errors.map((e) => e.message_ko).join(' '); b = null; }
      else if (args.qa) q = await runQa(out);
    }
    const lines = [
      `${args.undo ? '되돌림' : '고침'} ${changes.length}건 → ${rel(bpPath)}${changes.length && !args.undo ? ` (이전 판 ${basename(prev)}, --undo로 되돌리기)` : ''}${r.note ? ` · ${r.note}` : ''}`,
      ...changes.map((c) => '- ' + c),
      ...pw.map((w) => `주의 ${w.message_ko}`),
      `검증 ✓${final.warnings.length ? ` (주의 ${final.warnings.length}: ${plural(final.warnings.map((w) => cut(w.message_ko, 50)), 2, ' / ')})` : ''}`,
      b ? buildLine(b) : skip,
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
    const moods = bp.design.mood.length ? bp.design.mood : E.moodsForTopics(topics);
    const ranked = E.rankPresets({ moods, topics, archetype: bp.archetype.primary, admin: bp.meta.admin.kind, minor: bp.audience.minor }, E.PRESETS.length);
    const ids = args.presets ? String(args.presets).split(',').map((s) => s.trim()).filter((id) => E.PRESET_IDS.includes(id)) : ranked.slice(0, 3).map((r) => r.id);
    if (!ids.length) fail(`프리셋 이름을 확인해 주세요: ${E.PRESET_IDS.join(', ')}`);
    const outDir = resolve(args.o || join(work, 'options'));
    const assets = args.assets || state.assets || join(work, 'assets');
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
        for (const [w, h, name, scroll] of [[1280, 800, 'pc', false], [1280, 800, 'pc2', true], [390, 844, 'phone', false]]) {
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
      ...results.map((r, i) => (r.error ? `${i + 1} ${r.id} ✗ ${r.error}` : `${i + 1} ${r.id} ${r.name} — ${cut(r.desc, 34)} · ${r.why.length ? r.why.join('·') : '기본 추천'} · 움직임 ${r.motion}${r.signature ? ` · 대표 효과 ${r.signature}` : ''}`)),
      fl && fl.startsWith('글꼴 교재') ? `${fl.replace('글꼴 교재', '글꼴 세 안 모두 교재를 따름:')} (끄기: --set design.fontFrom=preset)` : fl,
      `고르면 patch ${rel(bpPath)} --set design.preset=<id> · 각 안 미리보기 ${rel(outDir)}/<id>/index.html`,
    ];
    say(lines, { ok: true, sheet, skipped, options: results.map(({ pc, pc2, phone, ...r }) => ({ ...r, shots: { pc, pc2, phone } })) });
  },

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
    checks.push({ name: 'pdftoppm', ok: has('pdftoppm'), use: '쪽 그림(교재 뷰어)', fix: fix({ linux: 'sudo apt-get install -y poppler-utils', mac: 'brew install poppler', win: 'winget install oschwartz10612.Poppler' }) });
    checks.push({ name: 'cwebp', ok: has('cwebp'), use: '쪽 그림 용량 줄이기(없으면 PNG)', fix: fix({ linux: 'sudo apt-get install -y webp', mac: 'brew install webp', win: 'winget install Google.Libwebp' }) });
    const py = spawnSync('python3', ['-c', 'import pymupdf'], { encoding: 'utf8' }).status === 0 || spawnSync('python3', ['-c', 'import fitz'], { encoding: 'utf8' }).status === 0;
    let pdfjs = false; try { createRequire(import.meta.url).resolve('pdfjs-dist/package.json'); pdfjs = true; } catch { /* 없음 */ }
    checks.push({ name: 'PDF 읽기', ok: py || pdfjs, info: pdfjs ? 'pdfjs-dist' : py ? 'PyMuPDF' : '', use: 'PDF 교재 글 읽기', fix: 'pip install pymupdf (또는 npm i pdfjs-dist)' });
    if (os !== 'win' && has('fc-list')) {
      const ko = spawnSync('fc-list', [':lang=ko', 'family'], { encoding: 'utf8' }).stdout?.trim().split('\n').filter(Boolean).length || 0;
      checks.push({ name: '한글 글꼴', ok: ko > 0, info: ko ? `${ko}종` : '', use: '쪽 그림의 한글이 깨지지 않게', fix: fix({ linux: 'sudo apt-get install -y fonts-noto-cjk fonts-nanum', mac: '기본 포함' }) });
    }
    const lines = checks.map((c) => `${c.ok ? '✓' : c.need ? '✗' : '–'} ${c.name}${c.info ? ` ${c.info}` : ''}${c.ok ? '' : ` — ${c.use}: ${c.fix}`}`);
    const missing = checks.filter((c) => !c.ok);
    lines.push(missing.some((c) => c.need) ? '필수 도구가 없어요. 위 명령으로 설치해 주세요.' : missing.length ? '만들기는 돼요. – 표시는 그 기능만 건너뜁니다.' : '모두 준비됐어요.');
    say(lines, { ok: !missing.some((c) => c.need), checks });
    process.exitCode = missing.some((c) => c.need) ? 1 : 0;
  },

  presets() {
    if (JSON_OUT) return say([], E.PRESETS.map((p) => ({ id: p.id, name: p.name_ko, desc: p.desc_ko, moods: p.moods, topics: p.topics, motion: p.motion })));
    for (const p of E.PRESETS) console.log(`${p.id.padEnd(15)} ${p.name_ko} — ${p.desc_ko} [${p.moods.join(',')} · ${p.topics.join(',')} · 움직임 ${p.motion}]`);
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
    const text = E.buildPrompt({ context, info, draft });
    if (!args.o) return console.log(text);
    writeFileSync(args.o, text); say([`프롬프트 → ${args.o} (${text.length}자)`], { ok: true, file: resolve(args.o), chars: text.length });
  },

  validate() {
    const r = E.validate(readJson(args._[0]));
    if (args.o) writeJson(args.o, r.blueprint);
    const lines = [r.errors.length ? `검증 ✗ 오류 ${r.errors.length}` : `검증 ✓ 칸 ${r.blueprint.sections.length}${r.warnings.length ? ` · 주의 ${r.warnings.length}` : ''}`,
      ...r.errors.map((e) => `오류 ${e.path}: ${e.message_ko}`), ...r.warnings.slice(0, 8).map((w) => `주의 ${w.path}: ${w.message_ko}`), r.warnings.length > 8 ? `주의 외 ${r.warnings.length - 8}건(--json)` : ''];
    say(lines, { ok: !r.errors.length, errors: r.errors, warnings: r.warnings, sections: r.blueprint.sections.length });
    process.exit(r.errors.length ? 1 : 0);
  },

  decideInfra() {
    const info = args.i ? readJson(args.i) : { size: +args.size || 30, features: String(args.features || '').split(',').filter(Boolean), skill: args.skill || 'click', duration: args.duration || 'day', network: args.network || 'good', infra: String(args.infra || '').split(',').filter(Boolean), commercial: !!args.commercial, minor: !!args.minor };
    const r = E.decideInfra(info);
    say([
      `추천 ${r.backendInfo.name_ko}(${r.backend}, ${r.backendInfo.cost}) × 올릴 곳 ${r.hostInfo.map((h) => `${h.name_ko}(${h.id})`).join(' · ')}`,
      ...r.reasons.map((x) => '이유 ' + x), ...r.warnings.map((x) => '주의 ' + x),
      r.alternatives.length ? `대안 ${r.alternatives.join(', ')}` : '',
      `설계도 live.provider=${r.liveProvider} (주소·키는 강사에게 받아 info.json의 live로)`,
    ], r);
  },

  design() {
    const { blueprint: bp } = E.validate(readJson(args._[0]));
    const ranked = E.rankPresets({ moods: bp.design.mood, topics: bp.design.topics.length ? bp.design.topics : E.detectTopics(bp.meta.title + ' ' + bp.meta.subtitle), archetype: bp.archetype.primary, admin: bp.meta.admin.kind, minor: bp.audience.minor });
    const d = E.resolveDesign(bp);
    say([...ranked.map((r, i) => `${i + 1} ${r.id} ${r.name_ko} — ${r.why.join('·') || '기본'}`),
      `적용 ${d.preset} · 움직임 ${d.motion}${d.signature ? ` · 대표 효과 ${d.signature}` : ''} · 효과 ${Object.entries(d.effects).map(([k, v]) => `${k}=${v}`).join(', ')}`,
      ...d._notes.map((n) => '메모 ' + n)], { ranked, resolved: d });
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
    const q = await runQa(args._[0] || 'dist', { outDir: args.out });
    say(qaLines(q), q);
    process.exitCode = q.ok ? 0 : 1;
  },

  serve() {
    const dir = resolve(args._[0] || 'dist'); const port = +args.port || 4173;
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.md': 'text/markdown; charset=utf-8', '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
    createServer((req, res) => {
      let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end('bad request'); }
      if (p.endsWith('/')) p += 'index.html';
      const f = join(dir, p); const r = relative(dir, f);
      if (r.startsWith('..') || isAbsolute(r) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); createReadStream(f).pipe(res);
    }).listen(port, args.host || '127.0.0.1', () => console.log(`미리보기: http://localhost:${port}/  (끝내려면 Ctrl+C${args.host ? '' : ' · 같은 와이파이의 다른 기기에서 보려면 --host 0.0.0.0'})`));
  },

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
