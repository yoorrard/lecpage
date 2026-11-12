/* particles-network — 점들이 떠다니며 가까운 점끼리 선으로 이어진다. 포인터 근처는 포인터와도 이어진다(캔버스) */
LecFX.define('particles-network', {
  level: 3,
  loop: true,
  init: function (el, o, ctx) {
    var ly = ctx.layer(el), cv = ctx.canvas(ly), g = cv.g;
    if (!g) return;
    var U = ctx.util, rnd = U.rand(o.seed || 5), P = [], C = {}, px = -1e4, py = -1e4;
    var colors = function () { C.p = ctx.rgb('primary', el); C.f = ctx.rgb('foreground', el); C.a = ctx.rgb('accent', el); };
    var seed = function () {
      P = [];
      var n = Math.round(Math.min(o.count || 90, cv.w * cv.h / (o.density || 12000)));
      for (var i = 0; i < n; i++) P.push({ x: rnd() * cv.w, y: rnd() * cv.h, vx: (rnd() - 0.5) * 16, vy: (rnd() - 0.5) * 16, r: 1.2 + rnd() * 1.8, c: rnd() < 0.2 ? 'a' : 'p' });
    };
    colors(); seed();
    var D = cv.w < 640 ? 100 : 135;
    var draw = function (t, dt) {
      var W = cv.w, H = cv.h, i, j;
      g.clearRect(0, 0, W, H);
      for (i = 0; i < P.length; i++) {
        var p = P[i];
        var dx = px - p.x, dy = py - p.y, dd = dx * dx + dy * dy;
        if (dd < 32000 && dd > 400) { p.vx += dx / Math.sqrt(dd) * dt * 6; p.vy += dy / Math.sqrt(dd) * dt * 6; }
        var sp = Math.hypot(p.vx, p.vy); if (sp > 22) { p.vx *= 22 / sp; p.vy *= 22 / sp; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
      }
      g.lineWidth = 1;
      for (i = 0; i < P.length; i++) for (j = i + 1; j < P.length; j++) {
        var a = P[i], b = P[j], ex = a.x - b.x, ey = a.y - b.y, d2 = ex * ex + ey * ey;
        if (d2 < D * D) { g.strokeStyle = U.rgba(C.f, (1 - Math.sqrt(d2) / D) * 0.22); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
      }
      for (i = 0; i < P.length; i++) {
        var q = P[i], mx = q.x - px, my = q.y - py, m2 = mx * mx + my * my;
        if (m2 < 170 * 170) { g.strokeStyle = U.rgba(C.p, (1 - Math.sqrt(m2) / 170) * 0.6); g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(px, py); g.stroke(); }
        g.fillStyle = U.rgba(C[q.c], 0.85); g.beginPath(); g.arc(q.x, q.y, q.r, 0, 6.29); g.fill();
      }
    };
    var loop = ctx.loop(ly, draw, { t: 0 });
    cv.onResize = function () { seed(); loop.redraw(); };
    ctx.onTheme(function () { colors(); loop.redraw(); });
    if (ctx.fine) {
      ctx.on(el, 'pointermove', function (e) { var r = cv.el.getBoundingClientRect(); px = e.clientX - r.left; py = e.clientY - r.top; });
      ctx.on(el, 'pointerleave', function () { px = py = -1e4; });
    }
  }
});
