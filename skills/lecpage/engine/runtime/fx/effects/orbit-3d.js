/* orbit-3d — 점으로 짠 입체 매듭(세잎 매듭 관)이 천천히 돌고, 점 줄이 관을 따라 감기며, 포인터 쪽으로 기울고, 이 연수의 낱말이 둘레 고리를 돈다(Canvas 2D, 바깥 파일 없음).
   서버가 그려 둔 정지 그림(.lp-orbit svg, render/hero.js orbitArt)과 같은 점·같은 각도에서 시작해 그 위에 캔버스를 얹고 그림은 감춘다.
   동작 줄이기·가벼운 모드·저사양에서는 정지 그림 그대로(정지 그림이 없는 자리에서는 한 장만 그림). 화면 밖·숨은 탭·멈춤에서는 그리지 않는다(ctx.loop).
   점 수와 화소 배율은 기기에 맞춰 줄인다. 낱말은 꾸밈(aria-hidden)이고 같은 내용이 본문에 있다. */
LecFX.define('orbit-3d', {
  level: 2,
  loop: true,
  init: function (el, o, ctx) {
    var d = document, box = el.classList.contains('lp-orbit') ? el : el.querySelector('.lp-orbit'), made = [];
    if ((ctx.reduced || ctx.lowPower) && box && box.querySelector('svg')) return; // 서버가 그린 정지 그림을 그대로 둠
    if (!box) { box = d.createElement('div'); box.className = 'lp-orbit'; el.appendChild(box); made.push(box); }
    var small = window.innerWidth < 700, cv = ctx.canvas(box, { maxDpr: small ? 1.25 : 1.75 }), g = cv.g;
    if (!g) return;
    // 관의 뼈대: 단면마다 중심·법선·종법선(법선은 비틀림 없이 옮겨 감). 서버 정지 그림과 같은 식이고 단면 수만 두 배
    var M = small ? 140 : 200, K = 8, RHO = 0.5, D = 9, RT = 4.3, TAU = 6.2832, F = new Float32Array(M * 9), n = [0, 0, 1], hol = 0;
    var at = function (t) { return [Math.sin(t) + 2 * Math.sin(2 * t), Math.cos(t) - 2 * Math.cos(2 * t), -Math.sin(3 * t)]; };
    for (var i = 0; i <= M; i++) {
      var t = i / M * TAU, a = at(t - 0.001), b = at(t + 0.001), c = at(t);
      var tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2], tl = Math.sqrt(tx * tx + ty * ty + tz * tz); tx /= tl; ty /= tl; tz /= tl;
      var dt = n[0] * tx + n[1] * ty + n[2] * tz, nx = n[0] - dt * tx, ny = n[1] - dt * ty, nz = n[2] - dt * tz, nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
      n = [nx / nl, ny / nl, nz / nl];
      if (i < M) F.set([c[0], c[1], c[2], n[0], n[1], n[2], ty * n[2] - tz * n[1], tz * n[0] - tx * n[2], tx * n[1] - ty * n[0]], i * 9);
      else hol = Math.atan2(n[0] * F[6] + n[1] * F[7] + n[2] * F[8], n[0] * F[3] + n[1] * F[4] + n[2] * F[5]); // 한 바퀴 뒤 어긋난 각 → 이음매가 보이지 않게 고르게 나눠 되돌림
    }
    var TW = 11 * TAU - hol;
    // 둘레 낱말: 서버가 넣어 둔 것을 쓰고, 없으면 data-labels에서 만듦
    var tags = Array.prototype.slice.call(box.querySelectorAll('.lp-orbit-tags li'));
    if (!tags.length) {
      var words = [];
      try { words = JSON.parse(el.getAttribute('data-labels') || '[]').slice(0, 5); } catch (e) { words = []; }
      if (words.length) {
        var ul = d.createElement('ul'); ul.className = 'lp-orbit-tags'; ul.setAttribute('aria-hidden', 'true');
        tags = words.map(function (w) { var li = d.createElement('li'); li.textContent = w; ul.appendChild(li); return li; });
        box.appendChild(ul); made.push(ul);
      }
    }
    var keep = tags.map(function (li) { return li.getAttribute('style'); }), pal, loop;
    var colors = function () {
      pal = ['primary', 'foreground', 'accent'].map(function (name) { var c = ctx.rgb(name), out = []; for (var q = 0; q < 8; q++) out.push('rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (0.14 + q * 0.122).toFixed(2) + ')'); return out; });
    };
    colors(); ctx.onTheme(function () { colors(); if (loop) loop.redraw(); });
    var gx = 0, gy = 0, px = 0, py = 0, on = false;
    if (ctx.fine) {
      var host = el.closest('.lp-hero') || el;
      ctx.on(host, 'pointermove', function (e) { var r = host.getBoundingClientRect(); gx = (e.clientX - r.left) / r.width * 2 - 1; gy = (e.clientY - r.top) / r.height * 2 - 1; });
      ctx.on(host, 'pointerleave', function () { gx = gy = 0; });
    }
    var draw = function (T) {
      var W = cv.w, H = cv.h, m = Math.min(W, H), S = m * 0.105, u = m / 400, cx = W / 2, cy = H / 2, k, q, x, y, z;
      px += (gx - px) * 0.06; py += (gy - py) * 0.06;
      // 제자리 돌기(z) → 좌우 흔들림(y) → 앞으로 기울임(x)
      var az = 0.3 + T * 0.16, ay = Math.sin(T * 0.21) * 0.3 + px * 0.6, ax = 0.55 + py * 0.3;
      var sz = Math.sin(az), cz = Math.cos(az), sy = Math.sin(ay), cyy = Math.cos(ay), sx = Math.sin(ax), cxx = Math.cos(ax);
      var tl2 = 1.2 + py * 0.12, st = Math.sin(tl2), ct = Math.cos(tl2);
      g.clearRect(0, 0, W, H);
      // 낱말이 도는 고리(점선)
      g.fillStyle = pal[1][2];
      for (q = 0; q < 110; q++) {
        var ra = q / 110 * TAU; y = RT * Math.sin(ra); k = D / (D + y * st) * S;
        g.fillRect(cx + RT * Math.cos(ra) * k - 0.6, cy + y * ct * k - 0.6, 1.2, 1.2);
      }
      // 매듭: 관을 감아 도는 점 여덟 줄(한 줄은 강조색, 한 줄은 글자색)
      for (var i = 0; i < M; i++) {
        var p = i * 9, tw = i / M * TW + T * 0.35;
        for (var j = 0; j < K; j++) {
          var f = j / K * TAU + tw, co = Math.cos(f) * RHO, si = Math.sin(f) * RHO;
          x = F[p] + co * F[p + 3] + si * F[p + 6]; y = F[p + 1] + co * F[p + 4] + si * F[p + 7]; z = F[p + 2] + co * F[p + 5] + si * F[p + 8];
          var xa = x * cz - y * sz, ya = x * sz + y * cz, x1 = xa * cyy + z * sy, z1 = -xa * sy + z * cyy, y1 = ya * cxx - z1 * sx, z2 = ya * sx + z1 * cxx;
          k = D / (D + z2) * S;
          var dep = (3.4 - z2) / 6.8; dep = dep < 0 ? 0 : dep > 1 ? 1 : dep;
          var rad = (0.9 + dep * 2.3) * (j ? 1 : 1.25) * u, X = cx + x1 * k, Y = cy + y1 * k;
          g.fillStyle = pal[j === 0 ? 2 : j === 4 ? 1 : 0][Math.round(dep * 7)];
          if (rad < 2.2) g.fillRect(X - rad / 2, Y - rad / 2, rad, rad);
          else { g.beginPath(); g.arc(X, Y, rad / 2, 0, TAU); g.fill(); }
        }
      }
      for (q = 0; q < tags.length; q++) {
        var ta = 0.62 + q / tags.length * TAU + T * 0.13; y = RT * Math.sin(ta); z = y * st; k = D / (D + z) * S;
        tags[q].style.transform = 'translate3d(' + (cx + RT * Math.cos(ta) * k).toFixed(1) + 'px,' + (cy + y * ct * k).toFixed(1) + 'px,0) translate(-50%,-50%)';
        tags[q].style.setProperty('--z', (0.5 - z / (2 * RT)).toFixed(2));
      }
      if (!on) { on = true; box.classList.add('fx-orbit-on'); } // 첫 장을 그린 뒤에 정지 그림을 감춤(깜빡임 없음)
    };
    loop = ctx.loop(box, draw, { fps: small ? 30 : 0 });
    return function () {
      box.classList.remove('fx-orbit-on');
      tags.forEach(function (li, q) { if (keep[q] == null) li.removeAttribute('style'); else li.setAttribute('style', keep[q]); });
      made.forEach(function (x) { x.remove(); });
    };
  }
});
