/* lecpage console — 강사 화면. 모든 화면 출력은 textContent로 만듭니다(HTML 주입 금지).
 * 켜진 기능과 섹션의 패널만 만듭니다. 맨 위 '지금' 띠: 참가자·도움 요청·모르겠어요 신호·열린 투표·질문·설문.
 * 관리자 키: 이 탭(sessionStorage)에만 두고, '이 기기에서 기억하기'를 고르면 이 기기(localStorage)에도. 주소·화면·기록에는 남기지 않음. */
(function () {
  'use strict';
  // 휴대폰에서 열기 QR(#key=…): 읽자마자 주소에서 지움(주소창·화면 공유·방문 기록에 남지 않게). 키는 이 탭에만 둠
  var qrKey = '';
  try {
    var hk = /(?:^#|&)key=([^&]+)/.exec(location.hash || '');
    if (hk) {
      qrKey = decodeURIComponent(hk[1]);
      var rest = location.hash.replace(/(^#|&)key=[^&]*/, '$1').replace(/^#&/, '#');
      history.replaceState(null, '', location.pathname + location.search + (rest === '#' ? '' : rest));
    }
  } catch (e) { }
  // 다른 사이트가 강사 화면을 틀(iframe)에 넣어 관리자 키를 가로채지 못하게(헤더를 못 바꾸는 GitHub Pages 대비). 앱 미리보기는 예외
  try { if (window.top !== window.self && !document.body.hasAttribute('data-lp-preview')) { document.documentElement.innerHTML = '<body><p style="font:16px sans-serif;padding:24px">강사 화면은 새 창에서 열어 주세요.</p></body>'; return; } } catch (e) { return; }
  var doc = document, root = doc.documentElement, $ = function (s, r) { return (r || doc).querySelector(s); };
  var DATA = {}, BP = {};
  try { DATA = JSON.parse($('#lp-data').textContent); BP = JSON.parse($('#lp-blueprint').textContent); } catch (e) { }
  function el(tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = text; return n; }
  function btn(text, cls, fn, key) { var b = el('button', 'lp-btn lp-btn-sm ' + (cls || 'lp-btn-ghost'), text); b.type = 'button'; if (key) b.setAttribute('data-k', key); if (fn) b.addEventListener('click', fn); return b; }
  var tt; function toast(m) { var t = $('[data-toast]'); if (!t) return; t.textContent = m; t.classList.add('is-on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('is-on'); }, 2600); }
  function save(name, text) { var u = URL.createObjectURL(new Blob([text.charAt(0) === '\uFEFF' ? text : '\uFEFF' + text], { type: 'text/csv;charset=utf-8' })); var a = el('a'); a.href = u; a.download = name; doc.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 1500); }
  function ago(t) { if (!t) return ''; var s = Math.round((Date.now() - t) / 1000); return s < 60 ? '방금' : s < 3600 ? Math.floor(s / 60) + '분 전' : Math.floor(s / 3600) + '시간 전'; }
  function mmss(ms) { var s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  // 밝게·어둡게(참가자 화면과 같은 저장 값)
  var tb = $('[data-theme-toggle]');
  if (tb) tb.addEventListener('click', function () {
    var cur = root.getAttribute('data-theme'), dark = cur === 'dark' || (cur !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    root.setAttribute('data-theme', dark ? 'light' : 'dark'); try { localStorage.setItem('lp-theme', dark ? 'light' : 'dark'); } catch (e) { }
  });

  var form = $('[data-admin-form]'), main = $('[data-console-main]'), box = $('[data-admin-box]');
  var PREVIEW = doc.body.hasAttribute('data-lp-preview'), LOCALPAGE = /^(file|about|blob|data):$/.test(location.protocol);
  /** 이 사이트의 폴더 주소(…/). /console.html이든 /console(확장자 없는 주소)이든 같음. 파일로 열었거나 미리보기면 '' */
  function siteDir() { return LOCALPAGE ? '' : location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, ''); }
  /** 들어간 뒤에만 보이는 것(위 띠의 다른 화면·도움말): 강사용 화면에 잘못 온 참가자에게는 열쇠 칸과 [참가자 화면으로]만 */
  function showAfterLogin() { [].forEach.call(doc.querySelectorAll('[data-after-login]'), function (n) { n.hidden = false; }); }

  // ── 더보기(참가자 화면·QR 안내문·접속 확인·휴대폰에서 열기·도움말) ──
  var moreBox = $('[data-more]'), moreBtn = $('[data-more-btn]'), moreMenu = $('[data-more-menu]');
  function menuItems() { return [].slice.call(moreMenu.querySelectorAll('li:not([hidden]) a, li:not([hidden]) button')); }
  function setMenu(open, focusFirst) {
    if (!moreMenu) return;
    moreMenu.hidden = !open; moreBtn.setAttribute('aria-expanded', String(open));
    // 열린 동안 아래 칸은 잠시 누를 수 없게(메뉴 밖을 누르면 닫히기만 하고, 메뉴에 반쯤 가린 단추를 잘못 누르지 않게)
    [main, $('[data-console-help]')].forEach(function (n) { if (n) n.inert = open; });
    if (open && focusFirst) { var f = menuItems()[0]; if (f) f.focus(); }
  }
  if (moreBtn && moreMenu) {
    moreBtn.addEventListener('click', function (e) { setMenu(moreMenu.hidden, e.detail === 0); });
    moreMenu.addEventListener('click', function (e) { if (e.target.closest('a,button')) setMenu(false); });
    moreMenu.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      var its = menuItems(), i = its.indexOf(doc.activeElement); e.preventDefault();
      var n = its[(i + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length]; if (n) n.focus();
    });
    moreBox.addEventListener('focusout', function (e) { if (!moreMenu.hidden && e.relatedTarget && !moreBox.contains(e.relatedTarget)) setMenu(false); });
    doc.addEventListener('click', function (e) { if (!moreMenu.hidden && !moreBox.contains(e.target)) setMenu(false); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !moreMenu.hidden) { setMenu(false); moreBtn.focus(); } });
  }
  var helpBtn = $('[data-help-open]'), help = $('[data-console-help]');
  if (helpBtn && help) helpBtn.addEventListener('click', function () { help.open = true; var sm = $('summary', help); help.scrollIntoView({ block: 'start' }); if (sm) sm.focus({ preventScroll: true }); });

  // ── 발표 화면 띄우기 ──
  // 1) 크롬·엣지에 프로젝터(두 번째 화면)가 이어져 있으면 Presentation API로 그 화면에 바로 전체 화면(고르는 창이 한 번 뜸).
  //    받는 쪽은 저장소가 따로라 관리자 키를 받지 않음(발표 화면은 보기만 하면 됨)
  // 2) 아니면 새 창(탭이 아니라 창이라 프로젝터 쪽으로 끌기 쉬움). 발표 화면이 '전체 화면' 안내를 띄움.
  //    이미 연 창이 있으면 다시 불러오지 않고 앞으로만
  var SCREEN = 'screen.html', scrWin = null, pres = null, presReq = null, presAvail = false, hintT = 0;
  function say2(t) { if (C.stageHint) { C.stageHint.textContent = t || ''; C.stageHint.hidden = !t; clearTimeout(hintT); if (t) hintT = setTimeout(function () { say2(''); }, 30000); } else if (t) toast(t); }
  try {
    if (!PREVIEW && !LOCALPAGE && window.PresentationRequest && navigator.presentation) {
      presReq = new PresentationRequest([SCREEN]);
      presReq.getAvailability().then(function (a) {
        var sync = function () { presAvail = !!a.value; var w = $('[data-screen-window]'); if (w) w.closest('li').hidden = !presAvail; if (presAvail) root.setAttribute('data-pres', ''); else root.removeAttribute('data-pres'); };
        sync(); a.onchange = sync;
      }, function () { presAvail = false; });
    }
  } catch (e) { presReq = null; }
  function setPres(c) {
    pres = c; paintStage();
    var off = function () { if (pres === c) { pres = null; paintStage(); } };
    c.addEventListener('close', off); c.addEventListener('terminate', off);
  }
  function openWindow() {
    if (scrWin && !scrWin.closed) { try { scrWin.focus(); } catch (e) { } say2('발표 화면 창은 이미 열려 있어요. 앞으로 가져왔어요.'); return; }
    var w = null;
    try {
      // 이름이 같은 창이 이미 있으면(강사 화면을 새로 고친 뒤) 다시 불러오지 않고 그 창을 씀
      w = window.open('', 'lp-screen', 'popup,width=1280,height=720');
      if (w && (w.location.href === 'about:blank' || !/screen(\.html)?$/.test(w.location.pathname))) w.location.replace(new URL(SCREEN, location.href).href);
    } catch (e) { }
    if (!w) { say2('브라우저가 새 창을 막았어요. 주소창 오른쪽의 팝업 표시를 눌러 허용한 뒤 다시 눌러 주세요.'); return; }
    scrWin = w; try { w.focus(); } catch (e) { }
    say2('새 창으로 열었어요. 창을 프로젝터 화면으로 끌어다 놓고 그 창의 [전체 화면]을 누르세요.');
  }
  function openScreen(windowOnly) {
    if (pres && pres.state === 'connected') { say2('발표 화면이 프로젝터에 떠 있어요. 끄려면 [발표 화면 끄기]를 누르세요.'); return; }
    if (!windowOnly && presReq && presAvail) {
      presReq.start().then(function (c) { setPres(c); say2('프로젝터에 발표 화면을 띄웠어요. 이 화면에서 누르는 것이 바로 보여요.'); }, function (err) {
        if (err && err.name === 'NotFoundError') openWindow();
        else say2('프로젝터를 고르지 않았어요. 창으로 열려면 [더보기] → [발표 화면 새 창]을 누르세요.');
      });
      return;
    }
    openWindow();
  }
  var scrBtn = $('[data-screen-open]'), scrWinBtn = $('[data-screen-window]');
  if (scrBtn) scrBtn.addEventListener('click', function () { openScreen(false); });
  if (scrWinBtn) scrWinBtn.addEventListener('click', function () { openScreen(true); });

  var C = {};
  if (!DATA.live || !window.LecLive) {
    if (box) box.hidden = true;
    showAfterLogin();
    if (main) { main.hidden = false; main.appendChild(el('p', 'lp-con-empty', '이 사이트는 참여 기능이 꺼져 있어 강사 화면을 쓸 수 없어요. [발표 화면 띄우기]로 QR과 도구(이름 뽑기·모둠·타이머)를 띄울 수 있어요.')); }
    return;
  }

  var U = LecLive.util, X = U.ext;
  var LOCAL = DATA.live.provider === 'local';
  var feats = DATA.live.features || [], secs = BP.sections || [], stations = BP.stations || [];
  function has(f) { return feats.indexOf(f) >= 0; }
  function hasSec(t) { return secs.some(function (s) { return s.type === t; }); }
  var polls = []; secs.forEach(function (s) { if (s.type === 'poll' && s.items) polls = polls.concat(s.items); });
  var MODERATE = secs.some(function (s) { return s.type === 'board' && s.moderation; });
  // 파일 올리기: 보드가 파일을 받지 않으면(allowFiles:false, 만 14세 미만 연수 등) 서버도 받지 않게 상태에 적어 둠
  var NOFILES = !secs.some(function (s) { return s.type === 'board' && s.allowFiles !== false && s.maxFiles !== 0; });
  var ON = {
    progress: stations.length > 0 && has('progress'), help: has('help'), qa: hasSec('qa') || has('qa'), signal: has('signal'),
    board: hasSec('board') || has('board'), survey: (DATA.survey || 0) > 0,
  };
  // 투표 패널은 늘 둠: 미리 넣은 문항이 없어도 즉석 투표(polls 모음)를 바로 띄울 수 있게
  var COLS = ['participants', 'polls', 'answers'].concat(ON.progress ? ['progress'] : [], ON.help ? ['help'] : [], ON.qa ? ['questions'] : [], ON.board ? ['posts'] : [], ON.survey ? ['survey'] : []);
  var conn = null, data = {}, state = {}, P = {};
  COLS.forEach(function (c) { data[c] = {}; });
  function vals(c) { var b = data[c] || {}; return Object.keys(b).map(function (k) { return b[k]; }); }
  function now() { return conn && conn.now ? conn.now() : Date.now(); }

  // ── 관리자 키 ──
  // 키 이름에 사이트 경로를 넣음: 여러 사이트가 한 출처를 쓰는 서버(바로 공개)에서 다른 사이트의 화면이 이 키를 쓰지 못하게
  var ADMIN_SLOT = 'lp-admin:' + location.pathname.replace(/[^/]*$/, '') + ':' + DATA.live.code;
  function store(kind) { try { return window[kind]; } catch (e) { return null; } }
  function savedKey() { var s = store('sessionStorage'), l = store('localStorage'); try { return (s && s.getItem(ADMIN_SLOT)) || (l && l.getItem(ADMIN_SLOT)) || ''; } catch (e) { return ''; } }
  function keepKey(key, remember) {
    var s = store('sessionStorage'), l = store('localStorage');
    try { if (s) s.setItem(ADMIN_SLOT, key); } catch (e) { }
    try { if (l) { if (remember) l.setItem(ADMIN_SLOT, key); else l.removeItem(ADMIN_SLOT); } } catch (e) { }
  }
  function forgetKey() { [store('sessionStorage'), store('localStorage')].forEach(function (s) { try { if (s) s.removeItem(ADMIN_SLOT); } catch (e) { } }); }
  var keyIn = $('#lp-key'), msg = $('[data-key-msg]'), go = $('[data-key-go]'), rem = $('[data-remember]'), remHint = $('[data-remember-hint]');
  var fails = 0, waitUntil = 0, waitT = 0, busy = false;
  function say(t) { if (msg) msg.textContent = t || ''; if (keyIn) keyIn.setAttribute('aria-invalid', t ? 'true' : 'false'); }
  function holdFor(sec, why) {
    waitUntil = Date.now() + sec * 1000; clearInterval(waitT);
    var tick = function () {
      var left = Math.ceil((waitUntil - Date.now()) / 1000);
      if (left <= 0) { clearInterval(waitT); go.disabled = false; go.textContent = '들어가기'; return; }
      go.disabled = true; go.textContent = left + '초 뒤에 다시';
    };
    say(why); tick(); waitT = setInterval(tick, 500);
  }
  if (rem) {
    try { rem.checked = !!(store('localStorage') && store('localStorage').getItem(ADMIN_SLOT)); } catch (e) { }
    var remSay = function () { if (!remHint) return; remHint.textContent = rem.checked ? '이 기기에 남아요. 공용 컴퓨터라면 끄고, 다 쓴 뒤 [나가기]를 눌러 지워 주세요.' : '끄면 이 탭을 닫을 때 잊어요. 공용 컴퓨터에서는 켜지 마세요.'; if (rem.checked) remHint.setAttribute('data-warn', ''); else remHint.removeAttribute('data-warn'); };
    rem.addEventListener('change', remSay); remSay();
  }
  var show = $('[data-key-show]');
  if (show && keyIn) show.addEventListener('click', function () { var on = keyIn.type === 'password'; keyIn.type = on ? 'text' : 'password'; show.setAttribute('aria-pressed', String(on)); show.setAttribute('aria-label', on ? '키 가리기' : '키 보이기'); keyIn.focus(); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var k = String(keyIn.value || '').trim();
    if (!k) { say('관리자 키를 넣어 주세요.'); keyIn.focus(); return; }
    if (Date.now() < waitUntil) return;
    start(k, !!(rem && rem.checked), '');
  });
  var saved = savedKey(), ADMIN_KEY = '';
  // 휴대폰에서 열기 QR로 왔으면 그 키로(이 탭에만). 아니면 이 탭·이 기기에 둔 키
  if (qrKey) start(qrKey, false, 'qr');
  else if (saved) start(saved, !!(store('localStorage') && (function () { try { return store('localStorage').getItem(ADMIN_SLOT); } catch (e) { return ''; } })()), 'saved');
  else if (keyIn) setTimeout(function () { keyIn.focus(); }, 0);

  /** from: ''(직접 넣음) · 'saved'(기억해 둔 키) · 'qr'(휴대폰에서 열기 QR) */
  function start(key, remember, from) {
    var auto = from === 'saved';
    if (busy) return; busy = true; say(''); go.disabled = true; go.textContent = '확인하는 중…';
    setConn('connecting');
    var c;
    try { c = LecLive.create(DATA.live); } catch (e) { busy = false; go.disabled = false; go.textContent = '들어가기'; say('참여 기능을 불러오지 못했어요. 새로 고침해 주세요.'); return; }
    // 공개 연결부터 열고, 키는 한 번만 물어 확인(틀린 키가 요청마다 여러 번 세어져 맞는 키까지 막히지 않게)
    c.connect().then(function () { return c.useAdminKey(key); }).then(function (ok) {
      if (!ok) throw LecLive.error('admin_required', '관리자 키가 맞지 않아요.', { status: 403 });
      return c.getState().then(function (s) { state = s || {}; });
    }).then(function () {
      busy = false; fails = 0; conn = c; ADMIN_KEY = key; keepKey(key, remember); if (keyIn) keyIn.value = '';
      enter();
    }, function (err) {
      busy = false; try { c.close(); } catch (e) { }
      setConn('idle');
      go.disabled = false; go.textContent = '들어가기';
      var st = err && err.status;
      if (st === 429) { holdFor(Math.min(900, Math.max(10, +err.retryAfter || 60)), '키가 여러 번 틀려 서버가 잠시 막았어요. 기다린 뒤 다시 넣어 주세요.'); if (auto) forgetKey(); return; }
      if (st === 401 || st === 403 || (err && err.code === 'admin_required')) {
        if (auto) { forgetKey(); say('기억해 둔 관리자 키가 맞지 않아 지웠어요. 다시 넣어 주세요.'); return; }
        if (from === 'qr') { say('QR에 든 관리자 키가 맞지 않아요. 노트북의 강사 화면에서 QR을 다시 보이거나 키를 넣어 주세요.'); if (keyIn) keyIn.focus(); return; }
        fails++;
        // 틀린 키를 계속 넣으면 이 화면에서도 조금씩 늦춤(서버도 따로 셈)
        if (fails >= 3) holdFor(Math.min(60, Math.pow(2, fails - 2) * 5), '관리자 키가 맞지 않아요. 공개할 때 받은 키를 다시 확인해 주세요.');
        else say('관리자 키가 맞지 않아요. 공개할 때 받은 키를 다시 확인해 주세요.');
        if (keyIn) { keyIn.select(); keyIn.focus(); }
        return;
      }
      say('참여 기능 서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 해 주세요. 참가자 화면의 교재·실습은 그대로 열리니, 질문은 구두로 받아 주세요. 계속 안 되면 접속 확인(check.html)을 열어 보세요.');
    });
  }
  var logout = $('[data-logout]');
  if (logout) logout.addEventListener('click', function () {
    forgetKey(); try { if (conn) conn.close(); } catch (e) { }
    location.reload();
  });

  // ── 연결 상태 ──
  var connEl = $('[data-conn]'), connTx = $('[data-conn-text]');
  function setConn(s) {
    if (!connEl) return;
    var t = { idle: '들어가기 전', connecting: '연결하는 중…', live: LOCAL ? '리허설 · 이 브라우저에서만' : '연결됨 · 실시간', polling: '연결됨 · 천천히 묻는 중', offline: '연결이 끊겼어요 · 다시 잇는 중' }[s] || s;
    connEl.setAttribute('data-state', LOCAL && s === 'live' ? 'local' : s); if (connTx) connTx.textContent = t;
  }

  // ── 묻기 방식·할 일·전날 점검(맨 위 한 줄) ──
  // 학교망에서 실시간 연결이 막히면 참가자 화면은 '긴 대기 묻기'(바뀌면 바로, 없으면 20초마다)나 간격 묻기로 바뀜. 강사가 무엇을 할지 한 줄로
  function sec(ms) { return Math.max(1, Math.round((ms || 0) / 1000)) + '초'; }
  function netWords(st, ni) {
    var t = ni.transport, hint = ni.hint >= 10000 ? ' 오늘 서버가 붐벼 ' + sec(ni.hint) + ' 간격으로 늘렸어요.' : '';
    if (LOCAL) return ['리허설 · 이 브라우저 안에서만', '참가자 휴대폰과는 이어지지 않아요. 실제 연수 전에 참여 기능 서버를 연결해 다시 공개하세요.'];
    if (st === 'offline') return ['연결이 끊겼어요 · 다시 잇는 중', '참가자 화면의 교재·실습·프롬프트는 그대로 열려요. 질문은 구두로 받고, 설문은 QR로 다른 설문지를 띄워도 돼요. 연결되면 쌓인 글이 들어와요.'];
    if (t === 'ws' || t === 'realtime') return ['연결됨 · 바로 받음(웹소켓)', ''];
    if (t === 'sse') return ['연결됨 · 바로 받음(SSE)', ''];
    if (t === 'long') return ['긴 대기 묻기 · 바뀌면 바로, 없으면 ' + (ni.wait || 20) + '초마다', '이 망이 웹소켓을 막아 천천히 묻는 중이에요. 질문·투표가 몇 초 늦게 보여요. 그대로 써도 돼요.' + hint];
    if (t === 'poll') return [(ni.every ? sec(ni.every) + '마다 묻기' : '간격 묻기'), '이 망이 웹소켓을 막아 정해진 간격으로 물어요. 질문·투표가 조금 늦게 보여요. 그대로 써도 돼요.' + hint];
    return ['연결됨', ''];
  }
  /** 접속 확인(check.html)이 이 기기에 남긴 마지막 결과 */
  function lastCheck() { try { var v = JSON.parse(localStorage.getItem('lp-check:' + location.pathname.replace(/[^/]*$/, '')) || 'null'); return v && v.at ? v : null; } catch (e) { return null; } }
  function paintNet() {
    if (!C.net) return;
    var st = conn ? conn.status : 'offline', ni = conn && conn.netInfo ? conn.netInfo() : {};
    var w = netWords(st, ni), ck = lastCheck();
    C.box.setAttribute('data-state', LOCAL ? 'local' : st === 'offline' ? 'offline' : ni.transport === 'long' || ni.transport === 'poll' ? 'polling' : 'live');
    C.netWay.textContent = w[0]; C.netDo.textContent = w[1]; C.netDo.hidden = !w[1];
    C.netCk.textContent = '';
    if (ck) {
      var d = new Date(ck.at), when = (d.getMonth() + 1) + '. ' + d.getDate() + '. ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      C.netCk.appendChild(doc.createTextNode('접속 확인 ' + when + ' · ' + (ck.verdict || '') + (ck.live ? ' · 참여 기능 ' + ck.live : '') + ' '));
    } else C.netCk.appendChild(doc.createTextNode('연수 장소에서 접속 확인을 아직 하지 않았어요. 전날 그곳 Wi-Fi로 열어 보세요. '));
    var a = el('a', '', ck ? '다시 확인' : '접속 확인 열기'); a.href = 'check.html'; a.target = '_blank'; a.rel = 'noopener'; C.netCk.appendChild(a);
  }
  /** 맨 위 상자: 발표 화면(지금 크게 보이는 것·참여 QR 크게·끄기) · 묻기 방식(연결·접속 확인) · 연수가 끝났으면 기록 정리로 */
  function buildNet() {
    C.box = el('div', 'lp-con-net');
    var r1 = el('div', 'lp-con-net-r lp-con-stage'); r1.setAttribute('role', 'group'); r1.setAttribute('aria-labelledby', 'lp-stage-l');
    var h1 = el('p', 'lp-con-net-h'), b1 = el('b', '', '발표 화면'); b1.id = 'lp-stage-l'; h1.appendChild(b1); C.stageNow = el('span'); h1.appendChild(C.stageNow); r1.appendChild(h1);
    var act = el('div', 'lp-con-net-act');
    C.qrSw = el('button', 'lp-switch'); C.qrSw.type = 'button'; C.qrSw.setAttribute('role', 'switch'); C.qrSw.setAttribute('data-k', 'qrbig');
    C.qrSw.appendChild(el('i')); C.qrSw.appendChild(el('span', '', '참여 QR 크게')); C.qrSwS = el('small'); C.qrSw.appendChild(C.qrSwS);
    C.qrSw.addEventListener('click', function () { var on = !qrBig(); setState({ ui: { qrBig: on ? true : null } }, on ? '발표 화면에 참여 QR을 크게 띄웠어요.' : '발표 화면의 큰 QR을 내렸어요.'); });
    act.appendChild(C.qrSw);
    C.presOff = btn('발표 화면 끄기', '', function () { try { if (pres) pres.terminate(); } catch (e) { } say2('프로젝터의 발표 화면을 껐어요.'); }, 'presoff'); C.presOff.hidden = true; act.appendChild(C.presOff);
    r1.appendChild(act);
    C.stageHint = el('p', 'lp-con-net-do'); C.stageHint.setAttribute('role', 'status'); C.stageHint.hidden = true; r1.appendChild(C.stageHint);
    C.box.appendChild(r1);
    C.net = el('div', 'lp-con-net-r'); C.net.setAttribute('role', 'status'); C.net.setAttribute('aria-label', '연결 상태');
    var h = el('p', 'lp-con-net-h'); h.appendChild(el('b', '', '묻기 방식')); C.netWay = el('span'); h.appendChild(C.netWay); C.net.appendChild(h);
    C.netDo = el('p', 'lp-con-net-do'); C.net.appendChild(C.netDo);
    C.netCk = el('p', 'lp-con-net-ck'); C.net.appendChild(C.netCk);
    C.box.appendChild(C.net);
    if (ended()) {
      var r3 = el('div', 'lp-con-net-r lp-con-after'), h3 = el('p', 'lp-con-net-h');
      h3.appendChild(el('b', '', '연수 뒤')); h3.appendChild(el('span', '', '연수가 끝났어요. 명단·결과를 CSV로 받은 뒤 지워 주세요.')); r3.appendChild(h3);
      var go3 = el('a', 'lp-btn lp-btn-primary lp-btn-sm', '기록·정리로'); go3.href = '#lp-p-data';
      go3.addEventListener('click', function (e) { var t = $('#lp-p-data'); if (!t) return; e.preventDefault(); t.scrollIntoView({ block: 'start' }); var f = t.querySelector('button'); if (f) f.focus({ preventScroll: true }); });
      r3.appendChild(go3); C.box.appendChild(r3);
    }
    return C.box;
  }
  /** 연수 날짜·시간이 지났나(참가자 화면의 '끝난 연수'와 같은 기준). 주소 끝 ?phase=after로 미리보기 */
  function ended() { if (/[?&]phase=after\b/.test(location.search)) return true; var e = DATA.phase && Date.parse(DATA.phase.end); return !!e && Date.now() > e; }
  function qrBig() { return (state.ui || {}).qrBig === true; }
  function clip(t, n) { var c = Array.from ? Array.from(String(t || '')) : String(t || '').split(''); return c.length > n ? c.slice(0, n).join('') + '…' : c.join(''); }
  /** 발표 화면에 지금 크게 보이는 것(발표 화면과 같은 규칙: 열린 투표 > 질문 > 기다리는 화면) */
  function stageWords() {
    var op = allPolls().filter(function (p) { return p.id === state.openPoll; })[0], out = [];
    if (op) out.push('투표 「' + clip(op.question, 24) + '」 · ' + (X.revealed(state, op.id) ? '결과 공개' : '응답 수만'));
    else if (ON.qa) { var n = vals('questions').filter(function (q) { return q.status === 'open' || (q.pinned && q.status !== 'hidden'); }).length; out.push(n ? '질문 ' + n + '개(공감순)' : '질문을 기다리는 화면'); }
    else out.push('참여 안내');
    if (state.notice && state.notice.text) out.push('공지');
    if (state.timer && state.timer.running && state.timer.endsAt > now()) out.push('타이머');
    if (qrBig()) out.push('QR 크게');
    return out.join(' · ');
  }
  function paintStage() {
    if (!C.stageNow) return;
    C.stageNow.textContent = stageWords();
    var on = qrBig(); C.qrSw.setAttribute('aria-checked', String(on)); C.qrSwS.textContent = on ? '켜짐' : '꺼짐';
    C.presOff.hidden = !(pres && pres.state === 'connected');
  }

  function enter() {
    if (box) box.hidden = true; main.hidden = false; if (logout) logout.hidden = false; showAfterLogin(); if (connEl) connEl.hidden = false;
    conn.on('status', setConn); setConn(conn.status === 'polling' ? 'polling' : conn.status === 'offline' ? 'offline' : 'live');
    conn.on('status', function () { paintNet(); }); conn.on('net', function () { paintNet(); });
    addEventListener('storage', function (e) { if (e.key && e.key.indexOf('lp-check:') === 0) paintNet(); }); // 다른 탭에서 접속 확인을 마치면
    build(); loadAll(); conn.subscribe(onEvent);
    // 보드 '먼저 확인'(board.moderation)·파일 끄기: 서버가 새 글을 숨긴 채·파일 없이 받도록 상태에 적어 둠(관리자만 바꿀 수 있음)
    var mod = MODERATE || null, nof = NOFILES ? false : null, ui0 = state.ui || {}, pol = {};
    if ((ui0.moderation || null) !== mod) pol.moderation = mod;
    if ((ui0.uploads === false ? false : null) !== nof) pol.uploads = nof;
    if (Object.keys(pol).length) conn.setState({ ui: pol }).catch(function () { });
    try { main.focus({ preventScroll: true }); } catch (e) { main.focus(); }
    setInterval(function () { if (!doc.hidden) { queue(); paintNet(); } }, 30000); // '몇 분 전'·묻기 간격을 새로
  }
  function loadAll() {
    COLS.forEach(function (c) { conn.list(c, {}).then(function (a) { (a || []).forEach(function (d) { data[c][d.id] = d; }); queue(); }, function () { }); });
  }
  function onEvent(ev) {
    if (!ev) return;
    if (ev.type === 'state') { state = ev.doc || ev.state || {}; queue(); return; }
    if (ev.type === 'reset') { COLS.forEach(function (c) { data[c] = {}; }); queue(); return; }
    var bag = data[ev.col]; if (!bag || !ev.doc) return;
    if (ev.type === 'remove') delete bag[ev.doc.id]; else bag[ev.doc.id] = Object.assign(bag[ev.doc.id] || {}, ev.doc);
    if (ev.col === 'help' && ev.type === 'add') toast('도움 요청: ' + (ev.doc.nickname || '참가자') + (ev.doc.seat ? ' · ' + ev.doc.seat : ''));
    queue();
  }
  // 여러 기록이 한꺼번에 와도 한 번만 다시 그림
  var raf = 0; function queue() { if (raf) return; raf = (window.requestAnimationFrame || setTimeout)(function () { raf = 0; render(); }); }
  function setState(patch, ok) { return conn.setState(patch).then(function (s) { state = s || Object.assign(state, patch); queue(); if (ok) toast(ok); }, function (e) { toast('보내지 못했어요: ' + (e && e.message || '연결을 확인해 주세요.')); }); }
  function err(e) { toast('처리하지 못했어요: ' + (e && e.message || '권한이나 연결을 확인해 주세요.')); }
  /** 다시 그려도 누르던 단추에 초점이 남게(data-k로 찾음) */
  function keep(node, fn) {
    var a = doc.activeElement, k = a && node.contains(a) && a.getAttribute('data-k'); fn();
    if (k) { var b = node.querySelector('[data-k="' + k.replace(/"/g, '') + '"]'); if (b) b.focus(); }
  }

  // ── 틀 ──
  function panel(id, title, area, col) {
    var p = el('section', 'lp-card lp-con-panel'); p.id = 'lp-p-' + id; p.setAttribute('data-area', area); p.setAttribute('aria-labelledby', 'lp-ph-' + id);
    var h = el('div', 'lp-con-ph'), h2 = el('h2', '', title); h2.id = 'lp-ph-' + id; h.appendChild(h2);
    var act = el('div', 'lp-con-ph-act'); h.appendChild(act); p.appendChild(h);
    var body = el('div'); body.style.display = 'grid'; body.style.gap = '14px'; p.appendChild(body); col.appendChild(p);
    P[id] = { box: p, h: h2, act: act, body: body, title: title }; return body;
  }
  function count(id, n) { var x = P[id]; if (!x) return; x.h.textContent = x.title; if (n != null) { var s = el('small', '', String(n)); x.h.appendChild(s); } }
  function build() {
    main.textContent = '';
    main.appendChild(buildNet()); paintNet();
    C.strip = el('div', 'lp-con-strip'); C.strip.setAttribute('role', 'region'); C.strip.setAttribute('aria-label', '지금 상황'); main.appendChild(C.strip);
    var a = el('div', 'lp-con-col'), b = el('div', 'lp-con-col'); main.appendChild(a); main.appendChild(b);
    if (ON.qa) { panel('qa', '질문', 'qa', a); buildQA(); }
    panel('poll', '투표', 'poll', a); buildPoll();
    if (ON.board) { panel('board', '보드', 'board', a); buildBoard(); }
    if (ON.help) panel('help', '도움 요청', 'help', b);
    panel('run', '진행', 'run', b); buildRun();
    if (ON.signal) panel('signal', '이해 신호', 'signal', b);
    if (ON.progress) panel('heat', '실습 진행 현황', 'heat', b);
    panel('data', '기록·정리', 'data', b); buildData();
    render();
  }

  // ── 그리기 ──
  function render() {
    if (!C.strip) return;
    var parts = vals('participants'), help = vals('help'), qs = vals('questions');
    var openHelp = help.filter(function (h) { return h.status !== 'done'; });
    var sig = ON.signal ? signalCounts() : null;
    var op = allPolls().filter(function (p) { return p.id === state.openPoll; })[0];
    keep(C.strip, function () {
      C.strip.textContent = '';
      kpi(parts.length, '참가자', parts.length ? '연수 코드 ' + DATA.live.code : '아직 들어온 사람이 없어요', '');
      if (ON.help) kpi(openHelp.length, '도움 요청', openHelp[0] ? (openHelp[0].nickname || '참가자') + (openHelp[0].seat ? ' · ' + openHelp[0].seat : '') : '없어요', '#lp-p-help', openHelp.length > 0);
      if (ON.signal) { var rs = sig.total ? Math.round(sig.red / sig.total * 100) : 0; kpi(rs + '%', '모르겠어요', sig.total + '명 중 ' + sig.red + '명', '#lp-p-signal', sig.total > 0 && rs >= 25); }
      kpi(op ? pollAnswers(op.id).length : '–', '지금 투표', op ? op.question : '열린 투표가 없어요', '#lp-p-poll');
      if (ON.qa) kpi(qs.filter(function (q) { return q.status === 'open'; }).length, '열린 질문', '전체 ' + qs.length + '개', '#lp-p-qa');
      if (ON.survey) kpi(vals('survey').length, '설문 응답', '', '#lp-p-data');
    });
    doc.title = (openHelp.length ? '(' + openHelp.length + ') ' : '') + '강사 화면 · ' + (DATA.title || '');
    if (ON.qa) renderQA(qs);
    renderPolls();
    if (ON.board) renderBoard();
    if (ON.help) renderHelp(openHelp);
    syncRun();
    if (ON.signal) renderSignal(sig);
    if (ON.progress) renderHeat(parts);
    paintStage();
  }
  function kpi(value, label, sub, href, alert) {
    var d = el(href ? 'a' : 'div', 'lp-con-kpi'); if (href) { d.href = href; d.setAttribute('data-k', 'kpi' + label); }
    if (alert) d.setAttribute('data-alert', '');
    d.appendChild(el('b', '', String(value))); d.appendChild(el('span', '', label)); if (sub) d.appendChild(el('small', '', sub));
    C.strip.appendChild(d);
  }

  // 질문: 거르기(열림·답변 완료·숨김) + 고정·답변 완료·숨기기, 새 질문 받기 잠그기
  var qaFilter = 'open';
  function lockSwitch(which, label) {
    var b = el('button', 'lp-switch'); b.type = 'button'; b.setAttribute('role', 'switch'); b.setAttribute('data-k', 'lock-' + which);
    b.appendChild(el('i')); b.appendChild(el('span', '', label)); var s = el('small'); b.appendChild(s);
    b.addEventListener('click', function () { var lock = !X.locked(state, which); setState(X.lockPatch(which, lock), lock ? (which === 'qa' ? '새 질문을 잠갔어요. 참가자 화면에 안내가 떠요.' : '새 보드 글을 잠갔어요.') : (which === 'qa' ? '질문을 다시 받아요.' : '보드 글을 다시 받아요.')); });
    b._sync = function () { var on = !X.locked(state, which); b.setAttribute('aria-checked', String(on)); s.textContent = on ? '켜짐' : '꺼짐'; };
    return b;
  }
  function buildQA() {
    var b = P.qa.body;
    C.qaLock = lockSwitch('qa', '질문 받기'); P.qa.act.appendChild(C.qaLock);
    var seg = el('div', 'lp-seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', '보일 질문');
    C.qaSeg = {};
    [['open', '열림'], ['answered', '답변 완료'], ['hidden', '숨김']].forEach(function (x) {
      var s = el('button', '', x[1]); s.type = 'button'; s.setAttribute('data-k', 'f-' + x[0]); s.setAttribute('aria-pressed', String(qaFilter === x[0]));
      s.addEventListener('click', function () { qaFilter = x[0]; Object.keys(C.qaSeg).forEach(function (k) { C.qaSeg[k].setAttribute('aria-pressed', String(k === qaFilter)); }); renderQA(vals('questions')); });
      C.qaSeg[x[0]] = s; seg.appendChild(s);
    });
    b.appendChild(seg);
    C.qaList = el('ul', 'lp-con-list'); C.qaList.setAttribute('aria-label', '질문 목록'); b.appendChild(C.qaList);
    b.appendChild(el('p', 'lp-con-sub', '공감이 많은 순, 고정한 질문이 맨 위예요. 숨긴 질문은 참가자·발표 화면에서 사라져요. 링크가 든 질문은 발표 화면에서 주소를 가려요.'));
  }
  function renderQA(qs) {
    if (C.qaLock) C.qaLock._sync();
    var n = { open: 0, answered: 0, hidden: 0 }; qs.forEach(function (q) { if (n[q.status] !== undefined) n[q.status]++; });
    Object.keys(C.qaSeg).forEach(function (k) { C.qaSeg[k].textContent = ({ open: '열림', answered: '답변 완료', hidden: '숨김' })[k] + ' ' + n[k]; });
    count('qa', qs.length);
    var list = qs.filter(function (q) { return (q.status || 'open') === qaFilter; }).sort(function (a, b) { return (!!b.pinned - !!a.pinned) || (b.votes || 0) - (a.votes || 0) || (b.createdAt || 0) - (a.createdAt || 0); });
    keep(C.qaList, function () {
      C.qaList.textContent = '';
      if (!list.length) { C.qaList.appendChild(el('li', 'lp-con-empty', qaFilter === 'open' ? '아직 질문이 없어요. 참가자 화면의 [질문]에서 올라와요.' : '해당하는 질문이 없어요.')); return; }
      list.forEach(function (q) {
        var li = el('li', 'lp-con-item' + (q.pinned ? ' is-pinned' : '') + (q.status === 'hidden' ? ' is-off' : ''));
        var v = el('div', 'lp-con-v'); v.appendChild(el('b', '', String(q.votes || 0))); v.appendChild(el('span', '', '공감')); li.appendChild(v);
        li.appendChild(el('p', 'lp-con-t', q.text || ''));
        var m = el('p', 'lp-con-m');
        if (q.pinned) m.appendChild(el('b', '', '고정'));
        m.appendChild(el('span', '', q.anonymous || !q.nickname ? '익명' : q.nickname)); m.appendChild(el('span', '', ago(q.createdAt)));
        if (U.hasLink && U.hasLink(q.text)) m.appendChild(el('em', '', '링크 있음'));
        li.appendChild(m);
        var a = el('div', 'lp-con-a');
        a.appendChild(btn(q.pinned ? '고정 풀기' : '고정', '', function () { conn.update('questions', q.id, { pinned: !q.pinned }).catch(err); }, 'pin' + q.id));
        if (q.status !== 'hidden') a.appendChild(btn(q.status === 'answered' ? '다시 열기' : '답변 완료', '', function () { conn.update('questions', q.id, { status: q.status === 'answered' ? 'open' : 'answered' }).catch(err); }, 'ans' + q.id));
        a.appendChild(btn(q.status === 'hidden' ? '다시 보이기' : '숨기기', '', function () { conn.update('questions', q.id, { status: q.status === 'hidden' ? 'open' : 'hidden', pinned: false }).catch(err); }, 'hide' + q.id));
        li.appendChild(a); C.qaList.appendChild(li);
      });
    });
  }

  // 투표: 지금 열린 투표(막대) · 나머지 투표 · 즉석 투표 만들기
  function quickPolls() {
    return vals('polls').filter(function (q) { return q.question && Array.isArray(q.options) && q.options.length; })
      .sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); })
      .map(function (q) { return { id: q.id, question: q.question, kind: 'choice', options: q.options, quick: true, open: q.open !== false }; });
  }
  function allPolls() { return polls.concat(quickPolls()); }
  function pollAnswers(id) { return vals('answers').filter(function (a) { return a.poll === id; }); }
  /** 열기·닫기. 즉석 투표는 닫으면 서버에서도 닫아 늦은 답을 받지 않음 */
  function togglePoll(p, openNow) {
    setState({ openPoll: openNow ? '' : p.id }, openNow ? '투표를 닫았어요.' : '투표를 띄웠어요. 참가자 화면과 발표 화면에 나와요.');
    if (p.quick && p.open === openNow) conn.update('polls', p.id, { open: !openNow }).catch(function () { });
  }
  function buildPoll() {
    var b = P.poll.body;
    C.pollNow = el('div'); b.appendChild(C.pollNow);
    C.pollList = el('ul', 'lp-con-polls'); C.pollList.setAttribute('aria-label', '투표 목록'); b.appendChild(C.pollList);
    var d = el('details', 'lp-con-quick'); var sm = el('summary'); sm.innerHTML = '<svg class="lp-ic" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'; sm.appendChild(el('span', '', '즉석 투표 만들기')); d.appendChild(sm);
    var f = el('form'); f.setAttribute('aria-label', '즉석 투표 만들기');
    var lq = el('label', 'lp-con-sub', '질문 한 줄'); var q = el('input', 'lp-in'); q.maxLength = 120; q.placeholder = '예: 지금 몇 번 실습을 하고 있나요?'; q.id = 'lp-qp-q'; lq.htmlFor = 'lp-qp-q';
    f.appendChild(lq); f.appendChild(q);
    var og = el('div', 'lp-con-opts'), opts = [];
    function addOpt() { if (opts.length >= 5) return; var o = el('input', 'lp-in'); o.maxLength = 40; o.placeholder = '보기 ' + (opts.length + 1); o.setAttribute('aria-label', '보기 ' + (opts.length + 1)); opts.push(o); og.appendChild(o); more.hidden = opts.length >= 5; return o; }
    var more = btn('보기 추가', '', function () { var o = addOpt(); if (o) o.focus(); });
    f.appendChild(og); addOpt(); addOpt(); addOpt();
    var row = el('div', 'lp-con-row'); var goB = el('button', 'lp-btn lp-btn-primary lp-btn-sm', '바로 띄우기'); goB.type = 'submit';
    row.appendChild(goB); row.appendChild(more); f.appendChild(row);
    f.appendChild(el('p', 'lp-con-sub', '보기는 2~5개. 띄우면 지금 열린 투표 대신 이 투표가 나와요.'));
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var question = q.value.trim(), list = [];
      opts.forEach(function (o) { var v = o.value.trim(); if (v && list.indexOf(v) < 0) list.push(v); });
      if (!question) { toast('질문을 적어 주세요.'); q.focus(); return; }
      if (list.length < 2) { toast('보기를 두 개 이상 적어 주세요.'); (opts[list.length] || opts[0]).focus(); return; }
      goB.disabled = true;
      conn.add('polls', { question: question, kind: 'choice', options: list, open: true }).then(function (dd) {
        if (!dd || !dd.id) throw new Error('투표를 만들지 못했어요.');
        data.polls[dd.id] = dd; q.value = ''; opts.forEach(function (o) { o.value = ''; });
        return setState({ openPoll: dd.id }, '투표를 띄웠어요. 참가자 화면과 발표 화면에 나와요.');
      }).catch(err).then(function () { goB.disabled = false; });
    });
    d.appendChild(f); b.appendChild(d);
  }
  function tally(p, list) { var t = {}; list.forEach(function (a) { [].concat(a.value).forEach(function (v) { t[v] = (t[v] || 0) + 1; }); }); return t; }
  function renderPolls() {
    var all = allPolls(), op = all.filter(function (p) { return p.id === state.openPoll; })[0], hidden = X.hiddenWords(state);
    count('poll', all.length || null);
    keep(C.pollNow, function () {
      C.pollNow.textContent = '';
      if (!op) { C.pollNow.appendChild(el('p', 'lp-con-sub', all.length ? '지금 열린 투표가 없어요. 아래에서 열거나 즉석 투표를 만들어요.' : '미리 넣은 투표가 없어요. 아래 [즉석 투표 만들기]로 바로 띄울 수 있어요.')); return; }
      var list = pollAnswers(op.id), shown = X.revealed(state, op.id), box = el('div', 'lp-con-poll');
      var h = el('div', 'lp-con-poll-h'); h.appendChild(el('p', '', op.question)); h.appendChild(el('small', '', '응답 ' + list.length + '명')); box.appendChild(h);
      if (op.kind === 'word') {
        var words = U.wordCloud(list, op.id, {}), wl = el('div', 'lp-con-words');
        words.slice(0, 24).forEach(function (w) {
          var off = hidden.indexOf(w.word) >= 0, chip = el('span', 'lp-con-word' + (off ? ' is-off' : ''));
          chip.appendChild(el('span', '', w.word + ' ' + w.count));
          chip.appendChild(btn(off ? '보이기' : '숨기기', '', function () { setState(X.hiddenPatch(state, w.word, !off)); }, 'w' + w.word));
          wl.appendChild(chip);
        });
        if (!words.length) wl.appendChild(el('p', 'lp-con-sub', '아직 낱말이 없어요.'));
        box.appendChild(wl);
      } else {
        var t = tally(op, list), opts = op.options && op.options.length ? op.options : Object.keys(t), total = Math.max(list.length, 1), ul = el('ol', 'lp-con-tally');
        opts.forEach(function (o) { var n = t[o] || 0, li = el('li', 'lp-con-tl'); li.appendChild(el('span', '', o)); li.appendChild(el('b', '', Math.round(n / total * 100) + '% · ' + n + '명')); var i = el('i'); i.style.setProperty('--w', Math.round(n / total * 100) + '%'); li.appendChild(i); ul.appendChild(li); });
        box.appendChild(ul);
      }
      var row = el('div', 'lp-con-row');
      var rv = btn(shown ? '결과 숨기기' : '결과 공개', shown ? '' : 'lp-btn-primary', function () { setState(X.revealPatch(state, op.id, !shown), shown ? '참가자 화면에서 결과를 숨겼어요.' : '참가자 화면에 결과를 공개했어요.'); }, 'rv' + op.id);
      row.appendChild(rv); row.appendChild(btn('투표 닫기', '', function () { togglePoll(op, true); }, 'cl' + op.id));
      box.appendChild(row);
      box.appendChild(el('p', 'lp-con-sub', shown ? '참가자 화면과 발표 화면에 결과가 보여요.' : '결과는 아직 강사 화면에만 보여요. 발표 화면에는 응답 수만 나와요.'));
      C.pollNow.appendChild(box);
    });
    keep(C.pollList, function () {
      C.pollList.textContent = '';
      all.filter(function (p) { return p !== op; }).forEach(function (p) {
        var li = el('li'), t = el('p', '', (p.quick ? '즉석 · ' : '') + p.question); t.appendChild(el('small', '', '응답 ' + pollAnswers(p.id).length + '명' + (p.quick && !p.open ? ' · 닫힘' : '')));
        li.appendChild(t); li.appendChild(btn('열기', '', function () { togglePoll(p, false); }, 'op' + p.id)); C.pollList.appendChild(li);
      });
    });
  }

  // 보드: 새 글 받기 잠그기, 먼저 확인(보드에 올리기), 숨기기
  function buildBoard() {
    C.bLock = lockSwitch('board', '새 글 받기'); P.board.act.appendChild(C.bLock);
    C.bList = el('ul', 'lp-con-list'); C.bList.setAttribute('aria-label', '보드 글 목록'); P.board.body.appendChild(C.bList);
    if (MODERATE) P.board.body.appendChild(el('p', 'lp-con-sub', '먼저 확인하기가 켜져 있어요. 새 글은 [보드에 올리기]를 눌러야 참가자에게 보여요.'));
  }
  function renderBoard() {
    C.bLock._sync();
    var posts = vals('posts').sort(function (a, b) { return (!!b.hidden - !!a.hidden) * (MODERATE ? 1 : 0) || (b.createdAt || 0) - (a.createdAt || 0); });
    var waiting = posts.filter(function (p) { return p.hidden; }).length;
    count('board', MODERATE && waiting ? '확인 기다림 ' + waiting : posts.length);
    keep(C.bList, function () {
      C.bList.textContent = '';
      if (!posts.length) { C.bList.appendChild(el('li', 'lp-con-empty', '아직 글이 없어요.')); return; }
      posts.forEach(function (p) {
        var li = el('li', 'lp-con-item is-nov' + (p.hidden ? ' is-off' : ''));
        var t = el('p', 'lp-con-t'); t.appendChild(el('span', 'lp-con-who', (p.nickname || '익명') + ' ')); t.appendChild(doc.createTextNode(p.text || (p.files && p.files.length ? '(파일 ' + p.files.length + '개)' : ''))); li.appendChild(t);
        var m = el('p', 'lp-con-m'); m.appendChild(el('span', '', ago(p.createdAt))); if (p.files && p.files.length) m.appendChild(el('span', '', '파일 ' + p.files.length + '개'));
        if (p.hidden) m.appendChild(el('em', '', MODERATE ? '확인 기다림' : '숨김')); if (U.hasLink && U.hasLink(p.text)) m.appendChild(el('em', '', '링크 있음'));
        li.appendChild(m);
        var a = el('div', 'lp-con-a');
        a.appendChild(btn(p.hidden ? (MODERATE ? '보드에 올리기' : '다시 보이기') : '숨기기', p.hidden && MODERATE ? 'lp-btn-primary' : '', function () { conn.update('posts', p.id, { hidden: !p.hidden }).catch(err); }, 'ph' + p.id));
        li.appendChild(a); C.bList.appendChild(li);
      });
    });
  }

  // 도움 요청
  function renderHelp(open) {
    open.sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
    count('help', open.length);
    var hb = P.help.body;
    keep(hb, function () {
      hb.textContent = '';
      var ul = el('ul', 'lp-con-list'); ul.setAttribute('aria-label', '도움 요청 목록');
      if (!open.length) ul.appendChild(el('li', 'lp-con-empty', '지금은 도움 요청이 없어요.'));
      open.forEach(function (h) {
        var st = stations.filter(function (s) { return s.id === h.station; })[0];
        var li = el('li', 'lp-con-item is-nov' + (h.status === 'claimed' ? ' is-pinned' : ''));
        li.appendChild(el('p', 'lp-con-t lp-con-who', (h.nickname || '참가자') + (h.seat ? ' · ' + h.seat : '')));
        if (h.message) li.appendChild(el('p', 'lp-con-t', h.message));
        var m = el('p', 'lp-con-m'); m.appendChild(el('span', '', st ? st.name || st.title : '실습 칸 모름')); m.appendChild(el('span', '', ago(h.createdAt))); if (h.status === 'claimed') m.appendChild(el('b', '', (h.assignee || '강사') + ' 가는 중')); li.appendChild(m);
        var a = el('div', 'lp-con-a');
        if (h.status !== 'claimed') a.appendChild(btn('갈게요', '', function () { conn.update('help', h.id, { status: 'claimed', assignee: '강사' }).catch(err); }, 'go' + h.id));
        a.appendChild(btn('해결', 'lp-btn-primary', function () { conn.update('help', h.id, { status: 'done' }).catch(err); }, 'ok' + h.id));
        li.appendChild(a); ul.appendChild(li);
      });
      hb.appendChild(ul);
    });
  }

  // 진행: 공지·타이머·따라 넘기기·실습·교재 쪽·자료 링크
  function sec(title) { var s = el('div', 'lp-con-sec'); s.appendChild(el('h3', '', title)); P.run.body.appendChild(s); return s; }
  function buildRun() {
    var s1 = sec('공지'); C.notice = el('div'); s1.appendChild(C.notice);
    var r1 = el('form', 'lp-con-row'); var nt = el('input', 'lp-in'); nt.placeholder = '예: 15:10까지 실습하고 앞을 봐 주세요'; nt.maxLength = 120; nt.setAttribute('aria-label', '공지 문구');
    var nb = el('button', 'lp-btn lp-btn-primary lp-btn-sm', '공지 보내기'); nb.type = 'submit';
    r1.appendChild(nt); r1.appendChild(nb); s1.appendChild(r1);
    r1.addEventListener('submit', function (e) { e.preventDefault(); var v = nt.value.trim(); if (!v) { nt.focus(); return; } setState({ notice: { text: v, level: 'info' } }, '공지를 보냈어요. 참가자·발표 화면 위에 보여요.').then(function () { nt.value = ''; }); });

    var s2 = sec('타이머'); C.clock = el('div', 'lp-con-clock'); s2.appendChild(C.clock);
    var r2 = el('div', 'lp-con-row');
    [1, 3, 5, 10, 15].forEach(function (m) { r2.appendChild(btn(m + '분', '', function () { startTimer(m); }, 't' + m)); });
    s2.appendChild(r2);
    var r2b = el('form', 'lp-con-row'); var tm = el('input', 'lp-in'); tm.type = 'number'; tm.min = 1; tm.max = 180; tm.placeholder = '분'; tm.style.flex = '0 1 6em'; tm.setAttribute('aria-label', '타이머 분');
    var tl = el('input', 'lp-in'); tl.maxLength = 40; tl.placeholder = '이름(선택, 예: 모둠 토의)'; tl.setAttribute('aria-label', '타이머 이름');
    var tg = el('button', 'lp-btn lp-btn-sm', '시작'); tg.type = 'submit';
    r2b.appendChild(tm); r2b.appendChild(tl); r2b.appendChild(tg); s2.appendChild(r2b);
    r2b.addEventListener('submit', function (e) { e.preventDefault(); var m = Math.round(+tm.value); if (!(m >= 1 && m <= 180)) { toast('1~180분 사이로 넣어 주세요.'); tm.focus(); return; } startTimer(m, tl.value.trim()); tm.value = ''; tl.value = ''; });
    function startTimer(m, label) { setState({ timer: { endsAt: now() + m * 60000, label: label || '', running: true } }, m + '분 타이머를 시작했어요.'); }
    s2.appendChild(el('p', 'lp-con-sub', '타이머 여러 개·이름 뽑기·모둠 만들기는 발표 화면의 [도구]에 있어요.'));

    var s3 = sec('참가자 화면 이끌기');
    C.follow = el('button', 'lp-switch'); C.follow.type = 'button'; C.follow.setAttribute('role', 'switch'); C.follow.setAttribute('data-k', 'follow');
    C.follow.appendChild(el('i')); C.follow.appendChild(el('span', '', '강사 따라 넘기기')); C.followS = el('small'); C.follow.appendChild(C.followS);
    C.follow.addEventListener('click', function () { setState({ follow: !state.follow }, !state.follow ? '참가자 화면이 강사가 고른 실습·쪽으로 움직여요.' : '참가자가 자유롭게 넘겨요.'); });
    s3.appendChild(C.follow);
    if (stations.length) {
      var r3 = el('div', 'lp-con-row'); var sel = el('select', 'lp-in'); sel.setAttribute('aria-label', '지금 실습');
      var o0 = el('option', '', '지금 실습 고르기'); o0.value = ''; sel.appendChild(o0);
      stations.forEach(function (s, i) { var o = el('option', '', (i + 1) + '. ' + (s.name || s.title)); o.value = s.id; sel.appendChild(o); });
      sel.addEventListener('change', function () { setState({ step: sel.value }); }); r3.appendChild(sel);
      r3.appendChild(btn('다음 실습', '', function () { var i = stations.findIndex(function (s) { return s.id === state.step; }); var n = stations[Math.min(stations.length - 1, i + 1)]; if (n) setState({ step: n.id }); }));
      s3.appendChild(r3); C.step = sel;
    }
    if (BP.deck) {
      var r4 = el('div', 'lp-con-row');
      var pv = btn('앞 쪽', '', function () { setState({ slide: Math.max(1, (state.slide || 1) - 1) }); });
      var inp = el('input', 'lp-in'); inp.type = 'number'; inp.min = 1; inp.max = BP.deck; inp.placeholder = '쪽'; inp.style.flex = '0 1 6em'; inp.setAttribute('aria-label', '교재 쪽(1~' + BP.deck + ')');
      var nx = btn('다음 쪽', '', function () { setState({ slide: Math.min(BP.deck, (state.slide || 0) + 1) }); });
      r4.appendChild(pv); r4.appendChild(inp); r4.appendChild(btn('이 쪽 보내기', '', function () { setState({ slide: Math.max(1, Math.min(BP.deck, Math.round(+inp.value) || 1)) }); })); r4.appendChild(nx);
      s3.appendChild(r4); C.slide = inp;
    }
    // 자료 링크: 연수 중에 덧붙이면 참가자 화면의 자료실에 바로 보임(파일은 드라이브 등에 올린 공유 주소로)
    var s4 = sec('자료 링크');
    var r5 = el('form', 'lp-con-row'); var mt = el('input', 'lp-in'); mt.placeholder = '자료 이름'; mt.maxLength = 40; mt.setAttribute('aria-label', '자료 이름');
    var mu = el('input', 'lp-in'); mu.type = 'url'; mu.placeholder = 'https://'; mu.setAttribute('aria-label', '자료 주소(https)'); mu.style.flex = '2 1 12em';
    var mb = el('button', 'lp-btn lp-btn-sm', '자료 추가'); mb.type = 'submit';
    r5.appendChild(mt); r5.appendChild(mu); r5.appendChild(mb); s4.appendChild(r5);
    r5.addEventListener('submit', function (e) {
      e.preventDefault(); var patch = X.materialAdd(state, mu.value, mt.value);
      if (patch.error) { toast(patch.error); mu.focus(); return; }
      setState(patch, '자료를 추가했어요. 참가자 화면의 자료실에 보여요.'); mt.value = ''; mu.value = '';
    });
    C.mats = el('ul', 'lp-con-mats'); s4.appendChild(C.mats);
    clearInterval(C.tick); C.tick = setInterval(drawClock, 1000);
  }
  function drawClock() {
    if (!C.clock) return;
    var t = state.timer, run = t && t.running && t.endsAt;
    if (!run) { if (C.clock.getAttribute('data-on') !== '0') { C.clock.setAttribute('data-on', '0'); C.clock.textContent = ''; C.clock.appendChild(el('p', 'lp-con-sub', '돌아가는 타이머가 없어요.')); } return; }
    var left = t.endsAt - now();
    if (C.clock.getAttribute('data-on') !== '1') {
      C.clock.setAttribute('data-on', '1'); C.clock.textContent = '';
      C.clockB = el('b'); C.clockL = el('span', 'lp-con-sub'); C.clock.appendChild(C.clockB); C.clock.appendChild(C.clockL);
      C.clock.appendChild(btn('멈춤', '', function () { setState({ timer: null }, '타이머를 멈췄어요.'); }, 'tstop'));
    }
    C.clockB.textContent = left <= 0 ? '0:00' : mmss(left); C.clockL.textContent = (t.label ? t.label + ' · ' : '') + (left <= 0 ? '시간이 다 됐어요' : '남은 시간');
    if (left <= 0) C.clock.setAttribute('data-over', ''); else C.clock.removeAttribute('data-over');
  }
  function syncRun() {
    if (!C.notice) return;
    keep(C.notice, function () {
      C.notice.textContent = '';
      if (state.notice && state.notice.text) { var n = el('div', 'lp-con-now'); n.appendChild(el('p', '', state.notice.text)); n.appendChild(btn('공지 내리기', '', function () { setState({ notice: null }, '공지를 내렸어요.'); }, 'nclear')); C.notice.appendChild(n); }
      else C.notice.appendChild(el('p', 'lp-con-sub', '보낸 공지가 없어요.'));
    });
    drawClock();
    C.follow.setAttribute('aria-checked', String(!!state.follow)); C.followS.textContent = state.follow ? '켜짐' : '꺼짐';
    if (C.step && doc.activeElement !== C.step) C.step.value = state.step || '';
    if (C.slide && doc.activeElement !== C.slide && state.slide) C.slide.value = state.slide;
    keep(C.mats, function () {
      C.mats.textContent = '';
      X.materials(state).forEach(function (m) {
        var li = el('li'); var a = el('a', '', m.title); a.href = m.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.appendChild(a);
        li.appendChild(btn('지우기', '', function () { setState(X.materialRemove(m.slot), '자료를 지웠어요.'); }, 'mat' + m.slot));
        C.mats.appendChild(li);
      });
    });
  }

  // 이해 신호
  function signalCounts() {
    var reset = X.signalReset(state), latest = {};
    vals('answers').forEach(function (a) {
      if (a.poll !== 'signal') return; var t = a.updatedAt || a.createdAt || 0;
      if (t < reset) return;
      var who = a.by || a.id; // one signal doc per participant: the id works when `by` is not shown
      if (!latest[who] || t >= (latest[who].updatedAt || latest[who].createdAt || 0)) latest[who] = a;
    });
    var c = { green: 0, yellow: 0, red: 0, total: 0 };
    Object.keys(latest).forEach(function (k) { var v = latest[k].value; if (c[v] !== undefined) { c[v]++; c.total++; } });
    return c;
  }
  var SIG = [['green', 'g', '✓', '이해했어요'], ['yellow', 'y', '?', '조금 헷갈려요'], ['red', 'r', '!', '모르겠어요']];
  var sigAlert = false;
  function renderSignal(c) {
    var sg = P.signal.body; count('signal', c.total || null);
    keep(sg, function () {
      sg.textContent = '';
      if (!c.total) sg.appendChild(el('p', 'lp-con-sub', '참가자가 신호를 보내면 여기에 모여요.'));
      else {
        var bar = el('div', 'lp-sig'); bar.setAttribute('aria-hidden', 'true');
        SIG.forEach(function (x) { var i = el('i', x[1]); i.style.width = (c[x[0]] / c.total * 100) + '%'; bar.appendChild(i); });
        var lg = el('ul', 'lp-sig-l'); SIG.forEach(function (x) { var li = el('li'); var i = el('i', x[1], x[2]); i.setAttribute('aria-hidden', 'true'); li.appendChild(i); li.appendChild(doc.createTextNode(x[3] + ' ')); li.appendChild(el('b', '', c[x[0]] + '명')); lg.appendChild(li); });
        sg.appendChild(bar); sg.appendChild(lg);
        var red = c.red / c.total;
        if (red >= 0.25 && !sigAlert) { sigAlert = true; toast('모르겠어요 신호가 ' + Math.round(red * 100) + '%예요. 잠시 멈추고 확인해 보세요.'); }
        if (red < 0.2) sigAlert = false;
      }
      var r = X.signalReset(state), row = el('div', 'lp-con-row');
      row.appendChild(btn('신호 비우기', '', function () { setState({ ui: { signalReset: now() } }, '신호를 비웠어요. 참가자 화면의 선택도 지워져요.'); }, 'sreset'));
      if (r) row.appendChild(el('span', 'lp-con-sub', '마지막으로 비운 때 ' + new Date(r).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })));
      sg.appendChild(row);
    });
  }
  // 실습 진행 현황
  function renderHeat(parts) {
    var latest = {}; vals('progress').forEach(function (p) { var k = (p.by || p.id) + '|' + p.station; if (!latest[k] || (p.at || p.createdAt) >= (latest[k].at || latest[k].createdAt)) latest[k] = p; });
    var prog = Object.keys(latest).map(function (k) { return latest[k]; });
    var hb = P.heat.body; hb.textContent = '';
    var total = Math.max(parts.length, 1), ul = el('ul', 'lp-heat');
    stations.forEach(function (s) {
      var c = { done: 0, doing: 0, stuck: 0 }; prog.forEach(function (p) { if (p.station === s.id && c[p.status] !== undefined) c[p.status]++; });
      var li = el('li'); li.appendChild(el('span', '', s.name || s.title));
      var bar = el('div', 'lp-heat-bar'); bar.setAttribute('aria-hidden', 'true'); ['done', 'doing', 'stuck'].forEach(function (t) { var i = el('i', t); i.style.width = (c[t] / total * 100) + '%'; bar.appendChild(i); });
      li.appendChild(bar); li.appendChild(el('small', '', '완료 ' + c.done + ' · 하는 중 ' + c.doing + (c.stuck ? ' · 막힘 ' + c.stuck : ''))); ul.appendChild(li);
    });
    hb.appendChild(ul);
    hb.appendChild(el('p', 'lp-con-sub', '초록 완료 · 강조색 하는 중 · 빨강 막힘. 참가자 ' + parts.length + '명 기준이에요.'));
  }

  // 기록·정리: CSV(칸마다 수식 막기를 한 번 더), 데이터 모두 지우기(확인 창), 참여 QR
  var KINDS = [
    ['participants', '참가자', true], ['attendance', '출석', true], ['completion', '이수자 명단', true], ['progress', '실습 진행', ON.progress],
    ['questions', '질문', ON.qa], ['posts', '보드 글', ON.board], ['help', '도움 요청', ON.help], ['answers', '투표·신호 응답', true], ['survey', '설문 응답', ON.survey],
  ];
  /** 투표 응답 CSV의 첫 열(투표 id)을 질문 글로 바꿈: 즉석 투표 id는 알아보기 어려움 */
  function pollNames(csv) {
    var names = { signal: '신호등' }; allPolls().forEach(function (p) { names[p.id] = p.question; });
    return String(csv || '').split('\n').map(function (line, i) {
      var c = line.indexOf(','); if (!i || c < 1) return line;
      var n = names[line.slice(0, c)]; if (!n) return line;
      return '"' + n.replace(/"/g, '""') + '"' + line.slice(c);
    }).join('\n');
  }
  function completionOpts() { return { date: DATA.date || '', start: DATA.start || '', end: DATA.end || '', rate: (DATA.admin || {}).completionRate, survey: (DATA.survey || 0) > 0, stations: stations.length }; }
  function buildData() {
    var b = P.data.body;
    var s1 = el('div', 'lp-con-sec'); s1.style.borderTop = '0'; s1.style.paddingTop = '0'; s1.appendChild(el('h3', '', '기록 내려받기(CSV)'));
    var g = el('div', 'lp-con-dl');
    KINDS.filter(function (k) { return k[2]; }).forEach(function (x) {
      g.appendChild(btn(x[1], '', function () {
        conn.exportCsv(x[0], x[0] === 'completion' ? completionOpts() : undefined).then(function (csv) {
          if (x[0] === 'answers') csv = pollNames(csv);
          save((DATA.title || 'lecpage').replace(/[\\/:*?"<>|]/g, '').slice(0, 60) + '_' + x[1].replace(/[·\s]/g, '') + '.csv', U.csvGuard ? U.csvGuard(csv || '') : csv || '');
          toast(x[1] + ' 기록을 내려받았어요.');
        }, err);
      }, 'dl' + x[0]));
    });
    s1.appendChild(g);
    var rate = (DATA.admin || {}).completionRate; rate = rate == null ? 90 : rate;
    s1.appendChild(el('p', 'lp-con-sub', '이수자 명단: 연수 시간(' + (DATA.start || '?') + '~' + (DATA.end || '?') + ')의 ' + rate + '% 이상 머물렀고' + ((DATA.survey || 0) > 0 ? ' 설문을 낸' : '') + ' 사람을 O로 적어요. 입실·퇴실 기록이 없으면 \'확인 필요\'예요.'));
    b.appendChild(s1);
    var s2 = el('div', 'lp-con-sec'); s2.appendChild(el('h3', '', '지우기'));
    s2.appendChild(el('p', 'lp-con-sub', LOCAL ? '리허설 기록은 이 브라우저에만 있어요. 실제 연수 전에 지워 두세요.' : '연수가 끝나고 ' + ((DATA.privacy || {}).retentionDays || 30) + '일 안에 모든 기록을 지워 주세요. 내려받은 CSV에도 별명이 들어 있어요.'));
    var dlg = $('[data-purge-dialog]');
    var del = btn('데이터 모두 지우기', 'lp-btn-danger', function () { if (dlg && dlg.showModal) dlg.showModal(); else if (window.confirm('모든 기록을 지울까요? 되돌릴 수 없어요.')) purge(); }, 'purge');
    var r = el('div', 'lp-con-row'); r.appendChild(del); s2.appendChild(r); b.appendChild(s2);
    var goP = dlg && $('[data-purge-go]', dlg);
    if (goP) goP.addEventListener('click', function () { dlg.close(); purge(); });
    if (dlg) dlg.addEventListener('close', function () { del.focus(); });
    // 참여 QR: 파일로 열었거나 미리보기면 주소 대신 안내(meta.siteUrl이 있으면 그 주소). 암호 보호면 #k=를 QR에만 붙임
    var local = /^(file|about|blob|data):$/.test(location.protocol);
    // QR에는 원래 주소만(짧은 주소는 글자로만 — 중간 화면이 있는 서비스에는 #k=가 보임). 파일로 열어 원래 주소를 모르면 짧은 주소를 글자로
    var site = DATA.siteUrl || siteDir();
    var u = site || (local ? DATA.shortUrl || '' : '');
    var ul = $('meta[name="lp-unlock"]'), qu = site ? site.split('#')[0] + (ul && ul.getAttribute('content') ? '#' + ul.getAttribute('content') : '') : '';
    var s3 = el('div', 'lp-con-sec'); s3.appendChild(el('h3', '', '참여 주소'));
    var j = el('div', 'lp-con-join'); var q = el('div', 'lp-qr'); q.setAttribute('role', 'img'); q.setAttribute('aria-label', '참여 QR 코드'); // copy-ok: 화면 읽기 이름표는 'QR 코드'도 됨(writing.md 4절)
    if (qu && window.qrcode) { try { if (qrcode.stringToBytesFuncs) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']; var qq = qrcode(0, 'M'); qq.addData(qu); qq.make(); q.innerHTML = qq.createSvgTag({ cellSize: 4, margin: 16, scalable: true }); } catch (e) { } }
    else q.appendChild(el('span', 'lp-qr-off', '인터넷에 올리면 QR이 나와요.'));
    var su = String(DATA.shortUrl || ''); if (!u || su.replace(/\/$/, '') === u.replace(/\/$/, '')) su = '';
    var dl = el('dl'); var add = function (k, v) { var dv = el('div'); dv.appendChild(el('dt', '', k)); dv.appendChild(el('dd', '', v)); dl.appendChild(dv); };
    add('참가자 주소', u ? u.replace(/^https?:\/\//, '') : '인터넷에 올리면 여기에 나와요.');
    if (su) { su = su.replace(/^https?:\/\//, '').replace(/\/$/, ''); try { su = decodeURI(su); } catch (e) { } add('짧은 주소', su); }
    add('연수 코드', DATA.live.code);
    j.appendChild(q); j.appendChild(dl); s3.appendChild(j); b.appendChild(s3);
  }
  function purge() { conn.purge().then(function () { COLS.forEach(function (k) { data[k] = {}; }); queue(); toast('모든 기록을 지웠어요.'); }, err); }

  // ── 휴대폰에서 열기: 관리자 키가 든 QR(주소 뒤 #key=, 서버로 가지 않음) ──
  // 누를 때만 보이고 60초 뒤·창을 떠나면·대화상자를 닫으면 가림. 프로젝터에 비칠 수 있어 [QR 보이기]를 한 번 더 누르게 함
  var phone = $('[data-phone-dialog]'), phoneBtn = $('[data-phone-open]'), phoneT = 0;
  function phoneHide() {
    if (!phone) return; clearInterval(phoneT);
    var q = $('[data-phone-qr]', phone); q.hidden = true; q.textContent = '';
    $('[data-phone-cover]', phone).hidden = false; $('[data-phone-left]', phone).textContent = '';
  }
  function phoneUrl() {
    var dir = siteDir(); if (!dir || !ADMIN_KEY) return '';
    var ul = $('meta[name="lp-unlock"]'), k = ul && ul.getAttribute('content');
    return dir + 'console.html#' + (k ? k + '&' : '') + 'key=' + encodeURIComponent(ADMIN_KEY);
  }
  function phoneShow() {
    var u = phoneUrl(), q = $('[data-phone-qr]', phone); if (!u || !window.qrcode) return;
    try { if (qrcode.stringToBytesFuncs) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']; var qq = qrcode(0, 'M'); qq.addData(u); qq.make(); q.innerHTML = qq.createSvgTag({ cellSize: 4, margin: 16, scalable: true }); } catch (e) { return; }
    q.hidden = false; $('[data-phone-cover]', phone).hidden = true;
    var left = 60, lt = $('[data-phone-left]', phone), tick = function () { lt.textContent = left + '초 뒤에 가려요.'; if (left-- <= 0) phoneHide(); };
    clearInterval(phoneT); tick(); phoneT = setInterval(tick, 1000);
    var cl = $('button[value="close"]', phone); if (cl) cl.focus();
  }
  if (phone && phoneBtn) {
    var why = LOCAL ? '리허설 설정이라 휴대폰과 이어지지 않아요. 참여 기능 서버를 연결해 다시 공개하면 쓸 수 있어요.' : !siteDir() ? '인터넷에 올리면 쓸 수 있어요.' : '';
    if (why) { $('[data-phone-lead]', phone).textContent = why; $('[data-phone-box]', phone).hidden = true; }
    phoneBtn.addEventListener('click', function () { phoneHide(); if (phone.showModal) phone.showModal(); });
    $('[data-phone-show]', phone).addEventListener('click', phoneShow);
    phone.addEventListener('close', function () { phoneHide(); if (moreBtn) moreBtn.focus(); });
    phone.addEventListener('click', function (e) { if (e.target === phone) phone.close(); });
    addEventListener('blur', phoneHide); doc.addEventListener('visibilitychange', function () { if (doc.hidden) phoneHide(); });
  }
})();
