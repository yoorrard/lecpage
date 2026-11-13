/* guided-progress — 위쪽 진행 막대 + 단계 표시(현재 단계는 aria-current="step"). 기능형이라 모션 0에서도 동작 */
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
    var links = [], chip = null, nav = null;
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
      chip = document.createElement('span');
      chip.className = 'fx-gp-chip';
      chip.setAttribute('aria-hidden', 'true');
      // 단계 목록·칩은 body에 붙임: 막대를 둔 자리(머리의 backdrop-filter, 진행 막대의 transform) 안에서는
      // position:fixed가 그 자리를 기준으로 그려져 0 너비로 눌리고, 보이지 않는 링크에 Tab 초점만 감
      document.body.appendChild(nav);
      document.body.appendChild(chip);
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
        chip.textContent = (idx + 1) + ' / ' + links.length + '  ' + links[idx].name;
      };
    });
    var idle = 0;
    if (chip) ctx.on(window, 'scroll', function () { chip.classList.add('is-show'); clearTimeout(idle); idle = setTimeout(function () { chip.classList.remove('is-show'); }, 1600); }, { passive: true });
    ctx.cleanup(function () { clearTimeout(idle); });
    return function () { bar.remove(); if (nav) nav.remove(); if (chip) chip.remove(); el.classList.remove('fx-gp'); };
  }
});
