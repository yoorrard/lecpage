// 엔진(skills/lecpage/engine)을 앱에서 쓰기: 런타임 파일을 문자열로 묶고, 미리보기용 한 파일 HTML을 만듭니다.
import * as E from '@engine/src/index.js';

const RAW = import.meta.glob('../../../skills/lecpage/engine/runtime/**/*.{js,css}', { query: '?raw', import: 'default', eager: true });
const runtimeFiles = {};
for (const [k, v] of Object.entries(RAW)) runtimeFiles[k.replace(/^.*\/engine\/runtime\//, '')] = v;
export const runtime = { read: (p) => { if (!(p in runtimeFiles)) throw new Error('없음: ' + p); return runtimeFiles[p]; } };

export { E };

export function buildSite(blueprint, assets = {}, infra = null) {
  return E.build(blueprint, { runtime, assets, infra });
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
  return html;
}

export function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'lecpage-site'; }
