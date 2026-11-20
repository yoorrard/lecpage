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

## 색·글꼴
키트는 `.lpk` 안에서만 꾸미고 이 변수를 따라요(`#RRGGBB`).
```css
:root{ --lp-accent:#b4441c; --lp-ink:#1f1a17; --lp-paper:#fbf6ee; --lp-font:'Noto Sans KR',sans-serif; --lp-radius:6px }
```
글자와 바탕은 4.5:1 이상. 키트를 고쳐 쓰려면 `.lpk .lp-btn-primary{…}`처럼.

## 지킬 것(CSP)
- 스크립트는 `assets/site.js`에, `onclick` 대신 `addEventListener`. 바깥 스크립트는 허용 목록(gsap·lenis·ogl)만, 바깥 CSS는 글꼴만.
- 그림은 `assets/img/`(png·jpg·webp, SVG 파일 아님)와 교재 쪽 그림 `material/p-001.webp`. 바깥 그림 주소는 막혀요.
- 영상 틀은 유튜브·비메오만. 비밀번호 칸·`<form action>` 보내기는 쓰지 않아요.
- 쪽마다 `<!doctype html>`, `lang="ko"`, `<title>`, viewport, `<h1>` 하나, 섹션마다 제목.

## lecpage.json
```json
{"v":2,"title":"…","sessions":[{"date":"2026-12-03","start":"14:00","end":"17:00"}],"venue":"…",
 "mode":"offline","audience":"teachers","instructors":[{"name":"…","org":"…"}],
 "features":["qa","poll","attendance","help","reactions"],"theme":{"accent":"#…","ink":"#…","paper":"#…"},
 "facts":[{"label":"장소","value":"…","page":1}]}
```
교재에 없는 값은 비우고, `facts`에 찾은 쪽을 적어요. 공개 범위·주소·참여 서버는 강사가 정해요.
