// PC 프로그램(lecpage studio, skills/lecpage/scripts/studio.mjs)을 부르는 클라이언트.
// 두 가지로 붙음: (1) 기본 — lecpage.com 화면 그대로, PC 프로그램이 켜며 연 https://lecpage.com/#pair=<토큰>&port=<포트>로 짝을 맞추고
//   이 브라우저에 { token, port }를 기억해 http://127.0.0.1:<포트>/bridge/*를 직접 부름(CORS. Chrome·Edge는 처음 한 번 '로컬 네트워크 접근'을 물음).
//   (2) 대신 — Safari처럼 그 길이 막힌 브라우저는 PC 프로그램이 보여 주는 http://127.0.0.1:<포트>/ 화면(같은 출처, 앱 HTML의 <meta name="lecpage-bridge">).
// 모든 요청에 머리글 X-Lecpage-Bridge: <토큰>. 토큰·ChatGPT 로그인 정보는 PC 프로그램 안에 있고, 이 앱은 토큰(짝 맞춤용)만 압니다.
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

function metaToken() {
  try { return (typeof document !== 'undefined' && document.querySelector('meta[name="lecpage-bridge"]')?.getAttribute('content')) || ''; } catch { return ''; }
}
import { pairing, capturePairing, forgetPairing, justPaired, movePairing, PC_PORTS } from '../pair.js';
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
    return { state: 'on', status, permission };
  } catch (e) {
    if (signal?.aborted) throw e;
    // 기억한 포트에 없음(꺼짐·그 포트에 다른 프로그램이 답함): 다른 포트에서 켜졌을 수 있음(다른 창이 그 포트를 쓰던 때 켬 등) → 같은 토큰으로 가까운 포트를 살펴 옮김
    const elsewhere = e?.off || (e instanceof AiError && e.status && !e.pcReply);
    if (!c.same && elsewhere && permission !== 'prompt') { const port = await findPc(c); if (port) { movePairing(port); return pcStatus({ fresh, signal }); } }
    if (!c.same && isSafari()) return { state: 'blocked', reason: 'safari', permission };
    if (!c.same && (await lnaPermission()) === 'denied') return { state: 'blocked', reason: 'denied', permission: 'denied' };
    if (e?.status === 401) return { state: 'off', reason: 'token', permission };
    return { state: 'off', permission };
  } finally { clearTimeout(t); signal?.removeEventListener('abort', stop); }
}
let probedAt = 0;
/** 같은 토큰으로 답하는 lecpage 커넥트의 포트(없으면 0). 15초에 한 번만 */
async function findPc(c) {
  if (Date.now() - probedAt < 15000) return 0;
  probedAt = Date.now();
  const ports = PC_PORTS.filter((p) => p !== c.port);
  return Promise.any(ports.map(async (p) => {
    const r = await fetch(`http://127.0.0.1:${p}/bridge/status`, { headers: { 'X-Lecpage-Bridge': c.token }, cache: 'no-store', mode: 'cors', credentials: 'omit', targetAddressSpace: 'loopback', signal: AbortSignal.timeout(1500) });
    const j = r.ok ? await r.json() : null;
    if (!j?.ok || !Array.isArray(j.agents)) throw new Error('no');
    return p;
  })).catch(() => 0);
}
/**
 * 이 브라우저와 짝이 없을 때 이 PC에 켜진 lecpage 커넥트의 포트(없으면 0). 토큰 없이 부르면 커넥트는 401 { error:'token' }을 줌(허용한 출처면 CORS가 붙어 읽힘).
 * 커넥트가 연 브라우저가 기본 브라우저가 아니어서 다른 브라우저와 짝을 맞춘 경우를 알아봄. 사람이 누를 때만(Chrome이 '로컬 네트워크 접근'을 물을 수 있어서)
 */
export async function findUnpairedPc({ wait = 1500 } = {}) {
  return Promise.any(PC_PORTS.map(async (p) => {
    const r = await fetch(`http://127.0.0.1:${p}/bridge/status`, { cache: 'no-store', mode: 'cors', credentials: 'omit', targetAddressSpace: 'loopback', signal: AbortSignal.timeout(wait) });
    const j = await r.json().catch(() => null);
    if (!(r.status === 401 && j?.error === 'token')) throw new Error('no');
    return p;
  })).catch(() => 0);
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
export async function bridgeFiles(blobs, pid, project, limits = null) {
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
  const out = [];
  for (const x of fitFiles(items, limits)) out.push({ name: x.name, type: x.type, base64: await toBase64(x.v) });
  return out;
}
const MiB = 1048576;
const sizeOf = (v) => +(v?.size ?? v?.byteLength ?? v?.length ?? 0) || 0;
const stemOf = (n) => String(n).normalize('NFC').replace(/\.[^.]+$/, '').toLowerCase();
const tooBig = (m) => new AiError('too-big', m, { provider: 'local' });
/**
 * 커넥트의 교재 한도(파일 하나·개수·합계, scripts/studio.mjs LIMITS)에 맞추기. items: [{ name, type, v(바이트) }] → 보낼 것.
 * 같은 이름의 PDF가 함께 가는 원본(강의.pptx + 강의.pdf)은 넘칠 때 큰 것부터 빼고 PDF만 보냄. twinPdf(새 커넥트): 그 둘을 개수 하나로 셈
 */
export function fitFiles(items, limits = null) {
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
  return keep;
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
