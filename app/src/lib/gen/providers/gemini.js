// Google Gemini: streamGenerateContent?alt=sse. 교재는 inline_data로(PDF, Gemini 4는 PPTX·DOCX도 쪽 그림으로 읽음, 그림).
// store:false 원칙 그대로(배경 실행은 store:true가 필요해 쓰지 않음). 생각 요약도 받아(includeThoughts) 긴 생각 중에도 연결이 살아 있게.
// 근거: docs/research/ai-first-2026-11.md §1.4
import { classify } from '../../ai.js';
import { AiError, baseFor, watchdog, readSSE, post, toBase64, continueText } from './common.js';

export async function geminiParts(parts, continueFrom) {
  const out = [];
  for (const p of parts) {
    if (p.kind === 'pdf' || p.kind === 'doc' || p.kind === 'image') out.push({ inline_data: { mime_type: p.mime || (p.kind === 'pdf' ? 'application/pdf' : 'image/webp'), data: await toBase64(p.data) } });
    else if (p.kind === 'text' && p.text) out.push({ text: p.text });
  }
  if (continueFrom) out.push({ text: continueText(continueFrom) });
  return out;
}

const SAFETY = /SAFETY|PROHIBITED|BLOCKLIST|SPII|RECITATION|IMAGE_SAFETY/;

/** @returns {Promise<{ text, stop, usage }>} */
export async function stream({ key, model, system, parts, maxTokens = 65536, signal, onText, onEvent, continueFrom = '', json = false }) {
  const base = baseFor('gemini');
  // maxOutputTokens는 생각 토큰까지 합친 한도(Gemini 4 한 응답 65,536). temperature·topP는 Gemini 3.6 이후 무시·경고라 보내지 않음(ai.js geminiBody와 같음)
  const body = JSON.stringify({
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents: [{ role: 'user', parts: await geminiParts(parts, continueFrom) }],
    generationConfig: { maxOutputTokens: Math.min(Math.max(maxTokens, 32768), 65536), thinkingConfig: { includeThoughts: true }, ...(json ? { responseMimeType: 'application/json' } : {}) },
    store: false,
  });
  const wd = watchdog(signal, body.length);
  let text = ''; let stop = ''; let usage = {};
  try {
    const r = await post('gemini', `${base}/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body }, wd);
    await readSSE(r, wd, ({ data }) => {
      const ev = data && typeof data === 'object' ? data : {};
      if (ev.error) { const e = ev.error; throw new AiError(classify(+e.code || 0, e.message, e.status), e.message || 'stream error', { provider: 'gemini', status: +e.code || 0 }); }
      if (ev.promptFeedback?.blockReason && !ev.candidates?.length) throw new AiError('refusal', `blocked(${ev.promptFeedback.blockReason})`, { provider: 'gemini' });
      const c = ev.candidates?.[0];
      if (ev.usageMetadata) usage = ev.usageMetadata;
      for (const p of c?.content?.parts || []) {
        if (p.thought || !p.text) continue; // 생각 요약은 글에 넣지 않음(살아 있다는 표시로만)
        text += p.text; wd.text(); onText?.(p.text, text);
      }
      if (c?.finishReason) {
        if (c.finishReason === 'MAX_TOKENS') stop = 'max_tokens';
        else if (SAFETY.test(c.finishReason)) throw new AiError('refusal', c.finishReason, { provider: 'gemini' });
        else stop = 'end';
      }
      onEvent?.({ type: c?.finishReason ? 'finish' : 'chunk' });
    });
  } catch (e) { throw Object.assign(wd.wrap(e, 'gemini'), { partial: text }); } finally { wd.done(); }
  if (!stop) throw Object.assign(new AiError('network', 'stream ended early', { provider: 'gemini' }), { partial: text });
  return { text, stop, usage };
}
