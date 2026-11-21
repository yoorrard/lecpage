// ⑦ 효과·질감
import { GRAIN } from './parts.js';

export default [
  {
    id: 'grain', ko: '그레인·종이 결', en: 'Grain / Noise Texture',
    desc: '화면 전체에 아주 고운 잡티를 얹어 디지털의 매끈함을 덜고 인쇄물 같은 온기를 줘요.',
    fit: '편집·리소·손그림 스타일의 바탕. 그림 파일 없이 SVG 필터로 만들어 가벼워요.',
    tech: "data: SVG feTurbulence 잡티를 ::after로 덮고 opacity .15~.3 + mix-blend-mode:multiply",
    tags: ['잡티', 'feTurbulence', '질감', '인쇄'],
    f: ['Noto Serif KR:wght@900'],
    css: `body{background:linear-gradient(135deg,#f6d365,#fda085)}
.h{position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr}
.h div{position:relative;display:grid;place-content:center;text-align:center;font:900 8vmin/1.1 'Noto Serif KR',serif;color:#3a1d0e}
.h small{display:block;font:2.4vmin system-ui;margin-top:1.4vmin;opacity:.7}
.g::after{content:"";position:absolute;inset:0;background:${GRAIN};opacity:.45;mix-blend-mode:multiply;animation:j .5s steps(2) infinite}
@keyframes j{50%{transform:translate(1px,-1px)}}
.h div:first-child{border-right:1px dashed rgba(58,29,14,.35)}`,
    html: `<div class="h"><div>매끈<small>그대로</small></div><div class="g">거칠게<small>잡티 30%</small></div></div>`,
  },
  {
    id: 'blur-focus', ko: '흐림과 초점', en: 'Blur & Depth of Field',
    desc: '지금 볼 것만 또렷하게, 나머지는 흐리게 해서 시선을 한 곳에 모아요.',
    fit: '단계별 안내에서 지금 단계만 강조, 발표 화면에서 한 줄씩 짚을 때.',
    tech: '나머지에 filter:blur() + opacity 낮춤, 지금 항목만 또렷하게(transition으로 옮겨 감)',
    tags: ['blur', '초점', '강조', '시선'],
    f: ['IBM Plex Sans KR:wght@400;700'],
    css: `body{background:#11131a;color:#f4f4f6;font-family:'IBM Plex Sans KR',sans-serif}
.w{position:absolute;inset:0;display:grid;align-content:center;gap:2.4vmin;padding:0 9vmin}
.w p{margin:0;font-size:5vmin;font-weight:700;letter-spacing:-.02em;filter:blur(.6vmin);opacity:.35;transform:scale(.97);transform-origin:left;transition:filter .6s,opacity .6s,transform .6s}
.w p.on{filter:none;opacity:1;transform:none}
.w p small{font-size:2.4vmin;font-weight:400;color:#ff9f6b;margin-right:2vmin}`,
    html: `<div class="w"><p class="on"><small>01</small>교재 12쪽 펴기</p><p><small>02</small>예시 프롬프트 복사</p><p><small>03</small>대상 바꿔 다시 묻기</p><p><small>04</small>보드에 붙이기</p></div>`,
    js: `var ps=document.querySelectorAll('.w p'),k=0;if(!RM)setInterval(function(){ps[k].classList.remove('on');k=(k+1)%ps.length;ps[k].classList.add('on')},1400);else ps.forEach(function(p){p.classList.add('on')});`,
  },
  {
    id: 'layered-shadow', ko: '겹겹 그림자', en: 'Layered Shadows / Elevation',
    desc: '그림자를 크기가 다른 여러 겹으로 쌓아 실제 빛처럼 부드럽게. 높이 단계로 위계를 표현해요.',
    fit: '떠 있는 버튼·카드·대화상자처럼 높이가 다른 요소들.',
    tech: 'box-shadow를 4~5겹(작고 진한 것 + 크고 옅은 것) + 높이마다 단계(--e1·--e2·--e3)',
    tags: ['그림자', '높이', 'box-shadow', '깊이'],
    css: `body{background:#eef0f4;font-family:system-ui}
.w{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:5vmin}
.c{width:22vmin;height:28vmin;border-radius:2.6vmin;background:#fff;display:grid;place-content:end start;padding:2.4vmin;font-size:2.4vmin;color:#555;transition:transform .5s cubic-bezier(.2,.8,.2,1),box-shadow .5s}
.c b{font-size:3.6vmin;color:#111}
.e1{box-shadow:0 1px 2px rgba(20,30,60,.12)}
.e2{box-shadow:0 1px 1px rgba(20,30,60,.08),0 2px 2px rgba(20,30,60,.08),0 4px 4px rgba(20,30,60,.08),0 8px 8px rgba(20,30,60,.08)}
.e3{box-shadow:0 1px 1px rgba(20,30,60,.06),0 2px 2px rgba(20,30,60,.06),0 4px 4px rgba(20,30,60,.06),0 8px 8px rgba(20,30,60,.06),0 16px 16px rgba(20,30,60,.06),0 32px 32px rgba(20,30,60,.06);transform:translateY(-2vmin)}
.c.up{transform:translateY(-3vmin);box-shadow:0 2px 2px rgba(20,30,60,.05),0 4px 4px rgba(20,30,60,.05),0 8px 8px rgba(20,30,60,.05),0 16px 16px rgba(20,30,60,.05),0 32px 32px rgba(20,30,60,.05),0 64px 64px rgba(20,30,60,.05)}`,
    html: `<div class="w"><div class="c e1"><b>1</b>바닥</div><div class="c e2"><b>2</b>카드</div><div class="c e3"><b>3</b>떠 있음</div></div>`,
    js: `var cs=document.querySelectorAll('.c'),k=0;if(!RM)setInterval(function(){cs.forEach(function(c){c.classList.remove('up')});cs[k++%3].classList.add('up')},1200);`,
  },
  {
    id: 'mask', ko: '마스크', en: 'CSS Mask',
    desc: '그라데이션이나 모양으로 요소의 보이는 부분을 오려 내요. 끝이 스르르 사라지는 띠에 좋아요.',
    fit: '가로로 흐르는 쪽 그림 띠의 양 끝, 긴 목록의 아래 끝을 부드럽게.',
    tech: 'mask-image:linear-gradient(90deg,transparent,#000 15%,#000 85%,transparent) (+ -webkit-mask-image)',
    tags: ['mask', '페이드', '가장자리', '띠'],
    css: `body{background:#faf7f2;font-family:system-ui}
.w{position:absolute;inset:0;display:grid;align-content:center;gap:4vmin}
.st{display:flex;gap:2vmin;width:max-content;animation:mv 14s linear infinite}
.st i{width:20vmin;height:26vmin;border-radius:1.6vmin;flex:none;display:grid;place-items:end start;padding:1.4vmin;font:700 2.4vmin system-ui;color:rgba(0,0,0,.55);font-style:normal}
.mk{-webkit-mask-image:linear-gradient(90deg,transparent,#000 18%,#000 82%,transparent);mask-image:linear-gradient(90deg,transparent,#000 18%,#000 82%,transparent);overflow:hidden}
@keyframes mv{to{transform:translateX(-50%)}}
.lb{text-align:center;font-size:2.4vmin;color:#888}`,
    html: `<div class="w"><div class="mk"><div class="st"></div></div><div class="lb">교재 쪽 띠 · 양 끝이 스르르 사라져요</div></div>`,
    js: `var C=['#ffd6a5','#caffbf','#9bf6ff','#bdb2ff','#ffc6ff','#fdffb6'],h='';for(var r=0;r<2;r++)for(var i=0;i<6;i++)h+='<i style="background:'+C[i]+'">p.'+(i*2+1)+'</i>';document.querySelector('.st').innerHTML=h;`,
  },
  {
    id: 'clip-path', ko: '클립 패스', en: 'clip-path Shapes',
    desc: '요소를 원·다각형·별 모양으로 오려 내고, 그 모양을 바꾸며 드러내는 기법.',
    fit: '쪽 그림을 원형 창으로 보여 주거나, 다음 장으로 넘어갈 때 동그랗게 열리는 전환.',
    tech: 'clip-path:circle()/polygon()/inset() + 같은 점 수 polygon끼리 transition',
    tags: ['clip-path', '모양', '전환', 'polygon'],
    css: `body{background:#1c1b22}
.s{position:absolute;inset:0;display:grid;place-content:center;text-align:center;font:800 8vmin/1.1 system-ui;letter-spacing:-.03em}
.a{background:#fef3c7;color:#7c2d12}
.b{background:#7c3aed;color:#fff;clip-path:circle(0% at 70% 30%);animation:op 4s cubic-bezier(.7,0,.2,1) infinite}
@keyframes op{0%,10%{clip-path:circle(0% at 70% 30%)}45%,70%{clip-path:circle(150% at 70% 30%)}100%{clip-path:circle(0% at 70% 30%)}}
.p{position:absolute;right:6vmin;bottom:6vmin;width:22vmin;height:22vmin;background:#f97316;animation:sh 4s ease-in-out infinite}
@keyframes sh{0%,100%{clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%,50% 0,50% 0)}33%{clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%)}66%{clip-path:polygon(0 0,100% 0,100% 100%,0 100%,0 50%,0 0)}}`,
    html: `<div class="s a">1부<br>마침</div><div class="s b">2부<br>시작</div><div class="p"></div>`,
  },
  {
    id: 'blend-mode', ko: '혼합 모드', en: 'Blend Modes',
    desc: '겹친 색이 서로 곱해지거나 반전되는 방식. 움직이는 도형 위 글자가 저절로 색을 바꿔요.',
    fit: '포스터형 첫 화면, 리소 인쇄 흉내, 그림 위 제목.',
    tech: 'mix-blend-mode:difference(반전)·multiply(곱하기)·screen(밝게) + background-blend-mode',
    tags: ['mix-blend-mode', 'difference', '겹침', '포스터'],
    f: ['Black Han Sans'],
    css: `body{background:#f5f2ea}
.o{position:absolute;width:44vmin;height:44vmin;border-radius:50%;background:#111;top:50%;margin-top:-22vmin;animation:mv 5s ease-in-out infinite alternate}
@keyframes mv{from{left:-10vmin}to{left:calc(100% - 34vmin)}}
.t{position:absolute;inset:0;display:grid;place-content:center;font:15vmin/1 'Black Han Sans',sans-serif;color:#fff;mix-blend-mode:difference;text-align:center}
.m{position:absolute;left:6vmin;bottom:5vmin;display:flex}.m i{width:12vmin;height:12vmin;border-radius:50%;mix-blend-mode:multiply}.m i+i{margin-left:-4vmin}`,
    html: `<div class="o"></div><div class="t">반전<br>보기</div><div class="m"><i style="background:#ff48b0"></i><i style="background:#00b3ff"></i><i style="background:#ffe600"></i></div>`,
  },
  {
    id: 'duotone', ko: '듀오톤', en: 'Duotone',
    desc: '그림을 어두운 색과 밝은 색 두 가지로만 다시 칠해 통일감 있게 만드는 효과.',
    fit: '서로 다른 쪽 그림·사진을 한 사이트 색에 맞춰 묶을 때.',
    tech: 'SVG filter feColorMatrix(흑백) + feComponentTransfer tableValues로 두 색 매핑, CSS filter:url(#duo)',
    tags: ['두 색', '필터', '사진', '통일감'],
    css: `body{background:#14213d}
.w{position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr}
.sc{position:relative;overflow:hidden}
.sc svg{position:absolute;inset:0;width:100%;height:100%}
.d2{filter:url(#duo)}
.lb{position:absolute;left:2vmin;bottom:2vmin;background:rgba(0,0,0,.5);color:#fff;font:2.2vmin system-ui;padding:.6vmin 1.6vmin;border-radius:9px}
.sl{position:absolute;top:0;bottom:0;left:50%;border-left:2px solid #fff}`,
    html: `<svg width="0" height="0" style="position:absolute"><filter id="duo" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values=".33 .33 .33 0 0 .33 .33 .33 0 0 .33 .33 .33 0 0 0 0 0 1 0"/><feComponentTransfer><feFuncR type="table" tableValues=".08 .99"/><feFuncG type="table" tableValues=".13 .64"/><feFuncB type="table" tableValues=".24 .07"/></feComponentTransfer></filter></svg><div class="w"><div class="sc"><svg viewBox="0 0 100 120" preserveAspectRatio="xMidYMid slice"><rect width="100" height="120" fill="#7ec8e3"/><circle cx="70" cy="30" r="14" fill="#ffd166"/><path d="M0 80 L25 50 L45 70 L65 40 L100 75 V120 H0Z" fill="#2a9d8f"/><path d="M0 95 L30 75 L60 92 L100 80 V120 H0Z" fill="#e76f51"/></svg><span class="lb">원래</span></div><div class="sc d2"><svg viewBox="0 0 100 120" preserveAspectRatio="xMidYMid slice"><rect width="100" height="120" fill="#7ec8e3"/><circle cx="70" cy="30" r="14" fill="#ffd166"/><path d="M0 80 L25 50 L45 70 L65 40 L100 75 V120 H0Z" fill="#2a9d8f"/><path d="M0 95 L30 75 L60 92 L100 80 V120 H0Z" fill="#e76f51"/></svg><span class="lb">듀오톤</span></div></div><div class="sl"></div>`,
  },
  {
    id: 'halftone', ko: '망점', en: 'Halftone Dots',
    desc: '크기가 다른 점으로 명암을 표현하는 인쇄 기법. 만화·신문 같은 느낌을 줘요.',
    fit: '리소·포스터·레트로 스타일의 그림자, 배경 패턴.',
    tech: 'radial-gradient 점 패턴 + mask-image 그라데이션으로 점 크기가 줄어드는 것처럼',
    tags: ['점', '인쇄', '만화', '패턴'],
    f: ['Black Han Sans'],
    css: `body{background:#fff6e5}
.ht{position:absolute;inset:0;background:radial-gradient(circle,#ff3d68 34%,transparent 36%) 0 0/3.2vmin 3.2vmin;-webkit-mask:radial-gradient(circle at 70% 40%,#000 0,transparent 70%);mask:radial-gradient(circle at 70% 40%,#000 0,transparent 70%);animation:p 4s ease-in-out infinite alternate}
@keyframes p{to{background-size:2.4vmin 2.4vmin}}
.ht2{position:absolute;inset:0;background:radial-gradient(circle,#1d3557 30%,transparent 32%) 1.6vmin 1.6vmin/3.2vmin 3.2vmin;-webkit-mask:linear-gradient(200deg,transparent 40%,#000);mask:linear-gradient(200deg,transparent 40%,#000);opacity:.85}
.t{position:absolute;left:7vmin;bottom:8vmin;font:12vmin/1 'Black Han Sans',sans-serif;color:#1d3557;text-shadow:.6vmin .6vmin 0 #fff6e5}`,
    html: `<div class="ht"></div><div class="ht2"></div><div class="t">신문 읽기<br>수업</div>`,
  },
  {
    id: 'neon-glow', ko: '네온 빛', en: 'Neon Glow',
    desc: '글자와 선이 빛을 내뿜는 효과. 어두운 바탕에서 한 곳만 쓰면 강렬해요.',
    fit: '밤 행사·게임·코딩 캠프의 제목 한 줄. 여러 곳에 쓰면 AI 티가 나요.',
    tech: 'text-shadow 여러 겹(가까운 흰빛 + 먼 색빛) + 가끔 깜빡임 keyframes + SVG drop-shadow',
    tags: ['빛', 'text-shadow', '어두운 바탕', '한 곳만'],
    f: ['Nanum Pen Script'],
    css: `body{background:#0a0612;background-image:radial-gradient(circle at 50% 60%,#2a0e3d,transparent 60%)}
.w{position:absolute;inset:0;display:grid;place-content:center;text-align:center}
.t{font:17vmin/1 'Nanum Pen Script',cursive;color:#fff3fb;text-shadow:0 0 .6vmin #fff,0 0 2vmin #ff4fd8,0 0 5vmin #ff4fd8,0 0 9vmin #b400ff;animation:fl 4s infinite}
@keyframes fl{0%,18%,22%,62%,64%,100%{opacity:1}20%,63%{opacity:.4;text-shadow:none}}
.ln{width:46vmin;height:.5vmin;margin:2vmin auto 0;background:#4ff0ff;border-radius:9px;box-shadow:0 0 1vmin #4ff0ff,0 0 3vmin #4ff0ff}`,
    html: `<div class="w"><div class="t">코딩의 밤</div><div class="ln"></div></div>`,
  },
  {
    id: 'gooey', ko: '끈적하게 합쳐지기', en: 'Gooey / Metaball Effect',
    desc: '둥근 것들이 가까워지면 물방울처럼 끈적하게 붙었다 떨어져요.',
    fit: '모둠이 모이고 흩어지는 것, 생각이 합쳐지는 것을 상징하는 그림 한 점.',
    tech: 'SVG filter: feGaussianBlur로 흐린 뒤 feColorMatrix로 알파를 세게 → 경계가 붙어 보임',
    tags: ['메타볼', 'SVG filter', '물방울', '합치기'],
    css: `body{background:#fdf0e7}
.g{position:absolute;inset:0;filter:url(#goo)}
.g i{position:absolute;left:50%;top:50%;width:16vmin;height:16vmin;margin:-8vmin;border-radius:50%;background:#ff5d3a;animation:o 3.2s ease-in-out infinite}
.g i:nth-child(2){animation-delay:-.8s;background:#ff5d3a}.g i:nth-child(3){animation-delay:-1.6s}.g i:nth-child(4){animation-delay:-2.4s}
.g i:first-child{width:24vmin;height:24vmin;margin:-12vmin;animation:none}
@keyframes o{0%,100%{transform:translate(0,0)}25%{transform:translate(22vmin,-6vmin)}50%{transform:translate(4vmin,18vmin)}75%{transform:translate(-22vmin,-4vmin)}}
.t{position:absolute;left:0;right:0;bottom:5vmin;text-align:center;font:700 3vmin system-ui;color:#7a2a12}`,
    html: `<svg width="0" height="0" style="position:absolute"><filter id="goo"><feGaussianBlur in="SourceGraphic" stdDeviation="9"/><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -9"/></filter></svg><div class="g"><i></i><i></i><i></i><i></i></div><div class="t">모이고 · 흩어지고 · 다시 모여요</div>`,
  },
  {
    id: 'dither', ko: '디더링', en: 'Dithering',
    desc: '몇 가지 색의 점만으로 명암을 흉내 내는 옛 컴퓨터 그래픽 기법. 요즘 다시 유행하는 스타일.',
    fit: '레트로·픽셀·데이터 주제의 대표 그림 한 점.',
    tech: 'canvas에 그린 그라데이션을 Bayer 4×4 행렬로 문턱값 비교 → 두 색 점으로 다시 칠함(image-rendering:pixelated)',
    tags: ['픽셀', '레트로', 'canvas', '2색'],
    css: `body{background:#0d0d0d}canvas{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated}
.t{position:absolute;left:5vmin;top:5vmin;font:700 3vmin ui-monospace,monospace;color:#e9ff70;background:#0d0d0d;padding:.6vmin 1.4vmin}`,
    html: `<canvas></canvas><div class="t">DITHER · 4×4 BAYER</div>`,
    js: `var c=document.querySelector('canvas'),x=c.getContext('2d'),W=160,H=120;c.width=W;c.height=H;var B=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];function f(t){var d=x.createImageData(W,H),a=(t||0)/1600;for(var j=0;j<H;j++)for(var i=0;i<W;i++){var u=i/W-.5,v=j/H-.5,r=Math.sqrt(u*u+v*v),l=.5+.5*Math.sin(r*14-a*2+Math.atan2(v,u)*2);l=l*(1-r*1.1);var th=(B[(j%4)*4+i%4]+.5)/16,on=l>th,k=(j*W+i)*4;d.data[k]=on?233:13;d.data[k+1]=on?255:13;d.data[k+2]=on?112:13;d.data[k+3]=255}x.putImageData(d,0,0);if(!RM)setTimeout(function(){requestAnimationFrame(f)},40)}f(0);`,
  },
  {
    id: 'ascii', ko: '아스키 아트', en: 'ASCII Art Rendering',
    desc: '글자의 빽빽함으로 명암을 그리는 그림. 고정폭 글자로 움직이는 모양을 만들어요.',
    fit: '코딩·터미널·데이터 강의의 대표 그림. 글자로 된 그림이라 가볍고 선명해요.',
    tech: '밝기를 글자 단계(" .:-=+*#%@")로 바꿔 pre에 출력 + 시간에 따라 다시 계산',
    tags: ['글자 그림', '고정폭', '터미널', '생성 그림'],
    css: `body{background:#0b0e0c;color:#8affc1}
pre{position:absolute;inset:0;margin:0;display:grid;place-content:center;font:2.1vmin/1 ui-monospace,Menlo,monospace;letter-spacing:.1em;white-space:pre}`,
    html: `<pre></pre>`,
    js: `var p=document.querySelector('pre'),C=' .:-=+*#%@',W=46,H=28;function f(t){var a=(t||0)/900,s='';for(var j=0;j<H;j++){for(var i=0;i<W;i++){var u=(i-W/2)/(W/2),v=(j-H/2)/(H/2)*1.1,r=Math.sqrt(u*u+v*v),z=Math.cos(r*6-a*2)*.5+.5;z*=Math.max(0,1-r);var x=u*Math.cos(a)-v*Math.sin(a);z+=Math.max(0,.6-Math.abs(x))*.4*(1-r);s+=C[Math.max(0,Math.min(C.length-1,Math.floor(z*C.length)))]}s+='\\n'}p.textContent=s;if(!RM)setTimeout(function(){requestAnimationFrame(f)},50)}f(0);`,
  },
  {
    id: 'css-patterns', ko: '그라데이션 패턴', en: 'CSS Background Patterns',
    desc: '그림 파일 없이 그라데이션만으로 줄무늬·점·체크·물결 패턴을 만들어요.',
    fit: '쉬는 시간 빗금, 섹션 바탕의 은은한 패턴, 손그림 공책 줄.',
    tech: 'repeating-linear-gradient(빗금) · radial-gradient(점) · conic-gradient(체크) + background-size',
    tags: ['패턴', '그라데이션', '빗금', '가벼움'],
    css: `body{background:#fff;font-family:system-ui}
.w{position:absolute;inset:4vmin;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:1fr 1fr;gap:2vmin}
.w div{border-radius:1.8vmin;display:grid;place-items:end start;padding:1.4vmin;font:600 2.2vmin system-ui;color:#333;animation:sl 8s linear infinite}
.w div span{background:#fff;padding:.4vmin 1.2vmin;border-radius:9px}
.a{background:repeating-linear-gradient(-45deg,#ffe1cc 0 1.4vmin,#fff 1.4vmin 2.8vmin)}
.b{background:radial-gradient(circle,#3d5afe 20%,transparent 22%) 0 0/3vmin 3vmin,#eef0ff}
.c{background:conic-gradient(#111 25%,#fff 0 50%,#111 0 75%,#fff 0) 0 0/4vmin 4vmin}
.d{background:linear-gradient(135deg,#ffd166 25%,transparent 25%) -2vmin 0/4vmin 4vmin,linear-gradient(225deg,#ffd166 25%,transparent 25%) -2vmin 0/4vmin 4vmin,linear-gradient(315deg,#ffd166 25%,transparent 25%) 0 0/4vmin 4vmin,linear-gradient(45deg,#ffd166 25%,transparent 25%) 0 0/4vmin 4vmin,#06d6a0}
.e{background:repeating-linear-gradient(transparent 0 calc(3vmin - 1px),#9cc3ff calc(3vmin - 1px) 3vmin),#fffdf5}
.f{background:radial-gradient(circle at 100% 50%,transparent 1.4vmin,#ef476f 1.5vmin 2vmin,transparent 2.1vmin) 0 0/4vmin 4vmin,radial-gradient(circle at 0 50%,transparent 1.4vmin,#ef476f 1.5vmin 2vmin,transparent 2.1vmin) 2vmin 2vmin/4vmin 4vmin,#fff0f3}
@keyframes sl{to{background-position:8vmin 8vmin}}
.c,.e{animation:none}`,
    html: `<div class="w"><div class="a"><span>빗금</span></div><div class="b"><span>점</span></div><div class="c"><span>체크</span></div><div class="d"><span>지그재그</span></div><div class="e"><span>공책 줄</span></div><div class="f"><span>물결</span></div></div>`,
  },
  {
    id: 'perspective-3d', ko: '원근 입체', en: '3D Transforms & Perspective',
    desc: 'CSS만으로 면을 세우고 돌려 입체를 만들어요. 주사위·상자·펼쳐지는 책.',
    fit: '단원 세 개를 상자 면에 나눠 보여 주는 표지, 교재를 3D로 넘기는 장면.',
    tech: 'perspective + transform-style:preserve-3d + 면마다 rotateY/rotateX + translateZ',
    tags: ['3D', 'perspective', '입체', '회전'],
    css: `body{background:radial-gradient(circle at 50% 40%,#2f3e55,#111824);perspective:90vmin}
.cb{position:absolute;left:50%;top:50%;width:30vmin;height:30vmin;margin:-15vmin;transform-style:preserve-3d;animation:r 9s linear infinite}
@keyframes r{from{transform:rotateX(-22deg) rotateY(0)}to{transform:rotateX(-22deg) rotateY(360deg)}}
.cb i{position:absolute;inset:0;display:grid;place-content:center;text-align:center;font:700 4.4vmin/1.2 system-ui;color:#fff;font-style:normal;border:1px solid rgba(255,255,255,.35);backface-visibility:visible}
.cb i small{font-size:2.2vmin;font-weight:400;opacity:.8}
.f1{background:rgba(255,107,107,.9);transform:translateZ(15vmin)}.f2{background:rgba(78,205,196,.9);transform:rotateY(90deg) translateZ(15vmin)}.f3{background:rgba(255,209,102,.92);color:#333!important;transform:rotateY(180deg) translateZ(15vmin)}.f4{background:rgba(108,92,231,.9);transform:rotateY(-90deg) translateZ(15vmin)}.f5{background:#e9ecef;transform:rotateX(90deg) translateZ(15vmin)}.f6{background:#222;transform:rotateX(-90deg) translateZ(15vmin)}
.fl{position:absolute;left:50%;top:76%;width:60vmin;height:10vmin;margin-left:-30vmin;border-radius:50%;background:radial-gradient(rgba(0,0,0,.5),transparent 70%)}`,
    html: `<div class="fl"></div><div class="cb"><i class="f1"><small>1단원</small>관찰</i><i class="f2"><small>2단원</small>질문</i><i class="f3"><small>3단원</small>실험</i><i class="f4"><small>4단원</small>정리</i><i class="f5"></i><i class="f6"></i></div>`,
  },
];
