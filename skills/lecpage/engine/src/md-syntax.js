// 글 칸(text)·FAQ 답이 쓰는 '제한된 마크다운'의 문법: 블록 나누기와 그리지 못하는 문법 찾기.
// 다른 모듈을 불러오지 않습니다(validate.js와 render/markdown.js가 함께 씀).
//
// 그리는 것: 문단 · 목록(-, 1.) 한 단계 들여쓰기까지 · 소제목(#~###, ####) · 표(| a | b | + |---|---|) · 인용(>) ·
//           강조 상자(> [!참고] · [!중요] · [!주의] · [!도움말] · [!예시]) · 가로줄(---) · 코드 울타리(```)
//           줄 안: **굵게** · *기울임* · ~~지움~~ · `코드` · [링크](https://…) · https://… 주소 · <br>
// 그리지 않는 것(mdIssues가 알림): HTML 태그 · 그림(![]()) · 각주([^1]) · 체크 상자(- [ ])

/** 강조 상자 종류와 화면에 보이는 이름 */
export const CALLOUTS = { note: '참고', tip: '도움말', important: '중요', warning: '주의', example: '예시' };
const CALLOUT_ALIAS = { note: 'note', info: 'note', 참고: 'note', 안내: 'note', tip: 'tip', 도움말: 'tip', 팁: 'tip', important: 'important', 중요: 'important', 핵심: 'important', warning: 'warning', caution: 'warning', 주의: 'warning', 유의: 'warning', example: 'example', 예시: 'example', 예시문: 'example', 서식: 'example', 예: 'example' };

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^\s{0,3}(#{1,6})[^\S\n]+(.*)$/; // 끝의 # 떼기는 headingText에서(정규식으로 하면 빈칸이 길 때 느려짐)
/** 소제목 글: 끝 빈칸과, 빈칸 뒤에 붙은 닫는 #을 뗀다("C#"의 #은 그대로) */
function headingText(s) {
  const t = s.trimEnd();
  let j = t.length;
  while (j > 0 && t[j - 1] === '#') j--;
  const cut = j < t.length && (j === 0 || /\s/.test(t[j - 1])) ? t.slice(0, j).trimEnd() : t;
  return cut || t;
}
const HR = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const LIST = /^(\s*)(?:([-*+•·▪◦])|(\d{1,3})[.)])\s+(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const CALLOUT_HEAD = /^\[!\s*([A-Za-z가-힣]{1,10})\s*\]\s*(.*)$/;
const CITE = /^(?:—|―|–|--)\s*(.+)$/;

/** 표의 한 줄 → 칸 목록(\| 는 글자 그대로) */
export function splitRow(line) {
  let s = String(line).trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
}
const isTableStart = (lines, i) => TABLE_ROW.test(lines[i]) || (lines[i].includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes('-') && lines[i + 1].includes('|'));

/**
 * 글을 블록으로 나눔.
 * @returns {Array<{type:'p',lines:string[]}|{type:'h',level:number,text:string}|{type:'ul'|'ol',items:{text:string,sub:string[]}[]}
 *   |{type:'table',head:string[],rows:string[][]}|{type:'quote',lines:string[],cite:string}|{type:'callout',kind:string,title:string,lines:string[]}
 *   |{type:'code',text:string}|{type:'hr'}>}
 */
export function parseBlocks(src) {
  const lines = String(src ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [];
  const flush = () => { if (para.length) { out.push({ type: 'p', lines: para }); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { flush(); continue; }
    if (FENCE.test(line)) {
      flush();
      const mark = FENCE.exec(line)[1]; const body = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith(mark); i++) body.push(lines[i]);
      if (body.join('').trim()) out.push({ type: 'code', text: body.join('\n') });
      continue;
    }
    const h = HEADING.exec(line);
    const ht = h && headingText(h[2]);
    if (ht) { flush(); out.push({ type: 'h', level: h[1].length, text: ht }); continue; }
    if (isTableStart(lines, i)) {
      flush();
      const rows = []; let sepAt = -1;
      for (; i < lines.length && lines[i].trim() && (lines[i].includes('|')); i++) {
        if (TABLE_SEP.test(lines[i]) && lines[i].includes('-')) { if (sepAt < 0) sepAt = rows.length; continue; }
        rows.push(splitRow(lines[i]));
      }
      i--;
      const n = Math.max(0, ...rows.map((r) => r.length));
      const fill = (r) => Array.from({ length: n }, (_, k) => r[k] ?? '');
      // 구분 줄(|---|)이 첫 줄 뒤에 있으면 첫 줄이 머리글. 구분 줄이 없어도 두 줄 이상이면 첫 줄을 머리글로 봄
      const hasHead = sepAt === 1 || (sepAt < 0 && rows.length >= 2);
      if (rows.length) out.push({ type: 'table', head: hasHead ? fill(rows[0]) : [], rows: rows.slice(hasHead ? 1 : 0).map(fill) });
      continue;
    }
    if (HR.test(line)) { flush(); out.push({ type: 'hr' }); continue; }
    const q = QUOTE.exec(line);
    if (q) {
      flush();
      const body = [];
      for (; i < lines.length; i++) { const m = QUOTE.exec(lines[i]); if (!m) break; body.push(m[1].replace(/^>+\s?/, '')); }
      i--;
      while (body.length && !body[0].trim()) body.shift();
      while (body.length && !body[body.length - 1].trim()) body.pop();
      if (!body.length) continue;
      const c = CALLOUT_HEAD.exec(body[0].trim());
      if (c) {
        const kind = CALLOUT_ALIAS[c[1].toLowerCase()] || CALLOUT_ALIAS[c[1]] || 'note';
        out.push({ type: 'callout', kind, title: c[2].trim(), lines: body.slice(1) });
      } else {
        let cite = '';
        const last = CITE.exec(body[body.length - 1].trim());
        if (last && body.length > 1) { cite = last[1].trim(); body.pop(); }
        out.push({ type: 'quote', lines: body, cite });
      }
      continue;
    }
    const l = LIST.exec(line);
    if (l) {
      flush();
      const ordered = !!l[3]; const base = l[1].length; const items = [];
      for (; i < lines.length; i++) {
        const m = LIST.exec(lines[i]);
        if (m) {
          if (m[1].length >= base + 2 && items.length) items[items.length - 1].sub.push(m[4]);
          else if (!!m[3] === ordered || m[1].length > base) items.push({ text: m[4], sub: [] });
          else break;
        } else if (lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && items.length) {
          // 들여쓴 이어지는 줄은 앞 항목에 붙임
          const it = items[items.length - 1];
          if (it.sub.length) it.sub[it.sub.length - 1] += '\n' + lines[i].trim(); else it.text += '\n' + lines[i].trim();
        } else break;
      }
      i--;
      out.push({ type: ordered ? 'ol' : 'ul', items });
      continue;
    }
    para.push(line);
  }
  flush();
  return out;
}

const ISSUES = [
  ['html', /<\/?(?!br\s*\/?>)[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?>/, 'HTML 태그는 글자 그대로 보여요. 태그를 빼 주세요.'],
  ['image', /!\[[^\]]*\]\([^)]*\)/, '그림(![…](…))은 글 칸에서 그리지 않아요. 사진 칸(gallery)에 넣어 주세요.'],
  ['footnote', /\[\^[^\]\s]{1,20}\]/, '각주([^1])는 그리지 않아요. 문장 안에 풀어 써 주세요.'],
  ['task', /^\s*[-*]\s+\[[ xX]\]\s/m, '체크 상자(- [ ])는 그리지 않아요. 준비 점검 칸(readiness)을 써 주세요.'],
];
/** 그리지 못하는 문법 목록 [{ code, message_ko }] (코드 울타리 안은 보지 않음) */
export function mdIssues(src) {
  const text = String(src ?? '').replace(/(```|~~~)[\s\S]*?(\1|$)/g, '').replace(/`[^`\n]*`/g, '');
  return ISSUES.filter(([, re]) => re.test(text)).map(([code, , message_ko]) => ({ code, message_ko }));
}
