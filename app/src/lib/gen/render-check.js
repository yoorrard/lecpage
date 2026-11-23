// 그려서 검사: 화면 밖 숨은 틀(sandbox="allow-scripts", 같은 출처 아님)에 조립한 사이트를 넣고 폭마다(1280·390)
// 엔진의 inspectRenderedScript가 부모 창에 { type:'lp-inspect', id, width, issues }를 보내면 받음. 틀 안 코드는 앱 저장소에 닿지 못함.
// 틀은 격리 틀(public/frame/, ../sandbox-frame.js): 틀 문서가 준비되면 사이트를 넣고, 안쪽 문서가 보낸 것은 틀이 넘겨 줌(앱 CSP에 인라인 스크립트가 없어도 돎)
import { previewHtml, inspectRenderedScript } from './kit.js';
import { FRAME_SRC, frameEvent, sendHtml, postInner } from '../sandbox-frame.js';
import { LATE_JS, lateFilesMsg, inSite } from '../late-files.js';

/**
 * files: 조립 결과(assemble().files). widths: 잴 폭들
 * @returns {Promise<issue[]>} (where.width 붙음) 틀을 못 만드는 곳(Node)이나 시간이 넘으면 그때까지 받은 것
 */
export function renderIssues(files, { widths = [1280, 390], timeout = 15000, page = 'index.html' } = {}) {
  if (typeof document === 'undefined' || !document.body) return Promise.resolve([]);
  return new Promise((resolve) => {
    const all = []; const frames = new Map(); const docs = new Map(); const late = new Map(); let left = widths.length; let done = false;
    let t = 0;
    const finish = () => { if (done) return; done = true; removeEventListener('message', onMsg); clearTimeout(t); for (const f of frames.values()) f.remove(); resolve(all); };
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
      for (const i of Array.isArray(d.issues) ? d.issues : []) {
        if (!i || typeof i.message_ko !== 'string') continue;
        // 사이트 파일에 실제로 있는 그림은 '열리지 않아요'로 알리지 않음: 미리보기 틀(출처 없는 sandbox)에서만 그 주소로 못 여는 것이고 배포한 사이트에서는 열림.
        // 틀에 그림을 모두 넘겨 두지만(late-files.js) 그 길로 못 닿는 쓰임(스크립트가 만든 주소 등)이 남아도 강사에게 없는 문제를 고치라고 하지 않게 함. 사이트에 없는 그림은 그대로 알림
        if (i.id === 'broken-image' && inSite(files, i.src, page)) continue;
        all.push({ ...i, where: { ...(i.where || {}), width: i.where?.width || d.width } });
      }
      frames.get(d.id).remove(); frames.delete(d.id);
      if (--left <= 0) finish();
    }
    addEventListener('message', onMsg);
    // 한 장 HTML은 폭마다 같으므로 한 번만 만듦(검수 스크립트만 폭마다 끼움). skipped: 한 장 HTML에 실제로 못 담아 따로 넘길 그림
    const skipped = new Set();
    const base = previewHtml(files, page, { extraHead: LATE_JS, skipped });
    const lateMsg = lateFilesMsg(files, skipped);
    const at = base.toLowerCase().lastIndexOf('</body>'); // 엔진 previewHtml의 extraBody와 같은 자리(맨 끝 </body> 앞)
    const withScript = (s) => (at < 0 ? base + s : base.slice(0, at) + s + base.slice(at));
    // 따로 넘긴 그림이 있으면 그 그림이 열릴 때까지 조금 더 기다린 뒤 잼: 실제로 못 담은 장수로 정함
    // (그림 크기 합계로 어림하면, 영상·배경 그림이 몫을 먼저 써서 그림이 밀려난 사이트는 기다리지 않고 재게 됨 → 그림이 1×1인 채로 배치를 잼)
    const delay = skipped.size ? 600 + Math.min(5000, 400 + skipped.size * 12) : 600;
    // 전체 제한: 재기 전 대기가 늘어난 만큼 더함(그림 많은 사이트가 느린 PC에서 검사 없이 넘어가지 않게). 가벼운 사이트는 예전 그대로
    t = setTimeout(finish, timeout + (delay - 600));
    for (const w of widths) {
      const id = 'lp-insp-' + w + '-' + Math.random().toString(36).slice(2, 8);
      const f = document.createElement('iframe');
      f.setAttribute('sandbox', 'allow-scripts');
      f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1; f.title = 'lecpage-inspect';
      f.style.cssText = `position:fixed;left:-30000px;top:0;width:${w}px;height:${w <= 480 ? 844 : 800}px;border:0;opacity:0;pointer-events:none`;
      docs.set(id, withScript(inspectRenderedScript({ id, file: page, delay })));
      late.set(id, lateMsg);
      f.src = FRAME_SRC;
      frames.set(id, f);
      document.body.appendChild(f);
    }
  });
}
