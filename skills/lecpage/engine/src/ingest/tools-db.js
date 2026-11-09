// 한국 교사 연수에서 자주 쓰는 교육·AI 도구 목록(2026-11 기준).
// 필드: id, name, aliases(한글·영문 이름), url, domains(링크 판별, 'docs.google.com/forms'처럼 경로 포함 가능),
//       category, accountNeeded(실습에 계정이 필요한가), account(계정 종류), minors(학생·미성년 사용 메모), icon(아이콘 힌트), korean(국내 서비스)
// strict: 대소문자를 그대로 맞춰야 하는 영문 별칭(일반 낱말과 헷갈리는 이름). 연령·약관은 바뀔 수 있어 '확인' 메모로 둡니다.

const AI_MINOR = '생성형 AI: 연령 제한과 학교·교육청 지침을 먼저 확인';
const CODE_JOIN = '학생은 참여 코드로 로그인 없이 참여(교사 계정 필요)';
const GOOGLE_EDU = '학생은 학교 Google Workspace for Education 계정 권장(관리자 설정 따름)';

export const CATEGORIES = {
  'ai-chat': 'AI 대화', 'ai-research': 'AI 자료 조사', 'ai-image': 'AI 이미지', 'ai-media': 'AI 영상·음악·음성', 'ai-slides': 'AI 발표 자료',
  'ai-lab': 'AI 체험·교육', design: '디자인', board: '협업 보드', quiz: '퀴즈·게임', survey: '설문·투표', class: '학급 운영',
  platform: '공공 학습 플랫폼', office: '문서·오피스', meeting: '화상 회의', coding: '코딩', physical: '피지컬 컴퓨팅', 'vr-ar': '메타버스·VR',
  video: '영상', translate: '번역', utility: '편의 도구', community: '교사 커뮤니티', math: '수학',
};

export const TOOLS = [
  // ── AI 대화·조사 ─────────────────────────
  { id: 'chatgpt', name: 'ChatGPT', aliases: ['챗GPT', '챗지피티', '챗 GPT', 'ChatGPT', 'Chat GPT', '쳇GPT'], url: 'https://chatgpt.com', domains: ['chatgpt.com', 'chat.openai.com'], category: 'ai-chat', accountNeeded: true, account: 'email', minors: '만 13세 이상, 만 18세 미만은 보호자 동의(약관). 학교 지침 확인', icon: 'chat' },
  { id: 'gemini', name: 'Gemini', aliases: ['제미나이', '제미니', 'Gemini', '구글 제미나이', 'Google Gemini', '제미나이 캔버스', 'Gemini Canvas', 'Gems'], strict: ['Gems'], url: 'https://gemini.google.com', domains: ['gemini.google.com', 'gemini.google'], category: 'ai-chat', accountNeeded: true, account: 'google', minors: GOOGLE_EDU, icon: 'sparkle' },
  { id: 'claude', name: 'Claude', aliases: ['클로드', 'Claude', '클로드 AI'], url: 'https://claude.ai', domains: ['claude.ai', 'claude.com'], category: 'ai-chat', accountNeeded: true, account: 'email', minors: '만 18세 이상만 이용(약관). 학생 직접 사용 불가', icon: 'chat' },
  { id: 'notebooklm', name: 'NotebookLM', aliases: ['노트북LM', '노트북 LM', '노트북엘엠', 'NotebookLM', 'Notebook LM', '노트북 엘엠'], url: 'https://notebooklm.google.com', domains: ['notebooklm.google.com', 'notebooklm.google'], category: 'ai-research', accountNeeded: true, account: 'google', minors: GOOGLE_EDU, icon: 'book' },
  { id: 'perplexity', name: 'Perplexity', aliases: ['퍼플렉시티', 'Perplexity'], strict: ['Perplexity'], url: 'https://www.perplexity.ai', domains: ['perplexity.ai'], category: 'ai-research', accountNeeded: false, account: 'email', minors: AI_MINOR, icon: 'search' },
  { id: 'copilot', name: 'Microsoft Copilot', aliases: ['코파일럿', 'Copilot', 'MS 코파일럿', '마이크로소프트 코파일럿', 'Bing Chat', '빙챗', '빙 챗'], url: 'https://copilot.microsoft.com', domains: ['copilot.microsoft.com', 'copilot.cloud.microsoft'], category: 'ai-chat', accountNeeded: false, account: 'microsoft', minors: AI_MINOR, icon: 'chat' },
  { id: 'wrtn', name: '뤼튼', aliases: ['뤼튼', 'wrtn', 'Wrtn', '뤼튼 AI'], url: 'https://wrtn.ai', domains: ['wrtn.ai', 'wrtn.io'], category: 'ai-chat', accountNeeded: true, account: 'email', minors: AI_MINOR, icon: 'chat', korean: true },
  { id: 'clova-x', name: 'CLOVA X', aliases: ['클로바X', '클로바 X', 'CLOVA X', 'ClovaX', '클로바엑스'], url: 'https://clova-x.naver.com', domains: ['clova-x.naver.com'], category: 'ai-chat', accountNeeded: true, account: 'naver', minors: AI_MINOR, icon: 'chat', korean: true },
  { id: 'genspark', name: 'Genspark', aliases: ['젠스파크', 'Genspark'], url: 'https://www.genspark.ai', domains: ['genspark.ai'], category: 'ai-research', accountNeeded: true, account: 'email', minors: AI_MINOR, icon: 'search' },
  { id: 'liner', name: 'Liner', aliases: ['라이너 AI', '라이너AI', 'Liner'], strict: ['Liner'], url: 'https://liner.com', domains: ['liner.com', 'getliner.com'], category: 'ai-research', accountNeeded: true, account: 'email', minors: AI_MINOR, icon: 'search', korean: true },
  { id: 'readray', name: 'Readray(릴리스AI)', aliases: ['릴리스AI', '릴리스 AI', '릴리즈AI', 'LilysAI', 'Lilys AI', 'Readray', '리드레이'], url: 'https://readray.ai', domains: ['readray.ai', 'lilys.ai'], category: 'ai-research', accountNeeded: true, account: 'email', minors: AI_MINOR, icon: 'video', korean: true },
  { id: 'aistudio', name: 'Google AI Studio', aliases: ['AI 스튜디오', 'AI Studio', '구글 AI 스튜디오', 'Google AI Studio'], url: 'https://aistudio.google.com', domains: ['aistudio.google.com'], category: 'ai-lab', accountNeeded: true, account: 'google', minors: '만 18세 이상(약관). 교사용', icon: 'sparkle' },
  { id: 'magicschool', name: 'MagicSchool', aliases: ['매직스쿨', 'MagicSchool', 'Magic School'], url: 'https://www.magicschool.ai', domains: ['magicschool.ai'], category: 'ai-chat', accountNeeded: true, account: 'google', minors: '교사용 + 교사가 연결한 학생용 공간 제공', icon: 'sparkle' },

  // ── AI 이미지·디자인·발표 ───────────────────
  { id: 'canva', name: 'Canva', aliases: ['캔바', 'Canva', '캔바 에듀', 'Canva for Education', '캔바 매직 스튜디오', 'Magic Studio'], url: 'https://www.canva.com', domains: ['canva.com', 'canva.link'], category: 'design', accountNeeded: true, account: 'google', minors: 'Canva for Education: 교사 인증 후 무료, 학생은 교사 초대로 참여', icon: 'palette' },
  { id: 'canva-code', name: 'Canva Code', aliases: ['캔바 코드', '캔바코드', 'Canva Code'], url: 'https://www.canva.com', domains: [], category: 'ai-lab', accountNeeded: true, account: 'google', minors: 'Canva 교육용 계정 정책 따름', icon: 'code' },
  { id: 'miricanvas', name: '미리캔버스', aliases: ['미리캔버스', '미리 캔버스', 'MiriCanvas', 'Miricanvas'], url: 'https://www.miricanvas.com', domains: ['miricanvas.com'], category: 'design', accountNeeded: true, account: 'email', minors: '학생은 교사가 공유한 디자인으로 참여 가능', icon: 'palette', korean: true },
  { id: 'mangoboard', name: '망고보드', aliases: ['망고보드', '망고 보드', 'Mangoboard'], url: 'https://www.mangoboard.net', domains: ['mangoboard.net'], category: 'design', accountNeeded: true, account: 'email', minors: '유료 기능 많음(학교 단체 이용권 확인)', icon: 'palette', korean: true },
  { id: 'adobe-express', name: 'Adobe Express', aliases: ['어도비 익스프레스', 'Adobe Express', '어도비익스프레스'], url: 'https://new.express.adobe.com', domains: ['express.adobe.com', 'new.express.adobe.com'], category: 'design', accountNeeded: true, account: 'email', minors: '초·중·고 교육용 무료 계정 제공(학교 인증)', icon: 'palette' },
  { id: 'firefly', name: 'Adobe Firefly', aliases: ['파이어플라이', 'Adobe Firefly', '어도비 파이어플라이', 'Firefly'], strict: ['Firefly'], url: 'https://firefly.adobe.com', domains: ['firefly.adobe.com'], category: 'ai-image', accountNeeded: true, account: 'email', minors: AI_MINOR, icon: 'image' },
  { id: 'ideogram', name: 'Ideogram', aliases: ['아이디오그램', 'Ideogram'], url: 'https://ideogram.ai', domains: ['ideogram.ai'], category: 'ai-image', accountNeeded: true, account: 'google', minors: AI_MINOR, icon: 'image' },
  { id: 'midjourney', name: 'Midjourney', aliases: ['미드저니', 'Midjourney', 'MidJourney'], url: 'https://www.midjourney.com', domains: ['midjourney.com'], category: 'ai-image', accountNeeded: true, account: 'email', minors: '유료 구독. ' + AI_MINOR, icon: 'image' },
  { id: 'ms-designer', name: 'Microsoft Designer', aliases: ['MS 디자이너', 'Microsoft Designer', '빙 이미지 크리에이터', 'Bing Image Creator', '이미지 크리에이터'], url: 'https://designer.microsoft.com', domains: ['designer.microsoft.com', 'bing.com/images/create'], category: 'ai-image', accountNeeded: true, account: 'microsoft', minors: AI_MINOR, icon: 'image' },
  { id: 'napkin', name: 'Napkin AI', aliases: ['냅킨 AI', '냅킨AI', 'Napkin AI', 'Napkin'], strict: ['Napkin'], url: 'https://www.napkin.ai', domains: ['napkin.ai'], category: 'ai-slides', accountNeeded: true, account: 'google', minors: AI_MINOR, icon: 'image' },
  { id: 'gamma', name: 'Gamma', aliases: ['감마', 'Gamma', '감마 앱', 'Gamma App', '감마AI', '감마 AI'], strict: ['Gamma'], url: 'https://gamma.app', domains: ['gamma.app'], category: 'ai-slides', accountNeeded: true, account: 'google', minors: AI_MINOR, icon: 'slides' },
  { id: 'remove-bg', name: 'remove.bg', aliases: ['리무브비지', '리무브 비지', 'remove.bg', 'Remove bg'], url: 'https://www.remove.bg', domains: ['remove.bg'], category: 'utility', accountNeeded: false, account: 'none', minors: '로그인 없이 사용 가능', icon: 'image' },
  { id: 'autodraw', name: 'AutoDraw', aliases: ['오토드로우', '오토 드로우', 'AutoDraw', 'Auto Draw'], url: 'https://www.autodraw.com', domains: ['autodraw.com'], category: 'ai-lab', accountNeeded: false, account: 'none', minors: '로그인 없이 사용 가능', icon: 'pen' },
  { id: 'quickdraw', name: 'Quick, Draw!', aliases: ['퀵드로우', '퀵 드로우', 'Quick Draw', 'Quick, Draw', 'QuickDraw'], url: 'https://quickdraw.withgoogle.com', domains: ['quickdraw.withgoogle.com'], category: 'ai-lab', accountNeeded: false, account: 'none', minors: '로그인 없이 사용 가능', icon: 'pen' },
  { id: 'scroobly', name: 'Scroobly', aliases: ['스크루블리', 'Scroobly'], url: 'https://www.scroobly.com', domains: ['scroobly.com'], category: 'ai-lab', accountNeeded: false, account: 'none', minors: '로그인 없이 사용(카메라 권한 필요)', icon: 'camera' },
  { id: 'chrome-music-lab', name: 'Chrome Music Lab', aliases: ['크롬 뮤직랩', '크롬뮤직랩', 'Chrome Music Lab', '송메이커', '송 메이커', 'Song Maker'], url: 'https://musiclab.chromeexperiments.com', domains: ['musiclab.chromeexperiments.com'], category: 'ai-lab', accountNeeded: false, account: 'none', minors: '로그인 없이 사용 가능', icon: 'music' },
  { id: 'semi-conductor', name: 'Semi-Conductor', aliases: ['세미컨덕터', '세미 컨덕터', 'Semi-Conductor', 'Semi Conductor'], url: 'https://semiconductor.withgoogle.com', domains: ['semiconductor.withgoogle.com'], category: 'ai-lab', accountNeeded: false, account: 'none', minors: '로그인 없이 사용(카메라 권한 필요)', icon: 'music' },
  { id: 'teachable-machine', name: 'Teachable Machine', aliases: ['티처블 머신', '티처블머신', 'Teachable Machine', '티쳐블 머신', '티쳐블머신'], url: 'https://teachablemachine.withgoogle.com', domains: ['teachablemachine.withgoogle.com'], category: 'ai-lab', accountNeeded: false, account: 'none', minors: '로그인 없이 사용(저장은 Google 계정)', icon: 'cube' },
  { id: 'ml4kids', name: 'Machine Learning for Kids', aliases: ['머신러닝 포 키즈', '머신 러닝 포 키즈', 'Machine Learning for Kids', 'ML4K'], url: 'https://machinelearningforkids.co.uk', domains: ['machinelearningforkids.co.uk'], category: 'ai-lab', accountNeeded: false, account: 'teacher', minors: '교사가 학급 계정을 만들어 학생 배정', icon: 'cube' },

  // ── AI 영상·음악·음성 ────────────────────────
  { id: 'suno', name: 'Suno', aliases: ['수노', 'Suno', '수노 AI', 'Suno AI'], url: 'https://suno.com', domains: ['suno.com', 'suno.ai'], category: 'ai-media', accountNeeded: true, account: 'google', minors: '연령 제한·저작권(상업 이용) 정책 확인', icon: 'music' },
  { id: 'vrew', name: 'Vrew', aliases: ['브루', 'Vrew', '브루 AI'], url: 'https://vrew.ai', domains: ['vrew.ai', 'vrew.voyagerx.com'], category: 'ai-media', accountNeeded: true, account: 'email', minors: '설치형(PC). 학교 PC 설치 권한 확인', icon: 'video', korean: true },
  { id: 'capcut', name: 'CapCut', aliases: ['캡컷', 'CapCut', 'Cap Cut'], url: 'https://www.capcut.com', domains: ['capcut.com'], category: 'ai-media', accountNeeded: true, account: 'email', minors: '연령 제한 확인(만 13세 이상 등)', icon: 'video' },
  { id: 'typecast', name: '타입캐스트', aliases: ['타입캐스트', 'Typecast'], url: 'https://typecast.ai', domains: ['typecast.ai'], category: 'ai-media', accountNeeded: true, account: 'email', minors: AI_MINOR, icon: 'mic', korean: true },
  { id: 'clova-dubbing', name: '클로바더빙', aliases: ['클로바더빙', '클로바 더빙', 'CLOVA Dubbing'], url: 'https://clovadubbing.naver.com', domains: ['clovadubbing.naver.com'], category: 'ai-media', accountNeeded: true, account: 'naver', minors: '네이버 계정 필요(연령 정책 확인)', icon: 'mic', korean: true },
  { id: 'clova-note', name: '클로바노트', aliases: ['클로바노트', '클로바 노트', 'CLOVA Note', 'ClovaNote'], url: 'https://clovanote.naver.com', domains: ['clovanote.naver.com'], category: 'ai-media', accountNeeded: true, account: 'naver', minors: '녹음 동의 필요. 개인정보 유의', icon: 'mic', korean: true },
  { id: 'youtube', name: 'YouTube', aliases: ['유튜브', 'YouTube', 'Youtube', '유튜브 스튜디오'], url: 'https://www.youtube.com', domains: ['youtube.com', 'youtu.be', 'm.youtube.com', 'youtube-nocookie.com'], category: 'video', accountNeeded: false, account: 'google', minors: '만 14세 미만 개인 채널 운영 제한. 학교망 차단 여부 확인', icon: 'play' },
  { id: 'google-vids', name: 'Google Vids', aliases: ['구글 Vids', 'Google Vids', '구글 비즈', '구글 vids'], url: 'https://vids.google.com', domains: ['vids.google.com', 'docs.google.com/videos'], category: 'ai-media', accountNeeded: true, account: 'google', minors: GOOGLE_EDU, icon: 'video' },
  { id: 'edpuzzle', name: 'Edpuzzle', aliases: ['에드퍼즐', 'Edpuzzle', 'EdPuzzle'], url: 'https://edpuzzle.com', domains: ['edpuzzle.com'], category: 'video', accountNeeded: true, account: 'google', minors: '학생은 교사 반 코드로 참여', icon: 'play' },

  // ── 협업 보드·문서 ────────────────────────────
  { id: 'padlet', name: 'Padlet', aliases: ['패들렛', 'Padlet', '파들렛'], url: 'https://padlet.com', domains: ['padlet.com', 'padlet.org'], category: 'board', accountNeeded: false, account: 'none', minors: '교사 보드에 학생은 로그인 없이 참여 가능(보드 설정에 따름)', icon: 'grid' },
  { id: 'miro', name: 'Miro', aliases: ['Miro', '미로 보드', '미로보드'], strict: ['Miro'], url: 'https://miro.com', domains: ['miro.com'], category: 'board', accountNeeded: true, account: 'email', minors: '교육용 무료 플랜(교사 인증)', icon: 'grid' },
  { id: 'figma', name: 'Figma', aliases: ['피그마', 'Figma'], url: 'https://www.figma.com', domains: ['figma.com'], category: 'design', accountNeeded: true, account: 'email', minors: '교육용 무료(학교 인증)', icon: 'pen' },
  { id: 'figjam', name: 'FigJam', aliases: ['피그잼', 'FigJam', 'Figjam'], url: 'https://www.figma.com/figjam/', domains: ['figma.com/figjam', 'figma.com/board'], category: 'board', accountNeeded: true, account: 'email', minors: '교육용 무료(학교 인증)', icon: 'grid' },
  { id: 'notion', name: 'Notion', aliases: ['노션', 'Notion'], strict: ['Notion'], url: 'https://www.notion.com', domains: ['notion.so', 'notion.site', 'notion.com'], category: 'office', accountNeeded: true, account: 'email', minors: '만 13세 이상(약관 확인)', icon: 'file' },
  { id: 'allo', name: 'ALLO', aliases: ['ALLO', '알로 보드', '알로 협업'], strict: ['ALLO'], url: 'https://allo.io', domains: ['allo.io'], category: 'board', accountNeeded: true, account: 'email', minors: '참여자는 초대 링크로 참여', icon: 'grid', korean: true },
  { id: 'google-docs', name: 'Google 문서', aliases: ['구글 문서', '구글 독스', '구글독스', 'Google Docs', '구글 닥스', '구글닥스', 'Google 문서'], url: 'https://docs.google.com/document/', domains: ['docs.google.com/document'], category: 'office', accountNeeded: true, account: 'google', minors: GOOGLE_EDU, icon: 'file' },
  { id: 'google-slides', name: 'Google 프레젠테이션', aliases: ['구글 프레젠테이션', '구글 슬라이드', '구글슬라이드', 'Google Slides', '구글 프리젠테이션', 'Google 프레젠테이션'], url: 'https://docs.google.com/presentation/', domains: ['docs.google.com/presentation'], category: 'office', accountNeeded: true, account: 'google', minors: GOOGLE_EDU, icon: 'slides' },
  { id: 'google-sheets', name: 'Google 스프레드시트', aliases: ['구글 스프레드시트', '구글 시트', '구글시트', 'Google Sheets', '구글 스프레드 시트', 'Google 스프레드시트'], url: 'https://docs.google.com/spreadsheets/', domains: ['docs.google.com/spreadsheets'], category: 'office', accountNeeded: true, account: 'google', minors: GOOGLE_EDU, icon: 'grid' },
  { id: 'google-forms', name: 'Google 설문지', aliases: ['구글 설문지', '구글 설문', '구글폼', '구글 폼', '구글 Forms', 'Google Forms', 'Google Form', 'Google 설문지'], url: 'https://docs.google.com/forms/', domains: ['docs.google.com/forms', 'forms.gle', 'forms.google.com'], category: 'survey', accountNeeded: false, account: 'google', minors: '응답자는 로그인 없이 응답 가능(설정에 따름)', icon: 'poll' },
  { id: 'google-drive', name: 'Google Drive', aliases: ['구글 드라이브', '구글드라이브', 'Google Drive', 'Google 드라이브'], url: 'https://drive.google.com', domains: ['drive.google.com'], category: 'office', accountNeeded: true, account: 'google', minors: GOOGLE_EDU, icon: 'file' },
  { id: 'google-classroom', name: 'Google Classroom', aliases: ['구글 클래스룸', '구글클래스룸', 'Google Classroom', 'Google 클래스룸'], url: 'https://classroom.google.com', domains: ['classroom.google.com'], category: 'class', accountNeeded: true, account: 'google', minors: GOOGLE_EDU, icon: 'school' },
  { id: 'google-sites', name: 'Google Sites', aliases: ['구글 사이트 도구', '구글 사이트도구', '구글사이트', 'Google Sites', 'Google 사이트 도구'], url: 'https://sites.google.com', domains: ['sites.google.com'], category: 'office', accountNeeded: true, account: 'google', minors: GOOGLE_EDU, icon: 'globe' },
  { id: 'google-earth', name: 'Google Earth', aliases: ['구글 어스', '구글어스', 'Google Earth', '구글 earth'], url: 'https://earth.google.com', domains: ['earth.google.com'], category: 'vr-ar', accountNeeded: false, account: 'none', minors: '로그인 없이 보기 가능(프로젝트 저장은 계정)', icon: 'globe' },
  { id: 'arts-culture', name: 'Google Arts & Culture', aliases: ['구글 아트 앤 컬처', '구글 아트앤컬처', '구글아트앤컬처', 'Arts & Culture', 'Google Arts and Culture', 'Google Arts & Culture'], url: 'https://artsandculture.google.com', domains: ['artsandculture.google.com'], category: 'vr-ar', accountNeeded: false, account: 'none', minors: '로그인 없이 사용 가능', icon: 'image' },
  { id: 'google-lens', name: 'Google 렌즈', aliases: ['구글 렌즈', '구글렌즈', 'Google Lens', 'Google 렌즈'], url: 'https://lens.google', domains: ['lens.google', 'lens.google.com'], category: 'utility', accountNeeded: false, account: 'none', minors: '사진 속 개인정보 유의', icon: 'camera' },
  { id: 'google-translate', name: 'Google 번역', aliases: ['구글 번역', '구글번역', '구글 번역기', 'Google Translate', 'Google 번역'], url: 'https://translate.google.com', domains: ['translate.google.com', 'translate.google.co.kr'], category: 'translate', accountNeeded: false, account: 'none', minors: '로그인 없이 사용 가능', icon: 'translate' },
  { id: 'apps-script', name: 'Google Apps Script', aliases: ['앱스 스크립트', '앱스스크립트', 'Apps Script', '구글 앱스 스크립트', 'Google Apps Script', '앱스크립트'], url: 'https://script.google.com', domains: ['script.google.com'], category: 'coding', accountNeeded: true, account: 'google', minors: '교사용(학교 계정은 관리자 허용 필요할 수 있음)', icon: 'code' },
  { id: 'google-colab', name: 'Google Colab', aliases: ['코랩', '구글 코랩', 'Google Colab', 'Colab'], strict: ['Colab'], url: 'https://colab.research.google.com', domains: ['colab.research.google.com', 'colab.google'], category: 'coding', accountNeeded: true, account: 'google', minors: GOOGLE_EDU, icon: 'code' },
  { id: 'whale-space', name: '웨일 스페이스', aliases: ['웨일 스페이스', '웨일스페이스', 'Whale Space', 'WhaleSpace'], url: 'https://whalespace.io', domains: ['whalespace.io'], category: 'platform', accountNeeded: true, account: 'school', minors: '학교 단위 계정(교육청 협약)', icon: 'school', korean: true },
  { id: 'ms-teams', name: 'Microsoft Teams', aliases: ['팀즈', 'MS 팀즈', 'Microsoft Teams', 'MS Teams'], url: 'https://teams.microsoft.com', domains: ['teams.microsoft.com', 'teams.live.com'], category: 'meeting', accountNeeded: true, account: 'microsoft', minors: '학교 Microsoft 365 계정 정책 따름', icon: 'users' },
  { id: 'ms-forms', name: 'Microsoft Forms', aliases: ['MS 폼즈', 'MS Forms', 'Microsoft Forms', '마이크로소프트 폼즈', 'MS 폼'], url: 'https://forms.office.com', domains: ['forms.office.com', 'forms.microsoft.com'], category: 'survey', accountNeeded: false, account: 'microsoft', minors: '응답자는 설정에 따라 로그인 없이 응답', icon: 'poll' },
  { id: 'google-meet', name: 'Google Meet', aliases: ['구글 미트', '구글 밋', '구글미트', 'Google Meet', '구글 meet'], url: 'https://meet.google.com', domains: ['meet.google.com'], category: 'meeting', accountNeeded: true, account: 'google', minors: GOOGLE_EDU, icon: 'users' },
  { id: 'zoom', name: 'Zoom', aliases: ['Zoom', '줌 회의', '줌 링크', '줌 접속', '줌(Zoom)', '줌 화상'], strict: ['Zoom'], url: 'https://zoom.us', domains: ['zoom.us', 'zoom.com'], category: 'meeting', accountNeeded: false, account: 'none', minors: '참여자는 링크로 접속(대기실·암호 설정 권장)', icon: 'users' },
  { id: 'naver-form', name: '네이버 폼', aliases: ['네이버 폼', '네이버폼', 'Naver Form', '네이버 오피스 폼'], url: 'https://form.naver.com', domains: ['form.naver.com'], category: 'survey', accountNeeded: false, account: 'naver', minors: '응답자는 로그인 없이 응답 가능(설정에 따름)', icon: 'poll', korean: true },
  { id: 'naver-qr', name: '네이버 QR코드', aliases: ['네이버 QR', '네이버 QR코드', '네이버 QR 코드', '네이버QR'], url: 'https://qr.naver.com', domains: ['qr.naver.com'], category: 'utility', accountNeeded: true, account: 'naver', minors: '만들기는 교사 계정, 보기는 누구나', icon: 'qr', korean: true },
  { id: 'vola', name: 'vo.la', aliases: ['볼라', 'vo.la', 'VOLA'], strict: ['VOLA'], url: 'https://vo.la', domains: ['vo.la'], category: 'utility', accountNeeded: false, account: 'none', minors: '짧은 주소 만들기(교사용)', icon: 'link', korean: true },
  { id: 'bitly', name: 'Bitly', aliases: ['비틀리', 'Bitly', 'bit.ly'], url: 'https://bitly.com', domains: ['bit.ly', 'bitly.com'], category: 'utility', accountNeeded: true, account: 'email', minors: '짧은 주소 만들기(교사용)', icon: 'link' },
  { id: 'papago', name: '파파고', aliases: ['파파고', 'Papago', '네이버 파파고'], url: 'https://papago.naver.com', domains: ['papago.naver.com'], category: 'translate', accountNeeded: false, account: 'none', minors: '로그인 없이 사용 가능', icon: 'translate', korean: true },
  { id: 'deepl', name: 'DeepL', aliases: ['딥엘', 'DeepL', '딥L', '디플'], url: 'https://www.deepl.com', domains: ['deepl.com'], category: 'translate', accountNeeded: false, account: 'none', minors: '로그인 없이 사용 가능(글자 수 제한)', icon: 'translate' },

  // ── 퀴즈·투표 ──────────────────────────────
  { id: 'kahoot', name: 'Kahoot!', aliases: ['카훗', '카후트', 'Kahoot', 'Kahoot!'], url: 'https://kahoot.com', domains: ['kahoot.com', 'kahoot.it', 'create.kahoot.it'], category: 'quiz', accountNeeded: false, account: 'teacher', minors: CODE_JOIN, icon: 'quiz' },
  { id: 'wayground', name: 'Wayground(구 Quizizz)', aliases: ['퀴지즈', '퀴즈지즈', 'Quizizz', 'Wayground', '웨이그라운드'], url: 'https://wayground.com', domains: ['wayground.com', 'quizizz.com'], category: 'quiz', accountNeeded: false, account: 'teacher', minors: CODE_JOIN, icon: 'quiz' },
  { id: 'mentimeter', name: 'Mentimeter', aliases: ['멘티미터', 'Mentimeter', 'Menti', '멘티'], strict: ['Menti'], url: 'https://www.mentimeter.com', domains: ['mentimeter.com', 'menti.com'], category: 'survey', accountNeeded: false, account: 'teacher', minors: CODE_JOIN, icon: 'poll' },
  { id: 'slido', name: 'Slido', aliases: ['슬라이도', 'Slido', 'sli.do'], url: 'https://www.slido.com', domains: ['slido.com', 'sli.do', 'app.sli.do'], category: 'survey', accountNeeded: false, account: 'teacher', minors: CODE_JOIN, icon: 'poll' },
  { id: 'blooket', name: 'Blooket', aliases: ['블루킷', 'Blooket'], url: 'https://www.blooket.com', domains: ['blooket.com'], category: 'quiz', accountNeeded: false, account: 'teacher', minors: CODE_JOIN, icon: 'quiz' },
  { id: 'quizlet', name: 'Quizlet', aliases: ['퀴즐렛', 'Quizlet'], url: 'https://quizlet.com', domains: ['quizlet.com'], category: 'quiz', accountNeeded: false, account: 'email', minors: '만 13세 미만은 보호자·교사 동의 정책 확인', icon: 'quiz' },
  { id: 'wordwall', name: 'Wordwall', aliases: ['워드월', 'Wordwall', 'WordWall'], url: 'https://wordwall.net', domains: ['wordwall.net'], category: 'quiz', accountNeeded: false, account: 'teacher', minors: '학생은 링크로 로그인 없이 참여', icon: 'quiz' },
  { id: 'classcard', name: '클래스카드', aliases: ['클래스카드', '클래스 카드', 'ClassCard', 'Classcard'], url: 'https://www.classcard.net', domains: ['classcard.net'], category: 'quiz', accountNeeded: true, account: 'teacher', minors: '학생은 교사 반에 가입', icon: 'quiz', korean: true },
  { id: 'thinkerbell', name: '띵커벨', aliases: ['띵커벨', 'ThinkerBell', 'Thinkerbell', '띵커벨 보드', '띵커벨보드'], url: 'https://www.tkbell.co.kr', domains: ['tkbell.co.kr'], category: 'quiz', accountNeeded: false, account: 'teacher', minors: CODE_JOIN, icon: 'quiz', korean: true },

  // ── 학급 운영·공공 플랫폼 ───────────────────────
  { id: 'classtool', name: '클래스툴', aliases: ['클래스툴', '클래스 툴', 'ClassTool', 'Classtool', 'Ctool'], url: 'https://ctool.co.kr', domains: ['ctool.co.kr'], category: 'class', accountNeeded: false, account: 'teacher', minors: '학생은 클래스 코드·QR로 참여(아이스크림미디어)', icon: 'school', korean: true },
  { id: 'class123', name: '클래스123', aliases: ['클래스123', '클래스 123', 'Class123', 'CLASS123', '클래스일이삼'], url: 'https://www.class123.ac', domains: ['class123.ac', 'class123.kr'], category: 'class', accountNeeded: true, account: 'teacher', minors: '학생·학부모는 교사 초대로 가입', icon: 'school', korean: true },
  { id: 'hiclass', name: '하이클래스', aliases: ['하이클래스', '하이 클래스', 'HiClass', 'Hiclass'], url: 'https://www.hiclass.net', domains: ['hiclass.net'], category: 'class', accountNeeded: true, account: 'teacher', minors: '학부모 소통 중심(초대 가입)', icon: 'school', korean: true },
  { id: 'classting', name: '클래스팅', aliases: ['클래스팅', 'Classting', '클래스팅 AI', '클래스팅AI'], url: 'https://www.classting.com', domains: ['classting.com', 'classting.ai'], category: 'class', accountNeeded: true, account: 'teacher', minors: '학생은 교사 클래스에 가입', icon: 'school', korean: true },
  { id: 'classify', name: '클래시파이', aliases: ['클래시파이', 'Classify'], strict: ['Classify'], url: 'https://www.classify.co.kr', domains: ['classify.co.kr'], category: 'class', accountNeeded: true, account: 'teacher', minors: '교사가 만든 학급 관리 도구(교사용)', icon: 'school', korean: true },
  { id: 'elearning', name: 'e학습터', aliases: ['e학습터', 'E학습터', '이학습터', 'e-학습터'], url: 'https://cls.edunet.net', domains: ['cls.edunet.net'], category: 'platform', accountNeeded: true, account: 'school', minors: '학교·교육청 발급 학생 계정', icon: 'school', korean: true },
  { id: 'wedorang', name: '위두랑', aliases: ['위두랑', 'Wedorang'], url: 'https://rang.edunet.net', domains: ['rang.edunet.net'], category: 'platform', accountNeeded: true, account: 'school', minors: '학교·교육청 발급 학생 계정', icon: 'users', korean: true },
  { id: 'ebs-oc', name: 'EBS 온라인클래스', aliases: ['EBS 온라인클래스', 'EBS온라인클래스', 'EBS 온라인 클래스', '온라인클래스'], url: 'https://oc.ebssw.kr', domains: ['oc.ebssw.kr', 'ebssw.kr'], category: 'platform', accountNeeded: true, account: 'school', minors: '학생 계정(보호자 동의) 필요', icon: 'school', korean: true },
  { id: 'edunet', name: '에듀넷·티-클리어', aliases: ['에듀넷', '티-클리어', '티클리어', 'Edunet', 'T-Clear'], url: 'https://www.edunet.net', domains: ['edunet.net', 'www.edunet.net'], category: 'platform', accountNeeded: false, account: 'school', minors: '자료 보기는 로그인 없이 가능', icon: 'book', korean: true },
  { id: 'digital-textbook', name: '디지털교과서', aliases: ['디지털교과서', '디지털 교과서', '디지털교과서 뷰어'], url: 'https://webdt.edunet.net', domains: ['webdt.edunet.net'], category: 'platform', accountNeeded: true, account: 'school', minors: '에듀넷 학생 계정', icon: 'book', korean: true },
  { id: 'aidt', name: 'AI 디지털교과서(AIDT)', aliases: ['AI 디지털교과서', 'AI디지털교과서', 'AI 디지털 교과서', 'AIDT', 'AI 교과서', 'AI교과서'], url: '', domains: [], category: 'platform', accountNeeded: true, account: 'school', minors: '2025년 법 개정 뒤 학교별로 고르는 교육자료(발행사·지역별 접속 주소). 최신 지침 확인', icon: 'book', korean: true },
  { id: 'hi-learning', name: '하이러닝', aliases: ['하이러닝', '하이 러닝', 'Hi-Learning', 'HiLearning', 'hi-learning'], url: '', domains: [], category: 'platform', accountNeeded: true, account: 'school', minors: '경기도교육청 플랫폼(경기 지역 학교 계정)', icon: 'school', korean: true },
  { id: 'toctocmath', name: '똑똑! 수학탐험대', aliases: ['똑똑수학탐험대', '똑똑! 수학탐험대', '똑똑 수학탐험대', '수학탐험대', '똑수탐'], url: 'https://www.toctocmath.kr', domains: ['toctocmath.kr'], category: 'math', accountNeeded: true, account: 'school', minors: '초등 1~6학년, 교사가 학급·학생 계정 관리(KERIS)', icon: 'quiz', korean: true },
  { id: 'i-scream', name: '아이스크림S', aliases: ['아이스크림S', '아이스크림 S', '아이스크림쌤', '아이스크림 쌤', 'i-Scream', '아이스크림미디어'], url: 'https://www.i-scream.co.kr', domains: ['i-scream.co.kr'], category: 'class', accountNeeded: true, account: 'teacher', minors: '교사 인증 회원 서비스', icon: 'school', korean: true },
  { id: 'indischool', name: '인디스쿨', aliases: ['인디스쿨', 'Indischool', 'indischool'], url: 'https://indischool.com', domains: ['indischool.com'], category: 'community', accountNeeded: true, account: 'teacher', minors: '초등교사 인증 회원 커뮤니티', icon: 'users', korean: true },
  { id: 'zep', name: 'ZEP', aliases: ['젭', 'ZEP', 'ZEP 메타버스', '젭 메타버스', 'ZEP QUIZ', '젭 퀴즈'], strict: ['ZEP'], url: 'https://zep.us', domains: ['zep.us', 'quiz.zep.us'], category: 'vr-ar', accountNeeded: false, account: 'email', minors: '참여자는 링크로 입장(만 14세 미만 가입은 보호자 동의 정책 확인)', icon: 'users', korean: true },
  { id: 'minecraft-edu', name: 'Minecraft Education', aliases: ['마인크래프트 에듀케이션', '마인크래프트 교육용', 'Minecraft Education', '마크 에듀', '마인크래프트 에듀'], url: 'https://education.minecraft.net', domains: ['education.minecraft.net'], category: 'vr-ar', accountNeeded: true, account: 'microsoft', minors: '학교 Microsoft 365 교육용 계정·라이선스', icon: 'cube' },
  { id: 'cospaces', name: 'CoSpaces Edu', aliases: ['코스페이시스', '코스페이스', '코스페이시스 에듀', 'CoSpaces', 'CoSpaces Edu', 'Cospaces'], url: 'https://cospaces.io', domains: ['cospaces.io', 'edu.cospaces.io'], category: 'vr-ar', accountNeeded: true, account: 'teacher', minors: '학생은 교사 반 코드로 가입(이메일 불필요)', icon: 'cube' },
  { id: 'thinglink', name: 'ThingLink', aliases: ['씽크링크', '씽링크', '띵링크', '싱링크', 'ThingLink', 'Thinglink'], url: 'https://www.thinglink.com', domains: ['thinglink.com'], category: 'vr-ar', accountNeeded: true, account: 'teacher', minors: '교사 계정에서 학생 계정 관리', icon: 'image' },
  { id: 'book-creator', name: 'Book Creator', aliases: ['북크리에이터', '북 크리에이터', 'Book Creator', 'BookCreator'], url: 'https://bookcreator.com', domains: ['bookcreator.com', 'app.bookcreator.com'], category: 'design', accountNeeded: true, account: 'teacher', minors: '학생은 교사 도서관 코드로 참여', icon: 'book' },
  { id: 'flip', name: 'Flip(구 Flipgrid)', aliases: ['플립그리드', 'Flipgrid', 'Flip'], strict: ['Flip'], url: 'https://info.flip.com', domains: ['flip.com', 'flipgrid.com'], category: 'video', accountNeeded: true, account: 'microsoft', minors: '2024년 서비스 종료(대체 도구: Padlet·Microsoft Clipchamp 등)', icon: 'video' },

  // ── 코딩·피지컬 ─────────────────────────────
  { id: 'scratch', name: 'Scratch', aliases: ['스크래치', 'Scratch', '스크래치 3.0'], strict: ['Scratch'], url: 'https://scratch.mit.edu', domains: ['scratch.mit.edu'], category: 'coding', accountNeeded: false, account: 'teacher', minors: '교사 계정으로 학생 계정 일괄 생성 가능', icon: 'code' },
  { id: 'entry', name: '엔트리', aliases: ['엔트리', '엔트리 코딩', 'playentry', '엔트리 AI'], url: 'https://playentry.org', domains: ['playentry.org'], category: 'coding', accountNeeded: false, account: 'teacher', minors: '학급 기능으로 학생 계정 관리', icon: 'code', korean: true },
  { id: 'microbit', name: 'micro:bit', aliases: ['마이크로비트', '마이크로 비트', 'micro:bit', 'microbit', 'Microbit', 'MakeCode', '메이크코드'], url: 'https://makecode.microbit.org', domains: ['microbit.org', 'makecode.microbit.org', 'python.microbit.org'], category: 'physical', accountNeeded: false, account: 'none', minors: '로그인 없이 코딩(보드 필요)', icon: 'cube' },
  { id: 'tinkercad', name: 'Tinkercad', aliases: ['틴커캐드', 'Tinkercad', 'TinkerCAD'], url: 'https://www.tinkercad.com', domains: ['tinkercad.com'], category: 'physical', accountNeeded: true, account: 'teacher', minors: '학생은 교사 반 코드로 참여', icon: 'cube' },
  { id: 'app-inventor', name: 'MIT App Inventor', aliases: ['앱 인벤터', '앱인벤터', 'App Inventor', '앱 인벤터2'], url: 'https://appinventor.mit.edu', domains: ['appinventor.mit.edu', 'ai2.appinventor.mit.edu'], category: 'coding', accountNeeded: true, account: 'google', minors: GOOGLE_EDU, icon: 'code' },
  { id: 'code-org', name: 'Code.org', aliases: ['코드닷오알지', '코드닷org', 'Code.org', '코드 닷 오알지'], url: 'https://code.org', domains: ['code.org', 'studio.code.org'], category: 'coding', accountNeeded: false, account: 'teacher', minors: '교사 반 코드·그림 비밀번호로 저학년 참여', icon: 'code' },
  { id: 'mblock', name: 'mBlock', aliases: ['엠블록', 'mBlock', '엠블럭'], url: 'https://mblock.cc', domains: ['mblock.cc', 'ide.mblock.cc'], category: 'physical', accountNeeded: false, account: 'none', minors: '로그인 없이 사용 가능', icon: 'code' },
  { id: 'python', name: 'Python', aliases: ['파이썬', 'Python'], url: 'https://www.python.org', domains: ['python.org'], category: 'coding', accountNeeded: false, account: 'none', minors: '설치 또는 온라인 실행 환경 필요', icon: 'code' },
];

// ── 매칭 ───────────────────────────────────────────
const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
const PARTICLES = ['으로는', '에서는', '이라는', '에게서', '으로', '에서', '에게', '까지', '부터', '처럼', '보다', '라는', '이랑', '하고', '와', '과', '은', '는', '이', '가', '을', '를', '에', '로', '의', '도', '만', '랑', '나', '란', '요', '야'];
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compile() {
  const out = [];
  for (const t of TOOLS) {
    const strict = new Set(t.strict || []);
    for (const a of new Set([t.name, ...(t.aliases || [])])) {
      if (!a || a.length < 2) continue;
      if (HANGUL.test(a)) out.push({ tool: t, kind: 'ko', alias: a, lower: a.toLowerCase() });
      else {
        const re = new RegExp(`(?<![A-Za-z0-9])${escRe(a)}(?![A-Za-z0-9])`, strict.has(a) ? 'g' : 'gi');
        out.push({ tool: t, kind: 'en', alias: a, re });
      }
    }
  }
  // 긴 별칭 먼저(‘구글 클래스룸’이 ‘클래스룸’보다 먼저)
  return out.sort((a, b) => b.alias.length - a.alias.length);
}
let MATCHERS = null;
const DOMAINS = TOOLS.flatMap((t) => (t.domains || []).map((d) => ({ tool: t, d: d.toLowerCase() }))).sort((a, b) => b.d.length - a.d.length);

function koBoundaryOk(text, start, end) {
  const prev = start > 0 ? text[start - 1] : '';
  if (prev && HANGUL.test(prev)) return false;
  const rest = text.slice(end, end + 6);
  if (!rest || !HANGUL.test(rest[0])) return true;
  for (const p of PARTICLES) {
    if (rest.startsWith(p)) { const after = rest[p.length]; if (!after || !HANGUL.test(after)) return true; }
  }
  return false;
}

/** 글에서 도구 찾기 → Map(id → {tool, count, aliases:Set}) */
export function matchToolsInText(text, out = new Map()) {
  if (!MATCHERS) MATCHERS = compile();
  const t = String(text || '');
  if (!t) return out;
  const lower = t.toLowerCase();
  const taken = []; // 이미 잡은 구간(긴 별칭 우선)
  const free = (a, b) => !taken.some(([x, y]) => a < y && b > x);
  for (const m of MATCHERS) {
    if (m.kind === 'ko') {
      let i = lower.indexOf(m.lower);
      while (i >= 0) {
        const j = i + m.lower.length;
        if (free(i, j) && koBoundaryOk(t, i, j)) { taken.push([i, j]); bump(out, m.tool, m.alias); }
        i = lower.indexOf(m.lower, i + 1);
      }
    } else {
      m.re.lastIndex = 0;
      let r;
      while ((r = m.re.exec(t))) {
        const i = r.index, j = i + r[0].length;
        if (free(i, j)) { taken.push([i, j]); bump(out, m.tool, m.alias); }
      }
    }
  }
  return out;
}
function bump(map, tool, alias) {
  const e = map.get(tool.id) || { tool, count: 0, aliases: new Set() };
  e.count++;
  e.aliases.add(alias);
  map.set(tool.id, e);
}

/** URL → 도구 | null (도메인·경로 접두사) */
export function toolForUrl(url) {
  let host = '', path = '';
  try { const u = new URL(url); host = u.hostname.replace(/^www\./, '').toLowerCase(); path = u.pathname.toLowerCase(); } catch { return null; }
  for (const { tool, d } of DOMAINS) {
    const i = d.indexOf('/');
    const dh = i < 0 ? d : d.slice(0, i);
    const dp = i < 0 ? '' : d.slice(i);
    if (host !== dh && !host.endsWith('.' + dh)) continue;
    if (dp && !path.startsWith(dp)) continue;
    return tool;
  }
  return null;
}

export function getTool(id) { return TOOLS.find((t) => t.id === id) || null; }
export function findTool(name) {
  const m = matchToolsInText(name);
  let best = null;
  for (const e of m.values()) if (!best || e.count > best.count) best = e;
  return best ? best.tool : null;
}
