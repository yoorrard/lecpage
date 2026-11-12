#!/usr/bin/env node
// 문구 검사: 앱 화면 글(app/src)과 강의 페이지의 고정 문구(engine/runtime, engine/src/render)를 뽑아
// 문구 규칙(skills/lecpage/engine/src/prompt/copy-rules.js)과 용어 통일 표(docs/writing.md 4절)로 점검합니다.
//
// 쓰는 법(저장소 어디서든):
//   node app/scripts/copy-lint.mjs                 요약과 고칠 곳 목록
//   node app/scripts/copy-lint.mjs --json          [{ file, line, kind, text, rule, level, hit, fix }]
//   node app/scripts/copy-lint.mjs --report        docs/research/copy-audit-*.md에 넣는 표(규칙별 건수·용어·글 양)
//   node app/scripts/copy-lint.mjs --dump          뽑은 문구 전부(점검 없이). 문구를 한눈에 읽을 때
//   node app/scripts/copy-lint.mjs app/src/pages   일부 폴더·파일만
//   --strict  warn도 실패로(종료 코드 1)    --app | --page  한쪽만
// 한 줄을 봐주려면 그 줄이나 바로 윗줄 주석에 copy-ok: 까닭 을 적습니다.
//
// JSX를 읽으려고 앱의 개발 의존성에 딸려 오는 @babel/parser를 씁니다(app에서 npm ci를 한 뒤 실행).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const ENGINE = join(ROOT, 'skills', 'lecpage', 'engine');
const { lintText, TERM_RULES } = await import(pathToFileURL(join(ENGINE, 'src', 'prompt', 'copy-rules.js')).href);

const HANGUL = /[가-힣]/;
const rel = (p) => relative(ROOT, p).split(sep).join('/');

// ── 점검할 파일 ──
const DEFAULTS = [
  { dir: join(ROOT, 'app', 'src'), group: 'app', ext: /\.(jsx|js)$/ },
  { dir: join(ENGINE, 'runtime'), group: 'page', ext: /\.js$/, skip: /(^|\/)vendor\/|\/fx\/effects\/|demo-boot\.js$/ },
  { dir: join(ENGINE, 'src', 'render'), group: 'page', ext: /\.js$/ },
];
function listFiles(dir, ext, skip) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name); const st = statSync(p);
    if (st.isDirectory()) { if (name !== 'node_modules') out.push(...listFiles(p, ext, skip)); continue; }
    if (ext.test(name) && !(skip && skip.test(rel(p)))) out.push(p);
  }
  return out;
}
export function targets(paths = [], only = '') {
  if (paths.length) {
    return paths.flatMap((x) => {
      const p = resolve(x); if (!existsSync(p)) return [];
      const group = rel(p).startsWith('app/') ? 'app' : 'page';
      return (statSync(p).isDirectory() ? listFiles(p, /\.(jsx|js)$/, /(^|\/)vendor\//) : [p]).map((file) => ({ file, group }));
    });
  }
  return DEFAULTS.filter((d) => !only || d.group === only).flatMap((d) => listFiles(d.dir, d.ext, d.skip).map((file) => ({ file, group: d.group })));
}

// ── 문구 뽑기 ──
let parser = null;
function loadParser() {
  if (parser) return parser;
  for (const from of [join(ROOT, 'app', 'package.json'), import.meta.url]) {
    try { parser = createRequire(from)('@babel/parser'); return parser; } catch { /* 다음 */ }
  }
  return null;
}

// 문장 속에 섞여 쓰이는 태그(앞뒤 글과 한 문구로 읽음)
const INLINE = new Set(['b', 'strong', 'em', 'i', 'code', 'span', 'a', 'kbd', 'u', 'mark', 'small', 'sub', 'sup', 'abbr', 's', 'wbr', 'q', 'cite']);
const TITLE_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'legend', 'summary', 'th', 'dt', 'caption']);
// 화면에 보이지 않는 값으로 쓰는 문자열(찾기·비교·저장 열쇠)
const SKIP_METHODS = new Set(['includes', 'startsWith', 'endsWith', 'indexOf', 'lastIndexOf', 'split', 'replace', 'replaceAll', 'match', 'matchAll', 'test', 'exec', 'search', 'localeCompare', 'has', 'getItem', 'setItem', 'removeItem', 'querySelector', 'querySelectorAll', 'getElementById', 'addEventListener', 'removeEventListener', 'closest', 'matches', 'getAttribute', 'hasAttribute', 'removeAttribute', 'normalize', 'padStart', 'padEnd']);
const SKIP_CALLS = new Set(['RegExp', 'require', 'import', 'Symbol', 'CustomEvent', 'Event']);
const SKIP_ATTRS = new Set(['class', 'className', 'id', 'key', 'style', 'href', 'src', 'type', 'name', 'for', 'htmlFor', 'role', 'value', 'data-kind', 'accept', 'target', 'rel', 'lang', 'd', 'viewBox']);
const ATTR_KIND = { 'aria-label': 'aria', title: 'aria', alt: 'aria', 'aria-description': 'aria', 'aria-roledescription': 'aria', placeholder: 'placeholder', label: 'label', hint: 'text', 'data-tip': 'aria' };
const PROP_KIND = { label: 'label', title: 'title', t: 'title', name: 'title', heading: 'title', placeholder: 'placeholder', cta: 'button', btn: 'button', button: 'button', next: 'button' };
const CALL_KIND = { toast: 'toast', Error: 'error', AiError: 'error', TypeError: 'error', RangeError: 'error', confirm: 'confirm', alert: 'confirm', prompt: 'confirm', fail: 'error' };

const nameOf = (n) => !n ? '' : n.type === 'JSXIdentifier' || n.type === 'Identifier' ? n.name : n.type === 'JSXMemberExpression' ? `${nameOf(n.object)}.${nameOf(n.property)}` : n.type === 'StringLiteral' ? n.value : '';
const calleeName = (c) => !c ? '' : c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' || c.type === 'OptionalMemberExpression' ? nameOf(c.property) : '';
const isStr = (n) => n && (n.type === 'StringLiteral' || n.type === 'TemplateLiteral');
const squash = (s) => s.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();

/** JSX 글 노드의 공백을 화면에 보이는 대로 */
function jsxText(v) {
  if (!v.includes('\n')) return v;
  const lines = v.split('\n');
  return lines.map((l, i) => (i === 0 ? l.trimEnd() : i === lines.length - 1 ? l.trimStart() : l.trim())).filter(Boolean).join(' ');
}
/** 템플릿 문자열을 한 줄 글로: 끼워 넣는 값은 {…}. marks: [글 속 위치, 소스 줄] */
function flatTemplate(n) {
  let text = ''; const marks = [];
  n.quasis.forEach((q, i) => { marks.push([text.length, q.loc.start.line]); text += q.value.cooked ?? q.value.raw; if (i < n.expressions.length) text += '{…}'; });
  return { text, marks };
}
const strValue = (n) => (n.type === 'StringLiteral' ? { text: n.value, marks: [[0, n.loc.start.line]] } : flatTemplate(n));
function lineAt({ text, marks }, idx) {
  let m = marks[0]; for (const x of marks) { if (x[0] <= idx) m = x; else break; }
  return m[1] + (text.slice(m[0], idx).match(/\n/g) || []).length;
}
function hasJSX(n) {
  if (!n || typeof n !== 'object') return false;
  if (n.type === 'JSXElement' || n.type === 'JSXFragment') return true;
  for (const k in n) { if (k === 'loc' || k === 'leadingComments' || k === 'trailingComments') continue; const v = n[k]; if (Array.isArray(v) ? v.some(hasJSX) : v && typeof v.type === 'string' && hasJSX(v)) return true; }
  return false;
}

/** HTML이 든 문자열(엔진이 그리는 쪽): 태그 사이 글과 이름표 속성을 따로 뽑음 */
function htmlPieces(val, baseKind) {
  const out = []; const { text } = val;
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  let last = 0; let kind = baseKind; let m; const stack = [];
  const push = (seg, at, k) => { const t = squash(seg.replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')); if (HANGUL.test(t)) out.push({ text: t, kind: k, line: lineAt(val, at + (seg.length - seg.trimStart().length)) }); };
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index), last, kind); last = re.lastIndex;
    const tag = m[2].toLowerCase(); const attrs = m[3] || '';
    for (const a of attrs.matchAll(/\b(aria-label|placeholder|title|alt|data-tip)\s*=\s*"([^"]*)"/g)) if (HANGUL.test(a[2])) out.push({ text: squash(a[2]), kind: ATTR_KIND[a[1]] || 'aria', line: lineAt(val, m.index + a.index) });
    if (m[1]) { stack.pop(); kind = stack[stack.length - 1] || baseKind; continue; }
    if (/^(br|hr|img|input|meta|link|wbr)$/.test(tag) || /\/\s*$/.test(attrs)) continue;
    if (INLINE.has(tag) && !/class="[^"]*\b(btn|lp-btn|button)\b/.test(attrs)) { stack.push(kind); continue; }
    kind = tag === 'button' || /class="[^"]*\b(btn|lp-btn|button)\b/.test(attrs) ? 'button' : TITLE_TAGS.has(tag) ? 'title' : tag === 'label' ? 'label' : tag === 'script' || tag === 'style' ? 'skip' : 'text';
    stack.push(kind);
  }
  push(text.slice(last), last, kind);
  return out.filter((x) => x.kind !== 'skip');
}

export function extract(source, file = 'x.jsx') {
  const P = loadParser();
  if (!P) throw new Error('@babel/parser를 찾지 못했어요. app 폴더에서 npm ci를 한 뒤 다시 실행해 주세요.');
  const ast = P.parse(source, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true, allowReturnOutsideFunction: true });
  const okLines = new Set();
  for (const c of ast.comments || []) if (/copy-ok\b/.test(c.value)) { okLines.add(c.loc.end.line); okLines.add(c.loc.end.line + 1); }
  const units = []; const seen = new Set();
  const add = (text, kind, line, where = '') => {
    const t = squash(String(text)); if (!HANGUL.test(t) || okLines.has(line)) return;
    const k = `${line}|${t}`; if (seen.has(k)) return; seen.add(k);
    units.push({ file, line, kind, text: t, where });
  };
  const addStr = (n, kind, where) => {
    const val = strValue(n);
    if (/<[a-zA-Z][^>]*>/.test(val.text)) { for (const p of htmlPieces(val, kind)) add(p.text, p.kind, p.line, where || 'html'); return; }
    add(val.text.replace(/\n{2,}/g, '\n'), kind, n.loc.start.line, where);
  };

  const elKind = (el) => {
    const tag = nameOf(el.openingElement.name); const attrs = el.openingElement.attributes;
    const attr = (k) => { const a = attrs.find((x) => x.type === 'JSXAttribute' && nameOf(x.name) === k); return a?.value?.type === 'StringLiteral' ? a.value.value : a?.value?.type === 'JSXExpressionContainer' && isStr(a.value.expression) ? strValue(a.value.expression).text : ''; };
    const cls = attr('class') || attr('className'); const role = attr('role');
    if (tag === 'button' || role === 'button' || role === 'tab' || /\bbtn\b|\bbtn-/.test(cls)) return 'button';
    if (TITLE_TAGS.has(tag) || tag === 'StepHead') return 'title';
    if (tag === 'label' || tag === 'Field') return 'label';
    if (tag === 'option') return 'label';
    return 'text';
  };
  const isInlineEl = (el) => INLINE.has(nameOf(el.openingElement.name)) && elKind(el) !== 'button';

  /** 식 안을 걸으며 JSX와 문자열을 찾음. ctx: { kind, where, skip } */
  function visit(n, parent, ctx) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { for (const x of n) visit(x, parent, ctx); return; }
    if (typeof n.type !== 'string') return;
    switch (n.type) {
      case 'JSXElement': scope(n, ctx); return;
      case 'JSXFragment': children(n.children, "text", n.loc.start.line); return;
      case 'ImportDeclaration': case 'ExportAllDeclaration': case 'TSTypeAnnotation': case 'RegExpLiteral': case 'Directive': return;
      case 'StringLiteral': case 'TemplateLiteral': {
        if (n.type === 'TemplateLiteral') for (const e of n.expressions) visit(e, n, ctx);
        if (!ctx.skip) addStr(n, ctx.kind || 'text', ctx.where);
        return;
      }
      case 'TaggedTemplateExpression': visit(n.quasi.expressions, n, ctx); return;
      case 'BinaryExpression': {
        if (['===', '!==', '==', '!=', 'in', 'instanceof'].includes(n.operator)) { visit(n.left, n, { ...ctx, skip: true }); visit(n.right, n, { ...ctx, skip: true }); return; }
        if (n.operator === '+') {
          // 'A' + x + 'B' → 한 문구 "A{…}B"
          const leaves = []; (function flat(x) { if (x.type === 'BinaryExpression' && x.operator === '+') { flat(x.left); flat(x.right); } else leaves.push(x); })(n);
          if (leaves.some((x) => isStr(x) && HANGUL.test(strValue(x).text))) {
            const text = leaves.map((x) => (x.type === 'StringLiteral' ? x.value : x.type === 'TemplateLiteral' ? flatTemplate(x).text : '{…}')).join('');
            if (!ctx.skip) { if (/<[a-zA-Z][^>]*>/.test(text)) { for (const x of leaves) if (isStr(x)) addStr(x, ctx.kind || 'text', ctx.where); } else add(text, ctx.kind || 'text', n.loc.start.line, ctx.where); }
            for (const x of leaves) { if (x.type === 'TemplateLiteral') visit(x.expressions, x, ctx); else if (!isStr(x)) visit(x, n, ctx); }
            return;
          }
        }
        break;
      }
      case 'SwitchCase': visit(n.test, n, { ...ctx, skip: true }); visit(n.consequent, n, ctx); return;
      case 'ObjectProperty': case 'Property': {
        if (n.computed) visit(n.key, n, { ...ctx, skip: true });
        const key = nameOf(n.key);
        visit(n.value, n, { ...ctx, kind: PROP_KIND[key] || (ctx.kind && ctx.kind !== 'text' && !PROP_KIND[key] ? ctx.kind : 'text'), where: ctx.where || key });
        return;
      }
      case 'CallExpression': case 'OptionalCallExpression': case 'NewExpression': {
        const name = calleeName(n.callee); const obj = n.callee.type === 'MemberExpression' ? nameOf(n.callee.object) : '';
        visit(n.callee, n, ctx);
        const skip = ctx.skip || SKIP_METHODS.has(name) || SKIP_CALLS.has(name) || obj === 'console' || obj === 'localStorage' || obj === 'sessionStorage';
        const kind = CALL_KIND[name] || (/^set(Busy|Status|Msg|Note|Err|Error|Phase)$/.test(name) ? 'status' : ctx.kind);
        visit(n.arguments, n, { ...ctx, skip, kind, where: CALL_KIND[name] ? name : ctx.where });
        return;
      }
      case 'ThrowStatement': visit(n.argument, n, { ...ctx, kind: 'error', where: 'throw' }); return;
      case 'VariableDeclarator': {
        const id = nameOf(n.id);
        visit(n.init, n, /^(RE|RX|PAT|KEYWORDS?|STOP|ALIASES?)_?|_(RE|RX)$/.test(id) ? { ...ctx, skip: true } : ctx);
        return;
      }
      default:
    }
    for (const k in n) {
      if (k === 'loc' || k === 'type' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments' || k === 'extra') continue;
      const v = n[k]; if (v && typeof v === 'object') visit(v, n, ctx);
    }
  }

  /** 요소 하나: 속성의 이름표 + 자식 글 */
  function scope(el, ctx) {
    const kind = elKind(el);
    for (const a of el.openingElement.attributes) {
      if (a.type !== 'JSXAttribute') { visit(a.argument, a, { kind: 'text' }); continue; }
      const an = nameOf(a.name); if (SKIP_ATTRS.has(an) || !a.value) continue;
      const ak = ATTR_KIND[an] || (/^on[A-Z]/.test(an) ? null : PROP_KIND[an] || 'text');
      if (a.value.type === 'StringLiteral') { if (ak) add(a.value.value, ak, a.value.loc.start.line, an); } else if (a.value.type === 'JSXExpressionContainer') visit(a.value.expression, a, { kind: ak || 'text', where: /^on[A-Z]/.test(an) ? '' : an });
    }
    children(el.children, kind, el.loc.start.line);
  }
  /** 자식들: 글과 문장 속 태그는 한 문구로 잇고, 덩어리 태그를 만나면 끊음 */
  function children(list, kind, line0) {
    const direct = list.some((c) => (c.type === 'JSXText' && c.value.trim()) || (c.type === 'JSXExpressionContainer' && isStr(c.expression)));
    let run = ''; let line = 0;
    const put = (t, l) => { if (!line && t.trim()) line = l; run += t; };
    const flush = () => { if (run.trim()) add(run, kind, line || line0, 'jsx'); run = ''; line = 0; };
    const inline = (el) => { // 문장 속 태그의 글
      let t = ''; const own = el.children.some((c) => (c.type === 'JSXText' && c.value.trim()) || (c.type === 'JSXExpressionContainer' && isStr(c.expression))); // 제 글이 없이 태그만 나란하면 따로따로
      for (const a of el.openingElement.attributes) if (a.type === 'JSXAttribute' && ATTR_KIND[nameOf(a.name)] && a.value?.type === 'StringLiteral') add(a.value.value, ATTR_KIND[nameOf(a.name)], a.value.loc.start.line, nameOf(a.name));
      for (const c of el.children) {
        if (c.type === 'JSXText') t += jsxText(c.value);
        else if (c.type === 'JSXExpressionContainer') { if (isStr(c.expression)) { t += strValue(c.expression).text; if (c.expression.type === 'TemplateLiteral') visit(c.expression.expressions, c, { kind }); } else if (c.expression.type !== 'JSXEmptyExpression') { t += '{…}'; visit(c.expression, c, { kind }); } }
        else if (c.type === 'JSXElement') { if (nameOf(c.openingElement.name) === 'br') t += ' '; else if (isInlineEl(c)) t += (own || !t ? '' : '\n') + inline(c); else { t += '{…}'; scope(c, {}); } }
      }
      return t;
    };
    for (const c of list) {
      if (c.type === 'JSXText') put(jsxText(c.value), c.loc.start.line + (c.value.match(/^\s*\n/) ? 1 : 0));
      else if (c.type === 'JSXExpressionContainer') {
        const e = c.expression;
        if (e.type === 'JSXEmptyExpression') continue;
        if (isStr(e)) { put(strValue(e).text, e.loc.start.line); if (e.type === 'TemplateLiteral') visit(e.expressions, c, { kind }); }
        else if (hasJSX(e)) { flush(); visit(e, c, { kind }); }
        else { put('{…}', e.loc.start.line); visit(e, c, { kind }); }
      } else if (c.type === 'JSXElement') {
        const tag = nameOf(c.openingElement.name);
        if (tag === 'br') put('\n', c.loc.start.line);
        else if (direct && isInlineEl(c)) put(inline(c), c.loc.start.line);
        else { flush(); scope(c, {}); }
      } else if (c.type === 'JSXFragment') { flush(); children(c.children, kind, c.loc.start.line); }
    }
    flush();
  }

  visit(ast.program, null, {});
  // {…}만 남은 조각, 낱글자 조사는 문구가 아님
  return units.filter((u) => u.text.replace(/\{…\}/g, '').replace(/[^가-힣]/g, '').length >= 2).sort((a, b) => a.line - b.line);
}

// ── 점검 ──
const LINT_KIND = { button: 'button', title: 'title', label: 'label', toast: 'toast', error: 'error', confirm: 'text', status: 'text', aria: 'aria', placeholder: 'placeholder', text: 'text' };
export function lintUnits(units) {
  const out = [];
  for (const u of units) {
    const text = u.text.replace(/\{…\}/g, '○');
    for (const f of lintText(text, LINT_KIND[u.kind] || 'text')) out.push({ file: u.file, line: u.line, kind: u.kind, text: u.text, rule: f.id || f.why, why: f.why, level: f.level, hit: f.hit, fix: f.fix, group: u.group });
    for (const t of TERM_RULES || []) {
      if (t.only && t.only !== u.group) continue;
      const m = t.re.exec(text); if (!m || (t.unless && t.unless.test(text))) continue;
      out.push({ file: u.file, line: u.line, kind: u.kind, text: u.text, rule: 'term', why: `용어: ${t.why}`, level: t.level || 'warn', hit: m[0], fix: t.fix, group: u.group });
    }
  }
  return out;
}

export function run(paths = [], only = '') {
  const units = []; const errors = [];
  for (const { file, group } of targets(paths, only)) {
    try { for (const u of extract(readFileSync(file, 'utf8'), rel(file))) units.push({ ...u, group }); }
    catch (e) { errors.push({ file: rel(file), message: e.message }); }
  }
  return { units, findings: lintUnits(units), errors };
}

// ── 보고 ──
const chars = (s) => [...s.replace(/\{…\}/g, '').replace(/\s+/g, '')].length;
function byRule(findings) {
  const m = new Map();
  for (const f of findings) { const k = `${f.level}|${f.why.replace(/\(\d+자\)/, '').replace(/^용어: .*/, '용어 통일')}`; const v = m.get(k) || { level: f.level, why: k.split('|')[1], app: 0, page: 0, ex: f }; v[f.group === 'app' ? 'app' : 'page']++; m.set(k, v); }
  return [...m.values()].sort((a, b) => (a.level === b.level ? b.app + b.page - a.app - a.page : a.level === 'error' ? -1 : 1));
}
function byFile(units) {
  const m = new Map();
  for (const u of units) { if (u.kind === 'aria') continue; const v = m.get(u.file) || { file: u.file, n: 0, chars: 0, long: 0 }; v.n++; v.chars += chars(u.text); if (chars(u.text) > 70) v.long++; m.set(u.file, v); }
  return [...m.values()].sort((a, b) => b.chars - a.chars);
}
function report({ units, findings }) {
  const L = [];
  const e = findings.filter((f) => f.level === 'error').length;
  L.push(`문구 ${units.length}개(앱 ${units.filter((u) => u.group === 'app').length} · 강의 페이지 ${units.filter((u) => u.group === 'page').length}), 고침 ${e}건 · 살핌 ${findings.length - e}건`, '');
  L.push('| 규칙 | 수준 | 앱 | 강의 페이지 | 예 |', '|---|---|---:|---:|---|');
  for (const r of byRule(findings)) L.push(`| ${r.why} | ${r.level === 'error' ? '고침' : '살핌'} | ${r.app} | ${r.page} | \`${r.ex.file}:${r.ex.line}\` ${r.ex.text.slice(0, 44).replace(/\|/g, '/').replace(/\n/g, ' ')}${r.ex.text.length > 44 ? '…' : ''} |`);
  L.push('', '| 파일 | 문구 수 | 글자 수 | 70자 넘는 문구 |', '|---|---:|---:|---:|');
  for (const f of byFile(units).slice(0, 25)) L.push(`| \`${f.file}\` | ${f.n} | ${f.chars.toLocaleString('en-US')} | ${f.long} |`);
  const terms = findings.filter((f) => f.rule === 'term');
  const tm = new Map();
  for (const f of terms) { const v = tm.get(f.why) || { why: f.why, fix: f.fix, n: 0, hits: new Set(), where: [] }; v.n++; v.hits.add(f.hit); if (v.where.length < 3) v.where.push(`${f.file}:${f.line}`); tm.set(f.why, v); }
  L.push('', '| 용어 | 건수 | 쓰인 꼴 | 통일 | 예 |', '|---|---:|---|---|---|');
  for (const t of [...tm.values()].sort((a, b) => b.n - a.n)) L.push(`| ${t.why.replace(/^용어: /, '')} | ${t.n} | ${[...t.hits].slice(0, 5).join(', ')} | ${t.fix} | ${t.where.map((w) => `\`${w}\``).join(' ')} |`);
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2); const has = (k) => args.includes(`--${k}`);
  const paths = args.filter((a) => !a.startsWith('--'));
  if (!loadParser()) { console.error('@babel/parser를 찾지 못했어요. app 폴더에서 npm ci를 한 뒤 다시 실행해 주세요.'); process.exit(2); }
  const res = run(paths, has('app') ? 'app' : has('page') ? 'page' : '');
  for (const x of res.errors) console.error(`읽지 못함  ${x.file}  ${x.message}`);
  if (has('dump')) { for (const u of res.units) console.log(`${u.file}:${u.line}\t${u.kind}\t${u.text.replace(/\n/g, ' ⏎ ')}`); process.exit(0); }
  if (has('json')) console.log(JSON.stringify(res.findings.map(({ group, ...f }) => f), null, 2));
  else if (has('report')) console.log(report(res));
  else {
    for (const f of res.findings) console.log(`${f.level === 'error' ? '고침' : '살핌'}  ${f.file}:${f.line}  [${f.kind}] "${f.text.slice(0, 60).replace(/\n/g, ' ')}${f.text.length > 60 ? '…' : ''}"  ${f.why}("${f.hit}") → ${f.fix}`);
    const e = res.findings.filter((f) => f.level === 'error').length;
    console.log(`\n문구 ${res.units.length}개 · 고칠 곳 ${e}개 · 살필 곳 ${res.findings.length - e}개`);
  }
  const bad = res.errors.length || res.findings.some((f) => f.level === 'error' || (has('strict') && f.level === 'warn'));
  process.exit(bad ? 1 : 0);
}
