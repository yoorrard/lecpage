// Shared helpers for the live (realtime) tests. Not a test file itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const skillDir = path.resolve(here, '../..');
export const liveDir = path.join(skillDir, 'engine/runtime/live');
export const nodeServerDir = path.join(skillDir, 'backends/node-server');

export function tmpDir(prefix = 'lec-live-') { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }

/** Starts the Node server in-process on a random port. */
export async function startNodeServer(opts = {}) {
  const { start, readOptions } = await import(path.join(nodeServerDir, 'server.mjs'));
  const o = readOptions([], {});
  // many test codes come from one IP: relax the per-IP "new training" limit unless a test sets its own
  Object.assign(o, { port: 0, host: '127.0.0.1', data: tmpDir(), quiet: true, generateKey: false, rate: { create: [100000, 3600e3] } }, opts);
  const s = await start(o);
  const close = s.close;
  s.dataDir = o.data;
  s.close = async () => { await close(); fs.rmSync(o.data, { recursive: true, force: true }); };
  return s;
}

export function api(base, code) {
  const root = base.replace(/\/+$/, '') + '/api/' + code;
  async function call(method, p, { token, admin, setup, body, headers = {}, raw = false } = {}) {
    const h = { ...headers };
    if (token) h['x-lec-token'] = token;
    if (admin) h['x-lec-admin'] = encodeURIComponent(admin);
    if (setup) h['x-lec-setup'] = encodeURIComponent(setup);
    let b = body;
    if (body !== undefined && !(body instanceof Uint8Array) && !(body instanceof FormData) && typeof body !== 'string') { h['content-type'] = 'application/json'; b = JSON.stringify(body); }
    const res = await fetch(root + p, { method, headers: h, body: b });
    if (raw) return res;
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: res.status, body: json, headers: res.headers };
  }
  return { root, call };
}

/** Reads an SSE stream; resolves with the first message matching pred. */
export async function sseUntil(url, pred, timeoutMs = 5000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  const msgs = [];
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { accept: 'text/event-stream' } });
    assert.equal(res.headers.get('content-type').split(';')[0], 'text/event-stream');
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
        const data = chunk.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n');
        if (!data) continue;
        const m = JSON.parse(data); msgs.push(m);
        if (pred(m, msgs)) { ctl.abort(); return { msg: m, msgs }; }
      }
    }
  } catch (e) { if (e.name !== 'AbortError') throw e; } finally { clearTimeout(t); }
  throw new Error('SSE: expected message not received; got ' + JSON.stringify(msgs));
}

export function wsOpen(url, { admin, headers } = {}) {
  return new Promise((resolve, reject) => {
    const ws = headers ? new WebSocket(url, { headers }) : new WebSocket(url);
    const msgs = []; const waiters = [];
    const t = setTimeout(() => reject(new Error('ws timeout')), 5000);
    ws.onmessage = (e) => {
      const m = e.data === 'pong' ? { type: 'pong-text' } : JSON.parse(e.data); msgs.push(m);
      for (const w of waiters.slice()) if (w.pred(m)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(m); }
      if (m.type === 'hello') { clearTimeout(t); if (admin) ws.send(JSON.stringify({ type: 'auth', admin })); resolve(api); }
    };
    ws.onerror = (e) => reject(new Error('ws error ' + (e.message || '')));
    let closedWith = null; const closed = new Promise((res) => { ws.onclose = (e) => { closedWith = e.code; res(e.code); }; });
    const api = {
      ws, msgs, closed, get closeCode() { return closedWith; },
      next(pred, ms = 5000) {
        const hit = msgs.find(pred); if (hit) { msgs.splice(msgs.indexOf(hit), 1); return Promise.resolve(hit); }
        return new Promise((res, rej) => { const w = { pred, resolve: (m) => { msgs.splice(msgs.indexOf(m), 1); clearTimeout(w.t); res(m); } }; w.t = setTimeout(() => rej(new Error('ws: no matching message; got ' + JSON.stringify(msgs))), ms); waiters.push(w); });
      },
      close() { try { ws.close(); } catch { /* ignore */ } },
    };
  });
}

export const PNG_1PX = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));

/**
 * Protocol v1 conformance suite. `ctx()` returns { base, adminKey, code(suffix) } once the server is up.
 * Used for the Node server here and for `wrangler dev` (LEC_TEST_URL) in live-cloudflare.test.mjs.
 */
export function protocolSuite(name, ctx, { uploads = true, ws = true } = {}) {
  const uniq = () => Math.random().toString(36).slice(2, 8).toUpperCase();
  const fresh = (p = 'T') => { const c = ctx(); return { ...c, code: (p + uniq()).slice(0, 12), a: null }; };
  const joinAs = async (a, nickname = '선생님') => (await a.call('POST', '/join', { body: { nickname } })).body;

  test(`${name}: join validates input and returns a token`, async () => {
    const c = fresh('J'); const a = api(c.base, c.code);
    const ok = await a.call('POST', '/join', { body: { nickname: '김선생' } });
    assert.equal(ok.status, 201); assert.match(ok.body.id, /^p/); assert.ok(ok.body.token.length >= 40);
    const long = await a.call('POST', '/join', { body: { nickname: '가'.repeat(21) } });
    assert.equal(long.status, 400); assert.equal(long.body.error, 'too_long');
    const noConsent = await a.call('POST', '/join', { body: { nickname: 'a', name: '홍길동' } });
    assert.equal(noConsent.status, 400); assert.equal(noConsent.body.error, 'consent_required');
    const consent = await a.call('POST', '/join', { body: { nickname: 'a', name: '홍길동', school: '한빛초', consent: true } });
    assert.equal(consent.status, 201);
    const badJson = await fetch(a.root + '/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' });
    assert.equal(badJson.status, 400);
    const badCode = await api(c.base, 'x!').call('GET', '/snapshot');
    assert.equal(badCode.status, 400);
  });

  test(`${name}: questions — add, anonymity, idempotent cid, one vote each, limits`, async () => {
    const c = fresh('Q'); const a = api(c.base, c.code);
    const p1 = await joinAs(a); const p2 = await joinAs(a, '두번째');
    const q = await a.call('POST', '/questions', { token: p1.token, body: { text: '  <img src=x onerror=alert(1)> 질문‮ ', cid: 'cid-1', votes: 99, by: 'hacker' } });
    assert.equal(q.status, 201);
    assert.equal(q.headers.get('content-type').split(';')[0], 'application/json');
    assert.equal(q.body.text, '<img src=x onerror=alert(1)> 질문', 'stored verbatim (clients use textContent), bidi override stripped');
    assert.equal(q.body.votes, 0); assert.equal(q.body.by, undefined); assert.equal(q.body.anonymous, true); assert.equal(q.body.nickname, '');
    const again = await a.call('POST', '/questions', { token: p1.token, body: { text: '다른 내용', cid: 'cid-1' } });
    assert.equal(again.body.id, q.body.id, 'same cid → same doc');
    const named = await a.call('POST', '/questions', { token: p2.token, body: { text: '이름 공개', anonymous: false } });
    assert.equal(named.body.nickname, '두번째');
    const v1 = await a.call('POST', `/questions/${q.body.id}/vote`, { token: p2.token, body: {} });
    assert.equal(v1.status, 200); assert.equal(v1.body.votes, 1);
    const v2 = await a.call('POST', `/questions/${q.body.id}/vote`, { token: p2.token, body: {} });
    assert.equal(v2.body.votes, 1); assert.equal(v2.body.already, true);
    const v3 = await a.call('POST', `/questions/${q.body.id}/vote`, { token: p1.token, body: {} });
    assert.equal(v3.body.votes, 2);
    const noTok = await a.call('POST', '/questions', { body: { text: 'x' } });
    assert.equal(noTok.status, 401);
    const tooLong = await a.call('POST', '/questions', { token: p1.token, body: { text: 'ㄱ'.repeat(501) } });
    assert.equal(tooLong.status, 400); assert.equal(tooLong.body.error, 'too_long');
    const ok500 = await a.call('POST', '/questions', { token: p1.token, body: { text: 'ㄱ'.repeat(500) } });
    assert.equal(ok500.status, 201);
    const empty = await a.call('POST', '/questions', { token: p1.token, body: { text: '   ' } });
    assert.equal(empty.status, 400);
    const unknown = await a.call('POST', '/secrets', { token: p1.token, body: {} });
    assert.equal(unknown.status, 404);
    const wrongType = await a.call('POST', '/questions', { token: p1.token, body: { text: { $gt: '' } } });
    assert.equal(wrongType.status, 400);
    // owner may edit text, not votes/status
    const edit = await a.call('PATCH', `/questions/${named.body.id}`, { token: p2.token, body: { text: '고친 질문', votes: 100, status: 'answered' } });
    assert.equal(edit.status, 200); assert.equal(edit.body.text, '고친 질문'); assert.equal(edit.body.votes, 0); assert.equal(edit.body.status, 'open');
    const notMine = await a.call('PATCH', `/questions/${named.body.id}`, { token: p1.token, body: { text: '남의 글' } });
    assert.equal(notMine.status, 403);
  });

  test(`${name}: per-token rate limit returns 429 with Retry-After`, async () => {
    const c = fresh('R'); const a = api(c.base, c.code);
    const p = await joinAs(a);
    const codes = [];
    for (let i = 0; i < 10; i++) codes.push((await a.call('POST', '/questions', { token: p.token, body: { text: '질문 ' + i } })).status);
    assert.deepEqual(codes.slice(0, 8), Array(8).fill(201));
    assert.equal(codes[8], 429);
    const r = await a.call('POST', '/questions', { token: p.token, body: { text: 'again' } });
    assert.equal(r.status, 429); assert.ok(Number(r.headers.get('retry-after')) >= 1);
    // another participant behind the same IP is not affected (NAT-friendly)
    const p2 = await joinAs(a, '옆자리');
    assert.equal((await a.call('POST', '/questions', { token: p2.token, body: { text: '저도요' } })).status, 201);
  });

  test(`${name}: state — admin only writes, validated, public read`, async () => {
    const c = fresh('S'); const a = api(c.base, c.code);
    await joinAs(a);
    assert.equal((await a.call('PUT', '/state', { body: { slide: 2 } })).status, 401);
    assert.equal((await a.call('PUT', '/state', { admin: 'wrong-key', body: { slide: 2 } })).status, 403);
    const ok = await a.call('PUT', '/state', { admin: c.adminKey, body: { slide: 4, step: 'st2', follow: true, notice: { text: '5분 쉬어요', level: 'warn' }, timer: { endsAt: Date.now() + 60000, label: '실습', running: true }, openPoll: 'p1', ui: { qr: true }, evil: 1 } });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.slide, 4); assert.equal(ok.body.follow, true); assert.equal(ok.body.notice.level, 'warn'); assert.equal(ok.body.evil, undefined); assert.equal(ok.body.ui.qr, true);
    const patch = await a.call('PUT', '/state', { admin: c.adminKey, body: { notice: null } });
    assert.equal(patch.body.notice, null); assert.equal(patch.body.slide, 4, 'shallow merge keeps other fields');
    const bad = await a.call('PUT', '/state', { admin: c.adminKey, body: { notice: { text: 'x', level: 'party' } } });
    assert.equal(bad.status, 400);
    const pub = await a.call('GET', '/state');
    assert.equal(pub.status, 200); assert.equal(pub.body.slide, 4); assert.ok(pub.body.updatedAt > 0);
  });

  test(`${name}: snapshot since-cursor, tombstones, private collections, hidden text`, async () => {
    const c = fresh('N'); const a = api(c.base, c.code);
    const p = await joinAs(a); const p2 = await joinAs(a, '둘');
    const q1 = (await a.call('POST', '/questions', { token: p.token, body: { text: '첫 질문' } })).body;
    await a.call('POST', '/attendance', { token: p.token, body: { kind: 'in' } });
    const s1 = (await a.call('GET', '/snapshot?since=0')).body;
    assert.equal(s1.full, true); assert.equal(s1.questions.length, 1); assert.equal(s1.participants, undefined, 'participants are private');
    assert.equal(s1.attendance, undefined);
    const q2 = (await a.call('POST', '/questions', { token: p.token, body: { text: '두 번째' } })).body;
    const s2 = (await a.call('GET', '/snapshot?since=' + s1.now)).body;
    assert.deepEqual(s2.questions.map((x) => x.id), [q2.id]);
    assert.equal((await a.call('DELETE', `/questions/${q1.id}`, { token: p.token })).status, 401, 'participants cannot delete');
    assert.equal((await a.call('DELETE', `/questions/${q1.id}`, { admin: c.adminKey })).status, 200);
    const s3 = (await a.call('GET', '/snapshot?since=' + s2.now)).body;
    assert.deepEqual(s3.removed, [{ col: 'questions', id: q1.id }]);
    // own private docs come back with the token
    const mine = (await a.call('GET', '/snapshot?since=0', { token: p.token })).body;
    assert.equal(mine.attendance.length, 1); assert.equal(mine.me.id, p.id);
    const other = (await a.call('GET', '/snapshot?since=0', { token: p2.token })).body;
    assert.equal(other.attendance.length, 0);
    assert.equal((await a.call('GET', '/participants')).status, 401);
    assert.equal((await a.call('GET', '/participants', { token: p.token })).body.length, 1, 'token reads only itself');
    const adm = (await a.call('GET', '/snapshot?since=0', { admin: c.adminKey })).body;
    assert.equal(adm.participants.length, 2); assert.equal(adm.participants[0].k, undefined); assert.equal(adm.attendance.length, 1);
    // hide → text stripped for the public, kept for the admin
    await a.call('PATCH', `/questions/${q2.id}`, { admin: c.adminKey, body: { status: 'hidden' } });
    const pubQ = (await a.call('GET', '/questions')).body.find((x) => x.id === q2.id);
    assert.equal(pubQ.status, 'hidden'); assert.equal(pubQ.text, '');
    const admQ = (await a.call('GET', '/questions', { admin: c.adminKey })).body.find((x) => x.id === q2.id);
    assert.equal(admQ.text, '두 번째');
  });

  test(`${name}: keyed upserts (progress, answers) and closed polls`, async () => {
    const c = fresh('P'); const a = api(c.base, c.code);
    const p = await joinAs(a);
    const r1 = (await a.call('POST', '/progress', { token: p.token, body: { station: 's1', status: 'doing' } })).body;
    const r2 = (await a.call('POST', '/progress', { token: p.token, body: { station: 's1', status: 'done' } })).body;
    assert.equal(r1.id, r2.id); assert.equal(r2.status, 'done'); assert.equal(r2.by, p.id);
    assert.equal((await a.call('POST', '/progress', { token: p.token, body: { station: 's1', status: 'flying' } })).status, 400);
    assert.equal((await a.call('POST', '/polls', { token: p.token, body: { question: 'x' } })).status, 401);
    const poll = (await a.call('POST', '/polls', { admin: c.adminKey, body: { question: '오늘 어땠나요?', kind: 'choice', options: ['좋음', '보통'], open: false } })).body;
    assert.equal((await a.call('POST', '/answers', { token: p.token, body: { poll: poll.id, value: '좋음' } })).status, 409);
    await a.call('PATCH', `/polls/${poll.id}`, { admin: c.adminKey, body: { open: true } });
    const a1 = (await a.call('POST', '/answers', { token: p.token, body: { poll: poll.id, value: '좋음' } })).body;
    const a2 = (await a.call('POST', '/answers', { token: p.token, body: { poll: poll.id, value: '보통' } })).body;
    assert.equal(a1.id, a2.id); assert.equal(a2.value, '보통');
    const words = (await a.call('POST', '/answers', { token: p.token, body: { poll: 'blueprint-poll', value: ['협업', '피드백'] } })).body;
    assert.deepEqual(words.value, ['협업', '피드백']);
    const help = (await a.call('POST', '/help', { token: p.token, body: { station: 's2', seat: '3모둠', message: '로그인이 안 돼요' } })).body;
    assert.equal(help.status, 'open'); assert.equal(help.nickname, '선생님');
    const claim = await a.call('PATCH', `/help/${help.id}`, { admin: c.adminKey, body: { status: 'claimed', assignee: '보조강사' } });
    assert.equal(claim.body.status, 'claimed');
    const selfClaim = await a.call('PATCH', `/help/${help.id}`, { token: p.token, body: { status: 'claimed' } });
    assert.equal(selfClaim.status, 400, 'owner may only reopen/close');
  });

  test(`${name}: SSE delivers events`, async () => {
    const c = fresh('E'); const a = api(c.base, c.code);
    const p = await joinAs(a);
    const got = sseUntil(a.root + '/events', (m) => m.type === 'add' && m.col === 'questions');
    await new Promise((r) => setTimeout(r, 300));
    await a.call('POST', '/questions', { token: p.token, body: { text: 'SSE로 와요' } });
    const { msg, msgs } = await got;
    assert.equal(msgs[0].type, 'hello');
    assert.equal(msg.doc.text, 'SSE로 와요'); assert.equal(msg.doc.by, undefined);
  });

  if (ws) test(`${name}: WebSocket delivers public and admin events, reactions are aggregated`, async () => {
    const c = fresh('W'); const a = api(c.base, c.code);
    await joinAs(a);
    const wsUrl = a.root.replace(/^http/, 'ws') + '/ws';
    const pub = await wsOpen(wsUrl);
    const adm = await wsOpen(wsUrl, { admin: c.adminKey });
    assert.equal((await adm.next((m) => m.type === 'auth')).ok, true);
    pub.ws.send('ping');
    await pub.next((m) => m.type === 'pong-text');
    const p = await joinAs(a, '새참가자');
    const joined = await adm.next((m) => m.type === 'add' && m.col === 'participants');
    assert.equal(joined.doc.nickname, '새참가자');
    await a.call('PUT', '/state', { admin: c.adminKey, body: { slide: 7 } });
    assert.equal((await pub.next((m) => m.type === 'state')).doc.slide, 7);
    for (let i = 0; i < 5; i++) await a.call('POST', '/react', { token: p.token, body: { emoji: '👏' } });
    const r = await pub.next((m) => m.type === 'reaction');
    assert.equal(r.doc.emoji, '👏'); assert.ok(r.doc.count >= 1);
    assert.equal((await a.call('POST', '/react', { token: p.token, body: { emoji: '<script>' } })).status, 400);
    await new Promise((res) => setTimeout(res, 300));
    assert.ok(!pub.msgs.some((m) => m.col === 'participants'), 'public sockets never see participants');
    pub.close(); adm.close();
  });

  test(`${name}: export.csv (BOM, formula guard, admin only) and purge`, async () => {
    const c = fresh('X'); const a = api(c.base, c.code);
    const p = await joinAs(a, '=HYPERLINK("x")');
    await a.call('POST', '/questions', { token: p.token, body: { text: '=1+1 수식?', anonymous: false } });
    await a.call('POST', '/attendance', { token: p.token, body: { kind: 'in' } });
    await a.call('POST', '/survey', { token: p.token, body: { answers: { q1: '좋았어요', q2: 5 } } });
    assert.equal((await a.call('GET', '/export.csv?kind=questions')).status, 401);
    const res = await a.call('GET', '/export.csv?kind=questions', { admin: c.adminKey, raw: true });
    assert.equal(res.status, 200); assert.match(res.headers.get('content-type'), /text\/csv/);
    const buf = new Uint8Array(await res.arrayBuffer());
    assert.deepEqual([...buf.slice(0, 3)], [0xef, 0xbb, 0xbf], 'UTF-8 BOM for Excel');
    const csv = new TextDecoder().decode(buf);
    assert.match(csv, /작성 시각,질문,작성자/); assert.match(csv, /'=1\+1 수식\?/); assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
    for (const kind of ['attendance', 'progress', 'survey', 'participants']) {
      const r = await a.call('GET', '/export.csv?kind=' + kind, { admin: c.adminKey, raw: true });
      assert.equal(r.status, 200, kind);
    }
    assert.equal((await a.call('GET', '/export.csv?kind=secrets', { admin: c.adminKey })).status, 400);
    assert.equal((await a.call('DELETE', '', { token: p.token })).status, 401);
    assert.equal((await a.call('DELETE', '', { admin: c.adminKey })).status, 200);
    const after = (await a.call('GET', '/snapshot?since=0', { admin: c.adminKey })).body;
    assert.equal(after.questions.length, 0); assert.equal(after.participants.length, 0);
    assert.equal((await a.call('POST', '/questions', { token: p.token, body: { text: '삭제 뒤' } })).status, 401, 'old tokens are gone');
  });

  test(`${name}: answers cannot change after the poll closes; \`by\` only on my own answers, progress and help`, async () => {
    const c = fresh('L'); const a = api(c.base, c.code);
    const p1 = await joinAs(a, '하나'); const p2 = await joinAs(a, '둘');
    const poll = (await a.call('POST', '/polls', { admin: c.adminKey, body: { question: '좋았나요?', options: ['예', '아니요'], open: true } })).body;
    const a1 = (await a.call('POST', '/answers', { token: p1.token, body: { poll: poll.id, value: '예' } })).body;
    await a.call('POST', '/answers', { token: p2.token, body: { poll: poll.id, value: '아니요' } });
    await a.call('POST', '/progress', { token: p1.token, body: { station: 's1', status: 'stuck' } });
    await a.call('POST', '/help', { token: p1.token, body: { station: 's1', message: '막혔어요' } });
    assert.equal((await a.call('PATCH', `/answers/${a1.id}`, { token: p1.token, body: { value: '아니요' } })).status, 200, 'open poll: change allowed');
    await a.call('PATCH', `/polls/${poll.id}`, { admin: c.adminKey, body: { open: false } });
    const late = await a.call('PATCH', `/answers/${a1.id}`, { token: p1.token, body: { value: '예' } });
    assert.equal(late.status, 409); assert.equal(late.body.error, 'poll_closed');
    assert.equal((await a.call('POST', '/answers', { token: p1.token, body: { poll: poll.id, value: '예' } })).status, 409);
    const pub = (await a.call('GET', '/snapshot?since=0')).body;
    for (const col of ['answers', 'progress', 'help']) assert.ok(pub[col].length && pub[col].every((d) => d.by === undefined), `${col}: no by for the public`);
    const mine = (await a.call('GET', '/snapshot?since=0', { token: p1.token })).body;
    assert.equal(mine.answers.find((d) => d.id === a1.id).by, p1.id, 'my own answer keeps by');
    assert.ok(mine.answers.filter((d) => d.id !== a1.id).every((d) => d.by === undefined), 'other people\'s answers do not');
    assert.equal((await a.call('GET', '/answers', { token: p2.token })).body.find((d) => d.id === a1.id).by, undefined);
    const adm = (await a.call('GET', '/snapshot?since=0', { admin: c.adminKey })).body;
    assert.ok(adm.answers.every((d) => d.by), 'the admin sees who answered');
  });

  test(`${name}: instructor locks (lockQa·lockBoard), invisible characters, formula cells with leading blanks, admin check on a new code`, async () => {
    const c = fresh('L'); const a = api(c.base, c.code);
    // 아직 없는 연수: 틀린 키로 비공개 모음을 읽으면 '빈 명단'이 아니라 거절(강사 화면이 틀린 키로 열리지 않게)
    const n0 = api(c.base, 'N' + uniq());
    assert.equal((await n0.call('GET', '/participants?since=9000000000000', { admin: '틀린-관리자-키-0000' })).status, 403);
    assert.equal((await n0.call('GET', '/participants?since=9000000000000')).status, 401);
    const p = await joinAs(a, '하나');
    // 보이지 않는 글자·방향 바꿈·한글 채움·쌓인 결합 부호
    const inv = String.fromCharCode(0x202e, 0x200b, 0x2066, 0x3164, 0xad);
    const zal = 'Z' + String.fromCharCode(0x301, 0x302, 0x303, 0x304, 0x305, 0x306);
    const q1 = await a.call('POST', '/questions', { token: p.token, body: { text: `가${inv}나 ${zal}` } });
    assert.equal(q1.status, 201); assert.equal(q1.body.text, '가나 ' + 'Ź' + String.fromCharCode(0x302, 0x303));
    assert.equal((await a.call('POST', '/join', { body: { nickname: '강' + String.fromCharCode(0x3164) + '사' } })).body.error, 'reserved_nickname', '채움 문자로 강사 흉내 금지');
    // 잠그기: 관리자만 걸고, 참가자의 새 질문·새 보드 글을 409 locked
    assert.equal((await a.call('PUT', '/state', { token: p.token, body: { ui: { lockQa: true } } })).status, 401);
    assert.equal((await a.call('PUT', '/state', { admin: c.adminKey, body: { ui: { lockQa: true, lockBoard: true } } })).status, 200);
    const lq = await a.call('POST', '/questions', { token: p.token, body: { text: '잠긴 뒤' } });
    assert.equal(lq.status, 409); assert.equal(lq.body.error, 'locked');
    const lb = await a.call('POST', '/posts', { token: p.token, body: { text: '잠긴 뒤' } });
    assert.equal(lb.status, 409); assert.equal(lb.body.error, 'locked');
    assert.equal((await a.call('POST', '/help', { token: p.token, body: { message: '도움 요청은 잠그지 않음' } })).status, 201);
    await a.call('PUT', '/state', { admin: c.adminKey, body: { ui: { lockQa: null, lockBoard: null } } });
    assert.equal((await a.call('POST', '/questions', { token: p.token, body: { text: ' =1+1' } })).status, 201);
    const csv = await (await a.call('GET', '/export.csv?kind=questions', { admin: c.adminKey, raw: true })).text();
    assert.match(csv, /,'=1\+1,|,"' =1\+1"|,' =1\+1,/, '앞 빈칸 뒤 = 도 막음');
  });

  test(`${name}: reserved nicknames (강사·운영자·admin·lecpage) are refused for participants`, async () => {
    const c = fresh('V'); const a = api(c.base, c.code);
    for (const n of ['강사', ' 운영자 ', 'Admin', 'LECPAGE', '강사님', '강 사']) {
      const r = await a.call('POST', '/join', { body: { nickname: n } });
      assert.equal(r.status, 400, n); assert.equal(r.body.error, 'reserved_nickname', n);
    }
    const p = await joinAs(a, '김강사');
    assert.ok(p.token, 'a name that only contains the word is fine');
    const ren = await a.call('PATCH', `/participants/${p.id}`, { token: p.token, body: { nickname: '운영자' } });
    assert.equal(ren.status, 400); assert.equal(ren.body.error, 'reserved_nickname');
  });

  if (uploads) test(`${name}: board files — only my own uploads; hide, remove and uploads=false take effect on the server`, async () => {
    const c = fresh('F'); const a = api(c.base, c.code);
    const p1 = await joinAs(a, '하나'); const p2 = await joinAs(a, '둘');
    const send = (tok) => { const fd = new FormData(); fd.append('file', new Blob([PNG_1PX], { type: 'image/png' }), 'a.png'); return a.call('POST', '/upload', { token: tok, body: fd }); };
    const up = (await send(p1.token)).body;
    const file = (u) => ({ url: u, name: 'a.png', type: 'image/png', size: PNG_1PX.length });
    const abs = (u) => (u.startsWith('/') ? c.base + u : u);
    // M7: no external URLs, no other people's files, no files of another training
    for (const u of ['https://tracker.example/pixel.png?u=1', 'http://attacker.example/api/' + c.code + '/files/' + 'a'.repeat(24) + '.png', `/api/${c.code}/files/${'b'.repeat(24)}.png`, up.url.replace(c.code, 'OTHER' + c.code)]) {
      const r = await a.call('POST', '/posts', { token: p1.token, body: { text: 'x', files: [file(u)] } });
      assert.equal(r.status, 400, u); assert.equal(r.body.error, 'invalid_value');
    }
    assert.equal((await a.call('POST', '/posts', { token: p2.token, body: { text: '남의 파일', files: [file(up.url)] } })).status, 400, 'someone else\'s upload');
    const post = await a.call('POST', '/posts', { token: p1.token, body: { text: '내 사진', files: [{ ...file(up.url), type: 'video/mp4', size: 999 }] } });
    assert.equal(post.status, 201);
    assert.equal(post.body.files[0].type, 'image/png', 'type and size come from the server record'); assert.equal(post.body.files[0].size, PNG_1PX.length);
    assert.match(post.body.files[0].url, /^https?:\/\/.+\/api\/[A-Z0-9_-]+\/files\/[a-f0-9]{24}\.png$/, 'absolute URL of this server');
    assert.equal((await a.call('POST', '/posts', { token: p1.token, body: { text: '또', files: [file(up.url)] } })).status, 400, 'one file, one post');
    assert.equal((await fetch(abs(up.url))).status, 200);
    // H3: hiding takes the file down at once; showing brings it back; removing deletes it
    await a.call('PATCH', `/posts/${post.body.id}`, { admin: c.adminKey, body: { hidden: true } });
    assert.equal((await fetch(abs(up.url))).status, 404, 'hidden post → file 404');
    await a.call('PATCH', `/posts/${post.body.id}`, { admin: c.adminKey, body: { hidden: false } });
    assert.equal((await fetch(abs(up.url))).status, 200);
    assert.equal((await a.call('DELETE', `/posts/${post.body.id}`, { admin: c.adminKey })).status, 200);
    assert.equal((await fetch(abs(up.url))).status, 404, 'removed post → file 404');
    // M8: the instructor switches uploads off (state.ui.uploads=false, admin only)
    const up2 = (await send(p1.token)).body;
    assert.equal((await a.call('PUT', '/state', { token: p1.token, body: { ui: { uploads: false } } })).status, 401);
    assert.equal((await a.call('PUT', '/state', { admin: c.adminKey, body: { ui: { uploads: false } } })).status, 200);
    const off = await send(p1.token);
    assert.equal(off.status, 503); assert.equal(off.body.error, 'uploads_disabled');
    const late = await a.call('POST', '/posts', { token: p1.token, body: { text: '파일', files: [file(up2.url)] } });
    assert.equal(late.status, 403); assert.equal(late.body.error, 'uploads_disabled');
    assert.equal((await a.call('POST', '/posts', { token: p1.token, body: { text: '글만은 돼요' } })).status, 201);
  });

  if (uploads) test(`${name}: uploads — sniffed type, size limit, safe serving`, async () => {
    const c = fresh('U'); const a = api(c.base, c.code);
    const p = await joinAs(a);
    const fd = new FormData(); fd.append('file', new Blob([PNG_1PX], { type: 'image/png' }), '사진.png');
    const up = await a.call('POST', '/upload', { token: p.token, body: fd });
    assert.equal(up.status, 201, JSON.stringify(up.body)); assert.equal(up.body.type, 'image/png'); assert.match(up.body.url, /\/files\/[a-f0-9]{24}\.png$/);
    const fileUrl = up.body.url.startsWith('/') ? c.base + up.body.url : up.body.url;
    assert.equal((await fetch(fileUrl)).status, 404, 'an upload is served only once a post uses it');
    const html = new FormData(); html.append('file', new Blob(['<html><script>alert(1)</script>'], { type: 'image/png' }), 'x.png');
    assert.equal((await a.call('POST', '/upload', { token: p.token, body: html })).status, 415);
    const svg = new FormData(); svg.append('file', new Blob(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], { type: 'image/svg+xml' }), 'x.svg');
    assert.equal((await a.call('POST', '/upload', { token: p.token, body: svg })).status, 415);
    const noTok = new FormData(); noTok.append('file', new Blob([PNG_1PX], { type: 'image/png' }), 'a.png');
    assert.equal((await a.call('POST', '/upload', { body: noTok })).status, 401);
    const post = await a.call('POST', '/posts', { token: p.token, body: { text: '결과물', files: [{ url: up.body.url, name: up.body.name, type: 'image/png', size: up.body.size }] } });
    assert.equal(post.status, 201);
    const got = await fetch(fileUrl);
    assert.equal(got.status, 200); assert.equal(got.headers.get('content-type'), 'image/png'); assert.equal(got.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(got.headers.get('cache-control'), 'private, max-age=300');
    const badFile = await a.call('POST', '/posts', { token: p.token, body: { text: 'x', files: [{ url: 'javascript:alert(1)', name: 'a', type: 'image/png', size: 1 }] } });
    assert.equal(badFile.status, 400);
    const like = await a.call('POST', `/posts/${post.body.id}/like`, { token: p.token, body: {} });
    assert.equal(like.body.likes, 1);
  });
}
