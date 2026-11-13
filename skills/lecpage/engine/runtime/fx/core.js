/*!
 * LecFX core — lecpage 효과 레지스트리 (classic script, 의존성 없음)
 * 계약: docs/architecture.md §4. 전역은 window.LecFX 하나만 만든다.
 *
 * 원칙
 *  - 쉬는 상태가 완성 상태. 효과가 실패해도 글은 보인다(data-fx-pre는 core가 걷어 낸다).
 *  - prefers-reduced-motion을 따른다. 사용자가 '움직임 재생'을 누르면 그 선택이 우선.
 *  - 5초 넘게 움직이는 효과(spec.loop)는 LecFX.pause()에 멈춘다. 화면 밖·탭 숨김에서도 멈춘다.
 *  - 외부 스크립트는 jsDelivr 버전 고정 URL(또는 같은 사이트 상대 경로)만 불러온다.
 */
(function (w, d) {
  'use strict';
  if (w.LecFX && w.LecFX.version) return;

  var html = d.documentElement;
  var KEY = 'lecfx-motion'; // 'off' 사용자가 멈춤 · 'on' 사용자가 재생(OS 설정보다 우선) · 없음 = OS 따름
  var specs = {};
  var insts = [];
  var started = false;
  var pauseSubs = [];
  var themeSubs = [];
  var loads = {};
  var toggles = [];
  var loopCount = 0;
  var noop = function () {};
  var mqR = mq('(prefers-reduced-motion: reduce)');
  var mqD = mq('(prefers-color-scheme: dark)');
  var mqF = mq('(hover: hover) and (pointer: fine)');
  var stored = getStore();

  function mq(q) { try { return w.matchMedia(q); } catch (e) { return null; } }
  function getStore() { try { return w.localStorage.getItem(KEY); } catch (e) { return null; } }
  function setStore(v) {
    stored = v;
    try { if (v == null) w.localStorage.removeItem(KEY); else w.localStorage.setItem(KEY, v); } catch (e) { /* 사파리 사생활 모드 등 */ }
  }
  function onMq(m, fn) { if (!m) return; if (m.addEventListener) m.addEventListener('change', fn); else if (m.addListener) m.addListener(fn); }
  function rm(arr, x) { var i = arr.indexOf(x); if (i > -1) arr.splice(i, 1); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------- 상태 ---------- */
  function osReduced() { return !!(mqR && mqR.matches); }
  function reduced() { return osReduced() && stored !== 'on'; }
  function isPaused() { return stored === 'off' || reduced(); }
  /* 따라 하며 쓰는 칸(실습·질문·교재·보드·투표·프롬프트): 집중을 깨지 않게 움직임은 1단계(차분)까지만 */
  var CALM = '.lp-sec-stations,.lp-sec-qa,.lp-sec-deck,.lp-sec-board,.lp-sec-poll,.lp-sec-prompts,[data-calm]';
  /* 모션 단계. el을 주면 그 요소가 놓인 자리의 단계.
     - 저사양 기기(lowPower)는 한 단계 낮춤(1단계 아래로는 내리지 않음). 사용자가 '가벼운 모드'를 직접 끄면(data-fx-lowpower="0") 낮추지 않음
     - 따라 하는 칸 안에서는 1단계까지만 */
  function level(el) {
    var v = parseInt(html.getAttribute('data-motion'), 10);
    v = v >= 0 && v <= 3 ? v : 2;
    if (v > 1 && lowPower()) v -= 1;
    if (v > 1 && el && el.closest && el.closest(CALM)) v = 1;
    return v;
  }
  /* 저사양: 정말 약한 기기(코어 2개 이하·메모리 2GB 이하)와 데이터 절약 모드만 미리 판정.
     코어 4개·메모리 4GB는 요즘 휴대폰·아이패드·노트북 대부분이라(크롬은 6GB도 4로 알림) 여기서 막으면 그래픽이 거의 어디서나 정지 화면이 됨.
     그런 기기(modest)는 끝없이 도는 그림의 프레임과 해상도만 낮추고, 실제로 프레임이 계속 밀리면(slow) 그때 정지 화면으로 내림 */
  var slow = false;
  function lowPower() {
    var a = html.getAttribute('data-fx-lowpower');
    if (a === '0') return false;
    if (a === '1') return true;
    if (slow) return true;
    var n = w.navigator || {}, c = n.connection || {};
    return !!((n.hardwareConcurrency && n.hardwareConcurrency <= 2) || (n.deviceMemory && n.deviceMemory <= 2) || c.saveData);
  }
  function modest() {
    if (html.getAttribute('data-fx-lowpower') === '0') return false;
    var n = w.navigator || {};
    return lowPower() || !!((n.hardwareConcurrency && n.hardwareConcurrency <= 4) || (n.deviceMemory && n.deviceMemory <= 4));
  }
  /* 프레임 감시: 도는 그림이 있을 때 실제 프레임 간격을 잼. 시작 1.5초 뒤부터 3초 동안 프레임의 70% 넘게 50ms(초당 20장)를 넘기면
     이 기기에서는 끝없이 도는 그림을 정지 화면으로 내림(html.fx-slow, 다시 불러오기 전까지). 숨은 탭·화면 밖에서는 재지 않음 */
  var watch = { n: 0, bad: 0, t0: 0 };
  function frameSeen(dt, now) {
    if (slow || html.getAttribute('data-fx-lowpower') === '0') return;
    if (!watch.t0) { watch.t0 = now; return; }
    if (now - watch.t0 < 1500) return;
    if (dt > 400) { watch.n = watch.bad = 0; watch.t0 = now - 1500; return; } // 탭 전환·멈춤 뒤의 긴 틈은 셈하지 않음
    watch.n++; if (dt > 50) watch.bad++;
    if (now - watch.t0 < 4500 || watch.n < 40) return;
    if (watch.bad / watch.n > 0.7) {
      slow = true; html.classList.add('fx-slow');
      pauseSubs.slice().forEach(function (f) { try { f(isPaused()); } catch (e) { /* 무시 */ } });
    } else { watch.n = watch.bad = 0; watch.t0 = now - 1500; }
  }

  /* ---------- 스크립트 지연 로드 ---------- */
  function allowed(url) {
    if (!/^[a-z]+:/i.test(url) && url.indexOf('//') !== 0) return true; // 같은 사이트 상대 경로(USB·오프라인 배포)
    return /^https:\/\/cdn\.jsdelivr\.net\/(npm|gh)\/[^/]+@\d/.test(url) || /^https:\/\/cdn\.jsdelivr\.net\/(npm|gh)\/@[^/]+\/[^/]+@\d/.test(url);
  }
  // 외부 라이브러리는 내용 지문(SRI)이 맞을 때만 실행(CDN이 바뀌거나 뚫려도 다른 코드가 돌지 않게)
  var SRI = {
    'https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/gsap.min.js': 'sha384-3vCAhD+a3BOliP3QqjQINn6ZWiZxoqu0WFxX5ZQZgqekDZuSb1mJBrrLMmu94H8f',
    'https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/ScrollTrigger.min.js': 'sha384-H2WL1iy/jKQQ7MTHU2hskZKNHTYWWD/KgKE1vCNnaWY8An2ESTh23KN/fTp8XS3j',
    'https://cdn.jsdelivr.net/npm/lenis@1.3.27/dist/lenis.min.js': 'sha384-R18XzqnxvVLEF+BYfhpmDx30v7eP83fAckyfoRzK7/Uf6nGqufcmsk0eAKo7S3RU'
  };
  function load(url) {
    if (loads[url]) return loads[url];
    loads[url] = new Promise(function (res) {
      if (!allowed(url)) { res(false); return; }
      var abs = /^https:/i.test(url);
      if (abs && !SRI[url]) { res(false); return; } // 지문이 없는 외부 스크립트는 받지 않음
      var s = d.createElement('script');
      var t = setTimeout(function () { done(false); }, 12000);
      function done(ok) { clearTimeout(t); s.onload = s.onerror = null; res(ok); }
      s.src = url; s.async = true; s.crossOrigin = 'anonymous';
      if (abs) s.integrity = SRI[url];
      s.onload = function () { done(true); };
      s.onerror = function () { done(false); };
      (d.head || html).appendChild(s);
    });
    return loads[url];
  }
  var dynImport = null;
  function esm(url) {
    if (loads['esm:' + url]) return loads['esm:' + url];
    loads['esm:' + url] = new Promise(function (res) {
      if (!allowed(url)) { res(null); return; }
      // ESM은 정해 둔 한 곳(OGL 고정 판)만. eval·new Function을 쓰지 않아 엄격한 CSP에서도 동작
      if (url !== 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/+esm') { res(null); return; }
      dynImport = dynImport || function (u) { return import(u); };
      var t = setTimeout(function () { res(null); }, 15000);
      dynImport(url).then(function (m) { clearTimeout(t); res(m); }, function () { clearTimeout(t); res(null); });
    });
    return loads['esm:' + url];
  }

  /* ---------- 화면에 들어올 때 ---------- */
  var ios = {};
  function visible(el, cb, o) {
    o = o || {};
    var once = o.once !== false;
    if (!('IntersectionObserver' in w) || !el) { cb(true, null); return noop; }
    var th = o.threshold != null ? o.threshold : 0;
    var rmg = o.rootMargin || '0px';
    var key = String(th) + '|' + rmg;
    var rec = ios[key];
    if (!rec) {
      rec = ios[key] = { map: new Map(), io: null };
      rec.io = new IntersectionObserver(function (ens) {
        for (var i = 0; i < ens.length; i++) {
          var list = rec.map.get(ens[i].target);
          if (list) list.slice().forEach(function (h) { h(ens[i]); });
        }
      }, { threshold: th, rootMargin: rmg });
    }
    var h = function (en) {
      var on = en.isIntersecting;
      if (once) { if (!on) return; off(); }
      cb(on, en);
    };
    var list = rec.map.get(el);
    if (!list) { list = []; rec.map.set(el, list); rec.io.observe(el); }
    list.push(h);
    function off() {
      var l = rec.map.get(el);
      if (!l) return;
      rm(l, h);
      if (!l.length) { rec.map['delete'](el); rec.io.unobserve(el); }
    }
    return off;
  }

  /* ---------- 웹 글꼴 기다리기(최대 1초) ---------- */
  var fontWait = null, fontGiveUp = false;
  function fontsOk() { return fontGiveUp || !d.fonts || d.fonts.status === 'loaded'; }
  function whenFonts(cb) {
    if (!fontWait) fontWait = new Promise(function (res) {
      var done = function () { fontGiveUp = true; res(); };
      try { d.fonts.ready.then(done, done); } catch (e) { done(); }
      setTimeout(done, 1000);
    });
    fontWait.then(cb);
  }

  /* ---------- 토큰·색 ---------- */
  function token(name, el) {
    name = name.indexOf('--') === 0 ? name : '--' + name;
    try { return w.getComputedStyle(el || html).getPropertyValue(name).trim(); } catch (e) { return ''; }
  }
  var pc, pg, pcache = {};
  function parse(v) {
    if (!v) return [0, 0, 0, 0];
    if (pcache[v]) return pcache[v];
    var out, m = /^#([0-9a-f]{3,8})$/i.exec(v);
    var r = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+)(%?))?\s*\)$/i.exec(v);
    if (r) {
      out = [Math.round(+r[1]), Math.round(+r[2]), Math.round(+r[3]), r[4] == null ? 1 : r[5] ? +r[4] / 100 : +r[4]];
    } else if (m) {
      var hx = m[1];
      if (hx.length < 6) hx = hx.split('').map(function (c) { return c + c; }).join('');
      out = [parseInt(hx.slice(0, 2), 16), parseInt(hx.slice(2, 4), 16), parseInt(hx.slice(4, 6), 16), hx.length > 6 ? parseInt(hx.slice(6, 8), 16) / 255 : 1];
    } else {
      try {
        if (!pc) { pc = d.createElement('canvas'); pc.width = pc.height = 1; pg = pc.getContext('2d', { willReadFrequently: true }); }
        pg.clearRect(0, 0, 1, 1);
        pg.fillStyle = '#000'; pg.fillStyle = v; pg.fillRect(0, 0, 1, 1);
        var p = pg.getImageData(0, 0, 1, 1).data;
        out = [p[0], p[1], p[2], p[3] / 255];
      } catch (e) { out = [0, 0, 0, 1]; }
    }
    pcache[v] = out;
    return out;
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a == null ? c[3] : a) + ')'; }
  function lum(c) {
    var f = function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function mix(a, b, t) { return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * t); }).concat([1]); }

  /* 테마 변화(data-theme·OS 다크) 알림 */
  var themeQueued = false;
  function themeChanged() {
    if (themeQueued) return;
    themeQueued = true;
    (w.requestAnimationFrame || setTimeout)(function () {
      themeQueued = false;
      themeSubs.slice().forEach(function (f) { try { f(); } catch (e) { /* 개별 효과 문제는 무시 */ } });
    });
  }
  if ('MutationObserver' in w) new MutationObserver(themeChanged).observe(html, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
  onMq(mqD, themeChanged);
  w.addEventListener('lecfx:tone', themeChanged);

  /* ---------- 스크롤(읽기→쓰기 두 단계, 프레임당 1회) ---------- */
  var scrollSubs = [], scrollQueued = false;
  function runScroll() {
    scrollQueued = false;
    var vh = w.innerHeight, y = w.pageYOffset, writes = [];
    for (var i = 0; i < scrollSubs.length; i++) {
      var s = scrollSubs[i];
      if (!s.active) continue;
      try { var r = s.fn(y, vh); if (typeof r === 'function') writes.push(r); } catch (e) { /* 무시 */ }
    }
    for (var j = 0; j < writes.length; j++) { try { writes[j](); } catch (e2) { /* 무시 */ } }
  }
  function queueScroll() { if (!scrollQueued) { scrollQueued = true; (w.requestAnimationFrame || setTimeout)(runScroll); } }
  w.addEventListener('scroll', queueScroll, { passive: true });
  w.addEventListener('resize', queueScroll, { passive: true });
  w.addEventListener('load', queueScroll);
  function onScroll(fn, o) {
    var s = { fn: fn, active: true };
    var off = noop;
    if (o && o.el) { s.active = false; off = visible(o.el, function (on) { s.active = on; if (on) queueScroll(); }, { once: false, rootMargin: o.margin || '25% 0px' }); }
    scrollSubs.push(s);
    queueScroll();
    return function () { off(); rm(scrollSubs, s); };
  }

  /* ---------- 글자 나누기(접근성: 원문은 화면 낭독기용으로 따로 둔다) ---------- */
  function split(el, mode) {
    var orig = el.innerHTML;
    var holder = el;
    var words = [], chars = [];
    if (!el.querySelector('a,button,input,select,textarea,[tabindex]')) {
      var sr = d.createElement('span');
      sr.className = 'fx-sr';
      sr.textContent = el.textContent.replace(/\s+/g, ' ').trim();
      holder = d.createElement('span');
      holder.className = 'fx-split';
      holder.setAttribute('aria-hidden', 'true');
      while (el.firstChild) holder.appendChild(el.firstChild);
      el.appendChild(sr);
      el.appendChild(holder);
    }
    var tw = d.createTreeWalker(holder, 4, null), nodes = [], n;
    while ((n = tw.nextNode())) if (n.nodeValue.trim() || /\s/.test(n.nodeValue)) nodes.push(n);
    nodes.forEach(function (t) {
      var frag = d.createDocumentFragment();
      t.nodeValue.split(/(\s+)/).forEach(function (p) {
        if (!p) return;
        if (/^\s+$/.test(p)) { frag.appendChild(d.createTextNode(p)); return; }
        /* 낱말 단위는 줄바꿈되지 않는 덩어리(.fx-w: nowrap, 글자 모드는 inline-block).
           공백은 텍스트 노드로 남겨 낱말 사이에서만 줄이 바뀐다 → word-break: keep-all과 같은 결과 */
        var ws = d.createElement('span');
        ws.className = mode === 'chars' ? 'fx-w fx-wc' : 'fx-w';
        if (mode === 'chars') {
          Array.from(p).forEach(function (ch) {
            var cs = d.createElement('span');
            cs.className = 'fx-c';
            cs.textContent = ch;
            ws.appendChild(cs);
            chars.push(cs);
          });
        } else ws.textContent = p;
        words.push(ws);
        frag.appendChild(ws);
      });
      t.parentNode.replaceChild(frag, t);
    });
    return {
      words: words, chars: chars,
      lines: function () {
        var out = [], top = null;
        words.forEach(function (wd) {
          var y = Math.round(wd.offsetTop);
          if (top === null || Math.abs(y - top) > 4) { out.push([]); top = y; }
          out[out.length - 1].push(wd);
        });
        return out;
      },
      revert: function () { el.innerHTML = orig; }
    };
  }

  function rand(seed) { // mulberry32 — 같은 씨앗이면 같은 그림
    var a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  var util = {
    clamp: clamp,
    lerp: function (a, b, t) { return a + (b - a) * t; },
    ease: function (t) { return 1 - Math.pow(1 - t, 3); },
    easeExpo: function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    rand: rand, hash: hash, parse: parse, rgba: rgba, lum: lum, contrast: contrast, mix: mix,
    split: split,
    /* 적용 대상: opts.items 선택자 > 목록·격자의 자식 > 요소 자신 */
    items: function (el, o) {
      o = o || {};
      if (o.items) return Array.prototype.slice.call(el.querySelectorAll(o.items));
      if (o.each === false) return [el];
      var tag = el.tagName, kids = Array.prototype.slice.call(el.children);
      if (tag === 'UL' || tag === 'OL') return kids;
      if (o.each === true && kids.length) return kids;
      if (kids.length >= 2) { var ds = w.getComputedStyle(el).display; if (/grid|flex/.test(ds)) return kids; }
      return [el];
    },
    /* 꾸밈 조각 자리: 왼쪽 가운데(보통 글이 놓이는 곳)를 피해 오른쪽 띠·위아래 띠·왼쪽 모서리에 [x%, y%] */
    spot: function (rnd, i) {
      var z = i == null ? rnd() : (i % 7) / 7 + rnd() * 0.01;
      if (z < 0.38) return [74 + rnd() * 23, 6 + rnd() * 88];
      if (z < 0.58) return [38 + rnd() * 58, 3 + rnd() * 11];
      if (z < 0.84) return [34 + rnd() * 62, 87 + rnd() * 10];
      return [2 + rnd() * 8, rnd() < 0.5 ? 3 + rnd() * 9 : 88 + rnd() * 9];
    },
    progress: function (el, vh, a, b) { // 요소가 화면 a(아래)→b(위) 지점을 지나는 정도 0..1
      var r = el.getBoundingClientRect();
      a = a == null ? 1 : a; b = b == null ? 0 : b;
      var start = vh * a, end = vh * b - r.height;
      return clamp((start - r.top) / (start - end || 1), 0, 1);
    }
  };

  /* ---------- 실패 처리: 숨김 해제 ---------- */
  function unhide(el) {
    if (!el) return;
    el.removeAttribute('data-fx-pre');
    if (el.querySelectorAll) Array.prototype.forEach.call(el.querySelectorAll('[data-fx-pre]'), function (x) { x.removeAttribute('data-fx-pre'); });
  }
  function fail(inst, err) {
    if (inst.dead) return;
    runCleanups(inst);
    unhide(inst.el);
    inst.el.setAttribute('data-fx-error', inst.id);
    if (w.console && console.warn) console.warn('[LecFX] ' + inst.id + ' 효과를 건너뜀:', err && err.message ? err.message : err);
  }
  function runCleanups(inst) {
    inst.dead = true;
    var c = inst.cleanups;
    while (c.length) { try { c.pop()(); } catch (e) { /* 무시 */ } }
  }

  /* ---------- 효과별 ctx ---------- */
  function makeCtx(inst) {
    var el = inst.el, cl = inst.cleanups, lp = lowPower();
    var ctx = {
      id: inst.id,
      reduced: reduced(),
      level: level(el),
      lowPower: lp,
      modest: modest(),
      fine: !!(mqF && mqF.matches),
      util: util,
      isPaused: isPaused,
      load: load,
      esm: esm,
      visible: function (t, cb, o) { var off = visible(t, cb, o); cl.push(off); return off; },
      token: function (name, from) { return token(name, from || el); },
      rgb: function (name, from) { return parse(token(name, from || el)); },
      color: function (name, a, from) { return rgba(parse(token(name, from || el)), a); },
      /* 바탕·글자색 중 밝은 쪽(하이라이트·반사광용) */
      light: function (from) { var b = parse(token('background', from || el)), f = parse(token('foreground', from || el)); return rgba(lum(b) > lum(f) ? b : f, 1); },
      onPause: function (cb) { pauseSubs.push(cb); cl.push(function () { rm(pauseSubs, cb); }); },
      onTheme: function (cb) { themeSubs.push(cb); cl.push(function () { rm(themeSubs, cb); }); },
      onScroll: function (fn, o) { var off = onScroll(fn, o); cl.push(off); return off; },
      on: function (t, type, fn, opt) { t.addEventListener(type, fn, opt); cl.push(function () { t.removeEventListener(type, fn, opt); }); },
      cleanup: function (fn) { cl.push(fn); },
      /* 웹 글꼴이 오면(최대 1초) 부름: 글자를 다루는 효과가 대체 글꼴로 돌다가 튀지 않게 */
      fonts: function (cb) { if (fontsOk()) cb(); else whenFonts(function () { if (!inst.dead) cb(); }); },
      fail: function (err) { fail(inst, err); },
      /* 진입: 대기 상태(data-fx-pre)를 붙였다가 화면에 들어오면 걷어 낸다 */
      enter: function (t, cb, o) {
        o = o || {};
        /* 대기 상태로는 곧바로 들어감(data-fx-snap이 붙은 동안 전환 없음). 이것이 없으면 대기 상태로 '천천히' 가다가 바로 되돌아와,
           이미 화면에 보이는 요소(첫 화면 제목·작은 미리보기)는 움직임이 거의 보이지 않음 */
        t.setAttribute('data-fx-snap', '');
        t.setAttribute('data-fx-pre', '');
        void t.offsetWidth;
        t.removeAttribute('data-fx-snap');
        var go = function () {
          if (!t.hasAttribute('data-fx-pre')) return;
          /* 웹 글꼴이 아직이면 잠깐(최대 1초) 기다렸다 들어옴: 대체 글꼴로 들어오다 글꼴이 바뀌며 글자가 튀지 않게(첫 화면 제목) */
          if (!fontsOk()) { whenFonts(go); return; }
          void t.offsetWidth;
          t.removeAttribute('data-fx-pre');
          t.setAttribute('data-fx-in', '');
          if (cb) cb();
        };
        if (!('IntersectionObserver' in w)) { go(); return; }
        /* A: 윗변이 화면 (at) 선을 넘으면 — 키 큰 요소도 확실히 잡힌다
           B: 작게라도 60% 이상 보이면 — 페이지 맨 끝의 작은 요소용 */
        var ios2 = [], done = function () { ios2.forEach(function (x) { x.disconnect(); }); go(); };
        var cut = Math.round((1 - (o.at || 0.95)) * 100); /* 화면 아래 끝에 머리가 걸린 채 멈춰도 숨은 채 남지 않게(0.88이면 아래 12%에 걸린 제목이 비어 보였음) */
        ios2.push(new IntersectionObserver(function (ens) { if (ens[ens.length - 1].isIntersecting) done(); }, { rootMargin: '0px 0px -' + cut + '% 0px', threshold: 0 }));
        ios2.push(new IntersectionObserver(function (ens) { if (ens[ens.length - 1].intersectionRatio >= 0.6) done(); }, { threshold: 0.6 }));
        ios2.forEach(function (x) { x.observe(t); });
        cl.push(function () { ios2.forEach(function (x) { x.disconnect(); }); t.removeAttribute('data-fx-pre'); });
      },
      /* 그래픽 효과 공통: 꾸밈 층(aria-hidden, 클릭 통과)을 호스트 맨 앞에 넣는다 */
      layer: function (host, cls) {
        /* 띠(구분선)처럼 낮은 호스트에는 최소 높이 64px */
        if (host.getBoundingClientRect().height < 40 && !host.style.minHeight) {
          host.style.minHeight = '64px';
          cl.push(function () { host.style.minHeight = ''; });
        }
        var ly = d.createElement('div');
        ly.className = 'fx-layer ' + (cls || 'fx-' + inst.id);
        ly.setAttribute('aria-hidden', 'true');
        host.classList.add('fx-host');
        host.insertBefore(ly, host.firstChild);
        cl.push(function () { if (ly.parentNode) ly.parentNode.removeChild(ly); host.classList.remove('fx-host'); });
        return ly;
      },
      /* 캔버스: DPR 최대 2, 크기 자동 맞춤 */
      canvas: function (parent, o) {
        o = o || {};
        var c = d.createElement('canvas');
        c.className = 'fx-canvas';
        c.setAttribute('aria-hidden', 'true');
        parent.appendChild(c);
        var api = { el: c, w: 0, h: 0, dpr: 1, g: null, onResize: null };
        try {
          api.g = o.gl ? (c.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: false, powerPreference: 'low-power' }) || null) : c.getContext('2d');
        } catch (e) { api.g = null; }
        var size = function () {
          var r = c.getBoundingClientRect();
          var dpr = Math.min(o.maxDpr || 2, ctx.modest ? 1.5 : 2, w.devicePixelRatio || 1) * (o.scale || 1);
          var W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
          if (W === api.w && H === api.h && dpr === api.dpr) return;
          api.w = W; api.h = H; api.dpr = dpr;
          c.width = Math.max(1, Math.round(W * dpr)); c.height = Math.max(1, Math.round(H * dpr));
          if (api.g && api.g.setTransform) api.g.setTransform(dpr, 0, 0, dpr, 0, 0);
          if (api.onResize) api.onResize(W, H, dpr);
        };
        api.size = size;
        if ('ResizeObserver' in w) {
          var q = 0, ro = new ResizeObserver(function () { if (!q) q = requestAnimationFrame(function () { q = 0; size(); }); });
          ro.observe(c);
          cl.push(function () { ro.disconnect(); });
        } else { w.addEventListener('resize', size); cl.push(function () { w.removeEventListener('resize', size); }); }
        size();
        cl.push(function () { if (c.parentNode) c.parentNode.removeChild(c); });
        return api;
      },
      /* 반복 그리기: 보일 때·탭이 보일 때·멈춤 아님·동작 줄이기 아님에서만 돈다. 아니면 정지 화면 한 장 */
      loop: function (target, draw, o) {
        o = o || {};
        var raf = 0, last = 0, prev = 0, T = o.t || 0, vis = false, alive = true;
        /* 보통 기기(modest)는 초당 30장까지만 */
        var fps = ctx.modest && !lp ? Math.min(o.fps || 30, 30) : o.fps;
        var minDt = fps ? 1000 / fps : 0;
        var still = function () { return ctx.reduced || ((lp || slow) && !o.lowPowerOK); };
        var want = function () { return alive && vis && !d.hidden && !isPaused() && !still(); };
        var frame = function (now) {
          raf = 0;
          if (!want()) { last = prev = 0; return; }
          raf = requestAnimationFrame(frame);
          if (prev) frameSeen(now - prev, now);
          prev = now;
          if (!last) { last = now; return; }
          var dt = now - last;
          if (minDt && dt < minDt - 2) return;
          last = now;
          dt = Math.min(dt, 64);
          T += dt / 1000;
          try { draw(T, dt / 1000, false); } catch (e) { alive = false; fail(inst, e); }
        };
        var update = function () {
          if (want()) { if (!raf) { last = prev = 0; raf = requestAnimationFrame(frame); } return; }
          if (raf) { cancelAnimationFrame(raf); raf = 0; }
          if (vis && alive) { try { draw(T, 0, true); } catch (e) { alive = false; fail(inst, e); } }
        };
        loopCount++;
        ensureToggle();
        var offV = visible(target, function (on) { vis = on; update(); }, { once: false, rootMargin: '120px' });
        d.addEventListener('visibilitychange', update);
        pauseSubs.push(update);
        var api = {
          update: update,
          redraw: function () { if (!raf && vis && alive) draw(T, 0, true); },
          get running() { return !!raf; },
          get t() { return T; },
          stop: function () {
            alive = false; offV();
            if (raf) cancelAnimationFrame(raf);
            d.removeEventListener('visibilitychange', update);
            rm(pauseSubs, update);
          }
        };
        cl.push(api.stop);
        return api;
      },
      /* 어두운 바탕: 밝은 테마에서도 이 영역만 어두운 토큰으로 바꾼다(대비 4.5:1 확인) */
      surface: function (host, kind) {
        var bg = parse(token('background', host)), fg = parse(token('foreground', host));
        var bgDark = lum(bg) < lum(fg);
        if ((kind || 'dark') === 'dark' && bgDark) return false;
        var dark = bgDark ? bg : fg, light = bgDark ? fg : bg;
        var pr = parse(token('primary', host));
        var base = mix(dark, pr, 0.1);
        if (contrast(base, light) < 7) base = mix(dark, pr, 0.04);
        var muted = mix(light, base, 0.28);
        if (contrast(muted, base) < 4.5) muted = mix(light, base, 0.12);
        var pr2 = pr, k = 0;
        while (contrast(pr2, base) < 4.5 && k++ < 10) pr2 = mix(pr2, light, 0.18);
        var vars = {
          '--primary': rgba(pr2), '--ring': rgba(pr2), '--primary-foreground': rgba(contrast(pr2, base) >= contrast(pr2, light) ? base : light),
          '--background': rgba(base), '--foreground': rgba(light),
          '--muted-foreground': rgba(muted), '--border': rgba(mix(base, light, 0.18)),
          '--card': rgba(mix(base, light, 0.06)), '--card-foreground': rgba(light),
          '--muted': rgba(mix(base, light, 0.1)), '--surface-2': rgba(mix(base, light, 0.08))
        };
        Object.keys(vars).forEach(function (k) { host.style.setProperty(k, vars[k]); });
        host.classList.add('fx-surface-dark');
        cl.push(function () { Object.keys(vars).forEach(function (k) { host.style.removeProperty(k); }); host.classList.remove('fx-surface-dark'); });
        return true;
      }
    };
    return ctx;
  }

  /* ---------- 등록·시작 ---------- */
  function parseOpts(el, id) {
    var raw = el.getAttribute('data-fx-opts');
    if (!raw) return {};
    try {
      var o = JSON.parse(raw);
      if (o && typeof o[id] === 'object' && o[id] && !Array.isArray(o[id])) return o[id];
      return o && typeof o === 'object' ? o : {};
    } catch (e) { return {}; }
  }
  function initOne(el, id) {
    var spec = specs[id];
    if (!spec) return;
    el.__lecfx = el.__lecfx || {};
    if (el.__lecfx[id]) return;
    if ((spec.level == null ? 1 : spec.level) > level(el)) { el.__lecfx[id] = { skipped: true }; return; }
    /* 가벼운 모드·저사양: WebGL·외부 라이브러리를 쓰는 효과는 시작하지 않음(쉬는 상태가 완성 상태라 글은 그대로 보임) */
    if (spec.heavy && lowPower()) { el.__lecfx[id] = { skipped: true }; return; }
    var inst = { el: el, id: id, cleanups: [], dead: false };
    el.__lecfx[id] = inst;
    insts.push(inst);
    var ctx = makeCtx(inst);
    try {
      var r = spec.init(el, parseOpts(el, id), ctx);
      if (typeof r === 'function') inst.cleanups.push(r);
      if (spec.loop) { loopCount++; ensureToggle(); }
    } catch (e) { fail(inst, e); }
  }
  function scan(root, onlyId) {
    root = root || d;
    var list = [];
    if (root.nodeType === 1 && root.hasAttribute('data-fx')) list.push(root);
    var sel = onlyId ? '[data-fx~="' + onlyId + '"]' : '[data-fx]';
    Array.prototype.push.apply(list, root.querySelectorAll ? root.querySelectorAll(sel) : []);
    list.forEach(function (el) {
      (el.getAttribute('data-fx') || '').split(/\s+/).forEach(function (id) {
        if (id && (!onlyId || id === onlyId)) initOne(el, id);
      });
    });
  }
  function define(id, spec) {
    if (!id || !spec || typeof spec.init !== 'function') return;
    specs[id] = spec;
    if (started) scan(d, id);
  }
  function start(root) {
    started = true;
    html.classList.add('fx-ready');
    bindToggles(root || d);
    scan(root || d);
    html.classList.remove('fx-boot');
    applyState();
    return api;
  }
  function stop(root) {
    root = root || d;
    insts.slice().forEach(function (inst) {
      if (root === d || root === inst.el || (root.contains && root.contains(inst.el))) {
        runCleanups(inst);
        unhide(inst.el);
        if (inst.el.__lecfx) delete inst.el.__lecfx[inst.id];
        rm(insts, inst);
      }
    });
    /* 단계에 걸려 건너뛴 표시도 지움: 단계를 바꾼 뒤 start()하면 다시 판단(가벼운 모드 켜고 끄기) */
    Array.prototype.forEach.call((root.querySelectorAll ? root : d).querySelectorAll('[data-fx]'), function (el) {
      var m = el.__lecfx; if (!m) return;
      Object.keys(m).forEach(function (k) { if (m[k] && m[k].skipped) delete m[k]; });
    });
  }

  /* ---------- 움직임 멈춤/재생 ---------- */
  function applyState() {
    var p = isPaused();
    html.classList.toggle('fx-paused', p);
    html.classList.toggle('fx-reduced', reduced());
    toggles.forEach(function (b) {
      var lab = b.querySelector('[data-fx-toggle-label]') || b;
      lab.textContent = p ? '움직임 재생' : '움직임 멈춤';
      b.setAttribute('data-state', p ? 'paused' : 'playing');
    });
    pauseSubs.slice().forEach(function (f) { try { f(p); } catch (e) { /* 무시 */ } });
  }
  function pause() { setStore('off'); applyState(); }
  function resume() { setStore(osReduced() ? 'on' : null); applyState(); }
  function toggle() { if (isPaused()) resume(); else pause(); }
  function bindToggles(root) {
    Array.prototype.forEach.call((root.querySelectorAll ? root : d).querySelectorAll('[data-fx-toggle]'), function (b) {
      if (b.__fxToggle) return;
      b.__fxToggle = true;
      if (b.tagName === 'BUTTON' && !b.getAttribute('type')) b.setAttribute('type', 'button');
      b.addEventListener('click', function (e) { e.preventDefault(); toggle(); });
      toggles.push(b);
    });
  }
  function ensureToggle() {
    if (!started || toggles.length || html.getAttribute('data-fx-toggle') === 'off' || !d.body) return;
    var b = d.createElement('button');
    b.className = 'fx-toggle';
    b.setAttribute('data-fx-toggle', '');
    b.innerHTML = '<span class="fx-toggle-ico" aria-hidden="true"></span><span data-fx-toggle-label>움직임 멈춤</span>';
    d.body.appendChild(b);
    bindToggles(d);
    applyState();
  }
  onMq(mqR, function () { applyState(); });

  /* 화면 전환 감싸기(View Transitions) — 지원 안 하거나 동작 줄이기면 바로 실행 */
  function swap(fn) {
    if (!d.startViewTransition || reduced() || level() < 1) { fn(); return Promise.resolve(); }
    try { return d.startViewTransition(fn).finished.then(noop, noop); } catch (e) { fn(); return Promise.resolve(); }
  }
  function emit(name, detail, target) {
    var ev;
    try { ev = new CustomEvent(name, { detail: detail || {} }); } catch (e) { ev = d.createEvent('CustomEvent'); ev.initCustomEvent(name, false, false, detail || {}); }
    (target || d).dispatchEvent(ev);
  }

  w.addEventListener('beforeprint', function () { unhide(d.body); });

  var api = {
    version: '1.0.0',
    define: define,
    start: start,
    stop: stop,
    pause: pause,
    resume: resume,
    toggle: toggle,
    isPaused: isPaused,
    swap: swap,
    /* 다른 런타임(lecpage.js)이 부르는 신호. 해당 효과가 없으면 아무 일도 없다 */
    celebrate: function (o) { emit('lecfx:celebrate', o); },
    copied: function (btn) { emit('lecfx:copied', { el: btn }, btn || d); },
    has: function (id) { return !!specs[id]; },
    list: function () { return Object.keys(specs); },
    state: function () { return { level: level(), reduced: reduced(), paused: isPaused(), lowPower: lowPower(), modest: modest(), slow: slow, loops: loopCount }; },
    level: level,
    util: util,
    /* 깜빡임 방지용 부트 스니펫: <head>에 인라인으로 넣으면 core가 시작할 때(또는 2.5초 뒤) 풀린다 */
    boot: "document.documentElement.classList.add('fx-boot');setTimeout(function(){document.documentElement.classList.remove('fx-boot')},2500)"
  };
  w.LecFX = api;

  if (html.getAttribute('data-fx-autostart') !== 'off') {
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { start(); });
    else setTimeout(function () { if (!started) start(); }, 0);
  }
})(window, document);
