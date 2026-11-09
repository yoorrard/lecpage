/* typewriter — 한 번만 타자. 한글은 자모를 조합하듯(ㅎ→하→한) 친다. 끝나면 커서도 사라진다(5초 미만) */
LecFX.define('typewriter', {
  level: 2,
  init: function (el, o, ctx) {
    if (ctx.reduced) return;
    var text = el.textContent.replace(/\s+/g, ' ').trim();
    if (!text || el.children.length) return;
    var CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
    var steps = [], acc = '';
    Array.from(text).forEach(function (ch) {
      var c = ch.charCodeAt(0) - 0xAC00;
      if (o.jamo !== false && c >= 0 && c <= 11171) {
        var L = Math.floor(c / 588), V = Math.floor((c % 588) / 28), T = c % 28;
        steps.push(acc + CHO.charAt(L));
        if (T) steps.push(acc + String.fromCharCode(0xAC00 + L * 588 + V * 28));
      }
      acc += ch;
      steps.push(acc);
    });
    var orig = el.innerHTML;
    el.textContent = '';
    var sr = document.createElement('span'), box = document.createElement('span'), ghost = document.createElement('span'), out = document.createElement('span'), caret = document.createElement('span');
    sr.className = 'fx-sr'; sr.textContent = text;
    box.className = 'fx-tw'; box.setAttribute('aria-hidden', 'true');
    ghost.className = 'fx-tw-ghost'; ghost.textContent = text;
    out.className = 'fx-tw-out';
    caret.className = 'fx-tw-caret';
    box.appendChild(ghost); box.appendChild(out); out.appendChild(document.createTextNode('')); out.appendChild(caret);
    el.appendChild(sr); el.appendChild(box);
    var per = Math.max(14, Math.min(o.speed || 42, (o.max || 2200) / steps.length)), timer = 0;
    ctx.enter(box, function () {
      var i = 0;
      box.classList.add('is-typing');
      var tick = function () {
        out.firstChild.nodeValue = steps[i];
        i++;
        if (i < steps.length) timer = setTimeout(tick, per * (steps[i - 1].slice(-1) === ' ' ? 2.2 : 1));
        else timer = setTimeout(function () { box.classList.remove('is-typing'); }, 1800);
      };
      timer = setTimeout(tick, o.delay || 120);
    });
    return function () { clearTimeout(timer); el.innerHTML = orig; };
  }
});
