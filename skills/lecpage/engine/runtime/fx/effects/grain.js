/* grain — SVG feTurbulence 잡음을 얇게 덮어 종이·필름 질감을 준다(정지, 비용 거의 없음) */
LecFX.define('grain', {
  level: 1,
  init: function (el, o, ctx) {
    var ly = ctx.layer(el);
    if (o.amount != null) ly.style.setProperty('--fx-grain', ctx.util.clamp(+o.amount, 0, 0.4));
    if (o.front) ly.classList.add('fx-grain--front');
  }
});
