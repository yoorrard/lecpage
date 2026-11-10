import { useEffect, useState } from 'preact/hooks';
import { Seg } from '../components/ui.jsx';
import { PROVIDERS, loadKey, forgetKey } from '../lib/ai.js';
import { storageInfo, askPersist, projects } from '../lib/db.js';
import { exportProjectFile } from '../lib/project.js';
import { fmtBytes, saveFile, safeName, toast } from '../lib/util.js';

export function Settings() {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('lecpage:theme') || 'auto'; } catch { return 'auto'; } });
  const [keys, setKeys] = useState({});
  const [st, setSt] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [adv, setAdv] = useState(() => { try { return localStorage.getItem('lecpage:advanced') === '1'; } catch { return false; } });
  const toggleAdv = (v) => { setAdv(v); try { localStorage.setItem('lecpage:advanced', v ? '1' : '0'); } catch { } toast(v ? '고급 기능을 켰어요.' : '고급 기능을 껐어요.'); };
  useEffect(() => { (async () => { const o = {}; for (const k of Object.keys(PROVIDERS)) o[k] = await loadKey(k); setKeys(o); setSt(await storageInfo()); })(); }, []);
  const applyTheme = (t) => { setTheme(t); document.documentElement.dataset.theme = t; try { localStorage.setItem('lecpage:theme', t); } catch { } };
  async function exportAll() {
    const list = await projects.all();
    for (const p of list) saveFile(safeName(p.title) + '.lecpage', await exportProjectFile(p), 'application/zip');
    toast(`프로젝트 ${list.length}개를 저장했어요.`);
  }
  async function wipe() {
    if (!confirmDel) { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 5000); return; }
    for (const p of await projects.all()) await projects.remove(p.id);
    for (const k of [...Object.keys(PROVIDERS), 'deploy-netlify', 'deploy-github']) await forgetKey(k);
    toast('이 브라우저의 lecpage 데이터를 모두 지웠어요.'); setConfirmDel(false); setSt(await storageInfo());
  }
  return (
    <div class="settings">
      <div class="step-head"><div class="step-head-t"><h1>설정</h1><p>lecpage는 회원가입이 없어요. 아래 데이터는 모두 이 브라우저에만 있어요.</p></div></div>
      <section>
        <h2 class="h-sub">화면</h2>
        <Seg label="화면 밝기" value={theme} onChange={applyTheme} options={[{ value: 'auto', label: '기기 설정' }, { value: 'light', label: '밝게' }, { value: 'dark', label: '어둡게' }]} />
        <label class="check"><input type="checkbox" checked={adv} onChange={(e) => toggleAdv(e.target.checked)} /><span>고급 기능 보기 <span class="small muted">칸 내용을 JSON으로 고치기, 효과 이름 보기 등</span></span></label>
      </section>
      <section>
        <h2 class="h-sub">AI 연결</h2>
        <p class="small muted">키는 이 브라우저에서 AI 회사로만 가요. '기억하기'를 켠 키만 암호화해 이 기기에 저장해요.</p>
        <ul class="list-rows">
          {Object.entries(PROVIDERS).map(([id, v]) => (
            <li><span><b>{v.name}</b> <span class="small muted">{keys[id]?.key ? (keys[id].remembered ? '연결됨 · 이 기기에 저장' : '연결됨 · 이 탭에서만') : '연결 안 됨'}</span></span>
              {keys[id]?.key ? <button class="btn btn-sm btn-quiet" onClick={async () => { await forgetKey(id); setKeys({ ...keys, [id]: { key: '' } }); toast('연결을 끊었어요.'); }}>연결 끊기</button> : <a class="small" href={id === 'openrouter' ? '#/help/ai' : v.keyUrl} target={id === 'openrouter' ? undefined : '_blank'} rel="noopener">{id === 'openrouter' ? '연결하는 법' : '키 만들기'}</a>}
            </li>
          ))}
        </ul>
        <p class="small muted">연결은 만들기 화면의 [AI로 다듬기]에서 해요. <a href="#/help/ai">키 만드는 법</a></p>
      </section>
      <section>
        <h2 class="h-sub">저장 공간</h2>
        {st && <p>사용 {fmtBytes(st.usage)}{st.quota ? ` / 약 ${fmtBytes(st.quota)}` : ''} · {st.persisted ? '브라우저가 지우지 않도록 보호 중' : '보호 안 됨(공간이 부족하면 브라우저가 지울 수 있어요)'}</p>}
        <div class="btn-row">
          {st && !st.persisted && <button class="btn btn-sm" onClick={async () => { const ok = await askPersist(); setSt(await storageInfo()); toast(ok ? '저장 공간을 보호했어요.' : '브라우저가 허락하지 않았어요.'); }}>저장 공간 보호하기</button>}
          <button class="btn btn-sm" onClick={exportAll}>모든 프로젝트 파일로 저장</button>
          <button class="btn btn-sm btn-danger" onClick={wipe}>{confirmDel ? '정말 지울까요? 한 번 더 누르세요' : '이 브라우저의 데이터 모두 지우기'}</button>
        </div>
        <p class="small muted">학교 공용 PC라면 끝난 뒤 프로젝트를 파일로 저장하고 데이터를 지워 주세요.</p>
      </section>
    </div>
  );
}
