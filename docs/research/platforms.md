# 참여형 수업·연수 플랫폼과 오픈소스 조사: lecpage 모듈 카탈로그에 무엇을 더할까

- 조사일: 2026-11-09. 상용 서비스의 무료 한도는 자주 바뀝니다. 공식 도움말과 제3자 자료가 서로 다른 경우는 **(불일치)**로 표시했습니다.
- 목적: 생성 사이트(정적 + 선택형 실시간 어댑터)에 넣을 **UX 패턴**, **재사용할 라이브러리**, **직접 구현할 기능**을 가르고, 우선순위를 정합니다.
- 기준이 되는 현재 계약(`docs/architecture.md`)
  - 모듈: `qa`, `board`, `poll(choice|word|scale)`, `quiz`(정적), `survey`, `attendance`, `reactions` 등
  - 실시간 컬렉션: `questions`(votes, status, pinned), `progress`(doing|done|stuck), `help`, `posts`, `polls`/`answers`, `chat`
  - 상태: `timer`, `notice`, `openPoll`, `follow`

---

## 0. 요약

| 결론 | 내용 |
|---|---|
| 가장 많이 빌려 올 패턴 | **입장 코드+QR**(Kahoot, Slido, 띵커벨), **Q&A 공감+검토**(Slido), **워드클라우드·척도·순위**(Mentimeter), **신호등**(Classroomscreen), **돌림판 뽑기**(AhaSlides, ClassPoint), **슬라이드와 연동된 질문**(Claper, ClassPoint, BigBlueButton), **라이브 퀴즈 순위표**(Kahoot, ClassQuiz) |
| lecpage만의 강점 | 인원 제한이 없습니다(교사 본인 백엔드). 계정 없이 쓰고, **CSV 내보내기가 무료**이며, 연수 사이트·교재·실시간 기능이 한 주소에 모입니다 |
| 재사용(라이브러리) | QR(qrcode-generator, MIT), 워드클라우드(wordcloud2.js, MIT), 정렬·끌기(SortableJS, MIT), 축하 효과(canvas-confetti, ISC), 아이콘(Lucide, ISC), 아바타(DiceBear 코드 MIT + **CC0 스타일만**), 일러스트(Open Peeps, CC0) |
| 재구현(직접 만듦) | 신호등, 가치수직선, 뽑기, 모둠 나누기, 라이브 퀴즈, 발표자 화면. 작고 우리 계약(어댑터)에 맞아야 하므로 직접 만듭니다 |
| 넣지 않음 | AGPL/GPL 코드(Claper, Formbricks 본체, LimeSurvey), tldraw SDK(프로덕션 라이선스 키 필요), unDraw 일괄 포함(라이선스상 앱·묶음 배포 금지), Jitsi를 meet.jit.si에 임베드(제한) |

---

## 1. 상용 참여 플랫폼

| 플랫폼 | 핵심 기능·UX 패턴 | 무료 한도(검증 수준) | 입장 방식 | lecpage가 배울 점 |
|---|---|---|---|---|
| **Slido**(Cisco) | Q&A(**공감 투표**, 익명 기본, **사전 검토**), 투표(선택·워드클라우드·평점·주관식·순위·퀴즈), PPT/Google Slides 연동 | 행사당 100명, 행사당 투표 3개(커뮤니티 답변) | `#코드` 또는 QR | Q&A 정렬(인기순·최신순), 검토 대기함, '답변 완료'와 '고정' |
| **Mentimeter** | 워드클라우드, 척도(Scales), 순위, **100점 배분**, 2×2 격자, 이미지 위 핀, Q&A, 퀴즈 순위표, 청중 진행 모드 | **계정 전체 월 50명**(도움말. 한 달에 한 번 초과 허용) | menti.com + 숫자 코드 | 질문 유형 다양성, 결과 공개 시점 조절(투표 중에는 숨김) |
| **AhaSlides** | **돌림판(Spinner wheel)**, 아이디어 모으기와 투표, 팀 퀴즈, 평점 척도 | 동시 50명. 단 퀴즈 슬라이드가 5개, 투표 슬라이드가 3개를 넘으면 3명으로 제한(공식 문서) | 코드, QR | 뽑기 애니메이션, 브레인스토밍 → 투표의 2단계 흐름 |
| **Kahoot!** | PIN 입장, 음악·카운트다운, **순위표와 시상대**, 팀 모드, 별명 생성기, 학생 주도 과제 | 개인 10명 / 인증 교사 40명 **(불일치)** | 게임 PIN | 퀴즈 상태 흐름(대기실 → 문제 → 정답 공개 → 순위 → 시상대), **부적절한 별명 방지**(생성기) |
| **Pear Deck** | Google Slides·PowerPoint 애드온, 끌어 놓기·그리기·텍스트 응답, **교사 대시보드에서만 이름 표시**(프로젝터에는 익명), 학생 주도 모드, 수업 후 개인 요약(Takeaways) | 유·무료 범위가 자주 바뀜(공식 확인) | 코드 | '프로젝터=익명 / 콘솔=실명' 분리, 개인별 기록 내려받기(`reflection`과 연결) |
| **Nearpod** | 실시간·학생 주도 수업, 협업 보드, Draw It, 게임형 퀴즈(Time to Climb), 짝 맞추기, 리포트 | 무료 Silver 플랜 있음. 인원 상한은 미확인 | 코드 | 학생 주도(자기 속도) 모드와 강사 주도 모드 전환 = `follow` 상태 |
| **ClassPoint** | PowerPoint 안에서 바로 쓰는 퀴즈 버튼, 단답, 워드클라우드, 그리기, 이미지 제출, **이름 뽑기**, 타이머, **별·레벨(게임화)** | 수업당 25명, 프레젠테이션당 질문 5개 **(대체로 일치)** | 수업 코드 | **슬라이드 위치와 질문 연결**(deck 모듈과 결합), 가벼운 보상(별) |
| **Wooclap** | 20종 이상의 질문 유형(정렬, 짝 맞추기, 이미지 위 찾기 등), 문자 메시지 참여, LMS 연동, 메시지 벽 | 실시간 1,000명(도움말) / 무료는 질문 2~5개 **(불일치)** | 코드, QR | 정렬·짝 맞추기 같은 '확인 문제' 유형 |
| **Padlet** | 담벼락·격자·열·타임라인·지도·캔버스, 반응(좋아요·투표·별·점수), 댓글, **게시물 승인**, 익명 게시 | 패들렛 3개, 파일 20MB(여러 자료 일치) | 링크, QR | `board`의 레이아웃(열=카테고리), 승인 모드, 반응 종류 선택 |
| **띵커벨**(아이스크림미디어) | 퀴즈, 토의·토론, 보드, 워크시트. 학생은 로그인 없이 입장. 한국 교사에게 가장 익숙한 용어와 흐름 | 교사 무료(이 조사 환경에서는 공식 사이트가 403으로 막혀 **직접 확인하지 못함**) | PIN, QR | **한국어 용어**(입장 코드, 모둠, 활동지), 교과서 수업 흐름 |
| **클래스툴** 류(교사 제작 학급 도구 모음) / **Classroomscreen** | 타이머, **신호등**(빨강·노랑·초록), **이름 뽑기**(모두 한 번씩 뽑힐 때까지 중복 없음), 소음 측정기, 활동 기호(함께·짝과·속삭임·조용히), 모둠 만들기, QR | Classroomscreen은 무료 위젯 제공(위젯 수는 불일치) | 없음(강사 화면 전용) | **서버 없이 강사 화면에서만 도는 위젯**: lecpage `local` 모드의 핵심 |
| **Google Forms** | 퀴즈 자동 채점, 응답을 Sheets로, 분기, 파일 업로드(로그인 필요), 응답 1회 제한(로그인 필요) | 무료 | 링크, QR | `survey` 모듈의 외부 연결 기본값, Sheets 어댑터와 자연스럽게 연결 |

참고: 상용 서비스는 대부분 **인원 상한과 내보내기 유료화**로 유료 전환을 유도합니다. lecpage는 교사 본인 백엔드를 쓰므로 인원 상한이 없고, 내보내기(CSV)를 무료 기본 기능으로 둘 수 있습니다. 이것이 차별점입니다.

---

## 2. UX 패턴 카탈로그와 lecpage 설계

| 패턴 | 잘하는 곳 | lecpage 설계(계약 대응) | 로컬 모드(서버 없음) | 난이도 |
|---|---|---|---|---|
| **입장 코드** | Kahoot PIN, Slido #, 띵커벨 PIN | `live.code` 6자리. 헷갈리는 글자(0/O, 1/I/l)를 뺀 대문자와 숫자. 프로젝터에 크게 표시하고 QR과 짧은 주소를 함께 보여 줌 | QR과 주소만 | S |
| **QR 입장** | 모두 | `screen.html` 첫 화면에 큰 QR. **QR 라이브러리는 vendor에 넣음**(학교망과 오프라인 대비, CDN 의존 금지) | ◎ | S |
| **발표자 화면** | Mentimeter, Slidev, Reveal.js 발표자 보기 | `console.html`: 현재·다음 항목, 메모, 경과·남은 시간, 실시간 참여 수, 신호등 집계. `screen.html`: 큰 글씨, 결과만 | 콘솔과 화면을 같은 기기 두 창에서 `BroadcastChannel`로 동기화 | M |
| **검토(모더레이션)** | Slido, Padlet | `questions.status`에 `pending`을 추가하고 설정 `moderation: 'pre'\|'post'`. 사전 검토면 승인 전에는 화면에 숨김 | 해당 없음 | S |
| **익명 모드** | Slido, Pear Deck | 기본 익명. **프로젝터에는 항상 익명**, 콘솔에서만 별명(실명 수집은 선택이고 동의 필요) | | S |
| **공감 투표** | Slido | 이미 `vote(questionId)` 있음. 기기당 1표(토큰), 인기순·최신순 정렬 토글 | | S(완료에 가까움) |
| **워드클라우드** | Mentimeter, ClassPoint | `poll.kind=word`. 정규화: 앞뒤 공백 제거, 영문 소문자 변환, 같은 단어 합치기, **한국어 조사 떼기(선택: '은/는/이/가/을/를/의/에/도'로 끝나면 제거)**, 금칙어 목록, 강사가 단어 숨김. 응답 하나를 한 단어(구)로 취급(Mentimeter 방식) | 해당 없음 | M |
| **신호등(이해도 체크)** | Classroomscreen(강사용), 각종 '이해했어요' 버튼 | 새 컬렉션 `signals {by, value: green\|yellow\|red, at}`. 참가자당 1개를 덮어씀(`progress`와 같은 방식). 화면에 비율 막대 표시. **빨강이 30%를 넘으면 콘솔에 알림**. 강사가 '초기화' 가능 | 강사가 화면에 신호등을 직접 켬(활동 신호: 시작·마무리·정리) | S |
| **가치수직선** | Mentimeter Scales, 교실 토론 기법 | `poll.kind=line`(0~100 슬라이더, 양 끝 이름표, 선택 이유 한 줄). 화면은 점 분포와 히스토그램, 이유 목록(익명). **1차와 2차 비교**(토론 전후 이동 화살표) | 해당 없음 | M |
| **뽑기(돌림판·이름 뽑기)** | AhaSlides 돌림판, ClassPoint, Classroomscreen | 새 모듈 `picker`. 출처: 참가자 별명, 직접 입력 목록, 모둠 이름. '모두 뽑힐 때까지 중복 없음', 결과 기록, 동작 줄이기 설정 시 즉시 결과 표시. `state.picker {pool, last}` | ◎(목록 직접 입력) | S |
| **모둠 타이머** | Classroomscreen, Slidev | `state.timers[] {id, label, endsAt, running}`(지금의 `timer`는 첫 번째 타이머로 호환). 모둠·정거장(station)별 타이머, 화면 분할 표시, 소리는 기본 꺼짐 | ◎ | S |
| **모둠 나누기** | Classroomscreen 모둠 만들기, Kahoot 팀 모드 | 새 모듈 `teams`. 무작위 또는 균형 배정(소속 학교·학년 섞기 선택). `state.teams {id, name, members[]}`. 모둠별 보드 링크와 타이머 | ◎(이름 목록) | M |
| **순위표·시상대** | Kahoot, ClassQuiz, Mentimeter 퀴즈 | `quiz`에 **라이브 모드** 추가: `state.quiz {index, phase: lobby\|question\|reveal\|leaderboard\|podium, startedAt}`, `answers {poll:quizId#i, by, value, ms}`. 점수 = 정답 × (1 + 남은 시간 비율). 상위 5명만 표시하고 **'순위 없이 연습' 옵션** 기본 제공(연수 분위기 고려) | 해당 없음 | L |
| **CSV 내보내기** | Slido·Mentimeter(대부분 유료) | 모든 컬렉션 지원(`exportCsv(kind)`). **UTF-8 BOM을 붙여 Excel에서 한글이 깨지지 않게** 하고, 날짜는 KST, 열 이름은 한국어 | 로컬은 `localStorage`의 데이터를 CSV로 | S |
| **슬라이드 연동 질문** | Claper, ClassPoint, BigBlueButton 빠른 투표 | `deck.slides[].interaction = {poll\|question\|signal}`. 강사가 그 쪽에 도착하면(`state.slide`) 자동으로 `openPoll`. **교재 해석 단계에서 'A/B/C/D', 'O/X', '①②③④' 보기를 감지해 투표 생성을 제안**(BigBlueButton 아이디어) | 해당 없음 | M |
| **브레인스토밍 → 투표** | AhaSlides, Padlet | `board` 게시물에 `likes`(이미 있음) → '투표 단계' 전환 시 1인당 표 수 제한(예: 3표) | | M |
| **나가기 전 확인(Exit ticket)** | Pear Deck Takeaways, 3-2-1 기법 | `survey` 프리셋(3-2-1, 한 줄 소감, 실천 다짐) + `reflection` 내려받기 | ◎(내려받기만) | S |
| **발언 대기열** | OpenSlides 발언자 목록 | `queue` 컬렉션 `{by, nickname, at, status}`. 화면에 '다음 발언자 3명' | | M |
| **별명 생성기와 아바타** | Kahoot | 형용사+사물 별명 제안(부적절 별명 방지) + DiceBear **CC0 스타일** 아바타를 브라우저에서 생성 | ◎ | S |

---

## 3. 오픈소스 프로젝트

| 프로젝트 | 라이선스 | 기술 | 배울 점 | 재사용 판단 |
|---|---|---|---|---|
| **Claper** | **AGPL-3.0** | Elixir/Phoenix 서버 | Slido·Mentimeter 대체. 발표 자료(PDF/PPT)를 올리면 **쪽마다 상호작용(질문, 투표, 폼, 웹 콘텐츠)을 연결**. 참여자·발표자·관리자 화면 분리, 검토 기능 | **아이디어만**. AGPL이라 코드를 생성 사이트에 넣지 않음. lecpage의 `deck` + `live` 구상과 가장 닮은 참고 모델 |
| **ClassQuiz** | MPL-2.0(여러 자료 일치) | Python FastAPI + SvelteKit, Redis | Kahoot 대체: 퀴즈 게임 상태 흐름, 순위표, 이미지 문제, Kahoot 가져오기 | 아이디어만(서버 필요). MPL은 파일 단위 카피레프트이므로 파일을 고치지 않고 쓰면 의무가 가벼움 |
| OpenSlides | MIT | 웹 + 서버 | 회의 운영: **발언자 목록**, 안건, 투표·선거, 프로젝터 제어 | 아이디어(발언 대기열, 프로젝터 화면 제어) |
| **Etherpad** | Apache-2.0 | Node 서버 | 실시간 공동 문서, **작성자별 색상** | 학교·교육청 인스턴스가 있으면 링크나 iframe. 우리가 호스팅하지 않음 |
| **Excalidraw** | MIT | React 컴포넌트, 협업 중계는 `excalidraw-room`(MIT) | E2E 협업 방(`#room=<id>,<key>`), 손그림 화이트보드 | 컴포넌트 번들은 무거워 런타임에 넣지 않음. **모둠별 화이트보드 '링크 생성'**(브라우저에서 무작위 방 ID와 키를 만듦)이 가능하지만, 공식 API가 아닌 URL 형식에 의존하므로 깨질 수 있다고 표시 |
| tldraw | 자체 라이선스(**프로덕션은 라이선스 키 필수**, 워터마크·사용 데이터 전송) | React SDK, 동기화는 Durable Objects | 방마다 WebSocket 서버(DO) 구조 | **사용 안 함**(외부 링크만) |
| **Reveal.js** | MIT | 바닐라 JS | 발표자 보기(메모, 다음 장, 타이머), 조각(fragments), PDF 내보내기, multiplex(따라 보기) | `deck` 모듈의 '발표 모드'를 **선택적으로 지연 로드**하거나 단축키·발표자 화면 배치만 차용 |
| **Slidev** | MIT | Vue + Vite | 발표자 모드, 그리기 주석, `/presenter` 경로, 원격 제어 | 빌드 체인이 무거워 재사용하지 않음. 발표자 UX만 참고 |
| **Marp** | MIT | Markdown → HTML/PDF/PPTX(marp-core) | 텍스트 기반 슬라이드 | 나중: '설계도 → Marp 마크다운' 내보내기, 또는 Marp 문서를 교재로 입력 |
| Jitsi Meet | Apache-2.0 | WebRTC 서버 | 화상 연수 | **링크만**. meet.jit.si 임베드는 5분 제한 보고가 있고, JaaS 무료는 월 25 MAU. 학교 표준 화상 도구(Zoom/Meet/Teams) 링크를 `meta.joinUrl`로 |
| **BigBlueButton** | LGPL-3.0 | 서버 | **슬라이드 내용으로 빠른 투표 만들기**, 공유 노트, 다중 사용자 화이트보드, 소회의실 | 아이디어(보기 감지 → 투표 제안) |
| LimeSurvey | GPL-2.0+ | PHP | 행렬형(리커트) 문항, 조건 분기 | 아이디어만(행렬 문항 → `survey`) |
| Formbricks | 본체 **AGPL-3.0**, `packages/js`·`surveys` 등은 MIT, `ee/`는 상용 | Next.js | 짧은 문항, 상황별 설문 | 사용 안 함(백엔드에 종속). 짧은 설문 UX만 참고 |

---

## 4. 생성 사이트용 라이브러리와 에셋

런타임 제약(아키텍처 계약): 클래식 스크립트로 `file://`에서도 동작해야 하고, 외부 호출은 jsDelivr 버전 고정 URL뿐이며, 첫 화면 JS·CSS는 200KB 안팎. 그래서 **ESM 전용 라이브러리는 런타임에 부적합**합니다(앱 쪽에서는 사용 가능).

| 라이브러리 | 라이선스 | 최신(npm, 2026-11) | 런타임 적합성 | 결정 |
|---|---|---|---|---|
| **qrcode-generator** | MIT | 2.0.4 | UMD, 작음 | **vendor에 넣음**(오프라인 QR, `screen.html`과 인쇄물) |
| uqr | MIT | 0.1.3 | ESM, SVG 출력 | 앱(빌더) 쪽 QR |
| qr-code-styling | MIT | 1.9.2 | 무거움 | 앱의 '홍보 포스터' 내보내기에서만 선택 사용 |
| **wordcloud2.js**(`wordcloud`) | MIT | 1.2.3 | 캔버스, 클래식 | 워드클라우드는 지연 로드. 한국어 글꼴 지정 |
| Chart.js | MIT | 4.6.1 | UMD 있음, 중간 크기 | 투표 막대는 **CSS·SVG로 직접 그림**(가벼움). Chart.js는 척도 분포 같은 복잡한 것만 지연 로드 |
| ECharts(+echarts-wordcloud) | Apache-2.0(+ISC) | 6.1.0 | 매우 큼 | 사용 안 함 |
| PhotoSwipe | MIT | 5.4.4 | v5는 ESM 전용 | 런타임은 `<dialog>` 기반 자체 라이트박스. 갤러리가 큰 경우에만 고려 |
| Swiper | MIT | 14.4.0 | 큼 | CSS `scroll-snap`으로 대체 |
| **SortableJS** | MIT | 1.15.7 | UMD | 순위 투표, 정렬 문제, 모둠 배정 끌어 놓기 |
| **canvas-confetti** | ISC | 1.9.4 | UMD | `celebrate` 효과 슬롯(`disableForReducedMotion`) |
| **Lucide** | ISC | 1.70.0 | SVG | **아이콘 표준 하나로 통일**. 빌드 때 쓰는 아이콘만 인라인 SVG로 묶음(아이콘 글꼴 금지) |
| Tabler Icons | MIT | 3.51.0 | SVG | Lucide에 없는 교육 아이콘 보충용 |
| Phosphor | MIT | 2.1.2(web) | SVG·폰트 | 굵기 6종이 필요할 때만 |
| DOMPurify | MPL-2.0 또는 Apache-2.0 | 3.4.17 | UMD | 앱의 제한된 마크다운 렌더에만 |
| fflate | MIT | 0.8.3 | 이미 vendor | 압축(앱, 런타임 내려받기) |

**에셋(일러스트·아바타)**

| 에셋 | 라이선스 | 결정 |
|---|---|---|
| **unDraw** | 자체 라이선스: 개별 사용은 상업적 용도까지 무료이고 출처 표기도 불필요. 그러나 **비슷한 서비스로 모으기, 묶음 배포, 앱에 넣기, AI 학습은 금지** | **lecpage에 넣지 않음**. 교사가 직접 받아 업로드하도록 링크만 안내 |
| **Open Peeps** | CC0 | 포함 가능(빈 화면, 오류 화면, 히어로 보조 그림) |
| **DiceBear** | 코드 MIT, 스타일은 작가별(**42개 스타일이 CC0**, 일부는 CC BY 등) | **CC0 스타일만** 목록에 넣고 브라우저에서 생성(외부 API 호출 없음) |

**생성 사이트 라이선스 원칙**
- MIT, ISC, BSD, Apache-2.0: 생성 사이트에 `assets/THIRD_PARTY.txt`를 자동으로 넣습니다(Apache는 NOTICE 포함).
- MPL-2.0: 파일을 수정하지 않고 사용합니다.
- AGPL/GPL: 코드를 가져오지 않습니다.
- CC BY: 출처 표기를 자동화할 수 없으면 쓰지 않습니다.
- 라이선스 키가 필요한 SDK는 쓰지 않습니다.

---

## 5. 우선순위: 모듈 카탈로그에 추가할 기능

계약 변경을 최소화합니다. 새 투표 유형은 `poll.kind`로, 참가자당 하나씩 덮어쓰는 값은 `progress`와 같은 방식의 컬렉션으로, 진행 제어는 `state`로 표현합니다.

### P0: 다음 릴리스(작고 효과가 큼)
| # | 기능 | 계약 변경 | 근거 |
|---|---|---|---|
| 1 | **입장 표준화**: 6자리 코드(헷갈리는 글자 제외) + 큰 QR(vendor) + 짧은 주소 + `screen.html` 대기 화면 | 없음(`live.code` 사용) | 모든 플랫폼의 공통 첫 경험 |
| 2 | **신호등** `signal` 모듈: 참가자 초록·노랑·빨강, 화면 비율 막대, 콘솔 경보, 로컬 모드에서는 강사용 활동 신호 | `signals` 컬렉션(by 기준 덮어쓰기), `features`에 `signal` 추가 | 한국 교실에서 익숙함. 구현 S |
| 3 | **Q&A 검토 모드와 정렬**: 사전·사후 검토, 인기순·최신순, 고정, 답변 완료 | `questions.status`에 `pending` 추가, `qa.moderation` | Slido의 핵심 |
| 4 | **워드클라우드 렌더링**과 한국어 정규화, 금칙어, 단어 숨김 | 없음(`poll.kind=word`) | Mentimeter의 대표 기능 |
| 5 | **뽑기** `picker` 모듈(참가자·목록·모둠, 중복 없음, 동작 줄이기 대응) | `state.picker` | 서버 없이도 동작 |
| 6 | **여러 타이머**(모둠·정거장별) | `state.timers[]`(기존 `timer`와 호환) | `stations`형 실습 연수 |
| 7 | **CSV 내보내기 전면 지원**(UTF-8 BOM, KST, 한국어 열 이름) | 없음(`exportCsv` 종류 확장) | 연수 이수 처리, 상용 서비스는 유료 |

### P1: 그다음
| # | 기능 | 계약 변경 | 근거 |
|---|---|---|---|
| 8 | **가치수직선**(1차·2차 비교 포함) | `poll.kind=line`, `answers.value` 0~100 + `reason` | 토의·토론 연수의 핵심 활동 |
| 9 | **라이브 퀴즈 + 순위표**(순위 없는 연습 모드가 기본) | `state.quiz`, `answers.ms` | Kahoot·ClassQuiz |
| 10 | **모둠 나누기** `teams` 모듈(무작위·균형, 모둠 보드·타이머 연결) | `state.teams` | 실습형 연수 |
| 11 | 투표 유형 추가: **순위**(`rank`), **100점 배분**(`points`), 이름표 있는 리커트 척도 | `poll.kind` 확장 | Mentimeter |
| 12 | **슬라이드 연동 상호작용**과 '보기 감지 → 투표 제안' | `deck.slides[].interaction` | Claper, ClassPoint, BigBlueButton |
| 13 | **발표자 콘솔 강화**(다음 항목, 메모, 참여 현황, 신호등 집계) + 같은 기기 두 창 동기화 | 없음 | Mentimeter, Slidev, Reveal.js |
| 14 | **나가기 전 확인**(3-2-1, 실천 다짐) 프리셋 | `survey` 프리셋 | Pear Deck Takeaways |

### P2: 나중
| # | 기능 | 비고 |
|---|---|---|
| 15 | 모둠별 화이트보드 링크(Excalidraw 방 링크 생성 또는 교사가 넣은 Padlet·띵커벨 보드 링크) | 외부 서비스에 의존한다는 경고 |
| 16 | 갤러리 워크(모둠 결과물 순회, 스티커 반응) | `board` 확장 |
| 17 | 발언 대기열 | `queue` 컬렉션 |
| 18 | 별명 생성기와 DiceBear CC0 아바타 | 익명성과 재미 |
| 19 | **이수 확인 요약**(입실·진행·설문 → `meta.admin.completionRate` 기준 판정 CSV) | 개인정보 최소화, 보존기간 안내 |
| 20 | 발표 모드(Reveal.js 지연 로드)와 Marp 내보내기 | |
| 21 | 시작 감정 체크인(날씨·이모지) | `reactions` 응용 |
| 22 | 서버가 없을 때의 **종이·Forms 대체 경로**(인쇄용 QR 안내문, Google Forms 대체 링크 자동 삽입) | 학교망 장애 대비 |

---

## 출처
- Mentimeter 무료 계정(월 50명): https://help.mentimeter.com/en/articles/1258367-what-is-included-in-the-free-account
- Slido 무료 참가자·투표 한도(커뮤니티): https://community.slido.com/community-q-a-7/how-many-participants-for-a-free-plan-user-7842 , https://www.productcompass.pm/p/slido-free-plan
- AhaSlides 무료 계정: https://docs.ahaslides.com/price-plans/what-is-included-in-the-free-account
- ClassPoint 요금(25명, 5문항, 제3자 자료): https://www.capterra.com/p/209840/ClassPoint/pricing/
- Wooclap 참가자 한도: https://docs.wooclap.com/en/articles/4839307-how-many-participants-can-join-my-wooclap-real-time-event , 요금: https://docs.wooclap.com/en/articles/14402104-what-is-wooclap-s-pricing
- Kahoot 무료 인원(제3자 자료, 불일치): https://www.triviaanywhere.com/blog/kahoot-free-player-limit
- Padlet 무료 3개(제3자 자료): https://toolradar.com/tools/padlet/pricing
- Nearpod 무료(제3자 자료): https://www.saasworthy.com/product/nearpod/pricing
- Classroomscreen 위젯(시작 안내서): https://dp.classroomscreen.com/96138/1742464649-the-ultimate-getting-started-guide_final.pdf , https://freetech4teach.teachermade.com/?p=2827
- 띵커벨: https://www.tkbell.co.kr (이 조사 환경에서는 403 응답이라 직접 확인 못함)
- Claper 라이선스(AGPL-3.0): https://github.com/ClaperCo/Claper/blob/main/LICENSE.txt
- ClassQuiz(MPL-2.0): https://github.com/mawoka-myblock/ClassQuiz , https://alternativeto.net/software/classquiz/about/
- OpenSlides(MIT): https://github.com/OpenSlides/OpenSlides
- Etherpad(Apache-2.0): https://github.com/ether/etherpad-lite
- Excalidraw(MIT), excalidraw-room(MIT): https://github.com/excalidraw/excalidraw , https://github.com/excalidraw/excalidraw-room , E2E: https://plus.excalidraw.com/blog/end-to-end-encryption
- tldraw 라이선스: https://github.com/tldraw/tldraw/blob/main/LICENSE.md , 동기화: https://tldraw.dev/docs/sync
- Reveal.js(MIT): https://github.com/hakimel/reveal.js , Slidev(MIT): https://github.com/slidevjs/slidev , Marp core(MIT): https://github.com/marp-team/marp-core
- Jitsi Meet(Apache-2.0): https://github.com/jitsi/jitsi-meet , JaaS(무료 25 MAU): https://jitsi.org/jaas/ , https://developer.8x8.com/jaas/docs/faq
- BigBlueButton(LGPL-3.0): https://github.com/bigbluebutton/bigbluebutton
- LimeSurvey(GPL-2.0+): https://github.com/LimeSurvey/LimeSurvey , Formbricks(AGPL + MIT 패키지): https://github.com/formbricks/formbricks/blob/main/LICENSE
- npm 레지스트리(버전·라이선스, 2026-11-09 조회): https://registry.npmjs.org/ (`qrcode-generator`, `uqr`, `qr-code-styling`, `wordcloud`, `chart.js`, `echarts`, `photoswipe`, `swiper`, `sortablejs`, `canvas-confetti`, `lucide`, `@tabler/icons`, `@phosphor-icons/web`, `dompurify`, `fflate`)
- Lucide(ISC): https://github.com/lucide-icons/lucide , Tabler(MIT): https://github.com/tabler/tabler-icons , Phosphor(MIT): https://github.com/phosphor-icons/core
- unDraw 라이선스: https://undraw.co/license , Open Peeps(CC0): https://www.openpeeps.com/ , DiceBear 라이선스: https://www.dicebear.com/licenses/
