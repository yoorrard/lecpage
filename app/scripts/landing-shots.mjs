// 첫 화면(랜딩)·참고 디자인에 넣는 실제 사이트 그림을 다시 찍습니다.
//   src/landing/shots/pc-<id>.webp · pc-<id>-s.webp : PC 화면(1280×800) 첫 화면 — 첫 화면 노트북 틀(넓은 화면·좁은 화면)
//   src/landing/shots/ph-<id>.webp                  : 휴대폰 화면(390×795, 2배로 찍어 폭 450) 첫 화면 — 첫 화면 휴대폰 틀(PC 그림을 자른 것이 아님).
//                                                     틀의 화면은 390×845(19.5:9)이고 위 50은 상태 표시줄이라 사이트는 그 아래 390×795.
//                                                     크기 기록의 bar는 사이트 맨 윗줄 색(상태 표시줄 바탕을 사이트와 잇는 데 씀)
//   src/landing/shots/m-<대표 사례>.webp              : 휴대폰 화면(390×844, 폭 450) 첫 화면 — 교재가 사이트가 되는 장면의 휴대폰 틀
//   src/landing/shots/tall-<id>.webp                : PC 화면 긴 그림(폭 900) — 사례 카드(마우스를 올리면 아래로 흘러감)
//   src/landing/shots/slide-<n>.webp                : 대표 사례(neo-teach) 교재 쪽 그림(폭 1000) — 교재가 사이트가 되는 장면·발표 화면·강의 엔진 칸
//   src/landing/shots/shots.json                    : 크기 기록(자리 밀림 없게 width·height로 씀)
//   public/img/ref-<id>.webp                        : 참고 디자인 카드(레퍼런스마다)
// 쓰는 법(app 폴더에서): node scripts/prepare.mjs 다음에  node scripts/landing-shots.mjs
//   일부만 다시 찍기: node scripts/landing-shots.mjs ph tall slide   (pc · ph · m · tall · slide 중에서. 나머지 그림과 크기 기록은 그대로 둠)
// 그림은 public/examples/<id>/(prepare가 엔진 키트로 조립한 레퍼런스 사이트)를 그대로 찍어요(모형이 아님). 레퍼런스가 바뀌면 다시 돌리세요.
// 움직이는 첫 화면(WebGL·글자 등장)은 다 그려진 뒤에 찍어요. playwright는 앱의 의존성이 아닙니다. 개발 환경에 설치된 것을 씁니다.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const EXAMPLES = join(APP, 'public', 'examples');
const OUT = join(APP, 'src', 'landing', 'shots');
const IMG = join(APP, 'public', 'img');
const IDS = ['neo-teach', 'picture-heart', 'data-pulse']; // 첫 화면 순서(src/landing/showcases.js와 같게)
const MAIN = IDS[0];
const SLIDES = [1, 3, 5, 8, 10, 12, 15]; // 대표 사례 교재에서 쓰는 쪽(src/landing/showcases.js SLIDES와 같게)
const KINDS = ['pc', 'ph', 'm', 'tall', 'slide'];
const ONLY = process.argv.slice(2).filter((a) => KINDS.includes(a));
const want = (k) => !ONLY.length || ONLY.includes(k);

let playwright;
try { playwright = createRequire(import.meta.url)('playwright'); }
catch { console.error('playwright를 찾지 못했어요. 개발 환경에 설치해 주세요(npm i -g playwright && npx playwright install chromium).'); process.exit(1); }
for (const id of IDS) if (!existsSync(join(EXAMPLES, id, 'index.html'))) { console.error(`public/examples/${id}가 없어요. 먼저 node scripts/prepare.mjs를 실행해 주세요.`); process.exit(1); }

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const srv = createServer(async (q, r) => {
  try {
    const p = resolve(join(EXAMPLES, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')));
    if (!p.startsWith(EXAMPLES + sep)) throw 0;
    const b = await readFile(p); r.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); r.end(b);
  } catch { r.writeHead(404); r.end(); }
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${srv.address().port}/`;

const browser = await playwright.chromium.launch({ args: ['--lang=ko-KR', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const conv = await browser.newPage();
// 일부만 찍을 때는 예전 크기 기록을 이어 씀
let manifest = {};
if (ONLY.length) try { manifest = JSON.parse(readFileSync(join(OUT, 'shots.json'), 'utf8')); } catch { manifest = {}; }
/** PNG(또는 WebP) → WebP(브라우저 캔버스로. 그림 도구를 따로 깔지 않게). w: 줄여 저장할 폭, h: 위에서부터 자를 높이(줄인 뒤 기준)
 *  bar: 맨 윗줄 두 줄에서 가장 많은 색을 크기 기록에 함께 남김(휴대폰 틀의 상태 표시줄 바탕) */
async function save(file, png, { q = 0.74, w = 0, h = 0, key = '', mime = 'image/png', bar = false } = {}) {
  const [data, W, H, top] = await conv.evaluate(async ({ data, q, w, h, mime, bar }) => {
    const img = new Image(); img.src = `data:${mime};base64,` + data; await img.decode();
    const s = w && w < img.naturalWidth ? w / img.naturalWidth : 1;
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.min(Math.round(img.naturalHeight * s), h || Infinity);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, Math.round(img.naturalWidth * s), Math.round(img.naturalHeight * s));
    let top = '';
    if (bar) {
      const px = g.getImageData(0, 0, c.width, 2).data, n = new Map();
      for (let i = 0; i < px.length; i += 4) { const k = '#' + [0, 1, 2].map((j) => px[i + j].toString(16).padStart(2, '0')).join(''); n.set(k, (n.get(k) || 0) + 1); }
      top = [...n].sort((a, b) => b[1] - a[1])[0][0];
    }
    return [c.toDataURL('image/webp', q).split(',')[1], c.width, c.height, top];
  }, { data: png.toString('base64'), q, w, h, mime, bar });
  const buf = Buffer.from(data, 'base64');
  writeFileSync(file, buf);
  if (key) manifest[key] = { w: W, h: H, kb: Math.round(buf.length / 1024), ...(top ? { bar: top } : {}) };
  console.log(`${file.slice(APP.length + 1)} ${W}×${H} ${Math.round(buf.length / 1024)}KB`);
}
async function shoot(id, { width = 1280, height = 800, dpr = 1, full = 0, wait = 3200 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, locale: 'ko-KR', colorScheme: 'light', timezoneId: 'Asia/Seoul' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`  ${id} 화면 오류:`, e.message));
  await page.goto(base + id + '/index.html', { waitUntil: 'load' });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(wait);
  let png;
  if (full) {
    // 스크롤로 나타나는 것을 모두 그린 뒤 위로 돌아와 긴 그림으로(긴 그림에서는 화면에 붙어 떠 있는 참여 도크를 가림)
    await page.evaluate(async (h) => { for (let y = 0; y <= h; y += 300) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 140)); } scrollTo(0, 0); }, full);
    await page.waitForTimeout(1600);
    await page.addStyleTag({ content: '[data-dock]{visibility:hidden!important}' }).catch(() => { });
    png = await page.screenshot({ fullPage: true, clip: { x: 0, y: 0, width, height: full } });
  } else png = await page.screenshot();
  await ctx.close();
  return png;
}

mkdirSync(OUT, { recursive: true }); mkdirSync(IMG, { recursive: true });
if (!ONLY.length) {
  for (const f of readdirSync(OUT)) if (/\.webp$/.test(f)) rmSync(join(OUT, f)); // 예전 그림(다른 사례·견주기) 지움
  for (const f of readdirSync(IMG)) if (/^ref-.+\.webp$/.test(f) && !IDS.includes(f.slice(4, -5))) rmSync(join(IMG, f));
}
try {
  for (const id of IDS) {
    if (want('pc')) {
      const pc = await shoot(id);
      // 첫 화면 노트북 틀: 넓은 화면 1120(고해상도 화면에서 또렷하게) · 좁은 화면 440(src/landing/Hero.jsx의 picture 경계와 함께)
      await save(join(OUT, `pc-${id}.webp`), pc, { q: id === MAIN ? 0.68 : 0.64, w: 1120, key: `pc-${id}` });
      await save(join(OUT, `pc-${id}-s.webp`), pc, { q: 0.6, w: 440, key: `pc-${id}-s` });
      await save(join(IMG, `ref-${id}.webp`), pc, { q: 0.72, w: 640 });
    }
    // 첫 화면 휴대폰 틀: 휴대폰 폭(390)으로 찍은 사이트(고해상도 휴대폰에서도 또렷하게 450). 높이 795 = 화면 845(19.5:9) − 상태 표시줄 50
    if (want('ph')) await save(join(OUT, `ph-${id}.webp`), await shoot(id, { width: 390, height: 795, dpr: 2 }), { q: 0.7, w: 450, key: `ph-${id}`, bar: true });
    // 이야기 장면(src/landing/Story.jsx)의 휴대폰 틀: 대표 사례만
    if (want('m') && id === MAIN) await save(join(OUT, `m-${id}.webp`), await shoot(id, { width: 390, height: 844, dpr: 2 }), { q: 0.7, w: 450, key: `m-${id}` });
    // 사례 카드의 긴 그림: 넓은 칸(약 450px)이 고해상도 화면에서도 또렷하게 900
    if (want('tall')) await save(join(OUT, `tall-${id}.webp`), await shoot(id, { full: 3000 }), { q: 0.6, w: 900, key: `tall-${id}` });
  }
  if (want('slide')) for (const n of SLIDES) {
    const src = join(EXAMPLES, MAIN, 'material', `p-${String(n).padStart(3, '0')}.webp`);
    await save(join(OUT, `slide-${n}.webp`), readFileSync(src), { q: 0.72, w: 1000, key: `slide-${n}`, mime: 'image/webp' });
  }
  manifest.made = new Date().toISOString().slice(0, 10);
  writeFileSync(join(OUT, 'shots.json'), JSON.stringify(manifest, null, 1) + '\n');
} finally {
  await browser.close(); srv.close();
}
