/* border-beam — 카드·버튼 테두리를 따라 빛줄기가 천천히 돈다(멈춤 버튼·화면 밖에서 멈춤) */
LecFX.define('border-beam', {
  level: 2,
  loop: true,
  init: function (el, o, ctx) {
    var hosts = ctx.util.items(el, o), rings = [];
    hosts.forEach(function (h) {
      var s = document.createElement('span');
      s.className = 'fx-beam-ring'; s.setAttribute('aria-hidden', 'true');
      h.classList.add('fx-beam');
      if (o.duration) h.style.setProperty('--fx-beam-dur', o.duration + 's');
      h.appendChild(s);
      rings.push(s);
      ctx.visible(h, function (on) { h.classList.toggle('fx-off', !on); }, { once: false });
    });
    return function () { rings.forEach(function (r) { r.remove(); }); hosts.forEach(function (h) { h.classList.remove('fx-beam', 'fx-off'); h.style.removeProperty('--fx-beam-dur'); }); };
  }
});
