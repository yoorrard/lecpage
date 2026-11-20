// 테스트 도우미: 엔진 조립으로 실제 사이트 만들기, 로컬 호스트(wrangler dev) 띄우기, 앱처럼 올리기
import { spawn } from 'node:child_process';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync, mkdtempSync, rmSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePort, releasePort } from './ports.mjs';

export const HOSTING = join(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = join(HOSTING, '..');
export const ENGINE = join(REPO, 'skills', 'lecpage', 'engine');
const E = await import(join(ENGINE, 'src', 'index.js'));
const N = await import(join(ENGINE, 'node.js'));

const te = new TextEncoder();
export const bytesOf = (v) => (typeof v === 'string' ? te.encode(v) : v instanceof Uint8Array ? v : new Uint8Array(v));
export const sha256 = (v) => createHash('sha256').update(bytesOf(v)).digest('hex');

/** 예전 시험 이름(예시 둘)의 참여 기능: 'sel-story'는 질문·보드·투표·반응, 'data-lab'은 도움 요청·진행·신호까지(둘 다 이 기기 안 연습) */
const FEATURES = { 'sel-story': ['qa', 'board', 'poll', 'reactions'], 'data-lab': ['qa', 'help', 'progress', 'board', 'poll', 'reactions', 'signal'] };
export function blueprint(name) {
  return { live: { provider: 'local', features: [...(FEATURES[name] || FEATURES['data-lab'])] } };
}
const REF = join(REPO, 'skills', 'lecpage', 'references', 'designs', 'data-lab');
/** 레퍼런스 사이트(data-lab) 폴더. 사이트가 직접 쓴 스크립트(assets/site.js)는 빼서 엔진 런타임만 도는 사이트로(worker 보기가 받는 것) */
function refSite() {
  const out = {};
  const dir = join(REF, 'site');
  const walk = (d) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) walk(f); else { const k = relative(dir, f).split(sep).join('/'); out[k] = /\.(html|css|js|json)$/.test(k) ? readFileSync(f, 'utf8') : new Uint8Array(readFileSync(f)); } } };
  walk(dir);
  delete out['assets/site.js'];
  out['index.html'] = out['index.html'].replace(/<script[^>]*src="assets\/site\.js"[^>]*><\/script>\s*/g, '');
  return out;
}

/**
 * 엔진이 조립한 실제 사이트(레퍼런스 사이트 + 키트 + 보조 쪽 + 런타임). name은 참여 기능 묶음(blueprint), patch(bp)로 live·access를 바꿈.
 * assets: 더 넣을 사이트 파일(그림·자료실 파일 등), password: 암호로 잠금
 * @returns {Promise<Record<string, Uint8Array>>} 경로 → 내용
 */
export async function buildSite(name, { assets = {}, password = '', patch = null } = {}) {
  const bp = blueprint(name);
  if (patch) patch(bp);
  const meta = JSON.parse(readFileSync(join(REF, 'lecpage.json'), 'utf8'));
  meta.features = [...new Set([...bp.live.features, 'survey', 'deck', 'timer'])];
  const lv = bp.live;
  const prev = { live: { provider: lv.provider || 'local', url: lv.url || '', code: lv.code || '', anonKey: lv.anonKey || '' }, ...(bp.access?.mode ? { access: bp.access.mode } : {}) };
  const r = E.assemble({ ...refSite(), ...assets }, meta, { runtime: N.nodeRuntime(), prev, today: '2026-11-20' });
  if (r.errors?.length) throw new Error(`조립 실패: ${JSON.stringify(r.errors).slice(0, 300)}`);
  let files = r.files;
  if (password) files = await E.protectSite(files, password, { runtime: N.nodeRuntime(), title: r.meta.title, crypto: webcrypto, iterations: 1000 });
  return Object.fromEntries(Object.entries(files).map(([p, v]) => [p, bytesOf(v)]));
}

/** AI가 따로 쓴 스크립트 파일(assets/app.js) 예: 화면만 다루고 바깥으로 보내지 않음 */
export const AI_SITE_JS = `// AI가 쓴 사이트 스크립트
(function () {
  'use strict';
  var quiz = document.querySelector('.quiz');
  if (quiz) quiz.addEventListener('submit', function (e) { e.preventDefault(); var out = quiz.querySelector('output'); if (out) out.textContent = '좋아요!'; });
  document.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { document.body.dataset.tab = b.dataset.tab; }); });
  if (window.gsap) window.gsap.from('h1', { opacity: 0, y: 12, duration: 0.6 });
})();
`;
/** AI가 조립 전에 쓰는 사이트(docs/plan-ai-first.md §3): 인라인 스크립트·모듈·onclick·유튜브 틀·고정 라이브러리·바깥 스크립트·키트 자리 표시 */
const AI_INDEX = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>기록은 쌓였는데 시간이 없다면</title>
<link rel="stylesheet" href="assets/style.css">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/gsap.min.js" defer></script>
<script src="https://evil.example/track.js"></script>
</head>
<body>
<header class="hero"><p class="kicker">2026 교원 연수</p><h1>기록은 쌓였는데 시간이 없다면</h1>
<p>와이파이: lec-guest · 비밀번호: 2026lec (비밀번호를 입력하세요)</p>
<p><a href="https://padlet.com/example/board">패들렛 열기</a> · <a href="about.html">강사 소개</a> · <button type="button" data-tab="help">로그인 방법 보기</button> <button type="button" class="top" onclick="window.scrollTo(0, 0)">맨 위로</button></p></header>
<main>
<section data-lp-step="s1" data-title="1단계: 교재 살펴보기">
<h2>1단계</h2><img src="material/p-001.webp" alt="교재 1쪽">
<iframe src="https://www.youtube.com/embed/abc123def" title="연수 안내 영상" allowfullscreen></iframe>
<pre><code>&lt;input type="password"&gt; 같은 칸은 쓰지 않아요</code></pre>
<form class="quiz"><label>오늘 배운 낱말<input name="answer" placeholder="정답을 적어 주세요"></label><button type="submit">확인</button><output></output></form>
<div data-lp="poll" data-question="오늘 연수, 어땠나요?" data-options='["좋아요","보통이에요"]'></div>
</section>
<section id="q"><h2>질문</h2><div data-lp="qa"></div></section>
<section id="b"><h2>보드</h2><div data-lp="board" data-prompt="와이파이 비밀번호를 받았나요? 한 줄로 남겨 주세요"></div></section>
</main>
<footer><p>문의: 연수 담당</p></footer>
<script>document.documentElement.classList.add('js');</script>
<script type="module">document.body.dataset.ready = '1';</script>
<script src="assets/app.js" defer></script>
</body>
</html>
`;
/**
 * AI가 직접 쓴 사이트를 엔진 조립(assemble, skills/lecpage/engine/src/kit)에 넣은 결과 = 앱·Skill이 바로 배포에 올리는 파일.
 * 조립이 인라인 스크립트를 assets/site.js·site.module.js로, onclick을 assets/site-events.js로 옮기고 키트 런타임·보조 쪽을 더함
 * @param {{ live?: { url: string, code: string } | null, index?: (html: string) => string }} [o] live: 강사가 정한 실시간 서버, index: AI가 쓴 첫 화면 고치기(시험용)
 * @returns {Promise<Record<string, Uint8Array>>}
 */
export async function aiSite({ live = null, index = (h) => h } = {}) {
  const site = {
    'index.html': index(AI_INDEX),
    'about.html': '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>강사 소개</title><link rel="stylesheet" href="assets/style.css"></head><body><h1>강사 소개</h1><p>디지털 기록을 연구해요.</p><script>document.title += " · 연수";</script></body></html>',
    'assets/style.css': ':root{--lp-accent:#2f6f5e;--lp-ink:#1d2321;--lp-paper:#f7f4ee}\nbody{margin:0;font-family:var(--lp-font,system-ui);background:var(--lp-paper);color:var(--lp-ink)}\n.hero{padding:clamp(24px,6vw,72px)}\niframe{width:100%;aspect-ratio:16/9;border:0}\n',
    'assets/app.js': AI_SITE_JS,
    'material/p-001.webp': new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, ...new Array(40).fill(7)]),
  };
  // AI가 적은 실시간 주소(바깥)는 조립이 버리고 강사 값(prev)만 씀
  const meta = { v: 2, title: '기록은 쌓였는데 시간이 없다면', sessions: [{ date: '2026-12-03', start: '14:00', end: '17:00' }], venue: '본관 3층', features: ['qa', 'board', 'poll', 'attendance', 'help', 'reactions'], theme: { accent: '#2f6f5e', ink: '#1d2321', paper: '#f7f4ee' }, live: { provider: 'http', url: 'https://attacker.example' } };
  const prev = { access: 'link', ...(live ? { live: { provider: 'http', url: live.url, code: live.code } } : {}) };
  const r = E.assemble(site, meta, { runtime: N.nodeRuntime(), prev, today: '2026-11-20' });
  if (r.errors?.length) throw new Error(`조립 실패: ${JSON.stringify(r.errors).slice(0, 300)}`);
  return Object.fromEntries(Object.entries(r.files).map(([p, v]) => [p, bytesOf(v)]));
}

export const manifestOf = (files) => Object.fromEntries(Object.entries(files).map(([p, v]) => [p, { sha256: sha256(v), size: bytesOf(v).length }]));

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
    releasePort(port); releasePort(inspector);
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

/**
 * 앱(app/src/lib/deploy.js의 deployInstant)과 같은 순서로 올림
 * @param {{ beforePublish?: () => Promise<void> }} [o] 파일을 다 올린 뒤 공개하기 전에 할 일(앱은 여기서 실시간 방을 묶음)
 */
export async function deploy(base, site, files, { beforePublish } = {}) {
  const manifest = manifestOf(files);
  const blobs = new Map(Object.entries(files).map(([p, v]) => [manifest[p].sha256, bytesOf(v)]));
  const d = await call(base, 'POST', `/api/sites/${site.id}/deploys`, { key: site.key, json: { files: manifest } });
  if (d.status !== 200) return { step: 'deploys', ...d };
  for (const sha of d.body.missing) {
    const u = await call(base, 'PUT', `/api/sites/${site.id}/blobs/${sha}`, { key: site.key, raw: blobs.get(sha) });
    if (u.status !== 204) return { step: 'blobs', sha, missing: d.body.missing, ...u };
  }
  if (beforePublish) await beforePublish();
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
