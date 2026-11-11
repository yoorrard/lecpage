# 디자인·모션 흐름 조사와 채택 규칙(2026-11)

- 조사일: 2026-11-11. 대상: 생성 사이트의 디자인(`engine/src/design/*`, `render/*`, `runtime/lecpage.css`, `runtime/fx/*`).
- 방법: 웹 검색(요약·원문 제목 확인) + 저장소의 앞선 조사(`fonts-2026-11.md`, `motion-graphics.md`, `2026-11-review.md`의 실측) + 글꼴 주소 직접 확인(`curl`, 200과 `@font-face` 확인).
- ⚠️ 한계: 이 작업 환경에서는 stripe.com · config.figma.com · web.dev 같은 원문 사이트를 직접 열 수 없었다(네트워크 허용 목록 밖). 그 사이트의 화면 구성은 검색 요약과 앞선 실측에 기대었고, 직접 보지 못한 내용은 ⚠️로 표시했다.
- 이 문서는 읽을거리가 아니라 **우리가 따르는 규칙**이다. 규칙마다 어디에 넣었는지 적는다.

## 1. 한눈에: 채택 규칙 12가지

| # | 규칙 | 넣은 곳 |
|---|---|---|
| 1 | **글자가 주인공.** 첫 화면·핵심 메시지·마무리는 그림 대신 화면 폭에 맞춰 커지는 큰 글자(clamp + vw). 제목 자간은 -0.02~-0.04em | `lecpage.css` `--fs-statement` `--fs-closing` `--fs-figure` |
| 2 | **글꼴 세 벌**: 개성 있는 한글 제목 + 읽기 좋은 한글 본문 + 숫자·영문용 라틴 제목 글꼴(자릿수 고정 숫자). Pretendard는 본문 대안으로만 | `presets.js` `fonts.{display,body,num,mono}`, `tokens.js` `--font-num` |
| 3 | **깊이는 CSS로.** 무거운 3D·이미지 대신 색 띠(바탕 → 옅은 바탕 → 반전 띠), 한 겹 카드와 절제한 그림자, 유리는 떠 있는 것에만 | `.lp-tinted` `.lp-bleed` `.lp-invert`, 카드 변형 |
| 4 | **벤토는 크기를 다르게.** 같은 칸 셋을 나란히 두지 않는다(12칸에 7·5, 5·7). 벤토가 흔해졌으므로 한 페이지에 한두 곳 | `sections.js` `bentoSpans`, 첫 화면 bento·도구 |
| 5 | **스크롤 이야기는 CSS 먼저.** `animation-timeline: view()/scroll()` + `@supports` + 동작 줄이기 대체. JS는 읽기·쓰기를 한 프레임에 한 번(`runtime/fx/core.js`) | `lecpage.css` 낱말 채움·마무리·첫 화면 |
| 6 | **고정(sticky)으로 쌓기·핀.** 스크롤 속도·방향을 바꾸지 않는다(가로채기 금지). 시차는 10% 안쪽 | 차례 쌓임, 첫 화면 핀(스크롤 연출) |
| 7 | **움직임은 한 곳에 몰아서.** 첫 화면 + 대표 효과 하나 + 마무리. 실습·질문·교재·보드·투표는 차분(1단계)까지 | `decide/design.js` 예산, `core.js` `CALM` |
| 8 | **쉬는 모습이 완성된 모습.** JS·움직임이 꺼져도 글은 처음부터 다 진하게 보인다 | 모든 효과, `lecpage.css` |
| 9 | **내용이 그림이 된다.** 일정은 길이에 비례한 시간 막대, 목표는 큰 번호 문장, 숫자는 아주 큰 자릿수 고정 숫자, 교재 쪽은 슬라이드 모양 | `sections.js` |
| 10 | **'AI 티' 묶음을 피한다**: 가운데 정렬 일색, 보라→파랑 그라데이션, 알약 꼬리표, 이모지 아이콘, 똑같은 카드 3장, 위아래 같은 리듬 | `design-lint.mjs`(hero-skeleton·layout-repeat 포함) |
| 11 | **손맛·불완전함 한 방울.** 매끈한 화면에 질감(그레인·망점·분필·어긋난 인쇄)을 프리셋 표식으로 | 프리셋별 표식(첫 화면·교재 쪽·마무리) |
| 12 | **가벼움이 품질.** 첫 화면에 받는 것(HTML+CSS+JS)은 gzip 200KB 안쪽. 글꼴은 필요한 글자·굵기만 | `fonts.js`, QA |

## 2. 2026년 흐름에서 가져올 것·버릴 것

| 흐름 | 가져올 것 | 버릴 것·주의 | 출처 |
|---|---|---|---|
| 글자 중심(kinetic·viewport-scaled type) | 첫 화면·마무리의 큰 글자, 화면 폭 연동 크기 | 가변 글꼴 굵기 애니메이션은 레이아웃 흔들림 → 첫 화면 제목 한 곳만 | [Fireart], [Netguru] |
| 벤토 격자 | 요약판·도구 모음 | 모든 섹션을 벤토로. "벤토가 23% 더 깊이 스크롤"은 한 에이전시 자체 수치 ⚠️ | [Bubble], [Studiomeyer] |
| 스크롤 이야기(scrollytelling) | 메시지·차례·마무리에 스크롤 연동 | 동작 줄이기 대체 없이 쓰기 | [Bubble], [Netguru] |
| 깊이·유리 2.0 | CSS로 만든 겹(색 띠·블러는 떠 있는 것에만) | 큰 3D 자산, 어디에나 유리 | [Fireart], [Studiomeyer] |
| 촉각·반(反)격자 브루탈 | 놀이터·형광 인쇄 프리셋의 딱딱한 그림자·어긋난 판 | 읽기 어려운 겹침 | [Bubble], [Fireart] |
| 절제(barely-there UI) | 실습·질문·교재 화면은 조용하게 | 꾸밈으로 채우기 | [Bubble] |
| 손의 흔적·불완전함(한글 타이포) | 민부리·바탕 계열 제목, 질감 표식 | 장식 글꼴을 본문에 | [산돌구름 2026 흐름] |
| 큰 회사 첫 화면: 한 줄, 낮은 목소리 | 제목 한 줄 + 실제 정보(일시·장소). 로고 띠·기능 나열 없음. 제목은 가벼운 굵기에 좁은 자간도 가능 | — | [Stripe 재설계 요약] ⚠️(제3자 정리) |
| 행사 사이트: 날짜·장소가 먼저, 일정은 표로 | 날짜·장소를 첫 화면에, 일정은 시간표 타이포 | — | [Stripe Sessions 갤러리] ⚠️, 앞선 실측(`2026-11-review.md`: FEConf·Toss SLASH 24·DEVIEW) |

## 3. 2026년 브라우저에서 믿고 쓸 수 있는 것

| 기술 | 상태(2026-11) | 우리 규칙 |
|---|---|---|
| CSS 스크롤 연동 애니메이션(`animation-timeline: scroll()/view()`) | Chrome 115(2023-07)·Safari 26(2025-09)·Firefox 159(2026-10)로 **Baseline Newly available** ⚠️(web.dev 글을 검색 요약으로 확인, 원문은 열지 못함) | 꾸밈에만 쓰고 `@supports (animation-timeline:view())`로 감싼다. 지원 전 브라우저(구형 Firefox·삼성 인터넷 일부)는 완성된 정지 모습 |
| 같은 문서 View Transitions | 2025-10부터 Baseline Newly available(Firefox 144) | 탭·보드 전환에 `LecFX.swap` |
| 문서 간 View Transitions | Chrome·Safari 지원, Firefox 부분 지원 → Baseline 아님 | 쓰지 않음(페이지가 하나라 필요 없음) |
| `position: sticky` 쌓기·핀 | 전부 지원 | 차례 쌓임·첫 화면 핀. 뷰포트보다 큰 요소는 핀 하지 않음(JS로 맞는지 확인 후 `lp-hero-fits`) |
| 컨테이너 단위(`cqw`) | 전부 지원 | 교재 글 쪽(슬라이드)의 글자 크기 |
| `:has()` | 전부 지원 | 섹션 머리 두 단 배치, 설문 눈금 |
| WebGL·외부 라이브러리(GSAP·Lenis·OGL) | 학교망에서 막힐 수 있음 | 첫 화면 한 곳·선택 사항. 막히면 정지 모습. SRI 지문 고정 |

- 끊김 없는 스크롤 연출 수칙: `transform`·`opacity`만 움직인다 / 스크롤 이벤트에서 레이아웃을 읽고 쓰기를 섞지 않는다 / 큰 블러·`backdrop-filter`는 고정 요소 한두 개만 / 핀 구간은 한 화면 높이 안쪽 / 휴대폰·저사양은 한 단계 낮춤(`core.js` `lowPower`).

## 4. 글꼴: 세 벌 체계

원칙: **한글 2종(제목·본문) + 라틴 제목 1종(숫자·영문) + 고정폭(코드·시각)**. 한글은 글꼴당 굵기 2개까지, 나눠 받기(dynamic subset) 우선. 라틴 제목 글꼴은 구글 폰트(라틴 부분집합 15~40KB)라 부담이 작다. 숫자에는 `font-variant-numeric: tabular-nums lining-nums`.

라틴 제목 글꼴(모두 OFL 1.1, `fonts.googleapis.com` → `fonts.gstatic.com`, 2026-11-11 `curl`로 200·`@font-face` 확인):

| 키 | 글꼴 | 결 | 쓰는 프리셋 |
|---|---|---|---|
| `bricolage` | Bricolage Grotesque | 표정 있는 그로테스크, 큰 숫자가 힘 있음 | 밤하늘 서사 · 놀이터 |
| `barlowCond` | Barlow Condensed | 좁고 단단한 숫자(표·시간표) | 종이 워크북 |
| `spaceGrotesk` | Space Grotesk | 기하적·기술적 | 유리 실험실 |
| `fraunces` | Fraunces | 부드러운 올드스타일 세리프, 큰 크기에서 우아 | 숲의 숨 · 잉크 잡지 |
| `plexCond` | IBM Plex Sans Condensed | 공문서 같은 단정한 숫자 | 공식 브리핑 |
| `unbounded` | Unbounded | 둥글고 넓은 팝 숫자 | 도파민 팝 |
| `caveat` | Caveat | 분필·손글씨 숫자 | 칠판 교실 |
| `plexMono` | IBM Plex Mono | 도면 치수 숫자 | 설계도 |
| `anton` | Anton | 포스터용 좁고 굵은 숫자 | 형광 인쇄 |
| `instrumentSerif` | Instrument Serif | 가는 획의 잡지식 숫자(큰 날짜) | 새벽빛 |
| `sora` · `syne` · `geist` · `bigShoulders` · `redHat` · `outfit` | (새 프리셋용 후보) | 기업형·키노트·실험적 | 5절 새 프리셋 |

- 한글 글꼴은 `fonts-2026-11.md`의 목록을 그대로 쓴다(페이퍼로지·프리젠테이션·에이투지·아스타 산스·LINE Seed·마루 부리·함렛·고운바탕·리디바탕·나눔휴먼 등). 새 호스트 없음.
- 본문이 Pretendard 계열인 프리셋은 두 곳뿐(종이 워크북, 공식 브리핑의 Pretendard GOV). 그 밖에는 대안(`fontAlts`)·대체(fallback)로만.
- 줄바꿈: `word-break: keep-all` + `overflow-wrap: break-word`, 제목 `text-wrap: balance`, 본문 `pretty`. 본문 한 줄 38em(한국어 30~40자).

## 5. 취향 넓히기: 프리셋 지도

| 결 | 있는 프리셋 | 비어 있던 자리 → 추가 |
|---|---|---|
| 감성·따뜻함 | 새벽빛, 숲의 숨, 밤하늘 서사 | **부드러운 파스텔**(soft modern) |
| 기술·정밀 | 설계도, 유리 실험실 | **어두운 키노트**(premium dark keynote) |
| 격식·기관 | 공식 브리핑 | **깔끔한 기업형**(large-company clean) |
| 편집·글 | 잉크 잡지 | **따뜻한 미니멀**(warm minimal) |
| 놀이·팝 | 놀이터, 도파민 팝, 형광 인쇄, 칠판 교실 | **움직이는 글자**(kinetic-type experimental) |
| 실습 | 종이 워크북 | — |

## 6. 큰 회사·수상작에서 본 것(요약)

- Stripe: 홈 재설계에 1년, 점진적 공개(progressive disclosure), 첫 화면은 한 줄(기능 나열·로고 띠 없음). 제목은 가벼운 굵기·좁은 자간 ⚠️(커뮤니티가 뽑은 값: 56px·Söhne, 47~94px clamp).
- Stripe Sessions: 날짜·장소(모스콘 센터)를 먼저, 일정은 기조연설 → 세션 순서의 시간표 ⚠️(갤러리·행사장 안내 페이지로 확인).
- 토스: SLASH 23부터 해마다 새 슬로건과 키 비주얼. "홈페이지가 레퍼런스가 된" 까닭을 브랜드 디자인팀이 글로 남김(원문 미열람 ⚠️).
- Awwwards 2025 올해의 사이트: Lando Norris 브랜드 사이트로 표시됨 ⚠️(목록 배지로만 확인). 강한 개인 브랜드 + 일관된 모션(앞선 조사 `motion-graphics.md` §2.1).
- GDWEB 2025: 웹 부문 수상작은 서비스 내용을 직관적 시각 요소로 전달한 기업 사이트(유베이스) — 화려함보다 전달.

## 7. 출처

- [Bubble] Web Design Trends 2026: What's In, What's Out — https://bubble.io/blog/web-design-trends/
- [Netguru] Web design trends 2026: What to adopt, test or skip — https://www.netguru.com/blog/top-web-design-trends
- [Fireart] Web Design Trends 2026: Tactile Brutalism & Invisible Architecture — https://fireart.studio/blog/the-best-web-design-trends/
- [Studiomeyer] Webdesign Trends 2026 — https://studiomeyer.io/en/blog/webdesign-trends-2026 (수치는 자체 집계 ⚠️)
- Line25, Web Design Trends 2026: The Definitive Guide — https://line25.com/articles/web-design-trends-2026/
- web.dev, New to the web platform in October(2026) — https://web.dev/blog/web-platform-10-2026 ⚠️(검색 요약)
- WebKit, Announcing Interop 2026 — https://webkit.org/blog/17818/announcing-interop-2026
- Chrome for Developers, What's new in view transitions (2025 update) — https://developer.chrome.com/blog/view-transitions-in-2025
- web.dev, Same-document view transitions are now Baseline Newly available — https://web.dev/blog/same-document-view-transitions-are-now-baseline-newly-available
- Can I use, View Transitions (cross-document) — https://caniuse.com/cross-document-view-transitions
- [산돌구름 2026 흐름] 폰트 추천·트렌드 글 — https://www.sandollcloud.com/font-recommendations/article/437 , https://www.sandollcloud.com/font-recommendations/video/347
- [Stripe 재설계 요약] Stripe Head of Design Katie Dill Breaks Down Their New Website — https://stationlm.com/analysis/99a88bcb-1514-4f61-a540-e685300d53a3 ; Marketing site teardown: Stripe — https://render-room.pages.dev/journal/marketing-site-teardown-stripe
- [Stripe Sessions 갤러리] https://www.lapa.ninja/post/stripe-sessions ; https://www.moscone.com/events/stripe-sessions-2026
- 토스 피드, 토스의 홈페이지는 어떻게 레퍼런스가 되었을까? — https://toss.im/tossfeed/article/toss-brand-designer-hompage ; SLASH 4년의 여정 — https://toss.im/tossfeed/article/slash-four-year-journey
- 디자인 매체: 벤처스퀘어(GDWEB 2025 수상 보도) — https://www.venturesquare.net/1018037/ ; 월간 디자인(토스 브랜드 디자인팀) — https://design.co.kr/article/104389/
- 저장소 안 앞선 조사: `docs/research/fonts-2026-11.md`, `docs/research/motion-graphics.md`, `docs/research/2026-11-review.md`
