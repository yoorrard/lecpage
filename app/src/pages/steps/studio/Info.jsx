import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { replaceText, replaceSchedule } from '../../../lib/site-doc.js';
import { toast, isPastDate, monthDay } from '../../../lib/util.js';
import { focusIn } from './Outline.jsx';
import { FoldHead } from './Parts.jsx';

// 연수 정보(p.meta): 늘 보이는 속성 줄(이름 | 값). 값을 누르면 그 자리에서 고침(Notion·Linear의 속성 칸처럼).
// 글자 칸은 칸을 떠나거나 Enter로 한 번 반영, Esc는 취소. 일시는 누르면 날짜·시작·끝 칸이 열림(다 쓴 값만 반영: WhenInput).
// 고치면 사이트 글에 같은 글자로 적힌 곳(날짜·시간은 같은 꼴로, lib/date-text.js)과 QR 안내문·강사 화면·발표 화면·일정 파일이 함께 바뀜.
// 고칠 때마다 버전 기록에 남음(change의 kind 'info', 잇따른 수정은 하나로). 일정·강사가 여럿이면 줄도 여럿.

const FACT_OF = { title: ['연수명', '제목', '연수 제목'], date: ['날짜', '일시', '연수 날짜'], time: ['시간', '시각', '일시'], venue: ['장소'], instructor: ['강사', '강사명'], subtitle: ['부제', '부제목'], organizer: ['주최', '주관', '주최·주관'], contact: ['문의', '연락처', '문의처'] };
const OPTIONAL = [['subtitle', '부제', 400, true], ['organizer', '주최', 120, true], ['contact', '문의', 120, true]];
const DAY = '일월화수목금토';
const dayOf = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? DAY[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()] : ''; };
/** 일시 한 줄: '12월 24일(목) 14:00~17:00' */
export const whenLine = (s = {}) => [s.date ? `${monthDay(s.date)}(${dayOf(s.date)})` : '', s.start ? `${s.start}${s.end ? `~${s.end}` : ''}` : ''].filter(Boolean).join(' ');
const NOTE = 'st-info-note';

export function InfoCard({ p, change, update, onConfirmed, open = true, onToggle }) {
  const m = p.meta || {};
  const checked = !!p.metaChecked;
  const [more, setMore] = useState(false);
  const facts = m.facts || [];
  const found = (k) => { const f = facts.find((x) => FACT_OF[k].includes(String(x.label || '').trim())); return f?.page ? `교재 ${f.page}쪽에서 찾았어요` : f ? 'AI가 교재에서 찾았어요' : ''; };
  // 글자 칸: 연수 정보와 사이트의 모든 쪽에 같은 글자로 적힌 옛 값
  const setMeta = (label, fn, fromTo) => change(label, (cur) => {
    const meta = fn(cur.meta || {}); let site = cur.site;
    if (fromTo) for (const k of Object.keys(site || {})) if (/\.html?$/i.test(k) && typeof site[k] === 'string') { const h = replaceText(site[k], fromTo[0], fromTo[1]); if (h !== site[k]) site = { ...site, [k]: h }; }
    return { meta, ...(site !== cur.site ? { site } : {}) };
  }, 'info');
  // 일시(i번째 일정): 연수 정보와 사이트에 적힌 같은 날짜·시간(같은 꼴로)
  const setWhen = (i, k, v) => change(k === 'date' ? '날짜' : '시간', (cur) => {
    const mm = cur.meta || {}; const ses = [...(mm.sessions || [])];
    const before = { date: '', start: '', end: '', ...(ses[i] || {}) }; const after = { ...before, [k]: v };
    ses[i] = after;
    const site = replaceSchedule(cur.site, before, after);
    return { meta: { ...mm, sessions: ses }, ...(site !== cur.site ? { site } : {}) };
  }, 'info');
  const sessions = (m.sessions || []).length ? m.sessions.slice(0, 10) : [{ date: '', start: '', end: '' }];
  const insts = (m.instructors || []).length ? m.instructors.slice(0, 6) : [{ name: '', org: '' }];
  const setInst = (i, key, v) => { const old = insts[i]?.[key] || ''; if (v === old) return; setMeta(key === 'name' ? '강사' : '강사 소속', (mm) => { const list = [...(mm.instructors || [])]; list[i] = { ...(list[i] || {}), [key]: v }; return { ...mm, instructors: key === 'name' ? list.filter((x) => x?.name) : list.filter(Boolean) }; }, [old, v]); };
  const optional = OPTIONAL.filter(([k]) => more || m[k]);
  const hiddenOpt = OPTIONAL.filter(([k]) => !m[k]);
  const firstHidden = useRef('');
  useEffect(() => { if (more && firstHidden.current) focusIn(document.getElementById(`prop-${firstHidden.current}`)); }, [more]);
  // 접혔을 때 한 줄: 일시 · 장소 · 강사(지난 날짜면 그 알림을 먼저)
  const first = sessions.find((x) => x?.date) || sessions[0] || {};
  const past = isPastDate(first.date);
  const sum = past ? `${monthDay(first.date)}은 지난 날짜예요. 이번 연수 날짜로 고쳐 주세요.` : [whenLine(first), m.venue, insts[0]?.name].filter(Boolean).join(' · ') || '날짜·장소를 넣어 주세요';
  const others = facts.filter((f) => !Object.values(FACT_OF).flat().includes(String(f.label || '').trim()));
  return (
    <section class={`st-card st-info${checked ? '' : ' is-todo'}`} aria-labelledby="st-info-h">
      <FoldHead id="st-info" title="연수 정보" open={open} onToggle={onToggle} summary={sum} warn={past}>
        {!checked && <div class="confirm-bar"><button type="button" class="btn btn-sm btn-primary" data-coach={p.demo ? '' : undefined} data-coach-room={p.demo ? '' : undefined} onClick={() => { update({ metaChecked: true }); toast('확인했어요. 미리보기를 살펴본 뒤 [배포하기]를 눌러요.'); onConfirmed?.(); }}>이 정보가 맞아요</button></div>}
      </FoldHead>
      <div class="st-fold-b" id="st-info-b" hidden={!open}>
      <dl class="props">
        <TextProp k="title" label="연수명" value={m.title || ''} max={160} multiline placeholder="연수명을 넣어 주세요" hint={found('title')}
          onCommit={(v) => v && v !== m.title && setMeta('연수명', (mm) => ({ ...mm, title: v }), [m.title, v])} />
        {sessions.map((s, i) => <WhenProp key={`w${i}`} i={i} label={sessions.length > 1 ? `일시 ${i + 1}` : '일시'} s={s} hint={found('date') || found('time')} onCommit={(k, v) => setWhen(i, k, v)} />)}
        <TextProp k="venue" label="장소" value={m.venue || ''} max={120} placeholder="장소를 넣어 주세요" hint={found('venue')}
          onCommit={(v) => v !== (m.venue || '') && setMeta('장소', (mm) => ({ ...mm, venue: v }), [m.venue, v])} />
        {insts.map((x, i) => <div class="prop" data-k={`inst-${i}`} key={`i${i}`}>
          <dt><label for={`prop-inst-${i}`} title={(i === 0 && found('instructor')) || undefined}>{insts.length > 1 ? `강사 ${i + 1}` : '강사'}</label></dt>
          <dd><span class="prop-pair">
            <Ghost id={`prop-inst-${i}`} value={x.name || ''} max={40} placeholder="이름" onCommit={(v) => setInst(i, 'name', v)} />
            <Ghost value={x.org || ''} max={80} placeholder="소속" label={`${insts.length > 1 ? `강사 ${i + 1}` : '강사'} 소속`} sub onCommit={(v) => setInst(i, 'org', v)} />
          </span>{i === 0 && found('instructor') && <small class="prop-hint">{found('instructor')}</small>}</dd>
        </div>)}
        {optional.map(([k, label, max, multi]) => <TextProp key={k} k={k} label={label} value={m[k] || ''} max={max} multiline={multi} placeholder="비어 있음" hint={found(k)}
          onCommit={(v) => v !== (m[k] || '') && setMeta(label, (mm) => ({ ...mm, [k]: v }), [m[k], v])} />)}
      </dl>
      {!more && hiddenOpt.length > 0 && <button type="button" class="btn-link small prop-more" onClick={() => { firstHidden.current = hiddenOpt[0][0]; setMore(true); }}>＋ {hiddenOpt.map((x) => x[1]).join('·')} 추가</button>}
      <p class="sr" id={NOTE}>고치면 사이트에 같은 글자로 적힌 곳과 QR 안내문·강사 화면·발표 화면·일정 파일이 함께 바뀌어요.</p>
      {others.length > 0 && <details class="facts"><summary class="small"><b>AI가 교재에서 찾은 다른 내용 {others.length}개</b></summary><ul class="small">{others.map((f) => <li>{f.label}: {f.value}{f.page ? <span class="muted"> · {f.page}쪽</span> : ''}</li>)}</ul></details>}
      {!checked && <div class="st-info-ask">
        <p class="small">AI가 교재에서 찾은 값이에요. 틀린 곳은 눌러서 바로 고쳐요. 고치면 사이트 글과 QR 안내문·강사 화면·일정 파일도 함께 바뀌어요.</p>
      </div>}
      </div>
    </section>
  );
}

/** 글자 칸 한 줄(이름 | 값) */
function TextProp({ k, label, value, max, multiline, placeholder, hint, onCommit }) {
  return (
    <div class="prop" data-k={k}>
      <dt><label for={`prop-${k}`} title={hint || undefined}>{label}</label></dt>
      <dd><Ghost id={`prop-${k}`} value={value} max={max} multiline={multiline} placeholder={placeholder} onCommit={onCommit} />{hint && <small class="prop-hint">{hint}</small>}</dd>
    </div>
  );
}

/** 글처럼 보이는 입력 칸: 눌러서 바로 고침. 떠나거나 Enter면 반영, Esc는 처음 값으로 */
function Ghost({ id, value, max, multiline, placeholder, label, sub, onCommit }) {
  const ref = useRef(); const skip = useRef(false); const now = useRef(value); now.current = value;
  const fit = () => { const el = ref.current; if (multiline && el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } };
  useLayoutEffect(() => { const el = ref.current; if (el && document.activeElement !== el) { el.value = value; fit(); } }, [value]);
  const Tag = multiline ? 'textarea' : 'input';
  return <Tag ref={ref} id={id} class={`prop-in${sub ? ' is-sub' : ''}`} rows={multiline ? 1 : undefined} defaultValue={value} maxLength={max} placeholder={placeholder}
    aria-label={label} aria-describedby={NOTE} spellcheck={false}
    onInput={fit}
    onBlur={(e) => {
      const el = e.currentTarget;
      if (skip.current) { skip.current = false; return; }
      const v = el.value.replace(/\s+/g, ' ').trim(); if (v !== value) onCommit(v);
      // 받아들이지 않은 값(빈 연수명 등)은 지금 값으로 되돌림
      setTimeout(() => { if (document.activeElement !== el) { el.value = now.current; fit(); } }, 0);
    }}
    onKeyDown={(e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); }
      else if (e.key === 'Escape') { e.stopPropagation(); e.currentTarget.value = value; fit(); skip.current = true; e.currentTarget.blur(); }
    }} />;
}

/** 일시 한 줄: 누르면 날짜·시작·끝 칸. [완료]·Esc·Enter·바깥 누르기로 닫음 */
function WhenProp({ i, label, s, hint, onCommit }) {
  const [open, setOpen] = useState(false);
  const box = useRef(); const btn = useRef();
  const line = whenLine(s);
  const past = isPastDate(s.date);
  const close = (focus = true) => { const a = document.activeElement; if (box.current?.contains(a)) a.blur(); setOpen(false); if (focus) setTimeout(() => btn.current?.focus({ preventScroll: true }), 0); };
  useEffect(() => {
    if (!open) return undefined;
    setTimeout(() => box.current?.querySelector('input')?.focus({ preventScroll: true }), 0);
    const off = (e) => { if (box.current && !box.current.contains(e.target)) close(false); };
    document.addEventListener('pointerdown', off, true); return () => document.removeEventListener('pointerdown', off, true);
  }, [open]);
  return (
    <div class="prop" data-k={`when-${i}`}>
      <dt><span id={`prop-when-${i}`} title={hint || undefined}>{label}</span></dt>
      <dd>
        {open ? <div class="prop-when" ref={box} role="group" aria-labelledby={`prop-when-${i}`}
          onFocusOut={(e) => { if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) close(false); }}
          onKeyDown={(e) => { if (e.key === 'Escape' || (e.key === 'Enter' && e.target.tagName === 'INPUT')) { e.preventDefault(); e.stopPropagation(); close(); } }}>
          <WhenInput type="date" value={s.date} label="날짜" onCommit={(v) => onCommit('date', v)} />
          <span class="prop-time"><WhenInput type="time" value={s.start} label="시작" onCommit={(v) => onCommit('start', v)} /><span aria-hidden="true">~</span><WhenInput type="time" value={s.end} label="끝" onCommit={(v) => onCommit('end', v)} /></span>
          <button type="button" class="btn btn-sm btn-quiet" onClick={() => close()}>완료</button>
        </div>
          : <button type="button" ref={btn} class="prop-v" aria-labelledby={`prop-when-${i} prop-when-v${i}`} aria-describedby={NOTE} onClick={() => setOpen(true)}>
            <span id={`prop-when-v${i}`} class={line ? '' : 'prop-empty'}>{line || '날짜를 넣어 주세요'}</span>
          </button>}
        {past ? <small class="warn-line prop-warn" role="status">{monthDay(s.date)}은 지난 날짜예요. 이번 연수 날짜로 고쳐 주세요.</small> : hint && <small class="prop-hint">{hint}</small>}
      </dd>
    </div>
  );
}

/** 날짜·시각 칸: 다 쓴 값만(입력을 멈추고 0.7초 뒤나 칸을 떠날 때) 한 번 반영 — 쓰는 도중의 값(0002년 등)이 사이트 글을 바꾸지 않게. 닫힐 때 남은 값도 반영 */
function WhenInput({ type, value, onCommit, label }) {
  const [v, setV] = useState(value || '');
  const ref = useRef(); const t = useRef(); const wait = useRef(null);
  const last = useRef(value || ''); last.current = value || '';
  const commitRef = useRef();
  useEffect(() => { if (document.activeElement !== ref.current) setV(value || ''); }, [value]);
  const ok = (x) => (type === 'date' ? /^(\d{4})-\d{2}-\d{2}$/.test(x) && +x.slice(0, 4) >= 2000 : /^\d{2}:\d{2}$/.test(x));
  const commit = (x = v) => { clearTimeout(t.current); wait.current = null; if (x !== last.current && (ok(x) || (!x && type !== 'date'))) onCommit(x); };
  commitRef.current = commit;
  useEffect(() => () => { clearTimeout(t.current); if (wait.current !== null) commitRef.current(wait.current); }, []);
  return <input ref={ref} type={type} class="input" value={v} aria-label={label}
    onInput={(e) => { const x = e.target.value; setV(x); wait.current = x; clearTimeout(t.current); t.current = setTimeout(() => commit(x), 700); }}
    onBlur={() => commit(ref.current ? ref.current.value : v)} />;
}
