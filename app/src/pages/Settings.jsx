import { useEffect, useState } from 'preact/hooks';
import { Sheet, Seg, Notice } from '../components/ui.jsx';
import { PROVIDERS, loadKey, forgetKey } from '../lib/ai.js';
import { storageInfo, askPersist, projects } from '../lib/db.js';
import { exportProjectFile } from '../lib/project.js';
import { fmtBytes, saveFile, safeName, toast } from '../lib/util.js';

export function Settings() {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('lecpage:theme') || 'auto'; } catch { return 'auto'; } });
  const [keys, setKeys] = useState({});
  const [st, setSt] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
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
    for (const k of Object.keys(PROVIDERS)) await forgetKey(k);
    toast('이 브라우저의 lecpage 데이터를 모두 지웠어요.'); setConfirmDel(false); setSt(await storageInfo());
  }
  return (
    <div class="stack" style={{ maxWidth: '820px' }}>
      <div class="step-head"><h1>설정</h1><p>lecpage는 회원가입이 없어요. 아래 데이터는 모두 이 브라우저에만 있어요.</p></div>
      <Sheet>
        <div class="stack">
          <h2 style={{ fontSize: '1.2rem' }}>화면</h2>
          <Seg label="화면 밝기" value={theme} onChange={applyTheme} options={[{ value: 'auto', label: '기기 설정' }, { value: 'light', label: '밝게' }, { value: 'dark', label: '어둡게' }]} />
        </div>
      </Sheet>
      <Sheet fold={false}>
        <div class="stack">
          <h2 style={{ fontSize: '1.2rem' }}>AI 연결</h2>
          <p class="small muted">키는 기본적으로 이 탭에서만 기억하고, '이 기기에서 기억'을 켠 경우에만 암호화해 저장해요. 키는 AI 회사로만 가요.</p>
          {Object.entries(PROVIDERS).map(([id, v]) => (
            <div class="spread card"><div><b>{v.name}</b><div class="small muted">{keys[id]?.key ? (keys[id].remembered ? '이 기기에 저장됨' : '이 탭에서만 기억 중') : '연결 안 됨'}</div></div>
              {keys[id]?.key ? <button class="btn btn-sm btn-danger" onClick={async () => { await forgetKey(id); setKeys({ ...keys, [id]: { key: '' } }); toast('키를 지웠어요.'); }}>키 지우기</button> : <a class="btn btn-sm" href={v.keyUrl} target="_blank" rel="noopener">키 받으러 가기</a>}
            </div>
          ))}
        </div>
      </Sheet>
      <Sheet fold={false}>
        <div class="stack">
          <h2 style={{ fontSize: '1.2rem' }}>저장 공간</h2>
          {st && <p>사용 {fmtBytes(st.usage)}{st.quota ? ` / 약 ${fmtBytes(st.quota)}` : ''} · {st.persisted ? '브라우저가 지우지 않도록 보호 중' : '보호 안 됨(저장 공간이 부족하면 브라우저가 지울 수 있어요)'}</p>}
          <div class="btn-row">
            {st && !st.persisted && <button class="btn btn-sm" onClick={async () => { const ok = await askPersist(); setSt(await storageInfo()); toast(ok ? '저장 공간을 보호했어요.' : '브라우저가 허락하지 않았어요.'); }}>저장 공간 보호하기</button>}
            <button class="btn btn-sm" onClick={exportAll}>모든 프로젝트 파일로 저장</button>
            <button class={`btn btn-sm btn-danger`} onClick={wipe}>{confirmDel ? '정말 지울까요? 한 번 더 누르세요' : '이 브라우저의 데이터 모두 지우기'}</button>
          </div>
          <Notice kind="lav">학교 공용 PC라면 작업이 끝난 뒤 프로젝트 파일로 저장하고 데이터를 지워 주세요.</Notice>
        </div>
      </Sheet>
    </div>
  );
}
