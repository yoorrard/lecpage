/* confetti — 완료 순간에만 1초 안쪽으로 터지는 축하 조각(캔버스). 동작 줄이기면 짧은 빛 테두리만
   발동: 이 요소 클릭(opts.on="click") · LecFX.celebrate({x,y,el}) · document의 lecfx:celebrate 이벤트 */
LecFX.define('confetti', {
  level: 2,
  init: function (el, o, ctx) {
    var busy = false;
    var still = function (t) {
      if (!t || !t.classList) return;
      t.classList.remove('fx-celebrate-still'); void t.offsetWidth; t.classList.add('fx-celebrate-still');
      setTimeout(function () { t.classList.remove('fx-celebrate-still'); }, 900);
    };
    var burst = function (d) {
      d = d || {};
      var src = d.el || (o.on === 'click' ? el : null);
      if (ctx.reduced || ctx.level < 2) { still(src); return; }
      if (busy) return;
      busy = true;
      var x = d.x, y = d.y;
      if (x == null && src) { var r = src.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
      if (x == null) { x = innerWidth / 2; y = innerHeight * 0.45; }
      var cv = document.createElement('canvas'), g = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
      cv.className = 'fx-confetti'; cv.setAttribute('aria-hidden', 'true');
      cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
      document.body.appendChild(cv);
      g.scale(dpr, dpr);
      var cols = ['primary', 'accent', 'accent-2', 'accent-3'].map(function (n) { return ctx.color(n, 1); });
      var N = ctx.lowPower ? 46 : 96, rnd = Math.random, P = [];
      for (var i = 0; i < N; i++) {
        var a = -Math.PI / 2 + (rnd() - 0.5) * Math.PI * 1.15, sp = 6 + rnd() * 9;
        P.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, r: rnd() * 6.28, vr: (rnd() - 0.5) * 0.5, w: 5 + rnd() * 6, h: 3 + rnd() * 4, c: cols[i % cols.length], k: i % 3 });
      }
      var t0 = 0, D = 950;
      var f = function (now) {
        if (!t0) t0 = now;
        var e = now - t0, life = 1 - e / D;
        g.clearRect(0, 0, innerWidth, innerHeight);
        if (life <= 0) { cv.remove(); busy = false; return; }
        P.forEach(function (p) {
          p.vy += 0.42; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
          g.save(); g.globalAlpha = Math.min(1, life * 1.6); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c;
          if (p.k === 0) g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          else if (p.k === 1) { g.beginPath(); g.arc(0, 0, p.h * 0.7, 0, 6.29); g.fill(); }
          else { g.beginPath(); g.moveTo(-p.w / 2, 0); g.lineTo(0, -p.h); g.lineTo(p.w / 2, 0); g.closePath(); g.fill(); }
          g.restore();
        });
        requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    };
    ctx.on(document, 'lecfx:celebrate', function (e) { burst(e.detail); });
    if (o.on === 'click' || el.hasAttribute('data-celebrate')) ctx.on(el, 'click', function (e) { burst({ x: e.clientX || null, y: e.clientY || null, el: el }); });
  }
});
