// 사이트 HTML을 내보낼 때 손보는 일(HTMLRewriter, 흘려보내며 처리):
//  - 자동으로 다른 곳으로 넘기는 <meta http-equiv="refresh">, 주소 기준을 바꾸는 <base>, 플러그인 <object>·<embed>를 뺌
//  - src가 이 사이트 안(상대 경로)이 아닌 <script>를 뺌. 자료 블록(type="application/json")과 src 없는 것은 그대로 둠(실행은 CSP가 막음)
//  - 바닥글(없으면 본문 끝)에 작은 "신고" 링크를 붙임

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

export function reportLinkHtml(siteId, { inFooter }) {
  const a = `<a href="/report?site=${encodeURIComponent(siteId)}" rel="nofollow noopener" target="_blank" data-host-report>신고</a>`;
  if (inFooter) return a;
  // 바닥글이 없는 화면(접속 확인·개인정보 안내·암호 화면 등): 인쇄할 때는 숨김
  return `<p data-host-report style="margin:0;padding:10px 16px;text-align:center;font:12px/1.4 system-ui,sans-serif;opacity:.55"><style>@media print{[data-host-report]{display:none}}</style><a href="/report?site=${encodeURIComponent(siteId)}" rel="nofollow noopener" target="_blank" style="color:inherit">신고</a></p>`;
}

/**
 * @param {Response} res 원본 HTML 응답
 * @param {string} siteId
 * @param {{ reportLink?: boolean }} [opts] reportLink=false면 신고 링크를 붙이지 않음(화면 전체를 쓰는 강사용 화면)
 */
export function rewriteHtml(res, siteId, opts = {}) {
  const remove = { element(el) { el.remove(); } };
  let linked = opts.reportLink === false;
  const rw = new HTMLRewriter()
    .on('meta', { element(el) { if (String(el.getAttribute('http-equiv') || '').trim().toLowerCase() === 'refresh') el.remove(); } })
    .on('base', remove)
    .on('object', remove)
    .on('embed', remove)
    .on('script', {
      element(el) {
        if (isDataScript(el.getAttribute('type'))) return;
        if (el.hasAttribute('src') && !isLocalSrc(el.getAttribute('src'))) el.remove();
      },
    })
    // 엔진이 만든 바닥글의 링크 줄. 여기에 붙이면 사이트 글꼴·색을 그대로 따름
    .on('footer .lp-foot-meta', { element(el) { if (!linked) { linked = true; el.append(reportLinkHtml(siteId, { inFooter: true }), { html: true }); } } })
    .on('body', { element(el) { el.onEndTag((end) => { if (!linked) { linked = true; end.before(reportLinkHtml(siteId, { inFooter: false }), { html: true }); } }); } });
  return rw.transform(res);
}
