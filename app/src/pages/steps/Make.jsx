import { useEffect, useState } from 'preact/hooks';
import { StepHead } from '../Project.jsx';
import { Mascot } from '../../components/Mascot.jsx';
import { resumeGeneration, stopGeneration } from '../../lib/studio.js';
import { stopReplay } from '../../lib/demo.js';
import { PROVIDERS } from '../../lib/ai.js';
import { isV2 } from '../../lib/site-meta.js';
import { Studio } from './Studio.jsx';

// 2단계: AI가 만드는 동안은 진행 단계만(목록·미리보기 없음), 다 만들면 같은 자리에서 완성 화면(Studio)으로.
const WHO = { 'claude-code': 'Claude Code', codex: 'Codex' };
const who = (job) => WHO[job.provider] || PROVIDERS[job.provider]?.short || '';
export function fmtSec(s) { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); return m ? `${m}분 ${s % 60}초` : `${s}초`; }

export function StepMake(props) {
  const { p, job } = props;
  if (isV2(p)) return <Studio {...props} />;
  return <Making {...props} />;
}

function useNow(on) {
  const [, tick] = useState(0);
  useEffect(() => { if (!on) return undefined; const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, [on]);
  return Date.now();
}

/** 만드는 중: 진행 단계·걸린 시간·멈춤/이어 하기·실패 안내만 */
function Making({ p, job, go }) {
  const running = job.status === 'running';
  const now = useNow(running);
  if (job.status === 'idle' || !job.steps?.length) {
    return (
      <>
        <StepHead title="AI가 만들기" desc="교재를 넣고 AI를 고르면 여기서 만드는 과정을 보여 줘요." />
        <div class="making-empty"><Mascot size={84} mood="idle" /><p>아직 만들지 않았어요.</p><button type="button" class="btn btn-primary" onClick={() => go(1)}>교재 넣고 AI 고르기</button></div>
      </>
    );
  }
  const rep = job.replay; // 체험: 녹화 다시 보기(실제 시간 = 보여 준 시간 × 빠르기)
  const spent = ((job.status === 'running' ? now : job.doneAt || now) - (job.startedAt || now)) / 1000 * (rep?.speed || 1);
  const name = who(job);
  const e = job.error || {};
  const acts = (e.actions || []).map((a) => (typeof a === 'string' ? { id: a } : a));
  const stop = () => (p.demo ? stopReplay(p.id) : stopGeneration(p.id));
  function act(a) {
    if (a.id === 'resume' || a.id === 'retry') resumeGeneration(p.id);
    else if (a.id === 'chat') { try { sessionStorage.setItem('lecpage:open-chat', job.provider || 'openai'); } catch { } go(1); }
    else if (a.id === 'connect' || a.id === 'other') go(1);
  }
  const LABEL = { resume: '이어서 하기', retry: '다시 하기', chat: '쓰던 앱으로(키 없이)', connect: '다른 AI 고르기', other: '다른 AI 고르기' };
  return (
    <>
      <StepHead title={job.status === 'error' ? 'AI가 만들다 멈췄어요' : job.status === 'paused' ? '만들기를 멈췄어요' : 'AI가 사이트를 만들고 있어요'}
        desc={[name && `${name}${job.model ? ` · ${job.model}` : ''}`, job.way === 'local' ? '내 PC에서' : job.way === 'chat' ? '쓰던 앱으로' : ''].filter(Boolean).join(' · ') || '고른 AI가 교재를 직접 읽고 있어요.'} />
      <section class="making" aria-labelledby="making-h">
        <div class="making-top">
          <Mascot size={72} mood={job.status === 'error' ? 'oops' : 'think'} look={running} />
          <div class="stack" style={{ gap: '2px' }}>
            <h2 class="h-sub" id="making-h" aria-live="polite">{job.step ? `${job.step.label_ko} (${job.step.index + 1}/${job.step.total})` : '마무리하는 중'}</h2>
            <p class="small muted making-time"><span>걸린 시간 {fmtSec(spent)}</span>{rep ? <span> · 녹화한 실제 작업을 빨리 보여 줘요(실제로는 {fmtSec(rep.took)})</span> : <span> · 보통 3~6분 걸려요</span>}</p>
          </div>
        </div>
        <ol class="making-steps" aria-label="만드는 단계">
          {job.steps.map((x, i) => <li class={`is-${x.status}`} aria-current={job.step?.index === i && running ? 'step' : undefined}>
            <span class="mk-dot" aria-hidden="true">{x.status === 'done' ? '✓' : x.status === 'error' ? '!' : i + 1}</span>
            <span class="mk-t">{x.label_ko}</span>
            <span class="mk-s small">{x.status === 'done' ? '끝' : x.status === 'running' ? '하는 중' : x.status === 'error' ? '멈춤' : '기다림'}{x.attempts > 1 ? ` · ${x.attempts}번째` : ''}</span>
          </li>)}
        </ol>
        {job.status === 'error' && <div class="ai-job bad" role="alert"><span class="ai-job-t"><b>{e.title || '만들지 못했어요.'}</b><small>{e.body || '앞 단계까지 만든 것은 남아 있어요.'}</small></span>
          {acts.map((a, i) => (a.href ? <a class={`btn btn-sm${i ? '' : ' btn-primary'}`} href={a.href} target="_blank" rel="noopener">{a.label || '열기'}</a>
            : <button type="button" class={`btn btn-sm${i ? '' : ' btn-primary'}`} onClick={() => act(a)}>{a.label || LABEL[a.id] || '다시 하기'}</button>))}
          {!acts.length && <button type="button" class="btn btn-sm btn-primary" onClick={() => resumeGeneration(p.id)}>이어서 하기</button>}
        </div>}
        <div class="btn-row">
          {running && <button type="button" class="btn" onClick={stop}>멈추기</button>}
          {job.status === 'paused' && !p.demo && <button type="button" class="btn btn-primary" onClick={() => resumeGeneration(p.id)}>이어서 하기</button>}
          {(job.status === 'paused' || job.status === 'error') && <button type="button" class="btn btn-quiet" onClick={() => go(1)}>다른 AI 고르기</button>}
        </div>
        <p class="small muted">{p.demo ? '체험에서는 키 없이 녹화한 결과를 보여 줘요.' : '창을 닫거나 다른 일을 해도 돼요. 다시 열면 멈춘 단계부터 이어서 해요. 다 만들면 미리보기와 목록이 열려요.'}</p>
      </section>
    </>
  );
}
