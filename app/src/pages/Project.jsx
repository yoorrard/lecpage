import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { projects, onProjectChange, storageKind, STORAGE_MSG, askPersist } from '../lib/db.js';
import { toast, saveFile, safeName } from '../lib/util.js';
import { makeSaver, restoreDraft, dropDraft } from '../lib/saver.js';
import { exportProjectFile, stageOf } from '../lib/project.js';
import { Mascot } from '../components/Mascot.jsx';
import { StepStart } from './steps/Start.jsx';
import { StepEdit } from './steps/Edit.jsx';
import { StepShare } from './steps/Share.jsx';

export const STEPS = [
  { n: 1, name: '교재 넣기', C: StepStart },
  { n: 2, name: '살펴보고 고치기', C: StepEdit },
  { n: 3, name: '배포하기', C: StepShare },
];

export function Project({ id, step }) {
  const [p, setP] = useState(null);
  const [missing, setMissing] = useState(''); // '' | 'none'(없는 연수) | 'blocked'·'quota'·'other'(저장소를 읽지 못함)
  const ref = useRef(null);
  // 저장 상태: ok(자동 저장) · saving(저장 중…) · failed(저장 안 됨, err) · changed(다른 탭에서 고침) · gone(다른 탭에서 지움)
  const [st, setSt] = useState({ s: 'ok' });
  const [gen, setGen] = useState(0); // 다시 불러오면 단계 화면을 새로 그림(안의 상태가 옛 판을 들고 있지 않게)
  const saver = useMemo(() => makeSaver(id, 0, (s, err) => setSt((o) => (o.s === 'changed' || o.s === 'gone' ? o : { s, err }))), [id]);
  function load() {
    return projects.get(id).then((v) => {
      if (!v) { setMissing('none'); return; }
      const fixed = restoreDraft(v); // 새로 고침이 저장을 끊었으면 남겨 둔 임시본으로
      const cur = fixed || v;
      if (!cur.stage) cur.stage = stageOf(cur.step || 1);
      saver.reset(v.updatedAt || 0); ref.current = cur; setP(cur); setSt({ s: 'ok' }); setGen((g) => g + 1);
      if (fixed) { saver.put(cur); toast('새로 고치기 전에 고친 내용을 되살렸어요.'); } else dropDraft(id);
    }, (e) => setMissing(storageKind(e) || 'other'));
  }
  useEffect(() => { load(); }, [id]);
  // 같은 연수를 연 다른 탭이 저장하거나 지우면: 덮지 않고 멈춘 뒤 알림(합치지 않음)
  useEffect(() => onProjectChange((m) => {
    if (m.id !== id || !ref.current) return;
    if (m.type === 'deleted') { saver.halt('gone'); setSt({ s: 'gone' }); }
    else if (m.type === 'saved' && m.at > saver.base()) { saver.halt('changed'); setSt({ s: 'changed' }); }
  }), [id, saver]);
  // 떠날 때(탭 닫기·새로 고침·숨김·다른 화면): 아직 다 쓰지 못한 것은 임시본을 동기로 남기고 바로 씀(docs/interaction.md 9절)
  useEffect(() => {
    const now = () => { saver.stash(ref.current); saver.flush(); };
    const hide = () => { if (document.visibilityState === 'hidden') now(); };
    const back = () => saver.retry(); // 저장 공간을 비우고 돌아왔으면 다시 써 봄
    addEventListener('pagehide', now); document.addEventListener('visibilitychange', hide); addEventListener('focus', back);
    return () => { removeEventListener('pagehide', now); document.removeEventListener('visibilitychange', hide); removeEventListener('focus', back); saver.flush(); };
  }, [saver]);
  // 사이트 초안이 처음 생기면 한 번: 브라우저가 이 연수를 지우지 않게 보호를 청함(크롬 계열은 묻지 않고 정함. 파이어폭스는 묻는 창이 떠서 설정 화면 단추로만)
  useEffect(() => { if (p?.blueprint && !/Firefox\//.test(navigator.userAgent || '')) askPersist(); }, [!!p?.blueprint]);
  const s = step > 3 ? stageOf(step) : Math.min(3, Math.max(1, step || p?.stage || 1));
  useEffect(() => { if (p && p.stage !== s) update({ stage: s, visited: { ...(p.visited || {}), [s]: true } }); }, [s, !!p]);
  // 단계가 바뀌면 그 단계 제목으로 초점을 옮겨 화면 읽기 프로그램이 알 수 있게
  useEffect(() => { if (p) setTimeout(() => document.querySelector('.wiz-main h1')?.focus({ preventScroll: true }), 30); }, [s, !!p]);
  // 고치기 단계는 미리보기 자리를 넓게(화면 폭 가득)
  useEffect(() => { const h = document.documentElement; h.classList.toggle('is-wide', s === 2); return () => h.classList.remove('is-wide'); }, [s]);
  /** opt.now: 모아 쓰지 않고 바로 저장(다른 앱·창으로 나가기 직전처럼 잃으면 안 될 때) */
  function update(patch, opt) {
    const next = { ...ref.current, ...(typeof patch === 'function' ? patch(ref.current) : patch) };
    if (next.blueprint?.meta?.title) next.title = next.blueprint.meta.title; else if (next.info?.title) next.title = next.info.title;
    // 배포한 뒤 바뀌었는지(다시 배포 알림). 배포하면서 주소를 적는 것(deploy와 함께 바뀜)은 고친 것이 아님
    if (next.blueprint && next.blueprint !== ref.current.blueprint && next.deploy === ref.current.deploy) next.editedAt = Date.now();
    ref.current = next; setP(next); saver.put(next);
    if (opt?.now) saver.flush();
  }
  // 저장이 막힌 창은 위 띠(main.jsx StorageBar)가 까닭과 할 일을 알림
  if (missing) return <div class="empty"><Mascot size={84} mood="oops" /><p>{missing === 'none' ? "이 연수를 찾지 못했어요. 다른 브라우저에서 만들었다면 그 브라우저에서 '파일로 저장'한 뒤 여기서 열어 주세요." : missing === 'blocked' ? '이 창에서는 연수를 열 수 없어요.' : STORAGE_MSG[missing] || '이 브라우저의 저장소를 읽지 못했어요. 새로 고침해 주세요.'}</p><a class="btn" href="#/">처음으로</a></div>;
  if (st.s === 'gone') return <div class="empty"><Mascot size={84} mood="oops" /><p>이 연수는 다른 탭에서 지웠어요.</p><a class="btn" href="#/">처음으로</a></div>;
  if (!p) return <p class="muted">불러오는 중…</p>;
  const cur = STEPS.find((x) => x.n === s) || STEPS[0];
  const go = (n) => { location.hash = `#/p/${id}/${n}`; };
  const done = (n) => (n === 1 ? !!p.blueprint : n === 2 ? !!p.visited?.[3] : !!p.deploy?.lastUrl);
  async function saveProjectFile() { const z = await exportProjectFile(p); saveFile(safeName(p.title) + '.lecpage', z, 'application/zip'); toast('연수를 파일로 저장했어요. 다른 컴퓨터에서 [저장한 파일 열기]로 열어요.'); }
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
          {st.s === 'failed' || st.s === 'changed' ? <span class="small save-bad">저장 안 됨</span>
            : <span class="small muted" title="이 브라우저에 자동으로 저장돼요">{st.s === 'saving' ? '저장 중…' : '자동 저장'}</span>}
          <button class="btn btn-sm" onClick={saveProjectFile} title="다른 컴퓨터에서 이어 하려면 파일로 저장해 옮기세요">파일로 저장</button>
        </div>
        {st.s === 'changed' && <div class="ai-job bad save-band" role="alert">
          <span class="ai-job-t"><b>다른 탭에서 이 연수를 고쳤어요.</b><small>덮어쓰지 않게 이 탭은 저장을 멈췄어요. 다시 불러오면 그 탭에서 고친 내용으로 이어서 해요.</small></span>
          <button class="btn btn-sm btn-primary" onClick={load}>이 탭으로 다시 불러오기</button>
        </div>}
        {st.s === 'failed' && <div class="ai-job bad save-band" role="alert">
          <span class="ai-job-t"><b>{storageKind(st.err) === 'quota' ? '저장 공간이 꽉 차 고친 내용을 저장하지 못했어요.' : storageKind(st.err) === 'blocked' ? '이 창은 브라우저 저장이 막혀 고친 내용을 저장하지 못했어요.' : '고친 내용을 저장하지 못했어요.'}</b>
            <small>{storageKind(st.err) === 'quota' ? '닫기 전에 [파일로 저장]으로 받아 두세요. 설정에서 안 쓰는 연수를 지우면 다시 저장돼요.' : storageKind(st.err) === 'blocked' ? '닫기 전에 [파일로 저장]으로 받아 두세요. 일반 창에서 열면 저장돼요.' : '닫기 전에 [파일로 저장]으로 받아 두세요.'}</small></span>
          <button class="btn btn-sm btn-primary" onClick={saveProjectFile}>파일로 저장</button>
          {storageKind(st.err) === 'quota' && <a class="btn btn-sm" href="#/settings" target="_blank" rel="noopener">설정 열기</a>}
          <button class="btn btn-sm btn-quiet" onClick={() => saver.retry()}>다시 저장</button>
        </div>}
      </header>
      <div class="wiz-main"><cur.C key={gen} p={p} update={update} go={go} /></div>
    </div>
  );
}

export function StepHead({ title, desc, children }) {
  return <div class="step-head"><div class="step-head-t"><h1 tabIndex={-1}>{title}</h1>{desc && <p>{desc}</p>}</div>{children}</div>;
}
