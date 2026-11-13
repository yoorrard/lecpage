/*! lecpage live — provider 'sheets': Google Apps Script web app (backends/apps-script/Code.gs).
 * GET for public reads, POST with Content-Type text/plain (a "simple request": no CORS preflight, which
 * Apps Script cannot answer). No push channel: polls the snapshot every pollMs (default 7 s, 5–60 s),
 * backs off on errors and in hidden tabs. Writes are serialised on the server with LockService.
 * config: { url: 'https://script.google.com/macros/s/…/exec', code, pollMs? }
 */
(function (root) {
  'use strict';
  var L = root.LecLive;
  if (!L || !L.register) return;
  var U = L.util;

  L.register('sheets', function (config, ctx) {
    var code = U.normCode(config.code);
    var url = String(config.url || '').trim();
    var pollMs = Math.min(60000, Math.max(5000, Number(config.pollMs) || 7000));
    var maxUploadMb = Number(config.maxUploadMb) || 10;
    var handlers = [];
    var a = { status: 'offline' };
    var timers = {};
    var closed = true, pollErr = 0, emptyPolls = 0, rs = 0, epoch = null, every = pollMs;

    function emit(evt) { var r; handlers.forEach(function (h, i) { try { var x = h(evt); if (i === 0) r = x; } catch (e) { /* isolate */ } }); return r; }
    function setStatus(s, mode) { if (a.status === s) return; a.status = s; emit({ type: 'status', status: s, mode: mode }); }
    function clear(n) { if (timers[n]) { clearTimeout(timers[n]); timers[n] = null; } }

    function unwrap(p) {
      return p.then(function (res) {
        if (!res.ok) throw L.error('http_' + res.status, 'Apps Script 오류(' + res.status + ')', { status: res.status >= 500 ? 503 : res.status });
        return res.text();
      }, function () {
        throw L.error('network', '구글 시트 서버에 연결하지 못했어요.', { status: 0 });
      }).then(function (txt) {
        var j; try { j = JSON.parse(txt); } catch (e) { throw L.error('bad_response', '웹 앱 응답이 JSON이 아니에요. 배포 설정(액세스: 모든 사용자)을 확인해 주세요.', { status: 502, retryable: false }); }
        if (!j || !j.ok) throw L.error((j && j.error) || 'error', (j && j.message) || '오류', { status: (j && j.status) || 500, retryAfter: j && j.retryAfter });
        return j.data;
      });
    }
    function get(params) {
      var q = Object.keys(params).filter(function (k) { return params[k] != null; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
      return unwrap(fetch(url + (url.indexOf('?') >= 0 ? '&' : '?') + q, { method: 'GET', redirect: 'follow', cache: 'no-store', credentials: 'omit' }));
    }
    function post(body) {
      body.code = code;
      return unwrap(fetch(url, { method: 'POST', redirect: 'follow', credentials: 'omit', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }));
    }
    function writeDone(x) { schedulePoll(1500); return x; } // pick up other people's changes soon after mine

    // ---------------------------------------------------------------- polling
    function schedulePoll(ms) { if (closed) return; clear('poll'); timers.poll = setTimeout(pollOnce, ms); }
    function pollOnce() {
      timers.poll = null;
      if (closed) return;
      Promise.resolve(ctx.emit({ type: 'resync' })).then(function (r) {
        if (closed) return;
        if (r && r.error) { pollErr++; if (pollErr >= 3) setStatus('offline'); }
        else { if (pollErr || a.status !== 'polling') setStatus('polling', 'polling'); pollErr = 0; emptyPolls = r && r.changes ? 0 : emptyPolls + 1; }
        // 묻기 간격 규칙은 core의 pollDelay 한 곳(숨겨진 화면 1분, 바뀐 것 없이 이어지면 늘림). 예전 core에서는 그대로
        var ms = U.pollDelay ? U.pollDelay(pollMs, { err: pollErr, empty: emptyPolls, admin: !!ctx.adminKey() }) : pollErr ? Math.min(60000, pollMs * Math.pow(2, pollErr)) : U.isHidden() ? Math.max(30000, pollMs * 3) : emptyPolls > 8 ? Math.min(pollMs + 3000, 10000) : pollMs;
        every = ms;
        schedulePoll(U.jitter(ms, 0.2));
      });
    }
    function onVisible() { if (!closed && !U.isHidden()) schedulePoll(100); }

    // ---------------------------------------------------------------- adapter API (contract §5)
    a.subscribe = function (h) { handlers.push(h); return function () { handlers = handlers.filter(function (x) { return x !== h; }); }; };
    a.connect = function () {
      closed = false;
      if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url) && !config.allowAnyUrl) return Promise.reject(L.error('config', 'Apps Script 웹 앱 주소(https://script.google.com/…/exec)가 필요해요.', { status: 400, retryable: false }));
      setStatus('connecting');
      return get({ a: 'ping' }).then(function () {
        if (root.document && !a._hooked) { a._hooked = true; root.document.addEventListener('visibilitychange', onVisible); }
        setStatus('polling', 'polling');
        schedulePoll(pollMs);
        return { mode: 'polling' };
      }, function (e) { setStatus('offline'); throw e; });
    };
    a.close = function () { closed = true; Object.keys(timers).forEach(clear); setStatus('offline'); };
    a.netInfo = function () { return { transport: 'poll', every: every }; };
    a.join = function (p) { return post({ a: 'join', nickname: p.nickname || '', name: p.name || '', school: p.school || '', consent: !!p.consent }); };
    a.snapshot = function (o) {
      var since = (o && o.since) || 0;
      var job = ctx.adminKey() || ctx.token()
        ? post({ a: 'snapshot', since: since, rs: rs, token: ctx.token() || undefined, admin: ctx.adminKey() || undefined })
        : get({ a: 'snapshot', code: code, since: since, rs: rs });
      return job.then(function (s) {
        if (s && s.reactions && rs) s.reactions.forEach(function (r) { emit({ type: 'reaction', doc: { emoji: r.emoji, count: r.count } }); });
        if (s && s.reactionsAt) rs = s.reactionsAt;
        if (s && s.epoch != null) {
          // the sheet was wiped (purge): forget everything and reload
          if (epoch !== null && s.epoch !== epoch) { epoch = s.epoch; setTimeout(function () { ctx.emit({ type: 'reset' }); }, 0); }
          epoch = s.epoch;
        }
        return s;
      });
    };
    a.list = function (col, o) { return a.snapshot({ since: (o && o.since) || 0 }).then(function (s) { return (s && s[col]) || []; }); };
    a.add = function (col, doc) { return post({ a: 'add', col: col, doc: doc, token: ctx.token(), admin: col === 'polls' ? ctx.adminKey() : undefined }).then(writeDone); };
    a.update = function (col, id, patch) { return post({ a: 'update', col: col, id: id, patch: patch, token: ctx.token(), admin: ctx.adminKey() || undefined }).then(writeDone); };
    a.remove = function (col, id) { return post({ a: 'remove', col: col, id: id, admin: ctx.adminKey() }).then(function () { return true; }); };
    a.vote = function (id) { return post({ a: 'vote', id: id, token: ctx.token() }); };
    a.like = function (id) { return post({ a: 'like', id: id, token: ctx.token() }); };
    a.getState = function () { return get({ a: 'state', code: code }); };
    a.setState = function (patch) { return post({ a: 'setState', patch: patch, admin: ctx.adminKey() }); };
    a.react = function (emoji) { return post({ a: 'react', emoji: emoji, token: ctx.token() }).then(function () { return true; }); };
    a.upload = function (file) {
      if (file.size > maxUploadMb * 1048576) return Promise.reject(L.error('too_large', '구글 시트 방식은 ' + maxUploadMb + 'MB까지 올릴 수 있어요.', { status: 413, retryable: false }));
      return new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function () { resolve(String(fr.result).split(',')[1] || ''); };
        fr.onerror = function () { reject(L.error('read_failed', '파일을 읽지 못했어요.', { status: 400, retryable: false })); };
        fr.readAsDataURL(file);
      }).then(function (b64) { return post({ a: 'upload', name: file.name || 'file', type: file.type, data: b64, token: ctx.token() }); });
    };
    a.checkAdmin = function () { return post({ a: 'checkAdmin', admin: ctx.adminKey() || '' }).then(function (ok) { return ok === true; }); };
    a.exportCsv = function (kind, opts) {
      // 'completion' needs the course times, which the sheet does not know: build it from the admin snapshot here
      if (kind === 'completion') return post({ a: 'snapshot', since: 0, admin: ctx.adminKey() }).then(function (s) { var t = U.exportTable(kind, s || {}, undefined, opts); return U.toCsv(t.columns, t.rows); });
      return post({ a: 'export', kind: kind, admin: ctx.adminKey() });
    };
    a.purge = function () { return post({ a: 'purge', admin: ctx.adminKey() }).then(function () { return true; }); };
    return a;
  });
})(typeof window !== 'undefined' ? window : globalThis);
