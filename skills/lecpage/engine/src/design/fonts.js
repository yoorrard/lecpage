// 생성 사이트가 쓰는 글꼴 목록. 모두 상업적 이용이 가능한 무료 글꼴(OFL 등)만 둡니다.
// css: 외부 스타일시트(버전 고정), face: 직접 @font-face를 만들 때의 파일 목록
const GF = (q) => `https://fonts.googleapis.com/css2?${q}&display=swap`;
const NV = 'https://hangeul.pstatic.net/hangeul_static/webfont';

export const FONTS = {
  pretendard: {
    family: 'Pretendard Variable', label: 'Pretendard', kind: 'sans', license: 'OFL-1.1',
    css: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css',
    fallback: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif",
  },
  suit: {
    family: 'SUIT Variable', label: 'SUIT', kind: 'sans', license: 'OFL-1.1',
    css: 'https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2.0.5/fonts/variable/woff2/SUIT-Variable.css',
    fallback: "'Pretendard Variable', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
  },
  wanted: {
    family: 'Wanted Sans Variable', label: 'Wanted Sans', kind: 'sans', license: 'OFL-1.1',
    css: 'https://cdn.jsdelivr.net/gh/wanteddev/wanted-sans@v1.0.3/packages/wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.min.css',
    fallback: "'Pretendard Variable', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
  },
  gmarket: {
    family: 'GmarketSans', label: 'G마켓 산스', kind: 'sans', license: 'OFL-1.1 (G마켓 공식 배포)',
    face: [
      { weight: 300, url: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansLight.woff' },
      { weight: 500, url: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansMedium.woff' },
      { weight: 700, url: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansBold.woff' },
    ],
    fallback: "'Pretendard Variable', 'Apple SD Gothic Neo', sans-serif",
  },
  // 네이버 CSS는 굵기마다 이름이 달라(MaruBuriBold…) 굵게 쓰면 가짜 굵기가 됩니다 → 굵기별 @font-face를 직접 만듦
  maruburi: {
    family: 'MaruBuri', label: '마루 부리', kind: 'serif', license: 'OFL-1.1(네이버 마루 부리)',
    face: [
      { weight: 400, url: `${NV}/MaruBuri/MaruBuri-Regular.woff` },
      { weight: 600, url: `${NV}/MaruBuri/MaruBuri-SemiBold.woff` },
      { weight: 700, url: `${NV}/MaruBuri/MaruBuri-Bold.woff` },
    ],
    fallback: "'Noto Serif KR', 'AppleMyungjo', 'Batang', serif",
  },
  notoSans: { family: 'Noto Sans KR', label: 'Noto Sans KR(본고딕)', kind: 'sans', license: 'OFL-1.1', css: GF('family=Noto+Sans+KR:wght@400;500;700;800'), fallback: "'Pretendard Variable', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" },
  nanumGothic: { family: 'Nanum Gothic', label: '나눔고딕', kind: 'sans', license: 'OFL-1.1', css: GF('family=Nanum+Gothic:wght@400;700;800'), fallback: "'Pretendard Variable', 'Apple SD Gothic Neo', sans-serif" },
  nanumMyeongjo: { family: 'Nanum Myeongjo', label: '나눔명조', kind: 'serif', license: 'OFL-1.1', css: GF('family=Nanum+Myeongjo:wght@400;700;800'), fallback: "'Noto Serif KR', 'AppleMyungjo', serif" },
  nanumSquare: {
    family: 'NanumSquare', label: '나눔스퀘어', kind: 'sans', license: 'OFL-1.1(네이버 나눔스퀘어)',
    face: [
      { weight: 400, url: `${NV}/NanumSquare/NanumSquareR.woff` },
      { weight: 700, url: `${NV}/NanumSquare/NanumSquareB.woff` },
      { weight: 800, url: `${NV}/NanumSquare/NanumSquareEB.woff` },
    ],
    fallback: "'Pretendard Variable', 'Apple SD Gothic Neo', sans-serif",
  },
  nanumSquareRound: {
    family: 'NanumSquareRound', label: '나눔스퀘어라운드', kind: 'rounded', license: 'OFL-1.1(네이버 나눔스퀘어라운드)',
    face: [
      { weight: 400, url: `${NV}/NanumSquareRound/NanumSquareRoundR.woff` },
      { weight: 700, url: `${NV}/NanumSquareRound/NanumSquareRoundB.woff` },
      { weight: 800, url: `${NV}/NanumSquareRound/NanumSquareRoundEB.woff` },
    ],
    fallback: "'Pretendard Variable', 'Apple SD Gothic Neo', sans-serif",
  },
  nanumSquareNeo: { family: 'NanumSquareNeoVariable', label: '나눔스퀘어 네오', kind: 'sans', license: 'OFL-1.1(네이버 나눔스퀘어 네오)', css: 'https://hangeul.pstatic.net/hangeul_static/css/nanum-square-neo.css', fallback: "'Pretendard Variable', 'Apple SD Gothic Neo', sans-serif" },
  nanumBarun: {
    family: 'NanumBarunGothic', label: '나눔바른고딕', kind: 'sans', license: 'OFL-1.1(네이버 나눔바른고딕)',
    face: [
      { weight: 400, url: `${NV}/NanumBarunGothic/NanumBarunGothicWeb.woff` },
      { weight: 700, url: `${NV}/NanumBarunGothic/NanumBarunGothicWebBold.woff` },
    ],
    fallback: "'Pretendard Variable', 'Apple SD Gothic Neo', sans-serif",
  },
  nanumPen: { family: 'Nanum Pen Script', label: '나눔손글씨 펜', kind: 'hand', license: 'OFL-1.1', css: GF('family=Nanum+Pen+Script'), fallback: "'Gaegu', 'Pretendard Variable', sans-serif", displayWeight: 400 },
  nanumBrush: { family: 'Nanum Brush Script', label: '나눔손글씨 붓', kind: 'hand', license: 'OFL-1.1', css: GF('family=Nanum+Brush+Script'), fallback: "'Gaegu', 'Pretendard Variable', sans-serif", displayWeight: 400 },
  spoqa: { family: 'Spoqa Han Sans Neo', label: '스포카 한 산스 네오', kind: 'sans', license: 'OFL-1.1', css: 'https://cdn.jsdelivr.net/gh/spoqa/spoqa-han-sans@3.3.0/css/SpoqaHanSansNeo.css', fallback: "'Pretendard Variable', 'Apple SD Gothic Neo', sans-serif" },
  gothicA1: { family: 'Gothic A1', label: '고딕 A1', kind: 'sans', license: 'OFL-1.1', css: GF('family=Gothic+A1:wght@400;700;900'), fallback: "'Pretendard Variable', sans-serif" },
  songMyung: { family: 'Song Myung', label: '송명', kind: 'serif', license: 'OFL-1.1', css: GF('family=Song+Myung'), fallback: "'Noto Serif KR', serif", displayWeight: 400 },
  notoSerif: { family: 'Noto Serif KR', label: 'Noto Serif KR', kind: 'serif', license: 'OFL-1.1', css: GF('family=Noto+Serif+KR:wght@400;600;800'), fallback: "'AppleMyungjo', 'Batang', serif" },
  hahmlet: { family: 'Hahmlet', label: '함렛', kind: 'serif', license: 'OFL-1.1', css: GF('family=Hahmlet:wght@300..900'), fallback: "'Noto Serif KR', serif" },
  gowunBatang: { family: 'Gowun Batang', label: '고운바탕', kind: 'serif', license: 'OFL-1.1', css: GF('family=Gowun+Batang:wght@400;700'), fallback: "'Noto Serif KR', serif" },
  gowunDodum: { family: 'Gowun Dodum', label: '고운돋움', kind: 'sans', license: 'OFL-1.1', css: GF('family=Gowun+Dodum'), fallback: "'Pretendard Variable', sans-serif" },
  jua: { family: 'Jua', label: '주아', kind: 'display', license: 'OFL-1.1', css: GF('family=Jua'), fallback: "'Pretendard Variable', sans-serif", displayWeight: 400 },
  gaegu: { family: 'Gaegu', label: '개구', kind: 'hand', license: 'OFL-1.1', css: GF('family=Gaegu:wght@400;700'), fallback: "'Pretendard Variable', sans-serif", displayWeight: 700 },
  blackHan: { family: 'Black Han Sans', label: '검은고딕', kind: 'display', license: 'OFL-1.1', css: GF('family=Black+Han+Sans'), fallback: "'Pretendard Variable', sans-serif", displayWeight: 400 },
  doHyeon: { family: 'Do Hyeon', label: '도현', kind: 'display', license: 'OFL-1.1', css: GF('family=Do+Hyeon'), fallback: "'Pretendard Variable', sans-serif", displayWeight: 400 },
  gasoek: { family: 'Gasoek One', label: '가석', kind: 'display', license: 'OFL-1.1', css: GF('family=Gasoek+One'), fallback: "'Black Han Sans', sans-serif", displayWeight: 400 },
  orbit: { family: 'Orbit', label: '오르빗', kind: 'display', license: 'OFL-1.1', css: GF('family=Orbit'), fallback: "'Pretendard Variable', sans-serif", displayWeight: 400 },
  plexKr: { family: 'IBM Plex Sans KR', label: 'IBM Plex Sans KR', kind: 'sans', license: 'OFL-1.1', css: GF('family=IBM+Plex+Sans+KR:wght@400;500;600;700'), fallback: "'Pretendard Variable', sans-serif" },
  plexMono: { family: 'IBM Plex Mono', label: 'IBM Plex Mono', kind: 'mono', license: 'OFL-1.1', css: GF('family=IBM+Plex+Mono:wght@400;500;600'), fallback: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  jetbrains: { family: 'JetBrains Mono', label: 'JetBrains Mono', kind: 'mono', license: 'OFL-1.1', css: GF('family=JetBrains+Mono:wght@400;600'), fallback: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  spaceGrotesk: { family: 'Space Grotesk', label: 'Space Grotesk', kind: 'latin', license: 'OFL-1.1', css: GF('family=Space+Grotesk:wght@400;500;700'), fallback: 'system-ui, sans-serif' },
  fraunces: { family: 'Fraunces', label: 'Fraunces', kind: 'latin-serif', license: 'OFL-1.1', css: GF('family=Fraunces:opsz,wght@9..144,400..800'), fallback: 'Georgia, serif' },
  bricolage: { family: 'Bricolage Grotesque', label: 'Bricolage Grotesque', kind: 'latin', license: 'OFL-1.1', css: GF('family=Bricolage+Grotesque:opsz,wght@12..96,400..800'), fallback: 'system-ui, sans-serif' },
};

export function fontStack(key) {
  const f = FONTS[key];
  if (!f) return FONTS.pretendard.fallback;
  return `'${f.family}', ${f.fallback}`;
}

/** 글꼴 키 목록 → <link> 태그용 URL 목록과 @font-face CSS */
export function fontAssets(keys) {
  const links = []; let faceCss = '';
  for (const k of [...new Set(keys.filter(Boolean))]) {
    const f = FONTS[k]; if (!f) continue;
    if (f.css) links.push(f.css);
    if (f.face) for (const fc of f.face) {
      faceCss += `@font-face{font-family:'${f.family}';src:url('${fc.url}') format('${/\.woff2$/.test(fc.url) ? 'woff2' : 'woff'}');font-weight:${fc.weight};font-display:swap}\n`;
    }
  }
  return { links: [...new Set(links)], faceCss };
}

// ── 교재 글꼴 → 웹 글꼴 ───────────────────────────────────────
// 교재(PPTX·DOCX·HWPX·PDF)에 쓰인 글꼴 이름을 위 목록의 웹 글꼴로 바꿉니다.
// 같은 글꼴의 무료 웹 버전이 있으면 그대로(exact), 없으면 결이 비슷한 무료 글꼴로 바꿉니다.
// 유료·독점 글꼴 파일은 절대 싣지 않습니다(이름만 보고 비슷한 무료 글꼴을 고름).

/** 글꼴 이름 정리: PDF 부분집합 접두어(ABCDEF+), 굵기·형식 꼬리(Bold, -Medium, OTF, 볼드…) 떼기 */
export function fontFamilyName(raw) {
  let s = String(raw || '').trim().replace(/^[A-Z]{6}\+/, '').replace(/^["']|["']$/g, '');
  if (!s || s.startsWith('+') || /^(g_d\d|f\d+|T\d+)$/i.test(s)) return '';
  s = s.replace(/_ac([A-Z]{1,2})$/, '').replace(/PS-?(Bold|Italic|BoldItalic)?MT$/, '').replace(/OTF(?=[_\s-]|$)/g, '').replace(/[_,]+/g, ' ');
  // CamelCase 꼬리 굵기: NanumGothicExtraBold → NanumGothic ExtraBold
  s = s.replace(/([a-z])(Ultra|Extra|Semi|Demi)?(Bold|Light|Medium|Regular|Black|Heavy|Thin|Book|Italic)$/g, '$1 $2$3');
  const W = /[\s-]+(ultra|extra|semi|demi)?\s*(bold|light|medium|regular|black|heavy|thin|book|italic|oblique|normal|eb|b|l|m|r|bd|lt|md|rg|ul|el|sb|variable|var|std|pro|psmt|mt|[1-9])$|\s*(볼드|굵게|굵은|레귤러|라이트|미디엄|가는|보통|엑스트라볼드)$/i;
  for (let i = 0; i < 4 && W.test(s); i++) s = s.replace(W, '');
  return s.replace(/\s+/g, ' ').trim();
}
const keyOf = (name) => fontFamilyName(name).toLowerCase().replace(/[\s\-_.·]/g, '');

// 이름 → 글꼴 키. exact = 같은 글꼴(웹 버전), 아니면 결이 비슷한 대체
const SAME = {
  pretendard: ['pretendard', '프리텐다드', 'pretendardjp', 'pretendardstd'],
  notoSans: ['notosanskr', 'notosanscjkkr', 'notosans', '본고딕', 'sourcehansanskr', 'sourcehansans', 'sourcehansansk', '노토산스'],
  notoSerif: ['notoserifkr', 'notoserifcjkkr', 'notoserif', '본명조', 'sourcehanserifkr', 'sourcehanserif', 'sourcehanserifk', '노토세리프'],
  nanumGothic: ['나눔고딕', 'nanumgothic'],
  nanumMyeongjo: ['나눔명조', 'nanummyeongjo', 'nanummyungjo'],
  nanumSquare: ['나눔스퀘어', 'nanumsquare', '나눔스퀘어ac', 'nanumsquareac'],
  nanumSquareNeo: ['나눔스퀘어네오', 'nanumsquareneo'],
  nanumSquareRound: ['나눔스퀘어라운드', 'nanumsquareround'],
  nanumBarun: ['나눔바른고딕', 'nanumbarungothic', 'nanumbareungothic'],
  nanumPen: ['나눔손글씨펜', 'nanumpenscript', 'nanumpen', '나눔펜'],
  nanumBrush: ['나눔손글씨붓', 'nanumbrushscript', 'nanumbrush', '나눔붓'],
  gmarket: ['gmarketsans', '지마켓산스', 'g마켓산스', 'gmarketsanstf'],
  spoqa: ['spoqahansansneo', 'spoqahansans', '스포카한산스네오', '스포카한산스'],
  suit: ['suit', '수트'],
  wanted: ['wantedsans', '원티드산스'],
  plexKr: ['ibmplexsanskr', 'ibmplexsans', 'plexsanskr'],
  gowunBatang: ['고운바탕', 'gowunbatang'],
  gowunDodum: ['고운돋움', 'gowundodum'],
  jua: ['주아', 'jua', 'bmjua', '배달의민족주아', '배민주아'],
  doHyeon: ['도현', 'dohyeon', 'bmdohyeon', '배달의민족도현', '배민도현'],
  blackHan: ['검은고딕', 'blackhansans'],
  maruburi: ['마루부리', 'maruburi'],
  hahmlet: ['함렛', 'hahmlet'],
  gaegu: ['개구', 'gaegu'],
  gothicA1: ['gothica1', '고딕a1'],
  songMyung: ['송명', 'songmyung'],
  gasoek: ['가석', 'gasoekone'],
  orbit: ['orbit', '오르빗'],
  jetbrains: ['jetbrainsmono'], plexMono: ['ibmplexmono'],
};
// 대체: 시스템 기본·유료 글꼴 → 결이 비슷한 무료 글꼴. sys = 프로그램 기본값이라 '고른 글꼴'로 보지 않음
const LIKE = [
  [['맑은고딕', 'malgungothic', 'malgun'], 'pretendard', 'sans', true],
  [['굴림', 'gulim', '굴림체', 'gulimche', '돋움', 'dotum', '돋움체', 'dotumche', '새굴림', 'newgulim'], 'pretendard', 'sans', true],
  [['applesdgothicneo', '애플산돌고딕neo', 'applegothic', '애플고딕', 'sfpro', 'sfprodisplay', 'sfprotext', 'segoeui', 'calibri', 'arial', 'helvetica', 'helveticaneue', 'aptos', 'verdana', 'tahoma', 'inter', 'roboto', 'opensans', 'lato', 'yu gothic', 'yugothic', 'meiryo', 'msgothic', 'mspgothic'], 'pretendard', 'sans', true],
  [['함초롬돋움', 'hcrdotum', '한컴돋움', 'hancomdotum'], 'notoSans', 'sans', true],
  [['바탕', 'batang', '바탕체', 'batangche', '궁서체', 'gungsuhche', '함초롬바탕', 'hcrbatang', '한컴바탕', 'hancombatang', 'applemyungjo', '애플명조', 'timesnewroman', 'times', 'georgia', 'cambria', 'garamond', 'msmincho', 'yumincho'], 'notoSerif', 'serif', true],
  [['궁서', 'gungsuh'], 'songMyung', 'serif', false],
  [['hy신명조', 'hysinmyeongjo', 'hysinmyeongjom', 'hy견명조', 'hygyeonmyeongjo', 'hy중명조', 'hymyeongjo', '휴먼명조', 'humanmyeongjo', 'kopub바탕', 'kopubbatang', 'kopubworld바탕', 'kopubworldbatang', '신명조', 'sinmyeongjo', 'smsinmyeongjo', '윤명조', 'yoonmyungjo', '산돌명조', 'rixmyeongjo'], 'notoSerif', 'serif', false],
  [['hy헤드라인', 'hyheadline', 'hyheadlinem', 'hy헤드라인m', '헤드라인', 'tmon몬소리', 'tmonmonsori', '여기어때잘난체', 'jalnan', '잘난체', 'bmhanna', '배민한나', '한나', 'hanna', '배달의민족한나'], 'blackHan', 'display', false],
  [['hy견고딕', 'hygothicextra', 'hygothic', 'hy그래픽', 'hygraphic', 'hy그래픽m', '나눔스퀘어eb', 'cafe24ohsquare', '카페24아네모네', 'cafe24anemone', '카페24오스퀘어'], 'gmarket', 'display', false],
  [['에스코어드림', 'scoredream', 's-coredream'], 'suit', 'sans', false],
  [['넥슨lv1고딕', 'nexonlv1gothic', '넥슨lv2고딕', 'nexonlv2gothic', '넥슨풋볼고딕', 'nexonfootballgothic'], 'pretendard', 'sans', false],
  [['hy중고딕', 'hygothic-medium', 'hygothicmedium', 'hy얕은샘물m', '휴먼고딕', 'humangothic', 'kopub돋움', 'kopubdotum', 'kopubworld돋움', 'kopubworlddotum', '윤고딕', 'yoongothic', '산돌고딕neo', 'sandollgothicneo', 'rixgothic', '스포카'], 'pretendard', 'sans', false],
  [['카페24써라운드', 'cafe24ssurround', 'cafe24ssurroundair', '카페24써라운드에어', 'tmoney둥근바람', 'tmoneyroundwind', '둥근모', 'neodgm', '빙그레', 'binggrae', '빙그레싸만코', '배민을지로', 'hy엽서', 'hyyeopseo', '휴먼엽서체'], 'nanumSquareRound', 'rounded', false],
  [['휴먼옛체', 'humanyetche', 'hy궁서', 'hygungso', '조선궁서', 'chosungs'], 'songMyung', 'serif', false],
  [['comicsansms', 'comicsans', '나눔손글씨', 'nanumhandwriting', 'hy엽서l', '카페24단정해', '카페24고운밤', '카페24쑥쑥', 'cafe24syongsyong', 'cafe24ssukssuk'], 'gaegu', 'hand', false],
  [['consolas', 'couriernew', 'courier', 'd2coding', 'menlo', 'monaco', 'sourcecodepro', 'firacode', 'nanumgothiccoding', '나눔고딕코딩'], 'jetbrains', 'mono', false],
];
const ALIAS = new Map();
for (const [id, keys] of Object.entries(SAME)) for (const k of keys) ALIAS.set(k.replace(/[\s\-_.·]/g, '').toLowerCase(), { id, exact: true, sys: false });
for (const [keys, id, cat, sys] of LIKE) for (const k of keys) { const kk = k.replace(/[\s\-_.·]/g, '').toLowerCase(); if (!ALIAS.has(kk)) ALIAS.set(kk, { id, exact: false, sys, cat }); }

const CAT_DEFAULT = { sans: 'pretendard', serif: 'notoSerif', rounded: 'nanumSquareRound', display: 'blackHan', hand: 'gaegu', mono: 'jetbrains' };
// 본문에 못 쓰는 제목용 글꼴 → 본문은 같은 결의 읽기 좋은 글꼴
const BODY_SAFE = { display: 'pretendard', hand: 'gowunDodum', rounded: 'nanumSquareRound', mono: 'pretendard' };
const KIND_CAT = { sans: 'sans', serif: 'serif', display: 'display', hand: 'hand', rounded: 'rounded', mono: 'mono', latin: 'sans', 'latin-serif': 'serif' };

/** 이름으로 결(분류) 짐작 */
function guessCategory(k) {
  if (/(mono|coding|코딩|courier|consol)/.test(k)) return 'mono';
  if (/(명조|myeongjo|myungjo|바탕|batang|serif|부리|궁서|gungs|song|mincho)/.test(k)) return 'serif';
  if (/(손글씨|script|hand|pen|붓|brush|펜|캘리|calli|일기|diary)/.test(k)) return 'hand';
  if (/(둥근|라운드|round|동글|말랑)/.test(k)) return 'rounded';
  if (/(헤드라인|headline|견고딕|black|heavy|ultra|display|impact|poster|포스터|그래픽|graphic|잘난|굵은)/.test(k)) return 'display';
  return 'sans';
}

/**
 * 교재 글꼴 이름 하나 → { id, label, exact, system, category, from }
 * role: 'display'(제목) | 'body'(본문). 본문에는 제목 전용 글꼴을 쓰지 않습니다.
 */
export function matchFont(name, role = 'body') {
  const from = fontFamilyName(name);
  const k = keyOf(name);
  if (!k) return null;
  let hit = ALIAS.get(k);
  if (!hit) {
    // 앞부분 일치(예: 'nanumgothiclight', 'pretendardgov')
    for (const [ak, v] of ALIAS) if (ak.length >= 4 && (k.startsWith(ak) || (k.length >= 5 && ak.startsWith(k)))) { hit = v; break; }
  }
  const category = hit ? (hit.cat || KIND_CAT[FONTS[hit.id]?.kind] || 'sans') : guessCategory(k);
  let id = hit ? hit.id : CAT_DEFAULT[category];
  let exact = !!hit?.exact;
  if (role === 'body' && BODY_SAFE[FONTS[id]?.kind === 'display' ? 'display' : FONTS[id]?.kind]) {
    const safe = BODY_SAFE[FONTS[id].kind === 'display' ? 'display' : FONTS[id].kind];
    if (safe && safe !== id) { id = safe; exact = false; }
  }
  return { id, label: FONTS[id]?.label || id, exact, system: !!hit?.sys, category, from };
}

/**
 * design.sourceFonts({display:{name}, body:{name}}) → 쓸 글꼴 키 {display, body} + 설명.
 * 프로그램 기본 글꼴(맑은 고딕·굴림·바탕 등)은 '고른 글꼴'이 아니므로 그 자리는 프리셋 글꼴을 그대로 둡니다.
 */
export function fontsFromSource(src) {
  if (!src || typeof src !== 'object') return null;
  const out = { fonts: {}, match: {} };
  for (const role of ['display', 'body']) {
    const name = src[role]?.name || (role === 'display' ? src.body?.name : '');
    if (!name) continue;
    const m = matchFont(name, role);
    if (!m) continue;
    out.match[role] = m;
    if (!m.system) out.fonts[role] = m.id;
  }
  return Object.keys(out.match).length ? out : null;
}
