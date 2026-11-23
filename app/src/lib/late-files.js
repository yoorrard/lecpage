// 미리보기·그려서 검사 틀에서 '한 장 HTML에 못 담은 그림'을 열리게 함.
// 엔진 previewHtml은 그림을 data: 주소로 담되 크기 한도(8MB)까지만 담고, 넘은 그림은 사이트의 상대 주소(material/p-113.webp)를 그대로 둠.
// 미리보기 틀은 출처 없는 sandbox라 그 주소가 열리지 않음 → 쪽이 많은 교재(쪽 그림 합계가 8MB를 넘음)는 뒤쪽 쪽 그림이 깨져 보이고
// 검사가 "그림이 열리지 않아요(material/p-113.webp)"를 꼭 고칠 곳으로 알렸음(사이트 파일에는 그림이 다 있어 배포한 사이트는 멀쩡함).
// 고친 길: 못 담은 그림(previewHtml의 skipped)을 Blob으로 틀 안 문서에 넘기고, 틀 안의 작은 코드(LATE_JS)가 그 문서에서 주소를 만들어
// 같은 경로를 가리키는 그림에 넣음. 앱이 만든 blob: 주소는 출처가 달라 틀에서 열리지 않지만, 틀 안에서 받은 Blob으로 만든 주소는 열림(실측).
// 한 장 HTML이 그림만큼 커지지 않아 쪽이 수백 장인 교재도 미리보기가 무거워지지 않음.
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml' };
const mimeOf = (path) => MIME[(String(path).split('.').pop() || '').toLowerCase()] || '';

/**
 * 틀 안 문서의 머리에 넣는 코드(previewHtml의 extraHead). 부모(틀 문서)가 넘겨 준 { type: 'lp-late-files', files: { 경로: Blob } }를 받아
 * - 이미 있는 그림(엔진이 `빈 그림#lp-late=경로`로 적어 둔 것, 경로를 그대로 쓴 것)의 주소를 바꾸고
 * - 그 뒤 코드가 img.src·setAttribute('src')로 같은 경로를 넣으면 바로 바꿔 넣음(교재 슬라이드가 쪽을 넘길 때)
 * - 글로 끼워 넣은 <img>(innerHTML)가 열다 실패하면 그때 바꿈
 */
export const LATE_JS = `<script>(function(){
var U=Object.create(null);
function norm(v){v=String(v==null?'':v);var m=/#lp-late=(.+)$/.exec(v);if(m){try{return decodeURI(m[1])}catch(e){return m[1]}}if(!v||/^(data:|blob:|https?:|\\/\\/|#|about:|javascript:)/i.test(v))return '';return v.replace(/^(\\.\\/)+/,'').replace(/[?#].*$/,'')}
function map(v){var k=norm(v);return k&&U[k]?U[k]:v}
var D=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
var set=function(el,v){if(D&&D.set)D.set.call(el,v);else el.setAttribute('src',v)};
try{if(D&&D.set)Object.defineProperty(HTMLImageElement.prototype,'src',{configurable:true,enumerable:D.enumerable,get:function(){return D.get.call(this)},set:function(v){D.set.call(this,map(v))}})}catch(e){}
var SA=Element.prototype.setAttribute;
Element.prototype.setAttribute=function(n,v){return SA.call(this,n,this.tagName==='IMG'&&String(n).toLowerCase()==='src'?map(v):v)};
function fix(img){var k=norm(img.getAttribute('src'));if(k&&U[k]){set(img,U[k]);return true}return false}
addEventListener('error',function(e){var t=e.target;if(t&&t.tagName==='IMG')fix(t)},true);
addEventListener('message',function(e){var d=e.data;if(e.source!==parent||!d||d.type!=='lp-late-files'||!d.files)return;
for(var k in d.files){if(!U[k]){try{U[k]=URL.createObjectURL(d.files[k])}catch(x){}}}
var a=document.images;for(var i=0;i<a.length;i++)fix(a[i]);
try{parent.postMessage({type:'lp-late-done',n:Object.keys(d.files).length},'*')}catch(x){}});
})();<\/script>`;

const made = new WeakMap(); // 바이트 → Blob(같은 바이트를 여러 틀에 넘길 때 한 번만 만듦)
/**
 * 틀 안 문서로 넘길 메시지. files: 조립 결과(previewHtml에 준 것), skipped: previewHtml이 못 담았다고 적은 경로(Set)
 * @returns {{ type: 'lp-late-files', files: Record<string, Blob> } | null} 넘길 그림이 없으면 null
 */
export function lateFilesMsg(files, skipped) {
  const out = {}; let n = 0;
  for (const path of skipped || []) {
    const v = files?.[path]; const type = mimeOf(path);
    if (!type || v == null || typeof v === 'string') continue; // 그림 바이트만(글꼴·CSS 속 주소는 다루지 않음)
    let b = v instanceof Blob ? v : made.get(v);
    if (!b) { b = new Blob([v], { type }); made.set(v, b); }
    out[path] = b; n++;
  }
  return n ? { type: 'lp-late-files', files: out } : null;
}
