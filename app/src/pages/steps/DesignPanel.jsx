import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Field, Seg } from '../../components/ui.jsx';
import { TASTES, inTaste, mixOrder, threeFeelings } from '../../lib/tastes.js';
import { E } from '../../lib/engine.js';
import { SiteThumb } from '../../components/SiteThumb.jsx';
import { FxGallery } from '../../components/FxGallery.jsx';
import { Dialog } from '../../components/ui.jsx';
import { isAdvanced } from './Content.jsx';
import { pushUndoFor, popUndo, undoStack } from '../../lib/undo.js';
import { toast } from '../../lib/util.js';
import { SayFix, changesLine } from '../../design-words/SayFix.jsx';
import { applyWords, variantOptions, currentVariant, hasVariants, typeKo, wordById, changes, LEAD_KO, MOTION_KO } from '../../design-words/words.js';
import { useBus, setTry, setLabels, focusSection } from '../../design-words/bus.js';
import { useBasket } from '../../design-words/basket.js';

const MOTION = MOTION_KO;
const MOTION_DESC = ['움직임 없이 깔끔하게 보여 줘요.', '섹션이 나타날 때만 살짝 움직여요.', '제목·숫자·배경이 은은하게 움직여요.', '스크롤에 맞춰 장면이 바뀌어요(스크롤텔링·패럴랙스·고정 장면).'];
const loadedFonts = new Set();
function useFontCss(urls) {
  useEffect(() => {
    for (const u of urls) {
      if (!u || loadedFonts.has(u) || !/^https:\/\/(fonts\.googleapis\.com|cdn\.jsdelivr\.net|hangeul\.pstatic\.net)\//.test(u)) continue;
      loadedFonts.add(u);
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = u; document.head.appendChild(l);
    }
  }, [urls.join('|')]);
}

/** 디자인 고르기 카드: 실제 첫 화면 + 이름·어울리는 이유 */
function Thumb({ preset, bp, pressed, onPick, why }) {
  return (
    <button class="thumb" aria-pressed={String(pressed)} onClick={onPick}>
      <SiteThumb bp={bp} presetId={preset.id} pressed={pressed} />
      <span class="thumb-cap"><b>{preset.name_ko}</b><small>{why || preset.desc_ko}</small></span>
    </button>
  );
}

function topPalettes(d) {
  const moods = d.mood || [], topics = d.topics || [];
  return E.PALETTE_SEEDS.map((s) => ({ s, n: (s.moods || []).filter((m) => moods.includes(m)).length * 2 + (s.topics || []).filter((t) => topics.includes(t)).length }))
    .sort((a, b) => b.n - a.n).slice(0, 6).map((x) => x.s);
}
const MOOD_KO = { data: '데이터', emotional: '감성', warm: '따뜻함', futuristic: '미래적', bold: '대담함', minimal: '깔끔함', playful: '경쾌함', handmade: '손그림', tech: '테크', energetic: '활기', retro: '레트로', calm: '차분함', natural: '자연', formal: '공식적', editorial: '잡지풍' };
const koWord = (w) => MOOD_KO[w] || E.TOPIC_LABELS?.[w] || w;
/** "분위기(tech, futuristic)" → "분위기(테크·미래적)" */
const whyKo = (x) => String(x).replace('사이트 유형', '연수 유형').replace(/\(([^)]*)\)/, (m, inner) => '(' + inner.split(/,\s*/).map(koWord).join('·') + ')');

export function DesignPanel({ p, update }) {
  const bp = p.blueprint;
  const d = bp.design || {};
  const concept = bp.concept || E.deriveConcept({ title: bp.meta?.title, subtitle: bp.meta?.subtitle, topics: d.topics || [], archetype: bp.archetype?.primary, admin: bp.meta?.admin?.kind });
  // 느낌이 다른 세 안(차분·따뜻·전문·발랄·강렬 가운데 겹치지 않게): 한눈에 비교하고 하나 누르면 끝
  const ranked = useMemo(() => threeFeelings(E.rankPresets({ moods: d.mood || [], topics: d.topics || [], archetype: bp.archetype?.primary, admin: bp.meta?.admin?.kind, minor: bp.audience?.minor }, E.PRESETS.length), E.getPreset, concept.preset), [(d.mood || []).join(), (d.topics || []).join(), bp.archetype?.primary, concept.preset]);
  const [compare, setCompare] = useState(false);
  const pickPreset = (id) => { if (d.preset === id) return; setD({ preset: id, seed: '' }, `디자인 ${E.getPreset(id).name_ko}`); toast(`${E.getPreset(id).name_ko}로 바꿨어요. 마음에 안 들면 [되돌리기]를 누르세요.`); };
  const latest = useRef(p); latest.current = p;
  /** 되돌리기에 남기고 바꿈(고르는 것은 모두 [되돌리기]로 돌아갈 수 있게) */
  const remember = (label) => pushUndoFor(p.id, label, latest.current);
  const setD = (patch, label) => { if (label) remember(label); update((cur) => ({ blueprint: { ...cur.blueprint, _presetAuto: false, design: { ...(cur.blueprint.design || {}), ...patch } } })); };
  // 말로 고치기: 적용 · 되돌리기 · 크게 비교
  const [applied, setApplied] = useState('');
  const bus = useBus(p.id);
  useEffect(() => () => { setTry(p.id, null); setLabels(p.id, false); }, [p.id]);
  const applyFix = (f) => {
    remember(`말로 고치기: ${f.title}`);
    update((cur) => ({ blueprint: applyWords(cur.blueprint, f.ids) }));
    setApplied(f.key); setTry(p.id, null);
    if (f.focus) focusSection(p.id, f.focus);
  };
  const undoFix = () => {
    const st = undoStack(p.id); const top = st[st.length - 1];
    if (!top || !/^말로 고치기: /.test(top.label)) { toast('위쪽의 [되돌리기]를 눌러 주세요.'); return; }
    const v = popUndo(p.id); update({ blueprint: v.blueprint, info: v.info }); setApplied(''); toast(`되돌렸어요: ${v.label.replace(/^말로 고치기: /, '')}`);
  };
  const tryFix = (f) => {
    if (!f) { setTry(p.id, null); return; }
    setTry(p.id, { key: f.key, bp: applyWords(latest.current.blueprint, f.ids), label: f.title, focus: f.focus, apply: () => applyFix(f) });
    // 미리보기가 위에 있는 좁은 화면: 비교 화면이 보이게 올림
    const pv = document.querySelector('.workspace .preview');
    if (pv && pv.getBoundingClientRect().top < 0) pv.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const resolved = E.resolveDesign(E.validate(bp).blueprint);
  const others = mixOrder(E.PRESETS.filter((x) => !ranked.some((r) => r.id === x.id)));
  const graphics = E.FX.filter((f) => (f.slots || []).includes('hero.graphic'));
  const adv = isAdvanced();
  const title = bp.meta?.title || '';
  const [fxOpen, setFxOpen] = useState(false);
  const [taste, setTaste] = useState('all');
  const whyText = (r) => (r.concept ? `컨셉 '${concept.motif || concept.idea}'에 맞춘 디자인` : (r.why || []).length ? `어울리는 이유: ${r.why.map(whyKo).join(', ')}` : '');
  return (
    <div class="stack">
      <section class="trio" aria-labelledby="trio-h">
        <div class="trio-head"><h3 class="h-sub" id="trio-h">느낌이 다른 세 안</h3><button type="button" class="btn btn-sm" onClick={() => setCompare(true)}>크게 비교</button></div>
        <div class="thumbs trio-thumbs">{ranked.map((r) => <Thumb preset={E.getPreset(r.id)} bp={bp} pressed={d.preset === r.id} why={[r.feel, r.concept ? '컨셉에 맞춤' : ''].filter(Boolean).join(' · ') || whyText(r)} onPick={() => pickPreset(r.id)} />)}</div>
      </section>
      <SayFix bp={bp} onApply={applyFix} onUndo={undoFix} applied={applied} onTry={tryFix} tried={bus.try?.key} more="위에서 고르거나 [수정 요청]에 적어 AI에게 맡겨요." />
      <BasketNote p={p} update={update} remember={remember} />
      <ConceptCard bp={bp} concept={concept} update={update} setD={setD} />
      <Dialog open={compare} onClose={() => setCompare(false)} label="세 안 크게 비교" wide>
        {compare && <div class="stack">
          <h2 class="h-sub">느낌이 다른 세 안</h2>
          <p class="small muted">이 연수의 실제 내용으로 그린 첫 화면이에요. 고르면 미리보기에 바로 반영되고 [되돌리기]로 돌아갈 수 있어요.</p>
          <div class="trio-big">{ranked.map((r) => { const pr = E.getPreset(r.id); return (
            <figure class="trio-card"><SiteThumb bp={bp} presetId={r.id} pressed={d.preset === r.id} live />
              <figcaption><b>{pr.name_ko}</b><small>{r.feel || pr.desc_ko}</small></figcaption>
              <button type="button" class={`btn btn-sm${d.preset === r.id ? '' : ' btn-primary'}`} disabled={d.preset === r.id} onClick={() => { pickPreset(r.id); setCompare(false); }}>{d.preset === r.id ? '지금 디자인' : '이 디자인으로'}</button>
            </figure>); })}</div>
        </div>}
      </Dialog>
      <details>
        <summary>다른 디자인 {others.length}가지 더 보기</summary>
        <div style={{ marginTop: '10px' }}><Seg label="분위기" value={taste} onChange={setTaste} options={TASTES} /></div>
        <div class="thumbs" style={{ marginTop: '10px' }}>{others.filter((pr) => inTaste(pr, taste)).map((pr) => <Thumb preset={pr} bp={bp} pressed={d.preset === pr.id} onPick={() => setD({ preset: pr.id, seed: '' }, `디자인 ${pr.name_ko}`)} />)}</div>
      </details>
      <BodyWords p={p} update={update} remember={remember} labels={bus.labels} />
      <FontPicker d={d} resolved={resolved} setD={setD} title={title} />
      <Field label="밝기"><Seg label="밝기" value={d.theme || 'preset'} onChange={(v) => setD({ theme: v }, '밝기')} options={[{ value: 'preset', label: '디자인대로' }, { value: 'light', label: '밝게' }, { value: 'dark', label: '어둡게' }, { value: 'auto', label: '기기 설정 따라' }]} /></Field>
      <Field label="움직임" hint={`${MOTION_DESC[d.motion ?? resolved.motion]} ${resolved._notes?.find((n) => /크롬북|네트워크|공식/.test(n)) || '실습·질문 화면은 늘 차분해요.'}`}>
        <Seg label="움직임" value={String(d.motion ?? resolved.motion)} onChange={(v) => setD({ motion: +v }, `움직임 ${MOTION[+v]}`)} options={MOTION.map((label, i) => ({ value: String(i), label }))} />
      </Field>
      <div class="btn-row"><button class="btn btn-sm" onClick={() => setD({ seed: Math.random().toString(36).slice(2, 7) }, '다시 뽑기')}>다른 느낌으로 다시 뽑기</button><span class="small muted">내용은 그대로, 효과 조합만 바꿔요. <a href="#/gallery" target="_blank" rel="noopener">디자인 낱말 사전</a></span></div>
      <details>
        <summary>더 바꾸기: 색·기관 색·첫 화면 그래픽</summary>
        <div class="stack" style={{ marginTop: '12px' }}>
          <Field label="색 조합" hint="모양과 움직임은 그대로, 색만 바꿔요. 모두 글자가 잘 보이는 조합이에요.">
            <div class="stack" style={{ gap: '8px' }}>
              <div class="chips">
                <button class="chip" aria-pressed={String(!d.palette)} onClick={() => setD({ palette: '' }, '색 조합')}>디자인 기본 색</button>
                {topPalettes(d).map((s) => (
                  <button class="chip" aria-pressed={String(d.palette === s.id)} onClick={() => setD({ palette: s.id }, `색 조합 ${s.name_ko}`)}>
                    <span aria-hidden="true" class="dots">{[s.light.background, s.light.primary, s.light.accent].map((c) => <i style={{ background: c }} />)}</span>{s.name_ko}
                  </button>
                ))}
              </div>
              <select value={d.palette || ''} onChange={(e) => setD({ palette: e.target.value }, '색 조합')} aria-label="모든 색 조합">
                <option value="">모든 색 조합 {E.PALETTE_SEEDS.length}가지에서 고르기</option>
                {E.PALETTE_SEEDS.map((s) => <option value={s.id}>{s.name_ko}</option>)}
              </select>
            </div>
          </Field>
          <div class="field"><span>기관 색(강조색)</span>
            <div class="row">
              {d.accent ? <><input type="color" value={d.accent} onInput={(e) => setD({ accent: e.target.value })} aria-label="강조색" style={{ width: '64px', height: '44px', padding: '2px' }} /><button class="btn btn-sm btn-quiet" onClick={() => setD({ accent: '' })}>디자인 색으로 돌리기</button></>
                : <><span class="swatch-empty" aria-hidden="true">없음</span><button class="btn btn-sm" onClick={() => setD({ accent: '#5B49B0' })}>기관 색 고르기</button></>}
            </div>
            <small>글자가 잘 보이게 밝기를 자동으로 맞춰요.</small>
          </div>
          <Field label="첫 화면 그래픽">
            <select value={d.graphic === undefined ? '' : d.graphic === '' ? 'none' : d.graphic} onChange={(e) => setD({ graphic: e.target.value === '' ? undefined : e.target.value === 'none' ? '' : e.target.value }, '첫 화면 그래픽')}>
              <option value="">{`디자인 기본${resolved.graphic ? `(${E.FX.find((f) => f.id === resolved.graphic)?.name_ko || resolved.graphic})` : ''}`}</option>
              {graphics.map((g) => <option value={g.id}>{g.name_ko}{g.level >= 3 ? ' (화려)' : ''}</option>)}
              <option value="none">그래픽 없음</option>
            </select>
          </Field>
          <div class="field"><span>대표 효과</span>
            <div class="row"><b>{E.FX.find((f) => f.id === (d.signature || resolved.signature))?.name_ko || '없음'}</b>{!d.signature && <span class="small muted">디자인 기본</span>}
              <button class="btn btn-sm" onClick={() => setFxOpen(true)}>움직이는 모습 보고 고르기</button>
              {d.signature && <button class="btn btn-sm btn-quiet" onClick={() => setD({ signature: '' })}>디자인 기본으로</button>}</div>
            <small>사이트 전체에서 하나만 두드러지게 써요.</small>
          </div>
          {adv && <p class="small muted">적용된 효과(고급): {Object.entries(resolved.effects || {}).map(([k, v]) => `${k}=${v}`).join(', ') || '없음'}</p>}
        </div>
      </details>
      <Dialog open={fxOpen} onClose={() => setFxOpen(false)} label="대표 효과 고르기" wide>
        {fxOpen && <div class="stack"><div class="stack" style={{ gap: '4px' }}><h2 class="h-sub">대표 효과 고르기</h2><p class="small muted">카드를 누르면 크게 보고 고를 수 있어요.</p></div>
          <FxGallery only={(f) => f.level >= 2} picked={d.signature || resolved.signature} onUse={(f) => { setD({ signature: f.id }, `대표 효과 ${f.name_ko}`); setFxOpen(false); }} /></div>}
      </Dialog>
    </div>
  );
}

/** 디자인 컨셉: 이 연수가 참가자에게 주는 경험 한 줄과 화면에 되풀이되는 그림. 디자인·움직임·구성이 여기서 출발함. 강사가 고칠 수 있음 */
function ConceptCard({ bp, concept, update, setD }) {
  const [edit, setEdit] = useState(false);
  const d = bp.design || {};
  const by = { ai: 'AI가 교재를 읽고 세웠어요', teacher: '직접 정한 컨셉이에요', auto: '주제에서 자동으로 세웠어요' }[concept.source] || '';
  const setC = (patch) => update((cur) => ({ blueprint: { ...cur.blueprint, concept: { ...concept, ...patch, source: 'teacher' } } }));
  const reset = () => update((cur) => ({ blueprint: { ...cur.blueprint, concept: E.deriveConcept({ title: cur.blueprint.meta?.title, subtitle: cur.blueprint.meta?.subtitle, topics: cur.blueprint.design?.topics || [], archetype: cur.blueprint.archetype?.primary, admin: cur.blueprint.meta?.admin?.kind }) } }));
  const lead = concept.preset && concept.preset !== d.preset ? E.getPreset(concept.preset) : null;
  return (
    <div class="concept">
      <p class="concept-k"><span>디자인 컨셉</span>{by && <small>{by}</small>}</p>
      <p class="concept-idea">{concept.idea}</p>
      <p class="concept-why">{concept.motif && <b>모티프: {concept.motif}</b>}{concept.motif && concept.why ? ' · ' : ''}{concept.why}</p>
      <div class="btn-row">
        <button type="button" class="btn btn-sm" aria-expanded={String(edit)} onClick={() => setEdit(!edit)}>컨셉 고치기</button>
        {lead && <button type="button" class="btn btn-sm" onClick={() => setD({ preset: lead.id, seed: '' }, `디자인 ${lead.name_ko}`)}>{lead.name_ko} 쓰기</button>}
        {concept.source !== 'auto' && <button type="button" class="btn btn-sm btn-quiet" onClick={reset}>주제에서 다시 세우기</button>}
      </div>
      {edit && <div class="stack" style={{ gap: '10px' }}>
        <Field label="한 줄 컨셉" hint="이 연수에서 참가자가 겪을 경험을 한 문장으로 적어요."><input type="text" maxLength={90} value={concept.idea} onInput={(e) => setC({ idea: e.target.value })} /></Field>
        <Field label="모티프" hint="화면에 되풀이할 그림이나 은유(예: 번지는 물결, 펼친 교재)."><input type="text" maxLength={30} value={concept.motif || ''} onInput={(e) => setC({ motif: e.target.value })} /></Field>
      </div>}
    </div>
  );
}

/** 글꼴 조합 추천: 분위기가 맞는 순 */
function topFontPairs(d, preset, n = 5) {
  const moods = (d.mood && d.mood.length ? d.mood : preset.moods) || [];
  return E.FONT_PAIRS.map((f, i) => ({ f, i, s: (f.moods || []).filter((m) => moods.includes(m)).length }))
    .sort((a, b) => b.s - a.s || a.i - b.i).slice(0, n).map((x) => x.f);
}
const stackOf = (k) => (E.FONTS[k] ? `'${E.FONTS[k].family}', ${E.FONTS[k].fallback || 'sans-serif'}` : 'inherit');

/** 글꼴: 실제 글꼴로 쓴 연수명을 보고 고름. 기본은 '디자인·교재에 맞춘 글꼴' */
function FontPicker({ d, resolved, setD, title }) {
  const preset = E.getPreset(resolved.preset);
  const auto = { ...(preset.fonts || {}), ...(resolved.fonts || {}) };
  const pairs = topFontPairs(d, preset);
  const cur = E.FONT_PAIR_BY_ID[d.fontPair];
  const list = cur && !pairs.includes(cur) ? [cur, ...pairs.slice(0, -1)] : pairs;
  useFontCss([E.FONTS[auto.display]?.css, E.FONTS[auto.body]?.css, ...list.flatMap((f) => [f.display.css, f.body.css])].filter(Boolean));
  const sample = title || '연수 제목';
  const card = (key, name, disp, body, pressed, onPick, note) => (
    <button type="button" class="font-card" aria-pressed={String(pressed)} onClick={onPick} key={key}>
      <span class="fc-title" style={{ fontFamily: disp.family, fontWeight: disp.weight || 700 }}>{sample}</span>
      <span class="fc-body" style={{ fontFamily: body.family }}>오늘 배운 것을 내일 수업에 바로 써요.</span>
      <span class="fc-cap"><b>{name}</b>{note && <small>{note}</small>}</span>
    </button>
  );
  const label = (k) => E.FONTS[k]?.label || k;
  const autoName = resolved.fontMatch && d.fontFrom !== 'preset' && Object.values(resolved.fontMatch).some((m) => !m.system) ? '교재 글꼴 따르기' : '디자인에 맞춘 글꼴';
  return (
    <div class="field"><span>글꼴</span>
      <SourceFonts d={d} resolved={resolved} setD={setD} />
      <div class="font-cards" role="group" aria-label="글꼴 고르기">
        {card('auto', autoName, { family: stackOf(auto.display), weight: E.FONTS[auto.display]?.displayWeight || auto.displayWeight }, { family: stackOf(auto.body) }, !d.fontPair, () => setD({ fontPair: '' }, '글꼴'), [...new Set([label(auto.display), label(auto.body)])].join(' · '))}
        {list.map((f) => card(f.id, f.name_ko, { family: f.display.stack || `'${f.display.family}', sans-serif`, weight: f.display.weight }, { family: f.body.stack || `'${f.body.family}', sans-serif` }, d.fontPair === f.id, () => setD({ fontPair: f.id }, `글꼴 ${f.name_ko}`), [...new Set([f.display.family, f.body.family])].join(' · ')))}
      </div>
      <select value={d.fontPair || ''} onChange={(e) => setD({ fontPair: e.target.value }, '글꼴')} aria-label="모든 글꼴 조합">
        <option value="">모든 글꼴 조합 {E.FONT_PAIRS.length}가지에서 고르기</option>
        {E.FONT_PAIRS.map((f) => <option value={f.id}>{f.name_ko} — {f.note_ko}</option>)}
      </select>
    </div>
  );
}

/** 교재 글꼴 한 줄: "교재 글꼴 나눔스퀘어 · 맑은 고딕 → 사이트 나눔스퀘어 · Pretendard" + 따를지 고르기 */
function SourceFonts({ d, resolved, setD }) {
  const src = d.sourceFonts; if (!src || !(src.display?.name || src.body?.name)) return null;
  const fm = E.fontsFromSource ? E.fontsFromSource(src) : null;
  const usable = fm && Object.keys(fm.fonts).length > 0; // 맑은 고딕 같은 기본 글꼴뿐이면 고를 게 없음
  const mode = d.fontPair ? 'pair' : d.fontFrom === 'preset' ? 'preset' : 'material';
  const pf = E.getPreset(resolved.preset)?.fonts || {};
  const label = (k) => E.FONTS[k]?.label || '';
  const uniq = (a) => [...new Set(a.filter(Boolean))].join(' · ');
  const fp = E.FONT_PAIR_BY_ID[d.fontPair];
  const site = mode === 'pair' && fp ? [fp.display.family, fp.body.family]
    : mode === 'material' && fm ? [label(fm.fonts.display || pf.display), label(fm.fonts.body || pf.body)]
      : [label(pf.display), label(pf.body)];
  return (
    <div class="src-fonts">
      <p class="small">교재 <b>{uniq([src.display?.name, src.body?.name])}</b> → 사이트 <b>{uniq(site)}</b></p>
      {usable ? <Seg label="교재 글꼴" value={mode === 'pair' ? '' : mode} onChange={(v) => setD({ fontFrom: v, fontPair: '' })} options={[{ value: 'material', label: '교재 글꼴 따르기' }, { value: 'preset', label: '디자인 글꼴' }]} />
        : mode !== 'pair' && <small class="muted">교재가 프로그램 기본 글꼴(맑은 고딕 등)이라 디자인에 맞춘 글꼴을 써요.</small>}
    </div>
  );
}

/** 갤러리(낱말 사전)에서 담아 둔 낱말: 이 연수에 한 번에 적용 */
function BasketNote({ p, update, remember }) {
  const [basket, setBasket] = useBasket();
  // 둘러보기에서 담아 새 연수를 만들었으면 그 낱말이 연수에 남아 있음: AI가 요청을 다 따르지 않았을 때 덜 맞은 것만 보여 줌
  const own = useMemo(() => (p.designWords || []).filter((id) => wordById(id) && changes(p.blueprint, id)), [p.designWords, p.blueprint]);
  const ids = basket.length ? basket : own;
  if (!ids.length) return null;
  const clear = () => (basket.length ? setBasket([]) : update({ designWords: [] }));
  const apply = () => { remember('담은 낱말 적용'); update((cur) => ({ blueprint: applyWords(cur.blueprint, ids), ...(basket.length ? {} : { designWords: [] }) })); if (basket.length) setBasket([]); toast('담은 낱말을 적용했어요. 마음에 안 들면 [되돌리기]를 누르세요.'); };
  return (
    <div class="word-note" role="region" aria-label="담아 둔 낱말">
      <p><b>{basket.length ? '디자인 둘러보기에서 담은 낱말' : '만들 때 고른 낱말 중 아직 반영되지 않은 것'}</b><br />{changesLine(ids)}</p>
      <div class="btn-row"><button type="button" class="btn btn-sm btn-primary" onClick={apply}>모두 적용하기</button><button type="button" class="btn btn-sm btn-quiet" onClick={clear}>{basket.length ? '비우기' : '그대로 두기'}</button></div>
    </div>
  );
}

/** 본문 배치: 섹션마다 지금 배치와 쓸 수 있는 다른 배치. 바꾸면 미리보기가 그 섹션으로 옮겨 가요 */
function BodyWords({ p, update, remember, labels }) {
  const bp = p.blueprint;
  const v = useMemo(() => E.validate(bp).blueprint, [bp]);
  const rows = useMemo(() => (v.sections || []).filter((s) => hasVariants(s.type)).map((s) => {
    const cur = currentVariant(v, s); const opts = variantOptions(v, s);
    return { s, cur, opts, plan: opts.find((o) => o.plan) };
  }).filter((r) => r.opts.length > 1), [v]);
  if (!rows.length) return null;
  const set = (s, val, name) => {
    remember(`${typeKo(s.type)} 배치`);
    update((cur) => ({ blueprint: { ...cur.blueprint, sections: cur.blueprint.sections.map((x) => (x.id === s.id ? { ...x, layout: val || undefined } : x)) } }));
    focusSection(p.id, s.id);
    if (name) toast(`${typeKo(s.type)}: ${name}`);
  };
  return (
    <details class="body-words">
      <summary>본문 배치 <span class="small muted">섹션 {rows.length}곳</span></summary>
      <p class="small muted" style={{ marginTop: '8px' }}>섹션마다 그리는 모양을 바꿔요. 내용에 맞는 배치만 보여요.</p>
      <label class="check" style={{ marginTop: '6px' }}><input type="checkbox" checked={labels} onChange={(e) => setLabels(p.id, e.currentTarget.checked)} /><span>미리보기에 배치 이름 보기</span></label>
      <ul class="bw-list">
        {rows.map(({ s, cur, opts, plan }) => {
          const own = typeof s.layout === 'string' && opts.some((o) => o.v === s.layout.split('@')[0]) ? s.layout.split('@')[0] : '';
          const now = opts.find((o) => o.v === (own || cur.variant));
          const label = `${typeKo(s.type)}${s.title ? ` · ${String(s.title).slice(0, 14)}` : ''}`;
          return (
            <li>
              <span class="bw-sec">{typeKo(s.type)}</span>
              <select aria-label={`${label} 배치`} value={own} onChange={(e) => { const val = e.currentTarget.value; set(s, val, val ? opts.find((o) => o.v === val)?.name : ''); }}>
                <option value="">디자인 기본{plan ? `: ${plan.name}` : ''}</option>
                {opts.map((o) => <option value={o.v}>{o.name} · {LEAD_KO[o.lead]}</option>)}
              </select>
              <button type="button" class="btn btn-sm btn-quiet" onClick={() => focusSection(p.id, s.id)} aria-label={`${label} 미리보기에서 보기`}>보기</button>
              {now && <small>{now.when}</small>}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
