// 팝업 공지: 운영자가 관리 화면에서 쓰고, 앱(GET /api/notice)과 공개 사이트의 강사 화면(console.html)이 보여 줌.
// 공지는 글자만입니다. 어디서든 HTML로 해석하지 않고(앱은 Preact 글자, 강사 화면은 서버가 이스케이프), 링크는 https 주소 하나만.

export const NOTICE_TARGETS = ['app', 'teacher'];
export const NOTICE_LIMITS = { title: 60, body: 400, lines: 8, link: 300, linkLabel: 20, maxDays: 90, active: 3 };

/** 제어 문자·보이지 않는 글자·방향 바꿈 글자(주소·글을 거꾸로 보이게 하는 데 씀)를 뺌. 줄바꿈은 lines가 참일 때만 둠 */
export function cleanText(v, { lines = false } = {}) {
  let s = String(v ?? '').normalize('NFC');
  s = s.replace(/[​-‏‪-‮⁠-⁩­﻿]/g, '');
  s = lines ? s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ') : s.replace(/[\u0000-\u001F\u007F]/g, ' ');
  return lines ? s.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim() : s.replace(/\s+/g, ' ').trim();
}

/**
 * 공지 링크: https만, 계정·포트·IP 주소·보이지 않는 글자 없이. 허용 호스트 목록이 있으면 그 호스트(와 하위 도메인)만.
 * @returns {string} 정리한 주소, 안 되면 ''
 */
export function safeLink(v, allowHosts = []) {
  const raw = String(v ?? '').trim();
  if (!raw || raw.length > NOTICE_LIMITS.link || /[\s\u0000-\u001F\u007F­​-‏‪-‮⁠-⁩﻿\\]/.test(raw)) return '';
  let u;
  try { u = new URL(raw); } catch { return ''; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return '';
  const h = u.hostname.toLowerCase();
  if (!h.includes('.') || /^[\d.]+$/.test(h) || h.startsWith('[') || /^(localhost|.*\.local|.*\.internal)$/.test(h)) return '';
  if (allowHosts.length && !allowHosts.some((a) => h === a || h.endsWith(`.${a}`))) return '';
  return u.href;
}

/**
 * 관리 화면이 보낸 공지 → 저장할 값. 틀리면 { error }.
 * @param {object} b { title, body, link?, linkLabel?, targets: ['app'|'teacher'], starts?, ends?, active? }
 * @param {{ now?: number, allowHosts?: string[] }} o
 */
export function checkNotice(b, { now = Date.now(), allowHosts = [] } = {}) {
  if (!b || typeof b !== 'object') return { error: '공지 내용을 보내 주세요.' };
  const L = NOTICE_LIMITS;
  const title = cleanText(b.title);
  const body = cleanText(b.body, { lines: true });
  if (!title) return { error: '제목을 적어 주세요.' };
  if (title.length > L.title) return { error: `제목은 ${L.title}자까지예요.` };
  if (!body) return { error: '본문을 적어 주세요.' };
  if (body.length > L.body) return { error: `본문은 ${L.body}자까지예요.` };
  if (body.split('\n').length > L.lines) return { error: `본문은 ${L.lines}줄까지예요.` };
  let link = '';
  if (b.link != null && String(b.link).trim()) {
    link = safeLink(b.link, allowHosts);
    if (!link) return { error: allowHosts.length ? `링크는 https 주소이고, 허용한 곳(${allowHosts.join(', ')})이어야 해요.` : '링크는 https:// 로 시작하는 주소만 돼요(IP 주소·계정이 든 주소는 안 돼요).' };
  }
  const linkLabel = link ? cleanText(b.linkLabel).slice(0, L.linkLabel) || '자세히 보기' : '';
  const targets = Array.isArray(b.targets) ? [...new Set(b.targets.filter((t) => NOTICE_TARGETS.includes(t)))] : [];
  if (!targets.length) return { error: '보여 줄 곳(앱, 강사 화면)을 하나 이상 골라 주세요.' };
  const starts = Number.isFinite(b.starts) && b.starts > 0 ? Math.round(b.starts) : now;
  const ends = Number.isFinite(b.ends) && b.ends > 0 ? Math.round(b.ends) : starts + 7 * 864e5;
  if (ends <= starts) return { error: '끝나는 때가 시작보다 뒤여야 해요.' };
  if (ends - starts > L.maxDays * 864e5) return { error: `공지는 ${L.maxDays}일까지 걸 수 있어요.` };
  if (ends <= now) return { error: '끝나는 때가 이미 지났어요.' };
  return { value: { title, body, link, linkLabel, targets, starts, ends, active: b.active !== false } };
}

/** 저장된 줄 → 밖으로 내보낼 모양(앱·강사 화면). 운영자가 적은 것 말고는 내보내지 않음 */
export function publicNotice(row) {
  const out = { id: `n${row.id}-${row.rev}`, title: row.title, body: row.body, ends: row.ends };
  if (row.link) { out.link = row.link; out.linkLabel = row.link_label || '자세히 보기'; try { out.linkHost = new URL(row.link).hostname; } catch { /* 저장 때 확인함 */ } }
  return out;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * 강사 화면(console.html) 맨 위에 붙이는 공지 띠. 스크립트 없이 <details>로 접고 펼침. 글자는 모두 이스케이프.
 * @param {ReturnType<typeof publicNotice>[]} list
 */
export function noticeBandHtml(list) {
  if (!list?.length) return '';
  const items = list.map((n) => {
    const link = n.link ? ` <a href="${esc(n.link)}" target="_blank" rel="noopener noreferrer" style="color:inherit;font-weight:700">${esc(n.linkLabel)}</a> <span style="opacity:.7">(${esc(n.linkHost || '')})</span>` : '';
    return `<details open data-host-notice style="margin:0;padding:10px 16px;border-bottom:1px solid rgba(127,127,127,.35);background:#fff7d6;color:#3d3000;font:14px/1.55 system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;word-break:keep-all"><summary style="cursor:pointer;font-weight:700">운영자 공지: ${esc(n.title)}</summary><p style="margin:.35rem 0 0;white-space:pre-line">${esc(n.body)}</p>${link ? `<p style="margin:.35rem 0 0">${link}</p>` : ''}</details>`;
  }).join('');
  return `<div data-host-notice role="note" aria-label="운영자 공지"><style>@media print{[data-host-notice]{display:none}}@media (prefers-color-scheme:dark){details[data-host-notice]{background:#3a3112!important;color:#fff3c4!important}}</style>${items}</div>`;
}
