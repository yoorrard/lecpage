// 도움말에 넣는 실제 화면 그림을 다시 찍습니다 → public/help/*.webp
// 쓰는 법(app 폴더에서):  npm run build && node scripts/help-shots.mjs
//   --base=http://localhost:4174/  이미 띄워 둔 미리보기 서버를 씀(없으면 이 스크립트가 vite preview를 띄웠다가 끔)
//   --only=start,edit              일부만 다시 찍음
// 화면이 바뀌면 다시 돌리면 됩니다. 찍는 동안 바깥 네트워크는 모두 막고, AI 응답은 예시 설계도로 흉내 냅니다(키·교재가 어디로도 가지 않음).
// playwright는 앱의 의존성이 아닙니다. 개발 환경에 설치된 것을 씁니다(npx playwright install chromium).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const SKILL = join(APP, '..', 'skills', 'lecpage');
const OUT = join(APP, 'public', 'help');
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');
const ONLY = arg('only') ? arg('only').split(',') : null;
const want = (n) => !ONLY || ONLY.includes(n);
const SIZES = [[1200, 750, ''], [390, 720, '-m']]; // 넓은 화면용 · 휴대폰용(-m). 연결 창은 창만 잘라 찍음
const QUALITY = 0.8;

let playwright;
try { playwright = createRequire(import.meta.url)('playwright'); }
catch { console.error('playwright를 찾지 못했어요. 개발 환경에 설치해 주세요(npm i -g playwright && npx playwright install chromium).'); process.exit(1); }

// ── 미리보기 서버 ──
let base = arg('base'); let server = null;
if (!base) {
  const port = 4179;
  server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { cwd: APP, stdio: 'ignore' });
  base = `http://localhost:${port}/`;
  for (let i = 0; i < 40; i++) { try { if ((await fetch(base)).ok) break; } catch { /* 아직 안 뜸 */ } await new Promise((r) => setTimeout(r, 250)); }
}
base = base.replace(/\/?$/, '/');

// ── 흉내 낸 AI 응답 ──
const EXAMPLE = JSON.parse(readFileSync(join(SKILL, 'examples', 'sel-story.blueprint.json'), 'utf8'));
const CORS = { 'access-control-allow-origin': '*' };
const json = (r, body) => r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
const FAKE_KEY = 'AIzaSyHELP_SHOTS_ONLY_0000000000000000000';

const browser = await playwright.chromium.launch({ args: ['--lang=ko-KR'] });
const route = async (r) => {
  const u = r.request().url();
  if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { ...CORS, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (u.includes('generativelanguage.googleapis.com') && /\/models(\?|$)/.test(u)) return json(r, { models: [{ name: 'models/gemini-3.8-flash', displayName: 'Gemini 3.8 Flash', supportedGenerationMethods: ['generateContent'] }] });
  if (u.includes(':generateContent')) return json(r, { candidates: [{ content: { parts: [{ text: JSON.stringify(EXAMPLE) }] }, finishReason: 'STOP' }] });
  return r.fulfill({ status: 204, headers: CORS }); // 그 밖의 바깥 요청은 빈 응답(막으면 접속 확인이 '이 망에서 막힘'으로 보여 화면이 달라짐)
};

/** PNG → WebP(브라우저의 캔버스로 바꿈: 따로 그림 도구를 깔지 않아도 되게) */
const conv = await browser.newPage();
async function save(name, png) {
  const b64 = await conv.evaluate(async ({ data, q }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return [c.toDataURL('image/webp', q).split(',')[1], c.width, c.height];
  }, { data: png.toString('base64'), q: QUALITY });
  const buf = Buffer.from(b64[0], 'base64');
  writeFileSync(join(OUT, name + '.webp'), buf);
  console.log(`${name}.webp ${b64[1]}×${b64[2]} ${Math.round(buf.length / 1024)}KB`);
}

mkdirSync(OUT, { recursive: true });
try {
  for (const [w, h, tail] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'ko-KR', colorScheme: 'light', reducedMotion: 'reduce' });
    await ctx.route((u) => !u.href.startsWith(base), route);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error('화면 오류:', e.message));
    const settle = (ms = 500) => page.waitForTimeout(ms);
    const top = (sel) => page.evaluate((q) => { const el = q && document.querySelector(q); window.scrollTo(0, el ? el.getBoundingClientRect().top + scrollY - 70 : 0); }, sel || '');
    const shot = async (name) => { await settle(); await save(name + tail, await page.screenshot()); };
    const shotOf = async (name, sel) => { await settle(); await save(name + tail, await page.locator(sel).first().screenshot()); };

    // 1. 교재 넣기: 예시 교재(엔진 시험용 파일)를 넣은 모습
    await page.goto(base + '#/', { waitUntil: 'load' });
    await page.setInputFiles('.ld-hero input[type=file][multiple]', [join(SKILL, 'engine', 'test', 'fixtures', 'workshop.pptx'), join(SKILL, 'engine', 'test', 'fixtures', 'workshop.pdf')]);
    await page.waitForSelector('.files li', { timeout: 60000 });
    await page.waitForFunction(() => !document.querySelector('.drop b')?.textContent.includes('중'), null, { timeout: 90000 });
    await page.locator('.field:has-text("연수명") input').first().fill('수업에 바로 쓰는 생성형 AI');
    await page.locator('.field:has-text("장소") input').first().fill('본관 3층 컴퓨터실');
    await page.locator('.step-head h1').click(); // 입력 칸의 초점 테두리를 뺌
    await settle(3000); // 알림 글이 사라진 뒤에
    await top();
    if (want('start')) await shot('start');

    // 2. AI 연결 창: 키 페이지 열기 → 붙여넣기
    // 키가 없으면 교재 넣기 화면의 AI 카드 '다른 방법'에서 [API 키로 만들기]
    if (await page.locator('.make-card').count()) await page.click('.make-card button:has-text("API 키로 만들기")');
    else await page.click('.make-bar .btn-primary');
    await page.waitForSelector('dialog[open] .ai-connect');
    if (want('connect')) await shotOf('connect', 'dialog[open] .dlg-in');
    await page.click('dialog[open] .key-dots li:last-child button');
    if (want('paste')) await shotOf('paste', 'dialog[open] .dlg-in');

    // 3. 연결하고 만들기 → 살펴보고 고치기(AI가 짠 결과)
    await page.fill('dialog[open] input[type=password]', FAKE_KEY);
    await page.click('dialog[open] .key-now button:has-text("연결")');
    await page.waitForSelector('.ai-job.ok', { timeout: 60000 });
    await page.waitForSelector('.pv-device iframe', { timeout: 30000 });
    // 결과 띠는 닫음(750px 높이에서는 띠·구성 안내가 미리보기 자리를 줄여 미리보기가 아주 작게 찍힘)
    await page.locator('.ai-job.ok button[aria-label="닫기"]').click().catch(() => {});
    await settle(1800);
    if (want('edit')) await shot('edit');
    // 좁은 화면에서는 미리보기 아래에 고치는 칸이 있어 그쪽으로 내려서 찍음
    if (want('live')) { await page.click('[role=tab]:has-text("참여 기능")'); if (tail) await top('.ws-panel'); await shot('live'); }
    if (want('review')) { await page.click('[role=tab]:has-text("수정 요청")'); if (tail) await top('.ws-panel'); await shot('review'); }

    // 4. 배포하기
    if (want('share')) {
      await top();
      await page.click('.head-tools .btn-primary');
      await page.waitForFunction(() => /\/3$/.test(location.hash), null, { timeout: 10000 });
      await settle(1500); await top();
      await shot('share');
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  server?.kill();
}
