// 운영 방식 결정: 인원·필요 기능·기간·숙련도·예산·네트워크·가진 인프라 → 호스팅 × 실시간 백엔드
// 숫자 근거(2026-11 확인): Supabase 무료 동시 실시간 200·초당 메시지 100(받는 사람 수만큼 셈)·7일 무활동 일시정지,
// 익명 로그인 IP당 시간당 30회(그래서 lecpage는 Supabase Auth를 쓰지 않음), Apps Script 계정당 동시 실행 30,
// Cloudflare Workers 무료 하루 10만 요청·정적 파일 무제한·Durable Objects 대기 중 웹소켓 과금 없음.

export const REALTIME_FEATURES = ['qa', 'help', 'progress', 'poll', 'chat', 'reactions'];
export const STORE_FEATURES = ['attendance', 'board', 'survey'];

export const BACKENDS = {
  none: { name_ko: '서버 없음', cost: '0원', note_ko: '완료 체크·메모는 각자 브라우저에 저장합니다.' },
  local: { name_ko: '브라우저 미리보기', cost: '0원', note_ko: '한 기기 안에서만 동기화됩니다. 리허설·시연용입니다.' },
  sheets: { name_ko: 'Google Sheets + Apps Script', cost: '0원', note_ko: '결과가 강사의 구글 시트에 쌓입니다. 5~10초마다 새로 읽습니다.' },
  supabase: { name_ko: 'Supabase 무료(강사 소유)', cost: '0원', note_ko: 'DB·실시간·파일 저장을 한곳에서. 100명 안팎까지 권장.' },
  cloudflare: { name_ko: 'Cloudflare Workers + Durable Objects', cost: '0원~월 $5', note_ko: '대기 중 연결에 과금이 없어 큰 행사에 강합니다.' },
  server: { name_ko: '자체 서버(Node, Docker)', cost: '보유 서버 비용', note_ko: 'AWS·학교 서버·NAS·VPS 어디서든 컨테이너 하나로 실행합니다.' },
  lan: { name_ko: '교실 안 노트북 서버', cost: '0원', note_ko: '인터넷 없이 같은 와이파이·핫스폿에서 접속합니다.' },
};

export const HOSTS = {
  'github-pages': { name_ko: 'GitHub Pages', cost: '0원', note_ko: '공개 저장소 무료. 상업용 SaaS 용도는 금지.' },
  cloudflare: { name_ko: 'Cloudflare Pages/Workers', cost: '0원', note_ko: '정적 파일 요청 무료·무제한, 상업 이용 가능.' },
  netlify: { name_ko: 'Netlify', cost: '0원(크레딧 300)', note_ko: '끌어다 놓기 배포가 쉬움. 크레딧 초과 시 계정 전체 정지.' },
  vercel: { name_ko: 'Vercel Hobby', cost: '0원', note_ko: '비상업 용도만. 강사료가 있는 연수는 애매합니다.' },
  firebase: { name_ko: 'Firebase Hosting', cost: '0원', note_ko: '구글 계정으로 시작. 하루 전송량 제한이 있습니다.' },
  s3: { name_ko: 'AWS S3 + CloudFront', cost: '소액', note_ko: 'AWS 계정이 있을 때. 1년 무료 이후 사용량 과금.' },
  server: { name_ko: '보유 서버(nginx·Caddy)', cost: '보유 비용', note_ko: '학교·기관 서버, NAS, VPS.' },
  lan: { name_ko: '노트북에서 직접', cost: '0원', note_ko: '연수 장소에서만 열립니다.' },
  zip: { name_ko: 'ZIP·USB', cost: '0원', note_ko: '파일을 열기만 하면 됩니다(실시간 기능 제외).' },
};

export function decideInfra(input = {}) {
  const size = Number(input.size) || 30;
  const features = [].concat(input.features || []);
  const skill = input.skill || 'click'; // click | set | dev
  const duration = input.duration || 'day'; // day | month | long
  const infra = [].concat(input.infra || []); // aws | server | nas | school-server
  const network = input.network || 'good'; // good | slow | restricted | offline
  const paid = !!input.commercial; // 강사료·유료 연수
  const realtime = features.some((f) => REALTIME_FEATURES.includes(f));
  const store = features.some((f) => STORE_FEATURES.includes(f));
  const reasons = [], warnings = [];
  let backend = 'none', tier = 1;

  if (network === 'offline') {
    backend = realtime || store ? 'lan' : 'none'; tier = backend === 'lan' ? 3 : 1;
    reasons.push('연수 장소에 인터넷이 없어서 강사 노트북을 서버로 쓰고 같은 와이파이로 접속합니다.');
  } else if (!realtime && !store) {
    backend = 'none'; tier = 1;
    reasons.push('참여 기록을 모을 필요가 없어 서버와 DB가 필요 없습니다.');
  } else if ((infra.includes('server') || infra.includes('aws') || infra.includes('nas') || infra.includes('school-server')) && skill !== 'click') {
    backend = 'server'; tier = size > 100 ? 4 : 3;
    reasons.push('이미 가진 서버에서 컨테이너 하나로 사이트와 실시간 기능을 함께 돌립니다. 데이터가 기관 안에 남습니다.');
  } else if (!realtime && size <= 40) {
    backend = 'sheets'; tier = 2;
    reasons.push('출석·제출처럼 모으기만 하면 되는 기능이라 실시간 연결이 필요 없습니다. 결과가 구글 시트에 쌓입니다.');
    if (size > 30) warnings.push('Apps Script는 계정당 동시 실행이 30개라 한꺼번에 제출하면 늦어질 수 있습니다.');
  } else if (size <= 100) {
    backend = 'supabase'; tier = 3;
    reasons.push(realtime ? '질문·진행 현황처럼 화면이 바로 바뀌는 기능이 있어 실시간 연결이 필요합니다.' : '인원이 많아 시트보다 DB가 안정적입니다.');
    reasons.push('lecpage는 참가자 로그인 없이 참여 토큰을 써서, 한 학교 와이파이(공인 IP 하나)에서도 막히지 않습니다.');
    if (duration !== 'day') warnings.push('Supabase 무료 프로젝트는 7일 동안 사용이 없으면 멈춥니다. 연수 하루 전 접속 진단으로 확인하세요.');
  } else {
    backend = 'cloudflare'; tier = 4;
    reasons.push('100명이 넘으면 Supabase 무료의 초당 메시지 한도(100건)에 금방 닿습니다. Cloudflare는 대기 중 연결에 과금하지 않습니다.');
    if (size > 300) warnings.push('300명이 넘는 행사는 Workers 유료($5/월)를 켜 두면 한도 초과 시 오류 대신 소액 과금됩니다.');
    if (realtime) warnings.push('질문·투표만 실시간으로 두고, 교재·실습 화면은 정적으로 둡니다.');
  }

  if (network === 'restricted') warnings.push('학교망이 엄격하면 웹소켓이나 일부 도메인이 막힐 수 있습니다. check.html로 미리 확인하고, 막히면 자동으로 새로 읽기 방식으로 바뀝니다.');
  if (input.minor) warnings.push('만 14세 미만이 참여하므로 별명만 받고, 얼굴이 보이는 사진 업로드를 막습니다.');

  // 호스팅
  const hosts = [];
  if (network === 'offline') hosts.push('lan');
  else if (backend === 'server') hosts.push('server');
  else {
    if (infra.includes('aws') && skill !== 'click') hosts.push('s3');
    if (skill === 'click') hosts.push('github-pages', 'netlify', 'cloudflare');
    else hosts.push('cloudflare', 'github-pages', 'netlify');
    if (!paid) hosts.push('vercel'); else warnings.push('강사료가 있는 연수는 Vercel 무료(비상업 전용) 대신 Cloudflare를 권합니다.');
    hosts.push('firebase', 'zip');
  }
  if (backend === 'cloudflare' && hosts[0] !== 'cloudflare') { hosts.splice(hosts.indexOf('cloudflare'), 1); hosts.unshift('cloudflare'); }

  const alternatives = [];
  if (backend === 'supabase') alternatives.push('cloudflare', 'server');
  if (backend === 'cloudflare') alternatives.push('supabase', 'server');
  if (backend === 'sheets') alternatives.push('supabase');
  if (backend === 'none' && store) alternatives.push('sheets');

  return {
    tier, backend, backendInfo: BACKENDS[backend], hosts, hostInfo: hosts.map((h) => ({ id: h, ...HOSTS[h] })),
    alternatives, reasons, warnings,
    liveProvider: { none: 'none', local: 'local', sheets: 'sheets', supabase: 'supabase', cloudflare: 'http', server: 'http', lan: 'http' }[backend],
  };
}
