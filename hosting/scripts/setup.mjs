#!/usr/bin/env node
// lecpage 바로 배포 서버를 명령 한 번으로 켭니다(처음이든 다시든 같은 명령. 이미 된 것은 건너뜀).
//
//   cd hosting && npm run setup                     묻는 것: 토큰(없을 때), 운영자 이메일, 알림 웹훅(선택)
//   CLOUDFLARE_API_TOKEN=… LECPAGE_EMAIL=… npm run setup -- --yes      묻지 않고
//   npm run setup -- --dry-run                     Cloudflare에 아무것도 바꾸지 않고 할 일만 보여 줌
//
// 하는 일: ① 로그인 확인 ② workers.dev 하위 도메인 ③ 보기(Pages 프로젝트·올리기 전용 토큰) ④ 바로 배포 Worker 배포
//          ⑤ 비밀 값(ADMIN_KEY는 만들어 파일에만, 화면에 찍지 않음) ⑥ 관리 Worker 배포 + Access(도메인 없이 workers.dev, 운영자 이메일만)
//          ⑦ (선택) 내 도메인·WAF 규칙 1개 ⑧ 확인 ⑨ 앱 빌드 변수 VITE_PUBLISH_API 안내
// 이메일·토큰·열쇠는 저장소와 로그에 쓰지 않습니다. 이메일은 Cloudflare(Access 정책·관리 Worker 비밀 값)에만, ADMIN_KEY는 ~/.lecpage/<계정>/admin-key(0600)에만.
//
// 옵션(환경 변수도 같음):
//   --yes(LECPAGE_YES=1)            묻지 않음. 이메일이 없으면 관리 화면 Access만 건너뜀
//   --skip-deploy(LECPAGE_SKIP_DEPLOY=1) 바로 배포 Worker는 배포하지 않음(Cloudflare Workers Builds가 GitHub에서 배포할 때). 나머지 설정만
//   --dry-run                       읽기만(GET)과 wrangler --dry-run
//   --login                         API 토큰 대신 wrangler login(브라우저 승인). Access·Pages 보기는 대시보드 안내로
//   --email <주소>(LECPAGE_EMAIL)  관리 화면에 들어올 운영자 이메일
//   --webhook <주소>(LECPAGE_WEBHOOK) 신고·예산 알림(슬랙·디스코드 웹훅). 'none'이면 묻지 않음
//   --view pages|worker(LECPAGE_VIEW) 기본 pages(토큰이 Pages·토큰 만들기 권한을 가졌을 때)
//   --project <이름>(LECPAGE_PAGES_PROJECT) 기본 lecpage-view
//   --domain <호스트>(LECPAGE_DOMAIN) 내 도메인(그 zone이 이 계정에 있어야 함). 붙이고 WAF 속도 제한 규칙 1개
//   --app-origin <주소>(LECPAGE_APP_ORIGIN) 앱을 올린 주소(기본 허용 목록 밖일 때)
//   --subdomain <이름>(LECPAGE_SUBDOMAIN) workers.dev 하위 도메인이 아직 없을 때 쓸 이름
//   --account <id>(CLOUDFLARE_ACCOUNT_ID) 계정이 여럿일 때
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { PagesClient, deploySite } from '../src/pages-api.js';
import { pagesHash, base64Parts } from '../src/blake3.js';
import { goneHtml, NOTICE_HEADERS } from '../src/pages-site.js';

const HOSTING = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SITES = 'lecpage-sites';
export const ADMIN = 'lecpage-admin';
const ACCESS_APP = 'lecpage 관리 화면';
const RUNTIME_TOKEN = 'lecpage-sites 사이트 올리기(Pages)';
const WAF_RULE = 'lecpage 폭주 막기';

/** 만들 토큰의 권한(대시보드 → 내 프로필 → API 토큰 → 사용자 지정 토큰) */
export const TOKEN_HELP = `Cloudflare API 토큰 만들기(한 번):
  대시보드 → 오른쪽 위 사람 모양 → 내 프로필 → API 토큰 → 토큰 만들기 → 사용자 지정 토큰
  권한(Permissions)에 아래를 넣고, 계정 리소스는 운영 계정 하나만 고릅니다.
    Account · Workers Scripts · Edit                         바로 배포·관리 Worker 배포, 비밀 값
    Account · Cloudflare Pages · Edit                        사이트 보기(Pages) 프로젝트
    Account · Account API Tokens · Edit                      Worker가 쓸 'Pages 올리기 전용' 토큰 만들기
    Account · Access: Apps and Policies · Edit               관리 화면 Access
    Account · Access: Organizations, Identity Providers, and Groups · Read   Access 팀 주소 읽기
    Account · Account Settings · Read                        계정 찾기
  (내 도메인을 쓸 때만) Zone · Zone · Read, Zone · Zone WAF · Edit, Zone · Workers Routes · Edit — 영역 리소스는 그 도메인 하나
  만료일(TTL)을 며칠 뒤로 두고, 설정이 끝나면 지워도 됩니다(다시 돌릴 때 새로 만들면 됨).`;

const ZT_HELP = `관리 화면을 켜려면 Zero Trust(무료)를 한 번 켜야 해요. 대시보드에서만 할 수 있어요:
  대시보드 → Zero Trust → 팀 이름 정하기 → Free 요금제 고르기 → 결제 수단 입력(무료 요금제도 입력은 받지만 청구하지 않음)
  끝나면 같은 명령(npm run setup)을 다시 돌리세요. 관리 화면만 이어서 켭니다.`;

class StepError extends Error {
  constructor(message, next = '') { super(message); this.next = next; }
}

// ── 입출력(시험에서 바꿔 끼움) ─────────────────────────────────
function defaultIo() {
  let rl = null;
  const line = () => (rl ||= createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY }));
  return {
    log: (s = '') => process.stdout.write(`${s}\n`),
    interactive: !!process.stdin.isTTY,
    ask: (q, { secret = false } = {}) => new Promise((res) => {
      const r = line();
      if (secret && process.stdin.isTTY) {
        // 붙여 넣은 토큰을 화면에 보이지 않게
        const out = r.output; const w = out.write.bind(out); let on = false;
        out.write = (s) => (on && typeof s === 'string' && !s.includes(q) ? true : w(s));
        r.question(q, (a) => { out.write = w; w('\n'); res(a.trim()); });
        on = true;
      } else r.question(q, (a) => res(a.trim()));
    }),
    close: () => { if (rl) rl.close(); },
    run: (cmd, args, o = {}) => spawnSync(cmd, args, { cwd: HOSTING, stdio: o.input !== undefined ? ['pipe', 'inherit', 'inherit'] : 'inherit', input: o.input, env: o.env, encoding: 'utf8' }),
    fetch: (...a) => fetch(...a),
    home: homedir(),
  };
}

function parseArgs(argv, env) {
  const o = {
    yes: /^(1|true|yes)$/i.test(env.LECPAGE_YES || ''), dryRun: false, login: false, skipDeploy: /^(1|true|yes)$/i.test(env.LECPAGE_SKIP_DEPLOY || ''),
    email: env.LECPAGE_EMAIL || '', webhook: env.LECPAGE_WEBHOOK || '', view: env.LECPAGE_VIEW || '', project: env.LECPAGE_PAGES_PROJECT || 'lecpage-view',
    domain: env.LECPAGE_DOMAIN || '', appOrigin: env.LECPAGE_APP_ORIGIN || '', subdomain: env.LECPAGE_SUBDOMAIN || '', account: env.CLOUDFLARE_ACCOUNT_ID || '',
  };
  const map = { '--email': 'email', '--webhook': 'webhook', '--view': 'view', '--project': 'project', '--domain': 'domain', '--app-origin': 'appOrigin', '--subdomain': 'subdomain', '--account': 'account' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--yes' || a === '-y') o.yes = true;
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--login') o.login = true;
    else if (a === '--skip-deploy') o.skipDeploy = true;
    else if (a.includes('=') && map[a.split('=')[0]]) o[map[a.split('=')[0]]] = a.slice(a.indexOf('=') + 1);
    else if (map[a]) o[map[a]] = argv[++i] || '';
    else if (a === '--help' || a === '-h') o.help = true;
    else throw new StepError(`모르는 옵션이에요: ${a}`, 'npm run setup -- --help 로 옵션을 보세요.');
  }
  if (o.view && !['pages', 'worker'].includes(o.view)) throw new StepError('--view는 pages나 worker예요.');
  if (o.domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(o.domain)) throw new StepError('--domain은 sites.example.kr 같은 호스트 이름이에요.');
  if (o.appOrigin && !/^https?:\/\/[^/\s]+$/.test(o.appOrigin.replace(/\/+$/, ''))) throw new StepError('--app-origin은 https://앱주소 모양이에요.');
  return o;
}
const mask = (email) => email.replace(/^(.).*?(@.*)$/, (_, a, d) => `${a}***${d}`);

// ── Cloudflare API ───────────────────────────────────────────
function cfApi(io, token, base) {
  return async function api(method, path, body, { allow = [] } = {}) {
    let res;
    try {
      res = await io.fetch(`${base}${path}`, { method, headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    } catch (e) { throw new StepError(`Cloudflare API에 닿지 못했어요(${method} ${path.split('?')[0]}).`, '인터넷 연결을 확인하고 다시 돌려 주세요.'); }
    let j = null; try { j = await res.json(); } catch { /* 빈 응답 */ }
    if (allow.includes(res.status)) return { status: res.status, result: j?.result ?? null, errors: j?.errors || [] };
    if (!res.ok || j?.success === false) {
      const e = j?.errors?.[0] || {};
      const err = new StepError(`Cloudflare가 거절했어요: ${method} ${path.split('?')[0]} → ${res.status}${e.code ? ` (${e.code})` : ''} ${String(e.message || '').slice(0, 160)}`,
        res.status === 403 || res.status === 401 ? '토큰 권한이 모자라요. 아래 권한 목록대로 토큰을 다시 만들어 주세요.\n' + TOKEN_HELP : '잠시 뒤 다시 돌려 주세요. 계속되면 이 줄을 운영 기록에 남겨 주세요.');
      err.status = res.status; err.code = e.code;
      throw err;
    }
    return { status: res.status, result: j?.result ?? null };
  };
}

/** @returns {Promise<{ ok: boolean, summary: object }>} */
export async function setup(argv = process.argv.slice(2), { env = process.env, io = defaultIo() } = {}) {
  const say = io.log;
  let o;
  try { o = parseArgs(argv, env); } catch (e) { say(`✗ ${e.message}${e.next ? `\n  ${e.next}` : ''}`); return { ok: false }; }
  if (o.help) { say(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n')); return { ok: true }; }
  const base = (env.CF_API_BASE || 'https://api.cloudflare.com/client/v4').replace(/\/+$/, '');
  const wranglerCmd = env.LECPAGE_WRANGLER ? [process.execPath, env.LECPAGE_WRANGLER] : [process.execPath, join(HOSTING, 'node_modules', 'wrangler', 'bin', 'wrangler.js')];
  const st = { mode: '', account: o.account, sub: '', view: 'worker', sitesUrl: '', adminUrl: '', pages: null, did: [], skipped: [], todo: [] };
  const steps = [];
  const step = (name, fn) => steps.push([name, fn]);
  let api = null; let token = env.CLOUDFLARE_API_TOKEN || '';
  const write = !o.dryRun;
  const wrangler = async (args, { input } = {}) => {
    const r = await io.run(wranglerCmd[0], [...wranglerCmd.slice(1), ...args], { input, env: { ...process.env, ...env, ...(token ? { CLOUDFLARE_API_TOKEN: token } : {}), ...(st.account ? { CLOUDFLARE_ACCOUNT_ID: st.account } : {}), CI: env.CI || (io.interactive ? '' : '1'), WRANGLER_SEND_METRICS: 'false' } });
    if (r.status !== 0) throw new StepError(`wrangler ${args.join(' ')} 이(가) 실패했어요(코드 ${r.status}).`, '위에 찍힌 wrangler 오류를 보세요. 로그인이 풀렸으면 다시 돌리면 로그인부터 해요.');
    return r;
  };
  const putSecret = async (script, name, value) => {
    if (!write) { st.did.push(`(dry-run) ${script} 비밀 값 ${name}`); return; }
    if (api) await api('PUT', `/accounts/${st.account}/workers/scripts/${script}/secrets`, { name, text: value, type: 'secret_text' });
    else await wrangler(['secret', 'put', name, ...(script === ADMIN ? ['-c', 'wrangler.admin.jsonc'] : [])], { input: value });
  };
  const secretNames = async (script) => {
    if (!api) return new Set();
    const r = await api('GET', `/accounts/${st.account}/workers/scripts/${script}/secrets`, null, { allow: [404] });
    return new Set((r.status === 404 ? [] : r.result || []).map((x) => x.name));
  };
  const keyDir = () => join(env.LECPAGE_HOME || io.home, '.lecpage', st.account || 'default');

  // ① 로그인
  step('로그인 확인', async () => {
    if (!existsSync(join(HOSTING, 'node_modules', 'wrangler')) && !env.LECPAGE_WRANGLER) {
      say('  wrangler가 없어 먼저 설치해요(npm install)…');
      const r = await io.run('npm', ['install', '--no-audit', '--no-fund']);
      if (r.status !== 0) throw new StepError('npm install이 실패했어요.', 'hosting 폴더에서 npm install을 직접 돌려 보세요.');
    }
    if (!token && !o.login) {
      if (o.yes || !io.interactive) throw new StepError('CLOUDFLARE_API_TOKEN이 없어요.', `${TOKEN_HELP}\n  토큰 없이 하려면 --login(브라우저 승인 한 번, 관리 화면·Pages 보기는 대시보드에서 따로)`);
      say(TOKEN_HELP);
      token = await io.ask('\n만든 토큰을 붙여 넣으세요(화면에 보이지 않아요. 비우면 브라우저 로그인으로): ', { secret: true });
      if (!token) o.login = true;
    }
    if (o.login && !token) {
      st.mode = 'login';
      const who = await io.run(wranglerCmd[0], [...wranglerCmd.slice(1), 'whoami'], { env: { ...process.env, ...env } });
      if (who.status !== 0 && write) await wrangler(['login']);
      say('  wrangler login으로 해요. 관리 화면(Access)과 Pages 보기는 대시보드에서 따로 켜야 해요(끝에 안내).');
      return;
    }
    st.mode = 'token';
    api = cfApi(io, token, base);
    const accts = (await api('GET', '/accounts?per_page=50')).result || [];
    if (!accts.length) throw new StepError('이 토큰으로 볼 수 있는 계정이 없어요.', TOKEN_HELP);
    if (!st.account) {
      if (accts.length === 1) st.account = accts[0].id;
      else if (o.yes || !io.interactive) throw new StepError('계정이 여럿이에요.', `CLOUDFLARE_ACCOUNT_ID에 쓸 계정 id를 넣어 주세요: ${accts.map((a) => a.id).join(', ')}`);
      else {
        accts.forEach((a, i) => say(`  ${i + 1}. ${a.name} (${a.id})`));
        const n = Number(await io.ask('쓸 계정 번호: ')) - 1;
        if (!accts[n]) throw new StepError('계정을 고르지 않았어요.');
        st.account = accts[n].id;
      }
    } else if (!accts.some((a) => a.id === st.account)) throw new StepError('CLOUDFLARE_ACCOUNT_ID가 이 토큰으로 볼 수 있는 계정이 아니에요.');
    say(`  계정 ${st.account.slice(0, 6)}…`);
  });

  // ② workers.dev
  step('workers.dev 주소', async () => {
    if (!api) { st.skipped.push('workers.dev 하위 도메인 확인(wrangler deploy가 물어봄)'); return; }
    const r = await api('GET', `/accounts/${st.account}/workers/subdomain`, null, { allow: [404, 400] });
    if (r.status === 200 && r.result?.subdomain) { st.sub = r.result.subdomain; say(`  ${st.sub}.workers.dev (이미 있음)`); return; }
    let name = o.subdomain;
    if (!name && io.interactive && !o.yes) name = await io.ask('workers.dev 하위 도메인이 아직 없어요. 쓸 이름(영문 소문자·숫자, 비우면 자동): ');
    if (!name) name = `lecpage-${randomBytes(3).toString('hex')}`;
    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(name)) throw new StepError('하위 도메인은 영문 소문자·숫자·붙임표예요.');
    if (write) await api('PUT', `/accounts/${st.account}/workers/subdomain`, { subdomain: name });
    st.sub = name; st.did.push(`${write ? '' : '(dry-run) '}workers.dev 하위 도메인 ${name}`);
  });

  // ③ 보기(Pages)
  step('사이트 보기(Pages)', async () => {
    st.view = o.view || (api ? 'pages' : 'worker');
    if (st.view !== 'pages') { say('  보기: Worker(/s/<id>/)'); return; }
    if (!api) { st.view = 'worker'; st.todo.push('Pages 보기는 API 토큰으로 다시 돌릴 때 켜져요(npm run setup).'); return; }
    let pr = await api('GET', `/accounts/${st.account}/pages/projects/${o.project}`, null, { allow: [404] });
    if (pr.status === 404) {
      if (!write) { st.did.push(`(dry-run) Pages 프로젝트 ${o.project} 만들기`); st.pages = { host: `${o.project}.pages.dev` }; return; }
      pr = await api('POST', `/accounts/${st.account}/pages/projects`, { name: o.project, production_branch: 'main' });
      st.did.push(`Pages 프로젝트 ${o.project}`);
    }
    const host = String(pr.result?.subdomain || `${o.project}.pages.dev`).replace(/^https?:\/\//, '');
    st.pages = { project: o.project, host };
    say(`  사이트 주소 모양: https://s-<id>.${host}/`);
    // 본 배포(없는 주소·지운 사이트에 보일 안내 화면). 이미 있으면 그대로
    if (write && !pr.result?.canonical_deployment && !pr.result?.latest_deployment) {
      const pc = new PagesClient({ api: base, accountId: st.account, project: o.project, token, fetch: io.fetch });
      const bytes = new TextEncoder().encode(goneHtml()); const parts = base64Parts(bytes); const hash = pagesHash(bytes, 'html', parts);
      // 프로젝트 첫 주소(…pages.dev)에만 보이는 안내라 실패해도 바로 배포는 됨 → 멈추지 않고 남은 일로
      // (프록시가 Authorization 머리글을 바꿔 끼우는 환경에서는 올리기용 JWT가 막혀 실패함)
      try {
        await deploySite(pc, { branch: 'main', manifest: { '/index.html': hash, '/404.html': hash }, extra: [{ hash, parts, contentType: 'text/html; charset=utf-8' }], headers: NOTICE_HEADERS, message: 'lecpage 안내 화면' });
        st.did.push('Pages 본 배포(없는 주소 안내 화면)');
      } catch (e) {
        st.todo.push(`Pages 첫 주소(${host})의 안내 화면을 못 올렸어요(${String(e.message || e).slice(0, 80)}). 사이트 배포와는 상관없어요. 다른 컴퓨터에서 npm run setup을 다시 돌리면 채워져요.`);
      }
    }
  });

  // ④ 배포
  step('바로 배포 Worker 배포', async () => {
    if (o.skipDeploy) {
      // Workers Builds(GitHub 연결)가 배포를 맡음: 이미 있는지만 확인
      const w = api ? await api('GET', `/accounts/${st.account}/workers/scripts/${SITES}/settings`, null, { allow: [404] }) : { status: 200 };
      if (w.status === 404) throw new StepError(`${SITES} Worker가 아직 없어요.`, 'Cloudflare 대시보드에서 GitHub 저장소를 연결해 먼저 배포한 뒤(hosting/README.md) 다시 돌려 주세요.');
      st.skipped.push(`Worker ${SITES} 배포(Workers Builds가 맡음)`);
      st.sitesUrl = st.sub ? `https://${SITES}.${st.sub}.workers.dev` : '';
      return;
    }
    if (!write) { await wrangler(['deploy', '--dry-run', '--outdir', '.wrangler/dry-run']); st.did.push('(dry-run) wrangler deploy'); }
    else { await wrangler(['deploy']); st.did.push(`Worker ${SITES} 배포`); }
    st.sitesUrl = st.sub ? `https://${SITES}.${st.sub}.workers.dev` : '';
  });

  // ⑤ 비밀 값
  step('비밀 값', async () => {
    const have = await secretNames(SITES);
    // ADMIN_KEY: 만들어 파일(0600)에만. 화면·로그에 찍지 않음
    const dir = keyDir(); const file = join(dir, 'admin-key');
    let key = existsSync(file) ? readFileSync(file, 'utf8').trim() : '';
    if (!key || !have.has('ADMIN_KEY')) {
      key = key || randomBytes(32).toString('hex');
      if (write) {
        mkdirSync(dir, { recursive: true, mode: 0o700 });
        writeFileSync(file, `${key}\n`, { mode: 0o600 }); chmodSync(file, 0o600);
      }
      await putSecret(SITES, 'ADMIN_KEY', key);
      if (write) st.did.push(`ADMIN_KEY(curl용 관리자 열쇠) → ${file} (0600, 화면에 찍지 않음)`);
    } else st.skipped.push('ADMIN_KEY(이미 있음)');
    // 알림 웹훅(선택)
    let hook = o.webhook === 'none' ? '' : o.webhook;
    if (!hook && o.webhook !== 'none' && !have.has('REPORT_WEBHOOK') && io.interactive && !o.yes) hook = await io.ask('신고·하루 예산 알림을 받을 웹훅 주소(슬랙·디스코드, 없으면 엔터): ');
    if (hook) {
      if (!/^https:\/\//.test(hook)) throw new StepError('웹훅 주소는 https://로 시작해야 해요.');
      await putSecret(SITES, 'REPORT_WEBHOOK', hook); st.did.push('알림 웹훅(REPORT_WEBHOOK)');
    }
    if (o.appOrigin) { await putSecret(SITES, 'APP_ORIGINS', o.appOrigin.replace(/\/+$/, '')); st.did.push('앱 주소 허용(APP_ORIGINS)'); }
    // 보기 설정은 비밀 값으로 둠: npm run deploy를 다시 해도 지워지지 않게
    await putSecret(SITES, 'VIEW', st.view);
    if (st.view === 'pages' && st.pages) {
      await putSecret(SITES, 'CF_ACCOUNT_ID', st.account);
      await putSecret(SITES, 'PAGES_PROJECT', st.pages.project || o.project);
      await putSecret(SITES, 'PAGES_HOST', st.pages.host);
      if (!have.has('PAGES_TOKEN')) {
        const t = await runtimeToken();
        if (t) { await putSecret(SITES, 'PAGES_TOKEN', t); st.did.push('PAGES_TOKEN(Pages 올리기만 하는 토큰)'); }
      } else st.skipped.push('PAGES_TOKEN(이미 있음)');
    }
  });
  /** Worker가 쓸 토큰: 이 계정의 Pages Write만. 계정 소유 토큰으로 만듦(같은 이름의 예전 것은 지움) */
  async function runtimeToken() {
    if (env.LECPAGE_PAGES_TOKEN) return env.LECPAGE_PAGES_TOKEN;
    if (!write) { st.did.push('(dry-run) Pages 올리기 전용 토큰 만들기'); return ''; }
    try {
      const groups = (await api('GET', `/accounts/${st.account}/tokens/permission_groups`)).result || [];
      const pw = groups.find((g) => g.name === 'Pages Write' || g.name === 'Cloudflare Pages Write');
      if (!pw) throw new StepError('Pages Write 권한 묶음을 찾지 못했어요.');
      const old = ((await api('GET', `/accounts/${st.account}/tokens`)).result || []).filter((t) => t.name === RUNTIME_TOKEN);
      const made = await api('POST', `/accounts/${st.account}/tokens`, { name: RUNTIME_TOKEN, policies: [{ effect: 'allow', resources: { [`com.cloudflare.api.account.${st.account}`]: '*' }, permission_groups: [{ id: pw.id }] }] });
      for (const t of old) await api('DELETE', `/accounts/${st.account}/tokens/${t.id}`).catch(() => { });
      if (!made.result?.value) throw new StepError('토큰 값을 받지 못했어요.');
      return made.result.value;
    } catch (e) {
      if (io.interactive && !o.yes) {
        say(`  Worker가 쓸 토큰을 만들지 못했어요(${e.message.split('\n')[0]}).\n  대시보드에서 'Account · Cloudflare Pages · Edit' 하나만 있는 토큰을 만들어 붙여 넣거나, 비우면 Worker 보기로 해요.`);
        const t = await io.ask('Pages 전용 토큰(화면에 보이지 않아요): ', { secret: true });
        if (t) return t;
      }
      st.view = 'worker'; await putSecret(SITES, 'VIEW', 'worker');
      st.todo.push('Pages 보기를 쓰려면 토큰에 Account API Tokens · Edit을 더하거나 LECPAGE_PAGES_TOKEN(Pages Edit만)을 주고 다시 돌리세요. 지금은 Worker 보기예요.');
      return '';
    }
  }

  // ⑥ 관리 화면
  step('관리 화면(관리 Worker + Access)', async () => {
    if (!write) await wrangler(['deploy', '-c', 'wrangler.admin.jsonc', '--dry-run', '--outdir', '.wrangler/dry-run-admin']);
    else await wrangler(['deploy', '-c', 'wrangler.admin.jsonc']);
    st.adminUrl = st.sub ? `https://${ADMIN}.${st.sub}.workers.dev` : '';
    if (!api) { st.todo.push(`관리 화면: 대시보드 → Workers & Pages → ${ADMIN} → Access → Protect this Worker behind Access → 운영자 이메일만. 그 뒤 ${ADMIN}에 비밀 값 ACCESS_AUD(앱의 AUD)·ACCESS_EMAILS(이메일)를 넣으면 열려요.`); return; }
    const org = await api('GET', `/accounts/${st.account}/access/organizations`, null, { allow: [404, 400, 403] });
    if (org.status !== 200 || !org.result?.auth_domain) {
      // Zero Trust를 아직 안 켠 계정도 403(access.api.error.not_enabled)을 줌 → 권한 문제와 구분
      const notOn = (org.errors || []).some((e) => /not_enabled/.test(String(e.message || '')));
      if (org.status === 403 && !notOn) st.todo.push('토큰에 Access: Organizations, Identity Providers, and Groups · Read 권한이 없어 Zero Trust가 켜졌는지 몰라요. 권한을 더하고 다시 돌리세요.');
      else st.todo.push(ZT_HELP);
      return;
    }
    let email = o.email;
    if (!email && io.interactive && !o.yes) email = await io.ask('관리 화면에 들어올 운영자 이메일(Cloudflare Access에만 넣어요): ');
    email = email.trim().toLowerCase();
    if (!email) { st.todo.push('관리 화면: 운영자 이메일을 주고(--email 또는 LECPAGE_EMAIL) 다시 돌리세요.'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new StepError('이메일 모양이 아니에요.');
    const w = await api('GET', `/accounts/${st.account}/workers/workers/${ADMIN}`, null, { allow: [404] });
    const workerId = w.result?.id;
    if (!workerId) { if (!write) { st.did.push('(dry-run) Access 앱(관리 Worker를 배포한 뒤)'); return; } throw new StepError('관리 Worker의 id를 찾지 못했어요.', '잠시 뒤 다시 돌려 주세요.'); }
    const app = { name: ACCESS_APP, type: 'self_hosted', destinations: [{ type: 'worker', worker_id: workerId }], session_duration: '24h', app_launcher_visible: false, policies: [{ name: '운영자', decision: 'allow', include: [{ email: { email } }] }] };
    const apps = (await api('GET', `/accounts/${st.account}/access/apps`)).result || [];
    const cur = apps.find((a) => a.name === ACCESS_APP || (a.destinations || []).some((d) => d.worker_id === workerId));
    let made = cur;
    if (write) made = cur ? (await api('PUT', `/accounts/${st.account}/access/apps/${cur.id}`, app)).result : (await api('POST', `/accounts/${st.account}/access/apps`, app)).result;
    st.did.push(`${cur ? '' : '새 '}Access 앱 '${ACCESS_APP}'(Worker 단위, ${mask(email)}만)`);
    if (made?.aud) await putSecret(ADMIN, 'ACCESS_AUD', made.aud);
    await putSecret(ADMIN, 'ACCESS_EMAILS', email);
    await putSecret(ADMIN, 'ACCESS_TEAM_DOMAIN', org.result.auth_domain);
  });

  // ⑦ 내 도메인(선택)
  step('내 도메인·WAF(선택)', async () => {
    if (!o.domain) { st.skipped.push('내 도메인(없어도 됨. 있으면 --domain으로 WAF 규칙 1개까지)'); return; }
    if (!api) { st.todo.push('내 도메인: API 토큰으로 다시 돌리면 붙여요.'); return; }
    const parts = o.domain.toLowerCase().split('.');
    let zone = null;
    for (let i = 0; i < parts.length - 1 && !zone; i++) zone = ((await api('GET', `/zones?name=${parts.slice(i).join('.')}`)).result || [])[0] || null;
    if (!zone) throw new StepError(`${o.domain}의 영역(zone)이 이 계정에 없어요.`, '대시보드에서 도메인을 Cloudflare에 먼저 넣거나, --domain 없이 돌리세요(workers.dev로 충분해요).');
    if (write) await api('PUT', `/accounts/${st.account}/workers/domains`, { hostname: o.domain, service: SITES, zone_id: zone.id, environment: 'production' });
    await putSecret(SITES, 'PUBLIC_ORIGIN', `https://${o.domain}`);
    st.sitesUrl = `https://${o.domain}`; st.did.push(`내 도메인 ${o.domain}`);
    const rs = await api('GET', `/zones/${zone.id}/rulesets/phases/http_ratelimit/entrypoint`, null, { allow: [404] });
    const rules = rs.status === 404 ? [] : rs.result?.rules || [];
    if (rules.some((r) => r.description === WAF_RULE)) { st.skipped.push('WAF 규칙(이미 있음)'); return; }
    if (rules.length) { st.todo.push(`WAF: 이 영역에 속도 제한 규칙이 이미 있어(무료는 1개) 더하지 않았어요. README §10의 조건으로 바꿀지 보세요.`); return; }
    const rule = { description: WAF_RULE, expression: '(starts_with(http.request.uri.path, "/s/") or starts_with(http.request.uri.path, "/api/") or starts_with(http.request.uri.path, "/live/"))', action: 'block', ratelimit: { characteristics: ['cf.colo.id', 'ip.src'], period: 10, requests_per_period: 400, mitigation_timeout: 10 } };
    if (write) await api('PUT', `/zones/${zone.id}/rulesets/phases/http_ratelimit/entrypoint`, { rules: [rule] });
    st.did.push('WAF 속도 제한 규칙 1개(같은 IP 10초 400건)');
  });

  // ⑧ 확인
  step('확인', async () => {
    if (!st.sitesUrl || !write || env.LECPAGE_SKIP_VERIFY) return;
    try {
      const r = await io.fetch(`${st.sitesUrl}/api/info`, { headers: { 'user-agent': 'lecpage-setup/1' } });
      const j = await r.json();
      if (!j.ok) throw new Error('ok 아님');
      say(`  ${st.sitesUrl}/api/info → 보기 ${j.view}, 새 사이트 ${j.accepting ? '받는 중' : '안 받는 중'}`);
    } catch { st.todo.push(`${st.sitesUrl}/api/info 가 아직 답하지 않아요. workers.dev 주소는 처음에 몇 분 걸릴 수 있어요. 잠시 뒤 열어 보세요.`); }
  });

  // 실행
  const total = steps.length;
  for (let i = 0; i < total; i++) {
    const [name, fn] = steps[i];
    say(`\n[${i + 1}/${total}] ${name}`);
    try { await fn(); }
    catch (e) {
      say(`\n✗ 멈춘 곳: ${i + 1}/${total} ${name}`);
      say(`  까닭: ${e.message}`);
      if (e.next) say(`  다음에 할 일: ${e.next}`);
      say('  고친 뒤 같은 명령을 다시 돌리면 이어서 해요(이미 한 것은 건너뜀).');
      io.close?.();
      return { ok: false, failedAt: name, summary: st };
    }
  }
  // 앱 빌드 변수
  say('\n━━ 끝 ━━');
  for (const d of st.did) say(`  ✓ ${d}`);
  for (const s of st.skipped) say(`  · ${s}`);
  if (st.sitesUrl) {
    say(`\n앱 빌드 변수: VITE_PUBLISH_API=${st.sitesUrl}`);
    say('  GitHub Pages 미러: 저장소 Settings → Secrets and variables → Actions → Variables → LECPAGE_PUBLISH_API');
    say(`    (gh CLI가 있으면) gh variable set LECPAGE_PUBLISH_API --body ${st.sitesUrl}`);
    say('  Cloudflare Workers Builds: 앱 Worker → Settings → Build → Variables → VITE_PUBLISH_API');
  }
  if (st.adminUrl && !st.todo.some((t) => t.includes('관리 화면') || t.includes('Zero Trust'))) say(`관리 화면: ${st.adminUrl}/admin/ (Cloudflare Access 로그인)`);
  if (st.todo.length) { say('\n남은 일:'); st.todo.forEach((t, i) => say(`  ${i + 1}. ${t}`)); }
  if (write) {
    try {
      const dir = keyDir(); mkdirSync(dir, { recursive: true, mode: 0o700 });
      // 이메일·토큰은 적지 않음
      writeFileSync(join(dir, 'setup.json'), `${JSON.stringify({ at: new Date().toISOString(), account: st.account, view: st.view, sites: st.sitesUrl, admin: st.adminUrl, pages: st.pages?.host || '' }, null, 1)}\n`, { mode: 0o600 });
    } catch { /* 기록은 없어도 됨 */ }
  }
  io.close?.();
  return { ok: true, summary: st };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = await setup();
  process.exitCode = r.ok ? 0 : 1;
}
