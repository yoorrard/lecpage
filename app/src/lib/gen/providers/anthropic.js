// Anthropic Claude: /v1/messages 스트리밍(SSE). 브라우저에서 되는 것은 이 주소뿐이라(Files·Batches는 CORS 막힘) PDF는 base64 document 블록으로.
// 끊기거나 잘리면 받은 데까지를 사용자 메시지에 넣어 "이어서"로 다시 요청(Claude 4.6 이후는 assistant 미리 채우기가 400).
// 근거: docs/research/ai-first-2026-11.md §1.2
import { antHeaders, withWorkspace } from '../../ai.js';
import { AiError, baseFor, watchdog, readSSE, post, toBase64, continueText } from './common.js';

/** 공통 parts → Claude content 블록. cache: 앞부분(교재)이 단계마다 같아 캐시로 싸게 다시 읽음 */
export async function claudeContent(parts, continueFrom) {
  const out = [];
  for (const p of parts) {
    if (p.kind === 'pdf') out.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: await toBase64(p.data) }, ...(p.name ? { title: String(p.name).slice(0, 200) } : {}) });
    else if (p.kind === 'image') out.push({ type: 'image', source: { type: 'base64', media_type: p.mime || 'image/webp', data: await toBase64(p.data) } });
    else if (p.kind === 'text' && p.text) out.push({ type: 'text', text: p.text });
    if (p.cache && out.length) out[out.length - 1].cache_control = { type: 'ephemeral' };
  }
  if (continueFrom) out.push({ type: 'text', text: continueText(continueFrom) });
  return out;
}

/**
 * @returns {Promise<{ text, stop: 'end'|'max_tokens', usage }>}
 */
export async function stream({ key, model, system, parts, maxTokens = 32000, signal, onText, onEvent, continueFrom = '' }) {
  const base = baseFor('anthropic');
  const content = await claudeContent(parts, continueFrom);
  const bodyOf = (plus) => JSON.stringify({ model, max_tokens: Math.min(Math.max(maxTokens, 4096), 128000), system, messages: [{ role: 'user', content }], stream: true, ...(plus ? { fallbacks: 'default' } : {}) });
  // Claude 5 계열은 안전 분류기가 거절하면 서버가 다른 모델로 이어받게(ai.js와 같은 규칙). 이 값을 못 받으면 기본 요청으로 한 번 더
  const extra = /claude-(opus|sonnet|fable)-5/.test(model);
  const call = async (plus) => {
    const body = bodyOf(plus);
    const wd = watchdog(signal, body.length);
    let text = ''; let stop = ''; const usage = {};
    try {
      const headers = { 'content-type': 'application/json', ...antHeaders(key), ...(plus ? { 'anthropic-beta': 'server-side-fallback-2026-07-01' } : {}) };
      const r = await post('anthropic', `${base}/v1/messages`, { method: 'POST', headers, body }, wd);
      await readSSE(r, wd, ({ event, data }) => {
        const ev = data && typeof data === 'object' ? data : {};
        const type = ev.type || event;
        if (type === 'content_block_delta' && ev.delta?.type === 'text_delta') { const t = ev.delta.text || ''; if (t) { text += t; wd.text(); onText?.(t, text); } }
        else if (type === 'message_start') Object.assign(usage, ev.message?.usage || {});
        else if (type === 'message_delta') { stop = ev.delta?.stop_reason || stop; Object.assign(usage, ev.usage || {}); }
        else if (type === 'error') {
          const er = ev.error || {};
          throw new AiError(er.type === 'overloaded_error' ? 'busy' : er.type === 'rate_limit_error' ? 'quota' : 'other', er.message || 'stream error', { provider: 'anthropic', status: er.type === 'overloaded_error' ? 529 : 0 });
        }
        onEvent?.({ type });
      });
    } catch (e) { throw Object.assign(wd.wrap(e, 'anthropic'), { partial: text }); } finally { wd.done(); }
    if (stop === 'refusal') throw new AiError('refusal', 'refusal', { provider: 'anthropic' });
    if (!stop) throw Object.assign(new AiError('network', 'stream ended early', { provider: 'anthropic' }), { partial: text }); // message_stop 전에 끊김
    return { text, stop: stop === 'max_tokens' ? 'max_tokens' : 'end', usage };
  };
  return withWorkspace(key, signal, async () => {
    if (!extra) return call(false);
    try { return await call(true); }
    catch (e) { if (e instanceof AiError && e.kind === 'other' && e.status === 400) return call(false); throw e; }
  });
}
