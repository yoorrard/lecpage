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
 * config: { url, code, pollMs?, transports?: ['ws','sse','poll'], longPoll?: false, waitS?: 20 }
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
      var token = opts.noToken ? null : ctx.token(); var admin = opts.admin || ctx.adminKey();
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
      if (m.type === 'hello') { emit({ type: 'hello', now: m.now }); return m; }
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
          kind = t; openedAt = lastMsg = Date.now();
          startHeartbeat(t);
          setStatus('live', 'realtime');
          return t;
        }, function () { failed.push(t); return next(); });
      }
      return next().then(function (t) { if (t === 'poll') startPolling(); return t; });
    }
    function lost(k) {
      if (closed || kind !== k) return;
      if (Date.now() - openedAt < 30000) markFail(k);
      stopRealtime();
      kind = null;
      setStatus('connecting');
      attempt++;
      clear('reconnect');
      timers.reconnect = setTimeout(reconnect, U.backoff(Math.min(attempt - 1, 5), 1000, 30000));
    }
    function reconnect() {
      if (closed) return;
      openBest(false, true).then(function () { attempt = 0; ctx.emit({ type: 'resync' }); }, function () {
        if (closed) return;
        setStatus('offline');
        timers.reconnect = setTimeout(reconnect, U.backoff(Math.min(attempt++, 5), 2000, 60000));
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
    function stopPolling() { clear('poll'); clear('upgrade'); var c = lpCtl; lpCtl = null; if (c) { try { c.abort(); } catch (e) { /* ignore */ } } }
    function schedulePoll(ms) { clear('poll'); every = ms; timers.poll = setTimeout(pollOnce, ms); }
    /** 긴 대기 한 번: 바뀐 것이 있으면 바로, 없으면 WAIT초 뒤에 답이 옴. 결과는 동기화 차례를 붙잡지 않게 'snapshot' 사건으로 넘김 */
    function longPoll() {
      var t0 = Date.now();
      return request('GET', '/snapshot?since=' + encodeURIComponent(ctx.cursor() || 0) + '&wait=' + WAIT, { timeout: (WAIT + 10) * 1000, ctl: function (c) { lpCtl = c; } })
        .then(function (snap) {
          lpCtl = null; lpFail = 0;
          if (snap) { snap.time = snap.now; fixList(snap.posts); }
          var r = ctx.emit({ type: 'snapshot', doc: snap }) || { changes: 0 };
          var held = Date.now() - t0 >= Math.max(WAIT * 700, WAIT * 1000 - 3000); // 서버가 실제로 붙잡았는지
          if (!r.changes && !held) { if (++quick >= 2 && longOk !== false) { longOk = false; emit({ type: 'net' }); } }
          else { quick = 0; if (held && longOk !== true) { longOk = true; emit({ type: 'net' }); } }
          return r;
        }, function (e) {
          lpCtl = null;
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
        schedulePoll(U.jitter(ms, 0.15));
      });
    }
    function onVisible() {
      if (closed || U.isHidden()) return;
      if (kind === 'poll') { if (!lpCtl) schedulePoll(50); }
      else if (kind && Date.now() - lastMsg > 60000) lost(kind);
    }
    function onOnline() { if (!closed && a.status === 'offline') { clear('reconnect'); attempt = 0; reconnect(); } }

    // ---------------------------------------------------------------- adapter API (contract §5)
    a.subscribe = function (h) { handlers.push(h); return function () { handlers = handlers.filter(function (x) { return x !== h; }); }; };
    a.connect = function () {
      closed = false;
      setStatus('connecting');
      // Probe first so a dead server is reported as offline instead of "polling".
      return request('GET', '/state', { timeout: 8000 }).then(function (st) {
        if (st) emit({ type: 'state', doc: st });
        if (root.document && !a._hooked) {
          a._hooked = true;
          root.document.addEventListener('visibilitychange', onVisible);
          if (root.addEventListener) root.addEventListener('online', onOnline);
        }
        return openBest(false);
      }).then(function (t) { return { mode: t === 'poll' ? 'polling' : 'realtime', transport: t }; }, function (e) {
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
      return { transport: t, every: kind === 'poll' ? every : 0, wait: t === 'long' ? WAIT : 0, hint: hintMs, longOk: longOk };
    };
    a.setAdmin = function (key) { authBad = false; if (ws && ws.readyState === 1 && key) ws.send(JSON.stringify({ type: 'auth', admin: key })); };
    /** ① the admin key → an instructor session { session, expiresAt } (POST /session); older servers answer 404 */
    a.adminSession = function (key) { return request('POST', '/session', { body: {}, admin: key, noToken: true, timeout: 8000 }); };
    a.join = function (p) { return request('POST', '/join', { body: p }); };
    a.snapshot = function (o) {
      return request('GET', '/snapshot?since=' + encodeURIComponent((o && o.since) || 0)).then(function (s) { if (s) { s.time = s.now; fixList(s.posts); } return s; });
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
      if (kindName === 'completion' && opts) ['date', 'start', 'end', 'rate', 'stations'].forEach(function (k) { if (opts[k] != null && opts[k] !== '') q += '&' + k + '=' + encodeURIComponent(opts[k]); });
      if (kindName === 'completion' && opts && opts.survey) q += '&survey=1';
      return request('GET', '/export.csv' + q, { text: true });
    };
    a.purge = function () { return request('DELETE', '').then(function () { return true; }); };
    return a;
  });
})(typeof window !== 'undefined' ? window : globalThis);
