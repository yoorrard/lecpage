/* highlight-sweep — 형광펜이 글 아래를 왼쪽에서 오른쪽으로 긋는다. 쉬는 상태는 칠해진 상태 */
LecFX.define('highlight-sweep', {
  level: 1,
  init: function (el, o, ctx) {
    var t = Array.prototype.slice.call(el.querySelectorAll(o.target || 'mark, [data-hl]'));
    if (!t.length) t = [el];
    t.forEach(function (x, i) {
      x.classList.add('fx-hl');
      if (o.color) x.style.setProperty('--fx-hl-c', 'var(--' + String(o.color).replace(/[^a-z0-9-]/g, '') + ')');
      x.style.setProperty('--fx-d', (i * 160 + (o.delay || 0)) + 'ms');
      if (!ctx.reduced) ctx.enter(x, null, { at: 0.8 });
    });
    return function () { t.forEach(function (x) { x.classList.remove('fx-hl'); x.style.removeProperty('--fx-hl-c'); x.style.removeProperty('--fx-d'); }); };
  }
});
