// 디자인을 취향(분위기)으로 묶어 보여 주기. 디자인의 앞 두 분위기를 대표로 봅니다.
export const TASTES = [
  { value: 'all', label: '전체' },
  { value: 'live', label: '그래픽·모션', showcase: true }, // 그림·움직임·반응이 화면에 든 디자인(프리셋의 showcase)
  { value: 'calm', label: '차분·미니멀', moods: ['calm', 'minimal', 'natural'] },
  { value: 'warm', label: '따뜻·감성', moods: ['warm', 'emotional', 'handmade'] },
  { value: 'pro', label: '전문·공식', moods: ['formal', 'editorial', 'tech'] },
  { value: 'play', label: '발랄·경쾌', moods: ['playful', 'retro', 'energetic'] },
  { value: 'bold', label: '강렬·실험', moods: ['bold', 'futuristic'] },
];
export function inTaste(preset, value) {
  const t = TASTES.find((x) => x.value === value);
  if (t && t.showcase) return !!preset.showcase;
  if (!t || !t.moods) return true;
  return (preset.moods || []).slice(0, 2).some((m) => t.moods.includes(m));
}

/** 보여 주는 순서: 그래픽·모션 디자인을 앞에서부터 하나 걸러 하나씩 섞음(첫 줄부터 여러 모양이 보이게). 엔진의 프리셋 순서와 추천 점수는 그대로 둠 */
export function mixOrder(presets) {
  const a = presets.filter((p) => p.showcase), b = presets.filter((p) => !p.showcase), out = [];
  while (a.length || b.length) { if (a.length) out.push(a.shift()); if (b.length) out.push(b.shift()); }
  return out;
}
/** 추천 n개: 주제·분위기 점수 순 그대로. 그 안에 그래픽·모션 디자인이 없으면 마지막 한 자리만 점수가 가장 높은 그래픽·모션 디자인으로 바꿈 */
export function recommend(ranked, isShowcase, n = 4) {
  const top = ranked.slice(0, n);
  if (top.some((r) => isShowcase(r.id))) return top;
  const s = ranked.find((r) => isShowcase(r.id) && r.score > 0);
  return s ? [...top.slice(0, n - 1), s] : top;
}
