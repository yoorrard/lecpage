import { useEffect, useState } from 'preact/hooks';
import { clearCart } from '../lib/design-cart.js';
import { Seg, Dialog } from '../components/ui.jsx';
import { AiConnect } from '../components/AiConnect.jsx';
import { ConsentHost } from '../components/Consent.jsx';
import { PROVIDERS, loadKey, forgetKey, forgetAllKeys } from '../lib/ai.js';
import { storageInfo, askPersist, projects, wipeStores } from '../lib/db.js';
import { exportProjectFile, haltJobs } from '../lib/project.js';
import { fmtBytes, saveFile, safeName, toast } from '../lib/util.js';
import { HostConnect, CfHostRow, KIND } from '../components/Publish.jsx';
import { StatsSetting } from '../components/StatsSetting.jsx';
import { ConnBadge } from '../components/PcConnect.jsx';
import { forgetConsents, bridgeAvailable, setPreferred, refreshPc } from '../lib/connection.js';
import { forgetPairing, bridgeStatus, chatgptLogout } from '../lib/gen/local.js';
import { CF_CAP, cfRun, cfUsed } from '../lib/cf-connect.js';
import { VC_CAP, vcRun, vcUsed } from '../lib/vc-connect.js';

// 커넥트가 이 PC에 따로 쥐고 있는 배포 계정 로그인(공식 도구의 로그인). 이 브라우저 데이터를 지워도 남으므로 [모든 데이터 삭제]가 함께 지움
const PC_HOSTS = [
  { id: 'cloudflare', name: 'Cloudflare', cap: CF_CAP, run: cfRun, used: cfUsed, flag: 'lecpage:cf-used' },
  { id: 'vercel', name: 'Vercel', cap: VC_CAP, run: vcRun, used: vcUsed, flag: 'lecpage:vc-used' },
];
/**
 * [모든 데이터 삭제] 전에 lecpage 커넥트에 남은 로그인 지우기: ChatGPT 계정 연결, 그리고 커넥트로 배포해 본 Cloudflare·Vercel 로그인.
 * hosts: 지울 곳(이 브라우저가 커넥트로 써 본 곳. 커넥트가 status의 hosts로 '로그인이 있을 수 있음'을 알려 주면 그곳도).
 * → { off(커넥트에 닿지 못함), chatgpt(해제함), done[이름], left[지우지 못한 곳] }. 모두 합쳐 5초까지만 기다림(커넥트는 시작한 지우기를 끝까지 함)
 */
async function logoutPc(hosts) {
  const out = { off: true, chatgpt: false, done: [], left: [] }; // off: 커넥트의 답을 받기 전에는 '닿지 못함'
  const run = (async () => {
    const s = await bridgeStatus();
    out.off = false;
    if (s?.chatgpt?.connected) { await chatgptLogout(); out.chatgpt = true; }
    const caps = s?.caps || [];
    await Promise.all(PC_HOSTS.filter((h) => hosts.includes(h.id) || s?.hosts?.[h.id]).map(async (h) => {
      if (!caps.includes(h.cap)) { out.left.push(h); return; }
      out.left.push(h); // 끝났다는 답을 받기 전에는 '남음'
      try { await h.run('logout', {}); out.left = out.left.filter((x) => x !== h); out.done.push(h.name); } catch { /* 남음으로 둠 */ }
    }));
  })().catch(() => { /* 닿지 못했거나 도중에 끊김: 끝내지 못한 곳은 left에 남아 있음 */ });
  await Promise.race([run, new Promise((ok) => setTimeout(ok, 5000))]);
  if (out.off) out.left = PC_HOSTS.filter((h) => hosts.includes(h.id));
  return { ...out, left: [...out.left] };
}

export function Settings() {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('lecpage:theme') || 'auto'; } catch { return 'auto'; } });
  const [keys, setKeys] = useState({});
  const [st, setSt] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [wiping, setWiping] = useState(false); // 지우는 중(도는 AI 작업을 멈추느라 몇 초 걸릴 수 있음): 한 번 더 눌러 겹쳐 돌지 않게
  const [wiped, setWiped] = useState(false); // 방금 모두 지움(브라우저의 사용량 값은 지운 뒤에도 한동안 예전 값)
  const [gen, setGen] = useState(0); // 지운 뒤 배포할 곳 줄을 새로 그림
  const [ai, setAi] = useState(false);
  const reloadKeys = async () => { const o = {}; for (const k of Object.keys(PROVIDERS)) o[k] = await loadKey(k); setKeys(o); };
  const anyAi = Object.values(keys).some((k) => k?.key);
  useEffect(() => { (async () => { await reloadKeys(); setSt(await storageInfo()); })(); window.addEventListener('lecpage:ai-connected', reloadKeys); return () => window.removeEventListener('lecpage:ai-connected', reloadKeys); }, []);
  const applyTheme = (t) => { setTheme(t); document.documentElement.dataset.theme = t; try { localStorage.setItem('lecpage:theme', t); } catch { } };
  async function exportAll() {
    const list = await projects.all();
    // 하나씩 저장: 너무 커서 파일 하나로 못 담는 연수는 건너뛰고 이름을 알림(저장했다고 잘못 알리지 않게)
    let done = 0; const skipped = [];
    for (const p of list) {
      try { saveFile(safeName(p.title) + '.lecpage', await exportProjectFile(p), 'application/zip'); done++; }
      catch (e) { console.error(e); skipped.push(p.title || '이름 없는 연수'); }
    }
    toast(skipped.length ? `연수 ${done}개를 파일로 저장했어요. 저장하지 못한 연수: ${skipped.join(', ')}` : `연수 ${list.length}개를 파일로 저장했어요.`);
  }
  async function wipe() {
    if (wiping) return;
    if (!confirmDel) { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 5000); return; }
    setWiping(true);
    let ok = true;
    try { await wipeNow(); } catch { ok = false; toast('다 지우지 못했어요. 다시 눌러 주세요.'); }
    // 지운 모습을 바로 보임: 연결한 AI 줄·배포할 곳 줄을 다시 읽고(예전 '연결됨'이 남아 보이지 않게), 쓰는 공간은 브라우저가 늦게 알려 주므로 지웠다는 사실을 적음
    await reloadKeys().catch(() => setKeys({}));
    setGen((n) => n + 1); if (ok) setWiped(true);
    setConfirmDel(false); setWiping(false); setSt(await storageInfo().catch(() => null));
  }
  async function wipeNow() {
    // 도는 AI 작업(이 탭·다른 탭)을 먼저 멈춤: 지운 뒤에 AI를 더 부르거나 작업 기록을 다시 쓰지 않게
    const all = await projects.all();
    await haltJobs(all.map((p) => p.id));
    for (const p of all) await projects.remove(p.id);
    for (const k of [...Object.keys(PROVIDERS), ...Object.values(KIND).map((x) => 'deploy-' + x)]) await forgetKey(k);
    // lecpage 커넥트: ChatGPT 계정 연결과, 커넥트로 배포해 본 Cloudflare·Vercel 로그인을 지우고(공용 PC에서 다음 사람이 강사 구독·계정을 쓰지 않게) 이 브라우저의 짝·고른 연결도 지움
    const pcHosts = PC_HOSTS.filter((h) => h.used() || all.some((p) => p.deploy?.[h.id]?.via === 'connect')).map((h) => h.id);
    const pc = bridgeAvailable() ? await logoutPc(pcHosts) : { off: pcHosts.length > 0, chatgpt: false, done: [], left: PC_HOSTS.filter((h) => pcHosts.includes(h.id)) };
    forgetPairing(); setPreferred(''); refreshPc();
    forgetConsents(); clearCart();
    // 남은 것까지: 참여 기능 관리자 키·기억한 서버·고른 모델·암호화 열쇠·쓰다 만 글·미리보기 상태(화면 밝기·익명 통계 끄기만 남김)
    await wipeStores().catch(() => { }); forgetAllKeys();
    // 커넥트에 남은 로그인을 지우지 못한 곳은 '연결돼 있어요' 표시를 남김: 배포하기 화면의 [연결 해제]로 마저 지울 수 있게(표시까지 지우면 로그인이 남은 줄 모름)
    const keep = new Set(['lecpage:theme', 'lecpage:stats-off', ...pc.left.map((h) => h.flag)]);
    for (const h of pc.left) { try { localStorage.setItem(h.flag, '1'); } catch { /* 저장 못 하면 안내만 */ } }
    for (const st of [localStorage, sessionStorage]) { try { for (const k of Object.keys(st)) if (/^(lecpage[:-]|lp-)/.test(k) && !keep.has(k)) st.removeItem(k); } catch { } }
    const leftNames = pc.left.map((h) => h.name).join('·');
    const doneNames = [pc.chatgpt ? 'ChatGPT' : '', ...pc.done].filter(Boolean).join('·');
    toast(leftNames ? `모두 지웠어요. 다만 lecpage 커넥트${pc.off ? '가 꺼져 있어' : '에 남은'} ${leftNames} 로그인은 지우지 못했어요. 공용 PC라면 ${pc.off ? '커넥트를 켠 뒤' : '잠시 뒤'} 배포하기 화면의 ${leftNames} 카드에서 [연결 해제]를 눌러 주세요.`
      : pc.off ? '모두 지웠어요. 커넥트가 꺼져 있어 ChatGPT 연결은 확인하지 못했어요. 공용 PC라면 커넥트를 켜고 연결을 해제해 주세요.'
        : doneNames ? `모두 지웠어요. lecpage 커넥트의 ${doneNames} 연결도 해제했어요.` : '이 브라우저의 lecpage 데이터를 모두 지웠어요.');
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
              <button class="btn btn-sm btn-quiet" onClick={async () => { await forgetKey(id); setKeys({ ...keys, [id]: { key: '' } }); toast('연결을 해제했어요.'); setTimeout(() => document.getElementById('set-ai-add')?.focus(), 0); /* 누른 줄이 사라지므로 초점을 아래 연결 버튼으로 */ }}>연결 해제</button></li>
          ))}
          <li><span><b>API 키</b> <span class="small muted">{anyAi ? '다른 회사 키' : '연결 안 됨'}</span></span>
            <button id="set-ai-add" class="btn btn-sm" onClick={() => setAi(true)}>{anyAi ? '다른 AI 연결' : 'API 키 연결'}</button></li>
        </ul>
        <p class="small muted">ChatGPT·Claude 계정 연결은 연수 화면의 AI 선택에서 해요.</p>
        <details class="set-more"><summary><b>다른 곳에 배포</b> <span class="small muted">Cloudflare · Netlify · Vercel · GitHub Pages</span></summary>
          <p class="small muted">바로 배포는 연결 없이 돼요. 내 계정의 다른 곳에 배포할 때만 연결해요. <a href="#/help/deploy">배포하는 법</a></p>
          {/* 배포하기 화면과 같은 순서(쉬운 곳이 먼저). Cloudflare는 lecpage 커넥트로 로그인하므로 토큰 연결이 없음 */}
          <ul class="list-rows" key={gen}><CfHostRow />{['netlify', 'vercel', 'github'].filter((k) => Object.values(KIND).includes(k)).map((k) => <HostConnect kind={k} key={k} />)}</ul>
        </details>
      </section>
      <Dialog open={ai} onClose={() => setAi(false)} label="AI 연결" wide>
        <div class="stack"><h2 class="h-sub">AI 연결</h2>{ai && <AiConnect onConnected={async () => { setAi(false); await reloadKeys(); }} />}</div>
      </Dialog>
      <section>
        <h2 class="h-sub">저장 공간</h2>
        {st && <p>{wiped ? '방금 모두 지웠어요' : <>사용 {fmtBytes(st.usage)}{st.quota ? ` / 약 ${fmtBytes(st.quota)}` : ''}</>} · {st.persisted ? '브라우저가 지우지 않도록 보호 중' : '보호 안 됨(공간이 부족하면 브라우저가 지울 수 있어요)'}</p>}
        <div class="btn-row">
          {st && !st.persisted && <button class="btn btn-sm" onClick={async () => { const ok = await askPersist(); setSt(await storageInfo()); toast(ok ? '저장 공간을 보호했어요.' : '브라우저가 허락하지 않았어요.'); }}>저장 공간 보호</button>}
          <button class="btn btn-sm" onClick={exportAll}>모든 연수 파일로 저장</button>
          <button class="btn btn-sm btn-danger" disabled={wiping} aria-busy={wiping ? 'true' : undefined} onClick={wipe}>{wiping ? '삭제하는 중…' : confirmDel ? '한 번 더 눌러 삭제' : '모든 데이터 삭제'}</button>
        </div>
        <p class="small muted">지우면 이 브라우저에 있는 연수·교재와 AI 키·배포 토큰이 모두 없어져요. lecpage 커넥트 연결(ChatGPT 계정, 커넥트로 배포한 Cloudflare·Vercel 로그인 포함)도 해제해요. 이미 배포한 사이트는 그대로 열려 있지만 관리자 키도 지워져서, 이 브라우저에서 배포한 사이트를 다시 배포하거나 배포를 취소할 수 없고 강사 화면에도 들어갈 수 없어요. 계속 쓸 연수는 먼저 그 연수의 [파일로 저장]에서 '내 다른 기기에서 같은 주소로 이어 배포하기'를 켜서 저장해 주세요. 공용 PC라면 끝난 뒤 연수를 파일로 저장하고 지워 주세요.</p>
      </section>
      <StatsSetting />
      <ConsentHost />
    </div>
  );
}
