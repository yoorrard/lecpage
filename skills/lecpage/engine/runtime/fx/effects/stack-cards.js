/* stack-cards — 카드가 차례로 위에 붙어 쌓이고, 덮인 카드는 살짝 작아진다 */
LecFX.define('stack-cards', {
  level: 2,
  init: function (el, o, ctx) {
    if (ctx.reduced) return;
    var cards = ctx.util.items(el, { items: o.items, each: true });
    if (cards.length < 2) return;
    el.classList.add('fx-stack');
    if (o.top) el.style.setProperty('--fx-stack-top', o.top);
    cards.forEach(function (c, i) { c.classList.add('fx-stack-card'); c.style.setProperty('--fx-i', i); });
    var last = [];
    ctx.onScroll(function (y, vh) {
      var tops = cards.map(function (c) { return c.getBoundingClientRect().top; });
      var vals = cards.map(function (c, i) {
        var cover = 0;
        for (var j = i + 1; j < cards.length; j++) cover += ctx.util.clamp((vh - tops[j]) / (vh - tops[i] || 1), 0, 1);
        return Math.min(cover, 4);
      });
      return function () {
        vals.forEach(function (v, i) {
          if (last[i] !== undefined && Math.abs(last[i] - v) < 0.004) return;
          last[i] = v;
          cards[i].style.setProperty('--fx-cover', v.toFixed(3));
        });
      };
    }, { el: el });
    return function () { el.classList.remove('fx-stack'); cards.forEach(function (c) { c.classList.remove('fx-stack-card'); c.style.removeProperty('--fx-i'); c.style.removeProperty('--fx-cover'); }); };
  }
});
