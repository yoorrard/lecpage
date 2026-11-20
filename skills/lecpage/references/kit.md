# 강의 기능 키트

사이트는 자유롭게 디자인해요. 강의 기능은 자리 표시만 넣으면 lecpage가 조립할 때 실제 기능으로 채우고, 강사 화면·발표 화면·QR 안내문도 만들어요.

## 자리 표시
| 표시 | 하는 일 |
|---|---|
| `<div data-lp="qa"></div>` | 질문 받기(이름 없이, 공감순) |
| `<div data-lp="poll" data-question="…" data-options='["…","…"]'></div>` | 투표(보기 2~6개, 강사가 열고 닫음). `data-kind="word"`·`"scale"`도 돼요 |
| `<div data-lp="board" data-prompt="…"></div>` | 보드(글·사진) |
| `<div data-lp="attend"></div>` | 출석(입실·퇴실) |
| `<div data-lp="survey"></div>` | 만족도 설문. `data-questions='[{"q":"…","kind":"scale"}]'`(scale·choice·text) |
| `<div data-lp="deck" data-pages="1-12"></div>` | 교재 넘기기(강사 따라 넘기기) |
| `<div data-lp="materials"></div>` | 자료실. `data-items='[{"title":"…","href":"files/…"}]'` |
| `<div data-lp="join"></div>` | 접속 QR·주소·연수 코드 |
| `<div data-lp="share"></div>` | QR 공유 단추 |
| `<section data-lp-step="s1" data-title="1단계: …">` | 실습 단계([완료 체크]·[도움 요청]이 붙고 진행 현황을 셈) |

- 참여 막대(출석·도움 요청·질문·반응)와 '지금' 줄(공지·타이머·투표)은 저절로 붙어요. 자리를 정하려면 `data-lp="dock"`·`data-lp="now"`.
- 자리 표시 안에는 글을 쓰지 않아요(조립 때 지워짐). JSON 속성은 작은따옴표로 감싸요.
- 실습 단계의 [완료 체크]·[도움 요청](`.lpk-step-f`)은 그 요소 안쪽 맨 끝에 붙어요. 본문 폭에 맞추려면 `data-lp-step`을 내용 상자에 달거나 `.lpk-step-f`에 여백을 줘요.
- 실습 진행을 사이트 모양으로 보이려면(선택): 단계 주소는 `#st-s1`, 단계 링크 `<a href="#st-s1" data-st-link="s1">`(끝낸 단계 `.is-done`, 지금 단계 `aria-current="step"`), 끝낸 수 `<b data-st-count></b>`("2 / 5"), 막대 `<progress data-st-progress></progress>`. 지금 보는 단계에는 `.lp-st.is-active`가 붙어요.
- 교재 넘기기의 그림 칸은 쪽 그림 비율을 따라요(A4 세로 자료집이면 세로로). 정하려면 `:root{--lp-deck-ratio:210/297}`. 특정 쪽으로 보내는 링크는 `#deck-p7`.
- 조립이 만드는 것도 링크할 수 있어요: `assets/event.ics`(달력에 넣기), `screen.html`(발표 화면), `check.html`(접속 확인).
- 복사 단추는 스크립트 없이: `<button type="button" data-copy-text="프롬프트 원문">복사</button>`(복사하고 알림을 띄워요).

## 색·글꼴
키트는 `.lpk` 안에서만 꾸미고 이 변수를 따라요(`#RRGGBB`).
```css
:root{ --lp-accent:#b4441c; --lp-ink:#1f1a17; --lp-paper:#fbf6ee; --lp-font:'Noto Sans KR',sans-serif; --lp-radius:6px }
```
글자와 바탕은 4.5:1 이상. 강조색 위 글자(주 단추)는 키트가 강조색 밝기로 흰색·검정을 골라요(어두운 모드에서 `--lp-accent`를 바꿔도). 정하려면 `--lp-on-accent`. 키트를 고쳐 쓰려면 `.lpk .lp-btn-primary{…}`처럼.

## 지킬 것(CSP)
- 스크립트는 `assets/site.js`에, `onclick` 대신 `addEventListener`. 바깥 스크립트는 허용 목록(gsap·lenis·ogl)만, 바깥 CSS는 글꼴만.
- 그림은 `assets/img/`(png·jpg·webp, SVG 파일 아님)와 교재 쪽 그림 `material/p-001.webp`. 바깥 그림 주소는 막혀요.
- 틀(`iframe`)은 유튜브(`youtube-nocookie.com/embed/…`)·비메오만. 구글 설문 등 다른 서비스는 틀 대신 링크로.
- 비밀번호 칸·로그인 화면 흉내·바깥으로 보내는 `<form action>`·글자 가림(`-webkit-text-security`)·서비스 워커는 쓰지 않아요(바로 배포가 거절해요). 참가자 이름이 필요하면 출석 키트로.
- 강사 화면·발표 화면·QR 안내문·접속 확인·개인정보 안내(`console`·`screen`·`poster`·`check`·`privacy.html`)는 lecpage가 만들어요. 그 쪽에 스크립트를 넣거나 같은 이름으로 쓰지 않아요.
- 쪽마다 `<!doctype html>`, `lang="ko"`, `<title>`, viewport, `<h1>` 하나, 섹션마다 제목.

## lecpage.json
```json
{"v":2,"title":"…","sessions":[{"date":"2026-12-03","start":"14:00","end":"17:00"}],"venue":"…",
 "mode":"offline","audience":"teachers","instructors":[{"name":"…","org":"…"}],
 "features":["qa","poll","attendance","help","reactions"],"theme":{"accent":"#…","ink":"#…","paper":"#…"},
 "facts":[{"label":"장소","value":"…","page":1}]}
```
교재에 없는 값은 비우고, `facts`에 찾은 쪽을 적어요. 공개 범위·주소·참여 서버는 강사가 정해요.
- `features`: qa·poll·board·attendance·survey·help·reactions·signal·progress·deck·materials·timer. `mode`: offline·online·blended. `audience`: teachers·students·parents·staff·other
- 선택 칸: `subtitle`·`organizer`·`contact`·`description`, 직무연수면 `admin: {"kind":"official","hours":3,"completionRate":90}`(kind: school·official·conference·student, 교재·강사가 준 값만), `theme.font`(본문)·`theme.fontHeading`(제목: 강사·발표 화면·QR 안내문 제목에도)·`theme.radius`
- `pages`: 교재 넘기기 캡션·강사 화면 쪽 목록의 쪽 제목. 교재에서 뽑은 제목(material.md 머리)이 엉키거나 비었으면 쪽 그림을 보고 `[{"page":1,"title":"표지 · …"}]`로 고쳐요(쓴 쪽만 바뀜).
