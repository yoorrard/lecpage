// 통합 시험: 예전 저장 형식 사이트(파일 하나에 한 줄 = passet 표)를 새 판(묶음 몇 줄 = ppack 표)이 그대로 읽고 옮기는지. 로컬 workerd + 흉내 Cloudflare API.
// 이 판(2026-11-24) 전에 만든 사이트는 Pages에 올린 파일마다 passet에 한 줄이 있음(글꼴 조각이 든 사이트는 약 580줄). 새 판은 그 줄을 그대로 읽고,
// 다음에 쓸 때 묶음으로 옮긴 뒤 예전 표를 비움(한 거래. 줄마다 지우지 않고 표째로 — 줄마다 지우면 줄 수만큼 쓴 행으로 청구됨).
// 방법: 서버를 켜 사이트를 만들고 → 서버를 끈 뒤 저장소 파일(SQLite)을 직접 열어 예전 판이 쓰던 모양 그대로 되돌리고(passet 표에 줄마다, ppack 표 없음) → 같은 저장소로 서버를 다시 켬.
//  1 예전 형식 사이트를 다시 배포: 바뀐 파일만 다시 받고(예전 줄을 읽었다는 뜻), 공개된 사이트에 예전 파일과 새 파일이 다 나옴. 그 뒤 저장소는 묶음뿐(passet 0줄)
//  2 예전 형식 사이트를 내림(배포 취소): 주소가 '강사가 사이트를 내렸어요'로 바뀌고 다시 만들 수 있음
//  3 예전 형식 사이트의 기간이 끝남: 주소가 '보관 기간이 끝났어요'로 바뀜
//  4 예전 형식 사이트의 참여 기록 수 보기·같은 내용 다시 공개(아무것도 다시 받지 않음)
//  5 새 판이 만든 사이트(묶음)는 서버를 껐다 켜도 그대로 다시 배포됨. 묶음 줄이 읽히지 않으면(깨진 글) 그 파일들만 다시 받아 끝까지 감
//  6 worker 보기 때 만든 사이트(파일을 모두 이 객체 저장소에 둠)는 서버가 pages 보기로 바뀐 뒤에도 worker 한도(40MB·600개)까지만 받음. 새 사이트는 pages 한도.
//    worker 보기 서버는 운영자가 정한 한도(MAX_BYTES·MAX_FILES)를 그대로 따름(/api/info가 알려 주는 숫자 = 실제로 받는 한도)
//  7 새 판이 만든 사이트에도 빈 passet 표가 있음(예전 판으로 되돌려도 그 판이 읽을 표가 있게)
//  8 예전 형식 사이트의 첫 다시 배포·배포 취소(지우는 중을 거치는 경우 포함)가 쓰는 행 수는 예전 줄 수(300)와 상관없이 스무 줄 안쪽
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { HOSTING, startHost, call, deploy, manifestOf } from './helpers.mjs';
import { startFakeCf, ACCOUNT, TOKEN } from './fake-cf.mjs';
import { appPublish, today, settle } from './load-helpers.mjs';

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
  // 새 판이 만든 사이트에도 빈 passet 표가 있음: 이 판 전의 코드(운영 5029d91)는 이 표가 있다고 보고 읽으므로, 예전 판으로 되돌려도 '없는 표' 오류로 멈추지 않게
  for (const k of ['A', 'B', 'C', 'D', 'E']) assert.equal(before.get(made[k].s.id).legacy, 0, `${k}: 새 판이 만든 사이트에는 빈 passet 표가 있음(줄 수 ${before.get(made[k].s.id).legacy}, -1 = 표 없음)`);
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
  assert.equal(a.legacy, 0, `A의 예전 줄은 비워지고 빈 표만 남음: ${a.legacy}`);
  assert.ok(e && e.pack >= 1 && e.legacy === 0, `E는 처음부터 묶음(빈 passet 표): ${JSON.stringify(e)}`);
  // D는 같은 내용을 다시 공개만 함: 공개할 때(publishPages의 거래) 예전 줄이 묶음으로 옮겨짐 → 묶음에 파일이 다 있고 예전 줄은 0
  assert.ok(d && d.pack >= 1 && d.entries >= 47 && d.legacy === 0, `D도 공개하며 묶음으로 옮겨짐: ${JSON.stringify(d)}`);
  assert.equal(end.has(made.B.s.id), false, '내린 사이트의 저장소는 비워짐');
  assert.equal(end.has(made.C.s.id), false, '기간이 끝난 사이트의 저장소는 비워짐');
});

test('예전 형식 사이트(예전 줄 300개)의 첫 다시 배포·배포 취소가 쓰는 행 수는 예전 줄 수와 상관없이 작음(예전 줄은 표째로 비움)', async (t) => {
  if (!existsSync(join(HOSTING, 'node_modules', 'wrangler', 'bin', 'wrangler.js'))) { t.skip('wrangler가 설치되지 않았어요'); return; }
  const cf = await startFakeCf();
  closers.push(cf.stop);
  const state = mkdtempSync(join(tmpdir(), 'lecpage-legacy4-'));
  closers.push(async () => rmSync(state, { recursive: true, force: true }));
  const vars = {
    ADMIN_KEY: ADMIN, TALLY_EVERY: 1, VIEW: 'pages', CF_ACCOUNT_ID: ACCOUNT, PAGES_PROJECT: 'lecpage-view', PAGES_TOKEN: TOKEN, PAGES_HOST: `127.0.0.1:${cf.port}`,
    PAGES_SITE_URL: `${cf.url}/__view/{branch}/`, CF_API_BASE: cf.api, CATALOG_URL: 'off',
    SITES_PER_HOUR: 1000, SITES_PER_DAY: 1000, SITES_PER_DEVICE: 1000, DAILY_SITE_CAP: 1000, DEPLOYS_PER_HOUR: 1000,
  };
  let h;
  try { h = await startHost(vars, { state }); } catch (e) { t.skip(`workerd를 띄우지 못함: ${String(e.message).split('\n')[0]}`); return; }
  let stopped = false;
  closers.push(async () => { if (!stopped) await h.stop(); });
  // 글꼴 조각 300개(예전 형식이면 passet 300줄. 운영의 보통 사이트는 약 580줄)
  const N = 300;
  const fonts = (title) => { const f = { 'index.html': html(title) }; for (let i = 0; i < N; i++) f[`assets/fonts/${String(i).padStart(4, '0')}-${++salt}.woff2`] = blob(2048); return f; };
  const bundle = (await call(h.url, 'GET', '/api/info')).body.limits.bundle;
  const made = {};
  for (const k of ['A', 'B', 'C']) {
    const files = fonts(`예전 줄 ${k}`);
    const r = await appPublish(h.url, files, { title: `예전 줄 ${k}`, bundle });
    assert.ok(r.ok, `${k}: ${JSON.stringify(r.res?.body)}`);
    made[k] = { s: r.site, files };
  }
  await h.stop(); stopped = true;
  const moved = toLegacy(state);
  for (const k of ['A', 'B', 'C']) assert.equal(moved.get(made[k].s.id), N, `${k}: 예전 줄 ${moved.get(made[k].s.id)}`);

  const h2 = await startHost(vars, { state });
  let stopped2 = false;
  closers.push(async () => { if (!stopped2) await h2.stop(); });
  const base = h2.url;
  // 사이트가 Gate에 알린 쓴 행(rw에서 Gate가 스스로 쓴 gw를 뺌: 시험은 TALLY_EVERY=1이라 요청마다 하루 줄을 씀)
  const rows = async () => { await settle(800); const d = await today(base, ADMIN); return (d.rw || 0) - (d.gw || 0); };

  // 첫 다시 배포(첫 화면 글 + 글꼴 조각 하나): 예전 줄 300개를 묶음 한 줄로 옮기고 예전 표를 비움. 줄마다 지우던 때는 312행(2026-11-24 실측)
  const r0 = await rows();
  const again = await appPublish(base, { ...made.A.files, 'index.html': html('예전 줄 A 고침'), 'assets/fonts/new-one.woff2': blob(2048) }, { site: made.A.s, bundle });
  assert.ok(again.ok, JSON.stringify(again.res?.body));
  const r1 = await rows();
  assert.ok(r1 - r0 >= 5 && r1 - r0 <= 20, `예전 형식 사이트의 첫 다시 배포가 쓴 행 수: ${r1 - r0}`);
  assert.match(await (await fetch(again.site.url)).text(), /예전 줄 A 고침/);
  // 배포 취소: 통째 지우기 전에 예전 표를 표째로 비움. 줄 수를 그대로 세던 때는 304행
  const delB = await call(base, 'DELETE', `/api/sites/${made.B.s.id}`, { key: made.B.s.key });
  assert.equal(delB.status, 204, JSON.stringify(delB.body));
  const r2 = await rows();
  assert.ok(r2 - r1 >= 3 && r2 - r1 <= 12, `예전 형식 사이트의 배포 취소가 쓴 행 수: ${r2 - r1}`);
  // 배포 취소인데 Pages가 지우기를 받지 않을 때: '지우는 중'으로 두며 예전 표를 비우고(holdWipe), 풀린 뒤 다시 지우면 끝남. 줄마다 지우던 때는 308행
  cf.state.faults.push({ on: 'delete', status: 500, times: 50 });
  const delC = await call(base, 'DELETE', `/api/sites/${made.C.s.id}`, { key: made.C.s.key });
  assert.equal(delC.status, 202, JSON.stringify(delC.body)); assert.equal(delC.body.state, 'wiping');
  const page = await (await fetch(made.C.s.url)).text();
  assert.match(page, /강사가 사이트를 내렸어요/); assert.doesNotMatch(page, /예전 줄 C/);
  cf.state.faults.length = 0;
  assert.equal((await call(base, 'DELETE', `/api/sites/${made.C.s.id}`, { key: made.C.s.key })).status, 204);
  const r3 = await rows();
  assert.ok(r3 - r2 >= 3 && r3 - r2 <= 20, `지우는 중을 거친 배포 취소가 쓴 행 수: ${r3 - r2}`);
  t.diagnostic(`예전 줄 ${N}개 사이트: 첫 다시 배포 ${r1 - r0}행, 배포 취소 ${r2 - r1}행, 지우는 중을 거친 배포 취소 ${r3 - r2}행`);

  await h2.stop(); stopped2 = true;
  const end = shape(state);
  const a = end.get(made.A.s.id);
  assert.ok(a && a.pack >= 1 && a.entries === N + 1 && a.legacy === 0, `A는 묶음으로 옮겨지고 빈 passet 표만 남음: ${JSON.stringify(a)}`);
  assert.equal(end.has(made.B.s.id), false); assert.equal(end.has(made.C.s.id), false);
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

test('worker 보기 때 만든 사이트는 서버가 pages 보기로 바뀐 뒤에도 worker 한도까지만(파일을 모두 객체 저장소에 두므로), 새 사이트는 pages 한도. worker 보기 서버는 운영자가 정한 한도 그대로', async (t) => {
  if (!existsSync(join(HOSTING, 'node_modules', 'wrangler', 'bin', 'wrangler.js'))) { t.skip('wrangler가 설치되지 않았어요'); return; }
  const cf = await startFakeCf();
  closers.push(cf.stop);
  const state = mkdtempSync(join(tmpdir(), 'lecpage-legacy3-'));
  closers.push(async () => rmSync(state, { recursive: true, force: true }));
  const open = { ADMIN_KEY: ADMIN, SITES_PER_HOUR: 1000, SITES_PER_DAY: 1000, SITES_PER_DEVICE: 1000, DAILY_SITE_CAP: 1000, DEPLOYS_PER_HOUR: 1000 };
  let h;
  // worker 보기 서버: 운영자가 한도를 올려 둠(MAX_FILES 700·MAX_BYTES 50MB). 그 서버는 그 한도 그대로 받고 /api/info도 같은 숫자를 알려 줌
  try { h = await startHost({ ...open, VIEW: 'worker', MAX_FILES: 700, MAX_BYTES: 50 * 1024 * 1024 }, { state }); } catch (e) { t.skip(`workerd를 띄우지 못함: ${String(e.message).split('\n')[0]}`); return; }
  const w = (await call(h.url, 'POST', '/api/sites', { json: { title: 'worker 보기 사이트' } })).body;
  const small = { 'index.html': html('worker 보기 사이트'), 'assets/site.css': 'main{max-width:60rem}' };
  assert.equal((await deploy(h.url, w, small)).status, 200);
  // 파일 601개(worker 기본 한도 600을 하나 넘김)·42MB(worker 기본 한도 40MB를 넘김) 목록
  const many = { ...small }; for (let i = 0; i < 599; i++) many[`assets/img/i-${i}.webp`] = `RIFF${i}`;
  const sha = (i) => i.toString(16).padStart(64, '0');
  const big = { 'index.html': { sha256: sha(1), size: 1024 } }; for (let i = 0; i < 3; i++) big[`material/p-${i}.webp`] = { sha256: sha(10 + i), size: 14 * 1024 * 1024 };
  const wl = (await call(h.url, 'GET', '/api/info')).body.limits;
  assert.deepEqual([wl.maxFiles, wl.maxBytes], [700, 50 * 1024 * 1024], 'worker 보기 서버가 알려 주는 한도 = 운영자가 정한 값');
  const w1 = await call(h.url, 'POST', `/api/sites/${w.id}/deploys`, { key: w.key, json: { files: manifestOf(many) } });
  assert.equal(w1.status, 200, `알려 준 한도(700개) 안의 601개는 받음: ${JSON.stringify(w1.body).slice(0, 300)}`);
  const w2 = await call(h.url, 'POST', `/api/sites/${w.id}/deploys`, { key: w.key, json: { files: big } });
  assert.equal(w2.status, 200, `알려 준 한도(50MB) 안의 42MB는 받음: ${JSON.stringify(w2.body).slice(0, 300)}`);
  const over = { ...many }; for (let i = 0; i < 100; i++) over[`assets/img/x-${i}.webp`] = `RIFFx${i}`;
  const w3 = await call(h.url, 'POST', `/api/sites/${w.id}/deploys`, { key: w.key, json: { files: manifestOf(over) } });
  assert.equal(w3.status, 413, JSON.stringify(w3.body).slice(0, 300)); assert.match(w3.body.error.message_ko, /700개까지/);
  await h.stop();

  const h2 = await startHost({
    ...open, VIEW: 'pages', CF_ACCOUNT_ID: ACCOUNT, PAGES_PROJECT: 'lecpage-view', PAGES_TOKEN: TOKEN, PAGES_HOST: `127.0.0.1:${cf.port}`,
    PAGES_SITE_URL: `${cf.url}/__view/{branch}/`, CF_API_BASE: cf.api,
  }, { state });
  closers.push(h2.stop);
  const lim = (await call(h2.url, 'GET', '/api/info')).body.limits;
  assert.equal(lim.maxFiles, 3000); assert.equal(lim.maxBytes, 300 * 1024 * 1024);
  // pages 보기 서버에서는 그 worker 보기 사이트가 worker 기본 한도(600개·40MB)까지만: 같은 목록(601개·42MB)을 받지 않음
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
