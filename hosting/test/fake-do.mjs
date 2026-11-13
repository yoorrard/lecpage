// Durable Object 흉내(Node에서 Room·저장소 논리를 시험할 때): ctx.storage.sql을 node:sqlite로 바꿔 끼움.
// 실제 workerd에서의 동작은 integration.test.mjs가 확인합니다.
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';

// 'cloudflare:workers' → 빈 DurableObject 바탕 클래스
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cloudflare:workers') return { url: 'data:text/javascript,export class DurableObject{constructor(c,e){this.ctx=c;this.env=e}}', shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
globalThis.WebSocketRequestResponsePair ??= class { constructor(a, b) { this.request = a; this.response = b; } };

/** DO의 sql.exec(query, ...params) → { toArray(), one() } */
export function fakeSql() {
  let db = new DatabaseSync(':memory:');
  const sql = {
    writes: 0,
    exec(query, ...params) {
      if (/^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i.test(query)) sql.writes++;
      // 문장 여럿(표 만들기 등)은 DO처럼 모두 실행
      if (!params.length && /;\s*\S/.test(query.trim().replace(/;\s*$/, ''))) { db.exec(query); return { toArray: () => [], one: () => { throw new Error('one(): 0 rows'); } }; }
      const rows = db.prepare(query).all(...params.map((p) => (p instanceof ArrayBuffer ? new Uint8Array(p) : p)));
      return { toArray: () => rows, one: () => { if (rows.length !== 1) throw new Error(`one(): ${rows.length} rows`); return rows[0]; } };
    },
    get databaseSize() { const g = (q) => Object.values(db.prepare(q).get())[0]; return g('PRAGMA page_count') * g('PRAGMA page_size'); },
    tx(fn) { db.exec('BEGIN'); try { fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } },
    reset() { db.close(); db = new DatabaseSync(':memory:'); },
    tables() { return db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`).all().map((r) => r.name); },
  };
  return sql;
}

export function fakeCtx() {
  const sql = fakeSql();
  let alarm = null;
  const sockets = [];
  return {
    sql, sockets,
    storage: {
      sql,
      transactionSync: (fn) => sql.tx(fn),
      getAlarm: async () => alarm,
      setAlarm: async (t) => { alarm = Number(t); },
      deleteAlarm: async () => { alarm = null; },
      deleteAll: async () => { sql.reset(); },
    },
    get alarm() { return alarm; },
    setWebSocketAutoResponse() { },
    getWebSockets: () => sockets,
    acceptWebSocket() { },
    waitUntil() { },
  };
}

/** env.X.get(env.X.idFromName(name)).fetch(...) 를 받는 가짜 네임스페이스 */
export function fakeNamespace(handler) {
  const calls = [];
  return {
    calls,
    idFromName: (name) => ({ name }),
    get: (id) => ({
      async fetch(input, init) {
        const req = input instanceof Request ? input : new Request(input, init);
        const body = req.method === 'GET' || req.method === 'HEAD' ? null : await req.clone().json().catch(() => null);
        const url = new URL(req.url);
        calls.push({ name: id.name, method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body });
        const out = (await handler({ name: id.name, method: req.method, path: url.pathname, query: url.searchParams, body })) ?? { ok: true };
        return out instanceof Response ? out : new Response(JSON.stringify(out), { status: 200, headers: { 'content-type': 'application/json' } });
      },
    }),
  };
}
