// 브라우저 안 저장소(IndexedDB). 운영자 서버에는 아무것도 보내지 않습니다.
const DB_NAME = 'lecpage';
const VERSION = 1;
let dbp = null;
let blocked = null; // 저장소를 열지 못한 까닭(사생활 보호 창·사이트 데이터 차단·기관 정책). 한 번 실패하면 이 탭에서는 다시 열지 않음

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onblocked = () => { /* 예전 판을 연 다른 탭이 닫히기를 기다림(지금은 판이 하나라 생기지 않음) */ };
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((e) => { blocked = e || new Error('indexedDB'); throw Object.assign(blocked, { storage: 'blocked' }); });
  return dbp;
}

/** 이 창에서 브라우저 저장소를 쓸 수 없는지(앱을 열 때 한 번 시험). true면 연수를 만들거나 열 수 없음 → 안내 띠(main.jsx) */
export const storageBlocked = () => open().then(() => false, () => true);

/**
 * 저장 오류 → 'quota'(저장 공간이 꽉 참) | 'blocked'(이 창은 저장이 막힘) | ''(그 밖)
 * 강사에게는 영어 원문 대신 이 종류에 맞는 안내(STORAGE_MSG)를 보임
 */
export function storageKind(e) {
  if (!e) return '';
  if (e.storage === 'blocked' || blocked) return 'blocked';
  if (e.name === 'QuotaExceededError' || e.code === 22 || /quota|storage.*full|disk.*full/i.test(String(e.message || ''))) return 'quota';
  // 파일(Blob) 저장을 막는 창(일부 브라우저의 사생활 보호 창): 저장소는 열리지만 교재·쪽 그림을 넣을 때 거절됨
  if (/Blob\/File data|preparing Blob/i.test(String(e.message || ''))) return 'blocked';
  return '';
}
export const STORAGE_MSG = {
  quota: '이 브라우저의 저장 공간이 꽉 찼어요. 설정에서 안 쓰는 연수를 파일로 저장한 뒤 지워 주세요.',
  blocked: '이 창은 브라우저 저장이 막혀 있어요. 일반 창에서 열거나 브라우저 설정에서 이 사이트의 데이터 저장을 허용해 주세요.',
};

// 탭 사이 알림(같은 브라우저의 다른 탭): 연수를 저장하거나 지우면 id와 판(updatedAt)만 알림.
// 같은 연수를 연 다른 탭은 덮어쓰지 않고 '다른 탭에서 고쳤어요'를 띄움(Project.jsx). 내용은 보내지 않음
let bc = null;
try { bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel('lecpage') : null; } catch { bc = null; }
const hear = new Set();
if (bc) bc.onmessage = (e) => { const m = e.data; if (m?.type === 'wiped') return wipedElsewhere(); if (m && m.id) hear.forEach((f) => f(m)); };
const tell = (m) => { try { bc?.postMessage(m); } catch { /* 알림만 못 함 */ } };
/** 다른 탭에서 연수를 저장(type 'saved', at)하거나 지웠을 때(type 'deleted') */
export function onProjectChange(f) { hear.add(f); return () => hear.delete(f); }

/** 거래가 실패한 까닭. onerror는 거래가 끝나기 전에 불려 t.error가 아직 null일 수 있음(그때는 실패한 요청의 오류).
 * 늘 Error를 돌려줌: null로 거절하면 받는 쪽의 e.kind·e.name에서 다시 오류가 나 '읽는 중'이 끝나지 않고 남음(Blob 저장을 막는 브라우저에서 실제로 멈췄음) */
const txError = (t, ev, thrown) => thrown || t.error || ev?.target?.error || new Error('브라우저 저장소에 쓰지 못했어요.');
function tx(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then((v) => { out = v; });
    t.oncomplete = () => resolve(out);
    t.onerror = (ev) => reject(txError(t, ev));
    t.onabort = (ev) => reject(txError(t, ev));
  }));
}
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error('브라우저 저장소에서 읽지 못했어요.')); });

export const projects = {
  all: () => tx('projects', 'readonly', (s) => req(s.getAll())).then((a) => (a || []).sort((x, y) => (y.updatedAt || 0) - (x.updatedAt || 0))),
  get: (id) => tx('projects', 'readonly', (s) => req(s.get(id))),
  put: (p) => { const at = Math.max(Date.now(), (p.updatedAt || 0) + 1); return tx('projects', 'readwrite', (s) => req(s.put({ ...p, updatedAt: at }))).then((k) => { tell({ type: 'saved', id: p.id, at }); return k; }); },
  /**
   * 연수 화면의 자동 저장: 이 탭이 마지막으로 읽거나 쓴 판(base) 위에만 씀(읽기와 쓰기를 한 트랜잭션에서).
   * 그 사이 다른 탭이 고쳤으면 { changed }, 지웠으면 { gone }을 돌려주고 쓰지 않음(덮어쓰거나 지운 연수를 되살리지 않게). 썼으면 { at }
   */
  save: (p, base) => open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction('projects', 'readwrite'); const s = t.objectStore('projects');
    let out = null; let thrown = null;
    const g = s.get(p.id);
    g.onsuccess = () => {
      const cur = g.result;
      if (!cur) { out = { gone: true }; return; }
      if ((cur.updatedAt || 0) > (base || 0)) { out = { changed: true, at: cur.updatedAt }; return; }
      const at = Math.max(Date.now(), (cur.updatedAt || 0) + 1);
      try { s.put({ ...p, updatedAt: at }); out = { at }; } catch (e) { thrown = e; try { t.abort(); } catch { /* 이미 끝남 */ } }
    };
    t.oncomplete = () => { if (out?.at && !out.changed) tell({ type: 'saved', id: p.id, at: out.at }); resolve(out || { gone: true }); };
    t.onerror = (ev) => reject(txError(t, ev, thrown));
    t.onabort = (ev) => reject(txError(t, ev, thrown));
  })),
  /**
   * 한 트랜잭션에서 읽고 고쳐 씀: fn(지금 판) → 바꿀 칸(동기, 없으면 쓰지 않음). 연수가 없으면 null.
   * AI 생성(lib/gen)이 사이트·연수 정보·판 기록만 바꿀 때(다른 칸은 그대로). 다른 탭에는 'saved'로 알림
   */
  patch: (id, fn) => open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction('projects', 'readwrite'); const s = t.objectStore('projects');
    let out = null; let thrown = null;
    const g = s.get(id);
    g.onsuccess = () => {
      const cur = g.result; if (!cur) return;
      try {
        const ch = fn(cur); if (!ch) return;
        out = { ...cur, ...ch, id, updatedAt: Math.max(Date.now(), (cur.updatedAt || 0) + 1) };
        s.put(out);
      } catch (e) { thrown = e; out = null; try { t.abort(); } catch { /* 이미 끝남 */ } }
    };
    t.oncomplete = () => { if (out) tell({ type: 'saved', id, at: out.updatedAt }); resolve(out); };
    t.onerror = (ev) => reject(txError(t, ev, thrown));
    t.onabort = (ev) => reject(txError(t, ev, thrown));
  })),
  remove: async (id) => {
    await tx('projects', 'readwrite', (s) => req(s.delete(id)));
    tell({ type: 'deleted', id });
    const keys = await blobs.keys(id);
    await tx('blobs', 'readwrite', (s) => Promise.all(keys.map((k) => req(s.delete(id + ':' + k)))));
    await kv.del('undo:' + id).catch(() => { }); // 예전 판의 'AI로 만들기 전' 되돌리기(지금은 판 기록이 연수 안에 있음)
    // AI 작업 기록(lib/gen). 그 작업이 OpenAI에 남긴 답(store:true)도 지움(키가 없으면 다음에 키가 있을 때, gen/oa-trash.js)
    await import('./gen/store.js').then(async (m) => {
      const rec = await m.jobsDb.get(id).catch(() => null);
      if (rec?.provider === 'openai') await import('./gen/oa-trash.js').then((t) => t.trash(t.idsOf(rec))).catch(() => { });
      await Promise.all([m.jobsDb.del(id), m.chatDb.del(id)]);
    }).catch(() => { });
  },
};

const BLOB_FROM = 32 * 1024 * 1024;
const bigAsBlob = (v) => ((v instanceof Uint8Array || v instanceof ArrayBuffer) && v.byteLength > BLOB_FROM && typeof Blob !== 'undefined' ? new Blob([v]) : v);

export const blobs = {
  // 큰 바이트(교재 원본 등)는 Blob으로 담음: Chromium은 한 값이 약 127MiB(133,169,152바이트)를 넘으면 받지 않고("serialized … too large"),
  // Blob은 값 밖에 따로 두어 그 한도에 걸리지 않음(실측 2026-11-24). 꺼낼 때 Blob일 수 있으니 읽는 쪽은 Blob·바이트 둘 다 받음(all()은 바이트로 돌려줌)
  put: (pid, path, data) => tx('blobs', 'readwrite', (s) => req(s.put(bigAsBlob(data), pid + ':' + path))),
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

/**
 * [모든 데이터 삭제]: 이 브라우저의 lecpage 저장소를 통째로 비움(AI 키·배포 토큰·참여 기능 관리자 키·기억한 서버·암호화 열쇠·남은 파일까지).
 * AI 작업 기록 저장소(IndexedDB lecpage-gen)에 연수 없이 남은 기록도 지우고, 열려 있는 다른 탭에 알림(그 탭은 처음 화면으로 새로 고침)
 */
export async function wipeStores() {
  for (const name of ['projects', 'blobs', 'kv']) await tx(name, 'readwrite', (s) => req(s.clear()));
  await import('./gen/store.js').then(async (m) => {
    for (const t of [m.jobsDb, m.chatDb]) for (const r of await t.all().catch(() => []) || []) await t.del(r.pid).catch(() => { });
  }).catch(() => { });
  tell({ type: 'wiped' });
}
/** 다른 탭에서 [모든 데이터 삭제]를 누름: 이 탭의 메모리(AI 키·열어 둔 연수·도는 작업)와 탭 저장소에 남은 것도 버리게 처음 화면으로 새로 고침 */
function wipedElsewhere() {
  try { for (const k of Object.keys(sessionStorage)) if (/^(lecpage[:-]|lp-)/.test(k)) sessionStorage.removeItem(k); } catch { /* 저장소가 막힘 */ }
  try { location.hash = '#/'; location.reload(); } catch { /* 창이 아님(시험) */ }
}

export async function storageInfo() {
  let persisted = false, usage = 0, quota = 0;
  try { persisted = await navigator.storage?.persisted?.(); } catch { }
  try { const e = await navigator.storage?.estimate?.(); usage = e?.usage || 0; quota = e?.quota || 0; } catch { }
  return { persisted, usage, quota };
}
export async function askPersist() { try { return await navigator.storage?.persist?.(); } catch { return false; } }
