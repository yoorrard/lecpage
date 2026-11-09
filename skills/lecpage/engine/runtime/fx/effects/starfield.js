/* starfield — 반짝이는 별이 아주 천천히 흐르는 밤하늘(캔버스). 강도 3이면 가끔 별똥별. 기본은 어두운 바탕 */
LecFX.define('starfield', {
  level: 2,
  loop: true,
  init: function (el, o, ctx) {
    if (o.surface !== 'keep') ctx.surface(el, 'dark');
    var ly = ctx.layer(el), cv = ctx.canvas(ly), g = cv.g;
    if (!g) return;
    var rnd = ctx.util.rand(o.seed || 11), stars = [], C = {}, shoot = null, nextShoot = 3;
    var colors = function () { C.fg = ctx.rgb('foreground', el); C.a = ctx.rgb('accent', el); C.p = ctx.rgb('primary', el); };
    var seed = function () {
      stars = [];
      var n = Math.min(o.count || 340, Math.round(cv.w * cv.h / 2300));
      for (var i = 0; i < n; i++) {
        var big = rnd() < 0.07;
        stars.push({ x: rnd() * cv.w, y: rnd() * cv.h, r: big ? 1.1 + rnd() * 0.9 : 0.35 + rnd() * 0.75, a: 0.3 + rnd() * 0.7, ph: rnd() * 6.28, sp: 0.5 + rnd() * 1.7, z: 0.25 + rnd() * 0.75, c: rnd() < 0.14 ? (rnd() < 0.5 ? 'a' : 'p') : 'fg', big: big });
      }
    };
    colors(); seed();
    var draw = function (t, dt) {
      var W = cv.w, H = cv.h, U = ctx.util;
      g.clearRect(0, 0, W, H);
      var hz = g.createLinearGradient(0, H, 0, H * 0.45);
      hz.addColorStop(0, U.rgba(C.p, 0.16)); hz.addColorStop(1, U.rgba(C.p, 0));
      g.fillStyle = hz; g.fillRect(0, H * 0.45, W, H * 0.55);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.x -= s.z * dt * 5; if (s.x < -2) s.x = W + 2;
        var al = s.a * (0.62 + 0.38 * Math.sin(t * s.sp + s.ph));
        var c = C[s.c];
        if (s.big) { g.fillStyle = U.rgba(c, al * 0.18); g.beginPath(); g.arc(s.x, s.y, s.r * 3.2, 0, 6.29); g.fill(); }
        g.fillStyle = U.rgba(c, al);
        g.beginPath(); g.arc(s.x, s.y, s.r, 0, 6.29); g.fill();
      }
      if (ctx.level >= 3 || o.shooting) {
        if (!shoot && t > nextShoot && dt) { shoot = { x: W * (0.3 + rnd() * 0.6), y: H * rnd() * 0.35, l: 0 }; nextShoot = t + 6 + rnd() * 8; }
        if (shoot) {
          shoot.l += dt * 1.6;
          var k = shoot.l, x = shoot.x - k * 260, y = shoot.y + k * 110, gr = g.createLinearGradient(x, y, x + 90, y - 38);
          gr.addColorStop(0, U.rgba(C.fg, 0.9 * (1 - k))); gr.addColorStop(1, U.rgba(C.fg, 0));
          g.strokeStyle = gr; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 90, y - 38); g.stroke();
          if (k >= 1) shoot = null;
        }
      }
    };
    var loop = ctx.loop(ly, draw, { t: 2 });
    cv.onResize = function () { seed(); loop.redraw(); };
    ctx.onTheme(function () { colors(); loop.redraw(); });
  }
});
