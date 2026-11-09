// Minimal RFC 6455 WebSocket server side for lecpage (text frames, ping/pong, close).
// No dependencies. Server → client frames are unmasked; client → server frames must be masked.
// Messages from clients are tiny ("ping", {"type":"auth"...}), so payloads above 64 KB close the socket.
import { createHash } from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_IN = 64 * 1024;

export function acceptWebSocket(req, socket, head, { onMessage, onClose } = {}) {
  const key = req.headers['sec-websocket-key'];
  const version = req.headers['sec-websocket-version'];
  if (!key || version !== '13' || String(req.headers.upgrade || '').toLowerCase() !== 'websocket') {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    return null;
  }
  const accept = createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' + `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);
  socket.setKeepAlive(true, 30_000);

  let buf = head && head.length ? Buffer.from(head) : Buffer.alloc(0);
  let closed = false;
  let fragments = null;
  const ws = {
    attachment: {},
    get open() { return !closed; },
    send(text) {
      if (closed) return;
      const data = Buffer.from(String(text), 'utf8');
      socket.write(Buffer.concat([frameHeader(0x1, data.length), data]));
    },
    close(code = 1000, reason = '') {
      if (closed) return;
      const r = Buffer.from(reason, 'utf8').subarray(0, 120);
      const p = Buffer.alloc(2 + r.length); p.writeUInt16BE(code, 0); r.copy(p, 2);
      try { socket.write(Buffer.concat([frameHeader(0x8, p.length), p])); } catch { /* ignore */ }
      finish();
      setTimeout(() => socket.destroy(), 500).unref?.();
    },
  };
  function finish() {
    if (closed) return;
    closed = true;
    try { onClose && onClose(ws); } catch { /* ignore */ }
  }
  socket.on('data', (chunk) => {
    buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
    if (buf.length > MAX_IN + 16) return ws.close(1009, 'too big');
    for (;;) {
      if (buf.length < 2) return;
      const b0 = buf[0]; const b1 = buf[1];
      const fin = (b0 & 0x80) !== 0; const op = b0 & 0x0f; const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f; let off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; const hi = buf.readUInt32BE(2); len = hi ? Infinity : buf.readUInt32BE(6); off = 10; }
      if (!masked || len > MAX_IN) return ws.close(1002, 'protocol');
      if (buf.length < off + 4 + len) return;
      const mask = buf.subarray(off, off + 4);
      const payload = Buffer.from(buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      buf = buf.subarray(off + 4 + len);
      if (op === 0x8) { ws.close(1000); return; }
      if (op === 0x9) { if (!closed) socket.write(Buffer.concat([frameHeader(0xA, payload.length), payload])); continue; }
      if (op === 0xA) continue;
      if (op === 0x1 || op === 0x2 || op === 0x0) {
        if (op !== 0x0) fragments = [];
        if (!fragments) return ws.close(1002, 'protocol');
        fragments.push(payload);
        if (fragments.reduce((n, f) => n + f.length, 0) > MAX_IN) return ws.close(1009, 'too big');
        if (fin) {
          const msg = Buffer.concat(fragments).toString('utf8'); fragments = null;
          try { onMessage && onMessage(ws, msg); } catch { /* ignore */ }
        }
        continue;
      }
      return ws.close(1003, 'unsupported');
    }
  });
  socket.on('close', finish);
  socket.on('end', finish);
  socket.on('error', finish);
  return ws;
}

function frameHeader(op, n) {
  if (n < 126) return Buffer.from([0x80 | op, n]);
  if (n < 65536) { const h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(n, 2); return h; }
  const h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeUInt32BE(Math.floor(n / 2 ** 32), 2); h.writeUInt32BE(n >>> 0, 6); return h;
}
