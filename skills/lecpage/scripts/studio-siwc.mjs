// lecpage studio — "ChatGPT 계정으로 연결"(Sign in with ChatGPT, 오픈소스·로컬 앱의 ChatGPT 요금제 사용). 외부 의존성 없음.
// 공식 문서(developers.openai.com/siwc/llms-full.txt, 2026-11-21에 다시 읽음):
//   등록: client_id=dynamic_agent_client(처음) → 콜백이 준 client_id를 저장해 다음부터 씀 · PKCE(S256) · state·nonce ·
//   redirect_uri는 http://127.0.0.1:<포트>/auth/callback(localhost 금지) · scope "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct" ·
//   resource=https://api.openai.com/v1 · ext_agent_host_id(urn:uuid:…, 이 PC마다 하나, 바꾸지 않음) · agent_name_hint는 처음 등록 때만
//   ID 토큰: RS256 서명(JWKS)·iss·aud(받은 client_id)·exp·nonce 확인. scope에 chatgpt.tokens.use.direct가 없으면 요금제 사용 안 함
//   추론: POST https://api.openai.com/v1/responses, store:false·stream:true 필수, background·max_output_tokens·temperature·previous_response_id 등은 빼야 함
//   보관: OS 사용자 폴더의 파일(0600), 브라우저·로그·분석에 넣지 않음. 갱신은 한 번에 하나(돌아가며 바뀌는 refresh 토큰)
// 토큰은 이 프로그램 안에만 있고 앱(브라우저)에는 연결 여부·이메일·모델 목록만 줍니다. 요청은 이 PC에서 OpenAI로 바로 갑니다.
import { randomBytes, randomUUID, createHash, createPublicKey, verify as verifySig } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, mkdirSync, chmodSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export const SIWC = {
  auth: 'https://auth.openai.com',
  api: 'https://api.openai.com',
  scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
  resource: 'https://api.openai.com/v1',
  planScope: 'chatgpt.tokens.use.direct',
  agentName: 'lecpage',
  usageUrl: 'https://chatgpt.com/settings/usage',
};
/** 미리보기 한계: 요청 본문에서 빼야 하는 칸(문서 Preview limitations) */
export const SIWC_DROP = ['background', 'conversation', 'max_output_tokens', 'max_tool_calls', 'metadata', 'moderation', 'multi_agent', 'prompt', 'prompt_cache_retention', 'safety_identifier', 'temperature', 'top_logprobs', 'top_p', 'truncation', 'user', 'previous_response_id', 'service_tier'];
const KEEP = ['model', 'instructions', 'input', 'text', 'reasoning', 'include'];
/** 시험용: 가짜 서버(같은 PC의 http 주소)로만 바꿀 수 있음. 실제 토큰이 다른 곳으로 가지 않게 */
const LOOPBACK = /^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/;
const pick = (v, d) => (typeof v === 'string' && LOOPBACK.test(v.replace(/\/+$/, '')) ? v.replace(/\/+$/, '') : d);
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const now = () => Date.now();

function writeSecret(file, obj) {
  mkdirSync(join(file, '..'), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', { mode: 0o600 });
  try { chmodSync(tmp, 0o600); } catch { /* 윈도우: 사용자 폴더 권한을 따름 */ }
  renameSync(tmp, file);
}
const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };

/** 요청 본문을 요금제 경로가 받는 꼴로: 아는 칸만 남기고 store:false·stream:true. system 역할 메시지는 developer로 */
export function siwcBody(body) {
  const out = {};
  for (const k of KEEP) if (body && body[k] !== undefined) out[k] = body[k];
  if (Array.isArray(out.input)) out.input = out.input.map((m) => (m && m.role === 'system' ? { ...m, role: 'developer' } : m));
  out.store = false; out.stream = true;
  return out;
}

/** JWT 확인(RS256만). jwks: { keys:[…] } */
export function verifyJwt(token, jwks, { issuer, audience, nonce, at = now() }) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('id_token 모양이 아니에요');
  const [h, p, s] = parts;
  const head = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
  if (head.alg !== 'RS256') throw new Error('id_token 서명 방식이 달라요');
  const jwk = (jwks?.keys || []).find((k) => k.kid === head.kid && (k.kty === 'RSA'));
  if (!jwk) throw Object.assign(new Error('서명 키를 찾지 못했어요'), { unknownKid: true });
  const ok = verifySig('RSA-SHA256', Buffer.from(`${h}.${p}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(s, 'base64url'));
  if (!ok) throw new Error('id_token 서명이 맞지 않아요');
  const c = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  if (c.iss !== issuer) throw new Error('id_token 발급자가 달라요');
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!aud.includes(audience)) throw new Error('id_token 대상이 달라요');
  if (!(c.exp * 1000 > at - 60e3)) throw new Error('id_token이 만료됐어요');
  if (nonce && c.nonce !== nonce) throw new Error('id_token nonce가 달라요');
  return c;
}

const ERR_KO = {
  subscription_sharing_user_not_eligible: 'ChatGPT Plus·Pro 요금제에서 쓸 수 있어요. 이 계정·워크스페이스로는 요금제 사용이 안 돼요.',
  subscription_sharing_usage_limit_exceeded: 'ChatGPT 요금제의 사용 한도에 닿았어요. ChatGPT 설정 → 사용량에서 확인하고, 한도가 다시 차면 이어서 해 주세요.',
  subscription_sharing_usage_unavailable: 'ChatGPT 사용량을 확인하지 못했어요. 잠시 뒤에 다시 해 주세요.',
  subscription_sharing_invalid_user: 'ChatGPT 연결이 풀렸어요. 다시 연결해 주세요.',
  subscription_sharing_user_unavailable: 'ChatGPT 계정 정보를 잠시 못 읽었어요. 잠시 뒤에 다시 해 주세요.',
};

/**
 * home: 자격 파일을 둘 폴더(OS 사용자 폴더) · port: lecpage 커넥트 포트(콜백 주소) · fetchImpl: 시험용
 */
export function createSiwc({ home, port, fetchImpl = globalThis.fetch, log = () => {}, env = process.env } = {}) {
  const AUTH = pick(env.LECPAGE_SIWC_AUTH_BASE, SIWC.auth);
  const API = pick(env.LECPAGE_SIWC_API_BASE, SIWC.api);
  const ISSUER = AUTH === SIWC.auth ? SIWC.auth : AUTH;
  const credFile = join(home, 'chatgpt.json');
  const hostFile = join(home, 'host.json');
  let pending = null; // { state, nonce, verifier, redirectUri, clientId, newReg, at }
  let refreshing = null;
  let modelsCache = null;
  let jwksCache = null;
  let welcome = false; // 이번 실행에서 처음 연결됨 → 앱이 '요금제를 쓰고 있어요' 안내를 한 번 보여 줌

  const hostId = () => {
    const h = readJson(hostFile);
    if (h?.ext_agent_host_id) return h.ext_agent_host_id;
    const id = `urn:uuid:${randomUUID()}`;
    writeSecret(hostFile, { ext_agent_host_id: id, created_at: new Date().toISOString() });
    return id;
  };
  const cred = () => readJson(credFile);
  const save = (c) => { writeSecret(credFile, c); modelsCache = null; };
  const redirectUri = () => `http://127.0.0.1:${port}/auth/callback`;
  const form = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')).toString();
  const post = (url, o) => fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: form(o), signal: AbortSignal.timeout(30000) });

  async function jwks(force) {
    if (jwksCache && !force && now() - jwksCache.at < 3600e3) return jwksCache.v;
    const r = await fetchImpl(`${AUTH}/.well-known/jwks.json`, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw Object.assign(new Error('서명 키 목록을 받지 못했어요'), { temp: true });
    jwksCache = { at: now(), v: await r.json() };
    return jwksCache.v;
  }

  function status() {
    const c = cred();
    const connected = !!(c?.access_token && c?.refresh_token);
    const plan = connected && (c.scopes || []).includes(SIWC.planScope);
    return { connected, plan, email: connected || c?.email ? String(c?.email || '') : '', pending: !!(pending && now() - pending.at < 15 * 60e3), welcome, usageUrl: SIWC.usageUrl, needsLogin: !connected && !!c?.client_id };
  }

  /** 로그인 시작: 브라우저로 열 주소 */
  function startLogin({ reconsent = false } = {}) {
    const c = cred();
    const host = hostId();
    const verifier = b64u(randomBytes(32));
    const p = { state: b64u(randomBytes(24)), nonce: b64u(randomBytes(24)), verifier, redirectUri: redirectUri(), clientId: c?.client_id || 'dynamic_agent_client', newReg: !c?.client_id, at: now() };
    pending = p;
    const q = {
      client_id: p.clientId, response_type: 'code', redirect_uri: p.redirectUri, scope: SIWC.scope, resource: SIWC.resource,
      state: p.state, nonce: p.nonce, code_challenge_method: 'S256', code_challenge: b64u(createHash('sha256').update(verifier).digest()),
      ext_agent_host_id: host,
      ...(p.newReg ? { agent_name_hint: SIWC.agentName } : { ...(c?.id_token ? { id_token_hint: c.id_token } : {}), ...(c?.email ? { login_hint: c.email } : {}) }),
      ...(reconsent || (c?.client_id && c?.access_token && !(c.scopes || []).includes(SIWC.planScope)) ? { prompt: 'consent' } : {}),
    };
    log('ChatGPT 로그인 창을 열어요');
    return { url: `${AUTH}/api/accounts/authorize?${form(q)}` };
  }

  /** /auth/callback: { ok, message_ko } */
  async function callback(params) {
    const p = pending;
    const state = params.get('state') || '';
    if (!p || now() - p.at > 15 * 60e3 || state !== p.state) return { ok: false, status: 400, message_ko: '로그인 요청이 맞지 않거나 오래됐어요. lecpage에서 [ChatGPT 계정으로 로그인]을 다시 눌러 주세요.' };
    pending = null;
    const err = params.get('error');
    if (err) return { ok: false, status: 200, message_ko: err === 'access_denied' ? '로그인을 취소했어요. 다시 하려면 lecpage에서 [ChatGPT 계정으로 로그인]을 눌러 주세요.' : `ChatGPT 로그인이 끝나지 않았어요(${String(err).slice(0, 40)}).` };
    const code = params.get('code') || '';
    let clientId = p.clientId;
    const got = params.get('client_id') || '';
    if (p.newReg) {
      if (!got || got === 'dynamic_agent_client') return { ok: false, status: 400, message_ko: '등록이 끝나지 않았어요(받은 client_id 없음). 다시 해 주세요.' };
      clientId = got;
    } else if (got && got !== clientId) return { ok: false, status: 400, message_ko: '저장된 연결과 다른 등록이 돌아와서 받지 않았어요. 다시 해 주세요.' };
    if (!code) return { ok: false, status: 400, message_ko: '로그인 코드가 없어요. 다시 해 주세요.' };
    let tok;
    try {
      const r = await post(`${AUTH}/api/accounts/oauth/token`, { grant_type: 'authorization_code', client_id: clientId, code, code_verifier: p.verifier, redirect_uri: p.redirectUri, resource: SIWC.resource });
      tok = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, status: 502, message_ko: `토큰을 받지 못했어요(${String(tok.error || r.status).slice(0, 40)}). lecpage에서 다시 눌러 주세요.` };
    } catch { return { ok: false, status: 502, message_ko: 'OpenAI 로그인 서버에 닿지 못했어요. 인터넷 연결을 확인하고 다시 해 주세요.' }; }
    let claims;
    try {
      let keys = await jwks();
      try { claims = verifyJwt(tok.id_token, keys, { issuer: ISSUER, audience: clientId, nonce: p.nonce }); }
      catch (e) { if (!e.unknownKid) throw e; keys = await jwks(true); claims = verifyJwt(tok.id_token, keys, { issuer: ISSUER, audience: clientId, nonce: p.nonce }); }
    } catch (e) { return { ok: false, status: 502, message_ko: `로그인 확인에 실패했어요(${e.message}). 다시 해 주세요.` }; }
    const old = cred();
    if (old?.subject && old.client_id === clientId && old.subject !== claims.sub) return { ok: false, status: 400, message_ko: '저장된 계정과 다른 계정이에요. 다른 계정으로 바꾸려면 lecpage에서 연결 해제한 뒤 다시 연결해 주세요.' };
    const scopes = String(tok.scope || params.get('scope') || '').split(/[\s+]+/).filter(Boolean);
    save({ email: String(claims.email || ''), issuer: ISSUER, subject: claims.sub, client_id: clientId, ext_agent_host_id: hostId(), id_token: tok.id_token, access_token: tok.access_token, refresh_token: tok.refresh_token, token_type: tok.token_type || 'Bearer', expires_in: +tok.expires_in || 3600, scopes, saved_at: new Date().toISOString() });
    if (!scopes.includes(SIWC.planScope)) { log('ChatGPT 로그인됨(요금제 사용 허락 없음)'); return { ok: false, status: 200, message_ko: '로그인은 됐지만 ChatGPT 요금제 사용을 허락하지 않았어요. 쓰려면 lecpage에서 [ChatGPT 계정으로 로그인]을 다시 눌러 허락해 주세요.' }; }
    welcome = true;
    log('ChatGPT 계정 연결됨');
    return { ok: true, status: 200, message_ko: 'ChatGPT 계정을 연결했어요. 이 창을 닫고 lecpage로 돌아가요.' };
  }

  /** 만료 5분 전이면 갱신(한 번에 하나). 쓸 수 없는 refresh 토큰이면 토큰을 지우고 null */
  async function accessToken({ force = false } = {}) {
    let c = cred();
    if (!c?.access_token) return null;
    const exp = Date.parse(c.saved_at || 0) + ((+c.expires_in || 3600) - 300) * 1000;
    if (!force && now() < exp) return c.access_token;
    refreshing ||= (async () => {
      try {
        const r = await post(`${AUTH}/api/accounts/oauth/token`, { grant_type: 'refresh_token', client_id: c.client_id, refresh_token: c.refresh_token, resource: SIWC.resource });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.access_token) {
          c = { ...c, access_token: j.access_token, refresh_token: j.refresh_token || c.refresh_token, expires_in: +j.expires_in || 3600, scopes: j.scope ? String(j.scope).split(/\s+/).filter(Boolean) : c.scopes, ...(j.id_token ? { id_token: j.id_token } : {}), saved_at: new Date().toISOString() };
          save(c);
          return c.access_token;
        }
        const code = String(j.error || j.code || '');
        if (/invalid_grant|invalid_refresh_token|token_expired|refresh_token_(expired|invalidated|reused)/.test(code)) {
          const { access_token, refresh_token, ...keep } = c; save(keep); // 다시 로그인(같은 client_id로)
          log('ChatGPT 연결이 풀렸어요(다시 로그인 필요)');
          return null;
        }
        throw Object.assign(new Error('refresh'), { temp: true, status: r.status });
      } finally { refreshing = null; }
    })();
    return refreshing;
  }

  async function logout() {
    const c = cred();
    if (!c) return { ok: true, revoked: true };
    let revoked = !c.refresh_token;
    if (c.refresh_token) {
      for (let i = 0; i < 3 && !revoked; i++) {
        try { const r = await post(`${AUTH}/api/accounts/oauth/revoke`, { token: c.refresh_token, token_type_hint: 'refresh_token', client_id: c.client_id }); if (r.ok) revoked = true; else if (r.status < 500) break; } catch { /* 다시 */ }
        if (!revoked) await new Promise((res) => setTimeout(res, 400 * (i + 1)));
      }
    }
    // 등록(client_id)·계정 구분값·이 PC의 host ID는 남김(다음 로그인에 씀). 토큰은 지움
    save({ email: c.email, issuer: c.issuer, subject: c.subject, client_id: c.client_id, ext_agent_host_id: c.ext_agent_host_id });
    welcome = false;
    log('ChatGPT 연결 해제');
    return { ok: true, revoked };
  }

  /**
   * 그 계정이 쓸 수 있는 모델 목록. null = 연결 안 됨(토큰 없음, 갱신해도 OpenAI가 401). 그 밖의 실패(망·429·5xx·잠깐 갱신 못 함)는
   * { status } 오류를 던짐 → 앱이 '다시 로그인' 대신 '잠시 뒤 다시'를 보여 줌
   */
  async function models() {
    if (modelsCache && now() - modelsCache.at < 10 * 60e3) return modelsCache.v;
    const t = await accessToken();
    if (!t) return null;
    const get = (tok) => fetchImpl(`${API}/v1/models`, { headers: { authorization: `Bearer ${tok}` }, signal: AbortSignal.timeout(20000) });
    let r = await get(t);
    if (r.status === 401) { await r.body?.cancel().catch(() => {}); const t2 = await accessToken({ force: true }); if (!t2) return null; r = await get(t2); }
    if (r.status === 401) return null;
    if (!r.ok) throw Object.assign(new Error(`models ${r.status}`), { status: r.status });
    const j = await r.json().catch(() => ({}));
    const v = (Array.isArray(j.models) ? j.models : []).filter((m) => m && m.slug && (m.visibility === undefined || m.visibility === 'list')).map((m) => ({ id: String(m.slug), label: String(m.display_name || m.slug) }));
    modelsCache = { at: now(), v };
    return v;
  }

  /** 앞에서 받은 오류(스트림 전): 상태·코드·한국어 안내. 원문은 짧게만 */
  function upstreamError(status, text) {
    let j = null; try { j = JSON.parse(text); } catch { /* 글 */ }
    const code = String(j?.error?.code || j?.code || '');
    const msg = String(j?.error?.message || j?.detail || j?.message || text || '').slice(0, 300);
    return { ok: false, error: code || `http_${status}`, code, status, message: msg, message_ko: ERR_KO[code] || (status === 401 ? 'ChatGPT 연결이 풀렸어요. 다시 연결해 주세요.' : status === 403 ? 'ChatGPT 요금제로 쓸 수 없는 요청이에요(요금제·지역·권한).' : '') };
  }

  /** Responses 스트림 중계. 답(SSE)은 받은 그대로 흘려보냄 */
  async function responses(body, req, res, headers) {
    const send = (st, obj) => { res.writeHead(st, { ...headers, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };
    let t;
    try { t = await accessToken(); } catch { return send(503, { ok: false, error: 'refresh', message_ko: 'ChatGPT 연결을 새로 하지 못했어요. 잠시 뒤에 다시 해 주세요.' }); }
    if (!t) return send(401, { ok: false, error: 'not-connected', message_ko: 'ChatGPT 계정이 연결되어 있지 않아요. [ChatGPT 계정으로 로그인]을 눌러 주세요.' });
    if (!(cred()?.scopes || []).includes(SIWC.planScope)) return send(403, { ok: false, error: 'no-plan-scope', code: 'no-plan-scope', message_ko: 'ChatGPT 요금제 사용을 허락하지 않았어요. [ChatGPT 계정으로 로그인]을 다시 눌러 허락해 주세요.' });
    const payload = JSON.stringify(siwcBody(body));
    const ctl = new AbortController();
    const onClose = () => ctl.abort();
    res.on('close', onClose);
    const go = (tok) => fetchImpl(`${API}/v1/responses`, { method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json', accept: 'text/event-stream' }, body: payload, signal: ctl.signal });
    let r;
    try {
      r = await go(t);
      if (r.status === 401) { await r.body?.cancel().catch(() => {}); const t2 = await accessToken({ force: true }).catch(() => null); if (t2) r = await go(t2); }
    } catch (e) {
      res.off('close', onClose);
      if (ctl.signal.aborted) return res.destroy();
      return send(502, { ok: false, error: 'network', message_ko: 'OpenAI에 닿지 못했어요. 인터넷 연결을 확인해 주세요.' });
    }
    if (!r.ok) {
      const text = (await r.text().catch(() => '')).slice(0, 65536);
      res.off('close', onClose);
      const e = upstreamError(r.status, text);
      log(`ChatGPT 요청 거절(${r.status}${e.code ? ' ' + e.code : ''})`);
      return send(r.status, e);
    }
    log('ChatGPT 요청 시작');
    res.writeHead(200, { ...headers, 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' });
    try {
      const reader = r.body.getReader();
      for (;;) { const { done, value } = await reader.read(); if (done) break; if (!res.write(value)) await new Promise((ok) => res.once('drain', ok)); }
      log('ChatGPT 요청 끝');
    } catch { /* 앱이 끊었거나 망이 끊김: 앱이 받은 데부터 '이어서'로 */ }
    res.off('close', onClose);
    res.end();
  }

  /** 연결 해제가 아닌 '이 PC에서 지우기'(시험·문제 해결용) */
  function forgetAll() { try { rmSync(credFile, { force: true }); } catch { /* 없음 */ } }

  return { status, startLogin, callback, accessToken, logout, models, responses, forgetAll, ackWelcome: () => { welcome = false; }, get pending() { return pending; } };
}

/** 콜백 화면(해요체). 성공하면 잠깐 뒤 창 닫기만 시도 */
export function callbackPage({ ok, message_ko }) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>lecpage · ChatGPT 연결</title>
<style>body{font:17px/1.6 system-ui,sans-serif;max-width:560px;margin:72px auto;padding:0 20px;color:#1f1a17;background:#fbfaf9}h1{font-size:1.4rem}p.s{color:#555;font-size:14px}</style></head>
<body><h1>${ok ? 'ChatGPT 계정을 연결했어요' : 'ChatGPT 연결이 끝나지 않았어요'}</h1><p>${esc(message_ko)}</p>${ok ? '<p class="s">lecpage 화면이 저절로 다음 단계로 넘어가요. 이 창은 닫아도 돼요. 사용량은 ChatGPT 설정 → 사용량에서 볼 수 있어요.</p><script>setTimeout(function(){try{window.close()}catch(e){}},1500)</script>' : ''}</body></html>`;
}
