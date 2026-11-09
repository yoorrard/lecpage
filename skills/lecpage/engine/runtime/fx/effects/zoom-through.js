/* zoom-through — 히어로 사진이 액자 크기에서 스크롤을 따라 화면 가득 커진다(클립 마스크라 레이아웃 안전) */
LecFX.define('zoom-through', {
  level: 3,
  init: function (el, o, ctx) {
    if (ctx.reduced) return;
    var media = el.querySelector(o.media || '[data-zoom-media], img, video, picture');
    if (!media) return;
    var stick = document.createElement('div'), kids = Array.prototype.slice.call(el.childNodes);
    stick.className = 'fx-zoom-sticky';
    kids.forEach(function (k) { stick.appendChild(k); });
    el.appendChild(stick);
    el.classList.add('fx-zoom');
    media.classList.add('fx-zoom-media');
    if (o.height) el.style.setProperty('--fx-zoom-h', o.height);
    var last = -1, ix = o.inset || 18;
    ctx.onScroll(function (y, vh) {
      var r = el.getBoundingClientRect();
      var p = ctx.util.clamp(-r.top / ((r.height - vh) || 1), 0, 1);
      return function () {
        if (Math.abs(p - last) < 0.002) return;
        last = p;
        var e = 1 - ctx.util.ease(p);
        el.style.setProperty('--fx-zi-y', (e * ix * 0.7).toFixed(2) + '%');
        el.style.setProperty('--fx-zi-x', (e * ix).toFixed(2) + '%');
        el.style.setProperty('--fx-zi-r', (e * 28).toFixed(1) + 'px');
        el.style.setProperty('--fx-zi-p', p.toFixed(3));
      };
    }, { el: el });
    return function () {
      kids.forEach(function (k) { el.appendChild(k); });
      stick.remove();
      media.classList.remove('fx-zoom-media');
      el.classList.remove('fx-zoom');
      ['--fx-zi-y', '--fx-zi-x', '--fx-zi-r', '--fx-zi-p', '--fx-zoom-h'].forEach(function (k) { el.style.removeProperty(k); });
    };
  }
});
