// 그려서 검사: 화면 밖 숨은 틀(sandbox="allow-scripts", 같은 출처 아님)에 사이트를 넣고 1280·390 폭에서 inspectRendered를 돌림.
// 틀 안 코드는 앱 저장소에 닿지 못하고, 결과는 postMessage로만 받음.
import { inspectRendered } from './kit.js';

const PROBE = () => `<script>(function(){var F=${inspectRendered.toString()};
addEventListener('message',function(e){if(e.source!==parent)return;var d=e.data||{};if(d.type!=='lp-inspect')return;var out=[];try{out=F(window)||[];}catch(err){out=[{id:'inspect-crash',level:'warn',where:{file:'index.html'},message_ko:'그려서 검사하지 못했어요.',fix_hint_ko:String(err&&err.message||'').slice(0,120)}];}
parent.postMessage({type:'lp-inspect-result',nonce:d.nonce,issues:JSON.parse(JSON.stringify(out))},'*');});
function ready(){parent.postMessage({type:'lp-inspect-ready'},'*');}
if(document.readyState==='complete')setTimeout(ready,400);else addEventListener('load',function(){setTimeout(ready,400);});})();<\/script>`;

/**
 * html: 한 파일 HTML(preview.js inlineSite). widths: 잴 폭들
 * @returns {Promise<issue[]>} 틀을 못 만드는 곳(Node)이나 시간이 넘으면 []
 */
export function renderIssues(html, { widths = [1280, 390], timeout = 12000 } = {}) {
  if (typeof document === 'undefined' || !document.body) return Promise.resolve([]);
  return new Promise((resolve) => {
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-scripts');
    f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1; f.title = 'lecpage-inspect';
    f.style.cssText = `position:fixed;left:-30000px;top:0;width:${widths[0]}px;height:900px;border:0;opacity:0;pointer-events:none`;
    const all = []; let k = 0; let nonce = ''; let done = false;
    const finish = () => { if (done) return; done = true; removeEventListener('message', onMsg); clearTimeout(t); f.remove(); resolve(all); };
    const t = setTimeout(finish, timeout);
    const ask = () => { nonce = Math.random().toString(36).slice(2); f.contentWindow?.postMessage({ type: 'lp-inspect', nonce }, '*'); };
    function onMsg(e) {
      if (e.source !== f.contentWindow) return;
      const d = e.data || {};
      if (d.type === 'lp-inspect-ready' && k === 0) ask();
      else if (d.type === 'lp-inspect-result' && d.nonce === nonce) {
        for (const i of Array.isArray(d.issues) ? d.issues : []) if (i && typeof i.message_ko === 'string') all.push(i);
        k++;
        if (k >= widths.length) return finish();
        f.style.width = widths[k] + 'px';
        setTimeout(ask, 450); // 폭을 바꾼 뒤 다시 그릴 때까지
      }
    }
    addEventListener('message', onMsg);
    const at = html.search(/<\/body\s*>/i);
    f.srcdoc = at >= 0 ? html.slice(0, at) + PROBE() + html.slice(at) : html + PROBE();
    document.body.appendChild(f);
  });
}
