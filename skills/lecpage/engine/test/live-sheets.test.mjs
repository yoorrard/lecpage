// Runs backends/apps-script/Code.gs inside a small mock of the Apps Script runtime (SpreadsheetApp,
// PropertiesService, CacheService, LockService, Utilities, ContentService) behind a local HTTP shim,
// then drives engine/runtime/live/sheets.js against it. Real Google behaviour (quotas, redirects,
// Drive sharing) is not covered — see backends/apps-script/README.md for the manual checklist.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { skillDir, liveDir, PNG_1PX } from './live-helpers.mjs';

const ADMIN = '시트관리자키-1234';
function makeGas() {
  const sheets = new Map(); const props = new Map(); const cache = new Map();
  const formulas = [];
  // Drive: just enough to see sharing and trash
  const drive = { files: new Map(), seq: 0 };
  const DriveApp = {
    Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK', PRIVATE: 'PRIVATE' }, Permission: { VIEW: 'VIEW', NONE: 'NONE' },
    getFoldersByName: () => ({ hasNext: () => false }),
    createFolder: () => ({
      createFile: () => {
        const id = 'drv' + String(++drive.seq).padStart(24, '0');
        const f = { id, sharing: 'PRIVATE', trashed: false, getId: () => id, setSharing(a) { this.sharing = a; return this; }, setTrashed(t) { this.trashed = t; return this; } };
        drive.files.set(id, f); return f;
      },
    }),
    getFileById: (id) => { const f = drive.files.get(id); if (!f) throw new Error('no such file'); return f; },
  };
  const toSigned = (buf) => [...buf].map((b) => (b > 127 ? b - 256 : b));
  function sheetObj(name) {
    const data = [];
    const range = (r, c, nr, nc) => ({
      setValues(vals) { vals.forEach((row, i) => { data[r - 1 + i] = data[r - 1 + i] || []; row.forEach((v, j) => { if (typeof v === 'string' && v.startsWith('=')) formulas.push(v); data[r - 1 + i][c - 1 + j] = v; }); }); return this; },
      getValues() { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { let v = (data[r - 1 + i] || [])[c - 1 + j]; if (typeof v === 'string' && v.startsWith("'")) v = v.slice(1); row.push(v ?? ''); } out.push(row); } return out; },
      setFontWeight() { return this; }, setNumberFormat() { return this; },
    });
    return {
      name, data,
      getRange: range, getLastRow: () => data.length, getMaxRows: () => 1000, setFrozenRows() {},
      appendRow(row) { row.forEach((v) => { if (typeof v === 'string' && v.startsWith('=')) formulas.push(v); }); data.push(row.slice()); },
      deleteRow(r) { data.splice(r - 1, 1); }, deleteRows(r, n) { data.splice(r - 1, n); },
    };
  }
  const ss = { getSheetByName: (n) => sheets.get(n) || null, insertSheet: (n) => { const s = sheetObj(n); sheets.set(n, s); return s; } };
  const g = {
    console, JSON, Math, Date, Array, Object, String, Number, RegExp, Error, Intl,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => { throw new Error('no ui'); } }, DriveApp,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (props.has(k) ? props.get(k) : null), setProperty: (k, v) => { props.set(k, String(v)); },
      setProperties: (o) => { for (const k in o) props.set(k, String(o[k])); }, deleteProperty: (k) => { props.delete(k); }, getKeys: () => [...props.keys()], getProperties: () => Object.fromEntries(props),
    }) },
    CacheService: { getScriptCache: () => ({ get: (k) => (cache.has(k) ? cache.get(k) : null), put: (k, v) => { cache.set(k, v); }, remove: (k) => { cache.delete(k); } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, s) => toSigned(createHash('sha256').update(String(s), 'utf8').digest()),
      getUuid: () => randomUUID(), base64Decode: (s) => toSigned(Buffer.from(s, 'base64')), newBlob: (bytes, type, name) => ({ bytes, type, name }),
      formatDate: (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d),
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ setMimeType() { return this; }, getContent: () => s }) },
  };
  vm.createContext(g);
  vm.runInContext(fs.readFileSync(path.join(skillDir, 'backends/apps-script/Code.gs'), 'utf8'), g, { filename: 'Code.gs' });
  return { g, sheets, props, formulas, cache, drive };
}

let gas; let server; let url;
before(async () => {
  gas = makeGas();
  gas.g.setup();
  gas.props.set('ADMIN_HASH', createHash('sha256').update(ADMIN).digest('hex'));
  server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const out = req.method === 'GET' ? gas.g.doGet({ parameter: Object.fromEntries(u.searchParams) }) : gas.g.doPost({ postData: { contents: body } });
      res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
      res.end(out.getContent());
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${server.address().port}/exec`;
});
after(() => server?.close());

const call = async (body) => (await (await fetch(url, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(body) })).json());

test('apps-script: JSON API — join, validation, formula-safe storage, votes, rate limit, export, purge', async () => {
  const code = 'SHEET1';
  const ping = await (await fetch(url + '?a=ping')).json();
  assert.equal(ping.ok, true);
  const me = (await call({ a: 'join', code, nickname: '=HYPERLINK("x")' })).data;
  assert.ok(me.token);
  const q = (await call({ a: 'add', code, token: me.token, col: 'questions', doc: { text: '=IMPORTXML("http://evil","//a")', cid: 'x1' } })).data;
  assert.equal(q.text, '=IMPORTXML("http://evil","//a")');
  assert.deepEqual(gas.formulas, [], 'nothing reached the sheet as a formula');
  assert.equal((await call({ a: 'add', code, token: me.token, col: 'questions', doc: { text: '다시', cid: 'x1' } })).data.id, q.id, 'idempotent cid');
  const tooLong = await call({ a: 'add', code, token: me.token, col: 'questions', doc: { text: 'ㄱ'.repeat(501) } });
  assert.equal(tooLong.ok, false); assert.equal(tooLong.status, 400); assert.equal(tooLong.error, 'too_long');
  assert.equal((await call({ a: 'add', code, token: 'nope', col: 'questions', doc: { text: 'x' } })).status, 401);
  const other = (await call({ a: 'join', code, nickname: '둘' })).data;
  assert.equal((await call({ a: 'vote', code, token: other.token, id: q.id })).data.votes, 1);
  assert.equal((await call({ a: 'vote', code, token: other.token, id: q.id })).data.already, true);
  let limited;
  for (let i = 0; i < 9 && !limited; i++) { const r = await call({ a: 'add', code, token: other.token, col: 'questions', doc: { text: '질문' + i } }); if (!r.ok) limited = r; }
  assert.equal(limited.status, 429);
  const snap = (await (await fetch(`${url}?a=snapshot&code=${code}&since=0`)).json()).data;
  assert.ok(snap.questions.length >= 2); assert.equal(snap.participants, undefined); assert.equal(snap.questions[0].by, undefined);
  assert.equal((await call({ a: 'setState', code, admin: 'wrong', patch: { slide: 1 } })).status, 403);
  assert.equal((await call({ a: 'setState', code, admin: ADMIN, patch: { slide: 2, notice: { text: '공지' } } })).data.slide, 2);
  const csv = (await call({ a: 'export', code, admin: ADMIN, kind: 'questions' })).data;
  assert.ok(csv.startsWith('﻿작성 시각')); assert.match(csv, /'=IMPORTXML/);
  assert.equal((await call({ a: 'purge', code, admin: 'x' })).status, 403);
  assert.equal((await call({ a: 'purge', code, admin: ADMIN })).ok, true);
  const after = (await call({ a: 'snapshot', code, since: 0, admin: ADMIN })).data;
  assert.equal(after.questions.length, 0); assert.equal(after.participants.length, 0);
});

function makeWindow() {
  const win = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, Promise, URL, TextEncoder, TextDecoder, Intl, JSON, Math, Date, fetch,
    crypto: globalThis.crypto, Uint8Array, Array, Object, String, Number, RegExp, Error, addEventListener() {}, removeEventListener() {},
  };
  win.window = win;
  vm.createContext(win);
  for (const f of ['core.js', 'sheets.js']) vm.runInContext(fs.readFileSync(path.join(liveDir, f), 'utf8'), win, { filename: f });
  return win;
}

test('apps-script + sheets.js: two clients sync by polling; admin sees private data; purge resets others', async () => {
  const code = 'SHEET1'; // one sheet = one training code (fixed by the first join above)
  const A = makeWindow(); const B = makeWindow();
  const a = A.LecLive.create({ provider: 'sheets', url, code, allowAnyUrl: true });
  const b = B.LecLive.create({ provider: 'sheets', url, code, allowAnyUrl: true, adminKey: ADMIN });
  assert.equal((await a.connect()).mode, 'polling'); await b.connect();
  assert.equal(a.status, 'polling');
  await a.join({ nickname: '시트참가자' });
  const q = await a.add('questions', { text: '시트로 보낸 질문' });
  assert.ok(q.id && !q._pending);
  await b.sync();
  assert.equal(b.store('questions')[0].text, '시트로 보낸 질문');
  assert.equal(b.store('participants').length, 1, 'admin client reads private collections');
  await b.setState({ notice: { text: '시트 공지', level: 'info' } });
  await a.sync();
  assert.equal(a.state.notice.text, '시트 공지');
  assert.equal(await b.checkAdmin(), true);
  const csv = await b.exportCsv('attendance');
  assert.match(csv, /시트참가자/);
  await b.purge();
  await a.sync(); // sees the new epoch → reset → full reload
  await new Promise((r) => setTimeout(r, 50));
  await a.sync();
  assert.equal(a.store('questions').length, 0);
  a.close(); b.close();
});

// ---------------------------------------------------------------- security regressions (2026-11 review)
const PNG_B64 = Buffer.from(PNG_1PX).toString('base64');

test('apps-script (L11, L1, L3, nicknames): one code per sheet, closed polls, no `by` for the public', async () => {
  const code = 'SHEET1';
  const other = await call({ a: 'join', code: 'OTHER1', nickname: 'x' });
  assert.equal(other.status, 404); assert.equal(other.error, 'unknown_training', 'a code the sheet was not set up for is refused');
  for (const n of ['강사', 'Admin', '운영자님']) assert.equal((await call({ a: 'join', code, nickname: n })).error, 'reserved_nickname', n);
  const a = (await call({ a: 'join', code, nickname: '하나' })).data;
  assert.equal((await call({ a: 'update', code, token: a.token, col: 'participants', id: a.id, patch: { nickname: 'LECPAGE' } })).error, 'reserved_nickname');
  const poll = (await call({ a: 'add', code, admin: ADMIN, col: 'polls', doc: { question: '좋았나요?', options: ['예', '아니요'], open: true } })).data;
  const ans = (await call({ a: 'add', code, token: a.token, col: 'answers', doc: { poll: poll.id, value: '예' } })).data;
  await call({ a: 'add', code, token: a.token, col: 'progress', doc: { station: 's1', status: 'stuck' } });
  await call({ a: 'update', code, admin: ADMIN, col: 'polls', id: poll.id, patch: { open: false } });
  const late = await call({ a: 'update', code, token: a.token, col: 'answers', id: ans.id, patch: { value: '아니요' } });
  assert.equal(late.status, 409); assert.equal(late.error, 'poll_closed');
  const pub = (await (await fetch(`${url}?a=snapshot&code=${code}&since=0`)).json()).data;
  assert.ok(pub.answers.length && pub.answers.every((d) => d.by === undefined)); assert.ok(pub.progress.every((d) => d.by === undefined));
  const mine = (await call({ a: 'snapshot', code, since: 0, token: a.token })).data;
  assert.equal(mine.answers.find((d) => d.id === ans.id).by, a.id, 'my own answer keeps by');
});

test('apps-script (M7, H3, M8): own Drive files only; sharing follows the post; trash on remove and purge', async () => {
  const code = 'SHEET1'; gas.props.set('UPLOADS', 'on');
  const a = (await call({ a: 'join', code, nickname: '하나' })).data; const b = (await call({ a: 'join', code, nickname: '둘' })).data;
  const up = (await call({ a: 'upload', code, token: a.token, name: 'a.png', type: 'image/png', data: PNG_B64 })).data;
  const f = () => gas.drive.files.get(up.id);
  assert.equal(f().sharing, 'PRIVATE', 'private until a visible post uses it');
  const file = (u) => ({ url: u, name: 'a.png', type: 'image/png', size: 1 });
  for (const u of ['https://tracker.example/p.png', 'https://drive.google.com/thumbnail?id=' + 'x'.repeat(28) + '&sz=w1600']) {
    assert.equal((await call({ a: 'add', code, token: a.token, col: 'posts', doc: { text: 'x', files: [file(u)] } })).status, 400, u);
  }
  assert.equal((await call({ a: 'add', code, token: b.token, col: 'posts', doc: { text: '남의 파일', files: [file(up.url)] } })).status, 400);
  const post = (await call({ a: 'add', code, token: a.token, col: 'posts', doc: { text: '사진', files: [file(up.url)] } })).data;
  assert.equal(f().sharing, 'ANYONE_WITH_LINK');
  assert.equal((await call({ a: 'add', code, token: a.token, col: 'posts', doc: { text: '또', files: [file(up.url)] } })).status, 400, 'one file, one post');
  await call({ a: 'update', code, admin: ADMIN, col: 'posts', id: post.id, patch: { hidden: true } });
  assert.equal(f().sharing, 'PRIVATE', 'hidden → private at once');
  await call({ a: 'update', code, admin: ADMIN, col: 'posts', id: post.id, patch: { hidden: false } });
  assert.equal(f().sharing, 'ANYONE_WITH_LINK');
  await call({ a: 'remove', code, admin: ADMIN, col: 'posts', id: post.id });
  assert.equal(f().trashed, true, 'removed post → file in the Drive trash');
  const up2 = (await call({ a: 'upload', code, token: a.token, name: 'b.png', type: 'image/png', data: PNG_B64 })).data;
  await call({ a: 'setState', code, admin: ADMIN, patch: { ui: { uploads: false } } });
  assert.equal((await call({ a: 'upload', code, token: a.token, name: 'c.png', type: 'image/png', data: PNG_B64 })).error, 'uploads_disabled');
  assert.equal((await call({ a: 'add', code, token: a.token, col: 'posts', doc: { text: 'x', files: [file(up2.url)] } })).error, 'uploads_disabled');
  await call({ a: 'purge', code, admin: ADMIN });
  assert.equal(gas.drive.files.get(up2.id).trashed, true, 'purge trashes every recorded upload');
});

test('apps-script (H4): wrong admin keys are counted; after 20 the sheet answers 429, the right key too', async () => {
  const code = 'SHEET1';
  for (const k of [...gas.cache.keys()]) if (k.startsWith('af:')) gas.cache.delete(k); // earlier tests sent wrong keys too
  for (let i = 0; i < 20; i++) assert.equal((await call({ a: 'checkAdmin', code, admin: 'guess-' + i })).data, false);
  const locked = await call({ a: 'setState', code, admin: ADMIN, patch: { slide: 1 } });
  assert.equal(locked.status, 429); assert.ok(locked.retryAfter > 0);
  assert.equal((await call({ a: 'snapshot', code, since: 0, admin: 'guess' })).status, 429, 'reads with a key are gated too');
  for (const k of [...gas.cache.keys()]) if (k.startsWith('af:')) gas.cache.delete(k);
  assert.equal((await call({ a: 'setState', code, admin: ADMIN, patch: { slide: 1 } })).ok, true);
});

test('apps-script (2026-11c): instructor locks refuse new questions/posts; invisible characters and stacked marks are removed', async () => {
  const code = 'SHEET1';
  for (const k of [...gas.cache.keys()]) if (k.startsWith('af:')) gas.cache.delete(k);
  const a = (await call({ a: 'join', code, nickname: '잠금시험' })).data;
  const inv = String.fromCharCode(0x202e, 0x200b, 0x2066, 0x3164, 0xad);
  const zal = 'Z' + String.fromCharCode(0x301, 0x302, 0x303, 0x304, 0x305, 0x306);
  const q1 = await call({ a: 'add', code, token: a.token, col: 'questions', doc: { text: `가${inv}나 ${zal}` } });
  assert.equal(q1.data.text, '가나 ' + 'Ź' + String.fromCharCode(0x302, 0x303));
  assert.equal((await call({ a: 'join', code, nickname: '강' + String.fromCharCode(0x3164) + '사' })).error, 'reserved_nickname');
  assert.equal((await call({ a: 'setState', code, admin: ADMIN, patch: { ui: { lockQa: true, lockBoard: true } } })).ok, true);
  for (const col of ['questions', 'posts']) { const r = await call({ a: 'add', code, token: a.token, col, doc: { text: '잠긴 뒤' } }); assert.equal(r.status, 409, col); assert.equal(r.error, 'locked', col); }
  await call({ a: 'setState', code, admin: ADMIN, patch: { ui: { lockQa: null, lockBoard: null } } });
  assert.equal((await call({ a: 'add', code, token: a.token, col: 'questions', doc: { text: '다시 열림' } })).ok, true);
});

test('apps-script (2026-11d): a session survives the sheet-wide lockout; polls keep to options; first check-in; name later; lockJoin', async () => {
  const code = 'SHEET1';
  for (const k of [...gas.cache.keys()]) if (k.startsWith('af:')) gas.cache.delete(k);
  const s = (await call({ a: 'session', code, admin: ADMIN })).data;
  assert.match(s.session, /^lps1\.[A-Za-z0-9_-]{43}$/); assert.ok(s.expiresAt > Date.now() + 11 * 3600e3);
  assert.ok(![...gas.props.values()].some((v) => String(v).includes(s.session)), 'only the hash is stored');
  for (let i = 0; i < 20; i++) await call({ a: 'checkAdmin', code, admin: 'guess-' + i });
  assert.equal((await call({ a: 'setState', code, admin: ADMIN, patch: { slide: 2 } })).status, 429, 'key attempts stay locked');
  assert.equal((await call({ a: 'setState', code, admin: s.session, patch: { slide: 2 } })).ok, true, 'the open console keeps working');
  assert.ok((await call({ a: 'snapshot', code, since: 0, admin: s.session })).data.participants, 'admin view with the session');
  const fake = await call({ a: 'checkAdmin', code, admin: 'lps1.' + 'x'.repeat(43) });
  assert.equal(fake.status, 401); assert.equal(fake.error, 'session_expired');
  const a = (await call({ a: 'join', code, nickname: '투표자' })).data;
  const poll = (await call({ a: 'add', code, admin: s.session, col: 'polls', doc: { question: '고르기', options: ['가', '나'], open: true } })).data;
  for (const v of [['가', '가', '가'], '<img>']) assert.equal((await call({ a: 'add', code, token: a.token, col: 'answers', doc: { poll: poll.id, value: v } })).error, 'invalid_value');
  assert.equal((await call({ a: 'add', code, token: a.token, col: 'answers', doc: { poll: poll.id, value: ['나'] } })).data.value, '나');
  assert.equal((await call({ a: 'add', code, token: a.token, col: 'answers', doc: { poll: 'nope', value: 'X' } })).error, 'unknown_poll');
  const reg = (await call({ a: 'add', code, admin: s.session, col: 'polls', doc: { question: '척도', kind: 'scale', options: [], open: true, cid: 'bp:sc1' } })).data;
  assert.equal((await call({ a: 'add', code, admin: s.session, col: 'polls', doc: { question: '척도', kind: 'scale', options: [], open: true, cid: 'bp:sc1' } })).data.id, reg.id);
  assert.equal((await call({ a: 'add', code, token: a.token, col: 'answers', doc: { poll: 'sc1', value: 5 } })).data.value, '5');
  assert.equal((await call({ a: 'add', code, token: a.token, col: 'answers', doc: { poll: 'signal', value: 'red' } })).ok, true);
  const in1 = (await call({ a: 'add', code, token: a.token, col: 'attendance', doc: { kind: 'in' } })).data;
  await new Promise((r) => setTimeout(r, 15));
  assert.equal((await call({ a: 'add', code, token: a.token, col: 'attendance', doc: { kind: 'in' } })).data.at, in1.at, 'the first check-in stays');
  assert.equal((await call({ a: 'update', code, token: a.token, col: 'participants', id: a.id, patch: { name: '홍길동' } })).error, 'consent_required');
  const named = (await call({ a: 'update', code, token: a.token, col: 'participants', id: a.id, patch: { name: '홍길동', school: '한빛초', consent: true } })).data;
  assert.equal(named.name, '홍길동'); assert.ok(named.consentAt > 0);
  await call({ a: 'setState', code, admin: s.session, patch: { ui: { lockJoin: true } } });
  assert.equal((await call({ a: 'join', code, nickname: '늦게' })).error, 'locked');
  await call({ a: 'setState', code, admin: s.session, patch: { ui: { lockJoin: null } } });
  for (const n of ['관리자', '선생님', '운영진', 'аdmin']) assert.equal((await call({ a: 'join', code, nickname: n })).error, 'reserved_nickname', n);
  for (const k of [...gas.cache.keys()]) if (k.startsWith('af:')) gas.cache.delete(k);
});
