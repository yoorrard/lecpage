// 그려서 검사: 화면 밖 숨은 틀(sandbox="allow-scripts", 같은 출처 아님)에 조립한 사이트를 넣고 폭마다(1280·390)
// 엔진의 inspectRenderedScript가 부모 창에 { type:'lp-inspect', id, width, issues }를 보내면 받음. 틀 안 코드는 앱 저장소에 닿지 못함.
import { previewHtml, inspectRenderedScript } from './kit.js';

/**
 * files: 조립 결과(assemble().files). widths: 잴 폭들
 * @returns {Promise<issue[]>} (where.width 붙음) 틀을 못 만드는 곳(Node)이나 시간이 넘으면 그때까지 받은 것
 */
export function renderIssues(files, { widths = [1280, 390], timeout = 15000, page = 'index.html' } = {}) {
  if (typeof document === 'undefined' || !document.body) return Promise.resolve([]);
  return new Promise((resolve) => {
    const all = []; const frames = new Map(); let left = widths.length; let done = false;
    const finish = () => { if (done) return; done = true; removeEventListener('message', onMsg); clearTimeout(t); for (const f of frames.values()) f.remove(); resolve(all); };
    const t = setTimeout(finish, timeout);
    function onMsg(e) {
      const d = e.data || {};
      if (d.type !== 'lp-inspect' || !frames.has(d.id) || e.source !== frames.get(d.id).contentWindow) return;
      for (const i of Array.isArray(d.issues) ? d.issues : []) if (i && typeof i.message_ko === 'string') all.push({ ...i, where: { ...(i.where || {}), width: i.where?.width || d.width } });
      frames.get(d.id).remove(); frames.delete(d.id);
      if (--left <= 0) finish();
    }
    addEventListener('message', onMsg);
    for (const w of widths) {
      const id = 'lp-insp-' + w + '-' + Math.random().toString(36).slice(2, 8);
      const f = document.createElement('iframe');
      f.setAttribute('sandbox', 'allow-scripts');
      f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1; f.title = 'lecpage-inspect';
      f.style.cssText = `position:fixed;left:-30000px;top:0;width:${w}px;height:${w <= 480 ? 844 : 800}px;border:0;opacity:0;pointer-events:none`;
      f.srcdoc = previewHtml(files, page, { extraBody: inspectRenderedScript({ id, file: page }) });
      frames.set(id, f);
      document.body.appendChild(f);
    }
  });
}
