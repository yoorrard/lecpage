/* slide-fan — 교재 쪽을 부채처럼 펼친 3D 더미. 포인터에 기울고, '다음 장'이나 뒤 장을 누르면 그 장이 위로 올라오고, 스크롤하면 살짝 떠오른다.
   마크업이 이미 있으면(.lp-fan-list, 첫 화면 구성 '펼친 교재') 그대로 살리고, 빈 자리에 붙이면 쪽의 교재 칸(.lp-slide)에서 다섯 장을 가져와 만든다.
   JS·움직임이 꺼져 있어도 펼쳐진 정지 모습 그대로다. 되풀이 그리기(rAF 루프)가 없어 화면 밖·숨은 탭에서는 아무 일도 하지 않는다. */
LecFX.define('slide-fan', {
  level: 2,
  init: function (el, o, ctx) {
    var d = document, made = null, list = el.querySelector('.lp-fan-list');
    var esc = function (s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    if (!list) {
      var src = Array.prototype.slice.call(d.querySelectorAll(o.source || '.lp-slide')).slice(0, 5);
      if (src.length < 2) return;
      made = d.createElement('div');
      made.className = 'lp-fan';
      made.setAttribute('aria-hidden', 'true'); // 빈 자리에 붙인 꾸밈: 같은 내용이 아래 교재 칸에 있음
      made.style.setProperty('--n', src.length);
      made.innerHTML = '<ol class="lp-fan-list">' + src.map(function (s, i) {
        var img = s.querySelector('img'), h = s.querySelector('h3'), pg = s.getAttribute('data-page') || String(i + 1);
        return '<li class="lp-fan-card" style="--i:' + i + '"><span class="lp-fan-face">' + (img ? '<img src="' + esc(img.getAttribute('src')) + '" alt="">' : '<span class="lp-fan-pg">' + esc(pg.length < 2 ? '0' + pg : pg) + '</span><b>' + esc((h && h.textContent) || s.getAttribute('data-title')) + '</b>') + '</span></li>';
      }).join('') + '</ol>';
      el.appendChild(made);
      list = made.firstChild;
    }
    var fan = list.parentNode, cards = Array.prototype.slice.call(list.children), n = cards.length;
    var order = cards.map(function (c, i) { return i; }); // order[k] = 카드 k가 놓인 자리(0이 맨 위)
    var place = function () { cards.forEach(function (c, k) { c.style.setProperty('--i', order[k]); c.classList.toggle('is-top', order[k] === 0); }); };
    var bringTop = function (k) { var p = order[k]; if (!p) return; order = order.map(function (x) { return x < p ? x + 1 : x === p ? 0 : x; }); place(); };
    var next = function () { order = order.map(function (x) { return (x - 1 + n) % n; }); place(); };
    place();
    var btn = fan.querySelector('[data-fan-next]');
    if (btn) { btn.hidden = false; ctx.on(btn, 'click', next); }
    // 뒤에 있는 장을 누르면 먼저 위로 올림(맨 위 장은 링크대로 이동). 누를 때 생기는 초점 이동은 건너뜀(누름 한 번에 올리고 바로 이동해 버리지 않게)
    var down = false;
    ctx.on(list, 'pointerdown', function () { down = true; });
    ctx.on(d, 'keydown', function () { down = false; });
    ctx.on(list, 'click', function (e) {
      down = false;
      var c = e.target.closest ? e.target.closest('.lp-fan-card') : null; if (!c) return;
      var k = cards.indexOf(c); if (k < 0 || order[k] === 0) return;
      e.preventDefault(); bringTop(k);
    });
    ctx.on(list, 'focusin', function (e) { if (down) return; var c = e.target.closest ? e.target.closest('.lp-fan-card') : null; var k = cards.indexOf(c); if (k >= 0) bringTop(k); });
    fan.classList.add('fx-fan');
    var clean = function () { fan.classList.remove('fx-fan'); if (made) made.remove(); cards.forEach(function (c, i) { c.style.setProperty('--i', i); c.classList.remove('is-top'); }); ['--tx', '--ty', '--sy'].forEach(function (k) { list.style.removeProperty(k); }); };
    if (ctx.reduced) return clean;
    // 포인터 쪽으로 기울기(정밀 포인터만)
    if (ctx.fine) {
      var host = el.closest('.lp-hero') || el, q = 0, ev = null;
      ctx.on(host, 'pointermove', function (e) {
        ev = e; if (q) return;
        q = requestAnimationFrame(function () { q = 0; if (!ev || ctx.isPaused()) return; var r = host.getBoundingClientRect(); list.style.setProperty('--tx', ((ev.clientX - r.left) / r.width * 2 - 1).toFixed(3)); list.style.setProperty('--ty', ((ev.clientY - r.top) / r.height * 2 - 1).toFixed(3)); });
      });
      ctx.on(host, 'pointerleave', function () { ev = null; list.style.removeProperty('--tx'); list.style.removeProperty('--ty'); });
    }
    // 스크롤하면 더미가 살짝 떠오르며 벌어짐
    var last = -1;
    ctx.onScroll(function (y, vh) {
      var r = fan.getBoundingClientRect(), p = ctx.util.clamp(1 - (r.top + r.height * 0.5) / (vh * 0.62), 0, 1);
      return function () { if (Math.abs(p - last) < 0.004) return; last = p; list.style.setProperty('--sy', p.toFixed(3)); };
    }, { el: fan });
    return clean;
  }
});
