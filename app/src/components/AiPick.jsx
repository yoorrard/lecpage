import { useEffect, useRef, useState } from 'preact/hooks';
import { Dialog } from './ui.jsx';
import { AiConnect, AiStatus } from './AiConnect.jsx';
import { aiStatus, getActiveAI, setActive, forgetKey } from '../lib/ai.js';
import { startGeneration } from '../lib/studio.js';
import { SubscriptionWay, ConnBadge, CodexRow, ClaudeTermRow } from './PcConnect.jsx';
import { setPreferred, askConsent } from '../lib/connection.js';
import { startDemo } from '../lib/demo.js';
import { SKILL_CMDS } from '../lib/agent.js';
import { copy, toast } from '../lib/util.js';

// AI 선택(docs/plan-ai-first.md §2·§7·§10). 모두에게 첫째: ChatGPT·Claude 구독으로 연결(API 키 없이, 추천 — lecpage 커넥트, PcConnect.jsx).
// 접힌 '다른 방법': API 키(GPT·Claude 카드)·Claude Code 터미널(공식 명령)·Codex·AI 에이전트(Skill). 모두 이 화면 안에서 만듦
export const AI_CARDS = [
  { id: 'openai', name: 'GPT', by: 'OpenAI', key: '키를 한 번 붙여 넣어요. 쓴 만큼 결제(사이트 하나에 몇백 원)' },
  { id: 'anthropic', name: 'Claude', by: 'Anthropic', key: '키를 한 번 붙여 넣어요. 쓴 만큼 결제(사이트 하나에 몇백 원)' },
];
/**
 * ready: 읽은 교재가 있음(없으면 카드는 보이되 누를 수 없음) · idle(): 연수를 저장소에 다 쓴 뒤(생성 쪽이 읽기 전에) · go(n): 단계 이동
 * reading: 교재를 읽는 중(교재 칸이 진행을 알림). 그동안은 '교재를 넣으면…' 줄을 넣지 않아 다 읽을 때 이 칸이 밀리지 않음
 * held: 읽다가 멈춘 교재가 있어 만들 수 없음(그 교재가 사이트에서 말없이 빠지지 않게) → 까닭과 할 일을 이 칸에 한 줄로
 */
export const HELD_WAIT = '읽다가 멈춘 교재가 있어요. [이어서 읽기]를 누르거나 삭제해 주세요.';
export function AiPick({ p, go, idle, ready, reading = false, held = false }) {
  const wait = held ? HELD_WAIT : ''; // 만들 수 없는 까닭(없으면 '교재를 넣으면…')
  const [conn, setConn] = useState(null); // { openai: {model}|null, … }
  const [keyFor, setKeyFor] = useState(''); // 키 연결 창을 연 회사
  const [swap, setSwap] = useState(''); // 연결된 키의 모델 바꾸기·끊기를 펼친 회사
  const afterKey = useRef(false);
  const recheck = () => aiStatus().then(setConn, () => setConn({}));
  useEffect(() => { recheck(); }, []);
  async function make(provider, st = conn?.[provider]) {
    if (!ready) { toast(wait || '교재를 먼저 넣어 주세요.'); return; }
    if (p.demo) { toast('체험이라 키 없이, 이 교재로 미리 만든 AI 답으로 만들어요.'); await idle(); startDemo(p.id, { request: p.request || '' }); go(2); return; }
    if (!await askConsent(`key:${provider}`)) return; // 처음 한 번: 동의 → 바로 키 넣기
    if (!st) { afterKey.current = true; setKeyFor(provider); return; }
    await setActive(provider, {}); setPreferred('key');
    await idle();
    startGeneration(p.id, { way: 'key', provider, model: st.model || '', request: p.request || '', reference: p.reference || '' });
    go(2);
  }
  /** 키를 연결함: [키로 연결]로 연 창이면 바로 만들기 시작(창을 닫으면 afterKey가 지워지므로 먼저 읽어 둠) */
  async function connected() {
    const then = afterKey.current; afterKey.current = false;
    const a = await getActiveAI(); setKeyFor('');
    const st = await aiStatus().catch(() => ({})); setConn(st);
    if (then && a) make(a.provider, st[a.provider] || { model: a.model });
  }
  return (
    <section class="ai-pick" aria-labelledby="ai-pick-h">
      <div class="ai-pick-head">
        <h2 class="h-sub" id="ai-pick-h">AI 선택</h2>
        <p class="small muted">고른 AI가 교재를 직접 읽고 디자인부터 코드까지 사이트를 만들어요.</p>
        <ConnBadge demo={!!p.demo} hint={false} />
      </div>
      {!ready && !reading && <p class="small ai-pick-wait" role="status">{wait || '교재를 넣으면 선택할 수 있어요.'}</p>}
      <SubscriptionWay p={p} ready={ready} wait={wait} idle={idle} go={go} />
      <details class="ai-more" open={AI_CARDS.some((c) => conn?.[c.id]) || undefined}>
        <summary><b>다른 방법</b><span class="small muted">API 키 · AI 에이전트(Skill)</span></summary>
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
        <ClaudeTermRow />
        <CodexRow p={p} ready={ready} wait={wait} idle={idle} go={go} />
        <div class="ai-alts"><AgentWay /></div>
      </details>
      <p class="small muted">교재는 고른 AI 회사로 가요. 참가자 이름 같은 개인정보는 지우고 넣어 주세요.</p>
      <Dialog open={!!keyFor} onClose={() => { setKeyFor(''); afterKey.current = false; }} label={`${AI_CARDS.find((c) => c.id === keyFor)?.name || ''} API 키 연결`} wide>
        {keyFor && <div class="stack"><h2 class="h-sub" tabIndex={-1} data-autofocus>{AI_CARDS.find((c) => c.id === keyFor)?.name} API 키 연결 <span class="small muted">처음 한 번만</span></h2>
          <AiConnect initial={keyFor} only onConnected={connected} /></div>}
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
