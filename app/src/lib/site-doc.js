// 완성 뒤 편집(docs/plan-ai-first.md §8): AI가 만든 사이트 HTML을 DOM으로 직접 고치고 site['index.html']로 다시 씀(파서는 DOMParser).
// 목록 = 사이트의 맨 바깥 <section>(순서·숨기기·지우기·이름), 글 고치기 = 미리보기에서 누른 글(번호로 찾음), 그림 바꾸기, 색·글꼴(--lp-* 변수).
// 미리보기에는 원본 사본에 번호(data-lpe 글, data-lps 섹션)를 붙여 조립하고, 고친 내용은 같은 순서로 걸어 원본의 같은 자리에 씀.

import { parseIso, swapDate, swapTimeRange } from './date-text.js';

export const parse = (html) => new DOMParser().parseFromString(String(html || ''), 'text/html');
export function serialize(doc) {
  const dt = doc.doctype ? '<!doctype html>\n' : '';
  return dt + doc.documentElement.outerHTML + '\n';
}
const edit = (html, fn) => { const doc = parse(html); const r = fn(doc); return r === false ? html : serialize(doc); };

/** 맨 바깥 섹션(다른 섹션 안에 든 실습 단계 등은 빼고) */
export function topSections(doc) {
  return [...doc.body.querySelectorAll('section')].filter((s) => !s.parentElement?.closest('section'));
}
const HEAD = 'h1,h2,h3,h4';
/** 섹션 이름: data-title → 첫 제목 → aria-label */
/** 요소 글을 사람 눈에 보이는 대로(요소 사이에 빈칸: <span>02</span>생성형 → '02 생성형') */
function words(el) {
  if (!el) return '';
  const out = [];
  const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) out.push(c.textContent); else if (c.nodeType === 1 && !c.matches('script,style,[aria-hidden="true"]')) { out.push(' '); walk(c); out.push(' '); } } };
  walk(el);
  return out.join('').replace(/\s+/g, ' ').trim();
}
export function sectionName(s, i = 0) {
  const t = s.getAttribute('data-title') || words(s.querySelector(HEAD)) || s.getAttribute('aria-label') || '';
  return t.replace(/\s+/g, ' ').trim().slice(0, 60) || `섹션 ${i + 1}`;
}

/** 이름표(id)가 없는 섹션에 붙여 둠(목록·수정 요청이 섹션을 가리킬 수 있게). 바뀌었으면 새 html, 아니면 그대로 */
export function ensureIds(html) {
  if (!html) return html;
  const doc = parse(html); let changed = false;
  const used = new Set([...doc.querySelectorAll('[id]')].map((e) => e.id));
  topSections(doc).forEach((s, i) => {
    if (s.id) return;
    let id = `lp-s${i + 1}`; let n = 1; while (used.has(id)) id = `lp-s${i + 1}-${++n}`;
    s.id = id; used.add(id); changed = true;
  });
  return changed ? serialize(doc) : html;
}

/** 목록: [{ id, name, hidden, steps }] */
export function listSections(html) {
  const doc = parse(html);
  return topSections(doc).map((s, i) => ({ id: s.id || `#${i}`, name: sectionName(s, i), hidden: s.hasAttribute('hidden'), steps: s.querySelectorAll('[data-lp-step]').length, kits: [...s.querySelectorAll('[data-lp]')].map((e) => e.getAttribute('data-lp')) }));
}
const byId = (doc, id) => topSections(doc).find((s, i) => s.id === id || `#${i}` === id);
/** 그 섹션을 가리키는 바로 가기 링크(머리 메뉴 등) */
const navLinks = (doc, id) => (id ? [...doc.querySelectorAll(`a[href="#${CSS.escape(id)}"]`)] : []);

/** 섹션을 to번째 자리로(다른 섹션들의 자리는 그대로 두고 섹션끼리만 순서를 바꿈) */
export function moveSection(html, id, to) {
  return edit(html, (doc) => {
    const list = topSections(doc); const from = list.findIndex((s, i) => s.id === id || `#${i}` === id);
    if (from < 0 || to < 0 || to >= list.length || from === to) return false;
    const marks = list.map((s) => { const m = doc.createComment('lp-slot'); s.before(m); return m; });
    const order = list.slice(); const [x] = order.splice(from, 1); order.splice(to, 0, x);
    order.forEach((s, i) => marks[i].replaceWith(s));
    // 머리 메뉴의 링크도 같은 순서로(한 목록 안에 모두 있을 때만)
    const links = order.map((s) => navLinks(doc, s.id)[0]).filter(Boolean);
    const box = links[0]?.parentElement?.tagName === 'LI' ? links[0].parentElement.parentElement : links[0]?.parentElement;
    if (box && links.every((a) => (a.parentElement.tagName === 'LI' ? a.parentElement.parentElement : a.parentElement) === box)) {
      const items = links.map((a) => (a.parentElement.tagName === 'LI' ? a.parentElement : a)); // 새 섹션 순서
      const inDoc = [...items].sort((a, b) => (a.compareDocumentPosition(b) & 4 ? -1 : 1)); // 지금 놓인 순서
      const slots = inDoc.map((it) => { const m = doc.createComment('lp-slot'); it.before(m); return m; });
      items.forEach((it, i) => slots[i].replaceWith(it));
    }
    return true;
  });
}
export function setHidden(html, id, hidden) {
  return edit(html, (doc) => {
    const s = byId(doc, id); if (!s) return false;
    if (hidden) s.setAttribute('hidden', ''); else s.removeAttribute('hidden');
    navLinks(doc, s.id).forEach((a) => { const it = a.parentElement?.tagName === 'LI' ? a.parentElement : a; if (hidden) it.setAttribute('hidden', ''); else it.removeAttribute('hidden'); });
    return true;
  });
}
export function removeSection(html, id) {
  return edit(html, (doc) => {
    const s = byId(doc, id); if (!s) return false;
    navLinks(doc, s.id).forEach((a) => (a.parentElement?.tagName === 'LI' ? a.parentElement : a).remove());
    s.remove(); return true;
  });
}
/** 이름 바꾸기: 섹션의 첫 제목 글과 data-title, 그 섹션으로 가는 메뉴 링크 글 */
export function renameSection(html, id, name) {
  const v = String(name || '').trim(); if (!v) return html;
  return edit(html, (doc) => {
    const s = byId(doc, id); if (!s) return false;
    const old = sectionName(s);
    const h = s.querySelector(HEAD);
    if (h && words(h) === old) {
      if (!h.children.length) h.textContent = v;
      else {
        // 제목 안에 꾸밈(번호 <span> 등)이 있으면 그대로 두고 가장 긴 글 조각만 바꿈(번호를 그대로 적었으면 뗌)
        const texts = [...h.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
        const main = texts.sort((a, b) => b.textContent.length - a.textContent.length)[0];
        const keep = [...h.children].map((c) => words(c)).filter(Boolean);
        let rest = v; for (const k of keep) if (rest.startsWith(k)) rest = rest.slice(k.length).trim();
        if (main) main.textContent = rest; else h.textContent = v;
      }
    }
    if (s.hasAttribute('data-title') || !h) s.setAttribute('data-title', v);
    navLinks(doc, s.id).forEach((a) => { if (a.children.length === 0) a.textContent = v; });
    return true;
  });
}
export function sectionHtml(html, id) { const s = byId(parse(html), id); return s ? s.outerHTML : ''; }

// ── 글·그림 번호 ──
const BLOCK = 'h1,h2,h3,h4,h5,h6,p,li,dt,dd,figcaption,blockquote,td,th,caption,summary,label';
const INLINE = 'a,button,span,strong,em,b,small,time';
const SKIP = 'script,style,noscript,template,svg,.lpk,[data-lp],textarea,select,option';
const hasText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
const hasBlockChild = (el) => !!el.querySelector('p,div,ul,ol,section,article,table,h1,h2,h3,h4,h5,h6,figure,blockquote,pre,form');
/** 고칠 수 있는 글 칸·그림(문서 순서). 미리보기와 원본이 같은 순서로 셈 */
function editables(doc) {
  const out = [];
  const walk = (el, inEditable) => {
    for (const c of el.children) {
      if (c.matches(SKIP)) continue;
      if (c.tagName === 'IMG') { out.push(c); continue; }
      const ok = !inEditable && hasText(c) && !hasBlockChild(c) && (c.matches(BLOCK) || c.matches(INLINE));
      if (ok) out.push(c);
      walk(c, inEditable || ok);
    }
  };
  if (doc.body) walk(doc.body, false);
  return out;
}
/** 미리보기용 사본: 글 칸·그림에 data-lpe, 맨 바깥 섹션에 data-lps(=섹션 id) */
export function annotate(html) {
  const doc = parse(html);
  editables(doc).forEach((el, i) => el.setAttribute('data-lpe', String(i)));
  topSections(doc).forEach((s, i) => s.setAttribute('data-lps', s.id || `#${i}`));
  return serialize(doc);
}

const OK_TAGS = new Set(['B', 'STRONG', 'EM', 'I', 'BR', 'A', 'SPAN', 'SMALL', 'MARK', 'CODE', 'SUB', 'SUP', 'U']);
/** 미리보기에서 고친 글(innerHTML)을 안전한 글자 꾸밈만 남겨 정리 */
export function cleanInline(raw) {
  const box = parse(`<div>${String(raw || '')}</div>`).body.firstChild;
  const clean = (el) => {
    for (const c of [...el.childNodes]) {
      if (c.nodeType === 8) { c.remove(); continue; }
      if (c.nodeType !== 1) continue;
      if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|TEMPLATE|NOSCRIPT|SVG|MATH)$/i.test(c.tagName)) { c.remove(); continue; }
      if (c.tagName === 'DIV' || c.tagName === 'P') { c.before(...c.childNodes); c.before(document.createElement('br')); c.remove(); continue; }
      if (!OK_TAGS.has(c.tagName)) { c.replaceWith(...c.childNodes); continue; }
      for (const a of [...c.attributes]) {
        const keep = (c.tagName === 'A' && a.name === 'href' && /^(https?:|mailto:|tel:|#)/i.test(a.value.trim())) || (a.name === 'class' && c.tagName === 'SPAN');
        if (!keep) c.removeAttribute(a.name);
      }
      if (c.tagName === 'A') { c.setAttribute('rel', 'noopener'); }
      clean(c);
    }
  };
  clean(box);
  return box.innerHTML.replace(/(<br>)+$/, '');
}
/** n번째 글 칸의 글을 바꿈 */
export function setText(html, n, raw) {
  return edit(html, (doc) => { const el = editables(doc)[n]; if (!el || el.tagName === 'IMG') return false; el.innerHTML = cleanInline(raw); return true; });
}
/** n번째 그림의 주소·설명을 바꿈 */
export function setImage(html, n, src, alt) {
  return edit(html, (doc) => {
    const el = editables(doc)[n]; if (!el || el.tagName !== 'IMG') return false;
    el.setAttribute('src', src); el.removeAttribute('srcset'); if (alt !== undefined) el.setAttribute('alt', alt);
    return true;
  });
}
export function imageAt(html, n) { const el = editables(parse(html))[n]; return el?.tagName === 'IMG' ? { src: el.getAttribute('src') || '', alt: el.getAttribute('alt') || '' } : null; }

/** 연수 정보를 고치면 사이트 글에 그대로 적힌 옛 값도 함께(글자만, 두 글자 이상) */
export function replaceText(html, from, to) {
  const a = String(from || '').trim(); const b = String(to ?? '').trim();
  if (a.length < 2 || a === b || !html.includes(a)) return html;
  return edit(html, (doc) => {
    let n = 0;
    const w = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode(); t; t = w.nextNode()) {
      if (t.parentElement?.closest('script,style')) continue;
      if (t.textContent.includes(a)) { t.textContent = t.textContent.split(a).join(b); n++; }
    }
    return n > 0;
  });
}

/**
 * 연수 날짜·시간을 바꾸면 사이트에 적힌 같은 날짜·시간도 같은 꼴로(date-text.js): 쪽(.html)의 글과 datetime·data-* 같은 속성,
 * 스크립트(인라인·.js 파일)의 2026-12-03·2026/12/03 꼴(남은 날 세기 같은 코드). before·after: { date, start, end }. 바뀐 것이 없으면 site 그대로
 */
export function replaceSchedule(site, before = {}, after = {}) {
  const dateOn = !!(parseIso(before.date) && parseIso(after.date) && before.date !== after.date);
  const timeOn = !!(before.start && before.end && after.start && after.end && (before.start !== after.start || before.end !== after.end));
  if (!site || (!dateOn && !timeOn)) return site;
  const txt = (s) => { let v = s; if (dateOn) v = swapDate(v, before.date, after.date); if (timeOn) v = swapTimeRange(v, [before.start, before.end], [after.start, after.end]); return v; };
  const slash = (d) => d.replace(/-/g, '/');
  const iso = (s) => (dateOn ? String(s).split(before.date).join(after.date).split(slash(before.date)).join(slash(after.date)) : s);
  let out = site;
  for (const [k, v] of Object.entries(site)) {
    if (typeof v !== 'string') continue;
    const n = /\.html?$/i.test(k) ? scheduleDoc(v, txt, iso) : /\.m?js$/i.test(k) ? iso(v) : v;
    if (n !== v) { if (out === site) out = { ...site }; out[k] = n; }
  }
  return out;
}
const ATTR_DATE = /^(datetime|content|title|aria-label|alt|value|data-[\w-]+)$/i;
function scheduleDoc(html, txt, iso) {
  return edit(html, (doc) => {
    let n = 0;
    const w = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode(); t; t = w.nextNode()) {
      if (t.parentElement?.closest('style')) continue;
      const v = t.parentElement?.closest('script') ? iso(t.textContent) : txt(t.textContent);
      if (v !== t.textContent) { t.textContent = v; n++; }
    }
    for (const el of doc.querySelectorAll('*')) {
      for (const a of [...el.attributes]) {
        if (!ATTR_DATE.test(a.name)) continue;
        const v = txt(a.value); if (v !== a.value) { el.setAttribute(a.name, v); n++; }
      }
    }
    return n > 0;
  });
}

// ── 색·글꼴(--lp-* 변수) ──
/** CSS에서 처음 나온 --lp-이름 값 */
export function getVar(css, name) { const m = new RegExp(`--lp-${name}\\s*:\\s*([^;}{]+)`).exec(String(css || '')); return m ? m[1].trim() : ''; }
/** CSS의 --lp-이름 값을 바꿈(없으면 :root에 더함) */
export function setVar(css, name, value) {
  const s = String(css || ''); const re = new RegExp(`(--lp-${name}\\s*:\\s*)([^;}{]+)`);
  if (re.test(s)) return s.replace(re, (m, a) => a + value);
  return `${s}\n:root{--lp-${name}:${value}}\n`;
}
/** 사이트 CSS가 있는 곳: assets/style.css 또는 index.html 안 첫 <style> */
export function readCss(site) {
  if (site['assets/style.css'] !== undefined) return { where: 'file', css: site['assets/style.css'] };
  const m = /<style[^>]*>([\s\S]*?)<\/style>/i.exec(site['index.html'] || '');
  return { where: 'inline', css: m ? m[1] : '' };
}
export function writeCss(site, css) {
  if (site['assets/style.css'] !== undefined) return { ...site, 'assets/style.css': css };
  const html = site['index.html'] || '';
  if (/<style[^>]*>[\s\S]*?<\/style>/i.test(html)) return { ...site, 'index.html': html.replace(/(<style[^>]*>)[\s\S]*?(<\/style>)/i, (m, a, b) => a + css + b) };
  return { ...site, 'index.html': html.replace('</head>', () => `<style>${css}</style></head>`) };
}
