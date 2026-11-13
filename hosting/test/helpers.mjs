// 테스트 도우미: 엔진으로 실제 사이트 만들기, 로컬 호스트(wrangler dev) 띄우기, 앱처럼 올리기
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HOSTING = join(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = join(HOSTING, '..');
export const ENGINE = join(REPO, 'skills', 'lecpage', 'engine');
const E = await import(join(ENGINE, 'src', 'index.js'));
const N = await import(join(ENGINE, 'node.js'));

const te = new TextEncoder();
export const bytesOf = (v) => (typeof v === 'string' ? te.encode(v) : v instanceof Uint8Array ? v : new Uint8Array(v));
export const sha256 = (v) => createHash('sha256').update(bytesOf(v)).digest('hex');

export function blueprint(name) {
  return JSON.parse(readFileSync(join(REPO, 'skills', 'lecpage', 'examples', `${name}.blueprint.json`), 'utf8'));
}

/**
 * 예시 설계도를 엔진으로 빌드(= `npm run examples`가 .out/<name>에 쓰는 것과 같은 파일).
 * @returns {Promise<Record<string, Uint8Array>>} 경로 → 내용
 */
export async function buildSite(name, { assets = {}, password = '', patch = null } = {}) {
  const bp = blueprint(name);
  if (patch) patch(bp);
  const r = E.build(bp, { runtime: N.nodeRuntime(), assets });
  if (r.errors?.length) throw new Error(`빌드 실패: ${JSON.stringify(r.errors).slice(0, 300)}`);
  let files = r.files;
  if (password) files = await E.protectSite(files, password, { runtime: N.nodeRuntime(), title: r.blueprint.meta.title, crypto: webcrypto, iterations: 1000 });
  return Object.fromEntries(Object.entries(files).map(([p, v]) => [p, bytesOf(v)]));
}

export const manifestOf = (files) => Object.fromEntries(Object.entries(files).map(([p, v]) => [p, { sha256: sha256(v), size: bytesOf(v).length }]));

function freePort() {
  return new Promise((res, rej) => {
    const s = createServer();
    s.on('error', rej);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
  });
}

/**
 * wrangler dev(로컬 workerd)를 띄움. 못 띄우면 Error를 던짐(통합 테스트는 그 까닭을 적고 건너뜀).
 * @param {Record<string,string|number>} vars --var로 넘길 값
 */
export async function startHost(vars = {}, { timeout = 90000 } = {}) {
  const port = await freePort();
  const inspector = await freePort(); // 기본값(9229)은 다른 wrangler dev와 부딪힘
  const state = mkdtempSync(join(tmpdir(), 'lecpage-host-'));
  const args = [join(HOSTING, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), 'dev', '--port', String(port), '--inspector-port', String(inspector), '--ip', '127.0.0.1', '--persist-to', state, '--show-interactive-dev-session=false'];
  for (const [k, v] of Object.entries(vars)) args.push('--var', `${k}:${v}`);
  let log = '';
  const child = spawn(process.execPath, args, { cwd: HOSTING, env: { ...process.env, CI: '1', NO_COLOR: '1', WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG: 'info' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  let exited = null;
  child.on('exit', (code) => { exited = code ?? -1; });
  child.on('error', (e) => { exited = -1; log += String(e); });
  const url = `http://127.0.0.1:${port}`;
  const stop = async () => {
    if (exited === null) { child.kill('SIGTERM'); await new Promise((r) => { const t = setTimeout(() => { child.kill('SIGKILL'); r(); }, 5000); child.on('exit', () => { clearTimeout(t); r(); }); }); }
    rmSync(state, { recursive: true, force: true });
  };
  const until = Date.now() + timeout;
  for (;;) {
    if (exited !== null) { await stop(); throw new Error(`wrangler dev가 끝났어요(코드 ${exited}).\n${log.slice(-1500)}`); }
    try { const r = await fetch(`${url}/api/info`, { signal: AbortSignal.timeout(2000) }); if (r.ok) break; } catch { /* 아직 */ }
    if (Date.now() > until) { await stop(); throw new Error(`wrangler dev가 ${timeout / 1000}초 안에 뜨지 않았어요.\n${log.slice(-1500)}`); }
    await new Promise((r) => setTimeout(r, 250));
  }
  return { url, stop, log: () => log };
}

/** API 한 번 부르기 → { status, headers, body(JSON이면 객체) } */
export async function call(base, method, path, { key, json, raw, headers = {} } = {}) {
  const h = { ...headers };
  if (key) h.authorization = `Bearer ${key}`;
  if (json !== undefined) h['content-type'] = 'application/json';
  else if (raw !== undefined) h['content-type'] = 'application/octet-stream';
  const r = await fetch(base + path, { method, headers: h, body: json !== undefined ? JSON.stringify(json) : raw, redirect: 'manual' });
  const text = r.status === 204 || r.status === 304 ? '' : await r.text();
  let body = text;
  try { body = JSON.parse(text); } catch { /* JSON 아님 */ }
  return { status: r.status, headers: r.headers, body };
}

/** 앱(app/src/lib/deploy.js의 deployInstant)과 같은 순서로 올림 */
export async function deploy(base, site, files) {
  const manifest = manifestOf(files);
  const blobs = new Map(Object.entries(files).map(([p, v]) => [manifest[p].sha256, bytesOf(v)]));
  const d = await call(base, 'POST', `/api/sites/${site.id}/deploys`, { key: site.key, json: { files: manifest } });
  if (d.status !== 200) return { step: 'deploys', ...d };
  for (const sha of d.body.missing) {
    const u = await call(base, 'PUT', `/api/sites/${site.id}/blobs/${sha}`, { key: site.key, raw: blobs.get(sha) });
    if (u.status !== 204) return { step: 'blobs', sha, missing: d.body.missing, ...u };
  }
  // 앱처럼: 서버가 맡긴 곳(Pages)에 없는 파일이면(처음 쓰는 런타임·Pages가 지운 파일) 그것만 다시 올리고 한 번 더(2번까지)
  for (let t = 0; ; t++) {
    const p = await call(base, 'POST', `/api/sites/${site.id}/deploys/${d.body.deploy}/publish`, { key: site.key });
    if (p.body?.error?.code !== 'missing_blobs' || t >= 2) return { step: 'publish', missing: d.body.missing, deploy: d.body.deploy, again: t, ...p };
    for (const sha of p.body.error.missing || []) {
      const u = await call(base, 'PUT', `/api/sites/${site.id}/blobs/${sha}`, { key: site.key, raw: blobs.get(sha) });
      if (u.status !== 204) return { step: 'blobs-again', sha, ...u };
    }
  }
}
