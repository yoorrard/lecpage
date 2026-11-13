// 운영자 공지: 앱이 켜진 뒤 한가할 때 받아(첫 화면 JS에 들지 않음) 한 번만 보여 줍니다.
// 바로 공개 서버가 있으면 GET <서버>/api/notice?for=app, 없으면 앱 배포 안의 notice.json.
// 공지는 글자로만 그립니다(HTML로 해석하지 않음). 링크는 https 주소만, 가는 곳의 주소를 함께 보여 줍니다.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import './NoticeBar.css';

const API = String(import.meta.env?.VITE_PUBLISH_API || '').replace(/\/+$/, '');
const SEEN_KEY = 'lecpage:notice-seen';
const LIMITS = { id: 60, title: 60, body: 400, linkLabel: 20 };
const INVISIBLE = /[\u0000-\u0008\u000B-\u001F\u007F\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g; // 지울 때(제어 문자·보이지 않는 글자·방향 바꿈 글자)
const HAS_INVISIBLE = /[\u0000-\u0008\u000B-\u001F\u007F\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/; // 있는지 볼 때

/** https 주소만(계정·포트·IP 주소 없이). 아니면 '' */
export function safeLink(v) {
  const raw = typeof v === 'string' ? v.trim() : '';
  if (!raw || raw.length > 300 || /[\s\\]/.test(raw) || HAS_INVISIBLE.test(raw)) return '';
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || !u.hostname.includes('.') || /^[\d.]+$/.test(u.hostname) || u.hostname.startsWith('[')) return '';
    return u.href;
  } catch { return ''; }
}
const text = (v, max) => (typeof v === 'string' ? v.replace(INVISIBLE, '').trim().slice(0, max) : '');

/** 받은 목록 → 보여 줄 수 있는 공지만(모양이 틀리거나 끝난 것은 뺌) */
export function cleanNotices(list, now = Date.now()) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const n of list.slice(0, 5)) {
    if (!n || typeof n !== 'object') continue;
    const id = text(n.id, LIMITS.id); const title = text(n.title, LIMITS.title); const body = text(n.body, LIMITS.body);
    if (!id || !title || !body) continue;
    const ends = typeof n.ends === 'number' ? n.ends : typeof n.ends === 'string' ? Date.parse(n.ends) : NaN;
    if (Number.isFinite(ends) && ends <= now) continue;
    const link = safeLink(n.link);
    out.push({ id, title, body, link, linkLabel: link ? text(n.linkLabel, LIMITS.linkLabel) || '자세히 보기' : '', linkHost: link ? new URL(link).hostname : '' });
  }
  return out;
}

function seen() { try { const v = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } }
function markSeen(id) { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen().filter((x) => x !== id), id].slice(-50))); } catch { /* 못 적으면 다음에 한 번 더 보임 */ } }

export async function fetchNotices() {
  const url = API ? `${API}/api/notice?for=app` : './notice.json';
  const r = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', cache: API ? 'default' : 'no-cache' });
  if (!r.ok) return [];
  const j = await r.json();
  return cleanNotices(j?.notices);
}

function NoticeBar({ notice, onClose }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const close = () => { setOpen(false); onClose?.(); };
  return (
    <aside class="lp-notice" role="region" aria-label="운영자 공지">
      <div class="lp-notice-in">
        <p class="lp-notice-k">공지</p>
        <h2 class="lp-notice-t">{notice.title}</h2>
        <p class="lp-notice-b">{notice.body}</p>
        {notice.link && <p class="lp-notice-l"><a href={notice.link} target="_blank" rel="noopener noreferrer">{notice.linkLabel}</a> <span>({notice.linkHost})</span></p>}
      </div>
      <button type="button" class="btn btn-sm lp-notice-x" onClick={close}>닫기</button>
    </aside>
  );
}

/** 보여 줄 공지가 있으면 하나(가장 새것)를 띄우고 본 것으로 적어 둠. 다음에 앱을 열 때는 다시 띄우지 않음 */
export async function showNotice() {
  let list = [];
  try { list = await fetchNotices(); } catch { return; }
  const done = new Set(seen());
  const n = list.find((x) => !done.has(x.id));
  if (!n) return;
  markSeen(n.id);
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(<NoticeBar notice={n} onClose={() => { render(null, host); host.remove(); }} />, host);
}
