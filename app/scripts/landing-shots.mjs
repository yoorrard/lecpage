// 첫 화면(랜딩)·참고 디자인에 넣는 실제 사이트 그림을 다시 찍습니다.
//   src/landing/shots/{site,hero,hero-s,phone}-data-lab.webp + shots.json : 대표 레퍼런스(AI가 교재로 만든 사이트)
//   public/img/ref-<id>.webp : 참고 디자인 카드(레퍼런스마다)
// 쓰는 법(app 폴더에서): node scripts/prepare.mjs 다음에  node scripts/landing-shots.mjs
// 그림은 public/examples/<id>/(prepare가 엔진 키트로 조립한 레퍼런스 사이트)를 그대로 찍어요(모형이 아님). 레퍼런스가 바뀌면 다시 돌리세요.
// playwright는 앱의 의존성이 아닙니다. 개발 환경에 설치된 것을 씁니다.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const EXAMPLES = join(APP, 'public', 'examples');
const OUT = join(APP, 'src', 'landing', 'shots');
const IMG = join(APP, 'public', 'img');
const MAIN = 'data-lab'; // 첫 화면·이야기·배포 장면에 쓰는 대표 레퍼런스

let playwright;
try { playwright = createRequire(import.meta.url)('playwright'); }
catch { console.error('playwright를 찾지 못했어요. 개발 환경에 설치해 주세요(npm i -g playwright && npx playwright install chromium).'); process.exit(1); }
if (!existsSync(join(EXAMPLES, MAIN, 'index.html'))) { console.error('public/examples가 없어요. 먼저 node scripts/prepare.mjs를 실행해 주세요.'); process.exit(1); }

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const srv = createServer(async (q, r) => {
  try {
    const p = resolve(join(EXAMPLES, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')));
    if (!p.startsWith(EXAMPLES + sep)) throw 0;
    const b = await readFile(p); r.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); r.end(b);
  } catch { r.writeHead(404); r.end(); }
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${srv.address().port}/`;

const browser = await playwright.chromium.launch({ args: ['--lang=ko-KR'] });
const conv = await browser.newPage();
const manifest = (() => { try { return JSON.parse(readFileSync(join(OUT, 'shots.json'), 'utf8')); } catch { return {}; } })();
for (const k of Object.keys(manifest)) if (!/-data-lab$/.test(k)) delete manifest[k]; // 예전 그림(쇼케이스·말로 고치기·견주기) 기록 지움
/** PNG → WebP(브라우저 캔버스로. 그림 도구를 따로 깔지 않게). w: 줄여 저장할 폭 */
async function save(file, png, { q = 0.76, w = 0, key = '' } = {}) {
  const [data, W, H] = await conv.evaluate(async ({ data, q, w }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode();
    const s = w && w < img.naturalWidth ? w / img.naturalWidth : 1;
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
    return [c.toDataURL('image/webp', q).split(',')[1], c.width, c.height];
  }, { data: png.toString('base64'), q, w });
  const buf = Buffer.from(data, 'base64');
  writeFileSync(file, buf);
  if (key) manifest[key] = { w: W, h: H, kb: Math.round(buf.length / 1024) };
  console.log(`${file.slice(APP.length + 1)} ${W}×${H} ${Math.round(buf.length / 1024)}KB`);
}
async function shoot(id, { width = 1280, height = 800, dpr = 1, full = 0, wait = 1800 } = {}) {
  // 동작 줄이기: 움직이는 그래픽이 멈춘 중간 모습이 아니라 완성된 정지 그림으로
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, locale: 'ko-KR', colorScheme: 'light', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`  ${id} 화면 오류:`, e.message));
  await page.goto(base + id + '/index.html', { waitUntil: 'load' });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(wait);
  let png;
  if (full) {
    await page.evaluate(async (h) => { for (let y = 0; y <= h; y += 300) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); }, full);
    await page.waitForTimeout(1000);
    png = await page.screenshot({ fullPage: true, clip: { x: 0, y: 0, width, height: full } });
  } else png = await page.screenshot();
  await ctx.close();
  return png;
}

mkdirSync(OUT, { recursive: true }); mkdirSync(IMG, { recursive: true });
try {
  const png = await shoot(MAIN);
  await save(join(OUT, `site-${MAIN}.webp`), png, { q: 0.76, w: 1120, key: `site-${MAIN}` }); // 이야기 '다듬어요' 장면
  // 첫 화면 두 판의 폭(760·520)을 바꾸면 src/landing/hero-shot.js의 크기도 함께
  await save(join(OUT, `hero-${MAIN}.webp`), png, { q: 0.62, w: 760, key: `hero-${MAIN}` });
  await save(join(OUT, `hero-${MAIN}-s.webp`), png, { q: 0.5, w: 520, key: `hero-${MAIN}-s` });
  await save(join(OUT, `phone-${MAIN}.webp`), await shoot(MAIN, { width: 390, height: 844, dpr: 1.5, full: 2400 }), { q: 0.7, key: `phone-${MAIN}` });
  for (const id of readdirSync(EXAMPLES).filter((d) => existsSync(join(EXAMPLES, d, 'index.html')))) await save(join(IMG, `ref-${id}.webp`), await shoot(id), { q: 0.72, w: 640 });
  manifest.made = new Date().toISOString().slice(0, 10);
  writeFileSync(join(OUT, 'shots.json'), JSON.stringify(manifest, null, 1) + '\n');
} finally {
  await browser.close(); srv.close();
}
