// 교재에 맞춘 구성 알리기: 1단계의 "교재에서 찾은 것"(교재 성격에 맞게)·교재에서 찾은 주소 확인,
// 2단계의 "이렇게 구성했어요"·권하는 기능(누르면 켬)·싣지 못한 것(누르면 본문에 넣음).
// 규칙은 엔진(decide/structure.js·ingest/signals.js·ingest/compose.js)에 있고 여기서는 보여 주기만 해요.
import { useMemo, useState } from 'preact/hooks';
import { E } from '../lib/engine.js';
import { draftInfo } from '../lib/blueprint.js';
import { toast } from '../lib/util.js';

const host = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return u; } };

/** 1단계: 교재에서 찾은 것 한 줄 + 펼치기(나머지·구성), PPT만 넣었을 때 쪽 그림 안내, 교재에서 찾은 주소 확인 */
export function FoundSummary({ p, setInfo }) {
  const mat = p.material; const d = mat?.detected || {};
  const found = E.foundSummary(d, 12);
  const st = useMemo(() => (d.signals ? E.decideStructure(draftInfo(p.info), mat, null) : null), [mat, p.info.format, p.info.size, p.info.admin]);
  const files = p.files || [];
  const pptOnly = files.some((f) => ['pptx', 'ppsx', 'ppt'].includes(f.ext)) && !files.some((f) => f.ext === 'pdf') && !p.slidesMade;
  const addr = [...(d.addresses?.join || []).map((a) => ({ ...a, key: 'joinUrl' })), ...(d.addresses?.survey || []).map((a) => ({ ...a, key: 'surveyUrl' }))]
    .filter((a) => p.info[a.key] !== a.url).slice(0, 3);
  const use = (a) => {
    if (a.key === 'joinUrl') { setInfo({ joinUrl: a.url, mode: p.info.mode === 'online' ? 'online' : 'hybrid' }); toast('첫 화면에 입장 버튼으로 실었어요.'); }
    else { setInfo({ surveyUrl: a.url }); toast('마무리 앞에 설문 버튼과 QR을 실었어요.'); }
  };
  if (!mat) return null;
  const head = found.slice(0, 4);
  return (
    <div class="found" aria-label="교재에서 찾은 것">
      <p class="small"><b>교재에서 찾은 것</b> {head.length ? head.join(' · ') : `쪽 ${mat.pages?.length || 0}개`}</p>
      {(found.length > head.length || st) && <details class="found-more">
        <summary class="small">더 보기</summary>
        {found.length > head.length && <p class="small muted">{found.slice(head.length).join(' · ')}</p>}
        {st && <p class="small muted">이렇게 구성할 거예요: {st.label}. {st.reasons[0]}</p>}
      </details>}
      {pptOnly && <p class="small found-tip">PPT만 넣었어요. PDF로도 저장해 함께 넣으면 교재 보기에 쪽 그림이 나와요.</p>}
      {addr.map((a) => (
        <div class="found-addr">
          <span class="small">교재에서 찾은 {a.why}: <span class="mono">{host(a.url)}</span>{a.page ? ` (${a.page}쪽)` : ''}</span>
          <button type="button" class="btn btn-sm" onClick={() => use(a)}>{a.key === 'joinUrl' ? '입장 버튼으로 싣기' : '설문으로 싣기'}</button>
        </div>
      ))}
    </div>
  );
}

/** 2단계 구성 안내의 값: 구성(흐름·까닭) · 권하는 기능 칩(아직 켜지 않은 것) · 싣지 못한 것 */
export function useStructure(p) {
  const bp = p.blueprint; const st = bp?.structure;
  const left = useMemo(() => (p.material?.pages?.length && bp ? E.findLeftovers(p.material, bp, { max: 40 }) : st?.leftovers || { count: 0, items: [] }), [bp, p.material]);
  if (!st?.flow) return null;
  const on = new Set((p.info.features || []).flatMap((x) => String(x).split('+')));
  const chips = (st.suggested || []).filter((x) => !on.has(x.feature));
  return { st, chips, left };
}

/** 구성 안내 한 줄의 요약: "따라 하기 구성 · 권하는 기능 3" */
export const structureLine = (s) => s ? [`${s.st.label} 구성`, s.chips.length ? `권하는 기능 ${s.chips.length}` : '', s.left.count ? `싣지 못한 것 ${s.left.count}` : ''].filter(Boolean).join(' · ') : '';

/** 구성 안내를 펼친 내용: 까닭 · 권하는 기능 칩(누르면 켬) · 싣지 못한 것 n개(누르면 본문에 넣음) */
export function StructureMore({ p, s, update, setInfo, pushUndo }) {
  const { st, chips, left } = s;
  const turnOn = (x) => { pushUndo?.(`${x.label} 켜기`); setInfo({ features: [...(p.info.features || []), x.feature] }); toast(`켰어요: ${x.label}. '참여 기능' 탭에서 끌 수 있어요.`); };
  function addLeftovers() {
    pushUndo?.('싣지 못한 것 넣기');
    update((cur) => {
      const r = E.applyBlueprintPatch(cur.blueprint, { add: E.leftoverAdds(cur.blueprint, left) });
      const next = r.raw;
      next.structure = { ...(next.structure || st), leftovers: E.findLeftovers(cur.material, next, { max: 12 }) };
      return { blueprint: next };
    });
    toast(`교재 순서 자리에 글 칸으로 넣었어요. 고치거나 빼도 돼요.`);
  }
  return (
    <div class="structure-more">
      <p class="small"><b>이렇게 구성했어요</b> {st.label}. {st.reasons?.[0] || ''}</p>
      {st.reasons?.length > 1 && <ul class="small">{st.reasons.slice(1).map((r) => <li>{r}</li>)}</ul>}
      {(chips.length > 0 || left.count > 0) && <div class="structure-acts">
        {chips.length > 0 && <div class="chips" role="group" aria-label="권하는 참여 기능">
          <span class="small muted">권하는 기능</span>
          {chips.map((x) => <button type="button" class="chip" title={x.reason} onClick={() => turnOn(x)}>＋ {x.label}</button>)}
        </div>}
        {left.count > 0 && <details class="structure-left">
          <summary class="small">교재에 있는데 싣지 못한 것 {left.count}개</summary>
          <ul class="small muted">{left.items.slice(0, 5).map((x) => <li>{x.page ? `${x.page}쪽 ` : ''}{x.text}</li>)}{left.count > 5 && <li>외 {left.count - 5}개</li>}</ul>
          <button type="button" class="btn btn-sm" onClick={addLeftovers}>본문에 넣기</button>
        </details>}
      </div>}
    </div>
  );
}

/**
 * 2단계 구성 안내(AI 결과 띠를 본 뒤·다시 열었을 때): 접힌 한 줄 "이렇게 구성했어요 · 따라 하기 구성 · 권하는 기능 3 [자세히]".
 * 펼치면 까닭·권하는 기능·싣지 못한 것. AI가 막 짰을 때는 결과 띠(Edit.jsx ResultBand) 안에 함께 들어가요
 */
export function StructureNote({ p, update, setInfo, pushUndo }) {
  const s = useStructure(p);
  const [open, setOpen] = useState(false);
  if (!s) return null;
  return (
    <section class={`structure-note${open ? ' is-open' : ''}`} aria-label="구성">
      <div class="structure-line">
        <span class="small"><b>이렇게 구성했어요</b> <span>{structureLine(s)}</span></span>
        <button type="button" class="btn btn-sm btn-quiet" aria-expanded={String(open)} onClick={() => setOpen(!open)}>{open ? '접기' : '자세히'}</button>
      </div>
      {open && <StructureMore p={p} s={s} update={update} setInfo={setInfo} pushUndo={pushUndo} />}
    </section>
  );
}
