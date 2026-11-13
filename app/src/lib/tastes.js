// 디자인을 취향(분위기)으로 묶어 보여 주기. 디자인의 앞 두 분위기를 대표로 봅니다.
export const TASTES = [
  { value: 'all', label: '전체' },
  { value: 'live', label: '그래픽·모션', showcase: true }, // 그림·움직임·반응이 화면에 든 디자인(프리셋의 showcase)
  { value: 'layout', label: '색다른 배치', layout: true }, // 가운데·오른쪽·세로쓰기·어긋난 격자·반반 화면·그림 가득(프리셋의 layout)
  { value: 'calm', label: '차분·미니멀', moods: ['calm', 'minimal', 'natural'] },
  { value: 'warm', label: '따뜻·감성', moods: ['warm', 'emotional', 'handmade'] },
  { value: 'pro', label: '전문·공식', moods: ['formal', 'editorial', 'tech'] },
  { value: 'play', label: '발랄·경쾌', moods: ['playful', 'retro', 'energetic'] },
  { value: 'bold', label: '강렬·실험', moods: ['bold', 'futuristic'] },
];
/** 왼쪽 정렬이 아닌 글 배치인지 */
export const offLeft = (p) => !!p.layout && p.layout !== 'left';
export function inTaste(preset, value) {
  const t = TASTES.find((x) => x.value === value);
  if (t && t.showcase) return !!preset.showcase;
  if (t && t.layout) return offLeft(preset);
  if (!t || !t.moods) return true;
  return (preset.moods || []).slice(0, 2).some((m) => t.moods.includes(m));
}

/**
 * 보여 주는 순서: 그림이 이끌거나 배치가 색다른 디자인과 글 중심 디자인을 하나 걸러 하나씩 섞음(첫 줄부터 여러 모양이 보이게).
 * 앞쪽 묶음은 배치가 겹치지 않게 돌아가며 뽑음(가운데 → 자료 그림 → 반반 → 그림 가득 → 세로쓰기 → 어긋난 격자 → 왼쪽 그림 …).
 * 엔진의 프리셋 순서와 추천 점수는 그대로 둠
 */
export function mixOrder(presets) {
  const lead = presets.filter((p) => p.showcase || offLeft(p)), rest = presets.filter((p) => !p.showcase && !offLeft(p));
  const buckets = new Map();
  for (const p of lead) { const k = p.layout || 'left'; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(p); }
  const order = ['center', 'data', 'split', 'left', 'cover', 'right', 'offset'].filter((k) => buckets.has(k)).concat([...buckets.keys()].filter((k) => !['center', 'data', 'split', 'left', 'cover', 'right', 'offset'].includes(k)));
  const a = [];
  while (a.length < lead.length) for (const k of order) { const x = buckets.get(k).shift(); if (x) a.push(x); }
  const out = [];
  while (a.length || rest.length) { if (a.length) out.push(a.shift()); if (rest.length) out.push(rest.shift()); }
  return out;
}
/** 추천 n개: 주제·분위기 점수 순 그대로. 그 안에 그래픽·모션 디자인이 없으면 마지막 한 자리만 점수가 가장 높은 그래픽·모션 디자인으로 바꿈. first(컨셉이 권한 디자인)가 있으면 맨 앞에 둠 */
export function recommend(ranked, isShowcase, n = 4, first = '') {
  let list = ranked;
  if (first && ranked.some((r) => r.id === first)) list = [{ ...ranked.find((r) => r.id === first), concept: true }, ...ranked.filter((r) => r.id !== first)];
  const top = list.slice(0, n);
  if (top.some((r) => isShowcase(r.id))) return top;
  const s = list.find((r) => isShowcase(r.id) && r.score > 0);
  return s ? [...top.slice(0, n - 1), s] : top;
}

/** 프리셋의 대표 느낌 묶음(앞 두 분위기 가운데 먼저 맞는 것) */
export function feelOf(preset) {
  for (const m of (preset.moods || []).slice(0, 2)) { const t = TASTES.find((x) => x.moods?.includes(m)); if (t) return t; }
  return null;
}
/**
 * 느낌이 확실히 다른 세 안: 점수 순(컨셉이 권한 디자인이 맨 앞)으로 보되, 대표 느낌 묶음(차분·따뜻·전문·발랄·강렬)과 첫 화면 배치가 겹치지 않게 하나씩.
 * 묶음이 셋이 안 되면 배치만 다르게, 그래도 모자라면 점수 순으로 채움. ranked: rankPresets 결과(전체), get: getPreset
 */
export function threeFeelings(ranked, get, first = '') {
  const list = first && ranked.some((r) => r.id === first) ? [{ ...ranked.find((r) => r.id === first), concept: true }, ...ranked.filter((r) => r.id !== first)] : ranked;
  const out = [];
  const feel = (r) => feelOf(get(r.id))?.value || 'other';
  const lay = (r) => get(r.id).layout || 'left';
  const pass = (ok) => { for (const r of list) { if (out.length >= 3) return; if (!out.includes(r) && ok(r)) out.push(r); } };
  pass((r) => !out.some((o) => feel(o) === feel(r) || lay(o) === lay(r)));
  pass((r) => !out.some((o) => feel(o) === feel(r)));
  pass((r) => !out.some((o) => lay(o) === lay(r)));
  pass(() => true);
  return out.map((r) => ({ ...r, feel: feelOf(get(r.id))?.label || '' }));
}
