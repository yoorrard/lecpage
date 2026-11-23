// 앱 CSP 도우미(빌드 플러그인 vite.config.js cspHashes와 검사 scripts/csp-check.mjs가 같이 씀).
// 앱(index.html)의 script-src에는 'unsafe-inline'이 없고, 빌드가 남긴 인라인 스크립트는 SHA-256 해시로만 허용해요.
// 인라인 스크립트가 꼭 필요한 것(AI가 만든 사이트 미리보기·디자인 사전·DOCX 그리기)은 격리 틀(public/frame/index.html, 자체 CSP) 안에서만 돌아요.
import { createHash } from 'node:crypto';

const META_RE = /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/i;

/** HTML의 meta CSP 글('' = 없음) */
export const metaCsp = (html) => (META_RE.exec(String(html)) || [])[2] || '';
/** CSP 글 → 그 지시문의 값들(['self' …]). 없으면 null */
export function directive(csp, name) {
  for (const part of String(csp).split(';')) { const t = part.trim().split(/\s+/); if (t[0].toLowerCase() === name) return t.slice(1); }
  return null;
}
/** HTML 안의 인라인 스크립트(주소 src가 없는 <script>)의 글들. 브라우저가 해시를 재는 것과 같은 글(태그 사이 그대로) */
export function inlineScripts(html) {
  const out = [];
  for (const m of String(html).matchAll(/<!--[\s\S]*?-->|<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (m[1] === undefined) continue; // 주석
    if (/\bsrc\s*=/.test(m[1])) continue;
    const type = (/\btype\s*=\s*["']?([^"'\s>]+)/i.exec(m[1]) || [])[1] || '';
    if (type && !/^(module|text\/javascript|application\/javascript)$/i.test(type)) continue; // JSON 등 실행하지 않는 글
    out.push(m[2]);
  }
  return out;
}
export const sha256 = (text) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;
/** 인라인 이벤트 손잡이(onclick= 등): 해시로는 허용되지 않으니 있으면 안 됨 */
export const inlineHandlers = (html) => [...String(html).matchAll(/<[a-z][^>]*\s(on[a-z]+)\s*=/gi)].map((m) => m[1]);

/** script-src에 인라인 스크립트 해시를 넣은 CSP 글(이미 있는 해시는 지우고 다시) */
export function withHashes(csp, hashes) {
  return String(csp).split(';').map((part) => {
    const t = part.trim().split(/\s+/);
    if (t[0].toLowerCase() !== 'script-src') return part;
    const rest = t.slice(1).filter((x) => !/^'sha(256|384|512)-/.test(x));
    const self = rest.indexOf("'self'");
    rest.splice(self >= 0 ? self + 1 : 0, 0, ...hashes);
    return `${part.startsWith(' ') ? ' ' : ''}script-src ${rest.join(' ')}`;
  }).join(';');
}
/** 빌드한 index.html: meta CSP의 script-src에 이 문서의 인라인 스크립트 해시를 넣음 */
export function hashIndexHtml(html) {
  const csp = metaCsp(html);
  if (!csp) throw new Error('index.html에 CSP meta가 없습니다.');
  const hashes = [...new Set(inlineScripts(html).map(sha256))];
  const next = withHashes(csp, hashes);
  return { html: String(html).replace(META_RE, (_, a, __, c) => a + next + c), csp: next, hashes };
}
/** _headers 글: 앱 화면(/ · /index.html)의 script-src 줄을 meta와 같은 값으로 */
export function hashHeaders(text, scriptSrc) {
  let n = 0;
  const out = String(text).replace(/^(\s+Content-Security-Policy:\s*)script-src [^\n;]*$/gm, (_, a) => { n++; return `${a}script-src ${scriptSrc.join(' ')}`; });
  return { text: out, count: n };
}
/** _headers에서 그 경로 규칙의 머리글 줄들 */
export function headerRule(text, path) {
  const lines = String(text).split(/\r?\n/); const out = []; let on = false;
  for (const l of lines) {
    if (!l.trim() || l.trim().startsWith('#')) continue;
    if (!/^\s/.test(l)) { on = l.trim() === path; continue; }
    if (on) out.push(l.trim());
  }
  return out;
}

/**
 * 검사: 고칠 것들의 글(빈 배열이면 통과).
 * index: 앱 index.html(빌드 결과면 built: true — 인라인 스크립트 해시가 모두 들어 있어야 함), frame: 격리 틀 문서, headers: _headers 글, libs: 엔진 LIB_SCRIPT_SOURCES
 */
export function checkCsp({ index, frame, headers, libs = [], built = false }) {
  const bad = [];
  const csp = metaCsp(index); const script = directive(csp, 'script-src');
  if (!script) bad.push('index.html: CSP meta의 script-src가 없습니다.');
  else {
    if (script.includes("'unsafe-inline'")) bad.push("index.html: script-src에 'unsafe-inline'이 있습니다(인라인 스크립트는 해시로만, 사이트 미리보기는 격리 틀에서).");
    if (script.includes("'unsafe-eval'")) bad.push("index.html: script-src에 'unsafe-eval'이 있습니다.");
    if (script.some((x) => /^https?:/.test(x))) bad.push(`index.html: script-src에 바깥 주소가 있습니다(${script.filter((x) => /^https?:/.test(x)).join(' ')}). 사이트 라이브러리 경로는 격리 틀(public/frame/index.html)에만 둡니다.`);
    const want = [...new Set(inlineScripts(index).map(sha256))]; const have = script.filter((x) => /^'sha(256|384|512)-/.test(x));
    if (built) {
      for (const h of want) if (!have.includes(h)) bad.push(`index.html: 인라인 스크립트의 해시 ${h}가 script-src에 없습니다.`);
      for (const h of have) if (!want.includes(h)) bad.push(`index.html: script-src의 해시 ${h}에 맞는 인라인 스크립트가 없습니다.`);
    }
    const on = inlineHandlers(index);
    if (on.length) bad.push(`index.html: 인라인 이벤트 손잡이(${[...new Set(on)].join(', ')})는 해시로 허용되지 않습니다.`);
  }
  const fcsp = metaCsp(frame); const fscript = directive(fcsp, 'script-src');
  if (!fscript) bad.push('frame/index.html: CSP meta의 script-src가 없습니다.');
  else {
    if (!fscript.includes("'unsafe-inline'")) bad.push("frame/index.html: script-src에 'unsafe-inline'이 없습니다(미리보기 사이트의 스크립트가 멈춤).");
    const cdn = fscript.filter((x) => /^https:\/\/cdn\.jsdelivr\.net(?:\/|$)/.test(x));
    if (cdn.slice().sort().join(' ') !== libs.slice().sort().join(' ')) bad.push(`frame/index.html: script-src의 jsDelivr 경로가 엔진 LIB_SCRIPT_SOURCES와 다릅니다.\n  지금: ${cdn.join(' ') || '(없음)'}\n  엔진: ${libs.join(' ')}`);
  }
  // 격리 틀과 앱의 나머지 지시문은 같아야 함(미리보기가 예전 앱 CSP에서처럼 돌게): script-src만 다름
  const rest = (c) => String(c).split(';').map((x) => x.trim()).filter((x) => x && !/^script-src\s/i.test(x)).sort().join('; ');
  if (csp && fcsp && rest(csp) !== rest(fcsp)) bad.push('frame/index.html: script-src 말고 다른 지시문이 index.html과 다릅니다(둘을 같이 고치세요).');
  if (headers !== undefined) {
    for (const path of ['/', '/index.html']) {
      const line = headerRule(headers, path).find((l) => /^Content-Security-Policy:\s*script-src\s/i.test(l));
      if (!line) { bad.push(`_headers: ${path} 규칙에 Content-Security-Policy: script-src 줄이 없습니다.`); continue; }
      const got = line.replace(/^Content-Security-Policy:\s*script-src\s+/i, '').trim().split(/\s+/);
      const meta = built ? script || [] : (script || []).filter((x) => !/^'sha/.test(x));
      if ((built ? got : got.filter((x) => !/^'sha/.test(x))).join(' ') !== meta.join(' ')) bad.push(`_headers: ${path}의 script-src가 index.html meta와 다릅니다.\n  _headers: ${got.join(' ')}\n  meta: ${meta.join(' ')}`);
    }
    const fr = headerRule(headers, '/frame/');
    if (!fr.some((l) => /^!\s*X-Frame-Options/i.test(l)) || !fr.some((l) => /^Content-Security-Policy:.*\bsandbox\b.*frame-ancestors 'self'/i.test(l))) bad.push("_headers: /frame/ 규칙(! X-Frame-Options, Content-Security-Policy: sandbox …; frame-ancestors 'self')이 없습니다.");
    if (fr.some((l) => /allow-same-origin/i.test(l))) bad.push('_headers: /frame/의 sandbox에 allow-same-origin이 있습니다.');
  }
  return bad;
}
