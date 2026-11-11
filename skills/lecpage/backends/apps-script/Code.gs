/**
 * lecpage live — Google Apps Script backend (one Google Sheet = one training).
 * Paste into Extensions → Apps Script, run `setup` once, set the admin key from the "lecpage" menu,
 * then Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone). See README.md.
 *
 * JSON API (sheets.js speaks it; same semantics as HTTP protocol v1, polling only):
 *   GET  ?a=snapshot&code=..&since=..   GET ?a=state&code=..   GET ?a=ping
 *   POST text/plain {a:'join'|'snapshot'|'add'|'update'|'remove'|'vote'|'like'|'setState'|'react'|'upload'|'export'|'purge'|'checkAdmin', ...}
 *   → {ok:true, data} or {ok:false, status, error, message}   (Apps Script cannot set HTTP status codes)
 * Writes take LockService's script lock. Values that look like formulas are stored as text.
 * Security: one sheet = one training code (fixed by setup, or by the first join/admin call); wrong admin keys are
 * counted (20 per 10 minutes, then 429 for everyone — Apps Script cannot see client IPs); board files must be Drive
 * files this script created for that participant; they are shared only while their post is visible and trashed on
 * remove, purge and retention clean-up.
 */
var VERSION = '1.0.0';
var COLS = ['participants', 'attendance', 'progress', 'help', 'questions', 'posts', 'polls', 'answers', 'survey', 'chat'];
var PUBLIC_COLS = ['questions', 'posts', 'help', 'progress', 'polls', 'answers', 'chat'];
var PRIVATE_COLS = ['participants', 'attendance', 'survey'];
var FIELDS = {
  participants: ['nickname', 'name', 'school', 'consentAt'],
  attendance: ['kind', 'at'], progress: ['station', 'status', 'at'],
  help: ['nickname', 'station', 'seat', 'message', 'status', 'assignee'],
  questions: ['text', 'nickname', 'anonymous', 'votes', 'status', 'pinned'],
  posts: ['kind', 'text', 'nickname', 'files', 'license', 'likes', 'hidden'],
  polls: ['question', 'kind', 'options', 'open'], answers: ['poll', 'value'], survey: ['answers'],
  chat: ['nickname', 'text', 'hidden'],
};
var BASE = ['id', 'code', 'by', 'key', 'cid', 'createdAt', 'updatedAt'];
var TYPES = { createdAt: 'n', updatedAt: 'n', votes: 'n', likes: 'n', at: 'n', consentAt: 'n', anonymous: 'b', pinned: 'b', hidden: 'b', open: 'b', files: 'j', options: 'j', value: 'j', answers: 'j' };
var LIMITS = { nickname: 20, name: 40, school: 60, question: 500, post: 1000, chat: 300, help: 300, seat: 20, id: 64, kind: 32, pollQuestion: 200, option: 100, answer: 200, notice: 300, timerLabel: 40, license: 40, assignee: 20, cid: 40 };
var RATE = { write: 90, questions: 8, help: 6, posts: 12, chat: 30, vote: 120, react: 90, upload: 10, join: 600 };
var AUTH_FAILS = 20;          // wrong admin keys per 10 minutes before the sheet answers 429
var MAX_PARTICIPANTS = 500;
var RESERVED = ['강사', '강사님', '운영자', '운영자님', 'admin', 'admin님', 'administrator', 'lecpage', 'lecpage님'];
var WEAK_KEYS = ['change-me', 'changeme', 'change-me-관리자키', '관리자키', '관리자 키', '연수관리자키', '내관리자키', '관리자키-8자-이상',
  '여기에-관리자-키-8자-이상', 'admin', 'administrator', 'password', 'password123', 'qwerty', '12345678', '123456789012', 'lecpage', 'correct-horse-battery'];
var EMOJIS = ['👍', '❤️', '👏', '🎉', '😂', '😮', '🤔', '🙏', '🔥', '💯', '🙌', '😢', '✅', '❓', '💡'];
var UPLOAD_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'application/pdf': 'pdf', 'audio/mpeg': 'mp3', 'video/mp4': 'mp4' };

// ---------------------------------------------------------------- menu & setup (run from the editor / sheet)
function onOpen() {
  SpreadsheetApp.getUi().createMenu('lecpage')
    .addItem('1. 시트 준비하기', 'setup')
    .addItem('2. 관리자 키 정하기', 'menuSetAdminKey')
    .addItem('연수 코드 고정하기(선택)', 'menuSetCode')
    .addItem('파일 올리기 켜기/끄기(선택)', 'menuToggleUploads')
    .addItem('설정 확인', 'menuShowSettings')
    .addSeparator()
    .addItem('실시간 데이터 모두 지우기', 'menuPurge')
    .addToUi();
}
/** setup('AB12CD') from the editor, or the menu (asks for the code). Fixes the training code of this sheet:
 *  requests with any other code are refused (L11). Without a code the first join or admin call fixes it. */
function setup(code) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  COLS.concat(['tombstones', 'votes', 'files']).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var head = headerOf(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), head.length).setNumberFormat('@'); // keep "007" as text, never formulas
  });
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('RETENTION_DAYS')) props.setProperty('RETENTION_DAYS', '30');
  if (typeof code === 'string' && code.trim()) props.setProperty('CODE', checkCode(code));
  try {
    var ui = SpreadsheetApp.getUi();
    if (!props.getProperty('CODE')) {
      var r = ui.prompt('연수 코드', '사이트의 연수 코드(영문·숫자, 예: AB12CD)를 적어 주세요. 이 시트는 이 코드만 받습니다.', ui.ButtonSet.OK_CANCEL);
      if (r.getSelectedButton() === ui.Button.OK && String(r.getResponseText() || '').trim()) props.setProperty('CODE', checkCode(r.getResponseText()));
    }
    ui.alert('준비가 끝났어요. 이제 lecpage 메뉴에서 "관리자 키 정하기"를 눌러 주세요.');
  } catch (e) { if (e && e.lec) throw e; /* run from the editor */ }
}
function headerOf(name) {
  if (name === 'tombstones') return ['col', 'id', 'code', 'at'];
  if (name === 'votes') return ['col', 'doc', 'by', 'code'];
  if (name === 'files') return ['id', 'code', 'by', 'post', 'type', 'createdAt'];
  return BASE.concat(FIELDS[name]);
}
function menuSetAdminKey() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('관리자 키 정하기', '강사 화면에 넣을 비밀번호를 12자 이상으로 정해 주세요. 시트에는 저장되지 않고, 해시(SHA-256)만 스크립트 속성에 남습니다.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var key = r.getResponseText();
  var why = keyProblem(key);
  if (why) { ui.alert(why); return; }
  PropertiesService.getScriptProperties().setProperty('ADMIN_HASH', sha256hex(key));
  ui.alert('관리자 키를 저장했어요. 키는 다시 보여 주지 않으니 따로 적어 두세요.');
}
function menuSetCode() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('연수 코드', '이 시트를 쓸 연수 코드(영문·숫자). 비우면 어떤 코드든 받습니다.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var c = String(r.getResponseText() || '').trim().toUpperCase();
  if (c) PropertiesService.getScriptProperties().setProperty('CODE', checkCode(c)); else PropertiesService.getScriptProperties().deleteProperty('CODE');
  ui.alert(c ? '연수 코드를 ' + c + '(으)로 고정했어요.' : '연수 코드 고정을 풀었어요. 다음 참여나 관리자 연결 때의 코드로 다시 고정됩니다.');
}
function menuToggleUploads() {
  var p = PropertiesService.getScriptProperties();
  var on = p.getProperty('UPLOADS') === 'on';
  p.setProperty('UPLOADS', on ? 'off' : 'on');
  SpreadsheetApp.getUi().alert(on ? '파일 올리기를 껐어요.' : '파일 올리기를 켰어요. 올린 파일은 내 드라이브의 "lecpage 업로드" 폴더에 저장되고, 보드에 보이는 동안만 "링크가 있는 모든 사용자 보기"로 공유됩니다(숨기면 비공개, 지우거나 보관 기간이 끝나면 휴지통). 학교 계정은 막혀 있을 수 있어요.');
}
function menuShowSettings() {
  var p = PropertiesService.getScriptProperties();
  SpreadsheetApp.getUi().alert('관리자 키: ' + (p.getProperty('ADMIN_HASH') ? '설정됨' : '없음(꼭 정하세요)') + '\n연수 코드: ' + (p.getProperty('CODE') || '아직 없음(첫 참여 때 고정)') + '\n파일 올리기: ' + (p.getProperty('UPLOADS') === 'on' ? '켜짐' : '꺼짐') + '\n보관 기간: ' + (p.getProperty('RETENTION_DAYS') || '30') + '일\n버전: ' + VERSION);
}
function menuPurge() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('모두 지우기', '참가자·질문·진행 기록 등 실시간 데이터를 모두 지울까요? 되돌릴 수 없어요.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  withLock(function () { wipeAll(); });
  ui.alert('지웠어요.');
}
/** Optional daily trigger (Triggers → Add → cleanup, time-driven, day timer). Wipes data idle past RETENTION_DAYS. */
function cleanup() {
  var p = PropertiesService.getScriptProperties();
  var days = Number(p.getProperty('RETENTION_DAYS') || 30);
  var last = Number(p.getProperty('LAST_AT') || 0);
  if (last && Date.now() - last > days * 864e5) withLock(function () { wipeAll(); });
  // uploads never attached to a post within a day go to the Drive trash
  else withLock(function () { trashFiles(rows('files').filter(function (r) { return !r.post && Date.now() - Number(r.createdAt || 0) > 864e5; }).map(function (r) { return r.id; })); });
}

// ---------------------------------------------------------------- web app entry points
function doGet(e) {
  return respond(function () {
    var p = (e && e.parameter) || {};
    if (p.a === 'ping') return { ok: true, version: VERSION, protocol: 1 };
    if (p.a === 'state') return getState(normCode(p.code));
    if (p.a === 'snapshot') return snapshot({ code: p.code, since: p.since, rs: p.rs });
    throw httpErr(400, 'bad_action', '알 수 없는 요청입니다.');
  });
}
function doPost(e) {
  return respond(function () {
    var raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > 30 * 1024 * 1024) throw httpErr(413, 'too_large', '요청이 너무 큽니다.');
    var b; try { b = JSON.parse(raw); } catch (x) { throw httpErr(400, 'invalid_json', 'JSON 형식이 아닙니다.'); }
    if (!b || typeof b !== 'object') throw httpErr(400, 'invalid_body', '본문이 올바르지 않습니다.');
    switch (b.a) {
      case 'snapshot': return snapshot(b);
      case 'join': return withLock(function () { return join(b); });
      case 'add': return withLock(function () { return add(b); });
      case 'update': return withLock(function () { return update(b); });
      case 'remove': return withLock(function () { return remove(b); });
      case 'vote': return withLock(function () { return vote(b, 'questions', 'votes'); });
      case 'like': return withLock(function () { return vote(b, 'posts', 'likes'); });
      case 'setState': return withLock(function () { return setState(b); });
      case 'react': return react(b);
      case 'upload': return upload(b);
      case 'export': return exportCsv(b);
      case 'purge': return withLock(function () { normCode(b.code); requireAdmin(b.admin); wipeAll(); return { ok: true }; });
      case 'checkAdmin': { var c0 = normCode(b.code); var ok = adminOk(b.admin); if (ok) normCode(c0, true); return ok; }
      default: throw httpErr(400, 'bad_action', '알 수 없는 요청입니다.');
    }
  });
}
function respond(fn) {
  var out;
  try { out = { ok: true, data: fn() }; } catch (e) {
    if (e && e.lec) out = { ok: false, status: e.status, error: e.code, message: e.message, retryAfter: e.retryAfter || undefined };
    else { console.error('lecpage error: ' + (e && e.message)); out = { ok: false, status: 500, error: 'server_error', message: '서버 오류가 났어요. 잠시 후 다시 시도해 주세요.' }; }
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function httpErr(status, code, message, extra) { var e = new Error(message); e.lec = true; e.status = status; e.code = code; if (extra) for (var k in extra) e[k] = extra[k]; return e; }
function withLock(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw httpErr(503, 'busy', '요청이 몰렸어요. 잠시 후 다시 시도해 주세요.');
  try { var r = fn(); invalidate(); return r; } finally { lock.releaseLock(); }
}

// ---------------------------------------------------------------- helpers
function sha256hex(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8);
  return bytes.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; }).join('');
}
function hashEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== 64 || b.length !== 64) return false;
  var d = 0; for (var i = 0; i < 64; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function checkCode(c) {
  c = String(c || '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(c)) throw httpErr(400, 'bad_code', '연수 코드는 영문·숫자 3~40자입니다.');
  return c;
}
/** One sheet = one training (L11). claim: a join or an admin call fixes the code when setup did not. */
function normCode(c, claim) {
  c = checkCode(c);
  var props = PropertiesService.getScriptProperties();
  var fixed = props.getProperty('CODE');
  if (!fixed && claim) { props.setProperty('CODE', c); fixed = c; }
  if (fixed && fixed !== c) throw httpErr(404, 'unknown_training', '이 시트는 다른 연수 코드용입니다.');
  return c;
}
function keyProblem(key) {
  var k = String(key || '').normalize('NFC').trim().toLowerCase();
  if (Array.from(k).length < 12) return '관리자 키는 12자 이상이어야 합니다.';
  if (WEAK_KEYS.indexOf(k) >= 0 || /^change-?me/.test(k)) return '예시로 쓰인 관리자 키는 쓸 수 없습니다. 새로 만들어 주세요.';
  var seen = {}; Array.from(k).forEach(function (ch) { seen[ch] = 1; });
  if (Object.keys(seen).length < 4) return '같은 글자가 반복된 키는 쓸 수 없습니다.';
  return null;
}
function isAdmin(key) {
  var h = PropertiesService.getScriptProperties().getProperty('ADMIN_HASH');
  return !!(h && typeof key === 'string' && key.length > 0 && key.length <= 200 && hashEqual(sha256hex(key), h));
}
/** H4: a sent admin key is checked here. Wrong keys are counted in CacheService (10-minute windows); after
 *  AUTH_FAILS every admin call answers 429 — the right key too, so guessing learns nothing. */
function adminOk(key) {
  if (key == null || key === '') return false;
  var cache = CacheService.getScriptCache(); var win = Math.floor(Date.now() / 600000); var k = 'af:' + win;
  var n = Number(cache.get(k) || 0);
  if (n >= AUTH_FAILS) throw httpErr(429, 'rate_limited', '관리자 키가 여러 번 틀려 잠시 막았어요. 몇 분 뒤에 다시 해 주세요.', { retryAfter: Math.max(1, Math.ceil(((win + 1) * 600000 - Date.now()) / 1000)) });
  if (isAdmin(key)) return true;
  cache.put(k, String(n + 1), 900);
  return false;
}
function requireAdmin(key) { if (!adminOk(key)) throw httpErr(key ? 403 : 401, 'admin_required', '관리자 키가 필요합니다.'); }
function reservedNick(n) {
  var s = String(n || '').normalize('NFKC').toLowerCase().replace(/[\s._\-·*~!?()[\]{}'"`:;,/\\|]+/g, '');
  return RESERVED.indexOf(s) >= 0;
}
function cleanNick(v, required) {
  var s = cleanText(v, LIMITS.nickname, 'nickname', { required: !!required });
  if (s && reservedNick(s)) throw httpErr(400, 'reserved_nickname', '이 별명은 쓸 수 없어요(강사·운영자용). 다른 별명을 골라 주세요.');
  return s;
}
function stamp() {
  var p = PropertiesService.getScriptProperties();
  var t = Math.max(Date.now(), Number(p.getProperty('STAMP') || 0) + 1);
  p.setProperties({ STAMP: String(t), LAST_AT: String(Date.now()) });
  return t;
}
function uid(prefix) { return prefix + Utilities.getUuid().replace(/-/g, '').slice(0, 18); }
function rateHit(bucket, who, max) {
  var cache = CacheService.getScriptCache();
  var k = 'rl:' + bucket + ':' + who + ':' + Math.floor(Date.now() / 60000);
  var n = Number(cache.get(k) || 0) + 1;
  cache.put(k, String(n), 120);
  if (n > max) throw httpErr(429, 'rate_limited', '잠시 후 다시 시도해 주세요.', { retryAfter: 60 - Math.floor((Date.now() / 1000) % 60) });
}
var CTRL_ML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​‌‎‏‪-‮⁦-⁩﻿]/g;
var CTRL_SL = /[\u0000-\u001F\u007F​‌‎‏‪-‮⁦-⁩﻿]/g;
function cleanText(v, max, field, opt) {
  opt = opt || {};
  if (v == null) v = '';
  if (typeof v !== 'string' && typeof v !== 'number') throw httpErr(400, 'invalid_type', field + ': 글자여야 합니다.');
  var s = String(v).replace(/\r\n?/g, '\n').normalize('NFC');
  s = s.replace(opt.multiline ? CTRL_ML : CTRL_SL, opt.multiline ? '' : ' ').trim();
  s = opt.multiline ? s.replace(/\n{4,}/g, '\n\n\n') : s.replace(/\s{2,}/g, ' ');
  if (opt.required && !s) throw httpErr(400, 'required', field + ': 비어 있습니다.');
  if (Array.from(s).length > max) throw httpErr(400, 'too_long', field + ': ' + max + '자 이하로 써 주세요.');
  return s;
}
function cleanEnum(v, list, field, dflt) {
  if (v == null || v === '') { if (dflt !== undefined) return dflt; throw httpErr(400, 'required', field + ': 비어 있습니다.'); }
  if (list.indexOf(v) < 0) throw httpErr(400, 'invalid_value', field + ': ' + list.join('|'));
  return v;
}
function cleanBool(v, field, dflt) { if (v == null) return dflt; if (typeof v !== 'boolean') throw httpErr(400, 'invalid_type', field + ': true/false'); return v; }
function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function driveUrl(id, type) { return type.indexOf('image/') === 0 ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600' : 'https://drive.google.com/file/d/' + id + '/view'; }
function driveId(f) {
  if (isObj(f) && typeof f.id === 'string' && /^[A-Za-z0-9_-]{10,100}$/.test(f.id)) return f.id;
  var m = /^https:\/\/drive\.google\.com\/(?:thumbnail\?id=|file\/d\/)([A-Za-z0-9_-]{10,100})(?:[&/][^\s<>"]*)?$/.exec(String((f && f.url) || ''));
  return m ? m[1] : null;
}
/** M7: only Drive files this script created for this participant and training, not used by another post.
 *  The URL is rebuilt from the file id (never an outside address). */
function cleanFiles(v, code, me, postId) {
  if (v == null) return [];
  if (!Array.isArray(v) || v.length > 5) throw httpErr(400, 'invalid_value', 'files: 5개까지');
  var seen = {};
  return v.map(function (f) {
    if (!isObj(f) || !UPLOAD_TYPES[f.type]) throw httpErr(415, 'unsupported_type', '이미지·PDF·MP3·MP4만 올릴 수 있어요.');
    var id = driveId(f);
    var rec = id && !seen[id] && me ? rows('files').filter(function (r) { return r.id === id && r.code === code && r.by === me.id; })[0] : null;
    if (!rec || (rec.post && rec.post !== postId)) throw httpErr(400, 'invalid_value', 'files: 이 연수에 내가 올린 파일만 붙일 수 있어요.');
    seen[id] = 1;
    var type = UPLOAD_TYPES[rec.type] ? rec.type : f.type;
    return { id: id, url: driveUrl(id, type), name: cleanText(f.name, 120, 'files.name'), type: type, size: typeof f.size === 'number' ? Math.max(0, Math.floor(f.size)) : 0 };
  });
}
function uploadsOn(code) {
  var p = PropertiesService.getScriptProperties();
  return p.getProperty('UPLOADS') === 'on' && (getState(code).ui || {}).uploads !== false;
}
function moderated(code) {
  return PropertiesService.getScriptProperties().getProperty('MODERATION') === 'on' || (getState(code).ui || {}).moderation === true;
}
/** H3: Drive sharing follows the post — link-shared while visible, private while hidden, trashed when removed. */
function shareFiles(code, postId, files, visible) {
  (files || []).forEach(function (f) {
    var id = driveId(f); if (!id) return;
    var rec = rows('files').filter(function (r) { return r.id === id && r.code === code; })[0];
    if (!rec) return;
    if (postId && rec.post !== postId) { rec.post = postId; writeRow('files', rec); }
    try {
      var file = DriveApp.getFileById(id);
      if (visible) file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      else file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    } catch (e) { console.error('lecpage share: ' + (e && e.message)); }
  });
}
function trashFiles(ids) {
  var gone = {};
  (ids || []).forEach(function (id) { if (!id || gone[id]) return; gone[id] = 1; try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { /* already gone */ } });
  if (!Object.keys(gone).length) return;
  var sh = sheet('files');
  rows('files').filter(function (r) { return gone[r.id]; }).map(function (r) { return r._row; }).sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); });
  delete memo.files;
}
function cleanValue(v) {
  if (Array.isArray(v)) {
    if (!v.length || v.length > 5) throw httpErr(400, 'invalid_value', 'value: 1~5개');
    return v.map(function (x) { return typeof x === 'number' ? x : cleanText(x, LIMITS.answer, 'value', { required: true }); });
  }
  if (typeof v === 'number' && isFinite(v)) return v;
  return cleanText(v, LIMITS.answer, 'value', { required: true });
}
function cleanSurvey(v) {
  if (!isObj(v)) throw httpErr(400, 'invalid_type', 'answers: 객체');
  var keys = Object.keys(v); if (keys.length > 50) throw httpErr(400, 'too_many', 'answers');
  var o = {};
  keys.forEach(function (k) {
    var key = cleanText(k, 64, 'answers.key', { required: true }); var x = v[k];
    if (x == null) return;
    if (typeof x === 'boolean' || (typeof x === 'number' && isFinite(x))) o[key] = x;
    else if (Array.isArray(x)) o[key] = x.slice(0, 20).map(function (y) { return cleanText(y, 100, key); });
    else o[key] = cleanText(x, 1000, key, { multiline: true });
  });
  return o;
}

// ---------------------------------------------------------------- sheet storage
var memo = {};
function sheet(col) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(col);
  if (!sh) { setup(); sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(col); }
  return sh;
}
function rows(col) {
  if (memo[col]) return memo[col];
  var sh = sheet(col); var head = headerOf(col);
  var n = sh.getLastRow();
  var vals = n > 1 ? sh.getRange(2, 1, n - 1, head.length).getValues() : [];
  memo[col] = vals.map(function (r, i) {
    var o = { _row: i + 2 };
    head.forEach(function (h, j) { o[h] = decodeCell(h, r[j]); });
    return o;
  }).filter(function (o) { return o.id || o.col; });
  return memo[col];
}
function decodeCell(h, v) {
  if (typeof v === 'string' && /^'[=+\-@]/.test(v)) v = v.slice(1);
  var t = TYPES[h];
  if (t === 'n') return v === '' || v == null ? null : Number(v);
  if (t === 'b') return v === true || v === 'TRUE' || v === 'true';
  if (t === 'j') { if (v === '' || v == null) return null; try { return JSON.parse(v); } catch (e) { return null; } }
  return v === null || v === undefined ? '' : String(v);
}
function encodeCell(h, v) {
  if (v == null) return '';
  if (TYPES[h] === 'j') return JSON.stringify(v);
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v; // never let user text become a formula
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return typeof v === 'number' ? String(v) : v;
}
function writeRow(col, doc) {
  var sh = sheet(col); var head = headerOf(col);
  var line = head.map(function (h) { return encodeCell(h, doc[h]); });
  if (doc._row) sh.getRange(doc._row, 1, 1, head.length).setValues([line]);
  else { sh.appendRow(line); doc._row = sh.getLastRow(); if (memo[col]) memo[col].push(doc); }
  return doc;
}
var OWN_BY = { answers: 1, progress: 1, help: 1 };
/** viewer: the reading participant — answers/progress/help keep `by` only on the reader's own docs (L3). */
function out(col, d, admin, viewer) {
  var o = { id: d.id, createdAt: d.createdAt, updatedAt: d.updatedAt };
  FIELDS[col].forEach(function (f) { o[f] = d[f]; });
  if (d.by && col !== 'questions' && col !== 'participants' && (admin || !OWN_BY[col] || (viewer && d.by === viewer))) o.by = d.by;
  if (d.cid) o.cid = d.cid;
  if (!admin) {
    if (col === 'questions' && o.status === 'hidden') o.text = '';
    if (col === 'posts' && o.hidden) { o.text = ''; o.files = []; }
    if (col === 'chat' && o.hidden) o.text = '';
  }
  if (col === 'posts' && !o.files) o.files = [];
  if (col === 'polls' && !o.options) o.options = [];
  return o;
}
function participant(code, token) {
  if (!token || String(token).length > 200) throw httpErr(401, 'invalid_token', '참여 정보가 없어요. 다시 참여해 주세요.');
  var h = sha256hex(token);
  var p = rows('participants').filter(function (r) { return r.key === h && r.code === code; })[0];
  if (!p) throw httpErr(401, 'invalid_token', '참여 정보가 없어요. 다시 참여해 주세요.');
  return p;
}
function invalidate() { CacheService.getScriptCache().remove('snap'); memo = {}; }
function getState(code) {
  var raw = PropertiesService.getScriptProperties().getProperty('STATE:' + code);
  var base = { step: null, slide: 0, follow: false, timer: null, notice: null, openPoll: null, ui: {}, updatedAt: 0 };
  if (raw) { try { var s = JSON.parse(raw); for (var k in s) base[k] = s[k]; } catch (e) { /* ignore */ } }
  return base;
}

// ---------------------------------------------------------------- actions
function join(b) {
  var code = normCode(b.code, true);
  var nickname = cleanNick(b.nickname) || '참가자';
  var name = cleanText(b.name, LIMITS.name, 'name'); var school = cleanText(b.school, LIMITS.school, 'school');
  if ((name || school) && b.consent !== true) throw httpErr(400, 'consent_required', '이름·소속을 남기려면 개인정보 수집에 동의해야 합니다.');
  rateHit('join', code, RATE.join);
  if (rows('participants').filter(function (r) { return r.code === code; }).length >= MAX_PARTICIPANTS) throw httpErr(403, 'room_full', '참가 인원이 가득 찼어요. 강사에게 알려 주세요.');
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  var now = stamp();
  var d = { id: uid('p'), code: code, by: '', key: sha256hex(token), createdAt: now, updatedAt: now, nickname: nickname, name: name, school: school, consentAt: b.consent === true ? now : null };
  d.by = d.id;
  writeRow('participants', d);
  return { id: d.id, token: token, nickname: nickname };
}
function snapshot(b) {
  var code = normCode(b.code);
  var since = Math.max(0, Number(b.since) || 0);
  var admin = adminOk(b.admin);
  if (admin) normCode(code, true);
  var cache = CacheService.getScriptCache();
  var full = null;
  if (!admin) { var c = cache.get('snap'); if (c) { try { full = JSON.parse(c); } catch (e) { full = null; } } }
  if (!full || full.code !== code) {
    // Reads take no lock, so a write may land between reading STAMP and reading rows: the cursor handed out
    // overlaps the last 5 s (the client dedupes by id/updatedAt), so nothing is skipped.
    full = { code: code, now: Math.max(0, Number(PropertiesService.getScriptProperties().getProperty('STAMP') || 0) - 5000), cols: {}, tomb: [] };
    (admin ? COLS : PUBLIC_COLS).forEach(function (col) { full.cols[col] = rows(col).filter(function (r) { return r.code === code; }).map(function (r) { return out(col, r, admin); }); });
    full.tomb = rows('tombstones').filter(function (t) { return t.code === code; }).map(function (t) { return { col: t.col, id: t.id, at: Number(t.at) }; });
    if (!admin) { var s = JSON.stringify(full); if (s.length < 90000) cache.put('snap', s, 4); }
  }
  var res = { state: getState(code), now: full.now, time: Date.now(), since: since, full: since === 0, removed: [], epoch: PropertiesService.getScriptProperties().getProperty('EPOCH') || '0' };
  Object.keys(full.cols).forEach(function (col) { res[col] = full.cols[col].filter(function (d) { return d.updatedAt > since; }); });
  if (res.chat && res.chat.length > 500) res.chat = res.chat.slice(-500);
  if (since) res.removed = full.tomb.filter(function (t) { return t.at > since; }).map(function (t) { return { col: t.col, id: t.id }; });
  if (!admin && b.token) {
    try {
      var me = participant(code, b.token);
      ['attendance', 'survey'].forEach(function (col) { res[col] = rows(col).filter(function (r) { return r.code === code && r.by === me.id && r.updatedAt > since; }).map(function (r) { return out(col, r, false, me.id); }); });
      ['answers', 'progress', 'help'].forEach(function (col) {
        var mine = {}; rows(col).forEach(function (r) { if (r.code === code && r.by === me.id) mine[r.id] = 1; });
        (res[col] || []).forEach(function (d) { if (mine[d.id]) d.by = me.id; });
      });
      res.me = { id: me.id, nickname: me.nickname };
    } catch (e) { /* not joined */ }
  }
  // reactions use their own cursor (b.rs = last `reactionsAt` the client saw), so the overlap above never replays them
  var rs = Number(b.rs) || 0; var all = JSON.parse(cache.get('react:' + code) || '[]');
  var rx = all.filter(function (r) { return r.w > rs; });
  res.reactionsAt = all.length ? all[all.length - 1].w : rs;
  if (rx.length) { var agg = {}; rx.forEach(function (r) { agg[r.e] = (agg[r.e] || 0) + 1; }); res.reactions = Object.keys(agg).map(function (e) { return { emoji: e, count: agg[e] }; }); }
  return res;
}
function add(b) {
  var code = normCode(b.code); var col = b.col; var doc = b.doc;
  if (COLS.indexOf(col) < 0 || col === 'participants') throw httpErr(404, 'unknown_collection', '없는 컬렉션입니다.');
  if (!isObj(doc)) throw httpErr(400, 'invalid_body', '본문이 JSON 객체가 아닙니다.');
  var me = null;
  if (col === 'polls') { requireAdmin(b.admin); normCode(code, true); }
  else { me = participant(code, b.token); rateHit('write', me.id, RATE.write); if (RATE[col]) rateHit(col, me.id, RATE[col]); }
  var cid = doc.cid == null ? '' : cleanText(doc.cid, LIMITS.cid, 'cid');
  var by = me ? me.id : '';
  if (cid) { var dup = rows(col).filter(function (r) { return r.code === code && r.by === by && r.cid === cid; })[0]; if (dup) return out(col, dup, true); }
  var d = {};
  var key = '';
  switch (col) {
    case 'attendance': d.kind = cleanEnum(doc.kind, ['in', 'out'], 'kind'); key = by + '|' + d.kind; break;
    case 'progress': d.station = cleanText(doc.station, LIMITS.id, 'station', { required: true }); d.status = cleanEnum(doc.status, ['doing', 'done', 'stuck'], 'status'); key = by + '|' + d.station; break;
    case 'help': d = { station: cleanText(doc.station, LIMITS.id, 'station'), seat: cleanText(doc.seat, LIMITS.seat, 'seat'), message: cleanText(doc.message, LIMITS.help, 'message', { multiline: true }), nickname: me.nickname, status: 'open', assignee: '' }; break;
    case 'questions': {
      var anon = cleanBool(doc.anonymous, 'anonymous', true);
      d = { text: cleanText(doc.text, LIMITS.question, 'text', { required: true, multiline: true }), anonymous: anon, nickname: anon ? '' : me.nickname, votes: 0, status: 'open', pinned: false };
      break;
    }
    case 'posts':
      d = { kind: cleanText(doc.kind || 'post', LIMITS.kind, 'kind'), text: cleanText(doc.text, LIMITS.post, 'text', { multiline: true }), files: cleanFiles(doc.files, code, me, ''), license: cleanText(doc.license, LIMITS.license, 'license'), nickname: me.nickname, likes: 0, hidden: moderated(code) };
      if (!d.text && !d.files.length) throw httpErr(400, 'required', 'text 또는 files가 필요합니다.');
      if (d.files.length && !uploadsOn(code)) throw httpErr(403, 'uploads_disabled', '이 연수는 파일 올리기를 쓰지 않습니다.');
      break;
    case 'polls': {
      if (doc.options != null && (!Array.isArray(doc.options) || doc.options.length > 20)) throw httpErr(400, 'invalid_value', 'options: 20개까지');
      d = { question: cleanText(doc.question, LIMITS.pollQuestion, 'question', { required: true }), kind: cleanEnum(doc.kind, ['choice', 'word', 'scale'], 'kind', 'choice'), options: (doc.options || []).map(function (o) { return cleanText(o, LIMITS.option, 'options', { required: true }); }), open: cleanBool(doc.open, 'open', false) };
      break;
    }
    case 'answers': {
      d = { poll: cleanText(doc.poll, LIMITS.id, 'poll', { required: true }), value: cleanValue(doc.value) }; key = d.poll + '|' + by;
      var poll = rows('polls').filter(function (r) { return r.code === code && r.id === d.poll; })[0];
      if (poll && poll.open === false) throw httpErr(409, 'poll_closed', '투표가 닫혔어요.');
      break;
    }
    case 'survey': d = { answers: cleanSurvey(doc.answers) }; key = by; break;
    case 'chat': d = { text: cleanText(doc.text, LIMITS.chat, 'text', { required: true, multiline: true }), nickname: me.nickname, hidden: false }; break;
  }
  var now = stamp();
  if (col === 'attendance' || col === 'progress') d.at = now;
  var existing = key ? rows(col).filter(function (r) { return r.code === code && r.key === key; })[0] : null;
  if (existing) {
    Object.keys(d).forEach(function (k) { existing[k] = d[k]; });
    existing.updatedAt = now; existing.cid = cid;
    writeRow(col, existing);
    return out(col, existing, true);
  }
  var row = { id: uid(col.charAt(0)), code: code, by: by, key: key, cid: cid, createdAt: now, updatedAt: now };
  Object.keys(d).forEach(function (k) { row[k] = d[k]; });
  writeRow(col, row);
  if (col === 'posts' && row.files && row.files.length) shareFiles(code, row.id, row.files, !row.hidden);
  return out(col, row, true);
}
var OWNER_PATCH = { participants: ['nickname'], progress: ['status'], help: ['station', 'seat', 'message', 'status'], questions: ['text'], posts: ['kind', 'text', 'files', 'license'], answers: ['value'], survey: ['answers'] };
var ADMIN_PATCH = { participants: ['nickname'], help: ['status', 'assignee'], questions: ['status', 'pinned', 'text'], posts: ['hidden', 'text'], polls: ['question', 'kind', 'options', 'open'], chat: ['hidden'], progress: ['status'] };
function update(b) {
  var code = normCode(b.code); var col = b.col;
  if (COLS.indexOf(col) < 0) throw httpErr(404, 'unknown_collection', '없는 컬렉션입니다.');
  if (!isObj(b.patch)) throw httpErr(400, 'invalid_body', '본문이 JSON 객체가 아닙니다.');
  var admin = adminOk(b.admin);
  if (b.admin && !admin) throw httpErr(403, 'admin_required', '관리자 키가 필요합니다.');
  var cur = rows(col).filter(function (r) { return r.code === code && r.id === b.id; })[0];
  if (!cur) throw httpErr(404, 'not_found', '없는 글입니다.');
  var owner = false;
  if (!admin) {
    var me = participant(code, b.token); rateHit('write', me.id, RATE.write);
    owner = col === 'participants' ? cur.id === me.id : cur.by === me.id;
    if (!owner) throw httpErr(403, 'forbidden', '내 글만 고칠 수 있어요.');
    if ((col === 'questions' && cur.status === 'hidden') || ((col === 'posts' || col === 'chat') && cur.hidden)) throw httpErr(403, 'forbidden', '숨겨진 글은 고칠 수 없어요.');
    // L1: an answer cannot change once its poll is closed (same rule as a new answer)
    if (col === 'answers') { var poll = rows('polls').filter(function (r) { return r.code === code && r.id === cur.poll; })[0]; if (poll && poll.open === false) throw httpErr(409, 'poll_closed', '투표가 닫혔어요.'); }
  }
  var oldFiles = col === 'posts' ? (cur.files || []).slice() : null; var wasHidden = !!cur.hidden;
  var allowed = (admin ? ADMIN_PATCH[col] : OWNER_PATCH[col]) || [];
  var p = b.patch; var changed = 0;
  Object.keys(p).forEach(function (k) {
    if (allowed.indexOf(k) < 0) return;
    var v = p[k]; changed++;
    switch (col + '.' + k) {
      case 'participants.nickname': cur.nickname = admin ? cleanText(v, LIMITS.nickname, k, { required: true }) : cleanNick(v, true); break;
      case 'progress.status': cur.status = cleanEnum(v, ['doing', 'done', 'stuck'], k); break;
      case 'help.station': cur.station = cleanText(v, LIMITS.id, k); break;
      case 'help.seat': cur.seat = cleanText(v, LIMITS.seat, k); break;
      case 'help.message': cur.message = cleanText(v, LIMITS.help, k, { multiline: true }); break;
      case 'help.status': cur.status = cleanEnum(v, admin ? ['open', 'claimed', 'done'] : ['open', 'done'], k); break;
      case 'help.assignee': cur.assignee = cleanText(v, LIMITS.assignee, k); break;
      case 'questions.text': cur.text = cleanText(v, LIMITS.question, k, { required: true, multiline: true }); break;
      case 'questions.status': cur.status = cleanEnum(v, ['open', 'answered', 'hidden'], k); break;
      case 'questions.pinned': case 'posts.hidden': case 'polls.open': case 'chat.hidden': cur[k] = cleanBool(v, k, false); break;
      case 'posts.kind': cur.kind = cleanText(v, LIMITS.kind, k, { required: true }); break;
      case 'posts.text': cur.text = cleanText(v, LIMITS.post, k, { multiline: true }); break;
      case 'posts.files': cur.files = cleanFiles(v, code, me, cur.id); if (cur.files.length && !uploadsOn(code)) throw httpErr(403, 'uploads_disabled', '이 연수는 파일 올리기를 쓰지 않습니다.'); break;
      case 'posts.license': cur.license = cleanText(v, LIMITS.license, k); break;
      case 'polls.question': cur.question = cleanText(v, LIMITS.pollQuestion, k, { required: true }); break;
      case 'polls.kind': cur.kind = cleanEnum(v, ['choice', 'word', 'scale'], k); break;
      case 'polls.options': if (!Array.isArray(v) || v.length > 20) throw httpErr(400, 'invalid_value', k); cur.options = v.map(function (o) { return cleanText(o, LIMITS.option, k, { required: true }); }); break;
      case 'answers.value': cur.value = cleanValue(v); break;
      case 'survey.answers': cur.answers = cleanSurvey(v); break;
      default: changed--;
    }
  });
  if (!changed) throw httpErr(400, 'nothing_to_update', '바꿀 수 있는 항목이 없습니다.');
  cur.updatedAt = stamp();
  writeRow(col, cur);
  if (col === 'posts') {
    var keep = {}; (cur.files || []).forEach(function (f) { var id = driveId(f); if (id) keep[id] = 1; });
    trashFiles((oldFiles || []).map(driveId).filter(function (id) { return id && !keep[id]; }));
    if (!!cur.hidden !== wasHidden || 'files' in p) shareFiles(code, cur.id, cur.files, !cur.hidden);
  }
  return out(col, cur, true);
}
function remove(b) {
  var code = normCode(b.code); var col = b.col;
  requireAdmin(b.admin);
  if (COLS.indexOf(col) < 0) throw httpErr(404, 'unknown_collection', '없는 컬렉션입니다.');
  var cur = rows(col).filter(function (r) { return r.code === code && r.id === b.id; })[0];
  if (!cur) throw httpErr(404, 'not_found', '없는 글입니다.');
  if (col === 'posts') trashFiles((cur.files || []).map(driveId).concat(rows('files').filter(function (r) { return r.code === code && r.post === cur.id; }).map(function (r) { return r.id; })));
  sheet(col).deleteRow(cur._row);
  writeRow('tombstones', { col: col, id: cur.id, code: code, at: stamp() });
  return { ok: true };
}
function vote(b, col, field) {
  var code = normCode(b.code);
  var me = participant(code, b.token); rateHit('vote', me.id, RATE.vote);
  var cur = rows(col).filter(function (r) { return r.code === code && r.id === b.id; })[0];
  if (!cur) throw httpErr(404, 'not_found', '없는 글입니다.');
  if (col === 'questions' && cur.status === 'hidden') throw httpErr(409, 'hidden', '숨겨진 질문입니다.');
  var already = rows('votes').some(function (v) { return v.col === col && v.doc === cur.id && v.by === me.id; });
  var r = {};
  if (already) { r[field] = Number(cur[field]) || 0; r.voted = true; r.already = true; return r; }
  writeRow('votes', { col: col, doc: cur.id, by: me.id, code: code });
  cur[field] = rows('votes').filter(function (v) { return v.col === col && v.doc === cur.id; }).length;
  cur.updatedAt = stamp();
  writeRow(col, cur);
  r[field] = cur[field]; r.voted = true; return r;
}
function setState(b) {
  var code = normCode(b.code); var p = b.patch;
  requireAdmin(b.admin);
  normCode(code, true);
  if (!isObj(p)) throw httpErr(400, 'invalid_body', '본문이 JSON 객체가 아닙니다.');
  var cur = getState(code); var n = 0;
  if ('step' in p) { cur.step = p.step == null ? null : typeof p.step === 'number' ? Math.trunc(p.step) : cleanText(p.step, LIMITS.id, 'step'); n++; }
  if ('slide' in p) { if (typeof p.slide !== 'number' || p.slide < 0) throw httpErr(400, 'invalid_value', 'slide'); cur.slide = Math.trunc(p.slide); n++; }
  if ('follow' in p) { cur.follow = cleanBool(p.follow, 'follow', false); n++; }
  if ('timer' in p) {
    var t = p.timer; n++;
    if (t == null) cur.timer = null;
    else if (!isObj(t)) throw httpErr(400, 'invalid_type', 'timer');
    else cur.timer = { endsAt: typeof t.endsAt === 'number' ? Math.trunc(t.endsAt) : null, label: cleanText(t.label, LIMITS.timerLabel, 'timer.label'), running: cleanBool(t.running, 'timer.running', false), remaining: typeof t.remaining === 'number' ? Math.trunc(t.remaining) : null };
  }
  if ('notice' in p) {
    var no = p.notice; n++;
    if (no == null) cur.notice = null;
    else if (!isObj(no)) throw httpErr(400, 'invalid_type', 'notice');
    else { var text = cleanText(no.text, LIMITS.notice, 'notice.text', { multiline: true }); cur.notice = text ? { text: text, level: cleanEnum(no.level, ['info', 'warn', 'success', 'danger'], 'notice.level', 'info') } : null; }
  }
  if ('openPoll' in p) { cur.openPoll = p.openPoll == null || p.openPoll === '' ? null : cleanText(p.openPoll, LIMITS.id, 'openPoll'); n++; }
  if ('ui' in p) {
    if (!isObj(p.ui) || Object.keys(p.ui).length > 20) throw httpErr(400, 'invalid_value', 'ui');
    cur.ui = cur.ui || {}; n++;
    Object.keys(p.ui).forEach(function (k) { var v = p.ui[k]; if (v == null) delete cur.ui[k]; else cur.ui[cleanText(k, 32, 'ui.key', { required: true })] = typeof v === 'string' ? cleanText(v, 200, k) : (typeof v === 'number' || typeof v === 'boolean' ? v : null); });
  }
  if (!n) throw httpErr(400, 'nothing_to_update', '바꿀 상태가 없습니다.');
  cur.updatedAt = stamp();
  PropertiesService.getScriptProperties().setProperty('STATE:' + code, JSON.stringify(cur));
  return cur;
}
function react(b) {
  var code = normCode(b.code);
  if (EMOJIS.indexOf(b.emoji) < 0) throw httpErr(400, 'invalid_value', 'emoji');
  var me = participant(code, b.token); rateHit('react', me.id, RATE.react);
  var cache = CacheService.getScriptCache(); var k = 'react:' + code;
  var list = JSON.parse(cache.get(k) || '[]').filter(function (r) { return Date.now() - r.w < 60000; }).slice(-200);
  var w = Math.max(Date.now(), list.length ? list[list.length - 1].w + 1 : 0);
  list.push({ e: b.emoji, w: w });
  cache.put(k, JSON.stringify(list), 120);
  return { ok: true };
}
function upload(b) {
  var props = PropertiesService.getScriptProperties();
  var code = normCode(b.code);
  if (!uploadsOn(code)) throw httpErr(503, 'uploads_disabled', '이 시트는 파일 올리기를 쓰지 않습니다.');
  var me = participant(code, b.token); rateHit('upload', me.id, RATE.upload);
  var ext = UPLOAD_TYPES[b.type];
  if (!ext) throw httpErr(415, 'unsupported_type', '이미지·PDF·MP3·MP4만 올릴 수 있어요.');
  var bytes = Utilities.base64Decode(String(b.data || ''));
  var maxMb = Number(props.getProperty('MAX_UPLOAD_MB') || 10);
  if (!bytes.length) throw httpErr(400, 'empty', '빈 파일입니다.');
  if (bytes.length > maxMb * 1048576) throw httpErr(413, 'too_large', '파일은 ' + maxMb + 'MB까지 올릴 수 있어요.');
  var head = bytes.slice(0, 12).map(function (x) { return x < 0 ? x + 256 : x; });
  if (sniff(head) !== b.type) throw httpErr(415, 'unsupported_type', '파일 내용이 형식과 맞지 않아요.');
  var it = DriveApp.getFoldersByName('lecpage 업로드');
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder('lecpage 업로드');
  var name = cleanText(b.name || 'file', 120, 'name').replace(/[\\/:*?"<>|]/g, '_');
  // private until a visible post uses it (shareFiles); recorded so wipe/clean-up can trash it (H3)
  var file = folder.createFile(Utilities.newBlob(bytes, b.type, name));
  var id = file.getId();
  withLock(function () { writeRow('files', { id: id, code: code, by: me.id, post: '', type: b.type, createdAt: Date.now() }); });
  return { id: id, url: driveUrl(id, b.type), name: name, type: b.type, size: bytes.length };
}
function sniff(b) {
  var at = function (i, xs) { return xs.every(function (x, j) { return b[i + j] === x; }); };
  if (at(0, [0x89, 0x50, 0x4e, 0x47])) return 'image/png';
  if (at(0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (at(0, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return 'image/webp';
  if (at(0, [0x25, 0x50, 0x44, 0x46])) return 'application/pdf';
  if (at(0, [0x49, 0x44, 0x33]) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  if (at(4, [0x66, 0x74, 0x79, 0x70])) return 'video/mp4';
  return null;
}
function exportCsv(b) {
  var code = normCode(b.code);
  requireAdmin(b.admin);
  var kinds = ['attendance', 'progress', 'questions', 'survey', 'participants', 'posts', 'help', 'chat', 'answers'];
  if (kinds.indexOf(b.kind) < 0) throw httpErr(400, 'bad_kind', 'kind: ' + kinds.join('|'));
  var data = {};
  COLS.forEach(function (c) { data[c] = rows(c).filter(function (r) { return r.code === code; }).map(function (r) { var o = out(c, r, true); o.by = r.by; return o; }); });
  var t = exportTable(b.kind, data);
  return toCsv(t.columns, t.rows);
}
function wipeAll() {
  trashFiles(rows('files').map(function (r) { return r.id; }));
  COLS.concat(['tombstones', 'votes', 'files']).forEach(function (c) {
    var sh = sheet(c); var n = sh.getLastRow();
    if (n > 1) sh.deleteRows(2, n - 1);
  });
  var p = PropertiesService.getScriptProperties();
  p.getKeys().forEach(function (k) { if (k.indexOf('STATE:') === 0) p.deleteProperty(k); });
  p.setProperty('EPOCH', String(Date.now())); // polling clients see a new epoch and reset their store
  memo = {};
}

// ---- CSV (same layout as backends/*/protocol.js exportTable) ----
function fmtTime(ms) { return ms ? Utilities.formatDate(new Date(Number(ms)), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss') : ''; }
var STATUS_KO = { doing: '하는 중', done: '완료', stuck: '도움 요청', open: '대기', claimed: '가는 중', answered: '답변함', hidden: '숨김' };
function uniq(a) { var s = {}; return a.filter(function (x) { if (s[x]) return false; s[x] = 1; return true; }); }
function exportTable(kind, data) {
  var t = fmtTime; var P = data.participants || []; var people = {}; P.forEach(function (p) { people[p.id] = p; });
  var nick = function (id) { return (people[id] || {}).nickname || ''; };
  switch (kind) {
    case 'participants': return { columns: ['별명', '이름', '소속', '참여 시각', '동의 시각'], rows: P.map(function (p) { return [p.nickname, p.name, p.school, t(p.createdAt), t(p.consentAt)]; }) };
    case 'attendance': {
      var m = {}; (data.attendance || []).forEach(function (a) { (m[a.by] = m[a.by] || {})[a.kind] = a.at || a.createdAt; });
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
  }
  return { columns: [], rows: [] };
}
function toCsv(columns, rowsList) {
  var cell = function (v) {
    if (v == null) return '';
    var s = Array.isArray(v) ? v.join(' / ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  return '﻿' + [columns].concat(rowsList).map(function (r) { return r.map(cell).join(','); }).join('\r\n') + '\r\n';
}
