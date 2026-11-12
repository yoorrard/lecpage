import { Sheet } from '../components/ui.jsx';
import { Mascot } from '../components/Mascot.jsx';
import { KeyGuides } from '../lib/ai-guides.jsx';
import { geminiResetKo } from '../lib/ai.js';

const REPO = 'https://github.com/yoorrard/lecpage';
const TOPICS = [
  ['start', '시작하기'], ['ai', 'AI 연결'], ['edit', '살펴보고 고치기'], ['live', '참여 기능 연결'], ['deploy', '공개하기·공개 범위'], ['skill', 'AI 도구에서 쓰기'], ['privacy', '개인정보 안내'], ['terms', '이용약관'], ['license', '오픈소스·라이선스'], ['faq', '자주 묻는 질문'],
];

export function Help({ topic = 'start' }) {
  return (
    <div class="help-layout">
      <aside><nav aria-label="도움말 목차"><ul class="help-nav">{TOPICS.map(([id, name]) => <li><a href={`#/help/${id}`} aria-current={topic === id ? 'page' : undefined}>{name}</a></li>)}</ul></nav></aside>
      <div class="help-main"><Sheet><div class="prose help-prose">{BODY[topic] || BODY.start}</div></Sheet></div>
    </div>
  );
}

/**
 * 실제 화면 그림. 파일은 scripts/help-shots.mjs가 앱을 띄워 찍어 public/help/에 둡니다(화면이 바뀌면 다시 돌림).
 * 좁은 화면에서는 휴대폰 크기로 찍은 그림(-m)을 보여 주고, 누르면 큰 그림이 열립니다. 그림이 없으면 자리를 비워 둡니다.
 */
function Shot({ name, alt, w = 1200, h = 750 }) {
  return (
    <figure class="help-shot">
      <a href={`help/${name}.webp`} target="_blank" rel="noopener" title="크게 보기">
        <picture>
          <source media="(max-width:600px)" srcset={`help/${name}-m.webp`} />
          <img src={`help/${name}.webp`} alt={alt} width={w} height={h} loading="lazy" decoding="async" onError={(e) => { e.currentTarget.closest('figure').hidden = true; }} />
        </picture>
      </a>
    </figure>
  );
}
/** 할 일 하나: 짧은 글 + 그 화면 */
function Task({ n, title, shot, alt, w, h, children }) {
  return (
    <section class="help-task">
      <div class="help-task-t"><h2>{n && <span class="n" aria-hidden="true">{n}</span>}{title}</h2>{children}</div>
      {shot && <Shot name={shot} alt={alt} w={w} h={h} />}
    </section>
  );
}

const ico = (d) => <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{d}</svg>;
/** 한눈에 보는 흐름: 교재 → AI → 사이트 → 공개 */
function Flow() {
  const steps = [
    ['교재', 'PPT·PDF·한글', ico(<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>)],
    ['AI', '흐름과 문구 짜기', ico(<><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16v4M17 18h4" /></>)],
    ['사이트', '보면서 고치기', ico(<><rect x="3" y="4.5" width="18" height="15" rx="2" /><path d="M3 9h18M7 13h6M7 16h10" /></>)],
    ['공개', '주소와 QR', ico(<><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2v2M20 14v6h-4M14 20h0" /></>)],
  ];
  return <ol class="flow" aria-label="만드는 흐름">{steps.map(([t, d, i]) => <li><span class="flow-i">{i}</span><b>{t}</b><small>{d}</small></li>)}</ol>;
}
/** 키와 교재의 글이 어디로 가는지 */
function KeyMap() {
  return (
    <figure class="keymap">
      <svg viewBox="0 0 340 152" role="img" aria-label="키와 교재의 글은 이 브라우저에서 AI 회사로 바로 가고, lecpage 운영자 서버는 거치지 않아요.">
        <rect class="km-box" x="6.5" y="14.5" width="124" height="74" rx="10" /><text class="km-t" x="68.5" y="46" text-anchor="middle">이 브라우저</text><text class="km-s" x="68.5" y="64" text-anchor="middle">lecpage · 키 보관</text>
        <rect class="km-box" x="209.5" y="14.5" width="124" height="74" rx="10" /><text class="km-t" x="271.5" y="46" text-anchor="middle">AI 회사</text><text class="km-s" x="271.5" y="64" text-anchor="middle">구글·OpenAI·Anthropic</text>
        <path class="km-go" d="M137 40h64M195 35l6 5-6 5" /><text class="km-l" x="170" y="31" text-anchor="middle">키 + 교재의 글</text>
        <path class="km-go" d="M203 66h-64M145 61l-6 5 6 5" /><text class="km-l" x="170" y="82" text-anchor="middle">사이트 내용</text>
        <rect class="km-no" x="95.5" y="108.5" width="150" height="34" rx="10" /><text class="km-s" x="170" y="130" text-anchor="middle">lecpage 운영자 서버는 거치지 않음</text>
      </svg>
    </figure>
  );
}

const BODY = {
  start: <>
    <h1 tabIndex={-1}>시작하기</h1>
    <p>교재를 넣으면 AI가 연수 사이트를 만들고, 단추 하나로 공개해요. 회원가입이 없고 lecpage에 내는 돈도 없어요.</p>
    <Flow />
    <p class="help-cta"><a class="btn btn-primary" href="#/demo">체험하기</a><span class="small muted">예시 자료로 끝까지 해 볼 수 있어요. 키가 필요 없어요.</span></p>
    <Task n="1" title="교재 넣기" shot="start" alt="교재 넣기 화면: 교재 파일과 연수 정보, AI로 사이트 만들기 단추">
      <p>PPT·PDF·한글(HWPX)·워드 파일을 놓고 연수명을 확인해요.</p>
      <p>[AI로 사이트 만들기]를 누르면 1~2분 뒤에 사이트가 나와요. <a href="#/help/ai">AI 연결</a>은 처음 한 번만 해요.</p>
    </Task>
    <Task n="2" title="살펴보고 고치기" shot="edit" alt="살펴보고 고치기 화면: 왼쪽에 섹션 목록, 오른쪽에 미리보기">
      <p>미리보기를 보며 내용·디자인·참여 기능을 고쳐요. 고친 내용은 자동으로 저장돼요.</p>
      <p><a href="#/help/edit">고치는 법</a></p>
    </Task>
    <Task n="3" title="공개하기" shot="share" alt="공개하기 화면">
      <p>[공개하기]를 누르면 주소와 QR, 카톡 안내 문구가 나와요.</p>
      <p><a href="#/help/deploy">공개하는 법</a></p>
    </Task>
    <p class="small muted">다른 컴퓨터에서 이어 하려면 위쪽의 [파일로 저장]으로 저장하고, 그 컴퓨터의 첫 화면에서 [저장한 파일 열기]로 여세요.</p>
  </>,
  ai: <>
    <h1 tabIndex={-1}>AI 연결</h1>
    <p>AI가 교재를 읽고 연수 흐름과 문구를 짜요. 처음 한 번만 연결하면 돼요.</p>
    <KeyMap />
    <h2>어떤 AI를 고를까요?</h2>
    <ul><li><b>ChatGPT·Claude</b>: 구성과 문구가 꼼꼼해요. 크레딧을 충전해 쓰고, 사이트 하나에 몇백 원쯤 들어요.</li>
      <li><b>Gemini(무료)</b>: 돈을 들이지 않고 해 볼 때 써요. Flash 모델이라 구성과 문구가 단순할 수 있고, 하루에 쓸 수 있는 횟수가 정해져 있어요. 넣은 내용이 구글 제품 개선에 쓰일 수 있고, 계정에 따라 휴대폰 확인을 요청해요. 연결 창 아래의 [무료로 하기(Gemini)]를 눌러요.</li></ul>
    <Task n="1" title="키 페이지 열기" shot="connect" alt="AI 연결 창: 쓸 AI를 고르고 키 페이지를 여는 단추, 누를 곳을 보여 주는 그림" w={760} h={530}>
      <p>교재 넣기 화면에서 [AI 연결하고 만들기]를 누르고 쓸 AI를 골라요.</p>
      <p>단추를 누르면 그 회사의 키 페이지가 새 창으로 열려요. 그림의 동그라미가 누를 곳이에요.</p>
    </Task>
    <Task n="2" title="돌아와서 붙여넣기" shot="paste" alt="AI 연결 창: 붙여넣기 단추" w={760} h={596}>
      <p>키를 복사하고 돌아와 [붙여넣기]를 누르면 바로 연결돼요.</p>
      <p>어느 회사 키인지는 앱이 알아봐요.</p>
    </Task>
    <h2>회사별 순서</h2>
    <KeyGuides />
    <h2>잘 안 될 때</h2>
    <div class="faq">
      <details><summary>키가 맞지 않대요</summary><p>키를 끝까지 복사했는지 확인하세요. 지웠거나 오래된 키라면 새로 만들어요.</p></details>
      <details><summary>구글이 결제나 휴대폰 확인을 요구해요</summary><p>구글 클라우드를 쓰던 계정이나 학교 계정에서 생겨요. 휴대폰 확인은 카메라로 QR을 찍으면 끝나요. 결제를 요구하면 다른 개인 구글 계정으로 키를 만들거나 ChatGPT·Claude 키를 쓰세요.</p></details>
      <details><summary>크레딧이 없대요</summary><p>ChatGPT·Claude 키는 그 회사의 결제 페이지에서 크레딧을 충전해야 써져요. 5달러면 사이트를 열 개 넘게 만들어요.</p></details>
      <details><summary>AI 회사에 닿지 못했대요</summary><p>학교망이 AI 사이트를 막았을 수 있어요. 휴대폰 핫스팟으로 바꿔 보세요.</p></details>
      <details><summary>무료 횟수를 다 썼대요</summary><p>앱이 잠깐 기다렸다가 다시 하거나, 무료로 되는 다른 모델로 이어서 해요. 그래도 안 되면 한국 시간 {geminiResetKo()}쯤 다시 채워져요. 유료 키도 연결해 두었다면 유료로 이어서 할지 물어봐요.</p></details>
    </div>
    <h2>더 궁금할 때</h2>
    <div class="faq">
      <details><summary>키가 뭐예요? 안전한가요?</summary><p>API 키는 AI 회사가 내 계정에 만들어 주는 긴 암호예요. 키와 교재의 글은 이 브라우저에서 고른 AI 회사로만 가고, lecpage 운영자는 볼 수 없어요. '이 기기에서 기억하기'를 켜면 암호화해 이 기기에만 저장해요. 공용 PC에서는 꺼 주세요.</p></details>
      <details><summary>학생 정보가 든 교재를 넣어도 되나요?</summary><p>학생 이름·사진 같은 개인정보는 지우고 넣어 주세요. 교재의 글이 AI 회사로 가고, Gemini 무료 키로 넣은 내용은 구글 제품 개선에 쓰일 수 있어요.</p></details>
      <details><summary>모델은 어떻게 고르나요?</summary><p>고르지 않아도 돼요. 그 키로 쓸 수 있는 모델 중 품질과 값의 균형이 좋은 것을 앱이 골라 둬요. 바꾸려면 교재 넣기 화면의 '연결됨' 줄을 눌러요.</p></details>
      <details><summary>키 없이도 할 수 있나요?</summary><p>네. AI 연결 창의 [키 없이 만들기]를 누르면 쓰던 ChatGPT·Claude·Gemini에 물어보고 답을 붙여 넣어 만들어요. [AI 없이 기본 초안만]으로 시작해 직접 고쳐도 돼요.</p></details>
      <details><summary>ChatGPT·Claude 구독이 있는데 키가 또 필요한가요?</summary><p>구독으로 이 앱에 바로 로그인할 수는 없어요. ChatGPT Pro·Business, Claude Max·Ultra·Team 구독에는 API 크레딧이 들어 있어 그 회사 사이트에서 받아 쓸 수 있어요. 그 밖의 구독이면 [키 없이 만들기]로 쓰던 챗봇을 그대로 쓰세요.</p></details>
    </div>
  </>,
  edit: <>
    <h1 tabIndex={-1}>살펴보고 고치기</h1>
    <p>왼쪽에서 고치면 오른쪽 미리보기가 바로 바뀌어요. 잘못 고쳤으면 [되돌리기]를 눌러요.</p>
    <Task title="내용과 디자인" shot="edit" alt="살펴보고 고치기 화면: 내용 탭과 미리보기">
      <ul><li><b>내용</b>: 섹션을 눌러 문구를 고치고, 순서를 바꾸거나 더하고 빼요.</li>
        <li><b>디자인</b>: 교재 주제에 어울리는 디자인을 먼저 권해요. 눌러서 바꿔 보세요.</li>
        <li><b>연수 정보</b>: 날짜·장소·강사 소개를 고쳐요.</li></ul>
    </Task>
    <Task title="AI에게 고쳐 달라고 하기" shot="review" alt="수정 요청 탭: 고칠 점을 적는 대화창">
      <p>[수정 요청]에 바라는 점을 적으면 AI가 고쳐요. 미리보기의 [✎ 표시하기]로 고칠 곳에 펜으로 표시해도 돼요.</p>
    </Task>
    <Task title="참여 기능 켜기" shot="live" alt="참여 기능 탭: 질문 받기, 투표, 나눔 보드 같은 기능 목록">
      <p>질문 받기·투표·나눔 보드처럼 참가자 휴대폰과 강사 화면을 잇는 기능이에요. 미리보기에서 바로 시험해 볼 수 있어요.</p>
      <p><a href="#/help/live">참여 기능 연결</a></p>
    </Task>
  </>,
  live: <>
    <h1 tabIndex={-1}>참여 기능 연결</h1>
    <Shot name="live" alt="참여 기능 탭: 질문 받기, 투표, 나눔 보드 같은 기능 목록" />
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
    <Shot name="share" alt="공개하기 화면" />
    <h2>누가 볼 수 있나요?</h2>
    <ul><li><b>주소를 받은 사람만(기본)</b>: 검색에 나오지 않아요. 주소나 QR을 받은 사람만 들어와요.</li>
      <li><b>암호를 아는 사람만</b>: 페이지와 교재 그림까지 암호로 잠가요. 안내 QR에는 암호가 들어 있어 찍으면 바로 열려요. 암호는 길수록 안전해요.</li>
      <li><b>누구나</b>: 검색에도 나와요.</li></ul>
    <h2>어디에 공개하나요?</h2>
    <p>[공개하기]를 누르면 사이트가 올라가고 주소와 QR이 나와요. 올릴 곳은 처음 한 번만 연결하면 되고, 고친 뒤 다시 올려도 주소는 그대로예요.</p>
    <ul><li><b>Vercel</b>: 가입하고 토큰을 한 번 붙여 넣으면 끝이에요. 무료는 비상업 개인 용도이고 월 100GB까지예요(넘으면 멈춤, Pro면 이어짐).</li>
      <li><b>GitHub Pages</b>: 토큰으로 바로 올려요. 저장소의 사이트 파일이 공개돼요. 방문이 많아도 바로 멈추지 않아요.</li>
      <li><b>Cloudflare</b>: 받은 ZIP을 끌어다 놓아요. 방문 한도가 없고 강사료를 받는 연수에도 쓸 수 있어요.</li>
      <li><b>Netlify</b>: 토큰으로 바로 올려요. 무료는 한 달에 20번쯤이고 크레딧을 다 쓰면 그달은 멈춰요. 2026년 7월 28일 뒤에 가입했다면 올린 뒤 Make public을 눌러야 열려요.</li>
      <li><b>파일로 받기(ZIP)</b>: 학교 서버·NAS·USB로 나눌 때.</li></ul>
    <p>앱이 사이트 크기·인원·연결해 둔 곳을 보고 멈출 걱정이 적은 곳을 먼저 권해요. 보통 연수(수십 명)는 어느 곳이든 무료 한도의 몇 %만 써요. 올린 뒤에는 주소가 실제로 열리는지도 확인해 줘요.</p>
    <p>연결은 가입 → 토큰 만들기 → [붙여넣기] 순서로 한 단계씩 안내해요. [설정 → 연결]에서 미리 해 두면 공개할 때 단추 하나면 돼요.</p>
    <p><b>짧은 주소와 QR</b>: 공개한 뒤 [짧은 주소 만들기]를 누르면 직접 치기 쉬운 주소(is.gd)가 생겨요. joo.is나 bit.ly에서 만든 주소를 붙여 넣어도 돼요. QR과 [주소 복사]는 언제나 원래 주소라서 짧은 주소가 막힌 곳에서도 열려요. 짧은 주소는 남이 짐작할 수 있으니 내용을 지켜야 하는 사이트는 '암호를 아는 사람만'으로 공개하세요. QR은 [크게 보기]로 화면에 띄우거나 그림으로 저장·복사하고, 안내문(A4)으로 인쇄해요.</p>
    <p>강사용 파일(운영 안내·디자인 규칙·설계도)은 사이트에 올라가지 않아요. [강사용 파일 받기]로 따로 받아요.</p>
    <p>자세한 단계: <a href={`${REPO}/tree/main/skills/lecpage/references/deploy`} target="_blank" rel="noopener">배포 안내 모음</a></p>
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
