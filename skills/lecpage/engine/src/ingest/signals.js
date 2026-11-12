// 구성 신호: 교재에서 '무슨 칸이 맞는지' 알려 주는 것들(references/modules.md §1의 신호 표).
// 교재를 묶음(unit)으로 나누고(문서는 절, 슬라이드는 쪽), 묶음마다 쓰임(kind)을 정합니다. detect()가 끝에 부르고,
// 초안(compose.js)과 구성 결정(decide/structure.js)이 같은 결과를 씁니다. 지어내지 않고 교재의 글자만 옮깁니다.
import { normLine, truncate, textKey } from './util.js';

const LEAD = /^(?:[-•·▪◦●○■□▶▷►➢➤→⇒✓✔☞※*]\s*)+/;
const NUM = /^(?:\(?(\d{1,2})\s*[.)]\s*(?!\d)|([①-⑳])\s*|(?:step|단계)\s*\.?\s*(\d{1,2})\s*[.:)\-–]?\s*|(\d{1,2})\s*단계\s*[.:)\-–]?\s*)/i;
const KO_NUM = /^[가-하]\s*[.)]\s+/;
const HEAD_PREFIX = /^(?:\d{1,2}|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]|[가-하]|제\s*\d{1,2}\s*[장절부])\s*[.)]?\s+(?=\S)/;
const PDF_HEAD = /^(\d{1,2})\s*[.)]\s*(\S.{0,30})$/;
const SENT_END = /(?:니다|세요|어요|아요|해요|예요|에요|이다|한다|된다|있다|없다|이다)\.?$|[.:：?!]$/; // 문장으로 끝나는 줄(제목이 아님)
const QUESTION_END = /[?？]\s*["”’']?\s*$/;
const QA_Q = /^Q\s*\d*\s*[.:)]\s*\S/i;
const QA_A = /^A\s*\d*\s*[.:)]\s*\S/i;
const CASE_HEAD = /^\[?\s*(?:사례|case|에피소드|장면)\s*(\d{1,2}|[①-⑳])\s*[.:)\]]?\s*(.*)$/i;
const SESSION_HEAD = /^\s*(?:제\s*)?(\d{1,2})\s*(?:차시|회차|주차|일차)(?![가-힣])/;
const GOAL_TITLE = /^(?:오늘의\s*|이\s*연수의\s*)?(?:연수|학습|교육|수업)?\s*(?:목표|목적)(?:\s*및\s*내용)?$|^(?:이런\s*(?:것|걸)을?\s*배워요|오늘\s*배울\s*(?:것|내용)|이\s*연수를\s*마치면.*|기대\s*효과)$/;
const GLOSS_TITLE = /(용어|낱말|키워드|glossary|terms|알아\s*둘)/i;
const RULES_TITLE = /(?:토론|토의|나눔|모둠|대화)\s*(?:진행\s*)?(?:방법|규칙|약속|순서|안내)|진행\s*(?:방법|규칙)|그라운드\s*룰|함께\s*지킬/;
const DISCUSS_TITLE = /(?:나눌|나눔|토론|토의|이야기\s*나눌|생각해\s*볼|함께\s*생각할)\s*(?:질문|거리|주제)|질문\s*(?:목록|카드)/;
const REFLECT_TITLE = /(성찰|일지|돌아보기|되돌아보기|회고|나의\s*(?:다짐|기록)|마음\s*기록)/;
const REFLECT_LINE = /(?:적어|써|떠올려|정리해|기록해|돌아|그려)\s*(?:보세요|봅시다|볼까요|보기)\.?$/;
const PREP_TITLE = /^(?:준비물|사전\s*준비|준비\s*사항|미리\s*준비(?:할\s*것|해\s*주세요)?|챙길\s*것)$/;
const INFO_TITLE = /(오시는\s*길|찾아오시는|주차|교통편|유의\s*사항|안내\s*사항|참가\s*안내|질문하는\s*(?:방법|법)|당부)/;
const ADMIN_TITLE = /(과제|이수|수료|출석)/;
const MORE_TITLE = /(참고\s*(?:자료|문헌|사이트|링크)|더\s*(?:알아보기|살펴보기|읽을거리)|추천\s*(?:자료|도서|사이트)|함께\s*보면|읽을거리|resources?|references?|further\s*reading)/i;
const PROFILE_MULTI = /(발표자|연사|강사진|강연자|패널|토론자|발제자)/;
const ROLE_END = /^(.*?)\s*((?:수석)?교사|장학사|장학관|연구사|연구관|교감|교장|교수|박사|강사|대표|팀장|과장|원장|소장|위원|선생님)$/;
const NAME_LINE = /^[가-힣]{2,4}$/;
const NAME_STOP = new Set(['소개', '약력', '경력', '강사', '발표자', '프로필', '연락처', '이메일', '저서', '학력', '활동', '수상', '감사', '안녕', '오늘', '연수', '실습', '휴식', '점심', '등록', '개회', '폐회', '질의응답', '발표', '안내']);
const LABEL_LINE = /^([^\s:：][^:：]{0,23}?)\s*[:：]\s*(\S.*)$/;
const NOTE_CUE = /(막히면|막힐|안\s*(?:되|된|될|열리|보이|나오|뜨)|오류|에러|실패|주의|유의|않도록|말\s*것|반드시)/;
const UNIT = '(?:분|시간|일|주|개월|년|회|번|명|개|가지|%|퍼센트|자|쪽|점|배|대|건|차시|학점)';
const FIG = new RegExp(`((?:약|최대|최소|연간\\s*최대|총|평균|하한|상한)\\s*)?(\\d[\\d,.]*)\\s*(${UNIT})(\\s*(?:이내|이상|이하|미만|초과|안에|까지|마다|감축|증가|확대|축소))?`);
const SHIFT = new RegExp(`(\\d[\\d,.]*\\s*${UNIT})에서\\s*(\\d[\\d,.]*\\s*${UNIT})(?:으로|로)`);
const TABLE_USE = [['criteria', /기준|조치|판단|단계별|수준/], ['roles', /역할|담당|할\s*일|업무|분담/], ['timeline', /학년도|시기|일정|날짜|기간|적용|월$/], ['compare', /비교|전|후|차이|구분/]];

const key = (f, p) => `${f}:${p}`;
const clean = (t) => normLine(t).replace(LEAD, '').trim();
/** 절 제목 앞의 번호("Ⅱ. ", "3. ", "가. ")를 뗌 */
export const cleanTitle = (t) => normLine(t || '').replace(HEAD_PREFIX, '').replace(/^(?:실습|활동|미션)\s*\d{1,2}\s*\((?:계속|이어서)\)\s*/, '').trim();
/** "이름: 설명" → [이름, 설명]. 이름이 길면(12자 넘음) 나누지 않음 */
export function splitLabel(t, max = 12) {
  const m = LABEL_LINE.exec(t);
  return m && m[1].length <= max && !/https?$/.test(m[1]) && !/^\d{1,2}$/.test(m[1]) ? [m[1].trim(), m[2].trim()] : null;
}
const stripNum = (t) => clean(t).replace(NUM, '').replace(KO_NUM, '').trim();
const isNumbered = (x) => !!x.num || NUM.test(clean(x.text));
const sentences = (t) => String(t).split(/(?<=[다요음함됨]\.)\s+|(?<=[.!?])\s+(?=[가-힣A-Z"“])/).map((s) => s.trim()).filter(Boolean);

/**
 * 문서형 교재의 절(블록). HWPX·DOCX·MD·TXT는 제목으로 나눈 부분이 곧 절이고,
 * 글이 빽빽한 PDF(쪽마다 10줄 넘고 "1. 제목" 줄이 둘 이상)는 그 제목 줄로 쪽을 넘어가며 나눔.
 * @returns {Array<{file,page,pages,title,paras,tables,links,doc:true,cover?:boolean}>}
 */
export function docBlocks(material) {
  const files = (material.files || []).filter((f) => !f.renderOf && f.type !== 'link');
  const out = [];
  for (const f of files) {
    const pages = (material.pages || []).filter((p) => p.file === f.id && !p.hidden && !p.error);
    if (!pages.length) continue;
    const first = out.length === 0;
    if (f.unit === 'section' || pages.every((p) => p.kind === 'section')) {
      pages.forEach((p, i) => out.push({ file: f.id, page: p.page, pages: [p.page], title: p.title || '', paras: p.paragraphs || [], tables: p.tables || [], links: p.links || [], doc: true, cover: first && i === 0 && isCover(p.paragraphs || [], p.tables || []) }));
    } else if (f.type === 'pdf') {
      const heads = pdfHeads(pages);
      if (heads.size < 2 || pages.reduce((n, p) => n + (p.paragraphs || []).length, 0) / pages.length < 10) continue;
      let cur = { file: f.id, page: pages[0].page, pages: [pages[0].page], title: pages[0].title || '', paras: [], tables: [], links: [], doc: true, cover: first };
      out.push(cur);
      for (const p of pages) {
        if (heads.has(`${p.page}:title`)) { cur = { file: f.id, page: p.page, pages: [p.page], title: normLine(p.title), paras: [], tables: [], links: [], doc: true }; out.push(cur); }
        (p.paragraphs || []).forEach((x, i) => {
          if (heads.has(`${p.page}:${i}`)) { cur = { file: f.id, page: p.page, pages: [p.page], title: normLine(x.text), paras: [], tables: [], links: [], doc: true }; out.push(cur); return; }
          if (!cur.pages.includes(p.page)) cur.pages.push(p.page);
          cur.paras.push(x);
          for (const t of p.tables || []) if (t.at === i + 1 && !cur.tables.includes(t)) cur.tables.push(t);
        });
        for (const l of p.links || []) cur.links.push(l);
      }
    }
  }
  return out;
}
function isCover(paras, tables) {
  if (tables.length) return false;
  const long = paras.filter((x) => { const t = clean(x.text); return t.length > 40 && !splitLabel(t); });
  return paras.length <= 8 && !long.length;
}
/** PDF의 절 제목 줄: "1. 과정 개요"처럼 짧고, 번호가 1부터 이어지며, 문장으로 끝나지 않는 줄 */
function pdfHeads(pages) {
  const heads = new Set(); let want = 1;
  const isHead = (text, level) => { const m = PDF_HEAD.exec(normLine(text)); return !!m && !level && !SENT_END.test(m[2]) && +m[1] === want; };
  pages.forEach((p, n) => {
    if (n > 0 && isHead(p.title || '', 0)) { heads.add(`${p.page}:title`); want++; } // 쪽 맨 위에 온 절 제목은 쪽 제목으로 읽혀 있음
    (p.paragraphs || []).forEach((x, i) => { if (isHead(x.text, x.level || 0)) { heads.add(`${p.page}:${i}`); want++; } });
  });
  return heads;
}

/** 수치 문장 → { value, label, note, score } | null. 값은 교재의 숫자 그대로, 이름은 숫자 앞의 말 */
export function figureOf(text, fallbackLabel = '') {
  const t = clean(text);
  if (t.length < 6 || t.length > 140) return null;
  const tight = (v) => v.replace(/\s+/g, ' ').replace(/(\d)\s+(?=[가-힣%])/g, '$1').trim();
  let best = null;
  const sh = SHIFT.exec(t);
  if (sh) best = { value: `${tight(sh[1])} → ${tight(sh[2])}`, score: 3, index: sh.index };
  else {
    const re = new RegExp(FIG.source, 'g'); let m;
    while ((m = re.exec(t))) {
      const pre = (m[1] || '').trim(); const post = (m[4] || '').trim();
      if (!pre && !post && m[3] !== '%' && m[3] !== '퍼센트') continue;
      const score = (post ? 2 : 0) + (/%|퍼센트/.test(m[3]) ? 2 : 0) + (pre ? 1 : 0);
      if (!best || score > best.score) best = { value: tight(m[0]).replace(/^연간\s*/, ''), score, index: m.index };
    }
  }
  if (!best) return null;
  const lab = splitLabel(t, 20);
  let label = lab ? lab[0] : t.slice(0, best.index);
  if (!lab) {
    const topic = /^(.{2,24}?)(?:은|는)\s/.exec(label);
    label = (topic ? topic[1] : label).replace(/[\s,·(]+$/, '').replace(/(?:이|가|을|를|의|에|도|에서|으로|로)$/, (j) => (label.length - j.length >= 2 ? '' : j)).trim();
  }
  if (label.length > 24 || label.length < 2) label = fallbackLabel;
  return { value: truncate(best.value, 20), label: truncate(label, 40), note: truncate(t, 80), score: best.score };
}

/** 번호 단계 한 줄 → { title, desc, time } */
export function stepItem(text) {
  const t = stripNum(text);
  const lab = splitLabel(t.split('\n')[0], 24);
  const [title, desc] = lab ? [lab[0], [lab[1], ...t.split('\n').slice(1)].join('\n')] : [t.split('\n')[0], t.split('\n').slice(1).join('\n')];
  const times = t.match(/\d+\s*(?:분|시간|일)\s*(?:이내|안에|까지)/g) || [];
  return { title: truncate(title, 160), desc: truncate(desc, 500), time: times.length === 1 ? times[0].replace(/\s+/g, ' ').replace(/(\d)\s+(분|시간|일)/, '$1$2') : '', who: '' };
}

/**
 * 묶음 하나의 쓰임.
 * 자리 칸(slot): goals·faq·glossary·sessions·stations·followup — 이미 있는 감지 결과로 한 칸에 모으는 것
 * 본문 칸: procedure·cases·discuss(+rules)·reflection·table·facts·figures·keypoints·text
 * 그 밖: cover(표지: 연수 정보로 감) · prep(준비물 → 준비 점검) · deck(슬라이드: 교재 보기에만)
 */
export function classifyUnit(u, d, prev) {
  const title = cleanTitle(u.title);
  const paras = (u.paras || []).filter((x) => x.text && normLine(x.text));
  const lines = paras.map((x) => clean(x.text));
  const practice = new Set((d.practice?.pages || []).map((r) => key(r.file, r.page)));
  const onPage = (list) => (list || []).some((x) => x.file === u.file && (u.pages || [u.page]).some((pg) => (x.pages || [x.page]).includes(pg)));
  if (u.cover) return { kind: 'cover' };
  if (GOAL_TITLE.test(title)) return { kind: 'goals', slot: 'goals' };
  if ((u.pages || [u.page]).some((pg) => practice.has(key(u.file, pg)))) return { kind: 'stations', slot: 'stations' };
  const qn = lines.filter((t) => QA_Q.test(t)).length;
  if (qn >= 1 && lines.filter((t) => QA_A.test(t)).length >= 1 && onPage(d.faq)) return { kind: 'faq', slot: 'faq' };
  if (GLOSS_TITLE.test(title) && onPage(d.glossary) && (d.glossary || []).length >= 2) return { kind: 'glossary', slot: 'glossary' };
  if (onPage(d.quiz) && (d.quiz || []).some((q) => q.answer >= 0)) return { kind: 'quiz', slot: 'quiz' };
  const sessN = lines.filter((t) => SESSION_HEAD.test(t)).length + (u.tables || []).reduce((n, t) => n + t.rows.filter((r) => SESSION_HEAD.test(String(r[0] || ''))).length, 0);
  if (sessN >= 2 && (d.sessions || []).length >= 2) return { kind: 'sessions', slot: 'sessions' };
  // 문서의 진행 순서 절(시각 줄이 대부분)과 발표자 소개 절: 일정·발표자 칸이 그 자리에 섬(같은 글을 글 칸으로 되풀이하지 않음)
  const onUnit = (x) => !!x && x.file === u.file && (u.pages || [u.page]).includes(x.page);
  const timed = (d.agenda?.items || []).filter((it) => it.start).length;
  if (u.doc && onUnit(d.agenda) && timed >= 2 && timed >= lines.length * 0.6) return { kind: 'schedule', slot: 'schedule' };
  if (u.doc && PROFILE_MULTI.test(title) && (d.speakers || []).filter(onUnit).length >= 2) return { kind: 'speakers', slot: 'speakers' };
  if (!u.doc && PREP_TITLE.test(title) && lines.length) return { kind: 'prep', items: lines.slice(0, 8).map((t) => truncate(t, 120)) };
  if (MORE_TITLE.test(title) && (u.links || []).length) return { kind: 'more', slot: 'followup' };

  // 사례 묶음: "사례 1. 제목" 줄이 둘 이상
  const caseAt = paras.map((x, i) => (CASE_HEAD.test(clean(x.text)) ? i : -1)).filter((i) => i >= 0);
  if (caseAt.length >= 2) {
    const items = caseAt.map((at, n) => {
      const m = CASE_HEAD.exec(clean(paras[at].text));
      const body = []; let quote = '';
      for (const x of paras.slice(at + 1, caseAt[n + 1] ?? paras.length)) {
        const t = normLine(x.text);
        if (!quote && /^[“"‘「].{4,}[”"’」]$/.test(t)) quote = t.replace(/^[“"‘「]|[”"’」]$/g, ''); else body.push(t);
      }
      return { title: truncate(m[2] || `사례 ${m[1]}`, 100), body: truncate(body.join('\n'), 1200), quote: truncate(quote, 300), cite: '' };
    });
    return { kind: 'cases', title, items, lead: paras.slice(0, caseAt[0]).map((x) => normLine(x.text)).join(' ') };
  }
  // 질문 목록: 물음표로 끝나는 줄이 셋 이상(제목이 질문·토론이면 둘 이상)
  const qs = lines.map(stripNum).filter((t) => QUESTION_END.test(t) && !QA_Q.test(t));
  if (qs.length >= (DISCUSS_TITLE.test(title) ? 2 : 3) && qs.length >= lines.length * 0.6 && !REFLECT_TITLE.test(title)) {
    return { kind: 'discuss', title, items: qs.slice(0, 12).map((t) => truncate(t, 240)), note: lines.map(stripNum).filter((t) => !QUESTION_END.test(t)).slice(0, 2).join(' ') };
  }
  if (RULES_TITLE.test(title) && lines.length && lines.length <= 8 && prev?.kind === 'discuss') return { kind: 'rules', items: lines.map(stripNum).map((t) => truncate(t, 200)) };
  // 성찰 질문: 제목이 성찰·일지이거나 "~적어 보세요" 줄이 둘 이상
  const refl = lines.filter((t) => REFLECT_LINE.test(t)).length;
  if ((REFLECT_TITLE.test(title) && lines.length) || refl >= 2) {
    const prompts = paras.filter((x) => x.role !== 'text').map((x) => stripNum(x.text)).filter((t) => t.length >= 4 && t.length <= 200);
    const extra = paras.filter((x) => x.role === 'text').map((x) => normLine(x.text));
    if (prompts.length) return { kind: 'reflection', title, prompts: prompts.slice(0, 8), extra };
  }
  // 절차: 번호 문단이 셋 이상(실습 쪽이 아님)
  const numbered = paras.filter(isNumbered);
  if (numbered.length >= 3 && !numbered.every((x) => stripNum(x.text).length <= 6)) {
    const rest = paras.filter((x) => !isNumbered(x)).map((x) => normLine(x.text));
    return { kind: 'procedure', title, items: numbered.slice(0, 20).map((x) => stepItem(x.text)), rest };
  }
  if (ADMIN_TITLE.test(title) && u.doc && lines.some((t) => /과제|제출|이수|결석|출석|나이스/.test(t))) return { kind: 'admin', slot: 'followup' };
  // 수치 쪽: 모든 줄이 수치 문장(둘 이상). 일부만 수치면 본문 쪽으로 둠
  if (lines.length >= 2 && lines.length <= 6 && !(u.tables || []).length) {
    const figs = lines.map((t) => figureOf(t)).filter(Boolean);
    if (figs.length >= 2 && figs.length === lines.length && figs.every((f) => f.label)) return { kind: 'figures', title, items: figs };
  }
  // 이름표 줄 묶음("기간: …" 셋 이상): 두 칸 표
  const labeled = lines.map((t) => splitLabel(t)).filter(Boolean);
  if (u.doc && labeled.length >= 3 && labeled.length >= lines.length * 0.6 && !(u.tables || []).length) return { kind: 'facts', title, rows: labeled };
  // 표
  const tables = (u.tables || []).map((t) => tableData(t)).filter(Boolean);
  if (tables.length && !(d.agenda && d.agenda.file === u.file && d.agenda.page === u.page)) return { kind: 'table', title, tables, lines: paras.map((x) => normLine(x.text)) };
  if (u.doc) return { kind: 'text', title };
  // 슬라이드: 낱말 묶음(짧은 이름 + 설명이 번갈아 셋 이상) → 핵심 단계
  const pairs = keyPairs(lines);
  if (pairs) return { kind: 'keypoints', title, ...pairs };
  if (INFO_TITLE.test(title) && lines.length >= 2) return { kind: 'text', title };
  return { kind: 'deck' };
}

function keyPairs(lines) {
  if (lines.length < 6 || lines.length > 17) return null;
  const n = Math.floor(lines.length / 2); const items = [];
  for (let i = 0; i < n; i++) {
    const w = lines[2 * i], dsc = lines[2 * i + 1];
    if (w.length > 10 || /[.!?:：]$/.test(w) || dsc.length < 4 || dsc.length > 60 || /[다요]\.$/.test(w)) return null;
    items.push({ word: w, desc: dsc });
  }
  if (items.length < 3 || items.length > 8) return null;
  return { items, close: lines.length % 2 ? truncate(lines[lines.length - 1], 200) : '' };
}

/** 표 → { head, rows, use }. 첫 줄이 짧은 낱말이면 머리글. 칸 안의 " | "(표 속 표)는 가운뎃점으로 */
export function tableData(t) {
  const rows = (t?.rows || []).map((r) => r.map((c) => String(c ?? '').replace(/ \| /g, ' · ').trim())).filter((r) => r.some(Boolean));
  const cols = Math.max(0, ...rows.map((r) => r.length));
  if (rows.length < 2 || cols < 2) return null;
  const first = rows[0];
  const hasHead = first.filter(Boolean).length >= Math.min(2, cols) && first.every((c) => c.length <= 14 && !/[다요]\.$/.test(c));
  const head = hasHead ? first : [];
  const use = (TABLE_USE.find(([, re]) => head.some((c) => re.test(c))) || ['data'])[0];
  return { head, rows: hasHead ? rows.slice(1) : rows, use };
}

/** 교재를 묶음으로: 문서는 절, 그 밖(슬라이드·슬라이드 PDF)은 쪽. 순서는 교재 순서 */
export function materialUnits(material) {
  const blocks = docBlocks(material);
  const docFiles = new Set(blocks.map((b) => b.file));
  const renderOnly = new Set((material.files || []).filter((f) => f.renderOf).map((f) => f.id));
  const order = new Map((material.files || []).map((f, i) => [f.id, i]));
  const firstFile = (material.files || []).find((f) => !f.renderOf && f.type !== 'link')?.id;
  const slides = (material.pages || []).filter((p) => !p.hidden && !p.error && !renderOnly.has(p.file) && !docFiles.has(p.file))
    .map((p, i) => ({ file: p.file, page: p.page, pages: [p.page], title: p.title || '', paras: p.paragraphs || [], tables: p.tables || [], links: p.links || [], notes: p.notes || '', doc: false, cover: p.file === firstFile && i === 0 }));
  return [...blocks, ...slides].sort((a, b) => (order.get(a.file) ?? 0) - (order.get(b.file) ?? 0) || a.page - b.page);
}

/** 묶음과 쓰임 목록 [{ unit, kind, … }] */
export function classifyUnits(material, d) {
  const out = []; let prev = null;
  for (const u of materialUnits(material)) { const c = classifyUnit(u, d, prev); out.push({ unit: u, ...c }); if (c.kind !== 'deck') prev = c; }
  return out;
}

/** 발표자 여럿: 발표자 소개 쪽(이름 줄 + 소속·직함 줄)과 일정표의 "이름 직함" 칸 */
function detectSpeakers(pages, d) {
  const map = new Map();
  const put = (name, patch, p) => { const e = map.get(name) || { name, role: '', org: '', note: '', talk: '', time: '', file: p.file, page: p.page }; for (const [k, v] of Object.entries(patch)) if (v && !e[k]) e[k] = v; map.set(name, e); };
  for (const p of pages) {
    const lines = (p.paragraphs || []).map((x) => clean(x.text)).filter(Boolean);
    const names = lines.filter((t) => NAME_LINE.test(t) && !NAME_STOP.has(t));
    if (PROFILE_MULTI.test(p.title || '') && names.length >= 2) {
      let cur = null;
      for (const t of lines) {
        if (NAME_LINE.test(t) && !NAME_STOP.has(t)) { cur = t; put(cur, {}, p); continue; }
        if (!cur) continue;
        const e = map.get(cur); const m = ROLE_END.exec(t);
        if (m && !e.org && (!e.role || e.role === m[2])) { e.org = m[1].trim(); e.role = m[2]; } else e.note = e.note ? `${e.note} · ${t}` : t;
      }
    }
    // 일정표의 사람 칸: "윤가온 장학사"
    for (const tb of p.tables || []) for (const r of tb.rows || []) {
      const who = r.map((c) => /^([가-힣]{2,4})\s+((?:수석)?교사|장학사|장학관|연구사|연구관|교감|교장|교수|박사|강사|대표|팀장|과장|원장|소장|위원)$/.exec(String(c || '').trim())).find(Boolean);
      if (!who || NAME_STOP.has(who[1])) continue;
      const cells = r.map((c) => String(c || '').trim());
      const time = /(\d{1,2}:\d{2})/.exec(cells.join(' '));
      const talk = cells.filter((c) => c && c !== who[0] && !/\d{1,2}:\d{2}/.test(c)).sort((a, b) => b.length - a.length)[0] || '';
      put(who[1], { role: who[2], talk: truncate(talk, 120), time: time ? time[1] : '' }, p);
    }
  }
  const list = [...map.values()].filter((e) => e.role || e.org || e.talk);
  return list.length >= 2 ? list.sort((a, b) => (a.time || '99').localeCompare(b.time || '99')).map((e) => ({ ...e, note: truncate(e.note, 60) })) : [];
}

/** 연수 행정: 직무연수·이수 기준·연수 시간·과제 */
function detectAdmin(pages, title) {
  const out = { official: /직무\s*연수|자격\s*연수/.test(title || ''), completionRate: 0, hours: 0, hoursText: '', rateText: '', completion: [], assignment: [] };
  for (const p of pages) for (const x of p.paragraphs || []) {
    const t = clean(x.text); if (!t || t.length > 140 || QA_Q.test(t) || QA_A.test(t)) continue;
    const lab = splitLabel(t);
    if (/직무\s*연수|이수\s*(?:기준|시간|처리|결과)/.test(t)) out.official = true;
    const rate = /출석(?:률)?\s*(\d{2,3})\s*%/.exec(t);
    if (rate && !out.completionRate && +rate[1] <= 100) { out.completionRate = +rate[1]; out.rateText = lab ? lab[1] : t; }
    const hrs = /^(?:총\s*)?(?:연수|이수|교육)\s*시간\s*[:：]?\s*(\d{1,3})\s*시간/.exec(t);
    if (hrs && !out.hours) { out.hours = +hrs[1]; out.hoursText = lab ? lab[1] : t; }
    if (lab && /^(?:과제|제출\s*기한|제출처|제출\s*방법|과제\s*제출)$/.test(lab[0])) { if (!SESSION_HEAD.test(t) && out.assignment.length < 4 && !isSessionDetail(p, x)) out.assignment.push(t); }
    else if (/이수\s*(?:결과|처리|인정)|나이스|결석/.test(t) && !lab && !PDF_HEAD.test(t) && out.completion.length < 4) out.completion.push(t);
  }
  const m = /\((\d{1,3})\s*시간\)/.exec(title || '');
  if (!out.hours && m) out.hours = +m[1];
  return out.official || out.completionRate || out.hours || out.completion.length || out.assignment.length ? out : null;
}
/** 차시 줄 바로 아래 묶음에 있는 "과제: …"는 그 차시의 것(연수 전체 과제가 아님) */
function isSessionDetail(p, x) {
  const list = p.paragraphs || []; const i = list.indexOf(x);
  for (let k = i - 1; k >= 0 && k >= i - 6; k--) {
    const t = clean(list[k].text);
    if (SESSION_HEAD.test(t)) return true;
    if (PDF_HEAD.test(t) && !SENT_END.test(t)) return false;
  }
  return false;
}

/** 교재에서 찾은 주소(강사가 확인해야 실림): 중계·회의 주소, 설문 주소 */
function detectAddresses(pages, d) {
  const byPage = new Map(pages.map((p) => [key(p.file, p.page), p]));
  const ctx = (l) => {
    const p = byPage.get(key(l.file, (l.pages || [])[0])); if (!p) return '';
    const hit = (p.paragraphs || []).map((x) => x.text).find((t) => (l.label && t.includes(l.label)) || t.includes(l.url)) || '';
    return `${p.title || ''} ${hit}`;
  };
  const one = (l, why) => ({ url: l.url, label: l.label || '', page: (l.pages || [])[0] || 0, file: l.file, why });
  const join = [], survey = [];
  for (const l of d.links || []) {
    if (l.kind === 'meeting') join.push(one(l, '회의 주소'));
    else if (l.kind === 'video' && (/\/live\b|\/live\//.test(l.url) || /중계|실시간|라이브|스트리밍|live/i.test(ctx(l)))) join.push(one(l, '중계 주소'));
    else if (l.kind === 'form') survey.push(one(l, '설문 주소'));
  }
  return { join: join.slice(0, 3), survey: survey.slice(0, 3) };
}

/**
 * 교재에서 찾은 것을 교재의 성격에 맞게 짧은 낱말들로(앱 1단계·CLI 요약). 있는 것만, 많아야 n개.
 * 예: ['절차 5단계', '표 2개', '수치 4개'] · ['사례 3개', '질문 6개', '성찰 질문 3개'] · ['차시 5개', '질문과 답 3개']
 * @param {object} d material.detected
 */
export function foundSummary(d = {}, n = 6) {
  const sg = d.signals || {};
  const out = [];
  const add = (count, text) => { if (count > 0) out.push(text); };
  add(d.practice?.count, `실습 ${d.practice?.count}쪽`);
  add((d.prompts || []).length, `프롬프트 ${(d.prompts || []).length}개`);
  add(sg.sessions, `차시 ${sg.sessions}개`);
  add(sg.speakers, `발표자 ${sg.speakers}명`);
  add((d.agenda?.items || []).filter((x) => x.start).length >= 2 ? 1 : 0, `일정 ${(d.agenda?.items || []).filter((x) => x.start).length}줄`);
  add(sg.procedure, `절차 ${sg.procedure}단계`);
  add(sg.cases, `사례 ${sg.cases}개`);
  add(sg.questions, `질문 ${sg.questions}개`);
  add(sg.reflection, `성찰 질문 ${sg.reflection}개`);
  add(sg.tables, `표 ${sg.tables}개`);
  add(sg.figures, `수치 ${sg.figures}개`);
  add((d.faq || []).length, `질문과 답 ${(d.faq || []).length}개`);
  add((d.glossary || []).length >= 2 ? d.glossary.length : 0, `용어 ${(d.glossary || []).length}개`);
  add((d.quiz || []).filter((q) => q.answer >= 0).length, `퀴즈 ${(d.quiz || []).filter((q) => q.answer >= 0).length}개`);
  add((d.tools || []).length, `도구 ${(d.tools || []).length}개`);
  return out.slice(0, n);
}

/** 발표자 노트에서 '막히는 곳' 문장만(진행 메모는 싣지 않음) */
export function noteTips(notes) {
  return sentences(normLine(notes || '').replace(/^(?:막히면|막힐\s*때|안\s*되면|주의|tip|팁)\s*[:：]\s*/i, '막히면: '))
    .filter((s) => NOTE_CUE.test(s)).map((s) => s.replace(/^막히면:\s*/, '')).filter((s) => s.length >= 8 && s.length <= 160).slice(0, 2);
}

/**
 * detect()가 끝에 부름. 새 감지 값과 신호 요약을 돌려줌.
 * @param h { parseKoreanDates, parseTimeRange }
 */
export function detectSignals(material, pages, d, h = {}) {
  const speakers = detectSpeakers(pages, d);
  const units = classifyUnits(material, { ...d, speakers });
  const kinds = (k) => units.filter((u) => u.kind === k);
  const firstKey = pages[0] ? key(pages[0].file, pages[0].page) : '';
  const promptKeys = new Set((d.prompts || []).map((x) => textKey(x.text)));
  const practice = new Set((d.practice?.pages || []).map((r) => key(r.file, r.page)));
  const figPages = new Set(kinds('figures').map((u) => key(u.unit.file, u.unit.page)));
  // 흩어진 수치 문장(표지·실습·질문답·차시 줄·수치 쪽은 빼고), 점수 높은 것 넷까지
  const figures = [];
  const docFiles = new Set(units.filter((u) => u.unit.doc).map((u) => u.unit.file));
  for (const p of pages) {
    const k = key(p.file, p.page);
    if (k === firstKey || practice.has(k) || figPages.has(k) || !docFiles.has(p.file)) continue; // 슬라이드의 수치는 '수치 쪽'만 씀
    for (const x of p.paragraphs || []) {
      const line = clean(x.text);
      if (!line || QA_Q.test(line) || QA_A.test(line) || SESSION_HEAD.test(line) || promptKeys.has(textKey(line)) || CASE_HEAD.test(line) || QUESTION_END.test(line)) continue;
      for (const s of sentences(stripNum(line))) {
        if (h.parseKoreanDates?.(s).length || h.parseTimeRange?.(s)) continue;
        const f = figureOf(s, cleanTitle(p.title));
        if (f && f.score >= 2 && f.label && !figures.some((g) => g.value === f.value && g.label === f.label)) figures.push({ ...f, file: p.file, page: p.page });
      }
    }
  }
  const top = figures.slice().sort((a, b) => b.score - a.score).slice(0, 4);
  const admin = detectAdmin(pages, d.title);
  const addresses = detectAddresses(pages, d);
  const qaTime = (d.agenda?.items || []).some((it) => /질의\s*응답|Q\s*&\s*A|질문\s*(?:시간|과\s*답)/i.test(it.text || ''));
  const count = (k, f = (u) => 1) => kinds(k).reduce((n, u) => n + f(u), 0);
  const docUnits = units.filter((u) => u.unit.doc);
  const signals = {
    doc: docUnits.length > 0 && docUnits.length >= units.length / 2,
    blocks: docUnits.length,
    procedure: Math.max(0, ...kinds('procedure').map((u) => u.items.length)),
    tables: count('table', (u) => u.tables.length) + count('facts'),
    cases: count('cases', (u) => u.items.length),
    questions: count('discuss', (u) => u.items.length),
    reflection: count('reflection', (u) => u.prompts.length),
    figures: top.length + count('figures', (u) => u.items.length),
    keypoints: count('keypoints'),
    speakers: speakers.length,
    sessions: (d.sessions || []).length,
    official: !!admin?.official,
    qaTime,
  };
  return { figures: figures.filter((f) => top.includes(f)), speakers, admin, addresses, signals };
}
