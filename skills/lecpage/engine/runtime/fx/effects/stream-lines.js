/* stream-lines — 돌 두세 개를 돌아 흐르는 물결 선(돌 둘레의 퍼텐셜 흐름). 그림은 연수 제목에서 나와 같은 제목이면 늘 같다(data-seed).
   선이 천천히 일렁이고 선을 따라 물살이 지나가며, 포인터를 올리면 그 자리가 돌이 되어 물결이 비켜 흐른다(Canvas 2D, 바깥 파일 없음).
   서버가 그려 둔 정지 그림(.lp-stream svg, render/hero.js streamArt)과 같은 식으로 그려 그 위에 얹고 그림은 감춘다.
   동작 줄이기·가벼운 모드·저사양에서는 정지 그림 그대로(정지 그림이 없는 자리에서는 한 장만 그림). 화면 밖·숨은 탭·멈춤에서는 쉰다(ctx.loop). */
LecFX.define('stream-lines', {
  level: 2,
  loop: true,
  init: function (el, o, ctx) {
    var d = document, fig = el.classList.contains('lp-stream') ? el : el.querySelector('.lp-stream'), made = null;
    if ((ctx.reduced || ctx.lowPower) && fig && fig.querySelector('svg')) return; // 서버가 그린 정지 그림을 그대로 둠
    if (!fig) { made = fig = d.createElement('div'); fig.className = 'lp-stream'; fig.innerHTML = '<div class="lp-stream-plate"></div>'; el.appendChild(fig); }
    var plate = fig.querySelector('.lp-stream-plate') || fig, U = ctx.util;
    var cv = ctx.canvas(plate, { maxDpr: window.innerWidth < 700 ? 1.5 : 2 }), g = cv.g;
    if (!g) return;
    // 씨앗 값: 서버(streamScene)와 같은 순서로 뽑음 — 기울기, 일렁임, 돌 두세 개
    var r = U.rand(U.hash(fig.getAttribute('data-seed') || el.getAttribute('data-seed') || d.title || 'lecpage'));
    var th = (r() - 0.5) * 0.7, A = 9 + r() * 9, kx = 0.008 + r() * 0.006, ky = 0.006 + r() * 0.006, p1 = r() * 6.283, p2 = r() * 6.283;
    var st = [[150 + r() * 110, 140 + r() * 90, 54 + r() * 18], [84 + r() * 232, 372 + r() * 80, 26 + r() * 14]];
    var c3 = [276 + r() * 84, 60 + r() * 380, 11 + r() * 8];
    if (r() < 0.62 && st.every(function (s) { return Math.sqrt((s[0] - c3[0]) * (s[0] - c3[0]) + (s[1] - c3[1]) * (s[1] - c3[1])) > s[2] + c3[2] + 34; })) st.push(c3);
    var off = r() * 11, sn = Math.sin(th), cs = Math.cos(th), ns = st.length;
    var ptr = [200, 250, 0], want = 0, mx = 200, my = 250, on = false, loop;
    st.push(ptr); // 포인터가 돌이 됨(반지름 0이면 없는 것과 같음)
    var fg, pr, ac, bg;
    var colors = function () { fg = ctx.rgb('foreground'); pr = ctx.rgb('primary'); ac = ctx.rgb('accent'); bg = ctx.rgb('card'); };
    colors(); ctx.onTheme(function () { colors(); if (loop) loop.redraw(); });
    var rgba = function (c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };
    var view = function () { var W = cv.w, H = cv.h, k = Math.max(W / 400, H / 500); return [k, (W - 400 * k) / 2, (H - 500 * k) / 2]; }; // 서버 그림의 slice(가득 채우기)와 같게
    if (ctx.fine) {
      var host = el.closest('.lp-hero') || el;
      ctx.on(host, 'pointermove', function (e) {
        var b = cv.el.getBoundingClientRect(), v = view();
        mx = (e.clientX - b.left - v[1]) / v[0]; my = (e.clientY - b.top - v[2]) / v[0];
        want = e.clientX > b.left - 40 && e.clientX < b.right + 40 && e.clientY > b.top - 40 && e.clientY < b.bottom + 40 ? 30 : 0;
      });
      ctx.on(host, 'pointerleave', function () { want = 0; });
    }
    var vx = 0, vy = 0, t = 0;
    var vel = function (x, y) {
      var a = kx * x + p1 + t, b = ky * y + p2;
      var qx = -sn + A * kx * Math.cos(a) * Math.cos(b), qy = cs - A * ky * Math.sin(a) * Math.sin(b);
      for (var i = 0; i < st.length; i++) {
        var s = st[i]; if (s[2] < 1) continue;
        var dx = x - s[0], dy = y - s[1], d2 = dx * dx + dy * dy || 1, L = -dx * sn + dy * cs, q = s[2] * s[2] / (d2 * d2);
        qx -= q * (-sn * d2 - 2 * L * dx); qy -= q * (cs * d2 - 2 * L * dy);
      }
      var l = Math.sqrt(qx * qx + qy * qy) || 1; vx = qy / l; vy = -qx / l;
    };
    var P = new Float32Array(146);
    var draw = function (T, dt, still) {
      var v = view(), k = v[0], n = 0, i, j, s;
      t = T * 0.22;
      ptr[0] += (mx - ptr[0]) * 0.14; ptr[1] += (my - ptr[1]) * 0.14; ptr[2] += (want - ptr[2]) * 0.09;
      g.setTransform(cv.dpr * k, 0, 0, cv.dpr * k, cv.dpr * v[1], cv.dpr * v[2]);
      g.clearRect(-v[1] / k, -v[2] / k, cv.w / k, cv.h / k);
      for (i = 0; i < ns; i++) { g.fillStyle = rgba(i === 0 ? ac : i === 1 ? pr : fg, 1); g.beginPath(); g.arc(st[i][0], st[i][1], st[i][2], 0, 6.2832); g.fill(); }
      if (ptr[2] > 1) { g.strokeStyle = rgba(pr, 0.55); g.lineWidth = 1.2; g.beginPath(); g.arc(ptr[0], ptr[1], Math.max(0.5, ptr[2] - 4), 0, 6.2832); g.stroke(); }
      g.lineCap = g.lineJoin = 'round';
      for (s = -330 + off; s < 330; s += 11, n++) {
        var x = 200 - cs * 330 - sn * s, y = 250 - sn * 330 + cs * s, m = 0;
        for (i = 0; i < 72; i++) {
          if (x > -14 && x < 414 && y > -14 && y < 514) { P[m++] = x; P[m++] = y; } else if (m) break;
          vel(x, y); vel(x + vx * 5, y + vy * 5);
          x += vx * 10; y += vy * 10;
          for (j = 0; j < st.length; j++) { var q = st[j], dx = x - q[0], dy = y - q[1], dd = Math.sqrt(dx * dx + dy * dy) || 1, lim = q[2] + 2.5; if (q[2] >= 1 && dd < lim) { x = q[0] + dx / dd * lim; y = q[1] + dy / dd * lim; } }
        }
        if (m <= 8) continue;
        var bold = n % 6 === 2;
        g.strokeStyle = rgba(fg, bold ? 0.82 : 0.6); g.lineWidth = bold ? 1.7 : 0.9;
        g.beginPath(); g.moveTo(P[0], P[1]); for (i = 2; i < m; i += 2) g.lineTo(P[i], P[i + 1]); g.stroke();
        if (still) continue;
        // 물살: 선을 따라 지나가는 짧고 진한 마디
        var len = m / 2, h = (T * 7 + n * 13.7) % (len + 26) - 6, h0 = Math.max(0, Math.floor(h)) * 2, h1 = Math.min(len - 1, Math.floor(h) + 6) * 2;
        if (h1 > h0) { g.strokeStyle = rgba(fg, 0.9); g.lineWidth = bold ? 2.2 : 1.5; g.beginPath(); g.moveTo(P[h0], P[h0 + 1]); for (i = h0 + 2; i <= h1; i += 2) g.lineTo(P[i], P[i + 1]); g.stroke(); }
      }
      if (!on) { on = true; fig.classList.add('fx-stream-on'); } // 첫 장을 그린 뒤에 정지 그림을 감춤
    };
    loop = ctx.loop(plate, draw, { fps: 40 });
    return function () { fig.classList.remove('fx-stream-on'); if (made) made.remove(); };
  }
});
