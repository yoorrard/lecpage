import { useRef, useState } from 'preact/hooks';
import { StepHead } from '../Project.jsx';
import { Field, Tabs, Dialog, Notice } from '../../components/ui.jsx';
import { Preview } from '../../components/Preview.jsx';
import { AiPanel, useAiResume } from '../../components/AiPanel.jsx';
import { ReviewChat } from '../../components/ReviewChat.jsx';
import { ContentPanel } from './Content.jsx';
import { DesignPanel } from './DesignPanel.jsx';
import { FEATURES, LIVE_KEYS, syncInfo, applyInfo } from '../../lib/blueprint.js';
import { toast } from '../../lib/util.js';
import { SIZE } from './Start.jsx';

const ADMIN = [{ value: 'school', label: '교내 자율연수' }, { value: 'official', label: '교육청 승인 직무연수' }, { value: 'conference', label: '설명회·컨퍼런스' }, { value: 'student', label: '학생 대상' }];
const DEVICES = [{ value: 'laptop', label: '개인 노트북' }, { value: 'chromebook', label: '학교 크롬북' }, { value: 'tablet', label: '태블릿' }, { value: 'phone', label: '휴대폰' }];
const NETWORK = [{ value: 'good', label: '잘 됨' }, { value: 'slow', label: '느림' }, { value: 'restricted', label: '학교망(막힌 곳 있음)' }, { value: 'offline', label: '인터넷 없음' }];

// 되돌리기: 프로젝트마다 최근 20개(이 탭 안에서만)
const undoStacks = new Map();

export function StepEdit({ p, update, go }) {
  const [tab, setTab] = useState('content');
  const [focusId, setFocusId] = useState(null);
  const onPick = (id) => { setTab('content'); setFocusId(id + ':' + Date.now()); };
  const [ai, setAi] = useState(false);
  useAiResume(setAi);
  // 수정 요청: 미리보기에 표시 → 대화창에 그림이 붙음
  const [marking, setMarking] = useState(false);
  const frameRef = useRef(null); const review = useRef(null);
  const onMark = (mode) => { setTab('review'); review.current?.start(mode); };
  const [, force] = useState(0);
  const stack = undoStacks.get(p.id) || []; undoStacks.set(p.id, stack);
  const pushUndo = (label) => { stack.push({ label, blueprint: JSON.parse(JSON.stringify(p.blueprint)), info: { ...p.info } }); if (stack.length > 20) stack.shift(); force((x) => x + 1); };
  const undo = () => { const s = stack.pop(); if (!s) return; update({ blueprint: s.blueprint, info: s.info }); toast(`되돌렸어요: ${s.label}`); force((x) => x + 1); };
  if (!p.blueprint) return <><StepHead title="살펴보고 고치기" /><Notice>먼저 사이트 초안을 만들어 주세요.</Notice><div><button class="btn btn-primary" onClick={() => go(1)}>초안 만들러 가기</button></div></>;
  const setInfo = (patch) => update((cur) => { const info = { ...cur.info, ...patch }; return { info, infoTouched: true, blueprint: syncInfo(cur.blueprint, info) }; });
  function onAi(bp, meta = {}) {
    pushUndo('AI로 다듬기');
    if (meta.polish) update({ blueprint: bp, aiMethod: 'ai' }); // 문구만 바뀜(설정·연결은 그대로)
    else update((cur) => ({ blueprint: applyInfo(bp, cur.info, cur.material, cur.blueprint), aiMethod: 'ai' }));
    setAi(false); toast(meta.polish ? `문구 ${meta.count}곳을 다듬었어요. 마음에 안 들면 [되돌리기]를 누르세요.` : 'AI가 다시 짠 내용으로 바꿨어요. 마음에 안 들면 [되돌리기]를 누르세요.');
  }
  const liveCount = (p.info.features || []).filter((f) => LIVE_KEYS.includes(f)).length;
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
          <button class="btn btn-sm" onClick={() => setAi(true)}>AI로 다듬기</button>
          <button class="btn btn-sm btn-quiet" disabled={!stack.length} onClick={undo} title={stack.length ? `되돌리기: ${stack[stack.length - 1].label}` : '되돌릴 것이 없어요'}>되돌리기</button>
          <button class="btn btn-primary" onClick={() => go(3)}>공유하기 →</button>
        </div>
      </StepHead>
      <div class="workspace">
        <div class="ws-panel">
          <Tabs label="고칠 것" tabs={tabs} value={tab} onChange={setTab} />
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} class="ws-body">
            {tab === 'content' && <ContentPanel p={p} update={update} pushUndo={pushUndo} focusId={focusId} />}
            {tab === 'design' && <DesignPanel p={p} update={update} />}
            {tab === 'live' && <FeaturesPanel p={p} update={update} setInfo={setInfo} />}
            {tab === 'more' && <DetailsPanel p={p} setInfo={setInfo} />}
            <ReviewChat hidden={tab !== 'review'} p={p} update={update} pushUndo={pushUndo} undo={undo} undoTop={() => stack[stack.length - 1]} frameRef={frameRef} marking={marking} setMarking={setMarking} apiRef={review} onConnectAi={() => setAi(true)} />
          </div>
        </div>
        <Preview p={p} onPick={onPick} frameRef={frameRef} marking={marking} onMark={onMark} />
      </div>
      <Dialog open={ai} onClose={() => setAi(false)} label="AI로 다듬기" wide>
        {ai && <AiPanel p={p} onBlueprint={onAi} />}
      </Dialog>
    </>
  );
}

function FeaturesPanel({ p, update, setInfo }) {
  const info = p.info; const f = info.features || [];
  const pv = p.blueprint.privacy || {};
  const setPv = (patch) => update((cur) => ({ blueprint: { ...cur.blueprint, privacy: { ...(cur.blueprint.privacy || {}), ...patch } } }));
  const toggle = (v) => setInfo({ features: f.includes(v) ? f.filter((x) => x !== v) : [...f, v] });
  const anyLive = f.some((x) => LIVE_KEYS.includes(x));
  return (
    <div class="stack">
      <p class="small muted">켠 기능은 참가자 휴대폰과 강사 화면을 이어 줘요. 미리보기에서 바로 시험해 볼 수 있고, 실제 연결은 공유하기 단계에서 해요.</p>
      <ul class="feat-list">
        {FEATURES.map((x) => (
          <li><label class="feat"><input type="checkbox" checked={f.includes(x.value)} onChange={() => toggle(x.value)} /><span><b>{x.label}</b><small>{x.desc}</small></span></label></li>
        ))}
      </ul>
      {anyLive && <>
        <div class="field"><span>참가자에게 받을 정보</span>
          <Radios name="collect" value={(pv.collect || ['nickname']).includes('name') ? 'name' : 'nick'} onChange={(v) => setPv({ collect: v === 'name' ? ['nickname', 'name', 'school'] : ['nickname'] })} options={[{ value: 'nick', label: '별명만(권장)' }, { value: 'name', label: '이름·소속도(출석·이수용)' }]} label="받을 정보" />
          {p.blueprint.audience?.minor && <small>만 14세 미만이 참여해 별명만 받아요.</small>}
        </div>
        <Field label="참여 기록 보관 기간(일)" hint="개인정보 안내에 적혀요. 기간이 지나면 강사 화면에서 지워 주세요."><input type="number" min="1" max="365" value={pv.retentionDays || 30} onInput={(e) => setPv({ retentionDays: +e.target.value || 30 })} style={{ width: '120px' }} /></Field>
        <p class="small muted">만족도 설문 5문항이 기본으로 들어가요. 문항은 '내용' 탭에서 고쳐요.</p>
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
        <Radios name="mode" value={info.mode || 'offline'} onChange={(v) => setInfo({ mode: v })} options={[{ value: 'offline', label: '오프라인' }, { value: 'online', label: '온라인' }, { value: 'hybrid', label: '함께' }]} label="진행 방식" />
      </fieldset>
      {(info.mode === 'online' || info.mode === 'hybrid') && <Field label="온라인 접속 주소" hint="Zoom·Meet 등. 참가자 첫 화면에 입장 단추로 보여요."><input type="url" value={info.joinUrl || ''} onInput={set('joinUrl')} placeholder="https://" maxLength={300} /></Field>}
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
      {(info.admin === 'official' || (info.features || []).includes('attendance')) && <Field label="이수 기준(머문 시간 %)" hint="이수 확인표에서 이 비율 이상 머문 참가자를 '이수'로 표시해요."><input type="number" min="0" max="100" value={info.completionRate ?? 80} onInput={set('completionRate')} style={{ width: '120px' }} /></Field>}
      <fieldset class="field plain-fieldset"><legend>참가자 기기</legend>
        <div class="inline-checks">{DEVICES.map((o) => { const cur = info.devices || []; return <label class="check"><input type="checkbox" checked={cur.includes(o.value)} onChange={() => setInfo({ devices: cur.includes(o.value) ? cur.filter((x) => x !== o.value) : [...cur, o.value] })} /><span>{o.label}</span></label>; })}</div>
      </fieldset>
      <label class="check"><input type="checkbox" checked={!!info.minor} onChange={set('minor')} /><span>만 14세 미만 학생이 참여해요 <span class="small muted">(별명만 받고 사진 올리기를 꺼요)</span></span></label>
      <label class="check"><input type="checkbox" checked={!!info.commercial} onChange={set('commercial')} /><span>강사료를 받는 연수예요 <span class="small muted">(상업적 이용을 막은 무료 서비스는 추천에서 빼요)</span></span></label>
    </div>
  );
}

/** 라디오 묶음(고를 것이 2~3개일 때) */
function Radios({ name, value, onChange, options, label }) {
  return <div class="radio-row" role="radiogroup" aria-label={label}>{options.map((o) => <label><input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} /><span>{o.label}</span></label>)}</div>;
}
