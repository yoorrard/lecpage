/* minute-map — 시간 점묘. 연수의 1분이 점 하나(서버가 그려 둔 .lp-minmap, render/hero-graphic.js).
   화면에 들어오면 점이 시간 순서대로 켜지고, 일정 줄이나 점에 포인터·초점이 오면 그 순서의 점만 또렷해지며 아래 줄에 시각·제목·길이를 적는다.
   연수 날 그 시간에는 지금 분의 점에 테가 생긴다. 움직임은 켜질 때 한 번뿐(차분 단계부터). 동작 줄이기에서는 켜지는 움직임 없이 가리킴만. 바깥 파일 없음 */
LecFX.define('minute-map', {
  level: 1,
  init: function (el, o, ctx) {
    var all = function (s) { return [].slice.call(el.querySelectorAll(s)); };
    var dots = all('.lp-min-dots i'), rows = all('.lp-min-legend li'), key = el.querySelector('[data-min-key]'), key0 = key ? key.textContent : '';
    if (!dots.length) return;
    var gOf = function (n) { var m = /(?:^|\s)g(\d+)/.exec(n.getAttribute('class') || ''); return m ? m[1] : n.getAttribute('data-g'); };
    // 켜지기: 시간 순서대로(모두 1.1초 안에)
    var t = 0;
    var tidy = function () { el.classList.remove('fx-minmap'); dots.forEach(function (d) { d.style.removeProperty('--d'); }); };
    if (!ctx.reduced) {
      el.classList.add('fx-minmap');
      dots.forEach(function (d, i) { d.style.setProperty('--d', Math.round(i / dots.length * 1100) + 'ms'); });
      ctx.enter(el, function () { t = setTimeout(tidy, 2200); });
    }
    // 가리킴: 포인터와 키보드 초점 모두
    var cur = null;
    var set = function (g) {
      if (g === cur) return; cur = g;
      if (g == null) el.removeAttribute('data-on'); else el.setAttribute('data-on', g);
      dots.forEach(function (d) { d.classList.toggle('is-on', g != null && gOf(d) === g); });
      rows.forEach(function (r) { r.classList.toggle('is-on', g != null && r.getAttribute('data-g') === g); });
      if (key) { var r = g != null && rows[+g]; key.textContent = r ? [].slice.call(r.querySelectorAll('time,span,small')).map(function (x) { return x.textContent; }).join(' · ') : key0; }
    };
    var pick = function (e) { var n = e.target && e.target.closest ? e.target.closest('.lp-min-dots i, .lp-min-legend li') : null; set(n ? gOf(n) : null); };
    ctx.on(el, 'pointerover', pick); ctx.on(el, 'pointerleave', function () { set(null); });
    ctx.on(el, 'focusin', pick); ctx.on(el, 'focusout', function () { set(null); });
    // 지금: 연수 날 그 시간이면 지금 분의 점에 테
    var date = el.getAttribute('data-date'), st = /^(\d{1,2}):(\d{2})$/.exec(el.getAttribute('data-start') || ''), unit = +el.getAttribute('data-unit') || 1, iv = 0;
    var now = function () {
      var n = new Date(), ymd = n.getFullYear() + '-' + ('0' + (n.getMonth() + 1)).slice(-2) + '-' + ('0' + n.getDate()).slice(-2);
      var i = ymd === date ? Math.floor((n.getHours() * 60 + n.getMinutes() - (+st[1] * 60 + +st[2])) / unit) : -1;
      dots.forEach(function (d, k) { d.classList.toggle('is-now', k === i); d.classList.toggle('is-past', i >= 0 && i < dots.length && k < i); });
    };
    if (date && st) { now(); iv = setInterval(now, 20000); }
    return function () { clearTimeout(t); clearInterval(iv); set(null); tidy(); dots.forEach(function (d) { d.classList.remove('is-now', 'is-past'); }); };
  }
});
