/* 마음이 먼저 도착하는 교실 — 지금 상태(첫 화면 한 줄·흐름의 '지금'), 차례(휴대폰), 차례 표시, 첫 화면 해 떠오르기 */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 지금 상태 ── 연수: 2027-05-13(목) 15:30–17:00(한국 시각). ?now=16:10 으로 그날의 그 시각을 미리 볼 수 있음 */
  var DAY = '2027-05-13', START = '15:30', END = '17:00';
  var at = function (hm) { return new Date(DAY + 'T' + hm + ':00+09:00'); };
  var t0 = at(START), t1 = at(END);
  function nowDate() {
    var m = /[?&]now=(\d{1,2}):(\d{2})/.exec(location.search);
    if (m) return at((m[1].length < 2 ? '0' : '') + m[1] + ':' + m[2]);
    return new Date();
  }
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  function seoulHM(d) { var k = new Date(d.getTime() + 9 * 3600e3); return pad(k.getUTCHours()) + ':' + pad(k.getUTCMinutes()); }
  function seoulDay(d) { var k = new Date(d.getTime() + 9 * 3600e3); return Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()); }

  var status = $('[data-status]'), text = $('[data-status-text]'), cal = $('.status-cal');
  var rows = $$('.day li[data-from]');
  var ctaMain = $('[data-cta-main]'), ctaSub = $('[data-cta-sub]');
  // 첫 화면 주 단추 = 지금 할 일(연수 전에는 마음 날씨, 이야기 동안은 자료집, 짝 활동·나눔·마무리 때는 그 자리, 끝난 뒤에는 설문)
  function setCta(spec) {
    if (!ctaMain || !spec) return;
    var p = spec.split('|');
    ctaMain.textContent = p[0]; ctaMain.setAttribute('href', p[1]);
    if (ctaSub) { var deck = p[1] === '#deck'; ctaSub.textContent = deck ? '오늘의 흐름' : '자료집 보기'; ctaSub.setAttribute('href', deck ? '#flow' : '#deck'); }
  }
  function paint() {
    if (!status || !text) return;
    var now = nowDate(), hm = seoulHM(now);
    var state = now < t0 ? 'before' : now >= t1 ? 'after' : 'live';
    status.setAttribute('data-state', state);
    rows.forEach(function (li) { li.classList.remove('is-now'); });
    if (cal) cal.hidden = state !== 'before';
    if (state === 'before') {
      var days = Math.round((seoulDay(t0) - seoulDay(now)) / 864e5);
      text.textContent = days > 1 ? '5월 13일(목) 15:30에 시작해요 · ' + days + '일 남았어요.'
        : days === 1 ? '내일 15:30에 시작해요.'
          : '오늘 15:30에 시작해요 · ' + Math.ceil((t0 - now) / 6e4) + '분 남았어요.';
      setCta('마음 날씨 고르기|#checkin');
      return;
    }
    if (state === 'after') { text.textContent = '연수가 끝났어요. 성찰 설문과 다시 보기를 확인해 주세요.'; setCta('성찰 설문 내기|#survey'); return; }
    var row = rows.filter(function (li) { return hm >= li.getAttribute('data-from') && hm < li.getAttribute('data-to'); })[0];
    text.textContent = '';
    text.appendChild(document.createTextNode('지금 ' + hm + ' · '));
    if (row) {
      row.classList.add('is-now');
      setCta(row.getAttribute('data-cta'));
      var src = $('h3 a', row), a = document.createElement('a');
      a.href = src.getAttribute('href'); a.textContent = src.textContent;
      text.appendChild(a);
    }
  }
  paint();
  setInterval(paint, 30000);

  /* ── 차례(휴대폰) ── */
  var mb = $('[data-menu]'), sheet = $('#menu-sheet');
  function closeMenu() { if (!mb || !sheet) return; mb.setAttribute('aria-expanded', 'false'); sheet.hidden = true; }
  if (mb && sheet) {
    mb.addEventListener('click', function () {
      var open = mb.getAttribute('aria-expanded') !== 'true';
      mb.setAttribute('aria-expanded', String(open)); sheet.hidden = !open;
      if (open) { var f = $('a', sheet); if (f) f.focus(); }
    });
    $$('a', sheet).forEach(function (a) { a.addEventListener('click', closeMenu); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && mb.getAttribute('aria-expanded') === 'true') { closeMenu(); mb.focus(); } });
  }

  /* ── 차례 표시: 지금 읽는 섹션의 메뉴에 표시 ── */
  var links = $$('.nav a');
  var map = {};
  links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
  var secs = $$('main section[id]');
  var spyQ = false;
  function spy() {
    spyQ = false;
    var line = innerHeight * 0.3, cur = null;
    secs.forEach(function (s) { if (s.getBoundingClientRect().top <= line) cur = s.id; });
    var key = cur;
    links.forEach(function (a) { if (a === map[key]) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  }
  window.addEventListener('scroll', function () { if (!spyQ) { spyQ = true; requestAnimationFrame(spy); } }, { passive: true });
  spy();

  /* ── 첫 화면: 해가 지평선 위로 한 번 떠오르고 물결이 차례로 번짐(기본은 다 그려진 모습) ── */
  if (!RM && document.documentElement.animate) {
    var sun = $('.dawn .sun'), rip = $$('.dawn .ripples path');
    if (sun) sun.animate([{ transform: 'translateY(64px)' }, { transform: 'translateY(0)' }], { duration: 1400, easing: 'cubic-bezier(.2,.7,.2,1)' });
    rip.forEach(function (p, i) {
      var o = getComputedStyle(p).opacity;
      p.animate([{ opacity: 0 }, { opacity: o }], { duration: 900, delay: 500 + i * 160, easing: 'ease-out', fill: 'backwards' });
    });
  }
})();
