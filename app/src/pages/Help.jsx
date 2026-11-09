import { Sheet } from '../components/ui.jsx';
import { Mascot } from '../components/Mascot.jsx';

const REPO = 'https://github.com/yoorrard/lecpage';
const TOPICS = [
  ['start', '시작하기'], ['live', '참여 기능 연결'], ['deploy', '공유하기·공개 범위'], ['ai', 'AI로 다듬기'], ['skill', 'AI 도구에서 쓰기'], ['privacy', '개인정보 안내'], ['license', '오픈소스·라이선스'], ['faq', '자주 묻는 질문'],
];

export function Help({ topic = 'start' }) {
  return (
    <div class="wiz">
      <aside class="wiz-side"><nav aria-label="도움말 목차"><ul class="help-nav">{TOPICS.map(([id, name]) => <li><a href={`#/help/${id}`} aria-current={topic === id ? 'page' : undefined}>{name}</a></li>)}</ul></nav></aside>
      <div class="wiz-main"><Sheet><div class="prose">{BODY[topic] || BODY.start}</div></Sheet></div>
    </div>
  );
}

const BODY = {
  start: <>
    <h1 tabIndex={-1}>시작하기</h1>
    <p>lecpage는 연수 교재로 연수 사이트를 만들어 주는 무료 도구예요. 회원가입이 없고, 교재는 이 브라우저 안에서만 읽어요.</p>
    <ol><li><b>교재 넣기</b>: PPT·PDF·한글(HWPX)·워드를 놓고, 연수명·날짜·인원을 확인한 뒤 [사이트 만들기]. 초안이 바로 나와요.</li>
      <li><b>살펴보고 고치기</b>: 미리보기를 보며 내용·디자인·참여 기능을 고쳐요. 필요하면 'AI로 다듬기'를 써요.</li>
      <li><b>공유하기</b>: 누가 볼지 정하고, 참여 기능을 연결하고, 참가자에게 보낼 주소와 QR을 만들어요.</li></ol>
    <p>다른 컴퓨터에서 이어 하려면 왼쪽의 '파일로 저장(.lecpage)'을 눌러 두고, 다른 컴퓨터의 첫 화면에서 '저장한 파일 열기'로 여세요.</p>
  </>,
  live: <>
    <h1 tabIndex={-1}>참여 기능 연결</h1>
    <p>질문 받기·막혔어요·진행 체크·투표·보드·출석·만족도 설문은 참가자 휴대폰과 강사 화면을 이어 주는 '연결'이 필요해요. 기록은 강사님 계정에만 쌓이고, lecpage 운영자는 볼 수 없어요.</p>
    <ul><li><b>구글 시트(추천, 50명 안팎)</b>: 구글 계정만 있으면 10분. 공유하기 단계의 안내를 따라 코드 붙여넣기 → 웹 앱 배포 → 주소 붙여넣기 → [연결 확인].</li>
      <li><b>Supabase 무료(100명 안팎)</b>: 프로젝트를 만들고 SQL 두 번 실행. 앱이 SQL과 관리자 키를 만들어 줘요.</li>
      <li><b>Cloudflare(큰 행사)</b>: 단추 하나로 내 계정에 실시간 서버를 만들어요.</li>
      <li><b>학교 서버·NAS·노트북</b>: Docker 하나로. 인터넷 없는 교실은 강사 노트북이 서버가 돼요.</li></ul>
    <p>자세한 설명: <a href={`${REPO}/tree/main/skills/lecpage/backends`} target="_blank" rel="noopener">실시간 서버 안내</a></p>
  </>,
  deploy: <>
    <h1 tabIndex={-1}>공유하기와 공개 범위</h1>
    <h2>누가 볼 수 있나요?</h2>
    <ul><li><b>주소를 받은 사람만(기본)</b>: 검색 엔진에 나오지 않게 해요. 주소와 QR을 나눠 준 사람만 들어와요.</li>
      <li><b>암호를 아는 사람만</b>: 페이지와 교재 그림까지 암호로 잠가요(서버 없이, 브라우저에서 암호를 풀어요). 안내 QR에는 암호가 들어 있어 찍으면 바로 열려요. 길고 짐작하기 어려운 암호일수록 안전해요.</li>
      <li><b>누구나</b>: 검색에도 나와요.</li></ul>
    <h2>주소 만들기</h2>
    <ul><li><b>Netlify(추천)</b>: 무료 가입 후 연결 코드를 붙여 넣으면 주소가 생겨요. 고친 뒤 '다시 올리기'를 누르면 같은 주소가 바뀌어요.</li>
      <li><b>GitHub Pages</b>: 무료. 저장소가 공개돼요.</li>
      <li><b>파일로 받기(ZIP)</b>: Cloudflare·Netlify에 끌어다 놓거나, 학교 서버·NAS·USB로 나눠요.</li></ul>
    <p>강사용 파일(운영 안내·디자인 메모·설계도)은 사이트에 올라가지 않아요. '강사용 운영 안내 받기'로 따로 받아요.</p>
    <p>자세한 단계: <a href={`${REPO}/tree/main/skills/lecpage/references/deploy`} target="_blank" rel="noopener">배포 안내 모음</a></p>
  </>,
  ai: <>
    <h1 tabIndex={-1}>AI로 다듬기(선택)</h1>
    <p>AI 없이도 교재로 초안이 바로 만들어져요. 문구와 흐름을 더 다듬고 싶을 때만 쓰세요.</p>
    <h2>1. 쓰고 있는 챗봇에 붙여넣기(무료)</h2>
    <p>지시문을 복사해 ChatGPT·Gemini·Claude에 붙여 넣고, 답 아래 [복사] 버튼으로 답 전체를 복사해 다시 붙여 넣어요. 답이 중간에 끊기면 챗봇에 "계속"이라고 보내고 이어 붙이면 돼요.</p>
    <h2>2. AI 키로 바로(고급)</h2>
    <ol><li><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">Google AI Studio</a>에서 개인 구글 계정으로 무료 키를 받아요(학교 계정은 막혀 있을 수 있어요).</li><li>키를 붙여 넣고 [AI로 만들기]. 키는 이 브라우저에서 AI 회사로만 가요.</li></ol>
    <p>무료 등급에 넣은 내용은 AI 회사의 제품 개선에 쓰일 수 있어요. 학생 개인정보가 담긴 자료는 넣지 마세요.</p>
    <h2>왜 'ChatGPT·Claude 계정으로 로그인'은 없나요?</h2>
    <p>구독 계정 로그인을 다른 앱이 빌려 쓰는 것은 각 회사 약관으로 막혀 있어요. 대신 붙여넣기나, AI 도구 안에서 lecpage skill을 쓰면 구독을 그대로 쓸 수 있어요.</p>
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
      <li><b>AI 키·배포 연결 코드</b>: 기본은 이 탭의 메모리에만, '이 기기에서 기억'을 켠 경우에만 암호화해 이 브라우저에 저장해요.</li>
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
    <h3>정말 무료인가요?</h3><p>네. lecpage는 서버가 없는 웹앱이라 운영비가 거의 들지 않아요. AI는 쓰는 챗봇이나 키를, 사이트와 참여 기능은 강사님의 무료 계정을 써요.</p>
    <h3>한글(HWP) 파일도 되나요?</h3><p>HWPX는 돼요. 예전 HWP는 한글에서 'HWPX'나 'PDF'로 저장해 넣어 주세요.</p>
    <h3>교재 넘겨 보기에 그림이 안 나와요.</h3><p>슬라이드 그림은 PDF에서 만들어요. PPT를 PDF로도 저장해 함께 넣어 주세요.</p>
    <h3>참가자가 교재를 내려받지 못하게 하고 싶어요.</h3><p>기본으로 교재 원본은 사이트에 넣지 않아요. 슬라이드 그림까지 보호하려면 공개 범위를 '암호를 아는 사람만'으로 고르세요.</p>
    <h3>다른 컴퓨터에서 이어 하고 싶어요.</h3><p>왼쪽의 '파일로 저장(.lecpage)'으로 저장하고, 다른 컴퓨터의 첫 화면에서 '저장한 파일 열기'로 여세요. 다른 사람이 준 파일을 열면 참여 기능 연결은 다시 해야 해요(안전을 위해).</p>
    <div class="row"><Mascot size={64} mood="happy" /><span>더 궁금한 점은 <a href={`${REPO}/issues`} target="_blank" rel="noopener">GitHub 이슈</a>로 남겨 주세요.</span></div>
  </>,
};
