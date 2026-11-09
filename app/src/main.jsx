import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import './styles/app.css';
import { Mascot, Wordmark } from './components/Mascot.jsx';
import { Toast } from './components/ui.jsx';
import { Home } from './pages/Home.jsx';
import { toast } from './lib/util.js';

// 첫 화면 밖의 화면은 들어갈 때 불러옵니다(처음 여는 시간을 줄임)
const LOADERS = {
  project: () => import('./pages/Project.jsx').then((m) => m.Project),
  settings: () => import('./pages/Settings.jsx').then((m) => m.Settings),
  gallery: () => import('./pages/Gallery.jsx').then((m) => m.Gallery),
  help: () => import('./pages/Help.jsx').then((m) => m.Help),
};
const loaded = {};
function Lazy({ name, ...props }) {
  const [C, setC] = useState(() => loaded[name] || null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (loaded[name]) { setC(() => loaded[name]); return; }
    let on = true;
    LOADERS[name]().then((c) => { loaded[name] = c; if (on) setC(() => c); }, () => on && setErr(true));
    return () => { on = false; };
  }, [name]);
  if (err) return <div class="empty"><p>화면을 불러오지 못했어요. 인터넷 연결을 확인하고 새로 고침해 주세요.</p><button class="btn" onClick={() => location.reload()}>새로 고침</button></div>;
  return C ? <C {...props} /> : <p class="muted" aria-live="polite">불러오는 중…</p>;
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
  }, []);
  let page;
  if (route === 'p' && a) page = <Lazy name="project" id={a} step={Number(b) || 0} />;
  else if (route === 'settings') page = <Lazy name="settings" />;
  else if (route === 'gallery') page = <Lazy name="gallery" />;
  else if (route === 'help') page = <Lazy name="help" topic={a} />;
  else page = <Home />;
  const cur = (r) => (route === r || (!route && r === '') ? 'page' : undefined);
  return (
    <>
      <a class="skip" href="#main" onClick={(e) => { e.preventDefault(); const m = document.getElementById('main'); m?.focus(); m?.scrollIntoView(); }}>본문 바로 가기</a>
      <header class="top"><div class="top-in">
        <a class="brand" href="#/" aria-label="lecpage 처음으로"><Mascot size={34} /><Wordmark /></a>
        <nav aria-label="주 메뉴">
          <a href="#/" aria-current={cur('')}>만들기</a>
          <a href="#/gallery" aria-current={cur('gallery')}>디자인 둘러보기</a>
          <a href="#/help" aria-current={cur('help')}>도움말</a>
          <a href="#/settings" aria-current={cur('settings')}>설정</a>
        </nav>
      </div></header>
      <main class="page" id="main" tabIndex={-1}>{page}</main>
      <footer class="foot"><div class="foot-in">
        <span><b class="latin">lecpage</b> · 교재를 넣으면 연수 사이트가 나와요</span>
        <span>회원가입 없음 · 교재는 이 브라우저 안에서만 읽어요(AI·배포는 고른 곳으로만 보내요)</span>
        <a href="#/help/privacy">개인정보 안내</a>
        <a href="#/help/license">오픈소스·라이선스</a>
        <a href="https://github.com/yoorrard/lecpage" target="_blank" rel="noopener">GitHub</a>
      </div></footer>
      <Toast />
    </>
  );
}

render(<App />, document.getElementById('app'));

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { });
    // 첫 화면이 뜬 뒤 한가할 때 만들기 화면을 미리 받아 둠(다음 화면이 바로 열리고, 오프라인에서도 동작). 데이터 절약 모드면 생략
    if (navigator.connection?.saveData) return;
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 2500));
    idle(() => { LOADERS.project().then(() => import('./lib/engine.js')).then((m) => m.loadRuntime()).catch(() => { }); });
  });
}
