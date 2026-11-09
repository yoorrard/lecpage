/* parallax-soft — 스크롤 속도와 최대 10%만 다르게 움직이는 은은한 시차 */
LecFX.define('parallax-soft', {
  level: 2,
  init: function (el, o, ctx) {
    if (ctx.reduced) return;
    var sp = ctx.util.clamp(o.speed == null ? 0.08 : +o.speed, -0.1, 0.1), v = 0;
    if (window.innerWidth < 640) sp *= 0.6;
    el.classList.add('fx-parallax');
    ctx.onScroll(function (y, vh) {
      var r = el.getBoundingClientRect();
      var c = (r.top - v) + r.height / 2 - vh / 2;
      var nv = Math.round(-c * sp * 10) / 10;
      return function () { if (nv !== v) { v = nv; el.style.transform = 'translate3d(0,' + v + 'px,0)'; } };
    }, { el: el, margin: '40% 0px' });
    return function () { el.style.transform = ''; el.classList.remove('fx-parallax'); };
  }
});
