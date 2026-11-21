/* 그림책 한 장, 마음 한 뼘 — 표지 넘기기, 콜라주 시차, 콩이(스크롤에 반응하는 참새), 그림책 넘기기, 마음 이름 카드, 지금 시각 */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!still) root.classList.add('motion');
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* 저장 못 해도 괜찮음 */ } }
  };

  // ── 참새 모양(교재 그림과 같은 식) ─────────────────
  var O = [100, 108], BODY = [94, 114, 61, 48], HEAD = [145, 76, 35];
  function smooth(p) {
    var n = p.length, d = 'M' + p[0][0].toFixed(1) + ' ' + p[0][1].toFixed(1);
    for (var i = 0; i < n; i++) {
      var p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
      d += 'C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d + 'Z';
  }
  function body(puff) {
    var pts = [], n = 44;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 - Math.PI / 2, dx = Math.cos(a), dy = Math.sin(a);
      var ex = O[0] - BODY[0], ey = O[1] - BODY[1], rx = BODY[2], ry = BODY[3];
      var A = Math.pow(dx / rx, 2) + Math.pow(dy / ry, 2), B = 2 * ((ex * dx) / (rx * rx) + (ey * dy) / (ry * ry)), C = Math.pow(ex / rx, 2) + Math.pow(ey / ry, 2) - 1;
      var te = (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
      var cx = O[0] - HEAD[0], cy = O[1] - HEAD[1], b2 = cx * dx + cy * dy, c2 = cx * cx + cy * cy - HEAD[2] * HEAD[2], disc = b2 * b2 - c2;
      var t = Math.max(te, disc > 0 ? -b2 + Math.sqrt(disc) : 0);
      var back = 0.6 + 0.4 * Math.max(0, -dx), top = 0.7 + 0.3 * Math.max(0, -dy);
      t *= 1 + puff * 0.1 * back;
      if (puff) t += puff * (i % 2 ? -2 : 7.5) * top;
      pts.push([O[0] + dx * t, O[1] + dy * t]);
    }
    return smooth(pts);
  }
  var EYE = {
    calm: '<circle cx="160" cy="71" r="5.6" fill="#241c18"/><circle cx="162" cy="69" r="1.9" fill="#fff"/>',
    happy: '<path d="M153.5 73Q160 64.5 166.5 73" fill="none" stroke="#241c18" stroke-width="3.4" stroke-linecap="round"/>',
    upset: '<circle cx="160" cy="72" r="5.6" fill="#241c18"/><circle cx="162" cy="70" r="1.9" fill="#fff"/><path d="M150 60L169 65.5" stroke="#241c18" stroke-width="3.4" stroke-linecap="round"/>',
    sad: '<circle cx="160" cy="73" r="5.4" fill="#241c18"/><path d="M153.6 69.5H166.4" stroke="#b97a45" stroke-width="5"/><path d="M151 64L167 59.5" stroke="#241c18" stroke-width="3" stroke-linecap="round"/>',
    closed: '<path d="M153.5 70Q160 77 166.5 70" fill="none" stroke="#241c18" stroke-width="3.4" stroke-linecap="round"/>',
    wow: '<circle cx="160" cy="71" r="7.4" fill="#241c18"/><circle cx="162.6" cy="68.4" r="2.6" fill="#fff"/>'
  };
  var BEAK_OPEN = '<path d="M177 69L199 72L178 77Z" fill="#3a2c25"/><path d="M178 80L194 84L177 87Z" fill="#3a2c25"/>';
  var BEAK = '<path d="M177 69L200 77L177 85Z" fill="#3a2c25"/>';
  /** 새 한 마리 다루기: g.bird 요소 */
  function Bird(g) {
    var self = { g: g, puff: 0, mood: '', raf: 0 };
    var paths = g ? $$('.b-body,.b-line,.b-clipd', g) : [];
    self.setPuff = function (p) { self.puff = p; var d = body(p); paths.forEach(function (n) { n.setAttribute('d', d); }); };
    self.face = function (m) {
      if (!g || m === self.mood) return; self.mood = m;
      var e = $('.b-eye', g), b = $('.b-beak', g), bl = $('.b-blush', g);
      if (e) e.innerHTML = EYE[m] || EYE.calm;
      if (b) b.innerHTML = (m === 'wow' || m === 'chirp') ? BEAK_OPEN : BEAK;
      if (bl) bl.setAttribute('opacity', (m === 'happy' || m === 'calm') ? '.85' : '0');
    };
    self.to = function (p, ms, done) {
      cancelAnimationFrame(self.raf);
      if (still || !ms) { self.setPuff(p); if (done) done(); return; }
      var from = self.puff, t0 = performance.now();
      var step = function (t) {
        var k = Math.min(1, (t - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        self.setPuff(from + (p - from) * e);
        if (k < 1) self.raf = requestAnimationFrame(step); else if (done) done();
      };
      self.raf = requestAnimationFrame(step);
    };
    return self;
  }

  // ── 차례(휴대폰) ───────────────────────────────────
  var menu = $('[data-menu]'), sheet = $('#sheet');
  if (menu && sheet) {
    var setMenu = function (open) { sheet.hidden = !open; menu.setAttribute('aria-expanded', String(open)); };
    menu.addEventListener('click', function () { setMenu(sheet.hidden); });
    sheet.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) { setMenu(false); menu.focus(); } });
    document.addEventListener('click', function (e) { if (!sheet.hidden && !e.target.closest('#sheet,[data-menu]')) setMenu(false); });
  }

  // ── 표지: 처음 한 번만 넘어감 ─────────────────────
  var hero = $('.hero'), cover = $('[data-cover]');
  var first = !still && !store.get('ph-open');
  if (cover && first) {
    cover.hidden = false;
    hero.style.setProperty('--d0', '1050ms');
    requestAnimationFrame(function () { cover.classList.add('go'); });
    cover.addEventListener('animationend', function (e) { if (e.animationName === 'coverOff') cover.remove(); });
    store.set('ph-open', '1');
  } else if (cover) cover.remove();
  if (!first && hero) hero.style.setProperty('--d0', '0ms');

  // ── 첫 화면 무대: 층마다 시차 ─────────────────────
  var stage = $('[data-stage]');
  var layers = stage ? $$('.layer', stage) : [];
  layers.forEach(function (l, i) { l.style.setProperty('--i', i); });
  if (stage && !still) {
    var px = 0, py = 0, tx = 0, ty = 0, sy = 0, rafP = 0, onScreen = true;
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var paint = function () {
      rafP = 0; px += (tx - px) * 0.08; py += (ty - py) * 0.08;
      layers.forEach(function (l) {
        var d = +l.getAttribute('data-depth') || 0;
        l.style.transform = 'translate3d(' + (px * d * 16).toFixed(2) + 'px,' + (py * d * 12 - sy * d * 0.12).toFixed(2) + 'px,0)';
      });
      if (Math.abs(tx - px) > 0.002 || Math.abs(ty - py) > 0.002) rafP = requestAnimationFrame(paint);
    };
    var kick = function () { if (!rafP && onScreen) rafP = requestAnimationFrame(paint); };
    if (fine) hero.addEventListener('pointermove', function (e) { var r = stage.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5; kick(); });
    if (fine) hero.addEventListener('pointerleave', function () { tx = 0; ty = 0; kick(); });
    window.addEventListener('scroll', function () { if (!onScreen) return; sy = Math.min(window.scrollY, 900); px += 0.0001; kick(); }, { passive: true });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; stage.classList.toggle('is-off', !onScreen); }).observe(stage);
  }

  // ── 첫 화면 콩이: 누르면 마음이 바뀜 ──────────────
  var kongBtn = $('[data-kong]'), say = $('[data-kong-say]');
  var kong = Bird($('.ly-kong .bird'));
  var MOODS = [['happy', 0, '설레요'], ['wow', 0.15, '깜짝이야'], ['upset', 1, '속상해'], ['sad', 0, '서운해'], ['calm', 0, '편안해']];
  var mi = 0;
  if (kongBtn && kong.g) {
    kongBtn.addEventListener('click', function () {
      mi = (mi + 1) % MOODS.length;
      var m = MOODS[mi];
      kong.face(m[0]); kong.to(m[1], 650);
      if (say) { say.textContent = m[2]; var b = say.parentNode; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
      kongBtn.setAttribute('aria-label', '콩이 마음 바꾸기, 지금은 ' + m[2]);
    });
  }
  // 깜빡임(4~6초마다, 화면에 있을 때만)
  if (!still && kong.g) {
    (function blink() {
      setTimeout(function () {
        if (!document.hidden && kong.mood !== 'upset' && kong.mood !== 'closed') {
          var keep = kong.mood || 'happy'; kong.face('closed');
          setTimeout(function () { kong.face(keep); }, 140);
        }
        blink();
      }, 4000 + Math.random() * 2000);
    })();
  }

  // ── 머리 막대의 콩이: 스크롤에 반응 ──────────────
  var mascot = Bird($('[data-mascot] .bird'));
  var mz = $('[data-mascot] .bird');
  var secMood = 'happy', lastY = window.scrollY, lastT = performance.now(), idle = 0, ruffled = false;
  if (mascot.g) {
    mascot.face('happy');
    window.addEventListener('scroll', function () {
      var now = performance.now(), y = window.scrollY, dy = y - lastY, v = Math.abs(dy) / Math.max(16, now - lastT);
      lastY = y; lastT = now;
      if (!still && v > 2.2 && !ruffled) { ruffled = true; mascot.face('wow'); mascot.to(0.85, 220); mz.style.transform = 'translateY(-4px) rotate(' + (dy > 0 ? -7 : 7) + 'deg)'; }
      clearTimeout(idle);
      idle = setTimeout(function () { ruffled = false; mascot.to(0, 380); mascot.face(secMood); mz.style.transform = ''; }, 260);
    }, { passive: true });
  }
  // 섹션마다 마음(+ 위쪽 차례에 지금 섹션 표시)
  var navLinks = $$('.nav a');
  if ('IntersectionObserver' in window) {
    var secs = $$('[data-mood]');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        secMood = e.target.getAttribute('data-mood') || 'happy';
        if (!ruffled && mascot.g) { mascot.face(secMood); }
        var id = e.target.id;
        if (id) navLinks.forEach(function (a) { var on = a.getAttribute('href') === '#' + id || (id.indexOf('st-') === 0 && a.getAttribute('href') === '#lab'); a.toggleAttribute('aria-current', on); if (on) a.setAttribute('aria-current', 'true'); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(function (s) { io.observe(s); });
  }
  // 연필 줄(스크롤 진행): 스크롤 타임라인이 없는 브라우저
  if (!(window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()'))) {
    var pen = function () { var h = document.documentElement.scrollHeight - innerHeight; root.style.setProperty('--prog', h > 0 ? Math.min(1, scrollY / h).toFixed(3) : '0'); };
    window.addEventListener('scroll', pen, { passive: true }); pen();
  }

  // ── 지금 시각: 첫 화면 글·주 단추·차례 표시 ───────
  var DAY = '2026-12-09';
  var SCHED = [
    ['14:30', '14:45', '들어가며 · 마음 체크인', '#join', '출석하기'],
    ['14:45', '15:15', '1부 · 그림책이 마음을 여는 까닭', '#deck', '교재 넘기기'],
    ['15:15', '15:50', '실습 1 · 함께 읽기 질문 세 층', '#st-s1', '실습 1 열기'],
    ['15:50', '16:00', '쉬는 시간', '#st-s2', '실습 2 미리 보기'],
    ['16:00', '16:30', '실습 2 · 마음 이름 카드', '#st-s2', '실습 2 열기'],
    ['16:30', '17:10', '실습 3 · 그림책 수업 한 장', '#st-s3', '실습 3 열기'],
    ['17:10', '17:30', '마무리 · 과제와 만족도 조사', '#wrap', '설문 열기']
  ];
  var mins = function (hm) { var p = hm.split(':'); return +p[0] * 60 + +p[1]; };
  function tick() {
    var now = new Date(), y = now.getFullYear(), mo = String(now.getMonth() + 1).padStart(2, '0'), d = String(now.getDate()).padStart(2, '0');
    var today = y + '-' + mo + '-' + d, m = now.getHours() * 60 + now.getMinutes();
    var txt = $('[data-clock-text]'), cta = $('[data-cta]'), ctaT = $('[data-cta-t]');
    var cur = -1, msg = '', nxt = '', href = '#flow', label = '오늘의 흐름 보기';
    if (today < DAY) { msg = '12월 9일(수) 14:30에 시작해요.'; nxt = '오면 출석하고 지금 마음의 색을 골라요.'; }
    else if (today > DAY) { msg = '연수가 끝났어요. 과제 마감은 12월 23일(수)이에요.'; nxt = '수업 한 장과 마음 낱말 세 개를 나눔 보드에 올려요.'; href = '#wrap'; label = '과제 보기'; }
    else if (m < mins('14:30')) { msg = '오늘 14:30에 시작해요.'; nxt = '오면 출석하고 지금 마음의 색을 골라요.'; href = '#join'; label = '출석하기'; }
    else if (m >= mins('17:30')) { msg = '오늘 연수를 마쳤어요.'; nxt = '만족도 조사를 내야 이수돼요.'; href = '#wrap'; label = '설문 열기'; }
    else SCHED.forEach(function (s, i) { if (m >= mins(s[0]) && m < mins(s[1])) { cur = i; msg = '지금 ' + s[2] + ' · ' + s[1] + '까지'; nxt = SCHED[i + 1] ? '다음 ' + SCHED[i + 1][0] + ' ' + SCHED[i + 1][2] : '끝나면 만족도 조사를 내요.'; href = s[3]; label = s[4]; } });
    if (txt && msg) txt.textContent = msg;
    var nx = $('[data-clock-next]'); if (nx && nxt) nx.textContent = nxt;
    if (cta) { cta.setAttribute('href', href); if (ctaT) ctaT.textContent = label; }
    $$('.toc li').forEach(function (li, i) { li.classList.toggle('is-now', i === cur); });
    var needle = $('[data-needle]');
    if (needle) {
      if (today === DAY && m >= mins('14:30') && m < mins('17:30')) { needle.hidden = false; needle.style.left = ((m - mins('14:30')) / 180 * 100).toFixed(2) + '%'; }
      else needle.hidden = true;
    }
  }
  tick(); setInterval(tick, 30000);

  // ── 그림책 넘기기 ─────────────────────────────────
  var bookEl = $('[data-book]');
  if (bookEl) {
    var pages = $('[data-pages]', bookEl), spreads = $$('.pb-spread', bookEl), cur = 0, busy = false;
    var prev = $('[data-prev]', bookEl), next = $('[data-next]', bookEl), count = $('[data-cur]', bookEl);
    spreads.forEach(function (s, i) { s.setAttribute('aria-hidden', i ? 'true' : 'false'); if (i) s.inert = true; });
    var show = function (n) {
      spreads.forEach(function (s, i) { var on = i === n; s.classList.toggle('is-cur', on); s.setAttribute('aria-hidden', on ? 'false' : 'true'); s.inert = !on; });
      cur = n; count.textContent = n + 1; prev.disabled = n === 0; next.disabled = n === spreads.length - 1;
      $$('[data-st-link]').forEach(function (a) { a.classList.toggle('is-tab', a.getAttribute('data-st-link') === spreads[n].getAttribute('data-lp-step')); });
    };
    var wide = function () { return window.matchMedia('(min-width: 900px)').matches; };
    var go = function (n) {
      if (busy || n < 0 || n >= spreads.length || n === cur) return;
      if (still || !('animate' in Element.prototype)) { show(n); return; }
      busy = true;
      var dir = n > cur ? 1 : -1, from = spreads[cur], to = spreads[n];
      var pr = pages.getBoundingClientRect(), fr = from.getBoundingClientRect();
      var leaf = document.createElement('div'); leaf.className = 'pb-leaf'; leaf.setAttribute('aria-hidden', 'true');
      var f = document.createElement('div'), b = document.createElement('div'); f.className = 'lf-f'; b.className = 'lf-b';
      leaf.appendChild(f); leaf.appendChild(b);
      var top = fr.top - pr.top, left = fr.left - pr.left, W = fr.width, H = fr.height;
      var art = function (s) { return $('.pb-l', s); }, text = function (s) { return $('.pb-r', s); };
      var put = function (box, el, r) { var c = el.cloneNode(true); c.style.cssText = 'position:absolute;left:' + (r.left - (box.left)) + 'px;top:' + (r.top - box.top) + 'px;width:' + r.width + 'px;height:' + r.height + 'px;margin:0'; return c; };
      var half = wide();
      // 받침: 새 장을 밑에 깔고, 옛 장은 넘어가지 않는 쪽만 보이게
      to.style.visibility = 'visible';
      from.style.zIndex = 2; to.style.zIndex = 1;
      if (half) {
        var ar = art(from).getBoundingClientRect(), tr = text(from).getBoundingClientRect();
        var gut = tr.left; // 가운데 접힌 곳
        var lw = gut - fr.left, rw = fr.right - gut;
        if (dir > 0) {
          from.style.clipPath = 'inset(0 ' + rw + 'px 0 0)';
          leaf.style.cssText = 'left:' + (left + lw) + 'px;top:' + top + 'px;width:' + rw + 'px;height:' + H + 'px;transform-origin:0 50%';
          var box = { left: gut, top: fr.top };
          f.appendChild(put(box, text(from), tr));
          var tAr = art(to).getBoundingClientRect();
          b.appendChild(put({ left: gut - (tAr.right - tAr.left), top: fr.top }, art(to), { left: gut - tAr.width, top: tAr.top, width: tAr.width, height: tAr.height }));
          b.firstChild.style.left = (rw - tAr.width) + 'px';
        } else {
          from.style.clipPath = 'inset(0 0 0 ' + lw + 'px)';
          leaf.style.cssText = 'left:' + left + 'px;top:' + top + 'px;width:' + lw + 'px;height:' + H + 'px;transform-origin:100% 50%';
          f.appendChild(put({ left: fr.left, top: fr.top }, art(from), ar));
          var tTr = text(to).getBoundingClientRect();
          b.appendChild(put({ left: fr.left, top: fr.top }, text(to), { left: fr.left, top: tTr.top, width: tTr.width, height: tTr.height }));
        }
        f.style.background = b.style.background = '#fcf6ea';
      } else {
        from.style.visibility = 'hidden';
        leaf.style.cssText = 'left:' + left + 'px;top:' + top + 'px;width:' + W + 'px;height:' + H + 'px;transform-origin:0 50%';
        var c1 = (dir > 0 ? from : to).cloneNode(true); c1.style.cssText = 'position:absolute;inset:0;visibility:visible;margin:0'; c1.removeAttribute('inert'); f.appendChild(c1);
        f.style.background = b.style.background = '#fcf6ea';
        if (dir < 0) { to.style.visibility = 'hidden'; from.style.visibility = 'visible'; from.style.zIndex = 1; }
      }
      pages.appendChild(leaf);
      var kf = half ? (dir > 0 ? [{ transform: 'perspective(2200px) rotateY(0deg)' }, { transform: 'perspective(2200px) rotateY(-180deg)' }] : [{ transform: 'perspective(2200px) rotateY(0deg)' }, { transform: 'perspective(2200px) rotateY(180deg)' }])
        : (dir > 0 ? [{ transform: 'perspective(1600px) rotateY(0deg)', opacity: 1 }, { transform: 'perspective(1600px) rotateY(-100deg)', opacity: 0 }] : [{ transform: 'perspective(1600px) rotateY(-100deg)', opacity: 0 }, { transform: 'perspective(1600px) rotateY(0deg)', opacity: 1 }]);
      var anim = leaf.animate(kf, { duration: half ? 900 : 620, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' });
      var done = function () {
        leaf.remove();
        [from, to].forEach(function (s) { s.style.clipPath = ''; s.style.zIndex = ''; s.style.visibility = ''; });
        show(n); busy = false;
      };
      anim.onfinish = done; anim.oncancel = done;
    };
    prev.addEventListener('click', function () { go(cur - 1); });
    next.addEventListener('click', function () { go(cur + 1); });
    bookEl.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { go(cur + 1); } else if (e.key === 'ArrowLeft') { go(cur - 1); } });
    var sx = 0, sy2 = 0;
    pages.addEventListener('pointerdown', function (e) { sx = e.clientX; sy2 = e.clientY; });
    pages.addEventListener('pointerup', function (e) { var dx = e.clientX - sx, dy = e.clientY - sy2; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(cur + (dx < 0 ? 1 : -1)); });
    // 실습 고르기(#st-s2 링크·주소·지금 시각)
    var idx = function (h) { var m = /^#st-(s\d)\b/.exec(h || ''); if (!m) return -1; for (var i = 0; i < spreads.length; i++) if (spreads[i].getAttribute('data-lp-step') === m[1]) return i; return -1; };
    var stepNow = function () {
      var now = new Date(), t = now.getHours() * 60 + now.getMinutes();
      var today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      if (today !== DAY) return 0;
      return t >= mins('16:30') ? 2 : t >= mins('15:50') ? 1 : 0;
    };
    var first = idx(location.hash); show(first >= 0 ? first : stepNow());
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#st-"]'); if (!a) return;
      var n = idx(a.getAttribute('href')); if (n < 0) return;
      e.preventDefault();
      bookEl.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
      if (n !== cur) setTimeout(function () { go(n); }, still ? 0 : 350);
      if (history.replaceState) history.replaceState(null, '', a.getAttribute('href'));
    });
    window.addEventListener('hashchange', function () { var n = idx(location.hash); if (n >= 0 && n !== cur) show(n); });
  }

  // ── 마음 이름 카드 ─────────────────────────────────
  var cardsEl = $('[data-cards]');
  if (cardsEl) {
    var card = $('[data-card]', cardsEl), flipBtn = $('[data-flip]', cardsEl), drawBtn = $('[data-draw]', cardsEl);
    var fF = $('.card-f', card), fB = $('.card-b', card), wEl = $('[data-card-w]', card), famEl = $('[data-card-fam]', card), pastEl = $('[data-card-past]', card), faceEl = $('[data-face]', card);
    var FAM = { yellow: ['노랑 마음 · 기쁨·설렘', 'joy'], blue: ['파랑 마음 · 슬픔·서운함', 'sad'], red: ['빨강 마음 · 화·답답함', 'angry'], purple: ['보라 마음 · 걱정·긴장', 'fear'] };
    var PAST = { '신나는': '신났어', '뿌듯한': '뿌듯했어', '설레는': '설렜어', '고마운': '고마웠어', '편안한': '편안했어', '즐거운': '즐거웠어', '서운한': '서운했어', '외로운': '외로웠어', '아쉬운': '아쉬웠어', '속상한': '속상했어', '실망한': '실망했어', '그리운': '그리웠어', '짜증 나는': '짜증 났어', '억울한': '억울했어', '답답한': '답답했어', '화나는': '화났어', '질투 나는': '질투 났어', '분한': '분했어', '걱정되는': '걱정됐어', '긴장되는': '긴장됐어', '무서운': '무서웠어', '부끄러운': '부끄러웠어', '당황한': '당황했어', '불안한': '불안했어' };
    var FACES = {
      joy: '<circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M14 18q2-3 4 0M26 18q2-3 4 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M14 26q8 8 16 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
      sad: '<circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="16" cy="19" r="1.9" fill="currentColor"/><circle cx="28" cy="19" r="1.9" fill="currentColor"/><path d="M15 31q7-6 14 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M29 23q2 4 0 6" fill="none" stroke="currentColor" stroke-width="1.6"/>',
      angry: '<circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 14l7 3M32 14l-7 3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="16" cy="20" r="1.9" fill="currentColor"/><circle cx="28" cy="20" r="1.9" fill="currentColor"/><path d="M15 30h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
      fear: '<circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="16" cy="19" r="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="28" cy="19" r="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M14 30q2.5-3 5 0t5 0t5 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
    };
    var chipEls = $$('.chip', cardsEl);
    var flipped = false;
    var setFlip = function (on) {
      flipped = on; card.classList.toggle('is-flipped', on); flipBtn.setAttribute('aria-pressed', String(on));
      flipBtn.textContent = on ? '앞면 보기' : '카드 뒤집기';
      fF.inert = on; fB.inert = !on; fF.setAttribute('aria-hidden', String(on)); fB.setAttribute('aria-hidden', String(!on));
    };
    var deal = function (word, fam) {
      var apply = function () {
        card.className = 'card c-' + fam; wEl.textContent = word; famEl.textContent = FAM[fam][0]; pastEl.textContent = PAST[word] || word;
        faceEl.innerHTML = FACES[FAM[fam][1]];
        $$('[data-temp]', card).forEach(function (t) { t.setAttribute('aria-pressed', 'false'); });
        chipEls.forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-word') === word)); });
        if (!still) { void card.offsetWidth; card.classList.add('deal'); }
      };
      if (flipped) { setFlip(false); setTimeout(apply, still ? 0 : 380); } else apply();
    };
    chipEls.forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-word') === '서운한')); c.addEventListener('click', function () { deal(c.getAttribute('data-word'), c.getAttribute('data-fam')); }); });
    flipBtn.addEventListener('click', function () { setFlip(!flipped); });
    card.addEventListener('click', function (e) { if (!e.target.closest('button')) setFlip(!flipped); });
    drawBtn.addEventListener('click', function () {
      var c = chipEls[Math.floor(Math.random() * chipEls.length)];
      if (still) { deal(c.getAttribute('data-word'), c.getAttribute('data-fam')); return; }
      cardsEl.classList.add('shuffle');
      setTimeout(function () { cardsEl.classList.remove('shuffle'); deal(c.getAttribute('data-word'), c.getAttribute('data-fam')); }, 520);
    });
    $$('[data-temp]', card).forEach(function (t) {
      t.addEventListener('click', function () { var n = +t.getAttribute('data-temp'); $$('[data-temp]', card).forEach(function (o) { o.setAttribute('aria-pressed', String(+o.getAttribute('data-temp') <= n)); }); });
    });
    card.addEventListener('animationend', function () { card.classList.remove('deal'); });
    setFlip(false);
  }
})();
