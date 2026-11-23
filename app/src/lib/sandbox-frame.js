// 격리 틀(public/frame/index.html): 앱이 만든 한 장 HTML을 돌리는 sandbox 틀의 주소와 메시지 규약.
// 예전에는 <iframe srcdoc>에 바로 넣었는데, srcdoc 틀은 앱의 CSP를 물려받아 앱이 인라인 스크립트('unsafe-inline')를 허용해야 했음.
// 이제는 틀 문서(자체 CSP)를 주소로 열고, 그 문서가 받은 HTML을 안쪽 srcdoc 틀에 넣음 → 안쪽 문서는 예전과 같은 처지(about:srcdoc·출처 없음),
// 앱 CSP에서는 인라인 스크립트를 뺌. 틀은 늘 sandbox(allow-same-origin 없음)로 열 것: 틀 문서가 출처 없는 틀 안에서만 돎.
//   틀 → 앱: { lpFrame: 'ready' } 준비됨 · { lpFrame: 'load' } 안쪽 문서를 다 읽음 · { lpFrame: 'msg', data } 안쪽 문서가 parent에 보낸 것
//   앱 → 틀: { lpFrame: 'html', html, allow, title, scheme } 안쪽 문서 넣기(바꾸기) · { lpFrame: 'scheme', scheme } 밝게·어둡게가 바뀜 · 그 밖의 메시지는 안쪽 문서로 그대로 넘어감
/* global __LP_FRAME_VER__ */
const VER = typeof __LP_FRAME_VER__ === 'string' ? __LP_FRAME_VER__ : '';
/** 틀 주소(앱 주소 기준 상대). 개발 서버는 폴더 주소를 public에서 찾지 않아 파일 이름까지. v: 틀 문서가 바뀌면 달라짐(오래 캐시해도 새 판을 받게) */
const FRAME_PATH = import.meta.env?.DEV ? 'frame/index.html' : 'frame/';
export const FRAME_SRC = FRAME_PATH + (VER ? `?v=${VER}` : '');

// 앱 쪽 틀(iframe 요소)의 밝게·어둡게(color-scheme)를 틀 문서에 알려 같게 둠: 다르면 브라우저가 틀에 불투명한 바탕을 깔아
// 예전(앱 틀에 바로 넣던 때)과 바탕이 달라짐. 앱이 자동(OS 설정)일 때 OS가 바뀌면 열려 있는 틀에 다시 알림
const schemeOf = (el) => { try { const v = getComputedStyle(el).colorScheme; return v === 'light' || v === 'dark' ? v : ''; } catch { return ''; } };
try {
  if (typeof matchMedia === 'function') matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    for (const el of document.querySelectorAll('iframe')) if ((el.getAttribute('src') || '').startsWith(FRAME_PATH)) { try { el.contentWindow?.postMessage({ lpFrame: 'scheme', scheme: schemeOf(el) }, '*'); } catch { /* 넘김 */ } }
  });
} catch { /* 예전 브라우저 */ }

/**
 * 틀에서 온 메시지 풀기. el: 그 틀(iframe). 그 틀이 보낸 것이 아니면 null
 * @returns {{ kind: 'ready' | 'load' } | { kind: 'msg', data: any } | null}
 */
export function frameEvent(e, el) {
  if (!el || e.source !== el.contentWindow) return null;
  const m = e.data;
  if (!m || typeof m !== 'object') return null;
  if (m.lpFrame === 'ready' || m.lpFrame === 'load') return { kind: m.lpFrame };
  if (m.lpFrame === 'msg') return { kind: 'msg', data: m.data };
  return null;
}
/** 틀에 HTML 넣기(준비됐다는 신호 'ready'를 받은 뒤에). allow: 안쪽 틀에 줄 권한(예: clipboard-write), title: 안쪽 틀 이름 */
export function sendHtml(el, html, { allow = '', title = '' } = {}) {
  try { el?.contentWindow?.postMessage({ lpFrame: 'html', html, allow, title, scheme: schemeOf(el) }, '*'); } catch { /* 틀이 사라짐 */ }
}
/** 안쪽 문서에 메시지 보내기(틀이 그대로 넘김). transfer: 넘길 ArrayBuffer */
export function postInner(el, msg, transfer) {
  try { el?.contentWindow?.postMessage(msg, '*', transfer || []); } catch { /* 틀이 사라짐 */ }
}

// 준비됐다고 알린 틀 창(나중에 HTML을 바꿀 때 바로 보내도 되는지)
const readyWins = new WeakSet();
/**
 * 틀에 HTML을 넣어 둠: 틀이 준비되면(다시 읽혀도) 보냄. 이미 준비된 틀이면 바로 보냄(HTML 바꾸기).
 * 틀을 붙인 바로 뒤(같은 작업 안)에 부를 것. 되돌려 주는 함수로 그만둠
 */
export function feedFrame(el, html, opts) {
  const f = (e) => { if (e.source === el.contentWindow && e.data?.lpFrame === 'ready') { readyWins.add(e.source); sendHtml(el, html, opts); } };
  addEventListener('message', f);
  if (el.contentWindow && readyWins.has(el.contentWindow)) sendHtml(el, html, opts);
  return () => removeEventListener('message', f);
}
