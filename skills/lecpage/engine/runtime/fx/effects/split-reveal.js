/* split-reveal — 줄·낱말·글자를 마스크 안에서 밀어 올린다. 원문은 화면 낭독기용으로 따로 남긴다 */
LecFX.define('split-reveal', {
  level: 2,
  init: function (el, o, ctx) {
    if (ctx.reduced) return;
    var by = o.by === 'chars' || o.by === 'words' ? o.by : 'lines';
    var s = ctx.util.split(el, by === 'chars' ? 'chars' : 'words');
    if (!s.words.length) { s.revert(); return; }
    if (by !== 'chars') s.words.forEach(function (w) {
      var i = document.createElement('span');
      i.className = 'fx-wi';
      while (w.firstChild) i.appendChild(w.firstChild);
      w.appendChild(i);
    });
    var step = o.stagger || (by === 'lines' ? 110 : by === 'chars' ? 22 : 48);
    el.classList.add('fx-split-reveal');
    el.style.setProperty('--fx-stagger', step + 'ms');
    if (o.delay) el.style.setProperty('--fx-delay', o.delay + 'ms');
    var index = function () {
      if (by === 'lines') s.lines().forEach(function (line, i) { line.forEach(function (w) { w.style.setProperty('--fx-i', i); }); });
      else (by === 'chars' ? s.chars : s.words).forEach(function (u, i) { u.style.setProperty('--fx-i', Math.min(i, 60)); });
    };
    index();
    ctx.enter(el, index);
    return function () { s.revert(); el.classList.remove('fx-split-reveal'); el.style.removeProperty('--fx-stagger'); el.style.removeProperty('--fx-delay'); };
  }
});
