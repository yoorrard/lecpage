// 첫 화면(랜딩)에 넣는 실제 사이트 그림을 다시 찍습니다 → src/landing/shots/*.webp + shots.json
// 쓰는 법(app 폴더에서):  node scripts/landing-shots.mjs
//   --only=show,site,phone,say,vs   일부만 다시 찍음
//   --vs-base=<폴더> --vs-bp=<설계도>   '같은 교재, 같은 요청' 비교 그림: AI 에이전트에 그냥 맡겨 만든 사이트 폴더와
//                                       lecpage 설계도(docs/research/benchmark-2026-11.md의 측정 때 만든 것). 둘 다 주어야 찍음
// 그림은 모두 엔진이 실제로 만든 예시 사이트예요(모형이 아님). 디자인·렌더러가 바뀌면 다시 돌리세요.
// 그림은 src 아래에 두어 빌드 때 이름에 해시가 붙고(오래 캐시), 첫 화면은 필요한 그림만 늦게 받습니다.
// playwright는 앱의 의존성이 아닙니다. 개발 환경에 설치된 것을 씁니다.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const SKILL = join(APP, '..', 'skills', 'lecpage');
const OUT = join(APP, 'src', 'landing', 'shots');
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');
const ONLY = arg('only') ? arg('only').split(',') : null;
const want = (n) => !ONLY || ONLY.includes(n);

// 같은 내용(사회정서학습 연수)을 디자인만 바꿔 찍을 디자인. 첫 화면 구성이 서로 다른 것으로 고름
export const SHOWCASE = ['night-story', 'paper-workbook', 'editorial-ink', 'ripple-center', 'chalkboard', 'deck-collage', 'vertical-type', 'retro-pop'];
// 말로 고치기 체험: 예시 연수(데이터로 읽는 우리 반)에 이 말을 넣었을 때 앱이 내는 첫 안을 적용해 찍음(앱과 같은 규칙, AI 없음)
export const SAYS = ['좀 답답해 보여요', '흔한 사이트 같아요', '학교 느낌이 나면 좋겠어요', '어두운 화면이 좋아요'];

let playwright;
try { playwright = createRequire(import.meta.url)('playwright'); }
catch { console.error('playwright를 찾지 못했어요. 개발 환경에 설치해 주세요(npm i -g playwright && npx playwright install chromium).'); process.exit(1); }

const E = await import(pathToFileURL(join(SKILL, 'engine', 'src', 'index.js')).href);
const N = await import(pathToFileURL(join(SKILL, 'engine', 'node.js')).href);
const example = (id) => JSON.parse(readFileSync(join(SKILL, 'examples', `${id}.blueprint.json`), 'utf8'));

// ── 사이트 만들기(임시 폴더) ──
const TMP = mkdtempSync(join(tmpdir(), 'lp-landing-'));
function buildTo(name, bp) {
  const r = E.build(bp, { runtime: N.nodeRuntime(), assets: {} });
  if (r.errors.length) throw new Error(`${name}: ${r.errors.map((e) => e.message || e).join(', ')}`);
  N.writeFiles(join(TMP, name), r.files);
  return name;
}
/** 디자인 둘러보기(Gallery)와 같은 방식: 디자인만 바꾸고 색·글꼴 고른 값은 비움, 참여 기능 없이 */
const withPreset = (bp, preset) => ({ ...bp, design: { ...bp.design, preset, palette: '', accent: '', fontPair: '', graphic: undefined, signature: '', effects: {}, motion: undefined }, live: { ...(bp.live || {}), provider: 'none', features: [] } });

// ── 정적 서버 ──
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const srv = createServer(async (q, r) => {
  try {
    const p = resolve(join(TMP, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')));
    if (!p.startsWith(TMP + sep)) throw 0;
    const b = await readFile(p); r.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); r.end(b);
  } catch { r.writeHead(404); r.end(); }
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${srv.address().port}/`;

const browser = await playwright.chromium.launch({ args: ['--lang=ko-KR'] });
const conv = await browser.newPage();
const manifest = (() => { try { return JSON.parse(readFileSync(join(OUT, 'shots.json'), 'utf8')); } catch { return {}; } })();
/** PNG → WebP(브라우저 캔버스로. 그림 도구를 따로 깔지 않게). w: 줄여 저장할 폭 */
async function save(name, png, { q = 0.76, w = 0 } = {}) {
  const [data, W, H] = await conv.evaluate(async ({ data, q, w }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode();
    const s = w && w < img.naturalWidth ? w / img.naturalWidth : 1;
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
    return [c.toDataURL('image/webp', q).split(',')[1], c.width, c.height];
  }, { data: png.toString('base64'), q, w });
  const buf = Buffer.from(data, 'base64');
  writeFileSync(join(OUT, name + '.webp'), buf);
  manifest[name] = { w: W, h: H, kb: Math.round(buf.length / 1024) };
  console.log(`${name}.webp ${W}×${H} ${Math.round(buf.length / 1024)}KB`);
}
async function shoot(dir, { width = 1280, height = 800, dpr = 1, full = 0, wait = 2600 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, locale: 'ko-KR', colorScheme: 'light', reducedMotion: 'reduce' }); // 동작 줄이기: 움직이는 그래픽이 멈춘 중간 모습이 아니라 완성된 정지 그림으로 찍힘(엔진이 보장하는 상태)
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`  ${dir} 화면 오류:`, e.message));
  await page.goto(base + dir + '/index.html', { waitUntil: 'load' });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(wait);
  let png;
  if (full) {
    // 휴대폰 화면: 위에서부터 full 높이만큼. 내려가며 등장 효과를 모두 풀고 맨 위로 돌아와 찍음
    await page.evaluate(async (h) => { for (let y = 0; y <= h; y += 300) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); }, full);
    await page.waitForTimeout(1200);
    png = await page.screenshot({ fullPage: true, clip: { x: 0, y: 0, width, height: full } });
  } else png = await page.screenshot();
  await ctx.close();
  return png;
}

mkdirSync(OUT, { recursive: true });
try {
  if (want('show')) {
    const sel = example('sel-story');
    for (const id of SHOWCASE) {
      if (!E.getPreset(id)) { console.warn(`디자인 ${id}가 없어 건너뜀`); continue; }
      await save(`show-${id}`, await shoot(buildTo(`show-${id}`, withPreset(sel, id))), { q: 0.74 });
    }
  }
  const quiet = (bp) => ({ ...bp, live: { ...(bp.live || {}), provider: 'none', features: [] } });
  if (want('site') || want('phone')) {
    const dir = buildTo('data-lab', quiet(example('data-lab')));
    if (want('site')) {
      const png = await shoot(dir);
      await save('site-data-lab', png, { q: 0.76, w: 1120 }); // 이야기 '엮어요' 장면, 말로 고치기의 처음 모습
      await save('hero-data-lab', png, { q: 0.62, w: 760 }); // 첫 화면: 교재 표지 밑에 깔려 모서리만 보이므로 작게(첫 화면을 빨리)
      await save('hero-data-lab-s', png, { q: 0.5, w: 520 }); // 좁은 화면 첫 화면(글 아래에 조금 걸침): 더 가볍게, 미리 받아도 첫 그림을 늦추지 않게
    }
    if (want('phone')) await save('phone-data-lab', await shoot(dir, { width: 390, height: 844, dpr: 1.5, full: 2400 }), { q: 0.7 });
  }
  if (want('say')) {
    // 앱의 말로 고치기(design-words)를 그대로 불러 첫 안을 고르고 적용
    const { findFixes } = await import(pathToFileURL(join(APP, 'src', 'design-words', 'symptoms.js')).href);
    const { applyWords } = await import(pathToFileURL(join(APP, 'src', 'design-words', 'words.js')).href);
    const dl = quiet(example('data-lab'));
    manifest.say = [];
    for (const [n, text] of SAYS.entries()) {
      const f = findFixes(dl, text).fixes.find((x) => !x.focus || x.focus === 'hero');
      if (!f) { console.warn(`'${text}'로 첫 화면을 바꾸는 안이 없어 건너뜀`); continue; }
      await save(`say-${n}`, await shoot(buildTo(`say-${n}`, applyWords(dl, f.ids))), { q: 0.74, w: 1120 });
      manifest.say.push({ shot: `say-${n}`, text, title: f.title, why: f.why });
    }
  }
  const vsBase = arg('vs-base'), vsBp = arg('vs-bp');
  if (want('vs') && vsBase && vsBp) {
    cpSync(resolve(vsBase), join(TMP, 'vs-base'), { recursive: true });
    const lp = buildTo('vs-lp', JSON.parse(readFileSync(resolve(vsBp), 'utf8')));
    for (const [name, dir] of [['vs-base', 'vs-base'], ['vs-lp', lp]]) {
      await save(name, await shoot(dir), { q: 0.74, w: 1120 });
      await save(`${name}-m`, await shoot(dir, { width: 390, height: 760, dpr: 1.5 }), { q: 0.72 }); // 좁은 화면: 휴대폰 크기 그대로
    }
  }
  manifest.showcase = SHOWCASE.filter((id) => manifest[`show-${id}`]);
  manifest.made = new Date().toISOString().slice(0, 10);
  writeFileSync(join(OUT, 'shots.json'), JSON.stringify(manifest, null, 1) + '\n');
} finally {
  await browser.close(); srv.close(); rmSync(TMP, { recursive: true, force: true });
}
