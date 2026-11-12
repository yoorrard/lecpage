/*! lecpage live — provider 'supabase' (backends/supabase/schema.sql).
 * supabase-js v2 is loaded lazily from a pinned jsDelivr URL. Only the anon/publishable key is used and
 * Supabase Auth is NOT used (anonymous sign-in is rate limited per IP; a school NAT would be blocked).
 *  - writes: SECURITY DEFINER RPCs with the participant token (or admin key) as an argument
 *  - reads: lec_snapshot (RLS by the x-lec-code header) with a rev cursor
 *  - realtime: public Broadcast channels lec:<CODE> (and lec:<CODE>:adm for the console) carry throttled
 *    "tick" messages only; on a tick the client fetches rows newer than its cursor. Anyone with the publishable key
 *    can send to a public channel, so a payload is only a hint: resyncs are throttled (and back off while hints bring
 *    nothing new) and reaction counts come from lec_reactions(), never from the payload.
 *  - files: the bucket is private; posts carry a Storage path and the client asks for 1-hour signed URLs (re-signed
 *    by a full resync every 45 minutes). The console deletes trashed files (removed posts, purge, retention).
 *  - fallback: polling the snapshot every pollMs (default 7 s) when the realtime socket cannot connect.
 * config: { url: 'https://<ref>.supabase.co', anonKey, code, pollMs? }
 */
(function (root) {
  'use strict';
  var L = root.LecLive;
  if (!L || !L.register) return;
  var U = L.util;
  var LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js';
  // Subresource Integrity for LIB (sha384 of that exact file); the loader refuses remote scripts without one.
  var LIB_SRI = 'sha384-TcHRA3zBbn+Lexh5n+Oil4guNPOS3rjNDpGRAN46u/s/mB2IZ50ceC6TYDU2yvgK';
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
    var hint = { gap: 1500, last: 0, full: false }; // resync hints from ticks: min gap, doubled while they bring nothing
    var rx = null, rxAt = 0;                        // last reaction batch seen (lec_reactions)
    var signed = {};                                // storage path → { url, exp }
    var sweptAt = 0;

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
    /** A resync asked for by a tick. At most one per `hint.gap`; the gap doubles (to 30 s) while hints bring nothing
     *  new (forged ticks), and resets once one does. Reads of a full room are spread over ~0.5 s. */
    function hintResync(full) {
      if (full) hint.full = true;
      if (timers.resync) return;
      var wait = Math.max(0, hint.last + hint.gap - Date.now()) + Math.floor(Math.random() * 500);
      timers.resync = setTimeout(function () {
        timers.resync = null; hint.last = Date.now();
        var f = hint.full; hint.full = false;
        Promise.resolve(ctx.emit({ type: 'resync', full: f })).then(function (r) {
          hint.gap = r && r.changes ? 1500 : Math.min(30000, hint.gap * 2);
        });
      }, wait);
    }
    /** Reaction batches: the tick only says "batch rx exists"; the counts come from the database. */
    function fetchReactions() {
      if (timers.rx || !sb) return;
      timers.rx = setTimeout(function () {
        timers.rx = null; rxAt = Date.now();
        rpc('lec_reactions', { p_code: code }).then(function (b) {
          if (!b || typeof b.rx !== 'number') return;
          var fresh = rx !== null && b.rx > rx;
          rx = Math.max(rx || 0, b.rx);
          if (fresh && b.r && typeof b.r === 'object') Object.keys(b.r).forEach(function (e) { emit({ type: 'reaction', doc: { emoji: e, count: Math.min(50, Number(b.r[e]) || 1) } }); });
        }, function () { /* best effort */ });
      }, Math.max(0, rxAt + 1500 - Date.now()) + Math.floor(Math.random() * 300));
    }
    function onTick(p) {
      if (!p || typeof p !== 'object') return;
      // never trust the payload: a "reset" only asks for a (throttled) full reload from the database
      if (p.reset) { hintResync(true); return; }
      if (typeof p.rx === 'number' && (rx === null || p.rx > rx)) fetchReactions();
      if (typeof p.rev === 'number' && p.rev > (Number(ctx.cursor()) || 0)) hintResync(false);
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

    // ---------------------------------------------------------------- files (private bucket, signed URLs)
    function filePath(f) {
      if (!f) return null;
      if (typeof f.path === 'string' && f.path) return f.path;
      var m = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/lec-uploads\/([^?#]+)/.exec(String(f.url || ''));
      try { return m ? decodeURIComponent(m[1]) : null; } catch (e) { return null; }
    }
    /** Fills files[].url of posts with signed URLs (1 h). Paths the database refuses (hidden posts) stay without a URL. */
    function signPosts(list) {
      list = Array.isArray(list) ? list : [];
      var need = {}, now = Date.now();
      list.forEach(function (d) { (d && d.files || []).forEach(function (f) { var p = filePath(f); if (p && !(signed[p] && signed[p].exp - now > 20 * 60000)) need[p] = 1; }); });
      var paths = Object.keys(need);
      var job = paths.length && sb && sb.storage
        ? Promise.resolve(sb.storage.from(BUCKET).createSignedUrls(paths, 3600)).then(function (res) {
          ((res && res.data) || []).forEach(function (x) { var u = x && (x.signedUrl || x.signedURL); if (x && x.path && u && !x.error) signed[x.path] = { url: u, exp: Date.now() + 3600e3 }; });
        }, function () { /* no URL this time */ })
        : Promise.resolve();
      return job.then(function () {
        list.forEach(function (d) {
          if (d && Array.isArray(d.files)) d.files = d.files.map(function (f) { var p = filePath(f); return p ? U.assign({}, f, { path: p, url: signed[p] ? signed[p].url : '' }) : f; });
        });
        if (Object.keys(signed).length && !timers.resign) timers.resign = setTimeout(function () { timers.resign = null; if (!closed) ctx.emit({ type: 'resync', full: true }); }, 45 * 60000);
        return list;
      });
    }
    /** Console only: delete the files the database put in the trash (removed posts, purge, retention). */
    function sweep(force) {
      if (!sb || !ctx.adminKey() || (!force && Date.now() - sweptAt < 60000)) return Promise.resolve();
      sweptAt = Date.now();
      return rpc('lec_trash', { p_code: code, p_admin: ctx.adminKey() }).then(function (r) {
        var paths = (r && r.paths) || []; var jobs = [];
        for (var i = 0; i < paths.length; i += 100) jobs.push(Promise.resolve(sb.storage.from(BUCKET).remove(paths.slice(i, i + 100))));
        return Promise.all(jobs);
      }).then(function () { return true; }, function () { return false; });
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
      if (!config.url || !config.anonKey) return Promise.reject(L.error('config', 'Supabase 주소와 anon 키가 필요해요.', { status: 400, retryable: false }));
      return U.loadScript(LIB, 15000, { integrity: LIB_SRI }).then(function (ok) {
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
        // baseline for reaction batches (older schemas have no lec_reactions: no reactions then)
        rpc('lec_reactions', { p_code: code }).then(function (b) { if (b && typeof b.rx === 'number' && rx === null) rx = b.rx; }, function () { });
        sweep();
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
      if (key) sweep();
      return key ? joinAdmin() : null;
    };
    a.join = function (p) {
      return rpc('lec_join', { p_code: code, p_nickname: p.nickname || '', p_name: p.name || null, p_school: p.school || null, p_consent: !!p.consent });
    };
    function withFiles(s) { return s && s.posts && s.posts.length ? signPosts(s.posts).then(function () { return s; }) : s; }
    a.snapshot = function (o) {
      var since = (o && o.since) || 0;
      if (ctx.adminKey()) return rpc('lec_admin_snapshot', { p_code: code, p_admin: ctx.adminKey(), p_since: since }).then(withFiles);
      return rpc('lec_snapshot', { p_code: code, p_since: since }).then(function (s) {
        if (!ctx.token() || since) return s;
        return rpc('lec_mine', { p_code: code, p_token: ctx.token() }).then(function (m) {
          s.attendance = m.attendance; s.survey = m.survey; s.me = m.me;
          // my own progress/answers/help come back with `by` (the public snapshot leaves it out)
          ['progress', 'answers', 'help'].forEach(function (c) {
            if (!Array.isArray(m[c]) || !Array.isArray(s[c])) return;
            var mine = {}; m[c].forEach(function (d) { mine[d.id] = d; });
            s[c] = s[c].map(function (d) { var x = mine[d.id]; delete mine[d.id]; return x || d; }).concat(Object.keys(mine).map(function (k) { return mine[k]; }));
          });
          return s;
        }, function () { return s; });
      }).then(withFiles);
    };
    a.list = function (col, o) {
      return a.snapshot({ since: (o && o.since) || 0 }).then(function (s) { return (s && s[col]) || []; });
    };
    function signDoc(col) { return function (d) { return col === 'posts' && d && d.files ? signPosts([d]).then(function () { return d; }) : d; }; }
    a.add = function (col, doc) { return rpc('lec_add', { p_code: code, p_token: ctx.token() || null, p_col: col, p_doc: doc, p_admin: col === 'polls' ? ctx.adminKey() : null }).then(signDoc(col)); };
    a.update = function (col, id, patch) { return rpc('lec_update', { p_code: code, p_token: ctx.token() || null, p_admin: ctx.adminKey() || null, p_col: col, p_id: String(id), p_patch: patch }).then(signDoc(col)); };
    a.remove = function (col, id) {
      return rpc('lec_remove', { p_code: code, p_admin: ctx.adminKey() || null, p_col: col, p_id: String(id) }).then(function () { if (col === 'posts') sweep(true); return true; });
    };
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
        return Promise.resolve(sb.storage.from(t.bucket || BUCKET).upload(t.path, file, { contentType: type, upsert: false, cacheControl: '300' })).then(function (res) {
          if (res.error) throw L.error('upload_failed', '파일을 올리지 못했어요: ' + (res.error.message || ''), { status: Number(res.error.statusCode) || 0 });
          // private bucket: the post keeps the path; readers get a signed URL once the post is visible
          return { path: t.path, url: '', name: t.name || file.name, type: type, size: file.size };
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
        for (var i = 0; i < files.length; i += 100) jobs.push(Promise.resolve(sb.storage.from(BUCKET).remove(files.slice(i, i + 100))));
        // whatever is left (a closed tab, a failed request) is deleted the next time the console connects (lec_trash)
        return Promise.all(jobs).then(function () { return sweep(true); }, function () { return sweep(true); }).then(function () { return true; });
      });
    };
    return a;
  });
})(typeof window !== 'undefined' ? window : globalThis);
