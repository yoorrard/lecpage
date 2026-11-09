/* paper-stack — 비스듬히 겹친 활동지 묶음 그림(줄 친 종이·여백선·펀치 구멍·포스트잇·클립). 강도 2 이상이면 스크롤에 살짝 펼쳐진다 */
LecFX.define('paper-stack', {
  level: 1,
  init: function (el, o, ctx) {
    var ly = ctx.layer(el), esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var title = esc(o.title || '활동지'), note = esc(o.note || '오늘의 질문');
    ly.innerHTML = '<div class="fx-ps"><div class="fx-paper fx-paper-3"></div><div class="fx-paper fx-paper-2"><span class="fx-paper-tab"></span></div>' +
      '<div class="fx-paper fx-paper-1"><span class="fx-paper-holes"></span><span class="fx-paper-title">' + title + '</span><span class="fx-paper-lines"></span><span class="fx-paper-box"></span><span class="fx-paper-box"></span></div>' +
      '<span class="fx-paper-note">' + note + '</span><span class="fx-paper-clip"></span></div>';
    if (o.align) ly.setAttribute('data-align', o.align);
    if (ctx.reduced || ctx.level < 2) return;
    var last = -1;
    ctx.onScroll(function (y, vh) {
      var p = ctx.util.progress(el, vh, 1, 0);
      return function () { if (Math.abs(p - last) > 0.003) { last = p; ly.style.setProperty('--fx-ps-p', p.toFixed(3)); } };
    }, { el: el });
  }
});
