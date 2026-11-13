# 디자인: 프리셋·효과·연출·글꼴

> 이 파일은 `scripts/gen-design-doc.mjs`가 엔진 카탈로그에서 자동으로 만듭니다. 직접 고치지 말고 카탈로그를 고친 뒤 다시 만드세요.

## 1. 정하는 순서
0. **컨셉**: 디자인보다 먼저. 이 연수가 참가자에게 주는 경험 한 줄(`concept.idea`)과 화면에 되풀이할 그림(`concept.motif`)을 세운다. 프리셋은 그 모티프와 가장 가까운 것을 고른다(`references/concept.md`).
1. **프리셋**: 분위기(mood)·주제(topic)·유형으로 점수를 매겨 3안을 제안한다(`lecpage.mjs design`). 강사가 고른다.
2. **토큰**: 프리셋의 색·글꼴·모양. 기관 색이 있으면 `design.accent`(대비 자동 보정).
3. **페이지 연출(모션 단계)**: 0 정적 · 1 차분 · 2 보통 · 3 스크롤 연출(시차·덮기·쌓임·고정 장면. 넓은 화면에서만 움직이고, 저사양·휴대폰·동작 줄이기에서는 완성된 정지 모습). 크롬북이 있으면 2까지, 휴대폰뿐이면 기본 2(강사가 3을 고르면 허용), 공식 연수는 1. 실습형은 첫 화면만. 학교망 제한(`audience.network: restricted`)이면 외부 라이브러리 효과를 쓰지 않는다.
4. **슬롯별 효과**: 프리셋 기본값에서 출발해 상한·환경에 맞게 바꾸고, 제목·카드 효과는 연수마다 조금씩 변주한다(`design.seed`를 바꾸면 다른 조합). 직접 정하려면 `design.effects`에 `{"슬롯":"효과id"}`.
5. **대표 효과**: 사이트 전체에서 두드러지는 효과는 하나(`design.signature`).
5-1. **페이지 연출 계획**: 프리셋마다 첫 화면 밖 전 구간의 연출이 정해져 있다(아래 표의 '본문 연출'). 섹션이 들어오는 방식은 섹션 종류마다 다르고(모두 같은 떠오르기를 쓰지 않음), 일정 선·카드·사진·목록·섹션 제목 칸은 본문 단계가 허락하는 만큼 채운다. 0단계 정적 · 1단계 등장과 가리킴 반응 · 2단계 스크롤 연동 · 3단계 장면 연출. 칸을 비우려면 `design.effects`에 `{"칸":""}`.
6. **글꼴 네 벌**: 한글 제목(`display`) · 한글 본문(`body`) · 숫자·영문용 라틴 제목(`num`: 큰 번호·날짜·통계·시각) · 고정폭(`mono`). 기본은 교재 글꼴을 따르고, 없으면 프리셋 글꼴. 직접 정하려면 `design.fonts`.

## 2. 지킬 것
- 실습·질문·교재 화면은 모션 1단계를 넘지 않는다(머리만 조용히 등장). 화려함은 첫 화면·마무리에, 본문은 섹션마다 한 번 등장하고 멈춘다. 한 화면에 큰 움직임은 하나.
- 같은 요소를 두 효과가 움직이지 않는다(등장 + 시차 + 붙박이 겹침 금지). `scripts/overlap-lint.mjs`가 스크롤 자리마다 겹침·잘림·덮임·숨은 채 남은 내용·효과 꼬임을 검사한다(`qa`에 포함).
- 쉬는 상태가 완성 상태: 효과가 실패해도 글은 보인다. 동작 줄이기·'움직임 멈춤'을 늘 존중.
- 피할 기본값: 보라→파랑 그라데이션 첫 화면, 똑같은 카드 3장, 흔한 AI 이미지, 섹션마다 다른 화려한 효과, 스크롤 납치, 같은 배치의 섹션을 세 번 넘게 잇기(디자인 검사 `layout-repeat`).
- 한글: word-break: keep-all, 본문 행간 1.6~1.8, 제목 text-wrap: balance. 글꼴은 아래 목록(상업 이용 가능)만.

## 3. 무드 프리셋 27종
| id | 이름 | 어울리는 연수 | 분위기 | 글꼴(제목/본문/숫자) | 연출 | 첫 화면 | 글 배치 | 본문 연출(등장 + 칸별 효과) | 대표 효과 |
|---|---|---|---|---|---|---|---|---|---|
| `night-story` | 밤하늘 서사 | 밤에서 새벽으로 넘어가는 영화 첫 장면. 아주 큰 제목과 '한눈에 보기' 띠. 메시지가 중심인 특강에. | emotional, warm, futuristic, bold | 페이퍼로지 / 아스타 산스 / Bricolage Grotesque | 스크롤 연출 | cinema | 왼쪽 정렬 | 번짐·떠오름·위에서 펼침·옆에서·왼쪽부터 펼침 + spotlight, line-draw, clip-reveal, link-underline | tone-journey |
| `paper-workbook` | 종이 워크북 | 밝은 종이 위에 라임 실습지 한 장. 실습 목록과 완료 체크가 첫 화면부터 보이는 실습형 워크숍에. | minimal, playful, handmade | 프리젠테이션 / Pretendard / Barlow Condensed | 차분 | worksheet | 왼쪽 정렬 | 떠오름·왼쪽부터 펼침·넘어옴 + link-underline | micro-copy |
| `glass-lab` | 유리 실험실 | 어두운 바탕에 유리 칸으로 짠 요약판. 일시·장소·실습 수가 한 화면에. AI·에듀테크·미래교육 연수에. | tech, futuristic, minimal | 에이투지체 / Wanted Sans / Space Grotesk | 보통 | bento | 왼쪽 정렬 | 살짝 커짐·떠오름·위에서 펼침·옆에서·번짐 + spotlight, line-draw, link-underline | spotlight |
| `playground` | 놀이터 | 기울어진 흰 제목 상자와 원색 블록, 도구 이름이 흐르는 띠. 놀이·게임·창의 연수와 초등 활동에. | playful, energetic, bold, retro | 케리스 케듀체 / SUIT / Bricolage Grotesque | 보통 | poster | 왼쪽 정렬 | 내려앉음·넘어옴·옆에서·떠오름 + link-underline, line-draw, reveal-up | marquee |
| `calm-forest` | 숲의 숨 | 세이지 그린과 부리 글꼴 제목, 넓은 여백과 종이 질감. 마음·상담·생활교육·학부모 연수에. | calm, natural, warm, handmade | 마루 부리 / 나눔휴먼 / Fraunces | 차분 | quiet | 왼쪽 정렬 | 번짐·떠오름·옆에서 + line-draw, clip-reveal, link-underline | grain |
| `official-brief` | 공식 브리핑 | 남색 머리띠와 정보 표, 큰 숫자. 일시·장소·대상·이수 기준이 표로 보이는 설명회·직무연수에. | formal, minimal | 나눔스퀘어 네오 / Pretendard GOV / IBM Plex Sans Condensed | 차분 | brief | 왼쪽 정렬 | 번짐·왼쪽부터 펼침·떠오름 + line-draw, highlight-sweep, link-underline | counter |
| `editorial-ink` | 잉크 잡지 | 표제 띠와 아주 큰 명조 제목, 세 단 머리글. 독서·인문·역사처럼 글이 주인공인 연수에. | editorial, minimal, calm | 함렛 / Noto Serif KR / Fraunces | 보통 | masthead | 왼쪽 정렬 | 왼쪽부터 펼침·떠오름·위에서 펼침·옆에서·번짐 + line-draw, clip-reveal, link-underline | scroll-fill |
| `retro-pop` | 도파민 팝 | 통통한 제목과 동그란 날짜 스티커. 형광 분홍·보라가 터지는 음악·미술·영어·학생 활동에. | playful, retro, energetic, bold | 베이글 팻 원 / 페이퍼로지 / Unbounded | 보통 | sticker | 왼쪽 정렬 | 내려앉음·살짝 커짐·옆에서·떠오름 + link-underline, line-draw, reveal-up | magnetic |
| `chalkboard` | 칠판 교실 | 칠판에 분필로 쓴 제목과 오늘의 차례, 분필 받침에 놓인 안내. 교실 실천·초등 교과 연수에. | warm, handmade, playful | 학교안심 둥근미소 / 나눔스퀘어라운드 / Caveat | 보통 | board | 왼쪽 정렬 | 왼쪽부터 펼침·떠오름·옆에서 + line-draw, link-underline | doodle-scribbles |
| `blueprint-tech` | 설계도 | 도면 표제란처럼 짠 사양서. 고정폭 이름표와 모눈, 그려지는 선. 코딩·메이커·과학·데이터 연수에. | tech, minimal, futuristic | IBM Plex Sans KR / IBM Plex Sans KR / IBM Plex Mono | 보통 | spec | 왼쪽 정렬 | 왼쪽부터 펼침·옆에서·살짝 커짐·번짐 + spotlight, link-underline | line-draw |
| `riso-zine` | 형광 인쇄 | 판이 어긋난 굵은 제목과 망점, 비스듬한 도장. 두 색 잉크로 찍은 인쇄물 같은 미술·독서 동아리·창작 연수에. | handmade, retro, playful, editorial | 가석 / 고딕 A1 / Anton | 보통 | zine | 왼쪽 정렬 | 내려앉음·옆에서·넘어옴·왼쪽부터 펼침 + link-underline, clip-reveal | highlight-sweep |
| `sunrise-warm` | 새벽빛 | 날짜가 먼저 보이는 초대장. 바탕 글꼴 제목과 떠오르는 해. 학부모·진로·감사의 자리에. | warm, emotional, calm | 고운바탕 / LINE Seed Sans KR / Instrument Serif | 보통 | invite | 왼쪽 정렬(본문 center) | 떠오름·번짐·옆에서 + line-draw, clip-reveal, link-underline | scroll-fill |
| `keynote-dark` | 어두운 키노트 | 검은 무대 위 아주 큰 제목과 지평선 불빛, 한 줄 정보 레일. 기조 강연·발표회·미래교육 특강에. 스크롤 연출이 기본. | futuristic, bold, minimal | Wanted Sans / Wanted Sans / Geist | 스크롤 연출 | keynote | 왼쪽 정렬(본문 center) | 살짝 커짐·떠오름·위에서 펼침·옆에서·번짐 + spotlight, line-draw, split-reveal | scroll-fill |
| `corporate-clean` | 깔끔한 기업형 | 흰 바탕에 또렷한 제목, 오른쪽에 겹쳐 놓인 오늘의 일정 카드. 기관 설명회·업무 연수·에듀테크 소개에. | formal, minimal, calm | SUIT / SUIT / Sora | 차분 | panel | 왼쪽 정렬 | 떠오름·옆에서·왼쪽부터 펼침·번짐 + link-underline, line-draw | counter |
| `soft-pastel` | 부드러운 파스텔 | 아치·원·알약 도형 위의 날짜와 둥근 제목. 연보라·분홍·하늘빛의 포근한 화면. 학부모·저학년·마음 돌봄 연수에. | warm, calm, playful | 나눔스퀘어라운드 / LINE Seed Sans KR / Outfit | 보통 | soft | 왼쪽 정렬(본문 center) | 살짝 커짐·떠오름·옆에서·번짐 + link-underline, line-draw, reveal-up | stack-cards |
| `kinetic-type` | 움직이는 글자 | 화면을 넘치는 굵은 제목과 윤곽선 메아리 줄, 굵은 선으로 나눈 정보. 예술·동아리·학생 활동처럼 힘 있는 자리에. 스크롤 연출이 기본. | bold, energetic, editorial | 페이퍼로지 / 스포카 한 산스 네오 / Big Shoulders Display | 스크롤 연출 | ticker | 왼쪽 정렬 | 옆에서·위에서 펼침·떠오름·왼쪽부터 펼침 + line-draw, split-reveal, link-underline | marquee |
| `warm-minimal` | 따뜻한 미니멀 | 넓은 여백과 명조 제목, 가는 큰 날짜 하나, 점선으로 이은 정보. 독서·인문·상담처럼 조용히 읽히는 자리에. | minimal, calm, natural | 나눔명조 / 아스타 산스 / Fraunces | 차분 | column | 왼쪽 정렬 | 번짐·떠오름·왼쪽부터 펼침 + line-draw, link-underline | highlight-sweep |
| `deck-collage` | 펼친 교재 | 교재 쪽을 부채처럼 펼친 3D 더미가 첫 화면에. 마우스에 기울고, 누르면 다음 장이 올라와요. 교재가 주인공인 연수에. | editorial, handmade, bold | 페이퍼로지 / 아스타 산스 / Sora | 보통 | collage | 왼쪽 정렬 | 넘어옴·떠오름·옆에서 + spotlight, clip-reveal, link-underline | slide-fan(첫 화면 그림) |
| `time-dial` | 하루 시계 | 하루 일정이 둥근 시계로 그려지는 첫 화면. 순서마다 호가 그려지고, 연수 중에는 지금 바늘이 돌아요. 일정이 중요한 행사·종일 연수에. | futuristic, bold, tech | 아스타 산스 / 아스타 산스 / Red Hat Display | 보통 | dial | 왼쪽 정렬 | 옆에서·떠오름·살짝 커짐·번짐 + spotlight, line-draw | schedule-dial(첫 화면 그림) |
| `knot-orbit` | 입체 궤도 | 점으로 짠 입체 매듭이 천천히 도는 첫 화면. 마우스 쪽으로 기울고, 이 연수의 낱말이 둘레를 돌아요. AI·코딩·과학처럼 기술이 주제인 연수에. | futuristic, tech, bold | 페이퍼로지 / Noto Sans KR(본고딕) / Syne | 보통 | orbit | 왼쪽 정렬 | 살짝 커짐·왼쪽부터 펼침·위에서 펼침·옆에서 + spotlight, line-draw, link-underline | orbit-3d(첫 화면 그림) |
| `stone-stream` | 돌과 물결 | 연수 제목으로 그린 그림 한 장이 첫 화면에. 돌을 돌아 흐르는 물결 선이 일렁이고, 마우스를 올리면 물결이 비켜 흘러요. 미술·독서·생태·마음 연수에. | editorial, natural, calm | 송명 / 고딕 A1 / Instrument Serif | 보통 | stream | 왼쪽 정렬 | 번짐·떠오름·왼쪽부터 펼침 + line-draw, clip-reveal, link-underline | stream-lines(첫 화면 그림) |
| `ripple-center` | 번지는 파문 | 모든 글이 가운데 축에 놓이고, 뒤에서 물결 고리가 번져 서로 겹쳐요. 누른 자리에서 새 물결이 생겨요. 본문도 가운데 정렬. 마음·관계·성찰이 주제인 연수에. | emotional, calm, warm | 고운돋움 / Pretendard / Fraunces | 보통 | ripple | 가운데 정렬 | 살짝 커짐·번짐·떠오름 + link-underline, line-draw, clip-reveal | arc-ripple(첫 화면 그림) |
| `minute-map` | 시간 점묘 | 연수의 1분이 점 하나. 순서마다 제 색으로 찍힌 점 지도가 첫 화면에. 일정에 마우스를 올리면 그 시간의 점만 또렷해져요. 본문은 왼쪽에 고정폭 이름표를 둔 장부 격자. 데이터·평가·연구 연수에. | tech, minimal, formal | 나눔스퀘어 / 스포카 한 산스 네오 / JetBrains Mono | 차분 | minutes | 자료 그림(본문 ledger) | 왼쪽부터 펼침·옆에서·떠오름·번짐 + link-underline, line-draw | minute-map(첫 화면 그림) |
| `mosaic-split` | 도형 모자이크 | 화면을 반으로 나눠 한쪽은 제목에서 나온 도형 타일 그림, 한쪽은 글. 타일은 저마다 돌고, 마우스를 올리면 돌아가요. 본문도 머리 왼쪽·내용 오른쪽의 두 단. 미술·수학·메이커·창의 연수에. | playful, bold, editorial | 도현 / 나눔고딕 / Outfit | 보통 | mosaic | 반반 화면 | 넘어옴·옆에서·내려앉음·떠오름 + link-underline, line-draw, clip-reveal | 제목에서 나온 그림(첫 화면 그림) |
| `cover-sheet` | 표지 한 장 | 그림이 화면 위쪽을 가득 채우고 제목 판이 그림에 걸쳐요. 교재 첫 쪽 그림이 있으면 그 그림, 없으면 제목 첫 글자를 크게 자른 포스터. 본문 섹션마다 큰 첫 글자가 뒤에 깔려요. 교재·발표 자료가 얼굴인 연수에. | bold, editorial, minimal | 페이퍼로지 / 고운돋움 / Bricolage Grotesque | 보통 | cover | 그림 가득 | 위에서 펼침·떠오름·옆에서·번짐 + line-draw, clip-reveal, split-reveal, link-underline | 제목에서 나온 그림(첫 화면 그림) |
| `vertical-type` | 세로쓰기 | 제목을 세로로 쓰고 큰 원 하나와 날짜 도장을 곁들인 책 표지. 글과 버튼은 오른쪽 맞춤, 본문 머리도 오른쪽에 서요. 국어·독서·역사·인문처럼 글과 여백이 주인공인 연수에. | editorial, calm, natural | 나눔명조 / 리디바탕 / Instrument Serif | 차분 | vertical | 오른쪽 정렬·세로쓰기 | 번짐·옆에서·왼쪽부터 펼침 + line-draw, link-underline | highlight-sweep |
| `swiss-offset` | 어긋난 격자 | 열두 칸 격자 위에 계단처럼 어긋난 큰 제목이 색면에 걸치고, 가장자리에 날짜를 세워 썼어요. 본문은 섹션마다 머리와 내용의 자리가 좌우로 엇갈려요. 정책·설명회·수학·기관 연수에. | minimal, bold, formal | 스포카 한 산스 네오 / 나눔고딕 / Barlow Condensed | 보통 | offset | 어긋난 격자 | 옆에서·왼쪽부터 펼침·위에서 펼침 + line-draw, split-reveal, link-underline | scroll-fill |

살아 있는 첫 화면(쇼케이스) 8종(`deck-collage` · `time-dial` · `knot-orbit` · `stone-stream` · `ripple-center` · `minute-map` · `mosaic-split` · `cover-sheet`): 첫 화면에 그림이 들어 있다. 그림은 서버가 정지 모습(HTML·SVG)으로 먼저 그리고, 프리셋의 `graphic` 효과가 움직임과 반응을 더한다. 모션 1단계 이하·동작 줄이기·저사양에서는 정지 그림 그대로다. 이 그림 효과는 다른 프리셋의 첫 화면 그래픽(`design.graphic`)으로도 고를 수 있다.

글 배치 문법(`layout`, 본문은 `variants.align`): 왼쪽 정렬이 기본이고, 가운데(새벽빛·어두운 키노트·부드러운 파스텔·번지는 파문) · 오른쪽·세로쓰기(세로쓰기) · 어긋난 격자(어긋난 격자) · 반반 화면(도형 모자이크) · 장부 격자(시간 점묘) · 그림 가득(표지 한 장)이 있다. 본문의 섹션 머리·구분선·번호·그림 다루기까지 같은 문법을 따른다. 좁은 화면에서는 모두 한 단이 된다.

## 3-1. 본문 배치 변형 95가지(섹션 `layout`)
섹션 종류마다 **구조가 다른** 배치(정렬만 다른 것은 세지 않음). 고르는 순서: 섹션에 적은 `layout`("변형" 또는 "변형@c·@r·@l" — 그 칸만 가운데·오른쪽·왼쪽) → 교재 구성 흐름(`structure.flow`)이 주인공으로 삼는 칸(절차 흐름도·큰 물음표·진행 지도·가로 트랙·무대, 프리셋이 기본 배치를 골랐을 때만) → 프리셋의 본문 계획 → 종류의 기본(첫째).
내용이 배치에 맞지 않으면 기본으로(길이를 모르거나 여러 날인 일정은 시간 도식을 쓰지 않음, 낱말이 셋 미만이면 그물 없음 등). 같은 종류 칸이 둘이면 두 번째는 다른 배치.
주인공: 글 · 숫자(실제 값) · **그림**(이 연수의 모티프 그림·교재 쪽 그림) · **도식**(교재의 값으로 그린 그림) · 조작(따라 하는 칸, 모양만 바뀜). 그림은 모두 서버가 그린 SVG·CSS이고 꾸밈(화면 낭독기에서 빠짐).
프리셋 계획은 `scripts/plan-body.mjs`가 짠다: 분위기에 맞는 변형 중에서, 어느 두 프리셋도 같은 설계도에서 본문 배치가 절반 넘게 같지 않게, 프리셋마다 그래픽 주인공 2개 이상·글만 있는 섹션 절반 이하·왼쪽 정렬이 아닌 섹션 2개 이상, 한 배치를 27개 프리셋 중 10개 넘게 쓰지 않게(배치가 셋 넘는 종류, `test/body-layouts.test.mjs`).
수치 도표(`table:chart`·`glance:bars`)는 교재 값이 '숫자 + 같은 단위'일 때만 그린다(`design/numbers.js`, 글 칸이 섞인 표·단위가 다른 값·연도는 도표로 바꾸지 않음). 숫자 표는 프리셋이 표를 골랐어도 도표로 그리고 원래 표는 '표로 보기'(인쇄할 때 펼침)에 둔다.

| 섹션 | 변형(첫째가 기본) — 주인공 · 고르는 기준 |
|---|---|
| `goals` | `ledger` 큰 번호 줄(글) — 목표가 3~6개이고 한 줄씩 또박또박 읽히게 할 때(기본)<br>`manifesto` 선언문(한 문장씩 크게)(글) — 목표가 2~4개로 짧고, 다짐처럼 크게 읽히게 할 때<br>`journey` 여정(길 위의 정류장)(도식) — 목표에 순서가 있어 하나씩 거쳐 가는 길로 보일 때<br>`bento` 체크 카드 벤토(글) — 목표가 4~6개이고 서로 독립이라 카드로 나눠 볼 때<br>`columns` 세로 단(큰 윤곽 숫자)(글) — 목표가 2~4개라 옆으로 나란히 견줄 때<br>`target` 과녁(목표마다 한 고리)(도식) — 목표가 2~5개이고 한 과녁을 겨누는 여러 고리처럼 보일 때 |
| `glance` | `figures` 큰 숫자 줄(숫자) — 숫자 서너 개를 크게(기본)<br>`tally` 그림 숫자(점·고리로 그린 수)(도식) — 분·시간·퍼센트·개수처럼 양이 눈에 보이면 좋을 때<br>`spec` 점선 사양표(숫자) — 항목이 다섯 넘거나 공식 문서처럼 차분해야 할 때<br>`bars` 막대 견줌(같은 단위의 수치)(도식) — 같은 단위의 수치 2~8개를 견줄 때(교재 값만, 단위가 섞이면 큰 숫자 줄) |
| `message` | `band` 띠 문장(글) — 문장을 화면 폭 띠에 크게(기본)<br>`stage` 가운데 무대(모티프 그림)(그림) — 한 문장이 짧고, 컨셉 그림과 함께 보여 줄 때<br>`split` 그림 곁 문장(옆 판에 모티프)(그림) — 문장이 두세 줄이고 컨셉 그림을 옆 판에 세워 둘 때 |
| `steps5` | `steps` 계단(글) — 단계가 차례로 올라가는 느낌일 때(기본)<br>`wheel` 둥근 고리 도식(도식) — 순서보다 서로 맞물린 요소(역량·원칙)일 때<br>`flow` 화살표 흐름도(도식) — 앞 단계가 다음 단계로 이어지는 과정일 때<br>`tabs` 낱말 넘김(눌러 보는 풀이)(글) — 풀이가 길어 한 번에 하나씩 읽게 할 때 |
| `outline` | `stack` 겹쳐 쌓이는 판(글) — 부가 2~4개이고 큰 번호로 구분할 때(기본)<br>`zigzag` 좌우 번갈아(그림과 글)(그림) — 교재 쪽 그림이 있거나 부마다 그림을 곁들일 때<br>`bento` 벤토 격자(글) — 부가 4개 넘고 한 화면에 모아 볼 때<br>`toc` 책 차례(점선과 쪽)(글) — 글이 주인공인 연수, 교재 쪽 번호를 따라갈 때<br>`filmstrip` 필름 띠(가로로 넘김)(그림) — 부가 4개 넘거나 교재 쪽 그림을 크게 보여 줄 때 |
| `schedule` | `timeline` 세로 시간 레일(글) — 순서가 많고 설명이 긴 일정(기본)<br>`track` 가로 트랙(시간 축)(도식) — 하루 안 일정이고 지금 순서를 한눈에 보일 때<br>`clock` 시계판(도식) — 순서가 2~8개이고 시간 비율이 중요한 짧은 연수<br>`table` 시간표(표)(글) — 공식 문서·여러 날 일정처럼 표가 익숙할 때<br>`blocks` 블록 쌓기(길이만큼 높이)(도식) — 순서마다 길이 차이가 커서 덩어리로 보이게 할 때 |
| `tools` | `bento` 벤토 칸(글) — 도구 2~6개를 크기가 다른 칸으로(기본)<br>`rows` 줄 색인(글) — 도구가 많거나 설명이 길 때<br>`tiles` 표 타일(떼는 쪽에 주소)(글) — 도구 이름이 짧고 3~8개일 때 |
| `materials`·`followup` | `files` 줄 목록(글) — 자료가 많을 때(기본)<br>`shelf` 책장(그림) — 자료가 3~8개이고 읽을거리가 중심일 때<br>`pile` 파일 더미(겹친 종이 카드)(글) — 자료가 2~6개이고 하나씩 집어 들게 할 때 |
| `instructor` | `profile` 이름과 이력표(글) — 이력이 길 때(기본)<br>`card` 명함(글) — 연락처·소속이 중심일 때<br>`portrait` 큰 얼굴과 소개말(그림) — 소개말이 있고 사진이나 이름을 크게 보일 때<br>`career` 이력 연표 그림(선 위의 활동)(도식) — 이력이 둘 넘고(연도가 있으면 연도 차례로) 걸어온 길을 한 줄로 보일 때 |
| `speakers` | `people` 얼굴 격자(글) — 연사가 여럿일 때(기본)<br>`lineup` 발표 순서 줄(글) — 발표 시간·순서가 중요할 때<br>`axis` 발표 시간 축(사이 간격이 시간만큼)(도식) — 발표마다 시작 시각이 있고 발표 제목이 주인공일 때 |
| `sessions` | `course` 줄 목록(글) — 차시가 많을 때(기본)<br>`map` 진행 지도(도식) — 차시 3~8개의 흐름과 지금 위치를 보일 때<br>`grid` 달력 칸(숫자) — 날짜가 중요한 과정일 때 |
| `faq` | `accordion` 아코디언(글) — 질문이 많을 때(기본)<br>`twocol` 두 단 펼침(글) — 질문이 2~6개이고 답이 짧아 다 펼쳐 둘 때<br>`index` 질문 색인(왼쪽 질문·오른쪽 답)(글) — 답이 길어 골라 읽게 할 때 |
| `glossary` | `index` 색인 줄(글) — 낱말이 많을 때(기본)<br>`cards` 낱말 카드(큰 첫 글자)(글) — 낱말이 3~8개일 때<br>`dict` 사전 두 단(글) — 풀이가 긴 낱말이 여럿일 때<br>`web` 낱말 그물(연수 제목을 가운데 둔 도식)(도식) — 낱말 3~8개가 한 주제에 묶일 때 |
| `procedure` | `rail` 번호 줄(글) — 단계 설명이 길 때(기본)<br>`flow` 단계 흐름도(도식) — 단계 3~8개가 차례로 이어질 때<br>`cards` 번호 카드(글) — 단계마다 담당·시간이 달라 나눠 볼 때<br>`lanes` 담당별 갈래 도식(도식) — 단계마다 담당이 적혀 있고 담당이 2~4갈래일 때(누가 언제 이어받는지) |
| `cases` | `rows` 번호 줄(글) — 사례 본문이 길 때(기본)<br>`quote` 인용 카드(글) — 사례마다 인용(말)이 있을 때<br>`notes` 붙인 쪽지(글) — 짧은 사례 여럿을 벽에 붙이듯 보일 때 |
| `discuss` | `list` 번호 질문(글) — 질문이 많을 때(기본)<br>`bigq` 큰 물음표(그림) — 질문이 1~4개이고 화면에 크게 띄울 때<br>`bubbles` 말풍선(글) — 서로 주고받는 대화처럼 보이게 할 때<br>`round` 모둠 원탁(자리마다 질문)(도식) — 모둠으로 둘러앉아 질문 2~6개를 차례로 나눌 때 |
| `table` | `table` 표(글) — 칸이 많은 표(기본)<br>`rowcards` 줄 카드(글) — 줄마다 한 묶음으로 읽는 표(칸 2~5개)<br>`compare` 비교 열(글) — 2~4가지를 같은 기준으로 견줄 때<br>`chart` 수치 도표(막대·도넛, 표로 보기 곁들임)(도식) — 교재 표에 숫자 칸이 있을 때만(합이 100%면 도넛, 아니면 막대). 숫자가 없으면 표 |
| `closing` | `finale` 큰 문장(글) — 마지막 문장을 크게(기본)<br>`poster` 그래픽 가득(그림) — 컨셉 그림으로 끝을 맺을 때<br>`card` 서명 카드(글) — 인사·서명을 편지처럼 건넬 때<br>`recap` 지나온 길(오늘의 차례를 한 줄로)(도식) — 차례·실습·핵심 단계가 셋 넘게 있어 마지막에 하루를 되짚을 때 |
| `readiness` | `checklist` 체크 줄(조작) — 기본<br>`tiles` 체크 타일(조작) — 준비물이 2~6개일 때<br>`steps` 가로 단계(조작) — 준비가 순서대로 이어질 때 |
| `deck` | `viewer` 한 장씩 보기(조작) — 기본<br>`rail` 쪽 색인 곁들임(조작) — 쪽 제목으로 찾아 들어가게 할 때<br>`stage` 어두운 무대(조작) — 교재 쪽 그림을 크게 보일 때 |
| `qa` | `thread` 위에서 쓰고 아래로 쌓임(조작) — 기본<br>`split` 왼쪽에서 쓰고 오른쪽에 쌓임(조작) — 넓은 화면에서 질문이 많이 쌓일 때<br>`wall` 쪽지 벽(조작) — 짧은 질문이 많을 때 |
| `quiz` | `list` 문항 줄(조작) — 기본<br>`cards` 문항 카드(조작) — 문항이 2~6개일 때<br>`big` 한 문항씩 크게(조작) — 문항이 적고 보기가 짧을 때 |
| `reflection` | `journal` 기록지(조작) — 기본<br>`notes` 나란한 쪽지(조작) — 물음이 2~4개일 때<br>`letter` 가운데 편지지(조작) — 돌아보는 글을 길게 쓸 때 |
| `survey` | `form` 문항 줄(조작) — 기본<br>`cards` 문항 카드(조작) — 문항이 적을 때<br>`sheet` 가운데 종이(조작) — 설문을 차분히 한 장으로 |
| `board` | `wall` 벽(격자)(조작) — 기본<br>`feed` 한 줄 흐름(조작) — 글이 긴 나눔일 때<br>`mosaic` 크기가 다른 모자이크(조작) — 사진·결과물이 많은 나눔 |
| `poll` | `panel` 판(조작) — 기본<br>`split` 질문 목록 곁들임(조작) — 준비된 질문을 옆에 보일 때<br>`stage` 가운데 무대(조작) — 한 질문을 크게 띄울 때 |
| `gallery` | `grid` 고른 격자(그림) — 기본<br>`mosaic` 크기가 다른 모자이크(그림) — 사진이 5장 넘을 때 |

움직임: 차분 단계(1)는 섹션이 들어올 때 한 번(배치마다 어울리는 방식, 그림은 길·축·고리가 제자리로), 보통·스크롤 연출(2·3)은 스크롤에 맞춰 그려짐(여정의 길·트랙 채움·시계판·고리 회전·선언문 문장·필름 띠 가운데 장면·마무리 그림 미끄러짐). 반응: 도식과 목록 잇기(가리키거나 초점이 오면 같은 번호가 켜짐)·낱말 넘김·필름 띠·질문 색인·카드 들림. 동작 줄이기·가벼운 모드·JS가 없으면 완성된 정지 모습이고 아무것도 숨지 않는다.
모티프(`concept.motif` → 그림 가족: 고리·점·도형 타일·물결·호·색면·별·큰 글자·모눈): 바탕이 같은 두 섹션 사이의 구분 장식, 옅은 바탕 칸 구석의 그림, 무대·좌우 번갈아·큰 얼굴·마무리 그림으로 되풀이한다.

## 3-2. 말로 고치기(디자인 낱말)
강사가 디자인을 느낌으로 말하면("좀 답답해 보여요") 아래 표로 고칠 곳 2~3가지를 골라 **지금과 바꾼 모습**을 보여 주고(`options`·스크린숏), 고른 것만 `patch`로 적용한다. 지금 설정과 같은 안은 내지 않는다. 앱의 [디자인] 탭·디자인 둘러보기가 같은 규칙을 쓴다(`app/src/design-words/symptoms.js`).

| 이런 말 | 고칠 곳(위에서부터) |
|---|---|
| 답답해요·빽빽해요 | 여백이 넓은 프리셋(`calm-forest`·`warm-minimal`·`editorial-ink`·`ripple-center`·`vertical-type`·`sunrise-warm`·`corporate-clean`) · 어두우면 `theme=light` · 움직임 2 이상이면 1 · 칸이 많은 배치(벤토·타일·쪽지)를 줄 목록으로 |
| 글씨가 잘 안 읽혀요 | 어두우면 `theme=light` · 본문이 명조면 고딕 글꼴 짝(`pretendard-solo` 등) · 장식이 적은 프리셋(`official-brief`·`corporate-clean`) · 움직임 1 |
| 심심해요·밋밋해요 | 글만 있는 칸을 도식·그림 배치로(일정 `track`·`clock`, 목표 `journey`, 단계 `wheel` 등 내용에 맞는 것) · 그림 첫 화면 프리셋(showcase) · 움직임 한 단계 위 |
| 움직임이 정신없어요 | 움직임 1 → 0 · 첫 화면 그래픽 빼기(`design.graphic=''`) |
| 학교 느낌 | `chalkboard`·`paper-workbook`·`playground`·`soft-pastel` |
| 공식적으로 | `official-brief`·`swiss-offset`·`corporate-clean` · 움직임 1 |
| 흔한 사이트 같아요 | 왼쪽 정렬이 아닌 프리셋(가운데·세로쓰기·반반·그림 가득·어긋난 격자·자료 그림) · 도식 배치 두 곳 |
| 일정이 한눈에 안 들어와요(섹션 이름을 말함) | 그 섹션에 맞는 다른 배치(`variantOf`로 맞는지 확인한 것만) |
| 따뜻하게·세련되게·깔끔하게·발랄하게 | 그 분위기 낱말로 다시 매긴 프리셋 순위 위의 둘·셋 |
| 너무 어두워요 / 눈부셔요 | `theme=light` / `theme=dark` |
| 색이 촌스러워요(색 이름을 말함) | 말한 색을 `design.accent`로 · 분위기가 맞는 색 조합(`design.palette`) |
| 휴대폰에서 길어요 | 가로로 넘기거나 접는 배치(`outline:filmstrip`·`steps5:tabs`·`faq:accordion`) |

디자인 둘러보기에서 낱말을 담으면 이런 요청 문장이 나온다. 괄호 속 이름이 설계도 값이다.
```
디자인은 '숲의 숨'(calm-forest)으로 해 주세요.          → design.preset
첫 화면은 '가운데 정렬'(center)로 놓아 주세요.          → 그 글 배치(layout)를 쓰는 프리셋 가운데 주제·분위기에 가장 맞는 것
색 조합은 '숲길'(forest-walk)로 해 주세요.              → design.palette   · 화면은 어둡게 → design.theme=dark
글꼴은 '잡지 명조'(serif-editorial) 짝으로 해 주세요.   → design.fontPair
움직임은 '차분하게'(1단계)로 해 주세요.                 → design.motion=1
효과는 '형광펜 긋기'(highlight-sweep)를 써 주세요.      → 2단계 이상이면 design.signature, 첫 화면 바탕이면 design.graphic, 아니면 design.effects[칸]
본문은 일정표를 '가로 트랙(시간 축)'(schedule:track) 배치로 그려 주세요. → 그 종류 섹션의 layout(내용이 맞을 때만)
```

## 4. 효과 58가지
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
| `arc-ripple` | 번지는 파문 (Arc ripple) | 2 | 첫 화면 그래픽, 마무리 그래픽 | 물결 고리 세 벌이 제 자리에서 번지며 서로 겹쳐요. 마우스 쪽으로 가운데 물결이 살짝 끌리고, 누른 자리에서 새 물결이 한 번 번져요. 물결 자리는 연수 제목에서 나와 같은 제목이면 늘 같아요. |
| `minute-map` | 시간 점묘 (Minute map) | 1 | 첫 화면 그래픽 | 연수의 1분이 점 하나. 화면에 들어오면 점이 시간 순서대로 켜지고, 일정 줄이나 점을 가리키면 그 순서의 점만 또렷해져요. 연수 날 그 시간에는 지금 분의 점에 테가 생겨요. |
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
