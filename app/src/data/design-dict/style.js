// ① 스타일(아트 디렉션). 미리보기는 400×300 안팎에서 잘 보이게 vmin 단위로, 크게 보기에서도 같은 비율로 커짐
import { GRAIN, grainCss } from './parts.js';

export default [
  {
    id: 'editorial', ko: '편집·잡지', en: 'Editorial',
    desc: '큰 명조 제목과 비대칭 단, 가는 선으로 장을 나누는 잡지 같은 스타일.',
    fit: '인문·독서·성찰 연수처럼 읽는 맛이 중요한 강의의 첫 화면.',
    tech: '큰 명조 제목 + 비대칭 2단 grid + 굵은 선/가는 선 + ::first-letter 드롭캡',
    tags: ['명조', '비대칭', '드롭캡', '여백'],
    f: ['Noto Serif KR:wght@400;900'],
    css: `body{background:#f3efe6;color:#1b1914}
.w{position:absolute;inset:0;padding:6vmin 7vmin;display:grid;grid-template-columns:1.15fr 1fr;grid-template-rows:auto 1fr auto;column-gap:5vmin}
.top{grid-column:1/-1;display:flex;justify-content:space-between;font:700 2.4vmin/1 system-ui;letter-spacing:.22em;padding-bottom:1.6vmin;border-bottom:.6vmin solid}
h1{font:900 13.5vmin/.95 'Noto Serif KR',serif;letter-spacing:-.05em;margin:0;align-self:end;overflow:hidden}
h1 span{display:block;animation:up 1s cubic-bezier(.2,.8,.2,1) both}h1 span+span{animation-delay:.12s}
@keyframes up{from{transform:translateY(105%)}}
.col{align-self:end;margin:0;font:400 3vmin/1.7 'Noto Serif KR',serif;border-top:1px solid;padding-top:2vmin}
.col::first-letter{float:left;font-weight:900;font-size:9.4vmin;line-height:.82;margin:.4vmin 1.2vmin 0 0}
.foot{grid-column:1/-1;display:flex;gap:4vmin;font:600 2.3vmin/1 system-ui;border-top:1px solid;margin-top:3vmin;padding-top:1.6vmin}
.foot b{font-family:'Noto Serif KR',serif}`,
    html: `<div class="w"><div class="top"><span>VOL. 12</span><span>연수 읽기</span><span>가을호</span></div><h1><span>질문이</span><span>수업을 바꾼다</span></h1><p class="col">좋은 질문 하나가 한 시간의 흐름을 정해요. 오늘은 질문을 고르고 다듬고 나누는 연습을 해요.</p><div class="foot"><span><b>01</b> 고르기</span><span><b>02</b> 다듬기</span><span><b>03</b> 나누기</span></div></div>`,
  },
  {
    id: 'swiss', ko: '스위스 격자', en: 'Swiss Style / International Typographic Style',
    desc: '보이지 않는 격자 위에 왼쪽 정렬, 아주 큰 숫자, 강조색 하나.',
    fit: '행정·정책·데이터 안내처럼 정보가 많은 강의를 단단하게 정리할 때.',
    tech: '6~12칸 grid + 왼쪽 정렬 굵은 그로테스크 + 거대한 숫자 + 빨강 하나',
    tags: ['격자', '그로테스크', '숫자', '빨강'],
    f: ['IBM Plex Sans KR:wght@400;700'],
    css: `body{background:#f1f0ec;color:#111;font-family:'IBM Plex Sans KR',sans-serif}
.g{position:absolute;inset:5vmin;display:grid;grid-template-columns:repeat(6,1fr);grid-template-rows:repeat(6,1fr)}
.lines{position:absolute;inset:5vmin;background:repeating-linear-gradient(90deg,rgba(0,0,0,.09) 0 1px,transparent 1px calc(100%/6));animation:fade 1.2s both}
.n{grid-column:1/5;grid-row:1/6;font:700 52vmin/.78 'IBM Plex Sans KR';letter-spacing:-.08em;margin-left:-1.6vmin}
.r{grid-column:5/7;grid-row:1/3;background:#e3261b;transform-origin:left top;animation:grow .9s .2s cubic-bezier(.7,0,.2,1) both}
.t{grid-column:4/7;grid-row:4/7;align-self:end;font-size:2.8vmin;line-height:1.45}
.t b{display:block;font-size:4.6vmin;line-height:1.15;margin-bottom:1vmin}
.k{grid-column:1/3;grid-row:6;align-self:end;font-size:2.2vmin;letter-spacing:.12em}
@keyframes grow{from{transform:scale(0,1)}}@keyframes fade{from{opacity:0}}`,
    html: `<div class="lines"></div><div class="g"><div class="n">3</div><div class="r"></div><div class="t"><b>데이터로 읽는 학교 행정</b>세 번째 시간 · 표에서 이야기 찾기</div><div class="k">14:00 — 15:30</div></div>`,
  },
  {
    id: 'brutalism', ko: '브루탈리즘', en: 'Brutalism',
    desc: '꾸밈을 걷어 낸 날것의 HTML: 기본 글꼴, 파란 밑줄 링크, 굵은 테두리.',
    fit: '해커톤·메이커·코딩 캠프처럼 거칠고 솔직한 분위기가 어울리는 행사.',
    tech: '시스템 고정폭 글꼴 + 기본 파란 링크 + 2~4px 검은 테두리 + 회색 버튼',
    tags: ['날것', '고정폭', '테두리', '반디자인'],
    css: `body{background:#fff;color:#000;font-family:'Times New Roman',serif}
.w{padding:4vmin 5vmin;font-size:3.3vmin}
h1{font:700 9vmin/1 'Courier New',monospace;margin:0 0 2vmin;border-bottom:.8vmin solid #000;padding-bottom:1vmin}
h1 i{display:inline-block;width:.55em;height:.9em;background:#000;vertical-align:-.1em;animation:bl 1s steps(1) infinite}
@keyframes bl{50%{opacity:0}}
a{color:#00e;text-decoration:underline}a:visited{color:#551a8b}
table{border-collapse:collapse;width:100%;font:3vmin 'Courier New',monospace;margin:2vmin 0}
td{border:.5vmin solid #000;padding:1vmin 1.4vmin}
.now{background:#ff0;font-weight:700}
.b{border:.5vmin solid #000;background:#c0c0c0;padding:.6vmin 2.4vmin;border-radius:0;font:700 3vmin 'Courier New',monospace;box-shadow:inset -.5vmin -.5vmin #808080,inset .5vmin .5vmin #fff;margin-right:1.4vmin}`,
    html: `<div class="w"><h1>강의_자료실<i></i></h1><p>모든 파일은 여기. <a href="#">교재.pdf</a> / <a href="#">실습1.zip</a> / <a href="#">설문</a></p><table><tr><td>09:00</td><td>여는 말</td><td class="now">지금</td></tr><tr><td>09:20</td><td>실습 1</td><td>-</td></tr><tr><td>10:10</td><td>질문</td><td>-</td></tr></table><button class="b">출석</button><button class="b">질문</button></div>`,
  },
  {
    id: 'neo-brutalism', ko: '네오 브루탈리즘', en: 'Neo-brutalism',
    desc: '굵은 검은 테두리, 딱 떨어지는 그림자, 쨍한 단색. 누르면 그림자가 사라져요.',
    fit: '청소년·신입 연수처럼 활기차고 손에 잡히는 버튼이 필요한 참여형 강의.',
    tech: 'border:3px solid #111 + box-shadow:6px 6px 0 #111(흐림 0) + 누를 때 translate로 그림자만큼 이동',
    tags: ['굵은 테두리', '단색', '평면 그림자', '버튼'],
    f: ['Gothic A1:wght@600;900'],
    css: `body{background:#fff4d6;font-family:'Gothic A1',sans-serif}
.card{width:min(84%,560px);background:#fff;border:.8vmin solid #111;border-radius:3.4vmin;box-shadow:2vmin 2vmin 0 #111;padding:4.4vmin 5vmin;transform:rotate(-1.6deg)}
.tag{display:inline-block;background:#ff6bcb;border:.6vmin solid #111;border-radius:99px;padding:.4vmin 2.4vmin;font:900 2.8vmin 'Gothic A1'}
h2{font:900 7.2vmin/1.08 'Gothic A1';margin:2vmin 0 3.2vmin;letter-spacing:-.04em}
.row{display:flex;gap:2.6vmin}
.btn{background:#7ae582;border:.6vmin solid #111;border-radius:2.4vmin;padding:1.6vmin 3.6vmin;font:900 3.4vmin 'Gothic A1';box-shadow:1.2vmin 1.2vmin 0 #111;cursor:pointer;transition:transform .12s,box-shadow .12s}
.btn.b{background:#5ab0ff}
.btn:active,.btn.press{transform:translate(1.2vmin,1.2vmin);box-shadow:0 0 0 #111}`,
    html: `<div class="ctr"><div class="card"><span class="tag">실습 2</span><h2>프롬프트를 세 번 고쳐 써 봐요</h2><div class="row"><button class="btn">시작</button><button class="btn b">예시 보기</button></div></div></div>`,
    js: `var bs=document.querySelectorAll('.btn'),k=0;if(!RM)setInterval(function(){var b=bs[k++%2];b.classList.add('press');setTimeout(function(){b.classList.remove('press')},220)},1300);`,
  },
  {
    id: 'glassmorphism', ko: '글래스모피즘', en: 'Glassmorphism',
    desc: '흐린 유리판 너머로 뒤의 색이 은은하게 비치는 스타일.',
    fit: '어두운 바탕의 디지털·미래 주제 강의에서 지금 순서 같은 떠 있는 정보 한 곳.',
    tech: 'background:rgb(255 255 255/.12) + backdrop-filter:blur(18px) saturate(1.5) + 1px 밝은 테두리',
    tags: ['유리', 'backdrop-filter', '블러', '어두운 바탕'],
    css: `body{background:#0d1020;color:#fff}
.bg{position:absolute;inset:-10%;filter:blur(4vmin)}
.bg i{position:absolute;border-radius:50%;animation:fl 8s ease-in-out infinite alternate}
.bg i:nth-child(1){width:46vmin;height:46vmin;left:10%;top:16%;background:#ff5f8f}
.bg i:nth-child(2){width:40vmin;height:40vmin;right:12%;top:26%;background:#3dd9c5;animation-delay:-3s}
.bg i:nth-child(3){width:34vmin;height:34vmin;left:42%;bottom:6%;background:#ffb547;animation-delay:-5s}
@keyframes fl{to{transform:translate(9vmin,-7vmin) scale(1.15)}}
.glass{position:relative;width:min(80%,540px);padding:5vmin;border-radius:5vmin;background:rgba(255,255,255,.12);-webkit-backdrop-filter:blur(18px) saturate(1.5);backdrop-filter:blur(18px) saturate(1.5);border:1px solid rgba(255,255,255,.3);box-shadow:0 3vmin 6vmin rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.45)}
small{opacity:.75;letter-spacing:.14em;font-size:2.4vmin}
b{display:block;font-size:6.2vmin;line-height:1.15;margin:1.4vmin 0 3vmin;letter-spacing:-.02em}
.bar{height:1.6vmin;border-radius:9px;background:rgba(255,255,255,.18);overflow:hidden}.bar i{display:block;height:100%;width:62%;background:#fff;border-radius:inherit}
.meta{display:flex;justify-content:space-between;font-size:2.6vmin;margin-top:1.4vmin;opacity:.85}`,
    html: `<div class="bg"><i></i><i></i><i></i></div><div class="ctr"><div class="glass"><small>지금 하는 중</small><b>실습 2 · 프롬프트 다듬기</b><div class="bar"><i></i></div><div class="meta"><span>14:10 시작</span><span>12분 남음</span></div></div></div>`,
  },
  {
    id: 'liquid-glass', ko: '리퀴드 글래스', en: 'Liquid Glass',
    desc: '물방울처럼 두툼한 유리가 가장자리에서 빛을 받아 반짝이며 떠다니는 스타일.',
    fit: '떠 있는 메뉴·지금 보기 버튼처럼 콘텐츠 위에 얹히는 작은 조작부.',
    tech: 'backdrop-filter:blur(2px) saturate(1.9) + inset 하이라이트/그늘 box-shadow 여러 겹 + 알약 모양',
    tags: ['유리', '반사광', '떠 있는 버튼', '2025'],
    ptr: true,
    css: `body{background:#ebe7df}
.bg{position:absolute;inset:0;display:grid;align-content:center;gap:.6vmin;font:900 13vmin/1 system-ui;letter-spacing:-.05em;color:#1a1a1a;overflow:hidden}
.bg span{white-space:nowrap}.bg span:nth-child(2){color:#ff4d2e;margin-left:-8vmin}.bg span:nth-child(3){-webkit-text-stroke:.4vmin #1a1a1a;color:transparent}
.lens{position:absolute;left:50%;top:50%;width:46vmin;height:22vmin;border-radius:99px;transform:translate(-50%,-50%);-webkit-backdrop-filter:blur(2px) saturate(1.9) brightness(1.1) contrast(1.15);backdrop-filter:blur(2px) saturate(1.9) brightness(1.1) contrast(1.15);background:linear-gradient(135deg,rgba(255,255,255,.4),rgba(255,255,255,.04) 60%);box-shadow:inset .5vmin .5vmin .3vmin rgba(255,255,255,.95),inset -.5vmin -.7vmin .6vmin rgba(0,0,0,.14),inset 0 0 4vmin rgba(255,255,255,.4),0 2.4vmin 5vmin rgba(0,0,0,.2);display:grid;place-items:center;font:700 3.4vmin system-ui;color:#111}`,
    html: `<div class="bg"><span>오늘의 강의 오늘의 강의</span><span>질문 · 투표 · 나눔 · 질문</span><span>LECTURE LECTURE</span></div><div class="lens">지금 보기</div>`,
    js: `var l=document.querySelector('.lens');ghost(document.body,function(x,y){l.style.left=(15+x*70)+'%';l.style.top=(18+y*64)+'%'});`,
  },
  {
    id: 'neumorphism', ko: '뉴모피즘', en: 'Neumorphism / Soft UI',
    desc: '바탕과 같은 색의 판이 밝은 그림자와 어두운 그림자로 볼록·오목하게 솟은 스타일.',
    fit: '타이머·스위치처럼 조작부가 몇 개뿐인 차분한 도구 화면. 글이 많은 곳에는 대비가 약해요.',
    tech: '같은 바탕색 + box-shadow 두 겹(오른쪽 아래 어둡게, 왼쪽 위 밝게), 눌린 상태는 inset',
    tags: ['소프트 UI', '그림자', '스위치', '저대비'],
    css: `body{background:#e4e8ef;color:#4a5262}
.w{display:grid;gap:4.4vmin;justify-items:center}
.knob{width:36vmin;height:36vmin;border-radius:50%;background:#e4e8ef;box-shadow:2.6vmin 2.6vmin 5vmin #bfc4cd,-2.6vmin -2.6vmin 5vmin #fff;display:grid;place-items:center}
.in{width:25vmin;height:25vmin;border-radius:50%;box-shadow:inset 1.6vmin 1.6vmin 3vmin #bfc4cd,inset -1.6vmin -1.6vmin 3vmin #fff;display:grid;place-items:center;font:700 7vmin/1 system-ui;color:#5b6aa8;font-variant-numeric:tabular-nums}
.row{display:flex;align-items:center;gap:3vmin;font-size:2.8vmin}
.tg{width:20vmin;height:9vmin;border-radius:99px;background:#e4e8ef;box-shadow:inset 1vmin 1vmin 2vmin #bfc4cd,inset -1vmin -1vmin 2vmin #fff;position:relative;cursor:pointer;border:0}
.tg i{position:absolute;top:1.2vmin;left:1.2vmin;width:6.6vmin;height:6.6vmin;border-radius:50%;background:#e4e8ef;box-shadow:.8vmin .8vmin 1.6vmin #bfc4cd,-.8vmin -.8vmin 1.6vmin #fff;transition:left .4s cubic-bezier(.3,1.4,.5,1),background .3s}
.tg.on i{left:12.2vmin;background:#7d8ff0}`,
    html: `<div class="ctr"><div class="w"><div class="knob"><div class="in">12:00</div></div><div class="row"><button class="tg on" aria-label="알림 소리"><i></i></button><span>끝날 때 알림 소리</span></div></div></div>`,
    js: `var t=720,el=document.querySelector('.in'),tg=document.querySelector('.tg');tg.onclick=function(){tg.classList.toggle('on')};if(!RM){setInterval(function(){t=t>0?t-1:720;el.textContent=String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0')},1000);setInterval(function(){tg.classList.toggle('on')},2400)}`,
  },
  {
    id: 'claymorphism', ko: '클레이모피즘', en: 'Claymorphism',
    desc: '찰흙처럼 말랑하고 통통한 입체. 안쪽 빛과 그늘로 부푼 느낌을 내요.',
    fit: '초등·학부모 대상처럼 따뜻하고 친근한 강의의 참여 버튼·아이콘.',
    tech: '큰 border-radius + inset 밝은/어두운 box-shadow 두 겹 + 아래로 퍼지는 부드러운 그림자',
    tags: ['말랑', '입체', '파스텔', '친근'],
    f: ['Jua'],
    css: `body{background:#ffe8d4}
.w{display:flex;gap:4vmin;align-items:flex-end}
.cl{width:24vmin;height:24vmin;border-radius:7.4vmin;display:grid;place-items:center;font:5vmin 'Jua',sans-serif;color:#fff;text-shadow:0 .3vmin 0 rgba(0,0,0,.15);box-shadow:inset -1.6vmin -1.6vmin 2.6vmin rgba(0,0,0,.18),inset 1.6vmin 1.6vmin 2.6vmin rgba(255,255,255,.55),0 2.6vmin 3.4vmin rgba(170,90,40,.28);animation:bob 2.6s ease-in-out infinite}
.cl:nth-child(1){background:#ff8c69}.cl:nth-child(2){background:#74bdf7;height:30vmin;animation-delay:-.6s}.cl:nth-child(3){background:#8fd872;animation-delay:-1.2s}
@keyframes bob{50%{transform:translateY(-2.6vmin) scale(1.03,.97)}}`,
    html: `<div class="ctr"><div class="w"><div class="cl">질문</div><div class="cl">투표</div><div class="cl">나눔</div></div></div>`,
  },
  {
    id: 'bento', ko: '벤토 그리드', en: 'Bento Grid',
    desc: '도시락 칸처럼 크기가 다른 칸을 한 판에 꼭 맞게 짜 넣은 요약판.',
    fit: '강사 화면·첫 화면 요약처럼 출석·순서·투표·자료를 한눈에 보여 줄 때.',
    tech: 'grid-template-columns:repeat(4,1fr) + 칸마다 span 2 같은 다른 크기 + 둥근 모서리 + 칸마다 다른 바탕',
    tags: ['격자', '요약', '칸', '대시보드'],
    f: ['IBM Plex Sans KR:wght@400;700'],
    css: `body{background:#efece5;font-family:'IBM Plex Sans KR',sans-serif}
.b{position:absolute;inset:3.6vmin;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(3,1fr);gap:1.8vmin}
.b>div{border-radius:3vmin;padding:2.4vmin 2.6vmin;background:#fff;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;font-size:2.5vmin;animation:in .6s cubic-bezier(.2,.8,.2,1) both}
.b>div:nth-child(2){animation-delay:.06s}.b>div:nth-child(3){animation-delay:.12s}.b>div:nth-child(4){animation-delay:.18s}.b>div:nth-child(5){animation-delay:.24s}.b>div:nth-child(6){animation-delay:.3s}
@keyframes in{from{opacity:0;transform:scale(.94)}}
.a{grid-column:span 2;grid-row:span 2;background:#1d1b16!important;color:#f5f3ee}
.a b{font-size:6.2vmin;line-height:1.05;letter-spacing:-.03em}
.d{grid-column:span 2;background:#ffd84d!important}.e{background:#d4e6ff!important}
big{font:700 8vmin/1 'IBM Plex Sans KR';letter-spacing:-.04em}
small{opacity:.6}
.bar{display:flex;gap:.8vmin;height:3vmin}.bar i{background:#1d1b16;border-radius:.6vmin}
.ring{width:9vmin;height:9vmin;border-radius:50%;background:conic-gradient(#ff7a45 0 68%,rgba(255,255,255,.15) 0);-webkit-mask:radial-gradient(circle,transparent 55%,#000 56%);mask:radial-gradient(circle,transparent 55%,#000 56%)}`,
    html: `<div class="b"><div class="a"><small>오늘의 강의</small><b>AI와 함께<br>수업 설계</b><div class="ring"></div></div><div><small>출석</small><big>38</big></div><div class="e"><small>다음</small><b>15:00<br>실습 3</b></div><div class="d"><small>투표 · 가장 어려운 단계</small><div class="bar"><i style="flex:5"></i><i style="flex:3;opacity:.6"></i><i style="flex:2;opacity:.3"></i></div></div><div><small>질문</small><big>7</big></div><div><small>자료</small><b>3개</b></div></div>`,
  },
  {
    id: 'y2k', ko: 'Y2K', en: 'Y2K Aesthetic',
    desc: '크롬 글자, 반짝이 별, 무지개 홀로그램. 2000년 무렵 디지털의 들뜬 감성.',
    fit: '청소년 캠프·축제·디지털 문화 특강처럼 신나는 분위기의 첫 장면.',
    tech: 'background-clip:text 금속 그라데이션 + clip-path 별 반짝임 + 움직이는 무지개 그라데이션',
    tags: ['크롬', '홀로그램', '반짝이', '레트로'],
    f: ['Bagel Fat One'],
    css: `body{background:radial-gradient(circle at 30% 20%,#eef6ff,#cdd8ff 42%,#f6c8ff 85%)}
.t{font:17vmin/.92 'Bagel Fat One',system-ui;text-align:center;background:linear-gradient(180deg,#fff 0%,#c3cede 44%,#5d6b82 50%,#eef2f7 56%,#98a5ba 100%);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-stroke:.3vmin rgba(60,70,95,.45);filter:drop-shadow(0 .9vmin 0 #7b5cff)}
.s{position:absolute;width:6vmin;height:6vmin;background:#fff;clip-path:polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%);animation:tw 1.8s ease-in-out infinite;filter:drop-shadow(0 0 1vmin #fff)}
@keyframes tw{50%{transform:scale(.3) rotate(45deg);opacity:.4}}
.pill{display:inline-block;margin-top:3vmin;padding:1.4vmin 4vmin;border-radius:99px;background:linear-gradient(90deg,#ff9de2,#a0e9ff,#c8ffb0,#ffe28a,#ff9de2);background-size:200% 100%;animation:holo 4s linear infinite;font:700 3vmin system-ui;border:.4vmin solid #fff;box-shadow:0 0 0 .4vmin #7b5cff}
@keyframes holo{to{background-position:200% 0}}`,
    html: `<div class="ctr"><div style="text-align:center"><div class="t">반짝<br>캠프</div><span class="pill">✦ 디지털 놀이터 ✦</span></div></div><i class="s" style="left:14%;top:18%"></i><i class="s" style="right:16%;top:24%;animation-delay:-.6s"></i><i class="s" style="left:24%;bottom:14%;animation-delay:-1.2s;width:4vmin;height:4vmin"></i>`,
  },
  {
    id: 'synthwave', ko: '레트로 신스웨이브', en: 'Synthwave / Retrowave',
    desc: '줄무늬 석양, 앞으로 달려오는 원근 격자, 네온 글자. 80년대 오락실의 밤.',
    fit: '게임 기반 학습·코딩 캠프·밤 행사처럼 몰입감 있는 한 장면.',
    tech: 'mask 줄무늬 해 + perspective rotateX 격자 바닥의 background-position 반복 + 네온 text-shadow',
    tags: ['80년대', '네온', '원근 격자', '석양'],
    f: ['Orbit'],
    css: `body{background:linear-gradient(#120024 0%,#3b0a5c 40%,#ff3d81 62%,#14002a 62.2%)}
.sun{position:absolute;left:50%;top:16%;width:44vmin;height:44vmin;margin-left:-22vmin;border-radius:50%;background:linear-gradient(#ffe259,#ff4e8a 72%);-webkit-mask:linear-gradient(#000 0 52%,transparent 52% 56%,#000 56% 64%,transparent 64% 69%,#000 69% 76%,transparent 76% 82%,#000 82% 88%,transparent 88%);mask:linear-gradient(#000 0 52%,transparent 52% 56%,#000 56% 64%,transparent 64% 69%,#000 69% 76%,transparent 76% 82%,#000 82% 88%,transparent 88%);filter:drop-shadow(0 0 4vmin #ff4e8a)}
.floor{position:absolute;left:-60%;right:-60%;top:62%;bottom:-30%;background:repeating-linear-gradient(90deg,rgba(255,90,210,.9) 0 2px,transparent 2px 8vmin),repeating-linear-gradient(0deg,rgba(255,90,210,.9) 0 2px,transparent 2px 6vmin);transform:perspective(30vmin) rotateX(60deg);transform-origin:top;animation:run 1s linear infinite}
@keyframes run{to{background-position:0 0,0 6vmin}}
.t{position:absolute;left:0;right:0;top:66%;text-align:center;font:9vmin/1 'Orbit',system-ui;color:#fff;text-shadow:0 0 1.4vmin #ff3df0,0 0 4vmin #7a2bff;letter-spacing:.08em}`,
    html: `<div class="sun"></div><div class="floor"></div><div class="t">코딩 아케이드</div>`,
  },
  {
    id: 'risograph', ko: '리소그래프', en: 'Risograph Print',
    desc: '별색 두세 개를 곱하기로 겹치고, 판이 살짝 어긋나고, 망점과 잡티가 남은 인쇄 스타일.',
    fit: '예술·지역·워크숍 강의, 손으로 만든 느낌이 필요한 자료집 표지.',
    tech: 'mix-blend-mode:multiply 별색 겹침 + 1~2px 어긋난 판(text-shadow) + radial-gradient 망점 + 그레인',
    tags: ['인쇄', '별색', '망점', '그레인'],
    f: ['Black Han Sans'],
    css: `body{background:#f7f1e3}
.c1{position:absolute;width:52vmin;height:52vmin;border-radius:50%;background:#ff48b0;left:12%;top:8%;mix-blend-mode:multiply;animation:mis 2.4s steps(2) infinite}
.c2{position:absolute;width:46vmin;height:46vmin;right:10%;bottom:6%;mix-blend-mode:multiply;transform:rotate(12deg);background:radial-gradient(circle,#0078bf 42%,transparent 44%) 0 0/2.2vmin 2.2vmin}
.c3{position:absolute;width:30vmin;height:30vmin;left:42%;top:30%;background:#ffe800;mix-blend-mode:multiply;clip-path:polygon(50% 0,100% 100%,0 100%)}
.t{position:absolute;left:7%;bottom:9%;font:14vmin/.92 'Black Han Sans',sans-serif;color:#0078bf;text-shadow:.7vmin .5vmin 0 #ff48b0;mix-blend-mode:multiply;letter-spacing:-.02em}
@keyframes mis{50%{transform:translate(.6vmin,-.5vmin)}}
${grainCss('body', 0.35)}`,
    html: `<i class="c1"></i><i class="c2"></i><i class="c3"></i><div class="t">함께<br>찍는 판화</div>`,
  },
  {
    id: 'hand-drawn', ko: '손그림 공책', en: 'Hand-drawn / Sketchbook',
    desc: '줄 공책 바탕에 손글씨 메모, 빨간 펜 동그라미, 붙임쪽지.',
    fit: '교사 실습·성찰·상담 연수처럼 손으로 쓰는 활동이 많은 강의.',
    tech: 'repeating-linear-gradient 줄 바탕 + 손글씨 글꼴 + SVG path 선 그리기(stroke-dashoffset 1→0)',
    tags: ['공책', '손글씨', '선 그리기', '붙임쪽지'],
    f: ['Gaegu:wght@400;700', 'Gowun Batang:wght@700'],
    css: `body{background:#fdfbf4;background-image:repeating-linear-gradient(transparent 0 calc(6.2vmin - 1px),#c9dcf0 calc(6.2vmin - 1px) 6.2vmin)}
.mg{position:absolute;left:12vmin;top:0;bottom:0;border-left:2px solid #f2a2a2}
.w{position:absolute;left:17vmin;top:5.4vmin;right:6vmin}
h2{font:700 6vmin/1.25 'Gowun Batang',serif;margin:0 0 1.2vmin;position:relative;display:inline-block}
h2 svg{position:absolute;left:-4vmin;top:-2.6vmin;width:calc(100% + 8vmin);height:calc(100% + 5vmin);overflow:visible}
h2 path{fill:none;stroke:#e5484d;stroke-width:2.6;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;animation:dr 1.4s .4s ease-out forwards}
@keyframes dr{to{stroke-dashoffset:0}}
p{font:4.4vmin/6.2vmin 'Gaegu',cursive;margin:0;color:#2b4a7a}
.note{position:absolute;right:6vmin;bottom:6vmin;width:30vmin;padding:2.4vmin;background:#fff3a3;font:700 3.8vmin/1.25 'Gaegu',cursive;transform:rotate(3deg);box-shadow:0 1.4vmin 1.6vmin -1vmin rgba(0,0,0,.28)}`,
    html: `<div class="mg"></div><div class="w"><h2>오늘 꼭 할 것<svg viewBox="0 0 100 40" preserveAspectRatio="none"><path pathLength="1" d="M8 24 C 4 6, 70 0, 94 14 C 104 26, 80 40, 40 37 C 12 35, 0 26, 14 10"/></svg></h2><p>1. 질문 하나 고르기<br>2. 짝과 바꿔 읽기<br>3. 보드에 붙이기</p></div><div class="note">쉬는 시간<br>10분!</div>`,
  },
  {
    id: 'blueprint', ko: '설계도', en: 'Blueprint / Technical Drawing',
    desc: '청사진 남색 모눈 위에 흰 선, 치수선, 고정폭 부품 번호.',
    fit: '공학·코딩·메이커·과학 강의, 구조를 설명하는 첫 화면.',
    tech: '두 겹 모눈 linear-gradient + SVG 치수선·지시선 + 고정폭 숫자 + 선이 그려지는 등장',
    tags: ['모눈', '치수선', '고정폭', '기술'],
    f: ['IBM Plex Mono:wght@500'],
    css: `body{background:#0f3b75;color:#e6f0ff;background-image:linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.2) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.2) 1px,transparent 1px);background-size:3vmin 3vmin,3vmin 3vmin,15vmin 15vmin,15vmin 15vmin}
svg{position:absolute;inset:0;width:100%;height:100%}
.s{fill:none;stroke:#eaf2ff;stroke-width:1.5;stroke-dasharray:1;stroke-dashoffset:1;animation:dr 2.2s ease-out forwards}
.s2{animation-delay:.6s}.s3{animation-delay:1.1s}
@keyframes dr{to{stroke-dashoffset:0}}
text{fill:#eaf2ff;font:500 11px 'IBM Plex Mono',monospace}`,
    html: `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet"><rect class="s" pathLength="1" x="70" y="60" width="260" height="170"/><g class="s s2"><rect pathLength="1" x="100" y="160" width="40" height="22"/><rect pathLength="1" x="150" y="160" width="40" height="22"/><rect pathLength="1" x="210" y="160" width="40" height="22"/><rect pathLength="1" x="260" y="160" width="40" height="22"/><rect pathLength="1" x="100" y="196" width="40" height="22"/><rect pathLength="1" x="150" y="196" width="40" height="22"/><rect pathLength="1" x="210" y="196" width="40" height="22"/><rect pathLength="1" x="260" y="196" width="40" height="22"/></g><g class="s s3"><path pathLength="1" d="M150 84 h100 v28 h-100 z M70 248 h260 M70 242 v12 M330 242 v12 M352 60 v170 M346 60 h12 M346 230 h12"/></g><text x="168" y="102">강사석</text><text x="172" y="266">9.0 m</text><text x="356" y="150">6.0 m</text><text x="74" y="50">A-01 교실 배치</text><text x="100" y="154">모둠 1</text><text x="210" y="154">모둠 2</text></svg>`,
  },
  {
    id: 'dataviz', ko: '데이터 시각화 스타일', en: 'Data-viz Aesthetic',
    desc: '아주 큰 고정폭 숫자와 길이에 정확히 비례한 막대. 숫자가 주인공인 화면.',
    fit: '통계·평가·데이터 리터러시 강의, 설문 결과를 보여 주는 마무리.',
    tech: 'font-variant-numeric:tabular-nums 거대 숫자 + 값에 비례한 width 막대 + scaleX 등장',
    tags: ['숫자', '막대', '고정폭', '정보'],
    f: ['IBM Plex Sans KR:wght@400;700', 'IBM Plex Mono:wght@600'],
    css: `body{background:#fbfaf7;color:#141414;font-family:'IBM Plex Sans KR',sans-serif}
.w{position:absolute;inset:6vmin 7vmin;display:grid;grid-template-columns:auto 1fr;gap:3vmin 5vmin;align-content:center}
.big{font:600 24vmin/.8 'IBM Plex Mono',monospace;letter-spacing:-.06em;font-variant-numeric:tabular-nums}
.big small{font-size:.34em;color:#999;letter-spacing:0}
.cap{font-size:2.9vmin;line-height:1.45;color:#555;align-self:end;margin:0}
.bars{grid-column:1/-1;display:grid;gap:1.4vmin}
.bars div{display:grid;grid-template-columns:14vmin 1fr 7vmin;gap:2vmin;align-items:center;font-size:2.7vmin}
.bars i{display:block;height:2.6vmin;background:#141414;transform-origin:left;animation:g 1.2s cubic-bezier(.2,.8,.2,1) both}
.bars div:first-child i{background:#ff5a1f}.bars div:nth-child(2) i{animation-delay:.1s}.bars div:nth-child(3) i{animation-delay:.2s}
.bars span:last-child{font-family:'IBM Plex Mono',monospace;text-align:right}
@keyframes g{from{transform:scaleX(0)}}`,
    html: `<div class="w"><div class="big">87<small>%</small></div><p class="cap">실습을 끝까지 마친 비율<br>(예시 값)</p><div class="bars"><div><span>실습 1</span><i style="width:92%"></i><span>92</span></div><div><span>실습 2</span><i style="width:87%"></i><span>87</span></div><div><span>실습 3</span><i style="width:64%"></i><span>64</span></div></div></div>`,
  },
  {
    id: 'dark-tech', ko: '다크 테크', en: 'Dark Tech / Terminal',
    desc: '거의 검은 바탕, 고정폭 글자, 가는 격자와 호박색 강조 하나. 기계실 같은 스타일.',
    fit: '개발·데이터·보안 강의에서 명령어를 따라 치는 실습 안내.',
    tech: '#07090c 바탕 + 고정폭 글꼴 + 1px 격자 + 타자 효과 + 강조색 하나(호박색)',
    tags: ['어두운 바탕', '고정폭', '터미널', '타자'],
    f: ['IBM Plex Mono:wght@400;600'],
    css: `body{background:#07090c;color:#b9c2cc;font:3vmin/1.7 'IBM Plex Mono',monospace;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:6vmin 6vmin}
.win{position:absolute;inset:7vmin 7vmin;border:1px solid #232a33;border-radius:2vmin;background:rgba(10,13,17,.9);overflow:hidden;box-shadow:0 0 0 1px rgba(255,176,0,.06),0 4vmin 8vmin rgba(0,0,0,.6)}
.bar{display:flex;gap:1.2vmin;align-items:center;padding:1.6vmin 2.4vmin;border-bottom:1px solid #1b2129;font-size:2.3vmin;color:#5c6773}
.bar i{width:1.6vmin;height:1.6vmin;border-radius:50%;background:#2a313b}
.out{padding:2.4vmin 3vmin;white-space:pre-wrap}
.p{color:#ffb000}.ok{color:#e6edf3}
.cur{display:inline-block;width:1.4vmin;height:3vmin;background:#ffb000;vertical-align:-.5vmin;animation:b 1s steps(1) infinite}@keyframes b{50%{opacity:0}}
.scan{position:absolute;left:0;right:0;height:20%;background:linear-gradient(transparent,rgba(255,176,0,.05),transparent);animation:sc 4s linear infinite}@keyframes sc{from{top:-20%}to{top:100%}}`,
    html: `<div class="win"><div class="bar"><i></i><i></i><i></i><span>실습 3 · 터미널</span></div><div class="out"></div><div class="scan"></div></div>`,
    js: `var L=[['p','$ ','npm create vite@latest 내-앱'],['ok','','✔ 템플릿 선택 · vanilla'],['p','$ ','cd 내-앱 && npm run dev'],['ok','','  준비됨 · localhost:5173']],o=document.querySelector('.out'),i=0,j=0;function draw(){var h='';for(var k=0;k<L.length;k++){if(k>i)break;var s=k<i?L[k][2]:L[k][2].slice(0,j);h+='<span class="'+L[k][0]+'">'+L[k][1]+'</span><span class="ok">'+s+'</span>'+(k<i?'<br>':'')}o.innerHTML=h+'<span class="cur"></span>'}function tick(){if(i>=L.length){setTimeout(function(){i=0;j=0;tick()},2400);return}j++;if(j>L[i][2].length){i++;j=0}draw();setTimeout(tick,L[i]&&L[i][0]==='ok'?18:60)}if(RM){i=L.length;draw()}else tick();`,
  },
  {
    id: 'minimal', ko: '따뜻한 미니멀', en: 'Warm Minimalism',
    desc: '미색 바탕, 넉넉한 여백, 작은 글과 따뜻한 색 한 점. 덜어 내서 또렷한 스타일.',
    fit: '학부모 설명회·상담·복지처럼 차분하고 신뢰가 필요한 강의.',
    tech: '미색 바탕(#f6f2ea) + 넓은 여백 + 가는 명조 제목 + 강조색 점 하나 + 아주 느린 숨쉬기 움직임',
    tags: ['여백', '미색', '절제', '차분'],
    f: ['Noto Serif KR:wght@300'],
    css: `body{background:#f6f2ea;color:#2a2620}
.dot{position:absolute;right:14vmin;top:13vmin;width:5vmin;height:5vmin;border-radius:50%;background:#d9643a;animation:br 5s ease-in-out infinite}
@keyframes br{50%{transform:scale(1.3);opacity:.75}}
.line{position:absolute;left:10vmin;right:10vmin;top:48%;height:1px;background:#ddd3c4;transform-origin:left;animation:ln 1.6s cubic-bezier(.2,.8,.2,1) both}
@keyframes ln{from{transform:scaleX(0)}}
.w{position:absolute;left:10vmin;bottom:11vmin}
small{letter-spacing:.3em;font-size:2.2vmin;color:#9a8f80}
h2{font:300 7.2vmin/1.3 'Noto Serif KR',serif;margin:2vmin 0 0;letter-spacing:-.02em}`,
    html: `<div class="dot"></div><div class="line"></div><div class="w"><small>학부모 설명회</small><h2>아이의 하루를<br>함께 봐요</h2></div>`,
  },
  {
    id: 'maximal', ko: '맥시멀·도파민', en: 'Maximalism / Dopamine Design',
    desc: '쨍한 색끼리 부딪치고, 글자는 크고 겹치고, 스티커와 패턴이 가득한 스타일.',
    fit: '축제·캠프·시상식처럼 들뜬 기분을 한 장면에 담을 때. 정보 화면에는 한두 곳만.',
    tech: '보색 단색 면 + 굵은 외곽선 글자(-webkit-text-stroke + 평면 text-shadow) + 회전하는 스티커',
    tags: ['쨍한 색', '스티커', '겹침', '축제'],
    f: ['Black Han Sans', 'Bagel Fat One'],
    css: `body{background:#ff3e8a}
.st1{position:absolute;inset:0;background:repeating-linear-gradient(45deg,#ffd400 0 3vmin,transparent 3vmin 7vmin);opacity:.45}
.blob{position:absolute;width:46vmin;height:46vmin;background:#2bd9a3;border-radius:42% 58% 63% 37%/41% 44% 56% 59%;left:-8vmin;bottom:-12vmin;animation:sp 12s linear infinite}
.sq{position:absolute;right:7vmin;top:6vmin;width:20vmin;height:20vmin;background:#3b5bff;transform:rotate(12deg);box-shadow:1.4vmin 1.4vmin 0 #111}
.t{position:relative;font:17vmin/.88 'Black Han Sans',sans-serif;color:#fff;-webkit-text-stroke:.6vmin #111;text-shadow:1.2vmin 1.2vmin 0 #111;transform:rotate(-6deg);text-align:center}
.badge{position:absolute;right:9vmin;bottom:9vmin;width:22vmin;height:22vmin;border-radius:50%;background:#ffd400;border:.6vmin solid #111;display:grid;place-items:center;font:4.2vmin/1.05 'Bagel Fat One',system-ui;text-align:center;animation:sp 9s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}`,
    html: `<div class="st1"></div><div class="blob"></div><div class="sq"></div><div class="ctr"><div class="t">신나는<br>여름 캠프</div></div><div class="badge">D-3<br>신청!</div>`,
  },
  {
    id: 'collage', ko: '콜라주·스크랩북', en: 'Collage / Scrapbook',
    desc: '오려 붙인 종이, 테이프, 기울어진 사진과 손글씨 태그.',
    fit: '지역·역사 탐구 수업처럼 모은 자료를 펼쳐 보이는 강의.',
    tech: 'clip-path 찢은 가장자리 + 기울인 카드 + 반투명 테이프 띠 + 겹친 종이 그림자',
    tags: ['종이', '테이프', '기울기', '손글씨'],
    f: ['Gowun Batang:wght@700', 'Nanum Pen Script'],
    css: `body{background:#e9e2d2}
.pc{position:absolute;background:#fffdf7;box-shadow:0 1.6vmin 2.4vmin -1.4vmin rgba(60,40,10,.35)}
.p1{left:8vmin;top:9vmin;width:46vmin;height:32vmin;padding:2vmin;transform:rotate(-4deg);animation:drop .7s cubic-bezier(.2,.9,.3,1.2) both}
.ph{width:100%;height:100%;background:linear-gradient(#a8d0e6 0 55%,#7bb37a 55%);position:relative;overflow:hidden}
.ph::before{content:"";position:absolute;left:18%;top:20%;width:9vmin;height:9vmin;border-radius:50%;background:#ffd166}
.ph::after{content:"";position:absolute;left:-10%;right:-10%;bottom:20%;height:40%;background:#5a8f5a;clip-path:polygon(0 100%,20% 30%,38% 70%,60% 10%,80% 60%,100% 30%,100% 100%)}
.p2{right:7vmin;top:7vmin;width:34vmin;padding:3vmin;transform:rotate(5deg);clip-path:polygon(0 3%,8% 0,20% 2%,33% 0,50% 3%,66% 0,80% 2%,100% 0,98% 50%,100% 100%,80% 97%,60% 100%,40% 97%,20% 100%,0 97%);font:700 4.4vmin/1.2 'Gowun Batang',serif;animation:drop .7s .15s cubic-bezier(.2,.9,.3,1.2) both}
.p3{left:30vmin;bottom:7vmin;padding:1.6vmin 3vmin;background:#ffe3e0;transform:rotate(-2deg);font:5.4vmin 'Nanum Pen Script',cursive;animation:drop .7s .3s cubic-bezier(.2,.9,.3,1.2) both}
.tape{position:absolute;width:14vmin;height:4vmin;background:rgba(255,236,150,.75);box-shadow:0 .2vmin .4vmin rgba(0,0,0,.08)}
@keyframes drop{from{opacity:0;transform:translateY(-4vmin) rotate(0) scale(1.06)}}`,
    html: `<div class="pc p1"><div class="ph"></div></div><div class="tape" style="left:22vmin;top:6vmin;transform:rotate(-8deg)"></div><div class="pc p2">우리 동네<br>골목 답사</div><div class="tape" style="right:16vmin;top:4vmin;transform:rotate(6deg)"></div><div class="pc p3">3모둠 · 시장 길</div>`,
  },
  {
    id: 'pixel', ko: '픽셀 아케이드', en: 'Pixel Art / 8-bit',
    desc: '도트 글꼴과 격자로 찍은 그림, 체력 막대 같은 진행 표시.',
    fit: '게임 기반 학습·코딩·초등 강의에서 단계 진행을 놀이처럼 보여 줄 때.',
    tech: '픽셀 글꼴(Galmuri) + 격자 rect로 찍은 도트 그림(shape-rendering:crispEdges) + steps() 애니메이션 + 칸 나뉜 진행 막대',
    tags: ['도트', '게임', '진행 막대', 'steps()'],
    links: ['https://cdn.jsdelivr.net/npm/galmuri@2.40.3/dist/galmuri.css'],
    css: `body{background:#1b1f3b;color:#fff;font-family:'Galmuri11','Galmuri9',monospace;image-rendering:pixelated}
.w{position:absolute;inset:6vmin;display:grid;grid-template-rows:auto 1fr auto;gap:2vmin}
.hud{display:flex;justify-content:space-between;font-size:3.2vmin;color:#ffd84d}
.hp{display:flex;gap:.8vmin;margin-top:1vmin}.hp i{width:4vmin;height:3vmin;background:#ff4d6d;box-shadow:inset 0 -.8vmin rgba(0,0,0,.25)}.hp i.e{background:#3a3f66}
.sp{width:30vmin;height:30vmin;justify-self:center;align-self:center;shape-rendering:crispEdges;animation:hop .6s steps(2) infinite}
@keyframes hop{50%{transform:translateY(-2.4vmin)}}
.go{text-align:center;font-size:3.4vmin}.go span{animation:bl 1s steps(1) infinite}@keyframes bl{50%{opacity:0}}
.lv{display:flex;gap:1vmin;justify-content:center;font-size:2.6vmin}.lv b{padding:.6vmin 1.6vmin;border:.4vmin solid #fff}.lv b.on{background:#fff;color:#1b1f3b}`,
    html: `<div class="w"><div><div class="hud"><span>LV.2 실습</span><span>점수 0420</span></div><div class="hp"><i></i><i></i><i></i><i class="e"></i><i class="e"></i></div></div><svg class="sp" viewBox="0 0 10 10"></svg><div><div class="lv"><b class="on">1</b><b class="on">2</b><b>3</b><b>4</b></div><p class="go"><span>▶</span> 누르면 다음 단계</p></div></div>`,
    js: `var M=['..kkkkkk..','.kyyyyyyk.','kyykyykyyk','kyyyyyyyyk','kpyyyyyypk','.kyykkyyk.','..kkkkkk..','.b......b.','.bb....bb.','..........'],C={k:'#222',y:'#ffd84d',p:'#ff8fa3',b:'#4d7cff'},h='';M.forEach(function(r,y){r.split('').forEach(function(c,x){if(C[c])h+='<rect x="'+x+'" y="'+y+'" width="1" height="1" fill="'+C[c]+'"/>'})});document.querySelector('.sp').innerHTML=h;`,
  },
  {
    id: 'chalkboard', ko: '칠판·교실', en: 'Chalkboard',
    desc: '칠판 녹색 바탕에 분필 글씨와 노란 밑줄, 자석으로 붙인 쪽지.',
    fit: '수업 기술·교과 연수처럼 교실의 공기를 그대로 가져오고 싶을 때.',
    tech: '녹색 바탕 + 잔점 radial-gradient + 분필 글꼴 + feTurbulence 거친 가장자리 필터 + 선 그리기',
    tags: ['칠판', '분필', '교실', '손글씨'],
    f: ['Nanum Pen Script', 'Gaegu:wght@700'],
    css: `body{background:#2e4a3b;background-image:radial-gradient(rgba(255,255,255,.07) 1px,transparent 1.2px),radial-gradient(ellipse at 30% 20%,rgba(255,255,255,.07),transparent 60%);background-size:5px 5px,100% 100%;box-shadow:inset 0 0 0 2.6vmin #7d5230,inset 0 0 0 3.2vmin #5e3c20;color:#f3f5ef}
.w{position:absolute;left:10vmin;top:9vmin;right:10vmin;filter:url(#rough)}
h2{font:8.4vmin/1.1 'Nanum Pen Script',cursive;margin:0;opacity:.95}
p{font:4.6vmin/1.35 'Nanum Pen Script',cursive;margin:2vmin 0 0;opacity:.9}
svg.u{display:block;width:44vmin;height:4vmin;overflow:visible}
svg.u path{fill:none;stroke:#ffe27a;stroke-width:3;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;animation:dr 1s .5s ease-out forwards}
@keyframes dr{to{stroke-dashoffset:0}}
.mag{position:absolute;right:9vmin;bottom:9vmin;width:30vmin;padding:3vmin 2.4vmin 2.4vmin;background:#fffdf4;color:#333;font:700 3.6vmin/1.3 'Gaegu',cursive;transform:rotate(4deg)}
.mag::before{content:"";position:absolute;top:-1.6vmin;left:50%;margin-left:-2vmin;width:4vmin;height:4vmin;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ff8a8a,#d22 70%);box-shadow:0 .6vmin .8vmin rgba(0,0,0,.4)}`,
    html: `<svg width="0" height="0" style="position:absolute"><filter id="rough"><feTurbulence baseFrequency=".9" numOctaves="1" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2"/></filter></svg><div class="w"><h2>오늘의 질문</h2><svg class="u" viewBox="0 0 200 16" preserveAspectRatio="none"><path pathLength="1" d="M2 10 C 50 4, 120 14, 198 6"/></svg><p>왜 같은 설명을 듣고도<br>서로 다르게 이해할까?</p></div><div class="mag">모둠별로 답을<br>보드에 붙여요</div>`,
  },
  {
    id: 'official', ko: '공문·기관', en: 'Institutional / Official Document',
    desc: '기관 표지, 이중선 제목, 줄만 있는 표, □ 표시와 회신 절취선.',
    fit: '직무연수·행정 설명회처럼 공식 안내의 신뢰가 필요할 때. 숨 쉬는 그림 한 점으로 딱딱함을 풀어요.',
    tech: 'border-bottom:4px double + 세로줄 없는 표 + □/■ 체크 + dashed 절취선(가위표)',
    tags: ['공식', '이중선', '표', '체크'],
    f: ['Gothic A1:wght@400;800'],
    css: `body{background:#fff;color:#111;font-family:'Gothic A1',sans-serif}
.w{position:absolute;inset:5vmin 7vmin}
.hd{display:flex;align-items:center;gap:2.4vmin;border-bottom:1.2vmin double #111;padding-bottom:1.8vmin}
.em{width:8vmin;height:8vmin;border-radius:50%;border:.5vmin solid #1d4e9e;display:grid;place-items:center;color:#1d4e9e;font:800 3vmin 'Gothic A1'}
h2{font:800 5vmin/1.15 'Gothic A1';margin:0;letter-spacing:-.03em}
table{width:100%;border-collapse:collapse;margin:2.4vmin 0;font-size:2.7vmin}
th,td{border-bottom:1px solid #999;padding:1.1vmin 1vmin;text-align:left}th{width:22%;background:#f2f4f7;font-weight:800}
.ck{display:flex;gap:3.6vmin;font-size:2.8vmin}.ck span::before{content:"□ ";font-weight:800}.ck span.on::before{content:"■ ";color:#1d4e9e}
.cut{margin-top:2.6vmin;border-top:.4vmin dashed #888;position:relative;padding-top:1.4vmin;font-size:2.4vmin;color:#666}.cut::before{content:"✂";position:absolute;left:-.6vmin;top:-2.6vmin;font-size:3.2vmin;color:#888}`,
    html: `<div class="w"><div class="hd"><div class="em">연수</div><h2>2026 하반기 직무연수 운영 안내</h2></div><table><tr><th>일시</th><td>11. 28.(금) 14:00 ~ 17:00</td></tr><tr><th>장소</th><td>본관 3층 대회의실</td></tr><tr><th>이수</th><td>3시간(출석 확인 후 이수 처리)</td></tr></table><div class="ck"><span class="on">출석 확인</span><span>만족도 조사</span><span>과제 제출</span></div><div class="cut">회신서 · 참석 여부를 표시해 주세요</div></div>`,
    js: `var s=document.querySelectorAll('.ck span'),k=1;if(!RM)setInterval(function(){if(k>=s.length){s.forEach(function(x,i){if(i)x.classList.remove('on')});k=1}else s[k++].classList.add('on')},1100);`,
  },
  {
    id: 'nature', ko: '자연·계절', en: 'Organic / Nature',
    desc: '잎·물결 같은 선화와 흙빛 바탕, 바람에 흔들리는 작은 움직임.',
    fit: '환경·생태·숲 교육, 계절 행사 안내.',
    tech: 'SVG 선화 + transform-origin:bottom 흔들림 + 물결 path 반복 이동 + 흙·잎 색 세트',
    tags: ['선화', '잎', '물결', '계절'],
    f: ['Gowun Batang:wght@700', 'Gowun Dodum'],
    css: `body{background:#eef0e2;color:#24361f}
svg{position:absolute;right:4vmin;bottom:0;height:86%;overflow:visible}
.lf{fill:none;stroke:#3e6b3a;stroke-width:2;stroke-linecap:round;transform-box:fill-box;transform-origin:50% 100%;animation:sw 4s ease-in-out infinite alternate}
.lf2{animation-delay:-1.4s;stroke:#7a9a4a}.lf3{animation-delay:-2.6s;stroke:#b0893b}
@keyframes sw{from{transform:rotate(-4deg)}to{transform:rotate(5deg)}}
.wave{position:absolute;left:0;right:0;bottom:6vmin;height:6vmin;background:repeating-radial-gradient(circle at 50% 120%,transparent 0 2.6vmin,#7aa6b8 2.6vmin 2.9vmin,transparent 2.9vmin 6vmin);background-size:8vmin 6vmin;opacity:.6;animation:wv 6s linear infinite}
@keyframes wv{to{background-position:16vmin 0}}
.w{position:absolute;left:8vmin;top:10vmin}
small{font:2.6vmin 'Gowun Dodum';letter-spacing:.1em;color:#6d7f5a}
h2{font:700 7.6vmin/1.2 'Gowun Batang',serif;margin:1.4vmin 0 0}`,
    html: `<div class="w"><small>가을 숲 체험</small><h2>숲에서<br>배우는 하루</h2></div><svg viewBox="0 0 160 220"><path class="lf" d="M80 220 C 78 160, 70 120, 84 60 M84 60 C 60 70, 50 100, 78 120 M84 60 C 110 70, 116 96, 82 116 M82 100 C 64 70, 70 40, 84 20 C 98 40, 102 70, 84 100"/><path class="lf lf2" d="M40 220 C 42 180, 30 150, 20 120 M20 120 C 8 130, 10 150, 30 160 M20 120 C 34 112, 46 120, 36 146"/><path class="lf lf3" d="M124 220 C 126 190, 136 170, 146 150 M146 150 C 156 160, 152 176, 134 180 M146 150 C 132 146, 122 156, 130 174"/></svg><div class="wave"></div>`,
  },
  {
    id: 'keynote', ko: '어두운 키노트', en: 'Dark Keynote',
    desc: '한 화면에 한 문장, 아주 큰 숫자. 장이 바뀔 때만 조용히 넘어가는 무대.',
    fit: '리더십·기술 특강, 발표 화면처럼 한 번에 하나만 보여 줄 때.',
    tech: '검은 바탕 + 한 화면 한 문장 + filter:blur·opacity 교차 전환 + 아주 큰 숫자',
    tags: ['한 문장', '무대', '전환', '발표'],
    f: ['IBM Plex Sans KR:wght@300;700'],
    css: `body{background:#050505;color:#f2f2f2;font-family:'IBM Plex Sans KR',sans-serif}
.s{position:absolute;inset:0;display:grid;place-content:center;text-align:center;padding:8vmin;opacity:0;filter:blur(1.4vmin);transform:scale(1.04);transition:opacity .9s,filter .9s,transform 1.2s cubic-bezier(.2,.8,.2,1)}
.s.on{opacity:1;filter:none;transform:none}
.n{font:700 34vmin/.8 'IBM Plex Sans KR';letter-spacing:-.06em;background:linear-gradient(#fff,#777);-webkit-background-clip:text;background-clip:text;color:transparent}
.q{font:300 6.4vmin/1.35 'IBM Plex Sans KR';letter-spacing:-.02em}.q b{font-weight:700}
.k{margin-top:2vmin;font-size:2.4vmin;color:#888;letter-spacing:.2em}`,
    html: `<div class="s on"><div class="n">3</div><p class="k">오늘 바꿀 습관의 수</p></div><div class="s"><p class="q">회의는 <b>질문</b>으로<br>시작해요</p></div><div class="s"><p class="q">결정은 <b>기록</b>으로<br>끝내요</p></div>`,
    js: `var s=document.querySelectorAll('.s'),k=0;if(!RM)setInterval(function(){s[k].classList.remove('on');k=(k+1)%s.length;s[k].classList.add('on')},2600);`,
  },
  {
    id: 'map', ko: '지도·답사', en: 'Map / Field Trip',
    desc: '지도 위에 길이 그려지고 지점 번호가 차례로 나타나는 답사 안내.',
    fit: '현장 체험·답사·진로 탐방처럼 움직이는 동선이 있는 강의.',
    tech: '등고선 radial-gradient 바탕 + SVG path 선 그리기 + 지점 표시의 animation-delay 순차 등장',
    tags: ['지도', '동선', '선 그리기', '번호'],
    f: ['Gowun Dodum'],
    css: `body{background:#f2ecdc;background-image:repeating-radial-gradient(circle at 30% 70%,transparent 0 3vmin,rgba(150,120,70,.16) 3vmin 3.25vmin),repeating-radial-gradient(circle at 80% 20%,transparent 0 2.6vmin,rgba(150,120,70,.12) 2.6vmin 2.85vmin);font-family:'Gowun Dodum',sans-serif}
svg{position:absolute;inset:0;width:100%;height:100%}
.rt{fill:none;stroke:#d1452f;stroke-width:3.4;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;animation:dr 3.6s ease-in-out forwards}
.rt2{fill:none;stroke:#fff;stroke-width:1;stroke-dasharray:.008 .012;opacity:.9}
@keyframes dr{to{stroke-dashoffset:0}}
.pt{opacity:0;animation:pop .4s cubic-bezier(.3,1.6,.5,1) forwards;transform-box:fill-box;transform-origin:center}
@keyframes pop{from{opacity:0;transform:scale(0)}to{opacity:1;transform:none}}
.pt circle{fill:#1d1b16}.pt text{fill:#fff;font:700 12px sans-serif;text-anchor:middle}
.lb{font:12px 'Gowun Dodum',sans-serif;fill:#3b3326}
.leg{position:absolute;left:5vmin;top:5vmin;background:rgba(255,253,245,.9);padding:1.6vmin 2.4vmin;border:1px solid #c9bb98;font-size:2.6vmin;line-height:1.5}
.leg b{display:block;font-size:3.4vmin}`,
    html: `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice"><path class="rt" pathLength="1" d="M60 240 C 110 230, 120 170, 170 170 S 230 120, 250 110 S 330 80, 345 60"/><g class="pt" style="animation-delay:.1s"><circle cx="60" cy="240" r="11"/><text x="60" y="244">1</text></g><g class="pt" style="animation-delay:1.3s"><circle cx="170" cy="170" r="11"/><text x="170" y="174">2</text></g><g class="pt" style="animation-delay:2.3s"><circle cx="250" cy="110" r="11"/><text x="250" y="114">3</text></g><g class="pt" style="animation-delay:3.4s"><circle cx="345" cy="60" r="11"/><text x="345" y="64">4</text></g><text class="lb" x="76" y="262">정문</text><text class="lb" x="186" y="192">옛 우체국</text><text class="lb" x="200" y="100">시장</text><text class="lb" x="300" y="44">전망대</text></svg><div class="leg"><b>골목 답사 길</b>4곳 · 약 1.8km</div>`,
  },
  {
    id: 'poster', ko: '포스터·글자', en: 'Typographic Poster',
    desc: '화면을 꽉 채우는 거대한 글자와 기운 띠. 글자가 곧 그림인 스타일.',
    fit: '특강·행사·캠페인의 첫 화면, 발표 화면의 표지.',
    tech: 'clamp()+vw로 화면을 채우는 제목 + 좁고 굵은 제목체 + 기울인 띠 안의 흐르는 글자',
    tags: ['큰 글자', '포스터', '띠', '강한 색'],
    f: ['Gasoek One', 'Anton'],
    css: `body{background:#efff3a;color:#0d0d0d;overflow:hidden}
.t{position:absolute;left:4vmin;right:4vmin;top:6vmin;font:27vmin/.86 'Gasoek One',sans-serif;letter-spacing:-.04em}
.t span{display:block}.t span:last-child{text-align:right}
.band{position:absolute;left:-10%;right:-10%;top:58%;transform:rotate(-7deg);background:#0d0d0d;color:#efff3a;padding:1.6vmin 0;overflow:hidden;white-space:nowrap;font:4.6vmin/1 'Anton',sans-serif;letter-spacing:.06em}
.band div{display:inline-block;animation:mq 10s linear infinite}
@keyframes mq{to{transform:translateX(-50%)}}
.k{position:absolute;left:5vmin;bottom:5vmin;font:700 2.8vmin/1.35 system-ui}`,
    html: `<div class="t"><span>말하기</span><span>특강</span></div><div class="band"><div>NOV 28 · 14:00 · 대강당 · NOV 28 · 14:00 · 대강당 · NOV 28 · 14:00 · 대강당 · NOV 28 · 14:00 · 대강당 · </div></div><div class="k">사람 앞에서 떨리지 않게<br>3시간 실습</div>`,
  },
  {
    id: 'bauhaus', ko: '바우하우스', en: 'Bauhaus',
    desc: '빨강·파랑·노랑과 원·네모·세모. 기하학 도형이 질서 있게 맞물리는 스타일.',
    fit: '디자인·미술·수학 강의, 구조와 원리를 보여 주는 표지.',
    tech: '삼원색 + 원/사각형/clip-path 삼각형 + 굵은 검은 막대 + 도형끼리 이어지는 안무(keyframes)',
    tags: ['기하학', '삼원색', '도형', '구성'],
    f: ['Black Han Sans'],
    css: `body{background:#f0e9da}
.o{position:absolute;width:40vmin;height:40vmin;border-radius:50%;background:#e1251b;left:8vmin;top:8vmin;animation:a 6s cubic-bezier(.7,0,.3,1) infinite}
.q{position:absolute;width:30vmin;height:30vmin;background:#1f4ea3;right:10vmin;top:14vmin;animation:b 6s cubic-bezier(.7,0,.3,1) infinite}
.tr{position:absolute;width:32vmin;height:28vmin;background:#f7c425;clip-path:polygon(50% 0,100% 100%,0 100%);left:34vmin;bottom:6vmin;animation:c 6s cubic-bezier(.7,0,.3,1) infinite}
.bar{position:absolute;left:0;right:0;top:56%;height:2.4vmin;background:#111}
.v{position:absolute;right:6vmin;bottom:6vmin;writing-mode:vertical-rl;font:7vmin/1 'Black Han Sans',sans-serif;letter-spacing:.1em;color:#111}
@keyframes a{0%,20%{transform:none}35%,70%{transform:translateX(12vmin)}85%,100%{transform:none}}
@keyframes b{0%,30%{transform:none}45%,80%{transform:rotate(45deg) scale(.8)}95%,100%{transform:none}}
@keyframes c{0%,40%{transform:none}55%,85%{transform:translateY(-8vmin) rotate(180deg)}100%{transform:none}}`,
    html: `<div class="o"></div><div class="q"></div><div class="bar"></div><div class="tr"></div><div class="v">형태와 기능</div>`,
  },
  {
    id: 'skeuomorphism', ko: '스큐어모피즘', en: 'Skeuomorphism / Tactile Realism',
    desc: '금속 다이얼, 불 켜지는 표시등처럼 실제 물건의 재질과 손맛을 그대로 옮긴 스타일.',
    fit: '음악·과학 실험·장비 사용법처럼 손으로 조작하는 감각을 살리고 싶을 때.',
    tech: 'conic-gradient 헤어라인 금속 + 여러 겹 box-shadow 입체 + 회전 다이얼 + 빛나는 표시등',
    tags: ['재질', '금속', '다이얼', '촉감'],
    ptr: true,
    css: `body{background:linear-gradient(#cfd2d6,#a9adb3)}
.pn{position:absolute;inset:7vmin;border-radius:3vmin;background:repeating-linear-gradient(90deg,#d9dce0 0 1px,#cdd0d4 1px 3px);box-shadow:inset 0 .4vmin 0 rgba(255,255,255,.8),inset 0 -.6vmin 1vmin rgba(0,0,0,.18),0 2vmin 4vmin rgba(0,0,0,.35);display:flex;align-items:center;justify-content:space-around;padding:4vmin}
.dial{width:34vmin;height:34vmin;border-radius:50%;background:conic-gradient(from 0deg,#eee,#9a9ea4,#f5f5f5,#8d9197,#e9e9e9,#a3a7ad,#eee);box-shadow:0 1.6vmin 2.4vmin rgba(0,0,0,.45),inset 0 .4vmin .4vmin rgba(255,255,255,.9),inset 0 -.6vmin .8vmin rgba(0,0,0,.3);position:relative}
.dial i{position:absolute;left:50%;top:9%;width:1.4vmin;height:7vmin;margin-left:-.7vmin;border-radius:1vmin;background:#e2471b;box-shadow:0 0 1vmin rgba(226,71,27,.6)}
.leds{display:grid;gap:3vmin;font:700 2.4vmin system-ui;color:#3b3f45;letter-spacing:.1em}
.led{display:flex;align-items:center;gap:1.6vmin}.led b{width:3vmin;height:3vmin;border-radius:50%;background:#5a1d12;box-shadow:inset 0 .3vmin .4vmin rgba(0,0,0,.6)}
.led b.on{background:radial-gradient(circle at 40% 35%,#fff7c2,#ffb300 60%);box-shadow:0 0 1.6vmin #ffb300,0 0 4vmin rgba(255,179,0,.5)}`,
    html: `<div class="pn"><div class="dial"><i></i></div><div class="leds"><div class="led"><b class="on"></b>마이크</div><div class="led"><b></b>녹음</div><div class="led"><b class="on"></b>화면 공유</div></div></div>`,
    js: `var d=document.querySelector('.dial'),bs=document.querySelectorAll('.led b');ghost(document.body,function(x,y){var a=-135+x*270;d.style.transform='rotate('+a+'deg)';bs[1].classList.toggle('on',x>.55)});`,
  },
];
