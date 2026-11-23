/*! lecpage live — provider 'http': HTTP protocol v1 (Cloudflare Worker or the Node server).
 * Transport: WebSocket → SSE → polling (snapshot?since). Each realtime try gets 4 s to say hello.
 * Heartbeats, reconnect with jittered backoff, resync on every reconnect, slower polling in hidden tabs,
 * and upgrade attempts while polling (3 → 6 → 12 → 30 min apart, none while hidden). A transport that keeps failing is skipped for 10 minutes.
 * Polling (학교망: 웹소켓·SSE가 막힘) is a long-poll when the server holds `snapshot?since=&wait=20` until something changes
 * (lecpage 바로 공개 서버). A server that answers at once is detected after two quick empty answers and polled on an interval instead.
 * The server's `X-Lec-Poll-Ms` is the lower bound of the gap between polls (busy free-plan days ask for 10–20 s).
 * Server down: two network failures in a row while polling → 'offline' (the page shows its "server unreachable" line;
 * writes wait in the queue), and a reconnect only falls back to polling when the server answers over HTTP — so a dead
 * server is never shown as "polling", and its realtime failures are not held against WebSocket. When the server is
 * back, polling resumes and WebSocket is tried again within ~10 s (then on the usual 3 → 6 → 12 → 30 min schedule).
 * config: { url, code, pollMs?, transports?: ['ws','sse','poll'], longPoll?: false, waitS?: 20, waitSteps?: [30, 45, 55] }
 * Fewer requests, same behaviour (2026-11-24): a page reached from another page of the site opens the WebSocket first
 * (no GET state when it worked a moment ago in this tab), the snapshot comes over the open socket when the server's hello
 * says caps:['sync'] (HTTP otherwise and on any doubt), the long-poll wait is raised from 20 s to 55 / 45 / 30 s only after
 * a separate probe request (…&probe=1, held by the server to its end) came back whole on this network — the real polls
 * keep the confirmed wait all along, so nothing is ever seen late while it finds out — and a hidden participant tab
 * (config.restHidden, set by the participant page only) polls once in 5 minutes (at once when shown again).
 * Changes are still delivered the moment they happen.
 */
(function (root) {
  'use strict';
  var L = root.LecLive;
  if (!L || !L.register) return;
  var U = L.util;
  var CONNECT_TIMEOUT = 4000;
  var WAIT_S = 20; // 긴 대기: 서버가 바뀔 때까지 붙잡는 최대 초(서버 상한 25초 안)

  L.register('http', function (config, ctx) {
    var code = U.normCode(config.code);
    var base = String(config.url || '').trim().replace(/\/+$/, '');
    if (!/\/api$/.test(base)) base += '/api';
    var prefix = base + '/' + encodeURIComponent(code);
    var abs = (function () { try { return new URL(prefix, root.location ? root.location.href : undefined).href; } catch (e) { return prefix; } })();
    var origin = (function () { try { return new URL(abs).origin; } catch (e) { return ''; } })();
    var order = (config.transports || ['ws', 'sse', 'poll']).filter(function (t) { return t === 'ws' || t === 'sse' || t === 'poll'; });
    if (order.indexOf('poll') < 0) order.push('poll');
    var pollMs = Math.min(60000, Math.max(2000, Number(config.pollMs) || 5000));
    var WAIT = Math.min(25, Math.max(1, Number(config.waitS) || WAIT_S));
    var ss = U.storage.session; var skipKey = ctx.storage.ns + ':skip';
    var handlers = [];
    var a = { status: 'offline' };
    var kind = null, ws = null, es = null;
    var timers = {};
    var lastMsg = 0, openedAt = 0, attempt = 0, closed = true, pollErr = 0, emptyPolls = 0, netErr = 0;
    // 긴 대기: null 아직 모름 · true 서버가 붙잡아 줌 · false 바로 답하는 서버(간격 묻기). quick: 붙잡지 않은 빈 답이 이어진 수
    var longOk = config.longPoll === false ? false : null, quick = 0, lpFail = 0, hintMs = 0, every = 0, upgradeN = 0, lpCtl = null;
    var authBad = false; // the server refused the admin key on the socket: stop resending it until setAdmin()
    // 소켓으로 받는 동기화: 서버의 hello가 caps에 'sync'를 실을 때만(예전 서버는 지금처럼 HTTP). 쪽 이동·다시 연결 때 snapshot 요청 하나를 아낌.
    // 답이 없거나 소켓으로 줄 수 없는 답이면 그 자리에서 HTTP로 받고, 두 번 이어지면 이 화면에서는 HTTP로만
    var helloCaps = [], wsSync = false, syncSeq = 0, syncWait = {}, syncFails = 0;
    // 이 탭에서 지난번에 웹소켓이 됐는지: 쪽을 옮겨 온 화면은 상태를 따로 묻지 않고 소켓부터 엶(상태는 곧 받는 동기화에 들어 있음)
    var rtKey = ctx.storage.ns + ':rt';
    // 긴 대기의 기다림(초). 실제 묻기는 늘 '확인된 기다림'(waitNow)으로만 감: 처음에는 WAIT(예전 런타임과 같은 20초).
    // 이 망이 더 긴 기다림을 실어 나르는지는 실제 묻기와 따로 보내는 시험 요청(snapshot?…&wait=초&probe=1)으로 확인함: 서버는 방에 무슨 일이 생겨도
    // 그 시간만큼 붙잡았다가 { probe: true }로 답함. 시험 요청이 제때 온전히 돌아왔을 때만 그 값을 실제 묻기에 씀.
    // 그래서 알아보는 동안에도 올린 뒤에도 바뀐 것(투표 열림 등)은 전과 같은 빠르기로 옴. 시험은
    //   - 서버가 상한(답의 waitMax)을 알려 줄 때만(예전 서버에서는 올리지 않음), 긴 대기가 온전히 두 번 이어 돌아온 조용한 화면에서만, 큰 값부터(처음 통과한 값이 끝)
    //   - 답이 HTTP/1.1로 올 때만: 요청마다 연결을 따로 쓰므로 시험 요청의 연결이 그 시간 내내 조용했던 것까지 확인됨
    //     (h2·h3는 연결 하나를 실제 묻기와 같이 써서 그것을 알 수 없음 → 올리지 않고 지금처럼 20초)
    //   - 끊기거나 늦거나 일찍 돌아온 값은 버림. 올린 기다림이 실제 묻기에서 온전히 돌아오지 못하면 바로 WAIT로 돌아가 다시 시험하고, 두 번 끊기면 이 기기에서 하루 동안 올리지 않음
    // 확인된 값은 이 탭(sessionStorage: 쪽을 옮기거나 새로 고쳐도 다시 시험하지 않음)과 이 기기(localStorage: 하루 동안, 새 탭은 그 값부터 한 번 시험)에 기억함.
    // 망이 바뀌었을 수 있으면(online 사건·연결 종류 바뀜·1분 넘게 가려졌다 다시 보임·2분 넘게 묻지 않은 탭·묻기 실패) 확인을 버리고 WAIT에서 다시 시험함.
    // 저장소를 못 쓰는 환경에서는 올리지 않음(쪽마다 다시 시험하면 요청이 오히려 늚)
    var WAIT_STEPS = (Array.isArray(config.waitSteps) ? config.waitSteps : [30, 45, 55]).map(Number).filter(function (x) { return x > WAIT && x <= 120; }).sort(function (x, y) { return x - y; });
    var waitKey = ctx.storage.ns + ':wait', ls = U.storage.local;
    var WAIT_KEEP = 86400000, WAIT_STALE = 120000, HID_FORGET = 60000;
    // waitQueue: 시험할 값(큰 것부터). null 아직 정하지 않음(서버 상한을 모름) · [] 더 시험하지 않음. waitCuts: 올린 기다림이 끊긴 횟수. probing: 보내 둔 시험 요청
    var waitNow = WAIT, waitCap = WAIT, waitGood = 0, waitQueue = null, waitCuts = 0, probing = null, probeSeq = 0, hidAt = 0;
    var waitCut = false; // 올린 기다림이 방금 끊김: 쉬는 틈 없이 바로 다시 물음(끊긴 사이에 바뀐 것을 곧바로 받게)
    var lpSkip = false; // 확인을 버리며 우리가 그만둔 묻기(오류로 세지 않음)
    // 답을 실어 온 프로토콜(자원 시간 기록의 nextHopProtocol): 실제 묻기의 마지막 값과 시험 요청마다의 값. 다른 출처의 서버는 Timing-Allow-Origin을 보내야 보임
    var protoLast = '', protoBy = {}, perfObs = null;
    try {
      if (typeof root.PerformanceObserver === 'function') {
        perfObs = new root.PerformanceObserver(function (list) {
          list.getEntries().forEach(function (e) {
            var n = e && String(e.name || ''); if (!n || n.indexOf(abs + '/snapshot') !== 0) return;
            var p = String(e.nextHopProtocol || '').toLowerCase();
            if (n.indexOf('probe=1') > 0) protoBy[n] = p; else protoLast = p;
          });
        });
        perfObs.observe({ type: 'resource', buffered: true });
      }
    } catch (e) { perfObs = null; }
    function ownConn(p) { return p === 'http/1.1' || p === 'http/1.0'; }
    var HIDDEN_MS = 300000; // 가려진 화면의 참가자: 묻기를 쉼(5분에 한 번만 — 다시 보이면 바로 한 번 물음)
    var REST_HIDDEN = config.restHidden === true; // 참가자 화면만 켬(lecpage.js). 발표 화면·강사 화면은 가려져 있어도 지금처럼 이어 감

    function emit(evt) { var r; handlers.forEach(function (h, i) { try { var x = h(evt); if (i === 0) r = x; } catch (e) { /* isolate */ } }); return r; }
    function setStatus(s, mode) { if (a.status === s) return; a.status = s; emit({ type: 'status', status: s, mode: mode }); }
    function clear(name) { if (timers[name]) { clearTimeout(timers[name]); clearInterval(timers[name]); timers[name] = null; } }
    function skipped(t) { var s = ss.get(skipKey) || {}; return s[t] && s[t] > Date.now(); }
    function markFail(t) {
      var f = a['_fails_' + t] = (a['_fails_' + t] || 0) + 1;
      if (f >= 3) { var s = ss.get(skipKey) || {}; s[t] = Date.now() + 10 * 60000; ss.set(skipKey, s); a['_fails_' + t] = 0; }
    }

    // ---------------------------------------------------------------- requests
    function request(method, path, opts) {
      opts = opts || {};
      var headers = {};
      // bare: 머리글 없이(시험 요청 — 자료를 받지 않으므로 토큰·키를 보내지 않고, 다른 출처에서도 사전 확인 요청이 붙지 않음)
      var token = opts.noToken || opts.bare ? null : ctx.token(); var admin = opts.bare ? null : opts.admin || ctx.adminKey();
      if (token) headers['X-Lec-Token'] = token;
      if (admin) headers['X-Lec-Admin'] = encodeURIComponent(admin); // headers must be Latin-1 (Korean keys)
      var body;
      if (opts.form) body = opts.form;
      else if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }
      var ctl = typeof AbortController === 'function' ? new AbortController() : null;
      if (opts.ctl) opts.ctl(ctl);
      var to = setTimeout(function () { if (ctl) ctl.abort(); }, opts.timeout || 12000);
      return fetch(prefix + path, { method: method, headers: headers, body: body, signal: ctl ? ctl.signal : undefined, cache: 'no-store', credentials: 'omit', mode: 'cors' })
        .then(function (res) {
          clearTimeout(to);
          readHint(res);
          if (opts.text && res.ok) return res.text();
          return res.text().then(function (txt) {
            var data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
            if (!res.ok) {
              var ra = Number(res.headers.get('Retry-After')) || (data && data.retryAfter) || 0;
              throw L.error((data && data.error) || 'http_' + res.status, (data && data.message) || '서버 오류(' + res.status + ')', { status: res.status, retryAfter: ra, detail: data });
            }
            return data;
          });
        }, function (e) {
          clearTimeout(to);
          throw L.error(e && e.name === 'AbortError' ? 'timeout' : 'network', '서버에 연결하지 못했어요.', { status: 0, retryable: true });
        });
    }
    /** 서버의 묻기 간격 권고(X-Lec-Poll-Ms): 붐비는 날 길게. 2~60초만 받음 */
    function readHint(res) {
      var h = 0; try { h = Number(res.headers.get('X-Lec-Poll-Ms')) || 0; } catch (e) { h = 0; }
      if (h >= 2000 && h <= 60000 && h !== hintMs) { hintMs = h; if (kind === 'poll') emit({ type: 'net' }); }
    }
    function absUrl(u) { return u && u.charAt(0) === '/' ? origin + u : u; }
    // Servers store board files as '/api/<code>/files/<name>' (their own uploads only); show them from this server.
    function fixDoc(d) {
      if (d && Array.isArray(d.files)) d.files = d.files.map(function (f) { return f && typeof f.url === 'string' && f.url.indexOf('/api/') === 0 ? U.assign({}, f, { url: absUrl(f.url) }) : f; });
      return d;
    }
    function fixList(list) { if (Array.isArray(list)) list.forEach(fixDoc); return list; }

    // ---------------------------------------------------------------- realtime transports
    function onMessage(raw) {
      lastMsg = Date.now();
      if (raw === 'pong') return null;
      var m; try { m = JSON.parse(raw); } catch (e) { return null; }
      if (!m || typeof m !== 'object') return null;
      if (m.type === 'hello') { helloCaps = Array.isArray(m.caps) ? m.caps : []; emit({ type: 'hello', now: m.now }); return m; }
      if (m.type === 'sync') { var sw = syncWait[m.id]; if (sw) sw(m); return m; }
      if (m.type === 'auth') {
        // an expired instructor session: send the key on this socket instead
        if (m.ok === false && m.error === 'session_expired' && ctx.dropSession) {
          ctx.dropSession(); var k0 = ctx.adminKey();
          if (k0 && ws && ws.readyState === 1) { try { ws.send(JSON.stringify({ type: 'auth', admin: k0 })); } catch (e) { /* closed */ } }
          return m;
        }
        if (m.ok === false) {
          authBad = true;
          emit({ type: 'error', error: L.error(m.error || 'admin_required', m.message || '관리자 키가 맞지 않아요.', { status: m.error === 'rate_limited' ? 429 : 403, retryAfter: m.retryAfter || 0 }) });
        }
        return m;
      }
      if (m.type === 'ping' || m.type === 'pong') return m;
      if (m.col === 'posts' && m.doc) fixDoc(m.doc);
      emit(m);
      return m;
    }
    function tryWs() {
      return new Promise(function (resolve, reject) {
        if (typeof root.WebSocket !== 'function') return reject(new Error('no ws'));
        var url = abs.replace(/^http/, 'ws') + '/ws';
        var s; var done = false;
        try { s = new root.WebSocket(url); } catch (e) { return reject(e); }
        var t = setTimeout(function () { fail(); }, CONNECT_TIMEOUT);
        function fail() { if (done) return; done = true; clearTimeout(t); try { s.close(); } catch (e) { /* ignore */ } reject(new Error('ws failed')); }
        s.onmessage = function (e) {
          var m = onMessage(typeof e.data === 'string' ? e.data : '');
          if (!done && m && m.type === 'hello') {
            done = true; clearTimeout(t);
            s.onclose = function () { if (ws === s) lost('ws'); };
            s.onerror = function () { /* onclose follows */ };
            resolve(s);
          }
        };
        s.onopen = function () { var k = ctx.adminKey(); if (k && !authBad) s.send(JSON.stringify({ type: 'auth', admin: k })); };
        s.onerror = fail;
        s.onclose = fail;
      });
    }
    function trySse() {
      return new Promise(function (resolve, reject) {
        if (typeof root.EventSource !== 'function') return reject(new Error('no sse'));
        var s; var done = false;
        try { s = new root.EventSource(abs + '/events'); } catch (e) { return reject(e); }
        var t = setTimeout(function () { fail(); }, CONNECT_TIMEOUT);
        function fail() { if (done) return; done = true; clearTimeout(t); try { s.close(); } catch (e) { /* ignore */ } reject(new Error('sse failed')); }
        s.onmessage = function (e) {
          var m = onMessage(e.data);
          if (!done && m && m.type === 'hello') {
            done = true; clearTimeout(t);
            s.onerror = function () { if (es === s) lost('sse'); };
            resolve(s);
          }
        };
        s.onerror = fail;
      });
    }
    function startHeartbeat(k) {
      clear('hb');
      timers.hb = setInterval(function () {
        if (k === 'ws' && ws && ws.readyState === 1) { try { ws.send('ping'); } catch (e) { /* ignore */ } }
        var silent = Date.now() - lastMsg;
        if (silent > (k === 'ws' ? 60000 : 50000)) lost(k);
      }, k === 'ws' ? 25000 : 10000);
      // admins do not get private-collection events over SSE; refresh them slowly
      clear('adminSync');
      if (k === 'sse') timers.adminSync = setInterval(function () { if (ctx.adminKey()) ctx.emit({ type: 'resync' }); }, 15000);
    }
    function stopRealtime() {
      clear('hb'); clear('adminSync');
      wsSync = false;
      Object.keys(syncWait).forEach(function (k) { var f = syncWait[k]; if (f) f(null); }); // 기다리던 동기화는 HTTP로 받음
      if (ws) { var w = ws; ws = null; w.onclose = null; w.onmessage = null; try { w.close(); } catch (e) { /* ignore */ } }
      if (es) { var s = es; es = null; s.onerror = null; s.onmessage = null; try { s.close(); } catch (e) { /* ignore */ } }
    }
    /** Tries transports in order; resolves with the kind that worked ('ws'|'sse'|'poll').
     *  probe: before settling for polling, ask the server over plain HTTP (a reconnect after a drop). If even that
     *  fails the server is down, not the network blocking WebSockets: reject (→ 'offline') and do not count the
     *  realtime failures against WebSocket/SSE. */
    function openBest(realtimeOnly, probe) {
      var list = order.filter(function (t) { return t === 'poll' ? !realtimeOnly : !skipped(t); });
      var i = 0, failed = [];
      function marks() { failed.forEach(markFail); failed = []; }
      function next() {
        if (closed) return Promise.reject(new Error('closed'));
        var t = list[i++];
        if (!t) { if (realtimeOnly) marks(); return Promise.reject(new Error('no transport')); }
        if (t === 'poll') {
          if (!probe) { marks(); return Promise.resolve('poll'); }
          return request('GET', '/state', { timeout: 8000 }).then(function (st) { marks(); if (st) emit({ type: 'state', doc: st }); return 'poll'; });
        }
        return (t === 'ws' ? tryWs() : trySse()).then(function (sock) {
          if (closed) { try { sock.close(); } catch (e) { /* ignore */ } throw new Error('closed'); }
          stopRealtime(); stopPolling();
          if (t === 'ws') ws = sock; else es = sock;
          wsSync = t === 'ws' && helloCaps.indexOf('sync') >= 0; syncFails = 0;
          ss.set(rtKey, t);
          kind = t; openedAt = lastMsg = Date.now();
          startHeartbeat(t);
          setStatus('live', 'realtime');
          return t;
        }, function () { failed.push(t); return next(); });
      }
      return next().then(function (t) { if (t === 'poll') { ss.set(rtKey, 'poll'); startPolling(); } return t; });
    }
    function lost(k) {
      if (closed || kind !== k) return;
      if (Date.now() - openedAt < 30000) markFail(k);
      stopRealtime();
      kind = null;
      setStatus('connecting');
      attempt++;
      clear('reconnect');
      timers.reconnect = setTimeout(reconnect, U.backoff(Math.min(attempt - 1, 5), 1000, U.isHidden() ? 30000 : 8000));
    }
    function reconnect() {
      if (closed) return;
      openBest(false, true).then(function () { attempt = 0; ctx.emit({ type: 'resync' }); }, function () {
        if (closed) return;
        setStatus('offline');
        // 화면을 보고 있으면 10초 안쪽으로 다시(서버가 돌아오면 곧 이어짐), 숨긴 탭은 1분까지 늘림
        timers.reconnect = setTimeout(reconnect, U.backoff(Math.min(attempt++, 5), 2000, U.isHidden() ? 60000 : 10000));
      });
    }

    // ---------------------------------------------------------------- polling
    function startPolling() {
      stopRealtime();
      kind = 'poll'; pollErr = 0; netErr = 0; emptyPolls = 0; quick = 0; lpFail = 0; upgradeN = 0;
      setStatus('polling', 'polling');
      emit({ type: 'net' });
      schedulePoll(pollMs);
      scheduleUpgrade();
    }
    /** 실시간으로 다시 올라가 보기: 3분 → 6분 → 12분 → 30분 간격(시도마다 서버 요청 1~2개라 학교망에서는 드물게), 숨겨진 화면에서는 하지 않음 */
    function scheduleUpgrade() {
      clear('upgrade');
      if (order[0] === 'poll' || closed) return;
      timers.upgrade = setTimeout(function () {
        if (kind !== 'poll' || closed) return;
        if (U.isHidden()) return scheduleUpgrade();
        upgradeN++;
        openBest(true).then(function () { clear('upgrade'); ctx.emit({ type: 'resync' }); }, function () { if (kind === 'poll') scheduleUpgrade(); });
      }, Math.min(30, 3 * Math.pow(2, upgradeN)) * 60000);
    }
    function stopPolling() { clear('poll'); clear('upgrade'); stopProbe(); var c = lpCtl; lpCtl = null; if (c) { try { c.abort(); } catch (e) { /* ignore */ } } }
    function schedulePoll(ms) { clear('poll'); every = ms; timers.poll = setTimeout(pollOnce, ms); }
    /** 긴 대기 한 번: 바뀐 것이 있으면 바로, 없으면 WAIT초 뒤에 답이 옴. 결과는 동기화 차례를 붙잡지 않게 'snapshot' 사건으로 넘김 */
    /** 서버가 답에 실은 긴 대기 상한(waitMax, 초): 아는 서버에서만, 그 안에서 시험할 차례를 정함 */
    function noteWaitMax(s) {
      var m = s && Number(s.waitMax);
      if (!(m >= WAIT) || m > 120 || !WAIT_STEPS.length) return;
      waitCap = Math.min(WAIT_STEPS[WAIT_STEPS.length - 1], m);
      if (waitQueue === null) planWait();
    }
    function fresh(t, ms) { var now = Date.now(); t = Number(t) || 0; return t > 0 && now >= t && now - t < ms; }
    function down(x, y) { return y - x; }
    /** 이 탭의 기억: w 실제 묻기에 쓰는 값 · c 끊긴 횟수 · t 마지막으로 온전히 물은 때 · d 시험을 마침 */
    function keepTab() { if (ss.persistent) ss.set(waitKey, { w: waitNow, c: waitCuts, t: Date.now(), d: waitQueue && !waitQueue.length && !probing ? 1 : 0 }); }
    /** 이 기기의 기억(하루): w 확인된 값(WAIT면 올리지 못한 기기) · c 끊긴 횟수 */
    function keepDevice(w) { ls.set(waitKey, { w: w, c: waitCuts, t: Date.now() }); }
    /** 시험할 차례를 정함. 이 탭이 방금까지 쓰던 확인된 값은 그대로 이어 쓰고(다시 시험하지 않음), 아니면 이 기기가 하루 안에 확인한 값부터 */
    function planWait() {
      waitQueue = []; waitGood = 0; waitNow = WAIT;
      if (!ss.persistent || !WAIT_STEPS.length || waitCap <= WAIT) return;
      var mem = ss.get(waitKey), dev = ls.get(waitKey), top = waitCap;
      if (dev && typeof dev === 'object' && fresh(dev.t, WAIT_KEEP)) { top = Math.min(top, Number(dev.w) || WAIT); waitCuts = Math.max(waitCuts, Number(dev.c) || 0); }
      if (mem && typeof mem === 'object' && fresh(mem.t, WAIT_STALE)) {
        waitCuts = Math.max(waitCuts, Number(mem.c) || 0);
        var w = Number(mem.w) || 0;
        if (w > WAIT && w <= waitCap && WAIT_STEPS.indexOf(w) >= 0) waitNow = w;
        if (mem.d) return;
      }
      if (waitCuts >= 2) return;
      waitQueue = WAIT_STEPS.filter(function (x) { return x <= top && x > waitNow; }).sort(down);
    }
    /** 망이 바뀌었을 수 있음: 확인을 버리고 WAIT에서 다시 시험(다음 답의 waitMax로 차례를 다시 정함) */
    function forgetWait() {
      if (waitQueue === null) return;
      stopProbe();
      var was = waitNow, c = lpCtl;
      waitNow = WAIT; waitGood = 0; waitQueue = null; ss.del(waitKey);
      if (was === WAIT) return;
      // 올린 기다림으로 보내 둔 묻기는 그만두고 WAIT로 바로 다시 물음
      if (c) { lpSkip = true; waitCut = true; try { c.abort(); } catch (e) { /* ignore */ } }
      if (kind === 'poll') emit({ type: 'net' });
    }
    /**
     * 올린 기다림(w)의 실제 묻기가 온전히 돌아오지 못함: 바로 WAIT로 돌아가고 그 값부터 다시 시험함.
     * strike: 붙잡힌 채 끊긴 것(망이 그 기다림을 못 실어 나름). 두 번이면 이 기기에서 하루 동안 올리지 않음
     */
    function dropWait(w, strike) {
      stopProbe();
      if (strike) { waitCuts++; waitCut = true; }
      waitNow = WAIT; waitGood = 0;
      waitQueue = waitCuts >= 2 ? [] : WAIT_STEPS.filter(function (x) { return x <= Math.min(w, waitCap); }).sort(down);
      keepTab();
      if (strike) keepDevice(waitCuts >= 2 ? WAIT : w);
      if (kind === 'poll') emit({ type: 'net' });
    }
    /** 시험 요청 하나: 실제 묻기는 그대로 두고 따로 보냄. 조용한 화면(긴 대기가 온전히 두 번 이어 돌아옴)에서, 답이 HTTP/1.1로 오는 망에서만 */
    function maybeProbe() {
      if (probing || !waitQueue || !waitQueue.length || closed || kind !== 'poll' || U.isHidden() || waitGood < 2) return;
      if (!ownConn(protoLast)) {
        // 연결 하나를 같이 쓰는 망(h2·h3): 시험이 뜻이 없어 올리지 않음(이 탭에서는 다시 보지 않음). 아직 모르면(기록이 안 옴) 다음 묻기 뒤에 다시 봄
        if (protoLast) { waitQueue = []; keepTab(); }
        return;
      }
      var p = { w: waitQueue.shift(), t0: Date.now(), hid: false, ctl: null, url: '' };
      var path = '/snapshot?since=' + encodeURIComponent(ctx.cursor() || 1) + '&wait=' + p.w + '&probe=1&n=' + (++probeSeq) + p.t0.toString(36);
      p.url = abs + path;
      probing = p;
      request('GET', path, { bare: true, timeout: (p.w + 5) * 1000, ctl: function (c) { p.ctl = c; } })
        .then(function (d) { probeEnd(p, d); }, function () { probeEnd(p, null); });
    }
    function probeEnd(p, d) {
      if (probing !== p) return; // 그만둔 시험
      var ms = Date.now() - p.t0;
      // 제때 온전히: 서버가 시험 요청으로 알아듣고({ probe: true }) 청한 시간만큼 붙잡았다가 곧바로 돌아옴
      if (!(d && d.probe === true && ms >= p.w * 1000 - 1500 && ms <= p.w * 1000 + 4000)) return probeOver(p, false);
      var n = 0;
      (function look() { // 답을 실어 온 프로토콜 기록은 조금 뒤에 옴
        if (probing !== p) return;
        var pr = protoBy[p.url];
        if (pr === undefined && ++n < 15) { setTimeout(look, 100); return; }
        delete protoBy[p.url];
        probeOver(p, ownConn(pr || ''));
      })();
    }
    function probeOver(p, ok) {
      probing = null;
      if (closed || kind !== 'poll' || !waitQueue) return;
      waitGood = 0;
      // 가려진 동안의 시험은 믿지 않음(멈춘 화면은 시간이 어긋남): 그 값을 다시 차례에 넣고, 다시 조용해지면 시험
      if (p.hid || U.isHidden()) { waitQueue.unshift(p.w); return; }
      if (ok) { waitNow = p.w; waitQueue = []; }
      keepTab();
      if (!waitQueue.length) keepDevice(waitNow); // 시험을 마침: 통과한 값, 또는 모두 안 되면 WAIT(하루 동안 다시 시험하지 않음)
      emit({ type: 'net' });
    }
    function stopProbe() { var p = probing; probing = null; if (p && p.ctl) { try { p.ctl.abort(); } catch (e) { /* ignore */ } } }
    function longPoll() {
      var t0 = Date.now(), w = waitNow;
      return request('GET', '/snapshot?since=' + encodeURIComponent(ctx.cursor() || 0) + '&wait=' + w, { timeout: (w + (w > WAIT ? 6 : 10)) * 1000, ctl: function (c) { lpCtl = c; } }) // 늘린 기다림은 답이 안 오는 것을 더 일찍 알아챔
        .then(function (snap) {
          lpCtl = null; lpFail = 0; lpSkip = false;
          if (snap) { snap.time = snap.now; fixList(snap.posts); noteWaitMax(snap); }
          var r = ctx.emit({ type: 'snapshot', doc: snap }) || { changes: 0 };
          var held = Date.now() - t0 >= Math.max(w * 700, w * 1000 - 3000); // 서버가 실제로 붙잡았는지
          // 올린 기다림이 일찍 빈 답으로 돌아옴(중간의 프록시가 끊고 대신 답함): 간격 묻기로 내려가지 않고 바로 WAIT로 돌아가 다시 시험함
          if (!r.changes && !held && w > WAIT) { if (waitNow === w) dropWait(w, true); return r; }
          if (!r.changes && !held) { if (++quick >= 2 && longOk !== false) { longOk = false; emit({ type: 'net' }); } }
          else { quick = 0; if (held && longOk !== true) { longOk = true; emit({ type: 'net' }); } }
          // 조용한 화면(끝까지 기다린 답이 온전히 두 번 이어 돌아옴)에서만 더 긴 기다림을 시험함. 실제 묻기는 그동안에도 확인된 기다림 그대로
          if (held && !r.changes) waitGood++; else if (r.changes) waitGood = 0;
          if (waitQueue && waitNow === w) { keepTab(); maybeProbe(); }
          return r;
        }, function (e) {
          lpCtl = null;
          // 확인을 버리며(망이 바뀌었을 수 있음) 우리가 그만둔 묻기: 오류로 세지 않고 WAIT로 바로 다시 물음
          if (lpSkip) { lpSkip = false; return { changes: 0 }; }
          // 올린 기다림의 묻기가 돌아오지 못함(망 쪽 까닭): 바로 WAIT로 돌아가 다시 시험함. 붙잡힌 채 끊긴 것(망이 그 기다림을 못 실어 나름)은 오류로 세지 않고 바로 이어 물음.
          // 처음 기다림(WAIT)에서 끊기는 것은 예전 규칙 그대로
          if (w > WAIT && waitNow === w && kind === 'poll' && !closed && e && (e.code === 'timeout' || e.code === 'network' || e.status >= 500 || e.status === 408)) {
            var cut = Date.now() - t0 >= Math.min(3000, WAIT * 1000);
            dropWait(w, cut);
            if (cut) return { changes: 0 };
          }
          // 오래 붙잡은 요청을 망(프록시)이 끊으면 간격 묻기로. 서버가 아예 닿지 않는 것은 그다음 묻기가 가림
          if (kind === 'poll' && !closed && e && (e.code === 'timeout' || e.code === 'network') && ++lpFail >= 2 && longOk !== false) { longOk = false; emit({ type: 'net' }); }
          return { changes: 0, error: e };
        });
    }
    function pollOnce() {
      if (closed || kind !== 'poll') return;
      var useLong = longOk !== false && !U.isHidden() && (ctx.cursor() || 0) > 0, t0 = Date.now();
      Promise.resolve(useLong ? longPoll() : ctx.emit({ type: 'resync' })).then(function (r) {
        if (closed || kind !== 'poll') return;
        if (r && r.error) {
          pollErr++;
          // the server did not answer at all (not an HTTP error): two in a row → offline. A long-poll cut after a while
          // is a proxy on the way (handled by longOk), not a dead server
          var net = !r.error.status && (r.error.code === 'network' || r.error.code === 'timeout') && (!useLong || Date.now() - t0 < 3000);
          netErr = net ? netErr + 1 : 0;
          if (pollErr >= 3 || netErr >= 2) setStatus('offline');
        } else {
          var back = a.status === 'offline';
          if (pollErr) setStatus('polling', 'polling');
          pollErr = 0; netErr = 0;
          emptyPolls = r && r.changes ? 0 : emptyPolls + 1;
          // back after an outage: try realtime again soon (the outage may have been the server, not the network)
          if (back && order[0] !== 'poll') { upgradeN = 0; clear('upgrade'); timers.upgrade = setTimeout(function () { if (kind === 'poll' && !closed && !U.isHidden()) openBest(true).then(function () { clear('upgrade'); ctx.emit({ type: 'resync' }); }, function () { if (kind === 'poll') scheduleUpgrade(); }); else scheduleUpgrade(); }, U.jitter(8000, 0.3)); }
        }
        // 긴 대기는 쉬는 틈만(바뀐 것이 오면 그 틈 동안 모아 다음 대기에서 받음). 간격 묻기는 바뀐 것 없이 이어지면 늘림
        var ms = useLong && !pollErr && longOk !== false ? Math.max(pollMs, hintMs || 0) : netErr ? Math.min(30000, 4000 * netErr) : U.pollDelay(pollMs, { err: pollErr, empty: emptyPolls, hint: hintMs, admin: !!ctx.adminKey() });
        // 서버가 쉬라고 한 시간(Retry-After, 하루 한도·방 붐빔)은 지킴(최대 10분)
        var ra = r && r.error && +r.error.retryAfter;
        if (ra > 0) ms = Math.max(ms, Math.min(ra * 1000, 600000));
        // 올린 기다림이 방금 끊겼거나 확인을 버리며 그만둔 묻기면(드묾) 쉬는 틈 없이 바로 이어 물음
        if (waitCut) { waitCut = false; if (!(r && r.error)) ms = Math.min(ms, 300); }
        // 가려진 화면의 참가자(휴대폰 화면 꺼짐·다른 탭): 묻기를 쉼. 다시 보이면 onVisible이 바로 한 번 물음(강사 화면은 가려져 있어도 지금처럼 이어 감)
        if (REST_HIDDEN && U.isHidden() && !ctx.adminKey()) ms = Math.max(ms, HIDDEN_MS);
        schedulePoll(U.jitter(ms, 0.15));
      });
    }
    function onVisible() {
      if (closed || U.isHidden()) return;
      if (kind === 'poll') { if (!lpCtl) schedulePoll(50); }
      else if (kind && Date.now() - lastMsg > 60000) lost(kind);
      else if (!kind && timers.reconnect) { clear('reconnect'); reconnect(); } // 끊긴 채 숨겼던 탭: 돌아오면 바로 다시
    }
    function onOnline() { forgetWait(); if (!closed && a.status === 'offline') { clear('reconnect'); attempt = 0; reconnect(); } }
    /** 가려짐·다시 보임: 가려진 동안 끝난 시험은 믿지 않고, 1분 넘게 가려졌다 돌아오면(그 사이 망이 바뀌었을 수 있음) 확인된 기다림을 버림 */
    function onVis() {
      if (U.isHidden()) { hidAt = Date.now(); if (probing) probing.hid = true; return; }
      if (hidAt && Date.now() - hidAt >= HID_FORGET) forgetWait();
      hidAt = 0;
    }

    // ---------------------------------------------------------------- adapter API (contract §5)
    a.subscribe = function (h) { handlers.push(h); return function () { handlers = handlers.filter(function (x) { return x !== h; }); }; };
    function hook() {
      if (!root.document || a._hooked) return;
      a._hooked = true;
      root.document.addEventListener('visibilitychange', onVis);
      root.document.addEventListener('visibilitychange', onVisible);
      // 연결 종류가 바뀜(와이파이 ↔ 이동통신): 확인된 기다림을 버리고 다시 시험
      try { var nc = root.navigator && root.navigator.connection; if (nc && nc.addEventListener) nc.addEventListener('change', forgetWait); } catch (e) { /* 없음 */ }
      if (root.addEventListener) {
        root.addEventListener('online', onOnline);
        root.addEventListener('pageshow', function (ev) { if (ev && ev.persisted) forgetWait(); }); // 뒤로 가기로 되살아난 쪽
        // 묻기를 쉬던 화면이 다시 보임: visibilitychange가 오지 않는 길(뒤로 가기로 되살아난 쪽·창이 다시 앞에 옴)에서도 바로 이어 감.
        // 쉬고 있을 때만(다음 묻기가 몇 분 뒤) 당김 — 평소의 창 오가기로 묻기가 늘지 않게
        var back = function () { if (!closed && !U.isHidden() && kind === 'poll' && !lpCtl && every >= HIDDEN_MS * 0.8) schedulePoll(50); };
        root.addEventListener('pageshow', back);
        root.addEventListener('focus', back);
      }
    }
    a.connect = function () {
      closed = false;
      setStatus('connecting');
      // 이 탭에서 방금 전까지 웹소켓이 됐으면(쪽을 옮겨 옴) 상태를 따로 묻지 않고 소켓부터: 상태는 곧 받는 동기화에 들어 있어 요청 하나를 아낌.
      // 소켓이 안 되면 openBest가 묻기 방식으로 내려가기 전에 HTTP로 서버를 확인함(→ 상태). 다시 연결(reconnect)과 같은 길
      var fast = order[0] === 'ws' && ss.get(rtKey) === 'ws' && !skipped('ws') && !ctx.adminKey();
      // Probe first so a dead server is reported as offline instead of "polling".
      var start = fast ? openBest(false, true).then(function (t) { hook(); return t; }) : request('GET', '/state', { timeout: 8000 }).then(function (st) {
        if (st) emit({ type: 'state', doc: st });
        hook();
        return openBest(false);
      });
      return start.then(function (t) { return { mode: t === 'poll' ? 'polling' : 'realtime', transport: t }; }, function (e) {
        setStatus('offline');
        throw e;
      });
    };
    a.close = function () {
      closed = true; stopRealtime(); stopPolling(); clear('reconnect'); kind = null;
      setStatus('offline');
    };
    a.transport = function () { return kind; };
    /** 강사 화면의 '묻기 방식' 한 줄: transport 'ws'|'sse'|'long'|'poll', every 다음 묻기까지(ms), hint 서버 권고(ms) */
    a.netInfo = function () {
      var t = kind === 'poll' ? (longOk === false || U.isHidden() ? 'poll' : 'long') : kind;
      // probe: 지금 시험 중인 기다림(초, 없으면 0) · left: 남은 시험 수(-1 아직 정하지 않음)
      return { transport: t, every: kind === 'poll' ? every : 0, wait: t === 'long' ? waitNow : 0, hint: hintMs, longOk: longOk, probe: probing ? probing.w : 0, left: waitQueue ? waitQueue.length : -1 };
    };
    a.setAdmin = function (key) { authBad = false; if (ws && ws.readyState === 1 && key) ws.send(JSON.stringify({ type: 'auth', admin: key })); };
    /** ① the admin key → an instructor session { session, expiresAt } (POST /session); older servers answer 404 */
    a.adminSession = function (key) { return request('POST', '/session', { body: {}, admin: key, noToken: true, timeout: 8000 }); };
    a.join = function (p) { return request('POST', '/join', { body: p }); };
    function httpSnapshot(since) {
      return request('GET', '/snapshot?since=' + encodeURIComponent(since)).then(function (s) { if (s) { s.time = s.now; fixList(s.posts); noteWaitMax(s); } return s; });
    }
    /** 열린 웹소켓으로 동기화를 받음(서버가 caps에 'sync'를 실었을 때, 참가자만). 답이 없으면 HTTP로 */
    function wsSnapshot(since) {
      return new Promise(function (resolve, reject) {
        var id = String(++syncSeq), done = false;
        var to = setTimeout(function () { finish(null); }, 5000);
        function finish(m) {
          if (done) return; done = true; clearTimeout(to); delete syncWait[id];
          if (m && m.ok && m.doc && typeof m.doc === 'object') { syncFails = 0; var s = m.doc; s.time = s.now; fixList(s.posts); return resolve(s); }
          // 답이 없거나(시간 초과·소켓 끊김) 소켓으로 줄 수 없는 답: HTTP로 받음
          if (!m || m.ok || m.error === 'too_big' || m.error === 'unsupported') { syncFails++; var fb = new Error('ws sync'); fb._fallback = true; return reject(fb); }
          reject(L.error(m.error || 'http_' + (m.status || 500), m.message || '서버 오류(' + (m.status || 500) + ')', { status: m.status || 500, retryAfter: m.retryAfter || 0 }));
        }
        syncWait[id] = finish;
        try { var tk = ctx.token(); ws.send(JSON.stringify(tk ? { type: 'sync', id: id, since: since, token: tk } : { type: 'sync', id: id, since: since })); } catch (e) { finish(null); }
      });
    }
    a.snapshot = function (o) {
      var since = (o && o.since) || 0;
      if (wsSync && kind === 'ws' && ws && ws.readyState === 1 && syncFails < 2 && !ctx.adminKey()) {
        return wsSnapshot(since).then(null, function (e) { if (e && e._fallback) return httpSnapshot(since); throw e; });
      }
      return httpSnapshot(since);
    };
    a.list = function (col, o) { return request('GET', '/' + encodeURIComponent(col) + '?since=' + encodeURIComponent((o && o.since) || 0)).then(fixList); };
    a.add = function (col, doc) { return request('POST', '/' + encodeURIComponent(col), { body: doc }).then(fixDoc); };
    a.update = function (col, id, patch) { return request('PATCH', '/' + encodeURIComponent(col) + '/' + encodeURIComponent(id), { body: patch }).then(fixDoc); };
    a.remove = function (col, id) { return request('DELETE', '/' + encodeURIComponent(col) + '/' + encodeURIComponent(id)).then(function () { return true; }); };
    a.vote = function (id) { return request('POST', '/questions/' + encodeURIComponent(id) + '/vote', { body: {} }); };
    a.like = function (id) { return request('POST', '/posts/' + encodeURIComponent(id) + '/like', { body: {} }); };
    a.getState = function () { return request('GET', '/state'); };
    a.setState = function (patch) { return request('PUT', '/state', { body: patch }); };
    a.react = function (emoji) { return request('POST', '/react', { body: { emoji: emoji }, timeout: 5000 }).then(function () { return true; }); };
    a.upload = function (file) {
      var fd = new FormData(); fd.append('file', file, file.name || 'file');
      return request('POST', '/upload', { form: fd, timeout: 180000 }).then(function (r) { r.url = absUrl(r.url); return r; });
    };
    a.checkAdmin = function () {
      // without the participant token: a token alone would read its own record and look like success
      if (!ctx.adminKey()) return Promise.resolve(false);
      return request('GET', '/participants?since=9000000000000', { noToken: true }).then(function () { return true; }, function (e) { if (e.status === 401 || e.status === 403) return false; throw e; });
    };
    a.exportCsv = function (kindName, opts) {
      var q = '?kind=' + encodeURIComponent(kindName);
      if (kindName === 'completion' && opts) ['date', 'start', 'end', 'rate', 'stations', 'days'].forEach(function (k) { if (opts[k] != null && opts[k] !== '') q += '&' + k + '=' + encodeURIComponent(opts[k]); });
      if (kindName === 'completion' && opts && opts.survey) q += '&survey=1';
      return request('GET', '/export.csv' + q, { text: true });
    };
    a.purge = function () { return request('DELETE', '').then(function () { return true; }); };
    return a;
  });
})(typeof window !== 'undefined' ? window : globalThis);
