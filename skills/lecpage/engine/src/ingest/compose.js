// 교재 묶음(signals.js) → 본문 칸. 문서형 교재는 절 순서 그대로, 슬라이드는 신호가 있는 쪽만 칸으로 올립니다.
// 그리고 '교재에 있는데 싣지 못한 것' 찾기(findLeftovers)와 그것을 본문 칸으로 넣기(leftoversToSections).
// 지어내지 않습니다: 칸의 글자는 모두 교재에서 온 것이고, 고쳐 쓰지 않습니다.
import { classifyUnits, cleanTitle, splitLabel, tableData } from './signals.js';
import { normLine, truncate, textKey } from './util.js';

const cellMd = (c) => String(c ?? '').replace(/\|/g, '\\|').replace(/\n+/g, '<br>').trim();
/** 표 → 마크다운 표 */
export function tableMd(head, rows) {
  const n = Math.max(head.length, ...rows.map((r) => r.length));
  const line = (r) => `| ${Array.from({ length: n }, (_, i) => cellMd(r[i])).join(' | ')} |`;
  return [line(head.length ? head : Array(n).fill('')), `|${' --- |'.repeat(n)}`, ...rows.map(line)].join('\n');
}

const BOX_TITLE = /^\[([^\]]{2,30})\]\s*(.*)$/;
const NUM_MARK = /^\(?\d{1,2}\s*[.)]\s+|^[①-⑳]\s*/;
/**
 * 절의 문단·표 → 글 칸의 마크다운. 번호·머리표 문단은 목록, 글상자는 강조 상자(예시문은 복사 버튼), 각주는 ※ 줄.
 * 링크는 표시 글자를 눌러 가게 바꿈. skip에 든 주소(강사 확인이 필요한 중계·설문 주소)는 글자만 둠
 */
export function unitToMd(u, { skip = new Set(), only = null } = {}) {
  const links = (u.links || []).filter((l) => l.url && l.label && l.label.length >= 2 && !skip.has(l.url) && !/^https?:/i.test(l.label));
  const linkify = (t) => { for (const l of links) if (t.includes(l.label)) return t.replace(l.label, `[${l.label}](${l.url})`); return t; };
  const out = []; let box = null; let list = null;
  const flushBox = () => {
    if (!box) return;
    const first = box[0]; const m = BOX_TITLE.exec(first);
    if (/^\(각주\)/.test(first)) out.push(box.map((t) => `※ ${t.replace(/^\(각주\)\s*/, '')}`).join('\n'));
    else if (m) { const kind = /예시|서식|양식|문안|통지문|안내문/.test(m[1]) ? '예시' : '참고'; out.push([`> [!${kind}] ${m[1]}`, ...[m[2], ...box.slice(1)].filter(Boolean).map((t) => `> ${t}`)].join('\n')); }
    else if (box.length === 1 && first.length <= 40) out.push(`> ${first}`);
    else out.push(['> [!참고]', ...box.map((t) => `> ${linkify(t)}`)].join('\n'));
    box = null;
  };
  const flushList = () => { if (list) { out.push(list.join('\n')); list = null; } };
  const paras = (u.paras || []).filter((x) => x.text && normLine(x.text) && (!only || only(x)));
  let n = 0;
  for (const x of paras) {
    const t = normLine(x.text);
    if (x.role === 'text') { flushList(); (box = box || []).push(t); continue; }
    flushBox();
    if (x.role === 'heading') { flushList(); n = 0; out.push(`### ${t}`); continue; }
    const numbered = !!x.num || NUM_MARK.test(t);
    if (numbered || x.bullet || (x.level > 0 && list)) {
      const body = linkify(t.replace(NUM_MARK, ''));
      if (!list) { list = []; n = 0; }
      list.push(x.level > 0 && list.length ? `  - ${body}` : numbered ? `${++n}. ${body}` : `- ${body}`);
      continue;
    }
    flushList(); n = 0;
    out.push(linkify(t.replace(/ \| /g, ' · ')).replace(/^[#>|]+\s*/, '')); // 줄 머리의 #, >, | 는 문법으로 읽히지 않게 뗌
  }
  flushBox(); flushList();
  return out.join('\n\n').trim();
}

/**
 * 묶음 → 본문 칸 목록(교재 순서).
 * @returns {{ entries: Array<{slot:string,page:number,file:string}|{section:object,page:number,file:string,doc:boolean}>, prep: string[] }}
 */
export function composeBody(material, d, { skipUrls = new Set() } = {}) {
  const units = classifyUnits(material, d);
  const entries = []; const seenSlot = new Set(); let prep = []; let lastDiscuss = null;
  const msgKeys = new Set((d.messages || []).map((m) => textKey(m.text)));
  const push = (c, section) => entries.push({ section: { ...section, source: { file: c.unit.file, pages: c.unit.pages } }, page: c.unit.page, file: c.unit.file, doc: !!c.unit.doc });
  for (const c of units) {
    const u = c.unit;
    if (c.kind === 'cover' || c.kind === 'deck') continue;
    if (c.slot) { if (c.slot !== 'followup' && !seenSlot.has(c.slot)) { seenSlot.add(c.slot); entries.push({ slot: c.slot, page: u.page, file: u.file }); } continue; }
    if (c.kind === 'prep') { if (!prep.length) prep = c.items; continue; }
    if (c.kind === 'cases') push(c, { type: 'cases', title: c.title || '사례', lead: truncate(c.lead || '', 300), items: c.items });
    else if (c.kind === 'discuss') { push(c, { type: 'discuss', title: c.title || '함께 나눌 질문', items: c.items, rules: [], note: truncate(c.note || '', 300) }); lastDiscuss = entries[entries.length - 1].section; }
    else if (c.kind === 'rules') { if (lastDiscuss && !lastDiscuss.rules.length) { lastDiscuss.rules = c.items; lastDiscuss.source.pages = [...new Set([...lastDiscuss.source.pages, ...u.pages])]; } else push(c, { type: 'text', title: cleanTitle(u.title), md: c.items.map((t) => `- ${t}`).join('\n') }); }
    else if (c.kind === 'reflection') push(c, { type: 'reflection', title: c.title || '나의 기록', lead: truncate((c.extra || []).filter((t) => !msgKeys.has(textKey(t))).join(' '), 300), prompts: c.prompts });
    else if (c.kind === 'procedure') {
      const rest = (c.rest || []).map((t) => t.replace(/^\(각주\)\s*/, '※ '));
      const close = rest.join('\n');
      push(c, { type: 'procedure', title: c.title || '절차', items: c.items, close: close.length <= 300 ? close : '' });
      if (close.length > 300) push(c, { type: 'text', title: '', md: unitToMd(u, { skip: skipUrls, only: (x) => !x.num && !/^\(?\d{1,2}\s*[.)]\s+/.test(normLine(x.text)) }) });
    } else if (c.kind === 'figures') push(c, { type: 'glance', title: c.title, items: c.items.map((f) => ({ value: f.value, label: f.label, note: f.note })) });
    else if (c.kind === 'facts') push(c, { type: 'table', title: c.title, head: [], rows: c.rows, _facts: true });
    else if (c.kind === 'table') {
      const lines = (c.lines || []).filter(Boolean);
      if (lines.length > 1) push(c, { type: 'text', title: c.title, md: unitToMd(u, { skip: skipUrls }) });
      c.tables.forEach((t, i) => push(c, { type: 'table', title: i === 0 && lines.length <= 1 ? c.title : '', lead: i === 0 && lines.length === 1 ? truncate(lines[0], 300) : '', head: t.head, rows: t.rows, _use: t.use }));
    } else if (c.kind === 'keypoints') push(c, { type: 'steps5', title: c.title, items: c.items.map((i) => ({ word: truncate(i.word, 20), desc: truncate(i.desc, 120) })), close: c.close || '' });
    else if (c.kind === 'text') { const md = unitToMd(u, { skip: skipUrls }); if (md) push(c, { type: 'text', title: c.title, md: truncate(md, 6000) }); }
    // 절차·사례·질문 절에 함께 있던 표도 버리지 않고 바로 뒤에 표 칸으로
    if (c.kind !== 'table') for (const t of (u.tables || []).map(tableData).filter(Boolean)) push(c, { type: 'table', title: '', head: t.head, rows: t.rows, _use: t.use });
  }
  return { entries, prep };
}

// ── 교재에 있는데 싣지 못한 것 ─────────────────────────────
const META_LABEL = /^(?:일\s*시|날\s*짜|기\s*간|일\s*자|시\s*간|장\s*소|강\s*사|발\s*표\s*자|연\s*사|주\s*최|주\s*관|문\s*의(?:처)?|연락처|대\s*상|참\s*석|참\s*가|인\s*원)$/;
const words = (t) => normLine(t).split(/[\s|·,/()[\]:：]+/).map(textKey).filter((w) => w.length >= 2);
/**
 * 교재의 문단·표 줄 가운데 설계도 어느 칸에도(교재 보기 포함) 없는 것.
 * 고쳐 쓴 문장도 찾도록 낱말이 60% 넘게 겹치면 실린 것으로 봄. 표지의 일시·장소·강사 줄은 연수 정보가 있으면 실린 것.
 * @returns {{ count:number, items:Array<{file,page,title,text,kind}> }}
 */
export function findLeftovers(material, bp, { max = 20 } = {}) {
  if (!material?.pages?.length || !bp) return { count: 0, items: [] };
  const renderOnly = new Set((material.files || []).filter((f) => f.renderOf).map((f) => f.id));
  const boiler = new Set((material.boilerplate || []).map((b) => textKey(b.text)));
  const visible = (bp.sections || []).filter((s) => s && !s.hidden);
  const hay = textKey(JSON.stringify({ meta: bp.meta, instructors: bp.instructors, sections: visible }));
  const meta = bp.meta || {};
  const has = (text) => {
    const k = textKey(text);
    if (k.length < 6 || boiler.has(k)) return true;
    if (hay.includes(k) || (k.length > 28 && (hay.includes(k.slice(0, 20)) || hay.includes(k.slice(-20))))) return true;
    const lab = splitLabel(normLine(text).replace(/^[-•·▪◦●○■□▶▷►※*]\s*/, ''));
    if (lab && META_LABEL.test(lab[0]) && (meta.date || meta.venue || (bp.instructors || []).length || meta.organizer || meta.contact)) return true;
    const w = words(lab ? lab[1] : text);
    return w.length >= 2 && w.filter((x) => hay.includes(x)).length / w.length >= 0.6;
  };
  const items = []; let count = 0;
  for (const p of material.pages) {
    if (p.hidden || p.error || renderOnly.has(p.file)) continue;
    const add = (text, kind) => { if (has(text)) return; count++; if (items.length < max) items.push({ file: p.file, page: p.page, title: cleanTitle(p.title), text: truncate(normLine(text), 160), kind }); };
    for (const x of p.paragraphs || []) if (x.text) add(x.text, 'para');
    for (const t of p.tables || []) for (const r of t.rows || []) { const row = r.filter(Boolean).join(' | '); if (row) add(row, 'row'); }
  }
  return { count, items };
}

const TAIL = ['materials', 'followup', 'instructor', 'speakers', 'survey', 'closing'];
/**
 * 싣지 못한 것을 넣을 자리(교재 순서): 같은 교재 파일에서 그 쪽보다 앞 쪽을 담은 마지막 본문 칸 바로 뒤, 없으면 자료·연수 후·마무리 앞.
 * @returns {Array<{after:string|null, section:object}>} 패치의 add 모양(applyBlueprintPatch)
 */
export function leftoverAdds(bp, leftovers) {
  const secs = (bp?.sections || []).filter((s) => s && !s.hidden);
  const tailAt = secs.findIndex((s) => TAIL.includes(s.type));
  const body = tailAt < 0 ? secs : secs.slice(0, tailAt);
  const fallback = body[body.length - 1]?.id || null;
  const lastAfter = new Map();
  return leftoversToSections(leftovers).map((section) => {
    const page = section.source.pages[0];
    // AI 답의 칸은 source.file 없이 쪽 번호만 적기도 함
    const anchor = body.filter((s) => s.type !== 'hero' && s.source?.pages?.length && (!s.source.file || s.source.file === section.source.file) && s.source.pages.some((n) => n <= page)).pop();
    const key = anchor?.id || fallback;
    const after = lastAfter.get(key) || key; // 같은 자리에 여럿이면 앞에 넣은 것 뒤로(교재 순서 유지)
    lastAfter.set(key, section.id);
    return { after, section };
  });
}

/** 싣지 못한 것 → 글 칸(쪽마다 하나). 강사가 '본문 칸으로 넣기'를 누르면 교재 순서 자리에(leftoverAdds) */
export function leftoversToSections(leftovers) {
  const groups = new Map();
  for (const it of leftovers?.items || []) { const k = `${it.file}:${it.page}`; if (!groups.has(k)) groups.set(k, { title: it.title, page: it.page, file: it.file, lines: [] }); groups.get(k).lines.push(it); }
  return [...groups.values()].map((g, i) => ({
    id: `more-${g.page}-${i + 1}`, type: 'text', nav: '', title: g.title || '',
    md: g.lines.map((x) => (x.kind === 'row' ? `- ${x.text.replace(/ \| /g, ' · ')}` : x.text)).join('\n\n').replace(/\n\n- /g, '\n- '),
    source: { file: g.file, pages: [g.page] },
  }));
}
