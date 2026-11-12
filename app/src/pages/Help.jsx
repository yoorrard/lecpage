import { Sheet } from '../components/ui.jsx';
import { Mascot } from '../components/Mascot.jsx';
import { KeyGuides } from '../lib/ai-guides.jsx';

const REPO = 'https://github.com/yoorrard/lecpage';
const TOPICS = [
  ['start', '시작하기'], ['live', '참여 기능 연결'], ['deploy', '공개하기·공개 범위'], ['ai', 'AI 쓰기'], ['skill', 'AI 도구에서 쓰기'], ['privacy', '개인정보 안내'], ['terms', '이용약관'], ['license', '오픈소스·라이선스'], ['faq', '자주 묻는 질문'],
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
    <p>lecpage는 연수 교재로 연수 사이트를 만들어 주는 무료 도구예요. 회원가입이 없고, 교재는 이 브라우저에서 읽어요.</p>
    <ol><li><b>교재 넣기</b>: PPT·PDF·한글(HWPX)·워드를 놓고 연수명을 확인한 뒤 [AI로 사이트 만들기]를 눌러요. 기본 초안이 먼저 나오고, 1~2분 뒤 AI가 짠 내용으로 바뀌어요.</li>
      <li><b>살펴보고 고치기</b>: 미리보기를 보며 내용·디자인·참여 기능을 고쳐요. 고칠 곳을 펜으로 표시해 AI에게 맡길 수도 있어요.</li>
      <li><b>공개하기</b>: 누가 볼지 정하고 [공개하기]를 누르면 주소와 QR, 카톡 안내 문구가 나와요.</li></ol>
    <p>AI는 처음 한 번만 연결하면 돼요. Gemini 키는 무료예요. <a href="#/help/ai">AI 쓰기</a></p>
    <p>다른 컴퓨터에서 이어 하려면 위쪽의 [파일로 저장]을 누르고, 그 컴퓨터의 첫 화면에서 [저장한 파일 열기]로 여세요.</p>
  </>,
  live: <>
    <h1 tabIndex={-1}>참여 기능 연결</h1>
    <p>질문 받기·도움 요청·진행 현황·투표·나눔 보드·출석·만족도 설문은 참가자 휴대폰과 강사 화면을 이어 주는 '연결'이 필요해요. 기록은 강사님 계정에만 쌓이고, lecpage 운영자는 볼 수 없어요.</p>
    <ul><li><b>구글 시트(추천, 50명 안팎)</b>: 구글 계정만 있으면 10분. 공개하기 단계의 안내대로 코드 붙여넣기 → 웹 앱 배포 → URL 붙여넣기 → [연결 확인].</li>
      <li><b>Supabase 무료(100명 안팎)</b>: 프로젝트를 만들고 SQL을 두 번 실행해요. SQL과 관리자 키는 앱이 만들어 줘요.</li>
      <li><b>Cloudflare(큰 행사)</b>: 버튼 하나로 내 계정에 실시간 서버를 만들어요.</li>
      <li><b>학교 서버·NAS·노트북</b>: Docker 하나로. 인터넷 없는 교실은 강사 노트북이 서버가 돼요.</li></ul>
    <h2>자료 올리기</h2>
    <ul><li><b>파일</b>: '살펴보고 고치기 → 내용 → 자료실'에서 [＋ 파일 올리기]. 공개한 뒤에 더 넣어도 돼요. [바뀐 내용 다시 올리기]를 누르면 같은 주소에 반영돼요.</li>
      <li><b>연수 중에 링크 추가</b>: 강사 화면의 [자료 추가]에 이름과 주소를 넣으면 참가자 화면의 자료실에 바로 보여요(8개까지).</li>
      <li><b>참가자가 올리는 결과물</b>: 나눔 보드를 켜면 글·사진·파일을 올리고 서로 봐요.</li></ul>
    <p>자세한 설명: <a href={`${REPO}/tree/main/skills/lecpage/backends`} target="_blank" rel="noopener">실시간 서버 안내</a></p>
  </>,
  deploy: <>
    <h1 tabIndex={-1}>공개하기와 공개 범위</h1>
    <h2>누가 볼 수 있나요?</h2>
    <ul><li><b>주소를 받은 사람만(기본)</b>: 검색에 나오지 않아요. 주소나 QR을 받은 사람만 들어와요.</li>
      <li><b>암호를 아는 사람만</b>: 페이지와 교재 그림까지 암호로 잠가요. 안내 QR에는 암호가 들어 있어 찍으면 바로 열려요. 암호는 길수록 안전해요.</li>
      <li><b>누구나</b>: 검색에도 나와요.</li></ul>
    <h2>어디에 공개하나요?</h2>
    <p>[공개하기]를 누르면 사이트가 올라가고 주소와 QR이 나와요. 올릴 곳은 처음 한 번만 연결하면 되고, 고친 뒤 다시 올려도 주소는 그대로예요.</p>
    <ul><li><b>Vercel</b>: 가입하고 토큰을 한 번 붙여 넣으면 끝이에요. 무료는 비상업 개인 용도이고 월 100GB까지예요(넘으면 멈춤, Pro면 이어짐).</li>
      <li><b>GitHub Pages</b>: 토큰으로 바로 올려요. 저장소의 사이트 파일이 공개돼요. 방문이 많아도 바로 멈추지 않아요.</li>
      <li><b>Cloudflare</b>: 받은 ZIP을 끌어다 놓아요. 방문 한도가 없고 강사료를 받는 연수에도 쓸 수 있어요.</li>
      <li><b>Netlify</b>: 토큰으로 바로 올려요. 무료는 한 달에 20번쯤이고 크레딧을 다 쓰면 그달은 멈춰요. 2026년 7월 뒤에 가입했다면 올린 뒤 Make public을 눌러야 열려요.</li>
      <li><b>파일로 받기(ZIP)</b>: 학교 서버·NAS·USB로 나눌 때.</li></ul>
    <p>앱이 사이트 크기·인원·연결해 둔 곳을 보고 멈출 걱정이 적은 곳을 먼저 권해요. 보통 연수(수십 명)는 어느 곳이든 무료 한도의 몇 %만 써요. 올린 뒤에는 주소가 실제로 열리는지도 확인해 줘요.</p>
    <p>[설정 → 연결]에서 미리 연결해 두면 공개할 때 단추 하나면 돼요.</p>
    <p>강사용 파일(운영 안내·디자인 규칙·설계도)은 사이트에 올라가지 않아요. [강사용 파일 받기]로 따로 받아요.</p>
    <p>자세한 단계: <a href={`${REPO}/tree/main/skills/lecpage/references/deploy`} target="_blank" rel="noopener">배포 안내 모음</a></p>
  </>,
  ai: <>
    <h1 tabIndex={-1}>AI 쓰기</h1>
    <p>[AI로 사이트 만들기]를 누르면 AI가 교재를 읽고 연수 흐름과 문구를 짜요. AI는 처음 한 번만 연결하면 돼요.</p>
    <h2>어떤 AI를 연결할까요?</h2>
    <ul><li><b>Gemini(무료)</b>: 구글의 Flash 모델로 만들어요. 연수 사이트를 짜기에 충분하고, 하루에 쓸 수 있는 횟수가 정해져 있어요.</li>
      <li><b>ChatGPT·Claude(유료)</b>: 고품질 모델이라 구성과 문구가 더 꼼꼼해요. 사이트 하나에 몇백 원쯤 들고, 처음에 5달러 이상 충전해요. ChatGPT·Claude 구독과는 별개예요.</li></ul>
    <p>처음이라면 Gemini로 시작해 보세요. 아쉬우면 그때 유료 키를 더 연결해도 돼요.</p>
    <h2>연결하는 법</h2>
    <ol><li>교재 넣기 화면에서 [AI 연결하고 만들기]를 눌러요.</li>
      <li>[키 만들기 열기]로 열린 창에서 로그인하고 키를 복사해요.</li>
      <li>돌아와서 [붙여넣기]를 누르면 바로 연결돼요.</li></ol>
    <p>아래는 회사별 자세한 순서예요.</p>
    <KeyGuides />
    <h2>잘 안 될 때</h2>
    <ul><li><b>키가 맞지 않대요</b>: 키를 끝까지 복사했는지 확인하세요. 지운 키라면 새로 만들어요.</li>
      <li><b>학교 계정으로 안 돼요</b>: 학교·기관 구글 계정은 관리자가 막아 둔 경우가 많아요. 개인 구글 계정으로 키를 만드세요.</li>
      <li><b>크레딧이 없대요</b>: OpenAI·Claude 키는 결제 페이지에서 충전해야 써져요.</li>
      <li><b>AI 회사에 닿지 못했대요</b>: 학교망이 AI 사이트를 막았을 수 있어요. 휴대폰 핫스팟으로 바꿔 보세요.</li>
      <li><b>답이 중간에 끊겨요</b>: '섹션 구성과 순서까지 새로 짜기'를 끄고 문구만 다듬으면 답이 짧아 끊기지 않아요.</li></ul>
    <h2>더 궁금할 때</h2>
    <div class="faq">
      <details><summary>키가 뭐예요? 안전한가요?</summary><p>API 키는 AI 회사가 내 계정에 만들어 주는 긴 암호예요. 키와 교재의 글은 이 브라우저에서 고른 AI 회사로만 가고, lecpage 운영자는 볼 수 없어요. '이 기기에서 기억하기'를 켜면 암호화해 이 기기에만 저장해요. 공용 PC에서는 꺼 주세요.</p></details>
      <details><summary>학생 정보가 든 교재를 넣어도 되나요?</summary><p>학생 이름·사진 같은 개인정보는 지우고 넣어 주세요. 교재의 글이 AI 회사로 가고, Gemini 무료 키로 넣은 내용은 구글 제품 개선에 쓰일 수 있어요.</p></details>
      <details><summary>모델은 어떻게 고르나요?</summary><p>고르지 않아도 돼요. 그 키로 쓸 수 있는 가장 좋은 모델을 앱이 골라 둬요. 바꾸고 싶으면 교재 넣기 화면의 '연결됨' 줄을 눌러요. 가벼운 모델은 싸고 빠르지만 결과가 단순해져요.</p></details>
      <details><summary>무료 횟수를 다 쓰면 어떻게 되나요?</summary><p>앱이 잠깐 기다렸다가 다시 하거나, 무료로 되는 다른 모델로 이어서 해요. 그래도 안 되면 한국 시간 오후 5시쯤 다시 채워져요. 유료 키도 연결해 두었다면 유료로 이어서 할지 물어봐요. 묻지 않고 이어가게 하려면 [설정 → 연결]에서 바꿔요.</p></details>
      <details><summary>키 없이도 할 수 있나요?</summary><p>네. AI 연결 창 아래의 [키 없이, 쓰던 챗봇으로 만들기]를 누르면 쓰던 ChatGPT·Gemini·Claude에 물어보고 답을 붙여 넣어 만들어요. [AI 없이 기본 초안만]으로 시작해 직접 고쳐도 돼요.</p></details>
      <details><summary>ChatGPT·Claude 구독으로 로그인은 왜 없나요?</summary><p>구독 계정을 다른 앱이 빌려 쓰는 것은 각 회사 약관이 막고 있어요. AI 도구(Claude Code 등) 안에서 lecpage skill을 쓰면 구독을 그대로 써요.</p></details>
    </div>
  </>,
  skill: <>
    <h1 tabIndex={-1}>AI 도구에서 쓰기(skill)</h1>
    <p>Claude Code·Codex·Cursor·Gemini CLI·Antigravity처럼 Agent Skills를 지원하는 도구에서 lecpage를 설치하면, 대화만으로 교재 읽기부터 배포까지 진행해요. 구독 중인 AI를 그대로 쓰니 키가 필요 없어요.</p>
    <pre class="prompt-box">npx skills add yoorrard/lecpage</pre>
    <p>claude.ai에서는 저장소의 <code>skills/lecpage</code> 폴더를 ZIP으로 묶어 설정 → 기능 → 스킬 올리기로 추가해요. 그다음 "이 PPT로 연수 사이트 만들어 줘"라고 말하면 돼요.</p>
  </>,
  privacy: <>
    <h1 tabIndex={-1}>개인정보 안내</h1>
    <p>lecpage 웹앱은 회원가입이 없고, 교재와 프로젝트를 운영자 서버로 보내지 않아요. 쿠키와 분석 도구도 쓰지 않아요.</p>
    <ul><li><b>교재·프로젝트</b>: 이 브라우저의 저장소에만 있어요. [설정]에서 한 번에 지울 수 있어요.</li>
      <li><b>AI 키·배포 토큰</b>: '이 기기에서 기억하기'를 켠 것은 암호화해 이 브라우저에 저장해요. 끄면 이 탭에만 둬요. 공용 PC에서는 끄세요.</li>
      <li><b>브라우저가 직접 보내는 곳</b>: AI를 쓰면 교재 내용이 고른 AI 회사(Google·OpenAI·Anthropic 등)로, 사이트를 공개하면 사이트 파일이 고른 곳으로 가요. 운영자를 거치지 않아요. 모델 값을 보여 주려고 openrouter.ai의 공개 가격표도 읽는데, 이때 키와 교재는 보내지 않아요.</li>
      <li><b>AI 회사의 학습 이용</b>: 입력 내용을 학습에 쓰는지는 회사와 요금제마다 달라요. 학생 이름·사진 같은 개인정보는 보내기 전에 지워 주세요.</li>
      <li><b>접속 기록</b>: 웹앱 파일을 보내 주는 호스팅 회사가 보안을 위해 IP 주소를 기록해요. 운영자는 볼 수 없어요.</li>
      <li><b>문의</b>: 운영자가 받는 개인정보는 이메일 문의뿐이에요. 개인정보 관련 요청은 <a href="mailto:yyj19962004@gmail.com">yyj19962004@gmail.com</a>으로 보내 주세요.</li></ul>
    <p>만든 연수 사이트에서 참가자 정보를 받으면 개인정보처리자는 연수를 운영하는 강사·기관이에요. 기록은 강사님이 연결한 계정에만 저장되고, 사이트에 '개인정보 처리 안내' 페이지가 함께 만들어져요.</p>
    <p><a href={`${REPO}/blob/main/docs/legal/privacy.md`} target="_blank" rel="noopener">개인정보 처리방침 전문</a> · <a href={`${REPO}/blob/main/docs/legal/participant-privacy-guide.md`} target="_blank" rel="noopener">참가자 개인정보 안내(강사용)</a></p>
  </>,
  terms: <>
    <h1 tabIndex={-1}>이용약관</h1>
    <ul><li>lecpage 웹앱은 무료이고 회원가입이 없어요. 있는 그대로 제공되며, 오류가 없다거나 끊기지 않는다고 보증하지 않아요.</li>
      <li>넣은 교재와 만든 사이트는 쓰는 분의 것이에요. 프로젝트는 이 브라우저에만 저장되니 '파일로 저장'으로 보관해 주세요.</li>
      <li>교재·사진·글꼴의 저작권과 초상권, 자료 속 개인정보는 쓰는 분이 확인해 주세요. AI가 만든 내용도 공개 전에 확인해 주세요.</li>
      <li>참여 기능으로 받은 참가자 정보의 개인정보처리자는 강사·기관이에요.</li>
      <li>불법 정보, 권리 침해, 피싱·사칭, 동의 없는 개인정보 수집에는 쓸 수 없어요.</li>
      <li>운영자의 고의나 중대한 과실로 생긴 손해는 운영자가 책임져요.</li>
      <li>코드는 Apache-2.0·MIT-0 라이선스를 따르고, 이 약관은 그 권리를 줄이지 않아요.</li></ul>
    <p><a href={`${REPO}/blob/main/docs/legal/terms.md`} target="_blank" rel="noopener">이용약관 전문</a></p>
  </>,
  license: <>
    <h1 tabIndex={-1}>오픈소스·라이선스</h1>
    <p>lecpage는 오픈소스예요. 누구나 쓰고 고치고 나눌 수 있어요.</p>
    <ul><li><b>엔진·Skill·웹앱</b>: Apache-2.0</li>
      <li><b>만든 사이트에 들어가는 실행 파일·실시간 서버·배포 템플릿</b>: MIT-0(출처 표시 의무 없음)</li>
      <li><b>lecpage로 만든 사이트</b>: 만든 사람의 것이에요. 라이선스 문구를 넣지 않아도 돼요. QR 코드 파일(assets/qr.js) 머리말의 저작권 표시만 그대로 두세요.</li>
      <li><b>이름 "lecpage"와 마스코트</b>: <a href={`${REPO}/blob/main/TRADEMARKS.md`} target="_blank" rel="noopener">이름·로고 사용 안내</a></li></ul>
    <p>함께 쓰는 라이브러리·글꼴: <a href={`${REPO}/blob/main/THIRD_PARTY_NOTICES.md`} target="_blank" rel="noopener">제3자 고지</a> · <a href="licenses.txt" target="_blank" rel="noopener">이 앱에 들어 있는 라이브러리의 라이선스 전문</a> · 보안 문제 제보: <a href={`${REPO}/security`} target="_blank" rel="noopener">보안 정책</a></p>
    <p class="small muted">© 2026 lecpage 기여자</p>
  </>,
  faq: <>
    <h1 tabIndex={-1}>자주 묻는 질문</h1>
    <h3>정말 무료인가요?</h3><p>네. lecpage에 내는 돈은 없어요. AI는 Gemini 무료 키나 쓰던 챗봇으로, 사이트와 참여 기능은 강사님의 무료 계정으로 해요. 유료 AI 키를 고르면 그 회사에 쓴 만큼만 내요.</p>
    <h3>한글(HWP) 파일도 되나요?</h3><p>HWPX는 돼요. 예전 HWP는 한글에서 'HWPX'나 'PDF'로 저장해 넣어 주세요.</p>
    <h3>교재 보기에 그림이 안 나와요.</h3><p>슬라이드 그림은 PDF에서 만들어요. PPT를 PDF로도 저장해 함께 넣어 주세요.</p>
    <h3>참가자가 교재를 내려받지 못하게 하고 싶어요.</h3><p>기본으로 교재 원본은 사이트에 넣지 않아요. 슬라이드 그림까지 보호하려면 공개 범위를 '암호를 아는 사람만'으로 고르세요.</p>
    <h3>다른 컴퓨터에서 이어 하고 싶어요.</h3><p>위쪽의 '파일로 저장'으로 저장하고, 다른 컴퓨터의 첫 화면에서 '저장한 파일 열기'로 여세요. 다른 사람이 준 파일을 열면 참여 기능 연결은 다시 해야 해요(안전을 위해).</p>
    <div class="row"><Mascot size={64} mood="happy" /><span>더 궁금한 점은 <a href={`${REPO}/issues`} target="_blank" rel="noopener">GitHub 이슈</a>로 남겨 주세요.</span></div>
  </>,
};
