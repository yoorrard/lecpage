/* kinetic-weight — 가변 글꼴 굵기가 스크롤(가운데일수록 굵게) 또는 포인터 거리에 따라 바뀐다 */
LecFX.define('kinetic-weight', {
  level: 2,
  init: function (el, o, ctx) {
    if (ctx.reduced) return;
    var from = o.from || 300, to = o.to || 820, U = ctx.util;
    el.classList.add('fx-kinetic');
    if (o.mode === 'pointer' && ctx.fine) {
      var s = U.split(el, 'chars'), R = o.radius || 180, px = -1e4, py = -1e4, q = 0;
      var paint = function () {
        q = 0;
        s.chars.forEach(function (c) {
          var r = c.getBoundingClientRect();
          var dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height / 2);
          var t = 1 - U.clamp(Math.sqrt(dx * dx + dy * dy) / R, 0, 1);
          c.style.fontWeight = Math.round(from + (to - from) * U.ease(t));
        });
      };
      ctx.on(window, 'pointermove', function (e) { px = e.clientX; py = e.clientY; if (!q) q = requestAnimationFrame(paint); }, { passive: true });
      ctx.on(document, 'pointerleave', function () { px = py = -1e4; if (!q) q = requestAnimationFrame(paint); });
      paint();
      return function () { if (q) cancelAnimationFrame(q); s.revert(); el.classList.remove('fx-kinetic'); };
    }
    var last = -1;
    ctx.onScroll(function (y, vh) {
      var r = el.getBoundingClientRect();
      var d = Math.abs(r.top + r.height / 2 - vh * 0.45) / (vh * 0.75);
      var wgt = Math.round(from + (to - from) * U.ease(1 - U.clamp(d, 0, 1)));
      return function () { if (wgt !== last) { last = wgt; el.style.fontWeight = wgt; } };
    }, { el: el });
    return function () { el.style.fontWeight = ''; el.classList.remove('fx-kinetic'); };
  }
});
