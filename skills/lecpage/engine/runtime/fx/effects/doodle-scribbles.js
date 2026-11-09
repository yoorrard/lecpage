/* doodle-scribbles — 손으로 그린 듯한 거친 선(자체 rough 알고리즘, 라이브러리 없음)
   글 요소에 붙이면 밑줄·동그라미·상자·형광·취소선·괄호로 주석을 단다(mode). 섹션에 mode:"decor"면 모서리에 낙서를 흩뿌린다 */
(function () {
  var U = LecFX.util;
  var R = U.rough || (U.rough = {
    cat: function (pts, closed) {
      var n = pts.length, d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
      for (var i = 0; i < n - (closed ? 0 : 1); i++) {
        var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[Math.min(n - 1, i + 2)];
        if (closed) { p0 = pts[(i - 1 + n) % n]; p3 = pts[(i + 2) % n]; }
        d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
      }
      return d;
    },
    line: function (x1, y1, x2, y2, rnd, k) {
      var len = Math.hypot(x2 - x1, y2 - y1) || 1, off = Math.min(len * 0.05, k || 2.4), j = function () { return (rnd() - 0.5) * 2 * off; };
      var nx = -(y2 - y1) / len, ny = (x2 - x1) / len, bow = (rnd() - 0.5) * len * 0.035, out = '';
      for (var pass = 0; pass < 2; pass++) {
        var mx = x1 + (x2 - x1) * (0.45 + rnd() * 0.1) + nx * bow, my = y1 + (y2 - y1) * (0.45 + rnd() * 0.1) + ny * bow;
        out += 'M' + (x1 + j()).toFixed(1) + ' ' + (y1 + j()).toFixed(1) + ' Q' + (mx + j()).toFixed(1) + ' ' + (my + j()).toFixed(1) + ' ' + (x2 + j()).toFixed(1) + ' ' + (y2 + j()).toFixed(1) + ' ';
      }
      return out;
    },
    ellipse: function (cx, cy, rx, ry, rnd) {
      var pts = [], a0 = rnd() * 6.28, steps = 14, over = 0.35 + rnd() * 0.3;
      for (var i = 0; i <= steps; i++) {
        var a = a0 + (i / steps) * (Math.PI * 2 + over), k = 1 + (rnd() - 0.5) * 0.08 + (i / steps) * 0.04;
        pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
      }
      return R.cat(pts, false);
    }
  });
  var NS = 'http://www.w3.org/2000/svg';
  var SHAPES = {
    star: function (r) { var p = []; for (var i = 0; i <= 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? 0.45 : 1; p.push([50 + Math.cos(a) * 40 * k + (r() - 0.5) * 3, 50 + Math.sin(a) * 40 * k + (r() - 0.5) * 3]); } return p.map(function (q, i) { return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' '); },
    spiral: function (r) { var p = []; for (var i = 0; i < 40; i++) { var a = i * 0.42, rr = 4 + i * 1.05; p.push([50 + Math.cos(a) * rr + (r() - 0.5) * 2, 50 + Math.sin(a) * rr + (r() - 0.5) * 2]); } return R.cat(p, false); },
    squiggle: function (r) { var p = []; for (var i = 0; i <= 8; i++) p.push([8 + i * 10.5, 50 + (i % 2 ? -16 : 16) + (r() - 0.5) * 6]); return R.cat(p, false); },
    arrow: function (r) { return R.cat([[10, 70], [30, 40 + r() * 6], [58, 30], [86, 34]], false) + ' ' + R.line(86, 34, 70, 22, r, 1.5) + R.line(86, 34, 72, 46, r, 1.5); },
    heart: function (r) { return R.cat([[50, 82], [20, 52], [22, 26], [42, 24], [50, 38], [58, 24], [78, 26], [80, 52], [50, 82]], false); },
    circle: function (r) { return R.ellipse(50, 50, 36, 30, r); },
    plus: function (r) { return R.line(50, 18, 50, 82, r) + R.line(18, 50, 82, 50, r); },
    sparkle: function (r) { return R.line(50, 12, 50, 88, r, 1.5) + R.line(12, 50, 88, 50, r, 1.5) + R.line(26, 26, 74, 74, r, 1.5) + R.line(74, 26, 26, 74, r, 1.5); }
  };
  U.doodle = SHAPES;
  var draw = function (svg, ctx, delay) {
    Array.prototype.forEach.call(svg.querySelectorAll('path'), function (p, i) {
      var L = 0;
      try { L = p.getTotalLength(); } catch (e) { L = 0; }
      if (!L || ctx.reduced) return;
      p.style.strokeDasharray = L + ' ' + L;
      p.style.strokeDashoffset = L;
      p.style.setProperty('--fx-d', (delay + i * 120) + 'ms');
    });
    svg.setAttribute('data-fx-pre', '');
    return function () { void svg.getBoundingClientRect(); svg.removeAttribute('data-fx-pre'); Array.prototype.forEach.call(svg.querySelectorAll('path'), function (p) { p.style.strokeDashoffset = 0; }); };
  };
  LecFX.define('doodle-scribbles', {
    level: 2,
    init: function (el, o, ctx) {
      var rnd = U.rand(o.seed || U.hash(el.textContent || 'x')), col = String(o.color || 'accent').replace(/[^a-z0-9-]/g, '');
      if (o.mode === 'decor' || (!o.mode && /^(SECTION|HEADER|FOOTER|DIV|MAIN|ASIDE)$/.test(el.tagName) && el.children.length > 1)) {
        var ly = ctx.layer(el, 'fx-doodle-decor'), keys = o.shapes || ['star', 'spiral', 'squiggle', 'arrow', 'heart', 'circle', 'plus', 'sparkle'], n = o.count || 6, spots = [];
        for (var i = 0; i < n; i++) {
          var sp = U.spot(rnd, i), x = sp[0] / 100, y = sp[1] / 100;
          var s = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path'), k = keys[(i + (o.seed || 0)) % keys.length];
          s.setAttribute('viewBox', '0 0 100 100');
          s.setAttribute('class', 'fx-doodle');
          s.style.cssText = 'left:' + (x * 100).toFixed(1) + '%;top:' + (y * 100).toFixed(1) + '%;--r:' + ((rnd() - 0.5) * 40).toFixed(0) + 'deg;--sz:' + (44 + rnd() * 50).toFixed(0) + 'px;color:var(--' + (i % 3 === 0 ? 'primary' : i % 3 === 1 ? col : 'accent-2') + ')';
          p.setAttribute('d', SHAPES[k] ? SHAPES[k](rnd) : SHAPES.star(rnd));
          s.appendChild(p); ly.appendChild(s); spots.push(s);
        }
        spots.forEach(function (s, i) { var go = draw(s, ctx, i * 140); ctx.visible(ly, go, { once: true, rootMargin: '0px 0px -15% 0px' }); });
        return;
      }
      var kind = o.mode || 'underline', svg = document.createElementNS(NS, 'svg'), first = true;
      svg.setAttribute('class', 'fx-annot fx-annot--' + kind);
      svg.setAttribute('aria-hidden', 'true');
      svg.style.color = 'var(--' + col + ')';
      el.classList.add('fx-annot-host');
      el.appendChild(svg);
      svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
      var render = function () {
        var seedRnd = U.rand(o.seed || U.hash(el.textContent || 'x'));
        svg.style.display = 'none';
        var host = el.getBoundingClientRect(), rects = [], tw = document.createTreeWalker(el, 4), tn;
        while ((tn = tw.nextNode())) {
          if (!tn.nodeValue.trim() || (tn.parentNode.closest && tn.parentNode.closest('.fx-sr'))) continue;
          var rg = document.createRange();
          rg.selectNodeContents(tn);
          Array.prototype.forEach.call(rg.getClientRects(), function (r) { if (r.width > 2 && r.height > 2) rects.push(r); });
        }
        svg.style.display = '';
        if (!rects.length) return;
        var L = Infinity, T = Infinity, Rr = -Infinity, B = -Infinity, d = '';
        var lines = [];
        rects.forEach(function (r) {
          var x = r.left - host.left, y = r.top - host.top;
          var ln = lines.length && Math.abs(lines[lines.length - 1].y - y) < 4 ? lines[lines.length - 1] : null;
          if (ln) { ln.x2 = Math.max(ln.x2, x + r.width); ln.x = Math.min(ln.x, x); ln.h = Math.max(ln.h, r.height); } else lines.push({ x: x, y: y, x2: x + r.width, h: r.height });
          L = Math.min(L, x); T = Math.min(T, y); Rr = Math.max(Rr, x + r.width); B = Math.max(B, y + r.height);
        });
        svg.setAttribute('viewBox', '0 0 ' + host.width.toFixed(0) + ' ' + host.height.toFixed(0));
        svg.setAttribute('width', host.width.toFixed(0)); svg.setAttribute('height', host.height.toFixed(0));
        if (kind === 'circle') d = R.ellipse((L + Rr) / 2, (T + B) / 2, (Rr - L) / 2 + 14, (B - T) / 2 + 10, seedRnd);
        else if (kind === 'box') { var p = 8; d = R.line(L - p, T - p, Rr + p, T - p, seedRnd) + R.line(Rr + p, T - p, Rr + p, B + p, seedRnd) + R.line(Rr + p, B + p, L - p, B + p, seedRnd) + R.line(L - p, B + p, L - p, T - p, seedRnd); }
        else if (kind === 'bracket') d = R.cat([[L - 6, T], [L - 14, T + 4], [L - 14, B - 4], [L - 6, B]], false) + ' ' + R.cat([[Rr + 6, T], [Rr + 14, T + 4], [Rr + 14, B - 4], [Rr + 6, B]], false);
        else lines.forEach(function (ln) {
          var y = kind === 'strike' ? ln.y + ln.h * 0.55 : kind === 'highlight' ? ln.y + ln.h * 0.62 : ln.y + ln.h * 0.96;
          d += R.line(ln.x - 3, y + 2, ln.x2 + 4, y - 1, seedRnd, kind === 'highlight' ? 1.2 : 2.4);
        });
        svg.innerHTML = '';
        var path = document.createElementNS(NS, 'path');
        path.setAttribute('d', d);
        if (kind === 'highlight') path.style.strokeWidth = (lines[0].h * 0.55).toFixed(0) + 'px';
        svg.appendChild(path);
        if (first) { first = false; var go = draw(svg, ctx, o.delay || 200); ctx.visible(el, go, { once: true, rootMargin: '0px 0px -12% 0px' }); }
      };
      var start = function () { render(); };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();
      if ('ResizeObserver' in window) { var lw = 0, ro = new ResizeObserver(function () { var w = el.clientWidth; if (Math.abs(w - lw) > 2) { lw = w; if (!first) render(); } }); ro.observe(el); ctx.cleanup(function () { ro.disconnect(); }); }
      return function () { svg.remove(); el.classList.remove('fx-annot-host'); };
    }
  });
})();
