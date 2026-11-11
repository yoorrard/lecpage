/* orbit-3d — 점으로 그린 입체 매듭(토러스 매듭)이 천천히 돌고, 포인터 쪽으로 기울며, 이 연수의 낱말이 둘레를 돈다(Canvas 2D, 바깥 파일 없음).
   서버가 그려 둔 정지 그림(svg)이 있으면 그 위에 캔버스를 얹고 그림은 감춘다. 동작 줄이기·가벼운 모드·저사양에서는 정지 그림 그대로.
   화면 밖·숨은 탭·멈춤에서는 그리지 않는다(ctx.loop). 점 수와 화소 배율은 기기에 맞춰 줄인다. */
LecFX.define('orbit-3d', {
  level: 2,
  loop: true,
  init: function (el, o, ctx) {
    if (ctx.reduced || ctx.lowPower) return; // 서버가 그린 정지 그림을 그대로 둠
    var U = ctx.util, small = window.innerWidth < 700;
    var cv = ctx.canvas(el, { maxDpr: small ? 1.25 : 1.75 }), g = cv.g;
    if (!g) return;
    el.classList.add('fx-orbit-on');
    var rnd = U.rand(U.hash(el.getAttribute('data-seed') || document.title || 'lecpage'));
    var N = small ? 620 : 1300, P = new Float32Array(N * 4);
    for (var i = 0; i < N; i++) {
      var t = (i / N) * Math.PI * 2, jr = 0.22 * Math.sqrt(rnd()), ja = rnd() * 6.283, jb = rnd() * 6.283;
      var r = 2 + Math.cos(3 * t);
      P[i * 4] = r * Math.cos(2 * t) + jr * Math.cos(ja) * Math.cos(jb);
      P[i * 4 + 1] = r * Math.sin(2 * t) + jr * Math.sin(ja) * Math.cos(jb);
      P[i * 4 + 2] = -Math.sin(3 * t) * 1.15 + jr * Math.sin(jb);
      P[i * 4 + 3] = rnd(); // 색·크기 변주
    }
    var labels = [];
    try { labels = JSON.parse(el.getAttribute('data-labels') || '[]').slice(0, small ? 3 : 5); } catch (e) { labels = []; }
    var tags = labels.map(function (txt) { var s = document.createElement('span'); s.className = 'fx-orbit-tag'; s.textContent = txt; el.appendChild(s); return s; });
    var cPri, cAcc, cFg;
    var colors = function () { cPri = ctx.rgb('primary'); cAcc = ctx.rgb('accent'); cFg = ctx.rgb('foreground'); };
    colors(); ctx.onTheme(colors);
    var tx = 0, ty = 0, px = 0, py = 0;
    if (ctx.fine) {
      var host = el.closest('.lp-hero') || el;
      ctx.on(host, 'pointermove', function (e) { var b = host.getBoundingClientRect(); tx = (e.clientX - b.left) / b.width * 2 - 1; ty = (e.clientY - b.top) / b.height * 2 - 1; });
      ctx.on(host, 'pointerleave', function () { tx = ty = 0; });
    }
    var draw = function (T) {
      var W = cv.w, H = cv.h, S = Math.min(W, H) * 0.19, cx = W * 0.5, cy = H * 0.5;
      px += (tx - px) * 0.06; py += (ty - py) * 0.06;
      var ay = T * 0.22 + px * 0.9, ax = 0.5 + py * 0.5, sy = Math.sin(ay), cyy = Math.cos(ay), sx = Math.sin(ax), cxx = Math.cos(ax);
      g.clearRect(0, 0, W, H);
      for (var i = 0; i < N; i++) {
        var x = P[i * 4], y = P[i * 4 + 1], z = P[i * 4 + 2], v = P[i * 4 + 3];
        var x1 = x * cyy + z * sy, z1 = -x * sy + z * cyy, y1 = y * cxx - z1 * sx, z2 = y * sx + z1 * cxx;
        var k = 6.4 / (6.4 + z2), X = cx + x1 * S * k, Y = cy + y1 * S * k, depth = U.clamp((3.4 - z2) / 6.8, 0, 1);
        var c = v > 0.9 ? cAcc : v > 0.3 ? cPri : cFg, rad = (0.5 + depth * 1.5) * (v > 0.9 ? 1.5 : 1);
        g.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (0.16 + depth * 0.78).toFixed(2) + ')';
        g.fillRect(X - rad * 0.5, Y - rad * 0.5, rad, rad);
      }
      // 둘레를 도는 낱말(기울어진 고리 위)
      for (var j = 0; j < tags.length; j++) {
        var a = T * 0.28 + j * (6.283 / tags.length), R = 3.9, lx = R * Math.cos(a), lz = R * Math.sin(a), ly = Math.sin(a * 1.0 + j) * 0.7;
        var qx = lx * cyy * 0.2 + lx * 0.8, qz = lz, qy = ly * cxx - qz * sx * 0.4, kk = 6.4 / (6.4 + qz * 0.6);
        tags[j].style.transform = 'translate3d(' + (cx + qx * S * kk).toFixed(1) + 'px,' + (cy + qy * S * kk).toFixed(1) + 'px,0) translate(-50%,-50%) scale(' + (0.78 + (1 - (qz + R) / (2 * R)) * 0.34).toFixed(3) + ')';
        tags[j].style.opacity = (0.35 + (1 - (qz + R) / (2 * R)) * 0.65).toFixed(2);
      }
    };
    ctx.loop(el, draw, { fps: small ? 30 : 0, t: 2 });
    return function () { tags.forEach(function (s) { s.remove(); }); el.classList.remove('fx-orbit-on'); };
  }
});
