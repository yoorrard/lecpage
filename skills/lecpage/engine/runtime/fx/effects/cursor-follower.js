/* cursor-follower — 작은 점과 고리가 포인터를 따라온다. 링크 위에서 고리가 커진다. 기본 커서는 숨기지 않는다(정밀 포인터만) */
LecFX.define('cursor-follower', {
  level: 3,
  init: function (el, o, ctx) {
    if (ctx.reduced || !ctx.fine || document.querySelector('.fx-cursor')) return;
    var box = document.createElement('div');
    box.className = 'fx-cursor';
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = '<span class="fx-cursor-ring"></span><span class="fx-cursor-dot"></span>';
    document.body.appendChild(box);
    var ring = box.firstChild, dot = box.lastChild, x = -100, y = -100, rx = -100, ry = -100, raf = 0;
    var tick = function () {
      raf = 0;
      rx += (x - rx) * 0.2; ry += (y - ry) * 0.2;
      ring.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0)';
      if (Math.abs(x - rx) + Math.abs(y - ry) > 0.3) raf = requestAnimationFrame(tick);
    };
    var hot = 'a,button,[role=button],summary,label,select,[data-cursor]';
    ctx.on(window, 'pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX; y = e.clientY;
      dot.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      var t = e.target && e.target.closest ? e.target : null;
      box.classList.toggle('is-hot', !!(t && t.closest(hot)));
      box.classList.toggle('is-text', !!(t && t.closest('input,textarea,[contenteditable],iframe')));
      box.classList.add('is-on');
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
    ctx.on(document, 'pointerleave', function () { box.classList.remove('is-on'); });
    ctx.on(window, 'pointerdown', function () { box.classList.add('is-down'); });
    ctx.on(window, 'pointerup', function () { box.classList.remove('is-down'); });
    ctx.onPause(function (p) { box.classList.toggle('is-paused', p); });
    return function () { if (raf) cancelAnimationFrame(raf); box.remove(); };
  }
});
