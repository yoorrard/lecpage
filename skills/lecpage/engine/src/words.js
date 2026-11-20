// 사이트 낱말을 대상·성격에 맞게: 교사 연수는 '연수', 학생 수업은 '수업', 설명회·컨퍼런스는 '설명회'·'행사'.
// 연수 성격(meta.admin.kind)은 강사가 고르거나 교재에서 찾음(ingest/detect.js kindOf). 참가자가 보는 화면(참가자 화면·발표 화면·
// QR 안내문·개인정보 안내)이 이 낱말을 씁니다. 교재·강사가 적은 칸 제목은 그대로 둡니다.

/** 받침이 있는지(조사 고르기): 마지막 글자가 한글이 아니면 받침 없음으로 봄 */
export function batchim(word) {
  const c = String(word || '').trim().slice(-1).charCodeAt(0);
  return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : false;
}
/** 을/를 · 이/가 · 은/는 · 이에요/예요 · 이라/라 */
export const josa = (w, withB, without) => `${w}${batchim(w) ? withB : without}`;

const T = {
  teacher: { goals: '연수 목표', deck: '연수 교재', materials: '연수 자료', followup: '연수 후 안내', instructor: '강사 소개', who: '강사', code: '연수 코드' },
  student: { goals: '수업 목표', deck: '수업 자료', materials: '수업 자료', followup: '수업 후 안내', instructor: '선생님 소개', who: '선생님', code: '수업 코드' },
  event: { goals: '오늘 다룰 내용', deck: '발표 자료', materials: '자료', followup: '', instructor: '발표자 소개', who: '발표', code: '' },
};
/** 엔진이 예전부터 칸 제목 기본값으로 적던 말(설계도에 이 말이 그대로 있으면 대상에 맞는 말로 바꿔 그림) */
export const TEACHER_DEFAULTS = { goals: '연수 목표', deck: '연수 교재', materials: '연수 자료', followup: '연수 후 안내', instructor: '강사 소개' };

/**
 * @param bp 설계도(검증 전이어도 됨)
 * @returns { kind, ev(연수·수업·설명회·행사), goals, deck, materials, followup, instructor, who, code, site, ended, endedOn(날짜), attendLead, attendAfter, pollWord, survey(만족도 첫 문항) }
 */
export function wordsFor(bp) {
  const m = bp?.meta || {};
  const kind = ['school', 'official', 'conference', 'student'].includes(m.admin?.kind) ? m.admin.kind : 'school';
  const head = `${m.title || ''} ${m.subtitle || ''}`;
  const ev = kind === 'student' ? '수업' : kind === 'conference' ? (/설명회/.test(head) ? '설명회' : '행사') : '연수';
  const t = kind === 'student' ? T.student : kind === 'conference' ? T.event : T.teacher;
  return {
    kind, ev, ...t,
    followup: t.followup || `${ev} 후 안내`,
    code: t.code || `${ev} 코드`, // 용어 통일(docs/writing.md): '연수 코드'와 같은 꼴(참여·입장 코드라고 하지 않음)
    site: `${ev} 사이트`,
    ended: `끝난 ${ev}`,
    endedOn: (day) => `${day}에 끝난 ${josa(ev, '이에요', '예요')}.`,
    attendLead: `${josa(ev, '을', '를')} 시작할 때와 마칠 때 한 번씩 눌러 주세요.`,
    attendAfter: `끝난 ${josa(ev, '이라', '라')} 출석은 받지 않아요.`,
    pollWord: `오늘 ${josa(ev, '을', '를')} 한 낱말로 말하면?`,
    survey: kind === 'student' ? '오늘 수업은 어땠나요?' : `${ev}에 전반적으로 만족하시나요?`,
    apply: kind === 'student' ? '오늘 배운 것을 잘 알게 되었나요?' : kind === 'conference' ? '설명이 이해하기 쉬웠나요?' : '배운 내용을 수업이나 업무에 쓸 수 있을 것 같나요?',
  };
}

/**
 * 그리기 전에 칸 제목·메뉴 이름을 대상에 맞게(설계도는 그대로 두고 화면만): 엔진 기본값 그대로인 제목('연수 목표'·'강사 소개'…)과
 * 메뉴('연수 후'·'강사')만 바꿈. 교사 연수(school·official)는 그대로
 */
export function localizeSections(bp, w = wordsFor(bp)) {
  if (w.kind === 'school' || w.kind === 'official') return bp;
  const nav = { '연수 후': `${w.ev} 후`, 강사: w.kind === 'student' ? '선생님' : '발표자' };
  return { ...bp, sections: (bp.sections || []).map((s) => {
    const key = Object.keys(TEACHER_DEFAULTS).find((k) => k === s.type);
    const title = key && s.title === TEACHER_DEFAULTS[key] ? w[key] : s.title;
    const n = nav[s.nav] || s.nav;
    return title === s.title && n === s.nav ? s : { ...s, title, nav: n };
  }) };
}

/** 사이트 안 만족도 설문 기본 문항(교원 연수 만족도에서 흔히 묻는 다섯 문항). 첫 두 문항은 대상에 맞는 말로 */
export const DEFAULT_SURVEY = [
  { q: '연수에 전반적으로 만족하시나요?', kind: 'scale' },
  { q: '배운 내용을 수업이나 업무에 쓸 수 있을 것 같나요?', kind: 'scale' },
  { q: '진행 속도는 어땠나요?', kind: 'choice', options: ['빨랐어요', '알맞았어요', '느렸어요'] },
  { q: '가장 도움이 된 내용은 무엇인가요?', kind: 'text' },
  { q: '아쉬운 점이나 바라는 점을 적어 주세요.', kind: 'text' },
];
/** 설문 자리 표시에 문항이 없을 때 넣는 기본 문항(w = wordsFor 결과: 연수·수업·설명회) */
export function surveyFor(w) {
  return DEFAULT_SURVEY.map((q, i) => (i === 0 ? { ...q, q: w.survey } : i === 1 ? { ...q, q: w.apply } : { ...q }));
}
