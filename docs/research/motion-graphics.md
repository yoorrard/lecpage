# 모션·그래픽 효과 조사와 LecFX 구현 기록

작성: 2026-11-09 · 대상: `skills/lecpage/engine/runtime/fx/`(LecFX), `engine/src/design/fx-catalog.js`, `engine/src/design/seeds.js`

연수 사이트가 "수상작 포트폴리오 같은" 인상을 주되, 연수라는 쓰임(읽기·실습·접속 환경이 제각각인 학교망·태블릿)을 해치지 않도록 효과를 고르고 만든 기록입니다. 계약은 `docs/architecture.md` §3(토큰)·§4(FX 레지스트리)를 따릅니다.

---

## 1. 한 줄 결론

- 효과 **52종**을 바닐라 JS로 만들었습니다(글자 11 · 스크롤·배치 10 · 상호작용 9 · 그래픽 19 · 라이브러리 3). 대부분 3KB 안팎, 전부 합쳐 gzip 32KB. 빌드는 쓰는 효과만 넣습니다.
- 공통 규칙은 core가 책임집니다: **쉬는 상태 = 완성 상태**, 동작 줄이기 존중, **움직임 멈춤/재생** 버튼(자동 삽입·저장), 화면 밖·탭 숨김 정지, 저사양 정지 화면, DPR 2 상한, 외부 스크립트는 jsDelivr 버전 고정 URL만.
- 라이브러리는 강도 3에서만 지연 로드합니다: **Lenis 1.3.27**, **GSAP 3.15.1 + ScrollTrigger**, **OGL 1.0.11**. 실패해도 화면은 그대로입니다.

## 2. 살펴본 곳과 가져온 것

> Codrops·GitHub는 이 작업 환경의 curl에 403(봇 차단)을 돌려주어, 아래 Codrops 주소는 2026-11-09 웹 검색 결과로 존재를 확인했습니다. 나머지는 curl 200을 확인했습니다.

### 2.1 수상작·갤러리
| 곳 | 주소 | 본 것 | 가져온 것 |
|---|---|---|---|
| Awwwards 스토리텔링·스크롤 모음 | https://www.awwwards.com/websites/storytelling/ · https://www.awwwards.com/websites/scrolling/ | 2026 SOTD 다수가 "한 번의 강한 등장 + 조용한 본문"과 스크롤에 묶인 색·톤 변화를 씀 | `tone-journey`, `split-reveal`(lines), `scroll-fill` |
| Awwwards SOTD "The Power of Storytelling"(2026-06) | https://www.awwwards.com/sites/the-power-of-storytelling | 스크롤 길이 자체가 이야기 장(章)이 됨 | `sticky-scrolly`, `zoom-through` |
| Godly | https://godly.website/ | 그레인·메시 그라데이션·셰이더 배경, 커서 조명, 테두리 빛줄기가 2025~26 흐름 | `grain`, `mesh-gradient`, `shader-gradient`, `spotlight`, `border-beam` |
| Lenis(darkroom.engineering) | https://lenis.darkroom.engineering/ | 수상작 대부분이 쓰는 무게감 있는 휠 스크롤 | `smooth-scroll`(강도 3, 터치·저사양 제외) |

### 2.2 Codrops 기법
| 글 | 주소 | 핵심 기법 | 반영 |
|---|---|---|---|
| Making Stagger Reveal Animations for Text(2020) | https://tympanus.net/codrops/2020/06/17/making-stagger-reveal-animations-for-text/ | 줄을 overflow로 가리고 안쪽을 밀어 올리는 마스크 등장 | `split-reveal` |
| From SplitText to MorphSVG: 5 Creative Demos(2025-05) | https://tympanus.net/codrops/2025/05/14/from-splittext-to-morphsvg-5-creative-demos-using-free-gsap-plugins/ | GSAP 전 플러그인 무료화, SplitText `mask: "lines"` | 라이선스 판단, `split-reveal` 구조 |
| Flim(GSAP+Webflow) 사례(2026-01) | https://tympanus.net/codrops/2026/01/14/a-site-for-sore-eyes-combining-gsap-and-webflow-to-showcase-flim/ | ScrollTrigger `once` + 줄 단위 슬라이드 업 | 진입 효과는 한 번만 |
| Joffrey Spitzer 포트폴리오(2026-02) | https://tympanus.net/codrops/2026/02/18/joffrey-spitzer-portfolio-a-minimalist-astro-gsap-build-with-reveals-flip-transitions-and-subtle-motion/ | 미니멀 + 절제된 등장 | `reveal-up` 기본값(18px, 총 지연 0.42초 상한) |
| On-Scroll Animation Ideas for Sticky Sections(2024-01) | https://tympanus.net/codrops/2024/01/31/on-scroll-animation-ideas-for-sticky-sections/ | sticky 섹션을 겹쳐 쌓기·접기 | `stack-cards`, `sticky-scrolly` |
| Sticky Grid Scroll(2026-03) | https://tympanus.net/codrops/2026/03/02/sticky-grid-scroll-building-a-scroll-driven-animated-grid/ | sticky 장면 + 스크롤 진행률 타임라인(GSAP·Lenis) | `gsap-scroll`(pin + scrub) |
| Built to Move: Eduard Bodak 포트폴리오(2025-07) | https://tympanus.net/codrops/2025/07/29/built-to-move-a-closer-look-at-the-animations-behind-eduard-bodaks-portfolio/ | 스크롤 3D 카드 | `tilt`(포인터), `stack-cards` |
| Practical Intro to Scroll-Driven Animations(2024-01) | https://tympanus.net/codrops/2024/01/17/a-practical-introduction-to-scroll-driven-animations-with-css-scroll-and-view/ | CSS `scroll()`/`view()`, 동작 줄이기 감싸기 | 사파리·삼성 인터넷 지원 편차 때문에 JS 한 번 읽기·한 번 쓰기 방식 채택(아래 4.3) |
| Creating 3D Scroll-Driven Text Animations(2025-11) | https://tympanus.net/codrops/2025/11/04/creating-3d-scroll-driven-text-animations-with-css-and-gsap/ | 스크롤에 묶인 글자 변형 | `kinetic-weight`(가변 굵기), `scroll-fill` |
| Interactive WebGL Backgrounds: Bayer Dithering(2025-07) | https://tympanus.net/codrops/2025/07/30/interactive-webgl-backgrounds-a-quick-guide-to-bayer-dithering/ | 조각 셰이더 배경 + 포인터 | `shader-gradient`(라이브러리 없이 4KB) |
| Abstract Image Slideshow with OGL(2021) | https://tympanus.net/codrops/2021/08/16/abstract-image-carousel-ogl-glsl-gsap/ | OGL + 잡음 텍스처 배경 | `three-hero`를 three.js 대신 OGL로 |
| The Sleepers: Lightweight Atmospheric WebGL(2026-07) | https://tympanus.net/codrops/2026/07/10/the-sleepers-creating-an-atmospheric-webgl-experience-with-lightweight-techniques/ | 낮은 해상도·적은 프레임으로 분위기 유지 | 셰이더 절반 해상도·초당 30회 |
| Risograph Grain Light Effect(2022) | https://tympanus.net/codrops/2022/03/07/creating-a-risograph-grain-light-effect-in-three-js/ | 리소 망점·그레인 | `riso`·`grain`을 WebGL 없이 CSS 마스크로 |

### 2.3 함께 읽은 지침
- GSAP 공식 스킬(gsap-core·scrolltrigger·performance·plugins): `gsap.matchMedia()`로 동작 줄이기, ScrollTrigger는 위에서 아래 순서로 만들기, transform·opacity만, `quickTo`로 포인터 따라가기.
- impeccable(animate·delight·quieter·overdrive): "한 번의 작가적 순간 + 조용한 나머지", 피드백 100~150ms, 등장 500~800ms, 퇴장은 더 빠르게, 바운스·엘라스틱 자제, 5초 넘는 반복은 멈춤 가능.
- Anthropic frontend-design·algorithmic-art: 모든 섹션 fade-up은 생성형 티가 남(그래서 `reveal-up`은 "목록이 목록으로 나타날 때"만 권장), 씨앗 있는 무작위(seeded)로 매번 같은 그림.
- WCAG 2.2: 2.2.2 일시 정지·정지·숨기기 https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html , 2.3.3 상호작용 애니메이션 https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- View Transitions(MDN): https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
- ui-ux-pro-max-skill 데이터(MIT): motion.csv(강도 단계·지속 시간), colors.csv·typography.csv(팔레트 분류·대비 점검 방식), google-fonts.csv(한글 글꼴 목록) — seeds.js는 이것을 참고해 새로 만들었습니다.

## 3. 오픈소스 라이브러리

| 이름 | 고정 버전 · jsDelivr URL | 라이선스 | 크기(gzip) | 언제 |
|---|---|---|---|---|
| Lenis | `https://cdn.jsdelivr.net/npm/lenis@1.3.27/dist/lenis.min.js` (UMD, `window.Lenis`) | MIT | 5.4KB | `smooth-scroll`. 정밀 포인터·저사양 아님·동작 줄이기 아님일 때만. 스타일은 fx.css `@fx:smooth-scroll` 묶음에 내장 |
| GSAP | `https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/gsap.min.js` | GreenSock Standard License(무료·상업 사용 가능, https://gsap.com/standard-license/ ; 웹플로 인수 후 전 플러그인 무료 https://gsap.com/blog/webflow-GSAP/ ) | 28.6KB | `gsap-scroll` 하나만 씀 |
| ScrollTrigger | `https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/ScrollTrigger.min.js` | 위와 같음 | 18.0KB | 핀 + scrub. 넓은 화면만 고정 |
| OGL | `https://cdn.jsdelivr.net/npm/ogl@1.0.11/+esm` (jsDelivr가 묶은 ESM, 동적 import) | Unlicense | 39.3KB | `three-hero`. three.js(r187, three.module.min.js만 392KB+core)는 너무 커서 뺌 |
| rough.js | (쓰지 않음) `roughjs@4.6.6/bundled/rough.js` 27.8KB | MIT | — | 손그림 선은 약 1KB 자체 알고리즘(이중 획 + 휨 + 겹침 타원)으로 대체 |

모든 URL은 2026-11-09 curl 200 확인. core의 `ctx.load()`·`ctx.esm()`는 `cdn.jsdelivr.net/(npm|gh)/이름@숫자…` 꼴과 같은 사이트 상대 경로만 허용하고, 실패·12초 시간 초과면 `false`/`null`을 돌려줍니다(USB·오프라인 배포는 같은 경로에 사본을 두면 됨).

## 4. 만든 것

### 4.1 core(`runtime/fx/core.js`, 28KB · gzip 10KB)
- `LecFX.define(id, spec)`, `LecFX.start(root?)`(DOMContentLoaded 자동, 정의가 늦어도 그 효과만 다시 훑음), `LecFX.stop(root?)`, `pause()/resume()/toggle()/isPaused()`, `swap(fn)`(View Transitions 감싸기), `celebrate(o)`·`copied(btn)`(효과가 없으면 조용히 무시되는 신호), `state()`, `util`, `boot`(깜빡임 방지 인라인 스니펫).
- ctx(계약 §4): `reduced` · `level` · `lowPower` · `load(url)` · `visible(el, cb, {once, threshold, rootMargin})` · `token(name)` · `onPause(cb)` 에 더해 `esm`, `rgb/color/light`(토큰→캔버스 색), `onTheme`, `onScroll(read→write 두 단계, 화면 근처에서만)`, `enter`(진입 대기·해제), `layer`(꾸밈 층 aria-hidden), `canvas`(DPR≤2·ResizeObserver), `loop`(보일 때·탭 보일 때·멈춤 아님·동작 줄이기 아님·저사양 아님에서만 rAF, 아니면 정지 화면 한 장), `surface('dark')`(밝은 테마에서도 영역만 어두운 토큰으로, 글자·주 색 대비 4.5 이상 계산), `fail`.
- 강도: `<html data-motion="0..3">`(기본 2). 효과 level이 크면 init을 부르지 않습니다. **level 0 = 기능형**(guided-progress, micro-copy)이라 모션 0 사이트에서도 동작합니다.
- 멈춤: `localStorage['lecfx-motion']` = `off`(멈춤) · `on`(OS 동작 줄이기보다 사용자의 재생 선택 우선) · 없음(OS 따름). `[data-fx-toggle]` 버튼을 자동 연결하고, 반복 효과가 있는데 버튼이 없으면 왼쪽 아래에 "움직임 멈춤" 버튼을 붙입니다(`<html data-fx-toggle="off">`로 끔).
- 저사양: `hardwareConcurrency ≤ 4 || deviceMemory ≤ 4 || saveData`. `<html data-fx-lowpower="0|1">`로 강제 가능.
- 안전망: init 예외 → 정리 함수 실행, `data-fx-pre` 해제, `data-fx-error` 표시, `console.warn`만. 인쇄 직전 모든 대기 해제. fx.css에 동작 줄이기·인쇄 시 `[data-fx-pre]`를 강제로 보이게 하는 규칙.
- 한국어 글자 나누기(`util.split`): 낱말(공백 사이)을 줄바꿈되지 않는 덩어리(`.fx-w` nowrap, 글자 모드는 `.fx-wc` inline-block)로 감싸고 공백은 텍스트로 남깁니다 → `word-break: keep-all`과 같은 줄바꿈. 원문은 `.fx-sr` 숨김 글로 낭독기에 주고 나눈 조각은 `aria-hidden`. 링크·버튼이 든 요소는 구조를 지키며 나눕니다.

### 4.2 효과 52종

강도(L) 0 기능 · 1 차분 · 2 보통 · 3 화려. ↻ = 5초 넘게 스스로 움직임(멈춤 대상).

**글자** — 제목 하나에 "작가적 순간" 하나
| id | L | 주 슬롯 | 왜 |
|---|---|---|---|
| split-reveal | 2 | hero.title, section.title | 수상작의 대표 등장. 줄 단위 마스크 + 4° 기울기 |
| kinetic-weight | 2 | hero.title | 가변 글꼴(프리텐다드·SUIT·원티드)의 굵기 축을 살림 |
| scroll-fill | 2 | message | 핵심 문장을 천천히 읽게 함(SEL·정책 설명) |
| scramble | 2 | hero.title, numbers | 한글 음절 풀로 섞여 AI·코딩 주제에 맞음 |
| gradient-text ↻ | 1 | hero.title | 미래·놀이 분위기. 흔한 연출이라 'warn' |
| marquee ↻ | 2 | divider | 키워드 띠, 구분선 |
| counter | 1 | numbers | 한눈에 보기 숫자(명·%·시간·쉼표 유지) |
| typewriter | 2 | hero.title | 한글 자모 조합 타자(ㅎ→하→한). 최종 배치를 먼저 잡아 줄 흔들림 없음 |
| highlight-sweep | 1 | message | `<mark>`에 형광펜. 연수 자료의 "중요" 표시 문법 |
| word-rotate ↻ | 2 | hero.title | 세 바퀴 돌고 스스로 멈춤 |
| link-underline | 1 | list | 링크가 많은 자료 목록 |

**스크롤·배치**
| id | L | 주 슬롯 | 왜 |
|---|---|---|---|
| reveal-up | 1 | section.enter, cards, list | 조용한 기본값. 키 큰 섹션도 확실히 잡히는 진입 판정(윗변이 화면 88% 선을 넘을 때 + 60% 보일 때) |
| clip-reveal | 2 | gallery | 사진 마스크 열기(위·원·사선·왼쪽) |
| parallax-soft | 2 | gallery, scroll | 속도 차 ≤10%, 모바일 60% |
| line-draw | 2 | schedule, divider | 일정표 세로 레일·점 / SVG 선 / 구분 띠(낱말 사이 선이 차오름) |
| guided-progress | 0 | progress | 진행 막대 + 단계 점(링크, aria-current="step") + 모바일 칩(스크롤 중에만) |
| sticky-scrolly | 2 | message, schedule | 고정 그림 스크롤리텔링, 그림이 없으면 큰 번호·진행 고리 자동 |
| stack-cards | 2 | cards | 1부·2부… 카드가 쌓이며 장(章) 감각 |
| horizontal-snap | 1 | gallery, cards | 도구 카드 가로 넘김(버튼·키보드·끌기) |
| tone-journey | 2 | scroll | 밤→새벽→낮→밤. 참고 사이트(SEL 밤 톤)의 핵심 연출을 토큰 계산으로 일반화 |
| zoom-through | 3 | hero.graphic | 액자→화면 가득(clip-path) |

**상호작용**
| id | L | 주 슬롯 | 왜 |
|---|---|---|---|
| magnetic | 2 | hero.cta | 대표 버튼 1~2개 |
| tilt | 2 | cards | 3D 기울기 + 반사광(밝은 색은 토큰에서 계산) |
| spotlight | 2 | cursor, cards | 어두운 섹션 조명 / 카드 테두리 조명. 커서는 그대로 |
| cursor-follower | 3 | cursor | 포트폴리오 느낌. 연수에선 대개 과해 'warn' |
| micro-copy | 0 | cards, list | 프롬프트 복사 피드백 + aria-live |
| confetti | 2 | celebrate | 실습 완료 순간만, 0.95초 |
| ripple | 1 | hero.cta | 누름 피드백 |
| view-transition | 1 | cards, list | 정거장 탭·필터 전환 잇기 |
| border-beam ↻ | 2 | hero.cta, cards | AI·에듀테크 강조 카드 |

**그래픽 배경**(hero.graphic·closing.graphic, 꾸밈 층은 aria-hidden·클릭 통과·화면 밖 정지)
| id | L | 방식 | 어울리는 연수 |
|---|---|---|---|
| aurora ↻ | 2 | CSS 빛띠(흐림 필터 없음) | 상담·SEL·환경 |
| mesh-gradient ↻ | 1 | CSS + @property | 무난한 기본 |
| grain | 1 | 잡음 마스크 × 글자색 | 겹쳐 쓰는 질감(테마 자동) |
| perspective-grid ↻ | 2 | CSS 3D 바닥 + 줄무늬 해 | 밤 톤 SEL·음악·레트로 |
| starfield ↻ | 2 | 캔버스 | 밤 톤 SEL·독서 |
| particles-network ↻ | 3 | 캔버스 | AI(낡은 느낌이라 'warn') |
| dot-grid ↻ | 2 | 캔버스 물결 점 | 코딩·수학·에듀테크 |
| topo-lines ↻ | 2 | 캔버스 마칭 스퀘어 등고선 | 환경·과학·진로 |
| waves ↻ | 1 | SVG 3겹 | 마무리·구분 띠 |
| blobs-morph ↻ | 2 | SVG Catmull-Rom 덩어리 | 상담·학부모 |
| bokeh ↻ | 2 | CSS 빛망울 | 감성 마무리 |
| paper-stack | 1 | DOM 활동지 묶음 | 워크북·실습형(참고 사이트 B의 활동지 그림) |
| doodle-scribbles | 2 | SVG 자체 rough | 손맛, 제목 주석 |
| confetti-shapes | 1 | SVG 멤피스 | 초등 수학·놀이 |
| chalkboard | 2 | SVG 분필(正·화살표·별·+·=) | 교실·수학·국어 |
| shader-gradient ↻ | 3 | WebGL 4KB | AI·미래(글 쪽은 바탕으로 가림) |
| noise-orb ↻ | 2 | CSS 구 | AI 비서 느낌 |
| riso | 1 | CSS 망점 2도 | 독서·미술·잡지 |
| blueprint-grid | 1 | CSS 모눈 + 좌표 십자선 | 코딩·메이커 |

**라이브러리(강도 3)**: smooth-scroll(Lenis), gsap-scroll(GSAP ScrollTrigger), three-hero(OGL 점 구름 구체).

### 4.3 왜 CSS scroll-driven animations 대신 JS 한 번 읽기·한 번 쓰기인가
`animation-timeline: view()`는 2026 기준 크롬·사파리 26에서 되지만 학교 보급형 기기의 구형 사파리·삼성 인터넷 편차가 커서, core의 `onScroll`(모든 구독자 읽기 → 모든 쓰기, 프레임당 1회, 화면 근처 요소만)로 통일했습니다. 쓰는 값은 transform·CSS 변수뿐입니다.

### 4.4 분위기별 권장 조합(결정 규칙 참고용)
| 연수 성격 | hero.title | hero.graphic | 본문 | 기타 |
|---|---|---|---|---|
| 차분한 SEL·상담(밤 이야기) | split-reveal(lines) | starfield 또는 perspective-grid(밤) + grain | scroll-fill, reveal-up | tone-journey, line-draw(일정), confetti(다짐 완료) |
| 발랄한 초등 수학 | word-rotate 또는 doodle-scribbles(circle) | confetti-shapes 또는 chalkboard | reveal-up, counter | highlight-sweep, ripple, confetti |
| 미래적 AI·에듀테크 | scramble | shader-gradient(L3) / noise-orb(L2) / dot-grid | spotlight(cards), border-beam | micro-copy, view-transition, magnetic |
| 격식 있는 교육청 설명회 | (없음) 또는 split-reveal(words) | mesh-gradient(정지) 또는 blueprint-grid | counter, line-draw, reveal-up | guided-progress, link-underline. 모션 1 권장 |
| 워크북·실습형 | highlight-sweep | paper-stack + grain | horizontal-snap(도구), stack-cards | micro-copy, confetti |

## 5. 디자인 씨앗(`src/design/seeds.js`)
- 팔레트 34종(라이트·다크 쌍). 스크립트로 대비를 계산·보정: 글자/바탕 ≥ 7, 주 색/바탕 ≥ 4.5(링크), 주 색/primaryForeground ≥ 4.5, 글자/muted ≥ 4.5, accent/바탕 ≥ 3. 보정 19건(주로 밝은 테마의 노랑·주황 강조 색을 어둡게). accent2·accent3은 장식 전용.
- 글꼴 짝 25종, 모두 SIL OFL 1.1. 대표 URL(jsDelivr: Pretendard v1.3.9·SUIT 2.0.5·Wanted Sans 1.0.3·Galmuri 2.40.3, 네이버 hangeul.pstatic.net: 마루 부리·나눔스퀘어 네오·나눔스퀘어라운드, Google Fonts css2: 나머지)와 jsDelivr **Fontsource 거울**(`mirror`, 버전 고정)을 함께 줍니다. 아키텍처 §1의 "생성 사이트 외부 호출은 jsDelivr만" 원칙을 지키려면 빌드가 mirror를 우선 쓰면 됩니다(가변 글꼴은 family 이름이 'Noto Serif KR Variable'처럼 다름). 70개 URL 모두 200·@font-face 확인.
- 눈누(noonnu) 글꼴은 대부분 저장소에 CSS가 없고 라이선스가 제각각(재배포 금지 조항 포함)이라 넣지 않았습니다.

## 6. 시험 결과(Playwright Chromium, 2026-11-09)
- demo.html: 1280·390 폭 × 라이트·다크 × 동작 줄이기 켬/끔(6 조합): **콘솔 오류 0, 가로 넘침 0, 남은 숨김 0, 효과 실패 0**.
- 실패 시나리오: jsDelivr 차단 시 라이브러리 효과 3종이 조용히 물러남(OGL 구는 점무늬 CSS 구 유지), init 예외 시 요소가 보이고 `data-fx-error`, JS 꺼짐 시 모든 글 보임, 멈춤 버튼 저장·새로고침 유지·CSS 반복 정지.
- 한국어 줄바꿈 회귀 시험: "디지털로 마음과 관계를 키우는 인천형 사회정서학습"을 1280/820/390 폭에서 나눔 효과 6종(split-reveal chars·lines, scramble, typewriter, kinetic-weight pointer, scroll-fill)이 원문 keep-all과 같은 자리에서 줄바꿈. 수정 전 코드에선 "키우 / 는"으로 깨지는 것을 같은 시험이 잡음.
- 성능: 기본(소프트웨어 합성) 렌더러에서 그래픽 효과 모두 60fps. SwiftShader GL 에뮬레이션에서는 캔버스 2D가 느려 스크린숏이 지연되지만 실제 GPU와 무관한 시험 환경 문제였음.
- 스크린숏: `/tmp/claude-0/-home-user/6c566d4e-a9d8-5130-a565-63612608ad41/scratchpad/fx-shots/`

## 7. 통합 메모(렌더러·빌드 담당에게)
- 마크업: `data-fx="id id2"`, `data-fx-opts='{"by":"lines"}'`(여러 효과면 `{"confetti":{"on":"click"}}`처럼 아이디별).
- 섹션 진입은 `<section data-fx="reveal-up">` 그대로 동작(키 큰 섹션도 진입 판정). 페이지 단위(tone-journey·smooth-scroll·cursor-follower)는 `<body>`에.
- 구분 띠 `<div class="lp-divider" data-fx="marquee|line-draw|waves|topo-lines" aria-hidden="true"><span>낱말</span>…</div>`: marquee는 흐르는 띠, line-draw는 낱말 사이 선이 스크롤로 차오름(넘치면 뒤 낱말부터 숨김), waves·topo-lines는 높이 40px 미만이면 최소 64px로 띄우고 띠 높이에 맞춤. aria-hidden 안에서는 포커스 가능한 것을 만들지 않습니다(horizontal-snap은 버튼 없이 스크롤만, guided-progress는 단계 링크 없이 막대만, marquee 복제본은 tabindex -1).
- fx.css는 `/*@fx:아이디*/` 표지로 묶여 있어 쓰는 효과만 남길 수 있음(예: 4종이면 44KB → 9KB).
- 깜빡임 방지: `LecFX.boot` 문자열을 `<head>` 인라인 스크립트로 넣으면 진입 효과 대상만 core 시작(최대 2.5초)까지 숨김.
- 다른 런타임과의 신호: 복사는 `LecFX.copied(버튼)`, 완료 축하는 `LecFX.celebrate({el})`, 화면 바꾸기는 `LecFX.swap(fn)`.

## 8. 알려진 한계
- `gradient-text`와 `split-reveal`을 같은 요소에 겹치면 background-clip:text가 변형된 자식에 안 먹습니다(카탈로그에 명시).
- `line-draw`(일정 레일)·`spotlight(cards)`는 항목의 `::before`/`::after`를 씁니다. 렌더러가 같은 가상 요소를 쓰면 충돌할 수 있습니다.
- `doodle-scribbles` 주석은 인라인 요소를 inline-block으로 바꿉니다(긴 문장 전체보다 짧은 구절에).
- `tone-journey`는 `--background` 등 8개 토큰을 컨테이너에 덮어씁니다. 캔버스 그래픽은 톤이 바뀐 뒤 0.18초에 색을 다시 읽습니다.
- `view-transition`은 클릭만 감쌉니다(화살표 키로 탭을 바꾸는 경우는 원래 동작).
- 저사양 판정(코어 4개 이하)은 일부 아이패드도 해당되어 캔버스 그래픽이 정지 화면이 됩니다. 사이트별로 `data-fx-lowpower="0"`로 풀 수 있습니다.
- `perspective-grid`의 먼 격자선은 지평선 근처에서 약간의 모아레가 생겨 마스크로 흐리게 처리했습니다.
- 실제 iPad Safari·삼성 인터넷 기기 시험은 하지 못했습니다(Chromium 에뮬레이션만). 사용한 API는 모두 Safari 15.4+/삼성 인터넷 20+ 지원 범위(IntersectionObserver, ResizeObserver, CSS mask, color-mix는 @supports 대체, @property 미지원 시 정지).
