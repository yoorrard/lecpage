# 강의 기능 키트

사이트는 자유롭게 디자인해요. 강의 기능은 자리 표시만 넣으면 lecpage가 조립 때 실제 기능으로 채우고, 강사 화면·발표 화면·QR 안내문도 만들어요.

## 자리 표시
| 표시 | 하는 일 |
|---|---|
| `<div data-lp="qa"></div>` | 질문 받기(이름 없이, 공감순) |
| `<div data-lp="poll" data-question="…" data-options='["…","…"]'></div>` | 투표(보기 2~6개, 강사가 열고 닫음). `data-kind="word"`·`"scale"`, 교재 쪽 `data-page="7"`, 퀴즈 정답 `data-answer="2"`(보기 번호·글, 공개 때만 보냄) |
| `<div data-lp="board" data-prompt="…"></div>` | 보드(글·사진) |
| `<div data-lp="attend"></div>` | 출석(입실·퇴실) |
| `<div data-lp="survey"></div>` | 만족도 설문. `data-questions='[{"q":"…","kind":"scale"}]'`(scale·choice·text) |
| `<div data-lp="deck" data-pages="1-12"></div>` | 교재 슬라이드(강사 따라 넘기기) |
| `<div data-lp="materials"></div>` | 자료실. `data-items='[{"title":"…","href":"files/…"}]'` |
| `<div data-lp="join"></div>` | 접속 QR·주소·연수 코드 |
| `<div data-lp="share"></div>` | QR 공유 단추 |
| `<div data-lp="notebook"></div>` | 모음: 복사한 프롬프트·메모를 이 기기에 모아 .txt로(스크립트는 `LecPage.notebook.add(글, 제목)`) |
| `<section data-lp-step="s1" data-title="1단계: …" data-minutes="30">` | 실습 단계([완료 체크]·[도움 요청]). `data-minutes`: 교재의 실습 시간(타이머 단추) |

- 참여 막대(출석·도움 요청·질문·반응)와 '지금' 줄(공지·타이머·투표)은 저절로 붙어요. 자리를 정하려면 `data-lp="dock"`·`"now"`.
- 강사가 준 자료(활동지·참고 파일)는 `work/site/files/`에 이름 그대로 넣어요(PDF·한글·워드·PPT·엑셀·ZIP 등, 파일 하나 20MB·사이트 40MB까지). 어디에도 걸지 않은 파일은 조립이 자료실 목록에 넣고, 자료실 자리 표시가 없으면 첫 쪽 끝에 자료 칸을 붙여 참가자가 받게 해요. 원하는 자리에 두려면 `<div data-lp="materials"></div>`만 넣으면 돼요.
- 자리 표시 안에는 글을 쓰지 않아요(조립 때 지워짐). JSON 속성은 작은따옴표로.
- [완료 체크]·[도움 요청](`.lpk-step-f`)은 단계 요소 안쪽 끝에 붙어요. 폭은 `data-lp-step`을 내용 상자에 달거나 `.lpk-step-f` 여백으로.
- 실습 진행 표시(선택): 단계 주소 `#st-s1`, 링크 `<a href="#st-s1" data-st-link="s1">`(끝냄 `.is-done`, 지금 `aria-current="step"`), 끝낸 수 `<b data-st-count></b>`, 막대 `<progress data-st-progress></progress>`. 지금 단계는 `.lp-st.is-active`.
- 교재 슬라이드 그림 칸은 쪽 그림 비율(정하려면 `:root{--lp-deck-ratio:210/297}`). 특정 쪽 링크는 `#deck-p7`.
- 조립이 만드는 것도 링크해요: `assets/event.ics`(달력), `screen.html`(발표 화면: 교재 쪽을 크게, 강사 화면과 같이 넘김 — 따로 만들지 않아요), `check.html`(접속 확인).
- 복사 단추는 스크립트 없이 `<button type="button" data-copy-text="프롬프트 원문">복사</button>`(모음에도 담겨요).

## 색·글꼴
키트는 `.lpk` 안에서만 꾸미고 이 변수를 따라요(`#RRGGBB`).
```css
:root{ --lp-accent:#b4441c; --lp-ink:#1f1a17; --lp-paper:#fbf6ee; --lp-font:'Noto Sans KR',sans-serif; --lp-radius:6px }
```
글자와 바탕은 4.5:1 이상. 주 단추 글자색은 키트가 강조색 밝기로 골라요(정하려면 `--lp-on-accent`). 고쳐 쓰려면 `.lpk .lp-btn-primary{…}`.

## 지킬 것(CSP)
- 스크립트는 `assets/site.js`에, `onclick` 대신 `addEventListener`. 바깥 스크립트는 허용 목록(gsap·lenis·ogl)만, 바깥 CSS는 글꼴만.
- 그림은 `assets/img/`(png·jpg·webp, SVG 파일 아님)·교재 쪽 그림 `material/p-001.webp`만(바깥 주소는 막혀요).
- 틀(`iframe`)은 유튜브(`youtube-nocookie.com/embed/…`)·비메오만(구글 설문 등은 링크로).
- 비밀번호 칸·로그인 화면 흉내·바깥으로 보내는 `<form action>`·글자 가림(`-webkit-text-security`)·서비스 워커는 쓰지 않아요(바로 배포가 거절해요). 참가자 이름이 필요하면 출석 키트로.
- 강사 화면·발표 화면·QR 안내문·접속 확인·개인정보 안내(`console`·`screen`·`poster`·`check`·`privacy.html`)는 lecpage가 만들어요(같은 이름 금지). 사이트에 스크립트가 있으면 강사 화면은 관리자 키를 그 탭에만 둬요.
- 쪽마다 `<!doctype html>`, `lang="ko"`, `<title>`, viewport, `<h1>` 하나, 섹션마다 제목.

## lecpage.json
```json
{"v":2,"title":"…","sessions":[{"date":"2026-12-03","start":"14:00","end":"17:00"}],"venue":"…",
 "mode":"offline","audience":"teachers","instructors":[{"name":"…","org":"…"}],
 "features":["qa","poll","attendance","help","reactions"],"theme":{"accent":"#…","ink":"#…","paper":"#…"},
 "facts":[{"label":"장소","value":"…","page":1}]}
```
교재에 없는 값은 비워요. `facts`(선택)에 찾은 쪽을 적으면 앱의 연수 정보 확인에 'N쪽에서 찾았어요'로 보여요. 공개 범위·주소·참여 서버는 강사가 정해요.
- 키트는 이수 조건(무엇을 눌러야·설문을 내야 이수인지)·출석 비율을 지어 쓰지 않아요. 교재에 있으면 사이트 글로 직접 쓰고, 출석 비율은 `admin.completionRate`(교재·강사 값)에만. 없으면 강사 화면 이수자 명단의 '이수' 칸은 비어요.
- `features`: qa·poll·board·attendance·survey·help·reactions·signal·progress·deck·materials·timer. `mode`: offline·online·blended. `audience`: teachers·students·parents·staff·other
- 선택 칸: `subtitle`·`organizer`·`contact`·`description`, 직무연수면 `admin: {"kind":"official","hours":3,"completionRate":90}`(kind: school·official·conference·student, 교재·강사가 준 값만), `theme.font`(본문)·`theme.fontHeading`(제목: 강사·발표 화면·QR 안내문 제목에도)·`theme.radius`
- `pages`: 교재 슬라이드 캡션·강사 화면 쪽 목록의 쪽 제목. 코드가 뽑은 제목이 비었거나 엉킨 쪽(`check`가 '제목 없는 쪽'으로 알려 줌)은 쪽 그림을 보고 `[{"page":1,"title":"표지 · …"}]`로 고쳐요(쓴 쪽만 바뀜).

## 검수·배포 전 확인(알리기만 해요)
AI가 교재 원본을 직접 읽고 사실은 원문 그대로 옮겨요. 코드는 교재 글·문구와 맞춰 보지 않아요. `check`(앱은 만들기·수정의 '꼭 고칠 곳' 한 줄)는 배포에서 막히는 것과 화면이 깨지는 것(넘침·겹침·잘림·안 보이는 글·깨진 그림·스크립트 오류)을 알려 줄 뿐 사이트를 고치지 않아요. 예시 주소·지난 날짜·설문 없는 이수 조건·연습 모드·사진은 강사용 `운영안내.md` 맨 위 '배포 전 확인'에 적혀요.
- 함수(앱·AI): `E.kit.inspect(files, meta)`.
- 배포할 곳: `assemble(…, { host, hostDays, keepAlive })`(host: lecpage·cloudflare·vercel·github-pages·netlify·onpod·lan·zip …). 개인정보 안내의 처리자·보관 기간·사이트를 보내 주는 곳이 그 방식에 맞게 바뀌어요. Skill은 `check --host`·`publish`가 넘겨요.
- 배포에는 교재 슬라이드·`<img>`·링크·CSS가 쓰는 교재 쪽 그림만 담겨요(미리보기는 다). 사이트 CSP는 실제로 부르는 바깥 곳(허용 목록 라이브러리·글꼴 CDN·영상 틀)만 열어요.
