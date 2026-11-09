/* bokeh — 초점 밖 빛망울이 천천히 떠다니며 숨 쉰다(따뜻한 감성. CSS만) */
LecFX.define('bokeh', {
  level: 2,
  loop: true,
  init: function (el, o, ctx) {
    var ly = ctx.layer(el), rnd = ctx.util.rand(o.seed || 21), n = o.count || 14, html = '';
    var cs = ['primary', 'accent', 'accent-2', 'accent-3'];
    for (var i = 0; i < n; i++) {
      var s = 40 + Math.pow(rnd(), 1.6) * 200;
      html += '<i style="--x:' + (rnd() * 100).toFixed(1) + '%;--y:' + (rnd() * 100).toFixed(1) + '%;--s:' + s.toFixed(0) + 'px;--c:var(--' + cs[i % 4] + ');--o:' + (0.18 + rnd() * 0.3).toFixed(2) + ';--d:' + (14 + rnd() * 14).toFixed(1) + 's;--dl:-' + (rnd() * 20).toFixed(1) + 's;--dx:' + ((rnd() - 0.5) * 60).toFixed(0) + 'px;--dy:' + ((rnd() - 0.5) * 50).toFixed(0) + 'px"></i>';
    }
    ly.innerHTML = html;
    if (ctx.reduced || ctx.lowPower) ly.classList.add('fx-still');
    ctx.visible(ly, function (on) { ly.classList.toggle('fx-off', !on); }, { once: false, rootMargin: '100px' });
  }
});
