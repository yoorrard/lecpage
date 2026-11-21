/* 학교 데이터로 수업 바꾸기 — 그림·움직임·실습 도구. 강의 기능(출석·투표·질문·교재 넘기기…)은 lecpage 키트가 붙여요.
   데이터는 모두 교재에 실린 연수용 가상 예시예요. 설명은 교재 쪽 그림과 강사에게 맡기고, 여기엔 당일 쓰는 도구만. 움직임을 줄인 사람에게는 처음부터 다 그려진 모습을 보여 줘요. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  root.classList.remove('no-js'); root.classList.add('js');
  var mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var still = function () { return mq.matches; };
  var NS = 'http://www.w3.org/2000/svg';

  /* ── 교재의 가상 데이터(6·7·10쪽) ── */
  var SCORES = [84, 56, 79, 88, 42, 74, 90, 81, 58, 85, 72, 94, 50, 83, 68, 87, 45, 80, 92, 64, 55, 86, 78, 38, 89, 76, 52, 84, 82, 48];
  var RATE3 = [78, 76, 81, 74, 70, 63, 41, 55, 59, 66, 71, 73];
  var RATEALL = [77, 75, 79, 76, 73, 68, 62, 64, 67, 70, 72, 74];
  var HW = [
    { k: '1반', v: [95, 94, 96, 93, 92, 94, 90, 91, 93, 94, 95, 96] },
    { k: '2반', v: [90, 88, 91, 87, 85, 86, 83, 84, 86, 88, 89, 91] },
    { k: '3반', v: [97, 93, 94, 90, 88, 85, 70, 73, 80, 86, 89, 91] },
    { k: '4반', v: [85, 83, 86, 82, 80, 81, 78, 79, 80, 82, 83, 85] }
  ];
  var MEAN = 72, MEDIAN = 78.5;

  /* ── 도우미 ── */
  function $(s, c) { return (c || d).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); }
  function S(tag, a, parent) { var e = d.createElementNS(NS, tag); for (var k in a) if (a[k] != null) e.setAttribute(k, a[k]); if (parent) parent.appendChild(e); return e; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function avg(a) { return a.reduce(function (s, v) { return s + v; }, 0) / a.length; }
  function r1(v) { return Math.round(v * 10) / 10; }
  function fmt(v) { return Math.round(v).toLocaleString('ko-KR'); }
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var easeInOut = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  function tr(el, x, y) { el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; }

  // 시간 재기: 웹 애니메이션 하나를 시계로 씀(끝으로 보내면 끝 모습으로 바로 그려짐)
  var clockEl = d.createElement('span');
  clockEl.setAttribute('aria-hidden', 'true');
  clockEl.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
  d.body.appendChild(clockEl);
  function tween(ms, step, done) {
    if (still() || !clockEl.animate) { step(1); if (done) done(); return null; }
    var a = clockEl.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(1px)' }], { duration: ms }), raf = 0, over = false;
    function end() { if (over) return; over = true; cancelAnimationFrame(raf); step(1); if (done) done(); }
    function tick() { if (over) return; var t = a.currentTime == null ? 1 : Math.min(1, a.currentTime / ms); step(t); if (t >= 1) end(); else raf = requestAnimationFrame(tick); }
    a.onfinish = end; a.oncancel = end; raf = requestAnimationFrame(tick);
    return a;
  }
  function onSeen(el, fn, margin) {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); fn(); } }); }, { rootMargin: margin || '0px 0px -12% 0px' });
    io.observe(el);
  }
  function onResize(el, fn) {
    var w = el.clientWidth, h = el.clientHeight, raf = 0;
    if (!('ResizeObserver' in window)) { addEventListener('resize', function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(fn); }); return; }
    new ResizeObserver(function () { if (Math.abs(el.clientWidth - w) < 1 && Math.abs(el.clientHeight - h) < 1) return; w = el.clientWidth; h = el.clientHeight; cancelAnimationFrame(raf); raf = requestAnimationFrame(fn); }).observe(el);
  }
  // 한 줄에 놓은 점들이 겹치지 않게 쌓기(벌떼 그림)
  function swarmY(xs, r) {
    var placed = [], out = [];
    xs.forEach(function (x, i) { var k = 0; while (placed.some(function (p) { return p.k === k && Math.abs(p.x - x) < r * 2 + 1; })) k++; placed.push({ x: x, k: k }); out[i] = k; });
    return out;
  }

  /* ── 첫 화면: 기록 1,440칸 ── */
  function hero() {
    var cv = $('.cells'); if (!cv || !cv.getContext) return;
    var probe = $('.probe'), base = probe ? probe.textContent : '', num = $('.field-n b');
    var COLS = 48, ROWS = 30, KINDS = ['출결', '과제', '형성평가', '수업 중 질문'];
    var ctx = cv.getContext('2d'), W = 0, H = 0, dpr = 1, prog = 1, heat = 1, hov = null;
    function size() { W = cv.clientWidth; if (!W) return; H = W * ROWS / COLS; dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); draw(); }
    function draw() {
      if (!W) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      var cw = W / COLS, ch = H / ROWS, s = Math.max(1, Math.min(cw, ch) * .72), n = Math.round(prog * 1440), head = Math.floor(n / ROWS);
      for (var i = 0; i < n; i++) {
        var c = Math.floor(i / ROWS), r = i % ROWS, wk = c >> 2, a = .62;
        if (prog < 1 && c >= head - 1) a = 1;
        if (hov) a = (hov.c === c || hov.r === r) ? 1 : .26;
        if (wk === 6 && heat > 0) ctx.fillStyle = 'rgba(' + Math.round(242) + ',' + Math.round(241 - 173 * heat) + ',' + Math.round(236 - 210 * heat) + ',' + (a + (1 - a) * heat * (hov ? .3 : 1)).toFixed(2) + ')';
        else ctx.fillStyle = 'rgba(242,241,236,' + a + ')';
        if (hov && hov.c === c && hov.r === r) ctx.fillStyle = '#ffffff';
        ctx.fillRect(c * cw, r * ch, s, s);
      }
    }
    size(); onResize(cv, size);
    if (!still()) {
      prog = 0; heat = 0; if (num) num.textContent = '0'; draw();
      setTimeout(function () {
        tween(1700, function (t) { prog = easeInOut(t); if (num) num.textContent = fmt(1440 * prog); draw(); }, function () {
          if (num) num.textContent = '1,440';
          tween(700, function (t) { heat = easeOut(t); draw(); });
        });
      }, 250);
    }
    function at(e) {
      var b = cv.getBoundingClientRect(), c = Math.floor((e.clientX - b.left) / (b.width / COLS)), r = Math.floor((e.clientY - b.top) / (b.height / ROWS));
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return null; return { c: c, r: r };
    }
    function show(e) {
      var h = at(e); hov = h; draw();
      if (probe) probe.textContent = h ? (h.r + 1) + '번 학생 · ' + ((h.c >> 2) + 1) + '주차 · ' + KINDS[h.c % 4] + ' 기록' : base;
    }
    cv.addEventListener('pointermove', show);
    cv.addEventListener('pointerdown', show);
    cv.addEventListener('pointerleave', function () { hov = null; draw(); if (probe) probe.textContent = base; });
  }

  /* ── 첫 화면: 3반의 12주 선(실제 크기로 다시 그려 선 긋기가 끝까지 닿게) ── */
  function pulse() {
    var box = $('.pulse-box'), svg = box && $('svg', box); if (!svg) return;
    var dot = $('.pulse-dot', box), tag = $('.pulse-tag', box);
    function build() {
      var W = svg.clientWidth, H = svg.clientHeight; if (!W || !H) return;
      var p = Math.min(14, W * .02), x = function (i) { return p + i * (W - p * 2) / 11; }, y = function (v) { return H - 8 - (v - 30) / 60 * (H - 16); };
      var path = function (a) { return a.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' '); };
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet'); svg.classList.add('px');
      $$('line', svg).forEach(function (l, i) { var v = [80, 60, 40][i]; l.setAttribute('x2', W); l.setAttribute('y1', y(v)); l.setAttribute('y2', y(v)); });
      var bw = (W - p * 2) / 11, band = $('.pulse-band', svg); band.setAttribute('x', x(6) - bw / 2); band.setAttribute('width', bw); band.setAttribute('height', H);
      $('.pulse-all', svg).setAttribute('d', path(RATEALL)); $('.pulse-line', svg).setAttribute('d', path(RATE3));
      [dot, tag].forEach(function (el) { if (el) { el.style.left = x(6) + 'px'; el.style.top = y(41) + 'px'; } });
    }
    build(); onResize(svg, build);
  }

  /* ── 숫자 세기 ── */
  function counters() {
    $$('.num[data-count]').forEach(function (el) {
      if (el.closest('.field')) return; // 첫 화면 숫자는 칸 그림과 함께
      var to = +el.dataset.count, txt = el.textContent;
      if (still()) return;
      var b = el.getBoundingClientRect(); if (b.top < innerHeight) return; // 이미 보이는 곳은 그대로
      el.textContent = '0';
      onSeen(el, function () { tween(1100, function (t) { el.textContent = fmt(to * easeOut(t)); }, function () { el.textContent = txt; }); });
    });
  }

  /* ── 오늘의 흐름: 막대가 시간 길이만큼 자람 ── */
  function gantt() { var g = $('.gantt'); if (g) onSeen(g, function () { g.classList.add('in'); }, '0px 0px -8% 0px'); }

  /* ── 실습 1: 기준 점수 실험 ── */
  function threshold() {
    var box = $('.thr'), stage = box && $('[data-thr-chart]', box); if (!stage) return;
    var input = $('[data-thr]', box), nEl = $('[data-thr-n]', box), vEl = $('[data-thr-v]', box), sayEl = $('[data-thr-say]', box), segs = $$('.seg button', box);
    var cut = +input.value, ref = 'mean', g = null, shownN = SCORES.filter(function (v) { return v < cut; }).length, anim = null;
    function build() {
      var W = stage.clientWidth, H = stage.clientHeight; if (!W || !H) return;
      stage.textContent = '';
      var svg = S('svg', { viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true' }, stage);
      var L = 6, R = W - 6, T = 18, B = H - 22, r = clamp((R - L) / 66, 4, 9);
      var x = function (v) { return L + (v - 30) / 70 * (R - L); };
      var zone = S('rect', { 'class': 'th-zone', x: L, y: T - 4, height: B - T + 4, width: 0 }, svg);
      var ax = S('g', { 'class': 'th-ax' }, svg);
      S('line', { x1: L, x2: R, y1: B, y2: B }, ax);
      for (var v = 30; v <= 100; v += 10) { var t = S('text', { x: x(v), y: B + 17, 'text-anchor': v === 30 ? 'start' : v === 100 ? 'end' : 'middle' }, ax); t.textContent = v; }
      var refL = S('line', { 'class': 'th-ref', x1: 0, x2: 0, y1: T - 4, y2: B }, svg), refT = S('text', { 'class': 'th-reft', y: T - 8 }, svg);
      var cutL = S('line', { 'class': 'th-cut', x1: 0, x2: 0, y1: T - 4, y2: B }, svg);
      var order = SCORES.slice().sort(function (a, b) { return a - b; }), ks = swarmY(order.map(x), r);
      var dots = order.map(function (v, j) { return { v: v, el: S('circle', { 'class': 'th-dot', cx: x(v), cy: B - r - 2 - ks[j] * (r * 2 + 1), r: r }, svg) }; });
      g = { x: x, L: L, R: R, zone: zone, refL: refL, refT: refT, cutL: cutL, dots: dots };
      update(true);
    }
    function update(now) {
      cut = +input.value;
      var n = SCORES.filter(function (v) { return v < cut; }).length;
      vEl.textContent = cut; sayEl.textContent = cut + '점 미만';
      input.style.setProperty('--p', ((cut - 40) / 50 * 100) + '%');
      input.setAttribute('aria-valuetext', cut + '점, 그보다 낮은 학생 ' + n + '명');
      if (g) {
        g.zone.setAttribute('width', Math.max(0, g.x(cut) - g.L));
        g.cutL.setAttribute('x1', g.x(cut)); g.cutL.setAttribute('x2', g.x(cut));
        g.dots.forEach(function (o) { o.el.classList.toggle('lo', o.v < cut); });
        var rv = ref === 'mean' ? MEAN : MEDIAN, rx = g.x(rv);
        g.refL.setAttribute('x1', rx); g.refL.setAttribute('x2', rx);
        g.refT.textContent = (ref === 'mean' ? '평균 ' : '중앙값 ') + rv; g.refT.setAttribute('x', rx + 6); g.refT.setAttribute('text-anchor', rx > g.R - 90 ? 'end' : 'start'); if (rx > g.R - 90) g.refT.setAttribute('x', rx - 6);
      }
      if (n === shownN || now) { shownN = n; nEl.textContent = n; return; }
      var from = shownN; shownN = n; if (anim) anim.cancel && anim.cancel();
      anim = tween(320, function (t) { nEl.textContent = Math.round(from + (n - from) * easeOut(t)); });
    }
    input.addEventListener('input', function () { update(false); });
    segs.forEach(function (b) { b.addEventListener('click', function () { ref = b.dataset.line; segs.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); }); update(true); }); });
    build(); onResize(stage, build);
  }

  /* ── 2부: 질문이 모양을 정해요(같은 데이터, 세 가지 차트) ── */
  function morph() {
    var stage = $('[data-morph]'); if (!stage) return;
    var radios = $$('.qs input'), sayEl = $('[data-morph-say]'), form = 'line', g = null;
    var SAY = {
      bar: '막대로 보면 3반은 평범해요. 12주 평균 86.3%로 네 반 가운데 셋째예요.',
      line: '선으로 보면 7주차가 보여요. 3반만 70%로 떨어져요.',
      dot: '점으로 보면 3반이 가장 넓게 퍼져 있어요(70~97%).'
    };
    var MEANS = HW.map(function (c) { return avg(c.v); });
    function build() {
      var W = stage.clientWidth, H = stage.clientHeight; if (!W || !H) return;
      stage.textContent = '';
      var svg = S('svg', { viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true' }, stage);
      var L = 40, R = W - (W < 500 ? 36 : 46), T = 22, B = H - 28, band = (R - L) / 4, r = clamp(band / 26, 3.2, 5.5);
      var xL = function (i) { return L + 6 + i * (R - L - 12) / 11; }, yL = function (v) { return B - (v - 65) / 35 * (B - T); };
      var bx = function (j) { return L + band * j + band / 2; }, yB = function (v) { return B - v / 100 * (B - T); };
      // 축(꺾은선·점: 65~100%, 막대: 0~100%)
      var axL = S('g', { 'class': 'mo-ax ax-l' }, svg), axB = S('g', { 'class': 'mo-ax ax-b' }, svg), axW = S('g', { 'class': 'mo-ax ax-w' }, svg), axC = S('g', { 'class': 'mo-ax ax-c' }, svg);
      [70, 80, 90, 100].forEach(function (v) { S('line', { x1: L, x2: R, y1: yL(v), y2: yL(v) }, axL); var t = S('text', { x: L - 8, y: yL(v) + 4, 'text-anchor': 'end' }, axL); t.textContent = v + '%'; });
      [25, 50, 75, 100].forEach(function (v) { S('line', { x1: L, x2: R, y1: yB(v), y2: yB(v) }, axB); var t = S('text', { x: L - 8, y: yB(v) + 4, 'text-anchor': 'end' }, axB); t.textContent = v + '%'; });
      var t0 = S('text', { x: L - 8, y: B + 4, 'text-anchor': 'end' }, axB); t0.textContent = '0';
      S('line', { 'class': 'mo-base', x1: L, x2: R, y1: B, y2: B }, svg);
      for (var i = 0; i < 12; i++) { var tw = S('text', { x: xL(i), y: B + 20, 'text-anchor': 'middle' }, axW); tw.textContent = i === 11 ? '12주' : (W < 500 && i % 2 ? '' : i + 1); }
      HW.forEach(function (c, j) { var tc = S('text', { x: bx(j), y: B + 20, 'text-anchor': 'middle' }, axC); tc.textContent = c.k; });
      // 막대
      var bars = HW.map(function (c, j) {
        var bw = Math.min(band * .56, 96), m = MEANS[j];
        var rect = S('rect', { 'class': 'mo-bar', x: bx(j) - bw / 2, y: yB(m), width: bw, height: B - yB(m), fill: j === 2 ? 'var(--sig)' : 'var(--ink)' }, svg);
        var val = S('text', { 'class': 'mo-val', x: bx(j), y: yB(m) - 8, 'text-anchor': 'middle', fill: j === 2 ? 'var(--sig-t)' : 'var(--ink)' }, svg); val.textContent = r1(m) + '%';
        return { rect: rect, val: val };
      });
      // 선
      var lines = HW.map(function (c, j) {
        return S('path', { 'class': 'mo-line', pathLength: 1, d: c.v.map(function (v, i) { return (i ? 'L' : 'M') + xL(i).toFixed(1) + ' ' + yL(v).toFixed(1); }).join(' '), stroke: j === 2 ? 'var(--sig)' : '#8f8f8f', 'stroke-width': j === 2 ? 3.5 : 2 }, svg);
      });
      // 선 끝 이름(겹치지 않게)
      var ends = HW.map(function (c, j) { return { j: j, y: yL(c.v[11]) }; }).sort(function (a, b) { return a.y - b.y; });
      for (var e = 1; e < ends.length; e++) if (ends[e].y - ends[e - 1].y < 14) ends[e].y = ends[e - 1].y + 14;
      var labs = []; ends.forEach(function (o) { var lt = S('text', { 'class': 'mo-lab', x: xL(11) + 8, y: o.y + 4, fill: o.j === 2 ? 'var(--sig-t)' : '#5b5b5b' }, svg); lt.textContent = HW[o.j].k; labs.push(lt); });
      // 점 48개: 꺾은선의 마디 ↔ 반별 점 분포 ↔ 막대 꼭대기
      var dots = [];
      HW.forEach(function (c, j) {
        var ys = c.v.map(yL), order = ys.map(function (yy, i) { return { y: yy, i: i }; }).sort(function (a, b) { return a.y - b.y; }), placed = [], off = [];
        order.forEach(function (o) { var cand = [0, 1, -1, 2, -2, 3, -3, 4, -4], k = 0; while (k < cand.length - 1 && placed.some(function (p) { return Math.abs(p.y - o.y) < r * 2 + 1 && Math.abs(p.dx - cand[k] * (r * 2 + 1)) < r * 2 + 1; })) k++; var dx = cand[k] * (r * 2 + 1); placed.push({ y: o.y, dx: dx }); off[o.i] = dx; });
        c.v.forEach(function (v, i) {
          var el = S('circle', { 'class': 'mo-dot', cx: 0, cy: 0, r: j === 2 ? r + .6 : r, fill: j === 2 ? 'var(--sig)' : 'var(--ink)' }, svg);
          el.style.transitionDelay = (j * 40 + i * 12) + 'ms';
          dots.push({ el: el, line: { x: xL(i), y: yL(v) }, dot: { x: bx(j) + off[i], y: yL(v) }, bar: { x: bx(j), y: yB(MEANS[j]) } });
        });
      });
      g = { axL: axL, axB: axB, axW: axW, axC: axC, bars: bars, lines: lines, labs: labs, dots: dots };
      apply(true);
    }
    function vis(el, on, now) { el.style.transition = now ? 'none' : ''; el.style.opacity = on ? 1 : 0; }
    function apply(now) {
      if (!g) return;
      now = now || still();
      vis(g.axL, form !== 'bar', now); vis(g.axB, form === 'bar', now); vis(g.axW, form === 'line', now); vis(g.axC, form !== 'line', now);
      [g.axL, g.axB, g.axW, g.axC].forEach(function (a) { if (!now) a.style.transition = 'opacity .5s'; });
      g.bars.forEach(function (b) { if (now) { b.rect.style.transition = 'none'; b.val.style.transition = 'none'; } else { b.rect.style.transition = ''; b.val.style.transition = ''; } b.rect.style.transform = form === 'bar' ? 'scaleY(1)' : 'scaleY(0)'; b.rect.style.opacity = form === 'bar' ? 1 : 0; b.val.style.opacity = form === 'bar' ? 1 : 0; });
      g.lines.forEach(function (l) { l.style.transition = now ? 'none' : ''; l.style.strokeDasharray = '1'; l.style.strokeDashoffset = form === 'line' ? '0' : '1'; l.style.opacity = form === 'line' ? 1 : 0; });
      g.labs.forEach(function (l) { vis(l, form === 'line', now); if (!now) l.style.transition = 'opacity .4s'; });
      g.dots.forEach(function (o) { if (now) o.el.style.transition = 'none'; var p = o[form]; tr(o.el, p.x, p.y); o.el.style.opacity = form === 'bar' ? 0 : 1; if (now) { void o.el.getBoundingClientRect(); o.el.style.transition = ''; } });
      if (now) { void stage.offsetWidth; [g.axL, g.axB, g.axW, g.axC].concat(g.labs).forEach(function (a) { a.style.transition = 'opacity .5s'; }); g.lines.forEach(function (l) { l.style.transition = ''; }); g.bars.forEach(function (b) { b.rect.style.transition = ''; b.val.style.transition = ''; }); }
    }
    radios.forEach(function (r) {
      if (r.checked) form = r.value;
      r.addEventListener('change', function () { if (!r.checked) return; form = r.value; sayEl.textContent = SAY[form]; apply(false); });
    });
    build(); onResize(stage, build);
  }

  /* ── 점검표(이 기기에만) ── */
  function checks() {
    $$('[data-checks]').forEach(function (ul) {
      var key = 'data-pulse:checks:' + ul.dataset.checks, saved = [];
      try { saved = JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) { saved = []; }
      var boxes = $$('input[type=checkbox]', ul);
      boxes.forEach(function (b) { b.checked = saved.indexOf(b.value) >= 0; b.addEventListener('change', function () { var on = boxes.filter(function (x) { return x.checked; }).map(function (x) { return x.value; }); try { localStorage.setItem(key, JSON.stringify(on)); } catch (_) { } }); });
    });
  }

  /* ── 위 막대: 지금 보는 곳 ── */
  function nav() {
    var links = $$('.bar nav a[href^="#"]').filter(function (a) { return !a.hasAttribute('data-st-link'); })
      .map(function (a) { return { a: a, el: d.getElementById(a.getAttribute('href').slice(1)) }; }).filter(function (o) { return o.el; });
    if (!links.length) return;
    var navBox = $('.bar nav'), cur = null;
    function pick() {
      var line = innerHeight * .35, hit = null;
      links.forEach(function (o) { var r = o.el.getBoundingClientRect(); if (r.top < line && r.bottom > line) hit = o; });
      if (hit === cur) return; cur = hit;
      links.forEach(function (o) { if (o === hit) o.a.setAttribute('aria-current', 'true'); else o.a.removeAttribute('aria-current'); });
      if (hit && navBox && navBox.scrollWidth > navBox.clientWidth) navBox.scrollTo({ left: Math.max(0, hit.a.offsetLeft - 40), behavior: still() ? 'auto' : 'smooth' });
    }
    var raf = 0; addEventListener('scroll', function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(pick); }, { passive: true });
    pick();
  }

  /* ── 첫 화면 '지금' 칸: 연수 전·중·후에 할 일 하나 ── */
  function nowCard() {
    var box = $('[data-hub]'), g = $('.gantt'); if (!box || !g) return;
    var K = $('[data-hub-k]', box), T = $('[data-hub-t]', box), Lb = $('[data-hub-l]', box), A = $('[data-hub-a]', box);
    var items = $$('li', g), day = g.dataset.day.split('-'), from = g.dataset.from.split(':'), start = +from[0] * 60 + +from[1];
    var LABEL = { '#join': '입장하기', 'practice.html#st-s1': '실습 1로', 'practice.html#st-s2': '실습 2로', 'practice.html#st-s3': '실습 3으로', '#talk': '퀴즈 풀기', '#end': '설문 쓰기' };
    function two(n) { return (n < 10 ? '0' : '') + n; }
    function set(k, t, l, href) { K.textContent = k; T.textContent = t; Lb.textContent = l; if (href) { A.hidden = false; A.setAttribute('href', href); A.textContent = LABEL[href] || '과제 보기'; } else A.hidden = true; }
    function tick() {
      var n = new Date(), today = new Date(n.getFullYear(), n.getMonth(), n.getDate()), on = new Date(+day[0], +day[1] - 1, +day[2]);
      var days = Math.round((on - today) / 864e5), m = n.getHours() * 60 + n.getMinutes() - start;
      g.classList.remove('is-live'); items.forEach(function (li) { li.classList.remove('is-now'); });
      if (days > 0 || (days === 0 && m < 0)) { set(days > 0 ? 'D-' + days + ' · 시작' : '오늘 시작', '12. 10.(목) 14:30', '들어가며 · 출석과 첫 투표부터 해요', '#join'); return; }
      if (days === 0 && m < 180) {
        g.style.setProperty('--now', (m / 180).toFixed(4)); g.classList.add('is-live');
        var cur = items.filter(function (li) { var s0 = +li.style.getPropertyValue('--s'), len = +li.style.getPropertyValue('--m'); return m >= s0 && m < s0 + len; })[0];
        if (cur) { cur.classList.add('is-now'); set('지금', two(n.getHours()) + ':' + two(n.getMinutes()), $('b', cur).textContent + ' · ' + (cur.dataset.say || ''), cur.dataset.go || ''); }
        return;
      }
      set('연수가 끝났어요 · 과제 마감', '12. 17.(목) 18:00', '데이터 한 장 보고서를 과제 보드에 올려요', '#task');
    }
    tick(); setInterval(tick, 30000);
  }

  /* ── 마무리 문장 ── */
  function endQuote() { var q = $('.end .quote'); if (q) onSeen(q, function () { q.classList.add('in'); }, '0px 0px -18% 0px'); }

  function run(fn) { try { fn(); } catch (e) { if (window.console) console.warn(e); } }
  [hero, pulse, counters, gantt, nowCard, threshold, morph, checks, nav, endQuote].forEach(run);
})();
