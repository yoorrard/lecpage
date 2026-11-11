#!/usr/bin/env node
// lecpage 디자인 검사(design lint): 만든 쪽을 브라우저(Playwright)로 열어 'AI가 만든 티'와 읽기 문제를 셉니다.
// 규칙은 references/design-quality.md에 있습니다. 아이디어 출처: pbakaus/impeccable(Apache-2.0)의 탐지 규칙 목록,
// Leonxlnx/taste-skill(MIT)의 '상자 두 겹까지' 검사, Vercel Web Interface Guidelines(MIT). 코드는 새로 썼습니다.
//
//   모듈:  import { lintPage } from './design-lint.mjs'; const r = await lintPage(page);  // page = Playwright Page
//          r → { findings:[{rule, level:'error'|'warn', count, message_ko, samples:[…]}], metrics:{…} }
//   CLI:   node design-lint.mjs <사이트 폴더> [--json] [--pages index.html,screen.html] [--width 1280,390]
//          폴더를 잠깐 띄워(127.0.0.1) 쪽마다 넓은 화면·휴대폰 두 크기로 검사합니다. 오류가 있으면 종료 코드 1.
import { createServer } from 'node:http';
import { readFile, stat, readdir } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

/** 규칙 설명(한국어). level: error = 고쳐야 함, warn = 살펴볼 것 */
export const RULES = {
  'side-stripe': { level: 'error', ko: '상자 한쪽에만 굵은 색 띠(border-left 등)가 있어요. 띠 대신 제목·여백으로 구분하세요.' },
  'pill-chip': { level: 'error', ko: '알약 모양 꼬리표(배경·테두리가 있는 둥근 작은 글자)가 있어요. 작은 글자와 가운뎃점으로 바꾸세요.' },
  'nested-cards': { level: 'error', ko: '상자 안에 상자가 있어요(두 겹 이상). 안쪽 상자를 걷어 내고 여백·가는 선으로 나누세요.' },
  'gradient-text': { level: 'error', ko: '그라데이션 글자가 있어요. 강조는 크기·굵기·한 가지 색으로 하세요.' },
  'emoji-icon': { level: 'error', ko: '이모지·글리프를 아이콘 대신 썼어요. 같은 굵기의 SVG 아이콘을 쓰거나 빼세요.' },
  'uniform-card-grid': { level: 'warn', ko: '똑같은 크기의 상자를 세 개 넘게 나란히 놓았어요. 목록·표·번호 단계처럼 내용에 맞는 모양을 고르세요.' },
  'line-length': { level: 'warn', ko: '본문 한 줄이 너무 길어요(한국어 40자, 영어 80자 넘음). 글 폭을 줄이세요.' },
  'heading-ratio': { level: 'warn', ko: '제목과 본문의 크기 차이가 작아요. 섹션 제목은 본문의 1.6배 넘게 키우세요.' },
  'font-sizes': { level: 'warn', ko: '글자 크기 가짓수가 너무 많아요. 정해 둔 크기 단계만 쓰세요.' },
  'long-label': { level: 'warn', ko: '단추·메뉴·라벨 글이 길거나 어색해요. 짧은 동사형으로 줄이세요(예: "자료 받기").' },
  'layout-repeat': { level: 'error', ko: '같은 배치의 섹션이 셋 넘게 줄지어 나와요(머리 왼쪽·줄 목록 오른쪽 등). 사이에 다른 배치를 두거나 섹션 순서를 바꾸세요.' },
};

// ── 쪽을 열지 않고 하는 검사(HTML 문자열) ─────────────────────────────
/** 줄 목록 계열은 한 가족으로 봄(일정·FAQ·자료·연수 후·차시는 모두 '머리 + 줄 목록') */
const FAMILY = { timeline: 'rows', accordion: 'rows', files: 'rows', course: 'rows' };
/**
 * 첫 화면 뼈대: <section class="… lp-hero …"> 안의 태그·클래스 나무만 남긴 문자열(글자·속성 값·구성 이름 클래스는 뺌).
 * 두 프리셋의 뼈대가 같으면 '옷만 갈아입힌 같은 첫 화면'입니다 → 엔진 테스트가 프리셋끼리 서로 다른지 확인합니다.
 */
export function heroSkeleton(html) {
  const m = /<section[^>]*class="[^"]*\blp-hero\b[^"]*"[^>]*>([\s\S]*?)<\/section>/.exec(String(html || ''));
  if (!m) return '';
  return (m[1].match(/<\/?[a-zA-Z][^>]*>/g) || []).map((t) => {
    if (t[1] === '/') return t.toLowerCase();
    const tag = /^<([a-zA-Z0-9]+)/.exec(t)[1].toLowerCase();
    if (['br', 'em', 'i', 'b', 'svg', 'path', 'time', 'a', 'span'].includes(tag)) return '';
    const cls = (/class="([^"]*)"/.exec(t)?.[1] || '').split(/\s+/).filter((c) => c && !/^lp-hero--/.test(c) && !/^(is-|fx-)/.test(c)).sort().join('.');
    return `<${tag}${cls ? '.' + cls : ''}>`;
  }).filter((t) => t && !/^<\/(br|em|i|b|svg|path|time|a|span)>$/.test(t)).join('');
}
/** 섹션 배치 줄: main 안 섹션의 '틀/배치 가족' 목록과, 같은 것이 가장 길게 이어진 횟수 */
export function layoutRuns(html) {
  const seq = [...String(html || '').matchAll(/<section[^>]*\bdata-layout="([^"]+)"[^>]*\bdata-frame="([^"]+)"/g)].map((m) => `${m[2]}/${FAMILY[m[1]] || m[1]}`);
  let max = 0, run = 0, at = '';
  seq.forEach((x, i) => { run = i && x === seq[i - 1] ? run + 1 : 1; if (run > max) { max = run; at = x; } });
  return { seq, max, at };
}

/** 쪽 안에서 도는 검사(직렬화되어 브라우저에서 실행됨) */
function inPage() {
  const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none' && (+s.opacity !== 0 || !!e.closest('[data-fx-pre]')); };
  const skip = (e) => !!e.closest('[aria-hidden="true"],.lp-hero-graphic,.lp-closing-graphic,.fx-layer,.lp-sr,.fx-sr,dialog:not([open]),[hidden],script,style,noscript,svg');
  const ownText = (e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
  const label = (e) => { const t = (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40); const c = (typeof e.className === 'string' && e.className.trim()) ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''; return `${e.tagName.toLowerCase()}${c}${t ? ` "${t}"` : ''}`; };
  const all = [...document.querySelectorAll('body *')].filter((e) => !skip(e) && vis(e));
  const px = (v) => parseFloat(v) || 0;
  const opaque = (c) => c && c !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(c);
  const out = {};
  const add = (rule, e, extra) => { (out[rule] ||= []).push(extra || label(e)); };
  const INTERACTIVE = 'a,button,input,select,textarea,label,summary,[role=tab],[role=button]';

  // 상자(카드) 찾기: 둘레가 있고(배경이 부모와 다르거나 네 변 테두리) 모서리가 둥글거나 그림자가 있는, 글을 담은 큰 덩어리
  const isCard = (e) => {
    if (/^(BUTTON|INPUT|SELECT|TEXTAREA|IMG|VIDEO|CANVAS|A|LABEL|SUMMARY|DIALOG|PROGRESS|svg)$/i.test(e.tagName)) return false;
    if (e.closest('dialog,.lp-dock,.lp-nav,.lp-now,.lp-toast,.lp-qr,.fx-toggle')) return false;
    const r = e.getBoundingClientRect(); if (r.width < 120 || r.height < 56) return false;
    const s = getComputedStyle(e);
    if (s.position === 'fixed') return false;
    const bw = ['Top', 'Right', 'Bottom', 'Left'].map((k) => px(s[`border${k}Width`]) > 0 && s[`border${k}Style`] !== 'none');
    const allBorders = bw.every(Boolean);
    const p = e.parentElement; const pbg = p ? getComputedStyle(p).backgroundColor : '';
    const ownBg = opaque(s.backgroundColor) && s.backgroundColor !== pbg;
    const shadow = s.boxShadow && s.boxShadow !== 'none' && !/inset/.test(s.boxShadow);
    const pad = Math.min(px(s.paddingTop), px(s.paddingLeft));
    return (allBorders || ownBg || shadow) && pad >= 8 && (px(s.borderTopLeftRadius) >= 4 || shadow || allBorders) && (e.innerText || '').trim().length > 0;
  };
  const cards = new Set(all.filter(isCard));
  for (const c of cards) {
    let d = 0; for (let a = c.parentElement; a; a = a.parentElement) if (cards.has(a)) d++;
    if (d >= 1) add('nested-cards', c, `${label(c)} (${d + 1}겹)`);
  }
  // 같은 크기 상자 셋 이상 나란히
  const parents = new Set([...cards].map((c) => c.parentElement));
  for (const p of parents) {
    const kids = [...p.children].filter((k) => cards.has(k));
    if (kids.length < 3) continue;
    const rs = kids.map((k) => k.getBoundingClientRect());
    const rows = new Set(rs.map((r) => Math.round(r.top / 8)));
    const sameW = rs.every((r) => Math.abs(r.width - rs[0].width) < 4);
    if (sameW && rows.size < kids.length) add('uniform-card-grid', p, `${label(p)} (상자 ${kids.length}개)`);
  }

  for (const e of all) {
    const s = getComputedStyle(e), r = e.getBoundingClientRect();
    // 한쪽 색 띠: 왼쪽·오른쪽 한 변만 2px 넘는 테두리, 또는 inset 그림자로 그린 띠
    const L = px(s.borderLeftWidth), R = px(s.borderRightWidth), T = px(s.borderTopWidth), B = px(s.borderBottomWidth);
    const side = (L >= 2 && L > T + 0.5 && L > R + 0.5 && s.borderLeftStyle !== 'none') || (R >= 2 && R > T + 0.5 && R > L + 0.5 && s.borderRightStyle !== 'none');
    const insetStripe = /inset\s+-?[2-9]\d*px\s+0(px)?\s+0(px)?/.test(s.boxShadow) && r.height > 24;
    // 색이 있는 띠이거나(채도), 배경·둥근 모서리가 있는 상자에 붙은 띠만 셈(무채색 단 나눔 선은 제외)
    const sc = side ? (L > R ? s.borderLeftColor : s.borderRightColor) : (s.boxShadow.match(/rgba?\([^)]*\)/) || [''])[0];
    const ch = (sc.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number); const chroma = ch.length === 3 ? Math.max(...ch) - Math.min(...ch) : 0;
    const boxy = opaque(s.backgroundColor) || px(s.borderTopLeftRadius) > 0;
    if ((side || insetStripe) && (chroma > 40 || boxy) && r.height > 20 && r.width > 40 && (e.innerText || '').trim()) add('side-stripe', e);
    // 알약 꼬리표: 높이 14~40px, 반지름 ≥ 높이/2, 배경·테두리, 글 있음, 누르는 것이 아님
    const rad = px(s.borderTopLeftRadius);
    if (r.height >= 14 && r.height <= 40 && rad >= r.height / 2 - 1 && r.width > r.height * 1.3 && (opaque(s.backgroundColor) || T > 0) && (e.innerText || '').trim() && !e.matches(INTERACTIVE) && !e.closest(INTERACTIVE)) add('pill-chip', e);
    // 그라데이션 글자
    const clip = s.webkitBackgroundClip || s.backgroundClip;
    if ((clip === 'text' && /gradient/.test(s.backgroundImage)) || (s.webkitTextFillColor === 'rgba(0, 0, 0, 0)' && /gradient/.test(s.backgroundImage))) add('gradient-text', e);
    // 이모지를 아이콘으로: 제 글이 이모지·장식 글리프뿐이거나, 제목·단추·목록 글이 이모지로 시작
    const t = ownText(e);
    if (t && !e.closest('[data-react],.lp-react,.lp-reactions,.lp-signal,textarea,.lp-cloud,.lp-post,.lp-qa-item')) {
      const pict = /\p{Extended_Pictographic}/u;
      const only = /^[\p{Extended_Pictographic}☀-➿⬀-⯿️‍\s✦✧★☆●◆■▶►✔✓]+$/u;
      if ((only.test(t) && t.length <= 4) || (pict.test(t.slice(0, 2)) && e.matches('h1,h2,h3,h4,button,a,li,dt,summary,label,legend,th'))) add('emoji-icon', e, `${label(e)} "${t.slice(0, 12)}"`);
    }
  }
  // CSS ::before/::after 장식 글리프
  for (const e of all) for (const pe of ['::before', '::after']) {
    const c = getComputedStyle(e, pe).content;
    if (c && c !== 'none' && c !== 'normal' && /\p{Extended_Pictographic}|[✦✧★☆]/u.test(c)) add('emoji-icon', e, `${label(e)}${pe} ${c}`);
  }

  // 글자 크기: 본문 크기(문단 글자 수로 가중), 제목 비율, 가짓수
  const sizeW = new Map(); const sizes = new Set();
  for (const e of all) {
    const t = ownText(e); if (!t || e.closest('[data-react],.lp-react,.lp-slide,.lp-deck-thumbs,.lp-qr')) continue;
    const fs = Math.round(px(getComputedStyle(e).fontSize) * 2) / 2;
    sizes.add(fs);
    if (e.closest('p,li,dd') && !e.closest('h1,h2,h3,button,.lp-btn,nav,.lp-nav')) sizeW.set(fs, (sizeW.get(fs) || 0) + t.length);
  }
  const body = [...sizeW.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 16;
  const hs = (sel) => { const xs = [...document.querySelectorAll(sel)].filter((e) => !skip(e) && vis(e)).map((e) => px(getComputedStyle(e).fontSize)); return xs.length ? Math.max(...xs) : 0; };
  const h1 = hs('h1'), h2s = [...document.querySelectorAll('main h2,section > .lp-wrap > .lp-head h2')].filter((e) => !skip(e) && vis(e)).map((e) => px(getComputedStyle(e).fontSize));
  const h2 = h2s.length ? h2s.sort((a, b) => a - b)[Math.floor(h2s.length / 2)] : 0;
  if (h2 && h2 / body < 1.6) out['heading-ratio'] = [`섹션 제목 ${h2}px ÷ 본문 ${body}px = ${(h2 / body).toFixed(2)}`];
  if (h1 && h1 / body < 2.2) (out['heading-ratio'] ||= []).push(`첫 제목 ${h1}px ÷ 본문 ${body}px = ${(h1 / body).toFixed(2)}`);
  if (sizes.size > 12) out['font-sizes'] = [`${sizes.size}가지: ${[...sizes].sort((a, b) => a - b).join(', ')}px`];

  // 한 줄 길이: 글자 평균 폭으로 한 줄에 들어가는 글자 수를 셈(한국어 40자, 그 밖 80자)
  const cv = document.createElement('canvas').getContext('2d');
  let maxCpl = 0;
  for (const e of all.filter((x) => x.matches('p,li,dd,blockquote') && !x.querySelector('p,div,h1,h2,h3,h4,ul,ol,dl,fieldset') && !x.closest('nav,button,.lp-btn,.lp-qr,figcaption,.lp-slide,.lp-formula'))) {
    const t = (e.innerText || '').trim(); if (t.length < 60) continue;
    const s = getComputedStyle(e); const w = e.clientWidth - px(s.paddingLeft) - px(s.paddingRight); if (w < 200) continue;
    if (e.getBoundingClientRect().height < px(s.lineHeight) * 1.8) continue; // 한 줄짜리는 길이와 상관없음
    cv.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    const cw = cv.measureText(t).width / t.length; if (!cw) continue;
    const cpl = Math.round(w / cw);
    const ko = (t.match(/[가-힣]/g) || []).length / t.length > 0.3;
    maxCpl = Math.max(maxCpl, cpl);
    if (cpl > (ko ? 45 : 85)) add('line-length', e, `${label(e)} (한 줄 약 ${cpl}자)`);
  }

  // 단추·메뉴·라벨 글: 길거나 '(을)를' 같은 틀 말투
  for (const e of all.filter((x) => x.matches('button,.lp-btn,a.lp-link,.lp-nav-links a,[role=tab],label > span:first-child,summary,legend,th,dt'))) {
    const t = (e.innerText || '').trim().replace(/\s+/g, ' '); if (!t || e.closest('.lp-faq,.lp-quiz,.lp-sv-list,.lp-poll-list,.lp-deck-thumbs,.lp-overview,.lp-slide')) continue;
    const isAction = e.matches('button,.lp-btn,a.lp-link,.lp-nav-links a,[role=tab]');
    const len = [...t].length;
    if ((isAction && len > 16) || (!isAction && len > 40) || /\((을|를|이|가|은|는|와|과)\)/.test(t) || /하시기 바랍니다|해 주시기 바랍니다|클릭하세요/.test(t)) add('long-label', e, `${label(e)} (${len}자)`);
  }

  // 같은 배치가 셋 넘게 줄지어: 틀(data-frame) + 배치 가족(data-layout)이 같고, 머리가 실제로 같은 자리(왼쪽/위)에 놓인 섹션
  const FAM = { timeline: 'rows', accordion: 'rows', files: 'rows', course: 'rows' };
  const secs = [...document.querySelectorAll('main > section[data-layout]')].filter((e) => vis(e));
  const sig = secs.map((sec) => {
    const hd = sec.querySelector(':scope > .lp-wrap > .lp-head'); const body = hd && hd.nextElementSibling;
    const side = hd && body && hd.getBoundingClientRect().right <= body.getBoundingClientRect().left + 1 ? 'L' : 'T';
    return `${sec.getAttribute('data-frame')}/${FAM[sec.getAttribute('data-layout')] || sec.getAttribute('data-layout')}/${side}`;
  });
  for (let i = 2; i < sig.length; i++) if (sig[i] === sig[i - 1] && sig[i] === sig[i - 2]) add('layout-repeat', secs[i], `#${secs[i].id} (${sig[i]} ×3)`);

  const pills = (out['pill-chip'] || []).length;
  return { out, metrics: { cards: cards.size, pills, stripes: (out['side-stripe'] || []).length, gradientText: (out['gradient-text'] || []).length, bodyPx: body, h1Px: h1, h2Px: h2, h2Ratio: h2 ? +(h2 / body).toFixed(2) : 0, fontSizes: sizes.size, maxCpl } };
}

/** Playwright Page 하나 검사 → { findings, metrics } */
export async function lintPage(page) {
  const { out, metrics } = await page.evaluate(inPage);
  const findings = Object.entries(out).map(([rule, samples]) => ({ rule, level: RULES[rule]?.level || 'warn', count: samples.length, message_ko: RULES[rule]?.ko || rule, samples: [...new Set(samples)].slice(0, 6) }))
    .sort((a, b) => (a.level === b.level ? b.count - a.count : a.level === 'error' ? -1 : 1));
  return { findings, metrics };
}

// ── CLI ───────────────────────────────────────────────
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff' };
function serve(root) {
  const base = resolve(root);
  const srv = createServer(async (req, res) => {
    try {
      const p = resolve(join(base, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
      if (p !== base && !p.startsWith(base + sep)) { res.writeHead(403).end(); return; }
      const f = (await stat(p)).isDirectory() ? join(p, 'index.html') : p;
      res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }).end(await readFile(f));
    } catch { res.writeHead(404).end(); }
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)));
}
async function loadPlaywright() {
  for (const from of [import.meta.url, pathToFileURL(process.cwd() + '/').href]) {
    try { return createRequire(from)('playwright'); } catch { /* 다음 */ }
  }
  try { return await import('playwright'); } catch { return null; }
}

async function main(argv) {
  const args = argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--'));
  const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
  if (!dir) { console.error('사용법: node design-lint.mjs <사이트 폴더> [--json] [--pages index.html] [--width 1280,390]'); process.exit(2); }
  const pw = await loadPlaywright();
  if (!pw) { console.error('Playwright가 없어요. npm i -D playwright && npx playwright install chromium 뒤 다시 실행하세요.'); process.exit(2); }
  const pages = (opt('pages', '') || (await readdir(dir)).filter((f) => f === 'index.html').join(',') || 'index.html').split(',').filter(Boolean);
  const widths = opt('width', '1280,390').split(',').map(Number).filter(Boolean);
  const srv = await serve(dir); const port = srv.address().port;
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
  const browser = await pw.chromium.launch({ proxy });
  const report = [];
  try {
    for (const name of pages) for (const w of widths) {
      const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, isMobile: w < 600, hasTouch: w < 600, locale: 'ko-KR' });
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${port}/${name}`, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(800);
      const r = await lintPage(page);
      report.push({ page: name, width: w, ...r });
      await ctx.close();
    }
  } finally { await browser.close(); srv.close(); }
  const errors = report.reduce((n, r) => n + r.findings.filter((f) => f.level === 'error').reduce((m, f) => m + f.count, 0), 0);
  if (args.includes('--json')) console.log(JSON.stringify({ errors, report }, null, 1));
  else {
    for (const r of report) {
      const m = r.metrics;
      console.log(`\n■ ${r.page} · 폭 ${r.width}px — 상자 ${m.cards} · 알약 ${m.pills} · 색 띠 ${m.stripes} · 그라데이션 글자 ${m.gradientText} · 본문 ${m.bodyPx}px · 섹션 제목 ${m.h2Px}px(${m.h2Ratio}배) · 크기 ${m.fontSizes}가지 · 한 줄 최대 ${m.maxCpl}자`);
      if (!r.findings.length) console.log('  문제 없음');
      for (const f of r.findings) console.log(`  ${f.level === 'error' ? '✗' : '!'} ${f.rule} ×${f.count} — ${f.message_ko}\n      ${f.samples.slice(0, 3).join('\n      ')}`);
    }
    console.log(`\n오류 ${errors}개`);
  }
  process.exitCode = errors ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main(process.argv);
