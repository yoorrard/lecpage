// AI 답에서 HTML·CSS·JSON 꺼내기. 답에는 코드 블록 표시(```), 앞뒤 설명, 잘림, 덜 닫힌 태그가 섞여 옵니다.
// - 꺼내기: extractBlocks · extractHtml · extractCss · extractJson · extractSections
// - 잘림: htmlCut(끝이 덜 됨) · jsonCut · trimToComplete(마지막 완성 태그까지) · stitch(이어 받은 글 이어 붙이기)
// - 합치기: mergeSections(틀 + 섹션) · replaceSections(id로 갈아 끼우기) · balance(덜 닫힌 태그 닫기)
// - 지도: siteMap(사이트 파일·섹션·키트 표시·깨진 경로)
// DOM이 없는 곳(Node 시험)에서도 돌게 정규식·태그 훑기로만 씁니다.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'param']);
const RAW = new Set(['script', 'style', 'textarea', 'title']);
// 끝 태그를 빼도 되는 요소(덜 닫혀도 잘림으로 보지 않음)
const OPTIONAL_END = new Set(['p', 'li', 'dt', 'dd', 'option', 'optgroup', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot', 'colgroup', 'caption', 'rt', 'rp', 'html', 'head', 'body']);

/** 태그 훑기 → [{ name, close, self, start, end, attrs }]. 주석·스크립트·스타일 속은 건너뜀. cut: 태그 중간에서 끝남 */
export function scanTags(html) {
  const s = String(html || '');
  const tags = []; let i = 0; let cut = false;
  const re = /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>|$)|<!(?:doctype|DOCTYPE)[^>]*>|<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(s))) {
    i = re.lastIndex;
    if (!m[2]) { if (m[0].startsWith('<!--') && !m[0].endsWith('-->')) cut = true; continue; }
    const name = m[2].toLowerCase(); const close = !!m[1]; const attrs = m[3] || '';
    const self = !close && (VOID.has(name) || /\/\s*$/.test(attrs));
    tags.push({ name, close, self, start: m.index, end: re.lastIndex, attrs });
    if (!close && RAW.has(name) && !self) {
      const endRe = new RegExp(`</${name}\\s*>`, 'ig'); endRe.lastIndex = re.lastIndex;
      const e = endRe.exec(s);
      if (!e) { cut = true; tags.push({ name, close: true, self: false, start: s.length, end: s.length, attrs: '', missing: true }); i = s.length; break; }
      tags.push({ name, close: true, self: false, start: e.index, end: endRe.lastIndex, attrs: '' });
      re.lastIndex = endRe.lastIndex; i = re.lastIndex;
    }
  }
  // 마지막 태그 뒤에 '<글자'로 시작하는 덜 된 태그가 남았는지
  const tail = s.slice(i);
  if (/<\/?[a-zA-Z][^>]*$/.test(tail) || /<!--(?![\s\S]*-->)/.test(tail)) cut = true;
  return { tags, cut };
}

/** 속성 값 읽기 */
export function attrOf(attrs, name) {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\`]+))`, 'i').exec(attrs || '');
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}

/** 열린 채 남은 요소(끝 태그를 빼도 되는 것 제외) */
export function openStack(html) {
  const { tags, cut } = scanTags(html);
  const st = [];
  for (const t of tags) {
    if (t.self) continue;
    if (!t.close) { st.push(t); continue; }
    if (t.missing) continue;
    // 맞는 열린 태그까지 거슬러 닫음(끝 태그를 뺀 p·li 등은 함께 닫힘)
    for (let k = st.length - 1; k >= 0; k--) if (st[k].name === t.name) { st.length = k; break; }
  }
  return { open: st, cut };
}

/** 코드 블록 꺼내기 → [{ lang, body, closed }]. 닫는 ```가 없으면 끝까지(closed:false) */
export function extractBlocks(text) {
  const s = String(text || '').replace(/\r\n?/g, '\n');
  const out = []; const re = /(^|\n)[ \t]*(`{3,}|~{3,})[ \t]*([\w.+-]*)[^\n]*\n/g;
  let m;
  while ((m = re.exec(s))) {
    const fence = m[2]; const lang = (m[3] || '').toLowerCase(); const from = re.lastIndex;
    const endRe = new RegExp(`\\n[ \\t]*${fence[0] === '`' ? '`' : '~'}{${fence.length},}[ \\t]*(?=\\n|$)`, 'g'); endRe.lastIndex = from - 1;
    const e = endRe.exec(s);
    if (!e) { out.push({ lang, body: s.slice(from), closed: false }); break; }
    out.push({ lang, body: s.slice(from, e.index), closed: true });
    re.lastIndex = endRe.lastIndex;
  }
  return out;
}

const INVISIBLE = /[​-‍⁠﻿]/g;
const clean = (t) => String(t || '').replace(INVISIBLE, '').replace(/\r\n?/g, '\n');

/** 줄마다 붙은 번호(코드 블록을 줄 번호째 복사)를 뗌. 8할 넘는 줄이 1부터 차례로 번호로 시작할 때만 */
export function dropLineNumbers(s) {
  const lines = s.split('\n'); const re = /^\s*(\d{1,5})(?:[.:|)]\s?|\s)/;
  const full = lines.filter((l) => l.trim()); const hit = full.filter((l) => re.test(l));
  if (full.length < 3 || hit.length < full.length * 0.8 || +re.exec(hit[0])[1] > 1) return s;
  return lines.map((l) => l.replace(re, '')).join('\n');
}

/**
 * HTML 꺼내기: ```html 블록 → <!DOCTYPE·<html ~ </html> → 첫 태그부터. 앞뒤 설명 글은 버림.
 * @returns {{ html, doc: boolean(문서 전체인지), cut: boolean(잘림) }}
 */
export function extractHtml(text) {
  const s = dropLineNumbers(clean(text));
  const blocks = extractBlocks(s).filter((b) => /^(html|htm|xml|svg|)$/.test(b.lang) && /<[a-zA-Z!]/.test(b.body));
  let body; let fenceCut = false;
  if (blocks.length) {
    // 가장 긴 블록(문서 전체가 든 것). 같은 문서가 여러 조각으로 나뉘어 왔으면 이어 붙임
    const doc = blocks.find((b) => /<!doctype|<html[\s>]/i.test(b.body));
    const pick = doc || blocks.reduce((a, b) => (b.body.length > a.body.length ? b : a));
    body = pick.body; fenceCut = !pick.closed;
    if (!doc && blocks.length > 1 && blocks.every((b) => /<section[\s>]/i.test(b.body))) body = blocks.map((b) => b.body).join('\n');
  } else body = s;
  let html = body;
  const a = html.search(/<!doctype\s+html|<html[\s>]/i);
  if (a >= 0) html = html.slice(a);
  else { const f = html.search(/<[a-zA-Z!]/); if (f > 0) html = html.slice(f); }
  const endHtml = html.search(/<\/html\s*>/i);
  if (endHtml >= 0) html = html.slice(0, endHtml) + html.slice(endHtml).match(/<\/html\s*>/i)[0];
  else if (!/<!doctype|<html[\s>]/i.test(html)) {
    // 문서가 아니면(섹션 묶음 등) 마지막 닫는 태그 뒤 설명 글을 버림
    const lastClose = html.lastIndexOf('>');
    const after = html.slice(lastClose + 1);
    if (lastClose >= 0 && /[가-힣a-zA-Z]{2}/.test(after) && !/<[a-zA-Z]/.test(after)) html = html.slice(0, lastClose + 1);
  }
  html = html.trim();
  const doc = /<!doctype|<html[\s>]/i.test(html);
  const cut = fenceCut && !/<\/html\s*>\s*$/i.test(html) ? true : htmlCut(html, { doc });
  return { html, doc, cut };
}

/** HTML이 중간에 끊겼는지: 태그 중간에서 끝남, 문서인데 </html>(또는 </body>)이 없음, 섹션·main 등이 안 닫힘 */
export function htmlCut(html, { doc = /<!doctype|<html[\s>]/i.test(html) } = {}) {
  const s = String(html || '').trim();
  if (!s) return false;
  const { open, cut } = openStack(s);
  if (cut) return true;
  if (doc && !/<\/(html|body)\s*>/i.test(s)) return true;
  return open.some((t) => !OPTIONAL_END.has(t.name));
}

/** CSS 꺼내기: ```css 블록(여러 개면 이어 붙임) → <style> 속 → 글 전체(중괄호가 있으면) */
export function extractCss(text) {
  const s = clean(text);
  const blocks = extractBlocks(s).filter((b) => b.lang === 'css' || (!b.lang && /[{};]/.test(b.body) && !/<[a-zA-Z]/.test(b.body)));
  let css = blocks.length ? blocks.map((b) => b.body).join('\n') : '';
  if (!css) { const st = /<style[^>]*>([\s\S]*?)(?:<\/style>|$)/i.exec(s); if (st) css = st[1]; }
  if (!css && /[{}]/.test(s) && !/<[a-zA-Z]/.test(s)) css = s;
  css = css.trim();
  return { css, cut: cssCut(css) || (blocks.length > 0 && !blocks[blocks.length - 1].closed && cssCut(css)) };
}
/** 중괄호·주석이 덜 닫혔으면 잘림 */
export function cssCut(css) {
  const s = String(css || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
  if (/\/\*/.test(s)) return true;
  let d = 0; for (const c of s) { if (c === '{') d++; else if (c === '}') d--; }
  return d > 0;
}
/** CSS를 마지막 완성 규칙까지 자름 */
export function trimCss(css) {
  const s = String(css || ''); let d = 0; let last = 0; let inC = false;
  for (let i = 0; i < s.length; i++) {
    if (!inC && s[i] === '/' && s[i + 1] === '*') { inC = true; i++; continue; }
    if (inC) { if (s[i] === '*' && s[i + 1] === '/') { inC = false; i++; } continue; }
    if (s[i] === '{') d++; else if (s[i] === '}') { d--; if (d === 0) last = i + 1; }
  }
  return s.slice(0, last);
}

/** 문자열 안의 날 줄바꿈·탭을 \n·\t로 */
function escapeRaw(s) {
  let out = ''; let inStr = false; let esc = false;
  for (const c of s) {
    if (inStr) {
      if (esc) { esc = false; out += c; continue; }
      if (c === '\\') { esc = true; out += c; continue; }
      if (c === '"') { inStr = false; out += c; continue; }
      if (c === '\n') { out += '\\n'; continue; }
      if (c === '\r') continue;
      if (c === '\t') { out += '\\t'; continue; }
      out += c; continue;
    }
    if (c === '"') inStr = true;
    out += c;
  }
  return out;
}
/** 첫 { 부터 짝이 맞는 } 까지(문자열 속 괄호는 셈하지 않음). 끝까지 짝이 안 맞으면 cut */
function braceSlice(s, from) {
  let d = 0; let inStr = false; let esc = false;
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') d++;
    else if (c === '}' || c === ']') { d--; if (d === 0) return { text: s.slice(from, i + 1), cut: false }; }
  }
  return { text: s.slice(from), cut: true };
}
function tryParse(t) {
  const tries = [t, t.replace(/,\s*([}\]])/g, '$1'), escapeRaw(t), escapeRaw(t).replace(/,\s*([}\]])/g, '$1'),
    t.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1'), t.replace(/:\s*(?:undefined|NaN)\b/g, ': null')];
  for (const x of tries) { try { return { ok: true, value: JSON.parse(x) }; } catch { /* 다음 */ } }
  return { ok: false };
}

/**
 * JSON 꺼내기: ```json 블록 → 글 속 첫 { … }. 끝의 쉼표·문자열 속 줄바꿈·둥근 따옴표를 고쳐 한 번 더.
 * prefer: 이 키가 있는 객체를 먼저(예: 'sections')
 * @returns {{ value, cut }} value: 못 읽으면 null
 */
export function extractJson(text, { prefer = '' } = {}) {
  const s = clean(text);
  const blocks = extractBlocks(s).filter((b) => /^(json|jsonc|javascript|js|)$/.test(b.lang) && /^\s*[{[]/.test(b.body));
  const cands = [];
  for (const b of blocks) { const k = braceSlice(b.body, b.body.search(/[{[]/)); cands.push({ ...k, cut: k.cut || !b.closed && k.cut }); }
  for (let i = s.indexOf('{'); i >= 0 && cands.length < 12; i = s.indexOf('{', i + 1)) {
    const k = braceSlice(s, i); cands.push(k);
    if (k.cut) break; // 끝까지 안 닫힘: 뒤의 {는 모두 이 안쪽(잘린 바깥 객체의 조각을 답으로 잘못 고르지 않게)
    i += k.text.length - 1;
  }
  let cutSeen = false; const parsed = [];
  for (const c of cands) {
    const r = tryParse(c.text);
    if (r.ok && r.value && typeof r.value === 'object') parsed.push(r.value); else if (c.cut) cutSeen = true;
  }
  const best = (prefer && parsed.find((v) => v && Object.prototype.hasOwnProperty.call(v, prefer))) || parsed.sort((a, b) => JSON.stringify(b).length - JSON.stringify(a).length)[0] || null;
  return { value: best, cut: !best && cutSeen };
}

/**
 * 맨 바깥 <section …>…</section>들 꺼내기 → [{ id, title, html, complete }]. 안에 든 section은 바깥 것에 포함.
 * 덜 닫힌 마지막 섹션은 complete:false
 */
export function extractSections(html) {
  const s = String(html || '');
  const { tags } = scanTags(s);
  const out = []; let depth = 0; let cur = null;
  for (const t of tags) {
    if (t.name !== 'section' || t.self) continue;
    if (!t.close) { if (depth === 0) cur = t; depth++; continue; }
    if (depth === 0) continue;
    depth--;
    if (depth === 0 && cur) {
      const h = s.slice(cur.start, t.end);
      out.push({ id: attrOf(cur.attrs, 'id') || '', title: attrOf(cur.attrs, 'data-title') || headingOf(h), html: h, complete: true });
      cur = null;
    }
  }
  if (cur) { const h = s.slice(cur.start); out.push({ id: attrOf(cur.attrs, 'id') || '', title: attrOf(cur.attrs, 'data-title') || headingOf(h), html: h, complete: false }); }
  return out;
}
export function headingOf(h) {
  const m = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(h || '');
  return m ? m[1].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) : '';
}

/** 마지막 완성 태그까지 자름(덜 된 태그·덜 닫힌 스크립트 앞에서) */
export function trimToComplete(html) {
  let s = String(html || '');
  const { tags } = scanTags(s);
  const miss = tags.find((t) => t.missing);
  if (miss) { const open = tags.filter((t) => t.name === miss.name && !t.close).pop(); if (open) s = s.slice(0, open.start); }
  const lt = s.lastIndexOf('<'); const gt = s.lastIndexOf('>');
  if (lt > gt) s = s.slice(0, lt);
  return s.replace(/&[#\w]{0,10}$/, ''); // 덜 된 문자 참조(&am)
}

/** 덜 닫힌 요소를 닫아 줌(잘린 답을 살려 쓸 때) */
export function balance(html) {
  const s = trimToComplete(html);
  const { open } = openStack(s);
  return s + open.reverse().map((t) => `</${t.name}>`).join('');
}

/**
 * 이어 받은 글의 감싸기 벗기기. 앞 글이 코드 블록 안에서 끊겼는데 뒤 글이 블록을 새로 열었으면(설명 한 줄 + ```html) 그 여는 줄을 뺌.
 * 앞 글에 코드 블록 표시가 아예 없고(코드만 복사) 뒤 글이 블록으로 감싸였으면 첫 블록의 여닫는 줄을 뺌. 그 밖(블록 사이에서 끊김)은 그대로
 */
function bodyOfContinuation(prev, next) {
  const t = clean(next);
  const fences = (String(prev || '').match(/^[ \t]*(`{3,}|~{3,})/gm) || []).length;
  const op = /^\s*(?:[^\n`<{]{0,200}\n)?[ \t]*(`{3,}|~{3,})[ \t]*[\w.+-]*[^\n]*\n/.exec(t);
  if (!op) return t;
  const rest = t.slice(op[0].length);
  if (fences % 2 === 1) return rest;
  if (fences === 0) {
    const close = new RegExp(`(^|\\n)[ \\t]*${op[1][0] === '`' ? '`' : '~'}{${op[1].length},}[ \\t]*(?=\\n|$)`).exec(rest);
    return close ? rest.slice(0, close.index) + rest.slice(close.index + close[0].length) : rest;
  }
  return t;
}

/**
 * 이어 붙이기(조심스럽게: 사이트에는 같은 줄이 자주 되풀이되므로 확실할 때만 겹침을 지움)
 * 1) 뒤 글의 앞 40자 이상이 앞 글의 끝과 똑같으면 한 번만  2) 앞 글이 줄 중간에서 끊겼고 뒤 글이 그 줄을 처음부터 다시 쓰면 그 줄로 바꿈
 * 3) 뒤 글의 첫 줄이 앞 글의 마지막 온전한 줄과 같으면(그 줄부터 다시 씀) 그 줄을 뺌  4) 그 밖은 그대로 이음
 */
export function stitch(prev, next) {
  const a = String(prev || '');
  const b = bodyOfContinuation(a, next);
  if (!a) return b;
  if (!b.trim()) return a;
  const lead = b.match(/^\s*/)[0]; const bs = b.slice(lead.length);
  const max = Math.min(a.length, bs.length, 8000);
  for (let k = max; k >= 40; k--) if (a.endsWith(bs.slice(0, k))) return a + bs.slice(k);
  const nl = a.lastIndexOf('\n'); const frag = a.slice(nl + 1);
  if (frag.trim().length >= 6 && bs.startsWith(frag.trim()) && bs.length > frag.trim().length) return a.slice(0, nl + 1) + frag.match(/^\s*/)[0] + bs;
  if (!frag.trim()) {
    const lines = a.replace(/\s+$/, '').split('\n'); const lastFull = lines[lines.length - 1] || '';
    const first = bs.split('\n')[0];
    if (lastFull.trim().length >= 12 && first.trim() === lastFull.trim()) return a + bs.slice(first.length).replace(/^\n/, '');
  }
  return a + b;
}

export const SECTIONS_MARK = '<!-- lp:sections -->';

/** 틀 HTML(디자인 단계) + 섹션들 → 문서. 표시가 없으면 <main> 안 끝, main도 없으면 </body> 앞 */
export function mergeSections(shell, sectionsHtml) {
  const body = (Array.isArray(sectionsHtml) ? sectionsHtml.join('\n\n') : String(sectionsHtml || '')).trim();
  let s = String(shell || '').trim();
  if (!s) s = skeleton();
  if (s.includes(SECTIONS_MARK)) return s.replace(SECTIONS_MARK, () => body);
  const mainEnd = s.search(/<\/main\s*>/i);
  if (mainEnd >= 0) return s.slice(0, mainEnd) + body + '\n' + s.slice(mainEnd);
  const bodyEnd = s.search(/<\/body\s*>/i);
  if (bodyEnd >= 0) return s.slice(0, bodyEnd) + `<main>\n${body}\n</main>\n` + s.slice(bodyEnd);
  return s + `\n<main>\n${body}\n</main>`;
}
export function skeleton(title = '') {
  return `<!DOCTYPE html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${String(title).replace(/</g, '&lt;')}</title>\n<link rel="stylesheet" href="assets/style.css">\n</head>\n<body>\n<main>\n${SECTIONS_MARK}\n</main>\n</body>\n</html>`;
}

/** 문서 속 섹션을 id로 갈아 끼움. 없는 id는 main 끝에 덧붙임. 돌려줌: { html, replaced:[id], added:[id] } */
export function replaceSections(html, sections) {
  let s = String(html || '');
  const replaced = []; const added = [];
  for (const sec of sections) {
    const cur = extractSections(s).find((x) => x.id && x.id === sec.id);
    if (cur) { const at = s.indexOf(cur.html); s = s.slice(0, at) + sec.html + s.slice(at + cur.html.length); replaced.push(sec.id); }
    else { s = mergeSections(s.includes(SECTIONS_MARK) ? s : s, [sec.html]); added.push(sec.id); }
  }
  return { html: s, replaced, added };
}
/** 섹션 빼기(id) */
export function removeSection(html, id) {
  const cur = extractSections(html).find((x) => x.id === id);
  if (!cur) return html;
  const at = html.indexOf(cur.html);
  return html.slice(0, at) + html.slice(at + cur.html.length);
}

const KIT_RE = /\bdata-lp\s*=\s*["']([\w-]+)["']/g;
const REF_RE = /\b(?:src|href|poster|data-src)\s*=\s*["']([^"'#?]+)[^"']*["']|url\(\s*["']?([^"')?#]+)[^)]*\)/gi;

/**
 * 사이트 파일 지도: files(경로 → 글·바이트) + 교재 쪽 그림 목록 → { files:[{ path, kind, bytes }], pages:[html 경로],
 * sections:[{ file, id, title, kit:[…], steps:n }], kit:{ 종류: 수 }, refs:[{ from, ref }], missing:[{ from, ref }] }
 */
export function siteMap(site = {}, { material = [] } = {}) {
  const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  const size = (v) => (typeof v === 'string' ? (enc ? enc.encode(v).length : v.length) : v?.byteLength ?? v?.size ?? 0);
  const kindOf = (p) => (/\.html?$/i.test(p) ? 'html' : /\.css$/i.test(p) ? 'css' : /\.m?js$/i.test(p) ? 'js' : /^material\//.test(p) ? 'material' : /\.(png|jpe?g|webp|gif|avif)$/i.test(p) ? 'image' : /\.json$/i.test(p) ? 'json' : 'other');
  const have = new Set([...Object.keys(site), ...material]);
  const files = Object.keys(site).sort().map((path) => ({ path, kind: kindOf(path), bytes: size(site[path]) }));
  for (const m of material) if (!site[m]) files.push({ path: m, kind: 'material', bytes: 0 });
  const sections = []; const kit = {}; const refs = []; const missing = [];
  for (const [path, v] of Object.entries(site)) {
    if (typeof v !== 'string') continue;
    const k = kindOf(path);
    if (k !== 'html' && k !== 'css') continue;
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
    for (const m of v.matchAll(REF_RE)) {
      const ref = (m[1] || m[2] || '').trim();
      if (!ref || /^(https?:|data:|mailto:|tel:|javascript:|\/\/|#)/i.test(ref)) continue;
      const abs = resolveRef(dir, ref);
      refs.push({ from: path, ref: abs });
      if (!have.has(abs)) missing.push({ from: path, ref: abs });
    }
    if (k !== 'html') continue;
    for (const m of v.matchAll(KIT_RE)) kit[m[1]] = (kit[m[1]] || 0) + 1;
    for (const sec of extractSections(v)) {
      const types = [...sec.html.matchAll(KIT_RE)].map((m) => m[1]);
      sections.push({ file: path, id: sec.id, title: sec.title, kit: [...new Set(types)], steps: (sec.html.match(/data-lp-step\s*=/g) || []).length });
    }
  }
  return { files, pages: files.filter((f) => f.kind === 'html').map((f) => f.path), sections, kit, refs, missing };
}
function resolveRef(dir, ref) {
  const parts = (dir + ref.replace(/^\.\//, '')).split('/'); const out = [];
  for (const p of parts) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); }
  return decodeURI(out.join('/'));
}

/**
 * 쓰던 AI 창의 답(사이트 전체): HTML 문서 + 맨 끝 lecpage.json(```json 블록이나 <script type="application/json" id="lecpage">)
 * @returns {{ html, doc, cut, meta: object|null }}
 */
export function parseChatAnswer(text) {
  const s = clean(text);
  const h = extractHtml(s);
  let meta = null;
  // 문서 안에 넣은 JSON(<script type="application/json" id="lecpage…">)은 빼서 meta로
  const inDoc = /<script[^>]*type=["']application\/(?:ld\+)?json["'][^>]*id=["']lecpage[\w-]*["'][^>]*>([\s\S]*?)<\/script>|<script[^>]*id=["']lecpage[\w-]*["'][^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i.exec(h.html);
  if (inDoc) { const j = extractJson(inDoc[1] || inDoc[2]).value; if (j) meta = j; h.html = h.html.replace(inDoc[0], ''); }
  if (!meta) {
    const end = s.search(/<\/html\s*>/i);
    const after = end >= 0 ? s.slice(end) : '';
    const blocks = extractBlocks(after || s).filter((b) => /^(json|jsonc|)$/.test(b.lang) && /^\s*\{/.test(b.body));
    const b = blocks[blocks.length - 1];
    if (b) meta = extractJson('```json\n' + b.body + '\n```').value;
    else if (after) meta = extractJson(after, { prefer: 'title' }).value;
  }
  return { ...h, meta: meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : null };
}
