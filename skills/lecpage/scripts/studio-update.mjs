// lecpage 커넥트 새 판으로 바꾸기(스스로, 켜 둔 채로). 받은 실행 파일(lecpage-connect.cmd/.sh)이 켤 때 하는 일과 같은 것을 켜 둔 동안에도:
// GitHub 릴리스(studio-latest)의 VERSION이 지금 판과 다르면 묶음(lecpage-connect.tar.gz)을 받아 SHA-256(.sha256)을 확인하고,
// 옆 폴더에 푼 뒤 폴더 이름을 바꿔 갈아 끼움(예전 판은 <폴더>.old로 남김) → 같은 인자·같은 포트·같은 짝 맞춤 토큰으로 다시 켬.
// 다시 켜기: 처음 바꿀 때 이 프로세스가 작은 감독이 되어 새 판을 자식으로 띄우고(같은 창·같은 출력), 자식이 다시 바꾸면 종료 코드 75로
// 알려 감독이 새로 띄움(프로세스는 늘 둘까지). 새 판이 켜지자마자 실패하면 예전 판으로 되돌려 한 번 더 띄움.
// 안전: 받는 곳은 고정 주소(https)뿐 · 확인(SHA-256, 공개 키를 정했으면 ed25519 서명까지) 전에는 아무것도 바꾸지 않음 · 묶음 밖 경로·링크는 풀지 않음 ·
// 있던 것보다 예전에 묶은 묶음(BUILT)으로는 바꾸지 않음 · 작업 중에는 바꾸지 않음(studio.mjs가 확인)
import { spawn } from 'node:child_process';
import { createHash, createPublicKey, verify as edVerify } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync, rmSync, renameSync, unlinkSync, existsSync, statSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';

/** 받는 곳(실행 파일 scripts/studio-launcher/*과 같은 릴리스) */
export const RELEASE = 'https://github.com/yoorrard/lecpage/releases/download/studio-latest';
export const ASSET = 'lecpage-connect.tar.gz';
/**
 * 묶음 서명 공개 키(ed25519 32바이트를 base64url로 = JWK의 x). 이 목록이 기준이고, 실행 파일(scripts/studio-launcher/lecpage-connect.cmd·.sh)에도
 * 같은 목록을 박아 둠(시험이 같은지 확인). 넣고 빼기는 scripts/studio-launcher/signing-key.mjs(세 곳을 함께 고침, docs/operations.md 15절).
 * 비어 있으면 서명을 확인하지 않음(SHA-256만, 키를 정하기 전과 같음). 하나라도 있으면 <묶음>.sig가 없거나 어느 키로도 맞지 않을 때 바꾸지 않음.
 * 여러 개는 키를 바꾸는 동안 예전 키·새 키를 함께 받으려고
 */
export const SIGNING_KEYS = ['fXeJSCSG_l5AvDuyLpaefYer_g6vv4WdMP-iIOx_85o'];
/** 공개 키 꼴(base64url 43자) */
export const KEY_RE = /^[A-Za-z0-9_-]{43}$/;
/** 감독에게 '새 판으로 다시 띄워 줘'를 알리는 종료 코드 */
export const RESTART_CODE = 75;
const MB = 1024 * 1024;
const VER_RE = /^[\w.+-]{1,64}$/;
const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };

/** 묶음의 판 이름(VERSION, 예: 1.1.0-26e7556). 없으면 '' */
export function readBuild(root) {
  try { const v = readFileSync(join(root, 'VERSION'), 'utf8').trim(); return VER_RE.test(v) ? v : ''; } catch { return ''; }
}
/** 묶음을 묶은 때(BUILT: 1970년부터 센 초, scripts/studio-launcher/package.sh가 넣음). 없거나(이 확인을 넣기 전 판) 꼴이 다르면 0 */
export function readBuilt(root) {
  try { const v = readFileSync(join(root, 'BUILT'), 'utf8').trim(); return /^\d{9,12}$/.test(v) ? +v : 0; } catch { return 0; }
}
/**
 * 받은 묶음(next)이 있던 묶음(cur)보다 예전 것인지: 있던 것에 BUILT가 있는데 받은 것에 없거나 더 앞섬.
 * 서명한 예전 묶음을 다시 내놓아 예전 판으로 내리는 것을 막음(BUILT는 묶음 안에 있어 서명에 함께 들어감). 실행 파일(lecpage-connect.cmd·.sh)도 같은 규칙
 */
export function olderBundle(next, cur) { const have = readBuilt(cur); return !!have && readBuilt(next) < have; }
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
  if (!VER_RE.test(v)) throw Object.assign(new Error('버전 이름을 읽지 못했어요'), { code: 'version' });
  return v;
}
/**
 * ed25519 서명 확인: sigText(<묶음>.sig: base64 서명 한 줄에 하나, 키를 바꾸는 동안은 여럿) 중 하나가 keys 중 하나로 buf에 맞으면 true.
 * 실행 파일(lecpage-connect.cmd·.sh)도 같은 일을 Node.js로 함(VERIFY_JS)
 */
export function verifySignature(buf, sigText, keys = SIGNING_KEYS) {
  const sigs = String(sigText ?? '').split(/\s+/).filter(Boolean).slice(0, 8).map((x) => Buffer.from(x, 'base64')).filter((b) => b.length === 64);
  for (const x of keys) {
    let key; try { key = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x }, format: 'jwk' }); } catch { continue; }
    for (const s of sigs) { try { if (edVerify(null, buf, key, s)) return true; } catch { /* 맞지 않음 */ } }
  }
  return false;
}
/** 서명 실패: 사용자에게는 '받은 새 판 파일이 올바르지 않아요'(studio.mjs updateErrorCode의 package), 기록에는 까닭 */
const sigError = (m) => Object.assign(new Error(m), { code: 'package', reason: 'signature' });
/** 묶음 받기 + SHA-256 확인(실행 파일과 같은 .sha256) + 공개 키를 정했으면 서명(.sig) 확인 → 바이트 */
export async function downloadVerified({ base = RELEASE, fetchImpl = globalThis.fetch, keys = SIGNING_KEYS } = {}) {
  const buf = await get(`${base}/${ASSET}`, fetchImpl);
  const want = String(await get(`${base}/${ASSET}.sha256`, fetchImpl, { text: true, limit: 1024, ms: 15000 })).trim().split(/\s+/)[0].toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(want) || createHash('sha256').update(buf).digest('hex') !== want) throw Object.assign(new Error('받은 파일 확인(SHA-256)에 실패했어요'), { code: 'sha256' });
  if (keys.length) {
    const sig = await get(`${base}/${ASSET}.sig`, fetchImpl, { text: true, limit: 4096, ms: 15000 }).catch((e) => {
      throw e.code === 'http' && e.status === 404 ? sigError('받은 파일의 서명(.sig)이 없어요') : e;
    });
    if (!verifySignature(buf, sig, keys)) throw sigError('받은 파일의 서명이 맞지 않아요');
  }
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
export async function applyUpdate({ root, base = RELEASE, fetchImpl = globalThis.fetch, keys = SIGNING_KEYS, onStage = () => {} }) {
  const from = readBuild(root);
  onStage('download');
  const buf = await downloadVerified({ base, fetchImpl, keys });
  onStage('install');
  const tmp = `${root}.new`; const old = `${root}.old`;
  rmSync(tmp, { recursive: true, force: true });
  try {
    untarGz(buf, tmp);
    const to = readBuild(tmp);
    if (!to || !existsSync(join(tmp, 'skills', 'lecpage', 'scripts', 'lecpage.mjs'))) throw Object.assign(new Error('받은 묶음에 lecpage 커넥트가 없어요'), { code: 'package' });
    if (olderBundle(tmp, root)) throw Object.assign(new Error(`받은 묶음(${to})이 지금 버전보다 예전 것이에요`), { code: 'older', to });
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

/** 윈도우 실행 파일(lecpage-connect.cmd)의 배치 머리 부분(##PS## 줄 앞). 없으면 null */
export function batchHead(buf) { const b = Buffer.from(buf); const i = b.indexOf('##PS##'); return i < 0 ? null : b.subarray(0, i); }
/**
 * 윈도우 자동 시작용 복사본(LECPAGE_LAUNCHER = %LOCALAPPDATA%\lecpage\lecpage-connect.cmd, 예전 이름 lecpage-studio.cmd가 있으면 그것도)을
 * 확인을 마친 묶음 안의 실행 파일로 바꿈 → 바꾼 파일 목록. 예전 실행 파일은 서명을 확인하지 않고, 브라우저로 받은 파일을 그대로 복사한 것이라
 * 다운로드 표시(Zone.Identifier)가 따라와 컴퓨터를 켤 때마다 보안 경고가 뜰 수 있음 → 묶음과 내용이 같은 복사본에서만 그 표시를 지움.
 * 지금 도는 배치 파일일 수 있어 머리 부분이 같은 것만 바꿈(cmd는 명령을 마칠 때마다 같은 바이트 자리부터 파일을 다시 읽음).
 * 받은 실행 파일로 켠 묶음에서만(studio.mjs가 켤 때 부름)
 */
export function refreshLauncher({ root, env = process.env, platform = process.platform } = {}) {
  const launcher = env.LECPAGE_LAUNCHER;
  if (platform !== 'win32' || !launcher || !/\.cmd$/i.test(launcher) || !root || !installedPackage(root)) return [];
  let body; try { body = readFileSync(join(root, 'lecpage-connect.cmd')); } catch { return []; }
  const head = batchHead(body);
  if (!head) return [];
  const out = [];
  for (const dst of [launcher, join(dirname(launcher), 'lecpage-studio.cmd')]) {
    try {
      if (!existsSync(dst)) continue;
      const cur = readFileSync(dst);
      if (!cur.equals(body)) {
        if (!batchHead(cur)?.equals(head)) continue;
        writeFileSync(`${dst}.new`, body);
        renameSync(`${dst}.new`, dst);
        out.push(dst);
      }
      try { unlinkSync(`${dst}:Zone.Identifier`); } catch { /* 표시가 없음 */ }
    } catch { /* 다음에 켤 때 다시 */ }
  }
  return out;
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
        if (restoreBackup(root)) { rolled = true; skip = bad; log(`새 버전(${bad})이 켜지지 않아 예전 버전으로 다시 켜요`); return run(); }
      }
      exit(code ?? (signal ? 1 : 0));
    });
  };
  run();
  return { get child() { return child; } };
}
