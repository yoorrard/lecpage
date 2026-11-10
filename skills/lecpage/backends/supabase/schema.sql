-- ============================================================================
-- lecpage live — Supabase schema (protocol v1 semantics, docs/architecture.md §5)
-- Run once in the Supabase SQL Editor (safe to re-run: it upgrades functions in place).
--
-- Design (why it looks like this)
--  * No Supabase Auth. Anonymous sign-in is rate limited per IP (a whole school behind one NAT would be
--    blocked), so participants get a random secret token from lec_join(). The database keeps only its SHA-256.
--  * Writes only through SECURITY DEFINER RPC functions (search_path = '') that check the participant token
--    or the admin key hash, validate every field and rate-limit per participant per minute.
--  * Reads: RLS SELECT policies scoped by the training code that the client sends in the `x-lec-code`
--    request header (PostgREST exposes it as request.headers). Knowing the code = being in the room.
--    Column grants hide owner ids of questions; hidden content is moved to a private table.
--  * Realtime: public Broadcast channel `lec:<CODE>` (and `lec:<CODE>:adm` for the console) carries only
--    small throttled "tick" messages {rev, rx}; clients then fetch rows with rev > cursor through RLS and the
--    latest reaction batch through lec_reactions(). Ticks are sent at most every flush_ms (default 2000 ms) per
--    channel, so 200 listeners stay under the Free plan's 100 messages/second. Payloads are only hints: anyone
--    with the publishable key can send to a public channel. (Private channels need Supabase Auth sessions, which
--    this design avoids; clients therefore throttle resyncs and never render counts from a payload.)
--  * Uploads: PRIVATE Storage bucket `lec-uploads` (20 MB, images/pdf/mp3/mp4). Insert only for a path handed out
--    by lec_upload_ticket(); read (signed URLs, 1 h) only while a visible post uses the file. Removed, purged and
--    expired files go to lec_private.file_trash; the instructor console deletes them from Storage.
--  * Admin keys: at least 12 characters, no example values. Wrong keys are counted per (code, IP) and per IP; a
--    wrong key returns its error without raising (PostgREST response.status), so the count survives.
-- ============================================================================

create schema if not exists lec_private;
revoke all on schema lec_private from public;
grant usage on schema lec_private to anon, authenticated, service_role;

-- ---------------------------------------------------------------- private tables
create table if not exists lec_private.config (
  key text primary key,
  value text not null
);

create table if not exists lec_private.trainings (
  code text primary key check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
  admin_hash text not null check (admin_hash ~ '^[0-9a-f]{64}$'),
  settings jsonb not null default '{}'::jsonb,
  retention_days int not null default 30 check (retention_days between 1 and 365),
  flush_ms int not null default 2000 check (flush_ms between 500 and 10000),
  rev bigint not null default 0,          -- bumped by every write (serialises writers per training)
  pub_rev bigint not null default 0,      -- last rev that touched a public collection or the state
  pub_tick_rev bigint not null default 0,
  pub_tick_at timestamptz not null default 'epoch',
  adm_tick_rev bigint not null default 0,
  adm_tick_at timestamptz not null default 'epoch',
  purge_until timestamptz,                -- storage delete window after an admin purge
  created_at timestamptz not null default now(),
  last_at timestamptz not null default now()
);
create index if not exists lec_trainings_last_at on lec_private.trainings (last_at);

create table if not exists lec_private.votes (
  training_code text not null references lec_private.trainings (code) on delete cascade,
  col text not null check (col in ('questions', 'posts')),
  doc uuid not null,
  by uuid not null,
  primary key (col, doc, by)
);
create index if not exists lec_votes_training on lec_private.votes (training_code);

create table if not exists lec_private.hidden (
  col text not null,
  id uuid primary key,
  training_code text not null references lec_private.trainings (code) on delete cascade,
  text text,
  files jsonb
);
create index if not exists lec_hidden_training on lec_private.hidden (training_code);

create table if not exists lec_private.reactions (
  training_code text not null references lec_private.trainings (code) on delete cascade,
  emoji text not null,
  n int not null default 0,
  primary key (training_code, emoji)
);

create table if not exists lec_private.rate (
  key text not null,
  bucket text not null,
  win timestamptz not null,
  hits int not null,
  primary key (key, bucket)
);
create index if not exists lec_rate_win on lec_private.rate (win);

create table if not exists lec_private.upload_tickets (
  path text primary key,
  training_code text not null references lec_private.trainings (code) on delete cascade,
  by uuid not null,
  expires_at timestamptz not null
);
create index if not exists lec_tickets_training on lec_private.upload_tickets (training_code);
alter table lec_private.upload_tickets add column if not exists post uuid;      -- set when a post uses the file
alter table lec_private.upload_tickets add column if not exists mime text;      -- declared type (checked again by Storage)
alter table lec_private.upload_tickets add column if not exists max_bytes bigint;
alter table lec_private.trainings add column if not exists react_seq bigint not null default 0;
alter table lec_private.trainings add column if not exists react_last jsonb not null default '{}'::jsonb;

-- Storage paths to delete (removed posts, purged or expired trainings, uploads never attached). Not tied to the
-- training row: the entries must outlive it. The console deletes these objects through the Storage API.
create table if not exists lec_private.file_trash (
  path text primary key,
  training_code text not null,
  queued_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- collection tables (public schema, RLS on)
create table if not exists public.lec_participants (
  id uuid primary key default gen_random_uuid(),
  training_code text not null references lec_private.trainings (code) on delete cascade,
  token_hash text not null unique,
  nickname text not null default '',
  name text not null default '',
  school text not null default '',
  consent_at timestamptz,
  rev bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lec_participants_rev on public.lec_participants (training_code, rev);

create table if not exists public.lec_attendance (
  id uuid primary key default gen_random_uuid(),
  training_code text not null references lec_private.trainings (code) on delete cascade,
  by uuid not null,
  kind text not null check (kind in ('in', 'out')),
  at timestamptz not null default now(),
  cid text,
  rev bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (training_code, by, kind)
);
create index if not exists lec_attendance_rev on public.lec_attendance (training_code, rev);

create table if not exists public.lec_progress (
  id uuid primary key default gen_random_uuid(),
  training_code text not null references lec_private.trainings (code) on delete cascade,
  by uuid not null,
  station text not null,
  status text not null check (status in ('doing', 'done', 'stuck')),
  at timestamptz not null default now(),
  cid text,
  rev bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (training_code, by, station)
);
create index if not exists lec_progress_rev on public.lec_progress (training_code, rev);

create table if not exists public.lec_help (
  id uuid primary key default gen_random_uuid(),
  training_code text not null references lec_private.trainings (code) on delete cascade,
  by uuid not null,
  nickname text not null default '',
  station text not null default '',
  seat text not null default '',
  message text not null default '',
  status text not null default 'open' check (status in ('open', 'claimed', 'done')),
  assignee text not null default '',
  cid text,
  rev bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lec_help_rev on public.lec_help (training_code, rev);
create unique index if not exists lec_help_cid on public.lec_help (training_code, by, cid) where cid is not null;

create table if not exists public.lec_questions (
  id uuid primary key default gen_random_uuid(),
  training_code text not null references lec_private.trainings (code) on delete cascade,
  by uuid not null,                       -- never granted to anon: questions stay anonymous
  text text not null default '',
  nickname text not null default '',
  anonymous boolean not null default true,
  votes int not null default 0,
  status text not null default 'open' check (status in ('open', 'answered', 'hidden')),
  pinned boolean not null default false,
  cid text,
  rev bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lec_questions_rev on public.lec_questions (training_code, rev);
create unique index if not exists lec_questions_cid on public.lec_questions (training_code, by, cid) where cid is not null;

create table if not exists public.lec_posts (
  id uuid primary key default gen_random_uuid(),
  training_code text not null references lec_private.trainings (code) on delete cascade,
  by uuid not null,
  kind text not null default 'post',
  text text not null default '',
  nickname text not null default '',
  files jsonb not null default '[]'::jsonb,
  license text not null default '',
  likes int not null default 0,
  hidden boolean not null default false,
  cid text,
  rev bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lec_posts_rev on public.lec_posts (training_code, rev);
create unique index if not exists lec_posts_cid on public.lec_posts (training_code, by, cid) where cid is not null;

create table if not exists public.lec_polls (
  id uuid primary key default gen_random_uuid(),
  training_code text not null references lec_private.trainings (code) on delete cascade,
  question text not null,
  kind text not null default 'choice' check (kind in ('choice', 'word', 'scale')),
  options jsonb not null default '[]'::jsonb,
  open boolean not null default false,
  cid text,
  rev bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lec_polls_rev on public.lec_polls (training_code, rev);

create table if not exists public.lec_answers (
  id uuid primary key default gen_random_uuid(),
  training_code text not null references lec_private.trainings (code) on delete cascade,
  poll text not null,
  by uuid not null,
  value jsonb not null,
  cid text,
  rev bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (training_code, poll, by)
);
create index if not exists lec_answers_rev on public.lec_answers (training_code, rev);

create table if not exists public.lec_survey (
  id uuid primary key default gen_random_uuid(),
  training_code text not null references lec_private.trainings (code) on delete cascade,
  by uuid not null,
  answers jsonb not null default '{}'::jsonb,
  cid text,
  rev bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (training_code, by)
);
create index if not exists lec_survey_rev on public.lec_survey (training_code, rev);

create table if not exists public.lec_chat (
  id uuid primary key default gen_random_uuid(),
  training_code text not null references lec_private.trainings (code) on delete cascade,
  by uuid not null,
  nickname text not null default '',
  text text not null default '',
  hidden boolean not null default false,
  cid text,
  rev bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lec_chat_rev on public.lec_chat (training_code, rev);
create unique index if not exists lec_chat_cid on public.lec_chat (training_code, by, cid) where cid is not null;

create table if not exists public.lec_state (
  training_code text primary key references lec_private.trainings (code) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  rev bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.lec_tombstones (
  training_code text not null references lec_private.trainings (code) on delete cascade,
  col text not null,
  id uuid not null,
  rev bigint not null,
  primary key (training_code, col, id)
);
create index if not exists lec_tombstones_rev on public.lec_tombstones (training_code, rev);

-- ---------------------------------------------------------------- helpers (lec_private, not exposed by the API)
create or replace function lec_private.fail(p_status int, p_code text, p_msg text)
returns void language plpgsql set search_path = '' as $$
begin
  -- PostgREST maps SQLSTATE PTxyz to HTTP status xyz. message = machine code, hint = Korean text.
  raise exception using errcode = 'PT' || p_status::text, message = p_code, hint = p_msg;
end $$;

create or replace function lec_private.ms(t timestamptz)
returns bigint language sql immutable parallel safe set search_path = '' as $$
  select (extract(epoch from t) * 1000)::bigint
$$;

create or replace function lec_private.req_code()
returns text language sql stable set search_path = '' as $$
  select upper(nullif(coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json ->> 'x-lec-code', ''))
$$;

-- Client IP for soft per-IP limits: the right-most X-Forwarded-For entry (added by the proxy in front of the API;
-- the left-most one is whatever the client wrote). Admin-key throttling also counts the left-most entry.
create or replace function lec_private.req_ip()
returns text language sql stable set search_path = '' as $$
  select nullif(btrim(reverse(split_part(reverse(coalesce(coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json ->> 'x-forwarded-for', '')), ',', 1))), '')
$$;
create or replace function lec_private.req_ip_first()
returns text language sql stable set search_path = '' as $$
  select nullif(btrim(split_part(coalesce(coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json ->> 'x-forwarded-for', ''), ',', 1)), '')
$$;

create or replace function lec_private.code(p text)
returns text language plpgsql immutable set search_path = '' as $$
declare c text := upper(btrim(coalesce(p, '')));
begin
  if c !~ '^[A-Z0-9][A-Z0-9_-]{2,39}$' then perform lec_private.fail(400, 'bad_code', '연수 코드는 영문·숫자 3~40자입니다.'); end if;
  return c;
end $$;

create or replace function lec_private.hash(p text)
returns text language sql immutable set search_path = '' as $$
  select encode(pg_catalog.sha256(convert_to(coalesce(p, ''), 'UTF8')), 'hex')
$$;

create or replace function lec_private.to_uuid(p text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  if p is null or p !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    perform lec_private.fail(404, 'not_found', '없는 글입니다.');
  end if;
  return p::uuid;
end $$;

-- text cleanup: CR/LF normalisation, NFC, control/zero-width/bidi characters removed, trimmed, length checked
create or replace function lec_private.txt(v text, maxlen int, field text, required boolean default false, multiline boolean default false)
returns text language plpgsql immutable set search_path = '' as $$
declare s text := coalesce(v, '');
begin
  s := replace(replace(s, E'\r\n', E'\n'), E'\r', E'\n');
  s := normalize(s, NFC);
  if multiline then
    s := regexp_replace(s, '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F​‌‎‏‪-‮⁦-⁩﻿]', '', 'g');
    s := regexp_replace(s, E'\n{4,}', E'\n\n\n', 'g');
  else
    s := regexp_replace(s, '[\x01-\x1F\x7F​‌‎‏‪-‮⁦-⁩﻿]', ' ', 'g');
    s := regexp_replace(s, '\s{2,}', ' ', 'g');
  end if;
  s := btrim(s, E' \n\t');
  if required and s = '' then perform lec_private.fail(400, 'required', field || ': 비어 있습니다.'); end if;
  if char_length(s) > maxlen then perform lec_private.fail(400, 'too_long', field || ': ' || maxlen || '자 이하로 써 주세요.'); end if;
  return s;
end $$;

create or replace function lec_private.jtxt(p jsonb, k text, maxlen int, required boolean default false, multiline boolean default false)
returns text language plpgsql immutable set search_path = '' as $$
declare t text := jsonb_typeof(p -> k);
begin
  if t is null or t = 'null' then return lec_private.txt('', maxlen, k, required, multiline); end if;
  if t not in ('string', 'number') then perform lec_private.fail(400, 'invalid_type', k || ': 글자여야 합니다.'); end if;
  return lec_private.txt(p ->> k, maxlen, k, required, multiline);
end $$;

create or replace function lec_private.jbool(p jsonb, k text, dflt boolean)
returns boolean language plpgsql immutable set search_path = '' as $$
declare t text := jsonb_typeof(p -> k);
begin
  if t is null or t = 'null' then return dflt; end if;
  if t <> 'boolean' then perform lec_private.fail(400, 'invalid_type', k || ': true/false'); end if;
  return (p ->> k)::boolean;
end $$;

create or replace function lec_private.jenum(p jsonb, k text, allowed text[], dflt text default null)
returns text language plpgsql immutable set search_path = '' as $$
declare v text := p ->> k;
begin
  if v is null or v = '' then
    if dflt is not null then return dflt; end if;
    perform lec_private.fail(400, 'required', k || ': 비어 있습니다.');
  end if;
  if jsonb_typeof(p -> k) <> 'string' or not (v = any (allowed)) then perform lec_private.fail(400, 'invalid_value', k || ': ' || array_to_string(allowed, '|')); end if;
  return v;
end $$;

create or replace function lec_private.training(p_code text)
returns lec_private.trainings language plpgsql stable set search_path = '' as $$
declare t lec_private.trainings;
begin
  select * into t from lec_private.trainings where code = p_code;
  if not found then perform lec_private.fail(404, 'unknown_training', '아직 준비되지 않은 연수 코드입니다.'); end if;
  return t;
end $$;

create or replace function lec_private.cur_rev(p_code text)
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce((select rev from lec_private.trainings where code = p_code), 0)
$$;

create or replace function lec_private.is_admin(t lec_private.trainings, p_key text)
returns boolean language sql stable set search_path = '' as $$
  -- Compares SHA-256 digests (fixed length); the stored value is only ever the hash of the key.
  select p_key is not null and char_length(p_key) between 1 and 200 and lec_private.hash(p_key) = t.admin_hash
$$;

create or replace function lec_private.require_admin(p_code text, p_key text)
returns lec_private.trainings language plpgsql stable set search_path = '' as $$
declare t lec_private.trainings := lec_private.training(p_code);
begin
  if not lec_private.is_admin(t, p_key) then
    perform lec_private.fail(case when p_key is null or p_key = '' then 401 else 403 end, 'admin_required', '관리자 키가 필요합니다.');
  end if;
  return t;
end $$;

create or replace function lec_private.participant(p_code text, p_token text)
returns public.lec_participants language plpgsql stable set search_path = '' as $$
declare p public.lec_participants;
begin
  if p_token is null or char_length(p_token) > 200 then perform lec_private.fail(401, 'invalid_token', '참여 정보가 없어요. 다시 참여해 주세요.'); end if;
  select * into p from public.lec_participants where token_hash = lec_private.hash(p_token) and training_code = p_code;
  if not found then perform lec_private.fail(401, 'invalid_token', '참여 정보가 없어요. 다시 참여해 주세요.'); end if;
  return p;
end $$;

-- fixed one-minute window counter; per participant token (NAT friendly), plus soft per-IP for joins
create or replace function lec_private.hit(p_key text, p_bucket text, p_max int)
returns void language plpgsql set search_path = '' as $$
declare v int; w timestamptz := date_trunc('minute', now());
begin
  insert into lec_private.rate as r (key, bucket, win, hits) values (p_key, p_bucket, w, 1)
  on conflict (key, bucket) do update set hits = case when r.win = excluded.win then r.hits + 1 else 1 end, win = excluded.win
  returning hits into v;
  if v > p_max then perform lec_private.fail(429, 'rate_limited', '잠시 후 다시 시도해 주세요.'); end if;
end $$;

-- fixed windows of p_secs seconds (admin-key failures: 600 s)
create or replace function lec_private.win_start(p_secs int)
returns timestamptz language sql stable set search_path = '' as $$
  select to_timestamp(floor(extract(epoch from now()) / p_secs) * p_secs)
$$;
create or replace function lec_private.count_win(p_key text, p_bucket text, p_secs int)
returns void language plpgsql set search_path = '' as $$
declare w timestamptz := lec_private.win_start(p_secs);
begin
  insert into lec_private.rate as r (key, bucket, win, hits) values (p_key, p_bucket, w, 1)
  on conflict (key, bucket) do update set hits = case when r.win = excluded.win then r.hits + 1 else 1 end, win = excluded.win;
end $$;
create or replace function lec_private.full_win(p_key text, p_bucket text, p_max int, p_secs int)
returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from lec_private.rate r where r.key = p_key and r.bucket = p_bucket and r.win = lec_private.win_start(p_secs) and r.hits >= p_max)
$$;

-- An error answer that does NOT raise: PostgREST sends `response.status` with this body, and the transaction commits
-- (so a failure counter written just before survives). supabase-js reads it as { code, message, hint }.
create or replace function lec_private.err(p_status int, p_code text, p_msg text)
returns jsonb language plpgsql set search_path = '' as $$
begin
  perform set_config('response.status', p_status::text, true);
  return jsonb_build_object('code', 'PT' || p_status::text, 'message', p_code, 'hint', p_msg, 'details', null);
end $$;

/* H4: admin key check for every admin RPC. null = ok; otherwise the error body to return.
   Wrong keys are counted per (code, IP) — both ends of X-Forwarded-For — and per IP, in 10-minute windows.
   While a counter is full every admin call answers 429, the right key too (no oracle). */
create or replace function lec_private.admin_check(p_code text, p_key text)
returns jsonb language plpgsql set search_path = '' as $$
declare
  t lec_private.trainings; a text := coalesce(lec_private.req_ip(), '?'); b text := coalesce(lec_private.req_ip_first(), '?');
begin
  if lec_private.full_win('af:' || p_code || '|' || a, 'authfail', 10, 600) or lec_private.full_win('af:' || p_code || '|' || b, 'authfail', 10, 600)
     or lec_private.full_win('afip:' || b, 'authfail', 20, 600) then
    perform lec_private.fail(429, 'rate_limited', '관리자 키가 여러 번 틀려 잠시 막았어요. 몇 분 뒤에 다시 해 주세요.');
  end if;
  t := lec_private.training(p_code);
  if lec_private.is_admin(t, p_key) then return null; end if;
  if p_key is null or p_key = '' then return lec_private.err(401, 'admin_required', '관리자 키가 필요합니다.'); end if;
  perform lec_private.count_win('af:' || p_code || '|' || a, 'authfail', 600);
  if b <> a then perform lec_private.count_win('af:' || p_code || '|' || b, 'authfail', 600); end if;
  perform lec_private.count_win('afip:' || b, 'authfail', 600);
  return lec_private.err(403, 'admin_required', '관리자 키가 필요합니다.');
end $$;

-- Example keys from our own docs and templates (never accepted as admin keys or setup tokens).
create or replace function lec_private.weak_keys()
returns text[] language sql immutable set search_path = '' as $$
  select array['change-me', 'changeme', 'change-me-관리자키', 'change-me-admin-key', '관리자키', '관리자 키', '연수관리자키', '내관리자키',
               '관리자키-8자-이상', '여기에-관리자-키-8자-이상', '여기에-관리자-키-12자-이상', 'admin', 'administrator', 'password', 'password1',
               'password123', 'passw0rd', 'qwerty', 'qwerty123', '12345678', '123456789', '1234567890', '123456789012', 'lecpage',
               'lecpage-admin', 'correct-horse-battery', 'secret', 'letmein']
$$;
create or replace function lec_private.key_problem(p_key text)
returns text language plpgsql immutable set search_path = '' as $$
declare k text := lower(btrim(normalize(coalesce(p_key, ''), NFC)));
begin
  if char_length(k) < 12 then return '관리자 키는 12자 이상이어야 합니다.'; end if;
  if k = any (lec_private.weak_keys()) or k ~ '^change-?me' then return '예시로 쓰인 관리자 키는 쓸 수 없습니다. 새로 만들어 주세요.'; end if;
  if (select count(distinct c) from regexp_split_to_table(k, '') c) < 4 then return '같은 글자가 반복된 키는 쓸 수 없습니다.'; end if;
  return null;
end $$;
create or replace function lec_private.weak_hash(p_hash text)
returns boolean language sql immutable set search_path = '' as $$
  select exists (select 1 from unnest(lec_private.weak_keys()) k
                  where lec_private.hash(k) = lower(p_hash) or lec_private.hash(upper(k)) = lower(p_hash) or lec_private.hash(initcap(k)) = lower(p_hash))
$$;

-- participant nicknames that would impersonate the instructor or the service
create or replace function lec_private.reserved_nick(p text)
returns boolean language sql immutable set search_path = '' as $$
  select regexp_replace(lower(normalize(coalesce(p, ''), NFKC)), '[[:space:]._·*~!?()\[\]{}''"`:;,/\\|-]+', '', 'g')
         = any (array['강사', '강사님', '운영자', '운영자님', 'admin', 'admin님', 'administrator', 'lecpage', 'lecpage님'])
$$;

-- board files allowed? init settings.uploads and the instructor's state.ui.uploads (admin only), both default on
create or replace function lec_private.uploads_on(t lec_private.trainings)
returns boolean language sql stable set search_path = '' as $$
  select coalesce(t.settings ->> 'uploads', '') <> 'false'
     and coalesce((select s.data -> 'ui' ->> 'uploads' from public.lec_state s where s.training_code = t.code), '') <> 'false'
$$;
create or replace function lec_private.moderated(t lec_private.trainings)
returns boolean language sql stable set search_path = '' as $$
  select coalesce(t.settings ->> 'moderation', '') = 'true'
      or coalesce((select s.data -> 'ui' ->> 'moderation' from public.lec_state s where s.training_code = t.code), '') = 'true'
$$;
-- '<CODE>/<32hex>.<ext>' from a file entry: its `path`, or an old public/signed URL of this bucket
create or replace function lec_private.file_path(f jsonb, p_code text)
returns text language plpgsql immutable set search_path = '' as $$
declare v text;
begin
  if jsonb_typeof(f) is distinct from 'object' then return null; end if;
  v := coalesce(nullif(f ->> 'path', ''), substring(coalesce(f ->> 'url', '') from '/storage/v1/object/(?:public|sign|authenticated)/lec-uploads/([^?#]+)'));
  if v is null or v !~ ('^' || p_code || '/[0-9a-f]{32}\.(png|jpg|gif|webp|pdf|mp3|mp4)$') then return null; end if;
  return v;
end $$;

-- every write takes the training row lock here, so revisions are assigned in commit order (no gaps for readers)
create or replace function lec_private.bump(p_code text, p_public boolean)
returns bigint language plpgsql set search_path = '' as $$
declare v bigint;
begin
  update lec_private.trainings
     set rev = rev + 1, pub_rev = case when p_public then rev + 1 else pub_rev end, last_at = now()
   where code = p_code
  returning rev into v;
  if v is null then perform lec_private.fail(404, 'unknown_training', '아직 준비되지 않은 연수 코드입니다.'); end if;
  return v;
end $$;

create or replace function lec_private.send(p_payload jsonb, p_event text, p_topic text)
returns void language plpgsql set search_path = '' as $$
begin
  perform realtime.send(p_payload, p_event, p_topic, false);  -- public channel
exception when others then
  -- Realtime missing (plain Postgres) or today's realtime.messages partition not created yet: clients still poll.
  raise log 'lecpage realtime.send skipped: %', sqlerrm;
end $$;

/* Throttled change notification ("tick"). Returns ms until a pending tick may be sent (0 = nothing pending).
   The client that wrote calls lec_flush() after that delay, so the last change is never stuck.
   Reactions are flushed as a numbered batch (rx) that clients read with lec_reactions(); `r` stays in the payload
   only for older clients. p_skip: give up instead of waiting when another transaction holds the row (lec_flush). */
drop function if exists lec_private.poke(text, boolean);
create or replace function lec_private.poke(p_code text, p_fast boolean default false, p_skip boolean default false)
returns int language plpgsql set search_path = '' as $$
declare
  t lec_private.trainings; v_now timestamptz := clock_timestamp(); v_wait int := 0; v_r jsonb; v_rx bigint;
  v_gap double precision; v_min double precision; v_adm_min double precision;
begin
  if p_skip then select * into t from lec_private.trainings where code = p_code for update skip locked;
  else select * into t from lec_private.trainings where code = p_code for update; end if;
  if not found then return 0; end if;
  select coalesce(jsonb_object_agg(emoji, n), '{}'::jsonb) into v_r from lec_private.reactions where training_code = p_code and n > 0;
  v_min := case when p_fast then 0.3 else t.flush_ms / 1000.0 end;
  if t.pub_rev > t.pub_tick_rev or v_r <> '{}'::jsonb then
    v_gap := extract(epoch from v_now - t.pub_tick_at);
    if v_gap >= v_min then
      v_rx := t.react_seq + case when v_r <> '{}'::jsonb then 1 else 0 end;
      perform lec_private.send(jsonb_build_object('rev', t.pub_rev, 'rx', v_rx) || case when v_r <> '{}'::jsonb then jsonb_build_object('r', v_r) else '{}'::jsonb end, 'tick', 'lec:' || p_code);
      delete from lec_private.reactions where training_code = p_code;
      update lec_private.trainings set pub_tick_rev = t.pub_rev, pub_tick_at = v_now,
             react_seq = v_rx, react_last = case when v_r <> '{}'::jsonb then v_r else react_last end where code = p_code;
    else
      v_wait := greatest(v_wait, ceil((v_min - v_gap) * 1000)::int);
    end if;
  end if;
  v_adm_min := least(1.0, t.flush_ms / 1000.0);
  if t.rev > t.adm_tick_rev then
    v_gap := extract(epoch from v_now - t.adm_tick_at);
    if v_gap >= v_adm_min then
      perform lec_private.send(jsonb_build_object('rev', t.rev), 'tick', 'lec:' || p_code || ':adm');
      update lec_private.trainings set adm_tick_rev = t.rev, adm_tick_at = v_now where code = p_code;
    else
      v_wait := greatest(v_wait, ceil((v_adm_min - v_gap) * 1000)::int);
    end if;
  end if;
  return v_wait;
end $$;

-- row json → protocol doc (camelCase times in ms, server-only columns dropped)
create or replace function lec_private.out(p_col text, j jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare o jsonb := ((j - 'training_code') - 'rev') - 'token_hash';
begin
  o := ((o - 'created_at') - 'updated_at') || jsonb_build_object('createdAt', lec_private.ms((j ->> 'created_at')::timestamptz), 'updatedAt', lec_private.ms((j ->> 'updated_at')::timestamptz));
  if j ? 'consent_at' then
    o := (o - 'consent_at') || jsonb_build_object('consentAt', case when j ->> 'consent_at' is null then null else lec_private.ms((j ->> 'consent_at')::timestamptz) end);
  end if;
  if j ->> 'at' is not null then o := jsonb_set(o, '{at}', to_jsonb(lec_private.ms((j ->> 'at')::timestamptz))); end if;
  if p_col in ('questions', 'participants') then o := o - 'by'; end if;
  return o;
end $$;

create or replace function lec_private.state_json(p_code text)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('step', null, 'slide', 0, 'follow', false, 'timer', null, 'notice', null, 'openPoll', null, 'ui', '{}'::jsonb, 'updatedAt', 0)
         || coalesce((select s.data || jsonb_build_object('updatedAt', lec_private.ms(s.updated_at)) from public.lec_state s where s.training_code = p_code), '{}'::jsonb)
$$;

/* M7: a post may only carry this training's own uploads, by the same participant: a fresh upload ticket of theirs
   (not used by another post) or a file the post already has. Stored as { path, url:'', name, type, size };
   clients get a short-lived signed URL for `path`. Never an outside URL (no tracking pixels, no hotlinking). */
drop function if exists lec_private.clean_files(jsonb);
create or replace function lec_private.clean_files(v jsonb, p_code text, p_by uuid, p_post uuid)
returns jsonb language plpgsql stable set search_path = '' as $$
declare f jsonb; o jsonb := '[]'::jsonb; ty text; v_path text; v_mime text; seen text[] := '{}';
begin
  if v is null or jsonb_typeof(v) = 'null' then return o; end if;
  if jsonb_typeof(v) <> 'array' then perform lec_private.fail(400, 'invalid_type', 'files: 배열'); end if;
  if jsonb_array_length(v) > 5 then perform lec_private.fail(400, 'too_many', 'files: 5개까지'); end if;
  for f in select * from jsonb_array_elements(v) loop
    if jsonb_typeof(f) <> 'object' then perform lec_private.fail(400, 'invalid_type', 'files[]'); end if;
    ty := f ->> 'type';
    if ty is null or not (ty = any (array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'audio/mpeg', 'video/mp4'])) then
      perform lec_private.fail(415, 'unsupported_type', '이미지·PDF·MP3·MP4만 올릴 수 있어요.');
    end if;
    v_path := lec_private.file_path(f, p_code);
    if v_path is null or v_path = any (seen) then perform lec_private.fail(400, 'invalid_value', 'files: 이 연수에 내가 올린 파일만 붙일 수 있어요.'); end if;
    select t.mime into v_mime from lec_private.upload_tickets t
     where t.path = v_path and t.training_code = p_code and t.by = p_by and (t.post is null or t.post = p_post);
    if not found and not (p_post is not null and exists (select 1 from public.lec_posts x where x.id = p_post and x.by = p_by and strpos(x.files::text, v_path) > 0)) then
      perform lec_private.fail(400, 'invalid_value', 'files: 이 연수에 내가 올린 파일만 붙일 수 있어요.');
    end if;
    seen := seen || v_path;
    o := o || jsonb_build_array(jsonb_build_object('path', v_path, 'url', '', 'name', lec_private.jtxt(f, 'name', 120), 'type', coalesce(v_mime, ty),
      'size', case when jsonb_typeof(f -> 'size') = 'number' then greatest(0, least((f ->> 'size')::numeric, 1e10))::bigint else 0 end));
  end loop;
  return o;
end $$;

create or replace function lec_private.clean_options(v jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
begin
  if v is null or jsonb_typeof(v) = 'null' then return '[]'::jsonb; end if;
  if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 20 then perform lec_private.fail(400, 'invalid_value', 'options: 20개까지'); end if;
  return (select coalesce(jsonb_agg(to_jsonb(lec_private.txt(e #>> '{}', 100, 'options', true)) order by i), '[]'::jsonb)
            from jsonb_array_elements(v) with ordinality as a(e, i));
end $$;

create or replace function lec_private.clean_value(v jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare x jsonb; o jsonb := '[]'::jsonb;
begin
  case jsonb_typeof(v)
    when 'string' then return to_jsonb(lec_private.txt(v #>> '{}', 200, 'value', true));
    when 'number' then return v;
    when 'array' then
      if jsonb_array_length(v) < 1 or jsonb_array_length(v) > 5 then perform lec_private.fail(400, 'invalid_value', 'value: 1~5개'); end if;
      for x in select * from jsonb_array_elements(v) loop
        if jsonb_typeof(x) = 'number' then o := o || jsonb_build_array(x);
        elsif jsonb_typeof(x) = 'string' then o := o || jsonb_build_array(lec_private.txt(x #>> '{}', 200, 'value', true));
        else perform lec_private.fail(400, 'invalid_type', 'value[]'); end if;
      end loop;
      return o;
    else perform lec_private.fail(400, 'invalid_type', 'value');
  end case;
  return null;
end $$;

create or replace function lec_private.clean_survey(v jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare k text; x jsonb; o jsonb := '{}'::jsonb; n int := 0;
begin
  if jsonb_typeof(v) is distinct from 'object' then perform lec_private.fail(400, 'invalid_type', 'answers: 객체'); end if;
  for k, x in select * from jsonb_each(v) loop
    n := n + 1;
    if n > 50 then perform lec_private.fail(400, 'too_many', 'answers: 항목이 너무 많아요.'); end if;
    k := lec_private.txt(k, 64, 'answers.key', true);
    case jsonb_typeof(x)
      when 'string' then o := o || jsonb_build_object(k, lec_private.txt(x #>> '{}', 1000, k, false, true));
      when 'number' then o := o || jsonb_build_object(k, x);
      when 'boolean' then o := o || jsonb_build_object(k, x);
      when 'array' then o := o || jsonb_build_object(k, (select coalesce(jsonb_agg(lec_private.txt(e #>> '{}', 100, k)), '[]'::jsonb) from (select e from jsonb_array_elements(x) e limit 20) s));
      when 'null' then null;
      else perform lec_private.fail(400, 'invalid_type', k);
    end case;
  end loop;
  return o;
end $$;

create or replace function lec_private.clean_state(p jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare o jsonb := '{}'::jsonb; t jsonb; n jsonb; k text; x jsonb; ui jsonb := '{}'::jsonb;
begin
  if jsonb_typeof(p) is distinct from 'object' then perform lec_private.fail(400, 'invalid_body', '본문이 JSON 객체가 아닙니다.'); end if;
  if p ? 'step' then
    o := o || jsonb_build_object('step', case jsonb_typeof(p -> 'step') when 'null' then null when 'number' then to_jsonb(trunc((p ->> 'step')::numeric)::bigint) else to_jsonb(lec_private.jtxt(p, 'step', 64)) end);
  end if;
  if p ? 'slide' then
    if jsonb_typeof(p -> 'slide') <> 'number' or (p ->> 'slide')::numeric < 0 or (p ->> 'slide')::numeric > 1000000 then perform lec_private.fail(400, 'invalid_value', 'slide'); end if;
    o := o || jsonb_build_object('slide', trunc((p ->> 'slide')::numeric)::int);
  end if;
  if p ? 'follow' then o := o || jsonb_build_object('follow', lec_private.jbool(p, 'follow', false)); end if;
  if p ? 'timer' then
    t := p -> 'timer';
    if jsonb_typeof(t) = 'null' then o := o || jsonb_build_object('timer', null);
    elsif jsonb_typeof(t) <> 'object' then perform lec_private.fail(400, 'invalid_type', 'timer');
    else
      if (t ? 'endsAt' and jsonb_typeof(t -> 'endsAt') not in ('number', 'null')) or (t ? 'remaining' and jsonb_typeof(t -> 'remaining') not in ('number', 'null')) then
        perform lec_private.fail(400, 'invalid_type', 'timer');
      end if;
      o := o || jsonb_build_object('timer', jsonb_build_object(
        'endsAt', case when jsonb_typeof(t -> 'endsAt') = 'number' then to_jsonb(least(greatest((t ->> 'endsAt')::numeric, 0), 1e13)::bigint) else null end,
        'label', lec_private.jtxt(t, 'label', 40),
        'running', lec_private.jbool(t, 'running', false),
        'remaining', case when jsonb_typeof(t -> 'remaining') = 'number' then to_jsonb(least(greatest((t ->> 'remaining')::numeric, 0), 86400000)::bigint) else null end));
    end if;
  end if;
  if p ? 'notice' then
    n := p -> 'notice';
    if jsonb_typeof(n) = 'null' then o := o || jsonb_build_object('notice', null);
    elsif jsonb_typeof(n) <> 'object' then perform lec_private.fail(400, 'invalid_type', 'notice');
    elsif lec_private.jtxt(n, 'text', 300, false, true) = '' then o := o || jsonb_build_object('notice', null);
    else o := o || jsonb_build_object('notice', jsonb_build_object('text', lec_private.jtxt(n, 'text', 300, false, true), 'level', lec_private.jenum(n, 'level', array['info', 'warn', 'success', 'danger'], 'info')));
    end if;
  end if;
  if p ? 'openPoll' then
    o := o || jsonb_build_object('openPoll', case when jsonb_typeof(p -> 'openPoll') = 'null' or p ->> 'openPoll' = '' then null else to_jsonb(lec_private.jtxt(p, 'openPoll', 64)) end);
  end if;
  if p ? 'ui' then
    if jsonb_typeof(p -> 'ui') <> 'object' then perform lec_private.fail(400, 'invalid_type', 'ui'); end if;
    if (select count(*) from jsonb_object_keys(p -> 'ui')) > 20 then perform lec_private.fail(400, 'too_many', 'ui'); end if;
    for k, x in select * from jsonb_each(p -> 'ui') loop
      k := lec_private.txt(k, 32, 'ui.key', true);
      case jsonb_typeof(x)
        when 'string' then ui := ui || jsonb_build_object(k, lec_private.txt(x #>> '{}', 200, k));
        when 'number' then ui := ui || jsonb_build_object(k, x);
        when 'boolean' then ui := ui || jsonb_build_object(k, x);
        when 'null' then ui := ui || jsonb_build_object(k, null);
        else perform lec_private.fail(400, 'invalid_type', k);
      end case;
    end loop;
    o := o || jsonb_build_object('ui', ui);
  end if;
  if o = '{}'::jsonb then perform lec_private.fail(400, 'nothing_to_update', '바꿀 상태가 없습니다.'); end if;
  return o;
end $$;

-- admin view of a collection (hidden content restored), rev > since
create or replace function lec_private.admin_rows(p_col text, p_code text, p_since bigint)
returns jsonb language plpgsql stable set search_path = '' as $$
declare r jsonb;
begin
  execute format(
    'select coalesce(jsonb_agg(lec_private.out(%L, to_jsonb(x) || coalesce((select jsonb_strip_nulls(jsonb_build_object(''text'', h.text, ''files'', h.files)) from lec_private.hidden h where h.id = x.id), ''{}''::jsonb)) order by x.created_at), ''[]''::jsonb)
       from public.%I x where x.training_code = $1 and x.rev > $2', p_col, 'lec_' || p_col)
  into r using p_code, p_since;
  return r;
end $$;

-- move content of a hidden item out of the readable table (and back)
create or replace function lec_private.hide(p_col text, p_code text, p_id uuid, p_hide boolean)
returns void language plpgsql set search_path = '' as $$
declare h lec_private.hidden;
begin
  if p_hide then
    if exists (select 1 from lec_private.hidden where id = p_id) then return; end if;
    if p_col = 'questions' then
      insert into lec_private.hidden (col, id, training_code, text) select 'questions', id, training_code, text from public.lec_questions where id = p_id;
      update public.lec_questions set text = '' where id = p_id;
    elsif p_col = 'posts' then
      insert into lec_private.hidden (col, id, training_code, text, files) select 'posts', id, training_code, text, files from public.lec_posts where id = p_id;
      update public.lec_posts set text = '', files = '[]'::jsonb where id = p_id;
    elsif p_col = 'chat' then
      insert into lec_private.hidden (col, id, training_code, text) select 'chat', id, training_code, text from public.lec_chat where id = p_id;
      update public.lec_chat set text = '' where id = p_id;
    end if;
  else
    select * into h from lec_private.hidden where id = p_id;
    if not found then return; end if;
    if p_col = 'questions' then update public.lec_questions set text = h.text where id = p_id;
    elsif p_col = 'posts' then update public.lec_posts set text = h.text, files = coalesce(h.files, '[]'::jsonb) where id = p_id;
    elsif p_col = 'chat' then update public.lec_chat set text = h.text where id = p_id;
    end if;
    delete from lec_private.hidden where id = p_id;
  end if;
end $$;

-- ---------------------------------------------------------------- setup (SQL Editor only; not callable through the API)
create or replace function lec_private.init_training_hash(p_code text, p_admin_hash text, p_settings jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_code text := lec_private.code(p_code); s jsonb := coalesce(p_settings, '{}'::jsonb); v_ret int; v_flush int;
begin
  if p_admin_hash !~ '^[0-9a-f]{64}$' then perform lec_private.fail(400, 'invalid_value', 'admin hash: SHA-256 hex 64자'); end if;
  if lec_private.weak_hash(p_admin_hash) then perform lec_private.fail(400, 'weak_key', '예시로 쓰인 관리자 키입니다. 새로 만든 키(12자 이상)를 쓰세요.'); end if;
  v_ret := least(greatest(coalesce((s ->> 'retentionDays')::int, 30), 1), 365);
  v_flush := least(greatest(coalesce((s ->> 'flushMs')::int, 2000), 500), 10000);
  insert into lec_private.trainings (code, admin_hash, settings, retention_days, flush_ms)
  values (v_code, p_admin_hash, s, v_ret, v_flush)
  on conflict (code) do update set admin_hash = excluded.admin_hash, settings = excluded.settings, retention_days = excluded.retention_days, flush_ms = excluded.flush_ms;
  insert into public.lec_state (training_code, data, rev) values (v_code, '{}'::jsonb, 0) on conflict (training_code) do nothing;
  return jsonb_build_object('ok', true, 'code', v_code, 'retentionDays', v_ret, 'flushMs', v_flush);
end $$;

create or replace function lec_private.init_training(p_code text, p_admin_key text, p_settings jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if lec_private.key_problem(p_admin_key) is not null then perform lec_private.fail(400, 'weak_key', lec_private.key_problem(p_admin_key)); end if;
  return lec_private.init_training_hash(p_code, lec_private.hash(p_admin_key), p_settings);
end $$;

create or replace function lec_private.set_setup_secret(p_secret text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_secret is null or p_secret = '' then delete from lec_private.config where key = 'setup_hash'; return; end if;
  if lec_private.key_problem(p_secret) is not null then perform lec_private.fail(400, 'weak_key', '설정 토큰: ' || lec_private.key_problem(p_secret)); end if;
  insert into lec_private.config (key, value) values ('setup_hash', lec_private.hash(p_secret))
  on conflict (key) do update set value = excluded.value;
end $$;

-- retention: drop trainings idle past retention_days (rows cascade). Schedule daily with pg_cron (below).
create or replace function lec_private.cleanup()
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  -- files of trainings past retention, and uploads never attached to a post within a day, go to the trash first
  insert into lec_private.file_trash (path, training_code)
    select k.path, k.training_code from lec_private.upload_tickets k join lec_private.trainings g on g.code = k.training_code
     where g.last_at < now() - make_interval(days => g.retention_days) or (k.post is null and k.expires_at < now() - interval '1 day')
  on conflict (path) do nothing;
  begin
    execute $q$insert into lec_private.file_trash (path, training_code)
      select o.name, split_part(o.name, '/', 1) from storage.objects o join lec_private.trainings g on g.code = split_part(o.name, '/', 1)
       where o.bucket_id = 'lec-uploads' and g.last_at < now() - make_interval(days => g.retention_days)
      on conflict (path) do nothing$q$;
    -- forget trash entries whose objects are already gone
    execute $q$delete from lec_private.file_trash t where t.queued_at < now() - interval '10 minutes'
      and not exists (select 1 from storage.objects o where o.bucket_id = 'lec-uploads' and o.name = t.path)$q$;
  exception when others then null; -- no storage schema (plain Postgres)
  end;
  with gone as (delete from lec_private.trainings t where t.last_at < now() - make_interval(days => t.retention_days) returning 1)
  select count(*) into n from gone;
  delete from lec_private.rate where win < now() - interval '1 hour';
  delete from lec_private.upload_tickets where post is null and expires_at < now() - interval '1 day';
  return n;
end $$;

-- ---------------------------------------------------------------- API: RPC functions (public schema)
create or replace function public.lec_init(p_code text, p_admin_key_hash text, p_setup text, p_settings jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_code text := lec_private.code(p_code); v_hash text;
begin
  select value into v_hash from lec_private.config where key = 'setup_hash';
  if v_hash is null then perform lec_private.fail(403, 'init_disabled', '이 프로젝트는 API로 연수를 등록하지 않습니다(SQL Editor에서 init_training 사용).'); end if;
  if lec_private.full_win('afip:' || coalesce(lec_private.req_ip_first(), '?'), 'authfail', 20, 600) or lec_private.full_win('afip:' || coalesce(lec_private.req_ip(), '?'), 'authfail', 20, 600) then
    perform lec_private.fail(429, 'rate_limited', '설정 토큰이 여러 번 틀려 잠시 막았어요. 몇 분 뒤에 다시 해 주세요.');
  end if;
  if lec_private.hash(p_setup) <> v_hash then
    perform lec_private.count_win('afip:' || coalesce(lec_private.req_ip_first(), '?'), 'authfail', 600);
    if coalesce(lec_private.req_ip(), '?') <> coalesce(lec_private.req_ip_first(), '?') then perform lec_private.count_win('afip:' || coalesce(lec_private.req_ip(), '?'), 'authfail', 600); end if;
    return lec_private.err(403, 'setup_required', '설정 토큰이 맞지 않습니다.');
  end if;
  if exists (select 1 from lec_private.trainings where code = v_code) then perform lec_private.fail(409, 'already_initialized', '이미 등록된 코드입니다.'); end if;
  return lec_private.init_training_hash(v_code, lower(p_admin_key_hash), p_settings);
end $$;

create or replace function public.lec_join(p_code text, p_nickname text default '', p_name text default null, p_school text default null, p_consent boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_code text := lec_private.code(p_code); t lec_private.trainings; v_nick text; v_name text; v_school text; v_token text; v_id uuid; v_rev bigint; v_ip text := lec_private.req_ip();
begin
  t := lec_private.training(v_code);
  v_nick := coalesce(nullif(lec_private.txt(p_nickname, 20, 'nickname'), ''), '참가자');
  if lec_private.reserved_nick(v_nick) then perform lec_private.fail(400, 'reserved_nickname', '이 별명은 쓸 수 없어요(강사·운영자용). 다른 별명을 골라 주세요.'); end if;
  v_name := lec_private.txt(p_name, 40, 'name');
  v_school := lec_private.txt(p_school, 60, 'school');
  if (v_name <> '' or v_school <> '') and not coalesce(p_consent, false) then
    perform lec_private.fail(400, 'consent_required', '이름·소속을 남기려면 개인정보 수집에 동의해야 합니다.');
  end if;
  perform lec_private.hit('join:' || v_code, 'join', 600);           -- whole training, per minute
  if v_ip is not null then perform lec_private.hit('ip:' || v_ip, 'join', 600); end if;  -- soft; a school NAT is one IP
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_rev := lec_private.bump(v_code, false);
  if (select count(*) from public.lec_participants x where x.training_code = v_code) >= least(greatest(coalesce((t.settings ->> 'maxParticipants')::int, 500), 1), 5000) then
    perform lec_private.fail(403, 'room_full', '참가 인원이 가득 찼어요. 강사에게 알려 주세요.');
  end if;
  insert into public.lec_participants (training_code, token_hash, nickname, name, school, consent_at, rev)
  values (v_code, lec_private.hash(v_token), v_nick, v_name, v_school, case when p_consent then now() end, v_rev)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'token', v_token, 'nickname', v_nick, '_flush', lec_private.poke(v_code));
end $$;

create or replace function public.lec_add(p_code text, p_token text, p_col text, p_doc jsonb, p_admin text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_code text := lec_private.code(p_code); t lec_private.trainings; p public.lec_participants; v_cid text; v_rev bigint;
  j jsonb; v_text text; v_anon boolean; v_poll text; v_err jsonb; v_files jsonb; v_id uuid;
begin
  if jsonb_typeof(p_doc) is distinct from 'object' then perform lec_private.fail(400, 'invalid_body', '본문이 JSON 객체가 아닙니다.'); end if;
  if not (p_col = any (array['attendance', 'progress', 'help', 'questions', 'posts', 'polls', 'answers', 'survey', 'chat'])) then
    perform lec_private.fail(404, 'unknown_collection', '없는 컬렉션입니다.');
  end if;
  v_cid := nullif(lec_private.jtxt(p_doc, 'cid', 40), '');
  if p_col = 'polls' then
    v_err := lec_private.admin_check(v_code, p_admin);
    if v_err is not null then return v_err; end if;
    t := lec_private.training(v_code);
    perform lec_private.hit('admin:' || v_code, 'admin', 600);
    v_rev := lec_private.bump(v_code, true);
    insert into public.lec_polls (training_code, question, kind, options, open, cid, rev)
    values (v_code, lec_private.jtxt(p_doc, 'question', 200, true), lec_private.jenum(p_doc, 'kind', array['choice', 'word', 'scale'], 'choice'),
            lec_private.clean_options(p_doc -> 'options'),
            lec_private.jbool(p_doc, 'open', false), v_cid, v_rev)
    returning lec_private.out('polls', to_jsonb(lec_polls.*)) into j;
    return j || jsonb_build_object('_flush', lec_private.poke(v_code));
  end if;

  t := lec_private.training(v_code);
  p := lec_private.participant(v_code, p_token);
  perform lec_private.hit(p.id::text, 'write', 90);
  if p_col in ('questions', 'help', 'posts', 'chat') then
    perform lec_private.hit(p.id::text, p_col, case p_col when 'questions' then 8 when 'help' then 6 when 'posts' then 12 else 30 end);
  end if;
  -- idempotent retry: same participant + same cid → the existing doc
  if v_cid is not null and p_col in ('help', 'questions', 'posts', 'chat') then
    execute format('select lec_private.out(%L, to_jsonb(x)) from public.%I x where x.training_code = $1 and x.by = $2 and x.cid = $3', p_col, 'lec_' || p_col)
      into j using v_code, p.id, v_cid;
    if j is not null then return j; end if;
  end if;
  v_rev := lec_private.bump(v_code, p_col in ('help', 'questions', 'posts', 'chat', 'progress', 'answers'));
  case p_col
    when 'attendance' then
      insert into public.lec_attendance as a (training_code, by, kind, at, cid, rev)
      values (v_code, p.id, lec_private.jenum(p_doc, 'kind', array['in', 'out']), now(), v_cid, v_rev)
      on conflict (training_code, by, kind) do update set at = now(), cid = excluded.cid, rev = excluded.rev, updated_at = now()
      returning lec_private.out('attendance', to_jsonb(a.*)) into j;
    when 'progress' then
      insert into public.lec_progress as g (training_code, by, station, status, at, cid, rev)
      values (v_code, p.id, lec_private.jtxt(p_doc, 'station', 64, true), lec_private.jenum(p_doc, 'status', array['doing', 'done', 'stuck']), now(), v_cid, v_rev)
      on conflict (training_code, by, station) do update set status = excluded.status, at = now(), cid = excluded.cid, rev = excluded.rev, updated_at = now()
      returning lec_private.out('progress', to_jsonb(g.*)) into j;
    when 'help' then
      insert into public.lec_help as h (training_code, by, nickname, station, seat, message, cid, rev)
      values (v_code, p.id, p.nickname, lec_private.jtxt(p_doc, 'station', 64), lec_private.jtxt(p_doc, 'seat', 20), lec_private.jtxt(p_doc, 'message', 300, false, true), v_cid, v_rev)
      returning lec_private.out('help', to_jsonb(h.*)) into j;
    when 'questions' then
      v_text := lec_private.jtxt(p_doc, 'text', 500, true, true);
      v_anon := lec_private.jbool(p_doc, 'anonymous', true);
      insert into public.lec_questions as q (training_code, by, text, nickname, anonymous, cid, rev)
      values (v_code, p.id, v_text, case when v_anon then '' else p.nickname end, v_anon, v_cid, v_rev)
      returning lec_private.out('questions', to_jsonb(q.*)) into j;
    when 'posts' then
      v_text := lec_private.jtxt(p_doc, 'text', 1000, false, true);
      v_files := lec_private.clean_files(p_doc -> 'files', v_code, p.id, null);
      if v_text = '' and jsonb_array_length(v_files) = 0 then perform lec_private.fail(400, 'required', 'text 또는 files가 필요합니다.'); end if;
      if jsonb_array_length(v_files) > 0 and not lec_private.uploads_on(t) then perform lec_private.fail(403, 'uploads_disabled', '이 연수는 파일 올리기를 쓰지 않습니다.'); end if;
      insert into public.lec_posts as o (training_code, by, kind, text, nickname, files, license, cid, rev)
      values (v_code, p.id, coalesce(nullif(lec_private.jtxt(p_doc, 'kind', 32), ''), 'post'), v_text, p.nickname, v_files, lec_private.jtxt(p_doc, 'license', 40), v_cid, v_rev)
      returning o.id, lec_private.out('posts', to_jsonb(o.*)) into v_id, j;
      update lec_private.upload_tickets k set post = v_id where k.training_code = v_code and k.path in (select e ->> 'path' from jsonb_array_elements(v_files) e);
      -- board pre-moderation: the post waits hidden until the instructor shows it (init setting or state.ui.moderation)
      if lec_private.moderated(t) then
        perform lec_private.hide('posts', v_code, v_id, true);
        update public.lec_posts x set hidden = true where x.id = v_id;
        j := j || jsonb_build_object('hidden', true);
      end if;
    when 'answers' then
      v_poll := lec_private.jtxt(p_doc, 'poll', 64, true);
      -- (the same closed-poll rule applies to lec_update)
      if exists (select 1 from public.lec_polls where training_code = v_code and id::text = v_poll and open = false) then
        perform lec_private.fail(409, 'poll_closed', '투표가 닫혔어요.');
      end if;
      insert into public.lec_answers as w (training_code, poll, by, value, cid, rev)
      values (v_code, v_poll, p.id, lec_private.clean_value(p_doc -> 'value'), v_cid, v_rev)
      on conflict (training_code, poll, by) do update set value = excluded.value, cid = excluded.cid, rev = excluded.rev, updated_at = now()
      returning lec_private.out('answers', to_jsonb(w.*)) into j;
    when 'survey' then
      insert into public.lec_survey as s (training_code, by, answers, cid, rev)
      values (v_code, p.id, lec_private.clean_survey(p_doc -> 'answers'), v_cid, v_rev)
      on conflict (training_code, by) do update set answers = excluded.answers, cid = excluded.cid, rev = excluded.rev, updated_at = now()
      returning lec_private.out('survey', to_jsonb(s.*)) into j;
    when 'chat' then
      insert into public.lec_chat as c (training_code, by, nickname, text, cid, rev)
      values (v_code, p.id, p.nickname, lec_private.jtxt(p_doc, 'text', 300, true, true), v_cid, v_rev)
      returning lec_private.out('chat', to_jsonb(c.*)) into j;
  end case;
  return j || jsonb_build_object('_flush', lec_private.poke(v_code));
end $$;

create or replace function public.lec_update(p_code text, p_token text, p_admin text, p_col text, p_id text, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_code text := lec_private.code(p_code); t lec_private.trainings; v_admin boolean := false; p public.lec_participants; v_id uuid;
  r jsonb; v_owner boolean := false; v_rev bigint; j jsonb; v_keys text[]; v_allowed text[]; v_hide boolean; v_err jsonb; v_files jsonb; v_nick text;
begin
  if jsonb_typeof(p_patch) is distinct from 'object' then perform lec_private.fail(400, 'invalid_body', '본문이 JSON 객체가 아닙니다.'); end if;
  if not (p_col = any (array['participants', 'progress', 'help', 'questions', 'posts', 'polls', 'answers', 'survey', 'chat'])) then
    perform lec_private.fail(404, 'unknown_collection', '없는 컬렉션입니다.');
  end if;
  -- an admin key that is sent must be right (counted when wrong); participants send none
  if p_admin is not null and p_admin <> '' then
    v_err := lec_private.admin_check(v_code, p_admin);
    if v_err is not null then return v_err; end if;
    v_admin := true;
  end if;
  t := lec_private.training(v_code);
  v_id := lec_private.to_uuid(p_id);
  execute format('select to_jsonb(x) from public.%I x where x.training_code = $1 and x.id = $2 for update', 'lec_' || p_col) into r using v_code, v_id;
  if r is null then perform lec_private.fail(404, 'not_found', '없는 글입니다.'); end if;
  if v_admin then
    perform lec_private.hit('admin:' || v_code, 'admin', 600);
    v_allowed := case p_col
      when 'participants' then array['nickname'] when 'help' then array['status', 'assignee'] when 'questions' then array['status', 'pinned', 'text']
      when 'posts' then array['hidden', 'text'] when 'polls' then array['question', 'kind', 'options', 'open'] when 'chat' then array['hidden']
      when 'progress' then array['status'] else array[]::text[] end;
  else
    p := lec_private.participant(v_code, p_token);
    perform lec_private.hit(p.id::text, 'write', 90);
    v_owner := case when p_col = 'participants' then v_id = p.id else (r ->> 'by')::uuid = p.id end;
    if not v_owner then perform lec_private.fail(403, 'forbidden', '내 글만 고칠 수 있어요.'); end if;
    v_allowed := case p_col
      when 'participants' then array['nickname'] when 'progress' then array['status'] when 'help' then array['station', 'seat', 'message', 'status']
      when 'questions' then array['text'] when 'posts' then array['kind', 'text', 'files', 'license'] when 'answers' then array['value']
      when 'survey' then array['answers'] else array[]::text[] end;
    if (p_col = 'questions' and r ->> 'status' = 'hidden') or (p_col in ('posts', 'chat') and (r ->> 'hidden')::boolean) then
      perform lec_private.fail(403, 'forbidden', '숨겨진 글은 고칠 수 없어요.');
    end if;
  end if;
  select array_agg(k) into v_keys from jsonb_object_keys(p_patch) k where k = any (v_allowed);
  if v_keys is null then perform lec_private.fail(400, 'nothing_to_update', '바꿀 수 있는 항목이 없습니다.'); end if;
  if 'text' = any (v_keys) and ((p_col = 'questions' and r ->> 'status' = 'hidden') or (p_col = 'posts' and (r ->> 'hidden')::boolean)) then
    perform lec_private.fail(409, 'hidden', '숨긴 글은 먼저 보이게 한 뒤 고쳐 주세요.');
  end if;
  -- L1: an answer cannot change once its poll is closed (same rule as a new answer)
  if not v_admin and p_col = 'answers' and exists (select 1 from public.lec_polls l where l.training_code = v_code and l.id::text = r ->> 'poll' and l.open = false) then
    perform lec_private.fail(409, 'poll_closed', '투표가 닫혔어요.');
  end if;
  if p_col = 'posts' and 'files' = any (v_keys) then
    v_files := lec_private.clean_files(p_patch -> 'files', v_code, p.id, v_id);
    if jsonb_array_length(v_files) > 0 and not lec_private.uploads_on(t) then perform lec_private.fail(403, 'uploads_disabled', '이 연수는 파일 올리기를 쓰지 않습니다.'); end if;
    -- files dropped from the post go to the trash; new ones are linked to it
    insert into lec_private.file_trash (path, training_code)
      select lec_private.file_path(e, v_code), v_code from jsonb_array_elements(r -> 'files') e
       where lec_private.file_path(e, v_code) is not null and strpos(v_files::text, lec_private.file_path(e, v_code)) = 0
    on conflict (path) do nothing;
    update lec_private.upload_tickets k set post = v_id where k.training_code = v_code and k.path in (select e ->> 'path' from jsonb_array_elements(v_files) e);
  end if;
  v_rev := lec_private.bump(v_code, p_col not in ('participants', 'survey'));
  case p_col
    when 'participants' then
      v_nick := lec_private.jtxt(p_patch, 'nickname', 20, true);
      if not v_admin and lec_private.reserved_nick(v_nick) then perform lec_private.fail(400, 'reserved_nickname', '이 별명은 쓸 수 없어요(강사·운영자용). 다른 별명을 골라 주세요.'); end if;
      update public.lec_participants x set nickname = v_nick, rev = v_rev, updated_at = now() where x.id = v_id;
    when 'progress' then
      update public.lec_progress x set status = lec_private.jenum(p_patch, 'status', array['doing', 'done', 'stuck']), at = now(), rev = v_rev, updated_at = now() where x.id = v_id;
    when 'help' then
      update public.lec_help x set
        station = case when 'station' = any (v_keys) then lec_private.jtxt(p_patch, 'station', 64) else x.station end,
        seat = case when 'seat' = any (v_keys) then lec_private.jtxt(p_patch, 'seat', 20) else x.seat end,
        message = case when 'message' = any (v_keys) then lec_private.jtxt(p_patch, 'message', 300, false, true) else x.message end,
        status = case when 'status' = any (v_keys) then lec_private.jenum(p_patch, 'status', case when v_admin then array['open', 'claimed', 'done'] else array['open', 'done'] end) else x.status end,
        assignee = case when 'assignee' = any (v_keys) then lec_private.jtxt(p_patch, 'assignee', 20) else x.assignee end,
        rev = v_rev, updated_at = now()
      where x.id = v_id;
    when 'questions' then
      update public.lec_questions x set
        text = case when 'text' = any (v_keys) then lec_private.jtxt(p_patch, 'text', 500, true, true) else x.text end,
        pinned = case when 'pinned' = any (v_keys) then lec_private.jbool(p_patch, 'pinned', false) else x.pinned end,
        rev = v_rev, updated_at = now()
      where x.id = v_id;
      if 'status' = any (v_keys) then
        v_hide := lec_private.jenum(p_patch, 'status', array['open', 'answered', 'hidden']) = 'hidden';
        perform lec_private.hide('questions', v_code, v_id, v_hide);
        update public.lec_questions x set status = p_patch ->> 'status' where x.id = v_id;
      end if;
    when 'posts' then
      update public.lec_posts x set
        kind = case when 'kind' = any (v_keys) then coalesce(nullif(lec_private.jtxt(p_patch, 'kind', 32), ''), 'post') else x.kind end,
        text = case when 'text' = any (v_keys) then lec_private.jtxt(p_patch, 'text', 1000, false, true) else x.text end,
        files = case when 'files' = any (v_keys) then v_files else x.files end,
        license = case when 'license' = any (v_keys) then lec_private.jtxt(p_patch, 'license', 40) else x.license end,
        rev = v_rev, updated_at = now()
      where x.id = v_id;
      if 'hidden' = any (v_keys) then
        v_hide := lec_private.jbool(p_patch, 'hidden', false);
        perform lec_private.hide('posts', v_code, v_id, v_hide);
        update public.lec_posts x set hidden = v_hide where x.id = v_id;
      end if;
    when 'polls' then
      update public.lec_polls x set
        question = case when 'question' = any (v_keys) then lec_private.jtxt(p_patch, 'question', 200, true) else x.question end,
        kind = case when 'kind' = any (v_keys) then lec_private.jenum(p_patch, 'kind', array['choice', 'word', 'scale']) else x.kind end,
        options = case when 'options' = any (v_keys) then lec_private.clean_options(p_patch -> 'options') else x.options end,
        open = case when 'open' = any (v_keys) then lec_private.jbool(p_patch, 'open', false) else x.open end,
        rev = v_rev, updated_at = now()
      where x.id = v_id;
    when 'answers' then
      update public.lec_answers x set value = lec_private.clean_value(p_patch -> 'value'), rev = v_rev, updated_at = now() where x.id = v_id;
    when 'survey' then
      update public.lec_survey x set answers = lec_private.clean_survey(p_patch -> 'answers'), rev = v_rev, updated_at = now() where x.id = v_id;
    when 'chat' then
      v_hide := lec_private.jbool(p_patch, 'hidden', false);
      perform lec_private.hide('chat', v_code, v_id, v_hide);
      update public.lec_chat x set hidden = v_hide, rev = v_rev, updated_at = now() where x.id = v_id;
  end case;
  j := (lec_private.admin_rows(p_col, v_code, v_rev - 1)) -> 0;
  return j || jsonb_build_object('_flush', lec_private.poke(v_code));
end $$;

create or replace function public.lec_remove(p_code text, p_admin text, p_col text, p_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_code text := lec_private.code(p_code); v_id uuid; v_rev bigint; n int; v_err jsonb;
begin
  v_err := lec_private.admin_check(v_code, p_admin);
  if v_err is not null then return v_err; end if;
  if not (p_col = any (array['participants', 'attendance', 'progress', 'help', 'questions', 'posts', 'polls', 'answers', 'survey', 'chat'])) then
    perform lec_private.fail(404, 'unknown_collection', '없는 컬렉션입니다.');
  end if;
  v_id := lec_private.to_uuid(p_id);
  v_rev := lec_private.bump(v_code, p_col in ('help', 'questions', 'posts', 'chat', 'progress', 'answers', 'polls'));
  if p_col = 'posts' then
    -- H3: the post's files go to the trash (unreadable at once; the console deletes them from Storage)
    insert into lec_private.file_trash (path, training_code)
      select distinct lec_private.file_path(e, v_code), v_code from (
        select jsonb_array_elements(x.files) e from public.lec_posts x where x.training_code = v_code and x.id = v_id
        union all select jsonb_array_elements(coalesce(h.files, '[]'::jsonb)) from lec_private.hidden h where h.id = v_id) s
       where lec_private.file_path(e, v_code) is not null
    on conflict (path) do nothing;
  end if;
  execute format('delete from public.%I where training_code = $1 and id = $2', 'lec_' || p_col) using v_code, v_id;
  get diagnostics n = row_count;
  if n = 0 then perform lec_private.fail(404, 'not_found', '없는 글입니다.'); end if;
  delete from lec_private.votes where doc = v_id;
  delete from lec_private.hidden where id = v_id;
  insert into public.lec_tombstones (training_code, col, id, rev) values (v_code, p_col, v_id, v_rev)
  on conflict (training_code, col, id) do update set rev = excluded.rev;
  return jsonb_build_object('ok', true, '_flush', lec_private.poke(v_code));
end $$;

create or replace function lec_private.vote(p_code text, p_token text, p_col text, p_id text)
returns jsonb language plpgsql set search_path = '' as $$
declare v_code text := lec_private.code(p_code); p public.lec_participants; v_id uuid; v_rev bigint; n int; r jsonb; f text := case when p_col = 'questions' then 'votes' else 'likes' end;
begin
  p := lec_private.participant(v_code, p_token);
  perform lec_private.hit(p.id::text, 'vote', 120);
  v_id := lec_private.to_uuid(p_id);
  execute format('select to_jsonb(x) from public.%I x where x.training_code = $1 and x.id = $2 for update', 'lec_' || p_col) into r using v_code, v_id;
  if r is null then perform lec_private.fail(404, 'not_found', '없는 글입니다.'); end if;
  if p_col = 'questions' and r ->> 'status' = 'hidden' then perform lec_private.fail(409, 'hidden', '숨겨진 질문입니다.'); end if;
  insert into lec_private.votes (training_code, col, doc, by) values (v_code, p_col, v_id, p.id) on conflict do nothing;
  if not found then return jsonb_build_object(f, (r ->> f)::int, 'voted', true, 'already', true); end if;
  v_rev := lec_private.bump(v_code, true);
  execute format('update public.%I x set %I = (select count(*) from lec_private.votes v where v.col = $3 and v.doc = x.id), rev = $2, updated_at = now() where x.id = $1 returning %I', 'lec_' || p_col, f, f)
    into n using v_id, v_rev, p_col;
  return jsonb_build_object(f, n, 'voted', true, '_flush', lec_private.poke(v_code));
end $$;

create or replace function public.lec_vote(p_code text, p_token text, p_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin return lec_private.vote(p_code, p_token, 'questions', p_id); end $$;

create or replace function public.lec_like(p_code text, p_token text, p_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin return lec_private.vote(p_code, p_token, 'posts', p_id); end $$;

create or replace function public.lec_set_state(p_code text, p_admin text, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_code text := lec_private.code(p_code); v_clean jsonb; v_cur jsonb; v_next jsonb; v_rev bigint; v_err jsonb;
begin
  v_err := lec_private.admin_check(v_code, p_admin);
  if v_err is not null then return v_err; end if;
  perform lec_private.hit('admin:' || v_code, 'admin', 600);
  v_clean := lec_private.clean_state(p_patch);
  v_cur := coalesce((select data from public.lec_state where training_code = v_code), '{}'::jsonb);
  v_next := v_cur || (v_clean - 'ui');
  if v_clean ? 'ui' then v_next := jsonb_set(v_next, '{ui}', jsonb_strip_nulls(coalesce(v_cur -> 'ui', '{}'::jsonb) || (v_clean -> 'ui'))); end if;
  v_rev := lec_private.bump(v_code, true);
  insert into public.lec_state (training_code, data, rev, updated_at) values (v_code, v_next, v_rev, now())
  on conflict (training_code) do update set data = excluded.data, rev = excluded.rev, updated_at = excluded.updated_at;
  return lec_private.state_json(v_code) || jsonb_build_object('_flush', lec_private.poke(v_code, true));
end $$;

create or replace function public.lec_react(p_code text, p_token text, p_counts jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_code text := lec_private.code(p_code); p public.lec_participants; k text; x jsonb; n int := 0;
begin
  p := lec_private.participant(v_code, p_token);
  perform lec_private.hit(p.id::text, 'react', 90);
  if jsonb_typeof(p_counts) is distinct from 'object' then perform lec_private.fail(400, 'invalid_body', 'counts'); end if;
  for k, x in select * from jsonb_each(p_counts) loop
    n := n + 1;
    if n > 5 or not (k = any (array['👍', '❤️', '👏', '🎉', '😂', '😮', '🤔', '🙏', '🔥', '💯', '🙌', '😢', '✅', '❓', '💡'])) or jsonb_typeof(x) <> 'number' then
      perform lec_private.fail(400, 'invalid_value', 'emoji');
    end if;
    insert into lec_private.reactions as r (training_code, emoji, n) values (v_code, k, least(greatest((x #>> '{}')::numeric, 1), 20)::int)
    on conflict (training_code, emoji) do update set n = least(r.n + excluded.n, 1000);
  end loop;
  return jsonb_build_object('ok', true, '_flush', lec_private.poke(v_code));
end $$;

-- anyone with the code may nudge a pending tick out. L12: a cheap look without locks first (nothing pending, or too
-- early → no lock at all); then one flusher per training at a time, never waiting for a busy row.
create or replace function public.lec_flush(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_code text := lec_private.code(p_code); t lec_private.trainings; v_wp int; v_wa int;
begin
  select * into t from lec_private.trainings where code = v_code;
  if not found then return jsonb_build_object('_flush', 0); end if;
  if t.pub_rev > t.pub_tick_rev or exists (select 1 from lec_private.reactions x where x.training_code = v_code and x.n > 0) then
    v_wp := greatest(0, ceil((t.flush_ms / 1000.0 - extract(epoch from clock_timestamp() - t.pub_tick_at)) * 1000)::int);
  end if;
  if t.rev > t.adm_tick_rev then
    v_wa := greatest(0, ceil((least(1.0, t.flush_ms / 1000.0) - extract(epoch from clock_timestamp() - t.adm_tick_at)) * 1000)::int);
  end if;
  if v_wp is null and v_wa is null then return jsonb_build_object('_flush', 0); end if;
  -- too early for every pending channel: tell the caller when to come back, without touching any lock
  if coalesce(v_wp, 1) > 0 and coalesce(v_wa, 1) > 0 then return jsonb_build_object('_flush', least(coalesce(v_wp, v_wa), coalesce(v_wa, v_wp))); end if;
  if not pg_try_advisory_xact_lock(hashtext('lecpage:flush:' || v_code)) then return jsonb_build_object('_flush', 0); end if;
  return jsonb_build_object('_flush', lec_private.poke(v_code, false, true));
end $$;

-- the latest reaction batch (ticks only say "batch rx is ready"; clients never trust counts from a payload)
create or replace function public.lec_reactions(p_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object('rx', t.react_seq, 'r', t.react_last, 'at', lec_private.ms(t.pub_tick_at)) from lec_private.trainings t where t.code = lec_private.code(p_code)),
                  jsonb_build_object('rx', 0, 'r', '{}'::jsonb, 'at', 0))
$$;

/* Public snapshot. SECURITY INVOKER: runs as anon, so RLS (header code) and column grants apply.
   The cursor (`now`) is read first, so rows committed meanwhile are fetched again next time, never lost. */
create or replace function public.lec_snapshot(p_code text, p_since bigint default 0)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_code text := lec_private.code(p_code); v_rev bigint; s bigint := greatest(coalesce(p_since, 0), 0);
begin
  if lec_private.req_code() is distinct from v_code then
    perform lec_private.fail(400, 'code_header', 'x-lec-code 헤더가 연수 코드와 같아야 합니다.');
  end if;
  v_rev := lec_private.cur_rev(v_code);
  -- L12: nothing newer than the cursor (also the connect probe and unknown codes) → state only, no aggregates
  if s >= v_rev then
    return jsonb_build_object('now', v_rev, 'time', lec_private.ms(now()), 'since', s, 'full', s = 0,
      'state', (select jsonb_build_object('step', null, 'slide', 0, 'follow', false, 'timer', null, 'notice', null, 'openPoll', null, 'ui', '{}'::jsonb, 'updatedAt', 0)
                       || coalesce((select st.data || jsonb_build_object('updatedAt', lec_private.ms(st.updated_at)) from public.lec_state st where st.training_code = v_code), '{}'::jsonb)),
      'questions', '[]'::jsonb, 'posts', '[]'::jsonb, 'help', '[]'::jsonb, 'progress', '[]'::jsonb, 'polls', '[]'::jsonb, 'answers', '[]'::jsonb, 'chat', '[]'::jsonb, 'removed', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'now', v_rev, 'time', lec_private.ms(now()), 'since', s, 'full', s = 0,
    'state', (select jsonb_build_object('step', null, 'slide', 0, 'follow', false, 'timer', null, 'notice', null, 'openPoll', null, 'ui', '{}'::jsonb, 'updatedAt', 0)
                     || coalesce((select st.data || jsonb_build_object('updatedAt', lec_private.ms(st.updated_at)) from public.lec_state st where st.training_code = v_code), '{}'::jsonb)),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'text', q.text, 'nickname', q.nickname, 'anonymous', q.anonymous, 'votes', q.votes,
        'status', q.status, 'pinned', q.pinned, 'cid', q.cid, 'createdAt', lec_private.ms(q.created_at), 'updatedAt', lec_private.ms(q.updated_at)) order by q.created_at)
        from public.lec_questions q where q.training_code = v_code and q.rev > s), '[]'::jsonb),
    'posts', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'by', o.by, 'kind', o.kind, 'text', o.text, 'nickname', o.nickname, 'files', o.files,
        'license', o.license, 'likes', o.likes, 'hidden', o.hidden, 'cid', o.cid, 'createdAt', lec_private.ms(o.created_at), 'updatedAt', lec_private.ms(o.updated_at)) order by o.created_at)
        from public.lec_posts o where o.training_code = v_code and o.rev > s), '[]'::jsonb),
    'help', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'nickname', h.nickname, 'station', h.station, 'seat', h.seat, 'message', h.message,
        'status', h.status, 'assignee', h.assignee, 'cid', h.cid, 'createdAt', lec_private.ms(h.created_at), 'updatedAt', lec_private.ms(h.updated_at)) order by h.created_at)
        from public.lec_help h where h.training_code = v_code and h.rev > s), '[]'::jsonb),
    'progress', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'station', g.station, 'status', g.status, 'at', lec_private.ms(g.at),
        'createdAt', lec_private.ms(g.created_at), 'updatedAt', lec_private.ms(g.updated_at)) order by g.created_at)
        from public.lec_progress g where g.training_code = v_code and g.rev > s), '[]'::jsonb),
    'polls', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'question', l.question, 'kind', l.kind, 'options', l.options, 'open', l.open,
        'createdAt', lec_private.ms(l.created_at), 'updatedAt', lec_private.ms(l.updated_at)) order by l.created_at)
        from public.lec_polls l where l.training_code = v_code and l.rev > s), '[]'::jsonb),
    'answers', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'poll', w.poll, 'value', w.value,
        'createdAt', lec_private.ms(w.created_at), 'updatedAt', lec_private.ms(w.updated_at)) order by w.created_at)
        from public.lec_answers w where w.training_code = v_code and w.rev > s), '[]'::jsonb),
    'chat', coalesce((select jsonb_agg(c.d order by c.created_at) from (
        select jsonb_build_object('id', c0.id, 'by', c0.by, 'nickname', c0.nickname, 'text', c0.text, 'hidden', c0.hidden, 'cid', c0.cid,
          'createdAt', lec_private.ms(c0.created_at), 'updatedAt', lec_private.ms(c0.updated_at)) as d, c0.created_at
        from public.lec_chat c0 where c0.training_code = v_code and c0.rev > s order by c0.created_at desc limit 500) c), '[]'::jsonb),
    'removed', case when s = 0 then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('col', tb.col, 'id', tb.id))
        from public.lec_tombstones tb where tb.training_code = v_code and tb.rev > s and tb.col in ('questions', 'posts', 'help', 'progress', 'polls', 'answers', 'chat')), '[]'::jsonb) end
  );
end $$;

-- the participant's own docs: private ones (attendance, survey) so a reload restores them, and their own
-- progress/answers/help with `by` (the public snapshot leaves `by` out: L3)
create or replace function public.lec_mine(p_code text, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_code text := lec_private.code(p_code); p public.lec_participants;
begin
  p := lec_private.participant(v_code, p_token);
  return jsonb_build_object('me', jsonb_build_object('id', p.id, 'nickname', p.nickname),
    'attendance', coalesce((select jsonb_agg(lec_private.out('attendance', to_jsonb(a))) from public.lec_attendance a where a.training_code = v_code and a.by = p.id), '[]'::jsonb),
    'survey', coalesce((select jsonb_agg(lec_private.out('survey', to_jsonb(s))) from public.lec_survey s where s.training_code = v_code and s.by = p.id), '[]'::jsonb),
    'progress', coalesce((select jsonb_agg(lec_private.out('progress', to_jsonb(g))) from public.lec_progress g where g.training_code = v_code and g.by = p.id), '[]'::jsonb),
    'answers', coalesce((select jsonb_agg(lec_private.out('answers', to_jsonb(w))) from public.lec_answers w where w.training_code = v_code and w.by = p.id), '[]'::jsonb),
    'help', coalesce((select jsonb_agg(lec_private.out('help', to_jsonb(h))) from public.lec_help h where h.training_code = v_code and h.by = p.id), '[]'::jsonb));
end $$;

-- true/false; a wrong key is counted like everywhere else (H4), and answers 429 while locked
create or replace function public.lec_check_admin(p_code text, p_admin text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if lec_private.admin_check(lec_private.code(p_code), p_admin) is null then return true; end if;
  perform set_config('response.status', '200', true); -- "no" is a normal answer here
  return false;
end $$;

-- admin snapshot: every collection (incl. participants/attendance/survey) with hidden content
create or replace function public.lec_admin_snapshot(p_code text, p_admin text, p_since bigint default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_code text := lec_private.code(p_code); t lec_private.trainings; s bigint := greatest(coalesce(p_since, 0), 0); o jsonb; c text; v_err jsonb;
begin
  v_err := lec_private.admin_check(v_code, p_admin);
  if v_err is not null then return v_err; end if;
  t := lec_private.training(v_code);
  o := jsonb_build_object('now', t.rev, 'time', lec_private.ms(now()), 'since', s, 'full', s = 0, 'admin', true, 'state', lec_private.state_json(v_code),
    'removed', case when s = 0 then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('col', tb.col, 'id', tb.id)) from public.lec_tombstones tb where tb.training_code = v_code and tb.rev > s), '[]'::jsonb) end);
  foreach c in array array['participants', 'attendance', 'progress', 'help', 'questions', 'posts', 'polls', 'answers', 'survey', 'chat'] loop
    o := o || jsonb_build_object(c, lec_private.admin_rows(c, v_code, s));
  end loop;
  return o;
end $$;

-- export: the admin snapshot (client builds the CSV with the same layout as the servers)
create or replace function public.lec_export(p_code text, p_admin text, p_kind text default 'attendance')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_err jsonb;
begin
  if not (p_kind = any (array['attendance', 'progress', 'questions', 'survey', 'participants', 'posts', 'help', 'chat', 'answers'])) then
    perform lec_private.fail(400, 'bad_kind', 'kind');
  end if;
  v_err := lec_private.admin_check(lec_private.code(p_code), p_admin);
  if v_err is not null then return v_err; end if;
  return public.lec_admin_snapshot(p_code, p_admin, 0) || jsonb_build_object('kind', p_kind);
end $$;

-- purge: every row of the training. Its files go to the trash (unreadable at once); the console deletes them from
-- Storage right away, and again whenever it connects, until none are left (lec_trash).
create or replace function public.lec_purge(p_code text, p_admin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_code text := lec_private.code(p_code); v_files jsonb := '[]'::jsonb; c text; v_err jsonb;
begin
  v_err := lec_private.admin_check(v_code, p_admin);
  if v_err is not null then return v_err; end if;
  insert into lec_private.file_trash (path, training_code) select k.path, v_code from lec_private.upload_tickets k where k.training_code = v_code
  on conflict (path) do nothing;
  foreach c in array array['participants', 'attendance', 'progress', 'help', 'questions', 'posts', 'polls', 'answers', 'survey', 'chat', 'tombstones'] loop
    execute format('delete from public.%I where training_code = $1', 'lec_' || c) using v_code;
  end loop;
  delete from lec_private.votes where training_code = v_code;
  delete from lec_private.hidden where training_code = v_code;
  delete from lec_private.reactions where training_code = v_code;
  delete from lec_private.upload_tickets where training_code = v_code;
  update public.lec_state set data = '{}'::jsonb, updated_at = now() where training_code = v_code;
  begin
    execute 'insert into lec_private.file_trash (path, training_code) select name, $2 from storage.objects where bucket_id = ''lec-uploads'' and name like $1 on conflict (path) do nothing'
      using v_code || '/%', v_code;
  exception when others then null;
  end;
  select coalesce(jsonb_agg(t.path), '[]'::jsonb) into v_files from lec_private.file_trash t where t.training_code = v_code;
  update lec_private.trainings set purge_until = now() + interval '10 minutes', rev = rev + 1, pub_rev = rev + 1, last_at = now() where code = v_code;
  perform lec_private.send(jsonb_build_object('reset', true), 'tick', 'lec:' || v_code);
  perform lec_private.send(jsonb_build_object('reset', true), 'tick', 'lec:' || v_code || ':adm');
  return jsonb_build_object('ok', true, 'files', v_files);
end $$;

create or replace function public.lec_upload_ticket(p_code text, p_token text, p_name text, p_type text, p_size bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_code text := lec_private.code(p_code); t lec_private.trainings; p public.lec_participants; v_ext text; v_max bigint; v_path text;
begin
  t := lec_private.training(v_code);
  p := lec_private.participant(v_code, p_token);
  if not lec_private.uploads_on(t) then perform lec_private.fail(503, 'uploads_disabled', '이 연수는 파일 올리기를 쓰지 않습니다.'); end if;
  perform lec_private.hit(p.id::text, 'upload', 10);
  v_ext := case p_type when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/gif' then 'gif' when 'image/webp' then 'webp'
                       when 'application/pdf' then 'pdf' when 'audio/mpeg' then 'mp3' when 'video/mp4' then 'mp4' end;
  if v_ext is null then perform lec_private.fail(415, 'unsupported_type', '이미지·PDF·MP3·MP4만 올릴 수 있어요.'); end if;
  v_max := least(greatest(coalesce((t.settings ->> 'maxUploadMb')::int, 20), 1), 20)::bigint * 1048576;
  if p_size is null or p_size <= 0 then perform lec_private.fail(400, 'empty', '빈 파일입니다.'); end if;
  if p_size > v_max then perform lec_private.fail(413, 'too_large', '파일은 ' || (v_max / 1048576) || 'MB까지 올릴 수 있어요.'); end if;
  -- L10: type and size are checked here and again by the Storage insert policy (bucket MIME list, metadata size/type when
  -- Storage provides them). Magic bytes cannot be read from SQL: files are served only with their declared type,
  -- only as images/PDF/audio/video, and only through signed URLs of visible posts.
  v_path := v_code || '/' || replace(gen_random_uuid()::text, '-', '') || '.' || v_ext;
  insert into lec_private.upload_tickets (path, training_code, by, expires_at, mime, max_bytes) values (v_path, v_code, p.id, now() + interval '10 minutes', p_type, least(v_max, greatest(p_size, 1)));
  return jsonb_build_object('bucket', 'lec-uploads', 'path', v_path, 'name', lec_private.txt(p_name, 120, 'name'), 'type', p_type, 'size', p_size);
end $$;

-- Storage paths the client should delete (the bucket's delete policy allows exactly these). With the admin key: this
-- training's trash. Always also a few entries of trainings that no longer exist (retention clean-up).
create or replace function public.lec_trash(p_code text, p_admin text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_code text := lec_private.code(p_code); v_own boolean := false; v_err jsonb; o jsonb;
begin
  if p_admin is not null and p_admin <> '' then
    v_err := lec_private.admin_check(v_code, p_admin);
    if v_err is not null then return v_err; end if;
    v_own := true;
  end if;
  begin -- forget entries whose objects are already gone
    execute 'delete from lec_private.file_trash t where (t.training_code = $1 or not exists (select 1 from lec_private.trainings g where g.code = t.training_code))
               and not exists (select 1 from storage.objects o where o.bucket_id = ''lec-uploads'' and o.name = t.path)' using v_code;
  exception when others then null;
  end;
  select coalesce(jsonb_agg(x.path), '[]'::jsonb) into o from (
    select t.path from lec_private.file_trash t
     where (v_own and t.training_code = v_code) or not exists (select 1 from lec_private.trainings g where g.code = t.training_code)
     order by t.queued_at limit 1000) x;
  return jsonb_build_object('paths', o);
end $$;

-- storage policy helpers (called as anon by Storage; definer reads the private tables)
create or replace function lec_private.upload_allowed(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from lec_private.upload_tickets where path = p_name and expires_at > now() and post is null)
$$;
-- insert: a live ticket, and (when Storage passes them) the size and type the ticket was issued for
create or replace function lec_private.upload_ok(p_name text, p_meta jsonb)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from lec_private.upload_tickets k where k.path = p_name and k.expires_at > now() and k.post is null
    and (p_meta is null or coalesce(p_meta ->> 'size', '') !~ '^[0-9]+$' or (p_meta ->> 'size')::bigint <= coalesce(k.max_bytes, 20971520))
    and (p_meta is null or p_meta ->> 'mimetype' is null or k.mime is null or p_meta ->> 'mimetype' = k.mime))
$$;
-- read (signed URLs): only while a visible post of that training uses the file — hidden, removed or purged → no access
create or replace function lec_private.file_readable(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.lec_posts x where x.training_code = split_part(p_name, '/', 1) and not x.hidden and strpos(x.files::text, p_name) > 0)
$$;
create or replace function lec_private.trashed(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from lec_private.file_trash where path = p_name)
$$;
create or replace function lec_private.delete_allowed(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select lec_private.trashed(p_name)
$$;

-- ---------------------------------------------------------------- privileges
-- Tables: nothing for the API roles except column-level SELECT on readable collections (RLS still applies).
revoke all on all tables in schema lec_private from public, anon, authenticated;
revoke all on public.lec_participants, public.lec_attendance, public.lec_progress, public.lec_help, public.lec_questions, public.lec_posts,
              public.lec_polls, public.lec_answers, public.lec_survey, public.lec_chat, public.lec_state, public.lec_tombstones
  from public, anon, authenticated;
grant select (id, training_code, text, nickname, anonymous, votes, status, pinned, cid, rev, created_at, updated_at) on public.lec_questions to anon, authenticated;
grant select (id, training_code, by, kind, text, nickname, files, license, likes, hidden, cid, rev, created_at, updated_at) on public.lec_posts to anon, authenticated;
-- L3: who asked for help, who is stuck and who answered what stays with the instructor (no `by` for anon)
revoke select (by) on public.lec_help, public.lec_progress, public.lec_answers from anon, authenticated;
grant select (id, training_code, nickname, station, seat, message, status, assignee, cid, rev, created_at, updated_at) on public.lec_help to anon, authenticated;
grant select (id, training_code, station, status, at, rev, created_at, updated_at) on public.lec_progress to anon, authenticated;
grant select (id, training_code, question, kind, options, open, rev, created_at, updated_at) on public.lec_polls to anon, authenticated;
grant select (id, training_code, poll, value, rev, created_at, updated_at) on public.lec_answers to anon, authenticated;
grant select (id, training_code, by, nickname, text, hidden, cid, rev, created_at, updated_at) on public.lec_chat to anon, authenticated;
grant select (training_code, data, rev, updated_at) on public.lec_state to anon, authenticated;
grant select (training_code, col, id, rev) on public.lec_tombstones to anon, authenticated;

-- Functions: EXECUTE is granted to PUBLIC by default — take it away everywhere, then grant only the API.
revoke execute on all functions in schema lec_private from public, anon, authenticated;
grant execute on function lec_private.fail(int, text, text), lec_private.ms(timestamptz), lec_private.req_code(), lec_private.code(text),
                          lec_private.cur_rev(text), lec_private.upload_allowed(text), lec_private.delete_allowed(text),
                          lec_private.upload_ok(text, jsonb), lec_private.file_readable(text), lec_private.trashed(text)
  to anon, authenticated;
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'lec\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to anon, authenticated', f.sig);
  end loop;
end $$;

-- ---------------------------------------------------------------- row level security
alter table public.lec_participants enable row level security;
alter table public.lec_attendance enable row level security;
alter table public.lec_survey enable row level security;
alter table public.lec_progress enable row level security;
alter table public.lec_help enable row level security;
alter table public.lec_questions enable row level security;
alter table public.lec_posts enable row level security;
alter table public.lec_polls enable row level security;
alter table public.lec_answers enable row level security;
alter table public.lec_chat enable row level security;
alter table public.lec_state enable row level security;
alter table public.lec_tombstones enable row level security;
-- participants / attendance / survey: no policy at all → unreadable through the API (admin RPCs only)
do $$
declare tb text;
begin
  foreach tb in array array['lec_progress', 'lec_help', 'lec_questions', 'lec_posts', 'lec_polls', 'lec_answers', 'lec_chat', 'lec_state', 'lec_tombstones'] loop
    execute format('drop policy if exists "read by training code" on public.%I', tb);
    execute format('create policy "read by training code" on public.%I for select to anon, authenticated using (training_code = (select lec_private.req_code()))', tb);
  end loop;
end $$;
-- no INSERT/UPDATE/DELETE policies: writes happen only inside the SECURITY DEFINER functions above.

-- ---------------------------------------------------------------- storage (bucket + policies)
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not found — skipped bucket setup';
    return;
  end if;
  -- PRIVATE bucket (H3): files are read through signed URLs only while a visible post uses them
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('lec-uploads', 'lec-uploads', false, 20971520, array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'audio/mpeg', 'video/mp4'])
  on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  drop policy if exists "lecpage upload with ticket" on storage.objects;
  create policy "lecpage upload with ticket" on storage.objects for insert to anon, authenticated
    with check (bucket_id = 'lec-uploads' and lec_private.upload_ok(name, metadata));
  drop policy if exists "lecpage purge select" on storage.objects;
  drop policy if exists "lecpage purge delete" on storage.objects;
  drop policy if exists "lecpage read visible" on storage.objects;
  create policy "lecpage read visible" on storage.objects for select to anon, authenticated
    using (bucket_id = 'lec-uploads' and (lec_private.file_readable(name) or lec_private.trashed(name)));
  drop policy if exists "lecpage delete trash" on storage.objects;
  create policy "lecpage delete trash" on storage.objects for delete to anon, authenticated
    using (bucket_id = 'lec-uploads' and lec_private.trashed(name));
end $$;

-- ---------------------------------------------------------------- daily cleanup (pg_cron)
-- Dashboard → Integrations → Cron → enable, then re-run this file (or run the cron.schedule line yourself).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lecpage-cleanup', '17 3 * * *', 'select lec_private.cleanup()');
  else
    raise notice 'pg_cron이 꺼져 있어 자동 정리를 예약하지 않았습니다. README "보관 기간과 자동 정리"를 보세요.';
  end if;
end $$;

-- ---------------------------------------------------------------- your training (edit and run)
-- select lec_private.init_training('AB12CD', '직접-만든-관리자-키(12자 이상)', '{"retentionDays": 30}');
