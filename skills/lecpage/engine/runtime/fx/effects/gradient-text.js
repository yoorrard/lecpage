/* gradient-text — 큰 제목 글자 안에서 주 색·강조 색이 천천히 흐른다(멈춤 버튼에 멈춤) */
LecFX.define('gradient-text', {
  level: 1,
  loop: true,
  init: function (el, o, ctx) {
    el.classList.add('fx-gradient-text');
    if (o.duration) el.style.setProperty('--fx-gt-dur', o.duration + 's');
    if (o.animate === false || ctx.level < 2) el.classList.add('fx-gradient-text--still');
    var off = ctx.visible(el, function (on) { el.classList.toggle('fx-off', !on); }, { once: false });
    return function () { off(); el.classList.remove('fx-gradient-text', 'fx-gradient-text--still', 'fx-off'); el.style.removeProperty('--fx-gt-dur'); };
  }
});
