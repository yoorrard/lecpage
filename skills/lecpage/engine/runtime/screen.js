/* lecpage screen — 발표 화면: 참여 QR, 공지, 큰 타이머, 신호등, 인기 질문, 투표 결과, 반응.
 * 프로젝터·뒷자리에서 읽히게 크게, 넓은 화면에서는 한 화면에 들어가게(넘치는 질문은 개수로만 알림).
 * 참가자가 쓴 글은 textContent로만 넣고, 글 속 주소는 '(링크)'로 가림(프로젝터에 비친 주소가 공식 안내처럼 보이지 않게).
 * '도구'(이름 뽑기·모둠 만들기·타이머 여러 개)는 실시간 연결 없이도 이 화면 안에서 동작합니다(기록은 이 기기에만). */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement, $ = function (s, r) { return (r || doc).querySelector(s); };
  var DATA = {}, BP = {};
  try { DATA = JSON.parse($('#lp-data').textContent); BP = JSON.parse($('#lp-blueprint').textContent); } catch (e) { }
  function el(tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = text; return n; }
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
  /** 참가자 글을 발표 화면에 쓸 때: 주소 가리기 + 길이 자르기(긴 글은 강사 화면에서 다 보임) */
  function shown(s, max) {
    var t = String(s || ''); if (window.LecLive && LecLive.util.linkless) t = LecLive.util.linkless(LecLive.util.cleanText(t, 0, true), '(링크)');
    var c = Array.from ? Array.from(t) : t.split(''); return c.length > max ? c.slice(0, max).join('').replace(/\s+\S*$/, '') + '…' : t;
  }

  // 밝게·어둡게: 강의실 조명에 맞춰(참가자 화면과 같은 저장 값)
  var tb = $('[data-theme-toggle]');
  if (tb) tb.addEventListener('click', function () {
    var cur = root.getAttribute('data-theme'), dark = cur === 'dark' || (cur !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    root.setAttribute('data-theme', dark ? 'light' : 'dark'); try { localStorage.setItem('lp-theme', dark ? 'light' : 'dark'); } catch (e) { }
  });
  // 전체 화면
  var fs = $('[data-fullscreen]');
  if (fs) {
    if (!doc.documentElement.requestFullscreen) fs.hidden = true;
    else {
      fs.addEventListener('click', function () { if (doc.fullscreenElement) doc.exitFullscreen(); else doc.documentElement.requestFullscreen().catch(function () { toast('전체 화면을 열지 못했어요. 브라우저의 F11을 눌러 주세요.'); }); });
      doc.addEventListener('fullscreenchange', function () { var on = !!doc.fullscreenElement; fs.setAttribute('aria-pressed', String(on)); var s = fs.querySelector('span'); if (s) s.textContent = on ? '전체 화면 끝' : '전체 화면'; });
    }
  }

  // ── 참여 QR·주소(파일로 열었거나 미리보기면 안내 문구, 암호 보호면 #k=는 QR에만) ──
  // 손으로 칠 주소는 강사가 넣은 짧은 주소가 있으면 그것을 크게, 원래 주소는 그 아래 작게. QR은 언제나 원래 주소(짧은 주소 서비스가 멈춰도 열림).
  var LOCAL = /^(file|about|blob|data):$/.test(location.protocol);
  var siteUrl = DATA.siteUrl || (LOCAL ? '' : location.href.split('#')[0].split('?')[0].replace(/screen\.html.*$/, ''));
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
  [].forEach.call(doc.querySelectorAll('[data-join-url]'), function (n) { n.textContent = shortUrl || fullUrl || '인터넷에 올리면 여기에 참가자 주소가 나와요.'; });
  [].forEach.call(doc.querySelectorAll('[data-join-full]'), function (n) { n.hidden = !shortUrl; n.textContent = shortUrl ? fullUrl : ''; });
  // QR 크게 보기: 뒷자리에서도 찍히게 화면 가득(QR 한 변은 찍는 거리의 1/10쯤이 필요)
  var zoom = $('[data-join-zoom]'), big = $('[data-joinbig]'), jo = $('[data-join-open]');
  function openBig() { var bq = $('[data-qr-big]', big); if (bq && !bq.firstChild) bq.innerHTML = qrMarkup; big.showModal(); }
  if (zoom && big) {
    if (!qrMarkup || !big.showModal) { zoom.disabled = true; var zt = $('.lp-qr-zoom-t', zoom); if (zt) zt.hidden = true; if (jo) jo.hidden = true; }
    else {
      zoom.addEventListener('click', openBig); if (jo) jo.addEventListener('click', openBig);
      big.addEventListener('click', function (e) { if (e.target === big) big.close(); });
    }
  }

  // ── 무대: 뽑힌 이름·모둠을 크게 ──
  var stage = $('[data-tool-stage]');
  if (stage) stage.className = 'lp-scr-tool';
  function showStage(title, node) {
    if (!stage) return;
    $('[data-stage-title]', stage).textContent = title;
    var body = $('[data-stage-body]', stage); body.textContent = ''; body.appendChild(node);
    stage.hidden = false; fit();
  }
  if (stage) $('[data-stage-close]', stage).addEventListener('click', function () { stage.hidden = true; fit(); var o = $('[data-tools-open]'); if (o) o.focus(); });

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
  function names() { var seen = {}; return String(namesTa ? namesTa.value : '').split(/[\n,]+/).map(function (x) { return x.trim().slice(0, 30); }).filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; }); }
  function pickStatus() { var all = names(), left = all.filter(function (n) { return picked.indexOf(n) < 0; }).length; if (pickInfo) pickInfo.textContent = all.length ? '남은 사람 ' + left + '명 / 전체 ' + all.length + '명' : '이름을 적거나 불러와 주세요.'; }
  function pick() {
    var all = names();
    if (!all.length) { toast('이름 목록을 먼저 적어 주세요.'); namesTa.focus(); return; }
    var left = all.filter(function (n) { return picked.indexOf(n) < 0; });
    if (!left.length) { picked = []; left = all; toast('모두 한 번씩 뽑혔어요. 처음부터 다시 뽑아요.'); }
    var name = left[rnd(left.length)]; picked.push(name); store.set('picked', picked); pickStatus();
    var bigName = el('p', 'lp-pick'); showStage('이름 뽑기', bigName);
    if (RM || all.length < 2) { bigName.textContent = name; return; }
    stage.setAttribute('aria-busy', 'true'); bigName.classList.add('is-rolling');
    var n = 0, iv = setInterval(function () {
      bigName.textContent = all[rnd(all.length)];
      if (++n >= 10) { clearInterval(iv); bigName.textContent = name; bigName.classList.remove('is-rolling'); stage.removeAttribute('aria-busy'); }
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
    tick(); fit(); if (typeof fitRail === 'function') fitRail();
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
    namesTa = el('textarea'); namesTa.rows = 5; namesTa.maxLength = 4000; namesTa.value = store.get('names', ''); lab.appendChild(namesTa); s1.appendChild(lab);
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

    var s3 = section('타이머 여러 개');
    var tf = el('form', 'lp-row'); var tl = el('input'); tl.placeholder = '이름(예: 1모둠)'; tl.maxLength = 12; tl.setAttribute('aria-label', '타이머 이름');
    var tm = el('input'); tm.type = 'number'; tm.min = 1; tm.max = 180; tm.value = 5; tm.style.maxWidth = '5.5em'; tm.setAttribute('aria-label', '분');
    var add = el('button', 'lp-btn lp-btn-primary lp-btn-sm', '추가'); add.type = 'submit';
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

  // 넓은 화면은 한 화면에 들어가게: 무대가 넘치면 아래 질문부터 덜어 내고 "질문 n개 더"로 알림
  var mainBox = $('[data-screen-main]'), stageBox = $('.lp-scr-stage');
  function fit() {
    if (!mainBox || !stageBox) return;
    var list = mainBox.querySelector('.lp-scr-qs'); if (!list) return;
    var more = mainBox.querySelector('[data-more]'), hiddenN = +(list.getAttribute('data-hidden') || 0);
    if (getComputedStyle(stageBox).overflow !== 'hidden') return; // 좁은 화면은 그냥 내려 읽음
    while (list.children.length > 1 && stageBox.scrollHeight > stageBox.clientHeight + 1) { list.removeChild(list.lastElementChild); hiddenN++; }
    list.setAttribute('data-hidden', String(hiddenN));
    if (more) { more.hidden = !hiddenN; more.textContent = '질문 ' + hiddenN + '개 더 · 강사 화면에서 볼 수 있어요'; }
  }
  // 레일(QR·타이머·신호)이 넘치면 QR만 줄임(넓은 화면에서 한 화면에 다 보이게)
  var side = $('.lp-scr-side'), sideQr = $('.lp-scr-join .lp-qr');
  function fitRail() {
    if (!side || !sideQr) return;
    sideQr.style.width = '';
    if (getComputedStyle(side).overflow !== 'hidden') return;
    var over = side.scrollHeight - side.clientHeight;
    if (over > 0) sideQr.style.width = Math.max(110, sideQr.getBoundingClientRect().width - over) + 'px';
  }
  fitRail();
  if (window.ResizeObserver && side) { var sT = 0; new ResizeObserver(function () { clearTimeout(sT); sT = setTimeout(fitRail, 80); }).observe(side); }
  if (window.ResizeObserver && stageBox) { var rT = 0; new ResizeObserver(function () { clearTimeout(rT); rT = setTimeout(function () { if (draw.last) draw(); }, 120); }).observe(stageBox); }

  drawTimers();

  function emptyStage(live) {
    mainBox.textContent = '';
    var e = el('div', 'lp-scr-empty');
    e.appendChild(el('p', 'lp-scr-empty-t', live ? '질문을 기다리고 있어요' : '이름 뽑기·모둠·타이머는 오른쪽 위 [도구]에 있어요'));
    if (live) {
      var st = el('ol', 'lp-scr-steps');
      ['QR을 찍어 들어와요', '[질문]에 올려요', '마음에 드는 질문에 공감을 눌러요'].forEach(function (t, i) { var li = el('li'); li.appendChild(el('b', '', String(i + 1))); li.appendChild(el('span', '', t)); st.appendChild(li); });
      e.appendChild(st);
    }
    mainBox.appendChild(e);
  }
  function draw() { draw.last = true; }
  if (!DATA.live || !window.LecLive) return;

  // ── 실시간 ──
  X = LecLive.util.ext;
  var U = LecLive.util;
  var slot = 'lp-admin:' + location.pathname.replace(/[^/]*$/, '') + ':' + DATA.live.code;
  var key = ''; try { key = sessionStorage.getItem(slot) || ''; } catch (e) { } if (!key) { try { key = localStorage.getItem(slot) || ''; } catch (e) { } }
  try { conn = LecLive.create(Object.assign({}, DATA.live, key ? { adminKey: key } : {})); } catch (e) { return; }
  canWrite = DATA.live.provider === 'local' || !!key;
  var state = {}, qs = {}, answers = {}, quick = {}, tiv;
  var polls = []; (BP.sections || []).forEach(function (s) { if (s.type === 'poll' && s.items) polls = polls.concat(s.items); });
  // 연결 상태
  var connEl = $('[data-conn]'), connTx = $('[data-conn-text]');
  function setConn(s) { if (!connEl) return; var lc = DATA.live.provider === 'local'; connEl.setAttribute('data-state', lc && s === 'live' ? 'local' : s); connTx.textContent = { connecting: '연결하는 중…', live: lc ? '리허설' : '연결됨', polling: '연결됨(느린 연결)', offline: '연결이 끊겼어요' }[s] || s; }
  conn.on('status', setConn);
  // 열린 투표: 설계도 문항, 없으면 강사 화면에서 바로 띄운 즉석 투표(polls 모음)
  function openPoll() {
    var p = polls.filter(function (x) { return x.id === state.openPoll; })[0]; if (p) return p;
    var qd = state.openPoll && quick[state.openPoll];
    return qd && qd.question && Array.isArray(qd.options) && qd.options.length ? { id: qd.id, question: qd.question, kind: 'choice', options: qd.options } : null;
  }
  var SIG = [['green', 'g', '✓', '이해했어요'], ['yellow', 'y', '?', '헷갈려요'], ['red', 'r', '!', '모르겠어요']];
  function drawSignal() {
    var box = $('[data-screen-signal]'); if (!box) return;
    var reset = X.signalReset(state), latest = {}, c = { green: 0, yellow: 0, red: 0 }, total = 0;
    Object.keys(answers).forEach(function (k) { var a = answers[k]; if (a.poll !== 'signal') return; var t = a.updatedAt || a.createdAt || 0; if (t < reset) return; var who = a.by || a.id; if (!latest[who] || t >= (latest[who].updatedAt || latest[who].createdAt || 0)) latest[who] = a; });
    Object.keys(latest).forEach(function (k) { var v = latest[k].value; if (c[v] !== undefined) { c[v]++; total++; } });
    box.hidden = !total; box.textContent = ''; if (!total) return;
    var bar = el('div', 'lp-sig'); bar.setAttribute('aria-hidden', 'true');
    SIG.forEach(function (x) { var i = el('i', x[1]); i.style.width = (c[x[0]] / total * 100) + '%'; bar.appendChild(i); });
    var lg = el('ul', 'lp-sig-l');
    SIG.forEach(function (x) { var li = el('li'); var i = el('i', x[1], x[2]); i.setAttribute('aria-hidden', 'true'); li.appendChild(i); li.appendChild(doc.createTextNode(x[3] + ' ')); li.appendChild(el('b', '', String(c[x[0]]))); lg.appendChild(li); });
    box.appendChild(bar); box.appendChild(lg);
  }
  function drawTimer() {
    var t = $('[data-timer]'), v = $('[data-timer-v]', t), h = $('.lp-scr-timer-h', t); clearInterval(tiv);
    if (!(state.timer && state.timer.running && state.timer.endsAt)) { t.hidden = true; return; }
    t.hidden = false;
    var tk = function () {
      var l = state.timer.endsAt - tNow();
      v.textContent = l <= 0 ? '0:00' : mmss(l);
      h.textContent = l <= 0 ? '시간이 다 됐어요' : (state.timer.label ? state.timer.label + ' · 남은 시간' : '남은 시간');
      if (l <= 0) t.setAttribute('data-over', ''); else t.removeAttribute('data-over');
      if (l > 0 && l <= 60000) t.setAttribute('data-soon', ''); else t.removeAttribute('data-soon');
    };
    tk(); tiv = setInterval(tk, 500);
  }
  draw = function () {
    draw.last = true;
    var n = $('[data-notice]'); if (state.notice && state.notice.text) { n.hidden = false; n.textContent = state.notice.text; } else n.hidden = true;
    drawTimer(); drawSignal(); fitRail();
    var p = openPoll();
    mainBox.textContent = '';
    if (p) {
      mainBox.appendChild(el('h2', 'lp-scr-pq', shown(p.question, 140)));
      var list = Object.keys(answers).map(function (k) { return answers[k]; }).filter(function (a) { return a.poll === p.id; }), total = list.length;
      // 결과는 강사가 '결과 공개'를 누른 뒤에만(먼저 보이면 다른 사람 답을 따라가게 됨)
      if (X.revealed && !X.revealed(state, p.id)) {
        var w = el('p', 'lp-scr-wait'); w.appendChild(el('b', '', String(total))); w.appendChild(doc.createTextNode('명이 답했어요')); mainBox.appendChild(w);
        mainBox.appendChild(el('p', 'lp-scr-pmeta', '결과는 강사가 공개하면 여기에 보여요.'));
        return fit();
      }
      if (p.kind === 'word') {
        var words = U.wordCloud(list, p.id, { hidden: X.hiddenWords(state) }), top = words.length ? words[0].count : 1;
        var cl = el('div', 'lp-scr-cloud'); words.slice(0, 40).forEach(function (wd) { var s = el('span', '', shown(wd.word, 24)); s.style.fontSize = 'clamp(1.2rem,' + (1 + wd.count / top * 4).toFixed(2) + 'vw + .6rem,' + (2 + wd.count / top * 4.5).toFixed(2) + 'rem)'; cl.appendChild(s); });
        if (!words.length) cl.appendChild(el('p', 'lp-scr-pmeta', '아직 보여 줄 낱말이 없어요.'));
        mainBox.appendChild(cl);
      } else {
        var tally = {}; list.forEach(function (a) { [].concat(a.value).forEach(function (v) { tally[v] = (tally[v] || 0) + 1; }); });
        var opts = (p.options.length ? p.options : Object.keys(tally)).slice(0, 8), best = 0; opts.forEach(function (o) { best = Math.max(best, tally[o] || 0); });
        var bars = el('ol', 'lp-scr-bars');
        opts.forEach(function (o) {
          var c = tally[o] || 0, pct = Math.round(c / Math.max(total, 1) * 100), r = el('li', 'lp-scr-bar' + (c && c === best ? ' is-top' : ''));
          r.appendChild(el('span', '', shown(o, 60))); var b = el('b', '', pct + '%'); b.appendChild(el('small', '', c + '명')); r.appendChild(b);
          var tr = el('i'); tr.setAttribute('aria-hidden', 'true'); tr.style.setProperty('--w', pct + '%'); r.appendChild(tr); bars.appendChild(r);
        });
        mainBox.appendChild(bars);
      }
      mainBox.appendChild(el('p', 'lp-scr-pmeta', '응답 ' + total + '명'));
      return fit();
    }
    var arr = Object.keys(qs).map(function (k) { return qs[k]; }).filter(function (x) { return x.status === 'open' || (x.pinned && x.status !== 'hidden'); }).sort(function (a, b) { return (!!b.pinned - !!a.pinned) || (b.votes || 0) - (a.votes || 0) || (a.createdAt || 0) - (b.createdAt || 0); });
    if (!arr.length) { emptyStage(true); return; }
    var head = el('div', 'lp-scr-h'); head.appendChild(el('h2', '', '질문')); head.appendChild(el('p', '', '공감이 많은 순 · ' + arr.length + '개')); mainBox.appendChild(head);
    var ulq = el('ol', 'lp-scr-qs');
    arr.slice(0, 6).forEach(function (x) {
      var li = el('li', 'lp-scr-q' + (x.pinned ? ' is-pinned' : ''));
      var v = el('div', 'lp-scr-q-v'); v.appendChild(el('b', '', String(x.votes || 0))); v.appendChild(el('small', '', '공감')); li.appendChild(v);
      var t = el('p', 'lp-scr-q-t'); if (x.pinned) t.appendChild(el('span', 'lp-scr-q-tag', '강사가 고른 질문')); t.appendChild(doc.createTextNode(shown(x.text, 160))); li.appendChild(t);
      ulq.appendChild(li);
    });
    ulq.setAttribute('data-hidden', String(Math.max(0, arr.length - 6)));
    mainBox.appendChild(ulq);
    var more = el('p', 'lp-scr-more'); more.setAttribute('data-more', ''); more.hidden = arr.length <= 6; more.textContent = '질문 ' + Math.max(0, arr.length - 6) + '개 더 · 강사 화면에서 볼 수 있어요'; mainBox.appendChild(more);
    fit();
  };
  function react(e) { var h = $('[data-reactions]'); if (!h || RM) return; var s = el('span', '', e); s.style.left = Math.round(Math.random() * 30) + 'px'; h.appendChild(s); setTimeout(function () { s.remove(); }, 2700); }
  var rq = 0; function redraw() { if (rq) return; rq = (window.requestAnimationFrame || setTimeout)(function () { rq = 0; draw(); }); }
  emptyStage(true);
  conn.connect().then(function () {
    conn.subscribe(function (ev) {
      if (!ev) return;
      if (ev.type === 'state') { state = ev.doc || ev.state || {}; adoptTimers(state); return redraw(); }
      if (ev.type === 'reaction') return react((ev.doc && ev.doc.emoji) || ev.emoji);
      if (ev.type === 'reset') { qs = {}; answers = {}; return redraw(); }
      var bag = ev.col === 'questions' ? qs : ev.col === 'answers' ? answers : ev.col === 'polls' ? quick : null; if (!bag || !ev.doc) return;
      if (ev.type === 'remove') delete bag[ev.doc.id]; else bag[ev.doc.id] = Object.assign(bag[ev.doc.id] || {}, ev.doc); redraw();
    });
    return Promise.all([conn.getState().then(function (s) { state = s || {}; adoptTimers(state); }), conn.list('questions', {}).then(function (a) { (a || []).forEach(function (d) { qs[d.id] = d; }); }), conn.list('answers', {}).then(function (a) { (a || []).forEach(function (d) { answers[d.id] = d; }); }), conn.list('polls', {}).then(function (a) { (a || []).forEach(function (d) { quick[d.id] = d; }); })].map(function (pr) { return pr.catch(function () { }); }));
  }).then(draw, function () { setConn('offline'); draw(); });
})();
