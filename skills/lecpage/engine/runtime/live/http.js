/*! lecpage live — provider 'http': HTTP protocol v1 (Cloudflare Worker or the Node server).
 * Transport: WebSocket → SSE → polling (snapshot?since). Each realtime try gets 4 s to say hello.
 * Heartbeats, reconnect with jittered backoff, resync on every reconnect, slower polling in hidden tabs,
 * and periodic upgrade attempts while polling. A transport that keeps failing is skipped for 10 minutes.
 * config: { url, code, pollMs?, transports?: ['ws','sse','poll'] }
 */
(function (root) {
  'use strict';
  var L = root.LecLive;
  if (!L || !L.register) return;
  var U = L.util;
  var CONNECT_TIMEOUT = 4000;

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
    var ss = U.storage.session; var skipKey = ctx.storage.ns + ':skip';
    var handlers = [];
    var a = { status: 'offline' };
    var kind = null, ws = null, es = null;
    var timers = {};
    var lastMsg = 0, openedAt = 0, attempt = 0, closed = true, pollErr = 0, emptyPolls = 0;

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
      var token = opts.noToken ? null : ctx.token(); var admin = ctx.adminKey();
      if (token) headers['X-Lec-Token'] = token;
      if (admin) headers['X-Lec-Admin'] = encodeURIComponent(admin); // headers must be Latin-1 (Korean keys)
      var body;
      if (opts.form) body = opts.form;
      else if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }
      var ctl = typeof AbortController === 'function' ? new AbortController() : null;
      var to = setTimeout(function () { if (ctl) ctl.abort(); }, opts.timeout || 12000);
      return fetch(prefix + path, { method: method, headers: headers, body: body, signal: ctl ? ctl.signal : undefined, cache: 'no-store', credentials: 'omit', mode: 'cors' })
        .then(function (res) {
          clearTimeout(to);
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
    function absUrl(u) { return u && u.charAt(0) === '/' ? origin + u : u; }

    // ---------------------------------------------------------------- realtime transports
    function onMessage(raw) {
      lastMsg = Date.now();
      if (raw === 'pong') return null;
      var m; try { m = JSON.parse(raw); } catch (e) { return null; }
      if (!m || typeof m !== 'object') return null;
      if (m.type === 'hello') { emit({ type: 'hello', now: m.now }); return m; }
      if (m.type === 'ping' || m.type === 'pong' || m.type === 'auth') return m;
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
        s.onopen = function () { var k = ctx.adminKey(); if (k) s.send(JSON.stringify({ type: 'auth', admin: k })); };
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
    /** Tries transports in order; resolves with the kind that worked ('ws'|'sse'|'poll'). */
    function openBest(realtimeOnly) {
      var list = order.filter(function (t) { return t === 'poll' ? !realtimeOnly : !skipped(t); });
      var i = 0;
      function next() {
        if (closed) return Promise.reject(new Error('closed'));
        var t = list[i++];
        if (!t) return Promise.reject(new Error('no transport'));
        if (t === 'poll') return Promise.resolve('poll');
        return (t === 'ws' ? tryWs() : trySse()).then(function (sock) {
          if (closed) { try { sock.close(); } catch (e) { /* ignore */ } throw new Error('closed'); }
          stopRealtime(); stopPolling();
          if (t === 'ws') ws = sock; else es = sock;
          kind = t; openedAt = lastMsg = Date.now();
          startHeartbeat(t);
          setStatus('live', 'realtime');
          return t;
        }, function () { markFail(t); return next(); });
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
      openBest(false).then(function () { attempt = 0; ctx.emit({ type: 'resync' }); }, function () {
        if (closed) return;
        setStatus('offline');
        timers.reconnect = setTimeout(reconnect, U.backoff(Math.min(attempt++, 5), 2000, 60000));
      });
    }

    // ---------------------------------------------------------------- polling
    function startPolling() {
      stopRealtime();
      kind = 'poll'; pollErr = 0; emptyPolls = 0;
      setStatus('polling', 'polling');
      schedulePoll(pollMs);
      clear('upgrade');
      if (order[0] !== 'poll') timers.upgrade = setInterval(function () {
        if (kind !== 'poll' || closed || U.isHidden()) return;
        openBest(true).then(function () { clear('upgrade'); ctx.emit({ type: 'resync' }); }, function () { /* stay polling */ });
      }, 3 * 60000);
    }
    function stopPolling() { clear('poll'); clear('upgrade'); }
    function schedulePoll(ms) { clear('poll'); timers.poll = setTimeout(pollOnce, ms); }
    function pollOnce() {
      if (closed || kind !== 'poll') return;
      Promise.resolve(ctx.emit({ type: 'resync' })).then(function (r) {
        if (closed || kind !== 'poll') return;
        if (r && r.error) {
          pollErr++;
          if (pollErr >= 3) setStatus('offline');
        } else {
          if (pollErr) setStatus('polling', 'polling');
          pollErr = 0;
          emptyPolls = r && r.changes ? 0 : emptyPolls + 1;
        }
        var ms = pollMs;
        if (pollErr) ms = Math.min(60000, pollMs * Math.pow(2, pollErr));
        else if (U.isHidden()) ms = Math.max(30000, pollMs * 3);
        else if (emptyPolls > 6) ms = Math.min(pollMs * 2, 15000);
        schedulePoll(U.jitter(ms, 0.15));
      });
    }
    function onVisible() {
      if (closed || U.isHidden()) return;
      if (kind === 'poll') schedulePoll(50);
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
    a.setAdmin = function (key) { if (ws && ws.readyState === 1 && key) ws.send(JSON.stringify({ type: 'auth', admin: key })); };
    a.join = function (p) { return request('POST', '/join', { body: p }); };
    a.snapshot = function (o) {
      return request('GET', '/snapshot?since=' + encodeURIComponent((o && o.since) || 0)).then(function (s) { if (s) s.time = s.now; return s; });
    };
    a.list = function (col, o) { return request('GET', '/' + encodeURIComponent(col) + '?since=' + encodeURIComponent((o && o.since) || 0)); };
    a.add = function (col, doc) { return request('POST', '/' + encodeURIComponent(col), { body: doc }); };
    a.update = function (col, id, patch) { return request('PATCH', '/' + encodeURIComponent(col) + '/' + encodeURIComponent(id), { body: patch }); };
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
    a.exportCsv = function (kindName) { return request('GET', '/export.csv?kind=' + encodeURIComponent(kindName), { text: true }); };
    a.purge = function () { return request('DELETE', '').then(function () { return true; }); };
    return a;
  });
})(typeof window !== 'undefined' ? window : globalThis);
