/* guided-progress — 위쪽 진행 막대 + 넓은 화면 오른쪽 단계 점(현재 단계는 aria-current="step"). 기능형이라 모션 0에서도 동작.
   좁은 화면에는 점을 두지 않음: 메뉴의 '목차'와 진행 막대가 같은 일을 함(떠 있는 'n / 15' 칩은 도크·본문을 가려서 뺌) */
LecFX.define('guided-progress', {
  level: 0,
  init: function (el, o, ctx) {
    var secs = Array.prototype.slice.call(document.querySelectorAll(o.steps || '[data-nav]')).filter(function (s) { return s.id; });
    if (!secs.length) secs = Array.prototype.slice.call(document.querySelectorAll('main section[id]'));
    el.classList.add('fx-gp');
    if (o.top) el.style.setProperty('--fx-gp-top', o.top);
    var bar = document.createElement('div'), fill = document.createElement('span');
    bar.className = 'fx-gp-bar'; bar.setAttribute('aria-hidden', 'true');
    fill.className = 'fx-gp-fill';
    bar.appendChild(fill);
    el.appendChild(bar);
    var links = [], nav = null;
    if (secs.length > 1 && o.steps !== false && !el.closest('[aria-hidden="true"]')) {
      nav = document.createElement('nav');
      nav.className = 'fx-gp-steps';
      nav.setAttribute('aria-label', o.label || '연수 진행 단계');
      var ol = document.createElement('ol');
      secs.forEach(function (s, i) {
        var h = s.querySelector('h1,h2,h3');
        var name = s.getAttribute('data-nav') || (h ? h.textContent.trim() : '') || String(i + 1);
        var li = document.createElement('li'), a = document.createElement('a'), dot = document.createElement('span'), lab = document.createElement('span');
        a.href = '#' + s.id;
        dot.className = 'fx-gp-dot'; dot.setAttribute('aria-hidden', 'true');
        lab.className = 'fx-gp-label'; lab.textContent = name;
        a.appendChild(dot); a.appendChild(lab); li.appendChild(a); ol.appendChild(li);
        links.push({ a: a, name: name });
      });
      nav.appendChild(ol);
      // 단계 목록은 body에 붙임: 막대를 둔 자리(머리의 backdrop-filter, 진행 막대의 transform) 안에서는
      // position:fixed가 그 자리를 기준으로 그려져 0 너비로 눌리고, 보이지 않는 링크에 Tab 초점만 감
      document.body.appendChild(nav);
    }
    var cur = -1, lastP = -1;
    ctx.onScroll(function (y, vh) {
      var max = document.documentElement.scrollHeight - vh;
      var p = max > 0 ? ctx.util.clamp(y / max, 0, 1) : 0;
      var idx = 0;
      for (var i = 0; i < secs.length; i++) if (secs[i].getBoundingClientRect().top < vh * 0.4) idx = i;
      if (p >= 0.995) idx = secs.length - 1;
      return function () {
        if (Math.abs(p - lastP) > 0.0005) { lastP = p; fill.style.transform = 'scaleX(' + p.toFixed(4) + ')'; }
        if (idx === cur || !links.length) return;
        cur = idx;
        links.forEach(function (l, j) {
          if (j === idx) l.a.setAttribute('aria-current', 'step'); else l.a.removeAttribute('aria-current');
          l.a.classList.toggle('is-done', j < idx);
        });
      };
    });
    return function () { bar.remove(); if (nav) nav.remove(); el.classList.remove('fx-gp'); };
  }
});
