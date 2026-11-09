/* micro-copy — 복사 버튼: 누르면 "복사됨"과 체크로 바뀌고 낭독기에 알린다
   [data-copy="글"] 또는 [data-copy-target="#id"]. 다른 런타임이 직접 복사했다면 LecFX.copied(버튼)만 불러도 된다 */
LecFX.define('micro-copy', {
  level: 0,
  init: function (el, o, ctx) {
    var live = document.getElementById('fx-live');
    if (!live) {
      live = document.createElement('div');
      live.id = 'fx-live'; live.className = 'fx-sr';
      live.setAttribute('aria-live', 'polite');
      document.body.appendChild(live);
    }
    var say = function (t) { live.textContent = ''; setTimeout(function () { live.textContent = t; }, 30); };
    var morph = function (b, ok) {
      if (!b || !b.classList) return;
      var lab = b.querySelector('[data-copy-label]');
      if (!lab) {
        lab = document.createElement('span');
        lab.setAttribute('data-copy-label', '');
        while (b.firstChild) lab.appendChild(b.firstChild);
        b.appendChild(lab);
      }
      if (!b.__fxCopyText) b.__fxCopyText = lab.innerHTML;
      b.classList.add('fx-copy');
      b.style.minWidth = b.getBoundingClientRect().width + 'px';
      clearTimeout(b.__fxCopyT);
      b.setAttribute('data-state', ok ? 'copied' : 'failed');
      lab.textContent = ok ? (o.done || '복사됨') : (o.fail || '복사 안 됨');
      say(ok ? (o.say || '복사했어요') : '복사하지 못했어요. 글을 길게 눌러 직접 복사해 주세요');
      b.__fxCopyT = setTimeout(function () { b.removeAttribute('data-state'); lab.innerHTML = b.__fxCopyText; b.style.minWidth = ''; }, 1800);
    };
    var copy = function (text) {
      if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacy(text); });
      return Promise.resolve(legacy(text));
    };
    var legacy = function (text) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      return ok;
    };
    ctx.on(el, 'click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-copy],[data-copy-target]') : null;
      if (!b || !el.contains(b)) return;
      var text = b.getAttribute('data-copy');
      if (text == null) {
        var t = document.querySelector(b.getAttribute('data-copy-target'));
        text = t ? (t.value != null && t.tagName !== 'LI' ? t.value : t.innerText) : '';
      }
      if (!text) return;
      copy(text).then(function (ok) { morph(b, ok); });
    });
    ctx.on(document, 'lecfx:copied', function (e) { var b = e.detail && e.detail.el; if (b && el.contains(b)) morph(b, true); });
  }
});
