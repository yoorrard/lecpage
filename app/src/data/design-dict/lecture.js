// ⑧ 강의 사이트 패턴: 강의 당일 참가자가 실제로 쓰는 화면 조각. lecpage의 참여 기능(data-lp)과 함께 쓰면 좋은 것들
const F = ['IBM Plex Sans KR:wght@400;600;700'];
const BODY = `body{background:#f6f4ef;color:#1c1b1a;font-family:'IBM Plex Sans KR',system-ui,sans-serif}`;

export default [
  {
    id: 'now-timeline', ko: "시간 막대와 '지금'", en: 'Proportional Agenda with Now Marker',
    desc: '하루 일정을 길이에 비례한 띠로 그리고, 지금 시각에 표시가 서 있어요. 쉬는 시간은 빗금.',
    fit: '모든 강의 사이트의 첫 화면 위쪽. 참가자가 지금 어디쯤인지 바로 알아요.',
    tech: 'flex-grow:분 수(길이 비례) + 쉬는 시간 repeating-linear-gradient 빗금 + 지금 표시 left:(지난 분/전체 분)%',
    tags: ['일정', '지금', '비례', '빗금'],
    f: F,
    css: `${BODY}
.w{position:absolute;inset:0;display:grid;align-content:center;padding:0 6vmin;gap:2.4vmin}
.hd{display:flex;justify-content:space-between;align-items:baseline}.hd b{font-size:4.4vmin;letter-spacing:-.03em}.hd span{font-size:2.6vmin;color:#777;font-variant-numeric:tabular-nums}
.bar{position:relative;display:flex;height:16vmin;gap:.6vmin}
.sg{border-radius:1.2vmin;padding:1.4vmin;font-size:2.3vmin;line-height:1.3;overflow:hidden;background:#e6e1d6;color:#4a463f}
.sg b{display:block;font-size:2.6vmin;color:#1c1b1a}
.sg.br{background:repeating-linear-gradient(-45deg,#e6e1d6 0 1vmin,#f6f4ef 1vmin 2vmin)}
.sg.dn{background:#cfc8b8}.sg.on{background:#1c1b1a;color:#ddd}.sg.on b{color:#fff}
.nw{position:absolute;top:-3vmin;bottom:-1.4vmin;width:0;border-left:.5vmin solid #ff5a1f;transition:left 1s linear}
.nw::before{content:"지금";position:absolute;top:-1vmin;left:-4.2vmin;background:#ff5a1f;color:#fff;font-size:2.1vmin;font-weight:700;padding:.3vmin 1.4vmin;border-radius:9px}
.tk{display:flex;justify-content:space-between;font:2.2vmin ui-monospace,monospace;color:#999}`,
    html: `<div class="w"><div class="hd"><b>오늘의 흐름</b><span class="ck">14:05</span></div><div class="bar"><div class="sg dn" style="flex:20"><b>여는 말</b>20분</div><div class="sg on" style="flex:50"><b>실습 1</b>질문 고르기</div><div class="sg br" style="flex:10"><b>쉼</b></div><div class="sg" style="flex:60"><b>실습 2</b>프롬프트 다듬기</div><div class="sg" style="flex:20"><b>마무리</b></div><i class="nw"></i></div><div class="tk"><span>13:30</span><span>14:20</span><span>15:30</span><span>16:10</span></div></div>`,
    js: `var nw=document.querySelector('.nw'),ck=document.querySelector('.ck'),sg=document.querySelectorAll('.sg'),m=35;function set(){nw.style.left=(m/160*100)+'%';var h=13*60+30+m;ck.textContent=Math.floor(h/60)+':'+String(h%60).padStart(2,'0');var acc=0,len=[20,50,10,60,20];sg.forEach(function(s,i){s.classList.remove('on','dn');if(m>=acc+len[i])s.classList.add('dn');else if(m>=acc)s.classList.add('on');acc+=len[i]})}set();if(!RM)setInterval(function(){m=m>=158?5:m+3;set()},700);`,
  },
  {
    id: 'practice-rail', ko: '실습 레일', en: 'Practice Steps Rail',
    desc: '실습을 번호 붙은 단계로 세로 선 위에 놓고, 단계마다 할 일 한 줄과 복사할 원문을 둬요.',
    fit: '모든 실습 쪽. 늦게 들어온 참가자도 지금 단계부터 따라올 수 있어요.',
    tech: '단계마다 <section data-lp-step> + 번호 원과 이어진 선 + 끝낸 단계 체크(이 기기에 저장) + 진행 채움',
    tags: ['실습', '단계', '체크', '진행'],
    f: F,
    css: `${BODY}
.w{position:absolute;inset:4vmin 6vmin;display:grid;align-content:center}
.st{display:grid;grid-template-columns:7vmin 1fr;gap:0 2.6vmin;position:relative}
.n{position:relative;display:flex;justify-content:center}
.n::after{content:"";position:absolute;top:6vmin;bottom:-1vmin;width:.5vmin;background:#ddd6c8}
.st:last-child .n::after{display:none}
.n b{position:relative;z-index:1;width:6vmin;height:6vmin;border-radius:50%;display:grid;place-items:center;background:#fff;border:.5vmin solid #ddd6c8;font-size:2.6vmin;transition:all .4s}
.st.dn .n b{background:#2f7d5b;border-color:#2f7d5b;color:#fff}.st.dn .n::after{background:#2f7d5b}
.st.on .n b{border-color:#1c1b1a;box-shadow:0 0 0 1.2vmin rgba(28,27,26,.08)}
.bd{padding:.8vmin 0 3vmin}.bd b{font-size:3.2vmin}.bd p{margin:.4vmin 0 0;font-size:2.4vmin;color:#777}
.cp{margin-top:1.2vmin;display:flex;align-items:center;gap:1.4vmin;background:#fff;border:1px solid #e5dfd3;border-radius:1.2vmin;padding:1.2vmin 1.6vmin;font:2.2vmin ui-monospace,monospace;color:#444}
.cp span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp i{font-style:normal;font-family:'IBM Plex Sans KR';font-weight:600;color:#1c1b1a}`,
    html: `<div class="w"><div class="st dn"><div class="n"><b>1</b></div><div class="bd"><b>교재 12쪽 펴기</b><p>교재 넘기기에서 강사를 따라가요</p></div></div><div class="st on"><div class="n"><b>2</b></div><div class="bd"><b>예시 프롬프트 붙여 넣기</b><div class="cp"><span>너는 중학교 과학 교사야. 1학년 첫 시간…</span><i>복사</i></div></div></div><div class="st"><div class="n"><b>3</b></div><div class="bd"><b>결과를 보드에 붙이기</b><p>가장 좋은 답 한 개만</p></div></div></div>`,
    js: `var ss=document.querySelectorAll('.st'),k=1;function go(){ss.forEach(function(s,i){s.classList.toggle('dn',i<k);s.classList.toggle('on',i===k);s.querySelector('.n b').textContent=i<k?'✓':i+1})}go();if(!RM)setInterval(function(){k=(k+1)%4;go()},1500);`,
  },
  {
    id: 'prompt-card', ko: '프롬프트 카드', en: 'Copyable Prompt Card',
    desc: '그대로 복사해 쓰는 원문과 복사 버튼. 바꿔 쓸 자리는 색으로 표시해요.',
    fit: 'AI·도구 실습에서 참가자가 손으로 옮겨 적지 않고 바로 붙여 넣게 할 때.',
    tech: '원문은 <pre>/고정폭 + 바꿀 자리 <mark> + 복사 버튼 data-copy-text + 누르면 "복사했어요" 확인',
    tags: ['복사', '프롬프트', '원문', '실습'],
    f: ['IBM Plex Sans KR:wght@400;700', 'IBM Plex Mono:wght@400'],
    css: `${BODY}body{background:#eceae4}
.cd{position:absolute;inset:6vmin;background:#fff;border-radius:2.6vmin;box-shadow:0 1vmin 3vmin rgba(0,0,0,.08);display:grid;grid-template-rows:auto 1fr auto;overflow:hidden}
.hd{display:flex;justify-content:space-between;align-items:center;padding:2.2vmin 3vmin;border-bottom:1px solid #eee}
.hd b{font-size:3vmin}.hd small{font-size:2.2vmin;color:#999}
pre{margin:0;padding:2.6vmin 3vmin;font:2.5vmin/1.75 'IBM Plex Mono',ui-monospace,monospace;white-space:pre-wrap;color:#333;overflow:hidden}
mark{background:#fff1b8;color:#8a5a00;border-radius:.6vmin;padding:0 .6vmin}
.ft{display:flex;justify-content:space-between;align-items:center;padding:1.8vmin 3vmin;background:#faf9f6}
.ft span{font-size:2.2vmin;color:#888}
button{border:0;background:#1c1b1a;color:#fff;border-radius:1.4vmin;padding:1.4vmin 3.4vmin;font:700 2.6vmin 'IBM Plex Sans KR',sans-serif;cursor:pointer;transition:background .25s,transform .1s;min-width:22vmin}
button:active{transform:scale(.95)}button.ok{background:#2f7d5b}`,
    html: `<div class="cd"><div class="hd"><b>실습 2 · 예시 프롬프트</b><small>교재 14쪽</small></div><pre>너는 <mark>중학교 1학년</mark> 과학 교사야.
<mark>물에 뜨는 것과 가라앉는 것</mark>을 주제로
20분 모둠 활동을 설계해 줘.
형식: 준비물 · 진행 순서 · 질문 3개</pre><div class="ft"><span>노란 칸을 바꿔 써요</span><button>복사</button></div></div>`,
    js: `var b=document.querySelector('button'),t=document.querySelector('pre').textContent;b.onclick=function(){var done=function(m){b.textContent=m;b.classList.add('ok');setTimeout(function(){b.textContent='복사';b.classList.remove('ok')},1400)};if(navigator.clipboard)navigator.clipboard.writeText(t).then(function(){done('✓ 복사했어요')},function(){done('✓ 복사했어요')});else done('✓ 복사했어요')};if(!RM)setInterval(function(){b.classList.add('ok');b.textContent='✓ 복사했어요';setTimeout(function(){b.textContent='복사';b.classList.remove('ok')},1200)},2600);`,
  },
  {
    id: 'prompt-builder', ko: '프롬프트 조립기', en: 'Prompt Builder',
    desc: '역할·상황·과제·형식 칸을 고르면 완성된 프롬프트가 아래에서 조립돼요.',
    fit: '프롬프트 쓰기 실습에서 구조를 익히게 할 때. 완성본은 복사 버튼으로.',
    tech: '칸마다 고르기 버튼 묶음 → 문장 틀에 끼워 넣기 + 바뀐 부분만 강조 전환',
    tags: ['조립', '프롬프트', '고르기', '실습'],
    f: F,
    css: `${BODY}
.w{position:absolute;inset:4vmin 5vmin;display:grid;gap:1.6vmin;align-content:center}
.rw{display:grid;grid-template-columns:10vmin 1fr;align-items:center;gap:1.6vmin;font-size:2.3vmin}
.rw>span{color:#888;font-weight:600}
.ch{display:flex;gap:1vmin;flex-wrap:wrap}
.ch button{border:1px solid #d9d3c6;background:#fff;border-radius:99px;padding:.7vmin 2vmin;font:2.3vmin 'IBM Plex Sans KR',sans-serif;cursor:pointer;transition:all .25s}
.ch button[aria-pressed=true]{background:var(--c);border-color:var(--c);color:#fff}
.out{margin-top:1.4vmin;background:#1c1b1a;color:#eee;border-radius:2vmin;padding:2.4vmin 2.8vmin;font-size:2.6vmin;line-height:1.7}
.out b{color:var(--c);font-weight:700;transition:color .3s}`,
    html: `<div class="w"><div class="rw" style="--c:#e4572e"><span>역할</span><div class="ch"><button>국어 교사</button><button>과학 교사</button><button>상담 교사</button></div></div><div class="rw" style="--c:#2a9d8f"><span>상황</span><div class="ch"><button>1학년 첫 시간</button><button>시험 일주일 전</button></div></div><div class="rw" style="--c:#e9a23b"><span>과제</span><div class="ch"><button>활동 설계</button><button>질문 만들기</button><button>피드백 쓰기</button></div></div><div class="rw" style="--c:#6c63ff"><span>형식</span><div class="ch"><button>표로</button><button>세 줄로</button></div></div><div class="out"></div></div>`,
    js: `var rs=document.querySelectorAll('.rw'),C=['#ff8a65','#4fd1c5','#ffd166','#a29bfe'],sel=[0,0,0,0];function draw(){rs.forEach(function(r,i){r.querySelectorAll('button').forEach(function(b,j){b.setAttribute('aria-pressed',j===sel[i])})});var v=[].map.call(rs,function(r,i){return '<b style="color:'+C[i]+'">'+r.querySelectorAll('button')[sel[i]].textContent+'</b>'});document.querySelector('.out').innerHTML='너는 '+v[0]+'야. '+v[1]+'에 쓸 '+v[2]+'를 '+v[3]+' 정리해 줘.'}rs.forEach(function(r,i){r.querySelectorAll('button').forEach(function(b,j){b.onclick=function(){sel[i]=j;draw()}})});draw();var k=0;if(!RM)setInterval(function(){var i=k++%4,n=rs[i].querySelectorAll('button').length;sel[i]=(sel[i]+1)%n;draw()},1100);`,
  },
  {
    id: 'qr-join', ko: 'QR 접속 안내', en: 'QR Join Card',
    desc: '큰 QR과 짧은 주소, 연수 코드를 한 판에. 화면 앞에서 휴대폰으로 바로 들어와요.',
    fit: '발표 화면의 첫 장, 강의실 입구 안내문. lecpage가 실제 QR을 만들어 줘요.',
    tech: '큰 QR(대비 높게, 여백 4칸) + 손으로 칠 수 있는 짧은 주소 + 연수 코드 + 접속한 사람 수',
    tags: ['QR', '접속', '발표 화면', '안내'],
    f: ['IBM Plex Sans KR:wght@400;700', 'IBM Plex Mono:wght@600'],
    css: `${BODY}body{background:#1c1b1a;color:#fff}
.w{position:absolute;inset:0;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:5vmin;padding:0 7vmin}
.qr{width:40vmin;height:40vmin;background:#fff;border-radius:2vmin;padding:2.4vmin;position:relative}
.qr canvas{width:100%;height:100%;image-rendering:pixelated}
.qr span{position:absolute;right:-1vmin;top:-1.4vmin;background:#ff5a1f;font-size:1.9vmin;font-weight:700;padding:.3vmin 1.2vmin;border-radius:9px;transform:rotate(6deg)}
small{font-size:2.4vmin;color:#aaa}
.u{font:600 4.4vmin/1.2 'IBM Plex Mono',monospace;margin:1vmin 0 3vmin;letter-spacing:-.02em}
.cd{display:inline-block;font:600 6vmin/1 'IBM Plex Mono',monospace;letter-spacing:.3em;background:#2b2a28;border-radius:1.4vmin;padding:1.4vmin 2.4vmin}
.ct{margin-top:3vmin;font-size:2.6vmin}.ct b{font-size:4vmin;color:#7ee2a8;font-variant-numeric:tabular-nums}`,
    html: `<div class="w"><div class="qr"><canvas width="25" height="25"></canvas><span>예시</span></div><div><small>휴대폰 카메라로 찍거나</small><div class="u">is.gd/hanbit26</div><small>연수 코드</small><br><span class="cd">4827</span><p class="ct">지금 들어온 사람 <b>28</b>명</p></div></div>`,
    js: `var c=document.querySelector('canvas'),x=c.getContext('2d'),s=11;function r(){s=(s*16807)%2147483647;return s/2147483647}x.fillStyle='#fff';x.fillRect(0,0,25,25);x.fillStyle='#111';for(var j=0;j<25;j++)for(var i=0;i<25;i++)if(r()>.52)x.fillRect(i,j,1,1);function fp(a,b){x.fillStyle='#fff';x.fillRect(a-1,b-1,9,9);x.fillStyle='#111';x.fillRect(a,b,7,7);x.fillStyle='#fff';x.fillRect(a+1,b+1,5,5);x.fillStyle='#111';x.fillRect(a+2,b+2,3,3)}fp(0,0);fp(18,0);fp(0,18);var b=document.querySelector('.ct b'),n=28;if(!RM)setInterval(function(){n=n>=41?28:n+1;b.textContent=n},900);`,
  },
  {
    id: 'deck-strip', ko: '교재 쪽 띠', en: 'Slide Strip / Follow Along',
    desc: '교재 쪽 그림을 띠로 늘어놓고 강사가 설명하는 쪽을 따라 표시가 움직여요.',
    fit: "교재 넘기기와 함께: '교재 8쪽' 태그를 누르면 그 쪽으로, 강사 따라가기를 켜면 저절로.",
    tech: '쪽 그림 가로 띠(scroll-snap) + 지금 쪽 테두리·확대 + scrollIntoView({inline:"center"}) + "교재 N쪽" 꼬리표 링크',
    tags: ['교재', '쪽 그림', '따라가기', '띠'],
    f: F,
    css: `${BODY}body{background:#22211f;color:#eee}
.w{position:absolute;inset:0;display:grid;grid-template-rows:1fr auto auto;gap:2vmin;padding:5vmin 0}
.big{margin:0 6vmin;border-radius:1.6vmin;background:#fff;color:#222;display:grid;place-content:center;text-align:center;font-size:5vmin;font-weight:700;transition:opacity .3s}
.big small{display:block;font-size:2.4vmin;color:#999;font-weight:400}
.sp{display:flex;gap:1.6vmin;overflow-x:auto;padding:1vmin 6vmin;scrollbar-width:none;scroll-behavior:smooth}.sp::-webkit-scrollbar{display:none}
.sp i{flex:none;width:16vmin;height:11vmin;border-radius:1vmin;background:#fff;opacity:.45;display:grid;place-items:end start;padding:.6vmin 1vmin;font:2vmin ui-monospace,monospace;color:#222;font-style:normal;transition:all .35s}
.sp i.on{opacity:1;outline:.5vmin solid #ffb000;transform:translateY(-1vmin)}
.ft{display:flex;justify-content:space-between;align-items:center;padding:0 6vmin;font-size:2.4vmin}
.ft b{background:#ffb000;color:#222;padding:.4vmin 1.6vmin;border-radius:9px}`,
    html: `<div class="w"><div class="big"></div><div class="sp"></div><div class="ft"><span>● 강사 따라가는 중</span><b class="pg">교재 3쪽</b></div></div>`,
    js: `var T=['오늘의 목표','질문이란?','좋은 질문 3가지','나쁜 예','좋은 예','실습 안내','모둠 활동','정리','과제'],sp=document.querySelector('.sp'),big=document.querySelector('.big'),pg=document.querySelector('.pg'),k=2;sp.innerHTML=T.map(function(t,i){return '<i>p.'+(i+1)+'</i>'}).join('');var is=sp.children;function go(){[].forEach.call(is,function(e,i){e.classList.toggle('on',i===k)});big.innerHTML='<div><small>교재 '+(k+1)+'쪽</small>'+T[k]+'</div>';pg.textContent='교재 '+(k+1)+'쪽';sp.scrollTo({left:is[k].offsetLeft-sp.clientWidth/2+is[k].offsetWidth/2})}go();if(!RM)setInterval(function(){k=(k+1)%T.length;go()},1500);`,
  },
  {
    id: 'checklist', ko: '체크리스트', en: 'Interactive Checklist',
    desc: '준비물·검토 기준을 눌러 표시하면 줄이 그어지고 진행이 차올라요. 이 기기에만 저장.',
    fit: '실습 전 준비물, 과제 제출 전 스스로 점검.',
    tech: 'label+checkbox + :checked 줄긋기(text-decoration 애니메이션) + 진행 막대 + localStorage 저장',
    tags: ['체크', '준비물', '점검', '저장'],
    f: F,
    css: `${BODY}
.w{position:absolute;inset:0;display:grid;align-content:center;gap:1.4vmin;padding:0 8vmin}
.hd{display:flex;justify-content:space-between;font-size:2.6vmin;color:#777}.hd b{color:#1c1b1a;font-size:3.6vmin}
.pb{height:1.2vmin;border-radius:9px;background:#e4ded2;overflow:hidden;margin-bottom:1vmin}.pb i{display:block;height:100%;background:#2f7d5b;width:0;transition:width .4s cubic-bezier(.2,.8,.2,1)}
label{display:flex;align-items:center;gap:2vmin;background:#fff;border-radius:1.6vmin;padding:1.8vmin 2.4vmin;font-size:2.9vmin;cursor:pointer}
input{appearance:none;width:4vmin;height:4vmin;border:.4vmin solid #c9c1b2;border-radius:1vmin;display:grid;place-items:center;margin:0;transition:all .25s;flex:none}
input:checked{background:#2f7d5b;border-color:#2f7d5b}input:checked::after{content:"✓";color:#fff;font-size:2.6vmin;font-weight:700}
label span{background:linear-gradient(#999,#999) 0 55%/0 .3vmin no-repeat;transition:background-size .4s,color .4s}
input:checked+span{background-size:100% .3vmin;color:#999}`,
    html: `<div class="w"><div class="hd"><b>실습 준비물</b><span class="c">0/4</span></div><div class="pb"><i></i></div><label><input type="checkbox"><span>노트북 충전기</span></label><label><input type="checkbox"><span>와이파이 연결</span></label><label><input type="checkbox"><span>교재 PDF 열기</span></label><label><input type="checkbox"><span>AI 계정 로그인</span></label></div>`,
    js: `var cs=document.querySelectorAll('input'),c=document.querySelector('.c'),pb=document.querySelector('.pb i');function up(){var n=[].filter.call(cs,function(x){return x.checked}).length;c.textContent=n+'/4';pb.style.width=n*25+'%'}cs.forEach(function(x){x.onchange=up});var k=0;if(!RM)setInterval(function(){if(k>=4){cs.forEach(function(x){x.checked=false});k=0}else cs[k++].checked=true;up()},900);`,
  },
  {
    id: 'practice-timer', ko: '실습 타이머', en: 'Practice Timer',
    desc: '실습 시간과 같은 분으로 맞춘 고리 타이머. 끝나기 1분 전엔 색이 바뀌어요.',
    fit: '모둠 활동·개인 실습. 발표 화면에 크게, 참가자 휴대폰에도 같은 시간.',
    tech: 'SVG circle stroke-dashoffset로 남은 비율 + tabular-nums 큰 숫자 + 마지막 1분 색 바꿈',
    tags: ['타이머', '고리', '실습', '시간'],
    f: ['IBM Plex Sans KR:wght@400;700'],
    css: `${BODY}body{background:#14213d;color:#fff}
.w{position:absolute;inset:0;display:grid;place-items:center}
svg{width:58vmin;height:58vmin;transform:rotate(-90deg)}
circle{fill:none;stroke-width:6}.bg{stroke:rgba(255,255,255,.12)}.fg{stroke:#7ee2a8;stroke-linecap:round;transition:stroke-dashoffset 1s linear,stroke .4s}
.fg.low{stroke:#ff6b5a}
.t{position:absolute;text-align:center}.t b{display:block;font:700 13vmin/1 'IBM Plex Sans KR',sans-serif;font-variant-numeric:tabular-nums;letter-spacing:-.03em}.t span{font-size:2.6vmin;color:#a9b8d6}`,
    html: `<div class="w"><svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="44"/><circle class="fg" cx="50" cy="50" r="44" pathLength="1" stroke-dasharray="1" stroke-dashoffset="0"/></svg><div class="t"><span>모둠 활동</span><b>10:00</b><span>남은 시간</span></div></div>`,
    js: `var T=600,t=T,fg=document.querySelector('.fg'),b=document.querySelector('.t b');function s(){b.textContent=String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');fg.style.strokeDashoffset=1-t/T;fg.classList.toggle('low',t<=60)}s();if(!RM)setInterval(function(){t=t>12?t-12:T;s()},300);`,
  },
  {
    id: 'live-poll', ko: '투표 결과 막대', en: 'Live Poll Results',
    desc: '표가 들어올 때마다 막대가 늘어나고 순위가 바뀌는 결과 화면.',
    fit: '강의 중 투표·퀴즈 결과를 발표 화면에 보여 줄 때(lecpage 투표 기능과 함께).',
    tech: '막대 width를 비율로 + transition + 1등 강조 + 숫자 tabular-nums + 결과 공개 전엔 가리기',
    tags: ['투표', '막대', '실시간', '결과'],
    f: F,
    css: `${BODY}
.w{position:absolute;inset:0;display:grid;align-content:center;gap:2vmin;padding:0 7vmin}
.q{font-size:3.8vmin;font-weight:700;letter-spacing:-.02em;margin-bottom:1vmin}
.o{position:relative;background:#fff;border-radius:1.6vmin;overflow:hidden;padding:2vmin 2.6vmin;display:flex;justify-content:space-between;font-size:2.8vmin}
.o i{position:absolute;left:0;top:0;bottom:0;background:#e9e3f9;transition:width .8s cubic-bezier(.2,.8,.2,1)}
.o.top i{background:#c9b8ff}.o span,.o b{position:relative}.o b{font-variant-numeric:tabular-nums}
.n{font-size:2.3vmin;color:#888}`,
    html: `<div class="w"><div class="q">가장 어려웠던 단계는?</div><div class="o"><i></i><span>질문 고르기</span><b></b></div><div class="o"><i></i><span>프롬프트 다듬기</span><b></b></div><div class="o"><i></i><span>결과 비교</span><b></b></div><p class="n">0명 응답</p></div>`,
    js: `var V=[3,5,2],os=document.querySelectorAll('.o'),n=document.querySelector('.n');function d(){var s=V[0]+V[1]+V[2],mx=Math.max.apply(null,V);os.forEach(function(o,i){o.querySelector('i').style.width=(V[i]/s*100)+'%';o.querySelector('b').textContent=Math.round(V[i]/s*100)+'%';o.classList.toggle('top',V[i]===mx)});n.textContent=s+'명 응답'}d();if(!RM)setInterval(function(){var r=Math.random();V[r<.45?1:r<.75?0:2]++;if(V[0]+V[1]+V[2]>40)V=[3,5,2];d()},500);`,
  },
  {
    id: 'qa-upvote', ko: '질문 보드와 공감', en: 'Q&A Board with Upvotes',
    desc: '참가자 질문에 공감을 누르면 많이 받은 질문이 위로 미끄러져 올라가요.',
    fit: '강의 중 질문 받기. 강사는 위에서부터 답하면 돼요(lecpage 질문 기능과 함께).',
    tech: '공감 수로 정렬 + FLIP 애니메이션(옮기기 전 위치 기억 → transform으로 옮겨 감)',
    tags: ['질문', '공감', 'FLIP', '정렬'],
    f: F,
    css: `${BODY}
.w{position:absolute;inset:4vmin 6vmin;display:grid;gap:1.4vmin;align-content:center}
.it{display:flex;align-items:center;gap:2vmin;background:#fff;border-radius:1.8vmin;padding:1.8vmin 2.2vmin;font-size:2.7vmin;box-shadow:0 .3vmin 1vmin rgba(0,0,0,.05)}
.it p{margin:0;flex:1}
.up{display:grid;justify-items:center;min-width:7vmin;border:1px solid #e2dccf;border-radius:1.2vmin;padding:.6vmin;font-size:2.2vmin;color:#777}
.up b{font-size:3vmin;color:#1c1b1a;font-variant-numeric:tabular-nums}
.it.hit .up{border-color:#ff5a1f;color:#ff5a1f;animation:bp .4s}@keyframes bp{50%{transform:scale(1.15)}}`,
    html: `<div class="w"></div>`,
    js: `var Q=[['평가 기준도 AI로 만들 수 있나요?',4],['개인정보가 들어가면 어떻게 하죠?',7],['저학년도 쓸 수 있나요?',2],['결과가 틀리면 어떻게 알려 주나요?',5]],w=document.querySelector('.w');Q.forEach(function(q,i){var d=document.createElement('div');d.className='it';d.innerHTML='<div class="up">▲<b>'+q[1]+'</b></div><p>'+q[0]+'</p>';q.el=d;w.appendChild(d)});function order(){var first=Q.map(function(q){return q.el.getBoundingClientRect().top});var s=Q.slice().sort(function(a,b){return b[1]-a[1]});s.forEach(function(q){w.appendChild(q.el)});Q.forEach(function(q,i){var d=first[i]-q.el.getBoundingClientRect().top;if(d){q.el.animate([{transform:'translateY('+d+'px)'},{transform:'none'}],{duration:RM?1:500,easing:'cubic-bezier(.2,.8,.2,1)'})}})}order();if(!RM)setInterval(function(){var q=Q[Math.random()<.5?2:Math.floor(Math.random()*4)];q[1]++;q.el.querySelector('b').textContent=q[1];q.el.classList.remove('hit');q.el.offsetWidth;q.el.classList.add('hit');order();if(q[1]>14)Q.forEach(function(x,i){x[1]=[4,7,2,5][i];x.el.querySelector('b').textContent=x[1]})},900);`,
  },
  {
    id: 'before-after', ko: '나쁜 예와 좋은 예', en: 'Before / After Comparison',
    desc: '두 예를 겹쳐 두고 경계를 끌어 비교해요. 나쁜 예엔 빨간 줄, 좋은 예엔 손글씨 메모.',
    fit: '프롬프트·글쓰기·피드백처럼 차이를 눈으로 보여 줘야 이해되는 내용.',
    tech: '두 판을 겹치고 위 판에 clip-path:inset(0 0 0 X%) + 끌 수 있는 손잡이(input range나 pointer)',
    tags: ['비교', '전후', '슬라이더', '예시'],
    ptr: true,
    f: ['IBM Plex Sans KR:wght@400;700', 'Nanum Pen Script'],
    css: `${BODY}
.p{position:absolute;inset:0;padding:6vmin 7vmin;display:grid;align-content:center;gap:2vmin}
.p small{font-size:2.4vmin;font-weight:700;letter-spacing:.1em}
.p q{font-size:3.6vmin;line-height:1.55;quotes:none}
.bad{background:#fbeaea}.bad small{color:#c62f22}.bad q{text-decoration:line-through;text-decoration-color:rgba(198,47,34,.6);text-decoration-thickness:.4vmin}
.good{background:#e7f5ec;clip-path:inset(0 0 0 var(--x,50%))}.good small{color:#1f7a4d}
.memo{font:4.6vmin 'Nanum Pen Script',cursive;color:#1f7a4d;transform:rotate(-3deg)}
.h{position:absolute;top:0;bottom:0;left:var(--x,50%);border-left:.5vmin solid #1c1b1a}
.h i{position:absolute;top:50%;left:-3.6vmin;width:7vmin;height:7vmin;margin-top:-3.5vmin;border-radius:50%;background:#1c1b1a;color:#fff;display:grid;place-items:center;font-style:normal;font-size:2.6vmin}`,
    html: `<div class="p bad"><small>✕ 나쁜 예</small><q>수업 자료 만들어 줘.</q></div><div class="p good"><small>✓ 좋은 예</small><q>중1 과학, 물의 부력을 주제로 20분 모둠 활동지를 만들어 줘. 질문 3개 포함.</q><span class="memo">대상·주제·분량이 다 있어요!</span></div><div class="h"><i>↔</i></div>`,
    js: `ghost(document.body,function(x){document.body.style.setProperty('--x',(8+x*84)+'%')});`,
  },
  {
    id: 'word-cloud', ko: '낱말 구름', en: 'Word Cloud',
    desc: '참가자가 낸 낱말을 많이 나온 것일수록 크게 모아 보여 줘요.',
    fit: '강의 시작의 마음 열기, 끝의 한 낱말 소감(lecpage 낱말 투표와 함께).',
    tech: '횟수에 비례한 font-size(제곱근으로 완만하게) + 몇 가지 색 + 새 낱말은 튀어나오며 등장',
    tags: ['낱말', '소감', '모으기', '등장'],
    f: ['Gowun Dodum', 'Jua'],
    css: `body{background:#fffaf0}
.w{position:absolute;inset:5vmin;display:flex;flex-wrap:wrap;align-content:center;justify-content:center;gap:1vmin 3vmin}
.w span{font-family:'Jua',sans-serif;line-height:1.1;animation:pop .6s cubic-bezier(.3,1.7,.5,1) both;transition:font-size .5s}
@keyframes pop{from{transform:scale(0) rotate(-10deg);opacity:0}}
.q{position:absolute;left:0;right:0;top:3vmin;text-align:center;font:2.6vmin 'Gowun Dodum',sans-serif;color:#999}`,
    html: `<p class="q">오늘 강의를 한 낱말로?</p><div class="w"></div>`,
    js: `var W=[['질문',9],['재미',6],['실습',8],['어려움',3],['협력',5],['발견',4],['자신감',5],['고민',2],['도전',4],['배움',7],['연결',3],['새로움',4]],C=['#e4572e','#2a9d8f','#264653','#e9a23b','#6c63ff','#d1495b'],w=document.querySelector('.w');function d(){w.innerHTML=W.map(function(x,i){return '<span style="font-size:'+(2.6+Math.sqrt(x[1])*2.6)+'vmin;color:'+C[i%6]+';animation-delay:'+(i*60)+'ms">'+x[0]+'</span>'}).join('')}d();if(!RM)setInterval(function(){W.forEach(function(x){x[1]=Math.max(1,x[1]+Math.round(Math.random()*2-.8))});W.sort(function(){return Math.random()-.5});d()},2600);`,
  },
  {
    id: 'attendance', ko: '출석 확인', en: 'Attendance Check-in',
    desc: '누르면 크게 체크되고 들어온 사람 수가 하나 늘어나는 출석 화면.',
    fit: '강의 사이트에 들어오자마자 처음 누를 곳(lecpage 출석 기능과 함께).',
    tech: '큰 원 버튼 하나 + 누르면 SVG 체크 선 그리기 + 원이 퍼지는 물결 + 이름·시각 확인 문구',
    tags: ['출석', '체크', '첫 행동', '확인'],
    f: F,
    css: `${BODY}
.w{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:2.6vmin;text-align:center}
.b{position:relative;width:34vmin;height:34vmin;border-radius:50%;border:0;background:#1c1b1a;color:#fff;font:700 4.4vmin 'IBM Plex Sans KR',sans-serif;cursor:pointer;transition:background .4s}
.b::after{content:"";position:absolute;inset:0;border-radius:50%;border:.5vmin solid #2f7d5b;opacity:0}
.b.on{background:#2f7d5b}.b.on::after{animation:rp .8s ease-out}
@keyframes rp{from{opacity:.8;transform:scale(1)}to{opacity:0;transform:scale(1.5)}}
.b svg{position:absolute;inset:26%;width:48%;height:48%;opacity:0}.b.on svg{opacity:1}.b.on span{opacity:0}
.b path{fill:none;stroke:#fff;stroke-width:8;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1}.b.on path{animation:dr .5s .15s ease-out forwards}
@keyframes dr{to{stroke-dashoffset:0}}
.m{font-size:2.8vmin;color:#555;min-height:4vmin}.m b{color:#2f7d5b}`,
    html: `<div class="w"><button class="b"><span>출석</span><svg viewBox="0 0 64 64"><path pathLength="1" d="M14 34 L27 46 L50 20"/></svg></button><p class="m">눌러서 출석해요</p></div>`,
    js: `var b=document.querySelector('.b'),m=document.querySelector('.m');b.onclick=function(){var on=b.classList.toggle('on');m.innerHTML=on?'<b>출석했어요</b> · 14:02 · 해바라기':'눌러서 출석해요'};if(!RM)setInterval(function(){b.click()},1800);`,
  },
  {
    id: 'wrap-up', ko: '마무리 카드', en: 'Wrap-up Summary',
    desc: '오늘 만든 것, 과제 마감, 설문, 다음 일정을 한 판에 모은 강의 끝 화면.',
    fit: '강의 마지막 10분. 참가자가 나가기 전에 할 일을 빠짐없이.',
    tech: '할 일마다 상태(끝/남음) + 마감 D-day 계산 + 설문 버튼 하나를 주요로 + 저장해 두기 링크',
    tags: ['마무리', '과제', '설문', '다음 일정'],
    f: F,
    css: `${BODY}
.w{position:absolute;inset:5vmin 6vmin;display:grid;grid-template-columns:1.2fr 1fr;grid-template-rows:auto 1fr;gap:2vmin}
h3{grid-column:1/-1;margin:0;font-size:4.6vmin;letter-spacing:-.03em}
.l{display:grid;gap:1.2vmin;align-content:start}
.r{display:flex;align-items:center;gap:1.6vmin;background:#fff;border-radius:1.6vmin;padding:1.6vmin 2vmin;font-size:2.6vmin}
.r i{width:3.4vmin;height:3.4vmin;border-radius:50%;display:grid;place-items:center;font-style:normal;font-size:2vmin;flex:none;background:#2f7d5b;color:#fff}.r i.o{background:#fff;border:.4vmin solid #d4cdbf}
.r em{margin-left:auto;font-style:normal;font-size:2.2vmin;font-weight:700;color:#ff5a1f}
.sv{background:#1c1b1a;color:#fff;border-radius:2.4vmin;padding:3vmin;display:flex;flex-direction:column;justify-content:space-between}
.sv b{font-size:3.6vmin;line-height:1.3}.sv span{display:inline-block;background:#ffd166;color:#1c1b1a;border-radius:1.2vmin;padding:1.4vmin 2.4vmin;font-weight:700;font-size:2.6vmin;align-self:flex-start;animation:nd 2s ease-in-out infinite}
@keyframes nd{50%{transform:translateY(-.8vmin)}}
.sv small{color:#aaa;font-size:2.2vmin}`,
    html: `<div class="w"><h3>오늘 수고했어요</h3><div class="l"><div class="r"><i>✓</i>수업 설계안 초안</div><div class="r"><i>✓</i>모둠 보드에 붙이기</div><div class="r"><i class="o"></i>과제 1 제출<em>D-3</em></div><div class="r"><i class="o"></i>다음 시간 · 12월 5일 14:00</div></div><div class="sv"><b>만족도 조사<br>2분이면 끝나요</b><span>설문 시작</span><small>이 사이트에서 바로 해요</small></div></div>`,
  },
];
