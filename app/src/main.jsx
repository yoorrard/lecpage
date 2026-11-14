import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import './styles/app.css';
import { Mascot, Wordmark } from './components/Mascot.jsx';
import { Toast } from './components/ui.jsx';
import { Home } from './pages/Home.jsx';
import { toast } from './lib/util.js';
import { hasPendingFiles } from './lib/project.js';
import { FreshBar, chunkFailed, isChunkError, afterReloadNote, useInlineFresh } from './lib/fresh.jsx';

// 첫 화면 밖의 화면은 들어갈 때 불러옵니다(처음 여는 시간을 줄임)
const LOADERS = {
  project: () => import('./pages/Project.jsx').then((m) => m.Project),
  settings: () => import('./pages/Settings.jsx').then((m) => m.Settings),
  gallery: () => import('./pages/Gallery.jsx').then((m) => m.Gallery),
  help: () => import('./pages/Help.jsx').then((m) => m.Help),
  demo: () => import('./pages/Demo.jsx').then((m) => m.Demo),
};
const loaded = {};
function Lazy({ name, ...props }) {
  const [C, setC] = useState(() => loaded[name] || null);
  const [err, setErr] = useState(''); // '' | 'net'(망) | 'new'(새 버전) | 'reload'(저절로 새로 고치는 중) | 'bug'(조각은 받았는데 실행 오류)
  useInlineFresh(err === 'new');
  useEffect(() => {
    if (loaded[name]) { setC(() => loaded[name]); return; }
    let on = true;
    // 고르던 교재(첫 화면에 놓은 파일)는 새로 고치면 사라지므로 함께 알림
    LOADERS[name]().then((c) => { loaded[name] = c; if (on) setC(() => c); }, (e) => (isChunkError(e) ? chunkFailed(e, { files: hasPendingFiles() }) : Promise.resolve('bug')).then((k) => on && setErr(k)));
    return () => { on = false; };
  }, [name]);
  if (err === 'reload') return <p class="muted" aria-live="polite">새 버전으로 바꾸는 중…</p>;
  if (err === 'new') return <div class="empty"><p>새 버전이 나왔어요. 새로 고치면 이 화면이 열려요.{hasPendingFiles() ? ' 고르던 교재 파일은 다시 골라 주세요.' : ''}</p><button class="btn btn-primary" onClick={() => location.reload()}>새로 고침</button></div>;
  if (err) return <div class="empty"><p>{err === 'net' ? '화면을 불러오지 못했어요. 인터넷 연결을 확인하고 새로 고침해 주세요.' : '화면을 불러오지 못했어요. 새로 고침해 주세요.'}</p><button class="btn" onClick={() => location.reload()}>새로 고침</button></div>;
  return C ? <C {...props} /> : <p class="muted" aria-live="polite">불러오는 중…</p>;
}

/**
 * 연수 화면(#/p)에 처음 들어갈 때 한 번: 서비스 워커가 빌드 목록(sw-warm.json)의 첫 화면 쉘·만들기 화면·교재 읽기·미리보기 런타임·도움말·설정 조각을
 * 저장해 둠 → 그 뒤에는 인터넷이 끊겨도 교재 넣기·고치기·도움말·설정이 열림(이미 받은 파일은 브라우저 캐시에서 옮겨 망을 거의 쓰지 않음).
 * PDF 읽기 도구(약 1.4MB)는 마우스 화면에서만(휴대폰 데이터 아낌). 데이터 절약 모드면 하지 않음
 */
let warmed = false;
function warmOffline() {
  if (warmed || !import.meta.env.PROD || !('serviceWorker' in navigator) || navigator.connection?.saveData) return;
  warmed = true;
  let heavy = false; try { heavy = !matchMedia('(pointer: coarse)').matches; } catch { }
  navigator.serviceWorker.ready.then((r) => r.active?.postMessage({ type: 'warm', heavy })).catch(() => { });
}

function useHash() {
  const [h, setH] = useState(location.hash || '#/');
  useEffect(() => { const f = () => { setH(location.hash || '#/'); window.scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return h;
}

function App() {
  const hash = useHash();
  const parts = hash.replace(/^#\/?/, '').split('/');
  const [route, a, b] = parts;
  useEffect(() => {
    if (!/[?&]code=/.test(location.search)) return; // OpenRouter 연결에서 돌아왔을 때만
    import('./lib/ai.js').then((m) => m.openRouterFinish()).then((k) => k && toast('OpenRouter를 연결했어요.'), (e) => toast(e.message));
  }, []);
  useEffect(() => {
    try { const t = localStorage.getItem('lecpage:theme'); if (t) document.documentElement.dataset.theme = t; } catch { }
    const note = afterReloadNote(); if (note) setTimeout(() => toast(note), 400); // 새 배포라 저절로 새로 고친 뒤 한 번
  }, []);
  useEffect(() => { if (route === 'p') warmOffline(); }, [route]);
  let page;
  // key: 화면이 바뀔 때 이전 화면 컴포넌트가 새 화면의 값을 받지 않게
  if (route === 'p' && a) page = <Lazy key="project" name="project" id={a} step={Number(b) || 0} />;
  else if (route === 'settings') page = <Lazy key="settings" name="settings" />;
  else if (route === 'gallery') page = <Lazy key="gallery" name="gallery" tab={a} />;
  else if (route === 'help') page = <Lazy key="help" name="help" topic={a} />;
  else if (route === 'demo') page = <Lazy key="demo" name="demo" />;
  else page = <Home />;
  const cur = (r) => (route === r || (!route && r === '') ? 'page' : undefined);
  return (
    <>
      <a class="skip" href="#main" onClick={(e) => { e.preventDefault(); const m = document.getElementById('main'); m?.focus(); m?.scrollIntoView(); }}>본문 바로 가기</a>
      <header class="top"><div class="top-in">
        <a class="brand" href="#/" aria-label="lecpage 처음으로"><Mascot size={34} /><Wordmark /></a>
        <nav aria-label="주 메뉴">
          <a href="#/" aria-current={cur('')}>만들기</a>
          <a href="#/gallery" aria-current={cur('gallery')}>디자인</a>
          <a href="#/help" aria-current={cur('help')}>도움말</a>
          <a href="#/settings" aria-current={cur('settings')}>설정</a>
        </nav>
      </div></header>
      <main class="page" id="main" tabIndex={-1}>{page}</main>
      <footer class="foot"><div class="foot-in">
        <span><b class="latin">lecpage</b> · 교재를 넣으면 연수 사이트가 나와요</span>
        <span>회원가입 없음 · 교재는 이 브라우저에서 읽어요</span>
        <span class="foot-links"><a href="#/help/privacy">개인정보 처리방침</a><a href="#/help/terms">이용약관</a><a href="#/help/license">오픈소스·라이선스</a><a href="https://github.com/yoorrard/lecpage" target="_blank" rel="noopener">GitHub</a></span>
        <span class="foot-c">© 2026 lecpage 기여자 · Apache-2.0</span>
      </div></footer>
      <FreshBar />
      <Toast />
    </>
  );
}

render(<App />, document.getElementById('app'));

// 운영자 공지·익명 이용 합계: 첫 화면이 뜬 뒤 한가할 때 따로 받음(첫 화면 JS를 늘리지 않음) → lib/after-load.js
addEventListener('load', () => {
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1500));
  idle(() => { import('./lib/after-load.js').then((m) => m.afterLoad()).catch(() => { }); }, { timeout: 4000 });
});

// 새 배포 뒤 열린 탭: 예전 조각을 못 받으면(서버에서 지워짐) 한곳(lib/fresh.jsx)에서 '새 버전' 안내·한 번 저절로 새로 고침.
// 막지는 않음(preventDefault 없음): 부른 쪽도 실패를 받아 제 자리에 맞는 말을 함
addEventListener('vite:preloadError', (e) => { if (isChunkError(e.payload)) chunkFailed(e.payload, { files: hasPendingFiles() }); });

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { });
    // 첫 화면이 뜬 뒤 한가할 때 만들기 화면을 미리 받아 둠(다음 화면이 바로 열림). 데이터 절약 모드면 생략.
    // 오프라인용 저장은 여기서 하지 않음(첫 방문 랜딩에서 전체 캐시 금지 → 연수 화면에 들어갈 때 warmOffline)
    if (navigator.connection?.saveData) return;
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 2500));
    idle(() => { LOADERS.project().then(() => import('./lib/engine.js')).then((m) => m.loadRuntime()).catch(() => { }); });
  });
}

