// 디자인 결정: 분위기·주제·유형·대상·환경 → 프리셋 순위, 슬롯별 효과, 그래픽, 모션 상한
import { PRESETS, getPreset } from '../design/presets.js';
import { FX } from '../design/fx-catalog.js';
import { fontsFromSource, FONTS } from '../design/fonts.js';

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
  // 크롬북이 섞이면 스크롤 연출(3단계)은 쓰지 않음. 휴대폰만 섞였을 때는 기본은 2단계까지, 선생님이 3단계를 직접 고르면 허용(휴대폰·저사양 기기는 화면이 알아서 한 단계 낮춤)
  if (devices.includes('chromebook')) { cap = Math.min(cap, 2); why.push('크롬북 접속이 많아 스크롤 연출 단계는 쓰지 않습니다.'); }
  else if (devices.includes('phone') && requested !== 3) { cap = Math.min(cap, 2); why.push('휴대폰 접속이 많아 스크롤 연출 단계는 쓰지 않습니다.'); }
  else if (devices.includes('phone')) why.push('스크롤 연출을 골랐습니다. 휴대폰과 저사양 기기에서는 화면이 알아서 한 단계 낮춰 보여 줍니다.');
  if (audience.network === 'slow' || audience.network === 'restricted') { cap = Math.min(cap, 2); why.push('네트워크가 느리거나 제한적이라 무거운 효과를 뺍니다.'); }
  if (admin === 'official') { cap = Math.min(cap, 1); why.push('교육청 승인 직무연수라 움직임은 차분 단계까지만 씁니다.'); }
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
 * 프리셋의 기본 효과를 출발점으로, 상한·라이브러리 제한에 맞게 바꿉니다.
 * vary(다시 뽑기)면 seed로 첫 화면 제목 효과를 변주합니다.
 */
export function chooseEffects({ presetId, moods = [], topics = [], cap = 3, noLibs = false, seed = '', vary = false, variableDisplay = false, overrides = {} } = {}) {
  const p = getPreset(presetId);
  const effects = {}; const notes = [];
  const ctx = { moods: moods.length ? moods : p.moods, topics: topics.length ? topics : p.topics, cap, noLibs };
  const h = hashSeed(seed + p.id);
  for (const [slot, id] of Object.entries(p.effects)) {
    const f = byId.get(id);
    if (fits(f, ctx)) { effects[slot] = id; continue; }
    // 상한에 걸리면: 첫 화면 제목은 조용한 떠오르기로, 나머지는 같은 칸의 차분한 효과로(흐르는 것·주의 효과 제외)
    const alt = slot === 'hero.title' ? (fits(byId.get('reveal-up'), ctx) ? 'reveal-up' : '') : candidatesFor(slot, ctx).filter((x) => !byId.get(x)?.loop && byId.get(x)?.trend !== 'warn')[0];
    if (alt) effects[slot] = alt;
    notes.push(`${slot}: ${id}${alt ? ` → ${alt}` : ' 뺌'}`);
  }
  // 변주('다시 뽑기'로 design.seed를 줬을 때만): 첫 화면 제목 효과를 후보 중에서 고름(시드 고정 → 같은 시드는 늘 같은 결과).
  // 기본값은 프리셋이 정한 그대로 — 첫 화면 구성마다 어울리는 제목 효과를 골라 두었기 때문.
  // 섹션 제목·카드 효과는 변주하지 않음: 섹션마다 움직이는 제목과 기울어지는 카드는 흔한 생성 화면의 버릇이라서
  if (vary) {
    const list = candidatesFor('hero.title', ctx).filter((id) => byId.get(id)?.trend !== 'warn' && (id !== 'kinetic-weight' || variableDisplay)).slice(0, 3); // 그라데이션 글자·타자기 같은 '주의' 효과는 넣지 않음
    if (list.length > 1) effects['hero.title'] = list[h % list.length];
  }
  const graphicList = candidatesFor('hero.graphic', ctx);
  // 그래픽이 상한에 걸리면 다른 그림으로 바꾸지 않고 뺌: 첫 화면 구성마다 제 바탕(CSS)이 있어 엉뚱한 그림이 끼면 어색함
  let graphic = p.graphic;
  if (graphic && !fits(byId.get(graphic), ctx)) { notes.push(`첫 화면 그래픽: ${graphic} 뺌`); graphic = ''; }
  let closingGraphic = p.closingGraphic;
  if (closingGraphic && !fits(byId.get(closingGraphic), ctx)) closingGraphic = '';
  let signature = p.signature;
  if (!fits(byId.get(signature), ctx)) signature = '';
  Object.assign(effects, Object.fromEntries(Object.entries(overrides).filter(([, v]) => !v || fits(byId.get(v), ctx))));
  for (const [k, v] of Object.entries(effects)) if (!v) delete effects[k];
  return { effects, graphic, closingGraphic, signature, notes, alternatives: { graphic: graphicList.slice(0, 6), title: candidatesFor('hero.title', ctx).slice(0, 6) } };
}

/**
 * 프리셋 안의 글꼴 후보(기본 + fontAlts) 가운데 주제·분위기에 맞는 것을 고름.
 * 맞는 정도가 같으면 연수 제목으로 정해(같은 연수는 늘 같은 결과), 같은 프리셋이라도 연수마다 글꼴이 달라질 수 있음.
 * @returns {{display, body, mono?, index}|null} index 0은 프리셋 기본
 */
export function chooseFonts({ presetId, topics = [], moods = [], seed = '' } = {}) {
  const p = getPreset(presetId);
  const alts = [p.fonts, ...(p.fontAlts || [])];
  if (alts.length < 2) return null;
  const scored = alts.map((f, i) => ({ i, s: (f.topics || []).filter((t) => topics.includes(t)).length * 2 + (f.moods || []).filter((m) => moods.includes(m)).length }));
  // 대안은 주제가 맞거나 분위기가 둘 넘게 맞을 때만(점수 2 이상). 근거가 없으면 프리셋 기본 글꼴
  const best = Math.max(...scored.slice(1).map((x) => x.s));
  if (best < 2 || best <= scored[0].s) return { display: p.fonts.display, body: p.fonts.body, ...(p.fonts.mono ? { mono: p.fonts.mono } : {}), index: 0 };
  const pool = scored.slice(1).filter((x) => x.s === best);
  const pick = pool[hashSeed(seed + p.id + ':font') % pool.length].i;
  const f = alts[pick];
  return { display: f.display, body: f.body, ...(f.mono ? { mono: f.mono } : {}), ...(f.displayWeight ? { displayWeight: f.displayWeight } : {}), index: pick };
}

/** 첫 화면 칸: 여기에는 모션 단계가 허락하는 만큼 화려한 효과를 둘 수 있음 */
const HERO_SLOTS = ['hero.title', 'hero.cta', 'hero.graphic', 'hero.graphic.overlay'];
/** 마무리 칸: 화려(3단계)일 때만 첫 화면처럼 다룸 */
const CLOSING_SLOTS = ['closing.title', 'closing.graphic'];

/**
 * 대표 효과 예산: 1단계(차분)를 넘는 효과는 첫 화면과 대표 효과 하나에만 둡니다(스크롤 연출 단계면 마무리까지).
 * 나머지 칸은 같은 칸에 쓸 수 있는 1단계 효과로 바꾸거나 뺍니다. 실습형(lab)은 첫 화면 밖 전부가 1단계 이하입니다.
 * @returns {{effects, closingGraphic, signature, notes}}
 */
export function applyBudget({ effects = {}, closingGraphic = '', signature = '', motion = 2, archetype = 'story', moods = [], topics = [], noLibs = false, keep = [] } = {}) {
  const out = {}; const notes = [];
  const lab = archetype === 'lab';
  const sig = byId.get(signature);
  // 실습형: 대표 효과도 첫 화면 안에서 쓰는 것이 아니면 1단계 이하만
  const sigOk = !!sig && (sig.level <= 1 || !lab || keep.includes('signature'));
  const free = (slot) => HERO_SLOTS.includes(slot) || (motion >= 3 && !lab && CLOSING_SLOTS.includes(slot));
  const calm = (slot) => candidatesFor(slot, { moods, topics, cap: 1, noLibs }).filter((id) => byId.get(id)?.trend !== 'warn' && !byId.get(id)?.loop)[0] || '';
  for (const [slot, id] of Object.entries(effects)) {
    const f = byId.get(id);
    if (!f || f.level <= 1 || free(slot) || (sigOk && id === signature)) { out[slot] = id; continue; }
    const alt = calm(slot);
    if (alt) out[slot] = alt;
    notes.push(`${slot}: ${id}${alt ? ` → ${alt}` : ' 뺌'}(대표 효과 하나만 화려하게)`);
  }
  let cg = closingGraphic;
  const cgf = byId.get(cg);
  if (cgf && cgf.level > 1 && !free('closing.graphic') && !(sigOk && cg === signature)) {
    cg = candidatesFor('closing.graphic', { moods, topics, cap: 1, noLibs }).filter((id) => !byId.get(id)?.loop)[0] || '';
    notes.push(`마무리 그래픽: ${closingGraphic}${cg ? ` → ${cg}` : ' 뺌'}`);
  }
  return { effects: out, closingGraphic: cg, signature: sigOk ? signature : '', notes };
}

/** 설계도의 design을 완성 */
export function resolveDesign(bp) {
  const d = bp.design || {};
  const preset = getPreset(d.preset);
  const { cap, why } = motionCap(bp.audience, bp.meta?.admin?.kind, d.motion);
  const motion = Math.min(cap, d.motion ?? preset.motion);
  const noLibs = bp.audience?.network === 'restricted';
  const archetype = bp.archetype?.primary || 'story';
  const chosen = chooseEffects({ presetId: preset.id, moods: d.mood || [], topics: d.topics || [], cap: motion, noLibs, seed: (bp.meta?.title || '') + (d.seed || ''), vary: !!d.seed, variableDisplay: !!FONTS[d.fonts?.display || preset.fonts.display]?.variable, overrides: d.effects || {} });
  let effects = { ...chosen.effects };
  let signature = d.signature || chosen.signature;
  const sig = byId.get(signature);
  const sigFits = !!sig && fits(sig, { cap: motion, noLibs });
  // 대표 효과를 첫 화면 구성이 직접 쓰는 프리셋(유리 실험실의 조명, 놀이터의 흐르는 띠)은 다른 칸에 따로 붙이지 않음
  const inHero = preset.signatureIn === 'hero' && signature === preset.signature;
  if (sigFits && !inHero && !(sig.slots || []).includes('scroll') && !Object.values(effects).includes(signature)) {
    const RENDERED = ['divider', 'message', 'hero.title', 'closing.title', 'section.title', 'cards', 'numbers', 'schedule', 'gallery', 'hero.cta', 'progress', 'celebrate', 'cursor'];
    const slot = (sig.slots || []).find((x) => RENDERED.includes(x));
    if (slot) effects[slot] = signature;
  }
  // 선생님이 직접 고른 효과(design.effects)와 직접 고른 마무리 그래픽은 예산에서 빼고 그대로 둠
  const mine = Object.keys(d.effects || {}).filter((k) => d.effects[k]);
  const pool = Object.fromEntries(Object.entries(effects).filter(([k]) => !mine.includes(k)));
  const budget = applyBudget({ effects: pool, closingGraphic: d.closingGraphic !== undefined ? '' : chosen.closingGraphic, signature: sigFits ? signature : '', motion, archetype, moods: d.mood || preset.moods, topics: d.topics || preset.topics, noLibs, keep: inHero || d.signature ? ['signature'] : [] });
  effects = { ...budget.effects, ...Object.fromEntries(Object.entries(effects).filter(([k]) => mine.includes(k))) };
  signature = budget.signature;
  // 교재 글꼴: 선생님이 글꼴 짝이나 글꼴을 따로 고르지 않았으면 교재와 같은 글꼴(없으면 결이 비슷한 무료 글꼴)을 씀
  let fonts = d.fonts, fontMatch;
  const fontNotes = [];
  if (d.sourceFonts && d.fontFrom !== 'preset' && !d.fontPair) {
    const fm = fontsFromSource(d.sourceFonts);
    if (fm) {
      fontMatch = fm.match;
      if (!d.fonts && Object.keys(fm.fonts).length) fonts = { ...fm.fonts };
      for (const [role, m] of Object.entries(fm.match)) {
        fontNotes.push(`교재 ${role === 'display' ? '제목' : '본문'} 글꼴 "${m.from}" → ${m.system ? `프로그램 기본 글꼴이라 프리셋 글꼴 유지` : m.keep ? `알맞은 무료 글꼴을 찾지 못해 프리셋 글꼴 유지` : `${m.label}${m.exact ? '(같은 글꼴)' : '(비슷한 무료 글꼴)'}`}`);
      }
    }
  }
  // 글꼴을 따로 정하지 않았으면(교재 글꼴·글꼴 짝·직접 지정 없음) 주제·분위기에 맞춰 프리셋 안 후보에서 고름
  if (!fonts && !d.fontPair) {
    const cf = chooseFonts({ presetId: preset.id, topics: d.topics || [], moods: d.mood || [], seed: bp.meta?.title || '' }); // '다시 뽑기'(움직임)와 따로
    if (cf && cf.index > 0) { fonts = { display: cf.display, body: cf.body, ...(cf.mono ? { mono: cf.mono } : {}), ...(cf.displayWeight ? { displayWeight: cf.displayWeight } : {}) }; fontNotes.push(`주제·분위기에 맞춰 글꼴 후보 ${cf.index + 1}번`); }
  }
  return {
    ...d, preset: preset.id, motion, fonts, fontMatch,
    // 첫 화면 밖(본문)의 움직임 단계: 실습형은 차분(1)까지. 참가자 화면의 <html data-rest>가 됨(본문의 스크롤 연동 꾸밈은 이 값이 2 이상일 때만)
    rest: archetype === 'lab' ? Math.min(1, motion) : motion,
    graphic: d.graphic !== undefined ? (fits(byId.get(d.graphic), { cap: motion, noLibs }) ? d.graphic : '') : chosen.graphic,
    closingGraphic: d.closingGraphic !== undefined ? d.closingGraphic : budget.closingGraphic,
    signature,
    effects,
    _notes: [...why, ...chosen.notes, ...budget.notes, ...fontNotes],
  };
}
