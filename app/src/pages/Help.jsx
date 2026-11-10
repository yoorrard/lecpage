import { Sheet } from '../components/ui.jsx';
import { Mascot } from '../components/Mascot.jsx';
import { KeyGuides } from '../lib/ai-guides.jsx';

const REPO = 'https://github.com/yoorrard/lecpage';
const TOPICS = [
  ['start', '시작하기'], ['live', '참여 기능 연결'], ['deploy', '공유하기·공개 범위'], ['ai', 'AI로 다듬기'], ['skill', 'AI 도구에서 쓰기'], ['privacy', '개인정보 안내'], ['license', '오픈소스·라이선스'], ['faq', '자주 묻는 질문'],
];

export function Help({ topic = 'start' }) {
  return (
    <div class="help-layout">
      <aside><nav aria-label="도움말 목차"><ul class="help-nav">{TOPICS.map(([id, name]) => <li><a href={`#/help/${id}`} aria-current={topic === id ? 'page' : undefined}>{name}</a></li>)}</ul></nav></aside>
      <div class="help-main"><Sheet><div class="prose">{BODY[topic] || BODY.start}</div></Sheet></div>
    </div>
  );
}

const BODY = {
  start: <>
    <h1 tabIndex={-1}>시작하기</h1>
    <p>lecpage는 연수 교재로 연수 사이트를 만들어 주는 무료 도구예요. 회원가입이 없고, 교재는 이 브라우저 안에서만 읽어요.</p>
    <ol><li><b>교재 넣기</b>: PPT·PDF·한글(HWPX)·워드를 놓고, 연수명·날짜·인원을 확인한 뒤 [사이트 만들기]. 초안이 바로 나와요.</li>
      <li><b>살펴보고 고치기</b>: 미리보기를 모니터·노트북·태블릿·휴대폰 크기로 바꿔 보며 내용·디자인·참여 기능을 고쳐요. 고칠 곳을 펜·네모로 표시해 AI에게 보낼 수도 있어요.</li>
      <li><b>공유하기</b>: 누가 볼지 정하고, 참여 기능을 연결하고, 참가자에게 보낼 주소와 QR을 만들어요.</li></ol>
    <p>다른 컴퓨터에서 이어 하려면 왼쪽의 '파일로 저장(.lecpage)'을 눌러 두고, 다른 컴퓨터의 첫 화면에서 '저장한 파일 열기'로 여세요.</p>
  </>,
  live: <>
    <h1 tabIndex={-1}>참여 기능 연결</h1>
    <p>질문 받기·막혔어요·진행 체크·투표·보드·출석·만족도 설문은 참가자 휴대폰과 강사 화면을 이어 주는 '연결'이 필요해요. 기록은 강사님 계정에만 쌓이고, lecpage 운영자는 볼 수 없어요.</p>
    <ul><li><b>구글 시트(추천, 50명 안팎)</b>: 구글 계정만 있으면 10분. 공유하기 단계의 안내대로 코드 붙여넣기 → 웹 앱 배포 → URL 붙여넣기 → [연결 확인].</li>
      <li><b>Supabase 무료(100명 안팎)</b>: 프로젝트를 만들고 SQL을 두 번 실행해요. SQL과 관리자 키는 앱이 만들어 줘요.</li>
      <li><b>Cloudflare(큰 행사)</b>: 버튼 하나로 내 계정에 실시간 서버를 만들어요.</li>
      <li><b>학교 서버·NAS·노트북</b>: Docker 하나로. 인터넷 없는 교실은 강사 노트북이 서버가 돼요.</li></ul>
    <p>자세한 설명: <a href={`${REPO}/tree/main/skills/lecpage/backends`} target="_blank" rel="noopener">실시간 서버 안내</a></p>
  </>,
  deploy: <>
    <h1 tabIndex={-1}>공유하기와 공개 범위</h1>
    <h2>누가 볼 수 있나요?</h2>
    <ul><li><b>주소를 받은 사람만(기본)</b>: 검색에 나오지 않아요. 주소나 QR을 받은 사람만 들어와요.</li>
      <li><b>암호를 아는 사람만</b>: 페이지와 교재 그림까지 암호로 잠가요. 안내 QR에는 암호가 들어 있어 찍으면 바로 열려요. 암호는 길수록 안전해요.</li>
      <li><b>누구나</b>: 검색에도 나와요.</li></ul>
    <h2>주소 만들기</h2>
    <ul><li><b>Netlify(추천)</b>: 무료로 가입하고 토큰을 붙여 넣으면 주소가 생겨요. 고친 뒤 [다시 올리기]를 누르면 같은 주소에 새 내용이 올라가요.</li>
      <li><b>GitHub Pages</b>: 무료. 저장소가 공개돼요.</li>
      <li><b>파일로 받기(ZIP)</b>: Cloudflare·Netlify에 끌어다 놓거나, 학교 서버·NAS·USB로 나눠요.</li></ul>
    <p>강사용 파일(운영 안내·디자인 메모·설계도)은 사이트에 올라가지 않아요. '강사용 운영 안내 받기'로 따로 받아요.</p>
    <p>자세한 단계: <a href={`${REPO}/tree/main/skills/lecpage/references/deploy`} target="_blank" rel="noopener">배포 안내 모음</a></p>
  </>,
  ai: <>
    <h1 tabIndex={-1}>AI로 다듬기(선택)</h1>
    <p>AI 없이도 초안은 바로 나와요. 문구를 더 다듬고 싶을 때만 쓰세요. 기본은 제목·안내 문장만 고치는 '문구 다듬기'라 빠르고, 체크를 켜면 칸 구성과 순서까지 새로 짜요.</p>
    <h2>방법 세 가지</h2>
    <ul><li><b>챗봇에 붙여넣기</b>: 가입 없이 지금 쓰는 ChatGPT·Gemini·Claude로 해요. 지시문 복사 → 챗봇에 붙여 넣기 → 답을 복사해 붙여 넣기.</li>
      <li><b>OpenRouter로 로그인</b>: 버튼을 누르고 로그인하면 연결돼요. 키를 복사할 필요가 없어요. 무료 모델은 하루 50번까지예요.</li>
      <li><b>API 키 붙여넣기</b>: Gemini 키는 무료, OpenAI·Claude 키는 유료(최소 5달러 충전)예요. 키를 넣으면 어느 회사 키인지 알아서 구분해요.</li></ul>
    <p>한 번 연결하면 다음부터는 [AI로 문구 다듬기] 버튼 하나로 끝나요.</p>
    <h2>API 키 만드는 법</h2>
    <KeyGuides open="gemini" />
    <h2>잘 안 될 때</h2>
    <ul><li><b>키가 맞지 않대요</b>: 키를 끝까지 복사했는지 확인하세요. 지운 키라면 새로 만들어요.</li>
      <li><b>학교 계정으로 안 돼요</b>: 학교·기관 구글 계정은 관리자가 AI Studio를 막아 둔 경우가 많아요. 개인 구글 계정으로 만드세요.</li>
      <li><b>무료 횟수를 다 썼대요</b>: 내일 다시 쓰거나, 지금은 챗봇에 붙여넣기로 하세요.</li>
      <li><b>크레딧이 없대요</b>: OpenAI·Claude 키는 결제 페이지에서 충전해야 써져요. ChatGPT·Claude 구독과는 따로예요.</li>
      <li><b>AI 회사에 닿지 못했대요</b>: 학교망이 AI 사이트를 막았을 수 있어요. 휴대폰 핫스팟으로 바꾸거나 붙여넣기로 하세요.</li>
      <li><b>답이 중간에 끊겨요</b>: 체크를 끄고 문구만 다듬으면 답이 짧아 끊기지 않아요.</li></ul>
    <h2>개인정보</h2>
    <p>키와 교재 요약은 이 브라우저에서 고른 AI 회사로 바로 가요. lecpage 운영자에게는 오지 않아요. 무료 등급(Gemini 무료, OpenRouter 무료 모델)은 넣은 내용이 AI 회사의 학습·개선에 쓰일 수 있으니 학생 개인정보가 담긴 자료는 넣지 마세요.</p>
    <h2>ChatGPT·Claude 구독으로 로그인은 왜 없나요?</h2>
    <p>구독 계정을 다른 앱이 빌려 쓰는 것은 각 회사 약관이 막고 있어요. 대신 챗봇에 붙여넣기를 쓰거나, AI 도구 안에서 lecpage skill을 쓰면 구독을 그대로 써요.</p>
  </>,
  skill: <>
    <h1 tabIndex={-1}>AI 도구에서 쓰기(skill)</h1>
    <p>Claude Code·Codex·Cursor·Gemini CLI·Antigravity처럼 Agent Skills를 지원하는 도구에서 lecpage를 설치하면, 대화만으로 교재 읽기부터 배포까지 진행해요. 구독 중인 AI를 그대로 쓰니 키가 필요 없어요.</p>
    <pre class="prompt-box">npx skills add yoorrard/lecpage</pre>
    <p>claude.ai에서는 저장소의 <code>skills/lecpage</code> 폴더를 ZIP으로 묶어 설정 → 기능 → 스킬 올리기로 추가해요. 그다음 "이 PPT로 연수 사이트 만들어 줘"라고 말하면 돼요.</p>
  </>,
  privacy: <>
    <h1 tabIndex={-1}>개인정보 안내</h1>
    <p>lecpage 웹앱은 회원가입이 없고, 운영자 서버에 데이터를 모으지 않아요. 분석 도구와 쿠키도 쓰지 않아요.</p>
    <ul><li><b>교재·프로젝트</b>: 이 브라우저의 저장소(IndexedDB)에만 있어요.</li>
      <li><b>AI 키·배포 토큰</b>: 기본은 이 탭에만 두고, '이 기기에서 기억하기'를 켠 것만 암호화해 이 브라우저에 저장해요.</li>
      <li><b>브라우저가 직접 보내는 곳</b>: 'AI로 다듬기'를 쓰면 교재 요약이 고른 AI 회사(Google·Anthropic·OpenAI·OpenRouter)로, 주소를 만들면 사이트 파일이 고른 곳(Netlify·GitHub)으로 가요. 글꼴은 CDN에서 받아요.</li></ul>
    <p>만든 연수 사이트에서 참가자 정보를 받으면 그 사이트에 '개인정보 처리 안내' 페이지가 함께 만들어져요. 개인정보처리자는 연수를 운영하는 강사·기관이고, 기록은 강사님이 연결한 계정(구글 시트·Supabase 등)에만 저장돼요.</p>
  </>,
  license: <>
    <h1 tabIndex={-1}>오픈소스·라이선스</h1>
    <p>lecpage는 오픈소스예요. 누구나 쓰고 고치고 나눌 수 있어요.</p>
    <ul><li><b>엔진·Skill·웹앱</b>: Apache-2.0</li>
      <li><b>만든 사이트에 들어가는 실행 파일·실시간 서버·배포 견본</b>: MIT-0(출처 표시 의무 없음)</li>
      <li><b>lecpage로 만든 사이트</b>: 만든 사람의 것이에요.</li>
      <li><b>이름 "lecpage"와 마스코트</b>: <a href={`${REPO}/blob/main/TRADEMARKS.md`} target="_blank" rel="noopener">이름·로고 사용 안내</a></li></ul>
    <p>함께 쓰는 라이브러리·글꼴: <a href={`${REPO}/blob/main/THIRD_PARTY_NOTICES.md`} target="_blank" rel="noopener">제3자 고지</a> · 보안 문제 제보: <a href={`${REPO}/security`} target="_blank" rel="noopener">보안 정책</a></p>
  </>,
  faq: <>
    <h1 tabIndex={-1}>자주 묻는 질문</h1>
    <h3>정말 무료인가요?</h3><p>네. lecpage는 서버가 없는 웹앱이라 운영비가 거의 들지 않아요. AI는 쓰던 챗봇이나 무료 키로, 사이트와 참여 기능은 강사님의 무료 계정으로 해요.</p>
    <h3>한글(HWP) 파일도 되나요?</h3><p>HWPX는 돼요. 예전 HWP는 한글에서 'HWPX'나 'PDF'로 저장해 넣어 주세요.</p>
    <h3>교재 넘겨 보기에 그림이 안 나와요.</h3><p>슬라이드 그림은 PDF에서 만들어요. PPT를 PDF로도 저장해 함께 넣어 주세요.</p>
    <h3>참가자가 교재를 내려받지 못하게 하고 싶어요.</h3><p>기본으로 교재 원본은 사이트에 넣지 않아요. 슬라이드 그림까지 보호하려면 공개 범위를 '암호를 아는 사람만'으로 고르세요.</p>
    <h3>다른 컴퓨터에서 이어 하고 싶어요.</h3><p>왼쪽의 '파일로 저장(.lecpage)'으로 저장하고, 다른 컴퓨터의 첫 화면에서 '저장한 파일 열기'로 여세요. 다른 사람이 준 파일을 열면 참여 기능 연결은 다시 해야 해요(안전을 위해).</p>
    <div class="row"><Mascot size={64} mood="happy" /><span>더 궁금한 점은 <a href={`${REPO}/issues`} target="_blank" rel="noopener">GitHub 이슈</a>로 남겨 주세요.</span></div>
  </>,
};
