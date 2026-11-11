// 연수 사이트 유형 결정: 강의형(story)·실습형(lab)·행사형(live)·과정형(course)
// info: { format: 'lecture'|'practice'|'workshop'|'discussion'|'conference'|'course', durationMin, size, sessions, practiceRatio }
export function decideArchetype(info = {}) {
  const size = Number(info.size) || 30;
  const dur = Number(info.durationMin) || 120;
  const ratio = Number.isFinite(info.practiceRatio) ? info.practiceRatio : null;
  const sessions = Number(info.sessions) || 1;
  const reasons = [];
  let primary = 'story';
  const mix = [];

  if (info.format === 'course' || sessions >= 3) { primary = 'course'; reasons.push('여러 차시로 이어지는 연수라 과정형으로 잡았어요.'); }
  else if (info.format === 'conference' || size >= 150) { primary = 'live'; reasons.push('인원이 많은 행사라 일정·실시간 질문 중심의 행사형으로 잡았어요.'); }
  else if (info.format === 'practice' || info.format === 'workshop' || (ratio !== null && ratio >= 0.45)) { primary = 'lab'; reasons.push('따라 하는 실습 비중이 커서 실습형으로 잡았어요.'); }
  else { primary = 'story'; reasons.push('메시지와 사례 전달이 중심이라 강의형으로 잡았어요.'); }

  if (primary === 'lab' && (ratio === null || ratio < 0.8) && dur >= 90) { mix.push('story'); reasons.push('앞부분은 강의형처럼 연수의 취지를 먼저 보여 줘요.'); }
  if (primary === 'story' && ratio !== null && ratio >= 0.2) { mix.push('lab'); reasons.push('실습 구간이 있어 실습 칸을 함께 넣어요.'); }
  if (primary === 'course' && ratio !== null && ratio >= 0.3) mix.push('lab');
  return { primary, mix, reasons };
}
