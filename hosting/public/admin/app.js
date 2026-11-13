// lecpage 바로 공개 관리 화면. Cloudflare Access 뒤에서만 열리고, 모든 글은 textContent로만 그립니다(innerHTML 없음, Trusted Types).
// API: /admin/api/… (같은 출처, x-lecpage-admin 머리글. 상태를 바꾸는 요청은 JSON POST)
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var SVGNS = 'http://www.w3.org/2000/svg';
  var TZ = 'Asia/Seoul';

  /** 요소 만들기: h('td', { class: 'num', text: '3' }, 자식…). 글은 언제나 글자 노드 */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    var a = attrs || {};
    Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (v == null || v === false) return;
      if (k === 'text') el.textContent = String(v);
      else if (k === 'class') el.className = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { add(el, k); }); return; }
    el.appendChild(typeof kid === 'object' ? kid : document.createTextNode(String(kid)));
  }
  function s(tag, attrs) {
    var el = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') el.textContent = attrs[k]; else if (k === 'class') el.setAttribute('class', attrs[k]); else el.setAttribute(k, String(attrs[k])); });
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  var n = function (x) { return Number(x || 0).toLocaleString('ko-KR'); };
  var pct = function (x, of) { return of ? Math.round((x / of) * 1000) / 10 : 0; };
  function bytes(b) {
    b = Number(b || 0);
    if (b < 1024 * 1024) return Math.round(b / 1024) + 'KB';
    if (b < 1024 * 1024 * 1024) return (b / 1048576).toFixed(1) + 'MB';
    return (b / 1073741824).toFixed(2) + 'GB';
  }
  function when(t) { return t ? new Date(t).toLocaleString('ko-KR', { timeZone: TZ, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }
  function dateOnly(t) { return new Date(t).toLocaleDateString('ko-KR', { timeZone: TZ, month: 'numeric', day: 'numeric' }); }

  function api(path, opt) {
    opt = opt || {};
    var init = { method: opt.method || 'GET', headers: { 'x-lecpage-admin': '1' }, credentials: 'same-origin', cache: 'no-store' };
    if (opt.body !== undefined) { init.method = 'POST'; init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(opt.body); }
    return fetch('/admin/api/' + path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error((j.error && j.error.message_ko) || ('오류 ' + r.status)); e.status = r.status; throw e; }
        return j;
      });
    });
  }

  var flashT = 0;
  function flash(text, bad) {
    var el = $('[data-flash]');
    el.textContent = text; el.className = 'flash' + (bad ? ' bad' : ''); el.hidden = false;
    clearTimeout(flashT); flashT = setTimeout(function () { el.hidden = true; }, bad ? 9000 : 4000);
  }

  // ── 확인 창 ─────────────────────────────────────────────
  var dlg = $('[data-dialog]');
  function ask(o) {
    return new Promise(function (resolve) {
      $('[data-dialog-title]').textContent = o.title;
      $('[data-dialog-text]').textContent = o.text || '';
      var lab = $('[data-dialog-label]'); var inp = $('[data-dialog-input]');
      lab.hidden = !o.input; inp.value = ''; inp.placeholder = (o.input && o.input.placeholder) || '';
      $('[data-dialog-label-text]').textContent = (o.input && o.input.label) || '';
      var okBtn = $('[data-dialog-ok]'); okBtn.textContent = o.ok || '확인'; okBtn.className = 'btn ' + (o.danger ? 'danger' : 'primary');
      var done = function (v) { dlg.close(); cleanup(); resolve(v); };
      var onSubmit = function (e) { e.preventDefault(); done(o.input ? inp.value.trim() : true); };
      var onCancel = function () { done(null); };
      var onClose = function () { cleanup(); resolve(null); };
      function cleanup() { $('[data-dialog-form]').removeEventListener('submit', onSubmit); $('[data-dialog-cancel]').removeEventListener('click', onCancel); dlg.removeEventListener('cancel', onClose); }
      $('[data-dialog-form]').addEventListener('submit', onSubmit);
      $('[data-dialog-cancel]').addEventListener('click', onCancel);
      dlg.addEventListener('cancel', onClose);
      dlg.showModal();
      (o.input ? inp : okBtn).focus();
    });
  }

  // ── 오늘·30일 ───────────────────────────────────────────
  var state = { overview: null, showAllReports: false };
  function tile(k, v, sub, meter) {
    var t = h('div', { class: 'tile' }, h('div', { class: 'k', text: k }), h('div', { class: 'v', text: v }), sub ? h('div', { class: 's', text: sub }) : null);
    if (meter) {
      var m = h('div', { class: 'meter' + (meter.hot ? ' hot' : ''), role: 'img', 'aria-label': meter.label });
      var bar = h('i'); bar.style.width = Math.min(100, Math.max(0, meter.value)) + '%'; m.appendChild(bar);
      if (meter.mark) { var b = h('b'); b.style.left = meter.mark + '%'; m.appendChild(b); }
      t.appendChild(m);
    }
    return t;
  }
  function renderOverview(o) {
    state.overview = o;
    $('[data-me]').textContent = '운영자 계정: ' + o.me + ' (Cloudflare Access)';
    var plan = $('[data-plan]');
    plan.textContent = o.plan === 'paid' ? 'Workers Paid' : '무료 요금제';
    plan.className = 'badge ' + (o.plan === 'paid' ? 'good' : '');
    var paused = $('[data-paused]');
    paused.hidden = !(o.uploads && o.uploads.paused);
    paused.textContent = o.uploads && o.uploads.paused ? '새 업로드를 멈춰 둔 상태예요' + (o.uploads.reason ? ' — ' + o.uploads.reason : '') + '. 이미 올라온 사이트는 열려요.' : '';

    var t = o.today || {};
    $('[data-today-date]').textContent = t.date ? '(' + Number(t.date.slice(5, 7)) + '월 ' + Number(t.date.slice(8, 10)) + '일 오전 9시부터, 한국 시간)' : '';
    // 권하는 행동 한 줄(이번 달 추세로 언제 무료가 차는지, 유료면 월 비용): capacity.js forecast
    var fc = o.forecast || {};
    var ACT = { upgrade: '유료 전환을 권해요', raise_caps: '하루 상한을 올려도 돼요', pause_new: '새 업로드 멈추기를 검토하세요', none: '지금은 할 일 없음' };
    var adv = $('[data-advice]');
    adv.textContent = (ACT[fc.action] || '권하는 행동') + ': ' + (fc.text || (o.advice && o.advice.text) || '');
    adv.className = 'advice' + (fc.action && fc.action !== 'none' ? ' recommend' : '');

    var stop = Math.round((o.newWorkShare || 0.6) * 100);
    var tiles = clear($('[data-tiles]'));
    var rp = pct(t.req, o.budget);
    tiles.appendChild(tile('오늘 요청', n(t.req), o.budget ? '하루 예산 ' + n(o.budget) + '의 ' + rp + '% · ' + stop + '%에서 새 업로드 멈춤' : '하루 예산 없음(유료)', o.budget ? { value: rp, mark: stop, hot: rp >= stop, label: '하루 예산의 ' + rp + '%' } : null));
    tiles.appendChild(tile('사이트 파일 요청', n(t.site), o.view === 'pages' ? 'Pages로 내보내 세지 않아요(여기는 영상·두 번째 주소만)' : '데이터센터 캐시에서 ' + n(t.edge) + '건'));
    tiles.appendChild(tile('참여 기능 요청', n(t.live), '실시간 방(질문·보드·투표)'));
    tiles.appendChild(tile('API 요청', n(t.api), '올리기·공지·이용 합계 등'));
    tiles.appendChild(tile('새 사이트', n(t.new), '공개 ' + n(t.pub) + '번 · 하루 상한 ' + n(o.limits && o.limits.dailySiteCap)));
    tiles.appendChild(tile('새 실시간 방', n(t.room), '하루 상한 ' + n(o.limits && o.limits.dailyRoomCap)));
    tiles.appendChild(tile('오류(5xx)', n(t.err), '횟수 제한(429) ' + n(t.lim) + '건 · 막은 요청 ' + n(t.bot) + '건'));
    tiles.appendChild(tile('신고 대기', n(o.reports && o.reports.open), '오늘 받은 신고 ' + n(t.rep) + '건'));
    // 무료 하루 한도는 Worker 요청과 DO 요청이 따로(각 10만). DO 요청 = Worker가 부른 Site·Room + Gate가 받은 것 + 숫자 모으기
    var dor = (t.ds || 0) + (t.dr || 0) + (t.g || 0) + (t.gt || 0) + (t.rc || 0);
    var dp = o.plan === 'paid' ? 0 : pct(dor, 100000);
    tiles.appendChild(tile('오늘 DO 요청(어림)', n(dor), o.plan === 'paid' ? '유료: 월 100만 포함, 넘으면 100만당 $0.15' : '무료 하루 10만의 ' + dp + '% · Gate ' + n(t.g) + '건', o.plan === 'paid' ? null : { value: dp, mark: stop, hot: dp >= stop, label: '무료 DO 하루 한도의 ' + dp + '%' }));
    var cap = o.capacity || {};
    var STATE = { open: '받는 중', tight: '붐빔(예약한 연수만)', full: '새로 받지 않음', paused: '멈춤' };
    var WHY = { budget: '오늘 몫을 거의 씀', tight: '연수 날짜가 2주 안인 것만', daily_cap: '하루 새 사이트 상한', storage: '저장 공간', pages_api: 'Pages API 줄 서기', paused: '운영자가 멈춤' };
    tiles.appendChild(tile('지금 단계', STATE[cap.state] || '—', (cap.reason ? WHY[cap.reason] || cap.reason : '모두 받음') + ' · 넘치면 강사 계정(' + (cap.next || []).join('·') + ')으로', null));
    var pa = o.pagesApi || {};
    if (o.view === 'pages') tiles.appendChild(tile('Pages API(5분)', n(pa.used5m) + ' / ' + n(pa.budget), pa.holdUntil ? 'Cloudflare가 잠시 막음 → ' + when(pa.holdUntil) + '까지 줄 서기' : '토큰 한도 1,200번의 ' + pct(pa.used5m, 1200) + '% · 오늘 ' + n(t.pc) + '번(429 ' + n(t.pz) + ')'));
    var tr = fc.trend || {}; var pc = fc.paidCost || {};
    var ft = clear($('[data-forecast-tiles]'));
    ft.appendChild(tile('이번 달 추세(30일 어림)', n(fc.month && fc.month.workerReq) + '건', 'Worker 요청 · DO 요청 ' + n(fc.month && fc.month.doReq) + '건 · 하루 ' + (tr.perDay >= 0 ? '+' : '') + n(tr.perDay) + '씩'));
    ft.appendChild(tile('무료가 빠듯해지는 날', tr.daysToStop == null ? '추세로는 없음' : tr.daysToStop === 0 ? '이미' : '약 ' + tr.daysToStop + '일 뒤', '새 사이트를 받지 못하는 선(하루 한도의 ' + stop + '%) · 붐빔(45%)까지 ' + (tr.daysToTight == null ? '—' : tr.daysToTight === 0 ? '이미' : tr.daysToTight + '일') + ' · 최근 7일 가장 많은 날 ' + pct(tr.peak7, tr.limit) + '%'));
    ft.appendChild(tile('유료로 올리면 월', pc.total != null ? '$' + Number(pc.total).toFixed(2) : '—', pc.items ? '기본 $5 + Worker $' + Number(pc.items.workerReq).toFixed(2) + ' + DO $' + Number(pc.items.doReq).toFixed(2) + ' + 저장 $' + Number(pc.items.storage).toFixed(2) + '(지난 7일 추세)' : ''));

    var st = o.sites || {};
    var sp = pct(st.bytes, st.maxBytes);
    var siteTiles = clear($('[data-site-tiles]'));
    siteTiles.appendChild(tile('살아 있는 사이트', n(st.alive), '공개한 것 ' + n(st.published) + '개 · 기간 ' + ((o.limits && o.limits.siteDays) || 30) + (o.view === 'pages' ? '일(마지막으로 올린 날부터, Pages)' : '일(방문이 있으면 다시 채움)')));
    siteTiles.appendChild(tile('가린 사이트', n(st.blocked), '신고로 임시조치 중'));
    siteTiles.appendChild(tile('참여 기능 방', n(st.rooms), '30일 참여 요청 ' + n(o.month && o.month.live)));
    siteTiles.appendChild(tile('저장량', bytes(st.bytes), '상한 ' + bytes(st.maxBytes) + '의 ' + sp + '% · 사이트 ' + bytes(st.siteBytes) + ' + 방 ' + bytes(st.roomBytes), { value: sp, mark: 80, hot: sp >= 80, label: '저장 상한의 ' + sp + '%' }));

    if (o.viewProblem) flash(o.viewProblem, true);
    renderBookings(o);
    renderChart(o);
    renderDaysTable(o);
    renderUsage(o);
    renderUploads(o);
  }

  function renderChart(o) {
    var box = clear($('[data-chart]'));
    var days = o.days || [];
    // 그릴 곳의 실제 너비로 그려 글자가 눌리지 않게(창 크기가 바뀌면 다시 그림)
    var W = Math.max(300, Math.round(box.clientWidth || 720)); var H = W < 560 ? 200 : 240; var L = 40; var R = 8; var T = 12; var B = 26;
    var max = Math.max.apply(null, days.map(function (d) { return d.req || 0; }).concat([1]));
    var top = o.budget ? Math.max(o.budget * 0.7, max) : max * 1.15;
    var y = function (v) { return T + (H - T - B) * (1 - v / top); };
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': '최근 30일 하루 요청 수 막대그래프' });
    for (var g = 0; g <= 4; g++) {
      var v = (top / 4) * g; var yy = y(v);
      svg.appendChild(s('line', { class: g ? 'grid' : 'base', x1: L, x2: W - R, y1: yy, y2: yy }));
      svg.appendChild(s('text', { x: L - 6, y: yy + 4, 'text-anchor': 'end', text: v >= 1000 ? Math.round(v / 1000) + 'k' : String(Math.round(v)) }));
    }
    var slot = (W - L - R) / Math.max(1, days.length); var bw = Math.max(2, slot - 2);
    var tip = $('[data-tip]');
    days.forEach(function (d, i) {
      var x = L + i * slot + 1; var v = d.req || 0; var yy = y(v); var hgt = Math.max(0, H - B - yy);
      var r = Math.min(4, bw / 2, hgt);
      var path = hgt > 0 ? 'M' + x + ',' + (H - B) + 'V' + (yy + r) + 'Q' + x + ',' + yy + ' ' + (x + r) + ',' + yy + 'H' + (x + bw - r) + 'Q' + (x + bw) + ',' + yy + ' ' + (x + bw) + ',' + (yy + r) + 'V' + (H - B) + 'Z' : '';
      var hit = s('rect', { class: 'hit', x: L + i * slot, y: T, width: slot, height: H - T - B });
      var bar = s('path', { class: 'bar', d: path || 'M0,0' });
      var label = d.date + ' · ' + n(v) + '건' + (o.budget ? ' (' + pct(v, o.budget) + '%)' : '') + ' · 새 사이트 ' + n(d.new) + ' · 오류 ' + n(d.err);
      hit.addEventListener('mousemove', function (e) { tip.textContent = label; tip.hidden = false; tip.style.left = Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 8) + 'px'; tip.style.top = (e.clientY + 14) + 'px'; bar.classList.add('on'); });
      hit.addEventListener('mouseleave', function () { tip.hidden = true; bar.classList.remove('on'); });
      svg.appendChild(hit); svg.appendChild(bar);
      var step = W < 560 ? 7 : 5; var last = days.length - 1;
      if ((i % step === 0 && last - i >= step / 2) || i === last) svg.appendChild(s('text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle', text: d.date.slice(5).replace('-', '/') }));
    });
    if (o.budget) {
      [[0.5, '50%', ''], [o.newWorkShare || 0.6, Math.round((o.newWorkShare || 0.6) * 100) + '% 새 업로드 멈춤', 'stop']].forEach(function (ref) {
        var yy = y(o.budget * ref[0]);
        svg.appendChild(s('line', { class: 'ref ' + ref[2], x1: L, x2: W - R, y1: yy, y2: yy }));
        svg.appendChild(s('text', { class: 'reflabel', x: W - R - 4, y: yy - 4, 'text-anchor': 'end', text: ref[1] }));
      });
    }
    box.appendChild(svg);
  }
  function renderDaysTable(o) {
    var t = clear($('[data-days-table]'));
    t.appendChild(h('thead', null, h('tr', null, ['날짜', '요청', '예산 %', '사이트 파일', '캐시', '참여 기능', 'API', '새 사이트', '공개', '오류'].map(function (x, i) { return h('th', { class: i ? 'num' : '', scope: 'col', text: x }); }))));
    var tb = h('tbody');
    (o.days || []).slice().reverse().forEach(function (d) {
      tb.appendChild(h('tr', null, h('td', { text: d.date }), [d.req, o.budget ? pct(d.req, o.budget) + '%' : '—', d.site, d.edge, d.live, d.api, d.new, d.pub, d.err].map(function (v) { return h('td', { class: 'num', text: typeof v === 'string' ? v : n(v) }); })));
    });
    t.appendChild(tb);
  }

  var USAGE = [['a:open', '앱 열기(하루 한 번)'], ['a:make:key', '만들기 완료 · API 키'], ['a:make:chat', '만들기 완료 · 쓰던 챗봇'], ['a:pub:instant', '공개 · 바로 공개'], ['a:pub:vercel', '공개 · Vercel'], ['a:pub:github', '공개 · GitHub Pages'], ['a:pub:netlify', '공개 · Netlify']];
  function renderUsage(o) {
    var t = clear($('[data-usage-table]'));
    if (!o.stats) { t.appendChild(h('tbody', null, h('tr', null, h('td', { text: '앱 이용 합계를 받지 않게 해 두었어요(STATS=off).' })))); return; }
    var days = o.days || [];
    var sum = function (k, from) { return days.slice(from).reduce(function (a, d) { return a + (d[k] || 0); }, 0); };
    t.appendChild(h('thead', null, h('tr', null, h('th', { scope: 'col', text: '항목' }), h('th', { class: 'num', scope: 'col', text: '오늘' }), h('th', { class: 'num', scope: 'col', text: '7일' }), h('th', { class: 'num', scope: 'col', text: '30일' }))));
    var tb = h('tbody');
    USAGE.forEach(function (u) { tb.appendChild(h('tr', null, h('td', { text: u[1] }), h('td', { class: 'num', text: n(sum(u[0], -1)) }), h('td', { class: 'num', text: n(sum(u[0], -7)) }), h('td', { class: 'num', text: n(sum(u[0], 0)) }))); });
    t.appendChild(tb);
  }

  // ── 새 업로드 멈춤 ─────────────────────────────────────
  function renderUploads(o) {
    var p = o.uploads && o.uploads.paused;
    $('[data-uploads-state]').textContent = p ? '지금: 멈춤' + (o.uploads.at ? ' (' + when(o.uploads.at) + ')' : '') : (o.accepting ? '지금: 받는 중' : '지금: 하루 예산을 많이 써서 받지 않는 중(오전 9시에 다시 받음)');
    var btn = $('[data-uploads-btn]');
    btn.textContent = p ? '다시 받기' : '새 업로드 멈추기';
    btn.className = 'btn ' + (p ? 'primary' : 'danger');
  }
  $('[data-uploads-form]').addEventListener('submit', function (e) {
    e.preventDefault();
    var p = !(state.overview && state.overview.uploads && state.overview.uploads.paused);
    var reason = e.target.reason.value.trim();
    var go = p ? ask({ title: '새 업로드를 멈출까요?', text: '새 사이트·다시 올리기·새 실시간 방을 받지 않아요. 이미 올라온 사이트는 열려요.', ok: '멈추기', danger: true }) : Promise.resolve(true);
    go.then(function (yes) {
      if (!yes) return;
      return api('uploads', { body: { paused: p, reason: reason } }).then(function () { e.target.reason.value = ''; flash(p ? '새 업로드를 멈췄어요.' : '새 업로드를 다시 받아요.'); return loadOverview(); });
    }).catch(function (err) { flash(err.message, true); });
  });

  // ── 사이트 ─────────────────────────────────────────────
  function renderBookings(o) {
    var t = clear($('[data-bookings-table]'));
    var list = o.upcoming || [];
    t.appendChild(h('thead', null, h('tr', null, ['날짜', '연수', '참가자', '참여 기능', '요청 어림', '예산 %', ''].map(function (x, i) { return h('th', { class: i && i < 6 ? 'num' : '', scope: 'col', text: x }); }))));
    var tb = h('tbody');
    list.forEach(function (d, i) {
      tb.appendChild(h('tr', null,
        h('td', { text: Number(d.date.slice(5, 7)) + '월 ' + Number(d.date.slice(8, 10)) + '일' + (i === 0 ? ' (오늘)' : '') }),
        h('td', { class: 'num', text: n(d.trainings) }), h('td', { class: 'num', text: n(d.people) }), h('td', { class: 'num', text: n(d.live) }),
        h('td', { class: 'num', text: n(d.est) }), h('td', { class: 'num', text: o.budget ? d.pct + '%' : '—' }),
        h('td', null, d.full ? h('span', { class: 'badge bad', text: '꽉 참' }) : d.pct >= 50 ? h('span', { class: 'badge', text: '많음' }) : null)));
    });
    t.appendChild(tb);
  }
  function siteLink(id, url) { return h('a', { href: /^https?:\/\//.test(url || '') ? url : '/s/' + encodeURIComponent(id) + '/', target: '_blank', rel: 'noopener noreferrer', class: 'mono', text: id }); }
  function blockSite(id, blocked) {
    var go = blocked
      ? ask({ title: '사이트 ' + id + '를 가릴까요?', text: '확인하는 동안 사이트와 딸린 실시간 방이 닫혀요(451 안내 화면). 가린 날부터 30일 안에 풀거나 지워 주세요.', input: { label: '까닭(올린 사람이 볼 수 없음, 감사 기록에 남음)', placeholder: '저작권 신고 확인 중' }, ok: '가리기', danger: true })
      : ask({ title: '사이트 ' + id + '를 다시 열까요?', ok: '다시 열기' });
    return go.then(function (v) {
      if (v === null) return;
      return api('sites/' + id + '/block', { body: { blocked: blocked, reason: typeof v === 'string' ? v : '' } }).then(function () { flash(blocked ? '가렸어요.' : '다시 열었어요.'); return reloadAll(); });
    }).catch(function (err) { flash(err.message, true); });
  }
  function deleteSite(id) {
    return ask({ title: '사이트 ' + id + '를 지울까요?', text: '파일과 딸린 실시간 방 자료까지 지워지고 되돌릴 수 없어요.', input: { label: '확인: 사이트 주소 10자(' + id + ')를 적어 주세요', placeholder: id }, ok: '지우기', danger: true }).then(function (v) {
      if (v === null) return;
      return api('sites/' + id + '/delete', { body: { confirm: v } }).then(function () { flash('지웠어요.'); return reloadAll(); });
    }).catch(function (err) { flash(err.message, true); });
  }
  function loadSites(q) {
    return api('sites?q=' + encodeURIComponent(q || '')).then(function (j) {
      var t = clear($('[data-sites-table]'));
      var now = Date.now();
      var list = (j.sites || []).filter(function (x) { return x.expiresAt > now; });
      if (!list.length) { t.appendChild(h('tbody', null, h('tr', null, h('td', { class: 'empty', text: q ? '찾는 사이트가 없어요.' : '살아 있는 사이트가 없어요.' })))); return; }
      t.appendChild(h('thead', null, h('tr', null, ['주소', '제목', '크기', '참여 방', '만든 때', '끝나는 때', '상태', ''].map(function (x, i) { return h('th', { class: i === 2 ? 'num' : '', scope: 'col', text: x }); }))));
      var tb = h('tbody');
      list.slice(0, 300).forEach(function (x) {
        tb.appendChild(h('tr', null,
          h('td', null, siteLink(x.id, x.url)),
          h('td', { text: x.title || '(제목 없음)' }),
          h('td', { class: 'num', text: bytes(x.bytes + x.roomBytes) }),
          h('td', { class: 'mono', text: x.liveCode || '—' }),
          h('td', { text: when(x.createdAt) }),
          h('td', { text: dateOnly(x.expiresAt) }),
          h('td', null, h('span', { class: 'badge ' + (x.blocked ? 'bad' : x.bytes ? 'good' : ''), text: x.blocked ? '가림' : x.bytes ? '공개' : '올리는 중' })),
          h('td', { class: 'acts' },
            h('button', { type: 'button', class: 'btn sm', text: x.blocked ? '풀기' : '가리기', onclick: function () { blockSite(x.id, !x.blocked); } }),
            h('button', { type: 'button', class: 'btn sm danger', text: '지우기', onclick: function () { deleteSite(x.id); } }))));
      });
      t.appendChild(tb);
    });
  }
  $('[data-site-search]').addEventListener('submit', function (e) { e.preventDefault(); loadSites(e.target.q.value.trim()).catch(function (err) { flash(err.message, true); }); });

  // ── 신고 ───────────────────────────────────────────────
  function loadReports() {
    return api('reports').then(function (j) {
      var all = j.reports || [];
      var open = all.filter(function (r) { return r.status !== 'done'; });
      $('[data-reports-count]').textContent = '대기 ' + open.length + '건 · 모두 ' + all.length + '건';
      var list = state.showAllReports ? all : open;
      var box = clear($('[data-reports-list]'));
      if (!list.length) { box.appendChild(h('p', { class: 'empty', text: '처리할 신고가 없어요.' })); return; }
      var wrap = h('div', { class: 'reports' });
      list.forEach(function (r) {
        var stateText = { gone: '사이트 없음', blocked: '가림', open: '열려 있음' }[r.siteState] || '';
        wrap.appendChild(h('article', { class: 'card report' },
          h('div', { class: 'head' },
            h('div', null, h('b', { text: '#' + r.n + ' ' }), siteLink(r.site, r.siteUrl), ' ', h('span', { class: 'badge ' + (r.siteState === 'blocked' ? 'bad' : ''), text: stateText }), ' ', h('span', { class: 'badge ' + (r.status === 'done' ? 'good' : 'warn'), text: r.status === 'done' ? '처리함' : '대기' })),
            h('span', { class: 'muted small', text: when(r.at) + ' 받음' + (r.handledAt ? ' · ' + when(r.handledAt) + ' 처리' : '') })),
          h('p', { class: 'reason', text: r.reason }),
          h('p', { class: 'muted small', text: '연락처: ' + (r.contact || '없음') }),
          h('div', { class: 'acts' },
            r.siteState === 'open' ? h('button', { type: 'button', class: 'btn sm danger', text: '가리기(임시조치)', onclick: function () { blockSite(r.site, true); } }) : null,
            r.siteState === 'blocked' ? h('button', { type: 'button', class: 'btn sm', text: '풀기', onclick: function () { blockSite(r.site, false); } }) : null,
            r.siteState !== 'gone' ? h('button', { type: 'button', class: 'btn sm danger', text: '지우기', onclick: function () { deleteSite(r.site); } }) : null,
            h('button', { type: 'button', class: 'btn sm', text: r.status === 'done' ? '다시 열기' : '처리함', onclick: function () {
              api('reports/' + r.n, { body: { status: r.status === 'done' ? 'open' : 'done' } }).then(function () { flash('신고 상태를 바꿨어요.'); return reloadAll(); }).catch(function (err) { flash(err.message, true); });
            } }))));
      });
      box.appendChild(wrap);
    });
  }
  $('[data-reports-all]').addEventListener('change', function (e) { state.showAllReports = e.target.checked; loadReports().catch(function (err) { flash(err.message, true); }); });

  // ── 공지 ───────────────────────────────────────────────
  var form = $('[data-notice-form]');
  var limits = { title: 60, body: 400 };
  function localInput(t) { var d = new Date(t - new Date(t).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); }
  function fromLocal(v) { var t = new Date(v).getTime(); return Number.isFinite(t) ? t : 0; }
  function resetForm() {
    form.reset(); form.id.value = '';
    $('[data-notice-form-title]').textContent = '새 공지';
    var now = Date.now(); form.starts.value = localInput(now); form.ends.value = localInput(now + 7 * 864e5);
    counts(); linkHost(); $('[data-notice-msg]').textContent = '';
  }
  function counts() {
    $('[data-count="title"]').textContent = form.title.value.length + '/' + limits.title;
    $('[data-count="body"]').textContent = form.body.value.length + '/' + limits.body;
  }
  function linkHost() {
    var el = $('[data-link-host]'); var v = form.link.value.trim();
    if (!v) { el.textContent = ''; return; }
    try { var u = new URL(v); el.textContent = u.protocol === 'https:' ? '링크를 누르면 이곳으로 가요: ' + u.hostname : 'https:// 로 시작하는 주소만 돼요.'; } catch (e) { el.textContent = '주소 모양이 아니에요.'; }
  }
  form.title.addEventListener('input', counts); form.body.addEventListener('input', counts); form.link.addEventListener('input', linkHost);
  $('[data-notice-reset]').addEventListener('click', resetForm);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('[data-notice-msg]'); msg.className = 'form-msg'; msg.textContent = '저장하는 중…';
    var targets = []; if (form['t-app'].checked) targets.push('app'); if (form['t-teacher'].checked) targets.push('teacher');
    var body = { title: form.title.value, body: form.body.value, link: form.link.value.trim(), linkLabel: form.linkLabel.value, targets: targets, starts: fromLocal(form.starts.value), ends: fromLocal(form.ends.value), active: form.active.checked };
    var id = form.id.value;
    api(id ? 'notices/' + id : 'notices', { body: body }).then(function () { msg.textContent = '저장했어요. 1분 안에 보이기 시작해요.'; flash('공지를 저장했어요.'); resetForm(); return loadNotices(); })
      .catch(function (err) { msg.className = 'form-msg bad'; msg.textContent = err.message; });
  });
  function editNotice(x) {
    form.id.value = String(x.id); form.title.value = x.title; form.body.value = x.body; form.link.value = x.link || ''; form.linkLabel.value = x.linkLabel || '';
    form['t-app'].checked = x.targets.indexOf('app') >= 0; form['t-teacher'].checked = x.targets.indexOf('teacher') >= 0;
    form.starts.value = localInput(x.starts); form.ends.value = localInput(x.ends); form.active.checked = x.active;
    $('[data-notice-form-title]').textContent = '공지 ' + x.id + ' 고치기';
    counts(); linkHost(); form.title.focus(); form.scrollIntoView({ block: 'start' });
  }
  function loadNotices() {
    return api('notices').then(function (j) {
      if (j.limits) limits = j.limits;
      var box = clear($('[data-notices-list]'));
      var list = j.notices || [];
      if (!list.length) { box.appendChild(h('p', { class: 'empty', text: '아직 공지가 없어요.' })); return; }
      var wrap = h('div', { class: 'notices' }); var now = Date.now();
      list.forEach(function (x) {
        var on = x.active && x.starts <= now && x.ends > now;
        var stateText = !x.active ? '꺼짐' : x.ends <= now ? '끝남' : x.starts > now ? '예정' : '보이는 중';
        var host = ''; try { host = x.link ? new URL(x.link).hostname : ''; } catch (e) { host = ''; }
        wrap.appendChild(h('article', { class: 'card notice' },
          h('div', null, h('b', { text: x.title }), ' ', h('span', { class: 'badge ' + (on ? 'good' : ''), text: stateText })),
          h('p', { class: 'body', text: x.body }),
          x.link ? h('p', { class: 'small' }, h('a', { href: x.link, target: '_blank', rel: 'noopener noreferrer', text: x.linkLabel || '자세히 보기' }), ' (' + host + ')') : null,
          h('p', { class: 'meta', text: '대상: ' + x.targets.map(function (t) { return t === 'app' ? '앱' : '강사 화면'; }).join(', ') + ' · ' + when(x.starts) + ' ~ ' + when(x.ends) + ' · 고친 횟수 ' + (x.rev - 1) }),
          h('div', { class: 'acts' },
            h('button', { type: 'button', class: 'btn sm', text: '고치기', onclick: function () { editNotice(x); } }),
            x.active ? h('button', { type: 'button', class: 'btn sm danger', text: '끄기', onclick: function () {
              api('notices/' + x.id + '/off', { body: {} }).then(function () { flash('공지를 껐어요. 1분 안에 사라져요.'); return loadNotices(); }).catch(function (err) { flash(err.message, true); });
            } }) : null)));
      });
      box.appendChild(wrap);
    });
  }

  // ── 감사 기록 ───────────────────────────────────────────
  var ACTIONS = { 'site.block': '사이트 가림', 'site.unblock': '사이트 풂', 'site.delete': '사이트 지움', 'report.done': '신고 처리함', 'report.reopen': '신고 다시 엶', 'notice.create': '공지 만듦', 'notice.update': '공지 고침', 'notice.off': '공지 끔', 'uploads.pause': '새 업로드 멈춤', 'uploads.resume': '새 업로드 다시 받음' };
  function loadAudit() {
    return api('audit').then(function (j) {
      var t = clear($('[data-audit-table]'));
      var list = j.audit || [];
      if (!list.length) { t.appendChild(h('tbody', null, h('tr', null, h('td', { class: 'empty', text: '아직 기록이 없어요.' })))); return; }
      t.appendChild(h('thead', null, h('tr', null, ['때', '누가', '무엇을', '대상', '내용'].map(function (x) { return h('th', { scope: 'col', text: x }); }))));
      var tb = h('tbody');
      list.forEach(function (a) { tb.appendChild(h('tr', null, h('td', { text: when(a.at) }), h('td', { text: a.who }), h('td', { text: ACTIONS[a.action] || a.action }), h('td', { class: 'mono', text: a.target }), h('td', { text: a.detail }))); });
      t.appendChild(tb);
    });
  }

  function loadOverview() { return api('overview').then(renderOverview); }
  function reloadAll() {
    return Promise.all([loadOverview(), loadSites($('[data-site-search]').q.value.trim()), loadReports(), loadNotices(), loadAudit()])
      .catch(function (err) { flash(err.status === 403 ? '로그인이 끝났어요. 화면을 새로 고쳐 Cloudflare Access로 다시 들어와 주세요.' : err.message, true); });
  }
  var resizeT = 0;
  addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(function () { if (state.overview) renderChart(state.overview); }, 150); });
  $('[data-refresh]').addEventListener('click', function () { reloadAll().then(function () { flash('새로 불러왔어요.'); }); });
  resetForm();
  reloadAll();
})();
