/* mesh-gradient — 토큰 색 네 점으로 만든 메시 그라데이션. 강도 2 이상에서 점이 천천히 떠다닌다(@property) */
LecFX.define('mesh-gradient', {
  level: 1,
  loop: true,
  init: function (el, o, ctx) {
    var ly = ctx.layer(el);
    if (ctx.reduced || ctx.level < 2 || o.animate === false) ly.classList.add('fx-still');
    if (o.intensity) ly.style.setProperty('--fx-mesh-o', o.intensity);
    ctx.visible(ly, function (on) { ly.classList.toggle('fx-off', !on); }, { once: false, rootMargin: '100px' });
  }
});
