// lecpage 커넥트: 내 Vercel 계정에 한 번에. 공식 Vercel CLI로 로그인(브라우저 승인)·배포·보호 풀기·삭제.
// 강사는 브라우저에서 Vercel 로그인·[Allow] 한 번만 하면 됨(vercel login, Device Flow). 그 뒤로는 앱의 버튼 하나.
//   GET    /bridge/vercel              → { ok, vc }  진행 상황(앱이 1초쯤마다 물음). 끝난 결과는 다음 일을 시작할 때까지 남음
//   POST   /bridge/vercel/draft        → { ok, draft }          올릴 사이트 파일을 받을 빈 자리
//   POST   /bridge/vercel/files?draft=<id>&path=<상대 경로>   본문: 파일 바이트 → { ok }
//   POST   /bridge/vercel/site         { draft, name, again? } → 202  사이트 올리기(https://<name>.vercel.app)
//   POST   /bridge/vercel/open         { name } → 202  이 커넥트가 올린 프로젝트의 배포 보호(Vercel Authentication) 끄기
//   POST   /bridge/vercel/answer       { team }  물음(팀이 여럿일 때 고르기)에 답
//   POST   /bridge/vercel/delete       { name } → 202  이 커넥트가 올린 프로젝트 지우기
//   POST   /bridge/vercel/logout       → 202  이 PC의 Vercel 로그인 지우기
//   DELETE /bridge/vercel              → 하던 일 멈춤(로그인 기다림 포함)
// 일 틀은 studio-deploy.mjs의 createRunner(진행·물음·결과·멈춤). 한 번에 일 하나.
// 받은 값으로 명령 인자를 짓지 않음: 이름은 NAME_RE, 경로는 safeRel, 팀은 CLI가 준 목록에서만.
// 비밀: Vercel 로그인은 CLI가 이 PC의 커넥트 폴더(<home>/vercel-cli, 본인만 읽기)에 저장. 앱·기록에 내보내지 않음.
// 실측(2026-11-23, vercel 66.6.0, 터미널 없이): `whoami --json`은 로그인 전 { loggedIn: false }, `login`은 "Visit https://vercel.com/oauth/device?user_code=…"를
// 찍고 기다림, 팀이 여럿인데 --scope가 없으면 { status: "action_required", reason: "missing_scope", choices: [{ id, name(slug) }] }.
// 시험: S.vcOpts 또는 LECPAGE_VERCEL(가짜 vercel 명령)·LECPAGE_VERCEL_URL(주소 앞부분)
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { join, resolve, dirname, sep } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { npxCommand, redact, NAME_RE } from './publish.mjs';
import { createRunner, safeRel, findJson, makeWork, writeState } from './studio-deploy.mjs';

/** 고정한 Vercel CLI 판(실측한 판). 올릴 때는 도움말의 플래그(deploy --project·--create-if-missing·--json, project protection disable --sso, project delete --confirm-name)를 다시 확인 */
export const VERCEL_VER = '66.6.0';
const MiB = 1024 * 1024;
/** Vercel 무료 한도(엔진 HOSTS.vercel과 같음): 사이트 100MB·파일 15,000개 */
export const VC_LIMIT = { fileMB: 100, files: 15000, totalMB: 100 };
const TMP = 'lecpage-studio-vc-'; // 작업 폴더 이름 앞부분(이 PC 사용자 폴더 안 work/. 공용 임시 폴더 아래에서 돌리지 않음: studio-deploy.mjs makeWork)
const ASK_MS = 10 * 60e3;
const TEAM_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

class VcError extends Error {
  constructor(code, message_ko, detail = '') { super(message_ko); this.code = code; this.message_ko = message_ko; this.detail = detail; }
}
const MSG = {
  tool: '배포 도구를 받지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.',
  network: 'Vercel에 닿지 않아요. 인터넷 연결을 확인하고 다시 시도해 주세요.',
  'login-needed': 'Vercel 로그인이 풀렸어요. 다시 누르면 로그인 창이 열려요.',
  'login-failed': 'Vercel 로그인을 끝내지 못했어요. 다시 누르고 브라우저에서 허용해 주세요.',
  'no-team': '이 로그인으로 쓸 수 있는 Vercel 팀이 없어요. Vercel에 가입을 마친 뒤 다시 눌러 주세요.',
  limit: 'Vercel 무료 한도에 걸렸어요. 잠시 뒤 다시 시도하거나 다른 곳에 배포해 주세요.',
  cancelled: '멈췄어요.',
  timeout: '기다리는 시간이 지났어요. 다시 눌러 주세요.',
  failed: 'Vercel에서 끝내지 못했어요. 잠시 뒤 다시 시도해 주세요.',
};
const tail = (s, n = 6) => String(s || '').trim().split('\n').filter(Boolean).slice(-n).map((l) => l.slice(0, 200)).join('\n');
/** 사람 이름·메일이 섞일 수 있는 출력에서 토큰·메일 모양을 가림(기록·앱에 그대로 내보내지 않게) */
const clean = (s) => redact(String(s || '')).replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '***').replace(/user_code=[A-Za-z0-9-]+/g, 'user_code=***');
/** CLI가 실패한 까닭을 강사가 할 일로 */
export function explain(raw, fallback = 'failed') {
  const s = String(raw || '');
  const code = /npm (ERR|error)|could not determine executable|E404|ENOENT[^\n]*npx|not recognized as an internal|command not found/i.test(s) ? 'tool'
    : /No existing credentials|not authenticated|not logged in|invalid token|token is not valid|Please (log ?in|run `?vercel login)|must re-authenticate|\binvalidToken\b|401 Unauthorized|\b(status|code|HTTP)\b[^\n]{0,12}\b401\b/i.test(s) ? 'login-needed'
      : /ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|EAI_AGAIN|fetch failed|socket hang up|getaddrinfo|network (error|timeout|is unreachable)|UND_ERR_/i.test(s) ? 'network'
        : /rate.?limit|too many requests|429 Too Many|\b(status|code|HTTP)\b[^\n]{0,12}\b429\b|(limit|quota)[^\n]{0,40}\bexceeded\b|\bexceeded\b[^\n]{0,40}(limit|quota)|upgrade to (pro|a paid)/i.test(s) ? 'limit'
          : fallback;
  return new VcError(code, MSG[code] || MSG.failed, clean(tail(s)));
}

const stateFile = (S) => join(S.home, 'vercel.json');
export function loadVcState(S) { try { const j = JSON.parse(readFileSync(stateFile(S), 'utf8')); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch { return {}; } }
function saveVcState(S, st) { writeState(stateFile(S), st); }
/**
 * 이 커넥트가 올린 프로젝트 기록 → [{ name, team, owner, user }].
 * team: 올릴 때 쓴 팀(--scope, 하나뿐이라 CLI가 저절로 고른 경우 '') · owner: 그 프로젝트가 든 계정 id(프로젝트 정보의 accountId) · user: 올린 로그인(짧은 해시).
 * 지우기·보호 끄기는 이 범위로만 부름: 기억한 팀이 그사이 바뀌어도 다른 팀에서 '없음'을 보고 지운 것으로 끝내지 않게.
 * 이름 글자만 있는 기록은 팀·계정·로그인을 모르는 것으로 읽음(지금 고른 팀이 없을 때만 그 '없음'을 믿음: askedThere)
 */
export function sitesOf(st) {
  return (Array.isArray(st?.sites) ? st.sites : []).map((x) => (typeof x === 'string' ? { name: x, team: '', owner: '', user: '' }
    : x && typeof x === 'object' && typeof x.name === 'string' ? { name: x.name, team: TEAM_RE.test(String(x.team || '')) ? String(x.team) : '', owner: String(x.owner || '').slice(0, 80), user: String(x.user || '').slice(0, 32) } : null)).filter((x) => x && NAME_RE.test(x.name));
}
/** 그 로그인(user)이 올린 그 이름의 기록(로그인을 모르는 예전 기록은 누구에게나 맞음) */
const siteOf = (st, name, user) => sitesOf(st).find((x) => x.name === name && (!x.user || !user || x.user === user)) || null;
/** 이 커넥트 전용 Vercel CLI 설정 폴더(만들지 않고 자리만) */
const cfgDir = (S) => join(S.home, 'vercel-cli');
/** 그 폴더의 로그인 파일에 토큰이 있는지(파일이 있는데 읽지 못하면 있는 것으로 봄) */
function vcToken(S) {
  const f = join(cfgDir(S), 'auth.json');
  if (!existsSync(f)) return false;
  try { const j = JSON.parse(readFileSync(f, 'utf8')); return !!(j && typeof j === 'object' && typeof j.token === 'string' && j.token); } catch { return true; }
}
/** 이 커넥트 폴더에서 Vercel CLI가 한 번이라도 돈 적이 있는지: CLI는 처음 돌 때 설정 폴더에 파일(config.json 등)을 씀(실측, vercel 66.6.0). 비어 있으면 지울 로그인도 없음 */
function vcEverRan(S) { try { return readdirSync(cfgDir(S)).length > 0; } catch { return false; } }
/**
 * 이 PC의 커넥트에 Vercel 로그인이 남아 있을 수 있는지(도구를 실행하지 않고 파일로만): /bridge/status의 hosts.vercel.
 * 앱의 [모든 데이터 삭제]가 다른 브라우저에서 한 로그인도 지우게 알림. 로그인 파일의 토큰, 이 커넥트가 로그인을 쓰고 있다는 표시(login), 기억한 팀 가운데 하나라도 있으면 true
 */
export function vcHost(S) {
  const st = loadVcState(S);
  return vcToken(S) || st.login === true || !!st.team;
}
const userTag = (j) => { const id = String(j?.username || j?.email || j?.user?.username || j?.user?.email || ''); return id ? createHash('sha256').update(id).digest('hex').slice(0, 16) : ''; };

export function createVc(S, H) {
  const R = createRunner(S, H, { tmp: TMP, errorOf: (e) => (e instanceof VcError ? { code: e.code, message_ko: e.message_ko, ...(e.detail ? { detail: e.detail } : {}) } : null), cancelled: () => new VcError('cancelled', MSG.cancelled), timeout: () => new VcError('timeout', MSG.timeout), failed: MSG.failed });
  const c = { draft: null, get task() { return R.task; } };
  const log = (l) => { try { S.log?.(l); } catch { /* 넘김 */ } };
  const opts = () => S.vcOpts || (process.env.LECPAGE_VERCEL ? { vercel: process.env.LECPAGE_VERCEL, urlBase: process.env.LECPAGE_VERCEL_URL || '', open: false } : {});
  /** CLI가 로그인·설정을 두는 폴더(이 커넥트 전용: 강사가 따로 쓰는 Vercel CLI 로그인은 건드리지 않음) */
  const cfg = () => { const d = cfgDir(S); mkdirSync(d, { recursive: true, mode: 0o700 }); return d; };
  const { stop, phase, ask } = R;

  /** vercel 한 번: 가짜(시험) 또는 고정 판 npx. 늘 비대화형(--non-interactive), 이 커넥트의 설정 폴더(-Q) */
  function vc(t, argv, o = {}) {
    const f = opts();
    const all = [...argv, '--non-interactive', '--no-color', '-Q', cfg(), ...(t.scope && o.scoped !== false ? ['--scope', t.scope] : [])];
    const n = f.vercel ? { cmd: process.execPath, args: [f.vercel, ...all], opts: {} } : npxCommand(['--yes', `vercel@${VERCEL_VER}`, ...all]);
    return R.exec(t, n.cmd, n.args, { ...o, spawnOpts: n.opts, env: { VERCEL_TELEMETRY_DISABLED: '1', NO_COLOR: '1', FORCE_COLOR: '0', NO_UPDATE_NOTIFIER: '1' } });
  }
  const jsonOf = (r) => findJson(r.stdout) || findJson(r.raw);
  /** 팀이 여럿인데 고르지 않아 CLI가 되물은 답인지 → 고를 팀 목록 [{ id, name }] 또는 null */
  const scopeAsk = (j) => (j && j.reason === 'missing_scope' ? (Array.isArray(j.choices) ? j.choices : []).filter((x) => x && TEAM_RE.test(String(x.name || ''))).map((x) => ({ id: String(x.name), name: String(x.name).slice(0, 100) })) : null);

  async function whoami(t) {
    const r = await vc(t, ['whoami', '--json'], { timeout: 6 * 60e3, scoped: false }); // 처음에는 npx가 CLI(약 220MB)를 받느라 1~2분
    stop(t);
    const j = jsonOf(r);
    if (j && j.loggedIn === false) return { loggedIn: false };
    if (j && (j.username || j.email || j.loggedIn === true)) return { loggedIn: true, user: userTag(j) };
    const e = explain(r.raw, 'tool');
    if (e.code === 'login-needed') return { loggedIn: false };
    throw e;
  }
  async function login(t) {
    phase(t, 'login');
    log('Vercel 로그인을 기다려요(브라우저에서 허용)');
    const o = opts();
    const r = await vc(t, ['login'], {
      timeout: ASK_MS, scoped: false,
      onLine: (l) => {
        if (t.loginUrl) return;
        const m = l.match(/https?:\/\/\S+/);
        if (!m || !/\/oauth\/device\b/.test(m[0])) return;
        if (!o.vercel && !m[0].startsWith('https://vercel.com/')) return; // 실제 판에서는 Vercel 주소만 엶
        t.loginUrl = m[0];
        if (o.open !== false) Promise.resolve(H.openBrowser(t.loginUrl)).then((ok) => { if (!ok) log('브라우저를 열지 못했어요. lecpage 화면의 [로그인 창 열기]를 눌러 주세요.'); }, () => { });
      },
    });
    t.loginUrl = '';
    stop(t);
    if (!r.ok) { if (/ETIMEDOUT$/.test(r.raw.trim())) throw new VcError('timeout', MSG.timeout); const e = explain(r.raw, 'login-failed'); throw e.code === 'login-needed' ? new VcError('login-failed', MSG['login-failed'], e.detail) : e; }
  }
  /** 로그인까지. 팀은 기억한 것이 있으면 그것(없으면 CLI가 하나뿐인 팀을 저절로 고르고, 여럿이면 되물음 → scoped가 처리) */
  async function auth(t) {
    phase(t, 'tool');
    let who = await whoami(t);
    if (!who.loggedIn) { await login(t); phase(t, 'tool'); who = await whoami(t); if (!who.loggedIn) throw new VcError('login-failed', MSG['login-failed']); }
    const st = loadVcState(S);
    // 이 커넥트가 이 PC의 Vercel 로그인을 쓰고 있음(logout이 지움): 앱이 [모든 데이터 삭제] 때 지울 로그인이 있는지 알 수 있게(status의 hosts)
    if (st.login !== true) { st.login = true; saveVcState(S, st); }
    t.user = who.user || '';
    t.scope = TEAM_RE.test(String(st.team || '')) ? st.team : '';
    t.remember = true; // 팀을 물어 고르면 다음에도 쓰게 기억(이미 올린 프로젝트를 찾느라 고른 팀은 기억하지 않음: withRecord)
  }
  /** 이미 올린 프로젝트(rec)를 다루는 일: 그 프로젝트를 올린 팀으로 부름. 팀을 모르는 기록이면 지금 범위로 부르되, 물어 고른 팀은 기억하지 않음 */
  function withRecord(t, rec) { if (rec.team) t.scope = rec.team; else t.remember = false; }
  /** 프로젝트 정보(pj)가 기록(rec)의 그 프로젝트인지: 둘 다 계정 id를 알면 같아야 함 */
  const sameProject = (rec, pj) => !(rec.owner && pj.owner && rec.owner !== pj.owner);
  /** '없음'을 믿어도 되는지: 그 프로젝트를 올린 팀에서 물었을 때만(팀을 모르는 기록은 지금도 팀을 고르지 않은 채일 때만) */
  const askedThere = (t, rec) => (rec.team ? t.scope === rec.team : !t.scope);
  const elsewhere = (name) => new VcError('other-scope', `"${name}" 프로젝트를 올린 팀에서 찾지 못했어요. 올릴 때 쓴 Vercel 팀을 골라 다시 눌러 주세요. 그래도 안 되면 Vercel 대시보드에서 프로젝트를 지워 주세요.`);
  /** 팀 범위가 필요한 명령 한 번. 팀이 여럿이면 앱에 물어 기억한 뒤 다시. → { r, j } */
  async function scoped(t, argv, o = {}) {
    for (let i = 0; i < 3; i++) {
      const r = await vc(t, argv, o);
      stop(t);
      const j = jsonOf(r);
      const teams = scopeAsk(j);
      if (!teams) return { r, j };
      if (!teams.length) throw new VcError('no-team', MSG['no-team']);
      const back = t.phase;
      const pick = String(await ask(t, { kind: 'team', teams }) || '');
      if (!teams.some((x) => x.id === pick)) throw new VcError('failed', MSG.failed);
      t.scope = pick;
      if (t.remember !== false) { const st = loadVcState(S); st.team = pick; saveVcState(S, st); }
      phase(t, back === 'team' ? 'tool' : back);
    }
    throw new VcError('failed', MSG.failed);
  }
  /** 프로젝트 정보(REST 모양 그대로). → { exists, id, sso, hosts } */
  async function project(t, name) {
    const { r, j } = await scoped(t, ['api', `/v9/projects/${name}`]);
    if (j && j.id && j.name) return { exists: true, id: String(j.id), owner: String(j.accountId || ''), sso: !!j.ssoProtection, hosts: (Array.isArray(j.targets?.production?.alias) ? j.targets.production.alias : []).map(String) };
    const code = String(j?.error?.code || '');
    const none = { exists: false, id: '', owner: '', sso: false, hosts: [] };
    if (code === 'not_found' || Number(j?.error?.status) === 404) return none;
    // 도구를 못 받음·망·로그인 문제는 '없음'이 아님(npm의 404나 "command not found" 같은 글을 '프로젝트 없음'으로 읽지 않게) → 먼저 가려 던짐
    const e = explain(`${j?.error?.message || j?.message || ''}\n${r.raw}`);
    if (e.code !== 'failed') throw e;
    if (/\b404\b|not[ _]found/i.test(`${j?.error?.message || ''} ${r.raw}`)) return none;
    throw e; // 로그인이 풀렸으면 다음에 누를 때 whoami가 로그인 전으로 답해 로그인 창부터
  }
  /** 그 주소에 lecpage가 조립한 사이트가 있는지(첫 화면의 generator 표시). 닿지 못하거나 로그인 창이 뜨면 false */
  async function lecpageSite(url) {
    try {
      const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8000) });
      if (!r.ok) return false;
      return /<meta\s+name="generator"\s+content="lecpage[ "]/i.test((await r.text()).slice(0, 200000));
    } catch { return false; }
  }
  async function reach(url, tries, want = (r) => r.ok) {
    for (let i = 0; i < tries; i++) {
      if (R.task?.cancelled) return false;
      try { const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8000) }); if (want(r)) return true; } catch { /* 아직 */ }
      if (i < tries - 1) await new Promise((r) => setTimeout(r, opts().vercel ? 50 : 3000));
    }
    return false;
  }
  /** 로그인 없이 열리게: Vercel Authentication(SSO 보호) 끄기. → 풀렸는지 */
  async function unprotect(t, name) {
    const { r } = await scoped(t, ['project', 'protection', 'disable', name, '--sso', '--json']);
    if (!r.ok) { log('Vercel 배포 보호를 끄지 못했어요'); return false; }
    return !(await project(t, name)).sso;
  }

  /** 사이트: 받아 둔 파일(draft)을 Vercel 프로젝트(이름 = 주소 이름)의 운영 배포로. 이 커넥트가 올린 적 없는 이름이 계정에 이미 있으면 덮지 않음 */
  async function site(t, { draft, name, again }) {
    const d = c.draft;
    if (!d || d.id !== draft || !existsSync(join(d.dir, 'index.html'))) throw new VcError('no-files', '올릴 사이트 파일이 없어요. 다시 눌러 주세요.');
    d.busy = true;
    await auth(t);
    phase(t, 'site');
    const rec = siteOf(loadVcState(S), name, t.user);
    if (rec?.team) { t.scope = rec.team; t.remember = false; } // 이 커넥트가 올린 프로젝트면 올렸던 팀에 다시(기억한 팀이 그사이 바뀌어도 같은 주소로. 기억한 팀은 그대로 둠)
    const before = await project(t, name);
    const mine = !!rec && sameProject(rec, before);
    // 이 커넥트가 올린 적 없는 이름이 내 Vercel에 이미 있으면 덮지 않음. '같은 주소로 다시'(again)여도 그 주소에 lecpage 사이트가 있을 때만 덮음:
    // 앱의 기록(남이 준 연수 파일에도 들어 있을 수 있음)만 믿고 강사의 다른 프로젝트를 덮지 않게
    if (before.exists && !mine) {
      if (!again) throw new VcError('name-taken', `내 Vercel에 "${name}"이라는 프로젝트가 이미 있어요. 다른 주소 이름을 적어 주세요.`);
      const at = before.hosts.find((h) => h === `${name}.vercel.app`) || before.hosts.find((h) => /^[a-z0-9.-]+\.vercel\.app$/i.test(h)) || `${name}.vercel.app`;
      if (!(await lecpageSite(opts().urlBase ? `${opts().urlBase}${name}/` : `https://${at}/`))) throw new VcError('exists', `내 Vercel에 "${name}"이라는 프로젝트가 이미 있는데, lecpage로 올린 사이트인지 확인하지 못해 덮어쓰지 않았어요. 다른 주소 이름으로 배포해 주세요.`);
    }
    stop(t);
    const { r: dep, j } = await scoped(t, ['deploy', d.dir, '--prod', '--yes', '--project', name, '--create-if-missing', '--json'], { timeout: 20 * 60e3 });
    if (!dep.ok) {
      const m = String(j?.message || j?.error?.message || '');
      const e = explain(`${m}\n${dep.raw}`);
      throw e.code === 'failed' && m ? new VcError('failed', MSG.failed, clean(m.slice(0, 300))) : e;
    }
    const out = j?.deployment && typeof j.deployment === 'object' ? j.deployment : j || {};
    if (out.readyState && out.readyState !== 'READY') throw new VcError('failed', MSG.failed, clean(String(out.error?.message || out.readyState).slice(0, 200)));
    log('Vercel에 사이트를 올렸어요');
    // 참가자에게 줄 주소는 프로젝트 주소(<이름>.vercel.app). 배포마다 생기는 주소는 로그인이 걸릴 수 있어 쓰지 않음(앱의 토큰 길과 같은 규칙)
    let pj = { exists: false, id: '', owner: '', sso: false, hosts: [] };
    let pjError = null;
    try { pj = await project(t, name); } catch (e) { pjError = e; }
    // 올린 기록: 이름 + 올린 팀·계정·로그인(지우기·보호 끄기를 그 범위로만 하게). 프로젝트 정보를 못 읽었어도 기록은 남김(지울 수 있게)
    const st = loadVcState(S);
    st.sites = [...sitesOf(st).filter((x) => !(x.name === name && (!x.user || !t.user || x.user === t.user))), { name, team: t.scope || '', owner: pj.owner || rec?.owner || '', user: t.user || '' }];
    if (t.scope && t.remember !== false) st.team = t.scope;
    saveVcState(S, st);
    if (pjError) throw pjError;
    let opened = false;
    if (pj.sso && !before.exists) { opened = await unprotect(t, name); if (opened) pj = { ...pj, sso: false }; }
    const prod = String(out.productionUrl || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const hosts = [...pj.hosts, prod].filter((h) => /^[a-z0-9.-]+\.vercel\.app$/i.test(h));
    const host = hosts.find((h) => h === `${name}.vercel.app`) || hosts.sort((a, b) => a.length - b.length)[0] || `${name}.vercel.app`;
    const url = opts().urlBase ? `${opts().urlBase}${name}/` : `https://${host}/`;
    phase(t, 'wait');
    const ready = await reach(url, 10);
    dropDraft();
    return { site: { url, name, projectId: pj.id, opened, protected: pj.sso, ready } };
  }
  /** 이미 올린 프로젝트에 로그인 창이 뜰 때: 배포 보호 끄기 */
  async function open(t, { name }) {
    await auth(t);
    phase(t, 'open');
    const rec = siteOf(loadVcState(S), name, t.user);
    if (!rec) throw new VcError('not-ours', '이 PC의 lecpage 커넥트로 배포한 사이트가 아니라 여기서 바꿀 수 없어요. Vercel 대시보드에서 Deployment Protection을 꺼 주세요.');
    withRecord(t, rec);
    const pj = await project(t, name);
    if (pj.exists && !sameProject(rec, pj)) throw elsewhere(name);
    if (!pj.exists) throw askedThere(t, rec) ? new VcError('gone', '내 Vercel에 이 프로젝트가 없어요. 다시 배포해 주세요.') : elsewhere(name);
    if (!pj.sso) return { opened: true, already: true };
    if (!(await unprotect(t, name))) throw new VcError('failed', 'Vercel의 배포 보호를 끄지 못했어요. Vercel 대시보드의 Settings → Deployment Protection에서 Vercel Authentication을 꺼 주세요.');
    return { opened: true };
  }
  /** 지우기: 이 커넥트가 올린 프로젝트만 */
  async function remove(t, { name }) {
    await auth(t);
    phase(t, 'delete');
    const rec = siteOf(loadVcState(S), name, t.user);
    if (!rec) throw new VcError('not-ours', '이 PC의 lecpage 커넥트로 배포한 사이트가 아니라 여기서 지울 수 없어요. Vercel 대시보드에서 프로젝트를 지워 주세요.');
    withRecord(t, rec); // 올렸던 팀에서 찾음
    const pj = await project(t, name);
    // 같은 이름의 다른 프로젝트(다른 팀의 것)는 지우지 않음. '이미 없음'은 올렸던 팀에서 물었을 때만 믿음(다른 팀에서 본 '없음'을 지운 것으로 끝내지 않게)
    if (pj.exists && !sameProject(rec, pj)) throw elsewhere(name);
    if (!pj.exists && !askedThere(t, rec)) throw elsewhere(name);
    if (pj.exists) {
      const { r, j } = await scoped(t, ['project', 'delete', name, '--confirm-name', name]);
      if (!r.ok && (await project(t, name)).exists) throw explain(`${j?.message || ''}\n${r.raw}`);
    }
    const st = loadVcState(S); st.sites = sitesOf(st).filter((x) => x !== rec && !(x.name === rec.name && x.team === rec.team && x.owner === rec.owner && x.user === rec.user)); saveVcState(S, st);
    log('Vercel에서 사이트를 지웠어요');
    return { deleted: name };
  }
  /** 이 PC의 Vercel 로그인 지우기(커넥트 전용 폴더의 것). 기억한 팀도 지움. 올린 프로젝트 기록은 올린 로그인과 함께 남아, 다른 로그인으로는 다루지 못함 */
  async function logout(t) {
    phase(t, 'tool');
    const f = join(cfgDir(S), 'auth.json');
    const forget = (login) => { const st = loadVcState(S); if (!('team' in st) && !(login && 'login' in st)) return; delete st.team; if (login) delete st.login; saveVcState(S, st); };
    // 이 커넥트 폴더에서 CLI가 돈 적이 없으면 지울 로그인이 없음: 로그아웃하려고 CLI(약 220MB)를 새로 받지 않고 바로 끝냄
    if (!vcEverRan(S)) { forget(true); return { loggedOut: true }; }
    const r = await vc(t, ['logout'], { scoped: false });
    // CLI가 끝냈는지와 상관없이 이 커넥트 전용 폴더의 로그인 파일을 지움(도구를 못 받았거나 망이 끊겨도 이 PC에는 남지 않게)
    try { rmSync(f, { force: true }); } catch { /* 아래에서 확인 */ }
    const left = !r.ok && !/not (currently )?logged in|No existing credentials/i.test(r.raw) && existsSync(f);
    forget(!left); // 로그인 파일이 남았으면 login 표시도 남김(앱이 '지우지 못했어요'로 알림)
    if (left) throw explain(r.raw);
    return { loggedOut: true };
  }
  function dropDraft() { const d = c.draft; c.draft = null; if (d) { try { rmSync(d.dir, { recursive: true, force: true }); } catch { /* 넘김 */ } } }

  const RUN = { site, open, delete: remove, logout };
  /** 일 하나 시작(이미 돌고 있으면 { busy: true }) */
  c.start = (kind, body) => R.start(kind, (t) => RUN[kind](t, body), { onEnd: () => { if (kind === 'site' && c.draft) c.draft.busy = false; } });
  c.answer = (o) => R.answer((q) => (q.kind === 'team' && q.teams.some((x) => x.id === o.team) ? { value: String(o.team) } : null));
  c.cancel = R.cancel;
  c.newDraft = () => {
    if (c.draft?.busy) return null;
    dropDraft();
    c.draft = { id: randomBytes(8).toString('hex'), dir: makeWork(S, `${TMP}site-`, { tool: false }), files: 0, bytes: 0, busy: false };
    return c.draft;
  };
  /** 사이트 파일 하나 받기 → '' | 오류 코드 */
  c.put = (id, rel, bytes) => {
    const d = c.draft;
    if (!d || d.id !== id || d.busy) return 'no-draft';
    const p = safeRel(rel);
    if (!p) return 'bad-path';
    const to = resolve(d.dir, p);
    if (!to.startsWith(resolve(d.dir) + sep)) return 'bad-path';
    if (d.files + 1 > VC_LIMIT.files || d.bytes + bytes.length > VC_LIMIT.totalMB * MiB) return 'too-large';
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, bytes);
    d.files++; d.bytes += bytes.length;
    return '';
  };
  /** 앱에 보일 상태(로그인 정보 없는 것만) */
  c.view = () => R.view();
  return c;
}

/** /bridge/vercel/* (studio.mjs handleBridge가 넘김. 출처·토큰 확인은 이미 지남) */
export async function handleVercel(S, req, res, url, parts, H) {
  const { readBody, sendJson, fail } = H;
  const c = S.vc || (S.vc = createVc(S, H));
  const sub = parts[1] || '';
  if (parts.length > 2) return fail(res, 404, 'not-found', '없는 주소예요.');
  if (!sub && req.method === 'GET') return sendJson(res, 200, { ok: true, vc: c.view() });
  if (!sub && req.method === 'DELETE') { await c.cancel(); return sendJson(res, 200, { ok: true, vc: c.view() }); }
  if (req.method !== 'POST') return fail(res, 405, 'method', '이 주소에서 받지 않는 요청이에요.');
  if (sub === 'files') {
    let bytes;
    try { bytes = await readBody(req, VC_LIMIT.fileMB * MiB); } catch (e) { return e.status === 413 ? fail(res, 413, 'too-large', `파일 하나는 ${VC_LIMIT.fileMB}MB까지 올릴 수 있어요.`) : fail(res, 400, 'bad-request', '파일을 받지 못했어요.'); }
    const bad = c.put(String(url.searchParams.get('draft') || ''), url.searchParams.get('path'), bytes);
    if (bad) return bad === 'too-large' ? fail(res, 413, bad, `사이트가 너무 커요(파일 ${VC_LIMIT.files.toLocaleString('en-US')}개·모두 합쳐 ${VC_LIMIT.totalMB}MB까지).`) : fail(res, bad === 'no-draft' ? 409 : 400, bad, bad === 'no-draft' ? '올릴 자리가 없어요. 다시 눌러 주세요.' : '받을 수 없는 파일 이름이에요.');
    return sendJson(res, 200, { ok: true });
  }
  let o = {};
  try { o = JSON.parse((await readBody(req, 65536)).toString('utf8') || '{}'); } catch { return fail(res, 400, 'bad-json', '요청 본문을 JSON으로 읽지 못했어요.'); }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return fail(res, 400, 'bad-request', '요청 본문이 JSON 객체가 아니에요.');
  if (sub === 'answer') return c.answer(o) ? sendJson(res, 200, { ok: true, vc: c.view() }) : fail(res, 409, 'not-waiting', '기다리는 물음이 없어요.', { vc: c.view() });
  if (sub === 'draft') { const d = c.newDraft(); return d ? sendJson(res, 200, { ok: true, draft: d.id }) : fail(res, 409, 'busy', '다른 배포가 돌고 있어요. 끝난 뒤에 다시 해 주세요.', { vc: c.view() }); }
  let body = null;
  if (sub === 'site' || sub === 'delete' || sub === 'open') {
    const name = String(o.name || '').toLowerCase();
    if (!NAME_RE.test(name)) return fail(res, 400, 'bad-name', '주소 이름은 영문 소문자·숫자·하이픈으로 63자까지예요.');
    body = sub === 'site' ? { draft: String(o.draft || ''), name, again: o.again === true } : { name };
  } else if (sub === 'logout') body = {};
  else return fail(res, 404, 'not-found', '없는 주소예요.');
  const r = c.start(sub, body);
  if (r.busy) return fail(res, 409, 'busy', '다른 배포가 돌고 있어요. 끝난 뒤에 다시 해 주세요.', { vc: c.view() });
  return sendJson(res, 202, { ok: true, vc: c.view() });
}
