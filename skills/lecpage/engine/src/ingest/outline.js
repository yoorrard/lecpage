// AI 프롬프트에 넣을 교재 요약 글 만들기. 쪽 번호를 붙이고, 반복을 빼고, 길이 예산(maxChars)에 맞춰 단계적으로 줄입니다.
// 프롬프트·실습 단계 줄은 끝까지 원문 그대로 둡니다(AI가 고쳐 쓰지 않도록).
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
  const d = material.detected || {};
  const files = material.files || [];
  const multi = files.length > 1;
  const renderOnly = new Set(files.filter((f) => f.renderOf).map((f) => f.id));
  // 숨긴 쪽은 보내지 않음(사이트에 싣지 않는 쪽)
  const pages = (material.pages || []).filter((p) => !p.error && !p.hidden && !renderOnly.has(p.file));
  const promptKeys = new Set((d.prompts || []).map((x) => textKey(x.text)));
  const keep = new Set(promptKeys);
  for (const s of d.steps || []) for (const it of s.items) keep.add(textKey(it.split('\n')[0]));
  const practice = new Set((d.practice?.pages || []).map((r) => `${r.file}:${r.page}`));

  const head = header ? buildHeader(material, d) : '';
  const budget = Math.max(400, maxChars - head.length - 2);
  for (const L of LEVELS) {
    const body = buildBody(pages, L, { keep, promptKeys, practice, multi, notes, d });
    if (body.length <= budget) return (head + body).trim();
  }
  // 마지막: 앞에서부터 예산까지 + 남은 쪽 제목 목록
  const L = LEVELS[LEVELS.length - 1];
  const chunks = pages.map((p) => pageBlock(p, L, { keep, promptKeys, practice, multi, notes: false, d }));
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

function buildHeader(m, d) {
  const L = ['[교재 정보]'];
  for (const f of m.files || []) L.push(`- ${f.id}: ${f.name} (${(f.type || '').toUpperCase()}, ${f.pages || 0}${UNIT_KO[f.unit] || '쪽'})${f.url ? ' ' + f.url : ''}${f.renderOf ? ` — ${f.renderOf}의 PDF본(쪽 그림용, 내용 생략)` : ''}`);
  const ev = d.event || {};
  const evBits = [];
  if (ev.date) evBits.push(`일시 ${ev.date}${ev.start ? ` ${ev.start}${ev.end ? '~' + ev.end : ''}` : ''}`);
  if (ev.venue) evBits.push(`장소 ${ev.venue}`);
  if (ev.organizer) evBits.push(`주최 ${ev.organizer}`);
  if (ev.mode) evBits.push(`방식 ${ev.mode}`);
  if (evBits.length) L.push(`- 자동 감지(확인 필요): ${evBits.join(' · ')}`);
  if (d.title) L.push(`- 제목 후보: ${d.title}${d.subtitle ? ` / ${d.subtitle}` : ''}`);
  if (d.instructor?.name) L.push(`- 강사 후보: ${d.instructor.name}${d.instructor.role ? ` (${d.instructor.role})` : ''} [${label(d.instructor, (m.files || []).length > 1)}]`);
  if (d.sections?.length) L.push(`- 부(Part): ${d.sections.map((s) => `${s.label} ${s.title} [p.${s.pages[0]}~${s.pages[s.pages.length - 1]}]`).join(' | ')}`);
  if (d.practice) L.push(`- 실습 쪽 ${d.practice.count}개(비율 ${Math.round((d.practice.ratio || 0) * 100)}%) · 유형 힌트 ${d.archetype?.primary || ''}`);
  const multi = (m.files || []).filter((f) => !f.renderOf).length > 1;
  const refText = (x) => (x.refs || [{ file: x.file, page: x.page }]).slice(0, 4).map((r) => `${multi ? r.file + ' ' : ''}p.${r.page}`).join(',');
  if (d.tools?.length) L.push(`- 도구: ${d.tools.slice(0, 15).map((t) => `${t.name}(${refText(t)})`).join(', ')}`);
  if (d.prompts?.length) L.push(`- 프롬프트 ${d.prompts.length}개 감지(본문의 [프롬프트] 줄은 원문 그대로 쓰세요)`);
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

function pageBlock(p, L, { keep, promptKeys, practice, multi, notes, d }) {
  const isPractice = practice.has(`${p.file}:${p.page}`);
  const tag = [LAYOUT_KO[p.layout], isPractice ? '실습' : '', p.hidden ? '숨김' : ''].filter(Boolean).join('·');
  const out = [`## ${label(p, multi)}${tag ? ` [${tag}]` : ''} ${p.title || '(제목 없음)'}`];
  const seen = new Set([textKey(p.title)]);
  // 이 쪽의 프롬프트: 문단 안에 있으면 그 줄에 [프롬프트] 표시, 없으면(노트·여러 글상자) 끝에 덧붙임
  const here = (d.prompts || []).filter((pr) => (pr.refs || [{ file: pr.file, page: pr.page }]).some((r) => r.file === p.file && r.page === p.page));
  const paraKeys = (p.paragraphs || []).map((x) => textKey(x.text));
  const promptStart = new Set(), promptPart = new Set(), append = [];
  for (const pr of here) {
    const lines = pr.text.split('\n').map(textKey).filter(Boolean);
    const idx = lines.map((lk) => paraKeys.findIndex((k) => k.includes(lk)));
    if (idx.every((i) => i >= 0)) { promptStart.add(idx[0]); idx.forEach((i) => promptPart.add(i)); } else append.push(pr);
  }
  let normal = 0;
  const maxNormal = L.other || isPractice ? L.lines : 0;
  (p.paragraphs || []).forEach((x, i) => {
    const k = paraKeys[i];
    if (!k || seen.has(k)) return;
    seen.add(k);
    const first = textKey(x.text.split('\n')[0]);
    const kept = keep.has(k) || keep.has(first) || promptPart.has(i);
    if (!kept) { if (normal >= maxNormal) return; normal++; }
    const indent = '  '.repeat(Math.min(3, x.level || 0));
    const mark = (promptStart.has(i) || promptKeys.has(k) ? '[프롬프트] ' : '') + (x.num ? `${x.num}. ` : x.bullet ? '- ' : '');
    const text = kept ? x.text : truncate(x.text, L.line);
    out.push(`${indent}${mark}${text.replace(/\n/g, '\n' + indent + '  ')}`);
  });
  for (const pr of append) out.push(`[프롬프트] ${pr.text}`);
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
