import { Sheet } from '../components/ui.jsx';
import { Mascot } from '../components/Mascot.jsx';
import { KeyGuides } from '../lib/ai-guides.jsx';

const REPO = 'https://github.com/yoorrard/lecpage';
const TOPICS = [
  ['start', '시작하기'], ['ai', 'AI 선택'], ['edit', '미리보기·수정'], ['live', '참여 기능 연결'], ['deploy', '배포하기·공개 범위'], ['skill', 'AI 에이전트에서 쓰기'], ['privacy', '개인정보 안내'], ['terms', '이용약관'], ['license', '오픈소스·라이선스'], ['faq', '자주 묻는 질문'],
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
/** 한눈에 보는 흐름: 교재 → AI → 사이트 → 배포 */
function Flow() {
  const steps = [
    ['교재', 'PPT·PDF·한글', ico(<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>)],
    ['AI', '교재 읽고 사이트 만들기', ico(<><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16v4M17 18h4" /></>)],
    ['사이트', '보면서 수정', ico(<><rect x="3" y="4.5" width="18" height="15" rx="2" /><path d="M3 9h18M7 13h6M7 16h10" /></>)],
    ['배포', '주소와 QR', ico(<><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2v2M20 14v6h-4M14 20h0" /></>)],
  ];
  return <ol class="flow" aria-label="만드는 흐름">{steps.map(([t, d, i]) => <li><span class="flow-i">{i}</span><b>{t}</b><small>{d}</small></li>)}</ol>;
}
/** 키와 교재의 글이 어디로 가는지 */
function KeyMap() {
  return (
    <figure class="keymap">
      <svg viewBox="0 0 340 152" role="img" aria-label="키와 교재 원본은 이 브라우저에서 AI 회사로 바로 가고, lecpage 운영자 서버는 거치지 않아요.">
        <rect class="km-box" x="6.5" y="14.5" width="124" height="74" rx="10" /><text class="km-t" x="68.5" y="46" text-anchor="middle">이 브라우저</text><text class="km-s" x="68.5" y="64" text-anchor="middle">lecpage · 키 보관</text>
        <rect class="km-box" x="209.5" y="14.5" width="124" height="74" rx="10" /><text class="km-t" x="271.5" y="46" text-anchor="middle">AI 회사</text><text class="km-s" x="271.5" y="64" text-anchor="middle">OpenAI·Anthropic</text>
        <path class="km-go" d="M137 40h64M195 35l6 5-6 5" /><text class="km-l" x="170" y="31" text-anchor="middle">키 + 교재 원본</text>
        <path class="km-go" d="M203 66h-64M145 61l-6 5 6 5" /><text class="km-l" x="170" y="82" text-anchor="middle">사이트 내용</text>
        <rect class="km-no" x="95.5" y="108.5" width="150" height="34" rx="10" /><text class="km-s" x="170" y="130" text-anchor="middle">lecpage 운영자 서버는 거치지 않음</text>
      </svg>
    </figure>
  );
}

const BODY = {
  start: <>
    <h1 tabIndex={-1}>시작하기</h1>
    <p>교재를 넣고 AI를 고르면 AI가 교재 원본을 직접 읽고 강의 사이트를 만들어요. 교재를 받아쓴 글이 아니라, 강의 날 참가자 곁에서 쓰는 동반자 사이트예요. 완성 화면에서 살펴보고 고친 뒤 버튼 하나로 배포해요. 회원가입과 이용료가 없어요.</p>
    <Flow />
    <p class="help-cta"><a class="btn btn-primary" href="#/demo">먼저 해보기</a><span class="small muted">예시 교재로 실제와 똑같은 화면을 끝까지 해 봐요. 키가 필요 없어요.</span></p>
    <Task n="1" title="교재 넣기" shot="start" alt="교재 넣기 화면: 읽은 교재와 AI 선택(구독으로 연결, 다른 방법)">
      <p>PPT·PDF·한글(HWP·HWPX)·워드 파일을 놓아요. 어떤 형식이든 이 브라우저에서 쪽 그림을 만들어 AI가 그림과 글자를 함께 읽어요. 바라는 점은 한 줄로 적어도 되고 비워 둬도 돼요.</p>
      <p>AI 선택에서 [ChatGPT·Claude 계정으로 연결]을 눌러요. lecpage 커넥트를 한 번 받아 실행하면 쓰던 ChatGPT(Plus·Pro)나 Claude 계정으로 이 화면에서 바로 만들어요. 설치가 안 되는 PC는 [다른 방법]의 API 키 연결로 해요. <a href="#/help/ai">AI 선택</a></p>
    </Task>
    <Task n="2" title="만드는 중">
      <p>AI가 만드는 동안은 진행 단계만 보여요. 창을 닫거나 다른 일을 해도 되고, 멈추면 [계속 만들기]로 멈춘 단계부터 이어서 해요.</p>
    </Task>
    <Task n="3" title="완성 화면에서 수정" shot="edit" alt="완성 화면: 왼쪽에 미리보기, 오른쪽에 연수 정보·사이트 구성·자료·AI 수정 대화">
      <p>다 만들면 한 화면에 미리보기와 수정 칸이 열려요. AI가 교재에서 찾은 연수 정보를 한 번 확인하고, 미리보기에서 글자를 눌러 바로 고쳐요. 섹션 순서와 투표·설문 같은 항목은 사이트 구성에서 고쳐요. 자동으로 저장돼요.</p>
      <p>바꾸고 싶은 점은 아래 입력 칸에 적어 AI에게 보내요. 이어서 몇 번이든 고칠 수 있고 주고받은 내용이 남아요. <a href="#/help/edit">고치는 법</a></p>
    </Task>
    <Task n="4" title="배포하기" shot="share" alt="배포하기 화면">
      <p>체크리스트(참여 기능 → 공개 범위 → 배포할 곳)를 따라가 [배포하기]를 누르면 주소·QR이 나와요. <a href="#/help/deploy">배포하는 법</a></p>
    </Task>
    <p class="small muted">다른 컴퓨터에서 이어 하려면 [파일로 저장]으로 저장하고, 그 컴퓨터에서 [저장한 파일 열기]로 열어요. 배포한 연수를 같은 주소로 이어 배포하려면 저장할 때 '내 다른 기기에서 같은 주소로 이어 배포하기'를 켜요.</p>
  </>,
  ai: <>
    <h1 tabIndex={-1}>AI 선택</h1>
    <p>고른 AI가 교재 원본 파일을 직접 읽고 디자인부터 코드까지 사이트 전체를 써요. lecpage는 강의 사이트용 요청 설계와 디자인 라이브러리를 함께 건네요. 디자인 라이브러리에는 컨셉을 첫 화면 장면으로 바꾸는 법, 스타일 16가지, 한글 글꼴 세트, 움직임 기법이 있어요. 이 강의만의 디자인을 끌어내고, 참여 기능·강사 화면·발표 화면·QR·배포는 lecpage가 맡아요.</p>
    <ul><li><b>ChatGPT·Claude 구독으로 연결(추천, API 키 없이)</b>: 쓰고 있는 계정으로 이 화면에서 바로 만들어요. ChatGPT는 Plus·Pro 요금제에서 돼요. 사용량은 그 계정의 요금제에서 차감되고 따로 결제하지 않아요. 이 PC에 작은 프로그램 lecpage 커넥트를 한 번 설치해요.
        <ol><li>AI 선택에서 [ChatGPT·Claude 계정으로 연결]을 누르면 쓰는 운영체제에 맞는 방법이 나와요. 처음 한 번 Node.js(무료)를 함께 받아요.
            <ul><li><b>Windows</b>: [lecpage 커넥트 받기 (Windows)]를 누르고 받은 lecpage-connect.cmd를 두 번 눌러요. "Windows의 PC 보호" 창이 뜨면 [추가 정보] → [실행]을 눌러요.</li>
              <li><b>Mac</b>: 한 줄을 [복사]하고, Spotlight(⌘+스페이스)에서 "터미널"을 열어 붙여 넣은 뒤 Enter를 눌러요.</li>
              <li><b>Linux</b>: 한 줄을 [복사]해 터미널에 붙여 넣고 Enter를 눌러요.</li></ul></li>
          <li>lecpage 커넥트가 lecpage.com을 다시 열며 이 PC와 연결해요. Chrome·Edge가 "로컬 네트워크" 접근을 물으면 [허용]을 눌러요.</li>
          <li>[ChatGPT 계정으로 로그인]이나 [Claude 계정으로 로그인]을 눌러요. 처음 한 번은 무엇이 어디로 가는지 적힌 창이 떠요. 확인하고 체크한 뒤 [연결]을 누르면 바로 로그인으로 이어지고, 로그인이 끝나면 만들기 시작해요. Claude는 처음이면 lecpage 커넥트가 Claude Code를 자동으로 설치하고(터미널 없이, 진행 막대로 보여 줘요) 브라우저 로그인 창을 열어요. Claude 데스크톱 앱이 있으면 설치 없이 로그인만 해요.</li></ol>
        다음부터는 lecpage 커넥트를 켜 두면 저절로 이어져요. Windows에서는 [컴퓨터를 켤 때 lecpage 커넥트도 켜기]를 고를 수 있어요. lecpage 커넥트는 켤 때와 켜 둔 동안 쓰지 않을 때 새 버전으로 저절로 바뀌어요. 화면에 "새 버전으로 바꿔야 해요"가 보이면 [새 버전으로 바꾸기]를 눌러요(버튼이 없으면 lecpage 커넥트를 닫고 다시 켜요).</li>
      <li><b>다른 방법</b>(AI 선택 아래에 접혀 있어요)
        <ul><li><b>API 키 연결(GPT·Claude)</b>: 처음 한 번 동의하고 키를 붙여 넣으면 그다음부터는 버튼 한 번이에요. 끊겨도 받은 데부터 이어서 해요. 크레딧을 충전해 써요(사이트 하나에 몇백 원쯤).</li>
          <li><b>Codex</b>: PC에 Codex를 설치해 두었다면 그것으로도 만들어요. ChatGPT 계정 연결이 있으면 없어도 돼요.</li>
          <li><b>AI 에이전트(Skill)로 만들기</b>: 스킬을 넣고 대화로 만든 뒤, 나온 .lecpage 파일을 교재 자리에 놓아요. <a href="#/help/skill">AI 에이전트에서 쓰기</a></li></ul></li></ul>
    <p>어느 길이든 끝은 이 앱이에요. 미리보기·수정·배포는 같은 화면에서 해요.</p>
    <p>참고 디자인을 고르면 AI가 그 분위기를 내 교재에 맞게 옮겨 새로 만들어요. 디자인 사전에서 [＋ 담기]로 담은 디자인(10개까지)도 교재 넣기 화면에 보이고 AI에게 함께 건네요.</p>
    <KeyMap />
    <Task n="1" title="키 페이지 열기" shot="connect" alt="키 연결 창: 키 페이지를 여는 버튼과 누를 곳을 보여 주는 그림" w={760} h={530}>
      <p>AI 선택 아래의 [다른 방법]을 펼치고 쓸 AI 카드의 [API 키 연결]을 눌러요.</p>
      <p>버튼을 누르면 그 회사의 키 페이지가 새 창으로 열려요. 그림의 동그라미가 누를 곳이에요.</p>
    </Task>
    <Task n="2" title="돌아와서 붙여넣기" shot="paste" alt="AI 연결 창: 붙여넣기 버튼" w={760} h={596}>
      <p>키를 복사하고 돌아와 [붙여넣기]를 누르면 바로 연결돼요.</p>
      <p>어느 회사 키인지는 앱이 알아봐요.</p>
    </Task>
    <h2>회사별 순서</h2>
    <KeyGuides />
    <h2>잘 안 될 때</h2>
    <div class="faq">
      <details><summary>"lecpage 커넥트를 켜 주세요"라고 나와요</summary><p>Windows는 받은 lecpage-connect 파일을 두 번 눌러요. Mac·Linux는 터미널에 받을 때 쓴 한 줄을 다시 붙여 넣어요. 켜지면 이 화면과 저절로 연결돼요. 켰는데도 그대로면 브라우저 주소창 왼쪽 아이콘 → 사이트 설정에서 "로컬 네트워크" 접근을 허용으로 바꾸고 새로 고침해요.</p></details>
      <details><summary>Safari에서는 연결이 안 돼요</summary><p>Safari는 lecpage.com에서 lecpage 커넥트에 바로 닿지 못해요. AI 선택의 [lecpage 커넥트 화면 열기]로 127.0.0.1 화면을 열어요. 연수는 [파일로 저장]한 뒤 그 화면의 [저장한 파일 열기]로 옮겨요. Chrome이나 Edge에서는 이 과정이 없어요.</p></details>
      <details><summary>ChatGPT 사용 한도에 닿았대요</summary><p>ChatGPT 요금제의 사용량을 다 쓴 거예요. 한도가 다시 차면 [계속 만들기]를 눌러요. 사용량은 ChatGPT 설정 → 사용량에서 봐요. Plus의 5시간 한도는 다른 앱과 함께 써요.</p></details>
      <details><summary>키가 맞지 않대요</summary><p>키를 끝까지 복사했는지 확인하세요. 지웠거나 오래된 키라면 새로 만들어요.</p></details>
      <details><summary>크레딧이 없대요</summary><p>GPT·Claude 키는 그 회사의 결제 페이지에서 크레딧을 충전해야 쓸 수 있어요. 5달러면 사이트를 열 개 넘게 만들어요. 결제 없이 만들려면 ChatGPT·Claude 계정으로 연결해요.</p></details>
      <details><summary>AI 회사에 닿지 못했대요</summary><p>학교·회사 망이 AI 사이트를 막았을 수 있어요. 휴대폰 핫스팟으로 바꿔 보세요.</p></details>
      <details><summary>요청이 몰려 막혔대요</summary><p>앱이 잠깐 기다렸다가 받은 데부터 다시 해요. 그래도 안 되면 몇 분 뒤에 [계속 만들기]를 누르거나 다른 AI를 선택해요. 받은 글은 그대로 이어서 써요.</p></details>
    </div>
    <h2>더 궁금할 때</h2>
    <div class="faq">
      <details><summary>lecpage 커넥트는 안전한가요?</summary><p>lecpage 커넥트는 이 PC 안(127.0.0.1)에서만 열리고, lecpage.com 화면이 짝 맞춤 암호를 보낼 때만 답해요. ChatGPT 로그인 정보는 이 PC의 사용자 폴더에만 두고 브라우저·lecpage 운영자에게 보내지 않아요. Claude Code·Codex의 로그인 파일은 읽지 않아요. 요청은 [만들기]·[AI로 수정]을 누를 때만 이 PC에서 AI 회사로 바로 가요. 소스는 GitHub에 공개돼 있어요.</p></details>
      <details><summary>키가 뭐예요? 안전한가요?</summary><p>API 키는 AI 회사가 내 계정에 만들어 주는 긴 암호예요. 키와 교재는 이 브라우저에서 고른 AI 회사로만 가고, lecpage 운영자는 볼 수 없어요. '이 기기에서 기억하기'를 켜면 암호화해 이 기기에만 저장해요. 공용 PC에서는 꺼 주세요.</p></details>
      <details><summary>개인정보가 든 교재를 넣어도 되나요?</summary><p>참가자 이름·사진 같은 개인정보는 지우고 넣어 주세요. 교재 원본이 고른 AI 회사로 가요.</p></details>
      <details><summary>모델은 어떻게 고르나요?</summary><p>고르지 않아도 돼요. 그 키로 쓸 수 있는 모델 중 품질과 값의 균형이 좋은 것을 앱이 골라 둬요. 바꾸려면 AI 카드의 '키 연결됨' 옆 [바꾸기]를 눌러요.</p></details>
      <details><summary>만들다 멈췄어요</summary><p>앞 단계까지 만든 것은 남아 있어요. [계속 만들기]를 누르면 멈춘 단계부터 해요. 새로 고치거나 창을 닫았다가 열어도 이어서 해요. 키가 없거나 결제가 막혔으면 교재 넣기의 [ChatGPT·Claude 계정으로 연결]로 바꿔도 돼요.</p></details>
      <details><summary>ChatGPT·Claude 구독이 있는데 키가 또 필요한가요?</summary><p>아니요. AI 선택의 [ChatGPT·Claude 계정으로 연결]로 쓰던 구독 그대로 만들어요. 사용량은 그 요금제에서 차감돼요.</p></details>
    </div>
  </>,
  edit: <>
    <h1 tabIndex={-1}>미리보기·수정</h1>
    <p>AI가 다 만들면 한 화면에 미리보기(실제로 조립한 사이트)와 수정 칸이 열려요. 휴대폰에서는 위의 [수정]·[미리보기]로 바꿔 봐요. 고친 내용은 자동으로 저장되고, 잘못 고쳤으면 [실행 취소]를 눌러요.</p>
    <Task title="글 수정과 그림 바꾸기" shot="edit" alt="미리보기·수정 화면: 미리보기와 수정 칸">
      <p>미리보기 위의 [글 수정]을 켜고 글자를 누르면 그 자리에서 고쳐요. Enter로 마치고 Esc로 그만둬요.</p>
      <p>그림을 누르면 교재 쪽 그림이나 올린 사진으로 바꿔요. 참가자 화면·강사 화면·발표 화면·QR 안내문을 휴대폰·태블릿·PC 크기로 볼 수 있어요.</p>
    </Task>
    <h2>수정 칸에 있는 것</h2>
    <ul><li><b>연수 정보</b>: 연수명·일시·장소·강사가 줄마다 보여요. 처음에 한 번 확인해요. 값을 누르면 그 자리에서 고치고, 확인 전에는 AI가 교재 몇 쪽에서 찾았는지도 보여요. 날짜·시간을 바꾸면 사이트에 적힌 같은 날짜·시간도 바뀌어요. QR 안내문·강사 화면·발표 화면·일정 파일도 함께 바뀌어요.</li>
      <li><b>꼭 고칠 곳</b>: 배포에서 막히거나 그림·링크가 깨지는 문제가 있을 때만 한 줄로 보여요. [AI로 수정]을 누르면 AI가 고쳐요.</li>
      <li><b>자료</b>: [자료 추가]로 활동지·참고 파일을 올리면(끌어다 놓아도 돼요) 참가자가 사이트의 자료실에서 다운로드해요. 이름·설명·순서를 바꾸고 삭제할 수 있어요. 파일 하나는 20MB까지예요.</li>
      <li><b>사이트 구성</b>: 섹션은 끌거나 ↑↓로 순서를 바꾸고, 눈 버튼으로 숨겨요. 섹션 옆 …를 누르면 이름 바꾸기·AI로 수정·삭제가 있어요(두 번 눌러도 이름을 바꿔요). 섹션을 펼치면 투표·설문 문항, 보드 안내 글, 교재 넘기기 쪽, 자료실 링크, 실습 단계를 바로 고쳐요. [＋ 기능 넣기]로 투표·질문도 더해요. 줄을 누르면 미리보기가 그곳으로 가고, 미리보기를 누르면 그 줄이 골라져요.</li>
      <li><b>색·글꼴</b>: 강조색·글자색·바탕색과 글꼴을 바로 바꿔요.</li>
      <li><b>AI로 수정</b>: 고칠 곳(섹션 또는 사이트 전체)을 고르고 바라는 점을 적어 [보내기]를 눌러요. AI의 답에 바뀐 곳이 보이고, 이어서 또 보낼 수 있어요.</li></ul>
    <p>AI 수정·직접 수정·연수 정보 수정은 바뀔 때마다 [버전 기록]에 남아요(최근 20개). 복원해도 지금 버전은 기록에 남아요. 처음부터 다시 만들려면 [버전 기록]의 [처음부터 다시 만들기]를 눌러요.</p>
  </>,
  live: <>
    <h1 tabIndex={-1}>참여 기능 연결</h1>
    <Shot name="live" alt="배포하기의 참여 기능 줄: 켤 기능과 연결 방법(내 서버·구글 시트·Supabase)" />
    <p>질문·도움 요청·진행 현황·투표·나눔 보드·출석·만족도 조사는 '연결'이 있어야 동작해요.</p><p>기록은 강사님 계정에만 쌓여요. 운영자는 볼 수 없어요.</p>
    <p>배포하기 화면 체크리스트의 첫 줄에서 켤 기능을 누르고 연결해요. 연결한 뒤 배포하면 끝나요.</p>
    <p><b>바로 배포</b>는 lecpage 서버가 참여 기능까지 맡아 따로 연결할 것이 없어요. Vercel·GitHub Pages·Netlify·Cloudflare·ZIP처럼 사이트 파일만 올리는 곳은 아래 방법 하나로 연결해야 질문·투표·출석이 모여요. 그런 곳을 고르면 배포할 곳 바로 아래에 안내가 떠요.</p>
    <ul><li><b>Cloudflare 내 서버(추천)</b>: 버튼 하나로 내 계정에 서버를 만들어요(GitHub 연결 허락 필요). 할 일이 가장 적고, 한 번 만들면 다음 연수부터 이 기기에서 저절로 연결돼요. 관리자 키는 앱이 만들어 줘요.</li>
      <li><b>구글 시트(50명 안팎)</b>: 구글 계정으로 10분. 시트 하나가 연수 하나라 연수마다 새로 만들어요.</li>
      <li><b>Supabase(80명까지)</b>: 프로젝트를 만들고 앱이 만든 SQL을 두 번 실행해요.</li>
      <li><b>기관 서버·NAS·노트북</b>: Docker 하나로. 인터넷 없는 연수장은 강사 노트북이 서버가 돼요.</li></ul>
    <h2>연수 당일</h2>
    <p>배포 완료 화면의 [강사 화면 열기]를 눌러요(첫 화면의 연수 카드에도 있어요). 관리자 키가 복사돼서 붙여 넣기만 하면 돼요.</p>
    <p>강사 화면의 [발표 화면 띄우기]를 누르면 프로젝터에 발표 화면이 떠요. 크롬·엣지는 화면을 고르면 바로 전체 화면이고, 그 밖의 브라우저는 새 창을 프로젝터 쪽으로 끌어다 놓아요.</p>
    <p>QR 안내문·접속 확인·휴대폰에서 열기는 [더보기]에 있어요. 휴대폰에서 열기의 QR을 찍으면 키를 치지 않고 휴대폰으로 진행해요.</p>
    <h2>자료 올리기</h2>
    <ul><li><b>교재 원본</b>: 배포하기의 공개 범위에서 '교재 원본 다운로드 허용'을 켜면 자료실에 함께 올라가요.</li>
      <li><b>활동지·참고 파일</b>: 만들기·수정의 [자료 추가]로 올리면 배포할 때 자료실에 들어가요.</li>
      <li><b>연수 중 링크</b>: 강사 화면의 [자료 추가]에 이름과 주소를 넣으면 자료실에 바로 보여요(8개까지).</li>
      <li><b>참가자 결과물</b>: 나눔 보드에 글·사진·파일을 올려요.</li></ul>
    <p>자세한 설명: <a href={`${REPO}/tree/main/skills/lecpage/backends`} target="_blank" rel="noopener">실시간 서버 안내</a></p>
  </>,
  deploy: <>
    <h1 tabIndex={-1}>배포하기와 공개 범위</h1>
    <Shot name="share" alt="배포하기 화면" />
    <p>배포하기 화면은 체크리스트 한 장이에요. 참여 기능 → 공개 범위 → 확인할 곳 → 배포할 곳 차례로 보고, 끝난 줄은 ✓로 접혀요.</p>
    <h2>공개 범위</h2>
    <ul><li><b>주소를 받은 사람만(기본)</b>: 검색에 나오지 않아요.</li>
      <li><b>암호를 아는 사람만</b>: 페이지와 교재 그림까지 잠가요. 안내 QR로 들어오면 바로 열려요. 암호는 길수록 안전해요.</li>
      <li><b>누구나</b>: 검색에도 나와요.</li></ul>
    <h2>배포할 곳</h2>
    <p>추천 한 곳이 보이고, 다른 곳은 [다른 곳에 배포하기]로 펼쳐요. 처음 한 번만 연결하면 되고, 다시 배포해도 주소는 그대로예요. 배포한 뒤 고쳤으면 만들기·수정 화면의 [다시 배포하기]를 눌러요.</p>
    <p>배포한 뒤에는 [다른 곳에도 배포]로 다른 곳에도 올릴 수 있어요. '배포한 곳'에서 [대표 주소로 쓰기]를 누르면 QR·강사 화면·QR 안내문이 그 주소를 따라요. 바로 배포의 참여 기능은 바로 배포한 사이트에서만 돼서, 다른 곳에 올린 사본은 참여 기능 없이 올라가고 대표 주소는 바로 배포 주소 그대로예요.</p>
    <ul><li><b>바로 배포</b>: 가입·토큰 없이 바로 주소가 나와요(운영자가 켠 앱에서만 보여요). 마지막으로 배포한 날부터 60일 동안 열려 있고, 다시 배포하면 그날부터 다시 60일이에요. 연수 날이 그보다 뒤면 배포 화면이 언제 다시 배포할지 알려 줘요. 붐비는 날에는 같은 파일 그대로 내 계정에 배포하게 안내하고, 참여 기능 방만 찼으면 참여 기능만 내 계정으로 연결해요.</li>
      <li><b>Vercel</b>: 토큰을 한 번 붙여 넣어요. 다시 배포해도 주소가 그대로예요.</li>
      <li><b>GitHub Pages</b>: 토큰으로 배포해요. 사이트 파일이 저장소에 공개되고, 방문이 많아도 바로 멈추지 않아요.</li>
      <li><b>Cloudflare</b>: 받은 ZIP을 끌어다 놓아요. 방문이 많아도 멈추지 않아요.</li>
      <li><b>Netlify</b>: 토큰으로 배포해요. 무료는 한 달 20번쯤이에요. 첫 배포 때 팀의 로그인 보호를 자동으로 풀어 참가자가 바로 열어요.</li>
      <li><b>ZIP 다운로드</b>: 바로 내려받아요. 기관 서버·NAS·USB로 나눌 때.</li></ul>
    <p>앱이 멈출 걱정이 적은 곳을 먼저 권하고, 배포한 뒤 주소가 열리는지 확인해요. [설정 → 연결]에서 미리 연결해 두면 버튼 하나로 배포해요.</p>
    <div class="faq">
      <details><summary>짧은 주소와 QR</summary><ul><li>[짧은 주소 만들기]를 누르면 치기 쉬운 주소(is.gd)가 생겨요. joo.is·bit.ly 주소를 붙여 넣어도 돼요.</li><li>QR과 [주소 복사]는 늘 원래 주소예요.</li><li>짧은 주소는 짐작될 수 있어요. 지켜야 할 사이트는 공개 범위를 '암호를 아는 사람만'으로 해요.</li><li>QR은 크게 띄우거나, 그림으로 저장하거나, 안내문(A4)으로 인쇄해요.</li></ul></details>
      <details><summary>강사용 파일</summary><p>운영 안내·연수 정보·사이트 원본·인쇄본은 사이트에 올라가지 않아요. [강사용 파일 다운로드]로 따로 받아요.</p></details>
      <details><summary>다음 기수·사이트 삭제</summary><ul><li>같은 연수를 다음 기수로 하면 복제해서 날짜를 고쳐 배포해요. 새 주소·새 QR이라 지난 기록과 섞이지 않아요.</li><li>같은 주소로 다시 배포할 때 지난 참여 기록이 남아 있으면 체크리스트의 '지난 기록'에서 비울지 그대로 둘지 골라요.</li><li>바로 배포한 사이트는 [사이트 삭제]로 지워요. 지우거나 기간이 끝나면 예전 주소는 모두 안내 쪽으로 바뀌어요. 확인 창에 함께 지워질 기록이 나오니 필요한 출석·설문은 먼저 강사 화면에서 CSV로 받아 두세요.</li></ul></details>
    </div>
    <p>자세한 단계: <a href={`${REPO}/tree/main/skills/lecpage/references/deploy`} target="_blank" rel="noopener">배포 안내 모음</a></p>
  </>,
  skill: <>
    <h1 tabIndex={-1}>AI 에이전트에서 쓰기</h1>
    <p>Claude Code·Codex·Cursor 같은 AI 에이전트에 lecpage를 설치하면 대화로 만들어요.</p><p>쓰던 구독 그대로라 키가 필요 없어요.</p>
    <h2>설치 명령 한 줄</h2>
    <p><b>Claude Code</b> 대화창에서</p>
    <pre class="prompt-box" tabIndex={0}>/plugin install lecpage --marketplace yoorrard/lecpage</pre>
    {/* copy-ok: 설치 명령이 길어 한 문장이 70자를 넘어요 */}
    <p class="small muted">터미널에서는 <code>claude plugin install lecpage --marketplace yoorrard/lecpage</code>를 써요. 나눠 하려면 <code>/plugin marketplace add yoorrard/lecpage</code> 다음 <code>/plugin install lecpage@lecpage</code>예요.</p>
    <p><b>Codex</b> 대화창에서</p>
    <pre class="prompt-box" tabIndex={0}>$skill-installer https://github.com/yoorrard/lecpage/tree/main/skills/lecpage</pre>
    <p><b>Cursor 등 그 밖의 도구</b> 터미널에서(위 도구에도 돼요)</p>
    <pre class="prompt-box" tabIndex={0}>npx skills add yoorrard/lecpage</pre>
    <p>claude.ai에서는 <code>skills/lecpage</code> 폴더를 ZIP으로 묶어 설정 → 기능 → 스킬 올리기로 넣어요.</p><p>그다음 "이 PPT로 연수 사이트 만들어 줘"라고 말해요.</p>
    <h2>앱에서 이어 하기</h2>
    <p>미리보기·수정·배포를 화면에서 하려면 AI에게 "앱에서 이어 할게"라고 말해요. AI가 건넨 <code>.lecpage</code> 파일을 [저장한 파일 열기]로 열어요. 교재 넣기 화면에 놓아도 완성 화면이 바로 열려요.</p>
    <p>참여 기능 연결과 사이트 암호는 옮겨 오지 않아요. 앱에서 다시 정해요.</p>
    <p>앱에서 고친 연수는 [파일로 저장]한 파일을 AI에게 주면 다시 이어 해요.</p>
    <p>바라는 분위기는 <a href="#/gallery">참고 디자인</a>의 사례를 보고 그 분위기를 AI에게 말로 알려 줘요. 스킬의 레퍼런스(<code>references/designs</code>)에도 같은 사례가 있어요.</p>
  </>,
  privacy: <>
    <h1 tabIndex={-1}>개인정보 안내</h1>
    <p>회원가입이 없고, 교재와 만든 연수를 운영자 서버로 보내지 않아요(바로 배포한 사이트만 예외). 쿠키와 바깥 분석 도구도 없어요.</p>
    <ul><li><b>교재·연수·AI 작업 기록</b>: 이 기기의 브라우저 저장소에만 있어요. 연수를 지우면 그 연수의 작업 기록과 버전 기록도 함께 지워져요. [설정]에서 한 번에 지울 수 있어요.</li>
      <li><b>AI 키·배포 토큰</b>: '이 기기에서 기억하기'를 켜면 암호화해 이 브라우저에 둬요. 끄면 이 탭에만 둬요.</li>
      <li><b>브라우저가 직접 보내는 곳</b>: 교재 원본 파일(PDF)과 쪽 그림은 고른 AI 회사로 가요. 사이트 파일은 고른 배포 서비스(Vercel 등)로 가요. 운영자 서버를 거치지 않아요. 계정 연결·Codex로 만들면 lecpage 커넥트(127.0.0.1)를 거쳐 AI 회사로 바로 가요. 길마다 처음 연결할 때 한 번 동의를 받고, 동의는 이 브라우저에 기억해요.</li>
      <li><b>모델 가격표</b>: 하루 한 번 모아 웹앱에 둔 표와 openrouter.ai의 공개 가격표를 읽어요. 키와 교재는 보내지 않아요.</li>
      <li><b>AI 회사의 보관과 학습 이용</b>: 회사와 요금제마다 달라요. OpenAI는 답을 잠시 저장했다가 다 받으면 지워요. 참가자 이름·사진 같은 개인정보는 보내기 전에 지워 주세요.</li>
      <li><b>바로 배포한 사이트</b>: AI가 쓴 스크립트가 참가자의 브라우저에서 돌아요. 배포 전에 미리보기로 확인해 주세요.</li>
      <li><b>접속 기록</b>: 웹앱을 보내 주는 Cloudflare(예비 주소는 GitHub)가 보안을 위해 IP 주소를 다뤄요. 운영자는 요청 수 같은 합계만 봐요.</li>
      <li><b>익명 이용 합계</b>: 바로 배포가 켜진 앱만, 앱 열기·배포가 하루 몇 번인지 숫자만 운영자 서버에 더해요. 누가 했는지·교재·주소는 보내지 않고, [설정]에서 끌 수 있어요.</li>
      <li><b>문의</b>: 운영자가 받는 개인정보는 이메일 문의뿐이에요. <a href="mailto:hello@lecpage.com">hello@lecpage.com</a></li></ul>
    <p>연수 사이트에서 참가자 정보를 받으면 개인정보처리자는 강사·기관이에요.</p><p>기록은 강사님이 연결한 계정에 쌓여요. 바로 배포로 참여 기능을 켰으면 운영자 서버에 보관 기간 동안 저장되고, 운영자는 저장만 맡아요. '개인정보 처리 안내' 페이지가 함께 생겨요.</p>
    <p><a href={`${REPO}/blob/main/docs/legal/privacy.md`} target="_blank" rel="noopener">개인정보 처리방침 전문</a> · <a href={`${REPO}/blob/main/docs/legal/participant-privacy-guide.md`} target="_blank" rel="noopener">참가자 개인정보 안내(강사용)</a></p>
  </>,
  terms: <>
    <h1 tabIndex={-1}>이용약관</h1>
    <ul><li>lecpage 웹앱은 무료이고 회원가입이 없어요. 있는 그대로 제공하며, 오류나 끊김이 없다고 보증하지 않아요.</li>
      <li>넣은 교재와 만든 사이트는 쓰는 분의 것이에요. 연수는 이 브라우저에만 저장되니 [파일로 저장]으로 보관해 주세요.</li>
      <li>교재·사진·글꼴의 저작권과 초상권, 자료 속 개인정보는 쓰는 분이 확인해요. 사이트는 고른 AI가 만들고, AI가 쓴 코드를 포함한 결과는 배포 전에 쓰는 분이 확인해요.</li>
      <li>lecpage 커넥트는 lecpage.com 화면과 바로 이어져서 연수가 그대로예요. Safari처럼 lecpage 커넥트 화면(127.0.0.1)에서 쓸 때만 저장소가 따로라 [파일로 저장]으로 옮겨요.</li>
      <li>바로 배포는 비밀번호 칸·로그인 흉내·바깥으로 보내는 양식·서비스 워커가 있는 사이트를 받지 않아요.</li>
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
      <li><b>lecpage로 만든 사이트</b>: 만든 사람의 것이에요. QR 파일(assets/qr.js) 머리말의 저작권 표시만 두세요.</li>
      <li><b>이름 "lecpage"와 마스코트</b>: <a href={`${REPO}/blob/main/TRADEMARKS.md`} target="_blank" rel="noopener">이름·로고 사용 안내</a></li></ul>
    <p>함께 쓰는 라이브러리·글꼴: <a href={`${REPO}/blob/main/THIRD_PARTY_NOTICES.md`} target="_blank" rel="noopener">제3자 고지</a> · <a href="licenses.txt" target="_blank" rel="noopener">이 앱에 든 라이브러리의 라이선스 전문</a> · 보안 문제 제보: <a href={`${REPO}/security`} target="_blank" rel="noopener">보안 정책</a></p>
    <p class="small muted">© 2026 lecpage 기여자</p>
  </>,
  faq: <>
    <h1 tabIndex={-1}>자주 묻는 질문</h1>
    <h3>정말 무료인가요?</h3><p>네. lecpage에 내는 돈은 없어요. AI는 쓰던 ChatGPT·Claude 구독으로 쓰고, 사용량은 그 요금제에서 차감돼요.</p><p>사이트와 참여 기능은 강사님의 무료 계정에서 돌아가요. 유료 AI 키를 쓰면 그 회사에 쓴 만큼만 내요.</p>
    {/* copy-ok: "배포용"은 한글 프로그램의 메뉴 이름(배포용 문서로 저장하기) */}<h3>한글(HWP) 파일도 되나요?</h3><p>네, HWP와 HWPX 모두 그대로 넣으면 돼요. lecpage 커넥트 없이도 이 브라우저에서 쪽 그림을 만들어 AI가 그림과 글자를 함께 읽어요(처음 한 번 그리기 도구를 받아요). 암호를 걸었거나 배포용으로 저장한 문서는 원본 파일이나 PDF로 넣어 주세요.</p>
    <h3>교재 내용을 그대로 옮겨 주나요?</h3><p>아니요. AI가 교재 원본을 읽고 강의 날 쓰기 좋은 사이트로 다시 설계해요. 교재를 받아쓴 글이 아니라 강의의 동반자예요. 빠진 내용이 있으면 AI 수정 칸에 적어 보내 주세요.</p>
    <h3>교재 쪽 그림이 안 나와요.</h3><p>PPT·워드·한글도 이 브라우저에서 쪽 그림을 만들어요. 교재 줄에 '글자만 읽었어요'가 보이면 그 줄의 'PDF로 저장하는 법'대로 PDF로 저장해 함께 넣어 주세요. lecpage 커넥트를 켜 두면 이 PC의 PowerPoint·한글 같은 프로그램으로 PDF를 만들어 써요.</p>
    <h3>참가자가 교재를 내려받지 못하게 하고 싶어요.</h3><p>교재 원본은 기본으로 사이트에 넣지 않아요. 슬라이드 그림까지 지키려면 공개 범위를 '암호를 아는 사람만'으로 해요.</p>
    <h3>다른 컴퓨터에서 이어 하고 싶어요.</h3><p>[파일로 저장]으로 저장하고, 다른 컴퓨터에서 [저장한 파일 열기]로 열어요. 기본 파일에는 배포 열쇠가 없어 남에게 줘도 되고, 그 파일로 배포하면 새 주소가 생겨요.</p><p>같은 주소로 이어 배포하려면 저장할 때 '내 다른 기기에서 같은 주소로 이어 배포하기'를 켜요. 연 뒤에는 배포하기 화면에서 [이 주소에 이어서 배포]를 눌러요. 이 파일에는 열쇠가 들어가니 남에게 주지 마세요.</p>
    <h3>디자인을 원하는 대로 바꾸고 싶어요.</h3><p>AI 수정 칸에 바라는 느낌을 적어 [보내기]를 누르거나, [색·글꼴]에서 바로 바꿔요. 만들기 전이면 <a href="#/gallery">참고 디자인</a>에서 사례를 고르거나 디자인 사전에서 [＋ 담기]로 담아 둬요. AI가 그 분위기를 내 교재에 맞게 옮겨요.</p>
    <h3>참가자 화면 구석의 'Made with Lecpage'는 뭐예요?</h3><p>lecpage로 만든 사이트의 참가자 화면에 붙는 작은 표시예요. 누르면 lecpage.com이 새 탭으로 열리고, 어느 사이트에서 왔는지는 보내지 않아요. 참가자가 ✕를 누르면 그 브라우저에서는 다시 보이지 않아요.</p><p>휴대폰에서는 페이지 맨 끝에 한 줄로 놓여 참여 막대나 버튼을 가리지 않아요. 강사 화면·발표 화면·QR 안내문과 인쇄에는 붙지 않아요.</p>
    <div class="row"><Mascot size={64} mood="happy" /><span>더 궁금한 점은 <a href={`${REPO}/issues`} target="_blank" rel="noopener">GitHub 이슈</a>로 남겨 주세요.</span></div>
  </>,
};
