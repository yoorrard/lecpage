/* smooth-scroll — Lenis(MIT)로 휠 스크롤을 부드럽게. 터치·저사양·동작 줄이기·멈춤에서는 끈다(기본 스크롤 유지)
   보통 <body data-fx="smooth-scroll">에 붙인다. 불러오기 실패해도 기본 스크롤 그대로 */
LecFX.define('smooth-scroll', {
  level: 3,
  libs: ['https://cdn.jsdelivr.net/npm/lenis@1.3.27/dist/lenis.min.js'],
  init: function (el, o, ctx) {
    if (ctx.reduced || ctx.lowPower || !ctx.fine || window.__lecLenis) return;
    var lenis = null, dead = false;
    var make = function () {
      if (lenis || dead || ctx.isPaused() || !window.Lenis) return;
      try {
        lenis = new window.Lenis({ autoRaf: true, anchors: true, lerp: o.lerp || 0.11, wheelMultiplier: o.wheel || 1 });
        window.__lecLenis = lenis;
        if (window.ScrollTrigger) lenis.on('scroll', window.ScrollTrigger.update);
      } catch (e) { lenis = null; }
    };
    var kill = function () { if (lenis) { try { lenis.destroy(); } catch (e) { /* 무시 */ } lenis = null; window.__lecLenis = null; } };
    ctx.load(this.libs[0]).then(function (ok) { if (ok) make(); });
    ctx.onPause(function (p) { if (p) kill(); else make(); });
    return function () { dead = true; kill(); };
  }
});
