# AI 중심 개편 설계 (2026-11-20)

이 문서는 lecpage를 "코드가 교재를 해석해 템플릿에 끼우는 도구"에서 "AI가 교재를 직접 읽고 사이트를 설계·작성하고, lecpage는 그 제작을 받쳐 주는 작업대"로 바꾸는 설계입니다. 작업자들이 동시에 일할 수 있도록 서로 맞물리는 약속(키트 표시법, 조립·검수 함수, 저장 형식, 작업 기록 형식)을 먼저 정합니다. 외부 사실(브라우저 직접 호출, 파일 입력, 스트리밍, 로컬 에이전트 연결 정책)은 `docs/research/ai-first-2026-11.md`에 있습니다.

## 0. 왜 바꾸나 (지금 구조의 원인)
- **교재를 코드가 먼저 해석함**: `ingest/detect·signals·compose·draft`가 글자만 뽑아 추측(날짜·장소·구성)하고, 그 결과(초안 설계도)가 AI 입력과 검증 기준이 됨(`app/src/lib/blueprint.js` makeDraft·guardAnswer). AI는 교재 원본·그림을 보지 못하고, 잘못 뽑힌 초안에 맞춰야 함.
- **AI가 설계도(JSON)만 씀**: 화면은 프리셋 27종·섹션 렌더러가 그림 → 교재가 달라도 같은 모양이 반복되고, 교재 고유의 디자인을 살릴 길이 없음.
- **AI 전 목록·미리보기**: 교재를 넣자마자 `FoundSummary`·기본 초안 미리보기가 나와(Start.jsx·Edit.jsx), 틀린 추측을 먼저 보여 줌.
- **AI 작업이 쉽게 끊기고 사라짐**: Gemini·OpenAI는 스트리밍하지 않아 긴 대기 중 망이 끊으면 통째로 실패, 생각 토큰이 32k 한도를 먹으면 답 전체를 버림, 작업 상태가 메모리에만 있어 새로 고침·탭 잠자기·앱 새 판 자동 새로 고침에 사라짐, 재시도는 처음부터, 중간 오류 이벤트는 받은 글을 버림.

## 1. 역할 나누기
| AI가 하는 일 | lecpage가 하는 일 |
|---|---|
| 교재 원본·쪽 그림을 읽고 내용·흐름·디자인 의도를 이해 | 교재를 AI가 읽기 좋은 꼴로 건넴(원본 PDF 그대로, 쪽 그림, 보조 글자) |
| 강의 흐름·페이지 구성·필요한 기능 결정 | 강의 전용 기능 모음(키트): 질문·투표·보드·출석·설문·도움 요청·반응·타이머·공지·교재 넘기기·자료실·접속 QR |
| 디자인·HTML·CSS·JS 작성, 고치기 | 조립: 키트 끼우기·보안 정책(CSP)·응답 머리글·강사 화면·발표 화면·QR 안내문·접속 확인·개인정보 안내·일정 파일 |
| (선택) 레퍼런스에서 영감 | 레퍼런스: 완성도 높은 강의 사이트 사례(참고용, 따를 의무 없음) |
| 검수 결과를 보고 스스로 고침 | 검수: 깨진 곳·넘침·대비·빈 칸·키트 표시 오류·교재 사실 대조 → AI에게 돌려줌 |
| | 미리보기·편집(목록·글·이미지)·수정 요청 창구·배포 |

## 2. 전체 흐름 (앱·Skill 공통)
교재 넣기 → AI 고르기 → **AI가 만듦(진행 단계만 보임, 목록·미리보기 없음)** → 완성 → 미리보기 + 목록 + 연수 정보 확인 + 검수 결과 → 고치기(직접·AI에게) → 배포 → 연수 당일(강사·발표 화면) → 연수 후.

- AI가 만들기 전에는 목록·미리보기·디자인 고르기 창이 **아예 없다**. 교재를 넣은 화면에는 "읽은 교재(파일·쪽 수)"와 "AI 고르기"만.
- 연수 정보(제목·날짜·시간·장소·강사)는 AI가 교재에서 찾아 사이트와 함께 돌려주고, 완성 뒤 한 번 확인받음(QR 안내문·일정 파일·접속 확인에 씀).

## 3. 사이트 형식 (약속 A)
AI가 만드는 것은 **사이트 폴더**와 **연수 정보** 둘입니다.

```
site/
  index.html        AI가 씀(필수). 여러 쪽이면 다른 .html도 가능
  assets/style.css  AI가 씀(권장, 인라인 <style>도 허용)
  assets/site.js    AI가 씀(선택, 인라인 <script>는 조립 때 이 파일로 옮김)
  assets/img/*      AI가 쓴 그림(SVG 아님: png·jpg·webp)
  material/p-001.webp …  lecpage가 만든 교재 쪽 그림(AI가 <img>로 씀)
lecpage.json        연수 정보·참여 기능 설정(아래)
```

`lecpage.json` (AI가 채우는 칸 / 강사만 정하는 칸이 나뉨)
```json
{
  "v": 2,
  "title": "…", "subtitle": "…",
  "sessions": [{ "date": "2026-12-03", "start": "14:00", "end": "17:00" }],
  "venue": "…", "mode": "offline|online|blended", "audience": "teachers|students|parents|staff|other",
  "instructors": [{ "name": "…", "org": "…" }],
  "features": ["qa","poll","board","attendance","survey","help","reactions","deck","materials","timer"],
  "theme": { "accent": "#…", "ink": "#…", "paper": "#…", "font": "…" },
  "facts": [{ "label": "장소", "value": "…", "page": 3 }],
  "live": null, "siteUrl": "", "joinUrl": "", "access": "public"
}
```
- `facts`는 AI가 교재 몇 쪽에서 찾았는지(검수·확인 화면에 씀).
- `live`·`siteUrl`·`joinUrl`·`shortUrl`·`access`는 **강사 값**: AI 답에 있어도 버림(엔진 `keepTeacherLinks`와 같은 규칙).
- `theme`은 AI가 고른 색·글꼴. 강사 화면·발표 화면·QR 안내문이 이 색을 이어받음.

## 4. 강의 전용 기능 키트 (약속 B)
AI는 사이트 어디에나 **자리 표시**를 넣고, 조립이 그 자리를 실제 기능으로 채웁니다. 디자인은 사이트를 따릅니다.

```html
<div data-lp="qa"></div>                          질문 받기(공감순)
<div data-lp="poll" data-question="…" data-options='["…","…"]'></div>   투표(강사 화면에서 열고 닫음)
<div data-lp="board" data-prompt="…"></div>       보드(글·사진)
<div data-lp="attend"></div>                      출석(입실·퇴실)
<div data-lp="survey" data-questions='[…]'></div> 설문(별점·객관식·주관식)
<div data-lp="deck" data-pages="1-12"></div>      교재 넘기기(강사 따라 넘기기)
<div data-lp="materials"></div>                   자료실(강사가 올린 파일·링크)
<div data-lp="join"></div>                        접속 QR·코드
<section data-lp-step="s1" data-title="1단계: …"> 실습 단계(진행 현황·도움 요청이 이 단계를 셈)
```
- 참여 막대(도크: 출석·질문·도움 요청·반응)와 '지금' 띠(공지·타이머·투표 알림)는 `features`에 있으면 조립이 자동으로 붙임. AI가 `<div data-lp="dock">`로 자리를 정할 수도 있음.
- 키트 모양은 사이트 CSS 변수 `--lp-accent --lp-ink --lp-paper --lp-font --lp-radius`를 따름(없으면 `theme` 값, 그것도 없으면 주변 글자색·글꼴). 키트 CSS는 `.lpk` 아래에만 적용돼 AI의 CSS를 건드리지 않음.
- 런타임(`engine/runtime/lecpage.js`·`live/*`)은 지금 것을 그대로 씀. 조립이 자리 표시를 런타임이 아는 표시(`data-qa`·`data-poll-live`·`data-dock` …)로 펼침(위젯 HTML은 지금 `render/sections.js`의 위젯 부분을 떼어 `kit/widgets.js`로).
- 강사 화면·발표 화면은 자리 표시에서 투표·실습 단계·교재 쪽 목록을 모아 만듦(지금의 `lp-blueprint` 자리).
- 키트 설명서: `skills/lecpage/references/kit.md`(AI에게 주는 짧은 문서, 앱 프롬프트에도 같은 글).

## 5. 조립·검수 (약속 C, 엔진)
```js
assemble(site, meta, { runtime, preview, target }) → { files, warnings }
  // site: { 'index.html': '…', 'assets/style.css': '…', … }
  // 하는 일: 인라인 <script> → assets/site.js, 자리 표시 펼치기, 키트 CSS·런타임 넣기, CSP·_headers, lp-data,
  //         강사·발표·안내문·접속 확인·개인정보 쪽, 일정 파일(.ics), favicon, robots, 쪽 그림 경로 확인, 강사 값 지키기
inspect(files, meta) → issues[]            // 정적 검사: HTML 구조·빈 칸·깨진 경로·키트 표시 오류·금지 패턴·크기·글자 대비(CSS 변수)
inspectRendered(page|window) → issues[]    // 그려서 검사(Playwright·브라우저 숨은 틀): 390·1280 가로 넘침·겹침·안 보이는 글·잘린 글·이미지 깨짐
// issue: { id, level:'error'|'warn', where:{ file, selector, section }, message_ko, fix_hint_ko }
```
- 검수 결과는 사람(앱 화면)과 AI(고치기 요청에 그대로 붙임) 둘 다 읽는 꼴.
- 교재 사실 대조는 AI 검수 단계로(사이트 글 + `facts` + 교재 → 틀린 날짜·지어낸 내용 목록). 코드가 교재를 해석해 고치지는 않음.

## 6. 앱에서 AI가 만드는 과정 (키 연결)
나눠 만들고, 단계마다 저장해, 끊겨도 그 자리부터 이어 합니다.

1. **읽기·설계**(작은 답): 교재(원본 PDF를 그대로 + 쪽 그림 일부 + 보조 글자) → `{ facts, summary, audience, flow, designBrief, sections:[{id,purpose,outline,widgets}], features, theme }`
2. **디자인**: 설계 → `assets/style.css`(변수·바탕·글자·부품)
3. **섹션 만들기**: 섹션 2~3개씩 HTML. 앞 단계 CSS 클래스만 쓰도록.
4. **조립·검수**: `assemble` → 숨은 틀에서 `inspectRendered` → 문제가 있으면 그 섹션만 한 번 고치기.
5. **완성**: 미리보기·목록·연수 정보 확인 화면 열림.

안정성 장치
- 세 회사 모두 **스트리밍**으로 받음. 60~90초 동안 아무 글자도 안 오면 끊고 그 단계만 다시.
- 작업 기록(약속 D)을 IndexedDB에 단계마다 저장: 새로 고침·탭 닫기·앱 새 판 뒤 "이어서 만들기"로 그 단계부터.
- 잘린 답: 마지막 완성 태그까지 살리고 "이어서" 요청(같은 단계 안에서), 그래도 안 되면 그 단계만 다시.
- 한도·혼잡: 기다렸다 그 단계만 다시, 무료 모델로 바꿔도 앞 단계 결과는 유지.
- 앱 새 판 자동 새로 고침(`lib/fresh.jsx`)은 AI 작업 중에는 미룸.

### 약속 D: 작업 기록
```js
{ pid, id, provider, model, way:'key'|'chat'|'local'|'agent', startedAt, status:'running'|'paused'|'done'|'error',
  steps: [{ name:'plan'|'design'|'sections:1'|…|'fix', status, attempts, output, error }], site, meta }
```

## 7. 쓰던 AI 창(키 없이)
- 프롬프트 한 번: "첨부한 교재 파일을 직접 읽고 … `index.html` 한 파일로(키트 표시 사용) + 맨 끝에 lecpage.json"을 주고, 강사가 **교재 원본을 그 창에 첨부**(ChatGPT·Claude·Gemini 모두 PDF 등을 직접 읽음).
- 답 받기: HTML 붙여넣기 또는 내려받은 `.html` 끌어 넣기. 잘렸으면 "이어서" 문구를 주고 이어 붙임.
- 고칠 때도 같은 창: 고칠 섹션 HTML만 담은 요청 글 → 답의 섹션만 갈아 끼움.

## 8. 완성 뒤 편집 화면
- **미리보기**(실제 조립 결과, 참여 기능은 연습 모드) + **목록**(사이트의 `<section>`: 순서 바꾸기·숨기기·지우기·이름) + **글 고치기**(미리보기에서 글자를 눌러 바로) + **그림 바꾸기**(교재 쪽 그림·올린 사진) + **색·글꼴**(`--lp-*` 변수) + **수정 요청**(고를 섹션 또는 전체 → AI) + **검수**(문제 목록, [AI에게 고쳐 달라기]) + **연수 정보**(AI가 찾은 사실과 쪽 번호, 고치면 사이트 글도 함께).
- 되돌리기: 판 기록(AI가 만든 판·고친 판).

## 9. Skill(AI 에이전트) 흐름
```
lecpage prepare 교재.pdf 교재.pptx -o work   # 쪽 그림·보조 글자·work/README.md(할 일·키트·레퍼런스 안내)
(에이전트) 쪽 그림과 원본을 직접 읽고 설계 → work/site/ 를 직접 씀 + work/lecpage.json
lecpage check work                          # 조립 + 검수 + 390·1280 화면 그림(에이전트가 보고 고침)
lecpage preview work                        # 로컬 미리보기
lecpage publish work | lecpage app work     # 배포 또는 앱으로 넘기기(.lecpage)
```
- SKILL.md의 "HTML을 직접 쓰지 않는다" 원칙을 뒤집음: 에이전트가 설계자·제작자. lecpage 명령은 준비·조립·검수·배포만.

## 10. 로컬 Claude Code·Codex 연결 (이음오피스식)
조사(`docs/research/ai-first-2026-11.md` §3) 결과로 정함. 구조 후보: 강사 PC에서 `npx lecpage` 하나로 작은 연결 프로그램이 뜨고, 앱이 그 프로그램에 일을 맡기면 프로그램이 설치된 `claude`/`codex`를 실행(내 구독 한도) → 위 Skill 흐름으로 `work/site`를 만들어 앱으로 돌려줌.

## 11. 레퍼런스
- 예시 사이트를 템플릿 렌더러 대신 **AI가 자유롭게 만든 완성도 높은 사이트**로 새로 만듦(서로 다른 주제·교재 디자인 2~6개). 대표 예시 '기록은 쌓였는데 시간이 없다면'은 상단 여백·배치·세련됨을 다시.
- 레퍼런스는 둘러보기 화면과 Skill `references/designs/`에. AI에게는 "참고하되 따르지 말 것"으로, 강사가 고르면 그 사이트의 분위기 설명만 붙임.

## 12. 호스팅(바로 배포)
- 지금: 엔진 런타임과 같은 JS만 받음 → AI가 쓴 `assets/site.js`도 받도록 바꿈.
- 안전 테두리: 서버가 정하는 CSP(`script-src 'self'`, `connect-src 'self'`+그 사이트의 참여 서버, `form-action 'none'`, `frame-src 'none'`, `worker-src 'none'`, `object-src 'none'`), 사이트마다 다른 하위 도메인, 비밀번호 칸(`type=password`) 거절, 외부 스크립트 제거, 크기 한도, 신고·가리기·보관 기간 그대로.

## 13. 없애는 것
- 앱: 기본 초안·`FoundSummary`·내용 탭(설계도 칸 편집)·디자인 탭(프리셋)·설계도 기반 수정 요청·AI 없이 만들기 버튼.
- 엔진: 템플릿 생성(`ingest/detect·signals·compose·draft`, `decide/*`, `design/presets·layouts·tokens·seeds`, `render/hero*·body*·sections`의 섹션 렌더러, `prompt/bridge`, `guard`, `patch`)은 새 흐름이 검증된 뒤 지움. 교재 읽기(글자·그림·쪽 그림), 런타임, 보조 화면, 보안·글꼴·잠그기·내보내기, 배포 어댑터는 남김.

## 14. 순서
1. 약속 A~D 고정(이 문서) → 키트·조립·검수(엔진) + 레퍼런스 사이트 + 호스팅 + 로컬 연결 시험판을 동시에.
2. 앱 생성 파이프라인 + 앱 화면 흐름 + Skill을 동시에(약속에 맞춰).
3. 옛 템플릿 흐름 지우기.
4. 실제 AI로 전 과정 검증(Skill 길은 에이전트가 실제로, 키 길은 실제 키, 쓰던 AI 창 길, 로컬 연결, 먼저 해보기) + 그냥 AI 에이전트와 결과물 비교.
