// 교재 사실 대조(약속 C 검수의 한 갈래): 사이트 글에서 날짜·시각·숫자+단위·주소·메일·전화·쪽 번호와 복사 단추 원문·인용을 뽑아
// 교재 글과 하나씩 맞춰 봅니다. 코드는 교재를 해석하지 않고 '교재에 이 글자가 있는가'만 봅니다(띄어쓰기·줄바꿈·따옴표·물결·가운뎃점
// 차이는 같은 것으로 봄).
//   교재에서 찾지 못한 사실 → 살펴볼 곳(warn, 가장 가까운 교재 글과 쪽 번호를 함께)
//   복사 단추 원문이 교재 글과 거의 같은데 다름(고쳐 옮김·덧붙임) → 살펴볼 곳(원문과 다르다고 분명히, 교재 원문과 쪽을 함께)
//   사이트 글이 교재를 거의 다 옮김 → 살펴볼 곳(디자인 원칙 2번, 막지는 않음)
// 오탐을 줄이려고 교재의 시각 범위로 셀 수 있는 길이(14:20~15:10 → 50분), 시간↔분, 한글 수(네 가지 → 4가지)는 교재에 있는 것으로 봅니다.
import { scanTags, elementAt, attr, decodeEntities } from './html.js';
import { readMeta } from './meta.js';

// ── 글 맞추기 ─────────────────────────────────────────────
/** 비교용: 문자 참조 풀기·NFKC·따옴표·물결·가운뎃점 통일, 빈칸·줄바꿈 없애기, 영문 소문자 */
export function normFact(s) {
  return decodeEntities(String(s ?? '')).normalize('NFKC')
    .replace(/[“”„‟″〃「」『』]/g, '"').replace(/[‘’‚‛′`´]/g, "'")
    .replace(/[~～〜∼˜–—―−]/g, '~').replace(/[・•∙‧ㆍ･]/g, '·')
    .replace(/[\s​-‍﻿]+/g, '').toLowerCase();
}
/** 복사 글 비교용: 앞뒤 따옴표·끝 마침표 빼기 */
const normQuote = (s) => normFact(s).replace(/^["']+|["']+$/g, '').replace(/[.。]+$/, '');

/** 두 글의 비슷한 정도(글자 두 개씩 묶은 조각의 Dice 계수, 0~1) */
function bigrams(s) { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const b = s.slice(i, i + 2); m.set(b, (m.get(b) || 0) + 1); } return m; }
function dice(a, bA, b) {
  if (!a.length || !b.length) return 0;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const bB = bigrams(b); let both = 0;
  for (const [k, n] of bA) both += Math.min(n, bB.get(k) || 0);
  return (2 * both) / (a.length - 1 + b.length - 1);
}

// ── 교재 글 읽기 ──────────────────────────────────────────
/**
 * 교재 글 → 쪽마다 줄. 받는 꼴: lecpage prepare의 material.md(`## p-001 · 파일 1쪽 · 제목`), 앱 보조 글자(`## p.1 제목`),
 * pdftotext 글(쪽마다 \f), 쪽 표시 없는 글(쪽 번호 없음). pages([{page, text}])를 주면 그것을 씀
 */
export function materialPages(text = '', pages = null) {
  if (Array.isArray(pages) && pages.length) return pages.map((p, i) => ({ page: +p.page || i + 1, lines: [p.title || '', ...String(p.text || '').split(/\r?\n/)].map((x) => x.trim()).filter(Boolean) }));
  const s = String(text || '').replace(/\r\n?/g, '\n');
  const md = /^## p-\d{3,4}\b/m.test(s), ctx = !md && /^## (?:\S+ )?p\.\d+\b/m.test(s);
  if (!md && !ctx) {
    const parts = s.includes('\f') ? s.split('\f') : [s];
    return parts.map((c, i) => ({ page: parts.length > 1 ? i + 1 : null, lines: c.split('\n').map((x) => x.trim()).filter(Boolean) })).filter((p) => p.lines.length);
  }
  const out = []; let cur = null;
  for (const line of s.split('\n')) {
    let m;
    if (md && (m = /^## p-(\d{3,4})\b(.*)$/.exec(line))) {
      cur = { page: +m[1], lines: [] }; out.push(cur);
      const title = m[2].split(' · ').slice(2).join(' · ').replace(/\s*\(쪽 그림 없음\)\s*$/, '').trim();
      if (title) cur.lines.push(title);
      continue;
    }
    if (ctx && (m = /^## (?:\S+ )?p\.(\d+)(?:\s*\[[^\]]*\])?\s*(.*)$/.exec(line))) {
      cur = { page: +m[1], lines: [] }; out.push(cur);
      if (m[2] && m[2] !== '(제목 없음)') cur.lines.push(m[2].trim());
      continue;
    }
    if (!cur) continue; // 머리(도구가 붙인 안내 글)
    const t = line.replace(/^>\s*(?:발표자 노트|노트):\s*/, '').replace(/^링크:\s*/, '').trim();
    if (t && t !== '(글자 없음)' && !/^\(그림 \d+개\)$/.test(t)) cur.lines.push(t);
  }
  return out.filter((p) => p.lines.length);
}

// ── 사실 뽑기(사이트·교재 공통) ──────────────────────────────
const WD = '일월화수목금토';
const WD_RE = '(?:\\s*\\(\\s*([월화수목금토일])(?:요일)?\\s*\\)|\\s+([월화수목금토일])요일)?';
const DATE_RES = [
  new RegExp(`(?<![\\d.])((?:19|20)\\d\\d)\\s*(?:[.\\-/]|년)\\s*(\\d{1,2})\\s*(?:[.\\-/]|월)\\s*(\\d{1,2})(?!\\d)\\s*(?:일|\\.)?${WD_RE}`, 'g'),
  new RegExp(`(?<![\\d.])()(\\d{1,2})\\s*월\\s*(\\d{1,2})\\s*일${WD_RE}`, 'g'),
  new RegExp(`(?<![\\d.:/])()(\\d{1,2})\\s*[./]\\s*(\\d{1,2})\\s*\\.?\\s*\\(\\s*([월화수목금토일])(?:요일)?\\s*\\)()`, 'g'),
];
const URL_RE = /(?<![@\w.\/-])(?:https?:\/\/)?(?:www\.)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|kr|ai|io|app|dev|co|gle|ly|me|edu|gov|so|page|site|xyz|info|us|jp|tv|to|gg|link|cloud|tech|zone|new|ink|in|uk|de|fr|cn|tw))(?![a-z0-9-])(\/[^\s"'<>()\[\]{}가-힣]*)?/gi;
const MAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const PHONE_RES = [/(?<![\d-])(0\d{1,2})[\s.)-]{1,2}(\d{3,4})[\s.-](\d{4})(?![\d-])/g, /(?<![\d-])(1[5-9]\d\d)-(\d{4})(?![\d-])/g, /내선\s*(?:번호\s*)?(\d{2,5})(?!\d)/g];
const TIME_RE = /(?<![\d:.])([01]?\d|2[0-3])\s*:\s*([0-5]\d)(?![\d:])/g;
const KTIME_RE = /(오전|오후|낮|밤|저녁|아침|새벽)?\s*(?<![\d.])(\d{1,2})\s*시(?![간작험설점대각기계청민])\s*(?:(\d{1,2})\s*분|(반))?/g;
// 숫자+단위. 구조 번호(1단계·2번·3번째)는 뺌. 쪽·페이지는 쪽 번호로 따로 셈
// copy-ok: 정규식(낱말 뒤 (?!…)는 '1부터'·'2개념' 같은 것을 빼는 조건)
const UNIT = '시간|차시|교시|학년|문항|가지|개월|글자|퍼센트|모둠|단원|분|초|명|개(?![념발선요인])|부(?!터|터는|분)|장(?![면소점])|세(?![상계대])|층|%|일(?![반정부상])|주(?![제소요민])|회|점|원|년|줄|자(?![료리기신동연])|MB|GB|KB|팀|권|곳';
const NUM_RE = new RegExp(`(?<![\\d.,:/@A-Za-z_-])(\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?)\\s*(${UNIT})`, 'g');
const HM_RE = /(?<![\d.])(\d{1,2})\s*시간\s*(\d{1,2})\s*분/g;
const PAGE_RE = /(?<![\d.])(\d{1,4})\s*(?:쪽|페이지)|(?<![a-z])p\.\s*(\d{1,4})(?!\d)/gi;
const KNUM = { 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10, 스무: 20 };
const KNUM_RE = /(?<![가-힣])(한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|스무)\s*(가지|개|명|번|시간|장|부|권|곳|줄|문장|모둠|팀|문항|차시|단계)/g;

const unitKey = (u) => (u === '퍼센트' ? '%' : u.replace(/\(.*$/, ''));
const numVal = (s) => +String(s).replace(/,/g, '');
const mask = (s, i, n) => s.slice(0, i) + ' '.repeat(n) + s.slice(i + n);
const weekday = (y, m, d) => WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];

/** 글 한 줄 → 사실 목록 { kind, key, raw, … }. 겹치는 자리는 먼저 뽑은 것(주소·메일·전화·날짜·시각)이 가짐 */
function factsIn(line) {
  const out = []; let s = String(line);
  const take = (re, fn) => { re.lastIndex = 0; for (const m of [...s.matchAll(re)]) { const r = fn(m); if (r === false) continue; out.push(r); s = mask(s, m.index, m[0].length); } };
  take(MAIL_RE, (m) => ({ kind: 'email', key: m[0].toLowerCase(), raw: m[0] }));
  take(URL_RE, (m) => {
    const host = m[1].toLowerCase(); if (/^(?:[\w-]+\.)?(?:md|js|css|html?)$/.test(host)) return false;
    const path = (m[2] || '').replace(/[.,;:!?]+$/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
    return { kind: 'url', key: host + path, raw: m[0].replace(/[.,;:!?]+$/, '') };
  });
  for (const re of PHONE_RES) take(re, (m) => ({ kind: 'phone', key: m.slice(1).filter(Boolean).join(''), raw: m[0] }));
  for (const re of DATE_RES) take(re, (m) => {
    const y = +m[1] || 0, mo = +m[2], d = +m[3], wd = m[4] || m[5] || null;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
    return { kind: 'date', key: `${mo}/${d}`, y, m: mo, d, wd, raw: m[0].trim() };
  });
  take(TIME_RE, (m) => ({ kind: 'time', key: +m[1] * 60 + +m[2], alt: [], raw: m[0] }));
  take(KTIME_RE, (m) => {
    let h = +m[2]; const mi = m[4] ? 30 : +(m[3] || 0); if (h > 24 || mi > 59) return false;
    const ap = m[1] || '';
    if (/오후|저녁|밤/.test(ap) && h < 12) h += 12; else if (ap === '낮' && h < 6) h += 12;
    const alt = !ap && h >= 1 && h < 12 ? [(h + 12) * 60 + mi] : [];
    return { kind: 'time', key: h * 60 + mi, alt, raw: m[0].trim() };
  });
  take(HM_RE, (m) => ({ kind: 'num', unit: '분', n: +m[1] * 60 + +m[2], key: `${+m[1] * 60 + +m[2]}분`, raw: m[0], hm: true }));
  take(PAGE_RE, (m) => ({ kind: 'page', n: +(m[1] || m[2]), key: String(+(m[1] || m[2])), raw: m[0] }));
  take(NUM_RE, (m) => { const u = unitKey(m[2]); const n = numVal(m[1]); return { kind: 'num', unit: u, n, key: `${n}${u}`, raw: m[0] }; });
  return out;
}

/** 교재(+강사 값) 사실 묶음: 쪽마다 줄·정규화한 글·날짜·시각·길이(분)·숫자·주소·메일·전화 */
function indexMaterial(pages) {
  const M = { pages: [], lines: [], dates: [], times: new Set(), timeList: [], mins: new Set(), nums: [], numKeys: new Set(), urls: [], emails: new Set(), phones: new Set(), years: {}, maxPage: 0, chars: 0 };
  for (const p of pages) {
    const pn = []; const teacher = p.page === 'teacher';
    for (const raw of p.lines) {
      const n = normFact(raw); if (!n) continue;
      const line = { page: p.page, raw, n }; M.lines.push(line); pn.push(n);
      if (!teacher) M.chars += n.length;
      const fs = factsIn(raw);
      // 한글 수 + 단위(네 가지 → 4가지)
      for (const m of raw.matchAll(KNUM_RE)) fs.push({ kind: 'num', unit: m[2], n: KNUM[m[1]], key: `${KNUM[m[1]]}${m[2]}`, raw: m[0] });
      const ts = [];
      for (const f of fs) {
        if (f.kind === 'date') { M.dates.push({ ...f, line }); if (f.y) M.years[f.y] = (M.years[f.y] || 0) + 1; }
        else if (f.kind === 'time') { M.times.add(f.key); f.alt.forEach((x) => M.times.add(x)); M.timeList.push({ ...f, line }); ts.push(f); }
        else if (f.kind === 'num') { M.nums.push({ ...f, line }); M.numKeys.add(f.key); if (f.unit === '분') M.mins.add(f.n); if (f.unit === '시간') M.mins.add(Math.round(f.n * 60)); }
        else if (f.kind === 'url') M.urls.push({ ...f, line });
        else if (f.kind === 'email') M.emails.add(f.key);
        else if (f.kind === 'phone') M.phones.add(f.key);
      }
      // 시각 범위(14:20~15:10)의 길이도 교재에 있는 것으로
      for (let i = 0; i + 1 < ts.length; i++) { const d = ts[i + 1].key - ts[i].key; if (d > 0 && d <= 12 * 60) M.mins.add(d); }
    }
    if (typeof p.page === 'number' && p.page > M.maxPage) M.maxPage = p.page;
    M.pages.push({ page: p.page, n: pn.join('\n') });
  }
  M.all = M.pages.map((p) => p.n).join('\n');
  M.flat = M.pages.map((p) => p.n.replace(/\n/g, '')).join('\n'); // 쪽 안에서는 줄바꿈 없이(여러 줄 원문), 쪽 사이는 끊음
  // 범위가 줄을 넘어갈 때(표의 시작·끝 칸)도: 같은 쪽의 이웃한 시각 사이
  const byPage = {}; for (const t of M.timeList) (byPage[t.line.page] ||= []).push(t.key);
  for (const list of Object.values(byPage)) for (let i = 0; i + 1 < list.length; i++) { const d = list[i + 1] - list[i]; if (d > 0 && d <= 12 * 60) M.mins.add(d); }
  return M;
}

// ── 사이트 글 뽑기 ─────────────────────────────────────────
const BLOCK = new Set(['p', 'div', 'li', 'ul', 'ol', 'dl', 'dt', 'dd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr', 'td', 'th', 'table', 'thead', 'tbody', 'section', 'article', 'header', 'footer', 'main', 'nav', 'aside', 'br', 'hr', 'blockquote', 'pre', 'figure', 'figcaption', 'details', 'summary', 'button', 'label', 'form', 'fieldset', 'legend', 'option', 'caption', 'title', 'textarea', 'address', 'center']);
const SKIP = new Set(['script', 'style', 'template', 'noscript', 'svg', 'math', 'canvas', 'head']);
const TEXT_ATTRS = ['alt', 'title', 'aria-label', 'placeholder', 'data-question', 'data-options', 'data-title', 'data-prompt', 'data-items', 'data-categories', 'data-questions'];
const COPY_ATTRS = ['data-copy-text', 'data-clipboard-text', 'data-copy'];
const TARGET_ATTRS = ['data-copy-target', 'data-clipboard-target', 'data-copy-from'];
const selOf = (t) => { const id = attr(t, 'id'); if (id) return `${t.name}#${id}`; const c = (attr(t, 'class') || '').split(/\s+/).filter(Boolean)[0]; return t.name + (c ? '.' + c : ''); };
const innerText = (html, el) => decodeEntities(html.slice(el.innerStart, el.innerEnd).replace(/<br\s*\/?>/gi, '\n').replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/[ \t]+/g, ' ').trim();

/** 쪽 하나 → { lines(보이는 글 줄), attrs, links, copies, quotes } (자리 표시 안·스크립트·스타일·<head>는 뺌, <title>은 넣음) */
function siteText(html) {
  const tags = scanTags(html);
  const ids = new Map(); tags.forEach((t, k) => { if (t.kind === 'open' && attr(t, 'id')) ids.set(attr(t, 'id'), k); });
  let text = ''; let pos = 0; const attrs = [], links = [], copies = [], quotes = [];
  // <head>는 건너뛰되 보이는 글이 되는 것(<title>·설명 meta)은 넣음
  const title = tags.find((t) => t.kind === 'open' && t.name === 'title');
  if (title && title.contentStart !== undefined) text += decodeEntities(html.slice(title.contentStart, title.contentEnd)) + '\n';
  for (const t of tags) if (t.kind === 'open' && t.name === 'meta' && /^(description|og:description|og:title)$/i.test(attr(t, 'name') || attr(t, 'property') || '') && attr(t, 'content')) attrs.push({ name: 'content', value: attr(t, 'content'), sel: `meta[${attr(t, 'name') ? 'name' : 'property'}="${attr(t, 'name') || attr(t, 'property')}"]` });
  for (let k = 0; k < tags.length; k++) {
    const t = tags[k];
    if (t.start < pos) continue;
    text += decodeEntities(html.slice(pos, t.start));
    pos = t.end;
    if (t.kind !== 'open') { if (BLOCK.has(t.name)) text += '\n'; continue; }
    const lp = attr(t, 'data-lp');
    if (SKIP.has(t.name) || (lp !== undefined && lp !== 'materials')) {
      for (const a of TEXT_ATTRS) if (lp !== undefined && attr(t, a)) attrs.push({ name: a, value: attr(t, a), sel: `[data-lp="${lp}"]` });
      const el = elementAt(tags, k, html); if (el) pos = Math.max(pos, el.end);
      continue;
    }
    if (BLOCK.has(t.name)) text += '\n';
    for (const a of TEXT_ATTRS) { const v = attr(t, a); if (v) attrs.push({ name: a, value: v, sel: selOf(t) }); }
    if (t.name === 'a' || t.name === 'area') { const h = attr(t, 'href') || ''; if (/^(https?:|mailto:|tel:)/i.test(h.trim())) links.push({ href: h.trim(), sel: selOf(t) }); }
    for (const a of COPY_ATTRS) {
      const v = attr(t, a); if (!v || !v.trim()) continue;
      if (/^#[\w-]+$/.test(v.trim()) && ids.has(v.trim().slice(1))) { const j = ids.get(v.trim().slice(1)); const el = elementAt(tags, j, html); if (el) copies.push({ text: innerText(html, el), sel: selOf(t) }); }
      else copies.push({ text: v, sel: selOf(t) });
    }
    for (const a of TARGET_ATTRS) {
      const v = (attr(t, a) || '').trim(); const j = /^#[\w-]+$/.test(v) ? ids.get(v.slice(1)) : undefined;
      if (j !== undefined) { const el = elementAt(tags, j, html); if (el) copies.push({ text: innerText(html, el), sel: selOf(t) }); }
    }
    if (['blockquote', 'q', 'pre'].includes(t.name)) { const el = elementAt(tags, k, html); if (el) quotes.push({ text: innerText(html, el), sel: selOf(t), tag: t.name }); }
    if (t.name === 'textarea' && t.contentStart !== undefined) { text += decodeEntities(html.slice(t.contentStart, t.contentEnd)) + '\n'; pos = Math.max(pos, tags[k + 1]?.end ?? pos); }
  }
  text += decodeEntities(html.slice(pos));
  const lines = text.split('\n').map((x) => x.replace(/[ \t ]+/g, ' ').trim()).filter(Boolean);
  // 글 속 인용(“…”·"…"·「…」·『…』, 열 글자 넘는 것)
  for (const line of lines) for (const m of line.matchAll(/[“"]([^"”\n]{4,300})[”"]|「([^」\n]{4,300})」|『([^』\n]{4,300})』/g)) {
    const q = (m[1] || m[2] || m[3] || '').trim(); if (normFact(q).length >= 10) quotes.push({ text: q, sel: '', tag: 'text', line });
  }
  return { lines, attrs, links, copies, quotes };
}

// ── 가장 가까운 교재 글 ─────────────────────────────────────
const pageLabel = (p) => (p === 'teacher' ? '강사 값' : typeof p === 'number' ? `교재 ${p}쪽` : '교재');
const clip = (s, n = 60) => { const t = String(s).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const where = (line) => (line ? `${pageLabel(line.page)}: "${clip(line.raw)}"` : '');
/** 교재에서 이 글과 가장 비슷한 줄(이웃한 두 줄까지 붙여 봄) → { line, score } */
function nearestLine(M, text) {
  const a = normFact(text); if (!a) return null; const bA = bigrams(a);
  let best = null;
  for (let i = 0; i < M.lines.length; i++) {
    for (let w = 1; w <= 3 && i + w <= M.lines.length; w++) {
      if (w > 1 && M.lines[i + w - 1].page !== M.lines[i].page) break;
      const b = M.lines.slice(i, i + w).map((x) => x.n).join('');
      const sc = dice(a, bA, b);
      if (!best || sc > best.score) best = { line: w === 1 ? M.lines[i] : { page: M.lines[i].page, raw: M.lines.slice(i, i + w).map((x) => x.raw).join(' ') }, score: sc };
    }
  }
  return best;
}
/** 복사 글이 교재 어디쯤과 가장 비슷한지: 쪽마다 같은 길이(±25%)의 창을 밀어 가며 → { score, page, raw } */
function nearestSpan(M, c) {
  const L = c.length; if (L < 2) return null; const bC = bigrams(c);
  let best = { score: 0, page: null, at: 0, len: L, n: '' };
  for (const p of M.pages) {
    const s = p.n.replace(/\n/g, ''); if (!s) continue;
    for (const len of [L, Math.round(L * 0.8), Math.round(L * 1.25)]) {
      const step = Math.max(1, Math.floor(len / 8));
      for (let i = 0; i <= Math.max(0, s.length - len); i += step) {
        const sc = dice(c, bC, s.slice(i, i + len));
        if (sc > best.score) best = { score: sc, page: p.page, at: i, len, n: s };
      }
    }
  }
  if (!best.n) return null;
  // 원래 줄(사람이 읽을 글)로 돌려줌: 그 쪽에서 창과 가장 많이 겹치는 줄들
  const win = best.n.slice(best.at, best.at + best.len);
  const near = nearestLine({ lines: M.lines.filter((x) => x.page === best.page) }, win);
  return { score: best.score, page: best.page, raw: near?.line?.raw || win };
}

// ── 대조 ──────────────────────────────────────────────────
const JOSA = /(?:에서|에게|으로|이다|입니다|이며|에|은|는|이|가|을|를|의|와|과|도|만|로)$/;
const tokens = (s) => String(s).split(/[\s,·/()\[\]:：|;]+/).map((x) => x.replace(/[.!?'"]+$/, '')).filter((x) => /[가-힣A-Za-z]/.test(x) && x.length >= 2).map((x) => (x.length > 2 ? x.replace(JOSA, '') : x)).filter((x) => x.length >= 2);
const NOT_NAME = /^(소개|화면|안내|님|선생님|선생|프로필|약력|이름|정보|연락처|문의|모두|함께|한마디|인사|발표|진행|강의|강사)$/;

/**
 * 교재 사실 대조.
 * @param siteFiles { 경로: 글|Uint8Array } — AI가 쓴 사이트 폴더(조립 전). *.html만 봄(엔진 쪽 console·screen·poster·check·privacy는 뺌)
 * @param opts.materialText 교재 글(material.md·앱 보조 글자·pdftotext 글). 없으면 opts.pages([{page,title,text}])
 * @param opts.meta lecpage.json(객체·글): sessions·venue·instructors·admin·facts도 교재와 맞춰 봄
 * @param opts.known 교재 밖이지만 강사가 알려 준 글(문자열 목록·객체). 여기 있는 사실은 교재에 있는 것으로 봄
 * @param opts.maxPerRule 규칙마다 최대 개수(기본 12)
 * @returns issues[] { id:'fact-*', level, where:{file, selector, section}, message_ko, fix_hint_ko }
 */
export function checkFacts(siteFiles = {}, { materialText = '', pages = null, meta = null, known = [], maxPerRule = 12 } = {}) {
  const mp = materialPages(materialText, pages);
  if (!mp.length) return [];
  const knownLines = flatStrings(known).flatMap((s) => s.split(/\r?\n/)).map((x) => x.trim()).filter(Boolean);
  const M = indexMaterial(knownLines.length ? [...mp, { page: 'teacher', lines: knownLines }] : mp);
  if (!M.chars) return [];
  const yearOf = (() => { const m = readMetaSafe(meta); const y = +String(m?.sessions?.[0]?.date || '').slice(0, 4); if (y) return y; const top = Object.entries(M.years).sort((a, b) => b[1] - a[1])[0]; return top ? +top[0] : 0; })();

  const issues = []; const count = {}; const seen = new Set();
  // 같은 값은 파일마다 한 번만(처음 나온 자리의 글을 보여 줌)
  const add = (id, level, w, message_ko, fix_hint_ko, key = message_ko) => {
    const k = `${id}|${w.file}|${key}`; if (seen.has(k)) return; seen.add(k);
    count[id] = (count[id] || 0) + 1; if (count[id] > maxPerRule) return;
    issues.push({ id, level, where: { file: w.file || '', selector: w.selector || '', section: w.section || '' }, message_ko, fix_hint_ko });
  };
  const FIX = '교재 글로 고치거나, 강사가 알려 준 값이면 그대로 두세요. Skill은 lecpage.teacher.json의 told에 적으면 다음 검수부터 세지 않아요.';
  const inAll = (s) => { const n = normFact(s); return !!n && M.all.includes(n); };

  /** 사실 하나를 교재와 맞춤: 없으면 issue */
  function checkFact(f, w, ctxText) {
    const at = ctxText ? ` (사이트: "${clip(ctxText, 50)}")` : '';
    if (f.kind === 'date') {
      const same = M.dates.filter((d) => d.key === f.key);
      const ok = same.length && (!f.y || same.some((d) => !d.y || d.y === f.y));
      if (!ok) {
        const near = M.dates.slice().sort((a, b) => dist(a) - dist(b))[0];
        add('fact-date', 'warn', w, `날짜 "${f.raw}"${ga(f.raw)} 교재에 없어요${at}.${near ? ` 교재에 가까운 날짜: "${near.raw}"(${where(near.line)})` : ''}`, FIX, f.key + '/' + f.y);
      }
      // 요일: 그해 달력과 다르면(연도는 그 날짜·연수 날짜·교재에 가장 많이 나온 해 순서로)
      const y = f.y || same.find((d) => d.y)?.y || yearOf;
      if (f.wd && y && weekday(y, f.m, f.d) !== f.wd) add('fact-weekday', 'warn', w, `${y}년 ${f.m}월 ${f.d}일은 ${weekday(y, f.m, f.d)}요일인데 "${f.raw}"로 적었어요${at}.`, '교재의 날짜·요일을 다시 확인해 주세요.', `${y}/${f.key}/${f.wd}`);
      function dist(d) { return Math.abs((d.m * 31 + d.d) - (f.m * 31 + f.d)) + (f.y && d.y && d.y !== f.y ? 400 : 0); }
      return;
    }
    if (f.kind === 'time') {
      if (M.times.has(f.key) || f.alt.some((x) => M.times.has(x))) return;
      const near = M.timeList.slice().sort((a, b) => Math.abs(a.key - f.key) - Math.abs(b.key - f.key))[0];
      add('fact-time', 'warn', w, `시각 "${f.raw}"${ga(f.raw)} 교재에 없어요${at}.${near ? ` 교재에 가까운 시각: "${near.raw}"(${where(near.line)})` : ''}`, FIX, f.key);
      return;
    }
    if (f.kind === 'num') {
      if (M.numKeys.has(f.key)) return;
      if (f.unit === '분' && M.mins.has(f.n)) return;
      if (f.unit === '시간' && M.mins.has(Math.round(f.n * 60))) return;
      if (f.unit === '년' && f.n >= 1900 && M.all.includes(String(f.n))) return;
      // 그 수와 단위가 교재에서 세 글자 안에 붙어 있으면(문항 5개 ↔ 5문항) 교재에 있는 것으로
      const nn = String(f.n).replace('.', '\\.'), uu = f.unit.toLowerCase();
      if (new RegExp(`${uu}[^\\d\\n]{0,3}(?<![\\d.])${nn}(?![\\d.])|(?<![\\d.])${nn}(?![\\d.])[^\\d\\n]{0,3}${uu}`).test(M.all)) return;
      const near = M.nums.filter((x) => x.unit === f.unit).sort((a, b) => Math.abs(a.n - f.n) - Math.abs(b.n - f.n))[0];
      add('fact-number', 'warn', w, `"${f.raw.trim()}"${ga(f.raw)} 교재에 없어요${at}.${near ? ` 교재의 비슷한 값: "${near.raw.trim()}"(${where(near.line)})` : ''}`, FIX, f.key);
      return;
    }
    if (f.kind === 'url') {
      if (/^(?:lecpage\.com|yoorrard\.github\.io\/lecpage)(\/|$)/.test(f.key)) return;
      const ok = M.urls.some((u) => u.key === f.key || u.key.startsWith(f.key + '/') || (!f.key.includes('/') && u.key.split('/')[0] === f.key)) || M.all.includes(f.key);
      if (ok) return;
      const a = f.key, bA = bigrams(a);
      const near = M.urls.map((u) => ({ u, s: dice(a, bA, u.key) })).sort((x, y) => y.s - x.s)[0];
      add('fact-url', 'warn', w, `주소 "${clip(f.raw, 60)}"${ga(f.raw)} 교재에 없어요${at}.${near && near.s > 0.3 ? ` 교재에 비슷한 주소: "${near.u.raw}"(${where(near.u.line)})` : ''}`, '교재에 있는 주소만 쓰거나, 강사가 준 주소면 그대로 두세요(강사 값 surveyUrl·told).', f.key);
      return;
    }
    if (f.kind === 'email') { if (!M.emails.has(f.key) && !M.all.includes(f.key)) add('fact-email', 'warn', w, `메일 "${f.raw}"${ga(f.raw)} 교재에 없어요${at}.`, FIX, f.key); return; }
    if (f.kind === 'phone') { if (!M.phones.has(f.key)) add('fact-phone', 'warn', w, `전화·내선 "${f.raw}"${ga(f.raw)} 교재에 없어요${at}.`, FIX, f.key); return; }
    if (f.kind === 'page') {
      if (M.maxPage && f.n > M.maxPage && !inAll(f.raw)) add('fact-page', 'warn', w, `"${f.raw}"라고 적었는데 교재는 ${M.maxPage}쪽까지예요${at}.`, '쪽 번호를 교재(material.md의 p-NNN)에 맞춰 주세요.', f.key);
    }
  }
  const checkText = (text, w) => { for (const f of factsIn(text)) checkFact(f, w, text); };

  /** 이름(강사)·장소: 낱말마다 교재에 있는지 */
  function checkWords(kind, value, w, label) {
    const v = String(value || '').trim(); if (!v || v.length > 60) return;
    const miss = tokens(v).filter((t) => !NOT_NAME.test(t) && !/^\d/.test(t) && !M.all.includes(normFact(t)));
    if (!miss.length) return;
    const near = nearestLine(M, v);
    const what = miss.length === 1 && normFact(miss[0]) === normFact(v) ? `${label} "${v}"${ga(v)}` : `${label} "${clip(v, 40)}"의 ${miss.slice(0, 3).map((x) => `"${x}"`).join('·')}${ga(miss[Math.min(2, miss.length - 1)])}`;
    add(kind === 'name' ? 'fact-name' : 'fact-venue', 'warn', w, `${what} 교재에 없어요.${near && near.score > 0.2 ? ` 교재에 가까운 글: ${where(near.line)}` : ''}`, FIX);
  }

  /** 복사 단추·인용 */
  function checkCopy(text, w, kind) {
    const c = normQuote(text); if (c.length < 2) return;
    if (M.flat.includes(c)) return;
    // 주소·메일만 복사하는 단추는 주소 대조로
    const fs = factsIn(text);
    if (fs.length === 1 && ['url', 'email', 'phone'].includes(fs[0].kind) && normFact(fs[0].raw).length >= c.length - 2) { checkFact(fs[0], w, ''); return; }
    const near = nearestSpan(M, c);
    const sc = near?.score || 0;
    const what = kind === 'copy' ? '복사 버튼 글' : kind === 'pre' ? '원문 상자 글' : '인용';
    if (sc >= 0.72 && c.length >= 8) {
      add(kind === 'copy' ? 'fact-copy' : 'fact-quote', 'warn', w, `${what}이 교재 원문과 달라요: "${clip(text, 70)}" ↔ ${pageLabel(near.page)} "${clip(near.raw, 90)}"`, '교재 원문을 글자 그대로 옮겨 주세요(띄어쓰기·줄바꿈만 달라도 돼요). 고쳐 쓰거나 덧붙이지 않아요.');
    } else if (kind === 'copy' || (kind === 'pre' && c.length >= 12) || (kind !== 'pre' && c.length >= 10 && sc >= 0.45)) {
      add(kind === 'copy' ? 'fact-copy' : 'fact-quote', 'warn', w, `교재에서 찾지 못한 ${what}: "${clip(text, 70)}".${near && sc >= 0.35 ? ` 가장 비슷한 교재 글: ${pageLabel(near.page)} "${clip(near.raw, 80)}"` : ''}`, kind === 'copy' ? '복사할 원문은 교재 글 그대로 두세요. AI가 만든 예시라면 사이트에 그렇다고 밝혀 주세요.' : '교재 글이면 원문 그대로, 아니면 따옴표를 빼 주세요.');
    } else checkText(text, w);
  }

  // 사이트 쪽마다
  const pagesList = Object.keys(siteFiles).filter((p) => /^[^/]+\.html$/.test(p) && !/^(console|screen|poster|check|privacy)\.html$/.test(p)).sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)));
  let siteChars = 0; const siteNorm = [];
  for (const file of pagesList) {
    const html = typeof siteFiles[file] === 'string' ? siteFiles[file] : new TextDecoder().decode(siteFiles[file]);
    const T = siteText(html);
    const w = { file };
    const copied = new Set(T.copies.map((c) => normQuote(c.text)));
    for (const c of T.copies) checkCopy(c.text, { file, selector: c.sel }, 'copy');
    for (const q of T.quotes) if (!copied.has(normQuote(q.text))) checkCopy(q.text, { file, selector: q.sel }, q.tag === 'pre' ? 'pre' : 'quote');
    // 줄마다 사실(복사 단추·인용과 같은 줄은 위에서 봄)
    for (const line of T.lines) { if (copied.has(normQuote(line))) continue; checkText(line, w); }
    for (const a of T.attrs) checkText(a.value, { file, selector: a.sel });
    for (const l of T.links) {
      const h = l.href;
      if (/^mailto:/i.test(h)) checkFact({ kind: 'email', key: h.slice(7).split('?')[0].toLowerCase(), raw: h.slice(7).split('?')[0] }, { file, selector: l.sel }, '');
      else if (/^tel:/i.test(h)) { const d = h.replace(/\D/g, ''); if (d.length >= 7) checkFact({ kind: 'phone', key: d, raw: h.slice(4) }, { file, selector: l.sel }, ''); }
      else for (const f of factsIn(h)) if (f.kind === 'url') checkFact(f, { file, selector: l.sel }, '');
    }
    // 이름·장소 꼬리표(강사: …, 장소: …). 꼬리표만 있는 줄이면 다음 줄이 값
    T.lines.forEach((line, i) => {
      const m = /^(강사|강연자|발표자|진행자|강의자|연사|장소|연수\s*장소|교육\s*장소|위치)\s*(?:[:：]\s*|\s+)?(.*)$/.exec(line);
      if (!m) return;
      const val = (m[2] || '').trim() || (line.trim() === m[1] ? T.lines[i + 1] || '' : '');
      if (!val || val.length > 40) return;
      if (/장소|위치/.test(m[1])) checkWords('venue', val, w, '장소');
      else { const name = /^([가-힣]{2,4}|[A-Z][a-z]+(?: [A-Z][a-z]+)?)(?=$|[\s(·,]|님|선생|강사|교사)/.exec(val)?.[1]; if (name && !NOT_NAME.test(name)) checkWords('name', name, w, '강사'); }
    });
    siteChars += T.lines.join('').replace(/\s+/g, '').length;
    siteNorm.push(normFact(T.lines.join('\n')));
  }

  // 연수 정보(lecpage.json): AI가 교재에서 찾았다고 적은 값
  const m = readMetaSafe(meta);
  if (m) {
    const w = { file: 'lecpage.json' };
    for (const [i, s] of (m.sessions || []).entries()) {
      if (s.date) { const [y, mo, d] = s.date.split('-').map(Number); checkFact({ kind: 'date', key: `${mo}/${d}`, y, m: mo, d, wd: null, raw: s.date }, { file: 'lecpage.json', selector: `sessions[${i}].date` }, ''); }
      for (const k of ['start', 'end']) if (s[k]) { const [h, mi] = s[k].split(':').map(Number); checkFact({ kind: 'time', key: h * 60 + mi, alt: [], raw: s[k] }, { file: 'lecpage.json', selector: `sessions[${i}].${k}` }, ''); }
    }
    if (m.venue) checkWords('venue', m.venue, { file: 'lecpage.json', selector: 'venue' }, '장소(venue)');
    for (const [i, p] of (m.instructors || []).entries()) checkWords('name', p.name, { file: 'lecpage.json', selector: `instructors[${i}].name` }, '강사 이름');
    if (m.admin?.hours) checkFact({ kind: 'num', unit: '시간', n: m.admin.hours, key: `${m.admin.hours}시간`, raw: `admin.hours ${m.admin.hours}시간` }, { file: 'lecpage.json', selector: 'admin.hours' }, '');
    if (m.admin?.completionRate) checkFact({ kind: 'num', unit: '%', n: m.admin.completionRate, key: `${m.admin.completionRate}%`, raw: `admin.completionRate ${m.admin.completionRate}%` }, { file: 'lecpage.json', selector: 'admin.completionRate' }, '');
    for (const [i, f] of (m.facts || []).entries()) {
      const fw = { file: 'lecpage.json', selector: `facts[${i}] ${clip(f.label, 20)}` };
      checkText(f.value, fw);
      // 값이 교재에 글자 그대로 있는데 적은 쪽과 다르면
      const n = normQuote(f.value);
      if (f.page && n.length >= 6 && M.all.includes(n)) {
        const pg = M.pages.find((p) => p.page === f.page);
        const on = M.pages.filter((p) => p.n.replace(/\n/g, '').includes(n) || p.n.includes(n)).map((p) => p.page).filter((p) => typeof p === 'number');
        if (pg && on.length && !on.includes(f.page)) add('fact-page', 'warn', fw, `facts "${f.label}"의 쪽 번호가 달라요: ${f.page}쪽이라고 적었는데 교재 ${on.slice(0, 3).join('·')}쪽에 있어요.`, 'facts의 page를 고쳐 주세요(강사가 확인 화면에서 그 쪽을 열어 봐요).');
      }
    }
  }

  // 받아쓰기: 사이트 글이 교재 글만큼 길고(60% 넘음) 그 글의 대부분이 교재에서 옴(교재 글 네 글자 조각의 60% 넘게 사이트에 있음). 디자인 원칙 2번
  const t = transcribed(siteChars, siteNorm.join('\n'), M);
  if (t.warn) {
    add('fact-transcribe', 'warn', { file: pagesList[0] || 'index.html' }, `사이트가 교재를 거의 다 옮기고 있어요(사이트 글 ${siteChars}자 = 교재 글의 ${Math.round(t.ratio * 100)}%, 교재 글의 ${Math.round(t.cover * 100)}%가 사이트에 그대로 있음).`, '설명은 쪽 그림(교재 넘기기·교재 N쪽)과 강사에게 맡겨요. 사이트에는 할 일·복사할 원문·다시 찾을 정보(일정·준비물·과제·연락처)만 남겨요(디자인 원칙 2번).');
  }
  return issues;
}

/** 받아쓰기 정도: ratio(사이트 글 ÷ 교재 글), cover(교재 글의 네 글자 조각 중 사이트에 있는 몫) */
function transcribed(siteChars, siteNorm, M) {
  const grams = new Set(); for (let i = 0; i + 4 <= siteNorm.length; i++) grams.add(siteNorm.slice(i, i + 4));
  let tot = 0, hit = 0;
  for (const l of M.lines) { if (l.page === 'teacher') continue; for (let i = 0; i + 4 <= l.n.length; i++) { tot++; if (grams.has(l.n.slice(i, i + 4))) hit++; } }
  const ratio = M.chars ? siteChars / M.chars : 0, cover = tot ? hit / tot : 0;
  return { ratio, cover, warn: M.chars >= 600 && ratio >= 0.6 && cover >= 0.6 };
}

/** 교재 대조 수치(앱·CLI 요약용): 사이트 글 양·교재 글 양 */
export function factStats(siteFiles = {}, { materialText = '', pages = null } = {}) {
  const M = indexMaterial(materialPages(materialText, pages));
  let siteChars = 0; const norms = [];
  for (const [p, v] of Object.entries(siteFiles)) {
    if (!/^[^/]+\.html$/.test(p) || /^(console|screen|poster|check|privacy)\.html$/.test(p)) continue;
    const lines = siteText(typeof v === 'string' ? v : new TextDecoder().decode(v)).lines;
    siteChars += lines.join('').replace(/\s+/g, '').length; norms.push(normFact(lines.join('\n')));
  }
  const t = transcribed(siteChars, norms.join('\n'), M);
  return { siteChars, materialChars: M.chars, maxPage: M.maxPage, ratio: +t.ratio.toFixed(2), cover: +t.cover.toFixed(2) };
}

function readMetaSafe(meta) { if (!meta) return null; try { return readMeta(meta).meta; } catch { return null; } }
/** 강사 값(객체·목록·글) → 글 목록 */
function flatStrings(v, out = [], depth = 0) {
  if (depth > 6 || v === null || v === undefined) return out;
  if (typeof v === 'string') { if (v.trim()) out.push(v); }
  else if (typeof v === 'number') out.push(String(v));
  else if (Array.isArray(v)) v.forEach((x) => flatStrings(x, out, depth + 1));
  else if (typeof v === 'object') Object.entries(v).forEach(([k, x]) => { if (!/key|token|secret|password/i.test(k)) flatStrings(x, out, depth + 1); });
  return out;
}
/** 이/가: 끝의 한글·숫자 읽는 소리로(괄호·따옴표는 건너뜀). 2026. 11. 20.(금) → 금 → '이' */
function ga(w) {
  if (/%\s*["']?$/.test(String(w))) return '가'; // 퍼센트
  const s = String(w).replace(/[^가-힣0-9A-Za-z]+$/, '');
  const c = s.slice(-1);
  if (/[0-9]/.test(c)) return '013678'.includes(c) ? '이' : '가'; // 영·일·삼·육·칠·팔
  const k = c.charCodeAt(0);
  if (k >= 0xac00 && k <= 0xd7a3) return (k - 0xac00) % 28 ? '이' : '가';
  return /[lmnr]$/i.test(c) ? '이' : '가';
}
