/* view-transition — 이 영역 안의 탭·필터·펼치기 클릭으로 바뀌는 화면을 document.startViewTransition으로 부드럽게 잇는다
   지원 안 하는 브라우저·동작 줄이기에서는 원래 클릭이 그대로 실행된다. 직접 쓰려면 LecFX.swap(fn) */
LecFX.define('view-transition', {
  level: 1,
  init: function (el, o, ctx) {
    if (!document.startViewTransition || ctx.reduced) return;
    var name = 'fx-vt-' + (Math.random() * 1e6 | 0);
    el.style.viewTransitionName = name;
    el.classList.add('fx-vt');
    var sel = o.items || '[role=tab], [data-vt], [data-filter], summary, [aria-controls]';
    var passing = false;
    ctx.on(el, 'click', function (e) {
      if (passing || !e.isTrusted) return;
      var t = e.target.closest ? e.target.closest(sel) : null;
      if (!t || !el.contains(t) || t.getAttribute('aria-selected') === 'true' || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (t.tagName === 'A' && t.getAttribute('href') && t.getAttribute('href').charAt(0) !== '#') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      LecFX.swap(function () { passing = true; try { t.click(); } finally { passing = false; } });
    }, true);
    return function () { el.style.viewTransitionName = ''; el.classList.remove('fx-vt'); };
  }
});
