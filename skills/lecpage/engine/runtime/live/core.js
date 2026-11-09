/*! lecpage live core — window.LecLive (classic script, no modules, works from file://)
 * Contract: docs/architecture.md §5. Providers register with LecLive.register(name, factory).
 *   var live = LecLive.create(config);  // config = blueprint.live (+ adminKey)
 *   live.connect().then(function (info) { ... });
 *   live.onChange('questions', function (docs) { render(docs); });   // render with textContent only
 * The client wraps an adapter with: retries, status events, identity persistence, offline write queue,
 * dedupe, an in-memory store per collection (merge by id, `since` cursors), text limits and profanity masking.
 */
(function (root) {
  'use strict';
  if (root.LecLive && root.LecLive.__core) return;

  var VERSION = '1.0.0';
  var COLS = ['participants', 'attendance', 'progress', 'help', 'questions', 'posts', 'polls', 'answers', 'survey', 'chat'];
  var PUBLIC_COLS = ['questions', 'posts', 'help', 'progress', 'polls', 'answers', 'chat'];
  var PRIVATE_COLS = ['participants', 'attendance', 'survey'];
  var LIMITS = {
    nickname: 20, name: 40, school: 60, question: 500, post: 1000, chat: 300, help: 300, seat: 20, id: 64, kind: 32,
    pollQuestion: 200, option: 100, answer: 200, notice: 300, timerLabel: 40, fileName: 120, files: 5, license: 40,
    assignee: 20, uploadMb: 20,
  };
  // col → field → [limit, multiline, mask]
  var FIELDS = {
    participants: { nickname: [LIMITS.nickname, 0, 1], name: [LIMITS.name, 0, 0], school: [LIMITS.school, 0, 0] },
    questions: { text: [LIMITS.question, 1, 1] },
    posts: { text: [LIMITS.post, 1, 1], kind: [LIMITS.kind, 0, 0], license: [LIMITS.license, 0, 0] },
    chat: { text: [LIMITS.chat, 1, 1] },
    help: { message: [LIMITS.help, 1, 1], seat: [LIMITS.seat, 0, 0], station: [LIMITS.id, 0, 0], assignee: [LIMITS.assignee, 0, 1] },
    polls: { question: [LIMITS.pollQuestion, 0, 0] },
    answers: { value: [LIMITS.answer, 0, 1], poll: [LIMITS.id, 0, 0] },
    progress: { station: [LIMITS.id, 0, 0] },
  };
  var UPLOAD_TYPES = { 'image/png': 1, 'image/jpeg': 1, 'image/gif': 1, 'image/webp': 1, 'application/pdf': 1, 'audio/mpeg': 1, 'video/mp4': 1 };
  var EMOJIS = ['👍', '❤️', '👏', '🎉', '😂', '😮', '🤔', '🙏', '🔥', '💯', '🙌', '😢', '✅', '❓', '💡'];

  // ---------------------------------------------------------------- storage (never throws)
  function store(kind) {
    var s = null;
    try { s = kind === 'session' ? root.sessionStorage : root.localStorage; if (s) { s.setItem('__lec', '1'); s.removeItem('__lec'); } } catch (e) { s = null; }
    var mem = {};
    return {
      get: function (k) { try { if (s) { var v = s.getItem(k); return v == null ? null : JSON.parse(v); } } catch (e) { /* ignore */ } return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      set: function (k, v) { mem[k] = v; try { if (s) s.setItem(k, JSON.stringify(v)); } catch (e) { /* quota or blocked */ } },
      del: function (k) { delete mem[k]; try { if (s) s.removeItem(k); } catch (e) { /* ignore */ } },
      keys: function (prefix) { var out = []; try { if (s) for (var i = 0; i < s.length; i++) { var k = s.key(i); if (k && k.indexOf(prefix) === 0) out.push(k); } } catch (e) { /* ignore */ } if (!s) for (var m in mem) if (m.indexOf(prefix) === 0) out.push(m); return out; },
      persistent: !!s,
    };
  }
  var local = store('local');
  var session = store('session');

  // ---------------------------------------------------------------- small utils
  function uid(n) {
    n = n || 16; var a = new Uint8Array(n); var c = root.crypto || root.msCrypto;
    if (c && c.getRandomValues) c.getRandomValues(a); else for (var i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
    var s = ''; for (var j = 0; j < a.length; j++) s += ('0' + a[j].toString(16)).slice(-2);
    return s.slice(0, n);
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function jitter(ms, f) { f = f == null ? 0.3 : f; return Math.round(ms * (1 - f + Math.random() * 2 * f)); }
  function backoff(attempt, base, max) { return jitter(Math.min(max || 30000, (base || 1000) * Math.pow(2, attempt))); }
  function assign(t) { for (var i = 1; i < arguments.length; i++) { var s = arguments[i]; if (s) for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k]; } return t; }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function same(a, b) { try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; } }
  function cps(s) { return Array.from ? Array.from(s) : s.split(''); }
  function hashStr(s) { var h = 5381; s = String(s || ''); for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function normCode(c) { return String(c || '').trim().toUpperCase(); }
  function isHidden() { try { return root.document && root.document.visibilityState === 'hidden'; } catch (e) { return false; } }

  /** Emitter with error isolation. */
  function Emitter() { this._l = {}; }
  Emitter.prototype.on = function (e, cb) { var l = this._l[e] || (this._l[e] = []); l.push(cb); var self = this; return function () { self.off(e, cb); }; };
  Emitter.prototype.off = function (e, cb) { var l = this._l[e]; if (!l) return; var i = l.indexOf(cb); if (i >= 0) l.splice(i, 1); };
  Emitter.prototype.emit = function (e) {
    var l = this._l[e]; if (!l || !l.length) return;
    var args = Array.prototype.slice.call(arguments, 1);
    l.slice().forEach(function (cb) { try { cb.apply(null, args); } catch (err) { if (root.console) console.error('[LecLive]', err); } });
  };

  /** Error type thrown by adapters and the client. */
  function LiveError(code, message, opts) {
    var e = new Error(message || code);
    e.name = 'LiveError'; e.code = code || 'error';
    opts = opts || {};
    e.status = opts.status || 0;
    e.retryable = opts.retryable != null ? !!opts.retryable : (!e.status || e.status >= 500 || e.status === 429 || e.status === 408);
    if (opts.retryAfter) e.retryAfter = opts.retryAfter;
    if (opts.detail) e.detail = opts.detail;
    return e;
  }

  // ---------------------------------------------------------------- sha256 (Web Crypto if possible, small JS fallback for file://)
  function utf8(s) { if (root.TextEncoder) return new TextEncoder().encode(s); var b = unescape(encodeURIComponent(s)); var a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function hex(buf) { var a = new Uint8Array(buf); var s = ''; for (var i = 0; i < a.length; i++) s += ('0' + a[i].toString(16)).slice(-2); return s; }
  var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function sha256js(bytes) {
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var l = bytes.length; var n = ((l + 9 + 63) >> 6) << 6; var m = new Uint8Array(n); m.set(bytes); m[l] = 0x80;
    var bits = l * 8; m[n - 4] = (bits >>> 24) & 255; m[n - 3] = (bits >>> 16) & 255; m[n - 2] = (bits >>> 8) & 255; m[n - 1] = bits & 255;
    m[n - 5] = Math.floor(bits / 4294967296) & 255;
    var w = new Array(64);
    for (var o = 0; o < n; o += 64) {
      for (var i = 0; i < 16; i++) w[i] = (m[o + i * 4] << 24) | (m[o + i * 4 + 1] << 16) | (m[o + i * 4 + 2] << 8) | m[o + i * 4 + 3];
      for (i = 16; i < 64; i++) {
        var x = w[i - 15], y = w[i - 2];
        var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        var s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = ''; for (i = 0; i < 8; i++) out += ('0000000' + (H[i] >>> 0).toString(16)).slice(-8);
    return out;
  }
  function sha256(text) {
    var bytes = utf8(String(text));
    var c = root.crypto;
    if (c && c.subtle && root.isSecureContext !== false) {
      return c.subtle.digest('SHA-256', bytes).then(hex, function () { return sha256js(bytes); });
    }
    return Promise.resolve(sha256js(bytes));
  }

  // ---------------------------------------------------------------- script loader (never rejects: resolves false)
  var loading = {};
  function loadScript(url, timeoutMs) {
    if (loading[url]) return loading[url];
    loading[url] = new Promise(function (resolve) {
      if (!root.document) return resolve(false);
      var s = root.document.createElement('script');
      var done = false;
      var t = setTimeout(function () { finish(false); }, timeoutMs || 12000);
      function finish(ok) { if (done) return; done = true; clearTimeout(t); if (!ok) delete loading[url]; resolve(ok); }
      s.src = url; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = function () { finish(true); };
      s.onerror = function () { finish(false); };
      (root.document.head || root.document.documentElement).appendChild(s);
    });
    return loading[url];
  }

  // ---------------------------------------------------------------- text cleanup & profanity masking
  var CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​‌‎‏‪-‮⁦-⁩﻿]/g;
  function cleanText(v, max, multiline) {
    if (v == null) return '';
    var s = String(v).replace(/\r\n?/g, '\n');
    if (s.normalize) s = s.normalize('NFC');
    s = s.replace(CTRL, '');
    if (!multiline) s = s.replace(/\s+/g, ' ');
    else s = s.replace(/\n{4,}/g, '\n\n\n');
    s = s.trim();
    var c = cps(s);
    if (max && c.length > max) s = c.slice(0, max).join('').trim();
    return s;
  }
  var DEFAULT_WORDS = [
    '씨발', '씨바', '씨빨', '씨팔', '시발', '시바', '시팔', 'ㅅㅂ', 'ㅆㅂ', 'ㅆㅃ', 'ㅄ', '병신', '븅신', '빙신', 'ㅂㅅ', '개새끼', '개새기', '개색기', '개색끼', '개쉐이',
    '좆', '좇같', '존나', 'ㅈㄴ', '지랄', 'ㅈㄹ', '미친놈', '미친년', '미친새끼', '닥쳐', '꺼져', '썅', '엿먹어', '느금마', '니애미', '니애비', '애미뒤', '염병', '찐따',
    'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bullshit', 'bitch', 'asshole', 'bastard', 'cunt', 'dickhead', 'retard', 'slut', 'whore', 'nigger', 'faggot',
  ];
  var DEFAULT_ALLOW = ['시발점', '시발역', '시발택시', '시바견', '시바이누', '시바 견'];
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function makeMasker(cfg) {
    if (cfg === false) return function (s) { return s; };
    cfg = cfg && typeof cfg === 'object' ? cfg : {};
    var words = (cfg.words || DEFAULT_WORDS).concat(cfg.extra || []).filter(Boolean);
    var allow = (cfg.allow || DEFAULT_ALLOW).filter(Boolean);
    if (!words.length) return function (s) { return s; };
    var sep = '[\\s._\\-*~!^0-9]{0,2}';
    var parts = words.map(function (w) {
      var ascii = /^[a-z]+$/i.test(w);
      if (ascii) return '\\b' + escRe(w) + '\\w*';
      return cps(w).map(escRe).join(sep);
    });
    parts.sort(function (a, b) { return b.length - a.length; });
    var re = new RegExp('(' + parts.join('|') + ')', 'gi');
    var allowRe = allow.length ? new RegExp(allow.map(escRe).join('|'), 'g') : null;
    return function (s) {
      if (!s || typeof s !== 'string') return s;
      var saved = [];
      var t = allowRe ? s.replace(allowRe, function (m) { saved.push(m); return '\u0001' + (saved.length - 1) + '\u0002'; }) : s;
      t = t.replace(re, function (m) { return cps(m).map(function (ch) { return /\s/.test(ch) ? ch : '*'; }).join(''); });
      if (saved.length) t = t.replace(/\u0001(\d+)\u0002/g, function (_, i) { return saved[+i]; });
      return t;
    };
  }

  // ---------------------------------------------------------------- CSV & export tables (same layout as the servers)
  function csvCell(v) {
    if (v == null) return '';
    var s = Array.isArray(v) ? v.join(' / ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function toCsv(columns, rows) {
    return '﻿' + [columns].concat(rows).map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }
  function fmtTime(ms, tz) {
    if (!ms) return '';
    try {
      return new Intl.DateTimeFormat('sv-SE', { timeZone: tz || 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(ms));
    } catch (e) { return new Date(ms).toISOString(); }
  }
  var STATUS_KO = { doing: '하는 중', done: '완료', stuck: '막힘', open: '대기', claimed: '가는 중', answered: '답변함', hidden: '숨김' };
  function uniq(a) { var s = {}; var o = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }
  function exportTable(kind, data, tz, opts) {
    var t = function (ms) { return fmtTime(ms, tz); };
    if (kind === 'completion') return completionTable(data, opts, tz);
    var P = data.participants || []; var people = {}; P.forEach(function (p) { people[p.id] = p; });
    var nick = function (id) { return (people[id] || {}).nickname || ''; };
    switch (kind) {
      case 'participants': return { columns: ['별명', '이름', '소속', '참여 시각', '동의 시각'], rows: P.map(function (p) { return [p.nickname, p.name, p.school, t(p.createdAt), t(p.consentAt)]; }) };
      case 'attendance': {
        var m = {}; (data.attendance || []).forEach(function (a) { var r = m[a.by] || (m[a.by] = {}); r[a.kind] = a.at || a.createdAt; });
        return { columns: ['별명', '이름', '소속', '입실', '퇴실', '동의 시각'], rows: P.map(function (p) { var r = m[p.id] || {}; return [p.nickname, p.name, p.school, t(r['in']), t(r.out), t(p.consentAt)]; }) };
      }
      case 'progress': {
        var pr = data.progress || []; var st = uniq(pr.map(function (x) { return x.station; })); var mm = {}; var order = [];
        pr.forEach(function (x) { if (!mm[x.by]) { mm[x.by] = {}; order.push(x.by); } mm[x.by][x.station] = x.status; });
        return { columns: ['별명', '이름'].concat(st, ['완료 수']), rows: order.map(function (by) { var r = mm[by]; return [nick(by), (people[by] || {}).name].concat(st.map(function (s) { return STATUS_KO[r[s]] || ''; }), [st.filter(function (s) { return r[s] === 'done'; }).length]); }) };
      }
      case 'questions': return { columns: ['작성 시각', '질문', '작성자', '공감', '상태', '고정'], rows: (data.questions || []).map(function (q) { return [t(q.createdAt), q.text, q.anonymous ? '익명' : q.nickname, q.votes, STATUS_KO[q.status] || q.status, q.pinned ? '예' : '']; }) };
      case 'survey': {
        var sv = data.survey || []; var keys = uniq([].concat.apply([], sv.map(function (s) { return Object.keys(s.answers || {}); })));
        return { columns: ['별명', '이름', '소속', '제출 시각'].concat(keys), rows: sv.map(function (s) { var p = people[s.by] || {}; return [p.nickname, p.name, p.school, t(s.updatedAt)].concat(keys.map(function (k) { return (s.answers || {})[k]; })); }) };
      }
      case 'posts': return { columns: ['작성 시각', '종류', '내용', '별명', '파일', '좋아요', '숨김'], rows: (data.posts || []).map(function (x) { return [t(x.createdAt), x.kind, x.text, x.nickname, (x.files || []).map(function (f) { return f.url; }), x.likes, x.hidden ? '예' : '']; }) };
      case 'help': return { columns: ['요청 시각', '별명', '활동', '자리', '내용', '상태', '담당'], rows: (data.help || []).map(function (x) { return [t(x.createdAt), x.nickname, x.station, x.seat, x.message, STATUS_KO[x.status] || x.status, x.assignee]; }) };
      case 'chat': return { columns: ['시각', '별명', '내용', '숨김'], rows: (data.chat || []).map(function (x) { return [t(x.createdAt), x.nickname, x.text, x.hidden ? '예' : '']; }) };
      case 'answers': return { columns: ['투표', '별명', '응답', '시각'], rows: (data.answers || []).map(function (x) { return [x.poll, nick(x.by), x.value, t(x.updatedAt)]; }) };
      default: throw LiveError('bad_kind', '내보낼 수 없는 종류입니다: ' + kind, { status: 400 });
    }
  }

  // ---------------------------------------------------------------- completion (이수 확인) — same rule as protocol.js
  // opts: { date:'YYYY-MM-DD', start:'HH:MM', end:'HH:MM', rate: 0~100, survey: bool (site has survey questions), stations: n }
  function tzOffset(ms, tz) {
    try {
      var p = {}; new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        .formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = +x.value; });
      return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
    } catch (e) { return 9 * 3600000; }
  }
  /** Wall-clock date + 'HH:MM' in a time zone → epoch ms (null when malformed). */
  function zonedMs(date, hm, tz) {
    var d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || ''), h = /^(\d{1,2}):(\d{2})$/.exec(hm || '');
    if (!d || !h) return null;
    var guess = Date.UTC(+d[1], +d[2] - 1, +d[3], +h[1], +h[2]);
    var off = tzOffset(guess, tz || 'Asia/Seoul'), ms = guess - off, off2 = tzOffset(ms, tz || 'Asia/Seoul');
    return off2 === off ? ms : guess - off2;
  }
  function dayOf(ms, tz) { return fmtTime(ms, tz).slice(0, 10); }
  var COMPLETION_COLS = ['별명', '이름', '소속', '입실', '퇴실', '머문 시간(분)', '실습 완료(n/전체)', '설문 제출', '이수'];
  function completionTable(data, opts, tz) {
    opts = opts || {}; tz = tz || 'Asia/Seoul';
    var rate = typeof opts.rate === 'number' && opts.rate >= 0 && opts.rate <= 100 ? opts.rate : 90;
    var att = {}, done = {}, sv = {}, seen = {}, stations = [];
    (data.attendance || []).forEach(function (a) { var r = att[a.by] || (att[a.by] = {}); var at = a.at || a.createdAt; if (a.kind === 'in' || a.kind === 'out') r[a.kind] = at; });
    (data.progress || []).forEach(function (x) { if (!seen[x.station]) { seen[x.station] = 1; stations.push(x.station); } if (x.status === 'done') (done[x.by] || (done[x.by] = {}))[x.station] = 1; });
    (data.survey || []).forEach(function (s) { if (s.by) sv[s.by] = 1; });
    var total = opts.stations > 0 ? Math.floor(opts.stations) : stations.length;
    var rows = (data.participants || []).slice().sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); }).map(function (p) {
      var r = att[p.id] || {}, inAt = r['in'], outAt = r.out;
      var day = opts.date || (inAt ? dayOf(inAt, tz) : '');
      var s0 = zonedMs(day, opts.start, tz), s1 = zonedMs(day, opts.end, tz);
      var sched = s0 != null && s1 != null && s1 > s0 ? s1 - s0 : 0;
      var mins = '';
      if (inAt && outAt && outAt >= inAt) mins = Math.max(0, Math.round((Math.min(outAt, sched ? s1 : outAt) - Math.max(inAt, sched ? s0 : inAt)) / 60000));
      var n = Object.keys(done[p.id] || {}).length;
      var verdict = '확인 필요';
      if (mins !== '' && sched) verdict = mins >= Math.ceil(sched / 60000 * rate / 100) && (!opts.survey || sv[p.id]) ? 'O' : 'X';
      return [p.nickname, p.name, p.school, fmtTime(inAt, tz), fmtTime(outAt, tz), mins, total ? Math.min(n, total) + ' / ' + total : '해당 없음', opts.survey ? (sv[p.id] ? 'O' : 'X') : '해당 없음', verdict];
    });
    return { columns: COMPLETION_COLS.slice(), rows: rows };
  }

  // ---------------------------------------------------------------- word cloud cleaning
  var PARTICLES = '은는이가을를의에도요';
  var KEEP_WORDS = ['고양이', '어린이', '호랑이', '원숭이', '지렁이', '올챙이', '두꺼비'];
  var BANNED = DEFAULT_BANNED();
  function DEFAULT_BANNED() {
    return ['바보', '멍청이', '등신', '쓰레기', '죽어', '죽을래', '한남', '한녀', '틀딱', '맘충', '급식충', '김치녀', '섹스', 'sex', 'porn', '야동'];
  }
  /** NFC, trim, lowercase latin, strip edge punctuation and one trailing particle (when ≥2 chars remain). */
  function normWord(v) {
    if (v == null) return '';
    var s = String(v); if (s.normalize) s = s.normalize('NFC');
    s = s.replace(CTRL, '').replace(/\s+/g, ' ').trim().toLowerCase();
    s = s.replace(/^[\s.,!?~…·'"“”‘’()\[\]{}<>:;-]+|[\s.,!?~…·'"“”‘’()\[\]{}<>:;-]+$/g, '');
    var c = cps(s);
    if (c.length >= 3 && PARTICLES.indexOf(c[c.length - 1]) >= 0 && KEEP_WORDS.indexOf(s) < 0) s = c.slice(0, -1).join('').trim();
    return s;
  }
  function makeBanned(extra) {
    var list = BANNED.concat(DEFAULT_WORDS, extra || []).map(normWord).filter(Boolean);
    return function (w) {
      if (!w || /^[*\s]+$/.test(w) || w.indexOf('**') >= 0) return true;
      for (var i = 0; i < list.length; i++) if (w.indexOf(list[i]) >= 0) return true;
      return false;
    };
  }
  /** answers[] of one poll → [{word, count}] merged by normWord, minus hidden and banned words, most first. */
  function wordCloud(answers, pollId, opts) {
    opts = opts || {};
    var hidden = {}; (opts.hidden || []).forEach(function (w) { hidden[normWord(w)] = 1; });
    var banned = makeBanned(opts.banned);
    var tally = {}, order = [];
    (answers || []).forEach(function (a) {
      if (!a || (pollId && a.poll !== pollId)) return;
      [].concat(a.value).forEach(function (v) {
        var w = normWord(v); if (!w || hidden[w] || banned(w)) return;
        if (!tally[w]) { tally[w] = 0; order.push(w); }
        tally[w]++;
      });
    });
    return order.map(function (w) { return { word: w, count: tally[w] }; }).sort(function (a, b) { return b.count - a.count; });
  }

  // ---------------------------------------------------------------- state extensions
  // Servers keep unknown top-level state keys out, so new instructor settings live in state.ui (scalars, ≤200 chars):
  //   ui.reveal = 'pollA|pollB'   ui.signalReset = ms   ui.hiddenWords = 'w1|w2'   ui.timers = '[[label,endsAt,remaining,running]…]'
  // Readers also accept the top-level forms (pollReveal{}, signalReset, hiddenWords[], timers[]) if a backend stores them.
  var UI_MAX = 200;
  function splitList(s) { return typeof s === 'string' && s ? s.split('|').filter(Boolean) : []; }
  function joinList(list) {
    var a = list.filter(Boolean).map(function (x) { return String(x).replace(/\|/g, ' '); });
    while (a.length && a.join('|').length > UI_MAX) a.shift();
    return a.join('|');
  }
  function uiOf(st) { return (st && st.ui) || {}; }
  var ext = {
    revealed: function (st, id) { return !!(st && ((st.pollReveal && st.pollReveal[id]) || splitList(uiOf(st).reveal).indexOf(id) >= 0)); },
    revealPatch: function (st, id, on) {
      var list = splitList(uiOf(st).reveal).filter(function (x) { return x !== id; });
      if (on) list.push(id);
      return { ui: { reveal: joinList(list) || null } };
    },
    signalReset: function (st) { return Math.max(+(st && st.signalReset) || 0, +uiOf(st).signalReset || 0); },
    hiddenWords: function (st) { return (st && Array.isArray(st.hiddenWords) ? st.hiddenWords : []).concat(splitList(uiOf(st).hiddenWords)); },
    hiddenPatch: function (st, word, hide) {
      var w = normWord(word); var list = splitList(uiOf(st).hiddenWords).filter(function (x) { return x !== w; });
      if (hide && w) list.push(w);
      return { ui: { hiddenWords: joinList(list) || null } };
    },
    /** → [{label, endsAt, remaining, running}] */
    timers: function (st) {
      if (st && Array.isArray(st.timers)) return st.timers;
      var raw = uiOf(st).timers; if (!raw) return [];
      try { return JSON.parse(raw).map(function (t) { return { label: String(t[0] || ''), endsAt: +t[1] || 0, remaining: +t[2] || 0, running: !!t[3] }; }); } catch (e) { return []; }
    },
    timersValue: function (list) {
      var out = (list || []).slice(0, 8).map(function (t) { return [cps(String(t.label || '')).slice(0, 12).join(''), t.endsAt || 0, t.remaining || 0, t.running ? 1 : 0]; });
      var s = JSON.stringify(out);
      while (out.length && s.length > UI_MAX) { out.pop(); s = JSON.stringify(out); }
      return out.length ? s : null;
    },
  };

  // ---------------------------------------------------------------- registry & global events
  var registry = {};
  var globalBus = new Emitter();
  var current = null;

  function defaultState() { return { step: null, slide: 0, follow: false, timer: null, notice: null, openPoll: null, ui: {}, updatedAt: 0 }; }
  function byCreated(a, b) { return (a.createdAt || 0) - (b.createdAt || 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); }

  // ---------------------------------------------------------------- the client
  function Client(config) {
    var self = this;
    config = assign({}, config || {});
    config.provider = config.provider || 'local';
    config.code = normCode(config.code || 'DEMO');
    if (config.provider === 'none') throw LiveError('no_provider', '실시간 기능이 꺼져 있습니다.');
    var factory = registry[config.provider];
    if (!factory) throw LiveError('unknown_provider', '실시간 어댑터 "' + config.provider + '"를 불러오지 못했습니다.');
    this.config = config;
    this.provider = config.provider;
    this.code = config.code;
    this.status = 'offline';
    this.mode = null;
    this.lastError = null;
    this._bus = new Emitter();
    this._docs = {}; COLS.forEach(function (c) { self._docs[c] = {}; });
    this._state = defaultState();
    this._cursor = 0;
    this._skew = 0;
    this._ns = 'lecLive:' + config.provider + ':' + hashStr(config.url || '') + ':' + config.code;
    this._idStore = config.identity === 'session' ? session : local;
    this._me = this._idStore.get(this._ns + ':me');
    this._adminKey = config.adminKey || session.get(this._ns + ':admin') || null;
    this._queue = local.get(this._ns + ':queue') || [];
    this._voted = local.get(this._ns + ':voted') || {};
    this._mine = local.get(this._ns + ':mine') || {};
    this._mask = makeMasker(config.profanity);
    this._syncing = null; this._syncAgain = false;
    this._reactAt = [];
    this._closed = false;
    var ctx = {
      config: config,
      token: function () { return self._me && self._me.token; },
      me: function () { return self._me; },
      adminKey: function () { return self._adminKey; },
      cursor: function () { return self._cursor; },
      emit: function (evt) { return self._onEvent(evt); },
      storage: { local: local, session: session, ns: this._ns },
      util: api.util,
      error: LiveError,
    };
    this._adapter = factory(assign({}, config, { adminKey: undefined }), ctx);
    if (!this._adapter) throw LiveError('bad_adapter', '어댑터를 만들지 못했습니다.');
    if (typeof this._adapter.subscribe === 'function') this._unsubAdapter = this._adapter.subscribe(function (evt) { return self._onEvent(evt); });
    this._onOnline = function () {
      if (self._closed) return;
      if (self.status === 'offline') self._reconnectSoon(500);
      else if (self._queue.length) setTimeout(function () { self._flushQueue(); }, 300);
    };
    if (root.addEventListener) root.addEventListener('online', this._onOnline);
    current = this;
  }
  var C = Client.prototype;

  // ----- events
  C.on = function (evt, cb) { return this._bus.on(evt, cb); };
  C.off = function (evt, cb) { this._bus.off(evt, cb); };
  C._emitChange = function (change) {
    this._bus.emit('change', change);
    if (change.col) this._bus.emit('change:' + change.col, this.store(change.col), change);
    if (change.type === 'state') this._bus.emit('change:state', this._state, change);
    if (change.type === 'reaction') this._bus.emit('reaction', change.doc);
    this._bus.emit('event', change);
    globalBus.emit('change', change, this);
  };
  /** onChange(col, cb) → cb(docs, change). col: a collection, 'state', or '*' (cb(change)). */
  C.onChange = function (col, cb) {
    if (col === '*') return this.on('change', cb);
    return this.on('change:' + col, cb);
  };
  /** Contract: subscribe(handler) → unsubscribe. handler({type, col, doc}) after the store merged it. */
  C.subscribe = function (handler) { return this.on('event', handler); };
  C._setStatus = function (s) {
    if (!s || s === this.status) return;
    this.status = s;
    this._bus.emit('status', s, this);
    globalBus.emit('status', s, this);
    if ((s === 'live' || s === 'polling') && this._queue.length) this._flushQueue();
  };

  // ----- store
  C.store = function (col, opts) {
    if (col === 'state') return this._state;
    var m = this._docs[col]; if (!m) return [];
    var out = []; for (var k in m) out.push(m[k]);
    if (opts && opts.visible) out = out.filter(function (d) { return d.status !== 'hidden' && !d.hidden; });
    if (opts && opts.mine) { var mine = this._mine[col] || {}; var me = this._me && this._me.id; out = out.filter(function (d) { return mine[d.id] || (me && d.by === me); }); }
    return out.sort(byCreated);
  };
  C.get = function (col, id) { var m = this._docs[col]; return m ? m[id] || null : null; };
  Object.defineProperty(C, 'state', { get: function () { return this._state; } });
  C.now = function () { return Date.now() + this._skew; };
  C.me = function () { return this._me ? { id: this._me.id, nickname: this._me.nickname } : null; };
  C.isAdmin = function () { return !!this._adminKey; };
  C.voted = function (id) { return !!this._voted[id]; };
  C.mine = function (col) { return this.store(col, { mine: true }); };

  C._maskDoc = function (col, doc) {
    var f = FIELDS[col]; if (!f || !doc) return doc;
    for (var k in f) if (f[k][2] && typeof doc[k] === 'string') doc[k] = this._mask(doc[k]);
    if (col !== 'participants' && typeof doc.nickname === 'string') doc.nickname = this._mask(doc.nickname);
    return doc;
  };
  C._merge = function (col, doc, type) {
    if (!doc || doc.id == null || !this._docs[col]) return false;
    var m = this._docs[col];
    doc = this._maskDoc(col, clone(doc));
    var old = m[doc.id];
    if (old && !old._pending && old.updatedAt && doc.updatedAt && doc.updatedAt < old.updatedAt) return false;
    if (doc.cid) {
      for (var k in m) {
        if (m[k]._pending && m[k].cid === doc.cid && k !== doc.id) {
          var tmp = m[k]; delete m[k];
          this._emitChange({ type: 'remove', col: col, doc: { id: tmp.id, replacedBy: doc.id } });
        }
      }
    }
    if (old && old._pending && !doc._pending) doc._pending = false; // listeners that Object.assign() see the flag clear
    if (old && same(old, doc)) return false;
    m[doc.id] = doc;
    this._emitChange({ type: old ? 'update' : (type === 'update' ? 'update' : 'add'), col: col, doc: doc });
    return true;
  };
  C._drop = function (col, id) {
    var m = this._docs[col]; if (!m || !m[id]) return false;
    delete m[id];
    this._emitChange({ type: 'remove', col: col, doc: { id: id } });
    return true;
  };
  C._setState = function (st) {
    if (!st) return false;
    if (this._state.updatedAt && st.updatedAt && st.updatedAt < this._state.updatedAt) return false;
    var next = assign(defaultState(), st);
    if (same(next, this._state)) return false;
    this._state = next;
    this._emitChange({ type: 'state', col: null, doc: next });
    return true;
  };
  C._reset = function () {
    var self = this;
    COLS.forEach(function (c) { self._docs[c] = {}; });
    this._state = defaultState();
    this._cursor = 0;
    this._mine = {}; local.del(this._ns + ':mine');
    this._emitChange({ type: 'reset', col: null, doc: null });
    COLS.forEach(function (c) { self._bus.emit('change:' + c, [], { type: 'reset', col: c }); });
  };
  /** Applies a snapshot {state, <col>[], removed[], now, time, full}. Returns number of changes. */
  C._applySnapshot = function (snap, full) {
    var self = this; var n = 0;
    if (!snap) return 0;
    if (snap.time) this._skew = snap.time - Date.now();
    COLS.forEach(function (col) {
      var list = snap[col]; if (!Array.isArray(list)) return;
      if (full) {
        var seen = {}; list.forEach(function (d) { seen[d.id] = 1; });
        var m = self._docs[col];
        for (var id in m) if (!seen[id] && !m[id]._pending) { self._drop(col, id); n++; }
      }
      list.forEach(function (d) { if (self._merge(col, d)) n++; });
    });
    (snap.removed || []).forEach(function (r) { if (self._drop(r.col, r.id)) n++; });
    if (snap.state && this._setState(snap.state)) n++;
    if (snap.now != null) this._cursor = snap.now;
    return n;
  };

  C._onEvent = function (evt) {
    if (!evt || this._closed) return;
    switch (evt.type) {
      case 'add': case 'update': this._merge(evt.col, evt.doc, evt.type); break;
      case 'remove': if (evt.doc) this._drop(evt.col, evt.doc.id); break;
      case 'state': this._setState(evt.doc); break;
      case 'reaction': if (evt.doc && EMOJIS.indexOf(evt.doc.emoji) >= 0) this._emitChange({ type: 'reaction', col: null, doc: { emoji: evt.doc.emoji, count: Math.min(50, Math.max(1, evt.doc.count | 0 || 1)) } }); break;
      case 'reset': this._reset(); return this.sync(true);
      case 'status': this._setStatus(evt.status); if (evt.mode) this.mode = evt.mode; break;
      case 'resync': return this.sync(!!evt.full);
      case 'hello': if (evt.now) this._skew = evt.now - Date.now(); break;
      case 'error': this.lastError = evt.error; this._bus.emit('error', evt.error); break;
      default: break;
    }
  };

  // ----- calls with retry
  C._call = function (name, args, opts) {
    var self = this; opts = opts || {};
    var tries = opts.tries == null ? 3 : opts.tries;
    var fn = this._adapter[name];
    if (typeof fn !== 'function') return Promise.reject(LiveError('unsupported', '이 실시간 방식은 "' + name + '" 기능을 지원하지 않습니다.', { status: 501, retryable: false }));
    var attempt = 0;
    function run() {
      return Promise.resolve().then(function () { return fn.apply(self._adapter, args); }).catch(function (err) {
        if (!err || typeof err !== 'object') err = LiveError('error', String(err));
        if (err.code === 'invalid_token' && !opts.noRejoin && self._me && name !== 'join') {
          opts.noRejoin = true;
          return self._rejoin().then(run);
        }
        attempt++;
        if (err.retryable !== false && attempt < tries) return sleep(err.retryAfter ? Math.min(10000, err.retryAfter * 1000) : backoff(attempt - 1, 600, 5000)).then(run);
        self.lastError = err;
        throw err;
      });
    }
    return run();
  };
  C._rejoin = function () {
    var prev = this._me || {};
    this._me = null; this._idStore.del(this._ns + ':me');
    return this.join({ nickname: prev.nickname });
  };
  C._ensureJoined = function () {
    if (this._me && this._me.token) return Promise.resolve(this._me);
    var p = local.get('lecLive:profile') || {};
    return this.join({ nickname: this.config.nickname || p.nickname || '' });
  };

  // ----- connect / sync
  C.connect = function () {
    var self = this;
    if (this._connecting) return this._connecting;
    this._closed = false;
    this._setStatus('connecting');
    this._connecting = this._call('connect', [], { tries: 2 }).then(function (info) {
      info = info || {};
      self.mode = info.mode || 'realtime';
      var as = self._adapter.status;
      self._setStatus(as === 'live' || as === 'polling' ? as : (info.mode === 'polling' ? 'polling' : 'live'));
      return self.sync(true).then(function () { self._flushQueue(); return info; });
    }, function (err) {
      self._setStatus('offline');
      self._connecting = null;
      self._reconnectSoon();
      throw err;
    });
    return this._connecting;
  };
  C._reconnectSoon = function (ms) {
    var self = this;
    if (this._reconnectTimer || this._closed) return;
    this._reconnectN = (this._reconnectN || 0) + 1;
    this._reconnectTimer = setTimeout(function () {
      self._reconnectTimer = null;
      if (self._closed || self.status !== 'offline') return;
      self.connect().then(function () { self._reconnectN = 0; }, function () { /* next round scheduled */ });
    }, ms || backoff(Math.min(self._reconnectN, 5), 2000, 60000));
  };
  /** Fetches changes since the cursor (or everything when full) and merges them. → {changes} */
  C.sync = function (full) {
    var self = this;
    if (this._syncing) { this._syncAgain = this._syncAgain || (full ? 'full' : true); return this._syncing; }
    var since = full ? 0 : this._cursor;
    var job;
    if (typeof this._adapter.snapshot === 'function') job = this._call('snapshot', [{ since: since, admin: !!this._adminKey }], { tries: 2 });
    else job = this._listAll(since);
    this._syncing = job.then(function (snap) {
      var n = self._applySnapshot(snap, since === 0);
      if (since === 0) self._synced = true;
      return { changes: n };
    }).catch(function (err) {
      self.lastError = err;
      return { changes: 0, error: err };
    }).then(function (r) {
      self._syncing = null;
      var again = self._syncAgain; self._syncAgain = false;
      if (again) return self.sync(again === 'full').then(function (r2) { return { changes: r.changes + r2.changes }; });
      return r;
    });
    return this._syncing;
  };
  C._listAll = function (since) {
    var self = this;
    var cols = this._adminKey ? COLS : PUBLIC_COLS;
    var snap = { now: null, since: since };
    return Promise.all(cols.map(function (c) {
      return self._call('list', [c, { since: since }], { tries: 2 }).then(function (docs) { snap[c] = docs || []; }, function () { /* skip col */ });
    })).then(function () { return self._call('getState', [], { tries: 2 }); }).then(function (st) {
      snap.state = st;
      var max = since; COLS.forEach(function (c) { (snap[c] || []).forEach(function (d) { if (d.updatedAt > max) max = d.updatedAt; }); });
      snap.now = max;
      return snap;
    });
  };
  C.disconnect = C.close = function () {
    this._closed = true;
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
    if (this._flushTimer) { clearTimeout(this._flushTimer); this._flushTimer = null; }
    if (root.removeEventListener) root.removeEventListener('online', this._onOnline);
    this._connecting = null;
    var a = this._adapter;
    this._setStatus('offline');
    return Promise.resolve(a.close ? a.close() : (a.disconnect ? a.disconnect() : null));
  };

  // ----- identity
  C.join = function (profile) {
    var self = this; profile = profile || {};
    var p = {
      nickname: cleanText(profile.nickname, LIMITS.nickname, false),
      name: cleanText(profile.name, LIMITS.name, false) || undefined,
      school: cleanText(profile.school, LIMITS.school, false) || undefined,
      consent: !!profile.consent,
    };
    p.nickname = this._mask(p.nickname) || '참가자' + String(Math.floor(Math.random() * 900) + 100);
    if (this._me && this._me.token && !profile.force) {
      if (p.nickname && p.nickname !== this._me.nickname && profile.nickname) {
        return this.update('participants', this._me.id, { nickname: p.nickname }).then(function () {
          self._me.nickname = p.nickname; self._idStore.set(self._ns + ':me', self._me); return { id: self._me.id, token: self._me.token };
        }, function () { return { id: self._me.id, token: self._me.token }; });
      }
      return Promise.resolve({ id: this._me.id, token: this._me.token });
    }
    if (this._joining) return this._joining;
    this._joining = this._call('join', [p], { tries: 3 }).then(function (r) {
      self._joining = null;
      if (!r || !r.id || !r.token) throw LiveError('bad_response', '참여 응답이 올바르지 않습니다.');
      self._me = { id: r.id, token: r.token, nickname: r.nickname || p.nickname, at: Date.now() };
      self._idStore.set(self._ns + ':me', self._me);
      local.set('lecLive:profile', { nickname: self._me.nickname });
      self._bus.emit('join', self.me());
      if (self._queue.length) self._flushQueue();
      return { id: r.id, token: r.token };
    }, function (e) { self._joining = null; throw e; });
    return this._joining;
  };
  /** Forget this device's participant identity (shared computers). */
  C.leave = function () { this._me = null; this._idStore.del(this._ns + ':me'); this._voted = {}; local.del(this._ns + ':voted'); };
  C.setAdminKey = function (key) {
    this._adminKey = key ? String(key) : null;
    if (key) session.set(this._ns + ':admin', String(key)); else session.del(this._ns + ':admin');
    var a = this._adapter;
    var p = a.setAdmin ? Promise.resolve(a.setAdmin(this._adminKey)) : Promise.resolve();
    var self = this;
    return p.then(function () { return self.status === 'offline' ? null : self.sync(true); });
  };
  /** Resolves true when the admin key is accepted by the backend. */
  C.checkAdmin = function () {
    if (!this._adminKey) return Promise.resolve(false);
    if (typeof this._adapter.checkAdmin === 'function') return this._call('checkAdmin', [], { tries: 2 }).then(function (ok) { return !!ok; });
    return this._call('exportCsv', ['participants'], { tries: 1 }).then(function () { return true; }, function (e) { if (e.status === 401 || e.status === 403) return false; throw e; });
  };

  // ----- writes (queued when offline)
  C._prepare = function (col, doc) {
    var f = FIELDS[col] || {}; var out = {};
    for (var k in doc) {
      if (!Object.prototype.hasOwnProperty.call(doc, k) || k.charAt(0) === '_') continue;
      var v = doc[k];
      if (f[k] && typeof v === 'string') { v = cleanText(v, f[k][0], !!f[k][1]); if (f[k][2]) v = this._mask(v); }
      else if (f[k] && Array.isArray(v)) v = v.map(function (x) { return typeof x === 'string' ? cleanText(x, f[k][0], false) : x; });
      out[k] = v;
    }
    return out;
  };
  C._online = function () { return this.status === 'live' || this.status === 'polling'; };
  C._persistQueue = function () { local.set(this._ns + ':queue', this._queue.slice(-100)); this._bus.emit('queue', this._queue.length); };
  C._enqueue = function (op) {
    this._queue.push(op);
    if (this._queue.length > 100) this._queue.shift();
    this._persistQueue();
    this._scheduleFlush(5000);
  };
  C._scheduleFlush = function (ms) {
    var self = this;
    if (this._flushTimer || this._closed) return;
    this._flushTimer = setTimeout(function () {
      self._flushTimer = null;
      if (!self._queue.length) return;
      if (self._online()) self._flushQueue(); else self._scheduleFlush(Math.min(60000, (ms || 5000) * 2));
    }, ms || 5000);
  };
  C._optimistic = function (op) {
    var now = this.now();
    if (op.op === 'add') {
      var tmp = assign({}, op.doc, { id: 'tmp_' + op.cid, cid: op.cid, createdAt: now, updatedAt: now, _pending: true });
      if (this._me) tmp.by = this._me.id;
      if (op.col === 'questions') assign(tmp, { votes: 0, status: 'open', pinned: false, nickname: op.doc.anonymous === false && this._me ? this._me.nickname : '' });
      if (op.col === 'posts') assign(tmp, { likes: 0, hidden: !!(this._state.ui || {}).moderation, nickname: this._me ? this._me.nickname : '' });
      if (op.col === 'chat' || op.col === 'help') tmp.nickname = this._me ? this._me.nickname : '';
      if (op.col === 'help') assign(tmp, { status: 'open', assignee: '' });
      if (op.col === 'progress' || op.col === 'answers' || op.col === 'survey' || op.col === 'attendance') {
        // keyed upserts replace the existing doc of mine
        var me = this._me && this._me.id; var m = this._docs[op.col];
        for (var k in m) {
          var d = m[k];
          if (d.by === me && ((op.col === 'progress' && d.station === op.doc.station) || (op.col === 'answers' && d.poll === op.doc.poll) || op.col === 'survey' || (op.col === 'attendance' && d.kind === op.doc.kind))) {
            var up = assign({}, d, op.doc, { updatedAt: now, _pending: true, cid: op.cid }); this._docs[op.col][k] = up;
            this._emitChange({ type: 'update', col: op.col, doc: up }); return up;
          }
        }
      }
      this._docs[op.col][tmp.id] = tmp;
      this._emitChange({ type: 'add', col: op.col, doc: tmp });
      return tmp;
    }
    if (op.op === 'update') {
      var cur = this.get(op.col, op.id); if (!cur) return null;
      var next = assign({}, cur, op.patch, { _pending: true });
      this._docs[op.col][op.id] = next;
      this._emitChange({ type: 'update', col: op.col, doc: next });
      return next;
    }
    return null;
  };
  C._exec = function (op) {
    var self = this;
    var needsToken = !(op.admin) && op.op !== 'remove';
    var pre = needsToken ? this._ensureJoined() : Promise.resolve();
    return pre.then(function () {
      switch (op.op) {
        case 'add': return self._call('add', [op.col, assign({}, op.doc, { cid: op.cid })]).then(function (doc) {
          if (doc && doc.id) { self._markMine(op.col, doc.id); if (!doc.cid) doc.cid = op.cid; self._merge(op.col, doc); }
          return doc;
        });
        case 'update': return self._call('update', [op.col, op.id, op.patch]).then(function (doc) { if (doc && doc.id) self._merge(op.col, doc, 'update'); return doc; });
        case 'vote': return self._call('vote', [op.id]);
        case 'like': return self._call('like', [op.id]);
        default: throw LiveError('bad_op', op.op);
      }
    });
  };
  C._markMine = function (col, id) {
    var m = this._mine[col] || (this._mine[col] = {});
    m[id] = 1;
    var keys = Object.keys(m); if (keys.length > 300) delete m[keys[0]];
    local.set(this._ns + ':mine', this._mine);
  };
  C._write = function (op) {
    var self = this;
    if (!this._online()) {
      this._enqueue(op);
      return Promise.resolve(this._optimistic(op) || { queued: true });
    }
    return this._exec(op).catch(function (err) {
      if (err && err.retryable !== false && !err.status) {
        self._enqueue(op);
        return self._optimistic(op) || { queued: true };
      }
      throw err;
    });
  };
  C._flushQueue = function () {
    var self = this;
    if (this._flushing || !this._queue.length || !this._online()) return this._flushing || Promise.resolve();
    this._flushing = (function next() {
      if (!self._queue.length || !self._online()) return Promise.resolve();
      var op = self._queue[0];
      return self._exec(op).then(function () {
        self._queue.shift(); self._persistQueue(); return next();
      }, function (err) {
        if (err && err.retryable !== false && !err.status) { self._scheduleFlush(10000); return; }
        self._queue.shift(); self._persistQueue();
        if (op.op === 'add') self._drop(op.col, 'tmp_' + op.cid);
        self._bus.emit('error', err, op);
        return next();
      });
    })().then(function () { self._flushing = null; }, function () { self._flushing = null; });
    return this._flushing;
  };

  C.add = function (col, doc) {
    if (COLS.indexOf(col) < 0) return Promise.reject(LiveError('unknown_collection', '없는 컬렉션: ' + col, { status: 400, retryable: false }));
    var d = this._prepare(col, doc || {});
    var cid = d.cid || uid(16); delete d.cid;
    var op = { op: 'add', col: col, doc: d, cid: cid, at: Date.now(), admin: col === 'polls' };
    if (col === 'polls') return this._exec(op);
    return this._write(op);
  };
  C.update = function (col, id, patch) {
    var op = { op: 'update', col: col, id: id, patch: this._prepare(col, patch || {}), at: Date.now() };
    var mine = this._me && (this.get(col, id) || {}).by === this._me.id || (this._mine[col] || {})[id] || (col === 'participants' && this._me && id === this._me.id);
    if (this._adminKey && !mine) { op.admin = true; return this._exec(op); }
    return this._write(op);
  };
  C.remove = function (col, id) {
    var self = this;
    return this._call('remove', [col, id]).then(function (r) { self._drop(col, id); return r === undefined ? true : r; });
  };
  C.vote = function (questionId) {
    var self = this;
    if (this._voted[questionId]) { var q = this.get('questions', questionId); return Promise.resolve({ votes: q ? q.votes : 0, already: true }); }
    this._voted[questionId] = 1; local.set(this._ns + ':voted', this._voted);
    var q0 = this.get('questions', questionId);
    if (q0) { var bumped = assign({}, q0, { votes: (q0.votes || 0) + 1 }); this._docs.questions[questionId] = bumped; this._emitChange({ type: 'update', col: 'questions', doc: bumped }); }
    return this._write({ op: 'vote', id: questionId, at: Date.now() }).then(function (r) {
      var q = self.get('questions', questionId);
      if (r && typeof r.votes === 'number' && q && q.votes !== r.votes) { var fixed = assign({}, q, { votes: r.votes }); self._docs.questions[questionId] = fixed; self._emitChange({ type: 'update', col: 'questions', doc: fixed }); }
      return r;
    }, function (err) {
      delete self._voted[questionId]; local.set(self._ns + ':voted', self._voted);
      if (q0) self._merge('questions', assign({}, q0, { updatedAt: (q0.updatedAt || 0) + 0.001 }));
      throw err;
    });
  };
  C.like = function (postId) {
    var self = this; var key = 'post:' + postId;
    if (this._voted[key]) { var p = this.get('posts', postId); return Promise.resolve({ likes: p ? p.likes : 0, already: true }); }
    this._voted[key] = 1; local.set(this._ns + ':voted', this._voted);
    return this._write({ op: 'like', id: postId, at: Date.now() }).catch(function (err) { delete self._voted[key]; local.set(self._ns + ':voted', self._voted); throw err; });
  };
  C.list = function (col, opts) {
    var self = this;
    // After the first full sync the store is already current (realtime/polling keep it so): no extra request.
    if (this._synced && this._online() && !(opts && opts.since) && (PUBLIC_COLS.indexOf(col) >= 0 || this._adminKey)) return Promise.resolve(this.store(col));
    return this._call('list', [col, opts || {}]).then(function (docs) { (docs || []).forEach(function (d) { self._merge(col, d); }); return self.store(col); });
  };
  C.getState = function () {
    var self = this;
    if (this._online() && this._state.updatedAt) return Promise.resolve(this._state);
    return this._call('getState', []).then(function (st) { self._setState(st); return self._state; });
  };
  C.setState = function (patch) {
    var self = this;
    return this._call('setState', [patch || {}]).then(function (st) { self._setState(st); return self._state; });
  };
  C.react = function (emoji) {
    if (EMOJIS.indexOf(emoji) < 0) return Promise.reject(LiveError('invalid_value', '보낼 수 없는 반응입니다.', { status: 400, retryable: false }));
    var now = Date.now();
    this._reactAt = this._reactAt.filter(function (t) { return now - t < 1000; });
    if (this._reactAt.length >= 6) return Promise.resolve(false);
    this._reactAt.push(now);
    this._emitChange({ type: 'reaction', col: null, doc: { emoji: emoji, count: 1, self: true } });
    if (!this._online()) return Promise.resolve(false);
    var self = this;
    return this._ensureJoined().then(function () { return self._call('react', [emoji], { tries: 1 }); }).then(function () { return true; }, function () { return false; });
  };
  C.upload = function (file) {
    var self = this;
    if (!file || typeof file.size !== 'number') return Promise.reject(LiveError('invalid_value', '파일을 골라 주세요.', { status: 400, retryable: false }));
    var maxMb = this.config.maxUploadMb || LIMITS.uploadMb;
    if (file.size > maxMb * 1048576) return Promise.reject(LiveError('too_large', '파일은 ' + maxMb + 'MB까지 올릴 수 있어요.', { status: 413, retryable: false }));
    if (file.type && !UPLOAD_TYPES[file.type]) return Promise.reject(LiveError('unsupported_type', '이미지·PDF·MP3·MP4만 올릴 수 있어요.', { status: 415, retryable: false }));
    return this._ensureJoined().then(function () { return self._call('upload', [file], { tries: 2 }); });
  };
  /** exportCsv(kind, opts) — opts only matter for 'completion' (see completionTable). Servers that do not know
   *  'completion' yet are covered by building it here from the admin store. */
  C.exportCsv = function (kind, opts) {
    var self = this; kind = kind || 'attendance';
    return this._call('exportCsv', [kind, opts || {}], { tries: 2 }).catch(function (err) {
      if (kind !== 'completion' || !self._adminKey || !err || !(err.code === 'bad_kind' || err.code === 'unsupported' || err.status === 400 || err.status === 404)) throw err;
      var data = {}; ['participants', 'attendance', 'progress', 'survey'].forEach(function (c) { data[c] = self.store(c); });
      var t = completionTable(data, opts);
      return toCsv(t.columns, t.rows);
    });
  };
  C.purge = function () {
    var self = this;
    return this._call('purge', [], { tries: 1 }).then(function (r) { self._reset(); return r === undefined ? true : r; });
  };

  // ---------------------------------------------------------------- public API
  var api = {
    __core: true,
    version: VERSION,
    cols: COLS.slice(), publicCols: PUBLIC_COLS.slice(), privateCols: PRIVATE_COLS.slice(),
    limits: LIMITS, emojis: EMOJIS.slice(), uploadTypes: Object.keys(UPLOAD_TYPES),
    register: function (name, factory) { registry[name] = factory; return api; },
    providers: function () { return Object.keys(registry); },
    has: function (name) { return !!registry[name]; },
    create: function (config) { return new Client(config); },
    current: function () { return current; },
    /** LecLive.on('status', cb(status, client)) / LecLive.on('change', cb(change, client)) — any client. */
    on: function (evt, cb) { return globalBus.on(evt, cb); },
    off: function (evt, cb) { globalBus.off(evt, cb); },
    /** Current docs of the most recently created client. */
    store: function (col, opts) { return current ? current.store(col, opts) : (col === 'state' ? defaultState() : []); },
    onChange: function (col, cb) {
      return globalBus.on('change', function (change, client) {
        if (client !== current) return;
        if (col === '*') cb(change);
        else if (col === 'state' && change.type === 'state') cb(client.state, change);
        else if (change.col === col || change.type === 'reset') cb(client.store(col), change);
      });
    },
    mask: function (text, cfg) { return makeMasker(cfg)(text); },
    error: LiveError,
    util: {
      uid: uid, sleep: sleep, jitter: jitter, backoff: backoff, assign: assign, clone: clone, sha256: sha256, sha256sync: function (s) { return sha256js(utf8(String(s))); },
      loadScript: loadScript, cleanText: cleanText, toCsv: toCsv, exportTable: exportTable, fmtTime: fmtTime, Emitter: Emitter,
      storage: { local: local, session: session }, isHidden: isHidden, normCode: normCode, defaultState: defaultState, hashStr: hashStr,
      fields: FIELDS, normWord: normWord, wordCloud: wordCloud, banned: makeBanned, zonedMs: zonedMs, completionColumns: COMPLETION_COLS.slice(), ext: ext,
    },
  };
  root.LecLive = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
