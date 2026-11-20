// 사이트 파일 → 숨은 틀·미리보기 틀에 넣을 한 파일 HTML(CSS·JS·교재 쪽 그림을 안에 넣음).
// 틀은 sandbox(allow-same-origin 없이)라 사이트 코드가 앱 저장소(키·연수)에 닿지 못합니다.
import { blobs, projects } from '../db.js';
import { assemble } from './kit.js';

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml' };
const escClose = (s) => String(s).replace(/<\/(script)/gi, '<\\/$1');
function dataUrl(path, data) {
  const type = MIME[(path.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';
  if (typeof data === 'string') return `data:${type};charset=utf-8,${encodeURIComponent(data)}`;
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(bin)}`;
}
const local = (p) => p && !/^(https?:|data:|\/\/|#|mailto:)/i.test(p);
const norm = (p) => p.replace(/^\.\//, '').split(/[?#]/)[0];

/**
 * files: { 경로: 글 | Uint8Array } (교재 쪽 그림 포함). page: 'index.html'. maxImageBytes: 넣을 그림 합계(넘으면 빈 그림)
 * extraHead: 틀 안에서 먼저 돌릴 것(검사 스크립트 등)
 */
export function inlineSite(files, page = 'index.html', { maxImageBytes = 12e6, extra = '' } = {}) {
  let html = files[page];
  if (typeof html !== 'string') return '<!doctype html><p>미리볼 쪽이 없어요.</p>';
  html = html.replace(/<meta[^>]+http-equiv=["']?Content-Security-Policy[^>]*>/gi, '');
  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/rel=["']?stylesheet/i.test(tag)) return tag;
    const href = (/href=["']([^"']+)["']/i.exec(tag) || [])[1];
    if (!local(href)) return tag;
    const css = files[norm(href)];
    return typeof css === 'string' ? `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>` : '';
  });
  html = html.replace(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi, (m, a, src, b) => {
    if (!local(src)) return m;
    const js = files[norm(src)];
    return typeof js === 'string' ? `<script${(a + b).replace(/\s+defer\b|\s+async\b/gi, '')}>${escClose(js)}</script>` : '';
  });
  let budget = maxImageBytes;
  html = html.replace(/(\s(?:src|poster|data-src)=)(["'])([^"']+)\2/gi, (m, attr, q, p) => {
    if (!local(p)) return m;
    const data = files[norm(p)];
    if (data === undefined || data === null || /\.(css|js|html?)$/i.test(p)) return m;
    const size = typeof data === 'string' ? data.length : data.byteLength;
    if (size > budget) return `${attr}${q}data:,${q}`;
    budget -= size;
    return `${attr}${q}${dataUrl(p, data)}${q}`;
  });
  html = html.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (m, q, p) => {
    if (!local(p)) return m;
    const data = files[norm(p)];
    if (!data || typeof data === 'string') return m;
    if (data.byteLength > budget) return 'none';
    budget -= data.byteLength;
    return `url("${dataUrl(p, data)}")`;
  });
  if (extra) { const at = html.search(/<\/body\s*>/i); html = at >= 0 ? html.slice(0, at) + extra + html.slice(at) : html + extra; }
  return html;
}

/** 이 연수의 교재 쪽 그림(material/…) → { 경로: 바이트 } */
export async function materialFiles(pid) {
  const out = {};
  const keys = (await blobs.keys(pid).catch(() => [])).filter((k) => k.startsWith('site/'));
  for (const k of keys) { const v = await blobs.get(pid, k); out[k.slice(5)] = v instanceof Blob ? new Uint8Array(await v.arrayBuffer()) : v; }
  return out;
}

/**
 * 미리보기용 한 파일 HTML(화면 작업자가 바로 쓸 수 있게). 조립(assemble, preview) → 안에 넣기
 * @returns {Promise<string>}
 */
export async function sitePreviewHtml(pid, { page = 'index.html', site, meta } = {}) {
  const p = site ? null : await projects.get(pid);
  const s = site || p?.site || {};
  const mat = await materialFiles(pid);
  const { files } = assemble(s, meta || p?.meta || {}, { preview: true, target: 'preview', material: Object.keys(mat) });
  return inlineSite({ ...mat, ...files }, page);
}
