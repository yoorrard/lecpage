import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { projects } from '../lib/db.js';
import { debounce, toast, saveFile, safeName } from '../lib/util.js';
import { exportProjectFile, stageOf } from '../lib/project.js';
import { Mascot } from '../components/Mascot.jsx';
import { StepStart } from './steps/Start.jsx';
import { StepEdit } from './steps/Edit.jsx';
import { StepShare } from './steps/Share.jsx';

export const STEPS = [
  { n: 1, name: '교재 넣기', C: StepStart },
  { n: 2, name: '살펴보고 고치기', C: StepEdit },
  { n: 3, name: '공개하기', C: StepShare },
];

export function Project({ id, step }) {
  const [p, setP] = useState(null);
  const [missing, setMissing] = useState(false);
  const ref = useRef(null);
  const headRef = useRef(null);
  const save = useMemo(() => debounce((v) => projects.put(v).catch(() => toast('저장하지 못했어요. 저장 공간을 확인해 주세요.')), 400), []);
  useEffect(() => { projects.get(id).then((v) => { if (!v) setMissing(true); else { if (!v.stage) v.stage = stageOf(v.step || 1); ref.current = v; setP(v); } }); }, [id]);
  const s = step > 3 ? stageOf(step) : Math.min(3, Math.max(1, step || p?.stage || 1));
  useEffect(() => { if (p && p.stage !== s) update({ stage: s, visited: { ...(p.visited || {}), [s]: true } }); }, [s, !!p]);
  // 단계가 바뀌면 그 단계 제목으로 초점을 옮겨 화면 읽기 프로그램이 알 수 있게
  useEffect(() => { if (p) setTimeout(() => document.querySelector('.wiz-main h1')?.focus({ preventScroll: true }), 30); }, [s, !!p]);
  // 고치기 단계는 미리보기 자리를 넓게(화면 폭 가득)
  useEffect(() => { const h = document.documentElement; h.classList.toggle('is-wide', s === 2); return () => h.classList.remove('is-wide'); }, [s]);
  function update(patch) {
    const next = { ...ref.current, ...(typeof patch === 'function' ? patch(ref.current) : patch) };
    if (next.blueprint?.meta?.title) next.title = next.blueprint.meta.title; else if (next.info?.title) next.title = next.info.title;
    ref.current = next; setP(next); save(next);
  }
  if (missing) return <div class="empty"><Mascot size={84} mood="oops" /><p>이 연수를 찾지 못했어요. 다른 브라우저에서 만들었다면 그 브라우저에서 '파일로 저장'한 뒤 여기서 열어 주세요.</p><a class="btn" href="#/">처음으로</a></div>;
  if (!p) return <p class="muted">불러오는 중…</p>;
  const cur = STEPS.find((x) => x.n === s) || STEPS[0];
  const go = (n) => { location.hash = `#/p/${id}/${n}`; };
  const done = (n) => (n === 1 ? !!p.blueprint : n === 2 ? !!p.visited?.[3] : !!p.deploy?.lastUrl);
  async function saveProjectFile() { const z = await exportProjectFile(p); saveFile(safeName(p.title) + '.lecpage', z, 'application/zip'); toast('프로젝트 파일을 저장했어요. 다른 컴퓨터의 lecpage에서 열 수 있어요.'); }
  return (
    <div class={`wiz stage-${s}`}>
      <header class="wiz-head">
        <p class="wiz-title" title={p.title || '새 연수'}>{p.title || '새 연수'}</p>
        <ol class="stepper" aria-label="만드는 순서">
          {STEPS.map((x) => (
            <li><a href={`#/p/${id}/${x.n}`} class={done(x.n) && x.n !== s ? 'done' : ''} aria-current={x.n === s ? 'step' : undefined} aria-disabled={x.n > 1 && !p.blueprint ? 'true' : undefined} onClick={(e) => { if (x.n > 1 && !p.blueprint) { e.preventDefault(); toast('먼저 사이트 초안을 만들어 주세요.'); } }}><span class="n">{x.n}</span><span class="t">{x.name}</span></a></li>
          ))}
        </ol>
        <div class="side-tools">
          <span class="small muted" title="이 브라우저에 자동으로 저장돼요">자동 저장</span>
          <button class="btn btn-sm" onClick={saveProjectFile} title="다른 컴퓨터에서 이어 하려면 파일로 저장해 옮기세요">파일로 저장</button>
        </div>
      </header>
      <div class="wiz-main"><cur.C p={p} update={update} go={go} /></div>
    </div>
  );
}

export function StepHead({ title, desc, children }) {
  return <div class="step-head"><div class="step-head-t"><h1 tabIndex={-1}>{title}</h1>{desc && <p>{desc}</p>}</div>{children}</div>;
}
