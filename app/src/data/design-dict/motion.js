// ④ 움직임·상호작용. 움직임 줄이기면 CSS는 index.js BASE가 멈추고, JS는 RM을 보고 한 장면만 그림
import { RND, FIT } from './parts.js';

export default [
  {
    id: 'scroll-driven', ko: '스크롤 연동 애니메이션', en: 'Scroll-driven Animations',
    desc: '스크롤한 만큼 진행 막대가 차고, 화면에 들어오는 만큼 내용이 나타나요. 스크립트 없이 CSS로.',
    fit: '긴 실습 안내에서 어디까지 읽었는지, 다음 장이 들어오는 순간을 보여 줄 때.',
    tech: 'animation-timeline:scroll() 진행 막대 + animation-timeline:view(); animation-range:entry 등장(@supports로 감싸기)',
    tags: ['scroll()', 'view()', 'CSS', '진행 막대'],
    scroll: true,
    css: `body{background:#0e0f12;color:#eceae4}
.sc{position:absolute;inset:0;overflow:auto;scrollbar-width:none}.sc::-webkit-scrollbar{display:none}
.pb{position:sticky;top:0;height:1.2vmin;background:#ff6a3d;transform-origin:left;z-index:2}
.it{margin:7vmin 8vmin;padding:4vmin;border-radius:2.4vmin;background:#1b1d22;border:1px solid #2a2d34}
.it b{display:block;font-size:4.4vmin;letter-spacing:-.02em}.it span{font-size:2.6vmin;color:#9aa0aa}
.it:nth-child(odd){margin-left:18vmin}
.big{font:800 10vmin/1 system-ui;letter-spacing:-.05em;margin:8vmin;color:#ff6a3d}
@supports (animation-timeline: view()){
  .pb{animation:grow linear both;animation-timeline:scroll(nearest)}
  .it{animation:rise linear both;animation-timeline:view();animation-range:entry 0% cover 35%}
  .big{animation:zoom linear both;animation-timeline:view();animation-range:entry 0% cover 50%}
}
@keyframes grow{from{transform:scaleX(0)}}
@keyframes rise{from{opacity:0;transform:translateY(8vmin) scale(.94)}}
@keyframes zoom{from{opacity:0;transform:scale(.6);letter-spacing:.2em}}`,
    html: `<div class="sc"><div class="pb"></div><div class="big">실습 3단계</div><div class="it"><b>1. 교재 열기</b><span>교재 넘기기에서 12쪽을 펴요</span></div><div class="it"><b>2. 예시 복사</b><span>복사 버튼으로 원문을 가져와요</span></div><div class="it"><b>3. 바꿔 쓰기</b><span>대상과 분량을 바꿔 다시 물어요</span></div><div class="it"><b>4. 보드에 붙이기</b><span>가장 좋은 답을 나눠요</span></div><div class="big">끝!</div></div>`,
    js: `autoScroll(document.querySelector('.sc'));`,
  },
  {
    id: 'parallax', ko: '시차 스크롤', en: 'Parallax Scrolling',
    desc: '겹친 층이 서로 다른 빠르기로 움직여 깊이가 생기는 스크롤.',
    fit: '답사·자연·여행 주제의 첫 장면 한 곳. 글 읽는 곳에는 쓰지 않아요.',
    tech: '층마다 다른 속도(translateY = scrollTop × 비율), transform만 움직이기 + 움직임 줄이기면 끔',
    tags: ['깊이', '층', '스크롤', '첫 장면'],
    scroll: true,
    f: ['Gowun Batang:wght@700'],
    css: `body{background:#fbe3c4}
.sc{position:absolute;inset:0;overflow:auto;scrollbar-width:none}.sc::-webkit-scrollbar{display:none}
.st{position:relative;height:260%}
.vw{position:sticky;top:0;height:100vh;overflow:hidden;background:linear-gradient(#ffd6a5,#fbe3c4 50%,#ffc8a2)}
.l{position:absolute;left:-10%;right:-10%;bottom:0;will-change:transform}
.sun{position:absolute;left:58%;top:16%;width:22vmin;height:22vmin;border-radius:50%;background:#ff7b54;will-change:transform}
.t{position:absolute;left:8vmin;top:12vmin;font:700 8vmin/1.15 'Gowun Batang',serif;color:#4a2c2a;will-change:transform}
.l1{height:64%;background:#e0a37d;clip-path:polygon(0 40%,12% 22%,26% 38%,40% 8%,56% 34%,70% 14%,86% 36%,100% 18%,100% 100%,0 100%)}
.l2{height:48%;background:#b5655c;clip-path:polygon(0 50%,16% 26%,30% 44%,48% 16%,62% 40%,80% 20%,100% 44%,100% 100%,0 100%)}
.l3{height:30%;background:#5e3c4f;clip-path:polygon(0 40%,10% 30%,22% 52%,38% 24%,52% 46%,68% 28%,84% 50%,100% 30%,100% 100%,0 100%)}`,
    html: `<div class="sc"><div class="st"><div class="vw"><div class="sun" data-r=".5"></div><div class="t" data-r="-.25">노을 지는<br>들판 답사</div><div class="l l1" data-r=".35"></div><div class="l l2" data-r=".2"></div><div class="l l3" data-r=".05"></div></div></div></div>`,
    js: `var sc=document.querySelector('.sc'),ls=document.querySelectorAll('[data-r]');sc.addEventListener('scroll',function(){var y=sc.scrollTop;ls.forEach(function(l){l.style.transform='translateY('+(y*l.dataset.r)+'px)'})},{passive:true});autoScroll(sc);`,
  },
  {
    id: 'line-reveal', ko: '줄 단위 가려 올리기', en: 'Line Mask Reveal',
    desc: '제목이 한 줄씩 보이지 않는 틀 아래에서 미끄러져 올라오는 등장.',
    fit: '첫 화면 제목·장 제목처럼 한 번만 강하게 보여 줄 문장.',
    tech: '줄마다 overflow:hidden 틀 + 안쪽 translateY(110%)→0 + 줄마다 animation-delay',
    tags: ['등장', '제목', 'mask', '순차'],
    f: ['Noto Serif KR:wght@900'],
    css: `body{background:#efe9dd;color:#1b1814}
h1{font:900 11vmin/1.04 'Noto Serif KR',serif;letter-spacing:-.05em;margin:0}
.ln{display:block;overflow:hidden;padding-bottom:.08em}
.ln>span{display:block;animation:up 1.1s cubic-bezier(.16,1,.3,1) both}
.ln:nth-child(2)>span{animation-delay:.12s}.ln:nth-child(3)>span{animation-delay:.24s;color:#c2410c}
@keyframes up{from{transform:translateY(110%) rotate(3deg)}}
.go h1 .ln>span{animation:none}`,
    html: `<div class="ctr"><h1><span class="ln"><span>말로 하는</span></span><span class="ln"><span>수업을 넘어</span></span><span class="ln"><span>해 보는 수업</span></span></h1></div>`,
    js: `var h=document.querySelector('h1');if(!RM)setInterval(function(){h.parentNode.classList.add('go');h.offsetWidth;h.parentNode.classList.remove('go')},3200);`,
  },
  {
    id: 'stagger', ko: '순차 등장', en: 'Staggered Animation',
    desc: '여러 개가 한꺼번에가 아니라 조금씩 시간차를 두고 차례로 나타나요.',
    fit: '오늘 흐름·자료 목록이 처음 보일 때 한 번. 모든 섹션에 쓰면 지루해요.',
    tech: '항목마다 --i 번호 + animation-delay:calc(var(--i)*60ms) (지원하면 sibling-index())',
    tags: ['순차', 'delay', '목록', '등장'],
    css: `body{background:#14161c}
.g{position:absolute;inset:7vmin;display:grid;grid-template-columns:repeat(6,1fr);gap:1.6vmin}
.g i{border-radius:1.4vmin;background:hsl(calc(var(--i)*9 + 190) 80% 62%);animation:pop 2.8s cubic-bezier(.3,1.5,.5,1) infinite;animation-delay:calc(var(--i)*45ms)}
@keyframes pop{0%{transform:scale(0) rotate(-30deg);opacity:0}18%,70%{transform:none;opacity:1}88%,100%{transform:scale(0);opacity:0}}`,
    html: `<div class="g"></div>`,
    js: `var g=document.querySelector('.g'),h='';for(var i=0;i<24;i++)h+='<i style="--i:'+((i%6)+Math.floor(i/6))+'"></i>';g.innerHTML=h;`,
  },
  {
    id: 'morph', ko: '모양 바꾸기', en: 'Shape Morphing',
    desc: '한 도형이 다른 도형으로 부드럽게 변해요. 점 개수가 같은 경로끼리 바꿔요.',
    fit: '생각이 자라는 과정, 씨앗→잎처럼 변화를 상징하는 그림 한 점.',
    tech: 'SMIL <animate attributeName="d" values="…;…"> 또는 CSS d:path() 전환(점 수가 같은 경로)',
    tags: ['morph', 'SVG', 'path', '변화'],
    css: `body{background:#f4f0ff}
svg{position:absolute;inset:0;width:100%;height:100%}
.lb{position:absolute;left:0;right:0;bottom:6vmin;text-align:center;font:700 3.6vmin system-ui;color:#3b2a7a;letter-spacing:.04em}`,
    html: `<svg viewBox="0 0 200 150"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs><path fill="url(#g)" d="M100 30 C130 30 150 50 150 75 C150 100 130 120 100 120 C70 120 50 100 50 75 C50 50 70 30 100 30 Z"><animate attributeName="d" dur="6s" repeatCount="indefinite" calcMode="spline" keySplines=".6 0 .2 1;.6 0 .2 1;.6 0 .2 1;.6 0 .2 1" keyTimes="0;.25;.5;.75;1" values="M100 30 C130 30 150 50 150 75 C150 100 130 120 100 120 C70 120 50 100 50 75 C50 50 70 30 100 30 Z;M100 20 C112 50 160 60 150 75 C130 88 112 100 100 130 C88 100 70 88 50 75 C40 60 88 50 100 20 Z;M60 30 C90 30 140 30 140 30 C140 60 140 120 140 120 C110 120 60 120 60 120 C60 90 60 30 60 30 Z;M100 40 C150 10 170 70 130 100 C110 115 100 125 100 125 C100 125 90 115 70 100 C30 70 50 10 100 40 Z;M100 30 C130 30 150 50 150 75 C150 100 130 120 100 120 C70 120 50 100 50 75 C50 50 70 30 100 30 Z"/></path></svg><div class="lb">생각 · 반짝임 · 정리 · 마음</div>`,
  },
  {
    id: 'kinetic-type', ko: '키네틱 타이포그래피', en: 'Kinetic Typography',
    desc: '글자 자체가 움직이며 뜻을 전해요. 커지고 기울고 흩어졌다 모여요.',
    fit: '특강 첫 장면, 발표 화면의 표지처럼 글자로 분위기를 잡을 때.',
    tech: '글자를 span으로 나눠 글자마다 --i 지연 + transform·font-weight 키프레임 + 낱말 바꾸기',
    tags: ['글자', '움직임', 'split text', '표지'],
    f: ['Black Han Sans'],
    css: `body{background:#ff4b2b;color:#fff;overflow:hidden}
.w{position:absolute;inset:0;display:grid;place-content:center;text-align:center}
.s{font-size:3.4vmin;letter-spacing:.3em;opacity:.85;margin-bottom:2vmin}
.wd{font:20vmin/1.25 'Black Han Sans',sans-serif;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;padding:0 2vmin}
.wd span{display:inline-block;animation:k 2.4s cubic-bezier(.7,0,.3,1) infinite;animation-delay:calc(var(--i)*70ms)}
@keyframes k{0%{transform:translateY(120%) rotate(12deg) scale(.6);opacity:0}18%,72%{transform:none;opacity:1}90%,100%{transform:translateY(-120%) rotate(-10deg) scale(1.2);opacity:0}}`,
    html: `<div class="w"><div class="s">오늘 우리는</div><div class="wd"></div></div>`,
    js: `var W=['묻고','듣고','바꿔요'],k=0,el=document.querySelector('.wd');function set(){var w=W[k++%W.length];el.innerHTML=w.split('').map(function(c,i){return '<span style="--i:'+i+'">'+c+'</span>'}).join('')}set();if(!RM)setInterval(set,2400);`,
  },
  {
    id: 'marquee', ko: '흐르는 띠', en: 'Marquee / Ticker',
    desc: '글이 끊김 없이 옆으로 흘러가는 띠. 두 줄을 반대로 흘리면 리듬이 생겨요.',
    fit: '행사 날짜·장소·주제어를 첫 화면 띠로, 발표 화면의 공지 줄.',
    tech: '같은 내용 두 벌 + translateX(-50%) 무한 반복 + 위에 올리면 멈춤 + 움직임 줄이기면 정지',
    tags: ['띠', '무한 반복', '공지', '리듬'],
    f: ['Anton', 'Black Han Sans'],
    css: `body{background:#111;color:#f6f1e7;overflow:hidden}
.w{position:absolute;inset:0;display:grid;align-content:center;gap:2vmin;transform:rotate(-4deg) scale(1.1)}
.r{display:flex;overflow:hidden;white-space:nowrap;padding:1.6vmin 0}
.r div{display:flex;flex:none;gap:4vmin;padding-right:4vmin;animation:mq 16s linear infinite;font:9vmin/1 'Black Han Sans',sans-serif;letter-spacing:-.01em}
.r:hover div{animation-play-state:paused}
.r2{background:#d4ff3a;color:#111}.r2 div{animation-direction:reverse;font-family:'Anton',sans-serif;animation-duration:12s}
.r span::after{content:"✦";margin-left:4vmin;color:#ff5a3c}
@keyframes mq{to{transform:translateX(-100%)}}`,
    html: `<div class="w"><div class="r"><div><span>질문</span><span>투표</span><span>나눔</span><span>실습</span><span>질문</span><span>투표</span></div><div aria-hidden="true"><span>질문</span><span>투표</span><span>나눔</span><span>실습</span><span>질문</span><span>투표</span></div></div><div class="r r2"><div><span>NOV 28 · 14:00</span><span>HALL B</span><span>NOV 28 · 14:00</span></div><div aria-hidden="true"><span>NOV 28 · 14:00</span><span>HALL B</span><span>NOV 28 · 14:00</span></div></div></div>`,
  },
  {
    id: 'magnetic', ko: '자석 버튼', en: 'Magnetic Button',
    desc: '마우스가 가까이 오면 버튼이 끌려가듯 따라오고, 멀어지면 제자리로 튕겨 돌아와요.',
    fit: '첫 화면의 가장 중요한 버튼 하나(마우스 화면에서만, 휴대폰은 그대로).',
    tech: 'pointermove 거리 계산 → translate로 끌림(거리에 반비례) + 놓으면 스프링 transition',
    tags: ['hover', '포인터', '버튼', '스프링'],
    ptr: true,
    f: ['IBM Plex Sans KR:wght@700'],
    css: `body{background:#f2efe8;cursor:crosshair}
.b{position:absolute;left:50%;top:50%;width:28vmin;height:28vmin;margin:-14vmin;border-radius:50%;background:#1d1d1f;color:#fff;display:grid;place-items:center;font:700 3.4vmin 'IBM Plex Sans KR',sans-serif;transition:transform .5s cubic-bezier(.3,1.6,.4,1);box-shadow:0 2vmin 4vmin rgba(0,0,0,.25)}
.b span{transition:transform .5s cubic-bezier(.3,1.6,.4,1)}
.ring{position:absolute;left:50%;top:50%;width:56vmin;height:56vmin;margin:-28vmin;border-radius:50%;border:1px dashed #c9c3b6}
.dot{position:absolute;width:2vmin;height:2vmin;margin:-1vmin;border-radius:50%;background:#ff5a3c;pointer-events:none}`,
    html: `<div class="ring"></div><div class="b"><span>출석하기</span></div><div class="dot"></div>`,
    js: `var b=document.querySelector('.b'),s=b.querySelector('span'),d=document.querySelector('.dot');ghost(document.body,function(x,y){var W=innerWidth,H=innerHeight,px=x*W,py=y*H,dx=px-W/2,dy=py-H/2,r=Math.min(W,H)*.28,dist=Math.hypot(dx,dy);d.style.left=px+'px';d.style.top=py+'px';if(dist<r){var k=.42*(1-dist/r*.4);b.style.transform='translate('+dx*k+'px,'+dy*k+'px)';s.style.transform='translate('+dx*k*.4+'px,'+dy*k*.4+'px)'}else{b.style.transform='';s.style.transform=''}});`,
  },
  {
    id: 'tilt', ko: '3D 기울기 카드', en: '3D Tilt Card',
    desc: '마우스 쪽으로 카드가 기울고 빛이 반사돼 손에 든 카드처럼 보여요.',
    fit: '수료 카드·배지·대표 그림 한 장처럼 들여다보고 싶은 물건.',
    tech: 'perspective + rotateX/rotateY(포인터 위치) + radial-gradient 반사광 위치 이동 + transform-style:preserve-3d',
    tags: ['3D', '기울기', '반사광', 'perspective'],
    ptr: true,
    f: ['IBM Plex Sans KR:wght@400;700'],
    css: `body{background:radial-gradient(circle at 50% 30%,#2b2f45,#0d0e14);perspective:120vmin}
.cd{position:absolute;left:50%;top:50%;width:56vmin;height:36vmin;margin:-18vmin -28vmin;border-radius:3vmin;background:linear-gradient(135deg,#ffcf5c,#ff7a59 45%,#c44569);transform-style:preserve-3d;transition:transform .15s;box-shadow:0 4vmin 8vmin rgba(0,0,0,.5);padding:4vmin;color:#2a1208;font-family:'IBM Plex Sans KR',sans-serif;overflow:hidden}
.cd small{font-size:2.3vmin;letter-spacing:.2em;font-weight:700}
.cd b{display:block;font-size:5.4vmin;margin-top:2vmin;transform:translateZ(6vmin);line-height:1.1}
.cd p{position:absolute;left:4vmin;bottom:3.4vmin;margin:0;font-size:2.4vmin}
.gl{position:absolute;inset:0;background:radial-gradient(circle at var(--gx,50%) var(--gy,50%),rgba(255,255,255,.55),transparent 45%);mix-blend-mode:soft-light;pointer-events:none}
.seal{position:absolute;right:4vmin;bottom:3vmin;width:11vmin;height:11vmin;border-radius:50%;border:.5vmin solid rgba(42,18,8,.6);display:grid;place-items:center;font-size:2.2vmin;font-weight:700;transform:translateZ(4vmin) rotate(-12deg)}`,
    html: `<div class="cd"><small>수료</small><b>AI와 함께<br>수업 설계 과정</b><p>2026. 11. 28. · 3시간</p><div class="seal">수료</div><div class="gl"></div></div>`,
    js: `var c=document.querySelector('.cd'),g=c.querySelector('.gl');ghost(document.body,function(x,y){c.style.transform='rotateY('+((x-.5)*30)+'deg) rotateX('+((.5-y)*24)+'deg)';g.style.setProperty('--gx',x*100+'%');g.style.setProperty('--gy',y*100+'%')});`,
  },
  {
    id: 'path-draw', ko: '선 그리기', en: 'SVG Path Drawing',
    desc: '선이 펜으로 그리듯 처음부터 끝까지 그려져요. 그림이 완성되는 과정을 보여 줘요.',
    fit: '주제를 상징하는 선화 한 점, 빨간 펜 밑줄, 지도 위 길.',
    tech: 'pathLength="1" + stroke-dasharray:1 + stroke-dashoffset 1→0 키프레임(획마다 지연)',
    tags: ['SVG', '선화', 'stroke-dashoffset', '손그림'],
    css: `body{background:#fffaf0}
svg{position:absolute;inset:8%;width:84%;height:84%}
.p{fill:none;stroke:#1d1d1f;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:d 4.5s cubic-bezier(.6,0,.3,1) infinite}
.p2{animation-delay:.25s;stroke:#f59e0b}.p3{animation-delay:.5s}.p4{animation-delay:.7s;stroke:#f59e0b}
@keyframes d{0%{stroke-dashoffset:1}45%,80%{stroke-dashoffset:0}100%{stroke-dashoffset:-1}}`,
    html: `<svg viewBox="0 0 200 140"><path class="p" pathLength="1" d="M100 18 C 72 18, 56 40, 60 62 C 63 78, 76 86, 80 100 L 120 100 C 124 86, 137 78, 140 62 C 144 40, 128 18, 100 18 Z"/><path class="p p3" pathLength="1" d="M82 108 H118 M86 116 H114 M92 124 H108"/><path class="p p2" pathLength="1" d="M100 4 V10 M150 22 L145 27 M50 22 L55 27 M166 62 H159 M34 62 H41"/><path class="p p4" pathLength="1" d="M90 70 Q 100 52 110 70 Q 100 84 90 70"/></svg>`,
  },
  {
    id: 'particles', ko: '입자·별자리', en: 'Particle System / Constellation',
    desc: '점들이 떠다니다 가까워지면 선으로 이어지는 캔버스 그림. 연결과 관계를 상징해요.',
    fit: '연결·관계·네트워크를 다루는 강의의 첫 장면 배경(화면 밖이면 멈춤).',
    tech: 'canvas 2D + 씨앗 있는 무작위 + 가까운 점끼리 선(거리에 따라 투명도) + 포인터 근처 점 끌어당김',
    tags: ['canvas', '입자', '네트워크', '생성 그림'],
    ptr: true,
    css: `body{background:#0b1020}canvas{position:absolute;inset:0;width:100%;height:100%}
.t{position:absolute;left:6vmin;bottom:6vmin;color:#e7ecff;font:700 6vmin/1.1 system-ui;letter-spacing:-.03em;pointer-events:none}.t small{display:block;font:2.4vmin system-ui;color:#8ea2ff;letter-spacing:.2em;margin-bottom:1vmin}`,
    html: `<canvas></canvas><div class="t"><small>연결의 힘</small>배움은<br>이어질 때 커져요</div>`,
    js: `${RND}${FIT}var c=document.querySelector('canvas'),S=fit(c),P=[],mx=-1e3,my=-1e3;for(var i=0;i<70;i++)P.push({x:rnd()*S.w,y:rnd()*S.h,vx:(rnd()-.5)*.4,vy:(rnd()-.5)*.4,r:rnd()*1.6+.6});ghost(document.body,function(x,y){mx=x*S.w;my=y*S.h});addEventListener('resize',function(){S=fit(c)});function f(){var x=S.x,L=Math.min(S.w,S.h)*.22;x.clearRect(0,0,S.w,S.h);for(var i=0;i<P.length;i++){var p=P[i],dx=mx-p.x,dy=my-p.y,d=Math.hypot(dx,dy);if(d<L*1.4){p.vx+=dx/d*.02;p.vy+=dy/d*.02}p.vx*=.99;p.vy*=.99;p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>S.w)p.vx*=-1;if(p.y<0||p.y>S.h)p.vy*=-1;for(var j=i+1;j<P.length;j++){var q=P[j],e=Math.hypot(p.x-q.x,p.y-q.y);if(e<L){x.strokeStyle='rgba(142,162,255,'+(1-e/L)*.5+')';x.lineWidth=.8;x.beginPath();x.moveTo(p.x,p.y);x.lineTo(q.x,q.y);x.stroke()}}x.fillStyle=d<L?'#ffd166':'#e7ecff';x.beginPath();x.arc(p.x,p.y,p.r,0,7);x.fill()}if(!RM)requestAnimationFrame(f)}f();`,
  },
  {
    id: 'shader', ko: '셰이더 배경', en: 'WebGL Shader Background',
    desc: '그래픽 카드가 화소마다 계산하는 흐르는 색면. 그림 파일 없이 아주 부드러운 움직임.',
    fit: '디지털·미래·AI 강의의 첫 화면 배경 한 곳(절반 해상도, 화면 밖이면 멈춤).',
    tech: 'WebGL 조각 셰이더(fragment shader)에 시간 uniform + 노이즈로 색 섞기 (라이브러리는 ogl@1.0.11도 됨)',
    tags: ['WebGL', 'GLSL', '셰이더', '그라데이션'],
    css: `body{background:#120f2b}canvas{position:absolute;inset:0;width:100%;height:100%}
.t{position:absolute;left:6vmin;top:6vmin;color:#fff;font:800 7vmin/1.05 system-ui;letter-spacing:-.04em;mix-blend-mode:overlay}
.t2{position:absolute;left:6vmin;bottom:6vmin;color:rgba(255,255,255,.85);font:2.6vmin system-ui}`,
    html: `<canvas></canvas><div class="t">생각이<br>흐르는 교실</div><div class="t2">GLSL · 화소마다 계산한 색</div>`,
    js: `var c=document.querySelector('canvas'),g=c.getContext('webgl');if(g){var dpr=.5;function rs(){c.width=c.clientWidth*dpr;c.height=c.clientHeight*dpr;g.viewport(0,0,c.width,c.height)}rs();addEventListener('resize',rs);function sh(t,s){var o=g.createShader(t);g.shaderSource(o,s);g.compileShader(o);return o}var p=g.createProgram();g.attachShader(p,sh(g.VERTEX_SHADER,'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));g.attachShader(p,sh(g.FRAGMENT_SHADER,'precision mediump float;uniform float t;uniform vec2 r;void main(){vec2 u=gl_FragCoord.xy/r;vec2 q=u*3.;for(int i=1;i<5;i++){float f=float(i);q.x+=.6/f*sin(f*q.y+t*.5+.3*f);q.y+=.6/f*cos(f*q.x+t*.4+.3*f);}vec3 col=.5+.5*cos(vec3(.0,.8,1.6)+q.x+q.y*.5+vec3(4.,4.5,5.));col=mix(col,vec3(.07,.06,.17),.25);gl_FragColor=vec4(col,1.);}'));g.linkProgram(p);g.useProgram(p);var b=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),g.STATIC_DRAW);var a=g.getAttribLocation(p,'a');g.enableVertexAttribArray(a);g.vertexAttribPointer(a,2,g.FLOAT,false,0,0);var ut=g.getUniformLocation(p,'t'),ur=g.getUniformLocation(p,'r'),last=0;function f(ms){if(ms-last>32){last=ms;g.uniform1f(ut,ms/1000+7);g.uniform2f(ur,c.width,c.height);g.drawArrays(g.TRIANGLES,0,3)}if(!RM)requestAnimationFrame(f)}f(16)}else c.style.background='linear-gradient(135deg,#5b3cc4,#e2468a,#f6a33a)';`,
  },
  {
    id: 'view-transitions', ko: '화면 전환', en: 'View Transitions API',
    desc: '목록이 바뀔 때 같은 항목이 제자리에서 새 자리로 미끄러지듯 이어지는 전환.',
    fit: '목록↔격자 보기, 단계 넘기기, 탭 바꾸기처럼 같은 것이 모양만 바뀔 때.',
    tech: 'document.startViewTransition(() => 바꾸기) + 항목마다 view-transition-name + 지원 안 하면 그냥 바꿈',
    tags: ['View Transitions', '전환', '목록', '최신 API'],
    f: ['IBM Plex Sans KR:wght@400;700'],
    css: `body{background:#f4f2ee;font-family:'IBM Plex Sans KR',sans-serif}
.w{position:absolute;inset:5vmin}
.tg{display:flex;gap:1vmin;margin-bottom:2.6vmin}.tg button{border:1px solid #ccc;background:#fff;border-radius:99px;padding:.8vmin 2.6vmin;font-size:2.4vmin;cursor:pointer}.tg button.on{background:#111;color:#fff;border-color:#111}
.l{display:grid;gap:1.4vmin}
.l div{display:flex;align-items:center;gap:2vmin;background:#fff;border-radius:1.8vmin;padding:1.4vmin;font-size:2.7vmin;box-shadow:0 .3vmin 1vmin rgba(0,0,0,.06)}
.l i{width:7vmin;height:7vmin;border-radius:1.2vmin;flex:none}
.l.grid{grid-template-columns:repeat(4,1fr)}.l.grid div{flex-direction:column;align-items:flex-start}.l.grid i{width:100%;height:18vmin}
::view-transition-group(*){animation-duration:.5s;animation-timing-function:cubic-bezier(.2,.8,.2,1)}`,
    html: `<div class="w"><div class="tg"><button class="on">목록</button><button>격자</button></div><div class="l"><div style="view-transition-name:a"><i style="background:#ff8a65"></i>교재</div><div style="view-transition-name:b"><i style="background:#4fc3f7"></i>실습 1</div><div style="view-transition-name:c"><i style="background:#aed581"></i>실습 2</div><div style="view-transition-name:d"><i style="background:#ffd54f"></i>설문</div></div></div>`,
    js: `var l=document.querySelector('.l'),bs=document.querySelectorAll('.tg button');function set(gr){var f=function(){l.classList.toggle('grid',gr);bs[0].classList.toggle('on',!gr);bs[1].classList.toggle('on',gr)};if(document.startViewTransition&&!RM)document.startViewTransition(f);else f()}bs[0].onclick=function(){set(false)};bs[1].onclick=function(){set(true)};var on=false;if(!RM)setInterval(function(){on=!on;set(on)},2200);`,
  },
  {
    id: 'microinteractions', ko: '마이크로인터랙션', en: 'Microinteractions',
    desc: '누른 순간의 작은 반응: 하트가 터지고, 복사 아이콘이 체크로 바뀌고, 숫자가 튀어요.',
    fit: '좋아요·복사·제출처럼 눌렀다는 확신을 줘야 하는 작은 버튼.',
    tech: '눌림 scale + 아이콘 바꿈 전환 + 터지는 점(가상 요소 keyframes) + aria-live 확인 문구',
    tags: ['피드백', '복사', '좋아요', '작은 움직임'],
    f: ['IBM Plex Sans KR:wght@600'],
    css: `body{background:#fff;font-family:'IBM Plex Sans KR',sans-serif}
.w{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:6vmin}
button{position:relative;border:1px solid #e5e2dc;background:#fff;border-radius:2.4vmin;padding:2.4vmin 3.4vmin;font-size:3vmin;font-weight:600;display:flex;align-items:center;gap:1.6vmin;cursor:pointer;transition:transform .15s}
button:active{transform:scale(.92)}
.h svg{width:5vmin;height:5vmin;fill:none;stroke:#999;stroke-width:2;transition:all .3s cubic-bezier(.3,1.8,.5,1)}
.h.on svg{fill:#ff3b5c;stroke:#ff3b5c;transform:scale(1.15)}
.h::before{content:"";position:absolute;left:5.5vmin;top:50%;width:1.6vmin;height:1.6vmin;margin:-.8vmin;border-radius:50%;box-shadow:0 -6vmin #ff3b5c,4.6vmin -4vmin #ffb800,6vmin 0 #3d7bff,4.6vmin 4vmin #2ecc71,0 6vmin #ff3b5c,-4.6vmin 4vmin #ffb800,-6vmin 0 #3d7bff,-4.6vmin -4vmin #2ecc71;opacity:0;transform:scale(.2)}
.h.on::before{animation:burst .6s ease-out}
@keyframes burst{30%{opacity:1}100%{opacity:0;transform:scale(1.1)}}
.n{font-variant-numeric:tabular-nums;display:inline-block}.h.on .n{animation:bump .4s}@keyframes bump{40%{transform:translateY(-1vmin)}}
.cp .ic{width:4.6vmin;height:4.6vmin;display:grid;place-items:center;position:relative}
.cp .ic i{position:absolute;font-style:normal;transition:all .3s cubic-bezier(.3,1.6,.5,1)}
.cp .ok{opacity:0;transform:scale(0) rotate(-90deg);color:#18a058}.cp.on .ok{opacity:1;transform:none}.cp.on .cy{opacity:0;transform:scale(0)}
.cp.on{border-color:#18a058;color:#18a058}`,
    html: `<div class="w"><button class="h"><svg viewBox="0 0 24 24"><path d="M12 21s-7-4.5-9.3-9C1 8.5 3 5 6.5 5c2 0 3.5 1.2 5.5 3 2-1.8 3.5-3 5.5-3C21 5 23 8.5 21.3 12 19 16.5 12 21 12 21z"/></svg><span class="n">24</span></button><button class="cp"><span class="ic"><i class="cy">⧉</i><i class="ok">✓</i></span><span class="lb">복사</span></button></div>`,
    js: `var h=document.querySelector('.h'),n=h.querySelector('.n'),cp=document.querySelector('.cp'),lb=cp.querySelector('.lb');h.onclick=function(){var on=h.classList.toggle('on');n.textContent=on?25:24};cp.onclick=function(){cp.classList.add('on');lb.textContent='복사했어요';setTimeout(function(){cp.classList.remove('on');lb.textContent='복사'},1400)};if(!RM){setInterval(function(){h.click()},2000);setTimeout(function(){cp.click();setInterval(function(){cp.click()},2000)},1000)}`,
  },
  {
    id: 'skeleton', ko: '불러오는 중 뼈대', en: 'Skeleton Loading / Shimmer',
    desc: '내용이 오기 전에 자리 모양을 먼저 그리고, 빛이 스쳐 지나가며 기다리는 중임을 알려요.',
    fit: '투표 결과·보드처럼 서버에서 받아 오는 내용이 뜨기 전.',
    tech: '실제 배치와 같은 회색 블록 + linear-gradient 빛 띠의 background-position 이동 + 다 오면 교차 전환',
    tags: ['로딩', 'shimmer', '자리 표시', '기다림'],
    css: `body{background:#fff}
.w{position:absolute;inset:6vmin;display:grid;gap:3vmin;align-content:start}
.r{display:flex;gap:2.6vmin;align-items:center}
.sk{background:linear-gradient(90deg,#eceae6 0 40%,#f7f6f3 50%,#eceae6 60%) 0 0/300% 100%;animation:sh 1.4s linear infinite;border-radius:1.2vmin}
@keyframes sh{from{background-position:100% 0}to{background-position:0 0}}
.av{width:10vmin;height:10vmin;border-radius:50%;flex:none}.ln{height:2.6vmin}.ln.s{width:40%}.ln.m{width:70%}.bx{height:22vmin;border-radius:2vmin}
.rl{display:none}.done .sk{display:none}.done .rl{display:block;animation:in .5s both}
@keyframes in{from{opacity:0}}
.rl b{font-size:3.4vmin}.rl p{margin:.6vmin 0 0;font-size:2.6vmin;color:#777}.av2{width:10vmin;height:10vmin;border-radius:50%;background:linear-gradient(135deg,#ffd166,#ef476f);flex:none}.bx2{height:22vmin;border-radius:2vmin;background:linear-gradient(120deg,#118ab2,#06d6a0)}`,
    html: `<div class="w"><div class="r"><div class="sk av"></div><div class="rl av2"></div><div style="flex:1;display:grid;gap:1.4vmin"><div class="sk ln m"></div><div class="sk ln s"></div><div class="rl"><b>나눔 보드</b><p>새 글 12개</p></div></div></div><div class="sk bx"></div><div class="rl bx2"></div><div class="sk ln m"></div><div class="sk ln s"></div></div>`,
    js: `var w=document.querySelector('.w');if(!RM)setInterval(function(){w.classList.toggle('done')},2200);`,
  },
  {
    id: 'text-scramble', ko: '글자 섞기', en: 'Text Scramble / Decode',
    desc: '무작위 글자가 빠르게 바뀌다가 한 글자씩 제자리를 찾아 낱말이 나타나요.',
    fit: '암호·데이터·AI 주제의 제목, 퀴즈 정답 공개.',
    tech: '글자마다 끝나는 시점을 정하고 그 전까지 무작위 글자로 바꿔 그림(requestAnimationFrame)',
    tags: ['글자', '해독', '공개', '데이터'],
    f: ['IBM Plex Mono:wght@600'],
    css: `body{background:#050a08;color:#d7ffe9}
.w{position:absolute;inset:0;display:grid;place-content:center;text-align:center;gap:2vmin}
small{font:2.4vmin 'IBM Plex Mono',monospace;color:#3ddc97;letter-spacing:.3em}
.t{font:600 8vmin/1.1 'IBM Plex Mono',monospace;letter-spacing:.02em;min-height:9vmin}
.t i{color:#3ddc97;font-style:normal;opacity:.6}`,
    html: `<div class="w"><small>정답 공개</small><div class="t"></div></div>`,
    js: `var W=['교사의 질문','데이터 읽기','함께 배우기'],G='ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ#%&*01',el=document.querySelector('.t'),k=0;function run(){var to=W[k++%W.length],q=[];for(var i=0;i<to.length;i++)q.push({to:to[i],end:10+i*5+Math.floor(Math.random()*10)});var f=0;(function tick(){var out='',done=0;for(var i=0;i<q.length;i++){if(f>=q[i].end||q[i].to===' '){out+=q[i].to;done++}else out+='<i>'+G[Math.floor(Math.random()*G.length)]+'</i>'}el.innerHTML=out;f++;if(done<q.length)requestAnimationFrame(tick);else setTimeout(run,1600)})()}if(RM)el.textContent=W[0];else run();`,
  },
  {
    id: 'count-up', ko: '숫자 굴리기', en: 'Count-up / Odometer',
    desc: '숫자가 0에서부터 올라가거나, 자리마다 돌아가며 맞춰지는 계기판 숫자.',
    fit: '출석 수·응답 수·모인 질문 수처럼 실제로 늘어나는 값(가짜 숫자 금지).',
    tech: '자리마다 0~9 세로 띠 + translateY(-N×10%) 전환 + tabular-nums',
    tags: ['숫자', '카운터', '계기판', 'tabular-nums'],
    f: ['IBM Plex Sans KR:wght@400;700'],
    css: `body{background:#14213d;color:#fff;font-family:'IBM Plex Sans KR',sans-serif}
.w{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:2vmin}
small{font-size:2.6vmin;color:#a9b8d6;letter-spacing:.14em}
.od{display:flex;font:700 20vmin/1 'IBM Plex Sans KR',sans-serif;font-variant-numeric:tabular-nums;letter-spacing:-.03em}
.dg{height:1em;overflow:hidden;position:relative}
.dg span{display:flex;flex-direction:column;transition:transform 1.4s cubic-bezier(.2,.9,.2,1)}
.u{font-size:5vmin;align-self:end;margin:0 0 3vmin 1.4vmin;color:#fca311}
p{margin:0;font-size:2.4vmin;color:#7f8fb0}`,
    html: `<div class="w"><small>지금 접속한 참가자</small><div class="od"><div class="dg"><span></span></div><div class="dg"><span></span></div><div class="dg"><span></span></div><b class="u">명</b></div><p>실제 접속 수를 받아 굴려요</p></div>`,
    js: `var ds=document.querySelectorAll('.dg span');ds.forEach(function(s){s.innerHTML='0123456789'.split('').map(function(n){return '<b style="height:1em">'+n+'</b>'}).join('')});function set(v){var t=String(v).padStart(3,'0');ds.forEach(function(s,i){s.style.transform='translateY(-'+(+t[i]*10)+'%)'})}set(0);var V=[128,131,136,142],k=0;setTimeout(function(){set(V[0])},300);if(!RM)setInterval(function(){k=(k+1)%V.length;set(V[k])},2000);`,
  },
  {
    id: 'spotlight', ko: '손전등 비추기', en: 'Cursor Spotlight',
    desc: '마우스가 있는 곳만 밝게 비춰 숨은 내용을 드러내는 효과.',
    fit: '퀴즈 힌트 찾기, 그림 속 숨은 요소 찾기처럼 탐색 활동.',
    tech: 'radial-gradient 마스크의 중심을 --x·--y CSS 변수로 옮김(mask-image) + 어두운 덮개',
    tags: ['hover', '마스크', '탐색', '포인터'],
    ptr: true,
    f: ['Black Han Sans', 'Gowun Dodum'],
    css: `body{background:#0c0c0c}
.sc{position:absolute;inset:0;display:grid;place-content:center;text-align:center;background:linear-gradient(135deg,#ffecd2,#fcb69f);color:#2b1d14}
.sc b{font:14vmin/1 'Black Han Sans',sans-serif}.sc p{font:3vmin 'Gowun Dodum',sans-serif;margin:1vmin 0 0}
.sc span{position:absolute;font:3vmin 'Gowun Dodum',sans-serif}
.lt{position:absolute;inset:0;background:#0c0c0c;-webkit-mask:radial-gradient(circle 16vmin at var(--x,50%) var(--y,50%),transparent 0 60%,#000 100%);mask:radial-gradient(circle 16vmin at var(--x,50%) var(--y,50%),transparent 0 60%,#000 100%);pointer-events:none}
.hint{position:absolute;left:0;right:0;bottom:4vmin;text-align:center;color:#666;font:2.4vmin system-ui;pointer-events:none}`,
    html: `<div class="sc"><b>숨은 낱말</b><p>그림 속 세 낱말을 찾아요</p><span style="left:12%;top:18%">관찰</span><span style="right:14%;top:30%">질문</span><span style="left:30%;bottom:16%">기록</span></div><div class="lt"></div><div class="hint">마우스로 비춰 보세요</div>`,
    js: `var b=document.body;ghost(b,function(x,y){b.style.setProperty('--x',x*100+'%');b.style.setProperty('--y',y*100+'%')});`,
  },
  {
    id: 'typewriter', ko: '타자기', en: 'Typewriter Effect',
    desc: '글자가 한 자씩 타자 치듯 찍히고 커서가 깜빡여요.',
    fit: 'AI 답이 나오는 모습, 프롬프트 예시를 보여 줄 때.',
    tech: 'JS로 한 글자씩 넣기(한글 조합 단위) 또는 CSS width + steps() + 깜빡이는 커서(steps(1))',
    tags: ['타자', '커서', 'steps()', 'AI 답'],
    f: ['IBM Plex Sans KR:wght@400;600'],
    css: `body{background:#f7f7f5;font-family:'IBM Plex Sans KR',sans-serif}
.w{position:absolute;inset:6vmin;display:grid;gap:2.4vmin;align-content:center}
.q{justify-self:end;background:#1b1b1f;color:#fff;border-radius:2.4vmin 2.4vmin .6vmin 2.4vmin;padding:2vmin 2.8vmin;font-size:2.8vmin;max-width:80%}
.a{background:#fff;border:1px solid #e6e3dc;border-radius:2.4vmin 2.4vmin 2.4vmin .6vmin;padding:2.4vmin 2.8vmin;font-size:2.8vmin;line-height:1.65;min-height:20vmin;max-width:88%}
.cur{display:inline-block;width:.5vmin;height:3vmin;background:#3d5afe;vertical-align:-.5vmin;margin-left:.3vmin;animation:b 1s steps(1) infinite}@keyframes b{50%{opacity:0}}`,
    html: `<div class="w"><div class="q">중학교 1학년 과학 첫 시간 활동을 추천해 줘</div><div class="a"><span class="tx"></span><i class="cur"></i></div></div>`,
    js: `var T='물에 뜨는 것과 가라앉는 것을 먼저 예상해 적고, 모둠별로 직접 띄워 본 뒤 예상과 결과를 비교하는 20분 활동을 추천해요.',el=document.querySelector('.tx'),i=0;function go(){if(i<=T.length){el.textContent=T.slice(0,i++);setTimeout(go,T[i-1]===','?260:45)}else setTimeout(function(){i=0;go()},2000)}if(RM)el.textContent=T;else go();`,
  },
  {
    id: 'highlighter', ko: '형광펜 칠하기', en: 'Highlighter Sweep',
    desc: '중요한 낱말에 형광펜이 왼쪽부터 쓱 칠해져요.',
    fit: '교재 핵심 문장, 과제 마감처럼 꼭 짚어야 할 한두 곳.',
    tech: 'background:linear-gradient(형광색) no-repeat + background-size:0 40% → 100% 40% 전환(줄바꿈에도 따라감: box-decoration-break:clone)',
    tags: ['강조', '형광펜', 'background-size', '본문'],
    f: ['Gowun Batang:wght@400;700'],
    css: `body{background:#fffdf7;color:#26231e}
.w{position:absolute;inset:0;display:grid;place-content:center;padding:0 9vmin}
p{font:400 4.4vmin/1.9 'Gowun Batang',serif;margin:0}
mark{background:linear-gradient(transparent 55%,#ffe45c 55%,#ffe45c 92%,transparent 92%) no-repeat 0 0/0% 100%;color:inherit;font-weight:700;-webkit-box-decoration-break:clone;box-decoration-break:clone;animation:hl 4s cubic-bezier(.6,0,.2,1) infinite}
mark.p{background-image:linear-gradient(transparent 55%,#ffb3c7 55%,#ffb3c7 92%,transparent 92%);animation-delay:.6s}
@keyframes hl{0%{background-size:0% 100%}25%,85%{background-size:100% 100%}100%{background-size:0% 100%}}`,
    html: `<div class="w"><p>좋은 피드백은 <mark>구체적이고</mark>, <mark class="p">바로 다음 행동으로 이어질 수 있어야</mark> 해요.</p></div>`,
  },
  {
    id: 'stacking-cards', ko: '겹쳐 쌓이는 카드', en: 'Sticky Stacking Cards',
    desc: '스크롤하면 카드가 하나씩 위로 올라와 앞 카드 위에 겹겹이 쌓여요.',
    fit: '실습 단계·핵심 원칙 서너 개를 차례로 강조할 때.',
    tech: '카드마다 position:sticky; top:N + 뒤 카드가 덮을 때 앞 카드 scale 줄이기(scroll-driven 또는 JS)',
    tags: ['sticky', '쌓기', '스크롤', '단계'],
    scroll: true,
    f: ['IBM Plex Sans KR:wght@400;700'],
    css: `body{background:#efece6;font-family:'IBM Plex Sans KR',sans-serif}
.sc{position:absolute;inset:0;overflow:auto;scrollbar-width:none;padding:5vmin 7vmin 40vmin}.sc::-webkit-scrollbar{display:none}
.cd{position:sticky;height:56vmin;border-radius:3vmin;padding:4.4vmin;color:#fff;margin-bottom:6vmin;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 -1vmin 3vmin rgba(0,0,0,.12);transform-origin:top center}
.cd small{font-size:2.6vmin;opacity:.8}.cd b{font-size:6.4vmin;line-height:1.1;letter-spacing:-.03em}
.cd:nth-child(1){top:4vmin;background:#264653}.cd:nth-child(2){top:7vmin;background:#2a9d8f}.cd:nth-child(3){top:10vmin;background:#e9a23b}.cd:nth-child(4){top:13vmin;background:#e76f51}`,
    html: `<div class="sc"><div class="cd"><small>원칙 1</small><b>설명은<br>10분 안에</b></div><div class="cd"><small>원칙 2</small><b>질문은<br>먼저 쓰게</b></div><div class="cd"><small>원칙 3</small><b>실습은<br>짝과 함께</b></div><div class="cd"><small>원칙 4</small><b>결과는<br>보드에 모아</b></div></div>`,
    js: `var sc=document.querySelector('.sc'),cs=document.querySelectorAll('.cd');sc.addEventListener('scroll',function(){cs.forEach(function(c,i){var n=cs[i+1];if(!n)return;var d=c.getBoundingClientRect().top,e=n.getBoundingClientRect().top,k=Math.max(0,Math.min(1,1-(e-d)/c.offsetHeight));c.style.transform='scale('+(1-k*.06)+')';c.style.filter='brightness('+(1-k*.25)+')'})},{passive:true});autoScroll(sc);`,
  },
  {
    id: 'spring', ko: '스프링·탄성 곡선', en: 'Spring Easing (linear())',
    desc: '목표를 살짝 지나쳤다 되돌아오는 탄성 있는 움직임. 물건처럼 무게감이 느껴져요.',
    fit: '버튼·꼬리표·알림이 튀어나올 때. 큰 면에는 부드러운 곡선이 더 나아요.',
    tech: 'CSS linear() 이징으로 스프링 곡선 흉내(또는 cubic-bezier(.3,1.6,.5,1)) — 같은 거리, 다른 성격 비교',
    tags: ['이징', 'linear()', '탄성', '곡선'],
    css: `body{background:#fafaf7;font-family:system-ui}
.w{position:absolute;inset:5vmin 6vmin;display:grid;gap:3.4vmin;align-content:center}
.r{display:grid;grid-template-columns:20vmin 1fr;align-items:center;gap:2vmin;font-size:2.4vmin;color:#555}
.r code{font:2vmin ui-monospace,monospace;color:#999;grid-column:2}
.tr{position:relative;height:8vmin;border-bottom:1px dashed #ddd}
.b{position:absolute;left:0;top:0;width:8vmin;height:8vmin;border-radius:2vmin;animation:mv 2.4s infinite alternate}
.e1 .b{background:#bbb;animation-timing-function:linear}.e2 .b{background:#5b8def;animation-timing-function:cubic-bezier(.2,.8,.2,1)}.e3 .b{background:#ff5a3c;animation-timing-function:linear(0,.009,.035 2.1%,.141,.281 6.7%,.723 12.9%,.938 16.7%,1.017,1.077,1.121,1.149 24.3%,1.159,1.163,1.161,1.154 29.9%,1.129 32.8%,1.051 39.6%,1.017 43.1%,.991,.977 51%,.974 53.8%,.975 57.1%,.997 69.8%,1.003 76.9%,1.004 83.8%,1)}
@keyframes mv{0%,15%{transform:translateX(0)}85%,100%{transform:translateX(calc(100% * 7))}}`,
    html: `<div class="w"><div class="r e1"><span>일정한 속도</span><div class="tr"><i class="b"></i></div></div><div class="r e2"><span>부드럽게 멈춤</span><div class="tr"><i class="b"></i></div></div><div class="r e3"><span>스프링</span><div class="tr"><i class="b"></i></div><code>linear(0, .28 6.7%, 1.16 27%, .97 54%, 1)</code></div></div>`,
  },
  {
    id: 'flip-card', ko: '카드 뒤집기', en: '3D Card Flip',
    desc: '카드가 입체로 뒤집혀 앞면엔 질문, 뒷면엔 답을 보여 줘요.',
    fit: '용어 사전·퀴즈·전후 비교처럼 앞뒤가 짝인 내용.',
    tech: 'perspective + transform-style:preserve-3d + rotateY(180deg) + backface-visibility:hidden',
    tags: ['3D', '뒤집기', '퀴즈', '용어'],
    f: ['Gowun Batang:wght@700', 'Gowun Dodum'],
    css: `body{background:#2d2a32;perspective:140vmin}
.cd{position:absolute;left:50%;top:50%;width:56vmin;height:38vmin;margin:-19vmin -28vmin;transform-style:preserve-3d;transition:transform .9s cubic-bezier(.4,1.4,.4,1);cursor:pointer}
.cd.on{transform:rotateY(180deg)}
.f{position:absolute;inset:0;border-radius:3vmin;backface-visibility:hidden;-webkit-backface-visibility:hidden;display:grid;place-content:center;text-align:center;padding:4vmin}
.fr{background:#fdf6e3;color:#2d2a32}.fr small{font:2.4vmin 'Gowun Dodum',sans-serif;color:#b58900}.fr b{font:700 7vmin/1.2 'Gowun Batang',serif}
.bk{background:#b58900;color:#fff;transform:rotateY(180deg);font:3.2vmin/1.6 'Gowun Dodum',sans-serif}`,
    html: `<div class="cd"><div class="f fr"><small>낱말 사전 · 눌러서 뒤집기</small><b>형성평가</b></div><div class="f bk">배우는 도중에 이해 정도를 확인해 다음 수업을 고치는 평가</div></div>`,
    js: `var c=document.querySelector('.cd');c.onclick=function(){c.classList.toggle('on')};if(!RM)setInterval(function(){c.classList.toggle('on')},2400);`,
  },
  {
    id: 'confetti', ko: '축하 종이 조각', en: 'Confetti Burst',
    desc: '종이 조각이 터져 나와 중력에 떨어지는 축하 효과.',
    fit: '퀴즈 정답, 과제 제출 완료, 수료 순간처럼 한 번의 축하.',
    tech: 'canvas 입자: 처음 속도 + 중력 + 공기 저항 + 회전, 다 떨어지면 그리기 멈춤(움직임 줄이기면 생략)',
    tags: ['축하', 'canvas', '입자', '퀴즈'],
    f: ['Jua'],
    css: `body{background:#fff8ec}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.w{position:absolute;inset:0;display:grid;place-content:center;text-align:center}
.w b{font:9vmin 'Jua',sans-serif;color:#2b2b2b}.w p{margin:1vmin 0 0;font:3vmin 'Jua',sans-serif;color:#888}`,
    html: `<div class="w"><b>정답이에요!</b><p>3번 · 질문을 먼저 쓰게 한다</p></div><canvas></canvas>`,
    js: `${FIT}var c=document.querySelector('canvas'),S=fit(c),P=[],C=['#ff5a5f','#ffb400','#00a699','#3d7bff','#8b5cf6'];function burst(){for(var i=0;i<90;i++){var a=-Math.PI/2+(Math.random()-.5)*1.6,v=6+Math.random()*7;P.push({x:S.w/2,y:S.h*.62,vx:Math.cos(a)*v,vy:Math.sin(a)*v,r:Math.random()*6,s:4+Math.random()*5,c:C[i%5],w:Math.random()*.3})}}var on=false;function f(){var x=S.x;x.clearRect(0,0,S.w,S.h);P=P.filter(function(p){return p.y<S.h+20});P.forEach(function(p){p.vy+=.22;p.vx*=.985;p.vy*=.985;p.x+=p.vx;p.y+=p.vy;p.r+=p.w;x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);x.restore()});if(P.length)requestAnimationFrame(f);else on=false}function go(){burst();if(!on){on=true;f()}}if(!RM){setTimeout(go,400);setInterval(go,2600)}document.body.onclick=function(){if(!RM)go()};`,
  },
];
