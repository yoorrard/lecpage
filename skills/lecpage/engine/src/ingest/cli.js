// Node 전용(Agent Skill CLI, prepare가 씀): 파일 경로로 교재 해석 → Material, 쪽 그림 붙이기.
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

/** 이 컴퓨터의 파이썬 3: python3 → python → (윈도우) py -3. → [명령, 앞 인자] | null */
let pyFound;
export async function findPython() {
  if (pyFound !== undefined) return pyFound;
  const { cp } = await node();
  const list = [['python3', []], ['python', []], ...(process.platform === 'win32' ? [['py', ['-3']]] : [])];
  pyFound = list.find(([c, pre]) => cp.spawnSync(c, [...pre, '-c', 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)'], { timeout: 20000, windowsHide: true }).status === 0) || null;
  return pyFound;
}
/** 파이썬 보조 스크립트(scripts/ingest.py)로 해석 → Material | null */
export async function ingestWithPython(file, { python = '', id, withImages = true, timeoutMs = 300000 } = {}) {
  const { fs, path, url, cp, os } = await node();
  const py = python ? [python, []] : await findPython();
  if (!py) return null;
  const script = url.fileURLToPath(scriptPath('ingest.py'));
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'lecpage-ingest-'));
  const out = path.join(tmp, 'material.json');
  const imgDir = path.join(tmp, 'img');
  const args = [...py[1], '-I', script, file, '-o', out];
  if (withImages) args.push('--images', imgDir);
  if (id) args.push('--id', id);
  const r = cp.spawnSync(py[0], args, { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  try {
    if (r.status !== 0 && !(await exists(fs, out))) return null;
    const m = JSON.parse(await fs.readFile(out, 'utf8'));
    if (!m || m.kind !== 'lecpage-material') return null;
    // 파이썬이 임시 폴더에 쓴 그림을 바이트로 다시 읽음
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
 * opts: withImages, python(false면 끔), pythonBin, imagesDir(파이썬 대체 시 그림 저장), limits, maxBytes
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
    if (/^https?:\/\//i.test(p)) { mats.push(await api.ingestUrl(p, { ...opts, id })); continue; }
    const name = baseName(p);
    let bytes;
    try {
      const st = await fs.stat(p);
      if (!st.isFile()) throw new Error('not a file');
      if (st.size > maxBytes) {
        const m = api.mergeMaterials([]);
        m.files.push({ id, name, type: extOf(name), size: st.size, pages: 0, unit: '' });
        m.errors.push(makeError('too-large', { mb: (st.size / 1048576).toFixed(1), limitMb: Math.round(maxBytes / 1048576) }, name));
        mats.push(m); continue;
      }
      bytes = await fs.readFile(p);
    } catch (e) {
      const m = api.mergeMaterials([]);
      m.errors.push({ code: 'not-found', message_ko: `파일을 찾을 수 없어요: ${p}`, file: name });
      mats.push(m); continue;
    }
    let m = await api.ingestFile(name, new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength), { ...opts, id });
    const needPy = m.errors.find((e) => e.code === 'needs-pdfjs' || (e.code === 'pdf-failed' && extOf(name) === 'pdf'));
    if (needPy && opts.python !== false && process.env.LECPAGE_NO_PYTHON !== '1') { // LECPAGE_NO_PYTHON: 시험이 파이썬 보조 도구도 없는 PC를 흉내 냄
      const py = await ingestWithPython(path.resolve(p), { id, withImages: !!opts.withImages, python: opts.pythonBin || '' });
      if (py && py.pages?.length) { py.warnings = [...(py.warnings || []), { code: 'python-fallback', message_ko: 'PDF는 파이썬 보조 스크립트로 읽었어요.', file: name }]; m = py; }
      else if (needPy.code === 'needs-pdfjs') needPy.message_ko += ' (파이썬 보조 스크립트도 실행하지 못했어요: python3와 PyMuPDF 설치를 확인해 주세요.)';
    }
    m.files?.forEach((f) => { f.path = path.resolve(p); });
    mats.push(m);
  }
  return api.mergeMaterials(mats, opts);
}

/** scripts/render-slides.mjs(셸 없이 LibreOffice·pdftoppm을 부름)로 쪽 그림 만들기 → 성공한 그림 경로 목록 */
export async function renderSlides(file, outDir, opts = {}) {
  const { fs } = await node();
  const { renderSlides: render } = await nodeImport(scriptPath('render-slides.mjs').href);
  const r = await render(file, outDir, opts);
  if (!r.ok) await fs.rmdir(outDir).catch(() => {}); // 실패하면 빈 폴더를 남기지 않음(비어 있을 때만 지워짐)
  return r.ok ? { ok: true, files: r.files } : { ok: false, files: [], message: r.message || '그림이 한 장도 나오지 않았어요.' };
}

/**
 * 쪽 그림을 만들어 material에 붙임(pages[].image, files[].rendered). 실패는 warnings에 남김. onProgress(그린 쪽, 모든 쪽, 단계, 파일 이름)
 * PPTX에 짝 PDF(renderSource)가 있으면 그 PDF로 그림(글꼴이 원본과 같아 더 정확)
 * @param {object} m Material  @param {string} slidesDir 그림 폴더  @param {string} outPath material.json 경로(상대 경로 기준)
 */
export async function attachSlides(m, slidesDir, outPath, { onProgress } = {}) {
  const { path } = await node();
  const outDir = path.dirname(path.resolve(outPath));
  for (const f of m.files) {
    if (!f.path || f.renderOf || !['pptx', 'pdf', 'docx', 'hwpx'].includes(f.type)) continue;
    const srcFile = f.renderSource ? m.files.find((x) => x.id === f.renderSource) : null;
    const dir = m.files.filter((x) => !x.renderOf).length > 1 ? path.join(slidesDir, f.id) : slidesDir;
    const r = await renderSlides((srcFile && srcFile.path) || f.path, dir, { pages: m.pages.filter((p) => p.file === f.id).length, onProgress: onProgress && ((d, t, st) => onProgress(d, t, st, f.name)) });
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

export { sizeLabel };
