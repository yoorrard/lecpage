import { useEffect, useMemo, useState } from 'preact/hooks';
import { Field, Seg } from '../../components/ui.jsx';
import { TASTES, inTaste } from '../../lib/tastes.js';
import { E } from '../../lib/engine.js';
import { SiteThumb } from '../../components/SiteThumb.jsx';
import { FxGallery } from '../../components/FxGallery.jsx';
import { Dialog } from '../../components/ui.jsx';
import { isAdvanced } from './Content.jsx';

const MOTION = ['정적', '차분하게', '보통', '스크롤 연출'];
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
  const ranked = useMemo(() => E.rankPresets({ moods: d.mood || [], topics: d.topics || [], archetype: bp.archetype?.primary, admin: bp.meta?.admin?.kind, minor: bp.audience?.minor }, 4), [(d.mood || []).join(), (d.topics || []).join(), bp.archetype?.primary]);
  const setD = (patch) => update((cur) => ({ blueprint: { ...cur.blueprint, _presetAuto: false, design: { ...(cur.blueprint.design || {}), ...patch } } }));
  const resolved = E.resolveDesign(E.validate(bp).blueprint);
  const others = E.PRESETS.filter((x) => !ranked.some((r) => r.id === x.id));
  const graphics = E.FX.filter((f) => (f.slots || []).includes('hero.graphic'));
  const adv = isAdvanced();
  const title = bp.meta?.title || '';
  const [fxOpen, setFxOpen] = useState(false);
  const [taste, setTaste] = useState('all');
  const whyText = (r) => ((r.why || []).length ? `어울리는 이유: ${r.why.map(whyKo).join(', ')}` : '');
  return (
    <div class="stack">
      <div class="field"><span>추천 디자인</span>
        <div class="thumbs">{ranked.map((r) => <Thumb preset={E.getPreset(r.id)} bp={bp} pressed={d.preset === r.id} why={whyText(r)} onPick={() => setD({ preset: r.id, seed: '' })} />)}</div>
      </div>
      <details>
        <summary>다른 디자인 {others.length}가지 더 보기</summary>
        <div style={{ marginTop: '10px' }}><Seg label="분위기" value={taste} onChange={setTaste} options={TASTES} /></div>
        <div class="thumbs" style={{ marginTop: '10px' }}>{others.filter((pr) => inTaste(pr, taste)).map((pr) => <Thumb preset={pr} bp={bp} pressed={d.preset === pr.id} onPick={() => setD({ preset: pr.id, seed: '' })} />)}</div>
      </details>
      <FontPicker d={d} resolved={resolved} setD={setD} title={title} />
      <Field label="밝기"><Seg label="밝기" value={d.theme || 'preset'} onChange={(v) => setD({ theme: v })} options={[{ value: 'preset', label: '디자인대로' }, { value: 'light', label: '밝게' }, { value: 'dark', label: '어둡게' }, { value: 'auto', label: '기기 설정 따라' }]} /></Field>
      <Field label="페이지 연출" hint={`${MOTION_DESC[d.motion ?? resolved.motion]} ${resolved._notes?.find((n) => /크롬북|네트워크|공식/.test(n)) || '실습·질문 화면은 늘 차분하게 유지돼요.'}`}>
        <Seg label="페이지 연출" value={String(d.motion ?? resolved.motion)} onChange={(v) => setD({ motion: +v })} options={MOTION.map((label, i) => ({ value: String(i), label }))} />
      </Field>
      <div class="btn-row"><button class="btn btn-sm" onClick={() => setD({ seed: Math.random().toString(36).slice(2, 7) })}>다른 느낌으로 다시 뽑기</button><span class="small muted">내용은 그대로, 효과 조합만 바꿔요. <a href="#/gallery" target="_blank" rel="noopener">디자인·효과 둘러보기</a></span></div>
      <details>
        <summary>더 바꾸기: 색·기관 색·첫 화면 그래픽</summary>
        <div class="stack" style={{ marginTop: '12px' }}>
          <Field label="색 조합" hint="모양과 움직임은 그대로, 색만 바꿔요. 모두 글자가 잘 보이는 조합이에요.">
            <div class="stack" style={{ gap: '8px' }}>
              <div class="chips">
                <button class="chip" aria-pressed={String(!d.palette)} onClick={() => setD({ palette: '' })}>디자인 기본 색</button>
                {topPalettes(d).map((s) => (
                  <button class="chip" aria-pressed={String(d.palette === s.id)} onClick={() => setD({ palette: s.id })}>
                    <span aria-hidden="true" class="dots">{[s.light.background, s.light.primary, s.light.accent].map((c) => <i style={{ background: c }} />)}</span>{s.name_ko}
                  </button>
                ))}
              </div>
              <select value={d.palette || ''} onChange={(e) => setD({ palette: e.target.value })} aria-label="모든 색 조합">
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
            <select value={d.graphic === undefined ? '' : d.graphic === '' ? 'none' : d.graphic} onChange={(e) => setD({ graphic: e.target.value === '' ? undefined : e.target.value === 'none' ? '' : e.target.value })}>
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
          <FxGallery only={(f) => f.level >= 2} picked={d.signature || resolved.signature} onUse={(f) => { setD({ signature: f.id }); setFxOpen(false); }} /></div>}
      </Dialog>
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
      <span class="fc-body" style={{ fontFamily: body.family }}>오늘 배운 것을 내일 수업에 바로 씁니다.</span>
      <span class="fc-cap"><b>{name}</b>{note && <small>{note}</small>}</span>
    </button>
  );
  const label = (k) => E.FONTS[k]?.label || k;
  const autoName = resolved.fontMatch && d.fontFrom !== 'preset' && Object.values(resolved.fontMatch).some((m) => !m.system) ? '교재 글꼴 따르기' : '디자인에 맞춘 글꼴';
  return (
    <div class="field"><span>글꼴</span>
      <SourceFonts d={d} resolved={resolved} setD={setD} />
      <div class="font-cards" role="group" aria-label="글꼴 고르기">
        {card('auto', autoName, { family: stackOf(auto.display), weight: E.FONTS[auto.display]?.displayWeight || auto.displayWeight }, { family: stackOf(auto.body) }, !d.fontPair, () => setD({ fontPair: '' }), [...new Set([label(auto.display), label(auto.body)])].join(' · '))}
        {list.map((f) => card(f.id, f.name_ko, { family: f.display.stack || `'${f.display.family}', sans-serif`, weight: f.display.weight }, { family: f.body.stack || `'${f.body.family}', sans-serif` }, d.fontPair === f.id, () => setD({ fontPair: f.id }), [...new Set([f.display.family, f.body.family])].join(' · ')))}
      </div>
      <select value={d.fontPair || ''} onChange={(e) => setD({ fontPair: e.target.value })} aria-label="모든 글꼴 조합">
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
