// ChatGPT 계정(Sign in with ChatGPT): PC 프로그램이 이 PC에서 OpenAI Responses API를 부르고 답(SSE)을 그대로 흘려줌(POST /bridge/chatgpt/responses).
// 요금제 경로의 한계(공식 문서 Preview limitations): store:false·stream:true만, background·max_output_tokens·previous_response_id 없음 →
// 서버에서 이어 받기(resumeToken)는 못 하고, 끊기거나 한도에 닿으면 job.js가 받은 글로 '이어서'(사용자 메시지) 요청을 다시 보냄.
// 토큰은 PC 프로그램 안에만 있음. 이 어댑터는 짝 맞춤 토큰(X-Lecpage-Bridge)만 씀.
import { classify } from '../../ai.js';
import { AiError, watchdog, readSSE } from './common.js';
import { openaiContent } from './openai.js';
import { bridgeRaw } from '../local.js';

/** PC 프로그램·OpenAI의 거절 → AiError. 요금제 오류 코드는 공식 문서의 회복 방법대로 */
export function chatgptError(status, j = {}) {
  const code = String(j.code || j.error || '');
  const msg = String(j.message_ko || j.message || j.detail || code || `http ${status}`).slice(0, 300);
  let kind;
  if (code === 'subscription_sharing_usage_limit_exceeded') kind = 'chatgpt-limit'; // 다시 보내지 않음(사용량 화면 안내)
  else if (code === 'subscription_sharing_user_not_eligible' || code === 'no-plan-scope') kind = 'chatgpt-plan';
  else if (code === 'not-connected' || code === 'subscription_sharing_invalid_user' || status === 401) kind = 'chatgpt-login';
  else if (/^subscription_sharing_(usage|user)_unavailable$/.test(code) || code === 'refresh' || status === 503) kind = 'busy';
  else if (code === 'subscription_sharing_unsupported_capability') kind = /model/i.test(String(j.param || msg)) ? 'model' : 'other';
  else if (code === 'network') kind = 'network';
  else kind = classify(status, msg, code);
  return Object.assign(new AiError(kind, msg, { provider: 'chatgpt', status }), { final: true });
}

/** @returns {Promise<{ text, stop, usage }>} */
export async function stream({ model, system, parts, signal, onText, onEvent, continueFrom = '', json = false }) {
  let text = ''; let stop = ''; let usage = {}; let refusal = '';
  const body = JSON.stringify({
    model, instructions: system, input: [{ role: 'user', content: await openaiContent(parts, continueFrom) }],
    ...(json ? { text: { format: { type: 'json_object' } } } : {}),
  });
  const wd = watchdog(signal, body.length);
  try {
    let r;
    try { r = await bridgeRaw('/bridge/chatgpt/responses', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'text/event-stream' }, body, signal: wd.signal }); }
    catch (e) { if (e?.off) throw Object.assign(new AiError('pc-off', e.message, { provider: 'chatgpt' }), { off: true }); throw e; }
    wd.stage('first');
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw chatgptError(r.status, j); }
    await readSSE(r, wd, ({ event, data }) => {
      const ev = data && typeof data === 'object' ? data : {};
      const type = ev.type || event;
      if (type === 'response.output_text.delta') { const t = ev.delta || ''; if (t) { text += t; wd.text(); onText?.(t, text); } }
      else if (type === 'response.refusal.delta') refusal += ev.delta || '';
      else if (type === 'response.completed') { stop = 'end'; usage = ev.response?.usage || {}; }
      else if (type === 'response.incomplete') {
        const why = ev.response?.incomplete_details?.reason || '';
        if (why === 'content_filter') throw Object.assign(new AiError('refusal', 'content_filter', { provider: 'chatgpt' }), { final: true });
        stop = 'max_tokens'; usage = ev.response?.usage || {}; // 서버가 정한 길이에 닿음 → job.js가 '이어서'
      } else if (type === 'response.failed') { const er = ev.response?.error || {}; throw chatgptError(er.code === 'server_error' ? 500 : 0, er); }
      else if (type === 'error') throw chatgptError(ev.status || 0, ev.error || ev);
      onEvent?.({ type });
    });
  } catch (e) {
    const err = wd.wrap(e, 'chatgpt');
    if (err instanceof AiError) err.partial = text; // 받은 데까지: job.js가 '이어서'로
    throw err;
  } finally { wd.done(); }
  if (!stop) throw Object.assign(new AiError('network', 'stream ended early', { provider: 'chatgpt' }), { partial: text });
  if (!text.trim() && refusal) throw new AiError('refusal', refusal.slice(0, 200), { provider: 'chatgpt' });
  return { text, stop, usage };
}
