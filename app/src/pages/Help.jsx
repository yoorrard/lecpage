import { useState } from 'preact/hooks';
import { Sheet } from '../components/ui.jsx';
import { Mascot } from '../components/Mascot.jsx';
import { KeyGuides } from '../lib/ai-guides.jsx';
import { geminiResetKo } from '../lib/ai.js';

const REPO = 'https://github.com/yoorrard/lecpage';
const TOPICS = [
  ['start', '시작하기'], ['ai', 'AI 연결'], ['edit', '살펴보고 고치기'], ['live', '참여 기능 연결'], ['deploy', '배포하기·공개 범위'], ['skill', 'AI 에이전트에서 쓰기'], ['privacy', '개인정보 안내'], ['terms', '이용약관'], ['license', '오픈소스·라이선스'], ['faq', '자주 묻는 질문'],
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
    ['AI', '흐름과 문구 짜기', ico(<><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16v4M17 18h4" /></>)],
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

/**
 * 눌러 보는 예: 도움말 안에서 예시 연수로 '말로 고치기'를 해 봄. 누를 때 엔진과 낱말을 불러옴(도움말을 처음 열 때는 받지 않음).
 * 바꾼 것은 이 화면 안에만 있고 어디에도 저장하지 않아요.
 */
function TryWords() {
  const [mod, setMod] = useState(null); const [bp, setBp] = useState(null); const [hist, setHist] = useState([]); const [busy, setBusy] = useState(false);
  async function start() {
    setBusy(true);
    try {
      const [m, b] = await Promise.all([Promise.all([import('../design-words/SayFix.jsx'), import('../design-words/MiniSite.jsx'), import('../design-words/words.js')]), import('../lib/project.js').then((x) => x.loadExample('data-lab'))]);
      setMod({ SayFix: m[0].SayFix, MiniSite: m[1].MiniSite, applyWords: m[2].applyWords }); setBp(b);
    } catch { setBusy(false); }
  }
  if (!mod || !bp) return <p class="help-cta"><button type="button" class="btn" disabled={busy} onClick={start}>{busy ? '불러오는 중…' : '여기서 눌러 보기'}</button><span class="small muted">예시 연수로 해 봐요. 저장하지 않아요.</span></p>;
  const { SayFix, MiniSite, applyWords } = mod;
  return (
    <div class="help-try">
      <SayFix bp={bp} hTag="h3" idp="htry" title="예시 연수: 데이터로 읽는 우리 반" desc="" onApply={(f) => { setHist([...hist, bp]); setBp(applyWords(bp, f.ids)); }} isDone={() => false} />
      <figure class="help-try-now"><MiniSite bp={bp} eager tour /><figcaption class="small muted">지금 모습{hist.length ? ` · ${hist.length}번 바꿈` : ''}{hist.length > 0 && <> · <button type="button" class="btn btn-sm btn-quiet" onClick={() => { setBp(hist[hist.length - 1]); setHist(hist.slice(0, -1)); }}>되돌리기</button></>}</figcaption></figure>
    </div>
  );
}

const BODY = {
  start: <>
    <h1 tabIndex={-1}>시작하기</h1>
    <p>교재를 넣으면 AI가 연수 사이트를 만들고, 버튼 하나로 배포해요. 회원가입과 이용료가 없어요.</p>
    <Flow />
    <p class="help-cta"><a class="btn btn-primary" href="#/demo">체험하기</a><span class="small muted">예시 자료로 끝까지 해 봐요. 키가 필요 없어요.</span></p>
    <Task n="1" title="교재 넣기" shot="start" alt="교재 넣기 화면: 교재 파일과 연수 정보, AI로 사이트 만들기 버튼">
      <p>PPT·PDF·한글(HWP·HWPX)·워드 파일을 놓고 연수명을 확인해요.</p>
      <p>'AI로 만들기' 카드에서 [ChatGPT 열기]를 누르고, 답을 복사해 돌아와 [답 넣기]를 눌러요. API 키가 있으면 버튼 한 번이에요. <a href="#/help/ai">AI 연결</a></p>
    </Task>
    <Task n="2" title="살펴보고 고치기" shot="edit" alt="살펴보고 고치기 화면: 왼쪽에 섹션 목록, 오른쪽에 미리보기">
      <p>미리보기를 보며 내용·디자인·참여 기능을 고쳐요. 자동으로 저장돼요. <a href="#/help/edit">고치는 법</a></p>
    </Task>
    <Task n="3" title="배포하기" shot="share" alt="배포하기 화면">
      <p>체크리스트(참여 기능 → 공개 범위 → 배포할 곳)를 따라가 [배포하기]를 누르면 주소·QR이 나와요. <a href="#/help/deploy">배포하는 법</a></p>
    </Task>
    <p class="small muted">다른 컴퓨터에서 이어 하려면 [파일로 저장]으로 저장하고, 그 컴퓨터에서 [저장한 파일 열기]로 열어요.</p>
  </>,
  ai: <>
    <h1 tabIndex={-1}>AI 연결</h1>
    <p>AI가 교재를 읽고 연수 흐름과 문구를 짜요. 처음 한 번만 연결하면 돼요.</p>
    <KeyMap />
    <h2>어떤 AI를 고를까요?</h2>
    <ul><li><b>ChatGPT·Claude</b>: 구성과 문구가 꼼꼼해요. 크레딧을 충전해 쓰고, 사이트 하나에 몇백 원쯤 들어요.</li>
      <li><b>Gemini(무료)</b>: 돈을 들이지 않고 해 볼 때 써요. Flash 모델이라 구성과 문구가 단순할 수 있고, 하루에 쓸 수 있는 횟수가 정해져 있어요. 넣은 내용이 구글 제품 개선에 쓰일 수 있고, 계정에 따라 휴대폰 확인을 요청해요. API 키 연결 창 아래의 [무료로 하기(Gemini)]를 눌러요.</li></ul>
    <Task n="1" title="키 페이지 열기" shot="connect" alt="AI 연결 창: 쓸 AI를 고르고 키 페이지를 여는 버튼, 누를 곳을 보여 주는 그림" w={760} h={530}>
      <p>교재 넣기 화면의 'AI로 만들기' 카드에서 [API 키로 만들기]를 눌러요.</p>
      <p>쓸 AI를 고르고 버튼을 누르면 그 회사의 키 페이지가 새 창으로 열려요. 그림의 동그라미가 누를 곳이에요.</p>
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
      <details><summary>크레딧이 없대요</summary><p>ChatGPT·Claude 키는 그 회사의 결제 페이지에서 크레딧을 충전해야 쓸 수 있어요. 5달러면 사이트를 열 개 넘게 만들어요. 결제 없이 만들려면 [쓰던 ChatGPT로 만들기]를 누르세요.</p></details>
      <details><summary>AI 회사에 닿지 못했대요</summary><p>학교·회사 망이 AI 사이트를 막았을 수 있어요. 휴대폰 핫스팟으로 바꿔 보세요.</p></details>
      <details><summary>무료 횟수를 다 썼대요</summary><p>앱이 잠깐 기다렸다가 다시 하거나, 무료로 되는 다른 모델로 이어서 해요. 그래도 안 되면 한국 시간 {geminiResetKo()}쯤 다시 채워져요. 유료 키도 연결해 두었다면 유료로 이어서 할지 물어봐요.</p></details>
    </div>
    <h2>더 궁금할 때</h2>
    <div class="faq">
      <details><summary>키가 뭐예요? 안전한가요?</summary><p>API 키는 AI 회사가 내 계정에 만들어 주는 긴 암호예요. 키와 교재의 글은 이 브라우저에서 고른 AI 회사로만 가고, lecpage 운영자는 볼 수 없어요. '이 기기에서 기억하기'를 켜면 암호화해 이 기기에만 저장해요. 공용 PC에서는 꺼 주세요.</p></details>
      <details><summary>학생 정보가 든 교재를 넣어도 되나요?</summary><p>학생 이름·사진 같은 개인정보는 지우고 넣어 주세요. 교재의 글이 AI 회사로 가고, Gemini 무료 키로 넣은 내용은 구글 제품 개선에 쓰일 수 있어요.</p></details>
      <details><summary>모델은 어떻게 고르나요?</summary><p>고르지 않아도 돼요. 그 키로 쓸 수 있는 모델 중 품질과 값의 균형이 좋은 것을 앱이 골라 둬요. 바꾸려면 교재 넣기 화면의 '연결됨' 줄을 눌러요.</p></details>
      <details><summary>키 없이 쓰던 AI로 만들 수 있나요?</summary><p>네. 그게 기본이에요. 교재 넣기 화면의 [ChatGPT 열기]를 누르면 보낼 글이 복사되고 창이 열려요(Claude는 입력 칸까지 채워져요. 비어 있으면 붙여 넣으세요). 답을 복사해 돌아와 [답 넣기]를 누르면 돼요. 한 번 허락하면 다음부터는 돌아올 때 답이 저절로 들어가요. Claude 입력 칸을 채우는 방식은 보낼 글이 주소에 담겨 브라우저 방문 기록에도 남아요.</p></details>
      <details><summary>AI 답이 중간에 끊겼어요</summary><p>[이어 쓰기 요청 복사]를 눌러 AI에게 보내고, 이어진 답을 복사해 [이어진 답 넣기]를 누르세요. 앞의 답 뒤에 이어 붙여요.</p></details>
      <details><summary>AI가 답 대신 질문만 해요</summary><p>[다시 요청 글 복사]를 눌러 보내면 바로 써 줘요.</p></details>
      <details><summary>'교재대로 되돌렸어요'는 뭔가요?</summary><p>AI가 프롬프트 원문·실습 단계·일정·FAQ·목표·교재 주소를 바꾸거나 빼면 lecpage가 교재대로 되돌려요. [보기]에서 곳마다 견주고, 원하면 [AI 답으로 되돌리기]를 눌러요.</p></details>
      <details><summary>ChatGPT·Claude 구독이 있는데 키가 또 필요한가요?</summary><p>구독으로 이 앱에 바로 로그인할 수는 없어요. 대신 ChatGPT Pro·Business, Claude Max·Ultra·Team 구독에는 API 크레딧이 들어 있어요. 그 회사 사이트에서 받아 쓰면 돼요. 그 밖의 구독이면 교재 넣기 화면의 [ChatGPT 열기]로 쓰던 ChatGPT·Claude를 그대로 쓰세요.</p></details>
    </div>
  </>,
  edit: <>
    <h1 tabIndex={-1}>살펴보고 고치기</h1>
    <p>왼쪽에서 고치면 오른쪽 미리보기가 바로 바뀌어요. 잘못 고쳤으면 [되돌리기]를 눌러요.</p>
    <Task title="내용과 연수 정보" shot="edit" alt="살펴보고 고치기 화면: 내용 탭과 미리보기">
      <p><b>내용</b>에서 섹션을 눌러 문구를 고치고, 순서를 바꾸거나 더하고 빼요. 미리보기의 [눌러서 고치기]로 칸을 바로 열 수도 있어요.</p>
      <p><b>연수 정보</b>에서 날짜·장소·강사 소개를 고쳐요.</p>
    </Task>
    <section class="help-task help-task-wide">
      <div class="help-task-t">
        <h2>디자인을 말로 고치기</h2>
        <p>[디자인] 탭 맨 위 '느낌이 다른 세 안'에서 하나를 누르면 바로 바뀌어요. [크게 비교]로 나란히 볼 수 있어요.</p>
        <p>"좀 답답해 보여요"처럼 적거나 예시를 누르면 고칠 곳을 지금 모습과 바꾼 모습으로 보여 줘요.</p>
        <p>[적용하기]를 누르면 바로 바뀌고, [되돌리기]로 돌아가요.</p>
        <p>디자인 낱말의 이름과 예는 <a href="#/gallery">디자인 둘러보기</a>에 있어요. 담은 낱말은 새 연수의 요청 사항이 되고, 만든 연수에는 바로 적용돼요.</p>
      </div>
      <TryWords />
    </section>
    <Task title="AI에게 고쳐 달라고 하기" shot="review" alt="수정 요청 탭: 고칠 점을 적는 대화창">
      <p>[수정 요청]에 바라는 점을 적으면 AI가 고쳐요. 미리보기의 [✎ 표시하기]로 고칠 곳에 펜으로 표시해도 돼요.</p>
    </Task>
    <Task title="참여 기능 켜기" shot="live" alt="참여 기능 탭: 질문 받기, 투표, 나눔 보드 같은 기능 목록">
      <p>질문·투표·나눔 보드처럼 참가자 휴대폰과 강사 화면을 잇는 기능이에요. <a href="#/help/live">참여 기능 연결</a></p>
    </Task>
  </>,
  live: <>
    <h1 tabIndex={-1}>참여 기능 연결</h1>
    <Shot name="live" alt="참여 기능 탭: 질문 받기, 투표, 나눔 보드 같은 기능 목록" />
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
    <ul><li><b>파일</b>: '내용 → 자료실'에서 [＋ 파일 올리기]. 배포한 뒤 [다시 배포하기]를 누르면 같은 주소에 반영돼요.</li>
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
    <ul><li><b>바로 배포</b>: 가입·토큰 없이 바로 주소가 나와요(운영자가 켠 앱에서만 보여요). 붐비는 날에는 같은 파일 그대로 내 계정에 배포하게 안내하고, 참여 기능 방만 찼으면 참여 기능만 내 계정으로 연결해요.</li>
      <li><b>Vercel</b>: 토큰을 한 번 붙여 넣어요. 다시 배포해도 주소가 그대로예요.</li>
      <li><b>GitHub Pages</b>: 토큰으로 배포해요. 사이트 파일이 저장소에 공개되고, 방문이 많아도 바로 멈추지 않아요.</li>
      <li><b>Cloudflare</b>: 받은 ZIP을 끌어다 놓아요. 방문이 많아도 멈추지 않아요.</li>
      <li><b>Netlify</b>: 토큰으로 배포해요. 무료는 한 달 20번쯤이에요. 2026. 7. 28. 뒤 가입했다면 Make public을 눌러요.</li>
      <li><b>파일로 받기(ZIP)</b>: 기관 서버·NAS·USB로 나눌 때.</li></ul>
    <p>앱이 멈출 걱정이 적은 곳을 먼저 권하고, 배포한 뒤 주소가 열리는지 확인해요. [설정 → 연결]에서 미리 연결해 두면 버튼 하나로 배포해요.</p>
    <div class="faq">
      <details><summary>짧은 주소와 QR</summary><ul><li>[짧은 주소 만들기]를 누르면 치기 쉬운 주소(is.gd)가 생겨요. joo.is·bit.ly 주소를 붙여 넣어도 돼요.</li><li>QR과 [주소 복사]는 늘 원래 주소예요.</li><li>짧은 주소는 짐작될 수 있어요. 지켜야 할 사이트는 공개 범위를 '암호를 아는 사람만'으로 해요.</li><li>QR은 크게 띄우거나, 그림으로 저장하거나, 안내문(A4)으로 인쇄해요.</li></ul></details>
      <details><summary>강사용 파일</summary><p>운영 안내·디자인 규칙·설계도는 사이트에 올라가지 않아요. [강사용 파일 받기]로 따로 받아요.</p></details>
    </div>
    <p>자세한 단계: <a href={`${REPO}/tree/main/skills/lecpage/references/deploy`} target="_blank" rel="noopener">배포 안내 모음</a></p>
  </>,
  skill: <>
    <h1 tabIndex={-1}>AI 에이전트에서 쓰기</h1>
    <p>Claude Code·Codex·Cursor·Gemini CLI에 lecpage를 설치하면 대화로 만들어요.</p><p>쓰던 구독 그대로라 키가 필요 없어요.</p>
    <h2>설치 명령 한 줄</h2>
    <p><b>Claude Code</b> 대화창에서</p>
    <pre class="prompt-box">/plugin install lecpage --marketplace yoorrard/lecpage</pre>
    {/* copy-ok: 설치 명령이 길어 한 문장이 70자를 넘어요 */}
    <p class="small muted">터미널에서는 <code>claude plugin install lecpage --marketplace yoorrard/lecpage</code>를 써요. 나눠 하려면 <code>/plugin marketplace add yoorrard/lecpage</code> 다음 <code>/plugin install lecpage@lecpage</code>예요.</p>
    <p><b>Codex</b> 대화창에서</p>
    <pre class="prompt-box">$skill-installer https://github.com/yoorrard/lecpage/tree/main/skills/lecpage</pre>
    <p><b>Gemini CLI</b> 터미널에서</p>
    <pre class="prompt-box">gemini skills install https://github.com/yoorrard/lecpage.git --path skills/lecpage</pre>
    <p><b>Cursor 등 그 밖의 도구</b> 터미널에서(위 도구에도 돼요)</p>
    <pre class="prompt-box">npx skills add yoorrard/lecpage</pre>
    <p>claude.ai에서는 <code>skills/lecpage</code> 폴더를 ZIP으로 묶어 설정 → 기능 → 스킬 올리기로 넣어요.</p><p>그다음 "이 PPT로 연수 사이트 만들어 줘"라고 말해요.</p>
    <h2>앱에서 이어 하기</h2>
    <p>디자인을 화면에서 고르거나 참여 기능·배포를 직접 하려면 AI에게 "앱에서 이어 할게"라고 말해요. AI가 건넨 <code>.lecpage</code> 파일을 첫 화면의 [저장한 파일 열기]로 열면 교재 보기 그림까지 그대로 이어져요.</p>
    <p>참여 기능 연결과 사이트 암호는 옮겨 오지 않아요. 앱에서 다시 정해요.</p>
    <p>앱에서 고친 연수는 [파일로 저장]한 파일을 AI에게 주면 다시 이어 해요.</p>
    <p>디자인은 <a href="#/gallery">디자인 둘러보기</a>에서 낱말을 담아 [요청 문장 보기]의 문장을 붙여 넣으면 그대로 맞춰요.</p>
  </>,
  privacy: <>
    <h1 tabIndex={-1}>개인정보 안내</h1>
    <p>회원가입이 없고, 교재와 만든 연수를 운영자 서버로 보내지 않아요. 쿠키와 바깥 분석 도구도 없어요.</p>
    <ul><li><b>교재·연수</b>: 이 브라우저의 저장소에만 있어요. [설정]에서 한 번에 지울 수 있어요.</li>
      <li><b>AI 키·배포 토큰</b>: '이 기기에서 기억하기'를 켜면 암호화해 이 브라우저에 둬요. 끄면 이 탭에만 둬요.</li>
      <li><b>브라우저가 직접 보내는 곳</b>: 교재 내용은 고른 AI 회사로, 사이트 파일은 고른 배포 서비스(Vercel 등)로 가요. 운영자를 거치지 않아요.</li>
      <li><b>모델 가격표</b>: openrouter.ai의 공개 가격표를 읽어요. 키와 교재는 보내지 않아요.</li>
      <li><b>AI 회사의 학습 이용</b>: 회사와 요금제마다 달라요. 학생 이름·사진은 보내기 전에 지워 주세요.</li>
      <li><b>접속 기록</b>: 웹앱을 보내 주는 호스팅 회사가 보안을 위해 IP 주소를 기록해요. 운영자는 볼 수 없어요.</li>
      <li><b>익명 이용 합계</b>: 바로 배포가 켜진 앱만, 앱 열기·만들기·배포가 하루 몇 번인지 숫자만 운영자 서버에 더해요. 누가 했는지·교재·주소는 보내지 않고, [설정]에서 끌 수 있어요.</li>
      <li><b>문의</b>: 운영자가 받는 개인정보는 이메일 문의뿐이에요. <a href="mailto:yyj19962004@gmail.com">yyj19962004@gmail.com</a></li></ul>
    <p>연수 사이트에서 참가자 정보를 받으면 개인정보처리자는 강사·기관이에요.</p><p>기록은 강사님이 연결한 계정에만 쌓여요. '개인정보 처리 안내' 페이지가 함께 생겨요.</p>
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
    <h3>정말 무료인가요?</h3><p>네. lecpage에 내는 돈은 없어요. AI는 쓰던 ChatGPT·Claude·Gemini 창이나 Gemini 무료 키로 써요.</p><p>사이트와 참여 기능은 강사님의 무료 계정에서 돌아가요. 유료 AI 키를 쓰면 그 회사에 쓴 만큼만 내요.</p>
    {/* copy-ok: "배포용"은 한글 프로그램의 메뉴 이름(배포용 문서로 저장하기) */}<h3>한글(HWP) 파일도 되나요?</h3><p>네, HWP와 HWPX 모두 그대로 넣으면 돼요. 암호를 걸었거나 배포용으로 저장한 문서는 원본 파일이나 PDF로 넣어 주세요.</p>
    <h3>교재 보기에 그림이 안 나와요.</h3><p>슬라이드 그림은 PDF에서 만들어요. PPT를 PDF로도 저장해 함께 넣어 주세요.</p>
    <h3>참가자가 교재를 내려받지 못하게 하고 싶어요.</h3><p>교재 원본은 기본으로 사이트에 넣지 않아요. 슬라이드 그림까지 지키려면 공개 범위를 '암호를 아는 사람만'으로 해요.</p>
    <h3>다른 컴퓨터에서 이어 하고 싶어요.</h3><p>[파일로 저장]으로 저장하고, 다른 컴퓨터에서 [저장한 파일 열기]로 열어요. 남이 준 파일은 안전을 위해 참여 기능을 다시 연결해요.</p>
    <h3>디자인을 원하는 대로 바꾸고 싶어요.</h3><p>[디자인] 탭에 보이는 느낌을 말로 적거나, <a href="#/gallery">디자인 둘러보기</a>에서 낱말을 담아 적용해요.</p>
    <div class="row"><Mascot size={64} mood="happy" /><span>더 궁금한 점은 <a href={`${REPO}/issues`} target="_blank" rel="noopener">GitHub 이슈</a>로 남겨 주세요.</span></div>
  </>,
};
