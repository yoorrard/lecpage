import { useEffect, useState } from 'preact/hooks';
import { Field } from '../../components/ui.jsx';
import { E } from '../../lib/engine.js';
import { toast } from '../../lib/util.js';

const TEMPLATES = {
  message: { title: '', style: 'statement', text: '핵심 메시지를 한 문장으로 써 주세요.' },
  schedule: { title: '일정', items: [{ start: '15:00', end: '15:20', title: '여는 이야기' }] },
  readiness: { title: '시작 전에 준비해요', items: [{ label: '개인 구글 계정으로 로그인' }], checks: [] },
  tools: { title: '함께 쓰는 도구', items: [{ name: 'Gemini', url: 'https://gemini.google.com/' }] },
  prompts: { title: '프롬프트 모음', items: [{ title: '예시', text: '이 내용을 초등 5학년이 이해하도록 쉽게 설명해줘' }] },
  qa: { title: '궁금한 점을 남겨 주세요' }, board: { title: '함께 나누는 보드', categories: [{ id: 'work', label: '결과물' }, { id: 'reflection', label: '소감' }] },
  poll: { title: '함께 답해요', items: [{ id: 'q1', question: '오늘 연수에서 가장 해 보고 싶은 것은?', kind: 'word', options: [] }] },
  quiz: { title: '복습 퀴즈', items: [{ q: '질문', options: ['보기 1', '보기 2'], answer: 0, explain: '' }] },
  faq: { title: '자주 묻는 질문', items: [{ q: '질문', a: '답' }] }, glossary: { title: '용어 풀이', items: [{ term: '용어', desc: '설명' }] },
  materials: { title: '연수 자료', items: [{ title: '자료 이름', href: 'https://' }] }, survey: { title: '만족도 조사에 참여해 주세요', url: '', qr: true },
  closing: { text: '마지막 한 문장', thanks: '함께해 주셔서 감사합니다.' }, reflection: { title: '나의 기록', prompts: ['오늘 가장 기억에 남는 것'] },
  attendance: { title: '출석 확인' }, text: { title: '', md: '자유롭게 써 주세요.' }, glance: { title: '한눈에 보기', items: [{ value: '3', label: '실습' }] },
  video: { title: '영상', items: [{ title: '영상 제목', url: 'https://' }] }, instructor: { title: '강사 소개' },
  goals: { title: '연수 목표', items: ['연수를 마치면 할 수 있는 것을 한 줄로 써 주세요'], who: '' },
  followup: { title: '연수가 끝난 뒤', items: [{ title: '다시 보기', desc: '연수 자료와 영상을 다시 볼 수 있어요.', url: '', kind: 'recording' }], completion: '' },
};

const COMMON = ['goals', 'message', 'schedule', 'prompts', 'tools', 'quiz', 'faq', 'materials', 'followup', 'text'];
export const isAdvanced = () => { try { return localStorage.getItem('lecpage:advanced') === '1'; } catch { return false; } };

/** 내용 탭: 사이트를 이루는 칸(섹션) 목록과 칸별 고치기 */
export function ContentPanel({ p, update, pushUndo, focusId }) {
  const bp = p.blueprint;
  const [open, setOpen] = useState(null);
  // 미리보기에서 고른 칸을 열고 보이게
  useEffect(() => {
    if (!focusId) return; const id = focusId.split(':')[0]; setOpen(id);
    setTimeout(() => { const el = document.querySelector(`[data-sec-id="${CSS.escape(id)}"]`); el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); el?.querySelector('.sec-open')?.focus({ preventScroll: true }); }, 60);
  }, [focusId]);
  const [addType, setAddType] = useState('');
  const sections = bp.sections || [];
  const setSections = (next) => update((cur) => ({ blueprint: { ...cur.blueprint, sections: next } }));
  const setSec = (i, patch) => setSections(sections.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= sections.length) return; const n = sections.slice(); [n[i], n[j]] = [n[j], n[i]]; setSections(n); };
  const toggle = (i) => { setSec(i, { hidden: !sections[i].hidden }); };
  const remove = (i) => { pushUndo?.('칸 빼기'); setSections(sections.filter((_, k) => k !== i)); toast('칸을 뺐어요. [되돌리기]로 되살릴 수 있어요.'); };
  const add = (t) => { if (!t) return; const id = t + '-' + Math.random().toString(36).slice(2, 6); const def = E.SECTION_DEFS[t]; const n = sections.slice(); const closeIdx = n.findIndex((s) => s.type === 'closing'); n.splice(closeIdx < 0 ? n.length : closeIdx, 0, { id, type: t, nav: def.nav, ...JSON.parse(JSON.stringify(TEMPLATES[t] || {})) }); setSections(n); setOpen(id); setAddType(''); toast(`${def.label} 칸을 추가했어요.`); };
  const meta = bp.meta || {};
  const v = E.validate(bp);
  return (
    <div class="stack">
      <p class="small muted">칸을 눌러 고치세요. 눈 아이콘으로 잠깐 숨길 수 있어요.</p>
      <ol class="sec-list">
        {sections.map((s, i) => {
          const def = E.SECTION_DEFS[s.type] || { label: s.type };
          const isOpen = open === s.id;
          return (
            <li class="sec-item" data-sec-id={s.id} data-off={s.hidden ? 'true' : undefined} data-picked={open === s.id ? 'true' : undefined}>
              <div class="sec-row">
                <div class="row" style={{ gap: '2px' }}>
                  <button class="icon-btn" aria-label={`${def.label} 위로`} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                  <button class="icon-btn" aria-label={`${def.label} 아래로`} onClick={() => move(i, 1)} disabled={i === sections.length - 1}>↓</button>
                </div>
                <button class="sec-open" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={String(isOpen)}>
                  <div class="type">{def.label}{s.nav ? ` · 메뉴 "${s.nav}"` : ''}{def.live ? ' · 참여 기능' : ''}{s.hidden ? ' · 숨김' : ''}</div>
                  <div class="ttl">{s.type === 'hero' ? (s.title || meta.title) : (s.title || s.text || def.label)}</div>
                </button>
                <button class="icon-btn" onClick={() => toggle(i)} aria-pressed={String(!s.hidden)} aria-label={s.hidden ? `${def.label} 보이기` : `${def.label} 숨기기`} title={s.hidden ? '보이기' : '숨기기'}>{s.hidden ? <EyeOff /> : <Eye />}</button>
              </div>
              {isOpen && <SectionEditor s={s} set={(patch) => setSec(i, patch)} onRemove={s.type === 'hero' ? null : () => remove(i)} />}
            </li>
          );
        })}
      </ol>
      <div class="row">
        <select class="input" style={{ width: 'auto', flex: 1 }} value={addType} onChange={(e) => add(e.target.value)} aria-label="더할 칸 고르기">
          <option value="">+ 칸 추가…</option>
          <optgroup label="자주 쓰는 칸">{COMMON.map((t) => <option value={t}>{E.SECTION_DEFS[t].label} — {E.SECTION_DEFS[t].desc}</option>)}</optgroup>
          <optgroup label="더 보기">{Object.entries(E.SECTION_DEFS).filter(([t]) => t !== 'hero' && !COMMON.includes(t)).map(([t, d]) => <option value={t}>{d.label} — {d.desc}</option>)}</optgroup>
        </select>
      </div>
      {v.warnings.length > 0 && <details><summary class="small">확인할 점 {v.warnings.length}개</summary><ul class="warnings">{v.warnings.map((w) => <li>· {w.message_ko}</li>)}</ul></details>}
    </div>
  );
}

function SectionEditor({ s, set, onRemove }) {
  const [json, setJson] = useState(null);
  const common = (
    <div class="form-grid">
      <Field label="제목"><input value={s.title || ''} onInput={(e) => set({ title: e.target.value })} /></Field>
      <Field label="메뉴 이름" hint="비우면 메뉴에 안 보여요"><input value={s.nav || ''} maxLength={12} onInput={(e) => set({ nav: e.target.value })} /></Field>
    </div>
  );
  let body = null;
  if (s.type === 'hero') body = <><Field label="큰 제목"><textarea rows={2} value={s.title || ''} onInput={(e) => set({ title: e.target.value })} /></Field><Field label="부제"><input value={s.subtitle || ''} onInput={(e) => set({ subtitle: e.target.value })} /></Field></>;
  else if (s.type === 'message' || s.type === 'closing') body = <Field label="문장"><textarea rows={3} value={s.text || ''} onInput={(e) => set({ text: e.target.value })} /></Field>;
  else if (s.type === 'survey') body = <SurveyEditor s={s} set={set} />;
  else if (s.type === 'stations') body = <Stations s={s} set={set} />;
  else if (s.lead !== undefined || ['qa', 'board', 'tools', 'materials', 'deck', 'outline', 'readiness'].includes(s.type)) body = <Field label="안내 문장"><textarea rows={2} value={s.lead || ''} onInput={(e) => set({ lead: e.target.value })} /></Field>;
  return (
    <div class="sec-body">
      {s.type !== 'hero' && s.type !== 'closing' && common}
      {body}
      {isAdvanced() && <details onToggle={(e) => { if (e.target.open) setJson(JSON.stringify(s, null, 2)); }}>
        <summary class="small">고급: 코드로 고치기(JSON)</summary>
        {json !== null && <div class="stack" style={{ marginTop: '8px' }}>
          <textarea class="input code" rows={12} value={json} onInput={(e) => setJson(e.target.value)} aria-label="칸 내용 JSON" />
          <div><button class="btn btn-sm" onClick={() => { try { const o = JSON.parse(json); set({ ...o, id: s.id, type: s.type }); toast('반영했어요.'); } catch { toast('JSON 형식이 맞지 않아요.'); } }}>반영</button></div>
        </div>}
      </details>}
      {onRemove && <div><button class="btn btn-sm btn-danger" onClick={onRemove}>이 칸 빼기</button></div>}
    </div>
  );
}

function Stations({ s, set }) {
  const items = s.items || [];
  const setItem = (i, patch) => set({ items: items.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
  return (
    <div class="mini-list">
      {items.map((it, i) => (
        <details class="mini-item">
          <summary><b>{String(i + 1).padStart(2, '0')} {it.name || it.title}</b> <span class="small muted">단계 {it.steps?.length || 0} · 프롬프트 {it.prompts?.length || 0}</span></summary>
          <div class="stack" style={{ marginTop: '8px' }}>
            <div class="form-grid">
              <Field label="목차 이름"><input value={it.name || ''} maxLength={30} onInput={(e) => setItem(i, { name: e.target.value })} /></Field>
              <Field label="제목"><input value={it.title || ''} onInput={(e) => setItem(i, { title: e.target.value })} /></Field>
            </div>
            <Field label="단계(한 줄에 하나)"><textarea rows={4} value={(it.steps || []).join('\n')} onInput={(e) => setItem(i, { steps: e.target.value.split('\n').filter((x) => x.trim()) })} /></Field>
            {(it.prompts || []).map((pr, k) => (
              <Field label={`프롬프트 ${k + 1}: ${pr.title || ''}`}><textarea class="code" rows={3} value={pr.text} onInput={(e) => setItem(i, { prompts: it.prompts.map((x, j) => (j === k ? { ...x, text: e.target.value } : x)) })} /></Field>
            ))}
            <Field label="확인 문장(여기까지 해 봤나요?)"><input value={it.outcome || ''} onInput={(e) => setItem(i, { outcome: e.target.value })} /></Field>
          </div>
        </details>
      ))}
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
