import { useEffect, useMemo, useState } from 'preact/hooks';
import { Seg, Dialog } from '../components/ui.jsx';
import { FxLive, FX_GROUPS } from '../components/FxGallery.jsx';
import { E } from '../lib/engine.js';
import { loadExample, newProject } from '../lib/project.js';
import { projects } from '../lib/db.js';
import { pushUndoFor } from '../lib/undo.js';
import { copy, toast, fmtDate } from '../lib/util.js';
import { TASTES, inTaste, mixOrder } from '../lib/tastes.js';
import { allWords, wordById, KINDS, applyWords, addWord, sentenceOf, requestText, siteWords, presetForLayout, typeKo, LEAD_KO, MOTION_KO } from '../design-words/words.js';
import { SayFix, changesLine } from '../design-words/SayFix.jsx';
import { SAYINGS, useLine } from '../design-words/symptoms.js';
import { MiniSite } from '../design-words/MiniSite.jsx';
import { LiveSite } from '../design-words/LiveSite.jsx';
import { useBasket } from '../design-words/basket.js';
import bodyAll from '../../../skills/lecpage/engine/test/fixtures/body-all.blueprint.json';

// 디자인 둘러보기 = lecpage의 디자인 낱말 사전.
// 낱말마다 실제 엔진이 그린 화면 조각, 언제 어울리는지 한 줄, [담기]. 담은 낱말은 내 연수에 바로 적용하거나 요청 문장으로 써요.
const SAMPLES = [{ value: 'sel-story', label: '사회정서학습 연수' }, { value: 'data-lab', label: '디지털 연수' }];
const LV = ['늘 켜짐', '차분', '보통', '화려'];
const GROUP_OF = (f) => (f.group === 'lib' ? 'scroll' : f.group);
const fontLabel = (k) => E.FONTS[k]?.label || '';
const ENTER_KO = { rise: '떠오름', fade: '번짐', side: '옆에서', wipe: '왼쪽부터 펼침', clip: '위에서 펼침', scale: '살짝 커짐', drop: '내려앉음', flip: '넘어옴' };
/** 본문 연출 한 줄: 섹션이 들어오는 방식(겹치지 않게) */
const enterLine = (p) => [...new Set(Object.values(E.presetPlan(p).enter))].map((m) => ENTER_KO[m] || m).slice(0, 4).join('·');
const shortName = (n) => String(n).replace(/\s*\(.*$/, '');
const SHORT = { goals: '목표', glance: '숫자', message: '메시지', steps5: '단계', outline: '차례', schedule: '일정', tools: '도구', materials: '자료', instructor: '강사', speakers: '연사', sessions: '차시', faq: '질문과 답', glossary: '용어', procedure: '절차', cases: '사례', discuss: '나눌 질문', table: '표', closing: '마무리', readiness: '준비', deck: '교재', qa: '질문', quiz: '퀴즈', reflection: '기록', survey: '설문', board: '보드', poll: '투표', gallery: '사진' };

/** 본문 배치 사전용 예시: 모든 섹션 종류가 든 설계도(엔진 시험이 모든 배치가 맞는지 지키는 것) + 따라 하는 칸(디지털 연수 예시) */
function specimenOf(dataLab) {
  const tools = (dataLab?.sections || []).filter((s) => ['readiness', 'deck', 'poll', 'qa', 'board', 'quiz', 'reflection', 'survey'].includes(s.type));
  const s = bodyAll.sections;
  return E.validate({ ...bodyAll, sections: [...s.slice(0, -1), ...tools, s[s.length - 1]] }).blueprint;
}
/** 이 설계도에서 그 섹션 종류의 첫 칸 */
const sectionOf = (bp, type) => (bp.sections || []).find((s) => s.type === type || (type === 'materials' && s.type === 'followup'));
/** 본문 배치 낱말 → 예시 설계도(그 칸만 그 배치로, 디자인은 고른 것 또는 그 배치를 쓰는 디자인) */
function bodyBp(spec, w, presetPick) {
  const sec = sectionOf(spec, w.type); if (!sec) return null;
  const preset = presetPick || w.presets[0] || spec.design.preset;
  return { bp: { ...spec, design: { ...spec.design, preset }, sections: spec.sections.map((s) => (s === sec ? { ...s, layout: w.key } : s)) }, focus: sec.id, preset };
}
/** 디자인 카드의 본문 한 줄: 그림·도식이 주인공인 배치를 먼저, 셋까지 */
function bodyLine(sample, presetId) {
  const sw = siteWords(applyWords(sample, [`preset:${presetId}`]));
  const ws = sw.body.map((x) => ({ x, w: wordById(x.id) })).filter((o) => o.w && !o.w.isDefault);
  ws.sort((a, b) => (['diagram', 'figure'].includes(b.w.lead) ? 1 : 0) - (['diagram', 'figure'].includes(a.w.lead) ? 1 : 0));
  return ws.slice(0, 3).map((o) => `${SHORT[o.w.type] || o.w.section} ${shortName(o.w.name)}`).join(' · ');
}
const kicker = (w) => {
  if (w.kind === 'preset') return `${wordById(`hero:${w.layout}`)?.name || '왼쪽 정렬'}${w.showcase ? ' · 그림 첫 화면' : ''}`;
  if (w.kind === 'hero') return `첫 화면 배치 · 디자인 ${w.presets.length}가지`;
  if (w.kind === 'body') return `${w.section} · 주인공 ${LEAD_KO[w.lead]}${w.isDefault ? ' · 기본' : ''}`;
  if (w.kind === 'fx') return `${{ text: '글자', scroll: '스크롤', lib: '스크롤', interaction: '반응', graphic: '배경' }[w.group] || ''} · ${LV[w.level] || ''}`;
  if (w.kind === 'motion') return `움직임 ${w.level}단계`;
  if (w.kind === 'color') return w.sub === 'theme' ? '밝기' : '색 조합';
  return '글꼴 짝';
};
/** "…때" → "…때 좋아요.", "…연수" → "…연수에 좋아요." */
const suit = (t) => (/때$/.test(t) ? `${t} 좋아요.` : `${t}에 좋아요.`);
const whenText = (w) => {
  if (w.kind === 'body') return useLine(w.when);
  if (w.kind === 'fx') return `쓰는 곳: ${w.when}`;
  if (w.kind === 'preset' || w.kind === 'hero') return w.when ? `${w.when}에 어울려요.` : w.look;
  if (w.kind === 'motion' || (w.kind === 'color' && w.sub === 'theme')) return `${w.look} ${suit(w.when)}`;
  return w.look || w.when;
};

const loadedFonts = new Set();
function useFontCss(urls, on) {
  useEffect(() => {
    if (!on) return;
    for (const u of urls) {
      if (!u || loadedFonts.has(u) || !/^https:\/\/(fonts\.googleapis\.com|cdn\.jsdelivr\.net|hangeul\.pstatic\.net)\//.test(u)) continue;
      loadedFonts.add(u); const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = u; document.head.appendChild(l);
    }
  }, [on, urls.join('|')]);
}
function FontArt({ w, title }) {
  const f = w.pair; const [on, setOn] = useState(false);
  useFontCss([f.display.css, f.body.css], on);
  return (
    <div class="word-art" ref={(el) => { if (el && !on) { const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { rootMargin: '200px' }); io.observe(el); } }}>
      <span class="word-font"><b style={{ fontFamily: f.display.stack || `'${f.display.family}', sans-serif`, fontWeight: f.display.weight || 700 }}>{title}</b><span style={{ fontFamily: f.body.stack || `'${f.body.family}', sans-serif` }}>오늘 배운 것을 내일 수업에 바로 써요.</span></span>
    </div>
  );
}

/** 낱말의 실제 모습(카드 위쪽) */
function WordArt({ w, sample, spec, bodyPreset }) {
  if (w.kind === 'fx') return <FxLive id={w.key} />;
  if (w.kind === 'motion') return <div class="word-art" aria-hidden="true"><span class="motion-art" data-lv={w.level}><i /><i /><i />{w.level >= 2 && <b>90분</b>}</span></div>;
  if (w.kind === 'color' && w.sub === 'palette') return <div class="word-art" aria-hidden="true"><span class="word-swatch">{w.swatch.map((c) => <i style={{ background: c }} />)}</span></div>;
  if (w.kind === 'font') return <FontArt w={w} title={sample?.meta?.title || '연수 제목'} />;
  if (w.kind === 'body') { const b = spec && bodyBp(spec, w, bodyPreset); return b ? <MiniSite bp={b.bp} focus={b.focus} /> : <div class="word-art" />; }
  return sample ? <MiniSite bp={applyWords(sample, [w.id])} tour /> : <div class="word-art" />;
}

function WordCard({ w, sample, spec, bodyPreset, line, inBasket, onToggle, onOpen }) {
  return (
    <article class={`word-card${inBasket ? ' is-in' : ''}`}>
      <WordArt w={w} sample={sample} spec={spec} bodyPreset={bodyPreset} />
      <div class="word-body">
        <span class="word-kicker">{kicker(w)}</span>
        <button type="button" class="word-open word-name" onClick={() => onOpen(w)}>{w.name}</button>
        <span class="word-when">{whenText(w)}</span>
        {line && <span class="thumb-body"><b>본문</b> {line}</span>}
        <button type="button" class="btn btn-sm word-add" aria-pressed={String(inBasket)} aria-label={`${w.name} ${inBasket ? '빼기' : '담기'}`} onClick={() => onToggle(w)}>{inBasket ? '담았어요' : '담기'}</button>
      </div>
    </article>
  );
}

export function Gallery({ tab: tab0 }) {
  const [sampleId, setSampleId] = useState('sel-story');
  const [samples, setSamples] = useState({});
  const [kind, setKindRaw] = useState(() => (KINDS.some((k) => k.value === tab0) ? tab0 : 'preset'));
  const [taste, setTaste] = useState('all');
  const [secType, setSecType] = useState('all');
  const [bodyPreset, setBodyPreset] = useState('');
  const [fxGroup, setFxGroup] = useState('all');
  const [fxLv, setFxLv] = useState('all');
  const [open, setOpen] = useState(null);
  const [big, setBig] = useState(false);
  const [ids, setIds] = useBasket();
  const [showSentence, setShowSentence] = useState(false);
  const [pick, setPick] = useState(null); // 내 연수 고르기: null | [] | [연수…]
  useEffect(() => {
    let off = false;
    Promise.all(SAMPLES.map((s) => loadExample(s.value))).then((list) => { if (!off) setSamples(Object.fromEntries(list.map((b, i) => [SAMPLES[i].value, E.validate(b).blueprint]))); });
    return () => { off = true; };
  }, []);
  const sample = samples[sampleId];
  const spec = useMemo(() => (samples['data-lab'] ? specimenOf(samples['data-lab']) : null), [samples['data-lab']]);
  const setKind = (v) => { setKindRaw(v); try { history.replaceState(null, '', `#/gallery/${v}`); } catch { } };
  const words = allWords().filter((w) => !w.off);
  const count = (k) => words.filter((w) => w.kind === k).length;
  const list = useMemo(() => {
    let l = words.filter((w) => w.kind === kind);
    if (kind === 'preset') { const order = mixOrder(E.PRESETS).map((p) => p.id); l = order.map((id) => l.find((w) => w.key === id)).filter((w) => w && inTaste(E.getPreset(w.key), taste)); }
    if (kind === 'body' && secType !== 'all') l = l.filter((w) => w.type === secType);
    if (kind === 'fx') l = l.filter((w) => (fxGroup === 'all' || GROUP_OF(w) === fxGroup) && (fxLv === 'all' || String(w.level) === fxLv));
    return l;
  }, [kind, taste, secType, fxGroup, fxLv]);
  const lines = useMemo(() => (kind === 'preset' && sample ? Object.fromEntries(E.PRESETS.map((p) => [p.id, bodyLine(sample, p.id)])) : {}), [kind, sample]);
  const has = (id) => ids.includes(id);
  const toggle = (w) => { if (has(w.id)) setIds(ids.filter((x) => x !== w.id)); else { setIds(addWord(ids, w.id)); toast(`담았어요: ${w.name}`); } };
  const composed = useMemo(() => (sample ? applyWords(sample, ids) : null), [sample, ids.join()]);
  async function openPick() { const all = (await projects.all()).filter((x) => x.blueprint); setPick(all); }
  /** 첫째 길: 요청 문장을 새 연수의 요청 사항에 넣고 교재 넣기로. 낱말은 연수에 함께 두어, 만든 뒤 [디자인] 탭에서 덜 맞은 것만 바로 맞춤 */
  async function makeNew() {
    const p = await newProject('blank');
    await projects.put({ ...p, info: { ...p.info, request: requestText(ids) }, designWords: ids });
    setIds([]);
    toast('요청 사항에 넣었어요. 교재를 넣고 [AI로 사이트 만들기]를 누르세요.');
    location.hash = `#/p/${p.id}/1`;
  }
  async function applyTo(p) {
    pushUndoFor(p.id, '담은 낱말 적용', p);
    await projects.put({ ...p, blueprint: applyWords(p.blueprint, ids) });
    setIds([]); setPick(null);
    toast('적용했어요. 마음에 안 들면 [되돌리기]를 누르세요.');
    location.hash = `#/p/${p.id}/2`;
  }
  const sentence = sentenceOf(ids);
  return (
    <div class="stack gallery">
      <div class="step-head"><div class="step-head-t"><h1>디자인 둘러보기</h1><p>lecpage가 쓰는 디자인 낱말 {words.length}개를 실제 화면으로 봐요. 담은 낱말은 AI로 만들 때 요청 사항이 되고, 만든 연수에는 바로 적용돼요.</p></div></div>

      <div class="dict-intro">
        <div class="dict-say">
          <SayFix bp={composed || sample || null} hTag="h2" idp="dsay" title="말로 찾기" desc="바라는 느낌이나 아쉬운 점을 적으면 맞는 낱말을 찾아 예시로 보여 줘요." sayings={SAYINGS}
            onApply={(f) => { let next = ids; for (const id of f.ids) next = addWord(next, id); setIds(next); }}
            isDone={(f) => f.ids.every(has)} onUndo={(f) => setIds(ids.filter((x) => !f.ids.includes(x)))} words={{ apply: '담기', done: '담았어요', undo: '빼기' }} />
        </div>
        <section class="dict-now" aria-labelledby="dnow-h">
          <div class="spread"><h2 id="dnow-h" class="h-sub">{ids.length ? `담은 낱말로 본 예시` : '예시 연수'}</h2><Seg label="예시 내용" value={sampleId} onChange={setSampleId} options={SAMPLES} /></div>
          {composed ? <MiniSite bp={composed} eager tour live /> : <span class="mini-site" style={{ aspectRatio: '1.6', display: 'block' }} />}
          <div class="spread"><p class="small muted">{ids.length ? changesLine(ids) : '낱말을 담으면 이 화면이 바로 바뀌어요.'}</p><button type="button" class="btn btn-sm" disabled={!composed} onClick={() => setBig(true)}>움직이는 모습 보기</button></div>
        </section>
      </div>

      <div class="dict-tabs">
        <Seg label="낱말 종류" value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k.value, label: `${k.label} ${count(k.value)}` }))} />
      </div>
      <div class="dict-sub">
        {kind === 'preset' && <Seg label="분위기" value={taste} onChange={setTaste} options={TASTES} />}
        {kind === 'body' && <>
          <label>섹션<select value={secType} onChange={(e) => setSecType(e.currentTarget.value)}><option value="all">모든 섹션</option>{Object.keys(E.BODY_VARIANTS).map((t) => <option value={t}>{typeKo(t)}</option>)}</select></label>
          <label>보여 줄 디자인<select value={bodyPreset} onChange={(e) => setBodyPreset(e.currentTarget.value)}><option value="">그 배치를 쓰는 디자인</option>{E.PRESETS.map((p) => <option value={p.id}>{p.name_ko}</option>)}</select></label>
          <span class="small muted">모든 섹션이 든 예시 연수로 보여 줘요.</span>
        </>}
        {kind === 'fx' && <>
          <Seg label="종류" value={fxGroup} onChange={setFxGroup} options={FX_GROUPS.map((g) => ({ value: g.value, label: g.value === 'all' ? '종류 전체' : g.label }))} />
          <Seg label="움직임 세기" value={fxLv} onChange={setFxLv} options={[{ value: 'all', label: '세기 전체' }, { value: '1', label: '차분' }, { value: '2', label: '보통' }, { value: '3', label: '화려' }]} />
        </>}
        {kind === 'motion' && <span class="small muted">카드에 마우스를 올리면 단계만큼 움직여요. 누르면 예시 연수가 그 단계로 움직여요.</span>}
        {kind === 'hero' && <span class="small muted">첫 화면 배치는 디자인마다 정해져 있어요. 담으면 그 배치를 쓰는 디자인 가운데 가장 맞는 것을 골라요.</span>}
      </div>
      <div class="word-grid">
        {list.map((w) => <WordCard key={`${sampleId}-${w.id}-${bodyPreset}`} w={w} sample={sample} spec={spec} bodyPreset={bodyPreset} line={lines[w.key]} inBasket={has(w.id)} onToggle={toggle} onOpen={setOpen} />)}
        {!list.length && <p class="muted">이 조건에 맞는 낱말이 없어요.</p>}
      </div>
      <p class="small muted">모든 효과와 움직임은 기기의 '동작 줄이기' 설정과 사이트의 가벼운 모드를 따라요. 실습·질문·교재 화면은 늘 차분해요.</p>

      {ids.length > 0 && <aside class="basket" aria-label="담은 낱말">
        <div class="basket-row">
          <span class="basket-t"><b>담은 낱말 {ids.length}개</b> · {changesLine(ids)}</span>
          <span class="btn-row">
            <button type="button" class="btn btn-sm" aria-expanded={String(showSentence)} onClick={() => setShowSentence(!showSentence)}>{showSentence ? '문장 접기' : '요청 문장 보기'}</button>
            <button type="button" class="btn btn-sm btn-primary" onClick={makeNew}>요청 사항에 넣고 만들기</button>
            <button type="button" class="btn btn-sm" onClick={openPick}>만든 연수에 적용</button>
            <button type="button" class="btn btn-sm btn-quiet" onClick={() => setIds([])}>비우기</button>
          </span>
        </div>
        {showSentence && <>
          <div class="basket-list" role="group" aria-label="담은 낱말 빼기">{ids.map((id) => <button type="button" class="chip" onClick={() => setIds(ids.filter((x) => x !== id))} aria-label={`${wordById(id)?.name} 빼기`}>{wordById(id)?.name}<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>)}</div>
          <pre class="basket-sentence" aria-label="요청 문장">{sentence}</pre>
          <div class="btn-row"><button type="button" class="btn btn-sm" onClick={() => copy(sentence, '요청 문장을 복사했어요.')}>문장 복사</button><span class="small muted">AI 도구의 lecpage 스킬에 붙여 넣어도 그대로 맞춰요.</span></div>
        </>}
      </aside>}

      <Dialog open={!!open} onClose={() => setOpen(null)} label={open?.name || '낱말'} wide>
        {open && <WordDetail w={open} sample={sample} spec={spec} bodyPreset={bodyPreset} inBasket={has(open.id)} onToggle={() => toggle(open)} onClose={() => setOpen(null)} />}
      </Dialog>
      <Dialog open={big} onClose={() => setBig(false)} label="움직이는 모습" wide>
        {big && composed && <div class="stack"><LiveSite bp={composed} /><h2 class="h-sub">{ids.length ? '담은 낱말로 본 예시' : '예시 연수'}</h2><p class="small muted">{ids.length ? changesLine(ids) : '낱말을 담으면 이 화면이 바뀌어요.'} [배치 이름 보기]를 켜면 섹션마다 본문 배치 이름이 붙어요.</p></div>}
      </Dialog>
      <Dialog open={!!pick} onClose={() => setPick(null)} label="적용할 연수 고르기">
        {pick && <div class="stack">
          <h2 class="h-sub">어느 연수에 적용할까요?</h2>
          {pick.length ? <>
            <p class="small muted">{changesLine(ids)}</p>
            <ul class="proj-pick">{pick.map((p) => <li><button type="button" onClick={() => applyTo(p)}><b>{p.title || '이름 없는 연수'}</b><small>{fmtDate(p.updatedAt)} 고침 · 디자인 {E.getPreset(p.blueprint.design?.preset).name_ko}</small></button></li>)}</ul>
            <p class="small muted">적용한 뒤 [되돌리기]로 돌아갈 수 있어요.</p>
          </> : <>
            <p>아직 만든 연수가 없어요. 담은 낱말을 요청 사항에 넣고 새로 만들어요.</p>
            <div class="btn-row"><button type="button" class="btn btn-primary" onClick={makeNew}>요청 사항에 넣고 만들기</button></div>
          </>}
        </div>}
      </Dialog>
    </div>
  );
}

/** 낱말 크게 보기: 움직이는 실제 화면과 사실 몇 줄 */
function WordDetail({ w, sample, spec, bodyPreset, inBasket, onToggle, onClose }) {
  const body = w.kind === 'body' && spec ? bodyBp(spec, w, bodyPreset) : null;
  const bp = body ? body.bp : sample && !['fx', 'font'].includes(w.kind) && w.sub !== 'palette' ? applyWords(sample, [w.id]) : null;
  const p = w.kind === 'preset' ? E.getPreset(w.key) : null;
  const f = w.kind === 'fx' ? E.FX.find((x) => x.id === w.key) : null;
  return (
    <div class="stack">
      {w.kind === 'fx' ? <FxLive id={w.key} big /> : w.kind === 'font' || w.sub === 'palette' ? (sample && <MiniSite bp={applyWords(sample, [w.id])} eager />) : bp && <LiveSite bp={bp} focus={body?.focus || ''} title={`${w.name} 미리보기`} />}
      <div class="spread"><h2 class="h-sub">{w.name}</h2><span class="small muted">{kicker(w)}</span></div>
      <p>{whenText(w)}</p>
      {w.kind !== 'body' && w.look && !whenText(w).includes(w.look) && w.kind !== 'color' && <p class="small muted">{w.look}</p>}
      <dl class="fx-facts">
        {p && <>
          <div><dt>글꼴</dt><dd>{[...new Set([fontLabel(p.fonts?.display), fontLabel(p.fonts?.body)].filter(Boolean))].join(' · ')}</dd></div>
          <div><dt>첫 화면</dt><dd>{wordById(`hero:${p.layout || 'left'}`)?.name}</dd></div>
          <div><dt>움직임</dt><dd>{MOTION_KO[p.motion] || MOTION_KO[1]} · 섹션 등장 {enterLine(p)}</dd></div>
          {sample && <div><dt>본문</dt><dd>{siteWords(applyWords(sample, [w.id])).body.map((x) => { const v = wordById(x.id); return v ? `${SHORT[v.type] || v.section} ${shortName(v.name)}` : ''; }).filter(Boolean).join(' · ')}</dd></div>}
        </>}
        {w.kind === 'hero' && <div><dt>디자인</dt><dd>{w.presets.map((id) => E.getPreset(id).name_ko).join(' · ')}{sample ? ` (지금 예시에는 ${E.getPreset(presetForLayout(sample, w.key)).name_ko})` : ''}</dd></div>}
        {w.kind === 'body' && <>
          <div><dt>섹션</dt><dd>{w.section}</dd></div>
          <div><dt>주인공</dt><dd>{LEAD_KO[w.lead]}</dd></div>
          <div><dt>기본으로 쓰는 디자인</dt><dd>{w.presets.length ? w.presets.map((id) => E.getPreset(id).name_ko).join(' · ') : '없음(골라서 써요)'}</dd></div>
        </>}
        {f && <>
          <div><dt>쓰는 곳</dt><dd>{w.when}</dd></div>
          <div><dt>설명</dt><dd>{f.desc_ko}</dd></div>
          {f.a11y_ko && <div><dt>배려</dt><dd>{f.a11y_ko}</dd></div>}
          {!w.how && <div><dt>쓰는 법</dt><dd>디자인이 알맞은 자리에 알아서 써요. 담으면 요청 문장에 들어가요.</dd></div>}
        </>}
        {w.kind === 'font' && <div><dt>글꼴</dt><dd>{[...new Set([w.pair.display.family, w.pair.body.family])].join(' · ')}</dd></div>}
        {w.kind === 'color' && w.sub === 'palette' && w.when && <div><dt>분위기</dt><dd>{w.when}</dd></div>}
        <div><dt>요청 문장</dt><dd>{sentenceOf([w.id])}</dd></div>
      </dl>
      <div class="btn-row"><button type="button" class={`btn ${inBasket ? '' : 'btn-primary'}`} aria-pressed={String(inBasket)} onClick={onToggle}>{inBasket ? '담았어요(빼기)' : '담기'}</button><button type="button" class="btn btn-quiet" onClick={onClose}>닫기</button></div>
    </div>
  );
}
