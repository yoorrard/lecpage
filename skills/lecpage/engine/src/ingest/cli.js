// Node 전용(Agent Skill CLI): 파일 경로로 교재 해석 → material.json 쓰기 → (선택) 설계도 초안·AI 요약·쪽 그림.
// 브라우저 번들에 node: 모듈이 끌려 들어가지 않도록 모두 동적 import(변수 지정자)로 불러옵니다.
import { DEFAULT_LIMITS, makeError, extOf, baseName, sizeLabel, pagesForImages } from './util.js';

const nodeImport = (spec) => import(/* @vite-ignore */ spec);
async function node() {
  const [fs, path, url, cp, os] = await Promise.all(['node:fs/promises', 'node:path', 'node:url', 'node:child_process', 'node:os'].map(nodeImport));
  return { fs, path, url, cp, os };
}
async function ingestApi() { return nodeImport('./index.js'); }

export function scriptPath(name) {
  const here = import.meta.url; // 번들러가 new URL(…, import.meta.url)을 자산으로 바꾸지 않도록 변수로 씀
  const rel = '../../../scripts/' + name;
  return new URL(rel, here);
}

/** 파이썬 보조 스크립트(scripts/ingest.py)로 해석 → Material | null */
export async function ingestWithPython(file, { python = 'python3', id, withImages = true, timeoutMs = 300000 } = {}) {
  const { fs, path, url, cp, os } = await node();
  const script = url.fileURLToPath(scriptPath('ingest.py'));
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'lecpage-ingest-'));
  const out = path.join(tmp, 'material.json');
  const imgDir = path.join(tmp, 'img');
  const args = ['-I', script, file, '-o', out];
  if (withImages) args.push('--images', imgDir);
  if (id) args.push('--id', id);
  const r = cp.spawnSync(python, args, { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 });
  try {
    if (r.status !== 0 && !(await exists(fs, out))) return null;
    const m = JSON.parse(await fs.readFile(out, 'utf8'));
    if (!m || m.kind !== 'lecpage-material') return null;
    // 파이썬이 임시 폴더에 쓴 그림을 바이트로 다시 읽어(쓰기는 writeMaterial이 한 곳에서)
    for (const p of m.pages || []) for (const im of p.images || []) {
      if (im.src) { try { im.bytes = new Uint8Array(await fs.readFile(path.join(tmp, im.src))); } catch { /* 없음 */ } }
      delete im.src;
    }
    return m;
  } catch { return null; } finally { await fs.rm(tmp, { recursive: true, force: true }).catch(() => {}); }
}
async function exists(fs, p) { try { await fs.access(p); return true; } catch { return false; } }

/**
 * 여러 파일(또는 https 링크)을 읽어 하나의 Material로.
 * opts: withImages, python(false면 끔), pythonBin, imagesDir(파이썬 대체 시 그림 저장), today, limits, maxBytes
 */
export async function ingestPaths(paths, opts = {}) {
  const { fs, path } = await node();
  const api = await ingestApi();
  const mats = [];
  const maxBytes = opts.maxBytes || opts.limits?.maxBytes || DEFAULT_LIMITS.maxBytes;
  const counters = { deck: 0, doc: 0, link: 0 };
  const nextId = (name) => { const k = /^https?:/i.test(name) ? 'link' : ['pptx', 'pdf', 'ppsx', 'potx', 'pptm', 'ppt'].includes(extOf(name)) ? 'deck' : 'doc'; counters[k]++; return k + counters[k]; };
  for (const p of paths) {
    const id = nextId(p);
    if (/^https?:\/\//i.test(p)) { mats.push(await api.ingestUrl(p, { ...opts, id, detect: false })); continue; }
    const name = baseName(p);
    let bytes;
    try {
      const st = await fs.stat(p);
      if (!st.isFile()) throw new Error('not a file');
      if (st.size > maxBytes) {
        const m = api.mergeMaterials([], { detect: false });
        m.files.push({ id, name, type: extOf(name), size: st.size, pages: 0, unit: '' });
        m.errors.push(makeError('too-large', { mb: (st.size / 1048576).toFixed(1), limitMb: Math.round(maxBytes / 1048576) }, name));
        mats.push(m); continue;
      }
      bytes = await fs.readFile(p);
    } catch (e) {
      const m = api.mergeMaterials([], { detect: false });
      m.errors.push({ code: 'not-found', message_ko: `파일을 찾을 수 없어요: ${p}`, file: name });
      mats.push(m); continue;
    }
    let m = await api.ingestFile(name, new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength), { ...opts, id, detect: false });
    const needPy = m.errors.find((e) => e.code === 'needs-pdfjs' || (e.code === 'pdf-failed' && extOf(name) === 'pdf'));
    if (needPy && opts.python !== false) {
      const py = await ingestWithPython(path.resolve(p), { id, withImages: !!opts.withImages, python: opts.pythonBin || 'python3' });
      if (py && py.pages?.length) { py.warnings = [...(py.warnings || []), { code: 'python-fallback', message_ko: 'PDF는 파이썬 보조 스크립트로 읽었어요.', file: name }]; m = py; }
      else if (needPy.code === 'needs-pdfjs') needPy.message_ko += ' (파이썬 보조 스크립트도 실행하지 못했어요: python3와 PyMuPDF 설치를 확인해 주세요.)';
    }
    m.files?.forEach((f) => { f.path = path.resolve(p); });
    mats.push(m);
  }
  return api.mergeMaterials(mats, opts);
}

/** Material을 JSON으로 저장. imagesDir가 있으면 그림 바이트를 파일로 쓰고 image.src에 상대 경로를 넣습니다. */
export async function writeMaterial(material, outPath, { imagesDir } = {}) {
  const { fs, path } = await node();
  const api = await ingestApi();
  const outDir = path.dirname(path.resolve(outPath));
  let written = 0;
  if (imagesDir) {
    await fs.mkdir(imagesDir, { recursive: true });
    for (const p of material.pages || []) for (const im of p.images || []) {
      if (!im.bytes) continue;
      const file = path.join(imagesDir, api.imageFileName(im));
      await fs.writeFile(file, im.bytes);
      im.src = path.relative(outDir, file).split(path.sep).join('/');
      written++;
    }
  }
  const json = api.materialToJSON(material);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(json, null, 2) + '\n', 'utf8');
  return { written, path: outPath };
}

/** scripts/render_slides.sh로 쪽 그림 만들기 → 성공한 그림 경로 목록 */
export async function renderSlides(file, outDir, { dpi = 110, timeoutMs = 600000 } = {}) {
  const { fs, url, cp, path } = await node();
  const script = url.fileURLToPath(scriptPath('render_slides.sh'));
  await fs.mkdir(outDir, { recursive: true });
  const r = cp.spawnSync('bash', [script, file, outDir, String(dpi)], { encoding: 'utf8', timeout: timeoutMs });
  const files = r.status === 0 ? (await fs.readdir(outDir)).filter((f) => /^slide-\d{3,}\.(webp|png)$/.test(f)).sort().map((f) => path.join(outDir, f)) : [];
  if (!files.length) {
    await fs.rmdir(outDir).catch(() => {}); // 실패하면 빈 폴더를 남기지 않음(비어 있을 때만 지워짐)
    const msg = (r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' ');
    return { ok: false, files: [], message: msg || '그림이 한 장도 나오지 않았어요.' };
  }
  return { ok: true, files };
}

/**
 * 쪽 그림을 만들어 material에 붙임(pages[].image, files[].rendered). 실패는 warnings에 남김.
 * PPTX에 짝 PDF(renderSource)가 있으면 그 PDF로 그림(글꼴이 원본과 같아 더 정확)
 * @param {object} m Material  @param {string} slidesDir 그림 폴더  @param {string} outPath material.json 경로(상대 경로 기준)
 */
export async function attachSlides(m, slidesDir, outPath) {
  const { path } = await node();
  const outDir = path.dirname(path.resolve(outPath));
  for (const f of m.files) {
    if (!f.path || f.renderOf || !['pptx', 'pdf', 'docx', 'hwpx'].includes(f.type)) continue;
    const srcFile = f.renderSource ? m.files.find((x) => x.id === f.renderSource) : null;
    const dir = m.files.filter((x) => !x.renderOf).length > 1 ? path.join(slidesDir, f.id) : slidesDir;
    const r = await renderSlides((srcFile && srcFile.path) || f.path, dir);
    if (!r.ok) { m.warnings.push({ code: 'render-failed', message_ko: `쪽 그림을 만들지 못했어요(LibreOffice·pdftoppm 확인): ${r.message || ''}`.trim(), file: f.name }); continue; }
    const rel = (img) => path.relative(outDir, img).split(path.sep).join('/');
    if (f.unit === 'section') { f.pageImages = r.files.map(rel); f.rendered = r.files.length; continue; } // 문서형: 실제 쪽 ≠ 절
    const pages = pagesForImages(m.pages.filter((p) => p.file === f.id), r.files.length, !!(srcFile && srcFile.skipsHidden));
    pages.forEach((p, i) => { const img = r.files[i]; if (img) p.image = rel(img); });
    if (srcFile) m.pages.filter((p) => p.file === srcFile.id).forEach((p, i) => { const img = r.files[i]; if (img) p.image = rel(img); });
    f.rendered = r.files.length;
  }
  if (!m.files.some((f) => f.rendered)) await (await node()).fs.rmdir(slidesDir).catch(() => {});
  return m;
}

const HELP = `사용법: node ingest.mjs <파일 또는 링크...> -o material.json [옵션]

  -o, --out <파일>        결과 Material JSON (기본: material.json)
  --images <폴더>         교재 속 그림을 꺼내 저장(image.src에 상대 경로)
  --slides <폴더>         쪽 그림 만들기(LibreOffice + pdftoppm, slide-001.webp…)
  --draft <파일>          AI 없이 만든 설계도 초안(blueprint JSON)도 저장
  --context <파일>        AI 프롬프트용 교재 요약 글 저장
  --max-chars <수>        요약 글 길이 예산(기본 24000)
  --today <YYYY-MM-DD>    연도 없는 날짜를 해석할 기준일
  --no-python             PDF를 파이썬으로 대신 읽지 않기
  --json                  요약 대신 결과 JSON을 화면에 출력
  -h, --help              도움말`;

/** CLI 진입점. 종료 코드를 돌려줍니다(0 성공, 1 모든 파일 실패, 2 잘못된 사용). */
export async function runIngestCli(argv = []) {
  const { fs, path } = await node();
  const api = await ingestApi();
  const a = { files: [], out: 'material.json', images: '', slides: '', draft: '', context: '', maxChars: 24000, today: '', python: true, json: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === '-h' || k === '--help') { console.log(HELP); return 0; }
    else if (k === '-o' || k === '--out') a.out = v();
    else if (k === '--images') a.images = v();
    else if (k === '--slides') a.slides = v();
    else if (k === '--draft') a.draft = v();
    else if (k === '--context') a.context = v();
    else if (k === '--max-chars') a.maxChars = +v() || 24000;
    else if (k === '--today') a.today = v();
    else if (k === '--no-python') a.python = false;
    else if (k === '--json') a.json = true;
    else if (k.startsWith('-')) { console.error(`알 수 없는 옵션: ${k}\n\n${HELP}`); return 2; }
    else a.files.push(k);
  }
  if (!a.files.length) { console.error(HELP); return 2; }
  const opts = { withImages: !!a.images, python: a.python, today: a.today || undefined };
  const m = await ingestPaths(a.files, opts);

  if (a.slides) await attachSlides(m, a.slides, a.out);
  const { written } = await writeMaterial(m, a.out, { imagesDir: a.images || '' });
  if (a.draft) await fs.writeFile(a.draft, JSON.stringify(api.materialToDraft(m, { today: a.today || undefined }), null, 2) + '\n', 'utf8');
  if (a.context) await fs.writeFile(a.context, api.materialToAIContext(m, { maxChars: a.maxChars }) + '\n', 'utf8');

  if (a.json) console.log(JSON.stringify(api.materialToJSON(m), null, 2));
  else {
    console.log(`교재 해석: ${api.summarizeMaterial(m)}`);
    console.log(`→ ${a.out}${written ? ` (그림 ${written}개: ${a.images})` : ''}${a.draft ? `, 초안 ${a.draft}` : ''}${a.context ? `, 요약 ${a.context}` : ''}`);
    for (const e of m.errors) console.log(`오류 [${e.code}] ${e.file ? e.file + ': ' : ''}${e.message_ko}`);
    for (const w of m.warnings) console.log(`알림 [${w.code}] ${w.file ? w.file + ': ' : ''}${w.message_ko}`);
  }
  const ok = m.pages.length > 0;
  return ok ? 0 : 1;
}

export { sizeLabel };
