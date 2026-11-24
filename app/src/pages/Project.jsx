import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { projects, onProjectChange, storageKind, STORAGE_MSG, askPersist } from '../lib/db.js';
import { toast, saveFile, safeName } from '../lib/util.js';
import { makeSaver, restoreDraft, dropDraft } from '../lib/saver.js';
import { exportProjectFile, stageOf } from '../lib/project.js';
import { useGeneration } from '../lib/studio.js';
import { endDemo, openDemo } from '../lib/demo.js';
import { isV2, isLegacy } from '../lib/site-meta.js';
import { Mascot } from '../components/Mascot.jsx';
import { Dialog } from '../components/ui.jsx';
import { ConsentHost } from '../components/Consent.jsx';
import { StepStart } from './steps/Start.jsx';
import { StepMake } from './steps/Make.jsx';
import { StepShare } from './steps/Share.jsx';

// 새 흐름(docs/plan-ai-first.md §2): 교재 넣기(+AI 고르기) → 만드는 중(진행 단계만) → 완성(미리보기·목록·연수 정보·검수) → 배포.
// AI가 만들기 전에는 목록·미리보기가 없음. 먼저 해보기는 같은 화면을 체험 연수(p.demo)로 엶(lib/demo.js, 생성도 같은 파이프라인).
// 사이트는 생성 쪽(lib/gen)이 저장하고 'lecpage:gen-saved'로 알림 → 이 화면은 다시 읽기만 함(덮어쓰지 않게 자동 저장의 기준 판도 맞춤).
export const STEPS = [
  { n: 1, name: '교재 넣기', C: StepStart },
  { n: 2, name: '만들기·수정', C: StepMake },
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
  const go = (n) => { location.hash = `#/p/${id}/${n}`; };
  /** keep: 단계 화면을 새로 그리지 않음(생성 쪽이 저장한 것을 다시 읽을 때: 열어 둔 탭·고르던 것이 그대로) */
  function load({ keep = false } = {}) {
    return projects.get(id).then((v) => {
      if (!v) { setMissing('none'); return null; }
      const fixed = restoreDraft(v); // 새로 고침이 저장을 끊었으면 남겨 둔 임시본으로
      const cur = fixed || v;
      if (!cur.stage) cur.stage = stageOf(cur.step || 1);
      saver.reset(v.updatedAt || 0); ref.current = cur; setP(cur); setSt({ s: 'ok' }); if (!keep) setGen((g) => g + 1);
      if (fixed) { saver.put(cur); toast('새로 고치기 전에 고친 내용을 되살렸어요.'); } else dropDraft(id);
      return cur;
    }, (e) => { setMissing(storageKind(e) || 'other'); return null; });
  }
  useEffect(() => { load(); }, [id]);
  // 같은 연수를 연 다른 탭이 저장하거나 지우면: 덮지 않고 멈춘 뒤 알림(합치지 않음)
  useEffect(() => onProjectChange((m) => {
    if (m.id !== id || !ref.current) return;
    if (m.type === 'deleted') { saver.halt('gone'); setSt({ s: 'gone' }); }
    else if (m.type === 'saved' && m.at > saver.base()) { saver.halt('changed'); setSt({ s: 'changed' }); }
  }), [id, saver]);
  const [saveAsk, setSaveAsk] = useState(false); // 배포한 연수의 [파일로 저장]: 열쇠를 담을지
  const [withKeys, setWithKeys] = useState(false);
  // 떠날 때(탭 닫기·새로 고침·숨김·다른 화면): 아직 다 쓰지 못한 것은 임시본을 동기로 남기고 바로 씀(docs/interaction.md 9절)
  useEffect(() => {
    const now = () => { saver.stash(ref.current); saver.flush(); };
    const hide = () => { if (document.visibilityState === 'hidden') now(); };
    const back = () => saver.retry(); // 저장 공간을 비우고 돌아왔으면 다시 써 봄
    addEventListener('pagehide', now); document.addEventListener('visibilitychange', hide); addEventListener('focus', back);
    return () => { removeEventListener('pagehide', now); document.removeEventListener('visibilitychange', hide); removeEventListener('focus', back); saver.flush(); };
  }, [saver]);
  // 사이트가 처음 생기면 한 번: 브라우저가 이 연수를 지우지 않게 보호를 청함(크롬 계열은 묻지 않고 정함. 파이어폭스는 묻는 창이 떠서 설정 화면 단추로만)
  useEffect(() => { if (p?.site && !p.demo && !/Firefox\//.test(navigator.userAgent || '')) askPersist(); }, [!!p?.site]);

  // AI 작업(생성 API: 키·내 PC·체험 모두 같은 파이프라인). 생성 쪽이 저장하면 다시 읽음
  const job = useGeneration(id);
  useEffect(() => {
    const on = (e) => { if (e.detail?.pid === id) saver.idle().then(() => load({ keep: true })); };
    addEventListener('lecpage:gen-saved', on); return () => removeEventListener('lecpage:gen-saved', on);
  }, [id, saver]);
  // 끝난 작업 알림: 이 화면에서 도는 것을 본 작업만(다시 열었을 때 지난 작업으로 알리지 않게)
  const seen = useRef({});
  useEffect(() => {
    if (!job.jobId) return;
    if (job.status === 'running') { seen.current[job.jobId] = true; return; }
    if (job.status !== 'done' || !seen.current[job.jobId]) return;
    delete seen.current[job.jobId];
    if (job.kind === 'make') { toast('다 만들었어요. 미리보기를 보며 확인해 주세요.'); if (s !== 2) go(2); }
    else toast(job.kind === 'fix' ? '꼭 고칠 곳을 AI가 고쳤어요. 마음에 안 들면 [버전 기록]에서 복원해요.' : '요청한 대로 고쳤어요. 마음에 안 들면 [버전 기록]에서 복원해요.');
  }, [job.status, job.jobId]);

  const s = step > 3 ? stageOf(step) : Math.min(3, Math.max(1, step || p?.stage || 1));
  useEffect(() => { if (p && p.stage !== s) update({ stage: s, visited: { ...(p.visited || {}), [s]: true } }); }, [s, !!p]);
  // 단계가 바뀌면 그 단계 제목으로 초점을 옮겨 화면 읽기 프로그램이 알 수 있게
  useEffect(() => { if (p) setTimeout(() => document.querySelector('.wiz-main h1')?.focus({ preventScroll: true }), 30); }, [s, !!p]);
  // 완성 화면은 미리보기 자리를 넓게(화면 폭 가득)
  const wide = s === 2 && !!p?.site;
  useEffect(() => { const h = document.documentElement; h.classList.toggle('is-wide', wide); return () => h.classList.remove('is-wide'); }, [wide]);
  /** opt.now: 모아 쓰지 않고 바로 저장(다른 앱·창으로 나가기 직전처럼 잃으면 안 될 때) */
  function update(patch, opt) {
    const prev = ref.current;
    const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) };
    if (isV2(next) && next.meta?.title) next.title = next.meta.title;
    else if (next.blueprint?.meta?.title) next.title = next.blueprint.meta.title; else if (next.info?.title) next.title = next.info.title;
    // 배포한 뒤 바뀌었는지(다시 배포 알림). 배포하면서 주소를 적는 것(deploy와 함께 바뀜)은 고친 것이 아님
    const changed = next.blueprint !== prev.blueprint || next.site !== prev.site || next.meta !== prev.meta;
    if (changed && (next.blueprint || next.site) && next.deploy === prev.deploy) next.editedAt = Date.now();
    ref.current = next; setP(next); saver.put(next);
    if (opt?.now) saver.flush();
  }
  // 저장이 막힌 창은 위 띠(main.jsx StorageBar)가 까닭과 할 일을 알림
  if (missing) return <div class="empty"><Mascot size={84} mood="oops" /><p>{missing === 'none' ? "이 연수를 찾지 못했어요. 다른 브라우저에서 만들었다면 그 브라우저에서 '파일로 저장'한 뒤 여기서 열어 주세요." : missing === 'blocked' ? '이 창에서는 연수를 열 수 없어요.' : STORAGE_MSG[missing] || '이 브라우저의 저장소를 읽지 못했어요. 새로 고침해 주세요.'}</p><a class="btn" href="#/">처음으로</a></div>;
  if (st.s === 'gone') return <div class="empty"><Mascot size={84} mood="oops" /><p>{p?.demo ? '체험을 종료했어요.' : '이 연수는 다른 탭에서 삭제했어요.'}</p><a class="btn" href="#/">처음으로</a></div>;
  if (!p) return <p class="muted">불러오는 중…</p>;
  const cur = STEPS.find((x) => x.n === s) || STEPS[0];
  const hasSite = isV2(p); const legacy = isLegacy(p);
  const working = job.status === 'running' || job.status === 'paused' || job.status === 'error';
  const open = (n) => n === 1 || (n === 2 ? hasSite || legacy || working : hasSite || legacy);
  const done = (n) => (n === 1 ? hasSite : n === 2 ? hasSite && !!p.visited?.[3] : !!p.deploy?.lastUrl);
  const closed = (n) => (n === 2 ? '먼저 교재를 넣고 AI를 선택해 주세요.' : 'AI가 사이트를 다 만든 뒤에 배포할 수 있어요.');
  // 배포한 연수면 한 번 물음: 남에게 줄 파일(기본, 열쇠 없음) / 내 다른 기기에서 같은 주소로 이어 배포(열쇠 포함)
  async function saveProjectFile(keys = false) {
    setSaveAsk(false);
    let z; try { z = await exportProjectFile(p, { withKeys: keys }); } catch (e) { console.error(e); toast(e?.friendly ? e.message : '파일로 저장하지 못했어요. 저장 공간을 확인하고 다시 눌러 주세요.'); return; }
    saveFile(safeName(p.title) + '.lecpage', z, 'application/zip');
    toast(keys ? '관리자 키까지 담아 저장했어요. 다른 기기에서 열면 같은 주소에 이어 배포해요.' : '연수를 파일로 저장했어요. 다른 컴퓨터에서 [저장한 파일 열기]로 열어요.');
  }
  /** [파일로 저장]: 배포한 연수면 열쇠를 담을지 먼저 물음 */
  const askSave = () => (p.deploy?.lastUrl ? (setWithKeys(false), setSaveAsk(true)) : saveProjectFile());
  // stale: 다른 탭에서 이 연수를 고쳐 이 탭이 저장을 멈춤(빨간 띠) — 배포하기 화면이 그동안 배포를 받지 않음
  const ctx = { p, update, go, job, idle: () => saver.idle(), reload: () => load({ keep: true }), stale: st.s === 'changed' };
  return (
    <div class={`wiz stage-${s}${wide ? " is-studio" : ""}`}>
      {p.demo && <DemoBar pid={id} />}
      <header class="wiz-head">
        <p class="wiz-title" title={p.title || '이름 없는 연수'}>{p.title || '이름 없는 연수'}</p>
        <ol class="stepper" aria-label="만드는 순서">
          {STEPS.map((x) => (
            <li><a href={`#/p/${id}/${x.n}`} class={done(x.n) && x.n !== s ? 'done' : ''} aria-current={x.n === s ? 'step' : undefined} aria-disabled={!open(x.n) ? 'true' : undefined} onClick={(e) => { if (!open(x.n)) { e.preventDefault(); toast(closed(x.n)); } }}><span class="n">{x.n}</span><span class="t">{x.name}</span></a></li>
          ))}
        </ol>
        <div class="side-tools">
          {st.s === 'failed' || st.s === 'changed' ? <span class="small save-bad">저장 안 됨</span>
            : <span class="small muted" title="이 브라우저에 자동으로 저장돼요">{st.s === 'saving' ? '저장 중…' : '자동 저장'}</span>}
          {!p.demo && <button class="btn btn-sm" onClick={askSave} title="다른 컴퓨터에서 이어 하려면 파일로 저장해 옮기세요">파일로 저장</button>}
        </div>
        {st.s === 'changed' && <div class="ai-job bad save-band" role="alert">
          <span class="ai-job-t"><b>다른 탭에서 이 연수를 고쳤어요.</b><small>덮어쓰지 않게 이 탭은 저장을 멈췄어요. 다시 불러오면 그 탭에서 고친 내용으로 이어서 해요.</small></span>
          <button class="btn btn-sm btn-primary" onClick={load}>이 탭으로 다시 불러오기</button>
        </div>}
        {st.s === 'failed' && <div class="ai-job bad save-band" role="alert">
          <span class="ai-job-t"><b>{storageKind(st.err) === 'quota' ? '저장 공간이 꽉 차 고친 내용을 저장하지 못했어요.' : storageKind(st.err) === 'blocked' ? '이 창은 브라우저 저장이 막혀 고친 내용을 저장하지 못했어요.' : '고친 내용을 저장하지 못했어요.'}</b>
            <small>{storageKind(st.err) === 'quota' ? '닫기 전에 [파일로 저장]으로 받아 두세요. 설정에서 안 쓰는 연수를 지우면 다시 저장돼요.' : storageKind(st.err) === 'blocked' ? '닫기 전에 [파일로 저장]으로 받아 두세요. 일반 창에서 열면 저장돼요.' : '닫기 전에 [파일로 저장]으로 받아 두세요.'}</small></span>
          <button class="btn btn-sm btn-primary" onClick={askSave}>파일로 저장</button>
          {storageKind(st.err) === 'quota' && <a class="btn btn-sm" href="#/settings" target="_blank" rel="noopener">설정 열기</a>}
          <button class="btn btn-sm btn-quiet" onClick={() => saver.retry()}>다시 저장</button>
        </div>}
      </header>
      <Dialog open={saveAsk} onClose={() => setSaveAsk(false)} label="파일로 저장">
        <h2 class="h-sub">파일로 저장</h2>
        <p>다른 컴퓨터에서 [저장한 파일 열기]로 열어 이어서 고쳐요. 기본 파일에는 관리자 키가 없어서 남에게 줘도 되고, 그 파일로 배포하면 새 주소가 생겨요.</p>
        <label class="check"><input type="checkbox" checked={withKeys} onChange={(e) => setWithKeys(e.target.checked)} /><span>내 다른 기기에서 같은 주소로 이어 배포하기{withKeys && <small class="err"> 관리자 키가 파일에 들어가요. 이 파일은 남에게 주지 마세요.</small>}</span></label>
        <div class="btn-row"><button class="btn btn-primary" data-autofocus onClick={() => saveProjectFile(withKeys)}>저장</button><button class="btn btn-quiet" onClick={() => setSaveAsk(false)}>닫기</button></div>
      </Dialog>
      <div class="wiz-main">{legacy && s > 1 ? <LegacyNote p={p} go={go} /> : <cur.C key={gen} {...ctx} />}</div>
      <ConsentHost />
    </div>
  );
}

export function StepHead({ title, desc, children }) {
  return <div class="step-head"><div class="step-head-t"><h1 tabIndex={-1}>{title}</h1>{desc && <p>{desc}</p>}</div>{children}</div>;
}

/** 체험 연수 위 띠: 실제와 같은 화면이라는 것, 키가 필요 없고 실제로 배포하지 않는다는 것 */
function DemoBar({ pid }) {
  const [busy, setBusy] = useState(false);
  async function again() { setBusy(true); try { const nid = await openDemo(); location.hash = `#/p/${nid}/1`; } catch { toast('체험을 다시 열지 못했어요. 새로 고침해 주세요.'); } setBusy(false); }
  return (
    <aside class="demo-bar" aria-label="체험 안내">
      <span class="demo-tag">체험</span>
      <span class="demo-bar-t"><b>실제와 똑같은 화면이에요.</b> 예시 교재로 해 봐요. 키가 필요 없고, AI 답은 이 교재로 미리 만들어 둔 것을 쓰며, 실제로 배포하지 않아요.</span>
      <button type="button" class="btn btn-sm btn-quiet" disabled={busy} onClick={again}>처음부터 다시</button>
      <a class="btn btn-sm" href="#/" onClick={() => endDemo(pid)}>체험 종료</a>
    </aside>
  );
}

/** 예전 방식(설계도)으로 만든 연수: 지우지 않고 배포 정보를 그대로 두고, AI로 새로 만들 길만 */
function LegacyNote({ p, go }) {
  const url = p.deploy?.lastUrl || p.pastDeploy?.url || '';
  return (
    <>
      <StepHead title="예전 방식으로 만든 연수예요" desc="지금은 AI가 교재를 직접 읽고 사이트 전체를 만들어요. 이 연수도 AI로 새로 만들 수 있어요." />
      <section class="block stack legacy">
        <p>예전 연수는 그대로 남아 있어요. AI로 새로 만들면 넣어 둔 교재로 새 사이트를 만들고, 배포한 주소와 참여 기능 연결은 이어서 써요.</p>
        {url && <p class="small">배포한 주소: <a href={url} target="_blank" rel="noopener">{url.replace(/^https?:\/\//, '')}</a>{p.deploy?.lastUrl ? '' : ' (다른 기기에서 배포함)'}</p>}
        <div class="btn-row">
          <button type="button" class="btn btn-primary" onClick={() => go(1)}>AI로 새로 만들기</button>
          {url && <a class="btn" href={url} target="_blank" rel="noopener">배포한 사이트 열기</a>}
        </div>
        {!(p.files || []).length && <p class="small muted">이 연수에는 교재 파일이 없어요. 교재 넣기에서 교재를 넣은 뒤 AI를 선택해 주세요.</p>}
      </section>
    </>
  );
}
