// lecpage 커넥트: Claude 계정 연결을 터미널 없이 한 번에 — Claude Code가 없으면 공식 설치 명령을 창 없이 돌리고(진행 막대),
// 이어서 `claude auth login`을 돌려 Claude가 여는 브라우저 창에서 로그인. 앱(lecpage 화면)은 GET /bridge/setup으로 단계·진행을 그림.
// 근거(2026-11-21 확인):
//  - Anthropic은 제3자 앱이 Claude.ai 로그인을 직접 제공하거나 로그인 정보를 받아 두는 것을 허용하지 않음. 사용자가 고치지 않은
//    Claude Code에 자기 구독으로 로그인하는 것은 허용(code.claude.com/docs/en/legal-and-compliance). 그래서 로그인은 언제나 Claude Code의
//    공식 흐름(claude.ai 화면 → Claude Code)으로 끝나고, 이 프로그램은 토큰을 읽거나 두지 않음.
//  - 공식 설치: macOS·Linux `curl -fsSL https://claude.ai/install.sh | bash`, Windows `irm https://claude.ai/install.ps1 | iex`
//    (code.claude.com/docs/en/setup). 설치 명령은 진행을 보여 주지 않아서, 설치가 받는 파일(~/.claude/downloads/claude-<판>-<기기>)의
//    크기를 공식 목록(downloads.claude.ai/…/manifest.json)의 크기와 견줘 진행 막대를 그림.
//  - `claude auth login`은 터미널(TTY)이 없어도 돎: 기본 브라우저를 스스로 열고(이 PC의 localhost로 돌아오면 저절로 끝남),
//    "If the browser didn't open, visit: <주소>"와 "Paste code here if prompted >"를 내고 표준 입력에서 코드(가운데 # 포함)를 받음.
//    틀린 코드면 "Couldn't log in: That code wasn't accepted…"로 끝남(종료 코드 1). 2.1.330에서 확인.
// 안전: 받은 코드는 Claude Code의 표준 입력으로만 넘기고 기록·저장하지 않음 · 사람이 [Claude 계정으로 로그인]을 눌렀을 때만 · 한 번에 하나.
import { spawn } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';

/** 이 길로 연결할 수 있는 것(지금은 Claude만. Codex는 ChatGPT 계정 연결로 충분해 터미널 창 길만 둠) */
export const SETUP_AGENTS = ['claude'];
export const RELEASES = 'https://downloads.claude.ai/claude-code-releases';
/** 로그인 기다리는 시간(브라우저에서 끝내지 않고 둔 경우 멈춤) */
export const LOGIN_MS = 10 * 60e3;

/** 단계별 실패 안내(해요체). 앱은 title_ko·message_ko를 그대로 보여 줌 */
export const SETUP_ERRORS = {
  offline: { title_ko: '인터넷에 연결되지 않았어요', message_ko: '와이파이나 랜선 연결을 확인하고 [다시 시도]를 눌러 주세요.' },
  blocked: { title_ko: '보안 프로그램이나 네트워크가 막았어요', message_ko: '백신·보안 프로그램이나 회사·기관 네트워크가 Claude 설치를 막은 것 같아요. 보안 프로그램에서 lecpage 커넥트와 Claude Code를 허용하거나, 담당자에게 claude.ai·downloads.claude.ai 접속을 허용해 달라고 한 뒤 [다시 시도]를 눌러 주세요.' },
  cancelled: { title_ko: '로그인을 마치지 않았어요', message_ko: '브라우저에서 로그인을 취소했거나 허용하지 않았어요. [다시 시도]를 누르면 로그인 창이 다시 열려요.' },
  timeout: { title_ko: '로그인을 마치지 않았어요', message_ko: '10분 동안 로그인이 끝나지 않아 중지했어요. [다시 시도]를 누르면 로그인 창이 다시 열려요.' },
  'bad-code': { title_ko: '코드가 맞지 않았어요', message_ko: '[다시 시도]를 누르고 새 로그인 창에서 받은 코드를 # 앞뒤까지 모두 붙여 넣어 주세요.' },
  memory: { title_ko: '메모리가 부족해 설치가 멈췄어요', message_ko: '다른 프로그램을 몇 개 닫고 [다시 시도]를 눌러 주세요.' },
  'install-failed': { title_ko: 'Claude Code를 설치하지 못했어요', message_ko: '[다시 시도]를 눌러 주세요. 계속 안 되면 [터미널 창에서 하기]로 공식 명령을 직접 실행해 보세요.' },
  'login-failed': { title_ko: '로그인하지 못했어요', message_ko: 'Claude Pro·Max 요금제 계정인지 확인하고 [다시 시도]를 눌러 주세요.' },
  missing: { title_ko: '설치한 Claude Code를 찾지 못했어요', message_ko: 'lecpage 커넥트를 끄고 다시 켠 뒤 [다시 시도]를 눌러 주세요.' },
  old: { title_ko: 'Claude Code를 새 버전으로 바꾸지 못했어요', message_ko: '[터미널 창에서 하기]로 공식 설치 명령을 직접 실행해 주세요.' },
};

const OFFLINE = /could ?n[o']t resolve|resolve host|failed to connect|couldn'?t connect|connection (?:refused|reset|timed out)|network is unreachable|no route to host|timed out|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENETUNREACH|getaddrinfo|fetch failed|remote name could not be resolved|unable to connect to the remote server|no such host is known|curl: \((?:5|6|7|28|52|56)\)/i;
const BLOCKED = /\bssl\b|certificate|self[- ]signed|local issuer|curl: \((?:22|35|51|60)\)|\b403\b|forbidden|antivirus|malicious|virus|blocked|group policy|execution ?polic|digitally signed|access (?:is )?denied|permission denied|operation not permitted|EPERM|EACCES|not available in your region|unexpected content/i;
const CANCELLED = /access_denied|denied|cancel|declin/i;
const BAD_CODE = /code wasn'?t accepted|doesn'?t look like the full code|invalid (?:authorization )?code|invalid_grant/i;
/** 실패한 출력 → 안내 코드(SETUP_ERRORS의 키) */
export function classifyFailure(step, text, code) {
  const t = String(text || '');
  if (step === 'login') {
    if (BAD_CODE.test(t)) return 'bad-code';
    if (CANCELLED.test(t)) return 'cancelled';
    if (OFFLINE.test(t)) return 'offline';
    if (BLOCKED.test(t)) return 'blocked';
    return 'login-failed';
  }
  if (OFFLINE.test(t)) return 'offline';
  if (BLOCKED.test(t)) return 'blocked';
  if (code === 137) return 'memory';
  return 'install-failed';
}

/**
 * 공식 설치 명령을 창 없이 돌릴 [명령, 인자]. 사용자 입력은 들어가지 않음(고정 글).
 * Windows: 옛 PowerShell 5.1이 TLS 1.2를 기본으로 켜지 않는 PC가 있어 켜 두고, 내려받기 진행 표시(느려짐)를 끔.
 * macOS·Linux: 파이프 앞(curl)이 실패해도 실패로 끝나게 pipefail. curl이 없으면 wget(설치 스크립트도 둘 중 하나를 씀)
 */
export function installSpec(official, { platform = process.platform, has = () => true } = {}) {
  if (platform === 'win32') return ['powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', `[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072; $ProgressPreference = 'SilentlyContinue'; ${official.win}`]];
  const get = has('curl') ? official.unix : official.unix.replace(/^curl -fsSL (\S+)/, 'wget -qO- $1');
  return ['bash', ['-c', `set -o pipefail; ${get}`]];
}

/** 설치가 받는 중인 파일: ~/.claude/downloads/claude-<판>-<기기>[.exe][.zst] → { version, platform, zst, bytes } | null */
export function downloading(home, { list = (d) => readdirSync(d), size = (f) => statSync(f).size } = {}) {
  const dir = join(home, '.claude', 'downloads');
  let names = []; try { names = list(dir); } catch { return null; }
  for (const n of names) {
    const m = n.match(/^claude-(\d+\.\d+\.\d+[\w.]*?)-([a-z0-9]+-[a-z0-9]+(?:-musl)?)(\.exe)?(\.zst)?$/i);
    if (!m) continue;
    let bytes = 0; try { bytes = size(join(dir, n)); } catch { continue; }
    return { version: m[1], platform: m[2], zst: !!m[4], bytes };
  }
  return null;
}

const stripAnsi = (s) => String(s).replace(/\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[()][A-Za-z0-9]/g, '').replace(/\r(?!\n)/g, '\n');

/**
 * 연결 한 번(설치 → 로그인 → 확인)을 뒤에서 돌림 → { view(), input(code), stop(), killNow() }
 * detect(): 지금 상태({ installed, version, need, loggedIn, file, from }) · launchSpec·kill: studio.mjs의 것(윈도우 .cmd 심 풀기·프로세스 묶음 끄기)
 * installer: 시험용 [명령, 인자](공식 명령 대신) · onLine: lecpage 커넥트 창에 보일 줄(받은 코드는 넘기지 않음)
 */
export function createSetup({ agent = 'claude', detect, launchSpec, kill, official, platform = process.platform, env = process.env, home = homedir(), has, installer = null, fetchImpl = globalThis.fetch, onLine = () => {}, loginMs = LOGIN_MS, pollMs = 600 }) {
  const v = { agent, step: 'check', running: true, startedAt: Date.now(), install: '', progress: null, loginUrl: '', waitingCode: false, codeSent: false, from: '', error: null };
  let out = ''; let child = null; let stopped = false; let timedOut = false;
  const add = (d) => { const s = stripAnsi(d); out = (out + s).slice(-8000); for (const l of s.split('\n')) if (l.trim()) onLine(l.trimEnd()); };
  const failWith = (code) => Object.assign(new Error(code), { setup: code });

  function runChild(cmd, args, onData) {
    return new Promise((ok) => {
      let p;
      try { p = spawn(cmd, args, { cwd: tmpdir(), env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, detached: platform !== 'win32' }); } catch (e) { add(`${e.message}\n`); ok({ code: -1 }); return; }
      child = p;
      p.stdout.setEncoding('utf8'); p.stderr.setEncoding('utf8');
      const on = (d) => { add(d); onData?.(); };
      p.stdout.on('data', on); p.stderr.on('data', on);
      p.stdin.on('error', () => {});
      p.on('error', (e) => { add(`${e.message}\n`); });
      p.on('close', (code, signal) => { child = null; ok({ code: code ?? (signal ? 128 + 9 : -1) }); });
    });
  }

  // 공식 목록에서 받을 파일 크기(진행 막대). 못 받으면 진행률 없이(막대가 왔다 갔다)
  const sizes = new Map();
  async function totalFor(d) {
    const key = `${d.version}|${d.platform}|${d.zst}`;
    if (sizes.has(key)) return sizes.get(key);
    sizes.set(key, 0);
    try {
      const r = await fetchImpl(`${RELEASES}/${d.version}/${d.zst ? 'manifest.zst.json' : 'manifest.json'}`, { signal: AbortSignal.timeout(8000) });
      const n = Number((await r.json())?.platforms?.[d.platform]?.size) || 0;
      sizes.set(key, n);
    } catch { /* 진행률 없이 */ }
    return sizes.get(key);
  }
  async function install() {
    v.step = 'install'; v.install = 'run'; v.progress = { phase: 'download', done: 0, total: 0 };
    onLine(`Claude Code를 공식 설치 명령으로 설치해요(창 없이, 보통 1~3분)`);
    let seen = false;
    const tick = setInterval(async () => {
      if (v.progress.phase !== 'download') return;
      const d = downloading(home);
      if (!d) { if (seen) v.progress.phase = 'setup'; return; }
      seen = true;
      const total = await totalFor(d);
      if (v.progress.phase === 'download') v.progress = { phase: 'download', done: total ? Math.min(d.bytes, total) : d.bytes, total };
    }, pollMs);
    const [cmd, args] = installer || installSpec(official, { platform, has });
    const r = await runChild(cmd, args, () => { if (/Setting up Claude Code/i.test(out)) v.progress.phase = 'setup'; });
    clearInterval(tick);
    if (stopped) throw failWith('stopped');
    if (r.code !== 0) throw failWith(classifyFailure('install', out, r.code));
    v.install = 'done'; v.progress = { phase: 'done', done: v.progress.total, total: v.progress.total };
  }
  async function login(file) {
    v.step = 'login'; v.progress = null; v.loginUrl = ''; v.waitingCode = false; v.codeSent = false;
    onLine('브라우저 창에서 Claude 계정으로 로그인해 주세요');
    let spec; try { spec = launchSpec(file, ['auth', 'login']); } catch (e) { add(`${e.message}\n`); throw failWith('login-failed'); }
    const t = setTimeout(() => { timedOut = true; kill(child); }, loginMs);
    const r = await runChild(spec.command, spec.args, () => {
      // "If the browser didn't open, visit:" 다음 주소(직접 여는 길: 로그인하면 화면에 코드가 나옴)
      const m = out.match(/visit:?\s*(https:\/\/\S+)/i) || out.match(/(https:\/\/(?:claude\.ai|claude\.com|console\.anthropic\.com|platform\.claude\.com)\/\S+)/i);
      if (m) v.loginUrl = m[1];
      if (/paste code/i.test(out)) v.waitingCode = true;
    });
    clearTimeout(t);
    v.waitingCode = false;
    if (stopped) throw failWith('stopped');
    if (timedOut) throw failWith('timeout');
    if (r.code !== 0) throw failWith(classifyFailure('login', out, r.code));
  }
  (async () => {
    try {
      let a = await detect();
      if (stopped) throw failWith('stopped');
      if (!a.installed || a.need === 'update') {
        await install();
        a = await detect();
        if (!a.installed) throw failWith('missing');
        if (a.need === 'update') throw failWith('old');
      } else v.install = 'skip';
      v.from = a.from || '';
      if (stopped) throw failWith('stopped');
      if (a.loggedIn === false) {
        await login(a.file);
        a = await detect();
        if (a.loggedIn === false) throw failWith('login-failed');
      }
      v.step = 'done'; v.progress = null;
      onLine('Claude 계정을 연결했어요');
    } catch (e) {
      if (!e.setup && !stopped) add(`${e.message}\n`);
      const code = stopped ? 'stopped' : e.setup || (v.step === 'login' ? 'login-failed' : 'install-failed');
      const at = v.step === 'login' ? 'login' : 'install';
      v.step = code === 'stopped' ? 'stopped' : 'error';
      if (code !== 'stopped') { v.error = { code, at, ...SETUP_ERRORS[code] }; onLine(SETUP_ERRORS[code]?.title_ko || '연결하지 못했어요'); }
    } finally { v.running = false; v.waitingCode = false; child = null; }
  })();

  return {
    /** 앱에 줄 상태. tail: 실패했을 때 마지막 출력(자세한 내용) */
    view: ({ tail = false } = {}) => ({ ...v, progress: v.progress && { ...v.progress }, error: v.error && { ...v.error }, ...(tail && v.error ? { tail: out.slice(-1500) } : {}) }),
    /** 로그인 화면에 나온 코드(가운데 # 포함)를 Claude Code에 넘김. 기록하지 않음 */
    input(code) {
      const c = String(code ?? '').trim();
      if (!v.running || v.step !== 'login' || !child?.stdin?.writable) return { ok: false, error: 'not-waiting' };
      if (c.length > 2000 || !/^[^\s#]{4,}#[^\s#]{4,}$/.test(c)) return { ok: false, error: 'bad-code' };
      child.stdin.write(`${c}\n`); v.codeSent = true;
      return { ok: true };
    },
    async stop() { if (!v.running) return; stopped = true; await kill(child); },
    killNow() { const p = child; if (p && p.exitCode === null && p.signalCode === null) { try { if (platform === 'win32') p.kill(); else process.kill(-p.pid, 'SIGKILL'); } catch { /* 이미 끝남 */ } } },
  };
}
