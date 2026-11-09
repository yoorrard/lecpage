/*! lecpage live — provider 'supabase' (backends/supabase/schema.sql).
 * supabase-js v2 is loaded lazily from a pinned jsDelivr URL. Only the anon/publishable key is used and
 * Supabase Auth is NOT used (anonymous sign-in is rate limited per IP; a school NAT would be blocked).
 *  - writes: SECURITY DEFINER RPCs with the participant token (or admin key) as an argument
 *  - reads: lec_snapshot (RLS by the x-lec-code header) with a rev cursor
 *  - realtime: public Broadcast channels lec:<CODE> (and lec:<CODE>:adm for the console) carry throttled
 *    "tick" messages only; on a tick the client fetches rows newer than its cursor. Payloads are not trusted.
 *  - fallback: polling the snapshot every pollMs (default 7 s) when the realtime socket cannot connect.
 * config: { url: 'https://<ref>.supabase.co', anonKey, code, pollMs? }
 */
(function (root) {
  'use strict';
  var L = root.LecLive;
  if (!L || !L.register) return;
  var U = L.util;
  var LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js';
  var BUCKET = 'lec-uploads';

  L.register('supabase', function (config, ctx) {
    var code = U.normCode(config.code);
    var pollMs = Math.min(60000, Math.max(3000, Number(config.pollMs) || 7000));
    var handlers = [];
    var a = { status: 'offline' };
    var sb = null, chan = null, admChan = null;
    var timers = {};
    var realtimeOk = false, closed = true, pollErr = 0, emptyPolls = 0;
    var reactBuf = {};

    function emit(evt) { var r; handlers.forEach(function (h, i) { try { var x = h(evt); if (i === 0) r = x; } catch (e) { /* isolate */ } }); return r; }
    function setStatus(s, mode) { if (a.status === s) return; a.status = s; emit({ type: 'status', status: s, mode: mode }); }
    function clear(n) { if (timers[n]) { clearTimeout(timers[n]); clearInterval(timers[n]); timers[n] = null; } }

    function toError(error, status) {
      var c = String((error && error.code) || '');
      var st = /^PT\d{3}$/.test(c) ? Number(c.slice(2)) : (status || 0);
      if (!st && c && /^[0-9A-Z]{5}$/.test(c)) st = c === '57014' || c === '53300' ? 503 : 400;
      var msg = (error && (error.hint || error.message)) || '서버 오류';
      if (!st) msg = 'Supabase에 연결하지 못했어요.';
      return L.error(/^PT\d{3}$/.test(c) ? error.message : (st ? 'error_' + (c || st) : 'network'), msg, { status: st, retryable: !st || st >= 500 || st === 429 });
    }
    function rpc(name, args) {
      if (!sb) return Promise.reject(L.error('not_connected', '아직 연결되지 않았어요.', { status: 0 }));
      return Promise.resolve(sb.rpc(name, args)).then(function (res) {
        if (res.error) throw toError(res.error, res.status);
        var d = res.data;
        if (d && typeof d === 'object' && !Array.isArray(d) && '_flush' in d) { scheduleFlush(d._flush); delete d._flush; }
        return d;
      }, function () { throw L.error('network', 'Supabase에 연결하지 못했어요.', { status: 0 }); });
    }
    // A write inside the throttle window leaves a tick pending; whoever wrote nudges it out a moment later.
    function scheduleFlush(ms) {
      if (!(ms > 0) || timers.flush) return;
      timers.flush = setTimeout(function () {
        timers.flush = null;
        rpc('lec_flush', { p_code: code }).catch(function () { /* next write will flush */ });
      }, ms + 60);
    }

    // ---------------------------------------------------------------- realtime
    function onTick(p) {
      if (!p || typeof p !== 'object') return;
      // never trust the payload: a "reset" only triggers a full reload from the database
      if (p.reset) { ctx.emit({ type: 'resync', full: true }); return; }
      if (p.r && typeof p.r === 'object') Object.keys(p.r).forEach(function (e) { emit({ type: 'reaction', doc: { emoji: e, count: Math.min(50, Number(p.r[e]) || 1) } }); });
      if (typeof p.rev === 'number' && p.rev > (Number(ctx.cursor()) || 0) && !timers.resync) {
        // spread the follow-up reads of a full room over ~0.5 s
        timers.resync = setTimeout(function () { timers.resync = null; ctx.emit({ type: 'resync' }); }, Math.floor(Math.random() * 500));
      }
    }
    function join(topic, onLost) {
      return new Promise(function (resolve) {
        var c = sb.channel(topic, { config: { broadcast: { self: false, ack: false }, private: false } });
        c.on('broadcast', { event: 'tick' }, function (m) { onTick(m && m.payload); });
        var settled = false;
        var t = setTimeout(function () { finish(false); }, 6000);
        function finish(ok) { if (settled) return; settled = true; clearTimeout(t); resolve(ok ? c : null); if (!ok) { try { sb.removeChannel(c); } catch (e) { /* ignore */ } } }
        c.subscribe(function (status) {
          if (status === 'SUBSCRIBED') { if (!settled) finish(true); else onLost(true); }
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { if (!settled) finish(false); else if (!closed) onLost(false); }
        });
      });
    }
    function onPublicState(up) {
      if (closed) return;
      if (up) { realtimeOk = true; stopPolling(); setStatus('live', 'realtime'); ctx.emit({ type: 'resync' }); }
      else { realtimeOk = false; startPolling(); } // supabase-js rejoins by itself; poll meanwhile
    }
    function joinAdmin() {
      if (!sb || admChan || !ctx.adminKey()) return Promise.resolve();
      return join('lec:' + code + ':adm', function () { /* public channel state drives status */ }).then(function (c) { admChan = c; });
    }

    // ---------------------------------------------------------------- polling
    function startPolling() {
      if (timers.poll || closed) return;
      pollErr = 0; emptyPolls = 0;
      setStatus('polling', 'polling');
      schedulePoll(pollMs);
    }
    function stopPolling() { clear('poll'); }
    function schedulePoll(ms) { clear('poll'); timers.poll = setTimeout(pollOnce, ms); }
    function pollOnce() {
      timers.poll = null;
      if (closed || realtimeOk) return;
      Promise.resolve(ctx.emit({ type: 'resync' })).then(function (r) {
        if (closed || realtimeOk) return;
        if (r && r.error) { pollErr++; if (pollErr >= 3) setStatus('offline'); }
        else { if (pollErr) setStatus('polling', 'polling'); pollErr = 0; emptyPolls = r && r.changes ? 0 : emptyPolls + 1; }
        var ms = pollErr ? Math.min(60000, pollMs * Math.pow(2, pollErr)) : U.isHidden() ? Math.max(30000, pollMs * 3) : emptyPolls > 6 ? Math.min(pollMs * 2, 20000) : pollMs;
        schedulePoll(U.jitter(ms, 0.15));
      });
    }
    function onVisible() { if (!closed && !U.isHidden() && !realtimeOk && a.status !== 'offline') schedulePoll(50); }

    // ---------------------------------------------------------------- adapter API (contract §5)
    a.subscribe = function (h) { handlers.push(h); return function () { handlers = handlers.filter(function (x) { return x !== h; }); }; };
    a.connect = function () {
      closed = false;
      setStatus('connecting');
      if (!config.url || !config.anonKey) return Promise.reject(L.error('config', 'Supabase 주소와 anon 키가 필요합니다.', { status: 400, retryable: false }));
      return U.loadScript(LIB, 15000).then(function (ok) {
        if (!ok || !root.supabase || !root.supabase.createClient) throw L.error('lib_failed', 'Supabase 라이브러리를 불러오지 못했어요(cdn.jsdelivr.net이 막혔는지 확인).', { status: 0 });
        if (!sb) {
          sb = root.supabase.createClient(config.url, config.anonKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
            global: { headers: { 'x-lec-code': code } },
            realtime: { params: { eventsPerSecond: 5 } },
          });
        }
        return rpc('lec_snapshot', { p_code: code, p_since: 9007199254740991 }); // reachability probe, returns state only
      }).then(function (s) {
        if (s && s.state) emit({ type: 'state', doc: s.state });
        if (root.document && !a._hooked) { a._hooked = true; root.document.addEventListener('visibilitychange', onVisible); }
        return join('lec:' + code, onPublicState);
      }).then(function (c) {
        chan = c;
        if (c) { realtimeOk = true; setStatus('live', 'realtime'); return joinAdmin().then(function () { return { mode: 'realtime' }; }); }
        startPolling();
        return { mode: 'polling' };
      }, function (e) { setStatus('offline'); throw e; });
    };
    a.close = function () {
      closed = true; realtimeOk = false;
      Object.keys(timers).forEach(clear);
      if (sb) { try { sb.removeAllChannels(); } catch (e) { /* ignore */ } }
      chan = admChan = null;
      setStatus('offline');
    };
    a.setAdmin = function (key) {
      if (!key && admChan) { try { sb.removeChannel(admChan); } catch (e) { /* ignore */ } admChan = null; }
      return key ? joinAdmin() : null;
    };
    a.join = function (p) {
      return rpc('lec_join', { p_code: code, p_nickname: p.nickname || '', p_name: p.name || null, p_school: p.school || null, p_consent: !!p.consent });
    };
    a.snapshot = function (o) {
      var since = (o && o.since) || 0;
      if (ctx.adminKey()) return rpc('lec_admin_snapshot', { p_code: code, p_admin: ctx.adminKey(), p_since: since });
      return rpc('lec_snapshot', { p_code: code, p_since: since }).then(function (s) {
        if (!ctx.token() || since) return s;
        return rpc('lec_mine', { p_code: code, p_token: ctx.token() }).then(function (m) { s.attendance = m.attendance; s.survey = m.survey; s.me = m.me; return s; }, function () { return s; });
      });
    };
    a.list = function (col, o) {
      return a.snapshot({ since: (o && o.since) || 0 }).then(function (s) { return (s && s[col]) || []; });
    };
    a.add = function (col, doc) { return rpc('lec_add', { p_code: code, p_token: ctx.token() || null, p_col: col, p_doc: doc, p_admin: col === 'polls' ? ctx.adminKey() : null }); };
    a.update = function (col, id, patch) { return rpc('lec_update', { p_code: code, p_token: ctx.token() || null, p_admin: ctx.adminKey() || null, p_col: col, p_id: String(id), p_patch: patch }); };
    a.remove = function (col, id) { return rpc('lec_remove', { p_code: code, p_admin: ctx.adminKey() || null, p_col: col, p_id: String(id) }).then(function () { return true; }); };
    a.vote = function (id) { return rpc('lec_vote', { p_code: code, p_token: ctx.token(), p_id: String(id) }); };
    a.like = function (id) { return rpc('lec_like', { p_code: code, p_token: ctx.token(), p_id: String(id) }); };
    a.getState = function () { return rpc('lec_snapshot', { p_code: code, p_since: 9007199254740991 }).then(function (s) { return s.state; }); };
    a.setState = function (patch) { return rpc('lec_set_state', { p_code: code, p_admin: ctx.adminKey() || null, p_patch: patch }); };
    a.react = function (emoji) {
      // one RPC per second per person at most; the database adds the counts into the next tick
      reactBuf[emoji] = (reactBuf[emoji] || 0) + 1;
      if (!timers.react) timers.react = setTimeout(function () {
        timers.react = null;
        var counts = reactBuf; reactBuf = {};
        rpc('lec_react', { p_code: code, p_token: ctx.token(), p_counts: counts }).catch(function () { /* best effort */ });
      }, 1000);
      return Promise.resolve(true);
    };
    a.upload = function (file) {
      var type = file.type || '';
      return rpc('lec_upload_ticket', { p_code: code, p_token: ctx.token(), p_name: file.name || 'file', p_type: type, p_size: file.size }).then(function (t) {
        return Promise.resolve(sb.storage.from(t.bucket || BUCKET).upload(t.path, file, { contentType: type, upsert: false, cacheControl: '31536000' })).then(function (res) {
          if (res.error) throw L.error('upload_failed', '파일을 올리지 못했어요: ' + (res.error.message || ''), { status: Number(res.error.statusCode) || 0 });
          var url = sb.storage.from(t.bucket || BUCKET).getPublicUrl(t.path).data.publicUrl;
          return { url: url, name: t.name || file.name, type: type, size: file.size };
        });
      });
    };
    a.checkAdmin = function () { return rpc('lec_check_admin', { p_code: code, p_admin: ctx.adminKey() || '' }).then(function (ok) { return ok === true; }); };
    a.exportCsv = function (kind, opts) {
      // lec_export returns the whole admin snapshot; 'completion' is built from it here (no schema change needed)
      return rpc('lec_export', { p_code: code, p_admin: ctx.adminKey() || null, p_kind: kind === 'completion' ? 'attendance' : kind }).then(function (data) {
        var t = U.exportTable(kind, data, undefined, opts);
        return U.toCsv(t.columns, t.rows);
      });
    };
    a.purge = function () {
      return rpc('lec_purge', { p_code: code, p_admin: ctx.adminKey() || null }).then(function (r) {
        var files = (r && r.files) || [];
        var jobs = [];
        for (var i = 0; i < files.length; i += 1000) jobs.push(Promise.resolve(sb.storage.from(BUCKET).remove(files.slice(i, i + 1000))));
        return Promise.all(jobs).then(function () { return true; }, function () { return true; });
      });
    };
    return a;
  });
})(typeof window !== 'undefined' ? window : globalThis);
