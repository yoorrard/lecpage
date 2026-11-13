import { AiConnect } from '../../components/AiConnect.jsx';
import { useEffect, useRef, useState } from 'preact/hooks';
import { StepHead } from '../Project.jsx';
import { Field, Tabs, Dialog, Notice } from '../../components/ui.jsx';
import { Preview } from '../../components/Preview.jsx';
import { AiPanel, useAiResume, GuardNote } from '../../components/AiPanel.jsx';
import { ReviewChat } from '../../components/ReviewChat.jsx';
import { ContentPanel } from './Content.jsx';
import { DesignPanel } from './DesignPanel.jsx';
import { FEATURES, LIVE_KEYS, syncInfo, applyInfo } from '../../lib/blueprint.js';
import { toast } from '../../lib/util.js';
import { undoStack, pushUndoFor, popUndo, onUndoChange } from '../../lib/undo.js';
import { useAiJob, startMakeJob, stopJob, clearJob, noteAiResult, markUndone } from '../../lib/ai-job.js';
import { E } from '../../lib/engine.js';
import { PROVIDERS, chatLabel, chatbotFor, setWay } from '../../lib/ai.js';
import { SIZE } from './Start.jsx';
import { StructureNote } from '../../components/Structure.jsx';

const ADMIN = [{ value: 'school', label: '교내 자율연수' }, { value: 'official', label: '교육청 승인 직무연수' }, { value: 'conference', label: '설명회·컨퍼런스' }, { value: 'student', label: '학생 대상' }];
const DEVICES = [{ value: 'laptop', label: '개인 노트북' }, { value: 'chromebook', label: '학교 크롬북' }, { value: 'tablet', label: '태블릿' }, { value: 'phone', label: '휴대폰' }];
const NETWORK = [{ value: 'good', label: '잘 됨' }, { value: 'slow', label: '느림' }, { value: 'restricted', label: '학교망(막힌 곳 있음)' }, { value: 'offline', label: '인터넷 없음' }];


export function StepEdit({ p, update, go }) {
  // AI 에이전트(skill `app` 명령)에서 만든 연수를 처음 열면: 내용은 에이전트가 짰으니 디자인부터 보여 주고 다음 할 일을 알림
  const fromSkill = p.origin === 'skill' && !p.originSeen && !p.visited?.[3];
  const [tab, setTab] = useState(fromSkill ? 'design' : 'content');
  const [focusId, setFocusId] = useState(null);
  const onPick = (id) => { setTab('content'); setFocusId(id + ':' + Date.now()); };
  // 다른 화면에서 '이 섹션을 열어 달라'고 남긴 표시(예: 배포 화면의 [자료 올리기])
  useEffect(() => { try { const id = sessionStorage.getItem('lecpage:focus'); if (id) { sessionStorage.removeItem('lecpage:focus'); onPick(id); } } catch { } }, []);
  const [ai, setAi] = useState(false); // AI로 다듬기 창. 객체면 그 길로 열기({ how, full, bot })
  const [connectAi, setConnectAi] = useState(false); // 한도에 걸렸을 때 다른 AI로 이어서
  useAiResume(setAi);
  // 수정 요청: 미리보기에 표시 → 대화창에 그림이 붙음
  const [marking, setMarking] = useState(false);
  const frameRef = useRef(null); const review = useRef(null);
  const onMark = (mode) => { setTab('review'); review.current?.start(mode); };
  const [, force] = useState(0);
  useEffect(() => onUndoChange(() => force((x) => x + 1)), []);
  const stack = undoStack(p.id);
  const pushUndo = (label) => pushUndoFor(p.id, label, p);
  const undo = () => { const s = popUndo(p.id); if (!s) return; update({ blueprint: s.blueprint, info: s.info }); toast(`되돌렸어요: ${s.label}`); };
  const job = useAiJob(p.id);
  const latest = useRef(p); latest.current = p;
  // AI 회사 API가 이 망에서 막혔으면(만들기 전에 확인) 오류 띠 대신 바로 쓰던 AI 창 길을 엶
  useEffect(() => {
    if (job?.status !== 'error' || job.error?.kind !== 'blocked') return;
    const prov = job.error.provider; clearJob(p.id); setWay('chat');
    toast(`이 망에서 ${PROVIDERS[prov]?.short || 'AI'} API에 닿지 않아 쓰던 AI 창으로 바꿨어요.`);
    setAi({ how: 'paste', full: true, bot: chatbotFor(prov) });
  }, [job?.status, job?.error?.kind]);
  if (!p.blueprint) return <><StepHead title="살펴보고 고치기" /><Notice>먼저 사이트 초안을 만들어 주세요.</Notice><div><button class="btn btn-primary" onClick={() => go(1)}>초안 만들러 가기</button></div></>;
  const setInfo = (patch) => update((cur) => { const info = { ...cur.info, ...patch }; return { info, infoTouched: true, blueprint: syncInfo(cur.blueprint, info, patch) }; });
  function onAi(bp, meta = {}) {
    pushUndo('AI로 다듬기');
    if (meta.polish) update({ blueprint: bp, aiMethod: 'ai' }); // 문구만 바뀜(설정·연결은 그대로)
    else update((cur) => ({ blueprint: applyInfo(bp, cur.info, cur.material, cur.blueprint), aiMethod: 'ai' }));
    setAi(false); toast(meta.polish ? `문구 ${meta.count}곳을 다듬었어요. 마음에 안 들면 [되돌리기]를 누르세요.` : 'AI가 다시 짠 내용으로 바꿨어요. 마음에 안 들면 [되돌리기]를 누르세요.');
    if (E.restoredCount(meta.restored)) noteAiResult(p.id, { restored: meta.restored, polish: !!meta.polish });
  }
  /** 교재대로 되돌린 곳 하나를 AI 답으로(그곳만, 강사가 고친 다른 곳은 그대로) */
  function undoGuard(r) { update((cur) => ({ blueprint: E.undoRestore(cur.blueprint, r) })); markUndone(p.id, r.id); toast(`AI 답으로 되돌렸어요: ${r.where}`); }
  const liveCount = (p.info.features || []).filter((f) => LIVE_KEYS.includes(f)).length;
  // 배포한 뒤 고쳤으면 머리 버튼이 [다시 배포하기](배포하기 화면에서 지난번 곳에 바로 배포함)
  const published = !!p.deploy?.lastUrl;
  const changed = published && (p.editedAt || 0) > (p.deploy.at || 0);
  const tabs = [
    { value: 'content', label: '내용' },
    { value: 'design', label: '디자인' },
    { value: 'live', label: '참여 기능', badge: liveCount ? String(liveCount) : '' },
    { value: 'more', label: '연수 정보' },
    { value: 'review', label: '수정 요청' },
  ];
  return (
    <>
      <StepHead title="살펴보고 고치기" desc="미리보기를 보며 고치세요. 고친 내용은 자동으로 저장돼요.">
        <div class="btn-row head-tools">
          <button class="btn btn-sm btn-quiet" disabled={!stack.length} onClick={undo} title={stack.length ? `되돌리기: ${stack[stack.length - 1].label}` : '되돌릴 것이 없어요'}>되돌리기</button>
          {!published ? <button class="btn btn-primary" onClick={() => go(3)}>배포하기 →</button>
            : changed ? <button class="btn btn-primary" onClick={() => { try { sessionStorage.setItem('lecpage:republish', p.id); } catch { } go(3); }}>다시 배포하기</button>
              : <button class="btn" onClick={() => go(3)}>주소·QR 보기 →</button>}
        </div>
      </StepHead>
      {job && <AiJobBar job={job} found={p.material ? E.foundSummary(p.material.detected || {}, 3).join(' · ') : ''} onStop={() => stopJob(p.id)} onClose={() => clearJob(p.id)} onUndo={undo} canUndo={stack[stack.length - 1]?.label === 'AI로 만들기 전'}
        onRetry={() => startMakeJob({ getProject: () => latest.current, update })} onPaste={(prov) => { clearJob(p.id); setWay('chat'); setAi({ how: 'paste', full: true, bot: chatbotFor(prov) }); }} onConnect={() => setConnectAi(true)} onUndoGuard={undoGuard} onPay={() => startMakeJob({ getProject: () => latest.current, update, allowPaid: true })} onLight={() => startMakeJob({ getProject: () => latest.current, update, allowLight: true })} />}
      {fromSkill && <div class="ai-job ok" role="status">
        <span class="ai-job-t"><b>AI 에이전트에서 만든 연수를 열었어요. 디자인·참여 기능·배포를 여기서 이어서 하세요.</b><small>참여 기능 연결과 사이트 암호는 옮겨 오지 않아요. 여기서 다시 정해요.</small></span>
        <button class="btn btn-sm" onClick={() => setTab('live')}>참여 기능 보기</button>
        <button class="icon-btn" onClick={() => update({ originSeen: true })} aria-label="안내 닫기">✕</button>
      </div>}
      {job?.status !== 'running' && <StructureNote p={p} update={update} setInfo={setInfo} pushUndo={pushUndo} />}
      <div class="workspace">
        <div class="ws-panel">
          <Tabs label="고칠 것" tabs={tabs} value={tab} onChange={setTab} />
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} class="ws-body">
            {tab === 'content' && <ContentPanel p={p} update={update} pushUndo={pushUndo} focusId={focusId} />}
            {tab === 'design' && <DesignPanel p={p} update={update} />}
            {tab === 'live' && <FeaturesPanel p={p} update={update} setInfo={setInfo} />}
            {tab === 'more' && <DetailsPanel p={p} setInfo={setInfo} />}
            <ReviewChat hidden={tab !== 'review'} p={p} update={update} pushUndo={pushUndo} undo={undo} undoTop={() => stack[stack.length - 1]} frameRef={frameRef} marking={marking} setMarking={setMarking} apiRef={review} onConnectAi={() => setAi(true)} onPolish={() => setAi(true)} />
          </div>
        </div>
        <Preview p={p} onPick={onPick} frameRef={frameRef} marking={marking} onMark={onMark} />
      </div>
      <Dialog open={connectAi} onClose={() => setConnectAi(false)} label="AI 연결" wide>
        {connectAi && <div class="stack"><h2 class="h-sub">AI 연결</h2>
          <AiConnect onConnected={() => { setConnectAi(false); clearJob(p.id); startMakeJob({ getProject: () => latest.current, update }); }} onChat={(prov) => { setConnectAi(false); clearJob(p.id); setAi({ how: 'paste', full: true, bot: chatbotFor(prov) }); }} /></div>}
      </Dialog>
      <Dialog open={ai} onClose={() => setAi(false)} label="AI로 다듬기" wide>
        {ai && <AiPanel p={p} onBlueprint={onAi} start={typeof ai === 'object' ? ai : null} />}
      </Dialog>
    </>
  );
}

const PHASE = { read: '교재를 정리하고 있어요', ask: 'AI가 교재를 읽고 연수 흐름과 문구를 짜고 있어요', build: '사이트를 조립하고 있어요', wait: '무료 한도라 잠깐 기다렸다가 이어서 해요', swap: '다른 모델로 이어서 하고 있어요', other: '연결해 둔 다른 AI로 이어서 하고 있어요' };
/** AI로 만들기 진행 띠: 초안을 먼저 보여 주고, 끝나면 AI가 짠 내용으로 바뀜 */
function AiJobBar({ job, found, onStop, onClose, onUndo, canUndo, onRetry, onPaste, onConnect, onPay, onLight, onUndoGuard }) {
  if (job.status === 'running') {
    const sec = Math.max(0, Math.round((Date.now() - job.startedAt) / 1000));
    return (
      <div class="ai-job" role="status" aria-live="polite">
        <span class="ai-job-dot" aria-hidden="true" />
        <span class="ai-job-t"><b>{PHASE[job.phase] || PHASE.ask}</b><small>{found ? `교재에서 찾은 것(${found})은 그대로 실어요. ` : ''}지금 보이는 것은 기본 초안이고, 1~2분 뒤 AI가 짠 내용으로 바뀌어요. {sec}초</small></span>
        <button class="btn btn-sm btn-quiet" onClick={onStop}>멈추기</button>
      </div>
    );
  }
  if (job.status === 'done') {
    return (
      <div class="ai-job ok" role="status">
        <span class="ai-job-t"><b>{job.polish ? 'AI가 문구를 다듬었어요.' : job.via ? `${job.via}로 이어서 사이트를 짰어요.` : 'AI가 교재에 맞게 사이트를 짰어요.'}</b><small>미리보기를 보며 고치고, 마음에 들면 배포하세요.</small></span>
        {canUndo && <button class="btn btn-sm btn-quiet" onClick={() => { onUndo(); onClose(); }}>기본 초안으로 되돌리기</button>}
        <button class="icon-btn" onClick={onClose} aria-label="닫기">✕</button>
        <GuardNote restored={job.restored} undone={job.undone} onUndo={onUndoGuard} />
      </div>
    );
  }
  const e = job.error || {};
  return (
    <div class="ai-job bad" role="alert">
      <span class="ai-job-t"><b>{e.title || 'AI로 만들지 못했어요.'}</b><small>{e.body || '기본 초안은 그대로 있어요.'}</small></span>
      {e.kind === 'no-ai' || /연결되어 있지/.test(e.title || '') ? <button class="btn btn-sm" onClick={onConnect}>AI 연결하기</button> : !e.actions?.some((a) => a === 'pay' || a === 'light') && <button class="btn btn-sm" onClick={onRetry}>다시 하기</button>}
      {e.actions?.includes('pay') && <button class="btn btn-sm btn-primary" onClick={onPay}>유료로 이어서 하기</button>}
      {e.actions?.includes('light') && <button class="btn btn-sm" onClick={onLight}>가벼운 모델로 이어서</button>}
      {e.actions?.includes('link') && e.link && <a class="btn btn-sm" href={e.link.href} target="_blank" rel="noopener">{e.link.label}</a>}
      {e.actions?.includes('billing') && PROVIDERS[e.provider]?.billingUrl && <a class="btn btn-sm" href={PROVIDERS[e.provider].billingUrl} target="_blank" rel="noopener">{PROVIDERS[e.provider].short} 결제 페이지 열기</a>}
      {e.actions?.includes('connect') && <button class="btn btn-sm" onClick={onConnect}>다른 AI 연결</button>}
      {e.actions?.includes('paste') && <button class={`btn btn-sm${e.actions[0] === 'paste' ? ' btn-primary' : ' btn-quiet'}`} onClick={() => onPaste(e.provider)}>{chatLabel(e.provider)}</button>}
      <button class="icon-btn" onClick={onClose} aria-label="닫기">✕</button>
    </div>
  );
}

function FeaturesPanel({ p, update, setInfo }) {
  const info = p.info; const f = info.features || [];
  const pv = p.blueprint.privacy || {};
  const setPv = (patch) => update((cur) => ({ blueprint: { ...cur.blueprint, privacy: { ...(cur.blueprint.privacy || {}), ...patch } } }));
  const toggle = (v) => setInfo({ features: f.includes(v) ? f.filter((x) => x !== v) : [...f, v] });
  const anyLive = f.some((x) => LIVE_KEYS.includes(x));
  const board = (p.blueprint.sections || []).find((s) => s.type === 'board');
  const setBoard = (patch) => update((cur) => ({ blueprint: { ...cur.blueprint, sections: cur.blueprint.sections.map((s) => (s.type === 'board' ? { ...s, ...patch } : s)) } }));
  const minor = !!p.blueprint.audience?.minor;
  return (
    <div class="stack">
      <p class="small muted">켠 기능은 참가자 휴대폰과 강사 화면을 이어 줘요. 미리보기에서 바로 시험해 볼 수 있고, 실제 연결은 배포하기 단계에서 해요.</p>
      <ul class="feat-list">
        {FEATURES.map((x) => (
          <li><label class="feat"><input type="checkbox" checked={f.includes(x.value)} onChange={() => toggle(x.value)} /><span><b>{x.label}</b><small>{x.desc}</small></span></label></li>
        ))}
      </ul>
      {board && <fieldset class="field plain-fieldset"><legend>결과물 나눔 보드</legend>
        <label class="check"><input type="checkbox" checked={!!board.moderation} onChange={(e) => setBoard({ moderation: e.target.checked })} /><span>강사가 확인한 글만 보이기</span></label>
        <label class="check"><input type="checkbox" checked={board.allowFiles !== false && !minor} disabled={minor} onChange={(e) => setBoard({ allowFiles: e.target.checked })} /><span>사진·파일 올리기{minor ? <small class="muted"> (만 14세 미만이 참여해 꺼 둬요)</small> : null}</span></label>
      </fieldset>}
      {anyLive && <>
        <div class="field"><span>참가자에게 받을 정보</span>
          <Radios name="collect" value={(pv.collect || ['nickname']).includes('name') ? 'name' : 'nick'} onChange={(v) => setPv({ collect: v === 'name' ? ['nickname', 'name', 'school'] : ['nickname'] })} options={[{ value: 'nick', label: '별명만(권장)' }, { value: 'name', label: '이름·소속도(출석·이수용)' }]} label="받을 정보" />
          {p.blueprint.audience?.minor && <small>만 14세 미만이 참여해 별명만 받아요.</small>}
        </div>
        <Field label="참여 기록 보관 기간(일)" hint="개인정보 안내에 적혀요. 기간이 지나면 강사 화면에서 지워 주세요."><input type="number" min="1" max="365" value={pv.retentionDays || 30} onInput={(e) => setPv({ retentionDays: +e.target.value || 30 })} style={{ width: '120px' }} /></Field>
        <p class="small muted">만족도 조사에는 설문 5문항이 기본으로 들어가요. 문항은 '내용' 탭에서 고쳐요.</p>
      </>}
    </div>
  );
}

function DetailsPanel({ p, setInfo }) {
  const info = p.info;
  const set = (k) => (e) => setInfo({ [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e });
  return (
    <div class="stack">
      <div class="form-grid">
        <Field label="연수명"><input value={info.title} onInput={set('title')} maxLength={160} /></Field>
        <Field label="핵심 메시지(부제)"><input value={info.subtitle} onInput={set('subtitle')} maxLength={200} placeholder="이 연수가 약속하는 한 문장" /></Field>
        <Field label="주최·주관"><input value={info.organizer} onInput={set('organizer')} maxLength={120} /></Field>
        <Field label="날짜"><input type="date" value={info.date} onInput={set('date')} /></Field>
        <Field label="시작"><input type="time" value={info.start} onInput={set('start')} /></Field>
        <Field label="끝"><input type="time" value={info.end} onInput={set('end')} /></Field>
        <Field label="장소"><input value={info.venue} onInput={set('venue')} maxLength={120} /></Field>
        <Field label="문의처" hint="참가자가 연락할 곳(연수 담당자 전화·메일)"><input value={info.contact || ''} onInput={set('contact')} maxLength={120} /></Field>
      </div>
      <fieldset class="field plain-fieldset"><legend>진행 방식</legend>
        <Radios name="mode" value={info.mode || 'offline'} onChange={(v) => setInfo({ mode: v })} options={[{ value: 'offline', label: '오프라인' }, { value: 'online', label: '온라인' }, { value: 'hybrid', label: '병행' }]} label="진행 방식" />
      </fieldset>
      {(info.mode === 'online' || info.mode === 'hybrid') && <Field label="온라인 접속 주소" hint="Zoom·Meet 등. 참가자 첫 화면에 입장 버튼으로 보여요."><input type="url" value={info.joinUrl || ''} onInput={set('joinUrl')} placeholder="https://" maxLength={300} /></Field>}
      <h3 class="h-sub">강사</h3>
      <div class="form-grid">
        <Field label="이름"><input value={info.instructorName} onInput={set('instructorName')} maxLength={40} /></Field>
        <Field label="소속·직함"><input value={info.instructorOrg} onInput={set('instructorOrg')} maxLength={80} /></Field>
        <Field label="이메일(적으면 사이트에 보여요)"><input type="email" value={info.instructorEmail} onInput={set('instructorEmail')} /></Field>
      </div>
      <Field label="강사 소개"><textarea value={info.instructorBio} onInput={set('instructorBio')} maxLength={600} rows={3} /></Field>
      <h3 class="h-sub">참가자와 연수</h3>
      <div class="form-grid">
        <Field label="참가 인원"><select value={info.size} onChange={(e) => setInfo({ size: +e.target.value })}>{SIZE.map((o) => <option value={o.value}>{o.label}</option>)}</select></Field>
        <Field label="연수 성격"><select value={info.admin} onChange={(e) => { const v = e.target.value; setInfo({ admin: v, minor: v === 'student' ? true : info.minor }); }}>{ADMIN.map((o) => <option value={o.value}>{o.label}</option>)}</select></Field>
        <Field label="연수 장소 인터넷"><select value={info.network} onChange={set('network')}>{NETWORK.map((o) => <option value={o.value}>{o.label}</option>)}</select></Field>
      </div>
      {(info.admin === 'official' || (info.features || []).includes('attendance')) && <Field label="이수 기준(머문 시간 %)" hint="이수자 명단에서 이 비율 이상 머문 참가자를 '이수'로 표시해요."><input type="number" min="0" max="100" value={info.completionRate ?? 80} onInput={set('completionRate')} style={{ width: '120px' }} /></Field>}
      <fieldset class="field plain-fieldset"><legend>참가자 기기</legend>
        <div class="inline-checks">{DEVICES.map((o) => { const cur = info.devices || []; return <label class="check"><input type="checkbox" checked={cur.includes(o.value)} onChange={() => setInfo({ devices: cur.includes(o.value) ? cur.filter((x) => x !== o.value) : [...cur, o.value] })} /><span>{o.label}</span></label>; })}</div>
      </fieldset>
      <label class="check"><input type="checkbox" checked={!!info.minor} onChange={set('minor')} /><span>만 14세 미만 학생이 참여해요 <span class="small muted">(별명만 받고 사진 올리기를 꺼요)</span></span></label>
    </div>
  );
}

/** 라디오 묶음(고를 것이 2~3개일 때) */
function Radios({ name, value, onChange, options, label }) {
  return <div class="radio-row" role="radiogroup" aria-label={label}>{options.map((o) => <label><input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} /><span>{o.label}</span></label>)}</div>;
}
