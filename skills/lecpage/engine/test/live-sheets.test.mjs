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
import { skillDir, liveDir } from './live-helpers.mjs';

const ADMIN = '시트관리자키-1234';
function makeGas() {
  const sheets = new Map(); const props = new Map(); const cache = new Map();
  const formulas = [];
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
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => { throw new Error('no ui'); } },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (props.has(k) ? props.get(k) : null), setProperty: (k, v) => { props.set(k, String(v)); },
      setProperties: (o) => { for (const k in o) props.set(k, String(o[k])); }, deleteProperty: (k) => { props.delete(k); }, getKeys: () => [...props.keys()],
    }) },
    CacheService: { getScriptCache: () => ({ get: (k) => (cache.has(k) ? cache.get(k) : null), put: (k, v) => { cache.set(k, v); }, remove: (k) => { cache.delete(k); } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, s) => toSigned(createHash('sha256').update(String(s), 'utf8').digest()),
      getUuid: () => randomUUID(), base64Decode: (s) => toSigned(Buffer.from(s, 'base64')),
      formatDate: (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d),
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ setMimeType() { return this; }, getContent: () => s }) },
  };
  vm.createContext(g);
  vm.runInContext(fs.readFileSync(path.join(skillDir, 'backends/apps-script/Code.gs'), 'utf8'), g, { filename: 'Code.gs' });
  return { g, sheets, props, formulas };
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
  const code = 'SHEET2';
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
