// PC 프로그램(lecpage studio, skills/lecpage/scripts/studio.mjs)을 부르는 클라이언트.
// 두 가지로 붙음: (1) 기본 — lecpage.com 화면 그대로, PC 프로그램이 켜며 연 https://lecpage.com/#pair=<토큰>&port=<포트>로 짝을 맞추고
//   이 브라우저에 { token, port }를 기억해 http://127.0.0.1:<포트>/bridge/*를 직접 부름(CORS. Chrome·Edge는 처음 한 번 '로컬 네트워크 접근'을 물음).
//   (2) 대신 — Safari처럼 그 길이 막힌 브라우저는 PC 프로그램이 보여 주는 http://127.0.0.1:<포트>/ 화면(같은 출처, 앱 HTML의 <meta name="lecpage-bridge">).
// 모든 요청에 머리글 X-Lecpage-Bridge: <토큰>. 토큰·ChatGPT 로그인 정보는 PC 프로그램 안에 있고, 이 앱은 토큰(짝 맞춤용)만 압니다.
//   GET /bridge/status → { ok, version, platform, agents:[{ id, installed, version, auth, ready, need, note_ko }], chatgpt:{ connected, plan, email, welcome }, autostart }
//   POST /bridge/jobs { agent, kind:'make'|'edit', request, meta, reference, files:[{ name, type, base64 }], site? } → { jobId }
//   GET /bridge/jobs/:id/events (SSE) { type:'step'|'log'|'done'|'error', label_ko?, text?, error? }
//   GET /bridge/jobs/:id/result → { site, meta, issues } · DELETE /bridge/jobs/:id
//   POST /bridge/chatgpt/login → { url } · DELETE /bridge/chatgpt · GET /bridge/chatgpt/models · POST /bridge/chatgpt/responses(SSE 중계)
//   POST /bridge/agents/:id/install|login|update(보이는 터미널 창에서 공식 명령) · GET·POST /bridge/autostart
// 에이전트는 PC에서 계속 돌므로 진행 연결이 끊기거나 새로 고쳐도 같은 jobId로 다시 붙음.
import { AiError, readSSE, toBase64 } from './providers/common.js';

function metaToken() {
  try { return (typeof document !== 'undefined' && document.querySelector('meta[name="lecpage-bridge"]')?.getAttribute('content')) || ''; } catch { return ''; }
}
import { pairing, capturePairing, forgetPairing, justPaired } from '../pair.js';
export { pairing, capturePairing, forgetPairing, justPaired };
function config() {
  const t = metaToken();
  if (t) return { base: '', token: t, same: true };
  const p = pairing();
  return p ? { base: `http://127.0.0.1:${p.port}`, token: p.token, same: false, port: p.port } : null;
}
export function bridgeToken() { return config()?.token || ''; }
/** PC 프로그램과 짝이 있는지(켜져 있는지는 pcStatus로) */
export const bridgeAvailable = () => !!config();
/** 이 화면이 PC 프로그램이 보여 주는 127.0.0.1 화면인지 */
export const bridgeSameOrigin = () => !!metaToken();
/** PC 프로그램 주소(대신 길: 127.0.0.1 화면) */
export function pcOrigin() { const c = config(); return c ? (c.same ? location.origin : c.base) : ''; }
/** Safari: https 화면에서 http://127.0.0.1 요청을 막음(WebKit 171934) → 127.0.0.1 화면으로 */
export const isSafari = () => { try { return /^((?!chrome|chromium|crios|fxios|edg|android).)*safari/i.test(navigator.userAgent); } catch { return false; } };
/** Chrome·Edge의 로컬 네트워크 접근 권한 상태: 'granted'|'prompt'|'denied'|''(모름·해당 없음). 145부터 이름이 loopback-network */
export async function lnaPermission() {
  for (const name of ['loopback-network', 'local-network-access', 'local-network']) {
    try { const r = await navigator.permissions.query({ name }); if (r?.state) return r.state; } catch { /* 이 이름은 모름 */ }
  }
  return '';
}

/** 날 응답(상태 확인은 부르는 쪽). 망 오류만 AiError('local') */
export async function bridgeRaw(path, init = {}) {
  const c = config();
  if (!c) throw new AiError('local', 'no bridge', { provider: 'local' });
  try {
    return await fetch(c.base + path, { ...init, headers: { ...(init.headers || {}), 'X-Lecpage-Bridge': c.token }, cache: 'no-store', ...(c.base ? { mode: 'cors', credentials: 'omit', targetAddressSpace: 'loopback' } : {}) });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw Object.assign(new AiError('network', c.base ? 'lecpage 커넥트가 꺼져 있거나 이 브라우저가 막았어요.' : e?.message || 'bridge', { provider: 'local' }), { off: true });
  }
}
async function call(path, init = {}) {
  const r = await bridgeRaw(path, init);
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    // PC 프로그램의 거절은 { ok:false, error:'코드', message_ko }(scripts/studio.mjs fail)
    throw new AiError(r.status === 404 ? 'gone' : r.status === 401 || r.status === 403 ? 'local' : r.status >= 500 ? 'busy' : 'other', j.message_ko || j.error?.message || j.error || `bridge ${r.status}`, { provider: 'local', status: r.status });
  }
  return r;
}

/** PC 프로그램 상태 → { ok, version, agents[], chatgpt, … } | null(짝 없음). 닿지 않으면 AiError */
export async function bridgeStatus({ fresh = false } = {}) {
  if (!bridgeAvailable()) return null;
  return (await call(`/bridge/status${fresh ? '?fresh' : ''}`)).json();
}
/**
 * 화면용 한 줄 상태: { state: 'none'(짝 없음)|'on'|'off'(꺼짐)|'blocked'(브라우저가 막음: safari|denied), status?, permission? }
 * 권한을 처음 물을 때는 사람이 [허용]을 누를 때까지 응답이 늦으므로 기다림을 길게
 */
export async function pcStatus({ fresh = false, signal } = {}) {
  const c = config();
  if (!c) return { state: 'none' };
  const permission = c.same ? '' : await lnaPermission();
  if (!c.same && permission === 'denied') return { state: 'blocked', reason: 'denied', permission };
  const ctl = new AbortController(); const stop = () => ctl.abort();
  signal?.addEventListener('abort', stop, { once: true });
  const t = setTimeout(stop, permission === 'prompt' ? 120e3 : 6000);
  try {
    const r = await call(`/bridge/status${fresh ? '?fresh' : ''}`, { signal: ctl.signal });
    return { state: 'on', status: await r.json(), permission };
  } catch (e) {
    if (signal?.aborted) throw e;
    if (!c.same && isSafari()) return { state: 'blocked', reason: 'safari', permission };
    if (!c.same && (await lnaPermission()) === 'denied') return { state: 'blocked', reason: 'denied', permission: 'denied' };
    if (e?.status === 401) return { state: 'off', reason: 'token', permission };
    return { state: 'off', permission };
  } finally { clearTimeout(t); signal?.removeEventListener('abort', stop); }
}
const postJson = (path, body = {}) => call(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
/** ChatGPT 계정으로 로그인: 로그인 주소(OpenAI). open이면 PC 프로그램이 기본 브라우저로 엶 */
export const chatgptLogin = (o = {}) => postJson('/bridge/chatgpt/login', o);
export const chatgptLogout = () => call('/bridge/chatgpt', { method: 'DELETE' }).then((r) => r.json());
export const chatgptWelcomeSeen = () => postJson('/bridge/chatgpt/welcome').catch(() => null);
export async function chatgptModels() { try { return (await (await call('/bridge/chatgpt/models')).json()).models || []; } catch { return []; } }
/** Claude Code·Codex: install(설치 + 로그인)|login|update → 보이는 터미널 창. { ok, action, command? } */
export const agentAction = (id, action) => postJson(`/bridge/agents/${encodeURIComponent(id)}/${action}`);
export const autostart = (on) => (on === undefined ? call('/bridge/autostart').then((r) => r.json()) : postJson('/bridge/autostart', { on: !!on }));

/**
 * 일 맡기고 끝까지 받기. jobId가 있으면(새로 고침 뒤) 그 일에 다시 붙음.
 * onJobId(id) · onStep(label_ko) · onLog(text)
 * @returns {Promise<{ site, meta, issues }>}
 */
// 진행 소식이 3분 동안 없으면 진행 연결만 다시 붙음(에이전트는 PC에서 계속 돎. 반쯤 끊긴 연결에 묶이지 않게). 시험에서는 짧게
const idleDefault = () => { const t = (typeof globalThis !== 'undefined' && globalThis.__lpGenTest?.bridgeIdleMs) || 0; return t > 0 && t < 180e3 ? t : 180e3; };
export async function runBridgeJob({ payload, jobId = '', signal, onJobId, onStep, onLog, idleMs = idleDefault() }) {
  if (!jobId) {
    const r = await call('/bridge/jobs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal });
    jobId = (await r.json()).jobId;
    if (!jobId) throw new AiError('other', 'no job id', { provider: 'local' });
    onJobId?.(jobId);
  }
  const id = encodeURIComponent(jobId);
  let drops = 0;
  for (;;) {
    let end = '';
    const ctl = new AbortController(); const stop = () => ctl.abort();
    signal?.addEventListener('abort', stop, { once: true });
    let timer = setTimeout(stop, idleMs);
    const wd = { kick() { clearTimeout(timer); timer = setTimeout(stop, idleMs); }, text() { this.kick(); } };
    try {
      const r = await call(`/bridge/jobs/${id}/events`, { signal: ctl.signal, headers: { accept: 'text/event-stream' } });
      await readSSE(r, wd, ({ data }) => {
        const ev = data && typeof data === 'object' ? data : {};
        if (ev.type === 'step' && ev.label_ko) onStep?.(String(ev.label_ko).slice(0, 120));
        else if (ev.type === 'log' && ev.text) onLog?.(String(ev.text));
        else if (ev.type === 'done') end = 'done';
        else if (ev.type === 'error') { end = 'error'; throw new AiError('other', String(ev.error || ev.text || '내 PC의 AI가 멈췄어요.').slice(0, 300), { provider: 'local' }); }
      });
    } catch (e) {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError'); // 사용자가 멈춤(감시가 끊은 것은 아래에서 다시 붙음)
      if (e instanceof AiError && (e.kind === 'other' || e.kind === 'local' || e.kind === 'gone')) throw e;
      // 진행 연결만 끊김(연결 프로그램은 계속 돎): 잠깐 뒤 다시 붙음
      if (++drops > 6) throw e instanceof AiError ? (e.off ? Object.assign(e, { kind: 'pc-off' }) : e) : new AiError('network', 'bridge events', { provider: 'local' });
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', stop); }
    if (end === 'done') break;
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    await new Promise((res) => setTimeout(res, Math.min(5000, 500 * 2 ** drops)));
  }
  const res = await (await call(`/bridge/jobs/${id}/result`, { signal })).json();
  call(`/bridge/jobs/${id}`, { method: 'DELETE' }).catch(() => { });
  return { site: res.site || {}, meta: res.meta || {}, issues: Array.isArray(res.issues) ? res.issues : [] };
}
/** 멈추기: 연결 프로그램에 그 일을 그만두라고(지움) */
export function cancelBridgeJob(jobId) { return jobId ? call(`/bridge/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' }).catch(() => { }) : Promise.resolve(); }

/** 보낼 교재 원본(src/*) → files:[{ name, type, base64 }] */
export async function bridgeFiles(blobs, pid, project) {
  const out = [];
  for (const f of (project.files || []).filter((x) => x.key && !x.photos)) {
    const v = await blobs.get(pid, f.key).catch(() => null);
    if (v) out.push({ name: f.name, type: f.ext === 'pdf' ? 'application/pdf' : 'application/octet-stream', base64: await toBase64(v) });
  }
  return out;
}
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf' };
/**
 * 사이트 폴더의 바이트 파일(저장소 'site/…': 교재 쪽 그림·올린 사진·자료실 파일) → site:{ 경로: { base64, type } }.
 * only: 이 경로만(새로 만들 때는 교재 쪽 그림), null이면 전부(고칠 때는 지금 사이트 그대로)
 */
export async function bridgeSite(blobs, pid, only = null) {
  const out = {};
  const keys = (await blobs.keys(pid).catch(() => [])).filter((k) => k.startsWith('site/') && (!only || only.includes(k.slice(5))));
  for (const k of keys) {
    const v = await blobs.get(pid, k).catch(() => null);
    if (v) out[k.slice(5)] = { base64: await toBase64(v), type: MIME[(k.split('.').pop() || '').toLowerCase()] || 'application/octet-stream' };
  }
  return out;
}

/** 결과의 그림 값(base64 글·data: 주소) → 바이트 */
export function decodeBinary(v) {
  if (v instanceof Uint8Array) return v;
  if (v && typeof v === 'object' && typeof v.base64 === 'string') v = v.base64;
  const s = String(v || '').replace(/^data:[^,]*,/, '');
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
