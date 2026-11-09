/* confetti-shapes — 멤피스풍 도형(세모·고리·물결·점 묶음·더하기·반원)을 가장자리에 흩어 둔다(정지 SVG). 강도 2 이상은 포인터에 살짝 시차 */
LecFX.define('confetti-shapes', {
  level: 1,
  init: function (el, o, ctx) {
    var ly = ctx.layer(el), U = ctx.util, rnd = U.rand(o.seed || 17), n = o.count || 14, cs = ['primary', 'accent', 'accent-2', 'accent-3'], html = '';
    var S = [
      '<path d="M50 12 L88 82 L12 82 Z" fill="currentColor"/>',
      '<circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" stroke-width="12"/>',
      '<path d="M6 60 Q19 30 31 60 T56 60 T81 60 T106 60" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>',
      '<g fill="currentColor"><circle cx="20" cy="20" r="7"/><circle cx="50" cy="20" r="7"/><circle cx="80" cy="20" r="7"/><circle cx="20" cy="50" r="7"/><circle cx="50" cy="50" r="7"/><circle cx="80" cy="50" r="7"/><circle cx="20" cy="80" r="7"/><circle cx="50" cy="80" r="7"/><circle cx="80" cy="80" r="7"/></g>',
      '<path d="M50 14 V86 M14 50 H86" stroke="currentColor" stroke-width="14" stroke-linecap="round"/>',
      '<path d="M12 64 A38 38 0 0 1 88 64 Z" fill="currentColor"/>',
      '<path d="M8 40 L26 62 L44 40 L62 62 L80 40 L98 62" fill="none" stroke="currentColor" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>',
      '<rect x="20" y="20" width="60" height="60" rx="6" fill="currentColor"/>'
    ];
    for (var i = 0; i < n; i++) {
      var sp = U.spot(rnd, i), x = sp[0], y = sp[1];
      html += '<svg viewBox="0 0 100 100" class="fx-memphis" style="left:' + x.toFixed(1) + '%;top:' + y.toFixed(1) + '%;--sz:' + (18 + rnd() * 34).toFixed(0) + 'px;--r:' + (rnd() * 360).toFixed(0) + 'deg;--z:' + (0.4 + rnd()).toFixed(2) + ';color:var(--' + cs[(i * 7 + 3) % 4] + ')">' + S[i % S.length] + '</svg>';
    }
    ly.innerHTML = html;
    if (ctx.reduced || ctx.level < 2 || !ctx.fine) return;
    var q = 0, mx = 0, my = 0;
    ctx.on(el, 'pointermove', function (e) {
      var r = el.getBoundingClientRect();
      mx = (e.clientX - r.left) / r.width - 0.5; my = (e.clientY - r.top) / r.height - 0.5;
      if (!q) q = requestAnimationFrame(function () { q = 0; ly.style.setProperty('--fx-px', (mx * 14).toFixed(1) + 'px'); ly.style.setProperty('--fx-py', (my * 14).toFixed(1) + 'px'); });
    });
  }
});
