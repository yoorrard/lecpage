/*! lecpage live — provider 'local': no server. Tabs of one browser sync through BroadcastChannel
 * (or `storage` events where BroadcastChannel is missing) and localStorage. For previews, demos and rehearsal.
 * Admin actions are always allowed here (single device). Data stays in this browser only.
 */
(function (root) {
  'use strict';
  var L = root.LecLive;
  if (!L || !L.register) return;
  var U = L.util;
  var PUBLIC = L.publicCols;

  L.register('local', function (config, ctx) {
    var code = U.normCode(config.code || 'DEMO');
    var P = 'lecLive:local:' + code + ':';
    var ls = U.storage.local;
    var tabId = U.uid(8);
    var handlers = [];
    var chan = null;
    var adapter = { status: 'offline' };

    function emit(evt) { handlers.forEach(function (h) { try { h(evt); } catch (e) { /* isolate */ } }); }
    function err(code, msg, status) { return L.error(code, msg, { status: status || 400, retryable: false }); }
    function stamp() {
      var last = ls.get(P + 'stamp') || 0;
      var t = Math.max(Date.now(), last + 1);
      ls.set(P + 'stamp', t);
      return t;
    }
    function key(col, id) { return P + 'd:' + col + ':' + id; }
    function readCol(col) {
      return ls.keys(P + 'd:' + col + ':').map(function (k) { return ls.get(k); }).filter(Boolean);
    }
    function outDoc(col, d) {
      if (!d) return d;
      var o = U.clone(d);
      if (col === 'questions') delete o.by;
      delete o._token;
      return o;
    }
    function broadcast(evt) {
      var msg = { src: tabId, evt: evt };
      if (chan) { try { chan.postMessage(msg); } catch (e) { /* ignore */ } }
      else ls.set(P + 'evt', { n: U.uid(6), m: msg });
      emit(evt);
    }
    function onRemote(msg) {
      if (!msg || msg.src === tabId || !msg.evt) return;
      emit(msg.evt);
    }
    function me() {
      var t = ctx.token();
      var id = t ? ls.get(P + 't:' + t) : null;
      var p = id ? ls.get(key('participants', id)) : null;
      if (!p) throw L.error('invalid_token', '참여 정보가 없어요. 다시 참여해 주세요.', { status: 401, retryable: false });
      return p;
    }
    function save(col, doc, type) {
      ls.set(key(col, doc.id), doc);
      ls.del(P + 'tomb:' + col + ':' + doc.id);
      broadcast({ type: type, col: col, doc: outDoc(col, doc) });
      return outDoc(col, doc);
    }

    adapter.subscribe = function (h) { handlers.push(h); return function () { handlers = handlers.filter(function (x) { return x !== h; }); }; };
    adapter.connect = function () {
      if (!chan && typeof root.BroadcastChannel === 'function') {
        try { chan = new root.BroadcastChannel('lecLive:local:' + code); chan.onmessage = function (e) { onRemote(e.data); }; } catch (e) { chan = null; }
      }
      if (!chan && root.addEventListener && !adapter._storageHooked) {
        adapter._storageHooked = true;
        root.addEventListener('storage', function (e) {
          if (e.key !== P + 'evt' || !e.newValue) return;
          try { onRemote(JSON.parse(e.newValue).m); } catch (x) { /* ignore */ }
        });
      }
      adapter.status = 'live';
      emit({ type: 'status', status: 'live', mode: 'local' });
      return Promise.resolve({ mode: 'local' });
    };
    adapter.close = function () { if (chan) { try { chan.close(); } catch (e) { /* ignore */ } chan = null; } adapter.status = 'offline'; };
    adapter.join = function (p) {
      var now = stamp(); var id = 'p' + U.uid(12); var token = U.uid(16) + U.uid(16);
      var doc = { id: id, nickname: p.nickname || '참가자', name: p.name || '', school: p.school || '', consentAt: p.consent ? now : null, createdAt: now, updatedAt: now };
      if ((doc.name || doc.school) && !p.consent) return Promise.reject(err('consent_required', '이름·소속을 남기려면 개인정보 수집·이용에 동의해 주세요.'));
      if ((adapter._state().ui || {}).lockJoin === true) return Promise.reject(err('locked', '지금은 새로 참여할 수 없어요. 강사에게 알려 주세요.', 409));
      ls.set(P + 't:' + token, id);
      save('participants', doc, 'add');
      return Promise.resolve({ id: id, token: token, nickname: doc.nickname });
    };
    adapter.snapshot = function (opts) {
      var since = (opts && opts.since) || 0;
      var now = ls.get(P + 'stamp') || 0;
      var out = { state: adapter._state(), now: now, time: Date.now(), since: since, full: !since, removed: [] };
      var cols = opts && opts.admin ? L.cols : PUBLIC;
      cols.forEach(function (c) { out[c] = readCol(c).filter(function (d) { return d.updatedAt > since; }).map(function (d) { return outDoc(c, d); }); });
      if (!(opts && opts.admin)) {
        var mine = null; try { mine = me().id; } catch (e) { /* not joined */ }
        if (mine) ['attendance', 'survey'].forEach(function (c) { out[c] = readCol(c).filter(function (d) { return d.by === mine && d.updatedAt > since; }); });
      }
      if (since) out.removed = ls.keys(P + 'tomb:').map(function (k) { var t = ls.get(k); return t && t.at > since ? { col: t.col, id: t.id } : null; }).filter(Boolean);
      return Promise.resolve(out);
    };
    adapter.list = function (col, opts) {
      var since = (opts && opts.since) || 0;
      return Promise.resolve(readCol(col).filter(function (d) { return d.updatedAt > since; }).map(function (d) { return outDoc(col, d); }));
    };
    adapter._state = function () { return U.assign(U.defaultState(), ls.get(P + 'state') || {}); };
    adapter.getState = function () { return Promise.resolve(adapter._state()); };
    adapter.setState = function (patch) {
      var cur = adapter._state();
      var next = U.assign({}, cur, patch || {});
      if (patch && patch.ui) next.ui = U.assign({}, cur.ui || {}, patch.ui);
      next.updatedAt = stamp();
      ls.set(P + 'state', next);
      broadcast({ type: 'state', doc: next });
      return Promise.resolve(next);
    };
    adapter.add = function (col, doc) {
      return Promise.resolve().then(function () {
        if (L.cols.indexOf(col) < 0 || col === 'participants') throw err('unknown_collection', '없는 컬렉션이에요.', 404);
        var p = col === 'polls' ? null : me();
        var by = p ? p.id : null;
        // 리허설도 실제 서버와 같은 규칙: 강사가 잠근 칸, 닫힌 투표
        var ui = adapter._state().ui || {};
        if ((col === 'questions' && ui.lockQa === true) || (col === 'posts' && ui.lockBoard === true)) throw err('locked', col === 'questions' ? '지금은 질문을 받지 않아요. 강사가 다시 열면 보낼 수 있어요.' : '지금은 보드에 글을 받지 않아요. 강사가 다시 열면 올릴 수 있어요.', 409);
        if (col === 'answers') { var pl = ls.get(key('polls', doc.poll)); if (pl && pl.open === false) throw err('poll_closed', '투표가 닫혔어요.', 409); }
        if (doc.cid) {
          var dup = readCol(col).filter(function (d) { return d.cid === doc.cid && d.by === by; })[0];
          if (dup) return outDoc(col, dup);
        }
        var now = stamp();
        var d = U.assign({}, doc, { createdAt: now, updatedAt: now });
        if (by) d.by = by;
        var match = null;
        if (col === 'progress') { d.at = now; match = function (x) { return x.by === by && x.station === d.station; }; }
        if (col === 'attendance') { d.at = now; match = function (x) { return x.by === by && x.kind === d.kind; }; }
        if (col === 'answers') match = function (x) { return x.by === by && x.poll === d.poll; };
        if (col === 'survey') match = function (x) { return x.by === by; };
        if (col === 'questions') U.assign(d, { anonymous: d.anonymous !== false, votes: 0, status: 'open', pinned: false, nickname: d.anonymous === false ? p.nickname : '' });
        if (col === 'posts') U.assign(d, { likes: 0, hidden: !!(config.moderation || (adapter._state().ui || {}).moderation), nickname: p.nickname, files: d.files || [] });
        if (col === 'chat') U.assign(d, { nickname: p.nickname, hidden: false });
        if (col === 'help') U.assign(d, { nickname: p.nickname, status: 'open', assignee: '' });
        if (col === 'polls') d.open = !!d.open;
        var old = match ? readCol(col).filter(match)[0] : null;
        if (old && col === 'attendance' && old.at) d.at = d.kind === 'in' ? Math.min(old.at, d.at) : Math.max(old.at, d.at); // the first check-in stays
        if (old) { d = U.assign({}, old, d, { id: old.id, createdAt: old.createdAt }); return save(col, d, 'update'); }
        d.id = col.charAt(0) + U.uid(12);
        return save(col, d, 'add');
      });
    };
    adapter.update = function (col, id, patch) {
      return Promise.resolve().then(function () {
        var cur = ls.get(key(col, id));
        if (!cur) throw err('not_found', '지워진 글이에요. 새로 고침해 주세요.', 404);
        var next = U.assign({}, cur, patch || {}, { id: id, updatedAt: stamp() });
        if (col === 'participants' && patch && patch.consent === true && !cur.consentAt) next.consentAt = next.updatedAt;
        delete next.consent;
        return save(col, next, 'update');
      });
    };
    adapter.remove = function (col, id) {
      ls.del(key(col, id));
      ls.set(P + 'tomb:' + col + ':' + id, { col: col, id: id, at: stamp() });
      ls.keys(P + 'v:' + col + ':' + id + ':').forEach(function (k) { ls.del(k); });
      broadcast({ type: 'remove', col: col, doc: { id: id } });
      return Promise.resolve(true);
    };
    function vote(col, id, field) {
      return Promise.resolve().then(function () {
        var p = me();
        var cur = ls.get(key(col, id));
        if (!cur) throw err('not_found', '지워진 글이에요. 새로 고침해 주세요.', 404);
        var vk = P + 'v:' + col + ':' + id + ':' + p.id;
        if (ls.get(vk)) { var r0 = {}; r0[field] = cur[field] || 0; r0.already = true; return r0; }
        ls.set(vk, 1);
        var n = ls.keys(P + 'v:' + col + ':' + id + ':').length;
        var next = U.assign({}, cur); next[field] = n; next.updatedAt = stamp();
        save(col, next, 'update');
        var r = {}; r[field] = n; r.voted = true; return r;
      });
    }
    adapter.vote = function (id) { return vote('questions', id, 'votes'); };
    adapter.like = function (id) { return vote('posts', id, 'likes'); };
    adapter.react = function (emoji) { broadcast({ type: 'reaction', doc: { emoji: emoji, count: 1 } }); return Promise.resolve(true); };
    adapter.upload = function (file) {
      return new Promise(function (resolve, reject) {
        var meta = { name: file.name || 'file', type: file.type || 'application/octet-stream', size: file.size };
        if (file.size <= 300 * 1024 && root.FileReader) {
          var fr = new FileReader();
          fr.onload = function () { resolve(U.assign(meta, { url: String(fr.result) })); };
          fr.onerror = function () { reject(err('read_failed', '파일을 읽지 못했어요.')); };
          fr.readAsDataURL(file);
        } else if (root.URL && URL.createObjectURL) {
          resolve(U.assign(meta, { url: URL.createObjectURL(file), localOnly: true }));
        } else reject(err('unsupported', '이 브라우저는 미리보기 파일을 지원하지 않아요.', 501));
      });
    };
    adapter.checkAdmin = function () { return Promise.resolve(true); };
    adapter.exportCsv = function (kind, opts) {
      var data = {}; L.cols.forEach(function (c) { data[c] = readCol(c).sort(function (a, b) { return a.createdAt - b.createdAt; }); });
      var t = U.exportTable(kind, data, undefined, opts);
      return Promise.resolve(U.toCsv(t.columns, t.rows));
    };
    adapter.purge = function () {
      ls.keys(P).forEach(function (k) { ls.del(k); });
      broadcast({ type: 'reset' });
      return Promise.resolve(true);
    };
    return adapter;
  });
})(typeof window !== 'undefined' ? window : globalThis);
