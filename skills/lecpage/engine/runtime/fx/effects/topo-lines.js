/* topo-lines — 펄린 잡음 지형의 등고선(마칭 스퀘어). 다섯 줄마다 굵은 주곡선. 지형이 아주 천천히 숨 쉰다(캔버스) */
LecFX.define('topo-lines', {
  level: 2,
  loop: true,
  init: function (el, o, ctx) {
    var ly = ctx.layer(el), cv = ctx.canvas(ly), g = cv.g;
    if (!g) return;
    var U = ctx.util, rnd = U.rand(o.seed || 3), perm = new Uint8Array(512), p = [], i;
    for (i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), tmp = p[i]; p[i] = p[j]; p[j] = tmp; }
    for (i = 0; i < 512; i++) perm[i] = p[i & 255];
    var G = [1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1];
    var fade = function (t) { return t * t * t * (t * (t * 6 - 15) + 10); };
    var gr = function (h, x, y) { h = (h & 7) * 2; return G[h] * x + G[h + 1] * y; };
    var noise = function (x, y) {
      var X = Math.floor(x), Y = Math.floor(y); x -= X; y -= Y; X &= 255; Y &= 255;
      var u = fade(x), v = fade(y), a = perm[X + perm[Y]], b = perm[X + 1 + perm[Y]], c = perm[X + perm[Y + 1]], d = perm[X + 1 + perm[Y + 1]];
      var x1 = gr(a, x, y) + (gr(b, x - 1, y) - gr(a, x, y)) * u, x2 = gr(c, x, y - 1) + (gr(d, x - 1, y - 1) - gr(c, x, y - 1)) * u;
      return x1 + (x2 - x1) * v;
    };
    var cell = o.cell || 14, levels = o.levels || 16, C = {}, F = null, cols = 0, rows = 0;
    var colors = function () { C.f = ctx.rgb('foreground', el); C.p = ctx.rgb('primary', el); };
    colors();
    var draw = function (t) {
      var W = cv.w, H = cv.h, s = (o.scale || 1) / 260, sp = o.speed || 0.035, x, y, k;
      cols = Math.ceil(W / cell) + 1; rows = Math.ceil(H / cell) + 1;
      if (!F || F.length !== cols * rows) F = new Float32Array(cols * rows);
      for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {
        var X = x * cell * s, Y = y * cell * s;
        F[y * cols + x] = noise(X + t * sp, Y - t * sp * 0.4) + 0.5 * noise(X * 2.1 + 7.3, Y * 2.1 - t * sp * 0.6);
      }
      g.clearRect(0, 0, W, H);
      for (k = 1; k < levels; k++) {
        var L = -0.85 + (1.7 * k) / levels + Math.sin(t * 0.15) * 0.015, idx = k % 5 === 0;
        g.strokeStyle = idx ? U.rgba(C.p, 0.55) : U.rgba(C.f, 0.17);
        g.lineWidth = idx ? 1.4 : 1;
        g.beginPath();
        for (y = 0; y < rows - 1; y++) for (x = 0; x < cols - 1; x++) {
          var a = F[y * cols + x], b = F[y * cols + x + 1], c = F[(y + 1) * cols + x + 1], d = F[(y + 1) * cols + x];
          var cs = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
          if (cs === 0 || cs === 15) continue;
          var px = x * cell, py = y * cell;
          var e = [px + cell * (L - a) / (b - a), py, px + cell, py + cell * (L - b) / (c - b), px + cell * (L - d) / (c - d), py + cell, px, py + cell * (L - a) / (d - a)];
          var seg = SEG[cs];
          for (var q = 0; q < seg.length; q += 2) { g.moveTo(e[seg[q] * 2], e[seg[q] * 2 + 1]); g.lineTo(e[seg[q + 1] * 2], e[seg[q + 1] * 2 + 1]); }
        }
        g.stroke();
      }
      g.globalCompositeOperation = 'destination-in';
      var m = g.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.2, W * 0.5, H * 0.5, Math.max(W, H) * 0.72);
      m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0.15)');
      g.fillStyle = m; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
    };
    /* 가장자리: 0 위, 1 오른쪽, 2 아래, 3 왼쪽 */
    var SEG = { 1: [3, 2], 2: [2, 1], 3: [3, 1], 4: [0, 1], 5: [3, 0, 2, 1], 6: [0, 2], 7: [3, 0], 8: [3, 0], 9: [0, 2], 10: [0, 1, 3, 2], 11: [0, 1], 12: [3, 1], 13: [2, 1], 14: [3, 2] };
    var loop = ctx.loop(ly, draw, { fps: 24, t: 4 });
    cv.onResize = function () { loop.redraw(); };
    ctx.onTheme(function () { colors(); loop.redraw(); });
  }
});
