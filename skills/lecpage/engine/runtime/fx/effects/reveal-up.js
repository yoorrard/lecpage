/* reveal-up — 조용한 기본값. 화면에 들어오면 살짝 떠오르며 나타난다. 목록·격자는 짧게 차례로(총 지연 상한) */
LecFX.define('reveal-up', {
  level: 1,
  init: function (el, o, ctx) {
    if (ctx.reduced) return;
    var items = ctx.util.items(el, o), group = items.length > 1 || items[0] !== el;
    var step = o.stagger || 70, max = o.max || 420;
    el.classList.add('fx-reveal');
    if (group) {
      el.classList.add('fx-reveal--group');
      items.forEach(function (it, i) { it.classList.add('fx-reveal-item'); it.style.setProperty('--fx-d', Math.min(i * step, max) + 'ms'); });
    }
    var tidy = function () {
      el.classList.remove('fx-reveal', 'fx-reveal--group');
      items.forEach(function (it) { it.classList.remove('fx-reveal-item'); it.style.removeProperty('--fx-d'); });
    };
    var t = 0;
    ctx.enter(el, function () { t = setTimeout(tidy, max + 1400); });
    return function () { clearTimeout(t); tidy(); };
  }
});
