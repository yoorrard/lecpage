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
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * 강사 확인이 필요한 주소(skip: 교재에서 찾은 회의·중계·설문 주소)를 글자로만 남김.
 * 글 칸·표 칸은 글 속 https:// 주소를 눌러 가는 링크로 그리므로(render/markdown.js) `…`(코드)로 감싸 링크가 되지 않게 함.
 * 강사가 1단계에서 확인하면 그 주소는 입장 단추·설문 칸으로 실림(보안 검토 2026-11b)
 */
export function keepUrlText(text, skip) {
  const urls = [...(skip || [])].filter((x) => typeof x === 'string' && /^https?:\/\//i.test(x)).sort((a, b) => b.length - a.length);
  if (!urls.length || !text) return text;
  const s = String(text);
  if (!urls.some((x) => s.includes(x))) return s;
  // 그 주소로 시작하는 글자 덩어리를 통째로(뒤의 문장부호는 밖에 둠)
  return s.replace(new RegExp(`(${urls.map(reEsc).join('|')})([^\\s<>"'）)\`]*)`, 'g'), (m, url, rest) => {
    let end = rest.length;
    while (end > 0 && '.,!?:;'.includes(rest[end - 1])) end--;
    return `\`${url}${rest.slice(0, end)}\`${rest.slice(end)}`;
  });
}
/**
 * 절의 문단·표 → 글 칸의 마크다운. 번호·머리표 문단은 목록, 글상자는 강조 상자(예시문은 복사 버튼), 각주는 ※ 줄.
 * 링크는 표시 글자를 눌러 가게 바꿈. skip에 든 주소(강사 확인이 필요한 중계·설문 주소)는 글자만 둠(keepUrlText)
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
  return keepUrlText(out.join('\n\n').trim(), skip);
}

/**
 * 묶음 → 본문 칸 목록(교재 순서).
 * @returns {{ entries: Array<{slot:string,page:number,file:string}|{section:object,page:number,file:string,doc:boolean}>, prep: string[] }}
 */
export function composeBody(material, d, { skipUrls = new Set() } = {}) {
  const units = classifyUnits(material, d);
  const entries = []; const seenSlot = new Set(); let prep = []; let lastDiscuss = null;
  const msgKeys = new Set((d.messages || []).map((m) => textKey(m.text)));
  const cells = (rows) => rows.map((r) => r.map((x) => keepUrlText(x, skipUrls))); // 표 칸도 글 칸처럼 주소를 링크로 그림
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
    else if (c.kind === 'facts') push(c, { type: 'table', title: c.title, head: [], rows: cells(c.rows), _facts: true });
    else if (c.kind === 'table') {
      const lines = (c.lines || []).filter(Boolean);
      if (lines.length > 1) push(c, { type: 'text', title: c.title, md: unitToMd(u, { skip: skipUrls }) });
      c.tables.forEach((t, i) => push(c, { type: 'table', title: i === 0 && lines.length <= 1 ? c.title : '', lead: i === 0 && lines.length === 1 ? truncate(lines[0], 300) : '', head: t.head, rows: cells(t.rows), _use: t.use }));
    } else if (c.kind === 'keypoints') push(c, { type: 'steps5', title: c.title, items: c.items.map((i) => ({ word: truncate(i.word, 20), desc: truncate(i.desc, 120) })), close: c.close || '' });
    else if (c.kind === 'text') { const md = unitToMd(u, { skip: skipUrls }); if (md) push(c, { type: 'text', title: c.title, md: truncate(md, 6000) }); }
    // 절차·사례·질문 절에 함께 있던 표도 버리지 않고 바로 뒤에 표 칸으로
    if (c.kind !== 'table') for (const t of (u.tables || []).map(tableData).filter(Boolean)) push(c, { type: 'table', title: '', head: t.head, rows: cells(t.rows), _use: t.use });
  }
  return { entries, prep };
}

// ── 교재에 있는데 싣지 못한 것 ─────────────────────────────
const META_LABEL = /^(?:일\s*시|날\s*짜|기\s*간|일\s*자|시\s*간|장\s*소|강\s*사|발\s*표\s*자|연\s*사|주\s*최|주\s*관|문\s*의(?:처)?|연락처|대\s*상|참\s*석|참\s*가|인\s*원)$/;
const words = (t) => normLine(t).split(/[\s|·,/()[\]:：]+/).map(textKey).filter((w) => w.length >= 2);
// “…”라고 입력하는 문장: 따옴표 속 글이 프롬프트이고, 앞뒤는 '입력해 보세요' 같은 안내(ingest/detect.js 따옴표 프롬프트와 같은 단서)
const QUOTED = /[“"「『‘]([^“”"「」『』‘’\n]{6,400}?)[”"」』’]/g;
const ASK_NEAR = /(입력|물어|질문|요청|프롬프트|검색|말해|타이핑|명령|쳐|적어)/;
/**
 * 교재 반영을 셀 '보이는 칸': 숨기지 않은 칸 가운데 교재 보기(deck)를 뺀 것.
 * 교재 보기는 쪽마다 교재 글 전체를 담고 있어 넣으면 무엇이든 실린 것이 됨. make의 반영 점검과 structure --add-leftovers가 같은 기준을 씀
 */
export const coverSections = (bp) => (bp?.sections || []).filter((s) => s && !s.hidden && s.type !== 'deck');
/** 강사 확인 전이라 싣지 않은 접속·설문 주소와 그 링크 글(교재 반영에서 세지 않음) */
function heldOf(material) {
  const d = material?.detected || {};
  const urls = [...(d.addresses?.join || []), ...(d.addresses?.survey || [])].map((a) => a.url).filter(Boolean);
  const labels = new Set((material?.pages || []).flatMap((p) => p.links || []).filter((l) => urls.includes(l.url) && l.label).map((l) => textKey(l.label)));
  return { urls, labels };
}
/** 값 속 글자를 모두 이어 붙임(JSON 문자열로 바꾸면 따옴표 앞에 역빗금이 붙어 교재 글과 맞춰 보기 어려움) */
function stringsOf(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) for (const x of v) stringsOf(x, out);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) stringsOf(x, out);
  return out.join('\n');
}

/**
 * 교재의 문단·표 줄 가운데 설계도의 보이는 칸(coverSections: 교재 보기 제외)에 없는 것.
 * 고쳐 쓴 문장도 찾도록 낱말이 60% 넘게 겹치면 실린 것으로 봄. 표지의 일시·장소·강사 줄은 연수 정보가 있으면 실린 것.
 * “…”라고 입력하는 문장은 따옴표 속 글이 사이트에 있으면(프롬프트 칸) 실린 것. 강사 확인 전 접속·설문 주소의 링크 글은 세지 않음.
 * @returns {{ count:number, total:number, items:Array<{file,page,title,text,kind}> }}
 */
export function findLeftovers(material, bp, { max = 20, ignore = null } = {}) {
  if (!material?.pages?.length || !bp) return { count: 0, items: [] };
  const renderOnly = new Set((material.files || []).filter((f) => f.renderOf).map((f) => f.id));
  const boiler = new Set((material.boilerplate || []).map((b) => textKey(b.text)));
  const hay = textKey(stringsOf({ meta: bp.meta, instructors: bp.instructors, sections: coverSections(bp) }));
  const meta = bp.meta || {};
  const skip = [...heldOf(material).labels, ...(ignore || [])].filter((x) => x.length >= 4);
  const mostly = (t) => { const w = words(t); return w.length >= 2 && w.filter((x) => hay.includes(x)).length / w.length >= 0.6; };
  const has = (text) => {
    const k = textKey(text);
    if (k.length < 6 || boiler.has(k)) return true;
    if (skip.some((x) => k.includes(x))) return true; // 강사 확인 전이라 싣지 않은 주소의 링크 글
    if (hay.includes(k) || (k.length > 28 && (hay.includes(k.slice(0, 20)) || hay.includes(k.slice(-20))))) return true;
    const lab = splitLabel(normLine(text).replace(/^[-•·▪◦●○■□▶▷►※*]\s*/, ''));
    if (lab && META_LABEL.test(lab[0]) && (meta.date || meta.venue || (bp.instructors || []).length || meta.organizer || meta.contact)) return true;
    const quotes = [...String(text).matchAll(QUOTED)].map((m) => textKey(m[1])).filter((q) => q.length >= 6);
    if (quotes.length && quotes.every((q) => hay.includes(q))) {
      const rest = String(text).replace(QUOTED, ' ');
      if (ASK_NEAR.test(rest) && (textKey(rest).length <= 30 || mostly(rest))) return true;
    }
    return mostly(lab ? lab[1] : text);
  };
  const items = []; let count = 0, total = 0;
  for (const p of material.pages) {
    if (p.hidden || p.error || renderOnly.has(p.file)) continue;
    const add = (text, kind) => { total++; if (has(text)) return; count++; if (items.length < max) items.push({ file: p.file, page: p.page, title: cleanTitle(p.title), text: truncate(normLine(text), 160), kind }); };
    for (const x of p.paragraphs || []) if (x.text) add(x.text, 'para');
    for (const t of p.tables || []) for (const r of t.rows || []) { const row = r.filter(Boolean).join(' | '); if (row) add(row, 'row'); }
  }
  return { count, total, items };
}

/**
 * 교재 반영 점검: 교재에서 찾은 프롬프트·실습 단계·링크·질문답과 교재의 줄이 설계도의 보이는 칸에 들어갔는지 셉니다.
 * make·patch 요약의 한 줄로 씁니다. 에이전트가 교재와 사이트를 손으로 한 줄씩 대조하지 않게 하려는 것입니다.
 * @returns {{ prompts, steps, links, faq, lines: {total, missing, items}, missing: number }} 각 항목 { total, miss: [{page, text}] }
 */
export function materialCoverage(material, bp) {
  const d = material?.detected || {};
  // 교재 보기(deck)는 빼고 셈(coverSections): 사이트의 칸에 실렸는지를 봄. 교재 줄은 findLeftovers가 같은 기준으로
  const json = stringsOf({ meta: bp?.meta, instructors: bp?.instructors, sections: coverSections(bp) });
  const hay = textKey(json);
  const has = (t) => { const k = textKey(t); return k.length < 4 || hay.includes(k); };
  const page = (x) => x?.page || x?.pages?.[0] || x?.refs?.[0]?.page || 0;
  const tally = (list, ok, text) => { const miss = []; for (const x of list) if (!ok(x)) miss.push({ page: page(x), text: truncate(normLine(text(x)), 60) }); return { total: list.length, miss }; };
  // 프롬프트는 가장 긴 줄로 봄(교재에서 끝에 붙은 버튼 글 '제미나이 열기' 같은 짧은 줄은 사이트에서 빠져도 됨)
  const main = (t) => String(t || '').split('\n').sort((a, b) => b.length - a.length)[0] || '';
  const prompts = tally(d.prompts || [], (x) => has(main(x.text)), (x) => main(x.text));
  const stepItems = (d.steps || []).flatMap((s) => (s.items || []).map((t) => ({ text: typeof t === 'string' ? t : t?.text || '', page: s.page })));
  const steps = tally(stepItems, (x) => has(x.text), (x) => x.text);
  // 접속·설문 주소(addresses)는 강사가 확인한 뒤에만 싣는 것이라 세지 않음(held에 따로)
  const held = heldOf(material).urls;
  const links = tally((d.links || []).filter((l) => /^https?:/i.test(l.url || '') && !held.includes(l.url)),(l) => json.includes(l.url) || json.includes(l.url.replace(/\/$/, '')), (l) => l.url);
  const faq = tally(d.faq || [], (x) => has(x.q), (x) => x.q);
  const lo = findLeftovers(material, bp || {}, { max: 3 });
  const lines = { total: lo.total || 0, missing: lo.count, items: lo.items.map((x) => ({ page: x.page, text: truncate(x.text, 60) })) };
  return { prompts, steps, links, faq, lines, held: held.filter((u) => !json.includes(u)), missing:prompts.miss.length + steps.miss.length + links.miss.length + faq.miss.length + lines.missing };
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
