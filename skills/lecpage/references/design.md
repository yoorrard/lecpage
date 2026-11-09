# 디자인: 프리셋·효과·모션·글꼴

> 이 파일은 `scripts/gen-design-doc.mjs`가 엔진 카탈로그에서 자동으로 만듭니다. 직접 고치지 말고 카탈로그를 고친 뒤 다시 만드세요.

## 1. 정하는 순서
1. **프리셋**: 분위기(mood)·주제(topic)·유형으로 점수를 매겨 3안을 제안한다(`lecpage.mjs design`). 강사가 고른다.
2. **토큰**: 프리셋의 색·글꼴·모양. 기관 색이 있으면 `design.accent`(대비 자동 보정).
3. **모션 단계**: 0 정지 · 1 차분 · 2 보통 · 3 화려. 크롬북·휴대폰·느린 네트워크면 2까지, 공식 행사는 2까지. 학교망 제한(`audience.network: restricted`)이면 외부 라이브러리 효과를 쓰지 않는다.
4. **슬롯별 효과**: 프리셋 기본값에서 출발해 상한·환경에 맞게 바꾸고, 제목·카드 효과는 연수마다 조금씩 변주한다(`design.seed`를 바꾸면 다른 조합). 직접 정하려면 `design.effects`에 `{"슬롯":"효과id"}`.
5. **시그니처**: 사이트 전체에서 두드러지는 효과는 하나(`design.signature`).

## 2. 지킬 것
- 실습·질문·교재 화면은 모션 1단계를 넘지 않는다. 화려함은 첫 화면·섹션 시작·마무리에만.
- 쉬는 상태가 완성 상태: 효과가 실패해도 글은 보인다. 동작 줄이기·'움직임 멈춤'을 늘 존중.
- 피할 기본값: 보라→파랑 그라데이션 첫 화면, 똑같은 카드 3장, 흔한 AI 이미지, 섹션마다 다른 화려한 효과, 스크롤 납치.
- 한글: word-break: keep-all, 본문 행간 1.6~1.8, 제목 text-wrap: balance. 글꼴은 아래 목록(상업 이용 가능)만.

## 3. 무드 프리셋 12종
| id | 이름 | 어울리는 연수 | 분위기 | 글꼴(제목/본문) | 모션 | 그래픽 | 시그니처 |
|---|---|---|---|---|---|---|---|
| `night-story` | 밤하늘 서사 | 밤에서 새벽으로 바뀌는 톤 여정과 빛나는 그라데이션 제목. 메시지와 감동이 중심인 특강에. | emotional, warm, futuristic, bold | Pretendard / Pretendard | 화려 | perspective-grid | tone-journey |
| `paper-workbook` | 종이 워크북 | 밝은 종이 위에 라임 형광펜. 따라 하기와 복사·완료 체크가 또렷한 실습형 워크숍에. | minimal, playful, handmade | Pretendard / Pretendard | 차분 | paper-stack | micro-copy |
| `glass-lab` | 유리 실험실 | 은은한 오로라 위 유리 패널과 손전등 커서. AI·에듀테크·미래교육 연수에. | tech, futuristic, minimal | Wanted Sans / Pretendard | 보통 | aurora | spotlight |
| `playground` | 놀이터 | 굵은 테두리와 원색, 딱딱 눌리는 버튼. 놀이·게임·창의 연수와 초등 저학년 활동에. | playful, energetic, bold, retro | G마켓 산스 / Pretendard | 보통 | confetti-shapes | marquee |
| `calm-forest` | 숲의 숨 | 세이지 그린과 명조 제목, 느린 움직임과 종이 질감. 마음·상담·생활교육·학부모 연수에. | calm, natural, warm, handmade | 마루 부리 / Pretendard | 차분 | topo-lines | scroll-fill |
| `official-brief` | 공식 브리핑 | 단정한 남색과 높은 가독성, 큰 숫자. 교육청 설명회·관리자 연수·대규모 행사에. | formal, minimal | Pretendard / Pretendard | 차분 | blueprint-grid | counter |
| `editorial-ink` | 잉크 에디토리얼 | 큰 명조 제목과 울트라마린 잉크 한 색. 독서·인문·역사처럼 글이 주인공인 연수에. | editorial, minimal, calm | Noto Serif KR / Pretendard | 보통 | - | split-reveal |
| `retro-pop` | 도파민 팝 | 형광 분홍·보라·민트가 터지는 레트로 무드. 음악·미술·영어·학생 대상 활동에. | playful, retro, energetic, bold | 검은고딕 / Pretendard | 보통 | blobs-morph | marquee |
| `chalkboard` | 칠판 교실 | 진녹색 칠판과 분필 노랑, 손글씨 낙서. 교실 실천·초등 교과 연수에 친근하게. | warm, handmade, playful | 주아 / Pretendard | 보통 | chalkboard | doodle-scribbles |
| `blueprint-tech` | 설계도 | 청사진 격자와 고정폭 숫자, 그려지는 선. 코딩·메이커·과학·데이터 연수에. | tech, minimal, futuristic | IBM Plex Sans KR / IBM Plex Sans KR | 보통 | blueprint-grid | line-draw |
| `riso-zine` | 리소 진 | 형광 분홍과 파랑 잉크가 겹치는 인쇄물 질감. 미술·독서 동아리·창작 연수에. | handmade, retro, playful, editorial | 도현 / Pretendard | 보통 | riso | highlight-sweep |
| `sunrise-warm` | 새벽빛 | 복숭아빛에서 라일락으로 번지는 부드러운 그라데이션. 학부모·진로·감사의 자리에. | warm, emotional, calm | 고운바탕 / Pretendard | 보통 | mesh-gradient | reveal-up |

## 4. 효과 52가지
| id | 이름 | 강도 | 슬롯 | 설명 |
|---|---|---|---|---|
| `split-reveal` | 마스크 글자 등장 (Split reveal) | 2 | 첫 화면 제목, 섹션 제목, 마무리 문장, 핵심 문장 | 제목을 줄·낱말·글자로 나눠 보이지 않는 틀 안에서 아래에서 위로 밀어 올립니다. 수상작 포트폴리오의 대표 등장 방식입니다. |
| `kinetic-weight` | 움직이는 글자 굵기 (Kinetic weight) | 2 | 첫 화면 제목, 섹션 제목, 마무리 문장 | 가변 글꼴의 굵기가 스크롤 위치(화면 가운데일수록 굵게)나 포인터 거리(가까운 글자만 굵게)에 따라 바뀝니다. |
| `scroll-fill` | 스크롤 글 차오름 (Scroll fill) | 2 | 핵심 문장, 마무리 문장, 섹션 제목 | 긴 문장의 낱말이 흐린 색에서 제 색으로 스크롤에 맞춰 차오릅니다. 핵심 메시지를 천천히 읽게 만듭니다. |
| `scramble` | 한글 해독 글자 (Hangul scramble) | 2 | 첫 화면 제목, 섹션 제목, 숫자 | 한글 음절·영문·숫자가 같은 종류의 무작위 글자로 섞였다가 왼쪽부터 제자리를 찾습니다(약 1초, 한 번). |
| `gradient-text` | 흐르는 그라데이션 글자 (Gradient text) | 1 | 첫 화면 제목, 마무리 문장 | 큰 제목 글자 안에서 주 색·강조 색이 천천히 흐릅니다. 강도 1이면 멈춘 그라데이션. |
| `marquee` | 흐르는 띠 (Marquee) | 2 | 구분 띠, 목록 | 키워드·도구 이름이 끊김 없이 가로로 흐르는 띠. 섹션 사이 구분선 역할. |
| `counter` | 숫자 올라가기 (Count up) | 1 | 숫자 | 화면에 들어오면 숫자가 0부터 올라갑니다. 쉼표·소수점·단위(명, %, 시간)를 그대로 지킵니다. |
| `typewriter` | 자모 타자 (Hangul typewriter) | 2 | 첫 화면 제목, 마무리 문장, 핵심 문장 | 한글을 자모 조합하듯(ㅎ→하→한) 한 번 타자 칩니다. 끝나면 커서도 사라집니다(5초 미만). |
| `highlight-sweep` | 형광펜 긋기 (Highlight sweep) | 1 | 핵심 문장, 섹션 제목, 첫 화면 제목 | 중요한 말 아래로 형광펜이 왼쪽에서 오른쪽으로 그어집니다. 쉬는 상태도 칠해진 상태입니다. |
| `word-rotate` | 낱말 바꾸기 (Word rotate) | 2 | 첫 화면 제목, 마무리 문장 | 한 자리에서 낱말이 차례로 위로 바뀝니다. 세 바퀴 돌고 첫 낱말에서 스스로 멈춥니다. |
| `link-underline` | 밑줄 차오름 링크 (Link underline) | 1 | 목록, 카드 | 링크 위에 마우스·포커스가 오면 굵은 밑줄이 왼쪽부터 차오르고, 떠나면 오른쪽으로 빠집니다. |
| `reveal-up` | 조용한 떠오르기 (Reveal up) | 1 | 섹션 등장, 카드, 목록, 섹션 제목, 사진 | 화면에 들어오면 18px 아래에서 살짝 떠오르며 나타납니다. 목록·격자는 짧게 차례로(총 지연 0.42초 상한). |
| `clip-reveal` | 마스크 사진 열기 (Clip reveal) | 2 | 사진, 섹션 등장, 첫 화면 그래픽 | 사진이 아래에서 위로(또는 원·사선·왼쪽에서) 열리고 안쪽 이미지는 살짝 줄어듭니다. |
| `parallax-soft` | 은은한 시차 (Soft parallax) | 2 | 사진, 첫 화면 그래픽, 스크롤 | 스크롤 속도와 최대 10%만 다르게 움직이는 시차. 멀미 없이 깊이만 줍니다. |
| `line-draw` | 선 그리기·일정 레일 (Line draw) | 2 | 일정, 구분 띠, 목록 | SVG 선이 스크롤에 맞춰 그려집니다. SVG가 없는 일정표 목록에는 세로 레일과 시각 점을 만들어 지난 항목을 채웁니다. |
| `guided-progress` | 진행 막대·단계 표시 (Guided progress) | 0 | 진행 표시, 스크롤 | 위쪽에 읽은 만큼 차는 막대, 넓은 화면 오른쪽에 섹션 단계 점(이름은 마우스·포커스에), 좁은 화면은 "3 / 7 실습" 칩. |
| `sticky-scrolly` | 고정 그림 스크롤리텔링 (Sticky scrollytelling) | 2 | 핵심 문장, 일정, 섹션 등장 | 한쪽 그림은 고정되고, 옆 단계 글을 읽어 내려가면 그림이 단계에 맞게 바뀝니다. 그림이 없으면 큰 번호·제목·진행 고리를 만듭니다. |
| `stack-cards` | 쌓이는 카드 (Stacking cards) | 2 | 카드 | 카드가 차례로 위에 붙어 쌓이고, 덮인 카드는 살짝 작아집니다(sticky + scale). |
| `horizontal-snap` | 가로 넘김 (Horizontal snap) | 1 | 사진, 카드, 목록 | 목록을 가로 스냅 넘김으로 바꿉니다. 이전/다음 버튼, 키보드, 마우스 끌기, 진행 막대. 세로 스크롤은 뺏지 않습니다. |
| `tone-journey` | 톤 여정(밤→새벽→낮) (Tone journey) | 2 | 스크롤 | 섹션의 data-tone(night·dawn·day)을 따라 페이지 바탕과 글자색이 스크롤에 맞춰 이어집니다. 밤→새벽→밤 같은 이야기 흐름. |
| `zoom-through` | 사진 확대 통과 (Zoom through) | 3 | 첫 화면 그래픽, 사진 | 액자 크기의 사진이 스크롤을 따라 화면 가득 커집니다(clip-path라 레이아웃 안전). |
| `magnetic` | 자석 버튼 (Magnetic button) | 2 | 시작 버튼 | 포인터가 가까이 오면 버튼이 살짝 끌려오고 글자는 조금 더 따라옵니다(최대 14px). |
| `tilt` | 3D 기울기 카드 (Tilt card) | 2 | 카드, 사진 | 카드가 포인터 쪽으로 최대 6도 기울고 빛 반사가 따라옵니다. |
| `spotlight` | 포인터 조명 (Spotlight) | 2 | 커서, 카드, 첫 화면 그래픽 | 어두운 영역에서 포인터 둘레를 은은하게 밝힙니다. mode:"cards"면 카드 테두리가 포인터 쪽으로 빛납니다. |
| `cursor-follower` | 따라오는 커서 고리 (Cursor follower) | 3 | 커서 | 작은 점과 고리가 포인터를 따라오고 링크 위에서 고리가 커집니다. |
| `micro-copy` | 복사 버튼 반응 (Copy feedback) | 0 | 카드, 목록, 시작 버튼 | 복사 버튼을 누르면 "복사됨"과 체크 표시로 바뀌고 낭독기에 "복사했어요"를 알립니다. |
| `confetti` | 완료 축하 (Confetti) | 2 | 축하 | 실습 완료·설문 제출 같은 순간에만 1초 안쪽으로 터지는 축하 조각(캔버스). |
| `ripple` | 누름 물결 (Ripple) | 1 | 시작 버튼, 카드 | 버튼을 누른 자리에서 물결이 퍼집니다(글자색 기준이라 어느 테마에서도 맞음). |
| `view-transition` | 화면 전환 잇기 (View transition) | 1 | 카드, 목록, 사진 | 탭·필터·펼치기로 바뀌는 화면을 View Transitions API로 부드럽게 잇습니다. 직접 쓰려면 LecFX.swap(fn). |
| `border-beam` | 테두리 빛줄기 (Border beam) | 2 | 시작 버튼, 카드 | 카드·버튼 테두리를 따라 빛줄기가 천천히 돕니다(@property 각도 애니메이션). |
| `aurora` | 오로라 (Aurora) | 2 | 첫 화면 그래픽, 마무리 그래픽 | 주 색·강조 색의 부드러운 빛띠가 아주 천천히(28~40초) 흐릅니다. CSS만, 흐림 필터 없음. |
| `mesh-gradient` | 메시 그라데이션 (Mesh gradient) | 1 | 첫 화면 그래픽, 마무리 그래픽 | 토큰 네 색으로 만든 메시 그라데이션. 강도 2 이상이면 색 점이 천천히 떠다닙니다(@property). |
| `grain` | 필름 그레인 (Grain) | 1 | 첫 화면 그래픽, 마무리 그래픽 | SVG 잡음을 글자색으로 얇게 덮어 종이·필름 질감을 줍니다. 다른 그래픽과 겹쳐 쓰기 좋습니다. |
| `perspective-grid` | 원근 바닥 격자 (Perspective grid) | 2 | 첫 화면 그래픽, 마무리 그래픽 | 밤하늘 아래 원근 바닥 격자가 다가옵니다(신스웨이브). 지평선 빛, 선택적으로 줄무늬 해. |
| `starfield` | 별밤 (Starfield) | 2 | 첫 화면 그래픽, 마무리 그래픽 | 반짝이는 별이 아주 천천히 흐르는 밤하늘(캔버스). 강도 3이면 가끔 별똥별. |
| `particles-network` | 연결 점망 (Particle network) | 3 | 첫 화면 그래픽 | 점들이 떠다니며 가까운 점끼리 선으로 이어지고 포인터와도 이어집니다(캔버스). |
| `dot-grid` | 물결 점 격자 (Dot grid) | 2 | 첫 화면 그래픽, 마무리 그래픽 | 점 격자에 잔잔한 물결이 지나가고, 포인터 근처 점은 커지며 주 색으로 물듭니다(캔버스). |
| `topo-lines` | 등고선 지형 (Topographic lines) | 2 | 첫 화면 그래픽, 마무리 그래픽, 구분 띠 | 펄린 잡음 지형의 등고선(마칭 스퀘어). 다섯 줄마다 주 색 주곡선. 지형이 아주 천천히 숨 쉽니다(초당 24회). |
| `waves` | 겹 물결 (Waves) | 1 | 마무리 그래픽, 구분 띠, 첫 화면 그래픽 | 바닥에서 세 겹 물결이 서로 다른 속도로 흐릅니다(SVG, 이음매 없음). |
| `blobs-morph` | 숨 쉬는 덩어리 (Morphing blobs) | 2 | 첫 화면 그래픽, 마무리 그래픽 | 둥근 덩어리 세 개가 숨 쉬듯 모양을 바꿉니다(SVG, 초당 30회, 토큰 색 그라데이션). |
| `bokeh` | 빛망울 (Bokeh) | 2 | 첫 화면 그래픽, 마무리 그래픽 | 초점 밖 빛망울이 천천히 떠다니며 숨 쉽니다(CSS만). |
| `paper-stack` | 활동지 묶음 (Paper stack) | 1 | 첫 화면 그래픽 | 비스듬히 겹친 활동지(줄 친 종이·여백선·펀치 구멍·포스트잇·클립) 그림. 강도 2 이상이면 스크롤에 살짝 펼쳐집니다. |
| `doodle-scribbles` | 손그림 낙서·주석 (Doodles & annotations) | 2 | 섹션 제목, 첫 화면 제목, 핵심 문장, 첫 화면 그래픽, 마무리 그래픽 | 자체 rough 알고리즘으로 손그림 선을 만듭니다. 글에는 밑줄·동그라미·상자·형광·취소선·괄호 주석, 섹션에는 모서리 낙서(별·소용돌이·화살표·하트). |
| `confetti-shapes` | 멤피스 도형 (Memphis shapes) | 1 | 첫 화면 그래픽, 마무리 그래픽 | 세모·고리·물결·점 묶음·더하기·반원을 가장자리에 흩어 둡니다(정지 SVG). 강도 2 이상은 포인터에 살짝 시차. |
| `chalkboard` | 칠판 (Chalkboard) | 2 | 첫 화면 그래픽, 마무리 그래픽 | 칠판 질감(분필 가루·지운 자국)과 분필 낙서(바를 정 正, 화살표, 별, +, =, 체크)가 한 번 그려집니다. 영역을 어두운 칠판 색으로 바꿉니다. |
| `shader-gradient` | 셰이더 그라데이션 (Shader gradient) | 3 | 첫 화면 그래픽, 마무리 그래픽 | WebGL 조각 셰이더로 만든 흐르는 잡음 그라데이션(도메인 워핑 + 그레인). three.js 없이 4KB. |
| `noise-orb` | 빛나는 구 (Glowing orb) | 2 | 첫 화면 그래픽 | 원뿔 그라데이션이 겹쳐 천천히 도는 빛나는 구(AI 음성 비서 느낌). 숨 쉬듯 커졌다 작아지고 포인터 쪽으로 살짝 기웁니다. |
| `riso` | 리소 인쇄 망점 (Risograph) | 1 | 첫 화면 그래픽, 마무리 그래픽 | 두 잉크(주 색·강조 색)의 망점이 살짝 어긋나 겹치는 리소그래프 인쇄 질감(정지). |
| `blueprint-grid` | 설계도 모눈 (Blueprint grid) | 1 | 첫 화면 그래픽, 마무리 그래픽 | 설계도 모눈(작은 칸·큰 칸), 모서리 맞춤 표시, 실제 영역 치수. 강도 2 이상·정밀 포인터면 좌표 십자선이 따라옵니다. |
| `smooth-scroll` | 부드러운 휠 스크롤 (Smooth scroll (Lenis)) | 3 | 스크롤 | Lenis로 휠 스크롤을 부드럽게 합니다. 수상작 사이트의 "무게감 있는 스크롤". · 외부 라이브러리 |
| `gsap-scroll` | 고정 섹션 스크럽 (GSAP ScrollTrigger scrub) | 3 | 섹션 등장, 핵심 문장, 일정 | GSAP ScrollTrigger로 섹션을 잠깐 고정하고 안쪽 요소가 스크롤에 맞춰 차례로 떠오릅니다(scrub). 넓은 화면만 고정. · 외부 라이브러리 |
| `three-hero` | 점 구름 구체(WebGL) (Point-cloud sphere (OGL)) | 3 | 첫 화면 그래픽 | OGL(작은 WebGL 라이브러리)로 만든 2,400개 점의 구체가 천천히 돌고 표면이 숨 쉬며 포인터 쪽으로 기웁니다. · 외부 라이브러리 |

## 5. 글꼴
| 키 | 글꼴 | 종류 | 라이선스 |
|---|---|---|---|
| `pretendard` | Pretendard | sans | OFL-1.1 |
| `suit` | SUIT | sans | OFL-1.1 |
| `wanted` | Wanted Sans | sans | OFL-1.1 |
| `gmarket` | G마켓 산스 | display | OFL-1.1 (G마켓 공식 배포) |
| `maruburi` | 마루 부리 | serif | 네이버 글꼴 라이선스(상업 이용 가능) |
| `notoSerif` | Noto Serif KR | serif | OFL-1.1 |
| `hahmlet` | 함렛 | serif | OFL-1.1 |
| `gowunBatang` | 고운바탕 | serif | OFL-1.1 |
| `gowunDodum` | 고운돋움 | sans | OFL-1.1 |
| `jua` | 주아 | display | OFL-1.1 |
| `gaegu` | 개구 | hand | OFL-1.1 |
| `blackHan` | 검은고딕 | display | OFL-1.1 |
| `doHyeon` | 도현 | display | OFL-1.1 |
| `gasoek` | 가석 | display | OFL-1.1 |
| `orbit` | 오르빗 | display | OFL-1.1 |
| `plexKr` | IBM Plex Sans KR | sans | OFL-1.1 |
| `plexMono` | IBM Plex Mono | mono | OFL-1.1 |
| `jetbrains` | JetBrains Mono | mono | OFL-1.1 |
| `spaceGrotesk` | Space Grotesk | latin | OFL-1.1 |
| `fraunces` | Fraunces | latin-serif | OFL-1.1 |
| `bricolage` | Bricolage Grotesque | latin | OFL-1.1 |

글꼴을 바꾸려면 `design.fonts`에 `{"display":"키","body":"키"}`. 학교망에서 CDN이 막히면 글꼴 파일을 `assets/fonts/`에 내려받아 쓰도록 안내한다.
