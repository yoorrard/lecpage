// ② 레이아웃·구성
const LINES = 'repeating-linear-gradient(90deg,rgba(255,60,60,.12) 0 calc((100% - 11*2vmin)/12),transparent calc((100% - 11*2vmin)/12) calc((100% - 11*2vmin)/12 + 2vmin))';

export default [
  {
    id: 'grid-12', ko: '12칸 격자', en: '12-column Grid',
    desc: '화면을 12칸으로 나누고 내용이 몇 칸을 차지할지 정하는 기본 뼈대.',
    fit: '여러 쪽으로 나눈 강의 사이트에서 쪽마다 같은 질서를 유지할 때.',
    tech: 'display:grid; grid-template-columns:repeat(12,1fr); gap + grid-column:span N',
    tags: ['격자', 'grid', '칸', '정렬'],
    css: `body{background:#faf8f4}
.ov{position:absolute;inset:5vmin;background:${LINES};animation:ov 3.2s ease-in-out infinite}
@keyframes ov{0%,100%{opacity:1}50%{opacity:.15}}
.g{position:absolute;inset:5vmin;display:grid;grid-template-columns:repeat(12,1fr);grid-auto-rows:min-content;gap:2vmin;align-content:center}
.g>div{border-radius:1.4vmin;padding:2vmin;font-size:2.6vmin;background:#1c1a17;color:#fff}
.h{grid-column:1/9;font:800 6.4vmin/1.1 system-ui!important;background:none!important;color:#1c1a17!important;padding:0!important}
.a{grid-column:1/6;background:#e8e2d6!important;color:#1c1a17!important;min-height:16vmin}.b{grid-column:6/13;min-height:16vmin}.c{grid-column:1/5}.d{grid-column:5/9;background:#ff5a3c!important}.e{grid-column:9/13;background:#e8e2d6!important;color:#1c1a17!important}
.n{position:absolute;left:5vmin;right:5vmin;top:1.2vmin;display:grid;grid-template-columns:repeat(12,1fr);gap:2vmin;font:2vmin/1 ui-monospace,monospace;color:#e04a3a;text-align:center}`,
    html: `<div class="ov"></div><div class="n"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span><span>10</span><span>11</span><span>12</span></div><div class="g"><div class="h">오늘의 흐름</div><div class="a">span 5</div><div class="b">span 7 · 지금 할 일</div><div class="c">span 4</div><div class="d">span 4</div><div class="e">span 4</div></div>`,
  },
  {
    id: 'asymmetry', ko: '비대칭 구성', en: 'Asymmetric Layout',
    desc: '좌우를 일부러 다르게 나눠 시선이 흐르게 하는 구성. 큰 것과 작은 것의 대비.',
    fit: '흔한 가운데 정렬 대신 첫 화면에 긴장감과 개성을 줄 때.',
    tech: 'grid-template-columns:2fr 1fr 같은 불균등 칸 + 요소를 칸 밖으로 넘기기 + 크기 대비',
    tags: ['비대칭', '대비', '여백', '구성'],
    f: ['Noto Serif KR:wght@900'],
    css: `body{background:#f4efe6;color:#191714}
.w{position:absolute;inset:0;display:grid;grid-template-columns:1fr 2.4fr;grid-template-rows:1fr auto}
.l{border-right:1px solid #191714;padding:6vmin 4vmin;display:flex;flex-direction:column;justify-content:space-between;font-size:2.5vmin}
.l b{font:900 12vmin/1 'Noto Serif KR',serif;color:#c9432b}
.r{position:relative;padding:6vmin 6vmin 0}
h1{font:900 12vmin/.98 'Noto Serif KR',serif;letter-spacing:-.05em;margin:0 0 0 -16vmin;position:relative;animation:sl 1.1s cubic-bezier(.2,.8,.2,1) both}
@keyframes sl{from{transform:translateX(6vmin);opacity:0}}
.r p{max-width:30ch;font-size:2.8vmin;margin-top:4vmin}
.ft{grid-column:1/-1;border-top:1px solid #191714;padding:2vmin 4vmin;font-size:2.4vmin;display:flex;justify-content:space-between}`,
    html: `<div class="w"><div class="l"><b>02</b><span>두 번째 시간<br>45분</span></div><div class="r"><h1>천천히<br>읽는 법</h1><p>한 문단을 세 번 읽고 질문 하나를 남겨요. 질문은 보드에 붙여 함께 봐요.</p></div><div class="ft"><span>성찰 연수</span><span>교재 12~18쪽</span></div></div>`,
  },
  {
    id: 'split-screen', ko: '화면 분할', en: 'Split Screen',
    desc: '화면을 둘로 나눠 두 가지를 나란히 보여 주는 구성. 경계를 끌어 비율을 바꿀 수도 있어요.',
    fit: '전후 비교, 설명과 실습, 강사 말과 참가자 할 일을 나란히 보여 줄 때.',
    tech: 'grid-template-columns:var(--x) 1fr + 끌 수 있는 경계(pointer 이벤트로 --x 갱신)',
    tags: ['분할', '비교', '나란히', '끌기'],
    ptr: true,
    css: `body{background:#111;color:#fff}
.w{position:absolute;inset:0;display:grid;grid-template-columns:var(--x,50%) 1fr}
.a{background:#ff6a3d;padding:6vmin;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden}
.b{background:#14213d;padding:6vmin;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden}
small{font-size:2.4vmin;letter-spacing:.16em;opacity:.8}
b{font-size:6vmin;line-height:1.1;letter-spacing:-.03em;white-space:nowrap}
.h{position:absolute;top:0;bottom:0;left:var(--x,50%);width:0;border-left:2px solid #fff}
.h i{position:absolute;top:50%;left:-3.4vmin;width:6.8vmin;height:6.8vmin;border-radius:50%;background:#fff;color:#111;display:grid;place-items:center;font:700 3vmin system-ui;margin-top:-3.4vmin;box-shadow:0 1vmin 2vmin rgba(0,0,0,.3)}`,
    html: `<div class="w"><div class="a"><small>강사</small><b>설명 10분</b></div><div class="b"><small>참가자</small><b>직접 해 보기 20분</b></div></div><div class="h"><i>↔</i></div>`,
    js: `ghost(document.body,function(x){document.body.style.setProperty('--x',(20+x*60)+'%')});`,
  },
  {
    id: 'card-grid', ko: '반응형 카드 격자', en: 'Responsive Card Grid',
    desc: '칸 너비만 정해 두면 화면 폭에 따라 한 줄에 들어갈 카드 수가 저절로 바뀌는 격자.',
    fit: '자료실·실습 목록처럼 같은 종류 여러 개를 휴대폰과 큰 화면 모두에 맞게 늘어놓을 때.',
    tech: 'grid-template-columns:repeat(auto-fill,minmax(160px,1fr)) — 미디어 쿼리 없이 줄 수가 바뀜',
    tags: ['반응형', 'auto-fill', 'minmax', '카드'],
    css: `body{background:#eef0f3}
.fr{position:absolute;left:4vmin;top:5vmin;bottom:5vmin;width:92%;border:2px dashed #9aa3b2;border-radius:2vmin;padding:2vmin;animation:sz 5s ease-in-out infinite alternate;overflow:hidden}
@keyframes sz{from{width:92%}to{width:40%}}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(24vmin,1fr));gap:1.6vmin}
.g div{background:#fff;border-radius:1.6vmin;padding:1.6vmin;box-shadow:0 .4vmin 1vmin rgba(20,30,60,.08);font-size:2.4vmin;transition:all .3s}
.g i{display:block;height:9vmin;border-radius:1vmin;margin-bottom:1vmin}
.lb{position:absolute;right:4vmin;top:1vmin;font:2.2vmin ui-monospace,monospace;color:#6b7280}`,
    html: `<div class="lb">auto-fill · minmax</div><div class="fr"><div class="g"><div><i style="background:#ffb4a2"></i>교재 PDF</div><div><i style="background:#b5e2fa"></i>실습 1</div><div><i style="background:#c3f0ca"></i>실습 2</div><div><i style="background:#ffe5a0"></i>예시 답</div><div><i style="background:#e2d4ff"></i>설문</div><div><i style="background:#f7c6d9"></i>과제</div></div></div>`,
  },
  {
    id: 'masonry', ko: '메이슨리', en: 'Masonry Layout',
    desc: '높이가 다른 카드를 벽돌 쌓듯 빈틈없이 엇갈려 쌓는 배치.',
    fit: '나눔 보드·사진 모음처럼 길이가 제각각인 참가자 글을 모아 보여 줄 때.',
    tech: 'columns:3 + break-inside:avoid (또는 grid-template-rows:masonry를 지원하는 브라우저)',
    tags: ['벽돌', '보드', 'columns', '모음'],
    f: ['Gaegu:wght@700'],
    css: `body{background:#e9e4da}
.m{position:absolute;inset:4vmin;columns:3;column-gap:2vmin}
.m div{break-inside:avoid;margin-bottom:2vmin;padding:2.2vmin;border-radius:1.2vmin;font:700 3.2vmin/1.3 'Gaegu',cursive;box-shadow:0 .6vmin 1.4vmin -1vmin rgba(0,0,0,.3);animation:in .6s cubic-bezier(.2,.9,.3,1.3) both}
@keyframes in{from{opacity:0;transform:translateY(3vmin) scale(.9)}}`,
    html: `<div class="m"><div style="background:#fff3a3">질문을 먼저 쓰니 수업이 짧아졌어요</div><div style="background:#ffd6e0;animation-delay:.1s">모둠 역할을 정하니 좋았어요</div><div style="background:#cde8ff;animation-delay:.2s">예시 프롬프트를 그대로 복사해서 바꿔 써 봤는데 결과가 훨씬 구체적이었어요</div><div style="background:#d8f5d0;animation-delay:.3s">타이머!</div><div style="background:#fff;animation-delay:.4s">다음 시간엔 평가 기준도 같이 만들고 싶어요</div><div style="background:#ffe0b8;animation-delay:.5s">보드가 한눈에 보여서 좋아요</div><div style="background:#e8dcff;animation-delay:.6s">실습 시간 조금 더</div></div>`,
  },
  {
    id: 'sticky', ko: '붙는 머리(스티키)', en: 'Sticky Headers',
    desc: '스크롤해도 장 제목이 위에 붙어 있다가 다음 장 제목이 오면 자리를 넘겨줘요.',
    fit: '긴 실습 안내나 하루 일정처럼 지금 어느 장인지 계속 알려 줘야 할 때.',
    tech: 'position:sticky; top:0 + 장마다 따로 붙는 머리(섹션 안에 두면 다음 섹션이 밀어냄)',
    tags: ['sticky', '스크롤', '장 제목', '길잡이'],
    scroll: true,
    css: `body{background:#fff}
.sc{position:absolute;inset:0;overflow:auto;scrollbar-width:none}
.sc::-webkit-scrollbar{display:none}
h3{position:sticky;top:0;margin:0;padding:2vmin 5vmin;font-size:3.4vmin;background:#1f2a44;color:#fff;display:flex;justify-content:space-between;z-index:1}
h3 span{opacity:.7;font-weight:500}
section:nth-child(2) h3{background:#2f6f62}section:nth-child(3) h3{background:#a0522d}
li{padding:2.2vmin 5vmin;border-bottom:1px solid #eee;font-size:3vmin;list-style:none;display:flex;gap:3vmin}
li b{color:#999;font-weight:600;font-variant-numeric:tabular-nums}
ul{margin:0;padding:0}`,
    html: `<div class="sc"><section><h3>오전 <span>09:00~12:00</span></h3><ul><li><b>09:00</b>여는 말</li><li><b>09:20</b>질문 고르기</li><li><b>10:00</b>실습 1</li><li><b>10:50</b>쉬는 시간</li><li><b>11:00</b>모둠 발표</li></ul></section><section><h3>오후 <span>13:00~16:00</span></h3><ul><li><b>13:00</b>실습 2</li><li><b>14:00</b>사례 나눔</li><li><b>14:40</b>쉬는 시간</li><li><b>15:00</b>실습 3</li></ul></section><section><h3>마무리 <span>16:00~16:30</span></h3><ul><li><b>16:00</b>돌아보기</li><li><b>16:20</b>설문</li><li><b>16:30</b>끝</li></ul></section></div>`,
    js: `autoScroll(document.querySelector('.sc'));`,
  },
  {
    id: 'full-bleed', ko: '풀 블리드', en: 'Full-bleed Layout',
    desc: '읽기 좋은 폭의 본문 사이에 화면 끝까지 꽉 차는 띠를 끼워 넣는 구성.',
    fit: '본문은 차분히 두고 쪽 그림·핵심 문장 하나만 화면 가득 강조할 때.',
    tech: 'grid-template-columns:1fr min(60ch,100%) 1fr + .full{grid-column:1/-1}',
    tags: ['풀 블리드', '띠', '본문 폭', 'grid'],
    scroll: true,
    f: ['Noto Serif KR:wght@700'],
    css: `body{background:#fbfaf7;color:#222}
.sc{position:absolute;inset:0;overflow:auto;scrollbar-width:none}.sc::-webkit-scrollbar{display:none}
.w{display:grid;grid-template-columns:1fr min(62vmin,86%) 1fr;padding:6vmin 0}
.w>*{grid-column:2}
p{font-size:3vmin;line-height:1.75;margin:0 0 3vmin}
.full{grid-column:1/-1;margin:2vmin 0 5vmin;padding:9vmin 8vmin;background:linear-gradient(120deg,#16324f,#2a6f97);color:#fff;font:700 6vmin/1.3 'Noto Serif KR',serif;letter-spacing:-.02em}
h2{font:700 5vmin/1.2 'Noto Serif KR',serif;margin:0 0 3vmin}`,
    html: `<div class="sc"><div class="w"><h2>들어가며</h2><p>본문은 한 줄에 너무 많은 글자가 오지 않게 폭을 좁게 둬요. 눈이 다음 줄을 쉽게 찾아요.</p><p>강조할 한 장면은 화면 끝까지 넓혀요.</p><div class="full">"설명은 짧게,<br>해 보는 시간은 길게."</div><p>그리고 다시 읽기 좋은 폭으로 돌아와요. 이 리듬이 긴 글을 덜 지치게 해요.</p><p>쪽 그림이나 지도처럼 넓게 볼수록 좋은 것도 이 띠에 넣어요.</p></div></div>`,
    js: `autoScroll(document.querySelector('.sc'));`,
  },
  {
    id: 'scroll-snap', ko: '스크롤 스냅', en: 'Scroll Snap',
    desc: '옆으로 밀면 카드가 한 장씩 딱딱 맞춰 멈추는 가로 넘기기.',
    fit: '휴대폰에서 실습 단계·예시 카드를 한 장씩 넘겨 보게 할 때(스크립트 없이).',
    tech: 'overflow-x:auto + scroll-snap-type:x mandatory + scroll-snap-align:center',
    tags: ['가로 스크롤', 'snap', '넘기기', '휴대폰'],
    css: `body{background:#f1ede4}
.sc{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);display:flex;gap:3vmin;overflow-x:auto;scroll-snap-type:x mandatory;padding:4vmin 18vmin;scrollbar-width:none;scroll-behavior:smooth}
.sc::-webkit-scrollbar{display:none}
.sc div{flex:0 0 62vmin;height:52vmin;scroll-snap-align:center;border-radius:3vmin;padding:4vmin;display:flex;flex-direction:column;justify-content:space-between;color:#fff;font-size:2.8vmin}
.sc b{font-size:6vmin;line-height:1.1}
.dots{position:absolute;bottom:4vmin;left:0;right:0;display:flex;justify-content:center;gap:1.4vmin}
.dots i{width:1.6vmin;height:1.6vmin;border-radius:9px;background:#c9c1b2;transition:width .3s}.dots i.on{width:5vmin;background:#222}`,
    html: `<div class="sc"><div style="background:#e76f51"><span>1단계</span><b>교재 열기</b></div><div style="background:#2a9d8f"><span>2단계</span><b>질문 고르기</b></div><div style="background:#264653"><span>3단계</span><b>짝과 바꾸기</b></div><div style="background:#e9a23b"><span>4단계</span><b>보드에 붙이기</b></div></div><div class="dots"><i class="on"></i><i></i><i></i><i></i></div>`,
    js: `var sc=document.querySelector('.sc'),ds=document.querySelectorAll('.dots i'),cs=sc.children,k=0,user=0;sc.addEventListener('pointerdown',function(){user=Date.now()});sc.addEventListener('scroll',function(){var m=sc.scrollLeft+sc.clientWidth/2,best=0;for(var i=0;i<cs.length;i++){if(Math.abs(cs[i].offsetLeft+cs[i].offsetWidth/2-m)<Math.abs(cs[best].offsetLeft+cs[best].offsetWidth/2-m))best=i}ds.forEach(function(d,i){d.classList.toggle('on',i===best)})});if(!RM)setInterval(function(){if(Date.now()-user<4000)return;k=(k+1)%cs.length;sc.scrollTo({left:cs[k].offsetLeft-(sc.clientWidth-cs[k].offsetWidth)/2})},1800);`,
  },
  {
    id: 'sidebar-toc', ko: '옆 목차·스크롤 스파이', en: 'Sidebar TOC / Scroll Spy',
    desc: '옆에 붙은 목차가 지금 읽는 장을 따라 저절로 표시되는 구성.',
    fit: '긴 안내 쪽·자료 모음에서 원하는 곳으로 바로 가고 지금 위치를 알 때.',
    tech: 'position:sticky 목차 + IntersectionObserver로 보이는 장 찾기 + 표시 막대 이동',
    tags: ['목차', 'scroll spy', 'sticky', '길잡이'],
    scroll: true,
    css: `body{background:#fff;color:#222}
.w{position:absolute;inset:0;display:grid;grid-template-columns:30vmin 1fr}
nav{border-right:1px solid #eee;padding:5vmin 3vmin;position:relative;font-size:2.7vmin}
nav a{display:block;padding:1.2vmin 2vmin;color:#888;text-decoration:none;transition:color .2s}
nav a.on{color:#111;font-weight:700}
nav i{position:absolute;left:3vmin;width:.6vmin;height:5vmin;background:#ff5a3c;border-radius:1vmin;transition:top .35s cubic-bezier(.2,.8,.2,1);top:5vmin}
.sc{overflow:auto;scrollbar-width:none;padding:0 5vmin}.sc::-webkit-scrollbar{display:none}
section{padding:5vmin 0 10vmin;border-bottom:1px solid #f0f0f0}
h3{margin:0 0 1.6vmin;font-size:4vmin}
p{margin:0;font-size:2.8vmin;line-height:1.7;color:#555}`,
    html: `<div class="w"><nav><i></i><a href="#s1" class="on">준비</a><a href="#s2">실습 1</a><a href="#s3">실습 2</a><a href="#s4">마무리</a></nav><div class="sc"><section id="s1"><h3>준비</h3><p>노트북을 켜고 와이파이에 연결해요. 교재 1~4쪽을 미리 훑어요.</p></section><section id="s2"><h3>실습 1</h3><p>예시 프롬프트를 복사해 AI에 붙여 넣고 답을 비교해요.</p></section><section id="s3"><h3>실습 2</h3><p>조건을 하나씩 더하며 답이 어떻게 바뀌는지 기록해요.</p></section><section id="s4"><h3>마무리</h3><p>가장 좋았던 프롬프트를 보드에 붙이고 설문을 해요.</p></section></div></div>`,
    js: `var sc=document.querySelector('.sc'),as=document.querySelectorAll('nav a'),bar=document.querySelector('nav i');function on(i){as.forEach(function(a,j){a.classList.toggle('on',i===j)});bar.style.top=as[i].offsetTop+'px'}var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)on([].indexOf.call(document.querySelectorAll('section'),e.target))})},{root:sc,rootMargin:'-30% 0px -60% 0px'});document.querySelectorAll('section').forEach(function(s){io.observe(s)});as.forEach(function(a,i){a.onclick=function(e){e.preventDefault();sc.scrollTo({top:document.querySelectorAll('section')[i].offsetTop,behavior:'smooth'})}});on(0);autoScroll(sc);`,
  },
  {
    id: 'container-queries', ko: '컨테이너 쿼리', en: 'Container Queries',
    desc: '화면 크기가 아니라 놓인 상자의 폭에 맞춰 부품이 스스로 모양을 바꿔요.',
    fit: '같은 출석·과제 카드를 넓은 칸과 좁은 옆줄에 함께 쓸 때.',
    tech: 'container-type:inline-size + @container (min-width: 300px) { … }',
    tags: ['@container', '반응형', '부품', '최신 기능'],
    css: `body{background:#f3f1ec}
.box{position:absolute;left:5vmin;top:7vmin;width:88%;container-type:inline-size;animation:w 4.5s ease-in-out infinite alternate}
@keyframes w{from{width:88%}to{width:42%}}
.card{display:grid;grid-template-columns:1fr;gap:2vmin;background:#fff;border-radius:2.4vmin;padding:2.6vmin;box-shadow:0 .6vmin 2vmin rgba(0,0,0,.07)}
.pic{height:18vmin;border-radius:1.6vmin;background:linear-gradient(135deg,#ffcf70,#ff6f61)}
.card b{font-size:3.6vmin;display:block;line-height:1.2}.card p{margin:.6vmin 0 0;font-size:2.4vmin;color:#777}
.btn{justify-self:start;background:#111;color:#fff;border-radius:99px;padding:1vmin 3vmin;font-size:2.4vmin}
@container (min-width: 300px){.card{grid-template-columns:22vmin 1fr auto;align-items:center}.pic{height:16vmin}.btn{justify-self:end}}
.lb{position:absolute;left:5vmin;bottom:4vmin;font:2.2vmin ui-monospace,monospace;color:#888}`,
    html: `<div class="box"><div class="card"><div class="pic"></div><div><b>과제 1 · 수업 설계안</b><p>금요일 18:00까지</p></div><span class="btn">제출</span></div></div><div class="lb">@container (min-width: 300px)</div>`,
  },
  {
    id: 'overlap', ko: '겹침 구성', en: 'Overlapping Layers',
    desc: '글자·그림·면이 격자 선을 넘어 서로 겹치며 깊이를 만드는 구성.',
    fit: '쪽 그림 위에 제목을 걸치거나, 첫 화면에 입체감을 줄 때.',
    tech: '같은 grid-area에 여러 요소 겹치기 + z-index + 음수 여백 + mix-blend-mode',
    tags: ['겹침', '깊이', 'grid-area', '레이어'],
    f: ['Black Han Sans'],
    css: `body{background:#f2eee6}
.g{position:absolute;inset:6vmin;display:grid;grid-template-columns:repeat(6,1fr);grid-template-rows:repeat(5,1fr)}
.p{grid-area:1/3/5/7;background:linear-gradient(160deg,#5b8def,#1d3a8a);border-radius:1vmin;animation:a 6s ease-in-out infinite alternate}
.p2{grid-area:3/1/6/4;background:#ffcd3c;border-radius:50%;mix-blend-mode:multiply;animation:a 6s -2s ease-in-out infinite alternate-reverse}
.t{grid-area:2/1/4/6;align-self:center;font:14vmin/.9 'Black Han Sans',sans-serif;color:#111;z-index:2;letter-spacing:-.02em}
.s{grid-area:5/4/6/7;align-self:end;justify-self:end;font-size:2.6vmin;z-index:2;background:#111;color:#fff;padding:1vmin 2vmin}
@keyframes a{to{transform:translate(2vmin,-2vmin)}}`,
    html: `<div class="g"><div class="p"></div><div class="p2"></div><div class="t">겹쳐<br>보기</div><div class="s">미술 감상 연수</div></div>`,
  },
  {
    id: 'reading-measure', ko: '읽기 폭과 세로 리듬', en: 'Measure & Vertical Rhythm',
    desc: '한 줄 글자 수와 줄 간격·문단 간격을 일정한 단위로 맞춰 오래 읽어도 편한 본문.',
    fit: '실습 안내·과제 설명처럼 참가자가 꼼꼼히 읽어야 하는 글.',
    tech: 'max-width:34em(한글 한 줄 약 35~45자) + line-height 1.7 + 여백을 줄 높이의 배수로',
    tags: ['본문', '가독성', '줄 간격', '리듬'],
    f: ['Gowun Dodum'],
    css: `body{background:#fff;color:#2a2a2a;font-family:'Gowun Dodum',sans-serif}
.base{position:absolute;inset:0;background:repeating-linear-gradient(transparent 0 calc(4.8vmin - 1px),rgba(0,140,255,.13) calc(4.8vmin - 1px) 4.8vmin);animation:f 3s ease-in-out infinite alternate}
@keyframes f{from{opacity:1}to{opacity:.2}}
.w{position:relative;margin:4.8vmin auto;max-width:76vmin;padding:0 4vmin}
h3{font-size:4.2vmin;line-height:9.6vmin;margin:0}
p{font-size:2.9vmin;line-height:4.8vmin;margin:0 0 4.8vmin}
.ms{position:absolute;top:0;bottom:0;border-left:1px dashed #ff5a3c;border-right:1px dashed #ff5a3c;left:50%;transform:translateX(-50%);width:68vmin}`,
    html: `<div class="base"></div><div class="ms"></div><div class="w"><h3>과제 안내</h3><p>오늘 만든 수업 설계안을 한 쪽으로 정리해 금요일까지 올려요. 목표, 활동, 평가를 한 줄씩 적으면 충분해요.</p><p>모든 글줄과 여백이 같은 줄 높이 위에 놓여 있어요.</p></div>`,
  },
];
