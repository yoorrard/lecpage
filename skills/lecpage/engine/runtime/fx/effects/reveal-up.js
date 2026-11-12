/* reveal-up — 조용한 기본값. 화면에 들어오면 살짝 떠오르며 나타난다. 목록·격자는 짧게 차례로(총 지연 상한)
   opts.mode로 방식을 바꿈(페이지 연출 계획): fade 번짐 · side 옆에서 · wipe 왼쪽부터 펼침 · clip 위에서 펼침 · scale 살짝 커짐 · drop 위에서 내려앉음 · flip 종이처럼 넘어옴. 한 번 나타난 뒤에는 멈춤 */
LecFX.define('reveal-up', {
  level: 1,
  init: function (el, o, ctx) {
    if (ctx.reduced) return;
    var items = ctx.util.items(el, o), group = items.length > 1 || items[0] !== el;
    var step = o.stagger || 70, max = o.max || 420;
    var mode = /^(fade|side|wipe|clip|scale|drop|flip)$/.test(o.mode) ? 'fx-rv-' + o.mode : '';
    el.classList.add('fx-reveal');
    if (mode) el.classList.add(mode);
    if (group) {
      el.classList.add('fx-reveal--group');
      items.forEach(function (it, i) { it.classList.add('fx-reveal-item'); it.style.setProperty('--fx-d', Math.min(i * step, max) + 'ms'); });
    }
    var tidy = function () {
      el.classList.remove('fx-reveal', 'fx-reveal--group');
      if (mode) el.classList.remove(mode);
      items.forEach(function (it) { it.classList.remove('fx-reveal-item'); it.style.removeProperty('--fx-d'); });
    };
    var t = 0;
    ctx.enter(el, function () { t = setTimeout(tidy, max + 1400); });
    return function () { clearTimeout(t); tidy(); };
  }
});
