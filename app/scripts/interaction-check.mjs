#!/usr/bin/env node
// 동작 검사(Playwright): docs/interaction.md의 검사 가능한 항목을 앱 주요 화면과 강의 페이지 예시에서 확인합니다.
//   초점 표시·가려짐 · 누름 크기(24px, 터치 44px) · 대화상자(초점 가둠·Esc·닫은 뒤 초점 복귀) · 누름 반응 시간
//   · 두 번 눌러도 한 번만 · 기다림 표시 · 움직임 줄이기 · 상호작용 중 레이아웃 밀림(CLS) · 키보드만으로 1→2단계 · 휴대폰 입력 글자 크기·확대 막음
//
// 쓰는 법(저장소 맨 위에서):
//   npm --prefix app run build && npm run examples
//   node app/scripts/interaction-check.mjs                     미리보기 서버를 띄웠다 끔(포트 4188)
//   node app/scripts/interaction-check.mjs --base=http://localhost:4187/   이미 띄운 서버
//   --sites=.out   강의 페이지 예시 폴더(기본 .out, 없으면 건너뜀)   --json   결과를 JSON으로   --only=app|site
// playwright는 앱 의존성이 아닙니다. 개발 환경에 설치된 것을 씁니다. 바깥 네트워크는 모두 막고 돌립니다.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const ROOT = join(APP, '..');
const arg = (k, d = '') => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const has = (k) => process.argv.includes(`--${k}`);
const ONLY = arg('only');

let playwright;
try { playwright = createRequire(import.meta.url)('playwright'); }
catch { console.error('playwright를 찾지 못했어요. 개발 환경에 설치된 playwright가 필요해요.'); process.exit(2); }
const { chromium } = playwright;

// ── 서버 ──
let base = arg('base'); let preview = null;
if (!base && ONLY !== 'site') {
  const port = 4188;
  preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { cwd: APP, stdio: 'ignore' });
  base = `http://localhost:${port}/`;
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break; } catch { /* 아직 */ } await new Promise((r) => setTimeout(r, 250)); }
}
base = base && base.replace(/\/?$/, '/');
const SITES = join(ROOT, arg('sites', '.out'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
let siteServer = null; let siteBase = '';
if (ONLY !== 'app' && existsSync(join(SITES, 'sel-story', 'index.html'))) {
  siteServer = createServer((req, res) => {
    const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
    const f = join(SITES, p.endsWith('/') || !p ? p + 'index.html' : p);
    if (!f.startsWith(SITES) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
  });
  await new Promise((r) => siteServer.listen(0, '127.0.0.1', r));
  siteBase = `http://127.0.0.1:${siteServer.address().port}/`;
}

// ── 결과 ──
const results = [];
const put = (area, page, check, status, detail = '') => results.push({ area, page, check, status, detail });

// ── 페이지 안에서 쓰는 도구(addInitScript로 넣음) ──
function pageTools() {
  window.__shifts = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__shifts.push({ v: e.value, input: e.hadRecentInput, t: e.startTime }); }).observe({ type: 'layout-shift', buffered: true }); } catch { /* 지원 안 함 */ }
  window.__sel = (el) => {
    if (!el || el === document.body) return 'body';
    const t = (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.classList[0] ? '.' + el.classList[0] : ''}${t ? ` "${t}"` : ''}`;
  };
  window.__vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.01; };
  /** 누르는 곳: 숨은 입력은 감싼 label이나 다음 형제로 잼. 문장 속 링크는 뺌(WCAG 2.5.8 inline 예외) */
  window.__targets = () => {
    const out = [];
    for (const el of document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=checkbox],[role=switch]')) {
      if (el.closest('[inert],dialog:not([open]),[aria-hidden="true"]') || el.disabled) continue;
      let box = el;
      if (el.tagName === 'INPUT' && (!window.__vis(el) || /^(checkbox|radio)$/.test(el.type))) box = el.closest('label') || (window.__vis(el) ? el : el.nextElementSibling) || el; // 이름표까지 한 덩어리로 누름
      if (!window.__vis(box)) continue;
      const cs = getComputedStyle(box);
      if (el.tagName === 'A' && cs.display === 'inline') { const p = el.parentElement; if (p && p.textContent.trim().length > el.textContent.trim().length + 2) continue; }
      const r = box.getBoundingClientRect();
      out.push({ el, r, name: window.__sel(el) });
    }
    return out;
  };
}

async function newContext(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'ko-KR', ...opts });
  await ctx.addInitScript(pageTools);
  await ctx.route('**/*', (r) => { const u = r.request().url(); return /^(https?:\/\/(localhost|127\.0\.0\.1)[:/]|data:|blob:)/.test(u) ? r.continue() : r.abort(); });
  return ctx;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function settle(page, ms = 400) { await page.waitForLoadState('domcontentloaded'); await sleep(ms); }

// ── 검사 ──
/** 초점: Tab으로 차례로 옮기며 표시(바깥선·그림자·테두리·배경이 초점 전후로 달라지는가)와 가려짐을 봄 */
async function focusWalk(page, area, name, max = 50) {
  await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
  await page.mouse.click(1, 1).catch(() => {});
  const noRing = []; const hidden = []; const partly = []; const ghost = []; let n = 0;
  await page.evaluate(() => { window.__seen = new WeakSet(); });
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement; if (!el || el === document.body || el.tagName === 'IFRAME') return null;
      window.__seen = window.__seen || new WeakSet();
      if (window.__seen.has(el)) return { cycle: true }; // 한 바퀴 돎
      window.__seen.add(el);
      const parts = [el, el.nextElementSibling, el.parentElement, el.parentElement?.parentElement, el.parentElement?.parentElement?.parentElement, el.closest('label')].filter(Boolean); // 표시를 감싼 칸에 그리는 경우(:has·:focus-within)까지
      const snap = () => parts.map((p) => { const c = getComputedStyle(p); return [c.outlineStyle, c.outlineWidth, c.outlineColor, c.boxShadow, c.borderColor, c.backgroundColor, c.textDecorationLine].join('|'); }).join('#');
      const on = snap(); el.blur(); const off = snap(); el.focus({ preventScroll: true });
      const r0 = el.getBoundingClientRect(); const lab = el.tagName === 'INPUT' && (r0.width < 2 || r0.height < 2) ? el.closest('label') : null; // 숨긴 단추형 입력은 감싼 label이 보이는 곳
      const r = lab ? lab.getBoundingClientRect() : r0;
      const pts = [[0.5, 0.5], [0.15, 0.2], [0.85, 0.2], [0.15, 0.8], [0.85, 0.8]].map(([x, y]) => [r.left + r.width * x, r.top + r.height * y]);
      const covered = pts.map(([x, y]) => { if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return true; const t = document.elementFromPoint(x, y); return !(t && (t === el || el.contains(t) || t.contains(el) || (el.labels && [...el.labels].some((l) => l.contains(t))))); });
      return { key: window.__sel(el), ring: on !== off, all: covered.every(Boolean), some: covered.some(Boolean), small: r.width < 2 || r.height < 2, ghost: r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth };
    });
    if (!info) continue;
    if (info.cycle) break;
    n++;
    if (info.ghost) { ghost.push(info.key); continue; }
    if (!info.ring && !info.small) noRing.push(info.key);
    if (info.all) hidden.push(info.key); else if (info.some) partly.push(info.key);
  }
  put(area, name, '초점 표시(Tab 차례대로)', noRing.length ? 'fail' : 'pass', `${n}곳 중 표시 없음 ${noRing.length}${noRing.length ? ': ' + noRing.slice(0, 4).join(', ') : ''}`);
  put(area, name, '초점이 가려지지 않음(WCAG 2.4.11)', hidden.length ? 'fail' : partly.length ? 'warn' : 'pass', `완전히 가려짐 ${hidden.length}, 일부 가려짐 ${partly.length}${hidden.concat(partly).length ? ': ' + hidden.concat(partly).slice(0, 3).join(', ') : ''}`);
  put(area, name, '보이지 않는 곳에 초점이 가지 않음', ghost.length ? 'fail' : 'pass', ghost.length ? `${ghost.length}곳: ${ghost.slice(0, 3).join(', ')}` : '');
}

/** 화면을 옮길 때(해시 바꾸기) 레이아웃 밀림. 입력 없이 일어난 것만 */
async function routeCls(page, area, hash, name) {
  await page.evaluate(() => { window.__shifts = []; });
  await page.evaluate((h) => { location.hash = h; }, hash); await sleep(2200);
  const c = await clsOf(page);
  put(area, name, '화면을 옮길 때 레이아웃 밀림(CLS)', c.unexpected > 0.1 ? 'fail' : c.unexpected > 0.05 ? 'warn' : 'pass', fmt(c.unexpected));
}

/** 누름 크기: 24px(WCAG 2.5.8, 둘레 간격 예외 포함) 또는 44px(터치) */
async function targetSizes(page, area, name, min) {
  const r = await page.evaluate((min) => {
    const ts = window.__targets(); const small = [];
    const ctr = (r) => [r.left + r.width / 2, r.top + r.height / 2];
    for (const t of ts) {
      if (t.r.width >= min - 0.5 && t.r.height >= min - 0.5) continue; // 소수점 반올림 오차
      if (min <= 24) { // 간격 예외: 가운데에서 반지름 12px 원이 다른 누르는 곳에 닿지 않으면 통과
        const [cx, cy] = ctr(t.r);
        const clash = ts.some((o) => o !== t && !(o.el.contains(t.el) || t.el.contains(o.el)) && Math.hypot(Math.max(o.r.left - cx, 0, cx - o.r.right), Math.max(o.r.top - cy, 0, cy - o.r.bottom)) < 12);
        if (!clash) continue;
      }
      small.push(`${t.name} ${Math.round(t.r.width)}×${Math.round(t.r.height)}`);
    }
    return { n: ts.length, small };
  }, min);
  put(area, name, `누름 크기 ${min}px`, r.small.length ? (min > 24 ? 'warn' : 'fail') : 'pass', `${r.n}곳 중 작음 ${r.small.length}${r.small.length ? ': ' + r.small.slice(0, has('json') ? 99 : 5).join(', ') : ''}`);
}

/** 대화상자: 여는 단추에 초점 → Enter → 안으로 초점, Tab 20번 동안 밖으로 안 나감, Esc로 닫힘, 여는 단추로 초점 복귀 */
async function dialogCheck(page, area, name, openerSel) {
  const opener = page.locator(openerSel).first();
  if (!(await opener.count())) { put(area, name, '대화상자', 'skip', `여는 단추 없음: ${openerSel}`); return; }
  await page.evaluate(() => document.querySelectorAll('[data-ic-opener]').forEach((x) => x.removeAttribute('data-ic-opener')));
  await opener.evaluate((el) => el.setAttribute('data-ic-opener', ''));
  await opener.focus(); await page.keyboard.press('Enter'); await sleep(250);
  const inside = () => page.evaluate(() => { const d = [...document.querySelectorAll('dialog[open],[role=dialog]:not([hidden])')].pop(); const a = document.activeElement; return { open: !!d, in: !!(d && a && d.contains(a)), body: a === document.body || !a, at: window.__sel(a), risky: !!a && (/danger/.test(a.className) || /^(지우기|삭제|덮어쓰기)|다시 만들기/.test((a.textContent || '').trim())) }; });
  const s0 = await inside();
  if (!s0.open) { put(area, name, '대화상자 열림', 'fail', '열리지 않음'); return; }
  let escaped = 0;
  for (let i = 0; i < 20; i++) { await page.keyboard.press('Tab'); const s = await inside(); if (!s.in && !s.body) escaped++; }
  await page.keyboard.press('Escape'); await sleep(250);
  const after = await page.evaluate(() => { const o = document.querySelector('[data-ic-opener]'); return { open: !!document.querySelector('dialog[open]'), back: !!o && (document.activeElement === o || o.contains(document.activeElement)), gone: !o, at: window.__sel(document.activeElement) }; });
  put(area, name, '대화상자: 열면 초점이 안으로', s0.in ? 'pass' : 'fail', s0.in ? `첫 초점: ${s0.at}` : '초점이 밖에 남음');
  put(area, name, '대화상자: 첫 초점이 위험한 단추가 아님', s0.risky ? 'warn' : 'pass', s0.risky ? `${s0.at}(Enter 두 번이면 실행됨)` : '');
  put(area, name, '대화상자: 초점 가둠(Tab 20번)', escaped ? 'fail' : 'pass', escaped ? `밖으로 ${escaped}번 나감` : '');
  put(area, name, '대화상자: Esc로 닫힘', after.open ? 'fail' : 'pass');
  put(area, name, '대화상자: 닫은 뒤 여는 단추로 초점', after.back ? 'pass' : 'fail', after.back ? '' : after.gone ? '여는 단추가 다시 그려져 사라짐' : `초점: ${after.at}`);
}

/** 누름 반응: 누른 뒤 첫 화면 변화까지(ms). 느린 학교 컴퓨터를 흉내 내 CPU 4배 느리게 */
async function clickLatency(page, area, name, sels) {
  const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const times = [];
  for (const sel of sels) {
    const ms = await page.evaluate(async (sel) => {
      const el = document.querySelector(sel); if (!el) return null;
      return await new Promise((res) => {
        const t0 = performance.now(); let done = false;
        const fin = () => { if (!done) { done = true; mo.disconnect(); res(performance.now() - t0); } };
        const mo = new MutationObserver(fin); mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
        addEventListener('hashchange', fin, { once: true });
        el.click(); setTimeout(() => { if (!done) { done = true; mo.disconnect(); res(Infinity); } }, 3000);
      });
    }, sel);
    if (ms !== null) times.push([sel, ms]);
    await sleep(150);
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const slow = times.filter(([, t]) => t > 100);
  put(area, name, '누름 반응 100ms 안(CPU 4배 느리게)', slow.length ? 'fail' : times.length ? 'pass' : 'skip', times.map(([s, t]) => `${s.replace(/^.*?([a-z]+[^ ]*)$/, '$1').slice(0, 30)} ${Number.isFinite(t) ? Math.round(t) + 'ms' : '반응 없음'}`).join(', '));
}

/** 움직임 줄이기: 실행 중인 CSS·웹 애니메이션 수와, 0.7초 간격 두 장의 화면이 같은가 */
async function motionCheck(page, area, name) {
  const run = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && (a.effect?.getTiming?.().duration || 0) > 0).map((a) => (a.animationName || a.transitionProperty || 'js') + '@' + window.__sel(a.effect?.target)).slice(0, 6));
  await page.evaluate(() => document.activeElement?.blur?.());
  const a = await page.screenshot(); await sleep(700); const b = await page.screenshot();
  put(area, name, '움직임 줄이기: 애니메이션 꺼짐', run.length ? 'fail' : 'pass', run.length ? run.join(', ') : '실행 중 0');
  put(area, name, '움직임 줄이기: 화면이 멈춰 있음(0.7초 두 장)', a.equals(b) ? 'pass' : 'fail', a.equals(b) ? '' : '두 장이 다름(움직이는 것이 있음)');
}

async function clsOf(page) { return page.evaluate(() => { const s = window.__shifts || []; return { unexpected: s.filter((x) => !x.input).reduce((a, x) => a + x.v, 0), all: s.reduce((a, x) => a + x.v, 0) }; }); }
const fmt = (n) => n.toFixed(3);

async function mobileInputs(page, area, name) {
  const r = await page.evaluate(() => ({
    small: [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]),select,textarea')].filter(window.__vis).filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16).map((el) => `${window.__sel(el)} ${getComputedStyle(el).fontSize}`),
    zoomOff: /maximum-scale\s*=\s*1(\.0)?\b|user-scalable\s*=\s*no/.test(document.querySelector('meta[name=viewport]')?.content || ''),
    coarse: matchMedia('(pointer: coarse)').matches,
  }));
  put(area, name, '휴대폰: 입력칸 글자 16px 이상(iOS 확대 방지)', r.small.length ? 'warn' : 'pass', r.small.slice(0, 4).join(', '));
  put(area, name, '휴대폰: 확대를 막지 않음', r.zoomOff ? 'fail' : 'pass');
  return r.coarse;
}

// ── 앱 ──
async function checkApp(browser) {
  const A = 'app';
  // 1) 첫 화면·도움말·설정: 초점, 누름 크기, CLS
  let ctx = await newContext(browser); let page = await ctx.newPage();
  await page.goto(base); await settle(page, 800);
  await focusWalk(page, A, '첫 화면');
  await targetSizes(page, A, '첫 화면', 24);
  // 두 번 눌러도 한 번만: '교재 없이 시작하기'·'이 예시로 시작'을 빠르게 두 번
  const count = () => page.evaluate(async () => { const req = indexedDB.open('lecpage'); const db = await new Promise((r, j) => { req.onsuccess = () => r(req.result); req.onerror = j; }); const names = [...db.objectStoreNames]; const st = names.find((n) => /project/i.test(n)) || names[0]; return await new Promise((r) => { const q = db.transaction(st).objectStore(st).count(); q.onsuccess = () => r(q.result); q.onerror = () => r(-1); }); }).catch(() => -1);
  for (const [label, sel] of [['교재 없이 시작하기', 'button:has-text("교재 없이 시작하기")'], ['이 예시로 시작', 'button:has-text("이 예시로 시작")']]) {
    await page.goto(base); await settle(page, 500);
    const before = await count();
    await page.locator(sel).first().dblclick();
    await page.waitForURL(/#\/p\//, { timeout: 8000 }).catch(() => {}); await sleep(900);
    const after = await count();
    put(A, '첫 화면', `두 번 눌러도 한 번만: ${label}`, before < 0 ? 'skip' : after - before > 1 ? 'fail' : 'pass', before < 0 ? '저장소를 못 읽음' : `연수 ${after - before}개 생김`);
  }
  // 대화상자: 첫 화면의 '지우기' 확인 창
  await page.goto(base); await settle(page, 800);
  await dialogCheck(page, A, '첫 화면 › 연수 지우기 창', '.proj-actions button:has-text("지우기")');
  // 누름 반응
  await clickLatency(page, A, '첫 화면 › 위 메뉴', ['nav a[href="#/help"]', 'nav a[href="#/settings"]', 'nav a[href="#/gallery"]', 'nav a[href="#/"]']);
  await page.goto(base); await settle(page, 1200);
  { const c = await clsOf(page); put(A, '첫 화면 열기', '레이아웃 밀림(CLS)', c.unexpected > 0.1 ? 'fail' : c.unexpected > 0.05 ? 'warn' : 'pass', fmt(c.unexpected)); }
  for (const [h, nm] of [['#/help', '첫 화면→도움말'], ['#/settings', '도움말→설정'], ['#/gallery', '설정→디자인 갤러리'], ['#/', '갤러리→첫 화면']]) await routeCls(page, A, h, nm);
  for (const [nm, h] of [['도움말', '#/help'], ['설정', '#/settings']]) { await page.goto(base + h); await settle(page, 700); await focusWalk(page, A, nm, 40); await targetSizes(page, A, nm, 24); }

  // 2) 예시로 만든 연수의 2단계(살펴보고 고치기)·1단계
  await page.goto(base); await settle(page, 500);
  await page.locator('button:has-text("이 예시로 시작")').first().click();
  await page.waitForURL(/#\/p\/[^/]+\/2/); await settle(page, 1500);
  const pid = page.url().match(/#\/p\/([^/]+)/)[1];
  const h1Focus = await page.evaluate(() => document.activeElement?.tagName === 'H1');
  put(A, '2단계', '단계를 옮기면 제목으로 초점', h1Focus ? 'pass' : 'fail', h1Focus ? '' : `초점: ${await page.evaluate(() => window.__sel(document.activeElement))}`);
  await focusWalk(page, A, '2단계', 60);
  await targetSizes(page, A, '2단계', 24);
  await clickLatency(page, A, '2단계 › 탭', ['[role=tab]:nth-child(2)', '[role=tab]:nth-child(3)', '[role=tab]:nth-child(1)']);
  put(A, '2단계(탭 전환 포함)', '상호작용 중 레이아웃 밀림(CLS)', ...(await clsOf(page).then((c) => [c.unexpected > 0.1 ? 'fail' : c.unexpected > 0.05 ? 'warn' : 'pass', `입력과 무관 ${fmt(c.unexpected)} · 전체 ${fmt(c.all)}`])));
  await page.goto(`${base}#/p/${pid}/1`); await settle(page, 900);
  await dialogCheck(page, A, '1단계 › 다시 만들기 창', 'button:has-text("처음부터 다시 만들기")');
  await page.goto(`${base}#/p/${pid}/3`); await settle(page, 1200);
  await focusWalk(page, A, '3단계', 60);
  await targetSizes(page, A, '3단계', 24);
  // 기다림 표시: 느린 화면 열기(도움말을 처음 부를 때)에 aria-live 안내가 있는가
  await ctx.close();
  // 서비스 워커를 끄고 도움말 화면 파일을 1.5초 늦게 줌 → 0.3초 때 기다림 안내가 보이는가, 다 뜬 뒤 안내가 사라지는가
  ctx = await newContext(browser, { serviceWorkers: 'block' }); page = await ctx.newPage();
  await page.route(/\/assets\/Help-[^/]+\.js$/, async (r) => { await sleep(1500); r.continue(); });
  await page.goto(base); await settle(page, 600);
  await page.evaluate(() => { location.hash = '#/help'; });
  await sleep(300);
  const wait = await page.evaluate(() => { const m = document.querySelector('main'); const live = m?.querySelector('[aria-live],[role=status],[aria-busy=true],[role=progressbar]'); return { live: !!live && /중|…/.test(live.textContent), text: (live?.textContent || m?.textContent || '').trim().slice(0, 30) }; });
  await sleep(2000);
  const doneH = await page.evaluate(() => !!document.querySelector('main h1, main h2'));
  put(A, '도움말 처음 열기(1.5초 늦게)', '기다림 표시(aria-live)', wait.live && doneH ? 'pass' : 'fail', `0.3초: "${wait.text}" · 2초 뒤 내용 ${doneH ? '보임' : '안 보임'}`);
  await ctx.close();

  // 3) 키보드만으로 1→2단계
  ctx = await newContext(browser); page = await ctx.newPage();
  await page.goto(base); await settle(page, 700);
  let tabs = 0; let ok = true; const steps = [];
  const tabTo = async (test, max) => { for (let i = 0; i < max; i++) { await page.keyboard.press('Tab'); tabs++; if (await page.evaluate(test)) return true; } return false; };
  if (await tabTo(() => document.activeElement?.textContent?.trim() === '교재 없이 시작하기', 40)) { await page.keyboard.press('Enter'); steps.push(`시작 단추(Tab ${tabs})`); } else ok = false;
  if (ok) { ok = !!(await page.waitForURL(/#\/p\/[^/]+\/1/, { timeout: 6000 }).then(() => 1).catch(() => 0)); await sleep(600); }
  if (ok) { const t0 = tabs; ok = await tabTo(() => document.activeElement?.getAttribute('aria-required') === 'true', 40); if (ok) { await page.keyboard.type('키보드 시험 연수'); steps.push(`연수명 칸(Tab ${tabs - t0})`); } }
  if (ok) { const t0 = tabs; ok = await tabTo(() => /AI 없이 기본 초안만/.test(document.activeElement?.textContent || ''), 80); if (ok) { await page.keyboard.press('Enter'); steps.push(`기본 초안 단추(Tab ${tabs - t0})`); } }
  if (ok) ok = !!(await page.waitForURL(/#\/p\/[^/]+\/2/, { timeout: 8000 }).then(() => 1).catch(() => 0));
  put(A, '1→2단계', '키보드만으로 진행', ok ? (tabs > 40 ? 'warn' : 'pass') : 'fail', `${steps.join(' → ')} · Tab 모두 ${tabs}번${tabs > 40 ? '(많음: 건너뛰기 링크·초점 순서 살핌)' : ''}`);
  await ctx.close();

  // 4) 움직임 줄이기
  ctx = await newContext(browser, { reducedMotion: 'reduce' }); page = await ctx.newPage();
  await page.goto(base); await settle(page, 1200);
  await motionCheck(page, A, '첫 화면(움직임 줄이기)');
  await page.goto(base + '#/gallery'); await settle(page, 1500);
  await motionCheck(page, A, '디자인 갤러리(움직임 줄이기)');
  await ctx.close();

  // 5) 휴대폰
  ctx = await newContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); page = await ctx.newPage();
  await page.goto(base); await settle(page, 800);
  const coarse = await mobileInputs(page, A, '첫 화면(휴대폰)');
  if (!coarse) put(A, '휴대폰', '터치 흉내', 'warn', 'pointer: coarse가 켜지지 않음');
  await targetSizes(page, A, '첫 화면(휴대폰)', 44);
  await page.locator('button:has-text("이 예시로 시작")').first().click();
  await page.waitForURL(/#\/p\/[^/]+\/2/); await settle(page, 1500);
  await targetSizes(page, A, '2단계(휴대폰)', 44);
  const pid2 = page.url().match(/#\/p\/([^/]+)/)[1];
  await page.goto(`${base}#/p/${pid2}/1`); await settle(page, 900);
  await mobileInputs(page, A, '1단계(휴대폰)');
  await targetSizes(page, A, '1단계(휴대폰)', 44);
  await ctx.close();
}

// ── 강의 페이지 예시 ──
async function checkSites(browser) {
  const A = 'site';
  for (const id of ['sel-story', 'data-lab']) {
    const url = `${siteBase}${id}/index.html`;
    let ctx = await newContext(browser); let page = await ctx.newPage();
    await page.goto(url); await settle(page, 1200);
    await focusWalk(page, A, `${id} 참가자 화면`, 60);
    await targetSizes(page, A, `${id} 참가자 화면`, 24);
    await dialogCheck(page, A, `${id} › 공유(QR) 창`, '[data-share]');
    // 스크롤하며 내려가는 동안 밀림
    for (let y = 0; y < 6; y++) { await page.mouse.wheel(0, 700); await sleep(250); }
    const c = await clsOf(page);
    put(A, `${id} 참가자 화면(스크롤)`, '레이아웃 밀림(CLS)', c.unexpected > 0.1 ? 'fail' : c.unexpected > 0.05 ? 'warn' : 'pass', `입력과 무관 ${fmt(c.unexpected)} · 전체 ${fmt(c.all)}`);
    const skip = await page.evaluate(() => !!document.querySelector('a[href^="#"][class*="skip"],a.lp-skip,a[href="#main"],a[href="#content"]'));
    put(A, `${id} 참가자 화면`, '본문 바로 가기 링크', skip ? 'pass' : 'warn');
    await ctx.close();
    ctx = await newContext(browser, { reducedMotion: 'reduce' }); page = await ctx.newPage();
    await page.goto(url); await settle(page, 1500);
    await motionCheck(page, A, `${id} (움직임 줄이기)`);
    await ctx.close();
    ctx = await newContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); page = await ctx.newPage();
    await page.goto(url); await settle(page, 1200);
    await mobileInputs(page, A, `${id} (휴대폰)`);
    await targetSizes(page, A, `${id} (휴대폰)`, 44);
    await dialogCheck(page, A, `${id} › 차례 시트(휴대폰)`, '[data-toc-open]');
    await ctx.close();
  }
}

const browser = await chromium.launch();
try {
  if (ONLY !== 'site' && base) await checkApp(browser);
  if (ONLY !== 'app') { if (siteBase) await checkSites(browser); else put('site', '-', '강의 페이지 예시', 'skip', `${SITES}에 예시가 없음(npm run examples)`); }
} catch (e) { put('-', '-', '검사 도중 멈춤', 'fail', String(e.message || e).split('\n')[0]); }
finally { await browser.close(); preview?.kill(); siteServer?.close(); }

if (has('json')) console.log(JSON.stringify(results, null, 2));
else {
  const mark = { pass: '통과', fail: '실패', warn: '살핌', skip: '건너뜀' };
  console.log('| 곳 | 화면 | 검사 | 결과 | 자세히 |\n|---|---|---|---|---|');
  for (const r of results) console.log(`| ${r.area === 'app' ? '앱' : r.area === 'site' ? '강의 페이지' : r.area} | ${r.page} | ${r.check} | ${mark[r.status] || r.status} | ${String(r.detail).replace(/\|/g, '/')} |`);
  const n = (s) => results.filter((r) => r.status === s).length;
  console.log(`\n통과 ${n('pass')} · 실패 ${n('fail')} · 살핌 ${n('warn')} · 건너뜀 ${n('skip')}`);
}
process.exit(results.some((r) => r.status === 'fail') ? 1 : 0);
