/* lecpage console — 강사 콘솔. 모든 화면 출력은 textContent로 만듭니다(HTML 주입 금지). */
(function () {
  'use strict';
  var doc = document, $ = function (s, r) { return (r || doc).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var DATA = {}, BP = {};
  try { DATA = JSON.parse($('#lp-data').textContent); BP = JSON.parse($('#lp-blueprint').textContent); } catch (e) { }
  function el(tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  function btn(text, cls, fn) { var b = el('button', 'lp-btn lp-btn-sm ' + (cls || 'lp-btn-ghost'), text); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  var tt; function toast(m) { var t = $('[data-toast]'); if (!t) return; t.textContent = m; t.classList.add('is-on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('is-on'); }, 2400); }
  function save(name, text) { var u = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })); var a = el('a'); a.href = u; a.download = name; doc.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 1500); }
  if (!DATA.live || !window.LecLive) { var m = $('[data-console-main]'); if (m) { m.hidden = false; m.appendChild(el('p', 'lp-note', '이 사이트는 실시간 기능이 꺼져 있어 콘솔을 쓸 수 없어요.')); } var f0 = $('[data-admin-form]'); if (f0) f0.hidden = true; return; }

  var conn, data = { participants: {}, progress: {}, help: {}, questions: {}, posts: {}, answers: {} }, state = {};
  var form = $('[data-admin-form]'), main = $('[data-console-main]');
  var saved = ''; try { saved = sessionStorage.getItem('lp-admin:' + DATA.live.code) || ''; } catch (e) { }
  form.addEventListener('submit', function (e) { e.preventDefault(); start(new FormData(form).get('key')); });
  if (saved) start(saved);

  function start(key) {
    conn = LecLive.create(Object.assign({}, DATA.live, { adminKey: key, role: 'admin' }));
    conn.connect().then(function () {
      return conn.getState().then(function (s) { state = s || {}; });
    }).then(function () {
      try { sessionStorage.setItem('lp-admin:' + DATA.live.code, key); } catch (e) { }
      form.hidden = true; main.hidden = false; build(); loadAll(); conn.subscribe(onEvent);
    }, function (err) { toast('연결하지 못했어요: ' + (err && err.message || '키와 서버 주소를 확인해 주세요.')); });
  }
  function loadAll() {
    ['participants', 'progress', 'help', 'questions', 'posts', 'answers'].forEach(function (c) {
      conn.list(c, {}).then(function (a) { (a || []).forEach(function (d) { data[c][d.id] = d; }); render(); }, function () { });
    });
  }
  function onEvent(ev) {
    if (!ev) return;
    if (ev.type === 'state') { state = ev.doc || ev.state || {}; render(); return; }
    var bag = data[ev.col]; if (!bag || !ev.doc) return;
    if (ev.type === 'remove') delete bag[ev.doc.id]; else bag[ev.doc.id] = Object.assign(bag[ev.doc.id] || {}, ev.doc);
    if (ev.col === 'help' && ev.type === 'add') toast('도움 요청: ' + (ev.doc.nickname || '참가자') + (ev.doc.seat ? ' · ' + ev.doc.seat : ''));
    render();
  }
  function vals(c) { return Object.keys(data[c]).map(function (k) { return data[c][k]; }); }
  function setState(patch) { return conn.setState(patch).then(function (s) { state = s || Object.assign(state, patch); render(); }, function (e) { toast('보내지 못했어요: ' + (e && e.message || '')); }); }

  var P = {};
  function panel(id, title, cls) { var p = el('section', 'lp-card lp-panel ' + (cls || '')); var h = el('h2', '', title); p.appendChild(h); var body = el('div'); p.appendChild(body); main.appendChild(p); P[id] = { box: p, h: h, body: body }; return body; }
  function build() {
    main.textContent = '';
    panel('kpi', '지금 상황', 'is-wide');
    panel('heat', '실습 진행 현황');
    panel('help', '도움 요청');
    panel('control', '진행 맞추기·공지·타이머');
    panel('qa', '질문 관리');
    panel('poll', '투표', 'is-third');
    panel('board', '보드 관리', 'is-third');
    panel('data', '기록·정리', 'is-third');
    buildControl(); buildData();
  }
  function render() {
    if (!P.kpi) return;
    var parts = vals('participants'), help = vals('help'), qs = vals('questions');
    var latest = {}; vals('progress').forEach(function (p) { var k = p.by + '|' + p.station; if (!latest[k] || (p.at || p.createdAt) >= (latest[k].at || latest[k].createdAt)) latest[k] = p; });
    var prog = Object.keys(latest).map(function (k) { return latest[k]; });
    // KPI
    var k = P.kpi.body; k.textContent = ''; var row = el('div', 'lp-kpis');
    [[parts.length, '참여자'], [prog.filter(function (p) { return p.status === 'done'; }).length, '완료 체크'], [help.filter(function (h) { return h.status !== 'done'; }).length, '열린 도움 요청'], [qs.filter(function (q) { return q.status !== 'hidden'; }).length, '질문']].forEach(function (x) { var d = el('div', 'lp-kpi'); d.appendChild(el('b', '', String(x[0]))); d.appendChild(el('span', '', x[1])); row.appendChild(d); });
    k.appendChild(row);
    // 진행 현황
    var hb = P.heat.body; hb.textContent = '';
    var total = Math.max(parts.length, 1);
    if (!(BP.stations || []).length) hb.appendChild(el('p', 'lp-small', '실습 스테이션이 없는 연수예요.'));
    var heat = el('div', 'lp-heat');
    (BP.stations || []).forEach(function (s) {
      var c = { done: 0, doing: 0, stuck: 0 }; prog.forEach(function (p) { if (p.station === s.id && c[p.status] !== undefined) c[p.status]++; });
      var r = el('div', 'lp-heat-row'); r.appendChild(el('span', '', s.name || s.title));
      var bar = el('div', 'lp-heat-bar'); ['done', 'doing', 'stuck'].forEach(function (t) { var i = el('i', t); i.style.width = (c[t] / total * 100) + '%'; i.title = { done: '완료', doing: '진행 중', stuck: '막힘' }[t] + ' ' + c[t]; bar.appendChild(i); });
      r.appendChild(bar); r.appendChild(el('small', '', c.done + '완료' + (c.stuck ? ' · 막힘 ' + c.stuck : ''))); heat.appendChild(r);
    });
    hb.appendChild(heat);
    hb.appendChild(el('p', 'lp-small', '초록 완료 · 주황 진행 중 · 빨강 막힘. 참여자 ' + parts.length + '명 기준'));
    // 도움 요청
    var hl = P.help.body; hl.textContent = ''; var ul = el('ul', 'lp-list');
    var open = help.filter(function (h) { return h.status !== 'done'; }).sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
    P.help.h.textContent = '도움 요청 (' + open.length + ')';
    if (!open.length) ul.appendChild(el('li', 'lp-empty', '지금은 도움 요청이 없어요.'));
    open.forEach(function (h) {
      var li = el('li'); var t = el('div'); var st = (BP.stations || []).filter(function (s) { return s.id === h.station; })[0];
      t.appendChild(el('b', '', (h.nickname || '참가자') + (h.seat ? ' · ' + h.seat : ''))); t.appendChild(el('div', 'lp-small', (st ? st.name : (h.station || '위치 모름')) + ' · ' + ago(h.createdAt) + (h.status === 'claimed' ? ' · ' + (h.assignee || '') + ' 확인 중' : '')));
      var a = el('div', 'lp-row');
      if (h.status !== 'claimed') a.appendChild(btn('맡기', '', function () { conn.update('help', h.id, { status: 'claimed', assignee: '강사' }).catch(err); }));
      a.appendChild(btn('해결', 'lp-btn-primary', function () { conn.update('help', h.id, { status: 'done' }).catch(err); }));
      li.appendChild(t); li.appendChild(a); ul.appendChild(li);
    });
    hl.appendChild(ul);
    // 질문
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
    // 투표
    var pl = P.poll.body; pl.textContent = '';
    var polls = []; (BP.sections || []).forEach(function (s) { if (s.type === 'poll' && s.items) polls = polls.concat(s.items); });
    if (!polls.length) pl.appendChild(el('p', 'lp-small', '준비된 투표가 없어요.'));
    polls.forEach(function (p) {
      var openNow = state.openPoll === p.id; var box = el('div', 'lp-row'); box.style.justifyContent = 'space-between';
      var n = vals('answers').filter(function (a) { return a.poll === p.id; }).length;
      box.appendChild(el('span', '', p.question + ' (' + n + ')'));
      box.appendChild(btn(openNow ? '닫기' : '열기', openNow ? 'lp-btn-primary' : '', function () { setState({ openPoll: openNow ? '' : p.id }); }));
      pl.appendChild(box);
    });
    // 보드
    var bl = P.board.body; bl.textContent = ''; var bul = el('ul', 'lp-list'); var posts = vals('posts').sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    if (!posts.length) bul.appendChild(el('li', 'lp-empty', '아직 글이 없어요.'));
    posts.forEach(function (p) { var li = el('li'); li.appendChild(el('span', '', (p.nickname || '익명') + ': ' + (p.text || '(파일)').slice(0, 60) + (p.hidden ? ' · 숨김' : ''))); li.appendChild(btn(p.hidden ? '보이기' : '숨기기', 'lp-danger', function () { conn.update('posts', p.id, { hidden: !p.hidden }).catch(err); })); bul.appendChild(li); });
    bl.appendChild(bul);
    syncControl();
  }
  var C = {};
  function buildControl() {
    var b = P.control.body;
    var r1 = el('div', 'lp-row'); var fl = el('label', 'lp-row'); var cb = el('input'); cb.type = 'checkbox'; fl.appendChild(cb); fl.appendChild(el('span', '', '참가자 화면이 강사를 따라오게'));
    cb.addEventListener('change', function () { setState({ follow: cb.checked }); }); r1.appendChild(fl); b.appendChild(r1); C.follow = cb;
    if ((BP.stations || []).length) {
      var r2 = el('div', 'lp-row'); var sel = el('select'); sel.setAttribute('aria-label', '지금 실습');
      var o0 = el('option', '', '지금 실습 고르기'); o0.value = ''; sel.appendChild(o0);
      BP.stations.forEach(function (s, i) { var o = el('option', '', (i + 1) + '. ' + (s.name || s.title)); o.value = s.id; sel.appendChild(o); });
      sel.addEventListener('change', function () { setState({ step: sel.value }); }); r2.appendChild(sel);
      r2.appendChild(btn('다음 실습', '', function () { var i = BP.stations.findIndex(function (s) { return s.id === state.step; }); var n = BP.stations[Math.min(BP.stations.length - 1, i + 1)]; if (n) setState({ step: n.id }); }));
      b.appendChild(r2); C.step = sel;
    }
    if (BP.deck) {
      var r3 = el('div', 'lp-row'); var inp = el('input'); inp.type = 'number'; inp.min = 1; inp.max = BP.deck; inp.placeholder = '쪽'; inp.style.width = '6em'; inp.setAttribute('aria-label', '교재 쪽');
      r3.appendChild(el('span', '', '교재')); r3.appendChild(inp);
      r3.appendChild(btn('이 쪽 보내기', '', function () { setState({ slide: +inp.value || 1 }); }));
      r3.appendChild(btn('◀', '', function () { setState({ slide: Math.max(1, (state.slide || 1) - 1) }); })); r3.appendChild(btn('▶', '', function () { setState({ slide: Math.min(BP.deck, (state.slide || 0) + 1) }); }));
      b.appendChild(r3); C.slide = inp;
    }
    var r4 = el('div', 'lp-row'); var nt = el('input'); nt.placeholder = '공지 문구(예: 5분 뒤 다시 모여요)'; nt.maxLength = 120; nt.style.flex = '1'; nt.setAttribute('aria-label', '공지 문구');
    r4.appendChild(nt); r4.appendChild(btn('공지 보내기', 'lp-btn-primary', function () { if (nt.value.trim()) setState({ notice: { text: nt.value.trim(), level: '' } }); })); r4.appendChild(btn('지우기', '', function () { setState({ notice: null }); }));
    b.appendChild(r4);
    var r5 = el('div', 'lp-row'); r5.appendChild(el('span', '', '타이머'));
    [3, 5, 10, 15, 20].forEach(function (m) { r5.appendChild(btn(m + '분', '', function () { setState({ timer: { endsAt: Date.now() + m * 60000, label: '', running: true } }); })); });
    r5.appendChild(btn('멈춤', 'lp-danger', function () { setState({ timer: { running: false } }); }));
    b.appendChild(r5);
  }
  function syncControl() { if (C.follow) C.follow.checked = !!state.follow; if (C.step && doc.activeElement !== C.step) C.step.value = state.step || ''; if (C.slide && doc.activeElement !== C.slide && state.slide) C.slide.value = state.slide; }
  function buildData() {
    var b = P.data.body;
    var r = el('div', 'lp-row');
    [['attendance', '출석'], ['progress', '진행'], ['questions', '질문'], ['survey', '설문']].forEach(function (x) {
      r.appendChild(btn(x[1] + ' CSV', '', function () { conn.exportCsv(x[0]).then(function (csv) { save((DATA.title || 'lecpage') + '_' + x[1] + '.csv', csv || ''); }, err); }));
    });
    b.appendChild(r);
    b.appendChild(el('p', 'lp-small', '연수가 끝나고 ' + ((DATA.privacy || {}).retentionDays || 30) + '일이 지나면 아래 버튼으로 모든 기록을 지워 주세요.'));
    var del = btn('데이터 모두 지우기', 'lp-danger', function () {
      if (del.getAttribute('data-armed') !== '1') { del.setAttribute('data-armed', '1'); del.textContent = '정말 지울까요? 한 번 더 누르면 지워져요'; setTimeout(function () { del.removeAttribute('data-armed'); del.textContent = '데이터 모두 지우기'; }, 5000); return; }
      conn.purge().then(function () { Object.keys(data).forEach(function (k) { data[k] = {}; }); render(); toast('모든 기록을 지웠어요.'); }, err);
    });
    b.appendChild(del);
    var j = el('div', 'lp-row'); j.style.marginTop = '8px'; var q = el('div', 'lp-qr'); q.style.width = '120px';
    var u = location.href.replace(/console\.html.*$/, 'index.html'); if (window.LecPage && LecPage.qr) q.innerHTML = LecPage.qr(u); else if (window.qrcode) { try { var qq = qrcode(0, 'M'); qq.addData(u); qq.make(); q.innerHTML = qq.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch (e) { } }
    j.appendChild(q); var c = el('div'); c.appendChild(el('div', 'lp-small', '참여 주소')); c.appendChild(el('div', '', u)); c.appendChild(el('div', 'lp-small', '참여 코드 ' + DATA.live.code)); j.appendChild(c); b.appendChild(j);
  }
  function err(e) { toast('처리하지 못했어요: ' + (e && e.message || '권한이나 연결을 확인해 주세요.')); }
  function ago(t) { if (!t) return ''; var s = Math.round((Date.now() - t) / 1000); return s < 60 ? '방금' : s < 3600 ? Math.floor(s / 60) + '분 전' : Math.floor(s / 3600) + '시간 전'; }
})();
