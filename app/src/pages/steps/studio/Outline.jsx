import { useEffect, useRef, useState } from 'preact/hooks';
import { Dialog } from '../../../components/ui.jsx';
import { KIT_LABEL, SETTABLE, INSERTABLE, POLL_KINDS, SURVEY_KINDS, LIMIT, readKit, writeKit, checkKit, kitSummary, splitList } from '../../../lib/kit-fields.js';
import { toast } from '../../../lib/util.js';
import { FoldHead } from './Parts.jsx';

// 사이트 구성: 쪽마다 섹션 목록(Webflow Navigator·Framer Layers처럼) + 섹션 안의 항목(참여 기능·실습 단계, GrapesJS Traits·Puck Fields처럼 그 자리에서 설정).
// 섹션: 끌기(또는 ↑↓·Alt+↑↓)로 순서, 눈 버튼으로 숨기기, 두 번 누르기(또는 F2)로 이름 바꾸기, […]에서 AI로 수정·삭제. 누르면 미리보기가 그 섹션으로.
// 줄에 마우스를 올리면 미리보기의 그 자리에 테두리, 미리보기의 내용을 누르면 여기서 그 줄을 골라 펼침(reveal).
// 항목: 투표(질문·방식·보기·정답)·나눔 보드(안내 글)·설문(문항)·교재 슬라이드(쪽)·자료실(링크)·실습 단계(이름·시간)는 [저장]으로 한 번에 반영(실행 취소·버전 기록).
// 설정이 없는 것(질문·출석·접속 QR 등)은 이름표. [＋ 기능 넣기]는 섹션 끝에 자리 표시를 넣음.

const key = (page, id) => `${page}#${id}`;
/** 수정 칸 안에서만 보이게(넓은 화면은 오른쪽 칸만 스크롤: 페이지가 움직여 [배포하기]가 가려지지 않게). 휴대폰은 화면이 스크롤 */
export function keep(el) {
  if (!el) return;
  const box = el.closest('.st-scroll');
  if (!box || getComputedStyle(box).overflowY === 'visible') { el.scrollIntoView({ block: 'nearest' }); return; }
  const r = el.getBoundingClientRect(); const b = box.getBoundingClientRect();
  if (r.top < b.top + 8) box.scrollTop -= b.top + 8 - r.top;
  else if (r.bottom > b.bottom - 8) box.scrollTop += Math.min(r.bottom - b.bottom + 8, r.top - b.top - 8);
}
/** 초점을 옮기되 페이지는 그대로, 수정 칸 안에서만 보이게 */
export const focusIn = (el, show = el) => { if (!el) return; el.focus({ preventScroll: true }); keep(show); };
const Chev = () => <svg class="chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>;
const Eye = ({ off }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{off
  ? <><path d="M3 3l18 18" /><path d="M10.6 5.1A9.6 9.6 0 0 1 12 5c5 0 9 4.5 10 7-.4 1-1.3 2.4-2.6 3.7M6.6 6.6C4.4 8 2.9 10.1 2 12c1 2.5 5 7 10 7 1.8 0 3.4-.5 4.8-1.3" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>
  : <><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z" /><circle cx="12" cy="12" r="3" /></>}</svg>;
/** 접힌 섹션의 한 줄 요약: '숨김 · 실습 3단계 · 투표 · 질문' */
const secSum = (s) => [s.hidden ? '숨김' : '', s.steps ? `실습 ${s.steps}단계` : '', ...s.items.filter((x) => x.type !== 'step').map((x) => KIT_LABEL[x.type] || x.type)].filter(Boolean).join(' · ');

/**
 * outlines: [{ page, label, sections, loose }] · sel: { page, key, item } · reveal: 미리보기에서 고른 것({ page, key, item, n })
 * act: move·hide·remove·rename·ask(섹션), kitSave·kitRemove·kitAdd(항목) · onSelect·onHover: 미리보기와 잇기
 */
export function Outline({ outlines, locked, sel, reveal, act, onSelect, onHover, surveyDefaults, open: shown = true, onToggle }) {
  const [open, setOpen] = useState(() => new Set());
  const [form, setForm] = useState(''); // 열린 항목 설정 칸: 'page:n:type' 또는 새 항목 'new:page#id:type'
  const [rename, setRename] = useState(''); const [del, setDel] = useState(null);
  const [drag, setDrag] = useState(null); const [over, setOver] = useState(null);
  const want = useRef(null); // 넣은 뒤 열 항목: { page, id, type, count }
  const root = useRef();
  const total = outlines.reduce((a, o) => a + o.sections.length, 0);
  const multi = outlines.length > 1;
  // 접혔을 때 한 줄: 쪽·섹션·참여 기능 수
  const kits = outlines.reduce((a, o) => a + o.sections.reduce((b, x) => b + x.items.length, 0) + (o.loose || []).length, 0);
  const outSum = total ? [outlines.length > 1 ? `${outlines.length}쪽` : '', `섹션 ${total}개`, kits ? `참여 기능·실습 ${kits}개` : ''].filter(Boolean).join(' · ') : '섹션이 없어요';

  const toggle = (k, on) => setOpen((s) => { const n = new Set(s); if (on ?? !n.has(k)) n.add(k); else n.delete(k); return n; });
  const focusSec = (page, i, dir = '') => setTimeout(() => {
    const li = root.current?.querySelectorAll(`.sec2-list[data-page="${CSS.escape(page)}"] > .sec2`)[i];
    const b = dir && li?.querySelector(`.sec2-row button[aria-label$="${dir}"]:not([disabled])`);
    focusIn(b || li?.querySelector('.sec2-name'));
  }, 60);
  const move = (page, list, i, to, dir) => { if (locked || to < 0 || to >= list.length) return; act.move(page, list[i].id, to); focusSec(page, to, dir); };
  // 미리보기에서 고른 것: 그 섹션을 펼치고 줄이 보이게
  useEffect(() => {
    if (!reveal?.n) return;
    const o = outlines.find((x) => x.page === reveal.page); if (!o) return;
    const s = o.sections.find((x) => x.id === reveal.key || x.items.some((it) => it.n === reveal.item));
    if (s && Number.isInteger(reveal.item)) toggle(key(o.page, s.id), true);
    setTimeout(() => keep(root.current?.querySelector('.is-sel')), 80);
  }, [reveal?.n]);
  // [＋ 기능 넣기]로 넣은 항목: 설정 칸을 열어 둠
  useEffect(() => {
    const w = want.current; if (!w) return;
    const s = outlines.find((x) => x.page === w.page)?.sections.find((x) => x.id === w.id);
    const items = s ? s.items.filter((x) => x.type === w.type) : [];
    if (items.length > w.count) { want.current = null; const it = items[items.length - 1]; if (SETTABLE.has(it.type)) setForm(`${w.page}:${it.n}:${it.type}`); }
  }, [outlines]);
  // 열린 메뉴([…]·[＋ 기능 넣기])는 바깥을 누르거나 Esc로 닫힘
  useEffect(() => {
    const off = (e) => root.current?.querySelectorAll('details.sec2-more[open]').forEach((d) => { if (!d.contains(e.target)) d.open = false; });
    document.addEventListener('pointerdown', off, true); return () => document.removeEventListener('pointerdown', off, true);
  }, []);
  const escMenu = (e) => { const d = e.key === 'Escape' && e.target.closest?.('details.sec2-more[open]'); if (d) { e.preventDefault(); e.stopPropagation(); d.open = false; d.querySelector('summary')?.focus(); } };
  const add = (page, s, type) => {
    if (type === 'poll' || type === 'board') { setForm(`new:${key(page, s.id)}:${type}`); return; }
    want.current = { page, id: s.id, type, count: s.items.filter((x) => x.type === type).length };
    act.kitAdd(page, s.id, type, {});
  };
  const items = (o, s, list, label) => {
    const settable = list.filter((it) => SETTABLE.has(it.type));
    const plain = list.filter((it) => !SETTABLE.has(it.type));
    const draft = s && form.startsWith(`new:${key(o.page, s.id)}:`) ? form.split(':').pop() : '';
    return (
      <ul class="kit-list" id={`kits-${o.page}-${s ? s.id : 'loose'}`} aria-label={`${label} 항목`}>
        {settable.map((it) => {
          const fk = `${o.page}:${it.n}:${it.type}`; const on = form === fk;
          const isSel = sel?.page === o.page && sel?.item === it.n;
          return (
            <li class={`kit${isSel ? ' is-sel' : ''}${on ? ' is-open' : ''}`} key={fk} data-item={`${o.page}:${it.n}`}>
              <button type="button" class="kit-row" aria-expanded={String(on)} onClick={() => { setForm(on ? '' : fk); if (!on) onSelect({ page: o.page, key: s?.id || '', item: it.n }); }}
                onMouseEnter={() => onHover(o.page, s?.id || '', it.n)} onMouseLeave={() => onHover(null)}>
                <span class={`kit-tag k-${it.type}`}>{KIT_LABEL[it.type]}</span><span class="kit-sum">{kitSummary(it.type, it.attrs)}</span><Chev />
              </button>
              {on && <KitForm key={JSON.stringify(it.attrs)} type={it.type} attrs={it.attrs} locked={locked} surveyDefaults={surveyDefaults}
                onCancel={() => setForm('')}
                onSave={(patch) => { act.kitSave(o.page, it.n, patch, KIT_LABEL[it.type], s?.id || ''); setForm(''); }}
                onRemove={it.type === 'step' ? null : () => { act.kitRemove(o.page, it.n, KIT_LABEL[it.type]); setForm(''); }} />}
            </li>
          );
        })}
        {plain.length > 0 && <li class="kit-chips">{plain.map((it) => {
          const name = KIT_LABEL[it.type] || it.type;
          return <span class={`kit-chip${sel?.page === o.page && sel?.item === it.n ? ' is-sel' : ''}`} key={it.n} data-item={`${o.page}:${it.n}`} onMouseEnter={() => onHover(o.page, s?.id || '', it.n)} onMouseLeave={() => onHover(null)}>
            <button type="button" class="kit-chip-b" onClick={() => onSelect({ page: o.page, key: s?.id || '', item: it.n })} title="미리보기에서 보기">{name}</button>
            <button type="button" class="kit-chip-x" disabled={locked} aria-label={`${name} 삭제`} title="삭제" onClick={() => act.kitRemove(o.page, it.n, name)}>✕</button>
          </span>;
        })}</li>}
        {!list.length && !draft && <li class="kit-none small muted">참여 기능이 없어요.</li>}
        {draft && <li class="kit is-open is-new"><KitForm draft type={draft} attrs={{}} locked={locked} surveyDefaults={surveyDefaults} onCancel={() => setForm('')}
          onSave={(patch) => { act.kitAdd(o.page, s.id, draft, patch); setForm(''); }} /></li>}
        {s && !draft && <li class="kit-add-row"><details class="kit-add sec2-more"><summary class="btn btn-sm btn-quiet" aria-disabled={locked ? 'true' : undefined}>＋ 기능 넣기</summary>
          <div class="sec2-menu" role="group" aria-label={`${s.name}에 넣을 기능`}>{INSERTABLE.map((t) => <button type="button" class="btn btn-sm btn-quiet" disabled={locked}
            onClick={(e) => { e.currentTarget.closest('details').open = false; add(o.page, s, t); }}>{KIT_LABEL[t]}</button>)}</div></details></li>}
      </ul>
    );
  };
  return (
    <section class="st-card st-outline" aria-labelledby="st-outline-h" ref={root} onKeyDown={escMenu}>
      <FoldHead id="st-outline" title="사이트 구성" count={total} open={shown} onToggle={onToggle} summary={outSum} />
      <div class="st-fold-b" id="st-outline-b" hidden={!shown}>
      <p class="small muted st-outline-tip">끌어서 순서를 바꾸고, 펼쳐서 항목을 바로 고쳐요.</p>
      {locked && <p class="lock-note small">AI가 고치는 동안에는 바꿀 수 없어요.</p>}
      {outlines.map((o) => (
        <div class="sec2-group" key={o.page}>
          {multi && <h3 class="sec2-page">{o.label}</h3>}
          <ol class="sec2-list" data-page={o.page} aria-label={multi ? `${o.label} 섹션 목록` : '섹션 목록'}>
            {o.sections.map((s, i) => {
              const k = key(o.page, s.id); const isOpen = open.has(k); const renaming = rename === k;
              const isSel = sel?.page === o.page && sel?.key === s.id && !Number.isInteger(sel?.item);
              const sum = secSum(s);
              return (
                <li class={`sec2${s.hidden ? ' is-hidden' : ''}${isSel ? ' is-sel' : ''}${isOpen ? ' is-open' : ''}${over === k ? ' is-over' : ''}`} key={s.id} data-sec={s.id}
                  draggable={!locked && !renaming}
                  onDragStart={(e) => { if (e.target.closest?.('.kit-list')) return; setDrag({ page: o.page, i }); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', s.id); } catch { } }}
                  onDragOver={(e) => { if (!drag || drag.page !== o.page) return; e.preventDefault(); setOver(k); }} onDragLeave={() => setOver(null)}
                  onDrop={(e) => { e.preventDefault(); if (drag && drag.page === o.page && drag.i !== i) { act.move(o.page, o.sections[drag.i].id, i); toast(`옮겼어요: ${o.sections[drag.i].name}`); } setDrag(null); setOver(null); }}
                  onDragEnd={() => { setDrag(null); setOver(null); }}>
                  <div class="sec2-row" onMouseEnter={() => onHover(o.page, s.id, null)} onMouseLeave={() => onHover(null)}>
                    <span class="sec2-grip" aria-hidden="true">⋮⋮</span>
                    <button type="button" class="sec2-tw" aria-expanded={String(isOpen)} aria-controls={`kits-${o.page}-${s.id}`} aria-label={`${s.name} 항목 ${isOpen ? '접기' : '펼치기'}`} onClick={() => toggle(k)}><Chev /></button>
                    {renaming ? <form class="sec2-rename" onSubmit={(e) => { e.preventDefault(); const v = e.currentTarget.elements.n.value.trim(); if (v && v !== s.name) act.rename(o.page, s.id, v); setRename(''); focusSec(o.page, i); }}>
                      <input name="n" class="input" defaultValue={s.name} maxLength={60} aria-label={`${s.name} 새 이름`} ref={(el) => el && !el.dataset.f && (el.dataset.f = '1', setTimeout(() => { el.focus({ preventScroll: true }); el.select(); }, 0))}
                        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.currentTarget.dataset.cancel = '1'; setRename(''); focusSec(o.page, i); } }}
                        onBlur={(e) => { if (!e.currentTarget.dataset.cancel && e.currentTarget.isConnected) e.currentTarget.form?.requestSubmit(); }} />
                    </form>
                      : <button type="button" class="sec2-name" aria-current={isSel ? 'true' : undefined} title="누르면 미리보기에서 보여요. 두 번 누르면 이름을 바꿔요."
                        onClick={() => { onSelect({ page: o.page, key: s.id, item: null }); toggle(k, true); }}
                        onDblClick={() => !locked && setRename(k)}
                        onKeyDown={(e) => {
                          if (e.key === 'F2' && !locked) { e.preventDefault(); setRename(k); }
                          else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); move(o.page, o.sections, i, i + (e.key === 'ArrowUp' ? -1 : 1)); }
                        }}>
                        <span class="ttl">{s.name}</span>{sum && <small>{sum}</small>}
                      </button>}
                    <span class="sec2-acts">
                      <button type="button" class="icon-btn sec2-mv" disabled={locked || i === 0} aria-label={`${s.name} 위로`} title="위로(Alt+↑)" onClick={() => move(o.page, o.sections, i, i - 1, '위로')}>↑</button>
                      <button type="button" class="icon-btn sec2-mv" disabled={locked || i === o.sections.length - 1} aria-label={`${s.name} 아래로`} title="아래로(Alt+↓)" onClick={() => move(o.page, o.sections, i, i + 1, '아래로')}>↓</button>
                      <button type="button" class="icon-btn sec2-eye" disabled={locked} aria-pressed={String(!!s.hidden)} aria-label={`${s.name} 숨기기`} title={s.hidden ? '숨기기 취소' : '숨기기'} onClick={() => act.hide(o.page, s.id, !s.hidden)}><Eye off={s.hidden} /></button>
                      <details class="sec2-more"><summary class="icon-btn" aria-label={`${s.name} 더 보기`} title="더 보기">…</summary>
                        <div class="sec2-menu">
                          <button type="button" class="btn btn-sm btn-quiet" disabled={locked} onClick={(e) => { e.currentTarget.closest('details').open = false; setRename(k); }}>이름 바꾸기</button>
                          <button type="button" class="btn btn-sm btn-quiet" disabled={locked} onClick={(e) => { e.currentTarget.closest('details').open = false; act.ask(o.page, s.id, s.name); }}>AI로 수정</button>
                          <button type="button" class="btn btn-sm btn-quiet" disabled={locked} onClick={(e) => { e.currentTarget.closest('details').open = false; act.hide(o.page, s.id, !s.hidden); }}>{s.hidden ? '숨기기 취소' : '숨기기'}</button>
                          <button type="button" class="btn btn-sm btn-quiet sec2-del" disabled={locked} onClick={(e) => { e.currentTarget.closest('details').open = false; setDel({ page: o.page, s, i }); }}>삭제</button>
                        </div></details>
                    </span>
                  </div>
                  {isOpen && items(o, s, s.items, s.name)}
                </li>
              );
            })}
          </ol>
          {o.loose.length > 0 && <div class="sec2-loose"><p class="small muted">섹션 밖 항목</p>{items(o, null, o.loose, '섹션 밖')}</div>}
          {!o.sections.length && <p class="muted small">섹션(&lt;section&gt;)이 없는 쪽이에요. 아래 AI 수정 칸에서 섹션을 나눠 달라고 할 수 있어요.</p>}
        </div>
      ))}
      <Dialog open={!!del} onClose={() => setDel(null)} label="섹션 삭제 확인">
        {del && <><h2 class="h-sub">'{del.s.name}' 섹션을 삭제할까요?</h2><p>숨기기는 사이트에서 감추기만 해요. 삭제한 것은 [실행 취소]나 [버전 기록]으로 되살릴 수 있어요.</p>
          <div class="btn-row"><button class="btn btn-quiet" data-autofocus onClick={() => setDel(null)}>닫기</button><button class="btn" onClick={() => { act.hide(del.page, del.s.id, true); setDel(null); }}>숨기기</button><button class="btn btn-danger" onClick={() => { act.remove(del.page, del.s.id); setDel(null); toast(`삭제했어요: ${del.s.name}`); focusSec(del.page, Math.max(0, del.i - 1)); }}>삭제</button></div></>}
      </Dialog>
      </div>
    </section>
  );
}

/** 항목 설정 칸: 입력 값은 이 칸 안에만 두고 [저장]으로 한 번에(빈 보기를 더하거나 순서를 바꾸는 도중에 사이트가 바뀌지 않게) */
function KitForm({ type, attrs, draft, locked, surveyDefaults = [], onSave, onCancel, onRemove }) {
  const init = () => {
    const v = readKit(type, attrs);
    if (type === 'poll' && draft) return { ...v, options: ['', ''] };
    if (type === 'survey') return { ...v, questions: v.questions.map((q) => ({ ...q, opts: (q.options || []).join(', ') })) };
    return v;
  };
  const [v, setV] = useState(init);
  const [start] = useState(() => JSON.stringify(init()));
  const [err, setErr] = useState('');
  const box = useRef();
  const dirty = draft || JSON.stringify(v) !== start;
  const set = (patch) => { setV((x) => ({ ...x, ...patch })); setErr(''); };
  useEffect(() => { setTimeout(() => focusIn(box.current?.querySelector('input:not([type=hidden]),select,textarea,button'), box.current), 0); }, []);
  const norm = () => (type === 'survey' ? { ...v, questions: v.questions.map((q) => ({ q: q.q, kind: q.kind, options: q.kind === 'choice' ? splitList(q.opts) : [] })) } : v);
  const save = (e) => {
    e.preventDefault(); if (locked || !dirty) return;
    const n = norm(); const bad = checkKit(type, n);
    if (bad) { setErr(bad); return; }
    onSave(writeKit(type, n, attrs));
  };
  const field = (label, input, hint) => <label class="kf"><span class="kf-l">{label}</span>{input}{hint && <small class="kf-h">{hint}</small>}</label>;
  return (
    <form class="kit-form" ref={box} onSubmit={save} onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); } }}
      aria-label={`${KIT_LABEL[type]} ${draft ? '추가' : '설정'}`}>
      {type === 'poll' && <>
        {field('질문', <input class="input" value={v.question} maxLength={LIMIT.question} placeholder="예: 가장 먼저 해 보고 싶은 것은?" onInput={(e) => set({ question: e.target.value })} />)}
        {field('방식', <select class="input" value={v.kind} onChange={(e) => set({ kind: e.target.value, answer: e.target.value === 'choice' ? v.answer : -1, options: e.target.value === 'choice' && v.options.length < 2 ? [...v.options, '', ''].slice(0, Math.max(2, v.options.length)) : v.options })}>{POLL_KINDS.map(([k, l]) => <option value={k}>{l}</option>)}</select>)}
        {v.kind === 'choice' && <>
          <fieldset class="kf"><legend class="kf-l">보기</legend>
            <ListRows items={v.options} label="보기" min={2} max={LIMIT.options} addLabel="보기 추가" blank={() => ''}
              onChange={(next, op) => set({ options: next, answer: moveIndex(v.answer, op) })}
              render={(x, i, put) => <input class="input" value={x} maxLength={LIMIT.option} aria-label={`보기 ${i + 1}`} onInput={(e) => put(e.target.value)} />} />
          </fieldset>
          {field('정답', <select class="input" value={String(v.answer)} onChange={(e) => set({ answer: +e.target.value })}><option value="-1">정답 없음</option>{v.options.map((o, i) => <option value={String(i)} disabled={!o.trim()}>{`${i + 1}. ${o || '(빈 보기)'}`}</option>)}</select>, '퀴즈로 쓸 때만 골라요. 결과를 공개할 때 참가자에게 보여요.')}
        </>}
        {v.kind === 'scale' && <p class="small muted">참가자가 1~5 가운데 하나를 골라요.</p>}
        {v.kind === 'word' && <p class="small muted">참가자가 낱말을 적고, 많이 나온 낱말이 크게 보여요.</p>}
      </>}
      {type === 'board' && field('안내 글', <textarea class="input" rows={2} value={v.prompt} maxLength={LIMIT.prompt} placeholder="예: 만든 결과물 사진이나 글을 올려 주세요" onInput={(e) => set({ prompt: e.target.value })} />, '참가자가 무엇을 올릴지 알려 줘요.')}
      {type === 'survey' && (!v.custom
        ? <div class="kf"><p class="small muted">기본 문항 {surveyDefaults.length}개를 써요.</p><button type="button" class="btn btn-sm" onClick={() => set({ custom: true, questions: surveyDefaults.map((q) => ({ q: q.q, kind: q.kind, opts: (q.options || []).join(', ') })) })}>문항 직접 정하기</button></div>
        : <fieldset class="kf"><legend class="kf-l">문항</legend>
          <ListRows items={v.questions} label="문항" min={1} max={LIMIT.items} addLabel="문항 추가" blank={() => ({ q: '', kind: 'scale', opts: '' })} onChange={(next) => set({ questions: next })}
            render={(q, i, put) => <>
              <input class="input" value={q.q} maxLength={LIMIT.question} aria-label={`문항 ${i + 1}`} placeholder="문항" onInput={(e) => put({ ...q, q: e.target.value })} />
              <span class="kf-pair">
                <select class="input" value={q.kind} aria-label={`문항 ${i + 1} 방식`} onChange={(e) => put({ ...q, kind: e.target.value })}>{SURVEY_KINDS.map(([k, l]) => <option value={k}>{l}</option>)}</select>
                {q.kind === 'choice' && <input class="input" value={q.opts} aria-label={`문항 ${i + 1} 보기`} placeholder="보기(쉼표로 나눠요)" onInput={(e) => put({ ...q, opts: e.target.value })} />}
              </span>
            </>} />
          <button type="button" class="btn-link small" onClick={() => set({ custom: false })}>기본 문항으로</button>
        </fieldset>)}
      {type === 'deck' && field('보여 줄 쪽', <input class="input" value={v.pages} maxLength={80} placeholder="비우면 모든 쪽" onInput={(e) => set({ pages: e.target.value })} />, '예: 1-12, 15')}
      {type === 'materials' && <fieldset class="kf"><legend class="kf-l">링크</legend>
        <p class="small muted">[자료]에서 올린 파일은 여기에 저절로 들어가요. 다른 자료는 링크로 걸어요.</p>
        <ListRows items={v.items} label="링크" min={0} max={LIMIT.items} addLabel="링크 추가" blank={() => ({ title: '', href: '' })} onChange={(next) => set({ items: next })}
          render={(x, i, put) => <>
            <input class="input" value={x.title} maxLength={100} aria-label={`링크 ${i + 1} 이름`} placeholder="이름" onInput={(e) => put({ ...x, title: e.target.value })} />
            <input class="input" value={x.href} maxLength={LIMIT.href} aria-label={`링크 ${i + 1} 주소`} placeholder="https:// 주소" inputMode="url" onInput={(e) => put({ ...x, href: e.target.value })} />
          </>} />
      </fieldset>}
      {type === 'step' && <>
        {field('단계 이름', <input class="input" value={v.title} maxLength={LIMIT.title} onInput={(e) => set({ title: e.target.value })} />)}
        {field('실습 시간(분)', <input class="input kf-num" type="number" min={1} max={600} inputMode="numeric" value={v.minutes} placeholder="비어 있음" onInput={(e) => set({ minutes: e.target.value })} />, '강사 화면의 타이머 버튼에 쓰여요.')}
      </>}
      {err && <p class="warn-line small" role="alert">{err}</p>}
      <div class="kf-foot">
        {onRemove && <button type="button" class="btn-link small sec2-del" disabled={locked} onClick={onRemove}>이 기능 삭제</button>}
        <span class="kf-gap" />
        <button type="button" class="btn btn-sm btn-quiet" onClick={onCancel}>취소</button>
        <button class="btn btn-sm btn-primary" disabled={locked || !dirty}>{draft ? '추가' : '저장'}</button>
      </div>
    </form>
  );
}
/** 보기를 옮기거나 지우면 정답 번호도 따라감 */
function moveIndex(a, op = {}) {
  if (a < 0) return a;
  if (op.remove !== undefined) return op.remove === a ? -1 : op.remove < a ? a - 1 : a;
  if (op.move) { const [i, j] = op.move; return a === i ? j : a === j ? i : a; }
  return a;
}

/** 목록 칸(보기·문항·링크): 줄마다 ↑↓ 삭제, 맨 아래 [＋ 추가]. 초점은 옮긴 줄·새 줄로 */
function ListRows({ items, label, min = 0, max = 20, addLabel, blank, render, onChange }) {
  const ref = useRef();
  const focus = (i, sel = 'input,select') => setTimeout(() => { const rows = ref.current?.querySelectorAll(':scope > li'); const r = rows?.[Math.min(i, rows.length - 1)]; focusIn(r?.querySelector(sel) || ref.current?.parentElement?.querySelector('.lr-add')); }, 30);
  const swap = (i, j, dir) => { const a = [...items]; [a[i], a[j]] = [a[j], a[i]]; onChange(a, { move: [i, j] }); focus(j, `button[aria-label$="${dir}"]:not([disabled])`); };
  return (
    <div class="lr">
      <ol class="lr-list" ref={ref}>{items.map((x, i) => (
        <li class="lr-row" key={i}>
          <span class="lr-no" aria-hidden="true">{i + 1}</span>
          <div class="lr-fields">{render(x, i, (nx) => onChange(items.map((y, j) => (j === i ? nx : y)), { edit: i }))}</div>
          <span class="lr-acts">
            <button type="button" class="icon-btn" disabled={i === 0} aria-label={`${label} ${i + 1} 위로`} title="위로" onClick={() => swap(i, i - 1, '위로')}>↑</button>
            <button type="button" class="icon-btn" disabled={i === items.length - 1} aria-label={`${label} ${i + 1} 아래로`} title="아래로" onClick={() => swap(i, i + 1, '아래로')}>↓</button>
            <button type="button" class="icon-btn" disabled={items.length <= min} aria-label={`${label} ${i + 1} 삭제`} title="삭제" onClick={() => { onChange(items.filter((_, j) => j !== i), { remove: i }); focus(Math.max(0, i - 1)); }}>✕</button>
          </span>
        </li>))}
      </ol>
      {items.length < max && <button type="button" class="btn-link small lr-add" onClick={() => { onChange([...items, blank()], { add: true }); focus(items.length); }}>＋ {addLabel}</button>}
    </div>
  );
}
