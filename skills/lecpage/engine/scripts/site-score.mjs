#!/usr/bin/env node
// 완성된 연수 사이트 폴더 하나를 채점해 JSON으로 냅니다. 어떤 도구로 만든 사이트든 같은 규칙으로 봅니다.
// (만든 도구의 표식 — 특정 id·class·파일 이름 — 에 기대지 않고, 화면의 글·표준 HTML 요소·브라우저가 잰 값만 씁니다.)
//
//   node site-score.mjs <사이트 폴더> [--facts facts.json] [--entry index.html] [--out score.json] [--label 이름]
//        [--input-tokens N --output-tokens N --duration-ms N --tool-uses N --human-turns N]   실행 기록에서 뽑은 값
//        [--price-in 달러/100만 토큰 --price-out 달러/100만 토큰]                            비용 환산
//        [--edit "이름:입력토큰:출력토큰:걸린ms"]…                                          한 곳 고치기 측정(여러 번)
//        [--axe axe.min.js 경로]                                                             없으면 axe-core 패키지를 찾고, 그것도 없으면 내장 검사만
//   node site-score.mjs --compare a.json b.json                                              같은 요청 두 번의 차이(일관성)
//
// facts.json: { "facts":[{"kind":"단계","text":"…","any":["같은 뜻 다른 표기"]}], "source":{"text":"교재 전체 글","urls":["https://…"]} }
// 필요: Playwright(없으면 화면 검사를 건너뛰고 그렇게 적습니다). NODE_PATH=$(npm root -g) 로 전역 설치본을 쓸 수 있습니다.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, extname, relative, sep } from 'node:path';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';

const VERSION = 1;
const argv = process.argv.slice(2);
const opt = (k, d = '') => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const optAll = (k) => argv.flatMap((a, i) => (a === k && argv[i + 1] !== undefined ? [argv[i + 1]] : []));
const num = (k) => { const v = opt(k, ''); return v === '' ? null : Number(v); };

// ── 글 맞춰 보기 ─────────────────────────────────────────
export const norm = (s) => String(s || '').normalize('NFC').replace(/[\s​ ]+/g, '').replace(/[“”″]/g, '"').replace(/[‘’′]/g, "'").replace(/[–—]/g, '-').toLowerCase();
/** 날짜는 표기가 여럿이라 같은 날이면 찾은 것으로: 2026. 12. 3. / 2026-12-03 / 12월 3일 / 12. 3.(목) */
function dateForms(s) {
  const m = /((?:19|20)\d{2})\D{1,3}(\d{1,2})\D{1,3}(\d{1,2})/.exec(s);
  if (!m) return [];
  const [y, mo, d] = [m[1], +m[2], +m[3]];
  return [`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`, `${y}.${mo}.${d}`, `${y}년${mo}월${d}일`, `${mo}월${d}일`, `${mo}.${d}.`, `${mo}/${d}`];
}
export function hasFact(hay, fact) {
  const forms = [fact.text, ...(fact.any || [])].filter(Boolean);
  for (const f of forms) { if (hay.includes(norm(f))) return true; for (const d of dateForms(f)) if (hay.includes(norm(d))) return true; }
  return false;
}
const urlKey = (u) => { try { const x = new URL(u); return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '')).toLowerCase(); } catch { return ''; } };
// 숫자+단위(시간·인원·비율·날짜·시각). 단위 없는 숫자(번호·순서)는 보지 않음
const NUM_RE = /\d[\d,.]*\s?(?:시간|분|초|명|개|쪽|장|회|차시|주|일|개월|월|년|%|퍼센트|원|대|자|문항|단계|가지|학년|교시|점|배)|\d{1,2}:\d{2}/g;
const numKey = (t) => t.replace(/[\s,]/g, '');

// ── 사이트 폴더 ─────────────────────────────────────────
function walk(dir, base = dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n); const st = statSync(p);
    if (st.isDirectory()) { if (n !== 'node_modules' && !n.startsWith('.')) walk(p, base, out); } else out.push({ path: relative(base, p).split(sep).join('/'), size: st.size });
  }
  return out;
}
const KIND = { '.html': 'html', '.htm': 'html', '.js': 'js', '.mjs': 'js', '.css': 'css', '.png': 'img', '.jpg': 'img', '.jpeg': 'img', '.webp': 'img', '.gif': 'img', '.svg': 'img', '.avif': 'img', '.woff2': 'font', '.woff': 'font', '.ttf': 'font', '.otf': 'font' };
const MIME = { '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8' };
function serve(dir) {
  const srv = createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = resolve(dir, '.' + p);
    if (!f.startsWith(resolve(dir)) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[extname(f).toLowerCase()] || 'application/octet-stream' });
    res.end(readFileSync(f));
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)));
}
async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 아래 */ }
  try { return createRequire(import.meta.url)('playwright'); } catch { /* 아래 */ }
  try { return createRequire(join(process.cwd(), 'x.js'))('playwright'); } catch { return null; }
}
function findAxe() {
  const given = opt('--axe', '');
  if (given && existsSync(given)) return readFileSync(given, 'utf8');
  for (const base of [import.meta.url, join(process.cwd(), 'x.js')]) {
    try { return readFileSync(createRequire(base).resolve('axe-core/axe.min.js'), 'utf8'); } catch { /* 다음 */ }
  }
  return '';
}

// ── 화면에서 재는 것(브라우저 안에서 실행) ─────────────────
/* eslint-disable no-undef */
function probePage() {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const text = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const body = document.body;
  // 접힌 곳(details)은 펼쳐서 읽음. 탭·아코디언처럼 스크립트로 숨긴 글은 DOM 글(domText)로 따로 봄
  document.querySelectorAll('details').forEach((d) => { d.open = true; });
  const clone = body.cloneNode(true);
  clone.querySelectorAll('script,style,template,noscript').forEach((n) => n.remove());
  const domText = clone.textContent || '';
  const visibleText = body.innerText || '';
  const name = (el) => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.value || (el.querySelector('img[alt]') || {}).alt || '').replace(/\s+/g, ' ').trim();
  const controls = [...document.querySelectorAll('button, [role=button], a[href], input[type=button], input[type=submit], summary')];
  // 꺼져 있거나 숨긴 기능의 버튼은 세지 않음(첫 화면을 연 상태에서 보이는 것만. 접힌 details는 위에서 펼침)
  const ctlNames = controls.filter(vis).map(name).filter(Boolean);
  // "곁에 있다" = 그 요소의 이름표(aria-label·placeholder·label)나, 그 요소를 감싼 가장 가까운 구역(section·form·fieldset·article·dialog)의 첫 제목이 낱말을 담고 있음
  const ctxOf = (el) => {
    const out = [el.getAttribute('aria-label'), el.getAttribute('placeholder'), el.getAttribute('title'), el.innerText];
    if (el.id) { const lb = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (lb) out.push(lb.innerText); }
    const wrap = el.closest('label'); if (wrap) out.push(wrap.innerText);
    const box = el.closest('section, form, fieldset, article, dialog, [role=region], [role=dialog], [role=group]');
    if (box) { out.push(box.getAttribute('aria-label')); const h = box.querySelector('h1,h2,h3,h4,legend'); if (h) out.push(h.innerText); }
    return out.filter(Boolean).join(' | ').slice(0, 300);
  };
  const near = (re, sel) => [...document.querySelectorAll(sel)].some((el) => vis(el) && re.test(ctxOf(el)));
  // 시간표: 시각이 셋 넘게 든 표·목록
  const TIME = /\b\d{1,2}:\d{2}\b/g;
  const timeBlocks = [...document.querySelectorAll('table, ol, ul, dl, section, [role=list]')].map((el) => ((el.innerText || '').match(TIME) || []).length);
  const stepLists = [...document.querySelectorAll('ol')].filter((ol) => ol.querySelectorAll(':scope > li').length >= 3).length;
  const headings = [...document.querySelectorAll('h1,h2,h3')].map((h) => ({ level: +h.tagName[1], text: text(h).slice(0, 60) })).filter((h) => h.text);
  const links = [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.href, raw: a.getAttribute('href') || '', text: name(a).slice(0, 60), download: a.hasAttribute('download') }));
  const imgs = [...document.querySelectorAll('img')].filter((im) => im.getAttribute('aria-hidden') !== 'true' && im.getAttribute('role') !== 'presentation');
  const qrLike = [...document.querySelectorAll('img, canvas, svg')].some((el) => /qr/i.test([el.getAttribute('alt'), el.getAttribute('aria-label'), el.getAttribute('title')].filter(Boolean).join(' '))) || /QR\s*(코드)?/i.test(visibleText);
  // 인쇄·움직임 줄이기·어두운 화면 규칙(읽을 수 있는 스타일시트만)
  let print = false, reduce = false, dark = false;
  for (const ss of document.styleSheets) { let rules; try { rules = ss.cssRules; } catch { continue; } for (const r of rules || []) { const m = r.media && r.media.mediaText || ''; if (/print/.test(m)) print = true; if (/prefers-reduced-motion/.test(m)) reduce = true; if (/prefers-color-scheme/.test(m)) dark = true; } }
  // 가로 넘침: 스스로 가로 스크롤하는 상자 안의 것은 뺌
  const scrollerInside = (el) => { for (let n = el.parentElement; n && n !== body; n = n.parentElement) { const o = getComputedStyle(n).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true; } return false; };
  const overflow = [...body.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right > innerWidth + 1 && getComputedStyle(el).position !== 'fixed' && !scrollerInside(el); }).length;
  // 내장 접근성 검사
  const labelled = (el) => !!(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || el.getAttribute('placeholder') || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.closest('label'));
  let headingSkips = 0; for (let i = 1; i < headings.length; i++) if (headings[i].level > headings[i - 1].level + 1) headingSkips++;
  // 글자 대비(단색 바탕만 판정, 그림·그라데이션 위 글자는 '모름')
  const parse = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  // 화면 낭독기에서 숨긴 꾸밈 글자(aria-hidden, 큰 윤곽 숫자·글자)는 WCAG 1.4.3 예외라 대비를 보지 않고 따로 셈(axe와 같은 기준)
  let low = 0, unknown = 0, checked = 0, decorative = 0;
  const seen = new Set();
  const tw = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n && checked < 1500; n = tw.nextNode()) {
    const el = n.parentElement; if (!el || seen.has(el) || !n.nodeValue.trim() || !vis(el)) continue; seen.add(el);
    if (el.closest('[aria-hidden="true"]')) { decorative++; continue; }
    const cs = getComputedStyle(el); if (+cs.opacity < 0.9) { unknown++; continue; }
    const fg = parse(cs.color); if (!fg) continue;
    let bg = null, bad = false;
    for (let a = el; a; a = a.parentElement) { const s = getComputedStyle(a); if (s.backgroundImage && s.backgroundImage !== 'none') { bad = true; break; } const c = parse(s.backgroundColor); if (c && c.a > 0) { bg = bg ? over(bg, c) : c; if (c.a >= 1) break; } }
    if (bad) { unknown++; continue; }
    if (!bg || bg.a < 1) bg = bg ? over(bg, { r: 255, g: 255, b: 255, a: 1 }) : { r: 255, g: 255, b: 255, a: 1 };
    const f = fg.a < 1 ? over(fg, bg) : fg;
    const [l1, l2] = [lum(f), lum(bg)].sort((x, y) => y - x); const ratio = (l1 + 0.05) / (l2 + 0.05);
    const px = parseFloat(cs.fontSize); const large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
    checked++; if (ratio < (large ? 3 : 4.5)) low++;
  }
  return {
    title: document.title, lang: document.documentElement.getAttribute('lang') || '', domText, visibleText, headings, links, ctlNames,
    counts: {
      checkbox: document.querySelectorAll('input[type=checkbox], [role=checkbox]').length,
      radio: document.querySelectorAll('input[type=radio], [role=radio]').length,
      textInputs: document.querySelectorAll('textarea, input[type=text], input:not([type])').length,
      forms: document.querySelectorAll('form').length, iframes: document.querySelectorAll('iframe').length,
      images: imgs.length, timeMax: Math.max(0, ...timeBlocks), stepLists, tables: document.querySelectorAll('table').length,
    },
    near: {
      copyNearCode: [...document.querySelectorAll('button, [role=button]')].some((b) => vis(b) && /복사|copy/i.test(name(b))) && /프롬프트|prompt/i.test(visibleText),
      inputNearQuestion: near(/질문|Q&A|묻고/i, 'textarea, input[type=text], input:not([type])'),
      choiceNearPoll: near(/투표|poll/i, 'input[type=radio], input[type=checkbox], button'),
      inputNearSurvey: near(/설문|만족도/i, 'textarea, input, select'),
      checkNearReady: near(/준비물|준비\s*(점검|사항|해요|하기|할\s*것)|사전\s*준비|미리\s*준비|체크리스트|시작\s*전에/i, 'input[type=checkbox], [role=checkbox]'),
    },
    qrLike, css: { print, reduce, dark }, overflow, horizontalScroll: document.documentElement.scrollWidth > innerWidth + 1,
    a11y: { imgNoAlt: imgs.filter((im) => !im.hasAttribute('alt')).length, controlsNoName: controls.filter((c) => vis(c) && !name(c)).length, inputsNoLabel: [...document.querySelectorAll('input:not([type=hidden]):not([type=button]):not([type=submit]), textarea, select')].filter((el) => vis(el) && !labelled(el)).length, headingSkips, h1: document.querySelectorAll('h1').length, lowContrast: low, contrastUnknown: unknown, contrastChecked: checked, contrastDecorative: decorative },
    animations: (document.getAnimations ? document.getAnimations() : []).filter((a) => a.playState === 'running').length,
  };
}
/* eslint-enable no-undef */

// ── 연수 기능 체크(전·중·후) ─────────────────────────────
// 판정은 글과 표준 요소로만. "있다고 적혀만 있는지, 실제로 쓸 수 있는지"가 갈리는 항목은 human:true(사람 확인)로 표시합니다.
const EXT_FORM = /forms\.gle|docs\.google\.com\/forms|form\.office\.com|forms\.office\.com|naver\.me|form\.naver\.com|surveymonkey|typeform|tally\.so/i;
const FILE_LINK = /\.(pdf|pptx?|hwpx?|docx?|xlsx?|zip)(\?|#|$)/i;
function featureChecks(pages, files) {
  const all = (f) => pages.some(f);
  const T = (re) => all((p) => re.test(p.visibleText));
  const C = (re) => all((p) => p.ctlNames.some((t) => re.test(t)));
  const L = (f) => all((p) => p.links.some(f));
  const entry = pages[0];
  const otherPages = pages.slice(1);
  const R = [];
  const add = (id, phase, label, present, how, human = false) => R.push({ id, phase, label, present: !!present, how, human });
  // 전
  add('datetime', '전', '일시', T(/(?:19|20)\d{2}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}|\d{1,2}월\s*\d{1,2}일/) && T(/\b\d{1,2}:\d{2}\b|\d{1,2}시/), '날짜와 시각이 화면 글에 있음');
  add('venue', '전', '장소', T(/(장소|오시는\s*길|위치|곳)\s*[:：]?\s*\S/) || L((l) => /map\.|maps\.|kko\.to|naver\.me/.test(l.href)), '"장소·오시는 길" 뒤에 글이 있거나 지도 링크');
  add('goals', '전', '연수 목표', T(/(연수|학습|교육)\s*(목표|목적)|이\s*연수를\s*마치면|마치면\s*할\s*수/) || all((p) => (p.visibleText.match(/할\s*수\s*있(어요|습니다|다)/g) || []).length >= 2), '"목표" 제목 또는 "~할 수 있다" 문장 2개 이상');
  add('schedule', '전', '일정표', all((p) => p.counts.timeMax >= 3), '한 표·목록 안에 시각(HH:MM)이 3개 이상');
  add('readiness', '전', '준비물 안내', T(/준비물|준비\s*(점검|사항|해요|하기|할\s*것)|사전\s*준비|미리\s*준비|체크리스트|시작\s*전에/), '"준비물·준비 점검·시작 전에" 글');
  add('readinessCheck', '전', '준비 점검(체크할 수 있음)', all((p) => p.near.checkNearReady), '준비 안내 곁에 체크박스');
  add('contact', '전', '강사·문의처', T(/강사|발표자|연사/) && T(/문의|연락처/), '"강사·발표자"와 "문의·연락처" 글');
  // 중
  add('steps', '중', '실습 단계', all((p) => p.counts.stepLists >= 1) && T(/실습|활동|따라\s*하|단계|절차/), '항목 3개 이상인 번호 목록(ol)과 "실습·단계·절차" 글');
  add('promptCopy', '중', '프롬프트 복사', all((p) => p.near.copyNearCode) || (T(/프롬프트|prompt/i) && C(/복사|copy/i)), '"프롬프트" 곁에 "복사" 버튼', true);
  add('doneCheck', '중', '실습 완료 체크', all((p) => p.counts.checkbox >= 1) && (C(/완료|했어요|done/i) || T(/완료|여기까지/)), '체크박스 또는 "완료" 버튼');
  add('deck', '중', '교재 보기', T(/교재\s*보기|슬라이드|발표\s*자료/) && all((p) => p.counts.images >= 3 || p.counts.iframes >= 1), '"교재 보기·발표 자료" 글과 쪽 그림 3장 이상 또는 끼워 넣은 문서');
  add('materials', '중', '자료실(받을 수 있는 자료)', L((l) => l.download || FILE_LINK.test(l.raw)) , '내려받기 링크(download 속성 또는 문서 파일 주소)');
  add('qa', '중', '질문 받기', all((p) => p.near.inputNearQuestion), '"질문" 곁에 글 입력 칸(안내 글만 있으면 없음)', true);
  add('poll', '중', '투표', all((p) => p.near.choiceNearPoll) && T(/투표|poll/i), '"투표" 곁에 고르는 버튼·선택 칸', true);
  add('help', '중', '도움 요청', C(/도움\s*요청|도와\s*주세요|손들기/), '"도움 요청" 버튼', true);
  add('faq', '중', 'FAQ·용어', T(/자주\s*묻는\s*질문|FAQ|용어/i), '"자주 묻는 질문·용어" 글');
  // 후
  add('survey', '후', '설문', L((l) => EXT_FORM.test(l.href)) || (all((p) => p.near.inputNearSurvey) && T(/설문|만족도/)), '설문 서비스 링크 또는 "설문" 곁에 입력 칸');
  add('followup', '후', '연수 후 안내', T(/연수\s*후|다시\s*보기|이수|후속|더\s*읽을|참고\s*자료/), '"연수 후·다시 보기·이수·참고 자료" 글');
  add('qrShare', '후', 'QR·공유', all((p) => p.qrLike) || C(/공유|링크\s*복사|주소\s*복사/), 'QR 그림 또는 "공유·주소 복사" 버튼');
  add('print', '후', '인쇄', all((p) => p.css.print) || C(/인쇄|print/i), '인쇄용 스타일(@media print) 또는 인쇄 버튼');
  // 운영
  add('presenter', '운영', '강사·발표 화면(따로 있는 쪽)', otherPages.some((p) => /강사|진행자|발표\s*화면|관리|presenter|console|admin/i.test(p.title + ' ' + p.headings.map((h) => h.text).join(' '))), '첫 쪽 말고 "강사·발표 화면" 제목의 쪽이 따로 있음', true);
  add('multiPage', '운영', '안내문·접속 확인 등 딸린 쪽', files.filter((f) => /\.html?$/i.test(f.path)).length >= 2, 'HTML 쪽이 둘 이상');
  add('darkMode', '운영', '어두운 화면', entry.css.dark, 'prefers-color-scheme 규칙');
  return R;
}

// ── 채점 ───────────────────────────────────────────────
async function score(dir) {
  const files = walk(dir);
  const entryName = opt('--entry', 'index.html');
  if (!existsSync(join(dir, entryName))) throw new Error(`첫 쪽이 없어요: ${join(dir, entryName)}`);
  const bytes = { total: 0, html: 0, js: 0, css: 0, img: 0, font: 0, other: 0 };
  for (const f of files) { const k = KIND[extname(f.path).toLowerCase()] || 'other'; bytes[k] += f.size; bytes.total += f.size; }
  const htmlPages = [entryName, ...files.map((f) => f.path).filter((p) => /\.html?$/i.test(p) && p !== entryName && !p.includes('/')).sort()].slice(0, 12);
  const res = { tool: 'site-score', version: VERSION, label: opt('--label', ''), site: { dir: resolve(dir), entry: entryName, pages: htmlPages, files: files.length, bytes }, run: runInfo(), edits: editInfo(), notes: [] };
  const pw = await loadPlaywright();
  if (!pw) { res.notes.push('Playwright가 없어 화면 검사를 건너뜀(교재 반영률·기능·품질 없음)'); return res; }
  const srv = await serve(dir);
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await pw.chromium.launch();
  const pages = [];
  const quality = { phone360: null, a11y: null, reducedMotion: null, requests: null, errors: null };
  try {
    const axeSrc = findAxe();
    for (const [i, name] of htmlPages.entries()) {
      const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const reqs = []; const errs = [];
      page.on('request', (r) => reqs.push(r.url()));
      page.on('pageerror', (e) => errs.push(String(e.message || e).slice(0, 160)));
      page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
      let transferred = 0;
      page.on('response', async (r) => { try { const b = await r.body(); transferred += b.length; } catch { /* 본문 없는 응답 */ } });
      await page.goto(base + name, { waitUntil: 'load' });
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(400);
      const p = await page.evaluate(probePage);
      p.file = name; pages.push(p);
      if (i === 0) {
        const external = reqs.filter((u) => /^https?:/.test(u) && !u.startsWith(base));
        quality.requests = { total: reqs.length, external: external.length, externalHosts: [...new Set(external.map((u) => { try { return new URL(u).host; } catch { return u; } }))], transferredBytes: transferred };
        quality.errors = { count: errs.length, first: errs.slice(0, 3) };
        quality.phone360 = { overflowElements: p.overflow, horizontalScroll: p.horizontalScroll };
        let axe = null;
        if (axeSrc) {
          try {
            const ctxA = await browser.newContext({ viewport: { width: 360, height: 780 }, bypassCSP: true });
            const pageA = await ctxA.newPage();
            await pageA.goto(base + name, { waitUntil: 'load' }); await pageA.waitForTimeout(600);
            await pageA.addScriptTag({ content: axeSrc });
            // eslint-disable-next-line no-undef
            const r = await pageA.evaluate(async () => { const x = await axe.run(document, { resultTypes: ['violations'] }); return x.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })); });
            axe = { critical: 0, serious: 0, moderate: 0, minor: 0, rules: r.length, nodes: r.reduce((n, v) => n + v.nodes, 0), top: r.sort((a, b) => b.nodes - a.nodes).slice(0, 8) };
            for (const v of r) if (axe[v.impact] !== undefined) axe[v.impact] += 1;
            await ctxA.close();
          } catch (e) { res.notes.push('axe 실행 실패: ' + String(e.message || e).slice(0, 120)); }
        } else res.notes.push('axe-core가 없어 내장 접근성 검사만 함(--axe 경로 또는 axe-core 패키지)');
        quality.a11y = { axe, builtin: { ...p.a11y, lang: !!p.lang } };
        // 움직임 줄이기: 같은 쪽을 설정을 켠 채 다시 열어 돌아가는 애니메이션 수를 견줌
        const ctx2 = await browser.newContext({ viewport: { width: 360, height: 780 }, reducedMotion: 'reduce' });
        const page2 = await ctx2.newPage();
        await page2.goto(base + name, { waitUntil: 'load' }); await page2.waitForTimeout(700);
        // eslint-disable-next-line no-undef
        const reduced = await page2.evaluate(() => (document.getAnimations ? document.getAnimations() : []).filter((a) => a.playState === 'running').length);
        await ctx2.close();
        quality.reducedMotion = { animationsDefault: p.animations, animationsReduced: reduced, hasRule: p.css.reduce, ok: reduced === 0 || reduced < p.animations || p.animations === 0 };
      }
      await ctx.close();
    }
  } finally { await browser.close(); srv.close(); }

  // 교재 반영률·지어낸 것
  const factsPath = opt('--facts', '');
  // 화면 글 + 링크 주소(주소는 글자로 안 보여도 누르면 가는 곳이라 '옮겨진 것'으로 봄)
  const hrefs = pages.flatMap((p) => p.links.filter((l) => /^https?:/.test(l.raw)).map((l) => l.href)).join('\n');
  const dom = norm(pages.map((p) => p.domText).join('\n') + '\n' + hrefs);
  const visible = norm(pages[0].visibleText + '\n' + hrefs);
  const visibleRaw = pages.map((p) => p.visibleText).join('\n');
  if (factsPath) {
    const spec = JSON.parse(readFileSync(factsPath, 'utf8'));
    const facts = (spec.facts || []).map((f) => (Array.isArray(f) ? { kind: f[0], text: f[1] } : f));
    const byKind = {}; const missing = [];
    let found = 0, foundVisible = 0;
    for (const f of facts) {
      const ok = hasFact(dom, f); const okV = hasFact(visible, f);
      byKind[f.kind] = byKind[f.kind] || { total: 0, found: 0 }; byKind[f.kind].total++;
      if (ok) { found++; byKind[f.kind].found++; } else missing.push({ kind: f.kind, text: f.text });
      if (okV) foundVisible++;
    }
    res.content = { facts: { total: facts.length, found, rate: facts.length ? Math.round((found / facts.length) * 1000) / 10 : null, foundVisibleOnLoad: foundVisible, rateVisibleOnLoad: facts.length ? Math.round((foundVisible / facts.length) * 1000) / 10 : null, byKind, missing }, notInSource: null };
    if (spec.source && (spec.source.text || spec.source.urls)) {
      const srcText = norm(spec.source.text || ''); const srcNums = new Set(((spec.source.text || '').match(NUM_RE) || []).map(numKey));
      const srcUrls = new Set((spec.source.urls || []).map(urlKey).filter(Boolean));
      const siteUrls = [...new Set(pages.flatMap((p) => p.links.filter((l) => /^https?:/.test(l.raw)).map((l) => l.href)))];
      const urls = siteUrls.filter((u) => { const k = urlKey(u); return k && !srcUrls.has(k) && !srcText.includes(norm(k)); });
      const nums = [...new Set((visibleRaw.match(NUM_RE) || []).map(numKey))].filter((n) => !srcNums.has(n) && !srcText.includes(norm(n)));
      // 주소는 교재에 없으면 바로 셈(로그인 주소처럼 도구가 덧붙인 것도 포함 → 목록을 보고 판단). 숫자는 계산해서 나온 값(남은 날, 개수)이 섞이므로 사람 확인
      res.content.notInSource = { urls: { count: urls.length, list: urls.slice(0, 30) }, numbers: { count: nums.length, list: nums.slice(0, 40), human: true } };
    } else res.notes.push('facts.json에 source가 없어 "교재에 없는 주소·수치"는 재지 않음');
  } else res.notes.push('--facts가 없어 교재 반영률은 재지 않음');

  const feats = featureChecks(pages, files);
  const sure = feats.filter((f) => !f.human);
  res.features = { count: feats.filter((f) => f.present).length, total: feats.length, countSure: sure.filter((f) => f.present).length, totalSure: sure.length, byPhase: Object.fromEntries(['전', '중', '후', '운영'].map((ph) => [ph, `${feats.filter((f) => f.phase === ph && f.present).length}/${feats.filter((f) => f.phase === ph).length}`])), items: feats };
  res.quality = quality;
  res.structure = { headings: pages[0].headings.filter((h) => h.level <= 2).map((h) => h.text), headingCount: pages[0].headings.length, visibleChars: pages[0].visibleText.replace(/\s+/g, '').length, domChars: pages[0].domText.replace(/\s+/g, '').length };
  return res;
}
function runInfo() {
  const r = { inputTokens: num('--input-tokens'), outputTokens: num('--output-tokens'), totalTokens: null, durationMs: num('--duration-ms'), toolUses: num('--tool-uses'), humanTurns: num('--human-turns'), costUsd: null };
  if (r.inputTokens !== null || r.outputTokens !== null) r.totalTokens = (r.inputTokens || 0) + (r.outputTokens || 0);
  const pi = num('--price-in'), po = num('--price-out');
  if (pi !== null && po !== null && r.totalTokens !== null) r.costUsd = Math.round((((r.inputTokens || 0) * pi + (r.outputTokens || 0) * po) / 1e6) * 10000) / 10000;
  return r;
}
function editInfo() {
  const pi = num('--price-in'), po = num('--price-out');
  return optAll('--edit').map((s) => { const [name, i, o, ms] = s.split(':'); const e = { name, inputTokens: +i || 0, outputTokens: +o || 0, totalTokens: (+i || 0) + (+o || 0), durationMs: +ms || null, costUsd: null }; if (pi !== null && po !== null) e.costUsd = Math.round(((e.inputTokens * pi + e.outputTokens * po) / 1e6) * 10000) / 10000; return e; });
}

// ── 일관성: 같은 요청 두 번 ───────────────────────────────
function compare(a, b) {
  const set = (x) => new Set((x.structure?.headings || []).map(norm));
  const A = set(a), B = set(b); const inter = [...A].filter((x) => B.has(x)).length; const uni = new Set([...A, ...B]).size;
  const fa = Object.fromEntries((a.features?.items || []).map((f) => [f.id, f.present])), fb = Object.fromEntries((b.features?.items || []).map((f) => [f.id, f.present]));
  const featDiff = Object.keys({ ...fa, ...fb }).filter((k) => fa[k] !== fb[k]);
  const d = (x, y) => (x == null || y == null ? null : Math.round((y - x) * 10) / 10);
  const pct = (x, y) => (x && y ? Math.round((Math.abs(y - x) / Math.max(x, y)) * 1000) / 10 : null);
  return {
    tool: 'site-score', compare: [a.label || a.site?.dir, b.label || b.site?.dir],
    structure: { headingOverlap: uni ? Math.round((inter / uni) * 1000) / 10 : null, onlyA: [...A].filter((x) => !B.has(x)).length, onlyB: [...B].filter((x) => !A.has(x)).length, visibleCharsDiffPct: pct(a.structure?.visibleChars, b.structure?.visibleChars) },
    features: { differ: featDiff, sameCount: Object.keys(fa).length - featDiff.length },
    content: { factRateDiff: d(a.content?.facts?.rate, b.content?.facts?.rate), notInSourceUrlsDiff: d(a.content?.notInSource?.urls?.count, b.content?.notInSource?.urls?.count) },
    quality: { overflowDiff: d(a.quality?.phone360?.overflowElements, b.quality?.phone360?.overflowElements), lowContrastDiff: d(a.quality?.a11y?.builtin?.lowContrast, b.quality?.a11y?.builtin?.lowContrast), axeSeriousDiff: d(a.quality?.a11y?.axe?.serious, b.quality?.a11y?.axe?.serious), bytesDiffPct: pct(a.site?.bytes?.total, b.site?.bytes?.total) },
    run: { totalTokensDiffPct: pct(a.run?.totalTokens, b.run?.totalTokens), durationDiffPct: pct(a.run?.durationMs, b.run?.durationMs) },
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  try {
    let out;
    if (argv[0] === '--compare') out = compare(JSON.parse(readFileSync(argv[1], 'utf8')), JSON.parse(readFileSync(argv[2], 'utf8')));
    else if (!argv[0] || argv[0].startsWith('--')) { console.error('쓰는 법: node site-score.mjs <사이트 폴더> [--facts facts.json] [--out score.json] …  (파일 맨 위 설명 참고)'); process.exit(2); }
    else out = await score(resolve(argv[0]));
    const json = JSON.stringify(out, null, 2);
    if (opt('--out', '')) writeFileSync(opt('--out'), json + '\n');
    console.log(json);
  } catch (e) { console.error(String(e.message || e)); process.exit(1); }
}
export { score, compare, featureChecks };
