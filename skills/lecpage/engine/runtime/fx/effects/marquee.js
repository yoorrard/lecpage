/* marquee — 자식 항목을 끊김 없이 흘린다. 마우스·포커스·멈춤 버튼·화면 밖에서 멈춘다. 동작 줄이기면 줄바꿈 목록 */
LecFX.define('marquee', {
  level: 2,
  loop: true,
  init: function (el, o, ctx) {
    var items = Array.prototype.slice.call(el.children);
    if (!items.length) return;
    el.classList.add('fx-marquee');
    if (ctx.reduced) { el.classList.add('fx-marquee--still'); return function () { el.classList.remove('fx-marquee', 'fx-marquee--still'); }; }
    var track = document.createElement('div'), group = document.createElement('div');
    track.className = 'fx-marquee-track';
    group.className = 'fx-marquee-group';
    items.forEach(function (it) { group.appendChild(it); });
    track.appendChild(group);
    el.appendChild(track);
    if (o.reverse) el.classList.add('fx-marquee--rev');
    var speed = o.speed || 48, clones = [];
    var hide = function (node) {
      node.setAttribute('aria-hidden', 'true');
      Array.prototype.forEach.call(node.querySelectorAll('a,button,input,select,textarea,[tabindex]'), function (f) { f.setAttribute('tabindex', '-1'); });
    };
    var build = function () {
      clones.forEach(function (c) { c.parentNode && c.parentNode.removeChild(c); });
      clones = [];
      var gw = group.scrollWidth, ew = el.clientWidth || 1, k = 0;
      while (gw && group.scrollWidth < ew && k++ < 12) items.forEach(function (it) { var c = it.cloneNode(true); hide(c); group.appendChild(c); clones.push(c); });
      var copy = group.cloneNode(true);
      hide(copy);
      track.appendChild(copy);
      clones.push(copy);
      el.style.setProperty('--fx-mq-dur', Math.max(8, group.scrollWidth / speed).toFixed(2) + 's');
    };
    build();
    var ro, lastW = el.clientWidth;
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(function () { if (Math.abs(el.clientWidth - lastW) > 40) { lastW = el.clientWidth; group.querySelectorAll('[aria-hidden]').forEach(function (n) { n.remove(); }); build(); } });
      ro.observe(el);
    }
    ctx.visible(el, function (on) { el.classList.toggle('fx-off', !on); }, { once: false });
    return function () {
      if (ro) ro.disconnect();
      clones.forEach(function (c) { c.parentNode && c.parentNode.removeChild(c); });
      items.forEach(function (it) { el.appendChild(it); });
      track.remove();
      el.classList.remove('fx-marquee', 'fx-marquee--rev', 'fx-off');
    };
  }
});
