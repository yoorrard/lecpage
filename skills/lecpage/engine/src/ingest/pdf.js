// PDF 해석(pdf.js 사용). 브라우저: globalThis.pdfjsLib(앱이 제공) 또는 opts.pdfjsLib.
// Node: 'pdfjs-dist/legacy/build/pdf.mjs'가 설치돼 있으면 동적 import, 없으면 'needs-pdfjs' 오류(fallback:'python')를 돌려줍니다.
// 글 조각(텍스트 항목)을 줄로 묶고, 글자 크기로 제목을 고르고, 링크 주석의 표시 글자를 찾습니다.
import { normText, normLine, cleanUrl, IngestError, isNode } from './util.js';
import { FontRoles } from './fonts.js';

const PDFJS_NODE = 'pdfjs-dist/legacy/build/pdf.mjs';

/** pdf.js 모듈 찾기. 없으면 null */
export async function loadPdfjs(opts = {}) {
  if (opts.pdfjsLib) return opts.pdfjsLib;
  if (globalThis.pdfjsLib && typeof globalThis.pdfjsLib.getDocument === 'function') return globalThis.pdfjsLib;
  if (isNode) {
    try {
      const spec = PDFJS_NODE;
      const mod = await import(/* @vite-ignore */ spec);
      return mod && mod.getDocument ? mod : (mod.default || null);
    } catch { return null; }
  }
  return null;
}

function nodeAssetUrl(sub) {
  try {
    if (typeof import.meta.resolve !== 'function') return undefined;
    const u = import.meta.resolve(PDFJS_NODE); // file:///…/pdfjs-dist/legacy/build/pdf.mjs
    return fileUrlToPath(new URL('../../' + sub + '/', u).href);
  } catch { return undefined; }
}

/** file:///C:/a%20b/ → C:/a b/ (윈도우), file:///home/x/ → /home/x/ */
export function fileUrlToPath(href) {
  let p = decodeURIComponent(new URL(href).pathname);
  if (/^\/[A-Za-z]:\//.test(p)) p = p.slice(1);
  return p;
}

export async function parsePdf(bytes, ctx) {
  const lib = await loadPdfjs(ctx.opts);
  if (!lib) throw new IngestError('needs-pdfjs', { node: isNode, fallback: isNode ? 'python' : undefined });
  const params = {
    data: new Uint8Array(bytes), // 복사본: pdf.js가 버퍼를 넘겨받아(분리) 원본을 못 쓰게 되는 것을 막음
    isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0,
    cMapPacked: true, password: ctx.opts.password,
  };
  const cMapUrl = ctx.opts.cMapUrl || (isNode && !ctx.opts.pdfjsLib ? nodeAssetUrl('cmaps') : undefined);
  const fontUrl = ctx.opts.standardFontDataUrl || (isNode && !ctx.opts.pdfjsLib ? nodeAssetUrl('standard_fonts') : undefined);
  if (cMapUrl) params.cMapUrl = cMapUrl;
  if (fontUrl) params.standardFontDataUrl = fontUrl;
  let doc;
  try {
    doc = await lib.getDocument(params).promise;
  } catch (e) {
    if (e && (e.name === 'PasswordException' || /password/i.test(e.message || ''))) throw new IngestError('pdf-encrypted');
    throw new IngestError('pdf-failed', { detail: e && e.message });
  }
  const meta = {};
  try {
    const md = await doc.getMetadata();
    const info = md?.info || {};
    if (info.Title) meta.title = normLine(info.Title);
    if (info.Author) meta.author = normLine(info.Author);
    if (info.Creator) meta.creator = normLine(info.Creator);
    if (info.CreationDate) meta.created = pdfDate(info.CreationDate);
    if (info.ModDate) meta.modified = pdfDate(info.ModDate);
  } catch { /* 메타데이터 없음 */ }

  const total = doc.numPages;
  const n = Math.min(total, ctx.limits.maxPages);
  if (total > n) ctx.warn('too-many-pages', { pages: total, limit: n });
  const pages = [];
  let chars = 0;
  let size = null;
  const fontRoles = new FontRoles();
  for (let i = 1; i <= n; i++) {
    let page;
    try {
      page = await doc.getPage(i);
      const vp = page.getViewport({ scale: 1 });
      if (!size) size = { width: Math.round(vp.width), height: Math.round(vp.height) };
      const tc = await page.getTextContent();
      let anns = [];
      try { anns = await page.getAnnotations(); } catch { /* 주석 없음 */ }
      const p = buildPage(lib, tc.items || [], anns, vp, i, ctx);
      if (i <= FONT_PAGES) await tallyPdfFonts(page, tc.items || [], fontRoles);
      chars += p.paragraphs.reduce((s, x) => s + x.text.length, 0) + p.title.length;
      pages.push(p);
    } catch (e) {
      pages.push({ file: ctx.fileId, page: i, kind: 'page', title: '', paragraphs: [], notes: '', links: [], images: [], tables: [], error: 'parse-failed' });
    } finally {
      try { page && page.cleanup(); } catch { /* 무시 */ }
    }
  }
  try { await doc.destroy(); } catch { /* 무시 */ }
  if (chars < Math.max(20, n * 8)) ctx.warn('no-text');
  const design = { slideSize: size ? { ...size, ratio: ratioName(size.width, size.height) } : undefined };
  if (fontRoles.size) design.fontRoles = fontRoles.result();
  return { pages, design, meta, unit: 'page' };
}

/** 글꼴 이름 세기(앞 FONT_PAGES쪽만): 글 조각의 fontName은 내부 번호라, 연산 목록을 받아 글꼴 객체의 실제 이름(ABCDEF+NanumGothic)을 읽습니다.
 *  쪽에서 글자가 큰 짧은 조각 = 제목(display), 나머지 = 본문(body). 실패해도 해석은 계속합니다. */
const FONT_PAGES = 12;
async function tallyPdfFonts(page, items, roles) {
  try {
    await page.getOperatorList();
    const objs = page.commonObjs;
    const sized = items.filter((it) => typeof it.str === 'string' && it.str.trim() && it.fontName)
      .map((it) => ({ it, size: Math.hypot(it.transform?.[2] || 0, it.transform?.[3] || 0) || it.height || 0 }));
    if (!sized.length) return;
    const sizes = sized.map((x) => x.size).sort((a, b) => a - b);
    const med = sizes[Math.floor(sizes.length / 2)] || 1;
    const nameOf = new Map();
    for (const { it, size } of sized) {
      if (!nameOf.has(it.fontName)) {
        let nm = '';
        try { if (objs.has(it.fontName)) { const f = objs.get(it.fontName); nm = f?.name || f?.fallbackName || ''; } } catch { /* 아직 안 읽힘 */ }
        nameOf.set(it.fontName, nm);
      }
      const name = nameOf.get(it.fontName);
      if (!name) continue;
      const role = size >= med * 1.35 && it.str.trim().length <= 60 ? 'display' : 'body';
      roles.add(role, name, it.str.replace(/\s/g, '').length);
    }
  } catch { /* 글꼴 이름 없음 */ }
}

function pdfDate(s) {
  const m = /D?:?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?/.exec(String(s));
  if (!m) return '';
  return `${m[1]}-${m[2] || '01'}-${m[3] || '01'}${m[4] ? `T${m[4]}:${m[5] || '00'}` : ''}`;
}

function ratioName(w, h) {
  const r = w / h;
  const named = [['16:9', 16 / 9], ['4:3', 4 / 3], ['16:10', 1.6], ['A4', 297 / 210], ['A4-세로', 210 / 297]];
  const hit = named.find(([, v]) => Math.abs(r - v) / v < 0.02);
  return hit ? hit[0] : `${Math.round(r * 100) / 100}:1`;
}

const BULLET = /^[•·▪▫◦●○■□◆◇▶▷►➢➤✓✔☞※\-–]\s*/;
/** 글 조각 사이 틈 때문에 생긴 문장부호 앞뒤 공백 정리 */
function tidy(t) {
  return normLine(t).replace(/\s+([.,!?)\]}:;·%])/g, '$1').replace(/([(\[{])\s+/g, '$1')
    // 숫자와 한글 단위가 다른 글꼴 조각이라 생긴 틈("15 시간", "3 개를", "201 호") 붙이기. 단위 뒤에 낱말이 이어지면("2 주차장") 그대로 둠
    .replace(/(\d)\s+(시간|분|초|일|주|개월|년|학년도|학년|차시|회|명|개|쪽|권|대|호|층|교시|번|원|점|인|조)(?![가-힣]{2})/g, '$1$2');
}

/** pdf.js 텍스트 항목 → 줄 → 문단 + 제목 */
export function buildPage(lib, items, anns, vp, no, ctx) {
  const toVp = (tr) => (lib.Util && lib.Util.transform ? lib.Util.transform(vp.transform, tr) : [tr[0], tr[1], tr[2], tr[3], tr[4], vp.height - tr[5]]);
  const frags = [];
  for (const it of items) {
    if (typeof it.str !== 'string') continue;
    const t = toVp(it.transform);
    const size = Math.hypot(t[2], t[3]) || it.height || 10;
    const x = t[4], y = t[5];
    const w = (it.width || 0) * (vp.scale || 1);
    frags.push({ str: it.str, x, y, w, size, bold: /bold|black|heavy|extrabold/i.test(it.fontName || '') , eol: it.hasEOL });
  }
  // 줄 묶기
  frags.sort((a, b) => (Math.abs(a.y - b.y) > Math.min(a.size, b.size) * 0.5 ? a.y - b.y : a.x - b.x));
  const lines = [];
  for (const f of frags) {
    if (!f.str.trim() && !f.str) continue;
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - f.y) <= Math.min(last.size, f.size) * 0.5) {
      const gap = f.x - last.right;
      if (f.str.trim()) {
        const needSpace = gap > Math.max(1, last.size * 0.18) && !/\s$/.test(last.text) && !/^\s/.test(f.str);
        last.text += (needSpace ? ' ' : '') + f.str;
        last.size = Math.max(last.size, f.size);
        last.bold = last.bold && f.bold;
      } else last.text += f.str;
      last.right = Math.max(last.right, f.x + f.w);
      last.frags.push(f);
    } else if (f.str.trim()) {
      lines.push({ text: f.str, x: f.x, y: f.y, right: f.x + f.w, size: f.size, bold: f.bold, frags: [f] });
    }
  }
  for (const l of lines) l.text = tidy(l.text);
  const kept = lines.filter((l) => l.text && !/^\d{1,3}$/.test(l.text) && !/^-\s*\d{1,3}\s*-$/.test(l.text)); // 쪽 번호 제거

  // 제목: 가장 큰 글자 줄(들). 위쪽 40% 안이거나 다른 줄보다 확실히 크면 제목으로
  const sizes = kept.map((l) => l.size).sort((a, b) => a - b);
  const median = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;
  const maxSize = sizes.length ? sizes[sizes.length - 1] : 0;
  let title = '', titleGuessed = false;
  const titleLines = [];
  if (kept.length) {
    const big = kept.filter((l) => l.size >= maxSize * 0.92);
    const others = kept.filter((l) => l.size < maxSize * 0.92);
    const otherMax = others.length ? Math.max(...others.map((l) => l.size)) : 0;
    const chars = big.reduce((n, l) => n + l.text.length, 0);
    const clearlyBigger = !others.length || maxSize >= otherMax * 1.3;
    const top = big[0] && big[0].y <= vp.height * 0.45;
    if (big.length <= 3 && chars <= 120 && (clearlyBigger || (top && maxSize >= median * 1.2))) {
      // 붙어 있는 큰 줄만(여러 줄 제목)
      titleLines.push(big[0]);
      for (const l of big.slice(1)) {
        const prev = titleLines[titleLines.length - 1];
        if (l.y - prev.y <= prev.size * 1.8) titleLines.push(l); else break;
      }
    } else if (kept[0].text.length <= 50 && (kept[0].bold || kept[0].size > median) && kept[0].y <= vp.height * 0.3) {
      titleLines.push(kept[0]); titleGuessed = true;
    }
    // 여러 줄 제목: 줄이 바뀌며 낱말이 잘린 곳("…안" + "내")은 띄우지 않고 이음
    title = normLine(titleLines.reduce((acc, l) => (!acc ? l.text : acc + (/(?:^|\s)[가-힣]$/.test(acc) && /^[가-힣]{1,2}$/.test(l.text) ? '' : ' ') + l.text), ''));
  }
  const body = kept.filter((l) => !titleLines.includes(l));

  // 줄 → 문단(줄바꿈으로 나뉜 한 문장을 이음)
  const minX = body.length ? Math.min(...body.map((l) => l.x)) : 0;
  const maxW = body.length ? Math.max(...body.map((l) => l.right - l.x)) : 0;
  const paragraphs = [];
  let prev = null, block = 1;
  for (const l of body) {
    let text = l.text;
    let bullet = false;
    if (BULLET.test(text)) { bullet = true; text = text.replace(BULLET, ''); }
    const level = Math.max(0, Math.min(4, Math.round((l.x - minX) / Math.max(8, l.size * 1.6))));
    const vgap = prev ? l.y - prev.line.y : 0;
    if (prev && vgap > prev.line.size * 2.2) block++;
    const marker = prev && /^(\d{1,2}[.)]|[①-⑳]|[-•·▪]|STEP\s*\d|Step\s*\d)/.test(prev.para.text);
    const cont = prev && !bullet && !/^(\d{1,2}[.)]|[①-⑳]|STEP|Step)/.test(text)
      && !/^[^\s:：]{1,6}\s*[:：]/.test(text)
      && Math.abs(l.size - prev.line.size) <= prev.line.size * 0.12
      && vgap > 0 && vgap < prev.line.size * 1.7
      && prev.line.text.length >= 18
      && (prev.line.right - prev.line.x) >= maxW * 0.75
      && !/[.!?。:]$|[다요]\.?$/.test(prev.para.text)
      && Math.abs(l.x - prev.textX) <= l.size * (marker ? 2.5 : 1.2);
    if (cont) {
      prev.para.text = normLine(prev.para.text + ' ' + text);
      prev.line = l;
      continue;
    }
    const para = { text, level, block };
    if (bullet) para.bullet = true;
    para.size = Math.round(l.size);
    paragraphs.push(para);
    prev = { para, line: l, textX: l.x };
  }

  // 링크 주석 → 표시 글자
  const links = [];
  for (const a of anns || []) {
    if (a.subtype !== 'Link') continue;
    const url = cleanUrl(a.url || a.unsafeUrl || '');
    if (!url) continue;
    let label = '';
    if (Array.isArray(a.rect) && vp.convertToViewportRectangle) {
      const [x1, y1, x2, y2] = vp.convertToViewportRectangle(a.rect);
      const rx1 = Math.min(x1, x2) - 2, rx2 = Math.max(x1, x2) + 2, ry1 = Math.min(y1, y2) - 2, ry2 = Math.max(y1, y2) + 2;
      const hits = [];
      for (const l of lines) for (const f of l.frags) {
        const cy = f.y - f.size * 0.35, cx = f.x + f.w / 2;
        if (cx >= rx1 && cx <= rx2 && cy >= ry1 && cy <= ry2 && f.str.trim()) hits.push(f.str);
      }
      label = normLine(hits.join(''));
    }
    const ex = links.find((l) => l.url === url);
    if (ex) { if (!ex.label) ex.label = label; } else links.push({ url, label });
  }
  const page = { file: ctx.fileId, page: no, kind: 'page', title, paragraphs, notes: '', links, images: [], tables: [] };
  if (titleGuessed && title) page.titleGuessed = true;
  return page;
}

export { normText };
