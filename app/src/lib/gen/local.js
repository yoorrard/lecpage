// PC 프로그램(lecpage studio, skills/lecpage/scripts/studio.mjs)을 부르는 클라이언트.
// 두 가지로 붙음: (1) 기본 — lecpage.com 화면 그대로, PC 프로그램이 켜며 연 https://lecpage.com/#pair=<토큰>&port=<포트>로 짝을 맞추고
//   이 브라우저에 { token, port }를 기억해 http://127.0.0.1:<포트>/bridge/*를 직접 부름(CORS. Chrome·Edge는 처음 한 번 '로컬 네트워크 접근'을 물음).
//   (2) 대신 — Safari처럼 그 길이 막힌 브라우저는 PC 프로그램이 보여 주는 http://127.0.0.1:<포트>/ 화면(같은 출처, 앱 HTML의 <meta name="lecpage-bridge">).
// 모든 요청에 머리글 X-Lecpage-Bridge: <토큰>. 토큰·ChatGPT 로그인 정보는 PC 프로그램 안에 있고, 이 앱은 토큰(짝 맞춤용)만 압니다.
//   GET /bridge/prove?nonce=<16진수 64자>(토큰 없이) → { ok, proof }: 토큰을 보내기 전에 그 포트가 이 토큰을 아는 커넥트인지 확인(아래 '짝 증명')
//   GET /bridge/status → { ok, version, build, caps:[…], update:{ can, state, latest, available, error_ko }, platform, agents:[{ id, installed, version, auth, ready, need, note_ko }], chatgpt:{ connected, plan, email, welcome }, autostart }
//     caps가 없거나 필요한 것이 빠졌으면 이 화면보다 예전 판(앱이 '새 버전으로 바꿔야 해요'를 보여 줌). 예전 판의 없는 경로는 404 not-found
//   POST /bridge/jobs { agent, kind:'make'|'edit', request, meta, reference, files:[{ name, type, base64 }], site? } → { jobId }
//   GET /bridge/jobs/:id/events (SSE) { type:'step'|'log'|'done'|'error', label_ko?, text?, error? }
//   GET /bridge/jobs/:id/result → { site, meta, issues } · DELETE /bridge/jobs/:id
//   POST /bridge/chatgpt/login → { url } · DELETE /bridge/chatgpt · GET /bridge/chatgpt/models · POST /bridge/chatgpt/responses(SSE 중계)
//   POST /bridge/agents/claude/setup(터미널 없이 설치·로그인) · GET·DELETE /bridge/setup · POST /bridge/setup/code { code }
//   POST /bridge/agents/:id/install|login|update(보이는 터미널 창에서 공식 명령, 다른 방법) · GET·POST /bridge/autostart
//   GET·POST /bridge/update(새 판으로 바꾸고 같은 포트·토큰으로 다시 켬) · GET /pair?app=<이 앱 주소>(새 창: 다른 브라우저와 짝을 맞춘 커넥트를 이 브라우저와)
// 에이전트는 PC에서 계속 돌므로 진행 연결이 끊기거나 새로 고쳐도 같은 jobId로 다시 붙음.
import { AiError, readSSE, toBase64 } from './providers/common.js';
import { slideSetsOf, setFor, numOf, splitCap, pickPages } from './slide-sets.js';

function metaToken() {
  try { return (typeof document !== 'undefined' && document.querySelector('meta[name="lecpage-bridge"]')?.getAttribute('content')) || ''; } catch { return ''; }
}
import { pairing, capturePairing, forgetPairing, justPaired, movePairing, confirmPairing, pendingPairing, acceptPairing, PC_PORTS, PAIR } from '../pair.js';
export { pairing, capturePairing, forgetPairing, justPaired };
/** 예전 판 lecpage 커넥트(이 화면이 부르는 경로가 없음)일 때 보이는 말 */
export const OLD_PC = 'lecpage 커넥트를 새 버전으로 바꿔야 해요.';
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

// ── 짝 증명: 토큰을 보내기 전에 그 포트의 프로그램이 이 토큰을 아는 lecpage 커넥트인지 확인 ──
// 같은 PC의 다른 프로그램이 가까운 포트에서 커넥트인 척(토큰 없는 물음에 401 token) 답해 짝 맞춤 토큰을 받아 가지 못하게.
// 커넥트의 GET /bridge/prove?nonce=…(토큰 없이): { proof: HMAC-SHA256(토큰, "lecpage-connect-prove:v1:<포트>:<nonce>") } — scripts/studio.mjs proofOf와 같은 글.
// 이 길이 없는 예전 판 커넥트는 401 token으로 답함 → 한 번도 증명한 적 없는 짝이면 지금처럼 쓰고, 한 번이라도 증명한 짝이면 받아들이지 않음
// (가짜가 '예전 판인 척' 하지 못하게). 커넥트가 다시 연 #pair=…로 짝을 새로 기억하면(같은 토큰을 아는 쪽만 할 수 있음) 그 표시는 처음부터.
const PROOF = 'lecpage:pc-proof';
const PROOF_MS = 30000; // 한 번 증명한 포트는 이만큼은 다시 묻지 않음
const proofs = new Map(); // 포트 → { token, until }
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
/** 지금 기억한 짝을 적은 때(pair.js save의 at). 못 읽으면 0 */
function pairedAt() { try { return +JSON.parse(localStorage.getItem(PAIR) || 'null')?.at || 0; } catch { return 0; } }
/** 짝 기록을 다시 적은 뒤(쓰던 짝 표시·포트 옮김) 부름: 방금 증명한 짝이면 증명 표시도 다시 적음(그 사이 '증명한 적 없음'으로 보이지 않게) */
function keepProved(port, token) { const hit = proofs.get(port); if (hit && hit.token === token && hit.until > Date.now()) markProved(token); }
/** 이 토큰의 짝이 증명한 적 있는지(그 뒤 짝을 새로 기억했으면 아님) */
function provedBefore(token) {
  try { const j = JSON.parse(localStorage.getItem(PROOF) || 'null'); return !!j && j.token === token && +j.at >= pairedAt(); } catch { return false; }
}
function markProved(token) { try { localStorage.setItem(PROOF, JSON.stringify({ token, at: Date.now() })); } catch { /* 저장 못 하면 이번만 */ } }
/** 그 포트에 짝 증명을 물음 → 'ok'(이 토큰을 아는 커넥트) | 'old'(증명 길이 없는 예전 판 꼴의 답) | 'no'(커넥트가 아니거나 다른 토큰). 닿지 못하면 throw */
async function provePc(port, token, signal) {
  if (!globalThis.crypto?.subtle) return 'old'; // 보안 맥락이 아닌 주소(개발용 http): 확인할 길이 없어 예전처럼
  const nonce = hex(crypto.getRandomValues(new Uint8Array(32)));
  const init = { cache: 'no-store', mode: 'cors', credentials: 'omit', targetAddressSpace: 'loopback', signal };
  let r;
  try { r = await fetch(`http://127.0.0.1:${port}/bridge/prove?nonce=${nonce}`, init); }
  catch (e) {
    if (signal?.aborted) throw e;
    // 증명 길에만 닿지 못함: 토큰 없는 상태 물음에 커넥트 꼴(401 token)로 답하면 예전 판 꼴로 봄(닿지 못하면 꺼진 것 → throw). 토큰은 보내지 않음
    const s = await fetch(`http://127.0.0.1:${port}/bridge/status`, init);
    const sj = await s.json().catch(() => null);
    return s.status === 401 && sj?.error === 'token' ? 'old' : 'no';
  }
  const j = await r.json().catch(() => null);
  if (r.status === 401 && j?.error === 'token') return 'old';
  if (r.status !== 200 || !j?.ok || typeof j.proof !== 'string') return 'no';
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(token), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const want = hex(await crypto.subtle.sign('HMAC', key, enc.encode(`lecpage-connect-prove:v1:${port}:${nonce}`)));
  return want === j.proof.toLowerCase() ? 'ok' : 'no';
}
/** 그 포트에 이 토큰을 보내도 되는지(증명을 받았거나, 증명한 적 없는 짝의 예전 판). 닿지 못하면 throw */
async function mayTell(port, token, signal) {
  const hit = proofs.get(port);
  if (hit && hit.token === token && hit.until > Date.now()) return true;
  const r = await provePc(port, token, signal);
  if (r === 'ok') { proofs.set(port, { token, until: Date.now() + PROOF_MS }); markProved(token); return true; }
  proofs.delete(port);
  return r === 'old' && !provedBefore(token);
}
/** 시험용: 기억한 증명을 비움 */
export function forgetProofs() { proofs.clear(); }

/** 날 응답(상태 확인은 부르는 쪽). 망 오류만 AiError('local') */
export async function bridgeRaw(path, init = {}) {
  const c = config();
  if (!c) throw new AiError('local', 'no bridge', { provider: 'local' });
  if (c.base) {
    // 다른 출처의 커넥트(127.0.0.1:<포트>)에는 짝 증명을 받은 뒤에만 토큰을 보냄. 127.0.0.1 화면(같은 출처)은 그 커넥트가 준 화면이라 묻지 않음
    let ok = false;
    try { ok = await mayTell(c.port, c.token, init.signal || AbortSignal.timeout(6000)); }
    catch (e) {
      if (e?.name === 'AbortError' && init.signal?.aborted) throw e;
      throw Object.assign(new AiError('network', 'lecpage 커넥트가 꺼져 있거나 이 브라우저가 막았어요.', { provider: 'local' }), { off: true });
    }
    if (!ok) throw Object.assign(new AiError('network', '이 PC에서 lecpage 커넥트를 확인하지 못했어요. lecpage 커넥트를 끄고 다시 켜 주세요.', { provider: 'local' }), { off: true });
  }
  try {
    return await fetch(c.base + path, { ...init, headers: { ...(init.headers || {}), 'X-Lecpage-Bridge': c.token }, cache: 'no-store', ...(c.base ? { mode: 'cors', credentials: 'omit', targetAddressSpace: 'loopback' } : {}) });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw Object.assign(new AiError('network', c.base ? 'lecpage 커넥트가 꺼져 있거나 이 브라우저가 막았어요.' : e?.message || 'bridge', { provider: 'local' }), { off: true });
  }
}
/** 새 판으로 바꾸는 동안(503 updating) 보이는 말 */
export const PC_UPDATING = 'lecpage 커넥트를 새 버전으로 바꾸는 중이에요. 잠시 뒤 다시 해 주세요.';
/**
 * PC 프로그램의 거절({ ok:false, error:'코드', message_ko }, scripts/studio.mjs fail) → AiError 종류.
 * 'updating'(새 판으로 바꾸는 중) · 'pc-pair'(짝 맞춤 토큰이 다름) · 'gone'(없는 작업) · 'local'(출처 거절 등) · 'busy'(5xx) · 'other'
 */
export function bridgeErrorKind(status, j = {}) {
  if (j.error === 'updating') return 'updating';
  if (status === 401 && j.error === 'token') return 'pc-pair';
  return status === 404 ? 'gone' : status === 401 || status === 403 ? 'local' : status >= 500 ? 'busy' : 'other';
}
async function call(path, init = {}) {
  const r = await bridgeRaw(path, init);
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    // 경로가 없음(not-found) = 이 화면보다 예전 판. pcReply: lecpage 커넥트의 답 꼴인지(아니면 그 포트에 다른 프로그램)
    if (r.status === 404 && j.error === 'not-found') throw Object.assign(new AiError('gone', OLD_PC, { provider: 'local', status: 404 }), { old: true, pcReply: true });
    const kind = bridgeErrorKind(r.status, j);
    throw Object.assign(new AiError(kind, kind === 'updating' ? PC_UPDATING : j.message_ko || j.error?.message || j.error || `bridge ${r.status}`, { provider: 'local', status: r.status }), { pcReply: j && j.ok === false && typeof j.error === 'string' });
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
    const status = await r.json().catch(() => null);
    if (!status?.ok || !Array.isArray(status.agents)) throw Object.assign(new AiError('network', 'not a lecpage 커넥트', { provider: 'local' }), { off: true }); // 그 포트에 다른 프로그램
    if (!c.same) { confirmPairing(c.token); keepProved(c.port, c.token); } // 이 토큰에 답함: 이제 다른 토큰의 #pair=로 바로 덮지 않음
    return { state: 'on', status, permission };
  } catch (e) {
    if (signal?.aborted) throw e;
    // 기억한 포트에 없음(꺼짐·그 포트에 다른 프로그램이 답함): 다른 포트에서 켜졌을 수 있음(다른 창이 그 포트를 쓰던 때 켬 등) → 같은 토큰으로 가까운 포트를 살펴 옮김
    const elsewhere = e?.off || (e instanceof AiError && e.status && !e.pcReply);
    if (!c.same && elsewhere && permission !== 'prompt') { const port = await findPc(c); if (port) { movePairing(port, c.token); keepProved(port, c.token); return pcStatus({ fresh, signal }); } }
    if (!c.same && isSafari()) return { state: 'blocked', reason: 'safari', permission };
    if (!c.same && (await lnaPermission()) === 'denied') return { state: 'blocked', reason: 'denied', permission: 'denied' };
    if (e?.status === 401) return { state: 'off', reason: 'token', permission };
    return { state: 'off', permission };
  } finally { clearTimeout(t); signal?.removeEventListener('abort', stop); }
}
/** 그 포트의 lecpage 커넥트가 이 토큰에 답하는지(답하면 상태, 아니면 throw) */
async function askPc(port, token, ms) {
  const r = await fetch(`http://127.0.0.1:${port}/bridge/status`, { headers: { 'X-Lecpage-Bridge': token }, cache: 'no-store', mode: 'cors', credentials: 'omit', targetAddressSpace: 'loopback', signal: AbortSignal.timeout(ms) });
  const j = r.ok ? await r.json().catch(() => null) : null;
  if (!j?.ok || !Array.isArray(j.agents)) throw new Error('no');
  return j;
}
/**
 * 그 포트에 있는 것이 lecpage 커넥트인지(토큰을 보내지 않고): 커넥트는 토큰 없는 물음에 401 { ok:false, error:'token' }을 줌
 * (허용한 출처면 CORS가 붙어 읽힘. lecpage.com과 짝을 맞추는 모든 판이 그렇게 답함). 아니면 throw
 */
async function isPc(port, ms) {
  const r = await fetch(`http://127.0.0.1:${port}/bridge/status`, { cache: 'no-store', mode: 'cors', credentials: 'omit', targetAddressSpace: 'loopback', signal: AbortSignal.timeout(ms) });
  const j = await r.json().catch(() => null);
  if (!(r.status === 401 && j?.error === 'token')) throw new Error('no');
  return port;
}
let probedAt = 0;
/**
 * 같은 토큰으로 답하는 lecpage 커넥트의 포트(없으면 0). 15초에 한 번만.
 * 두 단계: 먼저 토큰 없이 짝 증명을 물어 이 토큰을 아는 커넥트에만 토큰을 보냄(그 범위의 다른 프로그램이 커넥트인 척 답해도 짝 맞춤 토큰이 가지 않게.
 * 커넥트의 findRunning과 같은 순서). 증명 길이 없는 예전 판은 증명한 적 없는 짝일 때만 지금처럼(mayTell)
 */
async function findPc(c) {
  if (Date.now() - probedAt < 15000) return 0;
  probedAt = Date.now();
  const ports = PC_PORTS.filter((p) => p !== c.port);
  return Promise.any(ports.map((p) => mayTell(p, c.token, AbortSignal.timeout(1500)).then((ok) => { if (!ok) throw new Error('no'); return askPc(p, c.token, 1500); }).then(() => p))).catch(() => 0);
}
/**
 * 쓰던 짝과 다른 토큰의 #pair=…(capturePairing이 'check'): 그 포트의 lecpage 커넥트가 새 토큰에 답할 때만 짝을 바꿈
 * (아무 사이트나 lecpage.com/#pair=<가짜>로 짝을 덮어 연결을 끊지 못하게). --new-token으로 다시 켠 커넥트는 새 토큰에 답하므로 그대로 바뀜.
 * Chrome·Edge가 '로컬 네트워크 접근'을 물으면 사람이 답할 때까지 기다림. → 'ok'(바꿈) | 'denied'(브라우저가 막음) | 'fail'(꺼짐·토큰이 다름: 쓰던 짝 그대로)
 */
export async function checkPairing() {
  const p = pendingPairing();
  if (!p) return 'fail';
  const permission = await lnaPermission();
  if (permission === 'denied') return 'denied';
  try { await askPc(p.port, p.token, permission === 'prompt' ? 120e3 : 6000); } catch { return (await lnaPermission()) === 'denied' ? 'denied' : 'fail'; }
  return acceptPairing(p) ? 'ok' : 'fail';
}
/**
 * 이 브라우저와 짝이 없을 때 이 PC에 켜진 lecpage 커넥트의 포트(없으면 0). 토큰 없이 부르면 커넥트는 401 { error:'token' }을 줌(허용한 출처면 CORS가 붙어 읽힘).
 * 커넥트가 연 브라우저가 기본 브라우저가 아니어서 다른 브라우저와 짝을 맞춘 경우를 알아봄. 사람이 누를 때만(Chrome이 '로컬 네트워크 접근'을 물을 수 있어서)
 */
export async function findUnpairedPc({ wait = 1500 } = {}) {
  return Promise.any(PC_PORTS.map((p) => isPc(p, wait))).catch(() => 0);
}
/** [이 브라우저와 연결]이 새 창으로 여는 주소: 커넥트가 이 앱 주소/#pair=<토큰>&port=<포트>로 보냄(그 창이 짝을 기억하고 기다리던 탭이 이어 받음) */
export const pairPageUrl = (port) => `http://127.0.0.1:${port}/pair?app=${encodeURIComponent(location.origin + location.pathname)}`;
const postJson = (path, body = {}) => call(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
/** ChatGPT 계정으로 로그인: 로그인 주소(OpenAI). open이면 PC 프로그램이 기본 브라우저로 엶 */
export const chatgptLogin = (o = {}) => postJson('/bridge/chatgpt/login', o);
export const chatgptLogout = () => call('/bridge/chatgpt', { method: 'DELETE' }).then((r) => r.json());
export const chatgptWelcomeSeen = () => postJson('/bridge/chatgpt/welcome').catch(() => null);
/**
 * ChatGPT 계정이 쓸 수 있는 모델 목록. 실패는 까닭대로 AiError: 'pc-off'(커넥트 꺼짐) · 'updating' · 'pc-pair' ·
 * 'chatgpt-login'(연결이 풀림: 커넥트의 not-connected·OpenAI 401만) · 'busy'(잠깐 받지 못함)
 */
export async function chatgptModels() {
  let r;
  try { r = await bridgeRaw('/bridge/chatgpt/models'); } catch (e) { if (e?.off) throw Object.assign(new AiError('pc-off', e.message, { provider: 'chatgpt' }), { off: true }); throw e; }
  const j = await r.json().catch(() => ({}));
  if (r.ok) return Array.isArray(j.models) ? j.models : [];
  const k = bridgeErrorKind(r.status, j);
  const kind = j.error === 'not-connected' ? 'chatgpt-login' : k === 'updating' || k === 'pc-pair' ? k : r.status === 403 ? 'local' : r.status === 404 ? 'other' : 'busy';
  throw new AiError(kind, kind === 'updating' ? PC_UPDATING : j.message_ko || `models ${r.status}`, { provider: 'chatgpt', status: r.status });
}
/** Claude Code·Codex: install(설치 + 로그인)|login|update → 보이는 터미널 창. { ok, action, command? } */
export const agentAction = (id, action) => postJson(`/bridge/agents/${encodeURIComponent(id)}/${action}`);
/** Claude 계정 연결(터미널 없이): 없으면 창 없이 설치 → Claude Code 로그인(브라우저). { ok, setup:{ step, running, progress, loginUrl, waitingCode, error } } */
export const agentSetup = (id) => postJson(`/bridge/agents/${encodeURIComponent(id)}/setup`);
export const setupStatus = () => call('/bridge/setup').then((r) => r.json()).then((j) => j.setup || null);
/** 로그인 화면에 나온 코드(가운데 # 포함)를 Claude Code에 넘김(lecpage 커넥트도 기록하지 않음) */
export const setupCode = (code) => postJson('/bridge/setup/code', { code });
export const setupCancel = () => call('/bridge/setup', { method: 'DELETE' }).then((r) => r.json());
/** 새 판으로 바꾸기: 202 { update:{ state } }(받는 중 → 다시 켬) | 200 { upToDate } */
export const updateStart = () => postJson('/bridge/update');
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
      if (e instanceof AiError && (e.kind === 'other' || e.kind === 'local' || e.kind === 'gone' || e.kind === 'pc-pair')) throw e;
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

const DOC_MIME = { pdf: 'application/pdf', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ppt: 'application/vnd.ms-powerpoint', doc: 'application/msword', hwp: 'application/x-hwp', hwpx: 'application/hwp+zip', txt: 'text/plain', md: 'text/markdown' };
/**
 * 보낼 교재 원본(src/*) → files:[{ name, type, base64 }]. 커넥트가 이 PC의 프로그램으로 만든 PDF(conv/*)도 같은 이름의 .pdf로 함께(에이전트가 그림·글을 그대로 읽게).
 * limits(커넥트 /bridge/status의 limits): 한도를 넘으면 fitFiles대로 PDF가 있는 원본부터 빼고, 그래도 넘으면 보내기 전에 AiError('too-big')
 */
export async function bridgeFiles(blobs, pid, project, limits = null, sets = null, notesOf = null) {
  const items = [];
  const list = (project.files || []).filter((x) => x.key && !x.photos);
  const names = new Set(list.map((f) => f.name.toLowerCase()));
  for (const f of list) {
    const v = DOC_MIME[f.ext] && await blobs.get(pid, f.key).catch(() => null); // 커넥트가 받는 형식만(키노트 등은 만든 PDF로)
    if (v) items.push({ name: f.name, type: DOC_MIME[f.ext], v });
    const pdfName = f.name.replace(/\.[^.]+$/, '') + '.pdf';
    if (f.pdf?.key && f.ext !== 'pdf' && !names.has(pdfName.toLowerCase())) {
      const c = await blobs.get(pid, f.pdf.key).catch(() => null);
      if (c) { items.push({ name: pdfName, type: 'application/pdf', v: c }); names.add(pdfName.toLowerCase()); }
    }
  }
  // 사이트용 교재 쪽 그림(site['material/p-NNN'])을 그린 교재(와 같은 이름의 PDF 짝)에 표시해(sets: 보낼 쪽 그림의 묶음, 없으면 연수에 적힌 것)
  // 커넥트가 AI에게 '어느 교재의 쪽 그림인지' 있는 그대로 알리게 함(교재가 여럿일 때 다른 교재의 쪽으로 잘못 읽지 않게). 예전 커넥트는 이 칸을 그냥 넘김
  // 교재마다 그렸으면(묶음이 둘 이상, 이어 매긴 번호) 교재마다 { first, count }를 적음. 교재 하나의 것이면 예전처럼 true(예전 커넥트도 앎)
  const S = sets || slideSetsOf(project);
  const mark = (name) => { const s = S.length ? setFor(S, name) : null; return !s ? {} : { pageImages: S.length === 1 ? true : { first: s.first, count: s.count } }; };
  const out = [];
  const fit = fitFilesInfo(items, limits);
  for (const x of fit.keep) out.push({ name: x.name, type: x.type, base64: await toBase64(x.v), ...mark(x.name) });
  // 한도에 맞추느라 뺀 원본(같은 이름의 PDF만 감): 말없이 빼지 않게 이름을 돌려주고(out.dropped → 강사 안내), PDF에 없는 발표자 노트는
  // 글 파일로 함께 보냄(notesOf(원본 이름) → 글. 같은 이름이라 커넥트의 교재 개수는 그대로, 예전 커넥트는 개수가 넘지 않을 때만)
  const L = { files: 20, ...(limits || {}) };
  out.dropped = fit.dropped; out.notesSent = [];
  for (const name of notesOf ? fit.dropped : []) {
    const text = String(notesOf(name) || '').trim();
    const md = name.replace(/\.[^.]+$/, '') + '.md';
    if (!text || names.has(md.toLowerCase()) || (!L.twinPdf && out.length + 1 > L.files)) continue;
    const pdf = name.replace(/\.[^.]+$/, '') + '.pdf';
    out.push({ name: md, type: 'text/markdown', base64: await toBase64(new TextEncoder().encode(`# ${name}의 발표자 노트\n\n원본 ${name} 파일이 커서 같은 내용의 ${pdf}로 보냈어요. PDF에는 발표자 노트가 없어 여기에 옮겨 적었어요.\n\n${text}\n`)) });
    names.add(md.toLowerCase()); out.notesSent.push(name);
  }
  return out;
}
/** 교재마다 그린 쪽 그림({ first, count })을 아는 커넥트의 표시(/bridge/status caps). 없는 예전 커넥트에는 첫 교재의 쪽 그림만 보냄 */
export const PAGE_SETS_CAP = 'page-sets';
/**
 * 커넥트로 보낼 교재 쪽 그림 고르기(새로 만들 때). list: ['material/p-001.webp', …] · sets: 교재마다 묶음 · only: 이 묶음의 그림만(예전 커넥트)
 * 사이트 한도(커넥트 siteMB, 기본 40MB)를 넘으면 교재마다 고르게 골라 줄임(쪽이 적은 교재는 다, 남는 몫은 쪽이 많은 교재에) → { list, total, cut }
 */
export async function fitSiteImages(blobs, pid, list, sets = [], only = null, limits = null) {
  const inSet = (n, s) => n >= s.first && n < s.first + s.count;
  const all = (list || []).filter((p) => numOf(p) && (!only || only.some((s) => inSet(numOf(p), s))));
  const max = Math.max(1, (+limits?.siteMB || 40) - 1) * MiB;
  const size = new Map();
  for (const p of all) size.set(numOf(p), sizeOf(await blobs.get(pid, 'site/' + p).catch(() => null)));
  let total = 0; for (const v of size.values()) total += v;
  if (total <= max) return { list: all, total: all.length, cut: false };
  // 묶음 밖의 그림(어느 교재 것인지 모름)은 한 묶음으로 봄
  const nums = [...size.keys()].sort((a, b) => a - b);
  const groups = (only || sets || []).filter((s) => nums.some((n) => inSet(n, s))).map((s) => nums.filter((n) => inSet(n, s)));
  const rest = nums.filter((n) => !groups.some((g) => g.includes(n))); if (rest.length) groups.push(rest);
  let cap = Math.floor((all.length * max * 0.95) / total); let keep = new Set();
  for (let i = 0; i < 8; i++) {
    const shares = splitCap(groups.map((g) => g.length), cap);
    keep = new Set(groups.flatMap((g, k) => pickPages(g.length, shares[k]).map((j) => g[j - 1])));
    let sum = 0; for (const n of keep) sum += size.get(n);
    if (sum <= max || cap <= groups.length) break;
    cap = Math.max(groups.length, Math.floor((cap * max * 0.95) / sum));
  }
  const out = all.filter((p) => keep.has(numOf(p)));
  return { list: out, total: all.length, cut: out.length < all.length };
}
const MiB = 1048576;
const sizeOf = (v) => +(v?.size ?? v?.byteLength ?? v?.length ?? 0) || 0;
const stemOf = (n) => String(n).normalize('NFC').replace(/\.[^.]+$/, '').toLowerCase();
const tooBig = (m) => new AiError('too-big', m, { provider: 'local' });
/**
 * 커넥트의 교재 한도(파일 하나·개수·합계, scripts/studio.mjs LIMITS)에 맞추기. items: [{ name, type, v(바이트) }] → 보낼 것.
 * 같은 이름의 PDF가 함께 가는 원본(강의.pptx + 강의.pdf)은 넘칠 때 큰 것부터 빼고 PDF만 보냄. twinPdf(새 커넥트): 그 둘을 개수 하나로 셈
 */
export function fitFiles(items, limits = null) { return fitFilesInfo(items, limits).keep; }
/** fitFiles + 한도에 맞추느라 뺀 원본의 이름(같은 이름의 PDF만 감: 말없이 빼지 않게 부르는 쪽이 알림) → { keep, dropped: [이름] } */
export function fitFilesInfo(items, limits = null) {
  const L = { files: 20, materialMB: 120, fileMB: 100, ...(limits || {}) };
  const pdfs = new Set(items.filter((x) => /\.pdf$/i.test(x.name)).map((x) => stemOf(x.name)));
  const twin = (x) => !/\.pdf$/i.test(x.name) && pdfs.has(stemOf(x.name));
  const count = (a) => (L.twinPdf ? new Set(a.map((x) => stemOf(x.name))).size : a.length);
  const total = (a) => a.reduce((n, x) => n + sizeOf(x.v), 0);
  let keep = items.filter((x) => !(twin(x) && sizeOf(x.v) > L.fileMB * MiB));
  const big = keep.find((x) => sizeOf(x.v) > L.fileMB * MiB);
  if (big) throw tooBig(`'${big.name}' 파일이 ${L.fileMB}MB를 넘어 lecpage 커넥트로 보낼 수 없어요. 교재를 나눠 넣어 주세요.`);
  const drops = keep.filter(twin).sort((a, b) => sizeOf(b.v) - sizeOf(a.v));
  const over = () => total(keep) > L.materialMB * MiB || (!L.twinPdf && keep.length > L.files);
  while (over() && drops.length) { const d = drops.shift(); keep = keep.filter((x) => x !== d); }
  if (count(keep) > L.files) throw tooBig(`교재는 한 번에 ${L.files}개까지 lecpage 커넥트로 보낼 수 있어요(지금 ${count(keep)}개). 교재를 나눠 주세요.`);
  if (total(keep) > L.materialMB * MiB) throw tooBig(`교재가 모두 합쳐 ${L.materialMB}MB를 넘어 lecpage 커넥트로 보낼 수 없어요. 교재를 줄이거나 나눠 주세요.`);
  return { keep, dropped: items.filter((x) => !keep.includes(x)).map((x) => x.name) };
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
