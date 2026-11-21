import { useEffect, useRef, useState } from 'preact/hooks';
import { Dialog, Notice } from './ui.jsx';
import { AiConnect, AiStatus } from './AiConnect.jsx';
import { aiStatus, getActiveAI, setActive, forgetKey, CHATBOTS, setChatbot, setWay } from '../lib/ai.js';
import { startGeneration, chatPrompt, acceptChatAnswer } from '../lib/studio.js';
import { SubscriptionWay, ConnBadge, CodexRow } from './PcConnect.jsx';
import { setPreferred, askConsent } from '../lib/connection.js';
import { startDemo } from '../lib/demo.js';
import { SKILL_CMDS } from '../lib/agent.js';
import { blobs } from '../lib/db.js';
import { copy, toast, saveFile } from '../lib/util.js';

// AI 선택(docs/plan-ai-first.md §2·§7·§10). 모두에게 첫째: ChatGPT·Claude 구독으로 연결(API 키 없이, 추천 — lecpage 커넥트, PcConnect.jsx).
// 그 아래: 설치 없이 하려면 쓰던 AI로(복사·붙여넣기, 학교 PC 등). 접힌 '다른 방법': API 키(GPT·Claude 카드)·Codex·AI 에이전트(Skill).
export const AI_CARDS = [
  { id: 'openai', name: 'GPT', by: 'OpenAI', bot: 'chatgpt', app: 'ChatGPT', key: '키를 한 번 붙여 넣어요. 쓴 만큼 결제(사이트 하나에 몇백 원)', chat: 'ChatGPT 창에 붙여 넣고 답을 가져와요. 무료 요금제도 돼요' },
  { id: 'anthropic', name: 'Claude', by: 'Anthropic', bot: 'claude', app: 'Claude', key: '키를 한 번 붙여 넣어요. 쓴 만큼 결제(사이트 하나에 몇백 원)', chat: 'Claude 창에 붙여 넣고 답을 가져와요. 무료 요금제도 돼요' },
];
const touch = () => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } };
/** 앱 옆에 AI 창을 나란히 띄울 만큼 넓은 마우스 화면인지(좁거나 터치면 새 탭·AI 앱) */
const sideBySide = () => { try { return !touch() && screen.availWidth >= 1280 && innerWidth >= 900; } catch { return false; } };
/** 누르는 그 순간(사용자 동작 안에서) 복사: 새 창이 열리면 이 창이 초점을 잃어 비동기 복사가 막히는 브라우저가 있어 execCommand를 먼저 */
function copyNow(text) {
  const host = document.querySelector('dialog[open]') || document.body; const was = document.activeElement;
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.setAttribute('aria-hidden', 'true');
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
  host.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
  let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove(); was?.focus?.({ preventScroll: true });
  if (!ok) navigator.clipboard?.writeText(text).catch(() => {});
  return ok;
}

/**
 * ready: 읽은 교재가 있음(없으면 카드는 보이되 누를 수 없음) · idle(): 연수를 저장소에 다 쓴 뒤(생성 쪽이 읽기 전에)
 * reload(): 생성 쪽이 저장한 연수를 다시 읽음(쓰던 앱의 답을 받은 뒤 완성 화면으로 가기 전에) · go(n): 단계 이동
 */
export function AiPick({ p, go, idle, reload, ready }) {
  const [conn, setConn] = useState(null); // { openai: {model}|null, … }
  const [keyFor, setKeyFor] = useState(''); // 키 연결 창을 연 회사
  const [chat, setChat] = useState(''); // 쓰던 앱 길을 연 회사(카드 아래 펼침)
  const [swap, setSwap] = useState(''); // 연결된 키의 모델 바꾸기·끊기를 펼친 회사
  const afterKey = useRef(false);
  const recheck = () => aiStatus().then(setConn, () => setConn({}));
  useEffect(() => {
    recheck();
    // 만드는 중 화면의 [쓰던 앱으로(키 없이)]로 왔으면 그 회사의 쓰던 앱 길을 바로 펼침
    let want = ''; try { want = sessionStorage.getItem('lecpage:open-chat') || ''; sessionStorage.removeItem('lecpage:open-chat'); } catch { }
    if (AI_CARDS.some((c) => c.id === want) && ready) openChat(want);
  }, []);
  async function make(provider, st = conn?.[provider]) {
    if (!ready) { toast('교재를 먼저 넣어 주세요.'); return; }
    if (p.demo) { toast('체험이라 키 없이, 이 교재로 미리 만든 AI 답으로 만들어요.'); await idle(); startDemo(p.id, { request: p.request || '' }); go(2); return; }
    if (!await askConsent(`key:${provider}`)) return; // 처음 한 번: 동의 → 바로 키 넣기
    if (!st) { afterKey.current = true; setKeyFor(provider); return; }
    await setActive(provider, {}); setWay('key'); setPreferred('key');
    await idle();
    startGeneration(p.id, { way: 'key', provider, model: st.model || '', request: p.request || '', reference: p.reference || '' });
    go(2);
  }
  async function openChat(id) {
    if (!ready) { toast('교재를 먼저 넣어 주세요.'); return; }
    if (p.demo) { toast('체험이라 미리 만든 AI 답으로 만들어요. 실제로는 쓰던 AI 창에서 답을 받아 와요.'); await idle(); startDemo(p.id, { request: p.request || '' }); go(2); return; }
    setChat(chat === id ? '' : id);
    setTimeout(() => document.getElementById('chat-way')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 40);
  }
  /** 키를 연결함: [키로 연결]로 연 창이면 바로 만들기 시작(창을 닫으면 afterKey가 지워지므로 먼저 읽어 둠) */
  async function connected() {
    const then = afterKey.current; afterKey.current = false;
    const a = await getActiveAI(); setKeyFor('');
    const st = await aiStatus().catch(() => ({})); setConn(st);
    if (then && a) make(a.provider, st[a.provider] || { model: a.model });
  }
  const card = AI_CARDS.find((c) => c.id === chat);
  return (
    <section class="ai-pick" aria-labelledby="ai-pick-h">
      <div class="ai-pick-head">
        <h2 class="h-sub" id="ai-pick-h">AI 선택</h2>
        <p class="small muted">고른 AI가 교재를 직접 읽고 디자인부터 코드까지 사이트를 만들어요.</p>
        <ConnBadge demo={!!p.demo} hint={false} />
      </div>
      {!ready && <p class="small ai-pick-wait" role="status">교재를 넣으면 선택할 수 있어요.</p>}
      <SubscriptionWay p={p} ready={ready} idle={idle} go={go} />
      <div class="ai-nokey">
        <div><b>설치 없이 하려면: 쓰던 AI로</b> <span class="small muted">복사·붙여넣기로 해요. 학교 PC처럼 설치가 안 될 때, 무료 요금제도 돼요.</span></div>
        <div class="btn-row">{AI_CARDS.map((c) => <button type="button" class="btn btn-sm" disabled={!ready} aria-expanded={String(chat === c.id)} aria-controls={chat === c.id ? 'chat-way' : undefined} aria-label={`쓰던 ${c.app}로 만들기(키 없이)`} onClick={() => openChat(c.id)}>쓰던 {c.app}로</button>)}</div>
      </div>
      {card && <ChatWay key={card.id} card={card} p={p} go={go} reload={reload} idle={idle} onClose={() => setChat('')} />}
      <details class="ai-more" open={AI_CARDS.some((c) => conn?.[c.id]) || undefined}>
        <summary><b>다른 방법</b><span class="small muted">API 키 · Codex · AI 에이전트(Skill)</span></summary>
        <div class="ai-cards" role="list">
          {AI_CARDS.map((c) => {
            const st = conn?.[c.id];
            return (
              <article class={`ai-card${st ? ' is-on' : ''}`} role="listitem" aria-labelledby={`ai-${c.id}-h`} key={c.id}>
                <div class="ai-card-t"><h3 id={`ai-${c.id}-h`}>{c.name}</h3><span class="ai-card-by">{c.by}</span></div>
                <dl class="ai-card-facts"><div><dt>API 키</dt><dd>{c.key}</dd></div></dl>
                {st ? <>
                  <p class="ai-card-on small"><span class="dot-ok" aria-hidden="true" />키 연결됨 <button type="button" class="btn-link small" aria-expanded={String(swap === c.id)} onClick={() => setSwap(swap === c.id ? '' : c.id)}>바꾸기</button></p>
                  <button type="button" class="btn btn-primary ai-card-go" disabled={!ready} onClick={() => make(c.id)}>{c.name}로 만들기</button>
                </> : <button type="button" class="btn ai-card-go" disabled={!ready} aria-label={`${c.name} API 키 연결해 만들기`} onClick={() => make(c.id)}>API 키 연결</button>}
                {swap === c.id && st && <KeySwap id={c.id} onDone={() => { setSwap(''); recheck(); }} onNew={() => { setSwap(''); afterKey.current = false; setKeyFor(c.id); }} />}
              </article>
            );
          })}
        </div>
        <CodexRow p={p} ready={ready} idle={idle} go={go} />
        <div class="ai-alts"><AgentWay /></div>
      </details>
      <p class="small muted">교재는 고른 AI 회사로 가요. 학생 이름 같은 개인정보는 지우고 넣어 주세요.</p>
      <Dialog open={!!keyFor} onClose={() => { setKeyFor(''); afterKey.current = false; }} label={`${AI_CARDS.find((c) => c.id === keyFor)?.name || ''} API 키 연결`} wide>
        {keyFor && <div class="stack"><h2 class="h-sub" tabIndex={-1} data-autofocus>{AI_CARDS.find((c) => c.id === keyFor)?.name} API 키 연결 <span class="small muted">처음 한 번만</span></h2>
          <AiConnect initial={keyFor} only onConnected={connected} onChat={(prov) => { setKeyFor(''); afterKey.current = false; openChat(prov || keyFor); }} /></div>}
      </Dialog>
    </section>
  );
}

/** 연결된 키: 모델 고르기·다른 키·끊기(기존 AiStatus 그대로) */
function KeySwap({ id, onDone, onNew }) {
  const [ai, setAi] = useState(null);
  useEffect(() => { getActiveAI().then(async (a) => { if (a?.provider !== id) { await setActive(id, {}); a = await getActiveAI(); } setAi(a); }); }, [id]);
  if (!ai) return <p class="small muted">확인하는 중…</p>;
  return <div class="ai-card-swap"><AiStatus ai={ai} onChange={setAi} onSwap={onNew} swapLabel="키 변경" onDisconnect={async () => { await forgetKey(id); toast('연결을 해제했어요.'); onDone(); }} /></div>;
}

/**
 * 쓰던 앱(키 없이): ① 프롬프트 복사하고 앱 열기 ② 교재 원본 파일을 그 창에 첨부 ③ 답 붙여넣기 또는 .html 끌어 넣기.
 * 답이 잘렸으면 [이어서 요청 글 복사] → 이어진 답을 넣으면 앞의 답 뒤에 붙임(생성 API가 기억)
 */
function ChatWay({ card, p, go, reload, idle, onClose }) {
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [res, setRes] = useState(null); // 받은 답 결과(끊김·문제)
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [sent, setSent] = useState(false);
  const fileRef = useRef(); const pasteRef = useRef();
  const bot = CHATBOTS.find((b) => b.id === card.bot) || CHATBOTS[0];
  useEffect(() => { let off = false; idle().then(() => chatPrompt(p.id, { request: p.request || '', reference: p.reference || '' })).then((t) => { if (!off) setPrompt(String(t || '')); }); return () => { off = true; }; }, [p.request, p.reference]);
  // 앱 창에서 돌아오면 [답 넣기]에 초점
  useEffect(() => {
    if (!sent) return undefined;
    const f = () => { if (document.visibilityState === 'visible') { pasteRef.current?.focus({ preventScroll: true }); } };
    addEventListener('focus', f); return () => removeEventListener('focus', f);
  }, [sent]);
  const files = (p.files || []).filter((f) => !f.photos && !f.errors?.length);
  const notPdf = card.id === 'anthropic' && files.some((f) => f.ext !== 'pdf');
  function send(e) {
    if (!prompt) { e.preventDefault(); toast('프롬프트를 준비하는 중이에요. 잠깐 뒤 다시 눌러 주세요.'); return; }
    const pre = bot.prefill?.(prompt) || '';
    if (pre) e.currentTarget.href = pre;
    copyNow(prompt); setChatbot(bot.id); setSent(true);
    if (sideBySide()) {
      const w = Math.round(Math.min(820, screen.availWidth / 2)); const left = (screen.availLeft || 0) + screen.availWidth - w;
      const win = window.open(e.currentTarget.href, 'lecpage-chatbot', `popup,width=${w},height=${screen.availHeight},left=${left},top=${screen.availTop || 0}`);
      if (win) { e.preventDefault(); win.focus?.(); }
    }
    toast(pre ? `${card.app} 입력 칸에 채웠어요. 교재 파일을 첨부하고 보내세요.` : `프롬프트를 복사했어요. ${card.app} 입력 칸에 붙여 넣고 교재 파일을 첨부하세요.`);
  }
  async function getFile(f) {
    const data = f.key && await blobs.get(p.id, f.key).catch(() => null);
    if (!data) { toast('이 브라우저에 원본이 없어요. 갖고 있는 교재 파일을 첨부해 주세요.'); return; }
    saveFile(f.name, data instanceof Blob ? data : new Blob([data]), 'application/octet-stream');
  }
  async function take(input) {
    if (!input || busy) return;
    setBusy(true);
    try {
      await idle(); // 생성 쪽이 연수를 읽고 쓰기 전에 기다리던 저장을 마저 씀
      const r = await acceptChatAnswer(p.id, input);
      setRes(r); if (r.continuePrompt) setAnswer(''); // 끊긴 답은 기억해 뒀으니 칸을 비워 이어진 답을 받음
      if (r.ok) { await reload(); setAnswer(''); toast('답으로 사이트를 만들었어요.'); go(2); } // 생성 쪽이 저장함(판 기록·알게 된 것까지)
    } catch (e) { console.error(e); setRes({ ok: false, problems: ['답을 읽지 못했어요. AI 답의 코드 블록을 다시 복사해 주세요.'] }); }
    setBusy(false);
  }
  async function pasteAnswer() {
    let v = '';
    try { v = (await navigator.clipboard.readText()).trim(); }
    catch { toast(touch() ? '아래 칸을 길게 눌러 [붙여넣기]를 골라 주세요.' : '아래 칸을 누르고 Ctrl+V(맥은 ⌘V)로 붙여 넣어 주세요.'); return; }
    if (!v) { toast('복사한 답이 없어요. AI 답의 코드 블록 복사 버튼을 눌러 주세요.'); return; }
    take(v);
  }
  return (
    <section class="chat-way" id="chat-way" aria-labelledby="chat-way-h">
      <div class="spread"><h3 class="h-sub" id="chat-way-h">쓰던 {card.app}로 만들기 <span class="small muted">키 없이</span></h3><button type="button" class="btn btn-sm btn-quiet" onClick={onClose}>닫기</button></div>
      <ol class="chat-steps">
        <li>
          <b>프롬프트를 복사하고 {card.app}를 열어요</b>
          <div class="btn-row"><a class="btn btn-primary" href={bot.url} target="_blank" rel="noopener" aria-disabled={!prompt ? 'true' : undefined} onClick={send}>복사하고 {card.app} 열기<span class="ext" aria-hidden="true">↗</span></a>
            <button type="button" class="btn-link" disabled={!prompt} onClick={() => { copyNow(prompt); setSent(true); toast('프롬프트를 복사했어요.'); }}>프롬프트 복사</button></div>
        </li>
        <li>
          <b>교재 원본 파일을 그 창에 첨부해 주세요</b>
          <p class="small">AI가 교재 파일을 직접 읽어요. {files.map((f) => f.name).join(', ') || '넣은 교재'}를 입력 칸에 끌어다 놓거나 ＋(첨부) 버튼으로 넣고 보내세요.</p>
          {notPdf && <p class="small warn-line">Claude는 PPT·한글 파일을 받지 못해요. PDF로 저장해 첨부해 주세요.</p>}
          {files.length > 0 && <div class="btn-row">{files.map((f) => <button type="button" class="btn btn-sm btn-quiet" onClick={() => getFile(f)}>{f.name} 다운로드</button>)}</div>}
        </li>
        <li>
          <b>답을 넣어요</b>
          <p class="small">답이 다 나오면 코드 블록의 복사 버튼을 누르고 돌아와 [답 붙여넣기]를 눌러요. 내려받은 .html 파일을 아래에 끌어다 놓아도 돼요.</p>
          {res && !res.ok && <div role="alert"><Notice kind="bad"><div class="stack" style={{ gap: '6px' }}>
            <b>{res.continuePrompt ? '답이 중간에 끊겼어요.' : '이 답으로는 만들 수 없어요.'}</b>
            {!res.continuePrompt && (res.problems || []).map((x) => <span>{x}</span>)}
            {res.continuePrompt && <><span>[이어쓰기 프롬프트 복사]를 눌러 {card.app}에 보내고, 이어진 답을 복사해 다시 [답 붙여넣기]를 눌러요. 앞의 답은 기억해 둬요.</span>
              <div><button type="button" class="btn btn-sm btn-primary" onClick={() => { copy(res.continuePrompt, '복사했어요. AI에게 보내세요.'); setSent(true); }}>이어쓰기 프롬프트 복사</button></div></>}
          </div></Notice></div>}
          <div class={`chat-drop${over ? ' over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); const f = [...(e.dataTransfer.files || [])].find((x) => /\.html?$/i.test(x.name)); if (f) take(f); else toast('.html 파일을 놓아 주세요.'); }}>
            <div class="btn-row"><button ref={pasteRef} type="button" class={`btn btn-primary${sent ? ' nudge' : ''}`} disabled={busy} aria-busy={busy ? 'true' : undefined} onClick={pasteAnswer}>{busy ? '읽는 중…' : res?.continuePrompt ? '이어진 답 붙여넣기' : '답 붙여넣기'}</button>
              <button type="button" class="btn" onClick={() => fileRef.current?.click()}>.html 파일 선택</button></div>
            <input ref={fileRef} type="file" accept=".html,.htm,text/html" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) take(f); e.target.value = ''; }} />
            <textarea class="input ta-short" rows={2} value={answer} onInput={(e) => setAnswer(e.target.value)} placeholder="또는 여기에 직접 붙여넣기" aria-label={`${card.app}의 답`} />
            {answer.trim() && <div><button type="button" class="btn btn-primary" disabled={busy} onClick={() => take(answer)}>이 답으로 만들기</button></div>}
          </div>
        </li>
      </ol>
    </section>
  );
}

/** AI 에이전트(Skill): 설치 한 줄 → 에이전트에게 말하기 → 나온 .lecpage를 이 화면에 놓기 */
function AgentWay() {
  return (
    <details class="ai-alt">
      <summary><b>AI 에이전트(Skill)로 만들기</b><span>Claude Code·Codex 같은 AI 에이전트에 lecpage 스킬을 넣어 만들어요.</span></summary>
      <div class="ai-alt-b">
        {SKILL_CMDS.map((c) => (
          <div class="agent-cmd">
            <span class="agent-cmd-for">{c.for} {c.where}</span>
            <code>{c.cmd}</code>
            <button type="button" class="btn btn-sm" aria-label={`${c.for} 설치 명령 복사`} onClick={() => copy(c.cmd, '명령을 복사했어요.')}>복사</button>
          </div>
        ))}
        <p class="small">AI 에이전트에게 "이 교재로 lecpage 강의 사이트 만들어 줘"라고 말해요. 다 만들면 나온 .lecpage 파일을 이 화면의 교재 자리에 놓아요. 미리보기·수정·배포를 여기서 이어서 해요. <a href="#/help/skill">도구별 설치 방법</a></p>
      </div>
    </details>
  );
}
