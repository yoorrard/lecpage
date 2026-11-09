/* sticky-scrolly — 한쪽 그림은 고정되고, 옆 단계 글을 읽어 내려가면 그림이 단계에 맞게 바뀐다
   마크업: [data-step] 단계들 + (선택) [data-step-visual] 그림들. 그림이 없으면 큰 번호·제목·진행 고리를 만든다 */
LecFX.define('sticky-scrolly', {
  level: 2,
  init: function (el, o, ctx) {
    var steps = Array.prototype.slice.call(el.querySelectorAll(o.steps || '[data-step]'));
    if (steps.length < 2) return;
    var vbox = el.querySelector('[data-scrolly-visual]'), visuals = vbox ? Array.prototype.slice.call(vbox.querySelectorAll('[data-step-visual]')) : [];
    var made = !vbox, num, title, ring, n = steps.length;
    if (made) {
      vbox = document.createElement('div');
      vbox.setAttribute('data-scrolly-visual', '');
      vbox.setAttribute('aria-hidden', 'true');
      vbox.innerHTML = '<div class="fx-scrolly-auto"><svg viewBox="0 0 120 120" class="fx-scrolly-ring"><circle cx="60" cy="60" r="54"/><circle cx="60" cy="60" r="54" class="fx-scrolly-ring-on" pathLength="1"/></svg><span class="fx-scrolly-num"></span><span class="fx-scrolly-of"></span><span class="fx-scrolly-title"></span></div>';
      el.insertBefore(vbox, el.firstChild);
      num = vbox.querySelector('.fx-scrolly-num'); title = vbox.querySelector('.fx-scrolly-title'); ring = vbox.querySelector('.fx-scrolly-ring-on');
      vbox.querySelector('.fx-scrolly-of').textContent = '/ ' + String(n).padStart(2, '0');
    }
    el.classList.add('fx-scrolly');
    if (ctx.reduced) el.classList.add('fx-scrolly--still');
    steps.forEach(function (s) { s.classList.add('fx-scrolly-step'); });
    var cur = -1;
    var set = function (i) {
      if (i === cur) return;
      cur = i;
      el.setAttribute('data-active-step', i + 1);
      steps.forEach(function (s, j) { s.classList.toggle('is-active', j === i); });
      visuals.forEach(function (v, j) { v.classList.toggle('is-active', j === Math.min(i, visuals.length - 1)); });
      if (made) {
        num.textContent = String(i + 1).padStart(2, '0');
        var h = steps[i].querySelector('h3,h4,strong,b');
        title.textContent = h ? h.textContent.trim() : '';
        ring.style.strokeDashoffset = String(1 - (i + 1) / n);
      }
    };
    set(0);
    ctx.onScroll(function (y, vh) {
      var idx = 0;
      for (var i = 0; i < steps.length; i++) if (steps[i].getBoundingClientRect().top < vh * 0.58) idx = i;
      return function () { set(idx); };
    }, { el: el });
    return function () {
      if (made) vbox.remove();
      el.classList.remove('fx-scrolly', 'fx-scrolly--still');
      el.removeAttribute('data-active-step');
      steps.forEach(function (s) { s.classList.remove('fx-scrolly-step', 'is-active'); });
      visuals.forEach(function (v) { v.classList.remove('is-active'); });
    };
  }
});
