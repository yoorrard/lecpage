// 만든 사이트에 쓰이지 않는 런타임 CSS 규칙 빼기(참가자는 학교망·휴대폰으로 들어오므로 가볍게).
// 런타임 CSS(lecpage.css)는 모든 프리셋·첫 화면 구성·섹션 종류의 모양을 담고 있어, 한 사이트는 그 일부만 씁니다.
// 빼는 규칙: 선택자에 들어 있는 lp- 클래스가 이 사이트의 HTML·JS 어디에도 없거나,
// 빌드 때 정해져 바뀌지 않는 <html data-*> 값(프리셋·첫 화면 구성·머리·메뉴·버튼·카드·띠·제목 모양)이 다른 규칙.
// 남기는 쪽으로 기웁니다: :not()·:is() 안의 클래스, 상태 클래스(is-…), JS가 바꾸는 data-*는 보지 않음.

const FIXED_ATTRS = new Set(['data-preset', 'data-hero', 'data-head', 'data-nav', 'data-btn', 'data-card', 'data-band', 'data-heading']);

/** CSS를 맨 위 단계의 덩어리로: { prelude, body, nested } (주석·문자열 안의 괄호는 건너뜀) */
function blocks(css) {
  const out = []; let i = 0; const n = css.length;
  while (i < n) {
    // 앞 공백·주석
    while (i < n) {
      if (/\s/.test(css[i])) { i++; continue; }
      if (css.startsWith('/*', i)) { const e = css.indexOf('*/', i + 2); const c = css.slice(i, e < 0 ? n : e + 2); if (c.startsWith('/*!') || c.startsWith('/*@')) out.push({ raw: c }); /* 저작권 주석과 묶음 표지(@v:…)는 남김 */ i = e < 0 ? n : e + 2; continue; }
      break;
    }
    if (i >= n) break;
    let j = i, q = '';
    while (j < n) {
      const c = css[j];
      if (q) { if (c === '\\') j++; else if (c === q) q = ''; } else if (c === '"' || c === "'") q = c; else if (css.startsWith('/*', j)) { const e = css.indexOf('*/', j + 2); j = e < 0 ? n : e + 1; } else if (c === '{' || c === ';') break;
      j++;
    }
    const prelude = css.slice(i, j).trim();
    if (j >= n) { if (prelude) out.push({ raw: prelude }); break; }
    if (css[j] === ';') { out.push({ raw: prelude + ';' }); i = j + 1; continue; }
    let depth = 1, k = j + 1; q = '';
    while (k < n && depth) {
      const c = css[k];
      if (q) { if (c === '\\') k++; else if (c === q) q = ''; } else if (c === '"' || c === "'") q = c; else if (css.startsWith('/*', k)) { const e = css.indexOf('*/', k + 2); k = e < 0 ? n : e + 1; } else if (c === '{') depth++; else if (c === '}') depth--;
      k++;
    }
    out.push({ prelude, body: css.slice(j + 1, k - 1) });
    i = k;
  }
  return out;
}

/** 쉼표로 선택자 나누기(괄호 안의 쉼표는 그대로) */
function splitSelectors(sel) {
  const out = []; let depth = 0, start = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--; else if (c === ',' && depth === 0) { out.push(sel.slice(start, i)); start = i + 1; }
  }
  out.push(sel.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

/** 괄호를 쓰는 의사 클래스(:not()·:is()·:where()·:has()…)의 속 내용을 지움: 그 안의 클래스는 없어도 규칙이 맞을 수 있음 */
function stripPseudoArgs(sel) {
  let s = sel, prev;
  do { prev = s; s = s.replace(/:[a-z-]+\([^()]*\)/gi, ''); } while (s !== prev);
  return s;
}

/**
 * @param {string} css 런타임 CSS
 * @param {string} used 이 사이트의 HTML·JS를 이어 붙인 글(클래스 이름·data-* 값이 들어 있는지 찾음)
 * @returns {string} 쓰이는 규칙만 남긴 CSS(주석 뺌)
 */
export function pruneUnusedCss(css, used) {
  // 쓰인 클래스 이름 모음. JS가 이어 붙여 만드는 이름('lp-rip-g' + n, `lp-x-${…}`)은 앞부분으로 맞춤
  const tokens = new Set(used.match(/lp-[\w-]+/g) || []);
  const prefixes = [...used.matchAll(/(lp-[\w-]*)(?:['"`]\s*\+|\$\{)/g)].map((m) => m[1]);
  const seen = (tok) => tokens.has(tok) || prefixes.some((p) => tok.startsWith(p));
  const fixedAttr = (name, value) => used.includes(`${name}="${value}"`) || used.includes(`${name}='${value}'`);
  const alive = (sel) => {
    const s = stripPseudoArgs(sel);
    for (const m of s.matchAll(/\.(lp-[\w-]+)/g)) if (!seen(m[1])) return false;
    for (const m of s.matchAll(/\[(data-[\w-]+)\s*=\s*["']?([^"'\]]+)["']?\s*\]/g)) if (FIXED_ATTRS.has(m[1]) && !fixedAttr(m[1], m[2])) return false;
    return true;
  };
  const walk = (list) => {
    let out = '';
    for (const b of list) {
      if (b.raw !== undefined) { out += b.raw; continue; }
      const pre = b.prelude;
      if (/^@(media|supports|layer|container|document)\b/i.test(pre)) {
        const inner = walk(blocks(b.body));
        if (inner) out += `${pre}{${inner}}`;
      } else if (pre.startsWith('@')) {
        out += `${pre}{${b.body}}`; // @keyframes·@font-face·@property·@page는 그대로(아래에서 안 쓰는 애니메이션만 뺌)
      } else {
        const keep = splitSelectors(pre).filter(alive);
        if (keep.length) out += `${keep.join(',')}{${b.body.trim()}}`;
      }
    }
    return out;
  };
  let out = walk(blocks(css));
  // 남은 규칙·JS 어디에도 이름이 없는 @keyframes는 뺌
  out = blocks(out).map((b) => {
    if (b.raw !== undefined) return b.raw;
    const m = /^@(?:-webkit-)?keyframes\s+([\w-]+)/i.exec(b.prelude);
    if (m) {
      const name = m[1];
      const re = new RegExp(`(?<![\\w-])${name.replace(/-/g, '\\-')}(?![\\w-])`);
      const rest = out.replace(new RegExp(`@(?:-webkit-)?keyframes\\s+${name}\\b`, 'g'), '');
      if (!re.test(rest) && !re.test(used)) return '';
    }
    return `${b.prelude}{${b.body}}`;
  }).join('');
  return out;
}
