// 문서형 자료(DOCX·HWPX·TXT·MD)를 '쪽(section)'으로 나누는 공통 규칙.
// 블록: { type:'p', text, level, bullet, num, heading(0=문서 제목,1,2…|null), pageBreakBefore, bold, sz, links[], images[] }
//       { type:'table', rows:[[...]] }
import { normLine } from './util.js';

// 공문·교재에서 흔한 번호 체계: Ⅰ. / 1. / 가. / 1) / 가)
const ROMAN = /^(?:[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]|(?:I|II|III|IV|V|VI|VII|VIII|IX|X))\s*[.)]\s*\S/;
const ARABIC = /^\d{1,2}\s*\.\s*\S/;
const SENTENCE_END = /(다|요|니다|세요|까|죠|음|함|됨|임)[.!?]?$|[.!?]$/;

function pseudoLevel(b) {
  if (b.type !== 'p' || !b.text || b.text.length > 40 || b.bullet || b.text.includes('\n')) return null;
  if (ROMAN.test(b.text)) return 1;
  if (ARABIC.test(b.text) && !SENTENCE_END.test(b.text)) return 2;
  if (b.bold && b.text.length <= 30 && !SENTENCE_END.test(b.text)) return 2;
  if (b.sz && b.sz >= 1600 && b.text.length <= 30) return 1; // 16pt 이상
  return null;
}

/**
 * 한 칸짜리 표는 표가 아니라 '상자에 넣은 글'이다(한글 문서의 제목 상자·강조 상자).
 * 문서 맨 앞의 짧은 한 줄이면 문서 제목(heading 0), 그 밖에는 보통 문단으로 바꾼다.
 */
function unboxSingleCellTables(blocks) {
  let seenText = false;
  const out = [];
  for (const b of blocks) {
    if (b.type === 'table' && b.rows?.length === 1 && b.rows[0].length === 1 && b.rows[0][0]) {
      const lines = String(b.rows[0][0]).split('\n').map((t) => normLine(t)).filter(Boolean);
      if (!seenText && lines.length === 1 && lines[0].length <= 80) out.push({ type: 'p', text: lines[0], level: 0, heading: 0, links: [], images: [], boxed: true });
      else for (const text of lines) out.push({ type: 'p', text, level: 0, heading: null, role: 'text', links: [], images: [], boxed: true });
      seenText = true;
      continue;
    }
    if (b.type === 'p' && b.text) seenText = true;
    out.push(b);
  }
  return out;
}

export function blocksToPages(blocks0, { fileId, unit = 'section', maxPages = 1000, chunk = 25 } = {}) {
  const blocks = unboxSingleCellTables(blocks0);
  const ps = blocks.filter((b) => b.type === 'p' && b.text);
  const heads = ps.filter((b) => b.heading !== null && b.heading !== undefined);
  const h1 = heads.filter((b) => b.heading <= 1).length;
  const h2 = heads.filter((b) => b.heading === 2).length;
  let mode = 'chunk', splitLevel = 1;
  if (h1 >= 3) { mode = 'heading'; splitLevel = 1; }
  else if (h1 + h2 >= 3) { mode = 'heading'; splitLevel = 2; }
  else if (blocks.filter((b) => b.pageBreakBefore).length >= 2) mode = 'break';
  else {
    const pseudo = ps.map(pseudoLevel);
    const l1 = pseudo.filter((x) => x === 1).length, l2 = pseudo.filter((x) => x === 2).length;
    if (l1 >= 2 || l1 + l2 >= 3) {
      mode = 'pseudo';
      splitLevel = l1 >= 3 ? 1 : 2;
      ps.forEach((b, i) => { if (pseudo[i] !== null) b.pseudo = pseudo[i]; });
    } else if (heads.length) { mode = 'heading'; splitLevel = 2; }
  }

  const pages = [];
  let cur = null;
  let count = 0;
  const open = (title, guessed) => {
    cur = { file: fileId, page: pages.length + 1, kind: unit, title: normLine(title || ''), paragraphs: [], notes: '', links: [], images: [], tables: [] };
    if (guessed) cur.titleGuessed = true;
    pages.push(cur);
    count = 0;
  };
  const isSplit = (b) => {
    if (mode === 'heading') return b.type === 'p' && b.heading !== null && b.heading !== undefined && b.heading <= splitLevel;
    if (mode === 'pseudo') return b.type === 'p' && b.pseudo && b.pseudo <= splitLevel;
    if (mode === 'break') return !!b.pageBreakBefore;
    return false;
  };
  let block = 0;
  for (const b of blocks) {
    if (pages.length >= maxPages && cur) { /* 나머지는 마지막 쪽에 붙임 */ }
    else if (!cur || (isSplit(b) && (cur.paragraphs.length || cur.tables.length || cur.images.length || (mode === 'break' && cur.title)))
      || (mode === 'chunk' && count >= chunk && b.type === 'p' && (b.gapBefore || b.heading !== null && b.heading !== undefined || count >= chunk * 1.6))) {
      const asTitle = b.type === 'p' && (isSplit(b) || (b.heading !== null && b.heading !== undefined)) && b.text.length <= 120;
      open(asTitle ? b.text : '', false);
      if (asTitle) { b.links?.forEach((l) => cur.links.push(l)); b.images?.forEach((im) => cur.images.push(im)); continue; }
    } else if (cur && !cur.title && !cur.paragraphs.length && b.type === 'p' && (isSplit(b) || (b.heading !== null && b.heading !== undefined)) && b.text.length <= 120) {
      cur.title = normLine(b.text);
      b.links?.forEach((l) => cur.links.push(l));
      continue;
    }
    if (b.type === 'table') { if (b.rows?.length) cur.tables.push({ rows: b.rows }); continue; }
    if (b.type === 'image') { cur.images.push(b.image); continue; }
    for (const l of b.links || []) cur.links.push(l);
    for (const im of b.images || []) cur.images.push(im);
    if (!b.text) continue;
    if (b.gapBefore || b.pageBreakBefore) block++;
    const para = { text: b.text, level: b.level || 0, block };
    if (b.bullet) para.bullet = true;
    if (b.num) para.num = b.num;
    if (b.heading !== null && b.heading !== undefined) para.role = 'heading';
    else if (b.pseudo) para.role = 'heading';
    if (b.role) para.role = b.role;
    if (b.gapBefore) para.gap = true;
    if (b.sz) para.size = Math.round(b.sz / 100);
    cur.paragraphs.push(para);
    count++;
  }
  // 제목이 없는 쪽: 첫 짧은 문단을 제목 후보로
  for (const p of pages) {
    if (p.title) continue;
    const i = p.paragraphs.findIndex((x) => x.text.length <= 60 && !x.text.includes('\n'));
    if (i >= 0 && i <= 1) { p.title = normLine(p.paragraphs[i].text); p.paragraphs.splice(i, 1); p.titleGuessed = true; }
  }
  // 링크 중복 제거
  for (const p of pages) {
    const seen = new Map();
    for (const l of p.links) { if (!seen.has(l.url)) seen.set(l.url, { ...l }); else if (!seen.get(l.url).label && l.label) seen.get(l.url).label = l.label; }
    p.links = [...seen.values()];
  }
  return pages.filter((p) => p.title || p.paragraphs.length || p.tables.length || p.images.length).map((p, i) => ({ ...p, page: i + 1 }));
}
