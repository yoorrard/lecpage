// 교재 글꼴 감지: 제목(display)·본문(body)에 쓴 글꼴을 글자 수로 세어 가장 많이 쓴 것을 고릅니다.
// 각 해석기(PPTX·DOCX·HWPX·PDF)가 FontRoles에 모으고 → file.fonts → detect()가 파일을 합쳐 detected.fonts를 만듭니다.
import { fontFamilyName } from '../design/fonts.js';

const HANGUL = /[ㄱ-ㆎ가-힣]/;
export const hasHangul = (t) => HANGUL.test(t || '');

/** 글 조각에 맞는 테마 글꼴 고르기: 한글이 있으면 ea(동아시아) 먼저 */
export function pickScript(pair, text) {
  if (!pair) return '';
  return hasHangul(text) ? (pair.ea || pair.latin || '') : (pair.latin || pair.ea || '');
}

export class FontRoles {
  constructor() { this.display = new Map(); this.body = new Map(); }
  add(role, name, n = 1) {
    const fam = fontFamilyName(name);
    if (!fam || !(n > 0)) return;
    const m = role === 'display' ? this.display : this.body;
    m.set(fam, (m.get(fam) || 0) + n);
  }
  get size() { return this.display.size + this.body.size; }
  result(max = 8) {
    const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([name, n]) => ({ name, n: Math.round(n) }));
    return { display: top(this.display), body: top(this.body) };
  }
}

const keyOf = (s) => fontFamilyName(s).toLowerCase().replace(/[\s\-_.]/g, '');

/**
 * material.files[].fonts를 합쳐 { display:{name,share}, body:{name,share}, all:[{name,share,role}] } 를 만듭니다.
 * share = 그 역할 글자 가운데 이 글꼴의 비율(0~1). 쪽 그림용 PDF(renderOf)는 같은 교재라 세지 않습니다.
 */
export function detectFonts(material) {
  const sum = { display: new Map(), body: new Map() };
  const names = new Map();
  for (const f of material.files || []) {
    if (f.renderOf || !f.fonts) continue;
    for (const role of ['display', 'body']) for (const x of f.fonts[role] || []) {
      const k = keyOf(x.name); if (!k) continue;
      if (!names.has(k)) names.set(k, fontFamilyName(x.name));
      sum[role].set(k, (sum[role].get(k) || 0) + (+x.n || 0));
    }
  }
  const total = (m) => [...m.values()].reduce((a, b) => a + b, 0);
  const best = (m) => { const t = total(m); const e = [...m.entries()].sort((a, b) => b[1] - a[1])[0]; return e && t ? { name: names.get(e[0]), share: Math.round((e[1] / t) * 100) / 100 } : null; };
  let display = best(sum.display), body = best(sum.body);
  if (!display && !body) return null;
  if (!display) display = { ...body };
  if (!body) body = { ...display };
  const all = new Map();
  const grand = total(sum.display) + total(sum.body);
  for (const role of ['display', 'body']) for (const [k, n] of sum[role]) {
    const e = all.get(k) || { name: names.get(k), n: 0, roles: new Set() };
    e.n += n; e.roles.add(role); all.set(k, e);
  }
  return {
    display, body,
    all: [...all.values()].sort((a, b) => b.n - a.n).slice(0, 8).map((e) => ({ name: e.name, share: Math.round((e.n / grand) * 100) / 100, role: e.roles.size > 1 ? 'both' : [...e.roles][0] })),
  };
}
