// 새 배포 뒤 열린 탭: 예전 해시 조각(…-abc12345.js)이 서버에서 사라져 동적 import가 실패하는 것을 한곳에서 받습니다.
// - 새 버전이면 '새 버전이 나왔어요 [새로 고침]'. 처음 한 번은 이 탭에서 저절로 새로 고침(sessionStorage에 적어 두 번은 안 함 → 무한 새로 고침 없음)
// - '인터넷 연결 확인'은 진짜 망 오류(오프라인·서버에 닿지 않음)일 때만
// 판별: 오프라인이면 망. 아니면 지금 서버의 index.html을 캐시 없이 받아 첫 화면 조각(index-해시.js)이 바뀌었는지 보고,
// 같으면 실패한 조각 주소를 HEAD로 물어 404면 새 버전(파일이 지워짐), 그 밖은 망(잠깐 끊김)
// 쓰는 곳: main.jsx(vite:preloadError · 화면 조각 Lazy · 띠), Start.jsx(교재 읽기·초안), AiPanel.jsx(프롬프트를 만들 교재 도구)
import { useEffect, useState } from 'preact/hooks';

const KEY = 'lecpage:fresh'; // { at, files } 이 탭에서 저절로 새로 고친 적 있음 · noted: 새로 고친 뒤 알림을 보였음
const CHUNK = /dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading (CSS )?chunk|ChunkLoadError|module script/i;

/** 동적 import(조각 받기)가 실패한 오류인지 */
export const isChunkError = (e) => !!e && CHUNK.test(String(e.message || e));

let checking = null; // 같은 때 여러 곳이 실패해도 서버에는 한 번만 물음
let stale = false; // 새 버전으로 판별됨(이 탭이 낡음)
let want = { files: false }; // 저절로 새로 고칠 때 함께 적을 것(고르던 교재가 있었는지)
let reloading = null;
let bar = { on: false, files: false, inline: 0 };
const subs = new Set();
const emit = () => subs.forEach((f) => f({ ...bar }));

const entryNow = () => document.querySelector('script[type=module][src*="assets/index-"]')?.getAttribute('src') || '';

/** 'new'(새 버전이 나옴) | 'net'(망 오류) */
export function whyFailed(e) {
  if (stale) return Promise.resolve('new');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve('net');
  if (checking) return checking;
  checking = (async () => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    try {
      const html = await (await fetch(new URL('./', location.href), { cache: 'no-store', credentials: 'same-origin', signal: ctl.signal })).text();
      const now = entryNow(); const next = /assets\/index-[\w-]+\.js/.exec(html)?.[0];
      if (now && next && !now.endsWith(next)) return 'new';
      const u = /(https?:\/\/[^\s'"]+?\.(?:m?js|css))\b/.exec(String(e?.message || ''))?.[1];
      if (u && new URL(u).origin === location.origin) {
        const r = await fetch(u, { method: 'HEAD', cache: 'no-store', signal: ctl.signal });
        if (r.status === 404 || r.status === 410) return 'new';
      }
      return 'net';
    } catch { return 'net'; } finally { clearTimeout(t); }
  })().then((k) => { if (k === 'new') stale = true; checking = null; return k; });
  return checking;
}

/**
 * 조각 받기가 실패했을 때 부름 → 'reload'(저절로 새로 고치는 중) | 'new'(새 버전 띠를 보임) | 'net'(망 오류: 부른 쪽이 '인터넷 연결' 안내)
 * files: 고르던 교재가 있었음(새로 고치면 사라지므로 다시 고르라고 알림)
 */
export async function chunkFailed(e, { files = false } = {}) {
  const k = await whyFailed(e);
  if (k !== 'new') return 'net';
  want.files = want.files || files;
  if (!reloading) reloading = new Promise((done) => setTimeout(() => done(autoReload()), 60)); // 함께 실패한 곳의 files를 모은 뒤 한 번
  const r = await reloading;
  if (!r && files && !bar.files) { bar = { ...bar, files: true }; emit(); }
  return r ? 'reload' : 'new';
}

function autoReload() {
  let ok = false;
  try { if (!sessionStorage.getItem(KEY)) { sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), files: want.files })); ok = true; } } catch { ok = false; } // 적지 못하면 저절로 하지 않음
  if (ok) { location.reload(); return true; }
  bar = { ...bar, on: true, files: bar.files || want.files }; emit();
  return false;
}

/** 저절로 새로 고친 뒤 한 번 보일 알림('' = 없음) */
export function afterReloadNote() {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (!v || v.noted) return '';
    sessionStorage.setItem(KEY, JSON.stringify({ ...v, noted: true }));
    return v.files ? '새 버전으로 새로 고쳤어요. 고르던 교재 파일을 다시 골라 주세요.' : '새 버전으로 새로 고쳤어요.';
  } catch { return ''; }
}

/** 화면 안에서 직접 '새 버전' 안내를 그리는 곳(조각을 못 받은 화면)이 떠 있는 동안 아래 띠를 숨김 */
export function useInlineFresh(on) {
  useEffect(() => { if (!on) return undefined; bar = { ...bar, inline: bar.inline + 1 }; emit(); return () => { bar = { ...bar, inline: bar.inline - 1 }; emit(); }; }, [on]);
}

/** 새 버전 띠: 저절로 새로 고침을 이미 한 번 했으면 여기서 [새로 고침] */
export function FreshBar() {
  const [s, setS] = useState(bar);
  useEffect(() => { subs.add(setS); return () => subs.delete(setS); }, []);
  if (!s.on || s.inline > 0) return null;
  return (
    <div class="fresh-bar" role="alert">
      <span>새 버전이 나왔어요.{s.files ? ' 새로 고친 뒤 교재 파일을 다시 골라 주세요.' : ' 새로 고치면 이어서 할 수 있어요.'}</span>
      <button type="button" class="btn btn-sm btn-primary" onClick={() => location.reload()}>새로 고침</button>
    </div>
  );
}

/** 동적 import를 감싸 실패 까닭을 e.kind('reload'|'new'|'net')로 붙여 다시 던짐. 조각 실패가 아니면 그대로 */
export async function loadChunk(load, { files = false } = {}) {
  try { return await load(); } catch (e) {
    if (isChunkError(e)) e.kind = await chunkFailed(e, { files });
    throw e;
  }
}
