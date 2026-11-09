/* noise-orb — 빛나는 구(AI·미래 분위기). 겹친 원뿔 그라데이션이 천천히 돌고, 숨 쉬듯 커졌다 작아진다. 포인터 쪽으로 살짝 기운다 */
LecFX.define('noise-orb', {
  level: 2,
  loop: true,
  init: function (el, o, ctx) {
    var ly = ctx.layer(el);
    ly.innerHTML = '<div class="fx-orb"><i class="fx-orb-glow"></i><i class="fx-orb-swirl"></i><i class="fx-orb-core"></i><i class="fx-orb-shine"></i></div>';
    var orb = ly.firstChild;
    if (o.align) ly.setAttribute('data-align', o.align);
    if (o.size) ly.style.setProperty('--fx-orb-s', o.size);
    if (ctx.reduced || ctx.lowPower) ly.classList.add('fx-still');
    ctx.visible(ly, function (on) { ly.classList.toggle('fx-off', !on); }, { once: false, rootMargin: '100px' });
    if (ctx.reduced || !ctx.fine) return;
    var q = 0, mx = 0, my = 0;
    ctx.on(el, 'pointermove', function (e) {
      var r = el.getBoundingClientRect();
      mx = (e.clientX - r.left) / r.width - 0.5; my = (e.clientY - r.top) / r.height - 0.5;
      if (!q) q = requestAnimationFrame(function () { q = 0; orb.style.translate = (mx * 26).toFixed(1) + 'px ' + (my * 20).toFixed(1) + 'px'; });
    });
    ctx.on(el, 'pointerleave', function () { orb.style.translate = ''; });
  }
});
