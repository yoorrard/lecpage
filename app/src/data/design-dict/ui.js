// ③ UI 무늬·부품
const SANS = ['IBM Plex Sans KR:wght@400;600;700'];
const BODY = `body{background:#f5f4f1;color:#1b1b1f;font-family:'IBM Plex Sans KR',system-ui,sans-serif}`;

export default [
  {
    id: 'hero', ko: '히어로 섹션', en: 'Hero Section',
    desc: '사이트에 들어오자마자 보이는 첫 장면. 무엇인지, 지금 무엇을 하면 되는지를 한 번에.',
    fit: '강의 사이트 첫 화면: 연수 이름, 오늘 날짜·장소, 가장 먼저 누를 곳 하나.',
    tech: '큰 제목 + 한 줄 설명 + 주요 버튼 하나 + 주제를 상징하는 직접 그린 SVG(흔한 가운데 정렬·버튼 둘 피하기)',
    tags: ['첫 화면', '제목', '버튼', 'SVG'],
    f: ['IBM Plex Sans KR:wght@400;700'],
    css: `${BODY}body{background:#0f1b2d;color:#fff}
.w{position:absolute;inset:0;padding:7vmin;display:grid;grid-template-columns:1.2fr 1fr;align-items:center;gap:4vmin}
small{color:#8fb3ff;font-size:2.4vmin;letter-spacing:.1em}
h1{font-size:7.4vmin;line-height:1.08;letter-spacing:-.035em;margin:1.6vmin 0 2vmin}
p{font-size:2.7vmin;color:#b9c4d6;margin:0 0 3.4vmin}
a{display:inline-block;background:#ffd166;color:#111;font-weight:700;font-size:2.8vmin;padding:1.8vmin 3.6vmin;border-radius:1.4vmin;text-decoration:none}
svg{width:100%;overflow:visible}
.o{fill:none;stroke:#8fb3ff;stroke-width:1.5;stroke-dasharray:4 6;animation:sp 30s linear infinite;transform-origin:100px 100px}
@keyframes sp{to{transform:rotate(360deg)}}
.n{fill:#ffd166;animation:pl 2.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.n2{animation-delay:-.8s;fill:#ff7aa2}.n3{animation-delay:-1.6s;fill:#7ae0c3}
@keyframes pl{50%{transform:scale(1.35)}}`,
    html: `<div class="w"><div><small>11월 28일 · 본관 3층</small><h1>질문으로 여는<br>수업 설계</h1><p>오늘 3시간, 질문 하나로 수업 한 차시를 다시 짜요.</p><a href="#">출석하고 시작</a></div><svg viewBox="0 0 200 200"><circle class="o" cx="100" cy="100" r="80"/><circle class="o" cx="100" cy="100" r="52" style="animation-direction:reverse"/><circle class="n" cx="100" cy="20" r="9"/><circle class="n n2" cx="152" cy="100" r="7"/><circle class="n n3" cx="44" cy="140" r="8"/><path d="M100 20 L152 100 L44 140 Z" fill="none" stroke="#fff" stroke-opacity=".35"/><text x="100" y="106" fill="#fff" font-size="16" text-anchor="middle" font-weight="700">?</text></svg></div>`,
  },
  {
    id: 'navbar', ko: '내비게이션 바', en: 'Navigation Bar',
    desc: '사이트의 주요 쪽을 오가는 메뉴 띠. 지금 위치를 표시가 미끄러지며 따라가요.',
    fit: '여러 쪽 강의 사이트의 공통 머리(오늘·실습·자료·질문).',
    tech: 'position:sticky 머리 + 지금 쪽 aria-current + 표시 막대를 transform으로 이동',
    tags: ['메뉴', 'aria-current', '표시 막대', '머리'],
    f: SANS,
    css: `${BODY}
.bar{position:absolute;left:4vmin;right:4vmin;top:6vmin;background:#fff;border-radius:2.4vmin;box-shadow:0 1vmin 3vmin rgba(0,0,0,.08);display:flex;align-items:center;padding:1.4vmin 2vmin;gap:1vmin}
.logo{font-weight:700;font-size:3vmin;margin-right:auto;display:flex;align-items:center;gap:1.2vmin}.logo i{width:3.6vmin;height:3.6vmin;border-radius:1vmin;background:#ff5a3c}
nav{position:relative;display:flex}
nav a{position:relative;z-index:1;padding:1.4vmin 2.4vmin;font-size:2.6vmin;color:#666;text-decoration:none;transition:color .25s}
nav a.on{color:#fff;font-weight:600}
nav span{position:absolute;top:0;bottom:0;border-radius:99px;background:#1b1b1f;transition:left .45s cubic-bezier(.3,1.3,.5,1),width .45s cubic-bezier(.3,1.3,.5,1)}
.pg{position:absolute;left:4vmin;right:4vmin;top:22vmin;bottom:5vmin;border-radius:2.4vmin;background:repeating-linear-gradient(#e9e7e2 0 2.4vmin,transparent 2.4vmin 5vmin);opacity:.7}`,
    html: `<div class="bar"><div class="logo"><i></i>연수</div><nav><span></span><a href="#" class="on">오늘</a><a href="#">실습</a><a href="#">자료</a><a href="#">질문</a></nav></div><div class="pg"></div>`,
    js: `var as=document.querySelectorAll('nav a'),sp=document.querySelector('nav span'),k=0;function go(i){as.forEach(function(a,j){a.classList.toggle('on',i===j)});sp.style.left=as[i].offsetLeft+'px';sp.style.width=as[i].offsetWidth+'px'}as.forEach(function(a,i){a.onclick=function(e){e.preventDefault();k=i;go(i)}});go(0);if(!RM)setInterval(function(){k=(k+1)%as.length;go(k)},1500);`,
  },
  {
    id: 'tabs', ko: '탭', en: 'Tabs',
    desc: '같은 자리에서 내용을 바꿔 보는 묶음. 고른 탭 아래 선이 따라 움직여요.',
    fit: '오전/오후 일정, 초급/심화 실습처럼 같은 꼴의 내용을 나눠 보여 줄 때.',
    tech: 'role="tablist"·tab·tabpanel + 화살표 키 이동 + 밑줄 표시 transform 이동',
    tags: ['탭', 'tablist', '접근성', '전환'],
    f: SANS,
    css: `${BODY}
.w{position:absolute;inset:6vmin 6vmin}
.tl{display:flex;gap:4vmin;border-bottom:1px solid #ddd;position:relative}
.tl button{background:none;border:0;padding:1.6vmin 0;font-size:3vmin;color:#888;cursor:pointer}
.tl button[aria-selected=true]{color:#111;font-weight:700}
.ul{position:absolute;bottom:-1px;height:.6vmin;background:#3d5afe;border-radius:1vmin;transition:left .35s cubic-bezier(.2,.8,.2,1),width .35s cubic-bezier(.2,.8,.2,1)}
.pn{padding:3.6vmin 0;font-size:2.9vmin;line-height:1.7;animation:in .35s both}
@keyframes in{from{opacity:0;transform:translateY(1.4vmin)}}
.pn b{display:block;font-size:4.2vmin;margin-bottom:1vmin}`,
    html: `<div class="w"><div class="tl" role="tablist"><button role="tab" aria-selected="true">초급</button><button role="tab" aria-selected="false">중급</button><button role="tab" aria-selected="false">심화</button><i class="ul"></i></div><div class="pn" role="tabpanel"></div></div>`,
    js: `var T=[['예시 그대로 따라 하기','복사 버튼으로 원문을 가져와 AI에 붙여 넣어요.'],['조건 하나 바꿔 보기','대상과 분량을 바꾸고 결과를 비교해요.'],['나만의 프롬프트 만들기','역할·상황·과제·형식을 직접 채워요.']],bs=document.querySelectorAll('.tl button'),ul=document.querySelector('.ul'),pn=document.querySelector('.pn'),k=0;function go(i){k=i;bs.forEach(function(b,j){b.setAttribute('aria-selected',i===j)});ul.style.left=bs[i].offsetLeft+'px';ul.style.width=bs[i].offsetWidth+'px';pn.innerHTML='<b>'+T[i][0]+'</b>'+T[i][1];pn.style.animation='none';pn.offsetWidth;pn.style.animation=''}bs.forEach(function(b,i){b.onclick=function(){go(i)}});go(0);if(!RM)setInterval(function(){go((k+1)%3)},2200);`,
  },
  {
    id: 'accordion', ko: '아코디언', en: 'Accordion',
    desc: '제목만 늘어놓고 누르면 내용이 부드럽게 펼쳐지는 접이식 목록.',
    fit: '자주 묻는 질문, 실습 단계별 자세한 설명처럼 필요한 사람만 펼쳐 볼 내용.',
    tech: '<details>/<summary> + interpolate-size:allow-keywords와 ::details-content로 높이 애니메이션',
    tags: ['details', '접기', 'FAQ', '최신 기능'],
    f: SANS,
    css: `${BODY}:root{interpolate-size:allow-keywords}
.w{position:absolute;inset:5vmin 6vmin;display:grid;gap:1.6vmin;align-content:start}
details{background:#fff;border-radius:2vmin;padding:0 3vmin;box-shadow:0 .4vmin 1.2vmin rgba(0,0,0,.06)}
summary{list-style:none;cursor:pointer;padding:2.6vmin 0;font-size:3vmin;font-weight:600;display:flex;justify-content:space-between;align-items:center}
summary::-webkit-details-marker{display:none}
summary::after{content:"+";font-size:4vmin;font-weight:400;transition:transform .3s}
details[open] summary::after{transform:rotate(45deg)}
details::details-content{block-size:0;overflow:hidden;transition:block-size .4s cubic-bezier(.2,.8,.2,1),content-visibility .4s allow-discrete}
details[open]::details-content{block-size:auto}
details p{margin:0;padding:0 0 2.6vmin;font-size:2.7vmin;color:#555;line-height:1.6}`,
    html: `<div class="w"><details open><summary>노트북이 없어도 되나요?</summary><p>휴대폰으로도 모든 실습을 할 수 있어요. 글이 길면 짝과 함께 노트북을 써요.</p></details><details><summary>실습 결과는 어디에 내나요?</summary><p>실습 쪽 아래 보드에 붙여요. 이름 대신 별명도 돼요.</p></details><details><summary>자료는 언제까지 볼 수 있나요?</summary><p>연수가 끝나고 한 달 동안 이 사이트에서 다운로드할 수 있어요.</p></details></div>`,
    js: `var ds=document.querySelectorAll('details'),k=0;if(!RM)setInterval(function(){k=(k+1)%ds.length;ds.forEach(function(d,i){d.open=i===k})},2200);`,
  },
  {
    id: 'timeline', ko: '타임라인', en: 'Timeline',
    desc: '세로 선 위에 시간 순서대로 점과 내용을 놓는 목록. 지나간 것과 남은 것이 갈려요.',
    fit: '하루 일정·여러 차시 과정·과제 마감처럼 순서가 중요한 정보.',
    tech: '세로 선(::before) + 점 + 지난 항목/지금/남은 항목 상태 색 + 지금 점의 맥박 애니메이션',
    tags: ['순서', '일정', '세로 선', '상태'],
    f: SANS,
    css: `${BODY}
.w{position:absolute;inset:4vmin 7vmin;display:grid;align-content:center}
ol{list-style:none;margin:0;padding:0 0 0 6vmin;position:relative}
ol::before{content:"";position:absolute;left:1.4vmin;top:1.6vmin;bottom:1.6vmin;width:.4vmin;background:linear-gradient(#1b1b1f 0 42%,#d6d3cc 42%)}
li{position:relative;padding:1.4vmin 0;font-size:2.9vmin;display:flex;gap:3vmin;color:#999}
li b{font-variant-numeric:tabular-nums;font-weight:600;width:9vmin}
li::before{content:"";position:absolute;left:-5.6vmin;top:2.2vmin;width:2.4vmin;height:2.4vmin;border-radius:50%;background:#d6d3cc;border:.5vmin solid #f5f4f1}
li.d{color:#1b1b1f}li.d::before{background:#1b1b1f}
li.n{color:#1b1b1f;font-weight:700}li.n::before{background:#ff5a3c;box-shadow:0 0 0 0 rgba(255,90,60,.6);animation:pu 1.6s infinite}
li.n span::after{content:"지금";margin-left:1.6vmin;font-size:2.2vmin;background:#ff5a3c;color:#fff;padding:.3vmin 1.4vmin;border-radius:9px}
@keyframes pu{70%{box-shadow:0 0 0 2.4vmin rgba(255,90,60,0)}}`,
    html: `<div class="w"><ol><li class="d"><b>13:00</b><span>여는 말</span></li><li class="d"><b>13:15</b><span>사례 보기</span></li><li class="n"><b>13:50</b><span>실습 1</span></li><li><b>14:40</b><span>쉬는 시간</span></li><li><b>14:50</b><span>실습 2</span></li><li><b>15:40</b><span>마무리</span></li></ol></div>`,
  },
  {
    id: 'stepper', ko: '단계 표시', en: 'Stepper',
    desc: '전체 몇 단계 중 지금 어디인지 번호와 선으로 보여 주는 진행 표시.',
    fit: '실습을 단계로 나눠 따라 하게 할 때, 제출 같은 여러 단계 흐름.',
    tech: '번호 원 + 잇는 선(채워지는 너비) + 끝난 단계 ✓ + aria-current="step"',
    tags: ['단계', '진행', '번호', '실습'],
    f: SANS,
    css: `${BODY}
.w{position:absolute;inset:0;display:grid;place-content:center;gap:5vmin;padding:0 6vmin}
.st{display:grid;grid-template-columns:repeat(4,1fr);position:relative}
.ln{position:absolute;left:12.5%;right:12.5%;top:3.4vmin;height:.6vmin;background:#dcd9d2}
.ln i{display:block;height:100%;background:#2b59ff;width:0;transition:width .6s cubic-bezier(.2,.8,.2,1)}
.s{position:relative;display:grid;justify-items:center;gap:1.4vmin;font-size:2.5vmin;color:#999}
.s b{width:7.4vmin;height:7.4vmin;border-radius:50%;display:grid;place-items:center;background:#fff;border:.5vmin solid #dcd9d2;font-size:3vmin;color:#999;transition:all .35s}
.s.d b{background:#2b59ff;border-color:#2b59ff;color:#fff}.s.n b{border-color:#2b59ff;color:#2b59ff;transform:scale(1.12);box-shadow:0 0 0 1.4vmin rgba(43,89,255,.15)}
.s.d,.s.n{color:#1b1b1f}
.now{text-align:center;font-size:3.6vmin;font-weight:700}`,
    html: `<div class="w"><div class="st"><div class="ln"><i></i></div><div class="s"><b>1</b>교재 열기</div><div class="s"><b>2</b>질문 쓰기</div><div class="s"><b>3</b>짝과 바꾸기</div><div class="s"><b>4</b>보드에 붙이기</div></div><p class="now"></p></div>`,
    js: `var ss=document.querySelectorAll('.s'),ln=document.querySelector('.ln i'),now=document.querySelector('.now'),k=1;function go(i){ss.forEach(function(s,j){s.className='s'+(j<i?' d':j===i?' n':'');s.querySelector('b').textContent=j<i?'✓':j+1});ln.style.width=(i/3*100)+'%';now.textContent=(i+1)+'/4 · '+ss[i].textContent.replace(/^./,'')}go(k);if(!RM)setInterval(function(){k=(k+1)%4;go(k)},1600);`,
  },
  {
    id: 'carousel', ko: '캐러셀', en: 'Carousel',
    desc: '여러 장을 한 자리에서 차례로 넘겨 보는 슬라이드. 점으로 위치를 알려 줘요.',
    fit: '참가자 작품, 사례 사진, 오늘의 명언처럼 한 장씩 보여 줄 것들.',
    tech: 'scroll-snap 가로 띠 + 앞/뒤 버튼 scrollBy + 점 표시 + 저절로 넘김(손대면 멈춤, 움직임 줄이기면 끔)',
    tags: ['슬라이드', '넘기기', '점', 'snap'],
    f: ['Gowun Batang:wght@700'],
    css: `body{background:#111;color:#fff}
.vp{position:absolute;inset:0;display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;scrollbar-width:none}.vp::-webkit-scrollbar{display:none}
.sl{flex:0 0 100%;scroll-snap-align:start;display:grid;place-content:end start;padding:7vmin;font:700 6vmin/1.3 'Gowun Batang',serif}
.sl small{font:2.4vmin system-ui;opacity:.8;margin-top:1.4vmin}
.nv{position:absolute;right:5vmin;bottom:5vmin;display:flex;gap:1.4vmin}
.nv button{width:7vmin;height:7vmin;border-radius:50%;border:1px solid rgba(255,255,255,.5);background:rgba(0,0,0,.25);color:#fff;font-size:3vmin;cursor:pointer}
.dt{position:absolute;left:7vmin;top:6vmin;display:flex;gap:1vmin}.dt i{width:6vmin;height:.6vmin;background:rgba(255,255,255,.3);border-radius:1vmin;overflow:hidden}.dt i.on::after{content:"";display:block;height:100%;background:#fff;animation:pr 3s linear}
@keyframes pr{from{width:0}to{width:100%}}`,
    html: `<div class="vp"><div class="sl" style="background:linear-gradient(160deg,#355c7d,#6c5b7b)">배운 것을 가르쳐 볼 때<br>비로소 내 것이 돼요<small>3모둠 소감</small></div><div class="sl" style="background:linear-gradient(160deg,#c06c84,#f67280)">질문 하나가<br>한 시간을 바꿔요<small>1모둠 소감</small></div><div class="sl" style="background:linear-gradient(160deg,#2a9d8f,#264653)">처음엔 어려웠지만<br>짝 덕분에 끝냈어요<small>5모둠 소감</small></div></div><div class="dt"><i class="on"></i><i></i><i></i></div><div class="nv"><button aria-label="이전">←</button><button aria-label="다음">→</button></div>`,
    js: `var vp=document.querySelector('.vp'),ds=document.querySelectorAll('.dt i'),bs=document.querySelectorAll('.nv button'),k=0,t;function go(i){k=(i+3)%3;vp.scrollTo({left:k*vp.clientWidth});ds.forEach(function(d,j){d.classList.toggle('on',j===k);if(j===k){d.classList.remove('on');d.offsetWidth;d.classList.add('on')}})}bs[0].onclick=function(){go(k-1);loop()};bs[1].onclick=function(){go(k+1);loop()};function loop(){clearInterval(t);if(!RM)t=setInterval(function(){go(k+1)},3000)}loop();`,
  },
  {
    id: 'modal', ko: '모달 대화상자', en: 'Modal Dialog',
    desc: '뒤를 흐리게 덮고 꼭 확인할 한 가지만 앞에 띄우는 창.',
    fit: '제출 확인, 쉬는 시간 알림처럼 참가자가 반드시 보고 넘어가야 할 순간에만.',
    tech: '<dialog>.showModal() + ::backdrop 흐림 + @starting-style로 열릴 때 커지며 나타남',
    tags: ['dialog', '확인', 'backdrop', '@starting-style'],
    f: SANS,
    css: `${BODY}
.pg{position:absolute;inset:5vmin;display:grid;gap:2vmin;align-content:start}.pg i{height:6vmin;border-radius:1.4vmin;background:#e5e2db}.pg i:first-child{height:12vmin}
dialog{border:0;border-radius:3vmin;padding:4vmin;width:min(76vmin,86%);box-shadow:0 3vmin 8vmin rgba(0,0,0,.3);font-family:inherit;opacity:1;transform:none;transition:opacity .3s,transform .4s cubic-bezier(.2,1.2,.3,1),overlay .3s allow-discrete,display .3s allow-discrete}
@starting-style{dialog[open]{opacity:0;transform:scale(.9) translateY(2vmin)}}
dialog::backdrop{background:rgba(20,20,30,.35);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
dialog h3{margin:0 0 1.4vmin;font-size:4vmin}dialog p{margin:0 0 3vmin;font-size:2.7vmin;color:#555}
.r{display:flex;gap:1.6vmin;justify-content:flex-end}.r button{border:1px solid #ccc;background:#fff;border-radius:1.4vmin;padding:1.4vmin 3vmin;font-size:2.6vmin;cursor:pointer}.r button.p{background:#1b1b1f;color:#fff;border-color:#1b1b1f}
.op{position:absolute;left:50%;bottom:6vmin;transform:translateX(-50%);border:0;background:#1b1b1f;color:#fff;border-radius:99px;padding:1.6vmin 4vmin;font-size:2.8vmin;cursor:pointer}`,
    html: `<div class="pg"><i></i><i></i><i></i><i></i></div><button class="op">과제 제출</button><dialog><h3>과제를 제출할까요?</h3><p>제출한 뒤에도 금요일까지 수정할 수 있어요.</p><div class="r"><button>취소</button><button class="p">제출</button></div></dialog>`,
    js: `var d=document.querySelector('dialog');document.querySelector('.op').onclick=function(){d.showModal()};d.querySelectorAll('button').forEach(function(b){b.onclick=function(){d.close()}});if(!RM){setTimeout(function(){d.showModal()},600);setInterval(function(){if(d.open)d.close();else d.showModal()},2400)}else d.show();`,
  },
  {
    id: 'toast', ko: '토스트 알림', en: 'Toast Notification',
    desc: '화면 한쪽에 잠깐 떴다 사라지는 짧은 알림. 하던 일을 막지 않아요.',
    fit: '복사했어요·제출했어요·새 질문이 왔어요 같은 가벼운 확인.',
    tech: 'aria-live="polite" 영역 + 아래에서 올라오는 등장(transform) + 몇 초 뒤 저절로 사라짐 + 쌓이면 밀어 올림',
    tags: ['알림', 'aria-live', '확인', '쌓기'],
    f: SANS,
    css: `${BODY}
.st{position:absolute;left:50%;bottom:5vmin;transform:translateX(-50%);display:flex;flex-direction:column-reverse;gap:1.6vmin;width:min(70vmin,88%)}
.t{display:flex;align-items:center;gap:2vmin;background:#1b1b1f;color:#fff;border-radius:2vmin;padding:2vmin 2.6vmin;font-size:2.7vmin;box-shadow:0 1.4vmin 3vmin rgba(0,0,0,.25);animation:in .45s cubic-bezier(.2,1.3,.3,1) both}
.t i{width:4.4vmin;height:4.4vmin;border-radius:50%;display:grid;place-items:center;font-style:normal;font-size:2.4vmin;flex:none}
.t.out{animation:out .35s ease-in forwards}
@keyframes in{from{opacity:0;transform:translateY(4vmin) scale(.96)}}
@keyframes out{to{opacity:0;transform:translateY(2vmin) scale(.96)}}
.bg{position:absolute;inset:5vmin;display:grid;gap:2vmin;align-content:start}.bg i{height:6vmin;border-radius:1.4vmin;background:#e5e2db}`,
    html: `<div class="bg"><i></i><i></i><i></i></div><div class="st" aria-live="polite"></div>`,
    js: `var M=[['#2ecc71','✓','프롬프트를 복사했어요'],['#3d7bff','?','새 질문이 왔어요 (2)'],['#ff9f1c','!','쉬는 시간이 5분 남았어요']],st=document.querySelector('.st'),k=0;function add(){var m=M[k++%3],t=document.createElement('div');t.className='t';t.innerHTML='<i style="background:'+m[0]+'">'+m[1]+'</i>'+m[2];st.appendChild(t);setTimeout(function(){t.classList.add('out');setTimeout(function(){t.remove()},400)},RM?99999:3400)}add();if(!RM)setInterval(add,1300);else{add();add()}`,
  },
  {
    id: 'card', ko: '카드', en: 'Card',
    desc: '그림·제목·설명·동작을 한 덩어리로 묶은 부품. 덩어리 전체가 눌리는 곳이 돼요.',
    fit: '자료·실습·사례 하나하나를 묶어 보여 줄 때. 같은 카드만 늘어놓는 건 피해요.',
    tech: '카드 전체를 링크로(::after 늘리기) + 위에 올리면 살짝 떠오름 + 그림 확대(overflow:hidden)',
    tags: ['카드', '묶음', 'hover', '링크'],
    f: SANS,
    ptr: true,
    css: `${BODY}
.c2{position:absolute;inset:0;display:grid;place-items:center}
.cd{width:min(64vmin,80%);background:#fff;border-radius:3vmin;overflow:hidden;box-shadow:0 .6vmin 1.6vmin rgba(0,0,0,.07);transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s;position:relative}
.cd.h{transform:translateY(-1.6vmin);box-shadow:0 3vmin 6vmin rgba(0,0,0,.16)}
.im{height:24vmin;background:radial-gradient(circle at 70% 30%,#ffe29a,transparent 40%),linear-gradient(135deg,#7f7fd5,#86a8e7,#91eae4);transition:transform .6s cubic-bezier(.2,.8,.2,1)}
.cd.h .im{transform:scale(1.06)}
.bd{padding:3vmin}.bd small{color:#ff5a3c;font-weight:700;font-size:2.3vmin}.bd b{display:block;font-size:3.8vmin;margin:.8vmin 0}.bd p{margin:0;color:#666;font-size:2.5vmin}
.ar{position:absolute;right:3vmin;bottom:3vmin;font-size:3.4vmin;transition:transform .35s}.cd.h .ar{transform:translateX(1vmin)}`,
    html: `<div class="c2"><div class="cd"><div class="im"></div><div class="bd"><small>사례 3</small><b>질문 카드로 연 국어 수업</b><p>교재 14쪽 · 20분 활동</p></div><span class="ar">→</span></div></div>`,
    js: `var c=document.querySelector('.cd');ghost(document.body,function(x,y,real){var r=c.getBoundingClientRect(),W=innerWidth,H=innerHeight,px=x*W,py=y*H;c.classList.toggle('h',real?(px>r.left&&px<r.right&&py>r.top&&py<r.bottom):Math.sin(performance.now()/900)>0)});`,
  },
  {
    id: 'data-table', ko: '데이터 표', en: 'Data Table',
    desc: '줄과 칸으로 정리한 표. 머리 고정, 고정폭 숫자, 정렬 표시로 읽기 쉽게.',
    fit: '모둠 편성·점수·출석 현황처럼 비교해 볼 숫자가 있을 때.',
    tech: '세로줄 없는 가는 가로줄 + thead position:sticky + tabular-nums 오른쪽 정렬 + 정렬 표시',
    tags: ['표', '숫자', 'sticky', '정렬'],
    f: SANS,
    css: `${BODY}
.w{position:absolute;inset:5vmin;background:#fff;border-radius:2.4vmin;overflow:hidden;box-shadow:0 .4vmin 1.6vmin rgba(0,0,0,.06)}
table{width:100%;border-collapse:collapse;font-size:2.7vmin}
th{text-align:left;font-weight:600;color:#888;font-size:2.3vmin;padding:2vmin 2.6vmin;border-bottom:1px solid #e5e2db;background:#faf9f7;position:sticky;top:0;cursor:pointer;user-select:none}
th.on{color:#111}th.on::after{content:" ↓";color:#3d5afe}
td{padding:1.8vmin 2.6vmin;border-bottom:1px solid #f0eee9}
td.n{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}th.n{text-align:right}
tr{transition:background .2s}tbody tr:hover{background:#f7f6ff}
.b{display:inline-block;width:1.6vmin;height:1.6vmin;border-radius:50%;margin-right:1.2vmin}`,
    html: `<div class="w"><table><thead><tr><th>모둠</th><th class="n on">질문</th><th class="n">투표</th><th class="n">출석</th></tr></thead><tbody></tbody></table></div>`,
    js: `var D=[['1모둠','#ff6b6b',12,8,6],['2모둠','#4ecdc4',9,11,6],['3모둠','#ffd93d',15,7,5],['4모둠','#6c5ce7',7,12,6],['5모둠','#2ecc71',11,9,6]],tb=document.querySelector('tbody'),ths=document.querySelectorAll('th'),col=1;function draw(){var s=D.slice().sort(function(a,b){return b[col+1]-a[col+1]});tb.innerHTML=s.map(function(r){return '<tr><td><i class="b" style="background:'+r[1]+'"></i>'+r[0]+'</td><td class="n">'+r[2]+'</td><td class="n">'+r[3]+'</td><td class="n">'+r[4]+'</td></tr>'}).join('');ths.forEach(function(t,i){t.classList.toggle('on',i===col)})}ths.forEach(function(t,i){if(i)t.onclick=function(){col=i;draw()}});draw();if(!RM)setInterval(function(){col=col%3+1;draw()},2200);`,
  },
  {
    id: 'badge', ko: '배지·상태 표시', en: 'Badge / Status Indicator',
    desc: '작은 꼬리표로 상태·개수·분류를 알려 주는 표시. 색과 글자를 함께 써요.',
    fit: '진행 중·마감·새 질문 수처럼 한눈에 알아야 할 상태. 남발하면 효과가 사라져요.',
    tech: '작은 둥근 꼬리표 + 상태 점(진행 중은 깜빡임) + 색만으로 구분하지 않게 글자 함께',
    tags: ['꼬리표', '상태', '개수', '색'],
    f: SANS,
    css: `${BODY}
.w{position:absolute;inset:0;display:grid;place-content:center;gap:2.4vmin}
.r{display:flex;align-items:center;justify-content:space-between;gap:4vmin;background:#fff;border-radius:2vmin;padding:2.2vmin 3vmin;min-width:66vmin;font-size:2.9vmin;box-shadow:0 .4vmin 1.2vmin rgba(0,0,0,.05)}
.bd{display:inline-flex;align-items:center;gap:1vmin;font-size:2.3vmin;font-weight:600;padding:.6vmin 1.8vmin;border-radius:99px}
.bd i{width:1.4vmin;height:1.4vmin;border-radius:50%;background:currentColor}
.live{background:#e8f7ee;color:#18794e}.live i{animation:bl 1.2s infinite}@keyframes bl{50%{opacity:.2}}
.soon{background:#fff4e0;color:#a35a00}.done{background:#eeeeee;color:#666}
.ct{min-width:3.6vmin;height:3.6vmin;border-radius:99px;background:#ff3b30;color:#fff;font-size:2.2vmin;font-weight:700;display:inline-grid;place-items:center;padding:0 1vmin;animation:pop .5s cubic-bezier(.3,1.8,.5,1)}
@keyframes pop{from{transform:scale(0)}}`,
    html: `<div class="w"><div class="r">실습 2 · 프롬프트 다듬기<span class="bd live"><i></i>진행 중</span></div><div class="r">과제 1 제출<span class="bd soon"><i></i>오늘 마감</span></div><div class="r">출석 확인<span class="bd done"><i></i>끝남</span></div><div class="r">질문 게시판<span class="ct">3</span></div></div>`,
    js: `var c=document.querySelector('.ct'),n=3;if(!RM)setInterval(function(){n=n>8?3:n+1;c.textContent=n;c.style.animation='none';c.offsetWidth;c.style.animation=''},1500);`,
  },
  {
    id: 'buttons', ko: '버튼 위계', en: 'Button Hierarchy',
    desc: '주요·보조·조용한·위험 버튼을 생김새로 구분해 무엇을 먼저 누를지 분명하게.',
    fit: '화면마다 누를 곳 하나를 또렷하게: 출석·제출은 주요, 나머지는 보조로.',
    tech: '주요=채운 색, 보조=테두리, 조용한=글자만, 위험=빨간 글자 + :focus-visible 고리 + 누를 때 살짝 눌림',
    tags: ['버튼', '위계', 'focus-visible', '상태'],
    f: SANS,
    css: `${BODY}
.w{position:absolute;inset:0;display:grid;place-content:center;gap:3vmin;justify-items:start}
.r{display:flex;gap:2vmin;flex-wrap:wrap;align-items:center}
button{font:600 2.9vmin 'IBM Plex Sans KR',sans-serif;border-radius:1.6vmin;padding:1.8vmin 3.4vmin;cursor:pointer;border:1px solid transparent;transition:transform .1s,background .2s,box-shadow .2s}
button:active,button.pr{transform:scale(.96)}
.p{background:#1f3fff;color:#fff;box-shadow:0 .6vmin 1.6vmin rgba(31,63,255,.3)}.p:hover{background:#1530d8}
.s{background:#fff;border-color:#cfcbc2;color:#1b1b1f}.q{background:none;color:#555}.q:hover{background:#ebe9e4}
.d{background:#fff;border-color:#f3c1bd;color:#c62f22}
.f{outline:.5vmin solid #1f3fff;outline-offset:.6vmin}
.ld{position:relative;color:transparent!important}.ld::after{content:"";position:absolute;left:50%;top:50%;width:3vmin;height:3vmin;margin:-1.5vmin;border:.5vmin solid rgba(255,255,255,.5);border-top-color:#fff;border-radius:50%;animation:sp .7s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}
small{font-size:2.2vmin;color:#888}`,
    html: `<div class="w"><small>주요 · 보조 · 조용한</small><div class="r"><button class="p">출석하기</button><button class="s">자료 보기</button><button class="q">나중에</button></div><small>위험 · 키보드 초점 · 처리 중</small><div class="r"><button class="d">제출 취소</button><button class="s f">초점</button><button class="p ld">제출</button></div></div>`,
    js: `var p=document.querySelector('.p');if(!RM)setInterval(function(){p.classList.add('pr');setTimeout(function(){p.classList.remove('pr')},150)},1400);`,
  },
  {
    id: 'form', ko: '입력 폼', en: 'Form Fields',
    desc: '칸 이름이 위로 올라가는 입력칸, 분명한 초점, 바로 알려 주는 확인 문구.',
    fit: '질문·소감·과제 링크처럼 참가자가 직접 적는 곳.',
    tech: ':placeholder-shown으로 떠오르는 이름표 + :focus 고리 + :user-invalid 오류 표시 + 글자 수 세기',
    tags: ['입력', 'label', '검증', ':user-invalid'],
    f: SANS,
    css: `${BODY}
.w{position:absolute;inset:0;display:grid;place-content:center;gap:3vmin;width:min(76vmin,86%);margin:auto}
.fd{position:relative}
.fd input,.fd textarea{width:100%;font:2.9vmin 'IBM Plex Sans KR',sans-serif;padding:3.8vmin 2.6vmin 1.4vmin;border:1px solid #cfcbc2;border-radius:1.8vmin;background:#fff;outline:none;transition:border-color .2s,box-shadow .2s;resize:none}
.fd label{position:absolute;left:2.7vmin;top:2.7vmin;font-size:2.9vmin;color:#888;transition:all .2s;pointer-events:none}
.fd input:focus,.fd textarea:focus{border-color:#1f3fff;box-shadow:0 0 0 .8vmin rgba(31,63,255,.12)}
.fd input:focus+label,.fd input:not(:placeholder-shown)+label,.fd textarea:focus+label,.fd textarea:not(:placeholder-shown)+label{top:1vmin;font-size:2.1vmin;color:#1f3fff}
.fd input:user-invalid{border-color:#d92d20}.er{display:none;color:#d92d20;font-size:2.2vmin;margin-top:.8vmin}.fd input:user-invalid~.er{display:block}
.ct{position:absolute;right:2.4vmin;bottom:1.4vmin;font-size:2vmin;color:#999}`,
    html: `<div class="w"><div class="fd"><input id="a" placeholder=" " required minlength="2"><label for="a">별명</label><p class="er">두 글자 이상 적어 주세요.</p></div><div class="fd"><textarea id="b" rows="3" placeholder=" " maxlength="80"></textarea><label for="b">오늘 가장 기억에 남는 것</label><span class="ct">0/80</span></div></div>`,
    js: `var ta=document.querySelector('textarea'),ct=document.querySelector('.ct'),inp=document.querySelector('input');ta.oninput=function(){ct.textContent=ta.value.length+'/80'};var S='질문을 먼저 쓰는 습관',i=0;if(!RM){setTimeout(function(){inp.value='해';inp.focus()},500);setTimeout(function(){inp.value='해바라기';ta.focus();var t=setInterval(function(){ta.value=S.slice(0,++i);ta.oninput();if(i>=S.length)clearInterval(t)},120)},1400)}`,
  },
  {
    id: 'switch-segmented', ko: '스위치·세그먼트', en: 'Switch & Segmented Control',
    desc: '켜고 끄는 스위치와, 몇 가지 중 하나를 고르는 붙은 버튼 묶음.',
    fit: '글자 크게·어둡게 보기 같은 보기 설정, 오전/오후 고르기.',
    tech: 'role="switch" aria-checked + 미끄러지는 손잡이(스프링 곡선) + 고른 칸 뒤 배경이 따라 이동',
    tags: ['스위치', '토글', '세그먼트', '설정'],
    f: SANS,
    css: `${BODY}
.w{position:absolute;inset:0;display:grid;place-content:center;gap:4vmin;min-width:60vmin}
.row{display:flex;justify-content:space-between;align-items:center;gap:6vmin;font-size:3vmin}
.sw{width:11vmin;height:6.4vmin;border-radius:99px;background:#d8d5ce;border:0;position:relative;cursor:pointer;transition:background .25s}
.sw i{position:absolute;left:.8vmin;top:.8vmin;width:4.8vmin;height:4.8vmin;border-radius:50%;background:#fff;box-shadow:0 .4vmin 1vmin rgba(0,0,0,.2);transition:left .35s cubic-bezier(.3,1.5,.5,1)}
.sw[aria-checked=true]{background:#34c759}.sw[aria-checked=true] i{left:5.4vmin}
.sg{position:relative;display:grid;grid-template-columns:repeat(3,1fr);background:#e7e5e0;border-radius:1.8vmin;padding:.8vmin}
.sg button{position:relative;z-index:1;border:0;background:none;padding:1.4vmin 2vmin;font-size:2.7vmin;cursor:pointer;color:#666}
.sg button[aria-pressed=true]{color:#111;font-weight:600}
.sg span{position:absolute;top:.8vmin;bottom:.8vmin;left:.8vmin;width:calc((100% - 1.6vmin)/3);background:#fff;border-radius:1.2vmin;box-shadow:0 .4vmin 1vmin rgba(0,0,0,.12);transition:transform .35s cubic-bezier(.3,1.3,.5,1)}`,
    html: `<div class="w"><div class="row">글자 크게<button class="sw" role="switch" aria-checked="false"><i></i></button></div><div class="row">어둡게 보기<button class="sw" role="switch" aria-checked="true"><i></i></button></div><div class="sg"><span></span><button aria-pressed="true">오전</button><button aria-pressed="false">오후</button><button aria-pressed="false">전체</button></div></div>`,
    js: `var sws=document.querySelectorAll('.sw'),bs=document.querySelectorAll('.sg button'),sp=document.querySelector('.sg span'),k=0;sws.forEach(function(s){s.onclick=function(){s.setAttribute('aria-checked',s.getAttribute('aria-checked')!=='true')}});function go(i){k=i;bs.forEach(function(b,j){b.setAttribute('aria-pressed',i===j)});sp.style.transform='translateX('+(i*100)+'%)'}bs.forEach(function(b,i){b.onclick=function(){go(i)}});if(!RM)setInterval(function(){sws[0].click();go((k+1)%3)},1500);`,
  },
  {
    id: 'progress', ko: '진행 표시', en: 'Progress Bar & Ring',
    desc: '얼마나 왔는지를 막대·고리로 보여 주는 표시. 숫자를 함께 써요.',
    fit: '실습 진행률, 설문 응답 수, 남은 시간처럼 끝을 향해 가는 값.',
    tech: '<progress>/role="progressbar" + conic-gradient 고리(@property로 각도 애니메이션) + tabular-nums 숫자',
    tags: ['진행률', '고리', '@property', '막대'],
    f: SANS,
    css: `${BODY}@property --p{syntax:'<number>';inherits:true;initial-value:0}
.w{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:8vmin;--p:0;animation:go 4s cubic-bezier(.4,0,.2,1) infinite alternate}
@keyframes go{to{--p:78}}
.ring{width:34vmin;height:34vmin;border-radius:50%;background:conic-gradient(#3d5afe calc(var(--p)*1%),#e3e1dc 0);display:grid;place-items:center;position:relative}
.ring::before{content:"";position:absolute;inset:3vmin;border-radius:50%;background:#f5f4f1}
.ring b{position:relative;font-size:7vmin;font-variant-numeric:tabular-nums;counter-reset:p calc(var(--p));letter-spacing:-.03em}.ring b::before{content:counter(p)}
.ring small{position:absolute;bottom:9vmin;font-size:2.2vmin;color:#888}
.bars{display:grid;gap:3vmin;width:34vmin;font-size:2.5vmin}
.bar{height:1.6vmin;border-radius:9px;background:#e3e1dc;overflow:hidden}.bar i{display:block;height:100%;border-radius:inherit;width:calc(var(--p)*1%);background:#ff8a3d}
.bar.b i{width:calc(var(--p)*.8%);background:#21b07a}`,
    html: `<div class="w"><div class="ring"><b>%</b><small>실습 진행</small></div><div class="bars"><div>설문 응답<div class="bar"><i></i></div></div><div>과제 제출<div class="bar b"><i></i></div></div></div></div>`,
  },
  {
    id: 'popover', ko: '팝오버·툴팁', en: 'Popover / Tooltip',
    desc: '낱말 옆에 작은 말풍선을 띄워 뜻이나 도움말을 보여 주는 부품.',
    fit: '교재 속 어려운 용어 풀이, 버튼 옆 짧은 도움말.',
    tech: 'popover 속성 + popovertarget(스크립트 없이 열고 닫기) + 앵커 위치(anchor-name·position-anchor)',
    tags: ['popover', '용어 풀이', 'anchor', '최신 HTML'],
    f: ['Gowun Batang:wght@400;700'],
    css: `body{background:#faf7f0;color:#222;font-family:'Gowun Batang',serif}
.w{position:absolute;inset:0;display:grid;place-content:center;padding:0 8vmin}
p{font-size:4vmin;line-height:1.8;margin:0}
.t{anchor-name:--t;border:0;background:none;font:inherit;padding:0;color:#b23a2b;text-decoration:underline dotted;text-underline-offset:.6vmin;cursor:help}
[popover]{position-anchor:--t;inset:auto;top:anchor(bottom);left:anchor(center);translate:-50% 1.6vmin;margin:0;border:0;border-radius:1.8vmin;padding:2vmin 2.6vmin;width:46vmin;background:#222;color:#fff;font:2.6vmin/1.5 system-ui;box-shadow:0 1.6vmin 3vmin rgba(0,0,0,.25);opacity:1;transition:opacity .25s,translate .3s,display .25s allow-discrete,overlay .25s allow-discrete}
@starting-style{[popover]:popover-open{opacity:0;translate:-50% 3vmin}}
[popover] b{display:block;color:#ffd27a;margin-bottom:.4vmin}`,
    html: `<div class="w"><p>좋은 질문은 <button class="t" popovertarget="pv">발문</button>에서 시작해요. 답을 묻기보다 생각을 묻는 질문이에요.</p></div><div id="pv" popover><b>발문(發問)</b>수업에서 교사가 학생의 생각을 끌어내려고 던지는 질문.</div>`,
    js: `var pv=document.getElementById('pv');if(pv.showPopover){if(!CSS.supports('top','anchor(bottom)')){pv.style.position='fixed';pv.style.top='62%';pv.style.left='50%'}if(!RM)setInterval(function(){pv.togglePopover()},1800);setTimeout(function(){try{pv.showPopover()}catch(e){}},400)}`,
  },
  {
    id: 'bottom-sheet', ko: '바텀 시트', en: 'Bottom Sheet',
    desc: '휴대폰 화면 아래에서 올라오는 판. 엄지가 닿는 곳에 고를 것을 모아요.',
    fit: '휴대폰에서 질문 쓰기·자료 고르기처럼 잠깐 꺼내 쓰는 도구.',
    tech: '아래 고정 판 + translateY 등장 + 끌 손잡이 + 뒤 흐림 + env(safe-area-inset-bottom)',
    tags: ['휴대폰', '시트', '엄지', '아래'],
    f: SANS,
    css: `${BODY}body{background:#222}
.ph{position:absolute;left:50%;top:4vmin;bottom:-6vmin;width:56vmin;margin-left:-28vmin;border-radius:5vmin 5vmin 0 0;background:#f5f4f1;overflow:hidden;border:1vmin solid #000;border-bottom:0}
.ct{padding:6vmin 4vmin;display:grid;gap:2vmin}.ct i{height:7vmin;border-radius:1.6vmin;background:#e4e1da}.ct i:first-child{height:14vmin;background:#c9d6ff}
.dim{position:absolute;inset:0;background:rgba(0,0,0,.35);opacity:0;transition:opacity .4s}
.sh{position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:4vmin 4vmin 0 0;padding:2vmin 4vmin 9vmin;transform:translateY(100%);transition:transform .5s cubic-bezier(.2,1,.3,1);box-shadow:0 -1vmin 4vmin rgba(0,0,0,.2)}
.on .dim{opacity:1}.on .sh{transform:none}
.hd{width:9vmin;height:1vmin;border-radius:9px;background:#d0cdc6;margin:0 auto 2.4vmin}
.sh b{font-size:3.2vmin}.sh button{display:block;width:100%;margin-top:1.6vmin;text-align:left;border:1px solid #e4e1da;background:#fff;border-radius:1.6vmin;padding:2vmin;font-size:2.7vmin}`,
    html: `<div class="ph"><div class="ct"><i></i><i></i><i></i><i></i></div><div class="dim"></div><div class="sh"><div class="hd"></div><b>무엇을 할까요?</b><button>질문 쓰기</button><button>교재 보기</button><button>도움 요청</button></div></div>`,
    js: `var ph=document.querySelector('.ph');if(RM)ph.classList.add('on');else setInterval(function(){ph.classList.toggle('on')},1800);setTimeout(function(){ph.classList.add('on')},300);`,
  },
  {
    id: 'empty-state', ko: '빈 화면 안내', en: 'Empty State',
    desc: '아직 아무것도 없을 때 무엇을 하면 되는지 그림 한 점과 버튼 하나로 알려 주는 화면.',
    fit: '질문 게시판·나눔 보드가 비어 있는 강의 시작 무렵.',
    tech: '작은 선화 + 한 줄 설명 + 첫 행동 버튼 하나 + 가볍게 숨 쉬는 그림',
    tags: ['빈 화면', '첫 행동', '선화', '안내'],
    f: SANS,
    css: `${BODY}
.w{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;text-align:center;gap:2vmin}
svg{width:30vmin;animation:fl 3s ease-in-out infinite}@keyframes fl{50%{transform:translateY(-1.6vmin)}}
svg *{fill:none;stroke:#1b1b1f;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.bub{fill:#fff3b0}
b{font-size:3.6vmin}p{margin:0;color:#777;font-size:2.6vmin}
button{margin-top:1.4vmin;background:#1b1b1f;color:#fff;border:0;border-radius:1.6vmin;padding:1.8vmin 3.6vmin;font-size:2.7vmin;cursor:pointer}`,
    html: `<div class="w"><svg viewBox="0 0 120 90"><path class="bub" d="M20 14 h70 a10 10 0 0 1 10 10 v28 a10 10 0 0 1 -10 10 h-46 l-14 12 v-12 h-10 a10 10 0 0 1 -10 -10 v-28 a10 10 0 0 1 10 -10z"/><path d="M48 32 q7 -8 14 0 q0 6 -7 9 v4 M55 52 v1"/><path d="M98 70 l8 8 M104 64 l8 2" opacity=".5"/></svg><b>아직 질문이 없어요</b><p>첫 질문을 남기면 강사 화면에 바로 떠요.</p><button>질문 쓰기</button></div>`,
  },
  {
    id: 'command-palette', ko: '검색 팔레트', en: 'Command Palette',
    desc: '한 칸에 적으면 쪽·자료·기능을 바로 찾아 이동하는 검색 창.',
    fit: '쪽과 자료가 많은 긴 과정 사이트에서 원하는 곳으로 바로 가기.',
    tech: '가운데 뜨는 검색 창 + 적는 대로 걸러지는 목록 + 위/아래 키로 고르고 Enter',
    tags: ['검색', '바로 가기', '키보드', '목록'],
    f: SANS,
    css: `${BODY}body{background:#dcd9d2}
.pl{position:absolute;left:50%;top:8vmin;width:min(76vmin,88%);transform:translateX(-50%);background:#fff;border-radius:2.6vmin;box-shadow:0 3vmin 7vmin rgba(0,0,0,.25);overflow:hidden}
.q{display:flex;align-items:center;gap:2vmin;padding:2.4vmin 3vmin;border-bottom:1px solid #eee;font-size:3.2vmin}
.q span{color:#999}.q b{font-weight:500}.q i{display:inline-block;width:.4vmin;height:3.6vmin;background:#3d5afe;animation:bl 1s steps(1) infinite;vertical-align:-.6vmin}@keyframes bl{50%{opacity:0}}
ul{list-style:none;margin:0;padding:1.4vmin}li{display:flex;justify-content:space-between;padding:1.6vmin 2vmin;border-radius:1.4vmin;font-size:2.8vmin}li small{color:#999}
li.on{background:#eef1ff;color:#2433b3}
kbd{font:2vmin ui-monospace,monospace;border:1px solid #ddd;border-radius:.8vmin;padding:.2vmin 1vmin;color:#888}`,
    html: `<div class="pl"><div class="q"><span>⌕</span><b class="t"></b><i></i><kbd style="margin-left:auto">Ctrl K</kbd></div><ul></ul></div>`,
    js: `var A=[['실습 1 · 질문 고르기','쪽'],['실습 2 · 프롬프트 다듬기','쪽'],['실습 자료 ZIP','자료'],['교재 12쪽','교재'],['질문 게시판','기능'],['설문','기능']],Q=['실습','실습 2','자료'],t=document.querySelector('.t'),ul=document.querySelector('ul'),qi=0,sel=0;function draw(q){var r=A.filter(function(a){return a[0].indexOf(q)>=0}).slice(0,4);ul.innerHTML=r.map(function(a,i){return '<li class="'+(i===sel?'on':'')+'">'+a[0]+'<small>'+a[1]+'</small></li>'}).join('')}function run(){var q=Q[qi++%Q.length],i=0;sel=0;var tm=setInterval(function(){t.textContent=q.slice(0,++i);draw(q.slice(0,i));if(i>=q.length){clearInterval(tm);setTimeout(function(){sel=1;draw(q)},500)}},180)}draw('');if(RM){t.textContent='실습';draw('실습')}else{run();setInterval(run,2800)}`,
  },
];
