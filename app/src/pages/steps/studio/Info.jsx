import { useEffect, useRef, useState } from 'preact/hooks';
import { Field } from '../../../components/ui.jsx';
import { firstSession } from '../../../lib/site-meta.js';
import { replaceText, replaceSchedule } from '../../../lib/site-doc.js';
import { toast, isPastDate, monthDay } from '../../../lib/util.js';

// 연수 정보(p.meta): 요약 한 줄 + [수정]을 누르면 그 자리에서 고침. AI가 찾은 쪽 번호를 보여 주고,
// 고치면 사이트 글에 같은 글자로 적힌 곳(날짜·시간은 같은 꼴로, lib/date-text.js)과 QR 안내문·강사 화면·발표 화면·일정 파일이 함께 바뀜.
// 고칠 때마다 버전 기록에 남음(change의 kind 'info', 잇따른 수정은 하나로)

const FACT_OF = { title: ['연수명', '제목', '연수 제목'], date: ['날짜', '일시', '연수 날짜'], time: ['시간', '시각', '일시'], venue: ['장소'], instructor: ['강사', '강사명'] };
const DAY = '일월화수목금토';
const dayOf = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? DAY[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()] : ''; };
/** 요약: '12월 24일(목) 14:00~17:00 · 대강당 · 홍길동' */
export function infoLine(m = {}) {
  const s0 = firstSession(m); const inst = (m.instructors || [])[0] || {};
  const when = [s0.date ? `${monthDay(s0.date)}(${dayOf(s0.date)})` : '', s0.start ? `${s0.start}${s0.end ? `~${s0.end}` : ''}` : ''].filter(Boolean).join(' ');
  return [when, m.venue, inst.name].filter(Boolean).join(' · ');
}

export function InfoCard({ p, change, update, onConfirmed }) {
  const [open, setOpen] = useState(false);
  const m = p.meta || {}; const s0 = firstSession(m);
  const checked = !!p.metaChecked;
  const line = infoLine(m);
  const past = isPastDate(s0.date);
  return (
    <section class={`st-card st-info${checked ? '' : ' is-todo'}`} aria-labelledby="st-info-h">
      <div class="st-card-h">
        <h2 id="st-info-h" class="st-h">연수 정보</h2>
        <button type="button" class="btn btn-sm btn-quiet" aria-expanded={String(open)} aria-controls="st-info-form" onClick={() => setOpen(!open)}>{open ? '접기' : '수정'}</button>
      </div>
      {!open && <button type="button" class="st-info-sum" onClick={() => setOpen(true)} title="눌러서 수정">
        <b>{m.title || '연수명을 넣어 주세요'}</b>
        <span>{line || '날짜·장소를 넣어 주세요'}</span>
        {past && <span class="warn-line small" role="status">{monthDay(s0.date)}은 지난 날짜예요. 이번 연수 날짜로 고쳐 주세요.</span>}
      </button>}
      {!checked && <div class="st-info-ask">
        <p class="small">AI가 교재에서 찾은 값이에요. QR 안내문·강사 화면·일정 파일에도 쓰여요.</p>
        <div class="btn-row confirm-bar">
          <button type="button" class="btn btn-sm btn-primary" data-coach={p.demo ? '' : undefined} data-coach-room={p.demo ? '' : undefined} onClick={() => { update({ metaChecked: true }); setOpen(false); toast('확인했어요. 미리보기를 살펴본 뒤 [배포하기]를 눌러요.'); onConfirmed?.(); }}>이 정보가 맞아요</button>
          {!open && <button type="button" class="btn btn-sm" onClick={() => setOpen(true)}>틀린 곳 수정</button>}
        </div>
      </div>}
      {open && <InfoForm p={p} change={change} />}
    </section>
  );
}

/** 날짜·시각 칸: 다 쓴 값만(입력을 멈추고 0.7초 뒤나 칸을 떠날 때) 한 번 반영 — 쓰는 도중의 값(0002년 등)이 사이트 글을 바꾸지 않게 */
function WhenInput({ type, value, onCommit, label }) {
  const [v, setV] = useState(value || '');
  const ref = useRef(); const t = useRef();
  useEffect(() => { if (document.activeElement !== ref.current) setV(value || ''); }, [value]);
  const ok = (x) => (type === 'date' ? /^(\d{4})-\d{2}-\d{2}$/.test(x) && +x.slice(0, 4) >= 2000 : /^\d{2}:\d{2}$/.test(x));
  const commit = (x = v) => { clearTimeout(t.current); if (x !== (value || '') && (ok(x) || (!x && type !== 'date'))) onCommit(x); };
  useEffect(() => () => clearTimeout(t.current), []);
  return <input ref={ref} type={type} class="input" value={v} aria-label={label}
    onInput={(e) => { const x = e.target.value; setV(x); clearTimeout(t.current); t.current = setTimeout(() => commit(x), 700); }}
    onBlur={() => commit()} />;
}

function InfoForm({ p, change }) {
  const m = p.meta || {}; const s0 = firstSession(m); const inst = (m.instructors || [])[0] || {};
  const facts = m.facts || [];
  const page = (k) => { const f = facts.find((x) => FACT_OF[k].includes(String(x.label || '').trim())); return f?.page ? `교재 ${f.page}쪽에서 찾았어요` : f ? 'AI가 교재에서 찾았어요' : ''; };
  // 글자 칸: 사이트의 모든 쪽에서 같은 글자를 바꿈
  const setMeta = (label, fn, fromTo) => change(label, (cur) => {
    const meta = fn(cur.meta || {}); let site = cur.site;
    if (fromTo) for (const k of Object.keys(site || {})) if (/\.html?$/i.test(k) && typeof site[k] === 'string') { const h = replaceText(site[k], fromTo[0], fromTo[1]); if (h !== site[k]) site = { ...site, [k]: h }; }
    return { meta, ...(site !== cur.site ? { site } : {}) };
  }, 'info');
  // 날짜·시각: 연수 정보(첫 날짜가 있는 일정)와 사이트에 적힌 같은 날짜·시간(같은 꼴로)
  const setWhen = (k, v) => change(k === 'date' ? '날짜' : '시간', (cur) => {
    const mm = cur.meta || {}; const ses = [...(mm.sessions || [])];
    const i = Math.max(0, ses.findIndex((x) => x?.date));
    const before = { date: '', start: '', end: '', ...(ses[i] || {}) }; const after = { ...before, [k]: v };
    ses[i] = after;
    const site = replaceSchedule(cur.site, before, after);
    return { meta: { ...mm, sessions: ses }, ...(site !== cur.site ? { site } : {}) };
  }, 'info');
  const textField = (label, val, max, set, hint) => <Field label={label} hint={hint}><input class="input" defaultValue={val} key={val} maxLength={max} onChange={(e) => set(e.target.value.trim())} /></Field>;
  const others = facts.filter((f) => !Object.values(FACT_OF).flat().includes(String(f.label || '').trim()));
  return (
    <div class="stack st-info-form" id="st-info-form">
      <p class="small muted">고치면 사이트에 같은 글자로 적힌 곳과 QR 안내문·강사 화면·발표 화면·일정 파일이 함께 바뀌어요.</p>
      <div class="form-grid">
        {textField('연수명', m.title || '', 160, (v) => v && v !== m.title && setMeta('연수명', (mm) => ({ ...mm, title: v }), [m.title, v]), page('title'))}
        <Field label="날짜" hint={isPastDate(s0.date) ? <span class="warn-line" role="status">{monthDay(s0.date)}은 지난 날짜예요. 이번 연수 날짜로 고쳐 주세요.</span> : page('date') || (!s0.date ? <span class="warn-line">날짜를 넣어 주세요.</span> : '')}>
          <WhenInput type="date" value={s0.date} label="날짜" onCommit={(v) => setWhen('date', v)} /></Field>
        <div class="stack" style={{ gap: '4px' }}>
          <div class="pair">
            <Field label="시작"><WhenInput type="time" value={s0.start} label="시작" onCommit={(v) => setWhen('start', v)} /></Field>
            <Field label="끝"><WhenInput type="time" value={s0.end} label="끝" onCommit={(v) => setWhen('end', v)} /></Field>
          </div>
          {page('time') && <small class="field-hint">{page('time')}</small>}
        </div>
        {textField('장소', m.venue || '', 120, (v) => v !== (m.venue || '') && setMeta('장소', (mm) => ({ ...mm, venue: v }), [m.venue, v]), page('venue'))}
        {textField('강사', inst.name || '', 40, (v) => v !== (inst.name || '') && setMeta('강사', (mm) => ({ ...mm, instructors: [{ ...inst, name: v }, ...(mm.instructors || []).slice(1)].filter((x) => x.name) }), [inst.name, v]), page('instructor'))}
        {textField('강사 소속', inst.org || '', 80, (v) => v !== (inst.org || '') && setMeta('강사 소속', (mm) => ({ ...mm, instructors: [{ ...inst, org: v }, ...(mm.instructors || []).slice(1)] }), [inst.org, v]))}
      </div>
      {others.length > 0 && <details class="facts"><summary class="small"><b>AI가 교재에서 찾은 다른 내용 {others.length}개</b></summary><ul class="small">{others.map((f) => <li>{f.label}: {f.value}{f.page ? <span class="muted"> · {f.page}쪽</span> : ''}</li>)}</ul></details>}
    </div>
  );
}
