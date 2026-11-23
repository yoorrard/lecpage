// 그려서 검사: 화면 밖 숨은 틀(sandbox="allow-scripts", 같은 출처 아님)에 조립한 사이트를 넣고 폭마다(1280·390)
// 엔진의 inspectRenderedScript가 부모 창에 { type:'lp-inspect', id, width, issues }를 보내면 받음. 틀 안 코드는 앱 저장소에 닿지 못함.
// 틀은 격리 틀(public/frame/, ../sandbox-frame.js): 틀 문서가 준비되면 사이트를 넣고, 안쪽 문서가 보낸 것은 틀이 넘겨 줌(앱 CSP에 인라인 스크립트가 없어도 돎)
import { previewHtml, inspectRenderedScript } from './kit.js';
import { FRAME_SRC, frameEvent, sendHtml, postInner } from '../sandbox-frame.js';
import { LATE_JS, lateFilesMsg } from '../late-files.js';

/**
 * files: 조립 결과(assemble().files). widths: 잴 폭들
 * @returns {Promise<issue[]>} (where.width 붙음) 틀을 못 만드는 곳(Node)이나 시간이 넘으면 그때까지 받은 것
 */
export function renderIssues(files, { widths = [1280, 390], timeout = 15000, page = 'index.html' } = {}) {
  if (typeof document === 'undefined' || !document.body) return Promise.resolve([]);
  return new Promise((resolve) => {
    const all = []; const frames = new Map(); const docs = new Map(); const late = new Map(); let left = widths.length; let done = false;
    const finish = () => { if (done) return; done = true; removeEventListener('message', onMsg); clearTimeout(t); for (const f of frames.values()) f.remove(); resolve(all); };
    const t = setTimeout(finish, timeout);
    function onMsg(e) {
      // 틀이 준비됨 → 그 틀의 사이트를 넣음
      for (const [id, f] of frames) {
        const ev = e.source === f.contentWindow ? frameEvent(e, f) : null;
        if (ev?.kind === 'ready') { sendHtml(f, docs.get(id), { title: 'lecpage-inspect' }); return; }
        // 안쪽 문서가 열림 → 한 장 HTML에 못 담은 그림을 넘김(없으면 깨진 그림으로 잘못 셈, ../late-files.js)
        if (ev?.kind === 'load') { if (late.get(id)) postInner(f, late.get(id)); return; }
      }
      const m = e.data && e.data.lpFrame === 'msg' ? e.data.data : null;
      const d = m && typeof m === 'object' ? m : {};
      if (d.type !== 'lp-inspect' || !frames.has(d.id) || e.source !== frames.get(d.id).contentWindow) return;
      for (const i of Array.isArray(d.issues) ? d.issues : []) if (i && typeof i.message_ko === 'string') all.push({ ...i, where: { ...(i.where || {}), width: i.where?.width || d.width } });
      frames.get(d.id).remove(); frames.delete(d.id);
      if (--left <= 0) finish();
    }
    addEventListener('message', onMsg);
    // 그림이 많아 한 장 HTML에 다 못 담는 사이트(8MB 넘음)는 따로 넘긴 그림이 열릴 때까지 조금 더 기다린 뒤 잼
    const imgs = Object.entries(files || {}).filter(([k, v]) => /\.(png|jpe?g|webp|gif|avif)$/i.test(k) && v && typeof v !== 'string');
    const heavy = imgs.reduce((n, [, v]) => n + (v.byteLength || v.size || 0), 0) > 8e6;
    const delay = heavy ? 600 + Math.min(5000, imgs.length * 12) : 600;
    for (const w of widths) {
      const id = 'lp-insp-' + w + '-' + Math.random().toString(36).slice(2, 8);
      const f = document.createElement('iframe');
      f.setAttribute('sandbox', 'allow-scripts');
      f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1; f.title = 'lecpage-inspect';
      f.style.cssText = `position:fixed;left:-30000px;top:0;width:${w}px;height:${w <= 480 ? 844 : 800}px;border:0;opacity:0;pointer-events:none`;
      const skipped = new Set();
      docs.set(id, previewHtml(files, page, { extraHead: LATE_JS, extraBody: inspectRenderedScript({ id, file: page, delay }), skipped }));
      late.set(id, lateFilesMsg(files, skipped));
      f.src = FRAME_SRC;
      frames.set(id, f);
      document.body.appendChild(f);
    }
  });
}
