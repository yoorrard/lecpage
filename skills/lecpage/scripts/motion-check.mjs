#!/usr/bin/env node
// 움직임 점검: 효과·첫 화면 그림·본문 등장이 '실제로' 움직이는지 시간과 스크롤에 따라 재요(Playwright).
//   첫 화면: 시각·화소가 아니라 '사건'으로 판정(부하로 측정이 늦어져도 같은 결과). 쪽을 열기 전부터 첫 화면 안의 CSS 애니메이션·전환 시작(animationstart·transitionrun),
//            el.animate(), 캔버스 그리기, 글·스타일 바뀜을 기록하고, 등장이 끝날 때까지(효과 준비·글꼴·진행 중인 등장) 기다린 뒤 1.6초 동안 계속 바뀌는지 봄
//            → 계속 움직임(loop) · 들어오고 멈춤(enter) · 정지(still). 판정은 judgeHero(브라우저 없이 시험)
//            끝없이 도는 그림이 켜졌는데 계속 바뀌는 기록이 없으면 'hero-still', 움직임 단계인데 첫 화면에 움직임 사건이 하나도 없으면 'hero-no-motion', 효과가 단계 2 이상 자리에서 건너뛰거나 실패하면 'fx-skipped'·'fx-failed'
//   본문: 한 화면씩 내려가며 화면 가운데 띠에 온전히 들어온 글이 흐리거나 숨은 채인지('dim-in-view'), 다 내려간 뒤 대기 상태로 남은 것('stuck-pre'),
//         CSS 스크롤 타임라인이 스크롤에 따라 값이 바뀌는지('scroll-dead'), 화면 밖으로 나간 꾸밈 층('offscreen-art')
//   동작 줄이기(--rm): 첫 화면 그림이 비거나(빈 캔버스·숨은 정지 그림) 제목·단추가 숨은 채인지('rm-incomplete')
//   효과 하나씩(--effects): 효과 견본 장면을 띄워 도는 효과는 계속, 나머지는 한 번이라도 움직이는지
// 쓰는 곳: 손으로(모든 프리셋을 훑음) · scripts/lecpage.mjs qa(PC 화면에서 lintPage, 막지 않는 '움직임' 검사) · 만든 사이트 하나(--dir)
//   node scripts/motion-check.mjs --effects [--fx a,b] [--rm]   효과 견본 하나씩(58가지)
//   node scripts/motion-check.mjs [--presets a,b] [--ex sel-story,data-lab,body-all] [--widths 1440,390] [--themes light,dark]
//        [--motion d,1,2,3] [--rm] [--device auto|fast|slow] [--layouts 0,1,2,3,4,5] [--dir 만든 사이트 폴더] [--shots 폴더] [--out 결과.json] [--conc 4] [--root 견줄 엔진 폴더]
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
      const st = !m ? (window.LecFX && window.LecFX.has(id) ? 'idle' : 'unloaded') : m.skipped ? 'skipped' : m.shown ? 'shown' : m.dead ? (el.getAttribute('data-fx-error') === id ? 'failed' : 'stopped') : 'on';
      const r = el.getBoundingClientRect();
      out.push({ id, st, lv: window.LecFX ? window.LecFX.level(el) : null, sec: sec ? (sec.id || String(sec.className).split(' ')[0]) : '', hero: !!el.closest('.lp-hero'), top: Math.round(r.top + scrollY), inView: r.bottom > 0 && r.top < innerHeight && r.width > 0 });
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
    if (document.documentElement.getAttribute('data-motion') === '3' && el.closest('main > .lp-hero')) continue; // 스크롤 연출 단계: 첫 화면이 내려가며 옅어지는 것은 의도(lp-hero-park)
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

/** 브라우저 안: 본문에서 끝이 있는 움직임(등장)이 다 끝났는지 */
function mainSettled() {
  return !document.getAnimations().some((a) => { const t = a.effect && a.effect.target; if (!t || !t.closest || !t.closest('main')) return false; const tm = a.effect.getComputedTiming(); return tm.iterations !== Infinity && a.timeline === document.timeline && (a.playState === 'running' || a.pending); });
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

/** CSS 애니메이션(타임라인이 시간인 것)의 대상 값이 0.7초 사이 바뀌는지: 부드러운 빛 번짐처럼 화소 차이로는 잘 안 잡히는 흐름용 */
export async function cssMoving(page, within = '') {
  const read = () => page.evaluate((sel) => document.getAnimations().filter((a) => a.playState === 'running' && a.timeline === document.timeline && a.effect && a.effect.target && (!sel || a.effect.target.closest(sel))).map((a) => { const c = getComputedStyle(a.effect.target); return c.transform + c.opacity + c.backgroundPosition; }), within);
  const a = await read(); await page.waitForTimeout(700); const b = await read();
  return a.filter((x, i) => b[i] !== undefined && b[i] !== x).length;
}

export const LOOP_FX = new Set(['arc-ripple', 'aurora', 'blobs-morph', 'bokeh', 'border-beam', 'dot-grid', 'gradient-text', 'marquee', 'mesh-gradient', 'noise-orb', 'orbit-3d', 'particles-network', 'perspective-grid', 'shader-gradient', 'starfield', 'stream-lines', 'three-hero', 'topo-lines', 'waves', 'word-rotate']);

/**
 * 브라우저 안(쪽을 열기 전에 심음): 첫 화면(.lp-hero) 안의 움직임 사건 기록 → window.__lpMotion
 *  ev: [종류, 시각, 이름, 길이ms] (animationstart·transitionrun·animationiteration, el.animate) · draws: 캔버스 그린 시각 · muts: 글·스타일 바뀐 시각 · fxReadyAt: 효과 준비(html.fx-ready)
 */
export function motionRecorder() {
  if (window.__lpMotion) return;
  const R = window.__lpMotion = { ev: [], draws: [], muts: [], fxReadyAt: 0 };
  const now = () => Math.round(performance.now());
  const inHero = (n) => { try { const el = n && n.nodeType === 1 ? n : n && n.parentElement; return !!(el && el.closest && el.closest('.lp-hero')); } catch (e) { return false; } };
  const push = (list, v) => { list.push(v); if (list.length > 4000) list.splice(0, 1000); };
  const dur = (t, name, prop) => { try { const a = t.getAnimations().find((x) => (name && x.animationName === name) || (prop && x.transitionProperty === prop)); const d = a && a.effect && a.effect.getComputedTiming().duration; return typeof d === 'number' ? Math.round(d) : 0; } catch (e) { return 0; } };
  const onEv = (e) => { if (inHero(e.target)) push(R.ev, [e.type, now(), e.animationName || e.propertyName || '', dur(e.target, e.animationName, e.propertyName)]); };
  for (const k of ['animationstart', 'animationiteration', 'transitionrun']) document.addEventListener(k, onEv, true);
  const animate = Element.prototype.animate;
  if (animate) Element.prototype.animate = function () { const a = animate.apply(this, arguments); if (inHero(this)) { let d = 0; try { d = Math.round(a.effect.getComputedTiming().duration) || 0; } catch (e) { /* 없음 */ } push(R.ev, ['animate', now(), '', d]); } return a; };
  const tag = (proto, names) => { if (!proto) return; for (const n of names) { const f = proto[n]; if (typeof f !== 'function') continue; proto[n] = function () { if (this.canvas && inHero(this.canvas)) { const t = now(); if (R.draws[R.draws.length - 1] !== t) push(R.draws, t); } return f.apply(this, arguments); }; } };
  tag(window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype, ['clearRect', 'fillRect', 'fill', 'stroke', 'drawImage', 'putImageData', 'fillText']);
  tag(window.WebGLRenderingContext && WebGLRenderingContext.prototype, ['drawArrays', 'drawElements']);
  tag(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype, ['drawArrays', 'drawElements']);
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.target === document.documentElement) { if (!R.fxReadyAt && document.documentElement.classList.contains('fx-ready')) R.fxReadyAt = now(); continue; }
      if (inHero(m.target)) { push(R.muts, now()); break; }
    }
  }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class', 'd', 'transform', 'points', 'data-fx-pre'] });
}

/** 등장이 다 끝났는지(브라우저 안): 쪽 다 읽음 · 효과 준비 · 글꼴(효과는 최대 1초 기다림) · 첫 화면의 끝이 있는 움직임이 다 끝남 · 보이는 대기 상태 없음 */
function heroSettled() {
  const R = window.__lpMotion; if (!R || document.readyState !== 'complete') return false;
  const hero = document.querySelector('main > .lp-hero') || document.querySelector('.lp-hero');
  if (document.querySelector('[data-fx]') && window.LecFX && !R.fxReadyAt) return false;
  if (R.fxReadyAt && document.fonts && document.fonts.status !== 'loaded' && performance.now() - R.fxReadyAt < 1300) return false;
  if (!hero) return true;
  const busy = document.getAnimations().some((a) => { const t = a.effect && a.effect.target; if (!t || !hero.contains(t)) return false; const it = a.effect.getComputedTiming().iterations; return it !== Infinity && (a.playState === 'running' || a.pending); });
  if (busy) return false;
  return ![...hero.querySelectorAll('[data-fx-pre]')].some((el) => { const r = el.getBoundingClientRect(); return r.width && r.bottom > 0 && r.top < innerHeight; });
}

/** 첫 화면 안에서 끝없이 도는 CSS·WAAPI 애니메이션 수(브라우저 안) */
function heroInfinite() {
  const hero = document.querySelector('main > .lp-hero') || document.querySelector('.lp-hero'); if (!hero) return 0;
  return document.getAnimations().filter((a) => { const t = a.effect && a.effect.target; return t && hero.contains(t) && a.playState === 'running' && a.effect.getComputedTiming().iterations === Infinity; }).length;
}

/** 보이는 움직임으로 칠 길이(ms): 동작 줄이기용 0.01ms 같은 '없는 셈' 애니메이션은 빼고 */
export const MIN_MOTION_MS = 80;
/**
 * 첫 화면 판정(브라우저 없이 시험): 기록 → { kind, findings }
 * @param {{ ev:Array, late:{draws:number, muts:number, infinite:number, css:number}, fx:Array, motion:string|number, rm:boolean }} o
 *   ev: 등장까지의 사건 [종류, 시각, 이름, 길이ms] · late: 등장이 끝난 뒤 1.6초 사이 바뀐 수 · fx: fxState()
 */
export function judgeHero({ ev = [], late = {}, fx = [], motion = 0, rm = false } = {}) {
  const findings = [];
  const add = (rule, sample) => findings.push({ rule, sample: String(sample).slice(0, 140) });
  const heroLoops = fx.filter((f) => f.hero && f.inView && LOOP_FX.has(f.id)); // 화면 밖(좁은 화면에서 첫 화면 아래로 밀린 띠 등)은 쉬는 것이 맞음
  const moving = (late.draws || 0) >= 3 || (late.muts || 0) >= 2 || (late.infinite || 0) > 0 || (late.css || 0) > 0;
  const entered = ev.filter((e) => e[0] === 'animationiteration' || (e[3] || 0) >= MIN_MOTION_MS);
  const kind = moving ? 'loop' : entered.length ? 'enter' : 'still';
  const summary = `사건 ${entered.length}·뒤 1.6초 그리기 ${late.draws || 0}·바뀜 ${late.muts || 0}·도는 CSS ${late.infinite || 0}`;
  if (!rm && heroLoops.some((f) => f.st === 'on') && kind !== 'loop') add('hero-still', `${heroLoops.map((f) => f.id).join(',')} 켜졌는데 등장 뒤 계속 바뀌는 기록이 없음(${kind})`);
  // 첫 화면 제목은 효과 스크립트보다 먼저 그려지면 그대로 둠(core shownTitle, 휴대폰 LCP): 그때 첫 화면이 그대로인 것은 문제가 아님
  if (!rm && +motion >= 1 && kind === 'still' && !fx.some((f) => f.hero && f.st === 'shown')) add('hero-no-motion', `움직임 ${motion}단계인데 첫 화면에 움직임 사건(애니메이션·전환·그리기)이 하나도 없음`);
  return { kind, findings, loops: heroLoops.map((f) => `${f.id}:${f.st}`), summary };
}

/**
 * 한 페이지 점검. page는 막 연 상태(goto 직후, waitUntil 'domcontentloaded' 권장). 사건 기록기(motionRecorder)가 없으면 심고 다시 엶
 * @returns {{hero:{kind,summary,loops,state}, fx, scroll:{seen,moved}, findings:[{rule,sample}]}}
 */
export async function checkPage(page, { shots = '', tag = 'page', rm = false, step = 0.8, settle = 650 } = {}) {
  const res = { tag, hero: null, fx: [], findings: [] };
  const add = (rule, sample) => res.findings.push({ rule, sample: String(sample).slice(0, 140) });
  if (!(await page.evaluate(() => !!window.__lpMotion).catch(() => false))) { await page.addInitScript(motionRecorder); await page.reload({ waitUntil: 'domcontentloaded' }); }
  // 등장이 끝날 때까지(시각이 아니라 상태로). 부하가 커도 늦어질 뿐 판정은 같음
  await page.waitForFunction(heroSettled, null, { timeout: 20000, polling: 150 }).catch(() => {});
  const vh = page.viewportSize().height, vw = page.viewportSize().width;
  if (shots) { mkdirSync(shots, { recursive: true }); await page.screenshot({ path: join(shots, `${tag}-hero.png`), clip: { x: 0, y: 0, width: vw, height: vh } }).catch(() => {}); }
  // 등장 뒤 1.6초: 계속 바뀌는지(도는 그림)
  const count = () => page.evaluate(() => ({ draws: window.__lpMotion.draws.length, muts: window.__lpMotion.muts.length, lastD: window.__lpMotion.draws.at(-1) || 0, lastM: window.__lpMotion.muts.at(-1) || 0 }));
  const c0 = await count(); await page.waitForTimeout(1600); const c1 = await count();
  const rec = await page.evaluate(() => window.__lpMotion.ev);
  const late = { draws: Math.max(0, c1.draws - c0.draws) || (c1.lastD > c0.lastD ? 1 : 0), muts: Math.max(0, c1.muts - c0.muts) || (c1.lastM > c0.lastM ? 1 : 0), infinite: await page.evaluate(heroInfinite), css: 0 };
  res.fx = await page.evaluate(fxState);
  const motion = await page.evaluate(() => document.documentElement.getAttribute('data-motion'));
  if (!rm && !late.infinite && late.draws < 3 && late.muts < 2 && res.fx.some((f) => f.hero && f.inView && f.st === 'on' && LOOP_FX.has(f.id))) late.css = await cssMoving(page, '.lp-hero'); // 화소로도 사건으로도 안 잡히는 부드러운 흐름(배경 위치 등)
  const j = judgeHero({ ev: rec, late, fx: res.fx, motion, rm });
  const state = await page.evaluate(() => (window.LecFX ? window.LecFX.state() : null));
  res.hero = { kind: j.kind, summary: j.summary, loops: j.loops, state, motion, events: rec.length };
  res.findings.push(...j.findings);
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
    let v = await page.evaluate(viewCheck);
    if (v.dim.length) { await page.waitForFunction(mainSettled, null, { timeout: 6000, polling: 150 }).catch(() => {}); v = await page.evaluate(viewCheck); } // 차례로 들어오는 중이면 그 움직임이 끝날 때까지
    for (const d of v.dim) dims.add(d); for (const o of v.offArt) offs.add(o);
  }
  // 맨 끝까지(글꼴·그림으로 쪽이 길어졌을 수 있음): 마지막 칸이 들어왔는지
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(400); await page.waitForFunction(mainSettled, null, { timeout: 6000, polling: 150 }).catch(() => {});
  const pre = await page.evaluate(preLeft);
  const vb = await page.evaluate(viewCheck); for (const d of vb.dim) dims.add(d);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(700);
  const v0 = await page.evaluate(viewCheck); for (const d of v0.dim) dims.add(d);
  res.scroll = { seen: scrollSeen, moved: scrollMoves };
  if (scrollSeen > 3 && !scrollMoves) add('scroll-dead', `스크롤 타임라인 ${scrollSeen}번 봤는데 값이 그대로`);
  for (const p of new Set(pre)) add('stuck-pre', p);
  for (const p of dims) add('dim-in-view', p);
  for (const p of offs) add('offscreen-art', p);
  return res;
}

export const RULES = {
  'hero-still': '첫 화면 그림이 도는 효과인데 멈춰 있어요.',
  'hero-no-motion': '움직임 단계인데 첫 화면이 처음부터 그대로예요.',
  'fx-failed': '효과가 실패해 건너뛰었어요.',
  'fx-skipped': '효과가 그 자리 단계보다 높아 건너뛰었어요.',
  'fx-unloaded': '효과 파일이 실리지 않았어요.',
  'stuck-pre': '끝까지 내려가도 등장 전 모습(숨김)으로 남았어요.',
  'dim-in-view': '화면 가운데 들어온 글이 흐리거나 숨은 채예요.',
  'scroll-dead': '스크롤 연동 움직임이 스크롤해도 그대로예요.',
  'offscreen-art': '꾸밈 층이 화면 밖으로 나갔어요.',
  'rm-incomplete': '동작 줄이기에서 첫 화면 그림·글이 비어 보여요.',
};
/** scripts/lecpage.mjs qa가 부르는 검사(PC 화면에서 한 번): 페이지를 다시 열어 처음부터 잼. 실패·숨은 채 남음은 고칠 곳, 나머지는 살필 곳 */
export async function lintPage(page, { view } = {}) {
  if (view && view !== 'desktop') return [];
  await page.addInitScript(motionRecorder);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const r = await checkPage(page, { tag: view || 'page', step: 1, settle: 450 });
  return r.findings.map((f) => ({ level: f.rule === 'fx-failed' || f.rule === 'stuck-pre' ? 'error' : 'warn', rule: f.rule, message: `${RULES[f.rule] || f.rule} ${f.sample}` }));
}

// ── 단독 실행: 프리셋 × 예시를 빌드해 훑음 ──
/**
 * 효과 하나씩(--effects): 효과 견본(runtime/fx/demo.html?fx=<id>&embed=1, 앱 갤러리의 작은 미리보기와 같은 장면)을 띄워
 * 시간에 따라 바뀌는지 잼. 견본은 스크롤·포인터를 흉내 내므로 손대지 않아도 움직여야 함. 동작 줄이기면 완성된 모습 그대로여야 함
 */
async function effects(chromium, { rm, shots, ids, root = ROOT }) {
  const FXDIR = join(root, 'engine/runtime/fx');
  const { FX } = await import(pathToFileURL(join(root, 'engine/src/design/fx-catalog.js')).href);
  const list = FX.filter((f) => !ids || ids.includes(f.id));
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
  const srv = createServer(async (q, r) => { try { const p = join(FXDIR, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(p); r.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const browser = await chromium.launch();
  const out = [];
  for (const f of list) {
    const ctx = await browser.newContext({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 1, reducedMotion: rm ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage(), helper = await ctx.newPage(); await helper.goto('about:blank');
    const errs = []; page.on('pageerror', (e) => errs.push(e.message.slice(0, 90)));
    await page.goto(`http://127.0.0.1:${srv.address().port}/demo.html?fx=${f.id}&embed=1&theme=light`, { waitUntil: 'domcontentloaded' });
    const cdp = await ctx.newCDPSession(page);
    const imgs = []; const t0 = Date.now();
    for (const at of [300, 900, 1700, 2700, 4000, 5500]) { const wt = at - (Date.now() - t0); if (wt > 0) await page.waitForTimeout(wt); const b = Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'); imgs.push(b); if (shots) { mkdirSync(shots, { recursive: true }); writeFileSync(join(shots, `fx-${f.id}${rm ? '-rm' : ''}-t${String(at).padStart(4, '0')}.png`), b); } }
    const d = []; for (let i = 1; i < imgs.length; i++) d.push(+(await helper.evaluate(diffInPage, [imgs[i - 1].toString('base64'), imgs[i].toString('base64')])).toFixed(4));
    const st = await page.evaluate(() => [...document.querySelectorAll('[data-fx]')].map((e) => Object.entries(e.__lecfx || {}).map(([k, v]) => k + ':' + (v.skipped ? 'skip' : v.dead ? (e.getAttribute('data-fx-error') ? 'fail' : 'stop') : 'on')).join(',')).filter(Boolean).join(' '));
    const soft = await cssMoving(page); // 화소로는 안 잡히는 부드러운 흐름
    const moved = d.some((x) => x > 0.0015) || soft > 0, keeps = d.slice(-2).every((x) => x > 0.0004) || soft > 0;
    const libs = (f.libs || []).length > 0;
    // 동작 줄이기: 처음 한 장(글꼴·그림이 자리 잡는 때) 뒤로 계속 바뀌면 문제
    const later = d.slice(2).some((x) => x > 0.0015);
    let verdict = rm ? (later && f.level > 0 ? '동작 줄이기인데 움직임' : '정상') : moved ? (f.loop && !keeps ? '도는 효과인데 멈춤' : '정상') : libs ? '바깥 라이브러리 막힘(정지 그림)' : '안 움직임';
    if (/fail/.test(st) || errs.length) verdict = '오류';
    out.push({ id: f.id, level: f.level, loop: !!f.loop, group: f.group, diffs: d, st, errs, verdict });
    console.log(`${verdict.padEnd(10)} ${f.id.padEnd(18)} 단계${f.level}${f.loop ? ' 도는' : '    '} [${d.join(' ')}] ${st}${errs.length ? ' ' + errs.join(' / ') : ''}`);
    await ctx.close();
  }
  await browser.close(); srv.close();
  return out;
}

async function main() {
  const chromium = await loadChromium();
  if (!chromium) { console.error('Playwright가 없어 건너뜁니다.'); return; }
  if (has('effects')) {
    const r = await effects(chromium, { rm: has('rm'), shots: arg('shots', '') ? resolve(arg('shots')) : '', ids: arg('fx', '') ? arg('fx').split(',') : null, root: resolve(arg('root', ROOT)) });
    if (arg('out', '')) writeFileSync(arg('out'), JSON.stringify(r, null, 1));
    const bad = r.filter((x) => x.verdict !== '정상' && !/라이브러리/.test(x.verdict));
    console.log(`효과 ${r.length}개 중 문제 ${bad.length}개`);
    process.exitCode = bad.length ? 1 : 0;
    return;
  }
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
  // --layouts 0,1,…: 모든 본문 칸 설계도에서 섹션마다 k번째 배치를 강제(본문 배치 전부를 훑음, body-gate.mjs와 같은 방식)
  const forced = arg('layouts', '') ? arg('layouts').split(',').map(Number) : [null];
  if (!dir) for (const id of presets) for (const ex of exs) for (const theme of themes) for (const mo of motions) for (const k of forced) {
    const bp = JSON.parse(readFileSync(exOf(ex), 'utf8'));
    if (k !== null) { let any = false; for (const s of bp.sections) { const t = s.type === 'followup' ? 'materials' : s.type, ids = E.variantIds(t); if (ids[k] && s.type !== 'stations') { s.layout = ids[k]; any = true; } } if (!any) continue; }
    bp.design = { preset: id, theme, ...(mo === 'd' ? {} : { motion: +mo }) };
    // 단계를 정해 잴 때는 그 단계가 실제로 걸리게: 휴대폰 대상(3→2)·교육청 직무연수(→1) 상한을 풂
    if (mo !== 'd') { bp.audience = { ...(bp.audience || {}), devices: ['laptop'] }; if (bp.meta?.admin?.kind === 'official') bp.meta.admin = { ...bp.meta.admin, kind: 'school' }; }
    const r = E.build(bp, { runtime: nodeRuntime() });
    if (r.errors?.length) { console.log('빌드 오류', id, ex); continue; }
    const key = `${id}__${ex}${k === null ? '' : '-L' + k}__${theme}__m${mo}`;
    for (const [f, c] of Object.entries(r.files)) { const p = join(tmp, key, f); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, c); }
    jobs.push({ key, root: tmp, preset: id, ex: ex + (k === null ? '' : '-L' + k), motion: mo === 'd' ? `d${r.design.motion}` : mo, theme, graphic: r.design.graphic });
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
      await ctx.addInitScript(motionRecorder); // 첫 화면 사건 기록(판정은 사건으로)
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
  for (const r of results) console.log(`${r.tag.padEnd(48)} 첫화면 ${String(r.hero?.kind).padEnd(5)} [${r.hero?.summary || ''}] ${r.hero?.loops?.join(' ') || ''} 단계${r.hero?.state?.level ?? '-'}${r.hero?.state?.lowPower ? '(저사양)' : ''} 스크롤 ${r.scroll?.moved ?? '-'}/${r.scroll?.seen ?? '-'}${r.findings.length ? '\n    ' + r.findings.map((f) => `${f.rule}: ${f.sample}`).join('\n    ') : ''}`);
  if (out) writeFileSync(out, JSON.stringify(results, null, 1));
  const bad = results.filter((r) => r.findings.length);
  console.log(`문제 있는 곳 ${bad.length}/${results.length}`);
  process.exitCode = bad.length ? 1 : 0;
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
