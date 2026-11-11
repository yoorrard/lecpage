// R2 없이 파일 올리기: 실시간 방(Room)의 SQLite에 1MiB씩 나눠 담는 저장소.
// 실시간 서버 코드(skills/lecpage/backends/cloudflare/src/index.js)가 R2 버킷에 쓰는 만큼만 흉내 냅니다:
//   put(key, bytes, { httpMetadata: { contentType } })   get(key, { range: Headers })   delete(key | key[])   list({ prefix, cursor })
// 표는 처음 put 할 때 생깁니다. 읽기·지우기·목록은 표가 없으면 아무것도 쓰지 않습니다.
import { HttpError } from '../../../skills/lecpage/backends/cloudflare/src/protocol.js';
import { parseRange } from '../csp.js';
import { hex } from '../ids.js';

export const CHUNK = 1024 * 1024;
const TABLE = 'host_file';
const SCHEMA = `CREATE TABLE IF NOT EXISTS ${TABLE} (key TEXT NOT NULL, i INTEGER NOT NULL, size INTEGER, type TEXT, etag TEXT, at INTEGER, data BLOB NOT NULL, PRIMARY KEY (key, i)) WITHOUT ROWID`;

function toBytes(v) {
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  if (typeof v === 'string') return new TextEncoder().encode(v);
  throw new TypeError('bucket.put: 바이트나 글자열만 받아요');
}

export class SqlBucket {
  /**
   * @param {{ exec(query: string, ...params: any[]): { toArray(): any[] } }} sql Durable Object의 ctx.storage.sql과 같은 모양
   * @param {{ maxObjectBytes: number, maxTotalBytes: number, tx?: (fn: () => void) => void }} opts
   */
  constructor(sql, { maxObjectBytes, maxTotalBytes, tx } = {}) {
    this.sql = sql;
    this.maxObjectBytes = maxObjectBytes || 10 * CHUNK;
    this.maxTotalBytes = maxTotalBytes || 200 * CHUNK;
    this.tx = tx || ((fn) => fn());
    this.ready = false;
  }
  rows(q, ...p) { return this.sql.exec(q, ...p).toArray(); }
  hasTable() {
    if (!this.ready) this.ready = this.rows(`SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?`, TABLE).length > 0;
    return this.ready;
  }
  /** 저장한 파일 수와 크기 합 */
  usage() {
    if (!this.hasTable()) return { count: 0, bytes: 0 };
    const r = this.rows(`SELECT COUNT(*) AS count, COALESCE(SUM(size), 0) AS bytes FROM ${TABLE} WHERE i = 0`)[0];
    return { count: r.count, bytes: r.bytes };
  }

  async put(key, value, opts = {}) {
    const bytes = toBytes(value);
    const k = String(key);
    if (bytes.byteLength > this.maxObjectBytes) throw new HttpError(413, 'too_large', `파일은 ${Math.floor(this.maxObjectBytes / CHUNK)}MB까지 올릴 수 있어요.`, { max: this.maxObjectBytes });
    const etag = hex(await crypto.subtle.digest('SHA-256', bytes)).slice(0, 32);
    if (!this.hasTable()) { this.rows(SCHEMA); this.ready = true; }
    const old = this.rows(`SELECT size FROM ${TABLE} WHERE key = ? AND i = 0`, k)[0];
    if (this.usage().bytes - (old ? old.size : 0) + bytes.byteLength > this.maxTotalBytes) {
      throw new HttpError(507, 'storage_full', `이 연수에 올릴 수 있는 파일 용량(${Math.floor(this.maxTotalBytes / CHUNK)}MB)이 가득 찼어요. 강사에게 알려 주세요.`);
    }
    const type = (opts.httpMetadata && opts.httpMetadata.contentType) || 'application/octet-stream';
    const n = Math.max(1, Math.ceil(bytes.byteLength / CHUNK));
    this.tx(() => {
      this.rows(`DELETE FROM ${TABLE} WHERE key = ?`, k);
      for (let i = 0; i < n; i++) {
        // 줄마다 따로 복사한 조각을 넣음(큰 버퍼의 일부를 가리키는 뷰를 그대로 넘기지 않음)
        const part = bytes.slice(i * CHUNK, Math.min(bytes.byteLength, (i + 1) * CHUNK));
        if (i === 0) this.rows(`INSERT INTO ${TABLE} (key, i, size, type, etag, at, data) VALUES (?, 0, ?, ?, ?, ?, ?)`, k, bytes.byteLength, type, etag, Date.now(), part);
        else this.rows(`INSERT INTO ${TABLE} (key, i, data) VALUES (?, ?, ?)`, k, i, part);
      }
    });
    return { key: k, size: bytes.byteLength, etag, httpEtag: `"${etag}"`, httpMetadata: { contentType: type } };
  }

  /** @returns {Promise<null | { key, size, etag, httpEtag, httpMetadata, range?, body: ReadableStream|Uint8Array, arrayBuffer(): Promise<ArrayBuffer> }>} */
  async get(key, opts = {}) {
    if (!this.hasTable()) return null;
    const k = String(key);
    const head = this.rows(`SELECT size, type, etag FROM ${TABLE} WHERE key = ? AND i = 0`, k)[0];
    if (!head) return null;
    const size = head.size;
    let start = 0; let end = size - 1; let range;
    const r = opts.range;
    if (r && typeof r.get === 'function') {
      const p = parseRange(r.get('range'), size);
      if (p && p !== 'invalid') { start = p.start; end = p.end; range = { offset: start, length: end - start + 1 }; }
    } else if (r && typeof r === 'object') {
      if (Number.isInteger(r.suffix) && r.suffix > 0) start = Math.max(0, size - r.suffix);
      else { start = Math.min(Math.max(0, r.offset || 0), size); if (Number.isInteger(r.length)) end = Math.min(size - 1, start + r.length - 1); }
      if (start <= end) range = { offset: start, length: end - start + 1 };
    }
    const read = () => this.read(k, start, end);
    const obj = { key: k, size, etag: head.etag, httpEtag: `"${head.etag}"`, httpMetadata: { contentType: head.type }, arrayBuffer: async () => concat([...read()]).buffer };
    if (range) obj.range = range;
    const it = read();
    const stream = new ReadableStream({
      pull(c) { const x = it.next(); if (x.done) c.close(); else c.enqueue(x.value); },
    });
    // Workers에서는 길이를 아는 흐름으로 감싸야 Content-Length가 나감
    obj.body = typeof FixedLengthStream === 'function' ? stream.pipeThrough(new FixedLengthStream(Math.max(0, end - start + 1))) : stream;
    return obj;
  }
  /** key의 [start, end] 바이트를 줄 단위로 */
  *read(key, start, end) {
    if (end < start) return;
    const last = Math.floor(end / CHUNK);
    for (let i = Math.floor(start / CHUNK); i <= last; i++) {
      const row = this.rows(`SELECT data FROM ${TABLE} WHERE key = ? AND i = ?`, key, i)[0];
      if (!row) throw new Error('파일 조각이 없어요');
      const u = new Uint8Array(row.data); const base = i * CHUNK;
      const a = Math.max(start - base, 0); const b = Math.min(end - base + 1, u.length);
      yield a === 0 && b === u.length ? u : u.subarray(a, b);
    }
  }

  async delete(keys) {
    if (!this.hasTable()) return;
    for (const k of Array.isArray(keys) ? keys : [keys]) this.rows(`DELETE FROM ${TABLE} WHERE key = ?`, String(k));
  }

  async list({ prefix = '', cursor, limit = 1000 } = {}) {
    if (!this.hasTable()) return { objects: [], truncated: false };
    const after = cursor ? String(cursor) : '';
    const n = Math.min(Math.max(1, limit), 1000);
    // LIKE는 쓰지 않음(%·_가 든 이름, DO SQLite의 LIKE 길이 제한)
    const rows = this.rows(`SELECT key, size, etag FROM ${TABLE} WHERE i = 0 AND key > ? AND substr(key, 1, ?) = ? ORDER BY key LIMIT ?`, after, [...String(prefix)].length, String(prefix), n + 1);
    const page = rows.slice(0, n);
    const truncated = rows.length > n;
    return { objects: page.map((r) => ({ key: r.key, size: r.size, etag: r.etag, httpEtag: `"${r.etag}"` })), truncated, ...(truncated ? { cursor: page[page.length - 1].key } : {}) };
  }
}

function concat(parts) {
  let n = 0; for (const p of parts) n += p.byteLength;
  const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.byteLength; }
  return out;
}
