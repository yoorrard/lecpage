import { Sheet } from '../components/ui.jsx';
import { Mascot } from '../components/Mascot.jsx';
import { KeyGuides } from '../lib/ai-guides.jsx';
import { geminiResetKo } from '../lib/ai.js';

const REPO = 'https://github.com/yoorrard/lecpage';
const TOPICS = [
  ['start', '시작하기'], ['ai', 'AI 고르기'], ['edit', '살펴보고 고치기'], ['live', '참여 기능 연결'], ['deploy', '배포하기·공개 범위'], ['skill', 'AI 에이전트에서 쓰기'], ['privacy', '개인정보 안내'], ['terms', '이용약관'], ['license', '오픈소스·라이선스'], ['faq', '자주 묻는 질문'],
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
    ['사이트', '보면서 고치기', ico(<><rect x="3" y="4.5" width="18" height="15" rx="2" /><path d="M3 9h18M7 13h6M7 16h10" /></>)],
    ['배포', '주소와 QR', ico(<><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2v2M20 14v6h-4M14 20h0" /></>)],
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
    <p>교재를 넣고 AI를 고르면 AI가 교재를 직접 읽고 강의 사이트를 만들어요. 살펴보고 고친 뒤 버튼 하나로 배포해요. 회원가입과 이용료가 없어요.</p>
    <Flow />
    <p class="help-cta"><a class="btn btn-primary" href="#/demo">먼저 해보기</a><span class="small muted">예시 교재로 실제와 똑같은 화면을 끝까지 해 봐요. 키가 필요 없어요.</span></p>
    <Task n="1" title="교재 넣기" shot="start" alt="교재 넣기 화면: 읽은 교재와 AI 고르기(GPT·Claude·Gemini 카드)">
      <p>PPT·PDF·한글(HWP·HWPX)·워드 파일을 놓아요. 바라는 점은 한 줄로 적어도 되고 비워 둬도 돼요.</p>
      <p>AI 고르기에서 GPT·Claude·Gemini 가운데 하나를 골라 [키로 연결]이나 [쓰던 앱으로(키 없이)]를 눌러요. <a href="#/help/ai">AI 고르기</a></p>
    </Task>
    <Task n="2" title="만들고 고치기" shot="edit" alt="살펴보고 고치기 화면: 왼쪽에 섹션 목록, 오른쪽에 미리보기">
      <p>AI가 만드는 동안은 진행 단계만 보여요. 다 만들면 미리보기와 목록이 열려요.</p>
      <p>AI가 교재에서 찾은 연수 정보를 한 번 확인하고, 미리보기에서 글자를 눌러 바로 고쳐요. 자동으로 저장돼요. <a href="#/help/edit">고치는 법</a></p>
    </Task>
    <Task n="3" title="배포하기" shot="share" alt="배포하기 화면">
      <p>체크리스트(참여 기능 → 공개 범위 → 배포할 곳)를 따라가 [배포하기]를 누르면 주소·QR이 나와요. <a href="#/help/deploy">배포하는 법</a></p>
    </Task>
    <p class="small muted">다른 컴퓨터에서 이어 하려면 [파일로 저장]으로 저장하고, 그 컴퓨터에서 [저장한 파일 열기]로 열어요. 배포한 연수를 같은 주소로 이어 배포하려면 저장할 때 '내 다른 기기에서 같은 주소로 이어 배포하기'를 켜요.</p>
  </>,
  ai: <>
    <h1 tabIndex={-1}>AI 고르기</h1>
    <p>고른 AI가 교재 파일을 직접 읽고 사이트 전체를 만들어요. GPT·Claude·Gemini 세 카드 모두 두 길이 있어요.</p>
    <ul><li><b>키로 연결</b>: 처음 한 번 키를 붙여 넣으면 그다음부터는 버튼 한 번이에요. 만드는 과정이 화면에 보이고, 창을 닫아도 멈춘 단계부터 이어서 해요. GPT·Claude는 크레딧을 충전해 쓰고(사이트 하나에 몇백 원쯤), Gemini는 무료 키로 시작해요.</li>
      <li><b>쓰던 앱으로(키 없이)</b>: 쓰던 ChatGPT·Claude·Gemini 창에 프롬프트를 붙여 넣고 교재 원본 파일을 첨부해요. 답을 복사해 돌아와 [답 넣기]를 누르거나 내려받은 .html 파일을 끌어 넣어요. 무료 요금제도 돼요.</li></ul>
    <p>그 아래 두 줄은 AI 에이전트를 쓰는 분의 길이에요. <b>내 PC의 Claude Code·Codex</b>는 연결 프로그램을 띄운 창에서 바로 써요. <b>AI 에이전트(Skill)</b>는 스킬을 넣어 대화로 만들어요. <a href="#/help/skill">AI 에이전트에서 쓰기</a></p>
    <KeyMap />
    <h2>Gemini 무료 키</h2>
    <p>돈을 들이지 않고 해 볼 때 써요. 가장 좋은 모델(Gemini 4 Carbon·Argon)은 결제한 키만 돼서 결과가 단순할 수 있어요. 하루에 쓸 수 있는 횟수도 정해져 있어요. 넣은 내용이 구글 제품 개선에 쓰일 수 있고, 계정에 따라 휴대폰 확인을 요청해요.</p>
    <Task n="1" title="키 페이지 열기" shot="connect" alt="키 연결 창: 키 페이지를 여는 버튼과 누를 곳을 보여 주는 그림" w={760} h={530}>
      <p>AI 고르기에서 쓸 AI 카드의 [키로 연결]을 눌러요.</p>
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
      <details><summary>키가 맞지 않대요</summary><p>키를 끝까지 복사했는지 확인하세요. 지웠거나 오래된 키라면 새로 만들어요.</p></details>
      <details><summary>구글이 결제나 휴대폰 확인을 요구해요</summary><p>구글 클라우드를 쓰던 계정이나 학교·회사 계정에서 생겨요. 휴대폰 확인은 카메라로 QR을 찍으면 끝나요. 결제를 요구하면 다른 개인 구글 계정으로 키를 만들거나 ChatGPT·Claude 키를 쓰세요.</p></details>
      <details><summary>크레딧이 없대요</summary><p>GPT·Claude 키는 그 회사의 결제 페이지에서 크레딧을 충전해야 쓸 수 있어요. 5달러면 사이트를 열 개 넘게 만들어요. 결제 없이 만들려면 [쓰던 앱으로(키 없이)]를 누르세요.</p></details>
      <details><summary>AI 회사에 닿지 못했대요</summary><p>학교·회사 망이 AI 사이트를 막았을 수 있어요. 휴대폰 핫스팟으로 바꿔 보세요.</p></details>
      <details><summary>무료 횟수를 다 썼대요</summary><p>앱이 잠깐 기다렸다가 멈춘 단계부터 다시 해요. 그래도 안 되면 한국 시간 {geminiResetKo()}쯤 다시 채워져요. 다른 AI를 골라도 앞 단계에서 만든 것은 그대로예요.</p></details>
    </div>
    <h2>더 궁금할 때</h2>
    <div class="faq">
      <details><summary>키가 뭐예요? 안전한가요?</summary><p>API 키는 AI 회사가 내 계정에 만들어 주는 긴 암호예요. 키와 교재의 글은 이 브라우저에서 고른 AI 회사로만 가고, lecpage 운영자는 볼 수 없어요. '이 기기에서 기억하기'를 켜면 암호화해 이 기기에만 저장해요. 공용 PC에서는 꺼 주세요.</p></details>
      <details><summary>학생 정보가 든 교재를 넣어도 되나요?</summary><p>학생 이름·사진 같은 개인정보는 지우고 넣어 주세요. 교재의 글이 AI 회사로 가고, Gemini 무료 키로 넣은 내용은 구글 제품 개선에 쓰일 수 있어요.</p></details>
      <details><summary>모델은 어떻게 고르나요?</summary><p>고르지 않아도 돼요. 그 키로 쓸 수 있는 모델 중 품질과 값의 균형이 좋은 것을 앱이 골라 둬요. 바꾸려면 AI 카드의 '키 연결됨' 옆 [바꾸기]를 눌러요.</p></details>
      <details><summary>쓰던 앱으로 만들 때 교재는 어떻게 보내요?</summary><p>[복사하고 ChatGPT 열기]처럼 생긴 버튼을 누르면 프롬프트가 복사되고 창이 열려요. 그 창에 붙여 넣고 교재 원본 파일을 첨부해 보내요. Claude는 PPT·한글 파일을 받지 못하니 PDF로 저장해 첨부해요. 첨부할 파일을 못 찾으면 같은 자리의 [내려받기]를 눌러요.</p></details>
      <details><summary>AI 답이 중간에 끊겼어요</summary><p>[이어서 요청 글 복사]를 눌러 AI에게 보내고, 이어진 답을 복사해 [이어진 답 넣기]를 누르세요. 앞의 답 뒤에 이어 붙여요.</p></details>
      <details><summary>만들다 멈췄어요</summary><p>앞 단계까지 만든 것은 남아 있어요. [이어서 하기]를 누르면 멈춘 단계부터 해요. 새로 고치거나 창을 닫았다가 열어도 이어서 해요. 키가 없거나 결제가 막혔으면 [쓰던 앱으로(키 없이)]로 바꿔도 돼요.</p></details>
      <details><summary>ChatGPT·Claude 구독이 있는데 키가 또 필요한가요?</summary><p>구독으로 이 앱에 바로 로그인할 수는 없어요. 대신 ChatGPT Pro·Business, Claude Max·Ultra·Team 구독에는 API 크레딧이 들어 있어요. 그 밖의 구독이면 [쓰던 앱으로(키 없이)]를 고르거나, 내 PC의 Claude Code·Codex를 쓰세요.</p></details>
    </div>
  </>,
  edit: <>
    <h1 tabIndex={-1}>살펴보고 고치기</h1>
    <p>AI가 다 만들면 미리보기(실제로 조립한 사이트)와 목록이 열려요. 고친 내용은 자동으로 저장되고, 잘못 고쳤으면 [되돌리기]를 눌러요.</p>
    <Task title="글 바로 고치기와 그림 바꾸기" shot="edit" alt="살펴보고 고치기 화면: 목록과 미리보기">
      <p>미리보기 위의 [글 고치기]를 켜고 글자를 누르면 그 자리에서 고쳐요. Enter로 마치고 Esc로 그만둬요.</p>
      <p>그림을 누르면 교재 쪽 그림이나 올린 사진으로 바꿔요. 참가자 화면·강사 화면·발표 화면·QR 안내문을 휴대폰·태블릿·PC 크기로 볼 수 있어요.</p>
    </Task>
    <h2>탭마다 하는 일</h2>
    <ul><li><b>목록</b>: 사이트의 섹션이에요. 끌거나 ↑↓로 순서를 바꾸고, […]에서 이름 바꾸기·숨기기·지우기를 해요.</li>
      <li><b>연수 정보</b>: AI가 교재 몇 쪽에서 찾았는지와 함께 제목·날짜·시간·장소·강사를 보여 줘요. 처음에 한 번 확인해요. 고치면 사이트에 같은 글자로 적힌 곳과 QR 안내문·강사 화면·일정 파일이 함께 바뀌어요.</li>
      <li><b>검수</b>: 깨진 그림·빈 섹션·빠진 날짜 같은 문제를 찾아요. [AI에게 고쳐 달라기]를 누르면 AI가 고쳐요.</li>
      <li><b>수정 요청</b>: 고칠 섹션(또는 사이트 전체)과 바라는 점을 적어 AI에게 보내요. 키가 없으면 요청 글을 쓰던 앱에 보내고 답을 넣어요. 답의 섹션만 갈아 끼워요.</li>
      <li><b>색·글꼴</b>: 강조색·글자색·바탕색과 글꼴을 바꿔요. 참여 기능·QR 안내문·발표 화면도 같은 색을 써요.</li></ul>
    <p>AI가 고치기 전의 판은 [판 기록]에 남아요(최근 10판). 처음부터 다시 만들려면 [판 기록]의 [처음부터 다시 만들기]를 눌러요.</p>
  </>,
  live: <>
    <h1 tabIndex={-1}>참여 기능 연결</h1>
    <Shot name="live" alt="배포하기의 참여 기능 줄: 켤 기능과 연결 방법(내 서버·구글 시트·Supabase)" />
    <p>질문·도움 요청·진행 현황·투표·나눔 보드·출석·만족도 조사는 '연결'이 있어야 동작해요.</p><p>기록은 강사님 계정에만 쌓여요. 운영자는 볼 수 없어요.</p>
    <p>배포하기 화면 체크리스트의 첫 줄에서 켤 기능을 누르고 연결해요. 연결한 뒤 배포하면 끝나요.</p>
    <ul><li><b>Cloudflare 내 서버(추천)</b>: 버튼 하나로 내 계정에 서버를 만들어요(GitHub 연결 허락 필요). 할 일이 가장 적고, 한 번 만들면 다음 연수부터 이 기기에서 저절로 연결돼요. 관리자 키는 앱이 만들어 줘요.</li>
      <li><b>구글 시트(50명 안팎)</b>: 구글 계정으로 10분. 시트 하나가 연수 하나라 연수마다 새로 만들어요.</li>
      <li><b>Supabase(80명까지)</b>: 프로젝트를 만들고 앱이 만든 SQL을 두 번 실행해요.</li>
      <li><b>기관 서버·NAS·노트북</b>: Docker 하나로. 인터넷 없는 연수장은 강사 노트북이 서버가 돼요.</li></ul>
    <h2>연수 당일</h2>
    <p>배포 완료 화면의 [강사 화면 열기]를 눌러요(첫 화면의 연수 카드에도 있어요). 관리자 키가 복사돼서 붙여 넣기만 하면 돼요.</p>
    <p>강사 화면의 [발표 화면 띄우기]를 누르면 프로젝터에 발표 화면이 떠요. 크롬·엣지는 화면을 고르면 바로 전체 화면이고, 그 밖의 브라우저는 새 창을 프로젝터 쪽으로 끌어다 놓아요.</p>
    <p>QR 안내문·접속 확인·휴대폰에서 열기는 [더보기]에 있어요. 휴대폰에서 열기의 QR을 찍으면 키를 치지 않고 휴대폰으로 진행해요.</p>
    <h2>자료 올리기</h2>
    <ul><li><b>교재 원본</b>: 배포하기의 공개 범위에서 '교재 원본(PPT·PDF)도 내려받게 하기'를 켜면 자료실에 함께 올라가요.</li>
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
    <p>추천 한 곳이 보이고, 다른 곳은 [다른 곳에 배포하기]로 펼쳐요. 처음 한 번만 연결하면 되고, 다시 배포해도 주소는 그대로예요. 배포한 뒤 고쳤으면 고치기 화면의 [다시 배포하기]를 눌러요.</p>
    <ul><li><b>바로 배포</b>: 가입·토큰 없이 바로 주소가 나와요(운영자가 켠 앱에서만 보여요). 마지막으로 배포한 날부터 60일 동안 열려 있고, 다시 배포하면 그날부터 다시 60일이에요. 연수 날이 그보다 뒤면 배포 화면이 언제 다시 배포할지 알려 줘요. 붐비는 날에는 같은 파일 그대로 내 계정에 배포하게 안내하고, 참여 기능 방만 찼으면 참여 기능만 내 계정으로 연결해요.</li>
      <li><b>Vercel</b>: 토큰을 한 번 붙여 넣어요. 다시 배포해도 주소가 그대로예요.</li>
      <li><b>GitHub Pages</b>: 토큰으로 배포해요. 사이트 파일이 저장소에 공개되고, 방문이 많아도 바로 멈추지 않아요.</li>
      <li><b>Cloudflare</b>: 받은 ZIP을 끌어다 놓아요. 방문이 많아도 멈추지 않아요.</li>
      <li><b>Netlify</b>: 토큰으로 배포해요. 무료는 한 달 20번쯤이에요. 2026. 7. 28. 뒤 가입했다면 Make public을 눌러요.</li>
      <li><b>파일로 받기(ZIP)</b>: 기관 서버·NAS·USB로 나눌 때.</li></ul>
    <p>앱이 멈출 걱정이 적은 곳을 먼저 권하고, 배포한 뒤 주소가 열리는지 확인해요. [설정 → 연결]에서 미리 연결해 두면 버튼 하나로 배포해요.</p>
    <div class="faq">
      <details><summary>짧은 주소와 QR</summary><ul><li>[짧은 주소 만들기]를 누르면 치기 쉬운 주소(is.gd)가 생겨요. joo.is·bit.ly 주소를 붙여 넣어도 돼요.</li><li>QR과 [주소 복사]는 늘 원래 주소예요.</li><li>짧은 주소는 짐작될 수 있어요. 지켜야 할 사이트는 공개 범위를 '암호를 아는 사람만'으로 해요.</li><li>QR은 크게 띄우거나, 그림으로 저장하거나, 안내문(A4)으로 인쇄해요.</li></ul></details>
      <details><summary>강사용 파일</summary><p>운영 안내·연수 정보·사이트 원본·인쇄본은 사이트에 올라가지 않아요. [강사용 파일 받기]로 따로 받아요.</p></details>
      <details><summary>다음 기수·사이트 내리기</summary><ul><li>같은 연수를 다음 기수로 하면 [복제]해서 날짜를 고쳐 배포해요. 새 주소·새 QR이라 지난 기록과 섞이지 않아요.</li><li>같은 주소로 다시 배포할 때 지난 참여 기록이 남아 있으면 체크리스트의 '지난 기록'에서 비울지 그대로 둘지 골라요.</li><li>바로 배포한 사이트는 [사이트 내리기]로 지워요. 확인 창에 함께 지워질 기록이 나오니 필요한 출석·설문은 먼저 강사 화면에서 CSV로 받아 두세요.</li></ul></details>
    </div>
    <p>자세한 단계: <a href={`${REPO}/tree/main/skills/lecpage/references/deploy`} target="_blank" rel="noopener">배포 안내 모음</a></p>
  </>,
  skill: <>
    <h1 tabIndex={-1}>AI 에이전트에서 쓰기</h1>
    <p>Claude Code·Codex·Cursor·Gemini CLI에 lecpage를 설치하면 대화로 만들어요.</p><p>쓰던 구독 그대로라 키가 필요 없어요.</p>
    <h2>설치 명령 한 줄</h2>
    <p><b>Claude Code</b> 대화창에서</p>
    <pre class="prompt-box" tabIndex={0}>/plugin install lecpage --marketplace yoorrard/lecpage</pre>
    {/* copy-ok: 설치 명령이 길어 한 문장이 70자를 넘어요 */}
    <p class="small muted">터미널에서는 <code>claude plugin install lecpage --marketplace yoorrard/lecpage</code>를 써요. 나눠 하려면 <code>/plugin marketplace add yoorrard/lecpage</code> 다음 <code>/plugin install lecpage@lecpage</code>예요.</p>
    <p><b>Codex</b> 대화창에서</p>
    <pre class="prompt-box" tabIndex={0}>$skill-installer https://github.com/yoorrard/lecpage/tree/main/skills/lecpage</pre>
    <p><b>Gemini CLI</b> 터미널에서</p>
    <pre class="prompt-box" tabIndex={0}>gemini skills install https://github.com/yoorrard/lecpage.git --path skills/lecpage</pre>
    <p><b>Cursor 등 그 밖의 도구</b> 터미널에서(위 도구에도 돼요)</p>
    <pre class="prompt-box" tabIndex={0}>npx skills add yoorrard/lecpage</pre>
    <p>claude.ai에서는 <code>skills/lecpage</code> 폴더를 ZIP으로 묶어 설정 → 기능 → 스킬 올리기로 넣어요.</p><p>그다음 "이 PPT로 연수 사이트 만들어 줘"라고 말해요.</p>
    <h2>앱에서 이어 하기</h2>
    <p>미리보기·고치기·배포를 화면에서 하려면 AI에게 "앱에서 이어 할게"라고 말해요. AI가 건넨 <code>.lecpage</code> 파일을 [저장한 파일 열기]로 열어요. 교재 넣기 화면에 놓아도 완성 화면이 바로 열려요.</p>
    <p>참여 기능 연결과 사이트 암호는 옮겨 오지 않아요. 앱에서 다시 정해요.</p>
    <p>앱에서 고친 연수는 [파일로 저장]한 파일을 AI에게 주면 다시 이어 해요.</p>
    <p>바라는 분위기는 <a href="#/gallery">참고 디자인</a>에서 사례나 낱말을 골라 [요청 문장 보기]의 문장을 붙여 넣어요.</p>
  </>,
  privacy: <>
    <h1 tabIndex={-1}>개인정보 안내</h1>
    <p>회원가입이 없고, 교재와 만든 연수를 운영자 서버로 보내지 않아요(바로 배포한 사이트만 예외). 쿠키와 바깥 분석 도구도 없어요.</p>
    <ul><li><b>교재·연수</b>: 이 브라우저의 저장소에만 있어요. [설정]에서 한 번에 지울 수 있어요.</li>
      <li><b>AI 키·배포 토큰</b>: '이 기기에서 기억하기'를 켜면 암호화해 이 브라우저에 둬요. 끄면 이 탭에만 둬요.</li>
      <li><b>브라우저가 직접 보내는 곳</b>: 교재 내용은 고른 AI 회사로, 사이트 파일은 고른 배포 서비스(Vercel 등)로 가요. 운영자를 거치지 않아요.</li>
      <li><b>모델 가격표</b>: 하루 한 번 모아 웹앱에 둔 표와 openrouter.ai의 공개 가격표를 읽어요. 키와 교재는 보내지 않아요.</li>
      <li><b>AI 회사의 학습 이용</b>: 회사와 요금제마다 달라요. 학생 이름·사진은 보내기 전에 지워 주세요.</li>
      <li><b>접속 기록</b>: 웹앱을 보내 주는 Cloudflare(예비 주소는 GitHub)가 보안을 위해 IP 주소를 다뤄요. 운영자는 요청 수 같은 합계만 봐요.</li>
      <li><b>익명 이용 합계</b>: 바로 배포가 켜진 앱만, 앱 열기·만들기·배포가 하루 몇 번인지 숫자만 운영자 서버에 더해요. 누가 했는지·교재·주소는 보내지 않고, [설정]에서 끌 수 있어요.</li>
      <li><b>문의</b>: 운영자가 받는 개인정보는 이메일 문의뿐이에요. <a href="mailto:hello@lecpage.com">hello@lecpage.com</a></li></ul>
    <p>연수 사이트에서 참가자 정보를 받으면 개인정보처리자는 강사·기관이에요.</p><p>기록은 강사님이 연결한 계정에 쌓여요. 바로 배포로 참여 기능을 켰으면 운영자 서버에 보관 기간 동안 저장되고, 운영자는 저장만 맡아요. '개인정보 처리 안내' 페이지가 함께 생겨요.</p>
    <p><a href={`${REPO}/blob/main/docs/legal/privacy.md`} target="_blank" rel="noopener">개인정보 처리방침 전문</a> · <a href={`${REPO}/blob/main/docs/legal/participant-privacy-guide.md`} target="_blank" rel="noopener">참가자 개인정보 안내(강사용)</a></p>
  </>,
  terms: <>
    <h1 tabIndex={-1}>이용약관</h1>
    <ul><li>lecpage 웹앱은 무료이고 회원가입이 없어요. 있는 그대로 제공하며, 오류나 끊김이 없다고 보증하지 않아요.</li>
      <li>넣은 교재와 만든 사이트는 쓰는 분의 것이에요. 연수는 이 브라우저에만 저장되니 [파일로 저장]으로 보관해 주세요.</li>
      <li>교재·사진·글꼴의 저작권과 초상권, 자료 속 개인정보는 쓰는 분이 확인해요. AI가 만든 내용도 배포 전에 확인해요.</li>
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
    <h3>정말 무료인가요?</h3><p>네. lecpage에 내는 돈은 없어요. AI는 쓰던 ChatGPT·Claude·Gemini 앱이나 Gemini 무료 키로 써요.</p><p>사이트와 참여 기능은 강사님의 무료 계정에서 돌아가요. 유료 AI 키를 쓰면 그 회사에 쓴 만큼만 내요.</p>
    {/* copy-ok: "배포용"은 한글 프로그램의 메뉴 이름(배포용 문서로 저장하기) */}<h3>한글(HWP) 파일도 되나요?</h3><p>네, HWP와 HWPX 모두 그대로 넣으면 돼요. 암호를 걸었거나 배포용으로 저장한 문서는 원본 파일이나 PDF로 넣어 주세요.</p>
    <h3>교재 쪽 그림이 안 나와요.</h3><p>쪽 그림은 PDF에서 만들어요. PPT를 PDF로도 저장해 함께 넣어 주세요. AI도 PDF를 가장 잘 읽어요.</p>
    <h3>참가자가 교재를 내려받지 못하게 하고 싶어요.</h3><p>교재 원본은 기본으로 사이트에 넣지 않아요. 슬라이드 그림까지 지키려면 공개 범위를 '암호를 아는 사람만'으로 해요.</p>
    <h3>다른 컴퓨터에서 이어 하고 싶어요.</h3><p>[파일로 저장]으로 저장하고, 다른 컴퓨터에서 [저장한 파일 열기]로 열어요. 기본 파일에는 배포 열쇠가 없어 남에게 줘도 되고, 그 파일로 배포하면 새 주소가 생겨요.</p><p>같은 주소로 이어 배포하려면 저장할 때 '내 다른 기기에서 같은 주소로 이어 배포하기'를 켜요. 연 뒤에는 배포하기 화면에서 [이 주소에 이어서 배포]를 눌러요. 이 파일에는 열쇠가 들어가니 남에게 주지 마세요.</p>
    <h3>디자인을 원하는 대로 바꾸고 싶어요.</h3><p>[수정 요청]에 바라는 느낌을 적어 AI에게 보내거나 [색·글꼴]에서 바로 바꿔요. 만들기 전이면 <a href="#/gallery">참고 디자인</a>에서 사례를 골라 둬요.</p>
    <div class="row"><Mascot size={64} mood="happy" /><span>더 궁금한 점은 <a href={`${REPO}/issues`} target="_blank" rel="noopener">GitHub 이슈</a>로 남겨 주세요.</span></div>
  </>,
};
