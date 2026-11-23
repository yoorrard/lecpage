// lecpage 커넥트: 내 Cloudflare 계정에 한 번에. 사이트(Workers 정적 자산)와 참여 기능 서버(backends/cloudflare)를 wrangler로 올림.
// 강사는 브라우저에서 Cloudflare 로그인·[Allow] 한 번만 하면 됨(wrangler login). 그 뒤로는 앱의 버튼 하나.
//   GET    /bridge/cloudflare              → { ok, cf }  진행 상황(앱이 1초쯤마다 물음). 끝난 결과는 다음 일을 시작할 때까지 남음(앱을 닫았다 열어도 봄)
//   POST   /bridge/cloudflare/relay        { adminKey, rotate? } → 202  참여 기능 서버(계정에 하나, 이름 lecpage-live). 있으면 그대로 씀
//   POST   /bridge/cloudflare/draft        → { ok, draft }          올릴 사이트 파일을 받을 빈 자리
//   POST   /bridge/cloudflare/files?draft=<id>&path=<상대 경로>   본문: 파일 바이트 → { ok }
//   POST   /bridge/cloudflare/site         { draft, name, again? } → 202  사이트 올리기(https://<name>.<계정>.workers.dev)
//   POST   /bridge/cloudflare/answer       { account } | { subdomain }  물음(계정 고르기·새 계정의 workers.dev 이름)에 답
//   POST   /bridge/cloudflare/delete       { name, relay? } → 202  이 커넥트가 올린 사이트 지우기(relay: 참여 기능 서버도)
//   POST   /bridge/cloudflare/logout       → 202  이 PC의 Cloudflare 로그인 지우기
//   DELETE /bridge/cloudflare              → 하던 일 멈춤(로그인 기다림 포함)
// 한 번에 일 하나. 받은 값으로 명령 인자를 짓지 않음: 이름은 NAME_RE, 경로는 safeRel, 계정은 whoami가 준 목록에서만.
// 비밀: 관리자 키는 wrangler의 표준 입력으로만, Cloudflare 토큰은 이 프로그램 안에서만(앱·기록에 내보내지 않음).
// 관리자 키는 이 PC 사용자 폴더(cloudflare.json, 본인만 읽기)에 두어 같은 PC의 다른 브라우저에서도 그대로 씀. logout이 지움.
// 작업 폴더: 이 PC 사용자 폴더 안 work/(본인만 드나듦). 공용 임시 폴더(/tmp) 아래에서 돌리면 npm·wrangler가 위쪽 폴더의
//   node_modules·.npmrc·wrangler.toml을 읽어 같은 PC의 다른 계정이 심어 둔 코드가 돌 수 있음(실측: 위쪽 wrangler.toml의 [build] command가 실행됨).
//   그래서 작업 폴더마다 빈 package.json(npm이 여기서 멈춤)과 빈 wrangler.toml(wrangler가 여기서 멈춤)을 둠.
// 시험: S.cfOpts 또는 LECPAGE_WRANGLER(가짜 wrangler) + LECPAGE_CF_API(가짜 API)·LECPAGE_CF_URL(주소 앞부분)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, mkdtempSync, chmodSync, renameSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { npxCommand, prepareRelay, findUrl, redact, NAME_RE, WRANGLER_VER } from './publish.mjs';

export const RELAY_NAME = 'lecpage-live';
const API = 'https://api.cloudflare.com/client/v4';
const MiB = 1024 * 1024;
/** Cloudflare 정적 자산 한도(파일 20,000개·파일당 25MiB)와 받는 양의 위쪽 끝 */
export const CF_LIMIT = { fileMB: 25, files: 20000, totalMB: 1024 };
const TMP = 'lecpage-studio-cf-'; // 작업 폴더 이름 앞부분(work/ 안. 켤 때 6시간 넘은 것을 지움: cleanWork)
const ASK_MS = 10 * 60e3;
const AUTH_KEEP_MS = 5 * 60e3;
const EXIT_GRACE_MS = 3000; // 프로세스가 끝난 뒤 남은 출력을 기다리는 시간
const KILL_GRACE_MS = 5000; // 시간 한도로 끈 뒤 끝나기를 기다리는 시간

class CfError extends Error {
  constructor(code, message_ko, detail = '') { super(message_ko); this.code = code; this.message_ko = message_ko; this.detail = detail; }
}
const MSG = {
  tool: '배포 도구를 받지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.',
  network: 'Cloudflare에 닿지 않아요. 인터넷 연결을 확인하고 다시 시도해 주세요.',
  'login-needed': 'Cloudflare 로그인이 풀렸어요. 다시 누르면 로그인 창이 열려요.',
  'login-failed': 'Cloudflare 로그인을 끝내지 못했어요. 다시 누르고 브라우저에서 [Allow]를 눌러 주세요.',
  'login-busy': '다른 Cloudflare 로그인 창이 열려 있어요. 그 창을 닫고 다시 눌러 주세요.',
  'no-account': '이 로그인으로 쓸 수 있는 Cloudflare 계정이 없어요. Cloudflare에 가입한 뒤 다시 눌러 주세요.',
  email: 'Cloudflare 가입 메일을 아직 확인하지 않았어요. 메일함에서 Cloudflare가 보낸 확인 메일의 링크를 누른 뒤 다시 시도해 주세요.',
  'env-key': '이 PC에 Cloudflare 전역 API 키(환경 변수 CLOUDFLARE_API_KEY)가 설정돼 있어 lecpage가 쓸 수 없어요. 그 환경 변수를 지우고 lecpage 커넥트를 다시 켠 뒤 눌러 주세요. 그러면 브라우저 로그인으로 이어져요.',
  'relay-unreachable': '이 PC에서 참여 기능 서버 주소(workers.dev)가 열리지 않아요. 회사·학교·기관 망이 막았을 수 있어요. 다른 인터넷(휴대폰 핫스팟 등)에 연결한 뒤 다시 시도해 주세요.',
  'relay-down': '이 계정의 참여 기능 서버(lecpage-live)가 제대로 답하지 않아요. 잠시 뒤 다시 시도해 주세요.',
  limit: '이 Cloudflare 계정의 무료 한도에 걸렸어요. 쓰지 않는 Workers를 지우고 다시 시도해 주세요.',
  cancelled: '멈췄어요.',
  timeout: '기다리는 시간이 지났어요. 다시 눌러 주세요.',
  failed: 'Cloudflare에서 끝내지 못했어요. 잠시 뒤 다시 시도해 주세요.',
};
const tail = (s, n = 6) => String(s || '').trim().split('\n').filter(Boolean).slice(-n).map((l) => l.slice(0, 200)).join('\n');
/** Cloudflare API 오류 번호가 글에 있는지: wrangler가 찍는 꼴 "[code: 10000]"만(맨 숫자 10000은 크기·개수에도 나와 잘못 짚음) */
const apiCode = (s, n) => new RegExp(`\\[code:\\s*${n}\\]`).test(s);
/** API 답을 explain에 넘길 글로(오류 번호는 wrangler와 같은 꼴) */
const apiText = (r) => `${r.message}${r.code ? ` [code: ${r.code}]` : r.status ? ` (HTTP ${r.status})` : ''}`;
/** wrangler·API가 실패한 까닭을 강사가 할 일로 */
export function explain(raw, fallback = 'failed') {
  const s = String(raw || '');
  const code = /verify your email|email address.*verif/i.test(s) || apiCode(s, 10034) ? 'email'
    : /EADDRINUSE|address already in use.*8976/i.test(s) ? 'login-busy'
      : /not authenticated|not logged in|Authentication error|Unable to authenticate|Invalid access token|(token|login|session|credentials?)[^\n]{0,40}\bexpired\b|\bexpired\b[^\n]{0,40}(token|login|session|credentials?)/i.test(s) || apiCode(s, 10000) ? 'login-needed'
        : /npm (ERR|error)|could not determine executable|E404|ENOENT[^\n]*npx|not recognized as an internal|command not found/i.test(s) ? 'tool'
          : /ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|EAI_AGAIN|fetch failed|socket hang up|getaddrinfo|network (error|timeout|is unreachable)|UND_ERR_/i.test(s) ? 'network'
            : /exceeded the (number|limit)|limit of \d+ (workers|scripts)/i.test(s) || apiCode(s, 10037) ? 'limit'
              : fallback;
  return new CfError(code, MSG[code] || MSG.failed, redact(tail(s)));
}
const isAuthFail = (r) => r.status === 401 || r.status === 403 || r.code === 10000 || r.code === 9109;

/** 사이트 파일의 상대 경로(아니면 ''): 위로 나가기·절대 경로·윈도우가 못 쓰는 이름을 받지 않음 */
export function safeRel(p) {
  const s = String(p || '').normalize('NFC');
  if (!s || s.length > 400 || /[\u0000-\u001f\\:*?"<>|]/.test(s)) return '';
  const parts = s.split('/');
  if (parts.some((x) => !x || x === '.' || x === '..' || /^\s|[\s.]$/.test(x) || /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(x))) return '';
  return parts.join('/');
}
const stateFile = (S) => join(S.home, 'cloudflare.json');
export function loadCfState(S) { try { const j = JSON.parse(readFileSync(stateFile(S), 'utf8')); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch { return {}; } }
/** 상태 파일을 통째로 바꿔 쓰기(본인만 읽기): 임시 파일에 쓰고 이름을 바꿈 — 쓰다 꺼져도 반쯤 쓴 파일이 남지 않고, 읽는 쪽이 반쯤 쓴 것을 보지 않게 */
export function writeState(file, st) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(st), { mode: 0o600 });
    try { chmodSync(tmp, 0o600); } catch { /* 윈도우 */ }
    renameSync(tmp, file);
  } catch (e) { try { rmSync(tmp, { force: true }); } catch { /* 넘김 */ } throw e; }
}
function saveCfState(S, st) { writeState(stateFile(S), st); }

/** 작업 폴더의 뿌리(이 PC 사용자 폴더 안, 본인만 드나듦). 빈 package.json을 둬 그 아래 어디서 npm을 불러도 여기서 멈춤 */
export function workRoot(S) {
  const d = join(S.home, 'work');
  mkdirSync(d, { recursive: true, mode: 0o700 });
  try { chmodSync(d, 0o700); } catch { /* 윈도우 */ }
  const pj = join(d, 'package.json');
  if (!existsSync(pj)) writeFileSync(pj, '{"private":true}\n');
  return d;
}
/** 빈 wrangler 설정: wrangler가 위쪽 폴더의 wrangler.toml·json을 찾아 올라가지 않게(명령 인자로 이름·자산을 넘김) */
const EMPTY_WRANGLER = '# lecpage 커넥트: 위쪽 폴더의 wrangler 설정을 읽지 않게 둔 빈 설정\n';
/** 배포 도구를 돌릴 작업 폴더 하나(빈 package.json + files). 사이트 파일을 받는 자리는 tool: false(올릴 파일에 섞이지 않게) */
export function makeWork(S, prefix, { tool = true, files = {} } = {}) {
  const d = mkdtempSync(join(workRoot(S), prefix));
  if (tool) { writeFileSync(join(d, 'package.json'), '{"private":true}\n'); for (const [n, text] of Object.entries(files)) writeFileSync(join(d, n), text); }
  return d;
}
/** 켤 때: 지난 실행이 남긴 작업 폴더(6시간 넘은 것)를 지움 */
export function cleanWork(S, olderMs = 6 * 3600e3) {
  try {
    const root = join(S.home, 'work');
    for (const n of readdirSync(root)) {
      if (!n.startsWith('lecpage-studio-')) continue;
      const p = join(root, n);
      try { if (Date.now() - statSync(p).mtimeMs > olderMs) rmSync(p, { recursive: true, force: true }); } catch { /* 넘김 */ }
    }
  } catch { /* 아직 없음 */ }
}
/** 출력에서 JSON 하나 찾기(wrangler --json: 앞뒤에 알림 줄이 섞여도) */
export function findJson(out) {
  const s = String(out || '');
  const end = s.lastIndexOf('}');
  for (let i = s.indexOf('{'); i >= 0 && i < end; i = s.indexOf('{', i + 1)) {
    if (i > 0 && s[i - 1] !== '\n' && s[i - 1] !== '\r') continue;
    try { return JSON.parse(s.slice(i, end + 1)); } catch { /* 다음 후보 */ }
  }
  return null;
}

// 돌고 있는 wrangler(커넥트가 꺼질 때 함께 끔)
const live = new Set();
let hooked = false;
function hookExit() {
  if (hooked) return; hooked = true;
  process.on('exit', () => { for (const p of live) { try { if (process.platform === 'win32') p.kill(); else process.kill(-p.pid, 'SIGKILL'); } catch { /* 이미 끝남 */ } } });
}

/**
 * 오래 걸리는 일 하나(로그인 기다림·올리기)를 돌리며 앱에 진행·물음·결과를 보여 주는 틀. 배포할 곳마다 같이 쓸 수 있게 Cloudflare와 떼어 둠.
 *   start(kind, fn, { onError, onEnd }): fn(t)가 결과를 돌려주거나 오류를 던짐. 한 번에 하나(돌고 있으면 { busy: true })
 *   phase(t, 이름) · ask(t, { kind, … }) → 앱의 답 · stop(t): 멈췄으면 던짐 · exec(t, cmd, args, { cwd, input, env, timeout, onLine }) → { ok, code, raw, stdout }
 *   view(): 앱에 보일 상태 · answer(check): check(물음) → { value } | null · cancel(): 멈춤(자식 프로세스까지)
 * H: { killTree }. o: { tmp(작업 폴더 앞 이름), files({ 이름: 글 } 작업 폴더에 둘 설정 파일), errorOf(e) → { code, message_ko } | null(모르는 오류), cancelled()·timeout() → 던질 오류, failed(모르는 오류의 문구) }
 * 작업 폴더(t.cwd)는 이 PC 사용자 폴더 안 work/에 만듦(makeWork): 배포 도구가 위쪽 폴더의 것을 읽지 않게
 */
export function createRunner(S, H, o) {
  hookExit();
  const R = { task: null };
  const log = (l) => { try { S.log?.(l); } catch { /* 넘김 */ } };
  R.stop = (t) => { if (t.cancelled) throw o.cancelled(); };
  R.phase = (t, ph) => { R.stop(t); t.phase = ph; };
  R.ask = (t, q) => {
    R.stop(t); t.ask = q; t.phase = q.kind;
    return new Promise((ok, no) => {
      const timer = setTimeout(() => { t.ask = null; t.answer = null; no(o.timeout()); }, ASK_MS);
      t.answer = (v, err) => { clearTimeout(timer); t.ask = null; t.answer = null; if (err) no(err); else ok(v); };
    });
  };
  R.exec = (t, cmd, args, { cwd, input, env = {}, timeout = 10 * 60e3, onLine, spawnOpts = {} } = {}) => new Promise((ok) => {
    let p;
    try { p = spawn(cmd, args, { ...spawnOpts, cwd: cwd || t.cwd, env: { ...process.env, ...env }, windowsHide: true, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] }); }
    catch (e) { ok({ ok: false, code: -1, raw: String(e.message), stdout: '' }); return; }
    live.add(p); t.procs.add(p);
    let raw = '', stdout = '', buf = '', done = false, grace = null;
    const on = (d, isOut) => {
      if (done) return;
      const s = d.toString('utf8'); raw += s; if (isOut) stdout += s;
      if (raw.length > 4 * MiB) raw = raw.slice(-2 * MiB);
      if (stdout.length > 4 * MiB) stdout = stdout.slice(-2 * MiB);
      if (onLine) { buf += s; let i; while ((i = buf.indexOf('\n')) >= 0) { onLine(buf.slice(0, i)); buf = buf.slice(i + 1); } }
    };
    // 끝: 보통은 close(출력까지 다 받음). 손자 프로세스가 출력을 쥐고 있으면 close가 오지 않으므로 exit 뒤 잠깐만 더 기다리고 끝냄.
    // 시간 한도를 넘으면 프로세스 묶음을 끄고, 그래도 안 끝나면 기다리지 않고 끝냄(이 일이 끝없이 '도는 중'으로 남지 않게)
    const finish = (code) => {
      if (done) return; done = true;
      clearTimeout(timer); clearTimeout(grace); live.delete(p); t.procs.delete(p);
      if (onLine && buf) onLine(buf);
      try { p.stdout.destroy(); p.stderr.destroy(); } catch { /* 이미 닫힘 */ }
      ok({ ok: code === 0, code, raw, stdout });
    };
    p.stdout.on('data', (d) => on(d, true)); p.stderr.on('data', (d) => on(d, false));
    p.on('error', (e) => { raw += `\n${e.message}`; grace = grace || setTimeout(() => finish(-1), EXIT_GRACE_MS); });
    const timer = setTimeout(() => { raw += '\nETIMEDOUT'; Promise.resolve().then(() => H.killTree(p)).catch(() => { }).then(() => setTimeout(() => finish(-1), KILL_GRACE_MS)); }, timeout);
    p.on('exit', (code) => { grace = grace || setTimeout(() => finish(code ?? -1), EXIT_GRACE_MS); });
    p.on('close', (code) => finish(code ?? -1));
    p.stdin.on('error', () => { /* 먼저 끝남 */ });
    p.stdin.end(input === undefined ? '' : input);
  });
  R.start = (kind, fn, { onError, onEnd } = {}) => {
    if (R.task?.running) return { busy: true };
    const t = { id: randomBytes(6).toString('hex'), kind, running: true, phase: 'tool', startedAt: Date.now(), ask: null, answer: null, error: null, result: null, loginUrl: '', cancelled: false, procs: new Set(), cwd: makeWork(S, o.tmp, { files: o.files || {} }) };
    R.task = t;
    S.inflight = (S.inflight || 0) + 1; // 도는 동안 저절로 새 판으로 바꾸지 않게
    Promise.resolve().then(() => fn(t)).then((r) => { t.result = r; t.phase = 'done'; }, (e) => {
      const known = o.errorOf(e);
      onError?.(e);
      t.error = known || { code: 'failed', message_ko: o.failed };
      t.phase = 'error';
      if (!known) log(`배포 오류: ${String(e?.message || e).slice(0, 160)}`);
    }).finally(() => {
      t.running = false; t.ask = null; t.answer = null; t.endedAt = Date.now();
      S.inflight = Math.max(0, (S.inflight || 1) - 1);
      try { rmSync(t.cwd, { recursive: true, force: true }); } catch { /* 넘김 */ }
      onEnd?.(t);
    });
    return { started: true };
  };
  R.answer = (check) => {
    const t = R.task;
    if (!t?.running || !t.ask || !t.answer) return false;
    const a = check(t.ask);
    if (!a) return false;
    t.answer(a.value); return true;
  };
  R.cancel = async () => {
    const t = R.task;
    if (!t?.running) return;
    t.cancelled = true;
    t.answer?.(null, o.cancelled());
    await Promise.all([...t.procs].map((p) => H.killTree(p)));
    for (let i = 0; i < 100 && t.running; i++) await new Promise((r) => setTimeout(r, 30));
  };
  /** 앱에 보일 상태(비밀 없는 것만) */
  R.view = () => {
    const t = R.task;
    if (!t) return { running: false, phase: 'idle' };
    return {
      id: t.id, kind: t.kind, running: t.running, phase: t.phase, seconds: Math.round(((t.endedAt || Date.now()) - t.startedAt) / 1000),
      ...(t.loginUrl ? { loginUrl: t.loginUrl } : {}), ...(t.ask ? { ask: t.ask } : {}), ...(t.error ? { error: t.error } : {}), ...(t.result ? { result: t.result } : {}),
    };
  };
  return R;
}

export function createCf(S, H) {
  hookExit();
  const R = createRunner(S, H, { tmp: TMP, files: { 'wrangler.toml': EMPTY_WRANGLER }, errorOf: (e) => (e instanceof CfError ? { code: e.code, message_ko: e.message_ko, ...(e.detail ? { detail: e.detail } : {}) } : null), cancelled: () => new CfError('cancelled', MSG.cancelled), timeout: () => new CfError('timeout', MSG.timeout), failed: MSG.failed });
  const c = { draft: null, auth: null, get task() { return R.task; } };
  const log = (l) => { try { S.log?.(l); } catch { /* 넘김 */ } };
  const opts = () => S.cfOpts || (process.env.LECPAGE_WRANGLER ? { wrangler: process.env.LECPAGE_WRANGLER, api: process.env.LECPAGE_CF_API || '', urlBase: process.env.LECPAGE_CF_URL || '', open: false } : {});
  const urlOf = (name, sub) => (opts().urlBase ? `${opts().urlBase}${name}` : `https://${name}.${sub}.workers.dev`);

  /** wrangler 한 번: 가짜(시험) 또는 고정 판 npx. 비밀은 input(표준 입력)으로만 */
  function wr(t, argv, o = {}) {
    const f = opts();
    const n = f.wrangler ? { cmd: process.execPath, args: [f.wrangler, ...argv], opts: {} } : npxCommand(['--yes', `wrangler@${WRANGLER_VER}`, ...argv]);
    return R.exec(t, n.cmd, n.args, { ...o, spawnOpts: n.opts, env: { WRANGLER_SEND_METRICS: 'false', CI: '1', NO_COLOR: '1', FORCE_COLOR: '0', ...(t.accountId ? { CLOUDFLARE_ACCOUNT_ID: t.accountId } : {}) } });
  }
  /** Cloudflare API(이 프로그램 안의 토큰으로). → { ok, status, code, result, message } */
  async function api(t, method, path, body) {
    try {
      const r = await fetch((opts().api || API) + path, { method, headers: { authorization: `Bearer ${t.token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
      const j = await r.json().catch(() => null);
      const e = j?.errors?.[0] || {};
      return { ok: r.ok && j?.success !== false, status: r.status, code: Number(e.code) || 0, message: String(e.message || ''), result: j?.result };
    } catch (e) { return { ok: false, status: 0, code: 0, message: String(e.message || e), result: null }; }
  }
  const { stop, phase, ask } = R;
  async function whoami(t) {
    const r = await wr(t, ['whoami', '--json'], { timeout: 5 * 60e3 }); // 처음에는 npx가 wrangler를 받느라 1~2분
    stop(t);
    const j = findJson(r.stdout) || findJson(r.raw);
    if (j && typeof j.loggedIn === 'boolean') return j;
    if (/not authenticated|not logged in/i.test(r.raw)) return { loggedIn: false };
    const e = explain(r.raw, 'tool'); throw e.code === 'login-needed' ? new CfError('tool', MSG.tool, e.detail) : e;
  }
  async function login(t) {
    phase(t, 'login');
    log('Cloudflare 로그인을 기다려요(브라우저에서 [Allow])');
    const o = opts();
    const r = await wr(t, ['login', '--browser=false'], {
      timeout: ASK_MS,
      onLine: (l) => {
        if (t.loginUrl) return;
        const m = l.match(/https?:\/\/\S+/);
        if (!m || !/oauth2?\/auth/.test(m[0])) return;
        if (!o.wrangler && !m[0].startsWith('https://dash.cloudflare.com/')) return; // 실제 판에서는 Cloudflare 주소만 엶
        t.loginUrl = m[0];
        if (o.open !== false) Promise.resolve(H.openBrowser(t.loginUrl)).then((ok) => { if (!ok) log('브라우저를 열지 못했어요. lecpage 화면의 [로그인 창 열기]를 눌러 주세요.'); }, () => { });
      },
    });
    t.loginUrl = '';
    stop(t);
    if (!r.ok) { const e = explain(r.raw, 'login-failed'); throw /ETIMEDOUT$/.test(r.raw.trim()) ? new CfError('timeout', MSG.timeout) : e.code === 'login-needed' ? new CfError('login-failed', MSG['login-failed'], e.detail) : e; }
  }
  /** 로그인 → 계정 → 토큰 → workers.dev 이름까지. 끝나면 t.accountId·t.accountName·t.token·t.sub */
  async function auth(t, { needSub = true, prefer = [] } = {}) {
    const a = c.auth;
    // 잠깐 기억해 둔 로그인(연달아 누를 때 wrangler를 다시 부르지 않게). 그사이 토큰이 끝났으면 c.start가 기억을 버리고 한 번 다시 함(t.cached)
    if (a && Date.now() - a.at < AUTH_KEEP_MS && (!needSub || a.sub) && (!prefer.length || prefer.includes(a.accountId))) { Object.assign(t, { accountId: a.accountId, accountName: a.accountName, token: a.token, sub: a.sub, cached: true }); return; }
    c.auth = null; t.cached = false;
    phase(t, 'tool');
    let who = await whoami(t);
    if (!who.loggedIn) { await login(t); phase(t, 'tool'); who = await whoami(t); if (!who.loggedIn) throw new CfError('login-failed', MSG['login-failed']); }
    const accounts = (Array.isArray(who.accounts) ? who.accounts : []).filter((x) => x && /^[a-f0-9]{32}$/i.test(String(x.id || ''))).map((x) => ({ id: String(x.id), name: String(x.name || '').slice(0, 120) }));
    if (!accounts.length) throw new CfError('no-account', MSG['no-account']);
    const st = loadCfState(S);
    // prefer: 이 일이 가리키는 계정(그 사이트를 올린 계정). 이 로그인으로 쓸 수 있으면 그것, 아니면 하나뿐인 계정·기억한 계정·물어봄
    let id = prefer.find((p) => accounts.some((x) => x.id === p)) || (accounts.length === 1 ? accounts[0].id : accounts.some((x) => x.id === st.account) ? st.account : '');
    if (!id) {
      id = await ask(t, { kind: 'account', accounts });
      if (!accounts.some((x) => x.id === id)) throw new CfError('failed', MSG.failed);
      const s2 = loadCfState(S); s2.account = id; saveCfState(S, s2);
    }
    t.accountId = id; t.accountName = accounts.find((x) => x.id === id).name;
    phase(t, 'tool');
    const tk = await wr(t, ['auth', 'token', '--json']);
    stop(t);
    const tj = findJson(tk.stdout);
    // 이 명령의 출력에는 토큰·전역 API 키가 그대로 있음 → 오류의 detail(앱에 보임)에 싣지 않음
    if (tj && !tj.token && (tj.type === 'api_key' || tj.key)) throw new CfError('env-key', MSG['env-key']);
    if (!tj?.token) { const e = explain(tk.raw, 'login-needed'); throw new CfError(e.code === 'failed' ? 'login-needed' : e.code, MSG[e.code === 'failed' ? 'login-needed' : e.code] || MSG['login-needed']); }
    t.token = String(tj.token);
    if (needSub) t.sub = await subdomain(t);
    c.auth = { at: Date.now(), accountId: t.accountId, accountName: t.accountName, token: t.token, sub: t.sub || '' };
  }
  /** 계정의 workers.dev 이름. 새 계정이면 한 번 정함(wrangler는 터미널에서만 물어봄 → API로) */
  async function subdomain(t) {
    const base = `/accounts/${t.accountId}/workers/subdomain`;
    const r = await api(t, 'GET', base);
    if (r.ok && r.result?.subdomain) return String(r.result.subdomain);
    if (isAuthFail(r)) throw new CfError('login-needed', MSG['login-needed']);
    if (!(r.code === 10007 || r.status === 404)) throw explain(apiText(r), r.status ? 'failed' : 'network');
    let problem = '';
    for (let i = 0; i < 8; i++) {
      const want = String(await ask(t, { kind: 'subdomain', n: i, suggest: `lec-${randomBytes(3).toString('hex')}`, ...(problem ? { problem } : {}) }) || '').toLowerCase();
      if (!NAME_RE.test(want)) { problem = 'invalid'; continue; }
      phase(t, 'tool');
      const p = await api(t, 'PUT', base, { subdomain: want });
      if (p.ok) { log('새 Cloudflare 계정의 workers.dev 이름을 정했어요'); return String(p.result?.subdomain || want); }
      if (isAuthFail(p)) throw new CfError('login-needed', MSG['login-needed']);
      const e = explain(apiText(p), p.status ? 'failed' : 'network');
      if (e.code !== 'failed') throw e;
      problem = p.code === 10031 || /unavailable|already|taken|in use/i.test(p.message) ? 'taken' : 'failed';
    }
    throw new CfError('failed', MSG.failed);
  }
  /** 주소가 열리는지(tries번까지). last에 마지막 결과를 남김: 0 = 이 PC에서 닿지 못함(망·DNS), 그 밖은 HTTP 상태 */
  async function reach(url, tries, want = (r) => r.ok, last = {}) {
    for (let i = 0; i < tries; i++) {
      if (R.task?.cancelled) return false;
      try { const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8000) }); last.status = r.status; if (want(r)) return true; } catch { last.status = 0; }
      if (i < tries - 1) await new Promise((r) => setTimeout(r, opts().wrangler ? 50 : 3000));
    }
    return false;
  }
  /** 그 주소에 lecpage가 조립한 사이트가 있는지(첫 화면의 generator 표시). 닿지 못하면 false */
  async function lecpageSite(url) {
    try {
      const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8000) });
      if (!r.ok) return false;
      return /<meta\s+name="generator"\s+content="lecpage[ "]/i.test((await r.text()).slice(0, 200000));
    } catch { return false; }
  }
  const accState = (st, t) => { st.accounts = st.accounts && typeof st.accounts === 'object' ? st.accounts : {}; const a = st.accounts[t.accountId] = st.accounts[t.accountId] || {}; a.name = t.accountName; a.sub = t.sub; a.sites = Array.isArray(a.sites) ? a.sites : []; return a; };
  /** 스크립트가 있는지와 그 비밀 이름들. → { exists, secrets } */
  async function script(t, name) {
    const r = await api(t, 'GET', `/accounts/${t.accountId}/workers/scripts/${name}/secrets`);
    if (r.ok) return { exists: true, secrets: (Array.isArray(r.result) ? r.result : []).map((x) => String(x?.name || '')) };
    if (isAuthFail(r)) throw new CfError('login-needed', MSG['login-needed']);
    if (r.code === 10007 || r.status === 404) return { exists: false, secrets: [] };
    throw explain(apiText(r), r.status ? 'failed' : 'network');
  }

  /** 참여 기능 서버: 계정에 하나(lecpage-live). 없으면 올리고 관리자 키를 넣음. 있으면 건드리지 않음(강사가 붙인 R2 같은 설정을 덮지 않게) */
  async function relay(t, { adminKey, rotate }) {
    await auth(t);
    phase(t, 'relay');
    const url = urlOf(RELAY_NAME, t.sub);
    const st0 = loadCfState(S); const known = accState(st0, t).relay;
    const sc = await script(t, RELAY_NAME);
    const hasKey = sc.secrets.includes('ADMIN_KEY');
    // 있는 서버(스크립트 + 관리자 키)는 다시 올리지 않음: 이 PC에서 주소가 안 열리는 것(기관 망이 workers.dev를 막음·순간 오류)만으로
    // 강사가 붙인 설정(R2 등)을 덮지 않게. 다시 올리는 것은 만들다 만 것(스크립트만 있고 키가 없음)뿐
    const exists = sc.exists && hasKey;
    const dir = join(t.cwd, 'relay');
    prepareRelay(dir, RELAY_NAME, '', 30);
    let created = false;
    if (!exists) {
      stop(t);
      const dep = await wr(t, ['deploy', '-c', 'wrangler.toml'], { cwd: dir });
      stop(t);
      if (!dep.ok) throw explain(dep.raw);
      created = true;
      log('Cloudflare에 참여 기능 서버를 만들었어요');
    }
    let key = '';
    if (!hasKey || rotate) {
      if (typeof adminKey !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(adminKey)) throw new CfError('failed', MSG.failed);
      const sp = await wr(t, ['secret', 'put', 'ADMIN_KEY', '-c', 'wrangler.toml'], { cwd: dir, input: adminKey });
      stop(t);
      if (!sp.ok) throw explain(sp.raw);
      key = adminKey;
    } else if (known?.url === url && known.key) key = known.key;
    const st = loadCfState(S); const a = accState(st, t);
    if (key) a.relay = { url, key }; else if (a.relay?.url !== url) delete a.relay;
    st.account = t.accountId; saveCfState(S, st);
    phase(t, 'wait');
    const last = {};
    if (!(await reach(`${url}/api/health`, created ? 40 : 4, undefined, last))) {
      stop(t);
      if (created) throw new CfError('not-ready', '참여 기능 서버를 만들었는데 주소가 아직 열리지 않아요. 새 주소는 1~2분 걸릴 수 있어요. 잠시 뒤 다시 시도해 주세요.');
      // 있던 서버: 이 PC에서 닿지 못한 것(망)과 서버가 다르게 답한 것을 나눠 알림. 다시 올리지 않음
      throw last.status === 0 ? new CfError('relay-unreachable', MSG['relay-unreachable']) : new CfError('relay-down', MSG['relay-down']);
    }
    return { relay: { url, name: RELAY_NAME, created, ...(key ? { key } : { keyUnknown: true }) }, account: { name: t.accountName } };
  }
  /** 사이트: 받아 둔 파일(draft)을 Workers 정적 자산으로. 이 커넥트가 올린 적 없는 이름이 계정에 이미 있으면 덮지 않음 */
  async function site(t, { draft, name, again }) {
    const d = c.draft;
    if (!d || d.id !== draft || !existsSync(join(d.dir, 'index.html'))) throw new CfError('no-files', '올릴 사이트 파일이 없어요. 다시 눌러 주세요.');
    d.busy = true;
    await auth(t);
    phase(t, 'site');
    const st0 = loadCfState(S);
    const taken = () => new CfError('name-taken', `이 Cloudflare 계정에 "${name}"이라는 이름이 이미 있어요. 다른 주소 이름을 적어 주세요.`);
    if (name === RELAY_NAME) throw taken();
    // 이 커넥트가 올린 적 없는 이름이 계정에 이미 있으면 덮지 않음. '같은 주소로 다시'(again)여도 그 주소에 lecpage 사이트가 있을 때만 덮음:
    // 앱의 기록(남이 준 연수 파일에도 들어 있을 수 있음)만 믿고 강사의 다른 Worker를 덮지 않게
    if (!accState(st0, t).sites.includes(name) && (await script(t, name)).exists) {
      if (!again) throw taken();
      if (!(await lecpageSite(urlOf(name, t.sub)))) throw new CfError('exists', `이 Cloudflare 계정에 "${name}"이라는 이름이 이미 있는데, lecpage로 올린 사이트인지 확인하지 못해 덮어쓰지 않았어요. 다른 주소 이름으로 배포해 주세요.`);
    }
    stop(t);
    const dep = await wr(t, ['deploy', '--assets', d.dir, '--name', name, '--compatibility-date', new Date().toISOString().slice(0, 10)], { timeout: 20 * 60e3 });
    stop(t);
    if (!dep.ok) throw explain(dep.raw);
    const url = (opts().urlBase ? urlOf(name, t.sub) : findUrl(dep.raw, name) || urlOf(name, t.sub)).replace(/\/?$/, '/');
    const st = loadCfState(S); const a = accState(st, t);
    if (!a.sites.includes(name)) a.sites.push(name);
    st.account = t.accountId; saveCfState(S, st);
    log('Cloudflare에 사이트를 올렸어요');
    phase(t, 'wait');
    const ready = await reach(url, 20);
    dropDraft();
    return { site: { url, name, ready }, account: { name: t.accountName } };
  }
  /** 지우기: 이 커넥트가 올린 사이트만. relay면 참여 기능 서버도(다른 연수의 기록까지 지워짐 — 앱이 먼저 물음) */
  async function remove(t, { name, relay: withRelay }) {
    // 그 사이트를 올린 계정으로(계정이 여럿이고 기억한 계정이 그사이 바뀌었어도). 이 로그인으로 그 계정을 쓸 수 없으면 까닭을 알림
    const owners = Object.entries(loadCfState(S).accounts || {}).filter(([, a]) => Array.isArray(a?.sites) && a.sites.includes(name)).map(([id]) => id);
    await auth(t, { needSub: false, prefer: owners });
    phase(t, 'delete');
    const st0 = loadCfState(S);
    if (!accState(st0, t).sites.includes(name)) {
      if (owners.length) throw new CfError('other-account', `이 사이트는 다른 Cloudflare 계정(${String(st0.accounts[owners[0]]?.name || '').slice(0, 60) || '이름 모름'})으로 올렸어요. 그 계정으로 로그인한 뒤 다시 눌러 주세요.`);
      throw new CfError('not-ours', '이 PC의 lecpage 커넥트로 배포한 사이트가 아니라 여기서 지울 수 없어요. Cloudflare 대시보드(Workers & Pages)에서 지워 주세요.');
    }
    // 지웠는지는 명령의 말이 아니라 계정에 그 이름이 남았는지로 확인(실패한 명령의 "not found" 같은 글에 속지 않게)
    const drop = async (n) => { const r = await wr(t, ['delete', '--name', n, '--force']); stop(t); if (r.ok) return { gone: true, r }; return { gone: !(await script(t, n)).exists, r }; };
    const del = await drop(name);
    if (!del.gone) throw explain(del.r.raw);
    let relayGone = false;
    if (withRelay) relayGone = (await drop(RELAY_NAME).catch(() => ({ gone: false }))).gone;
    const st = loadCfState(S); const a = accState(st, t);
    a.sites = a.sites.filter((x) => x !== name);
    if (relayGone) delete a.relay;
    saveCfState(S, st);
    log('Cloudflare에서 사이트를 지웠어요');
    return { deleted: name, relay: relayGone };
  }
  /** 이 PC의 Cloudflare 로그인 지우기: wrangler 로그인 + 이 PC에 둔 참여 기능 서버 관리자 키·기억한 계정(공용 PC에서 다음 사람에게 남지 않게). 올린 사이트 이름 기록은 둠(다시 로그인하면 그 계정 것만 지울 수 있음) */
  async function logout(t) {
    phase(t, 'tool');
    c.auth = null;
    forgetKeys();
    const r = await wr(t, ['logout']);
    if (!r.ok && !/not logged in/i.test(r.raw)) throw explain(r.raw);
    return { loggedOut: true };
  }
  function forgetKeys() {
    try {
      const st = loadCfState(S);
      let changed = false;
      for (const a of Object.values(st.accounts && typeof st.accounts === 'object' ? st.accounts : {})) if (a && a.relay) { delete a.relay; changed = true; }
      if (st.account) { delete st.account; changed = true; }
      if (changed) saveCfState(S, st);
    } catch { /* 파일이 없거나 못 씀: 로그아웃은 이어 감 */ }
  }
  function dropDraft() { const d = c.draft; c.draft = null; if (d) { try { rmSync(d.dir, { recursive: true, force: true }); } catch { /* 넘김 */ } } }

  const RUN = { relay, site, delete: remove, logout };
  /** 일 하나 시작(이미 돌고 있으면 { busy: true }) */
  c.start = (kind, body) => R.start(kind, async (t) => {
    try { return await RUN[kind](t, body); } catch (e) {
      // 잠깐 기억해 둔 토큰이 그사이 끝남: 기억을 버리고 처음부터 한 번 다시(로그인이 정말 풀렸으면 이번에는 로그인 창으로 이어짐)
      if (!(e?.code === 'login-needed' && t.cached) || t.cancelled) throw e;
      c.auth = null; Object.assign(t, { cached: false, token: '', accountId: '', accountName: '', sub: '' });
      return RUN[kind](t, body);
    }
  }, {
    onError: (e) => { if (e?.code === 'login-needed') c.auth = null; },
    onEnd: (t) => { t.token = ''; if (kind === 'site' && c.draft) c.draft.busy = false; },
  });
  c.answer = (o) => R.answer((q) => (q.kind === 'account' ? (q.accounts.some((x) => x.id === o.account) ? { value: String(o.account) } : null)
    : q.kind === 'subdomain' ? (typeof o.subdomain === 'string' && o.subdomain.length <= 63 ? { value: o.subdomain.trim() } : null) : null));
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
    if (d.files + 1 > CF_LIMIT.files || d.bytes + bytes.length > CF_LIMIT.totalMB * MiB) return 'too-large';
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, bytes);
    d.files++; d.bytes += bytes.length;
    return '';
  };
  /**
   * 앱에 보일 상태(토큰 없는 것만). 관리자 키는 끝난 relay 결과를 앱이 받아 갈 때(GET, takeKey) 한 번만 싣고 바로 비움:
   * 다음 일을 시작할 때까지 물을 때마다 다시 나가지 않게. 그 밖의 답(202·409·answer)에는 싣지 않음
   */
  c.view = ({ takeKey = false } = {}) => {
    const t = R.task; const v = R.view();
    if (v.result?.relay && typeof v.result.relay === 'object') { // 지우기의 결과(relay: true|false)는 그대로
      const { key, ...rest } = v.result.relay;
      v.result = { ...v.result, relay: takeKey && key ? { ...rest, key } : rest };
      if (takeKey && key && t && !t.running) t.result = { ...t.result, relay: rest };
    }
    return { ...v, ...(t?.accountName ? { account: { name: t.accountName } } : {}) };
  };
  return c;
}

/** /bridge/cloudflare/* (studio.mjs handleBridge가 넘김. 출처·토큰 확인은 이미 지남) */
export async function handleCloudflare(S, req, res, url, parts, H) {
  const { readBody, sendJson, fail } = H;
  const c = S.cf || (S.cf = createCf(S, H));
  const sub = parts[1] || '';
  if (parts.length > 2) return fail(res, 404, 'not-found', '없는 주소예요.');
  if (!sub && req.method === 'GET') return sendJson(res, 200, { ok: true, cf: c.view({ takeKey: true }) });
  if (!sub && req.method === 'DELETE') { await c.cancel(); return sendJson(res, 200, { ok: true, cf: c.view() }); }
  if (req.method !== 'POST') return fail(res, 405, 'method', '이 주소에서 받지 않는 요청이에요.');
  if (sub === 'files') {
    let bytes;
    try { bytes = await readBody(req, CF_LIMIT.fileMB * MiB); } catch (e) { return e.status === 413 ? fail(res, 413, 'too-large', `파일 하나는 ${CF_LIMIT.fileMB}MB까지 올릴 수 있어요.`) : fail(res, 400, 'bad-request', '파일을 받지 못했어요.'); }
    const bad = c.put(String(url.searchParams.get('draft') || ''), url.searchParams.get('path'), bytes);
    if (bad) return bad === 'too-large' ? fail(res, 413, bad, `사이트가 너무 커요(파일 ${CF_LIMIT.files.toLocaleString('en-US')}개·모두 합쳐 ${CF_LIMIT.totalMB}MB까지).`) : fail(res, bad === 'no-draft' ? 409 : 400, bad, bad === 'no-draft' ? '올릴 자리가 없어요. 다시 눌러 주세요.' : '받을 수 없는 파일 이름이에요.');
    return sendJson(res, 200, { ok: true });
  }
  let o = {};
  try { o = JSON.parse((await readBody(req, 65536)).toString('utf8') || '{}'); } catch { return fail(res, 400, 'bad-json', '요청 본문을 JSON으로 읽지 못했어요.'); }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return fail(res, 400, 'bad-request', '요청 본문이 JSON 객체가 아니에요.');
  if (sub === 'answer') return c.answer(o) ? sendJson(res, 200, { ok: true, cf: c.view() }) : fail(res, 409, 'not-waiting', '기다리는 물음이 없어요.', { cf: c.view() });
  if (sub === 'draft') { const d = c.newDraft(); return d ? sendJson(res, 200, { ok: true, draft: d.id }) : fail(res, 409, 'busy', '다른 배포가 돌고 있어요. 끝난 뒤에 다시 해 주세요.', { cf: c.view() }); }
  let body = null;
  if (sub === 'relay') body = { adminKey: typeof o.adminKey === 'string' ? o.adminKey : '', rotate: o.rotate === true };
  else if (sub === 'site' || sub === 'delete') {
    const name = String(o.name || '').toLowerCase();
    if (!NAME_RE.test(name)) return fail(res, 400, 'bad-name', '주소 이름은 영문 소문자·숫자·하이픈으로 63자까지예요.');
    body = sub === 'site' ? { draft: String(o.draft || ''), name, again: o.again === true } : { name, relay: o.relay === true };
  } else if (sub === 'logout') body = {};
  else return fail(res, 404, 'not-found', '없는 주소예요.');
  const r = c.start(sub, body);
  if (r.busy) return fail(res, 409, 'busy', '다른 배포가 돌고 있어요. 끝난 뒤에 다시 해 주세요.', { cf: c.view() });
  return sendJson(res, 202, { ok: true, cf: c.view() });
}
