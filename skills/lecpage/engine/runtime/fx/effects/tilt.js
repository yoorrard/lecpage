/* tilt — 카드가 포인터 쪽으로 최대 6도 기울고 빛 반사가 따라온다(정밀 포인터만) */
LecFX.define('tilt', {
  level: 2,
  init: function (el, o, ctx) {
    if (ctx.reduced || !ctx.fine) return;
    var cards = ctx.util.items(el, o), max = o.max || 6, glares = [];
    var hi = function () { el.style.setProperty('--fx-hi', ctx.light()); };
    hi();
    ctx.onTheme(hi);
    cards.forEach(function (c) {
      c.classList.add('fx-tilt');
      if (o.glare !== false) { var g = document.createElement('span'); g.className = 'fx-tilt-glare'; g.setAttribute('aria-hidden', 'true'); c.appendChild(g); glares.push(g); }
      var q = 0, ev = null;
      var paint = function () {
        q = 0;
        if (!ev) return;
        var r = c.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
        c.style.setProperty('--fx-rx', ((0.5 - y) * 2 * max).toFixed(2) + 'deg');
        c.style.setProperty('--fx-ry', ((x - 0.5) * 2 * max).toFixed(2) + 'deg');
        c.style.setProperty('--fx-gx', (x * 100).toFixed(1) + '%');
        c.style.setProperty('--fx-gy', (y * 100).toFixed(1) + '%');
      };
      ctx.on(c, 'pointerenter', function (e) { if (e.pointerType === 'mouse') c.classList.add('is-tilt'); });
      ctx.on(c, 'pointermove', function (e) { if (e.pointerType !== 'mouse') return; ev = e; if (!q) q = requestAnimationFrame(paint); });
      ctx.on(c, 'pointerleave', function () { ev = null; c.classList.remove('is-tilt'); ['--fx-rx', '--fx-ry'].forEach(function (k) { c.style.removeProperty(k); }); });
    });
    return function () {
      glares.forEach(function (g) { g.remove(); });
      cards.forEach(function (c) { c.classList.remove('fx-tilt', 'is-tilt'); ['--fx-rx', '--fx-ry', '--fx-gx', '--fx-gy'].forEach(function (k) { c.style.removeProperty(k); }); });
    };
  }
});
