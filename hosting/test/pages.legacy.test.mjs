// 통합 시험: 예전 저장 형식 사이트(파일 하나에 한 줄 = passet 표)를 새 판(묶음 몇 줄 = ppack 표)이 그대로 읽고 옮기는지. 로컬 workerd + 흉내 Cloudflare API.
// 이 판(2026-11-24) 전에 만든 사이트는 Pages에 올린 파일마다 passet에 한 줄이 있음(글꼴 조각이 든 사이트는 약 580줄). 새 판은 그 줄을 그대로 읽고,
// 다음에 쓸 때 묶음으로 옮긴 뒤 줄을 지움(한 거래).
// 방법: 서버를 켜 사이트를 만들고 → 서버를 끈 뒤 저장소 파일(SQLite)을 직접 열어 예전 판이 쓰던 모양 그대로 되돌리고(passet 표에 줄마다, ppack 표 없음) → 같은 저장소로 서버를 다시 켬.
//  1 예전 형식 사이트를 다시 배포: 바뀐 파일만 다시 받고(예전 줄을 읽었다는 뜻), 공개된 사이트에 예전 파일과 새 파일이 다 나옴. 그 뒤 저장소는 묶음뿐(passet 0줄)
//  2 예전 형식 사이트를 내림(배포 취소): 주소가 '강사가 사이트를 내렸어요'로 바뀌고 다시 만들 수 있음
//  3 예전 형식 사이트의 기간이 끝남: 주소가 '보관 기간이 끝났어요'로 바뀜
//  4 예전 형식 사이트의 참여 기록 수 보기·같은 내용 다시 공개(아무것도 다시 받지 않음)
//  5 새 판이 만든 사이트(묶음)는 서버를 껐다 켜도 그대로 다시 배포됨. 묶음 줄이 읽히지 않으면(깨진 글) 그 파일들만 다시 받아 끝까지 감
//  6 worker 보기 때 만든 사이트(파일을 모두 이 객체 저장소에 둠)는 서버가 pages 보기로 바뀐 뒤에도 worker 한도(40MB·600개)까지만 받음. 새 사이트는 pages 한도
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { HOSTING, startHost, call, deploy, manifestOf } from './helpers.mjs';
import { startFakeCf, ACCOUNT, TOKEN } from './fake-cf.mjs';

const ADMIN = 'legacy-admin-' + randomBytes(12).toString('hex');
const te = new TextEncoder();
const closers = [];
after(async () => { for (const c of closers.reverse()) await c(); });
let salt = 0;
const blob = (n, tag = 'wOF2') => { const b = new Uint8Array(randomBytes(n)); b.set(te.encode(`${tag}${String(++salt).padStart(8, '0')}`), 0); return b; };
const html = (t) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${t}</title><link rel="stylesheet" href="assets/site.css"></head><body><main><h1>${t}</h1></main></body></html>`;
/** 글꼴 조각 40개 + 쪽 그림 6장 + 큰 그림 하나(512KB 넘음: 받을 때 바로 Pages에 올림) + 사이트 파일 */
function site(title) {
  const files = { 'index.html': html(title), 'assets/site.css': `main{max-width:60rem}/*${++salt}*/` };
  for (let i = 0; i < 40; i++) files[`assets/fonts/${String(i).padStart(3, '0')}-${salt}.woff2`] = blob(6 * 1024);
  for (let i = 1; i <= 6; i++) files[`material/p-${String(i).padStart(3, '0')}.webp`] = blob(60 * 1024, 'RIFF');
  files['assets/img/cover.webp'] = blob(600 * 1024, 'RIFF');
  return files;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 저장소 폴더의 모든 SQLite 파일 */
function sqliteFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sqliteFiles(p)); else if (name.endsWith('.sqlite')) out.push(p);
  }
  return out;
}
const tablesOf = (db) => new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name));
/** 사이트 객체의 저장소를 하나씩 엶: fn(db, 사이트 id, 표 이름들) */
function eachSite(state, fn) {
  let n = 0;
  for (const f of sqliteFiles(state)) {
    const db = new DatabaseSync(f);
    try {
      const t = tablesOf(db);
      if (!t.has('meta') || !t.has('deploy')) continue; // Site 객체가 아님(Gate·Room)
      const id = db.prepare('SELECT site FROM meta WHERE id = 1').get()?.site;
      if (id) { fn(db, id, t); n++; }
    } finally { db.close(); }
  }
  return n;
}
/** 새 형식(ppack) → 예전 판이 쓰던 모양 그대로(passet 표에 파일마다 한 줄, ppack 표 없음). 돌려주는 값: 사이트 id → 옮긴 줄 수 */
function toLegacy(state) {
  const moved = new Map();
  eachSite(state, (db, id, t) => {
    if (!t.has('ppack')) return;
    const rows = db.prepare('SELECT data FROM ppack ORDER BY i').all().flatMap((r) => JSON.parse(r.data));
    db.exec('BEGIN');
    // 예전 판(origin/main 2026-11-23)의 표 그대로
    db.exec('CREATE TABLE IF NOT EXISTS passet (sha TEXT NOT NULL, ext TEXT NOT NULL, phash TEXT NOT NULL, size INTEGER NOT NULL, PRIMARY KEY (sha, ext)) WITHOUT ROWID');
    const ins = db.prepare('INSERT OR REPLACE INTO passet (sha, ext, phash, size) VALUES (?, ?, ?, ?)');
    for (const [sha, ext, phash, size] of rows) ins.run(sha, ext, phash, size);
    db.exec('DROP TABLE ppack');
    db.exec('COMMIT');
    moved.set(id, rows.length);
  });
  return moved;
}
/** 지금 저장 모양: 사이트 id → { legacy: passet 줄 수(-1 = 표 없음), pack: ppack 줄 수(-1 = 표 없음), entries: 묶음에 든 파일 수 } */
function shape(state) {
  const out = new Map();
  eachSite(state, (db, id, t) => {
    const legacy = t.has('passet') ? db.prepare('SELECT COUNT(*) AS n FROM passet').get().n : -1;
    const packRows = t.has('ppack') ? db.prepare('SELECT data FROM ppack ORDER BY i').all() : null;
    out.set(id, { legacy, pack: packRows ? packRows.length : -1, entries: packRows ? packRows.reduce((n, r) => n + JSON.parse(r.data).length, 0) : 0 });
  });
  return out;
}

test('예전 저장 형식(파일 하나에 한 줄) 사이트: 새 판에서 다시 배포·배포 취소·기간 끝·기록 보기가 그대로 되고, 쓰는 때 묶음으로 옮겨짐', async (t) => {
  if (!existsSync(join(HOSTING, 'node_modules', 'wrangler', 'bin', 'wrangler.js'))) { t.skip('wrangler가 설치되지 않았어요'); return; }
  const cf = await startFakeCf();
  closers.push(cf.stop);
  const state = mkdtempSync(join(tmpdir(), 'lecpage-legacy-'));
  closers.push(async () => rmSync(state, { recursive: true, force: true }));
  const vars = {
    ADMIN_KEY: ADMIN, TALLY_EVERY: 1, VIEW: 'pages', CF_ACCOUNT_ID: ACCOUNT, PAGES_PROJECT: 'lecpage-view', PAGES_TOKEN: TOKEN, PAGES_HOST: `127.0.0.1:${cf.port}`,
    PAGES_SITE_URL: `${cf.url}/__view/{branch}/`, CF_API_BASE: cf.api,
    SITES_PER_HOUR: 1000, SITES_PER_DAY: 1000, SITES_PER_DEVICE: 1000, DAILY_SITE_CAP: 1000, DEPLOYS_PER_HOUR: 1000,
  };
  // 처음 켤 때만 보관 기간을 90초로: 그때 공개한 사이트(C)는 다시 배포하지 않으면 90초 뒤 알람으로 지워짐(다시 켠 서버는 기본 60일 → 다시 배포한 A·D·E는 늘어남)
  const KEEP_MS = 90e3;
  let h;
  try { h = await startHost({ ...vars, SITE_DAYS: KEEP_MS / 864e5 }, { state }); } catch (e) { t.skip(`workerd를 띄우지 못함: ${String(e.message).split('\n')[0]}`); return; }
  let stopped = false;
  closers.push(async () => { if (!stopped) await h.stop(); });

  // ── 새 판으로 사이트 다섯 개를 만듦(A 다시 배포, B 배포 취소, C 기간 끝, D 기록 보기·같은 내용 다시 공개, E 새 형식 그대로) ──
  const made = {};
  let cAt = 0;
  for (const k of ['A', 'B', 'C', 'D', 'E']) {
    const s = (await call(h.url, 'POST', '/api/sites', { json: { title: `예전 형식 ${k}` } })).body;
    const files = site(`예전 형식 ${k}`);
    const r = await deploy(h.url, s, files);
    assert.equal(r.status, 200, `${k}: ${JSON.stringify(r.body)}`);
    made[k] = { s, files, url: r.body.url };
    if (k === 'C') cAt = Date.now();
  }
  const view = async (k, path = '') => { const r = await fetch(made[k].url + path); return { status: r.status, text: await r.text() }; };
  assert.match((await view('A')).text, /예전 형식 A/);
  await h.stop(); stopped = true;

  // ── 저장소를 예전 판의 모양으로 되돌림(E는 새 형식 그대로 둠) ──
  const before = shape(state);
  assert.equal(before.get(made.A.s.id).legacy, -1, '새 판이 만든 사이트에는 passet 표가 없음');
  assert.ok(before.get(made.A.s.id).pack >= 1 && before.get(made.A.s.id).entries >= 47, JSON.stringify(before.get(made.A.s.id)));
  // E는 묶음 그대로: 잠깐 표 이름을 바꿔 두었다가 되돌림
  eachSite(state, (db, id) => { if (id === made.E.s.id) db.exec('ALTER TABLE ppack RENAME TO ppack_keep'); });
  const moved = toLegacy(state);
  eachSite(state, (db, id) => { if (id === made.E.s.id) db.exec('ALTER TABLE ppack_keep RENAME TO ppack'); });
  for (const k of ['A', 'B', 'C', 'D']) assert.ok(moved.get(made[k].s.id) >= 47, `${k}: 예전 줄 ${moved.get(made[k].s.id)}`);
  const legacy = shape(state);
  assert.equal(legacy.get(made.A.s.id).pack, -1); assert.ok(legacy.get(made.A.s.id).legacy >= 47);
  assert.ok(legacy.get(made.E.s.id).pack >= 1, 'E는 새 형식 그대로');

  // ── 같은 저장소로 새 판을 다시 켬 ──
  const h2 = await startHost(vars, { state });
  closers.push(h2.stop);
  const base = h2.url;

  // 4 기록 보기·같은 내용 다시 공개: 아무것도 다시 받지 않음
  const rec = await call(base, 'GET', `/api/sites/${made.D.s.id}/records`, { key: made.D.s.key });
  assert.equal(rec.status, 200); assert.equal(rec.body.live, false);
  const same = await call(base, 'POST', `/api/sites/${made.D.s.id}/deploys`, { key: made.D.s.key, json: { files: manifestOf(made.D.files) } });
  assert.equal(same.status, 200, JSON.stringify(same.body));
  assert.deepEqual(same.body.missing, [], '예전 줄을 읽어 이미 올린 파일로 봄(HTML도 객체 저장소에 그대로)');
  const pubD = await call(base, 'POST', `/api/sites/${made.D.s.id}/deploys/${same.body.deploy}/publish`, { key: made.D.s.key });
  assert.equal(pubD.status, 200, JSON.stringify(pubD.body));
  assert.match((await view('D')).text, /예전 형식 D/);
  assert.equal((await view('D', 'assets/img/cover.webp')).status, 200, '예전 줄에 적힌 큰 그림이 그대로 나옴');

  // 1 다시 배포: 첫 화면 글과 글꼴 조각 하나만 바꿈 → 그 둘만 다시 받음
  const filesA = { ...made.A.files, 'index.html': html('예전 형식 A 고침'), 'assets/fonts/new-one.woff2': blob(6 * 1024) };
  const dA = await call(base, 'POST', `/api/sites/${made.A.s.id}/deploys`, { key: made.A.s.key, json: { files: manifestOf(filesA) } });
  assert.equal(dA.status, 200, JSON.stringify(dA.body));
  assert.equal(dA.body.missing.length, 2, `바뀐 파일만 다시 받음: ${dA.body.missing.length}`);
  const rA = await deploy(base, made.A.s, filesA);
  assert.equal(rA.status, 200, JSON.stringify(rA.body));
  assert.match((await view('A')).text, /예전 형식 A 고침/);
  for (const p of ['assets/img/cover.webp', 'material/p-003.webp', 'assets/fonts/new-one.woff2', Object.keys(made.A.files).find((x) => x.endsWith('.woff2'))]) {
    assert.equal((await view('A', p)).status, 200, `다시 배포한 뒤에도 나옴: ${p}`);
  }

  // 2 배포 취소
  const delB = await call(base, 'DELETE', `/api/sites/${made.B.s.id}`, { key: made.B.s.key });
  assert.ok([202, 204].includes(delB.status), String(delB.status));
  let goneB = null;
  for (let i = 0; i < 40 && !/강사가 사이트를 내렸어요/.test(goneB?.text || ''); i++) { await sleep(250); goneB = await view('B'); }
  assert.match(goneB.text, /강사가 사이트를 내렸어요/);
  assert.doesNotMatch(goneB.text, /예전 형식 B/);
  assert.equal((await call(base, 'POST', `/api/sites/${made.B.s.id}/deploys`, { key: made.B.s.key, json: { files: manifestOf(made.B.files) } })).status, 404, '내린 사이트는 고칠 수 없음');

  // 5 새 형식 사이트(E)는 서버를 껐다 켜도 그대로: 같은 내용이면 아무것도 다시 받지 않고, 고치면 그 파일만
  const dE = await call(base, 'POST', `/api/sites/${made.E.s.id}/deploys`, { key: made.E.s.key, json: { files: manifestOf({ ...made.E.files, 'index.html': html('새 형식 E 고침') }) } });
  assert.equal(dE.status, 200); assert.equal(dE.body.missing.length, 1, `묶음을 읽어 바뀐 HTML만: ${dE.body.missing.length}`);
  const rE = await deploy(base, made.E.s, { ...made.E.files, 'index.html': html('새 형식 E 고침') });
  assert.equal(rE.status, 200, JSON.stringify(rE.body));
  assert.match((await view('E')).text, /새 형식 E 고침/);

  // 3 기간 끝: C는 다시 배포하지 않았으므로 처음 공개한 때부터 90초 뒤 알람이 지움(서버를 껐다 켠 뒤에도 알람이 울림). 그 주소는 '보관 기간이 끝났어요'
  assert.match((await view('C')).text, /예전 형식 C/, '기간 전에는 그대로 열림(예전 줄을 읽기만 함)');
  await sleep(Math.max(0, cAt + KEEP_MS - Date.now()) + 1500);
  let goneC = null;
  for (let i = 0; i < 80 && !/보관 기간이 끝났어요/.test(goneC?.text || ''); i++) { await sleep(500); goneC = await view('C'); }
  assert.match(goneC.text, /보관 기간이 끝났어요/);
  assert.doesNotMatch(goneC.text, /예전 형식 C/, '기간이 끝난 뒤에는 사이트 내용이 나오지 않음');
  assert.match((await view('A')).text, /예전 형식 A 고침/, '다시 배포한 사이트는 기간이 늘어 그대로 열림');

  // ── 끄고 저장 모양 확인: 쓴 사이트(A·D)는 묶음으로 옮겨졌고 예전 줄은 0 ──
  await h2.stop();
  const end = shape(state);
  const a = end.get(made.A.s.id); const d = end.get(made.D.s.id); const e = end.get(made.E.s.id);
  assert.ok(a && a.pack >= 1 && a.entries >= 48, `A는 묶음으로: ${JSON.stringify(a)}`);
  assert.ok(a.legacy <= 0, `A의 예전 줄은 지워짐: ${a.legacy}`);
  assert.ok(e && e.pack >= 1 && e.legacy === -1, `E는 처음부터 묶음: ${JSON.stringify(e)}`);
  // D는 같은 내용을 다시 공개만 함: 자산 표가 바뀌지 않았으면 예전 줄 그대로여도 됨(읽기는 됨). 옮겨졌다면 예전 줄이 0
  assert.ok(d && ((d.pack >= 1 && d.legacy <= 0) || (d.pack === -1 && d.legacy >= 47)), `D는 한쪽으로만 읽힘: ${JSON.stringify(d)}`);
  assert.equal(end.has(made.B.s.id), false, '내린 사이트의 저장소는 비워짐');
  assert.equal(end.has(made.C.s.id), false, '기간이 끝난 사이트의 저장소는 비워짐');
});

test('묶음 줄이 깨져 읽히지 않으면 그 파일들만 다시 받아 끝까지 감(배포가 멈추지 않음)', async (t) => {
  if (!existsSync(join(HOSTING, 'node_modules', 'wrangler', 'bin', 'wrangler.js'))) { t.skip('wrangler가 설치되지 않았어요'); return; }
  const cf = await startFakeCf();
  closers.push(cf.stop);
  const state = mkdtempSync(join(tmpdir(), 'lecpage-legacy2-'));
  closers.push(async () => rmSync(state, { recursive: true, force: true }));
  const vars = {
    ADMIN_KEY: ADMIN, TALLY_EVERY: 1, VIEW: 'pages', CF_ACCOUNT_ID: ACCOUNT, PAGES_PROJECT: 'lecpage-view', PAGES_TOKEN: TOKEN, PAGES_HOST: `127.0.0.1:${cf.port}`,
    PAGES_SITE_URL: `${cf.url}/__view/{branch}/`, CF_API_BASE: cf.api, SITES_PER_HOUR: 1000, SITES_PER_DAY: 1000, SITES_PER_DEVICE: 1000, DAILY_SITE_CAP: 1000, DEPLOYS_PER_HOUR: 1000,
  };
  let h;
  try { h = await startHost(vars, { state }); } catch (e) { t.skip(`workerd를 띄우지 못함: ${String(e.message).split('\n')[0]}`); return; }
  const s = (await call(h.url, 'POST', '/api/sites', { json: { title: '깨진 묶음' } })).body;
  const files = site('깨진 묶음');
  assert.equal((await deploy(h.url, s, files)).status, 200);
  await h.stop();
  eachSite(state, (db, id) => { if (id === s.id) db.prepare('UPDATE ppack SET data = ?').run('[["깨진'); });
  const h2 = await startHost(vars, { state });
  closers.push(h2.stop);
  const files2 = { ...files, 'index.html': html('깨진 묶음 고침') };
  const d = await call(h2.url, 'POST', `/api/sites/${s.id}/deploys`, { key: s.key, json: { files: manifestOf(files2) } });
  assert.equal(d.status, 200, JSON.stringify(d.body));
  assert.ok(d.body.missing.length >= 47, `자산 표를 못 읽었으니 Pages에 두는 파일을 다시 받음: ${d.body.missing.length}`);
  const r = await deploy(h2.url, s, files2);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const page = await (await fetch(r.body.url)).text();
  assert.match(page, /깨진 묶음 고침/);
  assert.equal((await fetch(r.body.url + 'assets/img/cover.webp')).status, 200);
});

test('worker 보기 때 만든 사이트는 서버가 pages 보기로 바뀐 뒤에도 worker 한도까지만(파일을 모두 객체 저장소에 두므로), 새 사이트는 pages 한도', async (t) => {
  if (!existsSync(join(HOSTING, 'node_modules', 'wrangler', 'bin', 'wrangler.js'))) { t.skip('wrangler가 설치되지 않았어요'); return; }
  const cf = await startFakeCf();
  closers.push(cf.stop);
  const state = mkdtempSync(join(tmpdir(), 'lecpage-legacy3-'));
  closers.push(async () => rmSync(state, { recursive: true, force: true }));
  const open = { ADMIN_KEY: ADMIN, SITES_PER_HOUR: 1000, SITES_PER_DAY: 1000, SITES_PER_DEVICE: 1000, DAILY_SITE_CAP: 1000, DEPLOYS_PER_HOUR: 1000 };
  let h;
  try { h = await startHost({ ...open, VIEW: 'worker' }, { state }); } catch (e) { t.skip(`workerd를 띄우지 못함: ${String(e.message).split('\n')[0]}`); return; }
  const w = (await call(h.url, 'POST', '/api/sites', { json: { title: 'worker 보기 사이트' } })).body;
  const small = { 'index.html': html('worker 보기 사이트'), 'assets/site.css': 'main{max-width:60rem}' };
  assert.equal((await deploy(h.url, w, small)).status, 200);
  assert.equal((await call(h.url, 'GET', '/api/info')).body.limits.maxFiles, 600, 'worker 보기 서버의 한도');
  await h.stop();

  const h2 = await startHost({
    ...open, VIEW: 'pages', CF_ACCOUNT_ID: ACCOUNT, PAGES_PROJECT: 'lecpage-view', PAGES_TOKEN: TOKEN, PAGES_HOST: `127.0.0.1:${cf.port}`,
    PAGES_SITE_URL: `${cf.url}/__view/{branch}/`, CF_API_BASE: cf.api,
  }, { state });
  closers.push(h2.stop);
  const lim = (await call(h2.url, 'GET', '/api/info')).body.limits;
  assert.equal(lim.maxFiles, 3000); assert.equal(lim.maxBytes, 300 * 1024 * 1024);
  // 파일 601개(worker 한도 600을 하나 넘김)·41MB(worker 한도 40MB를 넘김) 목록
  const many = { ...small }; for (let i = 0; i < 599; i++) many[`assets/img/i-${i}.webp`] = `RIFF${i}`;
  const sha = (i) => i.toString(16).padStart(64, '0');
  const big = { 'index.html': { sha256: sha(1), size: 1024 } }; for (let i = 0; i < 3; i++) big[`material/p-${i}.webp`] = { sha256: sha(10 + i), size: 14 * 1024 * 1024 };
  const r1 = await call(h2.url, 'POST', `/api/sites/${w.id}/deploys`, { key: w.key, json: { files: manifestOf(many) } });
  assert.equal(r1.status, 413, JSON.stringify(r1.body).slice(0, 300)); assert.equal(r1.body.error.code, 'too_many_files'); assert.match(r1.body.error.message_ko, /600개까지/);
  const r2 = await call(h2.url, 'POST', `/api/sites/${w.id}/deploys`, { key: w.key, json: { files: big } });
  assert.equal(r2.status, 413, JSON.stringify(r2.body).slice(0, 300)); assert.equal(r2.body.error.code, 'too_large'); assert.match(r2.body.error.message_ko, /40MB까지/);
  // 한도 안에서는 예전처럼 다시 배포되고 열림
  const again = await deploy(h2.url, w, { ...small, 'index.html': html('worker 보기 사이트 고침') });
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.match(await (await fetch(again.body.url)).text(), /worker 보기 사이트 고침/);
  // 같은 서버의 새 사이트(pages 보기)는 같은 목록을 받음
  const p = (await call(h2.url, 'POST', '/api/sites', { json: { title: 'pages 보기 사이트' } })).body;
  const r3 = await call(h2.url, 'POST', `/api/sites/${p.id}/deploys`, { key: p.key, json: { files: manifestOf(many) } });
  assert.equal(r3.status, 200, JSON.stringify(r3.body).slice(0, 300)); assert.ok(r3.body.missing.length >= 600);
  const r4 = await call(h2.url, 'POST', `/api/sites/${p.id}/deploys`, { key: p.key, json: { files: big } });
  assert.equal(r4.status, 200, JSON.stringify(r4.body).slice(0, 300));
});
