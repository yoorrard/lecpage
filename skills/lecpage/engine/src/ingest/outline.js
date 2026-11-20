// AI에게 건넬 보조 글자 만들기(교재 원본·쪽 그림이 먼저, 이 글은 찾기·옮겨 적기용). 쪽 번호를 붙이고, 반복을 빼고,
// 길이 예산(maxChars)에 맞춰 단계적으로 줄입니다. 교재의 뜻은 해석하지 않습니다(AI가 직접 읽음).
import { normLine, textKey, truncate } from './util.js';

const UNIT_KO = { slide: '장', page: '쪽', section: '부분', link: '개' };
const LAYOUT_KO = { title: '표지', section: '간지', picture: '그림', table: '표', blank: '빈 쪽', 'title-only': '제목만' };

// 줄이기 단계: 노트 길이, 쪽당 일반 줄 수, 줄 길이, 표 줄 수, 실습 아닌 쪽 본문 유지 여부
const LEVELS = [
  { notes: 600, lines: 99, line: 400, rows: 12, other: true },
  { notes: 240, lines: 14, line: 260, rows: 6, other: true },
  { notes: 100, lines: 8, line: 160, rows: 4, other: true },
  { notes: 0, lines: 4, line: 120, rows: 2, other: true },
  { notes: 0, lines: 2, line: 90, rows: 0, other: false },
  { notes: 0, lines: 0, line: 80, rows: 0, other: false },
];

/**
 * @param {object} material
 * @param {{maxChars?:number, notes?:boolean, header?:boolean}} opts
 * @returns {string}
 */
export function materialToAIContext(material, { maxChars = 24000, notes = true, header = true } = {}) {
  const files = material.files || [];
  const multi = files.length > 1;
  const renderOnly = new Set(files.filter((f) => f.renderOf).map((f) => f.id));
  // 숨긴 쪽은 보내지 않음(사이트에 싣지 않는 쪽)
  const pages = (material.pages || []).filter((p) => !p.error && !p.hidden && !renderOnly.has(p.file));
  const head = header ? buildHeader(material) : '';
  const budget = Math.max(400, maxChars - head.length - 2);
  for (const L of LEVELS) {
    const body = buildBody(pages, L, { multi, notes });
    if (body.length <= budget) return (head + body).trim();
  }
  // 마지막: 앞에서부터 예산까지 + 남은 쪽 제목 목록
  const L = LEVELS[LEVELS.length - 1];
  const chunks = pages.map((p) => pageBlock(p, L, { multi, notes: false }));
  let out = '';
  let i = 0;
  for (; i < chunks.length; i++) { if (out.length + chunks[i].length > budget * 0.85) break; out += chunks[i]; }
  if (i < chunks.length) {
    const rest = pages.slice(i).map((p) => `${label(p, multi)} ${truncate(p.title || '', 30)}`).join(' / ');
    out += `\n(뒤 ${chunks.length - i}쪽은 길이 제한으로 줄임: ${truncate(rest, Math.max(100, budget - out.length - 60))})\n`;
  }
  return (head + out).slice(0, maxChars).trim();
}

function label(p, multi) { return `${multi ? p.file + ' ' : ''}p.${p.page}`; }

function buildHeader(m) {
  const L = ['[교재 정보]'];
  for (const f of m.files || []) L.push(`- ${f.id}: ${f.name} (${(f.type || '').toUpperCase()}, ${f.pages || 0}${UNIT_KO[f.unit] || '쪽'})${f.url ? ' ' + f.url : ''}${f.renderOf ? ` — ${f.renderOf}의 PDF본(쪽 그림용, 내용 생략)` : ''}`);
  const bp = (m.boilerplate || []).filter((b) => !(m.files || []).some((f) => f.id === b.file && f.renderOf));
  if (bp.length) L.push(`- 모든 쪽에 반복되는 문구(생략): ${bp.slice(0, 5).map((b) => truncate(b.text, 40)).join(' / ')}`);
  L.push('', '[쪽별 내용]');
  return L.join('\n') + '\n';
}

function buildBody(pages, L, c) {
  let s = '';
  for (const p of pages) s += pageBlock(p, L, c);
  return s;
}

function pageBlock(p, L, { multi, notes }) {
  const tag = [LAYOUT_KO[p.layout], p.hidden ? '숨김' : ''].filter(Boolean).join('·');
  const out = [`## ${label(p, multi)}${tag ? ` [${tag}]` : ''} ${p.title || '(제목 없음)'}`];
  const seen = new Set([textKey(p.title)]);
  let normal = 0;
  const maxNormal = L.other ? L.lines : 0;
  for (const x of p.paragraphs || []) {
    const k = textKey(x.text);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    if (normal >= maxNormal) continue;
    normal++;
    const indent = '  '.repeat(Math.min(3, x.level || 0));
    const mark = x.num ? `${x.num}. ` : x.bullet ? '- ' : '';
    out.push(`${indent}${mark}${truncate(x.text, L.line).replace(/\n/g, '\n' + indent + '  ')}`);
  }
  if (L.rows) for (const t of p.tables || []) {
    const rows = t.rows.slice(0, L.rows).map((r) => '| ' + r.map((c) => truncate(normLine(c), 60)).join(' | ') + ' |');
    if (t.rows.length > L.rows) rows.push(`| … ${t.rows.length - L.rows}줄 더 |`);
    out.push(...rows);
  }
  const links = (p.links || []).filter((l) => !out.some((o) => o.includes(l.url)));
  if (links.length) out.push('링크: ' + links.slice(0, 6).map((l) => `${l.label && l.label !== l.url ? l.label + ' ' : ''}<${l.url}>`).join(', '));
  const imgs = (p.images || []).filter((im) => !im.repeated).length;
  if (imgs && L.lines >= 4) out.push(`(그림 ${imgs}개)`);
  if (notes && L.notes && p.notes) out.push(`> 노트: ${truncate(normLine(p.notes), L.notes)}`);
  return out.join('\n') + '\n';
}
