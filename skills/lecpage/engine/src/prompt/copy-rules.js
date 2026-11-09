// 생성 사이트 문구 규칙(한 곳에서 관리): AI 프롬프트(bridge.js), copy-lint 스크립트, references/copywriting.md가 같은 목록을 씁니다.
// level: error = AI 티가 나는 말투·장식(고쳐야 함) / warn = 대개 줄이는 게 나음

/** 금지·주의 표현: [정규식, 왜, 이렇게] */
export const COPY_RULES = [
  // AI 특유의 말투
  { re: /[을를]\s*통해(서)?/, level: 'error', why: '번역투', fix: '"~로", "~에서", "~하며"로 바꾸거나 뺍니다' },
  { re: /수\s*있습니다/, level: 'error', why: '참가자 화면은 해요체', fix: '"~할 수 있어요" 또는 그냥 "~해요"' },
  { re: /(해|봐|가|와|만들어|알아|살펴|나눠|나누어)\s*보아요/, level: 'error', why: '어색한 권유', fix: '"~해 보세요" 또는 "~해요"' },
  { re: /함께\s*(해요|해\s*봐요|해\s*보아요|나눠요|만들어요|가요)\s*[!.]?$/, level: 'error', why: '빈 권유 문장', fix: '무엇을 하는지 동사로 바로 씁니다' },
  { re: /알아보(겠습니다|도록\s*하겠습니다|아요|기로\s*해요|ㄹ까요|볼까요)|알아볼까요/, level: 'error', why: '예고만 하는 문장', fix: '알려 줄 내용을 바로 씁니다' },
  { re: /시간을\s*가(져|집|지|졌)/, level: 'error', why: '군더더기', fix: '"~해요"로 줄입니다' },
  { re: /여정/, level: 'error', why: 'AI가 즐겨 쓰는 비유', fix: '"과정", "흐름" 또는 뺍니다' },
  { re: /탐험|탐색해\s*(보세요|봐요|보아요)/, level: 'error', why: 'AI가 즐겨 쓰는 비유', fix: '"살펴보세요", "둘러보세요"' },
  { re: /핵심\s*포인트|꿀팁|인사이트를\s*얻/, level: 'error', why: '상투어', fix: '"핵심", "팁" 또는 내용을 바로' },
  { re: /혁신적|획기적|놀라운|완벽한|마법\s*같은|무궁무진|한\s*단계\s*(더\s*)?업그레이드/, level: 'error', why: '과장', fix: '사실만 씁니다' },
  { re: /!{2,}|[!！].*[!！]/, level: 'error', why: '느낌표 남발', fix: '느낌표는 빼거나 한 번만' },
  { re: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, level: 'error', why: '이모지 장식', fix: '이모지를 뺍니다(반응 버튼 같은 기능은 예외)' },
  { re: /[(（]\s*(인터넷\s*주소|웹\s*주소|빠른\s*응답\s*코드|Quick\s*Response|무선\s*인터넷|쉼표로\s*구분된|휴대용\s*문서)/i, level: 'error', why: '흔한 용어를 굳이 풀어씀', fix: 'QR, URL, CSV, PDF, Wi-Fi는 그대로 씁니다' },
  // 대개 줄이는 게 나은 것
  { re: /다양한/, level: 'warn', why: '뜻이 흐린 꾸밈말', fix: '무엇이 있는지 이름을 댑니다' },
  { re: /효과적으로|효율적으로|체계적으로|적극적으로/, level: 'warn', why: '뜻이 흐린 꾸밈말', fix: '빼거나 구체적으로' },
  { re: /여러분/, level: 'warn', why: '연설투', fix: '대개 빼도 뜻이 같습니다' },
  { re: /활용하여|활용해\s*보세요/, level: 'warn', why: '딱딱함', fix: '"써서", "써 보세요"' },
  { re: /하기\s*위해서는|하기\s*위하여/, level: 'warn', why: '딱딱함', fix: '"~하려면"' },
  { re: /것입니다|되겠습니다|진행됩니다|제공됩니다/, level: 'warn', why: '공문투', fix: '해요체 능동문으로' },
];

/** 그대로 쓰는 흔한 용어(풀어 쓰지 않음) */
export const PLAIN_TERMS = ['QR', 'URL', 'CSV', 'PDF', 'Wi-Fi', '로그인', '프롬프트', 'AI', 'PPT', 'FAQ', '링크', '앱', '크롬북', 'Zoom'];
/** 대문자 영어 낱말 중 장식이 아닌 것 */
const CAPS_OK = new Set(['QR', 'URL', 'CSV', 'PDF', 'PPT', 'PPTX', 'HWP', 'HWPX', 'DOCX', 'AI', 'FAQ', 'OX', 'PART', 'ID', 'SNS', 'API', 'USB', 'LAN', 'PC', 'HTML', 'CC', 'KOGL', 'NEIS', 'SEL', 'MP3', 'MP4', 'TXT', 'LINK', 'FILE', 'ZIP', 'GPT', 'IT', 'STEAM', 'UDL', 'PBL', 'KST']);

/** 칸별 길이 한도(글자 수). 넘으면 warn */
export const LENGTH_LIMITS = { nav: 5, cta: 14, button: 14, title: 34, sentence: 70 };

/**
 * 문구 하나 점검. kind: nav·cta·title·text
 * @returns {{level:string, why:string, fix:string, hit:string}[]}
 */
export function lintText(text, kind = 'text') {
  const s = String(text || '').trim();
  if (!s) return [];
  const out = [];
  for (const r of COPY_RULES) { const m = r.re.exec(s); if (m) out.push({ level: r.level, why: r.why, fix: r.fix, hit: m[0] }); }
  // 영어 대문자 장식(DATE, SPEAKER, TODAY'S WORKSHOP): 글의 절반 넘게가 대문자 낱말일 때만. "COUNTIFS로 세세요" 같은 함수 이름은 통과
  const caps = (s.match(/\b[A-Z][A-Z'’]{2,}\b/g) || []).filter((w) => !CAPS_OK.has(w.replace(/['’].*/, '')));
  if (caps.length && caps.join('').length * 2 >= s.replace(/[\s·×|/\-–—:]+/g, '').length) out.push({ level: 'warn', why: '영어 대문자 장식', fix: '우리말로 쓰거나 뺍니다', hit: caps.join(' ') });
  const len = [...s.replace(/\s+/g, ' ')].length;
  const lim = LENGTH_LIMITS[kind];
  if (lim && kind !== 'text' && len > lim) out.push({ level: 'warn', why: `${kind} ${lim}자 넘음(${len}자)`, fix: '짧은 낱말·동사로', hit: s.slice(0, 20) });
  if (kind === 'text') { const long = s.split(/(?<=[.?!요다])\s+|\n/).find((x) => [...x].length > LENGTH_LIMITS.sentence); if (long) out.push({ level: 'warn', why: `문장이 ${LENGTH_LIMITS.sentence}자 넘음`, fix: '둘로 나눕니다', hit: long.slice(0, 24) + '…' }); }
  return out;
}

/** AI 프롬프트에 넣을 짧은 규칙 문단 */
export function copyRulesPrompt() {
  return [
    '문구 규칙(참가자 화면):',
    '- 해요체, 짧게. 한 문장 한 가지, 70자 안. 버튼·메뉴는 동사나 명사 하나(메뉴 2~4자, 버튼 12자 안).',
    `- 흔한 용어는 그대로 쓴다: ${PLAIN_TERMS.join(', ')}. 풀어 쓰지 않는다.`,
    '- 쓰지 않는 말: "~를 통해", "~할 수 있습니다", "함께 ~해 보아요", "알아볼까요/알아보겠습니다", "~하는 시간을 가져요", "여정", "탐험", "핵심 포인트", "꿀팁", "혁신적인·놀라운·완벽한", 느낌표 여러 개, 이모지, 제목 위 영어 대문자 장식(DATE, SPEAKER, TODAY 등).',
    '- 줄일 말: "다양한", "효과적으로", "여러분", "활용하여", "~하기 위해서는", "~것입니다".',
  ].join('\n');
}
