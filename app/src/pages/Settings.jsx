import { useEffect, useState } from 'preact/hooks';
import { Seg, Dialog } from '../components/ui.jsx';
import { AiConnect } from '../components/AiConnect.jsx';
import { PROVIDERS, loadKey, forgetKey, getOnLimit, setOnLimit, isPaidAI } from '../lib/ai.js';
import { storageInfo, askPersist, projects } from '../lib/db.js';
import { exportProjectFile } from '../lib/project.js';
import { fmtBytes, saveFile, safeName, toast } from '../lib/util.js';
import { HostConnect, KIND } from '../components/Publish.jsx';
import { StatsSetting } from '../components/StatsSetting.jsx';

export function Settings() {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('lecpage:theme') || 'auto'; } catch { return 'auto'; } });
  const [keys, setKeys] = useState({});
  const [st, setSt] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [ai, setAi] = useState(false);
  const [onLimit, setLimit] = useState(getOnLimit);
  const reloadKeys = async () => { const o = {}; for (const k of Object.keys(PROVIDERS)) o[k] = await loadKey(k); setKeys(o); };
  const anyAi = Object.values(keys).some((k) => k?.key);
  const anyPaid = Object.keys(keys).some((id) => keys[id]?.key && isPaidAI(id)); // '무료 한도를 다 쓰면'은 유료 키가 있을 때만 뜻이 있음
  const [adv, setAdv] = useState(() => { try { return localStorage.getItem('lecpage:advanced') === '1'; } catch { return false; } });
  const toggleAdv = (v) => { setAdv(v); try { localStorage.setItem('lecpage:advanced', v ? '1' : '0'); } catch { } toast(v ? '고급 기능을 켰어요.' : '고급 기능을 껐어요.'); };
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
    toast('이 브라우저의 lecpage 데이터를 모두 지웠어요.'); setConfirmDel(false); setSt(await storageInfo());
  }
  return (
    <div class="settings">
      <div class="step-head"><div class="step-head-t"><h1>설정</h1><p>회원가입이 없어요. 아래 데이터는 모두 이 브라우저에만 있어요.</p></div></div>
      <section>
        <h2 class="h-sub">화면</h2>
        <Seg label="화면 밝기" value={theme} onChange={applyTheme} options={[{ value: 'auto', label: '기기 설정' }, { value: 'light', label: '밝게' }, { value: 'dark', label: '어둡게' }]} />
        <label class="check"><input type="checkbox" checked={adv} onChange={(e) => toggleAdv(e.target.checked)} /><span>고급 기능 보기 <span class="small muted">섹션 내용을 JSON으로 고치기, 효과 이름 보기 등</span></span></label>
      </section>
      <section>
        <h2 class="h-sub">연결</h2>
        <p class="small muted">한 번 연결해 두면 버튼 하나로 만들고 배포해요.</p>
        <h3 class="h-label">AI</h3>
        <ul class="list-rows">
          {Object.entries(PROVIDERS).filter(([id]) => keys[id]?.key).map(([id, v]) => (
            <li><span><b>{v.name}</b> <span class="small muted">{keys[id].remembered ? '연결됨 · 이 기기에 저장' : '연결됨 · 이 탭에서만'}</span></span>
              <button class="btn btn-sm btn-quiet" onClick={async () => { await forgetKey(id); setKeys({ ...keys, [id]: { key: '' } }); toast('연결을 끊었어요.'); }}>연결 끊기</button></li>
          ))}
          <li><span>{anyAi ? <span class="small muted">다른 AI</span> : <><b>AI</b> <span class="small muted">연결 안 됨</span></>}</span>
            <button class="btn btn-sm" onClick={() => setAi(true)}>{anyAi ? '더 연결하기' : '연결하기'}</button></li>
        </ul>
        <p class="small muted">쓰던 AI 창(ChatGPT·Claude·Gemini)으로 만들 때는 연결하지 않아도 돼요.</p>
        {anyPaid && <div class="field">
          <span>무료 한도를 다 쓰면</span>
          <Seg label="무료 한도를 다 쓰면" value={onLimit} onChange={(v) => { setOnLimit(v); setLimit(v); }} options={[{ value: 'stop', label: '멈추고 물어보기' }, { value: 'pay', label: '유료로 이어가기' }]} />
          <small>{onLimit === 'pay' ? '연결해 둔 유료 키로 이어서 만들어요. 쓴 만큼 크레딧에서 나가요.' : '유료 키를 쓰기 전에 물어봐요.'}</small>
        </div>}
        <h3 class="h-label">배포할 곳</h3>
        <ul class="list-rows">{Object.values(KIND).map((k) => <HostConnect kind={k} key={k} />)}</ul>
        <p class="small muted">Cloudflare와 기관 서버는 토큰 없이 파일을 옮겨요. <a href="#/help/deploy">배포하는 법</a></p>
      </section>
      <Dialog open={ai} onClose={() => setAi(false)} label="AI 연결" wide>
        <div class="stack"><h2 class="h-sub">AI 연결</h2>{ai && <AiConnect onConnected={async () => { setAi(false); await reloadKeys(); }} />}</div>
      </Dialog>
      <section>
        <h2 class="h-sub">저장 공간</h2>
        {st && <p>사용 {fmtBytes(st.usage)}{st.quota ? ` / 약 ${fmtBytes(st.quota)}` : ''} · {st.persisted ? '브라우저가 지우지 않도록 보호 중' : '보호 안 됨(공간이 부족하면 브라우저가 지울 수 있어요)'}</p>}
        <div class="btn-row">
          {st && !st.persisted && <button class="btn btn-sm" onClick={async () => { const ok = await askPersist(); setSt(await storageInfo()); toast(ok ? '저장 공간을 보호했어요.' : '브라우저가 허락하지 않았어요.'); }}>저장 공간 보호하기</button>}
          <button class="btn btn-sm" onClick={exportAll}>모든 연수 파일로 저장</button>
          <button class="btn btn-sm btn-danger" onClick={wipe}>{confirmDel ? '한 번 더 눌러 지우기' : '모든 데이터 지우기'}</button>
        </div>
        <p class="small muted">지우면 이 브라우저에 있는 연수·교재와 AI 키·배포 토큰이 모두 없어져요. 이미 배포한 사이트는 그대로예요. 공용 PC라면 끝난 뒤 연수를 파일로 저장하고 지워 주세요.</p>
      </section>
      <StatsSetting />
    </div>
  );
}
