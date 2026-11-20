/* 데이터로 읽는 우리 반 — 지금 상태(시계·시간표·180분 막대), 수식 입력줄(지금 보는 곳), 차례, 프롬프트 복사, 차트 그리기 */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 지금 상태 ── 연수: 2026-12-16 14:00–17:00(한국 시각). ?now=15:42 로 그날의 그 시각을 미리 볼 수 있음 */
  var DAY = '2026-12-16', START = '14:00', END = '17:00';
  var at = function (hm) { return new Date(DAY + 'T' + hm + ':00+09:00'); };
  var t0 = at(START), t1 = at(END);
  var PARTS = [
    { from: '14:00', to: '14:15', label: '들어가며 · 예시 데이터 만들기', href: '#ready' },
    { from: '14:15', to: '14:45', label: '1부 · 실습 1 표 정리', href: '#st-s1' },
    { from: '14:45', to: '15:20', label: '1부 · 실습 2 요약 함수', href: '#st-s2' },
    { from: '15:20', to: '15:30', label: '쉬는 시간', href: '#ask' },
    { from: '15:30', to: '16:00', label: '2부 · 실습 3 차트', href: '#st-s3' },
    { from: '16:00', to: '16:30', label: '2부 · 실습 4 AI와 해석', href: '#st-s4' },
    { from: '16:30', to: '16:50', label: '3부 · 실습 5 수업 바꾸기와 나눔', href: '#st-s5' },
    { from: '16:50', to: '17:00', label: '마무리 · 만족도 조사', href: '#wrap' }
  ];
  function nowDate() {
    var m = /[?&]now=(\d{1,2}):(\d{2})/.exec(location.search);
    if (m) return at((m[1].length < 2 ? '0' : '') + m[1] + ':' + m[2]);
    return new Date();
  }
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  function seoulHM(d) { var k = new Date(d.getTime() + 9 * 3600e3); return pad(k.getUTCHours()) + ':' + pad(k.getUTCMinutes()); }
  function seoulDay(d) { var k = new Date(d.getTime() + 9 * 3600e3); return Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()); }

  var clock = $('[data-clock]'), text = $('[data-clock-text]'), needle = $('[data-needle]');
  function paintClock() {
    if (!clock || !text) return;
    var now = nowDate(), hm = seoulHM(now);
    var state = now < t0 ? 'before' : now >= t1 ? 'after' : 'live';
    clock.setAttribute('data-state', state);
    $$('.sched tr').forEach(function (tr) { tr.classList.remove('is-now'); });
    $$('.timebar li').forEach(function (li) { li.classList.remove('is-now'); });
    if (state === 'before') {
      var days = Math.round((seoulDay(t0) - seoulDay(now)) / 864e5);
      text.textContent = days > 1 ? '12월 16일(수) 14:00에 시작해요 · ' + days + '일 남았어요.'
        : days === 1 ? '내일 14:00에 시작해요.'
          : '오늘 14:00에 시작해요 · ' + Math.ceil((t0 - now) / 6e4) + '분 남았어요.';
      if (needle) needle.hidden = true;
      return;
    }
    if (state === 'after') {
      text.textContent = '연수가 끝났어요. 만족도 조사와 후속 모임을 확인해 주세요.';
      if (needle) needle.hidden = true;
      return;
    }
    var part = PARTS.filter(function (p) { return hm >= p.from && hm < p.to; })[0] || PARTS[0];
    text.innerHTML = '';
    text.appendChild(document.createTextNode('지금 ' + hm + ' · '));
    var a = document.createElement('a'); a.href = part.href; a.textContent = part.label; text.appendChild(a);
    $$('.sched tr').forEach(function (tr) { var f = tr.getAttribute('data-from'), t = tr.getAttribute('data-to'); if (f && hm >= f && hm < t) tr.classList.add('is-now'); });
    var mins = (now - t0) / 6e4, acc = 0;
    $$('.timebar li').forEach(function (li) { var m = +getComputedStyle(li).getPropertyValue('--m') || 0; if (mins >= acc && mins < acc + m) li.classList.add('is-now'); acc += m; });
    if (needle) {
      var bar = $('.timebar'); needle.hidden = false;
      var x = bar.offsetLeft + bar.offsetWidth * Math.max(0, Math.min(1, mins / 180));
      needle.style.left = x + 'px';
    }
  }
  paintClock();
  setInterval(paintClock, 30000);
  window.addEventListener('resize', paintClock);

  /* ── 수식 입력줄: 화면 위쪽 1/3을 지나는 마지막 칸의 이름 ── */
  var nb = $('[data-namebox]'), fx = $('[data-fx]');
  var cells = $$('[data-cell]');
  var navLinks = $$('.nav a');
  var lastKey = '';
  function spy() {
    if (!nb || !fx) return;
    var line = innerHeight * 0.32, cur = null;
    cells.forEach(function (el) { if (el.getBoundingClientRect().top <= line) cur = el; });
    var name = 'A1', title = '데이터로 읽는 우리 반';
    if (cur && (window.scrollY > 40)) { name = cur.getAttribute('data-cell'); title = cur.getAttribute('data-fx-text') || title; }
    var key = name + '|' + title;
    if (key === lastKey) return;
    lastKey = key; nb.textContent = name; fx.textContent = title;
    var sec = cur && cur.closest('section.sec');
    var id = sec ? '#' + sec.id : '';
    navLinks.forEach(function (a) { if (a.getAttribute('href') === id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  }
  var ticking = false;
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; spy(); }); } }, { passive: true });
  spy();

  /* ── 휴대폰 차례 ── */
  var menu = $('[data-menu]'), tabs = $('#sheet-tabs');
  function setMenu(open) { if (!menu || !tabs) return; menu.setAttribute('aria-expanded', String(open)); tabs.hidden = !open; }
  if (menu && tabs) {
    menu.addEventListener('click', function () { setMenu(menu.getAttribute('aria-expanded') !== 'true'); });
    tabs.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { setMenu(false); menu.focus(); } });
  }

  /* ── 프롬프트 복사 ── */
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var pre = document.getElementById(b.getAttribute('data-copy')); if (!pre) return;
      var t = pre.textContent;
      var done = function () { var old = '프롬프트 복사'; b.textContent = '복사했어요'; b.classList.add('is-done'); setTimeout(function () { b.textContent = old; b.classList.remove('is-done'); }, 2000); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(done, fallback); else fallback();
      function fallback() {
        var r = document.createRange(); r.selectNodeContents(pre);
        var s = getSelection(); s.removeAllRanges(); s.addRange(r);
        try { document.execCommand('copy'); done(); } catch (e) { b.textContent = '글을 골라 두었어요. 복사해 주세요.'; }
      }
    });
  });

  /* ── 차트: 화면에 들어오면 선이 한 번 그어지고 빨간 펜이 동그라미를 침. 기본은 다 그려진 모습(그림·인쇄·동작 줄이기에도 온전함) ── */
  var chart = $('.chart');
  if (chart && !RM && 'IntersectionObserver' in window && chart.animate) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.disconnect();
        var line = $('.ch-a', chart), ring = $('.ch-ring', chart);
        var draw = function (el, dur, delay) { if (el) el.animate([{ strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDasharray: 1, strokeDashoffset: 0 }], { duration: dur, delay: delay, easing: 'cubic-bezier(.3,.1,.2,1)', fill: 'backwards' }); };
        draw(line, 1100, 0);
        $$('.ch-dots circle', chart).forEach(function (c, i) { c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, delay: 250 + i * 260, fill: 'backwards' }); });
        draw(ring, 650, 1150);
      });
    }, { threshold: 0.3 });
    io.observe(chart);
  }
})();
