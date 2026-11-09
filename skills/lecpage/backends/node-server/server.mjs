#!/usr/bin/env node
// lecpage live — zero-dependency Node server (Node ≥ 22.5, built-in node:sqlite).
// Speaks HTTP protocol v1 (docs/architecture.md §5.1) and can serve the generated static site too,
// so one process/container hosts everything.
//
//   node server.mjs --static ./site --admin-key '연수관리자키' --port 8787
//   node server.mjs --hash '키'          (prints SHA-256 for /init)
//
// Options (CLI flag / environment variable):
//   --port / PORT (8787)               --host / LEC_HOST (0.0.0.0)
//   --data / LEC_DATA (./data)          --static / LEC_STATIC (none)
//   --admin-key / LEC_ADMIN_KEY         --admin-key-hash / LEC_ADMIN_KEY_HASH
//   --setup-token / LEC_SETUP_TOKEN     --open-init / LEC_OPEN_INIT=1
//   --codes / LEC_CODES (comma list)    --origins / LEC_ORIGINS (comma list; empty = any origin)
//   --max-upload-mb / LEC_MAX_UPLOAD_MB (20)    --retention-days / LEC_RETENTION_DAYS (30)
//   --trust-proxy / LEC_TRUST_PROXY=1   --no-uploads / LEC_UPLOADS=0     --quiet / LEC_LOG=0
// Static serving never returns dotfiles, *.md, lecpage.blueprint.json or database files (404).
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { LiveCore, HttpError, errorBody, normCode, sha256hex, randomToken, PROTOCOL } from './lib/protocol.js';
import { acceptWebSocket } from './lib/ws.js';

const VERSION = '1.0.0';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.vtt': 'text/vtt; charset=utf-8', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json',
};

export function readOptions(argv = process.argv.slice(2), env = process.env) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const [k, inline] = a.slice(2).split(/=(.*)/s);
    if (inline !== undefined) flags[k] = inline;
    else if (argv[i + 1] != null && !argv[i + 1].startsWith('--')) flags[k] = argv[++i];
    else flags[k] = true;
  }
  const pick = (flag, envName, dflt) => (flags[flag] !== undefined ? flags[flag] : env[envName] !== undefined && env[envName] !== '' ? env[envName] : dflt);
  const list = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []);
  const truthy = (v) => v === true || /^(1|true|yes|on)$/i.test(String(v || ''));
  return {
    hash: flags.hash,
    port: Number(pick('port', 'PORT', 8787)),
    host: String(pick('host', 'LEC_HOST', '0.0.0.0')),
    data: path.resolve(String(pick('data', 'LEC_DATA', './data'))),
    staticDir: pick('static', 'LEC_STATIC', '') ? path.resolve(String(pick('static', 'LEC_STATIC', ''))) : '',
    adminKey: pick('admin-key', 'LEC_ADMIN_KEY', ''),
    adminKeyHash: pick('admin-key-hash', 'LEC_ADMIN_KEY_HASH', ''),
    setupToken: pick('setup-token', 'LEC_SETUP_TOKEN', ''),
    openInit: truthy(pick('open-init', 'LEC_OPEN_INIT', '')),
    codes: list(pick('codes', 'LEC_CODES', '')).map((c) => c.toUpperCase()),
    origins: list(pick('origins', 'LEC_ORIGINS', '')),
    maxUploadMb: Number(pick('max-upload-mb', 'LEC_MAX_UPLOAD_MB', 20)),
    retentionDays: Number(pick('retention-days', 'LEC_RETENTION_DAYS', 30)),
    trustProxy: truthy(pick('trust-proxy', 'LEC_TRUST_PROXY', '')),
    uploads: flags['no-uploads'] ? false : !/^(0|false|no|off)$/i.test(String(env.LEC_UPLOADS || '1')),
    quiet: flags.quiet === true || /^(0|false|off)$/i.test(String(env.LEC_LOG || '1')),
    generateKey: flags['no-generate-key'] ? false : !/^(0|false)$/i.test(String(env.LEC_GENERATE_KEY || '1')),
  };
}

function openDb(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;');
  const cache = new Map();
  const st = (sql) => { let s = cache.get(sql); if (!s) { s = db.prepare(sql); cache.set(sql, s); } return s; };
  let depth = 0;
  return {
    raw: db,
    all: (sql, ...p) => st(sql).all(...p),
    get: (sql, ...p) => st(sql).get(...p),
    run: (sql, ...p) => { st(sql).run(...p); },
    tx(fn) {
      if (depth) return fn();
      depth++; db.exec('BEGIN IMMEDIATE');
      try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { try { db.exec('ROLLBACK'); } catch { /* ignore */ } throw e; } finally { depth--; }
    },
    close: () => db.close(),
  };
}

/** Operator files that sit next to the generated site but must never be served. */
export function isPrivateFile(rel) {
  const segs = String(rel).split(/[\\/]+/).filter(Boolean);
  if (segs.some((x) => x.startsWith('.'))) return true; // dotfiles and dot-directories (.env, .git/)
  const base = (segs[segs.length - 1] || '').toLowerCase();
  return base.endsWith('.md') || base === 'lecpage.blueprint.json' || base === 'admin-key.sha256' || /\.(sqlite|sqlite-wal|sqlite-shm|db)$/.test(base);
}

/** Starts the server. Returns { server, port, url, close() }. */
export async function start(opts = readOptions()) {
  const log = opts.quiet ? () => {} : (...a) => console.log(new Date().toISOString(), ...a);
  await fsp.mkdir(path.join(opts.data, 'uploads'), { recursive: true });

  // ---- admin key: env/CLI, or a generated one kept as a hash in the data folder ----
  let adminKeyHash = opts.adminKeyHash ? String(opts.adminKeyHash).toLowerCase() : opts.adminKey ? await sha256hex(opts.adminKey) : '';
  const keyFile = path.join(opts.data, 'admin-key.sha256');
  if (!adminKeyHash && !opts.setupToken && !opts.openInit && opts.generateKey) {
    if (fs.existsSync(keyFile)) adminKeyHash = fs.readFileSync(keyFile, 'utf8').trim();
    else {
      const key = randomToken().slice(0, 16);
      adminKeyHash = await sha256hex(key);
      fs.writeFileSync(keyFile, adminKeyHash + '\n', { mode: 0o600 });
      console.log(`\n  관리자 키를 새로 만들었습니다(이번 한 번만 보여 줍니다): ${key}\n  잊어버리면 ${keyFile} 를 지우고 다시 실행하세요.\n`);
    }
  }

  const db = openDb(path.join(opts.data, 'lecpage-live.sqlite'));
  const core = new LiveCore({
    db,
    config: {
      adminKeyHash: adminKeyHash || null,
      setupTokenHash: opts.setupToken ? await sha256hex(opts.setupToken) : null,
      openInit: opts.openInit,
      allowedCodes: opts.codes.length ? new Set(opts.codes) : null,
      retentionDays: opts.retentionDays,
      maxUploadBytes: Math.max(1, opts.maxUploadMb) * 1024 * 1024,
    },
  });

  // ---- realtime hub ----
  const rooms = new Map(); // code → { sse:Set<res>, ws:Set<ws>, react:Map, timer }
  const room = (code) => { let r = rooms.get(code); if (!r) { r = { sse: new Set(), ws: new Set(), react: new Map(), timer: null }; rooms.set(code, r); } return r; };
  const dropRoom = (code) => { const r = rooms.get(code); if (r && !r.sse.size && !r.ws.size && !r.timer) rooms.delete(code); };
  function broadcast(code, events) {
    const r = rooms.get(code); if (!r || !events || !events.length) return;
    for (const ev of events) {
      const pub = ev.pub == null ? null : JSON.stringify({ type: ev.type, col: ev.col, doc: ev.type === 'reset' ? null : ev.pub });
      const adm = JSON.stringify({ type: ev.type, col: ev.col, doc: ev.doc });
      for (const res of r.sse) if (pub) res.write(`data: ${pub}\n\n`);
      for (const ws of r.ws) { const m = ws.attachment.admin ? adm : pub; if (m) ws.send(m); }
    }
  }
  function addReaction(code, emoji) {
    const r = room(code);
    r.react.set(emoji, (r.react.get(emoji) || 0) + 1);
    if (r.timer) return;
    r.timer = setTimeout(() => {
      r.timer = null;
      const evs = [...r.react].map(([e, count]) => ({ type: 'reaction', col: null, doc: { emoji: e, count }, pub: { emoji: e, count } }));
      r.react.clear();
      broadcast(code, evs);
      dropRoom(code);
    }, 400);
  }
  const pingTimer = setInterval(() => {
    const now = Date.now();
    for (const [, r] of rooms) {
      for (const res of r.sse) res.write(`data: {"type":"ping","now":${now}}\n\n`);
    }
  }, 20_000);
  const cleanupTimer = setInterval(() => runCleanup(), 3600_000);
  async function runCleanup() {
    try {
      for (const { code } of core.cleanup()) await fsp.rm(path.join(opts.data, 'uploads', code), { recursive: true, force: true });
    } catch (e) { log('cleanup error', e.message); }
  }
  runCleanup();

  // ---- helpers ----
  const allowAny = !opts.origins.length;
  function corsHeaders(req) {
    const origin = req.headers.origin;
    const h = { Vary: 'Origin' };
    if (allowAny) h['Access-Control-Allow-Origin'] = '*';
    else if (origin && opts.origins.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type, X-Lec-Token, X-Lec-Admin, X-Lec-Setup, X-Lec-Filename';
    h['Access-Control-Max-Age'] = '86400';
    return h;
  }
  const originAllowed = (req) => allowAny || !req.headers.origin || opts.origins.includes(req.headers.origin);
  const clientIp = (req) => {
    if (opts.trustProxy) { const f = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim(); if (f) return f; }
    return req.socket.remoteAddress || '';
  };
  const headersOf = (req) => ({ get: (n) => { const v = req.headers[n.toLowerCase()]; return v == null ? null : Array.isArray(v) ? v[0] : v; } });
  function send(res, status, body, extra = {}) {
    const isText = typeof body === 'string';
    const payload = isText ? body : JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': isText ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
    res.end(payload);
  }
  async function readBody(req, max) {
    const len = Number(req.headers['content-length'] || 0);
    if (len > max) throw new HttpError(413, 'too_large', '요청이 너무 큽니다.', { max });
    const chunks = []; let n = 0;
    for await (const c of req) { n += c.length; if (n > max) throw new HttpError(413, 'too_large', '요청이 너무 큽니다.', { max }); chunks.push(c); }
    return Buffer.concat(chunks);
  }
  async function readJson(req) {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE') return null;
    const buf = await readBody(req, 64 * 1024);
    if (!buf.length) return {};
    try { return JSON.parse(buf.toString('utf8')); } catch { throw new HttpError(400, 'invalid_json', 'JSON 형식이 아닙니다.'); }
  }

  // ---- upload ----
  async function handleUpload(req, res, code, cors) {
    if (!opts.uploads) throw new HttpError(503, 'uploads_disabled', '이 서버는 파일 올리기를 쓰지 않습니다.');
    const auth = await core.authorizeUpload(code, headersOf(req), clientIp(req));
    const ct = String(req.headers['content-type'] || '');
    const raw = await readBody(req, auth.maxBytes + 64 * 1024);
    let bytes; let name;
    if (/^multipart\/form-data/i.test(ct)) {
      let form;
      try { form = await new Response(raw, { headers: { 'content-type': ct } }).formData(); } catch { throw new HttpError(400, 'invalid_form', '파일 형식을 읽을 수 없어요.'); }
      const f = form.get('file');
      if (!f || typeof f === 'string') throw new HttpError(400, 'required', 'file 필드가 필요합니다.');
      bytes = Buffer.from(await f.arrayBuffer()); name = f.name;
    } else {
      bytes = raw; name = decodeURIComponent(String(req.headers['x-lec-filename'] || 'file'));
    }
    const meta = core.checkUpload({ size: bytes.length, head: bytes.subarray(0, 32), name, maxBytes: auth.maxBytes });
    const dir = path.join(opts.data, 'uploads', auth.code);
    await fsp.mkdir(dir, { recursive: true });
    const tmp = path.join(dir, meta.stored + '.part');
    await fsp.writeFile(tmp, bytes, { mode: 0o640 });
    await fsp.rename(tmp, path.join(dir, meta.stored));
    core.recordFile(auth.code, { stored: meta.stored, type: meta.type, size: bytes.length, by: auth.me.id });
    send(res, 201, { url: `/api/${auth.code}/files/${meta.stored}`, name: meta.name, type: meta.type, size: bytes.length }, cors);
  }
  async function serveFile(req, res, code, name, cors) {
    const c = normCode(code);
    const meta = core.fileMeta(c, name);
    if (!meta) throw new HttpError(404, 'not_found', '파일이 없습니다.');
    const file = path.join(opts.data, 'uploads', c, meta.name);
    let st; try { st = await fsp.stat(file); } catch { throw new HttpError(404, 'not_found', '파일이 없습니다.'); }
    const h = {
      ...cors, 'Content-Type': meta.type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=31536000, immutable',
      'Cross-Origin-Resource-Policy': 'cross-origin', 'Accept-Ranges': 'bytes', 'Content-Disposition': 'inline',
    };
    if (meta.type !== 'application/pdf') h['Content-Security-Policy'] = "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox";
    const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : st.size - Number(range[2]);
      let end = range[1] && range[2] ? Number(range[2]) : st.size - 1;
      start = Math.max(0, start); end = Math.min(st.size - 1, end);
      if (start > end) { res.writeHead(416, { ...h, 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { ...h, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...h, 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  }

  // ---- SSE ----
  function openSse(req, res, code, cors) {
    const c = normCode(code);
    const r = room(c);
    if (r.sse.size + r.ws.size > 5000) throw new HttpError(503, 'too_many_connections', '접속이 너무 많습니다.');
    res.writeHead(200, { ...cors, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`retry: 3000\n:${' '.repeat(2048)}\n\n`); // padding defeats buffering proxies
    res.write(`data: ${JSON.stringify({ type: 'hello', now: Date.now(), mode: 'sse', protocol: PROTOCOL })}\n\n`);
    r.sse.add(res);
    req.socket.setKeepAlive(true, 30_000);
    const done = () => { r.sse.delete(res); dropRoom(c); };
    req.on('close', done); res.on('error', done);
  }

  // ---- static ----
  async function serveStatic(req, res, pathname) {
    if (!opts.staticDir) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
      return res.end('<!doctype html><meta charset="utf-8"><title>lecpage live</title><p>lecpage 실시간 서버가 켜져 있습니다. API: <code>/api/&lt;연수코드&gt;/snapshot</code></p>');
    }
    let rel;
    try { rel = decodeURIComponent(pathname); } catch { return send(res, 400, { error: 'bad_path' }); }
    if (rel.includes('\0')) return send(res, 400, { error: 'bad_path' });
    let file = path.resolve(opts.staticDir, '.' + path.posix.normalize('/' + rel));
    if (file !== opts.staticDir && !file.startsWith(opts.staticDir + path.sep)) return send(res, 403, { error: 'forbidden' });
    let st = await fsp.stat(file).catch(() => null);
    if (st && st.isDirectory()) { file = path.join(file, 'index.html'); st = await fsp.stat(file).catch(() => null); }
    if (!st && !path.extname(file)) { const f2 = file + '.html'; const s2 = await fsp.stat(f2).catch(() => null); if (s2) { file = f2; st = s2; } }
    if (!st || !st.isFile() || isPrivateFile(path.relative(opts.staticDir, file))) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not found'); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size, 'X-Content-Type-Options': 'nosniff',
      'Cache-Control': ext === '.html' || ext === '.json' ? 'no-cache' : 'public, max-age=3600', 'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  }

  // ---- request handler ----
  const server = http.createServer(async (req, res) => {
    const t0 = Date.now();
    let url; try { url = new URL(req.url, 'http://x'); } catch { return send(res, 400, { error: 'bad_url' }); }
    const p = url.pathname;
    const cors = p.startsWith('/api/') ? corsHeaders(req) : {};
    res.on('finish', () => log(req.method, p.replace(/\/files\/[^/]+$/, '/files/*'), res.statusCode, Date.now() - t0 + 'ms'));
    try {
      if (!p.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method_not_allowed' });
        return await serveStatic(req, res, p);
      }
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
      if (!originAllowed(req) && req.method !== 'GET') throw new HttpError(403, 'origin_not_allowed', '허용되지 않은 사이트에서 온 요청입니다.');
      const parts = p.slice(5).split('/').filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
      if (parts[0] === 'health' && parts.length === 1) return send(res, 200, { ok: true, version: VERSION, protocol: PROTOCOL, uploads: opts.uploads }, cors);
      if (!parts.length) throw new HttpError(404, 'not_found', '없는 주소입니다.');
      const [code, a, b] = parts;
      if (a === 'events' && parts.length === 2 && req.method === 'GET') return openSse(req, res, code, cors);
      if (a === 'ws') throw new HttpError(426, 'upgrade_required', 'WebSocket으로 연결하세요.');
      if (a === 'upload' && parts.length === 2 && req.method === 'POST') return await handleUpload(req, res, code, cors);
      if (a === 'files' && b && parts.length === 3 && (req.method === 'GET' || req.method === 'HEAD')) return await serveFile(req, res, code, b, cors);
      const body = await readJson(req);
      const out = await core.handle({ method: req.method, code, rest: parts.slice(1), query: url.searchParams, headers: headersOf(req), body, ip: clientIp(req) });
      const c = normCode(code);
      if (out.events) broadcast(c, out.events);
      if (out.reaction) addReaction(c, out.reaction);
      if (out.purgedFiles) await fsp.rm(path.join(opts.data, 'uploads', c), { recursive: true, force: true });
      if (out.contentType) {
        res.writeHead(out.status, { ...cors, 'Content-Type': out.contentType, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `attachment; filename="${out.filename || 'export.csv'}"` });
        return res.end(out.body);
      }
      return send(res, out.status, out.body, cors);
    } catch (e) {
      const { status, body, retryAfter } = errorBody(e);
      if (status >= 500) log('error', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e));
      if (res.headersSent) { try { res.end(); } catch { /* ignore */ } return; }
      // drain the rest of an oversized body so the client sees the 413
      if (status === 413) req.resume();
      return send(res, status, body, { ...cors, ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}) });
    }
  });
  server.headersTimeout = 30_000;
  server.requestTimeout = 120_000;
  server.keepAliveTimeout = 65_000;

  // ---- WebSocket upgrade ----
  server.on('upgrade', (req, socket, head) => {
    let url; try { url = new URL(req.url, 'http://x'); } catch { return socket.destroy(); }
    const m = /^\/api\/([^/]+)\/ws$/.exec(url.pathname);
    let code;
    try { code = m && normCode(decodeURIComponent(m[1])); } catch { code = null; }
    if (!code || !originAllowed(req)) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
    const r = room(code);
    if (r.sse.size + r.ws.size > 5000) { socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n'); return; }
    const ws = acceptWebSocket(req, socket, head, {
      onMessage: async (w, msg) => {
        if (msg === 'ping') return w.send('pong');
        let o; try { o = JSON.parse(msg); } catch { return; }
        if (o && o.type === 'auth' && typeof o.admin === 'string' && o.admin.length <= 200) {
          const t = core.training(code);
          const ok = core.isAdmin(t, { adminHash: await sha256hex(o.admin) });
          w.attachment.admin = ok;
          w.send(JSON.stringify({ type: 'auth', ok }));
        } else if (o && o.type === 'ping') w.send(JSON.stringify({ type: 'pong', now: Date.now() }));
      },
      onClose: (w) => { r.ws.delete(w); dropRoom(code); },
    });
    if (!ws) return;
    r.ws.add(ws);
    ws.send(JSON.stringify({ type: 'hello', now: Date.now(), mode: 'ws', protocol: PROTOCOL }));
  });

  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(opts.port, opts.host, resolve); });
  const port = server.address().port;
  if (!opts.quiet || opts.announce) console.log(JSON.stringify({ lecpage: 'live', listening: port, static: opts.staticDir || null, uploads: opts.uploads, origins: allowAny ? '*' : opts.origins }));
  return {
    server, port, core, url: `http://127.0.0.1:${port}`,
    async close() {
      clearInterval(pingTimer); clearInterval(cleanupTimer);
      for (const [, r] of rooms) { if (r.timer) clearTimeout(r.timer); for (const res of r.sse) res.end(); for (const ws of r.ws) ws.close(1001, 'bye'); }
      await new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections?.(); });
      db.close();
    },
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const opts = readOptions();
  if (opts.hash) {
    sha256hex(String(opts.hash)).then((h) => console.log(h));
  } else {
    start(opts).then((s) => {
      const stop = async () => { await s.close(); process.exit(0); };
      process.on('SIGINT', stop); process.on('SIGTERM', stop);
    }).catch((e) => { console.error('시작하지 못했습니다:', e.message); process.exit(1); });
  }
}
