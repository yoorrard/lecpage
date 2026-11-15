#!/usr/bin/env node
// 앱 빌드 짧은 흐름 시험(Playwright, CI용): app/dist를 띄워 첫 화면 → 예시 모음 → 개인정보 안내를 열고,
// 화면이 그려지는지와 스크립트 오류가 없는지만 봅니다(30초 안팎). 의존성(preact·vite 등) 판을 올린 뒤 '빌드는 되는데 빈 화면'을 막는 것.
// 바깥 네트워크는 모두 막습니다(글꼴·AI·배포 서버를 부르지 않음).
//   npm --prefix app run build && node app/scripts/smoke.mjs        (포트 4189, --port=…)
// playwright는 앱 의존성이 아닙니다. 개발 환경(또는 CI가 설치한 것)을 씁니다.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = Number((process.argv.find((a) => a.startsWith('--port=')) || '').slice(7)) || 4189;
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch { console.error('playwright를 찾지 못했어요.'); process.exit(2); }
if (!existsSync(join(DIST, 'index.html'))) { console.error('app/dist가 없어요. 먼저 npm --prefix app run build'); process.exit(2); }

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.mjs': 'text/javascript' };
const server = createServer((req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let f = join(DIST, p);
  if (!f.startsWith(DIST)) { res.writeHead(403).end(); return; }
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) { res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }).end(existsSync(join(DIST, '404.html')) ? readFileSync(join(DIST, '404.html')) : ''); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }).end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const base = `http://127.0.0.1:${PORT}/`;

// 첫 화면은 사용자가 정한 문장으로, 나머지는 화면 제목(h1)이 그려지고 앞 화면과 달라졌는지로(문구가 바뀌어도 시험은 그대로)
const steps = [
  ['첫 화면', '', '바쁜 강사님의 시간과 토큰을 아껴드립니다'],
  ['디자인 둘러보기', '#/gallery', ''],
  ['개인정보 안내', '#/help/privacy', ''],
];
const browser = await chromium.launch({ args: ['--no-sandbox'] });
let failed = 0;
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e?.message || e)));
  await page.route('**/*', (route) => (route.request().url().startsWith(base) ? route.continue() : route.abort()));
  let prevH1 = '';
  for (const [name, hash, text] of steps) {
    errors.length = 0;
    await page.goto(base + hash, { waitUntil: 'domcontentloaded' });
    let ok = false;
    try {
      if (text) await page.getByText(text, { exact: false }).first().waitFor({ timeout: 15000 });
      else await page.waitForFunction((prev) => { const t = document.querySelector('h1')?.textContent?.trim() || ''; return t && t !== prev; }, prevH1, { timeout: 15000 });
      ok = true;
    } catch { /* 아래에서 알림 */ }
    await page.waitForTimeout(300);
    prevH1 = await page.evaluate(() => document.querySelector('h1')?.textContent?.trim() || '');
    const good = ok && !errors.length;
    if (!good) failed++;
    console.log(`${good ? '통과' : '실패'} ${name}${ok ? '' : text ? ` — '${text}'가 보이지 않아요` : ' — 화면 제목이 그려지지 않아요'}${errors.length ? ` — 스크립트 오류: ${errors.slice(0, 2).join(' / ')}` : ''}`);
  }
} finally { await browser.close(); server.close(); }
process.exit(failed ? 1 : 0);
