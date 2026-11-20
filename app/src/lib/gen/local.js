// 내 PC의 Claude Code·Codex(연결 프로그램, docs/plan-ai-first.md §10)를 부르는 클라이언트. 연결 프로그램은 다른 작업자가 만듦.
// 약속: 같은 출처, 모든 요청에 머리글 X-Lecpage-Bridge: <토큰>(연결 프로그램이 앱 HTML에 <meta name="lecpage-bridge" content="…">로 넣음)
//   GET /bridge/status → { ok, version, agents:[{ id, installed, version, auth }] }
//   POST /bridge/jobs { agent, kind:'make'|'edit', request, meta, reference, files:[{ name, type, base64 }], site? } → { jobId }
//   GET /bridge/jobs/:id/events (SSE) { type:'step'|'log'|'done'|'error', label_ko?, text?, error? }
//   GET /bridge/jobs/:id/result → { site, meta, issues } · DELETE /bridge/jobs/:id
// 에이전트는 PC에서 계속 돌므로 진행 연결이 끊기거나 새로 고쳐도 같은 jobId로 다시 붙음.
import { AiError, readSSE, toBase64 } from './providers/common.js';

export function bridgeToken() {
  try { return (typeof document !== 'undefined' && document.querySelector('meta[name="lecpage-bridge"]')?.getAttribute('content')) || ''; } catch { return ''; }
}
/** 이 앱이 연결 프로그램에서 열렸는지(토큰이 있음) */
export const bridgeAvailable = () => !!bridgeToken();

async function call(path, init = {}) {
  const token = bridgeToken();
  if (!token) throw new AiError('local', 'no bridge', { provider: 'local' });
  let r;
  try { r = await fetch(path, { ...init, headers: { ...(init.headers || {}), 'X-Lecpage-Bridge': token }, cache: 'no-store' }); }
  catch (e) { if (e?.name === 'AbortError') throw e; throw new AiError('network', e?.message || 'bridge', { provider: 'local' }); }
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    // 연결 프로그램의 거절은 { ok:false, error:'코드', message_ko }(scripts/studio.mjs fail)
    throw new AiError(r.status === 404 ? 'gone' : r.status === 401 || r.status === 403 ? 'local' : r.status >= 500 ? 'busy' : 'other', j.message_ko || j.error?.message || j.error || `bridge ${r.status}`, { provider: 'local', status: r.status });
  }
  return r;
}

/** 연결 프로그램 상태(설치된 에이전트·로그인 방식) → { ok, version, agents[] } | null(연결 프로그램에서 열지 않음) */
export async function bridgeStatus() {
  if (!bridgeAvailable()) return null;
  return (await call('/bridge/status')).json();
}

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
      if (++drops > 6) throw e instanceof AiError ? e : new AiError('network', 'bridge events', { provider: 'local' });
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
