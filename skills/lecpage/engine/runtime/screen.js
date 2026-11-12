/* lecpage screen — 발표 화면: 참여 QR, 공지, 큰 타이머, 신호등, 인기 질문, 투표 결과, 반응.
 * '도구'(이름 뽑기·모둠 만들기·타이머 여러 개)는 실시간 연결 없이도 이 화면 안에서 동작합니다(기록은 이 기기에만). */
(function () {
  'use strict';
  var doc = document, $ = function (s, r) { return (r || doc).querySelector(s); };
  var DATA = {}, BP = {};
  try { DATA = JSON.parse($('#lp-data').textContent); BP = JSON.parse($('#lp-blueprint').textContent); } catch (e) { }
  function el(tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  function btn(text, cls, fn) { var b = el('button', 'lp-btn lp-btn-sm ' + (cls || 'lp-btn-ghost'), text); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  var RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var NS = (DATA.key || 'lp') + ':screen:';
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(NS + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { } }
  };
  var tt; function toast(m) { var t = $('[data-toast]'); if (!t) return; t.textContent = m; t.classList.add('is-on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('is-on'); }, 2600); }
  function rnd(n) { try { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; } catch (e) { return Math.floor(Math.random() * n); } }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function mmss(ms) { var s = Math.round(ms / 1000), a = Math.abs(s); return (s < 0 ? '-' : '') + Math.floor(a / 60) + ':' + String(a % 60).padStart(2, '0'); }

  // ── 참여 QR·주소(파일로 열었거나 미리보기면 안내 문구, 암호 보호면 #k=는 QR에만) ──
  // 손으로 칠 주소는 강사가 넣은 짧은 주소가 있으면 그것을 크게, 원래 주소는 그 아래 작게. QR은 언제나 원래 주소(짧은 주소 서비스가 멈춰도 열림).
  var LOCAL = /^(file|about|blob|data):$/.test(location.protocol);
  // 원래 주소(QR): 파일로 열었으면 모름. 그때 보여 줄 글자만 짧은 주소로(짧은 주소는 QR에 넣지 않음 — 중간 화면이 있는 서비스에는 #k=가 보임)
  var siteUrl = DATA.siteUrl || (LOCAL ? '' : location.href.split('#')[0].replace(/screen\.html.*$/, ''));
  var joinUrl = siteUrl || (LOCAL ? DATA.shortUrl || '' : '');
  var ul = $('meta[name="lp-unlock"]'), qrUrl = siteUrl ? siteUrl.split('#')[0] + (ul && ul.getAttribute('content') ? '#' + ul.getAttribute('content') : '') : '';
  function bare(u) { var s = String(u || '').replace(/^https?:\/\//, '').replace(/\/$/, ''); try { return decodeURI(s); } catch (e) { return s; } }
  var fullUrl = bare(joinUrl), shortUrl = bare(DATA.shortUrl); if (!fullUrl || shortUrl === fullUrl) shortUrl = '';
  var qrMarkup = '';
  // 둘레 여백 4칸(QR 규격의 quiet zone)을 그림 안에 넣음
  if (qrUrl && window.qrcode) { try { if (qrcode.stringToBytesFuncs) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']; var qq = qrcode(0, 'M'); qq.addData(qrUrl); qq.make(); qrMarkup = qq.createSvgTag({ cellSize: 6, margin: 24, scalable: true }); } catch (e) { } }
  var q = $('[data-qr-join]');
  if (q) {
    if (qrMarkup) q.innerHTML = qrMarkup;
    else if (!qrUrl) q.appendChild(el('span', 'lp-qr-off', '인터넷에 올리면 QR이 나와요.'));
  }
  [].forEach.call(doc.querySelectorAll('[data-join-url]'), function (n) { n.textContent = shortUrl || fullUrl || '인터넷에 올리면 여기에 참가자 주소와 QR이 나와요.'; });
  [].forEach.call(doc.querySelectorAll('[data-join-full]'), function (n) { n.hidden = !shortUrl; n.textContent = shortUrl ? fullUrl : ''; });
  // QR 크게 보기: 뒷자리에서도 찍히게 화면 가득(QR 한 변은 찍는 거리의 1/10쯤이 필요)
  var zoom = $('[data-join-zoom]'), big = $('[data-joinbig]');
  if (zoom && big) {
    if (!qrMarkup || !big.showModal) { zoom.disabled = true; var zt = $('.lp-qr-zoom-t', zoom); if (zt) zt.hidden = true; }
    else {
      zoom.addEventListener('click', function () { var bq = $('[data-qr-big]', big); if (bq && !bq.firstChild) bq.innerHTML = qrMarkup; big.showModal(); });
      big.addEventListener('click', function (e) { if (e.target === big) big.close(); });
    }
  }

  // ── 무대: 뽑힌 이름·모둠을 크게 ──
  var stage = $('[data-tool-stage]');
  function showStage(title, node) {
    if (!stage) return;
    $('[data-stage-title]', stage).textContent = title;
    var body = $('[data-stage-body]', stage); body.textContent = ''; body.appendChild(node);
    stage.hidden = false;
  }
  if (stage) $('[data-stage-close]', stage).addEventListener('click', function () { stage.hidden = true; var o = $('[data-tools-open]'); if (o) o.focus(); });

  // ── 도구 서랍 ──
  var drawer = $('[data-tools]'), opener = $('[data-tools-open]');
  function setDrawer(open) {
    if (!drawer) return;
    drawer.hidden = !open; if (opener) opener.setAttribute('aria-expanded', String(open));
    doc.body.classList.toggle('lp-tools-on', open);
    if (open) { var h = $('#lp-tools-h'); if (h) h.focus(); } else if (opener) opener.focus();
  }
  if (drawer && opener) {
    opener.addEventListener('click', function () { setDrawer(drawer.hidden); });
    $('[data-tools-close]', drawer).addEventListener('click', function () { setDrawer(false); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !drawer.hidden) setDrawer(false); });
  }
  var tbody = drawer && $('[data-tools-body]', drawer);
  var conn = null, X = null, canWrite = false, lastTimers = null;

  // 이름 뽑기: 한 번 뽑힌 사람은 모두 뽑힐 때까지 다시 나오지 않아요
  var namesTa, pickInfo, picked = store.get('picked', []);
  function names() { var seen = {}; return String(namesTa ? namesTa.value : '').split(/[\n,]+/).map(function (x) { return x.trim(); }).filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; }); }
  function pickStatus() { var all = names(), left = all.filter(function (n) { return picked.indexOf(n) < 0; }).length; if (pickInfo) pickInfo.textContent = all.length ? '남은 사람 ' + left + '명 / 전체 ' + all.length + '명' : '이름을 적거나 불러와 주세요.'; }
  function pick() {
    var all = names();
    if (!all.length) { toast('이름 목록을 먼저 적어 주세요.'); namesTa.focus(); return; }
    var left = all.filter(function (n) { return picked.indexOf(n) < 0; });
    if (!left.length) { picked = []; left = all; toast('모두 한 번씩 뽑혔어요. 처음부터 다시 뽑아요.'); }
    var name = left[rnd(left.length)]; picked.push(name); store.set('picked', picked); pickStatus();
    var big = el('p', 'lp-pick'); showStage('이름 뽑기', big);
    if (RM || all.length < 2) { big.textContent = name; return; }
    stage.setAttribute('aria-busy', 'true'); big.classList.add('is-rolling');
    var n = 0, iv = setInterval(function () {
      big.textContent = all[rnd(all.length)];
      if (++n >= 10) { clearInterval(iv); big.textContent = name; big.classList.remove('is-rolling'); stage.removeAttribute('aria-busy'); }
    }, 80);
  }
  function makeGroups(k) {
    var all = shuffle(names());
    if (all.length < 2) { toast('이름이 두 명 이상 있어야 모둠을 만들 수 있어요.'); namesTa.focus(); return; }
    k = Math.max(2, Math.min(20, k | 0 || 4, all.length));
    var gs = []; for (var i = 0; i < k; i++) gs.push([]);
    all.forEach(function (nm, i) { gs[i % k].push(nm); });
    store.set('groups', gs);
    var grid = el('div', 'lp-groups');
    gs.forEach(function (g, i) { var c = el('section', 'lp-group'); c.appendChild(el('h3', '', (i + 1) + '모둠 · ' + g.length + '명')); var ulx = el('ul'); g.forEach(function (nm) { ulx.appendChild(el('li', '', nm)); }); c.appendChild(ulx); grid.appendChild(c); });
    showStage('모둠 ' + k + '개', grid);
  }
  function loadNicknames() {
    if (!conn) return;
    conn.list('participants', {}).then(function (a) {
      var nn = (a || []).map(function (p) { return p.nickname; }).filter(Boolean);
      if (!nn.length) return toast('아직 참여한 사람이 없어요.');
      namesTa.value = nn.join('\n'); store.set('names', namesTa.value); picked = []; store.set('picked', picked); pickStatus(); toast('참가자 별명 ' + nn.length + '명을 불러왔어요.');
    }, function () { toast('참가자 별명은 강사 화면에서 연 발표 화면에서만 불러올 수 있어요.'); });
  }

  // 타이머 여러 개: [{id, label, dur, endsAt, remaining, running}]
  var timers = store.get('timers', []), tStrip = $('[data-timers]'), tList, tIv, overSaid = {};
  function tNow() { return conn && conn.now ? conn.now() : Date.now(); }
  function left(t) { return t.running ? t.endsAt - tNow() : t.remaining; }
  function saveTimers(sync) {
    store.set('timers', timers); drawTimers();
    if (sync && conn && canWrite && X) {
      lastTimers = X.timersValue(timers.map(function (t) { return { label: t.label, endsAt: t.running ? t.endsAt : 0, remaining: t.running ? 0 : t.remaining, running: t.running }; }));
      conn.setState({ ui: { timers: lastTimers } }).catch(function () { canWrite = false; });
    }
  }
  function drawTimers() {
    clearInterval(tIv);
    if (tStrip) {
      tStrip.textContent = ''; tStrip.hidden = !timers.length;
      timers.forEach(function (t) {
        var c = el('div', 'lp-timer-card'); c.setAttribute('role', 'timer'); c.appendChild(el('span', '', t.label)); c.appendChild(el('b')); tStrip.appendChild(c); t._card = c;
      });
    }
    if (tList) {
      tList.textContent = '';
      if (!timers.length) tList.appendChild(el('li', 'lp-small', '타이머를 더하면 화면에 크게 보여요.'));
      timers.forEach(function (t) {
        var li = el('li'); li.appendChild(el('span', '', t.label)); var b = el('b'); li.appendChild(b); t._row = b;
        li.appendChild(btn(t.running ? '멈춤' : '시작', t.running ? '' : 'lp-btn-primary', function () {
          if (t.running) { t.remaining = Math.max(0, t.endsAt - tNow()); t.running = false; } else { if (t.remaining <= 0) t.remaining = t.dur; t.endsAt = tNow() + t.remaining; t.running = true; overSaid[t.id] = 0; }
          saveTimers(true);
        }));
        li.appendChild(btn('처음으로', '', function () { t.running = false; t.remaining = t.dur; overSaid[t.id] = 0; saveTimers(true); }));
        var rm = btn('지우기', '', function () { timers = timers.filter(function (x) { return x !== t; }); saveTimers(true); }); rm.setAttribute('aria-label', t.label + ' 지우기'); li.appendChild(rm);
        tList.appendChild(li);
      });
    }
    tick();
    if (timers.some(function (t) { return t.running; })) tIv = setInterval(tick, 500);
  }
  function tick() {
    timers.forEach(function (t) {
      var l = left(t), txt = mmss(l), over = t.running && l <= 0;
      if (t._card) { t._card.querySelector('b').textContent = txt; t._card.classList.toggle('is-over', over); t._card.classList.toggle('is-paused', !t.running); t._card.setAttribute('aria-label', t.label + (over ? ' 시간이 다 됐어요' : ' 남은 시간 ' + txt)); }
      if (t._row) t._row.textContent = txt;
      if (over && !overSaid[t.id]) { overSaid[t.id] = 1; toast(t.label + ' 시간이 다 됐어요.'); }
    });
  }
  function adoptTimers(st) {
    if (!X) return;
    var raw = (st.ui || {}).timers || null;
    if (raw === lastTimers) return;
    lastTimers = raw;
    timers = X.timers(st).map(function (t, i) { var rem = t.running ? Math.max(0, t.endsAt - tNow()) : t.remaining; return { id: 's' + i + Date.now(), label: t.label || (i + 1) + '번 타이머', dur: rem || 60000, endsAt: t.endsAt, remaining: rem, running: t.running }; });
    store.set('timers', timers); drawTimers();
  }

  function section(title) { var s = el('section', 'lp-tool'); s.appendChild(el('h3', '', title)); tbody.appendChild(s); return s; }
  if (tbody) {
    var s1 = section('이름 뽑기');
    var lab = el('label'); lab.appendChild(el('span', '', '이름 목록(한 줄에 한 명, 쉼표로 나눠도 돼요)'));
    namesTa = el('textarea'); namesTa.rows = 5; namesTa.value = store.get('names', ''); lab.appendChild(namesTa); s1.appendChild(lab);
    namesTa.addEventListener('input', function () { store.set('names', namesTa.value); pickStatus(); });
    var r1 = el('div', 'lp-row');
    r1.appendChild(btn('한 명 뽑기', 'lp-btn-primary', pick));
    r1.appendChild(btn('처음부터 다시', '', function () { picked = []; store.set('picked', picked); pickStatus(); toast('뽑은 기록을 지웠어요.'); }));
    if (DATA.live) r1.appendChild(btn('참가자 별명 불러오기', '', loadNicknames));
    s1.appendChild(r1);
    pickInfo = el('p', 'lp-small'); s1.appendChild(pickInfo); pickStatus();

    var s2 = section('모둠 만들기');
    var r2 = el('div', 'lp-row'); var gl = el('label', 'lp-row'); gl.appendChild(el('span', '', '모둠 수')); var gn = el('input'); gn.type = 'number'; gn.min = 2; gn.max = 20; gn.value = store.get('groupCount', 4); gn.style.width = '6em'; gl.appendChild(gn); r2.appendChild(gl);
    gn.addEventListener('change', function () { store.set('groupCount', +gn.value || 4); });
    r2.appendChild(btn('무작위로 나누기', 'lp-btn-primary', function () { makeGroups(+gn.value); }));
    s2.appendChild(r2); s2.appendChild(el('p', 'lp-small', '위 이름 목록을 섞어서 나눠요.'));

    var s3 = section('타이머');
    var tf = el('form', 'lp-row'); var tl = el('input'); tl.placeholder = '이름(예: 1모둠)'; tl.maxLength = 12; tl.setAttribute('aria-label', '타이머 이름');
    var tm = el('input'); tm.type = 'number'; tm.min = 1; tm.max = 180; tm.value = 5; tm.style.maxWidth = '5.5em'; tm.setAttribute('aria-label', '분');
    var add = el('button', 'lp-btn lp-btn-primary lp-btn-sm', '더하기'); add.type = 'submit';
    tf.appendChild(tl); tf.appendChild(tm); tf.appendChild(el('span', '', '분')); tf.appendChild(add); s3.appendChild(tf);
    tf.addEventListener('submit', function (e) {
      e.preventDefault();
      if (timers.length >= 6) return toast('타이머는 6개까지 둘 수 있어요.');
      var m = Math.max(1, Math.min(180, +tm.value || 5)), dur = Math.round(m * 60000);
      timers.push({ id: 't' + Date.now(), label: tl.value.trim() || (timers.length + 1) + '번 타이머', dur: dur, remaining: dur, endsAt: 0, running: false });
      tl.value = ''; saveTimers(true);
    });
    tList = el('ul', 'lp-tlist'); s3.appendChild(tList);
  }
  drawTimers();

  if (!DATA.live || !window.LecLive) return;

  // ── 실시간 ──
  X = LecLive.util.ext;
  var U = LecLive.util;
  var key = ''; try { key = sessionStorage.getItem('lp-admin:' + location.pathname.replace(/[^/]*$/, '') + ':' + DATA.live.code) || ''; } catch (e) { }
  try { conn = LecLive.create(Object.assign({}, DATA.live, key ? { adminKey: key } : {})); } catch (e) { return; }
  canWrite = DATA.live.provider === 'local' || !!key;
  var state = {}, qs = {}, answers = {}, tiv;
  var polls = []; (BP.sections || []).forEach(function (s) { if (s.type === 'poll' && s.items) polls = polls.concat(s.items); });
  var SIG = [['green', 'g', '✓', '이해했어요'], ['yellow', 'y', '?', '조금 헷갈려요'], ['red', 'r', '!', '모르겠어요']];
  function drawSignal() {
    var box = $('[data-screen-signal]'); if (!box) return;
    var reset = X.signalReset(state), latest = {}, c = { green: 0, yellow: 0, red: 0 }, total = 0;
    Object.keys(answers).forEach(function (k) { var a = answers[k]; if (a.poll !== 'signal') return; var t = a.updatedAt || a.createdAt || 0; if (t < reset) return; var who = a.by || a.id; if (!latest[who] || t >= (latest[who].updatedAt || latest[who].createdAt || 0)) latest[who] = a; });
    Object.keys(latest).forEach(function (k) { var v = latest[k].value; if (c[v] !== undefined) { c[v]++; total++; } });
    box.hidden = !total; box.textContent = ''; if (!total) return;
    var bar = el('div', 'lp-signal-bar'); bar.setAttribute('aria-hidden', 'true');
    SIG.forEach(function (x) { var i = el('i', x[1]); i.style.width = (c[x[0]] / total * 100) + '%'; bar.appendChild(i); });
    var lg = el('p', 'lp-sig-legend');
    SIG.forEach(function (x) { var s = el('span'); var i = el('i', x[1], x[2]); i.setAttribute('aria-hidden', 'true'); s.appendChild(i); s.appendChild(doc.createTextNode(x[3] + ' ' + c[x[0]])); lg.appendChild(s); });
    box.appendChild(bar); box.appendChild(lg);
  }
  function draw() {
    var n = $('[data-notice]'); if (state.notice && state.notice.text) { n.hidden = false; n.textContent = state.notice.text; } else n.hidden = true;
    var t = $('[data-timer]'); clearInterval(tiv);
    if (state.timer && state.timer.running && state.timer.endsAt) { t.hidden = false; var tk = function () { var l = state.timer.endsAt - tNow(); t.textContent = mmss(l); t.style.color = l <= 0 ? 'var(--danger)' : ''; }; tk(); tiv = setInterval(tk, 1000); } else t.hidden = true;
    drawSignal();
    var main = $('[data-screen-main]'); main.textContent = '';
    var p = polls.filter(function (x) { return x.id === state.openPoll; })[0];
    if (p) {
      main.appendChild(el('h2', 'lp-h2', p.question));
      var list = Object.keys(answers).map(function (k) { return answers[k]; }).filter(function (a) { return a.poll === p.id; }), total = list.length;
      // 결과는 강사가 '결과 공개'를 누른 뒤에만(먼저 보이면 다른 사람 답을 따라가게 됨)
      if (X.revealed && !X.revealed(state, p.id)) { main.appendChild(el('p', 'lp-screen-wait', '응답 ' + total + '명 · 강사가 결과를 공개하면 여기에 보여요')); return; }
      if (p.kind === 'word') {
        var words = U.wordCloud(list, p.id, { hidden: X.hiddenWords(state) }), wt = words.reduce(function (a, w) { return a + w.count; }, 0) || 1;
        var cl = el('div', 'lp-cloud'); words.slice(0, 50).forEach(function (w) { var s = el('span', '', w.word); s.style.fontSize = (1.4 + Math.min(4, w.count / wt * 10)) + 'rem'; cl.appendChild(s); }); main.appendChild(cl);
      } else {
        var tally = {}; list.forEach(function (a) { [].concat(a.value).forEach(function (v) { tally[v] = (tally[v] || 0) + 1; }); });
        var bars = el('div', 'lp-bars'); (p.options.length ? p.options : Object.keys(tally)).forEach(function (o) { var c = tally[o] || 0, r = el('div', 'lp-bar'); r.appendChild(el('span', '', o + ' · ' + c + '명')); var tr = el('div', 'lp-bar-track'); tr.style.height = '22px'; var f = el('div', 'lp-bar-fill'); f.style.setProperty('--w', Math.round(c / Math.max(total, 1) * 100) + '%'); tr.appendChild(f); r.appendChild(tr); bars.appendChild(r); }); main.appendChild(bars);
      }
      main.appendChild(el('p', 'lp-small', '응답 ' + total + '명'));
      return;
    }
    var arr = Object.keys(qs).map(function (k) { return qs[k]; }).filter(function (x) { return x.status === 'open' || x.pinned; }).sort(function (a, b) { return (!!b.pinned - !!a.pinned) || (b.votes || 0) - (a.votes || 0); }).slice(0, 6);
    if (!arr.length) { main.appendChild(el('p', 'lp-empty', '질문과 투표 결과가 여기에 크게 보여요.')); return; }
    main.appendChild(el('h2', 'lp-h2', '질문'));
    var ulq = el('ul', 'lp-qa-list'); arr.forEach(function (x) { var li = el('li', 'lp-qa-item' + (x.pinned ? ' is-pinned' : '')); var v = el('div', 'lp-vote'); v.appendChild(el('b', '', String(x.votes || 0))); v.setAttribute('aria-label', '공감 ' + (x.votes || 0)); li.appendChild(v); li.appendChild(el('p', '', x.text)); ulq.appendChild(li); }); main.appendChild(ulq);
  }
  function react(e) { var h = $('[data-reactions]'); if (!h || RM) return; var s = el('span', '', e); s.style.left = Math.round(Math.random() * 30) + 'px'; s.style.fontSize = '3rem'; h.appendChild(s); setTimeout(function () { s.remove(); }, 2700); }
  conn.connect().then(function () {
    conn.subscribe(function (ev) {
      if (!ev) return;
      if (ev.type === 'state') { state = ev.doc || ev.state || {}; adoptTimers(state); return draw(); }
      if (ev.type === 'reaction') return react((ev.doc && ev.doc.emoji) || ev.emoji);
      if (ev.type === 'reset') { qs = {}; answers = {}; return draw(); }
      var bag = ev.col === 'questions' ? qs : ev.col === 'answers' ? answers : null; if (!bag || !ev.doc) return;
      if (ev.type === 'remove') delete bag[ev.doc.id]; else bag[ev.doc.id] = Object.assign(bag[ev.doc.id] || {}, ev.doc); draw();
    });
    return Promise.all([conn.getState().then(function (s) { state = s || {}; adoptTimers(state); }), conn.list('questions', {}).then(function (a) { (a || []).forEach(function (d) { qs[d.id] = d; }); }), conn.list('answers', {}).then(function (a) { (a || []).forEach(function (d) { answers[d.id] = d; }); })].map(function (p) { return p.catch(function () { }); }));
  }).then(draw, draw);
})();
