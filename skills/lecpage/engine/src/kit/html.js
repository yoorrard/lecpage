// AI가 쓴 HTML을 다루는 작은 도구(브라우저·Node 공통, 의존성 없음). 완전한 HTML 파서가 아니라
// 태그 위치·속성을 찾고(<script>·<style> 안은 글자 그대로 건너뜀) 짝이 되는 닫는 태그를 찾는 데까지만 합니다.

export const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'param']);
const RAW = new Set(['script', 'style', 'textarea', 'title', 'noscript', 'xmp']);

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
/** 속성 값의 문자 참조(&amp; &quot; &#39; &#x27; …)를 글자로 */
export function decodeEntities(s) {
  return String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
    return ENT[e.toLowerCase()] ?? m;
  });
}
export const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const escAttr = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * 태그 목록: { kind:'open'|'close'|'comment'|'decl', name, attrs:[{name,value}], start, end, selfClose, rawEnd? }
 * 여는 <script>·<style>·<textarea>·<title>는 안쪽 글을 건너뛰고 contentStart·contentEnd(닫는 태그 앞)를 적음
 */
export function scanTags(html) {
  const s = String(html || ''); const out = []; const n = s.length; let i = 0;
  while (i < n) {
    const lt = s.indexOf('<', i);
    if (lt < 0) break;
    if (s.startsWith('<!--', lt)) { const e = s.indexOf('-->', lt + 4); const end = e < 0 ? n : e + 3; out.push({ kind: 'comment', name: '#comment', attrs: [], start: lt, end }); i = end; continue; }
    if (s[lt + 1] === '!' || s[lt + 1] === '?') { const e = s.indexOf('>', lt); const end = e < 0 ? n : e + 1; out.push({ kind: 'decl', name: s.slice(lt + 2, Math.min(end, lt + 12)).split(/\s/)[0].toLowerCase(), attrs: [], start: lt, end }); i = end; continue; }
    const close = s[lt + 1] === '/';
    const m = /^[a-zA-Z][a-zA-Z0-9:-]*/.exec(s.slice(lt + (close ? 2 : 1), lt + 64));
    if (!m) { i = lt + 1; continue; }
    const name = m[0].toLowerCase();
    let p = lt + (close ? 2 : 1) + m[0].length;
    const attrs = []; let selfClose = false;
    while (p < n) {
      while (p < n && /\s/.test(s[p])) p++;
      if (s[p] === '>') { p++; break; }
      if (s[p] === '/' && s[p + 1] === '>') { selfClose = true; p += 2; break; }
      if (s[p] === '/') { p++; continue; }
      const a0 = p;
      while (p < n && !/[\s=>]/.test(s[p]) && !(s[p] === '/' && s[p + 1] === '>')) p++;
      const an = s.slice(a0, p).toLowerCase();
      while (p < n && /\s/.test(s[p])) p++;
      let value = null;
      if (s[p] === '=') {
        p++; while (p < n && /\s/.test(s[p])) p++;
        const q = s[p];
        if (q === '"' || q === "'") { const e = s.indexOf(q, p + 1); const ve = e < 0 ? n : e; value = s.slice(p + 1, ve); p = ve + 1; }
        else { const v0 = p; while (p < n && !/[\s>]/.test(s[p])) p++; value = s.slice(v0, p); }
      }
      if (an) attrs.push({ name: an, value: value === null ? '' : decodeEntities(value), bare: value === null });
    }
    const tag = { kind: close ? 'close' : 'open', name, attrs, start: lt, end: p, selfClose };
    out.push(tag);
    i = p;
    if (!close && RAW.has(name) && !selfClose) {
      const re = new RegExp(`</${name}\\s*>`, 'ig'); re.lastIndex = p;
      const mm = re.exec(s);
      tag.contentStart = p; tag.contentEnd = mm ? mm.index : n;
      if (mm) { out.push({ kind: 'close', name, attrs: [], start: mm.index, end: mm.index + mm[0].length }); i = mm.index + mm[0].length; } else i = n;
    }
  }
  return out;
}

export const attr = (tag, name) => { const a = tag?.attrs?.find((x) => x.name === name); return a ? a.value : undefined; };
export const hasAttr = (tag, name) => !!tag?.attrs?.some((x) => x.name === name);

/** 여는 태그(목록의 k번째)와 짝이 되는 닫는 태그: { open, close, innerStart, innerEnd, end }. 짝이 없으면 close=null(문서 끝까지) */
export function elementAt(tags, k, html) {
  const open = tags[k];
  if (!open || open.kind !== 'open') return null;
  // 빈 요소(img 등)와 <div … />처럼 스스로 닫은 꼴: 안이 비었다고 봄(조립은 닫는 태그를 붙여 다시 씀)
  if (VOID.has(open.name) || open.selfClose) return { open, close: null, innerStart: open.end, innerEnd: open.end, end: open.end, k, closeK: k, empty: true };
  if (open.contentStart !== undefined) { const c = tags[k + 1]; return { open, close: c || null, innerStart: open.contentStart, innerEnd: open.contentEnd, end: c ? c.end : String(html || '').length, k, closeK: k + 1 }; }
  let depth = 0;
  for (let j = k + 1; j < tags.length; j++) {
    const t = tags[j];
    if (t.name !== open.name) continue;
    if (t.kind === 'open' && !t.selfClose) depth++;
    else if (t.kind === 'close') { if (depth === 0) return { open, close: t, innerStart: open.end, innerEnd: t.start, end: t.end, k, closeK: j }; depth--; }
  }
  const len = String(html || '').length;
  return { open, close: null, innerStart: open.end, innerEnd: len, end: len, k, closeK: tags.length };
}

/** 여는 태그를 다시 씀(속성 순서 유지). set: {이름: 값|null(지움)}, addClass: 더할 class */
export function rewriteOpen(tag, { set = {}, addClass = '' } = {}) {
  const attrs = tag.attrs.map((a) => ({ ...a }));
  for (const [k, v] of Object.entries(set)) {
    const i = attrs.findIndex((a) => a.name === k);
    if (v === null) { if (i >= 0) attrs.splice(i, 1); continue; }
    if (i >= 0) attrs[i] = { name: k, value: String(v), bare: false }; else attrs.push({ name: k, value: String(v), bare: false });
  }
  if (addClass) {
    const i = attrs.findIndex((a) => a.name === 'class');
    const cur = i >= 0 ? attrs[i].value.split(/\s+/).filter(Boolean) : [];
    for (const c of addClass.split(/\s+/)) if (c && !cur.includes(c)) cur.push(c);
    if (i >= 0) attrs[i].value = cur.join(' '); else attrs.push({ name: 'class', value: cur.join(' ') });
  }
  return `<${tag.name}${attrs.map((a) => (a.bare && a.value === '' ? ` ${a.name}` : ` ${a.name}="${escAttr(a.value)}"`)).join('')}>`;
}

/** 여러 자리 고치기를 한 번에(뒤에서부터). edits: [{start,end,text}] — 겹치면 뒤의 것(시작이 먼저인 것)을 버림 */
export function applyEdits(html, edits) {
  const list = edits.slice().sort((a, b) => b.start - a.start || b.end - a.end);
  let s = String(html); let floor = Infinity;
  for (const e of list) {
    if (e.end > floor) continue;
    s = s.slice(0, e.start) + e.text + s.slice(e.end);
    floor = e.start;
  }
  return s;
}

/** 태그 안 글자(태그·주석·스크립트 빼고). 대략적인 보이는 글 길이를 셀 때 */
export function textOf(html) {
  return decodeEntities(String(html || '').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|template|noscript)\b[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** 상대 경로를 사이트 안 경로로(page: 그 경로가 적힌 파일). 바깥 주소·앵커·data:는 null */
export function resolvePath(ref, from = 'index.html') {
  const r = String(ref || '').trim();
  if (!r || /^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(r)) return null;
  const clean = r.split('#')[0].split('?')[0];
  if (!clean) return null;
  let dec; try { dec = decodeURIComponent(clean); } catch { dec = clean; }
  const base = dec.startsWith('/') ? [] : String(from).split('/').slice(0, -1);
  for (const part of dec.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { if (!base.length) return '..'; base.pop(); } else base.push(part);
  }
  return base.join('/');
}
