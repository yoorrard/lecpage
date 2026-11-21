// 세 회사 가짜 AI 서버(로컬 HTTP, SSE 흉내). 실제 키 호출 없이 끊김·멈춤·한도·잘림·깨진 답·이어 받기를 시험
//   Anthropic  POST /v1/messages (stream)
//   OpenAI     POST /v1/responses (background+stream+store), GET /v1/responses/:id?stream=true&starting_after=N, DELETE, POST …/cancel
//   Gemini     POST /v1beta/models/:model:streamGenerateContent?alt=sse
// 제어: POST /__faults [{ provider, step, nth, action, at, ms, retryAfter }], POST /__reset, GET /__log, POST /__slow { step, ms }
import http from 'node:http';
import * as S from './mock-site.mjs';

let log = []; let faults = []; let slow = {}; const counts = new Map(); const responses = new Map(); let rid = 0;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS', 'access-control-expose-headers': '*' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function lastText(provider, body) {
  const texts = [];
  if (provider === 'anthropic') for (const b of body.messages?.[0]?.content || []) { if (b.type === 'text') texts.push(b.text); }
  if (provider === 'openai') for (const b of body.input?.[0]?.content || []) { if (b.type === 'input_text') texts.push(b.text); }
  if (provider === 'gemini') for (const b of body.contents?.[0]?.parts || []) { if (b.text) texts.push(b.text); }
  return texts;
}
function materialInfo(provider, body) {
  let pdf = 0, img = 0, doc = 0, cache = 0;
  if (provider === 'anthropic') for (const b of body.messages?.[0]?.content || []) { if (b.type === 'document') pdf++; if (b.type === 'image') img++; if (b.cache_control) cache++; }
  if (provider === 'openai') for (const b of body.input?.[0]?.content || []) { if (b.type === 'input_file') pdf++; if (b.type === 'input_image') img++; }
  if (provider === 'gemini') for (const b of body.contents?.[0]?.parts || []) { if (b.inline_data?.mime_type === 'application/pdf') pdf++; else if (b.inline_data?.mime_type?.startsWith('image/')) img++; else if (b.inline_data) doc++; }
  return { pdf, img, doc, cache };
}
/** 단계와 답 정하기 */
function answerFor(texts, opts) {
  const all = texts.join('\n');
  const m = /작업 단계: (build|plan|design|sections|fix|edit)/.exec(all);
  const step = m ? m[1] : 'other';
  let full = '';
  if (step === 'build') full = S.buildAnswer(opts);
  else if (step === 'plan') full = S.planAnswer();
  else if (step === 'design') full = S.designAnswer();
  else if (step === 'sections') {
    const n = (/작업 단계: sections (\d+)\//.exec(all) || [])[1];
    const j = /이번에 만들 섹션\(이 순서대로\):\n(\[[\s\S]*?\n\])/.exec(all);
    let ids = []; try { ids = JSON.parse(j[1]).map((s) => s.id); } catch { ids = []; }
    full = S.sectionsAnswer(ids, opts);
    return { step: `sections:${n}`, full, ids };
  } else if (step === 'fix') { const ids = [...all.matchAll(/<section id="([\w-]+)"/g)].map((x) => x[1]); full = S.fixAnswer([...new Set(ids)]); }
  else if (step === 'edit') full = /lecpage 검수에서/.test(all) ? S.fixAnswer([...new Set([...all.matchAll(/<section id="([\w-]+)"/g)].map((x) => x[1]))]) : S.editAnswer();
  else full = '알 수 없는 요청이에요.';
  return { step, full };
}
/** 이어서 요청이면 받은 부분 뒤부터 */
function continuation(texts, full) {
  const t = texts.find((x) => x.includes('<previous_response>'));
  if (!t) return { cont: false, rest: full };
  const prev = /<previous_response>\n([\s\S]*)\n<\/previous_response>/.exec(t)?.[1] || '';
  const tail = prev.slice(-120);
  const at = full.indexOf(tail);
  return { cont: true, rest: at >= 0 ? full.slice(at + tail.length) : '' };
}
function pickFault(provider, step) {
  const k = `${provider}|${step}`; const n = (counts.get(k) || 0) + 1; counts.set(k, n);
  const f = faults.find((x) => (x.provider === provider || x.provider === '*') && (x.step === step || (x.step === 'sections' && step.startsWith('sections'))) && (x.nth || 1) === n);
  return { n, f };
}
const chunks = (s, size = 180) => { const out = []; for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size)); return out; };
function errorBody(provider, status, msg) {
  if (provider === 'anthropic') return { type: 'error', error: { type: status === 429 ? 'rate_limit_error' : status === 529 ? 'overloaded_error' : 'api_error', message: msg } };
  if (provider === 'openai') return { error: { message: msg, type: status === 429 ? 'requests' : 'server_error', code: status === 429 ? 'rate_limit_exceeded' : null } };
  return { error: { code: status, message: msg, status: status === 429 ? 'RESOURCE_EXHAUSTED' : 'UNAVAILABLE' } };
}

async function readBody(req) { const bufs = []; for await (const c of req) bufs.push(c); return Buffer.concat(bufs).toString('utf8'); }

async function streamSSE(res, events, { fault, stepSlow = 0 }) {
  res.writeHead(200, { ...CORS, 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  const cut = fault && ['drop', 'stall'].includes(fault.action) ? Math.floor(events.length * (fault.at ?? 0.5)) : -1;
  for (let i = 0; i < events.length; i++) {
    if (i === cut) {
      if (fault.action === 'drop') { res.socket.destroy(); return 'dropped'; }
      if (fault.action === 'stall') { await sleep(fault.ms || 10000); res.socket.destroy(); return 'stalled'; }
    }
    if (res.destroyed || res.socket?.destroyed) return 'closed';
    res.write(events[i]);
    await sleep(stepSlow || 3);
  }
  res.end(); return 'ok';
}

async function anthropic(req, res, body) {
  const texts = lastText('anthropic', body);
  const a = answerFor(texts, {});
  const { n, f } = pickFault('anthropic', a.step);
  const full = f?.action === 'broken' ? answerFor(texts, { broken: true }).full : f?.action === 'badref' ? answerFor(texts, { badRef: true }).full : a.full;
  const c = continuation(texts, full);
  const entry = { provider: 'anthropic', step: a.step, n, cont: c.cont, fault: f?.action || '', ...materialInfo('anthropic', body), browserHeader: req.headers['anthropic-dangerous-direct-browser-access'] === 'true', key: !!req.headers['x-api-key'], maxTokens: body.max_tokens };
  log.push(entry);
  if (f?.action === '400pdf') { res.writeHead(400, { ...CORS, 'content-type': 'application/json' }); res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'A maximum of 100 PDF pages may be provided.' } })); return; }
  if (f && ['429', '500', '529'].includes(f.action)) { res.writeHead(+f.action, { ...CORS, 'content-type': 'application/json', ...(f.retryAfter ? { 'retry-after': String(f.retryAfter) } : {}) }); res.end(JSON.stringify(errorBody('anthropic', +f.action, f.action === '429' ? 'Number of request tokens has exceeded your per-minute rate limit' : 'Overloaded'))); return; }
  let text = c.rest; let stop = 'end_turn';
  if (f?.action === 'truncate') { text = text.slice(0, Math.floor(text.length * (f.at ?? 0.5))); stop = 'max_tokens'; }
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  const events = [ev('message_start', { message: { id: 'msg_1', usage: { input_tokens: 1000, cache_read_input_tokens: n > 1 ? 900 : 0 } } }), ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }), ev('ping', {})];
  chunks(text).forEach((t, i) => { events.push(ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: t } })); if (i % 20 === 19) events.push(ev('ping', {})); });
  events.push(ev('content_block_stop', { index: 0 }), ev('message_delta', { delta: { stop_reason: stop }, usage: { output_tokens: Math.ceil(text.length / 3) } }), ev('message_stop', {}));
  entry.result = await streamSSE(res, events, { fault: f, stepSlow: slow[a.step] || slow['*'] });
}

function openaiEvents(id, text, stop) {
  const evs = []; let seq = 0;
  const push = (type, data) => evs.push({ type, sequence_number: seq++, ...data });
  push('response.created', { response: { id, status: 'queued', background: true } });
  push('response.in_progress', { response: { id, status: 'in_progress' } });
  push('response.output_item.added', { output_index: 0, item: { type: 'message', role: 'assistant', content: [] } });
  for (const t of chunks(text)) push('response.output_text.delta', { item_id: 'msg_1', output_index: 0, content_index: 0, delta: t });
  push('response.output_text.done', { text });
  if (stop === 'max_tokens') push('response.incomplete', { response: { id, status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, usage: { output_tokens: 1 } } });
  else push('response.completed', { response: { id, status: 'completed', usage: { input_tokens: 1000, output_tokens: Math.ceil(text.length / 3) } } });
  return evs;
}
async function openaiCreate(req, res, body) {
  const texts = lastText('openai', body);
  const a = answerFor(texts, {});
  const { n, f } = pickFault('openai', a.step);
  const full = f?.action === 'broken' ? answerFor(texts, { broken: true }).full : f?.action === 'badref' ? answerFor(texts, { badRef: true }).full : a.full;
  const c = continuation(texts, full);
  const entry = { provider: 'openai', method: 'POST', step: a.step, n, cont: c.cont, fault: f?.action || '', ...materialInfo('openai', body), background: body.background === true, stream: body.stream === true, store: body.store === true, auth: /^Bearer /.test(req.headers.authorization || ''), maxTokens: body.max_output_tokens };
  log.push(entry);
  if (f && ['429', '500'].includes(f.action)) { res.writeHead(+f.action, { ...CORS, 'content-type': 'application/json', ...(f.retryAfter ? { 'retry-after': String(f.retryAfter) } : {}) }); res.end(JSON.stringify(errorBody('openai', +f.action, f.action === '429' ? 'Rate limit reached for requests' : 'server error'))); return; }
  let text = c.rest; let stop = 'end';
  if (f?.action === 'truncate') { text = text.slice(0, Math.floor(text.length * (f.at ?? 0.5))); stop = 'max_tokens'; }
  const id = `resp_${++rid}`;
  const evs = openaiEvents(id, text, stop);
  responses.set(id, { evs, deleted: false, cancelled: false, step: a.step });
  entry.id = id;
  entry.result = await streamSSE(res, evs.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`), { fault: f, stepSlow: slow[a.step] || slow['*'] });
}
async function openaiGet(req, res, id, url) {
  const r = responses.get(id);
  const after = +(url.searchParams.get('starting_after') ?? -1);
  const entry = { provider: 'openai', method: 'GET', id, after, step: r?.step || '' };
  log.push(entry);
  if (!r || r.deleted) { res.writeHead(404, { ...CORS, 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { message: 'No response found', type: 'invalid_request_error', code: 'not_found' } })); return; }
  const { f } = pickFault('openai', 'resume:' + r.step);
  const evs = r.evs.filter((e) => e.sequence_number > after);
  entry.result = await streamSSE(res, evs.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`), { fault: f, stepSlow: slow[r.step] || slow['*'] });
}

async function gemini(req, res, body, model) {
  const texts = lastText('gemini', body);
  const a = answerFor(texts, {});
  const { n, f } = pickFault('gemini', a.step);
  const full = f?.action === 'broken' ? answerFor(texts, { broken: true }).full : f?.action === 'badref' ? answerFor(texts, { badRef: true }).full : a.full;
  const c = continuation(texts, full);
  const entry = { provider: 'gemini', step: a.step, n, cont: c.cont, fault: f?.action || '', model, ...materialInfo('gemini', body), store: body.store, key: !!req.headers['x-goog-api-key'], thoughts: !!body.generationConfig?.thinkingConfig?.includeThoughts, maxTokens: body.generationConfig?.maxOutputTokens };
  log.push(entry);
  if (f && ['429', '500', '503'].includes(f.action)) { res.writeHead(+f.action, { ...CORS, 'content-type': 'application/json' }); res.end(JSON.stringify(errorBody('gemini', +f.action, f.action === '429' ? 'Resource has been exhausted. Please retry in 1.2s.' : 'The model is overloaded.'))); return; }
  let text = c.rest; let fin = 'STOP';
  if (f?.action === 'truncate') { text = text.slice(0, Math.floor(text.length * (f.at ?? 0.5))); fin = 'MAX_TOKENS'; }
  const ev = (o) => `data: ${JSON.stringify(o)}\r\n\r\n`;
  const events = [ev({ candidates: [{ content: { role: 'model', parts: [{ text: '교재를 읽고 있어요…', thought: true }] } }] })];
  const cs = chunks(text);
  cs.forEach((t, i) => events.push(ev({ candidates: [{ content: { role: 'model', parts: [{ text: t }] }, ...(i === cs.length - 1 ? { finishReason: fin } : {}) }], ...(i === cs.length - 1 ? { usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 10 } } : {}) })));
  if (!cs.length) events.push(ev({ candidates: [{ content: { role: 'model', parts: [{ text: '' }] }, finishReason: fin }] }));
  entry.result = await streamSSE(res, events, { fault: f, stepSlow: slow[a.step] || slow['*'] });
}

// ── 연결 프로그램(§10) 흉내: /bridge/* (머리글 X-Lecpage-Bridge: t0k) ──
const bjobs = new Map(); let bid = 0;
async function bridge(req, res, url) {
  const send = (st, o) => { res.writeHead(st, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.headers['x-lecpage-bridge'] !== 't0k') { log.push({ provider: 'bridge', path: url.pathname, denied: true }); return send(403, { error: 'bad token' }); }
  const f = faults.find((x) => x.provider === 'bridge');
  if (url.pathname === '/bridge/status') return send(200, { ok: true, version: '0.1.0', agents: [{ id: 'claude', installed: true, version: '2.1.300', auth: 'subscription' }, { id: 'codex', installed: false }] });
  if (url.pathname === '/bridge/jobs' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req)); const id = 'j' + (++bid);
    bjobs.set(id, { body, done: false, t0: Date.now() });
    log.push({ provider: 'bridge', method: 'POST', id, agent: body.agent, kind: body.kind, files: (body.files || []).map((x) => x.name), hasSite: !!body.site, request: body.request });
    return send(200, { jobId: id });
  }
  const m = /^\/bridge\/jobs\/(\w+)(?:\/(events|result))?$/.exec(url.pathname);
  if (!m || !bjobs.has(m[1])) { log.push({ provider: 'bridge', path: url.pathname, gone: true }); return send(404, { error: 'no job' }); }
  const j = bjobs.get(m[1]);
  if (req.method === 'DELETE') { log.push({ provider: 'bridge', method: 'DELETE', id: m[1] }); bjobs.delete(m[1]); return send(200, {}); }
  if (m[2] === 'result') {
    const site = { 'index.html': S.SHELL.replace('<!-- lp:sections -->', Object.values(S.SECTIONS).join('\n\n')), 'assets/style.css': S.CSS, 'assets/img/badge.png': 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' };
    if (j.body.kind === 'edit') site['index.html'] = site['index.html'].replace('제미나이와 클로드로 30분 만에', '내 PC의 AI가 고친 첫 화면:');
    log.push({ provider: 'bridge', method: 'RESULT', id: m[1] });
    return send(200, { site, meta: { v: 2, title: S.PLAN.title, sessions: S.PLAN.sessions, venue: S.PLAN.venue, features: S.PLAN.features, facts: S.PLAN.facts, siteUrl: 'https://evil.example' }, issues: [] });
  }
  // 진행(SSE): 단계 4개 → done. 처음 연결은 drop 고장이면 중간에 끊음
  j.conns = (j.conns || 0) + 1;
  log.push({ provider: 'bridge', method: 'EVENTS', id: m[1], conn: j.conns });
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  const steps = ['교재를 읽는 중', '사이트를 쓰는 중', 'lecpage check로 검수하는 중', '고친 곳을 다시 검수하는 중'];
  const from = j.sent || 0;
  for (let i = from; i < steps.length; i++) {
    if (f?.action === 'drop' && j.conns === 1 && i === 2) { res.socket.destroy(); return; }
    res.write(`data: ${JSON.stringify({ type: 'step', label_ko: steps[i] })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'log', text: 'Write site/index.html' })}\n\n`);
    j.sent = i + 1;
    await sleep(slow.bridge || 250);
    if (res.destroyed || res.socket?.destroyed) return;
  }
  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`); res.end();
}

export function startMock(port = 6201) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
      if (url.pathname === '/__faults') { faults = JSON.parse(await readBody(req) || '[]'); res.writeHead(200, CORS); res.end('{}'); return; }
      if (url.pathname === '/__slow') { slow = JSON.parse(await readBody(req) || '{}'); res.writeHead(200, CORS); res.end('{}'); return; }
      if (url.pathname === '/__reset') { log = []; faults = []; slow = {}; counts.clear(); responses.clear(); bjobs.clear(); res.writeHead(200, CORS); res.end('{}'); return; }
      if (url.pathname.startsWith('/bridge/')) return await bridge(req, res, url);
      if (url.pathname === '/__log') { res.writeHead(200, { ...CORS, 'content-type': 'application/json' }); res.end(JSON.stringify(log)); return; }
      if (url.pathname === '/v1/messages' && req.method === 'POST') return await anthropic(req, res, JSON.parse(await readBody(req)));
      if (url.pathname === '/v1/responses' && req.method === 'POST') return await openaiCreate(req, res, JSON.parse(await readBody(req)));
      let m = /^\/v1\/responses\/([\w-]+)(\/cancel)?$/.exec(url.pathname);
      if (m) {
        const r = responses.get(m[1]);
        if (m[2] && req.method === 'POST') { log.push({ provider: 'openai', method: 'CANCEL', id: m[1] }); if (r) r.cancelled = true; res.writeHead(200, { ...CORS, 'content-type': 'application/json' }); res.end('{}'); return; }
        if (req.method === 'DELETE') { log.push({ provider: 'openai', method: 'DELETE', id: m[1] }); if (r) r.deleted = true; res.writeHead(200, { ...CORS, 'content-type': 'application/json' }); res.end(JSON.stringify({ id: m[1], deleted: true })); return; }
        if (req.method === 'GET') return await openaiGet(req, res, m[1], url);
      }
      m = /^\/v1beta\/models\/([^:]+):streamGenerateContent$/.exec(url.pathname);
      if (m && req.method === 'POST') return await gemini(req, res, JSON.parse(await readBody(req)), decodeURIComponent(m[1]));
      res.writeHead(404, CORS); res.end('{}');
    } catch (e) { try { res.writeHead(500, CORS); res.end(JSON.stringify({ error: { message: String(e) } })); } catch { /* 이미 보냄 */ } }
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r(server)));
}

if (process.argv[1] && process.argv[1].endsWith('mock-ai.mjs')) startMock(+(process.argv[2] || 6201)).then(() => console.log('mock ready'));
