import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { projects } from '../lib/db.js';
import { debounce, toast } from '../lib/util.js';
import { Mascot } from '../components/Mascot.jsx';
import { StepMaterials } from './steps/Materials.jsx';
import { StepInfo } from './steps/Info.jsx';
import { StepGenerate } from './steps/Generate.jsx';
import { StepOutline } from './steps/Outline.jsx';
import { StepDesign } from './steps/Design.jsx';
import { StepOperate } from './steps/Operate.jsx';
import { StepPublish } from './steps/Publish.jsx';

export const STEPS = [
  { n: 1, name: '자료', C: StepMaterials },
  { n: 2, name: '연수 정보', C: StepInfo },
  { n: 3, name: 'AI 설계', C: StepGenerate },
  { n: 4, name: '내용 다듬기', C: StepOutline },
  { n: 5, name: '디자인', C: StepDesign },
  { n: 6, name: '운영 방식', C: StepOperate },
  { n: 7, name: '완성·배포', C: StepPublish },
];

export function Project({ id, step }) {
  const [p, setP] = useState(null);
  const [missing, setMissing] = useState(false);
  const ref = useRef(null);
  const save = useMemo(() => debounce((v) => projects.put(v).catch(() => toast('저장하지 못했어요. 저장 공간을 확인해 주세요.')), 400), []);
  useEffect(() => { projects.get(id).then((v) => { if (!v) setMissing(true); else { ref.current = v; setP(v); } }); }, [id]);
  const s = step || p?.step || 1;
  useEffect(() => { if (p && p.step !== s) update({ step: s }); }, [s, !!p]);
  function update(patch) {
    const next = { ...ref.current, ...(typeof patch === 'function' ? patch(ref.current) : patch) };
    if (next.blueprint?.meta?.title) next.title = next.blueprint.meta.title; else if (next.info?.title) next.title = next.info.title;
    ref.current = next; setP(next); save(next);
  }
  if (missing) return <div class="empty"><Mascot size={84} mood="oops" /><p>이 연수를 찾지 못했어요. 다른 브라우저에서 만들었다면 그 브라우저에서 프로젝트 파일(.lecpage)로 내보내 여기서 열어 주세요.</p><a class="btn" href="#/">처음으로</a></div>;
  if (!p) return <p class="muted">불러오는 중…</p>;
  const cur = STEPS.find((x) => x.n === s) || STEPS[0];
  const go = (n) => { location.hash = `#/p/${id}/${n}`; };
  const doneUpTo = p.blueprint ? 4 : p.material || p.info?.title ? 2 : 0;
  return (
    <div class="wiz">
      <aside class="wiz-side">
        <div class="wiz-title">{p.title || '새 연수'}</div>
        <ol class="stepper">
          {STEPS.map((x) => (
            <li><a href={`#/p/${id}/${x.n}`} class={x.n <= doneUpTo && x.n !== s ? 'done' : ''} aria-current={x.n === s ? 'step' : undefined}><span class="n">{x.n}</span><span>{x.name}</span></a></li>
          ))}
        </ol>
        <p class="small muted">자동으로 저장돼요. 다른 컴퓨터에서 이어 하려면 7단계에서 프로젝트 파일을 내려받으세요.</p>
      </aside>
      <div class="wiz-main"><cur.C p={p} update={update} go={go} /></div>
    </div>
  );
}

export function StepHead({ title, desc }) {
  return <div class="step-head"><h1>{title}</h1>{desc && <p>{desc}</p>}</div>;
}
export function StepFoot({ go, prev, next, nextLabel = '다음', disabled }) {
  return (
    <div class="step-foot">
      {prev ? <button class="btn btn-quiet" onClick={() => go(prev)}>이전</button> : <span />}
      {next && <button class="btn btn-primary" disabled={disabled} onClick={() => go(next)}>{nextLabel}</button>}
    </div>
  );
}
