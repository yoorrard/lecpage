# 디자인 서재

필요할 때 꺼내 쓰는 낱말과 기법 모음이에요. **규칙이 아니고 따를 의무도 없어요.** 출발점은 지금 연수의 컨셉(주제·대상·분위기)이고, 여기 있는 것을 섞어도 되고 여기 없는 방식을 써도 돼요. 아래 코드 조각은 lecpage 사이트의 보안 정책(CSP) 안에서 그대로 돌아가요.

**노릴 수준**: 들어오자마자 '이건 공들여 만든 최신 사이트다'라고 느끼는 첫 화면. lecpage 견본 셋이 바닥 기준이에요 — 교재 표지의 신경망을 WebGL로 살려 신호가 흐르는 첫 화면과 접혀 오르는 제목(neo-teach), 펼침면을 3D로 넘기는 그림책(picture-heart), 하루 1,440분 격자가 채워지는 첫 화면(data-pulse). 이것을 베끼지 말고, 지금 교재의 컨셉에서만 나올 수 있는 장면으로 이보다 한 단계 위를 노려요. 교재가 평범하거나 딱딱해도 사이트까지 차분한 문서처럼 만들 이유는 없어요.

- 보안 정책 요약: 스크립트는 사이트 안(인라인도 조립이 파일로 옮김)과 jsDelivr의 `gsap@3.15.1`·`lenis@1.3.27`·`ogl@1.0.11`만. 바깥 CSS는 글꼴(fonts.googleapis.com·cdn.jsdelivr.net·hangeul.pstatic.net)만. 그림은 사이트 안 파일·교재 쪽 그림·`data:`·인라인 `<svg>`·canvas(WebGL 포함). Web Worker는 막혀 있어요.

## 1. 컨셉에서 장면으로

1. 컨셉을 눈에 보이는 은유 하나로 줄여요. 교재 장르(슬라이드·공문·보고서)가 아니라 그 연수가 다루는 변화나 행동에서 찾아요.
2. 그 은유를 첫 화면에서 살아 움직이는 장면 하나로 만들어요(셰이더·캔버스 생성 그림·SVG·3D CSS·움직이는 글자 중 어울리는 것).
3. 장면의 모티프를 사이트 문법으로 이어요: '지금' 표시, 진행 막대, 장 바뀜, 버튼 반응.

| 컨셉(예) | 장면 | 이어지는 문법 |
|---|---|---|
| 질문이 먼저, AI는 그다음 | 다섯 노드 신경망 위로 신호가 흐르는 WebGL, 커서가 탐침 | 교사 노드 색 = 주 버튼, 실습 머리의 노드 사슬 |
| 그림책 한 장, 마음 한 뼘 | 찢은 종이 네 색 콜라주, 3D로 넘기는 펼침면 | 마음 색 = 실습 도구 색 |
| 학교 데이터로 수업 바꾸기 | 1,440칸 격자가 지금 시각까지 채워짐, 아주 큰 좁은 숫자 | 신호색 하나로 '지금'만 |
| 숲·생태 교육 | 바람에 흔들리는 생성 풀숲(캔버스), 스크롤 따라 계절 색 이동 | 잎맥 선 그리기로 진행 표시 |
| 코딩·메이커 | 글자가 쳐지며 회로·도면이 그려지는 장면, 모눈 위 치수선 | 줄 번호 콘솔, 단계 = 부품 번호 |
| 리더십·특강 | 화면을 채우는 한 문장이 스크롤 따라 굵기·크기가 바뀜 | 장마다 한 문장, 큰 숫자 |

결(아트 디렉션)은 바탕 하나 + 강조 한 점으로 섞어요: 편집·잡지(큰 명조, 비대칭 2단) · 스위스 격자(아주 큰 숫자, 강조색 하나) · 포스터·움직이는 글자(화면을 채우는 가변 글꼴) · 리소그래프(별색 겹침 `mix-blend-mode`, 어긋난 판, 그레인) · 셰이더 빛·유체(흐르는 색 면) · 네온·유리(어두운 바탕, 빛나는 선, 원근 격자) · 3D 공간(원근·겹친 종이·넘기는 쪽) · 생성 예술(씨앗 있는 무작위 패턴) · 손그림 공책 · 설계도 · 데이터 시각화 · 콜라주 · 픽셀 아케이드 · 칠판 · 지도·답사 · 따뜻한 미니멀. 결마다 함정: 글자 대비 부족, 장식이 정보를 가림, 모든 곳에 같은 효과.

## 2. 한국어 글꼴 짝(무료, 위 CSP 호스트)

구글 폰트는 `https://fonts.googleapis.com/css2?family=이름:wght@…&display=swap`(확인함: 아래 구글 폰트 전부 200). 가변 글꼴은 범위로 받아요(`Hahmlet:wght@100..900`) — 굵기·폭을 움직이는 글자 장면에 써요. 제목 전용 글꼴은 `&text=쓴글자`로 그 글자만 받으면 가벼워요. 줄바꿈은 `word-break: keep-all; overflow-wrap: break-word;`, 제목은 `text-wrap: balance`.

| 느낌 | 제목 | 본문 | 숫자·영문 |
|---|---|---|---|
| 편집 | Noto Serif KR · Hahmlet(가변) | Asta Sans(가변) · IBM Plex Sans KR | Fraunces(가변) · Instrument Serif |
| 편지·성찰 | Gowun Batang · Diphylleia | Gowun Dodum | Instrument Serif |
| 포스터·움직이는 글자 | Black Han Sans · Gasoek One · Pretendard Variable 900 | Gothic A1 · 프리젠테이션 | Anton · Anybody(폭 가변) · Big Shoulders Display |
| 무대·특강 | 페이퍼로지 800 | Asta Sans | Bricolage Grotesque(가변) · Unbounded |
| 기술·도면 | IBM Plex Sans KR 700 | IBM Plex Sans KR | IBM Plex Mono · Space Grotesk |
| 공책·손그림 | 제목은 Gowun Batang, 메모는 Gaegu · Nanum Pen Script | Gowun Dodum | Caveat |
| 둥근·친근 | Jua · Do Hyeon | Gowun Dodum · Pretendard | Bricolage Grotesque |
| 미래 | Orbit | Asta Sans | Space Grotesk · Syne |
| 고전·인문 | Song Myung · Nanum Myeongjo | Nanum Myeongjo · Gowun Batang | Fraunces |
| 픽셀 | Galmuri11 | Pretendard | Galmuri |

jsDelivr(버전 고정, 확인함):
- Pretendard `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css`
- 페이퍼로지 `https://cdn.jsdelivr.net/gh/ayaan-fonts/Paperlogy@1.001-ko/fonts/webfonts/Paperlogy-dynamic-subset.css`
- 프리젠테이션 `https://cdn.jsdelivr.net/gh/ayaan-fonts/Freesentation@1.004/fonts/webfonts/Freesentation-dynamic-subset.css`
- Galmuri `https://cdn.jsdelivr.net/npm/galmuri@2.40.3/dist/galmuri.css`

숫자: `font-variant-numeric: tabular-nums;`. 제목 자간은 -0.02~-0.04em이 한글 큰 글자에서 단단해 보여요.

## 3. 첫 화면 장면과 움직임

움직임은 첫 화면 장면과 장이 바뀌는 순간에 크게 쓰고, 실습·복사·질문·키트 자리는 읽고 누르기 편하게 차분히 둬요. 쉬는 모습이 완성된 모습이게: JS가 없거나 움직임을 줄인 사람에게도 내용이 처음부터 다 보여요. `transform`·`opacity`·셰이더만 움직이면 휴대폰에서도 부드러워요.

**셰이더 배경(WebGL, 라이브러리 없이)** — 흐르는 색 면·빛·물결. `fs`의 식과 두 색을 컨셉에 맞게 바꿔요.
```html
<canvas id="fx" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;z-index:-1"></canvas>
```
```js
const cv=document.getElementById('fx'),gl=cv.getContext('webgl',{antialias:false});
if(gl){
  const fs=`precision mediump float;uniform vec2 r;uniform float t;uniform vec2 m;
  void main(){vec2 p=(gl_FragCoord.xy-.5*r)/r.y;float v=0.;
    for(float i=1.;i<5.;i++){p+=.35/i*vec2(sin(i*p.y+t*.4+m.x*3.),cos(i*p.x-t*.3+m.y*3.));v+=sin(p.x*i)*cos(p.y*i)/i;}
    vec3 a=vec3(.07,.08,.12),b=vec3(1.,.42,.2);gl_FragColor=vec4(mix(a,b,smoothstep(-.1,1.1,v)),1.);}`;
  const sh=(k,s)=>{const o=gl.createShader(k);gl.shaderSource(o,s);gl.compileShader(o);return o;};
  const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(pr);gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  const U=(k)=>gl.getUniformLocation(pr,k),still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mx=0,my=0,on=true,raf=0;
  const fit=()=>{const d=Math.min(1.5,devicePixelRatio||1)*.6;cv.width=cv.clientWidth*d;cv.height=cv.clientHeight*d;gl.viewport(0,0,cv.width,cv.height);};
  const draw=(ms)=>{gl.uniform2f(U('r'),cv.width,cv.height);gl.uniform1f(U('t'),ms/1000);gl.uniform2f(U('m'),mx,my);gl.drawArrays(gl.TRIANGLES,0,3);};
  const loop=(ms)=>{draw(ms);raf=on&&!still&&!document.hidden?requestAnimationFrame(loop):0;};
  const kick=()=>{if(!raf)raf=requestAnimationFrame(loop);};
  addEventListener('resize',()=>{fit();draw(performance.now());});addEventListener('pointermove',(e)=>{mx=e.clientX/innerWidth-.5;my=.5-e.clientY/innerHeight;},{passive:true});
  new IntersectionObserver(([e])=>{on=e.isIntersecting;if(on)kick();}).observe(cv);document.addEventListener('visibilitychange',kick);
  fit();kick();
}
```
WebGL이 없으면 캔버스 뒤 CSS 그라데이션이 그대로 보이게 둬요. 점·선·메시가 필요하면 OGL(`await import('https://cdn.jsdelivr.net/npm/ogl@1.0.11/+esm')`).

**캔버스 생성 그림**(별자리, 데이터 점, 풀숲, 입자 글자)
```js
const c=document.querySelector('canvas'),x=c.getContext('2d'),dpr=Math.min(2,devicePixelRatio||1);
let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647; // 늘 같은 그림
const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
function frame(t){/* 그리기: 손끝(pointermove) 가까운 점이 밀려나거나 이어지면 살아 있는 느낌 */ if(!still&&!document.hidden&&visible) requestAnimationFrame(frame);}
```
화면 밖이면 멈추고(`IntersectionObserver`), 움직임을 줄이면 한 장면만 그려요.

**움직이는 글자**: 낱말 단위로 감싸 줄바꿈을 지키고, 글자마다 `--i`를 줘 차례로 접혀 오르게.
```js
document.documentElement.classList.add('js');
for(const h of document.querySelectorAll('.kt')){const s=h.textContent.trim();h.setAttribute('aria-label',s);let i=0;
  h.innerHTML=s.split(' ').map((w)=>`<span class="w" aria-hidden="true">${[...w].map((ch)=>`<span style="--i:${i++}">${ch}</span>`).join('')}</span>`).join(' ');}
```
```css
.kt .w{display:inline-block;white-space:nowrap}.kt .w span{display:inline-block}
@media (prefers-reduced-motion:no-preference){.js .kt .w span{animation:fold .9s cubic-bezier(.2,.8,.2,1) calc(var(--i)*35ms) both}
@keyframes fold{from{opacity:0;transform:translateY(.5em) rotateX(-85deg);font-weight:200}}}
```
가변 굵기·폭이 손끝 거리에 따라 바뀌는 제목(`font-variation-settings`/`font-weight`를 `pointermove`로), 화면을 가로지르는 띠 글자(`@keyframes`로 `translateX(-50%)` 무한), 줄 단위 가려 올리기, 타자 커서(`steps()`), 형광펜 칠하기(`background-size:0 40%→100% 40%`).

**스크롤 이야기**: 핀으로 한 장면을 붙잡고 스크롤에 따라 장면을 바꿔요(GSAP는 학교·회사 망에서 막혀도 내용이 보이게).
```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/ScrollTrigger.min.js"></script>
```
```js
if(window.gsap&&window.ScrollTrigger){gsap.registerPlugin(ScrollTrigger);
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)',()=>{
    gsap.timeline({scrollTrigger:{trigger:'.story',start:'top top',end:'+=150%',pin:true,scrub:.6}})
      .from('.story .one',{scale:.7,opacity:0}).to('.story .track',{xPercent:-60}).from('.story .two',{clipPath:'inset(0 100% 0 0)'});
  });}
```
라이브러리 없이: `@supports (animation-timeline: view())` 안에서 `animation-timeline:view(); animation-range:entry 0% cover 40%`(등장), `animation-timeline:scroll(root)`(맨 위 진행선, 스크롤 따라 바뀌는 바탕색).

**3D 공간**: `perspective:900px` 무대 + `transform-style:preserve-3d` 종이·쪽·카드. 손끝 기울기는 `pointermove`로 `--rx`·`--ry`를 바꿔 `rotateX(var(--rx)) rotateY(var(--ry))`(가는 포인터에서만). 넘기는 쪽은 `rotateY(-180deg)` + `backface-visibility:hidden`.

**쪽 사이 이음**: 여러 쪽이면 CSS에 `@view-transition{navigation:auto}`와 같은 요소에 같은 `view-transition-name`을 주면 쪽을 옮길 때 제목·그림이 이어져 움직여요. 한 쪽 안의 탭·단계는 `document.startViewTransition(() => show(next))`.

**선과 모양**: SVG 선 그리기(`pathLength="1"`, `stroke-dasharray:1`, `dashoffset 1→0`), 점 수가 같은 `d`끼리 SMIL morph, 손그림 떨림(`feTurbulence` + `feDisplacementMap`).

**질감·빛**: 그레인은 `data:` SVG(`feTurbulence`)를 `::after`에 `mix-blend-mode:multiply`. 빛나는 선 `filter:drop-shadow(0 0 6px var(--glow))`, 유리 `backdrop-filter:blur(14px) saturate(1.3)`(떠 있는 막대에), 원근 격자 `perspective(700px) rotateX(62deg)` + `repeating-linear-gradient`. 무게감 있는 휠 스크롤은 Lenis(`lenis@1.3.27`, 터치·움직임 줄이기에서는 끄고 앵커 링크 확인).

움직임 줄이기: `@media (prefers-reduced-motion: reduce)`에서 반복·시차·스크롤 연출을 끄고, JS는 `matchMedia('(prefers-reduced-motion: reduce)').matches`로 확인.

## 4. 강의 사이트에서 자주 쓰는 무늬

- **시간 막대**: 일정을 길이에 비례한 띠로, 지금 시각 표시. 쉬는 시간은 빗금.
- **실습 레일**: 번호·진행 표시와 단계(`data-lp-step`). 단계마다 '이 단계에서 할 일 한 줄 + 복사할 원문'.
- **프롬프트 카드**: 원문 그대로 + 복사 버튼(`data-copy-text`), 바꿔 쓸 자리 표시, 역할·상황·과제·형식을 채우면 완성되는 조립기.
- **쪽 그림 잇기**: '교재 8쪽' 꼬리표 → `#deck-p8`, 쪽 그림 띠, 지금 설명하는 쪽.
- **전후 비교**: 나쁜 예에 빨간 줄, 좋은 예에 손글씨 메모.
- **체크리스트**: 준비물·검토 기준을 눌러 표시(이 기기에만 저장).
- **타이머 버튼**: 실습 시간과 같은 분.
- **마무리**: 오늘 만든 것, 과제 마감, 설문, 다음 일정.
- **쪽 나누기**: 실습이 길면 실습마다 쪽을 나누고 같은 길잡이로 오가기.
- **한 장 요약·낱말 사전·퀴즈**(투표 키트).

## 5. AI 티 점검표(스스로 판단용)

자주 보이는 기본값이에요. 이유가 있으면 써도 되지만, 무심코 나왔다면 이 연수의 컨셉에서 나온 결정으로 바꿔요.
- 보라→파랑 그라데이션(특히 `#667eea → #764ba2`), 남보라 강조색
- 가운데 정렬 제목 + 버튼 둘 + 아래 같은 카드 세 장
- 같은 크기 카드 격자, 상자 속 상자, 상자 한쪽 굵은 색 띠
- 이모지 아이콘, 흔한 아이콘 세트만, 알약 꼬리표 남발
- 모든 섹션이 아래에서 떠오르는 등장, 모든 곳에 빛(glow)
- 뜻 없는 3D 덩어리·구체·물방울, 그라데이션 글자 남발
- 시스템 글꼴·Inter 한 벌, 제목 위 영어 대문자 꼬리말
- 모든 섹션이 같은 리듬(작은 머리말 → 제목 → 설명 → 카드)
- 안전하게만 고른 지면: 미색 바탕에 줄과 상자뿐, 첫 화면에 움직이는 장면이 없음, 교재 장르(공문·보고서·슬라이드)를 그대로 흉내 냄
- "함께 성장하는" 같은 빈 구호, 가짜 수치·가짜 후기

사람이 만든 티: 교재에서 나온 구체적인 제목·숫자·말, 컨셉에서만 나올 수 있는 살아 있는 첫 화면 장면, 크기 차이가 큰 위계, 비대칭과 리듬 있는 여백, 실제 쪽 그림, 대담한 결정 하나.
