/* lecpage check — 접속 확인: 연수에 쓰는 곳이 이 기기·이 네트워크에서 열리는지 재고, 결과를 '되는 것 / 안 되는 것 / 할 일'로 크게 보여 줍니다.
 * 참여 기능은 주소를 찌르지 않고 실제로 연결해 봄(실시간·새로 읽기 중 어느 방식인지까지). 보조 쪽(개인정보 안내)의 밝게·어둡게도 맡음. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement, $ = function (s, r) { return (r || doc).querySelector(s); };
  function el(tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = text; return n; }
  var tb = $('[data-theme-toggle]');
  if (tb) tb.addEventListener('click', function () {
    var cur = root.getAttribute('data-theme'), dark = cur === 'dark' || (cur !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    root.setAttribute('data-theme', dark ? 'light' : 'dark'); try { localStorage.setItem('lp-theme', dark ? 'light' : 'dark'); } catch (e) { }
  });
  var page = $('[data-check-page]'); if (!page) return;
  var DATA = {}; try { DATA = JSON.parse($('#lp-data').textContent); } catch (e) { }
  var items = []; try { items = JSON.parse(page.getAttribute('data-items') || '[]'); } catch (e) { }
  var liveInfo = null; try { liveInfo = JSON.parse(page.getAttribute('data-live-check') || 'null'); } catch (e) { }
  var tt; function toast(m) { var t = $('[data-toast]'); if (!t) return; t.textContent = m; t.classList.add('is-on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('is-on'); }, 2400); }
  var IC = {
    ok: '<svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    fail: '<svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };
  var verdict = $('[data-verdict]'), big = $('[data-verdict-big]'), sub = $('[data-verdict-sub]');
  var results = [], running = false;

  function probe(url) {
    return new Promise(function (res) {
      var done = false, t = setTimeout(function () { if (!done) { done = true; res('fail'); } }, 7000);
      try {
        fetch(url, { mode: 'no-cors', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' }).then(function () { if (!done) { done = true; clearTimeout(t); res('ok'); } }, function () { if (!done) { done = true; clearTimeout(t); res('fail'); } });
      } catch (e) { done = true; clearTimeout(t); res('fail'); }
    });
  }
  /** 참여 기능: 실제로 연결해 보고 방식(실시간·새로 읽기)과 걸린 시간을 적음 */
  function liveCheck() {
    if (!liveInfo || !DATA.live || !window.LecLive) return Promise.resolve(null);
    var t0 = Date.now(), name = '참여 기능(질문·투표)';
    return new Promise(function (res) {
      var c, done = false, end = function (r) { if (done) return; done = true; try { c && c.close(); } catch (e) { } res(r); };
      setTimeout(function () { end({ name: name, host: liveInfo.name, state: 'fail', need: 'must', impact: '질문·투표·도움 요청이 동작하지 않아요.', fix: '인터넷 연결을 확인하고, 학교·회사 망이면 정보 담당자에게 참여 기능 서버 주소를 열어 달라고 하세요. 참가자는 휴대폰 데이터로 들어오게 안내할 수 있어요.' }); }, 15000);
      try { c = LecLive.create(Object.assign({}, DATA.live, { identity: 'session' })); } catch (e) { return end({ name: name, host: liveInfo.name, state: 'fail', need: 'must', impact: '참여 기능을 불러오지 못했어요.', fix: '새로 고침한 뒤 다시 확인해 주세요.' }); }
      c.connect().then(function (r) {
        var ms = Date.now() - t0, mode = r && r.mode;
        if (mode === 'local') return end({ name: name, host: '리허설', state: 'ok', need: 'must', note: '리허설 설정이라 이 브라우저 안에서만 돌고, 참가자 휴대폰과 이어지지 않아요.', fix: '실제 연수 전에 참여 기능 서버를 연결해 다시 배포하세요.', todo: true, warn: true });
        if (mode === 'polling') return end({ name: name, host: liveInfo.name + ' · 천천히 묻기', state: 'ok', need: 'must', way: '천천히 묻기', note: '이 망이 웹소켓을 막아 천천히 물어요. 질문·투표가 몇 초 늦게 보여요.', fix: '그대로 써도 돼요. 더 빠르게 하려면 기관 정보 담당자에게 웹소켓 연결을 열어 달라고 하세요.', todo: true });
        end({ name: name, host: liveInfo.name + ' · 실시간 · ' + (ms / 1000).toFixed(1) + '초', state: 'ok', need: 'must', way: '실시간' });
      }, function (e) {
        end({ name: name, host: liveInfo.name, state: 'fail', need: 'must', impact: '질문·투표·도움 요청이 동작하지 않아요.' + (e && e.message ? ' (' + e.message + ')' : ''), fix: '인터넷 연결을 확인하고, 학교·회사 망이면 정보 담당자에게 참여 기능 서버 주소를 열어 달라고 하세요. 참가자는 휴대폰 데이터로 들어오게 안내할 수 있어요.' });
      });
    });
  }
  /** 이 기기: 저장소(별명·참여 정보를 기억), 최신 브라우저 기능 */
  function deviceCheck() {
    var ok = true; try { localStorage.setItem('__lp', '1'); localStorage.removeItem('__lp'); } catch (e) { ok = false; }
    var modern = typeof fetch === 'function' && typeof Promise === 'function' && !!window.HTMLDialogElement && !!(window.CSS && CSS.supports && CSS.supports('display', 'grid'));
    if (!modern) return { name: '이 브라우저', host: '오래된 브라우저', state: 'fail', need: 'must', impact: '참여하기 창·질문 칸이 제대로 보이지 않을 수 있어요.', fix: '크롬·엣지·사파리·삼성 인터넷의 최신 판으로 열어 주세요.' };
    if (!ok) return { name: '이 브라우저의 저장소', host: '사생활 보호 모드이거나 막힘', state: 'fail', need: 'nice', impact: '새로 고침하면 별명을 다시 넣어야 해요.', fix: '일반 창으로 열거나 사이트 데이터 저장을 허용해 주세요.' };
    return { name: '이 브라우저', host: (navigator.userAgent.match(/(Edg|SamsungBrowser|Whale|Chrome|Firefox|Version)\/[\d.]+/) || ['최신 브라우저'])[0].replace('Version', 'Safari').replace(/\/(\d+).*/, ' $1'), state: 'ok', need: 'must' };
  }
  function row(r, list) {
    var li = el('li'); li.innerHTML = list === 'ok' ? IC.ok : IC.fail;
    li.appendChild(el('b', '', r.name)); li.appendChild(el('small', '', r.host || ''));
    if (list === 'fail' && r.impact) li.appendChild(el('p', '', r.impact));
    if (list === 'ok' && r.note) li.appendChild(el('p', '', r.note));
    if (list === 'fail' && r.need === 'nice') li.appendChild(el('em', '', '없어도 연수는 할 수 있어요'));
    return li;
  }
  function paint(final) {
    var ok = results.filter(function (r) { return r.state === 'ok'; }), fail = results.filter(function (r) { return r.state === 'fail'; });
    var must = fail.filter(function (r) { return r.need === 'must'; });
    [['ok', ok], ['fail', fail]].forEach(function (x) {
      var ul = $('[data-list="' + x[0] + '"]'), n = $('[data-n="' + x[0] + '"]'); ul.textContent = '';
      x[1].forEach(function (r) { ul.appendChild(row(r, x[0])); });
      if (!x[1].length) ul.appendChild(el('li', 'lp-chk-none', final ? (x[0] === 'fail' ? '막힌 곳이 없어요.' : '열린 곳이 없어요.') : '확인하는 중…'));
      if (n) n.textContent = String(x[1].length);
    });
    var col = $('[data-col="fail"]'); if (col) { if (fail.length) col.setAttribute('data-has', ''); else col.removeAttribute('data-has'); }
    // 할 일: 막힌 곳마다 고칠 방법(같은 문장은 한 번) + 쓸 수는 있지만 알아 둘 것
    var todo = [], seen = {};
    fail.concat(ok.filter(function (r) { return r.todo; })).forEach(function (r) { if (r.fix && !seen[r.fix]) { seen[r.fix] = 1; todo.push(r.fix); } });
    if (fail.length) todo.push('[결과 복사]로 이 결과를 기관 정보 담당자에게 보내면 무엇을 열어야 하는지 바로 알 수 있어요.');
    var ol = $('[data-list="todo"]'); ol.textContent = '';
    if (!todo.length) ol.appendChild(el('li', 'lp-chk-none', final ? '할 일이 없어요. 연수 당일에도 같은 Wi-Fi를 쓰면 돼요.' : '확인이 끝나면 여기에 적어요.'));
    todo.forEach(function (t) { var li = el('li'); li.appendChild(el('p', '', t)); ol.appendChild(li); });
    if (!final) return;
    var warnOk = ok.filter(function (r) { return r.warn; });
    var state = must.length ? 'fail' : fail.length || warnOk.length ? 'warn' : 'ok';
    verdict.setAttribute('data-state', state);
    big.textContent = state === 'ok' ? '모두 열려요' : state === 'warn' ? (warnOk.length && !fail.length ? '참여 기능은 리허설 설정이에요' : '연수는 할 수 있어요') : '꼭 필요한 곳 ' + must.length + '곳이 막혔어요';
    sub.textContent = state === 'ok' ? '이 기기와 이 네트워크에서 연수에 쓰는 곳이 모두 열려요.' : state === 'warn' ? (fail.length ? '없어도 되는 곳 ' + fail.length + '곳이 막혔어요. ' : '') + (warnOk.length ? warnOk[0].note + ' ' : '') + '아래 할 일을 확인해 주세요.' : '아래 할 일을 연수 전에 해 주세요. 결과를 복사해 보낼 수 있어요.';
    // 강사 화면(같은 사이트)이 '전날 점검' 결과로 보여 줌: 이 기기에만 남기고 어디로도 보내지 않음
    var lv = results.filter(function (r) { return r.way || (r.name || '').indexOf('참여 기능') === 0; })[0];
    try { localStorage.setItem('lp-check:' + location.pathname.replace(/[^/]*$/, ''), JSON.stringify({ at: Date.now(), state: state, verdict: big.textContent, live: lv ? (lv.state === 'ok' ? lv.way || '열림' : '막힘') : '' })); } catch (e) { }
  }
  function go() {
    if (running) return; running = true; results = [];
    verdict.setAttribute('data-state', 'wait'); big.textContent = '확인하는 중…';
    var total = items.length + (liveInfo ? 1 : 0) + 1, doneN = 0;
    var step = function (r) { if (r) results.push(r); doneN++; sub.textContent = total + '곳 가운데 ' + doneN + '곳을 확인했어요.'; paint(false); };
    paint(false);
    step(deviceCheck());
    var jobs = items.map(function (it) { return probe(it.url).then(function (st) { step({ name: it.name, host: (function () { try { return new URL(it.url).host.replace(/^www\./, ''); } catch (e) { return it.url; } })(), state: st, need: it.need, impact: it.impact, fix: it.fix }); }); });
    jobs.push(liveCheck().then(function (r) { if (r) step(r); }));
    Promise.all(jobs).then(function () {
      running = false;
      // 꼭 필요한 것·막힌 것이 위로
      results.sort(function (a, b) { return (a.need === 'must' ? 0 : 1) - (b.need === 'must' ? 0 : 1); });
      paint(true);
    });
  }
  var run = $('[data-diag-run]'); if (run) run.addEventListener('click', go);
  var env = $('[data-env]');
  if (env) env.textContent = '브라우저: ' + navigator.userAgent.replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').slice(0, 160) + ' · 화면 ' + innerWidth + '×' + innerHeight + (navigator.onLine === false ? ' · 오프라인' : '') + (navigator.connection && navigator.connection.effectiveType ? ' · 네트워크 ' + navigator.connection.effectiveType : '');
  var cp = $('[data-diag-copy]');
  if (cp) cp.addEventListener('click', function () {
    var lines = ['접속 확인 결과 (' + new Date().toLocaleString('ko-KR') + ')', (DATA.title || '') + ' · ' + location.href.split('#')[0], big.textContent + ' — ' + sub.textContent]
      .concat(results.map(function (r) { return (r.state === 'ok' ? '[열림] ' : '[막힘] ') + r.name + ' · ' + (r.host || '') + (r.state === 'fail' && r.fix ? ' → ' + r.fix : ''); }), env ? [env.textContent] : []);
    var text = lines.join('\n');
    var fb = function () { toast('복사하지 못했어요. 화면을 찍어 보내 주세요.'); };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast('결과를 복사했어요. 메신저에 붙여 넣어 보내세요.'); }, fb); else fb(); } catch (e) { fb(); }
  });
  go();
})();
