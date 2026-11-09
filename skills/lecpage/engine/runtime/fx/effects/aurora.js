/* aurora — 주 색·강조 색의 부드러운 빛띠가 아주 천천히 흐른다(CSS만, 흐림 필터 없음) */
LecFX.define('aurora', {
  level: 2,
  loop: true,
  init: function (el, o, ctx) {
    if (o.surface === 'dark') ctx.surface(el, 'dark');
    var ly = ctx.layer(el);
    ly.innerHTML = '<i class="fx-au-a"></i><i class="fx-au-b"></i><i class="fx-au-c"></i><i class="fx-au-d"></i>';
    if (o.intensity) ly.style.setProperty('--fx-au-o', o.intensity);
    if (ctx.reduced || ctx.lowPower) ly.classList.add('fx-still');
    ctx.visible(ly, function (on) { ly.classList.toggle('fx-off', !on); }, { once: false, rootMargin: '100px' });
  }
});
