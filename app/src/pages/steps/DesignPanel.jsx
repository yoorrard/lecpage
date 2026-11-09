import { useEffect, useMemo } from 'preact/hooks';
import { Field, Seg } from '../../components/ui.jsx';
import { E } from '../../lib/engine.js';
import { isAdvanced } from './Content.jsx';

const MOTION = ['움직임 없음', '차분하게', '보통', '화려하게'];
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

/** 프리셋을 실제 색·글꼴로 그린 작은 첫 화면(강사의 연수명으로) */
function Thumb({ preset, design, title, pressed, onPick, why }) {
  const pr = E.presetWithOverrides({ ...design, preset: preset.id, palette: pressed ? design.palette : '' });
  const theme = design.theme && design.theme !== 'preset' && design.theme !== 'auto' ? design.theme : pr.theme;
  const t = E.themeTokens(pr, theme === 'dark' ? 'dark' : 'light', { accent: pressed ? design.accent : '' });
  const font = E.FONTS[pr.fonts?.display]; const fpair = pressed ? E.FONT_PAIR_BY_ID[design.fontPair] : null;
  const family = fpair ? fpair.display.stack || `'${fpair.display.family}', sans-serif` : font ? `'${font.family}', ${font.fallback || 'sans-serif'}` : 'inherit';
  const style = { background: t['--background'], color: t['--foreground'], fontFamily: t['--font-sans'] };
  return (
    <button class="thumb" aria-pressed={String(pressed)} onClick={onPick} style={{ borderColor: pressed ? 'var(--line)' : undefined }}>
      <div class="thumb-art" style={style}>
        <span class="thumb-eyebrow" style={{ color: t['--muted-foreground'] }}>{preset.name_ko}</span>
        <span class="thumb-title" style={{ fontFamily: family, fontWeight: 700 }}>{title || '연수 제목'}</span>
        <span class="thumb-row"><i style={{ background: t['--primary'], color: t['--primary-foreground'] }}>시작하기</i><i style={{ background: t['--card'], border: `1px solid ${t['--border']}` }} /></span>
        <span class="thumb-dots">{[t['--primary'], t['--accent'], t['--accent-2']].map((c) => <b style={{ background: c }} />)}</span>
      </div>
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
  const ranked = useMemo(() => E.rankPresets({ moods: d.mood || [], topics: d.topics || [], archetype: bp.archetype?.primary, admin: bp.meta?.admin?.kind, minor: bp.audience?.minor }, 3), [(d.mood || []).join(), (d.topics || []).join(), bp.archetype?.primary]);
  const setD = (patch) => update((cur) => ({ blueprint: { ...cur.blueprint, _presetAuto: false, design: { ...(cur.blueprint.design || {}), ...patch } } }));
  const resolved = E.resolveDesign(E.validate(bp).blueprint);
  const others = E.PRESETS.filter((x) => !ranked.some((r) => r.id === x.id));
  useFontCss([...ranked.map((r) => E.FONTS[E.getPreset(r.id).fonts?.display]?.css), E.FONT_PAIR_BY_ID[d.fontPair]?.display?.css].filter(Boolean));
  const graphics = E.FX.filter((f) => (f.slots || []).includes('hero.graphic'));
  const signatures = E.FX.filter((f) => f.level >= 2);
  const adv = isAdvanced();
  const title = bp.meta?.title || '';
  const whyText = (r) => ((r.why || []).length ? `어울리는 이유: ${r.why.map(whyKo).join(', ')}` : '');
  return (
    <div class="stack">
      <div class="field"><span>추천 디자인 3가지</span>
        <div class="thumbs">{ranked.map((r) => <Thumb preset={E.getPreset(r.id)} design={d} title={title} pressed={d.preset === r.id} why={whyText(r)} onPick={() => setD({ preset: r.id, seed: '' })} />)}</div>
      </div>
      <details>
        <summary>다른 분위기 {others.length}가지 더 보기</summary>
        <div class="thumbs" style={{ marginTop: '10px' }}>{others.map((pr) => <Thumb preset={pr} design={d} title={title} pressed={d.preset === pr.id} onPick={() => setD({ preset: pr.id, seed: '' })} />)}</div>
      </details>
      <SourceFonts d={d} resolved={resolved} setD={setD} />
      <Field label="밝기"><Seg label="밝기" value={d.theme || 'preset'} onChange={(v) => setD({ theme: v })} options={[{ value: 'preset', label: '디자인대로' }, { value: 'light', label: '밝게' }, { value: 'dark', label: '어둡게' }, { value: 'auto', label: '기기 설정 따라' }]} /></Field>
      <Field label={`움직임: ${MOTION[d.motion ?? resolved.motion]}`} hint={resolved._notes?.find((n) => /크롬북|네트워크|공식/.test(n)) || '실습·질문 화면은 늘 차분하게 유지돼요. 참가자는 사이트에서 움직임을 끌 수 있어요.'}>
        <input class="range" type="range" min="0" max="3" step="1" value={d.motion ?? resolved.motion} onInput={(e) => setD({ motion: +e.target.value })} aria-valuetext={MOTION[d.motion ?? resolved.motion]} />
      </Field>
      <div class="btn-row"><button class="btn btn-sm" onClick={() => setD({ seed: Math.random().toString(36).slice(2, 7) })}>다른 느낌으로 다시 뽑기</button><span class="small muted">내용은 그대로, 움직임 조합만 바꿔요.</span></div>
      <details>
        <summary>더 바꾸기: 색·글꼴·첫 화면 그래픽</summary>
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
          <Field label="글꼴 직접 고르기" hint={E.FONT_PAIR_BY_ID[d.fontPair] ? `제목 ${E.FONT_PAIR_BY_ID[d.fontPair].display.family} · 본문 ${E.FONT_PAIR_BY_ID[d.fontPair].body.family}` : '제목과 본문 글꼴을 함께 바꿔요.'}>
            <select value={d.fontPair || ''} onChange={(e) => setD({ fontPair: e.target.value })}>
              <option value="">디자인 기본 글꼴</option>
              {E.FONT_PAIRS.map((f) => <option value={f.id}>{f.name_ko}</option>)}
            </select>
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
          <Field label="눈에 띄는 움직임 하나" hint="사이트 전체에서 하나만 두드러지게 써요.">
            <select value={d.signature || ''} onChange={(e) => setD({ signature: e.target.value })}>
              <option value="">{`디자인 기본${resolved.signature ? `(${E.FX.find((f) => f.id === resolved.signature)?.name_ko || resolved.signature})` : ''}`}</option>
              {signatures.map((g) => <option value={g.id}>{g.name_ko}</option>)}
            </select>
          </Field>
          {adv && <p class="small muted">적용된 효과(고급): {Object.entries(resolved.effects || {}).map(([k, v]) => `${k}=${v}`).join(', ') || '없음'}</p>}
        </div>
      </details>
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
    <div class="field"><span>글꼴</span>
      <p class="small">교재 <b>{uniq([src.display?.name, src.body?.name])}</b> → 사이트 <b>{uniq(site)}</b></p>
      {usable ? <Seg label="글꼴" value={mode === 'pair' ? '' : mode} onChange={(v) => setD({ fontFrom: v, fontPair: '' })} options={[{ value: 'material', label: '교재 글꼴 따르기' }, { value: 'preset', label: '디자인 글꼴' }]} />
        : mode !== 'pair' && <small>교재가 기본 글꼴이라 디자인 글꼴을 써요.</small>}
      {mode === 'pair' && <small>'더 바꾸기'에서 고른 글꼴을 쓰고 있어요.</small>}
    </div>
  );
}
