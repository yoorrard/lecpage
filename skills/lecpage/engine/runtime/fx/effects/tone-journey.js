/* tone-journey — 섹션의 data-tone(night·dawn·day)을 따라 바탕·글자색이 밤→새벽→낮→밤으로 이어진다
   색은 계약 토큰(바탕·글자·주 색·강조 색)에서 계산하고 글자 대비 4.5:1 이상을 맞춘다 */
LecFX.define('tone-journey', {
  level: 2,
  init: function (el, o, ctx) {
    var U = ctx.util, secs = Array.prototype.slice.call(el.querySelectorAll('[data-tone]'));
    if (!secs.length) return;
    if (el === document.documentElement) el = document.body; /* html에 쓰면 기준 토큰을 덮어쓴다 */
    var pal = {};
    var build = function () {
      var bg = ctx.rgb('background', document.documentElement), fg = ctx.rgb('foreground', document.documentElement);
      var pr = ctx.rgb('primary', document.documentElement), ac = ctx.rgb('accent', document.documentElement);
      var darkTheme = U.lum(bg) < U.lum(fg), dark = darkTheme ? bg : fg, light = darkTheme ? fg : bg;
      var fix = function (b, f) { var k = 0; while (U.contrast(b, f) < 4.6 && k++ < 12) b = U.mix(b, U.lum(f) > 0.5 ? dark : light, 0.15); return b; };
      var night = fix(U.mix(dark, pr, 0.12), light);
      var dawn = fix(U.mix(U.mix(dark, pr, 0.42), ac, 0.3), light);
      var day = darkTheme ? fix(U.mix(dark, light, 0.08), light) : light;
      var dayFg = darkTheme ? light : dark;
      var custom = o.tones || {};
      var mk = function (b, f, name) {
        if (custom[name] && custom[name].bg) { b = U.parse(custom[name].bg); f = U.parse(custom[name].fg || U.rgba(f)); }
        return { bg: b, fg: f };
      };
      pal = { night: mk(night, light, 'night'), dawn: mk(dawn, light, 'dawn'), day: mk(day, dayFg, 'day') };
    };
    var vars = function (t) {
      var b = t.bg, f = t.fg;
      return {
        '--background': U.rgba(b, 1), '--foreground': U.rgba(f, 1), '--card-foreground': U.rgba(f, 1),
        '--muted-foreground': U.rgba(U.mix(f, b, 0.28), 1), '--border': U.rgba(U.mix(b, f, 0.16), 1),
        '--card': U.rgba(U.mix(b, f, 0.05), 1), '--muted': U.rgba(U.mix(b, f, 0.08), 1), '--surface-2': U.rgba(U.mix(b, f, 0.07), 1)
      };
    };
    var apply = function (node, v) { for (var k in v) node.style.setProperty(k, v[k]); };
    var clear = function (node) { ['--background', '--foreground', '--card-foreground', '--muted-foreground', '--border', '--card', '--muted', '--surface-2'].forEach(function (k) { node.style.removeProperty(k); }); };
    var toneOf = function (s) { var t = s.getAttribute('data-tone'); return pal[t] || pal.day; };
    build();
    el.classList.add('fx-tone-journey');
    if (ctx.reduced) {
      el.classList.add('fx-tone-static');
      var paint = function () { build(); secs.forEach(function (s) { apply(s, vars(toneOf(s))); }); };
      paint();
      ctx.onTheme(paint);
      return function () { secs.forEach(clear); el.classList.remove('fx-tone-journey', 'fx-tone-static'); };
    }
    var lastKey = '', settled = null, tmr = 0;
    ctx.onTheme(function () { build(); lastKey = ''; window.dispatchEvent(new Event('scroll')); });
    ctx.onScroll(function (y, vh) {
      var mid = vh * 0.5, i = 0, rects = secs.map(function (s) { return s.getBoundingClientRect(); });
      for (var k = 0; k < rects.length; k++) if (rects[k].top <= mid) i = k;
      var a = toneOf(secs[i]), b = secs[i + 1] ? toneOf(secs[i + 1]) : a;
      var zone = vh * 0.45, t = secs[i + 1] ? U.clamp((mid - (rects[i + 1].top - zone)) / zone, 0, 1) : 0;
      if (rects[0].top > mid) { a = b = toneOf(secs[0]); t = 0; }
      t = t * t * (3 - 2 * t);
      var cur = { bg: U.mix(a.bg, b.bg, t), fg: t < 0.5 ? a.fg : b.fg };
      if (a.fg !== b.fg) {
        var f2 = U.mix(a.fg, b.fg, t);
        if (U.contrast(cur.bg, f2) >= 4.5) cur.fg = f2;
      }
      var key = cur.bg.join() + '|' + cur.fg.join();
      var name = secs[t < 0.5 ? i : Math.min(i + 1, secs.length - 1)].getAttribute('data-tone');
      return function () {
        if (key === lastKey) return;
        lastKey = key;
        apply(el, vars(cur));
        el.setAttribute('data-tone-now', name);
        if (name !== settled) { settled = name; clearTimeout(tmr); tmr = setTimeout(function () { window.dispatchEvent(new CustomEvent('lecfx:tone', { detail: { tone: name } })); }, 180); }
      };
    });
    return function () { clearTimeout(tmr); clear(el); el.removeAttribute('data-tone-now'); el.classList.remove('fx-tone-journey'); };
  }
});
