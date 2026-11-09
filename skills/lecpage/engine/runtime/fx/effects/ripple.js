/* ripple — 누른 자리에서 물결이 퍼진다(버튼·링크 버튼). 글자색 기준이라 어느 테마에서도 맞는다 */
LecFX.define('ripple', {
  level: 1,
  init: function (el, o, ctx) {
    if (ctx.reduced) return;
    var sel = o.items || 'button, .btn, [role=button], a[class*=btn], a[class*=button]';
    var hosts = el.matches(sel) ? [el] : Array.prototype.slice.call(el.querySelectorAll(sel));
    hosts.forEach(function (h) { h.classList.add('fx-ripple-host'); });
    ctx.on(el, 'pointerdown', function (e) {
      var h = e.target.closest ? e.target.closest('.fx-ripple-host') : null;
      if (!h || !el.contains(h) && h !== el) return;
      var r = h.getBoundingClientRect(), s = Math.hypot(Math.max(e.clientX - r.left, r.right - e.clientX), Math.max(e.clientY - r.top, r.bottom - e.clientY)) * 2;
      var dot = document.createElement('span');
      dot.className = 'fx-ripple';
      dot.setAttribute('aria-hidden', 'true');
      dot.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (e.clientX - r.left - s / 2) + 'px;top:' + (e.clientY - r.top - s / 2) + 'px';
      h.appendChild(dot);
      setTimeout(function () { dot.remove(); }, 700);
    });
    return function () { hosts.forEach(function (h) { h.classList.remove('fx-ripple-host'); }); };
  }
});
