/* scramble — 한글 음절·영문·숫자 풀에서 무작위로 섞였다가 왼쪽부터 제자리로(한 번만). 원문은 낭독기용으로 유지 */
LecFX.define('scramble', {
  level: 2,
  init: function (el, o, ctx) {
    if (ctx.reduced) return;
    var POOL = {
      ko: '가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허고노도로모보소오조초코토포호구누두루무부수우주추쿠투푸후배움연수생각마음글빛길숲별',
      en: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghkmnpqrstuvwxyz',
      nu: '0123456789'
    };
    var s = ctx.util.split(el, 'chars');
    if (!s.chars.length || s.chars.length > (o.max || 160)) { s.revert(); return; }
    var items = s.chars.map(function (c) {
      var ch = c.textContent, code = ch.charCodeAt(0);
      var pool = code >= 0xAC00 && code <= 0xD7A3 ? POOL.ko : /[A-Za-z]/.test(ch) ? POOL.en : /\d/.test(ch) ? POOL.nu : '';
      return { el: c, ch: ch, pool: pool };
    });
    el.classList.add('fx-scramble');
    var raf = 0, rnd = ctx.util.rand(ctx.util.hash(el.textContent));
    var run = function () {
      if (raf) return;
      items.forEach(function (it) { if (it.pool) it.el.style.width = it.el.getBoundingClientRect().width + 'px'; });
      var n = items.length, dur = Math.min(o.duration || 700 + n * 22, 1600), t0 = 0, tick = 0;
      var frame = function (now) {
        if (!t0) t0 = now;
        var e = now - t0, swap = now - tick > 55;
        if (swap) tick = now;
        var done = true;
        items.forEach(function (it, i) {
          if (!it.pool) return;
          var at = (i / n) * dur * 0.75 + dur * 0.25;
          if (e >= at) { if (it.el.textContent !== it.ch) it.el.textContent = it.ch; return; }
          done = false;
          if (swap) it.el.textContent = it.pool.charAt(Math.floor(rnd() * it.pool.length));
        });
        if (done) { raf = 0; items.forEach(function (it) { it.el.style.width = ''; }); return; }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    };
    var trig = o.trigger || 'enter';
    if (trig !== 'hover') ctx.visible(el, run, { once: true, rootMargin: '0px 0px -12% 0px' });
    if (trig !== 'enter' && ctx.fine) ctx.on(el, 'pointerenter', run);
    return function () { if (raf) cancelAnimationFrame(raf); s.revert(); el.classList.remove('fx-scramble'); };
  }
});
