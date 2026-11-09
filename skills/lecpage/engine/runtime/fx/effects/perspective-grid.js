/* perspective-grid — 밤하늘 아래 원근 바닥 격자가 다가온다(신스웨이브). 지평선 빛·선택적 해. 기본은 어두운 바탕으로 바꾼다 */
LecFX.define('perspective-grid', {
  level: 2,
  loop: true,
  init: function (el, o, ctx) {
    if (o.surface !== 'keep') ctx.surface(el, 'dark');
    var ly = ctx.layer(el);
    ly.innerHTML = '<div class="fx-pg-sky">' + (o.sun ? '<div class="fx-pg-sun"></div>' : '') + '</div><div class="fx-pg-floor"><div class="fx-pg-plane"></div></div>';
    if (o.horizon) ly.style.setProperty('--fx-pg-h', o.horizon);
    if (ctx.reduced || ctx.lowPower) ly.classList.add('fx-still');
    ctx.visible(ly, function (on) { ly.classList.toggle('fx-off', !on); }, { once: false, rootMargin: '100px' });
  }
});
