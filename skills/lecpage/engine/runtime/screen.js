/* lecpage screen — 발표 화면: 교재 쪽(강사 화면·참가자 화면과 같은 쪽, 리모컨·키보드로 넘김), 키 하나로 겹쳐 띄우기
 * (J 참여 QR · V 투표 · Q 질문 · T 큰 타이머 · N 공지 · B 화면 숨기기 · Esc 교재로), 참여 QR, 공지, 큰 타이머, 신호등, 인기 질문, 투표 결과, 반응.
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
  var scr = $('[data-screen]'), fs = $('[data-fullscreen]');
  function goFull() { return doc.documentElement.requestFullscreen().catch(function () { toast('전체 화면을 열지 못했어요. 브라우저의 F11을 눌러 주세요.'); }); }
  if (fs) {
    if (!doc.documentElement.requestFullscreen) fs.hidden = true;
    else {
      fs.addEventListener('click', function () { if (doc.fullscreenElement) doc.exitFullscreen(); else goFull(); });
      doc.addEventListener('fullscreenchange', function () {
        var on = !!doc.fullscreenElement; fs.setAttribute('aria-pressed', String(on)); var s = fs.querySelector('span'); if (s) s.textContent = on ? '전체 화면 끝' : '전체 화면';
        if (scr) { if (on) scr.setAttribute('data-full', ''); else scr.removeAttribute('data-full'); } idle();
      });
    }
  }
  // 전체 화면에서는 위 버튼을 숨겼다가 마우스를 움직이거나 키보드로 오면 다시 보임(프로젝터에는 내용만)
  var idleT = 0;
  function idle() {
    if (!scr) return; clearTimeout(idleT); scr.removeAttribute('data-idle');
    if (scr.hasAttribute('data-full') || scr.getAttribute('data-view') === 'deck') idleT = setTimeout(function () { scr.setAttribute('data-idle', ''); }, 2500);
  }
  ['mousemove', 'pointerdown', 'keydown'].forEach(function (t) { doc.addEventListener(t, idle, { passive: true }); });
  // 강사 화면의 [발표 화면 띄우기]로 연 쪽
  // - 프로젝터(Presentation API)로 띄웠으면 받는 쪽: 이미 전체 화면이고 누를 사람이 없어 버튼을 모두 숨김
  // - 새 창으로 열었으면: 프로젝터 쪽으로 끌어다 놓고 [전체 화면]을 누르라는 안내 한 번
  var RECEIVER = !!(navigator.presentation && navigator.presentation.receiver);
  if (RECEIVER && scr) scr.setAttribute('data-receiver', '');
  var fsDlg = $('[data-fs-dialog]');
  if (fsDlg) {
    var fsGo = $('[data-fs-go]', fsDlg);
    if (!doc.documentElement.requestFullscreen) fsGo.hidden = true;
    fsGo.addEventListener('click', function () { fsDlg.close(); goFull(); });
    if (!RECEIVER && window.name === 'lp-screen' && !doc.fullscreenElement && doc.documentElement.requestFullscreen && fsDlg.showModal) fsDlg.showModal();
  }

  // ── 참여 QR·주소(파일로 열었거나 미리보기면 안내 문구, 암호 보호면 #k=는 QR에만) ──
  // 손으로 칠 주소는 강사가 넣은 짧은 주소가 있으면 그것을 크게, 원래 주소는 그 아래 작게. QR은 언제나 원래 주소(짧은 주소 서비스가 멈춰도 열림).
  var LOCAL = /^(file|about|blob|data):$/.test(location.protocol);
  // localhost·127.x로 연 발표 화면(강사 노트북에서 Node 서버를 켜고 연 경우): 그 주소는 이 컴퓨터에서만 열려 QR을 찍어도 아무도 못 들어옴.
  // 서버가 같은 와이파이 주소를 알려 주면(/api/lan, 이 컴퓨터에서 온 요청에만) 그 주소를 QR·글자에 쓰고, 모르면 QR 자리에 바꾸는 법을 크게
  var LOOP = !DATA.siteUrl && !LOCAL && /^(localhost|127(?:\.\d+){3}|\[::1\])$/.test(location.hostname);
  var LOOP_MSG = 'localhost 주소는 이 컴퓨터에서만 열려요. 노트북의 와이파이 주소(예: http://192.168.0.10:8787)로 이 화면을 다시 열면 참가자 QR이 나와요.';
  var ul = $('meta[name="lp-unlock"]');
  function bare(u) { var s = String(u || '').replace(/^https?:\/\//, '').replace(/\/$/, ''); try { return decodeURI(s); } catch (e) { return s; } }
  var siteUrl = '', joinUrl = '', qrUrl = '', fullUrl = '', shortUrl = '', qrMarkup = '';
  // 손으로 칠 주소: 한 줄에 맞춤(fitUrl, 원래 크기의 60%까지 줄임). 안 되면 점·빗금 뒤에서만 줄을 바꿈(조각은 끊지 않음 — 's-'·'lecpage-'에서 끊기지 않게)
  function urlNodes(n, u) {
    n.textContent = ''; n.removeAttribute('data-plain');
    u.replace(/([./])/g, '$1\n').split('\n').filter(Boolean).forEach(function (part, i) { if (i) n.appendChild(doc.createElement('wbr')); n.appendChild(el('span', '', part)); });
  }
  /** 참여 주소를 정하고 QR·글자를 그림. lan = 서버가 알려 준 같은 와이파이 주소(http://IP:포트) */
  function setJoin(lan) {
    // /screen.html이든 /screen(확장자 없는 주소)이든 그 폴더(= 참가자 화면)를 가리킴
    var dir = location.pathname.replace(/[^/]*$/, '');
    siteUrl = DATA.siteUrl || (LOCAL ? '' : LOOP ? (lan ? lan + dir : '') : location.origin + dir);
    joinUrl = siteUrl || (LOCAL ? DATA.shortUrl || '' : '');
    qrUrl = siteUrl ? siteUrl.split('#')[0] + (ul && ul.getAttribute('content') ? '#' + ul.getAttribute('content') : '') : '';
    fullUrl = bare(joinUrl); shortUrl = bare(DATA.shortUrl); if (!fullUrl || shortUrl === fullUrl) shortUrl = '';
    qrMarkup = '';
    // 둘레 여백 4칸(QR 규격의 quiet zone)을 그림 안에 넣음
    if (qrUrl && window.qrcode) { try { if (qrcode.stringToBytesFuncs) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']; var qq = qrcode(0, 'M'); qq.addData(qrUrl); qq.make(); qrMarkup = qq.createSvgTag({ cellSize: 6, margin: 24, scalable: true }); } catch (e) { } }
    var q = $('[data-qr-join]');
    if (q) {
      q.textContent = '';
      if (qrMarkup) q.innerHTML = qrMarkup;
      else if (!qrUrl) q.appendChild(el('span', 'lp-qr-off', LOOP ? LOOP_MSG : '배포하면 QR이 나와요.'));
      var zb = q.closest('[data-join-zoom]'); if (zb) zb.toggleAttribute('data-loop', LOOP && !qrUrl);
    }
    [].forEach.call(doc.querySelectorAll('[data-join-url]'), function (n) {
      var u = shortUrl || fullUrl;
      if (u) urlNodes(n, u); else { n.textContent = LOOP ? '이 컴퓨터 밖에서는 열리지 않는 주소예요' : '배포하면 여기에 참가자 주소가 나와요.'; n.setAttribute('data-plain', ''); }
    });
    [].forEach.call(doc.querySelectorAll('[data-join-full]'), function (n) { n.hidden = !shortUrl; n.textContent = shortUrl ? fullUrl : ''; });
    var bq = big && $('[data-qr-big]', big); if (bq) bq.textContent = '';
    if (zoom && big) {
      var off = !qrMarkup || !big.showModal;
      zoom.disabled = off; var zt = $('.lp-qr-zoom-t', zoom); if (zt) zt.hidden = off; if (jo) jo.hidden = off;
    }
  }
  function fitUrl(n) {
    if (!n || n.hasAttribute('data-plain') || !n.getClientRects().length) return;
    n.style.fontSize = ''; n.removeAttribute('data-wrap');
    var base = parseFloat(getComputedStyle(n).fontSize) || 16, f = base, min = Math.max(14, base * 0.6);
    while (n.scrollWidth > n.clientWidth + 1 && f > min) { f = Math.max(min, Math.floor(f * 0.93)); n.style.fontSize = f + 'px'; }
    // 많이 줄여도 안 들어가면(좁은 레일) 원래 크기로 두고 점·빗금 뒤에서 줄을 바꿈(작은 한 줄보다 큰 두세 줄이 뒷자리에서 읽힘)
    if (n.scrollWidth > n.clientWidth + 1) {
      n.style.fontSize = ''; n.setAttribute('data-wrap', '');
      // 조각 하나가 칸보다 길면(긴 경로 이름) 그 조각이 들어갈 만큼만 줄이고, 그래도 넘치면 조각 안에서도 끊음
      f = base; while (n.scrollWidth > n.clientWidth + 1 && f > 12) { f = Math.max(12, Math.floor(f * 0.93)); n.style.fontSize = f + 'px'; }
      if (n.scrollWidth > n.clientWidth + 1) n.setAttribute('data-wrap', 'any');
    }
  }
  function fitUrls() { [].forEach.call(doc.querySelectorAll('[data-join-url]'), fitUrl); }
  // QR 크게 보기: 뒷자리에서도 찍히게 화면 가득(QR 한 변은 찍는 거리의 1/10쯤이 필요)
  var zoom = $('[data-join-zoom]'), big = $('[data-joinbig]'), jo = $('[data-join-open]');
  function openBig() { if (!qrMarkup) return; var bq = $('[data-qr-big]', big); if (bq && !bq.firstChild) bq.innerHTML = qrMarkup; if (!big.open) big.showModal(); fitUrl($('[data-join-url]', big)); }
  setJoin('');
  if (zoom && big && big.showModal) {
    zoom.addEventListener('click', openBig); if (jo) jo.addEventListener('click', openBig);
    big.addEventListener('click', function (e) { if (e.target === big) big.close(); });
  }
  if (LOOP && window.fetch) {
    fetch('/api/lan', { cache: 'no-store', credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) {
      var u = j && j.urls && j.urls[0];
      if (typeof u === 'string' && /^http:\/\/[\d.]+:\d+\/?$/.test(u)) { setJoin(u.replace(/\/$/, '')); if (typeof fitRail === 'function') fitRail(); fitUrls(); }
    }, function () { });
  }


  // ── 무대: 뽑힌 이름·모둠을 크게 ──
  var stage = $('[data-tool-stage]');
  if (stage) stage.className = 'lp-scr-tool';
  function showStage(title, node) {
    if (!stage) return;
    $('[data-stage-title]', stage).textContent = title;
    var body = $('[data-stage-body]', stage); body.textContent = ''; body.appendChild(node);
    stage.hidden = false; setLobby(); fit();
  }
  if (stage) $('[data-stage-close]', stage).addEventListener('click', function () { stage.hidden = true; setLobby(); fit(); var o = $('[data-tools-open]'); if (o) o.focus(); });

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
        var rm = btn('삭제', '', function () { timers = timers.filter(function (x) { return x !== t; }); saveTimers(true); }); rm.setAttribute('aria-label', t.label + ' 삭제'); li.appendChild(rm);
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
    sideQr.style.width = ''; side.removeAttribute('data-tight'); fitUrls();
    if (getComputedStyle(side).overflow !== 'hidden') return;
    var over = side.scrollHeight - side.clientHeight;
    if (over > 0) sideQr.style.width = Math.max(96, sideQr.getBoundingClientRect().width - over) + 'px';
    // QR을 가장 작게 해도 넘치면 덧말을 빼고 간격을 줄임(그래도 넘치면 QR을 더 줄임)
    if (side.scrollHeight > side.clientHeight + 1) { side.setAttribute('data-tight', ''); var o2 = side.scrollHeight - side.clientHeight; if (o2 > 0) sideQr.style.width = Math.max(72, sideQr.getBoundingClientRect().width - o2) + 'px'; }
  }
  fitRail();
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(fitRail); // 글꼴이 바뀌면 주소 폭도 바뀜
  if (window.ResizeObserver && side) { var sT = 0; new ResizeObserver(function () { clearTimeout(sT); sT = setTimeout(fitRail, 80); }).observe(side); }
  if (window.ResizeObserver && stageBox) { var rT = 0; new ResizeObserver(function () { clearTimeout(rT); rT = setTimeout(function () { if (draw.last) draw(); }, 120); }).observe(stageBox); }

  drawTimers();

  // 로비: 질문·투표가 없을 때(도구 결과도 없을 때) 참여 QR을 화면 높이의 절반쯤으로 크게 + 큰 연수 제목 + 세 단계.
  // 첫 질문·투표가 오면 지금 배치(무대 + 오른쪽 레일)로. 처음 모습은 aux-pages.js가 그려 둠(같은 꼴)
  function setLobby() {
    if (!scr || !mainBox) return;
    var on = !!mainBox.querySelector('.lp-scr-empty') && !(stage && !stage.hidden);
    if (on === scr.hasAttribute('data-lobby')) return;
    if (on) scr.setAttribute('data-lobby', ''); else scr.removeAttribute('data-lobby');
    fitRail();
  }
  function lobbyStage() {
    if (!mainBox.querySelector('.lp-scr-empty')) { // 이미 로비면 다시 그리지 않음(읽어 주기 되풀이 없게)
      var e = el('div', 'lp-scr-empty'), t = el('p', 'lp-scr-lobby-t', DATA.title || ''); t.setAttribute('aria-hidden', 'true'); e.appendChild(t);
      var st = el('ol', 'lp-scr-steps');
      ['QR을 찍어 들어와요', '[질문]에 올려요', '마음에 드는 질문에 공감을 눌러요'].forEach(function (x, i) { var li = el('li'); li.appendChild(el('b', '', String(i + 1))); li.appendChild(el('span', '', x)); st.appendChild(li); });
      e.appendChild(st); mainBox.textContent = ''; mainBox.appendChild(e);
    }
    setLobby();
  }
  // ── 교재 쪽(발표)·겹쳐 띄우기 ──
  // 쪽: 상태 slide(강사 화면·참가자 화면과 같은 번호). 겹쳐 띄우기: 상태 ui.ov('' 교재 · poll · qa · timer · notice · blank), 참여 QR은 ui.qrBig.
  // 이 화면에서 넘기거나 띄우면 관리자 키가 있을 때(강사 화면이 연 창) 상태로 보내고, 없으면 이 화면에서만 바뀜
  var DECK = (Array.isArray(BP.deck) ? BP.deck : []).filter(function (x) { return Array.isArray(x) && +x[0] > 0 && typeof x[1] === 'string'; });
  var deckEl = $('[data-scr-deck]'), dImg = deckEl && $('[data-scr-img]', deckEl), dPg = deckEl && $('[data-scr-pg]', deckEl), ovEl = $('[data-scr-ov]');
  var cur = 0, started = false, ov = '', force = '', rSlide = null, rOv = null, slideAt = 0, ovAt = 0, resyncT = 0, jumpBuf = '', jumpT = 0, ovT = 0, warned = false;
  if (!DECK.length && deckEl) deckEl.hidden = true;
  function st0() { return typeof state === 'object' && state ? state : {}; }
  function push(patch) {
    if (!(conn && canWrite)) { if (DATA.live && !warned) { warned = true; toast('이 화면에서만 바뀌어요. 강사 화면의 [발표 화면 띄우기]로 열면 함께 바뀌어요.'); } return; }
    conn.setState(patch).catch(function () { toast('보내지 못했어요. 이 화면에서만 바뀌어요.'); });
  }
  function showPage(i, send) {
    if (!DECK.length) return;
    cur = Math.max(0, Math.min(DECK.length - 1, i));
    var d = DECK[cur];
    if (dImg && dImg.getAttribute('src') !== d[1]) { dImg.src = d[1]; dImg.alt = '교재 ' + d[0] + '쪽' + (d[2] ? ': ' + d[2] : ''); }
    if (dPg) dPg.textContent = d[0] + ' / ' + DECK[DECK.length - 1][0];
    [cur + 1, cur - 1].forEach(function (k) { if (DECK[k]) { var im = new Image(); im.decoding = 'async'; im.src = DECK[k][1]; } });
    if (send) { started = true; slideAt = Date.now(); rSlide = +d[0]; var pt = { slide: +d[0] }; if (ov) { pt.ui = { ov: null }; } push(pt); }
  }
  function pageIndex(n) { var b = 0; DECK.forEach(function (x, k) { if (Math.abs(+x[0] - n) < Math.abs(+DECK[b][0] - n)) b = k; }); return b; }
  function step(d) {
    if (ov) { setOv('', true); return; } // 겹쳐 띄운 것이 있으면 먼저 교재로(리모컨의 다음 단추로도 닫힘)
    if (big && big.open) { closeQr(); return; }
    if (!started) { if (d > 0) { showPage(0, true); applyOv(); } return; } // 시작 전(참여 안내) → 첫 쪽부터
    showPage(cur + d, true);
  }
  // 첫 쪽을 넘기기 전(상태 slide 0)에는 참여 안내(로비: 큰 QR·제목)를 보이고, 넘기기 시작하면 교재
  function viewOf() { return ov === 'poll' || ov === 'qa' || !DECK.length || !started ? 'live' : 'deck'; }
  /** 겹쳐 띄우기 그리기: 투표·질문은 참여 화면(무대+QR 레일)을, 큰 타이머·공지·가림은 덮개를 */
  function applyOv() {
    force = ov === 'poll' || ov === 'qa' ? ov : '';
    if (scr) { scr.setAttribute('data-view', viewOf()); if (ov) scr.setAttribute('data-ov', ov); else scr.removeAttribute('data-ov'); }
    if (deckEl) deckEl.hidden = viewOf() !== 'deck';
    clearInterval(ovT);
    if (ovEl) {
      var cover = ov === 'timer' || ov === 'notice' || ov === 'blank';
      ovEl.hidden = !cover; ovEl.className = 'lp-scr-ov' + (cover ? ' is-' + ov : ''); ovEl.textContent = '';
      if (ov === 'timer') { ovEl.appendChild(el('p', 'lp-scr-ov-h')); ovEl.appendChild(el('p', 'lp-scr-ov-n')); bigTick(); ovT = setInterval(bigTick, 500); }
      else if (ov === 'notice') { var nt = st0().notice && st0().notice.text; ovEl.appendChild(el('p', nt ? 'lp-scr-ov-t' : 'lp-scr-ov-h', nt || '보낸 공지가 없어요. 강사 화면의 [공지]에서 보내요.')); }
    }
    idle(); if (draw.last) draw(); else drawChrome();
  }
  function setOv(v, send) {
    v = v || ''; if (v === ov && v) v = '';
    ov = v; rOv = v; ovAt = Date.now(); applyOv();
    if (send) push({ ui: { ov: v || null, qrBig: null } });
  }
  function timerNow() { var t = st0().timer; return t && t.running && t.endsAt ? t : null; }
  function bigTick() {
    if (!ovEl || ov !== 'timer') return;
    var t = timerNow(), h = $('.lp-scr-ov-h', ovEl), n = $('.lp-scr-ov-n', ovEl); if (!h || !n) return;
    if (!t) { h.textContent = '돌아가는 타이머가 없어요'; n.textContent = '--:--'; ovEl.removeAttribute('data-over'); return; }
    var l = t.endsAt - tNow(); h.textContent = l <= 0 ? '시간이 다 됐어요' : (t.label ? t.label + ' · 남은 시간' : '남은 시간'); n.textContent = l <= 0 ? '0:00' : mmss(l);
    if (l <= 0) ovEl.setAttribute('data-over', ''); else ovEl.removeAttribute('data-over');
  }
  /** 교재 위의 작은 것: 공지 띠, 오른쪽 아래 타이머 */
  function drawChrome() {
    if (!deckEl) return;
    var nEl = $('[data-scr-dnotice]', deckEl), cEl = $('[data-scr-chip]', deckEl), sn = st0().notice;
    if (nEl) { nEl.hidden = !(sn && sn.text); nEl.textContent = sn && sn.text ? sn.text : ''; }
    if (cEl) {
      var t = timerNow(); cEl.hidden = !t;
      if (t) { var l = t.endsAt - tNow(); cEl.textContent = (t.label ? t.label + ' ' : '') + (l <= 0 ? '끝' : mmss(l)); cEl.toggleAttribute('data-over', l <= 0); }
    }
  }
  setInterval(function () { if (viewOf() === 'deck') drawChrome(); }, 1000);
  /** 상태가 바뀌면(강사 화면·다른 화면에서 넘김) 따라감. 방금 이 화면에서 누른 것은 늦게 온 옛 상태로 되돌리지 않음 */
  function syncDeck() {
    var s1 = st0(), now = Date.now(), freshS = now - slideAt < 800, freshO = now - ovAt < 800, later = false;
    var wasStarted = started;
    if (DECK.length && s1.slide > 0 && +s1.slide !== rSlide) { if (freshS) later = true; else { rSlide = +s1.slide; started = true; showPage(pageIndex(+s1.slide)); } }
    if (started !== wasStarted) { rOv = (s1.ui || {}).ov || ''; ov = rOv; applyOv(); return true; }
    var o = (s1.ui || {}).ov || '';
    // 방금 이 화면에서 바꾼 것은 잠깐 지킴(늦게 온 옛 상태로 되돌지 않게). 그사이 온 다른 변화는 조금 뒤 다시 맞춤
    if (o !== rOv && freshO) later = true;
    if (later) { clearTimeout(resyncT); resyncT = setTimeout(function () { if (draw.last) draw(); else syncDeck(); }, 850); }
    if (o !== rOv && !freshO) { rOv = o; ov = o; applyOv(); return true; }
    if (ov === 'notice' && ovEl) { var tx = $('.lp-scr-ov-t, .lp-scr-ov-h', ovEl), nt = s1.notice && s1.notice.text; if (tx && nt && tx.textContent !== nt) applyOv(); }
    drawChrome();
    return false;
  }
  function closeQr() { if (DATA.live && conn && canWrite && (st0().ui || {}).qrBig) push({ ui: { qrBig: null } }); else if (big && big.open) big.close(); }
  function toggleQr() {
    if (!qrMarkup) return toast(LOOP ? LOOP_MSG : '배포하면 QR이 나와요.');
    if (big && big.open) return closeQr();
    if (conn && canWrite) push({ ui: { qrBig: true, ov: null } }); else openBig();
  }
  if (DECK.length) showPage(0);
  // 위 띠가 보이는 동안 교재 위 공지 띠를 그 아래로(띠 높이는 글꼴·폭에 따라 바뀜)
  var topEl = $('.lp-scr-top');
  if (deckEl && topEl && scr && window.ResizeObserver) new ResizeObserver(function () { scr.style.setProperty('--scr-top-h', topEl.offsetHeight + 'px'); }).observe(topEl);
  applyOv();
  // 키(발표용 리모컨: PageDown·PageUp·→·←, 화면 숨기기 'B'·'.', 시작 F5)
  doc.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target, tag = (t && t.tagName) || '';
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (t && t.isContentEditable)) return;
    if (drawer && !drawer.hidden) return;
    var k = e.key, onCtl = /^(BUTTON|A|SUMMARY)$/.test(tag) && !(t.closest && t.closest('[data-scr-deck]'));
    var keysDlg = $('[data-keys-dialog]');
    if (doc.querySelector('dialog[open]:not([data-joinbig])')) return; // 단축키 안내·전체 화면 안내가 열려 있으면 그 창이 먼저
    if (/^[0-9]$/.test(k) && DECK.length) { jumpBuf = (jumpBuf + k).slice(-4); toast(jumpBuf + '쪽으로 가려면 Enter'); clearTimeout(jumpT); jumpT = setTimeout(function () { jumpBuf = ''; }, 2500); e.preventDefault(); return; }
    if (k === 'Enter' && jumpBuf) { var n = +jumpBuf; jumpBuf = ''; if (ov) setOv('', true); showPage(pageIndex(n), true); applyOv(); e.preventDefault(); return; }
    var go = null;
    switch (k) {
      case 'PageDown': case 'ArrowRight': case 'ArrowDown': go = 1; break;
      case ' ': case 'Enter': if (!onCtl) go = 1; break;
      case 'PageUp': case 'ArrowLeft': case 'ArrowUp': case 'Backspace': go = -1; break;
      case 'Home': if (DECK.length) { showPage(0, true); applyOv(); e.preventDefault(); } return;
      case 'End': if (DECK.length) { showPage(DECK.length - 1, true); applyOv(); e.preventDefault(); } return;
      case 'j': case 'J': if (DATA.live) { toggleQr(); e.preventDefault(); } return;
      case 'v': case 'V': if (DATA.live) { setOv('poll', true); e.preventDefault(); } return;
      case 'q': case 'Q': if (DATA.live) { setOv('qa', true); e.preventDefault(); } return;
      case 't': case 'T': setOv('timer', true); e.preventDefault(); return;
      case 'n': case 'N': if (DATA.live) { setOv('notice', true); e.preventDefault(); } return;
      case 'b': case 'B': case '.': setOv('blank', true); e.preventDefault(); return;
      case 'Escape': if (big && big.open) return; if (ov) { setOv('', true); e.preventDefault(); } return;
      case 'f': case 'F': case 'F5': if (doc.documentElement.requestFullscreen) { if (doc.fullscreenElement) doc.exitFullscreen(); else goFull(); } e.preventDefault(); return;
      case '?': case 'h': case 'H': if (keysDlg && keysDlg.showModal) keysDlg.showModal(); e.preventDefault(); return;
      default: return;
    }
    if (go !== null && (DECK.length || ov || (big && big.open))) { e.preventDefault(); step(go); }
  });
  // 태블릿: 교재를 밀어 넘기기
  if (deckEl) {
    var sx = null;
    deckEl.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    deckEl.addEventListener('touchend', function (e) { if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1); });
  }
  var ko = $('[data-keys-open]'), kd = $('[data-keys-dialog]');
  if (ko && kd && kd.showModal) ko.addEventListener('click', function () { kd.showModal(); }); else if (ko) ko.hidden = true;

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
  function setConn(s) { if (!connEl) return; var lc = DATA.live.provider === 'local'; connEl.setAttribute('data-state', lc && s === 'live' ? 'local' : s); connTx.textContent = { connecting: '연결하는 중…', live: lc ? '리허설' : '연결됨', polling: '연결됨(천천히 묻는 중)', offline: '연결이 끊겼어요 · 다시 잇는 중' }[s] || s; }
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
  // 강사 화면의 [참여 QR 크게]: 상태(ui.qrBig)를 따라 QR을 화면 가득 열고 닫음. 이 화면에서 닫으면(관리자 키가 있을 때) 상태도 끔
  var bigByState = false;
  function syncBig() {
    if (!big || !qrMarkup || !big.showModal) return;
    var want = (state.ui || {}).qrBig === true;
    if (want && !big.open) { openBig(); bigByState = true; }
    else if (!want && big.open && bigByState) { bigByState = false; big.close(); }
  }
  if (big) big.addEventListener('close', function () {
    if (bigByState && (state.ui || {}).qrBig === true && canWrite) conn.setState({ ui: { qrBig: null } }).catch(function () { });
    bigByState = false;
  });
  draw = function () {
    draw.last = true;
    if (syncDeck()) return; // 겹쳐 띄우기가 바뀌었으면 applyOv가 다시 그림
    syncBig(); bigTick();
    var n = $('[data-notice]'); if (state.notice && state.notice.text) { n.hidden = false; n.textContent = state.notice.text; } else n.hidden = true;
    drawTimer(); drawSignal(); fitRail();
    var p = force === 'qa' ? null : openPoll();
    var arr = Object.keys(qs).map(function (k) { return qs[k]; }).filter(function (x) { return x.status === 'open' || (x.pinned && x.status !== 'hidden'); }).sort(function (a, b) { return (!!b.pinned - !!a.pinned) || (b.votes || 0) - (a.votes || 0) || (a.createdAt || 0) - (b.createdAt || 0); });
    // V(투표)를 눌렀는데 열린 투표가 없음
    if (force === 'poll' && !p) { mainBox.textContent = ''; setLobby(); var m0 = el('div', 'lp-scr-msg'); m0.appendChild(el('h2', '', '열린 투표가 없어요')); m0.appendChild(el('p', '', '강사 화면에서 투표를 열면 여기에 나와요. Esc를 누르면 교재로 돌아가요.')); mainBox.appendChild(m0); return fit(); }
    // 강사가 고른 질문 하나를 크게(강사 화면의 [발표 화면에 크게])
    var sq = force === 'qa' && (state.ui || {}).q ? qs[state.ui.q] : null;
    if (sq && sq.status !== 'hidden') {
      mainBox.textContent = ''; setLobby();
      var sp = el('div', 'lp-scr-spot'); sp.appendChild(el('p', 'lp-scr-spot-k', '강사가 고른 질문'));
      sp.appendChild(el('p', 'lp-scr-spot-t', shown(sq.text, 280))); sp.appendChild(el('p', 'lp-scr-pmeta', '공감 ' + (sq.votes || 0)));
      mainBox.appendChild(sp); return fit();
    }
    if (!p && !arr.length) { lobbyStage(); return; }
    mainBox.textContent = ''; setLobby();
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
        var tally = X.tally(list); // 응답자당 한 표(강사·참가자 화면과 같은 수)
        var opts = (p.options.length ? p.options : Object.keys(tally)).slice(0, 8), best = 0; opts.forEach(function (o) { best = Math.max(best, tally[o] || 0); });
        var bars = el('ol', 'lp-scr-bars'), ai = X.answerOf ? X.answerOf(state, p.id) : -1, right = ai >= 0 ? p.options[ai] : undefined;
        opts.forEach(function (o) {
          var c = tally[o] || 0, pct = Math.round(c / Math.max(total, 1) * 100), r = el('li', 'lp-scr-bar' + (right !== undefined ? (o === right ? ' is-answer' : '') : c && c === best ? ' is-top' : ''));
          var lb = el('span', '', shown(o, 60)); if (o === right) lb.appendChild(el('em', 'lp-scr-ans', '정답')); r.appendChild(lb); var b = el('b', '', pct + '%'); b.appendChild(el('small', '', c + '명')); r.appendChild(b);
          var tr = el('i'); tr.setAttribute('aria-hidden', 'true'); tr.style.setProperty('--w', pct + '%'); r.appendChild(tr); bars.appendChild(r);
        });
        mainBox.appendChild(bars);
      }
      mainBox.appendChild(el('p', 'lp-scr-pmeta', '응답 ' + total + '명'));
      return fit();
    }
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
