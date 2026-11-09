/* line-draw — SVG 선이 스크롤에 맞춰 그려진다. SVG가 없는 목록(일정표)에는 세로 레일과 점을 만든다 */
LecFX.define('line-draw', {
  level: 2,
  init: function (el, o, ctx) {
    if (ctx.reduced) return;
    var U = ctx.util, paths = Array.prototype.slice.call(el.querySelectorAll('svg path, svg line, svg polyline, svg circle, svg ellipse, svg rect'));
    if (paths.length) {
      var lens = paths.map(function (p) {
        var L = 0;
        try { L = p.getTotalLength(); } catch (e) { L = 0; }
        if (L) { p.style.strokeDasharray = L + ' ' + L; p.style.strokeDashoffset = L; }
        return L;
      });
      el.classList.add('fx-line-draw');
      var last = -1;
      ctx.onScroll(function (y, vh) {
        var p = o.scrub === false ? null : U.progress(el, vh, 0.9, 0.55);
        return function () {
          if (p === null || Math.abs(p - last) < 0.002) return;
          last = p;
          paths.forEach(function (pa, i) { if (lens[i]) pa.style.strokeDashoffset = (lens[i] * (1 - p)).toFixed(1); });
        };
      }, { el: el });
      if (o.scrub === false) ctx.visible(el, function () { el.classList.add('fx-line-draw--once'); paths.forEach(function (pa) { pa.style.strokeDashoffset = 0; }); }, { once: true, rootMargin: '0px 0px -15% 0px' });
      return function () { paths.forEach(function (pa) { pa.style.strokeDasharray = ''; pa.style.strokeDashoffset = ''; }); el.classList.remove('fx-line-draw', 'fx-line-draw--once'); };
    }
    var items = Array.prototype.slice.call(o.items ? el.querySelectorAll(o.items) : el.children);
    if (!items.length) return;
    var rail = document.createElement('span'), fill = document.createElement('span');
    rail.className = 'fx-ld-rail'; rail.setAttribute('aria-hidden', 'true');
    fill.className = 'fx-ld-fill';
    rail.appendChild(fill);
    el.classList.add('fx-ld');
    el.appendChild(rail);
    items.forEach(function (it) { it.classList.add('fx-ld-item'); });
    var lastP = -1;
    ctx.onScroll(function (y, vh) {
      var r = el.getBoundingClientRect(), line = vh * 0.62;
      var p = U.clamp((line - r.top) / (r.height || 1), 0, 1);
      var reached = items.map(function (it) { return it.getBoundingClientRect().top + 12 < line; });
      return function () {
        if (Math.abs(p - lastP) > 0.001) { lastP = p; fill.style.transform = 'scaleY(' + p.toFixed(4) + ')'; }
        items.forEach(function (it, i) { it.classList.toggle('is-reached', reached[i]); });
      };
    }, { el: el });
    return function () { rail.remove(); el.classList.remove('fx-ld'); items.forEach(function (it) { it.classList.remove('fx-ld-item', 'is-reached'); }); };
  }
});
