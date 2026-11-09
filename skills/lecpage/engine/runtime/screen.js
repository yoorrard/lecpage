/* lecpage screen — 프로젝터 화면: 참여 QR, 공지, 큰 타이머, 인기 질문, 투표 결과, 반응 */
(function () {
  'use strict';
  var doc = document, $ = function (s, r) { return (r || doc).querySelector(s); };
  var DATA = {}, BP = {};
  try { DATA = JSON.parse($('#lp-data').textContent); BP = JSON.parse($('#lp-blueprint').textContent); } catch (e) { }
  function el(tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  var joinUrl = DATA.siteUrl || location.href.split('#')[0].replace(/screen\.html.*$/, '');
  var q = $('[data-qr-join]');
  if (q && window.qrcode) { try { if (qrcode.stringToBytesFuncs) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']; var qq = qrcode(0, 'M'); qq.addData(joinUrl); qq.make(); q.innerHTML = qq.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); } catch (e) { } }
  var ju = $('[data-join-url]'); if (ju) ju.textContent = joinUrl.replace(/^https?:\/\//, '');
  if (!DATA.live || !window.LecLive) return;
  var conn = LecLive.create(DATA.live), state = {}, qs = {}, answers = {}, tiv;
  var polls = []; (BP.sections || []).forEach(function (s) { if (s.type === 'poll' && s.items) polls = polls.concat(s.items); });
  function draw() {
    var n = $('[data-notice]'); if (state.notice && state.notice.text) { n.hidden = false; n.textContent = state.notice.text; } else n.hidden = true;
    var t = $('[data-timer]'); clearInterval(tiv);
    if (state.timer && state.timer.running && state.timer.endsAt) { t.hidden = false; var tick = function () { var l = Math.round((state.timer.endsAt - Date.now()) / 1000), a = Math.abs(l); t.textContent = (l < 0 ? '-' : '') + Math.floor(a / 60) + ':' + String(a % 60).padStart(2, '0'); t.style.color = l <= 0 ? 'var(--danger)' : ''; }; tick(); tiv = setInterval(tick, 1000); } else t.hidden = true;
    var main = $('[data-screen-main]'); main.textContent = '';
    var p = polls.filter(function (x) { return x.id === state.openPoll; })[0];
    if (p) {
      main.appendChild(el('h2', 'lp-h2', p.question));
      var tally = {}, total = 0; Object.keys(answers).forEach(function (k) { var a = answers[k]; if (a.poll === p.id) { tally[a.value] = (tally[a.value] || 0) + 1; total++; } });
      if (p.kind === 'word') { var cl = el('div', 'lp-cloud'); Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; }).slice(0, 50).forEach(function (w) { var s = el('span', '', w); s.style.fontSize = (1.4 + Math.min(4, tally[w] / Math.max(total, 1) * 10)) + 'rem'; cl.appendChild(s); }); main.appendChild(cl); }
      else { var bars = el('div', 'lp-bars'); (p.options.length ? p.options : Object.keys(tally)).forEach(function (o) { var c = tally[o] || 0, r = el('div', 'lp-bar'); r.appendChild(el('span', '', o + ' · ' + c)); var tr = el('div', 'lp-bar-track'); tr.style.height = '22px'; var f = el('div', 'lp-bar-fill'); f.style.setProperty('--w', Math.round(c / Math.max(total, 1) * 100) + '%'); tr.appendChild(f); r.appendChild(tr); bars.appendChild(r); }); main.appendChild(bars); }
      main.appendChild(el('p', 'lp-small', '응답 ' + total + '명'));
      return;
    }
    var arr = Object.keys(qs).map(function (k) { return qs[k]; }).filter(function (x) { return x.status === 'open' || x.pinned; }).sort(function (a, b) { return (!!b.pinned - !!a.pinned) || (b.votes || 0) - (a.votes || 0); }).slice(0, 6);
    if (!arr.length) { main.appendChild(el('p', 'lp-empty', '질문과 투표 결과가 여기에 크게 보여요.')); return; }
    main.appendChild(el('h2', 'lp-h2', '질문'));
    var ul = el('ul', 'lp-qa-list'); arr.forEach(function (x) { var li = el('li', 'lp-qa-item' + (x.pinned ? ' is-pinned' : '')); var v = el('div', 'lp-vote'); v.appendChild(el('b', '', String(x.votes || 0))); li.appendChild(v); li.appendChild(el('p', '', x.text)); ul.appendChild(li); }); main.appendChild(ul);
  }
  function react(e) { var h = $('[data-reactions]'); if (!h || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return; var s = el('span', '', e); s.style.left = Math.round(Math.random() * 30) + 'px'; s.style.fontSize = '3rem'; h.appendChild(s); setTimeout(function () { s.remove(); }, 2700); }
  conn.connect().then(function () {
    conn.subscribe(function (ev) {
      if (!ev) return;
      if (ev.type === 'state') { state = ev.doc || ev.state || {}; return draw(); }
      if (ev.type === 'reaction') return react((ev.doc && ev.doc.emoji) || ev.emoji);
      var bag = ev.col === 'questions' ? qs : ev.col === 'answers' ? answers : null; if (!bag || !ev.doc) return;
      if (ev.type === 'remove') delete bag[ev.doc.id]; else bag[ev.doc.id] = Object.assign(bag[ev.doc.id] || {}, ev.doc); draw();
    });
    return Promise.all([conn.getState().then(function (s) { state = s || {}; }), conn.list('questions', {}).then(function (a) { (a || []).forEach(function (d) { qs[d.id] = d; }); }), conn.list('answers', {}).then(function (a) { (a || []).forEach(function (d) { answers[d.id] = d; }); })].map(function (p) { return p.catch(function () { }); }));
  }).then(draw, draw);
})();
