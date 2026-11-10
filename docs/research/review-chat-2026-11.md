# 미리보기 수정 요청(표시해서 AI에게) 조사 — 2026-11

강사가 완성된 미리보기에 펜·네모로 표시하고 [완료]를 누르면 그 화면이 대화 입력창에 바로 붙고, 글과 함께 AI에게 보내 설계도 패치로 고치는 기능을 만들며 살펴본 것.

## 제품 사례

| 제품 | 시작 | 표시 방법 | 보내는 것 | 되돌리기 |
|---|---|---|---|---|
| Lovable (Select elements) | 툴바 버튼·`S` | 요소를 눌러 고름(여럿은 Cmd/Ctrl) | 프롬프트 + 표시된 스크린샷, 'Take a screenshot'으로 미리보기를 붙이기도 함. 붙여넣기·끌어 놓기도 됨 | 버전 기록 |
| v0 Design Mode | 프롬프트 칸 버튼·`Option+D` | 마우스를 올려 강조, 눌러 고름 | 구조 변경은 고른 요소의 스크린샷을 붙인 프롬프트 | 적용하면 일반 버전이 되어 되돌릴 수 있음 |
| Vercel Toolbar 댓글 | `c` | 페이지에 핀, 끌어서 영역 캡처 | 댓글 + 자동 스크린샷 | — |
| Marker.io · BugHerd · Jam | 위젯 한 번 | 화살표·강조·글 상자(Marker), DOM 요소에 핀(BugHerd), 한 번에 캡처(Jam) | 표시한 스크린샷 + 브라우저 정보 | — |
| ChatGPT·Claude | 붙여넣기·끌어 놓기 | (밖에서 그림) | 그림 + 글 | — |

공통점: **시작은 한 번 누르기, 표시는 도구 3~4개, 끝내면 대화창에 바로 붙음, 적용은 한 번, 되돌리기 가능**. Lovable·v0처럼 "요소 고르기"와 "그려서 표시하기"를 둘 다 두되, 교사에게는 그리기가 더 쉬워 그쪽을 기본으로 했다. Bolt 문서는 이 환경에서 열리지 않아 확인하지 못했다.

출처: docs.lovable.dev/features/preview-toolbar, v0.app/docs/design-mode, vercel.com/docs/comments/using-comments, marker.io/blog/usersnap-vs-bugherd-vs-markerio, bugherd.com/annotation-tools

## 화면 담기 라이브러리(샌드박스 iframe 안, 앱 CSP 아래)

같은 견본 페이지를 Playwright 실제 화면과 픽셀 비교(1200×760, 맨 위·1400px 아래, 다른 색 > 60인 픽셀 비율).

| 라이브러리 | 버전·라이선스 | 크기(min/gzip) | 결과 |
|---|---|---|---|
| html2canvas | 1.4.1 · MIT | 199KB / 45KB | 2022년 뒤 멈춤, `color-mix()` 등 최신 CSS 못 그림 → 제외 |
| html-to-image | 1.11.13 · MIT | 21KB / 7KB | 3.4~3.9초, 글줄 바뀜·여백 틀어짐, CSP `base-uri` 오류 |
| @zumer/snapdom | 3.4.0 · MIT | 291KB / 99KB | 3초, `color-mix` 버튼 배경 빠짐, 거의 매일 새 판 |
| **modern-screenshot** | **4.7.0 · MIT** | **29KB / 11KB** | 그대로는 샌드박스에서 실패(기본 스타일용 iframe에 못 닿음). 아래 보완 후 **다른 픽셀 0.02%, 0.8초** |

modern-screenshot을 고르고 `annotate.js`에서 보완했다(라이브러리 파일은 손대지 않음).
- 기본 스타일 비교 상자를 iframe 대신 shadow DOM으로 넘김(`sandbox` 옵션).
- 글꼴은 `document.fonts`에서 이미 받은 것만 골라 넣음(Pretendard 동적 서브셋 92개를 다 받지 않음). CORS로 못 읽는 글꼴 CSS는 건너뛰고 대체 글꼴로.
- 지금 보이는 영역만: 루트에 `margin-top:-scrollY`, sticky는 붙은 자리로, 그리드 안 `margin:auto`는 Typed OM으로 되살림, 화면 밖 칸은 크기만 남김(lazy 그림 기다림 없음).

펜: **perfect-freehand 1.2.3(MIT, 4.5KB)** — 필압(펜)·속도 반영 획. Excalidraw는 무겁고 tldraw는 상용 키가 필요해 제외.

## 정한 것
- 미리보기 위 [✎ 표시해서 요청] 또는 대화창 [✎ 표시해서 넣기] → 펜·네모·화살표·글자, 색 3개, 되돌리기·지우기, 크게 [취소]·[완료]. Esc 취소, Enter 완료, 터치·펜 됨. 좁은 화면은 미리보기를 화면 가득.
- [칸 고르기]: 그리지 않고 칸 하나를 눌러 붙임(화살표 키·Enter로도).
- 그림은 긴 변 1568px 이하 PNG(Claude가 줄이지 않는 크기). 표시가 닿은 칸 id를 함께 보내 AI가 설계도에서 찾게 함.
- AI는 `patch.js` 형식으로만 답하고, 적용 전에 실시간 연결·공개 범위·사이트 주소·새 링크·참여 기능 칸을 걸러 냄. [적용]은 되돌리기 목록에 들어감.
- 키가 없으면 그림 복사 → 지시문 복사 → 챗봇 답 붙여넣기.
- skill: `review-server.mjs`가 같은 도구를 넣어 띄우고, 보낸 것은 `work/feedback/NNN.png`·`NNN.json`으로 저장.
