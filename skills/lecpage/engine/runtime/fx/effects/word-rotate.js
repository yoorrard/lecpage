/* word-rotate — 한 자리에서 낱말이 차례로 바뀐다. 세 바퀴 돌고 첫 낱말에서 멈춘다(멈춤 버튼에도 멈춤) */
LecFX.define('word-rotate', {
  level: 2,
  loop: true,
  init: function (el, o, ctx) {
    var first = el.textContent.trim();
    var words = (o.words && o.words.length ? o.words : first.split('|')).map(function (s) { return String(s).trim(); }).filter(Boolean);
    if (words.indexOf(first) < 0 && first.indexOf('|') < 0) words.unshift(first);
    if (words.length < 2) return;
    var orig = el.innerHTML;
    el.textContent = '';
    var sr = document.createElement('span'), box = document.createElement('span');
    sr.className = 'fx-sr'; sr.textContent = words[0];
    box.className = 'fx-rotate'; box.setAttribute('aria-hidden', 'true');
    var spans = words.map(function (wd, i) {
      var s = document.createElement('span');
      s.className = 'fx-rotate-w' + (i === 0 ? ' is-on' : '');
      s.textContent = wd;
      box.appendChild(s);
      return s;
    });
    el.appendChild(sr); el.appendChild(box);
    if (ctx.reduced) return function () { el.innerHTML = orig; };
    var i = 0, n = 0, max = (o.cycles || 3) * words.length, timer = 0, vis = false;
    var show = function (k) {
      spans.forEach(function (s, j) { s.classList.toggle('is-on', j === k); s.classList.toggle('is-out', j === i && j !== k); });
      i = k;
    };
    var next = function () {
      timer = 0;
      if (!vis || ctx.isPaused()) return;
      n++;
      if (n >= max) { show(0); return; }
      show((i + 1) % words.length);
      timer = setTimeout(next, o.interval || 2200);
    };
    var kick = function () { if (!timer && n < max) timer = setTimeout(next, o.interval || 2200); };
    ctx.visible(el, function (on) { vis = on; if (on) kick(); }, { once: false });
    ctx.onPause(function (p) { if (!p) kick(); });
    return function () { clearTimeout(timer); el.innerHTML = orig; };
  }
});
