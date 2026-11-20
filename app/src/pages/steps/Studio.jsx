import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { StepHead } from '../Project.jsx';
import { Field, Tabs, Dialog, Notice } from '../../components/ui.jsx';
import { SitePreview } from '../../components/Preview.jsx';
import { editSite, chatEditPrompt, acceptChatAnswer, runInspect, fixIssues, stopGeneration } from '../../lib/studio.js';
import { aiStatus, getActiveAI, PROVIDERS, CHATBOTS, getChatbot, setChatbot } from '../../lib/ai.js';
import { listSections, moveSection, setHidden, removeSection, renameSection, setText, setImage, imageAt, replaceText, getVar, setVar, readCss, writeCss } from '../../lib/site-doc.js';
import { firstSession, keepTeacher, pushVersion } from '../../lib/site-meta.js';
import { blobs } from '../../lib/db.js';
import { toast, copy, uid, isPastDate, monthDay, fmtDate } from '../../lib/util.js';
import { fmtSec } from './Make.jsx';

// 완성 뒤 편집 화면(docs/plan-ai-first.md §8): 미리보기(조립된 실제 사이트) + 목록(섹션) + 글 바로 고치기 + 그림 바꾸기 + 색·글꼴
// + 수정 요청(섹션 또는 전체 → AI) + 검수(문제 목록, AI에게 고쳐 달라기) + 연수 정보(AI가 찾은 쪽 번호) + 되돌리기(판 기록)
const UNDO_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '') ? '⌘Z' : 'Ctrl+Z';
const undos = new Map(); // 연수마다 직접 고친 것 되돌리기(이 탭 안, 최근 30개)
const stackOf = (pid) => { if (!undos.has(pid)) undos.set(pid, []); return undos.get(pid); };

export function Studio({ p, update, go, job, adoptSite, idle }) {
  const [tab, setTab] = useState(() => (p.metaChecked ? 'list' : 'info'));
  const [editing, setEditing] = useState(false);
  const [img, setImg] = useState(null); // 바꿀 그림 번호
  const [ver, setVer] = useState(0); // 그림 파일이 바뀌면 미리보기를 다시 읽음
  const [goto, setGoto] = useState(null);
  const [vers, setVers] = useState(false);
  const [issues, setIssues] = useState(null);
  const [ask, setAsk] = useState({ target: 'all', request: '' });
  const [, force] = useState(0);
  const quiet = useRef(''); const latest = useRef(p); latest.current = p;
  const working = job.status === 'running' && job.kind && job.kind !== 'make';
  const stack = stackOf(p.id);
  /** 직접 고치기: 고치기 전 판을 되돌리기에 넣고 바꿈 */
  const change = useCallback((label, fn) => {
    const cur = latest.current; const next = fn(cur); if (!next) return;
    stack.push({ label, site: cur.site, meta: cur.meta }); if (stack.length > 30) stack.shift(); force((x) => x + 1);
    update(next);
  }, [p.id]);
  const undo = () => { const s = stack.pop(); if (!s) { toast('되돌릴 것이 없어요.'); return; } quiet.current = ''; update({ site: s.site, meta: s.meta }); force((x) => x + 1); toast(`되돌렸어요: ${s.label}`); };
  const undoRef = useRef(undo); undoRef.current = undo;
  useEffect(() => {
    const k = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.isComposing || !(e.code === 'KeyZ' || /^z$/i.test(e.key))) return;
      if (e.target?.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable=""]') || document.querySelector('dialog[open]')) return;
      e.preventDefault(); undoRef.current();
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, []);
  const html = p.site?.['index.html'] || '';
  const sections = useMemo(() => listSections(html), [html]);
  const onText = useCallback((n, raw) => change('글 고치기', (cur) => { const h = setText(cur.site['index.html'], n, raw); if (h === cur.site['index.html']) return null; quiet.current = h; return { site: { ...cur.site, 'index.html': h } }; }), [change]);
  const onImage = useCallback((n) => setImg(n), []);
  const setHtml = (label, fn) => change(label, (cur) => { const h = fn(cur.site['index.html']); return h === cur.site['index.html'] ? null : { site: { ...cur.site, 'index.html': h } }; });
  // 검수: 고친 뒤 잠깐 멈추면 다시(조립 + 정적 검사). 생성 쪽이 저장소의 연수를 읽으므로 먼저 다 씀
  const inspectT = useRef();
  const recheck = () => { clearTimeout(inspectT.current); inspectT.current = setTimeout(async () => { await idle(); try { setIssues(await runInspect(p.id)); } catch (e) { console.error(e); setIssues([]); } }, 900); };
  useEffect(() => { if (!working) recheck(); return () => clearTimeout(inspectT.current); }, [p.site, p.meta, working]);
  const errs = (issues || []).filter((x) => x.level === 'error').length;
  const published = !!p.deploy?.lastUrl;
  const changed = published && (p.editedAt || 0) > (p.deploy.at || 0);
  const tabs = [
    { value: 'list', label: '목록' },
    { value: 'info', label: '연수 정보', badge: p.metaChecked ? '' : '확인' },
    { value: 'check', label: '검수', badge: issues?.length ? String(issues.length) : '' },
    { value: 'ask', label: '수정 요청' },
    { value: 'look', label: '색·글꼴' },
  ];
  const show = (key) => setGoto({ key, n: Date.now() });
  const fixAll = async (ids) => {
    const ai = await getActiveAI();
    const list = (issues || []).filter((x) => !ids || ids.includes(x.id));
    if (!list.length) return;
    if (ai && !p.demo) { await idle(); fixIssues(p.id, list.map((x) => x.id)); toast('AI에게 고쳐 달라고 보냈어요.'); return; }
    setAsk({ target: 'all', request: `검수에서 찾은 문제를 고쳐 주세요.\n${list.map((x) => `- ${x.message_ko}${x.fix_hint_ko ? ` (${x.fix_hint_ko})` : ''}`).join('\n')}` });
    setTab('ask');
  };
  return (
    <>
      <StepHead title="살펴보고 고치기" desc="미리보기에서 글자를 눌러 바로 고치고, 목록에서 섹션을 정리해요. 고친 내용은 자동으로 저장돼요.">
        <div class="btn-row head-tools">
          <button class="btn btn-sm btn-quiet" disabled={!stack.length} onClick={undo} title={stack.length ? `되돌리기: ${stack[stack.length - 1].label} (${UNDO_KEY})` : '되돌릴 것이 없어요'}>되돌리기</button>
          <button class="btn btn-sm btn-quiet" onClick={() => setVers(true)} aria-haspopup="dialog">판 기록</button>
          {!published ? <button class="btn btn-primary" onClick={() => go(3)}>배포하기 →</button>
            : changed ? <button class="btn btn-primary" onClick={() => { try { sessionStorage.setItem('lecpage:republish', p.id); } catch { } go(3); }}>다시 배포하기</button>
              : <button class="btn" onClick={() => go(3)}>주소·QR 보기 →</button>}
        </div>
      </StepHead>
      {working && <JobBand job={job} onStop={() => stopGeneration(p.id)} />}
      {job.status === 'error' && job.kind && job.kind !== 'make' && <div class="ai-job bad" role="alert"><span class="ai-job-t"><b>{job.error?.title || 'AI가 고치지 못했어요.'}</b><small>{job.error?.body || '사이트는 그대로예요.'}</small></span></div>}
      {!p.metaChecked && tab !== 'info' && <div class="ai-job" role="status"><span class="ai-job-t"><b>AI가 교재에서 찾은 연수 정보를 한 번 확인해 주세요.</b><small>QR 안내문·강사 화면·일정 파일에 쓰여요.</small></span><button type="button" class="btn btn-sm btn-primary" onClick={() => setTab('info')}>확인하기</button></div>}
      {p.notes?.length > 0 && <div class="ai-job" role="status"><span class="ai-job-t"><b>답을 받으며 알게 된 것</b><small>{p.notes.join(' ')}</small></span><button class="icon-btn" onClick={() => update({ notes: undefined })} aria-label="안내 닫기">✕</button></div>}
      <div class="workspace">
        <div class="ws-panel">
          <Tabs label="고칠 것" tabs={tabs} value={tab} onChange={setTab} />
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} class="ws-body">
            {tab === 'list' && <SectionsPanel sections={sections} locked={working} onShow={show}
              onMove={(id, to) => setHtml('순서 바꾸기', (h) => moveSection(h, id, to))}
              onHide={(id, v) => setHtml(v ? '섹션 숨기기' : '섹션 보이기', (h) => setHidden(h, id, v))}
              onRemove={(id) => setHtml('섹션 지우기', (h) => removeSection(h, id))}
              onRename={(id, name) => setHtml('이름 바꾸기', (h) => renameSection(h, id, name))}
              onAsk={(id) => { setAsk({ target: id, request: '' }); setTab('ask'); }} editing={editing} setEditing={setEditing} />}
            {tab === 'info' && <InfoPanel p={p} change={change} update={update} />}
            {tab === 'check' && <CheckPanel issues={issues} onShow={show} onFix={fixAll} locked={working} onRecheck={recheck} />}
            {tab === 'ask' && <AskPanel p={p} sections={sections} ask={ask} setAsk={setAsk} idle={idle} adoptSite={adoptSite} locked={working} go={go} />}
            {tab === 'look' && <LookPanel p={p} change={change} />}
          </div>
          {!!stack.length && <button type="button" class="btn btn-sm undo-float" onClick={undo}><span aria-hidden="true">↶ </span>되돌리기</button>}
        </div>
        <SitePreview p={p} ver={ver} editing={editing && !working} setEditing={working ? null : setEditing} onText={onText} onImage={onImage} quiet={quiet} goto={goto} />
      </div>
      <ImageDialog n={img} p={p} onClose={() => setImg(null)} onPick={(src, alt) => { setHtml('그림 바꾸기', (h) => setImage(h, img, src, alt)); setImg(null); setVer((v) => v + 1); toast('그림을 바꿨어요.'); }} />
      <Dialog open={vers} onClose={() => setVers(false)} label="판 기록">
        {vers && <Versions p={p} onPick={(v) => { quiet.current = ''; update((cur) => ({ site: v.site, meta: keepTeacher(v.meta || cur.meta, cur.meta), versions: pushVersion(cur, '되돌리기 전') })); setVers(false); toast(`되돌렸어요: ${v.label}`); }} onRemake={() => { setVers(false); go(1); }} />}
      </Dialog>
    </>
  );
}

/** AI가 고치는 동안(수정 요청·검수 고치기): 진행 단계 한 줄. 끝나면 사이트가 바뀌고 판 기록에 남음 */
function JobBand({ job, onStop }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  return (
    <div class="ai-job" role="status" aria-live="polite">
      <span class="ai-job-dot" aria-hidden="true" />
      <span class="ai-job-t"><b>{job.kind === 'fix' ? 'AI가 검수 결과를 고치고 있어요' : 'AI가 요청대로 고치고 있어요'}</b><small>{job.step ? `${job.step.label_ko} (${job.step.index + 1}/${job.step.total}) · ` : ''}{fmtSec((Date.now() - job.startedAt) / 1000)} · 끝나면 미리보기가 바뀌어요.</small></span>
      <button class="btn btn-sm btn-quiet" onClick={onStop}>멈추기</button>
    </div>
  );
}

const KIT_KO = { qa: '질문', poll: '투표', board: '보드', attend: '출석', survey: '설문', deck: '교재', materials: '자료실', join: '접속 QR' };
/** 목록: 사이트의 섹션. 끌어서(또는 ↑↓) 순서, 숨기기, 지우기, 이름 바꾸기, 누르면 미리보기가 그 섹션으로 */
function SectionsPanel({ sections, locked, onShow, onMove, onHide, onRemove, onRename, onAsk, editing, setEditing }) {
  const [drag, setDrag] = useState(null); const [over, setOver] = useState(null);
  const [rename, setRename] = useState(null); const [del, setDel] = useState(null);
  const listRef = useRef();
  const focusAt = (i) => setTimeout(() => listRef.current?.querySelectorAll('.sec2-name')[i]?.focus(), 60);
  return (
    <div class="stack">
      <div class="sec-tools"><p class="small muted">섹션 {sections.length}개 · 끌어서 순서를 바꿔요.</p>
        <button type="button" class={`btn btn-sm${editing ? ' btn-ink' : ''}`} aria-pressed={String(!!editing)} disabled={locked} onClick={() => setEditing(!editing)}>{editing ? '글 고치는 중' : '미리보기에서 글 고치기'}</button></div>
      {locked && <p class="lock-note small">AI가 고치는 동안에는 바꿀 수 없어요.</p>}
      <ol class="sec2-list" ref={listRef} aria-label="섹션 목록">
        {sections.map((s, i) => (
          <li class={`sec2${s.hidden ? ' is-hidden' : ''}${over === i ? ' is-over' : ''}`} key={s.id} draggable={!locked && rename !== s.id}
            onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', s.id); } catch { } }}
            onDragOver={(e) => { if (drag === null) return; e.preventDefault(); setOver(i); }} onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); if (drag !== null && drag !== i) { onMove(sections[drag].id, i); toast(`옮겼어요: ${sections[drag].name}`); } setDrag(null); setOver(null); }}
            onDragEnd={() => { setDrag(null); setOver(null); }}>
            <span class="sec2-grip" aria-hidden="true">⋮⋮</span>
            {rename === s.id ? <form class="sec2-rename" onSubmit={(e) => { e.preventDefault(); const v = e.currentTarget.elements.n.value.trim(); if (v) onRename(s.id, v); setRename(null); focusAt(i); }}>
              <input name="n" class="input" defaultValue={s.name} maxLength={60} aria-label={`${s.name} 새 이름`} ref={(el) => el && setTimeout(() => el.focus(), 0)} onKeyDown={(e) => e.key === 'Escape' && (setRename(null), focusAt(i))} />
              <button class="btn btn-sm btn-primary">바꾸기</button></form>
              : <button type="button" class="sec2-name" onClick={() => onShow(s.id)} title="미리보기에서 보기"><span class="ttl">{s.name}</span><small>{[s.hidden ? '숨김' : '', s.steps ? `실습 ${s.steps}단계` : '', ...s.kits.map((k) => KIT_KO[k] || k)].filter(Boolean).join(' · ')}</small></button>}
            <span class="sec2-acts">
              <button type="button" class="icon-btn" disabled={locked || i === 0} aria-label={`${s.name} 위로`} title="위로" onClick={() => { onMove(s.id, i - 1); focusAt(i - 1); }}>↑</button>
              <button type="button" class="icon-btn" disabled={locked || i === sections.length - 1} aria-label={`${s.name} 아래로`} title="아래로" onClick={() => { onMove(s.id, i + 1); focusAt(i + 1); }}>↓</button>
              <details class="sec2-more"><summary class="icon-btn" aria-label={`${s.name} 더 보기`} title="더 보기">…</summary>
                <div class="sec2-menu">
                  <button type="button" class="btn btn-sm btn-quiet" disabled={locked} onClick={(e) => { e.currentTarget.closest('details').open = false; setRename(s.id); }}>이름 바꾸기</button>
                  <button type="button" class="btn btn-sm btn-quiet" disabled={locked} onClick={(e) => { e.currentTarget.closest('details').open = false; onHide(s.id, !s.hidden); }}>{s.hidden ? '다시 보이기' : '숨기기'}</button>
                  <button type="button" class="btn btn-sm btn-quiet" disabled={locked} onClick={(e) => { e.currentTarget.closest('details').open = false; onAsk(s.id); }}>AI에게 고쳐 달라기</button>
                  <button type="button" class="btn btn-sm btn-quiet sec2-del" disabled={locked} onClick={(e) => { e.currentTarget.closest('details').open = false; setDel(s); }}>지우기</button>
                </div></details>
            </span>
          </li>
        ))}
      </ol>
      {!sections.length && <p class="muted small">섹션(&lt;section&gt;)이 없는 사이트예요. 수정 요청으로 AI에게 섹션을 나눠 달라고 할 수 있어요.</p>}
      <Dialog open={!!del} onClose={() => setDel(null)} label="섹션 지우기 확인">
        {del && <><h2 class="h-sub">'{del.name}' 섹션을 지울까요?</h2><p>숨기기는 사이트에서 감추기만 해요. 지운 것은 [되돌리기]나 [판 기록]으로 되살릴 수 있어요.</p>
          <div class="btn-row"><button class="btn btn-quiet" data-autofocus onClick={() => setDel(null)}>닫기</button><button class="btn" onClick={() => { onHide(del.id, true); setDel(null); }}>숨기기</button><button class="btn btn-danger" onClick={() => { onRemove(del.id); setDel(null); toast(`지웠어요: ${del.name}`); }}>지우기</button></div></>}
      </Dialog>
    </div>
  );
}

const FACT_OF = { title: ['연수명', '제목', '연수 제목'], date: ['날짜', '일시', '연수 날짜'], time: ['시간', '시각', '일시'], venue: ['장소'], instructor: ['강사', '강사명'] };
/** 연수 정보(meta): 제목·날짜·시간·장소·강사. AI가 찾은 쪽 번호를 보여 주고, 고치면 사이트 글(같은 글자)과 QR 안내문 등에 반영 */
function InfoPanel({ p, change, update }) {
  const m = p.meta || {}; const s0 = firstSession(m); const inst = (m.instructors || [])[0] || {};
  const facts = m.facts || [];
  const page = (k) => { const f = facts.find((x) => FACT_OF[k].includes(String(x.label || '').trim())); return f?.page ? `교재 ${f.page}쪽에서 찾았어요` : f ? 'AI가 교재에서 찾았어요' : ''; };
  const setMeta = (label, fn, fromTo) => change(label, (cur) => {
    const meta = fn(cur.meta || {}); let html = cur.site['index.html'];
    if (fromTo) html = replaceText(html, fromTo[0], fromTo[1]);
    return { meta, ...(html !== cur.site['index.html'] ? { site: { ...cur.site, 'index.html': html } } : {}) };
  });
  const setSession = (k, v) => setMeta('연수 정보 고치기', (mm) => { const ses = [...(mm.sessions || [])]; ses[0] = { ...(ses[0] || { date: '', start: '', end: '' }), [k]: v }; return { ...mm, sessions: ses }; });
  // 글자 칸은 칸을 떠날 때 한 번(사이트 글 바꾸기는 다 쓴 값으로)
  const textField = (k, label, val, max, set, hint) => <Field label={label} hint={hint}><input class="input" defaultValue={val} key={val} maxLength={max} onChange={(e) => set(e.target.value.trim())} /></Field>;
  const others = facts.filter((f) => !Object.values(FACT_OF).flat().includes(String(f.label || '').trim()));
  return (
    <div class="stack">
      <p class="small muted">AI가 교재에서 찾은 값이에요. 고치면 사이트에 같은 글자로 적힌 곳과 QR 안내문·강사 화면·일정 파일이 함께 바뀌어요.</p>
      <div class="form-grid">
        {textField('title', '연수명', m.title || '', 160, (v) => v && v !== m.title && setMeta('연수명 고치기', (mm) => ({ ...mm, title: v }), [m.title, v]), page('title'))}
        <Field label="날짜" hint={isPastDate(s0.date) ? <span class="warn-line" role="status">{monthDay(s0.date)}은 지난 날짜예요. 이번 연수 날짜로 고쳐 주세요.</span> : page('date') || (!s0.date ? <span class="warn-line">날짜를 넣어 주세요.</span> : '')}><input type="date" class="input" value={s0.date || ''} onChange={(e) => setSession('date', e.target.value)} /></Field>
        <div class="stack" style={{ gap: '4px' }}>
          <div class="pair">
            <Field label="시작"><input type="time" class="input" value={s0.start || ''} onChange={(e) => setSession('start', e.target.value)} /></Field>
            <Field label="끝"><input type="time" class="input" value={s0.end || ''} onChange={(e) => setSession('end', e.target.value)} /></Field>
          </div>
          {page('time') && <small class="field-hint">{page('time')}</small>}
        </div>
        {textField('venue', '장소', m.venue || '', 120, (v) => v !== (m.venue || '') && setMeta('장소 고치기', (mm) => ({ ...mm, venue: v }), [m.venue, v]), page('venue'))}
        {textField('inst', '강사', inst.name || '', 40, (v) => v !== (inst.name || '') && setMeta('강사 고치기', (mm) => ({ ...mm, instructors: [{ ...inst, name: v }, ...(mm.instructors || []).slice(1)].filter((x) => x.name) }), [inst.name, v]), page('instructor'))}
        {textField('org', '강사 소속', inst.org || '', 80, (v) => v !== (inst.org || '') && setMeta('강사 소속 고치기', (mm) => ({ ...mm, instructors: [{ ...inst, org: v }, ...(mm.instructors || []).slice(1)] }), [inst.org, v]))}
      </div>
      {others.length > 0 && <div class="facts"><b class="small">AI가 교재에서 찾은 다른 사실</b><ul class="small">{others.map((f) => <li>{f.label}: {f.value}{f.page ? <span class="muted"> · {f.page}쪽</span> : ''}</li>)}</ul></div>}
      {!p.metaChecked ? <div class="btn-row"><button type="button" class="btn btn-primary" onClick={() => { update({ metaChecked: true }); toast('확인했어요.'); }}>이 정보가 맞아요</button></div>
        : <p class="small muted">확인했어요. 고쳐도 다시 확인할 필요는 없어요.</p>}
    </div>
  );
}

/** 검수 결과: 깨진 곳·넘침·빈 칸·키트 표시 오류 등. 그 자리 보기, AI에게 고쳐 달라기 */
function CheckPanel({ issues, onShow, onFix, locked, onRecheck }) {
  const [pick, setPick] = useState([]);
  if (issues === null) return <p class="muted small" aria-live="polite">검수하는 중…</p>;
  const errs = issues.filter((x) => x.level === 'error');
  return (
    <div class="stack">
      {issues.length ? <p class="small" role="status">고칠 곳 {issues.length}곳{errs.length ? ` · 꼭 고칠 곳 ${errs.length}곳` : ''}. 고치면 다시 검수해요.</p>
        : <Notice kind="ok"><span role="status">검수에서 찾은 문제가 없어요.</span></Notice>}
      <ul class="issues">
        {issues.map((x) => (
          <li class={`issue is-${x.level}`}>
            <label class="check"><input type="checkbox" checked={pick.includes(x.id)} onChange={() => setPick(pick.includes(x.id) ? pick.filter((y) => y !== x.id) : [...pick, x.id])} /><span><b>{x.level === 'error' ? '꼭 고칠 곳' : '확인할 곳'}</b> {x.message_ko}{x.fix_hint_ko && <small>{x.fix_hint_ko}</small>}</span></label>
            {x.where?.section && <button type="button" class="btn btn-sm btn-quiet" onClick={() => onShow(x.where.section)}>이 곳 보기</button>}
          </li>
        ))}
      </ul>
      <div class="btn-row">
        {issues.length > 0 && <button type="button" class="btn btn-primary" disabled={locked} onClick={() => onFix(pick.length ? pick : null)}>{pick.length ? `고른 ${pick.length}곳 고쳐 달라기` : 'AI에게 고쳐 달라기'}</button>}
        <button type="button" class="btn btn-quiet" onClick={onRecheck}>다시 검수</button>
      </div>
    </div>
  );
}

/** 수정 요청: 고칠 섹션(또는 전체)과 바라는 점 → 연결한 AI(키) 또는 쓰던 앱(요청 글 복사 → 답 넣기) */
function AskPanel({ p, sections, ask, setAsk, idle, adoptSite, locked, go }) {
  const [conn, setConn] = useState(undefined);
  const [way, setWayHere] = useState('');
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { getActiveAI().then((a) => { setConn(a); setWayHere(a && !p.demo ? 'key' : 'chat'); }); }, []);
  const target = sections.some((s) => s.id === ask.target) ? ask.target : 'all';
  const ready = ask.request.trim().length > 1;
  async function send() {
    if (!ready || locked) return;
    if (p.demo) { toast('체험이라 AI에게 보내지 않아요. 내 교재로 시작하면 이 버튼으로 바로 고쳐요.'); return; }
    await idle(); editSite(p.id, { target, request: ask.request.trim(), way: 'key', provider: conn.provider, model: conn.model });
    toast('AI에게 보냈어요. 끝나면 미리보기가 바뀌어요.'); setAsk({ ...ask, request: '' });
  }
  async function makePrompt() { await idle(); const t = String(await chatEditPrompt(p.id, { target, request: ask.request.trim() }) || ''); setPrompt(t); return t; }
  const bot = CHATBOTS.find((b) => b.id === getChatbot()) || CHATBOTS[0];
  async function take(input) {
    if (!input || busy) return; setBusy(true);
    try {
      const r = await acceptChatAnswer(p.id, input, { target: target === 'all' ? '' : target }); setRes(r); if (r.continuePrompt) setAnswer('');
      if (r.ok) { await adoptSite(r.site, r.meta, '쓰던 앱으로 고친 판'); setAnswer(''); setPrompt(''); setRes(null); setAsk({ ...ask, request: '' }); toast('답대로 고쳤어요. 마음에 안 들면 [판 기록]에서 되돌려요.'); }
    } catch (e) { console.error(e); setRes({ ok: false, problems: ['답을 읽지 못했어요. AI 답의 코드 블록을 다시 복사해 주세요.'] }); }
    setBusy(false);
  }
  return (
    <div class="stack ask">
      <Field label="고칠 곳"><select class="input" value={target} onChange={(e) => setAsk({ ...ask, target: e.target.value })}><option value="all">사이트 전체</option>{sections.map((s) => <option value={s.id}>{s.name}</option>)}</select></Field>
      <Field label="바라는 점" hint="무엇을 어떻게 바꿀지 적어요. 예: 실습 단계를 세 개로 나누고 단계마다 걸리는 시간을 적어 줘.">
        <textarea class="input" rows={4} maxLength={1500} value={ask.request} onInput={(e) => setAsk({ ...ask, request: e.target.value })} placeholder="예: 첫 화면 제목을 더 짧게, 색은 차분하게" /></Field>
      {locked && <p class="lock-note small">AI가 고치는 중이에요. 끝나면 다시 보낼 수 있어요.</p>}
      {conn && !p.demo && <div class="seg" role="group" aria-label="보낼 곳"><button type="button" aria-pressed={String(way === 'key')} onClick={() => setWayHere('key')}>{PROVIDERS[conn.provider]?.short || 'AI'}로 바로</button><button type="button" aria-pressed={String(way === 'chat')} onClick={() => setWayHere('chat')}>쓰던 앱으로</button></div>}
      {way === 'key' && conn ? <div class="btn-row"><button type="button" class="btn btn-primary" disabled={!ready || locked} onClick={send}>AI에게 보내기</button><span class="small muted">{conn.label}에 보내요. 고치기 전 판은 판 기록에 남아요.</span></div>
        : <ol class="chat-steps">
          <li><b>요청 글을 복사해 쓰던 앱에 보내요</b>
            <div class="btn-row">
              {CHATBOTS.map((b) => <a class="btn btn-sm" href={b.url} target="_blank" rel="noopener" aria-disabled={!ready ? 'true' : undefined} onClick={async (e) => { if (!ready) { e.preventDefault(); toast('바라는 점을 먼저 적어 주세요.'); return; } const t = prompt || await makePrompt(); copy(t, `요청 글을 복사했어요. ${b.name}에 붙여 넣으세요.`); setChatbot(b.id); }}>{b.name} 열기<span class="ext" aria-hidden="true">↗</span></a>)}
            </div>
            <p class="small muted">{target === 'all' ? '사이트 전체를 보내요. 길면 답이 끊길 수 있어 섹션을 고르는 편이 좋아요.' : '고른 섹션만 보내고, 답의 섹션만 갈아 끼워요.'}</p></li>
          <li><b>답을 넣어요</b>
            {res && !res.ok && <div role="alert"><Notice kind="bad"><div class="stack" style={{ gap: '6px' }}><b>{res.continuePrompt ? '답이 중간에 끊겼어요.' : '이 답으로는 고칠 수 없어요.'}</b>{(res.problems || []).filter((x) => x !== '답이 중간에 끊겼어요.').map((x) => <span>{x}</span>)}
              {res.continuePrompt && <div><button type="button" class="btn btn-sm btn-primary" onClick={() => copy(res.continuePrompt, '복사했어요. AI에게 보내세요.')}>이어서 요청 글 복사</button></div>}</div></Notice></div>}
            <textarea class="input ta-short" rows={3} value={answer} onInput={(e) => setAnswer(e.target.value)} placeholder="AI 답(코드 블록)을 여기에 붙여 넣어요" aria-label="AI의 답" />
            <div class="btn-row"><button type="button" class="btn btn-primary" disabled={busy || !answer.trim()} onClick={() => take(answer)}>{busy ? '읽는 중…' : '이 답으로 고치기'}</button></div></li>
        </ol>}
      <p class="small muted">처음부터 새로 만들고 싶으면 <button type="button" class="btn-link small" onClick={() => go(1)}>AI 다시 고르기</button></p>
    </div>
  );
}

const FONTS = [{ value: '', label: '사이트 그대로' }, { value: '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif', label: '고딕' }, { value: '"Noto Serif KR","Nanum Myeongjo","AppleMyungjo",serif', label: '명조' }, { value: '"Nanum Square Round","Apple SD Gothic Neo","Malgun Gothic",sans-serif', label: '둥근 고딕' }];
function lum(hex) { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null; const v = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; }
const ratio = (a, b) => { const x = lum(a), y = lum(b); if (x === null || y === null) return 0; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hex6 = (v) => { const s = String(v || '').trim(); if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase(); const m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s); return m ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toLowerCase() : ''; };
/** 색·글꼴: 사이트 CSS의 --lp-accent·--lp-ink·--lp-paper·--lp-font. 키트·QR 안내문·발표 화면도 같은 색을 이어받음(meta.theme) */
function LookPanel({ p, change }) {
  const { css } = readCss(p.site || {});
  const cur = { accent: hex6(getVar(css, 'accent')) || p.meta?.theme?.accent || '', ink: hex6(getVar(css, 'ink')) || p.meta?.theme?.ink || '', paper: hex6(getVar(css, 'paper')) || p.meta?.theme?.paper || '' };
  const font = getVar(css, 'font');
  const uses = /var\(--lp-(accent|ink|paper)/.test(css);
  const set = (k, v) => change(k === 'font' ? '글꼴 바꾸기' : '색 바꾸기', (c) => {
    const { css: now } = readCss(c.site);
    const site = writeCss(c.site, setVar(now, k, v));
    const theme = { ...(c.meta?.theme || {}), [k]: k === 'font' ? v.split(',')[0].replace(/"/g, '') : v };
    return { site, meta: { ...(c.meta || {}), theme } };
  });
  const r = ratio(cur.ink, cur.paper);
  return (
    <div class="stack look">
      <p class="small muted">바꾸면 사이트와 참여 기능·QR 안내문·발표 화면이 같은 색을 써요.</p>
      {!uses && <Notice><span>이 사이트는 색 변수(--lp-*)를 거의 쓰지 않아 일부만 바뀔 수 있어요. 수정 요청으로 AI에게 색을 바꿔 달라고 해도 돼요.</span></Notice>}
      <div class="look-colors">
        {[['accent', '강조색'], ['ink', '글자색'], ['paper', '바탕색']].map(([k, label]) => <label class="look-color"><input type="color" value={cur[k] || '#333333'} onChange={(e) => set(k, e.target.value)} /><span>{label}<small class="mono">{cur[k] || '정하지 않음'}</small></span></label>)}
      </div>
      {r > 0 && r < 4.5 && <p class="small warn-line" role="status">글자색과 바탕색의 대비가 {r.toFixed(1)}:1이라 읽기 어려워요. 4.5:1 넘게 해 주세요.</p>}
      <fieldset class="field plain-fieldset"><legend>글꼴</legend>
        <div class="radio-row" role="radiogroup" aria-label="글꼴">{FONTS.map((f) => <label><input type="radio" name="lp-font" checked={f.value ? font.replace(/\s/g, '') === f.value.replace(/\s/g, '') : !FONTS.slice(1).some((x) => x.value.replace(/\s/g, '') === font.replace(/\s/g, ''))} disabled={!f.value} onChange={() => f.value && set('font', f.value)} /><span style={{ fontFamily: f.value || undefined }}>{f.label}</span></label>)}</div>
        <small>참가자 기기에 그 글꼴이 없으면 비슷한 글꼴로 보여요.</small>
      </fieldset>
    </div>
  );
}

/** 그림 바꾸기: 교재 쪽 그림 또는 올린 사진 */
function ImageDialog({ n, p, onClose, onPick }) {
  const [pages, setPages] = useState([]); const [alt, setAlt] = useState('');
  const cur = n === null ? null : imageAt(p.site?.['index.html'] || '', n);
  const fileRef = useRef();
  useEffect(() => {
    if (n === null) return undefined;
    let off = false; const urls = [];
    setAlt(cur?.alt || '');
    blobs.keys(p.id).then(async (keys) => {
      const list = keys.filter((k) => /^(assets\/slides\/|site\/material\/)/.test(k) && /\.(webp|png|jpe?g)$/i.test(k));
      const seen = new Set(); const out = [];
      for (const k of list.sort()) {
        const num = +(/(\d+)\.\w+$/.exec(k)?.[1] || 0); if (seen.has(num)) continue; seen.add(num);
        const v = await blobs.get(p.id, k); const u = URL.createObjectURL(v instanceof Blob ? v : new Blob([v])); urls.push(u);
        out.push({ key: k, num, url: u });
      }
      if (!off) setPages(out);
    });
    return () => { off = true; urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [n]);
  async function usePage(pg) {
    const name = `material/p-${String(pg.num || 1).padStart(3, '0')}.${pg.key.split('.').pop()}`;
    if (!pg.key.startsWith('site/')) { const v = await blobs.get(p.id, pg.key); await blobs.put(p.id, 'site/' + name, v); }
    onPick(pg.key.startsWith('site/') ? pg.key.slice(5) : name, alt || `교재 ${pg.num}쪽`);
  }
  async function upload(f) {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) { toast('PNG·JPG·WEBP 사진만 넣을 수 있어요.'); return; }
    if (f.size > 5e6) { toast('5MB보다 작은 사진을 넣어 주세요.'); return; }
    const ext = f.type === 'image/jpeg' ? 'jpg' : f.type.split('/')[1];
    const name = `assets/img/photo-${uid(6)}.${ext}`;
    await blobs.put(p.id, 'site/' + name, new Uint8Array(await f.arrayBuffer()));
    onPick(name, alt || f.name.replace(/\.[^.]+$/, ''));
  }
  return (
    <Dialog open={n !== null} onClose={onClose} label="그림 바꾸기" wide>
      {n !== null && <div class="stack">
        <h2 class="h-sub">그림 바꾸기</h2>
        <Field label="그림 설명" hint="화면 읽기 프로그램이 읽어요."><input class="input" value={alt} onInput={(e) => setAlt(e.target.value)} maxLength={120} placeholder="예: 실습 결과 차트" /></Field>
        <div class="btn-row"><button type="button" class="btn btn-primary" onClick={() => fileRef.current?.click()}>사진 올리기</button>{cur && <button type="button" class="btn btn-quiet" onClick={() => onPick(cur.src, alt)}>설명만 바꾸기</button>}</div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
        <b class="small">교재 쪽 그림</b>
        {pages.length ? <div class="page-grid">{pages.map((pg) => <button type="button" class="page-pick" onClick={() => usePage(pg)} aria-label={`교재 ${pg.num}쪽 그림으로 바꾸기`}><img src={pg.url} alt="" /><span>{pg.num}쪽</span></button>)}</div>
          : <p class="small muted">교재 쪽 그림이 없어요. PDF 교재를 넣으면 쪽마다 그림이 생겨요.</p>}
      </div>}
    </Dialog>
  );
}

/** 판 기록: AI가 만든 판·고치기 전 판(최근 10판). 되돌리면 지금 판도 기록에 남음 */
function Versions({ p, onPick, onRemake }) {
  const list = p.versions || [];
  return (
    <div class="stack">
      <h2 class="h-sub">판 기록</h2>
      <p class="small muted">AI가 만든 판과 AI가 고치기 전 판이 남아요(최근 10판). 직접 고친 것은 [되돌리기]로 하나씩 되돌려요.</p>
      {list.length ? <ul class="versions">{list.map((v) => <li><span><b>{v.label}</b><small>{fmtDate(v.at)}</small></span><button type="button" class="btn btn-sm" onClick={() => onPick(v)}>이 판으로 되돌리기</button></li>)}</ul> : <p class="muted small">아직 기록이 없어요.</p>}
      <div class="btn-row"><button type="button" class="btn btn-quiet" onClick={onRemake}>처음부터 다시 만들기</button></div>
    </div>
  );
}
