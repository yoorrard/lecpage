// lecpage 커넥트의 Vercel 한 번에 배포(scripts/studio-vercel.mjs, /bridge/vercel/*) 시험.
// 실제 Vercel CLI·계정 대신 가짜(fixtures/fake-vercel.mjs)와 이 파일의 가짜 사이트 주소로 끝까지:
// 로그인 기다림 → 팀 고르기 → 올리기 → 배포 보호 끄기 → 다시 올리기 → 지우기. 포트는 4421~4429만 씀.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, statSync, readdirSync, realpathSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { startStudio, CAPS } from '../../scripts/studio.mjs';
import { explain, VERCEL_VER, sitesOf } from '../../scripts/studio-vercel.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FAKE = join(HERE, 'fixtures', 'fake-vercel.mjs');
const SITE_PORT = 4429, PORT0 = 4421;
let T, siteServer, nextPort = PORT0;
const cur = { current: '' };

before(async () => {
  T = mkdtempSync(join(tmpdir(), 'lp-vc-test-'));
  // https://<이름>.vercel.app 자리: 프로젝트가 있고 보호가 풀려 있으면 200, 보호가 걸려 있으면 401
  siteServer = http.createServer((req, res) => {
    const m = new URL(req.url, 'http://x').pathname.match(/^\/v\/([a-z0-9-]+)\//);
    let s = {}; try { s = JSON.parse(readFileSync(cur.current, 'utf8')); } catch { /* 없음 */ }
    const p = m && s.projects?.[m[1]];
    // lecpage: 그 프로젝트의 첫 화면이 lecpage가 조립한 사이트(generator 표시)
    res.writeHead(!p ? 404 : p.sso ? 401 : 200, { 'content-type': 'text/html; charset=utf-8' }); res.end(!p ? 'none' : p.lecpage ? '<!doctype html><meta name="generator" content="lecpage 1.1.0"><title>연수</title>' : 'site');
  });
  await new Promise((ok) => siteServer.listen(SITE_PORT, '127.0.0.1', ok));
});
after(async () => { await new Promise((ok) => siteServer.close(ok)); rmSync(T, { recursive: true, force: true }); });

/** 가짜 계정 하나 + 커넥트 하나 */
async function rig(state = {}, { home } = {}) {
  const dir = mkdtempSync(join(T, 'r-'));
  const file = join(dir, 'vc.json'); const logFile = join(dir, 'vercel.log');
  writeFileSync(file, JSON.stringify({ loggedIn: true, approve: false, teams: ['teacher-projects'], projects: {}, sso: true, ...state }));
  cur.current = file;
  process.env.FAKE_VC_STATE = file; process.env.FAKE_VERCEL_LOG = logFile;
  const lines = [];
  let st;
  for (let n = 0, pt = nextPort; ; n++, pt = pt >= 4428 ? PORT0 : pt + 1) {
    try { st = await startStudio({ port: pt, remote: true, appUrl: 'http://127.0.0.1:9', home: home || mkdtempSync(join(dir, 'home-')), log: (l) => lines.push(l) }); break; }
    catch (e) { if (e.code !== 'EADDRINUSE' || n >= 8) throw e; }
  }
  nextPort = st.port >= 4428 ? PORT0 : st.port + 1;
  st.S.vcOpts = { vercel: FAKE, urlBase: `http://127.0.0.1:${SITE_PORT}/v/`, open: false };
  const H = { 'x-lecpage-bridge': st.S.token, origin: 'https://lecpage.com', connection: 'close' };
  const base = `${st.url}bridge/vercel`;
  const get = async () => (await (await fetch(base, { headers: H })).json()).vc;
  const post = async (path, body) => { const r = await fetch(`${base}/${path}`, { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify(body || {}) }); return { status: r.status, ...(await r.json()) }; };
  const put = async (draft, path, data) => { const r = await fetch(`${base}/files?draft=${draft}&path=${encodeURIComponent(path)}`, { method: 'POST', headers: { ...H, 'content-type': 'application/octet-stream' }, body: Buffer.from(data) }); return { status: r.status, ...(await r.json()) }; };
  const until = async (pred = (v) => !v.running, ms = 20000) => { const t0 = Date.now(); for (;;) { const v = await get(); if (pred(v)) return v; if (Date.now() - t0 > ms) throw new Error('기다리다 끝남: ' + JSON.stringify(v)); await new Promise((r) => setTimeout(r, 40)); } };
  const state2 = () => JSON.parse(readFileSync(file, 'utf8'));
  const patch = (o) => writeFileSync(file, JSON.stringify({ ...state2(), ...o }));
  const vlog = () => (existsSync(logFile) ? readFileSync(logFile, 'utf8') : '');
  /** 사이트 파일을 건네고 올리기 시작 */
  const deploy = async (name, more = {}) => {
    const d = await post('draft');
    assert.equal(d.status, 200, JSON.stringify(d));
    assert.equal((await put(d.draft, 'index.html', '<!doctype html><title>t</title>')).status, 200);
    assert.equal((await put(d.draft, 'vercel.json', '{}')).status, 200);
    assert.equal((await put(d.draft, 'pages/001.webp', 'img')).status, 200);
    return post('site', { draft: d.draft, name, ...more });
  };
  return { st, H, base, get, post, put, until, deploy, state: state2, patch, vlog, lines, home: st.S.home, close: () => st.close() };
}

test('순수 함수: 실패 까닭 · 고정한 CLI 판', () => {
  assert.match(VERCEL_VER, /^\d+\.\d+\.\d+$/);
  assert.equal(explain('Error: No existing credentials found. Please run `vercel login`').code, 'login-needed');
  assert.equal(explain('npm error code E404').code, 'tool');
  assert.equal(explain('getaddrinfo ENOTFOUND api.vercel.com').code, 'network');
  assert.equal(explain('Too many requests - try again later (rate limited)').code, 'limit');
  assert.equal(explain('weird').code, 'failed');
  const d = explain('token: abcdefghij1234567890XYZ failed for teacher@example.com').detail;
  assert.ok(!/abcdefghij1234567890XYZ/.test(d) && !/teacher@example\.com/.test(d), '토큰·메일 모양은 가림');
});

test('짝 토큰 없이는 받지 않음 · caps에 vercel · 잘못된 이름은 CLI를 부르지 않음', async () => {
  const r = await rig();
  try {
    assert.ok(CAPS.includes('vercel'));
    assert.equal((await fetch(r.base, { headers: { origin: 'https://lecpage.com' } })).status, 401);
    assert.equal((await fetch(r.base, { headers: { ...r.H, origin: 'https://evil.example' } })).status, 403);
    assert.deepEqual(await r.get(), { running: false, phase: 'idle' });
    assert.equal((await r.post('nope')).status, 404);
    assert.equal((await r.post('site', { name: 'Bad Name!', draft: 'x' })).error, 'bad-name');
    assert.equal((await r.post('delete', { name: 'x; rm -rf /' })).error, 'bad-name');
    const d = await r.post('draft');
    assert.equal((await r.put(d.draft, '../evil.txt', 'x')).error, 'bad-path');
    assert.equal((await r.put('nope', 'index.html', 'x')).error, 'no-draft');
    assert.equal(r.vlog(), '', '잘못된 요청으로는 CLI를 부르지 않음');
  } finally { await r.close(); }
});

test('처음: 로그인을 기다렸다가 올리고 배포 보호를 끔 → 다시 올리면 같은 주소(보호는 건드리지 않음)', async () => {
  const r = await rig({ loggedIn: false });
  try {
    const s = await r.deploy('maum-class');
    assert.equal(s.status, 202, JSON.stringify(s));
    assert.equal((await r.post('site', { draft: 'x', name: 'other' })).status, 409, '한 번에 하나');
    const w = await r.until((v) => v.phase === 'login' && v.loginUrl);
    assert.match(w.loginUrl, /^https:\/\/vercel\.com\/oauth\/device\?user_code=/);
    r.patch({ approve: true }); // 브라우저에서 허용
    const d = await r.until();
    assert.equal(d.phase, 'done', JSON.stringify(d));
    assert.deepEqual(d.result.site, { url: `http://127.0.0.1:${SITE_PORT}/v/maum-class/`, name: 'maum-class', projectId: 'prj_1', opened: true, protected: false, ready: true });
    const p = r.state().projects['maum-class'];
    assert.equal(p.files, 3); assert.equal(p.sso, false); assert.equal(p.vercelJson, true);
    assert.ok(!JSON.stringify(d).includes('teacher@example.com'), '계정 메일은 앱에 내보내지 않음');
    const f = join(r.home, 'vercel.json');
    const rec = JSON.parse(readFileSync(f, 'utf8')).sites;
    assert.deepEqual(rec.map((x) => [x.name, x.team, x.owner]), [['maum-class', '', 'team_teacher-projects']], '올린 팀·계정과 함께 기록(팀은 하나뿐이라 고르지 않음)');
    assert.match(rec[0].user, /^[0-9a-f]{16}$/); assert.ok(!JSON.stringify(rec).includes('teacher@') && !JSON.stringify(rec).includes('"teacher"'), '로그인 이름·메일은 그대로 적지 않음');
    if (process.platform !== 'win32') assert.equal(statSync(f).mode & 0o777, 0o600);
    assert.ok(existsSync(join(r.home, 'vercel-cli')), 'CLI 설정은 커넥트 폴더 안에');
    // 다시 올리기: 강사가 그 사이 보호를 다시 켰어도 건드리지 않음(처음 만들 때만 풂)
    r.patch({ projects: { 'maum-class': { ...p, sso: true } } });
    assert.equal((await r.deploy('maum-class', { again: true })).status, 202);
    const d2 = await r.until();
    assert.equal(d2.result.site.opened, false); assert.equal(d2.result.site.protected, true); assert.equal(d2.result.site.ready, false);
    assert.equal(r.state().projects['maum-class'].deploys, 2);
    assert.equal(r.vlog().split('\n').filter((l) => l === 'login').length, 1, '두 번째에는 로그인하지 않음');
    // [배포 보호 끄기]
    assert.equal((await r.post('open', { name: 'maum-class' })).status, 202);
    assert.deepEqual((await r.until()).result, { opened: true });
    assert.equal(r.state().projects['maum-class'].sso, false);
    assert.equal((await r.post('open', { name: 'not-mine' })).status, 202);
    assert.equal((await r.until()).error.code, 'not-ours');
  } finally { await r.close(); }
});

test('팀이 여럿이면 한 번 물어 기억함 · 내 계정에 이미 있는 이름은 덮지 않음', async () => {
  const r = await rig({ teams: ['alpha-team', 'beta-team'], projects: { taken: { id: 'prj_9', sso: false, team: 'beta-team', files: 1 } } });
  try {
    assert.equal((await r.deploy('team-site')).status, 202);
    const q = await r.until((v) => v.ask);
    assert.equal(q.ask.kind, 'team');
    assert.deepEqual(q.ask.teams, [{ id: 'alpha-team', name: 'alpha-team' }, { id: 'beta-team', name: 'beta-team' }]);
    assert.equal((await r.post('answer', { team: 'evil-team' })).status, 409, '목록에 없는 팀은 받지 않음');
    assert.equal((await r.post('answer', { team: 'beta-team' })).status, 200);
    const d = await r.until();
    assert.equal(d.phase, 'done', JSON.stringify(d));
    assert.equal(r.state().projects['team-site'].team, 'beta-team');
    assert.equal(JSON.parse(readFileSync(join(r.home, 'vercel.json'), 'utf8')).team, 'beta-team');
    // 다음에는 묻지 않음
    assert.equal((await r.deploy('team-site', { again: true })).status, 202);
    const d2 = await r.until((v) => !v.running || v.ask);
    assert.ok(!d2.ask && d2.phase === 'done', JSON.stringify(d2));
    assert.match(r.vlog(), /deploy @beta-team team-site/);
    // 이 커넥트가 올리지 않은 같은 이름의 프로젝트
    assert.equal((await r.deploy('taken')).status, 202);
    const d3 = await r.until();
    assert.equal(d3.error.code, 'name-taken');
    assert.equal(r.state().projects.taken.files, 1, '덮지 않음');
    // 앱이 '이 연수가 올린 프로젝트'라고 알려 줘도(again) 그 주소에 lecpage 사이트가 없으면 덮지 않음(앱의 기록은 남이 준 연수 파일에도 들어 있을 수 있음)
    assert.equal((await r.deploy('taken', { again: true })).status, 202);
    const d3b = await r.until();
    assert.equal(d3b.error.code, 'exists', JSON.stringify(d3b));
    assert.equal(r.state().projects.taken.files, 1, '강사의 다른 프로젝트를 덮지 않음');
    // 그 주소에 lecpage 사이트가 있으면(토큰으로 올렸던 프로젝트에 다시) 그 프로젝트에 올리고, 그 뒤로는 이 커넥트가 지울 수 있음
    r.patch({ projects: { ...r.state().projects, taken: { ...r.state().projects.taken, lecpage: true } } });
    assert.equal((await r.deploy('taken', { again: true })).status, 202);
    const d4 = await r.until();
    assert.equal(d4.phase, 'done', JSON.stringify(d4));
    assert.equal(r.state().projects.taken.files, 3);
    assert.equal(d4.result.site.opened, false, '이미 있던 프로젝트의 보호 설정은 건드리지 않음');
    assert.ok(JSON.parse(readFileSync(join(r.home, 'vercel.json'), 'utf8')).sites.some((x) => x.name === 'taken' && x.team === 'beta-team'));
  } finally { await r.close(); }
});

test('실패 문구: 팀 없음 · 올리기 실패 · 로그인 만료 · 로그인 기다리다 중지', async () => {
  const r = await rig({ teams: [] });
  try {
    assert.equal((await r.deploy('a-site')).status, 202);
    assert.equal((await r.until()).error.code, 'no-team');
    r.patch({ teams: ['t1'], fail: { deploy: 'Build failed for teacher@example.com' } });
    assert.equal((await r.deploy('a-site')).status, 202);
    const e = (await r.until()).error;
    assert.equal(e.code, 'failed'); assert.match(e.message_ko, /Vercel에서 끝내지 못했어요/);
    assert.ok(!/teacher@example\.com/.test(JSON.stringify(e)), '메일은 가림');
    r.patch({ fail: null, expire: true });
    assert.equal((await r.deploy('a-site')).status, 202);
    assert.equal((await r.until()).error.code, 'login-needed');
    r.patch({ expire: false, loggedIn: false });
    assert.equal((await r.deploy('a-site')).status, 202);
    await r.until((v) => v.phase === 'login' && v.loginUrl);
    const c = await fetch(r.base, { method: 'DELETE', headers: r.H });
    assert.equal(c.status, 200);
    const v = await r.get();
    assert.equal(v.running, false); assert.equal(v.error.code, 'cancelled');
    assert.equal(Object.keys(r.state().projects).length, 0);
  } finally { await r.close(); }
});

test('지우기: 이 커넥트가 올린 것만 · 이미 없어도 목록에서 빠짐 · 연결 해제', async () => {
  const r = await rig({ sso: false });
  try {
    assert.equal((await r.deploy('bye-site')).status, 202);
    assert.equal((await r.until()).phase, 'done');
    assert.equal((await r.post('delete', { name: 'someone-else' })).status, 202);
    assert.equal((await r.until()).error.code, 'not-ours');
    r.patch({ fail: { delete: 'You do not have permission' } });
    assert.equal((await r.post('delete', { name: 'bye-site' })).status, 202);
    assert.equal((await r.until()).error.code, 'failed');
    assert.ok(r.state().projects['bye-site'], '실패하면 그대로');
    r.patch({ fail: null });
    assert.equal((await r.post('delete', { name: 'bye-site' })).status, 202);
    assert.deepEqual((await r.until()).result, { deleted: 'bye-site' });
    assert.equal(r.state().projects['bye-site'], undefined);
    assert.deepEqual(JSON.parse(readFileSync(join(r.home, 'vercel.json'), 'utf8')).sites, []);
    // Vercel에서 이미 지운 것: 목록에서만 빠짐
    assert.equal((await r.deploy('gone-site')).status, 202);
    assert.equal((await r.until()).phase, 'done');
    r.patch({ projects: {} });
    assert.equal((await r.post('delete', { name: 'gone-site' })).status, 202);
    assert.deepEqual((await r.until()).result, { deleted: 'gone-site' });
    assert.equal((await r.post('logout')).status, 202);
    assert.deepEqual((await r.until()).result, { loggedOut: true });
    assert.equal(r.state().loggedIn, false);
  } finally { await r.close(); }
});

// ── 독립 검토에서 고친 것 ──────────────────────────────────────────────
test('지우기·보호 끄기는 올린 팀에서: 기억한 팀이 그사이 바뀌어도 다른 팀의 "없음"을 지운 것으로 끝내지 않음', async () => {
  const r = await rig({ teams: ['alpha-team', 'beta-team'], sso: false });
  try {
    assert.equal((await r.deploy('team-a-site')).status, 202);
    await r.until((v) => v.ask);
    assert.equal((await r.post('answer', { team: 'alpha-team' })).status, 200);
    assert.equal((await r.until()).phase, 'done');
    const f = join(r.home, 'vercel.json');
    assert.deepEqual(sitesOf(JSON.parse(readFileSync(f, 'utf8'))).map((x) => [x.name, x.team, x.owner]), [['team-a-site', 'alpha-team', 'team_alpha-team']]);
    // 그 뒤 다른 연수는 다른 팀에 올려 기억한 팀이 바뀜
    const st = JSON.parse(readFileSync(f, 'utf8')); st.team = 'beta-team'; writeFileSync(f, JSON.stringify(st));
    const before = r.vlog().length;
    assert.equal((await r.post('open', { name: 'team-a-site' })).status, 202);
    assert.deepEqual((await r.until()).result, { opened: true, already: true });
    assert.equal((await r.post('delete', { name: 'team-a-site' })).status, 202);
    const d = await r.until((v) => !v.running || v.ask);
    assert.ok(!d.ask, '올린 팀을 알고 있어 묻지 않음');
    assert.deepEqual(d.result, { deleted: 'team-a-site' }, JSON.stringify(d));
    const log = r.vlog().slice(before);
    assert.match(log, /project delete @alpha-team/); assert.ok(!/@beta-team/.test(log), '다른 팀에는 묻지 않음');
    assert.equal(r.state().projects['team-a-site'], undefined, '실제로 지워짐');
    assert.equal(JSON.parse(readFileSync(f, 'utf8')).team, 'beta-team', '기억한 팀은 그대로');
    // 팀을 모르는 기록(이름만): 지금 고른 팀에서 없다고 해서 지운 것으로 끝내지 않음
    r.patch({ projects: { 'old-site': { id: 'prj_7', sso: false, team: 'alpha-team', files: 2 } } });
    const st2 = JSON.parse(readFileSync(f, 'utf8')); st2.sites = ['old-site']; writeFileSync(f, JSON.stringify(st2));
    assert.equal((await r.post('delete', { name: 'old-site' })).status, 202);
    const d2 = await r.until();
    assert.equal(d2.error.code, 'other-scope', JSON.stringify(d2));
    assert.ok(r.state().projects['old-site'], '지우지 않음'); assert.ok(sitesOf(JSON.parse(readFileSync(f, 'utf8'))).some((x) => x.name === 'old-site'), '기록도 그대로');
  } finally { await r.close(); }
});

test('다른 로그인이 올린 프로젝트는 다루지 않음 · 로그아웃하면 이 PC의 로그인 파일을 지움(CLI가 못 끝내도) · 작업 폴더는 사용자 폴더 안', async () => {
  const r = await rig({ sso: false });
  const cwdLog = join(r.home, '..', 'vc-cwd.log'); process.env.FAKE_VERCEL_CWD = cwdLog;
  try {
    assert.equal((await r.deploy('mine-site')).status, 202);
    assert.equal((await r.until()).phase, 'done');
    const root = realpathSync(join(r.home, 'work'));
    const rows = readFileSync(cwdLog, 'utf8').trim().split('\n').map((l) => l.split('\t'));
    for (const [cwd, pkg, dir] of rows) { assert.ok(cwd.startsWith(root + sep), cwd); assert.equal(pkg, 'true'); if (dir) assert.ok(realpathSync(dirname(dir)) === root, `받은 사이트 파일도 사용자 폴더 안: ${dir}`); }
    assert.deepEqual(readdirSync(root).filter((n) => n.startsWith('lecpage-studio-')), [], '끝나면 치움');
    assert.equal(r.state().projects['mine-site'].files, 3, '올릴 파일에 작업용 파일이 섞이지 않음');
    const auth = join(r.home, 'vercel-cli', 'auth.json');
    assert.ok(existsSync(auth));
    // 망이 끊겨 CLI가 로그아웃을 못 끝내도 이 PC의 로그인 파일은 지움
    r.patch({ fail: { logout: 'getaddrinfo ENOTFOUND api.vercel.com' } });
    assert.equal((await r.post('logout')).status, 202);
    assert.deepEqual((await r.until()).result, { loggedOut: true });
    assert.equal(existsSync(auth), false, '로그인 파일이 남지 않음');
    // 다른 사람이 로그인: 앞사람이 올린 프로젝트는 지우지 못함
    r.patch({ fail: null, loggedIn: true, user: 'someone-else' });
    assert.equal((await r.post('delete', { name: 'mine-site' })).status, 202);
    assert.equal((await r.until()).error.code, 'not-ours');
    assert.ok(r.state().projects['mine-site']);
    assert.deepEqual(readdirSync(r.home).filter((n) => /\.tmp$/.test(n)), []);
  } finally { delete process.env.FAKE_VERCEL_CWD; await r.close(); }
});
