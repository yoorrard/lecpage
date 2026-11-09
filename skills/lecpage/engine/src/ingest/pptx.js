// PPTX 해석: 슬라이드 순서(presentation.xml sldIdLst + 관계), 제목, 문단(글머리 수준), 발표자 노트,
// 하이퍼링크(표시 글자 포함), 그림, 표, SmartArt 글, 레이아웃 힌트, 테마 색·글꼴.
import { kid, kids, all, first, attr, relAttr, textOf, path, isEl } from './xml.js';
import { normText, normLine, extOf, baseName, mimeOf, WEB_IMAGE, cleanUrl, IngestError } from './util.js';
import { parseTheme, parseCoreProps, StyleTally, colorOf, luminance } from './ooxml.js';
import { relOfType } from './zip.js';
import { FontRoles, pickScript, hasHangul } from './fonts.js';

const SKIP_PH = new Set(['dt', 'ftr', 'sldNum', 'hdr', 'sldImg']);
const TITLE_PH = new Set(['title', 'ctrTitle']);
const LAYOUT_HINT = {
  title: 'title', secHead: 'section', obj: 'content', tx: 'content', twoObj: 'two-content', twoTxTwoObj: 'comparison',
  titleOnly: 'title-only', blank: 'blank', picTx: 'picture', objTx: 'content-caption', txAndObj: 'two-content',
  objAndTx: 'two-content', vertTx: 'content', vertTitleAndTx: 'content', titleObj: 'content', cust: 'custom',
  txAndChart: 'two-content', chartAndTx: 'two-content', tbl: 'content', chart: 'content', dgm: 'content', objOnly: 'content',
};

export function parsePptx(zip, ctx) {
  const presPath = findMainPart(zip, 'ppt/presentation.xml');
  // 작은 XML은 한 번에 풀어 둠(그림·영상은 필요할 때만)
  zip.preload((n) => /\.(xml|rels)$/i.test(n));
  const pres = zip.xml(presPath);
  if (!pres || !first(pres, 'presentation')) throw new IngestError('corrupt', { detail: 'presentation.xml 없음' });
  const presRels = zip.rels(presPath);

  const sldSz = first(pres, 'sldSz');
  const cx = +attr(sldSz, 'cx') || 12192000;
  const cy = +attr(sldSz, 'cy') || 6858000;

  // 슬라이드 순서
  let slidePaths = all(first(pres, 'sldIdLst'), 'sldId')
    .map((s) => presRels.get(relAttr(s, 'id')))
    .filter((r) => r && !r.external && zip.has(r.target))
    .map((r) => r.target);
  if (!slidePaths.length) {
    slidePaths = zip.names().filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
      .sort((a, b) => +a.match(/(\d+)\.xml$/)[1] - +b.match(/(\d+)\.xml$/)[1]);
  }

  // 마스터·테마
  const masterRel = relOfType(presRels, 'slideMaster');
  const masterPath = masterRel ? masterRel.target : 'ppt/slideMasters/slideMaster1.xml';
  const master = readMaster(zip, masterPath);
  const theme = parseTheme(zip.xml(master.themePath || 'ppt/theme/theme1.xml'));
  const themeFonts = theme ? theme.fonts : null;

  const tally = new StyleTally();
  const fontRoles = new FontRoles();
  const layoutCache = new Map();
  const mediaUse = new Map();
  const unsupportedExt = new Set();
  const pages = [];
  const maxPages = ctx.limits.maxPages;
  let hiddenCount = 0;

  slidePaths.slice(0, maxPages).forEach((sp, i) => {
    let page;
    try {
      page = parseSlide(zip, sp, i + 1, { ...ctx, zip, cx, cy, master, theme, themeFonts, tally, fontRoles, layoutCache, mediaUse, unsupportedExt });
    } catch (e) {
      if (e instanceof IngestError && e.code === 'zip-bomb') throw e;
      page = { file: ctx.fileId, page: i + 1, kind: 'slide', title: '', paragraphs: [], notes: '', links: [], images: [], tables: [], error: 'parse-failed' };
    }
    if (page.hidden) hiddenCount++;
    pages.push(page);
  });
  if (slidePaths.length > maxPages) ctx.warn('too-many-pages', { pages: slidePaths.length, limit: maxPages });
  if (hiddenCount) ctx.warn('hidden-slides', { count: hiddenCount });
  if (unsupportedExt.size) ctx.warn('images-unsupported', { exts: [...unsupportedExt].join(', ') });

  // 여러 슬라이드에 반복되는 그림(로고 등) 표시
  const repeatMin = Math.max(3, Math.ceil(pages.length * 0.4));
  for (const p of pages) for (const im of p.images) if ((mediaUse.get(im.path) || 0) >= repeatMin) im.repeated = true;

  // 그림 바이트(선택)
  if (ctx.opts.withImages) attachImageBytes(zip, pages, ctx);

  // 디자인
  const styles = tally.result();
  const bg = master.background ? resolveColor(master.background, master.clrMap, theme) : '';
  const design = {
    theme: theme?.name || '',
    colors: theme?.colors || {},
    fonts: themeFonts || { major: { latin: '', ea: '' }, minor: { latin: '', ea: '' } },
    fontsUsed: styles.fontsUsed,
    palette: styles.palette,
    background: bg,
    dark: bg ? luminance(bg) < 0.2 : undefined,
    slideSize: slideSize(cx, cy),
    fontRoles: fontRoles.result(),
  };
  if (design.dark === undefined) delete design.dark;

  const core = parseCoreProps(zip.xml(findCorePath(zip)));
  return { pages, design, meta: core, unit: 'slide' };
}

// ── 슬라이드 하나 ─────────────────────────────────────
function parseSlide(zip, slidePath, no, c) {
  const doc = zip.xml(slidePath);
  const sld = first(doc, 'sld');
  if (!sld) throw new IngestError('parse-failed', { detail: `${slidePath} 읽기 실패` });
  const rels = zip.rels(slidePath);
  const hidden = attr(sld, 'show') === '0';

  const layoutRel = relOfType(rels, 'slideLayout');
  const layout = layoutRel ? readLayout(zip, layoutRel.target, c.layoutCache) : null;

  const sc = { ...c, rels, layout, images: [], tables: [], imgSeq: 0, slideNo: no };
  const shapes = [];
  collect(first(sld, 'spTree'), sc, null, shapes);

  // 위치가 없는 자리표시자: 레이아웃·마스터 위치로 보충
  for (const s of shapes) {
    if (s.y !== undefined && s.y !== null) continue;
    const pos = (s.phIdx && layout?.ph.get('idx:' + s.phIdx)) || (s.ph && layout?.ph.get('type:' + phKey(s.ph))) || c.master.ph.get('type:' + phKey(s.ph));
    if (pos && pos.y !== undefined) Object.assign(s, { x: pos.x, y: pos.y, w: pos.w, h: pos.h });
    else { s.x = 0; s.y = s.ph && TITLE_PH.has(s.ph) ? 0 : c.cy * 0.3; s.w = c.cx; s.h = 0; }
  }
  // 읽는 순서: 위→아래(띠 3%), 왼→오
  const band = c.cy * 0.03;
  shapes.sort((a, b) => (Math.abs(a.y - b.y) > band ? a.y - b.y : a.x - b.x));

  // 제목
  let title = '', titleGuessed = false;
  const titleShape = shapes.find((s) => s.ph && TITLE_PH.has(s.ph) && s.paras && s.paras.some((p) => p.text));
  if (titleShape) title = titleShape.paras.map((p) => p.text).filter(Boolean).join(' ');
  else {
    const g = guessTitle(shapes, c);
    if (g) { title = g.paras.map((p) => p.text).filter(Boolean).join(' '); g.isTitle = true; titleGuessed = true; }
  }
  if (titleShape) titleShape.isTitle = true;
  if (c.fontRoles) tallyFonts(shapes, c);

  const paragraphs = [];
  const links = [];
  const addLink = (url, label) => {
    const u = cleanUrl(url);
    if (!u) return;
    const ex = links.find((l) => l.url === u);
    const lab = normLine(label);
    if (ex) { if (!ex.label && lab) ex.label = lab; return; }
    links.push({ url: u, label: lab });
  };
  let block = 0;
  for (const s of shapes) {
    if (s.link) addLink(s.link, s.paras ? s.paras.map((p) => p.text).join(' ') : s.alt);
    if (!s.paras || s.isTitle) { if (s.isTitle) s.paras?.forEach((p) => p.links.forEach((l) => addLink(l.url, l.label))); continue; }
    block++;
    const role = s.ph === 'subTitle' ? 'subtitle' : s.kind === 'diagram' ? 'diagram' : s.kind === 'chart' ? 'chart' : s.ph ? 'body' : 'text';
    for (const p of s.paras) {
      for (const l of p.links) addLink(l.url, l.label);
      if (!p.text) continue;
      const para = { text: p.text, level: p.level, block, role };
      if (p.bullet) para.bullet = true;
      if (p.num) para.num = p.num;
      if (p.gap) para.gap = true;
      if (p.sz) para.size = Math.round(p.sz / 100);
      paragraphs.push(para);
    }
  }

  // 발표자 노트
  let notes = '';
  const notesRel = relOfType(rels, 'notesSlide');
  if (notesRel && zip.has(notesRel.target)) notes = readNotes(zip, notesRel.target, c);

  const hint = layoutHint(layout, shapes, sc, c);
  const page = {
    file: c.fileId, page: no, kind: 'slide', title: normLine(title),
    layout: hint, paragraphs, notes, links, images: sc.images, tables: sc.tables,
  };
  if (titleGuessed && page.title) page.titleGuessed = true;
  if (layout?.name) page.layoutName = layout.name;
  if (hidden) page.hidden = true;
  return page;
}

/** 글꼴 역할 집계: 제목(자리표시자·추정 제목·아주 큰 짧은 글) = display, 나머지 = body. 글꼴을 안 적은 글은 테마 글꼴 */
function tallyFonts(shapes, c) {
  for (const s of shapes) {
    if (!s.paras) continue;
    for (const p of s.paras) {
      if (!p.runs) continue;
      const display = s.isTitle || (p.sz >= 3200 && p.text.length <= 40 && !p.bullet);
      const pair = display ? c.themeFonts?.major : c.themeFonts?.minor;
      for (const r of p.runs) c.fontRoles.add(display ? 'display' : 'body', r.font || pickScript(pair, r.t), r.n);
    }
  }
}
/** 글자 조각의 글꼴: 한글은 ea, 그 밖은 latin(+mj-ea 같은 테마 참조는 풀어서). 안 적혀 있으면 '' */
function runFont(rPr, t, themeFonts) {
  if (!rPr) return '';
  const pick = (k) => {
    let tf = attr(kid(rPr, k), 'typeface') || '';
    if (tf.startsWith('+') && themeFonts) { const w = tf.startsWith('+mj') ? themeFonts.major : themeFonts.minor; tf = (tf.endsWith('-ea') ? w?.ea : w?.latin) || ''; }
    return tf.startsWith('+') ? '' : tf;
  };
  return hasHangul(t) ? pick('ea') : pick('latin');
}

function phKey(t) { return t === 'ctrTitle' ? 'title' : (t === 'obj' || !t) ? 'body' : t; }

/** 도형 모으기(그룹 안까지). tf: 그룹 좌표 변환 */
function collect(container, c, tf, out) {
  if (!container) return;
  for (const n of container.children) {
    if (!isEl(n)) continue;
    let s = null;
    switch (n.local) {
      case 'sp': s = readSp(n, c, tf); break;
      case 'pic': s = readPic(n, c, tf); break;
      case 'graphicFrame': s = readFrame(n, c, tf); break;
      case 'grpSp': collect(n, c, groupTf(n, tf), out); break;
      case 'AlternateContent': {
        const before = out.length;
        const ch = kid(n, 'Choice'); const fb = kid(n, 'Fallback');
        if (ch) collect(ch, c, tf, out);
        if (out.length === before && fb) collect(fb, c, tf, out);
        break;
      }
      default: break;
    }
    if (s) out.push(s);
  }
}

function xfrmOf(x) {
  if (!x) return null;
  const off = kid(x, 'off'), ext = kid(x, 'ext');
  if (!off) return null;
  return { x: +attr(off, 'x') || 0, y: +attr(off, 'y') || 0, w: +attr(ext, 'cx') || 0, h: +attr(ext, 'cy') || 0 };
}
function applyTf(r, tf) {
  if (!r) return null;
  if (!tf) return r;
  return { x: tf.x + (r.x - tf.chx) * tf.sx, y: tf.y + (r.y - tf.chy) * tf.sy, w: r.w * tf.sx, h: r.h * tf.sy };
}
function groupTf(grp, parent) {
  const x = path(grp, 'grpSpPr', 'xfrm');
  if (!x) return parent;
  const off = kid(x, 'off'), ext = kid(x, 'ext'), chOff = kid(x, 'chOff'), chExt = kid(x, 'chExt');
  const g = { x: +attr(off, 'x') || 0, y: +attr(off, 'y') || 0, w: +attr(ext, 'cx') || 0, h: +attr(ext, 'cy') || 0 };
  const ch = { x: +attr(chOff, 'x') || 0, y: +attr(chOff, 'y') || 0, w: +attr(chExt, 'cx') || g.w, h: +attr(chExt, 'cy') || g.h };
  const outer = applyTf(g, parent);
  return { x: outer.x, y: outer.y, chx: ch.x, chy: ch.y, sx: ch.w ? outer.w / ch.w : 1, sy: ch.h ? outer.h / ch.h : 1 };
}

function readSp(sp, c, tf) {
  const nv = kid(sp, 'nvSpPr');
  const cNvPr = kid(nv, 'cNvPr');
  const ph = path(nv, 'nvPr', 'ph');
  const phType = ph ? (attr(ph, 'type') || 'obj') : null;
  if (phType && SKIP_PH.has(phType)) return null;
  const pos = applyTf(xfrmOf(path(sp, 'spPr', 'xfrm')), tf) || {};
  const s = { kind: 'text', ph: phType, phIdx: ph ? attr(ph, 'idx') : null, ...pos, name: attr(cNvPr, 'name') || '', alt: normLine(attr(cNvPr, 'descr') || '') };
  const hl = kid(cNvPr, 'hlinkClick');
  if (hl) { const r = c.rels.get(relAttr(hl, 'id')); if (r && r.external) s.link = r.target; }
  const txBody = kid(sp, 'txBody');
  const lph = phType ? ((s.phIdx && c.layout?.ph.get('idx:' + s.phIdx)) || c.layout?.ph.get('type:' + phKey(phType))) : null;
  const bodyPh = phType && !TITLE_PH.has(phType) && phType !== 'subTitle' && !lph?.noBullet;
  if (txBody) s.paras = readParas(txBody, c, bodyPh);
  // 그림 채우기 도형
  const blip = path(sp, 'spPr', 'blipFill', 'blip');
  if (blip) addImage(c, relAttr(blip, 'embed'), { alt: s.alt, w: pos.w, h: pos.h });
  if (s.paras && !s.paras.some((p) => p.text) && !s.link) return null;
  return s.paras ? s : (s.link ? s : null);
}

function readPic(pic, c, tf) {
  const cNvPr = path(pic, 'nvPicPr', 'cNvPr');
  const nvPr = path(pic, 'nvPicPr', 'nvPr');
  const pos = applyTf(xfrmOf(path(pic, 'spPr', 'xfrm')), tf) || {};
  const alt = normLine(attr(cNvPr, 'descr') || attr(cNvPr, 'title') || '');
  const blip = path(pic, 'blipFill', 'blip');
  // 영상(외부 링크: 유튜브 등)
  const video = kid(nvPr, 'videoFile') || kid(nvPr, 'audioFile');
  let link = '';
  if (video) { const r = c.rels.get(relAttr(video, 'link')); if (r && r.external) link = r.target; }
  const hl = kid(cNvPr, 'hlinkClick');
  if (hl) { const r = c.rels.get(relAttr(hl, 'id')); if (r && r.external) link = link || r.target; }
  if (blip) addImage(c, relAttr(blip, 'embed'), { alt, w: pos.w, h: pos.h, link });
  if (link) return { kind: 'media', ...pos, link, alt, paras: null };
  return null;
}

function readFrame(gf, c, tf) {
  const pos = applyTf(xfrmOf(kid(gf, 'xfrm')), tf) || {};
  const gd = path(gf, 'graphic', 'graphicData');
  if (!gd) return null;
  const uri = attr(gd, 'uri') || '';
  const tbl = kid(gd, 'tbl');
  if (tbl) {
    const rows = [];
    for (const tr of kids(tbl, 'tr')) {
      const row = [];
      for (const tc of kids(tr, 'tc')) {
        if (attr(tc, 'hMerge') === '1' || attr(tc, 'vMerge') === '1') { row.push(''); continue; }
        const tb = kid(tc, 'txBody');
        const paras = tb ? readParas(tb, c, false) : [];
        row.push(normText(paras.map((p) => p.text).join('\n')));
      }
      if (row.some(Boolean)) rows.push(row);
    }
    if (rows.length) c.tables.push({ rows });
    return null;
  }
  if (/\/chart$/.test(uri)) {
    const ch = kid(gd, 'chart');
    const r = ch && c.rels.get(relAttr(ch, 'id'));
    const doc = r && !r.external ? c.zip?.xml?.(r.target) : null;
    const t = doc ? normLine(all(first(doc, 'title'), 't').map(textOf).join('')) : '';
    return t ? { kind: 'chart', ...pos, paras: [{ text: `[차트] ${t}`, level: 0, links: [] }] } : null;
  }
  if (/\/diagram$/.test(uri)) {
    const ids = kid(gd, 'relIds');
    const r = ids && c.rels.get(relAttr(ids, 'dm'));
    const doc = r && !r.external ? c.zip?.xml?.(r.target) : null;
    const paras = doc ? readDiagram(doc) : [];
    return paras.length ? { kind: 'diagram', ...pos, paras } : null;
  }
  return null;
}

/** a:txBody → 문단들 */
function readParas(txBody, c, bodyPh) {
  const out = [];
  const counters = [];
  let gap = false;
  for (const p of kids(txBody, 'p')) {
    const pPr = kid(p, 'pPr');
    const lvl = Math.min(8, Math.max(0, +attr(pPr, 'lvl') || 0));
    let text = '';
    let maxSz = 0;
    const links = [];
    const runs = [];
    let last = null;
    for (const r of p.children) {
      if (!isEl(r)) continue;
      if (r.local === 'r' || r.local === 'fld') {
        const t = textOf(kid(r, 't'));
        const rPr = kid(r, 'rPr');
        const sz = +attr(rPr, 'sz') || 0;
        if (sz > maxSz) maxSz = sz;
        c.tally.rPr(rPr, Math.max(1, t.length), c.themeFonts);
        if (t.trim()) runs.push({ font: runFont(rPr, t, c.themeFonts), n: t.replace(/\s/g, '').length, t });
        const h = kid(rPr, 'hlinkClick');
        let url = '';
        if (h) { const rel = c.rels.get(relAttr(h, 'id')); if (rel && rel.external) url = rel.target; }
        if (url) {
          if (last && last.url === url) last.label += t; else { last = { url, label: t }; links.push(last); }
        } else if (t.trim()) last = null;
        text += t;
      } else if (r.local === 'br') text += '\n';
    }
    if (!maxSz) maxSz = +attr(kid(p, 'endParaRPr'), 'sz') || 0;
    text = normText(text);
    if (!text) { gap = out.length > 0; if (links.length) out.push({ text: '', level: lvl, links }); continue; }
    let bullet = false, num = 0;
    const auto = kid(pPr, 'buAutoNum');
    if (kid(pPr, 'buNone')) bullet = false;
    else if (auto) {
      const start = +attr(auto, 'startAt') || 1;
      counters[lvl] = counters[lvl] ? counters[lvl] + 1 : start;
      num = counters[lvl];
    } else if (kid(pPr, 'buChar') || kid(pPr, 'buBlip')) bullet = true;
    else if (bodyPh) bullet = c.master.bodyBullet[lvl] !== false;
    if (!auto) counters.length = lvl; else counters.length = lvl + 1;
    out.push({ text, level: lvl, bullet, num, sz: maxSz, links, gap, runs });
    gap = false;
  }
  return out;
}

/** SmartArt 데이터 → 문단(연결 순서대로, 깊이 = 수준) */
function readDiagram(doc) {
  const pts = new Map();
  let docId = null;
  for (const pt of all(doc, 'pt')) {
    const type = attr(pt, 'type') || 'node';
    const id = attr(pt, 'modelId');
    if (type === 'doc') docId = id;
    if (type !== 'node' && type !== 'asst') continue;
    const t = kid(pt, 't');
    const text = t ? normText(kids(t, 'p').map((p) => all(p, 't').map(textOf).join('')).join('\n')) : '';
    pts.set(id, text);
  }
  const children = new Map();
  for (const cx of all(doc, 'cxn')) {
    const type = attr(cx, 'type') || 'parOf';
    if (type !== 'parOf') continue;
    const src = attr(cx, 'srcId');
    if (!children.has(src)) children.set(src, []);
    children.get(src).push({ id: attr(cx, 'destId'), ord: +attr(cx, 'srcOrd') || 0 });
  }
  const out = [];
  const seen = new Set();
  const walk = (id, depth) => {
    const list = (children.get(id) || []).sort((a, b) => a.ord - b.ord);
    for (const ch of list) {
      if (seen.has(ch.id)) continue;
      seen.add(ch.id);
      const t = pts.get(ch.id);
      if (t) out.push({ text: t, level: Math.max(0, depth), bullet: true, num: 0, links: [] });
      walk(ch.id, t ? depth + 1 : depth);
    }
  };
  if (docId) walk(docId, 0);
  if (!out.length) for (const t of pts.values()) if (t) out.push({ text: t, level: 0, bullet: true, num: 0, links: [] });
  return out;
}

function addImage(c, relId, { alt, w, h, link } = {}) {
  if (!relId) return;
  const r = c.rels.get(relId);
  if (!r || r.external) return;
  const ext = extOf(r.target);
  if (!WEB_IMAGE.has(ext)) c.unsupportedExt.add(ext || '?');
  if (c.images.some((im) => im.path === r.target)) return;
  c.mediaUse.set(r.target, (c.mediaUse.get(r.target) || 0) + 1);
  c.imgSeq++;
  const im = {
    id: `${c.fileId}-p${c.slideNo}-${c.imgSeq}`, name: baseName(r.target), path: r.target, mime: mimeOf(r.target),
    width: w ? Math.round(w / 9525) : 0, height: h ? Math.round(h / 9525) : 0,
    share: (w && h) ? Math.round((w * h) / (c.cx * c.cy) * 100) / 100 : 0,
  };
  if (alt) im.alt = alt;
  if (link) im.link = cleanUrl(link);
  if (!WEB_IMAGE.has(ext)) im.web = false;
  c.images.push(im);
}

function attachImageBytes(zip, pages, ctx) {
  const want = new Set();
  for (const p of pages) for (const im of p.images) if (!im.repeated || ctx.opts.withRepeatedImages) want.add(im.path);
  zip.preload((n) => want.has(n));
  for (const p of pages) for (const im of p.images) if (want.has(im.path)) {
    const b = zip.get(im.path);
    if (b) { im.bytes = b; im.size = b.length; }
  }
}

function readNotes(zip, notesPath, c) {
  const doc = zip.xml(notesPath);
  const tree = first(doc, 'spTree');
  if (!tree) return '';
  const rels = zip.rels(notesPath);
  const lines = [];
  for (const sp of all(tree, 'sp')) {
    const ph = path(sp, 'nvSpPr', 'nvPr', 'ph');
    const t = ph ? attr(ph, 'type') : null;
    if (ph && t !== 'body' && t !== undefined && t !== null) continue; // sldImg·sldNum 등 제외
    const tb = kid(sp, 'txBody');
    if (!tb) continue;
    for (const p of readParas(tb, { ...c, rels, tally: new StyleTally() }, false)) if (p.text) lines.push(p.text);
  }
  return normText(lines.join('\n'));
}

// ── 레이아웃·마스터 ─────────────────────────────────────
function phPositions(tree) {
  const map = new Map();
  for (const sp of all(tree, 'sp')) {
    const ph = path(sp, 'nvSpPr', 'nvPr', 'ph');
    if (!ph) continue;
    const pos = xfrmOf(path(sp, 'spPr', 'xfrm')) || { x: undefined, y: undefined };
    const l1 = path(sp, 'txBody', 'lstStyle', 'lvl1pPr');
    if (l1 && kid(l1, 'buNone')) pos.noBullet = true;
    if (pos.y === undefined && !pos.noBullet) continue;
    const idx = attr(ph, 'idx'), type = phKey(attr(ph, 'type') || 'obj');
    if (idx && !map.has('idx:' + idx)) map.set('idx:' + idx, pos);
    if (!map.has('type:' + type)) map.set('type:' + type, pos);
  }
  return map;
}

function readLayout(zip, p, cache) {
  if (cache.has(p)) return cache.get(p);
  const doc = zip.xml(p);
  const root = first(doc, 'sldLayout');
  const info = { type: attr(root, 'type') || '', name: normLine(attr(first(root, 'cSld'), 'name') || ''), ph: phPositions(first(root, 'spTree')) };
  cache.set(p, info);
  return info;
}

function readMaster(zip, p) {
  const doc = zip.xml(p);
  const root = first(doc, 'sldMaster');
  const rels = zip.rels(p);
  const themeRel = relOfType(rels, 'theme');
  const clrMapNode = kid(root, 'clrMap');
  const clrMap = clrMapNode ? { ...clrMapNode.attrs } : {};
  const bgPr = path(root, 'cSld', 'bg', 'bgPr');
  const bodyStyle = path(root, 'txStyles', 'bodyStyle');
  const bodyBullet = [];
  for (let i = 0; i < 9; i++) {
    const l = kid(bodyStyle, `lvl${i + 1}pPr`);
    if (!l) continue;
    if (kid(l, 'buNone')) bodyBullet[i] = false;
    else if (kid(l, 'buChar') || kid(l, 'buAutoNum') || kid(l, 'buBlip')) bodyBullet[i] = true;
  }
  return {
    themePath: themeRel ? themeRel.target : '',
    clrMap,
    background: bgPr ? kid(bgPr, 'solidFill') : null,
    ph: phPositions(first(root, 'spTree')),
    bodyBullet,
  };
}

function resolveColor(fill, clrMap, theme) {
  const direct = colorOf(fill);
  if (direct) return direct;
  const sc = kid(fill, 'schemeClr');
  if (!sc || !theme) return '';
  const v = attr(sc, 'val');
  const key = clrMap[v] || ({ bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' })[v] || v;
  return theme.colors[key] || '';
}

function layoutHint(layout, shapes, sc, c) {
  const t = layout?.type;
  if (t && LAYOUT_HINT[t] && t !== 'cust' && t !== 'obj') return LAYOUT_HINT[t];
  // 이름으로 추정(사용자 정의 레이아웃)
  const n = (layout?.name || '').toLowerCase();
  if (/title slide|제목 슬라이드|표지/.test(n)) return 'title';
  if (/section|구역 머리글|섹션|간지/.test(n)) return 'section';
  if (/blank|빈 화면/.test(n)) return 'blank';
  if (/title only|제목만/.test(n)) return 'title-only';
  if (/two|비교|두 개|2단/.test(n)) return 'two-content';
  const bigImage = sc.images.some((im) => !im.repeated && im.share >= 0.45);
  const textShapes = shapes.filter((s) => s.paras && !s.isTitle && s.paras.some((p) => p.text));
  if (bigImage && textShapes.length <= 1) return 'picture';
  if (sc.tables.length) return 'table';
  if (t) return LAYOUT_HINT[t] || 'content';
  return textShapes.length ? 'content' : 'blank';
}

/** 제목 자리표시자가 없을 때: 글자가 가장 크고 위쪽에 있는 짧은 글상자 */
function guessTitle(shapes, c) {
  let best = null, bestScore = 0;
  const sizes = shapes.filter((s) => s.paras).flatMap((s) => s.paras.map((p) => p.sz || 0)).filter(Boolean).sort((a, b) => a - b);
  const median = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;
  for (const s of shapes) {
    if (!s.paras || s.ph === 'subTitle') continue;
    const texts = s.paras.filter((p) => p.text);
    if (!texts.length || texts.length > 3) continue;
    const len = texts.reduce((n, p) => n + p.text.length, 0);
    if (len < 2 || len > 80) continue;
    const sz = Math.max(...texts.map((p) => p.sz || 0));
    const top = c.cy ? s.y / c.cy : 0.5;
    let score = 0;
    if (sz) score += sz / 100 / 4 + (median && sz > median * 1.2 ? 4 : 0);
    if (top < 0.25) score += 3; else if (top < 0.45) score += 1;
    if (texts.some((p) => p.bullet || p.num)) score -= 3;
    if (score > bestScore) { best = s; bestScore = score; }
  }
  return bestScore >= 6 ? best : null;
}

function slideSize(cx, cy) {
  const width = Math.round(cx / 9525), height = Math.round(cy / 9525);
  const r = cx / cy;
  const named = [['16:9', 16 / 9], ['4:3', 4 / 3], ['16:10', 1.6], ['A4', 297 / 210], ['A4-세로', 210 / 297], ['1:1', 1]];
  const hit = named.find(([, v]) => Math.abs(r - v) / v < 0.02);
  return { width, height, ratio: hit ? hit[0] : `${Math.round(r * 100) / 100}:1` };
}

function findMainPart(zip, fallback) {
  const rels = zip.rels('');
  for (const r of rels.values()) if (r.type === 'officeDocument' && zip.has(r.target)) return r.target;
  return fallback;
}
function findCorePath(zip) {
  const rels = zip.rels('');
  for (const r of rels.values()) if (r.type === 'core-properties' && zip.has(r.target)) return r.target;
  return 'docProps/core.xml';
}
export { findMainPart, findCorePath };
