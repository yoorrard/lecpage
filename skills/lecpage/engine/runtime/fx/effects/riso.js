/* riso — 리소그래프 인쇄 느낌: 두 잉크(주 색·강조 색)의 망점이 살짝 어긋나 겹친다 + 잡음 질감(정지) */
LecFX.define('riso', {
  level: 1,
  init: function (el, o, ctx) {
    var ly = ctx.layer(el);
    ly.innerHTML = '<i class="fx-riso-a"></i><i class="fx-riso-b"></i><i class="fx-riso-grain"></i>';
    var set = function () { var U = ctx.util; ly.classList.toggle('fx-riso--dark', U.lum(ctx.rgb('background', el)) < 0.25); };
    set();
    ctx.onTheme(set);
    if (o.dot) ly.style.setProperty('--fx-riso-dot', o.dot + 'px');
  }
});
