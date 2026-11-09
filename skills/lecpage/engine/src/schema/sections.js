// 섹션(모듈) 정의: 타입, 기본 메뉴 이름, 실시간 필요 여부, 배열 필드, 설명
export const SECTION_DEFS = {
  hero:       { nav: '처음', live: false, label: '첫 화면', desc: '연수명·일시·강사·시작 버튼' },
  goals:      { nav: '', live: false, label: '연수 목표', desc: '마치면 할 수 있는 것·대상·이수 기준', list: 'items' },
  glance:     { nav: '', live: false, label: '한눈에 보기', desc: '숫자로 보는 연수 요약', list: 'items' },
  message:    { nav: '', live: false, label: '핵심 메시지', desc: '문장·공식·인용' },
  steps5:     { nav: '', live: false, label: '핵심 단계', desc: '키워드 단계 나열', list: 'items' },
  outline:    { nav: '차례', live: false, label: '오늘의 차례', desc: '1부·2부·3부 카드', list: 'items' },
  schedule:   { nav: '일정', live: false, label: '일정표', desc: '시간표, 지금 순서 강조', list: 'items' },
  readiness:  { nav: '준비', live: false, label: '준비 점검', desc: '체크리스트와 접속 진단', list: 'items' },
  deck:       { nav: '교재', live: false, label: '교재 뷰어', desc: '슬라이드 넘기기·전체 보기·검색', list: 'slides' },
  stations:   { nav: '실습', live: false, label: '실습 스테이션', desc: '단계·프롬프트 복사·완료 체크', list: 'items' },
  tools:      { nav: '도구', live: false, label: '도구 모음', desc: '교재 쪽과 연결된 도구 카드', list: 'items' },
  prompts:    { nav: '프롬프트', live: false, label: '프롬프트 모음', desc: '복사해서 쓰는 프롬프트', list: 'items' },
  qa:         { nav: '질문', live: true, label: '실시간 질문', desc: '익명 질문과 공감' },
  board:      { nav: '보드', live: true, label: '참여 보드', desc: '결과물·소감 올리기' },
  poll:       { nav: '투표', live: true, label: '투표·워드클라우드', desc: '실시간 응답과 결과', list: 'items' },
  quiz:       { nav: '퀴즈', live: false, label: '복습 퀴즈', desc: '바로 채점되는 퀴즈', list: 'items' },
  materials:  { nav: '자료', live: false, label: '자료실', desc: '내려받기와 이용 안내', list: 'items' },
  instructor: { nav: '강사', live: false, label: '강사 소개', desc: '프로필·이력·연락처' },
  speakers:   { nav: '연사', live: false, label: '연사', desc: '여러 연사 카드', list: 'items' },
  sessions:   { nav: '차시', live: false, label: '차시 목록', desc: '과정형 연수의 차시, 날짜로 지금 차시 표시', list: 'items' },
  survey:     { nav: '설문', live: false, label: '만족도 조사', desc: '사이트 안 설문 또는 QR·링크' },
  followup:   { nav: '연수 후', live: false, label: '연수 후 안내', desc: '다시 보기·소통방·이수 안내, 끝난 뒤 맨 위로', list: 'items' },
  closing:    { nav: '', live: false, label: '마무리', desc: '마지막 문장과 인사' },
  faq:        { nav: 'FAQ', live: false, label: '자주 묻는 질문', desc: '접었다 펴는 질문과 답', list: 'items' },
  glossary:   { nav: '용어', live: false, label: '용어 풀이', desc: '어려운 낱말 설명', list: 'items' },
  video:      { nav: '영상', live: false, label: '영상', desc: '썸네일과 바로가기', list: 'items' },
  gallery:    { nav: '사진', live: false, label: '갤러리', desc: '사진 모음', list: 'items' },
  reflection: { nav: '기록', live: false, label: '나의 기록', desc: '메모와 다짐 내려받기' },
  attendance: { nav: '출석', live: true, label: '출석 확인', desc: '입실·퇴실 체크' },
  text:       { nav: '', live: false, label: '글', desc: '자유 글(제한된 마크다운)' },
};

export const SECTION_TYPES = Object.keys(SECTION_DEFS);
export const LIVE_FEATURES = ['qa', 'help', 'progress', 'board', 'poll', 'chat', 'attendance', 'reactions', 'signal'];
export const LIVE_PROVIDERS = ['none', 'local', 'supabase', 'sheets', 'http'];
export const ARCHETYPES = ['story', 'lab', 'live', 'course'];
export const DEPLOY_TARGETS = ['github-pages', 'cloudflare', 'vercel', 'netlify', 'firebase', 's3', 'server', 'lan', 'zip'];

// 기본 만족도 설문(교원 연수 만족도에서 흔히 묻는 다섯 문항). 실시간 기능이 켜져 있으면 사이트 안에서 바로 모읍니다.
export const DEFAULT_SURVEY = [
  { q: '연수에 전반적으로 만족하시나요?', kind: 'scale' },
  { q: '배운 내용을 수업이나 업무에 쓸 수 있을 것 같나요?', kind: 'scale' },
  { q: '진행 속도는 어땠나요?', kind: 'choice', options: ['빨랐어요', '알맞았어요', '느렸어요'] },
  { q: '가장 도움이 된 내용은 무엇인가요?', kind: 'text' },
  { q: '아쉬운 점이나 바라는 점을 적어 주세요.', kind: 'text' },
];

// 연수 후 안내 항목 종류: 주소를 보고 자동으로 정합니다(직접 줄 수도 있음)
export const FOLLOWUP_KINDS = ['recording', 'community', 'next', 'read', 'link'];
