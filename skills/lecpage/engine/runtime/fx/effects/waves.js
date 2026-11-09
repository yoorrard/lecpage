/* waves — 바닥에서 겹겹의 물결이 서로 다른 속도로 흐른다(SVG+CSS, 이음매 없음) */
LecFX.define('waves', {
  level: 1,
  loop: true,
  init: function (el, o, ctx) {
    var ly = ctx.layer(el);
    var wave = function (amp, ph) {
      var d = 'M0 ' + (60 + amp * Math.sin(ph)).toFixed(1);
      for (var x = 0; x <= 2880; x += 40) d += ' L' + x + ' ' + (60 + amp * Math.sin(ph + x / 1440 * Math.PI * 4)).toFixed(1);
      return d + ' L2880 140 L0 140 Z';
    };
    var html = '';
    [[16, 0], [12, 1.7], [9, 3.4]].forEach(function (w, i) {
      html += '<div class="fx-wave fx-wave-' + (i + 1) + '"><svg viewBox="0 0 2880 140" preserveAspectRatio="none" focusable="false"><path d="' + wave(w[0], w[1]) + '"/></svg></div>';
    });
    ly.innerHTML = html;
    if (o.height) ly.style.setProperty('--fx-wave-h', o.height);
    if (o.top) ly.classList.add('fx-waves--top');
    if (ctx.reduced || o.animate === false) ly.classList.add('fx-still');
    ctx.visible(ly, function (on) { ly.classList.toggle('fx-off', !on); }, { once: false, rootMargin: '100px' });
  }
});
