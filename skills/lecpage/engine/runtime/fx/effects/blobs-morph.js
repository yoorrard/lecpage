/* blobs-morph — 둥근 덩어리가 숨 쉬듯 모양을 바꾼다(SVG, 초당 30회, 그라데이션은 토큰 색) */
LecFX.define('blobs-morph', {
  level: 2,
  loop: true,
  init: function (el, o, ctx) {
    var ly = ctx.layer(el), id = 'fxb' + (Math.random() * 1e6 | 0), NS = 'http://www.w3.org/2000/svg';
    ly.innerHTML = '<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" focusable="false"><defs>' +
      '<linearGradient id="' + id + 'a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--primary)"/><stop offset="1" style="stop-color:var(--accent)"/></linearGradient>' +
      '<linearGradient id="' + id + 'b" x1="1" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent-2)"/><stop offset="1" style="stop-color:var(--primary)"/></linearGradient>' +
      '<linearGradient id="' + id + 'c" x1="0" y1="1" x2="1" y2="0"><stop offset="0" style="stop-color:var(--accent-3)"/><stop offset="1" style="stop-color:var(--accent)"/></linearGradient>' +
      '</defs></svg>';
    var svg = ly.firstChild, rnd = ctx.util.rand(o.seed || 9);
    var B = [[128, 24, 30, 'a', 0.5], [26, 84, 24, 'b', 0.42], [96, 82, 9, 'c', 0.6]].map(function (b) {
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('fill', 'url(#' + id + b[3] + ')');
      p.setAttribute('fill-opacity', b[4]);
      svg.appendChild(p);
      var ph = [], sp = [];
      for (var i = 0; i < 8; i++) { ph.push(rnd() * 6.28); sp.push(0.25 + rnd() * 0.45); }
      return { el: p, x: b[0], y: b[1], r: b[2], ph: ph, sp: sp };
    });
    var path = function (b, t) {
      var pts = [], n = 8;
      for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2 + t * 0.05, r = b.r * (1 + 0.13 * Math.sin(t * b.sp[i] + b.ph[i]) + 0.05 * Math.sin(t * 0.7 + i));
        pts.push([b.x + Math.cos(a) * r, b.y + Math.sin(a) * r]);
      }
      var d = 'M' + pts[0][0].toFixed(2) + ' ' + pts[0][1].toFixed(2);
      for (var k = 0; k < n; k++) {
        var p0 = pts[(k - 1 + n) % n], p1 = pts[k], p2 = pts[(k + 1) % n], p3 = pts[(k + 2) % n];
        d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(2) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(2) + ' ' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(2) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(2) + ' ' + p2[0].toFixed(2) + ' ' + p2[1].toFixed(2);
      }
      return d + 'Z';
    };
    ctx.loop(ly, function (t) { B.forEach(function (b) { b.el.setAttribute('d', path(b, t)); }); }, { fps: 30, t: 3 });
  }
});
