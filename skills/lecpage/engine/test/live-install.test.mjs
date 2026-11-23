// 참여 기능 연결에서 옮겨 적는 것을 줄이는 조각(앱 app/src/lib/live-install.js)과 그것을 받는 쪽:
//   구글 시트 — Code.gs의 설치 코드(readInstall·한 번에 설치 메뉴·코드에 든 INSTALL을 연결 확인 때 적용), 예전 메뉴는 그대로
//   Supabase  — 설치 SQL + 연수 등록을 한 번에(두 번 실행해도 같은 결과), 붙여 넣은 글에서 주소·publishable 키 찾기(secret 거절), lec_caps()
// 실제 구글·Supabase 화면(권한 창·대시보드)은 여기서 다루지 않음(사람이 확인).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { skillDir } from './live-helpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const L = await import(pathToFileURL(path.join(ROOT, 'app/src/lib/live-install.js')).href);
const GS = fs.readFileSync(path.join(skillDir, 'backends/apps-script/Code.gs'), 'utf8');
const schemaFile = path.join(skillDir, 'backends/supabase/schema.sql');
const SCHEMA = fs.readFileSync(schemaFile, 'utf8');
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const KEY = 'k7Qm2xV9pLs4Tz8RbN3w'; // 앱이 만드는 키와 같은 모양(20자)
const HASH = sha(KEY);

// ---------------------------------------------------------------- 앱 쪽 순수 함수
test('설치 코드: 만들고 다시 읽으면 같은 값, 잘못된 값은 만들지 않음', () => {
  const c = L.sheetInstallCode({ code: 'ab12cd', hash: HASH, uploads: true, moderation: false, retentionDays: 45 });
  assert.match(c, /^lpi1\.[A-Za-z0-9_-]+$/); assert.ok(!c.includes(KEY), '관리자 키 자체는 들어 있지 않음');
  assert.deepEqual(L.readSheetInstall(c), { code: 'AB12CD', hash: HASH, uploads: true, moderation: false, retentionDays: 45 });
  assert.deepEqual(L.readSheetInstall(`  ${c.slice(0, 20)}\n${c.slice(20)} `), L.readSheetInstall(c), '줄이 나뉘어 붙어도 읽음');
  assert.equal(L.sheetInstallCode({ code: 'AB12CD', hash: HASH, retentionDays: 9999 }) && L.readSheetInstall(L.sheetInstallCode({ code: 'AB12CD', hash: HASH, retentionDays: 9999 })).retentionDays, 30);
  assert.throws(() => L.sheetInstallCode({ code: "A'); drop", hash: HASH }));
  assert.throws(() => L.sheetInstallCode({ code: 'AB12CD', hash: 'nothex' }));
  for (const bad of ['', 'lpi1.', 'lpi2.' + c.slice(5), c.slice(0, -6) + '!!!!!!', 'lpi1.' + Buffer.from('{"c":"AB12CD"}').toString('base64url')]) assert.equal(L.readSheetInstall(bad), null, bad.slice(0, 20));
});

test('Code.gs에 설치 코드 넣기: 자리는 한 곳, 없으면 null', () => {
  const c = L.sheetInstallCode({ code: 'AB12CD', hash: HASH });
  const out = L.withSheetInstall(GS, c);
  assert.ok(out && out.includes(`var INSTALL = '${c}';`) && !out.includes("var INSTALL = '';"));
  assert.equal(out.length, GS.length + c.length);
  assert.equal(L.withSheetInstall(GS.replace("var INSTALL = '';", ''), c), null);
  assert.equal(L.withSheetInstall(GS, "x'; evil();//"), null, '설치 코드 모양이 아니면 넣지 않음');
});

test('Supabase 설치 SQL: 설치 + 이 연수 등록 한 줄, 값은 검증', () => {
  const sql = L.supabaseInstallSql(SCHEMA, 'ab12cd', HASH, { retentionDays: 14, uploads: true, moderation: false, flushMs: 2500, extra: "x'; drop table t;--" });
  assert.ok(sql.startsWith(SCHEMA.trimEnd()));
  const last = sql.trim().split('\n').pop();
  assert.equal(last, `select lec_private.init_training_hash('AB12CD', '${HASH}', '{"retentionDays":14,"uploads":true,"moderation":false,"flushMs":2500}');`);
  assert.equal(sql.match(/^select lec_private\.init_training_hash\(/gm).length, 1);
  assert.throws(() => L.trainingSql("AB'); drop table x;--", HASH, {}));
  assert.throws(() => L.trainingSql('AB12CD', HASH + "'", {}));
});

test('Supabase에서 복사한 글에서 주소와 publishable 키 찾기, secret 키는 받지 않음', () => {
  const jwt = (role) => `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(JSON.stringify({ iss: 'supabase', ref: 'abcdefghijklmnopqrst', role })).toString('base64url')}.c2lnbmF0dXJlLXNpZ25hdHVyZQ`;
  const env = 'NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_AbCdEf123456_xyz-9\n';
  assert.deepEqual(L.parseSupabasePaste(env), { url: 'https://abcdefghijklmnopqrst.supabase.co', key: 'sb_publishable_AbCdEf123456_xyz-9', secret: false });
  assert.deepEqual(L.parseSupabasePaste('https://abcdefghijklmnopqrst.supabase.co/'), { url: 'https://abcdefghijklmnopqrst.supabase.co', key: '', secret: false });
  assert.deepEqual(L.parseSupabasePaste('  sb_publishable_AbCdEf123456  '), { url: '', key: 'sb_publishable_AbCdEf123456', secret: false });
  assert.deepEqual(L.parseSupabasePaste('SUPABASE_SECRET_KEY=sb_secret_NEVERUSE1234'), { url: '', key: '', secret: true }, 'secret 키만 있으면 아무 키도 돌려주지 않음');
  const both = L.parseSupabasePaste(`${env}SUPABASE_SECRET_KEY=sb_secret_NEVERUSE1234`);
  assert.equal(both.key, 'sb_publishable_AbCdEf123456_xyz-9'); assert.equal(both.secret, true); assert.ok(!JSON.stringify(both).includes('NEVERUSE'));
  assert.deepEqual(L.parseSupabasePaste(jwt('anon')), { url: '', key: jwt('anon'), secret: false }, '예전 anon 키도 받음');
  assert.deepEqual(L.parseSupabasePaste(jwt('service_role')), { url: '', key: '', secret: true });
  assert.deepEqual(L.parseSupabasePaste('아무 글'), { url: '', key: '', secret: false });
  assert.equal(L.isSupabaseSecret('sb_secret_abc'), true); assert.equal(L.isSupabaseSecret(jwt('service_role')), true);
  assert.equal(L.isSupabaseSecret('sb_publishable_abc'), false); assert.equal(L.isSupabaseSecret(jwt('anon')), false);
});

// ---------------------------------------------------------------- 구글 시트: Code.gs를 Apps Script 흉내 안에서
function gas(source = GS) {
  const props = new Map(); const sheets = new Map(); const ui = { prompts: [], alerts: [], answers: [] };
  const sheetObj = () => { const data = []; return {
    getRange: (r, c, nr, nc) => ({ setValues(v) { v.forEach((row, i) => { data[r - 1 + i] = row.slice(); }); return this; }, getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (data[r - 1 + i] || [])[c - 1 + j] ?? '')), setFontWeight() { return this; }, setNumberFormat() { return this; } }),
    getLastRow: () => data.length, getMaxRows: () => 1000, getMaxColumns: () => 26, setFrozenRows() {}, insertColumnsAfter() {}, appendRow(row) { data.push(row.slice()); }, deleteRows(r, n) { data.splice(r - 1, n); },
  }; };
  const ss = { getSheetByName: (n) => sheets.get(n) || null, insertSheet: (n) => { const s = sheetObj(); sheets.set(n, s); return s; } };
  const Ui = { ButtonSet: { OK_CANCEL: 'OK_CANCEL', YES_NO: 'YES_NO' }, Button: { OK: 'OK', CANCEL: 'CANCEL', YES: 'YES' },
    createMenu: () => { const m = { items: [], addItem(label, fn) { m.items.push([label, fn]); return m; }, addSeparator() { return m; }, addToUi() { ui.menu = m.items; } }; return m; },
    prompt(title, text) { ui.prompts.push(title); const a = ui.answers.shift(); return { getSelectedButton: () => (a == null ? 'CANCEL' : 'OK'), getResponseText: () => a || '' }; },
    alert(...a) { ui.alerts.push(a.join(' ')); return 'YES'; } };
  const g = {
    console, JSON, Math, Date, Array, Object, String, Number, RegExp, Error,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => { if (ui.none) throw new Error('no ui'); return Ui; } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (props.has(k) ? props.get(k) : null), setProperty: (k, v) => { props.set(k, String(v)); }, deleteProperty: (k) => { props.delete(k); }, getKeys: () => [...props.keys()], getProperties: () => Object.fromEntries(props) }) },
    CacheService: { getScriptCache: () => { const c = new Map(); return { get: (k) => c.get(k) ?? null, put: (k, v) => { c.set(k, v); }, remove: (k) => { c.delete(k); } }; } },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_a, s) => [...createHash('sha256').update(String(s), 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)),
      base64Decode: (s) => { if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.length % 4) throw new Error('bad base64'); return [...Buffer.from(s, 'base64')]; },
      newBlob: (bytes) => ({ getDataAsString: () => Buffer.from(bytes).toString('utf8') }),
      getUuid: () => '00000000-0000-4000-8000-000000000000', formatDate: (d) => d.toISOString().slice(0, 19).replace('T', ' '),
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ text: t, setMimeType() { return this; } }) },
  };
  vm.createContext(g); vm.runInContext(source, g, { filename: 'Code.gs' });
  const call = (fn, e) => JSON.parse(g[fn](e).text);
  return { g, props, sheets, ui, ping: () => call('doGet', { parameter: { a: 'ping' } }), post: (b) => call('doPost', { postData: { contents: JSON.stringify(b) } }) };
}

test('시트 메뉴 "한 번에 설치": 설치 코드 한 줄로 관리자 키·연수 코드·파일 올리기·보관 기간이 걸림', () => {
  const s = gas(); s.g.onOpen();
  assert.deepEqual(s.ui.menu.map((x) => x[1]).slice(0, 5), ['menuInstall', 'setup', 'menuSetAdminKey', 'menuSetCode', 'menuToggleUploads'], '예전 메뉴는 그대로, 한 번에 설치가 맨 위');
  assert.equal(s.ping().data.ready, false, '아직 관리자 키 없음');
  s.ui.answers.push(L.sheetInstallCode({ code: 'ab12cd', hash: HASH, uploads: true, moderation: true, retentionDays: 14 }));
  s.g.menuInstall();
  assert.match(s.ui.alerts.pop(), /설치가 끝났어요\(연수 코드 AB12CD\)/);
  assert.deepEqual([s.props.get('ADMIN_HASH'), s.props.get('CODE'), s.props.get('UPLOADS'), s.props.get('MODERATION'), s.props.get('RETENTION_DAYS')], [HASH, 'AB12CD', 'on', 'on', '14']);
  assert.ok(s.sheets.has('attendance') && s.sheets.has('questions') && s.sheets.has('files'), '탭도 함께 준비');
  const p = s.ping().data; assert.equal(p.ready, true); assert.equal(p.days, true); assert.equal(p.protocol, 1);
  assert.equal(s.post({ a: 'checkAdmin', code: 'AB12CD', admin: KEY }).data, true, '앱이 기억한 키로 강사 화면에 들어감');
  assert.equal(s.post({ a: 'checkAdmin', code: 'AB12CD', admin: 'wrong-key-123456' }).data, false);
  assert.equal(s.post({ a: 'checkAdmin', code: 'ZZ99ZZ', admin: KEY }).error, 'unknown_training', '다른 연수 코드는 받지 않음');
});

test('시트 메뉴 "한 번에 설치": 잘못된 설치 코드·예시 키는 알려 주고 아무것도 바꾸지 않음, 취소도 그대로', () => {
  const s = gas();
  for (const bad of ['안녕하세요', 'lpi1.' + Buffer.from('{"c":"AB12CD","h":"zz"}').toString('base64url'), 'lpi1.' + Buffer.from(JSON.stringify({ c: '!!', h: HASH })).toString('base64url'),
    L.sheetInstallCode({ code: 'AB12CD', hash: sha('change-me') })]) {
    s.ui.answers.push(bad); s.g.menuInstall();
    assert.ok(/설치 코드|연수 코드|관리자 키/.test(s.ui.alerts.pop()), bad.slice(0, 16));
    assert.equal(s.props.has('ADMIN_HASH'), false); assert.equal(s.props.has('CODE'), false);
  }
  s.g.menuInstall(); // 취소
  assert.equal(s.props.size, 0); assert.equal(s.ui.alerts.length, 0);
});

test('코드에 든 설치 코드(INSTALL): 붙여 넣고 배포만 하면 연결 확인(ping) 때 한 번 적용, 그 뒤 메뉴로 바꾼 값은 덮지 않음', () => {
  const code = L.sheetInstallCode({ code: 'AB12CD', hash: HASH, uploads: false, moderation: false, retentionDays: 30 });
  const s = gas(L.withSheetInstall(GS, code)); s.ui.none = true; // 웹 앱 요청에는 화면이 없음
  assert.equal(s.props.size, 0);
  const p = s.ping(); assert.equal(p.ok, true); assert.equal(p.data.ready, true); assert.equal(p.data.days, true);
  assert.deepEqual([s.props.get('ADMIN_HASH'), s.props.get('CODE'), s.props.get('UPLOADS'), s.props.has('MODERATION')], [HASH, 'AB12CD', 'off', false]);
  assert.ok(s.sheets.has('attendance'));
  assert.equal(s.post({ a: 'checkAdmin', code: 'AB12CD', admin: KEY }).data, true);
  // 강사가 나중에 메뉴로 관리자 키를 바꿈 → 다음 ping이 예전 설치 코드로 되돌리지 않음
  s.props.set('ADMIN_HASH', sha('나중에-바꾼-관리자키-99')); s.props.set('UPLOADS', 'on');
  s.ping();
  assert.equal(s.props.get('ADMIN_HASH'), sha('나중에-바꾼-관리자키-99')); assert.equal(s.props.get('UPLOADS'), 'on');
  // 새 연수의 설치 코드로 다시 붙여 넣으면(코드가 바뀜) 그때는 새 값이 걸림
  const s2 = gas(L.withSheetInstall(GS, L.sheetInstallCode({ code: 'NEW777', hash: sha('another-admin-key-000') }))); s2.ui.none = true;
  for (const [k, v] of s.props) s2.props.set(k, v);
  s2.ping();
  assert.deepEqual([s2.props.get('CODE'), s2.props.get('ADMIN_HASH')], ['NEW777', sha('another-admin-key-000')]);
});

test('코드에 든 설치 코드가 깨져 있으면 연결 확인이 까닭을 돌려줌(조용히 넘어가지 않음)', () => {
  const s = gas(GS.replace("var INSTALL = '';", "var INSTALL = 'lpi1.AAAAAAAAAAAAAAAAAAAAAAAA';")); s.ui.none = true;
  const p = s.ping(); assert.equal(p.ok, false); assert.equal(p.error, 'bad_install'); assert.equal(s.props.has('ADMIN_HASH'), false);
});

test('예전 방식 그대로: setup → 관리자 키 정하기 → 연수 코드 고정(설치 코드 없이)', () => {
  const s = gas();
  s.ui.answers.push('OLD123'); s.g.setup();
  assert.equal(s.props.get('CODE'), 'OLD123'); assert.ok(s.sheets.has('participants'));
  s.ui.answers.push('예전-방식-관리자키-12'); s.g.menuSetAdminKey();
  assert.equal(s.props.get('ADMIN_HASH'), sha('예전-방식-관리자키-12'));
  assert.equal(s.props.has('INSTALLED'), false);
  assert.equal(s.ping().data.ready, true);
  assert.equal(s.post({ a: 'checkAdmin', code: 'OLD123', admin: '예전-방식-관리자키-12' }).data, true);
});

// ---------------------------------------------------------------- Supabase: 설치 SQL을 실제 PostgreSQL에서 두 번
const pgBin = (() => {
  if (process.env.PG_BIN && fs.existsSync(path.join(process.env.PG_BIN, 'pg_ctl'))) return process.env.PG_BIN;
  try { for (const v of fs.readdirSync('/usr/lib/postgresql').sort().reverse()) { const d = `/usr/lib/postgresql/${v}/bin`; if (fs.existsSync(`${d}/pg_ctl`) && fs.existsSync(`${d}/postgres`)) return d; } } catch { /* none */ }
  return null;
})();
const isRoot = process.getuid && process.getuid() === 0;
const hasRunuser = isRoot && spawnSync('runuser', ['--help']).status === 0 && spawnSync('id', ['postgres']).status === 0;
const skip = !pgBin ? 'PostgreSQL server binaries not found' : isRoot && !hasRunuser ? 'running as root without a postgres user' : false;
const STUBS = `
create role anon nologin noinherit; create role authenticated nologin noinherit; create role service_role nologin noinherit bypassrls;
create schema realtime;
create table realtime.sent (id bigserial primary key, topic text, event text, payload jsonb, private boolean);
create function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language sql
  as $$ insert into realtime.sent (topic, event, payload, private) values (topic, event, payload, private) $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, delete on storage.objects to anon, authenticated;
`;
let dir; let port;
const asPg = (cmd, args) => (isRoot ? execFileSync('runuser', ['-u', 'postgres', '--', cmd, ...args], { stdio: 'pipe' }) : execFileSync(cmd, args, { stdio: 'pipe' }));
function psql(sql, { role = null, code = null } = {}) {
  let script = '\\set ON_ERROR_STOP 1\n';
  if (role) script += `set role ${role};\n`;
  if (code !== null) script += `select set_config('request.headers', '${JSON.stringify({ 'x-lec-code': code, 'x-forwarded-for': '10.0.0.7' })}', false) \\g /dev/null\n`;
  const r = spawnSync(`${pgBin}/psql`, ['-h', dir, '-p', String(port), '-U', 'postgres', '-d', 'postgres', '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: script + sql + '\n', encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('psql failed: ' + r.stderr.trim().split('\n').slice(0, 3).join(' | '));
  const last = r.stdout.replace(/\n$/, '').split('\n').pop() ?? '';
  try { return JSON.parse(last); } catch { return last; }
}
before(() => {
  if (skip) return;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lec-pg-inst-'));
  fs.chmodSync(dir, 0o777);
  if (isRoot) execFileSync('chown', ['postgres', dir]);
  port = 20000 + Math.floor(Math.random() * 20000);
  asPg(`${pgBin}/initdb`, ['-D', `${dir}/data`, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--locale=C.UTF-8', '-A', 'trust']);
  asPg(`${pgBin}/pg_ctl`, ['-D', `${dir}/data`, '-o', `-p ${port} -k ${dir} -c listen_addresses=''`, '-l', `${dir}/log`, '-w', 'start']);
  psql(STUBS);
});
after(() => {
  if (skip || !dir) return;
  try { asPg(`${pgBin}/pg_ctl`, ['-D', `${dir}/data`, '-m', 'immediate', 'stop']); } catch { /* ignore */ }
  fs.rmSync(dir, { recursive: true, force: true });
});

test('Supabase 설치 SQL(설치 + 연수 등록)을 두 번 실행해도 같은 결과, 앱이 기억한 키로 강사 확인, lec_caps', { skip }, () => {
  const settings = { retentionDays: 14, uploads: true, moderation: false, flushMs: 2500 };
  const sql = L.supabaseInstallSql(SCHEMA, 'SUPA01', HASH, settings);
  const state = () => psql(`select json_build_object('n', count(*), 'hash', max(admin_hash), 'ret', max(retention_days), 'flush', max(flush_ms), 'settings', max(settings::text)) from lec_private.trainings`);
  assert.deepEqual(psql(sql), { ok: true, code: 'SUPA01', retentionDays: 14, flushMs: 2500 }, '마지막 줄(연수 등록)의 결과');
  const first = state();
  assert.deepEqual([first.n, first.hash, first.ret, first.flush], [1, HASH, 14, 2500]);
  // 참가자가 들어온 뒤 같은 SQL을 다시 실행: 기록·연수는 그대로
  const j = psql(`select public.lec_join('SUPA01', '참가자1')`, { role: 'anon', code: 'SUPA01' });
  assert.ok(j && j.token, JSON.stringify(j));
  assert.deepEqual(psql(sql), { ok: true, code: 'SUPA01', retentionDays: 14, flushMs: 2500 });
  assert.deepEqual(state(), first);
  assert.equal(psql(`select count(*) from public.lec_participants where training_code = 'SUPA01'`), 1, '있던 참가자 그대로');
  // 연결 확인이 부르는 것들(anon)
  assert.equal(psql(`select public.lec_check_admin('SUPA01', '${KEY}')`, { role: 'anon', code: 'SUPA01' }), 't');
  assert.deepEqual(psql(`select public.lec_caps()`, { role: 'anon' }), { schema: 2, days: true });
  // 이미 연결한 강사가 새 버전으로 올릴 때: 설치 SQL만(등록 줄 없이) 다시 실행 → 관리자 키·설정은 그대로
  psql(SCHEMA);
  assert.deepEqual(state(), first);
  // 다른 연수를 같은 프로젝트에: 연수마다 줄이 하나씩
  psql(L.supabaseInstallSql(SCHEMA, 'SUPA02', sha('other-admin-key-5678'), {}));
  assert.equal(state().n, 2);
  assert.equal(psql(`select public.lec_check_admin('SUPA01', '${KEY}')`, { role: 'anon', code: 'SUPA01' }), 't', '먼저 등록한 연수의 키는 그대로');
});
