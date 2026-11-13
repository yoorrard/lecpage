#!/usr/bin/env node
// 움직임 점검: 효과·첫 화면 그림·본문 등장이 '실제로' 움직이는지 시간과 스크롤에 따라 재요(Playwright).
//   첫 화면: 가만히 둔 채 0.3~6초 사이 몇 장을 찍어 바뀐 화소 비율을 잼 → 계속 움직임(loop) · 들어오고 멈춤(enter) · 정지(still)
//            그림이 끝없이 도는 효과(loop)인데 정지면 'hero-still', 효과가 실렸는데 건너뜀·실패면 'fx-skipped'·'fx-failed'
//   본문: 한 화면씩 내려가며 등장 효과(data-fx-pre → data-fx-in)가 걸리는지, 다 내려간 뒤 숨은 채 남은 것('stuck-hidden'),
//         스크롤 연동 효과가 스크롤에 따라 값이 바뀌는지('scroll-dead'), 화면 밖으로 나간 꾸밈('offscreen-art')
//   동작 줄이기: 첫 화면 그림이 비거나(빈 캔버스·숨은 정지 그림) 내용이 숨은 채 남지 않는지('rm-incomplete')
// 쓰는 곳: 손으로(모든 프리셋을 훑음) · scripts/lecpage.mjs qa에서 만든 사이트 하나(--dir)
//   node scripts/motion-check.mjs [--presets a,b] [--ex sel-story,data-lab,body-all] [--widths 1440,390] [--themes light,dark]
//        [--motion d,1,2,3] [--rm] [--device auto|fast|slow] [--dir 만든 사이트 폴더] [--shots 폴더] [--out 결과.json] [--conc 4] [--root 견줄 엔진 폴더]
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes('--' + k);

async function loadChromium() {
  try { return (await import('playwright')).chromium; } catch { /* 다음 */ }
  for (const from of [import.meta.url, '/opt/node-tools/']) { try { return createRequire(from)('playwright').chromium; } catch { /* 다음 */ } }
  return null;
}

/** 브라우저 안: 두 PNG(base64)의 바뀐 화소 비율(가로 200칸으로 줄여 비교, 채널 차 24 넘으면 바뀐 것) */
async function diffInPage([a, b]) {
  const load = async (s) => createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob());
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  const W = 200, H = Math.max(1, Math.round((ia.height / ia.width) * W));
  const px = (img) => { const c = new OffscreenCanvas(W, H), g = c.getContext('2d'); g.drawImage(img, 0, 0, W, H); return g.getImageData(0, 0, W, H).data; };
  const pa = px(ia), pb = px(ib); let n = 0;
  for (let i = 0; i < pa.length; i += 4) if (Math.abs(pa[i] - pb[i]) > 24 || Math.abs(pa[i + 1] - pb[i + 1]) > 24 || Math.abs(pa[i + 2] - pb[i + 2]) > 24) n++;
  return n / (W * H);
}

/** 브라우저 안: 효과 인스턴스 상태(단계가 모자라 건너뛴 것은 그 자리의 단계와 함께) */
function fxState() {
  const out = [];
  for (const el of document.querySelectorAll('[data-fx]')) {
    const ids = (el.getAttribute('data-fx') || '').split(/\s+/).filter(Boolean);
    const sec = el.closest('.lp-sec,section,header,footer');
    for (const id of ids) {
      const m = el.__lecfx && el.__lecfx[id];
      const st = !m ? (window.LecFX && window.LecFX.has(id) ? 'idle' : 'unloaded') : m.skipped ? 'skipped' : m.dead ? (el.getAttribute('data-fx-error') === id ? 'failed' : 'stopped') : 'on';
      const r = el.getBoundingClientRect();
      out.push({ id, st, lv: window.LecFX ? window.LecFX.level(el) : null, sec: sec ? (sec.id || String(sec.className).split(' ')[0]) : '', hero: !!el.closest('.lp-hero'), top: Math.round(r.top + scrollY) });
    }
  }
  return out;
}

/** 브라우저 안: 화면에 보이는 스크롤 연동 움직임(CSS 스크롤 타임라인)의 지금 값 */
function scrollSample() {
  const pick = [];
  for (const a of document.getAnimations()) {
    const tl = a.timeline; if (!tl || tl === document.timeline) continue;
    const t = a.effect && a.effect.target; if (!t || !t.isConnected) continue;
    const r = t.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight || !r.width) continue;
    pick.push({ k: 'css:' + (a.animationName || '') + ':' + (t.id || t.className || t.tagName).toString().slice(0, 40), v: String(a.effect.getComputedTiming().progress) });
  }
  return pick;
}

/** 브라우저 안: 지금 화면 가운데 띠(15~85%)에 온전히 들어온 내용 가운데 흐리거나 숨은 채인 것 · 화면 밖으로 나간 꾸밈 층 */
function viewCheck() {
  const out = { dim: [], offArt: [] };
  const vh = innerHeight, vw = document.documentElement.clientWidth;
  const shown = (el) => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden') return false; } return true; };
  for (const el of document.querySelectorAll('main :is(h1,h2,h3,p,li,dt,dd,figcaption,td,th,blockquote)')) {
    if (el.closest('[aria-hidden="true"],.lp-sr,.fx-sr,[hidden],details:not([open]),dialog,[data-phase-show],[data-phase-hide],[data-live-off],.lp-band,.fx-marquee')) continue;
    if (!el.textContent.trim() || !shown(el)) continue;
    const r = el.getBoundingClientRect(); if (!r.width || r.top < vh * 0.15 || r.bottom > vh * 0.85 || r.right < 0 || r.left > vw) continue;
    let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= +getComputedStyle(n).opacity;
    if (o < 0.6) out.dim.push(`${el.closest('section')?.id || ''} ${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 14)}" o=${o.toFixed(2)}`);
  }
  for (const el of document.querySelectorAll('.fx-layer,.lp-hero-graphic')) {
    const r = el.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > vh) continue;
    if (r.left > vw + 2 || r.right < -2) out.offArt.push(String(el.className).slice(0, 40));
  }
  return out;
}

/** 브라우저 안: 다 내려간 뒤에도 대기 상태(data-fx-pre)로 남은 것 */
function preLeft() {
  const shown = (el) => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden') return false; } return true; };
  return [...document.querySelectorAll('[data-fx-pre]')].filter((el) => shown(el) && !el.closest('[hidden],details:not([open]),dialog:not([open])')).map((el) => (el.closest('section')?.id || '') + ' ' + el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0]);
}

/** 브라우저 안: 첫 화면 그림이 비었는지(동작 줄이기·정지 모습) */
function heroComplete() {
  const hero = document.querySelector('main > .lp-hero'); if (!hero) return { ok: true, bad: [] };
  const bad = [];
  for (const c of hero.querySelectorAll('canvas')) {
    const r = c.getBoundingClientRect(); if (r.width < 20 || r.height < 20 || getComputedStyle(c).visibility === 'hidden' || +getComputedStyle(c).opacity < 0.05) continue;
    try { const g = c.getContext('2d'); if (g) { const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i]) n++; if (!n) bad.push('빈 캔버스 ' + (c.parentElement?.className || '')); } } catch { /* webgl */ }
  }
  for (const s of hero.querySelectorAll('svg')) {
    const r = s.getBoundingClientRect(); if (r.width < 40) continue;
    let o = 1; for (let n = s; n && n !== hero.parentElement; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') { o = 0; break; } o *= +cs.opacity; }
    const cv = s.parentElement && s.parentElement.querySelector(':scope > canvas');
    if (o < 0.3 && !(cv && +getComputedStyle(cv).opacity > 0.5)) bad.push('숨은 정지 그림 ' + (s.parentElement?.className || ''));
  }
  for (const el of hero.querySelectorAll('h1,.lp-hero-sub,.lp-ctas a')) { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= +getComputedStyle(n).opacity; if (o < 0.9) bad.push('숨은 글 ' + el.tagName); }
  return { ok: !bad.length, bad };
}

export const LOOP_FX = new Set(['arc-ripple', 'aurora', 'blobs-morph', 'bokeh', 'border-beam', 'dot-grid', 'gradient-text', 'marquee', 'mesh-gradient', 'noise-orb', 'orbit-3d', 'particles-network', 'perspective-grid', 'shader-gradient', 'starfield', 'stream-lines', 'three-hero', 'topo-lines', 'waves', 'word-rotate']);

/**
 * 한 페이지 점검. page는 막 연 상태(goto 직후, waitUntil 'domcontentloaded' 권장)
 * @returns {{hero:{kind,diffs,loops,state}, fx, scroll:{seen,moved}, findings:[{rule,sample}]}}
 */
export async function checkPage(page, { shots = '', tag = 'page', rm = false, frames = [120, 450, 900, 1600, 2600, 4000, 5600], step = 0.8, settle = 650 } = {}) {
  const res = { tag, hero: null, fx: [], findings: [] };
  const add = (rule, sample) => res.findings.push({ rule, sample: String(sample).slice(0, 140) });
  const helper = await page.context().newPage();
  await helper.goto('about:blank');
  // 첫 화면: 가만히 둔 채 몇 장
  const vh = page.viewportSize().height, vw = page.viewportSize().width;
  const clip = { x: 0, y: 0, width: vw, height: vh };
  // 화면 찍기는 CDP로(page.screenshot은 웹 글꼴을 기다려 첫 장이 1초 넘게 늦어져 등장 움직임을 놓침)
  const cdp = await page.context().newCDPSession(page);
  const snap = async () => Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } })).data, 'base64');
  // 웹 글꼴(최대 1.2초)까지 기다린 뒤부터 잼: 효과도 첫 화면 등장을 글꼴이 올 때까지(최대 1초) 미룸(core.js enter)
  await page.evaluate(() => Promise.race([document.fonts ? document.fonts.ready : null, new Promise((r) => setTimeout(r, 1200))])).catch(() => {});
  const imgs = []; const t0 = Date.now();
  for (const at of frames) { const wait = at - (Date.now() - t0); if (wait > 0) await page.waitForTimeout(wait); const b = await snap(); imgs.push(b); if (shots) { mkdirSync(shots, { recursive: true }); writeFileSync(join(shots, `${tag}-t${String(at).padStart(4, '0')}.png`), b); } }
  await cdp.detach().catch(() => {});
  const diffs = [];
  for (let i = 1; i < imgs.length; i++) diffs.push(+(await helper.evaluate(diffInPage, [imgs[i - 1].toString('base64'), imgs[i].toString('base64')])).toFixed(4));
  await helper.close();
  const late = diffs.slice(-2), early = diffs.slice(0, 3);
  const kind = late.every((d) => d > 0.0015) ? 'loop' : early.some((d) => d > 0.0015) ? 'enter' : diffs.some((d) => d > 0.0015) ? 'late' : 'still';
  res.fx = await page.evaluate(fxState);
  const heroLoops = res.fx.filter((f) => f.hero && LOOP_FX.has(f.id));
  const state = await page.evaluate(() => (window.LecFX ? window.LecFX.state() : null));
  res.hero = { kind, diffs, loops: heroLoops.map((f) => `${f.id}:${f.st}`), state, motion: await page.evaluate(() => document.documentElement.getAttribute('data-motion')) };
  if (!rm && heroLoops.some((f) => f.st === 'on') && kind !== 'loop') add('hero-still', `${heroLoops.map((f) => f.id).join(',')} 켜졌는데 ${kind}(${diffs.join(' ')})`);
  if (!rm && +res.hero.motion >= 1 && kind === 'still') add('hero-no-motion', `움직임 ${res.hero.motion}단계인데 첫 화면이 처음부터 그대로`);
  for (const f of res.fx) {
    if (f.st === 'failed') add('fx-failed', `${f.id} @${f.sec}`);
    if (f.st === 'skipped' && !rm && f.lv >= 2) add('fx-skipped', `${f.id} @${f.sec}${f.hero ? '(첫 화면)' : ''} 그 자리 단계 ${f.lv}`);
    if (f.st === 'unloaded') add('fx-unloaded', `${f.id} @${f.sec}`);
  }
  if (rm) { const hc = await page.evaluate(heroComplete); for (const b of hc.bad) add('rm-incomplete', b); }
  // 본문: 한 화면씩 내려가며 등장·스크롤 연동
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  let lastSample = null, scrollMoves = 0, scrollSeen = 0; const dims = new Set(), offs = new Set();
  for (let y = 0; y < H; y += Math.round(vh * step)) {
    await page.evaluate((yy) => scrollTo(0, yy), y);
    await page.waitForTimeout(120);
    const s = await page.evaluate(scrollSample);
    if (lastSample) { const m = new Map(lastSample.map((x) => [x.k, x.v])); for (const x of s) if (m.has(x.k)) { scrollSeen++; if (m.get(x.k) !== x.v) scrollMoves++; } }
    lastSample = s;
    await page.waitForTimeout(settle);
    const v = await page.evaluate(viewCheck);
    for (const d of v.dim) dims.add(d); for (const o of v.offArt) offs.add(o);
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(700);
  const v0 = await page.evaluate(viewCheck); for (const d of v0.dim) dims.add(d);
  res.scroll = { seen: scrollSeen, moved: scrollMoves };
  if (scrollSeen > 3 && !scrollMoves) add('scroll-dead', `스크롤 타임라인 ${scrollSeen}번 봤는데 값이 그대로`);
  for (const p of new Set(await page.evaluate(preLeft))) add('stuck-pre', p);
  for (const p of dims) add('dim-in-view', p);
  for (const p of offs) add('offscreen-art', p);
  return res;
}

// ── 단독 실행: 프리셋 × 예시를 빌드해 훑음 ──
async function main() {
  const chromium = await loadChromium();
  if (!chromium) { console.error('Playwright가 없어 건너뜁니다.'); return; }
  const ER = resolve(arg('root', ROOT)); // 다른 판의 엔진으로 견줄 때(고치기 전 판을 풀어 둔 폴더)
  const E = await import(pathToFileURL(join(ER, 'engine/src/index.js')).href);
  const { nodeRuntime } = await import(pathToFileURL(join(ER, 'engine/node.js')).href);
  const presets = (arg('presets', '') || E.PRESET_IDS.join(',')).split(',');
  const exs = arg('ex', 'sel-story').split(',');
  const widths = arg('widths', '1440,390').split(',').map(Number);
  const themes = arg('themes', 'light').split(',');
  const motions = arg('motion', 'd').split(',');
  const device = arg('device', 'auto'); // auto: 이 기계 그대로 · fast: 코어 8·메모리 8 · slow: 코어 2·메모리 2
  const rm = has('rm'), conc = +arg('conc', 4), shots = arg('shots', ''), out = arg('out', '');
  const tmp = mkdtempSync(join(tmpdir(), 'lpmotion-')), jobs = [];
  const SRC = { 'sel-story': join(ROOT, 'examples/sel-story.blueprint.json'), 'data-lab': join(ROOT, 'examples/data-lab.blueprint.json'), 'body-all': join(ROOT, 'engine/test/fixtures/body-all.blueprint.json') };
  const exOf = (ex) => SRC[ex] || ex;
  const dir = arg('dir', '');
  if (dir) { jobs.push({ key: '', root: resolve(dir), preset: 'site', ex: '', motion: '', theme: themes[0] }); }
  else for (const id of presets) for (const ex of exs) for (const theme of themes) for (const mo of motions) {
    const bp = JSON.parse(readFileSync(exOf(ex), 'utf8'));
    bp.design = { preset: id, theme, ...(mo === 'd' ? {} : { motion: +mo }) };
    if (mo !== 'd') bp.audience = { ...(bp.audience || {}), devices: ['laptop'] };
    const r = E.build(bp, { runtime: nodeRuntime() });
    if (r.errors?.length) { console.log('빌드 오류', id, ex); continue; }
    const key = `${id}__${ex}__${theme}__m${mo}`;
    for (const [f, c] of Object.entries(r.files)) { const p = join(tmp, key, f); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, c); }
    jobs.push({ key, root: tmp, preset: id, ex, motion: mo === 'd' ? `d${r.design.motion}` : mo, theme, graphic: r.design.graphic });
  }
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.woff2': 'font/woff2' };
  const srv = createServer(async (q, r) => { try { const base = dir ? resolve(dir) : tmp; const p = join(base, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(p); r.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${srv.address().port}/`;
  // 글꼴 CDN은 프록시가 있으면 그 길로(없으면 글꼴을 기다리느라 첫 장이 늦게 찍혀 등장 움직임을 놓침)
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
  const browser = await chromium.launch({ proxy });
  const runs = []; for (const j of jobs) for (const w of widths) runs.push({ ...j, w });
  const results = [], queue = runs.slice(), t0 = Date.now();
  console.log(`움직임 점검 ${runs.length}곳(기기 ${device}${rm ? ', 동작 줄이기' : ''})`);
  await Promise.all(Array.from({ length: conc }, async () => {
    for (let j; (j = queue.shift());) {
      const ctx = await browser.newContext({ viewport: { width: j.w, height: j.w < 700 ? 780 : 900 }, deviceScaleFactor: 1, colorScheme: j.theme, reducedMotion: rm ? 'reduce' : 'no-preference', hasTouch: j.w < 700, isMobile: false, ignoreHTTPSErrors: !!proxy });
      if (device !== 'auto') { const [c, m] = device === 'fast' ? [8, 8] : [2, 2]; await ctx.addInitScript(([c, m]) => { Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => c }); Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => m }); }, [c, m]); }
      const page = await ctx.newPage(), errs = [];
      page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 100)));
      page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 100)); });
      const tag = `${j.preset}${j.ex ? '-' + j.ex : ''}-${j.theme[0]}-m${j.motion}-${j.w}${rm ? '-rm' : ''}`;
      try {
        await page.goto(base + (j.key ? j.key + '/' : '') + 'index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
        const r = await checkPage(page, { shots: shots ? resolve(shots) : '', tag, rm });
        for (const e of errs) r.findings.push({ rule: 'console', sample: e });
        results.push({ ...j, tag, ...r });
      } catch (e) { results.push({ ...j, tag, findings: [{ rule: 'check-failed', sample: String(e.message).slice(0, 100) }] }); }
      await ctx.close();
      process.stdout.write('.');
    }
  }));
  await browser.close(); srv.close(); rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${Math.round((Date.now() - t0) / 1000)}초`);
  for (const r of results) console.log(`${r.tag.padEnd(48)} 첫화면 ${String(r.hero?.kind).padEnd(5)} [${(r.hero?.diffs || []).map((d) => d.toFixed(3)).join(' ')}] ${r.hero?.loops?.join(' ') || ''} 단계${r.hero?.state?.level ?? '-'}${r.hero?.state?.lowPower ? '(저사양)' : ''} 스크롤 ${r.scroll?.moved ?? '-'}/${r.scroll?.seen ?? '-'}${r.findings.length ? '\n    ' + r.findings.map((f) => `${f.rule}: ${f.sample}`).join('\n    ') : ''}`);
  if (out) writeFileSync(out, JSON.stringify(results, null, 1));
  const bad = results.filter((r) => r.findings.length);
  console.log(`문제 있는 곳 ${bad.length}/${results.length}`);
  process.exitCode = bad.length ? 1 : 0;
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
