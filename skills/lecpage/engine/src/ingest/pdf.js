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
      chars += p.paragraphs.reduce((s, x) => s + x.text.length, 0) + p.title.length + p.tables.reduce((s, t) => s + t.rows.flat().join("").length, 0);
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
  return normLine(t).replace(/\s+([.,!?)\]}:;·%])/g, '$1').replace(/([(\[{])\s+/g, '$1').replace(/([가-힣])·\s+(?=[가-힣])/g, '$1·') // 가운뎃점 뒤 틈("검색· 요약")
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
    // 한 글자만 다음 줄로 넘어간 곳("…가르치" + "기")도 이음
    title = normLine(titleLines.reduce((acc, l) => (!acc ? l.text : acc + ((/(?:^|\s)[가-힣]$/.test(acc) && /^[가-힣]{1,2}$/.test(l.text)) || (/[가-힣]$/.test(acc) && /^[가-힣]$/.test(l.text)) ? '' : ' ') + l.text), ''));
  }
  // 표: 글 조각의 x 위치로 칸을 나눠, 같은 칸 자리가 이어지는 줄들을 표로(칸 안 줄바꿈은 위 줄에 붙임)
  const { tables, rest: body } = extractTables(kept.filter((l) => !titleLines.includes(l)));

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
  const page = { file: ctx.fileId, page: no, kind: 'page', title, paragraphs, notes: '', links, images: [], tables: tables.map((rows) => ({ rows })) };
  if (titleGuessed && title) page.titleGuessed = true;
  return page;
}

// ── 표 되살리기 ───────────────────────────────────────
// PDF에는 표가 없고 글 조각의 위치만 있어요. 한 줄의 조각 사이가 넓게 벌어지면(글자 0.9개 넘게) 칸이 나뉜 것으로 보고,
// 여러 칸 줄이 세 줄 이상 이어지며 칸 자리가 겹치면 표로 묶습니다. 칸 자리는 x축 투영(여러 줄이 덮는 곳)으로 정해
// 왼쪽·가운데·오른쪽 맞춤 칸을 모두 받습니다. 첫 칸이 빈 가까운 줄은 위 줄 칸 안의 줄바꿈으로 이어 붙입니다.
// 표가 아닌 것을 묶지 않도록: 목록 머리표("•", "1.")는 칸으로 치지 않고, 모든 칸이 꽉 찬 긴 글이면(두 단 문서) 버리고,
// 한 칸이 대부분 머리표로 시작하면(나란한 두 목록) 버립니다.
const MARKER = /^(?:\d{1,2}[.)]|[가-하][.)]|\(\d{1,2}\)|[①-⑳]|[•·▪▫◦●○■□◆◇▶▷►➢➤✓✔☞※\-–]|[-])$/;

/** 한 줄 → 칸 조각 [{text, x, right, size, marker}] */
export function lineSegments(l) {
  const fs = (l.frags || []).filter((f) => f.str.trim()).sort((a, b) => a.x - b.x);
  const segs = [];
  for (const f of fs) {
    const last = segs[segs.length - 1];
    const gap = last ? f.x - last.right : Infinity;
    if (last && gap <= Math.max(3, Math.min(last.size, f.size) * 0.9)) {
      const sp = gap > Math.max(1, last.size * 0.18) && !/\s$/.test(last.text) && !/^\s/.test(f.str);
      last.text += (sp ? ' ' : '') + f.str;
      last.right = Math.max(last.right, f.x + f.w);
    } else segs.push({ text: f.str, x: f.x, right: f.x + f.w, size: f.size });
  }
  for (let i = 0; i + 1 < segs.length; i++) {
    const t = segs[i].text.trim().replace(/[-]/g, '•');
    if (MARKER.test(t)) {
      segs[i + 1] = { ...segs[i + 1], text: (t === '•' ? '' : t + ' ') + segs[i + 1].text, x: segs[i].x, marker: true };
      segs.splice(i, 1);
      i--;
    }
  }
  for (const s of segs) s.text = tidy(s.text);
  return segs.filter((s) => s.text);
}

/** 줄 목록 → { tables: [rows], rest: 표가 아닌 줄 } */
export function extractTables(lines) {
  const segs = lines.map(lineSegments);
  const used = new Set();
  const tables = [];
  for (let i = 0; i < lines.length;) {
    if (segs[i].length < 2) { i++; continue; }
    const idx = [i];
    for (let k = i + 1; k < lines.length; k++) {
      const prev = lines[idx[idx.length - 1]], cur = lines[k];
      const vgap = cur.y - prev.y, lh = Math.max(prev.size, cur.size);
      if (vgap <= 0 || vgap > lh * 4.2 || Math.abs(cur.size - lines[i].size) > lines[i].size * 0.3) break;
      if (segs[k].length >= 2 || vgap <= lh * 1.75) idx.push(k); else break;
    }
    const t = buildTable(idx.map((k) => ({ line: lines[k], segs: segs[k] })));
    if (t) {
      tables.push(t.rows);
      for (let m = 0; m < t.count; m++) used.add(idx[m]);
      i = idx[t.count - 1] + 1;
    } else i = idx.length >= 8 ? idx[idx.length - 1] + 1 : i + 1; // 긴 구간(여러 단 글 등)은 다시 보지 않음
  }
  return { tables, rest: lines.filter((_, k) => !used.has(k)) };
}

function buildTable(cands) {
  const multi = cands.filter((c) => c.segs.length >= 2);
  if (multi.length < 3) return null;
  const all = multi.flatMap((c) => c.segs);
  const size = all.map((s) => s.size).sort((a, b) => a - b)[all.length >> 1] || 10;
  const lo = Math.floor(Math.min(...all.map((s) => s.x)));
  const hi = Math.ceil(Math.max(...all.map((s) => s.right)));
  if (!(hi > lo) || hi - lo > 4000) return null;
  // x축 투영: 여러 칸 줄의 조각이 덮는 줄 수. 15% 이하만 덮는 곳(합친 칸 몇 개)은 칸 사이 틈으로 봄
  const cov = new Uint16Array(hi - lo + 1);
  for (const c of multi) for (const s of c.segs) for (let x = Math.max(0, Math.floor(s.x) - lo); x < Math.min(cov.length, Math.ceil(s.right) - lo); x++) cov[x]++;
  const thr = Math.floor(multi.length * 0.15);
  const runs = [];
  for (let x = 0; x < cov.length; x++) {
    if (cov[x] <= thr) continue;
    const last = runs[runs.length - 1];
    if (last && x - last.r <= Math.max(2, size * 0.5)) last.r = x + 1; else runs.push({ l: x, r: x + 1 });
  }
  const cols = runs.map((r) => ({ l: r.l + lo, r: r.r + lo }));
  if (cols.length < 2 || cols.length > 12) return null;
  const place = (s) => {
    const ov = cols.map((c) => Math.max(0, Math.min(c.r, s.right) - Math.max(c.l, s.x)));
    let j = 0;
    for (let k = 1; k < ov.length; k++) if (ov[k] > ov[j]) j = k;
    // 걸친 칸 수: 조각 폭의 20% 또는 그 칸 폭의 절반 넘게 겹치는 칸
    const spans = ov.filter((v, k) => v > Math.min((s.right - s.x) * 0.2, (cols[k].r - cols[k].l) * 0.5)).length;
    return { j, spans };
  };
  // 줄 사이 간격이 둘로 갈리면(가까운 줄 = 줄 높이, 먼 줄 ≥ 1.4배) 먼 곳에서만 새 행: 모든 칸이 함께 줄바꿈된 행도 한 행으로
  const gaps = cands.slice(1).map((c, k) => c.line.y - cands[k].line.y);
  const minGap = Math.min(...gaps);
  const twoGaps = minGap <= size * 1.6 && gaps.filter((g) => g >= minGap * 1.4).length >= 2;
  // 줄마다 칸 자리에 조각을 놓고, 첫 칸이 빈 가까운 줄은 위 행의 칸 안 줄바꿈으로
  const makeRows = (byGap) => {
    const rows = []; // 행 = 칸 배열, 칸 = { parts: [줄마다의 조각], marker }
    let cur = null, count = 0;
    for (let m = 0; m < cands.length; m++) {
      const c = cands[m];
      const cells = cols.map(() => null);
      let bad = false;
      for (const s of c.segs) {
        const { j, spans } = place(s);
        if (c.segs.length === 1 && spans > 1) bad = true; // 여러 칸에 걸친 한 줄 = 표 밖의 글
        cells[j] = cells[j] ? { ...cells[j], text: cells[j].text + ' ' + s.text, right: s.right } : { ...s };
      }
      if (bad) break;
      const vgap = m ? gaps[m - 1] : Infinity;
      const cont = !!cur && ((!cells[0] && vgap <= c.line.size * 1.75) || (byGap && vgap < minGap * 1.4));
      if (c.segs.length === 1 && !cont) break;
      if (cont) cells.forEach((x, j) => { if (x) (cur[j] ||= { parts: [], marker: false }).parts.push(x); });
      else { cur = cells.map((x) => (x ? { parts: [x], marker: !!x.marker } : null)); rows.push(cur); }
      count++;
    }
    return { rows, count };
  };
  let made = twoGaps ? makeRows(true) : null;
  if (!made || made.rows.length < 3) made = makeRows(false);
  const { rows, count } = made;
  if (rows.length < 3) return null;
  // 칸마다: 오른쪽 끝(칸 안 줄바꿈 판단), 채운 비율, 글 길이, 머리표 비율, 꽉 찬 줄 비율
  const stats = cols.map((col, j) => {
    const cells = rows.map((r) => r[j]).filter(Boolean);
    const parts = cells.flatMap((x) => x.parts);
    const right = Math.max(...parts.map((p) => p.right), col.r);
    const width = Math.max(1, right - Math.min(...parts.map((p) => p.x), col.l));
    return {
      right, fill: cells.length / rows.length,
      meanLen: parts.reduce((a, p) => a + p.text.length, 0) / Math.max(1, parts.length),
      full: parts.filter((p) => p.right - p.x >= width * 0.75).length / Math.max(1, parts.length),
      markers: cells.filter((x) => x.marker || LIST_START.test(x.parts[0].text)).length / Math.max(1, cells.length),
      leftovers: cells.flatMap((x) => x.parts.slice(0, -1).map((p) => right - p.right)),
    };
  });
  if (stats.filter((s) => s.fill >= 0.5).length < 2) return null;
  if (stats.some((s) => s.markers >= 0.5)) return null; // 나란한 목록·번호 목록 옆 글상자
  // 칸 안 줄바꿈이 글자 단위인지: 줄바꿈된 줄이 모두 칸 끝까지 차 있으면(남은 폭 < 글자 1.3개) 글자 단위, 아니면 어절 단위
  const leftovers = stats.flatMap((s) => s.leftovers);
  const charWrap = leftovers.length > 0 && Math.max(...leftovers) < size * 1.3;
  const out = rows.map((r) => r.map((x) => (x ? joinCellLines(x.parts, charWrap) : '')));
  // 이름표 양식("기간: …", 첫 칸이 모두 쌍점으로 끝남)은 표가 아니라 문단(일시·장소 찾기가 그 줄을 읽음)
  const heads = out.map((r) => r[0]).filter(Boolean);
  if (cols.length === 2 && heads.filter((t) => /[:：]$/.test(t)).length >= heads.length * 0.8) return null;
  // 여러 단 글: 모든 칸이 꽉 찬 긴 글이거나, 칸 폭이 같고 모든 칸이 꽉 찬 채 거의 모든 행이 다 차 있음
  const widths = cols.map((c) => c.r - c.l);
  const equal = Math.max(...widths) <= Math.min(...widths) * 1.25;
  const dense = rows.filter((r) => r.every(Boolean)).length >= rows.length * 0.8;
  if (stats.every((s) => s.full >= 0.6) && (stats.every((s) => s.meanLen >= 14) || (equal && dense && rows.length >= 5 && stats.every((s) => s.meanLen >= 6)))) return null;
  return { rows: out.filter((r) => r.some(Boolean)), count };
}

/** 칸 안에서 줄바꿈된 조각 잇기. 글자 단위로 줄을 바꾼 표(한글 낱말 중간에서 잘림)는 한글끼리 붙이되,
 *  앞 줄이 조사·어미(은·는·을·를·의·와·과·에·로…)로 끝나면 낱말 끝으로 보고 띄움. 어절 단위 표는 늘 띄움 */
const WORD_END = /[은는을를의와과에로서고며면다요]$/;
// 칸이 목록 항목으로 시작("1. …", "• …"). "1. 11.(월)" 같은 날짜는 빼고
const LIST_START = /^(?:\d{1,2}[.)](?!\s*\d{1,2}\.)\s|[①-⑳]|[•·▪◦●○■□▶▷►]\s?)/;
function joinCellLines(parts, charWrap) {
  let text = '';
  for (const p of parts) {
    const glue = charWrap && /[가-힣]$/.test(text) && /^[가-힣]/.test(p.text) && !WORD_END.test(text);
    text = !text ? p.text : text + (glue ? '' : ' ') + p.text;
  }
  return normLine(text);
}

export { normText };
