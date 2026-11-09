/* typewriter — 한 번만 타자. 한글은 자모를 조합하듯(ㅎ→하→한) 친다. 끝나면 커서도 사라진다(5초 미만)
   최종 배치를 먼저 잡아 두고(낱말 단위로 나눔) 글자를 차례로 드러내므로 줄바꿈이 흔들리지 않는다 */
LecFX.define('typewriter', {
  level: 2,
  init: function (el, o, ctx) {
    if (ctx.reduced) return;
    var s = ctx.util.split(el, 'chars'), chars = s.chars;
    if (!chars.length || chars.length > (o.max || 140)) { s.revert(); return; }
    var CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', steps = [];
    chars.forEach(function (c, i) {
      var ch = c.textContent, code = ch.charCodeAt(0) - 0xAC00;
      if (o.jamo !== false && code >= 0 && code <= 11171) {
        var L = Math.floor(code / 588), V = Math.floor((code % 588) / 28), T = code % 28;
        steps.push([i, CHO.charAt(L)]);
        if (T) steps.push([i, String.fromCharCode(0xAC00 + L * 588 + V * 28)]);
      }
      steps.push([i, ch]);
    });
    el.classList.add('fx-typewriter');
    var caret = document.createElement('span');
    caret.className = 'fx-tw-caret';
    var per = Math.max(14, Math.min(o.speed || 42, (o.total || 2200) / steps.length)), timer = 0, k = 0;
    ctx.enter(el, function () {
      el.classList.add('is-typing');
      var tick = function () {
        var st = steps[k], c = chars[st[0]];
        c.textContent = st[1];
        c.classList.add('is-on');
        c.parentNode.insertBefore(caret, c.nextSibling);
        k++;
        if (k < steps.length) {
          var nx = chars[steps[k][0]];
          timer = setTimeout(tick, per * (nx !== c && nx.parentNode !== c.parentNode ? 2.4 : 1));
        } else timer = setTimeout(function () { el.classList.remove('is-typing'); caret.remove(); }, 1600);
      };
      timer = setTimeout(tick, o.delay || 150);
    });
    return function () { clearTimeout(timer); caret.remove(); s.revert(); el.classList.remove('fx-typewriter', 'is-typing'); };
  }
});
