import { useEffect, useState } from 'preact/hooks';
import { StepHead } from '../Project.jsx';
import { Mascot } from '../../components/Mascot.jsx';
import { resumeGeneration, stopGeneration } from '../../lib/studio.js';
import { PROVIDERS } from '../../lib/ai.js';
import { isV2 } from '../../lib/site-meta.js';
import { AGENT_NAME } from '../../lib/agent.js';
import { Studio } from './Studio.jsx';

// 2단계: AI가 만드는 동안은 진행 단계만(목록·미리보기 없음), 다 만들면 같은 자리에서 완성 화면(Studio)으로.
// job: 생성 API useGeneration(lib/gen/index.js)의 상태. step.index는 1부터
/** 지금 작업을 맡은 AI 이름 */
export const whoOf = (job) => (job.way === 'local' ? AGENT_NAME[job.agent] || '내 PC의 AI' : job.way === 'demo' ? '' : PROVIDERS[job.provider]?.short || '');
export function fmtSec(s) { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); return m ? `${m}분 ${s % 60}초` : `${s}초`; }

export function StepMake(props) {
  const { p } = props;
  if (isV2(p)) return <Studio {...props} />;
  return <Making {...props} />;
}

function useNow(on) {
  const [, tick] = useState(0);
  useEffect(() => { if (!on) return undefined; const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, [on]);
  return Date.now();
}

/** 오류 안내의 단추(생성 쪽 error.actions) → 할 일 */
export function errorActions(p, job, go) {
  const prov = PROVIDERS[job.provider] || {};
  const LABEL = { resume: '이어서 만들기', connect: '다른 AI 고르기', paste: '쓰던 AI 창으로(키 없이)', key: '키 페이지 열기', billing: '결제 페이지 열기', link: job.error?.link?.label || '확인 페이지 열기' };
  const HREF = { key: prov.keyUrl, billing: prov.billingUrl, link: job.error?.link?.href };
  const toChat = () => { try { sessionStorage.setItem('lecpage:open-chat', PROVIDERS[job.provider] ? job.provider : 'openai'); } catch { /* 저장이 막힌 창: 교재 넣기 화면에서 고름 */ } go(1); };
  const run = (id) => (id === 'resume' ? resumeGeneration(p.id) : id === 'paste' ? toChat() : go(1));
  return (job.error?.actions || []).filter((id) => LABEL[id] && (!(id in HREF) || HREF[id])).map((id) => ({ id, label: LABEL[id], href: HREF[id] || '', run: () => run(id) }));
}

/** 만드는 중: 진행 단계·걸린 시간·멈춤/이어 하기·실패 안내만 */
function Making({ p, job, go }) {
  const running = job.status === 'running';
  const now = useNow(running);
  const acts = errorActions(p, job, go);
  if (job.status === 'idle' || !job.steps?.length) {
    return (
      <>
        <StepHead title="AI가 만들기" desc="교재를 넣고 AI를 고르면 여기서 만드는 과정을 보여 줘요." />
        <div class="making-empty"><Mascot size={84} mood="idle" /><p>아직 만들지 않았어요.</p><button type="button" class="btn btn-primary" onClick={() => go(1)}>교재 넣고 AI 고르기</button></div>
      </>
    );
  }
  const spent = ((running ? now : job.endedAt || now) - (job.startedAt || now)) / 1000;
  const name = whoOf(job);
  const e = job.error || {};
  const wait = job.wait && running ? (job.wait.reason === 'hidden' ? '이 탭이 가려져 있어 잠깐 멈췄어요. 돌아오면 이어서 해요.'
    : `${job.wait.reason === 'quota' ? 'AI 회사의 사용 한도에 닿아' : '연결이 끊겨'} ${Math.max(1, Math.ceil((job.wait.until - now) / 1000))}초 뒤에 그 단계부터 다시 해요.`) : '';
  return (
    <>
      <StepHead title={job.status === 'error' ? 'AI가 만들다 멈췄어요' : job.status === 'paused' ? '만들기를 멈췄어요' : 'AI가 사이트를 만들고 있어요'}
        desc={job.way === 'demo' ? '체험: 이 교재로 미리 만든 AI 답을 진짜 만드는 과정 그대로 보여 줘요.' : [name && `${name}${job.model ? ` · ${job.model}` : ''}`, job.way === 'local' ? '내 PC에서' : ''].filter(Boolean).join(' · ') || '고른 AI가 교재를 직접 읽고 있어요.'} />
      <section class="making" aria-labelledby="making-h">
        <div class="making-top">
          <Mascot size={72} mood={job.status === 'error' ? 'oops' : 'think'} look={running} />
          <div class="stack" style={{ gap: '2px' }}>
            <h2 class="h-sub" id="making-h" aria-live="polite">{job.step ? `${job.step.label_ko} (${job.step.index}/${job.step.total})` : '마무리하는 중'}</h2>
            <p class="small muted making-time"><span>걸린 시간 {fmtSec(spent)}</span>{job.step?.received > 0 && running ? <span> · 받은 글 {job.step.received.toLocaleString('ko-KR')}자</span> : ''}{job.way === 'demo' ? '' : <span> · 보통 3~6분 걸려요</span>}</p>
          </div>
        </div>
        <ol class="making-steps" aria-label="만드는 단계">
          {job.steps.map((x, i) => <li class={`is-${x.status}`} aria-current={job.step?.index === i + 1 && running ? 'step' : undefined}>
            <span class="mk-dot" aria-hidden="true">{x.status === 'done' ? '✓' : x.status === 'error' ? '!' : i + 1}</span>
            <span class="mk-t">{x.label_ko}</span>
            <span class="mk-s small">{x.status === 'done' ? '끝' : x.status === 'running' ? '하는 중' : x.status === 'error' ? '멈춤' : '기다림'}{x.attempts > 1 ? ` · ${x.attempts}번째` : ''}</span>
          </li>)}
        </ol>
        {wait && <p class="small" role="status">{wait}</p>}
        {job.elsewhere && <p class="small" role="status">다른 탭에서 만드는 중이에요. 그 탭을 닫으면 이 탭이 이어서 해요.</p>}
        {job.status === 'error' && <div class="ai-job bad" role="alert"><span class="ai-job-t"><b>{e.title || '만들지 못했어요.'}</b><small>{e.body || '앞 단계까지 만든 것은 남아 있어요.'}</small></span>
          {acts.map((a, i) => (a.href ? <a class={`btn btn-sm${i ? '' : ' btn-primary'}`} href={a.href} target="_blank" rel="noopener">{a.label}<span class="ext" aria-hidden="true">↗</span></a>
            : <button type="button" class={`btn btn-sm${i ? '' : ' btn-primary'}`} onClick={a.run}>{a.label}</button>))}
          {e.kind === 'no-material' ? <button type="button" class="btn btn-sm btn-primary" onClick={() => go(1)}>교재 넣기</button>
            : !acts.some((a) => a.id === 'resume') && <button type="button" class={`btn btn-sm${acts.length ? '' : ' btn-primary'}`} onClick={() => resumeGeneration(p.id)}>다시 해 보기</button>}
        </div>}
        <div class="btn-row">
          {running && <button type="button" class="btn" onClick={() => stopGeneration(p.id)}>멈추기</button>}
          {job.status === 'paused' && <button type="button" class="btn btn-primary" onClick={() => resumeGeneration(p.id)}>이어서 만들기</button>}
          {(job.status === 'paused' || (job.status === 'error' && !acts.some((a) => a.id === 'connect'))) && <button type="button" class="btn btn-quiet" onClick={() => go(1)}>다른 AI 고르기</button>}
        </div>
        <p class="small muted">{p.demo ? '체험이라 키가 필요 없고 어디로도 보내지 않아요.' : '창을 닫거나 다른 일을 해도 돼요. 다시 열면 멈춘 단계부터 이어서 해요. 다 만들면 미리보기와 목록이 열려요.'}</p>
      </section>
    </>
  );
}
