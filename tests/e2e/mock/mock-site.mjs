// 가짜 AI가 돌려줄 '그럴듯한' 강의 사이트: 단계별 답(plan JSON, design CSS+틀, 섹션 HTML, fix, edit)
export const PLAN = {
  title: '생성형 AI로 수업 자료 만들기', subtitle: '제미나이·클로드로 30분 만에 학습지 완성', organizer: '○○교육지원청',
  sessions: [{ date: '2026-12-03', start: '14:00', end: '17:00' }], venue: '본청 3층 대회의실', mode: 'offline', audience: 'teachers',
  instructors: [{ name: '김하늘', org: '한빛초등학교' }],
  facts: [{ label: '날짜', value: '2026년 12월 3일(수)', page: 1 }, { label: '시간', value: '14:00~17:00', page: 1 }, { label: '장소', value: '본청 3층 대회의실', page: 1 }, { label: '강사', value: '김하늘(한빛초)', page: 2 }],
  summary: '생성형 AI 도구로 수업 자료를 만드는 실습 연수예요. 프롬프트의 기본 틀을 익히고, 학습지와 평가 문항을 직접 만들어 봐요.',
  audienceNote: '초등 교사가 노트북과 휴대폰으로 따라 하며 봐요.',
  flow: ['도입: 오늘의 목표', '개념: 프롬프트의 네 요소', '실습: 학습지 만들기', '나눔: 결과물 올리기', '마무리: 설문'],
  designBrief: { mood: '차분하고 따뜻한 교실 칠판 느낌', fromMaterial: '교재의 진초록·크림색, 둥근 모서리 카드, 번호 붙은 단계', layout: '넓은 여백, 2단 카드', typography: '굵은 제목, 넉넉한 줄 간격', motifs: '번호 동그라미, 분필 밑줄' },
  theme: { accent: '#1f6f50', ink: '#1d2421', paper: '#fbf8f1', font: 'Pretendard, "Apple SD Gothic Neo", sans-serif' },
  features: ['qa', 'poll', 'board', 'attendance', 'survey', 'help', 'deck', 'materials'],
  sections: [
    { id: 'hero', title: '첫 화면', purpose: '연수 이름과 일시·장소', outline: ['제목·부제(1쪽)', '일시·장소(1쪽)'], widgets: ['join'], pages: [1], images: ['material/p-001.webp'] },
    { id: 'flow', title: '오늘의 흐름', purpose: '세 시간의 순서', outline: ['흐름 다섯 단계(2쪽)'], widgets: ['attend'], pages: [2] },
    { id: 'concepts', title: '프롬프트의 네 요소', purpose: '핵심 개념', outline: ['역할·목표·형식·조건(3~4쪽)'], widgets: [], pages: [3, 4], images: ['material/p-003.webp'] },
    { id: 'practice', title: '실습: 학습지 만들기', purpose: '따라 하는 단계', outline: ['1단계 접속(5쪽)', '2단계 프롬프트(6쪽)', '3단계 다듬기(7쪽)'], widgets: ['board'], pages: [5, 6, 7] },
    { id: 'share', title: '생각 나누기', purpose: '투표와 질문', outline: ['어떤 자료를 만들고 싶나요(8쪽)'], widgets: ['poll', 'qa'], pages: [8] },
    { id: 'deck', title: '교재 보기', purpose: '강사 따라 교재 넘기기', outline: ['교재 1~13쪽'], widgets: ['deck'], pages: [1, 13] },
    { id: 'wrap', title: '자료실과 설문', purpose: '마무리', outline: ['자료 내려받기(12쪽)', '설문(13쪽)'], widgets: ['materials', 'survey'], pages: [12, 13] },
  ],
};

export const CSS = `/* 클래스: .site-header 머리, .nav 내비게이션, .wrap 가운데 폭, .hero 첫 화면, .eyebrow 작은 머리말, .lead 큰 본문, .meta 일시·장소 줄, .card 카드, .grid 2단 격자, .num 번호 동그라미, .timeline 흐름, .step 실습 단계, .figure 교재 그림, .btn 버튼, .tag 꼬리표, .note 안내, .site-footer 바닥글 */
:root {
  --lp-accent: #1f6f50;
  --lp-ink: #1d2421;
  --lp-paper: #fbf8f1;
  --lp-font: Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif;
  --lp-radius: 14px;
  --chalk: #e7efe9;
  --line: #d9d3c4;
  --space: clamp(16px, 4vw, 40px);
  --step-0: clamp(1rem, 0.96rem + 0.2vw, 1.125rem);
  --step-2: clamp(1.5rem, 1.2rem + 1.4vw, 2.25rem);
  --step-3: clamp(2rem, 1.4rem + 2.8vw, 3.4rem);
}
*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; background: var(--lp-paper); color: var(--lp-ink); font-family: var(--lp-font); font-size: var(--step-0); line-height: 1.7; word-break: keep-all; overflow-wrap: anywhere; }
img { max-width: 100%; height: auto; display: block; }
a { color: var(--lp-accent); text-underline-offset: 3px; }
h1, h2, h3 { line-height: 1.25; margin: 0 0 .5em; letter-spacing: -0.01em; }
h2 { font-size: var(--step-2); }
.wrap { width: min(1080px, 100% - 2 * var(--space)); margin-inline: auto; }
.site-header { position: sticky; top: 0; z-index: 10; background: color-mix(in srgb, var(--lp-paper) 92%, transparent); backdrop-filter: blur(6px); border-bottom: 1px solid var(--line); }
.site-header .wrap { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 56px; }
.brand { font-weight: 800; color: var(--lp-ink); text-decoration: none; }
.nav { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; max-width: 70%; }
.nav a { padding: 6px 10px; border-radius: 999px; text-decoration: none; color: var(--lp-ink); white-space: nowrap; font-size: .92rem; }
.nav a:hover, .nav a:focus-visible { background: var(--chalk); }
main > section { padding-block: calc(var(--space) * 1.6); border-bottom: 1px solid var(--line); }
.hero { background: linear-gradient(180deg, var(--chalk), var(--lp-paper)); }
.hero h1 { font-size: var(--step-3); }
.eyebrow { display: inline-block; font-weight: 700; color: var(--lp-accent); letter-spacing: .04em; margin-bottom: 8px; }
.lead { font-size: 1.15em; max-width: 38em; }
.meta { display: flex; flex-wrap: wrap; gap: 8px 18px; padding: 0; margin: 16px 0 0; list-style: none; }
.meta li { display: flex; gap: 6px; }
.meta b { color: var(--lp-accent); }
.grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.card { background: #fff; border: 1px solid var(--line); border-radius: var(--lp-radius); padding: 18px 20px; }
.card h3 { font-size: 1.1rem; display: flex; align-items: center; gap: 10px; }
.num { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: var(--lp-accent); color: #fff; font-weight: 800; font-size: .95rem; flex: none; }
.timeline { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.timeline li { display: grid; grid-template-columns: 84px 1fr; gap: 12px; align-items: baseline; padding: 12px 0; border-bottom: 1px dashed var(--line); }
.timeline time { font-weight: 700; color: var(--lp-accent); }
.step { background: #fff; border-left: 4px solid var(--lp-accent); border-radius: 0 var(--lp-radius) var(--lp-radius) 0; padding: 16px 20px; margin: 14px 0; }
.step h3 { margin-bottom: .3em; }
.prompt { background: #13201a; color: #e8f3ec; padding: 14px 16px; border-radius: 10px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: .92rem; white-space: pre-wrap; }
.figure { margin: 16px 0; }
.figure img { border-radius: var(--lp-radius); border: 1px solid var(--line); }
.figure figcaption { font-size: .9rem; color: #4a524e; margin-top: 6px; }
.btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 999px; background: var(--lp-accent); color: #fff; text-decoration: none; font-weight: 700; }
.tag { display: inline-block; padding: 2px 10px; border-radius: 999px; background: var(--chalk); color: var(--lp-accent); font-size: .85rem; font-weight: 700; }
.note { background: var(--chalk); border-radius: var(--lp-radius); padding: 12px 16px; }
.site-footer { padding-block: 32px; color: #4a524e; font-size: .9rem; }
@media (max-width: 640px) { .timeline li { grid-template-columns: 1fr; gap: 2px; } .nav { max-width: 60%; } }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } * { transition: none !important; animation: none !important; } }`;

export const SHELL = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>생성형 AI로 수업 자료 만들기</title>
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<header class="site-header"><div class="wrap"><a class="brand" href="#hero">AI 수업 자료 연수</a>
<nav class="nav" aria-label="섹션"><a href="#flow">흐름</a><a href="#concepts">개념</a><a href="#practice">실습</a><a href="#share">나눔</a><a href="#deck">교재</a><a href="#wrap">자료실</a></nav></div></header>
<main>
<!-- lp:sections -->
</main>
<footer class="site-footer"><div class="wrap">○○교육지원청 · 2026년 12월 3일 연수</div></footer>
<script>document.querySelectorAll('.nav a').forEach(function(a){a.addEventListener('click',function(){document.querySelectorAll('.nav a').forEach(function(b){b.removeAttribute('aria-current');});a.setAttribute('aria-current','true');});});</script>
</body>
</html>`;

export const SECTIONS = {
  hero: `<section id="hero" class="hero" data-title="첫 화면">
  <div class="wrap">
    <span class="eyebrow">교원 연수 · 실습</span>
    <h1>생성형 AI로 수업 자료 만들기</h1>
    <p class="lead">제미나이와 클로드로 30분 만에 학습지를 완성해 봐요. 프롬프트의 기본 틀부터 평가 문항까지 함께 만들어요.</p>
    <ul class="meta">
      <li><b>일시</b> 2026년 12월 3일(수) 14:00~17:00</li>
      <li><b>장소</b> 본청 3층 대회의실</li>
      <li><b>강사</b> 김하늘(한빛초등학교)</li>
    </ul>
    <figure class="figure"><img src="material/p-001.webp" alt="교재 표지: 생성형 AI로 수업 자료 만들기" loading="lazy"><figcaption>교재 1쪽</figcaption></figure>
    <div data-lp="join"></div>
  </div>
</section>`,
  flow: `<section id="flow" data-title="오늘의 흐름">
  <div class="wrap">
    <h2>오늘의 흐름</h2>
    <ol class="timeline">
      <li><time>14:00</time><span>도입: 오늘의 목표와 도구 소개</span></li>
      <li><time>14:20</time><span>개념: 프롬프트의 네 요소</span></li>
      <li><time>15:00</time><span>실습: 학습지 만들기</span></li>
      <li><time>16:10</time><span>나눔: 결과물 올리고 이야기하기</span></li>
      <li><time>16:40</time><span>마무리: 설문과 자료 내려받기</span></li>
    </ol>
    <p class="note">도착하면 출석을 눌러 주세요.</p>
    <div data-lp="attend"></div>
  </div>
</section>`,
  concepts: `<section id="concepts" data-title="프롬프트의 네 요소">
  <div class="wrap">
    <h2>프롬프트의 네 요소</h2>
    <p>좋은 프롬프트는 역할, 목표, 형식, 조건 네 가지를 담아요.</p>
    <div class="grid">
      <article class="card"><h3><span class="num">1</span>역할</h3><p>AI에게 맡길 역할을 정해요. 예: 초등 4학년 과학 교사</p></article>
      <article class="card"><h3><span class="num">2</span>목표</h3><p>무엇을 만들지 분명히 적어요. 예: 물의 순환 학습지</p></article>
      <article class="card"><h3><span class="num">3</span>형식</h3><p>표·문항 수·분량을 정해요. 예: 빈칸 5개, 서술형 2개</p></article>
      <article class="card"><h3><span class="num">4</span>조건</h3><p>지켜야 할 것을 적어요. 예: 교과서 용어만 쓰기</p></article>
    </div>
    <figure class="figure"><img src="material/p-003.webp" alt="교재 3쪽: 프롬프트 네 요소 도식" loading="lazy"><figcaption>교재 3쪽</figcaption></figure>
  </div>
</section>`,
  practice: `<section id="practice" data-title="실습: 학습지 만들기">
  <div class="wrap">
    <h2>실습: 학습지 만들기</h2>
    <section class="step" data-lp-step="s1" data-title="1단계: 접속하기">
      <h3>1단계: 접속하기</h3>
      <p>gemini.google.com에 학교 계정으로 로그인해요.</p>
    </section>
    <section class="step" data-lp-step="s2" data-title="2단계: 프롬프트 넣기">
      <h3>2단계: 프롬프트 넣기</h3>
      <p class="prompt">너는 초등 4학년 과학 교사야. 물의 순환을 배우는 학습지를 만들어 줘. 빈칸 5개와 서술형 2개, 교과서 용어만 써 줘.</p>
    </section>
    <section class="step" data-lp-step="s3" data-title="3단계: 다듬기">
      <h3>3단계: 다듬기</h3>
      <p>틀린 내용이 없는지 확인하고, 우리 반에 맞게 고쳐요.</p>
    </section>
    <p>만든 학습지를 보드에 올려 주세요.</p>
    <div data-lp="board" data-prompt="내가 만든 학습지 사진이나 글을 올려 주세요"></div>
  </div>
</section>`,
  share: `<section id="share" data-title="생각 나누기">
  <div class="wrap">
    <h2>생각 나누기</h2>
    <p>다음에 AI로 만들어 보고 싶은 자료를 골라 주세요.</p>
    <div data-lp="poll" data-question="AI로 가장 먼저 만들어 보고 싶은 자료는?" data-options='["학습지","평가 문항","가정통신문","수업 슬라이드"]'></div>
    <h3>궁금한 점</h3>
    <div data-lp="qa"></div>
  </div>
</section>`,
  deck: `<section id="deck" data-title="교재 보기">
  <div class="wrap">
    <h2>교재 보기</h2>
    <p>강사 화면을 따라 교재가 넘어가요.</p>
    <div data-lp="deck" data-pages="1-13"></div>
  </div>
</section>`,
  wrap: `<section id="wrap" data-title="자료실과 설문">
  <div class="wrap">
    <h2>자료실과 설문</h2>
    <div class="grid">
      <div class="card"><h3>자료 내려받기</h3><div data-lp="materials"></div></div>
      <div class="card"><h3>연수 설문</h3><div data-lp="survey" data-questions='[{"q":"오늘 연수는 어땠나요?","kind":"scale"},{"q":"수업에 바로 쓸 수 있나요?","kind":"choice","options":["네","조금","아니요"]},{"q":"하고 싶은 말","kind":"text"}]'></div></div>
    </div>
  </div>
</section>`,
};

export function planAnswer() { return '```json\n' + JSON.stringify(PLAN, null, 1) + '\n```'; }
export function designAnswer() { return '```css\n' + CSS + '\n```\n\n```html\n' + SHELL + '\n```'; }
export function sectionsAnswer(ids, { broken = false, badRef = false } = {}) {
  const body = ids.map((id) => {
    let h = SECTIONS[id] || `<section id="${id}" data-title="${id}"><div class="wrap"><h2>${id}</h2><p>교재 내용이에요.</p></div></section>`;
    if (badRef && id === 'concepts') h = h.replace('material/p-003.webp', 'material/p-099.webp');
    return h;
  }).join('\n\n');
  if (broken) {
    // 앞뒤 설명 + 닫는 태그 빠짐 + 코드 블록 안 닫음
    return `네, 요청하신 섹션을 만들었어요! 아래를 확인해 주세요.\n\n\`\`\`html\n${body.replace(/<\/div>\n<\/section>$/, '').replace('</article>', '')}\n\n이 HTML은 디자인 단계의 클래스를 그대로 썼어요.`;
  }
  return '```html\n' + body + '\n```\n\n```css\n#practice .step h3 { color: var(--lp-accent); }\n```';
}
/** 한 번에 만들기(build): 사이트 전체를 파일마다 코드 블록(여는 줄에 경로) + 끝의 연수 정보. broken: 앞뒤 설명 + 마지막 블록 안 닫음 */
export function buildAnswer({ broken = false } = {}) {
  const html = SHELL.replace('<!-- lp:sections -->', () => Object.values(SECTIONS).join('\n\n'));
  const meta = { title: PLAN.title, subtitle: PLAN.subtitle, sessions: PLAN.sessions, venue: PLAN.venue, instructors: PLAN.instructors, facts: PLAN.facts };
  const out = '```index.html\n' + html + '\n```\n\n```assets/style.css\n' + CSS + '\n#practice .step h3 { color: var(--lp-accent); }\n```\n\n```lecpage.json\n' + JSON.stringify(meta, null, 1) + '\n```';
  return broken ? `사이트를 만들었어요.\n\n${out.slice(0, out.lastIndexOf('```'))}` : out;
}
export function fixAnswer(ids) { return '```html\n' + ids.map((id) => SECTIONS[id] || '').join('\n\n') + '\n```'; }
export function editAnswer() {
  return '```html\n' + SECTIONS.hero.replace('제미나이와 클로드로 30분 만에', '제미나이로 20분 만에') + '\n```\n```css\n:root { --lp-accent: #2a5f8f; }\n```\n```json\n{"subtitle":"제미나이로 20분 만에 학습지 완성"}\n```';
}
/** 쓰던 AI 창 답: 한 파일 index.html(인라인 style) + lecpage.json */
export function chatAnswer() {
  const html = SHELL.replace('<link rel="stylesheet" href="assets/style.css">', `<style>\n${CSS}\n</style>`).replace('<!-- lp:sections -->', Object.values(SECTIONS).join('\n\n').replace(/<figure class="figure">[\s\S]*?<\/figure>/g, ''));
  return `사이트를 만들었어요.\n\n\`\`\`html\n${html}\n\`\`\`\n\n\`\`\`json\n${JSON.stringify({ v: 2, title: PLAN.title, subtitle: PLAN.subtitle, sessions: PLAN.sessions, venue: PLAN.venue, mode: 'offline', audience: 'teachers', instructors: PLAN.instructors, features: PLAN.features, theme: PLAN.theme, facts: PLAN.facts, siteUrl: 'https://evil.example' })}\n\`\`\``;
}
