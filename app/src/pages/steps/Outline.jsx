import { useState } from 'preact/hooks';
import { StepHead, StepFoot } from '../Project.jsx';
import { Sheet, Field, Notice } from '../../components/ui.jsx';
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
};

export function StepOutline({ p, update, go }) {
  const bp = p.blueprint;
  const [open, setOpen] = useState(null);
  const [addType, setAddType] = useState('message');
  if (!bp) return <><StepHead title="내용 다듬기" /><Notice>먼저 3단계에서 설계도를 만들어 주세요.</Notice><StepFoot go={go} prev={3} /></>;
  const v = E.validate(bp);
  const sections = bp.sections || [];
  const setSections = (next) => update({ blueprint: { ...bp, sections: next } });
  const setSec = (i, patch) => setSections(sections.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= sections.length) return; const n = sections.slice(); [n[i], n[j]] = [n[j], n[i]]; setSections(n); };
  const remove = (i) => { setSections(sections.filter((_, k) => k !== i)); toast('섹션을 뺐어요.'); };
  const add = () => { const id = addType + '-' + Math.random().toString(36).slice(2, 6); const def = E.SECTION_DEFS[addType]; const n = sections.slice(); const closeIdx = n.findIndex((s) => s.type === 'closing'); n.splice(closeIdx < 0 ? n.length : closeIdx, 0, { id, type: addType, nav: def.nav, ...JSON.parse(JSON.stringify(TEMPLATES[addType] || {})) }); setSections(n); setOpen(id); };
  const meta = bp.meta || {};
  return (
    <>
      <StepHead title="내용을 다듬어요" desc="섹션 순서를 바꾸고, 문구를 고치고, 필요 없는 섹션은 빼세요. 실습 프롬프트는 교재 원문을 그대로 두는 것이 좋아요." />
      <Sheet>
        <div class="stack">
          <div class="form-grid">
            <Field label="연수명"><input value={meta.title || ''} onInput={(e) => update({ blueprint: { ...bp, meta: { ...meta, title: e.target.value } } })} /></Field>
            <Field label="핵심 메시지"><input value={meta.subtitle || ''} onInput={(e) => update({ blueprint: { ...bp, meta: { ...meta, subtitle: e.target.value } } })} /></Field>
          </div>
          <ol class="sec-list">
            {sections.map((s, i) => {
              const def = E.SECTION_DEFS[s.type] || { label: s.type };
              const isOpen = open === s.id;
              return (
                <li class="sec-item">
                  <div class="sec-row">
                    <div class="row" style={{ gap: '4px' }}>
                      <button class="icon-btn" aria-label="위로" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                      <button class="icon-btn" aria-label="아래로" onClick={() => move(i, 1)} disabled={i === sections.length - 1}>↓</button>
                    </div>
                    <button class="btn-quiet" style={{ textAlign: 'left', border: 0, background: 'none', cursor: 'pointer', minWidth: 0 }} onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={String(isOpen)}>
                      <div class="type">{def.label}{s.nav ? ` · 메뉴 "${s.nav}"` : ''}{def.live ? ' · 실시간' : ''}</div>
                      <div class="ttl">{s.title || s.text || (s.type === 'hero' ? meta.title : def.label)}</div>
                    </button>
                    <button class="btn btn-sm btn-quiet" onClick={() => remove(i)} aria-label={`${def.label} 빼기`}>빼기</button>
                  </div>
                  {isOpen && <SectionEditor s={s} set={(patch) => setSec(i, patch)} />}
                </li>
              );
            })}
          </ol>
          <div class="row">
            <select class="input" style={{ width: 'auto' }} value={addType} onChange={(e) => setAddType(e.target.value)} aria-label="추가할 섹션 종류">
              {Object.entries(E.SECTION_DEFS).filter(([t]) => t !== 'hero').map(([t, d]) => <option value={t}>{d.label} — {d.desc}</option>)}
            </select>
            <button class="btn btn-sm" onClick={add}>섹션 추가</button>
          </div>
          {v.warnings.length > 0 && <details><summary class="small">확인할 점 {v.warnings.length}개</summary><ul class="warnings">{v.warnings.map((w) => <li>· {w.message_ko}</li>)}</ul></details>}
        </div>
      </Sheet>
      <StepFoot go={go} prev={3} next={5} nextLabel="다음: 디자인" />
    </>
  );
}

function SectionEditor({ s, set }) {
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
  else if (s.type === 'survey') body = <Field label="설문 주소"><input type="url" value={s.url || ''} onInput={(e) => set({ url: e.target.value })} /></Field>;
  else if (s.type === 'stations') body = <Stations s={s} set={set} />;
  else if (s.lead !== undefined || ['qa', 'board', 'tools', 'materials', 'deck', 'outline', 'readiness'].includes(s.type)) body = <Field label="안내 문장"><textarea rows={2} value={s.lead || ''} onInput={(e) => set({ lead: e.target.value })} /></Field>;
  return (
    <div class="sec-body">
      {s.type !== 'hero' && s.type !== 'closing' && common}
      {body}
      <details onToggle={(e) => { if (e.target.open) setJson(JSON.stringify(s, null, 2)); }}>
        <summary class="small">세부 내용 직접 고치기(JSON)</summary>
        {json !== null && <div class="stack" style={{ marginTop: '8px' }}>
          <textarea class="input code" rows={12} value={json} onInput={(e) => setJson(e.target.value)} aria-label="섹션 JSON" />
          <div><button class="btn btn-sm" onClick={() => { try { const o = JSON.parse(json); set({ ...o, id: s.id, type: s.type }); toast('반영했어요.'); } catch { toast('JSON 형식이 맞지 않아요.'); } }}>반영</button></div>
        </div>}
      </details>
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
