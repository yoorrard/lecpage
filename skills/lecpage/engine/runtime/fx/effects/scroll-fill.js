/* scroll-fill — 스크롤을 따라 낱말이 흐린 색에서 제 색으로 차오른다(읽는 속도를 이끈다) */
LecFX.define('scroll-fill', {
  level: 2,
  init: function (el, o, ctx) {
    if (ctx.reduced) return;
    var s = ctx.util.split(el, 'words');
    var n = s.words.length;
    if (!n) { s.revert(); return; }
    s.words.forEach(function (w, i) { w.style.setProperty('--fx-i', i); });
    el.style.setProperty('--fx-n', n);
    if (o.min != null) el.style.setProperty('--fx-min', o.min);
    el.classList.add('fx-scroll-fill');
    var last = -1, a = o.start || 0.85, b = o.end || 0.4;
    ctx.onScroll(function (y, vh) {
      var p = ctx.util.progress(el, vh, a, b);
      return function () {
        if (Math.abs(p - last) < 0.002) return;
        last = p;
        el.style.setProperty('--fx-p', p.toFixed(3));
      };
    }, { el: el });
    return function () { s.revert(); el.classList.remove('fx-scroll-fill'); ['--fx-n', '--fx-p', '--fx-min'].forEach(function (k) { el.style.removeProperty(k); }); };
  }
});
