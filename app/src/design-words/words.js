// 디자인 낱말: lecpage가 실제로 그리는 디자인 단위(디자인·첫 화면 배치·본문 배치·효과·움직임·밝기·색·글꼴)를
// 하나의 말로 묶습니다. 낱말마다 이름·언제 어울리는지·설계도에 바로 적용하는 법·요청 문장 조각이 있습니다.
// 갤러리(낱말 사전)·디자인 칸(말로 고치기)·체험·도움말이 같은 낱말을 씁니다. 엔진의 데이터만 읽고, AI는 쓰지 않습니다.
import * as E from '../../../skills/lecpage/engine/src/index.js';

export const KINDS = [
  { value: 'preset', label: '디자인' },
  { value: 'hero', label: '첫 화면 배치' },
  { value: 'body', label: '본문 배치' },
  { value: 'fx', label: '효과' },
  { value: 'motion', label: '움직임' },
  { value: 'color', label: '색·밝기' },
  { value: 'font', label: '글꼴' },
];
export const KIND_KO = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));

export const MOTION_KO = ['정적', '차분하게', '보통', '스크롤 연출'];
const MOTION_LOOK = ['움직임 없이 깔끔하게 보여 줘요.', '섹션이 나타날 때만 살짝 움직여요.', '제목·숫자·배경이 은은하게 움직여요.', '스크롤에 맞춰 장면이 바뀌어요.'];
const MOTION_WHEN = ['공문처럼 단정해야 하거나 오래된 기기가 많을 때', '교육청 승인 직무연수나 실습이 많은 연수', '대부분의 연수', '기조 강연·발표회처럼 보여 주는 자리'];

export const LEAD_KO = { text: '글', number: '숫자', figure: '그림', diagram: '도식', tool: '조작' };

const HERO = {
  left: { name: '왼쪽 정렬', look: '제목과 글이 왼쪽에서 시작해 가장 빨리 읽혀요.', when: '정보를 빨리 훑어야 하는 연수' },
  center: { name: '가운데 정렬', look: '모든 글이 가운데 축에 놓이고 본문도 가운데로 서요.', when: '한 문장 메시지가 중심인 마음·성찰 연수' },
  data: { name: '자료 그림', look: '일정이나 숫자로 그린 그림이 첫 화면을 채워요.', when: '시간과 자료가 이야기인 데이터·평가 연수' },
  split: { name: '반반 화면', look: '화면을 반으로 나눠 한쪽은 그림, 한쪽은 글이에요.', when: '그림과 글을 나란히 보일 창의·메이커 연수' },
  cover: { name: '그림 가득', look: '그림이 화면 위쪽을 채우고 제목 판이 그림에 걸쳐요.', when: '교재 표지나 발표 자료가 얼굴인 연수' },
  right: { name: '세로쓰기', look: '제목을 세로로 쓰고 글은 오른쪽에 맞춰요.', when: '글과 여백이 주인공인 국어·독서·역사 연수' },
  offset: { name: '어긋난 격자', look: '격자 위에 계단처럼 어긋난 큰 제목이 색면에 걸쳐요.', when: '단정하면서도 힘 있는 정책·설명회' },
};
export const HERO_ORDER = ['left', 'center', 'data', 'split', 'cover', 'right', 'offset'];

const THEME = {
  light: { name: '밝게', look: '밝은 바탕에 어두운 글자예요.', when: '밝은 교실·인쇄해 나눌 때' },
  dark: { name: '어둡게', look: '어두운 바탕에 밝은 글자예요.', when: '어두운 강당·발표 화면' },
  auto: { name: '기기 설정 따라', look: '참가자 기기의 밝기 설정을 따라요.', when: '참가자 기기가 저마다 다를 때' },
};

/** 프리셋 설명을 '생김새'와 '어울리는 자리'로 나눔(설명 끝의 "…연수에." 문장이 자리) */
function splitDesc(desc) {
  const parts = String(desc || '').split(/(?<=\.)\s+/).filter(Boolean);
  const k = parts.map((s) => /에\.$/.test(s)).lastIndexOf(true);
  if (k < 0) return { look: desc, when: '' };
  return { look: parts.filter((_, i) => i !== k).join(' '), when: parts[k].replace(/에\.$/, '') };
}
const SLOT_KO = { 'hero.title': '첫 화면 제목', 'hero.graphic': '첫 화면 배경', 'hero.cta': '시작 버튼', 'section.title': '섹션 제목', 'section.enter': '섹션이 나타날 때', divider: '구분 띠', cards: '카드', list: '목록', numbers: '숫자', message: '핵심 메시지', schedule: '일정표', gallery: '사진', progress: '진행 표시', scroll: '스크롤', cursor: '마우스', celebrate: '완료했을 때', 'closing.title': '마무리 문장', 'closing.graphic': '마무리 배경' };
export const slotsKo = (f) => [...new Set((f.slots || []).map((s) => SLOT_KO[s] || s))].join(' · ');
const RENDERED = ['divider', 'message', 'hero.title', 'closing.title', 'section.title', 'cards', 'numbers', 'schedule', 'gallery', 'hero.cta', 'progress', 'celebrate', 'cursor'];

/** 배치의 '고르는 기준' 글(끝의 '(기본)'과 '기본'만 있는 것은 뺌) */
export const useText = (u) => { const t = String(u || '').replace(/\(기본\)$/, ''); return t === '기본' ? '' : t; };
/** 섹션 종류 이름(연수 후 안내는 자료와 같은 배치) */
export const typeKo = (t) => E.SECTION_DEFS[t]?.label || t;
const NO_VARIANT = new Set(['hero', 'stations', 'text', 'video', 'prompts', 'attendance']);
export const hasVariants = (type) => !NO_VARIANT.has(type) && !!E.BODY_VARIANTS[type === 'followup' ? 'materials' : type];
const vtype = (t) => (t === 'followup' ? 'materials' : t);

/** 이 배치를 기본으로 쓰는 디자인들 */
const usersOf = (() => {
  let m = null;
  return (type, v) => {
    if (!m) {
      m = new Map();
      for (const [pid, [, spec]] of Object.entries(E.PRESET_BODY)) for (const w of String(spec).split(/\s+/)) { const [t, rest = ''] = w.split(':'); const id = rest.split('@')[0]; const k = `${t}.${id}`; if (!m.has(k)) m.set(k, []); m.get(k).push(pid); }
    }
    return m.get(`${type}.${v}`) || [];
  };
})();

let cache = null;
/** 모든 낱말(한 번 만들어 둠) */
export function allWords() {
  if (cache) return cache;
  const out = [];
  for (const p of E.PRESETS) {
    const { look, when } = splitDesc(p.desc_ko);
    out.push({ id: `preset:${p.id}`, kind: 'preset', key: p.id, name: p.name_ko, look, when, tags: p.moods, layout: p.layout || 'left', showcase: !!p.showcase });
  }
  for (const k of HERO_ORDER) {
    const presets = E.PRESETS.filter((p) => (p.layout || 'left') === k).map((p) => p.id);
    out.push({ id: `hero:${k}`, kind: 'hero', key: k, ...HERO[k], presets });
  }
  for (const [type, vs] of Object.entries(E.BODY_VARIANTS)) {
    const def = E.defaultVariant(type);
    for (const [v, m] of Object.entries(vs)) {
      out.push({ id: `body:${type}.${v}`, kind: 'body', key: v, type, name: m.ko, section: typeKo(type), lead: m.lead, look: '', when: useText(m.use), isDefault: v === def, tags: m.tags, presets: usersOf(type, v) });
    }
  }
  for (const f of E.FX) {
    const slots = f.slots || [];
    const how = slots.includes('hero.graphic') ? 'graphic' : f.level >= 2 && slots.some((s) => RENDERED.includes(s)) ? 'signature' : slots.find((s) => RENDERED.includes(s)) ? 'slot' : '';
    out.push({ id: `fx:${f.id}`, kind: 'fx', key: f.id, name: f.name_ko, look: f.desc_ko, when: slotsKo(f), level: f.level, group: f.group, tags: f.moods, how });
  }
  // 빼는 낱말(사전에는 따로 보이지 않고 '말로 고치기'가 씀)
  out.push({ id: 'fx:-graphic', kind: 'fx', key: '', name: '첫 화면 그래픽 없음', look: '첫 화면 바탕의 움직이는 그림을 빼요.', when: '움직임이 산만해 보일 때', level: 0, how: 'graphic', off: true });
  MOTION_KO.forEach((name, i) => out.push({ id: `motion:${i}`, kind: 'motion', key: String(i), name, look: MOTION_LOOK[i], when: MOTION_WHEN[i], level: i }));
  for (const [k, t] of Object.entries(THEME)) out.push({ id: `theme:${k}`, kind: 'color', sub: 'theme', key: k, ...t });
  for (const s of E.PALETTE_SEEDS) out.push({ id: `palette:${s.id}`, kind: 'color', sub: 'palette', key: s.id, name: s.name_ko, look: s.note_ko || '', when: (s.moods || []).map((m) => MOOD_KO[m]).filter(Boolean).join('·'), tags: s.moods, swatch: [s.light.background, s.light.primary, s.light.accent, s.dark.background] });
  for (const f of E.FONT_PAIRS) out.push({ id: `font:${f.id}`, kind: 'font', key: f.id, name: f.name_ko, look: f.note_ko || '', when: (f.moods || []).map((m) => MOOD_KO[m]).filter(Boolean).join('·'), tags: f.moods, pair: f });
  cache = out;
  return out;
}
export const MOOD_KO = { calm: '차분함', warm: '따뜻함', emotional: '감성', playful: '경쾌함', energetic: '활기', tech: '테크', futuristic: '미래적', editorial: '잡지풍', formal: '공식적', natural: '자연', retro: '레트로', minimal: '깔끔함', bold: '대담함', handmade: '손맛', data: '데이터' };
let byId = null;
export function wordById(id) {
  if (!byId) byId = new Map(allWords().map((w) => [w.id, w]));
  const m = /^accent:(#[0-9a-f]{6})$/i.exec(id || '');
  if (m && !byId.has(id)) byId.set(id, { id, kind: 'color', sub: 'accent', key: m[1], name: '강조색', look: '번호·링크·버튼에 쓰는 색이에요. 글자가 잘 보이게 밝기를 맞춰요.', when: '기관 색을 쓰고 싶을 때', swatch: [m[1]] });
  return byId.get(id);
}

/** 같은 자리를 바꾸는 낱말끼리는 하나만(디자인과 첫 화면 배치는 둘 다 디자인을 고르므로 한 자리) */
export function slotOf(id) {
  const w = wordById(id); if (!w) return id;
  if (w.kind === 'preset' || w.kind === 'hero') return 'look';
  if (w.kind === 'body') return `body:${w.type}`;
  if (w.kind === 'color') return w.sub;
  if (w.kind === 'fx') return w.how === 'graphic' ? 'fx:graphic' : w.how === 'signature' ? 'fx:signature' : `fx:${w.key}`;
  return w.kind;
}
/** 낱말 묶음에 하나 더 담기(같은 자리면 바꿈) */
export function addWord(ids, id) { const s = slotOf(id); return [...ids.filter((x) => slotOf(x) !== s), id]; }

// ── 적용 ──
const clone = (o) => JSON.parse(JSON.stringify(o));
const flowOf = (bp) => bp.structure?.flow || '';
const presetOf = (bp) => (E.PRESET_IDS.includes(bp.design?.preset) ? bp.design.preset : E.PRESETS[0].id);

/** 이 섹션에 이 배치를 쓸 수 있는지(내용이 배치의 그림을 정직하게 채울 수 있을 때만, 엔진의 variantOf가 판정) */
export function fits(bp, s, v, presetId = presetOf(bp)) {
  const t = { ...s, layout: v };
  const sections = (bp.sections || []).map((x) => (x === s ? t : x));
  return E.variantOf(t, presetId, { sections, flow: flowOf(bp) }).variant === v;
}
/** 섹션의 지금 배치 */
export function currentVariant(bp, s, presetId = presetOf(bp)) { return E.variantOf(s, presetId, { sections: bp.sections || [], flow: flowOf(bp) }); }

/** 첫 화면 배치 → 그 배치를 쓰는 디자인 가운데 지금 연수에 가장 맞는 것 */
export function presetForLayout(bp, layout) {
  const d = bp?.design || {};
  const ranked = E.rankPresets({ moods: d.mood || [], topics: d.topics || [], archetype: bp?.archetype?.primary, admin: bp?.meta?.admin?.kind }, E.PRESETS.length);
  const ok = ranked.filter((r) => (E.getPreset(r.id).layout || 'left') === layout);
  return (ok.find((r) => r.id !== d.preset) || ok[0])?.id || '';
}

/** 낱말들을 설계도에 바로 적용(새 설계도를 돌려줌). 적용할 수 없는 낱말은 건너뜀 */
export function applyWords(bp0, ids) {
  const bp = clone(bp0);
  const d = { ...(bp.design || {}) };
  for (const id of ids) {
    const w = wordById(id); if (!w) continue;
    if (w.kind === 'preset') { d.preset = w.key; d.seed = ''; }
    else if (w.kind === 'hero') { const p = (E.getPreset(d.preset).layout || 'left') === w.key ? d.preset : presetForLayout({ ...bp, design: d }, w.key); if (p) { d.preset = p; d.seed = ''; } }
    else if (w.kind === 'motion') d.motion = w.level;
    else if (w.kind === 'color' && w.sub === 'theme') d.theme = w.key;
    else if (w.kind === 'color' && w.sub === 'palette') d.palette = w.key;
    else if (w.kind === 'color' && w.sub === 'accent') d.accent = w.key;
    else if (w.kind === 'font') d.fontPair = w.key;
    else if (w.kind === 'fx') {
      const f = E.FX.find((x) => x.id === w.key);
      if (w.how === 'graphic') d.graphic = w.key;
      else if (w.how === 'signature') d.signature = w.key;
      else if (w.how === 'slot') d.effects = { ...(d.effects || {}), [(f.slots || []).find((s) => RENDERED.includes(s))]: w.key };
    }
  }
  bp.design = d;
  bp._presetAuto = false;
  const pid = presetOf(bp);
  for (const id of ids) {
    const w = wordById(id); if (!w || w.kind !== 'body') continue;
    bp.sections = (bp.sections || []).map((s) => (vtype(s.type) === w.type && hasVariants(s.type) && fits(bp, s, w.key, pid) ? { ...s, layout: w.key } : s));
  }
  return bp;
}
/** 이 설계도에 이 낱말을 적용하면 무엇이 바뀌는지(바뀌지 않으면 false) */
export function changes(bp, id) {
  const w = wordById(id); if (!w) return false;
  const d = bp.design || {};
  if (w.kind === 'preset') return d.preset !== w.key;
  if (w.kind === 'hero') return (E.getPreset(d.preset).layout || 'left') !== w.key && !!presetForLayout(bp, w.key);
  if (w.kind === 'motion') return E.resolveDesign(E.validate(bp).blueprint).motion !== w.level;
  if (w.kind === 'color' && w.sub === 'theme') return (d.theme || 'preset') !== w.key;
  if (w.kind === 'color' && w.sub === 'palette') return d.palette !== w.key;
  if (w.kind === 'color' && w.sub === 'accent') return String(d.accent || '').toLowerCase() !== w.key.toLowerCase();
  if (w.kind === 'font') return d.fontPair !== w.key;
  if (w.kind === 'fx' && w.off) return E.resolveDesign(E.validate(bp).blueprint).graphic !== '';
  if (w.kind === 'fx') return !!w.how;
  if (w.kind === 'body') return (bp.sections || []).some((s) => vtype(s.type) === w.type && hasVariants(s.type) && currentVariant(bp, s).variant !== w.key && fits(bp, s, w.key));
  return false;
}
/** 앱 안에서 AI 없이 적용할 수 있는 낱말인지 */
export const applicable = (id) => { const w = wordById(id); return !!w && (w.kind !== 'fx' || !!w.how); };

// ── 요청 문장 ──
/** 받침에 맞는 조사: josa('숲의 숨', '으로/로') → '으로'. 괄호로 끝나면 괄호 앞 낱말을 봄 */
export function josa(s, pair) {
  const t = String(s).trim().replace(/\s*\([^)]*\)$/, '');
  const c = t.charCodeAt(t.length - 1); const j = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0;
  const [a, b] = pair.split('/');
  return pair === '으로/로' ? (j > 0 && j !== 8 ? a : b) : (j > 0 ? a : b);
}
const q = (w) => `'${w.name}'`;
const THEME_LINE = { light: '화면은 밝게 해 주세요.', dark: '화면은 어둡게 해 주세요.', auto: '화면 밝기는 참가자 기기 설정을 따라 주세요.' };
/**
 * 고른 낱말로 요청 문장을 만듦. AI 만들기의 요청 사항이나 AI 도구(lecpage 스킬)에 그대로 붙여 넣어요.
 * 괄호 속 영문은 lecpage 스킬이 알아보는 이름(design.preset·섹션 layout 등)이에요.
 */
export function sentenceOf(ids) {
  const ws = ids.map(wordById).filter(Boolean);
  const one = (f) => ws.find(f);
  const lines = [];
  const look = one((w) => w.kind === 'preset');
  if (look) lines.push(`디자인은 ${q(look)}(${look.key})${josa(look.name, '으로/로')} 해 주세요.`);
  const hero = one((w) => w.kind === 'hero');
  if (hero) lines.push(`첫 화면은 ${q(hero)}(${hero.key})${josa(hero.name, '으로/로')} 놓아 주세요.`);
  const pal = one((w) => w.sub === 'palette');
  if (pal) lines.push(`색 조합은 ${q(pal)}(${pal.key})${josa(pal.name, '으로/로')} 해 주세요.`);
  const theme = one((w) => w.sub === 'theme');
  if (theme) lines.push(THEME_LINE[theme.key]);
  const accent = one((w) => w.sub === 'accent');
  if (accent) lines.push(`강조색은 ${accent.key} 색으로 해 주세요.`);
  const font = one((w) => w.kind === 'font');
  if (font) lines.push(`글꼴은 ${q(font)}(${font.key}) 짝으로 해 주세요.`);
  const mo = one((w) => w.kind === 'motion');
  if (mo) lines.push(`움직임은 ${q(mo)}(${mo.level}단계)${josa(mo.name, '으로/로')} 해 주세요.`);
  if (one((w) => w.id === 'fx:-graphic')) lines.push('첫 화면 그래픽은 빼 주세요.');
  const fx = ws.filter((w) => w.kind === 'fx' && !w.off);
  if (fx.length) lines.push(`효과는 ${fx.map((w) => `${q(w)}(${w.key})`).join(', ')}${josa(fx[fx.length - 1].name, '을/를')} 써 주세요.`);
  const body = ws.filter((w) => w.kind === 'body');
  if (body.length) lines.push(`본문은 ${body.map((w) => `${w.section}${josa(w.section, '을/를')} ${q(w)}(${w.type}:${w.key})`).join(', ')} 배치로 그려 주세요.`);
  return lines.join('\n');
}
/** 새 연수의 요청 사항 칸에 넣을 글(칸 길이 600자 안, 줄 단위로 자름) */
export function requestText(ids, max = 600) {
  const out = [];
  for (const line of sentenceOf(ids).split('\n')) { if ([...out, line].join('\n').length > max) break; out.push(line); }
  return out.join('\n');
}

/** 이 사이트에 지금 쓰인 낱말(디자인·첫 화면 배치·움직임·밝기·본문 배치) */
export function siteWords(bp) {
  const v = E.validate(bp).blueprint;
  const r = E.resolveDesign(v);
  const p = E.getPreset(r.preset);
  const out = [`preset:${p.id}`, `hero:${p.layout || 'left'}`, `motion:${r.motion}`];
  const body = [];
  for (const s of v.sections || []) {
    if (!hasVariants(s.type)) continue;
    const cv = currentVariant(v, s, p.id);
    if (cv.variant) body.push({ section: s, id: `body:${cv.type}.${cv.variant}` });
  }
  return { words: out, body, resolved: r, bp: v };
}

/** 이 섹션에 쓸 수 있는 배치(지금 것 포함, 디자인 기본 표시) */
export function variantOptions(bp, s) {
  const t = vtype(s.type); const all = E.BODY_VARIANTS[t]; if (!all) return [];
  const pid = presetOf(bp);
  const plan = E.variantOf({ ...s, layout: undefined }, pid, { sections: (bp.sections || []).map((x) => (x === s ? { ...s, layout: undefined } : x)), flow: flowOf(bp) }).variant;
  return Object.keys(all).filter((v) => fits(bp, s, v, pid)).map((v) => ({ v, id: `body:${t}.${v}`, name: all[v].ko, lead: all[v].lead, when: useText(all[v].use), plan: v === plan }));
}

/**
 * '배치 이름 보기': 섹션마다 왼쪽 위에 지금 배치 이름을 붙이는 CSS. 스크립트 없이 data-variant를 읽고,
 * <html class="lp-labels">일 때만 보여요(미리보기 안에서 켜고 끌 때 다시 그리지 않게).
 */
export function labelCss() {
  const rules = [];
  for (const [type, vs] of Object.entries(E.BODY_VARIANTS)) {
    const sel = type === 'closing' ? ['.lp-closing'] : type === 'materials' ? ['.lp-sec-materials', '.lp-sec-followup'] : [`.lp-sec-${type}`];
    for (const [v, m] of Object.entries(vs)) rules.push(`${sel.map((s) => `html.lp-labels ${s}[data-variant="${v}"]::after`).join(',')}{content:"${typeKo(type)} · ${m.ko} · ${LEAD_KO[m.lead]}"}`);
  }
  return `${rules.join('')}html.lp-labels .lp-sec[data-variant]::after,html.lp-labels .lp-closing[data-variant]::after{position:absolute;left:12px;top:12px;z-index:40;max-width:calc(100% - 24px);padding:6px 11px;border-radius:6px;background:#1C1A19;color:#fff;font:600 15px/1.35 system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;letter-spacing:0;text-align:left;pointer-events:none;box-shadow:0 0 0 2px #fff}`;
}
