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


/** Runs SQL; returns the last output line parsed as JSON when possible. Throws {sqlstate, message, hint} on error. */
function psql(sql, { role = 'anon', code = null, file = null, xff = '10.0.0.7, 172.16.0.1' } = {}) {
  let script = '\\set ON_ERROR_STOP 1\n\\set VERBOSITY verbose\n';
  if (role) script += `set role ${role};\n`;
  if (code !== null) script += `select set_config('request.headers', '${JSON.stringify({ 'x-lec-code': code, 'x-forwarded-for': xff })}', false) \\g /dev/null\n`;
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
  const lines = r.stdout.replace(/\n$/, '').split('\n');
  const last = lines[lines.length - 1] ?? '';
  try { return JSON.parse(last); } catch { return last; }
}
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const j = (o) => `${q(JSON.stringify(o))}::jsonb`;
function fails(fn, sqlstate, msg) {
  try { fn(); } catch (e) { assert.equal(e.sqlstate, sqlstate, e.message); if (msg) assert.equal(e.msg, msg); return e; }
  assert.fail(`expected ${sqlstate}`);
}
/** Admin errors are returned (not raised) so the failure counter commits; PostgREST sends response.status. */
function isErr(out, status, code = 'admin_required') {
  assert.equal(out && out.code, 'PT' + status, JSON.stringify(out)); assert.equal(out.message, code);
}
const sent = (topic) => psql(`select coalesce(json_agg(payload order by id), '[]') from realtime.sent where topic = ${q(topic)}`, { role: null });

test('supabase: schema loads (twice: re-runnable) and passes basic advisor checks', { skip }, () => {
  psql('', { role: null, file: schemaFile });
  psql('', { role: null, file: schemaFile });
  const noRls = psql(`select coalesce(json_agg(relname), '[]') from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and relkind = 'r' and relname like 'lec\\_%' and not relrowsecurity`, { role: null });
  assert.deepEqual(noRls, [], 'every public lec_ table has RLS');
  const badDefiner = psql(`select coalesce(json_agg(p.proname), '[]') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'lec_private') and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`, { role: null });
  assert.deepEqual(badDefiner, [], 'security definer functions pin search_path');
  const anonExec = psql(`select coalesce(json_agg(p.proname order by p.proname), '[]') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'lec_private' and has_function_privilege('anon', p.oid, 'execute')`, { role: null });
  assert.deepEqual(anonExec, ['code', 'cur_rev', 'delete_allowed', 'fail', 'file_readable', 'ms', 'req_code', 'trashed', 'upload_allowed', 'upload_ok']);
  const bucket = psql(`select row_to_json(b) from storage.buckets b where id = 'lec-uploads'`, { role: null });
  assert.equal(bucket.public, false, 'private bucket: signed URLs only (H3)');
  assert.equal(bucket.file_size_limit, 20971520); assert.ok(bucket.allowed_mime_types.includes('video/mp4')); assert.ok(!bucket.allowed_mime_types.includes('image/svg+xml'));
  const init = psql(`select lec_private.init_training('SUPA1', '관리자키-supa-0001', '{"retentionDays": 7}')`, { role: null });
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
  psql(`select lec_private.init_training('SUPA2', '관리자키-supa-0002')`, { role: null });
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
  isErr(psql(`select public.lec_add('SUPA2', ${q(a.token)}, 'polls', ${j({ question: 'x' })})`, o), 401);
  assert.equal(psql(`select public.lec_vote('SUPA2', ${q(b.token)}, ${q(qd.id)})`, o).votes, 1);
  assert.equal(psql(`select public.lec_vote('SUPA2', ${q(b.token)}, ${q(qd.id)})`, o).already, true);
  assert.equal(psql(`select public.lec_vote('SUPA2', ${q(a.token)}, ${q(qd.id)})`, o).votes, 2);
  fails(() => psql(`select public.lec_vote('SUPA2', ${q(a.token)}, 'not-a-uuid')`, o), 'PT404');
  const p1 = psql(`select public.lec_add('SUPA2', ${q(a.token)}, 'progress', ${j({ station: 's1', status: 'doing' })})`, o);
  const p2 = psql(`select public.lec_add('SUPA2', ${q(a.token)}, 'progress', ${j({ station: 's1', status: 'done' })})`, o);
  assert.equal(p1.id, p2.id); assert.equal(p2.status, 'done'); assert.equal(p2.by, a.id);
  psql(`select public.lec_set_state('SUPA2', '관리자키-supa-0002', ${j({ openPoll: 'bp-1' })})`, o); // an unregistered blueprint poll: only while open
  const ans = psql(`select public.lec_add('SUPA2', ${q(a.token)}, 'answers', ${j({ poll: 'bp-1', value: ['협업', 3] })})`, o);
  assert.deepEqual(ans.value, ['협업', 3]);
  const sv = psql(`select public.lec_add('SUPA2', ${q(a.token)}, 'survey', ${j({ answers: { q1: '좋아요', q2: 5, q3: true } })})`, o);
  assert.equal(sv.answers.q2, 5);
  fails(() => psql(`select public.lec_add('SUPA2', ${q(a.token)}, 'posts', ${j({ text: 'x', files: [{ url: 'javascript:alert(1)', type: 'image/png' }] })})`, o), 'PT400');
  fails(() => psql(`select public.lec_add('SUPA2', ${q(a.token)}, 'posts', ${j({ text: 'x', files: [{ url: 'https://tracker.example/p.png', type: 'image/png' }] })})`, o), 'PT400');
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
  psql(`select lec_private.init_training('SUPA3', '관리자키-supa-0003', '{"flushMs": 1500}')`, { role: null });
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
  isErr(psql(`select public.lec_set_state('SUPA3', null, ${j({ slide: 2 })})`, o), 401);
  isErr(psql(`select public.lec_set_state('SUPA3', 'wrong-key', ${j({ slide: 2 })})`, o), 403);
  fails(() => psql(`select public.lec_set_state('SUPA3', '관리자키-supa-0003', ${j({ notice: { text: 'x', level: 'party' } })})`, o), 'PT400');
  const st = psql(`select public.lec_set_state('SUPA3', '관리자키-supa-0003', ${j({ slide: 3, follow: true, notice: { text: '쉬는 시간', level: 'warn' }, ui: { qr: true }, evil: 1 })})`, o);
  assert.equal(st.slide, 3); assert.equal(st.notice.level, 'warn'); assert.equal(st.evil, undefined); assert.equal(st.ui.qr, true);
  const st2 = psql(`select public.lec_set_state('SUPA3', '관리자키-supa-0003', ${j({ notice: null, ui: { qr: null } })})`, o);
  assert.equal(st2.notice, null); assert.equal(st2.slide, 3); assert.deepEqual(st2.ui, {});
  // flush later sends the pending tick
  spawnSync('sleep', ['1.6']);
  psql(`select public.lec_flush('SUPA3')`, o);
  ticks = sent('lec:SUPA3');
  assert.ok(ticks.length >= 2); assert.equal(ticks.at(-1).rev, psql(`select pub_rev from lec_private.trainings where code = 'SUPA3'`, { role: null }));
  assert.ok(sent('lec:SUPA3:adm').length >= 1, 'console channel gets ticks too');
  // hide: content leaves the readable table
  psql(`select public.lec_update('SUPA3', null, '관리자키-supa-0003', 'questions', ${q(q1.id)}, ${j({ status: 'hidden' })})`, o);
  assert.equal(psql(`select text from public.lec_questions where id = ${q(q1.id)}`, o), '');
  const adm = psql(`select public.lec_admin_snapshot('SUPA3', '관리자키-supa-0003', 0)`, o);
  assert.equal(adm.questions.find((x) => x.id === q1.id).text, '첫째');
  assert.equal(adm.participants.length, 1); assert.equal(adm.participants[0].token_hash, undefined);
  fails(() => psql(`select public.lec_vote('SUPA3', ${q(a.token)}, ${q(q1.id)})`, o), 'PT409');
  psql(`select public.lec_update('SUPA3', null, '관리자키-supa-0003', 'questions', ${q(q1.id)}, ${j({ status: 'open' })})`, o);
  assert.equal(psql(`select text from public.lec_questions where id = ${q(q1.id)}`, o), '첫째');
  // remove → tombstone in the next snapshot
  const before = psql(`select public.lec_snapshot('SUPA3', 0)`, o).now;
  isErr(psql(`select public.lec_remove('SUPA3', 'nope', 'questions', ${q(q2.id)})`, o), 403);
  psql(`select public.lec_remove('SUPA3', '관리자키-supa-0003', 'questions', ${q(q2.id)})`, o);
  assert.deepEqual(psql(`select public.lec_snapshot('SUPA3', ${before})`, o).removed, [{ col: 'questions', id: q2.id }]);
  // reactions are aggregated into the public tick
  spawnSync('sleep', ['1.6']);
  psql(`select public.lec_react('SUPA3', ${q(a.token)}, ${j({ '👏': 3, '💡': 1 })})`, o);
  fails(() => psql(`select public.lec_react('SUPA3', ${q(a.token)}, ${j({ '<script>': 1 })})`, o), 'PT400');
  assert.deepEqual(sent('lec:SUPA3').at(-1).r, { '👏': 3, '💡': 1 }, 'older clients still get r');
  const rx = psql(`select public.lec_reactions('SUPA3')`, o);
  assert.equal(rx.rx, sent('lec:SUPA3').at(-1).rx); assert.deepEqual(rx.r, { '👏': 3, '💡': 1 }, 'new clients read the batch through the RPC');
  assert.equal(psql(`select public.lec_check_admin('SUPA3', '관리자키-supa-0003')`, o), 't');
  assert.equal(psql(`select public.lec_check_admin('SUPA3', 'x')`, o), 'f');
  // participant's own private docs
  psql(`select public.lec_add('SUPA3', ${q(a.token)}, 'attendance', ${j({ kind: 'in' })})`, o);
  const mine = psql(`select public.lec_mine('SUPA3', ${q(a.token)})`, o);
  assert.equal(mine.attendance.length, 1); assert.equal(mine.me.id, a.id);
  const exp = psql(`select public.lec_export('SUPA3', '관리자키-supa-0003', 'attendance')`, o);
  assert.equal(exp.kind, 'attendance'); assert.equal(exp.attendance.length, 1);
});

test('supabase: upload tickets gate storage inserts; purge and retention cleanup', { skip }, () => {
  psql(`select lec_private.init_training('SUPA4', '관리자키-supa-0004', '{"maxUploadMb": 5}')`, { role: null });
  const o = { code: 'SUPA4' };
  const a = psql(`select public.lec_join('SUPA4', '올리기')`, o);
  fails(() => psql(`select public.lec_upload_ticket('SUPA4', ${q(a.token)}, 'x.svg', 'image/svg+xml', 100)`, o), 'PT415');
  fails(() => psql(`select public.lec_upload_ticket('SUPA4', ${q(a.token)}, 'big.mp4', 'video/mp4', ${6 * 1048576})`, o), 'PT413');
  const tk = psql(`select public.lec_upload_ticket('SUPA4', ${q(a.token)}, '사진.png', 'image/png', 1000)`, o);
  assert.match(tk.path, /^SUPA4\/[0-9a-f]{32}\.png$/);
  psql(`insert into storage.objects (bucket_id, name) values ('lec-uploads', ${q(tk.path)})`, o);
  fails(() => psql(`insert into storage.objects (bucket_id, name) values ('lec-uploads', 'SUPA4/guessed.png')`, o), '42501');
});

test('supabase: purge wipes rows and puts the files in the trash (deletable); cleanup honours retention', { skip }, () => {
  const o = { code: 'SUPA4' };
  assert.equal(psql(`with d as (delete from storage.objects where bucket_id = 'lec-uploads' returning 1) select count(*) from d`, o), 0, 'no delete before purge');
  const a = psql(`select public.lec_join('SUPA4', '둘')`, o);
  psql(`select public.lec_add('SUPA4', ${q(a.token)}, 'questions', ${j({ text: '지워질 질문' })})`, o);
  isErr(psql(`select public.lec_purge('SUPA4', 'nope')`, o), 403);
  const r = psql(`select public.lec_purge('SUPA4', '관리자키-supa-0004')`, o);
  assert.equal(r.files.length, 1);
  assert.equal(psql(`select count(*) from public.lec_questions`, o), 0);
  assert.deepEqual(sent('lec:SUPA4').at(-1), { reset: true });
  fails(() => psql(`select public.lec_add('SUPA4', ${q(a.token)}, 'questions', ${j({ text: 'x' })})`, o), 'PT401');
  assert.equal(psql(`with d as (delete from storage.objects where bucket_id = 'lec-uploads' and name like 'SUPA4/%' returning 1) select count(*) from d`, o), 1, 'trashed files may now be removed');
  psql(`update lec_private.trainings set last_at = now() - interval '8 days' where code = 'SUPA1'`, { role: null });
  assert.equal(psql(`select lec_private.cleanup()`, { role: null }), 1);
  assert.equal(psql(`select count(*) from public.lec_participants where training_code = 'SUPA1'`, { role: null }), 0, 'rows cascade with the training');
});

// ---------------------------------------------------------------- security regressions (2026-11 review)
test('supabase (H4): weak keys refused; wrong admin keys are counted (the count survives) and lock with 429', { skip }, () => {
  fails(() => psql(`select lec_private.init_training('WEAK1', 'change-me-관리자키')`, { role: null }), 'PT400', 'weak_key');
  fails(() => psql(`select lec_private.init_training('WEAK1', 'short-key')`, { role: null }), 'PT400', 'weak_key');
  const weakHash = psql(`select lec_private.hash('change-me-관리자키')`, { role: null });
  fails(() => psql(`select lec_private.init_training_hash('WEAK1', ${q(weakHash)})`, { role: null }), 'PT400', 'weak_key');
  psql(`select lec_private.init_training('SUPA6', '관리자키-supa-0006')`, { role: null });
  const o = { code: 'SUPA6', xff: '203.0.113.9, 10.9.9.9' };
  for (let i = 0; i < 10; i++) isErr(psql(`select public.lec_set_state('SUPA6', ${q('guess-' + i)}, ${j({ slide: 1 })})`, o), 403);
  const hits = psql(`select max(hits) from lec_private.rate where bucket = 'authfail' and key like 'af:SUPA6|%'`, { role: null });
  assert.equal(hits, 10, 'failures were committed although each call answered 403');
  fails(() => psql(`select public.lec_set_state('SUPA6', '관리자키-supa-0006', ${j({ slide: 1 })})`, o), 'PT429', 'rate_limited');
  fails(() => psql(`select public.lec_check_admin('SUPA6', '관리자키-supa-0006')`, o), 'PT429');
  // a different left-most (spoofable) entry does not help: the right-most hop is counted
  fails(() => psql(`select public.lec_admin_snapshot('SUPA6', '관리자키-supa-0006', 0)`, { code: 'SUPA6', xff: '198.51.100.1, 10.9.9.9' }), 'PT429');
  assert.equal(psql(`select public.lec_admin_snapshot('SUPA6', '관리자키-supa-0006', 0)`, { code: 'SUPA6', xff: '198.51.100.2, 10.8.8.8' }).admin, true, 'other clients are not locked');
  // ① and a forged left-most entry cannot lock someone else out (it is never counted)
  const victim = { code: 'SUPA6', xff: '10.6.6.6' };
  for (let i = 0; i < 10; i++) isErr(psql(`select public.lec_set_state('SUPA6', ${q('guess-x' + i)}, ${j({ slide: 1 })})`, { code: 'SUPA6', xff: '10.6.6.6, 10.7.7.1' }), 403);
  assert.equal(psql(`select public.lec_admin_snapshot('SUPA6', '관리자키-supa-0006', 0)`, victim).admin, true);
});

test('supabase (2026-11d): sessions survive a lockout; polls keep to options; first check-in; name later; lockJoin; flushMs', { skip }, () => {
  psql(`select lec_private.init_training('SUPAS', '관리자키-supa-000S', '{"flushMs": 2500}')`, { role: null });
  assert.equal(psql(`select flush_ms from lec_private.trainings where code = 'SUPAS'`, { role: null }), 2500);
  const o = { code: 'SUPAS', xff: '10.20.0.1' }; const K = '관리자키-supa-000S';
  isErr(psql(`select public.lec_admin_session('SUPAS', 'wrong-key-00000')`, o), 403);
  const s = psql(`select public.lec_admin_session('SUPAS', ${q(K)})`, o);
  assert.match(s.session, /^lps1\.[A-Za-z0-9_-]{43}$/); assert.ok(s.expiresAt > Date.now() + 11 * 3600e3);
  assert.equal(psql(`select count(*) from lec_private.admin_sessions where hash = ${q(s.session)}`, { role: null }), 0, 'only the hash is kept');
  for (let i = 0; i < 9; i++) isErr(psql(`select public.lec_set_state('SUPAS', ${q('guess-' + i)}, ${j({ slide: 1 })})`, o), 403);
  fails(() => psql(`select public.lec_check_admin('SUPAS', ${q(K)})`, o), 'PT429');
  assert.equal(psql(`select public.lec_admin_snapshot('SUPAS', ${q(s.session)}, 0)`, o).admin, true, 'the open console keeps working');
  assert.equal(psql(`select public.lec_set_state('SUPAS', ${q(s.session)}, ${j({ notice: { text: '공지' } })})`, o).notice.text, '공지');
  isErr(psql(`select public.lec_admin_snapshot('SUPAS', ${q('lps1.' + 'x'.repeat(43))}, 0)`, o), 401, 'session_expired');
  // ② polls: options only; registered blueprint polls by cid; unknown ids refused
  const a = psql(`select public.lec_join('SUPAS', '하나')`, o);
  const poll = psql(`select public.lec_add('SUPAS', null, 'polls', ${j({ question: '좋았나요?', options: ['예', '아니요'], open: true })}, ${q(s.session)})`, o);
  fails(() => psql(`select public.lec_add('SUPAS', ${q(a.token)}, 'answers', ${j({ poll: poll.id, value: ['예', '예', '예'] })})`, o), 'PT400', 'invalid_value');
  fails(() => psql(`select public.lec_add('SUPAS', ${q(a.token)}, 'answers', ${j({ poll: poll.id, value: '<img>' })})`, o), 'PT400', 'invalid_value');
  const ok = psql(`select public.lec_add('SUPAS', ${q(a.token)}, 'answers', ${j({ poll: poll.id, value: ['예'] })})`, o);
  assert.equal(ok.value, '예');
  fails(() => psql(`select public.lec_update('SUPAS', ${q(a.token)}, null, 'answers', ${q(ok.id)}, ${j({ value: '몰라' })})`, o), 'PT400', 'invalid_value');
  fails(() => psql(`select public.lec_add('SUPAS', ${q(a.token)}, 'answers', ${j({ poll: 'nonexistent', value: 'X' })})`, o), 'PT404', 'unknown_poll');
  const reg = psql(`select public.lec_add('SUPAS', null, 'polls', ${j({ question: '척도', kind: 'scale', options: [], open: true, cid: 'bp:sc1' })}, ${q(s.session)})`, o);
  assert.equal(psql(`select public.lec_add('SUPAS', null, 'polls', ${j({ question: '척도', kind: 'scale', options: [], open: true, cid: 'bp:sc1' })}, ${q(s.session)})`, o).id, reg.id, 'registration is idempotent');
  assert.equal(psql(`select public.lec_add('SUPAS', ${q(a.token)}, 'answers', ${j({ poll: 'sc1', value: 4 })})`, o).value, '4');
  fails(() => psql(`select public.lec_add('SUPAS', ${q(a.token)}, 'answers', ${j({ poll: 'sc1', value: '7' })})`, o), 'PT400', 'invalid_value');
  assert.ok(psql(`select public.lec_add('SUPAS', ${q(a.token)}, 'answers', ${j({ poll: 'signal', value: 'red' })})`, o).id, 'the signal light stays free');
  assert.equal(psql(`select count(*) from public.lec_polls where cid = 'bp:sc1'`, o), 1, 'cid is readable (the console hides registered polls from its quick list)');
  // ⑧ first check-in kept
  const in1 = psql(`select public.lec_add('SUPAS', ${q(a.token)}, 'attendance', ${j({ kind: 'in' })})`, o);
  spawnSync('sleep', ['0.05']);
  const in2 = psql(`select public.lec_add('SUPAS', ${q(a.token)}, 'attendance', ${j({ kind: 'in' })})`, o);
  assert.equal(in2.at, in1.at);
  // 편의 2: name·school later, with consent
  fails(() => psql(`select public.lec_update('SUPAS', ${q(a.token)}, null, 'participants', ${q(a.id)}, ${j({ name: '홍길동' })})`, o), 'PT400', 'consent_required');
  psql(`select public.lec_update('SUPAS', ${q(a.token)}, null, 'participants', ${q(a.id)}, ${j({ name: '홍길동', school: '한빛초', consent: true })})`, o);
  assert.equal(psql(`select name || '|' || school || '|' || (consent_at is not null) from public.lec_participants where id = ${q(a.id)}`, { role: null }), '홍길동|한빛초|true');
  // lockJoin, reserved names
  psql(`select public.lec_set_state('SUPAS', ${q(s.session)}, ${j({ ui: { lockJoin: true } })})`, o);
  fails(() => psql(`select public.lec_join('SUPAS', '늦게옴')`, o), 'PT409', 'locked');
  psql(`select public.lec_set_state('SUPAS', ${q(s.session)}, ${j({ ui: { lockJoin: null } })})`, o);
  for (const n of ['관리자', '선생님', '운영진', 'аdmin']) fails(() => psql(`select public.lec_join('SUPAS', ${q(n)})`, o), 'PT400', 'reserved_nickname');
  assert.ok(psql(`select public.lec_join('SUPAS', '김선생')`, o).token);
});

test('supabase (M7, H3, M8): own uploads only; hidden/removed posts make files unreadable and trashed; uploads=false', { skip }, () => {
  psql(`select lec_private.init_training('SUPA7', '관리자키-supa-0007')`, { role: null });
  const o = { code: 'SUPA7', xff: '10.7.7.7' }; const K = '관리자키-supa-0007';
  const a = psql(`select public.lec_join('SUPA7', '하나')`, o); const b = psql(`select public.lec_join('SUPA7', '둘')`, o);
  const tk = psql(`select public.lec_upload_ticket('SUPA7', ${q(a.token)}, 'a.png', 'image/png', 1000)`, o);
  psql(`insert into storage.objects (bucket_id, name, metadata) values ('lec-uploads', ${q(tk.path)}, '{"size": 1000, "mimetype": "image/png"}')`, o);
  const tkBig = psql(`select public.lec_upload_ticket('SUPA7', ${q(a.token)}, 'b.png', 'image/png', 1000)`, o);
  fails(() => psql(`insert into storage.objects (bucket_id, name, metadata) values ('lec-uploads', ${q(tkBig.path)}, '{"size": 99999999, "mimetype": "image/png"}')`, o), '42501');
  fails(() => psql(`insert into storage.objects (bucket_id, name, metadata) values ('lec-uploads', ${q(tkBig.path)}, '{"size": 10, "mimetype": "text/html"}')`, o), '42501');
  const file = (x) => ({ ...x, name: 'a.png', type: 'image/png', size: 1000 });
  fails(() => psql(`select public.lec_add('SUPA7', ${q(b.token)}, 'posts', ${j({ text: '남의 파일', files: [file({ path: tk.path })] })})`, o), 'PT400');
  fails(() => psql(`select public.lec_add('SUPA7', ${q(a.token)}, 'posts', ${j({ text: 'x', files: [file({ url: 'https://evil.example/storage/v1/object/public/lec-uploads/SUPA7/' + 'a'.repeat(32) + '.png' })] })})`, o), 'PT400');
  const post = psql(`select public.lec_add('SUPA7', ${q(a.token)}, 'posts', ${j({ text: '사진', files: [file({ url: 'https://x.supabase.co/storage/v1/object/public/lec-uploads/' + tk.path })] })})`, o);
  assert.equal(post.files[0].path, tk.path); assert.equal(post.files[0].url, '', 'no stored URL: clients sign the path');
  fails(() => psql(`select public.lec_add('SUPA7', ${q(a.token)}, 'posts', ${j({ text: '또', files: [file({ path: tk.path })] })})`, o), 'PT400');
  const readable = () => psql(`select count(*) from storage.objects where name = ${q(tk.path)}`, o);
  assert.equal(readable(), 1, 'visible post → signable');
  psql(`select public.lec_update('SUPA7', null, ${q(K)}, 'posts', ${q(post.id)}, ${j({ hidden: true })})`, o);
  assert.equal(readable(), 0, 'hidden post → unreadable at once');
  psql(`select public.lec_update('SUPA7', null, ${q(K)}, 'posts', ${q(post.id)}, ${j({ hidden: false })})`, o);
  assert.equal(readable(), 1);
  psql(`select public.lec_remove('SUPA7', ${q(K)}, 'posts', ${q(post.id)})`, o);
  assert.deepEqual(psql(`select public.lec_trash('SUPA7', ${q(K)})`, o).paths, [tk.path], 'the console is told to delete it');
  assert.deepEqual(psql(`select public.lec_trash('SUPA7')`, o).paths, [], 'without the key: only trash of deleted trainings');
  assert.equal(psql(`with d as (delete from storage.objects where name = ${q(tk.path)} returning 1) select count(*) from d`, o), 1);
  assert.deepEqual(psql(`select public.lec_trash('SUPA7', ${q(K)})`, o).paths, [], 'deleted objects leave the trash');
  // M8: instructor switches uploads off / moderation on (state.ui, admin only)
  psql(`select public.lec_set_state('SUPA7', ${q(K)}, ${j({ ui: { uploads: false, moderation: true } })})`, o);
  fails(() => psql(`select public.lec_upload_ticket('SUPA7', ${q(a.token)}, 'c.png', 'image/png', 10)`, o), 'PT503', 'uploads_disabled');
  fails(() => psql(`select public.lec_add('SUPA7', ${q(a.token)}, 'posts', ${j({ text: 'x', files: [file({ path: tkBig.path })] })})`, o), 'PT403', 'uploads_disabled');
  const held = psql(`select public.lec_add('SUPA7', ${q(a.token)}, 'posts', ${j({ text: '확인 뒤에' })})`, o);
  assert.equal(held.hidden, true);
  assert.equal(psql(`select text from public.lec_posts where id = ${q(held.id)}`, o), '', 'held content is not readable through the API');
});

test('supabase (L1, L3, nicknames, L12): closed polls, no `by` for the public, reserved names, cheap flush', { skip }, () => {
  psql(`select lec_private.init_training('SUPA8', '관리자키-supa-0008')`, { role: null });
  const o = { code: 'SUPA8', xff: '10.8.0.1' }; const K = '관리자키-supa-0008';
  for (const n of ['강사', ' 운영자 ', 'Admin', 'lecpage님']) fails(() => psql(`select public.lec_join('SUPA8', ${q(n)})`, o), 'PT400', 'reserved_nickname');
  const a = psql(`select public.lec_join('SUPA8', '김강사')`, o);
  fails(() => psql(`select public.lec_update('SUPA8', ${q(a.token)}, null, 'participants', ${q(a.id)}, ${j({ nickname: '강사' })})`, o), 'PT400', 'reserved_nickname');
  const poll = psql(`select public.lec_add('SUPA8', null, 'polls', ${j({ question: '좋았나요?', options: ['예', '아니요'], open: true })}, ${q(K)})`, o);
  const ans = psql(`select public.lec_add('SUPA8', ${q(a.token)}, 'answers', ${j({ poll: poll.id, value: '예' })})`, o);
  psql(`select public.lec_add('SUPA8', ${q(a.token)}, 'progress', ${j({ station: 's1', status: 'stuck' })})`, o);
  psql(`select public.lec_add('SUPA8', ${q(a.token)}, 'help', ${j({ message: '도와주세요' })})`, o);
  psql(`select public.lec_update('SUPA8', null, ${q(K)}, 'polls', ${q(poll.id)}, ${j({ open: false })})`, o);
  fails(() => psql(`select public.lec_update('SUPA8', ${q(a.token)}, null, 'answers', ${q(ans.id)}, ${j({ value: '아니요' })})`, o), 'PT409', 'poll_closed');
  const snap = psql(`select public.lec_snapshot('SUPA8', 0)`, o);
  for (const col of ['answers', 'progress', 'help']) assert.ok(snap[col].length && snap[col].every((d) => d.by === undefined), col);
  for (const t of ['lec_answers', 'lec_progress', 'lec_help']) fails(() => psql(`select by from public.${t}`, o), '42501');
  const mine = psql(`select public.lec_mine('SUPA8', ${q(a.token)})`, o);
  assert.equal(mine.answers[0].by, a.id); assert.equal(mine.progress[0].by, a.id); assert.equal(mine.help[0].by, a.id);
  // L12: nothing pending → no lock taken, nothing sent; snapshots past the cursor skip the aggregates
  spawnSync('sleep', ['2.1']); psql(`select public.lec_flush('SUPA8')`, o);
  const before = sent('lec:SUPA8').length;
  assert.deepEqual(psql(`select public.lec_flush('SUPA8')`, o), { _flush: 0 });
  assert.equal(sent('lec:SUPA8').length, before);
  const probe = psql(`select public.lec_snapshot('SUPA8', 9007199254740991)`, o);
  assert.deepEqual(probe.answers, []); assert.ok(probe.state);
});

test('supabase (2026-11c): instructor locks refuse new questions/posts; invisible characters and stacked marks are removed', { skip }, () => {
  psql(`select lec_private.init_training('SUPA9', '관리자키-supa-0009')`, { role: null });
  const o = { code: 'SUPA9', xff: '10.9.0.1' }; const K = '관리자키-supa-0009';
  const a = psql(`select public.lec_join('SUPA9', '하나')`, o);
  const inv = String.fromCharCode(0x202e, 0x200b, 0x2066, 0x3164, 0xad);
  const zal = 'Z' + String.fromCharCode(0x301, 0x302, 0x303, 0x304, 0x305, 0x306);
  const q1 = psql(`select public.lec_add('SUPA9', ${q(a.token)}, 'questions', ${j({ text: `가${inv}나 ${zal}` })})`, o);
  assert.equal(q1.text, '가나 ' + 'Ź' + String.fromCharCode(0x302, 0x303));
  fails(() => psql(`select public.lec_join('SUPA9', ${q('강' + String.fromCharCode(0x3164) + '사')})`, o), 'PT400', 'reserved_nickname');
  psql(`select public.lec_set_state('SUPA9', ${q(K)}, ${j({ ui: { lockQa: true, lockBoard: true } })})`, o);
  fails(() => psql(`select public.lec_add('SUPA9', ${q(a.token)}, 'questions', ${j({ text: '잠긴 뒤' })})`, o), 'PT409', 'locked');
  fails(() => psql(`select public.lec_add('SUPA9', ${q(a.token)}, 'posts', ${j({ text: '잠긴 뒤' })})`, o), 'PT409', 'locked');
  psql(`select public.lec_set_state('SUPA9', ${q(K)}, ${j({ ui: { lockQa: null, lockBoard: null } })})`, o);
  assert.ok(psql(`select public.lec_add('SUPA9', ${q(a.token)}, 'questions', ${j({ text: '다시 열림' })})`, o).id);
});
