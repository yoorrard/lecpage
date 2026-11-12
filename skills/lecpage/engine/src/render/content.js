// 본문을 담는 칸: 절차(procedure) · 사례(cases) · 함께 나눌 질문(discuss) · 표(table) · 글(text).
// 실습형이 아닌 교재(절차·규정, 사례·토론, 과정 안내, 설명회)의 본문이 이 칸들로 실립니다.
// sections.js와는 contentRenderers({ wrap, head })로만 이어집니다(새 칸을 더할 때 sections.js를 고치지 않게).
//
// 연출(디자인 쪽이 이어받을 자리): 지금은 섹션 진입(section.enter)만 붙습니다.
//   항목 진입·호버를 달려면 .lp-proc > li · .lp-case · .lp-discuss-q > li · .lp-tbl tbody tr 에 itemFx(ctx)(카드 효과 슬롯)를 달면 됩니다.
//   프리셋별 변형은 runtime/lecpage.css 끝의 '본문 칸' 묶음을 [data-preset]·[data-card]로 덮어쓰면 됩니다.
import { esc, br, pad2 } from './html.js';
import { md, tableHtml, inlineMd } from './markdown.js';

/** 배치 이름(data-layout). 같은 배치가 줄지어 나오지 않게 칸마다 다름 */
export const CONTENT_LAYOUTS = { procedure: 'procedure', cases: 'cases', discuss: 'discuss', table: 'table', text: 'prose' };

const CONTENT_TYPES = Object.keys(CONTENT_LAYOUTS);
/** 틀(data-frame): 절차는 머리 왼쪽·단계 오른쪽(split). 글은 제목이 있으면 split, 글 칸이 이어지면 한 칸 걸러 stack */
function frameFor(s, ctx) {
  if (s.type === 'procedure') return 'split';
  if (s.type !== 'text' || !s.title) return 'stack';
  const list = ctx.bp.sections; const i = list.indexOf(s);
  let run = 0; for (let k = i - 1; k >= 0 && list[k].type === 'text' && list[k].title; k--) run++;
  return run % 2 ? 'stack' : 'split';
}

export function contentRenderers({ wrap, head }) {
  const framed = (s, ctx, inner, attrs = '') => {
    const html = wrap(s, ctx, inner, attrs); const f = frameFor(s, ctx);
    return f === 'stack' ? html : html.replace('data-frame="stack"', `data-frame="${f}"`);
  };

  /** 절차: 번호 단계. 단계마다 시간·담당(있을 때만) */
  function procedure(s, ctx) {
    const rows = s.items.map((i, n) => {
      const meta = [i.time && `<span><span class="lp-sr">시간 </span>${esc(i.time)}</span>`, i.who && `<span><span class="lp-sr">담당 </span>${esc(i.who)}</span>`].filter(Boolean).join('');
      return `<li style="--i:${n}"><span class="lp-proc-no" aria-hidden="true">${pad2(n + 1)}</span><div class="lp-proc-b"><h3>${esc(i.title)}</h3>${i.desc ? `<p>${br(i.desc)}</p>` : ''}</div>${meta ? `<p class="lp-proc-meta">${meta}</p>` : ''}</li>`;
    }).join('');
    return framed(s, ctx, head(s, ctx, '절차') + `<ol class="lp-proc" style="--n:${s.items.length}">${rows}</ol>${s.close ? `<p class="lp-note">${br(s.close)}</p>` : ''}`);
  }

  /** 사례: 제목 · 본문 · 인용(따옴표는 꾸밈으로 붙이므로 값에서는 뗌) */
  function cases(s, ctx) {
    const one = s.items.length === 1;
    const items = s.items.map((c, n) => `<article class="lp-case">${one ? '' : `<p class="lp-case-k" aria-hidden="true">${pad2(n + 1)}</p>`}<div class="lp-case-b">${c.title ? `<h3>${esc(c.title)}</h3>` : ''}${c.body ? `<p>${br(c.body)}</p>` : ''}${c.quote ? `<blockquote class="lp-bq"><p>${br(c.quote.replace(/^[“"‘']|[”"’']$/g, ''))}</p>${c.cite ? `<cite>${esc(c.cite)}</cite>` : ''}</blockquote>` : ''}</div></article>`).join('');
    return framed(s, ctx, head(s, ctx, '사례') + `<div class="lp-cases" style="--n:${s.items.length}">${items}</div>`);
  }

  /** 함께 나눌 질문: 큰 번호가 붙은 질문 목록 + 진행 규칙 */
  function discuss(s, ctx) {
    const rules = s.rules.length ? `<div class="lp-discuss-rules"><h3>진행 규칙</h3><ul>${s.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>` : '';
    return framed(s, ctx, head(s, ctx, '함께 나눌 질문') + `<div class="lp-discuss${rules ? '' : ' is-solo'}"><ol class="lp-discuss-q" style="--n:${s.items.length}">${s.items.map((q, n) => `<li><span class="lp-discuss-no" aria-hidden="true">${n + 1}</span><p>${esc(q)}</p></li>`).join('')}</ol>${rules}</div>${s.note ? `<p class="lp-note">${br(s.note)}</p>` : ''}`);
  }

  /** 표: 머리글 + 줄, 아래 설명 */
  function table(s, ctx) {
    return framed(s, ctx, head(s, ctx) + tableHtml({ head: s.head, rows: s.rows, label: s.title || '표' }) + (s.note ? `<p class="lp-note">${inlineMd(s.note)}</p>` : ''));
  }

  /** 글: 제한된 마크다운(문단·목록·표·인용·강조 상자) */
  function text(s, ctx) { return framed(s, ctx, head(s, ctx) + `<div class="lp-prose">${md(s.md)}</div>`); }

  return { procedure, cases, discuss, table, text };
}

export { CONTENT_TYPES };
