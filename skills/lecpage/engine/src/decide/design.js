// 디자인 결정: 분위기·주제·유형·대상·환경 → 프리셋 순위, 슬롯별 효과, 그래픽, 모션 상한
import { PRESETS, getPreset } from '../design/presets.js';
import { FX } from '../design/fx-catalog.js';

const byId = new Map(FX.map((f) => [f.id, f]));
export function fxInfo(id) { return byId.get(id); }

function hashSeed(s) { let h = 2166136261 >>> 0; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }

/** 프리셋 점수 매기기 → 상위 n개 */
export function rankPresets({ moods = [], topics = [], archetype = 'story', admin = 'school', minor = false } = {}, n = 3) {
  const scored = PRESETS.map((p) => {
    let score = 0; const why = [];
    const mm = p.moods.filter((m) => moods.includes(m)); if (mm.length) { score += mm.length * 3; why.push(`분위기(${mm.join(', ')})`); }
    const tt = p.topics.filter((t) => topics.includes(t)); if (tt.length) { score += tt.length * 2; why.push(`주제(${tt.join(', ')})`); }
    if (p.archetypes.includes(archetype)) { score += 2; why.push('사이트 유형'); }
    if (admin === 'official' && p.moods.includes('formal')) score += 3;
    if (admin === 'conference' && p.archetypes.includes('live')) score += 1;
    if (minor && p.moods.includes('playful')) score += 1;
    return { id: p.id, name_ko: p.name_ko, score, why };
  });
  scored.sort((a, b) => b.score - a.score || PRESETS.findIndex((p) => p.id === a.id) - PRESETS.findIndex((p) => p.id === b.id));
  return scored.slice(0, n);
}

/** 환경에 따른 모션 상한 */
export function motionCap(audience = {}, admin = 'school', requested) {
  let cap = 3; const why = [];
  const devices = audience.devices || [];
  if (devices.includes('chromebook') || devices.includes('phone')) { cap = Math.min(cap, 2); why.push('크롬북·휴대폰 접속이 많아 화려 단계는 쓰지 않습니다.'); }
  if (audience.network === 'slow' || audience.network === 'restricted') { cap = Math.min(cap, 2); why.push('네트워크가 느리거나 제한적이라 무거운 효과를 뺍니다.'); }
  if (admin === 'official') { cap = Math.min(cap, 2); why.push('공식 행사라 화려 단계는 쓰지 않습니다.'); }
  if (Number.isFinite(requested)) cap = Math.min(cap, requested);
  return { cap, why };
}

function fits(f, { cap, noLibs }) { return f && f.level <= cap && !(noLibs && f.libs && f.libs.length); }

function candidatesFor(slot, { moods, topics, cap, noLibs }) {
  return FX.filter((f) => (f.slots || []).includes(slot) && fits(f, { cap, noLibs }))
    .map((f) => ({ f, s: (f.moods || []).filter((m) => moods.includes(m)).length * 2 + (f.topics || []).filter((t) => topics.includes(t)).length + (f.trend === 'up' ? 0.5 : 0) - (f.trend === 'warn' ? 0.5 : 0) }))
    .sort((a, b) => b.s - a.s).map((x) => x.f.id);
}

/**
 * 프리셋의 기본 효과를 출발점으로, 상한·라이브러리 제한에 맞게 바꾸고,
 * seed로 일부 슬롯을 변주해 같은 프리셋이라도 연수마다 다르게 보이게 합니다.
 */
export function chooseEffects({ presetId, moods = [], topics = [], cap = 3, noLibs = false, seed = '', overrides = {} } = {}) {
  const p = getPreset(presetId);
  const effects = {}; const notes = [];
  const ctx = { moods: moods.length ? moods : p.moods, topics: topics.length ? topics : p.topics, cap, noLibs };
  const h = hashSeed(seed + p.id);
  for (const [slot, id] of Object.entries(p.effects)) {
    const f = byId.get(id);
    if (fits(f, ctx)) { effects[slot] = id; continue; }
    const alt = candidatesFor(slot, ctx)[0];
    if (alt) { effects[slot] = alt; notes.push(`${slot}: ${id} → ${alt}`); }
  }
  // 변주: 제목 효과와 섹션 진입 효과를 후보 중에서 고름(시드 고정 → 같은 연수는 늘 같은 결과)
  for (const [i, slot] of ['hero.title', 'section.title', 'cards'].entries()) {
    const list = candidatesFor(slot, ctx).slice(0, 3);
    if (list.length > 1 && ((h >> (i * 3)) & 3) === 0) effects[slot] = list[(h >> (i * 5)) % list.length];
  }
  const graphicList = candidatesFor('hero.graphic', ctx);
  let graphic = p.graphic;
  if (graphic && !fits(byId.get(graphic), ctx)) graphic = graphicList[0] || '';
  let closingGraphic = p.closingGraphic;
  if (closingGraphic && !fits(byId.get(closingGraphic), ctx)) closingGraphic = candidatesFor('closing.graphic', ctx)[0] || '';
  let signature = p.signature;
  if (!fits(byId.get(signature), ctx)) signature = '';
  Object.assign(effects, Object.fromEntries(Object.entries(overrides).filter(([, v]) => !v || fits(byId.get(v), ctx))));
  for (const [k, v] of Object.entries(effects)) if (!v) delete effects[k];
  return { effects, graphic, closingGraphic, signature, notes, alternatives: { graphic: graphicList.slice(0, 6), title: candidatesFor('hero.title', ctx).slice(0, 6) } };
}

/** 설계도의 design을 완성 */
export function resolveDesign(bp) {
  const d = bp.design || {};
  const preset = getPreset(d.preset);
  const { cap, why } = motionCap(bp.audience, bp.meta?.admin?.kind, d.motion);
  const motion = Math.min(cap, d.motion ?? preset.motion);
  const noLibs = bp.audience?.network === 'restricted';
  const chosen = chooseEffects({ presetId: preset.id, moods: d.mood || [], topics: d.topics || [], cap: motion, noLibs, seed: (bp.meta?.title || '') + (d.seed || ''), overrides: d.effects || {} });
  const effects = { ...chosen.effects };
  const signature = d.signature || chosen.signature;
  const sig = byId.get(signature);
  if (sig && fits(sig, { cap: motion, noLibs }) && !(sig.slots || []).includes('scroll') && !Object.values(effects).includes(signature)) {
    const RENDERED = ['divider', 'message', 'hero.title', 'closing.title', 'section.title', 'cards', 'numbers', 'schedule', 'gallery', 'hero.cta', 'progress', 'celebrate', 'cursor'];
    const slot = (sig.slots || []).find((x) => RENDERED.includes(x));
    if (slot) effects[slot] = signature;
  }
  return {
    ...d, preset: preset.id, motion,
    graphic: d.graphic !== undefined ? (fits(byId.get(d.graphic), { cap: motion, noLibs }) ? d.graphic : '') : chosen.graphic,
    closingGraphic: d.closingGraphic !== undefined ? d.closingGraphic : chosen.closingGraphic,
    signature: sig && fits(sig, { cap: motion, noLibs }) ? signature : '',
    effects,
    _notes: [...why, ...chosen.notes],
  };
}
