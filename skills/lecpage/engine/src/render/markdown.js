// 제한된 마크다운 → HTML. 글 칸(text)·FAQ 답·표 칸의 칸 글이 함께 씁니다. 문법은 ../md-syntax.js.
// 원칙: 참가자 화면에 |---|, >, **, ``` 같은 기호가 그대로 보이지 않게 한다. 모르는 문법은 글자만 남긴다.
import { safeUrl } from '../validate.js';
import { parseBlocks, CALLOUTS } from '../md-syntax.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const linkAttrs = (u) => `href="${esc(u)}"${/^https?:/i.test(u) ? ' target="_blank" rel="noopener noreferrer"' : ''}`;
const COPY_ICON = '<svg class="lp-ic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>';

/** 줄 안 문법. 먼저 이스케이프하고, 그 위에서만 태그를 만든다 */
export function inlineMd(s) {
  const keep = [];
  const hold = (html) => { keep.push(html); return `\u0000${keep.length - 1}\u0000`; };
  let out = esc(String(s ?? '').replace(/\u0000/g, '').replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')); // 그림은 대체 글만
  out = out.replace(/&lt;br\s*\/?&gt;/gi, '\n');
  out = out.replace(/`([^`\n]+)`/g, (m, c) => hold(`<code>${c}</code>`));
  out = out.replace(/\[([^\]\n\u0000]+)\]\(([^)\s\u0000]+)\)/g, (m, t, u) => {
    const ok = safeUrl(u.replace(/&amp;/g, '&'));
    return ok ? hold(`<a ${linkAttrs(ok)}>`) + t + hold('</a>') : t;
  });
  // 주소만 적은 곳도 누를 수 있게(문장 끝 마침표·괄호는 빼고)
  out = out.replace(/(^|[\s(（])(https?:\/\/[^\s<>"'）)\u0000]+[^\s<>"'）).,!?:;\u0000])/g, (m, pre, u) => {
    const ok = safeUrl(u.replace(/&amp;/g, '&'));
    return ok ? pre + hold(`<a ${linkAttrs(ok)}>${u}</a>`) : m;
  });
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/~~([^~\n]+)~~/g, '<s>$1</s>');
  out = out.replace(/\[\^[^\]\s]{1,20}\]/g, ''); // 각주 표시는 뺌
  out = out.replace(/\n/g, '<br>');
  return out.replace(/\u0000(\d+)\u0000/g, (m, i) => keep[+i]);
}

/**
 * 표: 머리글 + 줄. 휴대폰에서는 칸이 4개 이하면 줄마다 카드(머리글이 칸마다 이름표로), 5개 이상이면 가로로 미는 상자.
 * display를 바꿔도 표로 읽히게 role을 직접 적고, 카드용 이름표는 낭독기에 숨김(머리글 칸이 이미 이어져 있음).
 */
export function tableHtml({ head = [], rows = [], label = '' } = {}) {
  const n = Math.max(head.length, 0, ...rows.map((r) => r.length));
  if (!n || !rows.length) return '';
  const cell = (r, k) => String(r[k] ?? '');
  const hasHead = head.some((h) => String(h).trim());
  // 첫 칸이 짧은 이름(구분·역할·학년도)이면 줄 머리로
  const rowHead = hasHead && n >= 2 && rows.every((r) => cell(r, 0).trim() && cell(r, 0).length <= 30);
  const mode = n <= 4 ? 'cards' : 'scroll';
  const k = (i) => (hasHead && String(head[i] ?? '').trim() ? `<span class="lp-tbl-k" aria-hidden="true">${inlineMd(head[i])}</span>` : '');
  const thead = hasHead ? `<thead role="rowgroup"><tr role="row">${Array.from({ length: n }, (_, i) => `<th role="columnheader" scope="col">${inlineMd(head[i] ?? '')}</th>`).join('')}</tr></thead>` : '';
  const body = rows.map((r) => `<tr role="row">${Array.from({ length: n }, (_, i) => {
    const v = inlineMd(cell(r, i));
    return i === 0 && rowHead ? `<th role="rowheader" scope="row">${v}</th>` : `<td role="cell"${cell(r, i).trim() ? '' : ' data-empty'}>${k(i)}<span class="lp-tbl-v">${v}</span></td>`;
  }).join('')}</tr>`).join('');
  const region = mode === 'scroll' ? ` role="region" aria-label="${esc(label || '표')}" tabindex="0"` : '';
  return `<div class="lp-tbl-wrap" data-mode="${mode}" style="--cols:${n}"${region}><table class="lp-tbl" role="table"${label ? ` aria-label="${esc(label)}"` : ''}>${thead}<tbody role="rowgroup">${body}</tbody></table></div>`;
}

const listHtml = (b) => `<${b.type}>${b.items.map((it) => `<li>${inlineMd(it.text)}${it.sub.length ? `<ul>${it.sub.map((x) => `<li>${inlineMd(x)}</li>`).join('')}</ul>` : ''}</li>`).join('')}</${b.type}>`;

/** 강조 상자. 예시(example)는 복사 버튼이 붙음 */
export function calloutHtml({ kind = 'note', title = '', lines = [] }) {
  const text = lines.join('\n').trim();
  const name = CALLOUTS[kind] || CALLOUTS.note;
  const copy = kind === 'example' && text ? `<button class="lp-btn lp-btn-sm lp-btn-ghost lp-callout-copy" type="button" data-copy-text="${esc(text)}">${COPY_ICON}<span>복사</span></button>` : '';
  return `<div class="lp-callout" data-kind="${esc(kind)}" role="note"><p class="lp-callout-h"><b>${esc(name)}</b>${title ? `<span>${inlineMd(title)}</span>` : ''}${copy}</p>${text ? `<div class="lp-callout-b">${md(text)}</div>` : ''}</div>`;
}

/** 인용: 본문 + 출처(— 이름) */
export function quoteHtml({ lines = [], cite = '' }) {
  return `<blockquote class="lp-bq"><p>${inlineMd(lines.join('\n').replace(/^[“"]|[”"]$/g, '').trim())}</p>${cite ? `<cite>${inlineMd(cite)}</cite>` : ''}</blockquote>`;
}

/** 제한된 마크다운 → HTML 블록들 */
export function md(src) {
  return parseBlocks(src).map((b) => {
    if (b.type === 'p') return `<p>${inlineMd(b.lines.join('\n'))}</p>`;
    if (b.type === 'h') return b.level <= 3 ? `<h3>${inlineMd(b.text)}</h3>` : `<h4>${inlineMd(b.text)}</h4>`;
    if (b.type === 'ul' || b.type === 'ol') return listHtml(b);
    if (b.type === 'table') return tableHtml(b);
    if (b.type === 'quote') return quoteHtml(b);
    if (b.type === 'callout') return calloutHtml(b);
    if (b.type === 'code') return `<pre class="lp-pre"><code>${esc(b.text)}</code></pre>`;
    if (b.type === 'hr') return '<hr>';
    return '';
  }).filter(Boolean).join('\n');
}
