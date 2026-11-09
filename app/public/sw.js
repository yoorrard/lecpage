// lecpage 앱 오프라인 지원: 페이지는 네트워크 우선, 빌드 자산(이름에 해시가 붙은 파일)은 캐시 우선
// 보안: 같은 출처의 정상 응답만, 주소에 ?가 붙은 페이지(로그인 복귀 등)는 저장하지 않음, 오래된 자산은 정리
const CACHE = 'lecpage-app-v2';
const MAX_ASSETS = 160;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
const okToStore = (res) => res && res.ok && res.type === 'basic';
async function trim(cache) {
  const keys = await cache.keys();
  const assets = keys.filter((r) => new URL(r.url).pathname.includes('/assets/'));
  for (const r of assets.slice(0, Math.max(0, assets.length - MAX_ASSETS))) await cache.delete(r);
}
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return;
  if (r.mode === 'navigate') {
    const shell = new URL('./', self.registration.scope).href;
    e.respondWith(fetch(r).then((res) => {
      if (okToStore(res) && !u.search) { const c = res.clone(); caches.open(CACHE).then((ca) => ca.put(shell, c)); }
      return res;
    }).catch(() => caches.match(shell)));
    return;
  }
  if (u.pathname.includes('/assets/')) {
    e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => {
      if (okToStore(res)) { const c = res.clone(); caches.open(CACHE).then((ca) => ca.put(r, c).then(() => trim(ca))); }
      return res;
    })));
  }
});
