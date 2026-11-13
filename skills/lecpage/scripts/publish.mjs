// 올리기(publish)와 인쇄용 안내물(handouts). lecpage.mjs가 부릅니다(도우미 h를 받아 씀).
//
// publish [work] --host cloudflare [--live] [--name 이름] [--dry-run]
//   Cloudflare 계정 하나에 사이트와 참여 기능(실시간 중계)을 함께 올립니다. --live면 순서대로:
//   1 중계 올리기(backends/cloudflare를 work/live-relay에 복사, 이 연수 코드만 받게) → 2 관리자 키를 만들어 중계 비밀로 넣고
//   <사이트>-강사용/관리자-키.txt에만 적음(화면·로그에 찍지 않음) → 3 사이트를 그 중계 주소에 이어 다시 빌드·점검
//   → 4 사이트 올리기(빈 임시 폴더에서, 위쪽 wrangler 설정을 읽지 않게) → 5 중계가 이 사이트에서 오는 요청만 받게
//   → 6 주소 확인(사이트·접속 확인·중계 /api/health) → 7 인쇄용 안내물(handouts)
//   인증은 강사가 해 둔 `npx wrangler@4 login` 또는 환경 변수 CLOUDFLARE_API_TOKEN(+CLOUDFLARE_ACCOUNT_ID)만 씁니다.
//   시험용: LECPAGE_WRANGLER=<가짜 wrangler 명령>이면 그 명령을 씀(실제 계정에 닿지 않게).
//
// publish [work] --host onpod [--name 이름] [--dry-run]
//   Onpod(한국 서비스)에 사이트만 올립니다(`onpod static deploy`, 인증 ONPOD_TOKEN). 아래 publishOnpod 참고.
//   --host를 빼면 지난번에 올린 곳에 같은 이름으로 다시 올립니다(처음이면 Cloudflare).
//
// handouts <주소|사이트 폴더> [-o 저장 폴더] [--password 암호]
//   QR-안내문.pdf(참가자용 A4 한 장) · 발표화면.png · 발표화면-QR-크게.png. Playwright가 없으면 건너뜀
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, copyFileSync, cpSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = join(HERE, '..');
const RELAY_SRC = join(SKILL, 'backends', 'cloudflare');
const WRANGLER_VER = (() => { try { return JSON.parse(readFileSync(join(RELAY_SRC, 'package.json'), 'utf8')).devDependencies.wrangler; } catch { return '4'; } })();
const NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const MiB = 1024 * 1024;

/** 사이트 폴더의 파일 수·가장 큰 파일(숨은 파일 포함: wrangler는 숨은 폴더도 올림) */
function siteStat(dir) {
  let files = 0, max = 0, bytes = 0, maxName = '';
  const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); const s = statSync(p); if (s.isDirectory()) walk(p); else { files++; bytes += s.size; if (s.size > max) { max = s.size; maxName = p; } } } };
  walk(dir);
  return { files, max, bytes, maxName };
}

/** wrangler 실행: 시험용 가짜 명령 → 고정 버전 npx. 비밀은 input(stdin)으로만 넘기고, 출력에서 토큰 모양은 가림 */
function wrangler(argv, { cwd, input } = {}) {
  const fake = process.env.LECPAGE_WRANGLER;
  const [cmd, pre] = fake ? [process.execPath, [fake]] : [process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', `wrangler@${WRANGLER_VER}`]];
  const r = spawnSync(cmd, [...pre, ...argv], { cwd, input, encoding: 'utf8', env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' }, maxBuffer: 32 * MiB, timeout: 10 * 60e3 });
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  return { ok: r.status === 0, out: redact(out), raw: out };
}
const redact = (s) => String(s).replace(/(CLOUDFLARE_API_TOKEN|ONPOD_TOKEN|token|Bearer)\s*[:=]?\s*[A-Za-z0-9_\-.]{20,}/gi, '$1 ***').replace(/\b(op_u_|opk_|op_p_)[A-Za-z0-9_-]{6,}/g, '$1***');
/** 출력에서 주소 찾기: https://<이름>.<계정>.workers.dev (시험용으로 http://127.0.0.1:포트도) */
function findUrl(out, name) {
  const esc = name.replace(/[-]/g, '\\-');
  const m = out.match(new RegExp(`https://${esc}\\.[a-z0-9-]+\\.workers\\.dev`)) || out.match(new RegExp(`https?://[^\\s"']*${esc}[^\\s"']*`));
  return m ? m[0].replace(/[.,)]+$/, '') : '';
}
const lastLines = (s, n = 6) => String(s).trim().split('\n').filter(Boolean).slice(-n).map((l) => '  ' + l.slice(0, 160));

async function check(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8000) }); if (r.ok) return { ok: true, status: r.status, body: await r.text().catch(() => '') }; if (i === tries - 1) return { ok: false, status: r.status }; }
    catch (e) { if (i === tries - 1) return { ok: false, status: e.name === 'TimeoutError' ? '시간 초과' : '연결 안 됨' }; }
    await new Promise((ok) => setTimeout(ok, 2500));
  }
  return { ok: false, status: '?' };
}

/** 이름: --name, 지난번에 올린 이름, 없으면 lec-<날짜>-<연수 코드 앞 4자> */
function siteName(h, bp, state) {
  const given = h.args.name || state.deploy?.name;
  if (given) return String(given).toLowerCase();
  const d = (bp.meta?.date || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  return `lec-${d}-${String(bp.live?.code || randomBytes(2).toString('hex')).slice(0, 4).toLowerCase()}`.replace(/[^a-z0-9-]/g, '');
}

/** 중계 폴더 준비: backends/cloudflare의 코드와 설정을 work/live-relay에(스킬 폴더를 더럽히지 않게). 이름·받을 연수 코드·보관 기간(설계도)을 적음 */
export function prepareRelay(dir, relayName, code, retentionDays = 30) {
  mkdirSync(dir, { recursive: true });
  cpSync(join(RELAY_SRC, 'src'), join(dir, 'src'), { recursive: true });
  copyFileSync(join(RELAY_SRC, 'package.json'), join(dir, 'package.json'));
  let toml = readFileSync(join(RELAY_SRC, 'wrangler.toml'), 'utf8');
  const days = Math.min(365, Math.max(1, Math.round(Number(retentionDays) || 30)));
  toml = toml.replace(/^name = ".*"$/m, `name = "${relayName}"`).replace(/^ALLOWED_CODES = ".*"$/m, `ALLOWED_CODES = "${code}"`).replace(/^RETENTION_DAYS = ".*"$/m, `RETENTION_DAYS = "${days}"`);
  writeFileSync(join(dir, 'wrangler.toml'), toml);
  if (!existsSync(join(dir, '.gitignore'))) writeFileSync(join(dir, '.gitignore'), 'node_modules\n.wrangler\n.dev.vars\n');
}

export async function publishCmd(h) {
  const { args, E, rel, fail, say, readJson, writeJson, loadState, saveState } = h;
  const dry = !!args['dry-run'];
  let work = resolve(args._[0] || 'work');
  if (existsSync(join(work, 'index.html')) && !existsSync(join(work, 'blueprint.json'))) work = join(dirname(work), 'work'); // dist를 줬으면 옆의 work
  const bpPath = join(work, 'blueprint.json');
  if (!existsSync(bpPath)) fail(`${rel(work)}에 blueprint.json이 없어요. make로 먼저 만들어 주세요(publish work).`);
  const state = loadState(work);
  const dist = resolve(work, state.out || '../dist');
  const tdir = dist + '-강사용';
  if (!existsSync(join(dist, 'index.html'))) fail(`${rel(dist)}에 사이트가 없어요. make나 patch로 먼저 빌드해 주세요.`);
  // --host가 없으면 지난번에 올린 곳(같은 주소로 다시). 처음이면 Cloudflare
  const host = String(args.host || state.deploy?.host || 'cloudflare');
  if (host !== 'cloudflare' && host !== 'onpod') {
    const H = E.HOSTS[host];
    fail(`publish는 지금 Cloudflare(사이트·참여 기능을 한 계정에)와 Onpod(사이트만)에 대신 올려요. ${H?.cli ? `${H.name_ko}는 한 줄 명령으로: ${H.cli}` : ''} 안내: references/deploy/${host}.md`);
  }
  const raw = readJson(bpPath);
  const bp = E.validate(raw).blueprint;
  if (host === 'onpod') return publishOnpod(h, { work, state, dist, tdir, bp, dry });
  const infoPath = state.info ? resolve(work, state.info) : join(work, 'info.json');
  const info = existsSync(infoPath) ? readJson(infoPath) : {};
  const live = !!args.live;
  // 연수 코드를 먼저 정해 둠: 중계는 이 코드만 받고(ALLOWED_CODES), 다시 빌드할 때 info.json의 live.code로 그대로 들어감
  const code = String(raw.live?.code || info.live?.code || bp.live.code);
  const name = siteName(h, bp, state);
  const relayName = String(args.relay || state.deploy?.relay?.name || `${name}-live`).toLowerCase().slice(0, 63).replace(/-+$/, '');
  if (!NAME_RE.test(name)) fail(`사이트 이름은 소문자·숫자·하이픈으로 63자까지예요: ${name} (--name으로 바꿔 주세요)`);
  if (live && !NAME_RE.test(relayName)) fail(`중계 이름을 확인해 주세요: ${relayName} (--relay)`);
  const lines = [];
  const warn = [];
  // 한도: wrangler로 올리면 20,000개·파일당 25MiB(--temporary는 1,000개·5MiB)
  const st = siteStat(dist);
  const lim = args.temporary ? { files: 1000, mb: 5 } : { files: 20000, mb: 25 };
  if (st.files > lim.files || st.max > lim.mb * MiB) fail(`Cloudflare 한도를 넘어요: 파일 ${st.files}개(한도 ${lim.files}) · 가장 큰 파일 ${Math.ceil(st.max / MiB)}MB(한도 ${lim.mb}MB, ${basename(st.maxName)}). 영상은 유튜브 링크로 바꾸거나 decide-infra의 다른 곳을 보세요.`);
  if (live && args.temporary) fail('--temporary(가입 전 임시 계정)에는 참여 기능을 올리지 않아요. 강사에게 가입과 로그인을 부탁한 뒤 다시 해 주세요.');
  if (live && ['supabase', 'sheets'].includes(info.live?.provider) && info.live?.url) fail(`이미 ${info.live.provider}에 참여 기능을 연결해 두었어요. --live 없이 올리면 그 연결 그대로 올라가요.`);
  // --features qa,poll: 켤 참여 기능을 info.json에 더함(다시 빌드할 때 질문·투표 칸이 생김)
  const want = args.features ? String(args.features).split(',').map((x) => x.trim()).filter(Boolean) : [];
  const feats = [...new Set([...(bp.live.features || []), ...(info.features || []), ...want])];
  if (live && !feats.length) warn.push('참여 기능이 꺼져 있어요. --features qa,poll을 붙이면 질문·투표 칸이 함께 생겨요(그대로 올리면 중계만 생김).');
  const auth = process.env.CLOUDFLARE_API_TOKEN ? 'token' : process.env.LECPAGE_WRANGLER ? 'fake' : '';
  const today = new Date().toISOString().slice(0, 10);
  const relayDir = join(work, 'live-relay');
  const keyFile = join(tdir, '관리자-키.txt');

  if (dry) {
    const W = `npx wrangler@${WRANGLER_VER}`;
    say([
      `배포 계획(--dry-run, 아무것도 바꾸지 않음) · Cloudflare · 사이트 ${name}${live ? ` · 중계 ${relayName}` : ''} · 파일 ${st.files}개 ${Math.round(st.bytes / 1024)}KB`,
      `인증 ${auth === 'token' ? 'CLOUDFLARE_API_TOKEN 있음' : '환경 변수 없음 → 실제로 배포할 때 wrangler 로그인을 확인해요'}`,
      ...(live ? [
        `1 중계 폴더 ${rel(relayDir)} ← backends/cloudflare (이름 ${relayName}, 받을 연수 코드 ${code})`,
        `2 관리자 키를 만들어 중계 비밀로(${W} secret put ADMIN_KEY, 값은 표준 입력) → ${rel(keyFile)}에만 적음(이미 있으면 그대로)`,
        `3 ${W} deploy -c wrangler.toml → https://${relayName}.<계정>.workers.dev · /api/health 확인`,
        `4 ${rel(infoPath)}의 live = { provider: "http", url: <중계 주소> }${want.length ? ` · features += ${want.join(',')}` : ''} → patch -i로 다시 빌드·점검(참여 기능 ${feats.join(',') || '없음'})`,
      ] : []),
      `${live ? 5 : 1} 빈 임시 폴더에서 ${W} deploy --assets ${rel(dist)} --name ${name} --compatibility-date ${today}${args.temporary ? ' --temporary' : ''} → https://${name}.<계정>.workers.dev`,
      live ? `6 ${W} deploy -c wrangler.toml --var ALLOWED_ORIGINS:<사이트 주소> (중계가 이 사이트만 받게)` : '',
      `${live ? 7 : 2} 주소 확인(사이트·check.html${live ? '·중계' : ''}) → handouts <주소>로 ${rel(tdir)}/QR-안내문.pdf·발표화면.png`,
      ...warn.map((w) => '주의 ' + w),
      '강사가 할 일:',
      auth === 'token' ? '  없음(토큰이 있어요). 명령에서 --dry-run을 빼고 다시 실행해요' : '  1. Cloudflare 가입(https://dash.cloudflare.com/sign-up, 이메일만, 결제 정보 없음)\n  2. 이 컴퓨터에서 npx wrangler@4 login을 실행하고 브라우저에서 [Allow] — 또는 Edit Cloudflare Workers 템플릿으로 만든 API 토큰을 CLOUDFLARE_API_TOKEN 환경 변수로 넣기(대화에 붙여 넣지 않기)',
      live ? '  3. 배포한 뒤 관리자 키 파일을 비밀번호 관리 앱에 옮기고 파일 지우기' : '',
    ], { ok: true, dryRun: true, host, name, relay: live ? relayName : '', files: st.files, auth: auth || 'unknown' });
    return;
  }

  // 인증 확인(토큰이 없으면 로그인 상태를 봄)
  if (!auth) {
    const who = wrangler(['whoami']);
    if (!who.ok || /not authenticated|You are not logged in/i.test(who.raw)) fail('Cloudflare 로그인이 필요해요. 강사에게 이 컴퓨터에서 `npx wrangler@4 login`(브라우저에서 승인)을 부탁하거나, API 토큰(Edit Cloudflare Workers 템플릿)을 CLOUDFLARE_API_TOKEN·CLOUDFLARE_ACCOUNT_ID 환경 변수로 받아 다시 실행해 주세요. 계정이 없으면 강사 동의를 받고 --temporary(사이트만, 60분 안에 claim).');
  }

  let relayUrl = '';
  if (live) {
    prepareRelay(relayDir, relayName, code, bp.privacy?.retentionDays); // 개인정보 안내에 적힌 보관 기간 그대로
    const sl = wrangler(['secret', 'list', '-c', 'wrangler.toml'], { cwd: relayDir });
    if (sl.ok && /ADMIN_KEY/.test(sl.raw)) lines.push(`관리자 키 그대로(지난번에 만든 키${existsSync(keyFile) ? `: ${rel(keyFile)}` : '. 처음 건넨 파일이나 비밀번호 관리 앱에 있어요'})`);
    else {
      const key = randomBytes(12).toString('hex');
      const sp = wrangler(['secret', 'put', 'ADMIN_KEY', '-c', 'wrangler.toml'], { cwd: relayDir, input: key });
      if (!sp.ok) fail('관리자 키를 중계에 넣지 못했어요.\n' + lastLines(sp.out).join('\n'));
      mkdirSync(tdir, { recursive: true });
      writeFileSync(keyFile, key + '\n', { mode: 0o600 });
      lines.push(`관리자 키 만듦 → ${rel(keyFile)}(본인만 읽기. 화면에는 찍지 않아요)`);
    }
    const dep = wrangler(['deploy', '-c', 'wrangler.toml'], { cwd: relayDir });
    relayUrl = findUrl(dep.raw, relayName);
    if (!dep.ok || !relayUrl) fail(`중계를 올리지 못했어요${/onboarding|workers\.dev subdomain/i.test(dep.raw) ? '. 새 계정이면 강사가 오류에 나온 dash.cloudflare.com/…/workers/onboarding을 한 번 열어 workers.dev 이름을 정해야 해요' : ''}.\n` + lastLines(dep.out).join('\n'));
    if (!args['no-verify']) { const hc = await check(relayUrl.replace(/\/$/, '') + '/api/health'); lines.push(`중계 ${hc.ok ? '✓' : '△'} ${relayUrl}${hc.ok ? '' : ` (/api/health ${hc.status}, 몇 분 뒤 다시 확인)`}`); }
    else lines.push(`중계 ${relayUrl}`);
    // 사이트를 중계에 이어 다시 빌드·점검(patch -i: 강사 계정에 만든 값만 info.json으로 넣는 규칙 그대로)
    const nextInfo = { ...info, ...(want.length ? { features: [...new Set([...(info.features || []), ...want])] } : {}), live: { ...(info.live || {}), provider: 'http', url: relayUrl, code } };
    writeJson(infoPath, nextInfo);
    if (!state.info) h.saveState(work, { info: 'info.json' });
    const pa = spawnSync(process.execPath, [join(HERE, 'lecpage.mjs'), 'patch', bpPath, '-i', infoPath, ...(args['no-qa'] ? [] : ['--qa']), ...(args.password ? ['--password', args.password] : [])], { encoding: 'utf8', env: process.env, maxBuffer: 32 * MiB });
    const pl = String(pa.stdout || '').split('\n');
    lines.push(...pl.filter((l) => /^(사이트|점검|고침)/.test(l)).map((l) => '다시 빌드 ' + l));
    if (pa.status !== 0 && !/점검/.test(pa.stdout || '')) fail('사이트를 중계에 잇지 못했어요.\n' + lastLines(`${pa.stdout}\n${pa.stderr}`).join('\n'));
  }

  // 사이트 올리기: 빈 임시 폴더에서(위쪽 폴더의 wrangler.json·jsonc·toml을 읽지 않게)
  if (existsSync(join(dist, '.git')) && !existsSync(join(dist, '.assetsignore'))) copyFileSync(join(SKILL, 'templates', 'deploy', 'cloudflare', '.assetsignore'), join(dist, '.assetsignore'));
  const tmp = mkdtempSync(join(tmpdir(), 'lecpage-pub-'));
  const sd = wrangler(['deploy', '--assets', dist, '--name', name, '--compatibility-date', today, ...(args.temporary ? ['--temporary'] : [])], { cwd: tmp });
  rmSync(tmp, { recursive: true, force: true });
  const site = findUrl(sd.raw, name);
  if (!sd.ok || !site) fail('사이트를 배포하지 못했어요.\n' + lastLines(sd.out).join('\n'));
  const claim = args.temporary ? (sd.raw.match(/https:\/\/[^\s]*claim[^\s]*/i) || [''])[0] : '';
  const siteBase = site.replace(/\/?$/, '/');

  // 중계가 이 사이트에서 오는 요청만 받게
  if (live) {
    const lo = wrangler(['deploy', '-c', 'wrangler.toml', '--var', `ALLOWED_ORIGINS:${siteBase.replace(/\/$/, '')}`], { cwd: relayDir });
    lines.push(lo.ok ? `중계가 받는 곳 ${siteBase.replace(/\/$/, '')}만` : '△ 중계의 받는 곳을 정하지 못했어요(모든 사이트에서 받는 상태). 다시 publish 하면 이어서 해요.');
  }

  // 확인
  if (!args['no-verify']) {
    const a = await check(siteBase), c = await check(siteBase + 'check.html');
    lines.push(`사이트 ${a.ok && c.ok ? '✓' : '△'} ${siteBase} (첫 화면 ${a.status} · 접속 확인 ${c.status})${a.ok ? '' : ' — 새 주소는 1~2분 걸릴 수 있어요. 잠시 뒤 다시 확인해 주세요'}`);
  } else lines.push(`사이트 ${siteBase} (확인 건너뜀)`);
  saveState(work, { deploy: { host, name, url: siteBase, relay: live ? { name: relayName, url: relayUrl } : state.deploy?.relay || null, at: new Date().toISOString() } });

  // 인쇄용 안내물
  let ho = null;
  if (!args['no-handouts']) ho = await handoutsCmd(h, { url: siteBase, out: tdir, quiet: true });
  say([
    `올렸어요 ✓ ${siteBase}`,
    ...lines,
    claim ? `임시 계정이에요. 60분 안에 강사가 ${claim}에서 가입해야 사이트가 남아요` : '',
    `참가자 ${siteBase} · QR 안내문 ${siteBase}poster.html · 발표 화면 ${siteBase}screen.html${live || bp.live.provider !== 'none' ? ` · 강사 화면 ${siteBase}console.html(도움말 칸에 연수 후 할 일)` : ''} · 접속 확인 ${siteBase}check.html`,
    ...(ho ? ho.lines : []),
    live ? `건넬 것: 관리자 키 파일 ${rel(keyFile)} — 비밀번호 관리 앱에 옮긴 뒤 파일 지우기. 키를 대화에 적지 않아요` : '',
    `다시 배포: 같은 명령(주소 그대로) · 강사용 폴더 ${rel(tdir)}는 배포하지 않아요`,
  ], { ok: true, host, url: siteBase, name, relay: live ? { name: relayName, url: relayUrl } : null, claim, handouts: ho?.files || [] });
}

// ── Onpod(한국 서비스): 사이트만 올림. 참여 기능 중계는 Cloudflare(publish --host cloudflare --live)·Supabase·시트 ──
// 근거: docs/research/hosting-2026-11.md §12(2026-11-13). `onpod static deploy <폴더> --name <이름>`, 인증은 ONPOD_TOKEN 또는 `onpod login --token`.
// Onpod은 점으로 시작하는 파일을 빼고 올리고 _headers를 읽지 않음(문서에 없음) → 올리는 사본에서 _headers를 빼고, 보안은 쪽마다 있는 meta CSP가 맡음.
// AI-Ready(기본 켜짐): 사이트에 없으면 Onpod이 llms.txt·sitemap.xml을 채움. 검색 제외 사이트는 짧은 llms.txt와 빈 sitemap.xml을 함께 올려
// 쪽 목록(강사 화면 포함)이 나가지 않게 하고, 공개 사이트는 첫 화면만 담은 sitemap.xml과 robots.txt의 Sitemap 줄을 올림. dist는 그대로 둠.
// 시험용: LECPAGE_ONPOD=<가짜 onpod 명령>이면 그 명령을 씀(실제 계정에 닿지 않게)
const ONPOD_LIMIT = { files: 5000, fileMB: 50, siteMB: 100 };
let onpodBin = null;
function onpodRun(argv, { cwd } = {}) {
  const fake = process.env.LECPAGE_ONPOD;
  // 이미 깔린 onpod이 있으면 그것, 없으면 npx. CDN이 최신 바이너리만 주므로 버전을 고정하지 않음(고정하면 해시가 안 맞아 설치가 멈춤)
  if (!fake && onpodBin === null) onpodBin = spawnSync('onpod', ['--version'], { encoding: 'utf8', timeout: 20e3 }).status === 0;
  const [cmd, pre] = fake ? [process.execPath, [fake]] : onpodBin ? ['onpod', []] : [process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'onpod@latest']];
  const r = spawnSync(cmd, [...pre, ...argv], { cwd, encoding: 'utf8', env: process.env, maxBuffer: 32 * MiB, timeout: 10 * 60e3 });
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  return { ok: r.status === 0, out: redact(out), raw: out };
}
const LLMS_PRIVATE = '# 연수 참가자용 사이트\n\n> 주소를 받은 참가자만 보는 연수 사이트예요. 검색·AI 수집 대상이 아니에요(robots.txt).\n';
const sitemapXml = (urls) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${u}</loc></url>`).join('')}</urlset>\n`;
/** 올릴 사본: _headers·점 파일을 빼고(.well-known은 남김), 공개 범위에 맞는 llms.txt·sitemap.xml·robots.txt를 더함 */
export function onpodStage(dist, { publicSite, url }) {
  const stage = mkdtempSync(join(tmpdir(), 'lecpage-onpod-'));
  cpSync(dist, stage, { recursive: true, filter: (src) => { if (src === dist) return true; const b = basename(src); return !(b.startsWith('.') && b !== '.well-known') && !(b === '_headers' && dirname(src) === dist); } });
  const added = [];
  const put = (f, text) => { if (!existsSync(join(stage, f))) { writeFileSync(join(stage, f), text); added.push(f); } };
  if (publicSite) {
    put('sitemap.xml', sitemapXml([url]));
    const rb = join(stage, 'robots.txt');
    const r = existsSync(rb) ? readFileSync(rb, 'utf8') : 'User-agent: *\nAllow: /\n';
    if (!/^sitemap:/im.test(r)) { writeFileSync(rb, r.replace(/\n*$/, '\n') + `Sitemap: ${url}sitemap.xml\n`); added.push('robots.txt의 Sitemap 줄'); }
  } else {
    put('llms.txt', LLMS_PRIVATE);
    put('sitemap.xml', sitemapXml([]));
  }
  return { stage, added };
}

async function publishOnpod(h, { work, state, dist, tdir, bp, dry }) {
  const { args, rel, fail, say, saveState } = h;
  if (args.live) fail('Onpod에는 사이트만 올려요. 참여 기능 중계는 publish work --host cloudflare --live로 올리거나, Supabase·구글 시트를 연결한 뒤 --live 없이 다시 해 주세요.');
  if (args.temporary) fail('Onpod에는 가입 없이 올리는 임시 주소가 없어요. 계정 없이 먼저 보려면 --host cloudflare --temporary를 써 주세요.');
  // 이름: --name, 지난번 Onpod 이름, 없으면 lec-<날짜>-<코드>(다른 곳에 올린 이름은 Onpod에서 이미 쓰일 수 있어 이어 쓰지 않음)
  const name = siteName(h, bp, state.deploy?.host === 'onpod' ? state : { ...state, deploy: null });
  if (!NAME_RE.test(name)) fail(`사이트 이름은 소문자·숫자·하이픈으로 63자까지예요: ${name} (--name으로 바꿔 주세요)`);
  const siteBase = `https://${name}.onpod.ai/`;
  const publicSite = bp.access?.mode === 'public';
  const { stage, added } = onpodStage(dist, { publicSite, url: siteBase });
  const cleanup = () => rmSync(stage, { recursive: true, force: true });
  const st = siteStat(stage);
  if (st.files > ONPOD_LIMIT.files || st.max > ONPOD_LIMIT.fileMB * MiB || st.bytes > ONPOD_LIMIT.siteMB * 1e6) {
    cleanup();
    fail(`Onpod 무료 한도를 넘어요: 파일 ${st.files}개(한도 ${ONPOD_LIMIT.files}) · 가장 큰 파일 ${Math.ceil(st.max / MiB)}MB(한도 ${ONPOD_LIMIT.fileMB}MB, ${basename(st.maxName)}) · 합계 ${Math.ceil(st.bytes / 1e6)}MB(한도 ${ONPOD_LIMIT.siteMB}MB). 영상은 유튜브 링크로 바꾸거나 --host cloudflare로 올려 주세요.`);
  }
  const auth = process.env.ONPOD_TOKEN ? 'token' : '';
  // 참여 기능 중계(Cloudflare)가 지난 사이트 주소만 받게 돼 있으면 새 주소도 받게 고쳐야 질문·투표가 이어짐
  const relayDir = join(work, 'live-relay');
  const relay = state.deploy?.relay?.name && existsSync(join(relayDir, 'wrangler.toml')) ? state.deploy.relay : null;
  const allow = (u) => [...new Set([state.deploy?.url, u].filter(Boolean).map((x) => x.replace(/\/$/, '')))].join(',');
  const verify = !args['no-verify'];
  if (dry) {
    cleanup();
    say([
      `배포 계획(--dry-run, 아무것도 바꾸지 않음) · Onpod · 사이트 ${name} · 파일 ${st.files}개 ${Math.round(st.bytes / 1024)}KB`,
      `인증 ${auth ? 'ONPOD_TOKEN 있음' : '환경 변수 없음 → 실제로 배포할 때 onpod whoami로 로그인을 확인해요'}`,
      `1 올릴 사본(빈 임시 폴더): _headers·점 파일 빼기${added.length ? ` · 더하기 ${added.join(', ')}` : ''}(${publicSite ? '공개 연수: 첫 화면만 담은 sitemap' : '검색 제외: Onpod이 쪽 목록을 자동으로 내지 않게'})`,
      `2 onpod static deploy <사본> --name ${name} --no-spa → ${siteBase}`,
      relay ? `3 참여 기능 중계 ${relay.name}가 새 주소도 받게: wrangler deploy -c wrangler.toml --var ALLOWED_ORIGINS:${allow(siteBase)}` : '',
      `${relay ? 4 : 3} 주소 확인(사이트·check) → handouts <주소>로 ${rel(tdir)}/QR-안내문.pdf·발표화면.png`,
      '강사가 할 일:',
      auth ? '  없음(키가 있어요). 명령에서 --dry-run을 빼고 다시 실행해요' : '  1. https://console.onpod.ai/signup 에서 구글 계정으로 가입(카드 없음)\n  2. 콘솔의 API 키 화면에서 키를 만들어 복사\n  3. 이 컴퓨터의 환경 변수 ONPOD_TOKEN에 넣기(대화에 붙여 넣지 않기). 또는 터미널에서 onpod login --token <키>',
      '알아 둘 점: 무료는 계정당 사이트 10개·사이트 100MB·월 100GB(넘으면 그달 멈췄다가 다음 달 1일에 다시 열림). 주소 이름은 Onpod 전체에서 하나뿐이에요.',
    ], { ok: true, dryRun: true, host: 'onpod', name, url: siteBase, files: st.files, added, auth: auth || 'unknown' });
    return;
  }
  if (!auth) {
    const who = onpodRun(['whoami']);
    if (!who.ok) { cleanup(); fail('Onpod 로그인이 필요해요. 강사에게 https://console.onpod.ai/signup 가입(구글) → 콘솔 API 키 화면에서 키 만들기를 부탁하고, 그 키를 환경 변수 ONPOD_TOKEN으로 받아 다시 실행해 주세요(대화에 붙여 넣지 않기).\n' + lastLines(who.out, 3).join('\n')); }
  }
  const dep = onpodRun(['static', 'deploy', stage, '--name', name, '--no-spa', ...(verify ? [] : ['--no-verify'])], { cwd: stage });
  cleanup();
  if (!dep.ok) {
    const t = dep.raw;
    const why = /already|taken|exists|conflict|409|이미|다른 사람/i.test(t) ? `이 주소 이름(${name})은 이미 다른 사람이 써요. Onpod 주소는 전체에서 하나뿐이라 --name 다른-이름 으로 다시 해 주세요.`
      : /401|unauthori|invalid.*(token|key)|토큰|키가/i.test(t) ? 'Onpod 키가 맞지 않거나 기한이 지났어요. 콘솔 API 키 화면에서 새 키를 만들어 ONPOD_TOKEN에 넣어 주세요.'
      : /402|limit|quota|한도/i.test(t) ? '무료 한도(사이트 10개 등)에 닿았어요. onpod static ls로 안 쓰는 사이트를 보고 onpod static rm <이름> --yes로 지우거나, --host cloudflare로 올려 주세요.'
      : '사이트를 배포하지 못했어요.';
    fail(why + '\n' + lastLines(dep.out).join('\n'));
  }
  const found = dep.raw.match(new RegExp(`https://${name.replace(/-/g, '\\-')}\\.onpod\\.ai`)) || dep.raw.match(/https:\/\/[a-z0-9-]+\.onpod\.ai/);
  const url = (found ? found[0] : siteBase).replace(/\/?$/, '/');
  const lines = [];
  if (added.length) lines.push(`함께 올림 ${added.join(', ')}(${publicSite ? '공개 연수' : '검색 제외 그대로'})`);
  if (relay) {
    const lo = wrangler(['deploy', '-c', 'wrangler.toml', '--var', `ALLOWED_ORIGINS:${allow(url)}`], { cwd: relayDir });
    lines.push(lo.ok ? `참여 기능 중계 ${relay.name}가 새 주소도 받아요` : '△ 참여 기능 중계가 아직 지난 주소만 받아요. Cloudflare에 로그인한 뒤 publish work --host cloudflare --live로 다시 맞춰 주세요');
  }
  if (verify) {
    const a = await check(url), c = await check(url + 'check.html');
    lines.push(`사이트 ${a.ok && c.ok ? '✓' : '△'} ${url} (첫 화면 ${a.status} · 접속 확인 ${c.status})${a.ok ? '' : ' — 잠시 뒤 다시 확인해 주세요'}`);
  } else lines.push(`사이트 ${url} (확인 건너뜀)`);
  saveState(work, { deploy: { host: 'onpod', name, url, relay: state.deploy?.relay || null, at: new Date().toISOString() } });
  let ho = null;
  if (!args['no-handouts']) ho = await handoutsCmd(h, { url, out: tdir, quiet: true });
  say([
    `올렸어요 ✓ ${url}`,
    ...lines,
    `참가자 ${url} · QR 안내문 ${url}poster.html · 발표 화면 ${url}screen.html${bp.live.provider !== 'none' ? ` · 강사 화면 ${url}console.html` : ''} · 접속 확인 ${url}check.html`,
    ...(ho ? ho.lines : []),
    '무료 한도: 계정당 사이트 10개·월 100GB(넘으면 그달 멈췄다가 다음 달 1일에 다시 열림). 그림을 같은 파일 이름으로 바꿔 올리면 최대 1시간 옛것이 보여요',
    `다시 배포: publish work(주소 그대로) · 강사용 폴더 ${rel(tdir)}는 배포하지 않아요`,
  ], { ok: true, host: 'onpod', url, name, added, handouts: ho?.files || [] });
}

export async function handoutsCmd(h, o = {}) {
  const { args, rel, fail, say, loadPlaywright, staticServer } = h;
  let target = o.url || args._[0];
  if (!target) fail('배포한 주소(https://…)나 사이트 폴더를 주세요. 예: handouts https://lec-20261203.example.workers.dev');
  let out = resolve(o.out || args.o || '');
  let server = null, local = false;
  if (!/^https?:\/\//i.test(target)) {
    const dir = resolve(target);
    if (!existsSync(join(dir, 'poster.html'))) fail(`${rel(dir)}에 poster.html이 없어요.`);
    if (!o.out && !args.o) out = dir + '-강사용';
    server = staticServer(dir); await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    target = `http://127.0.0.1:${server.address().port}/`; local = true;
  } else if (!o.out && !args.o) {
    // 작업 폴더(work)가 옆에 있으면 그 사이트의 강사용 폴더, 없으면 ./dist-강사용
    const st = h.loadState(resolve('work'));
    out = st.out ? resolve('work', st.out) + '-강사용' : resolve('dist-강사용');
  }
  const base = target.replace(/[?#].*$/, '').replace(/\/[^/]*\.html$/, '/').replace(/\/?$/, '/');
  if (/^http:\/\/(127\.0\.0\.1|localhost)/.test(base)) local = true;
  const pw = args.password || process.env.LECPAGE_PASSWORD || '';
  const frag = pw ? '#k=' + encodeURIComponent(pw) : '';
  const pwr = await loadPlaywright();
  const finish = (lines, files) => { if (server) server.close(); if (!o.quiet) say(lines, { ok: true, files, local }); return { lines, files }; };
  if (!pwr) return finish([`안내물 건너뜀(Playwright 없음): ${base}poster.html을 열어 [인쇄하기] → PDF로 저장, 발표 화면은 ${base}screen.html`], []);
  let browser;
  try { browser = await pwr.chromium.launch(); } catch { return finish(['안내물 건너뜀(Chromium 실행 실패: npx playwright install chromium)'], []); }
  mkdirSync(out, { recursive: true });
  const files = [], errs = [];
  try {
    const p = await browser.newPage({ viewport: { width: 900, height: 1270 } });
    p.on('pageerror', (e) => errs.push('poster: ' + e.message));
    await p.goto(base + 'poster.html' + frag, { waitUntil: 'load', timeout: 30000 });
    await p.waitForSelector('[data-qr-self] svg, [data-qr-self] img, [data-qr-self] canvas', { timeout: 15000 }).catch(() => errs.push('QR이 그려지지 않았어요'));
    await p.waitForTimeout(300);
    const shown = (await p.locator('[data-url-self]').first().textContent().catch(() => '')) || '';
    // 참가자용 A4 한 장(pdf는 언제나 인쇄 모양으로 그림). 강사 화면 주소·QR은 안내문에 싣지 않음(휴대폰으로 여는 QR은 강사 화면 안에만)
    await p.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, path: join(out, 'QR-안내문.pdf') }); files.push('QR-안내문.pdf');
    await p.close();
    const s = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    s.on('pageerror', (e) => errs.push('screen: ' + e.message));
    await s.goto(base + 'screen.html' + frag, { waitUntil: 'load', timeout: 30000 });
    await s.waitForSelector('[data-qr-join] svg, [data-qr-join] img', { timeout: 15000 }).catch(() => {});
    await s.waitForTimeout(600);
    await s.screenshot({ path: join(out, '발표화면.png') }); files.push('발표화면.png');
    const zoom = s.locator('[data-join-zoom]:not([disabled])');
    if (await zoom.count()) { await zoom.click(); await s.waitForTimeout(500); await s.screenshot({ path: join(out, '발표화면-QR-크게.png') }); files.push('발표화면-QR-크게.png'); }
    await s.close();
    await browser.close();
    return finish([
      `안내물 ${errs.length ? '△' : '✓'} ${rel(out)}/ ${files.join(' · ')}${shown ? ` (QR 주소 ${shown.trim().slice(0, 60)})` : ''}`,
      local ? '  주의: 로컬 주소라 QR이 다른 기기에서 열리지 않아요. 배포한 뒤 handouts <배포한 주소>로 다시 만드세요' : '',
      '  QR-안내문.pdf는 참가자용 A4 한 장이에요. 발표화면.png는 슬라이드에 넣어도 돼요. 휴대폰으로 강사 화면을 열려면 강사 화면의 [더보기] → [휴대폰에서 열기]',
      ...errs.slice(0, 3).map((e) => '  오류 ' + e.slice(0, 120)),
    ], files);
  } catch (e) {
    await browser.close().catch(() => {});
    return finish([`안내물 ✕ ${e.message.split('\n')[0].slice(0, 140)}`], files);
  }
}
