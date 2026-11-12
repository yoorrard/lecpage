// 문구 규칙(한 곳에서 관리). 같은 목록을 쓰는 곳:
//   AI 프롬프트(bridge.js) · 설계도와 만든 사이트 점검(scripts/copy-lint.mjs) · 앱 화면 글과 엔진 고정 문구 점검(app/scripts/copy-lint.mjs)
//   기준 문서: references/copywriting.md(강의 페이지), docs/writing.md(앱·공통)
// level: error = 고침(AI 티·장식·틀린 말) / warn = 살핌(대개 고치는 게 낫지만 예외가 있음)
// id:    ai 상투·과장 · deco 장식 · plain 풀어쓰기 · formal 합니다체 · honor 과한 높임 · passive 수동 · noun 명사 나열
//        trans 번역투·공문투 · error 오류문 · mark 문장부호 · cta 단추 이름 · len 길이 · term 용어

/** 그대로 쓰는 흔한 용어(풀어 쓰지 않음) */
export const PLAIN_TERMS = ['QR', 'URL', 'CSV', 'PDF', 'Wi-Fi', '로그인', '프롬프트', 'AI', 'PPT', 'FAQ', '링크', '앱', '크롬북', 'Zoom'];

/**
 * 정해진 용어: 교육 행정 용어와 화면·기능 이름. 명사가 나란히 있어도 풀어 쓰지 않습니다(명사 나열·공문투 점검에서 뺌).
 * 새 용어는 여기에 더합니다. 풀이는 docs/writing.md 4절.
 */
export const FIXED_TERMS = [
  // 교육 행정
  '직무연수', '자율연수', '원격연수', '집합연수', '특수분야 직무연수', '교육청 승인', '이수 기준', '이수 시간', '이수 안내', '이수자 명단', '이수증',
  '출석 확인', '출석부', '연수 시간', '연수 기간', '연수 장소', '연수 대상', '연수 과정', '연수 실적', '연수 지명', '연수 코드', '연수 정보', '연수 목표',
  '연수 교재', '연수 자료', '연수 후 안내', '만족도 조사', '사전 설문', '복습 퀴즈', '개인정보 처리방침', '이용약관', '수집·이용 동의', '보유 기간', '해당 없음',
  // 화면·기능 이름
  '참가자 화면', '강사 화면', '발표 화면', '참여 기능', '도움 요청', '진행 현황', '나눔 보드', '접속 확인', '연결 확인', '공개 범위', '관리자 키', '자동 저장',
  '바로 공개', '짧은 주소', '수정 요청', '대표 효과', '페이지 연출', '색 조합', 'QR 안내문', '가벼운 모드', '기본 초안',
];
const FIXED_RE = new RegExp(FIXED_TERMS.slice().sort((a, b) => b.length - a.length).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s?')).join('|'), 'g');
/** 정해진 용어를 한 덩어리(□)로 가림 */
export const maskFixed = (s) => s.replace(FIXED_RE, '□');

/** 받침이 있는 한글 글자인가(조사·어미 고르기) */
const hasBatchim = (ch) => { const c = ch.charCodeAt(0) - 0xac00; return c >= 0 && c <= 11171 && c % 28 !== 0; };

/** 받침이 ㅂ인 글자 뒤의 "니다·니까"(~습니다, ~합니다, ~됩니다, ~입니까) */
function formalHit(s) {
  if (/^안녕하세요/.test(s)) return ''; // 강사 자기소개("안녕하세요, ○○입니다")
  for (const m of s.matchAll(/([가-힣]+)니(다|까)(?![가-힣])/g)) {
    const last = m[1][m[1].length - 1];
    if ((last.charCodeAt(0) - 0xac00) % 28 !== 17) continue;
    if (/(감사합|고맙습|환영합|축하합|반갑습|수고하셨습|동의합)$/.test(m[1])) continue; // 굳은 인사말, 참가자가 직접 하는 동의 문장
    return m[0].slice(-6);
  }
  const m = /[가-힣]십시오|[가-힣]하시오(?![가-힣])/.exec(s);
  return m ? m[0] : '';
}
/**
 * "설정 변경 완료"처럼 풀이말 없이 명사로 끝난 문장. 알림·오류는 늘, 화면 글은 마침표로 끝낸 문장일 때만 봄
 * ("답변 완료" 같은 상태 표시·범례는 명사로 써도 됨)
 */
function nounStackHit(s, kind) {
  const SPLIT = /(?<=[.?!])\s+|\n|\s[·|]\s/;
  const raw = s.split(SPLIT);
  const masked = maskFixed(s).split(SPLIT); // 정해진 용어는 한 낱말로 셈
  for (const [i, part] of masked.entries()) {
    const p = part.trim();
    if (kind === 'text' && !/[.!]$/.test(p)) continue;
    if (/^(?:[^\s.!?:]+\s+){1,4}(완료|실패|불가|요망|성공|필요)[.!]?$/.test(p)) return (raw[i] || p).trim();
  }
  return '';
}
/** 무슨 일인지·다음 할 일이 없는 오류문 */
const NEXT_STEP = /(주세요|하세요|보세요|으세요|누르|눌러|확인|다시|바꿔|바꾸|고쳐|연결|열어|넣어|적어|골라|기다|문의|그대로|돼요|있어요|○)/;
function errorHit(s, kind) {
  const vague = /(오류|에러|문제)(가|이)?\s*(발생|생겼|났)|알\s*수\s*없는\s*(오류|에러|이유)|(실패|오류)(했|하였)(습니다|어요)|잘못된\s*(요청|접근)/.exec(s);
  if (vague && !NEXT_STEP.test(s.replace(vague[0], ''))) return { hit: vague[0], why: '무슨 일인지·다음 할 일이 없는 오류문', fix: '무엇이 안 됐는지와 다음에 할 일을 씁니다("저장하지 못했어요. 저장 공간을 확인해 주세요.")' };
  if ((kind === 'toast' || kind === 'error') && /(못했어요|수\s*없어요|안\s*돼요|실패했어요)[.]?$/.test(s) && !/[.?!]\s/.test(s.trim()) && !NEXT_STEP.test(s)) return { hit: s.slice(-12), why: '다음 할 일이 없는 알림', fix: '다음에 할 일을 한 문장 덧붙입니다(다시 누르기, 확인할 것, 다른 방법)' };
  return null;
}

/** 금지·주의 표현. re 또는 find(글, 칸) 가운데 하나. only: 이 칸에서만 / mask: 정해진 용어를 가리고 봄 */
export const COPY_RULES = [
  // ── 고침: AI 특유의 말투·장식 ──
  { id: 'trans', re: /[을를]\s*통해(서)?/, level: 'error', why: '번역투', fix: '"~로", "~에서", "~하며"로 바꾸거나 뺍니다' },
  { id: 'formal', re: /수\s*있습니다/, level: 'error', why: '참가자 화면은 해요체', fix: '"~할 수 있어요" 또는 그냥 "~해요"', not: ['doc'] },
  { id: 'ai', re: /(해|봐|가|와|만들어|알아|살펴|나눠|나누어)\s*보아요/, level: 'error', why: '어색한 권유', fix: '"~해 보세요" 또는 "~해요"' },
  { id: 'ai', re: /함께\s*(해요|해\s*봐요|해\s*보아요|나눠요|만들어요|가요)\s*[!.]?$/, level: 'error', why: '빈 권유 문장', fix: '무엇을 하는지 동사로 바로 씁니다' },
  { id: 'ai', re: /알아보(겠습니다|도록\s*하겠습니다|아요|기로\s*해요|ㄹ까요|볼까요)|알아볼까요/, level: 'error', why: '예고만 하는 문장', fix: '알려 줄 내용을 바로 씁니다' },
  { id: 'ai', re: /시간을\s*가(져|집|지|졌)/, level: 'error', why: '군더더기', fix: '"~해요"로 줄입니다' },
  { id: 'ai', re: /여정/, level: 'error', why: 'AI가 즐겨 쓰는 비유', fix: '"과정", "흐름" 또는 뺍니다' },
  { id: 'ai', re: /탐험|탐색해\s*(보세요|봐요|보아요)/, level: 'error', why: 'AI가 즐겨 쓰는 비유', fix: '"살펴보세요", "둘러보세요"' },
  { id: 'ai', re: /핵심\s*포인트|꿀팁|인사이트를\s*얻/, level: 'error', why: '상투어', fix: '"핵심", "팁" 또는 내용을 바로' },
  { id: 'ai', re: /혁신적|획기적|놀라운|완벽한|마법\s*같은|무궁무진|한\s*단계\s*(더\s*)?업그레이드/, level: 'error', why: '과장', fix: '사실만 씁니다' },
  { id: 'mark', re: /!{2,}|[!！].*[!！]/, level: 'error', why: '느낌표 남발', fix: '느낌표는 빼거나 한 번만' },
  { id: 'deco', find: (s) => (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.exec(s.replace(/[✓✔✕✖✎✏]/g, '')) || [''])[0], level: 'error', why: '이모지 장식', fix: '이모지를 뺍니다(반응 단추 같은 기능은 예외)' },
  { id: 'plain', re: /[(（]\s*(인터넷\s*주소|웹\s*주소|빠른\s*응답\s*코드|Quick\s*Response|무선\s*인터넷|쉼표로\s*구분된|휴대용\s*문서)/i, level: 'error', why: '흔한 용어를 굳이 풀어씀', fix: 'QR, URL, CSV, PDF, Wi-Fi는 그대로 씁니다' },
  { id: 'passive', re: /되어지|되어집|보여지|보여집|쓰여지|쓰여집|불리워/, level: 'error', why: '이중 피동', fix: '"돼요", "보여요", "쓰여요", "불려요"' },
  // ── 살핌: 대개 줄이거나 바꾸는 게 나은 것 ──
  { id: 'ai', re: /다양한/, level: 'warn', why: '뜻이 흐린 꾸밈말', fix: '무엇이 있는지 이름을 댑니다' },
  { id: 'ai', re: /효과적으로|효율적으로|체계적으로|적극적으로/, level: 'warn', why: '뜻이 흐린 꾸밈말', fix: '빼거나 구체적으로' },
  { id: 'ai', re: /지금\s*바로|손쉽게|간편하게|쉽고\s*빠르게|언제\s*어디서나|누구나\s*쉽게|새로운\s*경험|한층\s*더|극대화|차별화된|스마트한/, level: 'warn', why: '홍보 문구', fix: '무엇이 되는지 사실로 씁니다' },
  { id: 'ai', re: /오신\s*것을\s*환영|잊지\s*마세요|기대해\s*주세요|걱정하지\s*마세요|걱정\s*마세요/, level: 'warn', why: '채움 문구', fix: '빼고 할 일을 바로 씁니다' },
  { id: 'ai', re: /(해|가|넘어가|시작해|만들어|살펴)\s*볼까요\??$|어떨까요\??$/, level: 'warn', why: '권유로 끝맺음', fix: '"~해 보세요" 또는 사실만("완료했어요.")' },
  { id: 'ai', re: /여러분/, level: 'warn', why: '연설투', fix: '대개 빼도 뜻이 같습니다' },
  { id: 'trans', re: /활용하여|활용해\s*보세요/, level: 'warn', why: '딱딱함', fix: '"써서", "써 보세요"' },
  { id: 'trans', re: /하기\s*위해서는|하기\s*위하여/, level: 'warn', why: '딱딱함', fix: '"~하려면"' },
  { id: 'trans', re: /것입니다|되겠습니다|진행됩니다|제공됩니다/, level: 'warn', why: '공문투', fix: '해요체 능동문으로' },
  { id: 'trans', re: /(으)?로\s*인(해|하여)|함에\s*있어|하는\s*데\s*있어|에\s*있어서(의|는)|(확인|검토|수정|변경|삭제|저장|등록|설치|설정|결제|인증|업데이트|작업|처리|제출|접수|신청)[을를]\s*진행|이루어(집니다|져요|졌)|필요로\s*(합니다|해요|하는|한)|(것이|는\s*게)\s*가능(합니다|해요)/, level: 'warn', why: '번역투', fix: '"~해서", "~할 때", "~해요", "~할 수 있어요"처럼 풀이말로', not: ['doc'] },
  { id: 'trans', re: /금일|익일|명일|필히|기재|기입|상이(한|하|합)|송부|수령|요망|에\s*한(하여|해)\s|(발생|입력|미입력|사용|이용|접속|종료|완료|실패|초과|변경|선택|클릭)\s?시(?=[\s,]|에는|에도)/, level: 'warn', why: '공문투', fix: '"오늘", "다음 날", "꼭", "적기", "다른", "보내기", "받기", "~하면"', mask: true, not: ['doc'] },
  { id: 'formal', find: formalHit, level: 'warn', why: '합니다체 섞임', fix: '해요체로("~해요", "~돼요", "~해 주세요"). 개인정보 안내·약관·인용은 그대로', not: ['doc'] },
  { id: 'honor', re: /시겠(어요|습니까|나요)|[주하]시기\s*바랍니다|주시면\s*감사하겠|부탁\s*드(립니다|려요|릴게요)|여쭤|여쭙|귀하(의|께|는|가|를|에게)|고객님|주십시오|계신가요|계십니까|이신가요|이십니까/, level: 'warn', why: '과한 높임', fix: '"~할까요?", "~해 주세요", "~인가요?"(설문처럼 선의를 구할 때는 "~셨나요?"도 됨)', not: ['doc'] },
  { id: 'passive', re: /(완료|저장|변경|설정|등록|삭제|전송|적용|복사|생성|추가|연결|처리|반영|수정|제출|발송|공개|업로드|게시)(이|가)?\s?(되었|됐)(습니다|어요)/, level: 'warn', why: '수동 표현', fix: '"~했어요"로(끝남·만료·제한처럼 상태를 알릴 때는 그대로)', not: ['doc'] },
  { id: 'passive', re: /되어요/, level: 'warn', why: '"되어요"', fix: '"돼요"' },
  { id: 'noun', find: nounStackHit, level: 'warn', why: '명사 나열', fix: '풀이말로 끝냅니다("설정을 바꿨어요", "저장하지 못했어요"). 정해진 용어는 그대로 둡니다', only: ['text', 'toast', 'error'] },
  { id: 'error', re: /죄송합니다|죄송해요|불편을\s*드려|양해\s*(부탁|바랍)/, level: 'warn', why: '사과 문구', fix: '사과 대신 무엇이 안 됐고 어떻게 하면 되는지' },
  { id: 'mark', re: /(?<![[!！])[!！](?![!！])/, level: 'warn', why: '느낌표', fix: '마침표로 끝냅니다', unless: /!{2,}|[!！].*[!！]/, not: ['doc'] },
  { id: 'mark', re: /\.{3}/, level: 'warn', why: '마침표 세 개', fix: '줄임표 "…" 한 글자로' },
  { id: 'mark', re: /[가-힣○)]\s?(을\(를\)|를\(을\)|은\(는\)|는\(은\)|이\(가\)|가\(이\)|와\(과\)|과\(와\)|\(으\)로|\(이\)나)/, level: 'warn', why: '조사 병기', fix: '받침에 맞는 조사를 고르거나 조사가 필요 없게 문장을 바꿉니다("○ 뺐어요" → "뺐어요: ○")' },
  { id: 'cta', re: /^(확인|예|네|아니오|아니요|OK|Ok|ok|제출|진행|Yes|No)$/, level: 'warn', why: '뜻이 흐린 단추 이름', fix: '누르면 일어나는 일을 동사로("지우기", "보내기", "닫기")', only: ['button', 'cta'] },
  { id: 'cta', re: /^취소$/, level: 'warn', why: '"취소"는 하던 일을 멈출 때만', fix: '창만 닫는 단추는 "닫기"(진행 중인 작업을 멈추면 "멈추기"·"취소")', only: ['button', 'cta'] },
];

/**
 * 용어 통일: 같은 것을 두 이름으로 부르지 않습니다(docs/writing.md 4절의 표).
 * page: true면 AI가 쓰는 참가자 화면 글에도 적용 · unless: 이 말이 함께 있으면 통과(다른 서비스의 화면 이름 등)
 * only: 'app'이면 앱 화면 글에만 · not: 이 칸에서는 보지 않음 · to: 바꿀 말(고친 안을 만들 때)
 */
export const TERM_RULES = [
  { re: /참여자|수강생|연수생/, why: '참가자', fix: '"참가자"', to: '참가자', page: true },
  { re: /(입장|참여|접속)\s?코드/, why: '연수 코드', fix: '"연수 코드"', to: '연수 코드', page: true },
  { re: /실시간\s?(기능|연결(?![됨돼되]))(?!\s?방식)/, why: '참여 기능', fix: '질문·도움 요청·진행 현황을 묶어 "참여 기능"(서버는 "실시간 서버")', to: '참여 기능', page: true },
  { re: /클릭/, why: '누르기', fix: '"누르세요", "눌러"(휴대폰에서도 맞는 말)', page: true },
  { re: /버튼/, why: '단추', fix: '"단추"', to: '단추' },
  { re: /미리\s보기/, why: '미리보기', fix: '"미리보기"(붙여 씀)', to: '미리보기' },
  { re: /QR\s?코드|큐알/, why: 'QR', fix: '"QR"(화면 읽기 프로그램용 이름표는 "QR 코드"도 됨)', to: 'QR', not: ['aria'] },
  { re: /만족도\s?설문/, why: '만족도 조사', fix: '섹션 이름은 "만족도 조사", 문항·응답은 "설문"', to: '만족도 조사' },
  { re: /다운로드|다운\s?받/, why: '내려받기', fix: '단추는 "받기"·"내려받기", 문장은 "내려받아요"' },
  { re: /삭제/, why: '지우기', fix: '"지우기", "지웠어요"(개인정보 안내의 법률 용어는 그대로)' },
  { re: /프로젝트/, unless: /Vercel|Supabase|Cloudflare|구글|Google|GitHub|Netlify|그\s프로젝트|프로젝트\s?(URL|이름|만들기)|새\s프로젝트|결제/, why: '연수 · 저장한 파일', fix: '만든 것은 "연수", .lecpage는 "저장한 파일"(단추 "파일로 저장"·"저장한 파일 열기"와 같게). 다른 서비스의 프로젝트는 그대로', only: 'app' },
  { re: /배포/, unless: /Apps\s?Script|웹\s앱|새\s배포|배포\s관리|배포\s보호|배포할\s때|배포를\s누|배포\s→|ADMIN_KEY/, why: '공개 · 올리기', fix: '"공개", "올리기"(다른 서비스 화면의 "배포"는 그대로)', only: 'app' },
  { re: /이미지/, why: '그림', fix: '"그림"(찍은 것은 "사진")', to: '그림' },
  { re: /(?<![가-힣])더하기$/, why: '추가', fix: '단추는 "추가"(교재·파일은 "넣기"). 문장 속 "더하다"는 그대로', to: '추가' },
  { re: /에러|재시도|다시\s시도/, why: '오류 · 다시 하기', fix: '"오류", "다시 해 주세요"' },
  { re: /스마트폰|핸드폰|모바일(?!\s?(앱|웹))/, why: '휴대폰', fix: '"휴대폰"', to: '휴대폰' },
  { re: /새로고침/, why: '새로 고침', fix: '"새로 고침"(띄어 씀)', to: '새로 고침' },
  { re: /닉네임/, why: '별명', fix: '"별명"', to: '별명' },
];

/** 용어 점검. group: 'app' | 'page' · pageOnly: 참가자 화면에도 쓰는 용어만 */
function termHits(s, kind, group, pageOnly) {
  const out = [];
  for (const t of TERM_RULES) {
    if ((pageOnly && !t.page) || (t.only && t.only !== group) || (t.not && t.not.includes(kind))) continue;
    const m = t.re.exec(s);
    if (m && !(t.unless && t.unless.test(s))) out.push({ id: 'term', level: 'warn', why: `용어: ${t.why}`, fix: t.fix, hit: m[0] });
  }
  return out;
}

/** 대문자 영어 낱말 중 장식이 아닌 것 */
const CAPS_OK = new Set(['QR', 'URL', 'CSV', 'PDF', 'PPT', 'PPTX', 'HWP', 'HWPX', 'DOCX', 'AI', 'FAQ', 'OX', 'PART', 'ID', 'SNS', 'API', 'USB', 'LAN', 'PC', 'HTML', 'CC', 'KOGL', 'NEIS', 'SEL', 'MP3', 'MP4', 'TXT', 'LINK', 'FILE', 'ZIP', 'GPT', 'IT', 'STEAM', 'UDL', 'PBL', 'KST', 'NAS', 'SQL', 'JSON', 'PNG', 'JPG', 'MIT', 'ADMIN_KEY']);

/** 칸별 길이 한도(글자 수). 넘으면 warn */
export const LENGTH_LIMITS = { nav: 5, cta: 14, button: 14, title: 34, label: 20, toast: 50, sentence: 70 };

/**
 * 문구 하나 점검.
 * kind: nav·cta·button·title·text(강의 페이지) + label·toast·error·aria·placeholder(앱 화면) + doc(개인정보 안내·약관·문서: 말투는 보지 않음)
 * opts.terms: 'page'(기본: 참가자 화면에도 쓰는 용어만) | 'all'(앱 화면 글까지) | 'none' · opts.group: 'app' | 'page'
 * @returns {{id:string, level:string, why:string, fix:string, hit:string}[]}
 */
export function lintText(text, kind = 'text', opts = {}) {
  const s = String(text || '').trim();
  if (!s) return [];
  const out = [];
  for (const r of COPY_RULES) {
    if ((r.only && !r.only.includes(kind)) || (r.not && r.not.includes(kind)) || (r.unless && r.unless.test(s))) continue;
    const src = r.mask ? maskFixed(s) : s;
    const hit = r.find ? r.find(src, kind) : (r.re.exec(src) || [''])[0];
    if (hit) out.push({ id: r.id, level: r.level, why: r.why, fix: r.fix, hit });
  }
  const terms = opts.terms || 'page';
  if (kind !== 'doc') {
    const e = errorHit(s, kind); if (e) out.push({ id: 'error', level: 'warn', ...e });
    if (terms !== 'none') out.push(...termHits(s, kind, opts.group || 'page', terms !== 'all'));
  }
  // 영어 대문자 장식(DATE, SPEAKER, TODAY'S WORKSHOP): 글의 절반 넘게가 대문자 낱말일 때만. "COUNTIFS로 세세요" 같은 함수 이름은 통과
  const caps = (s.match(/\b[A-Z][A-Z'’]{2,}\b/g) || []).filter((w) => !CAPS_OK.has(w.replace(/['’].*/, '')));
  if (caps.length && caps.join('').length * 2 >= s.replace(/[\s·×|/\-–—:]+/g, '').length) out.push({ id: 'deco', level: 'warn', why: '영어 대문자 장식', fix: '우리말로 쓰거나 뺍니다', hit: caps.join(' ') });
  const len = [...s.replace(/\s+/g, ' ')].length;
  const lim = LENGTH_LIMITS[kind];
  if (lim && len > lim) out.push({ id: 'len', level: 'warn', why: `${kind} ${lim}자 넘음(${len}자)`, fix: '짧은 낱말·동사로', hit: s.slice(0, 20) });
  if (kind === 'text' || kind === 'error') { const long = s.split(/(?<=[.?!요다])\s+|\n/).find((x) => [...x].length > LENGTH_LIMITS.sentence); if (long) out.push({ id: 'len', level: 'warn', why: `문장이 ${LENGTH_LIMITS.sentence}자 넘음`, fix: '둘로 나눕니다', hit: long.slice(0, 24) + '…' }); }
  return out;
}

/** 기계적으로 바꿔도 뜻이 같은 것만 고친 안(어미·피동·문장부호·용어). 바꿀 게 없으면 '' */
const jong = (ch) => (ch.charCodeAt(0) - 0xac00) % 28;
const pick = (c, a, b) => (hasBatchim(c) ? a : b);
const VERB_I = new Set([...'쌓놓보쓰모붙줄늘높먹속섞묶덮닫끓녹죽꺾깎들벌']);
// 합니다체 → 해요체: ㅆ 받침(했·었·겠·있…)과 없·않·합·됩·입만. 규칙 활용이라 틀리지 않음(받·듣·고르 같은 것은 사람이 고침)
const FORMAL_FIX = [
  [/([가-힣])습니다(?=[.?!\s]|$)/g, (m, c) => (c === '않' ? '않아요' : c === '없' || jong(c) === 20 ? c + '어요' : m)],
  [/([가-힣])습니까\?/g, (m, c) => (c === '않' || c === '없' || jong(c) === 20 ? c + '나요?' : m)],
  [/합니다(?=[.?!\s]|$)/g, '해요'], [/됩니다(?=[.?!\s]|$)/g, '돼요'], [/십시오/g, '세요'],
  // "○○입니다"(이다)만. "쌓입니다·보입니다"처럼 한 글자 줄기에 -이-가 붙은 움직씨는 그대로 둠
  [/(^|[^가-힣])?([가-힣]+)입니다(?=[.?!\s]|$)/g, (m, pre = '', w) => (w.length === 1 && VERB_I.has(w) ? m : pre + w + pick(w[w.length - 1], '이에요', '예요'))],
];
const OTHER_FIX = [
  [/되어요/g, '돼요'],
  [/(완료|저장|변경|설정|등록|삭제|전송|적용|복사|생성|추가|연결|처리|반영|수정|제출|발송|공개|업로드|게시)(?:이|가)?\s?(?:되었|됐)(?:습니다|어요)/g, '$1했어요'],
  [/([가-힣])(을\(를\)|를\(을\))/g, (_, c) => c + pick(c, '을', '를')], [/([가-힣])(은\(는\)|는\(은\))/g, (_, c) => c + pick(c, '은', '는')],
  [/([가-힣])(이\(가\)|가\(이\))/g, (_, c) => c + pick(c, '이', '가')],
  [/\.{3}/g, '…'], [/([요다])\s?!+/g, '$1.'],
];
const PARTICLE = { 을: ['을', '를'], 를: ['을', '를'], 이: ['이', '가'], 가: ['이', '가'], 은: ['은', '는'], 는: ['은', '는'], 과: ['과', '와'], 와: ['과', '와'] };
/**
 * 기계적으로 바꿔도 뜻이 같은 것만 고친 안: 합니다체 어미·피동·조사 병기·문장부호·용어(뒤 조사까지 맞춤).
 * opts.terms: 'page'(기본) | 'all' | 'none'. 바꿀 게 없으면 ''
 */
export function suggestFix(text, kind = 'text', opts = {}) {
  const src = String(text || ''); let s = src;
  if (kind === 'doc') return '';
  if (formalHit(s) || /수\s*있습니다/.test(s)) for (const [re, to] of FORMAL_FIX) s = s.replace(re, to);
  for (const [re, to] of OTHER_FIX) s = s.replace(re, to);
  const terms = opts.terms || 'page';
  if (terms !== 'none') for (const t of TERM_RULES) {
    if (!t.to || (terms !== 'all' && !t.page) || (t.not && t.not.includes(kind)) || (t.unless && t.unless.test(s))) continue;
    const last = t.to[t.to.length - 1];
    s = s.replace(new RegExp(`(?:${t.re.source})(?<pp>을|를|이|가|은|는|과|와)?(?![가-힣])`, 'g'), (...a) => { const p = a[a.length - 1].pp; return t.to + (p ? pick(last, ...PARTICLE[p]) : ''); });
  }
  return s !== src ? s : '';
}

/** AI 프롬프트에 넣을 짧은 규칙 문단 */
export function copyRulesPrompt() {
  return [
    '문구 규칙(참가자 화면):',
    '- 해요체, 짧게. 한 문장 한 가지, 70자 안. 단추·메뉴는 동사나 명사 하나(메뉴 2~4자, 단추 12자 안).',
    `- 흔한 용어는 그대로 쓴다: ${PLAIN_TERMS.join(', ')}. 교육 행정 용어(직무연수, 이수 기준, 출석 확인, 차시)도 풀어 쓰지 않는다.`,
    '- 능동으로, 높임은 가볍게: "저장되었습니다" → "저장했어요", "~하시겠어요?" → "~할까요?". 안 되는 일은 무엇이 안 됐는지와 다음 할 일을 함께.',
    '- 쓰지 않는 말: "~를 통해", "~할 수 있습니다", "함께 ~해 보아요", "알아볼까요/알아보겠습니다", "~하는 시간을 가져요", "여정", "탐험", "핵심 포인트", "꿀팁", "혁신적인·놀라운·완벽한", 느낌표, 이모지, 제목 위 영어 대문자 장식(DATE, SPEAKER, TODAY 등).',
    '- 줄일 말: "다양한", "효과적으로", "여러분", "활용하여", "~하기 위해서는", "~것입니다".',
  ].join('\n');
}
