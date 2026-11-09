/* blueprint-grid — 설계도 모눈(작은 칸·큰 칸), 모서리 맞춤 표시, 치수 글자. 강도 2 이상·정밀 포인터면 좌표 십자선이 따라온다 */
LecFX.define('blueprint-grid', {
  level: 1,
  init: function (el, o, ctx) {
    var ly = ctx.layer(el);
    ly.innerHTML = '<i class="fx-bp-mark fx-bp-tl"></i><i class="fx-bp-mark fx-bp-tr"></i><i class="fx-bp-mark fx-bp-bl"></i><i class="fx-bp-mark fx-bp-br"></i><span class="fx-bp-dim"></span><span class="fx-bp-x"></span><span class="fx-bp-y"></span><span class="fx-bp-tag"></span>';
    var dim = ly.querySelector('.fx-bp-dim');
    var size = function () { dim.textContent = (o.label ? o.label + '  ' : '') + Math.round(el.clientWidth) + ' × ' + Math.round(el.clientHeight); };
    size();
    if ('ResizeObserver' in window) { var ro = new ResizeObserver(size); ro.observe(el); ctx.cleanup(function () { ro.disconnect(); }); }
    if (ctx.reduced || ctx.level < 2 || !ctx.fine || o.crosshair === false) return;
    var tag = ly.querySelector('.fx-bp-tag'), q = 0, ev = null;
    ctx.on(el, 'pointermove', function (e) {
      ev = e;
      if (!q) q = requestAnimationFrame(function () {
        q = 0;
        var r = el.getBoundingClientRect(), x = Math.round(ev.clientX - r.left), y = Math.round(ev.clientY - r.top);
        ly.style.setProperty('--fx-cx', x + 'px'); ly.style.setProperty('--fx-cy', y + 'px');
        tag.textContent = 'x ' + x + '  y ' + y;
        ly.classList.add('is-aim');
      });
    });
    ctx.on(el, 'pointerleave', function () { ly.classList.remove('is-aim'); });
  }
});
