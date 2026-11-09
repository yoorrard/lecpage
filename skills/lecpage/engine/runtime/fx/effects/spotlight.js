/* spotlight — 어두운 영역에서 포인터 둘레만 은은하게 밝힌다(커서는 그대로). mode:"cards"면 카드 테두리가 빛난다 */
LecFX.define('spotlight', {
  level: 2,
  init: function (el, o, ctx) {
    if (ctx.reduced) return;
    var q = 0, ev = null;
    if (o.mode === 'cards') {
      var cards = ctx.util.items(el, { items: o.items, each: true });
      el.classList.add('fx-spot-cards');
      cards.forEach(function (c) { c.classList.add('fx-spot-card'); });
      if (!ctx.fine) return function () { el.classList.remove('fx-spot-cards'); cards.forEach(function (c) { c.classList.remove('fx-spot-card'); }); };
      var paintC = function () {
        q = 0;
        if (!ev) return;
        cards.forEach(function (c) { var r = c.getBoundingClientRect(); c.style.setProperty('--fx-mx', (ev.clientX - r.left).toFixed(0) + 'px'); c.style.setProperty('--fx-my', (ev.clientY - r.top).toFixed(0) + 'px'); });
      };
      ctx.on(el, 'pointermove', function (e) { ev = e; if (!q) q = requestAnimationFrame(paintC); });
      ctx.on(el, 'pointerenter', function () { el.classList.add('is-lit'); });
      ctx.on(el, 'pointerleave', function () { el.classList.remove('is-lit'); });
      return function () { el.classList.remove('fx-spot-cards', 'is-lit'); cards.forEach(function (c) { c.classList.remove('fx-spot-card'); c.style.removeProperty('--fx-mx'); c.style.removeProperty('--fx-my'); }); };
    }
    var ly = ctx.layer(el, 'fx-spotlight');
    if (o.size) ly.style.setProperty('--fx-spot-r', o.size + 'px');
    if (!ctx.fine) { ly.classList.add('is-static'); return; }
    var paint = function () {
      q = 0;
      if (!ev) return;
      var r = el.getBoundingClientRect();
      ly.style.setProperty('--fx-mx', (ev.clientX - r.left).toFixed(0) + 'px');
      ly.style.setProperty('--fx-my', (ev.clientY - r.top).toFixed(0) + 'px');
    };
    ctx.on(el, 'pointermove', function (e) { if (e.pointerType !== 'mouse') return; ev = e; ly.classList.add('is-on'); if (!q) q = requestAnimationFrame(paint); });
    ctx.on(el, 'pointerleave', function () { ly.classList.remove('is-on'); });
  }
});
