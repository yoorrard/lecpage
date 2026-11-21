#!/usr/bin/env node
// lecpage CLI — Node 22 이상. check·handouts는 Playwright를 쓰고, 없으면 그 단계만 건너뜁니다.
// 기본 출력은 짧은 요약, --json을 붙이면 기계용 JSON.
// 흐름: prepare → (AI 에이전트가 교재 원본을 읽고 work/site/·work/lecpage.json을 직접 씀) → check → preview → app 또는 publish
//
//   prepare <교재...> [-o work]                    AI 에이전트가 사이트를 직접 쓸 준비: 쪽 그림 work/site/material/p-NNN.webp · 빈 lecpage.json · 경로 요약 work/README.md · PDF가 아닌 교재면 보조 글자 work/material.md
//   check [work] [--port 0] [--no-shots] [--host 배포할 곳]  work/site + lecpage.json(+ 강사 값 lecpage.teacher.json) 조립(work/dist) + 검수 + 390·1280 화면 그림(work/check/*.png). 고칠 곳이 있으면 종료 코드 1
//        --host(cloudflare·vercel·github-pages·netlify·onpod·lan·zip …, 없으면 지난번 배포한 곳): 개인정보 안내·운영안내를 그 배포 방식에 맞게
//   preview [work] [--port 4173] [--host 0.0.0.0] [--live]  조립 결과를 로컬로 띄움(강사 화면·발표 화면·QR 안내문 포함, 참여 기능은 연습 모드)
//        --live: 이 노트북이 참여 기능 서버(backends/node-server)까지 맡아 교실 와이파이의 여러 기기가 실제로 참여(QR은 와이파이 주소, 관리자 키는 강사용 폴더)
//   app [work] [-o 연수.lecpage]                   앱(웹)으로 넘기기: 사이트 폴더·연수 정보·쪽 그림·교재 원본을 앱이 여는 파일 하나로(비밀 값은 빼요)
//   app 연수.lecpage [-o work] [--force]            앱에서 [파일로 저장]한 연수를 작업 폴더로 풀어 이어서 작업
//   publish [work] [--host cloudflare|onpod] [--live] [--name 이름] [--dry-run] [--temporary] [--no-handouts]
//        조립해서 강사 Cloudflare 계정에 올리기. --live: 참여 기능 중계도 같은 계정에(관리자 키는 강사용 폴더에만) → 강사 값에 중계 주소 → 다시 조립 → 올림 → 주소 확인 → 안내물
//        --host onpod: Onpod(한국 서비스)에 사이트만(ONPOD_TOKEN). --host를 빼면 지난번에 올린 곳에 같은 주소로. --dry-run: 순서와 강사가 할 일만
//   handouts <올린 주소|work> [-o 폴더]   QR-안내문.pdf·발표화면.png(Playwright 필요)
//   pack <work|폴더> -o site.zip [--bundle-fonts] [--password 암호] [--host 배포할 곳] · serve <work|폴더> [--port 4173] [--live] · doctor · decide-infra [-i 답.json] [--size 30 …]
//        pack: 조립한 사이트를 ZIP으로 · doctor: 환경 점검과 설치 방법 · decide-infra: 배포할 곳 × 참여 기능 서버 추천
//   connect · studio [--port 6600] [--no-open] [--open lecpage|local] [--autostart] [--new-token] [--dist app/dist] [--remote] [--timeout 30]
//        lecpage 커넥트(studio는 예전 이름, 같은 명령): 앱을 http://127.0.0.1:<포트>/에서 열고, 앱이 이 PC에 설치·로그인된 Claude Code·Codex로 사이트를 만들게 함
//        (요청은 그 사람의 구독 한도에서 차감). 앱 파일은 app/dist가 있으면 그것, 없으면 lecpage.com에서 받음. 끄기: Ctrl+C (references/studio.md)
//   공통: --json(기계용 JSON) · <명령> --help(그 명령 도움말만, 실행하지 않음) · --version(판) · LECPAGE_DEBUG=1(오류 때 자세한 기록)
//   종료 코드: 0 성공 · 1 실패(check는 조립했어도 고칠 곳이 있으면 1) · 2 명령·옵션을 잘못 씀
import { readFileSync, writeFileSync, existsSync, statSync, createReadStream, mkdirSync } from 'node:fs';
import { join, extname, resolve, dirname, relative, isAbsolute } from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(HERE, '..', 'engine');
const DEBUG = !!process.env.LECPAGE_DEBUG;
// 판은 engine/package.json 하나에서(엔진 코드의 VERSION은 시험이 같은지 확인)
const SKILL_VERSION = (() => { try { return JSON.parse(readFileSync(join(ENGINE, 'package.json'), 'utf8')).version; } catch { return '?'; } })();
const UPDATE_HOW = '새 버전 받기: claude plugin update lecpage@lecpage(Claude Code 플러그인) · npx skills update(npx skills로 설치) · 그 밖에는 설치한 명령을 다시';

// ── 인자 ─────────────────────────────────────────
// 명령마다 받는 옵션. 모르는 옵션은 가까운 이름과 함께 멈추고(조용히 넘기지 않게), 값을 받는 옵션에 값이 없으면 멈춤
const VALUE_OPTS = new Set(['i', 'o', 'password', 'port', 'host', 'name', 'relay', 'features', 'today', 'size', 'skill', 'duration', 'network', 'infra', 'dist', 'timeout', 'open']);
const OPTS = {
  doctor: '', serve: 'port host live', pack: 'o bundle-fonts password host',
  'decide-infra': 'i size features skill duration network infra commercial minor',
  app: 'o force',
  publish: 'host live name relay dry-run temporary no-handouts no-verify no-bundle-fonts password',
  handouts: 'o password',
  prepare: 'o today no-slides no-python', check: 'port today no-shots no-tiles host no-python', preview: 'port host today live',
  studio: 'port no-open open autostart new-token dist remote timeout',
};
OPTS.connect = OPTS.studio; // lecpage 커넥트: connect = studio(예전 이름도 그대로)
const optList = (c) => [...(OPTS[c] || '').split(' ').filter(Boolean), 'json', 'help'];
const flag = (k) => (k.length === 1 ? '-' : '--') + k;
/** 글자 거리(오타 제안용) */
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const nearest = (w, list) => list.map((x) => [x, editDistance(w, x)]).filter(([x, n]) => n <= Math.max(2, Math.floor(x.length / 3))).sort((p, q) => p[1] - q[1]).map(([x]) => x)[0] || '';

/** process.argv → { cmd, args, problems } */
function parseArgs(argv) {
  let [cmd = '', ...rest] = argv;
  if (['--help', '-h', 'help'].includes(cmd)) { const c = rest[0] && !rest[0].startsWith('-') ? rest[0] : ''; return { cmd: c, args: { _: [], help: true }, problems: [] }; }
  if (['--version', '-v', 'version'].includes(cmd)) return { cmd: 'version', args: { _: [], json: rest.includes('--json') }, problems: [] };
  const allowed = new Set(optList(cmd));
  const args = { _: [] }, problems = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--') { args._.push(...rest.slice(i + 1)); break; }
    if (a === '-h') { args.help = true; continue; }
    let k = null, inline;
    if (a === '-o' || a === '-i') k = a.slice(1);
    else if (a.startsWith('--') && a.length > 2) [k, inline] = a.slice(2).split(/=(.*)/s);
    else if (/^-[A-Za-z]/.test(a)) { problems.push(`모르는 옵션 ${a}`); continue; }
    if (k === null) { args._.push(a); continue; }
    if (!allowed.has(k) && OPTS[cmd] !== undefined) {
      const near = nearest(k, optList(cmd));
      const other = Object.keys(OPTS).filter((c) => optList(c).includes(k));
      problems.push(`${cmd}에는 ${flag(k)} 옵션이 없어요${near ? ` — 혹시 ${flag(near)}?` : ''}${!near && other.length ? ` (${other.slice(0, 3).join('·')} 명령의 옵션이에요)` : ''}`);
      if (VALUE_OPTS.has(k) && inline === undefined && rest[i + 1] !== undefined && !rest[i + 1].startsWith('-')) i++; // 그 옵션의 값은 교재로 삼키지 않게 건너뜀
      continue;
    }
    if (!VALUE_OPTS.has(k)) {
      if (inline !== undefined && !/^(1|true|yes)$/i.test(inline)) problems.push(`${flag(k)}는 값을 받지 않아요: ${a}`);
      args[k] = true; continue;
    }
    let v = inline;
    if (v === undefined) {
      const nx = rest[i + 1];
      if (nx === undefined || (nx.startsWith('-') && nx.length > 1)) { problems.push(`${flag(k)} 뒤에 값이 없어요${k === 'password' ? "(암호 없이 만들지 않았어요. 예: --password '숲속바다햇살4821')" : ''}`); continue; }
      v = nx; i++;
    }
    if (k === 'password' && [...v].length < 4) problems.push('암호는 4자 이상이어야 해요(낱말 서너 개를 이어 쓰면 좋아요).');
    if (k === 'port' && !(/^\d{1,5}$/.test(v) && +v <= 65535)) problems.push(`--port는 숫자예요(0~65535): ${v}`);
    args[k] = v;
  }
  return { cmd, args, problems };
}
const parsed = parseArgs(process.argv.slice(2));
const { cmd, args } = parsed;
const JSON_OUT = !!args.json;

// Node 판: 엔진을 읽기 전에(낡은 Node에서 알 수 없는 문법 오류 대신 한 줄로)
if (+process.versions.node.split('.')[0] < 20) { console.error(`오류: Node.js 22 이상이 필요해요(지금 ${process.versions.node}). https://nodejs.org 에서 LTS를 설치하거나 nvm install 22 — 설치 뒤 node --version으로 확인해요.`); process.exit(1); }

// 프록시(HTTPS_PROXY) 뒤: Node의 fetch는 NODE_USE_ENV_PROXY=1로 시작할 때만 프록시를 탐(Node 22.21·24 이상).
// 인터넷을 쓰는 명령(교재 주소 받기·글꼴 받기·주소 확인)이면 그 변수를 붙여 한 번 다시 띄움. 이 컴퓨터 안 주소는 프록시를 거치지 않게 NO_PROXY에 더함
{
  const [maj, min] = process.versions.node.split('.').map(Number);
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  if (proxy && !process.env.NODE_USE_ENV_PROXY && !process.execArgv.includes('--use-env-proxy') && (maj >= 24 || (maj === 22 && min >= 21)) && ['prepare', 'publish', 'handouts', 'pack', 'studio', 'connect'].includes(cmd) && !args.help && !parsed.problems.length) {
    const local = 'localhost,127.0.0.1,::1';
    const np = [process.env.NO_PROXY || process.env.no_proxy, local].filter(Boolean).join(',');
    const r = spawnSync(process.execPath, [...process.execArgv, '--disable-warning=UNDICI-EHPA', ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1', NO_PROXY: np, no_proxy: np } });
    process.exit(r.status ?? 1);
  }
}

const imp = (p) => import(pathToFileURL(join(ENGINE, p)).href);
const E = await imp('src/index.js');
const N = await imp('node.js');

// ── 공통 ─────────────────────────────────────────
const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { fail(`JSON을 읽지 못했어요: ${p} (${e.code === 'ENOENT' ? '파일 없음' : e.message})`); } };
const writeJson = (p, v) => { mkdirSync(dirname(resolve(p)), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2) + '\n'); };
const rel = (p) => { if (!p) return ''; const r = relative(process.cwd(), p); if (!r) return '.'; return !r.startsWith('..') && !isAbsolute(r) ? r : p; };
const fail = (m, extra = {}) => { if (JSON_OUT) console.log(JSON.stringify({ ok: false, error: m, ...extra })); else console.error('오류: ' + m); process.exit(1); };
const say = (lines, json) => { if (JSON_OUT) console.log(JSON.stringify(json)); else console.log(lines.filter((l) => l !== null && l !== undefined && l !== '').join('\n')); };
const statePath = (work) => join(work, 'lecpage.state.json');
const loadState = (work) => { try { return JSON.parse(readFileSync(statePath(work), 'utf8')); } catch { return {}; } };
const saveState = (work, s) => writeJson(statePath(work), { ...loadState(work), ...s, updated: new Date().toISOString() });

async function ingestCli() { return imp('src/ingest/cli.js'); }

/** Playwright: ESM import → NODE_PATH(require) 순서로 찾음. 없으면 null */
async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 아래 */ }
  try { return createRequire(import.meta.url)('playwright'); } catch { return null; }
}

/** 정적 파일 서버(serve·preview·check 공용). 폴더 밖으로 나가는 경로와 잘못된 % 는 막음 */
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.enc': 'application/octet-stream' };
function staticServer(dir) {
  return createServer((req, res) => {
    let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end('bad request'); }
    if (p.endsWith('/')) p += 'index.html';
    const f = join(dir, p); const r = relative(dir, f);
    if (r.startsWith('..') || isAbsolute(r) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); createReadStream(f).pipe(res);
  });
}

// ── 명령 ─────────────────────────────────────────
const helpers = () => ({ args, E, N, rel, fail, say, readJson, writeJson, loadState, saveState, loadPlaywright, staticServer });
const commands = {
  /** 앱(웹)과 주고받기: 작업 폴더 → <연수 이름>.lecpage(앱 [저장한 파일 열기]), 앱에서 저장한 .lecpage → 작업 폴더 */
  async app() {
    const KC = await import('./kit-cmds.mjs');
    const src = resolve(args._[0] || 'work');
    if (!existsSync(src)) fail(`${rel(src)}가 없어요. 작업 폴더(work)나 앱에서 저장한 .lecpage 파일을 주세요.`);
    if (statSync(src).isFile()) {
      // .lecpage: 사이트가 있는 연수는 사이트 그대로, 예전 방식(설계도)으로 만든 연수는 교재·연수 정보만 옮김(사이트는 AI로 새로)
      const K = await imp('src/kit/index.js');
      let o; try { o = K.openProjectFile(readFileSync(src)); } catch (e) { fail(e.friendly ? e.message : `파일을 읽지 못했어요: ${e.message}`); }
      return o.kind === 'v2' ? KC.appUnpackV2(helpers(), o) : KC.appUnpackV1(helpers(), o);
    }
    if (!KC.isV2Work(src)) fail(`${rel(src)}는 작업 폴더가 아니에요(site/와 lecpage.json이 있어야 해요). prepare로 먼저 만들어 주세요.`);
    return KC.appPackV2(helpers(), src);
  },

  async doctor() {
    const has = (bin) => spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8' }).status === 0;
    const os = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'win' : 'linux';
    const fix = (o) => o[os] || o.linux;
    const checks = [];
    const major = +process.versions.node.split('.')[0];
    checks.push({ name: 'Node.js', ok: major >= 22, need: true, info: process.versions.node, use: '모든 명령', fix: fix({ linux: 'nvm install 22 (또는 https://nodejs.org)', mac: 'brew install node@22', win: 'winget install OpenJS.NodeJS.LTS' }) });
    const pw = await loadPlaywright();
    let chromium = false;
    if (pw) { try { const p = pw.chromium.executablePath(); chromium = !!p && existsSync(p); } catch { chromium = false; } }
    checks.push({ name: 'Playwright', ok: !!pw && chromium, info: pw ? (chromium ? 'chromium 있음' : 'chromium 없음') : '', use: '검수 화면 그림(check)·안내물(handouts)', fix: pw ? 'npx playwright install chromium' : 'npm i -D playwright && npx playwright install chromium' });
    // 쪽 그림·배포는 셸(bash·cmd) 없이 프로그램을 바로 부름(scripts/render-slides.mjs·publish.mjs): 같은 길로 찾음
    const RS = await import('./render-slides.mjs');
    const { npx } = await import('./publish.mjs');
    const nv = npx(['--version'], { encoding: 'utf8', timeout: 60000 });
    checks.push({ name: 'npx', ok: nv.status === 0, info: nv.status === 0 ? `npm ${String(nv.stdout).trim()}` : '', use: '배포(publish: Cloudflare·Onpod)', fix: 'Node.js 공식 설치본을 다시 설치(npm·npx 포함)' });
    checks.push({ name: 'LibreOffice', ok: !!RS.sofficePath(), use: 'PPTX·HWPX·DOCX 쪽 그림(PDF를 함께 주면 없어도 됨)', fix: fix({ linux: 'sudo apt-get install -y libreoffice-impress', mac: 'brew install --cask libreoffice', win: 'winget install TheDocumentFoundation.LibreOffice' }) });
    checks.push({ name: 'pdftoppm', ok: !!RS.pdftoppmPath(), use: '쪽 그림(교재 보기)', fix: fix({ linux: 'sudo apt-get install -y poppler-utils', mac: 'brew install poppler', win: 'winget install oschwartz10612.Poppler' }) });
    checks.push({ name: 'cwebp', ok: !!RS.findProgram(['cwebp']), use: '쪽 그림 용량 줄이기(없으면 PNG)', fix: fix({ linux: 'sudo apt-get install -y webp', mac: 'brew install webp', win: 'winget install Google.Libwebp' }) });
    const pyBin = await (await ingestCli()).findPython();
    const pyRun = (mod) => !!pyBin && spawnSync(pyBin[0], [...pyBin[1], '-c', 'import ' + mod], { encoding: 'utf8', windowsHide: true }).status === 0;
    const py = pyRun('pymupdf') || pyRun('fitz');
    let pdfjs = false; try { createRequire(import.meta.url).resolve('pdfjs-dist/package.json'); pdfjs = true; } catch { /* 없음 */ }
    checks.push({ name: 'PDF 읽기', ok: py || pdfjs, info: pdfjs ? 'pdfjs-dist' : py ? 'PyMuPDF' : '', use: 'PDF 교재 글 읽기', fix: 'pip install pymupdf (또는 npm i pdfjs-dist)' });
    if (os !== 'win' && has('fc-list')) {
      const ko = spawnSync('fc-list', [':lang=ko', 'family'], { encoding: 'utf8' }).stdout?.trim().split('\n').filter(Boolean).length || 0;
      checks.push({ name: '한글 글꼴', ok: ko > 0, info: ko ? `${ko}종` : '', use: '쪽 그림의 한글이 깨지지 않게', fix: fix({ linux: 'sudo apt-get install -y fonts-noto-cjk fonts-nanum', mac: '기본 포함' }) });
    }
    const lines = [`lecpage ${SKILL_VERSION} (${UPDATE_HOW})`, ...checks.map((c) => `${c.ok ? '✓' : c.need ? '✕' : '–'} ${c.name}${c.info ? ` ${c.info}` : ''}${c.ok ? '' : ` — ${c.use}: ${c.fix}`}`)];
    const missing = checks.filter((c) => !c.ok);
    lines.push(missing.some((c) => c.need) ? '필수 도구가 없어요. 위 명령으로 설치해 주세요.' : missing.length ? '만들기는 돼요. – 표시는 그 기능만 건너뛰어요.' : '모두 준비됐어요.');
    say(lines, { ok: !missing.some((c) => c.need), version: SKILL_VERSION, checks });
    process.exitCode = missing.some((c) => c.need) ? 1 : 0;
  },

  decideInfra() {
    const info = args.i ? readJson(args.i) : { size: +args.size || 30, features: String(args.features || '').split(',').filter(Boolean), skill: args.skill || 'click', duration: args.duration || 'day', network: args.network || 'good', infra: String(args.infra || '').split(',').filter(Boolean), commercial: !!args.commercial, minor: !!args.minor };
    const r = E.decideInfra(info);
    // 맨 앞 올릴 곳의 한 줄 명령·안내 파일과 백엔드 만드는 안내(skill 폴더 기준 경로)
    const GUIDE = { vercel: 'vercel', cloudflare: 'cloudflare', onpod: 'onpod', 'github-pages': 'github-pages', netlify: 'netlify', firebase: 'firebase', s3: 'aws-s3-cloudfront', server: 'own-server-nginx-caddy', lan: 'local-lan-classroom', zip: 'zip-usb-offline' };
    const BACKEND = { sheets: 'apps-script', supabase: 'supabase', cloudflare: 'cloudflare', server: 'node-server', lan: 'node-server' };
    const top = r.hostInfo[0];
    // publish가 대신 올리는 곳(Cloudflare·Onpod)은 그 명령을, 나머지는 한 줄 명령과 안내 파일
    const how = top ? (['cloudflare', 'onpod'].includes(top.id) ? `publish work${top.id === 'onpod' ? ' --host onpod' : ''} (먼저 --dry-run) · references/deploy/${top.id}.md` : [top.cli, GUIDE[top.id] && `references/deploy/${GUIDE[top.id]}.md`].filter(Boolean).join(' · ')) : '';
    say([
      `추천 ${r.backendInfo.name_ko}(${r.backend}, ${r.backendInfo.cost}${r.teacherSteps != null && r.backend !== 'none' ? `, 강사가 할 일 약 ${r.teacherSteps}번` : ''}) × 배포할 곳 ${r.hostInfo.map((h) => `${h.name_ko}(${h.id})`).join(' · ')}${r.hostSteps === 0 ? ' (첫째 곳은 이미 연결돼 강사가 더 할 일 없음)' : r.hostSteps != null ? ` (첫째 곳 강사가 할 일 약 ${r.hostSteps}번)` : ''}`,
      ...r.reasons.map((x) => '이유 ' + x), ...r.hostReasons.map((x) => '이유(배포할 곳) ' + x),
      how ? `배포 ${how}` : '',
      // 무료 한도를 넘으면 어떻게 되는지(멈추는지, 유료로 이어지는지). 강사에게 한 줄로 전하고 고르게 함
      [top?.atLimit_ko && `${top.name_ko}: ${top.atLimit_ko}`, r.backendInfo.atLimit_ko && `${r.backendInfo.name_ko}: ${r.backendInfo.atLimit_ko}`].filter(Boolean).map((x) => '한도 ' + x).join('\n'),
      ...r.warnings.map((x) => '주의 ' + x),
      r.alternatives.length ? `대안 ${r.alternatives.join(', ')}` : '',
      // 이미 연결해 둔 곳이 없으면: 가입 없는 길(앱의 바로 배포). skill은 바로 배포를 직접 부르지 않고 앱으로 넘김
      ![].concat(info.connected || []).length && !info.previous && info.network !== 'offline' ? '계정이 없으면 app work → 강사가 lecpage.com [저장한 파일 열기] → [배포하기]의 바로 배포(가입 없음, 60일 보관, 참여 기능 포함)' : '',
      r.backend === 'cloudflare' && top?.id === 'cloudflare' ? `한 번에 publish work --live (먼저 --dry-run)` : `참여 기능 서버 ${r.liveProvider}${BACKEND[r.backend] ? ` · 만들기 backends/${BACKEND[r.backend]}/README.md · 주소·키는 강사에게 받아 lecpage.teacher.json의 live로` : ''}`,
    ], r);
  },

  async serve() {
    const port = +args.port || 4173;
    const KC = await import('./kit-cmds.mjs');
    if (KC.isV2Work(resolve(args._[0] || 'dist'))) return KC.previewCmd(helpers()); // 작업 폴더(work)면 조립해서 띄움(--live면 참여 기능 서버까지)
    if (args.live) fail('--live는 작업 폴더(work)에서만 돼요(조립할 때 참여 기능 서버를 이 노트북으로 정해요). 예: serve work --live');
    if (!existsSync(join(resolve(args._[0] || 'dist'), 'index.html'))) fail(`${rel(resolve(args._[0] || 'dist'))}에 사이트가 없어요(index.html 없음). 작업 폴더(work)나 조립한 폴더(work/dist)를 주세요.`);
    staticServer(resolve(args._[0] || 'dist')).listen(port, args.host || '127.0.0.1', () => console.log(`미리보기: http://localhost:${port}/  (끝내려면 Ctrl+C${args.host ? '' : ' · 같은 와이파이의 다른 기기에서 보려면 --host 0.0.0.0'})`));
  },

  /** 올리기: Cloudflare 계정 하나에 사이트(+ --live면 참여 기능 중계)를 올리고 주소 확인·안내물까지(scripts/publish.mjs) */
  async publish() { const { publishCmd } = await import('./publish.mjs'); await publishCmd(helpers()); },
  /** 올린 주소 → 강사용 폴더에 QR-안내문.pdf·발표화면.png */
  async handouts() { const { handoutsCmd } = await import('./publish.mjs'); await handoutsCmd(helpers()); },

  /** AI 에이전트 흐름: 준비·조립 검수·미리보기(scripts/kit-cmds.mjs) */
  async prepare() { const { prepareCmd } = await import('./kit-cmds.mjs'); await prepareCmd(helpers()); },
  async check() { const { checkCmd } = await import('./kit-cmds.mjs'); await checkCmd(helpers()); },
  async preview() { const { previewCmd } = await import('./kit-cmds.mjs'); await previewCmd(helpers()); },
  /** lecpage 커넥트(connect = studio): 앱을 127.0.0.1에서 보여 주고 로컬 Claude Code·Codex에 일을 맡김(scripts/studio.mjs) */
  async studio() { const { studioCmd } = await import('./studio.mjs'); await studioCmd(helpers()); },

  async pack() {
    let dir = resolve(args._[0] || 'dist');
    const KC = await import('./kit-cmds.mjs');
    let notes = [];
    if (KC.isV2Work(dir)) { // 작업 폴더(work)면 조립한 사이트(work/dist)를 담음(--bundle-fonts: 글꼴 함께 담기, --password: 암호로 잠그기)
      const b = await KC.buildWorkV2(helpers(), dir, { fonts: !!args['bundle-fonts'], password: String(args.password || process.env.LECPAGE_PASSWORD || ''), host: String(args.host || '') });
      if (!b.ok) fail(b.errors.map((e) => e.message_ko).join(' '));
      dir = b.dist; notes = b.notes;
    }
    if (!existsSync(join(dir, 'index.html'))) fail(`${rel(dir)}에 사이트가 없어요(index.html 없음). 작업 폴더(work)나 조립한 폴더(work/dist)를 주세요. 예: pack work -o site.zip`);
    const files = N.readAssetDir(dir, '');
    const zip = E.zipFiles(files);
    const target = args.o || 'site.zip';
    mkdirSync(dirname(resolve(target)), { recursive: true });
    writeFileSync(target, zip);
    say([`→ ${target} (${Math.round(zip.length / 1024)}KB, 파일 ${Object.keys(files).length}개)`, ...notes], { ok: true, file: resolve(target), kb: Math.round(zip.length / 1024), files: Object.keys(files).length });
  },
};
commands['decide-infra'] = commands.decideInfra;
commands.connect = commands.studio;
delete commands.decideInfra;

/** 도움말: 이 파일 머리 주석. 명령을 주면 그 명령 줄과 이어지는 설명만 */
function helpText(c = '') {
  const lines = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1);
  const head = lines.slice(0, lines.findIndex((l) => !l.startsWith('//'))).map((l) => l.replace(/^\/\/ ?/, ''));
  if (!c) return head.join('\n');
  const blocks = []; let cur = null;
  for (const l of head) { if (/^  \S/.test(l)) blocks.push(cur = [l]); else if (/^ {3,}\S/.test(l) && cur) cur.push(l); else cur = null; }
  const mine = blocks.filter((b) => new RegExp(`(?:^  |· )${c.replace(/[-]/g, '\\-')}(?: |$)`).test(b[0]));
  return [head[0], ...mine.flat(), ...blocks.filter((b) => /^  (?:공통|종료 코드)/.test(b[0])).flat()].join('\n');
}
/** 던진 오류 → 한국어 한 줄 + 다음 할 일. 스택은 LECPAGE_DEBUG=1일 때만 */
function friendly(e) {
  if (!(e instanceof Error)) return String(e);
  const p = e.path || e.dest ? rel(String(e.path || e.dest)) : '';
  const native = e instanceof TypeError || e instanceof RangeError || e instanceof ReferenceError || e instanceof SyntaxError;
  if (e.friendly || (!native && !e.code && /[가-힣]/.test(e.message))) return e.message;
  const byCode = {
    ENOENT: `파일이나 폴더가 없어요: ${p}. 이름과 위치를 확인해 주세요.`,
    ENOTDIR: `${p}: 폴더가 들어갈 자리에 파일이 있어요. -o에는 새 폴더 이름을 주세요.`,
    EISDIR: `${p}: 파일이 들어갈 자리에 폴더가 있어요. 파일 이름을 주세요(예: -o site.zip).`,
    EEXIST: `${p}가 이미 있어요. 다른 이름을 주세요.`,
    EACCES: `${p}에 쓸 수 없어요(권한). 내 폴더 안의 다른 곳을 -o로 주세요.`, EPERM: `${p}에 쓸 수 없어요(권한). 내 폴더 안의 다른 곳을 -o로 주세요.`, EROFS: `${p}는 읽기 전용이에요. 다른 폴더를 -o로 주세요.`,
    ENOSPC: '디스크 공간이 모자라요. 공간을 비운 뒤 다시 해 주세요.',
    EADDRINUSE: `포트 ${e.port}를 다른 프로그램이 쓰고 있어요. --port ${(+e.port || 4172) + 1}처럼 다른 번호를 주세요.`,
  };
  if (byCode[e.code]) return byCode[e.code];
  return `예상하지 못한 오류예요: ${String(e.message).split('\n')[0].slice(0, 160)} — LECPAGE_DEBUG=1을 붙여 다시 실행하면 자세한 기록이 나와요. 고쳐지지 않으면 https://github.com/yoorrard/lecpage/issues 에 이 줄을 알려 주세요.`;
}
const crash = (e) => { if (DEBUG) console.error(e?.stack || e); fail(friendly(e)); };
process.on('uncaughtException', crash);
process.on('unhandledRejection', crash);

if (cmd === 'version') say([`lecpage ${SKILL_VERSION}`, `  ${UPDATE_HOW}`], { ok: true, version: SKILL_VERSION });
else if (args.help) console.log(helpText(commands[cmd] ? cmd : ''));
else if (!cmd || !commands[cmd]) {
  const near = cmd && nearest(cmd, Object.keys(commands));
  // 예전 방식(코드가 교재를 해석해 설계도로 그리던 흐름)의 명령: 없어졌다고 알리고 새 흐름을 안내
  const OLD = ['make', 'build', 'patch', 'draft', 'prompt', 'guard', 'validate', 'qa', 'brief', 'structure', 'design', 'options', 'presets', 'effects', 'review'];
  if (cmd) { const m = OLD.includes(cmd) ? `${cmd}는 예전 방식(설계도)의 명령이라 없어졌어요. 지금은 prepare 교재 -o work → AI 에이전트가 work/site/를 씀 → check work 순서예요(references/cli.md).` : `모르는 명령이에요: ${cmd}${near ? ` — 혹시 ${near}?` : ''} (명령 목록: lecpage.mjs --help)`; if (JSON_OUT) console.log(JSON.stringify({ ok: false, error: m })); else console.error('오류: ' + m); }
  else console.log(helpText());
  process.exitCode = cmd ? 2 : 0;
} else if (parsed.problems.length) {
  const m = parsed.problems.join(' / ') + ` (도움말: lecpage.mjs ${cmd} --help)`;
  if (JSON_OUT) console.log(JSON.stringify({ ok: false, error: m })); else console.error('오류: ' + m);
  process.exitCode = 2;
} else {
  try { await commands[cmd](); } catch (e) { crash(e); }
}
