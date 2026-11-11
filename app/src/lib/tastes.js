// 디자인을 취향(분위기)으로 묶어 보여 주기. 디자인의 앞 두 분위기를 대표로 봅니다.
export const TASTES = [
  { value: 'all', label: '전체' },
  { value: 'live', label: '움직이는 첫 화면', showcase: true }, // 그림·움직임·반응이 첫 화면에 든 디자인(프리셋의 showcase)
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
