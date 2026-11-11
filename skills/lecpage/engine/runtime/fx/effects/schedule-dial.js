/* schedule-dial — 하루 일정을 둥근 시계로. 순서마다 길이에 비례한 호가 차례로 그려지고, 호나 목록에 마우스·초점을 두면 가운데에 그 순서가 뜨며,
   연수 중에는 '지금' 바늘이 돈다(?now=15:45로 미리 보기). 마크업이 이미 있으면(.lp-dial, 첫 화면 구성 '하루 시계') 살리고,
   빈 자리에 붙이면 쪽의 일정 칸(.lp-schedule)에서 읽어 만든다. JS·움직임이 꺼져도 다 그려진 정지 그림이다. 되풀이 그리기 없음(30초마다 바늘만). */
LecFX.define('schedule-dial', {
  level: 2,
  init: function (el, o, ctx) {
    var d = document, made = null, dial = el.classList.contains('lp-dial') ? el : el.querySelector('.lp-dial');
    var toMin = function (t) { var m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
    var esc = function (s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    if (!dial) {
      var ol = d.querySelector(o.source || '.lp-schedule'), lis = ol ? Array.prototype.slice.call(ol.querySelectorAll('li[data-start]')) : [];
      var rows = lis.map(function (li, i) {
        var a = toMin(li.getAttribute('data-start')), b = toMin(li.getAttribute('data-end')); if (b === null && lis[i + 1]) b = toMin(lis[i + 1].getAttribute('data-start'));
        var h = li.querySelector('h3');
        return { start: li.getAttribute('data-start'), min: a !== null && b !== null && b > a ? b - a : 0, title: h ? h.textContent : '' };
      }).filter(function (r) { return r.min > 0; });
      if (rows.length < 2) return;
      var T = rows.reduce(function (s, r) { return s + r.min; }, 0), at = 0;
      made = d.createElement('div'); made.className = 'lp-dial'; made.setAttribute('aria-hidden', 'true');
      made.setAttribute('data-date', ol.getAttribute('data-date') || '');
      made.innerHTML = '<div class="lp-dial-ring"><svg viewBox="0 0 400 400" focusable="false"><circle class="lp-dial-track" cx="200" cy="200" r="150"/><g transform="rotate(-90 200 200)">' + rows.map(function (r, i) {
        var len = r.min / T * 1000, s = '<circle class="lp-dial-seg" style="--i:' + i + '" data-i="' + i + '" data-start="' + esc(r.start) + '" data-min="' + r.min + '" data-title="' + esc(r.title) + '" cx="200" cy="200" r="150" pathLength="1000" stroke-dasharray="' + Math.max(1, len - 3).toFixed(1) + ' 1000" stroke-dashoffset="' + (-(at + 1.5)).toFixed(1) + '"/>';
        at += len; return s;
      }).join('') + '</g><line class="lp-dial-hand" x1="200" y1="200" x2="200" y2="34"/></svg><p class="lp-dial-center" data-dial-center><b>' + (T % 60 ? T : T / 60) + '</b><span>' + (T % 60 ? '분' : '시간') + '</span></p></div>';
      el.appendChild(made); dial = made;
    }
    var segs = Array.prototype.slice.call(dial.querySelectorAll('.lp-dial-seg')), items = Array.prototype.slice.call(dial.querySelectorAll('.lp-dial-list li'));
    var center = dial.querySelector('[data-dial-center]'), hand = dial.querySelector('.lp-dial-hand'), home = center ? center.innerHTML : '', timer = 0;
    var show = function (i) {
      segs.forEach(function (s, k) { s.classList.toggle('is-hot', k === i); });
      items.forEach(function (li, k) { li.classList.toggle('is-hot', k === i); });
      dial.classList.toggle('has-hot', i >= 0);
      if (!center) return;
      if (i < 0) { center.innerHTML = home; return; }
      var s = segs[i]; center.textContent = '';
      var t = d.createElement('small'); t.textContent = (s.getAttribute('data-start') || '') + ' · ' + s.getAttribute('data-min') + '분';
      var b = d.createElement('em'); b.textContent = s.getAttribute('data-title') || '';
      center.appendChild(t); center.appendChild(b);
    };
    var idx = function (n) { return n ? +n.getAttribute('data-i') : -1; };
    segs.concat(items).forEach(function (n) {
      ctx.on(n, 'pointerenter', function () { show(idx(n)); });
      ctx.on(n, 'pointerleave', function () { show(-1); });
      ctx.on(n, 'focusin', function () { show(idx(n)); });
      ctx.on(n, 'focusout', function () { show(-1); });
    });
    // 지금 바늘: 연수 날(또는 ?now=)에만
    var starts = segs.map(function (s) { return toMin(s.getAttribute('data-start')); }), mins = segs.map(function (s) { return +s.getAttribute('data-min') || 0; });
    var total = mins.reduce(function (a, b) { return a + b; }, 0), day = dial.getAttribute('data-date') || '';
    var tick = function () {
      var now = new Date(), q = /[?&]now=(\d{1,2}):(\d{2})\b/.exec(location.search);
      var today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      var m = q ? +q[1] * 60 + +q[2] : (day && day !== today ? null : now.getHours() * 60 + now.getMinutes());
      var e = m === null || starts[0] === null ? -1 : m - starts[0], on = e >= 0 && e <= total && total > 0;
      dial.classList.toggle('is-live', on);
      var acc = 0;
      segs.forEach(function (s, i) { s.classList.toggle('is-now', on && e >= acc && e < acc + mins[i]); s.classList.toggle('is-done', on && e >= acc + mins[i]); acc += mins[i]; });
      if (hand && on) hand.setAttribute('transform', 'rotate(' + (e / total * 360).toFixed(1) + ' 200 200)');
    };
    if (total > 0 && starts[0] !== null) { tick(); timer = setInterval(tick, 30000); }
    dial.classList.add('fx-dial');
    if (!ctx.reduced) ctx.enter(dial, null, { at: 0.92 }); // 호가 차례로 그려짐(CSS)
    return function () { clearInterval(timer); dial.classList.remove('fx-dial', 'is-live', 'has-hot'); if (made) made.remove(); else if (center) center.innerHTML = home; };
  }
});
