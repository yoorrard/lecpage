// ⑤ 글꼴·타이포그래피. 글꼴 짝은 데이터로 만들고(실제 그 글꼴로 그림), 기법은 손으로 만든 미리보기
const PD = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';
const PL = 'https://cdn.jsdelivr.net/gh/ayaan-fonts/Paperlogy@1.001-ko/fonts/webfonts/Paperlogy-dynamic-subset.css';

// [id, 이름, 결, 제목 글꼴(구글 이름|CSS 이름), 제목 굵기, 본문 글꼴, 본문 굵기, 숫자·영문 글꼴, 바탕, 글자, 강조, 제목 예, 어울릴 때, 태그]
const PAIRS = [
  ['pair-editorial', '편집 명조 짝', '편집·잡지', 'Noto Serif KR', 900, 'IBM Plex Sans KR', 400, 'Fraunces', '#f3eee4', '#1d1a16', '#b5432b', '질문이 수업을 바꾼다', '읽는 맛이 중요한 인문·성찰 강의의 제목과 본문.', ['명조', '편집', '세리프']],
  ['pair-letter', '편지 짝', '편지·성찰', 'Gowun Batang', 700, 'Gowun Dodum', 400, 'Instrument Serif', '#fbf6ee', '#3a2f28', '#c46a4a', '마음을 여는 첫 문장', '상담·학부모·성찰처럼 따뜻하고 조용한 강의.', ['바탕', '돋움', '따뜻함']],
  ['pair-poster', '포스터 짝', '포스터·행사', 'Black Han Sans', 400, 'Gothic A1', 400, 'Anton', '#111111', '#f5f5f0', '#ffd400', '말하기 특강', '특강·행사·캠페인의 큰 제목.', ['굵은 제목', '포스터', '고딕']],
  ['pair-heavy', '두꺼운 표지 짝', '표지·발표', 'Gasoek One', 400, 'Gothic A1', 400, 'Bricolage Grotesque', '#e9f0ff', '#101a33', '#2f5bff', '데이터로 말해요', '발표 화면 표지처럼 한 낱말을 크게 세울 때.', ['두꺼운', '표지', '그로테스크']],
  ['pair-tech', '기술 짝', '기술·도면', 'IBM Plex Sans KR', 700, 'IBM Plex Sans KR', 400, 'IBM Plex Mono', '#0f1720', '#e6edf3', '#58a6ff', '코드로 그리는 그림', '코딩·데이터·공학 실습, 명령어가 나오는 안내.', ['고정폭', '기술', '코딩']],
  ['pair-note', '공책 손글씨 짝', '공책·손그림', 'Gaegu', 700, 'Gowun Dodum', 400, 'Caveat', '#fffdf3', '#24365c', '#e5484d', '오늘 꼭 할 것', '교사 실습·초등·성찰. 손글씨는 짧은 메모에만.', ['손글씨', '메모', '친근']],
  ['pair-brush', '붓글씨 짝', '전통·서예', 'Nanum Brush Script', 400, 'Nanum Myeongjo', 400, 'Fraunces', '#f1ebdd', '#1a1714', '#a82c1e', '배움의 길', '역사·전통문화·인문 강의의 표지 한 줄.', ['붓글씨', '전통', '명조']],
  ['pair-round', '둥근 친근 짝', '친근·초등', 'Jua', 400, 'Gowun Dodum', 400, 'Bricolage Grotesque', '#fff1e0', '#3b2516', '#ff7a45', '함께 만드는 교실', '초등·학부모·가족 행사처럼 말랑한 분위기.', ['둥근', '귀여움', '친근']],
  ['pair-future', '미래 짝', '미래·AI', 'Orbit', 400, 'Noto Sans KR', 400, 'Space Grotesk', '#0b0f1f', '#e8ecff', '#7c8cff', 'AI와 일하는 법', '디지털·AI·미래 주제의 첫 화면.', ['미래', '기하학', 'AI']],
  ['pair-classic', '고전 인문 짝', '고전·인문', 'Song Myung', 400, 'Nanum Myeongjo', 400, 'Fraunces', '#f7f2e8', '#2b2118', '#7b3f2a', '고전을 다시 읽다', '고전 읽기·철학·역사처럼 깊이 있는 강의.', ['명조', '고전', '인문']],
  ['pair-hahmlet', '함렛 굵기 대비', '현대 명조', 'Hahmlet', 800, 'Hahmlet', 300, 'Fraunces', '#eef1ec', '#16231a', '#2f7a4b', '가는 선과 굵은 선', '한 가족 글꼴의 굵기 대비만으로 위계를 만들 때.', ['가변', '명조', '굵기 대비']],
  ['pair-diphylleia', '꽃잎 명조 짝', '섬세·예술', 'Diphylleia', 400, 'Gowun Dodum', 400, 'Instrument Serif', '#fdf3f5', '#3d2330', '#c2416b', '그림책 한 장의 마음', '그림책·예술·감성 수업의 제목.', ['섬세', '예술', '감성']],
  ['pair-pretendard', '프리텐다드 한 벌', '작업 도구·정보', 'Pretendard Variable', 800, 'Pretendard Variable', 400, 'Bricolage Grotesque', '#f6f6f4', '#17171a', '#ff5a1f', '오늘의 흐름', '정보가 많은 안내·자료실처럼 또렷함이 먼저일 때.', ['고딕', '본문', '가독성'], [PD]],
  ['pair-paperlogy', '페이퍼로지 무대 짝', '무대·특강', 'Paperlogy', 800, 'Pretendard Variable', 400, 'Bricolage Grotesque', '#101010', '#f4f4f0', '#c6ff3d', '리더의 세 가지 질문', '리더십·기술 특강처럼 무대 위 큰 제목.', ['무대', '특강', '굵은 제목'], [PL, PD]],
];
const ONE = ['Instrument Serif', 'Anton']; // 굵기가 하나뿐인 숫자·영문 글꼴
/** 구글 폰트 요청(같은 글꼴은 굵기를 모아 한 번에). jsDelivr 글꼴(Pretendard·Paperlogy)은 links로 */
function famsOf(list) {
  const m = new Map();
  for (const [n, w] of list) if (!/^(Pretendard|Paperlogy)/.test(n)) m.set(n, new Set([...(m.get(n) || []), w]));
  return [...m].map(([n, ws]) => `${n}:wght@${[...ws].sort((a, b) => a - b).join(';')}`);
}

const pair = ([id, ko, mood, dn, dw, bn, bw, ln, bg, ink, acc, title, fit, tags, links]) => { const lw = ONE.includes(ln) ? 400 : 600; return {
  id, ko, en: `${dn} + ${bn}`,
  desc: `${mood} 결에 맞는 제목·본문·숫자 글꼴 짝. 모두 무료 웹 글꼴이에요.`,
  fit,
  tech: `제목 ${dn} ${dw} · 본문 ${bn} ${bw} · 숫자·영문 ${ln} (word-break:keep-all, 제목 text-wrap:balance, 자간 -0.03em)`,
  tags: ['글꼴 짝', ...tags],
  f: famsOf([[dn, dw], [bn, bw], [ln, lw]]),
  links,
  css: `body{background:${bg};color:${ink}}
.w{position:absolute;inset:6vmin 7vmin;display:grid;grid-template-rows:auto 1fr auto auto;gap:2vmin}
.tp{display:flex;justify-content:space-between;align-items:baseline;font:${lw} 2.6vmin '${ln}',serif;border-bottom:1px solid currentColor;padding-bottom:1.4vmin}
.tp span:last-child{font:${bw} 2.4vmin '${bn}',sans-serif;opacity:.75}
h1{align-self:end;margin:0;font:${dw} 10.5vmin/1.08 '${dn}',serif;letter-spacing:-.035em;text-wrap:balance;animation:in .9s cubic-bezier(.2,.8,.2,1) both}
@keyframes in{from{opacity:0;transform:translateY(3vmin)}}
p{margin:0;font:${bw} 3vmin/1.7 '${bn}',sans-serif;max-width:52ch}
.ft{display:flex;justify-content:space-between;align-items:end;gap:3vmin}
.n{font:${lw} 9vmin/1 '${ln}',serif;color:${acc};letter-spacing:-.02em}
.nm{font:${bw} 2.1vmin/1.5 '${bn}',sans-serif;opacity:.7;text-align:right}`,
  html: `<div class="w"><div class="tp"><span>No. 03 — Session</span><span>${mood}</span></div><h1>${title}</h1><p>오늘 강의에서는 직접 해 보고, 서로 묻고, 한 장으로 정리해요. 본문은 읽기 편한 크기와 줄 간격으로.</p><div class="ft"><span class="n">14:00</span><span class="nm">제목 ${dn}<br>본문 ${bn}<br>숫자 ${ln}</span></div></div>`,
}; };

export default [
  ...PAIRS.map(pair),
  {
    id: 'type-scale', ko: '타입 스케일', en: 'Modular Type Scale',
    desc: '글자 크기를 일정한 비율(예: 1.25배)로 키워 제목·소제목·본문의 위계를 만들어요.',
    fit: '사이트 전체 글자 크기를 처음에 정할 때. 크기 단계가 적을수록 단단해 보여요.',
    tech: ':root{--s0:1rem; --s1:calc(var(--s0)*1.25); …} 또는 clamp()로 화면 폭에 따라 비율 유지',
    tags: ['위계', '비율', 'clamp()', '크기'],
    f: ['Noto Sans KR:wght@400;700'],
    css: `body{background:#fff;color:#151515;font-family:'Noto Sans KR',sans-serif}
.w{position:absolute;inset:4vmin 6vmin;display:grid;align-content:center;gap:.6vmin}
.r{display:grid;grid-template-columns:14vmin 1fr;align-items:baseline;gap:2vmin;border-bottom:1px solid #eee;padding:.6vmin 0;white-space:nowrap;overflow:hidden;animation:in .6s both;animation-delay:calc(var(--i)*80ms)}
.r code{font:1.9vmin ui-monospace,monospace;color:#999}
@keyframes in{from{opacity:0;transform:translateX(-3vmin)}}`,
    html: `<div class="w"><div class="r" style="--i:0"><code>× 1.25⁵</code><b style="font-size:9.2vmin;line-height:1.1">오늘의 강의</b></div><div class="r" style="--i:1"><code>× 1.25⁴</code><b style="font-size:7.3vmin">실습 안내</b></div><div class="r" style="--i:2"><code>× 1.25³</code><b style="font-size:5.9vmin">1단계 · 교재 열기</b></div><div class="r" style="--i:3"><code>× 1.25²</code><b style="font-size:4.7vmin">준비물 확인</b></div><div class="r" style="--i:4"><code>× 1.25</code><span style="font-size:3.75vmin">본문보다 조금 큰 글</span></div><div class="r" style="--i:5"><code>1</code><span style="font-size:3vmin">본문: 읽기 편한 기본 크기</span></div><div class="r" style="--i:6"><code>÷ 1.25</code><span style="font-size:2.4vmin;color:#777">작은 설명</span></div></div>`,
  },
  {
    id: 'variable-font', ko: '가변 글꼴', en: 'Variable Fonts',
    desc: '글꼴 파일 하나로 굵기를 가늘게부터 아주 굵게까지 부드럽게 바꿔요.',
    fit: '제목이 숨 쉬듯 굵어지는 첫 장면, 강조 정도를 섬세하게 조절할 때.',
    tech: "font-weight 100~900 연속 값(구글 폰트 family=Noto+Sans+KR:wght@100..900) + font-weight 애니메이션",
    tags: ['가변', 'wght', '굵기', '애니메이션'],
    f: ['Noto Sans KR:wght@100..900'],
    css: `body{background:#f0ede6;color:#1a1a1a;font-family:'Noto Sans KR',sans-serif}
.w{position:absolute;inset:0;display:grid;place-content:center;text-align:center;gap:3vmin}
.t{font-size:15vmin;line-height:1;letter-spacing:-.04em;animation:wg 3s ease-in-out infinite alternate}
.t span{display:inline-block;animation:wg 1.8s ease-in-out infinite alternate;animation-delay:calc(var(--i)*-.25s)}
@keyframes wg{from{font-weight:100}to{font-weight:900}}
.sl{display:flex;justify-content:space-between;width:60vmin;margin:0 auto;font-size:2.4vmin;color:#888}
.sl i{flex:1;margin:0 2vmin;align-self:center;height:.4vmin;background:linear-gradient(90deg,#ccc,#1a1a1a)}`,
    html: `<div class="w"><div class="t"><span style="--i:0">가</span><span style="--i:1">볍</span><span style="--i:2">게</span><span style="--i:3">·</span><span style="--i:4">굵</span><span style="--i:5">게</span></div><div class="sl"><span>100</span><i></i><span>900</span></div></div>`,
  },
  {
    id: 'text-wrap', ko: '한국어 줄바꿈 다듬기', en: 'keep-all & text-wrap: balance',
    desc: '낱말 중간에서 끊기지 않게, 제목 줄 길이는 고르게. 한국어 글을 단정하게 만드는 두 줄.',
    fit: '모든 강의 사이트의 기본. 특히 휴대폰의 좁은 화면 제목.',
    tech: 'word-break:keep-all; overflow-wrap:break-word + 제목 text-wrap:balance, 본문 text-wrap:pretty',
    tags: ['keep-all', 'balance', '줄바꿈', '기본기'],
    f: ['Noto Sans KR:wght@700'],
    css: `body{background:#fff;color:#1a1a1a;font-family:'Noto Sans KR',sans-serif}
.w{position:absolute;inset:5vmin;display:grid;grid-template-columns:1fr 1fr;gap:4vmin}
.c2{display:grid;align-content:start;gap:1.6vmin}
small{font:2.2vmin ui-monospace,monospace;color:#999}
.box{width:100%;border:1px dashed #ccc;padding:2vmin;animation:w 4s ease-in-out infinite alternate}
@keyframes w{from{width:100%}to{width:72%}}
h3{margin:0;font:700 4.8vmin/1.3 'Noto Sans KR',sans-serif;letter-spacing:-.02em}
.bad h3{word-break:break-all;text-wrap:wrap}.good h3{word-break:keep-all;text-wrap:balance}
.bad small{color:#d92d20}.good small{color:#16a34a}`,
    html: `<div class="w"><div class="c2 bad"><small>✕ break-all</small><div class="box"><h3>생성형 인공지능으로 수업 설계안 만들기</h3></div></div><div class="c2 good"><small>✓ keep-all + balance</small><div class="box"><h3>생성형 인공지능으로 수업 설계안 만들기</h3></div></div></div>`,
  },
  {
    id: 'vertical-writing', ko: '세로쓰기', en: 'Vertical Writing Mode',
    desc: '한국어를 위에서 아래로 쓰는 세로 조판. 숫자는 가로로 세워 묶어요.',
    fit: '전통·역사·시 감상 강의의 표지, 장 제목을 옆으로 세우는 편집 디자인.',
    tech: 'writing-mode:vertical-rl + text-orientation:upright + 두 자리 숫자 text-combine-upright:all',
    tags: ['세로쓰기', 'writing-mode', '전통', '편집'],
    f: ['Song Myung', 'Nanum Myeongjo'],
    css: `body{background:#f1eadb;color:#2a1f17}
.w{position:absolute;inset:6vmin 8vmin;display:flex;flex-direction:row-reverse;gap:5vmin;justify-content:flex-start}
.v{writing-mode:vertical-rl;text-orientation:upright}
h2{margin:0;font:11vmin/1.1 'Song Myung',serif;letter-spacing:.06em}
p{margin:0;font:3.2vmin/2 'Nanum Myeongjo',serif;max-height:100%}
.n{text-combine-upright:all}
.st{width:6vmin;height:6vmin;align-self:flex-end;background:#b23a2b;color:#fff;display:grid;place-items:center;font:2.6vmin 'Song Myung',serif;border-radius:.6vmin;transform:rotate(-3deg)}
.ln{width:1px;background:#2a1f17;opacity:.3;transform-origin:top;animation:dr 1.6s both}@keyframes dr{from{transform:scaleY(0)}}`,
    html: `<div class="w"><h2 class="v">시를 읽는 밤</h2><div class="ln"></div><p class="v">제<span class="n">12</span>회 인문 강좌<br>천천히 한 줄씩 소리 내어 읽고<br>떠오른 낱말 하나를 적어요</p><div class="st">印</div></div>`,
  },
  {
    id: 'initial-letter', ko: '첫 글자 크게', en: 'Drop Cap / initial-letter',
    desc: '문단 첫 글자를 여러 줄 높이로 크게 앉혀 글의 시작을 알리는 편집 기법.',
    fit: '읽을거리·사례 소개처럼 긴 글의 첫 문단 하나에만.',
    tech: 'p::first-letter{initial-letter:3} (지원 안 하면 float + font-size로 흉내)',
    tags: ['드롭캡', 'initial-letter', '편집', '첫 문단'],
    f: ['Noto Serif KR:wght@400;900'],
    css: `body{background:#fbf8f2;color:#2a2420}
.w{position:absolute;inset:0;display:grid;place-content:center;padding:0 9vmin}
p{margin:0;font:3.3vmin/1.75 'Noto Serif KR',serif}
p::first-letter{float:left;font-weight:900;font-size:13.4vmin;line-height:.84;margin:.8vmin 1.6vmin 0 0;color:#a3341f}
@supports (initial-letter:3){p::first-letter{float:none;initial-letter:3;font-size:inherit;line-height:inherit;margin:0 1.6vmin 0 0}}
small{display:block;margin-top:2vmin;font:2.2vmin ui-monospace,monospace;color:#999}`,
    html: `<div class="w"><p>배움은 질문에서 시작해요. 아이들이 교실 문을 열고 들어올 때 이미 마음속에 품고 있는 궁금함을 꺼내 주는 것, 그것이 오늘 이야기할 수업의 첫걸음이에요.</p><small>initial-letter: 3</small></div>`,
  },
  {
    id: 'outline-text', ko: '윤곽 글자', en: 'Outline / Stroke Text',
    desc: '글자의 테두리만 그리고 속을 비워, 꽉 찬 글자와 대비를 만드는 기법.',
    fit: '포스터형 첫 화면에서 큰 낱말 두 개의 강약을 줄 때.',
    tech: '-webkit-text-stroke:2px currentColor; color:transparent + 채워지는 글자(background-clip:text 이동)',
    tags: ['윤곽선', 'text-stroke', '포스터', '대비'],
    f: ['Black Han Sans'],
    css: `body{background:#0e0e10;color:#f2f2ee;overflow:hidden}
.w{position:absolute;inset:0;display:grid;align-content:center;gap:0;padding-left:6vmin}
.t{font:20vmin/.95 'Black Han Sans',sans-serif;letter-spacing:-.02em;white-space:nowrap}
.o{color:transparent;-webkit-text-stroke:.5vmin #f2f2ee}
.f{background:linear-gradient(90deg,#ff5a3c 50%,transparent 50%) 100% 0/200% 100% no-repeat;-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-stroke:.5vmin #ff5a3c;animation:fill 3s cubic-bezier(.7,0,.3,1) infinite alternate}
@keyframes fill{to{background-position:0 0}}`,
    html: `<div class="w"><div class="t o">비우고</div><div class="t f">채우기</div><div class="t o">반복</div></div>`,
  },
  {
    id: 'tabular-nums', ko: '고정폭 숫자', en: 'Tabular Figures',
    desc: '숫자마다 너비를 같게 해서 시간이 바뀌어도 글자가 흔들리지 않게.',
    fit: '타이머·시간표·점수처럼 숫자가 바뀌거나 세로로 맞춰야 하는 곳.',
    tech: 'font-variant-numeric:tabular-nums (비교: 기본 proportional-nums는 1이 좁아 흔들림)',
    tags: ['숫자', '타이머', '정렬', 'font-variant'],
    f: ['Bricolage Grotesque:wght@700'],
    css: `body{background:#fff;color:#111;font-family:'Bricolage Grotesque',system-ui,sans-serif}
.w{position:absolute;inset:0;display:grid;place-content:center;gap:2vmin}
.r{display:grid;grid-template-columns:24vmin auto;align-items:center;gap:3vmin}
.r small{font:2.3vmin system-ui;color:#888}
.n{font:700 13vmin/1 'Bricolage Grotesque',sans-serif;letter-spacing:-.02em;position:relative}
.n::after{content:"";position:absolute;right:0;top:0;bottom:0;border-right:2px solid #ff5a3c}
.p{font-variant-numeric:proportional-nums}.t{font-variant-numeric:tabular-nums}`,
    html: `<div class="w"><div class="r"><small>✕ proportional</small><span class="n p">11:11</span></div><div class="r"><small>✓ tabular-nums</small><span class="n t">11:11</span></div></div>`,
    js: `var ns=document.querySelectorAll('.n'),t=671;function s(){var v=String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');ns.forEach(function(n){n.textContent=v})}s();if(!RM)setInterval(function(){t=t>600?t-1:671;s()},220);`,
  },
  {
    id: 'clip-text', ko: '그림 채운 글자', en: 'Background-clip: text',
    desc: '글자 모양대로 그림·그라데이션이 비쳐 보이게 오려 내는 기법.',
    fit: '제목 한 곳에만. 여러 곳에 쓰면 AI가 만든 티가 나요.',
    tech: 'background:(그라데이션·무늬); -webkit-background-clip:text; color:transparent + background-position 이동',
    tags: ['background-clip', '제목', '그라데이션', '한 곳만'],
    f: ['Black Han Sans'],
    css: `body{background:#fdfaf3}
.w{position:absolute;inset:0;display:grid;place-content:center;text-align:center}
.t{font:21vmin/1 'Black Han Sans',sans-serif;letter-spacing:-.02em;background:repeating-linear-gradient(-45deg,#ff6b35 0 2vmin,#f7c548 2vmin 4vmin,#2ec4b6 4vmin 6vmin,#3d5a80 6vmin 8vmin);background-size:200% 200%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:mv 6s linear infinite}
@keyframes mv{to{background-position:100% 100%}}
p{margin:1vmin 0 0;font:2.6vmin system-ui;color:#888}`,
    html: `<div class="w"><div class="t">여름 캠프</div><p>글자 속으로 흐르는 무늬</p></div>`,
  },
];
