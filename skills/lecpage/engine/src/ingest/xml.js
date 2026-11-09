// 작은 XML 해석기(브라우저 DOMParser가 없는 Node에서도 같은 결과).
// OOXML(PPTX·DOCX)·OWPML(HWPX)을 읽기에 충분한 만큼만 구현합니다.
// 노드: { name:'a:t', local:'t', attrs:{...}, children:[노드|문자열], parent }

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00A0' };

export function decodeEntities(s) {
  if (!s || s.indexOf('&') < 0) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, e) => {
    if (e[0] === '#') {
      const cp = (e[1] === 'x' || e[1] === 'X') ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!Number.isFinite(cp) || cp <= 0 || cp > 0x10FFFF) return '';
      try { return String.fromCodePoint(cp); } catch { return ''; }
    }
    return ENT[e] ?? m;
  });
}

const ATTR_RE = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** XML 문자열 → 뿌리 노드(#root). 잘못된 XML도 최대한 읽고, 던지지 않습니다. */
export function parseXml(src) {
  const root = { name: '#root', local: '#root', attrs: {}, children: [], parent: null };
  if (!src) return root;
  let s = String(src);
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  const n = s.length;
  let cur = root;
  let i = 0;
  while (i < n) {
    const lt = s.indexOf('<', i);
    if (lt < 0) { addText(cur, s.slice(i)); break; }
    if (lt > i) addText(cur, s.slice(i, lt));
    const c1 = s.charCodeAt(lt + 1);
    if (c1 === 33 /* ! */) {
      if (s.startsWith('<!--', lt)) { const e = s.indexOf('-->', lt + 4); i = e < 0 ? n : e + 3; continue; }
      if (s.startsWith('<![CDATA[', lt)) {
        const e = s.indexOf(']]>', lt + 9);
        cur.children.push(s.slice(lt + 9, e < 0 ? n : e));
        i = e < 0 ? n : e + 3; continue;
      }
      // DOCTYPE 등: 내부 [ ] 를 건너뜀
      let j = lt + 2, depth = 0;
      for (; j < n; j++) { const c = s[j]; if (c === '[') depth++; else if (c === ']') depth--; else if (c === '>' && depth <= 0) break; }
      i = j + 1; continue;
    }
    if (c1 === 63 /* ? */) { const e = s.indexOf('?>', lt + 2); i = e < 0 ? n : e + 2; continue; }
    if (c1 === 47 /* / */) {
      const e = s.indexOf('>', lt + 2);
      const name = s.slice(lt + 2, e < 0 ? n : e).trim();
      let node = cur;
      while (node && node !== root && node.name !== name) node = node.parent;
      if (node && node !== root) cur = node.parent;
      i = e < 0 ? n : e + 1; continue;
    }
    // 시작 태그: 따옴표 안의 '>'는 무시
    let j = lt + 1, q = 0;
    for (; j < n; j++) {
      const c = s.charCodeAt(j);
      if (q) { if (c === q) q = 0; } else if (c === 34 || c === 39) q = c; else if (c === 62) break;
    }
    let inner = s.slice(lt + 1, j);
    const selfClose = inner.endsWith('/');
    if (selfClose) inner = inner.slice(0, -1);
    const sp = inner.search(/[\s]/);
    const name = sp < 0 ? inner : inner.slice(0, sp);
    const attrs = {};
    if (sp >= 0) {
      const rest = inner.slice(sp);
      ATTR_RE.lastIndex = 0;
      let a;
      while ((a = ATTR_RE.exec(rest))) attrs[a[1]] = decodeEntities(a[2] !== undefined ? a[2] : (a[3] || ''));
    }
    const ci = name.indexOf(':');
    const el = { name, local: ci < 0 ? name : name.slice(ci + 1), attrs, children: [], parent: cur };
    cur.children.push(el);
    if (!selfClose) cur = el;
    i = j + 1;
  }
  return root;
}

function addText(node, raw) {
  if (!raw) return;
  node.children.push(decodeEntities(raw));
}

// ── 찾기 도우미(이름은 접두사 없이 local 이름으로 비교) ───────────
export const isEl = (x) => x && typeof x === 'object';

export function kids(el, local) {
  if (!el) return [];
  const out = [];
  for (const c of el.children) if (isEl(c) && (!local || c.local === local)) out.push(c);
  return out;
}
export function kid(el, local) {
  if (!el) return null;
  for (const c of el.children) if (isEl(c) && c.local === local) return c;
  return null;
}
/** 자손 전체(문서 순서). stop(local)이 참인 노드 안으로는 들어가지 않음 */
export function all(el, local, stop) {
  const out = [];
  if (!el) return out;
  const walk = (n) => {
    for (const c of n.children) {
      if (!isEl(c)) continue;
      if (c.local === local) out.push(c);
      if (stop && stop(c)) continue;
      walk(c);
    }
  };
  walk(el);
  return out;
}
export function first(el, local) {
  if (!el) return null;
  for (const c of el.children) {
    if (!isEl(c)) continue;
    if (c.local === local) return c;
    const f = first(c, local);
    if (f) return f;
  }
  return null;
}
/** 경로로 찾기: path('spPr','xfrm','off') */
export function path(el, ...locals) {
  let n = el;
  for (const l of locals) { n = kid(n, l); if (!n) return null; }
  return n;
}
/** 안쪽 글자 전부 */
export function textOf(el) {
  if (!el) return '';
  if (typeof el === 'string') return el;
  let s = '';
  for (const c of el.children) s += typeof c === 'string' ? c : textOf(c);
  return s;
}
/** 속성: 정확한 이름 → 같은 local 이름(접두사 무시) */
export function attr(el, name) {
  if (!el) return undefined;
  if (el.attrs[name] !== undefined) return el.attrs[name];
  if (name.indexOf(':') < 0) {
    for (const k in el.attrs) { const i = k.indexOf(':'); if (i >= 0 && k.slice(i + 1) === name && !k.startsWith('xmlns')) return el.attrs[k]; }
  }
  return undefined;
}
/** 관계 id 속성(r:id, r:embed, r:link, r:dm 등). 접두사가 있는 것만 */
export function relAttr(el, local = 'id') {
  if (!el) return undefined;
  for (const k in el.attrs) {
    const i = k.indexOf(':');
    if (i > 0 && k.slice(i + 1) === local && !k.startsWith('xmlns')) return el.attrs[k];
  }
  return undefined;
}
