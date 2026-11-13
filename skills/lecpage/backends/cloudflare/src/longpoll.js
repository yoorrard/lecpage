// lecpage live — long-poll for school networks that block WebSockets and SSE (Cloudflare Worker + Durable Object).
// GET snapshot?since=<cursor>&wait=<s>: with nothing new, the answer waits until something changes (at most 25 s).
// The Worker does the waiting (relayWait) while the room object sleeps. Shared by backends/cloudflare/src/index.js and
// the hosting server (hosting/src). Kept out of index.js: a Worker's entry module may export only handlers and classes.
/** Longest wait of one long-poll (shorter than the runtime's request timeout) and waiters per room. */
export const MAX_WAIT_S = 25;
export const MAX_WAITERS = 600;
/** Did a snapshot answer bring anything after `since` (docs, removals, state)? */
export function snapshotChanged(body, since) {
  if (!body || typeof body !== 'object') return true;
  if (body.full || (Array.isArray(body.removed) && body.removed.length)) return true;
  if (body.state && Number(body.state.updatedAt) > since) return true;
  for (const [k, v] of Object.entries(body)) if (k !== 'removed' && Array.isArray(v) && v.length) return true;
  return false;
}
/** GET …/snapshot?since=<cursor>&wait=<s> */
export function isLongPoll(method, url) {
  return method === 'GET' && /\/snapshot$/.test(url.pathname) && Number(url.searchParams.get('since')) > 0 && Number(url.searchParams.get('wait')) > 0;
}
/** Poll gap the runtime keeps (X-Lec-Poll-Ms): 7 s, longer for big rooms (300 participants → 18 s). */
export const pollGapMs = (participants) => Math.max(7000, Math.round((participants || 0) * 60));
/**
 * The Worker waits for the room (Workers bill requests and CPU, not waiting time; the room sleeps, so no Durable Object
 * duration). The room answers 101 + a WebSocket whose first message is the current (unchanged) snapshot; when something
 * changes it sends 'c' and closes, and the Worker asks once more. Time up → the first snapshot. Any other answer as is.
 * onSocket(): called when the room handed a socket (the host counts it).
 */
export async function relayWait(stub, fwd, waitS, onSocket) {
  const h = new Headers(fwd.headers);
  h.set('upgrade', 'websocket'); h.set('x-lp-relay', '1');
  const res = await stub.fetch(new Request(fwd.url, { method: 'GET', headers: h }));
  const ws = res.webSocket;
  if (res.status !== 101 || !ws) return res;
  if (onSocket) onSocket();
  const gap = res.headers.get('x-lec-poll-ms');
  ws.accept();
  const CHANGED = Symbol('changed');
  const got = await new Promise((resolve) => {
    let first = null; let over = false;
    const finish = (v) => { if (over) return; over = true; clearTimeout(timer); try { ws.close(1000, 'done'); } catch { /* closed */ } resolve(v); };
    const timer = setTimeout(() => finish(first ?? CHANGED), Math.min(MAX_WAIT_S, Math.max(1, waitS)) * 1000);
    ws.addEventListener('message', (m) => { if (first === null && typeof m.data === 'string' && m.data !== 'c') first = m.data; else finish(CHANGED); });
    ws.addEventListener('close', () => finish(CHANGED));
    ws.addEventListener('error', () => finish(CHANGED));
  });
  if (got !== CHANGED) {
    return new Response(got, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...(gap ? { 'x-lec-poll-ms': String(gap) } : {}) } });
  }
  const plain = new URL(fwd.url); plain.searchParams.delete('wait');
  return stub.fetch(new Request(plain, { method: 'GET', headers: fwd.headers }));
}

