// lecpage live — Cloudflare Worker + Durable Object (HTTP protocol v1, docs/architecture.md §5.1).
//
// One Durable Object per training code (SQLite storage, Free plan compatible). Realtime over the
// WebSocket Hibernation API (idle sockets cost nothing; "ping" is answered without waking the object),
// SSE fallback for networks that block WebSockets, and snapshot polling as the last resort.
// Uploads go to R2 when an `UPLOADS` binding exists; otherwise /upload answers 503 uploads_disabled.
//
// Settings (wrangler.toml [vars] or secrets):
//   ADMIN_KEY (secret)        default admin key for every training (single-teacher deploy). ≥ 12 characters and not
//                             an example value, otherwise every API call answers 503 weak_admin_key.
//   SETUP_TOKEN (secret)      lets instructors register their own codes with POST /api/:code/init (shared relay)
//   OPEN_INIT="true"          first /init call claims a code (no token) — only for closed networks
//   ALLOWED_CODES="A1,B2"     restrict which codes exist          ALLOWED_ORIGINS="https://site"  CORS allow-list
//   RETENTION_DAYS="30"       idle days before a training is wiped   MAX_UPLOAD_MB="20"
//   MAX_PARTICIPANTS="500"    per training      MAX_SOCKETS_PER_IP="500"  WebSocket/SSE per IP per training
// A code comes to life only on its first write that may create a training (single-teacher mode: ADMIN_KEY or
// ALLOWED_CODES) or on /init: plain reads of an unknown code never create storage, and an object without a training
// deletes everything it holds in its alarm. A Guard object per client IP (binding GUARD) counts wrong admin keys and
// new trainings across all codes.
import { DurableObject } from 'cloudflare:workers';
import { LiveCore, HttpError, errorBody, normCode, sha256hex, keyProblem, isWeakKeyHash, PROTOCOL } from './protocol.js';

const DAY = 864e5;
const enc = new TextEncoder();
const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

function corsHeaders(request, env) {
  const origins = list(env.ALLOWED_ORIGINS);
  const origin = request.headers.get('Origin');
  const h = new Headers({
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Lec-Token, X-Lec-Admin, X-Lec-Setup, X-Lec-Filename',
    'Access-Control-Max-Age': '86400',
  });
  if (!origins.length) h.set('Access-Control-Allow-Origin', '*');
  else if (origin && origins.includes(origin)) h.set('Access-Control-Allow-Origin', origin);
  return h;
}
function originAllowed(request, env) {
  const origins = list(env.ALLOWED_ORIGINS);
  const origin = request.headers.get('Origin');
  return !origins.length || !origin || origins.includes(origin);
}
function json(status, body, extra) {
  const h = new Headers(extra);
  h.set('Content-Type', 'application/json; charset=utf-8');
  h.set('Cache-Control', 'no-store');
  h.set('X-Content-Type-Options', 'nosniff');
  return new Response(JSON.stringify(body), { status, headers: h });
}
function errorResponse(e, extra) {
  const { status, body, retryAfter } = errorBody(e);
  if (status >= 500) console.error(JSON.stringify({ message: 'live error', error: e && e.message }));
  const h = new Headers(extra);
  if (retryAfter) h.set('Retry-After', String(retryAfter));
  return json(status, body, h);
}
/** Refuses to run with an example or short ADMIN_KEY / SETUP_TOKEN (a Worker has no start-up step, so: per request). */
let weakChecked = null;
async function configProblem(env) {
  const sig = `${env.ADMIN_KEY || ''}\u0000${env.ADMIN_KEY_HASH || ''}\u0000${env.SETUP_TOKEN || ''}`;
  if (weakChecked && weakChecked.sig === sig) return weakChecked.why;
  let why = null;
  if (env.ADMIN_KEY && keyProblem(env.ADMIN_KEY)) why = 'ADMIN_KEY: ' + keyProblem(env.ADMIN_KEY);
  else if (!env.ADMIN_KEY && env.ADMIN_KEY_HASH && (!/^[0-9a-f]{64}$/i.test(env.ADMIN_KEY_HASH) || await isWeakKeyHash(env.ADMIN_KEY_HASH))) why = 'ADMIN_KEY_HASH: SHA-256가 아니거나 예시 키의 해시입니다.';
  else if (env.SETUP_TOKEN && keyProblem(env.SETUP_TOKEN)) why = 'SETUP_TOKEN: ' + keyProblem(env.SETUP_TOKEN).replace('관리자 키', '설정 토큰');
  weakChecked = { sig, why };
  return why;
}
function withHeaders(res, extra) {
  if (res.status === 101 || res.webSocket) return res;
  const h = new Headers(res.headers);
  for (const [k, v] of extra) h.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    if (!p.startsWith('/api/')) {
      return new Response('lecpage 실시간 서버(Cloudflare)가 켜져 있습니다. API: /api/<연수코드>/snapshot\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' } });
    }
    const cors = corsHeaders(request, env);
    try {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      const why = await configProblem(env);
      if (p === '/api/health') return json(200, { ok: !why, protocol: PROTOCOL, uploads: !!env.UPLOADS, runtime: 'cloudflare', ...(why ? { error: 'weak_admin_key', message: why } : {}) }, cors);
      if (why) throw new HttpError(503, 'weak_admin_key', `서버 설정을 고쳐 주세요 — ${why}`);
      if (!originAllowed(request, env) && (request.method !== 'GET' || p.endsWith('/ws'))) throw new HttpError(403, 'origin_not_allowed', '허용되지 않은 사이트에서 온 요청입니다.');
      const raw = p.slice(5).split('/')[0];
      let code;
      try { code = normCode(decodeURIComponent(raw)); } catch (e) { throw e instanceof HttpError ? e : new HttpError(400, 'bad_code', '연수 코드가 올바르지 않습니다.'); }
      const stub = env.LIVE.getByName(code);
      const res = await stub.fetch(request);
      return withHeaders(res, cors);
    } catch (e) {
      return errorResponse(e, cors);
    }
  },
};

export class LiveRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sse = new Set(); // { w: WritableStreamDefaultWriter, ip }
    this.react = new Map();
    this.reactTimer = null;
    this.pingTimer = null;
    this.corePromise = null;
    // Answered by the runtime without waking the object (no duration charge).
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  core() {
    if (!this.corePromise) {
      this.corePromise = (async () => {
        const env = this.env; const sql = this.ctx.storage.sql;
        const db = {
          all: (q, ...p) => sql.exec(q, ...p).toArray(),
          get: (q, ...p) => sql.exec(q, ...p).toArray()[0],
          run: (q, ...p) => { sql.exec(q, ...p).toArray(); },
          tx: (fn) => this.ctx.storage.transactionSync(fn),
        };
        // one Guard object per client IP counts wrong admin keys and new trainings across every code
        const guardOf = (key) => env.GUARD.getByName('ip:' + String(key).slice(String(key).indexOf(':') + 1));
        const guard = env.GUARD ? {
          hit: (key, [max, win]) => guardOf(key).hit(key, max, win),
          peek: (key, [max, win]) => guardOf(key).peek(key, max, win),
        } : null;
        return new LiveCore({
          db,
          config: {
            adminKeyHash: env.ADMIN_KEY ? await sha256hex(env.ADMIN_KEY) : (env.ADMIN_KEY_HASH || null),
            setupTokenHash: env.SETUP_TOKEN ? await sha256hex(env.SETUP_TOKEN) : null,
            openInit: String(env.OPEN_INIT) === 'true',
            allowedCodes: list(env.ALLOWED_CODES).length ? new Set(list(env.ALLOWED_CODES).map((c) => c.toUpperCase())) : null,
            retentionDays: Number(env.RETENTION_DAYS || 30),
            maxUploadBytes: Math.max(1, Number(env.MAX_UPLOAD_MB || 20)) * 1048576,
            maxParticipants: Math.max(1, Number(env.MAX_PARTICIPANTS) || 500),
            // no tables (and no storage bill) until the first write that may create a training
            lazySchema: true,
            // tables were just created: make sure an object that ends up without a training is emptied
            onSchema: () => { this.ctx.storage.getAlarm().then((a) => (a ? null : this.ctx.storage.setAlarm(Date.now() + DAY))).catch(() => {}); },
            guard,
          },
        });
      })();
    }
    return this.corePromise;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const parts = url.pathname.slice(5).split('/').filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
    const [rawCode, a, b] = parts;
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const headers = request.headers;
    try {
      const code = normCode(rawCode);
      const core = await this.core();
      if (a === 'ws') return this.openWebSocket(request, code, ip);
      if (a === 'events' && parts.length === 2 && request.method === 'GET') return this.openSse(ip);
      if (a === 'upload' && parts.length === 2 && request.method === 'POST') return await this.upload(core, code, request, ip);
      if (a === 'files' && b && parts.length === 3 && (request.method === 'GET' || request.method === 'HEAD')) return await this.serveFile(core, code, b, request);
      const body = await readJson(request);
      const out = await core.handle({ method: request.method, code, rest: parts.slice(1), query: url.searchParams, headers, body, ip, origin: url.origin });
      if (out.events) this.broadcast(out.events);
      if (out.reaction) this.addReaction(out.reaction);
      if (out.purgedFiles) await this.deleteFiles(code);
      if (out.deleteFiles) await this.deleteNames(code, out.deleteFiles);
      if (request.method !== 'GET' && core.ready) await this.scheduleCleanup(core, code);
      if (out.contentType) {
        return new Response(out.body, { status: out.status, headers: { 'Content-Type': out.contentType, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `attachment; filename="${out.filename || 'export.csv'}"` } });
      }
      return json(out.status, out.body);
    } catch (e) {
      return errorResponse(e);
    }
  }

  // ---------------------------------------------------------------- realtime
  socketsOf(ip) {
    let n = this.ctx.getWebSockets('ip:' + String(ip).slice(0, 64)).length;
    for (const x of this.sse) if (x.ip === ip) n++;
    return n;
  }
  openWebSocket(request, code, ip) {
    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') throw new HttpError(426, 'upgrade_required', 'WebSocket으로 연결하세요.');
    if (this.ctx.getWebSockets().length + this.sse.size > 5000) throw new HttpError(503, 'too_many_connections', '접속이 너무 많습니다.');
    if (this.socketsOf(ip) >= (Number(this.env.MAX_SOCKETS_PER_IP) || 500)) throw new HttpError(429, 'too_many_connections', '이 주소에서 연결이 너무 많습니다.', { retryAfter: 30 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, ['ip:' + String(ip).slice(0, 64)]);
    server.serializeAttachment({ admin: false, code, ip, fails: 0 });
    server.send(JSON.stringify({ type: 'hello', now: Date.now(), mode: 'ws', protocol: PROTOCOL }));
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(ws, message) {
    if (typeof message !== 'string' || message.length > 4096) return;
    if (message === 'ping') { ws.send('pong'); return; }
    let o; try { o = JSON.parse(message); } catch { return; }
    if (o && o.type === 'auth' && typeof o.admin === 'string' && o.admin.length <= 200) {
      const att = ws.deserializeAttachment() || {};
      try {
        const core = await this.core();
        // same throttle as the HTTP header: per (code, IP) here and per IP in the Guard; 429 closes the socket
        const ok = await core.wsAuth(att.code || '', o.admin, att.ip || '');
        att.admin = ok; if (!ok) att.fails = (att.fails || 0) + 1;
        ws.serializeAttachment(att);
        ws.send(JSON.stringify({ type: 'auth', ok }));
        if (!ok && att.fails >= 3) ws.close(1008, 'auth');
      } catch (e) {
        const { body, retryAfter } = errorBody(e);
        att.admin = false; ws.serializeAttachment(att);
        try { ws.send(JSON.stringify({ type: 'auth', ok: false, error: body.error, message: body.message, retryAfter })); ws.close(1008, 'auth'); } catch { /* closed */ }
      }
    } else if (o && o.type === 'ping') ws.send(JSON.stringify({ type: 'pong', now: Date.now() }));
  }
  async webSocketClose(ws, code, reason) {
    try { ws.close(code, reason); } catch { /* already closed */ }
  }
  async webSocketError(ws) {
    try { ws.close(1011, 'error'); } catch { /* ignore */ }
  }
  openSse(ip) {
    if (this.ctx.getWebSockets().length + this.sse.size > 5000) throw new HttpError(503, 'too_many_connections', '접속이 너무 많습니다.');
    if (this.socketsOf(ip) >= (Number(this.env.MAX_SOCKETS_PER_IP) || 500)) throw new HttpError(429, 'too_many_connections', '이 주소에서 연결이 너무 많습니다.', { retryAfter: 30 });
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const entry = { w: writer, ip };
    const hello = JSON.stringify({ type: 'hello', now: Date.now(), mode: 'sse', protocol: PROTOCOL });
    writer.write(enc.encode(`retry: 3000\n:${' '.repeat(2048)}\n\ndata: ${hello}\n\n`)).catch(() => this.sse.delete(entry));
    this.sse.add(entry);
    if (!this.pingTimer) {
      this.pingTimer = setInterval(() => {
        if (!this.sse.size) { clearInterval(this.pingTimer); this.pingTimer = null; return; }
        this.sendSse(`data: {"type":"ping","now":${Date.now()}}\n\n`);
      }, 20000);
    }
    return new Response(readable, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
  }
  sendSse(text) {
    const bytes = enc.encode(text);
    for (const x of this.sse) x.w.write(bytes).catch(() => { this.sse.delete(x); try { x.w.abort(); } catch { /* ignore */ } });
  }
  broadcast(events) {
    const sockets = this.ctx.getWebSockets();
    for (const ev of events) {
      const pub = ev.pub == null ? null : JSON.stringify({ type: ev.type, col: ev.col, doc: ev.type === 'reset' ? null : ev.pub });
      const adm = JSON.stringify({ type: ev.type, col: ev.col, doc: ev.doc });
      for (const ws of sockets) {
        const att = ws.deserializeAttachment() || {};
        const m = att.admin ? adm : pub;
        if (m) { try { ws.send(m); } catch { /* closed */ } }
      }
      if (pub) this.sendSse(`data: ${pub}\n\n`);
    }
  }
  addReaction(emoji) {
    this.react.set(emoji, (this.react.get(emoji) || 0) + 1);
    if (this.reactTimer) return;
    this.reactTimer = setTimeout(() => {
      this.reactTimer = null;
      const evs = [...this.react].map(([e, count]) => ({ type: 'reaction', col: null, doc: { emoji: e, count }, pub: { emoji: e, count } }));
      this.react.clear();
      this.broadcast(evs);
    }, 400);
  }

  // ---------------------------------------------------------------- uploads (R2, optional)
  async upload(core, code, request, ip) {
    if (!this.env.UPLOADS) throw new HttpError(503, 'uploads_disabled', '이 서버는 파일 올리기를 쓰지 않습니다(R2 연결 없음).');
    const auth = await core.authorizeUpload(code, request.headers, ip);
    const len = Number(request.headers.get('Content-Length') || 0);
    if (!len) throw new HttpError(411, 'length_required', '파일 크기를 알 수 없습니다.');
    if (len > auth.maxBytes + 64 * 1024) throw new HttpError(413, 'too_large', `파일은 ${Math.floor(auth.maxBytes / 1048576)}MB까지 올릴 수 있어요.`);
    let bytes; let name;
    const ct = request.headers.get('Content-Type') || '';
    if (/^multipart\/form-data/i.test(ct)) {
      const form = await request.formData();
      const f = form.get('file');
      if (!f || typeof f === 'string') throw new HttpError(400, 'required', 'file 필드가 필요합니다.');
      bytes = new Uint8Array(await f.arrayBuffer()); name = f.name;
    } else {
      bytes = new Uint8Array(await request.arrayBuffer());
      try { name = decodeURIComponent(request.headers.get('X-Lec-Filename') || 'file'); } catch { name = 'file'; }
    }
    const meta = core.checkUpload({ size: bytes.length, head: bytes.subarray(0, 32), name, maxBytes: auth.maxBytes });
    await this.env.UPLOADS.put(`${code}/${meta.stored}`, bytes, { httpMetadata: { contentType: meta.type } });
    core.recordFile(code, { stored: meta.stored, type: meta.type, size: bytes.length, by: auth.me.id });
    await this.scheduleCleanup(core, code);
    return json(201, { url: `/api/${code}/files/${meta.stored}`, name: meta.name, type: meta.type, size: bytes.length });
  }
  async serveFile(core, code, name, request) {
    // 404 unless the file is attached to a post that exists and is not hidden (core.fileMeta)
    const meta = core.fileMeta(code, name);
    if (!meta || !this.env.UPLOADS) throw new HttpError(404, 'not_found', '파일이 없습니다.');
    const obj = await this.env.UPLOADS.get(`${code}/${meta.name}`, { range: request.headers });
    if (!obj) throw new HttpError(404, 'not_found', '파일이 없습니다.');
    const h = new Headers({
      // short private cache: a hidden or removed post's files must stop being served quickly (no shared caches)
      'Content-Type': meta.type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=300',
      'Cross-Origin-Resource-Policy': 'cross-origin', 'Accept-Ranges': 'bytes', 'Content-Disposition': 'inline', ETag: obj.httpEtag,
    });
    if (meta.type !== 'application/pdf') h.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox");
    let status = 200;
    if (obj.range && request.headers.get('Range')) {
      const off = obj.range.offset ?? (obj.size - obj.range.suffix);
      const length = obj.range.length ?? (obj.size - off);
      h.set('Content-Range', `bytes ${off}-${off + length - 1}/${obj.size}`);
      h.set('Content-Length', String(length));
      status = 206;
    } else h.set('Content-Length', String(obj.size));
    return new Response(request.method === 'HEAD' ? null : obj.body, { status, headers: h });
  }
  async deleteFiles(code) {
    if (!this.env.UPLOADS) return;
    let cursor;
    do {
      const page = await this.env.UPLOADS.list({ prefix: `${code}/`, cursor });
      if (page.objects.length) await this.env.UPLOADS.delete(page.objects.map((o) => o.key));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }
  /** Deletes single uploads (a removed post's files, replaced files, never-attached uploads). */
  async deleteNames(code, names) {
    if (!this.env.UPLOADS || !names || !names.length) return;
    const keys = names.filter((n) => /^[a-f0-9]{24}\.[a-z0-9]{2,4}$/.test(n)).map((n) => `${code}/${n}`);
    for (let i = 0; i < keys.length; i += 1000) await this.env.UPLOADS.delete(keys.slice(i, i + 1000));
  }

  // ---------------------------------------------------------------- retention
  async scheduleCleanup(core, code) {
    const t = core.trainingOrNull(code);
    if (!t) return;
    const due = Date.now() + core.retentionDays(t) * DAY + 3600e3;
    if (this.alarmAt && this.alarmAt >= due - DAY / 2) return; // cached: avoid a storage read per write
    const cur = await this.ctx.storage.getAlarm();
    if (!cur || cur < due - DAY / 2) { await this.ctx.storage.setAlarm(due); this.alarmAt = due; } else this.alarmAt = cur;
  }
  async alarm() {
    const core = await this.core();
    const t = core.ready ? core.db.get('SELECT * FROM trainings LIMIT 1') : null;
    if (!t) {
      // no training here (never created, or created and wiped): drop every byte this object holds
      await this.ctx.storage.deleteAll();
      this.corePromise = null; this.alarmAt = 0;
      return;
    }
    const removed = core.cleanup();
    for (const o of core.sweepOrphans()) await this.deleteNames(o.code, [o.name]);
    if (removed.length) {
      for (const r of removed) await this.deleteFiles(r.code);
      this.broadcast([{ type: 'reset', col: null, doc: null, pub: {} }]);
      // drop every byte this object holds; the schema is recreated on the next authorised write
      await this.ctx.storage.deleteAll();
      this.corePromise = null; this.alarmAt = 0;
    } else {
      this.alarmAt = 0;
      await this.scheduleCleanup(core, t.code);
    }
  }
}

/** Per-IP counters shared by every room (wrong admin keys, new trainings). Tiny storage, wiped by its own alarm. */
export class Guard extends DurableObject {
  async hit(key, max, win) {
    const now = Date.now();
    let e = await this.ctx.storage.get(key);
    if (!e || e.reset <= now) e = { c: 0, reset: now + win };
    if (e.c >= max) return e.reset - now;
    e.c++;
    await this.ctx.storage.put(key, e);
    const cur = await this.ctx.storage.getAlarm();
    if (!cur || cur < e.reset) await this.ctx.storage.setAlarm(e.reset + 1000);
    return 0;
  }
  async peek(key, max) {
    const now = Date.now();
    const e = await this.ctx.storage.get(key);
    return e && e.reset > now && e.c >= max ? e.reset - now : 0;
  }
  async alarm() {
    const now = Date.now(); let next = 0;
    for (const [k, e] of await this.ctx.storage.list()) {
      if (!e || e.reset <= now) await this.ctx.storage.delete(k); else next = Math.max(next, e.reset);
    }
    if (next) await this.ctx.storage.setAlarm(next + 1000); else await this.ctx.storage.deleteAll();
  }
}

async function readJson(request) {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'DELETE') return null;
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > 64 * 1024) throw new HttpError(413, 'too_large', '요청이 너무 큽니다.');
  const buf = await request.arrayBuffer();
  if (buf.byteLength > 64 * 1024) throw new HttpError(413, 'too_large', '요청이 너무 큽니다.');
  if (!buf.byteLength) return {};
  try { return JSON.parse(new TextDecoder().decode(buf)); } catch { throw new HttpError(400, 'invalid_json', 'JSON 형식이 아닙니다.'); }
}
