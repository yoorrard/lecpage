// 브라우저 안 저장소(IndexedDB). 운영자 서버에는 아무것도 보내지 않습니다.
const DB_NAME = 'lecpage';
const VERSION = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then((v) => { out = v; });
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const projects = {
  all: () => tx('projects', 'readonly', (s) => req(s.getAll())).then((a) => (a || []).sort((x, y) => (y.updatedAt || 0) - (x.updatedAt || 0))),
  get: (id) => tx('projects', 'readonly', (s) => req(s.get(id))),
  put: (p) => tx('projects', 'readwrite', (s) => req(s.put({ ...p, updatedAt: Date.now() }))),
  remove: async (id) => {
    await tx('projects', 'readwrite', (s) => req(s.delete(id)));
    const keys = await blobs.keys(id);
    await tx('blobs', 'readwrite', (s) => Promise.all(keys.map((k) => req(s.delete(id + ':' + k)))));
  },
};

export const blobs = {
  put: (pid, path, data) => tx('blobs', 'readwrite', (s) => req(s.put(data, pid + ':' + path))),
  get: (pid, path) => tx('blobs', 'readonly', (s) => req(s.get(pid + ':' + path))),
  keys: (pid) => tx('blobs', 'readonly', (s) => req(s.getAllKeys(IDBKeyRange.bound(pid + ':', pid + ':￿')))).then((ks) => ks.map((k) => String(k).slice(pid.length + 1))),
  all: async (pid) => {
    const keys = await blobs.keys(pid);
    const out = {};
    for (const k of keys) {
      const v = await blobs.get(pid, k);
      out[k] = v instanceof Blob ? new Uint8Array(await v.arrayBuffer()) : v;
    }
    return out;
  },
  remove: (pid, path) => tx('blobs', 'readwrite', (s) => req(s.delete(pid + ':' + path))),
  removePrefix: async (pid, prefix) => {
    const keys = (await blobs.keys(pid)).filter((k) => k.startsWith(prefix));
    await tx('blobs', 'readwrite', (s) => Promise.all(keys.map((k) => req(s.delete(pid + ':' + k)))));
    return keys.length;
  },
};

export const kv = {
  get: (k) => tx('kv', 'readonly', (s) => req(s.get(k))),
  set: (k, v) => tx('kv', 'readwrite', (s) => req(s.put(v, k))),
  del: (k) => tx('kv', 'readwrite', (s) => req(s.delete(k))),
};

export async function storageInfo() {
  let persisted = false, usage = 0, quota = 0;
  try { persisted = await navigator.storage?.persisted?.(); } catch { }
  try { const e = await navigator.storage?.estimate?.(); usage = e?.usage || 0; quota = e?.quota || 0; } catch { }
  return { persisted, usage, quota };
}
export async function askPersist() { try { return await navigator.storage?.persist?.(); } catch { return false; } }
