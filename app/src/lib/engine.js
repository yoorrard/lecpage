// 엔진(skills/lecpage/engine)을 앱에서 쓰기: 런타임 파일을 문자열로 묶고, 미리보기용 한 파일 HTML을 만듭니다.
import * as E from '@engine/src/index.js';

let runtimePromise = null;
/** 실행 파일 묶음은 처음 빌드할 때 한 번만 불러옵니다. */
export function loadRuntime() {
  if (!runtimePromise) runtimePromise = import('./runtime-files.js').then((m) => m.runtime);
  return runtimePromise;
}

export { E };

export async function buildSite(blueprint, assets = {}, infra = null) {
  return E.build(blueprint, { runtime: await loadRuntime(), assets, infra });
}

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', pdf: 'application/pdf', mp3: 'audio/mpeg', mp4: 'video/mp4' };
function toDataUrl(path, data) {
  const ext = (path.split('.').pop() || '').toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  if (typeof data === 'string') return `data:${type};charset=utf-8,${encodeURIComponent(data)}`;
  let bin = ''; const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(bin)}`;
}

/** 빌드 결과(files) → 샌드박스 iframe에 넣을 한 파일 HTML. page: index.html|console.html|screen.html|check.html */
export function previewHtml(files, page = 'index.html', { maxImageBytes = 6e6 } = {}) {
  let html = files[page]; if (!html) return '<p>미리볼 페이지가 없어요.</p>';
  const escClose = (s) => String(s).replace(/<\/(script)/gi, '<\\/$1');
  html = html.replace(/<link rel="stylesheet" href="(assets\/[^"]+)">/g, (m, p) => (files[p] !== undefined ? `<style>${files[p]}</style>` : ''));
  html = html.replace(/<script src="(assets\/[^"]+)"( defer)?><\/script>/g, (m, p) => (files[p] !== undefined ? `<script>${escClose(files[p])}</script>` : ''));
  let budget = maxImageBytes;
  html = html.replace(/(src|href)="((?:assets|media|slides)\/[^"]+)"/g, (m, attr, p) => {
    const data = files[p];
    if (data === undefined || /\.(css|js)$/.test(p)) return m;
    const size = typeof data === 'string' ? data.length : data.byteLength;
    if (size > budget) return `${attr}="#"`;
    budget -= size;
    return `${attr}="${toDataUrl(p, data)}"`;
  });
  // 미리보기 안에서는 다른 페이지 링크가 동작하지 않으니 표시만
  html = html.replace('<body', '<body data-lp-preview="1"');
  // '고칠 곳 고르기': 앱이 켜면 칸에 마우스를 올려 고르고, 누르면 그 칸의 id만 앱으로 보냄(앱은 아는 id인지 다시 확인)
  const pick = `<script>(function(){var on=false;var st=document.createElement('style');st.textContent='html.lp-pick main [id]:not(main [id] [id]):hover{outline:3px dashed #5B49B0;outline-offset:-3px;cursor:pointer}';document.head.appendChild(st);addEventListener('message',function(e){if(e.source!==parent)return;var d=e.data||{};if(d.type==='lp-pick'){on=!!d.on;document.documentElement.classList.toggle('lp-pick',on);}});document.addEventListener('click',function(e){if(!on)return;var m=document.querySelector('main');var s=e.target.closest&&e.target.closest('[id]');while(s&&s.parentElement&&s.parentElement.closest&&s.parentElement.closest('main [id]'))s=s.parentElement.closest('main [id]');if(!s||!m||!m.contains(s))return;e.preventDefault();e.stopPropagation();parent.postMessage({type:'lp-picked',id:String(s.id).slice(0,80)},'*');},true);})();<\/script>`;
  html = html.includes('</body>') ? html.replace('</body>', pick + '</body>') : html + pick;
  return html;
}

export function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'lecpage-site'; }
