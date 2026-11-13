// lecpage live — HTTP protocol v1 shared server core.
//
// Used by both servers that speak protocol v1:
//   backends/node-server/lib/protocol.js   (Node ≥22, node:sqlite)
//   backends/cloudflare/src/protocol.js    (Cloudflare Durable Object, SQLite storage)
// The two files must stay byte-identical (engine/test/live-sync.test.mjs checks this).
// Edit one, then copy it over the other.
//
// No dependencies. Uses only Web Crypto, TextEncoder and Intl, which both runtimes provide.
// The host gives a tiny synchronous SQL facade: { all(sql, ...p), get(sql, ...p), run(sql, ...p), tx(fn) }.
// All SQL here is synchronous; every async step (hashing) happens before a read-modify-write
// section, so a single-threaded host never interleaves two writers inside one section.

export const PROTOCOL = 1;

export const COLS = ['participants', 'attendance', 'progress', 'help', 'questions', 'posts', 'polls', 'answers', 'survey', 'chat'];
/** Readable by anyone who knows the training code (snapshot & realtime). */
export const PUBLIC_COLS = ['questions', 'posts', 'help', 'progress', 'polls', 'answers', 'chat'];
/** Readable by the admin; a participant token reads only its own docs. */
export const PRIVATE_COLS = ['participants', 'attendance', 'survey'];
const PARTICIPANT_WRITE = new Set(['attendance', 'progress', 'help', 'questions', 'posts', 'answers', 'survey', 'chat']);

export const LIMITS = {
  nickname: 20, name: 40, school: 60, question: 500, post: 1000, chat: 300, help: 300,
  seat: 20, id: 64, kind: 32, label: 60, pollQuestion: 200, option: 100, options: 20,
  answer: 200, answerItems: 5, surveyKeys: 50, surveyValue: 1000, notice: 300, timerLabel: 40,
  fileName: 120, files: 5, license: 40, assignee: 20, cid: 40, uiKeys: 20, uiValue: 200,
};

/** [max hits, window ms]. Per participant token unless noted. Generous on purpose: one school = one NAT IP. */
export const RATE = {
  write: [90, 60e3], questions: [8, 60e3], help: [6, 60e3], posts: [12, 60e3], chat: [30, 60e3],
  vote: [120, 60e3], react: [90, 60e3], upload: [10, 60e3], admin: [600, 60e3],
  joinIp: [600, 600e3], ip: [6000, 60e3], joinCode: [1500, 600e3],
  // reads per IP (soft: a whole school polling through one NAT stays well below it)
  read: [6000, 60e3],
  // wrong admin keys / setup tokens: per (code, IP) and per IP, then 429 until the window ends
  authFail: [10, 600e3], authFailIp: [20, 600e3],
  // trainings auto-created per IP (single-teacher mode: a join or the console creates the code on first use)
  create: [30, 3600e3],
};
/** Per-training caps. Hosts may override them through config (maxParticipants, maxDocs). */
export const CAPS = { participants: 500, docs: 20000 };

// ---------- admin key policy ----------
/** Known example/default keys from our own docs and templates (compared after NFC + lower case). */
export const WEAK_KEYS = [
  'change-me', 'changeme', 'change-me-관리자키', 'change-me-admin-key', '관리자키', '관리자 키', '연수관리자키', '내관리자키', '관리자키-8자-이상',
  '여기에-관리자-키-8자-이상', 'admin', 'administrator', 'password', 'password1', 'password123', 'passw0rd', 'qwerty', 'qwerty123',
  '12345678', '123456789', '1234567890', '123456789012', 'lecpage', 'lecpage-admin', 'correct-horse-battery', 'secret', 'letmein',
];
export const MIN_KEY_LENGTH = 12;
const normKey = (k) => String(k == null ? '' : k).normalize('NFC').trim().toLowerCase();
/** Returns a Korean reason when an admin key / setup token is too weak, otherwise null. */
export function keyProblem(key) {
  const k = normKey(key);
  if ([...k].length < MIN_KEY_LENGTH) return `관리자 키는 ${MIN_KEY_LENGTH}자 이상이어야 합니다.`;
  if (WEAK_KEYS.includes(k) || /^change-?me/.test(k)) return '예시로 쓰인 관리자 키는 쓸 수 없습니다. 새로 만들어 주세요(예: openssl rand -hex 12).';
  if (new Set(k).size < 4) return '같은 글자가 반복된 키는 쓸 수 없습니다.';
  return null;
}
let weakHashes = null;
/** True when a SHA-256 hex digest is the hash of a known example key (hash-only configs and /init). */
export async function isWeakKeyHash(hash) {
  if (!weakHashes) {
    const all = new Set();
    for (const k of WEAK_KEYS) for (const v of [k, k.toUpperCase(), k.charAt(0).toUpperCase() + k.slice(1)]) all.add(await sha256hex(v));
    weakHashes = all;
  }
  return weakHashes.has(String(hash || '').toLowerCase());
}
/** Participant nicknames that would impersonate the instructor or the service. */
export const RESERVED_NICKNAMES = ['강사', '운영자', 'admin', 'lecpage'];
export function reservedNickname(n) {
  const s = String(n || '').normalize('NFKC').toLowerCase().replace(/[\s._\-·*~!?()[\]{}'"`:;,/\\|]+/g, '');
  return s === 'administrator' || RESERVED_NICKNAMES.some((r) => s === r || s === r + '님');
}
function cleanNickname(v, field = 'nickname', required = false) {
  const s = cleanText(v, LIMITS.nickname, field, { required });
  if (s && reservedNickname(s)) throw new HttpError(400, 'reserved_nickname', '이 별명은 쓸 수 없어요(강사·운영자용). 다른 별명을 골라 주세요.');
  return s;
}

/** Allowed upload types → extension. SVG/HTML are never accepted. */
export const UPLOAD_TYPES = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
  'application/pdf': 'pdf', 'audio/mpeg': 'mp3', 'video/mp4': 'mp4',
};
export const EMOJIS = ['👍', '❤️', '👏', '🎉', '😂', '😮', '🤔', '🙏', '🔥', '💯', '🙌', '😢', '✅', '❓', '💡'];
const HELP_STATUS = ['open', 'claimed', 'done'];
const Q_STATUS = ['open', 'answered', 'hidden'];
const NOTICE_LEVELS = ['info', 'warn', 'success', 'danger'];
const POLL_KINDS = ['choice', 'word', 'scale'];
const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;
const DAY = 864e5;

export class HttpError extends Error {
  constructor(status, code, message, extra) {
    super(message || code);
    this.status = status; this.code = code; this.extra = extra || null;
  }
}
const bad = (code, msg) => new HttpError(400, code, msg);

// ---------- small utils ----------
const enc = new TextEncoder();
export async function sha256hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(String(text)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
/** Constant-time compare of two hex digests (always walks 64 chars, no early exit). */
export function hashEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ 64 | b.length ^ 64;
  for (let i = 0; i < 64; i++) diff |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0);
  return diff === 0;
}
export function randomId(bytes = 12) {
  const a = new Uint8Array(bytes); crypto.getRandomValues(a);
  let s = ''; for (const b of a) s += b.toString(16).padStart(2, '0');
  return s;
}
export function randomToken() {
  const a = new Uint8Array(32); crypto.getRandomValues(a);
  let bin = ''; for (const b of a) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function normCode(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!CODE_RE.test(c)) throw new HttpError(400, 'bad_code', '연수 코드는 영문·숫자 3~40자입니다.');
  return c;
}
const len = (s) => [...s].length;
// invisible characters: controls, zero-width, bidi overrides (spoofing), Hangul fillers (blank nicknames), tag characters.
// Single-line text also turns \n \t into spaces. Combining marks: at most two in a row (stacked "zalgo" text covers the screen).
const CTRL_ML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B\u200C\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\u2800\u3164\uFE00-\uFE0E\uFEFF\uFFA0\uFFF9-\uFFFB]|\uDB40[\uDC00-\uDDEF]/g;
const CTRL_SL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B\u200C\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\u2800\u3164\uFE00-\uFE0E\uFEFF\uFFA0\uFFF9-\uFFFB\u0009\u000A\u000D]|\uDB40[\uDC00-\uDDEF]/g;
const COMB = /([\u0300-\u036F\u0483-\u0489\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]{2})[\u0300-\u036F\u0483-\u0489\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]+/g;

export function cleanText(v, max, field, { required = false, multiline = false } = {}) {
  if (v == null) v = '';
  if (typeof v !== 'string' && typeof v !== 'number') throw bad('invalid_type', `${field}: 글자여야 합니다.`);
  let s = String(v).replace(/\r\n?/g, '\n').normalize('NFC');
  s = s.replace(multiline ? CTRL_ML : CTRL_SL, (m) => (/[\t\n\r]/.test(m) ? ' ' : '')).replace(COMB, '$1').trim();
  if (multiline) s = s.replace(/\n{4,}/g, '\n\n\n');
  else s = s.replace(/\s{2,}/g, ' ');
  if (required && !s) throw bad('required', `${field}: 비어 있습니다.`);
  if (len(s) > max) throw new HttpError(400, 'too_long', `${field}: ${max}자 이하로 써 주세요.`, { field, max });
  return s;
}
const cleanId = (v, field, required = true) => cleanText(v, LIMITS.id, field, { required });
function cleanBool(v, field, dflt) {
  if (v == null) return dflt;
  if (typeof v !== 'boolean') throw bad('invalid_type', `${field}: true/false`);
  return v;
}
function cleanEnum(v, list, field, dflt) {
  if (v == null || v === '') { if (dflt !== undefined) return dflt; throw bad('required', `${field}: 비어 있습니다.`); }
  if (!list.includes(v)) throw bad('invalid_value', `${field}: ${list.join('|')}`);
  return v;
}
function cleanNum(v, field, min, max, { int = false, nullable = false } = {}) {
  if (v == null && nullable) return null;
  if (typeof v !== 'number' || !Number.isFinite(v)) throw bad('invalid_type', `${field}: 숫자`);
  const n = int ? Math.trunc(v) : v;
  if (n < min || n > max) throw bad('invalid_value', `${field}: ${min}~${max}`);
  return n;
}
function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
const FILE_NAME_RE = /^[a-f0-9]{24}\.(png|jpg|gif|webp|pdf|mp3|mp4)$/;
const FILE_PATH_RE = /^\/api\/([A-Z0-9][A-Z0-9_-]{2,39})\/files\/([a-f0-9]{24}\.(?:png|jpg|gif|webp|pdf|mp3|mp4))$/;
/** Board files may only point at this server's own uploads: `/api/<CODE>/files/<name>` (relative, or absolute with any
 *  origin — the origin is dropped). Stored canonical and relative, so a post can never point at another host. */
function cleanFileUrl(u) {
  const s = cleanText(u, 500, 'files.url', { required: true });
  let p = s;
  if (!s.startsWith('/')) {
    let url; try { url = new URL(s); } catch { throw bad('invalid_value', 'files.url: 이 서버에 올린 파일만 붙일 수 있어요.'); }
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.search || url.hash || url.username || url.password) throw bad('invalid_value', 'files.url: 이 서버에 올린 파일만 붙일 수 있어요.');
    p = url.pathname;
  }
  const m = FILE_PATH_RE.exec(p);
  if (!m) throw bad('invalid_value', 'files.url: 이 서버에 올린 파일만 붙일 수 있어요.');
  return `/api/${m[1]}/files/${m[2]}`;
}
/** '/api/CODE/files/<name>' (or an absolute URL with that path) → { code, name } | null. */
export function fileRef(u) {
  let p = String(u || '');
  if (!p.startsWith('/')) { try { p = new URL(p).pathname; } catch { return null; } }
  const m = FILE_PATH_RE.exec(p);
  return m ? { code: m[1], name: m[2] } : null;
}
/** Absolute URLs for this server's relative upload paths (per response; `origin` is the origin the reader used). */
export function absolutizeFiles(body, origin) {
  if (!origin || !body || typeof body !== 'object') return body;
  const fix = (d) => {
    if (d && Array.isArray(d.files)) d.files = d.files.map((f) => (f && typeof f.url === 'string' && f.url.startsWith('/api/') ? { ...f, url: origin + f.url } : f));
  };
  if (Array.isArray(body)) body.forEach(fix);
  else { fix(body); if (Array.isArray(body.posts)) body.posts.forEach(fix); }
  return body;
}
function cleanFiles(v) {
  if (v == null) return [];
  if (!Array.isArray(v)) throw bad('invalid_type', 'files: 배열');
  if (v.length > LIMITS.files) throw bad('too_many', `files: ${LIMITS.files}개까지`);
  return v.map((f) => {
    if (!isObj(f)) throw bad('invalid_type', 'files[]');
    const type = cleanText(f.type, 40, 'files.type', { required: true });
    if (!UPLOAD_TYPES[type]) throw new HttpError(415, 'unsupported_type', '이미지·PDF·MP3·MP4만 올릴 수 있어요.');
    return { url: cleanFileUrl(f.url), name: cleanText(f.name, LIMITS.fileName, 'files.name'), type, size: cleanNum(f.size ?? 0, 'files.size', 0, 1e10, { int: true }) };
  });
}
function cleanAnswerValue(v) {
  if (Array.isArray(v)) {
    if (!v.length || v.length > LIMITS.answerItems) throw bad('invalid_value', `value: 1~${LIMITS.answerItems}개`);
    return v.map((x) => (typeof x === 'number' ? cleanNum(x, 'value', -1e6, 1e6) : cleanText(x, LIMITS.answer, 'value', { required: true })));
  }
  if (typeof v === 'number') return cleanNum(v, 'value', -1e6, 1e6);
  return cleanText(v, LIMITS.answer, 'value', { required: true });
}
function cleanSurvey(v) {
  if (!isObj(v)) throw bad('invalid_type', 'answers: 객체');
  const keys = Object.keys(v);
  if (keys.length > LIMITS.surveyKeys) throw bad('too_many', 'answers: 항목이 너무 많아요.');
  const out = {};
  for (const k of keys) {
    const key = cleanText(k, LIMITS.id, 'answers.key', { required: true });
    const x = v[k];
    if (x == null) continue;
    if (typeof x === 'boolean') out[key] = x;
    else if (typeof x === 'number') out[key] = cleanNum(x, key, -1e9, 1e9);
    else if (Array.isArray(x)) out[key] = x.slice(0, 20).map((y) => cleanText(y, LIMITS.option, key));
    else out[key] = cleanText(x, LIMITS.surveyValue, key, { multiline: true });
  }
  return out;
}

/** Validates a participant (or admin for polls) POST. Returns { data, key }. Server fields are added by the caller. */
export function cleanAdd(col, b) {
  if (!isObj(b)) throw bad('invalid_body', '본문이 JSON 객체가 아닙니다.');
  switch (col) {
    case 'attendance': return { data: { kind: cleanEnum(b.kind, ['in', 'out'], 'kind') } };
    case 'progress': {
      const station = cleanId(b.station, 'station');
      return { data: { station, status: cleanEnum(b.status, ['doing', 'done', 'stuck'], 'status') } };
    }
    case 'help': return { data: { station: cleanText(b.station, LIMITS.id, 'station'), seat: cleanText(b.seat, LIMITS.seat, 'seat'), message: cleanText(b.message, LIMITS.help, 'message', { multiline: true }) } };
    case 'questions': return { data: { text: cleanText(b.text, LIMITS.question, 'text', { required: true, multiline: true }), anonymous: cleanBool(b.anonymous, 'anonymous', true) } };
    case 'posts': {
      const data = { kind: cleanText(b.kind || 'post', LIMITS.kind, 'kind'), text: cleanText(b.text, LIMITS.post, 'text', { multiline: true }), files: cleanFiles(b.files), license: cleanText(b.license, LIMITS.license, 'license') };
      if (!data.text && !data.files.length) throw bad('required', 'text 또는 files가 필요합니다.');
      return { data };
    }
    case 'polls': {
      const options = b.options == null ? [] : Array.isArray(b.options) ? b.options : null;
      if (!options || options.length > LIMITS.options) throw bad('invalid_value', `options: ${LIMITS.options}개까지`);
      return { data: { question: cleanText(b.question, LIMITS.pollQuestion, 'question', { required: true }), kind: cleanEnum(b.kind, POLL_KINDS, 'kind', 'choice'), options: options.map((o) => cleanText(o, LIMITS.option, 'options', { required: true })), open: cleanBool(b.open, 'open', false) } };
    }
    case 'answers': return { data: { poll: cleanId(b.poll, 'poll'), value: cleanAnswerValue(b.value) } };
    case 'survey': return { data: { answers: cleanSurvey(b.answers) } };
    case 'chat': return { data: { text: cleanText(b.text, LIMITS.chat, 'text', { required: true, multiline: true }) } };
    default: throw new HttpError(404, 'unknown_collection', '없는 컬렉션입니다.');
  }
}

const OWNER_PATCH = {
  participants: ['nickname'], progress: ['status'], help: ['station', 'seat', 'message', 'status'],
  questions: ['text'], posts: ['kind', 'text', 'files', 'license'], answers: ['value'], survey: ['answers'],
};
const ADMIN_PATCH = {
  participants: ['nickname'], help: ['status', 'assignee'], questions: ['status', 'pinned', 'text'],
  posts: ['hidden', 'text'], polls: ['question', 'kind', 'options', 'open'], chat: ['hidden'], progress: ['status'],
};
/** Validates a PATCH body for a role. Unknown fields are ignored; nothing allowed → 400. */
export function cleanPatch(col, b, role) {
  if (!isObj(b)) throw bad('invalid_body', '본문이 JSON 객체가 아닙니다.');
  const allowed = new Set([...(role.owner ? OWNER_PATCH[col] || [] : []), ...(role.admin ? ADMIN_PATCH[col] || [] : [])]);
  const out = {};
  for (const k of Object.keys(b)) {
    if (!allowed.has(k)) continue;
    const v = b[k];
    switch (`${col}.${k}`) {
      case 'participants.nickname': out[k] = role.admin ? cleanText(v, LIMITS.nickname, k, { required: true }) : cleanNickname(v, k, true); break;
      case 'progress.status': out[k] = cleanEnum(v, ['doing', 'done', 'stuck'], k); break;
      case 'help.station': out[k] = cleanText(v, LIMITS.id, k); break;
      case 'help.seat': out[k] = cleanText(v, LIMITS.seat, k); break;
      case 'help.message': out[k] = cleanText(v, LIMITS.help, k, { multiline: true }); break;
      case 'help.status': out[k] = cleanEnum(v, role.admin ? HELP_STATUS : ['open', 'done'], k); break;
      case 'help.assignee': out[k] = cleanText(v, LIMITS.assignee, k); break;
      case 'questions.text': out[k] = cleanText(v, LIMITS.question, k, { required: true, multiline: true }); break;
      case 'questions.status': out[k] = cleanEnum(v, Q_STATUS, k); break;
      case 'questions.pinned': case 'posts.hidden': case 'polls.open': case 'chat.hidden': out[k] = cleanBool(v, k, false); break;
      case 'posts.kind': out[k] = cleanText(v, LIMITS.kind, k, { required: true }); break;
      case 'posts.text': out[k] = cleanText(v, LIMITS.post, k, { multiline: true }); break;
      case 'posts.files': out[k] = cleanFiles(v); break;
      case 'posts.license': out[k] = cleanText(v, LIMITS.license, k); break;
      case 'polls.question': out[k] = cleanText(v, LIMITS.pollQuestion, k, { required: true }); break;
      case 'polls.kind': out[k] = cleanEnum(v, POLL_KINDS, k); break;
      case 'polls.options': if (!Array.isArray(v) || v.length > LIMITS.options) throw bad('invalid_value', k); out[k] = v.map((o) => cleanText(o, LIMITS.option, k, { required: true })); break;
      case 'answers.value': out[k] = cleanAnswerValue(v); break;
      case 'survey.answers': out[k] = cleanSurvey(v); break;
      default: break;
    }
  }
  if (!Object.keys(out).length) throw new HttpError(400, 'nothing_to_update', '바꿀 수 있는 항목이 없습니다.');
  return out;
}

export const DEFAULT_STATE = () => ({ step: null, slide: 0, follow: false, timer: null, notice: null, openPoll: null, ui: {}, updatedAt: 0 });
/** Instructor state patch. Shallow merge; timer/notice are replaced whole; null clears; ui merges by key. */
export function cleanStatePatch(p) {
  if (!isObj(p)) throw bad('invalid_body', '본문이 JSON 객체가 아닙니다.');
  const out = {};
  if ('step' in p) out.step = p.step == null ? null : typeof p.step === 'number' ? cleanNum(p.step, 'step', -1e6, 1e6, { int: true }) : cleanText(p.step, LIMITS.id, 'step');
  if ('slide' in p) out.slide = cleanNum(p.slide ?? 0, 'slide', 0, 1e6, { int: true });
  if ('follow' in p) out.follow = cleanBool(p.follow, 'follow', false);
  if ('timer' in p) {
    const t = p.timer;
    if (t == null) out.timer = null;
    else if (!isObj(t)) throw bad('invalid_type', 'timer');
    else out.timer = { endsAt: cleanNum(t.endsAt ?? null, 'timer.endsAt', 0, 1e13, { int: true, nullable: true }), label: cleanText(t.label, LIMITS.timerLabel, 'timer.label'), running: cleanBool(t.running, 'timer.running', false), remaining: cleanNum(t.remaining ?? null, 'timer.remaining', 0, 864e5, { int: true, nullable: true }) };
  }
  if ('notice' in p) {
    const n = p.notice;
    if (n == null) out.notice = null;
    else if (!isObj(n)) throw bad('invalid_type', 'notice');
    else { const text = cleanText(n.text, LIMITS.notice, 'notice.text', { multiline: true }); out.notice = text ? { text, level: cleanEnum(n.level, NOTICE_LEVELS, 'notice.level', 'info') } : null; }
  }
  if ('openPoll' in p) out.openPoll = p.openPoll == null || p.openPoll === '' ? null : cleanId(p.openPoll, 'openPoll');
  if ('ui' in p) {
    if (!isObj(p.ui)) throw bad('invalid_type', 'ui');
    const keys = Object.keys(p.ui);
    if (keys.length > LIMITS.uiKeys) throw bad('too_many', 'ui');
    out.ui = {};
    for (const k of keys) {
      const key = cleanText(k, 32, 'ui.key', { required: true }); const v = p.ui[k];
      out.ui[key] = v == null || typeof v === 'boolean' ? v ?? null : typeof v === 'number' ? cleanNum(v, key, -1e13, 1e13) : cleanText(v, LIMITS.uiValue, key);
    }
  }
  if (!Object.keys(out).length) throw new HttpError(400, 'nothing_to_update', '바꿀 상태가 없습니다.');
  return out;
}

/** Sniffs magic bytes so the declared Content-Type cannot smuggle HTML/SVG. Returns a mime or null. */
export function sniffType(b) {
  if (!b || b.length < 12) return null;
  const at = (i, ...xs) => xs.every((x, j) => b[i + j] === x);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp';
  if (at(0, 0x25, 0x50, 0x44, 0x46, 0x2d)) return 'application/pdf';
  if (at(0, 0x49, 0x44, 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  if (at(4, 0x66, 0x74, 0x79, 0x70)) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V ', 'MSNV', 'dash', 'mmp4'].includes(brand)) return 'video/mp4';
  }
  return null;
}
export function safeFileName(name, type) {
  const ext = UPLOAD_TYPES[type];
  let n = cleanText(name || 'file', LIMITS.fileName, 'name').replace(/[\\/:*?"<>|]/g, '_') || 'file';
  if (!n.toLowerCase().endsWith('.' + ext)) n = n.replace(/\.[A-Za-z0-9]{1,5}$/, '') + '.' + ext;
  return n;
}

// ---------- CSV ----------
export const FORMULA = /^[\s\u00A0\u3000]*[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]|^[\t\r\n]/;
function csvCell(v) {
  if (v == null) return '';
  let s = Array.isArray(v) ? v.join(' / ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (FORMULA.test(s)) s = "'" + s; // formula injection guard (Excel, Sheets, LibreOffice): leading blanks and full-width signs too
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}
export function toCsv(columns, rows) {
  return '﻿' + [columns, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
export function fmtTime(ms, timeZone = 'Asia/Seoul') {
  if (!ms) return '';
  try {
    return new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(ms));
  } catch { return new Date(ms).toISOString(); }
}
const STATUS_KO = { doing: '하는 중', done: '완료', stuck: '도움 요청', open: '대기', claimed: '가는 중', answered: '답변함', hidden: '숨김' };

/**
 * Builds export rows. `data` = { participants:[], attendance:[], progress:[], questions:[], survey:[], posts:[], help:[], chat:[], answers:[] } (full docs).
 * Shared column layout for every backend that exports on the server.
 */
export function exportTable(kind, data, timeZone, opts) {
  const t = (ms) => fmtTime(ms, timeZone);
  if (kind === 'completion') return completionTable(data, opts, timeZone);
  const people = new Map((data.participants || []).map((p) => [p.id, p]));
  const nick = (id) => (people.get(id) || {}).nickname || '';
  switch (kind) {
    case 'participants':
      return { columns: ['별명', '이름', '소속', '참여 시각', '동의 시각'], rows: data.participants.map((p) => [p.nickname, p.name, p.school, t(p.createdAt), t(p.consentAt)]) };
    case 'attendance': {
      const m = new Map();
      for (const a of data.attendance || []) { const r = m.get(a.by) || {}; r[a.kind] = a.at || a.createdAt; m.set(a.by, r); }
      return { columns: ['별명', '이름', '소속', '입실', '퇴실', '동의 시각'], rows: data.participants.map((p) => { const r = m.get(p.id) || {}; return [p.nickname, p.name, p.school, t(r.in), t(r.out), t(p.consentAt)]; }) };
    }
    case 'progress': {
      const stations = [...new Set((data.progress || []).map((x) => x.station))];
      const m = new Map();
      for (const x of data.progress || []) { const r = m.get(x.by) || {}; r[x.station] = x.status; m.set(x.by, r); }
      return { columns: ['별명', '이름', ...stations, '완료 수'], rows: [...m.entries()].map(([by, r]) => [nick(by), (people.get(by) || {}).name, ...stations.map((s) => STATUS_KO[r[s]] || ''), stations.filter((s) => r[s] === 'done').length]) };
    }
    case 'questions':
      return { columns: ['작성 시각', '질문', '작성자', '공감', '상태', '고정'], rows: (data.questions || []).map((q) => [t(q.createdAt), q.text, q.anonymous ? '익명' : q.nickname, q.votes, STATUS_KO[q.status] || q.status, q.pinned ? '예' : '']) };
    case 'survey': {
      const keys = [...new Set((data.survey || []).flatMap((s) => Object.keys(s.answers || {})))];
      return { columns: ['별명', '이름', '소속', '제출 시각', ...keys], rows: (data.survey || []).map((s) => { const p = people.get(s.by) || {}; return [p.nickname, p.name, p.school, t(s.updatedAt), ...keys.map((k) => (s.answers || {})[k])]; }) };
    }
    case 'posts':
      return { columns: ['작성 시각', '종류', '내용', '별명', '파일', '좋아요', '숨김'], rows: (data.posts || []).map((x) => [t(x.createdAt), x.kind, x.text, x.nickname, (x.files || []).map((f) => f.url), x.likes, x.hidden ? '예' : '']) };
    case 'help':
      return { columns: ['요청 시각', '별명', '활동', '자리', '내용', '상태', '담당'], rows: (data.help || []).map((x) => [t(x.createdAt), x.nickname, x.station, x.seat, x.message, STATUS_KO[x.status] || x.status, x.assignee]) };
    case 'chat':
      return { columns: ['시각', '별명', '내용', '숨김'], rows: (data.chat || []).map((x) => [t(x.createdAt), x.nickname, x.text, x.hidden ? '예' : '']) };
    case 'answers':
      return { columns: ['투표', '별명', '응답', '시각'], rows: (data.answers || []).map((x) => [x.poll, nick(x.by), x.value, t(x.updatedAt)]) };
    default: throw bad('bad_kind', 'kind: ' + EXPORT_KINDS.join('|'));
  }
}
export const EXPORT_KINDS = ['attendance', 'progress', 'questions', 'survey', 'participants', 'posts', 'help', 'chat', 'answers', 'completion'];

// ---------- completion (이수 확인): one row per participant. Same rule as engine/runtime/live/core.js ----------
// opts: { date:'YYYY-MM-DD', start:'HH:MM', end:'HH:MM', rate: 0~100, survey: bool (site has survey questions), stations: n }
// 이수 = O when minutes present (clipped to the schedule) ≥ rate% of the scheduled minutes, and a survey was sent if the site has one.
// Missing check-in/out or schedule → '확인 필요'. Only nickname, name and school: never NEIS or phone numbers.
export const COMPLETION_COLS = ['별명', '이름', '소속', '입실', '퇴실', '머문 시간(분)', '실습 완료(n/전체)', '설문 제출', '이수'];
function tzOffset(ms, timeZone) {
  try {
    const p = {};
    for (const x of new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms))) p[x.type] = +x.value;
    return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
  } catch { return 9 * 3600000; }
}
/** Wall-clock date + 'HH:MM' in a time zone → epoch ms (null when malformed). */
export function zonedMs(date, hm, timeZone = 'Asia/Seoul') {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || ''); const h = /^(\d{1,2}):(\d{2})$/.exec(hm || '');
  if (!d || !h) return null;
  const guess = Date.UTC(+d[1], +d[2] - 1, +d[3], +h[1], +h[2]);
  const off = tzOffset(guess, timeZone); const ms = guess - off; const off2 = tzOffset(ms, timeZone);
  return off2 === off ? ms : guess - off2;
}
export function completionTable(data, opts, timeZone) {
  const o = opts || {}; const tz = timeZone || 'Asia/Seoul';
  const rate = typeof o.rate === 'number' && o.rate >= 0 && o.rate <= 100 ? o.rate : 90;
  const att = new Map(); const done = new Map(); const sv = new Set(); const stations = new Set();
  for (const a of data.attendance || []) { const r = att.get(a.by) || {}; if (a.kind === 'in' || a.kind === 'out') r[a.kind] = a.at || a.createdAt; att.set(a.by, r); }
  for (const x of data.progress || []) { stations.add(x.station); if (x.status === 'done') { const r = done.get(x.by) || new Set(); r.add(x.station); done.set(x.by, r); } }
  for (const s of data.survey || []) if (s.by) sv.add(s.by);
  const total = o.stations > 0 ? Math.floor(o.stations) : stations.size;
  const rows = [...(data.participants || [])].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map((p) => {
    const r = att.get(p.id) || {}; const inAt = r.in; const outAt = r.out;
    const day = o.date || (inAt ? fmtTime(inAt, tz).slice(0, 10) : '');
    const s0 = zonedMs(day, o.start, tz); const s1 = zonedMs(day, o.end, tz);
    const sched = s0 != null && s1 != null && s1 > s0 ? s1 - s0 : 0;
    let mins = '';
    if (inAt && outAt && outAt >= inAt) mins = Math.max(0, Math.round((Math.min(outAt, sched ? s1 : outAt) - Math.max(inAt, sched ? s0 : inAt)) / 60000));
    const n = (done.get(p.id) || new Set()).size;
    let verdict = '확인 필요';
    if (mins !== '' && sched) verdict = mins >= Math.ceil(sched / 60000 * rate / 100) && (!o.survey || sv.has(p.id)) ? 'O' : 'X';
    return [p.nickname, p.name, p.school, fmtTime(inAt, tz), fmtTime(outAt, tz), mins, total ? Math.min(n, total) + ' / ' + total : '해당 없음', o.survey ? (sv.has(p.id) ? 'O' : 'X') : '해당 없음', verdict];
  });
  return { columns: [...COMPLETION_COLS], rows };
}
/** Reads completion options from export.csv query parameters (?date=&start=&end=&rate=&survey=1&stations=). */
export function completionOpts(query) {
  const g = (k) => (query && typeof query.get === 'function' ? query.get(k) : null);
  const o = {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(g('date') || '')) o.date = g('date');
  if (/^\d{1,2}:\d{2}$/.test(g('start') || '')) o.start = g('start');
  if (/^\d{1,2}:\d{2}$/.test(g('end') || '')) o.end = g('end');
  const rate = Number(g('rate')); if (g('rate') != null && g('rate') !== '' && rate >= 0 && rate <= 100) o.rate = rate;
  const st = Number(g('stations')); if (Number.isInteger(st) && st > 0 && st <= 500) o.stations = st;
  o.survey = g('survey') === '1' || g('survey') === 'true';
  return o;
}

// ---------- rate limiter (memory, soft) ----------
export class Limiter {
  constructor() { this.m = new Map(); this.n = 0; }
  /** Returns 0 when allowed, otherwise ms until the window resets. */
  hit(key, [max, win], now = Date.now()) {
    if (++this.n % 500 === 0) this.prune(now);
    let e = this.m.get(key);
    if (!e || e.reset <= now) { e = { c: 0, reset: now + win }; this.m.set(key, e); }
    if (e.c >= max) return e.reset - now;
    e.c++; return 0;
  }
  /** Like hit() but never counts: ms until the window resets when the bucket is full, else 0. */
  peek(key, [max], now = Date.now()) {
    const e = this.m.get(key);
    return e && e.reset > now && e.c >= max ? e.reset - now : 0;
  }
  prune(now = Date.now()) { for (const [k, e] of this.m) if (e.reset <= now) this.m.delete(k); }
}

// ---------- storage schema (SQLite; same in node:sqlite and Durable Objects) ----------
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS trainings (code TEXT PRIMARY KEY, admin_hash TEXT, settings TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL, last_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS docs (code TEXT NOT NULL, col TEXT NOT NULL, id TEXT NOT NULL, by TEXT, k TEXT, cid TEXT, data TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (code, col, id))`,
  `CREATE INDEX IF NOT EXISTS docs_since ON docs (code, updated_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS docs_key ON docs (code, col, k) WHERE k IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS docs_cid ON docs (code, col, by, cid) WHERE cid IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS votes (code TEXT NOT NULL, col TEXT NOT NULL, doc TEXT NOT NULL, by TEXT NOT NULL, PRIMARY KEY (code, col, doc, by))`,
  `CREATE TABLE IF NOT EXISTS tombstones (code TEXT NOT NULL, col TEXT NOT NULL, id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (code, col, id))`,
  `CREATE INDEX IF NOT EXISTS tomb_since ON tombstones (code, at)`,
  `CREATE TABLE IF NOT EXISTS state (code TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS files (code TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, size INTEGER NOT NULL, by TEXT, created_at INTEGER NOT NULL, PRIMARY KEY (code, name))`,
  // Which post a file belongs to. A row with post NULL = uploaded but not attached yet. A tracked file is served only
  // while its post exists and is not hidden; files without a row (uploaded before this table existed) are legacy.
  `CREATE TABLE IF NOT EXISTS file_refs (code TEXT NOT NULL, name TEXT NOT NULL, post TEXT, PRIMARY KEY (code, name))`,
  `CREATE INDEX IF NOT EXISTS file_refs_post ON file_refs (code, post)`,
];

// ---------- the core ----------
/** Collections whose `by` (participant id) is shown to non-admins only on the reader's own docs. */
const OWN_BY = new Set(['answers', 'progress', 'help']);

/**
 * new LiveCore({ db, config }) — db: { all, get, run, tx }.
 * config: { adminKeyHash, setupTokenHash, openInit, autoCreate, allowedCodes:Set|null, retentionDays,
 *           maxRetentionDays, maxUploadBytes, timeZone, rate:{...}, maxParticipants, maxDocs,
 *           lazySchema  — create the tables only on the first write that may create a training (Durable Objects),
 *           onSchema()  — called once when the tables were just created (the host can schedule a clean-up),
 *           guard       — optional cross-instance limiter { hit(key,[max,win]) → ms, peek(key,[max,win]) → ms } (async) }
 */
export class LiveCore {
  constructor({ db, config = {}, now = () => Date.now() }) {
    this.db = db; this.now = now;
    this.cfg = { retentionDays: 30, maxRetentionDays: 365, maxUploadBytes: 20 * 1024 * 1024, timeZone: 'Asia/Seoul', openInit: false, maxParticipants: CAPS.participants, maxDocs: CAPS.docs, ...config };
    // Single-teacher mode (a default admin key or a fixed code list): a code comes to life on its first write.
    // Otherwise a code must be registered with /init first.
    if (this.cfg.autoCreate == null) this.cfg.autoCreate = !!(this.cfg.adminKeyHash || this.cfg.allowedCodes);
    this.rate = { ...RATE, ...(this.cfg.rate || {}) };
    this.limiter = new Limiter();
    this.stamps = new Map();
    this.counts = new Map();
    this.guardOk = new Map();
    this.ready = false;
    if (!this.cfg.lazySchema || this.hasSchema()) this.ensureSchema(true);
  }

  // ----- schema (lazy on Durable Objects: plain reads of unknown codes never create storage) -----
  hasSchema() {
    try { return !!this.db.get(`SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = 'trainings'`); } catch { return false; }
  }
  ensureSchema(existing = false) {
    if (this.ready) return;
    for (const s of SCHEMA) this.db.run(s);
    this.ready = true;
    if (!existing && typeof this.cfg.onSchema === 'function') { try { this.cfg.onSchema(); } catch { /* host hook */ } }
  }

  // ----- clock: strictly increasing per training so `since` cursors are exact -----
  tick(code) {
    let last = this.stamps.get(code);
    if (last == null) last = this.ready ? this._maxStamp(code) : 0;
    const t = Math.max(this.now(), last + 1);
    this.stamps.set(code, t);
    return t;
  }
  _maxStamp(code) {
    const r = this.db.get(`SELECT MAX(m) AS m FROM (SELECT MAX(updated_at) AS m FROM docs WHERE code = ? UNION ALL SELECT MAX(at) FROM tombstones WHERE code = ? UNION ALL SELECT MAX(updated_at) FROM state WHERE code = ?)`, code, code, code);
    return (r && r.m) || 0;
  }

  // ----- trainings -----
  training(code, create = false) {
    if (this.cfg.allowedCodes && !this.cfg.allowedCodes.has(code)) throw new HttpError(404, 'unknown_training', '등록되지 않은 연수 코드입니다.');
    let t = this.ready ? this.db.get(`SELECT * FROM trainings WHERE code = ?`, code) : null;
    if (!t && create && this.cfg.autoCreate) {
      this.ensureSchema();
      const now = this.now();
      this.db.run(`INSERT OR IGNORE INTO trainings (code, admin_hash, settings, created_at, last_at) VALUES (?, NULL, '{}', ?, ?)`, code, now, now);
      t = this.db.get(`SELECT * FROM trainings WHERE code = ?`, code);
    }
    if (!t && create) throw new HttpError(404, 'unknown_training', '아직 준비되지 않은 연수 코드입니다.');
    if (t) t.settingsObj = safeJson(t.settings, {});
    return t || null;
  }
  trainingOrNull(code) { try { return this.training(code); } catch { return null; } }
  exists(code) { return !!this.trainingOrNull(code); }
  touch(t) {
    const now = this.now();
    if (now - t.last_at > 60e3) { this.db.run(`UPDATE trainings SET last_at = ? WHERE code = ?`, now, t.code); t.last_at = now; }
  }
  retentionDays(t) {
    const d = Number((t && t.settingsObj && t.settingsObj.retentionDays) || this.cfg.retentionDays);
    return Math.min(Math.max(1, d), this.cfg.maxRetentionDays);
  }
  uploadLimit(t) {
    const mb = t && t.settingsObj && t.settingsObj.maxUploadMb;
    return mb ? Math.min(mb * 1024 * 1024, this.cfg.maxUploadBytes) : this.cfg.maxUploadBytes;
  }
  /** Board files allowed? init `settings.uploads` or the instructor's state.ui.uploads (admin-only), both default on. */
  uploadsAllowed(code, t) {
    if (!t) return false;
    if (t.settingsObj && t.settingsObj.uploads === false) return false;
    return (this.state(code, t).ui || {}).uploads !== false;
  }
  /** Docs per (training, collection), cached; join/add/remove/wipe keep it current. */
  count(code, col) {
    const k = code + '|' + col;
    let n = this.counts.get(k);
    if (n == null) {
      n = this.ready ? (this.db.get(`SELECT COUNT(*) AS n FROM docs WHERE code = ? AND col = ?`, code, col) || {}).n || 0 : 0;
      if (this.counts.size > 20000) this.counts.clear();
      this.counts.set(k, n);
    }
    return n;
  }
  bumpCount(code, col, d) { const k = code + '|' + col; if (this.counts.has(k)) this.counts.set(k, Math.max(0, this.counts.get(k) + d)); }

  // ----- auth -----
  /** Hash credentials first (async), then everything else is synchronous. */
  async credentials(headers) {
    // Header values must be Latin-1, so clients send admin keys / setup tokens percent-encoded
    // (encodeURIComponent). A raw ASCII value still works.
    const token = headers.get('x-lec-token'); const admin = decodeHeader(headers.get('x-lec-admin')); const setup = decodeHeader(headers.get('x-lec-setup'));
    return {
      tokenHash: token && token.length <= 200 ? await sha256hex(token) : null,
      adminHash: admin && admin.length <= 200 ? await sha256hex(admin) : null,
      setupHash: setup && setup.length <= 200 ? await sha256hex(setup) : null,
    };
  }
  isAdmin(t, cred) {
    if (!cred.adminHash) return false;
    const expected = (t && t.admin_hash) || this.cfg.adminKeyHash;
    return !!expected && hashEqual(cred.adminHash, expected);
  }
  participant(code, cred) {
    if (!cred.tokenHash || !this.ready) return null;
    const row = this.db.get(`SELECT id, data FROM docs WHERE code = ? AND col = 'participants' AND k = ?`, code, cred.tokenHash);
    return row ? { id: row.id, ...safeJson(row.data, {}) } : null;
  }
  requireAdmin(t, cred) {
    if (!this.isAdmin(t, cred)) throw new HttpError(cred.adminHash ? 403 : 401, 'admin_required', '관리자 키가 필요합니다.');
  }
  requireParticipant(code, cred) {
    const p = this.participant(code, cred);
    if (!p) throw new HttpError(401, 'invalid_token', '참여 정보가 없어요. 다시 참여해 주세요.');
    return p;
  }
  limit(bucket, who, ip) {
    const now = this.now();
    if (ip && bucket !== 'joinIp') { const w = this.limiter.hit('ip:' + ip, this.rate.ip, now); if (w) throw rateErr(w); }
    const w = this.limiter.hit(bucket + ':' + who, this.rate[bucket] || this.rate.write, now);
    if (w) throw rateErr(w);
  }
  /** Cross-instance counter (Cloudflare: one Guard object per IP); this process's limiter otherwise or when it fails. */
  async gHit(key, rate) {
    if (this.cfg.guard) { try { return Number(await this.cfg.guard.hit(key, rate)) || 0; } catch { /* fall back */ } }
    return this.limiter.hit('g:' + key, rate, this.now());
  }
  async gPeek(key, rate) {
    if (this.cfg.guard) { try { return Number(await this.cfg.guard.peek(key, rate)) || 0; } catch { /* fall back */ } }
    return this.limiter.peek('g:' + key, rate, this.now());
  }
  /** 429 while this (code, IP) or this IP has too many wrong admin keys / setup tokens. Checked before the key, so a
   *  locked client learns nothing — the right key is refused too until the window ends. */
  async authGate(code, ip) {
    const who = ip || '?'; const now = this.now();
    let w = this.limiter.peek('af:' + code + '|' + who, this.rate.authFail, now);
    if (!w) {
      const ok = this.guardOk.get(who);
      if (!(ok && ok > now)) {
        w = await this.gPeek('afip:' + who, this.rate.authFailIp);
        if (!w) { if (this.guardOk.size > 5000) this.guardOk.clear(); this.guardOk.set(who, now + 30e3); }
      }
    }
    if (w) throw new HttpError(429, 'rate_limited', '관리자 키가 여러 번 틀려 잠시 막았어요. 몇 분 뒤에 다시 해 주세요.', { retryAfter: Math.max(1, Math.ceil(w / 1000)) });
  }
  async authFail(code, ip) {
    const who = ip || '?';
    this.limiter.hit('af:' + code + '|' + who, this.rate.authFail, this.now());
    this.guardOk.delete(who);
    await this.gHit('afip:' + who, this.rate.authFailIp);
  }
  /** WebSocket {type:'auth'}: same throttle as the header. Resolves true/false; throws 429 while locked. */
  async wsAuth(code, key, ip) {
    const c = normCode(code);
    await this.authGate(c, ip);
    const hash = typeof key === 'string' && key && key.length <= 200 ? await sha256hex(key) : null;
    const ok = !!hash && this.isAdmin(this.trainingOrNull(c), { adminHash: hash });
    if (!ok) await this.authFail(c, ip);
    return ok;
  }

  // ----- doc helpers -----
  /** viewer: the reading participant's id (public view) — answers/progress/help carry `by` only on the reader's own docs. */
  out(col, row, admin, viewer) {
    const d = safeJson(row.data, {});
    const doc = { id: row.id, ...d, createdAt: row.created_at, updatedAt: row.updated_at };
    if (row.by && col !== 'questions' && col !== 'participants' && (admin || !OWN_BY.has(col) || (viewer && row.by === viewer))) doc.by = row.by;
    if (row.cid) doc.cid = row.cid;
    if (!admin) {
      if (col === 'questions' && doc.status === 'hidden') doc.text = '';
      if (col === 'posts' && doc.hidden) { doc.text = ''; doc.files = []; }
      if (col === 'chat' && doc.hidden) doc.text = '';
    }
    return doc;
  }
  event(type, col, row) {
    const isPublic = PUBLIC_COLS.includes(col);
    return { type, col, doc: this.out(col, row, true), pub: isPublic ? this.out(col, row, false) : null };
  }
  getRow(code, col, id) { return this.db.get(`SELECT * FROM docs WHERE code = ? AND col = ? AND id = ?`, code, col, id); }
  writeRow(code, col, row, data, now) {
    this.db.run(`UPDATE docs SET data = ?, updated_at = ? WHERE code = ? AND col = ? AND id = ?`, JSON.stringify(data), now, code, col, row.id);
    return { ...row, data: JSON.stringify(data), updated_at: now };
  }

  // ----- board files (M7/M8/H3) -----
  /** Files on a post must be this training's own uploads by the same participant, not used by another post, and only
   *  while uploads are allowed. The recorded type and size replace what the client sent. */
  ownFiles(code, t, me, files, postId) {
    if (!files || !files.length) return [];
    if (!this.uploadsAllowed(code, t)) throw new HttpError(403, 'uploads_disabled', '이 연수는 파일 올리기를 쓰지 않습니다.');
    const seen = new Set();
    return files.map((f) => {
      const ref = fileRef(f.url);
      const row = ref && ref.code === code && !seen.has(ref.name) && me
        ? this.db.get(`SELECT f.type, f.size, f.by, r.post FROM files f LEFT JOIN file_refs r ON r.code = f.code AND r.name = f.name WHERE f.code = ? AND f.name = ?`, code, ref.name) : null;
      if (!row || row.by !== me.id || (row.post && row.post !== postId)) throw bad('invalid_value', 'files.url: 이 연수에 내가 올린 파일만 붙일 수 있어요.');
      seen.add(ref.name);
      return { url: `/api/${code}/files/${ref.name}`, name: f.name, type: row.type, size: row.size };
    });
  }
  /** Own upload names referenced by a post (its files[] plus anything linked to it). */
  postFileNames(code, postId, files) {
    const names = new Set();
    for (const f of files || []) { const r = fileRef(f && f.url); if (r && r.code === code) names.add(r.name); }
    for (const r of this.db.all(`SELECT name FROM file_refs WHERE code = ? AND post = ?`, code, postId)) names.add(r.name);
    return [...names];
  }
  /** Links files to a post (only files this training really has). Untracked legacy files become tracked, so hiding works. */
  linkFiles(code, postId, names) {
    for (const n of names) {
      if (this.db.get(`SELECT 1 AS x FROM files WHERE code = ? AND name = ?`, code, n)) {
        this.db.run(`INSERT INTO file_refs (code, name, post) VALUES (?, ?, ?) ON CONFLICT(code, name) DO UPDATE SET post = excluded.post`, code, n, postId);
      }
    }
  }
  dropFiles(code, names) {
    for (const n of names) { this.db.run(`DELETE FROM files WHERE code = ? AND name = ?`, code, n); this.db.run(`DELETE FROM file_refs WHERE code = ? AND name = ?`, code, n); }
  }

  // ----- router -----
  /**
   * req = { method, code, rest: string[], query: URLSearchParams, headers: Headers-like, body, ip, origin? }
   * → { status, body, contentType?, events?: [{type,col,doc,pub}], reaction?: emoji,
   *     purgedFiles?: string[] (whole training wiped: delete every stored file of the code),
   *     deleteFiles?: string[] (delete just these stored names) }
   * `origin` (the scheme://host the reader used) turns relative upload paths in the response into absolute URLs.
   */
  async handle(req) {
    const code = normCode(req.code);
    const cred = await this.credentials(req.headers);
    const [a, b] = req.rest; const m = req.method; const ip = req.ip || '';
    // Wrong admin keys / setup tokens count on every route (a wrong key on a read silently falls back to the public
    // view, which would otherwise be a free oracle).
    if (cred.adminHash || (a === 'init' && cred.setupHash)) {
      await this.authGate(code, ip);
      let wrong = !!cred.adminHash && !this.isAdmin(this.trainingOrNull(code), cred);
      if (a === 'init' && cred.setupHash && !(this.cfg.setupTokenHash && hashEqual(cred.setupHash, this.cfg.setupTokenHash))) wrong = true;
      if (wrong) await this.authFail(code, ip);
    }
    if ((m === 'GET' || m === 'HEAD') && ip) { const w = this.limiter.hit('read:' + ip, this.rate.read, this.now()); if (w) throw rateErr(w); }
    // auto-created trainings per IP (counted across rooms through the guard)
    if (this.cfg.autoCreate && !b && ((m === 'POST' && (a === 'join' || a === 'polls')) || (a === 'state' && m !== 'GET'))
      && (!this.cfg.allowedCodes || this.cfg.allowedCodes.has(code)) && !this.exists(code)) {
      const w = await this.gHit('create:' + (ip || '?'), this.rate.create); if (w) throw rateErr(w);
    }
    const out = await this.route(code, cred, req);
    if (req.origin && out && out.body && !out.contentType) absolutizeFiles(out.body, req.origin);
    return out;
  }
  async route(code, cred, req) {
    const [a, b, c] = req.rest; const m = req.method;
    if (m === 'POST' && a === 'init' && !b) return this.init(code, req.body, cred);
    if (m === 'POST' && a === 'join' && !b) return this.join(code, req.body, req.ip);
    if (m === 'GET' && a === 'snapshot' && !b) return this.snapshot(code, req.query, cred);
    if (a === 'state' && !b) {
      if (m === 'GET') { const t = this.training(code); return { status: 200, body: this.state(code, t) }; }
      if (m === 'PUT' || m === 'PATCH' || m === 'POST') return this.setState(code, req.body, cred, req.ip);
    }
    if (m === 'POST' && a === 'react' && !b) return this.react(code, req.body, cred, req.ip);
    if (m === 'GET' && a === 'export.csv' && !b) return this.exportCsv(code, req.query.get('kind') || 'attendance', cred, completionOpts(req.query));
    if (m === 'DELETE' && a == null) return this.purge(code, cred);
    if (a && COLS.includes(a)) {
      if (!b && m === 'GET') return this.list(code, a, req.query, cred);
      if (!b && m === 'POST') return this.add(code, a, req.body, cred, req.ip);
      if (b && !c && m === 'PATCH') return this.update(code, a, b, req.body, cred, req.ip);
      if (b && !c && m === 'DELETE') return this.remove(code, a, b, cred);
      if (b && c === 'vote' && m === 'POST' && a === 'questions') return this.vote(code, a, b, cred, req.ip);
      if (b && c === 'like' && m === 'POST' && a === 'posts') return this.vote(code, a, b, cred, req.ip);
    }
    if (a && !COLS.includes(a) && !['init', 'join', 'snapshot', 'state', 'react', 'export.csv', 'upload', 'files', 'ws', 'events'].includes(a)) throw new HttpError(404, 'unknown_collection', '없는 컬렉션입니다.');
    throw new HttpError(405, 'method_not_allowed', '지원하지 않는 요청입니다.');
  }

  async init(code, body, cred) {
    if (!isObj(body)) throw bad('invalid_body', '본문이 JSON 객체가 아닙니다.');
    const hash = String(body.adminKeyHash || '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(hash)) throw bad('invalid_value', 'adminKeyHash: SHA-256 hex 64자');
    if (await isWeakKeyHash(hash)) throw bad('weak_key', '예시로 쓰인 관리자 키입니다. 새로 만든 키(12자 이상)를 쓰세요.');
    const existing = this.training(code);
    if (existing && existing.admin_hash) {
      // Re-init (key rotation / settings) requires the current admin key.
      this.requireAdmin(existing, cred);
    } else if (!this.cfg.openInit) {
      if (!this.cfg.setupTokenHash) throw new HttpError(403, 'init_disabled', '이 서버는 연수 등록을 받지 않습니다(설정 토큰 없음).');
      if (!cred.setupHash || !hashEqual(cred.setupHash, this.cfg.setupTokenHash)) throw new HttpError(403, 'setup_required', '서버 설정 토큰이 맞지 않습니다.');
    }
    const s = isObj(body.settings) ? body.settings : {};
    const settings = {};
    if (s.retentionDays != null) settings.retentionDays = cleanNum(s.retentionDays, 'retentionDays', 1, this.cfg.maxRetentionDays, { int: true });
    if (s.maxUploadMb != null) settings.maxUploadMb = cleanNum(s.maxUploadMb, 'maxUploadMb', 1, Math.floor(this.cfg.maxUploadBytes / 1048576), { int: true });
    if (s.uploads != null) settings.uploads = cleanBool(s.uploads, 'uploads', true);
    if (s.title != null) settings.title = cleanText(s.title, 120, 'title');
    if (s.moderation != null) settings.moderation = cleanBool(s.moderation, 'moderation', false);
    this.ensureSchema();
    const now = this.now();
    this.db.run(`INSERT INTO trainings (code, admin_hash, settings, created_at, last_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(code) DO UPDATE SET admin_hash = excluded.admin_hash, settings = excluded.settings, last_at = excluded.last_at`, code, hash, JSON.stringify(settings), now, now);
    return { status: existing ? 200 : 201, body: { ok: true, code, settings } };
  }

  async join(code, body, ip) {
    if (!isObj(body)) throw bad('invalid_body', '본문이 JSON 객체가 아닙니다.');
    const nickname = cleanNickname(body.nickname) || '참가자';
    const name = cleanText(body.name, LIMITS.name, 'name');
    const school = cleanText(body.school, LIMITS.school, 'school');
    const consent = body.consent === true;
    if ((name || school) && !consent) throw bad('consent_required', '이름·소속을 남기려면 개인정보 수집에 동의해야 합니다.');
    if (this.cfg.allowedCodes && !this.cfg.allowedCodes.has(code)) throw new HttpError(404, 'unknown_training', '등록되지 않은 연수 코드입니다.');
    if (!this.exists(code) && !this.cfg.autoCreate) throw new HttpError(404, 'unknown_training', '아직 준비되지 않은 연수 코드입니다.');
    if (ip) { const w = this.limiter.hit('joinIp:' + ip, this.rate.joinIp, this.now()); if (w) throw rateErr(w); }
    const wc = this.limiter.hit('joinCode:' + code, this.rate.joinCode, this.now()); if (wc) throw rateErr(wc);
    const token = randomToken();
    const tokenHash = await sha256hex(token);
    // synchronous from here on
    const t = this.training(code, true);
    if (this.count(code, 'participants') >= this.cfg.maxParticipants) throw new HttpError(403, 'room_full', `참가 인원이 가득 찼어요(최대 ${this.cfg.maxParticipants}명). 강사에게 알려 주세요.`);
    const id = 'p' + randomId(9); const now = this.tick(code);
    const data = { nickname, name, school, consentAt: consent ? now : null };
    this.db.run(`INSERT INTO docs (code, col, id, by, k, cid, data, created_at, updated_at) VALUES (?, 'participants', ?, ?, ?, NULL, ?, ?, ?)`, code, id, id, tokenHash, JSON.stringify(data), now, now);
    this.bumpCount(code, 'participants', 1);
    this.touch(t);
    const row = this.getRow(code, 'participants', id);
    return { status: 201, body: { id, token, nickname }, events: [this.event('add', 'participants', row)] };
  }

  state(code, t) {
    const row = t && this.ready ? this.db.get(`SELECT data, updated_at FROM state WHERE code = ?`, code) : null;
    return row ? { ...DEFAULT_STATE(), ...safeJson(row.data, {}), updatedAt: row.updated_at } : DEFAULT_STATE();
  }
  setState(code, body, cred, ip) {
    const t0 = this.training(code);
    if (!t0 && !this.cfg.autoCreate) throw new HttpError(404, 'unknown_training', '아직 준비되지 않은 연수 코드입니다.');
    this.requireAdmin(t0, cred);
    const t = t0 || this.training(code, true);
    this.limit('admin', 'admin:' + code, null);
    const patch = cleanStatePatch(body);
    const cur = this.state(code, t);
    const next = { ...cur, ...patch };
    if (patch.ui) next.ui = { ...(cur.ui || {}), ...patch.ui };
    for (const k of Object.keys(next.ui || {})) if (next.ui[k] === null) delete next.ui[k];
    const now = this.tick(code); delete next.updatedAt;
    this.db.run(`INSERT INTO state (code, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`, code, JSON.stringify(next), now);
    this.touch(t);
    const st = { ...next, updatedAt: now };
    return { status: 200, body: st, events: [{ type: 'state', col: null, doc: st, pub: st }] };
  }

  snapshot(code, query, cred) {
    const t = this.training(code);
    const since = Math.max(0, Number(query.get('since')) || 0);
    const admin = this.isAdmin(t, cred);
    const cols = admin ? [...PUBLIC_COLS, ...PRIVATE_COLS] : PUBLIC_COLS;
    const out = { state: this.state(code, t), now: 0, since, full: since === 0, removed: [] };
    for (const c of cols) out[c] = [];
    if (!t) { out.now = this.now(); return { status: 200, body: out }; }
    out.now = this.tick(code);
    const me = !admin && cred.tokenHash ? this.participant(code, cred) : null;
    const rows = this.db.all(`SELECT * FROM docs WHERE code = ? AND updated_at > ? AND updated_at <= ? ORDER BY updated_at LIMIT 20000`, code, since, out.now);
    for (const r of rows) if (out[r.col]) out[r.col].push(this.out(r.col, r, admin, me && me.id));
    if (out.chat.length > 500) out.chat = out.chat.slice(-500);
    if (me) {
      // A participant also gets their own private docs (attendance, survey) so a reload restores them.
      for (const c of ['attendance', 'survey']) out[c] = rows.filter((r) => r.col === c && r.by === me.id).map((r) => this.out(c, r, false, me.id));
      out.me = { id: me.id, nickname: me.nickname };
    }
    if (since) out.removed = this.db.all(`SELECT col, id FROM tombstones WHERE code = ? AND at > ? AND at <= ?`, code, since, out.now).filter((r) => cols.includes(r.col));
    return { status: 200, body: out };
  }

  list(code, col, query, cred) {
    const t = this.training(code);
    const since = Math.max(0, Number(query.get('since')) || 0);
    const admin = this.isAdmin(t, cred);
    if (!t) return { status: 200, body: [] };
    if (PRIVATE_COLS.includes(col) && !admin) {
      const me = this.requireParticipant(code, cred);
      const rows = this.db.all(`SELECT * FROM docs WHERE code = ? AND col = ? AND by = ? AND updated_at > ? ORDER BY updated_at`, code, col, me.id, since);
      return { status: 200, body: rows.map((r) => this.out(col, r, false, me.id)) };
    }
    const viewer = !admin && cred.tokenHash ? (this.participant(code, cred) || {}).id : null;
    const rows = this.db.all(`SELECT * FROM docs WHERE code = ? AND col = ? AND updated_at > ? ORDER BY updated_at LIMIT 20000`, code, col, since);
    return { status: 200, body: rows.map((r) => this.out(col, r, admin, viewer)) };
  }

  add(code, col, body, cred, ip) {
    if (col === 'participants') throw new HttpError(405, 'use_join', '참가자는 /join으로 만듭니다.');
    let t = this.training(code);
    const admin = this.isAdmin(t, cred);
    let me = null;
    if (col === 'polls') { this.requireAdmin(t, cred); this.limit('admin', 'admin:' + code, null); t = t || this.training(code, true); }
    else if (PARTICIPANT_WRITE.has(col)) {
      me = this.requireParticipant(code, cred);
      if (!t) throw new HttpError(404, 'unknown_training', '아직 준비되지 않은 연수 코드입니다.');
      this.limit('write', me.id, ip);
      if (this.rate[col]) this.limit(col, me.id, null);
    } else throw new HttpError(404, 'unknown_collection', '없는 컬렉션입니다.');
    if (!admin && ((col === 'questions' && this.state(code, t).ui?.lockQa === true) || (col === 'posts' && this.state(code, t).ui?.lockBoard === true))) {
      throw new HttpError(409, 'locked', col === 'questions' ? '지금은 질문을 받지 않아요. 강사가 다시 열면 보낼 수 있어요.' : '지금은 보드에 글을 받지 않아요. 강사가 다시 열면 올릴 수 있어요.');
    }
    const { data } = cleanAdd(col, body);
    const cid = body.cid == null ? null : cleanText(body.cid, LIMITS.cid, 'cid') || null;
    const by = me ? me.id : null;
    // idempotent retry
    if (cid) {
      const dup = this.db.get(`SELECT * FROM docs WHERE code = ? AND col = ? AND by IS ? AND cid = ?`, code, col, by, cid);
      if (dup) return { status: 200, body: this.out(col, dup, admin || !!me) };
    }
    if (col === 'posts') data.files = this.ownFiles(code, t, me, data.files, null);
    const now = this.tick(code);
    const nickname = me ? me.nickname : '강사';
    let k = null;
    switch (col) {
      case 'attendance': k = by + '|' + data.kind; data.at = now; break;
      case 'progress': k = by + '|' + data.station; data.at = now; break;
      case 'answers': {
        k = data.poll + '|' + by;
        const poll = this.db.get(`SELECT data FROM docs WHERE code = ? AND col = 'polls' AND id = ?`, code, data.poll);
        if (poll && safeJson(poll.data, {}).open === false) throw new HttpError(409, 'poll_closed', '투표가 닫혔어요.');
        break;
      }
      case 'survey': k = by; break;
      case 'help': Object.assign(data, { nickname, status: 'open', assignee: '' }); break;
      case 'questions': Object.assign(data, { nickname: data.anonymous ? '' : nickname, votes: 0, status: 'open', pinned: false }); break;
      // board pre-moderation: new posts stay hidden until the instructor shows them (init setting or state.ui.moderation, both admin-only)
      case 'posts': Object.assign(data, { nickname, likes: 0, hidden: !admin && (t.settingsObj?.moderation === true || this.state(code, t).ui?.moderation === true) }); break;
      case 'chat': Object.assign(data, { nickname, hidden: false }); break;
      default: break;
    }
    let row; let type = 'add';
    this.db.tx(() => {
      const existing = k ? this.db.get(`SELECT * FROM docs WHERE code = ? AND col = ? AND k = ?`, code, col, k) : null;
      if (existing) {
        const merged = { ...safeJson(existing.data, {}), ...data };
        this.db.run(`UPDATE docs SET data = ?, updated_at = ?, cid = ? WHERE code = ? AND col = ? AND id = ?`, JSON.stringify(merged), now, cid, code, col, existing.id);
        row = { ...existing, data: JSON.stringify(merged), updated_at: now, cid };
        type = 'update';
      } else {
        if (this.count(code, col) >= this.cfg.maxDocs) throw new HttpError(409, 'collection_full', '이 연수에 쌓인 글이 너무 많아요. 강사에게 알려 주세요.');
        const id = col.slice(0, 1) + randomId(9);
        this.db.run(`INSERT INTO docs (code, col, id, by, k, cid, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, code, col, id, by, k, cid, JSON.stringify(data), now, now);
        row = { code, col, id, by, k, cid, data: JSON.stringify(data), created_at: now, updated_at: now };
        if (col === 'posts') this.linkFiles(code, id, this.postFileNames(code, id, data.files));
      }
    });
    if (type === 'add') this.bumpCount(code, col, 1);
    this.touch(t);
    return { status: type === 'add' ? 201 : 200, body: this.out(col, row, true), events: [this.event(type, col, row)] };
  }

  update(code, col, id, body, cred, ip) {
    const t = this.training(code);
    const admin = this.isAdmin(t, cred);
    const row = t ? this.getRow(code, col, cleanId(id, 'id')) : null;
    if (!row) throw new HttpError(404, 'not_found', '없는 글입니다.');
    const me = admin ? null : this.requireParticipant(code, cred);
    const owner = !!me && (col === 'participants' ? row.id === me.id : row.by === me.id);
    if (!admin && !owner) throw new HttpError(403, 'forbidden', '내 글만 고칠 수 있어요.');
    if (me) this.limit('write', me.id, ip); else this.limit('admin', 'admin:' + code, null);
    const patch = cleanPatch(col, body, { admin, owner });
    const cur = safeJson(row.data, {});
    if (owner && !admin && col === 'questions' && cur.status === 'hidden') throw new HttpError(403, 'forbidden', '숨겨진 질문은 고칠 수 없어요.');
    if (owner && !admin && (col === 'posts' || col === 'chat') && cur.hidden) throw new HttpError(403, 'forbidden', '숨겨진 글은 고칠 수 없어요.');
    // L1: an answer cannot change once its poll is closed (same rule as a new answer)
    if (col === 'answers' && !admin) {
      const poll = this.getRow(code, 'polls', String(cur.poll || ''));
      if (poll && safeJson(poll.data, {}).open === false) throw new HttpError(409, 'poll_closed', '투표가 닫혔어요.');
    }
    let dropped = [];
    if (col === 'posts' && patch.files) {
      patch.files = this.ownFiles(code, t, me, patch.files, row.id);
      const keep = new Set(patch.files.map((f) => fileRef(f.url).name));
      dropped = this.postFileNames(code, row.id, cur.files).filter((n) => !keep.has(n));
    }
    const next = { ...cur, ...patch };
    const now = this.tick(code);
    let nrow;
    this.db.tx(() => {
      nrow = this.writeRow(code, col, row, next, now);
      if (col === 'posts') {
        if (dropped.length) this.dropFiles(code, dropped);
        // hiding/showing or new files: (re)link so the file route follows the post's visibility
        if (patch.files || 'hidden' in patch) this.linkFiles(code, row.id, this.postFileNames(code, row.id, next.files));
      }
    });
    this.touch(t);
    return { status: 200, body: this.out(col, nrow, true), events: [this.event('update', col, nrow)], ...(dropped.length ? { deleteFiles: dropped } : {}) };
  }

  remove(code, col, id, cred) {
    const t = this.training(code);
    this.requireAdmin(t, cred);
    const row = t ? this.getRow(code, col, cleanId(id, 'id')) : null;
    if (!row) throw new HttpError(404, 'not_found', '없는 글입니다.');
    const gone = col === 'posts' ? this.postFileNames(code, row.id, safeJson(row.data, {}).files) : [];
    const now = this.tick(code);
    this.db.tx(() => {
      this.db.run(`DELETE FROM docs WHERE code = ? AND col = ? AND id = ?`, code, col, row.id);
      this.db.run(`DELETE FROM votes WHERE code = ? AND col = ? AND doc = ?`, code, col, row.id);
      this.db.run(`INSERT INTO tombstones (code, col, id, at) VALUES (?, ?, ?, ?) ON CONFLICT(code, col, id) DO UPDATE SET at = excluded.at`, code, col, row.id, now);
      if (gone.length) this.dropFiles(code, gone);
    });
    this.bumpCount(code, col, -1);
    const ev = { type: 'remove', col, doc: { id: row.id }, pub: PUBLIC_COLS.includes(col) ? { id: row.id } : null };
    return { status: 200, body: { ok: true }, events: [ev], ...(gone.length ? { deleteFiles: gone } : {}) };
  }

  /** One vote (questions) / like (posts) per participant; idempotent. */
  vote(code, col, id, cred, ip) {
    const me = this.requireParticipant(code, cred);
    const t = this.training(code);
    if (!t) throw new HttpError(404, 'unknown_training', '아직 준비되지 않은 연수 코드입니다.');
    this.limit('vote', me.id, ip);
    const row = this.getRow(code, col, cleanId(id, 'id'));
    if (!row) throw new HttpError(404, 'not_found', '없는 글입니다.');
    const field = col === 'questions' ? 'votes' : 'likes';
    const cur = safeJson(row.data, {});
    if (col === 'questions' && cur.status === 'hidden') throw new HttpError(409, 'hidden', '숨겨진 질문입니다.');
    const exists = this.db.get(`SELECT 1 AS x FROM votes WHERE code = ? AND col = ? AND doc = ? AND by = ?`, code, col, row.id, me.id);
    if (exists) return { status: 200, body: { [field]: cur[field] || 0, voted: true, already: true } };
    let nrow;
    const now = this.tick(code);
    this.db.tx(() => {
      this.db.run(`INSERT INTO votes (code, col, doc, by) VALUES (?, ?, ?, ?)`, code, col, row.id, me.id);
      const n = this.db.get(`SELECT COUNT(*) AS n FROM votes WHERE code = ? AND col = ? AND doc = ?`, code, col, row.id).n;
      nrow = this.writeRow(code, col, row, { ...cur, [field]: n }, now);
    });
    this.touch(t);
    const n = safeJson(nrow.data, {})[field];
    return { status: 200, body: { [field]: n, voted: true }, events: [this.event('update', col, nrow)] };
  }

  react(code, body, cred, ip) {
    const t = this.training(code);
    if (!t) throw new HttpError(404, 'unknown_training', '아직 준비되지 않은 연수 코드입니다.');
    const emoji = isObj(body) ? body.emoji : null;
    if (!EMOJIS.includes(emoji)) throw bad('invalid_value', 'emoji');
    const me = this.participant(code, cred);
    this.limit('react', me ? me.id : 'ip:' + (ip || '?'), me ? ip : null);
    return { status: 200, body: { ok: true }, reaction: emoji };
  }

  /** Collects every doc of a training (admin view) — used by export. */
  allDocs(code) {
    const data = {}; for (const c of COLS) data[c] = [];
    for (const r of this.db.all(`SELECT * FROM docs WHERE code = ? ORDER BY created_at`, code)) data[r.col].push(this.out(r.col, r, true));
    return data;
  }
  exportCsv(code, kind, cred, opts) {
    const t = this.training(code);
    this.requireAdmin(t, cred);
    if (!EXPORT_KINDS.includes(kind)) throw bad('bad_kind', 'kind: ' + EXPORT_KINDS.join('|'));
    const tbl = exportTable(kind, t ? this.allDocs(code) : Object.fromEntries(COLS.map((c) => [c, []])), this.cfg.timeZone, opts);
    return { status: 200, contentType: 'text/csv; charset=utf-8', body: toCsv(tbl.columns, tbl.rows), filename: `${code}-${kind}.csv` };
  }

  /** Deletes every doc, vote, state and file record of the training (the training key itself stays). */
  purge(code, cred) {
    const t = this.training(code);
    this.requireAdmin(t, cred);
    return { status: 200, body: { ok: true }, ...this.wipe(code), events: [{ type: 'reset', col: null, doc: null, pub: {} }] };
  }
  wipe(code, dropTraining = false) {
    if (!this.ready) return { purgedFiles: [] };
    const files = this.db.all(`SELECT name FROM files WHERE code = ?`, code).map((r) => r.name);
    this.db.tx(() => {
      for (const tbl of ['docs', 'votes', 'tombstones', 'state', 'files', 'file_refs']) this.db.run(`DELETE FROM ${tbl} WHERE code = ?`, code);
      if (dropTraining) this.db.run(`DELETE FROM trainings WHERE code = ?`, code);
    });
    this.stamps.delete(code);
    for (const c of COLS) this.counts.delete(code + '|' + c);
    return { purgedFiles: files };
  }
  /** Drops trainings idle past their retention. Returns [{code, files}]. Run hourly/daily. */
  cleanup() {
    if (!this.ready) return [];
    const now = this.now(); const out = [];
    for (const t of this.db.all(`SELECT * FROM trainings`)) {
      t.settingsObj = safeJson(t.settings, {});
      if (now - t.last_at > this.retentionDays(t) * DAY) out.push({ code: t.code, files: this.wipe(t.code, true).purgedFiles });
    }
    // trainings auto-created then never used again keep no data; tombstones older than retention are dropped too
    this.db.run(`DELETE FROM tombstones WHERE at < ?`, now - this.cfg.maxRetentionDays * DAY);
    return out;
  }
  /** Uploads never attached to a post within maxAge: records dropped, [{code, name}] returned for the host to delete. */
  sweepOrphans(maxAge = DAY) {
    if (!this.ready) return [];
    const rows = this.db.all(`SELECT f.code AS code, f.name AS name FROM files f JOIN file_refs r ON r.code = f.code AND r.name = f.name WHERE r.post IS NULL AND f.created_at < ?`, this.now() - maxAge);
    if (rows.length) this.db.tx(() => { for (const r of rows) this.dropFiles(r.code, [r.name]); });
    return rows;
  }

  // ----- uploads (host stores bytes; core validates & records) -----
  async authorizeUpload(code, headers, ip) {
    const cred = await this.credentials(headers);
    const c = normCode(code);
    const t = this.training(c);
    const me = this.requireParticipant(c, cred);
    if (!t) throw new HttpError(404, 'unknown_training', '아직 준비되지 않은 연수 코드입니다.');
    if (!this.uploadsAllowed(c, t)) throw new HttpError(503, 'uploads_disabled', '이 연수는 파일 올리기를 쓰지 않습니다.');
    this.limit('upload', me.id, ip);
    return { code: c, me, maxBytes: this.uploadLimit(t), training: t };
  }
  /** head: Uint8Array with the first bytes (≥12) of the file. */
  checkUpload({ size, head, name, maxBytes }) {
    if (size > maxBytes) throw new HttpError(413, 'too_large', `파일은 ${Math.floor(maxBytes / 1048576)}MB까지 올릴 수 있어요.`, { max: maxBytes });
    if (!size) throw bad('empty', '빈 파일입니다.');
    // The type comes from the bytes only; the declared Content-Type is ignored.
    const type = sniffType(head);
    if (!type) throw new HttpError(415, 'unsupported_type', '이미지(PNG·JPG·GIF·WEBP)·PDF·MP3·MP4만 올릴 수 있어요.');
    return { type, stored: randomId(12) + '.' + UPLOAD_TYPES[type], name: safeFileName(name, type) };
  }
  /** Records an upload as "not attached yet": it is served only once a visible post links it. */
  recordFile(code, { stored, type, size, by }) {
    this.db.tx(() => {
      this.db.run(`INSERT INTO files (code, name, type, size, by, created_at) VALUES (?, ?, ?, ?, ?, ?)`, code, stored, type, size, by, this.now());
      this.db.run(`INSERT INTO file_refs (code, name, post) VALUES (?, ?, NULL) ON CONFLICT(code, name) DO NOTHING`, code, stored);
    });
  }
  /** The stored file when it may be served, else null (unknown, not attached, or its post is hidden/removed). */
  fileMeta(code, name) {
    if (!this.ready || !FILE_NAME_RE.test(name)) return null;
    const f = this.db.get(`SELECT f.*, r.name AS tracked, r.post AS post FROM files f LEFT JOIN file_refs r ON r.code = f.code AND r.name = f.name WHERE f.code = ? AND f.name = ?`, code, name);
    if (!f) return null;
    if (f.tracked) {
      if (!f.post) return null;
      const p = this.getRow(code, 'posts', f.post);
      if (!p || safeJson(p.data, {}).hidden) return null;
    }
    return f;
  }
}

export function decodeHeader(v) {
  if (v == null || v === '') return null;
  try { return decodeURIComponent(v); } catch { return v; }
}
function rateErr(ms) {
  return new HttpError(429, 'rate_limited', '잠시 후 다시 시도해 주세요.', { retryAfter: Math.max(1, Math.ceil(ms / 1000)) });
}
function safeJson(s, dflt) { try { return s ? JSON.parse(s) : dflt; } catch { return dflt; } }

/** Error → { status, body } (never leaks stack traces). */
export function errorBody(e) {
  if (e instanceof HttpError) return { status: e.status, body: { error: e.code, message: e.message, ...(e.extra || {}) }, retryAfter: e.extra && e.extra.retryAfter };
  return { status: 500, body: { error: 'server_error', message: '서버 오류가 났어요. 잠시 후 다시 시도해 주세요.' } };
}
