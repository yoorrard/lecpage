/* arc-ripple — 번지는 파문. 물결 고리 세 벌이 제 자리에서 바깥으로 번지며 서로 겹친다(자리·간격은 연수 제목에서 나와 같은 제목이면 늘 같다).
   포인터 쪽으로 가운데 물결이 살짝 끌리고, 누른 자리에서 새 물결이 한 번 번진다(SVG, 바깥 파일 없음).
   서버가 그려 둔 정지 그림(.lp-rip svg, render/hero-graphic.js rippleArt)의 고리를 그대로 움직여, 움직임이 실려도 튀지 않는다.
   동작 줄이기·가벼운 모드·저사양에서는 정지 그림 그대로. 화면 밖·숨은 탭·멈춤에서는 쉰다(ctx.loop). */
LecFX.define('arc-ripple', {
  level: 2,
  loop: true,
  init: function (el, o, ctx) {
    var svg = el.querySelector('svg');
    if (!svg || ctx.reduced || ctx.lowPower) return;
    var NS = 'http://www.w3.org/2000/svg';
    var S = [].slice.call(svg.querySelectorAll('g[data-r]')).map(function (g) {
      var a = g.getAttribute('data-r').split(' ').map(Number);
      return { g: g, c: [].slice.call(g.querySelectorAll('circle')), x0: a[0], y0: a[1], x: a[0], y: a[1], gap: a[2], base: a[3], A: a[4] };
    });
    if (!S.length) return;
    // 고리의 진하기: 안쪽에서 서서히 나타나 바깥으로 갈수록 옅어짐(서버의 rippleAlpha와 같은 식)
    var alpha = function (k, n, A) { return Math.max(0, A * Math.min(1, k / 1.2) * Math.pow(Math.max(0, 1 - k / n), 1.15)); };
    var at = function (e) { var m = svg.getScreenCTM(); if (!m) return null; var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(m.inverse()); };
    var host = el.closest('.lp-hero') || el.parentNode || el, tx = S[0].x0, ty = S[0].y0, drops = [];
    if (ctx.fine) {
      ctx.on(host, 'pointermove', function (e) { var p = at(e); if (p) { tx = S[0].x0 + (p.x - S[0].x0) * 0.12; ty = S[0].y0 + (p.y - S[0].y0) * 0.12; } });
      ctx.on(host, 'pointerleave', function () { tx = S[0].x0; ty = S[0].y0; });
    }
    // 누른 자리에서 새 물결(링크·버튼 위는 그대로 둠)
    ctx.on(host, 'pointerdown', function (e) {
      if (e.target.closest && e.target.closest('a,button,input,summary,label')) return;
      var p = at(e); if (!p) return;
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'lp-rip-drop'); g.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')');
      for (var i = 0; i < 3; i++) g.appendChild(document.createElementNS(NS, 'circle'));
      svg.appendChild(g); drops.push({ g: g, t: 0 });
      if (drops.length > 4) drops.shift().g.remove();
    });
    var paint = function (p) {
      for (var i = 0; i < S.length; i++) {
        var s = S[i], q = (p + i * 0.33) % 1, n = s.c.length;
        for (var k = 0; k < n; k++) { s.c[k].setAttribute('r', (s.base + (k + q) * s.gap).toFixed(1)); s.c[k].setAttribute('opacity', alpha(k + q, n, s.A).toFixed(3)); }
      }
    };
    ctx.loop(el, function (T, dt, still) {
      if (still) return;
      S[0].x += (tx - S[0].x) * 0.06; S[0].y += (ty - S[0].y) * 0.06;
      S[0].g.setAttribute('transform', 'translate(' + S[0].x.toFixed(1) + ' ' + S[0].y.toFixed(1) + ')');
      paint((T * 0.16) % 1);
      for (var i = drops.length - 1; i >= 0; i--) {
        var d = drops[i], cs = d.g.childNodes; d.t += dt / 1.7;
        if (d.t >= 1) { d.g.remove(); drops.splice(i, 1); continue; }
        for (var k = 0; k < cs.length; k++) { var u = Math.max(0, d.t - k * 0.14); cs[k].setAttribute('r', (u * 300).toFixed(1)); cs[k].setAttribute('opacity', (u > 0 ? (1 - d.t) * 0.7 : 0).toFixed(3)); }
      }
    }, { fps: 30 });
    return function () {
      drops.forEach(function (d) { d.g.remove(); });
      S[0].g.setAttribute('transform', 'translate(' + S[0].x0 + ' ' + S[0].y0 + ')');
      paint(0);
    };
  }
});
