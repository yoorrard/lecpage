# 디자인: 프리셋·효과·연출·글꼴

> 이 파일은 `scripts/gen-design-doc.mjs`가 엔진 카탈로그에서 자동으로 만듭니다. 직접 고치지 말고 카탈로그를 고친 뒤 다시 만드세요.

## 1. 정하는 순서
1. **프리셋**: 분위기(mood)·주제(topic)·유형으로 점수를 매겨 3안을 제안한다(`lecpage.mjs design`). 강사가 고른다.
2. **토큰**: 프리셋의 색·글꼴·모양. 기관 색이 있으면 `design.accent`(대비 자동 보정).
3. **페이지 연출(모션 단계)**: 0 정적 · 1 차분 · 2 보통 · 3 스크롤 연출(시차·덮기·쌓임·고정 장면. 넓은 화면에서만 움직이고, 저사양·휴대폰·동작 줄이기에서는 완성된 정지 모습). 크롬북이 있으면 2까지, 휴대폰뿐이면 기본 2(강사가 3을 고르면 허용), 공식 연수는 1. 실습형은 첫 화면만. 학교망 제한(`audience.network: restricted`)이면 외부 라이브러리 효과를 쓰지 않는다.
4. **슬롯별 효과**: 프리셋 기본값에서 출발해 상한·환경에 맞게 바꾸고, 제목·카드 효과는 연수마다 조금씩 변주한다(`design.seed`를 바꾸면 다른 조합). 직접 정하려면 `design.effects`에 `{"슬롯":"효과id"}`.
5. **대표 효과**: 사이트 전체에서 두드러지는 효과는 하나(`design.signature`).
6. **글꼴 네 벌**: 한글 제목(`display`) · 한글 본문(`body`) · 숫자·영문용 라틴 제목(`num`: 큰 번호·날짜·통계·시각) · 고정폭(`mono`). 기본은 교재 글꼴을 따르고, 없으면 프리셋 글꼴. 직접 정하려면 `design.fonts`.

## 2. 지킬 것
- 실습·질문·교재 화면은 모션 1단계를 넘지 않는다. 화려함은 첫 화면·섹션 시작·마무리에만.
- 쉬는 상태가 완성 상태: 효과가 실패해도 글은 보인다. 동작 줄이기·'움직임 멈춤'을 늘 존중.
- 피할 기본값: 보라→파랑 그라데이션 첫 화면, 똑같은 카드 3장, 흔한 AI 이미지, 섹션마다 다른 화려한 효과, 스크롤 납치, 같은 배치의 섹션을 세 번 넘게 잇기(디자인 검사 `layout-repeat`).
- 한글: word-break: keep-all, 본문 행간 1.6~1.8, 제목 text-wrap: balance. 글꼴은 아래 목록(상업 이용 가능)만.

## 3. 무드 프리셋 21종
| id | 이름 | 어울리는 연수 | 분위기 | 글꼴(제목/본문/숫자) | 연출 | 첫 화면 | 대표 효과 |
|---|---|---|---|---|---|---|---|
| `night-story` | 밤하늘 서사 | 밤에서 새벽으로 넘어가는 영화 첫 장면. 아주 큰 제목과 '한눈에 보기' 띠. 메시지가 중심인 특강에. | emotional, warm, futuristic, bold | 페이퍼로지 / 아스타 산스 / Bricolage Grotesque | 스크롤 연출 | cinema | tone-journey |
| `paper-workbook` | 종이 워크북 | 밝은 종이 위에 라임 실습지 한 장. 실습 목록과 완료 체크가 첫 화면부터 보이는 실습형 워크숍에. | minimal, playful, handmade | 프리젠테이션 / Pretendard / Barlow Condensed | 차분 | worksheet | micro-copy |
| `glass-lab` | 유리 실험실 | 어두운 바탕에 유리 칸으로 짠 요약판. 일시·장소·실습 수가 한 화면에. AI·에듀테크·미래교육 연수에. | tech, futuristic, minimal | 에이투지체 / Wanted Sans / Space Grotesk | 보통 | bento | spotlight |
| `playground` | 놀이터 | 기울어진 흰 제목 상자와 원색 블록, 도구 이름이 흐르는 띠. 놀이·게임·창의 연수와 초등 활동에. | playful, energetic, bold, retro | 케리스 케듀체 / SUIT / Bricolage Grotesque | 보통 | poster | marquee |
| `calm-forest` | 숲의 숨 | 세이지 그린과 부리 글꼴 제목, 넓은 여백과 종이 질감. 마음·상담·생활교육·학부모 연수에. | calm, natural, warm, handmade | 마루 부리 / 나눔휴먼 / Fraunces | 차분 | quiet | grain |
| `official-brief` | 공식 브리핑 | 남색 머리띠와 정보 표, 큰 숫자. 일시·장소·대상·이수 기준이 표로 보이는 설명회·직무연수에. | formal, minimal | 나눔스퀘어 네오 / Pretendard GOV / IBM Plex Sans Condensed | 차분 | brief | counter |
| `editorial-ink` | 잉크 잡지 | 표제 띠와 아주 큰 명조 제목, 세 단 머리글. 독서·인문·역사처럼 글이 주인공인 연수에. | editorial, minimal, calm | 함렛 / Noto Serif KR / Fraunces | 보통 | masthead | scroll-fill |
| `retro-pop` | 도파민 팝 | 통통한 제목과 동그란 날짜 스티커. 형광 분홍·보라가 터지는 음악·미술·영어·학생 활동에. | playful, retro, energetic, bold | 베이글 팻 원 / 페이퍼로지 / Unbounded | 보통 | sticker | magnetic |
| `chalkboard` | 칠판 교실 | 칠판에 분필로 쓴 제목과 오늘의 차례, 분필 받침에 놓인 안내. 교실 실천·초등 교과 연수에. | warm, handmade, playful | 학교안심 둥근미소 / 나눔스퀘어라운드 / Caveat | 보통 | board | doodle-scribbles |
| `blueprint-tech` | 설계도 | 도면 표제란처럼 짠 사양서. 고정폭 이름표와 모눈, 그려지는 선. 코딩·메이커·과학·데이터 연수에. | tech, minimal, futuristic | IBM Plex Sans KR / IBM Plex Sans KR / IBM Plex Mono | 보통 | spec | line-draw |
| `riso-zine` | 형광 인쇄 | 판이 어긋난 굵은 제목과 망점, 비스듬한 도장. 두 색 잉크로 찍은 인쇄물 같은 미술·독서 동아리·창작 연수에. | handmade, retro, playful, editorial | 가석 / 고딕 A1 / Anton | 보통 | zine | highlight-sweep |
| `sunrise-warm` | 새벽빛 | 날짜가 먼저 보이는 초대장. 바탕 글꼴 제목과 떠오르는 해. 학부모·진로·감사의 자리에. | warm, emotional, calm | 고운바탕 / LINE Seed Sans KR / Instrument Serif | 보통 | invite | scroll-fill |
| `keynote-dark` | 어두운 키노트 | 검은 무대 위 아주 큰 제목과 지평선 불빛, 한 줄 정보 레일. 기조 강연·발표회·미래교육 특강에. 스크롤 연출이 기본. | futuristic, bold, minimal | Wanted Sans / Wanted Sans / Geist | 스크롤 연출 | keynote | scroll-fill |
| `corporate-clean` | 깔끔한 기업형 | 흰 바탕에 또렷한 제목, 오른쪽에 겹쳐 놓인 오늘의 일정 카드. 기관 설명회·업무 연수·에듀테크 소개에. | formal, minimal, calm | SUIT / SUIT / Sora | 차분 | panel | counter |
| `soft-pastel` | 부드러운 파스텔 | 아치·원·알약 도형 위의 날짜와 둥근 제목. 연보라·분홍·하늘빛의 포근한 화면. 학부모·저학년·마음 돌봄 연수에. | warm, calm, playful | 나눔스퀘어라운드 / LINE Seed Sans KR / Outfit | 보통 | soft | stack-cards |
| `kinetic-type` | 움직이는 글자 | 화면을 넘치는 굵은 제목과 윤곽선 메아리 줄, 굵은 선으로 나눈 정보. 예술·동아리·학생 활동처럼 힘 있는 자리에. 스크롤 연출이 기본. | bold, energetic, editorial | 페이퍼로지 / 스포카 한 산스 네오 / Big Shoulders Display | 스크롤 연출 | ticker | marquee |
| `warm-minimal` | 따뜻한 미니멀 | 넓은 여백과 명조 제목, 가는 큰 날짜 하나, 점선으로 이은 정보. 독서·인문·상담처럼 조용히 읽히는 자리에. | minimal, calm, natural | 나눔명조 / 아스타 산스 / Fraunces | 차분 | column | highlight-sweep |
| `deck-collage` | 펼친 교재 | 교재 쪽을 부채처럼 펼친 3D 더미가 첫 화면에. 마우스에 기울고, 누르면 다음 장이 올라와요. 교재가 주인공인 연수에. | editorial, handmade, bold | 페이퍼로지 / 아스타 산스 / Sora | 보통 | collage | slide-fan(첫 화면 그림) |
| `time-dial` | 하루 시계 | 하루 일정이 둥근 시계로 그려지는 첫 화면. 순서마다 호가 그려지고, 연수 중에는 지금 바늘이 돌아요. 일정이 중요한 행사·종일 연수에. | futuristic, bold, tech | 아스타 산스 / 아스타 산스 / Red Hat Display | 보통 | dial | schedule-dial(첫 화면 그림) |
| `knot-orbit` | 입체 궤도 | 점으로 짠 입체 매듭이 천천히 도는 첫 화면. 마우스 쪽으로 기울고, 이 연수의 낱말이 둘레를 돌아요. AI·코딩·과학처럼 기술이 주제인 연수에. | futuristic, tech, bold | G마켓 산스 / Noto Sans KR(본고딕) / Syne | 보통 | orbit | orbit-3d(첫 화면 그림) |
| `stone-stream` | 돌과 물결 | 연수 제목으로 그린 그림 한 장이 첫 화면에. 돌을 돌아 흐르는 물결 선이 일렁이고, 마우스를 올리면 물결이 비켜 흘러요. 미술·독서·생태·마음 연수에. | editorial, natural, calm | 송명 / 고딕 A1 / Instrument Serif | 보통 | stream | stream-lines(첫 화면 그림) |

살아 있는 첫 화면(쇼케이스) 4종(`deck-collage` · `time-dial` · `knot-orbit` · `stone-stream`): 첫 화면에 그림이 들어 있다. 그림은 서버가 정지 모습(HTML·SVG)으로 먼저 그리고, 프리셋의 `graphic` 효과가 움직임과 반응을 더한다. 모션 1단계 이하·동작 줄이기·저사양에서는 정지 그림 그대로다. 이 그림 효과는 다른 프리셋의 첫 화면 그래픽(`design.graphic`)으로도 고를 수 있다.

## 4. 효과 56가지
| id | 이름 | 강도 | 슬롯 | 설명 |
|---|---|---|---|---|
| `split-reveal` | 글자 드러내기 (Split reveal) | 2 | 첫 화면 제목, 섹션 제목, 마무리 문장, 핵심 문장 | 제목을 줄·낱말·글자로 나눠 보이지 않는 틀 안에서 아래에서 위로 밀어 올립니다. 수상작 포트폴리오의 대표 등장 방식입니다. |
| `kinetic-weight` | 움직이는 글자 굵기 (Kinetic weight) | 2 | 첫 화면 제목, 섹션 제목, 마무리 문장 | 가변 글꼴의 굵기가 스크롤 위치(화면 가운데일수록 굵게)나 포인터 거리(가까운 글자만 굵게)에 따라 바뀝니다. |
| `scroll-fill` | 스크롤 글 차오름 (Scroll fill) | 2 | 핵심 문장, 마무리 문장, 섹션 제목 | 긴 문장의 낱말이 흐린 색에서 제 색으로 스크롤에 맞춰 차오릅니다. 핵심 메시지를 천천히 읽게 만듭니다. |
| `scramble` | 왼쪽부터 또렷해지는 글자 (Decode reveal) | 2 | 첫 화면 제목, 섹션 제목, 숫자 | 글자가 왼쪽부터 차례로 또렷해집니다. 한글은 다른 음절로 바뀌지 않고, 영문·숫자만 잠깐 섞입니다(0.7초 안, 한 번). |
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
| `sticky-scrolly` | 그림 고정 스크롤 (Sticky scrollytelling) | 2 | 핵심 문장, 일정, 섹션 등장 | 한쪽 그림은 고정되고, 옆 단계 글을 읽어 내려가면 그림이 단계에 맞게 바뀝니다. 그림이 없으면 큰 번호·제목·진행 고리를 만듭니다. |
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
| `confetti-shapes` | 도형 무늬 (Memphis shapes) | 1 | 첫 화면 그래픽, 마무리 그래픽 | 세모·고리·물결·점 묶음·더하기·반원을 가장자리에 흩어 둡니다(정지 SVG). 강도 2 이상은 포인터에 살짝 시차. |
| `chalkboard` | 칠판 (Chalkboard) | 2 | 첫 화면 그래픽, 마무리 그래픽 | 칠판 질감(분필 가루·지운 자국)과 분필 낙서(바를 정 正, 화살표, 별, +, =, 체크)가 한 번 그려집니다. 영역을 어두운 칠판 색으로 바꿉니다. |
| `shader-gradient` | 흐르는 색 (Shader gradient) | 3 | 첫 화면 그래픽, 마무리 그래픽 | WebGL 조각 셰이더로 만든 흐르는 잡음 그라데이션(도메인 워핑 + 그레인). three.js 없이 4KB. |
| `noise-orb` | 빛나는 구 (Glowing orb) | 2 | 첫 화면 그래픽 | 원뿔 그라데이션이 겹쳐 천천히 도는 빛나는 구(AI 음성 비서 느낌). 숨 쉬듯 커졌다 작아지고 포인터 쪽으로 살짝 기웁니다. |
| `riso` | 인쇄 망점 (Risograph) | 1 | 첫 화면 그래픽, 마무리 그래픽 | 두 잉크(주 색·강조 색)의 망점이 살짝 어긋나 겹치는 리소그래프 인쇄 질감(정지). |
| `blueprint-grid` | 설계도 모눈 (Blueprint grid) | 1 | 첫 화면 그래픽, 마무리 그래픽 | 설계도 모눈(작은 칸·큰 칸), 모서리 맞춤 표시, 실제 영역 치수. 강도 2 이상·정밀 포인터면 좌표 십자선이 따라옵니다. |
| `slide-fan` | 펼친 교재 (Slide fan) | 2 | 첫 화면 그래픽 | 교재 쪽을 부채처럼 펼친 3D 더미. 마우스 쪽으로 기울고, 뒤 장을 누르면 위로 올라오고, 스크롤하면 살짝 떠올라요. 쪽 그림이 없으면 제목 카드로 만들어요. |
| `schedule-dial` | 하루 시계 (Schedule dial) | 2 | 첫 화면 그래픽 | 하루 일정을 둥근 시계로 그려요. 순서마다 길이에 비례한 호가 차례로 그려지고, 마우스·초점을 두면 가운데에 그 순서가 뜨고, 연수 중에는 지금 바늘이 돌아요. |
| `orbit-3d` | 입체 궤도 (Orbit knot) | 2 | 첫 화면 그래픽 | 점으로 짠 입체 매듭이 천천히 돌아요. 점들이 관을 따라 감기고, 마우스 쪽으로 기울고, 이 연수의 낱말이 둘레 고리를 돌아요. WebGL 없이 Canvas만 써요. |
| `stream-lines` | 돌과 물결 (Stone & stream) | 2 | 첫 화면 그래픽 | 연수 제목으로 그린 그림 한 장. 돌 두세 개를 돌아 흐르는 물결 선이 천천히 일렁이고, 마우스를 올리면 그 자리가 돌이 되어 물결이 비켜 흘러요. 같은 제목이면 늘 같은 그림이에요. |
| `smooth-scroll` | 부드러운 휠 스크롤 (Smooth scroll (Lenis)) | 3 | 스크롤 | Lenis로 휠 스크롤을 부드럽게 합니다. 수상작 사이트의 "무게감 있는 스크롤". · 외부 라이브러리 |
| `gsap-scroll` | 고정 장면 스크롤 (GSAP ScrollTrigger scrub) | 3 | 섹션 등장, 핵심 문장, 일정 | GSAP ScrollTrigger로 섹션을 잠깐 고정하고 안쪽 요소가 스크롤에 맞춰 차례로 떠오릅니다(scrub). 넓은 화면만 고정. · 외부 라이브러리 |
| `three-hero` | 점 구슬 (Point-cloud sphere (OGL)) | 3 | 첫 화면 그래픽 | OGL(작은 WebGL 라이브러리)로 만든 2,400개 점의 구체가 천천히 돌고 표면이 숨 쉬며 포인터 쪽으로 기웁니다. · 외부 라이브러리 |

## 5. 색 조합 34가지(`design.palette`)
프리셋의 모양·효과는 그대로 두고 색만 바꾼다. 모두 라이트·다크에서 글자 대비 4.5:1 이상.
| id | 이름 | 분위기 | 주제 |
|---|---|---|---|
| `night-story` | 밤 이야기 | emotional, calm, warm | sel, counseling, reading, parent |
| `dawn-letter` | 새벽 편지 | emotional, calm, warm | sel, counseling, reading, korean |
| `classroom-chalk` | 칠판 교실 | handmade, retro, warm | math, korean, history, general |
| `pencil-notebook` | 연필과 공책 | handmade, calm, minimal | korean, reading, math, parent |
| `forest-walk` | 숲길 | natural, calm, warm | environment, science, pe, career |
| `ocean-calm` | 잔잔한 바다 | calm, natural, minimal | counseling, environment, science, general |
| `spring-campus` | 봄 교정 | playful, warm, natural | general, parent, english, career |
| `maker-orange` | 메이커 공방 | energetic, bold, tech | maker, coding, science, career |
| `code-terminal` | 코드 터미널 | tech, retro, minimal | coding, ai, maker, edutech |
| `ai-lab` | AI 실험실 | futuristic, tech, bold | ai, edutech, coding, science |
| `future-glass` | 미래 유리 | futuristic, minimal, calm | ai, edutech, policy, general |
| `data-blue` | 데이터 블루 | formal, minimal, tech | policy, admin, edutech, general |
| `office-navy` | 교육청 남색 | formal, calm, minimal | policy, admin, safety, general |
| `hanji-ink` | 한지와 먹 | editorial, calm, minimal | korean, history, reading, art |
| `dancheong` | 단청 | bold, retro, warm | history, korean, art, music |
| `ink-wash` | 수묵 | minimal, editorial, calm | korean, history, art, reading |
| `math-grid` | 수학 모눈 | minimal, playful, tech | math, science, coding, edutech |
| `playground` | 놀이터 | playful, energetic, bold | math, pe, english, parent |
| `crayon` | 크레파스 | playful, handmade, warm | art, parent, korean, math |
| `science-lab` | 과학실 | tech, energetic, natural | science, environment, maker, ai |
| `eco-leaf` | 생태 잎 | natural, warm, calm | environment, science, safety, parent |
| `sunset-retro` | 노을 레트로 | retro, bold, emotional, futuristic | music, art, sel, coding |
| `riso-press` | 리소 인쇄 | retro, editorial, playful, bold | art, reading, music, korean |
| `music-room` | 음악실 | emotional, warm, editorial | music, art, sel, parent |
| `sport-court` | 체육관 | energetic, bold, playful | pe, safety, career, general |
| `global-cafe` | 세계 카페 | warm, playful, editorial | english, career, parent, general |
| `career-compass` | 진로 나침반 | formal, warm, calm | career, policy, general, parent |
| `safety-first` | 안전 우선 | bold, formal, energetic | safety, policy, admin, pe |
| `parent-warm` | 학부모 소통 | warm, calm, emotional | parent, counseling, sel, general |
| `mono-blue` | 미니멀 흑백 | minimal, formal, editorial | policy, admin, general, coding |
| `museum-stone` | 박물관 | editorial, formal, calm | history, art, korean, reading |
| `library-lamp` | 도서관 등불 | calm, editorial, warm | reading, korean, history, general |
| `counsel-sage` | 상담실 세이지 | calm, natural, warm | counseling, sel, parent, general |
| `edutech-mint` | 에듀테크 민트 | tech, playful, minimal | edutech, coding, ai, math |

## 6. 글꼴 짝 25가지(`design.fontPair`)
| id | 이름 | 제목 | 본문 | 분위기 |
|---|---|---|---|---|
| `pretendard-solo` | 프리텐다드 단일 | Pretendard Variable | Pretendard Variable | minimal, formal, tech, calm |
| `suit-sharp` | SUIT 또렷함 | SUIT Variable | Pretendard Variable | minimal, tech, bold, futuristic |
| `wanted-product` | 원티드 산스 | Wanted Sans Variable | Wanted Sans Variable | tech, minimal, futuristic, formal |
| `serif-editorial` | 잡지 명조 | Noto Serif KR | Pretendard Variable | editorial, formal, emotional |
| `gowun-letter` | 고운 편지 | Gowun Batang | Gowun Dodum | warm, emotional, calm, handmade |
| `hahmlet-modern` | 함렛 모던 세리프 | Hahmlet | IBM Plex Sans KR | editorial, formal, bold |
| `plex-briefing` | IBM Plex 브리핑 | IBM Plex Sans KR | IBM Plex Sans KR | formal, tech, minimal |
| `blackhan-poster` | 검은고딕 포스터 | Black Han Sans | Pretendard Variable | bold, energetic, retro |
| `dohyeon-class` | 도현 교실 | Do Hyeon | Gowun Dodum | playful, warm, bold |
| `jua-round` | 주아 동글 | Jua | Pretendard Variable | playful, warm |
| `gaegu-notebook` | 개구 공책 | Gaegu | Gowun Dodum | handmade, playful, warm |
| `pen-diary` | 나눔손글씨 일기 | Nanum Pen Script | Gowun Dodum | handmade, emotional, warm |
| `gasoek-impact` | 가석 임팩트 | Gasoek One | Pretendard Variable | bold, editorial, energetic |
| `orbit-future` | 오르빗 미래 | Orbit | Pretendard Variable | futuristic, tech, minimal |
| `songmyung-classic` | 송명 고전 | Song Myung | Nanum Myeongjo | retro, editorial, formal |
| `dongle-cute` | 동글 귀염 | Dongle | Pretendard Variable | playful, warm |
| `myeongjo-reading` | 나눔명조 읽기 | Nanum Myeongjo | Nanum Myeongjo | editorial, calm, formal |
| `maruburi-calm` | 마루 부리 차분 | MaruBuri | Pretendard Variable | calm, editorial, emotional |
| `nanumsquare-office` | 나눔스퀘어 네오 공문 | NanumSquareNeo | NanumSquareNeo | formal, minimal |
| `galmuri-pixel` | 갈무리 픽셀 | Galmuri11 | Pretendard Variable | retro, playful, tech |
| `gothic-a1-swiss` | 고딕 A1 스위스 | Gothic A1 | Gothic A1 | minimal, editorial, bold |
| `diphylleia-elegant` | 디필레이아 우아 | Diphylleia | Gowun Batang | editorial, emotional, calm |
| `bagel-pop` | 베이글 팝 | Bagel Fat One | Pretendard Variable | playful, bold, energetic |
| `yeonsung-friendly` | 연성 다정 | Yeon Sung | Gowun Dodum | handmade, warm, playful |
| `noto-neutral` | 노토 산스 중립 | Noto Sans KR | Noto Sans KR | minimal, formal |

## 7. 글꼴
| 키 | 글꼴 | 종류 | 라이선스 |
|---|---|---|---|
| `pretendard` | Pretendard | sans | OFL-1.1 |
| `suit` | SUIT | sans | OFL-1.1 |
| `wanted` | Wanted Sans | sans | OFL-1.1 |
| `gmarket` | G마켓 산스 | sans | OFL-1.1 (G마켓 공식 배포) |
| `maruburi` | 마루 부리 | serif | OFL-1.1(네이버 마루 부리) |
| `notoSans` | Noto Sans KR(본고딕) | sans | OFL-1.1 |
| `nanumGothic` | 나눔고딕 | sans | OFL-1.1 |
| `nanumMyeongjo` | 나눔명조 | serif | OFL-1.1 |
| `nanumSquare` | 나눔스퀘어 | sans | OFL-1.1(네이버 나눔스퀘어) |
| `nanumSquareRound` | 나눔스퀘어라운드 | rounded | OFL-1.1(네이버 나눔스퀘어라운드) |
| `nanumSquareNeo` | 나눔스퀘어 네오 | sans | OFL-1.1(네이버 나눔스퀘어 네오) |
| `nanumBarun` | 나눔바른고딕 | sans | OFL-1.1(네이버 나눔바른고딕) |
| `nanumPen` | 나눔손글씨 펜 | hand | OFL-1.1 |
| `nanumBrush` | 나눔손글씨 붓 | hand | OFL-1.1 |
| `spoqa` | 스포카 한 산스 네오 | sans | OFL-1.1 |
| `gothicA1` | 고딕 A1 | sans | OFL-1.1 |
| `songMyung` | 송명 | serif | OFL-1.1 |
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
| `barlowCond` | Barlow Condensed | latin | OFL-1.1 |
| `plexCond` | IBM Plex Sans Condensed | latin | OFL-1.1 |
| `unbounded` | Unbounded | latin | OFL-1.1 |
| `caveat` | Caveat | latin | OFL-1.1 |
| `anton` | Anton | latin | OFL-1.1 |
| `instrumentSerif` | Instrument Serif | latin-serif | OFL-1.1 |
| `sora` | Sora | latin | OFL-1.1 |
| `syne` | Syne | latin | OFL-1.1 |
| `geist` | Geist | latin | OFL-1.1 |
| `bigShoulders` | Big Shoulders Display | latin | OFL-1.1 |
| `redHat` | Red Hat Display | latin | OFL-1.1 |
| `outfit` | Outfit | latin | OFL-1.1 |
| `paperlogy` | 페이퍼로지 | sans | OFL-1.1 |
| `freesentation` | 프리젠테이션 | sans | OFL-1.1 |
| `a2z` | 에이투지체 | sans | OFL-1.1 |
| `astaSans` | 아스타 산스 | sans | OFL-1.1 |
| `lineSeed` | LINE Seed Sans KR | sans | OFL-1.1(LY Corp) |
| `ridibatang` | 리디바탕 | serif | OFL-1.1(리디) |
| `nanumHuman` | 나눔휴먼 | sans | OFL-1.1(네이버 나눔휴먼) |
| `pretendardGov` | Pretendard GOV | sans | OFL-1.1 |
| `kedu` | 케리스 케듀체 | display | OFL-1.1(KERIS) |
| `hakgyoMiso` | 학교안심 둥근미소 | rounded | OFL-1.1(교육부·KERIS 학교안심) |
| `hakgyoAllim` | 학교안심 알림장 | display | OFL-1.1(교육부·KERIS 학교안심) |
| `elice` | 엘리스 디지털배움체 | sans | OFL-1.1(엘리스) |
| `bagel` | 베이글 팻 원 | display | OFL-1.1 |

글꼴을 바꾸려면 `design.fonts`에 `{"display":"키","body":"키"}`. 학교망에서 CDN이 막히면 글꼴 파일을 `assets/fonts/`에 내려받아 쓰도록 안내한다.
