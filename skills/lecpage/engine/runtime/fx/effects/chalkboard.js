/* chalkboard — 칠판 질감(분필 가루·지운 자국)과 분필로 그린 낙서(正 바를 정, 화살표, 별, +, =). 영역을 어두운 칠판 색으로 바꾼다 */
LecFX.define('chalkboard', {
  level: 2,
  init: function (el, o, ctx) {
    ctx.surface(el, 'dark');
    var ly = ctx.layer(el), U = ctx.util, rnd = U.rand(o.seed || 31), id = 'fxk' + (Math.random() * 1e6 | 0), NS = 'http://www.w3.org/2000/svg';
    var line = function (x1, y1, x2, y2, k) { var len = Math.hypot(x2 - x1, y2 - y1) || 1, j = function () { return (rnd() - 0.5) * (k || 2); }; return 'M' + (x1 + j()).toFixed(1) + ' ' + (y1 + j()).toFixed(1) + ' Q' + ((x1 + x2) / 2 + j() * 1.5).toFixed(1) + ' ' + ((y1 + y2) / 2 + j() * 1.5).toFixed(1) + ' ' + (x2 + j()).toFixed(1) + ' ' + (y2 + j()).toFixed(1) + ' '; };
    var D = {
      jeong: line(20, 22, 80, 22) + line(50, 22, 50, 82) + line(50, 50, 76, 50) + line(30, 50, 30, 82) + line(14, 82, 86, 82),
      arrow: 'M12 70 C30 30 56 26 84 36 ' + line(84, 36, 68, 22, 1.5) + line(84, 36, 70, 50, 1.5),
      star: (function () { var s = ''; for (var i = 0; i < 5; i++) { var a = -Math.PI / 2 + i * 4 * Math.PI / 5, b = -Math.PI / 2 + (i + 1) * 4 * Math.PI / 5; s += line(50 + Math.cos(a) * 38, 52 + Math.sin(a) * 38, 50 + Math.cos(b) * 38, 52 + Math.sin(b) * 38, 2.5); } return s; })(),
      plus: line(50, 16, 50, 84) + line(16, 50, 84, 50),
      eq: line(16, 38, 84, 36) + line(16, 62, 84, 60),
      loop: 'M10 60 C25 20 40 20 42 50 C44 80 60 80 62 50 C64 20 80 20 90 52',
      check: line(18, 52, 40, 76) + line(40, 76, 84, 22)
    };
    var keys = o.marks || ['jeong', 'arrow', 'star', 'plus', 'eq', 'loop', 'check'];
    var spots = [[0.86, 0.16], [0.93, 0.66], [0.64, 0.86], [0.05, 0.9], [0.72, 0.4], [0.52, 0.1], [0.36, 0.92]];
    var html = '<svg class="fx-chalk-defs" width="0" height="0" aria-hidden="true"><filter id="' + id + '" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="4" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.75" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in" result="e"/><feDisplacementMap in="e" in2="n" scale="2" xChannelSelector="R" yChannelSelector="G"/></filter></svg><div class="fx-chalk-dust"></div>';
    keys.slice(0, o.count || 6).forEach(function (k, i) {
      var p = spots[i % spots.length];
      html += '<svg viewBox="0 0 100 100" class="fx-chalk-mark" style="left:' + (p[0] * 100) + '%;top:' + (p[1] * 100) + '%;--r:' + ((rnd() - 0.5) * 24).toFixed(0) + 'deg;--sz:' + (54 + rnd() * 40).toFixed(0) + 'px;' + (i % 3 === 1 ? 'color:var(--accent)' : '') + '"><path filter="url(#' + id + ')" d="' + (D[k] || D.star) + '"/></svg>';
    });
    ly.innerHTML = html;
    if (ctx.reduced) return;
    var paths = Array.prototype.slice.call(ly.querySelectorAll('.fx-chalk-mark path'));
    paths.forEach(function (p, i) {
      var L = 0;
      try { L = p.getTotalLength(); } catch (e) { L = 0; }
      if (!L) return;
      p.style.strokeDasharray = L + ' ' + L; p.style.strokeDashoffset = L; p.style.setProperty('--fx-d', (i * 260) + 'ms');
    });
    ly.setAttribute('data-fx-pre', '');
    ctx.visible(ly, function () { void ly.offsetWidth; ly.removeAttribute('data-fx-pre'); paths.forEach(function (p) { p.style.strokeDashoffset = 0; }); }, { once: true, rootMargin: '0px 0px -10% 0px' });
  }
});
