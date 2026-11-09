import { Sheet } from '../components/ui.jsx';
import { Mascot } from '../components/Mascot.jsx';

const REPO = 'https://github.com/yoorrard/lecpage';
const TOPICS = [
  ['start', '시작하기'], ['ai', 'AI 연결'], ['live', '실시간 기능'], ['deploy', '배포'], ['skill', 'AI 도구에서 쓰기'], ['privacy', '개인정보 안내'], ['faq', '자주 묻는 질문'],
];

export function Help({ topic = 'start' }) {
  return (
    <div class="wiz">
      <aside class="wiz-side"><ol class="stepper">{TOPICS.map(([id, name], i) => <li><a href={`#/help/${id}`} aria-current={topic === id ? 'step' : undefined}><span class="n">{i + 1}</span><span>{name}</span></a></li>)}</ol></aside>
      <div class="wiz-main"><Sheet><div class="prose">{BODY[topic] || BODY.start}</div></Sheet></div>
    </div>
  );
}

const BODY = {
  start: <>
    <h1>시작하기</h1>
    <p>lecpage는 연수 교재와 연수 정보로 연수 사이트를 만들어 주는 무료 도구예요. 회원가입이 없고, 모든 작업은 이 브라우저 안에서 이루어져요.</p>
    <ol><li><b>자료</b>: PPT·PDF·한글(HWPX)·워드를 올려요. 교재 뷰어용 쪽 그림은 PDF에서 만들어져요.</li>
      <li><b>연수 정보</b>: 날짜·인원·필요한 참여 기능·분위기를 골라요.</li>
      <li><b>AI 설계</b>: 쓰는 챗봇에 붙여 넣거나, 무료 Gemini 키를 넣거나, AI 없이 초안을 만들어요.</li>
      <li><b>내용 다듬기·디자인</b>: 섹션 순서와 문구를 고치고, 추천 3안 중 디자인을 골라요.</li>
      <li><b>운영 방식</b>: 인원·기능에 맞는 서버를 추천받고 실시간 기능을 연결해요.</li>
      <li><b>완성·배포</b>: ZIP으로 받거나 GitHub Pages·Netlify에 바로 올려요.</li></ol>
    <p>다른 컴퓨터에서 이어 하려면 7단계의 '프로젝트 파일 저장(.lecpage)'으로 저장해 두세요.</p>
  </>,
  ai: <>
    <h1>AI 연결</h1>
    <h2>1. 쓰고 있는 챗봇에 붙여넣기(추천)</h2>
    <p>프롬프트를 복사해 ChatGPT·Gemini·Claude에 붙여 넣고, 답 전체를 다시 붙여 넣으면 돼요. 이미 쓰는 구독(무료 포함)을 그대로 쓰는 방법이에요.</p>
    <h2>2. Gemini 무료 키</h2>
    <ol><li><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">Google AI Studio</a>에 개인 구글 계정으로 들어가요(학교 계정은 막혀 있을 수 있어요).</li><li>'API 키 만들기'를 누르고 키를 복사해요.</li><li>3단계의 '내 API 키로 바로 만들기'에 붙여 넣어요.</li></ol>
    <p>무료 등급에 넣은 내용은 구글 제품 개선에 쓰일 수 있어요. 학생 개인정보가 담긴 자료는 올리지 마세요.</p>
    <h2>3. 왜 'ChatGPT·Claude 계정으로 로그인'은 없나요?</h2>
    <p>Claude·Gemini 구독 로그인을 다른 앱이 빌려 쓰는 것은 각 회사 약관으로 막혀 있어요. 대신 붙여넣기 방식이나, AI 도구 안에서 lecpage skill을 쓰면 구독을 그대로 쓸 수 있어요.</p>
  </>,
  live: <>
    <h1>실시간 기능</h1>
    <p>실시간 질문·막혔어요·진행 현황·참여 보드·투표·출석은 연수 사이트와 별도의 '실시간 서버'가 필요해요. lecpage가 인원과 기능에 맞춰 추천해 드려요.</p>
    <ul><li><b>Google Sheets</b>: 40명 안팎, 출석·제출을 모으기만 할 때. 구글 계정만 있으면 돼요.</li>
      <li><b>Supabase 무료</b>: 100명 안팎의 실시간 질문·진행 현황. 참가자 로그인 없이 동작해 학교 와이파이에서도 막히지 않아요.</li>
      <li><b>Cloudflare</b>: 100~1000명 행사.</li>
      <li><b>자체 서버</b>: 학교 서버·NAS·AWS에서 Docker 하나로. 인터넷 없는 교실에서는 강사 노트북을 서버로 써요.</li></ul>
    <p>설정 방법: <a href={`${REPO}/tree/main/skills/lecpage/backends`} target="_blank" rel="noopener">백엔드 안내</a></p>
  </>,
  deploy: <>
    <h1>배포</h1>
    <ul><li><b>GitHub Pages</b>: 토큰을 붙여 넣으면 저장소 만들기부터 공개까지 자동으로 해요. 무료 계정은 공개 저장소예요.</li>
      <li><b>Netlify</b>: 토큰으로 올려요. 같은 프로젝트는 같은 주소에 새 버전이 올라가요.</li>
      <li><b>Cloudflare</b>: ZIP을 받아 대시보드에 끌어다 놓아요. 전송량이 무제한이라 큰 연수에 좋아요.</li>
      <li><b>학교 서버·NAS·AWS·USB</b>: ZIP을 풀어 그대로 올리면 돼요.</li></ul>
    <p>자세한 단계: <a href={`${REPO}/tree/main/skills/lecpage/references/deploy`} target="_blank" rel="noopener">배포 안내 18가지</a></p>
  </>,
  skill: <>
    <h1>AI 도구에서 쓰기(skill)</h1>
    <p>Claude Code·Codex·Cursor·Gemini CLI·Antigravity 등 Agent Skills를 지원하는 도구에서 lecpage를 설치하면, 대화만으로 교재 읽기부터 배포까지 진행해요. 구독 중인 AI를 그대로 써요.</p>
    <pre class="prompt-box">npx skills add yoorrard/lecpage</pre>
    <p>claude.ai에서는 저장소의 <code>skills/lecpage</code> 폴더를 ZIP으로 묶어 설정 → 기능 → 스킬 올리기로 추가해요. 그다음 "이 PPT로 연수 사이트 만들어 줘"라고 말하면 돼요.</p>
  </>,
  privacy: <>
    <h1>개인정보 안내</h1>
    <p>lecpage 웹앱은 회원가입이 없고, 운영자 서버로 아무 데이터도 보내지 않아요.</p>
    <ul><li><b>교재·프로젝트</b>: 이 브라우저의 저장소(IndexedDB)에만 있어요.</li>
      <li><b>AI 키</b>: 기본은 이 탭에서만 기억하고, 원할 때만 이 기기에 암호화해 저장해요. 키는 사용자가 고른 AI 회사로만 가요.</li>
      <li><b>브라우저가 직접 통신하는 곳</b>: 사용자가 고른 AI 회사(Google·Anthropic·OpenAI·OpenRouter), 배포할 때 GitHub·Netlify, 글꼴·라이브러리 CDN.</li>
      <li><b>분석 도구·쿠키</b>: 쓰지 않아요.</li></ul>
    <p>만든 연수 사이트에서 참가자 정보를 받는 경우, 그 사이트의 '개인정보 처리 안내' 페이지가 함께 만들어져요. 개인정보처리자는 연수를 운영하는 강사·기관이에요.</p>
  </>,
  faq: <>
    <h1>자주 묻는 질문</h1>
    <h3>정말 무료인가요?</h3><p>네. lecpage는 서버가 없는 정적 웹앱이라 운영비가 거의 들지 않아요. AI는 사용자의 챗봇이나 키를, 호스팅은 사용자 계정의 무료 등급을 써요.</p>
    <h3>한글(HWP) 파일도 되나요?</h3><p>HWPX는 돼요. 예전 HWP는 한글에서 'HWPX'나 'PDF'로 저장해 올려 주세요.</p>
    <h3>교재 뷰어에 그림이 안 나와요.</h3><p>쪽 그림은 PDF에서 만들어요. PPT를 PDF로도 저장해 함께 올려 주세요.</p>
    <h3>다른 컴퓨터에서 이어 하고 싶어요.</h3><p>7단계에서 프로젝트 파일(.lecpage)을 저장하고, 다른 컴퓨터의 첫 화면에서 '프로젝트 파일 열기'로 여세요.</p>
    <div class="row"><Mascot size={64} mood="happy" /><span>더 궁금한 점은 <a href={`${REPO}/issues`} target="_blank" rel="noopener">GitHub 이슈</a>로 남겨 주세요.</span></div>
  </>,
};
