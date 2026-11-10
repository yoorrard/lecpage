// 수정 요청용 AI 호출: 글 + 그림(PNG·JPEG)을 함께 보냅니다. 키는 lib/ai.js가 보관한 것을 그대로 쓰고, 브라우저에서 AI 회사로 바로 갑니다.
import { getActiveAI, models, AiError, PROVIDERS } from './ai.js';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const kindOf = (status, msg) => (status === 401 ? 'bad-key' : status === 402 ? 'billing' : status === 403 ? 'forbidden' : status === 404 ? 'model'
  : status === 413 || /too long|context length|too large/i.test(msg) ? 'too-long' : status === 429 ? (/day|daily/i.test(msg) ? 'quota-day' : 'quota') : status >= 500 ? 'busy' : 'other');

async function send(provider, url, init) {
  let r;
  try { r = await fetch(url, init); }
  catch (e) { if (e.name === 'AbortError' || e.name === 'TimeoutError') throw e; throw new AiError('network', e.message || 'Failed to fetch', { provider }); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = j.error || j; const msg = (typeof e === 'string' ? e : e?.message) || `${PROVIDERS[provider]?.short || provider} 오류 ${r.status}`;
    throw new AiError(kindOf(r.status, msg), msg, { status: r.status, provider });
  }
  return j;
}

/** data:image/...;base64,XXXX → { mime, data } */
function split(dataUrl) {
  const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  return m ? { mime: m[1], data: m[2] } : null;
}

/** 연결된 AI(없으면 null). 그림을 못 받는 연결이면 images:false */
export async function visionTarget() {
  const ai = await getActiveAI().catch(() => null);
  if (!ai) return null;
  return { ...ai, images: ai.supportsImages !== false };
}

/**
 * 글과 그림을 보내고 답 글을 받음.
 * @param {{provider,key,model,images}} ai visionTarget() 결과
 * @param {{prompt:string, images?:string[], signal?:AbortSignal, maxTokens?:number}} o images: data URL 목록
 * @returns {Promise<{text:string, cut:boolean, sentImages:number}>}
 */
export async function askVision(ai, { prompt, images = [], signal, maxTokens = 8000 }) {
  const { provider, key } = ai;
  let model = ai.model;
  if (!model) model = (await models(provider, key))[0]?.id || (provider === 'gemini' ? 'gemini-flash-latest' : '');
  if (!model) throw new AiError('model', 'no model', { provider });
  const pics = ai.images ? images.map(split).filter(Boolean).slice(0, 4) : [];
  let text = '', cut = false;
  if (provider === 'gemini') {
    const parts = [...pics.map((p) => ({ inline_data: { mime_type: p.mime, data: p.data } })), { text: prompt }];
    const j = await send(provider, `${GEMINI}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: maxTokens, temperature: 0.3 } }),
    });
    const c = j.candidates?.[0];
    if (!c && j.promptFeedback?.blockReason) throw new AiError('other', `차단됨(${j.promptFeedback.blockReason})`, { provider });
    text = (c?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
    cut = c?.finishReason === 'MAX_TOKENS';
  } else if (provider === 'anthropic') {
    const content = [...pics.map((p) => ({ type: 'image', source: { type: 'base64', media_type: p.mime, data: p.data } })), { type: 'text', text: prompt }];
    const j = await send(provider, 'https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content }] }),
    });
    text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('');
    cut = j.stop_reason === 'max_tokens';
  } else {
    const openai = provider === 'openai';
    const content = [{ type: 'text', text: prompt }, ...pics.map((p) => ({ type: 'image_url', image_url: { url: `data:${p.mime};base64,${p.data}` } }))];
    const j = await send(provider, openai ? 'https://api.openai.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, ...(openai ? {} : { 'X-Title': 'lecpage' }) },
      body: JSON.stringify(openai
        ? { model, messages: [{ role: 'user', content }], response_format: { type: 'json_object' }, max_completion_tokens: maxTokens }
        : { model, messages: [{ role: 'user', content }], max_tokens: maxTokens }),
    });
    const ch = j.choices?.[0];
    if (!ch && j.error) throw new AiError(kindOf(+j.error.code || 0, j.error.message || ''), j.error.message || 'error', { provider });
    text = ch?.message?.content || '';
    cut = ch?.finish_reason === 'length';
  }
  if (!text.trim()) throw new AiError(cut ? 'truncated' : 'empty', 'empty', { provider });
  return { text, cut, sentImages: pics.length };
}
