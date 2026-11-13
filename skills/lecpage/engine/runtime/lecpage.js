/* lecpage runtime — 참가자 화면. 빌드 도구 없이 동작하는 클래식 스크립트입니다. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var DATA = {};
  try { DATA = JSON.parse(($('#lp-data') || {}).textContent || '{}'); } catch (e) { DATA = {}; }
  var KEY = DATA.key || 'lp';
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(KEY + ':' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(KEY + ':' + k, JSON.stringify(v)); } catch (e) { } },
    del: function (k) { try { localStorage.removeItem(KEY + ':' + k); } catch (e) { } }
  };
  var toastTimer;
  function toast(msg) {
    var t = $('[data-toast]'); if (!t) return;
    t.textContent = msg; t.classList.add('is-on'); clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 2400);
  }
  function el(tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  function copyText(text, okMsg, fallbackEl) {
    function fb() { if (fallbackEl && fallbackEl.select) { fallbackEl.focus(); fallbackEl.select(); toast('글자를 선택했어요. Ctrl+C로 복사해 주세요.'); } else toast('복사하지 못했어요. 직접 선택해 복사해 주세요.'); }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { toast(okMsg || '복사했어요.'); return true; }, function () { fb(); return false; });
    } catch (e) { }
    fb(); return Promise.resolve(false);
  }
  function download(name, text) {
    var url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    var a = el('a'); a.href = url; a.download = name; doc.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }
  window.LecPage = { toast: toast, store: store, data: DATA, copy: copyText };

  /* ── QR ─────────────────────────────── */
  // qr.js(56KB)는 처음에 싣지 않습니다. 공유 대화상자를 열거나 QR 칸이 화면에 가까워지면 불러옵니다.
  // 강사 화면·발표 화면·안내문처럼 QR이 바로 필요한 쪽은 <script>로 먼저 실려 있어 그대로 씁니다.
  var qrLoading = null;
  function needQR() {
    if (window.qrcode) return Promise.resolve(true);
    if (qrLoading) return qrLoading;
    qrLoading = new Promise(function (res) {
      var sc = doc.createElement('script'); sc.src = 'assets/qr.js'; sc.async = true;
      sc.onload = function () { res(true); }; sc.onerror = function () { qrLoading = null; res(false); };
      doc.head.appendChild(sc);
    });
    return qrLoading;
  }
  function qrSvg(text) {
    if (!window.qrcode) return '';
    try {
      if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
      var q = qrcode(0, 'M'); q.addData(text); q.make();
      // 둘레 여백 4칸(QR 규격의 quiet zone): 어두운 바탕·사진 위에서도 읽히게 그림 안에 넣음
      return q.createSvgTag({ cellSize: 6, margin: 24, scalable: true });
    } catch (e) { return ''; }
  }
  window.LecPage.qr = qrSvg; window.LecPage.needQR = needQR;
  // 주소: 파일로 열었거나(file:) 앱 미리보기(about:)면 진짜 주소가 없으니 안내 문구를 보여 줍니다(meta.siteUrl이 있으면 그 주소).
  var LOCAL_PAGE = /^(file|about|blob|data):$/.test(location.protocol);
  var URL_OFF = '인터넷에 올리면 여기에 참가자 주소와 QR이 나와요.';
  // 원래 주소(QR·복사): 강사가 준 사이트 주소, 없으면 지금 페이지 주소. 파일로 열었으면 모름('')
  function siteUrl() {
    if (DATA.siteUrl) return DATA.siteUrl;
    if (LOCAL_PAGE) return '';
    return location.href.split('#')[0].replace(/(check|console|screen|privacy|poster)\.html$/, '');
  }
  // 보여 줄 주소: 원래 주소를 모르면(파일로 연 안내문) 강사가 넣은 짧은 주소라도 글자로 보여 줌. QR·복사에는 쓰지 않음
  function pageUrl() { return siteUrl() || (LOCAL_PAGE ? DATA.shortUrl || '' : ''); }
  // 손으로 칠 주소: 강사가 넣은 짧은 주소가 있으면 그것을 크게 보여 주고 원래 주소는 그 아래 작게.
  // QR과 [주소 복사]는 언제나 원래 주소라서 짧은 주소 서비스가 멈추거나 막혀도 들어올 수 있습니다.
  // 한글이 든 주소(joo.is/우리연수)는 %EC… 대신 한글로 보여 줌
  function bare(u) { var s = String(u || '').replace(/^https?:\/\//, '').replace(/\/$/, ''); try { return decodeURI(s); } catch (e) { return s; } }
  function shortShown() { var s = bare(DATA.shortUrl), u = bare(pageUrl()); return s && u && s !== u ? s : ''; }
  function fillUrls() {
    var u = pageUrl(), s = shortShown();
    $$('[data-url-self]').forEach(function (n) { n.textContent = s || (u ? bare(u) : URL_OFF); });
    $$('[data-url-full]').forEach(function (n) { n.hidden = !s; n.textContent = s ? bare(u) : ''; });
  }
  // 방 안에 있는 사람용 주소(QR·복사): 암호 보호 사이트면 #k=…를 붙여 바로 열리게(보이는 글자에는 붙이지 않음)
  function unlockFrag() { var m = $('meta[name="lp-unlock"]'); return m && m.getAttribute('content') ? '#' + m.getAttribute('content') : ''; }
  // 짧은 주소는 QR·복사에 넣지 않음: 짧은 주소 서비스가 멈추면 못 들어오고, 중간 화면이 있는 서비스에는 #k=(암호)가 보임
  function joinUrl() { var u = siteUrl(); return u ? u.split('#')[0] + unlockFrag() : ''; }
  function siblingUrl(page) {
    if (!LOCAL_PAGE) return location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, '') + page;
    var b = (DATA.base || '').split('#')[0].split('?')[0]; if (!b) return '';
    return (/\.html?$/i.test(b) ? b.replace(/[^/]*$/, '') : b.replace(/\/?$/, '/')) + page;
  }
  function fillQR(n, url, offText) {
    if (url) { n.innerHTML = qrSvg(url); return; }
    n.textContent = ''; n.appendChild(el('span', 'lp-qr-off', offText || URL_OFF));
  }
  function paintQRs() {
    $$('[data-qr]').forEach(function (n) { n.innerHTML = qrSvg(n.getAttribute('data-qr')); });
    $$('[data-qr-self]').forEach(function (n) { if (!n.closest('dialog')) fillQR(n, joinUrl(), pageUrl() ? '인터넷에 올리면 QR이 나와요.' : ''); });
    $$('[data-qr-page]').forEach(function (n) { fillQR(n, siblingUrl(n.getAttribute('data-qr-page')), '인터넷에 올리면 QR이 나와요.'); });
  }
  function drawQRs() {
    // 대화상자 밖에 QR 칸이 있으면(설문 QR·안내문): 이미 실려 있으면 바로, 아니면 화면에 가까워질 때 불러와 그림
    var boxes = $$('[data-qr],[data-qr-page]').concat($$('[data-qr-self]').filter(function (n) { return !n.closest('dialog'); }));
    if (boxes.length) {
      if (window.qrcode) paintQRs();
      else if ('IntersectionObserver' in window) {
        var qio = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { qio.disconnect(); needQR().then(paintQRs); } }, { rootMargin: '600px 0px' });
        boxes.forEach(function (n) { qio.observe(n); });
      } else needQR().then(paintQRs);
    }
    fillUrls();
    $$('[data-url-page]').forEach(function (n) { n.textContent = siblingUrl(n.getAttribute('data-url-page')) || '올린 사이트 주소 + ' + n.getAttribute('data-url-page'); });
  }
  window.LecPage.urls = { page: pageUrl, join: joinUrl, sibling: siblingUrl, short: shortShown, off: URL_OFF };

  /* ── 대화상자: 열 때 누른 버튼을 기억했다가 닫으면 그 버튼으로 초점을 돌려줍니다 ── */
  function closeDialog(d) { if (d.close && d.open) d.close(); else d.removeAttribute('open'); }
  function openDialog(d, opener) {
    if (!d) return;
    d._opener = opener || doc.activeElement;
    if (!d._hooked) {
      d._hooked = true;
      d.addEventListener('close', function () { var o = d._opener; d._opener = null; if (o && o.focus && doc.contains(o)) setTimeout(function () { o.focus(); }, 0); });
      d.addEventListener('click', function (e) { if (e.target === d) closeDialog(d); });
      $$('[data-sheet-close]', d).forEach(function (b) { b.addEventListener('click', function () { closeDialog(d); }); });
    }
    if (d.showModal) { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  }
  // 메뉴 높이만큼 앵커 이동 여백을 맞춤(지금 줄이 생기면 메뉴가 길어짐)
  function fitScrollPad() { var h = $('.lp-nav'); if (h) root.style.scrollPaddingTop = (h.offsetHeight + 16) + 'px'; }
  function goTo(id) {
    var t = doc.getElementById(id); if (!t) return;
    if (location.hash === '#' + id) t.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); else location.hash = id;
    if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
    try { t.focus({ preventScroll: true }); } catch (e) { }
  }

  /* ── 테마·움직임 ───────────────────────── */
  // 가벼운 모드 적용: <html data-motion>을 1로, data-fx-lowpower를 1로. 효과(LecFX)가 시작하기 전에 불러야 함
  var MOTION0 = root.getAttribute('data-motion'), REST0 = root.getAttribute('data-rest');
  function applyLite(on) {
    root.classList.toggle('lp-lite', on); root.classList.toggle('lp-paused', on);
    if (on) {
      if (+MOTION0 > 1) root.setAttribute('data-motion', '1');
      if (+REST0 > 1) root.setAttribute('data-rest', '1');
      root.setAttribute('data-fx-lowpower', '1');
    } else {
      if (MOTION0 !== null) root.setAttribute('data-motion', MOTION0);
      if (REST0 !== null) root.setAttribute('data-rest', REST0);
      root.setAttribute('data-fx-lowpower', '0'); // 직접 껐으면 저사양 기기 자동 낮춤도 하지 않음(사용자 선택이 우선)
    }
  }
  // 저장된 선택(또는 예전의 '움직임 멈춤')을 되살림: 이 스크립트는 효과(LecFX)가 시작하기 전에 실행됨.
  // 선택한 적이 없으면 그대로 두고, 저사양 기기는 효과 쪽(LecFX)이 알아서 한 단계 낮춤
  try {
    var lite0 = localStorage.getItem('lp-lite');
    if (lite0 === '1' || (lite0 === null && localStorage.getItem('lp-motion-paused') === '1')) { applyLite(true); if (window.LecFX) LecFX.pause(); }
    else if (lite0 === '0') root.setAttribute('data-fx-lowpower', '0');
  } catch (e) { }

  // 스크롤 연출(움직임 3단계) 준비: 정말 약한 기기(코어 2개·메모리 2GB 이하)·데이터 절약 모드는 CSS 연출을 쉬게 하고(lp-lowpower),
  // 휴대폰(굵은 포인터·좁은 화면)은 무거운 흐림(backdrop-filter)만 뺌(lp-handheld). 스크롤에 묶인 CSS 움직임은 transform·opacity라 휴대폰에서도 가벼움.
  // 넓은 화면에서는 첫 화면이 포인터에 살짝 반응(--px·--py)
  function initScrollShow() {
    var n = navigator, c = n.connection || {}, mm = window.matchMedia ? function (q) { return matchMedia(q).matches; } : function () { return false; };
    var low = (n.hardwareConcurrency && n.hardwareConcurrency <= 2) || (n.deviceMemory && n.deviceMemory <= 2) || c.saveData;
    if (low && root.getAttribute('data-fx-lowpower') !== '0') root.classList.add('lp-lowpower');
    if (mm('(pointer: coarse)') && innerWidth < 700) root.classList.add('lp-handheld');
    var hero = $('main > .lp-hero');
    if (!hero || RM || +MOTION0 < 3 || !mm('(hover: hover) and (pointer: fine)')) return;
    var q = 0, ex = 0, ey = 0;
    hero.addEventListener('pointermove', function (e) {
      ex = e.clientX; ey = e.clientY; if (q) return;
      q = requestAnimationFrame(function () { q = 0; if (root.classList.contains('lp-paused')) return; var r = hero.getBoundingClientRect(); hero.style.setProperty('--px', ((ex - r.left) / r.width * 2 - 1).toFixed(3)); hero.style.setProperty('--py', ((ey - r.top) / r.height * 2 - 1).toFixed(3)); });
    }, { passive: true });
  }

  function initChrome() {
    var tb = $('[data-theme-toggle]');
    if (tb) tb.addEventListener('click', function () {
      var cur = root.getAttribute('data-theme');
      if (cur === 'auto') cur = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      var next = cur === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('lp-theme', next); } catch (e) { }
    });
    // 가벼운 모드: 움직임을 차분 단계(1)로 낮추고, 무거운 효과(WebGL·외부 라이브러리·끝없이 도는 그림)를 끈 뒤 효과를 다시 시작
    var lb = $('[data-lite-toggle]');
    function setLite(on) {
      applyLite(on);
      if (lb) lb.setAttribute('aria-pressed', String(on));
      try { localStorage.setItem('lp-lite', on ? '1' : '0'); localStorage.setItem('lp-motion-paused', on ? '1' : '0'); } catch (e) { }
      if (window.LecFX) { try { LecFX.stop(); if (on) LecFX.pause(); else LecFX.resume(); LecFX.start(); } catch (e) { } }
      toast(on ? '가벼운 모드를 켰어요. 움직임을 줄였어요.' : '가벼운 모드를 껐어요.');
    }
    if (lb) {
      lb.setAttribute('aria-pressed', String(root.classList.contains('lp-lite')));
      lb.addEventListener('click', function () { setLite(!root.classList.contains('lp-lite')); });
    }

    var share = $('[data-share]'), dlg = $('[data-share-dialog]');
    if (share && dlg) share.addEventListener('click', function () {
      var u = pageUrl(), j = joinUrl(), su = $('[data-share-url]', dlg), off = $('[data-url-off]', dlg), cb = $('[data-copy-url]', dlg);
      if (su) su.textContent = shortShown() || u; if (off) off.hidden = !!u; if (cb) cb.hidden = !j;
      $$('[data-qr-self]', dlg).forEach(function (n) { n.hidden = !j; if (j) needQR().then(function () { fillQR(n, j); }); });
      openDialog(dlg, share);
    });
    var cu = $('[data-copy-url]'); if (cu) cu.addEventListener('click', function () { copyText(joinUrl(), '주소를 복사했어요.'); });

    // 메뉴 '더보기'(데스크톱)와 '목차' 시트(휴대폰)
    var more = $('[data-more]');
    if (more) {
      doc.addEventListener('click', function (e) { if (more.open && !more.contains(e.target)) more.open = false; });
      more.addEventListener('keydown', function (e) { if (e.key === 'Escape' && more.open) { more.open = false; more.querySelector('summary').focus(); } });
      more.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) more.open = false; });
    }
    var tocBtn = $('[data-toc-open]'), toc = $('[data-toc-sheet]');
    if (tocBtn && toc) {
      tocBtn.addEventListener('click', function () { openDialog(toc, tocBtn); var c = $('[data-toc-link][aria-current="true"]', toc); if (c) c.focus(); });
      toc.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('[data-toc-link]'); if (!a) return;
        e.preventDefault(); toc._opener = null; closeDialog(toc); goTo(a.getAttribute('data-toc-link'));
      });
    }
    fitScrollPad(); window.addEventListener('resize', fitScrollPad);

    // 메뉴 현재 위치 + 스크롤 진행 막대
    var links = $$('[data-nav-link]');
    if (links.length && 'IntersectionObserver' in window) {
      var map = {}; links.forEach(function (a) { map[a.getAttribute('data-nav-link')] = a; });
      var tocLinks = $$('[data-toc-link]');
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          links.forEach(function (a) { a.removeAttribute('aria-current'); });
          tocLinks.forEach(function (a) { if (a.getAttribute('data-toc-link') === e.target.id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
          var a = map[e.target.id];
          if (more) more.classList.toggle('is-current', !!(a && more.contains(a)));
          if (a) { a.setAttribute('aria-current', 'true'); if (a.scrollIntoView && a.parentNode.scrollWidth > a.parentNode.clientWidth) a.parentNode.scrollTo({ left: a.offsetLeft - 40, behavior: RM ? 'auto' : 'smooth' }); }
        });
      }, { rootMargin: '-40% 0px -55% 0px' });
      $$('main > section[id]').forEach(function (s) { io.observe(s); });
    }
    var bar = $('[data-scrollbar]');
    if (bar) { var tick = false; window.addEventListener('scroll', function () { if (tick) return; tick = true; requestAnimationFrame(function () { var h = doc.documentElement.scrollHeight - innerHeight; bar.style.setProperty('--p', h > 0 ? Math.min(1, scrollY / h) : 0); tick = false; }); }, { passive: true }); }
  }

  /* ── 복사·프롬프트 ─────────────────────── */
  function initPrompts() {
    // 글 상자는 글이 다 보이는 높이: CSS field-sizing을 모르는 브라우저는 폭이 바뀔 때(처음 보일 때 포함)만 글 높이에 맞춤
    var sized = window.CSS && CSS.supports && CSS.supports('field-sizing', 'content');
    var fit = function (ta) { if (sized || !ta.offsetWidth) return; ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; };
    var ro = !sized && window.ResizeObserver ? new ResizeObserver(function (es) { es.forEach(function (e) { var w = Math.round(e.contentRect.width); if (w && w !== e.target._lpw) { e.target._lpw = w; fit(e.target); } }); }) : null;
    $$('[data-prompt]').forEach(function (ta) {
      var k = 'prompt:' + ta.getAttribute('data-prompt'), orig = ta.value, saved = store.get(k, null);
      var restore = ta.parentNode.querySelector('[data-restore]');
      if (saved !== null && saved !== orig) { ta.value = saved; if (restore) restore.hidden = false; }
      if (ro) ro.observe(ta);
      ta.addEventListener('input', function () { store.set(k, ta.value); if (restore) restore.hidden = ta.value === orig; fit(ta); });
      if (restore) restore.addEventListener('click', function () { ta.value = orig; store.del(k); restore.hidden = true; fit(ta); toast('원문으로 되돌렸어요.'); });
    });
    doc.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-copy]');
      if (b) {
        var box = b.closest('.lp-prompt'); var ta = box && box.querySelector('textarea');
        if (ta) copyText(ta.value, '복사했어요. AI 도구에 붙여 넣으세요.', ta).then(function (ok) { if (ok) { b.classList.add('is-copied'); var s = b.querySelector('span'); var o = s && s.textContent; if (s) s.textContent = '복사됨'; setTimeout(function () { b.classList.remove('is-copied'); if (s) s.textContent = o; }, 1600); } });
        return;
      }
      var c = e.target.closest && e.target.closest('[data-copy-text]');
      if (c) copyText(c.getAttribute('data-copy-text'), '복사했어요.');
    });
  }

  /* ── 일정: 지금 순서 ─────────────────────── */
  function initSchedule() {
    // 기본 시간 레일(.lp-schedule)과 배치 변형(가로 트랙·시계판·시간표·블록: [data-sched])이 같은 표시. 시간 도식의 조각([data-seg])도 함께
    $$('.lp-schedule, [data-sched]').forEach(function (ol) {
      var dg = ol.closest('[data-diagram]');
      var segs = ol.classList.contains('lp-schedule') ? $$('.lp-sched-bar i', ol.parentNode) : dg && dg !== ol ? $$('[data-seg]', dg) : []; // 위의 시간 막대도 같은 표시(지금·지남)
      var rows = ol.tagName === 'TABLE' ? $$('tbody > tr', ol) : $$(':scope > li', ol);
      function upd() {
        var now = new Date(), today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        var mins = now.getHours() * 60 + now.getMinutes();
        var q = /[?&]now=(\d{1,2}):(\d{2})\b/.exec(location.search); // 미리 보기: ?now=15:45 (연수 날 그 시각처럼 표시)
        if (q) { mins = +q[1] * 60 + +q[2]; today = ol.getAttribute('data-date') || today; }
        segs.forEach(function (x) { x.classList.remove('is-now', 'is-done'); });
        rows.forEach(function (li, i) {
          var d = li.getAttribute('data-date') || ol.getAttribute('data-date');
          li.classList.remove('is-now', 'is-done');
          if (d && d !== today) return;
          var s = toMin(li.getAttribute('data-start')), en = toMin(li.getAttribute('data-end'));
          if (s === null) return;
          if (en === null) { var nx = li.nextElementSibling; en = nx ? toMin(nx.getAttribute('data-start')) : s + 30; }
          var st = mins >= s && mins < en ? 'is-now' : mins >= en ? 'is-done' : '';
          if (st) { li.classList.add(st); if (segs[i]) segs[i].classList.add(st); }
        });
      }
      upd(); setInterval(upd, 30000);
    });
  }
  function toMin(t) { var m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  /* ── 본문 배치 변형의 움직임과 조작(runtime/body.css) ──
     · 스크롤 연동 단계(data-rest 2·3)이고 브라우저가 스크롤 연동 애니메이션을 지원하면 html.lp-sdt(동작 줄이기·저사양이면 붙이지 않음)
     · 넘김([data-pager]): 낱말 링크를 누르면 그 판으로 부드럽게, 넘기면 지금 낱말 표시. 링크·스크롤은 JS 없이도 동작
     · 필름 띠([data-film]): 이전·다음 버튼과 지금 장면 번호. 방향키는 띠에 초점이 있을 때 브라우저가 처리
     · 도식 잇기([data-linked]): 목록 줄을 가리키거나 초점이 오면 그림의 같은 번호([data-seg]·[data-node])가 켜짐
     · 질문 색인([data-spy]): 읽고 있는 답의 질문이 색인에서 켜짐 */
  function initBody() {
    // 도표의 '표로 보기'는 인쇄할 때 펼쳐 둠(종이에서는 누를 수 없으므로)
    if ($('details[data-print-open]')) {
      window.addEventListener('beforeprint', function () { $$('details[data-print-open]:not([open])').forEach(function (d) { d.open = true; d.setAttribute('data-print-opened', ''); }); });
      window.addEventListener('afterprint', function () { $$('details[data-print-opened]').forEach(function (d) { d.open = false; d.removeAttribute('data-print-opened'); }); });
    }
    var rest = +(root.getAttribute('data-rest') || 0), sup = window.CSS && CSS.supports && CSS.supports('animation-timeline: view()');
    if (rest >= 2 && sup && !RM && !root.classList.contains('lp-lowpower')) root.classList.add('lp-sdt');
    var smooth = RM ? 'auto' : 'smooth';
    function current(links, i) { links.forEach(function (a, k) { if (k === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }); }
    function nearest(track, kids) { var x = track.scrollLeft, best = 0, d = 1e9; kids.forEach(function (c, i) { var e = Math.abs(c.offsetLeft - track.firstElementChild.offsetLeft - x); if (e < d) { d = e; best = i; } }); return best; }
    $$('[data-pager]').forEach(function (pg) {
      var track = $('.lp-tb-panels', pg), panels = $$('.lp-tb-panel', pg), links = $$('.lp-tb-list a', pg);
      if (!track || !panels.length) return;
      links.forEach(function (a, i) {
        a.addEventListener('click', function (e) { e.preventDefault(); track.scrollTo({ left: panels[i].offsetLeft - panels[0].offsetLeft, behavior: smooth }); current(links, i); });
        a.addEventListener('keydown', function (e) { var k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!k) return; e.preventDefault(); var j = (i + k + links.length) % links.length; links[j].focus(); links[j].click(); });
      });
      var q = 0; track.addEventListener('scroll', function () { if (q) return; q = requestAnimationFrame(function () { q = 0; current(links, nearest(track, panels)); }); }, { passive: true });
    });
    $$('[data-film]').forEach(function (fm) {
      var track = $('.lp-film-track', fm), cards = $$('.lp-film-card', fm), cur = $('[data-film-cur]', fm), nav = $('.lp-film-nav', fm);
      if (!track || !cards.length) return;
      if (nav) nav.hidden = false;
      function go(d) { var i = Math.max(0, Math.min(cards.length - 1, nearest(track, cards) + d)); track.scrollTo({ left: cards[i].offsetLeft - cards[0].offsetLeft, behavior: smooth }); }
      var p = $('[data-film-prev]', fm), n = $('[data-film-next]', fm);
      if (p) p.addEventListener('click', function () { go(-1); });
      if (n) n.addEventListener('click', function () { go(1); });
      var q = 0; track.addEventListener('scroll', function () { if (q) return; q = requestAnimationFrame(function () { q = 0; var i = nearest(track, cards); if (cur) cur.textContent = String(i + 1); if (p) p.disabled = track.scrollLeft < 4; if (n) n.disabled = track.scrollLeft > track.scrollWidth - track.clientWidth - 4; }); }, { passive: true });
      if (p) p.disabled = true;
    });
    $$('[data-linked]').forEach(function (box) {
      var items = $$('ol > li, ul > li, dl > div', box).filter(function (x) { return !x.closest('[aria-hidden="true"]') && x.parentNode.closest('[data-linked]') === box; });
      var segs = $$('[data-seg]', box), nodes = $$('[data-node]', box);
      function hot(i) { [segs, nodes, items].forEach(function (list) { list.forEach(function (x, k) { x.classList.toggle('is-hot', k === i); }); }); }
      items.forEach(function (it, i) {
        it.addEventListener('pointerenter', function () { hot(i); });
        it.addEventListener('focusin', function () { hot(i); });
      });
      box.addEventListener('pointerleave', function () { hot(-1); });
      box.addEventListener('focusout', function (e) { if (!box.contains(e.relatedTarget)) hot(-1); });
    });
    if ('IntersectionObserver' in window) $$('[data-spy]').forEach(function (sp) {
      var links = $$('nav a', sp), items = links.map(function (a) { return doc.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))); });
      var io = new IntersectionObserver(function (ens) { ens.forEach(function (en) { if (en.isIntersecting) current(links, items.indexOf(en.target)); }); }, { rootMargin: '-30% 0px -60% 0px' });
      items.forEach(function (x) { if (x) io.observe(x); });
    });
  }

  /* ── 차시: 날짜로 마침·오늘·다음 표시(상태를 직접 적지 않은 경우) ── */
  function initSessions() {
    $$('[data-sessions-auto]').forEach(function (ol) {
      var today = ymd(new Date()), next = false;
      $$('li[data-date]', ol).forEach(function (li) {
        var d = li.getAttribute('data-date'), st = d < today ? 'done' : d === today ? 'now' : (!next ? (next = true, 'next') : '');
        li.setAttribute('data-status', st);
        var c = $('[data-session-chip]', li); if (c) { c.textContent = { done: '마침', now: '오늘', next: '다음' }[st] || ''; c.hidden = !st; }
      });
    });
  }

  /* ── 연수 전·중·후: 끝난 뒤에는 '연수 후 안내'를 첫 화면 아래로 올리고 회의 입장 버튼을 숨김(?phase=after로 미리 보기) ── */
  function initPhase() {
    var w = DATA.phase; if (!w || !w.end) return;
    var now = new Date(), q = /[?&]phase=(before|during|after)\b/.exec(location.search);
    var phase = q ? q[1] : now > new Date(w.end) ? 'after' : now >= new Date(w.start) ? 'during' : 'before';
    root.setAttribute('data-phase', phase);
    heroState(phase, w);
    if (phase !== 'after') return;
    $$('[data-phase-hide="after"]').forEach(function (n) { n.hidden = true; });
    $$('[data-phase-show="after"]').forEach(function (n) { n.hidden = false; });
    var fu = $('[data-followup]'), hero = $('main > .lp-hero');
    if (fu && hero) { var at = hero.nextElementSibling; if (at && at.classList.contains('lp-divider')) at = at.nextElementSibling; if (at !== fu) hero.parentNode.insertBefore(fu, at); }
    var bar = $('[data-phase-bar]'); if (bar) { bar.hidden = false; fitScrollPad(); }
  }

  // 첫 화면 한 줄: 연수 전 '시작까지 3일'(이틀 안쪽이면 시간·분), 연수 중 '지금 진행 중', 끝나면 '끝난 연수'
  function heroState(phase, w) {
    var box = $('[data-hero-state]'), out = box && $('[data-hero-state-text]', box); if (!out) return;
    function left() {
      var ms = new Date(w.start) - new Date();
      if (ms <= 0) return '곧 시작해요';
      var min = Math.ceil(ms / 60000);
      if (min < 60) return '시작까지 ' + min + '분';
      if (min < 48 * 60) return '시작까지 ' + Math.floor(min / 60) + '시간';
      return '시작까지 ' + Math.floor(min / 1440) + '일';
    }
    if (phase === 'before') { out.textContent = left(); if (new Date(w.start) - new Date() < 48 * 3600000) setInterval(function () { out.textContent = left(); }, 30000); }
    else out.textContent = phase === 'during' ? '지금 진행 중' : '끝난 연수';
    box.hidden = false;
  }

  /* ── 준비 점검·접속 확인 ──────────────────── */
  function initReadiness() {
    $$('[data-checklist]').forEach(function (ul) {
      var k = 'check:' + ul.getAttribute('data-checklist'), st = store.get(k, {});
      $$('input[data-check]', ul).forEach(function (cb) {
        cb.checked = !!st[cb.getAttribute('data-check')];
        cb.addEventListener('change', function () { st[cb.getAttribute('data-check')] = cb.checked; store.set(k, st); });
      });
    });
    $$('[data-diag]').forEach(function (box) {
      var run = $('[data-diag-run]', box);
      function probe(url) {
        return new Promise(function (res) {
          var done = false, t = setTimeout(function () { if (!done) { done = true; res('fail'); } }, 7000);
          try {
            fetch(url, { mode: 'no-cors', cache: 'no-store', credentials: 'omit' }).then(function () { if (!done) { done = true; clearTimeout(t); res('ok'); } }, function () { if (!done) { done = true; clearTimeout(t); res('fail'); } });
          } catch (e) { done = true; clearTimeout(t); res('fail'); }
        });
      }
      function go() {
        var items = $$('li[data-url]', box);
        items.forEach(function (li) { li.setAttribute('data-state', 'wait'); $('.lp-diag-state', li).textContent = '확인 중'; });
        return Promise.all(items.map(function (li) {
          return probe(li.getAttribute('data-url')).then(function (r) { li.setAttribute('data-state', r); $('.lp-diag-state', li).textContent = r === 'ok' ? '열림' : '막힘'; });
        })).then(function () {
          var bad = items.filter(function (li) { return li.getAttribute('data-state') === 'fail'; }).length;
          toast(bad ? '열리지 않는 곳이 ' + bad + '개 있어요.' : '모두 열려요.');
        });
      }
      if (run) run.addEventListener('click', go);
      if (box.hasAttribute('data-diag-auto')) go();
      var env = $('[data-env]', box);
      if (env) env.textContent = '브라우저: ' + navigator.userAgent.replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').slice(0, 140) + ' · 화면 ' + innerWidth + '×' + innerHeight + (navigator.onLine === false ? ' · 오프라인' : '');
      var cp = $('[data-diag-copy]', box);
      if (cp) cp.addEventListener('click', function () {
        var lines = $$('li[data-url]', box).map(function (li) { return (li.getAttribute('data-state') === 'ok' ? '[열림] ' : li.getAttribute('data-state') === 'fail' ? '[막힘] ' : '[미확인] ') + li.querySelector('small').textContent; });
        var lv = $('[data-live-diag]', box);
        copyText(['접속 확인 결과 (' + new Date().toLocaleString('ko-KR') + ')', location.href].concat(lines, lv ? [lv.textContent] : [], env ? [env.textContent] : []).join('\n'), '결과를 복사했어요.');
      });
      var lvd = $('[data-live-diag]', box);
      if (lvd && DATA.live && window.LecLive) {
        try {
          var lv = LecLive.create(DATA.live);
          lv.connect().then(function (r) { lvd.textContent = '실시간 연결 방식: ' + ({ realtime: '실시간(웹소켓)', polling: '새로 읽기(5~10초)', local: '이 기기 안에서만' }[r && r.mode] || (r && r.mode) || '알 수 없음'); }, function (e) { lvd.textContent = '실시간 서버에 연결하지 못했어요: ' + (e && e.message || e); });
        } catch (e) { lvd.textContent = '실시간 서버에 연결하지 못했어요.'; }
      }
    });
  }

  /* ── 교재 보기 ─────────────────────────── */
  var deckApi = null;
  function initDeck() {
    var deck = $('[data-deck]'); if (!deck) return;
    var slides = $$('.lp-slide', deck); if (!slides.length) return;
    var stage = $('.lp-deck-stage', deck), bar = $('.lp-deck-bar', deck), cur = 0;
    deck.classList.add('is-ready'); bar.hidden = false;
    var thumbs = el('div', 'lp-deck-thumbs'); thumbs.setAttribute('aria-label', '쪽 미리보기');
    slides.forEach(function (s, i) {
      var b = el('button'); b.type = 'button';
      var img = s.querySelector('img');
      // 그림만 있는 버튼은 쪽 번호를 이름으로, 글자가 보이는 버튼은 보이는 글자가 곧 이름(접근성: 이름과 보이는 글이 같아야 함)
      if (img) { b.setAttribute('aria-label', s.getAttribute('data-page') + '쪽'); var t = el('img'); t.loading = 'lazy'; t.alt = ''; t.src = img.src; b.appendChild(t); img._lpThumb = t; } else b.appendChild(thumbText(s));
      b.addEventListener('click', function () { go(i); });
      thumbs.appendChild(b);
    });
    bar.parentNode.insertBefore(thumbs, bar.nextSibling);
    // 그림 주소가 나중에 바뀌면(암호 보호 사이트의 blob: 주소) 미리보기도 따라 바꿈
    if (window.MutationObserver) new MutationObserver(function (ms) { ms.forEach(function (m) { if (m.target._lpThumb) m.target._lpThumb.src = m.target.src; }); }).observe(stage, { attributes: true, attributeFilter: ['src'], subtree: true });
    function go(i, opt) {
      cur = Math.max(0, Math.min(slides.length - 1, i));
      slides.forEach(function (s, k) { s.classList.toggle('is-active', k === cur); });
      $('[data-deck-cur]', deck).textContent = slides[cur].getAttribute('data-page');
      $$('button', thumbs).forEach(function (b, k) { if (k === cur) { b.setAttribute('aria-current', 'true'); if (b.scrollIntoView && !(opt && opt.quiet)) thumbs.scrollTo({ left: b.offsetLeft - thumbs.clientWidth / 2 + 56, behavior: RM ? 'auto' : 'smooth' }); } else b.removeAttribute('aria-current'); });
      [cur + 1, cur + 2].forEach(function (k) { var im = slides[k] && slides[k].querySelector('img'); if (im) im.loading = 'eager'; });
    }
    $('[data-deck-prev]', deck).addEventListener('click', function () { go(cur - 1); });
    $('[data-deck-next]', deck).addEventListener('click', function () { go(cur + 1); });
    stage.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight' || e.key === 'PageDown') { go(cur + 1); e.preventDefault(); } if (e.key === 'ArrowLeft' || e.key === 'PageUp') { go(cur - 1); e.preventDefault(); } });
    var sx = null; stage.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', function (e) { if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1)); sx = null; });
    var fb = $('[data-deck-full]', deck);
    if (fb) { if (!deck.requestFullscreen) fb.hidden = true; else fb.addEventListener('click', function () { (doc.fullscreenElement ? doc.exitFullscreen() : deck.requestFullscreen()).catch(function () { }); }); }
    var ob = $('[data-deck-overview]', deck);
    if (ob) ob.addEventListener('click', function () { overview(slides, function (i) { go(i); stage.focus(); }); });
    function fromHash() { var m = /^#deck-p(\d+)$/.exec(location.hash); if (!m) return false; var i = slides.findIndex(function (s) { return s.getAttribute('data-page') === m[1]; }); if (i >= 0) { go(i); deck.scrollIntoView({ block: 'start', behavior: RM ? 'auto' : 'smooth' }); } return true; }
    window.addEventListener('hashchange', fromHash);
    if (!fromHash()) go(0, { quiet: true });
    deckApi = { go: function (page) { var i = slides.findIndex(function (s) { return +s.getAttribute('data-page') === +page; }); if (i >= 0) go(i); }, follow: function () { var c = $('[data-deck-follow]', deck); return !c || c.checked; }, showFollow: function () { var l = $('.lp-follow', deck); if (l) l.hidden = false; } };
  }
  // 글만 있는 쪽의 작은 미리보기: 쪽 번호 + 제목(표지·부 시작은 큰 슬라이드와 같은 바탕)
  function thumbText(s) {
    var t = el('span', 'lp-thumb-t'), st = s.querySelector('.lp-slide-text'), h = st && st.querySelector('h3');
    if (st) t.setAttribute('data-kind', st.getAttribute('data-kind') || 'body');
    t.appendChild(el('b', '', s.getAttribute('data-page'))); t.appendChild(el('i', '', (h && h.textContent) || s.getAttribute('data-title') || ''));
    return t;
  }
  function overview(slides, pick) {
    var ov = el('div', 'lp-overview'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', '전체 쪽 보기');
    var h = el('div', 'lp-overview-h'); var inp = el('input'); inp.type = 'search'; inp.placeholder = '제목·내용으로 찾기'; inp.setAttribute('aria-label', '쪽 찾기');
    var close = el('button', 'lp-btn lp-btn-ghost', '닫기'); close.type = 'button';
    h.appendChild(inp); h.appendChild(close); ov.appendChild(h);
    var grid = el('div', 'lp-overview-grid'); ov.appendChild(grid);
    var btns = slides.map(function (s, i) {
      var b = el('button'); b.type = 'button'; var img = s.querySelector('img');
      if (img) { var t = el('img'); t.loading = 'lazy'; t.alt = ''; t.src = img.src; b.appendChild(t); b.appendChild(el('span', '', s.getAttribute('data-page') + '. ' + (s.getAttribute('data-title') || ''))); }
      else b.appendChild(thumbText(s));
      b.addEventListener('click', function () { done(); pick(i); });
      b._q = ((s.getAttribute('data-title') || '') + ' ' + (s.getAttribute('data-text') || '')).toLowerCase();
      grid.appendChild(b); return b;
    });
    inp.addEventListener('input', function () { var q = inp.value.trim().toLowerCase(); btns.forEach(function (b) { b.hidden = !!q && b._q.indexOf(q) < 0; }); });
    function done() { ov.remove(); doc.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') done(); }
    close.addEventListener('click', done); doc.addEventListener('keydown', esc);
    doc.body.appendChild(ov); inp.focus();
  }

  /* ── 실습 ─────────────────────────────── */
  var stApi = null;
  function initStations() {
    var shell = $('[data-stations]'); if (!shell) return;
    var arts = $$('.lp-st', shell); if (!arts.length) return;
    var links = $$('[data-st-link]', shell);
    var done = store.get('done', []), cur = -1;
    var layout = shell.getAttribute('data-layout');
    if (layout !== 'scroll') shell.classList.add('is-ready');
    function idOf(i) { return arts[i].getAttribute('data-st'); }
    function paint() {
      links.forEach(function (a) { a.classList.toggle('is-done', done.indexOf(a.getAttribute('data-st-link')) >= 0); });
      // 첫 화면 실습지(종이 워크북)의 체크 칸도 함께
      $$('[data-hero-st]').forEach(function (a) { a.classList.toggle('is-done', done.indexOf(a.getAttribute('data-hero-st')) >= 0); });
      $$('[data-done]', shell).forEach(function (b) {
        var id = b.closest('.lp-st').getAttribute('data-st'), on = done.indexOf(id) >= 0;
        b.setAttribute('aria-pressed', String(on)); b.querySelector('span').textContent = on ? '완료했어요' : '완료 체크';
      });
      var c = $('[data-st-count]', shell); if (c) c.textContent = done.length + ' / ' + arts.length;
      var p = $('[data-st-progress]', shell); if (p) p.value = done.length;
    }
    function show(i, scroll) {
      if (i < 0 || i >= arts.length) return;
      cur = i;
      arts.forEach(function (a, k) { a.classList.toggle('is-active', k === i); });
      links.forEach(function (a, k) { if (k === i) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current'); });
      store.set('last', idOf(i));
      if (scroll && layout !== 'scroll') shell.scrollIntoView({ block: 'start', behavior: RM ? 'auto' : 'smooth' });
      if (live.ready) live.progress(idOf(i), done.indexOf(idOf(i)) >= 0 ? 'done' : 'doing');
    }
    function fromHash(scroll) { var m = /^#st-(.+)$/.exec(location.hash); if (!m) return false; var i = arts.findIndex(function (a) { return a.getAttribute('data-st') === decodeURIComponent(m[1]); }); if (i >= 0) { show(i, scroll); return true; } return false; }
    window.addEventListener('hashchange', function () { fromHash(true); });
    if (!fromHash(false)) { var last = store.get('last', null); var li = last ? arts.findIndex(function (a) { return a.getAttribute('data-st') === last; }) : 0; show(li < 0 ? 0 : li, false); }
    shell.addEventListener('click', function (e) {
      var b = e.target.closest('[data-done]');
      if (b) {
        var id = b.closest('.lp-st').getAttribute('data-st'), k = done.indexOf(id);
        if (k >= 0) { done.splice(k, 1); toast('완료 체크를 풀었어요.'); } else { done.push(id); toast('완료했어요.'); } // 완료 반응은 체크가 그려지는 차분한 움직임(CSS)뿐: 실습 칸은 1단계까지만
        store.set('done', done); paint();
        if (live.ready) live.progress(id, k >= 0 ? 'doing' : 'done');
        return;
      }
      var s = e.target.closest('[data-stuck]');
      if (s) live.help(s.closest('.lp-st').getAttribute('data-st'));
    });
    $$('[data-memo]', shell).forEach(function (ta) {
      var k = 'memo:' + ta.getAttribute('data-memo'); ta.value = store.get(k, '');
      ta.addEventListener('input', function () { store.set(k, ta.value); });
    });
    var ex = $('[data-st-export]', shell);
    if (ex) ex.addEventListener('click', function () {
      var t = (DATA.title || '연수') + ' · 나의 실습 기록\n' + new Date().toLocaleDateString('ko-KR') + '\n\n';
      arts.forEach(function (a, i) {
        var id = a.getAttribute('data-st');
        t += (done.indexOf(id) >= 0 ? '[완료] ' : '[진행 전] ') + String(i + 1).padStart(2, '0') + ' ' + a.querySelector('h3').textContent + '\n';
        var memo = store.get('memo:' + id, ''); if (memo) t += '  메모: ' + memo.replace(/\n/g, '\n        ') + '\n';
        $$('[data-prompt]', a).forEach(function (ta) { var v = store.get('prompt:' + ta.getAttribute('data-prompt'), null); if (v !== null) t += '  고친 프롬프트: ' + v.replace(/\n/g, ' ') + '\n'; });
        t += '\n';
      });
      download((DATA.title || '연수').replace(/[\\/:*?"<>|]/g, '') + '_나의기록.txt', t); toast('실습 기록을 내려받았어요.');
    });
    paint();
    stApi = { go: function (id) { var i = arts.findIndex(function (a) { return a.getAttribute('data-st') === id; }); if (i >= 0 && i !== cur) { show(i, true); toast('강사가 보는 실습으로 이동했어요.'); } }, current: function () { return cur >= 0 ? idOf(cur) : null; }, done: function () { return done.slice(); } };
  }

  /* ── 퀴즈·기록 ─────────────────────────── */
  function initQuiz() {
    $$('[data-quiz] li').forEach(function (li) {
      li.addEventListener('change', function (e) {
        var r = e.target; if (!r || r.type !== 'radio') return;
        $$('label', li).forEach(function (l) { l.classList.remove('is-right', 'is-wrong'); });
        var ok = r.getAttribute('data-correct') === '1';
        r.closest('label').classList.add(ok ? 'is-right' : 'is-wrong');
        if (!ok) { var right = li.querySelector('input[data-correct="1"]'); if (right) right.closest('label').classList.add('is-right'); }
        var fb = $('.lp-quiz-fb', li); fb.hidden = false; fb.textContent = (ok ? '정답이에요. ' : '아쉬워요. ') + (fb.getAttribute('data-explain') || '');
      });
    });
    $$('[data-reflect]').forEach(function (f) {
      var k = 'reflect:' + f.getAttribute('data-reflect'), st = store.get(k, {});
      $$('textarea', f).forEach(function (ta) { var q = ta.getAttribute('data-reflect-q'); ta.value = st[q] || ''; ta.addEventListener('input', function () { st[q] = ta.value; store.set(k, st); }); });
      var b = $('[data-reflect-save]', f);
      if (b) b.addEventListener('click', function () {
        var t = (DATA.title || '연수') + ' · 나의 기록\n\n';
        $$('label', f).forEach(function (l) { t += '■ ' + l.querySelector('span').textContent + '\n' + (l.querySelector('textarea').value || '(비어 있음)') + '\n\n'; });
        download((DATA.title || '연수').replace(/[\\/:*?"<>|]/g, '') + '_나의기록.txt', t); toast('내려받았어요.');
      });
    });
  }

  /* ── 실시간 ─────────────────────────────── */
  var live = { ready: false, progress: function () { }, help: function () { toast('참여 기능이 꺼져 있어요. 손을 들어 강사에게 알려 주세요.'); } };
  function initLive() {
    if (!DATA.live || !window.LecLive || !$('[data-dock]') && !$('[data-qa]') && !$('[data-board]') && !$('[data-survey]')) return;
    var conn;
    try { conn = LecLive.create(DATA.live); } catch (e) { return; }
    var me = store.get('me', null), feats = DATA.live.features || [];
    var dock = $('[data-dock]'), dot = $('[data-live-status]');
    var qs = {}, posts = {}, answers = {}, state = {}, voted = store.get('voted', {});
    var X = LecLive.util.ext, U = LecLive.util;
    if (dock && root.getAttribute('data-phase') !== 'after') { // 끝난 연수에는 도움 요청·신호 도크를 띄우지 않음
      dock.hidden = false; root.classList.add('lp-dock-on');
      // 도크 높이(휴대폰에서는 두 줄이 되기도 함)를 --lp-dock-h로: Tab으로 옮긴 칸이 도크 밑에 숨지 않게 scroll-padding-bottom에 씀(lecpage.css)
      var dockH = function () { root.style.setProperty('--lp-dock-h', dock.offsetHeight + 'px'); };
      dockH(); if ('ResizeObserver' in window) new ResizeObserver(dockH).observe(dock);
      // 첫 화면이 화면 아래쪽에 걸려 있는 동안은 도크를 감춤(첫 화면 오른쪽 아래를 가리지 않게). 지나가면 나타남
      var hero0 = $('main > .lp-hero');
      if (hero0 && scrollY < innerHeight * 0.5) root.classList.add('lp-hero-in');
      if (hero0 && 'IntersectionObserver' in window) {
        new IntersectionObserver(function (es) {
          var on = es[es.length - 1].isIntersecting;
          if (on && dock.contains(doc.activeElement)) return; // 도크를 쓰는 중이면 그대로 둠
          root.classList.toggle('lp-hero-in', on);
        }, { rootMargin: '-78% 0px 0px 0px' }).observe(hero0);
      }
    }
    $$('[data-live-off]').forEach(function (n) { n.hidden = true; });
    if (feats.indexOf('help') >= 0) $$('[data-stuck]').forEach(function (b) { b.hidden = false; });
    if (deckApi) deckApi.showFollow();

    function liveErr(err, dflt) { return err && /^(locked|poll_closed|rate_limited|too_long|hidden|reserved_nickname|uploads_disabled)$/.test(err.code) && err.message ? err.message : dflt; }
    // 연결이 끊긴 동안 쌓아 둔 글이 나중에 거절되면(잠금·닫힌 투표 등) 조용히 사라지지 않게 알림
    if (conn.on) conn.on('error', function (err, op) { if (op && err && err.status && err.status < 500) toast(liveErr(err, '보내지 못한 기록이 있어요. 다시 해 주세요.')); });
    function setStatus(s) { if (dot) { dot.setAttribute('data-state', s); dot.title = { live: '실시간 연결됨', polling: '새로 읽는 중(느린 연결)', offline: '연결 끊김', connecting: '연결 중', local: '이 기기 안에서만' }[s] || s; } }
    setStatus('connecting');
    function ensureJoin() {
      if (me && me.token) return Promise.resolve(me);
      var dlg = $('[data-join-dialog]');
      return new Promise(function (resolve, reject) {
        if (!dlg) return reject(new Error('no dialog'));
        var f = $('[data-join-form]', dlg);
        function onSubmit(e) {
          e.preventDefault();
          var fd = new FormData(f), prof = { nickname: (fd.get('nickname') || '').trim(), name: (fd.get('name') || '').trim() || undefined, school: (fd.get('school') || '').trim() || undefined, consent: !!fd.get('consent') };
          conn.join(prof).then(function (r) { me = { id: r.id, token: r.token, nickname: prof.nickname }; store.set('me', me); dlg.close(); cleanup(); resolve(me); }, function (err) { toast('참여하지 못했어요: ' + (err && err.message || '잠시 뒤 다시 해 주세요.')); });
        }
        function onCancel() { dlg.close(); cleanup(); reject(new Error('cancel')); }
        function cleanup() { f.removeEventListener('submit', onSubmit); var c = $('[data-join-cancel]', dlg); if (c) c.removeEventListener('click', onCancel); }
        f.addEventListener('submit', onSubmit); var c = $('[data-join-cancel]', dlg); if (c) c.addEventListener('click', onCancel);
        dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', '');
      });
    }

    // 질문
    var qaBox = $('[data-qa]'), sortBy = 'votes';
    function drawQA() {
      if (!qaBox) return;
      var list = $('[data-qa-list]', qaBox);
      var arr = Object.keys(qs).map(function (k) { return qs[k]; }).filter(function (q) { return q.status !== 'hidden'; });
      arr.sort(function (a, b) { if (!!b.pinned - !!a.pinned) return !!b.pinned - !!a.pinned; return sortBy === 'votes' ? ((b.votes || 0) - (a.votes || 0) || (b.createdAt || 0) - (a.createdAt || 0)) : (b.createdAt || 0) - (a.createdAt || 0); });
      list.textContent = '';
      var hl = $('[data-hero-live]'); if (hl) { hl.hidden = false; $('[data-hero-live-n]', hl).textContent = arr.length; } // 첫 화면 유리 칸: 지금 올라온 질문 수
      if (!arr.length) { list.appendChild(el('li', 'lp-empty', '아직 질문이 없어요. 첫 질문을 올려 주세요.')); return; }
      arr.forEach(function (q) {
        var li = el('li', 'lp-qa-item' + (q.pinned ? ' is-pinned' : '') + (q.status === 'answered' ? ' is-answered' : ''));
        var v = el('button', 'lp-vote'); v.type = 'button'; v.setAttribute('aria-pressed', String(!!voted[q.id])); v.setAttribute('aria-label', '공감 ' + (q.votes || 0));
        v.appendChild(el('span', '', '▲')); v.appendChild(el('b', '', String(q.votes || 0)));
        v.addEventListener('click', function () { if (voted[q.id]) return toast('이미 공감했어요.'); ensureJoin().then(function () { return conn.vote(q.id); }).then(function (r) { voted[q.id] = 1; store.set('voted', voted); if (r && r.votes !== undefined) { q.votes = r.votes; drawQA(); } }, function (err) { if (err && err.message !== 'cancel') toast(liveErr(err, '공감을 보내지 못했어요.')); }); });
        var body = el('div'); body.appendChild(el('p', '', q.text));
        var meta = el('p', 'lp-qa-meta'); meta.appendChild(el('span', '', q.anonymous || !q.nickname ? '익명' : q.nickname)); if (q.status === 'answered') meta.appendChild(el('span', '', '답변 완료')); if (q.pinned) meta.appendChild(el('span', '', '강사 고정'));
        body.appendChild(meta); li.appendChild(v); li.appendChild(body); list.appendChild(li);
      });
    }
    if (qaBox) {
      var qf = $('[data-qa-form]', qaBox), cnt = $('[data-count]', qaBox);
      qf.querySelector('textarea').addEventListener('input', function (e) { if (cnt) cnt.textContent = e.target.value.length + ' / 500'; });
      qf.addEventListener('submit', function (e) {
        e.preventDefault(); var ta = qf.querySelector('textarea'), text = ta.value.trim(); if (!text) return;
        ensureJoin().then(function () { return conn.add('questions', { text: text, anonymous: DATA.live.anonymous !== false, nickname: me.nickname }); }).then(function (d) { if (d && d.id) qs[d.id] = d; ta.value = ''; if (cnt) cnt.textContent = '0 / 500'; drawQA(); toast('질문을 올렸어요.'); }, function (err) { if (err && err.message !== 'cancel') toast(liveErr(err, '질문을 올리지 못했어요. 잠시 뒤 다시 해 주세요.')); });
      });
      $$('[data-sort]', qaBox).forEach(function (b) { b.addEventListener('click', function () { sortBy = b.getAttribute('data-sort'); $$('[data-sort]', qaBox).forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); }); drawQA(); }); });
    }

    // 보드
    var bBox = $('[data-board]'), cat = '';
    function drawBoard() {
      if (!bBox) return;
      var list = $('[data-board-list]', bBox);
      var arr = Object.keys(posts).map(function (k) { return posts[k]; }).filter(function (p) { return !p.hidden && (!cat || p.kind === cat); }).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      list.textContent = '';
      if (!arr.length) { list.appendChild(el('li', 'lp-empty', '아직 올라온 글이 없어요. 첫 글을 올려 주세요.')); return; }
      arr.forEach(function (p) {
        var li = el('li', 'lp-card lp-post');
        if (p.files && p.files.length) {
          var fl = el('div', 'lp-post-files');
          p.files.forEach(function (f) {
            if (!/^(https?:|blob:|data:image)/.test(f.url || '')) return;
            var t = f.type || '', n;
            if (t.indexOf('image/') === 0) { n = el('img'); n.src = f.url; n.alt = f.name || ''; n.loading = 'lazy'; }
            else if (t.indexOf('audio/') === 0) { n = el('audio'); n.controls = true; n.preload = 'none'; n.src = f.url; }
            else if (t.indexOf('video/') === 0) { n = el('video'); n.controls = true; n.preload = 'none'; n.src = f.url; }
            else { n = el('a', 'lp-link', f.name || '파일 열기'); n.href = f.url; n.target = '_blank'; n.rel = 'noopener'; }
            fl.appendChild(n);
          });
          li.appendChild(fl);
        }
        if (p.text) li.appendChild(el('p', '', p.text));
        var ft = el('div', 'lp-post-f'); ft.appendChild(el('span', '', (p.nickname || '익명') + ' · ' + new Date(p.createdAt || Date.now()).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })));
        if (conn.like) {
          var lk = el('button', 'lp-like'); lk.type = 'button';
          var liked = !!store.get('like:' + p.id, false);
          lk.setAttribute('aria-pressed', String(liked)); lk.setAttribute('aria-label', '좋아요 ' + (p.likes || 0));
          lk.textContent = '♥ ' + (p.likes || 0);
          lk.addEventListener('click', function () {
            if (store.get('like:' + p.id, false)) return toast('이미 좋아요를 눌렀어요.');
            ensureJoin().then(function () { return conn.like(p.id); }).then(function (r) { store.set('like:' + p.id, true); p.likes = (r && r.likes !== undefined) ? r.likes : (p.likes || 0) + 1; drawBoard(); }, function (err) { if (err && err.message !== 'cancel') toast(liveErr(err, '좋아요를 보내지 못했어요.')); });
          });
          ft.appendChild(lk);
        }
        li.appendChild(ft); list.appendChild(li);
      });
    }
    if (bBox) {
      var bf = $('[data-board-form]', bBox), maxFiles = +bBox.getAttribute('data-max-files') || 0;
      $('[data-board-write]', bBox).addEventListener('click', function () { ensureJoin().then(function () { bf.hidden = false; bf.querySelector('textarea').focus(); }, function () { }); });
      $('[data-board-cancel]', bBox).addEventListener('click', function () { bf.hidden = true; });
      $$('[data-cat]', bBox).forEach(function (b) { b.addEventListener('click', function () { cat = b.getAttribute('data-cat'); $$('[data-cat]', bBox).forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); }); drawBoard(); }); });
      bf.addEventListener('submit', function (e) {
        e.preventDefault(); var fd = new FormData(bf), files = (bf.querySelector('input[type=file]') || {}).files || [];
        if (files.length > maxFiles) return toast('파일은 ' + maxFiles + '개까지 올릴 수 있어요.');
        var btn = bf.querySelector('[type=submit]'); btn.disabled = true; toast('올리는 중이에요…');
        var ups = Array.prototype.slice.call(files).map(function (f) { return conn.upload(f); });
        Promise.all(ups).then(function (fs) { return conn.add('posts', { kind: fd.get('kind') || '', text: (fd.get('text') || '').trim(), nickname: me.nickname, files: fs, license: fd.get('license') || 'own' }); })
          .then(function (d) { if (d && d.id) posts[d.id] = d; bf.reset(); bf.hidden = true; drawBoard(); toast(d && d.hidden ? '보냈어요. 강사가 확인하면 보드에 보여요.' : '올렸어요.'); }, function (err) { toast('올리지 못했어요: ' + (err && err.message || '파일 크기나 종류를 확인해 주세요.')); })
          .then(function () { btn.disabled = false; });
      });
    }

    // 투표: 설계도의 문항(data-poll) + 강사 화면에서 바로 띄운 즉석 투표(polls 모음, 질문 한 줄·보기 2~5개)
    var pollBox = $('[data-poll]'), pollDefs = [], quick = {};
    try { pollDefs = JSON.parse(pollBox ? pollBox.getAttribute('data-poll') : '[]'); } catch (e) { }
    function openPoll() {
      var id = state.openPoll; if (!id) return null;
      var p = pollDefs.filter(function (x) { return x.id === id; })[0]; if (p) return p;
      var q = quick[id];
      return q && q.question && Array.isArray(q.options) && q.options.length ? { id: q.id, question: q.question, kind: 'choice', options: q.options } : null;
    }
    // 투표 칸이 없는 사이트에서 즉석 투표가 열리면 마무리 앞에 칸을 만듦(자료 링크와 같은 방식)
    function ensurePollBox() {
      if (pollBox) return pollBox;
      var s = el('section', 'lp-sec lp-sec-poll'); s.id = 'live-poll'; s.setAttribute('data-frame', 'plain');
      var w = el('div', 'lp-wrap'), h = el('header', 'lp-head'); h.appendChild(el('h2', 'lp-h2', '투표')); w.appendChild(h);
      var box = el('div', 'lp-poll'); box.setAttribute('data-poll', '[]');
      var live0 = el('div', 'lp-poll-live'); live0.setAttribute('data-poll-live', ''); box.appendChild(live0);
      w.appendChild(box); s.appendChild(w);
      var before = $('.lp-sec-closing'), main = $('main');
      if (before && before.parentNode) before.parentNode.insertBefore(s, before); else if (main) main.appendChild(s); else return null;
      pollBox = box; return box;
    }
    function pollSecId() { var s = pollBox && pollBox.closest('section'); return s ? s.id : ''; }
    function drawPoll() {
      var p = openPoll();
      if (!pollBox && !p) return;
      if (!ensurePollBox()) return;
      var host = $('[data-poll-live]', pollBox); host.textContent = '';
      if (!p) { host.appendChild(el('p', 'lp-empty', '강사가 투표를 열면 여기에 나타나요.')); return; }
      host.appendChild(el('h3', '', p.question));
      var mine = store.get('ans:' + p.id, null);
      var list = Object.keys(answers).map(function (k) { return answers[k]; }).filter(function (a) { return a.poll === p.id; });
      var tally = {}; list.forEach(function (a) { tally[a.value] = (tally[a.value] || 0) + 1; });
      if (mine === null) {
        if (p.kind === 'word') {
          var f = el('form', 'lp-row'); var i = el('input'); i.maxLength = 20; i.placeholder = '낱말 하나'; i.required = true; i.setAttribute('aria-label', '응답');
          var b = el('button', 'lp-btn lp-btn-primary', '보내기'); b.type = 'submit'; f.appendChild(i); f.appendChild(b);
          f.addEventListener('submit', function (e) { e.preventDefault(); answer(p, i.value.trim()); }); host.appendChild(f);
        } else {
          var opts = p.kind === 'scale' && !p.options.length ? ['1', '2', '3', '4', '5'] : p.options;
          var ol = el('div', 'lp-poll-opts'); opts.forEach(function (o) { var b = el('button', '', o); b.type = 'button'; b.addEventListener('click', function () { answer(p, o); }); ol.appendChild(b); }); host.appendChild(ol);
        }
      } else {
        host.appendChild(el('p', 'lp-small', '응답했어요: ' + mine));
        // 결과는 강사가 '결과 공개'를 눌러야 보임(먼저 본 답에 끌려가지 않게)
        if (!X.revealed(state, p.id)) { host.appendChild(el('p', 'lp-note', '결과는 강사가 공개하면 여기에 보여요.')); return; }
        var total = list.length || 1;
        if (p.kind === 'word') {
          var words = U.wordCloud(list, p.id, { hidden: X.hiddenWords(state) }), wt = words.reduce(function (a, w) { return a + w.count; }, 0) || 1;
          var cl = el('div', 'lp-cloud'); words.slice(0, 40).forEach(function (w) { var s = el('span', '', w.word); s.style.fontSize = (1 + Math.min(2.4, w.count / wt * 6)) + 'rem'; s.title = w.count + '명'; cl.appendChild(s); });
          if (!words.length) cl.appendChild(el('p', 'lp-small', '아직 보여 줄 낱말이 없어요.'));
          host.appendChild(cl);
        }
        else { var bars = el('div', 'lp-bars'); (p.options.length ? p.options : Object.keys(tally)).forEach(function (o) { var n = tally[o] || 0; var row = el('div', 'lp-bar'); row.appendChild(el('span', '', o + ' · ' + n + '명')); var tr = el('div', 'lp-bar-track'); var fi = el('div', 'lp-bar-fill'); fi.style.setProperty('--w', Math.round(n / total * 100) + '%'); tr.appendChild(fi); row.appendChild(tr); bars.appendChild(row); }); host.appendChild(bars); }
      }
    }
    function answer(p, v) {
      if (!v) return;
      ensureJoin().then(function () { return conn.add('answers', { poll: p.id, value: v }); }).then(function (d) { store.set('ans:' + p.id, v); if (d && d.id) answers[d.id] = d; drawPoll(); drawNow(); toast('응답했어요.'); }, function (err) { if (err && err.message !== 'cancel') { toast(liveErr(err, '응답을 보내지 못했어요. 잠시 뒤 다시 해 주세요.')); drawPoll(); } });
    }

    // 출석
    $$('[data-attend]').forEach(function (b) {
      if (!b.getAttribute('data-attend') || b.tagName !== 'BUTTON') return;
      b.addEventListener('click', function () {
        var kind = b.getAttribute('data-attend');
        ensureJoin().then(function () { return conn.add('attendance', { kind: kind }); }).then(function () { var s = $('[data-attend-state]'); var t = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); if (s) s.textContent = (kind === 'in' ? '입실' : '퇴실') + ' 확인 ' + t; store.set('att:' + kind, t); toast((kind === 'in' ? '입실' : '퇴실') + '을 확인했어요.'); }, function () { });
      });
    });

    // 출석 한 번 누르기(도크, 출석 칸이 없는 사이트): 별명을 정하고 누르면 참가자 명단에 남음. 질문·투표를 하지 않은 사람도 명단에 들어가게
    var da = $('[data-dock-attend]');
    if (da && store.get('att:in', null) === null) {
      da.hidden = false;
      da.addEventListener('click', function () {
        ensureJoin().then(function () { return conn.add('attendance', { kind: 'in' }); }).then(function () {
          store.set('att:in', new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })); da.hidden = true; toast('출석했어요. 고마워요.');
        }, function (err) { if (err && err.message !== 'cancel') toast('출석을 보내지 못했어요. 잠시 뒤 다시 눌러 주세요.'); });
      });
    }

    // 도움 요청
    var hd = $('[data-help-dialog]'), hf = hd && $('[data-help-form]', hd);
    function sendHelp(station, seat, message) {
      store.set('seat', seat);
      return conn.add('help', { station: station, seat: seat.slice(0, 20), nickname: me.nickname, message: message }).then(function () { toast('도움을 요청했어요. 곧 갈게요.'); if (live.ready && station) live.progress(station, 'stuck'); }, function (err) { toast('보내지 못했어요: ' + (err && err.message || '잠시 뒤 다시 해 주세요.')); });
    }
    live.help = function (stationId) {
      var opener = doc.activeElement;
      ensureJoin().then(function () {
        var station = stationId || (stApi && stApi.current()) || '';
        if (!hf) return sendHelp(station, store.get('seat', ''), '');
        hd._station = station; hf.elements.seat.value = store.get('seat', ''); hf.elements.message.value = '';
        openDialog(hd, opener);
        var f = hf.elements.seat.value ? hf.elements.message : hf.elements.seat; setTimeout(function () { f.focus(); }, 30);
      }, function () { });
    };
    if (hf) hf.addEventListener('submit', function (e) {
      e.preventDefault();
      var seat = hf.elements.seat.value.trim(), msg = hf.elements.message.value.trim();
      closeDialog(hd); sendHelp(hd._station || '', seat, msg);
    });
    var dh = $('[data-dock-help]'); if (dh) dh.addEventListener('click', function () { live.help(stApi && stApi.current()); });
    var dq = $('[data-dock-qa]'); if (dq) dq.addEventListener('click', function () { if (qaBox) { qaBox.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' }); var t = qaBox.querySelector('textarea'); if (t) setTimeout(function () { t.focus(); }, 300); } });
    // 신호등: 참가자당 하나(answers, poll='signal')를 덮어씀
    var mySignal = store.get('signal', null);
    if (typeof mySignal === 'string') mySignal = mySignal ? { v: mySignal, at: 0 } : null;
    function paintSignal() { $$('[data-signal]').forEach(function (b) { b.setAttribute('aria-pressed', String(!!mySignal && b.getAttribute('data-signal') === mySignal.v)); }); }
    function checkSignalReset() {
      var r = X.signalReset(state);
      if (mySignal && r && r > (mySignal.at || 0)) { mySignal = null; store.del('signal'); paintSignal(); if ($('[data-signal]')) toast('강사가 신호를 새로 받아요. 지금 상태를 다시 눌러 주세요.'); }
    }
    paintSignal();
    $$('[data-signal]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-signal');
        ensureJoin().then(function () { return conn.add('answers', { poll: 'signal', value: v }); }).then(function () { mySignal = { v: v, at: conn.now ? conn.now() : Date.now() }; store.set('signal', mySignal); paintSignal(); toast({ green: '‘이해했어요’를 보냈어요.', yellow: '‘조금 헷갈려요’를 보냈어요.', red: '‘모르겠어요’를 보냈어요. 곧 갈게요.' }[v]); }, function () { });
      });
    });
    // 반응: 휴대폰에서는 버튼 하나로 접어 둠
    var rt = $('[data-react-toggle]'), rbox = rt && rt.parentNode;
    function setReact(open) { if (!rbox) return; rbox.classList.toggle('is-open', open); rt.setAttribute('aria-expanded', String(open)); }
    if (rt) {
      rt.addEventListener('click', function () { setReact(!rbox.classList.contains('is-open')); });
      doc.addEventListener('click', function (e) { if (rbox.classList.contains('is-open') && !rbox.contains(e.target)) setReact(false); });
      rbox.addEventListener('keydown', function (e) { if (e.key === 'Escape' && rbox.classList.contains('is-open')) { setReact(false); rt.focus(); } });
    }
    $$('[data-react]').forEach(function (b) { b.addEventListener('click', function () { var e = b.getAttribute('data-react'); floatReaction(e); setReact(false); if (conn.react) conn.react(e).catch(function () { }); }); });

    // 만족도 설문(참가자당 하나, 다시 내면 덮어씀)
    $$('[data-survey]').forEach(function (f) {
      var sk = 'survey:' + f.getAttribute('data-survey'), saved = store.get(sk, null), st = $('[data-sv-state]', f);
      function collect() {
        var out = {}, missing = 0;
        $$('[data-sv-key]', f).forEach(function (n) {
          var key = n.getAttribute('data-sv-key'), v;
          if (n.tagName === 'TEXTAREA') v = n.value.trim();
          else { var c = n.querySelector('input:checked'); v = c ? c.value : ''; if (!v) missing++; }
          if (v) out[key] = n.className.indexOf('lp-sv-scale') >= 0 && /^\d+$/.test(v) ? +v : v;
        });
        return { answers: out, missing: missing };
      }
      if (saved) {
        $$('[data-sv-key]', f).forEach(function (n) {
          var v = saved[n.getAttribute('data-sv-key')]; if (v === undefined) return;
          if (n.tagName === 'TEXTAREA') n.value = v; else $$('input', n).forEach(function (i) { i.checked = String(i.value) === String(v); });
        });
        if (st) st.textContent = '제출했어요. 고칠 게 있으면 바꾼 뒤 다시 내 주세요.';
      }
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var r = collect();
        if (!Object.keys(r.answers).length) return toast('한 문항 이상 답해 주세요.');
        if (r.missing && !window.confirm('답하지 않은 문항이 ' + r.missing + '개 있어요. 이대로 낼까요?')) return;
        var btn = f.querySelector('[type=submit]'); if (btn) btn.disabled = true;
        ensureJoin().then(function () { return conn.add('survey', { answers: r.answers }); }).then(function () {
          store.set(sk, r.answers); if (st) st.textContent = '제출했어요. 고칠 게 있으면 바꾼 뒤 다시 내 주세요.'; toast('제출했어요. 고마워요.');
        }, function (err) { if (err && err.message !== 'cancel') toast('제출하지 못했어요: ' + (err.message || '잠시 뒤 다시 해 주세요.')); }).then(function () { if (btn) btn.disabled = false; });
      });
    });

    var lastProg = {};
    live.progress = function (station, status) {
      if (!station || !me || feats.indexOf('progress') < 0) return;
      if (lastProg[station] === status) return; lastProg[station] = status;
      conn.add('progress', { station: station, status: status }).catch(function () { });
    };

    // 상태 → '지금' 줄: 열린 투표 > 공지 > 강사가 보는 실습·쪽, 오른쪽에 타이머. 할 일 하나만 버튼으로
    var nowEl = $('[data-now]'), timerIv, nowKey = '';
    function runningTimer() {
      if (state.timer && state.timer.running && state.timer.endsAt) return state.timer;
      return X.timers(state).filter(function (t) { return t.running && t.endsAt; })[0] || null;
    }
    function drawNow() {
      if (!nowEl) return;
      var main = '', sub = '', cta = null, sts = DATA.stations || [];
      var p = openPoll();
      var si = state.step ? sts.map(function (x) { return x.id; }).indexOf(state.step) : -1;
      if (p) {
        main = '투표: ' + p.question;
        if (store.get('ans:' + p.id, null) === null) cta = { label: '투표하기', href: '#' + pollSecId(), poll: true };
        else if (X.revealed(state, p.id)) cta = { label: '결과 보기', href: '#' + pollSecId(), poll: true };
      } else if (si >= 0 && stApi) {
        main = (si + 1) + '번 실습 · ' + sts[si].name;
        if (stApi.current() !== state.step) cta = { label: (si + 1) + '번 실습 열기', href: '#st-' + state.step };
      } else if (state.slide > 0 && deckApi) {
        main = '교재 ' + state.slide + '쪽';
        cta = { label: state.slide + '쪽 보기', href: '#deck-p' + state.slide };
      }
      var notice = state.notice && state.notice.text;
      if (notice) { sub = main; main = notice; }
      var t = runningTimer();
      nowEl.classList.toggle('has-notice', !!notice);
      if (notice && state.notice.level) nowEl.setAttribute('data-level', state.notice.level); else nowEl.removeAttribute('data-level');
      var key = main + '|' + sub;
      if (key !== nowKey) { nowKey = key; $('[data-now-main]', nowEl).textContent = main; $('[data-now-sub]', nowEl).textContent = sub; }
      var a = $('[data-now-cta]', nowEl);
      a.hidden = !cta; if (cta) { a.textContent = cta.label; a.setAttribute('href', cta.href); a._poll = !!cta.poll; }
      var tm = $('[data-timer]', nowEl); clearInterval(timerIv);
      tm.hidden = !t;
      if (t) {
        var tick = function () { var left = Math.round((t.endsAt - (conn.now ? conn.now() : Date.now())) / 1000); tm.classList.toggle('is-over', left <= 0); var ab = Math.abs(left); tm.textContent = (t.label ? t.label + ' ' : '') + (left < 0 ? '-' : '') + Math.floor(ab / 60) + ':' + String(ab % 60).padStart(2, '0'); tm.setAttribute('aria-label', (t.label || '타이머') + (left <= 0 ? ' 시간이 다 됐어요' : ' 남은 시간')); };
        tick(); timerIv = setInterval(tick, 1000);
      }
      var was = nowEl.hidden; nowEl.hidden = !main && !t;
      if (was !== nowEl.hidden) fitScrollPad();
    }
    if (nowEl) {
      $('[data-now-cta]', nowEl).addEventListener('click', function (e) {
        if (!this._poll || !pollBox || !pollSecId()) return;
        e.preventDefault(); goTo(pollSecId());
        setTimeout(function () { var f = pollBox.querySelector('[data-poll-live] input, [data-poll-live] button'); if (f) f.focus({ preventScroll: true }); }, RM ? 0 : 400);
      });
      window.addEventListener('hashchange', function () { setTimeout(drawNow, 0); });
    }
    function applyState(s) {
      state = s || {};
      if (state.follow) {
        if (state.step && stApi) stApi.go(state.step);
        if (state.slide && deckApi && deckApi.follow()) deckApi.go(state.slide);
      }
      checkSignalReset(); drawPoll(); drawNow(); drawMats(); drawLocks();
    }
    // 강사가 질문·보드를 잠그면 쓰는 칸을 막고 까닭을 보임(서버도 같은 규칙으로 거절)
    function drawLocks() {
      [[qaBox, 'qa', '[data-qa-form]', '지금은 질문을 받지 않아요. 강사가 다시 열면 보낼 수 있어요.'], [bBox, 'board', '[data-board-write]', '지금은 보드에 글을 받지 않아요. 강사가 다시 열면 올릴 수 있어요.']].forEach(function (x) {
        if (!x[0]) return;
        var on = X.locked(state, x[1]), f = $(x[2], x[0]), note = $('[data-lock-note]', x[0]);
        if (on && !note && f) { note = el('p', 'lp-note', x[3]); note.setAttribute('data-lock-note', ''); note.setAttribute('role', 'status'); f.parentNode.insertBefore(note, f); }
        if (note) note.hidden = !on;
        if (f) $$('textarea,input,button,select', f.tagName === 'FORM' ? f : f.parentNode).forEach(function (n) { if (f.tagName === 'FORM' || n === f) n.disabled = on; });
      });
    }
    // 강사가 연수 중에 덧붙인 자료 링크 → 자료실 아래에 보임. 자료실이 없으면 마무리 앞에 만듦
    function drawMats() {
      var list = X.materials(state), box = $('[data-live-materials]');
      if (!box) {
        if (!list.length) return;
        box = el('ul', 'lp-materials lp-materials-live'); box.setAttribute('data-live-materials', ''); box.setAttribute('aria-label', '강사가 추가한 자료');
        var sec = $('.lp-sec-materials .lp-wrap');
        if (sec) sec.appendChild(box);
        else {
          var s = el('section', 'lp-sec lp-sec-materials'); s.id = 'live-materials'; s.setAttribute('data-layout', 'files'); s.setAttribute('data-frame', 'plain');
          var w = el('div', 'lp-wrap'), h = el('header', 'lp-head'); h.appendChild(el('h2', 'lp-h2', '연수 자료')); w.appendChild(h); w.appendChild(box); s.appendChild(w);
          var before = $('.lp-sec-closing'), main = $('main');
          if (before && before.parentNode) before.parentNode.insertBefore(s, before); else if (main) main.appendChild(s); else return;
        }
      }
      box.textContent = '';
      list.forEach(function (m) {
        var li = el('li'); li.appendChild(el('span', 'lp-file-kind', '링크'));
        var d = el('div'); d.appendChild(el('h3', '', m.title)); d.appendChild(el('small', '', m.url.replace(/^https:\/\/(www\.)?/, '').split(/[/?#]/)[0])); li.appendChild(d);
        var a = el('a', 'lp-btn lp-btn-ghost lp-btn-sm', '열기'); a.href = m.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.appendChild(a);
        box.appendChild(li);
      });
      box.hidden = !list.length;
    }
    function floatReaction(emoji) {
      var host = $('[data-reactions]'); if (!host || RM) return;
      // 이모지 값(프로토콜)을 도크의 선 아이콘으로 바꿔 보여 줌. 모르는 값이면 글자 그대로
      var src = null; $$('[data-react]').forEach(function (b) { if (!src && b.getAttribute('data-react') === emoji) src = b.querySelector('svg'); });
      var s = el('span', '', src ? '' : emoji); if (src) s.appendChild(src.cloneNode(true));
      s.style.left = Math.round(Math.random() * 30) + 'px'; s.style.setProperty('--dx', (Math.random() * 40 - 20) + 'px');
      host.appendChild(s); setTimeout(function () { s.remove(); }, 2700);
    }
    function onEvent(ev) {
      if (!ev) return;
      if (ev.type === 'state') return applyState(ev.doc || ev.state);
      if (ev.type === 'reaction') return floatReaction((ev.doc && ev.doc.emoji) || ev.emoji);
      var d = ev.doc; if (!d || !d.id) return;
      var bag = { questions: qs, posts: posts, answers: answers, polls: quick }[ev.col]; if (!bag) return;
      if (ev.type === 'remove') delete bag[d.id]; else bag[d.id] = Object.assign(bag[d.id] || {}, d);
      if (ev.col === 'questions') drawQA(); else if (ev.col === 'posts') drawBoard(); else { drawPoll(); if (ev.col === 'polls') drawNow(); }
    }
    function loadAll() {
      var jobs = [];
      if (qaBox) jobs.push(conn.list('questions', {}).then(function (a) { (a || []).forEach(function (d) { qs[d.id] = d; }); drawQA(); }));
      if (bBox) jobs.push(conn.list('posts', {}).then(function (a) { (a || []).forEach(function (d) { posts[d.id] = d; }); drawBoard(); }));
      // 투표 칸이 없어도 읽음: 강사가 즉석 투표를 띄우면 바로 보여야 함
      jobs.push(conn.list('polls', {}).then(function (a) { (a || []).forEach(function (d) { quick[d.id] = d; }); }));
      jobs.push(conn.list('answers', {}).then(function (a) { (a || []).forEach(function (d) { answers[d.id] = d; }); }));
      jobs.push(conn.getState().then(applyState));
      return Promise.all(jobs.map(function (j) { return j.catch(function () { }); }));
    }
    conn.connect().then(function (r) {
      live.ready = true; setStatus(r && r.mode === 'polling' ? 'polling' : r && r.mode === 'local' ? 'local' : 'live');
      conn.subscribe(onEvent);
      if (LecLive.on) LecLive.on('status', function (s) { setStatus(s === 'connecting' ? 'connecting' : s); });
      loadAll();
      if (stApi && me) live.progress(stApi.current(), stApi.done().indexOf(stApi.current()) >= 0 ? 'done' : 'doing');
    }, function () { setStatus('offline'); toast('실시간 서버에 연결하지 못했어요. 페이지는 그대로 쓸 수 있어요.'); });
  }

  /* ── 인쇄용 QR 안내문 ─────────────────── */
  function initPoster() {
    var pb = $('[data-print]'); if (pb) pb.addEventListener('click', function () { window.print(); });
    var cb = $('[data-card-print]');
    if (cb) {
      cb.checked = store.get('card-print', true) !== false;
      var upd = function () { doc.body.classList.toggle('lp-card-off', !cb.checked); };
      upd(); cb.addEventListener('change', function () { store.set('card-print', cb.checked); upd(); });
    }
    // 자리 카드 8장(잘라 쓰기): 고를 때만 인쇄·미리보기에 나옴
    var cc = $('input[data-part-print="cards"]');
    if (cc) {
      cc.checked = store.get('cards-print', false) === true;
      var upc = function () { doc.body.classList.toggle('lp-cards-off', !cc.checked); };
      upc(); cc.addEventListener('change', function () { store.set('cards-print', cc.checked); upc(); });
    }
  }

  function start() {
    // 페이지 안에서만 쓰는 양식은 제출해도 페이지를 다시 불러오지 않게
    doc.addEventListener('submit', function (e) { var f = e.target; if (f && f.matches && f.matches('[data-survey],[data-reflect]')) e.preventDefault(); }, true);
    $$('[data-survey]').forEach(function (f) { if (!DATA.live) f.addEventListener('submit', function () { toast('실시간 연결이 꺼져 있어 설문을 모을 수 없어요.'); }); });
    drawQRs(); initChrome(); initScrollShow(); initPhase(); initPrompts(); initSchedule(); initSessions(); initBody(); initReadiness(); initDeck(); initStations(); initQuiz(); initPoster(); initLive();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})();
