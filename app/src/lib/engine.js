// 엔진(skills/lecpage/engine)을 앱에서 쓰기: 런타임 파일을 문자열로 묶고, 미리보기용 한 파일 HTML을 만듭니다.
import * as E from '@engine/src/index.js';

let runtimePromise = null;
/** 실행 파일 묶음은 처음 빌드할 때 한 번만 불러옵니다. */
export function loadRuntime() {
  if (!runtimePromise) runtimePromise = import('./runtime-files.js').then((m) => { reviewJs = reviewScripts(m.runtime); return m.runtime; });
  return runtimePromise;
}
// 미리보기에만 넣는 '표시해서 수정 요청' 도구(배포 사이트 빌드에는 들어가지 않음)
let reviewJs = '';
function reviewScripts(rt) {
  try { return ['review/vendor/modern-screenshot.js', 'review/vendor/perfect-freehand.js', 'review/annotate.js'].map((p) => rt.read(p)).join('\n;\n'); } catch { return ''; }
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
export function previewHtml(files, page = 'index.html', { maxImageBytes = 6e6, tour = false, extraCss = '', lean = false, dpr = 0 } = {}) {
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
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, ''); // 미리보기는 앱 안(한 파일로 묶어 넣음)이라 사이트용 CSP를 뺌
  html = html.replace('<body', '<body data-lp-preview="1"');
  if (dpr) html = html.replace('<html ', `<html data-fx-dpr="${+dpr}" `); // 작게 줄여 보여 주는 카드: 캔버스 해상도 상한(core.js)
  if (extraCss) html = html.replace('</head>', () => `<style>${String(extraCss).replace(/<\//g, '<\\/')}</style></head>`);
  // '고칠 곳 고르기': 앱이 켜면 칸에 마우스를 올려 고르고, 누르면 그 칸의 id만 앱으로 보냄(앱은 아는 id인지 다시 확인)
  const pick = `<script>(function(){var on=false;var st=document.createElement('style');st.textContent='html.lp-pick main [id]:not(main [id] [id]):hover{outline:3px dashed #5B49B0;outline-offset:-3px;cursor:pointer}';document.head.appendChild(st);addEventListener('message',function(e){if(e.source!==parent)return;var d=e.data||{};if(d.type==='lp-pick'){on=!!d.on;document.documentElement.classList.toggle('lp-pick',on);}if(d.type==='lp-labels'){document.documentElement.classList.toggle('lp-labels',!!d.on);}if(d.type==='lp-scroll'&&typeof d.id==='string'){var t=document.getElementById(d.id);if(t)t.scrollIntoView({block:'start'});}});document.addEventListener('click',function(e){if(!on)return;var m=document.querySelector('main');var s=e.target.closest&&e.target.closest('[id]');while(s&&s.parentElement&&s.parentElement.closest&&s.parentElement.closest('main [id]'))s=s.parentElement.closest('main [id]');if(!s||!m||!m.contains(s))return;e.preventDefault();e.stopPropagation();parent.postMessage({type:'lp-picked',id:String(s.id).slice(0,80)},'*');},true);})();<\/script>`;
  // '본문 둘러보기'(디자인 크게 보기): 잠깐 첫 화면을 보여 준 뒤 본문 끝까지 천천히 내려가고 처음으로 돌아옴. 손을 대면 멈춤. 동작 줄이기에서는 하지 않음
  const tourJs = tour ? `<script>(function(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var stop=false,t0=0,y0=0;['wheel','pointerdown','keydown','touchstart'].forEach(function(t){addEventListener(t,function(e){if(e.isTrusted)stop=true;},{passive:true,capture:true});});document.documentElement.style.scrollBehavior='auto';function step(t){if(stop)return;if(!t0)t0=t;var m=document.documentElement.scrollHeight-innerHeight,y=y0+(t-t0)*0.42;if(y>=m){scrollTo(0,m);setTimeout(function(){if(!stop)scrollTo({top:0,behavior:'smooth'});},1200);return;}scrollTo(0,y);requestAnimationFrame(step);}setTimeout(function(){if(!stop)requestAnimationFrame(step);},2600);})();<\/script>` : '';
  const review = reviewJs ? `<script>${escClose(reviewJs)}<\/script>` : '';
  // lean(디자인 카드의 움직이는 모습): 고칠 곳 고르기·표시 도구 없이 사이트 스크립트만
  const extra = lean ? tourJs : pick + review + tourJs;
  html = html.includes('</body>') ? html.replace('</body>', () => extra + '</body>') : html + extra;
  return html;
}

