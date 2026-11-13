// 사이트 HTML을 내보낼 때 손보는 일(HTMLRewriter, 흘려보내며 처리):
//  - 자동으로 다른 곳으로 넘기는 <meta http-equiv="refresh">, 주소 기준을 바꾸는 <base>, 플러그인 <object>·<embed>를 뺌
//  - src가 이 사이트 안(상대 경로)이 아닌 <script>를 뺌. 자료 블록(type="application/json")과 src 없는 것은 그대로 둠(실행은 CSP가 막음)
//  - 바닥글(없으면 본문 끝)에 작은 "신고" 링크를 붙임
//  - 이 사이트의 파일을 부르는 주소에 내용 지문(?v=)을 붙여 브라우저가 오래 두게 함. 엔진 런타임 그대로인 .js는 정적 사본(/rt/<sha>.js)으로
//  - 링크 미리보기 카드: og:url이 없으면 붙이고, og:image가 상대 주소면 전체 주소로, 없으면 첫 화면의 큰 그림을 씀
//  - 강사 화면(console.html)에는 운영자 공지 띠를 붙임(글자만, 이스케이프)
import { noticeBandHtml } from './notice.js';

const escAttr = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** HTML이 있는 폴더(dir, 끝에 /)를 기준으로 상대 주소를 사이트 안 경로로. 사이트 밖으로 나가면 null */
export function resolveIn(dir, src) {
  let p;
  try { p = decodeURI(String(src)); } catch { return null; }
  const out = [];
  for (const seg of (dir + p).split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { if (!out.length) return null; out.pop(); continue; }
    out.push(seg);
  }
  return out.join('/');
}

/**
 * 사이트 안 파일 주소에 지문을 붙임. 물음표·# 이 이미 있거나, 사이트에 없는 파일이면 그대로.
 * @param {string} src 속성 값
 * @param {string} dir HTML이 있는 폴더
 * @param {Map<string,[string,number]>|null} files 경로 → [sha256, 크기]
 * @param {Set<string>|null} rt 정적 사본이 있는 런타임 sha256
 */
export function versioned(src, dir, files, rt) {
  if (!files || !isLocalSrc(src) || /[?#]/.test(src)) return src;
  const path = resolveIn(dir, src);
  const hit = path ? files.get(path) : null;
  if (!hit) return src;
  const sha = hit[0];
  if (rt && rt.has(sha) && path.endsWith('.js')) return `/rt/${sha}.js`;
  return `${src}?v=${sha.slice(0, 12)}`;
}

/** 스크립트 주소가 이 사이트 안을 가리키는 상대 경로인지. 스킴·//·/·역빗금·제어 문자가 있으면 아님 */
export function isLocalSrc(src) {
  const s = String(src ?? '').trim();
  if (!s) return false;
  if (/[\u0000-\u001f\u007f\\]/.test(s)) return false; // 브라우저는 주소 안의 탭·줄바꿈을 지우고 읽음
  if (s.startsWith('/')) return false; // '/…', '//host/…'
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) return false; // https:, data:, javascript: …
  return true;
}
/** 실행되지 않는 자료 블록인지 */
export function isDataScript(type) {
  const t = String(type ?? '').trim().toLowerCase();
  return t === 'application/json' || t === 'application/ld+json';
}

export function reportLinkHtml(siteId, { inFooter, reportUrl = '/report' }) {
  const href = escAttr(`${reportUrl}?site=${encodeURIComponent(siteId)}`);
  const a = `<a href="${href}" rel="nofollow noopener" target="_blank" data-host-report>신고</a>`;
  if (inFooter) return a;
  // 바닥글이 없는 화면(접속 확인·개인정보 안내·암호 화면 등): 인쇄할 때는 숨김
  return `<p data-host-report style="margin:0;padding:10px 16px;text-align:center;font:12px/1.4 system-ui,sans-serif;opacity:.55"><style>@media print{[data-host-report]{display:none}}</style><a href="${href}" rel="nofollow noopener" target="_blank" style="color:inherit">신고</a></p>`;
}

/**
 * @param {Response} res 원본 HTML 응답
 * @param {string} siteId
 * @param {{ reportLink?: boolean, path?: string, files?: Map, rt?: Set<string>, origin?: string, ogImage?: string, notices?: object[] }} [opts]
 *   reportLink=false면 신고 링크를 붙이지 않음(화면 전체를 쓰는 강사용 화면). path: 사이트 안 HTML 경로. origin: 이 호스트 주소(미리보기 카드).
 *   ogImage: og:image가 없을 때 쓸 사이트 안 그림 경로. notices: 맨 위에 붙일 운영자 공지(강사 화면)
 *   siteBase: 사이트 첫 화면의 전체 주소(VIEW=pages: https://s-<id>.<프로젝트>.pages.dev/). 없으면 origin + /s/<id>/
 *   reportUrl: 신고 화면 주소(VIEW=pages: 바로 배포 호스트의 전체 주소). 없으면 같은 출처의 /report
 */
export function rewriteHtml(res, siteId, opts = {}) {
  const remove = { element(el) { el.remove(); } };
  let linked = opts.reportLink === false;
  const path = opts.path || 'index.html';
  const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
  const files = opts.files || null; const rt = opts.rt || null;
  const siteBase = opts.siteBase || (opts.origin ? `${opts.origin}/s/${siteId}/` : '');
  const reportUrl = opts.reportUrl || '/report';
  const pageUrl = siteBase ? siteBase + (path === 'index.html' ? '' : encodeURI(path)) : '';
  const abs = (src) => { try { return siteBase && isLocalSrc(src) ? new URL(src, siteBase + encodeURI(dir)).href : ''; } catch { return ''; } };
  const ver = (el, attr) => { const v = el.getAttribute(attr); if (v != null) { const n = versioned(v, dir, files, rt); if (n !== v) el.setAttribute(attr, n); } };
  let hasOgImage = false; let hasOgUrl = false;
  const rw = new HTMLRewriter()
    .on('meta', {
      element(el) {
        if (String(el.getAttribute('http-equiv') || '').trim().toLowerCase() === 'refresh') { el.remove(); return; }
        const prop = String(el.getAttribute('property') || '').trim().toLowerCase();
        if (prop === 'og:url') hasOgUrl = true;
        if (prop === 'og:image') {
          hasOgImage = true;
          const a = abs(el.getAttribute('content') || '');
          if (a) el.setAttribute('content', a);
        }
      },
    })
    .on('head', {
      element(el) {
        if (!siteBase) return;
        el.onEndTag((end) => {
          let add = '';
          if (!hasOgUrl) add += `<meta property="og:url" content="${escAttr(pageUrl)}">`;
          const img = !hasOgImage && opts.ogImage ? abs(opts.ogImage) : '';
          if (img) add += `<meta property="og:image" content="${escAttr(img)}"><meta name="twitter:card" content="summary_large_image">`;
          if (add) end.before(add, { html: true });
        });
      },
    })
    .on('link[href]', { element(el) { if (/(^|\s)(stylesheet|icon|apple-touch-icon|preload)(\s|$)/i.test(el.getAttribute('rel') || '')) ver(el, 'href'); } })
    .on('img[src]', { element(el) { ver(el, 'src'); } })
    .on('base', remove)
    .on('object', remove)
    .on('embed', remove)
    .on('script', {
      element(el) {
        if (isDataScript(el.getAttribute('type'))) return;
        if (!el.hasAttribute('src')) return;
        if (!isLocalSrc(el.getAttribute('src'))) { el.remove(); return; }
        ver(el, 'src');
      },
    })
    // 엔진이 만든 바닥글의 링크 줄. 여기에 붙이면 사이트 글꼴·색을 그대로 따름
    .on('footer .lp-foot-meta', { element(el) { if (!linked) { linked = true; el.append(reportLinkHtml(siteId, { inFooter: true, reportUrl }), { html: true }); } } })
    .on('body', {
      element(el) {
        if (opts.notices?.length) el.prepend(noticeBandHtml(opts.notices), { html: true });
        el.onEndTag((end) => { if (!linked) { linked = true; end.before(reportLinkHtml(siteId, { inFooter: false, reportUrl }), { html: true }); } });
      },
    });
  return rw.transform(res);
}
