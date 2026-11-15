#!/usr/bin/env node
// lecpage 교재 쪽 그림 만들기: PPTX·HWPX·DOCX(…) → PDF(LibreOffice) → PNG(pdftoppm) → WebP(cwebp, 없으면 PIL, 그것도 없으면 PNG).
// 셸·bash 없이 Node에서 프로그램을 바로 부름(윈도우·macOS·리눅스 같게). make가 부르고, 혼자도 돌림:
//
//   node render-slides.mjs <교재 파일> <출력 폴더> [dpi=110]
//
// 결과: <출력 폴더>/slide-001.webp, slide-002.webp …  환경 변수: KEEP_PDF=1(바꾼 PDF를 slides.pdf로 남김), WEBP_QUALITY(기본 82)
// 필요: pdftoppm(poppler), PDF가 아니면 soffice(LibreOffice). 한글 글꼴이 깔려 있어야 쪽 그림의 글자가 깨지지 않아요.
import { existsSync, mkdirSync, mkdtempSync, copyFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { tmpdir, availableParallelism } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** 프로그램 찾기: PATH(윈도우는 .exe)와 흔한 설치 위치. 없으면 '' */
export function findProgram(names, extra = []) {
  for (const n of names) {
    const r = spawnSync(n, ['--version'], { encoding: 'utf8', timeout: 20000, windowsHide: true });
    if (!r.error) return n; // 종료 코드는 프로그램마다 다름(pdftoppm -v는 99). 실행만 되면 있음
  }
  return extra.find((p) => p && existsSync(p)) || '';
}
const pf = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean);
export const sofficePath = () => findProgram(['soffice', 'libreoffice'], ['/Applications/LibreOffice.app/Contents/MacOS/soffice', ...pf.map((d) => join(d, 'LibreOffice', 'program', 'soffice.exe'))]);
export const pdftoppmPath = () => findProgram(['pdftoppm']);

/** 오래 걸리는 프로그램을 시간 제한과 함께(진행을 보려고 비동기로). → { code, out } */
function run(cmd, argv, { timeoutMs = 600000, onTick, input } = {}) {
  return new Promise((ok) => {
    let out = '', done = false;
    const p = spawn(cmd, argv, { windowsHide: true });
    if (input !== undefined) { p.stdin.on('error', () => {}); p.stdin.end(input); }
    p.stdout?.on('data', (d) => { out += d; }); p.stderr?.on('data', (d) => { out += d; });
    const tick = onTick ? setInterval(onTick, 1500) : null;
    const kill = setTimeout(() => { if (!done) { p.kill(); out += '\n시간 초과'; } }, timeoutMs);
    const end = (code) => { if (done) return; done = true; clearTimeout(kill); if (tick) clearInterval(tick); ok({ code, out }); };
    p.on('error', (e) => { out += String(e.message); end(-1); });
    p.on('close', (c) => end(c));
  });
}
/** 큰 교재는 쪽을 나눠 동시에(코어 수 - 1, 많아야 4) */
const workers = (n) => (n >= 30 ? Math.max(1, Math.min(4, availableParallelism() - 1)) : 1);
const chunks = (list, k) => Array.from({ length: k }, (_, i) => list.filter((_, j) => j % k === i)).filter((c) => c.length);
// PIL로 WebP: 쪽마다 파이썬을 새로 띄우지 않고 한 번에(표준 입력으로 '원본<TAB>결과' 줄)
const PIL_BATCH = 'import sys\nfrom PIL import Image\nq=int(sys.argv[1])\nfor l in sys.stdin.read().splitlines():\n  a,b=l.split("\\t")\n  Image.open(a).save(b,"WEBP",quality=q,method=4)';
const pngs = (dir) => readdirSync(dir).filter((f) => /^p-\d+\.png$/.test(f)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);
const tail = (s, n = 3) => String(s).trim().split('\n').filter(Boolean).slice(-n).join(' ').slice(0, 300);

/**
 * 쪽 그림 만들기 → { ok, files, format, message }
 * @param {{dpi?:number, timeoutMs?:number, pages?:number, onProgress?:(done:number,total:number,stage:string)=>void}} o
 *   pages: 쪽 수를 알면(교재 해석) 진행 표시의 분모로 씀
 */
export async function renderSlides(file, outDir, { dpi = 110, timeoutMs = 600000, pages = 0, onProgress = null, keepPdf = process.env.KEEP_PDF === '1', quality = +process.env.WEBP_QUALITY || 82 } = {}) {
  const fail = (message) => ({ ok: false, files: [], message });
  if (!existsSync(file) || !statSync(file).isFile()) return fail(`파일을 찾을 수 없어요: ${file}`);
  const pdftoppm = pdftoppmPath();
  if (!pdftoppm) return fail('pdftoppm이 없어요. 설치: (Ubuntu) sudo apt-get install -y poppler-utils · (macOS) brew install poppler · (윈도우) winget install oschwartz10612.Poppler');
  mkdirSync(outDir, { recursive: true });
  const tmp = mkdtempSync(join(tmpdir(), 'lecpage-render-'));
  try {
    const ext = extname(file).slice(1).toLowerCase();
    let pdf = join(tmp, 'input.pdf');
    if (ext === 'pdf') copyFileSync(file, pdf);
    else {
      const soffice = sofficePath();
      if (!soffice) return fail('LibreOffice(soffice)가 없어요. 설치하거나, 교재를 PDF로 저장해 그 PDF를 함께 주세요.');
      const src = join(tmp, 'input.' + ext); copyFileSync(file, src);
      onProgress?.(0, pages, 'pdf');
      // 다른 LibreOffice와 부딪치지 않게 임시 프로필
      const r = await run(soffice, [`-env:UserInstallation=${pathToFileURL(join(tmp, 'profile')).href}`, '--headless', '--norestore', '--nolockcheck', '--convert-to', 'pdf', '--outdir', tmp, src], { timeoutMs: Math.min(timeoutMs, 300000) });
      if (r.code !== 0) return fail(`PDF 변환에 실패했어요(LibreOffice). 교재를 PDF로 저장해 그 PDF를 함께 주세요. ${tail(r.out)}`);
      if (!existsSync(pdf) || !statSync(pdf).size) return fail(['hwp', 'hwpx'].includes(ext) ? '이 LibreOffice는 한글 파일을 변환하지 못했어요. 한글에서 PDF로 저장해 그 PDF를 함께 주세요.' : 'PDF 변환 결과가 없어요. 교재를 PDF로 저장해 그 PDF를 함께 주세요.');
    }
    // 쪽 수(pdfinfo, 같은 poppler에 있음)를 알면 나눠 동시에 그림
    const info = spawnSync(pdftoppm.replace(/pdftoppm(\.exe)?$/i, 'pdfinfo$1'), [pdf], { encoding: 'utf8', timeout: 60000, windowsHide: true });
    const total = +(/^Pages:\s+(\d+)/m.exec(info.stdout || '') || [])[1] || 0;
    const k = total ? workers(total) : 1, per = Math.ceil(total / k);
    const parts = k > 1 ? Array.from({ length: k }, (_, i) => [i * per + 1, Math.min(total, (i + 1) * per)]).filter(([a, b]) => a <= b) : [null];
    const tick = () => onProgress?.(pngs(tmp).length, total || pages, 'png');
    const rs = await Promise.all(parts.map((pr, i) => run(pdftoppm, ['-r', String(dpi), '-png', ...(pr ? ['-f', String(pr[0]), '-l', String(pr[1])] : []), pdf, join(tmp, 'p')], { timeoutMs, onTick: i === 0 ? tick : null })));
    const list = pngs(tmp);
    const r = rs.find((x) => x.code !== 0) || rs[0];
    if (r.code !== 0 || !list.length) return fail(`쪽 그림을 그리지 못했어요(pdftoppm). ${tail(r.out)}`);
    // 쪽 수가 줄었을 때 옛 그림이 남지 않게
    for (const f of readdirSync(outDir)) if (/^slide-\d{3,}\.(webp|png)$/.test(f)) rmSync(join(outDir, f), { force: true });
    const cwebp = findProgram(['cwebp']);
    const pil = !cwebp && ['python3', 'python'].find((py) => spawnSync(py, ['-c', 'from PIL import Image, features; assert features.check("webp")'], { timeout: 20000, windowsHide: true }).status === 0);
    const fmt = cwebp || pil ? 'webp' : 'png';
    const pairs = list.map((f, i) => [join(tmp, f), join(outDir, `slide-${String(i + 1).padStart(3, '0')}.${fmt}`)]);
    const made = () => onProgress?.(readdirSync(outDir).filter((f) => /^slide-\d+\.webp$/.test(f)).length, pairs.length, 'webp');
    const k2 = workers(pairs.length);
    if (cwebp) await Promise.all(chunks(pairs, k2).map(async (ch, w) => { for (const [from, to] of ch) await run(cwebp, ['-quiet', '-q', String(quality), from, '-o', to], { timeoutMs: 120000, onTick: w === 0 ? made : null }); }));
    else if (pil) await Promise.all(chunks(pairs, k2).map((ch, w) => run(pil, ['-c', PIL_BATCH, String(quality)], { timeoutMs, input: ch.map((x) => x.join('\t')).join('\n'), onTick: w === 0 ? made : null })));
    // WebP로 못 바꾼 쪽은 PNG 그대로
    const files = pairs.map(([from, to]) => { if (existsSync(to)) return to; const png = to.replace(/\.webp$/, '.png'); copyFileSync(from, png); return png; });
    if (keepPdf) copyFileSync(pdf, join(outDir, 'slides.pdf'));
    return { ok: true, files, format: fmt, message: '' };
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

// 혼자 실행
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [file, out, dpi] = process.argv.slice(2);
  if (!file || !out || file === '-h' || file === '--help') { console.log('사용법: node render-slides.mjs <교재 파일> <출력 폴더> [dpi=110]'); process.exit(file ? 0 : 2); }
  const r = await renderSlides(resolve(file), resolve(out), { dpi: +dpi || 110, onProgress: (d, t, st) => process.stderr.write(`\r쪽 그림 ${st === 'pdf' ? 'PDF로 바꾸는 중' : `${d}${t ? '/' + t : ''}`}   `) });
  process.stderr.write('\n');
  if (!r.ok) { console.error('오류: ' + r.message); process.exit(3); }
  console.log(`쪽 그림 ${r.files.length}장 → ${out} (slide-001.${r.format} …)`);
}
