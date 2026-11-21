# 디자인 서재

필요할 때 꺼내 쓰는 낱말과 기법 모음이에요. **규칙이 아니고 따를 의무도 없어요.** 출발점은 늘 지금 교재와 연수예요. 여기 있는 결을 섞어도 되고, 여기 없는 방식을 써도 돼요. 아래 코드 조각은 lecpage 사이트의 보안 정책(CSP) 안에서 그대로 돌아가요.

- 보안 정책 요약: 스크립트는 사이트 안(인라인도 조립이 파일로 옮김)과 jsDelivr의 `gsap@3.15.1`·`lenis@1.3.27`·`ogl@1.0.11`만. 바깥 CSS는 글꼴(fonts.googleapis.com·cdn.jsdelivr.net·hangeul.pstatic.net)만. 그림은 사이트 안 파일·교재 쪽 그림·`data:`·인라인 `<svg>`·canvas. Web Worker는 막혀 있어요.

## 1. 결(아트 디렉션)

교재의 성격에서 하나를 고르거나 둘을 섞어요(바탕 결 하나 + 강조 결 한 점). 결은 첫 화면 한 장면과 반복되는 모티프 두세 개로 드러나면 충분해요.

| 결 | 어울리는 교재 | 대표 기법 | 함정 |
|---|---|---|---|
| 편집·잡지 | 이야기·인문·성찰·독서 | 큰 명조 제목과 가는 본문, 비대칭 2단, 넉넉한 여백, 굵은 선·가는 선 장 구분, 번호 붙인 장, 쪽 그림 캡션, 드롭캡 | 본문 글자가 작아짐, 장식 명조를 본문에 |
| 스위스 격자 | 행정·정책·데이터·안내 | 12칸 격자, 왼쪽 정렬, 굵은 그로테스크, 아주 큰 숫자, 강조색 하나, 선으로만 구분 | 차갑기만 함, 모든 정보가 같은 무게 |
| 리소그래프·인쇄 | 예술·지역·워크숍·청소년 | 별색 두세 개를 `mix-blend-mode: multiply`로 겹침, 1~2px 어긋난 판, 망점·그레인, 거친 종이 | 글자 대비 부족, 글자에도 질감 |
| 손그림 공책 | 교사 실습·초등·성찰·상담 | 줄 공책 바탕, 손글씨 메모, 빨간 펜 동그라미·밑줄(선 그리기), 붙임쪽지, 연필 | 손글씨를 본문에, 귀엽기만 함 |
| 설계도·기술 도면 | 공학·코딩·과학·메이커 | 모눈, 치수선·지시선 SVG, 고정폭 숫자, 청사진 남색, 부품 번호 | 어두운 화면 일색, 작은 글자 |
| 데이터 시각화 | 통계·평가·데이터 리터러시 | 길이에 비례한 막대, 손으로 그린 차트 SVG, 아주 큰 자릿수 고정 숫자, 작은 꺾은선 | 장식용 가짜 차트, 근거 없는 숫자 |
| 포스터·글자 | 특강·행사·캠페인·축제 | 화면을 채우는 큰 글자(`clamp()` + `vw`), 좁고 굵은 제목체, 강한 색 면, 기운 띠 | 정보가 안 보임, 읽기 어려움 |
| 콜라주·스크랩북 | 지역·역사·프로젝트 수업 | 오려 붙인 쪽 그림(`clip-path`·기울기), 테이프·스티커, 겹친 종이 그림자 | 어수선함, 그림 위 글자 대비 |
| 레트로 아케이드·픽셀 | 게임 기반 학습·코딩·초등 | 픽셀 글꼴, 점수판·체력 막대로 진행 표시, 격자 `rect`로 그린 8비트 그림, 깜빡이는 커서 | 가독성, 유치함 |
| 네온·유리(밤) | 디지털·미래·AI·사회정서(밤하늘 은유) | 어두운 바탕, 빛나는 선 그림(SVG + `drop-shadow`), `backdrop-filter` 유리 막대, 원근 격자, 그라데이션 제목 한 곳 | 모든 곳에 빛, 대비 부족, 무거움 |
| 따뜻한 미니멀 | 학부모 설명회·상담·복지·돌봄 | 미색 바탕, 큰 여백, 둥근 고딕, 따뜻한 색 하나, 작은 선화 | 너무 밋밋함 |
| 공문·기관 | 직무연수·행정·설명회 | 교표·이중선 장 제목, □ 표시, 줄만 있는 표, 회신서 절취선 | 딱딱함(숨 쉬는 그림 한 점이 풀어 줌) |
| 칠판·교실 | 수업 기술·교과 연수 | 칠판 녹색, 분필 글씨, 지우개 자국(필터), 자석 꼬리표 | 어두운 바탕의 긴 글 |
| 자연·계절 | 환경·생태·숲 교육 | 유기적 곡선(근거 있는 모양), 잎·물결 선화, 계절 색 이동 | 의미 없는 덩어리(blob) |
| 어두운 키노트 | 기술 발표·리더십 특강 | 한 화면 한 문장, 아주 큰 숫자, 스크롤에 따라 바뀌는 장 | 정보 찾기 어려움 |
| 지도·답사 | 현장 체험·답사·진로 | 길 선(SVG path)이 스크롤 따라 그려짐, 지점 번호, 범례 | 길이 내용과 무관 |

## 2. 한국어 글꼴 짝(무료, 위 CSP 호스트)

구글 폰트는 `https://fonts.googleapis.com/css2?family=이름:wght@…&display=swap`(확인함: 아래 구글 폰트 전부 200). 제목 전용 글꼴은 `&text=쓴글자`로 그 글자만 받으면 가벼워요. 줄바꿈은 `word-break: keep-all; overflow-wrap: break-word;`, 제목은 `text-wrap: balance`.

| 결 | 제목 | 본문 | 숫자·영문 |
|---|---|---|---|
| 편집 | Noto Serif KR · Hahmlet | Asta Sans · IBM Plex Sans KR | Fraunces · Instrument Serif |
| 편지·성찰 | Gowun Batang · Diphylleia | Gowun Dodum | Instrument Serif |
| 포스터 | Black Han Sans · Gasoek One | Gothic A1 · 프리젠테이션 | Anton |
| 무대·특강 | 페이퍼로지 800 | Asta Sans | Bricolage Grotesque |
| 기술·도면 | IBM Plex Sans KR 700 | IBM Plex Sans KR | IBM Plex Mono |
| 공책·손그림 | 제목은 Gowun Batang, 메모는 Gaegu · Nanum Pen Script | Gowun Dodum | Caveat |
| 둥근·친근 | Jua · Do Hyeon | Gowun Dodum · Pretendard | Bricolage Grotesque |
| 미래 | Orbit | Asta Sans | Space Grotesk |
| 고전·인문 | Song Myung · Nanum Myeongjo | Nanum Myeongjo · Gowun Batang | Fraunces |
| 픽셀 | Galmuri11 | Pretendard | Galmuri |
| 공문 | Gothic A1 800 | Pretendard | IBM Plex Sans KR |

jsDelivr(버전 고정, 확인함):
- Pretendard `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css`
- 페이퍼로지 `https://cdn.jsdelivr.net/gh/ayaan-fonts/Paperlogy@1.001-ko/fonts/webfonts/Paperlogy-dynamic-subset.css`
- 프리젠테이션 `https://cdn.jsdelivr.net/gh/ayaan-fonts/Freesentation@1.004/fonts/webfonts/Freesentation-dynamic-subset.css`
- Galmuri `https://cdn.jsdelivr.net/npm/galmuri@2.40.3/dist/galmuri.css`

숫자: `font-variant-numeric: tabular-nums;`. 제목 자간은 -0.02~-0.04em이 한글 큰 글자에서 단단해 보여요.

## 3. 움직임과 그림 기법

움직임은 의미 있는 순간 한두 곳에 몰아요(첫 화면 장면, 대표 그림 하나). 실습·복사·질문 자리는 가만히 둬요. 쉬는 모습이 완성된 모습이게: JS가 없거나 움직임을 줄인 사람에게도 내용이 처음부터 다 보여요.

**SVG 선 그리기** (빨간 펜 동그라미, 지도 위 길, 설계도 선)
```html
<svg viewBox="0 0 200 80"><path class="draw" pathLength="1" d="M10 40 C 60 0, 140 80, 190 40" fill="none" stroke="currentColor" stroke-width="3"/></svg>
```
```css
.draw{stroke-dasharray:1;stroke-dashoffset:0}
@media (prefers-reduced-motion:no-preference){.draw{animation:draw 1.2s .3s ease-out both}@keyframes draw{from{stroke-dashoffset:1}}}
```

**스크롤에 묶인 등장·진행**(지원하는 브라우저만, 나머지는 정지 모습)
```css
@supports (animation-timeline: view()){@media (prefers-reduced-motion:no-preference){
  .rise{animation:rise linear both;animation-timeline:view();animation-range:entry 0% cover 30%}
  @keyframes rise{from{opacity:.0;transform:translateY(24px)}}
  .progress{position:fixed;inset:0 0 auto;height:3px;transform-origin:left;animation:grow linear;animation-timeline:scroll(root)}
  @keyframes grow{from{transform:scaleX(0)}}
}}
```

**JS로 한 번 등장**(모든 브라우저): 처음부터 숨기지 말고 `document.documentElement.classList.add('js')`를 붙인 뒤 `.js .rv{opacity:0}` → `IntersectionObserver`로 `.in`. 스크롤 동작이 `smooth`여도 동작하게 `rootMargin`을 넉넉히.

**View Transitions**(탭·단계 바꾸기): `if (document.startViewTransition) document.startViewTransition(() => show(next)); else show(next);` + `::view-transition-old(root),::view-transition-new(root){animation-duration:.25s}`.

**모양 바꾸기(morph)**: 점 개수가 같은 두 `d`를 SMIL로 `<animate attributeName="d" dur="3s" repeatCount="indefinite" values="M…;M…;M…"/>`. 반복은 멈출 수 있게(5초 넘으면 정지 단추나 화면 밖에서 멈춤).

**캔버스 입자·생성 그림**(별자리, 데이터 점, 꽃가루)
```js
const c=document.querySelector('canvas'),x=c.getContext('2d'),dpr=Math.min(2,devicePixelRatio||1);
let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647; // 늘 같은 그림
const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
function frame(t){/* 그리기 */ if(!still&&!document.hidden&&visible) requestAnimationFrame(frame);}
```
화면 밖이면 멈추고(`IntersectionObserver`), 움직임을 줄이면 한 장면만 그려요.

**질감**: 그레인·종이 결은 `data:` SVG 필터로 그림 없이.
```css
.grain::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.18;mix-blend-mode:multiply;
background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
```
손그림 떨림: SVG `<filter><feTurbulence baseFrequency="0.02" numOctaves="2"/><feDisplacementMap in="SourceGraphic" scale="3"/></filter>`를 선에.

**빛·유리·원근**: 빛나는 선 `filter:drop-shadow(0 0 6px var(--glow))`(한두 곳만). 유리 `background:rgb(255 255 255/.08);backdrop-filter:blur(14px) saturate(1.3);border:1px solid rgb(255 255 255/.15)`(떠 있는 막대에만). 원근 격자 `transform:perspective(700px) rotateX(62deg)` + `repeating-linear-gradient` 선, `background-position`을 천천히 움직이면 앞으로 나아가는 느낌.

**글자 장면**: 줄 단위로 가려 올리기(`overflow:hidden` 안쪽 `translateY(100%)→0`), 타자 커서(`steps()`), 형광펜 칠하기(`background-size:0 40%→100% 40%`).

**라이브러리**(쓰면 무거워지니 꼭 필요할 때만, 학교·회사 망에서 막히면 정지 모습이 되게)
- GSAP + ScrollTrigger: `https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/gsap.min.js`, `…/ScrollTrigger.min.js` — 핀 + scrub 장면. `gsap.matchMedia()`로 움직임 줄이기 분기.
- Lenis: `https://cdn.jsdelivr.net/npm/lenis@1.3.27/dist/lenis.min.js` — 무게감 있는 휠 스크롤. 터치·움직임 줄이기에서는 켜지 않기, 앵커 링크 확인.
- OGL(WebGL): `await import('https://cdn.jsdelivr.net/npm/ogl@1.0.11/+esm')` — 셰이더 배경 한 장면. 절반 해상도·초당 30회면 충분.

움직임 줄이기: `@media (prefers-reduced-motion: reduce)`에서 반복·시차·스크롤 연출을 끄고, JS는 `matchMedia('(prefers-reduced-motion: reduce)').matches`로 확인. `transform`·`opacity`만 움직이면 휴대폰에서도 부드러워요.

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

자주 보이는 기본값이에요. 이유가 있으면 써도 되지만, 무심코 나왔다면 교재에서 나온 결정으로 바꿔요.
- 보라→파랑 그라데이션(특히 `#667eea → #764ba2`), 남보라 강조색
- 가운데 정렬 제목 + 버튼 둘 + 아래 같은 카드 세 장
- 같은 크기 카드 격자, 상자 속 상자, 상자 한쪽 굵은 색 띠
- 이모지 아이콘, 흔한 아이콘 세트만, 알약 꼬리표 남발
- 모든 섹션이 아래에서 떠오르는 등장, 모든 곳에 빛(glow)
- 뜻 없는 3D 덩어리·구체·물방울, 그라데이션 글자 남발
- 시스템 글꼴·Inter 한 벌, 제목 위 영어 대문자 꼬리말
- 모든 섹션이 같은 리듬(작은 머리말 → 제목 → 설명 → 카드)
- "함께 성장하는" 같은 빈 구호, 가짜 수치·가짜 후기

사람이 만든 티: 교재에서 나온 구체적인 제목·숫자·말, 주제를 상징하는 직접 그린 그림 한 점, 크기 차이가 큰 위계, 비대칭과 리듬 있는 여백, 실제 쪽 그림, 대담한 결정 하나.
