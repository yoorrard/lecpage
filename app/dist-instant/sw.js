// lecpage 앱 오프라인 지원: 페이지는 네트워크 우선, 빌드 자산(이름에 해시가 붙은 파일)은 캐시 우선
// 보안: 같은 출처의 정상 응답만, 주소에 ?가 붙은 페이지(로그인 복귀 등)는 저장하지 않음, 오래된 자산은 정리
// 미리 받기: 연수 화면(#/p)에 처음 들어가면 앱이 'warm'을 보냄 → 빌드 목록(sw-warm.json)의 첫 화면 쉘·만들기 화면·교재 읽기·
// 미리보기 런타임·도움말·설정 조각을 저장(첫 방문 랜딩에서는 하지 않음). 새 배포: 쉘은 네트워크 우선이라 다음 방문에 새 판이 뜨고,
// 해시 이름이 바뀐 새 조각은 받을 때 저장, 예전 조각은 MAX_ASSETS를 넘으면 오래된 것부터 지움(열려 있던 예전 탭이 쓸 수 있게 바로 지우지 않음)
// v3: 예전 판은 예시 사이트(/examples/…/assets/lecpage.css처럼 이름에 해시가 없는 파일)까지 캐시 우선으로 저장해,
// 엔진이 바뀐 뒤 새 HTML에 옛 CSS가 붙어 예시 사이트가 깨져 보였음 → 판을 올려 옛 캐시를 지우고, 앱 빌드 자산만 캐시 우선으로
const CACHE = 'lecpage-app-v3';
const MAX_ASSETS = 160;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
const okToStore = (res) => res && res.ok && res.type === 'basic';
async function trim(cache) {
  const keys = await cache.keys();
  const assets = keys.filter((r) => /\/assets\/[^/]+$/.test(new URL(r.url).pathname));
  for (const r of assets.slice(0, Math.max(0, assets.length - MAX_ASSETS))) await cache.delete(r);
}
const isAsset = (u, scope) => u.pathname.startsWith(scope + 'assets/') && /-[\w-]{8,}\.\w+$/.test(u.pathname);
async function warm(heavy) {
  const base = new URL('./', self.registration.scope);
  const res = await fetch(new URL('sw-warm.json', base), { cache: 'no-store' }).catch(() => null);
  const list = res && res.ok ? await res.json().catch(() => null) : null;
  if (!list) return;
  const cache = await caches.open(CACHE);
  const scope = base.pathname;
  for (const f of [...(list.files || []), ...(heavy ? list.heavy || [] : [])]) {
    const u = new URL(f, base);
    if (u.origin !== self.location.origin || !isAsset(u, scope) || await cache.match(u.href)) continue;
    const r = await fetch(u.href).catch(() => null); // 페이지가 이미 받은 파일은 브라우저 캐시에서 옴(immutable)
    if (okToStore(r)) await cache.put(u.href, r);
  }
  // 쉘: 첫 방문은 서비스 워커가 붙기 전에 열려 저장되지 않았음
  const shell = await fetch(base.href, { cache: 'no-cache' }).catch(() => null);
  if (okToStore(shell)) await cache.put(base.href, shell);
  await trim(cache);
}
self.addEventListener('message', (e) => {
  if (e.data?.type === 'warm') e.waitUntil(warm(!!e.data.heavy).catch(() => { }));
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope).pathname;
  if (r.mode === 'navigate') {
    const shell = new URL('./', self.registration.scope).href;
    // 앱 화면(첫 화면·index.html)만 오프라인용으로 저장. 예시 사이트·효과 데모·도움말 페이지는 그냥 네트워크로
    const isShell = u.pathname === scope || u.pathname === scope + 'index.html';
    if (!isShell) return;
    e.respondWith(fetch(r).then((res) => {
      if (okToStore(res) && !u.search) { const c = res.clone(); caches.open(CACHE).then((ca) => ca.put(shell, c)); }
      return res;
    }).catch(() => caches.match(shell)));
    return;
  }
  // 캐시 우선은 앱 빌드 자산(맨 위 assets/, 이름에 해시가 붙어 내용이 바뀌면 이름도 바뀜)만
  if (isAsset(u, scope)) {
    e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => {
      if (okToStore(res)) { const c = res.clone(); caches.open(CACHE).then((ca) => ca.put(r, c).then(() => trim(ca))); }
      return res;
    })));
  }
});
