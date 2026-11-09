// 연수 사이트 유형 결정: 스토리형(story)·실습형(lab)·라이브형(live)·과정형(course)
// info: { format: 'lecture'|'practice'|'workshop'|'discussion'|'conference'|'course', durationMin, size, sessions, practiceRatio }
export function decideArchetype(info = {}) {
  const size = Number(info.size) || 30;
  const dur = Number(info.durationMin) || 120;
  const ratio = Number.isFinite(info.practiceRatio) ? info.practiceRatio : null;
  const sessions = Number(info.sessions) || 1;
  const reasons = [];
  let primary = 'story';
  const mix = [];

  if (info.format === 'course' || sessions >= 3) { primary = 'course'; reasons.push('여러 차시로 이어지는 연수라 과정형으로 잡았습니다.'); }
  else if (info.format === 'conference' || size >= 150) { primary = 'live'; reasons.push('인원이 많은 행사라 일정·실시간 질문 중심의 라이브형으로 잡았습니다.'); }
  else if (info.format === 'practice' || info.format === 'workshop' || (ratio !== null && ratio >= 0.45)) { primary = 'lab'; reasons.push('따라 하는 실습 비중이 커서 실습형으로 잡았습니다.'); }
  else { primary = 'story'; reasons.push('메시지와 사례 전달이 중심이라 스토리형으로 잡았습니다.'); }

  if (primary === 'lab' && (ratio === null || ratio < 0.8) && dur >= 90) { mix.push('story'); reasons.push('앞부분은 스토리형으로 연수의 취지를 먼저 보여 줍니다.'); }
  if (primary === 'story' && ratio !== null && ratio >= 0.2) { mix.push('lab'); reasons.push('실습 구간이 있어 실습 스테이션을 함께 넣습니다.'); }
  if (primary === 'course' && ratio !== null && ratio >= 0.3) mix.push('lab');
  return { primary, mix, reasons };
}

/** 유형별 기본 섹션 순서(빈 섹션은 나중에 빠짐) */
export const ARCHETYPE_SECTIONS = {
  story: ['hero', 'message', 'steps5', 'outline', 'schedule', 'deck', 'tools', 'stations', 'qa', 'board', 'materials', 'instructor', 'closing', 'survey'],
  lab: ['hero', 'readiness', 'outline', 'stations', 'prompts', 'tools', 'qa', 'board', 'reflection', 'materials', 'instructor', 'survey'],
  live: ['hero', 'glance', 'schedule', 'speakers', 'qa', 'poll', 'deck', 'materials', 'faq', 'survey', 'closing'],
  course: ['hero', 'glance', 'sessions', 'readiness', 'stations', 'board', 'materials', 'attendance', 'faq', 'instructor', 'survey'],
};
