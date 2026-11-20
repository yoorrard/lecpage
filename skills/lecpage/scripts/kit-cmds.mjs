// AI 에이전트 흐름(docs/plan-ai-first.md §9) 명령: prepare(교재 → 쪽 그림·보조 글자·안내), check(조립·검수·화면 그림), preview(로컬 미리보기).
// 에이전트가 사이트(work/site/)와 연수 정보(work/lecpage.json)를 직접 쓰고, lecpage는 준비·조립·검수만 합니다.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, copyFileSync, statSync } from 'node:fs';
import { join, resolve, dirname, basename, extname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(HERE, '..', 'engine');
const REF = join(HERE, '..', 'references');
const imp = (p) => import(pathToFileURL(join(ENGINE, p)).href);
const TEXT = /\.(html|css|m?js|json|txt|vtt|md)$/i;
const pad3 = (n) => String(n).padStart(3, '0');

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

/** 조립 결과를 work/dist에 씀(예전 결과는 지움) */
function writeDist(N, work, files) {
  const dist = join(work, 'dist');
  rmSync(dist, { recursive: true, force: true });
  N.writeFiles(dist, files);
  return dist;
}

/** check <work> [--port] [--no-shots] */
export async function checkCmd(h) {
  const { args, N, rel, say, loadPlaywright, staticServer } = h;
  const work = resolve(args._[0] || 'work');
  const { K, site, metaRaw, r } = await assembleWork(h, work);
  if (r.errors?.length) { say(r.errors.map((e) => `오류 ${e.message_ko}`), { ok: false, errors: r.errors }); process.exit(1); }
  const dist = writeDist(N, work, r.files);
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
  // 같은 문제는 폭마다 한 번만
  const seen = new Set();
  const all = [...issues, ...rendered].filter((x) => { const k = `${x.id}|${x.where.file}|${x.where.selector}|${x.message_ko.replace(/\d+(\.\d+)?/g, '#')}`; if (seen.has(k)) return false; seen.add(k); return true; });
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
  const { args, N, rel, staticServer, say } = h;
  const work = resolve(args._[0] || 'work');
  const { r } = await assembleWork(h, work);
  const dist = writeDist(N, work, r.files);
  const port = +args.port || 4173;
  staticServer(dist).listen(port, args.host || '127.0.0.1', () => {
    say([`미리보기: http://localhost:${port}/  (끝내려면 Ctrl+C)`, `강사 화면 http://localhost:${port}/console.html · 발표 화면 /screen.html`, r.report.live === 'local' ? '참여 기능은 연습 모드예요(이 브라우저 안에서만 이어져요).' : '', r.warnings.length ? `조립 알림 ${r.warnings.length}개 — check로 자세히` : ''], { ok: true, url: `http://localhost:${port}/`, dist });
  });
}
