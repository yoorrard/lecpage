// AI 에이전트 흐름(docs/plan-ai-first.md §9) 명령: prepare(교재 → 쪽 그림·보조 글자·안내), check(조립·검수·화면 그림), preview(로컬 미리보기).
// 에이전트가 사이트(work/site/)와 연수 정보(work/lecpage.json)를 직접 쓰고, lecpage는 준비·조립·검수만 합니다.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, copyFileSync, statSync, readdirSync } from 'node:fs';
import { join, resolve, dirname, basename, extname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(HERE, '..', 'engine');
const REF = join(HERE, '..', 'references');
const imp = (p) => import(pathToFileURL(join(ENGINE, p)).href);
const TEXT = /\.(html|css|m?js|json|txt|vtt|md)$/i;
const pad3 = (n) => String(n).padStart(3, '0');

/** 새 흐름(v2) 작업 폴더인지: site/ + lecpage.json(설계도 blueprint.json은 예전 흐름) */
export function isV2Work(dir) {
  try { return statSync(dir).isDirectory() && existsSync(join(dir, 'lecpage.json')) && existsSync(join(dir, 'site')); } catch { return false; }
}

/** 사이트 폴더 → { 경로: 글|bytes } */
function readSite(N, dir) {
  const raw = N.readAssetDir(dir, '');
  const out = {};
  for (const [k, v] of Object.entries(raw)) out[k] = TEXT.test(k) ? new TextDecoder().decode(v) : v;
  return out;
}
function pageText(p) {
  const tables = (p.tables || []).map((t) => (t.rows || []).map((r) => (Array.isArray(r) ? r.join(' | ') : '')).join('\n')).filter(Boolean);
  return [...(p.paragraphs || []).map((x) => (typeof x === 'string' ? x : x?.text || '')), ...tables].filter(Boolean).join('\n');
}

/** prepare <교재…> -o work */
export async function prepareCmd(h) {
  const { args, rel, fail, say, writeJson } = h;
  const inputs = args._.map((p) => (/^https?:/i.test(p) ? p : resolve(p)));
  if (!inputs.length) fail('교재 파일을 주세요. 예: lecpage.mjs prepare 교재.pdf 교재.pptx -o work');
  const work = resolve(args.o || 'work');
  const siteDir = join(work, 'site'), matDir = join(siteDir, 'material'), tmp = join(work, '.lecpage', 'slides');
  mkdirSync(matDir, { recursive: true }); mkdirSync(tmp, { recursive: true });
  const C = await imp('src/ingest/cli.js');
  const t0 = Date.now();
  const m = await C.ingestPaths(inputs, { withImages: false, today: args.today || undefined, python: !args['no-python'] });
  if (!m.pages?.length) fail('교재에서 읽은 내용이 없어요. ' + [...new Set((m.errors || []).map((e) => e.message_ko))].join(' '));
  if (!args['no-slides']) await C.attachSlides(m, tmp, join(work, '.lecpage', 'material.json'), { onProgress: (d, t) => { if (Date.now() - t0 > 8000 && d % 10 === 0) console.error(`… 쪽 그림 ${d}${t ? '/' + t : ''}`); } });
  // 쪽 번호: 교재 여러 개면 이어서(첫 교재 1~12, 둘째 13부터). 그림은 site/material/p-NNN.webp
  const files = Object.fromEntries((m.files || []).map((f) => [f.id, f]));
  const pages = []; let images = 0;
  m.pages.forEach((p, i) => {
    const n = i + 1;
    let img = '';
    if (p.image) {
      const from = join(work, '.lecpage', p.image);
      const ext = (extname(p.image) || '.webp').toLowerCase().replace('.jpeg', '.jpg');
      if (existsSync(from)) { img = `material/p-${pad3(n)}${ext}`; copyFileSync(from, join(siteDir, img)); images++; }
    }
    pages.push({ page: n, file: files[p.file]?.name || '', filePage: p.page, title: String(p.title || '').trim(), text: pageText(p), notes: String(p.notes || '').trim(), image: img });
  });
  rmSync(join(work, '.lecpage', 'slides'), { recursive: true, force: true });
  writeJson(join(work, '.lecpage', 'pages.json'), pages.map(({ page, title, text }) => ({ page, title, text: text.slice(0, 400) })));
  // 교재 목록(앱으로 넘길 때 원본을 함께 담으려고 경로도 적음. 이 컴퓨터 안에서만 씀)
  writeJson(join(work, '.lecpage', 'sources.json'), (m.files || []).filter((f) => f.path).map((f) => ({ name: f.name, type: f.type, pages: f.pages || 0, size: f.size || 0, path: f.path, ...(f.renderOf ? { renderOf: true } : {}) })));
  h.saveState(work, { v: 2, out: 'dist' });
  // 보조 글자: 쪽 그림과 원본이 먼저, 이 글은 찾기·옮겨 적기용
  const md = [`# 교재 보조 글자`, '', `쪽 그림(site/material/p-NNN.webp)과 교재 원본이 먼저예요. 이 글은 찾기·옮겨 적기용이라 표·그림 속 글은 빠질 수 있어요.`, '',
    `교재: ${(m.files || []).filter((f) => !f.renderOf).map((f) => `${f.name}(${f.pages || '?'}쪽)`).join(', ')}`, '',
    ...pages.flatMap((p) => [`## p-${pad3(p.page)} · ${p.file} ${p.filePage}쪽${p.title ? ` · ${p.title}` : ''}${p.image ? '' : ' (쪽 그림 없음)'}`, '', p.text || '(글자 없음)', ...(p.notes ? ['', `> 발표자 노트: ${p.notes.replace(/\n/g, ' ')}`] : []), ''])].join('\n');
  writeFileSync(join(work, 'material.md'), md);
  const metaPath = join(work, 'lecpage.json');
  if (!existsSync(metaPath)) writeJson(metaPath, { v: 2, title: '', subtitle: '', sessions: [], venue: '', mode: 'offline', audience: 'teachers', instructors: [], features: [], theme: {}, facts: [] });
  const originals = inputs.filter((p) => !/^https?:/i.test(p));
  writeFileSync(join(work, 'README.md'), readmeText({ work, pages, images, originals }));
  say([
    `준비 ${rel(work)}: 교재 ${pages.length}쪽 · 쪽 그림 ${images}장(site/material/) · 보조 글자 material.md`,
    images < pages.length && !args['no-slides'] ? `주의 쪽 그림을 ${pages.length - images}쪽 만들지 못했어요(LibreOffice·pdftoppm 확인: lecpage.mjs doctor).` : '',
    ...(m.warnings || []).slice(0, 3).map((w) => `주의 ${w.message_ko}`),
    `다음 ${rel(join(work, 'README.md'))}을 읽고 site/index.html·lecpage.json을 쓴 뒤 → lecpage.mjs check ${rel(work)}`,
  ], { ok: true, work, pages: pages.length, images, readme: join(work, 'README.md') });
}

function readmeText({ work, pages, images, originals }) {
  const range = images ? `p-001 ~ p-${pad3(pages.length)}` : '없음';
  return `# 할 일: 이 교재로 강의 사이트 만들기

당신(AI 에이전트)이 교재를 읽고 사이트를 직접 설계·작성해요. lecpage는 조립·검수·배포만 해요.

## 읽을 것
- 교재 원본: ${originals.map((p) => `\`${p}\``).join(', ') || '(주소로 받은 교재)'}
- 쪽 그림: \`site/material/\` (${range}, 교재 여러 개는 이어서 번호) — 디자인·도표·사진은 그림으로 직접 보세요.
- 보조 글자: \`material.md\` (쪽마다 글자·발표자 노트)
- 키트 설명서: \`${join(REF, 'kit.md')}\` — 꼭 읽기(자리 표시·CSS 변수·CSP)
- 레퍼런스(참고만, 따를 의무 없음): \`${join(REF, 'designs')}\`

## 쓸 것
1. \`site/index.html\` (필수, 여러 쪽이면 다른 .html도) · \`site/assets/style.css\` · 필요하면 \`site/assets/site.js\` · 그림은 \`site/assets/img/\`(png·jpg·webp, SVG 파일 아님)
2. \`lecpage.json\` (v:2) — 제목·일정(YYYY-MM-DD, HH:MM)·장소·강사·기능(features)·색(theme)·facts(교재 몇 쪽에서 찾았는지)
3. 강의 기능은 자리 표시로: \`<div data-lp="qa"></div>\`, \`<div data-lp="poll" data-question="…" data-options='["…","…"]'></div>\`, 실습 단계는 \`<section data-lp-step="s1" data-title="1단계: …">\` (kit.md)

## 지킬 것
- 교재에 없는 날짜·장소·이름·수치를 지어내지 않기. 모르면 비우기.
- 인라인 onclick 대신 addEventListener, 바깥 스크립트·바깥 그림 쓰지 않기, 비밀번호 칸 없음.
- 휴대폰(390px)과 PC(1280px) 모두에서 읽히게.

## 확인
\`\`\`
node ${join(HERE, 'lecpage.mjs')} check ${work}     # 조립 + 검수 + 390·1280 화면 그림(check/*.png)
node ${join(HERE, 'lecpage.mjs')} preview ${work}   # 로컬 미리보기
\`\`\`
check가 알려 준 곳을 고치고 다시 check해요(고칠 곳 0개가 될 때까지). 화면 그림을 직접 보고 디자인도 다듬어요.
`;
}

/** 조립 공통: work → { site, meta, prev, r(assemble 결과) } */
async function assembleWork(h, work, extra = {}) {
  const { N, fail, readJson } = h;
  const K = await imp('src/kit/index.js');
  const siteDir = join(work, 'site');
  if (!existsSync(join(siteDir, 'index.html'))) fail(`${relp(work, siteDir)}/index.html이 없어요. AI 에이전트가 site/index.html을 먼저 써야 해요(${join(work, 'README.md')}).`);
  if (!existsSync(join(work, 'lecpage.json'))) fail(`${join(work, 'lecpage.json')}이 없어요. 연수 정보(v:2)를 써 주세요(references/kit.md).`);
  const site = readSite(N, siteDir);
  const metaRaw = readFileSync(join(work, 'lecpage.json'), 'utf8');
  const prevPath = join(work, 'lecpage.teacher.json'); // 강사 값(공개 범위·주소·참여 서버): CLI가 따로 둠
  const prev = existsSync(prevPath) ? readJson(prevPath) : null;
  let material = null; try { material = { pages: JSON.parse(readFileSync(join(work, '.lecpage', 'pages.json'), 'utf8')) }; } catch { /* 없음 */ }
  const r = K.assemble(site, metaRaw, { runtime: N.nodeRuntime(), prev, today: h.args.today, material, ...extra });
  return { K, site, metaRaw, prev, r };
}
const relp = (a, b) => relative(a, b) || '.';

/** 조립 결과를 work/dist에 씀. 예전 결과는 지우되 점 파일(.git 등)·CNAME은 남김(GitHub Pages로 올린 폴더) */
function writeDist(N, work, files) {
  const dist = join(work, 'dist');
  if (existsSync(dist)) for (const n of readdirSync(dist)) if (!n.startsWith('.') && n !== 'CNAME') rmSync(join(dist, n), { recursive: true, force: true });
  N.writeFiles(dist, files);
  return dist;
}

/**
 * v2 작업 폴더 조립 → work/dist(올릴 사이트) + work/dist-강사용/운영안내.md(올리지 않음). publish·pack·app·serve·handouts가 함께 씀
 * @returns { ok, errors, dist, tdir, r(assemble 결과), K, site, metaRaw }
 */
export async function buildWorkV2(h, work) {
  const a = await assembleWork(h, work);
  if (a.r.errors?.length) return { ok: false, errors: a.r.errors, ...a };
  const dist = writeDist(h.N, work, a.r.files);
  const tdir = dist + '-강사용';
  if (a.r.teacher && Object.keys(a.r.teacher).length) h.N.writeFiles(tdir, a.r.teacher);
  h.saveState(work, { v: 2, out: 'dist' });
  return { ok: true, dist, tdir, ...a };
}

/** check <work> [--port] [--no-shots] */
export async function checkCmd(h) {
  const { args, N, rel, say, loadPlaywright, staticServer } = h;
  const work = resolve(args._[0] || 'work');
  const { K, site, metaRaw, r, dist } = await buildWorkV2(h, work);
  if (r.errors?.length) { say(r.errors.map((e) => `오류 ${e.message_ko}`), { ok: false, errors: r.errors }); process.exit(1); }
  const issues = K.inspect(site, metaRaw).map((x) => ({ ...x, where: { ...x.where, file: x.where.file && !x.where.file.startsWith('lecpage') ? 'site/' + x.where.file : x.where.file } }));
  const checkDir = join(work, 'check'); rmSync(checkDir, { recursive: true, force: true }); mkdirSync(checkDir, { recursive: true });
  const shots = [];
  let rendered = [], browserNote = '';
  const pw = args['no-shots'] ? null : await loadPlaywright();
  if (pw) {
    const server = staticServer(dist);
    await new Promise((ok) => server.listen(+args.port || 0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    let browser;
    try {
      browser = await pw.chromium.launch();
      for (const p of r.report.pages) {
        const page = await browser.newPage();
        const errs = [];
        page.on('pageerror', (e) => errs.push(String(e.message || e).slice(0, 160)));
        page.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy|Refused to/i.test(m.text())) errs.push(m.text().slice(0, 200)); });
        const name = p.replace(/\.html$/, '');
        const found = await K.inspectPage(page, base + p, { file: 'site/' + p, shots: (w) => { const f = join(checkDir, `${name}-${w}.png`); shots.push(f); return f; } });
        rendered.push(...found);
        for (const e of [...new Set(errs)].slice(0, 6)) rendered.push({ id: /Content Security Policy|Refused/.test(e) ? 'csp-blocked' : 'page-error', level: 'error', where: { file: 'site/' + p, selector: '', section: '' }, message_ko: `${/Content Security Policy|Refused/.test(e) ? 'CSP가 막은 것' : '스크립트 오류'}: ${e}`, fix_hint_ko: /Refused/.test(e) ? '허용되지 않은 바깥 주소·인라인 코드를 빼 주세요(references/kit.md CSP).' : 'site/assets/의 스크립트를 고쳐 주세요(브라우저 콘솔과 같은 오류).' });
        await page.close();
      }
    } catch (e) { browserNote = `화면 검수를 건너뛰었어요: ${String(e.message).split('\n')[0].slice(0, 120)}`; }
    finally { await browser?.close(); server.close(); }
  } else browserNote = args['no-shots'] ? '' : '화면 검수·그림을 건너뛰었어요(Playwright 없음: npm i -g playwright && npx playwright install chromium).';
  // 문구(살펴볼 곳만): 번역투·빈 구호·긴 버튼 이름. 교재에서 그대로 옮긴 글(material.md에 있는 글)은 세지 않음
  const copy = [];
  try {
    const { lintHtml } = await import(pathToFileURL(join(HERE, 'copy-lint.mjs')).href);
    let mat = ''; try { mat = readFileSync(join(work, 'material.md'), 'utf8'); } catch { /* 없음 */ }
    const src = mat ? { material: { pages: [{ paragraphs: [{ text: mat }] }] } } : {};
    for (const p of r.report.pages) if (typeof site[p] === 'string') for (const f of lintHtml(site[p], p, src).slice(0, 12)) copy.push({ id: 'copy', level: 'warn', where: { file: 'site/' + p, selector: '', section: '' }, message_ko: `문구 "${String(f.hit).slice(0, 30)}": ${f.why}`, fix_hint_ko: `${f.fix} (references/copywriting.md)` });
  } catch { /* 문구 점검이 없으면 건너뜀 */ }
  // 같은 문제는 폭마다 한 번만
  const seen = new Set();
  const all = [...issues, ...rendered, ...copy].filter((x) => { const k = `${x.id}|${x.where.file}|${x.where.selector}|${x.message_ko.replace(/\d+(\.\d+)?/g, '#')}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const errors = all.filter((x) => x.level === 'error');
  writeFileSync(join(checkDir, 'report.json'), JSON.stringify({ summary: K.issueSummary(all), issues: all, warnings: r.warnings, report: r.report, collected: r.collected }, null, 2) + '\n');
  writeFileSync(join(checkDir, 'issues.md'), `# 검수 결과 (${K.issueSummary(all)})\n\n${K.issuesForAi(all, { max: 80 }) || '고칠 곳이 없어요.'}\n\n## 조립 알림\n${r.warnings.map((w) => `- ${w.message_ko}`).join('\n') || '- 없음'}\n`);
  const line = (x) => `${x.level === 'error' ? '고칠 곳' : '살펴볼 곳'} ${x.where.file}${x.where.selector ? ' ' + x.where.selector : ''}${x.where.width ? ` (${x.where.width}px)` : ''}: ${x.message_ko}`;
  say([
    `조립 ${rel(dist)}: 쪽 ${r.report.pages.length} · 파일 ${r.report.files}개 · ${r.report.sizeKB}KB · 참여 기능 ${r.report.live === 'none' ? '없음' : `${r.report.live}(${r.report.features.join(',')})`}`,
    r.collected ? `키트 투표 ${r.collected.polls.length} · 실습 단계 ${r.collected.steps.length} · 교재 쪽 ${r.collected.deck.length} · 질문 ${r.collected.qa ? '있음' : '없음'} · 보드 ${r.collected.board.length} · 설문 ${r.collected.survey.length}` : '',
    `검수 ${K.issueSummary(all)}`,
    ...[...errors, ...all.filter((x) => x.level !== 'error')].slice(0, 10).map(line),
    all.length > 10 ? `… 나머지는 ${rel(join(checkDir, 'issues.md'))}` : '',
    r.warnings.length ? `조립 알림 ${r.warnings.length}: ${r.warnings.slice(0, 3).map((w) => w.message_ko).join(' / ')}` : '',
    shots.length ? `화면 그림 ${shots.map((s) => rel(s)).join(' · ')}` : '', browserNote,
  ], { ok: !errors.length, dist, issues: all, warnings: r.warnings, shots, report: r.report });
  process.exitCode = errors.length ? 1 : 0;
}

/** preview <work> [--port 4173] [--host] */
export async function previewCmd(h) {
  const { args, staticServer, say } = h;
  const work = resolve(args._[0] || 'work');
  const { r, dist } = await buildWorkV2(h, work);
  if (r.errors?.length) { say(r.errors.map((e) => `오류 ${e.message_ko}`), { ok: false, errors: r.errors }); process.exit(1); }
  const port = +args.port || 4173;
  const u = `http://localhost:${port}/`;
  staticServer(dist).listen(port, args.host || '127.0.0.1', () => {
    say([`미리보기: ${u}  (끝내려면 Ctrl+C${args.host ? '' : ' · 같은 와이파이의 다른 기기에서 보려면 --host 0.0.0.0'})`, `${existsSync(join(dist, 'console.html')) ? `강사 화면 ${u}console.html · ` : ''}발표 화면 ${u}screen.html · QR 안내문 ${u}poster.html`, r.report.live === 'local' ? '참여 기능은 연습 모드예요(이 브라우저 안에서만 이어져요).' : '', r.warnings.length ? `조립 알림 ${r.warnings.length}개 — check로 자세히` : ''], { ok: true, url: u, dist });
  });
}

// ── 앱과 주고받기(.lecpage v2) ─────────────────────────
const MB100 = 100e6;
const kbText = (n) => { const kb = Math.round(n / 1024); return kb >= 1024 ? (kb / 1024).toFixed(1) + 'MB' : kb + 'KB'; };

/** app work → <연수 이름>.lecpage(v2): 사이트 폴더·연수 정보·교재 쪽 그림·쪽 제목·교재 원본. 참여 기능 키·관리자 키는 담지 않음 */
export async function appPackV2(h, work) {
  const { args, N, rel, fail, say, readJson } = h;
  const K = await imp('src/kit/index.js');
  const P = await imp('src/project-file.js');
  if (!existsSync(join(work, 'site', 'index.html'))) fail(`${rel(join(work, 'site'))}/index.html이 없어요. 사이트를 먼저 쓰고 check로 확인해 주세요.`);
  const metaRaw = readJson(join(work, 'lecpage.json'));
  const teacherPath = join(work, 'lecpage.teacher.json');
  const teacher = existsSync(teacherPath) ? readJson(teacherPath) : null;
  const { meta, errors } = K.readMeta(metaRaw, { prev: teacher }); // 강사 값은 lecpage.teacher.json(강사가 정한 것)에서만
  if (errors.length) fail('lecpage.json: ' + errors.map((e) => e.message_ko).join(' / '));
  const site = readSite(N, join(work, 'site'));
  let pages = []; try { pages = JSON.parse(readFileSync(join(work, '.lecpage', 'pages.json'), 'utf8')); } catch { /* 없음 */ }
  let sources = []; try { sources = JSON.parse(readFileSync(join(work, '.lecpage', 'sources.json'), 'utf8')); } catch { /* 없음 */ }
  const originals = [], big = [];
  for (const s of sources) {
    if (!s.path || !existsSync(s.path) || !statSync(s.path).isFile()) continue;
    if (statSync(s.path).size > MB100) { big.push(s.name); continue; }
    originals.push({ name: s.name || basename(s.path), bytes: new Uint8Array(readFileSync(s.path)) });
  }
  const r = K.packProjectV2({ site, meta, material: { pages }, sources: sources.map(({ path, renderOf, ...x }) => x), originals });
  const out = resolve(args.o || join(dirname(work), P.projectFileName(meta.title)));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, r.bytes);
  const n = Object.keys(site).length, imgs = Object.keys(site).filter((k) => k.startsWith('material/')).length;
  say([
    `앱으로 넘길 파일 ✓ ${rel(out)} (${kbText(r.bytes.length)})`,
    `담은 것 사이트 파일 ${n - imgs}개 · 교재 쪽 그림 ${imgs} · 연수 정보 · 쪽 제목 ${pages.length} · 교재 원본 ${originals.length}`,
    '담지 않은 것 참여 기능 키·관리자 키(앱에서 다시 정해요)',
    r.dropped.length || big.length ? `뺀 파일 ${r.dropped.length + big.length}: ${[...r.dropped, ...big.map((x) => x + '(100MB 넘음)')].slice(0, 4).join(', ')}` : '',
    `강사에게 ${P.APP_URL} 를 열고 [저장한 파일 열기]로 이 파일을 열면 미리보기·고치기·배포를 화면에서 이어 해요.`,
  ], { ok: true, file: out, bytes: r.bytes.length, files: n, slides: imgs, originals: originals.length, dropped: [...r.dropped, ...big], app: P.APP_URL });
}

/** app 연수.lecpage(v2) -o work → work/site·lecpage.json·교재 원본. 파일 안의 강사 값은 그대로 쓰지 않고 따로 둠(남이 준 파일일 수 있어서) */
export async function appUnpackV2(h, o) {
  const { args, N, rel, fail, say, writeJson } = h;
  const K = await imp('src/kit/index.js');
  const work = resolve(args.o || 'work');
  if ((existsSync(join(work, 'lecpage.json')) || existsSync(join(work, 'site', 'index.html'))) && !args.force) fail(`${rel(work)}에 사이트가 이미 있어요. 다른 폴더를 -o로 주거나, 덮어쓰려면 --force를 붙여 주세요.`);
  if (args.force) rmSync(join(work, 'site'), { recursive: true, force: true });
  N.writeFiles(join(work, 'site'), o.site);
  const meta = { ...o.meta };
  for (const k of K.TEACHER_KEYS) delete meta[k];
  writeJson(join(work, 'lecpage.json'), meta);
  writeJson(join(work, '.lecpage', 'pages.json'), o.material?.pages || []);
  const srcFiles = [];
  for (const x of o.originals || []) { N.writeFiles(join(work, 'src'), { [x.name]: x.bytes }); srcFiles.push(join(work, 'src', x.name)); }
  writeJson(join(work, '.lecpage', 'sources.json'), (o.sources || []).map((s) => ({ ...s, path: srcFiles.find((f) => basename(f) === String(s.name || '').replace(/[^\w가-힣.\-]+/g, '_')) || '' })));
  const t = o.teacherInFile || {};
  const given = Object.entries(t).filter(([k, v]) => v && !(k === 'access' && v === 'link') && !(typeof v === 'object' && !Object.values(v).some(Boolean)));
  if (given.length) writeJson(join(work, 'lecpage.teacher.from-file.json'), Object.fromEntries(given));
  h.saveState(work, { v: 2, out: 'dist', from: 'app' });
  const imgs = Object.keys(o.site).filter((k) => k.startsWith('material/')).length;
  say([
    `앱에서 저장한 연수 ✓ 「${String(o.title || meta.title || '이름 없음').slice(0, 40)}」 → ${rel(work)} · 사이트 파일 ${Object.keys(o.site).length - imgs}개 · 교재 쪽 그림 ${imgs} · 교재 원본 ${srcFiles.length}`,
    o.note ? `알림 ${o.note}` : '',
    given.length ? `파일에 강사 값이 있었어요(${given.map(([k]) => k).join('·')}) → ${rel(join(work, 'lecpage.teacher.from-file.json'))}. 강사에게 맞는지 묻고 lecpage.teacher.json으로 옮겨요` : '',
    `다음 check ${rel(work)}`,
  ], { ok: true, work, files: Object.keys(o.site).length, slides: imgs, originals: srcFiles, teacherInFile: Object.fromEntries(given) });
}
