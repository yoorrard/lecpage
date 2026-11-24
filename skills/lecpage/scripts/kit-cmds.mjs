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

/** 작업 폴더인지: site/ + lecpage.json */
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
const PAGE_IMG = /^p-(\d{3,4})\.(webp|png|jpe?g)$/i;
const stemOf = (n) => String(n || '').normalize('NFC').replace(/\.[^.]+$/, '').toLowerCase();
/** 교재 안 자리: 슬라이드·PDF는 '3쪽', 한글·워드·글은 제목으로 나눈 '3번째 부분'(실제 쪽이 아님) */
const placeOf = (p) => (p.unit === 'section' ? `${p.filePage}번째 부분` : `${p.filePage}쪽`);
/**
 * 글자·단추·그림에 걸린 링크 가운데 쪽 글에 주소가 보이지 않는 것 → ['이름 → 주소'].
 * 쪽 그림에는 이름만 보이고, PDF 원본을 읽어도 주소는 나오지 않아(실측) 에이전트가 알 길이 없음
 */
function hiddenLinks(p, text) {
  const out = [], seen = new Set();
  for (const l of p.links || []) {
    const url = String(l?.url || '').trim();
    if (!url || l.from === 'text' || seen.has(url) || text.includes(url)) continue;
    seen.add(url);
    const label = String(l.label || '').replace(/\s+/g, ' ').trim();
    out.push(label && label !== url ? `${label} → ${url}` : url);
  }
  return out;
}

/**
 * ingest 결과 → 쪽 목록(교재 여러 개면 번호를 이어서: 첫 교재 1~12, 둘째 13부터). PPTX와 함께 준 같은 내용의 PDF(renderOf)는 쪽 그림만 그리는 데 써서 쪽을 두 번 세지 않음.
 * image(n, p): 그 쪽 그림 경로를 돌려줌(prepare가 그림을 옮김), 없으면 ''
 */
function ingestPages(m, image = () => '') {
  const files = Object.fromEntries((m.files || []).map((f) => [f.id, f]));
  const renderOnly = new Set((m.files || []).filter((f) => f.renderOf).map((f) => f.id));
  return m.pages.filter((p) => !renderOnly.has(p.file)).map((p, i) => {
    const title = String(p.title || '').trim();
    const f = files[p.file] || {};
    const text = pageText(p);
    return { page: i + 1, file: f.name || '', fileId: p.file, pdf: f.type === 'pdf', unit: f.unit || 'page', filePage: p.page, hidden: !!p.hidden, title, text, links: hiddenLinks(p, `${title}\n${text}`), notes: String(p.notes || '').trim(), image: image(i + 1, p) };
  });
}
/**
 * 이미 놓인 쪽 그림(lecpage 커넥트: 앱이 브라우저 안에서 그려 보낸 site/material/p-NNN.*)을 쪽에 맞춤. 교재 하나의 쪽 그림일 때(1번부터). 교재마다 그려 보낸 것은 fitGivenSets가 묶음마다 이 함수를 부름.
 * of: 그 교재 이름(앱이 알려 줄 때). 없으면 교재가 하나(같은 이름의 PDF 짝 포함)일 때만 그 교재로 봄.
 * 슬라이드·PDF면 쪽마다 번호·그림을 맞추고(숨긴 슬라이드는 그림이 없음), 한글·워드처럼 '부분'으로 읽은 교재나 어느 교재인지 모를 때는 맞추지 않음(틀린 짝을 알리지 않게).
 * 맞춘 쪽만 page(=그림 번호)·image를 갖고 나머지는 page 0 → { owner: 교재 이름|'', mapped: 맞춘 쪽 수 }
 */
function fitGivenImages(m, pages, given, of = '', { base = 0, keep = false } = {}) { // base·keep: fitGivenSets가 교재마다 부를 때(그림 번호 = base + 그 교재의 쪽, 앞서 맞춘 쪽은 그대로)
  if (!keep) for (const p of pages) { p.page = 0; p.image = ''; }
  const files = (m.files || []).filter((f) => f.type !== 'link');
  const stems = new Set(files.map((f) => stemOf(f.name)));
  const want = of ? stemOf(of) : stems.size === 1 ? [...stems][0] : '';
  const cand = want ? files.filter((f) => stemOf(f.name) === want) : [];
  if (!cand.length) return { owner: '', mapped: 0 };
  const pagesOf = (f) => pages.filter((p) => p.fileId === f.id);
  const visible = (list, skips) => { const v = list.filter((p) => !p.hidden); return skips || (given.length !== list.length && given.length === v.length) ? v : list; };
  // 같은 이름의 PDF가 있으면 쪽 그림은 그 PDF에서 그린 것(앱: 이 PC의 프로그램으로 만든 PDF·함께 넣은 PDF)
  const pdf = cand.find((f) => f.type === 'pdf');
  const deck = pdf?.renderOf ? files.find((f) => f.id === pdf.renderOf) : null;
  const own = deck || (pdf && pagesOf(pdf).length ? pdf : cand.find((f) => pagesOf(f).length)) || null;
  const owner = (own || cand.find((f) => f.name === of) || cand[0]).name;
  if (!own || own.unit === 'section') return { owner, mapped: 0 };
  const target = deck ? visible(pagesOf(deck), !!pdf.skipsHidden) : own.type === 'pdf' ? pagesOf(own) : visible(pagesOf(own), true); // 브라우저 안에서 그린 PPTX는 숨긴 슬라이드를 건너뜀
  if (given.some((g) => g.n > target.length)) return { owner, mapped: 0 };
  for (const g of given) { target[g.n - 1].page = base + g.n; target[g.n - 1].image = `material/${g.name}`; }
  return { owner, mapped: given.length };
}
/**
 * 앱이 교재마다 그려 이어서 번호를 매겨 보낸 쪽 그림(lecpage 커넥트, LECPAGE_GIVEN_IMAGES_SETS=[{ name, first, count }]): 묶음마다 그 교재의 쪽에 맞춤.
 * → { owner: '', mapped: 맞춘 쪽 수, sets: [{ owner: 교재 이름, first, last, count: 놓인 그림 수, mapped }] } (그림이 하나도 없는 묶음은 뺌)
 */
function fitGivenSets(m, pages, given, sets) {
  for (const p of pages) { p.page = 0; p.image = ''; }
  const out = [];
  for (const s of sets) {
    const part = given.filter((g) => g.n >= s.first && g.n < s.first + s.count).map((g) => ({ name: g.name, n: g.n - s.first + 1 }));
    if (!part.length) continue;
    const r = fitGivenImages(m, pages, part, s.name, { base: s.first - 1, keep: true });
    out.push({ owner: r.owner || s.name, first: s.first, last: s.first + s.count - 1, count: part.length, mapped: r.mapped });
  }
  return { owner: '', mapped: out.reduce((n, x) => n + x.mapped, 0), sets: out };
}
/**
 * prepare가 그린 쪽 그림 가운데 문서형 교재(워드·한글)의 것이 있을 때: 그 교재는 읽은 단위가 '부분'이고 그림은 실제 쪽이라 부분마다 붙일 수 없음
 * (ingest/cli.js attachSlides가 files[].pageImages에 둠). 버리지 않고 site/material/p-NNN에 교재 차례대로 이어서 번호를 매겨 둠:
 * 슬라이드·PDF는 그린 쪽마다, 문서형은 그린 그림 수만큼. → { list: [{ name, n }], sets: [{ owner, first, last, count, mapped }], imageOf: 쪽(m.pages 항목) → 'material/p-NNN.ext' }
 * 문서형 그림이 없으면 null(지금처럼 쪽 차례 = 그림 번호)
 */
function placeDrawn(m, work, siteDir) {
  const files = (m.files || []).filter((f) => f.type !== 'link' && !f.renderOf);
  if (!files.some((f) => f.unit === 'section' && f.pageImages?.length)) return null;
  const list = [], sets = [], imageOf = new Map(); let n = 0;
  const put = (relPath) => {
    const from = join(work, '.lecpage', relPath);
    if (!existsSync(from)) return '';
    const ext = (extname(relPath) || '.webp').toLowerCase().replace('.jpeg', '.jpg');
    const name = `p-${pad3(++n)}${ext}`; copyFileSync(from, join(siteDir, 'material', name)); list.push({ name, n });
    return `material/${name}`;
  };
  for (const f of files) {
    const first = n + 1; let mapped = 0;
    if (f.unit === 'section') for (const img of f.pageImages || []) put(img);
    else for (const p of (m.pages || []).filter((x) => x.file === f.id && x.image)) { const img = put(p.image); if (img) { imageOf.set(p, img); mapped++; } }
    if (n >= first) sets.push({ owner: f.name, first, last: n, count: n - first + 1, mapped });
  }
  return n ? { list, sets, imageOf } : null;
}
/**
 * 보조 글자(material.md): PDF가 아닌 교재(PPTX·HWP·HWPX·DOCX·글)의 쪽만. 쪽 그림에 없는 발표자 노트와, 쪽 그림을 못 그린 쪽의 글을 찾는 데 씀.
 * PDF는 에이전트가 원본을 직접 읽으므로 코드가 뽑은 글을 두지 않음(순서가 섞이거나 틀린 글을 원본 대신 믿지 않게). 담을 쪽이 없으면 ''
 * 예외 pdfTextMb: 이 크기를 넘는 PDF는 글을 넣음(이 PC의 에이전트가 그 원본을 열지 못할 때 lecpage 커넥트가 정함. 그 PDF의 쪽은 p.pdfText)
 * given: 쪽 그림을 prepare가 그리지 않고 받은 때({ owner, mapped }). 쪽 번호(p-NNN)는 맞춘 쪽에만 붙이고 '(쪽 그림 없음)'은 적지 않음(모르는 것을 없다고 하지 않게)
 */
function materialMd(m, pages, { given = null, pdfTextMb = 0 } = {}) {
  const own = pages.filter((p) => !p.pdf || p.pdfText);
  if (!own.length) return '';
  const names = [...new Set(own.map((p) => p.file))];
  const big = [...new Set(own.filter((p) => p.pdfText).map((p) => p.file))];
  const about = !given ? ''
    : given.sets ? ` 쪽 그림은 교재마다 이어서 번호를 매겼어요(${given.sets.map((x) => `${x.owner} p-${pad3(x.first)}~p-${pad3(x.last)}`).join(', ')}). 쪽마다 맞춘 것은 제목 앞에 p-NNN을 적었어요.`
    : given.mapped ? ` 쪽 그림은 ${given.owner}의 쪽 차례예요(그 쪽은 제목 앞에 p-NNN을 적었어요).`
      : given.owner ? ` 쪽 그림은 ${given.owner}를 쪽마다 그린 것이라 아래 번호와는 차례가 달라요.`
        : ' 쪽 그림이 어느 교재의 몇 쪽인지는 여기 적혀 있지 않아요.';
  const head = (p) => `## ${p.page ? `p-${pad3(p.page)} · ` : ''}${p.file} ${placeOf(p)}${p.title ? ` · ${p.title}` : ''}${p.hidden ? ' (숨긴 슬라이드)' : ''}${given || p.image ? '' : ' (쪽 그림 없음)'}`;
  return [`# 교재 보조 글자 (${names.join(', ')})`, '', `코드가 뽑은 글이라 틀리거나 빠질 수 있어요. 쪽 그림(site/material/p-NNN.webp)과 다르면 쪽 그림이 맞아요. PDF 교재는 여기 없어요(원본을 직접 읽어요).${big.length ? ` 다만 ${pdfTextMb}MB가 넘는 PDF(${big.join(', ')})는 글을 함께 넣었어요.` : ''}${about}`, '',
    ...own.flatMap((p) => [head(p), '', p.text || '(글자 없음)', ...(p.notes ? ['', `> 발표자 노트: ${p.notes.replace(/\n/g, ' ')}`] : []), ''])].join('\n');
}
/** 교재에 걸린 링크 주소(links.md): 쪽 글에 주소가 보이지 않는 링크만(PDF 교재도). 없으면 '' */
function linksMd(pages) {
  const rows = pages.flatMap((p) => p.links.map((l) => `- ${p.file} ${placeOf(p)}: ${l}`));
  return rows.length ? ['# 교재에 걸린 링크 주소', '', '글자·단추·그림에 걸려 있어 쪽 그림과 PDF에서는 주소가 보이지 않는 링크예요. 교재 파일에 적힌 그대로예요.', '', ...rows, ''].join('\n') : '';
}
/** 읽지 못한 교재(오류가 났거나, 오류는 없어도 읽은 쪽이 하나도 없는 파일: 빈 문서·속이 깨진 파일) → [{ name, code, message_ko }] */
function unreadFiles(m) {
  const read = new Set((m.files || []).filter((f) => (m.pages || []).some((p) => p.file === f.id)).map((f) => f.name));
  const out = [];
  for (const e of m.errors || []) if (e?.file && !read.has(e.file) && !out.some((x) => x.name === e.file)) out.push({ name: e.file, code: e.code || 'unknown', message_ko: e.message_ko || '' });
  for (const f of m.files || []) if (f.name && f.type !== 'link' && !read.has(f.name) && !out.some((x) => x.name === f.name)) out.push({ name: f.name, code: 'no-pages', message_ko: '읽을 쪽이 없는 파일이에요. 원본 프로그램에서 다시 저장하거나 PDF로 저장해 올려 주세요.' });
  return out;
}

/**
 * prepare <교재…> -o work
 * lecpage 커넥트가 넘기는 환경 변수(사람이 쓰는 옵션 아님): LECPAGE_GIVEN_IMAGES=1(쪽 그림은 이미 site/material에 있음: 앱이 그려 보냄) ·
 * LECPAGE_GIVEN_IMAGES_OF=<그 교재 이름> · LECPAGE_GIVEN_IMAGES_SETS=<[{ name, first, count }]>(교재마다 그려 이어 매긴 번호) · LECPAGE_PDF_TEXT_MB=<숫자>(이 크기를 넘는 PDF는 글을 material.md에: 그 PC의 에이전트가 원본을 못 열 때)
 */
export async function prepareCmd(h) {
  const { args, rel, fail, say, writeJson } = h;
  const inputs = args._.map((p) => (/^https?:/i.test(p) ? p : resolve(p)));
  if (!inputs.length) fail('교재 파일을 주세요. 예: lecpage.mjs prepare 교재.pdf 교재.pptx -o work');
  const work = resolve(args.o || 'work');
  const siteDir = join(work, 'site'), matDir = join(siteDir, 'material'), tmp = join(work, '.lecpage', 'slides');
  mkdirSync(matDir, { recursive: true }); mkdirSync(tmp, { recursive: true });
  const C = await imp('src/ingest/cli.js');
  const { tangledTitle } = await imp('src/kit/meta.js');
  const t0 = Date.now();
  const m = await C.ingestPaths(inputs, { withImages: false, today: args.today || undefined, python: !args['no-python'] });
  const unread = unreadFiles(m);
  if (!m.pages?.length) fail('교재에서 읽은 내용이 없어요. ' + [...new Set((m.errors || []).map((e) => e.message_ko))].join(' '), { unread });
  // 받은 쪽 그림(커넥트): 그리지 않고 있는 그림을 씀
  let givenList = process.env.LECPAGE_GIVEN_IMAGES === '1' ? readdirSync(matDir).map((name) => ({ name, n: +(PAGE_IMG.exec(name) || [])[1] || 0 })).filter((g) => g.n > 0).sort((a, b) => a.n - b.n) : [];
  const drawn = !givenList.length && !args['no-slides'];
  if (drawn) await C.attachSlides(m, tmp, join(work, '.lecpage', 'material.json'), { onProgress: (d, t) => { if (Date.now() - t0 > 8000 && d % 10 === 0) console.error(`… 쪽 그림 ${d}${t ? '/' + t : ''}`); } });
  // 문서형 교재(워드·한글: 읽은 단위는 '부분', 그린 그림은 실제 쪽)를 그렸으면 그 쪽 그림도 씀(placeDrawn: 교재마다 이어서 번호). 없으면 null
  const placed = drawn ? placeDrawn(m, work, siteDir) : null;
  // 쪽 번호: 교재 여러 개면 이어서(첫 교재 1~12, 둘째 13부터). 그림은 site/material/p-NNN.webp
  let images = 0;
  const pages = ingestPages(m, (n, p) => {
    if (placed) return placed.imageOf.get(p) || '';
    if (!p.image) return '';
    const from = join(work, '.lecpage', p.image);
    const ext = (extname(p.image) || '.webp').toLowerCase().replace('.jpeg', '.jpg');
    if (!existsSync(from)) return '';
    const img = `material/p-${pad3(n)}${ext}`; copyFileSync(from, join(siteDir, img)); images++;
    return img;
  }).map((p) => ({ ...p, title: tangledTitle(p.title) ? '' : p.title }));
  rmSync(join(work, '.lecpage', 'slides'), { recursive: true, force: true });
  let givenSets = []; try { givenSets = (JSON.parse(process.env.LECPAGE_GIVEN_IMAGES_SETS || '[]') || []).filter((x) => x && typeof x.name === 'string' && Number.isInteger(x.first) && Number.isInteger(x.count) && x.first >= 1 && x.count >= 1); } catch { givenSets = []; }
  let given = !givenList.length ? null : givenSets.length ? fitGivenSets(m, pages, givenList, givenSets) : fitGivenImages(m, pages, givenList, process.env.LECPAGE_GIVEN_IMAGES_OF || '');
  if (placed) { // 문서형 교재를 그린 때: 쪽 번호 = 그림 번호(그림과 맞춘 쪽만). 받은 쪽 그림과 같은 꼴로 알림(어느 번호가 어느 교재의 것인지)
    for (const p of pages) p.page = +(PAGE_IMG.exec(p.image.replace(/^material\//, '')) || [])[1] || 0;
    givenList = placed.list;
    given = placed.sets.length === 1 ? { owner: placed.sets[0].owner, mapped: placed.sets[0].mapped } : { owner: '', mapped: placed.sets.reduce((n, x) => n + x.mapped, 0), sets: placed.sets };
  }
  if (given) images = givenList.length;
  const pdfTextMb = Math.max(0, +process.env.LECPAGE_PDF_TEXT_MB || 0);
  if (pdfTextMb) { const big = new Set((m.files || []).filter((f) => f.type === 'pdf' && (f.size || 0) > pdfTextMb * 1048576).map((f) => f.id)); for (const p of pages) if (big.has(p.fileId)) p.pdfText = true; }
  const numbered = pages.filter((p) => p.page > 0).sort((a, b) => a.page - b.page); // 받은 쪽 그림이면 맞춘 쪽만(그림 번호 = 쪽 번호)
  writeJson(join(work, '.lecpage', 'pages.json'), numbered.map(({ page, title, text }) => ({ page, title, text: text.slice(0, 400) })));
  // 교재 목록(앱으로 넘길 때 원본을 함께 담으려고 경로도 적음. 이 컴퓨터 안에서만 씀)
  writeJson(join(work, '.lecpage', 'sources.json'), (m.files || []).filter((f) => f.path).map((f) => ({ name: f.name, type: f.type, pages: f.pages || 0, size: f.size || 0, path: f.path, ...(f.renderOf ? { renderOf: true } : {}) })));
  h.saveState(work, { v: 2, out: 'dist' });
  // 보조 글자(PDF가 아닌 교재만): 쪽 글에 '프롬프트' 같은 꼬리표는 붙이지 않음(무엇이 원문인지는 AI가 쪽 그림과 문맥으로 판단)
  const md = materialMd(m, pages, { given, pdfTextMb });
  if (md) writeFileSync(join(work, 'material.md'), md); else rmSync(join(work, 'material.md'), { force: true });
  const links = linksMd(pages);
  if (links) writeFileSync(join(work, 'links.md'), links); else rmSync(join(work, 'links.md'), { force: true });
  const metaPath = join(work, 'lecpage.json');
  if (!existsSync(metaPath)) writeJson(metaPath, { v: 2, title: '', subtitle: '', sessions: [], venue: '', mode: 'offline', audience: 'teachers', instructors: [], features: [], theme: {}, facts: [] });
  const originals = inputs.filter((p) => !/^https?:/i.test(p));
  const last = given ? givenList[givenList.length - 1].n : pages.length;
  writeFileSync(join(work, 'README.md'), readmeText({ work, last, images, originals, md: !!md, links: !!links, unread }));
  const noImg = pages.filter((p) => !p.image && !p.pdf); // PDF 쪽은 원본을 읽으니 셈하지 않음
  // 교재마다: 읽은 쪽 수(한글·워드·글은 부분 수) · 쪽 그림 수(받은 쪽 그림이 그 교재 것이면 그 장수) · 같은 내용의 PDF 짝(twin)
  const files = (m.files || []).filter((f) => f.type !== 'link' && !unread.some((u) => u.name === f.name)).map((f) => {
    const own = pages.filter((p) => p.fileId === f.id);
    return { name: f.name, type: f.type || '', unit: f.unit || '', pages: own.length, images: given?.sets?.some((x) => x.owner === f.name && !x.mapped) ? given.sets.filter((x) => x.owner === f.name).reduce((n, x) => n + x.count, 0) : given && given.owner === f.name && !given.mapped ? givenList.length : own.filter((p) => p.image).length, ...(f.renderOf ? { twin: true } : {}), ...(own.some((p) => p.pdfText) ? { text: true } : {}) };
  });
  // 알리는 쪽 수 = 사이트에 놓이는 쪽: 슬라이드·PDF는 읽은 쪽 수, 문서형(워드·한글·글: 읽은 단위는 제목으로 나눈 '부분')은 그 교재의 쪽 그림 수.
  // 부분은 쪽이 아니라서 쪽 수에 넣지 않고(워드 5개 부분 + 쪽 그림 1장을 '5쪽'이라 하지 않게), 쪽 그림이 없는 문서형 교재는 '글로 읽은 교재'로 따로 알림.
  // 받은 쪽 그림이 어느 교재 것인지 모를 때(교재에 맞추지 못한 그림이 남음)는 그림 수를 쪽 수로 보고, 어느 교재에 그림이 없다고 하지 않음
  const assigned = files.reduce((n, f) => n + f.images, 0);
  const total = Math.max(files.reduce((n, f) => n + (f.unit === 'section' ? f.images : f.pages), 0), images);
  const textOnly = images > assigned ? [] : files.filter((f) => f.unit === 'section' && !f.images && f.pages);
  const missing = total - images; // 쪽 그림이 없는 슬라이드·PDF 쪽(숨긴 슬라이드, 그리지 못한 쪽, --no-slides)
  const count = !total ? '' : !missing ? `교재 ${total}쪽(쪽 그림 site/material/${last !== images ? '' : last > 1 ? `p-001~p-${pad3(last)}` : 'p-001'})` : `교재 ${total}쪽 · 쪽 그림 ${images}장(site/material/)`;
  const asText = textOnly.length ? `글로 읽은 교재 ${textOnly.map((f) => `${f.name} ${f.pages}개 부분`).join(', ')}(쪽 그림 없음)` : '';
  say([
    `준비 ${rel(work)}: ${[count, asText].filter(Boolean).join(' · ')}${md ? ' · 보조 글자 material.md(PDF가 아닌 교재)' : ''}${links ? ' · 링크 주소 links.md' : ''}`,
    ...unread.map((u) => `주의 ${u.name}: 읽지 못했어요(이 교재는 빠졌어요). ${u.message_ko}`),
    !given && (missing > 0 || textOnly.length) && !args['no-slides'] && !(m.warnings || []).some((w) => w.code === 'render-failed') ? `주의 ${missing > 0 ? `쪽 그림을 ${missing}쪽 만들지 못했어요` : `${textOnly.map((f) => f.name).join(', ')}의 쪽 그림을 만들지 못했어요`}(LibreOffice·pdftoppm 확인: lecpage.mjs doctor).` : '',
    !given && noImg.length && images ? `쪽 그림이 없는 쪽은 material.md의 글로 읽어요(${noImg.slice(0, 3).map((p) => p.page).join('·')}${noImg.length > 3 ? '…' : ''}쪽).` : '',
    ...(m.warnings || []).filter((w) => w.code !== 'python-fallback').slice(0, 3).map((w) => `주의 ${w.file ? `${w.file}: ` : ''}${w.message_ko}`),
    `다음 교재 원본·쪽 그림 읽기 → ${rel(join(work, 'site'))}/index.html·${rel(join(work, 'lecpage.json'))} 쓰기 → check ${rel(work)} (이 작업의 경로 요약: ${rel(join(work, 'README.md'))})`,
  ], { ok: true, work, pages: pages.length, images, readme: join(work, 'README.md'), files, unread, ...(given ? { given } : {}), ...(links ? { links: true } : {}) });
}

function readmeText({ work, last, images, originals, md, links, unread = [] }) {
  const range = images ? `p-001 ~ p-${pad3(last)}` : '없음';
  const L = `node ${join(HERE, 'lecpage.mjs')}`;
  return `# 이 작업의 경로

- 교재 원본: ${originals.map((p) => `\`${p}\``).join(', ') || '(주소로 받은 교재)'} — PDF는 원본을 직접 읽어요.
- 쪽 그림: \`site/material/\` (${range}, 교재 여러 개는 이어서 번호). 사이트에 그대로 써도 돼요(\`material/p-001.webp\`).
${md ? '- 보조 글자: `material.md` (PDF가 아닌 교재에서 코드가 뽑은 글·발표자 노트. 쪽 그림과 다르면 쪽 그림이 맞아요)\n' : ''}${links ? '- 링크 주소: `links.md` (글자·단추에 걸려 있어 쪽 그림과 PDF에서는 보이지 않는 주소)\n' : ''}${unread.length ? `- 읽지 못한 교재: ${unread.map((u) => `\`${u.name}\``).join(', ')} (내용이 빠졌어요. PDF로 저장해 다시 주면 읽어요)\n` : ''}- 강의 기능 자리 표시(쓰고 싶을 때만): \`${join(REF, 'kit.md')}\`
- 쓸 곳: \`site/\`(첫 쪽 \`index.html\`, 나머지 구성은 자유) · 연수 정보 \`lecpage.json\`

## 확인(원하면)
\`\`\`
${L} check ${work}     # 조립 + 검수 + 390·1280 화면 그림(check/)
${L} preview ${work}   # 로컬 미리보기(강사 화면·발표 화면도)
\`\`\`
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
  // extra.prev: 강사 값을 바꿔 조립할 때(serve --live가 참여 기능 서버를 '같은 주소'로 둠). 없으면 파일 그대로
  const prev = extra.prev || (existsSync(prevPath) ? readJson(prevPath) : null);
  let material = null; try { material = { pages: JSON.parse(readFileSync(join(work, '.lecpage', 'pages.json'), 'utf8')) }; } catch { /* 없음 */ }
  const r = K.assemble(site, metaRaw, { runtime: N.nodeRuntime(), prev, today: h.args.today, material, materials: unlistedFiles(site), ...(extra.host ? { host: extra.host } : {}) });
  return { K, site, metaRaw, prev, r };
}
/**
 * site/files/(또는 assets/files/)에 넣었는데 사이트 어디에도 걸지 않은 파일 → 자료실 목록(앱의 [자료 추가]와 같음).
 * 자료실 자리 표시(data-lp="materials")가 있으면 거기에, 없으면 키트가 첫 쪽 끝에 자료 칸을 붙여 참가자가 받을 수 있게 함
 */
export function unlistedFiles(site = {}) {
  const used = Object.entries(site).filter(([, v]) => typeof v === 'string').map(([, v]) => v).join('\n');
  const kb = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1e3))}KB`);
  return Object.keys(site).filter((p) => /^(assets\/)?files\/[^/]+$/.test(p) && !used.includes(p) && !used.includes(encodeURI(p))).sort().map((p) => {
    const name = p.split('/').pop(); const ext = (/\.([a-z0-9]+)$/i.exec(name) || [])[1] || '';
    const v = site[p];
    return { title: name.replace(/\.[^.]+$/, ''), href: p, kind: ext.toUpperCase(), size: kb(typeof v === 'string' ? v.length : v?.byteLength || v?.length || 0) };
  });
}
const relp = (a, b) => relative(a, b) || '.';

/** 조립 결과를 work/dist에 씀. 예전 결과는 지우되 강사가 넣은 배포 설정(.git·.vercelignore 같은 점 파일, CNAME, vercel.json 등)은 남김 */
const KEEP_IN_DIST = new Set(['CNAME', 'vercel.json', 'netlify.toml', 'staticwebapp.config.json', 'firebase.json']);
function writeDist(N, work, files) {
  const dist = join(work, 'dist');
  if (existsSync(dist)) for (const n of readdirSync(dist)) if (!n.startsWith('.') && !KEEP_IN_DIST.has(n)) rmSync(join(dist, n), { recursive: true, force: true });
  N.writeFiles(dist, files);
  return dist;
}
/**
 * 공개 범위가 암호인데 work/dist에 잠그지 않은 사이트(암호를 정하기 전에 조립한 것)가 남아 있으면 비움: 그 폴더를 그대로 올리면 암호 없이 열리므로.
 * 잠근 사이트(pack·publish --password가 만든 것: 첫 쪽에 lp-locked)는 그대로 둠 → 비웠으면 true
 */
function dropPlainDist(work) {
  const dist = join(work, 'dist'), first = join(dist, 'index.html');
  if (!existsSync(first) || /id="lp-locked"/.test(readFileSync(first, 'utf8'))) return false;
  for (const n of readdirSync(dist)) if (!n.startsWith('.') && !KEEP_IN_DIST.has(n)) rmSync(join(dist, n), { recursive: true, force: true });
  return true;
}

/**
 * v2 작업 폴더 조립 → work/dist(올릴 사이트) + work/dist-강사용/운영안내.md(올리지 않음). publish·pack·app·serve·handouts가 함께 씀
 * @param o.fonts 글꼴 함께 담기(사이트가 쓰는 글꼴 CDN의 글꼴을 쓰인 글자만 사이트 안으로: 학교망이 CDN을 막아도 같은 글꼴, 못 받으면 CDN 그대로)
 * @param o.password 암호로 잠그기(쪽·교재 쪽 그림·자료실 파일, 접속 확인·개인정보 안내만 열어 둠). 공개 범위가 password인데 암호가 없으면 오류
 * @param o.host 배포할 곳(decide/infra.js HOSTS id: cloudflare·onpod·vercel·github-pages·netlify·lan·zip …). 개인정보 안내·운영안내가 그 방식에 맞게
 * @param o.plain 공개 범위가 password인데 암호가 없어도 멈추지 않음(check·preview: 살펴보는 데는 암호가 필요 없음). 잠그기 전 사이트를
 *   work/.lecpage/check-site에만 쓰고(dist가 그 폴더), 올리는 work/dist에는 잠그지 않은 사이트를 두지 않음(있던 것은 비움) → needsPassword: true
 * @returns { ok, errors, dist, tdir, r(assemble 결과), K, site, metaRaw, notes:[한 줄], access, needsPassword?, cleared? }
 */
export async function buildWorkV2(h, work, { fonts = false, password = '', host = '', plain = false } = {}) {
  const a = await assembleWork(h, work, { host });
  if (a.r.errors?.length) return { ok: false, errors: a.r.errors, ...a };
  const needsPassword = a.r.meta.access === 'password' && !password;
  if (needsPassword && !plain) return { ok: false, errors: [{ code: 'password', message_ko: '공개 범위가 암호(lecpage.teacher.json access: password)예요. --password 값이나 LECPAGE_PASSWORD 환경 변수를 주세요.' }], ...a };
  if (needsPassword) {
    const dir = join(work, '.lecpage', 'check-site');
    rmSync(dir, { recursive: true, force: true }); h.N.writeFiles(dir, a.r.files);
    const cleared = dropPlainDist(work);
    const tdir = join(work, 'dist') + '-강사용';
    if (a.r.teacher && Object.keys(a.r.teacher).length) h.N.writeFiles(tdir, a.r.teacher);
    h.saveState(work, { v: 2, out: 'dist' });
    return { ok: true, dist: dir, tdir, notes: [], access: 'password', needsPassword: true, cleared, ...a };
  }
  let files = a.r.files;
  const notes = [];
  if (fonts) {
    const fb = await h.E.bundleFonts(files);
    if (fb.report.ok && fb.report.external) { files = fb.files; notes.push(`글꼴 함께 담기: 외부 글꼴 ${fb.report.external}곳 → 사이트 안 파일 ${fb.report.bundled}개(${Math.round(fb.report.bytes / 1024)}KB)${fb.report.subset ? `, 사이트 글자만 남긴 글꼴 ${fb.report.subset}개` : ''}`); }
    else if (!fb.report.ok) notes.push(`글꼴을 받지 못해 CDN 주소 그대로 뒀어요(${fb.report.skipped.join(', ').slice(0, 120)})${(process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY ? ' — 프록시를 거치는 곳이면 NODE_USE_ENV_PROXY=1 을 붙여 다시 실행하세요' : ''}`);
  }
  if (password) {
    const adv = h.E.passwordAdvice(password);
    if (adv.level !== 'good') notes.push(adv.message.replace('[새로 만들기]로 바꾸거나 ', ''));
    const { webcrypto } = await import('node:crypto');
    files = await h.E.protectSite(files, password, { runtime: h.N.nodeRuntime(), title: a.r.meta.title || '연수 사이트', crypto: webcrypto });
    notes.push(`암호로 잠금: 쪽 ${Object.keys(files).filter((p) => /^[^/]+\.html$/.test(p) && /id="lp-locked"/.test(files[p])).length}개·자료 ${Object.keys(files).filter((p) => p.endsWith('.enc')).length}개(접속 확인·개인정보 안내는 열어 둠)`);
  }
  const dist = writeDist(h.N, work, files);
  const tdir = dist + '-강사용';
  if (a.r.teacher && Object.keys(a.r.teacher).length) h.N.writeFiles(tdir, a.r.teacher);
  h.saveState(work, { v: 2, out: 'dist' });
  return { ok: true, dist, tdir, notes, access: password ? 'password' : a.r.meta.access, ...a };
}

/** check <work> [--port] [--no-shots] */
export async function checkCmd(h) {
  const { args, N, rel, say, loadPlaywright, staticServer } = h;
  const work = resolve(args._[0] || 'work');
  // 배포할 곳: --host, 없으면 지난번에 배포한 곳(개인정보 안내·운영안내가 그 방식에 맞게)
  const st = h.loadState(work);
  const host = String(args.host || st.deploy?.host || st.hostHint || '');
  // 살펴보는 데는 암호가 필요 없음(plain): 공개 범위가 암호면 잠그기 전 사이트를 검수용 폴더에 두고 봄. 암호는 pack·publish에서 받음
  const { K, site, metaRaw, r, dist, needsPassword, cleared } = await buildWorkV2(h, work, { host, plain: true });
  if (r.errors?.length) { say(r.errors.map((e) => `오류 ${e.message_ko}`), { ok: false, errors: r.errors }); process.exit(1); }
  const issues = K.inspect(site, metaRaw).map((x) => ({ ...x, where: { ...x.where, file: x.where.file && !x.where.file.startsWith('lecpage') ? 'site/' + x.where.file : x.where.file } }));
  const checkDir = join(work, 'check'); rmSync(checkDir, { recursive: true, force: true }); mkdirSync(checkDir, { recursive: true });
  const shots = [], tiles = [], tileCut = [];
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
        // 나눠 본 그림: 전체 그림은 너무 길어 줄여 보면 글이 안 읽힘 → 화면 높이쯤으로 잘라 둠(앞에서부터 12장까지)
        if (!args['no-tiles']) {
          mkdirSync(join(checkDir, 'tiles'), { recursive: true });
          for (const w of [390, 1280]) {
            const th = w < 600 ? 1200 : 900;
            await page.setViewportSize({ width: w, height: th });
            await page.waitForTimeout(250);
            await K.settlePage(page); // 폭이 바뀌면 그림·움직임을 다시 다 본 모습으로(늦게 받는 그림이 비어 찍히지 않게)
            const H = await page.evaluate(() => document.documentElement.scrollHeight);
            if (Math.ceil(H / th) > 12) tileCut.push(`${name}-${w}`); // 긴 쪽: 나눠 본 그림은 앞 12장까지 → 나머지는 전체 그림에서 보라고 알림
            for (let i = 0; i < Math.min(12, Math.ceil(H / th)); i++) {
              const f = join(checkDir, 'tiles', `${name}-${w}-${String(i + 1).padStart(2, '0')}.png`);
              await page.screenshot({ path: f, fullPage: true, animations: 'disabled', clip: { x: 0, y: i * th, width: w, height: Math.min(th, H - i * th) } });
              tiles.push(f);
            }
          }
        }
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
  writeFileSync(join(checkDir, 'report.json'), JSON.stringify({ summary: K.issueSummary(all), issues: all, warnings: r.warnings, preflight: r.preflight || [], report: r.report, collected: r.collected }, null, 2) + '\n');
  writeFileSync(join(checkDir, 'issues.md'), `# 검수 결과 (${K.issueSummary(all)})\n\n${K.issuesForAi(all, { max: 80 }) || '고칠 곳이 없어요.'}\n\n## 배포 전 확인(강사용 운영안내.md에도)\n${(r.preflight || []).map((x) => `- ${x.message_ko}`).join('\n') || '- 없음'}\n\n## 조립 알림\n${r.warnings.map((w) => `- ${w.message_ko}`).join('\n') || '- 없음'}\n`);
  const line = (x) => `${x.level === 'error' ? '고칠 곳' : '살펴볼 곳'} ${x.where.file}${x.where.selector ? ' ' + x.where.selector : ''}${x.where.width ? ` (${x.where.width}px)` : ''}: ${x.message_ko}`;
  say([
    `조립 ${rel(dist)}: 쪽 ${r.report.pages.length} · 파일 ${r.report.files}개 · ${r.report.sizeKB}KB · 참여 기능 ${r.report.live === 'none' ? '없음' : `${r.report.live}(${r.report.features.join(',')})`}`,
    needsPassword ? `공개 범위 암호(lecpage.teacher.json access: password)라 잠그기 전 사이트를 살펴봤어요. 올릴 ${rel(join(work, 'dist'))}는 pack·publish에 --password(또는 LECPAGE_PASSWORD)를 줄 때 잠가서 만들어요.${cleared ? ` 잠그지 않은 예전 ${rel(join(work, 'dist'))}는 비웠어요.` : ''}` : '',
    r.collected ? `키트 투표 ${r.collected.polls.length} · 실습 단계 ${r.collected.steps.length} · 교재 쪽 ${r.collected.deck.length}${r.collected.untitled?.length ? `(제목 없는 쪽 ${r.collected.untitled.length}: ${r.collected.untitled.slice(0, 6).join('·')}${r.collected.untitled.length > 6 ? '…' : ''} → 필요하면 lecpage.json pages)` : ''} · 질문 ${r.collected.qa ? '있음' : '없음'} · 보드 ${r.collected.board.length} · 설문 ${r.collected.survey.length}` : '',
    `검수 ${K.issueSummary(all)}${r.report.droppedPages?.length ? ` · 안 쓰는 교재 쪽 그림 ${r.report.droppedPages.length}장은 배포에서 뺌` : ''}`,
    ...(r.preflight || []).map((x) => `배포 전 확인 ${x.message_ko}`),
    ...[...errors, ...all.filter((x) => x.level !== 'error')].slice(0, 10).map(line),
    all.length > 10 ? `… 나머지는 ${rel(join(checkDir, 'issues.md'))}` : '',
    r.warnings.length ? `조립 알림 ${r.warnings.length}: ${r.warnings.slice(0, 3).map((w) => w.message_ko).join(' / ')}` : '',
    shots.length ? `화면 그림 ${shots.map((s) => rel(s)).join(' · ')}(전체)` : '',
    tiles.length ? `나눠 본 그림 ${rel(join(checkDir, 'tiles'))}/ ${tiles.length}장(<쪽>-390-01.png부터, 위에서 아래로) — 첫 장과 고친 곳 둘레를 직접 열어 봐요${tileCut.length ? ` · ${tileCut.join('·')}는 앞 12장까지만이라 그 아래(설문·마무리 등)는 전체 그림(<쪽>-390.png·-1280.png)에서 봐요` : ''}` : '', browserNote,
  ], { ok: !errors.length, dist, issues: all, warnings: r.warnings, shots, tiles, report: r.report, ...(needsPassword ? { needsPassword: true } : {}) });
  process.exitCode = errors.length ? 1 : 0;
}

/** preview <work> [--port 4173] [--host] */
export async function previewCmd(h) {
  const { args, staticServer, say } = h;
  const work = resolve(args._[0] || 'work');
  if (args.live) return liveServe(h, work);
  const { r, dist, needsPassword } = await buildWorkV2(h, work, { plain: true }); // 공개 범위가 암호여도 이 컴퓨터에서 보는 미리보기는 잠그기 전 사이트로(check와 같음)
  if (r.errors?.length) { say(r.errors.map((e) => `오류 ${e.message_ko}`), { ok: false, errors: r.errors }); process.exit(1); }
  const port = +args.port || 4173;
  const u = `http://localhost:${port}/`;
  staticServer(dist).listen(port, args.host || '127.0.0.1', () => {
    say([`미리보기: ${u}  (끝내려면 Ctrl+C${args.host ? '' : ' · 같은 와이파이의 다른 기기에서 보려면 --host 0.0.0.0'})`, `${existsSync(join(dist, 'console.html')) ? `강사 화면 ${u}console.html · ` : ''}발표 화면 ${u}screen.html · QR 안내문 ${u}poster.html`, needsPassword ? '공개 범위가 암호예요. 미리보기는 잠그기 전 사이트이고, 올릴 사이트는 pack·publish에 --password를 줄 때 잠가요.' : '', r.report.live === 'local' ? '참여 기능은 연습 모드예요(이 브라우저 안에서만 이어져요).' : '', r.warnings.length ? `조립 알림 ${r.warnings.length}개 — check로 자세히` : ''], { ok: true, url: u, dist });
  });
}

/**
 * serve work --live: 노트북 한 대로 교실 와이파이 연수. 참여 기능 서버(backends/node-server)를 켜고 사이트도 같은 주소로 내보냄.
 * 조립은 참여 기능 서버를 '같은 주소'(provider http, url '')로 해서 work/.lecpage/live-site에(올리는 work/dist는 그대로),
 * 기록·관리자 키는 work/dist-강사용/live-data에(다시 켜도 이어짐). 같은 와이파이 주소·QR은 서버가 알려 줌(/api/lan)
 */
async function liveServe(h, work) {
  const { args, say, readJson, N } = h;
  const { spawn } = await import('node:child_process');
  const prevPath = join(work, 'lecpage.teacher.json');
  const teacher = existsSync(prevPath) ? readJson(prevPath) : {};
  const prev = { ...teacher, live: { provider: 'http', url: '', code: teacher?.live?.code || '' } };
  const a = await assembleWork(h, work, { prev });
  if (a.r.errors?.length) { say(a.r.errors.map((e) => `오류 ${e.message_ko}`), { ok: false, errors: a.r.errors }); process.exit(1); }
  if (a.r.report.live === 'none') { say(['이 사이트는 참여 기능(질문·투표·출석 …)이 꺼져 있어요. lecpage.json의 features나 자리 표시(data-lp)를 넣은 뒤 다시 해 주세요. 사이트만 보려면 --live 없이 serve work.'], { ok: false }); process.exit(1); }
  const siteDir = join(work, '.lecpage', 'live-site'), dataDir = join(work, 'dist-강사용', 'live-data');
  rmSync(siteDir, { recursive: true, force: true }); N.writeFiles(siteDir, a.r.files); mkdirSync(dataDir, { recursive: true });
  const port = +args.port || 8787, host = args.host || '0.0.0.0';
  const server = join(HERE, '..', 'backends', 'node-server', 'server.mjs');
  const [maj, min] = process.versions.node.split('.').map(Number);
  const flags = [...(maj === 22 && min < 13 ? ['--experimental-sqlite'] : []), '--disable-warning=ExperimentalWarning']; // node:sqlite: 22.13부터 그대로(시험판 알림은 숨김)
  const keyFile = join(dataDir, 'admin-key.txt');
  // 개인정보 안내·참여 동의에 적은 보관 기간(마지막 기록 뒤 N일)을 서버도 지키게(없으면 서버 기본 30일)
  const days = Math.round(+a.r.blueprint?.privacy?.retentionDays || 0);
  const keep = days > 0 ? ['--retention-days', String(days)] : [];
  say([
    `교실 참여 서버를 켜요(연수 코드 ${a.r.collected.code}). 끝내려면 Ctrl+C`,
    `관리자 키: ${relative(process.cwd(), keyFile) || keyFile} (처음 켤 때 만들어요. 강사 화면에 넣어요)`,
    '참가자는 같은 와이파이에서 아래 주소로 들어와요. 발표 화면·강사 화면은 이 노트북에서 열어도 QR에 와이파이 주소가 들어가요.',
    '교실 와이파이가 기기끼리 막혀 있으면(학교망 격리) 휴대폰 핫스팟에 노트북과 참가자가 함께 들어오게 해요.',
  ], { ok: true, live: true, code: a.r.collected.code, port, site: siteDir, data: dataDir });
  const child = spawn(process.execPath, [...flags, server, '--static', siteDir, '--data', dataDir, '--port', String(port), '--host', host, ...keep], { stdio: 'inherit' });
  const stop = () => { try { child.kill('SIGINT'); } catch { /* 이미 끝남 */ } };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  await new Promise((res) => child.on('exit', (code) => { process.exitCode = code || 0; res(); }));
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
  const host = h.loadState(work).deploy?.host || ''; // 지난번 배포한 곳: 앱이 배포할 곳을 고를 때 처음 값(조립 opts.host)
  const r = K.packProjectV2({ site, meta, material: { pages }, sources: sources.map(({ path, renderOf, ...x }) => x), originals, deploy: host ? { host } : null });
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
  h.saveState(work, { v: 2, out: 'dist', from: 'app', ...(o.deploy?.host ? { hostHint: o.deploy.host } : {}) }); // hostHint: check의 배포할 곳 처음 값
  const imgs = Object.keys(o.site).filter((k) => k.startsWith('material/')).length;
  say([
    `앱에서 저장한 연수 ✓ 「${String(o.title || meta.title || '이름 없음').slice(0, 40)}」 → ${rel(work)} · 사이트 파일 ${Object.keys(o.site).length - imgs}개 · 교재 쪽 그림 ${imgs} · 교재 원본 ${srcFiles.length}`,
    o.note ? `알림 ${o.note}` : '',
    given.length ? `파일에 강사 값이 있었어요(${given.map(([k]) => k).join('·')}) → ${rel(join(work, 'lecpage.teacher.from-file.json'))}. 강사에게 맞는지 묻고 lecpage.teacher.json으로 옮겨요` : '',
    `다음 check ${rel(work)}`,
  ], { ok: true, work, files: Object.keys(o.site).length, slides: imgs, originals: srcFiles, teacherInFile: Object.fromEntries(given) });
}

/**
 * app 연수.lecpage(예전 방식으로 만든 연수) -o work → 교재 쪽 그림(site/material)·자료실 파일·연수 정보(lecpage.json)·쪽 제목·교재 원본(src/).
 * 예전 사이트는 옮기지 않음: AI 에이전트가 site/index.html을 새로 씀(앱의 [AI로 새로 만들기]와 같음)
 */
export async function appUnpackV1(h, o) {
  const { args, N, rel, fail, say, writeJson } = h;
  const K = await imp('src/kit/index.js');
  const work = resolve(args.o || 'work');
  if ((existsSync(join(work, 'lecpage.json')) || existsSync(join(work, 'site', 'index.html'))) && !args.force) fail(`${rel(work)}에 사이트가 이미 있어요. 다른 폴더를 -o로 주거나, 덮어쓰려면 --force를 붙여 주세요.`);
  const u = K.upgradeV1(o.v1);
  if (args.force) rmSync(join(work, 'site'), { recursive: true, force: true });
  mkdirSync(join(work, 'site'), { recursive: true });
  N.writeFiles(join(work, 'site'), u.site);
  const meta = { ...u.meta };
  for (const k of K.TEACHER_KEYS) delete meta[k];
  writeJson(join(work, 'lecpage.json'), meta);
  writeJson(join(work, '.lecpage', 'pages.json'), u.material.pages.map(({ page, title, text }) => ({ page, title, text: String(text || '').slice(0, 400) })));
  const srcFiles = [];
  for (const x of u.originals) { N.writeFiles(join(work, 'src'), { [x.file]: x.bytes }); srcFiles.push(join(work, 'src', x.file)); }
  writeJson(join(work, '.lecpage', 'sources.json'), srcFiles.map((f) => ({ name: basename(f), path: f })));
  h.saveState(work, { v: 2, out: 'dist', from: 'app' });
  const imgs = Object.keys(u.site).filter((k) => k.startsWith('material/')).length;
  say([
    `${o.note} → ${rel(work)} · 교재 쪽 그림 ${imgs} · 연수 정보 lecpage.json · 교재 원본 ${srcFiles.length}`,
    srcFiles.length ? `다음 prepare ${srcFiles.map((f) => rel(f)).join(' ')} -o ${rel(work)}(쪽 그림·보조 글자를 다시 만들고 연수 정보는 그대로) → site/index.html 쓰기 → check ${rel(work)}` : `다음 site/index.html 쓰기(교재 쪽 그림은 site/material/) → check ${rel(work)}`,
  ], { ok: true, old: true, work, slides: imgs, originals: srcFiles });
}
