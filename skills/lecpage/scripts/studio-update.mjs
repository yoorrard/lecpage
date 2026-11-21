// lecpage 커넥트 새 판으로 바꾸기(스스로, 켜 둔 채로). 받은 실행 파일(lecpage-connect.cmd/.sh)이 켤 때 하는 일과 같은 것을 켜 둔 동안에도:
// GitHub 릴리스(studio-latest)의 VERSION이 지금 판과 다르면 묶음(lecpage-connect.tar.gz)을 받아 SHA-256(.sha256)을 확인하고,
// 옆 폴더에 푼 뒤 폴더 이름을 바꿔 갈아 끼움(예전 판은 <폴더>.old로 남김) → 같은 인자·같은 포트·같은 짝 맞춤 토큰으로 다시 켬.
// 다시 켜기: 처음 바꿀 때 이 프로세스가 작은 감독이 되어 새 판을 자식으로 띄우고(같은 창·같은 출력), 자식이 다시 바꾸면 종료 코드 75로
// 알려 감독이 새로 띄움(프로세스는 늘 둘까지). 새 판이 켜지자마자 실패하면 예전 판으로 되돌려 한 번 더 띄움.
// 안전: 받는 곳은 고정 주소(https)뿐 · 확인(SHA-256) 전에는 아무것도 바꾸지 않음 · 묶음 밖 경로·링크는 풀지 않음 · 작업 중에는 바꾸지 않음(studio.mjs가 확인)
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync, rmSync, renameSync, existsSync, statSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';

/** 받는 곳(실행 파일 scripts/studio-launcher/*과 같은 릴리스) */
export const RELEASE = 'https://github.com/yoorrard/lecpage/releases/download/studio-latest';
export const ASSET = 'lecpage-connect.tar.gz';
/** 감독에게 '새 판으로 다시 띄워 줘'를 알리는 종료 코드 */
export const RESTART_CODE = 75;
const MB = 1024 * 1024;
const VER_RE = /^[\w.+-]{1,64}$/;
const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };

/** 묶음의 판 이름(VERSION, 예: 1.1.0-26e7556). 없으면 '' */
export function readBuild(root) {
  try { const v = readFileSync(join(root, 'VERSION'), 'utf8').trim(); return VER_RE.test(v) ? v : ''; } catch { return ''; }
}
/** 받은 실행 파일이 풀어 둔 묶음에서 도는지(그때만 스스로 바꿈. 저장소·Skill에서 직접 켠 것은 바꾸지 않음) */
export function installedPackage(root) { return !!readBuild(root) && isDir(join(root, 'skills')) && !existsSync(join(root, '.git')); }

const okUrl = (u) => { try { const x = new URL(u); return x.protocol === 'https:' || (x.protocol === 'http:' && x.hostname === '127.0.0.1'); } catch { return false; } }; // 127.0.0.1은 시험의 가짜 릴리스만
async function get(url, fetchImpl, { text = false, limit = 100 * MB, ms = 120000 } = {}) {
  if (!okUrl(url)) throw Object.assign(new Error('받는 주소가 https가 아니에요'), { code: 'url' });
  const r = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(ms), headers: { 'user-agent': 'lecpage-connect' } });
  if (r.url && !okUrl(r.url)) throw Object.assign(new Error('받는 주소가 https가 아니에요'), { code: 'url' });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { code: 'http', status: r.status });
  if (+r.headers?.get?.('content-length') > limit) throw Object.assign(new Error('파일이 너무 커요'), { code: 'size' });
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > limit) throw Object.assign(new Error('파일이 너무 커요'), { code: 'size' });
  return text ? buf.toString('utf8') : buf;
}
/** 릴리스의 지금 판 이름 */
export async function latestBuild({ base = RELEASE, fetchImpl = globalThis.fetch } = {}) {
  const v = (await get(`${base}/VERSION`, fetchImpl, { text: true, limit: 1024, ms: 15000 })).trim();
  if (!VER_RE.test(v)) throw Object.assign(new Error('판 이름을 읽지 못했어요'), { code: 'version' });
  return v;
}
/** 묶음 받기 + SHA-256 확인(실행 파일과 같은 .sha256) → 바이트 */
export async function downloadVerified({ base = RELEASE, fetchImpl = globalThis.fetch } = {}) {
  const buf = await get(`${base}/${ASSET}`, fetchImpl);
  const want = String(await get(`${base}/${ASSET}.sha256`, fetchImpl, { text: true, limit: 1024, ms: 15000 })).trim().split(/\s+/)[0].toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(want) || createHash('sha256').update(buf).digest('hex') !== want) throw Object.assign(new Error('받은 파일 확인(SHA-256)에 실패했어요'), { code: 'sha256' });
  return buf;
}

/** 묶음 안 경로 → 안전한 상대 경로('' = 맨 위). 절대 경로·드라이브·'..'는 null */
export function safeRel(p) {
  const s = String(p).replace(/\\/g, '/');
  if (s.startsWith('/') || /^[A-Za-z]:/.test(s) || s.includes('\0')) return null;
  const parts = s.split('/').filter((x) => x && x !== '.');
  return parts.some((x) => x === '..') ? null : parts.join('/');
}
const cstr = (b) => { const z = b.indexOf(0); return (z >= 0 ? b.subarray(0, z) : b).toString('utf8'); };
const oct = (b) => parseInt(cstr(b).trim() || '0', 8) || 0;
/** tar.gz(GNU tar·ustar·pax 긴 이름) → dest에 풂. 보통 파일·폴더만(링크·장치는 거절) → 푼 파일 수 */
export function untarGz(gz, dest) {
  const b = gunzipSync(gz, { maxOutputLength: 400 * MB });
  let off = 0; let long = null; let pax = null; let n = 0;
  mkdirSync(dest, { recursive: true });
  while (off + 512 <= b.length) {
    const h = b.subarray(off, off + 512);
    if (h.every((c) => c === 0)) break;
    const size = oct(h.subarray(124, 136));
    const type = h[156] ? String.fromCharCode(h[156]) : '0';
    const ustar = cstr(h.subarray(257, 263)).startsWith('ustar');
    const prefix = ustar ? cstr(h.subarray(345, 500)) : '';
    const name = (prefix ? `${prefix}/` : '') + cstr(h.subarray(0, 100));
    const mode = oct(h.subarray(100, 108));
    const body = b.subarray(off + 512, off + 512 + size);
    if (body.length < size) throw Object.assign(new Error('묶음이 잘렸어요'), { code: 'tar' });
    off += 512 + Math.ceil(size / 512) * 512;
    if (type === 'L') { long = cstr(body); continue; }
    if (type === 'x') { for (const m of body.toString('utf8').matchAll(/^\d+ path=(.*)$/gm)) pax = m[1]; continue; }
    if (type === 'g' || type === 'K') continue;
    const rel = safeRel(pax ?? long ?? name); pax = null; long = null;
    if (rel === null) throw Object.assign(new Error('묶음에 밖으로 나가는 경로가 있어요'), { code: 'tar' });
    if (!rel) continue;
    const out = join(dest, ...rel.split('/'));
    if (type === '5') { mkdirSync(out, { recursive: true }); continue; }
    if (type !== '0' && type !== '7') throw Object.assign(new Error(`묶음에 풀지 않는 항목이 있어요(${type})`), { code: 'tar' });
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, body);
    if (mode & 0o111) { try { chmodSync(out, 0o755); } catch { /* 윈도우 */ } }
    n++;
  }
  return n;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** 이름 바꾸기. 윈도우에서 백신·검색이 방금 푼 파일을 잠깐 잡고 있으면 잠시 뒤 다시(최대 약 15초) */
export async function renameRetry(from, to, { tries = 30 } = {}) {
  for (let i = 0; ; i++) {
    try { renameSync(from, to); return; } catch (e) {
      if (i >= tries || !['EPERM', 'EBUSY', 'EACCES', 'ENOTEMPTY', 'EEXIST'].includes(e.code)) throw e;
      await wait(Math.min(1000, 100 * (i + 1)));
    }
  }
}

/**
 * 받기 → 확인 → 옆 폴더(<root>.new)에 풀기 → <root>를 <root>.old로, 새 폴더를 <root>로. 하나라도 안 되면 있던 판 그대로
 * onStage('download'|'install') → { from, to, backup }
 */
export async function applyUpdate({ root, base = RELEASE, fetchImpl = globalThis.fetch, onStage = () => {} }) {
  const from = readBuild(root);
  onStage('download');
  const buf = await downloadVerified({ base, fetchImpl });
  onStage('install');
  const tmp = `${root}.new`; const old = `${root}.old`;
  rmSync(tmp, { recursive: true, force: true });
  try {
    untarGz(buf, tmp);
    const to = readBuild(tmp);
    if (!to || !existsSync(join(tmp, 'skills', 'lecpage', 'scripts', 'lecpage.mjs'))) throw Object.assign(new Error('받은 묶음에 lecpage 커넥트가 없어요'), { code: 'package' });
    rmSync(old, { recursive: true, force: true });
    await renameRetry(root, old);
    try { await renameRetry(tmp, root); } catch (e) { await renameRetry(old, root).catch(() => {}); throw e; }
    return { from, to, backup: old };
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
/** 새 판이 켜지지 않을 때: <root>.old를 되돌림 → 되돌렸는지 */
export function restoreBackup(root) {
  const old = `${root}.old`;
  if (!readBuild(old)) return false;
  try {
    rmSync(`${root}.bad`, { recursive: true, force: true });
    if (existsSync(root)) renameSync(root, `${root}.bad`);
    renameSync(old, root);
    return true;
  } catch { return false; }
}

/** 다시 켤 인자: 처음 인자에서 포트·열기·새 토큰을 빼고 같은 포트 + 브라우저 열지 않기(앱이 이미 열려 있고 저절로 다시 붙음) */
export function restartArgv(argv, port) {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port' || a === '--open') { i++; continue; }
    if (a === '--new-token' || a === '--no-open' || /^--(port|open)=/.test(a)) continue;
    out.push(a);
  }
  return [...out, '--port', String(port), '--no-open'];
}

/**
 * 감독: 새 판을 자식으로 띄우고(같은 창에 출력) 끝날 때까지 기다림. 자식이 75로 끝나면(또 새 판) 다시 띄움.
 * 띄우자마자(20초 안) 실패로 끝나면 예전 판(<root>.old)으로 되돌려 한 번 더. 그 밖에는 자식의 종료 코드로 끝냄.
 * Ctrl+C·창 닫기는 같은 창의 자식에게도 가므로, 윈도우에서는 신호를 넘기지 않음(넘기면 자식이 정리 없이 바로 꺼짐)
 */
export function supervise({ cli, argv, root, env = process.env, log = () => {}, node = process.execPath, execArgv = process.execArgv, platform = process.platform, spawnImpl = spawn, exit = (c) => process.exit(c) }) {
  let child = null; let startedAt = 0; let rolled = false; let skip = '';
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    try { process.on(sig, () => { if (platform !== 'win32') { try { child?.kill(sig); } catch { /* 이미 끝남 */ } } }); } catch { /* 이 체제에 없는 신호 */ }
  }
  const run = () => {
    startedAt = Date.now();
    child = spawnImpl(node, [...execArgv, cli, ...argv], { stdio: 'inherit', env: { ...env, LECPAGE_CONNECT_CHILD: '1', LECPAGE_CONNECT_RESTARTED: '1', ...(skip ? { LECPAGE_CONNECT_SKIP: skip } : {}) } });
    child.on('error', (e) => { log(`lecpage 커넥트를 다시 켜지 못했어요: ${e.message}`); exit(1); });
    child.on('exit', (code, signal) => {
      if (code === RESTART_CODE) { rolled = false; return run(); }
      if (code && !signal && code !== 130 && !rolled && Date.now() - startedAt < 20000) {
        const bad = readBuild(root);
        if (restoreBackup(root)) { rolled = true; skip = bad; log(`새 판(${bad})이 켜지지 않아 예전 판으로 다시 켜요`); return run(); }
      }
      exit(code ?? (signal ? 1 : 0));
    });
  };
  run();
  return { get child() { return child; } };
}
