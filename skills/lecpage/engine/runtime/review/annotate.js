/*! lecpage 검토 도구(표시해서 수정 요청) — MIT-0, 이 폴더의 ../LICENSE
 * 앱 미리보기와 skill의 로컬 검토 서버(review-server.mjs)에서만 넣어요. 배포하는 사이트에는 들어가지 않아요.
 * 필요: vendor/modern-screenshot.js(window.modernScreenshot), vendor/perfect-freehand.js(window.lpFreehand)
 *
 * 앱(부모 창) ↔ 이 페이지
 *   받는 것  {type:'lp-annotate-start', mode:'draw'|'pick'} · {type:'lp-annotate-cancel'}
 *   보내는 것 {type:'lp-review-ready'} · {type:'lp-annotate-state', on}
 *            {type:'lp-annotated', png, sections:[칸 id], viewport:{w,h}, scroll:{x,y}, notes:[글], mode}
 * 부모가 보내는 값은 믿지 않아요: 정해 둔 type·mode만 받고, 글·코드는 받지 않아요(화면 글은 모두 여기서 만듦).
 * 혼자 쓰기(검토 서버): <script src=… data-lp-review="/__lecpage/feedback"> → 왼쪽 아래 [수정 요청] 단추, 완료 후 글을 적어 서버로 보냄
 */
(function () {
  'use strict';
  if (window.__lpAnnotate) return;
  var W = window, D = document;
  var me = D.currentScript;
  var endpoint = (me && me.getAttribute('data-lp-review')) || '';
  var embedded = !endpoint && W.parent && W.parent !== W;
  var MAXW = 1568; // 긴 변 1568px 안쪽이면 AI가 줄이지 않고 그대로 봄
  var COLORS = [['#E5322D', '빨강'], ['#FFC21A', '노랑'], ['#2563EB', '파랑']];
  var TOOLS = [['pen', '펜'], ['rect', '네모'], ['arrow', '화살표'], ['text', '글자']];
  var ICON = {
    pen: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19z"/><path d="M14 7l3 3"/>',
    rect: '<rect x="4" y="6" width="16" height="12" rx="2"/>',
    arrow: '<path d="M5 19L19 5"/><path d="M10 5h9v9"/>',
    text: '<path d="M6 6h12"/><path d="M12 6v13"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
    clear: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
  };
  var svg = function (k) { return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[k] + '</svg>'; };
  var reduce = function () { try { return W.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  var post = function (msg) { if (embedded) try { W.parent.postMessage(msg, '*'); } catch (e) { /* 부모 없음 */ } };
  var S = null; // 표시하는 동안의 상태

  // ── 칸 찾기: main 안에서 id가 있는 가장 바깥 요소(앱의 칸 id와 같음) ──
  function topSections() {
    var out = [], all = D.querySelectorAll('main [id]');
    for (var i = 0; i < all.length; i++) {
      var el = all[i], p = el.parentElement && el.parentElement.closest('main [id]');
      if (p) continue;
      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      var h = el.querySelector('h1,h2,h3');
      out.push({ id: String(el.id).slice(0, 80), r: { x: r.left, y: r.top, w: r.width, h: r.height }, label: ((h && h.textContent) || '').trim().slice(0, 40) });
    }
    return out;
  }
  function inView(s, vw, vh) { return s.r.y < vh && s.r.y + s.r.h > 0 && s.r.x < vw && s.r.x + s.r.w > 0; }
  function overlap(a, b) { var w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); return w > 0 && h > 0 ? w * h : 0; }

  // ── 화면 담기: 지금 보이는 영역만. 샌드박스(opaque origin) 안에서도 되게 기본 스타일은 shadow DOM에서 읽고, 글꼴은 이미 받은 것만 넣음 ──
  var fontCache = {};
  var norm = function (s) { return String(s || '').replace(/["']/g, '').replace(/\s+/g, '').toLowerCase(); };
  var fkey = function (f, u, w, s) { return [norm(f), norm(u || 'u+0-10ffff'), norm(w || 'normal'), norm(s || 'normal')].join('|'); };
  function blobUrl(blob) { return new Promise(function (ok) { var fr = new FileReader(); fr.onload = function () { ok(String(fr.result || '')); }; fr.onerror = function () { ok(''); }; fr.readAsDataURL(blob); }); }
  function fetchData(url) {
    if (!fontCache[url]) fontCache[url] = fetch(url, { cache: 'force-cache', credentials: 'omit' }).then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.blob(); }).then(blobUrl).catch(function () { return ''; });
    return fontCache[url];
  }
  function fontCss() {
    var want = {};
    try { D.fonts.forEach(function (f) { if (f.status === 'loaded') want[fkey(f.family, f.unicodeRange, f.weight, f.style)] = 1; }); } catch (e) { /* 없음 */ }
    var jobs = [];
    function walk(rules, base, depth) {
      for (var i = 0; i < rules.length && depth < 4; i++) {
        var r = rules[i];
        if (r.type === 5) {
          var st = r.style, fam = st.getPropertyValue('font-family'), ur = st.getPropertyValue('unicode-range'), fw = st.getPropertyValue('font-weight'), fs = st.getPropertyValue('font-style');
          if (!want[fkey(fam, ur, fw, fs)]) continue;
          var m = /url\(\s*["']?([^"')]+)["']?\s*\)\s*(?:format\(\s*["']?([\w-]+)["']?\s*\))?/.exec(st.getPropertyValue('src'));
          if (!m) continue;
          var u; try { u = new URL(m[1], base).href; } catch (e) { continue; }
          jobs.push((function (fam, ur, fw, fs, u, fmt) {
            return (u.indexOf('data:') === 0 ? Promise.resolve(u) : fetchData(u)).then(function (d) {
              return d ? '@font-face{font-family:' + fam + ';src:url(' + d + ')' + (fmt ? ' format("' + fmt + '")' : '') + ';font-weight:' + (fw || 'normal') + ';font-style:' + (fs || 'normal') + (ur ? ';unicode-range:' + ur : '') + ';font-display:block}' : '';
            });
          })(fam, ur, fw, fs, u, m[2]));
        } else if (r.cssRules) { try { walk(r.cssRules, base, depth + 1); } catch (e) { /* 막힘 */ } }
        else if (r.styleSheet) { try { walk(r.styleSheet.cssRules, r.styleSheet.href || base, depth + 1); } catch (e) { /* CORS로 못 읽으면 대체 글꼴로 */ } }
      }
    }
    for (var i = 0; i < D.styleSheets.length; i++) { var sh = D.styleSheets[i]; try { walk(sh.cssRules, sh.href || location.href, 0); } catch (e) { /* CORS로 못 읽는 글꼴 CSS는 건너뜀 */ } }
    return Promise.all(jobs).then(function (a) { return a.join('\n'); });
  }
  function capture() {
    var MS = W.modernScreenshot;
    if (!MS || !MS.domToCanvas) return Promise.reject(new Error('no capture'));
    var de = D.documentElement, w = de.clientWidth, h = de.clientHeight, y = W.scrollY, x = W.scrollX;
    var marked = [], all = D.body.getElementsByTagName('*'), tom = !!D.body.computedStyleMap, fixed = [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i]; if (el.hasAttribute('data-lp-annotate')) continue;
      var cs = W.getComputedStyle(el);
      if (cs.display === 'none') continue;
      if (cs.position === 'fixed') { var fr = el.getBoundingClientRect(); if (fr.bottom > 0 && fr.top < h && fr.width > 0) fixed.push(el); }
      if (cs.position === 'sticky' || cs.position === '-webkit-sticky') {
        // 붙어 있는 위치를 relative+top으로 바꿔 담음(복제본에는 스크롤이 없음)
        var a = el.getBoundingClientRect(), ps = el.style.position, pt = el.style.top;
        el.style.position = 'relative'; el.style.top = '0px';
        var b = el.getBoundingClientRect(); el.style.position = ps; el.style.top = pt;
        var dy = Math.round(a.top - b.top); if (dy) { el.setAttribute('data-lp-stuck', String(dy)); marked.push(el); }
      }
      if (tom && (cs.marginLeft === '0px' || cs.marginRight === '0px')) {
        // getComputedStyle은 그리드·플렉스 안 margin:auto를 0으로 돌려줘 가운데 정렬이 깨짐 → 계산값(auto)을 따로 표시
        try { var mp = el.computedStyleMap(), ml = String(mp.get('margin-left')), mr = String(mp.get('margin-right')); if (ml === 'auto' || mr === 'auto') { el.setAttribute('data-lp-m', (ml === 'auto' ? 'l' : '') + (mr === 'auto' ? 'r' : '')); marked.push(el); } } catch (e) { /* 지원 안 함 */ }
      }
    }
    // 화면 밖 칸은 크기만 남기고 속을 비움(빠르게)
    var cand = D.querySelectorAll('main > *, body > *, main > * > *');
    for (var k = 0; k < cand.length; k++) {
      var c = cand[k], r = c.getBoundingClientRect();
      if (r.height < 1 || (r.bottom > -50 && r.top < h + 50) || c.closest('[data-lp-skip]') || c.hasAttribute('data-lp-annotate')) continue;
      var keep = false; for (var q = 0; q < fixed.length; q++) if (c.contains(fixed[q])) { keep = true; break; }
      var p2 = W.getComputedStyle(c).position; if (keep || p2 === 'fixed' || p2 === 'sticky') continue;
      c.setAttribute('data-lp-skip', ''); marked.push(c);
    }
    // 기본 스타일 비교용 상자: 샌드박스 iframe 안에서는 안쪽 iframe에 닿지 못해 shadow DOM을 씀
    var host = D.createElement('div'); host.setAttribute('data-lp-annotate', '');
    host.style.cssText = 'all:initial;position:fixed;left:-99999px;top:0;width:0;height:0;overflow:hidden;contain:strict';
    var box = D.createElement('div'); host.attachShadow({ mode: 'open' }).appendChild(box); de.appendChild(host);
    var sandbox = { contentWindow: { document: { createElement: function (n) { return D.createElement(n); }, createElementNS: function (a, b) { return D.createElementNS(a, b); }, body: box }, getComputedStyle: function (e, p) { return W.getComputedStyle(e, p); } }, remove: function () { } };
    var scale = Math.max(1, Math.min(2, W.devicePixelRatio || 1, MAXW / Math.max(1, w)));
    var clean = function () { for (var i = 0; i < marked.length; i++) { marked[i].removeAttribute('data-lp-stuck'); marked[i].removeAttribute('data-lp-m'); marked[i].removeAttribute('data-lp-skip'); } try { host.remove(); } catch (e) { /* 이미 없음 */ } };
    var ctx = null;
    return fontCss().then(function (css) {
      // 문서 전체를 넘기면 화면 밖 lazy 그림까지 기다려(최대 몇 초) 느려짐 → 빈 요소로 맥락만 만들고 대상만 바꿈
      return MS.createContext(D.createElement('i'), {
        width: w, height: h, scale: scale, sandbox: sandbox, timeout: 8000, font: css ? { cssText: css } : false,
        style: { marginTop: (-y) + 'px', marginLeft: (-x) + 'px' },
        filter: function (n) { if (n.nodeType === 1 && n.hasAttribute('data-lp-annotate')) return false; var p = n.parentElement; return !(p && p.hasAttribute('data-lp-skip')); },
        onCloneNode: function (root) {
          var s = root.querySelectorAll('[data-lp-stuck]');
          for (var i = 0; i < s.length; i++) { s[i].style.setProperty('position', 'relative', 'important'); s[i].style.setProperty('top', s[i].getAttribute('data-lp-stuck') + 'px', 'important'); s[i].style.setProperty('bottom', 'auto', 'important'); }
          var m = root.querySelectorAll('[data-lp-m]');
          for (var j = 0; j < m.length; j++) { var v = m[j].getAttribute('data-lp-m'); if (v.indexOf('l') >= 0) m[j].style.setProperty('margin-left', 'auto', 'important'); if (v.indexOf('r') >= 0) m[j].style.setProperty('margin-right', 'auto', 'important'); }
          var all2 = root.querySelectorAll('[data-lp-stuck],[data-lp-m],[data-lp-skip]');
          for (var k = 0; k < all2.length; k++) { all2[k].removeAttribute('data-lp-stuck'); all2[k].removeAttribute('data-lp-m'); all2[k].removeAttribute('data-lp-skip'); }
        },
      });
    }).then(function (c) { ctx = c; ctx.node = de; return MS.domToCanvas(ctx); })
      .then(function (cv) { clean(); try { MS.destroyContext(ctx); } catch (e) { /* 없음 */ } return cv; }, function (e) { clean(); throw e; });
  }

  // ── 그리기 ──
  function strokePath(m) {
    var F = W.lpFreehand, pts = m.pts;
    if (!F || pts.length < 1) return null;
    var o = F.getStroke(pts, { size: m.size, thinning: 0.55, smoothing: 0.5, streamline: 0.45, simulatePressure: !m.pen, last: !!m.done });
    if (!o.length) return null;
    var p = new Path2D(); p.moveTo(o[0][0], o[0][1]);
    for (var i = 1; i < o.length; i++) { var a = o[i - 1], b = o[i]; p.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    p.closePath(); return p;
  }
  function drawMark(ctx, m) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
    ctx.strokeStyle = ctx.fillStyle = m.color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (m.t === 'pen') { if (!m.path || !m.done) m.path = strokePath(m); if (m.path) ctx.fill(m.path); }
    else if (m.t === 'rect' || m.t === 'pick') {
      var x = Math.min(m.x1, m.x2), y = Math.min(m.y1, m.y2), w = Math.abs(m.x2 - m.x1), h = Math.abs(m.y2 - m.y1);
      ctx.lineWidth = 4; if (m.t === 'pick') ctx.setLineDash([10, 7]);
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, 8); else ctx.rect(x, y, w, h); ctx.stroke();
    } else if (m.t === 'arrow') {
      var dx = m.x2 - m.x1, dy = m.y2 - m.y1, ang = Math.atan2(dy, dx), L = Math.hypot(dx, dy), hl = Math.min(22, Math.max(12, L * 0.35));
      var ex = m.x2 - Math.cos(ang) * hl * 0.6, ey = m.y2 - Math.sin(ang) * hl * 0.6;
      ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(m.x1, m.y1); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(m.x2, m.y2);
      ctx.lineTo(m.x2 - hl * Math.cos(ang - 0.45), m.y2 - hl * Math.sin(ang - 0.45));
      ctx.lineTo(m.x2 - hl * Math.cos(ang + 0.45), m.y2 - hl * Math.sin(ang + 0.45)); ctx.closePath(); ctx.fill();
    } else if (m.t === 'text') {
      ctx.font = '700 16px "Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
      var lines = wrap(ctx, m.text, 260), lh = 22, tw = 0;
      for (var i = 0; i < lines.length; i++) tw = Math.max(tw, ctx.measureText(lines[i]).width);
      var bx = m.x1, by = m.y1, bw = tw + 20, bh = lines.length * lh + 12;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 8); else ctx.rect(bx, by, bw, bh); ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.fillStyle = m.color === COLORS[1][0] ? '#2B2321' : '#fff'; ctx.textBaseline = 'top';
      for (var j = 0; j < lines.length; j++) ctx.fillText(lines[j], bx + 10, by + 7 + j * lh);
      m.box = { x: bx, y: by, w: bw, h: bh };
    }
    ctx.restore();
  }
  function wrap(ctx, text, max) {
    var out = [], line = '';
    String(text).split('').forEach(function (ch) { if (ctx.measureText(line + ch).width > max && line) { out.push(line); line = ch.trim() ? ch : ''; } else line += ch; });
    if (line) out.push(line); return out.slice(0, 6);
  }
  function bbox(m) {
    if (m.t === 'pen') { var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; m.pts.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }); return { x: x0 - 4, y: y0 - 4, w: x1 - x0 + 8, h: y1 - y0 + 8 }; }
    if (m.t === 'arrow') return { x: m.x2 - 14, y: m.y2 - 14, w: 28, h: 28 }; // 화살표는 끝이 가리키는 곳
    if (m.t === 'text') return m.box || { x: m.x1, y: m.y1, w: 40, h: 24 };
    return { x: Math.min(m.x1, m.x2), y: Math.min(m.y1, m.y2), w: Math.abs(m.x2 - m.x1), h: Math.abs(m.y2 - m.y1) };
  }

  // ── 겹 화면(표시하는 동안만) ──
  var CSS = ':host{all:initial}' +
    '.ov{position:fixed;inset:0;z-index:2147483647;font:15px/1.4 "Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;color:#2B2321;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;animation:lpin .16s ease-out}' +
    '@keyframes lpin{from{opacity:0}to{opacity:1}}' +
    '.stage{position:absolute;inset:0;touch-action:none;cursor:crosshair;outline:none;box-shadow:inset 0 0 0 3px #5B49B0}' +
    '.stage:focus-visible{box-shadow:inset 0 0 0 5px #5B49B0}' +
    '.ov.pick .stage{cursor:pointer;background:rgba(43,35,33,.06)}' +
    'canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}' +
    '.hint{position:absolute;top:max(10px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);background:#2B2321;color:#FFFAF7;padding:7px 14px;border-radius:10px;font-weight:650;font-size:14px;pointer-events:none;white-space:nowrap;max-width:calc(100% - 24px);overflow:hidden;text-overflow:ellipsis;transition:opacity .2s}' +
    '.hint.off{opacity:0}' +
    '.bar{position:absolute;left:50%;bottom:max(12px,env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;align-items:center;gap:4px;padding:6px;background:#FFFAF7;border:2px solid #473C3B;border-radius:16px;box-shadow:3px 3px 0 #473C3B;max-width:calc(100% - 16px);box-sizing:border-box}' +
    '.grp{display:flex;align-items:center;gap:2px}' +
    'button{font:inherit;color:inherit;border:0;background:none;cursor:pointer;min-height:44px;min-width:44px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:0 9px;font-weight:650;font-size:14px;white-space:nowrap}' +
    'button:hover{background:#F1E6DE}' +
    'button:focus-visible{outline:3px solid #5B49B0;outline-offset:1px}' +
    'button:disabled{opacity:.4;cursor:default;background:none}' +
    '.tool[aria-pressed="true"]{background:#473C3B;color:#FFFAF7}' +
    '.sw{min-width:36px;width:36px;padding:0}' +
    '.sw i{display:block;width:22px;height:22px;border-radius:50%;box-shadow:0 0 0 2px #fff,0 0 0 3.5px rgba(71,60,59,.35)}' +
    '.sw[aria-pressed="true"] i{box-shadow:0 0 0 2px #fff,0 0 0 4.5px #473C3B}' +
    '.sep{width:1.5px;height:28px;background:#E4D8CF;margin:0 4px}' +
    '.end{display:flex;gap:6px;margin-left:6px}' +
    '.cancel{border:2px solid #473C3B;background:#fff;padding:0 14px}' +
    '.done{border:2px solid #473C3B;background:#C0B4E1;color:#2E2550;padding:0 20px;font-weight:800;font-size:15.5px}' +
    '.done:hover{background:#B2A4DA}' +
    '.st{font-size:13px;color:#6A5D5B;padding:0 4px}' +
    '.tin{position:absolute;min-width:180px;max-width:280px;font:700 16px/1.4 "Pretendard Variable",Pretendard,system-ui,sans-serif;padding:7px 10px;border:2px solid #473C3B;border-radius:8px;background:#fff;color:#2B2321;box-shadow:3px 3px 0 #473C3B;outline:none;-webkit-user-select:text;user-select:text}' +
    '.sheet{position:absolute;left:50%;bottom:max(12px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(520px,calc(100% - 16px));box-sizing:border-box;display:grid;gap:10px;padding:14px;background:#FFFAF7;border:2px solid #473C3B;border-radius:16px;box-shadow:3px 3px 0 #473C3B;-webkit-user-select:text;user-select:text}' +
    '.sheet img{width:100%;max-height:38vh;object-fit:contain;border-radius:8px;border:1.5px solid #E4D8CF;background:#fff}' +
    '.sheet textarea{font:inherit;font-size:15px;min-height:72px;padding:9px 11px;border:1.5px solid #8F817C;border-radius:10px;resize:vertical;background:#fff;color:#2B2321}' +
    '.sheet textarea:focus{outline:3px solid #C0B4E1;border-color:#5B49B0}' +
    '.row{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}' +
    '.lbl{font-weight:700}' +
    '@media (max-width:620px){.bar{left:8px;right:8px;transform:none;max-width:none;flex-wrap:wrap;justify-content:center}.tool span{display:none}.end{margin-left:0;flex:1 1 100%;justify-content:stretch}.end button{flex:1}.st{flex:1 1 100%;text-align:center;order:-1}.sep{display:none}}' +
    '@media (prefers-reduced-motion:reduce){.ov{animation:none}.hint{transition:none}}';

  function el(tag, attrs, html) { var e = D.createElement(tag); for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }

  function start(mode) {
    if (S) return;
    mode = mode === 'pick' ? 'pick' : 'draw';
    var host = el('div', { 'data-lp-annotate': '', style: 'all:initial' });
    var root = host.attachShadow({ mode: 'open' });
    var st = el('style'); st.textContent = CSS; root.appendChild(st);
    var ov = el('div', { class: 'ov' + (mode === 'pick' ? ' pick' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': mode === 'pick' ? '고칠 칸 고르기' : '고칠 곳 표시하기' });
    var stage = el('div', { class: 'stage', tabindex: '0', role: 'application', 'aria-label': mode === 'pick' ? '고칠 칸을 누르세요. 화살표 키로 칸을 옮기고 Enter로 고릅니다. Esc는 취소.' : '고칠 곳에 끌어서 표시하세요. Enter는 완료, Esc는 취소.' });
    var cv = el('canvas', { 'aria-hidden': 'true' });
    var hint = el('div', { class: 'hint', 'aria-hidden': 'true' });
    hint.textContent = mode === 'pick' ? '고칠 칸을 누르세요' : '고칠 곳에 표시하고 [완료]를 누르세요';
    var bar = el('div', { class: 'bar', role: 'toolbar', 'aria-label': '표시 도구' });
    ov.appendChild(stage); ov.appendChild(cv); ov.appendChild(hint); ov.appendChild(bar); root.appendChild(ov);
    var live = el('div', { role: 'status', 'aria-live': 'polite', style: 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)' }); ov.appendChild(live);
    var de = D.documentElement;
    S = { mode: mode, host: host, root: root, ov: ov, stage: stage, cv: cv, hint: hint, bar: bar, live: live, marks: [], tool: 'pen', color: COLORS[0][0], cur: null,
      vw: de.clientWidth, vh: de.clientHeight, sx: W.scrollX, sy: W.scrollY, secs: topSections(), hover: -1, focusBack: D.activeElement, cap: null, capErr: false };
    S.cap = capture().catch(function () { S && (S.capErr = true); return null; });
    if (mode === 'draw') buildBar(); else buildPickBar();
    de.appendChild(host);
    sizeCanvas(); redraw();
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);
    stage.addEventListener('pointerleave', function () { if (S && S.mode === 'pick' && !S.cur) { S.hover = -1; redraw(); } });
    ov.addEventListener('wheel', stop, { passive: false });
    ov.addEventListener('touchmove', stop, { passive: false });
    root.addEventListener('keydown', onKey);
    W.addEventListener('keydown', onWinKey, true);
    W.addEventListener('resize', onResize);
    try { stage.focus({ preventScroll: true }); } catch (e) { stage.focus(); }
    post({ type: 'lp-annotate-state', on: true });
  }
  function stop(e) { if (e.cancelable) e.preventDefault(); }

  function btn(cls, label, inner, onClick, extra) {
    var b = el('button', Object.assign({ type: 'button', class: cls }, extra || {}), inner);
    if (label) b.setAttribute('aria-label', label);
    b.addEventListener('click', onClick); return b;
  }
  function buildBar() {
    var tools = el('div', { class: 'grp', role: 'group', 'aria-label': '도구' });
    TOOLS.forEach(function (t) {
      var b = btn('tool', null, svg(t[0]) + '<span>' + t[1] + '</span>', function () { setTool(t[0]); }, { 'aria-pressed': String(S.tool === t[0]), 'data-tool': t[0], title: t[1] });
      tools.appendChild(b);
    });
    var cols = el('div', { class: 'grp', role: 'group', 'aria-label': '색' });
    COLORS.forEach(function (c) { cols.appendChild(btn('sw', c[1], '<i style="background:' + c[0] + '"></i>', function () { setColor(c[0]); }, { 'aria-pressed': String(S.color === c[0]), 'data-color': c[0], title: c[1] })); });
    var edits = el('div', { class: 'grp' });
    S.undoBtn = btn('', '되돌리기', svg('undo'), undo, { title: '되돌리기 (Ctrl+Z)', disabled: '' });
    S.clearBtn = btn('', '모두 지우기', svg('clear'), clearAll, { title: '모두 지우기', disabled: '' });
    edits.appendChild(S.undoBtn); edits.appendChild(S.clearBtn);
    S.stEl = el('span', { class: 'st', 'aria-hidden': 'true' });
    var end = el('div', { class: 'end' });
    end.appendChild(btn('cancel', null, '취소', cancel));
    S.doneBtn = btn('done', null, '완료', done);
    end.appendChild(S.doneBtn);
    [tools, el('span', { class: 'sep' }), cols, el('span', { class: 'sep' }), edits, S.stEl, end].forEach(function (x) { S.bar.appendChild(x); });
  }
  function buildPickBar() {
    S.stEl = el('span', { class: 'st' }); S.stEl.textContent = '칸 하나를 누르면 바로 붙어요';
    var end = el('div', { class: 'end' }); end.appendChild(btn('cancel', null, '취소', cancel));
    S.bar.appendChild(S.stEl); S.bar.appendChild(end);
  }
  function setTool(t) { S.tool = t; [].forEach.call(S.bar.querySelectorAll('[data-tool]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-tool') === t)); }); }
  function setColor(c) { S.color = c; [].forEach.call(S.bar.querySelectorAll('[data-color]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-color') === c)); }); if (S.tin) S.tin.style.borderColor = c; }
  function syncBtns() { if (S.undoBtn) { var n = !S.marks.length; S.undoBtn.disabled = n; S.clearBtn.disabled = n; } S.hint.classList.toggle('off', S.marks.length > 0); }
  function undo() { if (!S || !S.marks.length) return; S.marks.pop(); redraw(); syncBtns(); S.live.textContent = '표시 하나를 지웠어요'; }
  function clearAll() { if (!S || !S.marks.length) return; S.marks = []; redraw(); syncBtns(); S.live.textContent = '표시를 모두 지웠어요'; }

  function sizeCanvas() { var r = W.devicePixelRatio || 1; S.cv.width = Math.round(S.vw * r); S.cv.height = Math.round(S.vh * r); S.dpr = r; }
  function redraw() {
    var ctx = S.cv.getContext('2d'); ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); ctx.clearRect(0, 0, S.vw, S.vh);
    if (S.mode === 'pick' && S.hover >= 0 && S.secs[S.hover]) {
      var s = S.secs[S.hover], x = Math.max(2, s.r.x), y = Math.max(2, s.r.y), w = Math.min(S.vw - 2, s.r.x + s.r.w) - x, h = Math.min(S.vh - 2, s.r.y + s.r.h) - y;
      ctx.fillStyle = 'rgba(192,180,225,.28)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#5B49B0'; ctx.lineWidth = 3; ctx.setLineDash([9, 6]); ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3); ctx.setLineDash([]);
      var label = s.label || s.id; ctx.font = '700 14px system-ui,sans-serif'; var tw = ctx.measureText(label).width;
      ctx.fillStyle = '#5B49B0'; ctx.fillRect(x + 6, y + 6, tw + 16, 26); ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + 14, y + 19);
    }
    S.marks.forEach(function (m) { drawMark(ctx, m); });
    if (S.cur) drawMark(ctx, S.cur);
  }
  function pt(e) { return [e.clientX, e.clientY, e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5]; }
  function secAt(x, y) { var best = -1; for (var i = 0; i < S.secs.length; i++) { var r = S.secs[i].r; if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) best = i; } return best; }

  function onDown(e) {
    if (!S || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    try { S.stage.focus({ preventScroll: true }); } catch (x) { /* 없음 */ }
    if (S.tin) { commitText(); return; }
    if (S.mode === 'pick') { S.hover = secAt(e.clientX, e.clientY); redraw(); return; }
    try { S.stage.setPointerCapture(e.pointerId); } catch (x) { /* 없음 */ }
    var p = pt(e);
    if (S.tool === 'text') { openText(p[0], p[1]); return; }
    S.cur = S.tool === 'pen' ? { t: 'pen', color: S.color, size: 7, pen: e.pointerType === 'pen', pts: [p] } : { t: S.tool, color: S.color, x1: p[0], y1: p[1], x2: p[0], y2: p[1] };
    redraw();
  }
  function onMove(e) {
    if (!S) return;
    if (S.mode === 'pick') { var i = secAt(e.clientX, e.clientY); if (i !== S.hover) { S.hover = i; redraw(); } return; }
    if (!S.cur || !e.isPrimary) return;
    var list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    if (!list || !list.length) list = [e];
    if (S.cur.t === 'pen') list.forEach(function (c) { S.cur.pts.push(pt(c)); });
    else { S.cur.x2 = e.clientX; S.cur.y2 = e.clientY; }
    redraw();
  }
  function onUp(e) {
    if (!S) return;
    if (S.mode === 'pick') { if (e.type === 'pointerup') { var i = secAt(e.clientX, e.clientY); if (i >= 0) pickSection(i); } return; }
    var m = S.cur; S.cur = null; if (!m) return;
    var big = m.t === 'pen' || Math.hypot(m.x2 - m.x1, m.y2 - m.y1) > 8;
    if (big) { m.done = true; if (m.t === 'pen' && m.pts.length === 1) m.pts.push([m.pts[0][0] + 0.5, m.pts[0][1] + 0.5, 0.5]); S.marks.push(m); S.live.textContent = '표시했어요'; }
    redraw(); syncBtns();
  }
  function openText(x, y) {
    var t = el('input', { class: 'tin', type: 'text', maxlength: '80', 'aria-label': '표시에 적을 글', placeholder: '적고 Enter' });
    t.style.left = Math.min(x, S.vw - 200) + 'px'; t.style.top = Math.min(y, S.vh - 60) + 'px'; t.style.borderColor = S.color;
    t.addEventListener('keydown', function (e) {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commitText(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeText(); }
    });
    t.addEventListener('blur', function () { setTimeout(function () { if (S && S.tin === t) commitText(); }, 0); });
    S.tin = t; S.tinAt = [x, y]; S.ov.appendChild(t); t.focus();
  }
  function closeText() { if (!S || !S.tin) return; var t = S.tin; S.tin = null; t.remove(); try { S.stage.focus({ preventScroll: true }); } catch (e) { /* 없음 */ } }
  function commitText() {
    if (!S || !S.tin) return;
    var v = S.tin.value.trim().slice(0, 80), at = S.tinAt;
    closeText();
    if (v) { S.marks.push({ t: 'text', color: S.color, x1: Math.min(at[0], S.vw - 60), y1: at[1], text: v, done: true }); redraw(); syncBtns(); }
  }

  function onKey(e) {
    if (!S) return;
    var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (S.sheet) backToMarks(); else cancel(); return; }
    if (e.key === 'Tab') { trap(e); return; }
    if (typing) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(); return; }
    if (S.mode === 'pick' && /^(ArrowDown|ArrowUp|ArrowRight|ArrowLeft)$/.test(e.key)) {
      e.preventDefault();
      var vis = []; S.secs.forEach(function (s, i) { if (inView(s, S.vw, S.vh)) vis.push(i); });
      if (!vis.length) return;
      var k = vis.indexOf(S.hover), d = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
      S.hover = vis[k < 0 ? (d > 0 ? 0 : vis.length - 1) : (k + d + vis.length) % vis.length];
      redraw(); S.live.textContent = (S.secs[S.hover].label || S.secs[S.hover].id) + ' 칸'; return;
    }
    if (e.key === 'Enter' && (!t || t.tagName !== 'BUTTON')) { e.preventDefault(); if (S.mode === 'pick') { if (S.hover >= 0) pickSection(S.hover); } else done(); return; }
    if (/^( |ArrowDown|ArrowUp|PageDown|PageUp|Home|End)$/.test(e.key) && (!t || t.tagName !== 'BUTTON')) e.preventDefault();
  }
  function onWinKey(e) {
    // 초점이 겹 화면 밖(페이지)에 있을 때만: Esc 취소, 스크롤 막기
    if (!S || D.activeElement === S.host) return;
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    else if (/^( |ArrowDown|ArrowUp|PageDown|PageUp|Home|End|Enter)$/.test(e.key)) { e.preventDefault(); try { S.stage.focus({ preventScroll: true }); } catch (x) { /* 없음 */ } }
  }
  function trap(e) {
    var f = [].filter.call(S.root.querySelectorAll('[tabindex="0"],button:not([disabled]),input,textarea'), function (x) { return x.offsetParent !== null || x === S.stage; });
    if (!f.length) return;
    var i = f.indexOf(S.root.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  }
  var rsT = 0;
  function onResize() {
    clearTimeout(rsT);
    rsT = setTimeout(function () {
      if (!S) return; var de = D.documentElement;
      if (de.clientWidth === S.vw && de.clientHeight === S.vh) return;
      S.vw = de.clientWidth; S.vh = de.clientHeight; S.secs = topSections(); sizeCanvas(); redraw();
      S.capErr = false; S.cap = capture().catch(function () { S && (S.capErr = true); return null; }); // 크기가 바뀌면 다시 담음
    }, 180);
  }

  function pickSection(i) {
    var s = S.secs[i]; if (!s) return;
    S.marks = [{ t: 'pick', color: '#5B49B0', x1: Math.max(3, s.r.x + 2), y1: Math.max(3, s.r.y + 2), x2: Math.min(S.vw - 3, s.r.x + s.r.w - 2), y2: Math.min(S.vh - 3, s.r.y + s.r.h - 2), done: true }];
    S.hover = -1; redraw(); finish([s.id]);
  }
  function sectionsUnder() {
    var hits = {}, order = [];
    S.marks.forEach(function (m) { var b = bbox(m); S.secs.forEach(function (s) { var a = overlap(b, s.r); if (a > 0) { if (!(s.id in hits)) { hits[s.id] = 0; order.push(s.id); } hits[s.id] += a; } }); });
    if (!order.length) { // 표시 없이 완료: 화면에 가장 많이 보이는 칸
      var view = { x: 0, y: 0, w: S.vw, h: S.vh };
      S.secs.forEach(function (s) { var a = overlap(view, s.r); if (a > 0) { hits[s.id] = a; order.push(s.id); } });
      return order.sort(function (a, b) { return hits[b] - hits[a]; }).slice(0, 2);
    }
    return order.sort(function (a, b) { return hits[b] - hits[a]; }).slice(0, 4);
  }
  function done() { if (S && S.mode === 'draw' && !S.busy) { if (S.tin) commitText(); finish(sectionsUnder()); } }
  function compose(cap) {
    var scale = cap ? cap.width / S.vw : Math.min(2, W.devicePixelRatio || 1);
    scale = Math.min(scale, MAXW / S.vw);
    var c = D.createElement('canvas'); c.width = Math.round(S.vw * scale); c.height = Math.round(S.vh * scale);
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    if (cap) ctx.drawImage(cap, 0, 0, c.width, c.height);
    else { ctx.fillStyle = '#6A5D5B'; ctx.font = '600 16px system-ui,sans-serif'; ctx.fillText('화면을 담지 못해 표시만 보내요', 16, 28); }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    S.marks.forEach(function (m) { m.path = null; drawMark(ctx, m); });
    var url = '';
    try { url = c.toDataURL('image/png'); } catch (e) { url = ''; }
    // 너무 크면(약 3MB 넘음) 조금씩 줄임
    for (var n = 0; url && url.length > 4e6 && n < 4; n++) {
      var k = 0.8, d = D.createElement('canvas'); d.width = Math.round(c.width * k); d.height = Math.round(c.height * k);
      d.getContext('2d').drawImage(c, 0, 0, d.width, d.height); c = d; url = c.toDataURL('image/png');
    }
    return url;
  }
  function finish(sections) {
    S.busy = true;
    if (S.stEl) S.stEl.textContent = '화면을 담는 중…';
    if (S.doneBtn) S.doneBtn.disabled = true;
    var snap = S;
    snap.cap.then(function (cap) {
      if (S !== snap) return;
      var png = compose(cap);
      var notes = S.marks.filter(function (m) { return m.t === 'text'; }).map(function (m) { return m.text; });
      var out = { type: 'lp-annotated', mode: S.mode, png: png, sections: sections, viewport: { w: S.vw, h: S.vh }, scroll: { x: Math.round(S.sx), y: Math.round(S.sy) }, notes: notes, captured: !!cap };
      if (embedded) { post(out); close(false); }
      else if (endpoint) askNote(out);
      else close(true);
    });
  }
  function cancel() { close(true, true); }
  function close(restore, cancelled) {
    if (!S) return;
    var s = S; S = null;
    W.removeEventListener('keydown', onWinKey, true); W.removeEventListener('resize', onResize);
    try { s.host.remove(); } catch (e) { /* 이미 없음 */ }
    post({ type: 'lp-annotate-state', on: false, cancelled: !!cancelled });
    if (restore && s.focusBack && s.focusBack.focus && s.focusBack !== D.body) try { s.focusBack.focus({ preventScroll: true }); } catch (e) { /* 없음 */ }
  }

  // ── 혼자 쓰기(로컬 검토 서버): 완료 뒤 글을 받아 서버로 보냄 ──
  function backToMarks() { if (!S || !S.sheet) return; S.sheet.remove(); S.sheet = null; S.bar.style.display = ''; S.busy = false; if (S.doneBtn) S.doneBtn.disabled = false; if (S.stEl) S.stEl.textContent = ''; try { S.stage.focus(); } catch (e) { /* 없음 */ } }
  function askNote(out) {
    S.bar.style.display = 'none'; S.hint.classList.add('off');
    var sh = el('form', { class: 'sheet', 'aria-label': '수정 요청 보내기' });
    var img = el('img', { alt: '표시한 화면' }); img.src = out.png;
    var lab = el('label', { class: 'lbl', for: 'lp-note' }); lab.textContent = '무엇을 고칠까요?';
    var ta = el('textarea', { id: 'lp-note', maxlength: '2000', placeholder: '예: 이 제목을 더 짧게 해 주세요' });
    var msg = el('p', { role: 'status', class: 'st' });
    var row = el('div', { class: 'row' });
    var back = el('button', { type: 'button', class: 'cancel' }, '다시 표시'); back.addEventListener('click', backToMarks);
    var send = el('button', { type: 'submit', class: 'done' }, '보내기');
    row.appendChild(back); row.appendChild(send);
    [img, lab, ta, msg, row].forEach(function (x) { sh.appendChild(x); });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); sh.requestSubmit ? sh.requestSubmit() : sh.dispatchEvent(new Event('submit', { cancelable: true })); } });
    sh.addEventListener('submit', function (e) {
      e.preventDefault(); if (send.disabled) return;
      send.disabled = true; msg.textContent = '보내는 중…';
      var body = { text: ta.value.trim().slice(0, 2000), png: out.png, sections: out.sections, notes: out.notes, viewport: out.viewport, scroll: out.scroll, page: location.pathname.slice(0, 200) };
      fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); })
        .then(function (j) { close(true); toast('보냈어요(' + j.id + '번). AI에게 "수정 요청 반영해 줘"라고 말하세요.'); })
        .catch(function (err) { send.disabled = false; msg.textContent = '보내지 못했어요: ' + String(err && err.message || err).slice(0, 120); });
    });
    S.sheet = sh; S.ov.appendChild(sh); ta.focus();
  }
  function toast(text) {
    var h = el('div', { 'data-lp-annotate': '', style: 'all:initial' }), r = h.attachShadow({ mode: 'open' });
    var t = el('div', { role: 'status', style: 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;background:#2B2321;color:#FFFAF7;padding:11px 16px;border-radius:12px;font:600 14px/1.4 system-ui,sans-serif;max-width:calc(100% - 32px)' });
    t.textContent = text; r.appendChild(t); D.documentElement.appendChild(h); setTimeout(function () { h.remove(); }, 4200);
  }
  function floatingButton() {
    var h = el('div', { 'data-lp-annotate': '', style: 'all:initial' }), r = h.attachShadow({ mode: 'open' });
    var st = el('style'); st.textContent = 'button{position:fixed;left:max(14px,env(safe-area-inset-left));bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:2147483600;display:inline-flex;align-items:center;gap:6px;min-height:46px;padding:0 16px;border-radius:14px;border:2px solid #473C3B;background:#C0B4E1;color:#2E2550;font:800 15px/1 "Pretendard Variable",Pretendard,system-ui,sans-serif;box-shadow:3px 3px 0 #473C3B;cursor:pointer}button:focus-visible{outline:3px solid #5B49B0;outline-offset:2px}@media print{button{display:none}}';
    var b = el('button', { type: 'button', title: '화면에 표시해서 고칠 곳을 알려요' }, svg('pen') + '수정 요청');
    b.addEventListener('click', function () { start('draw'); });
    r.appendChild(st); r.appendChild(b); D.documentElement.appendChild(h);
  }

  // ── 부모 창 메시지 ──
  W.addEventListener('message', function (e) {
    if (!embedded || e.source !== W.parent) return;
    var d = e.data; if (!d || typeof d !== 'object') return;
    if (d.type === 'lp-annotate-start') start(d.mode === 'pick' ? 'pick' : 'draw');
    else if (d.type === 'lp-annotate-cancel') close(true, true);
  });
  window.__lpAnnotate = { start: start, cancel: cancel, version: 1 };
  if (embedded) post({ type: 'lp-review-ready' });
  else if (endpoint) { if (D.body) floatingButton(); else D.addEventListener('DOMContentLoaded', floatingButton); }
})();
