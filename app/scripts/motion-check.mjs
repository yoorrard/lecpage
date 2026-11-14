#!/usr/bin/env node
// 앱 안 디자인 미리보기의 움직임 검사(Playwright): 디자인을 보여 주는 곳에서 첫 화면 그림·등장 효과가 실제로 도는지 봅니다.
//   디자인 둘러보기: 담은 낱말 예시(늘 움직임) · 디자인 카드에 마우스를 올림(움직이는 화면이 겹쳐짐)
//   예시로 시작 → [디자인] 탭: 지금 고른 디자인 카드 · [크게 비교] 세 안 · 미리보기(편집 화면)
//   체험(#/demo): 미리보기
// 각 자리에서 iframe 안 효과 상태(LecFX.state)와 몇 장 찍은 화면의 바뀐 화소 비율을 잽니다(정지면 '멈춤').
// 쓰는 법(저장소 맨 위에서): npm --prefix app run build && node app/scripts/motion-check.mjs [--base=http://localhost:4187/] [--shots=폴더]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d = '') => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
let chromium;
for (const from of [import.meta.url, '/opt/node-tools/']) { try { ({ chromium } = createRequire(from)('playwright')); break; } catch { /* 다음 */ } }
if (!chromium) { console.error('playwright를 찾지 못했어요.'); process.exit(2); }

let base = arg('base'); let preview = null;
if (!base) {
  const port = 4189;
  preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { cwd: APP, stdio: 'ignore' });
  base = `http://localhost:${port}/`;
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break; } catch { /* 아직 */ } await new Promise((r) => setTimeout(r, 250)); }
}
base = base.replace(/\/?$/, '/');
const shots = arg('shots');
const results = [];
const put = (where, ok, detail) => { results.push({ where, ok, detail }); console.log(`${ok ? '움직임' : '멈춤  '}  ${where}  ${detail}`); };

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
const browser = await chromium.launch({ proxy });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, ignoreHTTPSErrors: !!proxy });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));

/** 브라우저 안: 두 PNG(base64)의 바뀐 화소 비율 */
async function diffInPage([a, b]) {
  const load = async (s) => createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob());
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  const W = 200, H = Math.max(1, Math.round((ia.height / ia.width) * W));
  const px = (img) => { const c = new OffscreenCanvas(W, H), g = c.getContext('2d'); g.drawImage(img, 0, 0, W, H); return g.getImageData(0, 0, W, H).data; };
  const pa = px(ia), pb = px(ib); let n = 0;
  for (let i = 0; i < pa.length; i += 4) if (Math.abs(pa[i] - pb[i]) > 20 || Math.abs(pa[i + 1] - pb[i + 1]) > 20 || Math.abs(pa[i + 2] - pb[i + 2]) > 20) n++;
  return n / (W * H);
}
const helper = await ctx.newPage(); await helper.goto('about:blank');
/** 요소 하나를 몇 장 찍어 바뀐 비율 */
async function frames(loc, tag, n = 4, gap = 900) {
  const imgs = [];
  for (let i = 0; i < n; i++) { if (i) await page.waitForTimeout(gap); const b = await loc.screenshot({ animations: 'allow', timeout: 15000 }); imgs.push(b); if (shots) { mkdirSync(shots, { recursive: true }); writeFileSync(join(shots, `${tag}-${i}.png`), b); } }
  const d = []; for (let i = 1; i < imgs.length; i++) d.push(+(await helper.evaluate(diffInPage, [imgs[i - 1].toString('base64'), imgs[i].toString('base64')])).toFixed(4));
  return d;
}
/** iframe 안 효과 상태: 프레임(src 없는 srcdoc)을 요소로 찾아 들어감 */
async function fxIn(frameEl) {
  const f = await frameEl.contentFrame(); if (!f) return null;
  return f.evaluate(() => (window.LecFX ? { ...window.LecFX.state(), on: [...document.querySelectorAll('.lp-hero [data-fx]')].map((e) => e.getAttribute('data-fx') + ':' + (e.__lecfx ? Object.values(e.__lecfx).map((v) => (v.skipped ? 'skip' : v.dead ? 'dead' : 'on')).join('') : '-')) } : { noFx: true })).catch((e) => ({ err: e.message.slice(0, 60) }));
}
/**
 * 움직이는 화면(iframe.is-live)이 드러나면(.is-on: 첫 화면 등장이 끝난 뒤 정지 그림과 바뀜) 몇 장 찍음.
 * want: 'loop' 끝없이 도는 그림이 계속 바뀌어야 함 · 'tour' 마우스를 올린 카드가 안에서 본문으로 내려가야 함 · 'fx' 효과가 켜져 돌았으면 됨(차분 단계는 등장 뒤 멈춤이 맞음)
 */
async function judge(where, box, want) {
  const fr = box.locator('iframe.is-live.is-on').first();
  await fr.waitFor({ state: 'attached', timeout: 25000 }).catch(() => {});
  if (!(await fr.count())) { put(where, false, '움직이는 화면이 드러나지 않음'); return; }
  const d = await frames(box, where.replace(/[^\w가-힣]+/g, '-'), want === 'fx' ? 2 : 5, 800);
  const st = await fxIn(await fr.elementHandle());
  const fxOn = !!st && !st.noFx && !st.err && st.on.some((x) => /:on/.test(x));
  const moving = want === 'loop' ? d.slice(-2).every((x) => x > 0.0004) : want === 'tour' ? d.some((x) => x > 0.0015) : true;
  put(where, moving && fxOn, `[${d.join(' ')}] ${JSON.stringify(st)}`);
}

// 1) 디자인 둘러보기: 담은 낱말 예시(늘 움직임)
await page.goto(base + '#/gallery');
await page.waitForSelector('.dict-now .mini-site iframe', { timeout: 30000 });
await judge('둘러보기 · 담은 낱말 예시(번지는 파문)', page.locator('.dict-now .mini-site'), 'loop');
// 디자인 카드: '돌과 물결' 카드에 마우스
const card = page.locator('.word-card').filter({ hasText: '돌과 물결' }).first();
await card.scrollIntoViewIfNeeded(); await page.waitForTimeout(1500);
await card.hover();
await judge('둘러보기 · 디자인 카드(돌과 물결)에 마우스', card.locator('.mini-site'), 'loop');
await page.mouse.move(5, 5);

// 2) 예시로 시작 → 디자인 탭
await page.goto(base + '#/');
const ex = page.getByRole('button', { name: '이 예시로 시작' }).first();
await ex.scrollIntoViewIfNeeded(); await ex.click();
await page.waitForURL(/#\/p\/[^/]+\/2/, { timeout: 30000 });
await page.getByRole('tab', { name: /디자인/ }).click();
await page.waitForSelector('.trio-thumbs .thumb', { timeout: 30000 });
// 지금 고른 디자인이 세 안에 없으면 첫 카드를 골라 둠
if (!(await page.locator('.trio-thumbs .thumb[aria-pressed="true"]').count())) await page.locator('.trio-thumbs .thumb').first().click();
await page.waitForTimeout(800);
await judge('디자인 탭 · 지금 고른 디자인 카드', page.locator('.trio-thumbs .thumb[aria-pressed="true"] .thumb-site'), 'fx');
const other = page.locator('.trio-thumbs .thumb[aria-pressed="false"]').first();
await other.hover();
await judge('디자인 탭 · 다른 카드에 마우스(본문 둘러보기)', other.locator('.thumb-site'), 'tour');
await page.mouse.move(5, 5);
const big = page.getByRole('button', { name: /크게 비교/ });
if (await big.count()) {
  await big.first().click();
  await page.waitForSelector('.trio-big .thumb-site', { timeout: 20000 });
  // 세 안이 한꺼번에 들어오므로 셋을 한 장에 담아 잼
  await judge('크게 비교 · 세 안', page.locator('.trio-big'), 'fx');
  const lives = page.locator('.trio-big iframe.is-live');
  for (let i = 0; i < await lives.count(); i++) { const st = await fxIn(await lives.nth(i).elementHandle()); put(`크게 비교 · ${i + 1}번째 안 효과`, !!st && !st.noFx && st.on.some((x) => /:on/.test(x)), JSON.stringify(st)); }
  await page.keyboard.press('Escape');
}
// 미리보기(편집 화면 오른쪽)
const pv = page.locator('iframe[title]').filter({ hasNot: page.locator('xx') });
const prevFrame = page.locator('.preview iframe, .pv-frame iframe, iframe[sandbox*="allow-modals"]').first();
if (await prevFrame.count()) {
  const st = await fxIn(await prevFrame.elementHandle());
  put('편집 화면 · 미리보기', !!st && !st.noFx && st.level >= 1, JSON.stringify(st));
}
void pv;

// 3) 체험
await page.goto(base + '#/demo');
// 1단계: 쓰던 AI 창(흉내) 열기 → 답 아래 [복사] → [답 넣기]
await page.locator('.demo .chat-bots .chat-bot').first().click({ timeout: 20000 });
await page.locator('.demo-ai-copy').click({ timeout: 10000 });
await page.locator('.demo .make-bar .btn-primary').click();
const demoFrame = page.locator('iframe[sandbox*="allow-modals"]').first();
await demoFrame.waitFor({ timeout: 40000 });
await page.waitForTimeout(2500);
const dst = await fxIn(await demoFrame.elementHandle());
const dd = await frames(demoFrame, 'demo-preview');
put('체험 · 미리보기', !!dst && !dst.noFx && (dst.level >= 1) && dd.length > 0, `[${dd.join(' ')}] ${JSON.stringify(dst)}`);

if (errs.length) console.log('페이지 오류:', errs.slice(0, 5));
await browser.close(); preview?.kill();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length}곳 중 멈춤 ${bad.length}곳`);
process.exitCode = bad.length ? 1 : 0;
