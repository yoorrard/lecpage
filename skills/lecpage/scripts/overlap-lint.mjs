#!/usr/bin/env node
// 겹침·꼬임 검사: 효과를 얹은 뒤에도 화면이 엉키지 않았는지 스크롤 자리마다 잽니다(Playwright page를 받음).
//   글이 다른 글·단추와 겹침 · 글이 틀에서 잘리거나 화면 밖으로 나감 · 가로 넘침 · 첫 화면 그림이 제목·단추를 덮음
//   움직임이 끝난 뒤에도 숨은 채 남은 내용 · 한 요소를 두 움직임이 함께 움직임(등장 + 시차 + 붙박이 겹침) · 꾸밈 층이 메뉴 위로 올라옴
// 쓰는 곳: scripts/lecpage.mjs qa(휴대폰·태블릿·PC 밝은 화면에서 한 번씩) · 모든 프리셋을 도는 점검 스크립트(scanPage를 직접 부름)
//   node scripts/overlap-lint.mjs <dist 폴더> [--width 1280,390] [--json]
import { pathToFileURL } from 'node:url';

export const RULES = {
  'text-overlap': { level: 'error', ko: '글이 다른 글과 겹쳐요. 두 요소의 자리를 나누거나 한쪽을 꾸밈(aria-hidden)으로 돌리세요.' },
  'text-on-control': { level: 'error', ko: '글이 단추·링크 위에 겹쳐요.' },
  'clipped-text': { level: 'error', ko: '글이 틀에서 잘려요(overflow로 가려짐). 틀을 키우거나 글을 줄이세요.' },
  'offscreen-text': { level: 'error', ko: '글이 화면 밖으로 나가요.' },
  'h-scroll': { level: 'error', ko: '가로로 넘쳐요(가로 스크롤이 생김).' },
  'covered': { level: 'error', ko: '제목·단추·메뉴가 다른 층에 덮여요(그림이나 꾸밈 층이 위에 있음).' },
  'stuck-hidden': { level: 'error', ko: '움직임이 끝났는데 내용이 숨은 채 남았어요.' },
  'fx-tangle': { level: 'error', ko: '한 요소를 두 움직임이 함께 움직여요(등장·시차·붙박이 겹침 등). 하나만 남기세요.' },
};

/** 브라우저 안에서 도는 검사. mid = 움직이는 도중(겹침·넘침·꼬임만) */
export function pageCheck(mid) {
  const out = {}, add = (rule, sample) => { (out[rule] ||= []).push(String(sample).replace(/\s+/g, ' ').slice(0, 70)); };
  const vw = document.documentElement.clientWidth, vh = innerHeight;
  const cs = (el) => getComputedStyle(el);
  const name = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`;
  const sec = (el) => { const s = el.closest('.lp-sec'); return s ? (s.id || name(s)) + ' ' : ''; };
  const related = (a, b) => a === b || a.contains(b) || b.contains(a);
  // 꾸밈·흐르는 띠·가로로 넘기는 칸·화면 낭독기용 글은 겹침·잘림 대상이 아님
  const SKIP = '[aria-hidden="true"],.lp-sr,.fx-sr,[hidden],script,style,noscript,template,dialog:not([open]),details:not([open]) > :not(summary),.lp-band,.lp-closing-band,.fx-marquee,.lp-toast,select,option,.lp-slide-text';
  const opacity = (el) => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const s = cs(n); if (s.display === 'none' || s.visibility === 'hidden') return 0; o *= +s.opacity; } return o; };
  const scrollBox = (el) => { for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) { const s = cs(n); if (/auto|scroll/.test(s.overflowX + s.overflowY) && (n.scrollWidth > n.clientWidth + 2 || n.scrollHeight > n.clientHeight + 2)) return n; } return null; };
  // 글 조각에서 실제로 보이는 부분: 넘치는 것을 가리는 조상(overflow hidden·clip·auto·scroll)의 틀로 잘라 냄(말줄임표로 줄인 이름, 가로로 넘기는 메뉴)
  const visibleRect = (el, b) => {
    let l = b.left, t = b.top, r = b.right, bt = b.bottom;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const s = cs(n); if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const q = n.getBoundingClientRect();
      if (s.overflowX !== 'visible') { l = Math.max(l, q.left); r = Math.min(r, q.right); }
      if (s.overflowY !== 'visible') { t = Math.max(t, q.top); bt = Math.min(bt, q.bottom); }
    }
    return r - l > 3 && bt - t > 3 ? { l, t, r, b: bt } : null;
  };
  // 화면에 보이는 글 조각
  const items = [], tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t; (t = tw.nextNode());) {
    const txt = t.nodeValue.trim(); if (!txt) continue;
    const el = t.parentElement; if (!el || el.closest(SKIP)) continue;
    const r = document.createRange(); r.selectNodeContents(t);
    const rects = [...r.getClientRects()].filter((b) => b.width > 3 && b.height > 3 && b.bottom > 0 && b.top < vh);
    if (!rects.length || opacity(el) < 0.3) continue;
    // 글자가 실제로 칠해지는 높이만 봄: 줄 상자는 글꼴의 위아래 여백까지 포함해, 큰 숫자·좁은 행간에서는 이웃 줄과 상자가 겹침(가운데 64%)
    for (const b of rects) { const v = visibleRect(el, b); if (!v) continue; const pad = (v.b - v.t) * 0.18; items.push({ el, txt, l: v.l, t: v.t + pad, r: v.r, b: v.b - pad, raw: b }); }
  }
  // 가로 넘침
  if (document.documentElement.scrollWidth > vw + 1) add('h-scroll', `${document.documentElement.scrollWidth - vw}px`);
  // 글끼리 겹침: 겹친 자리 사이에 불투명한 판(카드가 덮는 경우)이 있으면 가려진 것이라 겹침이 아님
  const alpha = (c) => { if (!c || c === 'transparent') return 0; const sl = /\/\s*([\d.]+%?)\s*\)$/.exec(c); if (sl) return sl[1].endsWith('%') ? parseFloat(sl[1]) / 100 : +sl[1]; const m = /^rgba\(([^)]+)\)/.exec(c); return m ? +m[1].split(',')[3] : 1; };
  const opaque = (n) => { const s = cs(n); return alpha(s.backgroundColor) > 0.6 || s.backgroundImage !== 'none' || (s.backdropFilter && s.backdropFilter !== 'none') || (s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none'); };
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j]; if (related(a.el, b.el)) continue;
    const w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
    if (w < 4 || h < 4 || w * h < 0.25 * Math.min((a.r - a.l) * (a.b - a.t), (b.r - b.l) * (b.b - b.t))) continue;
    const x = Math.max(a.l, b.l) + w / 2, y = Math.max(a.t, b.t) + h / 2;
    if (x < 0 || y < 0 || x > vw || y > vh) continue;
    const stack = document.elementsFromPoint(x, y), ia = stack.findIndex((n) => related(n, a.el)), ib = stack.findIndex((n) => related(n, b.el));
    if (ia < 0 || ib < 0) continue; // 한쪽이 가려져 보이지 않음
    const lo = Math.min(ia, ib), hi = Math.max(ia, ib), under = ia > ib ? a.el : b.el;
    if (stack.slice(lo, hi).some((n) => !related(n, under) && opaque(n))) continue;
    add('text-overlap', `${sec(a.el)}"${a.txt.slice(0, 14)}" × "${b.txt.slice(0, 14)}"`);
  }
  // 글이 단추·링크 위에
  const ctrls = [...document.querySelectorAll('main a[href], main button, .lp-nav a, .lp-nav button')].filter((c) => !c.closest(SKIP) && opacity(c) > 0.3).map((c) => { const v = visibleRect(c, c.getBoundingClientRect()); return v && { c, r: { left: v.l, top: v.t, right: v.r, bottom: v.b, width: v.r - v.l } }; }).filter((x) => x && x.r.width > 8 && x.r.bottom > 0 && x.r.top < vh);
  for (const a of items) for (const { c, r } of ctrls) {
    if (related(a.el, c)) continue;
    const w = Math.min(a.r, r.right) - Math.max(a.l, r.left), h = Math.min(a.b, r.bottom) - Math.max(a.t, r.top);
    if (w < 4 || h < 4 || w * h < 0.3 * (a.r - a.l) * (a.b - a.t)) continue;
    const x = Math.max(a.l, r.left) + w / 2, y = Math.max(a.t, r.top) + h / 2;
    if (x < 0 || y < 0 || x > vw || y > vh) continue;
    const stack = document.elementsFromPoint(x, y), ia = stack.findIndex((n) => related(n, a.el)), ic = stack.findIndex((n) => related(n, c));
    if (ia < 0 || ic < 0) continue;
    const under = ia > ic ? a.el : c; // 아래에 깔린 쪽: 그 위를 불투명한 판(위쪽 요소가 든 메뉴·카드 포함)이 덮고 있으면 보이지 않으니 겹침이 아님
    if (stack.slice(Math.min(ia, ic), Math.max(ia, ic)).some((n) => !related(n, under) && opaque(n))) continue;
    add('text-on-control', `${sec(a.el)}"${a.txt.slice(0, 14)}" × ${name(c)}`);
  }
  // 한 요소를 두 움직임이: 같은 요소의 transform(또는 translate·scale·rotate)을 움직이는 애니메이션·전환이 둘 넘게 돌거나, 붙박이(sticky) 요소가 등장 대기 상태
  const byEl = new Map();
  for (const an of document.getAnimations()) {
    const el = an.effect && an.effect.target; if (!el || an.playState !== 'running' || el.closest('[aria-hidden="true"]')) continue;
    const props = an.transitionProperty ? [an.transitionProperty] : [...new Set(an.effect.getKeyframes().flatMap((k) => Object.keys(k)))];
    if (!props.some((p) => /^(transform|translate|scale|rotate)$/.test(p))) continue;
    const b = el.getBoundingClientRect(); if (b.bottom < 0 || b.top > vh) continue;
    byEl.set(el, (byEl.get(el) || new Set()).add(an.animationName || 'transition'));
  }
  for (const [el, set] of byEl) if (set.size > 1) add('fx-tangle', `${sec(el)}${name(el)}: ${[...set].join(' + ')}`);
  for (const el of document.querySelectorAll('.fx-reveal-item')) if (cs(el).position === 'sticky') add('fx-tangle', `${sec(el)}${name(el)}: 등장 + 붙박이`);
  if (mid) return out;
  // 잘림·화면 밖: 스크롤 칸 안의 글과 줄임표(…) 글은 제외
  for (const a of items) {
    if (scrollBox(a.el)) continue;
    const s = cs(a.el); if (s.textOverflow === 'ellipsis' || s.webkitLineClamp !== 'none') continue;
    const w = a.raw; if (w.left < -2 || w.right > vw + 2) { if (a.l < 1 || a.r > vw - 1) add('offscreen-text', `${sec(a.el)}"${a.txt.slice(0, 18)}"`); continue; }
    for (let n = a.el; n && n !== document.body; n = n.parentElement) {
      const o = cs(n); if (!/hidden|clip/.test(o.overflowX + o.overflowY)) continue;
      const q = n.getBoundingClientRect();
      if ((/hidden|clip/.test(o.overflowX) && (w.right > q.right + 3 || w.left < q.left - 3)) || (/hidden|clip/.test(o.overflowY) && n !== a.el && n.clientHeight > 0 && (w.bottom > q.bottom + 4 || w.top < q.top - 4) && !n.matches('.lp-hero,.lp-sec,.lp-closing,main,body'))) add('clipped-text', `${sec(a.el)}"${a.txt.slice(0, 18)}" ⊂ ${name(n.parentElement || n)} > ${name(n)}`);
      break;
    }
  }
  // 덮임: 꾸밈 층이 클릭을 막거나(pointer-events가 살아 있음) 제목·단추·메뉴 위를 칠함
  const targets = [...document.querySelectorAll('.lp-hero .lp-h1, .lp-hero .lp-ctas a, .lp-nav-in a, .lp-nav-in button, main .lp-btn')].filter((t) => !t.closest(SKIP) && opacity(t) > 0.3);
  const st = document.createElement('style'); st.textContent = '*,*::before,*::after{pointer-events:auto!important}';
  for (const t of targets) {
    const r = t.getBoundingClientRect(); if (r.width < 8 || r.height < 8) continue;
    const x = r.left + r.width / 2, y = r.top + r.height / 2; if (x < 1 || y < 1 || x > vw - 1 || y > vh - 1) continue;
    const real = document.elementFromPoint(x, y);
    if (real && !related(real, t) && !real.closest('.lp-nav,.lp-dock,.lp-toast,dialog,.lp-menu,.lp-now') && !t.closest('.lp-outline-item,.fx-stack')) { add('covered', `${sec(t)}${name(t)} ← ${name(real)}(누를 수 없음)`); continue; }
    document.head.appendChild(st);
    const top = document.elementFromPoint(x, y); st.remove();
    if (top && !related(top, t) && !top.closest('.lp-nav,.lp-dock,.lp-toast,dialog,.lp-menu,.lp-now') && opacity(top) > 0.3 && (opaque(top) || /^(IMG|CANVAS|VIDEO)$/.test(top.tagName)) && !t.closest('.lp-outline-item,.fx-stack')) add('covered', `${sec(t)}${name(t)} ← ${name(top)}`);
  }
  // 숨은 채 남음: 화면 안에 있는데 등장 대기 상태가 풀리지 않았거나, 본문 글이 거의 보이지 않음
  const inView = (el) => { const b = el.getBoundingClientRect(); return b.height > 0 && b.width > 0 && Math.min(b.bottom, vh) - Math.max(b.top, 0) > Math.min(b.height * 0.6, vh * 0.3); };
  for (const el of document.querySelectorAll('[data-fx-pre]')) if (inView(el) && !el.closest(SKIP)) add('stuck-hidden', `${sec(el)}${name(el)}[data-fx-pre]`);
  for (const el of document.querySelectorAll('main :is(h1,h2,h3,p,li,dt,dd,summary,figcaption,time)')) {
    if (el.closest(SKIP) || el.closest('[data-phase-show],[data-phase-hide],[data-live-off],[data-hero-state]') || !el.textContent.trim() || !inView(el)) continue;
    const o = opacity(el), cp = cs(el).clipPath;
    if ((o > 0 && o < 0.2) || /inset\((?:[^)]*\s)?100%/.test(cp)) add('stuck-hidden', `${sec(el)}${name(el)} "${el.textContent.trim().slice(0, 14)}" 불투명도 ${o.toFixed(2)}`);
  }
  return out;
}

/**
 * 한 페이지를 위에서 아래로, 다시 위로 훑으며 검사. 자리마다 '도중'(움직이기 시작한 직후)과 '멈춘 뒤' 두 번 봄.
 * @returns {{findings: {rule, level, count, message_ko, samples}[], stops: number}}
 */
export async function scanPage(page, { stops = [0, 0.25, 0.5, 0.75, 1, 0], settle = 900, mid = 160 } = {}) {
  const all = {};
  const merge = (o, at) => { for (const [rule, list] of Object.entries(o)) for (const s of list) (all[rule] ||= new Set()).add(`${s} @${at}`); };
  const max = await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; return Math.max(0, document.documentElement.scrollHeight - innerHeight); });
  for (const [n, f] of stops.entries()) {
    await page.evaluate((y) => scrollTo(0, y), Math.round(max * f));
    const at = `${Math.round(f * 100)}%${n === stops.length - 1 && f === 0 && stops.length > 1 ? '(돌아옴)' : ''}`;
    if (mid) { await page.waitForTimeout(mid); merge(await page.evaluate(pageCheck, true), at + ' 도중'); }
    await page.waitForTimeout(settle);
    merge(await page.evaluate(pageCheck, false), at);
  }
  const findings = Object.entries(all).map(([rule, set]) => ({ rule, level: RULES[rule]?.level || 'warn', count: set.size, message_ko: RULES[rule]?.ko || rule, samples: [...set].slice(0, 6) }));
  return { findings, stops: stops.length };
}

/** qa가 부르는 모양(디자인 검사와 같음) */
export async function lintPage(page) { return scanPage(page, { stops: [0, 0.33, 0.66, 1, 0], settle: 700, mid: 140 }); }

// ── CLI: 만든 사이트 폴더 하나를 검사 ──
async function main(argv) {
  const args = argv.slice(2), dir = args.find((a) => !a.startsWith('--'));
  if (!dir) { console.error('쓰는 법: node scripts/overlap-lint.mjs <dist 폴더> [--width 1280,390] [--json]'); process.exitCode = 2; return; }
  const { createServer } = await import('node:http'); const { readFile } = await import('node:fs/promises'); const { resolve, join, extname, sep } = await import('node:path');
  const { createRequire } = await import('node:module');
  const { chromium } = await import('playwright').catch(() => { try { return createRequire(import.meta.url)('playwright'); } catch { return {}; } });
  if (!chromium) { console.error('Playwright가 없어 건너뜁니다.'); return; }
  const base = resolve(dir), MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
  const srv = createServer(async (q, r) => { try { const p = resolve(join(base, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'))); if (p !== base && !p.startsWith(base + sep)) throw 0; const b = await readFile(p); r.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const widths = (args[args.indexOf('--width') + 1] && args.includes('--width') ? args[args.indexOf('--width') + 1] : '1280,390').split(',').map(Number);
  const browser = await chromium.launch(), report = [];
  try {
    for (const w of widths) {
      const page = await browser.newPage({ viewport: { width: w, height: w < 700 ? 780 : 860 } });
      await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`, { waitUntil: 'load' }); await page.waitForTimeout(800);
      report.push({ width: w, ...(await scanPage(page)) }); await page.close();
    }
  } finally { await browser.close(); srv.close(); }
  const errors = report.reduce((n, r) => n + r.findings.reduce((m, f) => m + f.count, 0), 0);
  if (args.includes('--json')) console.log(JSON.stringify({ errors, report }, null, 1));
  else { for (const r of report) { console.log(`\n■ 폭 ${r.width}px · 스크롤 자리 ${r.stops}곳`); if (!r.findings.length) console.log('  겹침·꼬임 없음'); for (const f of r.findings) console.log(`  ✗ ${f.rule} ×${f.count} — ${f.message_ko}\n      ${f.samples.slice(0, 4).join('\n      ')}`); } console.log(`\n문제 ${errors}개`); }
  process.exitCode = errors ? 1 : 0;
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main(process.argv);
