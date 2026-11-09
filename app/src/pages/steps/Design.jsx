import { useMemo } from 'preact/hooks';
import { StepHead, StepFoot } from '../Project.jsx';
import { Sheet, Field, Seg, Notice } from '../../components/ui.jsx';
import { Preview } from '../../components/Preview.jsx';
import { E } from '../../lib/engine.js';

function Swatch({ preset }) {
  const t = preset[preset.theme];
  return <div class="sw" aria-hidden="true">{[t.bg, t.primary, t.accent, t.accent2, t.fg].map((c) => <i style={{ background: c }} />)}</div>;
}

function topPalettes(d) {
  const moods = d.mood || [], topics = d.topics || [];
  return E.PALETTE_SEEDS.map((s) => ({ s, n: (s.moods || []).filter((m) => moods.includes(m)).length * 2 + (s.topics || []).filter((t) => topics.includes(t)).length }))
    .sort((a, b) => b.n - a.n).slice(0, 6).map((x) => x.s);
}

export function StepDesign({ p, update, go }) {
  const bp = p.blueprint;
  const d = bp?.design || {};
  const ranked = useMemo(() => (bp ? E.rankPresets({ moods: d.mood || [], topics: d.topics || [], archetype: bp.archetype?.primary, admin: bp.meta?.admin?.kind, minor: bp.audience?.minor }, 3) : []), [bp?.design?.mood?.join(), bp?.design?.topics?.join(), bp?.archetype?.primary]);
  if (!bp) return <><StepHead title="디자인" /><Notice>먼저 설계도를 만들어 주세요.</Notice><StepFoot go={go} prev={3} /></>;
  const setD = (patch) => update({ blueprint: { ...bp, _presetAuto: false, design: { ...d, ...patch } } });
  const resolved = E.resolveDesign(E.validate(bp).blueprint);
  const graphics = E.FX.filter((f) => (f.slots || []).includes('hero.graphic'));
  const signatures = E.FX.filter((f) => f.level >= 2);
  const presetIds = new Set(ranked.map((r) => r.id));
  return (
    <>
      <StepHead title="디자인을 골라요" desc="연수 주제와 분위기에 맞는 3안을 추천했어요. 고른 뒤 색·움직임·대표 효과를 바꿔 보세요. 오른쪽 미리보기에 바로 반영돼요." />
      <div class="design">
        <div class="stack">
          <Sheet>
            <div class="stack">
              <h2 style={{ fontSize: '1.2rem' }}>추천 3안</h2>
              <div class="grid">
                {ranked.map((r, i) => { const pr = E.getPreset(r.id); return (
                  <button class="card pick preset-card" aria-pressed={String(d.preset === r.id)} onClick={() => setD({ preset: r.id, seed: '' })}>
                    <Swatch preset={pr} />
                    <div class="pc-body"><b>{i + 1}안 · {pr.name_ko}</b><small>{pr.desc_ko}</small>{r.why.length > 0 && <small>맞는 점: {r.why.join(', ')}</small>}</div>
                  </button>); })}
              </div>
              <details><summary class="small">다른 프리셋 보기({E.PRESETS.length - ranked.length}개)</summary>
                <div class="grid" style={{ marginTop: '10px' }}>
                  {E.PRESETS.filter((x) => !presetIds.has(x.id)).map((pr) => (
                    <button class="card pick preset-card" aria-pressed={String(d.preset === pr.id)} onClick={() => setD({ preset: pr.id, seed: '' })}><Swatch preset={pr} /><div class="pc-body"><b>{pr.name_ko}</b><small>{pr.desc_ko}</small></div></button>
                  ))}
                </div>
              </details>
            </div>
          </Sheet>
          <Sheet fold={false}>
            <div class="stack">
              <h2 style={{ fontSize: '1.2rem' }}>세부 조정</h2>
              <Field label="밝기"><Seg label="밝기" value={d.theme || 'preset'} onChange={(v) => setD({ theme: v })} options={[{ value: 'preset', label: '프리셋대로' }, { value: 'light', label: '밝게' }, { value: 'dark', label: '어둡게' }, { value: 'auto', label: '기기 설정' }]} /></Field>
              <Field label={`움직임 ${['정지', '차분', '보통', '화려'][d.motion ?? resolved.motion]}`} hint={resolved._notes?.find((n) => /크롬북|네트워크|공식/.test(n)) || '실습·질문 화면은 늘 차분하게 유지돼요.'}>
                <input class="range" type="range" min="0" max="3" step="1" value={d.motion ?? resolved.motion} onInput={(e) => setD({ motion: +e.target.value })} />
              </Field>
              <Field label="색 조합" hint="프리셋의 모양·효과는 그대로 두고 색만 바꿔요. 모두 글자 대비를 검사한 조합이에요.">
                <div class="stack" style={{ gap: '8px' }}>
                  <div class="chips">
                    <button class="chip" aria-pressed={String(!d.palette)} onClick={() => setD({ palette: '' })}>프리셋 색</button>
                    {topPalettes(d).map((s) => (
                      <button class="chip" aria-pressed={String(d.palette === s.id)} onClick={() => setD({ palette: s.id })} title={s.name_ko}>
                        <span aria-hidden="true" style={{ display: 'inline-flex', gap: '2px' }}>{[s.light.background, s.light.primary, s.light.accent].map((c) => <i style={{ width: '12px', height: '12px', borderRadius: '50%', background: c, border: '1px solid var(--hair)', display: 'inline-block' }} />)}</span>{s.name_ko}
                      </button>
                    ))}
                  </div>
                  <select value={d.palette || ''} onChange={(e) => setD({ palette: e.target.value })} aria-label="모든 색 조합">
                    <option value="">모든 색 조합 {E.PALETTE_SEEDS.length}가지에서 고르기</option>
                    {E.PALETTE_SEEDS.map((s) => <option value={s.id}>{s.name_ko}</option>)}
                  </select>
                </div>
              </Field>
              <Field label="글꼴 짝" hint={E.FONT_PAIR_BY_ID[d.fontPair] ? `제목 ${E.FONT_PAIR_BY_ID[d.fontPair].display.family} · 본문 ${E.FONT_PAIR_BY_ID[d.fontPair].body.family}` : '제목과 본문 글꼴을 함께 바꿔요.'}>
                <select value={d.fontPair || ''} onChange={(e) => setD({ fontPair: e.target.value })}>
                  <option value="">프리셋 글꼴</option>
                  {E.FONT_PAIRS.map((f) => <option value={f.id}>{f.name_ko}</option>)}
                </select>
              </Field>
              <div class="row">
                <Field label="강조색"><input type="color" value={d.accent || '#5B49B0'} onInput={(e) => setD({ accent: e.target.value })} style={{ width: '64px', height: '44px', padding: '2px' }} /></Field>
                {d.accent && <button class="btn btn-sm btn-quiet" onClick={() => setD({ accent: '' })}>프리셋 색으로</button>}
              </div>
              <Field label="첫 화면 그래픽">
                <select value={d.graphic === undefined ? '' : d.graphic === '' ? 'none' : d.graphic} onChange={(e) => setD({ graphic: e.target.value === '' ? undefined : e.target.value === 'none' ? '' : e.target.value })}>
                  <option value="">{`프리셋 기본(${resolved.graphic || '없음'})`}</option>
                  {graphics.map((g) => <option value={g.id}>{g.name_ko} · {g.name_en}{g.level >= 3 ? ' (화려)' : ''}</option>)}
                  <option value="none">그래픽 없음</option>
                </select>
              </Field>
              <Field label="대표 효과(시그니처)" hint="사이트 전체에서 하나만 두드러지게 써요.">
                <select value={d.signature || ''} onChange={(e) => setD({ signature: e.target.value })}>
                  <option value="">{`프리셋 기본(${resolved.signature || '없음'})`}</option>
                  {signatures.map((g) => <option value={g.id}>{g.name_ko} · {g.name_en}</option>)}
                </select>
              </Field>
              <div class="btn-row"><button class="btn" onClick={() => setD({ seed: Math.random().toString(36).slice(2, 7) })}>스타일 다시 뽑기</button><span class="small muted">내용은 그대로 두고 제목·카드 효과 조합을 바꿔요.</span></div>
              <p class="small muted">적용된 효과: {Object.entries(resolved.effects || {}).map(([k, v]) => `${k}=${v}`).join(', ') || '없음'}</p>
            </div>
          </Sheet>
        </div>
        <Preview p={p} />
      </div>
      <StepFoot go={go} prev={4} next={6} nextLabel="다음: 운영 방식" />
    </>
  );
}
