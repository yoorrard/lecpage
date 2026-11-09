/* gsap-scroll — GSAP ScrollTrigger로 섹션을 잠깐 고정하고, 안쪽 요소가 스크롤에 맞춰 차례로 떠오른다(scrub)
   넓은 화면만 고정. 좁은 화면은 가벼운 등장. 라이브러리가 안 오면 아무것도 숨기지 않는다
   GSAP은 GreenSock Standard License(상업 사용 무료, 웹플로 인수 후 모든 플러그인 무료) */
LecFX.define('gsap-scroll', {
  level: 3,
  libs: ['https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/gsap.min.js', 'https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/ScrollTrigger.min.js'],
  init: function (el, o, ctx) {
    if (ctx.reduced) return;
    var libs = this.libs, mm = null, dead = false;
    ctx.load(libs[0]).then(function (ok) { return ok && ctx.load(libs[1]); }).then(function (ok) {
      var gsap = window.gsap, ST = window.ScrollTrigger;
      if (!ok || dead || !gsap || !ST) return;
      gsap.registerPlugin(ST);
      if (window.__lecLenis) window.__lecLenis.on('scroll', ST.update);
      var items = Array.prototype.slice.call(el.querySelectorAll(o.items || '[data-gsap-item]'));
      if (!items.length) items = Array.prototype.slice.call(el.querySelectorAll('h2, h3, p, li, figure, blockquote')).filter(function (n) { return !n.closest('li li'); }).slice(0, 12);
      if (!items.length) return;
      mm = gsap.matchMedia();
      mm.add({ wide: '(min-width: 900px)', reduce: '(prefers-reduced-motion: reduce)' }, function (c) {
        if (c.conditions.reduce) return;
        if (c.conditions.wide && o.pin !== false) {
          var tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top top', end: '+=' + (o.distance || 110) + '%', pin: true, scrub: 0.6, anticipatePin: 1 } });
          tl.fromTo(items, { y: 46, autoAlpha: 0.12 }, { y: 0, autoAlpha: 1, stagger: 0.14, ease: 'none', duration: 1 });
          var media = el.querySelector('[data-gsap-media], img, video');
          if (media) tl.fromTo(media, { scale: 1.12 }, { scale: 1, ease: 'none', duration: items.length * 0.14 + 1 }, 0);
        } else {
          ST.batch(items, { start: 'top 88%', once: true, onEnter: function (b) { gsap.fromTo(b, { y: 22, autoAlpha: 0.15 }, { y: 0, autoAlpha: 1, stagger: 0.08, duration: 0.6, ease: 'power2.out', overwrite: true }); } });
        }
      });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!dead) ST.refresh(); });
    });
    return function () { dead = true; if (mm) mm.revert(); };
  }
});
