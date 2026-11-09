/* magnetic — 포인터가 가까이 오면 버튼이 살짝 끌려오고 글자는 조금 더 따라온다(정밀 포인터만) */
LecFX.define('magnetic', {
  level: 2,
  init: function (el, o, ctx) {
    if (ctx.reduced || !ctx.fine) return;
    var s = o.strength || 0.3, max = o.max || 14, pad = o.radius || 60, q = 0, px = 0, py = 0, on = false;
    var inner = document.createElement('span');
    inner.className = 'fx-magnetic-in';
    while (el.firstChild) inner.appendChild(el.firstChild);
    el.appendChild(inner);
    el.classList.add('fx-magnetic');
    var paint = function () {
      q = 0;
      var r = el.getBoundingClientRect();
      var cx = r.left + r.width / 2 - (parseFloat(el.dataset.fxMx) || 0), cy = r.top + r.height / 2 - (parseFloat(el.dataset.fxMy) || 0);
      var inside = px > r.left - pad && px < r.right + pad && py > r.top - pad && py < r.bottom + pad;
      var dx = inside ? ctx.util.clamp((px - cx) * s, -max, max) : 0, dy = inside ? ctx.util.clamp((py - cy) * s, -max, max) : 0;
      el.dataset.fxMx = dx; el.dataset.fxMy = dy;
      el.style.transform = dx || dy ? 'translate3d(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0)' : '';
      inner.style.transform = dx || dy ? 'translate3d(' + (dx * 0.45).toFixed(1) + 'px,' + (dy * 0.45).toFixed(1) + 'px,0)' : '';
      el.classList.toggle('is-near', inside);
    };
    var move = function (e) { px = e.clientX; py = e.clientY; if (!q) q = requestAnimationFrame(paint); };
    ctx.visible(el, function (vis) {
      if (vis && !on) { on = true; window.addEventListener('pointermove', move, { passive: true }); }
      if (!vis && on) { on = false; window.removeEventListener('pointermove', move); }
    }, { once: false });
    return function () {
      window.removeEventListener('pointermove', move);
      if (q) cancelAnimationFrame(q);
      while (inner.firstChild) el.insertBefore(inner.firstChild, inner);
      inner.remove();
      el.style.transform = '';
      el.classList.remove('fx-magnetic', 'is-near');
      delete el.dataset.fxMx; delete el.dataset.fxMy;
    };
  }
});
