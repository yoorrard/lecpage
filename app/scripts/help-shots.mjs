// 도움말에 넣는 실제 화면 그림을 다시 찍습니다 → public/help/*.webp
// 쓰는 법(app 폴더에서):  npm run build && node scripts/help-shots.mjs
//   --base=http://localhost:4174/  이미 띄워 둔 미리보기 서버를 씀(없으면 이 스크립트가 vite preview를 띄웠다가 끔)
//   --only=start,edit              일부만 다시 찍음
// 화면이 바뀌면 다시 돌리면 됩니다. 찍는 동안 바깥 네트워크는 모두 막고, AI는 흉내 냅니다(키·교재가 어디로도 가지 않음):
// 키 확인은 모델 목록으로, 만들기는 대표 레퍼런스(data-lab)의 파일을 한 답으로(src/lib/gen/demo-answers.js) Claude 스트림 꼴로 돌려줌.
// playwright는 앱의 의존성이 아닙니다. 개발 환경에 설치된 것을 씁니다(npx playwright install chromium).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

// ── 흉내 낸 AI 응답: 대표 레퍼런스 사이트를 단계별 답으로 ──
const REF = join(SKILL, 'references', 'designs', 'data-lab');
const { demoAnswers } = await import(pathToFileURL(join(APP, 'src', 'lib', 'gen', 'demo-answers.js')).href);
const answer = demoAnswers({ html: readFileSync(join(REF, 'site', 'index.html'), 'utf8'), css: readFileSync(join(REF, 'site', 'assets', 'style.css'), 'utf8'), js: readFileSync(join(REF, 'site', 'assets', 'site.js'), 'utf8'), meta: JSON.parse(readFileSync(join(REF, 'lecpage.json'), 'utf8')) });
/** Claude /v1/messages 요청 → 그 단계의 답(SSE) */
function claudeStream(body) {
  const text = (body.messages || []).flatMap((m) => (Array.isArray(m.content) ? m.content : [])).map((x) => x.text || '').join('\n');
  const m = /작업 단계: (build)/.exec(text);
  const out = m ? answer({ name: m[1] }) : '';
  const ev = (type, o) => `event: ${type}\ndata: ${JSON.stringify({ type, ...o })}\n\n`;
  return ev('message_start', { message: { usage: { input_tokens: 1 } } }) + ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: out } }) + ev('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } }) + ev('message_stop', {});
}
const CORS = { 'access-control-allow-origin': '*' };
const json = (r, body) => r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
const FAKE_KEY = 'sk-ant-api03-HELP_SHOTS_ONLY_000000000000000000000000';

const browser = await playwright.chromium.launch({ args: ['--lang=ko-KR'] });
const route = async (r) => {
  const u = r.request().url();
  if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { ...CORS, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (/api\.anthropic\.com\/v1\/models/.test(u)) return json(r, { data: [{ id: 'claude-help-shots', display_name: 'Claude' }] });
  if (/api\.anthropic\.com\/v1\/messages/.test(u)) return r.fulfill({ status: 200, contentType: 'text/event-stream', headers: CORS, body: claudeStream(JSON.parse(r.request().postData() || '{}')) });
  // 바로 배포가 켜진 빌드(VITE_PUBLISH_API)로 찍을 때: HELP_INFO(운영 서버 /api/info를 읽어 둔 JSON 파일)로 답함 → 운영과 같은 '바로 배포' 화면
  if (process.env.HELP_INFO && /\/api\/info(\?|$)/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: readFileSync(process.env.HELP_INFO, 'utf8') });
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
    await ctx.addInitScript(() => { globalThis.__lpGenTest = { noFix: true }; }); // 흉내 낸 답에는 검수 고치기 단계 답이 없어 건너뜀
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error('화면 오류:', e.message));
    const settle = (ms = 500) => page.waitForTimeout(ms);
    const top = (sel) => page.evaluate((q) => { const el = q && document.querySelector(q); window.scrollTo(0, el ? el.getBoundingClientRect().top + scrollY - 70 : 0); }, sel || '');
    const shot = async (name) => { await settle(); await save(name + tail, await page.screenshot()); };
    const shotOf = async (name, sel) => { await settle(); await save(name + tail, await page.locator(sel).first().screenshot()); };

    // 1. 교재 넣기 + AI 고르기: 예시 교재(엔진 시험용 파일)를 넣은 모습
    await page.goto(base + '#/', { waitUntil: 'load' });
    await page.setInputFiles('.ld-hero input[type=file][multiple]', [join(SKILL, 'engine', 'test', 'fixtures', 'workshop.pdf')]);
    await page.waitForSelector('.ai-card .btn:not([disabled])', { timeout: 90000 });
    await page.locator('.step-head h1').click(); // 입력 칸의 초점 테두리를 뺌
    await settle(3000); // 알림 글이 사라진 뒤에
    await top();
    if (want('start')) await shot('start');

    // 2. 키 연결 창: Claude 카드의 [키로 연결] → 키 페이지 열기 → 붙여넣기
    await page.click('.ai-card:has(h3:text-is("Claude")) button:has-text("키로 연결")');
    await page.waitForSelector('dialog[open] .ai-connect');
    if (want('connect')) await shotOf('connect', 'dialog[open] .dlg-in');
    await page.click('dialog[open] .key-dots li:last-child button');
    if (want('paste')) await shotOf('paste', 'dialog[open] .dlg-in');

    // 3. 연결하면 바로 만들기 → 완성 화면(목록·미리보기)
    await page.fill('dialog[open] input[type=password]', FAKE_KEY);
    await page.click('dialog[open] .key-now button:has-text("연결")');
    await page.waitForSelector('#panel-info button:has-text("이 정보가 맞아요")', { timeout: 90000 });
    await page.click('#panel-info button:has-text("이 정보가 맞아요")');
    await page.click('#tab-list');
    await page.waitForSelector('.pv-device iframe', { timeout: 30000 });
    await settle(2500);
    if (want('edit')) { await top(); await shot('edit'); }

    // 4. 배포하기(참여 기능 줄이 첫 줄)
    await top();
    await page.click('.head-tools .btn-primary');
    await page.waitForFunction(() => /\/3$/.test(location.hash), null, { timeout: 10000 });
    await settle(1500); await top();
    if (want('share')) await shot('share');
    if (want('live')) { await top('#live-setup'); await shot('live'); }
    await ctx.close();
  }
} finally {
  await browser.close();
  server?.kill();
}
