// 교재 내용에서 연수 정보를 찾아내는 규칙(휴리스틱). AI 없이도 쓸 만한 설계도 초안을 만들기 위한 바탕입니다.
// 찾는 것: 프롬프트, 실습 단계, 링크, 도구, 부(Part)·차례, 퀴즈·질문, 용어, 핵심 문장, 강사 소개, 일시·장소, 실습 비율 → 유형 힌트
import { normText, normLine, textKey, findUrls, urlKey, hostOf, pageText, truncate } from './util.js';
import { matchToolsInText, toolForUrl, getTool, CATEGORIES } from './tools-db.js';
import { detectFonts } from './fonts.js';

const WD = '일월화수목금토';

// ── 날짜·시간 ─────────────────────────────────────────
function validYmd(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
function weekdayOf(y, m, d) { return WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; }
const pad = (n) => String(n).padStart(2, '0');

/** 한 줄에서 날짜 찾기 → [{date:'2026-11-04', weekday, weekdayOk, text, index, yearGiven}] */
export function parseKoreanDates(line, refYear = new Date().getFullYear()) {
  const s = String(line || '');
  const out = [];
  const spans = [];
  const free = (a, b) => !spans.some(([x, y]) => a < y && b > x);
  const WDP = '(?:\\s*\\(\\s*([월화수목금토일])(?:요일)?\\s*\\)|\\s*([월화수목금토일])요일)?';
  const push = (y, m, d, w, text, index, yearGiven) => {
    if (!validYmd(y, m, d)) return;
    const real = weekdayOf(y, m, d);
    out.push({ date: `${y}-${pad(m)}-${pad(d)}`, weekday: real, weekdayGiven: w || '', weekdayOk: w ? w === real : null, text: text.trim(), index, yearGiven });
    spans.push([index, index + text.length]);
  };
  // 2026. 11. 4.(수) · 2026-11-04 · 2026/11/4 · 2026년 11월 4일(수요일) · 26. 11. 4.(수)
  const re1 = new RegExp(`(?<![\\d.])((?:19|20)\\d{2}|\\d{2})\\s*(?:\\.|-|/|년)\\s*(\\d{1,2})\\s*(?:\\.|-|/|월)\\s*(\\d{1,2})(?!\\d)\\s*(?:일|\\.)?${WDP}`, 'g');
  let m;
  while ((m = re1.exec(s))) {
    let y = +m[1];
    const w = m[4] || m[5];
    const korean = /년/.test(m[0]);
    if (m[1].length === 2) { if (!(w || korean) || y < 15 || y > 60) continue; y += 2000; }
    if (y < 1990 || y > 2100) continue;
    if (/\d\s*\.\s*\d+\s*\.\s*\d+\s*\.\s*\d/.test(s.slice(m.index, m.index + m[0].length + 3)) && !w && !korean) continue; // 1.2.3.4 같은 번호
    push(y, +m[2], +m[3], w, m[0], m.index, true);
  }
  // 11월 4일(수)
  const re2 = new RegExp(`(?<![\\d.])(\\d{1,2})\\s*월\\s*(\\d{1,2})\\s*일${WDP}`, 'g');
  while ((m = re2.exec(s))) {
    if (!free(m.index, m.index + m[0].length)) continue;
    const w = m[3] || m[4];
    push(inferYear(+m[1], +m[2], w, refYear), +m[1], +m[2], w, m[0], m.index, false);
  }
  // 11. 4.(수) · 11/4(수) — 요일이 있을 때만
  const re3 = /(?<![\d.])(\d{1,2})\s*[./]\s*(\d{1,2})\s*\.?\s*\(\s*([월화수목금토일])(?:요일)?\s*\)/g;
  while ((m = re3.exec(s))) {
    if (!free(m.index, m.index + m[0].length)) continue;
    push(inferYear(+m[1], +m[2], m[3], refYear), +m[1], +m[2], m[3], m[0], m.index, false);
  }
  return out.sort((a, b) => a.index - b.index);
}
function inferYear(mo, d, w, refYear) {
  if (w) for (const y of [refYear, refYear + 1, refYear - 1]) if (validYmd(y, mo, d) && weekdayOf(y, mo, d) === w) return y;
  return refYear;
}

/** 시간 범위 찾기: 15:10~16:40 · 오후 3시 10분 ~ 4시 40분 · 14:00-16:00 → {start:'15:10', end:'16:40', text} */
export function parseTimeRange(line) {
  const s = String(line || '');
  const T = '(?:(오전|오후|AM|PM|am|pm|a\\.m\\.|p\\.m\\.)\\s*)?(\\d{1,2})\\s*(?::|시)\\s*(?:(\\d{2})\\s*분?|반)?';
  const re = new RegExp(`(?<![\\d:])${T}\\s*(?:~|〜|∼|-|–|—|부터|to)\\s*${T}(?:\\s*까지)?(?![\\d])`, 'i');
  const m = re.exec(s);
  if (m) {
    const half1 = /시\s*반/.test(m[0].split(/~|〜|∼|-|–|—|부터|to/i)[0] || '');
    const start = toHM(m[1], +m[2], m[3] !== undefined ? +m[3] : (half1 ? 30 : 0), null);
    const tail = m[0].slice(m[0].search(/~|〜|∼|-|–|—|부터|to/i) + 1);
    const half2 = /시\s*반/.test(tail);
    let end = toHM(m[4] || (m[1] && /오후|pm|p\.m\./i.test(m[1]) ? m[1] : null), +m[5], m[6] !== undefined ? +m[6] : (half2 ? 30 : 0), start);
    if (start && end && end.h * 60 + end.m <= start.h * 60 + start.m && end.h < 12) end = { h: end.h + 12, m: end.m };
    if (start && end && end.h < 24) return { start: hm(start), end: hm(end), text: m[0].trim(), index: m.index };
  }
  const one = new RegExp(`(?<![\\d:])${T.replace('(?::|시)', ':')}(?![\\d])`).exec(s);
  if (one && one[3] !== undefined) {
    const st = toHM(one[1], +one[2], +one[3], null);
    if (st) return { start: hm(st), end: '', text: one[0].trim(), index: one.index };
  }
  return null;
}
function toHM(mer, h, m, ref) {
  if (!(h >= 0 && h <= 24 && m >= 0 && m < 60)) return null;
  if (mer && /오후|pm|p\.m\./i.test(mer) && h < 12) h += 12;
  else if (mer && /오전|am|a\.m\./i.test(mer) && h === 12) h = 0;
  else if (!mer && h >= 1 && h <= 6 && !(ref && ref.h < 12)) h += 12; // 연수는 대개 오후: "3시~5시" → 15~17시
  else if (!mer && ref && ref.h >= 12 && h < 12 && h + 12 > ref.h) h += 12;
  return { h, m };
}
const hm = (t) => `${pad(t.h)}:${pad(t.m)}`;

// ── 공통 줄 목록 ───────────────────────────────────────
function linesOf(p, { withTitle = false, withTables = true } = {}) {
  const out = [];
  if (withTitle && p.title) out.push({ text: p.title, role: 'title', level: 0, block: 0 });
  for (const para of p.paragraphs || []) out.push(para);
  if (withTables) for (const t of p.tables || []) for (const r of t.rows || []) { const row = r.filter(Boolean).join(' | '); if (row) out.push({ text: row, role: 'table', level: 0, block: -1 }); }
  return out;
}
const ref = (p) => ({ file: p.file, page: p.page });
/** 여러 파일에서 모은 항목: refs(파일·쪽 전부)와 pages(첫 파일 안의 쪽) */
function addRef(e, file, page) {
  e.refs = e.refs || [];
  if (!e.refs.some((r) => r.file === file && r.page === page)) e.refs.push({ file, page });
  if (e.file === file && !e.pages.includes(page)) e.pages.push(page);
}

// ── 프롬프트 ──────────────────────────────────────────
const END = '[\\s.!?~"”’\'」』)]*$';
const REQ_STRONG = new RegExp(`(?:해\\s?줘|해\\s?줄래|줘|줄래|줘요|해\\s?봐|해\\s?볼래|해\\s?주라|하라|해라|써\\s?줘|알려\\s?줘|만들어\\s?줘|그려\\s?줘|짜\\s?줘|골라\\s?줘|바꿔\\s?줘|찾아\\s?줘|해\\s?줄\\s?수\\s?있어\\??)${END}`);
const REQ_POLITE = new RegExp(`(?:주세요|주십시오|주실래요|주시겠어요|줄\\s?수\\s?있나요|해\\s?주실\\s?수\\s?있나요)${END}`);
const AI_CUE = /(너는|당신은|넌\s|너의\s|역할|AI\s?야|챗봇|로서|형식으로|표로|표\s?형식|단계별로|한국어로|영어로|쉽게|초등학생|중학생|고등학생|\d+\s*학년|수준으로|\d+\s*(?:개|가지|줄|문장|자|단어|문단)|이내로|요약|정리|작성|만들어|추천|분석|비교|설명|번역|바꿔|생성|제안|그려|써\s?줘|알려|평가|피드백|채점|아이디어|예시를|퀴즈|문제를)/;
// 해요체 요청이 AI에게 하는 말인지: 역할·형식·분량·수준 같은 분명한 단서가 있을 때만(“소감을 작성해 주세요”는 참가자 안내)
const AI_STRONG = /(너는|당신은|넌\s|역할|\bAI\b|챗봇|로서|형식으로|표로|표\s?형식|단계별로|한국어로|영어로|일본어로|중국어로|초등학생|중학생|고등학생|\d+\s*학년|수준으로|눈높이|\d+\s*(?:개|가지|줄|문장|자|단어|문단|문항)|이내로|예시를|퀴즈를|문제를|아이디어를|번역|프롬프트)/;
const TO_PEOPLE = /(여러분|선생님들|선생님께서|모두\s|함께\s|같이\s|짝과|모둠|조원)/;
const EXAM = /(고르(?:세요|시오)|답하(?:세요|시오)|쓰시오|물음에|빈칸에|알맞은)/;
const INSTRUCT = /(접속|클릭|로그인|선택하|누르|입력하|입력해|복사|붙여|다운로드|업로드|들어가|열어|저장하|확인하|공유하|참여하|따라|제출|설치|설정하|올려)/;
const LABEL = /^\s*[\[【<(「]?\s*(?:예시\s*|추천\s*|실습\s*)?(?:프롬프트|prompt|명령어|명령문|질문\s*예시|입력\s*(?:문장|예시|내용|창에)|요청\s*(?:문장|예시)|지시문|이렇게\s*입력|이렇게\s*물어)\s*(?:예시|예|\d{1,2}|[①-⑳])?\s*[\]】>)」]?\s*(?:[:：\-–—▶→]\s*|$)(.*)$/i;
const TEMPLATE_LINE = /^(?:#{1,3}\s*\S|[\[【]?\s*(?:역할|목표|목적|조건|형식|출력\s*형식|출력|맥락|상황|배경|지시|지시\s*사항|규칙|제약|제약\s*조건|대상|독자|톤|어조|분량|예시|참고|입력|role|task|context|format|constraints?|goal|audience|tone|output|instructions?)\s*[\]】]?\s*[:：])/i;
const PLACEHOLDER = /\[[^\]\n]{1,20}\]|\{[^}\n]{1,20}\}|<[^>\n]{1,20}>|○○|OO(?![A-Za-z])/;
const QUOTE_RE = /[“"「『‘]([^“”"「」『』‘’\n]{6,400}?)[”"」』’]/g;
const EN_PROMPT = /^(?:act as|you are|write|summarize|create|generate|make|explain|translate|list|give me|please|draft|design|suggest)\b/i;
const LEAD_MARK = /^(?:[-•·▪◦●○■□▶▷►➢➤→⇒✓✔☞※]\s*|\d{1,2}\s*[.)]\s+|[①-⑳]\s*|예\s*\)\s*|예시\s*\)\s*|ex\)\s*|Q\s*[.:)]\s*)/i;

const STEP_MARK = /^(?:step\s*\.?\s*\d{1,2}|\d{1,2}\s*단계|[❶-❿➊-➓])\s*[.:)\-–]?\s*/i;
function cleanPrompt(t) {
  let s = normText(t).replace(STEP_MARK, '').replace(LEAD_MARK, '');
  const lab = /^([^:：\n]{1,12})\s*[:：]\s*([\s\S]{6,})$/.exec(s);
  if (lab && !TEMPLATE_LINE.test(s) && /(질문|입력|요청|물어|명령|예시|예|따라|프롬프트|말하기|쓰기|하기)/.test(lab[1]) && (isRequestLine(lab[2]) || AI_CUE.test(lab[2]))) s = lab[2];
  const q = /^[“"「『‘']([\s\S]+)[”"」』’']$/.exec(s);
  if (q && !/[“"「『‘’”」』]/.test(q[1])) s = q[1];
  return normText(s);
}
export function isRequestLine(t) {
  if (EXAM.test(t)) return false;
  return REQ_STRONG.test(t) || (REQ_POLITE.test(t) && AI_STRONG.test(t) && !INSTRUCT.test(t.replace(/입력해\s*줘/, '')));
}

function detectPrompts(pages) {
  const found = [];
  const add = (p, text, cue, score, title) => {
    const t = cleanPrompt(text);
    if (t.length < 6 || t.length > 4000) return;
    if (/^https?:\/\/\S+$/.test(t)) return;
    found.push({ title: title || '', text: t, ...ref(p), cue, score });
  };
  for (const p of pages) {
    const paras = (p.paragraphs || []).filter((x) => x.text);
    const titleCue = /프롬프트|prompt|명령어|이렇게\s*(물어|입력)|질문하기/i.test(p.title || '');
    // 블록 묶기
    const blocks = new Map();
    for (const x of paras) { if (!blocks.has(x.block)) blocks.set(x.block, []); blocks.get(x.block).push(x); }
    const used = new Set();
    // 1) 이름표: "프롬프트: …" / "프롬프트 예시" 다음 줄들
    paras.forEach((x, i) => {
      const m = LABEL.exec(x.text);
      if (!m) return;
      const label = normLine(x.text.slice(0, x.text.length - (m[1] || '').length)).replace(/[:：\-–—▶→\s]+$/, '');
      let body = normText(m[1] || '');
      used.add(x);
      const rest = [];
      for (let j = i + 1; j < paras.length && rest.length < 15; j++) {
        const y = paras[j];
        if (LABEL.test(y.text)) break;
        if (body && y.block !== x.block) break;
        if (!body && y.block !== x.block && rest.length) break;
        if (!body && y.block !== x.block && j > i + 1) break;
        if (/^(\d{1,2}\s*[.)]|[①-⑳]|step\s*\d|\d+\s*단계)/i.test(y.text) && !isRequestLine(y.text) && rest.length) break;
        if (body && !(y.level > x.level || TEMPLATE_LINE.test(y.text) || PLACEHOLDER.test(y.text) || isRequestLine(y.text))) break;
        rest.push(y);
      }
      rest.forEach((y) => used.add(y));
      const text = [body, ...rest.map((y) => y.text)].filter(Boolean).join('\n');
      if (text) add(p, text, 'label', 5, /^\s*[\[【<(「]?\s*(?:프롬프트|prompt)\s*$/i.test(label) ? '' : label);
    });
    // 2) 틀(템플릿) 블록: 역할:/형식:/[주제] 자리 표시
    for (const [, list] of blocks) {
      const free = list.filter((y) => !used.has(y));
      if (free.length < 2) continue;
      const tmpl = free.filter((y) => TEMPLATE_LINE.test(y.text)).length;
      const ph = free.filter((y) => PLACEHOLDER.test(y.text)).length;
      const req = free.some((y) => isRequestLine(y.text) || AI_CUE.test(y.text));
      if (tmpl >= 2 || (tmpl >= 1 && (ph >= 1 || req)) || (ph >= 1 && free.some((y) => isRequestLine(y.text)))) {
        free.forEach((y) => used.add(y));
        add(p, free.map((y) => y.text).join('\n'), 'template', 4);
      }
    }
    // 3) 따옴표 안의 요청
    for (const x of paras) {
      if (used.has(x)) continue;
      QUOTE_RE.lastIndex = 0;
      let m;
      while ((m = QUOTE_RE.exec(x.text))) {
        const q = m[1].trim();
        const near = /(입력|물어|질문|요청|프롬프트|검색|말해|타이핑|명령|쳐|적어)/.test(x.text.replace(m[0], ''));
        if (isRequestLine(q) || (near && q.length >= 8) || (REQ_POLITE.test(q) && AI_CUE.test(q) && !EXAM.test(q))) { add(p, q, 'quote', 4); used.add(x); }
      }
    }
    // 4) 요청 어미(~해줘, ~만들어줘 …)로 끝나는 줄
    for (const x of paras) {
      if (used.has(x) || x.role === 'heading' || x.text.length < 8) continue;
      const t = x.text.replace(LEAD_MARK, '');
      if (EXAM.test(t) || (TO_PEOPLE.test(t) && !AI_STRONG.test(t))) continue;
      if (REQ_STRONG.test(t)) { add(p, t, 'request', 3); used.add(x); }
      else if (REQ_POLITE.test(t) && AI_STRONG.test(t) && !INSTRUCT.test(t) && !TO_PEOPLE.test(t)) { add(p, t, 'request', 2); used.add(x); }
      else if (EN_PROMPT.test(t) && t.length >= 15 && !/[가-힣]/.test(t.slice(0, 10))) { add(p, t, 'english', 2); used.add(x); }
      else if (x.role === 'code' && (TEMPLATE_LINE.test(t) || PLACEHOLDER.test(t) || AI_CUE.test(t))) { add(p, t, 'code', 3); used.add(x); }
    }
    // 5) 제목이 '프롬프트'인 쪽: 남은 긴 글상자
    if (titleCue) {
      for (const [, list] of blocks) {
        const free = list.filter((y) => !used.has(y) && y.role !== 'heading');
        const text = free.map((y) => y.text).join('\n');
        if (text.length >= 15 && !INSTRUCT.test(text.split('\n')[0]) && (AI_CUE.test(text) || isRequestLine(text))) { add(p, text, 'block', 3); free.forEach((y) => used.add(y)); }
      }
    }
    // 6) 노트 속 이름표 프롬프트
    if (p.notes) {
      for (const line of p.notes.split('\n')) {
        const m = LABEL.exec(line);
        if (m && m[1] && m[1].length >= 6) add(p, m[1], 'notes', 2);
        else {
          QUOTE_RE.lastIndex = 0;
          let q;
          while ((q = QUOTE_RE.exec(line))) if (isRequestLine(q[1])) add(p, q[1], 'notes', 2);
        }
      }
    }
  }
  // 중복 제거(같은 글, 또는 같은 쪽에서 다른 프롬프트에 포함된 글)
  const out = [];
  const keys = new Map();
  for (const f of found.sort((a, b) => b.score - a.score || b.text.length - a.text.length)) {
    const k = textKey(f.text);
    if (!k) continue;
    if (keys.has(k)) { addRef(keys.get(k), f.file, f.page); continue; }
    if (out.some((o) => o.file === f.file && o.page === f.page && textKey(o.text).includes(k))) continue;
    const item = { ...f, pages: [f.page], refs: [{ file: f.file, page: f.page }] };
    keys.set(k, item);
    out.push(item);
  }
  return out.sort((a, b) => fileOrder(a, b) || a.page - b.page);
}
let FILE_ORDER = new Map();
const fileOrder = (a, b) => (FILE_ORDER.get(a.file) ?? 0) - (FILE_ORDER.get(b.file) ?? 0);

// ── 실습 단계 ──────────────────────────────────────────
const STEP_RE = /^(?:(\d{1,2})\s*[.)]\s*(?!\d)|\((\d{1,2})\)\s*|([①-⑳])\s*|([❶-❿➊-➓])\s*|(?:step|STEP|Step)\s*\.?\s*(\d{1,2})\s*[.:)\-–]?\s*|(\d{1,2})\s*단계\s*[.:)\-–]?\s*|(첫째|둘째|셋째|넷째|다섯째|여섯째)\s*[,.:)]?\s*)(.{2,})$/;
const IMPERATIVE = /(하기|기|세요|합니다|십시오|클릭|선택|입력|접속|로그인|열기|누르기|업로드|저장|공유|복사|붙여\s?넣기|확인|만들기|제출|설치)[.!]?$/;
function stepText(x) { const m = STEP_RE.exec(x.text); return m ? normText(m[8]) : x.text; }
function isStepLine(x) { return !!x.num || STEP_RE.test(x.text); }

function detectSteps(pages, promptKeys, agendaPages) {
  const out = [];
  for (const p of pages) {
    if (agendaPages.has(p)) continue;
    const paras = (p.paragraphs || []).filter((x) => x.text && x.role !== 'heading');
    const groups = [];
    let cur = null;
    for (let i = 0; i < paras.length; i++) {
      const x = paras[i];
      const step = isStepLine(x);
      if (step && (!cur || x.level <= cur.level)) {
        if (cur && x.level < cur.level) { groups.push(cur); cur = null; }
        if (!cur) cur = { level: x.level, items: [], start: i };
        cur.items.push(stepText(x));
      } else if (cur && x.level > cur.level) {
        cur.items[cur.items.length - 1] += '\n' + x.text; // 하위 설명
      } else if (cur) { groups.push(cur); cur = null; }
    }
    if (cur) groups.push(cur);
    // 단계 표(단계 | 내용)
    for (const t of p.tables || []) {
      const head = (t.rows[0] || []).join(' ');
      if (/(단계|순서|step|과정)/i.test(head) && t.rows.length >= 3) groups.push({ items: t.rows.slice(1).map((r) => r.filter(Boolean).join(': ')).filter(Boolean), table: true });
    }
    for (const g of groups) {
      const items = g.items.map((s) => normText(s)).filter((s) => s && !promptKeys.has(textKey(s)));
      if (items.length < 2) continue;
      // 퀴즈 선택지처럼 짧은 것만 있는 무리는 제외
      if (items.every((s) => s.length <= 6)) continue;
      const before = paras[g.start - 1]?.text || '';
      if (/[?？]$|까요\??$|고르(세요|시오)/.test(before) && items.every((s) => s.length <= 30)) continue;
      out.push({ title: p.title || '', items, ...ref(p), kind: g.table ? 'table' : 'numbered' });
    }
    // 번호 없는 명령형 목록(실습 쪽)
    if (!groups.some((g) => g.items.length >= 2) && PRACTICE_WORD.test((p.title || '') + ' ' + paras.slice(0, 2).map((x) => x.text).join(' '))) {
      const imp = paras.filter((x) => x.level === 0 && IMPERATIVE.test(x.text) && x.text.length <= 160 && !promptKeys.has(textKey(x.text)));
      if (imp.length >= 2) out.push({ title: p.title || '', items: imp.map((x) => x.text), ...ref(p), kind: 'imperative' });
    }
  }
  return out;
}

// ── 링크 ──────────────────────────────────────────────
function linkLabelFromLine(line, raw) {
  const i = line.indexOf(raw);
  if (i <= 0) return '';
  let s = line.slice(0, i).replace(/[\s:：\-–—→▶>|(\[]+$/, '').replace(LEAD_MARK, '');
  s = s.split(/[|·/,]\s*/).pop() || s;
  s = normLine(s);
  return s.length >= 2 && s.length <= 30 ? s : '';
}
function linkKind(url, tool) {
  const h = hostOf(url);
  if (/youtube\.com|youtu\.be|vimeo\.com|tv\.naver\.com/.test(h)) return 'video';
  if (/forms\.gle|docs\.google\.com\/forms|form\.naver\.com|forms\.office\.com/.test(h + new URL(url).pathname)) return 'form';
  if (/zoom\.us|meet\.google\.com|teams\.microsoft\.com/.test(h)) return 'meeting';
  if (/docs\.google\.com|drive\.google\.com/.test(h)) return 'doc';
  if (tool) return 'tool';
  return 'web';
}
function detectLinks(pages) {
  const map = new Map();
  const add = (p, url, label, from) => {
    let u = url;
    try { u = new URL(url).href; } catch { return; }
    const k = urlKey(u);
    const tool = toolForUrl(u);
    const e = map.get(k) || { url: u, label: '', pages: [], refs: [], file: p.file, from, toolId: tool ? tool.id : undefined };
    const lab = normLine(label);
    if (lab && !e.label && !/^(https?:\/\/|www\.)/i.test(lab) && lab.length <= 60) e.label = lab;
    addRef(e, p.file, p.page);
    map.set(k, e);
  };
  for (const p of pages) {
    for (const l of p.links || []) add(p, l.url, l.label, 'link');
    const lines = linesOf(p, { withTitle: true }).map((x) => x.text).concat((p.notes || '').split('\n'));
    for (const line of lines) for (const f of findUrls(line)) add(p, f.url, linkLabelFromLine(line, f.raw), 'text');
  }
  const out = [...map.values()];
  for (const e of out) {
    const tool = e.toolId ? getTool(e.toolId) : null;
    if (!e.label) e.label = tool ? tool.name : hostOf(e.url);
    e.kind = linkKind(e.url, tool);
  }
  return out;
}

// ── 도구 ──────────────────────────────────────────────
function detectTools(pages, links) {
  const agg = new Map();
  const bump = (tool, p, n) => {
    const e = agg.get(tool.id) || { id: tool.id, name: tool.name, url: tool.url, category: tool.category, categoryLabel: CATEGORIES[tool.category] || '', icon: tool.icon, accountNeeded: !!tool.accountNeeded, account: tool.account || '', minors: tool.minors || '', korean: !!tool.korean, pages: [], refs: [], count: 0, file: p.file };
    e.count += n;
    addRef(e, p.file, p.page);
    agg.set(tool.id, e);
  };
  for (const p of pages) {
    const m = matchToolsInText(pageText(p));
    for (const e of m.values()) bump(e.tool, p, e.count);
    if (p.notes) for (const e of matchToolsInText(p.notes).values()) bump(e.tool, p, e.count * 0.5);
  }
  const byPage = new Map(pages.map((p) => [`${p.file}:${p.page}`, p]));
  for (const l of links) {
    if (!l.toolId) continue;
    const tool = getTool(l.toolId);
    for (const r of l.refs) bump(tool, byPage.get(`${r.file}:${r.page}`) || r, 1);
  }
  return [...agg.values()].map((e) => ({ ...e, count: Math.round(e.count * 10) / 10, pages: e.pages.sort((a, b) => a - b) }))
    .sort((a, b) => b.count - a.count || a.pages[0] - b.pages[0]);
}

// ── 차례(아젠다)·부(섹션) ───────────────────────────────
const AGENDA_TITLE = /^(?:\d{1,2}\s*[.)]\s*)?(?:목차|차례|순서|agenda|contents|outline|index|일정|시간표|로드맵|roadmap|table\s+of\s+contents)\s*$|(오늘의\s*(흐름|순서|여정|일정|차례|내용)|진행\s*(순서|일정)|연수\s*(흐름|순서|일정|구성)|일정\s*안내|이렇게\s*진행)/i;
const SECTION_MARK = /^(?:(part|파트|chapter|챕터|session|세션|module|모듈|unit|유닛|lesson|레슨)\s*\.?\s*(\d{1,2}|[ivx]{1,4}|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ])|(\d{1,2})\s*부(?![가-힣])|제\s*(\d{1,2})\s*(?:부|장|강|마당|교시)|(\d{1,2})\s*(?:장|강|마당|교시)(?![가-힣])|(첫|두|세|네|다섯|여섯)\s*(?:번째|째)\s*(?:마당|이야기|시간|파트)|([ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ])(?:\s*[.)])?)(?=$|[\s.:)\-–—|·])/i;
const KO_NUM = { 첫: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6 };
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, 'Ⅰ': 1, 'Ⅱ': 2, 'Ⅲ': 3, 'Ⅳ': 4, 'Ⅴ': 5, 'Ⅵ': 6, 'Ⅶ': 7, 'Ⅷ': 8, 'Ⅸ': 9, 'Ⅹ': 10 };
function markNo(m) {
  const v = m[2] || m[3] || m[4] || m[5] || m[7];
  if (m[6]) return KO_NUM[m[6]] || 0;
  if (!v) return 0;
  if (/^\d+$/.test(v)) return +v;
  return ROMAN[v.toLowerCase()] || ROMAN[v] || 0;
}

function detectAgenda(pages) {
  let best = null;
  for (const p of pages.slice(0, Math.max(6, Math.ceil(pages.length * 0.3)))) {
    const head = p.title || p.paragraphs?.[0]?.text || '';
    if (!AGENDA_TITLE.test(head) || head.length > 40) continue;
    const src = (p.paragraphs || []).filter((x) => x.text && x.text !== head && x.level <= 1);
    let items = src.filter((x) => x.level === 0).map((x) => x.text);
    if (items.length < 2) items = src.map((x) => x.text);
    if (items.length < 2 && p.tables?.length) items = p.tables[0].rows.map((r) => r.filter(Boolean).join(' '));
    items = items.map((t) => normLine(t)).filter((t) => t && t.length <= 120);
    if (items.length < 2) continue;
    const parsed = items.map((t) => {
      const tr = parseTimeRange(t);
      let text = tr ? normLine(t.replace(tr.text, '')) : t;
      text = text.replace(/^[\s|·:\-–—]+|[\s|·:\-–—]+$/g, '');
      const m = SECTION_MARK.exec(text);
      const it = { text: normLine(text.replace(/^(\d{1,2}|0\d)\s*[.)]?\s+/, '')) };
      if (m) { it.part = normLine(m[0]); it.no = markNo(m); it.text = normLine(text.slice(m[0].length).replace(/^[\s.:)\-–—|·]+/, '')) || it.text; }
      if (tr) { it.start = tr.start; it.end = tr.end; }
      return it;
    }).filter((it) => it.text);
    if (!best || parsed.length > best.items.length) best = { ...ref(p), title: p.title || head, items: parsed };
  }
  return best;
}

function sparse(p) {
  const n = (p.paragraphs || []).filter((x) => x.text).length;
  const len = (p.paragraphs || []).reduce((s, x) => s + x.text.length, 0);
  const imgs = (p.images || []).filter((im) => !im.repeated && (im.share || 0) > 0.2).length;
  return n <= 3 && len <= 90 && !(p.tables || []).length && imgs <= 1;
}

function detectSections(pages, agenda, special) {
  const starts = [];
  const seenNo = new Set();
  pages.forEach((p, idx) => {
    if (special.has(p)) return;
    const head = p.title || '';
    const first = (p.paragraphs || []).find((x) => x.text)?.text || '';
    let m = SECTION_MARK.exec(head);
    let markIn = 'title';
    if (!m && (!head || head.length <= 12) && first.length <= 40) { m = SECTION_MARK.exec(first); markIn = 'para'; }
    const isSectionLayout = p.layout === 'section' || (p.layout === 'title' && idx > 0);
    if (!m && !isSectionLayout) return;
    if (m && !isSectionLayout && !sparse(p) && markIn === 'para') return;
    if (m && !isSectionLayout && !sparse(p) && head.replace(m[0], '').trim().length > 30) return;
    if (!m && isSectionLayout && !sparse(p)) return;
    let label = m ? normLine(m[0]) : '';
    let title = '';
    if (m && markIn === 'title') title = normLine(head.slice(m[0].length).replace(/^[\s.:)\-–—|·]+/, ''));
    else if (m) title = normLine(first.slice(m[0].length).replace(/^[\s.:)\-–—|·]+/, '')) || head;
    else title = head;
    if (!title || title.length < 2) {
      const cand = (p.paragraphs || []).map((x) => x.text).find((t) => t && !SECTION_MARK.test(t) && t.length <= 60);
      title = normLine(cand || head || label);
    }
    const no = m ? markNo(m) : 0;
    if (no && seenNo.has(`${p.file}:${no}`) && !isSectionLayout) return;
    if (no) seenNo.add(`${p.file}:${no}`);
    const desc = (p.paragraphs || []).map((x) => x.text).filter((t) => t && t !== title && !SECTION_MARK.test(t)).slice(0, 2).join(' · ');
    starts.push({ idx, no, label, title: truncate(title, 80), desc: truncate(desc, 160), ...ref(p) });
  });
  // 부 표시가 없으면 차례 항목과 제목이 같은 쪽을 찾아 나눔
  if (starts.length < 2 && agenda && agenda.items.length >= 2) {
    const alt = [];
    for (const it of agenda.items) {
      const k = textKey(it.text);
      if (k.length < 2) continue;
      const idx = pages.findIndex((p, i) => i > pages.findIndex((x) => x.page === agenda.page && x.file === agenda.file) && !special.has(p) && p.title && (textKey(p.title).includes(k) || k.includes(textKey(p.title))) && textKey(p.title).length >= 2);
      if (idx >= 0 && !alt.some((a) => a.idx === idx)) alt.push({ idx, no: it.no || alt.length + 1, label: it.part || '', title: it.text, desc: '', ...ref(pages[idx]), start: it.start, end: it.end });
    }
    if (alt.length >= 2) { starts.length = 0; starts.push(...alt.sort((a, b) => a.idx - b.idx)); }
  }
  starts.sort((a, b) => a.idx - b.idx);
  return starts.map((s, i) => {
    const endIdx = i + 1 < starts.length ? starts[i + 1].idx - 1 : pages.length - 1;
    const range = pages.slice(s.idx, endIdx + 1).filter((p) => p.file === s.file);
    const out = { no: s.no || i + 1, label: s.label || `PART ${i + 1}`, title: s.title, desc: s.desc, file: s.file, page: s.page, pages: range.map((p) => p.page) };
    if (s.start) { out.start = s.start; out.end = s.end; }
    return out;
  });
}

// ── 강사 소개 ─────────────────────────────────────────
const PROFILE_TITLE = /(강사|발표자|연사|진행자|강연자|소개|프로필|profile|about\s*me|who\s*am\s*i|자기\s*소개|약력|저는|인사드립니다|만든\s*사람)/i;
const ROLE_WORD = /(교사|선생님|교수|연구사|장학사|장학관|교감|교장|수석교사|강사|대표|팀장|연구원|박사|석사|교육전문직|선도교사|연구회장|회장|위원|크리에이터|작가|교육청|연구소)/;
const CAREER = /^\s*(?:\(?\s*(?:현|전|前|現)\s*\)?\s*[)\].:]?\s+|[-•·]\s*(?:현|전)\s+|(?:현|전)\)\s*)/;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const NAME_STOP = new Set(['소개', '약력', '경력', '강사', '발표자', '프로필', '연락처', '이메일', '저서', '학력', '활동', '수상', '감사', '안녕', '오늘', '연수', '실습', '선생님', '교사', '교수', '선생']);

function detectInstructor(pages, profilePages = []) {
  let best = null;
  pages.forEach((p, i) => {
    const lines = linesOf(p, { withTitle: false }).map((x) => x.text);
    const all = [p.title || '', ...lines].join('\n');
    let score = 0;
    if (PROFILE_TITLE.test(p.title || '')) score += 3;
    const careers = lines.filter((t) => CAREER.test(t)).length;
    score += Math.min(4, careers * 1.5);
    if (EMAIL.test(all)) score += 1;
    if (ROLE_WORD.test(all)) score += 1;
    if ((p.images || []).some((im) => !im.repeated)) score += 0.5;
    if (i <= 4) score += 1;
    if (lines.length > 14) score -= 2;
    if (score < 4.5) return;
    profilePages.push(p);
    if (best && best.score >= score) return;
    // 이름 찾기
    let name = '';
    const cand = [p.title || '', ...lines];
    for (const t of cand) {
      let m = /(?:강사|발표자|연사|진행|강연)\s*(?:소개)?\s*[:：|·\-–]?\s*([가-힣]{2,4})(?:\s*(?:선생님|교사|강사|교수|연구사|장학사|박사))?\s*$/.exec(t);
      if (m && !NAME_STOP.has(m[1])) { name = m[1]; break; }
      m = /^([가-힣]{2,4})(?:\s*(?:선생님|교사|강사|교수|연구사|장학사|박사|입니다|이에요|예요))?\s*$/.exec(t.replace(/[()]/g, ' ').trim());
      if (m && !NAME_STOP.has(m[1]) && !PROFILE_TITLE.test(m[1])) { name = m[1]; break; }
      m = /저는\s*([가-힣]{2,4})\s*(?:입니다|이에요|예요|라고)/.exec(t);
      if (m && !NAME_STOP.has(m[1])) { name = m[1]; break; }
    }
    const bio = lines.filter((t) => CAREER.test(t) || (/^[-•·]/.test(t) && t.length <= 80)).map((t) => normLine(t.replace(/^[-•·]\s*/, '')));
    const roleLine = lines.find((t) => ROLE_WORD.test(t) && t.length <= 60 && !EMAIL.test(t) && t !== name) || '';
    const cur = lines.find((t) => /^\s*\(?\s*(?:현|現)\s*\)?/.test(t)) || roleLine;
    let org = '';
    const ORG_RE = /([가-힣A-Za-z0-9]+(?:초등학교|중학교|고등학교|학교|교육청|교육지원청|연수원|교육원|대학교|연구소|연구회))/;
    const om = ORG_RE.exec(cur || '') || ORG_RE.exec(roleLine) || ORG_RE.exec(lines.filter((t) => !CAREER.test(t) || /^\s*\(?\s*(?:현|現)/.test(t)).join('\n'));
    if (om) org = om[1];
    let role = normLine((cur || '').replace(CAREER, '').replace(org, '').replace(name, ''));
    role = role.replace(/^[\s,·|/-]+|[\s,·|/-]+$/g, '');
    const email = (EMAIL.exec(all) || [''])[0];
    const links = (p.links || []).filter((l) => !/^mailto:/i.test(l.url)).map((l) => ({ label: l.label || hostOf(l.url), url: l.url }));
    const photo = (p.images || []).find((im) => !im.repeated);
    best = { score, name, role: truncate(role, 60), org, bio: bio.slice(0, 12), email, links, ...ref(p), photo: photo ? photo.id : '' };
  });
  if (!best) return null;
  delete best.score;
  return best;
}

// ── 일시·장소·주최 ─────────────────────────────────────
const VENUE_LABEL = /(?:^|[\s|/·,])(?:장\s*소|곳|위\s*치|교육\s*장소|연수\s*장소|venue|where|📍|🏫)\s*[:：]?\s*([^|/\n]{2,60})/i;
const VENUE_KEY = /(대강당|소강당|강당|대회의실|회의실|연수실|시청각실|강의실|세미나실|컴퓨터실|정보실|과학실|도서관|체육관|다목적실|교육관|컨벤션|아트홀|홀|교육청|교육지원청|연수원|교육원|캠퍼스|\d+\s*층|[가-힣]+(?:초등학교|중학교|고등학교))/;
const ONLINE = /(온라인|원격|실시간\s*쌍방향|비대면|zoom|줌\s*(?:회의|링크|접속)|google\s*meet|구글\s*미트|teams|팀즈|웨비나|webinar|유튜브\s*라이브|라이브\s*방송)/i;
const ORG_LABEL = /(?:주\s*최|주\s*관|주최\s*[·/]\s*주관|organized\s*by)\s*[:：]?\s*([^|/\n]{2,40})/i;
const ORG_LINE = /^[가-힣]+(?:특별시|광역시|특별자치시|특별자치도|도)?\s*[가-힣]*(?:교육청|교육지원청|교육연수원|연수원|교육원|교원연수원|교육연구원|교원단체|교사연구회|연구회|학회)$/;
const DATE_LABEL = /(일\s*시|일\s*자|날\s*짜|때|기\s*간|연수\s*일|date|when)/i;

function detectEvent(pages, refYear) {
  const cands = [];
  pages.forEach((p, i) => {
    const lines = linesOf(p, { withTitle: true }).map((x) => x.text);
    lines.forEach((line, li) => {
      for (const d of parseKoreanDates(line, refYear)) {
        let score = 0;
        if (i === 0) score += 4; else if (i <= 2) score += 2; else if (i >= pages.length - 2) score += 0.5;
        if (d.weekdayOk === true) score += 2;
        if (d.weekdayOk === false) score -= 1;
        if (DATE_LABEL.test(line)) score += 3;
        const tr = parseTimeRange(line.slice(d.index + d.text.length)) || parseTimeRange(line) || parseTimeRange(lines[li + 1] || '');
        if (tr) score += 2;
        if (d.yearGiven) score += 1;
        const y = +d.date.slice(0, 4);
        if (Math.abs(y - refYear) <= 1) score += 1;
        cands.push({ ...d, score, time: tr, line, li, p });
      }
    });
  });
  cands.sort((a, b) => b.score - a.score || a.p.page - b.p.page);
  const best = cands[0] || null;
  const ev = { date: '', dateText: '', weekday: '', start: '', end: '', venue: '', organizer: '', mode: '', joinUrl: '' };
  let evPage = null;
  if (best) {
    Object.assign(ev, { date: best.date, dateText: best.text, weekday: best.weekday });
    if (best.time) { ev.start = best.time.start; ev.end = best.time.end; }
    evPage = best.p;
    ev.file = best.p.file; ev.page = best.p.page;
    // 같은 행사 날짜가 여러 개면(과정형) 모두 기록
    const uniq = [...new Set(cands.filter((c) => c.score >= 3).map((c) => c.date))].sort();
    if (uniq.length >= 2) ev.dates = uniq.slice(0, 20);
  }
  if (!ev.start) {
    for (const p of pages.slice(0, 3)) {
      for (const t of linesOf(p, { withTitle: true }).map((x) => x.text)) {
        if (!/(시간|일시|때)/.test(t) && p !== evPage) continue;
        const tr = parseTimeRange(t);
        if (tr) { ev.start = tr.start; ev.end = tr.end; break; }
      }
      if (ev.start) break;
    }
  }
  // 장소
  const venuePages = [evPage, ...pages.slice(0, 3), ...pages.slice(-2)].filter(Boolean);
  outer: for (const p of venuePages) {
    for (const t of linesOf(p, { withTitle: true }).map((x) => x.text)) {
      const m = VENUE_LABEL.exec(t);
      if (m) { ev.venue = cleanVenue(m[1]); if (ev.venue) break outer; }
    }
  }
  if (!ev.venue) {
    outer2: for (const p of venuePages) {
      for (const t of linesOf(p, { withTitle: false }).map((x) => x.text)) {
        if (t.length > 60 || parseKoreanDates(t, refYear).length && !VENUE_KEY.test(t.replace(/\d{4}.*?\)/, ''))) continue;
        const m = VENUE_KEY.exec(t);
        if (m && !/(교육청|교육지원청|연수원)$/.test(normLine(t))) { ev.venue = cleanVenue(t); break outer2; }
      }
    }
  }
  // 주최
  for (const p of [pages[0], evPage, pages[pages.length - 1]].filter(Boolean)) {
    for (const t of linesOf(p, { withTitle: true }).map((x) => x.text)) {
      const m = ORG_LABEL.exec(t);
      if (m) { ev.organizer = normLine(m[1]); break; }
      if (!ev.organizer && ORG_LINE.test(normLine(t))) ev.organizer = normLine(t);
    }
    if (ev.organizer) break;
  }
  // 온라인·혼합
  const first = pages.slice(0, 3).map((p) => pageText(p) + '\n' + (p.notes || '')).join('\n');
  const join = pages.flatMap((p) => p.links || []).find((l) => /zoom\.us\/j|meet\.google\.com\/[a-z]|teams\.microsoft\.com\/l\/meetup/i.test(l.url));
  if (join) ev.joinUrl = join.url;
  const online = ONLINE.test(first) || !!join;
  ev.mode = online && ev.venue ? 'hybrid' : online ? 'online' : ev.venue ? 'offline' : '';
  return ev;
}
function cleanVenue(s) {
  let v = normLine(s).replace(/^[\s:：\-–—|·]+/, '');
  v = v.replace(/\s*(?:\d{4}\s*[.\-/년].*|일\s*시.*|대\s*상.*|강\s*사.*)$/, '');
  return truncate(v.replace(/[\s,·|/]+$/, ''), 60);
}

// ── 퀴즈·질문 ─────────────────────────────────────────
const QUIZ_TITLE = /(퀴즈|quiz|문제|o\s*x|확인\s*문제|골든벨|도전|맞혀|맞춰|정답은)/i;
const QUESTION = /([?？]|까요\??$|일까\??$|인가요\??$|무엇일까|고르(?:세요|시오)|맞는\s*것|아닌\s*것|옳은\s*것|틀린\s*것)/;
const OPTION = /^(?:([①②③④⑤⑥])|([1-6])\s*[.)]|([A-Fa-f])\s*[.)]|([ㄱㄴㄷㄹㅁ])\s*[.)])\s*(.+)$/;
const ANSWER = /(?:^|\s)(?:정답|답)\s*(?:은|는)?\s*[:：]?\s*([①-⑥1-6A-Fa-fOXㄱ-ㅁ○×]|.{1,40})\s*$/;
const EXPLAIN = /(?:해설|풀이|설명)\s*[:：]\s*(.+)$/;
const CIRCLED = '①②③④⑤⑥';

function answerIndex(ans, options) {
  if (!ans) return -1;
  const a = ans.trim();
  let i = CIRCLED.indexOf(a[0]);
  if (i >= 0) return i < options.length ? i : -1;
  if (/^[1-6]\b/.test(a)) { i = +a[0] - 1; return i < options.length ? i : -1; }
  if (/^[A-Fa-f]\b/.test(a)) { i = a.toUpperCase().charCodeAt(0) - 65; return i < options.length ? i : -1; }
  if (/^[ㄱㄴㄷㄹㅁ]/.test(a)) { i = 'ㄱㄴㄷㄹㅁ'.indexOf(a[0]); return i < options.length ? i : -1; }
  if (/^(O|○)$/i.test(a)) return options.findIndex((o) => /^(O|○)$/i.test(o));
  if (/^(X|×)$/i.test(a)) return options.findIndex((o) => /^(X|×)$/i.test(o));
  const k = textKey(a);
  return options.findIndex((o) => textKey(o) && (textKey(o) === k || k.includes(textKey(o))));
}

function detectQuiz(pages, promptKeys) {
  const quiz = [], faq = [];
  for (const p of pages) {
    const lines = (p.paragraphs || []).map((x) => x.text).filter(Boolean);
    const notes = (p.notes || '').split('\n');
    const quizPage = QUIZ_TITLE.test(p.title || '');
    for (let i = 0; i < lines.length; i++) {
      const q = lines[i];
      if (!QUESTION.test(q) || promptKeys.has(textKey(q)) || q.length > 300) continue;
      let options = [];
      let j = i + 1;
      // 한 줄에 ①…②… 로 나열
      const inline = q.split(/(?=[①②③④⑤⑥])/);
      let qText = q;
      if (inline.length >= 3) { qText = inline[0]; options = inline.slice(1).map((s) => normLine(s.slice(1))); }
      else {
        for (; j < lines.length && options.length < 6; j++) {
          const m = OPTION.exec(lines[j]);
          if (!m) break;
          options.push(normLine(m[5]));
        }
        if (options.length < 2 && j < lines.length && /^(O\s*[/|,·]?\s*X|○\s*[/|,·]?\s*×)$/i.test(lines[j])) options = ['O', 'X'];
        if (options.length < 2 && /o\s*x|ox\s*퀴즈/i.test(p.title || '') ) options = ['O', 'X'];
      }
      if (options.length < 2) continue;
      if (!quizPage && !/[?？]|고르/.test(qText) && options.length < 3) continue;
      let answer = -1, explain = '';
      for (const t of [...lines.slice(j), ...notes]) {
        const a = ANSWER.exec(t);
        if (a && answer < 0) answer = answerIndex(a[1], options);
        const e = EXPLAIN.exec(t);
        if (e && !explain) explain = normLine(e[1]);
      }
      quiz.push({ q: normLine(qText.replace(/^(?:Q\s*\d*\s*[.:)]|문제\s*\d*\s*[.:)]?|\d{1,2}\s*[.)])\s*/i, '')), options, answer, explain, ...ref(p) });
      i = j - 1;
    }
    // Q. / A. 쌍
    const qa = [...lines, ...notes];
    for (let i = 0; i < qa.length - 1; i++) {
      const m = /^(?:Q\s*\d*\s*[.:)]|질문\s*\d*\s*[:：]|Q\s+)(.+)$/i.exec(qa[i]);
      if (!m) continue;
      const a = /^(?:A\s*\d*\s*[.:)]|답(?:변)?\s*[:：]|A\s+)(.+)$/i.exec(qa[i + 1]);
      if (!a) continue;
      faq.push({ q: normLine(m[1]), a: normLine(a[1]), ...ref(p) });
      i++;
    }
  }
  return { quiz, faq };
}

// ── 용어 ──────────────────────────────────────────────
function containsPrompt(s, promptKeys) {
  const k = textKey(s);
  if (promptKeys.has(k)) return true;
  for (const pk of promptKeys) if (pk.length >= 6 && k.includes(pk)) return true;
  return false;
}
const GLOSS_TITLE = /(용어|개념|키워드|낱말|glossary|terms|알아\s*둘)/i;
const GLOSS_STOP = /^(장소|일시|일자|날짜|대상|강사|발표자|프롬프트|주제|준비물|시간|링크|주소|예시|정답|해설|풀이|질문|답|답변|참고|출처|목표|목적|역할|조건|형식|출력|맥락|상황|지시|규칙|톤|분량|입력|결과|방법|준비|q|a|tip|팁|note|주의|안내|문의|연락처|이메일|전화|step|단계|\d+)$/i;
const DEF_END = /(이다|입니다|말합니다|뜻합니다|의미합니다|말한다|뜻한다|의미한다|기술|방법|모델|도구|서비스|현상|능력|과정|것|프로그램|플랫폼|시스템|체계)\.?$/;

function detectGlossary(pages, promptKeys) {
  const out = [];
  const seen = new Set();
  const add = (term, desc, p) => {
    const t = normLine(term).replace(/^[-•·*\s]+/, '');
    const d = normLine(desc);
    if (!t || !d || t.length > 30 || d.length < 6 || GLOSS_STOP.test(t) || /https?:\/\//.test(d)) return;
    const k = textKey(t);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ term: t, desc: truncate(d, 300), ...ref(p) });
  };
  for (const p of pages) {
    const gPage = GLOSS_TITLE.test(p.title || '');
    for (const t of p.tables || []) {
      const head = (t.rows[0] || []).join(' ');
      if (t.rows[0]?.length >= 2 && /(용어|개념|낱말|단어|term|키워드)/i.test(head) && /(뜻|설명|의미|정의|desc|meaning)/i.test(head)) for (const r of t.rows.slice(1)) add(r[0], r.slice(1).filter(Boolean).join(' '), p);
      else if (gPage && t.rows[0]?.length === 2) for (const r of t.rows) add(r[0], r[1], p);
    }
    for (const x of p.paragraphs || []) {
      const s = x.text;
      if (!s || s.length > 260 || STEP_RE.test(s) || containsPrompt(s, promptKeys)) continue;
      let m = /^([^:：\n]{1,24}?)\s*(\([^)]{1,40}\))?\s*[:：]\s*(.{6,240})$/.exec(s);
      if (m && !/\s{2,}/.test(m[1]) && m[1].split(' ').length <= 3) {
        const strong = gPage || !!m[2] || /[A-Za-z]{2,}/.test(m[1]) || DEF_END.test(m[3]);
        if (strong && !TEMPLATE_LINE.test(s)) { add(m[1] + (m[2] ? ' ' + m[2] : ''), m[3], p); continue; }
      }
      m = /^([^,.\n]{1,24}?)(?:\(([^)]{1,40})\))?\s*(?:이란|란|이라는\s*것은|라는\s*것은)\s+(.{6,200})$/.exec(s);
      if (m && DEF_END.test(m[3])) { add(m[1] + (m[2] ? ` (${m[2]})` : ''), m[3], p); continue; }
      m = /^([가-힣A-Za-z0-9\s]{1,20}?)\(([A-Za-z][A-Za-z0-9\s\-]{1,40})\)\s*(?:은|는|이|가)\s+(.{6,200})$/.exec(s);
      if (m && DEF_END.test(m[3])) add(`${m[1].trim()} (${m[2].trim()})`, m[3], p);
    }
  }
  return out;
}

// ── 실습 쪽 ───────────────────────────────────────────
const PRACTICE_WORD = /(실습|따라\s*하기|따라\s*해\s*(?:보기|봐요|보세요|봅시다)|해\s*보기|해보기|해\s*봅시다|활동|체험|미션|mission|hands[\s-]?on|practice|워크숍|workshop|직접|만들어\s*(?:봅시다|보기|봐요|보세요)|도전|step\s*\d|과제|실전)/i;
const ACTION = /(접속|클릭|입력|선택|로그인|업로드|복사|붙여\s?넣|다운로드|공유|열기|누르|생성|저장|제출|설치)/g;

function practiceScore(p, stepsByPage, promptsByPage, linksByPage) {
  const key = `${p.file}:${p.page}`;
  let s = 0;
  const body = (p.paragraphs || []).map((x) => x.text).join('\n');
  if (PRACTICE_WORD.test(p.title || '')) s += 2;
  else if (PRACTICE_WORD.test(body)) s += 1;
  if (stepsByPage.has(key)) s += 2;
  if (promptsByPage.has(key)) s += 2;
  if (linksByPage.has(key)) s += 1;
  const acts = (body.match(ACTION) || []).length;
  if (acts >= 2) s += 1;
  if (acts >= 4) s += 1;
  return s;
}

// ── 핵심 문장 ─────────────────────────────────────────
const MSG_CUE = /(핵심|기억하세요|기억할|기억해|중요한\s*(것|건)|한\s*줄\s*(요약|정리)|결국|오늘의\s*메시지|메시지|명심|잊지\s*마세요|꼭\s*기억)/;
const CLOSING_TITLE = /^(?:.{0,8}\s)?(마무리|마치며|맺음말?|요약\s*정리|summary|wrap[\s-]?up|핵심\s*정리|오늘\s*배운\s*것|나가며|에필로그|closing|thank\s*you|감사합니다|q\s*&\s*a)\s*[!.]?$/i;

function detectMessages(pages, promptKeys, special, stepPages) {
  const out = [];
  const closingPages = new Set();
  const seen = new Set();
  const add = (text, p, score) => {
    let t = normLine(text).replace(/^[“"「『‘']|[”"」』’']$/g, '');
    if (t.length < 8 || t.length > 120 || /https?:\/\//.test(t) || promptKeys.has(textKey(t))) return;
    if (parseKoreanDates(t).length || parseTimeRange(t)) return;
    const k = textKey(t);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ text: t, ...ref(p), score });
  };
  pages.forEach((p, i) => {
    if (special.has(p) || i === 0 || stepPages.has(`${p.file}:${p.page}`)) return;
    const paras = (p.paragraphs || []).filter((x) => x.text);
    const total = paras.reduce((n, x) => n + x.text.length, 0);
    if (p.kind !== 'section' && paras.length >= 1 && paras.length <= 2 && total <= 90 && !(p.tables || []).length && p.layout !== 'section') {
      for (const x of paras) add(x.text, p, 2 + (/[!！]$/.test(x.text) ? 1 : 0));
    }
    if (!paras.length && p.title && p.title.length >= 12 && p.layout !== 'section' && !SECTION_MARK.test(p.title)) add(p.title, p, (p.titleGuessed ? 3 : 1.5) + (/[!！]$/.test(p.title) ? 1 : 0));
    for (const x of paras) {
      if (MSG_CUE.test(x.text)) add(x.text.replace(/^(핵심|한\s*줄\s*(요약|정리)|오늘의\s*메시지)\s*[:：]\s*/, ''), p, 3);
      QUOTE_RE.lastIndex = 0;
      let m;
      while ((m = QUOTE_RE.exec(x.text))) if (!isRequestLine(m[1]) && m[1].length >= 10 && m[1].length <= 80) add(m[1], p, 2);
    }
    if (CLOSING_TITLE.test(p.title || '')) { closingPages.add(`${p.file}:${p.page}`); for (const x of paras.slice(0, 3)) if (x.text.length <= 80) add(x.text, p, 2); }
  });
  for (const m of out) if (closingPages.has(`${m.file}:${m.page}`)) m.closing = true;
  return out.sort((a, b) => b.score - a.score || a.page - b.page).slice(0, 8);
}

// ── 연수 제목 ─────────────────────────────────────────
const GENERIC_TITLE = /^(powerpoint\s*프레젠테이션|프레젠테이션|presentation|제목\s*없음|untitled|슬라이드\s*\d*|slide\s*\d*|문서\s*\d*|document\s*\d*|microsoft\s*word.*|새\s*문서)$/i;
function detectTitle(material, pages) {
  const first = pages[0];
  let title = '', subtitle = '';
  if (first) {
    title = first.title || '';
    const okSub = (x) => x.text && x.text.length <= 80 && !parseKoreanDates(x.text).length && !parseTimeRange(x.text) && !VENUE_LABEL.test(x.text) && !/^[^:：]{1,10}[:：]/.test(x.text) && !ORG_LINE.test(x.text) && !findUrls(x.text).length;
    const paras = first.paragraphs || [];
    const sub = paras.find((x) => x.role === 'subtitle' && okSub(x)) || paras.slice(0, 3).find((x) => okSub(x) && x.text.length <= 60);
    subtitle = sub ? sub.text : '';
    if (!title && subtitle) { title = subtitle; subtitle = ''; }
  }
  const metaTitle = material.meta?.title || '';
  if ((!title || GENERIC_TITLE.test(title)) && metaTitle && !GENERIC_TITLE.test(metaTitle)) title = metaTitle;
  if (!title) title = (material.files?.[0]?.name || '').replace(/\.[^.]+$/, '');
  return { title: truncate(normLine(title), 120), subtitle: truncate(normLine(subtitle), 160) };
}

// ── 유형 힌트 ─────────────────────────────────────────
const LIVE_WORD = /(컨퍼런스|콘퍼런스|포럼|박람회|페스티벌|심포지엄|축제|발표회|성과\s*공유회|에듀테크\s*데이|summit|conference|forum)/i;
const SESSION_WORD = /(\d{1,2})\s*(?:차시|주차|회차)/g;

function archetypeHint(material, pages, practice, event, instructors, title) {
  const textAll = pages.map((p) => p.title || '').join('\n') + '\n' + title;
  const sessions = new Set();
  let m;
  SESSION_WORD.lastIndex = 0;
  while ((m = SESSION_WORD.exec(textAll))) sessions.add(+m[1]);
  const dates = event.dates?.length || 0;
  const reasons = [];
  let primary = 'story', format = 'lecture';
  const ratio = practice.ratio;
  if (sessions.size >= 3 || dates >= 3) { primary = 'course'; format = 'course'; reasons.push(`여러 차시(${Math.max(sessions.size, dates)}회)로 이어지는 자료라 과정형으로 봤어요.`); }
  else if (LIVE_WORD.test(title) && instructors >= 2) { primary = 'live'; format = 'conference'; reasons.push('여러 연사가 나오는 행사 자료라 라이브형으로 봤어요.'); }
  else if (ratio >= 0.45 || (practice.count >= 4 && ratio >= 0.3)) { primary = 'lab'; format = ratio >= 0.6 ? 'practice' : 'workshop'; reasons.push(`실습 쪽이 ${practice.count}개(비율 ${Math.round(ratio * 100)}%)라 실습형으로 봤어요.`); }
  else { reasons.push(`실습 쪽 비율이 ${Math.round(ratio * 100)}%라 강의(스토리)형으로 봤어요.`); }
  const mix = [];
  if (primary === 'lab' && ratio < 0.8) mix.push('story');
  if (primary === 'story' && ratio >= 0.2) mix.push('lab');
  if (primary === 'course' && ratio >= 0.3) mix.push('lab');
  return { primary, mix, format, reason_ko: reasons.join(' '), sessions: Math.max(sessions.size, dates) || 1 };
}

// ── 전체 ─────────────────────────────────────────────
/**
 * 교재에서 연수 정보 찾기
 * @param {object} material ingest 결과
 * @param {{today?:string|Date, refYear?:number}} opts
 */
export function detect(material, opts = {}) {
  const renderOnly = new Set((material.files || []).filter((f) => f.renderOf).map((f) => f.id));
  const pages = (material.pages || []).filter((p) => !p.hidden && !p.error && !renderOnly.has(p.file));
  FILE_ORDER = new Map((material.files || []).map((f, i) => [f.id, i]));
  const today = opts.today ? new Date(opts.today) : new Date();
  const refYear0 = opts.refYear || today.getFullYear();
  let refYear = refYear0;
  if (Number.isNaN(refYear)) refYear = new Date().getFullYear();

  const prompts = detectPrompts(pages);
  const promptKeys = new Set(prompts.map((x) => textKey(x.text)));
  const agenda = detectAgenda(pages);
  const agendaPages = new Set(agenda ? pages.filter((p) => p.file === agenda.file && p.page === agenda.page) : []);
  const steps = detectSteps(pages, promptKeys, agendaPages);
  const links = detectLinks(pages);
  const profilePages = [];
  const instructor = detectInstructor(pages, profilePages);
  const tools = detectTools(pages.filter((p) => !profilePages.includes(p)), links);
  const event = detectEvent(pages, refYear);
  const { title, subtitle } = detectTitle(material, pages);
  const special = new Set([pages[0], ...agendaPages].filter(Boolean));
  if (instructor) pages.filter((p) => p.file === instructor.file && p.page === instructor.page).forEach((p) => special.add(p));
  const sections = detectSections(pages, agenda, special);
  const { quiz, faq } = detectQuiz(pages, promptKeys);
  const glossary = detectGlossary(pages, promptKeys);
  const stepPages = new Set(steps.map((x) => `${x.file}:${x.page}`));
  const messages = detectMessages(pages, promptKeys, special, stepPages);

  const keyOf = (x) => `${x.file}:${x.page}`;
  const stepsByPage = new Set(steps.map(keyOf));
  const promptsByPage = new Set(prompts.flatMap((x) => x.pages.map((pg) => `${x.file}:${pg}`)));
  const linksByPage = new Set(links.flatMap((l) => l.pages.map((pg) => `${l.file}:${pg}`)));
  const sectionStarts = new Set(sections.map(keyOf));
  const closing = new Set(pages.slice(-2).filter((p) => CLOSING_TITLE.test(p.title || '')));
  const content = pages.filter((p) => !special.has(p) && !sectionStarts.has(keyOf(p)) && !closing.has(p));
  const practicePages = content.filter((p) => practiceScore(p, stepsByPage, promptsByPage, linksByPage) >= 3);
  const practice = {
    pages: practicePages.map(ref),
    count: practicePages.length,
    ratio: content.length ? Math.round((practicePages.length / content.length) * 100) / 100 : 0,
  };
  const archetype = archetypeHint(material, pages, practice, event, instructor ? 1 : 0, title);

  return {
    title, subtitle, event, instructor, agenda, sections, prompts, steps, links, tools, quiz, faq, glossary, messages, practice, archetype,
    fonts: detectFonts(material),
    stats: {
      pages: (material.pages || []).length,
      hidden: (material.pages || []).filter((p) => p.hidden).length,
      chars: pages.reduce((n, p) => n + pageText(p).length, 0),
      images: pages.reduce((n, p) => n + (p.images || []).filter((im) => !im.repeated).length, 0),
      tables: pages.reduce((n, p) => n + (p.tables || []).length, 0),
      notes: pages.filter((p) => p.notes).length,
    },
  };
}

export { pageText };
