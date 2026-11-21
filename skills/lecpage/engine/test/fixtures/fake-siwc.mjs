// 가짜 OpenAI(Sign in with ChatGPT + Responses) — 시험용. 실제 계정 없이 PC 프로그램의 "ChatGPT 계정으로 연결"을 끝까지 돌려 봄.
//   GET  /.well-known/jwks.json · GET /api/accounts/authorize(동의한 셈 치고 바로 콜백으로 302) · POST /api/accounts/oauth/token(코드·갱신)
//   POST /api/accounts/oauth/revoke · GET /v1/models · POST /v1/responses(SSE. store:false·stream:true가 아니거나 금지 칸이 있으면 400)
// 답: answer 글을 흘려보냄. cut(0~1)이면 첫 요청은 그만큼에서 response.incomplete(max_output_tokens) → '이어서' 요청에 나머지
// 단독 실행: node fake-siwc.mjs --port 8002 [--answer 파일] [--cut 0.6] [--limit]  (주소를 한 줄 JSON으로 찍음)
import { createServer } from 'node:http';
import { generateKeyPairSync, createHash, sign, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const b64u = (b) => Buffer.from(b).toString('base64url');
const DROP = ['background', 'max_output_tokens', 'temperature', 'previous_response_id', 'metadata', 'user', 'top_p', 'truncation'];

export function startFakeSiwc({ port = 0, answer = '```index.html\n<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>시험</title></head><body><main><section id="intro"><h1>시험 연수</h1></section></main></body></html>\n```', cut = 0, limit = false, scopeNoPlan = false } = {}) {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
  const st = { codes: new Map(), access: new Set(), refresh: new Set(), calls: [], authorize: [], revoked: 0, refreshed: 0, base: '' };
  const idToken = (aud, nonce) => {
    const h = b64u(JSON.stringify({ alg: 'RS256', kid: 'k1', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const p = b64u(JSON.stringify({ iss: st.base, aud, sub: 'user-test-1', email: 'teacher@example.com', nonce, iat: now, exp: now + 3600 }));
    return `${h}.${p}.${b64u(sign('RSA-SHA256', Buffer.from(`${h}.${p}`), privateKey))}`;
  };
  const tokens = (clientId, nonce) => {
    const a = 'at_' + randomBytes(12).toString('hex'), r = 'rt_' + randomBytes(12).toString('hex');
    st.access.add(a); st.refresh.add(r);
    return { access_token: a, refresh_token: r, id_token: idToken(clientId, nonce), token_type: 'Bearer', expires_in: 3600, scope: scopeNoPlan ? 'openid profile email offline_access' : 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct' };
  };
  const body = (req) => new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c).toString('utf8'))); });
  const json = (res, s, o) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  const server = createServer(async (req, res) => {
    const u = new URL(req.url, st.base);
    if (u.pathname === '/.well-known/jwks.json') return json(res, 200, { keys: [jwk] });
    if (u.pathname === '/api/accounts/authorize') {
      const q = Object.fromEntries(u.searchParams); st.authorize.push(q);
      const issued = q.client_id === 'dynamic_agent_client' ? 'oaiapp_test123' : q.client_id;
      const code = 'code_' + randomBytes(8).toString('hex');
      st.codes.set(code, { challenge: q.code_challenge, redirect: q.redirect_uri, clientId: issued, nonce: q.nonce });
      const to = new URL(q.redirect_uri); to.searchParams.set('code', code); to.searchParams.set('state', q.state); if (q.client_id === 'dynamic_agent_client') to.searchParams.set('client_id', issued);
      res.writeHead(302, { location: to.href }); return res.end();
    }
    if (u.pathname === '/api/accounts/oauth/token' && req.method === 'POST') {
      const f = Object.fromEntries(new URLSearchParams(await body(req)));
      if (f.grant_type === 'authorization_code') {
        const c = st.codes.get(f.code); st.codes.delete(f.code);
        if (!c || c.clientId !== f.client_id || c.redirect !== f.redirect_uri || f.resource !== 'https://api.openai.com/v1' || b64u(createHash('sha256').update(f.code_verifier || '').digest()) !== c.challenge) return json(res, 400, { error: 'invalid_grant' });
        return json(res, 200, tokens(c.clientId, c.nonce));
      }
      if (f.grant_type === 'refresh_token') {
        if (!st.refresh.has(f.refresh_token)) return json(res, 400, { error: 'invalid_grant' });
        st.refresh.delete(f.refresh_token); st.refreshed++;
        const t = tokens(f.client_id, ''); delete t.id_token; return json(res, 200, t);
      }
      return json(res, 400, { error: 'unsupported_grant_type' });
    }
    if (u.pathname === '/api/accounts/oauth/revoke' && req.method === 'POST') { const f = Object.fromEntries(new URLSearchParams(await body(req))); st.refresh.delete(f.token); st.revoked++; res.writeHead(200); return res.end(); }
    const bearer = String(req.headers.authorization || '').replace(/^Bearer /, '');
    if (u.pathname === '/v1/models') { if (!st.access.has(bearer)) return json(res, 401, { detail: 'bad token' }); return json(res, 200, { models: [{ slug: 'gpt-test', display_name: 'GPT 시험', visibility: 'list' }, { slug: 'gpt-hidden', visibility: 'hide' }] }); }
    if (u.pathname === '/v1/responses' && req.method === 'POST') {
      if (!st.access.has(bearer)) return json(res, 401, { detail: 'The required signed identity was not accepted' });
      let b; try { b = JSON.parse(await body(req)); } catch { return json(res, 400, { error: { message: 'bad json' } }); }
      st.calls.push(b);
      if (b.store !== false || b.stream !== true || DROP.some((k) => k in b)) return json(res, 400, { error: { code: 'subscription_sharing_unsupported_capability', param: DROP.find((k) => k in b) || 'store', message: 'unsupported' } });
      if (limit) return json(res, 429, { error: { code: 'subscription_sharing_usage_limit_exceeded', message: 'usage limit' } });
      const text = JSON.stringify(b.input || '');
      const cont = /previous response was interrupted/.test(text);
      const at = Math.floor(answer.length * cut);
      const out = cut && !cont ? answer.slice(0, at) : cut && cont ? answer.slice(Math.max(0, at - 40)) : answer; // 이어서: 앞 40자 겹침(앱이 이어 붙임)
      const incomplete = cut && !cont;
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' });
      let seq = 0; const ev = (o) => res.write(`event: ${o.type}\ndata: ${JSON.stringify({ ...o, sequence_number: seq++ })}\n\n`);
      ev({ type: 'response.created', response: { id: 'resp_x', status: 'in_progress' } });
      for (let i = 0; i < out.length; i += 4000) { ev({ type: 'response.output_text.delta', delta: out.slice(i, i + 4000) }); await new Promise((r) => setTimeout(r, 5)); }
      ev(incomplete ? { type: 'response.incomplete', response: { id: 'resp_x', status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } } } : { type: 'response.completed', response: { id: 'resp_x', status: 'completed', usage: { input_tokens: 10, output_tokens: out.length } } });
      return res.end();
    }
    json(res, 404, { error: 'not found' });
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => { st.base = `http://127.0.0.1:${server.address().port}`; ok({ ...st, st, server, url: st.base, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); }) }); }));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const a = process.argv.slice(2); const get = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const f = await startFakeSiwc({ port: +(get('--port') || 0), answer: get('--answer') ? readFileSync(get('--answer'), 'utf8') : undefined, cut: +(get('--cut') || 0), limit: a.includes('--limit') });
  console.log(JSON.stringify({ url: f.url }));
  setInterval(() => { if (a.includes('--verbose')) console.log(JSON.stringify({ calls: f.st.calls.length, refreshed: f.st.refreshed })); }, 5000);
}
