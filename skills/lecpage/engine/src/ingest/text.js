// TXT·Markdown 해석: 마크다운 제목(#)·목록·번호·코드 블록·표·링크를 블록으로 바꿔 쪽(section)으로 나눕니다.
import { normText, normLine, cleanUrl, decodeText } from './util.js';
import { blocksToPages } from './blocks.js';

export function parseTextFile(bytes, ctx, { markdown = false } = {}) {
  const raw = decodeText(bytes);
  return parseText(raw, ctx, { markdown });
}

export function parseText(raw, ctx, { markdown = false } = {}) {
  const text = normText(String(raw || '').replace(/\t/g, '    '));
  const lines = String(raw || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let gap = false;
  let fence = null;
  let table = null;
  const md = markdown || /^#{1,6}\s|\n#{1,6}\s|```|\n\s*[-*]\s|\[[^\]]+\]\(https?:/.test(text);

  const flushTable = () => { if (table && table.length) blocks.push({ type: 'table', rows: table }); table = null; };
  for (let rawLine of lines) {
    if (fence) {
      if (/^\s*(```|~~~)/.test(rawLine)) {
        const t = normText(fence.lines.join('\n'));
        if (t) blocks.push({ type: 'p', text: t, level: 0, heading: null, role: 'code', links: [], images: [], gapBefore: true });
        fence = null;
      } else fence.lines.push(rawLine);
      continue;
    }
    if (md && /^\s*(```|~~~)/.test(rawLine)) { flushTable(); fence = { lines: [] }; continue; }
    const line = normLine(rawLine);
    if (!line) { flushTable(); gap = true; continue; }
    // 표(| a | b |)
    if (md && /^\|.*\|$/.test(line)) {
      if (/^\|[\s:|-]+\|$/.test(line)) continue; // 구분선
      table = table || [];
      table.push(line.slice(1, -1).split('|').map((x) => normLine(x)));
      continue;
    }
    flushTable();
    const links = [];
    let t = line;
    if (md) {
      t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (m, alt) => alt);
      t = t.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (m, label, url) => { const u = cleanUrl(url); if (u) links.push({ url: u, label: normLine(label) }); return label; });
      t = t.replace(/(\*\*|__)(.+?)\1/g, '$2').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2').replace(/`([^`]+)`/g, '$1');
    }
    const indent = (/^(\s*)/.exec(rawLine.replace(/\t/g, '    '))[1] || '').length;
    const b = { type: 'p', text: '', level: Math.min(4, Math.floor(indent / 2)), heading: null, links, images: [] };
    let m;
    if (md && (m = /^(#{1,6})\s+(.*)$/.exec(t))) { b.heading = m[1].length === 1 ? 1 : m[1].length; b.text = m[2].replace(/\s+#+\s*$/, ''); b.level = 0; }
    else if ((m = /^[-*+•·▪◦●○■□]\s+(.*)$/.exec(t))) { b.bullet = true; b.text = m[1]; }
    else if (md && (m = /^>\s?(.*)$/.exec(t))) { b.text = m[1]; b.role = 'quote'; }
    else b.text = t;
    b.text = normText(b.text);
    if (!b.text) continue;
    if (gap) { b.gapBefore = true; gap = false; }
    blocks.push(b);
  }
  flushTable();
  if (fence && fence.lines.length) blocks.push({ type: 'p', text: normText(fence.lines.join('\n')), level: 0, heading: null, role: 'code', links: [], images: [] });
  // 마크다운 '# 제목'이 하나뿐이면 문서 제목(0)으로
  const h1 = blocks.filter((b) => b.heading === 1);
  if (h1.length === 1 && blocks.indexOf(h1[0]) === 0 && blocks.some((b) => b.heading === 2)) h1[0].heading = 0;
  const pages = blocksToPages(blocks, { fileId: ctx.fileId, unit: 'section', maxPages: ctx.limits.maxPages });
  return { pages, design: null, meta: {}, unit: 'section' };
}
