/* lecpage console — 강사 화면. 모든 화면 출력은 textContent로 만듭니다(HTML 주입 금지).
 * 켜진 기능과 섹션의 패널만 만듭니다. 맨 위 '지금' 띠: 참여자·도움 요청·모르겠어요 신호·열린 투표. */
(function () {
  'use strict';
  // 다른 사이트가 강사 화면을 틀(iframe)에 넣어 관리자 키를 가로채지 못하게(헤더를 못 바꾸는 GitHub Pages 대비). 앱 미리보기는 예외
  try { if (window.top !== window.self && !document.body.hasAttribute('data-lp-preview')) { document.documentElement.innerHTML = '<body><p style="font:16px sans-serif;padding:24px">강사 화면은 새 창에서 열어 주세요.</p></body>'; return; } } catch (e) { return; }
  var doc = document, $ = function (s, r) { return (r || doc).querySelector(s); };
  var DATA = {}, BP = {};
  try { DATA = JSON.parse($('#lp-data').textContent); BP = JSON.parse($('#lp-blueprint').textContent); } catch (e) { }
  function el(tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  function btn(text, cls, fn) { var b = el('button', 'lp-btn lp-btn-sm ' + (cls || 'lp-btn-ghost'), text); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  var tt; function toast(m) { var t = $('[data-toast]'); if (!t) return; t.textContent = m; t.classList.add('is-on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('is-on'); }, 2400); }
  function save(name, text) { var u = URL.createObjectURL(new Blob([text.charAt(0) === '﻿' ? text : '﻿' + text], { type: 'text/csv;charset=utf-8' })); var a = el('a'); a.href = u; a.download = name; doc.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 1500); }
  if (!DATA.live || !window.LecLive) { var m = $('[data-console-main]'); if (m) { m.hidden = false; m.appendChild(el('p', 'lp-note', '이 사이트는 참여 기능이 꺼져 있어 강사 화면을 쓸 수 없어요. 발표 화면의 도구(이름 뽑기·모둠·타이머)는 그대로 쓸 수 있어요.')); } var f0 = $('[data-admin-form]'); if (f0) f0.hidden = true; return; }

  var U = LecLive.util, X = U.ext;
  var feats = DATA.live.features || [], secs = BP.sections || [], stations = BP.stations || [];
  function has(f) { return feats.indexOf(f) >= 0; }
  function hasSec(t) { return secs.some(function (s) { return s.type === t; }); }
  var polls = []; secs.forEach(function (s) { if (s.type === 'poll' && s.items) polls = polls.concat(s.items); });
  var MODERATE = secs.some(function (s) { return s.type === 'board' && s.moderation; });
  // 파일 올리기: 보드가 파일을 받지 않으면(allowFiles:false, 만 14세 미만 연수 등) 서버도 받지 않게 상태에 적어 둠
  var NOFILES = !secs.some(function (s) { return s.type === 'board' && s.allowFiles !== false && s.maxFiles !== 0; });
  // 켜진 것만: 패널·불러올 컬렉션·내려받기 종류가 모두 이걸 따릅니다
  var ON = {
    progress: stations.length > 0 && has('progress'), help: has('help'), qa: hasSec('qa') || has('qa'), signal: has('signal'),
    poll: polls.length > 0, board: hasSec('board') || has('board'), survey: (DATA.survey || 0) > 0,
  };
  var COLS = ['participants'].concat(ON.progress ? ['progress'] : [], ON.help ? ['help'] : [], ON.qa ? ['questions'] : [], ON.board ? ['posts'] : [], ON.poll || ON.signal ? ['answers'] : [], ON.survey ? ['survey'] : []);

  var conn, data = {}, state = {};
  COLS.forEach(function (c) { data[c] = {}; });
  var form = $('[data-admin-form]'), main = $('[data-console-main]');
  // 키 이름에 사이트 경로를 넣음: 여러 사이트가 한 출처를 쓰는 서버(바로 공개)에서 다른 사이트의 화면이 이 키를 쓰지 못하게
  var ADMIN_SLOT = 'lp-admin:' + location.pathname.replace(/[^/]*$/, '') + ':' + DATA.live.code;
  var saved = ''; try { saved = sessionStorage.getItem(ADMIN_SLOT) || ''; } catch (e) { }
  form.addEventListener('submit', function (e) { e.preventDefault(); start(new FormData(form).get('key')); });
  if (saved) start(saved);

  function start(key) {
    conn = LecLive.create(Object.assign({}, DATA.live, { adminKey: key, role: 'admin' }));
    conn.connect().then(function () {
      return conn.getState().then(function (s) { state = s || {}; });
    }).then(function () {
      try { sessionStorage.setItem(ADMIN_SLOT, key); } catch (e) { }
      form.hidden = true; main.hidden = false; build(); loadAll(); conn.subscribe(onEvent);
      // 보드 '먼저 확인'(board.moderation): 서버가 새 글을 숨긴 채 받도록 상태에 적어 둠(관리자만 바꿀 수 있음)
      var mod = MODERATE || null, nof = NOFILES ? false : null, ui0 = state.ui || {}, pol = {};
      if ((ui0.moderation || null) !== mod) pol.moderation = mod;
      if ((ui0.uploads === false ? false : null) !== nof) pol.uploads = nof;
      if (Object.keys(pol).length) conn.setState({ ui: pol }).catch(function () { });
    }, function (err) { toast('연결하지 못했어요: ' + (err && err.message || '키와 서버 주소를 확인해 주세요.')); });
  }
  function loadAll() {
    COLS.forEach(function (c) {
      conn.list(c, {}).then(function (a) { (a || []).forEach(function (d) { data[c][d.id] = d; }); render(); }, function () { });
    });
  }
  function onEvent(ev) {
    if (!ev) return;
    if (ev.type === 'state') { state = ev.doc || ev.state || {}; render(); return; }
    if (ev.type === 'reset') { COLS.forEach(function (c) { data[c] = {}; }); render(); return; }
    var bag = data[ev.col]; if (!bag || !ev.doc) return;
    if (ev.type === 'remove') delete bag[ev.doc.id]; else bag[ev.doc.id] = Object.assign(bag[ev.doc.id] || {}, ev.doc);
    if (ev.col === 'help' && ev.type === 'add') toast('도움 요청: ' + (ev.doc.nickname || '참가자') + (ev.doc.seat ? ' · ' + ev.doc.seat : ''));
    render();
  }
  function vals(c) { var b = data[c] || {}; return Object.keys(b).map(function (k) { return b[k]; }); }
  function setState(patch, ok) { return conn.setState(patch).then(function (s) { state = s || Object.assign(state, patch); render(); if (ok) toast(ok); }, function (e) { toast('보내지 못했어요: ' + (e && e.message || '')); }); }
  function now() { return conn.now ? conn.now() : Date.now(); }

  // ── 집계 ──
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
  function pollAnswers(id) { return vals('answers').filter(function (a) { return a.poll === id; }); }
  var SIG = [['green', 'g', '✓', '이해했어요'], ['yellow', 'y', '?', '조금 헷갈려요'], ['red', 'r', '!', '모르겠어요']];
  function signalView(c) {
    var box = el('div'); box.style.display = 'grid'; box.style.gap = '8px';
    var bar = el('div', 'lp-signal-bar'); bar.setAttribute('aria-hidden', 'true');
    SIG.forEach(function (x) { var i = el('i', x[1]); i.style.width = (c.total ? c[x[0]] / c.total * 100 : 0) + '%'; bar.appendChild(i); });
    var lg = el('p', 'lp-sig-legend');
    SIG.forEach(function (x) { var s = el('span'); s.appendChild(el('i', x[1], x[2])).setAttribute('aria-hidden', 'true'); s.appendChild(doc.createTextNode(x[3] + ' ' + c[x[0]] + '명')); lg.appendChild(s); });
    box.appendChild(bar); box.appendChild(lg); return box;
  }

  // ── 패널 ──
  var P = {};
  function panel(id, title, cls) { var p = el('section', 'lp-card lp-panel ' + (cls || '')); var h = el('h2', '', title); p.appendChild(h); var body = el('div'); p.appendChild(body); main.appendChild(p); P[id] = { box: p, h: h, body: body }; return body; }
  function build() {
    main.textContent = '';
    panel('now', '지금', 'is-wide');
    if (ON.help) panel('help', '도움 요청');
    if (ON.progress) panel('heat', '실습 진행 현황');
    panel('control', '따라 넘기기·공지·타이머');
    if (ON.poll) panel('poll', '투표');
    if (ON.qa) panel('qa', '질문 관리');
    if (ON.signal) panel('signal', '신호등');
    if (ON.board) panel('board', '보드 관리');
    panel('data', '기록·정리');
    buildControl(); buildData();
  }
  function kpi(row, value, label, sub, alert) {
    var d = el('div', 'lp-kpi' + (alert ? ' is-alert' : '')); d.appendChild(el('b', '', String(value))); d.appendChild(el('span', '', label)); if (sub) d.appendChild(el('small', '', sub)); row.appendChild(d);
  }
  function render() {
    if (!P.now) return;
    var parts = vals('participants'), help = vals('help'), qs = vals('questions');
    var openHelp = help.filter(function (h) { return h.status !== 'done'; });
    var sig = ON.signal ? signalCounts() : null;
    var op = polls.filter(function (p) { return p.id === state.openPoll; })[0];
    // 지금 띠
    var row = el('div', 'lp-now-strip');
    kpi(row, parts.length, '참가자');
    if (ON.help) kpi(row, openHelp.length, '열린 도움 요청', openHelp[0] ? (openHelp[0].nickname || '참가자') + (openHelp[0].seat ? ' · ' + openHelp[0].seat : '') : '', openHelp.length > 0);
    if (ON.signal) { var rs = sig.total ? Math.round(sig.red / sig.total * 100) : 0; kpi(row, rs + '%', '모르겠어요 신호', sig.total + '명 중 ' + sig.red + '명', sig.total && rs >= 25); }
    if (ON.poll) kpi(row, op ? pollAnswers(op.id).length + '명' : '없음', '지금 투표', op ? op.question : '열린 투표가 없어요');
    if (ON.survey) kpi(row, vals('survey').length, '설문 응답');
    if (ON.qa) kpi(row, qs.filter(function (q) { return q.status !== 'hidden'; }).length, '질문');
    P.now.body.textContent = ''; P.now.body.appendChild(row);
    if (ON.progress) renderHeat(parts);
    if (ON.help) renderHelp(openHelp);
    if (ON.qa) renderQA(qs);
    if (ON.signal) renderSignal(sig);
    if (ON.poll) renderPolls();
    if (ON.board) renderBoard();
    syncControl();
  }
  function renderHeat(parts) {
    var latest = {}; vals('progress').forEach(function (p) { var k = (p.by || p.id) + '|' + p.station; if (!latest[k] || (p.at || p.createdAt) >= (latest[k].at || latest[k].createdAt)) latest[k] = p; });
    var prog = Object.keys(latest).map(function (k) { return latest[k]; });
    var hb = P.heat.body; hb.textContent = '';
    var total = Math.max(parts.length, 1), heat = el('div', 'lp-heat');
    stations.forEach(function (s) {
      var c = { done: 0, doing: 0, stuck: 0 }; prog.forEach(function (p) { if (p.station === s.id && c[p.status] !== undefined) c[p.status]++; });
      var r = el('div', 'lp-heat-row'); r.appendChild(el('span', '', s.name || s.title));
      var bar = el('div', 'lp-heat-bar'); bar.setAttribute('aria-hidden', 'true'); ['done', 'doing', 'stuck'].forEach(function (t) { var i = el('i', t); i.style.width = (c[t] / total * 100) + '%'; bar.appendChild(i); });
      r.appendChild(bar); r.appendChild(el('small', '', '완료 ' + c.done + ' · 하는 중 ' + c.doing + (c.stuck ? ' · 도움 요청 ' + c.stuck : ''))); heat.appendChild(r);
    });
    hb.appendChild(heat);
    hb.appendChild(el('p', 'lp-small', '초록 완료 · 주황 하는 중 · 빨강 도움 요청. 참가자 ' + parts.length + '명 기준'));
  }
  function renderHelp(open) {
    var hl = P.help.body; hl.textContent = ''; var ul = el('ul', 'lp-list');
    open.sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
    P.help.h.textContent = '도움 요청 (' + open.length + ')';
    if (!open.length) ul.appendChild(el('li', 'lp-empty', '지금은 도움 요청이 없어요.'));
    open.forEach(function (h) {
      var li = el('li'); var t = el('div'); var st = stations.filter(function (s) { return s.id === h.station; })[0];
      t.appendChild(el('b', '', (h.nickname || '참가자') + (h.seat ? ' · ' + h.seat : '')));
      if (h.message) t.appendChild(el('p', '', h.message));
      t.appendChild(el('div', 'lp-small', (st ? st.name : (h.station || '위치 모름')) + ' · ' + ago(h.createdAt) + (h.status === 'claimed' ? ' · ' + (h.assignee || '') + ' 가는 중' : '')));
      var a = el('div', 'lp-row');
      if (h.status !== 'claimed') a.appendChild(btn('갈게요', '', function () { conn.update('help', h.id, { status: 'claimed', assignee: '강사' }).catch(err); }));
      a.appendChild(btn('해결', 'lp-btn-primary', function () { conn.update('help', h.id, { status: 'done' }).catch(err); }));
      li.appendChild(t); li.appendChild(a); ul.appendChild(li);
    });
    hl.appendChild(ul);
  }
  function renderQA(qs) {
    var ql = P.qa.body; ql.textContent = ''; var qul = el('ul', 'lp-list');
    qs.sort(function (a, b) { return (b.votes || 0) - (a.votes || 0) || (b.createdAt || 0) - (a.createdAt || 0); });
    if (!qs.length) qul.appendChild(el('li', 'lp-empty', '아직 질문이 없어요.'));
    qs.forEach(function (q) {
      var li = el('li'); var t = el('div'); t.appendChild(el('p', '', q.text)); t.appendChild(el('div', 'lp-small', '공감 ' + (q.votes || 0) + ' · ' + (q.status === 'answered' ? '답변 완료' : q.status === 'hidden' ? '숨김' : '열림') + (q.pinned ? ' · 고정' : '')));
      var a = el('div', 'lp-row');
      a.appendChild(btn(q.pinned ? '고정 해제' : '고정', '', function () { conn.update('questions', q.id, { pinned: !q.pinned }).catch(err); }));
      a.appendChild(btn(q.status === 'answered' ? '다시 열기' : '답변 완료', '', function () { conn.update('questions', q.id, { status: q.status === 'answered' ? 'open' : 'answered' }).catch(err); }));
      a.appendChild(btn(q.status === 'hidden' ? '보이기' : '숨기기', 'lp-danger', function () { conn.update('questions', q.id, { status: q.status === 'hidden' ? 'open' : 'hidden' }).catch(err); }));
      li.appendChild(t); li.appendChild(a); qul.appendChild(li);
    });
    ql.appendChild(qul);
  }
  function renderSignal(c) {
    var sg = P.signal.body; sg.textContent = '';
    if (!c.total) sg.appendChild(el('p', 'lp-small', '참가자가 신호를 보내면 여기에 모여요.'));
    else {
      sg.appendChild(signalView(c));
      var redShare = c.red / c.total;
      if (redShare >= 0.25 && !render._sigAlert) { render._sigAlert = true; toast('모르겠어요 신호가 ' + Math.round(redShare * 100) + '%예요. 잠시 멈추고 확인해 보세요.'); }
      if (redShare < 0.2) render._sigAlert = false;
    }
    var r = X.signalReset(state);
    var row = el('div', 'lp-row');
    row.appendChild(btn('신호 초기화', '', function () { setState({ ui: { signalReset: now() } }, '신호를 비웠어요. 참가자 화면의 선택도 지워져요.'); }));
    if (r) row.appendChild(el('span', 'lp-small', '마지막 초기화 ' + new Date(r).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })));
    sg.appendChild(row);
  }
  function renderPolls() {
    var pl = P.poll.body; pl.textContent = '';
    var hidden = X.hiddenWords(state);
    polls.forEach(function (p) {
      var openNow = state.openPoll === p.id, shown = X.revealed(state, p.id), list = pollAnswers(p.id);
      var box = el('div', 'lp-poll-row');
      var top = el('div', 'lp-row'); top.style.justifyContent = 'space-between';
      top.appendChild(el('b', '', p.question + ' · ' + list.length + '명'));
      var acts = el('div', 'lp-row');
      acts.appendChild(btn(openNow ? '닫기' : '열기', openNow ? 'lp-btn-primary' : '', function () { setState({ openPoll: openNow ? '' : p.id }); }));
      var rv = btn(shown ? '결과 숨기기' : '결과 공개', '', function () { setState(X.revealPatch(state, p.id, !shown), shown ? '참가자 화면에서 결과를 숨겼어요.' : '참가자 화면에 결과를 공개했어요.'); });
      rv.setAttribute('aria-pressed', String(shown)); acts.appendChild(rv);
      top.appendChild(acts); box.appendChild(top);
      box.appendChild(el('p', 'lp-small', shown ? '참가자에게 결과가 보여요.' : '참가자에게는 결과가 아직 숨겨져 있어요. 강사 화면과 발표 화면에는 보여요.'));
      if (p.kind === 'word') {
        var words = U.wordCloud(list, p.id, {});
        if (words.length) {
          var wl = el('div', 'lp-words');
          words.slice(0, 24).forEach(function (w) {
            var off = hidden.indexOf(w.word) >= 0, chip = el('span', 'lp-word');
            chip.appendChild(el('span', '', w.word + ' ' + w.count + (off ? ' · 숨김' : '')));
            chip.appendChild(btn(off ? '다시 보이기' : '숨기기', off ? '' : 'lp-danger', function () { setState(X.hiddenPatch(state, w.word, !off)); }));
            wl.appendChild(chip);
          });
          box.appendChild(wl);
          box.appendChild(el('p', 'lp-small', '같은 낱말은 합쳐서 세고, 나쁜 말은 자동으로 빼요. 숨긴 낱말은 모든 화면에서 사라져요.'));
        }
      } else if (list.length) {
        var tally = {}; list.forEach(function (a) { [].concat(a.value).forEach(function (v) { tally[v] = (tally[v] || 0) + 1; }); });
        var opts = p.options && p.options.length ? p.options : Object.keys(tally);
        box.appendChild(el('p', 'lp-small', opts.map(function (o) { return o + ' ' + (tally[o] || 0); }).join(' · ')));
      }
      pl.appendChild(box);
    });
  }
  function renderBoard() {
    var bl = P.board.body; bl.textContent = ''; var bul = el('ul', 'lp-list'); var posts = vals('posts').sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    if (!posts.length) bul.appendChild(el('li', 'lp-empty', '아직 글이 없어요.'));
    var waiting = posts.filter(function (p) { return p.hidden; }).length;
    P.board.h.textContent = MODERATE ? '보드 관리 · 확인 기다림 ' + waiting : '보드 관리';
    posts.forEach(function (p) { var li = el('li'); li.appendChild(el('span', '', (p.nickname || '익명') + ': ' + (p.text || '(파일)').slice(0, 60) + (p.hidden ? (MODERATE ? ' · 확인 기다림' : ' · 숨김') : ''))); li.appendChild(btn(p.hidden ? (MODERATE ? '보드에 올리기' : '보이기') : '숨기기', p.hidden ? (MODERATE ? 'lp-btn-primary' : '') : 'lp-danger', function () { conn.update('posts', p.id, { hidden: !p.hidden }).catch(err); })); bul.appendChild(li); });
    if (MODERATE) bl.appendChild(el('p', 'lp-small', '먼저 확인하기가 켜져 있어요. 새 글은 \'보드에 올리기\'를 눌러야 참가자에게 보여요.'));
    bl.appendChild(bul);
  }

  var C = {};
  function buildControl() {
    var b = P.control.body;
    var r1 = el('div', 'lp-row'); var fl = el('label', 'lp-row'); var cb = el('input'); cb.type = 'checkbox'; fl.appendChild(cb); fl.appendChild(el('span', '', '강사 따라 넘기기'));
    cb.addEventListener('change', function () { setState({ follow: cb.checked }); }); r1.appendChild(fl); b.appendChild(r1); C.follow = cb;
    if (stations.length) {
      var r2 = el('div', 'lp-row'); var sel = el('select'); sel.setAttribute('aria-label', '지금 실습');
      var o0 = el('option', '', '지금 실습 고르기'); o0.value = ''; sel.appendChild(o0);
      stations.forEach(function (s, i) { var o = el('option', '', (i + 1) + '. ' + (s.name || s.title)); o.value = s.id; sel.appendChild(o); });
      sel.addEventListener('change', function () { setState({ step: sel.value }); }); r2.appendChild(sel);
      r2.appendChild(btn('다음 실습', '', function () { var i = stations.findIndex(function (s) { return s.id === state.step; }); var n = stations[Math.min(stations.length - 1, i + 1)]; if (n) setState({ step: n.id }); }));
      b.appendChild(r2); C.step = sel;
    }
    if (BP.deck) {
      var r3 = el('div', 'lp-row'); var inp = el('input'); inp.type = 'number'; inp.min = 1; inp.max = BP.deck; inp.placeholder = '쪽'; inp.style.width = '6em'; inp.setAttribute('aria-label', '교재 쪽');
      r3.appendChild(el('span', '', '교재')); r3.appendChild(inp);
      r3.appendChild(btn('이 쪽 보내기', '', function () { setState({ slide: Math.max(1, Math.min(BP.deck, Math.round(+inp.value) || 1)) }); }));
      var pv = btn('◀', '', function () { setState({ slide: Math.max(1, (state.slide || 1) - 1) }); }); pv.setAttribute('aria-label', '앞 쪽'); r3.appendChild(pv);
      var nx = btn('▶', '', function () { setState({ slide: Math.min(BP.deck, (state.slide || 0) + 1) }); }); nx.setAttribute('aria-label', '다음 쪽'); r3.appendChild(nx);
      b.appendChild(r3); C.slide = inp;
    }
    var r4 = el('div', 'lp-row'); var nt = el('input'); nt.placeholder = '공지 문구(예: 5분 뒤 다시 모여요)'; nt.maxLength = 120; nt.style.flex = '1'; nt.setAttribute('aria-label', '공지 문구');
    r4.appendChild(nt); r4.appendChild(btn('공지 보내기', 'lp-btn-primary', function () { if (nt.value.trim()) setState({ notice: { text: nt.value.trim(), level: 'info' } }); })); r4.appendChild(btn('지우기', '', function () { setState({ notice: null }); }));
    b.appendChild(r4);
    var r5 = el('div', 'lp-row'); r5.appendChild(el('span', '', '타이머'));
    [3, 5, 10, 15, 20].forEach(function (m) { r5.appendChild(btn(m + '분', '', function () { setState({ timer: { endsAt: now() + m * 60000, label: '', running: true } }); })); });
    r5.appendChild(btn('멈춤', 'lp-danger', function () { setState({ timer: null }); }));
    b.appendChild(r5);
    b.appendChild(el('p', 'lp-small', '타이머 여러 개·이름 뽑기·모둠 만들기는 발표 화면의 도구에 있어요.'));
    // 자료 링크: 연수 중에 덧붙이면 참가자 화면의 자료실에 바로 보임(파일은 드라이브 등에 올린 공유 주소로)
    var r6 = el('div', 'lp-row'); var mt = el('input'); mt.placeholder = '자료 이름'; mt.maxLength = 40; mt.setAttribute('aria-label', '자료 이름'); mt.style.flex = '1 1 8em';
    var mu = el('input'); mu.type = 'url'; mu.placeholder = '자료 주소(https://)'; mu.setAttribute('aria-label', '자료 주소'); mu.style.flex = '2 1 12em';
    r6.appendChild(mt); r6.appendChild(mu);
    r6.appendChild(btn('자료 추가', 'lp-btn-primary', function () {
      var patch = X.materialAdd(state, mu.value, mt.value);
      if (patch.error) { toast(patch.error); return; }
      setState(patch, '자료를 추가했어요. 참가자 화면의 자료실에 보여요.'); mt.value = ''; mu.value = '';
    }));
    b.appendChild(r6);
    C.mats = el('ul', 'lp-console-mats'); b.appendChild(C.mats);
  }
  function drawMats() {
    if (!C.mats) return; C.mats.textContent = '';
    X.materials(state).forEach(function (m) {
      var li = el('li'); var a = el('a', '', m.title); a.href = m.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.appendChild(a);
      li.appendChild(btn('지우기', '', function () { setState(X.materialRemove(m.slot), '자료를 지웠어요.'); }));
      C.mats.appendChild(li);
    });
  }
  function syncControl() { drawMats(); if (C.follow) C.follow.checked = !!state.follow; if (C.step && doc.activeElement !== C.step) C.step.value = state.step || ''; if (C.slide && doc.activeElement !== C.slide && state.slide) C.slide.value = state.slide; }

  var KINDS = [
    ['participants', '참가자', true], ['attendance', '출석', true], ['completion', '이수자 명단', true], ['progress', '실습 진행', ON.progress],
    ['questions', '질문', ON.qa], ['posts', '보드 글', ON.board], ['help', '도움 요청', ON.help], ['answers', '투표·신호 응답', ON.poll || ON.signal], ['survey', '설문 응답', ON.survey],
  ];
  function completionOpts() { return { date: DATA.date || '', start: DATA.start || '', end: DATA.end || '', rate: (DATA.admin || {}).completionRate, survey: (DATA.survey || 0) > 0, stations: stations.length }; }
  function buildData() {
    var b = P.data.body;
    var menu = el('details', 'lp-menu'); var sm = el('summary', 'lp-btn lp-btn-primary lp-btn-sm', '기록 내려받기 (CSV)'); menu.appendChild(sm);
    var list = el('div', 'lp-menu-list');
    KINDS.filter(function (k) { return k[2]; }).forEach(function (x) {
      list.appendChild(btn(x[1], '', function () {
        conn.exportCsv(x[0], x[0] === 'completion' ? completionOpts() : undefined).then(function (csv) { save((DATA.title || 'lecpage').replace(/[\\/:*?"<>|]/g, '') + '_' + x[1].replace(/[·\s]/g, '') + '.csv', csv || ''); toast(x[1] + ' 기록을 내려받았어요.'); }, err);
      }));
    });
    menu.appendChild(list);
    var rate = (DATA.admin || {}).completionRate; rate = rate == null ? 90 : rate;
    menu.appendChild(el('p', 'lp-small', '이수자 명단: 연수 시간(' + (DATA.start || '?') + '~' + (DATA.end || '?') + ')의 ' + rate + '% 이상 머물렀고' + ((DATA.survey || 0) > 0 ? ' 설문을 낸' : '') + ' 사람을 O로 적어요. 입실·퇴실 기록이 없으면 \'확인 필요\'예요. 이름·소속만 담고 개인 번호는 담지 않아요.'));
    b.appendChild(menu);
    b.appendChild(el('p', 'lp-small', '연수가 끝나고 ' + ((DATA.privacy || {}).retentionDays || 30) + '일이 지나면 아래 버튼으로 모든 기록을 지워 주세요.'));
    var del = btn('데이터 모두 지우기', 'lp-danger', function () {
      if (del.getAttribute('data-armed') !== '1') { del.setAttribute('data-armed', '1'); del.textContent = '한 번 더 눌러 지우기'; setTimeout(function () { del.removeAttribute('data-armed'); del.textContent = '데이터 모두 지우기'; }, 5000); return; }
      conn.purge().then(function () { COLS.forEach(function (k) { data[k] = {}; }); render(); toast('모든 기록을 지웠어요.'); }, err);
    });
    b.appendChild(del);
    // 참여 QR: 파일로 열었거나 미리보기면 주소 대신 안내(meta.siteUrl이 있으면 그 주소). 암호 보호면 #k=를 QR에만 붙임
    var local = /^(file|about|blob|data):$/.test(location.protocol);
    // QR에는 원래 주소만(짧은 주소는 글자로만 — 중간 화면이 있는 서비스에는 #k=가 보임). 파일로 열어 원래 주소를 모르면 짧은 주소를 글자로 보여 줌
    var site = DATA.siteUrl || (local ? '' : location.href.split('#')[0].replace(/console\.html.*$/, ''));
    var u = site || (local ? DATA.shortUrl || '' : '');
    var ul = $('meta[name="lp-unlock"]'), qu = site ? site.split('#')[0] + (ul && ul.getAttribute('content') ? '#' + ul.getAttribute('content') : '') : '';
    var j = el('div', 'lp-row'); j.style.marginTop = '8px'; var q = el('div', 'lp-qr'); q.style.width = '120px'; q.setAttribute('role', 'img'); q.setAttribute('aria-label', '참여 QR 코드'); // copy-ok: 화면 읽기 이름표는 'QR 코드'도 됨(writing.md 4절)
    if (qu && window.qrcode) { try { if (qrcode.stringToBytesFuncs) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']; var qq = qrcode(0, 'M'); qq.addData(qu); qq.make(); q.innerHTML = qq.createSvgTag({ cellSize: 4, margin: 16, scalable: true }); } catch (e) { } }
    else q.appendChild(el('span', 'lp-qr-off', '인터넷에 올리면 QR이 나와요.'));
    // 강사가 넣은 짧은 주소가 있으면 함께 보여 줌(QR은 언제나 원래 주소)
    var su = String(DATA.shortUrl || ''); if (!u || su.replace(/\/$/, '') === u.replace(/\/$/, '')) su = '';
    j.appendChild(q); var c = el('div'); c.appendChild(el('div', 'lp-small', '참여 주소')); c.appendChild(el('div', '', u || '인터넷에 올리면 여기에 참가자 주소와 QR이 나와요.'));
    if (su) { su = su.replace(/^https?:\/\//, '').replace(/\/$/, ''); try { su = decodeURI(su); } catch (e) { } c.appendChild(el('div', 'lp-small', '짧은 주소')); c.appendChild(el('div', '', su)); }
    c.appendChild(el('div', 'lp-small', '연수 코드 ' + DATA.live.code));
    var pl = el('a', 'lp-link', 'QR 안내문 인쇄'); pl.href = 'poster.html'; pl.target = '_blank'; c.appendChild(pl);
    j.appendChild(c); b.appendChild(j);
  }
  function err(e) { toast('처리하지 못했어요: ' + (e && e.message || '권한이나 연결을 확인해 주세요.')); }
  function ago(t) { if (!t) return ''; var s = Math.round((Date.now() - t) / 1000); return s < 60 ? '방금' : s < 3600 ? Math.floor(s / 60) + '분 전' : Math.floor(s / 3600) + '시간 전'; }
})();
