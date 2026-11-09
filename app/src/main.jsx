import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import './styles/app.css';
import { Mascot, Wordmark } from './components/Mascot.jsx';
import { Toast } from './components/ui.jsx';
import { Home } from './pages/Home.jsx';
import { Project } from './pages/Project.jsx';
import { Settings } from './pages/Settings.jsx';
import { Gallery } from './pages/Gallery.jsx';
import { Help } from './pages/Help.jsx';
import { openRouterFinish } from './lib/ai.js';
import { toast } from './lib/util.js';

function useHash() {
  const [h, setH] = useState(location.hash || '#/');
  useEffect(() => { const f = () => { setH(location.hash || '#/'); window.scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return h;
}

function App() {
  const hash = useHash();
  const parts = hash.replace(/^#\/?/, '').split('/');
  const [route, a, b] = parts;
  useEffect(() => { openRouterFinish().then((k) => k && toast('OpenRouter를 연결했어요.'), (e) => toast(e.message)); }, []);
  useEffect(() => {
    try { const t = localStorage.getItem('lecpage:theme'); if (t) document.documentElement.dataset.theme = t; } catch { }
  }, []);
  let page;
  if (route === 'p' && a) page = <Project id={a} step={Number(b) || 0} />;
  else if (route === 'settings') page = <Settings />;
  else if (route === 'gallery') page = <Gallery />;
  else if (route === 'help') page = <Help topic={a} />;
  else page = <Home />;
  const cur = (r) => (route === r || (!route && r === '') ? 'page' : undefined);
  return (
    <>
      <header class="top"><div class="top-in">
        <a class="brand" href="#/" aria-label="lecpage 처음으로"><Mascot size={34} /><Wordmark /></a>
        <nav aria-label="주 메뉴">
          <a href="#/" aria-current={cur('')}>만들기</a>
          <a href="#/gallery" aria-current={cur('gallery')}>디자인 사전</a>
          <a href="#/help" aria-current={cur('help')}>도움말</a>
          <a href="#/settings" aria-current={cur('settings')}>설정</a>
        </nav>
      </div></header>
      <main class="page" id="main">{page}</main>
      <footer class="foot"><div class="foot-in">
        <span><b class="latin">lecpage</b> · 교재를 넣으면 연수 사이트가 나와요</span>
        <span>회원가입이 없고, 교재와 키는 이 브라우저 밖으로 나가지 않아요.</span>
        <a href="#/help/privacy">개인정보 안내</a>
        <a href="https://github.com/yoorrard/lecpage" target="_blank" rel="noopener">GitHub</a>
      </div></footer>
      <Toast />
    </>
  );
}

render(<App />, document.getElementById('app'));

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => { }));
}
