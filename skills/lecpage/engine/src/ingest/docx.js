// DOCX 해석: 본문 문단(제목 스타일·목록 수준), 표, 하이퍼링크(필드 포함), 그림, 글상자 → 제목 기준 '쪽(section)'
import { kid, kids, all, first, attr, relAttr, textOf, path, isEl } from './xml.js';
import { normText, normLine, extOf, baseName, mimeOf, WEB_IMAGE, cleanUrl, IngestError } from './util.js';
import { parseTheme, parseCoreProps, StyleTally } from './ooxml.js';
import { relOfType } from './zip.js';
import { findMainPart, findCorePath } from './pptx.js';
import { blocksToPages } from './blocks.js';
import { FontRoles, pickScript, hasHangul } from './fonts.js';

export function parseDocx(zip, ctx) {
  zip.preload((n) => /\.(xml|rels)$/i.test(n));
  const docPath = findMainPart(zip, 'word/document.xml');
  const doc = zip.xml(docPath);
  const body = first(doc, 'body');
  if (!body) throw new IngestError('corrupt', { detail: 'document.xml 본문 없음' });
  const rels = zip.rels(docPath);
  const styles = readStyles(zip.xml(relTarget(rels, 'styles', 'word/styles.xml')));
  const numbering = readNumbering(zip.xml(relTarget(rels, 'numbering', 'word/numbering.xml')));
  const themeRel = relOfType(rels, 'theme');
  const theme = parseTheme(zip.xml(themeRel ? themeRel.target : 'word/theme/theme1.xml'));
  const tally = new StyleTally();
  const fontRoles = new FontRoles();
  const c = { ...ctx, zip, rels, styles, numbering, tally, theme, fontRoles, imgSeq: 0, counters: new Map(), unsupportedExt: new Set() };

  const blocks = [];
  walkBody(body, c, blocks);
  const pages = blocksToPages(blocks, { fileId: ctx.fileId, unit: 'section', maxPages: ctx.limits.maxPages });
  if (c.unsupportedExt.size) ctx.warn('images-unsupported', { exts: [...c.unsupportedExt].join(', ') });
  if (ctx.opts.withImages) {
    const want = new Set(pages.flatMap((p) => p.images.map((im) => im.path)));
    zip.preload((n) => want.has(n));
    for (const p of pages) for (const im of p.images) { const b = zip.get(im.path); if (b) { im.bytes = b; im.size = b.length; } }
  }
  if (styles.defaultFont) tally.font(styles.defaultFont, 1);
  const st = tally.result();
  const design = {
    theme: theme?.name || '', colors: theme?.colors || {},
    fonts: theme?.fonts || { major: { latin: '', ea: '' }, minor: { latin: '', ea: '' } },
    fontsUsed: st.fontsUsed, palette: st.palette, fontRoles: fontRoles.result(),
  };
  return { pages, design, meta: parseCoreProps(zip.xml(findCorePath(zip))), unit: 'section' };
}

function relTarget(rels, type, fallback) { const r = relOfType(rels, type); return r ? r.target : fallback; }

function walkBody(container, c, out) {
  for (const n of container.children) {
    if (!isEl(n)) continue;
    if (n.local === 'p') readPara(n, c, out);
    else if (n.local === 'tbl') out.push({ type: 'table', rows: readTable(n, c) });
    else if (n.local === 'sdt') walkBody(kid(n, 'sdtContent') || n, c, out);
    else if (n.local === 'customXml' || n.local === 'smartTag' || n.local === 'ins') walkBody(n, c, out);
    else if (n.local === 'AlternateContent') walkBody(kid(n, 'Choice') || kid(n, 'Fallback') || n, c, out);
  }
}

function readTable(tbl, c) {
  const rows = [];
  for (const tr of kids(tbl, 'tr')) {
    const row = [];
    for (const tc of kids(tr, 'tc')) {
      const vm = path(tc, 'tcPr', 'vMerge');
      if (vm && (attr(vm, 'val') || 'continue') === 'continue') { row.push(''); continue; }
      const inner = [];
      walkBody(tc, c, inner);
      row.push(normText(inner.map((b) => (b.type === 'table' ? b.rows.map((r) => r.join(' | ')).join('\n') : b.text)).filter(Boolean).join('\n')));
    }
    if (row.some(Boolean)) rows.push(row);
  }
  return rows;
}

function readPara(p, c, out) {
  const pPr = kid(p, 'pPr');
  const styleId = attr(kid(pPr, 'pStyle'), 'val') || '';
  const style = c.styles.map.get(styleId) || c.styles.map.get(c.styles.defaultPara) || {};
  let heading = style.heading ?? null;
  const ol = attr(kid(pPr, 'outlineLvl'), 'val');
  if (ol !== undefined && +ol < 9) heading = +ol + 1;

  // 목록
  let level = 0, bullet = false, num = 0;
  const numPr = kid(pPr, 'numPr') || style.numPr;
  if (numPr) {
    const numId = attr(kid(numPr, 'numId'), 'val');
    const ilvl = +attr(kid(numPr, 'ilvl'), 'val') || 0;
    if (numId && numId !== '0') {
      level = ilvl;
      const fmt = c.numbering.fmt(numId, ilvl);
      if (fmt === 'bullet' || fmt === 'none' || !fmt) bullet = fmt !== 'none';
      else {
        const key = numId;
        const arr = c.counters.get(key) || [];
        arr[ilvl] = (arr[ilvl] || (c.numbering.start(numId, ilvl) - 1)) + 1;
        arr.length = ilvl + 1;
        c.counters.set(key, arr);
        num = arr[ilvl];
      }
    }
  }

  const st = { text: '', links: [], images: [], extra: [], field: null, pageBreak: false, bold: 0, chars: 0, sz: 0, runs: [] };
  readRuns(p, c, st);
  // 글꼴 역할: 제목 스타일 = display. 글꼴을 안 적은 글은 문단 스타일 → 문서 기본 → 테마 글꼴 순
  const role = heading !== null ? 'display' : 'body';
  for (const r of st.runs) c.fontRoles.add(role, r.font || rfName(style.rf, r.t, c.theme) || rfName(c.styles.defaultRf, r.t, c.theme) || pickScript(role === 'display' ? c.theme?.fonts.major : c.theme?.fonts.minor, r.t), r.n);
  const text = normText(st.text);
  const block = {
    type: 'p', text, level, bullet, num, heading, style: style.name || styleId,
    links: st.links, images: st.images,
    bold: st.chars > 0 && st.bold >= st.chars * 0.9, sz: st.sz * 50, // 반 포인트 → 1/100pt
  };
  const pbb = kid(pPr, 'pageBreakBefore');
  if (pbb && !/^(0|false|off)$/i.test(attr(pbb, 'val') || '')) block.pageBreakBefore = true;
  if (text || st.images.length || st.links.length) {
    if (c.pendingBreak) { block.pageBreakBefore = true; c.pendingBreak = false; }
    if (c.gap && text && c.lastText) block.gapBefore = true;
    c.gap = false;
    if (text) c.lastText = true;
    out.push(block);
  } else c.gap = true;
  if (st.pageBreak) c.pendingBreak = true;
  for (const e of st.extra) out.push(e); // 글상자 문단
}

function readRuns(node, c, st) {
  for (const n of node.children) {
    if (!isEl(n)) continue;
    switch (n.local) {
      case 'r': readRun(n, c, st); break;
      case 'hyperlink': {
        const id = relAttr(n, 'id');
        const r = id && c.rels.get(id);
        const before = st.text.length;
        readRuns(n, c, st);
        if (r && r.external) addLink(st, r.target, st.text.slice(before));
        break;
      }
      case 'fldSimple': {
        const instr = attr(n, 'instr') || '';
        const before = st.text.length;
        readRuns(n, c, st);
        const m = /HYPERLINK\s+"([^"]+)"/i.exec(instr);
        if (m) addLink(st, m[1], st.text.slice(before));
        break;
      }
      case 'ins': case 'smartTag': case 'customXml': case 'sdt': case 'sdtContent': case 'bdo': case 'dir':
        readRuns(n, c, st); break;
      case 'AlternateContent': readRuns(kid(n, 'Choice') || kid(n, 'Fallback') || n, c, st); break;
      default: break; // del, proofErr, bookmark 등
    }
  }
}

function readRun(r, c, st) {
  const rPr = kid(r, 'rPr');
  for (const n of r.children) {
    if (!isEl(n)) continue;
    switch (n.local) {
      case 't': {
        const t = textOf(n);
        if (st.field && st.field.phase === 'instr') break;
        st.text += t;
        st.chars += t.length;
        if (rPr && kid(rPr, 'b') && attr(kid(rPr, 'b'), 'val') !== '0' && attr(kid(rPr, 'b'), 'val') !== 'false') st.bold += t.length;
        const sz = +attr(kid(rPr, 'sz'), 'val') || 0;
        if (sz > st.sz) st.sz = sz;
        const fonts = kid(rPr, 'rFonts');
        if (t.trim()) st.runs.push({ font: rfName(fonts, t, c.theme), n: t.replace(/\s/g, '').length, t });
        if (fonts) { c.tally.font(attr(fonts, 'eastAsia'), t.length); c.tally.font(attr(fonts, 'ascii'), t.length * 0.5); }
        const color = attr(kid(rPr, 'color'), 'val');
        if (color && /^[0-9a-f]{6}$/i.test(color)) c.tally.color('#' + color.toUpperCase(), t.length);
        break;
      }
      case 'tab': case 'ptab': st.text += ' '; break;
      case 'br': case 'cr':
        if (attr(n, 'type') === 'page') st.pageBreak = true; else st.text += '\n';
        break;
      case 'noBreakHyphen': st.text += '-'; break;
      case 'fldChar': {
        const t = attr(n, 'fldCharType');
        if (t === 'begin') st.field = { phase: 'instr', instr: '', start: 0 };
        else if (t === 'separate' && st.field) { st.field.phase = 'result'; st.field.start = st.text.length; }
        else if (t === 'end' && st.field) {
          const m = /HYPERLINK\s+"([^"]+)"/i.exec(st.field.instr);
          if (m) addLink(st, m[1], st.text.slice(st.field.start));
          st.field = null;
        }
        break;
      }
      case 'instrText': if (st.field) st.field.instr += textOf(n); break;
      case 'drawing': case 'pict': case 'object': readDrawing(n, c, st); break;
      case 'AlternateContent': {
        const ch = kid(n, 'Choice') || kid(n, 'Fallback');
        if (ch) for (const x of ch.children) if (isEl(x) && (x.local === 'drawing' || x.local === 'pict')) readDrawing(x, c, st);
        break;
      }
      default: break;
    }
  }
}

function addLink(st, url, label) {
  const u = cleanUrl(url);
  if (!u) return;
  const lab = normLine(label);
  const ex = st.links.find((l) => l.url === u);
  if (ex) { if (!ex.label) ex.label = lab; return; }
  st.links.push({ url: u, label: lab });
}

function readDrawing(n, c, st) {
  const docPr = first(n, 'docPr');
  const alt = normLine(attr(docPr, 'descr') || attr(docPr, 'title') || '');
  for (const blip of all(n, 'blip')) addImg(c, st, relAttr(blip, 'embed') || relAttr(blip, 'link'), alt);
  for (const im of all(n, 'imagedata')) addImg(c, st, relAttr(im, 'id'), alt);
  // 글상자 안 문단
  for (const tx of all(n, 'txbxContent')) {
    const inner = [];
    walkBody(tx, c, inner);
    for (const b of inner) { if (b.type === 'p') b.role = 'text'; st.extra.push(b); }
  }
}

function addImg(c, st, relId, alt) {
  if (!relId) return;
  const r = c.rels.get(relId);
  if (!r || r.external) return;
  const ext = extOf(r.target);
  if (!WEB_IMAGE.has(ext)) c.unsupportedExt.add(ext || '?');
  c.imgSeq++;
  const im = { id: `${c.fileId}-img${c.imgSeq}`, name: baseName(r.target), path: r.target, mime: mimeOf(r.target) };
  if (alt) im.alt = alt;
  if (!WEB_IMAGE.has(ext)) im.web = false;
  st.images.push(im);
}

function readStyles(doc) {
  const map = new Map();
  let defaultPara = '', defaultFont = '';
  if (!doc) return { map, defaultPara, defaultFont, defaultRf: null };
  const rFonts = path(first(doc, 'docDefaults'), 'rPrDefault', 'rPr', 'rFonts');
  if (rFonts) defaultFont = attr(rFonts, 'eastAsia') || attr(rFonts, 'ascii') || '';
  const raw = new Map();
  for (const s of all(doc, 'style')) {
    if (attr(s, 'type') !== 'paragraph') continue;
    const id = attr(s, 'styleId');
    const name = (attr(kid(s, 'name'), 'val') || '').trim();
    const ol = attr(path(s, 'pPr', 'outlineLvl'), 'val');
    raw.set(id, { id, name, basedOn: attr(kid(s, 'basedOn'), 'val'), outline: ol !== undefined ? +ol : null, numPr: path(s, 'pPr', 'numPr'), rf: path(s, 'rPr', 'rFonts') });
    if (attr(s, 'default') === '1') defaultPara = id;
  }
  const headingOf = (st, depth = 0) => {
    if (!st || depth > 10) return null;
    const n = st.name.toLowerCase();
    let m = /^heading\s*(\d)$/.exec(n) || /^제목\s*(\d)$/.exec(n);
    if (m) return +m[1];
    if (n === 'title' || n === '제목') return 0;
    if (st.outline !== null && st.outline < 9) return st.outline + 1;
    return headingOf(raw.get(st.basedOn), depth + 1);
  };
  const rfOf = (st, depth = 0) => (!st || depth > 10 ? null : st.rf || rfOf(raw.get(st.basedOn), depth + 1));
  for (const [id, st] of raw) map.set(id, { name: st.name, heading: headingOf(st), numPr: st.numPr, rf: rfOf(st) });
  return { map, defaultPara, defaultFont, defaultRf: rFonts || null };
}

function readNumbering(doc) {
  const abs = new Map(), nums = new Map();
  if (doc) {
    for (const a of all(doc, 'abstractNum')) {
      const lv = new Map();
      for (const l of kids(a, 'lvl')) lv.set(+attr(l, 'ilvl') || 0, { fmt: attr(kid(l, 'numFmt'), 'val') || '', start: +attr(kid(l, 'start'), 'val') || 1 });
      abs.set(attr(a, 'abstractNumId'), lv);
    }
    for (const n of all(doc, 'num')) nums.set(attr(n, 'numId'), attr(kid(n, 'abstractNumId'), 'val'));
  }
  const get = (numId, ilvl) => abs.get(nums.get(numId))?.get(ilvl);
  return { fmt: (numId, ilvl) => get(numId, ilvl)?.fmt || '', start: (numId, ilvl) => get(numId, ilvl)?.start || 1 };
}

/** w:rFonts → 글꼴 이름(한글은 eastAsia, 그 밖은 ascii/hAnsi, 테마 참조는 테마 글꼴로) */
function rfName(rf, t, theme) {
  if (!rf) return '';
  const h = hasHangul(t);
  const direct = h ? attr(rf, 'eastAsia') : (attr(rf, 'ascii') || attr(rf, 'hAnsi'));
  if (direct) return direct;
  const th = attr(rf, h ? 'eastAsiaTheme' : 'asciiTheme') || (h ? '' : attr(rf, 'hAnsiTheme'));
  if (th && theme) { const w = /^major/.test(th) ? theme.fonts.major : theme.fonts.minor; return (h ? w.ea : w.latin) || ''; }
  return '';
}
