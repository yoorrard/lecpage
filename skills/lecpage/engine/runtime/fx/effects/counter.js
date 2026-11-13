/* counter — 화면에 들어오면 숫자가 0부터 올라간다. 원래 표기(쉼표·소수·단위)를 지키고, 폭이 흔들리지 않게 고정.
   들어오기 전·처음부터 보이던 숫자·효과가 멈춘 화면에서는 실제 값 그대로(0이 남아 있지 않게) */
LecFX.define('counter', {
  level: 1,
  init: function (el, o, ctx) {
    if (ctx.reduced) return;
    var txt = el.textContent, m = /-?\d[\d,]*(\.\d+)?/.exec(txt);
    if (!m) return;
    var raw = m[0], end = parseFloat(raw.replace(/,/g, '')), dec = m[1] ? m[1].length - 1 : 0, comma = raw.indexOf(',') > -1;
    if (!isFinite(end)) return;
    var orig = el.innerHTML;
    var fmt = function (v) {
      var s = Math.abs(v).toFixed(dec), p = s.split('.');
      if (comma) p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return (v < 0 ? '-' : '') + p.join('.');
    };
    el.textContent = '';
    var sr = document.createElement('span'), vis = document.createElement('span'), num = document.createElement('span');
    sr.className = 'fx-sr'; sr.textContent = txt;
    vis.setAttribute('aria-hidden', 'true');
    num.className = 'fx-counter-num';
    num.textContent = raw;
    vis.appendChild(document.createTextNode(txt.slice(0, m.index)));
    vis.appendChild(num);
    vis.appendChild(document.createTextNode(txt.slice(m.index + raw.length)));
    el.appendChild(sr); el.appendChild(vis);
    el.classList.add('fx-counter');
    num.style.minWidth = num.getBoundingClientRect().width + 'px';
    var from = o.from || 0, dur = o.duration || 1500, raf = 0;
    /* 불러온 직후에도 실제 값이 보임: 세기 전까지는 원래 숫자 그대로. 처음부터 화면에 보이던 숫자는
       효과 스크립트가 올 때까지 숨어 있었을 때만(html.fx-boot, boot.js) 0부터 셈 — 아니면 실제 값이 보였다가 0으로 튀므로 세지 않음 */
    var r0 = el.getBoundingClientRect();
    if (r0.top < (window.innerHeight || 0) && r0.bottom > 0) {
      if (!document.documentElement.classList.contains('fx-boot')) return function () { el.innerHTML = orig; el.classList.remove('fx-counter'); };
      num.textContent = fmt(from);
    }
    ctx.visible(el, function () {
      var t0 = 0;
      num.textContent = fmt(from);
      var f = function (now) {
        if (!t0) t0 = now;
        var t = Math.min(1, (now - t0) / dur);
        num.textContent = fmt(from + (end - from) * ctx.util.easeExpo(t));
        raf = t < 1 ? requestAnimationFrame(f) : 0;
        if (t >= 1) num.textContent = raw;
      };
      raf = requestAnimationFrame(f);
    }, { once: true, rootMargin: '0px 0px -10% 0px' });
    return function () { if (raf) cancelAnimationFrame(raf); el.innerHTML = orig; el.classList.remove('fx-counter'); };
  }
});
