import { useEffect, useRef, useState } from 'preact/hooks';
import { Field } from '../../components/ui.jsx';
import { ItemEditor, hasItemEditor, useUndoBurst } from '../../components/ItemEditor.jsx';
import { E } from '../../lib/engine.js';
import { toast, fmtBytes } from '../../lib/util.js';
import { blobs } from '../../lib/db.js';
import { USER_ASSET } from '@engine/src/build.js';

// + 섹션 추가: 비어 있지만 바로 고칠 수 있는 시작 내용. 제목은 엔진 기본값(intake.js·렌더러)과 같게.
// 빈 항목은 채우기 전까지 사이트에 나오지 않아요(엔진이 뺌). 지어낸 자리 글('질문'·'보기 1'·'https://')은 넣지 않음.
const TEMPLATES = {
  message: () => ({ title: '', style: 'statement', text: '' }),
  goals: () => ({ title: '연수 목표', items: [''], who: '' }),
  glance: () => ({ title: '한눈에 보기', items: [{ value: '', label: '', note: '' }] }),
  steps5: () => ({ title: '', items: [{ word: '', desc: '' }] }),
  outline: () => ({ title: '오늘의 차례', items: [{ part: '', title: '', desc: '', tags: [] }] }),
  schedule: () => ({ title: '일정', items: [{ start: '', end: '', title: '', desc: '' }] }),
  readiness: () => ({ title: '시작 전에 준비해요', items: [{ label: '', detail: '', url: '' }], checks: [] }),
  deck: () => ({ title: '연수 교재', slides: [] }),
  stations: () => ({ title: '실습', items: [{ id: 'st-' + Math.random().toString(36).slice(2, 6), name: '', title: '', steps: [], prompts: [], outcome: '' }] }),
  tools: () => ({ title: '도구 모음', items: [{ name: '', url: '', desc: '' }] }),
  prompts: () => ({ title: '프롬프트 모음', items: [{ title: '', text: '', tags: [] }] }),
  qa: () => ({ title: '질문' }),
  board: () => ({ title: '나눔 보드', categories: [{ id: 'work', label: '결과물' }, { id: 'reflection', label: '소감' }] }),
  poll: () => ({ title: '투표', items: [{ id: 'word', question: '오늘 연수를 한 낱말로 말하면?', kind: 'word', options: [] }] }),
  quiz: () => ({ title: '복습 퀴즈', items: [{ q: '', options: ['', ''], answer: 0, explain: '' }] }),
  materials: () => ({ title: '연수 자료', items: [{ title: '', href: '', desc: '' }] }),
  instructor: () => ({ title: '강사 소개' }),
  speakers: () => ({ title: '연사', items: [{ name: '', org: '', role: '', talk: '' }] }),
  sessions: () => ({ title: '차시', items: [{ date: '', title: '', desc: '', links: [] }] }),
  survey: () => ({ title: '만족도 조사', url: '', qr: true }),
  followup: () => ({ title: '연수 후 안내', items: [{ title: '', url: '', desc: '' }], completion: '' }),
  closing: () => ({ text: '', thanks: '함께해 주셔서 감사합니다.' }),
  faq: () => ({ title: '자주 묻는 질문', items: [{ q: '', a: '' }] }),
  glossary: () => ({ title: '용어 풀이', items: [{ term: '', desc: '' }] }),
  video: () => ({ title: '영상', items: [{ title: '', url: '' }] }),
  gallery: () => ({ title: '사진', items: [{ src: '', caption: '' }] }),
  reflection: () => ({ title: '나의 기록', prompts: ['오늘 가장 기억에 남는 것', '다음 주 수업에서 해 볼 한 가지'] }),
  attendance: () => ({ title: '출석 확인' }),
  text: () => ({ title: '', md: '' }),
};

const COMMON = ['goals', 'message', 'schedule', 'prompts', 'tools', 'quiz', 'faq', 'materials', 'followup', 'text'];
export const isAdvanced = () => { try { return localStorage.getItem('lecpage:advanced') === '1'; } catch { return false; } };

/** 내용 탭: 사이트를 이루는 섹션 목록과 섹션별 고치기 */
export function ContentPanel({ p, update, pushUndo, focusId }) {
  const bp = p.blueprint;
  const [open, setOpen] = useState(null);
  // 미리보기에서 고른 섹션을 열고 보이게
  useEffect(() => {
    if (!focusId) return; const id = focusId.split(':')[0]; setOpen(id);
    setTimeout(() => { const el = document.querySelector(`[data-sec-id="${CSS.escape(id)}"]`); el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); el?.querySelector('.sec-open')?.focus({ preventScroll: true }); }, 60);
  }, [focusId]);
  const [addType, setAddType] = useState('');
  const sections = bp.sections || [];
  const setSections = (next) => update((cur) => ({ blueprint: { ...cur.blueprint, sections: next } }));
  // 지금 값(cur)에 합침: 한 번에 두 번 고쳐도 앞의 것이 지워지지 않게
  const setSec = (i, patch) => update((cur) => ({ blueprint: { ...cur.blueprint, sections: (cur.blueprint.sections || []).map((s, k) => (k === i ? { ...s, ...patch } : s)) } }));
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= sections.length) return; const n = sections.slice(); [n[i], n[j]] = [n[j], n[i]]; setSections(n); };
  const toggle = (i) => { setSec(i, { hidden: !sections[i].hidden }); };
  const remove = (i) => { pushUndo?.('섹션 빼기'); setSections(sections.filter((_, k) => k !== i)); toast('섹션을 뺐어요. [되돌리기]로 되살릴 수 있어요.'); };
  const add = (t) => { if (!t) return; const id = t + '-' + Math.random().toString(36).slice(2, 6); const def = E.SECTION_DEFS[t]; const n = sections.slice(); const closeIdx = n.findIndex((s) => s.type === 'closing'); pushUndo?.('섹션 추가'); n.splice(closeIdx < 0 ? n.length : closeIdx, 0, { id, type: t, nav: def.nav, ...(TEMPLATES[t]?.() || {}) }); setSections(n); setOpen(id); setAddType(''); toast(`${def.label} 섹션을 추가했어요.`); };
  const meta = bp.meta || {};
  const v = E.validate(bp);
  // 첫 화면 버튼이 갈 곳(섹션 이름으로 고르기)
  const anchors = sections.filter((x) => x.type !== 'hero' && !x.hidden && x.id).map((x) => ({ value: '#' + x.id, label: x.title || E.SECTION_DEFS[x.type]?.label || x.type }));
  return (
    <div class="stack">
      <p class="small muted">섹션을 눌러 고치세요. 눈 아이콘으로 잠깐 숨길 수 있어요.</p>
      <ol class="sec-list">
        {sections.map((s, i) => {
          const def = E.SECTION_DEFS[s.type] || { label: s.type };
          const isOpen = open === s.id;
          return (
            <li key={s.id || i} class="sec-item" data-sec-id={s.id} data-off={s.hidden ? 'true' : undefined} data-picked={open === s.id ? 'true' : undefined}>
              <div class="sec-row">
                <div class="row" style={{ gap: '2px' }}>
                  <button class="icon-btn" aria-label={`${def.label} 위로`} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                  <button class="icon-btn" aria-label={`${def.label} 아래로`} onClick={() => move(i, 1)} disabled={i === sections.length - 1}>↓</button>
                </div>
                <button class="sec-open" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={String(isOpen)}>
                  <div class="type">{def.label}{s.nav ? ` · 메뉴 "${s.nav}"` : ''}{def.live ? ' · 참여 기능' : ''}{s.hidden ? ' · 숨김' : ''}</div>
                  <div class="ttl">{s.type === 'hero' ? (s.title || meta.title) : (s.title || s.text || def.label)}</div>
                </button>
                <button class="icon-btn" onClick={() => toggle(i)} aria-pressed={String(!s.hidden)} aria-label={s.hidden ? `${def.label} 섹션 보이기` : `${def.label} 섹션 숨기기`} title={s.hidden ? '섹션 보이기' : '섹션 숨기기'}>{s.hidden ? <EyeOff /> : <Eye />}</button>
              </div>
              {isOpen && <SectionEditor pid={p.id} s={s} set={(patch) => setSec(i, patch)} pushUndo={pushUndo} anchors={s.type === 'hero' ? anchors : undefined} onRemove={s.type === 'hero' ? null : () => remove(i)} />}
            </li>
          );
        })}
      </ol>
      <div class="row">
        <select class="input" style={{ width: '100%' }} value={addType} onChange={(e) => add(e.target.value)} aria-label="더할 섹션 고르기">
          <option value="">+ 섹션 추가…</option>
          <optgroup label="자주 쓰는 섹션">{COMMON.map((t) => <option value={t}>{E.SECTION_DEFS[t].label} — {E.SECTION_DEFS[t].desc}</option>)}</optgroup>
          <optgroup label="더 보기">{Object.entries(E.SECTION_DEFS).filter(([t]) => t !== 'hero' && !COMMON.includes(t)).map(([t, d]) => <option value={t}>{d.label} — {d.desc}</option>)}</optgroup>
        </select>
      </div>
      {v.warnings.length > 0 && <details><summary class="small">확인할 점 {v.warnings.length}개</summary><ul class="warnings">{v.warnings.map((w) => <li>· {w.message_ko}</li>)}</ul></details>}
    </div>
  );
}

const isTyping = (el) => /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName) && !/^(checkbox|radio)$/.test(el.type);

const safeName = (n) => n.replace(/[^\w가-힣.\-]+/g, '_').replace(/^\.+/, '').slice(-100) || 'file';

/** 자료실: 내 컴퓨터의 파일을 올림. 파일은 이 브라우저에 두었다가 공개할 때 사이트와 함께 올라가고, 참가자가 내려받음 */
function MaterialUpload({ pid, s, put }) {
  const inp = useRef(); const [busy, setBusy] = useState(false);
  async function add(files) {
    setBusy(true);
    const items = (s.items || []).filter((x) => x && (x.title || x.href || x.url || x.desc)); let n = 0;
    try {
      for (const f of files) {
        if (f.size > 100e6) { toast(`${f.name}: 100MB가 넘어 올릴 수 없어요. 영상은 유튜브 링크로 넣어 주세요.`); continue; }
        if (items.length >= 30) { toast('자료는 30개까지 넣을 수 있어요.'); break; }
        let name = safeName(f.name);
        if (!USER_ASSET.test('assets/files/' + name)) { toast(`${f.name}: 이 형식은 올릴 수 없어요. 문서·그림·소리·영상·ZIP 파일을 넣어 주세요.`); continue; } const used = new Set(items.map((x) => String(x.href || '')));
        for (let k = 2; used.has('assets/files/' + name); k++) name = safeName(f.name).replace(/(\.[^.]+)?$/, `-${k}$1`);
        await blobs.put(pid, 'assets/files/' + name, new Uint8Array(await f.arrayBuffer()));
        items.push({ title: f.name.replace(/\.[^.]+$/, '').slice(0, 100), href: 'assets/files/' + name, desc: '', kind: (f.name.split('.').pop() || 'FILE').toUpperCase().slice(0, 12), size: fmtBytes(f.size) });
        n++;
      }
      if (n) { put({ items }); toast(`자료 ${n}개를 넣었어요. 공개하면 참가자가 내려받을 수 있어요.`); }
    } catch (e) { toast('파일을 넣지 못했어요. 저장 공간을 확인해 주세요.'); }
    setBusy(false);
  }
  return (
    <div class="mat-up">
      <button type="button" class="btn btn-sm" disabled={busy} onClick={() => inp.current?.click()}>{busy ? '넣는 중…' : '＋ 파일 올리기'}</button>
      <span class="small muted">PDF·한글·PPT·ZIP 등. 공개한 뒤에 더 넣어도 돼요. 넣고 [바뀐 내용 다시 올리기]를 누르면 같은 주소에 반영돼요.</span>
      <input ref={inp} type="file" multiple hidden onChange={(e) => { add([...e.target.files]); e.target.value = ''; }} />
    </div>
  );
}

function SectionEditor({ pid, s, set, onRemove, pushUndo, anchors }) {
  const def = E.SECTION_DEFS[s.type] || { label: s.type };
  // 되돌리기: 입력 칸에 들어와 처음 고칠 때 한 번만 저장(글자마다 쌓이지 않게)
  const u = useUndoBurst(pushUndo, def.label);
  const put = (patch) => { u.touch(); set(patch); };
  const [json, setJson] = useState(null);
  const common = (
    <div class="form-grid">
      <Field label="제목"><input value={s.title || ''} maxLength={160} onInput={(e) => put({ title: e.target.value })} /></Field>
      <Field label="메뉴 이름" hint="비우면 메뉴에 안 보여요"><input value={s.nav || ''} maxLength={12} onInput={(e) => put({ nav: e.target.value })} /></Field>
    </div>
  );
  let body = null;
  if (s.type === 'hero') body = <><Field label="큰 제목"><textarea rows={2} value={s.title || ''} maxLength={160} onInput={(e) => put({ title: e.target.value })} /></Field><Field label="부제"><input value={s.subtitle || ''} maxLength={400} onInput={(e) => put({ subtitle: e.target.value })} /></Field><ItemEditor s={s} set={put} u={u} anchors={anchors} /></>;
  else if (s.type === 'survey') body = <SurveyEditor s={s} set={put} />;
  else if (hasItemEditor(s.type)) body = <>{s.type === 'materials' && <MaterialUpload pid={pid} s={s} put={(patch) => { u.now?.(); put(patch); }} />}<ItemEditor s={s} set={put} u={u} anchors={anchors} /></>;
  else body = <Field label="안내 문장"><textarea rows={2} value={s.lead || ''} maxLength={300} onInput={(e) => put({ lead: e.target.value })} /></Field>;
  return (
    <div class="sec-body" onFocusCapture={(e) => { if (isTyping(e.target)) u.arm(); }}>
      {s.type !== 'hero' && s.type !== 'closing' && common}
      {body}
      {isAdvanced() && <details onToggle={(e) => { if (e.target.open) setJson(JSON.stringify(s, null, 2)); }}>
        <summary class="small">고급: 코드로 고치기(JSON)</summary>
        {json !== null && <div class="stack" style={{ marginTop: '8px' }}>
          <textarea class="input code" rows={12} value={json} onInput={(e) => setJson(e.target.value)} aria-label="섹션 내용 JSON" />
          <div><button class="btn btn-sm" onClick={() => { try { const o = JSON.parse(json); u.now('JSON 반영'); set({ ...o, id: s.id, type: s.type }); toast('반영했어요.'); } catch { toast('JSON 형식이 맞지 않아요.'); } }}>반영</button></div>
        </div>}
      </details>}
      {onRemove && <div><button class="btn btn-sm btn-danger" onClick={onRemove}>이 섹션 빼기</button></div>}
    </div>
  );
}

const SV_KINDS = [{ value: 'scale', label: '1~5점' }, { value: 'choice', label: '하나 고르기' }, { value: 'text', label: '글로 쓰기' }];
function SurveyEditor({ s, set }) {
  const qs = s.questions || [];
  const put = (i, patch) => set({ questions: qs.map((q, k) => (k === i ? { ...q, ...patch } : q)) });
  return (
    <div class="stack" style={{ gap: '10px' }}>
      <p class="small muted">참여 기능이 켜져 있으면 사이트 안에 이 문항이 떠요. 답은 강사 화면에서 CSV로 받아요.</p>
      {qs.map((q, i) => (
        <div class="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label={`문항 ${i + 1}`}><input value={q.q} maxLength={200} onInput={(e) => put(i, { q: e.target.value })} style={{ minWidth: '16rem' }} /></Field>
          <Field label="답하는 방식"><select value={q.kind} onChange={(e) => put(i, { kind: e.target.value })}>{SV_KINDS.map((k) => <option value={k.value}>{k.label}</option>)}</select></Field>
          {q.kind === 'choice' && <Field label="고를 것(쉼표로 구분)"><input value={(q.options || []).join(', ')} onInput={(e) => put(i, { options: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></Field>}
          <button class="btn btn-sm btn-quiet" onClick={() => set({ questions: qs.filter((_, k) => k !== i) })} aria-label={`문항 ${i + 1} 빼기`}>빼기</button>
        </div>
      ))}
      <div class="btn-row">
        <button class="btn btn-sm" onClick={() => set({ questions: [...qs, { q: '', kind: 'scale' }] })}>문항 추가</button>
        {!qs.length && <button class="btn btn-sm" onClick={() => set({ questions: E.DEFAULT_SURVEY.map((q) => ({ ...q })) })}>기본 5문항 넣기</button>}
      </div>
      <Field label="기관 설문 주소(선택)" hint="구글 설문 등. 넣으면 버튼과 QR이 보여요."><input type="url" value={s.url || ''} onInput={(e) => set({ url: e.target.value })} placeholder="https://" /></Field>
    </div>
  );
}

const Eye = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>;
const EyeOff = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18" /><path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.9 8.3 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>;
