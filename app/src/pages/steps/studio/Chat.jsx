import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Notice } from '../../../components/ui.jsx';
import { ConnBadge } from '../../../components/PcConnect.jsx';
import { chatEditPrompt, acceptChatAnswer, resumeGeneration, forgetGeneration, stopGeneration } from '../../../lib/studio.js';
import { CHATBOTS, setChatbot } from '../../../lib/ai.js';
import { useConnection } from '../../../lib/connection.js';
import { toast, copy } from '../../../lib/util.js';
import { fmtSec, errorActions } from '../Make.jsx';
import { verTime } from './Parts.jsx';

// AI 수정 대화: 요청 → AI의 답(무엇을 했고 어디가 바뀌었는지) → 그 결과 버전. 연수마다 p.chat에 남아 새로 고쳐도 이어짐.
// 보내는 곳: 연결한 AI(계정·API 키·내 PC의 AI 에이전트)는 바로 고치고 답이 대화에 붙음(gen/job.js finish),
// 쓰던 AI로는 대화 안에서 프롬프트 복사 → 답 붙여 넣기(gen/index.js acceptChatAnswer가 답을 대화에 붙임).

/** 보낼 곳: 이 사이트를 만든 연결이 지금 되면 그것, 아니면 고른 연결, 둘 다 없으면 쓰던 AI로 */
export function useWay(p) {
  const { list, conn: pick, loading } = useConnection({ demo: !!p.demo });
  const [way, setWay] = useState('');
  useEffect(() => {
    if (loading || (way && (way === 'chat' || list.some((c) => c.id === way)))) return;
    const g = p.gen || {};
    const made = g.way === 'chatgpt' ? 'chatgpt' : g.way === 'local' ? g.agent : g.way === 'key' ? 'key' : '';
    setWay(list.some((c) => c.id === made) ? made : pick?.id || 'chat');
  }, [loading, list.map((c) => c.id).join()]);
  return { list, way, setWay, cur: list.find((c) => c.id === way) || null };
}

const EXAMPLES = ['첫 화면 제목을 더 짧고 힘 있게', '실습마다 걸리는 시간을 적어 줘', '색을 교재 표지처럼 차분하게'];
const isPending = (m) => m?.role === 'user' && !m.cancelled;

/** 대화 기록(스크롤 칸 안) */
export function ChatLog({ p, update, job, go, idle, reload, versions, onShow, onVersion, onRestore, onPick, onResend, onPreview }) {
  const chat = Array.isArray(p.chat) ? p.chat : [];
  const last = chat[chat.length - 1];
  const pending = isPending(last) ? last : null;
  const edit = job.kind === 'edit' || job.kind === 'fix';
  const working = edit && job.status === 'running';
  const failed = edit && (job.status === 'error' || job.status === 'paused');
  const arriving = pending && edit && job.status === 'done' && (job.startedAt || 0) >= (pending.at || 0) - 2000;
  const endRef = useRef(); const seen = useRef(null);
  // 새 줄이 생기면 대화 끝이 보이게(처음 열 때는 그대로: 연수 정보부터 보이게)
  useLayoutEffect(() => {
    const n = chat.length + (working ? 1 : 0) + (failed ? 1 : 0);
    if (seen.current !== null && n > seen.current) endRef.current?.scrollIntoView({ block: 'nearest' });
    seen.current = n;
  }, [chat.length, working, failed]);
  const cancel = () => update((cur) => ({ chat: (cur.chat || []).map((m, i, a) => (i === a.length - 1 && isPending(m) ? { ...m, cancelled: true } : m)) }));
  return (
    <section class="st-chat" aria-labelledby="st-chat-h">
      <h2 id="st-chat-h" class="st-h">AI로 수정</h2>
      {!chat.length && !working && <div class="st-empty">
        <p class="small muted">바꿀 점을 아래에 적어 보내면 AI가 사이트를 고쳐요. 이어서 몇 번이든 고칠 수 있고, 고칠 때마다 버전 기록에 남아요.</p>
        <div class="st-ex">{EXAMPLES.map((t) => <button type="button" class="chip" onClick={() => onPick(t)}>{t}</button>)}</div>
      </div>}
      <ol class="st-log">
        {chat.map((m, i) => (m.role === 'user'
          ? <li class="st-msg is-me" key={m.id}>
            <div class="st-bubble">{m.text}</div>
            <small class="st-meta">{[m.targetName ? `고칠 곳: ${m.targetName}` : '', m.wayName, verTime(m.at), m.cancelled ? '취소함' : ''].filter(Boolean).join(' · ')}</small>
          </li>
          : <li class="st-msg is-ai" key={m.id}>
            <AiMsg m={m} latest={i === chat.length - 1} versions={versions} onShow={onShow} onVersion={onVersion} onRestore={onRestore} onPreview={onPreview} />
          </li>))}
      </ol>
      {working && <Working job={job} onStop={() => stopGeneration(p.id)} />}
      {failed && <Failed p={p} job={job} go={go} />}
      {pending && !working && !failed && (pending.way === 'chat'
        ? <ChatWay p={p} m={pending} idle={idle} reload={reload} onCancel={cancel} />
        : !arriving && <div class="st-msg is-ai"><div class="st-bubble is-quiet"><span>답을 받지 못했어요. 중지했거나 창을 닫았을 수 있어요.</span>
          <div class="btn-row"><button type="button" class="btn btn-sm btn-primary" onClick={() => onResend(pending)}>다시 보내기</button><button type="button" class="btn btn-sm btn-quiet" onClick={cancel}>취소</button></div></div></div>)}
      <span ref={endRef} class="st-end" aria-hidden="true" />
    </section>
  );
}

/** AI의 답: 한 일, 바뀐 곳(누르면 미리보기가 그 섹션으로), 결과 버전(버전 기록), 마지막 답이면 [수정 전으로 복원] */
function AiMsg({ m, latest, versions, onShow, onVersion, onRestore, onPreview }) {
  const i = versions.findIndex((v) => v.id === m.versionId);
  const v = i >= 0 ? versions[i] : null;
  const before = i >= 0 ? versions[i + 1] : null;
  const changed = m.changed || [];
  return (
    <div class="st-bubble">
      <b>{m.text}</b>
      {changed.length > 0 && <span class="st-changed small">바뀐 곳: {changed.slice(0, 5).map((c) => (c.id ? <button type="button" class="st-tag" onClick={() => onShow(c.id)} title="미리보기에서 보기">{c.name}</button> : <span class="st-tag">{c.name}</span>))}{changed.length > 5 ? ` 외 ${changed.length - 5}곳` : ''}</span>}
      {(m.design || m.meta) && <span class="small muted">{[m.design ? '색·글꼴' : '', m.meta ? '연수 정보' : ''].filter(Boolean).join('·')}도 바뀌었어요.</span>}
      <span class="st-ver small">
        {v ? <button type="button" class="btn-link small" onClick={() => onVersion(v.id)}>버전 기록 · {verTime(v.at)}</button> : <span class="muted">버전 기록에 남았어요</span>}
        {latest && i === 0 && before && <button type="button" class="btn-link small" onClick={() => onRestore(before)}>수정 전으로 복원</button>}
        <button type="button" class="btn-link small st-only-narrow" onClick={onPreview}>미리보기에서 보기</button>
      </span>
    </div>
  );
}

/** AI가 고치는 동안: 진행 단계·걸린 시간·[중지] */
function Working({ job, onStop }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  return (
    <div class="st-msg is-ai" role="status" aria-live="polite"><div class="st-bubble is-working">
      <span class="ai-job-dot" aria-hidden="true" />
      <span class="st-work-t"><b>{job.kind === 'fix' ? 'AI가 꼭 고칠 곳을 고치고 있어요' : 'AI가 요청대로 고치고 있어요'}</b>
        <small>{job.step ? `${job.step.label_ko} · ` : ''}{fmtSec((Date.now() - (job.startedAt || Date.now())) / 1000)} · 끝나면 미리보기가 바뀌어요.</small></span>
      <button type="button" class="btn btn-sm btn-quiet" onClick={onStop}>중지</button>
    </div></div>
  );
}

/** AI가 고치다 멈춤: 까닭과 할 일(계속·키 페이지 등·취소). 지금 사이트는 그대로 */
function Failed({ p, job, go }) {
  const acts = [...(job.status === 'paused' ? [{ id: 'resume', label: '계속', run: () => resumeGeneration(p.id) }] : errorActions(p, job, go).filter((a) => a.id !== 'connect' && a.id !== 'paste')),
    { id: 'forget', label: '취소', run: () => forgetGeneration(p.id) }];
  const e = job.error || {};
  return (
    <div class="st-msg is-ai" role="alert"><div class="st-bubble is-bad">
      <b>{job.status === 'paused' ? 'AI가 수정을 멈췄어요.' : e.title || 'AI가 고치지 못했어요.'}</b>
      <small>{job.status === 'paused' ? '지금 사이트는 그대로예요. [계속]을 누르면 멈춘 단계부터 해요.' : `${e.body || ''} 지금 사이트는 그대로예요. 아래에서 보낼 곳을 바꿔 다시 보낼 수도 있어요.`.trim()}</small>
      <div class="btn-row">{acts.map((a, i) => (a.href ? <a class={`btn btn-sm${i ? '' : ' btn-primary'}`} href={a.href} target="_blank" rel="noopener">{a.label}<span class="ext" aria-hidden="true">↗</span></a>
        : <button type="button" class={`btn btn-sm${i ? ' btn-quiet' : ' btn-primary'}`} onClick={a.run}>{a.label}</button>))}</div>
    </div></div>
  );
}

/** 쓰던 AI로: 프롬프트 복사 → 쓰던 AI에 보내기 → 답 붙여 넣기(대화 안에서) */
function ChatWay({ p, m, idle, reload, onCancel }) {
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const target = m.target || 'all';
  useEffect(() => {
    let off = false; setPrompt('');
    (async () => { await idle(); const v = String(await chatEditPrompt(p.id, { target, request: m.text }) || ''); if (!off) setPrompt(v); })();
    return () => { off = true; };
  }, [m.id]);
  async function take(input) {
    if (!input || busy) return; setBusy(true);
    try {
      await idle();
      const r = await acceptChatAnswer(p.id, input, { target }); setRes(r); if (r.continuePrompt) setAnswer('');
      if (r.ok) { await reload(); setAnswer(''); setRes(null); toast('답대로 고쳤어요. 마음에 안 들면 [버전 기록]에서 복원해요.'); }
    } catch (e) { console.error(e); setRes({ ok: false, problems: ['답을 읽지 못했어요. AI 답의 코드 블록을 다시 복사해 주세요.'] }); }
    setBusy(false);
  }
  return (
    <div class="st-msg is-ai"><div class="st-bubble st-chatway">
      <b>쓰던 AI에 보내고 답을 넣어 주세요</b>
      <ol class="chat-steps">
        <li><span>프롬프트를 복사해 쓰던 AI에 붙여 넣어요</span>
          <div class="btn-row">{CHATBOTS.map((b) => <a class="btn btn-sm" href={b.url} target="_blank" rel="noopener" onClick={(e) => { if (!prompt) { e.preventDefault(); toast('프롬프트를 만드는 중이에요. 잠깐 뒤 다시 눌러 주세요.'); return; } copy(prompt, `프롬프트를 복사했어요. ${b.name}에 붙여 넣으세요.`); setChatbot(b.id); }}>{b.name} 열기<span class="ext" aria-hidden="true">↗</span></a>)}</div>
          <small class="muted">{target === 'all' ? '사이트 전체를 보내요. 길면 답이 끊길 수 있어 고칠 곳(섹션)을 고르는 편이 좋아요.' : '고른 섹션만 보내고, 답의 섹션만 갈아 끼워요.'}</small></li>
        <li><span>AI 답을 넣어요</span>
          {res && !res.ok && <div role="alert"><Notice kind="bad"><div class="stack" style={{ gap: '6px' }}><b>{res.continuePrompt ? '답이 중간에 끊겼어요.' : '이 답으로는 고칠 수 없어요.'}</b>{!res.continuePrompt && (res.problems || []).map((x) => <span>{x}</span>)}
            {res.continuePrompt && <><span>[이어쓰기 프롬프트 복사]를 눌러 AI에 보내고, 이어진 답을 붙여 넣어요. 앞의 답은 기억해 둬요.</span><div><button type="button" class="btn btn-sm btn-primary" onClick={() => copy(res.continuePrompt, '복사했어요. AI에게 보내세요.')}>이어쓰기 프롬프트 복사</button></div></>}</div></Notice></div>}
          <textarea class="input ta-short" rows={3} value={answer} onInput={(e) => setAnswer(e.target.value)} placeholder="AI 답(코드 블록)을 여기에 붙여 넣어요" aria-label="AI의 답" />
          <div class="btn-row"><button type="button" class="btn btn-sm btn-primary" disabled={busy || !answer.trim()} onClick={() => take(answer)}>{busy ? '읽는 중…' : res?.continuePrompt ? '이어진 답으로 수정' : '이 답으로 수정'}</button><button type="button" class="btn btn-sm btn-quiet" onClick={onCancel}>취소</button></div></li>
      </ol>
    </div></div>
  );
}

/** 입력 칸(아래에 고정): 고칠 곳 · 보낼 곳 · 바라는 점 → [보내기]. Enter로 보내고 Shift+Enter로 줄 바꿈 */
export function Composer({ p, sections, ask, setAsk, ways, way, setWay, locked, onSend }) {
  const ta = useRef();
  const target = sections.some((s) => s.id === ask.target) ? ask.target : 'all';
  const ready = ask.request.trim().length > 1 && !locked;
  useEffect(() => { if (ask.n) { ta.current?.focus(); ta.current?.setSelectionRange?.(ask.request.length, ask.request.length); } }, [ask.n]);
  // 쓴 만큼 늘어남(6줄까지)
  useLayoutEffect(() => { const el = ta.current; if (!el) return; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 160)}px`; }, [ask.request]);
  const send = () => { if (ready) onSend(ask.request.trim(), target); };
  const opts = [...ways.map((c) => [c.id, c.label]), ['chat', '쓰던 AI로']];
  return (
    <div class="st-compose">
      <div class="st-compose-opts">
        <label class="st-target"><span class="sr">고칠 곳</span>
          <select class="input" value={target} onChange={(e) => setAsk({ ...ask, target: e.target.value })} aria-label="고칠 곳"><option value="all">사이트 전체</option>{sections.map((s) => <option value={s.id}>{s.name}</option>)}</select></label>
        {opts.length > 1 && <label class="st-way"><span class="sr">보낼 곳</span>
          <select class="input" value={way} onChange={(e) => setWay(e.target.value)} aria-label="보낼 곳">{opts.map(([v, label]) => <option value={v}>{label}</option>)}</select></label>}
      </div>
      <div class="st-compose-row">
        <textarea ref={ta} class="input" rows={1} maxLength={1500} value={ask.request} disabled={locked}
          placeholder={locked ? 'AI가 고치는 중이에요. 끝나면 이어서 보낼 수 있어요.' : '무엇을 바꿀까요? 예: 실습 단계를 세 개로 나눠 줘'} aria-label="AI에게 보낼 수정 요청"
          onInput={(e) => setAsk({ ...ask, request: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); send(); } }} />
        <button type="button" class="btn btn-primary st-send" disabled={!ready} onClick={send} aria-label="보내기">보내기</button>
      </div>
      {p.demo ? <p class="small muted">체험이라 연결한 AI에는 보내지 않아요. 쓰던 AI로는 실제처럼 해 볼 수 있어요.</p> : way !== 'chat' && <ConnBadge hint={false} />}
    </div>
  );
}
