import { useEffect, useState } from 'preact/hooks';
import { clearCart } from '../lib/design-cart.js';
import { Seg, Dialog } from '../components/ui.jsx';
import { AiConnect } from '../components/AiConnect.jsx';
import { ConsentHost } from '../components/Consent.jsx';
import { PROVIDERS, loadKey, forgetKey } from '../lib/ai.js';
import { storageInfo, askPersist, projects } from '../lib/db.js';
import { exportProjectFile } from '../lib/project.js';
import { fmtBytes, saveFile, safeName, toast } from '../lib/util.js';
import { HostConnect, KIND } from '../components/Publish.jsx';
import { StatsSetting } from '../components/StatsSetting.jsx';
import { ConnBadge } from '../components/PcConnect.jsx';
import { forgetConsents, bridgeAvailable } from '../lib/connection.js';

export function Settings() {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('lecpage:theme') || 'auto'; } catch { return 'auto'; } });
  const [keys, setKeys] = useState({});
  const [st, setSt] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [ai, setAi] = useState(false);
  const reloadKeys = async () => { const o = {}; for (const k of Object.keys(PROVIDERS)) o[k] = await loadKey(k); setKeys(o); };
  const anyAi = Object.values(keys).some((k) => k?.key);
  useEffect(() => { (async () => { await reloadKeys(); setSt(await storageInfo()); })(); window.addEventListener('lecpage:ai-connected', reloadKeys); return () => window.removeEventListener('lecpage:ai-connected', reloadKeys); }, []);
  const applyTheme = (t) => { setTheme(t); document.documentElement.dataset.theme = t; try { localStorage.setItem('lecpage:theme', t); } catch { } };
  async function exportAll() {
    const list = await projects.all();
    for (const p of list) saveFile(safeName(p.title) + '.lecpage', await exportProjectFile(p), 'application/zip');
    toast(`연수 ${list.length}개를 파일로 저장했어요.`);
  }
  async function wipe() {
    if (!confirmDel) { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 5000); return; }
    for (const p of await projects.all()) await projects.remove(p.id);
    for (const k of [...Object.keys(PROVIDERS), ...Object.values(KIND).map((x) => 'deploy-' + x)]) await forgetKey(k);
    forgetConsents(); clearCart();
    toast('이 브라우저의 lecpage 데이터를 모두 지웠어요.'); setConfirmDel(false); setSt(await storageInfo());
  }
  return (
    <div class="settings">
      <div class="step-head"><div class="step-head-t"><h1>설정</h1><p>회원가입이 없어요. 아래 데이터는 모두 이 브라우저에만 있어요.</p></div></div>
      <section>
        <h2 class="h-sub">화면</h2>
        <Seg label="화면 밝기" value={theme} onChange={applyTheme} options={[{ value: 'auto', label: '기기 설정' }, { value: 'light', label: '밝게' }, { value: 'dark', label: '어둡게' }]} />
      </section>
      <section>
        <h2 class="h-sub">연결</h2>
        <h3 class="h-label">AI</h3>
        {bridgeAvailable() && <ConnBadge />}
        <ul class="list-rows">
          {Object.entries(PROVIDERS).filter(([id]) => keys[id]?.key).map(([id, v]) => (
            <li><span><b>{v.name}</b> <span class="small muted">{keys[id].remembered ? '연결됨 · 이 기기에 저장' : '연결됨 · 이 탭에서만'}</span></span>
              <button class="btn btn-sm btn-quiet" onClick={async () => { await forgetKey(id); setKeys({ ...keys, [id]: { key: '' } }); toast('연결을 해제했어요.'); }}>연결 해제</button></li>
          ))}
          <li><span><b>API 키</b> <span class="small muted">{anyAi ? '다른 회사 키' : '연결 안 됨'}</span></span>
            <button class="btn btn-sm" onClick={() => setAi(true)}>{anyAi ? '다른 AI 연결' : 'API 키 연결'}</button></li>
        </ul>
        <p class="small muted">ChatGPT·Claude 계정 연결은 연수 화면의 AI 선택에서 해요. 쓰던 AI로 만들 때는 연결하지 않아도 돼요.</p>
        <details class="set-more"><summary><b>다른 곳에 배포</b> <span class="small muted">Vercel · GitHub Pages · Netlify</span></summary>
          <p class="small muted">바로 배포는 연결 없이 돼요. 내 계정의 다른 곳에 배포할 때만 연결해요. <a href="#/help/deploy">배포하는 법</a></p>
          <ul class="list-rows">{Object.values(KIND).map((k) => <HostConnect kind={k} key={k} />)}</ul>
        </details>
      </section>
      <Dialog open={ai} onClose={() => setAi(false)} label="AI 연결" wide>
        <div class="stack"><h2 class="h-sub">AI 연결</h2>{ai && <AiConnect onConnected={async () => { setAi(false); await reloadKeys(); }} />}</div>
      </Dialog>
      <section>
        <h2 class="h-sub">저장 공간</h2>
        {st && <p>사용 {fmtBytes(st.usage)}{st.quota ? ` / 약 ${fmtBytes(st.quota)}` : ''} · {st.persisted ? '브라우저가 지우지 않도록 보호 중' : '보호 안 됨(공간이 부족하면 브라우저가 지울 수 있어요)'}</p>}
        <div class="btn-row">
          {st && !st.persisted && <button class="btn btn-sm" onClick={async () => { const ok = await askPersist(); setSt(await storageInfo()); toast(ok ? '저장 공간을 보호했어요.' : '브라우저가 허락하지 않았어요.'); }}>저장 공간 보호</button>}
          <button class="btn btn-sm" onClick={exportAll}>모든 연수 파일로 저장</button>
          <button class="btn btn-sm btn-danger" onClick={wipe}>{confirmDel ? '한 번 더 눌러 삭제' : '모든 데이터 삭제'}</button>
        </div>
        <p class="small muted">지우면 이 브라우저에 있는 연수·교재와 AI 키·배포 토큰이 모두 없어져요. 이미 배포한 사이트는 그대로예요. 공용 PC라면 끝난 뒤 연수를 파일로 저장하고 지워 주세요.</p>
      </section>
      <StatsSetting />
      <ConsentHost />
    </div>
  );
}
