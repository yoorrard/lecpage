// 운영 방식 결정: 인원·필요 기능·기간·숙련도·예산·네트워크·가진 인프라 → 호스팅 × 실시간 백엔드
// 숫자 근거(2026-11 확인): Supabase 무료 동시 실시간 200·초당 메시지 100(받는 사람 수만큼 셈)·7일 무활동 일시정지,
// 익명 로그인 IP당 시간당 30회(그래서 lecpage는 Supabase Auth를 쓰지 않음), Apps Script 계정당 동시 실행 30,
// Cloudflare Workers 무료 하루 10만 요청·정적 파일 무제한·Durable Objects 대기 중 웹소켓 과금 없음.

/**
 * 강사가 직접 할 일(앱·에이전트 밖에서 누르기·붙여 넣기·가입 횟수, 어림). 참여 기능을 고르는 기준 하나.
 * app: 2026-11-13 앱 경로 측정(구글 시트 약 23, Supabase 약 12, Cloudflare 버튼 6 + GitHub 연결 허락 1, GitHub 계정 필요).
 * skill: Cloudflare는 가입·`wrangler login` 승인(publish --live가 나머지), Supabase는 가입·토큰 만들기·환경 변수,
 * 구글 시트는 에이전트가 대신할 수 없어 강사가 Apps Script에 붙여 넣음(앱 경로에서 앱 안 단계를 뺀 어림).
 */
export const TEACHER_STEPS = {
  none: { app: 0, skill: 0 }, local: { app: 0, skill: 0 },
  sheets: { app: 23, skill: 20 }, supabase: { app: 12, skill: 3 }, cloudflare: { app: 7, skill: 2 },
  server: { app: null, skill: 2 }, lan: { app: null, skill: 1 },
};

/**
 * 올릴 곳마다 강사가 처음에 직접 할 일(어림, 근거: docs/research/hosting-2026-11.md §9·§12). 이미 연결해 둔 곳은 0번.
 * app: Vercel은 앱 측정(가입·토큰 만들기·복사 6), 나머지는 앱 안내 단계 수. skill: 에이전트가 명령을 대신 칠 때 남는 일.
 * Onpod은 CLI에 브라우저 로그인이 없어 콘솔에서 API 키를 만들어 건네야 함(가입·키 만들기·복사·환경 변수). null = 그 길로는 못 올림
 */
export const HOST_STEPS = {
  lecpage: { app: 0, skill: null },
  vercel: { app: 6, skill: 3 },
  'github-pages': { app: 6, skill: 3 },
  cloudflare: { app: 6, skill: 2 },
  netlify: { app: 7, skill: 3 },
  onpod: { app: null, skill: 4 },
};

export const REALTIME_FEATURES =['qa', 'help', 'progress', 'poll', 'reactions', 'signal'];
export const STORE_FEATURES = ['attendance', 'board', 'survey'];

export const BACKENDS = {
  none: { name_ko: '서버 없음', cost: '0원', note_ko: '완료 체크·메모는 참가자 각자의 브라우저에 저장해요.' },
  local: { name_ko: '이 컴퓨터에서만 시험', cost: '0원', note_ko: '한 브라우저 안에서만 이어져요. 리허설·시연용이에요.' },
  sheets: { name_ko: '구글 시트', cost: '0원', note_ko: '기록이 강사의 구글 시트에 쌓여요. 5~10초마다 새로 읽어요.',
    atLimit_ko: '무료이고 멈추지 않아요. 한꺼번에 30명 넘게 보내면 조금 늦어져요.' },
  supabase: { name_ko: 'Supabase', cost: '0원', note_ko: '강사의 무료 Supabase 프로젝트에 기록·파일을 함께 저장해요. 100명 안팎까지 알맞아요.',
    atLimit_ko: '무료는 7일 동안 안 쓰면 멈춰요. 연수 전날 한 번 열어 깨우면 되고, Pro로 바꾸면 멈추지 않아요.' },
  // 아래 셋은 앱의 '내 서버·Cloudflare' 탭(live.provider http)으로 연결합니다.
  cloudflare: { name_ko: '내 서버·Cloudflare', cost: '0원~월 $5', note_ko: '강사의 Cloudflare 계정에서 돌려요. 대기 중 연결에 요금이 없어 큰 행사에 알맞아요.',
    atLimit_ko: '무료는 하루 10만 요청까지예요. 넘으면 그날은 멈추고, 유료(월 $5)로 바꾸면 이어져요.' },
  server: { name_ko: '내 서버·Cloudflare', cost: '보유 서버 비용', note_ko: 'AWS·학교 서버·NAS·VPS 어디서든 컨테이너 하나로 돌려요.' },
  lan: { name_ko: '내 서버·Cloudflare', cost: '0원', note_ko: '강사 노트북을 서버로 써요. 인터넷 없이 같은 와이파이·핫스폿에서 접속해요.' },
};

// 배포할 곳. app = 앱에서 바로 배포(브라우저에서 API를 부를 수 있는 곳), cli = skill이 쓰는 명령(대화 없이 돎).
// 숫자·약관 근거: docs/research/hosting-2026-11.md (2026-11-11 확인). limit: siteMB(사이트 합계)·fileMB(파일 하나)·files(파일 수)
export const HOSTS = {
  lecpage: { name_ko: 'lecpage 주소', cost: '0원', app: true, account: false, limit: { siteMB: 40, fileMB: 20, files: 600 },
    note_ko: '가입 없이 바로 배포해요. 30일 동안 방문이 없으면 지워져요.',
    atLimit_ko: '방문이 있는 동안은 계속 열려 있어요.', atLimitFree_ko: '무료로 운영되는 서버라 방문이 몰리는 날은 멈출 수 있어요. 본 연수는 내 계정에 배포하는 편이 안전해요.' },
  vercel: { name_ko: 'Vercel', cost: '0원', app: true, account: true, limit: { siteMB: 100, files: 15000 },
    cli: 'VERCEL_TOKEN=… npx vercel@latest deploy ./dist --prod --yes --project <이름> --create-if-missing',
    note_ko: '토큰 하나로 배포하고, 다시 배포해도 같은 주소예요.',
    transferGB: 100, stops: true, atLimit_ko: '무료는 월 100GB까지예요. 넘으면 멈추고, Pro로 바꾸면 이어져요.' },
  'github-pages': { name_ko: 'GitHub Pages', cost: '0원', app: true, account: true, limit: { siteMB: 900, fileMB: 100 },
    cli: 'gh repo create <이름> --public --source=. --push && gh api -X POST "repos/{owner}/{repo}/pages" -f "source[branch]=main" -f "source[path]=/"',
    note_ko: '공개 저장소에 올려요. 저장소의 사이트 파일은 누구나 볼 수 있어요.',
    transferGB: 100, stops: false, atLimit_ko: '월 100GB는 권고라서 넘어도 바로 멈추지 않아요.' },
  cloudflare: { name_ko: 'Cloudflare', cost: '0원', app: false, account: true, limit: { fileMB: 25, files: 1000 },
    // 빈 임시 폴더에서 돌림: wrangler는 실행한 폴더와 위쪽 폴더의 wrangler 설정을 읽어 그 프로젝트를 올릴 수 있음
    cli: 'D="$PWD/dist"; (cd "$(mktemp -d)" && npx wrangler@4 deploy --assets "$D" --name <이름> --compatibility-date <오늘>)',
    note_ko: '정적 파일 요청이 무료·무제한이라 방문이 많아도 멈추지 않아요. 앱에서는 ZIP을 끌어다 놓아요.',
    stops: false, atLimit_ko: '방문이 많아도 멈추지 않아요.' },
  // Onpod(한국 서비스): skill 전용. REST가 다른 출처를 막아 앱에서는 못 올림(조사 §12, 2026-11-13).
  // CLI는 CDN의 최신 바이너리만 받으므로 버전을 고정하지 않음(@latest). 무료 정적 사이트는 계정당 10개
  onpod: { name_ko: 'Onpod', cost: '0원(사이트 10개까지)', app: false, account: true, limit: { siteMB: 100, fileMB: 50, files: 5000 },
    cli: 'ONPOD_TOKEN=… npx --yes onpod@latest static deploy ./dist --name <이름> --no-spa',
    note_ko: '한국 서비스예요(한국어 화면·국내 리전). 구글로 가입하고 콘솔에서 만든 API 키 하나로 배포해요. 무료는 계정당 사이트 10개까지예요.',
    transferGB: 100, stops: true, atLimit_ko: '무료는 월 100GB까지예요. 넘으면 그달은 멈췄다가 다음 달 1일에 다시 열려요.' },
  netlify: { name_ko: 'Netlify', cost: '0원(월 300크레딧)', app: true, account: true, limit: { files: 25000 },
    cli: 'NETLIFY_AUTH_TOKEN=… npx netlify-cli deploy --dir dist --prod --no-build --site-name <이름>',
    note_ko: '무료는 한 달에 20번쯤 배포할 수 있어요. 2026년 7월 28일 뒤에 만든 계정이라면 배포한 뒤 Make public을 눌러야 열려요.',
    transferGB: 12, stops: true, atLimit_ko: '월 300크레딧을 다 쓰면 그달은 멈춰요. 충전하면 이어져요.' },
  firebase: { name_ko: 'Firebase Hosting', cost: '0원', app: false, account: true, note_ko: '구글 계정으로 시작. 무료 전송량은 월 10GB이고, 넘으면 그달 사이트가 멈춰요.' },
  s3: { name_ko: 'AWS S3 + CloudFront', cost: '소액', app: false, account: true, note_ko: 'AWS 계정이 있을 때. 1년 무료 이후 사용량 과금.' },
  server: { name_ko: '보유 서버(nginx·Caddy)', cost: '보유 비용', app: false, account: false, note_ko: '학교·기관 서버, NAS, VPS.' },
  lan: { name_ko: '노트북에서 직접', cost: '0원', app: false, account: false, note_ko: '연수 장소에서만 열려요.' },
  zip: { name_ko: 'ZIP·USB', cost: '0원', app: false, account: false, note_ko: '파일을 열기만 하면 돼요(참여 기능 제외).' },
};

const MB = 1024 * 1024;
/**
 * 만든 사이트가 그 곳의 한도 안인지. 올리기 직전에 부릅니다.
 * @param {string} host HOSTS의 id
 * @param {{bytes?: number, files?: number, maxFile?: number, binaries?: number}} stat 합계 바이트·파일 수·가장 큰 파일·그림 등 바이너리 수
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function checkHost(host, stat = {}) {
  const h = HOSTS[host]; const lim = h?.limit || {}; const errors = [], warnings = [];
  const mb = (n) => Math.ceil(n / MB);
  if (lim.siteMB && stat.bytes > lim.siteMB * MB) errors.push(`사이트가 ${mb(stat.bytes)}MB예요. ${h.name_ko}에는 ${lim.siteMB}MB까지 올릴 수 있어요.`);
  if (lim.fileMB && stat.maxFile > lim.fileMB * MB) errors.push(`${mb(stat.maxFile)}MB짜리 파일이 있어요. ${h.name_ko}에는 파일 하나가 ${lim.fileMB}MB까지예요. 영상은 유튜브 링크로 바꾸면 좋아요.`);
  if (lim.files && stat.files > lim.files) errors.push(`파일이 ${stat.files}개예요. ${h.name_ko}에는 ${lim.files}개까지 올릴 수 있어요.`);
  if (host === 'vercel' && stat.files > 4000) warnings.push('파일이 많아 Vercel의 하루 올리기 한도(5,000개)에 닿을 수 있어요.');
  if (host === 'github-pages' && stat.binaries > 450) warnings.push('그림이 많아 올리는 데 오래 걸리고, GitHub의 시간당 한도에 닿을 수 있어요.');
  return { ok: !errors.length, errors, warnings };
}

/**
 * 올릴 곳 고르기. 앞에 있을수록 추천.
 * @param {object} input
 *   skill 'click'(앱·초보) | 'set' | 'dev'(skill·명령 가능), network, infra[], backend(실시간 방식),
 *   previous(지난번에 배포한 곳), connected[](이미 연결해 둔 곳), instant(운영자의 '바로 배포'를 쓸 수 있음: 'stable'|'limited'|'pages'),
 *   keep('long'이면 연수 뒤에도 오래 둘 사이트), customDomain(내 도메인을 붙일 계획),
 *   maxFileMB(가장 큰 파일), siteMB(사이트 합계), files(파일 수)
 * @returns {{ hosts: string[], pick: string, reasons: string[], warnings: string[] }}
 */
export function decideHost(input = {}) {
  const skill = input.skill || 'click';
  const infra = [].concat(input.infra || []);
  const reasons = [], warnings = [];
  const why = (t) => { reasons.length = 0; reasons.push(t); };
  const first = (h, list) => [h, ...list.filter((x) => x !== h)];
  const last = (h, list) => [...list.filter((x) => x !== h), h];
  let hosts;
  if (input.network === 'offline') { hosts = ['lan', 'zip']; reasons.push('연수 장소에 인터넷이 없어 강사 노트북에서 열어요.'); }
  else if (input.backend === 'server') { hosts = ['server']; reasons.push('가진 서버에서 사이트와 참여 기능을 함께 돌려요.'); }
  else {
    // 기본: 앱(브라우저만)은 토큰 하나로 끝나는 Vercel, skill(명령 가능)은 요청 무제한인 Cloudflare
    // Onpod은 명령(skill)으로만 올림. 할 일이 Cloudflare보다 많아(API 키 만들기) 뒤에 두고, 이미 쓰면(connected·previous) 앞으로
    hosts = skill === 'click' ? ['vercel', 'github-pages', 'cloudflare', 'netlify'] : ['cloudflare', 'vercel', 'github-pages', 'onpod', 'netlify'];
    reasons.push(skill === 'click' ? 'Vercel은 토큰 하나로 앱에서 바로 배포하고, 다시 배포해도 주소가 그대로예요.' : 'Cloudflare는 정적 파일 요청이 무료·무제한이고 명령 한 줄로 배포해요.');
    if (input.backend === 'cloudflare' && skill !== 'click') hosts = first('cloudflare', hosts);
    if (input.customDomain || (input.network === 'restricted' && skill !== 'click')) {
      hosts = first('cloudflare', hosts);
      why(input.customDomain ? '내 도메인을 붙일 계획이면 도메인과 호스팅을 한곳에서 다루는 Cloudflare가 편해요.' : '학교망이 기본 주소를 막으면 내 도메인을 붙여야 해요. Cloudflare가 도메인 연결이 가장 쉬워요.');
    }
    // 크기(조사 §8.1): Vercel은 합계 100MB, Cloudflare는 파일 하나 25MB·끌어 놓기 1,000개(명령으로 올리면 20,000개), GitHub Pages는 사이트 1GB·파일 100MB
    const cfFiles = skill === 'click' ? 1000 : 20000;
    const bigFile = Number(input.maxFileMB) > 25, manyFiles = Number(input.files) > cfFiles, bigSite = Number(input.siteMB) > 100;
    if (bigFile || manyFiles) {
      // Cloudflare에 못 올림 → GitHub Pages(파일 100MB까지)를 먼저. Vercel은 파일 하나의 한도가 문서에 없어 뒤로
      hosts = first('github-pages', last('cloudflare', hosts));
      why(bigFile ? '25MB가 넘는 파일이 있어 GitHub Pages를 권해요.' : `파일이 ${cfFiles.toLocaleString('en-US')}개를 넘어 GitHub Pages를 권해요.`);
      warnings.push(bigFile ? '25MB가 넘는 파일은 Cloudflare에 올릴 수 없어요. 영상은 유튜브 링크로 바꾸는 게 좋아요.' : `Cloudflare는 파일 ${cfFiles.toLocaleString('en-US')}개까지예요.`);
    } else if (bigSite) {
      // 큰 사이트는 요청·크기 한도가 넉넉한 Cloudflare를 먼저(앱에서는 ZIP 끌어 놓기)
      hosts = first('cloudflare', hosts);
      why('사이트가 100MB를 넘어 Cloudflare를 권해요.');
    }
    if (bigSite && hosts.includes('vercel')) { hosts = last('vercel', hosts); warnings.push('Vercel 무료는 한 번에 올리는 파일 합계가 100MB까지예요.'); }
    // Onpod 무료: 사이트 100MB·파일 50MB·5,000개
    if (hosts.includes('onpod') && (bigSite || Number(input.maxFileMB) > 50 || Number(input.files) > 5000)) hosts = last('onpod', hosts);
    if (input.network === 'restricted') warnings.push('학교망에서 기본 주소가 막힐 수 있어요. 연수 전날 참가자 망에서 주소를 열어 보고, 막히면 내 도메인을 붙이세요.');
    if (infra.includes('aws') && skill !== 'click') hosts.unshift('s3');
    // 멈추지 않는 것이 먼저: 참가자가 많고 사이트가 크면 한 달 전송량(사이트 크기 × 인원 × 6번)이 무료 한도에 닿는 곳을 뒤로
    const monthGB = (Number(input.siteMB) || 0) * (Number(input.size) || 0) * 6 / 1024;
    const tight = hosts.filter((h) => HOSTS[h].stops && HOSTS[h].transferGB && monthGB > HOSTS[h].transferGB / 2);
    if (tight.length) {
      for (const h of tight) hosts = last(h, hosts);
      why(`참가자가 많고 사이트가 커서(한 달 약 ${Math.round(monthGB)}GB) 방문 한도가 없는 ${HOSTS[hosts[0]].name_ko}를 권해요.`);
      warnings.push(`${tight.map((h) => HOSTS[h].name_ko).join('·')} 무료는 전송량 한도를 넘으면 사이트가 멈춰요.`);
    }
    const fitsInstant = !(Number(input.siteMB) > HOSTS.lecpage.limit.siteMB) && !(Number(input.maxFileMB) > HOSTS.lecpage.limit.fileMB) && !(Number(input.files) > HOSTS.lecpage.limit.files);
    if (input.instant && fitsInstant) {
      // 운영자가 '바로 배포'를 켜 둔 앱: 가입이 필요 없어 가장 빠름. 오래 둘 사이트·내 도메인은 본인 계정이 먼저.
      // 운영자가 무료 요금제로 돌리면(instant: 'limited') 하루 한도에 닿는 날 멈출 수 있어 첫째로 권하지 않음.
      // 'pages': 사이트를 Cloudflare Pages로 내보내는 서버(방문이 하루 한도에 들지 않아 무료여도 사이트는 멈추지 않음)
      if (input.instant === 'limited' || input.keep === 'long' || input.customDomain) hosts.splice(1, 0, 'lecpage');
      else { hosts.unshift('lecpage'); why(input.instant === 'pages' ? '가입이나 토큰 없이 바로 배포해요. 방문이 많아도 사이트는 멈추지 않아요.' : '가입이나 토큰 없이 바로 배포해요. 방문이 있는 동안은 계속 열려 있어요.'); }
    }
    const mine = [input.previous, ...[].concat(input.connected || [])].filter((h) => h && hosts.includes(h));
    if (mine.length) { hosts = [...new Set([...mine, ...hosts])]; why(input.previous && mine[0] === input.previous ? '지난번에 배포한 곳에 다시 배포하면 주소가 그대로예요.' : '이미 연결해 둔 곳이라 바로 배포할 수 있어요.'); }
    hosts.push('firebase', 'zip');
  }
  const conn = new Set([].concat(input.connected || [], input.previous || []));
  const steps = conn.has(hosts[0]) ? 0 : HOST_STEPS[hosts[0]]?.[skill === 'click' ? 'app' : 'skill'] ?? null;
  return { hosts, pick: hosts[0], reasons, warnings, steps };
}

export function decideInfra(input = {}) {
  const size = Number(input.size) || 30;
  const features = [].concat(input.features || []);
  const skill = input.skill || 'click'; // click | set | dev
  const duration = input.duration || 'day'; // day | month | long
  const infra = [].concat(input.infra || []); // aws | server | nas | school-server
  const network = input.network || 'good'; // good | slow | restricted | offline
  const realtime = features.some((f) => REALTIME_FEATURES.includes(f));
  const store = features.some((f) => STORE_FEATURES.includes(f));
  const reasons = [], warnings = [];
  let backend = 'none', tier = 1;

  if (network === 'offline') {
    backend = realtime || store ? 'lan' : 'none'; tier = backend === 'lan' ? 3 : 1;
    reasons.push('연수 장소에 인터넷이 없어 강사 노트북을 서버로 쓰고, 같은 와이파이로 접속해요.');
  } else if (!realtime && !store) {
    backend = 'none'; tier = 1;
    reasons.push('참여 기록을 모을 필요가 없어 서버가 필요 없어요.');
  } else if ((infra.includes('server') || infra.includes('aws') || infra.includes('nas') || infra.includes('school-server')) && skill !== 'click') {
    backend = 'server'; tier = size > 100 ? 4 : 3;
    reasons.push('이미 가진 서버에서 컨테이너 하나로 사이트와 참여 기능을 함께 돌려요. 기록이 기관 안에 남아요.');
  } else if (!realtime && size <= 40) {
    backend = 'sheets'; tier = 2;
    reasons.push('출석·제출처럼 모으기만 하는 기능이라 실시간 연결이 필요 없어요. 기록이 구글 시트에 쌓여요.');
    if (size > 30) warnings.push('Apps Script는 계정당 동시 실행이 30개라 한꺼번에 제출하면 늦어질 수 있어요.');
  } else if (skill === 'click' && size <= 50) {
    backend = 'sheets'; tier = 2;
    reasons.push('구글 계정만 있으면 10분 안에 직접 연결할 수 있어요. 질문·도움 요청·진행 현황이 5~10초마다 새로 읽혀요(50명 안팎까지).');
    if (size > 30) warnings.push('Apps Script는 계정당 동시 실행이 30개라 한꺼번에 몰리면 조금 늦어질 수 있어요.');
    if (features.includes('reactions')) warnings.push('박수·좋아요 같은 반응은 시트 방식에서 몇 초 늦게 보여요.');
  } else if (size <= 100) {
    backend = 'supabase'; tier = 3;
    reasons.push(realtime ? '질문·진행 현황처럼 화면이 바로 바뀌는 기능이 있어 실시간 연결이 필요해요.' : '인원이 많아 구글 시트보다 Supabase가 안정적이에요.');
    reasons.push('참가자는 로그인 없이 들어와서, 한 학교 와이파이(공인 IP 하나)에서 모두 접속해도 막히지 않아요.');
    warnings.push('Supabase 무료 프로젝트는 7일 동안 쓰지 않으면 멈춰요. 연수 전날 접속 확인(check.html)을 열어 깨워 두세요.');
  } else {
    backend = 'cloudflare'; tier = 4;
    reasons.push('100명이 넘으면 Supabase 무료의 초당 메시지 한도(100건)에 금방 닿아요. Cloudflare는 대기 중 연결에 요금을 받지 않아요.');
    if (size > 300) warnings.push('300명이 넘는 행사는 Cloudflare Workers 유료($5/월)를 켜 두세요. 한도를 넘어도 오류 대신 소액만 과금돼요.');
    if (realtime) warnings.push('질문·투표만 실시간으로 두고, 교재·실습 화면은 정적으로 둬요.');
  }
  // skill: 강사가 할 일이 가장 적은 참여 기능으로(TEACHER_STEPS). Cloudflare 중계는 가입·로그인 승인 2번이고 publish --live가 나머지를 함.
  // 이미 연결해 둔 곳(connected)은 0번으로 셈. 같으면 7일 멈춤이 없는 Cloudflare
  // 앱(클릭만)도 같은 기준: 앱 화면이 내 서버(Cloudflare 버튼)를 먼저 권함(시트 약 23번·Supabase 약 12번 → Cloudflare 약 7번)
  if (backend === 'supabase' || backend === 'sheets') {
    const conn = new Set([].concat(input.connected || []));
    const who = skill === 'click' ? 'app' : 'skill';
    const cost = (b) => (conn.has(b) ? 0 : TEACHER_STEPS[b][who]);
    if (cost('cloudflare') <= cost(backend)) {
      const sameAccount = decideHost({ ...input, skill, network, infra, backend: undefined }).pick === 'cloudflare';
      backend = 'cloudflare'; tier = Math.max(tier, 3);
      reasons.length = 0;
      reasons.push(`강사가 할 일이 가장 적어요(${conn.has('cloudflare') ? '이미 연결해 둬서 더 할 일 없음' : who === 'app' ? 'Cloudflare 가입·GitHub 연결 허락·배포 버튼' : '가입·로그인 승인 2번'}). ${sameAccount ? '사이트와 같은 Cloudflare 계정에 두고, ' : ''}쓰지 않아도 7일 뒤 멈추지 않아요.`);
      reasons.push('질문·투표가 바로 바뀌고, 학교 와이파이 하나에서 모두 접속해도 막히지 않아요. 무료는 하루 10만 요청까지예요.');
      warnings.splice(0, warnings.length, ...warnings.filter((w) => !/Supabase|Apps Script/.test(w)));
    }
  }
  // 웹소켓이 막힌 망에서는 5초마다 묻는 방식이라 요청이 크게 늘어남(100명 2시간이면 14만 건쯤)
  if (backend === 'cloudflare' && network === 'restricted' && size > 60) warnings.push('웹소켓이 막힌 망에서 60명이 넘으면 Cloudflare 무료의 하루 한도에 닿을 수 있어요. 그날만이라도 유료(월 $5)를 켜 두세요.');

  if (network === 'restricted') warnings.push('학교망이 엄격하면 웹소켓이나 일부 도메인이 막힐 수 있어요. check.html로 미리 확인하세요. 막히면 저절로 새로 읽기 방식으로 바뀌어요.');
  if (input.minor) warnings.push('만 14세 미만이 참여해 별명만 받고, 보드 파일 올리기를 막아요.');

  // 올릴 곳
  const hostPick = decideHost({ ...input, skill, network, infra, backend });
  const hosts = hostPick.hosts;
  for (const w of hostPick.warnings) warnings.push(w);

  const alternatives = [];
  if (backend === 'supabase') alternatives.push('cloudflare', 'server');
  if (backend === 'cloudflare') alternatives.push('supabase', 'server');
  if (backend === 'sheets') alternatives.push('supabase');
  if (backend === 'none' && store) alternatives.push('sheets');

  return {
    tier, backend, backendInfo: BACKENDS[backend], hosts, hostInfo: hosts.map((h) => ({ id: h, ...HOSTS[h] })),
    hostReasons: hostPick.reasons, hostSteps: hostPick.steps,
    alternatives, reasons, warnings,
    teacherSteps: TEACHER_STEPS[backend]?.[skill === 'click' ? 'app' : 'skill'] ?? null,
    liveProvider: { none: 'none', local: 'local', sheets: 'sheets', supabase: 'supabase', cloudflare: 'http', server: 'http', lan: 'http' }[backend],
  };
}
