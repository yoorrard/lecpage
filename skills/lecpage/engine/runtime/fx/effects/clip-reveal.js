/* clip-reveal — 사진이 사각·원·사선 마스크로 열리며 안쪽 이미지는 살짝 줄어든다 */
LecFX.define('clip-reveal', {
  level: 2,
  init: function (el, o, ctx) {
    if (ctx.reduced) return;
    var items = o.items ? Array.prototype.slice.call(el.querySelectorAll(o.items)) : (el.matches('img,picture,figure,video') ? [el] : Array.prototype.slice.call(el.querySelectorAll('figure, img:not(figure img), picture:not(figure picture)')));
    if (!items.length) items = [el];
    var shape = /^(circle|diagonal|up|left)$/.test(o.shape) ? o.shape : 'up';
    items.forEach(function (it, i) {
      it.classList.add('fx-clip', 'fx-clip--' + shape);
      it.style.setProperty('--fx-d', Math.min(i * (o.stagger || 90), 450) + 'ms');
      ctx.enter(it, function () { setTimeout(function () { it.classList.remove('fx-clip', 'fx-clip--' + shape); }, 1500 + i * 90); }, { at: 0.92 });
    });
    return function () { items.forEach(function (it) { it.classList.remove('fx-clip', 'fx-clip--' + shape); it.style.removeProperty('--fx-d'); }); };
  }
});
