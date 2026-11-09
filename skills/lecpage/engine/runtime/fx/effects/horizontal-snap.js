/* horizontal-snap — 목록을 가로 스냅 넘김으로. 이전/다음 버튼·키보드·마우스 끌기·진행 막대. 세로 스크롤은 뺏지 않는다 */
LecFX.define('horizontal-snap', {
  level: 1,
  init: function (el, o, ctx) {
    if (el.children.length < 2) return;
    if (el.closest('[aria-hidden="true"]')) { /* 꾸밈 영역: 버튼·포커스 대상은 만들지 않는다 */
      el.classList.add('fx-hsnap');
      return function () { el.classList.remove('fx-hsnap'); };
    }
    var parent = el.parentNode, wrap = document.createElement('div'), bar = document.createElement('div');
    wrap.className = 'fx-hsnap-wrap';
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', o.label || '가로로 넘겨 보기');
    parent.insertBefore(wrap, el);
    wrap.appendChild(el);
    el.classList.add('fx-hsnap');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    bar.className = 'fx-hsnap-bar';
    bar.innerHTML = '<button type="button" class="fx-hsnap-btn" data-dir="-1" aria-label="이전"><span aria-hidden="true">‹</span></button><span class="fx-hsnap-track" aria-hidden="true"><span class="fx-hsnap-thumb"></span></span><button type="button" class="fx-hsnap-btn" data-dir="1" aria-label="다음"><span aria-hidden="true">›</span></button>';
    wrap.appendChild(bar);
    var prev = bar.children[0], next = bar.children[2], thumb = bar.querySelector('.fx-hsnap-thumb'), q = 0;
    var sync = function () {
      q = 0;
      var max = el.scrollWidth - el.clientWidth, x = el.scrollLeft;
      var vis = el.clientWidth / (el.scrollWidth || 1);
      wrap.classList.toggle('is-static', max < 4);
      prev.disabled = x < 4; next.disabled = x > max - 4;
      wrap.classList.toggle('at-start', x < 4); wrap.classList.toggle('at-end', x > max - 4);
      thumb.style.width = (vis * 100).toFixed(2) + '%';
      thumb.style.transform = 'translateX(' + ((max > 0 ? x / max : 0) * (1 / vis - 1) * 100).toFixed(2) + '%)';
    };
    var step = function (dir) {
      var item = el.children[0], gap = parseFloat(getComputedStyle(el).columnGap) || 16;
      el.scrollBy({ left: dir * Math.max(item.getBoundingClientRect().width + gap, el.clientWidth * 0.8), behavior: ctx.reduced ? 'auto' : 'smooth' });
    };
    ctx.on(prev, 'click', function () { step(-1); });
    ctx.on(next, 'click', function () { step(1); });
    ctx.on(el, 'scroll', function () { if (!q) q = requestAnimationFrame(sync); }, { passive: true });
    ctx.on(window, 'resize', function () { if (!q) q = requestAnimationFrame(sync); });
    if (ctx.fine) {
      var down = null, moved = false;
      ctx.on(el, 'pointerdown', function (e) {
        if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('a,button,input,textarea,select')) return;
        down = { x: e.clientX, l: el.scrollLeft }; moved = false;
      });
      ctx.on(window, 'pointermove', function (e) {
        if (!down) return;
        var dx = e.clientX - down.x;
        if (!moved && Math.abs(dx) > 6) { moved = true; el.classList.add('is-drag'); }
        if (moved) el.scrollLeft = down.l - dx;
      });
      ctx.on(window, 'pointerup', function () { if (!down) return; down = null; setTimeout(function () { el.classList.remove('is-drag'); }, 0); });
      ctx.on(el, 'click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    }
    sync();
    return function () { if (q) cancelAnimationFrame(q); parent.insertBefore(el, wrap); wrap.remove(); el.classList.remove('fx-hsnap', 'is-drag'); };
  }
});
