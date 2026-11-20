// 세 회사 어댑터가 함께 쓰는 것: 주소, SSE 읽기, 글자가 안 오면 끊는 감시, 오류 모양(ai.js의 AiError·classify를 그대로 씀), base64.
// 근거: docs/research/ai-first-2026-11.md §1(CORS·스트리밍·이어 받기), docs/plan-ai-first.md §6(60~90초 감시)
import { AiError, fail, isBlockPage } from '../../ai.js';

export { AiError };

export const BASES = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com',
  gemini: 'https://generativelanguage.googleapis.com',
};

// 시험용 손잡이: 가짜 서버(같은 PC의 http://127.0.0.1·localhost)로만 바꿀 수 있음. 실제 키가 다른 곳으로 가지 않게
const LOOPBACK = /^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}(\/[\w-]+)?$/;
const hook = () => (typeof globalThis !== 'undefined' && globalThis.__lpGenTest) || null;
export function baseFor(provider) {
  const b = hook()?.bases?.[provider];
  return typeof b === 'string' && LOOPBACK.test(b) ? b : BASES[provider];
}

/**
 * 감시 시간(밀리초). 글자가 오기 시작한 뒤 idle 동안 아무것도 안 오면 끊음(60~90초 → 75초).
 * 첫 글자 전(생각하는 시간)은 first, 응답 머리글 전(교재 올리기·줄 서기)은 connect + 올리는 양에 비례.
 * 시험에서는 짧게(더 길게는 못 바꿈)
 */
export function limits(bodyBytes = 0) {
  const t = hook() || {};
  const min = (v, d) => (Number.isFinite(v) && v > 0 && v < d ? v : d);
  const idle = min(t.idleMs, 75e3);
  const first = min(t.firstMs, 150e3);
  const connect = min(t.connectMs, 120e3 + Math.round(bodyBytes / 40)); // 40바이트/밀리초 ≈ 초당 40KB(느린 학교망)
  return { idle, first, connect };
}

/**
 * 멈춤 감시. stage('connect'|'first'|'idle')로 단계를 바꾸고 kick()으로 시계를 다시 맞춤. 시간이 다 되면 abort
 * signal: 바깥(멈추기 버튼)의 신호. 안쪽 신호(ctl.signal)를 fetch에 넘김
 */
export function watchdog(signal, bodyBytes = 0) {
  const L = limits(bodyBytes);
  const ctl = new AbortController();
  let timer = 0; let stalled = false; let stage = 'connect';
  const arm = () => {
    clearTimeout(timer);
    const ms = stage === 'connect' ? L.connect : stage === 'first' ? L.first : L.idle;
    timer = setTimeout(() => { stalled = true; ctl.abort(); }, ms);
  };
  const onAbort = () => { clearTimeout(timer); ctl.abort(signal.reason); };
  if (signal) { if (signal.aborted) ctl.abort(signal.reason); else signal.addEventListener('abort', onAbort, { once: true }); }
  arm();
  return {
    signal: ctl.signal,
    stage(s) { stage = s; arm(); },
    kick() { if (stage === 'connect') stage = 'first'; arm(); },
    text() { if (stage !== 'idle') stage = 'idle'; arm(); },
    get stalled() { return stalled; },
    /** 끝: 시계를 멈추고, 아직 열린 연결(오류로 중간에 나온 경우)은 닫음 */
    done() { clearTimeout(timer); signal?.removeEventListener?.('abort', onAbort); if (!ctl.signal.aborted) ctl.abort(); },
    /** 감시가 끊었으면 'stall' 오류로, 사용자가 멈췄으면 AbortError 그대로 */
    wrap(e, provider) {
      if (stalled) return new AiError('stall', 'no data', { provider });
      if (e?.name === 'AbortError' || e?.name === 'TimeoutError') return e;
      if (e instanceof AiError) return e;
      return new AiError('network', e?.message || 'network', { provider });
    },
  };
}

/** 응답 확인: 실패면 AiError(ai.js fail), 망의 차단 화면이면 'blocked'. 교재가 너무 크다는 400은 'too-long'으로 */
export async function check(r, provider) {
  if (!r.ok) {
    try { await fail(r, provider); } catch (e) { throw tooLong(e); }
  }
  if (isBlockPage(r)) throw new AiError('blocked', 'html page', { status: r.status, provider });
  return r;
}
const TOO_LONG = /pdf|pages?\b|too large|request_too_large|payload|exceed|maximum|limit of|size/i;
export function tooLong(e) {
  if (e instanceof AiError && e.kind === 'other' && (e.status === 400 || e.status === 413) && TOO_LONG.test(e.message || '')) e.kind = 'too-long';
  return e;
}

/**
 * SSE 읽기: 'event:'·'data:' 줄을 모아 빈 줄에서 하나로 넘김(onMessage({ event, data })). data는 JSON이면 객체로.
 * 받은 바이트마다 wd.kick()(핑·주석도 살아 있다는 표시)
 */
export async function readSSE(r, wd, onMessage) {
  const reader = r.body.getReader(); const dec = new TextDecoder();
  let buf = ''; let event = ''; let data = [];
  const flush = () => {
    if (!data.length && !event) return;
    const raw = data.join('\n'); let parsed = raw;
    if (raw && raw !== '[DONE]') { try { parsed = JSON.parse(raw); } catch { parsed = raw; } }
    const m = { event, data: parsed }; event = ''; data = [];
    onMessage(m);
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    wd.kick();
    buf += dec.decode(value, { stream: true });
    let n;
    while ((n = buf.indexOf('\n')) >= 0) {
      let line = buf.slice(0, n); buf = buf.slice(n + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line === '') { flush(); continue; }
      if (line.startsWith(':')) continue; // 주석(살아 있음 표시)
      const c = line.indexOf(':'); const field = c < 0 ? line : line.slice(0, c); let val = c < 0 ? '' : line.slice(c + 1);
      if (val.startsWith(' ')) val = val.slice(1);
      if (field === 'event') event = val; else if (field === 'data') data.push(val);
    }
  }
  if (buf.trim()) { const line = buf.trim(); if (line.startsWith('data:')) data.push(line.slice(5).trim()); }
  flush();
}

/** fetch + 감시 + 오류 모양. 응답 머리글이 오면 'first' 단계로 */
export async function post(provider, url, init, wd) {
  let r;
  try { r = await fetch(url, { ...init, signal: wd.signal }); }
  catch (e) { throw wd.wrap(e, provider); }
  wd.stage('first');
  try { return await check(r, provider); } catch (e) { throw wd.wrap(e, provider); }
}

/** Uint8Array·Blob → base64(큰 파일도 메모리를 한 번에 크게 쓰지 않게: 브라우저는 FileReader, Node는 Buffer) */
export async function toBase64(data) {
  if (typeof data === 'string') return data;
  if (typeof Buffer !== 'undefined' && !(typeof Blob !== 'undefined' && data instanceof Blob)) return Buffer.from(data.buffer ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : data).toString('base64');
  const blob = data instanceof Blob ? data : new Blob([data]);
  if (typeof FileReader === 'undefined') return Buffer.from(await blob.arrayBuffer()).toString('base64');
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => { const s = String(fr.result); res(s.slice(s.indexOf(',') + 1)); };
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });
}

/** 이어 쓰기 요청 글(세 회사 공통, 사용자 메시지). Claude 공식 복구 문구를 따름(streaming.md "Error recovery") */
export function continueText(partial) {
  return `Your previous response was interrupted and ended with:\n<previous_response>\n${partial}\n</previous_response>\nContinue from where you left off. 바로 다음 글자부터 이어서 쓰고, 앞부분을 되풀이하거나 설명을 붙이지 마세요.`;
}
