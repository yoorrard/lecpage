// OpenAI: Responses API를 background:true + stream:true + store:true로. 서버가 끝까지 돌리므로 연결이 끊기거나 새로 고쳐도
// GET /v1/responses/{id}?stream=true&starting_after=<sequence_number>로 받은 다음부터 이어 받고, 다 받으면 DELETE로 지움.
// (store를 빼면 약 10분 뒤 지워져 탭이 오래 잠들면 못 받음.) PDF는 input_file(파일·합계 50MB 미만), 그림은 input_image.
// 근거: docs/research/ai-first-2026-11.md §1.3
import { classify } from '../../ai.js';
import { AiError, baseFor, watchdog, readSSE, post, toBase64, continueText } from './common.js';

const auth = (key) => ({ authorization: `Bearer ${key}` });

/** 공통 parts → Responses input content */
export async function openaiContent(parts, continueFrom) {
  const out = [];
  for (const p of parts) {
    if (p.kind === 'pdf') out.push({ type: 'input_file', filename: String(p.name || 'material.pdf').slice(0, 120), file_data: `data:application/pdf;base64,${await toBase64(p.data)}` });
    else if (p.kind === 'image') out.push({ type: 'input_image', image_url: `data:${p.mime || 'image/webp'};base64,${await toBase64(p.data)}`, detail: 'high' });
    else if (p.kind === 'text' && p.text) out.push({ type: 'input_text', text: p.text });
  }
  if (continueFrom) out.push({ type: 'input_text', text: continueText(continueFrom) });
  return out;
}

/** 다 받은(또는 그만둔) 답을 OpenAI 쪽 저장에서 지움. 실패해도 됨(표준 보관 기간 뒤 지워짐) */
export function discard(key, id, { cancel = false } = {}) {
  if (!id) return Promise.resolve();
  const base = baseFor('openai');
  const del = () => fetch(`${base}/v1/responses/${encodeURIComponent(id)}`, { method: 'DELETE', headers: auth(key), keepalive: true }).catch(() => { });
  if (!cancel) return del();
  return fetch(`${base}/v1/responses/${encodeURIComponent(id)}/cancel`, { method: 'POST', headers: auth(key), keepalive: true }).catch(() => { }).then(del);
}

// 답 안에서 온 오류(response.failed·error): 그 답은 끝난 것이라 이어 받지 않음(final)
const errOf = (e, status = 0) => Object.assign(new AiError(classify(status, e?.message || '', [e?.code, e?.type].filter((x) => typeof x === 'string').join(' ')), e?.message || 'error', { provider: 'openai', status }), { final: true });

/**
 * resumeToken: { id, seq } — 그 답을 seq 다음부터 이어 받음(prefix: 그때까지 받은 글).
 * onToken({ id, seq, text }): 이어 받기에 쓸 지점(작업 기록이 저장)
 * @returns {Promise<{ text, stop, usage, resumeToken }>}
 */
export async function stream({ key, model, system, parts, maxTokens = 64000, signal, onText, onEvent, onToken, continueFrom = '', resumeToken = null, prefix = '', json = false }) {
  const base = baseFor('openai');
  let id = resumeToken?.id || ''; let seq = resumeToken ? +resumeToken.seq || 0 : -1;
  let text = resumeToken ? String(prefix || '') : ''; let stop = ''; let usage = {}; let refusal = '';
  let body = '';
  if (!resumeToken) {
    body = JSON.stringify({
      model, instructions: system, input: [{ role: 'user', content: await openaiContent(parts, continueFrom) }],
      background: true, stream: true, store: true, max_output_tokens: Math.min(Math.max(maxTokens, 16000), 128000),
      ...(json ? { text: { format: { type: 'json_object' } } } : {}),
    });
  }
  const wd = watchdog(signal, body.length);
  try {
    const r = resumeToken
      ? await post('openai', `${base}/v1/responses/${encodeURIComponent(id)}?stream=true&starting_after=${seq}`, { method: 'GET', headers: auth(key) }, wd).catch((e) => { throw Object.assign(e, { resumeFailed: e.kind !== 'stall' && e.kind !== 'network' }); })
      : await post('openai', `${base}/v1/responses`, { method: 'POST', headers: { 'content-type': 'application/json', ...auth(key) }, body }, wd);
    await readSSE(r, wd, ({ event, data }) => {
      const ev = data && typeof data === 'object' ? data : {};
      const type = ev.type || event;
      if (Number.isFinite(ev.sequence_number)) { if (ev.sequence_number <= seq) return; seq = ev.sequence_number; } // 이미 받은 것(이어 받을 때 겹침)은 건너뜀
      if (ev.response?.id && !id) id = ev.response.id;
      if (type === 'response.output_text.delta') { const t = ev.delta || ''; if (t) { text += t; wd.text(); onText?.(t, text); } }
      else if (type === 'response.refusal.delta') refusal += ev.delta || '';
      else if (type === 'response.completed') { stop = 'end'; usage = ev.response?.usage || {}; }
      else if (type === 'response.incomplete') {
        const why = ev.response?.incomplete_details?.reason || '';
        if (why === 'content_filter') throw Object.assign(new AiError('refusal', 'content_filter', { provider: 'openai' }), { final: true });
        stop = 'max_tokens'; usage = ev.response?.usage || {};
      } else if (type === 'response.failed') throw errOf(ev.response?.error, ev.response?.error?.code === 'server_error' ? 500 : 0);
      else if (type === 'response.cancelled') throw Object.assign(new DOMException('cancelled', 'AbortError'));
      else if (type === 'error') throw errOf(ev.error || ev, ev.status || 0);
      if (id) onToken?.({ id, seq, text });
      onEvent?.({ type, seq });
    });
  } catch (e) {
    const err = wd.wrap(e, 'openai');
    if (err instanceof AiError && id && seq >= 0 && !err.final) Object.assign(err, { resumeToken: { id, seq }, partial: text });
    else if (err instanceof AiError) err.partial = text;
    if (id && err && typeof err === 'object') err.responseId = id; // 지울 답(실패·거절이면 job.js가 OpenAI 쪽 저장에서 지움, gen/oa-trash.js)
    throw err;
  } finally { wd.done(); }
  if (!stop) throw Object.assign(new AiError('network', 'stream ended early', { provider: 'openai' }), id ? { resumeToken: { id, seq }, partial: text } : { partial: text });
  if (!text.trim() && refusal) throw Object.assign(new AiError('refusal', refusal.slice(0, 200), { provider: 'openai' }), { responseId: id });
  discard(key, id); // 다 받았으면 OpenAI 쪽 저장에서 바로 지움(처리방침)
  return { text, stop, usage, resumeToken: { id, seq } };
}
