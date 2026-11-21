import { useEffect, useRef, useState } from 'preact/hooks';
import { startGeneration } from '../lib/studio.js';
import { startDemo } from '../lib/demo.js';
import { chatgptLogin, chatgptLogout, chatgptWelcomeSeen, agentAction, autostart, lnaPermission, pcOrigin, isSafari } from '../lib/gen/local.js';
import { useConnection, refreshPc, setPreferred, jobOpts, connLine, DOWNLOAD, waitForPairing } from '../lib/connection.js';
import { exportProjectFile } from '../lib/project.js';
import { copy, toast, saveFile } from '../lib/util.js';

// 구독으로 연결(API 키 없이): PC 프로그램(lecpage studio)이 이 PC에서 ChatGPT 계정(Sign in with ChatGPT)이나
// 설치·로그인한 Claude Code로 사이트를 만들게 함. 강사는 lecpage.com 화면 그대로 씀(docs/research/ai-first-2026-11.md §3).
// 처음: [ChatGPT·Claude 계정으로 연결] → [PC 프로그램 다운로드] → 두 번 눌러 실행(이 화면과 저절로 짝) → [ChatGPT/Claude 계정으로 로그인] → 바로 만들기
// 다음부터: PC 프로그램이 켜져 있으면 저절로 다시 붙음. 꺼져 있으면 "PC 프로그램을 켜 주세요" 한 줄
const isWin = () => { try { return /Windows/i.test(navigator.userAgent); } catch { return false; } };
const isMac = () => { try { return /Macintosh|Mac OS X/i.test(navigator.userAgent); } catch { return false; } };
const fileName = (p) => `${String(p.title || '연수').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || '연수'}.lecpage`;

/** 한 줄 표시: "ChatGPT 계정 연결됨 · PC 프로그램 켜짐" */
export function ConnBadge({ demo = false }) {
  const { pc, conn } = useConnection({ demo });
  if (demo) return null;
  const on = pc.state === 'on' && conn;
  return <p class={`conn-badge small${on ? ' is-on' : ''}`} role="status"><span class={on ? 'dot-ok' : 'dot-off'} aria-hidden="true" />{connLine(pc, conn)}{pc.state === 'off' && <span class="muted"> — PC 프로그램을 켜 주세요</span>}</p>;
}

/** 첫째 카드: ChatGPT·Claude 구독으로 연결(API 키 없이, 추천) */
export function SubscriptionWay({ p, ready, idle, go }) {
  const { pc, list } = useConnection({ demo: !!p.demo });
  const [open, setOpen] = useState(false); // PC 프로그램 받기 안내
  const [pending, setPending] = useState(''); // 로그인 기다리는 계정: 'chatgpt' | 'claude' | 'codex'(끝나면 바로 만들기)
  const [cmd, setCmd] = useState(''); // 터미널 창을 못 열었을 때 붙여 넣을 명령
  const [perm, setPerm] = useState('');
  const [welcome, setWelcome] = useState(false);
  const s = pc.state === 'on' ? pc.status || {} : {};
  const ag = Object.fromEntries((s.agents || []).map((a) => [a.id, a]));
  const cg = s.chatgpt || {};
  const has = (id) => list.some((c) => c.id === id);

  // 받기 안내를 연 동안: PC 프로그램이 새 탭으로 짝을 맞추면 이 탭이 이어 받음
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
    setPreferred(c.id);
    if (!ready) { toast(auto ? `${c.label}을 연결했어요. 교재를 넣으면 바로 만들 수 있어요.` : '교재를 먼저 넣어 주세요.'); return; }
    if (p.demo) { toast('체험이라 미리 만든 AI 답으로 만들어요.'); await idle(); startDemo(p.id, { request: p.request || '' }); go(2); return; }
    await idle();
    startGeneration(p.id, { ...jobOpts(c), request: p.request || '', reference: p.reference || '' });
    if (auto) toast(c.id === 'chatgpt' ? 'ChatGPT 계정을 연결했어요. 바로 만들기 시작해요.' : 'Claude 계정을 연결했어요. 바로 만들기 시작해요.');
    go(2);
  }
  async function loginChatgpt() {
    // 누른 순간 새 창을 열어 두고 주소를 넣음(팝업 막힘 피하기). 못 열면 PC 프로그램이 기본 브라우저로 엶
    let w = null; try { w = window.open('', '_blank'); } catch { w = null; }
    try {
      const r = await chatgptLogin({ open: !w });
      if (w) { try { w.opener = null; } catch { /* 넘김 */ } w.location.href = r.url; }
      setPending('chatgpt');
    } catch (e) { try { w?.close(); } catch { /* 넘김 */ } toast(e?.message || 'PC 프로그램에 닿지 못했어요. PC 프로그램이 켜져 있는지 확인해 주세요.'); refreshPc(); }
  }
  async function loginAgent(id) {
    const a = ag[id] || {};
    const action = !a.installed ? 'install' : a.need === 'update' ? 'update' : 'login';
    try {
      const r = await agentAction(id, action);
      setCmd(r.ok ? '' : r.command || '');
      toast(r.ok ? (action === 'install' ? '터미널 창에서 설치와 로그인을 해 주세요. 끝나면 저절로 이어져요.' : '터미널 창과 브라우저에서 로그인해 주세요. 끝나면 저절로 이어져요.') : r.message_ko || '터미널 창을 열지 못했어요. 아래 명령을 복사해 터미널에 붙여 넣어 주세요.');
      setPending(id);
    } catch (e) { toast(e?.message || 'PC 프로그램에 닿지 못했어요. PC 프로그램이 켜져 있는지 확인해 주세요.'); }
  }
  async function logoutChatgpt() {
    try { const r = await chatgptLogout(); toast(r.revoked ? 'ChatGPT 계정 연결을 해제했어요.' : '이 PC에서 연결을 해제했어요. ChatGPT 설정에서도 앱 연결을 끊어 주세요.'); } catch (e) { toast(e?.message || '연결을 해제하지 못했어요. 잠시 뒤에 다시 눌러 주세요.'); }
    refreshPc();
  }

  const download = <>
    <div class="btn-row">
      {(isWin() || !isMac()) && <a class="btn btn-primary" href={DOWNLOAD.win} download onClick={() => setOpen(true)}>PC 프로그램 다운로드</a>}
      {(isWin() || !isMac()) && <span class="small muted">Windows용</span>}
      {isMac() && <button type="button" class="btn btn-primary" onClick={() => { copy(DOWNLOAD.mac, '명령을 복사했어요. 터미널에 붙여 넣고 Enter를 눌러요.'); setOpen(true); }}>Mac 설치 명령 복사</button>}
    </div>
    <ol class="small ai-alt-steps">
      {isMac() ? <li>Mac은 <b>터미널</b>(Spotlight에서 "터미널")을 열고 복사한 한 줄을 붙여 넣은 뒤 Enter를 눌러요.</li>
        : <li>받은 <b>lecpage-studio.cmd</b>를 두 번 눌러 실행해요. "Windows의 PC 보호" 창이 뜨면 [추가 정보] → [실행]을 눌러요. 브라우저가 경고하면 [유지]를 눌러요.</li>}
      <li>PC 프로그램이 켜지면 이 화면과 저절로 연결돼요. 아래에서 [ChatGPT 계정으로 로그인]이나 [Claude 계정으로 로그인]을 눌러요.</li>
    </ol>
    <p class="small muted">PC 프로그램은 이 PC에서만 돌아요. 처음 한 번 Node.js(무료)를 함께 받아요. {isMac() ? <a href={DOWNLOAD.page} target="_blank" rel="noopener">Windows용 파일</a> : <button type="button" class="btn-link small" onClick={() => copy(DOWNLOAD.mac, 'Mac 설치 명령을 복사했어요.')}>Mac 설치 명령 복사</button>}</p>
  </>;

  return (
    <article class={`ai-sub${pc.state === 'on' ? ' is-on' : ''}`} aria-labelledby="ai-sub-h">
      <div class="ai-sub-t"><h3 id="ai-sub-h">ChatGPT·Claude 구독으로 연결</h3><span class="ai-sub-tag">API 키 없이 · 추천</span></div>
      <p class="small">쓰고 있는 ChatGPT(Plus·Pro)나 Claude 계정으로 이 화면에서 바로 만들어요. 사용량은 그 계정의 요금제에서 차감되고, 따로 결제하지 않아요.</p>

      {pc.state === 'on' ? <div class="ai-sub-rows">
        <div class="ai-sub-row">
          <div class="ai-sub-name"><b>ChatGPT 계정</b>{has('chatgpt') ? <span class="small"><span class="dot-ok" aria-hidden="true" /> 연결됨{cg.email ? ` · ${cg.email}` : ''}</span> : <span class="small muted">Plus·Pro 요금제</span>}</div>
          {has('chatgpt') ? <div class="btn-row">
            <button type="button" class="btn btn-primary" disabled={!ready && !p.demo} onClick={() => make(list.find((c) => c.id === 'chatgpt'))}>ChatGPT로 만들기</button>
            <a class="btn-link small" href={cg.usageUrl || 'https://chatgpt.com/settings/usage'} target="_blank" rel="noopener">사용량 보기<span class="ext" aria-hidden="true">↗</span></a>
            <button type="button" class="btn-link small" onClick={logoutChatgpt}>연결 해제</button>
          </div> : <div class="btn-row">
            <button type="button" class={`btn${has('claude') ? '' : ' btn-primary'}`} aria-busy={pending === 'chatgpt' ? 'true' : undefined} onClick={loginChatgpt}>ChatGPT 계정으로 로그인</button>
            {pending === 'chatgpt' && <span class="small muted" role="status">열린 창에서 로그인해 주세요. 끝나면 바로 만들기 시작해요.</span>}
            {cg.connected && !cg.plan && <span class="small warn-line">요금제 사용을 허락하지 않았어요. 다시 로그인해 허락해 주세요.</span>}
          </div>}
        </div>
        <div class="ai-sub-row">
          <div class="ai-sub-name"><b>Claude 계정</b>{has('claude') ? <span class="small"><span class="dot-ok" aria-hidden="true" /> 연결됨 · Claude Code</span> : <span class="small muted">{ag.claude?.installed ? 'Claude Code로 로그인' : '처음이면 Claude Code를 설치하고 로그인해요'}</span>}</div>
          {has('claude') ? <div class="btn-row"><button type="button" class="btn btn-primary" disabled={!ready && !p.demo} onClick={() => make(list.find((c) => c.id === 'claude'))}>Claude로 만들기</button></div>
            : <div class="btn-row">
              <button type="button" class="btn" aria-busy={pending === 'claude' ? 'true' : undefined} onClick={() => loginAgent('claude')}>{ag.claude?.need === 'update' ? 'Claude Code 업데이트' : 'Claude 계정으로 로그인'}</button>
              {pending === 'claude' && <span class="small muted" role="status">터미널 창에서 진행해 주세요. 끝나면 바로 만들기 시작해요.</span>}
            </div>}
          {ag.claude?.installed && ag.claude.auth === 'api-key' && <p class="small warn-line">Claude Code가 구독 대신 API 키로 돌아요. 쓴 만큼 비용이 나가요.</p>}
        </div>
        {cmd && <div class="agent-cmd"><code>{cmd}</code><button type="button" class="btn btn-sm" onClick={() => copy(cmd, '명령을 복사했어요. 터미널에 붙여 넣고 Enter를 눌러요.')}>복사</button></div>}
        <Autostart st={s.autostart} />
        <p class="small muted">요청은 [만들기]·[AI로 수정]을 누를 때만 보내요. 로그인 정보는 이 PC에만 있고 lecpage 운영자에게 가지 않아요.</p>
      </div>

      : pc.state === 'off' ? <div class="stack" style={{ gap: '8px' }}>
        <p class="ai-sub-off" role="status"><b>PC 프로그램을 켜 주세요.</b> <span class="small muted">받은 lecpage-studio 파일을 두 번 누르면 이 화면과 저절로 연결돼요.</span></p>
        {pc.reason === 'token' && <p class="small warn-line">PC 프로그램과 짝이 맞지 않아요. PC 프로그램을 끄고 다시 켜 주세요.</p>}
        {perm === 'prompt' && <p class="small warn-line">브라우저가 "로컬 네트워크" 접근을 물으면 [허용]을 눌러 주세요.</p>}
        <details><summary class="small">PC 프로그램이 없어요</summary>{download}</details>
      </div>

      : pc.state === 'blocked' ? <Fallback p={p} reason={pc.reason} />

      : pc.state === 'unknown' ? <p class="small muted" role="status">PC 프로그램을 찾는 중…{perm === 'prompt' && <b> 브라우저가 묻는 창에서 [허용]을 눌러 주세요.</b>}</p>

      : <div class="stack" style={{ gap: '8px' }}>
        {!open ? <div class="btn-row"><button type="button" class="btn btn-primary" onClick={() => setOpen(true)}>ChatGPT·Claude 계정으로 연결</button><span class="small muted">PC 프로그램을 한 번 설치해요(2단계).</span></div> : download}
        {isSafari() && <p class="small muted">Safari는 PC 프로그램이 여는 화면(127.0.0.1)에서 이어서 해요.</p>}
      </div>}
      {welcome && <div class="notice" role="status"><b>ChatGPT 요금제를 쓰고 있어요.</b> lecpage에서 보내는 요청은 ChatGPT 요금제 사용량에 들어가요. 사용량과 앱 연결은 ChatGPT 설정에서 관리해요. <button type="button" class="btn btn-sm" onClick={() => setWelcome(false)}>닫기</button></div>}
    </article>
  );
}

/** 윈도우: 컴퓨터를 켤 때 PC 프로그램도 켜기(받은 파일로 켰을 때만) */
function Autostart({ st }) {
  const [on, setOn] = useState(!!st?.on);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setOn(!!st?.on); }, [st?.on]);
  if (!st?.available) return null;
  async function flip(v) {
    setBusy(true);
    try { const r = await autostart(v); setOn(!!r.on); toast(r.on ? '컴퓨터를 켤 때 PC 프로그램도 작게 켜져요.' : '컴퓨터를 켤 때 PC 프로그램을 켜지 않아요.'); } catch (e) { toast(e?.message || '설정하지 못했어요. 다시 눌러 주세요.'); }
    setBusy(false);
  }
  return <label class="check small"><input type="checkbox" checked={on} disabled={busy} onChange={(e) => flip(e.currentTarget.checked)} /> 컴퓨터를 켤 때 PC 프로그램도 켜기</label>;
}

/** Safari·권한 차단: PC 프로그램 화면(127.0.0.1)에서 이어서. 연수는 파일로 옮김(저장소가 주소마다 따로) */
function Fallback({ p, reason }) {
  const url = pcOrigin();
  const saved = useRef(false);
  async function save() {
    try { saveFile(fileName(p), await exportProjectFile(p), 'application/zip'); saved.current = true; toast('파일로 저장했어요. PC 프로그램 화면에서 [저장한 파일 열기]로 열어요.'); } catch { toast('파일로 저장하지 못했어요. 위쪽 [파일로 저장]으로 저장해 주세요.'); }
  }
  return (
    <div class="stack" style={{ gap: '8px' }}>
      <p class="small">{reason === 'denied' ? '이 브라우저에서 lecpage.com의 로컬 네트워크 접근을 차단했어요. 주소창 왼쪽 아이콘 → 사이트 설정에서 허용으로 바꾸고 새로 고침하거나, PC 프로그램 화면에서 이어서 해요.' : 'Safari는 lecpage.com에서 PC 프로그램에 바로 닿지 못해요. PC 프로그램 화면에서 이어서 해요.'}</p>
      <ol class="small ai-alt-steps">
        {p.id && !p.demo && <li><button type="button" class="btn btn-sm" onClick={save}>이 연수 파일로 저장</button> (교재를 아직 안 넣었으면 건너뛰어요)</li>}
        <li><a class="btn btn-sm btn-primary" href={url + '/'} target="_blank" rel="noopener">PC 프로그램 화면 열기<span class="ext" aria-hidden="true">↗</span></a></li>
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
  async function act() {
    if (c) {
      setPreferred('codex');
      if (!ready) { toast('교재를 먼저 넣어 주세요.'); return; }
      await idle(); startGeneration(p.id, { ...jobOpts(c), request: p.request || '', reference: p.reference || '' }); go(2); return;
    }
    try { const r = await agentAction('codex', !a.installed ? 'install' : 'login'); toast(r.ok ? '터미널 창에서 진행해 주세요. 끝나면 [Codex로 만들기]가 켜져요.' : r.message_ko || ''); setTimeout(() => refreshPc({ fresh: true }), 4000); } catch (e) { toast(e?.message || 'PC 프로그램에 닿지 못했어요. PC 프로그램이 켜져 있는지 확인해 주세요.'); }
  }
  return (
    <div class="ai-alt-row">
      <div><b>Codex</b> <span class="small muted">{c ? '연결됨' : a.installed ? '로그인이 필요해요' : 'ChatGPT 계정으로 충분해서 없어도 돼요'}</span></div>
      <button type="button" class="btn btn-sm" disabled={!!c && !ready} onClick={act}>{c ? 'Codex로 만들기' : a.installed ? 'Codex 로그인' : 'Codex 설치'}</button>
    </div>
  );
}
