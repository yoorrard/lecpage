// Runs backends/supabase/schema.sql on a throwaway local PostgreSQL with minimal Supabase stand-ins
// (roles anon/authenticated/service_role, realtime.send, storage.buckets/objects) and checks the security model:
// RLS by x-lec-code header, column grants, token/admin checks, validation, rate limits, throttled ticks, purge, cleanup.
// Skipped when PostgreSQL server binaries are not installed.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { skillDir } from './live-helpers.mjs';

const schemaFile = path.join(skillDir, 'backends/supabase/schema.sql');
const pgBin = (() => {
  if (process.env.PG_BIN && fs.existsSync(path.join(process.env.PG_BIN, 'pg_ctl'))) return process.env.PG_BIN;
  try { for (const v of fs.readdirSync('/usr/lib/postgresql').sort().reverse()) { const d = `/usr/lib/postgresql/${v}/bin`; if (fs.existsSync(`${d}/pg_ctl`) && fs.existsSync(`${d}/postgres`)) return d; } } catch { /* none */ }
  return null;
})();
const isRoot = process.getuid && process.getuid() === 0;
const hasRunuser = isRoot && spawnSync('runuser', ['--help']).status === 0 && spawnSync('id', ['postgres']).status === 0;
const skip = !pgBin ? 'PostgreSQL server binaries not found' : isRoot && !hasRunuser ? 'running as root without a postgres user' : false;

let dir; let port;
const asPg = (cmd, args) => (isRoot ? execFileSync('runuser', ['-u', 'postgres', '--', cmd, ...args], { stdio: 'pipe' }) : execFileSync(cmd, args, { stdio: 'pipe' }));

before(() => {
  if (skip) return;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lec-pg-'));
  fs.chmodSync(dir, 0o777);
  if (isRoot) execFileSync('chown', ['postgres', dir]);
  port = 20000 + Math.floor(Math.random() * 20000);
  asPg(`${pgBin}/initdb`, ['-D', `${dir}/data`, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--locale=C.UTF-8', '-A', 'trust']);
  asPg(`${pgBin}/pg_ctl`, ['-D', `${dir}/data`, '-o', `-p ${port} -k ${dir} -c listen_addresses=''`, '-l', `${dir}/log`, '-w', 'start']);
  psql(STUBS, { role: null });
});
after(() => {
  if (skip || !dir) return;
  try { asPg(`${pgBin}/pg_ctl`, ['-D', `${dir}/data`, '-m', 'immediate', 'stop']); } catch { /* ignore */ }
  fs.rmSync(dir, { recursive: true, force: true });
});

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

/** Runs SQL; returns the last output line parsed as JSON when possible. Throws {sqlstate, message, hint} on error. */
function psql(sql, { role = 'anon', code = null, file = null } = {}) {
  let script = '\\set ON_ERROR_STOP 1\n\\set VERBOSITY verbose\n';
  if (role) script += `set role ${role};\n`;
  if (code !== null) script += `select set_config('request.headers', '${JSON.stringify({ 'x-lec-code': code, 'x-forwarded-for': '10.0.0.7, 172.16.0.1' })}', false) \\g /dev/null\n`;
  script += sql + '\n';
  const args = ['-h', dir, '-p', String(port), '-U', 'postgres', '-d', 'postgres', '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1'];
  if (file) args.push('-f', file);
  else args.push('-f', '-');
  const r = spawnSync(`${pgBin}/psql`, args, { input: file ? undefined : script, encoding: 'utf8' });
  if (r.status !== 0) {
    const m = /ERROR:\s+([0-9A-Z]{5}):\s+(.*)/.exec(r.stderr) || [];
    const hint = (/HINT:\s+(.*)/.exec(r.stderr) || [])[1];
    const e = new Error(`psql failed: ${r.stderr.trim().split('\n').slice(0, 4).join(' | ')}`);
    Object.assign(e, { sqlstate: m[1], msg: m[2], hint, stderr: r.stderr });
    throw e;
  }
  const lines = r.stdout.trim().split('\n').filter(Boolean);
  const last = lines[lines.length - 1];
  try { return JSON.parse(last); } catch { return last; }
}
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const j = (o) => `${q(JSON.stringify(o))}::jsonb`;
function fails(fn, sqlstate, msg) {
  try { fn(); } catch (e) { assert.equal(e.sqlstate, sqlstate, e.message); if (msg) assert.equal(e.msg, msg); return e; }
  assert.fail(`expected ${sqlstate}`);
}
const sent = (topic) => psql(`select coalesce(json_agg(payload order by id), '[]') from realtime.sent where topic = ${q(topic)}`, { role: null });

test('supabase: schema loads (twice: re-runnable) and passes basic advisor checks', { skip }, () => {
  psql('', { role: null, file: schemaFile });
  psql('', { role: null, file: schemaFile });
  const noRls = psql(`select coalesce(json_agg(relname), '[]') from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and relkind = 'r' and relname like 'lec\\_%' and not relrowsecurity`, { role: null });
  assert.deepEqual(noRls, [], 'every public lec_ table has RLS');
  const badDefiner = psql(`select coalesce(json_agg(p.proname), '[]') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'lec_private') and p.prosecdef and not coalesce(p.proconfig::text like '%search_path=""%', false)`, { role: null });
  assert.deepEqual(badDefiner, [], 'security definer functions pin search_path');
  const anonExec = psql(`select coalesce(json_agg(p.proname order by p.proname), '[]') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'lec_private' and has_function_privilege('anon', p.oid, 'execute')`, { role: null });
  assert.deepEqual(anonExec, ['code', 'cur_rev', 'delete_allowed', 'fail', 'ms', 'req_code', 'upload_allowed']);
  const bucket = psql(`select row_to_json(b) from storage.buckets b where id = 'lec-uploads'`, { role: null });
  assert.equal(bucket.file_size_limit, 20971520); assert.ok(bucket.allowed_mime_types.includes('video/mp4')); assert.ok(!bucket.allowed_mime_types.includes('image/svg+xml'));
  const init = psql(`select lec_private.init_training('SUPA1', '관리자키-supa-1', '{"retentionDays": 7}')`, { role: null });
  assert.equal(init.ok, true); assert.equal(init.retentionDays, 7);
  fails(() => psql(`select lec_private.init_training('SUPA9', 'x', '{}')`), '42501'); // anon cannot call setup functions
});

test('supabase: anon cannot touch tables directly; RLS scopes reads by the x-lec-code header', { skip }, () => {
  fails(() => psql(`insert into public.lec_questions (training_code, by, text, rev) values ('SUPA1', gen_random_uuid(), 'x', 1)`, { code: 'SUPA1' }), '42501');
  fails(() => psql(`select * from public.lec_participants`, { code: 'SUPA1' }), '42501');
  fails(() => psql(`select by from public.lec_questions`, { code: 'SUPA1' }), '42501');
  fails(() => psql(`select * from lec_private.trainings`, { code: 'SUPA1' }), '42501');
  fails(() => psql(`update public.lec_questions set votes = 100`, { code: 'SUPA1' }), '42501');
  const me = psql(`select public.lec_join('supa1', '김선생')`, { code: 'SUPA1' });
  psql(`select public.lec_add('SUPA1', ${q(me.token)}, 'questions', ${j({ text: '보이나요?' })})`, { code: 'SUPA1' });
  assert.equal(psql(`select count(*) from public.lec_questions`, { code: 'SUPA1' }), 1);
  assert.equal(psql(`select count(*) from public.lec_questions`, { code: 'OTHER' }), 0, 'other code header sees nothing');
  assert.equal(psql(`select count(*) from public.lec_questions`, { code: null }), 0, 'no header sees nothing');
});

test('supabase: join/add/vote/validation/rate limits through RPCs', { skip }, () => {
  psql(`select lec_private.init_training('SUPA2', '관리자키-supa-2')`, { role: null });
  const o = { code: 'SUPA2' };
  const a = psql(`select public.lec_join('SUPA2', '  가나다  ')`, o);
  assert.match(a.token, /^[0-9a-f]{64}$/); assert.equal(a.nickname, '가나다');
  assert.equal(psql(`select token_hash = encode(sha256(convert_to(${q(a.token)}, 'UTF8')), 'hex') from public.lec_participants where id = ${q(a.id)}`, { role: null }), 't', 'only the hash is stored');
  fails(() => psql(`select public.lec_join('SUPA2', ${q('가'.repeat(21))})`, o), 'PT400', 'too_long');
  fails(() => psql(`select public.lec_join('SUPA2', 'x', '홍길동')`, o), 'PT400', 'consent_required');
  fails(() => psql(`select public.lec_join('NOPE1', 'x')`, o), 'PT404', 'unknown_training');
  const b = psql(`select public.lec_join('SUPA2', '둘')`, o);
  const qd = psql(`select public.lec_add('SUPA2', ${q(a.token)}, 'questions', ${j({ text: '<b>질문</b>‮', cid: 'c-1', votes: 50 })})`, o);
  assert.equal(qd.text, '<b>질문</b>'); assert.equal(qd.votes, 0); assert.equal(qd.by, undefined); assert.equal(qd.nickname, ''); assert.equal(typeof qd.createdAt, 'number');
  const again = psql(`select public.lec_add('SUPA2', ${q(a.token)}, 'questions', ${j({ text: '다른 글', cid: 'c-1' })})`, o);
  assert.equal(again.id, qd.id, 'idempotent cid');
  fails(() => psql(`select public.lec_add('SUPA2', 'bad-token', 'questions', ${j({ text: 'x' })})`, o), 'PT401', 'invalid_token');
  fails(() => psql(`select public.lec_add('SUPA2', ${q(a.token)}, 'questions', ${j({ text: 'ㄱ'.repeat(501) })})`, o), 'PT400', 'too_long');
  fails(() => psql(`select public.lec_add('SUPA2', ${q(a.token)}, 'secrets', ${j({})})`, o), 'PT404');
  fails(() => psql(`select public.lec_add('SUPA2', ${q(a.token)}, 'questions', ${j({ text: { x: 1 } })})`, o), 'PT400', 'invalid_type');
  fails(() => psql(`select public.lec_add('SUPA2', ${q(a.token)}, 'polls', ${j({ question: 'x' })})`, o), 'PT401', 'admin_required');
  assert.equal(psql(`select public.lec_vote('SUPA2', ${q(b.token)}, ${q(qd.id)})`, o).votes, 1);
  assert.equal(psql(`select public.lec_vote('SUPA2', ${q(b.token)}, ${q(qd.id)})`, o).already, true);
  assert.equal(psql(`select public.lec_vote('SUPA2', ${q(a.token)}, ${q(qd.id)})`, o).votes, 2);
  fails(() => psql(`select public.lec_vote('SUPA2', ${q(a.token)}, 'not-a-uuid')`, o), 'PT404');
  const p1 = psql(`select public.lec_add('SUPA2', ${q(a.token)}, 'progress', ${j({ station: 's1', status: 'doing' })})`, o);
  const p2 = psql(`select public.lec_add('SUPA2', ${q(a.token)}, 'progress', ${j({ station: 's1', status: 'done' })})`, o);
  assert.equal(p1.id, p2.id); assert.equal(p2.status, 'done'); assert.equal(p2.by, a.id);
  const ans = psql(`select public.lec_add('SUPA2', ${q(a.token)}, 'answers', ${j({ poll: 'bp-1', value: ['협업', 3] })})`, o);
  assert.deepEqual(ans.value, ['협업', 3]);
  const sv = psql(`select public.lec_add('SUPA2', ${q(a.token)}, 'survey', ${j({ answers: { q1: '좋아요', q2: 5, q3: true } })})`, o);
  assert.equal(sv.answers.q2, 5);
  fails(() => psql(`select public.lec_add('SUPA2', ${q(a.token)}, 'posts', ${j({ text: 'x', files: [{ url: 'javascript:alert(1)', type: 'image/png' }] })})`, o), 'PT400');
  fails(() => psql(`select public.lec_add('SUPA2', ${q(a.token)}, 'posts', ${j({ text: 'x', files: [{ url: 'https://x/a.svg', type: 'image/svg+xml' }] })})`, o), 'PT415');
  // owner edits; others cannot
  const edited = psql(`select public.lec_update('SUPA2', ${q(a.token)}, null, 'questions', ${q(qd.id)}, ${j({ text: '고친 질문', votes: 99, status: 'answered' })})`, o);
  assert.equal(edited.text, '고친 질문'); assert.equal(edited.votes, 2); assert.equal(edited.status, 'open');
  fails(() => psql(`select public.lec_update('SUPA2', ${q(b.token)}, null, 'questions', ${q(qd.id)}, ${j({ text: '남의 글' })})`, o), 'PT403');
  // per-participant rate limit (questions: 8/minute); the neighbour behind the same NAT is unaffected
  let limited = null;
  for (let i = 0; i < 9 && !limited; i++) {
    try { psql(`select public.lec_add('SUPA2', ${q(b.token)}, 'questions', ${j({ text: '질문 ' + i })})`, o); } catch (e) { limited = e; }
  }
  assert.equal(limited && limited.sqlstate, 'PT429');
  psql(`select public.lec_add('SUPA2', ${q(a.token)}, 'chat', ${j({ text: '저는 괜찮아요' })})`, o);
});

test('supabase: snapshot cursor, hidden content, admin RPCs, throttled realtime ticks', { skip }, () => {
  psql(`select lec_private.init_training('SUPA3', '관리자키-supa-3', '{"flushMs": 1500}')`, { role: null });
  const o = { code: 'SUPA3' };
  const a = psql(`select public.lec_join('SUPA3', '하나')`, o);
  const s0 = psql(`select public.lec_snapshot('SUPA3', 0)`, o);
  assert.equal(s0.full, true); assert.deepEqual(s0.questions, []); assert.equal(s0.participants, undefined);
  fails(() => psql(`select public.lec_snapshot('SUPA3', 0)`, { code: 'SUPA2' }), 'PT400', 'code_header');
  const q1 = psql(`select public.lec_add('SUPA3', ${q(a.token)}, 'questions', ${j({ text: '첫째' })})`, o);
  const q2 = psql(`select public.lec_add('SUPA3', ${q(a.token)}, 'questions', ${j({ text: '둘째', anonymous: false })})`, o);
  assert.ok(q2._flush > 0, 'second write inside the throttle window reports a pending tick');
  let ticks = sent('lec:SUPA3');
  assert.equal(ticks.length, 1, 'one public tick for two quick writes');
  const s1 = psql(`select public.lec_snapshot('SUPA3', ${s0.now})`, o);
  assert.deepEqual(s1.questions.map((x) => x.text), ['첫째', '둘째']);
  assert.equal(s1.questions[1].nickname, '하나');
  // state: admin only; validated
  fails(() => psql(`select public.lec_set_state('SUPA3', null, ${j({ slide: 2 })})`, o), 'PT401');
  fails(() => psql(`select public.lec_set_state('SUPA3', 'wrong-key', ${j({ slide: 2 })})`, o), 'PT403');
  fails(() => psql(`select public.lec_set_state('SUPA3', '관리자키-supa-3', ${j({ notice: { text: 'x', level: 'party' } })})`, o), 'PT400');
  const st = psql(`select public.lec_set_state('SUPA3', '관리자키-supa-3', ${j({ slide: 3, follow: true, notice: { text: '쉬는 시간', level: 'warn' }, ui: { qr: true }, evil: 1 })})`, o);
  assert.equal(st.slide, 3); assert.equal(st.notice.level, 'warn'); assert.equal(st.evil, undefined); assert.equal(st.ui.qr, true);
  const st2 = psql(`select public.lec_set_state('SUPA3', '관리자키-supa-3', ${j({ notice: null, ui: { qr: null } })})`, o);
  assert.equal(st2.notice, null); assert.equal(st2.slide, 3); assert.deepEqual(st2.ui, {});
  // flush later sends the pending tick
  spawnSync('sleep', ['1.6']);
  psql(`select public.lec_flush('SUPA3')`, o);
  ticks = sent('lec:SUPA3');
  assert.ok(ticks.length >= 2); assert.equal(ticks.at(-1).rev, psql(`select pub_rev from lec_private.trainings where code = 'SUPA3'`, { role: null }));
  assert.ok(sent('lec:SUPA3:adm').length >= 1, 'console channel gets ticks too');
  // hide: content leaves the readable table
  psql(`select public.lec_update('SUPA3', null, '관리자키-supa-3', 'questions', ${q(q1.id)}, ${j({ status: 'hidden' })})`, o);
  assert.equal(psql(`select text from public.lec_questions where id = ${q(q1.id)}`, o), '');
  const adm = psql(`select public.lec_admin_snapshot('SUPA3', '관리자키-supa-3', 0)`, o);
  assert.equal(adm.questions.find((x) => x.id === q1.id).text, '첫째');
  assert.equal(adm.participants.length, 1); assert.equal(adm.participants[0].token_hash, undefined);
  fails(() => psql(`select public.lec_vote('SUPA3', ${q(a.token)}, ${q(q1.id)})`, o), 'PT409');
  psql(`select public.lec_update('SUPA3', null, '관리자키-supa-3', 'questions', ${q(q1.id)}, ${j({ status: 'open' })})`, o);
  assert.equal(psql(`select text from public.lec_questions where id = ${q(q1.id)}`, o), '첫째');
  // remove → tombstone in the next snapshot
  const before = psql(`select public.lec_snapshot('SUPA3', 0)`, o).now;
  fails(() => psql(`select public.lec_remove('SUPA3', 'nope', 'questions', ${q(q2.id)})`, o), 'PT403');
  psql(`select public.lec_remove('SUPA3', '관리자키-supa-3', 'questions', ${q(q2.id)})`, o);
  assert.deepEqual(psql(`select public.lec_snapshot('SUPA3', ${before})`, o).removed, [{ col: 'questions', id: q2.id }]);
  // reactions are aggregated into the public tick
  spawnSync('sleep', ['1.6']);
  psql(`select public.lec_react('SUPA3', ${q(a.token)}, ${j({ '👏': 3, '💡': 1 })})`, o);
  fails(() => psql(`select public.lec_react('SUPA3', ${q(a.token)}, ${j({ '<script>': 1 })})`, o), 'PT400');
  assert.deepEqual(sent('lec:SUPA3').at(-1).r, { '👏': 3, '💡': 1 });
  assert.equal(psql(`select public.lec_check_admin('SUPA3', '관리자키-supa-3')`, o), 't');
  assert.equal(psql(`select public.lec_check_admin('SUPA3', 'x')`, o), 'f');
  // participant's own private docs
  psql(`select public.lec_add('SUPA3', ${q(a.token)}, 'attendance', ${j({ kind: 'in' })})`, o);
  const mine = psql(`select public.lec_mine('SUPA3', ${q(a.token)})`, o);
  assert.equal(mine.attendance.length, 1); assert.equal(mine.me.id, a.id);
  const exp = psql(`select public.lec_export('SUPA3', '관리자키-supa-3', 'attendance')`, o);
  assert.equal(exp.kind, 'attendance'); assert.equal(exp.attendance.length, 1);
});

test('supabase: upload tickets gate storage inserts; purge and retention cleanup', { skip }, () => {
  psql(`select lec_private.init_training('SUPA4', '관리자키-supa-4', '{"maxUploadMb": 5}')`, { role: null });
  const o = { code: 'SUPA4' };
  const a = psql(`select public.lec_join('SUPA4', '올리기')`, o);
  fails(() => psql(`select public.lec_upload_ticket('SUPA4', ${q(a.token)}, 'x.svg', 'image/svg+xml', 100)`, o), 'PT415');
  fails(() => psql(`select public.lec_upload_ticket('SUPA4', ${q(a.token)}, 'big.mp4', 'video/mp4', ${6 * 1048576})`, o), 'PT413');
  const tk = psql(`select public.lec_upload_ticket('SUPA4', ${q(a.token)}, '사진.png', 'image/png', 1000)`, o);
  assert.match(tk.path, /^SUPA4\/[0-9a-f]{32}\.png$/);
  psql(`insert into storage.objects (bucket_id, name) values ('lec-uploads', ${q(tk.path)})`, o);
  fails(() => psql(`insert into storage.objects (bucket_id, name) values ('lec-uploads', 'SUPA4/guessed.png')`, o), '42501');
});

test('supabase: purge wipes rows and opens a short storage delete window; cleanup honours retention', { skip }, () => {
  const o = { code: 'SUPA4' };
  assert.equal(psql(`with d as (delete from storage.objects where bucket_id = 'lec-uploads' returning 1) select count(*) from d`, o), 0, 'no delete before purge');
  const a = psql(`select public.lec_join('SUPA4', '둘')`, o);
  psql(`select public.lec_add('SUPA4', ${q(a.token)}, 'questions', ${j({ text: '지워질 질문' })})`, o);
  fails(() => psql(`select public.lec_purge('SUPA4', 'nope')`, o), 'PT403');
  const r = psql(`select public.lec_purge('SUPA4', '관리자키-supa-4')`, o);
  assert.equal(r.files.length, 1);
  assert.equal(psql(`select count(*) from public.lec_questions`, o), 0);
  assert.deepEqual(sent('lec:SUPA4').at(-1), { reset: true });
  fails(() => psql(`select public.lec_add('SUPA4', ${q(a.token)}, 'questions', ${j({ text: 'x' })})`, o), 'PT401');
  assert.equal(psql(`with d as (delete from storage.objects where bucket_id = 'lec-uploads' and name like 'SUPA4/%' returning 1) select count(*) from d`, o), 1, 'admin client may now remove the files');
  psql(`update lec_private.trainings set last_at = now() - interval '8 days' where code = 'SUPA1'`, { role: null });
  assert.equal(psql(`select lec_private.cleanup()`, { role: null }), 1);
  assert.equal(psql(`select count(*) from public.lec_participants where training_code = 'SUPA1'`, { role: null }), 0, 'rows cascade with the training');
});
