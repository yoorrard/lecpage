/* scramble — 왼쪽부터 차례로 제자리로(한 번, 0.7초 안). 영문·숫자만 잠깐 섞이고, 한글 등 다른 글자는
   다른 음절을 보여 주지 않고 흐리게 기다렸다가 드러남("여타 루타"처럼 깨진 글로 보이지 않게). 원문은 낭독기용으로 유지 */
LecFX.define('scramble', {
  level: 2,
  init: function (el, o, ctx) {
    if (ctx.reduced) return;
    var EN = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghkmnpqrstuvwxyz', NU = '0123456789';
    var s = ctx.util.split(el, 'chars');
    if (!s.chars.length || s.chars.length > (o.max || 160)) { s.revert(); return; }
    var items = s.chars.map(function (c) {
      var ch = c.textContent;
      return { el: c, ch: ch, pool: /[A-Za-z]/.test(ch) ? EN : /\d/.test(ch) ? NU : '' };
    });
    el.classList.add('fx-scramble');
    var raf = 0, rnd = ctx.util.rand(ctx.util.hash(el.textContent));
    var finish = function () { raf = 0; items.forEach(function (it) { it.el.textContent = it.ch; it.el.style.width = ''; it.el.classList.remove('fx-wait'); }); };
    var run = function () {
      if (raf) return;
      items.forEach(function (it) { if (it.pool) it.el.style.width = it.el.getBoundingClientRect().width + 'px'; else if (it.ch.trim()) it.el.classList.add('fx-wait'); });
      var n = items.length, dur = Math.min(+o.duration || 700, 700), t0 = 0, tick = 0;
      var frame = function (now) {
        if (!t0) t0 = now;
        var e = now - t0, swap = now - tick > 50, done = true;
        if (swap) tick = now;
        items.forEach(function (it, i) {
          var at = (i / n) * dur * 0.85 + dur * 0.15;
          if (e >= at) { if (it.el.textContent !== it.ch) it.el.textContent = it.ch; it.el.classList.remove('fx-wait'); return; }
          done = false;
          if (it.pool && swap) it.el.textContent = it.pool.charAt(Math.floor(rnd() * it.pool.length));
        });
        if (done || e > dur + 100) { finish(); return; }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    };
    var trig = o.trigger || 'enter';
    if (trig !== 'hover') ctx.visible(el, run, { once: true, rootMargin: '0px 0px -12% 0px' });
    if (trig !== 'enter' && ctx.fine) ctx.on(el, 'pointerenter', run);
    ctx.onPause(function (p) { if (p && raf) { cancelAnimationFrame(raf); finish(); } });
    return function () { if (raf) cancelAnimationFrame(raf); s.revert(); el.classList.remove('fx-scramble'); };
  }
});
