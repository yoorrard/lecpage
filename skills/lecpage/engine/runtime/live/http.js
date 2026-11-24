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
 * Fewer requests, same behaviour (2026-11-24): a page reached from another page of the site opens the WebSocket first
 * (no GET state when it worked a moment ago in this tab; if the socket has not said hello within 1.5 s the state is asked
 * over HTTP as well, so a dead server is reported as early as before), the snapshot comes over the open socket when the
 * server's hello says caps:['sync'] (HTTP otherwise and on any doubt), and a hidden participant tab (config.restHidden,
 * set by the participant page only) polls once in 5 minutes (at once when shown again). Polls themselves are unchanged
 * (wait 20 s). The clock is never taken from an answer the server held: a held answer may carry the time the wait began.
 * After a long poll that brought a host state change (slide, poll opened/revealed/closed, timer, notice) the next one starts
 * after ~1.5 s instead of the full rest, so the host's next step (reveal after open, the next slide) no longer waits out the
 * 6–8 s rest. Only quick re-polls that cost a request count (they answered before the skipped rest was over): after 4 of
 * those in 60 s the normal rest is back. Never while the server asks for a longer gap; answers that carry only
 * participants' posts, quiet periods and interval polling are unchanged.
 * A write that fails with a network error (or gets no answer for 3 s) while a realtime transport is thought to be open
 * triggers one liveness check (a WebSocket ping, or GET state on SSE; 4 s): a silently dead network is noticed in seconds
 * instead of after the 60 s heartbeat silence. Nothing extra is sent while writes succeed.
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
    // 5초 안에 답이 없으면 HTTP로도 묻고 먼저 온 온전한 답을 씀(소켓 답도 계속 기다림). 소켓으로 줄 수 없는 답·서버 오류(5xx)는 그 자리에서 HTTP로.
    // 두 번 이어지면 이 화면에서는 HTTP로만
    var helloCaps = [], wsSync = false, syncSeq = 0, syncWait = {}, syncFails = 0;
    // 이 탭에서 지난번에 웹소켓이 됐는지: 쪽을 옮겨 온 화면은 상태를 따로 묻지 않고 소켓부터 엶(상태는 곧 받는 동기화에 들어 있음)
    var rtKey = ctx.storage.ns + ':rt';
    var HELLO_SLOW = 1500; // 소켓부터 열 때: 이 안에 hello가 없으면 상태도 HTTP로 함께 물음(서버가 닿지 않는 것을 전과 같은 때에 알림)
    // 시계는 바로 온 답으로만 맞춤: 서버가 붙잡았다 보낸 답의 now는 기다리기 시작한 때일 수 있음(Worker가 대신 기다린 긴 대기) — 그것으로 맞추면 타이머가 기다린 만큼 늦게 감
    var AT_ONCE = Math.min(1500, WAIT * 500);
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
      var token = opts.noToken ? null : ctx.token(); var admin = opts.admin || ctx.adminKey();
      if (token) headers['X-Lec-Token'] = token;
      if (admin) headers['X-Lec-Admin'] = encodeURIComponent(admin); // headers must be Latin-1 (Korean keys)
      var body;
      if (opts.form) body = opts.form;
      else if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }
      var ctl = typeof AbortController === 'function' ? new AbortController() : null;
      if (opts.ctl) opts.ctl(ctl);
      var to = setTimeout(function () { if (ctl) ctl.abort(); }, opts.timeout || 12000);
      // 쓰기가 SLOW_WRITE_MS 넘게 답이 없거나 망 오류로 실패하면, 실시간으로 이어져 있다고 보는 동안에는 바로 한 번 확인(checkAlive)
      var write = method !== 'GET';
      var slow = write && !opts.form && realtime() ? setTimeout(checkAlive, SLOW_WRITE_MS) : 0; // 파일 올리기는 오래 걸려도 정상
      return fetch(prefix + path, { method: method, headers: headers, body: body, signal: ctl ? ctl.signal : undefined, cache: 'no-store', credentials: 'omit', mode: 'cors' })
        .then(function (res) {
          clearTimeout(to); clearTimeout(slow);
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
          clearTimeout(to); clearTimeout(slow);
          if (write) checkAlive();
          throw L.error(e && e.name === 'AbortError' ? 'timeout' : 'network', '서버에 연결하지 못했어요.', { status: 0, retryable: true });
        });
    }
    /**
     * 조용히 죽은 망(소켓은 닫히지 않았는데 아무것도 오가지 않음 — 와이파이가 약해짐·화면을 껐다 켬): 심장 박동은 60초 침묵 뒤에야 알아채
     * 그동안 화면이 '연결됨'이라 말함. 실시간으로 이어져 있다고 보는 동안 쓰기가 망 오류로 실패하거나 SLOW_WRITE_MS 넘게 답이 없으면 그때 한 번 확인:
     * 웹소켓은 ping(요청이 아니라 소켓 프레임)에 PROBE_MS 안에 무엇이든 오는지, SSE는 가벼운 GET /state. 답이 없으면 끊긴 것으로 보고 다시 이음(lost).
     * 잘 될 때는 아무것도 더 보내지 않음(확인은 쓰기가 막혔을 때만, 한 번에 하나)
     */
    var SLOW_WRITE_MS = 3000, PROBE_MS = 4000, probing = false;
    function realtime() { return !closed && (kind === 'ws' || kind === 'sse'); }
    function checkAlive() {
      if (probing || !realtime()) return;
      probing = true;
      var k = kind, since = Date.now();
      var done = function (ok) { probing = false; if (!ok && !closed && kind === k) lost(k); };
      if (k === 'ws') {
        try { if (ws && ws.readyState === 1) ws.send('ping'); } catch (e) { /* ignore */ }
        setTimeout(function () { done(lastMsg >= since); }, PROBE_MS);
      } else {
        request('GET', '/state', { timeout: PROBE_MS }).then(function () { done(true); }, function (e) { done(!!(e && e.status)); });
      }
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
     *  realtime failures against WebSocket/SSE.
     *  first (the socket-first connect only): { gone() → this try was given up, state(ms) → its one GET state }. */
    function openBest(realtimeOnly, probe, first) {
      var list = order.filter(function (t) { return t === 'poll' ? !realtimeOnly : !skipped(t); });
      var i = 0, failed = [];
      function marks() { failed.forEach(markFail); failed = []; }
      function off() { return closed || (first && first.gone()); }
      function next() {
        if (off()) return Promise.reject(new Error('closed'));
        var t = list[i++];
        if (!t) { if (realtimeOnly) marks(); return Promise.reject(new Error('no transport')); }
        if (t === 'poll') {
          if (!probe) { marks(); return Promise.resolve('poll'); }
          if (first) return first.state(8000).then(function () { if (off()) throw new Error('closed'); marks(); return 'poll'; });
          return request('GET', '/state', { timeout: 8000 }).then(function (st) { marks(); if (st) emit({ type: 'state', doc: st }); return 'poll'; });
        }
        return (t === 'ws' ? tryWs() : trySse()).then(function (sock) {
          if (off()) { try { sock.close(); } catch (e) { /* ignore */ } throw new Error('closed'); }
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
    function stopPolling() { clear('poll'); clear('upgrade'); var c = lpCtl; lpCtl = null; if (c) { try { c.abort(); } catch (e) { /* ignore */ } } }
    function schedulePoll(ms) { clear('poll'); every = ms; timers.poll = setTimeout(pollOnce, ms); }
    // 강사가 바꾼 것을 받은 뒤의 빠른 다시 묻기. 값을 치른 것만 셈: 건너뛴 쉬는 틈이 끝나기 전에 답이 온 것(평소라면 한 번에 받았을 것을
    // 두 번에 받음 = 요청 하나 더). 그런 것이 지난 60초에 QUICK_MAX번이면 평소 쉬는 틈으로. 틈보다 오래 붙잡힌 것은 어차피 보냈을 요청이라 세지 않음
    // (15초마다 쪽을 넘기는 강의가 몫을 다 써 버려 정작 투표 때 못 쓰지 않게)
    var QUICK_MS = 1500, QUICK_MAX = 4, quickAt = [], quickFrom = 0, quickRest = 0;
    function quickLeft() {
      var now = Date.now();
      quickAt = quickAt.filter(function (t) { return now - t < 60000; });
      return quickAt.length < QUICK_MAX;
    }
    /** 긴 대기 한 번: 바뀐 것이 있으면 바로, 없으면 WAIT초 뒤에 답이 옴. 결과는 동기화 차례를 붙잡지 않게 'snapshot' 사건으로 넘김 */
    function longPoll() {
      var t0 = Date.now();
      return request('GET', '/snapshot?since=' + encodeURIComponent(ctx.cursor() || 0) + '&wait=' + WAIT, { timeout: (WAIT + 10) * 1000, ctl: function (c) { lpCtl = c; } })
        .then(function (snap) {
          lpCtl = null; lpFail = 0;
          if (snap) { if (Date.now() - t0 < AT_ONCE) snap.time = snap.now; fixList(snap.posts); }
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
        // 빠른 다시 묻기가 건너뛴 쉬는 틈이 끝나기 전에 답함: 요청 하나를 더 쓴 것으로 셈
        if (quickFrom) { if (Date.now() - quickFrom < quickRest) quickAt.push(Date.now()); quickFrom = 0; }
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
        // 강사가 바꾼 것(쪽·투표 열기/공개/닫기·타이머·공지)을 실어 온 긴 대기 뒤에는 곧 또 바뀔 때가 많음: 쉬는 틈을 다 기다리면
        // 다음 변화가 그만큼(6~8초) 늦게 보임 → 그런 답 뒤에는 QUICK_MS 뒤에 바로 다시 붙잡음. 값을 치른 것이 1분에 QUICK_MAX번이면 평소 쉬는 틈
        // (위 quickLeft), 서버가 간격을 늘려 달라고 한 날(X-Lec-Poll-Ms가 평소 틈보다 김)에는 하지 않음.
        // 참가자들의 글·응답만 온 답, 조용한 때, 간격 묻기, 오류 뒤는 그대로(방이 떠들썩해도 요청이 늘지 않음)
        if (useLong && r && !r.error && r.state && longOk !== false && (hintMs || 0) <= pollMs && quickLeft()) { quickFrom = Date.now(); quickRest = ms; ms = QUICK_MS; }
        // 서버가 쉬라고 한 시간(Retry-After, 하루 한도·방 붐빔)은 지킴(최대 10분)
        var ra = r && r.error && +r.error.retryAfter;
        if (ra > 0) ms = Math.max(ms, Math.min(ra * 1000, 600000));
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
    function onOnline() { if (!closed && a.status === 'offline') { clear('reconnect'); attempt = 0; reconnect(); } }

    // ---------------------------------------------------------------- adapter API (contract §5)
    a.subscribe = function (h) { handlers.push(h); return function () { handlers = handlers.filter(function (x) { return x !== h; }); }; };
    function hook() {
      if (!root.document || a._hooked) return;
      a._hooked = true;
      root.document.addEventListener('visibilitychange', onVisible);
      if (root.addEventListener) {
        root.addEventListener('online', onOnline);
        // 묻기를 쉬던 화면이 다시 보임: visibilitychange가 오지 않는 길(뒤로 가기로 되살아난 쪽·창이 다시 앞에 옴)에서도 바로 이어 감.
        // 쉬고 있을 때만(다음 묻기가 몇 분 뒤) 당김 — 평소의 창 오가기로 묻기가 늘지 않게
        var back = function () { if (!closed && !U.isHidden() && kind === 'poll' && !lpCtl && every >= HIDDEN_MS * 0.8) schedulePoll(50); };
        root.addEventListener('pageshow', back);
        root.addEventListener('focus', back);
      }
    }
    /**
     * 소켓부터 엶(이 탭에서 방금 전까지 웹소켓이 됨). 상태는 곧 받는 동기화에 들어 있어 따로 묻지 않음.
     * hello가 HELLO_SLOW 안에 오지 않으면 상태도 HTTP로 함께 물음(이 접속에서 한 번만): 서버가 닿지 않으면 상태부터 묻던 때와 같은 때(8초)에 알리고,
     * 소켓이 막힌 망이면 그 답으로 묻기 방식에 내려감(openBest가 다시 묻지 않음)
     */
    function socketFirst() {
      return new Promise(function (resolve, reject) {
        var over = '', st = null;
        var first = {
          gone: function () { return over === 'failed'; },
          state: function (ms) {
            if (!st) st = request('GET', '/state', { timeout: ms }).then(function (doc) { if (doc && !over) emit({ type: 'state', doc: doc }); return doc; });
            return st;
          },
        };
        var slow = setTimeout(function () {
          first.state(8000 - HELLO_SLOW).then(null, function (e) { if (over) return; over = 'failed'; reject(e); });
        }, HELLO_SLOW);
        openBest(false, true, first).then(function (t) { clearTimeout(slow); if (over) return; over = 'ok'; hook(); resolve(t); }, function (e) { clearTimeout(slow); if (over) return; over = 'failed'; reject(e); });
      });
    }
    a.connect = function () {
      closed = false;
      setStatus('connecting');
      // 이 탭에서 방금 전까지 웹소켓이 됐으면(쪽을 옮겨 옴) 상태를 따로 묻지 않고 소켓부터: 요청 하나를 아낌(socketFirst)
      var fast = order[0] === 'ws' && ss.get(rtKey) === 'ws' && !skipped('ws') && !ctx.adminKey();
      // Probe first so a dead server is reported as offline instead of "polling".
      var start = fast ? socketFirst() : request('GET', '/state', { timeout: 8000 }).then(function (st) {
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
      return { transport: t, every: kind === 'poll' ? every : 0, wait: t === 'long' ? WAIT : 0, hint: hintMs, longOk: longOk };
    };
    a.setAdmin = function (key) { authBad = false; if (ws && ws.readyState === 1 && key) ws.send(JSON.stringify({ type: 'auth', admin: key })); };
    /** ① the admin key → an instructor session { session, expiresAt } (POST /session); older servers answer 404 */
    a.adminSession = function (key) { return request('POST', '/session', { body: {}, admin: key, noToken: true, timeout: 8000 }); };
    a.join = function (p) { return request('POST', '/join', { body: p }); };
    function httpSnapshot(since) {
      return request('GET', '/snapshot?since=' + encodeURIComponent(since)).then(function (s) { if (s) { s.time = s.now; fixList(s.posts); } return s; });
    }
    /**
     * 열린 웹소켓으로 동기화를 받음(서버가 caps에 'sync'를 실었을 때, 참가자만).
     * 5초 안에 답이 없으면 HTTP로도 묻고(소켓 답도 계속 기다림: 느린 망의 큰 답) 먼저 온 온전한 답 하나만 씀.
     * 소켓이 끊기거나, 소켓으로 줄 수 없는 답이거나, 서버 오류(5xx)면 그 자리에서 HTTP로. 그 밖의 거절(방이 붐빔 등)은 HTTP 때와 같은 오류로
     */
    function wsSnapshot(since) {
      return new Promise(function (resolve, reject) {
        var id = String(++syncSeq), done = false, http = false;
        function end() { done = true; clearTimeout(to); delete syncWait[id]; }
        function viaHttp() {
          if (http || done) return; http = true; syncFails++;
          httpSnapshot(since).then(function (s) { if (done) return; end(); resolve(s); }, function (e) { if (done) return; end(); reject(e); });
        }
        var to = setTimeout(viaHttp, 5000);
        function finish(m) {
          if (done) return;
          if (m && m.ok && m.doc && typeof m.doc === 'object') { end(); syncFails = 0; var s = m.doc; s.time = s.now; fixList(s.posts); return resolve(s); }
          // HTTP로 이미 묻는 중이면 그 답이 정함(늦게 온 소켓의 거절은 버림). 소켓이 닫혔으면 더 기다리지 않음
          if (http) { if (!m) delete syncWait[id]; return; }
          if (!m || m.ok || m.error === 'too_big' || m.error === 'unsupported' || m.status >= 500) { clearTimeout(to); delete syncWait[id]; return viaHttp(); }
          end();
          reject(L.error(m.error || 'http_' + (m.status || 500), m.message || '서버 오류(' + (m.status || 500) + ')', { status: m.status || 500, retryAfter: m.retryAfter || 0 }));
        }
        syncWait[id] = finish;
        try { var tk = ctx.token(); ws.send(JSON.stringify(tk ? { type: 'sync', id: id, since: since, token: tk } : { type: 'sync', id: id, since: since })); } catch (e) { finish(null); }
      });
    }
    a.snapshot = function (o) {
      var since = (o && o.since) || 0;
      if (wsSync && kind === 'ws' && ws && ws.readyState === 1 && syncFails < 2 && !ctx.adminKey()) return wsSnapshot(since);
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
