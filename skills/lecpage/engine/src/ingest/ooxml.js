// OOXML(PPTX·DOCX) 공통: 테마 색·글꼴, 문서 속성(docProps/core.xml), 많이 쓴 글꼴·색 집계
import { kid, kids, first, attr, textOf, path } from './xml.js';
import { normLine } from './util.js';

const SCHEME_KEYS = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];

/** 색 노드(srgbClr·sysClr…)를 품은 부모 → '#RRGGBB' | '' */
export function colorOf(parent) {
  if (!parent) return '';
  const srgb = kid(parent, 'srgbClr');
  if (srgb && /^[0-9a-f]{6}$/i.test(attr(srgb, 'val') || '')) return '#' + attr(srgb, 'val').toUpperCase();
  const sys = kid(parent, 'sysClr');
  if (sys && /^[0-9a-f]{6}$/i.test(attr(sys, 'lastClr') || '')) return '#' + attr(sys, 'lastClr').toUpperCase();
  return '';
}

/** theme1.xml → { name, colors:{dk1…folHlink}, fonts:{ major:{latin,ea}, minor:{latin,ea} } } */
export function parseTheme(doc) {
  if (!doc) return null;
  const theme = first(doc, 'theme');
  const out = { name: attr(theme, 'name') || '', colors: {}, fonts: { major: { latin: '', ea: '' }, minor: { latin: '', ea: '' } } };
  const scheme = first(doc, 'clrScheme');
  if (scheme) {
    for (const k of SCHEME_KEYS) { const c = colorOf(kid(scheme, k)); if (c) out.colors[k] = c; }
  }
  const fs = first(doc, 'fontScheme');
  if (fs) {
    for (const [k, local] of [['major', 'majorFont'], ['minor', 'minorFont']]) {
      const f = kid(fs, local);
      if (!f) continue;
      const latin = attr(kid(f, 'latin'), 'typeface') || '';
      let ea = attr(kid(f, 'ea'), 'typeface') || '';
      // 한글 글꼴은 ea가 비어 있고 <a:font script="Hang" typeface="맑은 고딕"/>에 있는 경우가 많음
      const hang = kids(f, 'font').find((x) => attr(x, 'script') === 'Hang');
      if (!ea && hang) ea = attr(hang, 'typeface') || '';
      out.fonts[k] = { latin, ea };
    }
  }
  return out;
}

/** docProps/core.xml → { title, author, modifiedBy, created, modified, subject, keywords } */
export function parseCoreProps(doc) {
  if (!doc) return {};
  const get = (local) => normLine(textOf(first(doc, local)));
  const out = {
    title: get('title'), subject: get('subject'), author: get('creator'), modifiedBy: get('lastModifiedBy'),
    created: get('created'), modified: get('modified'), keywords: get('keywords'), description: get('description'),
  };
  for (const k of Object.keys(out)) if (!out[k]) delete out[k];
  return out;
}

/** 글꼴·색 사용량 집계기 */
export class StyleTally {
  constructor() { this.fonts = new Map(); this.colors = new Map(); }
  font(name, weight = 1) {
    if (!name || name.startsWith('+')) return;
    this.fonts.set(name, (this.fonts.get(name) || 0) + weight);
  }
  color(hex, weight = 1) {
    if (!hex) return;
    this.colors.set(hex, (this.colors.get(hex) || 0) + weight);
  }
  /** a:rPr(또는 a:defRPr) 하나를 집계 */
  rPr(rPr, weight = 1, themeFonts) {
    if (!rPr) return;
    for (const k of ['latin', 'ea']) {
      let tf = attr(kid(rPr, k), 'typeface');
      if (tf && tf.startsWith('+') && themeFonts) {
        const which = tf.startsWith('+mj') ? themeFonts.major : themeFonts.minor;
        tf = tf.endsWith('-ea') ? which?.ea : which?.latin;
      }
      this.font(tf, weight);
    }
    this.color(colorOf(kid(rPr, 'solidFill')), weight);
  }
  result(max = 6) {
    const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, max);
    return {
      fontsUsed: top(this.fonts).map(([name, count]) => ({ name, count: Math.round(count) })),
      palette: top(this.colors).filter(([c]) => !/^#(000000|FFFFFF)$/.test(c)).map(([color, count]) => ({ color, count: Math.round(count) })),
    };
  }
}

/** 밝기(0~1) */
export function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export { path };
