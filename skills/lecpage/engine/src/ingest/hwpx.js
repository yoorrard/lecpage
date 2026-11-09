// HWPX(한글 OWPML, ZIP) 해석: Contents/content.hpf(목록·순서) → Contents/section*.xml의 hp:p/hp:run/hp:t,
// 표(hp:tbl), 그림(hp:pic → BinData), 하이퍼링크(필드), 글상자, 개요 스타일 → 제목 기준 '쪽(section)'
import { kid, kids, all, first, attr, textOf, isEl } from './xml.js';
import { normText, normLine, extOf, baseName, mimeOf, WEB_IMAGE, cleanUrl, IngestError } from './util.js';
import { blocksToPages } from './blocks.js';

export function parseHwpx(zip, ctx) {
  zip.preload((n) => /\.(xml|hpf)$/i.test(n));
  // 1) 목록·순서
  const hpfPath = findHpf(zip);
  const hpf = hpfPath ? zip.xml(hpfPath) : null;
  const manifest = new Map();
  let sections = [];
  const meta = {};
  if (hpf) {
    for (const it of all(hpf, 'item')) manifest.set(attr(it, 'id'), { href: attr(it, 'href') || '', type: attr(it, 'media-type') || '' });
    for (const ref of all(first(hpf, 'spine'), 'itemref')) {
      const it = manifest.get(attr(ref, 'idref'));
      if (it && /section\d*\.xml$/i.test(it.href) && zip.has(it.href)) sections.push(it.href);
    }
    const title = normLine(textOf(first(first(hpf, 'metadata'), 'title')));
    if (title) meta.title = title;
    for (const m of all(first(hpf, 'metadata'), 'meta')) {
      const name = attr(m, 'name'); const v = normLine(textOf(m));
      if (!v) continue;
      if (name === 'creator') meta.author = v;
      else if (name === 'lastsaveby') meta.modifiedBy = v;
      else if (name === 'CreatedDate') meta.created = v;
      else if (name === 'ModifiedDate') meta.modified = v;
      else if (name === 'subject') meta.subject = v;
    }
  }
  if (!sections.length) {
    sections = zip.names().filter((n) => /^Contents\/section\d+\.xml$/i.test(n))
      .sort((a, b) => +a.match(/(\d+)\.xml$/i)[1] - +b.match(/(\d+)\.xml$/i)[1]);
  }
  if (!sections.length) throw new IngestError('corrupt', { detail: 'HWPX 본문(section*.xml) 없음' });

  // 2) 머리(스타일·문단 모양·글꼴)
  const header = readHeader(zip.xml(zip.has('Contents/header.xml') ? 'Contents/header.xml' : (manifest.get('header')?.href || '')));
  const c = { ...ctx, zip, manifest, header, imgSeq: 0, unsupportedExt: new Set(), fontUse: new Map(), counters: [] };

  // 3) 본문
  const blocks = [];
  sections.forEach((sp, si) => {
    const doc = zip.xml(sp);
    const sec = first(doc, 'sec') || doc;
    const before = blocks.length;
    for (const p of kids(sec, 'p')) readPara(p, c, blocks, false);
    if (si > 0 && blocks.length > before) blocks[before].pageBreakBefore = true;
  });

  const pages = blocksToPages(blocks, { fileId: ctx.fileId, unit: 'section', maxPages: ctx.limits.maxPages });
  if (c.unsupportedExt.size) ctx.warn('images-unsupported', { exts: [...c.unsupportedExt].join(', ') });
  if (ctx.opts.withImages) {
    const want = new Set(pages.flatMap((p) => p.images.map((im) => im.path)));
    zip.preload((n) => want.has(n));
    for (const p of pages) for (const im of p.images) { const b = zip.get(im.path); if (b) { im.bytes = b; im.size = b.length; } }
  }
  const fontsUsed = [...c.fontUse.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count }));
  const design = {
    theme: '', colors: {},
    fonts: { major: { latin: header.fonts.LATIN || '', ea: header.fonts.HANGUL || '' }, minor: { latin: header.fonts.LATIN || '', ea: header.fonts.HANGUL || '' } },
    fontsUsed, palette: [],
  };
  return { pages, design, meta, unit: 'section' };
}

function findHpf(zip) {
  const cont = zip.xml('META-INF/container.xml');
  if (cont) {
    for (const rf of all(cont, 'rootfile')) {
      const p = attr(rf, 'full-path');
      if (p && /\.hpf$/i.test(p) && zip.has(p)) return p;
    }
  }
  if (zip.has('Contents/content.hpf')) return 'Contents/content.hpf';
  return zip.names().find((n) => /\.hpf$/i.test(n)) || '';
}

function readHeader(doc) {
  const styles = new Map(), paraPr = new Map(), charFont = new Map(), fonts = {};
  const fontById = {};
  if (!doc) return { styles, paraPr, charFont, fonts };
  for (const ff of all(doc, 'fontface')) {
    const lang = attr(ff, 'lang') || '';
    const list = kids(ff, 'font');
    fontById[lang] = new Map(list.map((f) => [attr(f, 'id'), attr(f, 'face') || '']));
    if (list[0] && !fonts[lang]) fonts[lang] = attr(list[0], 'face') || '';
  }
  for (const s of all(doc, 'style')) {
    styles.set(attr(s, 'id'), { name: attr(s, 'name') || '', eng: attr(s, 'engName') || '', paraPr: attr(s, 'paraPrIDRef') });
  }
  for (const p of all(doc, 'paraPr')) {
    const h = kid(p, 'heading');
    paraPr.set(attr(p, 'id'), h ? { type: (attr(h, 'type') || 'NONE').toUpperCase(), level: +attr(h, 'level') || 0 } : { type: 'NONE', level: 0 });
  }
  for (const cp of all(doc, 'charPr')) {
    const fr = kid(cp, 'fontRef');
    const id = attr(cp, 'id');
    const hang = fr ? fontById.HANGUL?.get(attr(fr, 'hangul')) : '';
    const height = +attr(cp, 'height') || 0; // 1/100 pt
    const bold = !!kid(cp, 'bold');
    charFont.set(id, { font: hang || '', height, bold });
  }
  return { styles, paraPr, charFont, fonts };
}

function headingOf(p, c) {
  const st = c.header.styles.get(attr(p, 'styleIDRef'));
  const name = `${st?.name || ''} ${st?.eng || ''}`;
  let m = /개요\s*(\d)|Outline\s*(\d)|Heading\s*(\d)|제목\s*(\d)/i.exec(name);
  if (m) return { heading: +(m[1] || m[2] || m[3] || m[4]) };
  if (/^\s*(제목|Title)\s*$/i.test(st?.name || '')) return { heading: 0 };
  const pp = c.header.paraPr.get(attr(p, 'paraPrIDRef')) || (st ? c.header.paraPr.get(st.paraPr) : null);
  if (pp?.type === 'OUTLINE') return { heading: pp.level + 1 };
  if (pp?.type === 'NUMBER') return { numbered: true, level: pp.level };
  if (pp?.type === 'BULLET') return { bullet: true, level: pp.level };
  return {};
}

/** hp:p 하나 → 블록(들). 표·글상자는 따로 블록으로 */
function readPara(p, c, out, inCell) {
  const st = { text: '', links: [], images: [], tables: [], extra: [], field: null, chars: 0, bold: 0, maxH: 0 };
  for (const run of kids(p, 'run')) readRun(run, c, st, inCell);
  // 문단 바로 아래의 그림·표(드물게 run 밖)
  for (const n of p.children) if (isEl(n) && n.local !== 'run' && n.local !== 'linesegarray') readObject(n, c, st, inCell);
  const text = normText(st.text);
  const h = headingOf(p, c);
  const block = {
    type: 'p', text, level: h.level || 0, bullet: !!h.bullet, num: 0,
    heading: h.heading ?? null, links: st.links, images: st.images,
    bold: st.chars > 0 && st.bold >= st.chars * 0.9, sz: st.maxH,
  };
  if (h.numbered) {
    const lv = h.level || 0;
    c.counters[lv] = (c.counters[lv] || 0) + 1;
    c.counters.length = lv + 1;
    block.num = c.counters[lv];
  } else if (text) c.counters.length = 0;
  if (attr(p, 'pageBreak') === '1') block.pageBreakBefore = true;
  if (text || st.images.length || st.links.length) {
    if (c.gap && text && c.lastText) block.gapBefore = true;
    c.gap = false;
    if (text) c.lastText = true;
    out.push(block);
  } else {
    c.gap = true;
    if (block.pageBreakBefore) c.pendingBreak = true;
  }
  if (c.pendingBreak && out.length && out[out.length - 1] === block) { block.pageBreakBefore = true; c.pendingBreak = false; }
  for (const t of st.tables) out.push({ type: 'table', rows: t });
  for (const e of st.extra) out.push(e);
}

function readRun(run, c, st, inCell) {
  const cf = c.header.charFont.get(attr(run, 'charPrIDRef'));
  for (const n of run.children) {
    if (!isEl(n)) continue;
    if (n.local === 't') {
      const t = readT(n);
      st.text += t;
      st.chars += t.length;
      if (cf) {
        if (cf.bold) st.bold += t.length;
        if (cf.height > st.maxH) st.maxH = cf.height;
        if (cf.font && t.trim()) c.fontUse.set(cf.font, (c.fontUse.get(cf.font) || 0) + t.length);
      }
      if (st.field && st.field.type === 'HYPERLINK') st.field.label += t;
    } else if (n.local === 'ctrl') {
      for (const x of n.children) {
        if (!isEl(x)) continue;
        if (x.local === 'fieldBegin') {
          const type = (attr(x, 'type') || '').toUpperCase();
          let url = '';
          for (const sp of all(x, 'stringParam')) {
            const name = attr(sp, 'name');
            const v = textOf(sp);
            if (name === 'Path' && v) url = v;
            else if (name === 'Command' && v && !url) url = v.split(';')[0];
          }
          st.field = { type, url: url.replace(/\\:/g, ':').replace(/\\\\/g, '\\'), label: '' };
        } else if (x.local === 'fieldEnd') {
          if (st.field && st.field.type === 'HYPERLINK') addLink(st, st.field.url, st.field.label);
          st.field = null;
        }
      }
    } else readObject(n, c, st, inCell);
  }
}

function readT(t) {
  let s = '';
  for (const x of t.children) {
    if (typeof x === 'string') s += x;
    else if (x.local === 'tab' || x.local === 'nbSpace' || x.local === 'fwSpace') s += ' ';
    else if (x.local === 'lineBreak') s += '\n';
    else if (x.local === 'hyphen') s += '-';
    else s += textOf(x);
  }
  return s;
}

function readObject(n, c, st, inCell) {
  switch (n.local) {
    case 'tbl': {
      const rows = [];
      for (const tr of kids(n, 'tr')) {
        const row = [];
        for (const tc of kids(tr, 'tc')) {
          const inner = [];
          for (const p of kids(kid(tc, 'subList') || tc, 'p')) readPara(p, c, inner, true);
          row.push(normText(inner.map((b) => (b.type === 'table' ? b.rows.map((r) => r.join(' | ')).join('\n') : b.text)).filter(Boolean).join('\n')));
          for (const b of inner) for (const l of b.links || []) addLink(st, l.url, l.label);
        }
        if (row.some(Boolean)) rows.push(row);
      }
      if (rows.length) st.tables.push(rows);
      break;
    }
    case 'pic': {
      const img = first(n, 'img');
      const ref = attr(img, 'binaryItemIDRef');
      const it = ref && c.manifest.get(ref);
      let href = it?.href || '';
      if (!href && ref) href = c.zip.names().find((x) => x.startsWith('BinData/') && baseName(x).replace(/\.[^.]+$/, '') === ref) || '';
      if (href && c.zip.has(href)) {
        const ext = extOf(href);
        if (!WEB_IMAGE.has(ext)) c.unsupportedExt.add(ext || '?');
        c.imgSeq++;
        const im = { id: `${c.fileId}-img${c.imgSeq}`, name: baseName(href), path: href, mime: it?.type && it.type.startsWith('image/') ? it.type : mimeOf(href) };
        const alt = normLine(textOf(kid(n, 'shapeComment')));
        if (alt) im.alt = alt;
        if (!WEB_IMAGE.has(ext)) im.web = false;
        const sz = kid(n, 'sz') || kid(n, 'curSz');
        if (sz) { im.width = Math.round((+attr(sz, 'width') || 0) / 75); im.height = Math.round((+attr(sz, 'height') || 0) / 75); } // HWPUNIT(1/7200in) → px(96dpi)
        st.images.push(im);
      }
      break;
    }
    case 'rect': case 'ellipse': case 'polygon': case 'curve': case 'arc': case 'container': case 'textart': {
      if (n.local === 'textart') { const t = normLine(attr(n, 'text') || ''); if (t) st.extra.push({ type: 'p', text: t, level: 0, heading: null, role: 'text', links: [], images: [] }); break; }
      for (const dt of all(n, 'drawText')) {
        const inner = [];
        for (const p of kids(kid(dt, 'subList') || dt, 'p')) readPara(p, c, inner, inCell);
        for (const b of inner) { if (b.type === 'p') b.role = 'text'; st.extra.push(b); }
      }
      for (const sub of kids(n, 'pic')) readObject(sub, c, st, inCell);
      for (const sub of kids(n, 'container')) readObject(sub, c, st, inCell);
      break;
    }
    default: break;
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
