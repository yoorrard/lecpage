// 작업 기록 저장소(약속 D): IndexedDB 'lecpage-gen' 데이터베이스의 'jobs'(연수마다 마지막 작업 하나, 열쇠 pid)와
// 'chat'(쓰던 AI 창에서 받는 중인 답 조각). 앱 저장소('lecpage')와 따로 둔 까닭: 판 번호를 올리면 예전 판을 연 탭이
// 새 탭의 열기를 막아(onversionchange가 없던 판) 앱이 멈출 수 있어서. 키·비밀 값은 담지 않음.
const NAME = 'lecpage-gen';
let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('jobs')) db.createObjectStore('jobs', { keyPath: 'pid' });
      if (!db.objectStoreNames.contains('chat')) db.createObjectStore('chat', { keyPath: 'pid' });
    };
    req.onsuccess = () => { const db = req.result; db.onversionchange = () => { db.close(); dbp = null; }; resolve(db); };
    req.onerror = () => { dbp = null; reject(req.error); };
  });
  return dbp;
}
function tx(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode); const s = t.objectStore(store);
    let out;
    const r = fn(s);
    if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}
const table = (name) => ({
  get: (pid) => tx(name, 'readonly', (s) => s.get(pid)),
  put: (rec) => tx(name, 'readwrite', (s) => s.put(rec)),
  del: (pid) => tx(name, 'readwrite', (s) => s.delete(pid)),
  all: () => tx(name, 'readonly', (s) => s.getAll()),
});
export const jobsDb = table('jobs');
export const chatDb = table('chat');
