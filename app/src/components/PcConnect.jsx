import { useEffect, useRef, useState } from 'preact/hooks';
import { startGeneration } from '../lib/studio.js';
import { startDemo } from '../lib/demo.js';
import { chatgptLogin, chatgptLogout, chatgptWelcomeSeen, agentAction, agentSetup, setupStatus, setupCode, setupCancel, autostart, lnaPermission, pcOrigin, isSafari, findUnpairedPc, pairPageUrl } from '../lib/gen/local.js';
import { Notice } from './ui.jsx';
import { useConnection, refreshPc, setPreferred, jobOpts, connLine, DOWNLOAD, osName, waitForPairing, preferred, askConsent, hasConsent, consentId, pcCan, pcCanUpdate, usePcUpdate, updatePc } from '../lib/connection.js';
import { exportProjectFile } from '../lib/project.js';
import { copy, toast, saveFile } from '../lib/util.js';

// 구독으로 연결(API 키 없이): lecpage 커넥트이 이 PC에서 ChatGPT 계정(Sign in with ChatGPT)이나
// 설치·로그인한 Claude Code로 사이트를 만들게 함. 강사는 lecpage.com 화면 그대로 씀(docs/research/ai-first-2026-11.md §3).
// 처음: [ChatGPT·Claude 계정으로 연결] → [lecpage 커넥트 다운로드] → 두 번 눌러 실행(이 화면과 저절로 짝) → [ChatGPT/Claude 계정으로 로그인] → 바로 만들기
// Claude: 터미널 없이 — lecpage 커넥트가 Claude Code를 창 없이 설치(진행 막대)하고 로그인을 띄움 → 브라우저에서 승인 → 연결(ClaudeSetup, 세 단계 그림 안내).
//   Claude 데스크톱 앱이 있으면 그 안의 Claude Code를 써서 설치를 건너뜀. 공식 명령을 터미널 창에서 하는 길은 '다른 방법'에만(ClaudeTermRow)
// 다음부터: lecpage 커넥트가 켜져 있으면 저절로 다시 붙음. 꺼져 있으면 "lecpage 커넥트를 켜 주세요" 한 줄
// lecpage 커넥트가 이 화면보다 예전 판(caps에 claude-setup이 없거나 경로가 404)이면 [로그인] 대신 새 판으로 바꾸기(ConnectUpdate)
const fileName = (p) => `${String(p.title || '연수').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || '연수'}.lecpage`;

/** 한 줄 표시: "ChatGPT 계정 연결됨 · lecpage 커넥트 켜짐" */
export function ConnBadge({ demo = false, hint = true }) {
  const { pc, conn } = useConnection({ demo });
  if (demo) return null;
  const on = pc.state === 'on' && conn;
  return <p class={`conn-badge small${on ? ' is-on' : ''}`} role="status"><span class={on ? 'dot-ok' : 'dot-off'} aria-hidden="true" />{connLine(pc, conn)}{hint && pc.state === 'off' && <span class="muted"> — lecpage 커넥트를 켜 주세요</span>}</p>;
}

/** 첫째 카드: ChatGPT·Claude 구독으로 연결(API 키 없이, 추천) */
export function SubscriptionWay({ p, ready, idle, go }) {
  const { pc, list } = useConnection({ demo: !!p.demo });
  const [open, setOpen] = useState(false); // lecpage 커넥트 받기 안내
  const [pending, setPending] = useState(''); // 로그인 기다리는 계정: 'chatgpt' | 'claude' | 'codex'(끝나면 바로 만들기)
  const [cmd, setCmd] = useState(''); // 터미널 창을 못 열었을 때 붙여 넣을 명령
  const [perm, setPerm] = useState('');
  const [welcome, setWelcome] = useState(false);
  const [setup, setSetup] = useState(null); // Claude 계정 연결 진행(lecpage 커넥트의 GET /bridge/setup)
  const [old, setOld] = useState(false); // 눌러 보니 lecpage 커넥트가 예전 판(그 경로가 없음)
  const s = pc.state === 'on' ? pc.status || {} : {};
  const ag = Object.fromEntries((s.agents || []).map((a) => [a.id, a]));
  const cg = s.chatgpt || {};
  const has = (id) => list.some((c) => c.id === id);
  // 두 계정이 다 연결됐으면 고른 쪽(없으면 ChatGPT)만 강조: 누를 곳 하나
  const main = has(preferred()) && (preferred() === 'chatgpt' || preferred() === 'claude') ? preferred() : has('chatgpt') ? 'chatgpt' : 'claude';
  const claudeOld = pc.state === 'on' && (old || !pcCan(pc, 'claude-setup'));
  useEffect(() => { setOld(false); }, [s.build]); // 다른 판으로 다시 켰으면 새로 봄

  // Claude 계정 연결: 새로 고쳐도 하는 중이면 이어 그림 · 1초마다 진행을 받고, 끝나면 연결을 다시 살펴 바로 만들기(위 pending 흐름)
  useEffect(() => { if (!setup && s.setup?.running) setSetup(s.setup); }, [s.setup?.startedAt]);
  useEffect(() => {
    if (!setup?.running) return undefined;
    let off = false;
    const t = setInterval(async () => {
      let v = null; try { v = await setupStatus(); } catch { return; } // 잠깐 닿지 않으면 다음 번에
      if (off || !v) return;
      setSetup(v);
      if (v.step === 'done') { setPending('claude'); refreshPc({ fresh: true }).then(() => { if (!off) setSetup(null); }); }
    }, 1000);
    return () => { off = true; clearInterval(t); };
  }, [setup?.running, setup?.startedAt]);
  // 받기 안내를 연 동안: lecpage 커넥트가 새 탭으로 짝을 맞추면 이 탭이 이어 받음
  useEffect(() => { if (!open) return undefined; waitForPairing(true); return () => waitForPairing(false); }, [open]);
  useEffect(() => { if (pc.state !== 'on' && pc.state !== 'none') lnaPermission().then(setPerm); }, [pc.state]);
  // 꺼져 있는 동안 5초마다(켜면 바로 알아봄)
  useEffect(() => { if (pc.state !== 'off') return undefined; const t = setInterval(() => { if (document.visibilityState === 'visible') refreshPc(); }, 5000); return () => clearInterval(t); }, [pc.state]);
  // 로그인 기다리는 동안 확인(ChatGPT는 짧게, 설치·로그인은 프로그램을 다시 살펴서)
  useEffect(() => {
    if (!pending) return undefined;
    const t = setInterval(() => refreshPc({ fresh: pending !== 'chatgpt' }), pending === 'chatgpt' ? 1500 : 3000);
    const end = setTimeout(() => setPending(''), 15 * 60e3);
    return () => { clearInterval(t); clearTimeout(end); };
  }, [pending]);
  // 로그인이 끝나면 바로 만들기(그 계정을 고른 사람이 누른 요청)
  useEffect(() => {
    if (!pending || !has(pending)) return;
    const c = list.find((x) => x.id === pending); setPending('');
    if (c.id === 'chatgpt' && cg.welcome) { setWelcome(true); chatgptWelcomeSeen(); }
    make(c, true);
  }, [pc]);

  async function make(c, auto = false) {
    if (!ready) { if (auto) setPreferred(c.id); toast(auto ? `${c.label}을 연결했어요. 교재를 넣으면 바로 만들 수 있어요.` : '교재를 먼저 넣어 주세요.'); return; }
    if (p.demo) { toast('체험이라 미리 만든 AI 답으로 만들어요.'); await idle(); startDemo(p.id, { request: p.request || '' }); go(2); return; }
    if (!await askConsent(consentId(c))) return;
    setPreferred(c.id);
    await idle();
    startGeneration(p.id, { ...jobOpts(c), request: p.request || '', reference: p.reference || '' });
    if (auto) toast(c.id === 'chatgpt' ? 'ChatGPT 계정을 연결했어요. 바로 만들기 시작해요.' : 'Claude 계정을 연결했어요. 바로 만들기 시작해요.');
    go(2);
  }
  async function loginChatgpt() {
    if (!hasConsent('chatgpt') && !await askConsent('chatgpt')) return; // 처음 한 번: 동의 창의 [연결]도 누른 순간이라 새 창이 막히지 않음
    // 누른 순간 새 창을 열어 두고 주소를 넣음(팝업 막힘 피하기). 못 열면 lecpage 커넥트가 기본 브라우저로 엶
    let w = null; try { w = window.open('', '_blank'); } catch { w = null; }
    try {
      const r = await chatgptLogin({ open: !w });
      if (w) { try { w.opener = null; } catch { /* 넘김 */ } w.location.href = r.url; }
      setPending('chatgpt');
    } catch (e) { try { w?.close(); } catch { /* 넘김 */ } toast(e?.message || 'lecpage 커넥트에 닿지 못했어요. lecpage 커넥트가 켜져 있는지 확인해 주세요.'); refreshPc(); }
  }
  async function loginAgent(id) {
    if (!await askConsent(id)) return;
    const a = ag[id] || {};
    const action = !a.installed ? 'install' : a.need === 'update' ? 'update' : 'login';
    try {
      const r = await agentAction(id, action);
      setCmd(r.ok ? '' : r.command || '');
      toast(r.ok ? (action === 'install' ? '터미널 창에서 설치와 로그인을 해 주세요. 끝나면 저절로 이어져요.' : '터미널 창과 브라우저에서 로그인해 주세요. 끝나면 저절로 이어져요.') : r.message_ko || '터미널 창을 열지 못했어요. 아래 명령을 복사해 터미널에 붙여 넣어 주세요.');
      setPending(id);
    } catch (e) { toast(e?.message || 'lecpage 커넥트에 닿지 못했어요. lecpage 커넥트가 켜져 있는지 확인해 주세요.'); }
  }
  /** [Claude 계정으로 로그인]: 처음 한 번 동의 → lecpage 커넥트가 설치(없으면)·로그인을 뒤에서. 화면은 세 단계 안내 */
  async function connectClaude() {
    if (!await askConsent('claude')) return;
    try { const r = await agentSetup('claude'); setCmd(''); setSetup(r.setup || null); } catch (e) { if (e?.old) { setOld(true); return; } toast(e?.message || 'lecpage 커넥트에 닿지 못했어요. lecpage 커넥트가 켜져 있는지 확인해 주세요.'); refreshPc(); }
  }
  async function cancelSetup() {
    try { await setupCancel(); } catch { /* 이미 끝남 */ }
    setSetup(null); refreshPc({ fresh: true });
  }
  async function logoutChatgpt() {
    try { const r = await chatgptLogout(); toast(r.revoked ? 'ChatGPT 계정 연결을 해제했어요.' : '이 PC에서 연결을 해제했어요. ChatGPT 설정에서도 앱 연결을 끊어 주세요.'); } catch (e) { toast(e?.message || '연결을 해제하지 못했어요. 잠시 뒤에 다시 눌러 주세요.'); }
    refreshPc();
  }

  const download = <GetConnect onGet={() => setOpen(true)} />;

  return (
    <article class={`ai-sub${pc.state === 'on' ? ' is-on' : ''}`} aria-labelledby="ai-sub-h">
      <div class="ai-sub-t"><h3 id="ai-sub-h">ChatGPT·Claude 구독으로 연결</h3><span class="ai-sub-tag">API 키 없이 · 추천</span></div>
      <p class="small">쓰고 있는 ChatGPT(Plus·Pro)나 Claude 계정으로 이 화면에서 바로 만들어요. 사용량은 그 계정의 요금제에서 차감되고, 따로 결제하지 않아요.</p>

      {pc.state === 'on' ? <div class="ai-sub-rows">
        <div class="ai-sub-row">
          <div class="ai-sub-name"><b>ChatGPT 계정</b>{has('chatgpt') ? <span class="small"><span class="dot-ok" aria-hidden="true" /> 연결됨{cg.email ? ` · ${cg.email}` : ''}</span> : <span class="small muted">Plus·Pro 요금제</span>}</div>
          {has('chatgpt') ? <div class="btn-row">
            <button type="button" class={`btn${main === 'chatgpt' ? ' btn-primary' : ''}`} disabled={!ready && !p.demo} onClick={() => make(list.find((c) => c.id === 'chatgpt'))}>ChatGPT로 만들기</button>
            <a class="btn-link small" href={cg.usageUrl || 'https://chatgpt.com/settings/usage'} target="_blank" rel="noopener">사용량 보기<span class="ext" aria-hidden="true">↗</span></a>
            <button type="button" class="btn-link small" onClick={logoutChatgpt}>연결 해제</button>
          </div> : <div class="btn-row">
            <button type="button" class={`btn${has('claude') ? '' : ' btn-primary'}`} aria-busy={pending === 'chatgpt' ? 'true' : undefined} onClick={loginChatgpt}>ChatGPT 계정으로 로그인</button>
            {pending === 'chatgpt' && <span class="small muted" role="status">열린 창에서 로그인해 주세요. 끝나면 바로 만들기 시작해요.</span>}
            {cg.connected && !cg.plan && <span class="small warn-line">요금제 사용을 허락하지 않았어요. 다시 로그인해 허락해 주세요.</span>}
          </div>}
        </div>
        <div class="ai-sub-row">
          <div class="ai-sub-name"><b>Claude 계정</b>{has('claude') ? <span class="small"><span class="dot-ok" aria-hidden="true" /> 연결됨 · {ag.claude?.from === 'desktop' ? 'Claude 데스크톱 앱' : 'Claude Code'}</span> : <span class="small muted">Pro·Max 요금제</span>}</div>
          {has('claude') ? <div class="btn-row"><button type="button" class={`btn${main === 'claude' ? ' btn-primary' : ''}`} disabled={!ready && !p.demo} onClick={() => make(list.find((c) => c.id === 'claude'))}>Claude로 만들기</button></div>
            : claudeOld && !setup ? <ConnectUpdate pc={pc} onDone={() => setOld(false)} />
            : setup ? <ClaudeSetup s={setup} onRetry={connectClaude} onCancel={cancelSetup} onTerminal={() => { setSetup(null); loginAgent('claude'); }} onCode={async (code) => { await setupCode(code); setSetup((v) => (v ? { ...v, codeSent: true } : v)); }} />
            : <div class="btn-row">
              <button type="button" class={`btn${has('chatgpt') ? '' : ' btn-primary'}`} onClick={connectClaude}>Claude 계정으로 로그인</button>
              <span class="small muted">{!ag.claude?.installed ? '처음 한 번 Claude Code를 자동으로 설치해요(1~3분).' : ag.claude.need === 'update' ? 'Claude Code를 새 버전으로 바꾸고 로그인해요.' : ag.claude.from === 'desktop' ? 'Claude 데스크톱 앱이 있어 설치 없이 로그인만 해요.' : '브라우저에서 로그인만 하면 돼요.'}</span>
              {pending === 'claude' && <span class="small muted" role="status">터미널 창에서 진행해 주세요. 끝나면 바로 만들기 시작해요.</span>}
            </div>}
          {ag.claude?.installed && ag.claude.auth === 'api-key' && <p class="small warn-line">Claude Code가 구독 대신 API 키로 돌아요. 쓴 만큼 비용이 나가요.</p>}
        </div>
        {cmd && <div class="agent-cmd"><code>{cmd}</code><button type="button" class="btn btn-sm" onClick={() => copy(cmd, '명령을 복사했어요. 터미널에 붙여 넣고 Enter를 눌러요.')}>복사</button></div>}
        <Autostart st={s.autostart} />
      </div>

      : pc.state === 'off' ? <div class="stack" style={{ gap: '8px' }}>
        <p class="ai-sub-off" role="status"><b>lecpage 커넥트를 켜 주세요.</b> <span class="small muted">{osName() === 'win' ? '받은 lecpage-connect 파일을 두 번 누르면' : '터미널에 받을 때 쓴 한 줄을 다시 붙여 넣으면'} 이 화면과 저절로 연결돼요.</span></p>
        {pc.reason === 'token' && <p class="small warn-line">lecpage 커넥트와 짝이 맞지 않아요. lecpage 커넥트를 끄고 다시 켜 주세요.</p>}
        {perm === 'prompt' && <p class="small warn-line">브라우저가 "로컬 네트워크" 접근을 물으면 [허용]을 눌러 주세요.</p>}
        <details><summary class="small">lecpage 커넥트가 없어요</summary>{download}</details>
      </div>

      : pc.state === 'blocked' ? <Fallback p={p} reason={pc.reason} />

      : pc.state === 'unknown' ? <p class="small muted" role="status">lecpage 커넥트를 찾는 중…{perm === 'prompt' && <b> 브라우저가 묻는 창에서 [허용]을 눌러 주세요.</b>}</p>

      : <div class="stack" style={{ gap: '8px' }}>
        {!open ? <div class="btn-row"><button type="button" class={`btn${p.demo ? '' : ' btn-primary'}`} onClick={() => (p.demo ? make({ id: 'demo', label: '' }) : setOpen(true))}>ChatGPT·Claude 계정으로 연결</button><span class="small muted">작은 프로그램 lecpage 커넥트를 한 번 설치해요.</span></div> : download}
        {isSafari() ? <p class="small muted">Safari는 lecpage 커넥트가 여는 화면(127.0.0.1)에서 이어서 해요.</p> : open && <PairHere />}
      </div>}
      {welcome && <div class="notice" role="status"><b>ChatGPT 요금제를 쓰고 있어요.</b> lecpage에서 보내는 요청은 ChatGPT 요금제 사용량에 들어가요. 사용량과 앱 연결은 ChatGPT 설정에서 관리해요. <button type="button" class="btn btn-sm" onClick={() => setWelcome(false)}>닫기</button></div>}
    </article>
  );
}

/**
 * 받기 안내를 연 뒤 이 화면이 그대로일 때(15초 뒤 한 줄): 커넥트가 연 브라우저가 기본 브라우저가 아니면 다른 브라우저와 짝을 맞춤 →
 * [이 브라우저와 연결]: 이 PC에 켜진 커넥트를 찾아(누를 때만: Chrome이 로컬 네트워크 접근을 물을 수 있음) 새 창으로 커넥트의 /pair를 엶 →
 * 그 창이 짝을 기억하고 닫히며 이 탭이 이어 받음(waitForPairing)
 */
function PairHere() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 15000); return () => clearTimeout(t); }, []);
  if (!show) return null;
  async function pairHere() {
    let w = null; try { w = window.open('', '_blank'); } catch { w = null; } // 누른 순간 새 창(팝업 막힘 피하기), 주소는 찾은 뒤에
    if (!w) { toast('새 창이 막혔어요. 주소창에서 팝업을 허용하고 다시 눌러 주세요.'); return; }
    setBusy(true);
    const perm = await lnaPermission();
    const port = perm === 'denied' ? 0 : await findUnpairedPc({ wait: perm === 'prompt' ? 60e3 : 1500 });
    setBusy(false);
    if (!port) {
      try { w.close(); } catch { /* 넘김 */ }
      toast(perm === 'denied' ? '이 브라우저가 로컬 네트워크 접근을 막았어요. 사이트 설정에서 허용해 주세요.' : 'lecpage 커넥트를 찾지 못했어요. 켜져 있는지 확인해 주세요.');
      return;
    }
    try { w.opener = null; } catch { /* 넘김 */ }
    w.location.href = pairPageUrl(port);
  }
  return <p class="small muted pair-here">lecpage 커넥트를 켰는데 이 화면이 그대로인가요? 다른 브라우저에 lecpage가 열렸다면 그 창에서 이어서 하거나, <button type="button" class="btn-link small" disabled={busy} aria-busy={busy ? 'true' : undefined} onClick={pairHere}>이 브라우저와 연결</button>을 눌러요.</p>;
}

/** lecpage 커넥트가 이 화면보다 예전 판: 스스로 바꿀 수 있으면 버튼 하나(받아 바꾸고 같은 연결로 다시 켜짐), 아니면 다시 켜는 법 */
function ConnectUpdate({ pc, onDone }) {
  const u = usePcUpdate();
  async function run() { if (await updatePc() === 'done') { toast('lecpage 커넥트를 새 버전으로 바꿨어요.'); onDone?.(); } }
  if (!pcCanUpdate(pc) || u.state === 'manual') {
    const win = osName() === 'win';
    return (
      <div class="stack connect-old" style={{ gap: '6px' }} role="status">
        <p class="small"><b>lecpage 커넥트를 새 버전으로 바꿔야 해요.</b> {win ? 'lecpage 커넥트 창(작업 표시줄)을 닫고, 받은 lecpage-connect 파일을 다시 두 번 눌러요.' : 'lecpage 커넥트 터미널 창이 있으면 닫고, 받을 때 쓴 한 줄을 터미널에 다시 붙여 넣어요.'} 켤 때 새 버전을 받고 이 화면과 다시 연결돼요.</p>
        {win ? <div class="btn-row"><a class="btn btn-sm" href={DOWNLOAD.win} download>파일 다시 받기</a></div>
          : <div class="agent-cmd"><code>{DOWNLOAD.sh}</code><button type="button" class="btn btn-sm" onClick={() => copy(DOWNLOAD.sh, '복사했어요. 터미널에 붙여 넣고 Enter를 눌러요.')}>복사</button></div>}
      </div>
    );
  }
  return (
    <div class="stack connect-old" style={{ gap: '6px' }}>
      <p class="small"><b>lecpage 커넥트를 새 버전으로 바꿔야 해요.</b> <span class="muted">누르면 바로 바꿔요(10초쯤). 연결은 그대로예요.</span></p>
      <div class="btn-row"><button type="button" class="btn btn-primary" disabled={u.state === 'run'} aria-busy={u.state === 'run' ? 'true' : undefined} onClick={run}>{u.state === 'run' ? '새 버전으로 바꾸는 중…' : '새 버전으로 바꾸기'}</button></div>
      {u.state === 'error' && <p class="small warn-line" role="alert">{u.error}</p>}
    </div>
  );
}

/** 세 단계 그림(설치 → 브라우저에서 로그인 → 연결 완료) */
const ICONS = {
  install: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v11m0 0-4.2-4.2M12 14.5l4.2-4.2" /><path d="M4.5 15.5v2.2a2.3 2.3 0 0 0 2.3 2.3h10.4a2.3 2.3 0 0 0 2.3-2.3v-2.2" /></svg>,
  login: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.6" /><path d="M3 8.6h18" /><circle cx="6.2" cy="6.3" r=".4" /><circle cx="8.4" cy="6.3" r=".4" /><circle cx="12" cy="13" r="2.1" /><path d="M8.4 17.6a3.9 3.9 0 0 1 7.2 0" /></svg>,
  done: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.6" /><path d="m8.2 12.4 2.6 2.6 5-5.2" /></svg>,
};
const mb = (n) => Math.max(1, Math.round(n / 1048576));
const CODE_RE = /^[^\s#]{4,}#[^\s#]{4,}$/;
/**
 * Claude 계정 연결 진행(lecpage 커넥트가 뒤에서): ① Claude Code 설치(없을 때만, 진행 막대) ② 브라우저에서 로그인(창이 안 열리면 직접 열고 코드 붙여넣기) ③ 연결 완료.
 * 실패하면 까닭별 안내 + [다시 시도] · [터미널 창에서 하기](공식 명령)
 */
function ClaudeSetup({ s, onRetry, onCancel, onTerminal, onCode }) {
  const [code, setCode] = useState('');
  const [ask, setAsk] = useState(false); // 코드 칸: 로그인 창을 직접 열었거나 오래 걸릴 때
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => { setSlow(false); if (s.step !== 'login') return undefined; const t = setTimeout(() => setSlow(true), 25000); return () => clearTimeout(t); }, [s.step, s.startedAt]);
  const bad = s.step === 'error' ? s.error?.at || 'install' : '';
  const st = (k) => {
    if (k === 'install') return bad === 'install' ? 'bad' : s.install === 'skip' || s.install === 'done' || s.step === 'login' || s.step === 'done' || bad === 'login' ? 'done' : s.step === 'install' || s.step === 'check' ? 'now' : 'wait';
    if (k === 'login') return bad === 'login' ? 'bad' : s.step === 'done' ? 'done' : s.step === 'login' ? 'now' : 'wait';
    return s.step === 'done' ? 'done' : 'wait';
  };
  const pr = s.progress || {};
  const sized = !!pr.total && pr.phase === 'download';
  const pct = pr.total ? Math.min(99, Math.floor((pr.done / pr.total) * 100)) : 0;
  const installText = s.install === 'skip' ? (s.from === 'desktop' ? 'Claude 데스크톱 앱에 든 것을 써요.' : '이미 설치돼 있어요.')
    : st('install') === 'done' ? '설치했어요.'
      : st('install') === 'bad' ? '설치하지 못했어요.'
      : s.step === 'check' ? '이 PC를 확인하는 중…'
        : pr.phase === 'setup' ? '설치를 마무리하는 중…'
          : sized ? `내려받는 중 ${pct}% (${mb(pr.done)}/${mb(pr.total)}MB)` : '내려받는 중… 보통 1~3분 걸려요.';
  async function send(e) {
    e.preventDefault();
    const c = code.trim();
    if (!CODE_RE.test(c)) { toast('코드를 # 앞뒤까지 모두 복사해 붙여 넣어 주세요.'); return; }
    setBusy(true);
    try { await onCode(c); setCode(''); } catch (err) { toast(err?.message || '코드를 보내지 못했어요. [다시 시도]를 눌러 주세요.'); }
    setBusy(false);
  }
  const steps = [
    ['install', 'Claude Code 설치', installText],
    ['login', '브라우저에서 로그인', st('login') === 'done' ? '로그인했어요.' : st('login') === 'bad' ? '로그인하지 못했어요.' : '열린 브라우저 창에서 Claude 계정으로 로그인하고 승인 버튼(Authorize)을 눌러요.'],
    ['done', '연결 완료', st('done') === 'done' ? '이제 Claude로 만들 수 있어요.' : '끝나면 바로 만들기 시작해요.'],
  ];
  return (
    <div class="setup" aria-live="polite">
      <ol class="setup-steps">
        {steps.map(([k, title, text]) => (
          <li class={`setup-step is-${st(k)}`} aria-current={st(k) === 'now' ? 'step' : undefined}>
            <span class="setup-ico">{ICONS[k]}</span>
            <b>{title}</b>
            <span class="small muted">{text}</span>
            {k === 'install' && s.step === 'install' && (
              <div class={`progress setup-bar${sized ? '' : ' is-busy'}`} role="progressbar" aria-label="Claude Code 설치" aria-valuemin="0" aria-valuemax="100" aria-valuenow={sized ? pct : undefined}><i style={sized ? { '--w': `${pct}%` } : undefined} /></div>
            )}
          </li>
        ))}
      </ol>
      {s.step === 'login' && s.running && <div class="setup-login">
        {s.loginUrl && <p class="small">브라우저 창이 열리지 않았나요? <a class="btn-link" href={s.loginUrl} target="_blank" rel="noopener noreferrer" onClick={() => setAsk(true)}>로그인 창 열기<span class="ext" aria-hidden="true">↗</span></a></p>}
        {(ask || slow) && s.waitingCode && (s.codeSent ? <p class="small muted" role="status">코드를 확인하는 중…</p> : <form class="setup-code" onSubmit={send}>
          <label class="small" for="claude-code">화면에 나온 코드 붙여넣기</label>
          <input id="claude-code" class="input" value={code} onInput={(e) => setCode(e.currentTarget.value)} autocomplete="off" spellcheck={false} placeholder="로그인하면 나오는 코드(가운데 # 포함)" />
          <button type="submit" class="btn btn-sm btn-primary" disabled={busy || !code.trim()}>연결</button>
        </form>)}
      </div>}
      {s.step === 'error' && s.error && <div role="alert"><Notice kind="bad"><div class="stack" style={{ gap: '6px' }}>
        <b>{s.error.title_ko}</b><span>{s.error.message_ko}</span>
        <div class="btn-row"><button type="button" class="btn btn-sm btn-primary" onClick={onRetry}>다시 시도</button><button type="button" class="btn-link small" onClick={onTerminal}>터미널 창에서 하기</button><button type="button" class="btn-link small" onClick={onCancel}>닫기</button></div>
        {s.tail && <details><summary class="small">자세한 내용</summary><pre class="setup-tail">{s.tail}</pre></details>}
      </div></Notice></div>}
      {s.running && <div><button type="button" class="btn-link small" onClick={onCancel}>취소</button></div>}
    </div>
  );
}

/** 다른 방법: 공식 명령을 터미널 창에서(자동 설치가 막힐 때) */
export function ClaudeTermRow() {
  const { pc, list } = useConnection({});
  const [cmd, setCmd] = useState('');
  if (pc.state !== 'on' || list.some((c) => c.id === 'claude')) return null;
  const a = (pc.status?.agents || []).find((x) => x.id === 'claude') || {};
  async function act() {
    if (!await askConsent('claude')) return;
    try {
      const r = await agentAction('claude', !a.installed ? 'install' : a.need === 'update' ? 'update' : 'login');
      setCmd(r.ok ? '' : r.command || '');
      toast(r.ok ? '터미널 창에서 진행해 주세요. 끝나면 [Claude로 만들기]가 켜져요.' : r.message_ko || '');
      setTimeout(() => refreshPc({ fresh: true }), 4000);
    } catch (e) { toast(e?.message || 'lecpage 커넥트에 닿지 못했어요. lecpage 커넥트가 켜져 있는지 확인해 주세요.'); }
  }
  return (
    <div class="ai-alt-row">
      <div><b>Claude Code 터미널로</b> <span class="small muted">자동 설치가 안 될 때 공식 명령을 터미널 창에서 직접 실행해요</span></div>
      <button type="button" class="btn btn-sm" onClick={act}>터미널 창에서 하기</button>
      {cmd && <div class="agent-cmd"><code>{cmd}</code><button type="button" class="btn btn-sm" onClick={() => copy(cmd, '명령을 복사했어요. 터미널에 붙여 넣고 Enter를 눌러요.')}>복사</button></div>}
    </div>
  );
}

const OS_NAME = { win: 'Windows', mac: 'Mac', linux: 'Linux' };
/** 운영체제마다 받는 법 하나(지금 기기 것만 펼치고, 나머지는 [다른 운영체제]에 접어 둠) */
function OsWay({ os, onGet, main = true }) {
  const btn = main ? 'btn btn-primary' : 'btn btn-sm';
  if (os === 'win') return (
    <div class="stack connect-way" style={{ gap: '8px' }}>
      <div class="btn-row"><a class={btn} href={DOWNLOAD.win} download onClick={onGet}>lecpage 커넥트 받기 (Windows)</a></div>
      <ol class="small ai-alt-steps">
        <li>받은 <b>lecpage-connect.cmd</b>를 두 번 눌러 실행해요. 브라우저가 경고하면 [유지]를 눌러요.</li>
        <li>"Windows의 PC 보호" 창이 뜨면 [추가 정보] → [실행]을 눌러요.</li>
      </ol>
    </div>);
  return (
    <div class="stack connect-way" style={{ gap: '8px' }}>
      <div class="agent-cmd"><code>{DOWNLOAD.sh}</code><button type="button" class={main ? 'btn btn-sm btn-primary' : 'btn btn-sm'} onClick={() => { copy(DOWNLOAD.sh, '복사했어요. 터미널에 붙여 넣고 Enter를 눌러요.'); onGet(); }}>복사</button></div>
      <ol class="small ai-alt-steps">
        {os === 'mac' ? <>
          <li>Spotlight(⌘+스페이스)에서 "터미널"을 찾아 열어요.</li>
          <li>복사한 한 줄을 붙여 넣어요(⌘V).</li>
          <li>Enter를 눌러요.</li>
        </> : <li>터미널을 열고 복사한 한 줄을 붙여 넣은 뒤 Enter를 눌러요.</li>}
      </ol>
    </div>);
}
/** lecpage 커넥트 받기: 지금 운영체제 방법 하나 + 접힌 [다른 운영체제] */
function GetConnect({ onGet }) {
  const os = osName(); const here = os === 'mobile' ? '' : os;
  return (
    <div class="stack" style={{ gap: '10px' }}>
      <p class="small">lecpage 커넥트는 이 PC에서 ChatGPT·Claude 계정을 lecpage에 이어 주는 작은 프로그램이에요.</p>
      {here ? <OsWay os={here} onGet={onGet} /> : <p class="small warn-line">lecpage 커넥트는 PC(Windows·Mac·Linux)에 설치해요. 휴대폰에서는 아래 [다른 방법]의 API 키로 만들어요.</p>}
      <p class="small muted">켜지면 이 화면과 저절로 연결돼요. 그다음 아래에서 계정으로 로그인해요. 처음 한 번 Node.js(무료)를 함께 받아요.{here && here !== 'win' ? ' 쓰는 동안 터미널 창은 열어 두세요.' : ''}</p>
      <details class="connect-os"><summary class="small">다른 운영체제</summary>
        {Object.keys(OS_NAME).filter((k) => k !== here).map((k) => <div class="stack" style={{ gap: '4px' }}><b class="small">{OS_NAME[k]}</b><OsWay os={k} onGet={onGet} main={false} /></div>)}
      </details>
    </div>
  );
}

/** 윈도우: 컴퓨터를 켤 때 lecpage 커넥트도 켜기(받은 파일로 켰을 때만) */
function Autostart({ st }) {
  const [on, setOn] = useState(!!st?.on);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setOn(!!st?.on); }, [st?.on]);
  if (!st?.available) return null;
  async function flip(v) {
    setBusy(true);
    try { const r = await autostart(v); setOn(!!r.on); toast(r.on ? '컴퓨터를 켤 때 lecpage 커넥트도 작게 켜져요.' : '컴퓨터를 켤 때 lecpage 커넥트를 켜지 않아요.'); } catch (e) { toast(e?.message || '설정하지 못했어요. 다시 눌러 주세요.'); }
    setBusy(false);
  }
  return <label class="check small"><input type="checkbox" checked={on} disabled={busy} onChange={(e) => flip(e.currentTarget.checked)} /> 컴퓨터를 켤 때 lecpage 커넥트도 켜기</label>;
}

/** Safari·권한 차단: lecpage 커넥트 화면(127.0.0.1)에서 이어서. 연수는 파일로 옮김(저장소가 주소마다 따로) */
function Fallback({ p, reason }) {
  const url = pcOrigin();
  const saved = useRef(false);
  async function save() {
    try { saveFile(fileName(p), await exportProjectFile(p), 'application/zip'); saved.current = true; toast('파일로 저장했어요. lecpage 커넥트 화면에서 [저장한 파일 열기]로 열어요.'); } catch { toast('파일로 저장하지 못했어요. 위쪽 [파일로 저장]으로 저장해 주세요.'); }
  }
  return (
    <div class="stack" style={{ gap: '8px' }}>
      <p class="small">{reason === 'denied' ? '이 브라우저에서 lecpage.com의 로컬 네트워크 접근을 차단했어요. 주소창 왼쪽 아이콘 → 사이트 설정에서 허용으로 바꾸고 새로 고침하거나, lecpage 커넥트 화면에서 이어서 해요.' : 'Safari는 lecpage.com에서 lecpage 커넥트에 바로 닿지 못해요. lecpage 커넥트 화면에서 이어서 해요.'}</p>
      <ol class="small ai-alt-steps">
        {p.id && !p.demo && <li><button type="button" class="btn btn-sm" onClick={save}>이 연수 파일로 저장</button> (교재를 아직 안 넣었으면 건너뛰어요)</li>}
        <li><a class="btn btn-sm btn-primary" href={url + '/'} target="_blank" rel="noopener">lecpage 커넥트 화면 열기<span class="ext" aria-hidden="true">↗</span></a></li>
        <li>그 화면에서 [저장한 파일 열기]로 방금 저장한 파일을 열어요. 그다음 계정으로 로그인해요.</li>
      </ol>
    </div>
  );
}

/** 다른 방법 안의 Codex(이미 설치했거나 쓰고 싶은 사람) */
export function CodexRow({ p, ready, idle, go }) {
  const { pc, list } = useConnection({ demo: !!p.demo });
  if (pc.state !== 'on') return null;
  const a = (pc.status?.agents || []).find((x) => x.id === 'codex') || {};
  const c = list.find((x) => x.id === 'codex');
  const old = !!a.installed && a.need === 'install'; // 깔려 있지만 lecpage가 쓰기엔 예전 판
  async function act() {
    if (c && !ready) { toast('교재를 먼저 넣어 주세요.'); return; }
    if (!p.demo && !await askConsent('codex')) return;
    if (c) {
      setPreferred('codex');
      await idle(); startGeneration(p.id, { ...jobOpts(c), request: p.request || '', reference: p.reference || '' }); go(2); return;
    }
    // 너무 예전 판(need 'install'): Codex는 따로 업데이트 명령이 없어 공식 설치 명령으로 새 판을 받음(lecpage 커넥트가 설치 + 로그인)
    try { const r = await agentAction('codex', !a.installed || old ? 'install' : 'login'); toast(r.ok ? '터미널 창에서 진행해 주세요. 끝나면 [Codex로 만들기]가 켜져요.' : r.message_ko || ''); setTimeout(() => refreshPc({ fresh: true }), 4000); } catch (e) { toast(e?.message || 'lecpage 커넥트에 닿지 못했어요. lecpage 커넥트가 켜져 있는지 확인해 주세요.'); }
  }
  return (
    <div class="ai-alt-row">
      <div><b>Codex</b> <span class="small muted">{c ? '연결됨' : old ? '새 버전이 필요해요' : a.installed ? '로그인이 필요해요' : 'ChatGPT 계정으로 충분해서 없어도 돼요'}</span></div>
      <button type="button" class="btn btn-sm" disabled={!!c && !ready} onClick={act}>{c ? 'Codex로 만들기' : old ? '업데이트' : a.installed ? 'Codex 로그인' : 'Codex 설치'}</button>
    </div>
  );
}
