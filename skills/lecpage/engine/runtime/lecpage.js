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
  function qrSvg(text) {
    if (!window.qrcode) return '';
    try {
      if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
      var q = qrcode(0, 'M'); q.addData(text); q.make();
      return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    } catch (e) { return ''; }
  }
  window.LecPage.qr = qrSvg;
  function pageUrl() { return DATA.siteUrl || location.href.split('#')[0].replace(/(check|console|screen|privacy)\.html$/, ''); }
  function drawQRs() {
    $$('[data-qr]').forEach(function (n) { n.innerHTML = qrSvg(n.getAttribute('data-qr')); });
    $$('[data-qr-self]').forEach(function (n) { n.innerHTML = qrSvg(pageUrl()); });
  }

  /* ── 테마·움직임 ───────────────────────── */
  function initChrome() {
    var tb = $('[data-theme-toggle]');
    if (tb) tb.addEventListener('click', function () {
      var cur = root.getAttribute('data-theme');
      if (cur === 'auto') cur = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      var next = cur === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('lp-theme', next); } catch (e) { }
    });
    var mb = $('[data-motion-toggle]');
    function setPaused(p) {
      root.classList.toggle('lp-paused', p);
      if (mb) { mb.setAttribute('aria-pressed', String(p)); mb.setAttribute('aria-label', p ? '움직임 다시 켜기' : '움직임 멈추기'); }
      if (window.LecFX) { try { p ? LecFX.pause() : LecFX.resume(); } catch (e) { } }
      try { localStorage.setItem('lp-motion-paused', p ? '1' : '0'); } catch (e) { }
    }
    if (mb) { mb.addEventListener('click', function () { setPaused(!root.classList.contains('lp-paused')); toast(root.classList.contains('lp-paused') ? '움직임을 멈췄어요.' : '움직임을 다시 켰어요.'); }); if (root.classList.contains('lp-paused')) setPaused(true); }

    var share = $('[data-share]'), dlg = $('[data-share-dialog]');
    if (share && dlg) share.addEventListener('click', function () {
      var u = pageUrl(); var su = $('[data-share-url]', dlg); if (su) su.textContent = u;
      $$('[data-qr-self]', dlg).forEach(function (n) { n.innerHTML = qrSvg(u); });
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    });
    var cu = $('[data-copy-url]'); if (cu) cu.addEventListener('click', function () { copyText(pageUrl(), '주소를 복사했어요.'); });

    // 메뉴 현재 위치 + 스크롤 진행 막대
    var links = $$('[data-nav-link]');
    if (links.length && 'IntersectionObserver' in window) {
      var map = {}; links.forEach(function (a) { map[a.getAttribute('data-nav-link')] = a; });
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          links.forEach(function (a) { a.removeAttribute('aria-current'); });
          var a = map[e.target.id]; if (a) { a.setAttribute('aria-current', 'true'); if (a.scrollIntoView && a.parentNode.scrollWidth > a.parentNode.clientWidth) a.parentNode.scrollTo({ left: a.offsetLeft - 40, behavior: 'smooth' }); }
        });
      }, { rootMargin: '-40% 0px -55% 0px' });
      $$('main > section[id]').forEach(function (s) { io.observe(s); });
    }
    var bar = $('[data-scrollbar]');
    if (bar) { var tick = false; window.addEventListener('scroll', function () { if (tick) return; tick = true; requestAnimationFrame(function () { var h = doc.documentElement.scrollHeight - innerHeight; bar.style.setProperty('--p', h > 0 ? Math.min(1, scrollY / h) : 0); tick = false; }); }, { passive: true }); }
  }

  /* ── 복사·프롬프트 ─────────────────────── */
  function initPrompts() {
    $$('[data-prompt]').forEach(function (ta) {
      var k = 'prompt:' + ta.getAttribute('data-prompt'), orig = ta.value, saved = store.get(k, null);
      var restore = ta.parentNode.querySelector('[data-restore]');
      if (saved !== null && saved !== orig) { ta.value = saved; if (restore) restore.hidden = false; }
      ta.addEventListener('input', function () { store.set(k, ta.value); if (restore) restore.hidden = ta.value === orig; });
      if (restore) restore.addEventListener('click', function () { ta.value = orig; store.del(k); restore.hidden = true; toast('원문으로 되돌렸어요.'); });
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
    $$('.lp-schedule').forEach(function (ol) {
      function upd() {
        var now = new Date(), today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        var mins = now.getHours() * 60 + now.getMinutes();
        $$('li', ol).forEach(function (li) {
          var d = li.getAttribute('data-date') || ol.getAttribute('data-date');
          li.classList.remove('is-now', 'is-done');
          if (d && d !== today) return;
          var s = toMin(li.getAttribute('data-start')), en = toMin(li.getAttribute('data-end'));
          if (s === null) return;
          if (en === null) { var nx = li.nextElementSibling; en = nx ? toMin(nx.getAttribute('data-start')) : s + 30; }
          if (mins >= s && mins < en) li.classList.add('is-now'); else if (mins >= en) li.classList.add('is-done');
        });
      }
      upd(); setInterval(upd, 30000);
    });
  }
  function toMin(t) { var m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; }

  /* ── 준비 점검·접속 진단 ──────────────────── */
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
        copyText(['접속 진단 결과 (' + new Date().toLocaleString('ko-KR') + ')', location.href].concat(lines, lv ? [lv.textContent] : [], env ? [env.textContent] : []).join('\n'), '결과를 복사했어요.');
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

  /* ── 교재 뷰어 ─────────────────────────── */
  var deckApi = null;
  function initDeck() {
    var deck = $('[data-deck]'); if (!deck) return;
    var slides = $$('.lp-slide', deck); if (!slides.length) return;
    var stage = $('.lp-deck-stage', deck), bar = $('.lp-deck-bar', deck), cur = 0;
    deck.classList.add('is-ready'); bar.hidden = false;
    var thumbs = el('div', 'lp-deck-thumbs'); thumbs.setAttribute('aria-label', '쪽 미리보기');
    slides.forEach(function (s, i) {
      var b = el('button'); b.type = 'button'; b.setAttribute('aria-label', s.getAttribute('data-page') + '쪽');
      var img = s.querySelector('img');
      if (img) { var t = el('img'); t.src = img.getAttribute('src'); t.alt = ''; t.loading = 'lazy'; b.appendChild(t); } else b.appendChild(el('span', '', s.getAttribute('data-page') + '. ' + (s.getAttribute('data-title') || '')));
      b.addEventListener('click', function () { go(i); });
      thumbs.appendChild(b);
    });
    bar.parentNode.insertBefore(thumbs, bar.nextSibling);
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
  function overview(slides, pick) {
    var ov = el('div', 'lp-overview'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', '전체 쪽 보기');
    var h = el('div', 'lp-overview-h'); var inp = el('input'); inp.type = 'search'; inp.placeholder = '제목·내용으로 찾기'; inp.setAttribute('aria-label', '쪽 찾기');
    var close = el('button', 'lp-btn lp-btn-ghost', '닫기'); close.type = 'button';
    h.appendChild(inp); h.appendChild(close); ov.appendChild(h);
    var grid = el('div', 'lp-overview-grid'); ov.appendChild(grid);
    var btns = slides.map(function (s, i) {
      var b = el('button'); b.type = 'button'; var img = s.querySelector('img');
      if (img) { var t = el('img'); t.src = img.getAttribute('src'); t.alt = ''; t.loading = 'lazy'; b.appendChild(t); }
      b.appendChild(el('span', '', s.getAttribute('data-page') + '. ' + (s.getAttribute('data-title') || '')));
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

  /* ── 실습 스테이션 ─────────────────────── */
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
        if (k >= 0) { done.splice(k, 1); toast('완료 체크를 풀었어요.'); } else { done.push(id); toast('완료! 다음 실습으로 넘어가 볼까요?'); celebrate(b); }
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
  function celebrate(btn) {
    if (RM || root.classList.contains('lp-paused')) return;
    if (window.LecFX && typeof LecFX.fire === 'function') { try { LecFX.fire('confetti', btn); } catch (e) { } }
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
  var live = { ready: false, progress: function () { }, help: function () { toast('실시간 연결이 꺼져 있어요. 손을 들어 강사에게 알려 주세요.'); } };
  function initLive() {
    if (!DATA.live || !window.LecLive || !$('[data-dock]') && !$('[data-qa]') && !$('[data-board]')) return;
    var conn;
    try { conn = LecLive.create(DATA.live); } catch (e) { return; }
    var me = store.get('me', null), feats = DATA.live.features || [];
    var dock = $('[data-dock]'), dot = $('[data-live-status]');
    var qs = {}, posts = {}, answers = {}, state = {}, voted = store.get('voted', {});
    if (dock) dock.hidden = false;
    $$('[data-live-off]').forEach(function (n) { n.hidden = true; });
    if (feats.indexOf('help') >= 0) $$('[data-stuck]').forEach(function (b) { b.hidden = false; });
    if (deckApi) deckApi.showFollow();

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
      if (!arr.length) { list.appendChild(el('li', 'lp-empty', '첫 질문을 남겨 주세요. 다른 사람의 질문에 공감을 누를 수도 있어요.')); return; }
      arr.forEach(function (q) {
        var li = el('li', 'lp-qa-item' + (q.pinned ? ' is-pinned' : '') + (q.status === 'answered' ? ' is-answered' : ''));
        var v = el('button', 'lp-vote'); v.type = 'button'; v.setAttribute('aria-pressed', String(!!voted[q.id])); v.setAttribute('aria-label', '공감 ' + (q.votes || 0));
        v.appendChild(el('span', '', '▲')); v.appendChild(el('b', '', String(q.votes || 0)));
        v.addEventListener('click', function () { if (voted[q.id]) return toast('이미 공감했어요.'); ensureJoin().then(function () { return conn.vote(q.id); }).then(function (r) { voted[q.id] = 1; store.set('voted', voted); if (r && r.votes !== undefined) { q.votes = r.votes; drawQA(); } }, function () { }); });
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
        ensureJoin().then(function () { return conn.add('questions', { text: text, anonymous: DATA.live.anonymous !== false, nickname: me.nickname }); }).then(function (d) { if (d && d.id) qs[d.id] = d; ta.value = ''; if (cnt) cnt.textContent = '0 / 500'; drawQA(); toast('질문을 올렸어요.'); }, function (err) { if (err && err.message !== 'cancel') toast('질문을 올리지 못했어요. 잠시 뒤 다시 해 주세요.'); });
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
          .then(function (d) { if (d && d.id) posts[d.id] = d; bf.reset(); bf.hidden = true; drawBoard(); toast('올렸어요.'); }, function (err) { toast('올리지 못했어요: ' + (err && err.message || '파일 크기나 종류를 확인해 주세요.')); })
          .then(function () { btn.disabled = false; });
      });
    }

    // 투표
    var pollBox = $('[data-poll]'), pollDefs = [];
    try { pollDefs = JSON.parse(pollBox ? pollBox.getAttribute('data-poll') : '[]'); } catch (e) { }
    function drawPoll() {
      if (!pollBox) return;
      var host = $('[data-poll-live]', pollBox); host.textContent = '';
      var p = pollDefs.filter(function (x) { return x.id === state.openPoll; })[0];
      if (!p) { host.appendChild(el('p', 'lp-empty', '강사가 투표를 열면 여기에 나타나요.')); return; }
      host.appendChild(el('h3', '', p.question));
      var mine = store.get('ans:' + p.id, null);
      var tally = {}; Object.keys(answers).forEach(function (k) { var a = answers[k]; if (a.poll === p.id) tally[a.value] = (tally[a.value] || 0) + 1; });
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
        var total = Object.keys(tally).reduce(function (a, k) { return a + tally[k]; }, 0) || 1;
        if (p.kind === 'word') { var cl = el('div', 'lp-cloud'); Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; }).slice(0, 40).forEach(function (w) { var s = el('span', '', w); s.style.fontSize = (1 + Math.min(2.4, tally[w] / total * 6)) + 'rem'; cl.appendChild(s); }); host.appendChild(cl); }
        else { var bars = el('div', 'lp-bars'); (p.options.length ? p.options : Object.keys(tally)).forEach(function (o) { var n = tally[o] || 0; var row = el('div', 'lp-bar'); row.appendChild(el('span', '', o + ' · ' + n + '명')); var tr = el('div', 'lp-bar-track'); var fi = el('div', 'lp-bar-fill'); fi.style.setProperty('--w', Math.round(n / total * 100) + '%'); tr.appendChild(fi); row.appendChild(tr); bars.appendChild(row); }); host.appendChild(bars); }
      }
    }
    function answer(p, v) {
      if (!v) return;
      ensureJoin().then(function () { return conn.add('answers', { poll: p.id, value: v }); }).then(function (d) { store.set('ans:' + p.id, v); if (d && d.id) answers[d.id] = d; drawPoll(); toast('응답했어요.'); }, function () { });
    }

    // 출석
    $$('[data-attend]').forEach(function (b) {
      if (!b.getAttribute('data-attend') || b.tagName !== 'BUTTON') return;
      b.addEventListener('click', function () {
        var kind = b.getAttribute('data-attend');
        ensureJoin().then(function () { return conn.add('attendance', { kind: kind }); }).then(function () { var s = $('[data-attend-state]'); var t = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); if (s) s.textContent = (kind === 'in' ? '입실' : '퇴실') + ' 확인 ' + t; store.set('att:' + kind, t); toast((kind === 'in' ? '입실' : '퇴실') + '을 확인했어요.'); }, function () { });
      });
    });

    // 도움 요청
    live.help = function (stationId) {
      ensureJoin().then(function () {
        var seat = window.prompt ? window.prompt('자리 번호나 위치를 적어 주세요(예: 3모둠, 창가 두 번째)', store.get('seat', '')) : '';
        if (seat === null) return;
        store.set('seat', seat || '');
        return conn.add('help', { station: stationId || (stApi && stApi.current()) || '', seat: (seat || '').slice(0, 30), nickname: me.nickname, message: '' }).then(function () { toast('도움을 요청했어요. 곧 갈게요!'); if (live.ready) live.progress(stationId || (stApi && stApi.current()), 'stuck'); });
      }, function () { });
    };
    var dh = $('[data-dock-help]'); if (dh) dh.addEventListener('click', function () { live.help(stApi && stApi.current()); });
    var dq = $('[data-dock-qa]'); if (dq) dq.addEventListener('click', function () { if (qaBox) { qaBox.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' }); var t = qaBox.querySelector('textarea'); if (t) setTimeout(function () { t.focus(); }, 300); } });
    // 신호등: 참가자당 하나(answers, poll='signal')를 덮어씀
    var mySignal = store.get('signal', '');
    function paintSignal() { $$('[data-signal]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-signal') === mySignal)); }); }
    paintSignal();
    $$('[data-signal]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-signal');
        ensureJoin().then(function () { return conn.add('answers', { poll: 'signal', value: v }); }).then(function () { mySignal = v; store.set('signal', v); paintSignal(); toast({ green: '이해했어요를 보냈어요.', yellow: '조금 헷갈려요를 보냈어요.', red: '도와주세요를 보냈어요. 곧 갈게요!' }[v]); }, function () { });
      });
    });
    $$('[data-react]').forEach(function (b) { b.addEventListener('click', function () { var e = b.getAttribute('data-react'); floatReaction(e); if (conn.react) conn.react(e).catch(function () { }); }); });

    var lastProg = {};
    live.progress = function (station, status) {
      if (!station || !me || feats.indexOf('progress') < 0) return;
      if (lastProg[station] === status) return; lastProg[station] = status;
      conn.add('progress', { station: station, status: status }).catch(function () { });
    };

    // 상태(공지·타이머·따라가기·투표)
    var timerIv;
    function applyState(s) {
      state = s || {};
      var n = $('[data-notice]');
      if (n) { if (state.notice && state.notice.text) { n.hidden = false; n.textContent = state.notice.text; n.setAttribute('data-level', state.notice.level || ''); } else n.hidden = true; }
      var tm = $('[data-timer]'); clearInterval(timerIv);
      if (tm) {
        if (state.timer && state.timer.running && state.timer.endsAt) {
          tm.hidden = false;
          var tick = function () { var left = Math.round((state.timer.endsAt - Date.now()) / 1000); tm.classList.toggle('is-over', left <= 0); var a = Math.abs(left); tm.textContent = (state.timer.label ? state.timer.label + ' ' : '') + (left < 0 ? '-' : '') + Math.floor(a / 60) + ':' + String(a % 60).padStart(2, '0'); };
          tick(); timerIv = setInterval(tick, 1000);
        } else tm.hidden = true;
      }
      if (state.follow) {
        if (state.step && stApi) stApi.go(state.step);
        if (state.slide && deckApi && deckApi.follow()) deckApi.go(state.slide);
      }
      drawPoll();
    }
    function floatReaction(emoji) {
      var host = $('[data-reactions]'); if (!host || RM) return;
      var s = el('span', '', emoji); s.style.left = Math.round(Math.random() * 30) + 'px'; s.style.setProperty('--dx', (Math.random() * 40 - 20) + 'px');
      host.appendChild(s); setTimeout(function () { s.remove(); }, 2700);
    }
    function onEvent(ev) {
      if (!ev) return;
      if (ev.type === 'state') return applyState(ev.doc || ev.state);
      if (ev.type === 'reaction') return floatReaction((ev.doc && ev.doc.emoji) || ev.emoji);
      var d = ev.doc; if (!d || !d.id) return;
      var bag = { questions: qs, posts: posts, answers: answers }[ev.col]; if (!bag) return;
      if (ev.type === 'remove') delete bag[d.id]; else bag[d.id] = Object.assign(bag[d.id] || {}, d);
      if (ev.col === 'questions') drawQA(); else if (ev.col === 'posts') drawBoard(); else drawPoll();
    }
    function loadAll() {
      var jobs = [];
      if (qaBox) jobs.push(conn.list('questions', {}).then(function (a) { (a || []).forEach(function (d) { qs[d.id] = d; }); drawQA(); }));
      if (bBox) jobs.push(conn.list('posts', {}).then(function (a) { (a || []).forEach(function (d) { posts[d.id] = d; }); drawBoard(); }));
      if (pollBox) jobs.push(conn.list('answers', {}).then(function (a) { (a || []).forEach(function (d) { answers[d.id] = d; }); }));
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

  function start() {
    drawQRs(); initChrome(); initPrompts(); initSchedule(); initReadiness(); initDeck(); initStations(); initQuiz(); initLive();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})();
