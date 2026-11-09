/* dot-grid — 점 격자에 잔잔한 물결이 지나가고, 포인터 근처 점은 커지며 주 색으로 물든다(캔버스) */
LecFX.define('dot-grid', {
  level: 2,
  loop: true,
  init: function (el, o, ctx) {
    var ly = ctx.layer(el), cv = ctx.canvas(ly), g = cv.g;
    if (!g) return;
    var U = ctx.util, gap = o.gap || 26, C = {}, D = [], px = -1e4, py = -1e4, R = o.radius || 150;
    var colors = function () { C.m = ctx.rgb('muted-foreground', el); C.p = ctx.rgb('primary', el); };
    var seed = function () {
      D = [];
      var ox = (cv.w % gap) / 2 + gap / 2, oy = (cv.h % gap) / 2 + gap / 2;
      for (var y = oy; y < cv.h; y += gap) for (var x = ox; x < cv.w; x += gap) D.push(x, y);
    };
    colors(); seed();
    var draw = function (t) {
      g.clearRect(0, 0, cv.w, cv.h);
      var B = [[], [], [], []], hot = [], i, k;
      for (i = 0; i < D.length; i += 2) {
        var x = D[i], y = D[i + 1];
        var w = Math.sin(x * 0.011 + y * 0.008 - t * 1.1) * 0.5 + 0.5;
        var dx = x - px, dy = y - py, d = Math.sqrt(dx * dx + dy * dy);
        if (d < R) {
          var kk = 1 - d / R; kk *= kk;
          hot.push(x + dx / (d || 1) * kk * 9, y + dy / (d || 1) * kk * 9, 1.3 + kk * 2.4, kk);
        } else B[Math.min(3, Math.floor(w * 4))].push(x, y, 0.9 + w * 0.6);
      }
      for (k = 0; k < 4; k++) {
        g.fillStyle = U.rgba(C.m, 0.16 + k * 0.1);
        g.beginPath();
        for (i = 0; i < B[k].length; i += 3) { g.moveTo(B[k][i] + B[k][i + 2], B[k][i + 1]); g.arc(B[k][i], B[k][i + 1], B[k][i + 2], 0, 6.29); }
        g.fill();
      }
      for (i = 0; i < hot.length; i += 4) { g.fillStyle = U.rgba(C.p, 0.35 + hot[i + 3] * 0.6); g.beginPath(); g.arc(hot[i], hot[i + 1], hot[i + 2], 0, 6.29); g.fill(); }
    };
    var loop = ctx.loop(ly, draw, { t: 1.2 });
    cv.onResize = function () { seed(); loop.redraw(); };
    ctx.onTheme(function () { colors(); loop.redraw(); });
    if (ctx.fine) {
      ctx.on(el, 'pointermove', function (e) { var r = cv.el.getBoundingClientRect(); px = e.clientX - r.left; py = e.clientY - r.top; if (!loop.running) loop.redraw(); });
      ctx.on(el, 'pointerleave', function () { px = py = -1e4; if (!loop.running) loop.redraw(); });
    }
  }
});
