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
  material/p-001.webp …  lecpage가 만든 교재 쪽 그림(AI가 <img>로 씀). 교재가 여러 개면 번호를 이어 매김(첫 교재 1~12, 둘째 13부터)
  files/*           자료실 파일(강사가 올린 PDF 등, 선택)
lecpage.json        연수 정보·참여 기능 설정(아래)
```
- 쪽(.html)은 맨 위 폴더에만. `console·screen·poster·check·privacy.html`과 엔진 파일 이름(`assets/lecpage.js`·`kit.css`·`theme.css` …)은 lecpage가 만드는 이름이라 AI 파일은 뺌. SVG 파일·숨김 파일·`..` 경로도 받지 않음(`kit/paths.js` `siteFileOk`).

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
- `facts`는 AI가 교재 몇 쪽에서 찾았는지(검수·확인 화면에 씀). 꼴이 틀린 항목은 빼고 알림.
- **강사 값**: `live`·`siteUrl`·`joinUrl`·`shortUrl`·`access`에 더해 `surveyUrl`(기관 설문)·`privacy`(받을 정보·보관 기간)·`keepUntil`도. AI 답·남이 준 파일에 있어도 버리고 이전 값(`prev`)을 지킴(엔진 `keepTeacherLinks`와 같은 규칙, `kit/meta.js` `keepTeacherValues`). Skill은 강사 값을 `work/lecpage.teacher.json`에 따로 둠.
- `live` 꼴은 v1과 같음: `{ provider:'local'|'http'|'supabase'|'sheets', url, code, anonKey, anonymous?, pollMs?, uploads? }`. 없으면 기능이 켜져 있을 때 `local`(이 기기 안 연습, v1과 같음).
- 날짜 `YYYY-MM-DD`(달력에 있는 날)·시각 `HH:MM`. `2026.12.3`·`9:00`은 고쳐 받고, 틀리면 그 칸만 비우고 알림. `mode`는 `hybrid`도 `blended`로 받음.
- 선택 칸(AI): `organizer`·`contact`·`description`·`admin{kind,hours,completionRate}`(직무연수 이수 기준)·`theme.radius`·`theme.fontHeading`(제목 글꼴: 보조 쪽 제목에도)·`pages:[{page,title}]`(쪽 제목 고치기: 교재에서 뽑은 제목 위에 덮어 교재 넘기기 캡션·강사 화면 쪽 목록에 씀, 쓴 쪽만·빈 글이면 제목 없음). `features`에는 `signal`·`progress`도 쓸 수 있음.
- `theme`은 AI가 고른 색·글꼴. 강사 화면·발표 화면·QR 안내문이 이 색을 이어받음(밝은·어두운 바탕에 맞는 기본 틀 + 강조색·바탕·글자색·본문·제목 글꼴, 장식색도 이 셋을 섞은 색만, 밝게·어둡게 단추의 반대쪽은 바탕과 글자를 맞바꿈). `theme`이 비면 사이트 CSS의 `--lp-*`(`--lp-font-heading` 포함) 값을 씀.

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
<div data-lp="share"></div>                       QR 공유 단추(대화상자)
<section data-lp-step="s1" data-title="1단계: …"> 실습 단계(진행 현황·도움 요청이 이 단계를 셈)
```
- 속성(조립 뒤에는 빠짐): 투표 `data-kind="choice|word|scale"`·`data-id`(강사 화면 아이디, 없으면 p1·p2…), 보드 `data-categories='["…"]'`·`data-files="0~8"`·`data-moderation`, 설문 `data-questions='[{"q","kind":"scale|choice|text","options"}]'`(없으면 기본 문항), 교재 `data-pages`(없으면 있는 쪽 전부), 자료실 `data-items='[{"title","href","desc"}]'`(+ 앱이 넘기는 `materials`).
- 자리 표시 요소는 그대로 두고(class·id·배치는 AI 것) 안을 채움: `class="lpk lpk-w lpk-<종류>"`, 아이디가 없으면 `id="lpk-<종류>"`. 안에 쓴 글은 지움(자료실만 남김). 실습 단계에는 `class="lp-st" data-st` + `#st-<아이디>` 앵커 + 끝에 [완료 체크]·[도움 요청].
- 투표 자리는 여럿 둘 수 있음(열린 투표는 그 문항이 적힌 자리에, 즉석 투표는 첫 자리). 보드·교재 넘기기는 실시간으로 첫 자리 하나만.
- 참여 막대(도크: 출석·질문·도움 요청·반응)와 '지금' 띠(공지·타이머·투표 알림)는 `features`에 있으면 조립이 자동으로 붙임. AI가 `<div data-lp="dock">`·`<div data-lp="now">`로 자리를 정할 수도 있음. 저절로 붙은 '지금' 띠는 화면 아래(도크 바로 위)에 떠서 사이트 머리를 가리지 않음.
- 키트 모양은 사이트 CSS 변수 `--lp-accent --lp-ink --lp-paper --lp-font --lp-radius`를 따름(없으면 `theme` 값, 그것도 없으면 주변 글자색·글꼴). 강조색 위 글자는 강조색 밝기로 흰색·검정을 고름(상대 색 문법, `--lp-on-accent`로 정할 수 있음). 키트 CSS는 `.lpk` 아래에만 적용돼 AI의 CSS를 건드리지 않음.
- 실습 진행 표시(선택): `data-st-link`(단계 링크)·`data-st-count`(끝낸 수)·`data-st-progress`(막대, 최대는 단계 수)를 런타임이 채움.
- 런타임(`engine/runtime/lecpage.js`·`live/*`)은 지금 것을 그대로 씀. 조립이 자리 표시를 런타임이 아는 표시(`data-qa`·`data-poll-live`·`data-dock` …)로 펼침(위젯 HTML은 지금 `render/sections.js`의 위젯 부분을 떼어 `kit/widgets.js`로).
- 강사 화면·발표 화면은 자리 표시에서 투표·실습 단계·교재 쪽 목록을 모아 만듦(지금의 `lp-blueprint` 자리).
- 키트 설명서: `skills/lecpage/references/kit.md`(AI에게 주는 짧은 문서, 앱 프롬프트에도 같은 글).

## 5. 조립·검수 (약속 C, 엔진)
```js
assemble(site, meta, { runtime, preview, target, prev, today, material, materials }) → { files, warnings, errors, meta, collected, blueprint, csp, report }
  // site: { 'index.html': '…', 'assets/style.css': '…', … }
  // 하는 일: 인라인 <script> → assets/site.js, 자리 표시 펼치기, 키트 CSS·런타임 넣기, CSP·_headers, lp-data,
  //         강사·발표·안내문·접속 확인·개인정보 쪽, 일정 파일(.ics), favicon, robots, 쪽 그림 경로 확인, 강사 값 지키기
inspect(files, meta) → issues[]            // 정적 검사: HTML 구조·빈 칸·깨진 경로·키트 표시 오류·금지 패턴·크기·글자 대비(CSS 변수)
inspectRendered(page|window) → issues[]    // 그려서 검사(Playwright·브라우저 숨은 틀): 390·1280 가로 넘침·겹침·안 보이는 글·잘린 글·이미지 깨짐
// issue: { id, level:'error'|'warn', where:{ file, selector, section }, message_ko, fix_hint_ko }
previewHtml(files, page, { extraHead, extraBody }) → 한 장 HTML   // 앱 미리보기·숨은 틀(CSS·JS·그림을 안으로, CSP meta 뺌)
```
- 구현(`engine/src/kit/`, `E.kit.*`): `prev` = 강사 값, `material.pages` = 쪽 제목(교재 넘기기 검색), `materials` = 앱 자료실 목록. `collected` = 모은 투표·실습 단계·교재 쪽 등(앱 목록 화면용).
- 그려서 검사는 의존성 없는 함수 `inspectRendered({ doc, file })`(+ 글 `inspectRenderedSource`, 숨은 틀용 `inspectRenderedScript({ id })` → 부모에 `{type:'lp-inspect', id, width, issues}`), Playwright 도우미 `inspectPage(page, url, { widths:[390,1280], shots })`. `where.width`가 붙음.
- 보조 쪽·`#lp-data`·`#lp-blueprint`는 연수 정보와 모은 것으로 v1 설계도를 만들어 지금 엔진(`build`)으로 그림(보조 쪽 코드를 새로 쓰지 않음).
- CSP(AI 쪽): `script-src 'self'`+고정 라이브러리 · `style-src 'self' 'unsafe-inline'`+글꼴 CDN · `img-src 'self' data: blob:`+참여 서버(보드 사진) · `connect-src 'self'`+참여 서버 · `frame-src` youtube-nocookie·vimeo · `form-action 'none'` · `object-src`·`worker-src 'none'` · `base-uri 'none'`. `file:`은 USB·ZIP으로 열 때를 위해 엔진처럼 둠. `_headers`는 이 CSP를 AI 쪽 경로(`/`·`/index.html`·`/<쪽>`)에만 붙이고, 보조 쪽은 엔진 CSP(접속 확인은 바깥 도구를 재야 해서 `connect-src https:`)를 그대로.
- 인라인 `<script>`는 자리를 지켜 파일로(`assets/site.js`, 다음은 `site-2.js`…, 모듈은 `site-N.module.js`, 다른 쪽은 `assets/<쪽>.js`). `onclick` 등은 `assets/site-events.js`로 옮기고 알림(늦게 붙으니 addEventListener를 권함). 허용 목록 밖 바깥 스크립트·CSS, `<base>`·`<meta refresh>`·`<object>`, `javascript:` 주소는 뺌. `youtube.com/embed`는 `youtube-nocookie.com`으로.

### .lecpage v2 (저장 형식)
무압축 ZIP: `project.json { format:'lecpage-project', version:2, kind:'site', engine, title, meta, material:{pages}, sources, createdAt }` + `site/…` + `src/…`(원본). 참여 기능 키는 담지 않음. 열 때 파일 안의 강사 값은 `meta`에 넣지 않고 `teacherInFile`로 따로 줌(남이 준 파일일 수 있어 앱이 확인받고 씀). v1(설계도) 파일은 `kind:'v1'`+'예전 판' 안내, `upgradeV1`이 연수 정보·교재 쪽 그림(`material/p-NNN`)·원본·쪽 제목을 옮기고 예전 사이트는 지금 엔진으로 빌드해 `legacy`로 줌(사이트는 AI로 새로 만듦).
- 검수 결과는 사람(앱 화면)과 AI(고치기 요청에 그대로 붙임) 둘 다 읽는 꼴.
- 교재 사실 대조는 AI 검수 단계로(사이트 글 + `facts` + 교재 → 틀린 날짜·지어낸 내용 목록). 코드가 교재를 해석해 고치지는 않음.

## 6. 앱에서 AI가 만드는 과정 (키 연결)
나눠 만들고, 단계마다 저장해, 끊겨도 그 자리부터 이어 합니다.

1. **읽기·설계**(작은 답): 교재(원본 PDF를 그대로 + 쪽 그림 일부 + 보조 글자) → `{ facts, summary, audience, flow, designBrief, sections:[{id,purpose,outline,widgets}], features, theme }`
2. **디자인**: 설계 → `assets/style.css`(변수·바탕·글자·부품)
3. **섹션 만들기**: 섹션 2~3개씩 HTML. 앞 단계 CSS 클래스만 쓰도록.
4. **조립·검수**: `assemble` → 숨은 틀에서 `inspectRendered` → 문제가 있으면 그 섹션만 한 번 고치기.
5. **완성**: 미리보기·목록·연수 정보 확인 화면 열림.

안정성 장치(조사 근거: `docs/research/ai-first-2026-11.md` §1)
- **교재 건네기**: PDF는 원본을 그대로(세 회사 모두 받음: Claude base64 요청 128MB·600쪽, OpenAI Responses `input_file` 50MB, Gemini 50MB·1,000쪽). PPTX·DOCX는 Gemini 4에 원본 그대로(쪽 그림으로 읽음), 다른 회사엔 앱이 만든 쪽 그림(긴 변 1,600px webp)과 보조 글자. HWP/HWPX·그 밖은 쪽 그림을 못 그리면 보조 글자 + 교재 속 그림, 그리고 "PDF로 저장해 넣으면 더 정확해요" 한 줄.
- **회사별 받는 법**
  - OpenAI: **Responses API `background:true` + `stream:true` + `store:true`**. 끊기면 `starting_after=<sequence_number>`로 이어 받고, 다 받으면 DELETE로 지움(처리방침에 적음). Chat Completions에서 옮김.
  - Gemini: `streamGenerateContent`(SSE, 한 답 65,536 토큰) 기본. 무료 키 `store` 원칙 그대로(백그라운드는 `store:true`가 필요해 쓰지 않음).
  - Claude: `/v1/messages` 스트리밍(최대 128K). 백그라운드가 없으니 단계를 잘게 나누고, 잘리면 "받은 부분 + 이어서" 사용자 메시지로 이어 받음(Claude 4.6+는 미리 채우기 불가).
- 60~90초 동안 아무 글자도 안 오면 끊고 그 단계만 다시(OpenAI는 이어 받기).
- 작업 기록(약속 D)을 IndexedDB에 단계마다 저장: 새로 고침·탭 닫기·앱 새 판 뒤 "이어서 만들기"로 그 단계부터(OpenAI는 서버에서 계속 돌던 답을 이어 받음).
- 잘린 답: 마지막 완성 태그까지 살리고 같은 단계 안에서 이어 받기, 그래도 안 되면 그 단계만 다시.
- 한도·혼잡: 기다렸다 그 단계만 다시, 다른 모델로 바꿔도 앞 단계 결과는 유지.
- 앱 새 판 자동 새로 고침(`lib/fresh.jsx`)은 AI 작업 중에는 미룸.
- 모델: 매일 갱신되는 `ai-catalog.json`의 추천(지금 GPT-6.2 Sol·Astra, Claude Opus 5.5, Gemini 4 Argon/Hydrogen·무료 키는 그 날 추천).

### 약속 D: 작업 기록
```js
{ pid, id, provider, model, way:'key'|'chat'|'local'|'agent', startedAt, status:'running'|'paused'|'done'|'error',
  steps: [{ name:'plan'|'design'|'sections:1'|…|'fix', status, attempts, output, error }], site, meta }
```

## 7. 쓰던 AI 창(키 없이)
- 프롬프트 한 번: "첨부한 교재 파일을 직접 읽고 … `index.html` 한 파일로(키트 표시 사용) + 맨 끝에 lecpage.json"을 주고, 강사가 **교재 원본을 그 창에 첨부**(세 곳 모두 PDF를 직접 읽음. Claude.ai는 PPTX를 못 받고 PDF 그림은 100쪽까지 → PDF로 첨부하라고 안내).
- 한 답 최대 길이는 세 곳 모두 공식 숫자가 없음 → 잘림을 앱이 알아보고 "이어서" 문구로 이어 붙임. 답은 코드 블록 복사나 `.html` 파일 둘 다 받음(Gemini 캔버스는 HTML 내려받기가 없어 복사).
- 답 받기: HTML 붙여넣기 또는 내려받은 `.html` 끌어 넣기. 잘렸으면 "이어서" 문구를 주고 이어 붙임.
- 고칠 때도 같은 창: 고칠 섹션 HTML만 담은 요청 글 → 답의 섹션만 갈아 끼움.

## 8. 완성 뒤 편집 화면
- **미리보기**(실제 조립 결과, 참여 기능은 연습 모드) + **목록**(사이트의 `<section>`: 순서 바꾸기·숨기기·지우기·이름) + **글 고치기**(미리보기에서 글자를 눌러 바로) + **그림 바꾸기**(교재 쪽 그림·올린 사진) + **색·글꼴**(`--lp-*` 변수) + **수정 요청**(고를 섹션 또는 전체 → AI) + **검수**(문제 목록, [AI에게 고쳐 달라기]) + **연수 정보**(AI가 찾은 사실과 쪽 번호, 고치면 사이트 글도 함께).
- 되돌리기: 판 기록(AI가 만든 판·고친 판).

## 9. Skill(AI 에이전트) 흐름
```
lecpage prepare 교재.pdf 교재.pptx -o work   # 쪽 그림·보조 글자·work/README.md(할 일·키트·레퍼런스 안내)
(에이전트) 쪽 그림과 원본을 직접 읽고 설계 → work/site/ 를 직접 씀 + work/lecpage.json
lecpage check work                          # 조립(work/dist) + 검수 + 390·1280 화면 그림(work/check/<쪽>-390.png·-1280.png, issues.md·report.json), 고칠 곳이 있으면 종료 코드 1
lecpage preview work                        # 로컬 미리보기
lecpage publish work | lecpage app work     # 배포 또는 앱으로 넘기기(.lecpage)
```
- SKILL.md의 "HTML을 직접 쓰지 않는다" 원칙을 뒤집음: 에이전트가 설계자·제작자. lecpage 명령은 준비·조립·검수·배포만.

## 10. 로컬 Claude Code·Codex 연결 (이음오피스식)
조사 결론(`ai-first-2026-11.md` §3): **기술적으로 됨, 정책은 Claude 쪽이 회색지대** → 사용자가 켜는 선택 기능으로.
- 구조: 강사 PC에서 연결 프로그램 하나(`npx github:yoorrard/lecpage` 또는 Skill CLI `lecpage studio`)를 띄우면, 그 프로그램이 **앱 전체를 `http://127.0.0.1:<포트>/`에서 보여 주고**(lecpage.com의 같은 판을 그대로, 같은 출처라 Chrome 권한 창·Safari 차단이 없음) 기본 브라우저로 엶. 앱의 AI 고르기에 "내 PC의 Claude Code / Codex"가 생김.
- 일 맡기기: 연결 프로그램이 빈 임시 폴더에 교재·쪽 그림·키트 설명서·레퍼런스·작업 지시를 놓고 설치된 `claude -p --output-format stream-json`(또는 `codex exec --json`)을 실행 → 에이전트가 Skill 흐름(§9)으로 `site/`를 파일로 씀(답 길이에 안 잘림) → `check`로 검수·고침 → 앱이 결과를 받아 미리보기·편집·배포. 진행은 스트림으로 앱에 보여 줌.
- 안전: 127.0.0.1에만 묶기, 띄울 때마다 새 토큰, Origin·Host 정확히 확인, 임시 폴더 밖 파일 접근 막는 Claude Code 설정, `ANTHROPIC_API_KEY`가 있으면 그 키로 돈다는 안내, 폴더의 훅·`.mcp.json`이 없는 빈 폴더에서만.
- 연결 프로그램 HTTP 약속(같은 출처, 모든 요청에 머리글 `X-Lecpage-Bridge: <토큰>` — 토큰은 연결 프로그램이 앱 HTML에 `<meta name="lecpage-bridge" content="…">`로 넣어 줌):
  - `GET /bridge/status` → `{ ok, version, agents:[{ id:'claude'|'codex', installed, version, auth:'subscription'|'api-key'|'unknown' }] }`
  - `POST /bridge/jobs` `{ agent, kind:'make'|'edit', request, meta, reference, files:[{ name, type, base64 }], site? }` → `{ jobId }`
  - `GET /bridge/jobs/:id/events`(SSE): `{ type:'step'|'log'|'done'|'error', label_ko?, text?, error? }`
  - `GET /bridge/jobs/:id/result` → `{ site:{…}, meta, issues }` · `DELETE /bridge/jobs/:id`
- 정책 안내: Claude는 "고치지 않은 Claude Code에 자기 구독으로 로그인"은 허용, "제3자가 구독 한도를 자기 제품에 제공"은 승인 필요 → 기본 꺼짐, 켤 때 한 줄 안내, Anthropic에 문의(운영자 할 일). Codex는 로컬·오픈소스 앱 허용(Sign in with ChatGPT로 Codex 없이도 가능).

## 11. 레퍼런스
- 예시 사이트를 템플릿 렌더러 대신 **AI가 자유롭게 만든 완성도 높은 사이트**로 새로 만듦(서로 다른 주제·교재 디자인 2~6개). 대표 예시 '기록은 쌓였는데 시간이 없다면'은 상단 여백·배치·세련됨을 다시.
- 레퍼런스는 둘러보기 화면과 Skill `references/designs/`에. AI에게는 "참고하되 따르지 말 것"으로, 강사가 고르면 그 사이트의 분위기 설명만 붙임.

## 12. 호스팅(바로 배포)
- 지금: 엔진 런타임과 같은 JS만 받음 → AI가 쓴 `assets/site.js`도 받도록 바꿈(조립이 인라인 스크립트를 이 파일로 옮기므로 `script-src 'self'`로 충분).
- 안전 테두리: 서버가 정하는 CSP(`script-src 'self'`+고정 라이브러리, `connect-src 'self'`+그 사이트의 실시간 방 주소만, `form-action 'none'`, `frame-src` 유튜브(nocookie)·비메오만, `worker-src 'none'`, `object-src 'none'`), 사이트마다 다른 출처(`s-<id>.lecpage-view.pages.dev`), 비밀번호 칸·로그인 흉내 거절, 외부 스크립트 제거, 크기 한도, 신고·가리기·보관 기간 그대로. CSP로 막을 수 없는 것(주소 이동으로 빼내기)은 신고·가리기로 대응(처리방침·SECURITY.md에 적음).
- 받을 JS: `assets/site*.js`·`assets/<쪽>*.js`·`*.module.js`·`assets/*-events.js`(조립이 만든 이름). 보조 쪽(`check.html`)은 바깥 도구가 열리는지 재려고 `connect-src https:`가 필요하고, 보드 사진은 `img-src`에 참여 서버가 필요함.

## 13. 없애는 것
- 앱: 기본 초안·`FoundSummary`·내용 탭(설계도 칸 편집)·디자인 탭(프리셋)·설계도 기반 수정 요청·AI 없이 만들기 버튼.
- 엔진: 템플릿 생성(`ingest/detect·signals·compose·draft`, `decide/*`, `design/presets·layouts·tokens·seeds`, `render/hero*·body*·sections`의 섹션 렌더러, `prompt/bridge`, `guard`, `patch`)은 새 흐름이 검증된 뒤 지움. 교재 읽기(글자·그림·쪽 그림), 런타임, 보조 화면, 보안·글꼴·잠그기·내보내기, 배포 어댑터는 남김.

## 14. 순서
1. 약속 A~D 고정(이 문서) → 키트·조립·검수(엔진) + 레퍼런스 사이트 + 호스팅 + 로컬 연결 시험판을 동시에.
2. 앱 생성 파이프라인 + 앱 화면 흐름 + Skill을 동시에(약속에 맞춰).
3. 옛 템플릿 흐름 지우기.
4. 실제 AI로 전 과정 검증(Skill 길은 에이전트가 실제로, 키 길은 실제 키, 쓰던 AI 창 길, 로컬 연결, 먼저 해보기) + 그냥 AI 에이전트와 결과물 비교.

## 15. 앱 안의 약속 (생성 ↔ 화면)
작업자 둘(생성 파이프라인 `app/src/lib/gen/*` / 화면 흐름 `app/src/pages/*`·`components/*`)이 이 꼴로 맞물립니다.

프로젝트(IndexedDB `projects`)에 더하는 칸 — **생성 쪽만 씀**(작업 끝·쓰던 AI 창의 답). 화면은 직접 고친 것(글·목록·색·연수 정보·되돌리기)만 씀
```js
{ v: 2, site: { 'index.html': '…', 'assets/style.css': '…', … },   // AI가 만든 사이트(그림·자료실 파일은 blobs 'site/…', 교재 쪽 그림 'site/material/p-NNN.webp')
  meta: { …lecpage.json },                                          // 연수 정보·참여 기능
  gen: { jobId, status, way:'key'|'local'|'chat'|'demo', provider, model, agent, kind:'make'|'edit'|'fix', at },
  versions: [{ id, at, label, site, meta }],                        // 판 기록(최근 10판, 새것이 앞): 'AI가 만든 판'·'다시 만들기 전'·'AI가 고치기 전'·'검수 고치기 전'…
  inspect: { at, issues },                                          // 저장할 때의 검수 결과(화면이 처음에 보여 줌)
  notes: [ '…' ]                                                    // 만들며 알게 된 것(답에 연수 정보가 없음, 쪽 그림으로 보냄 등)
}
```
생성 API(`app/src/lib/gen/index.js`, 화면은 `lib/studio.js`로만 부름)
```js
startGeneration(pid, { way:'key'|'local'|'demo', provider, model, agent:'claude'|'codex', request, reference:{ id, name, mood } })  → jobId
resumeGeneration(pid, { provider, model }?)   // 멈춘 작업 이어 하기(새로 고침 뒤 useGeneration이 저절로도)
stopGeneration(pid)
useGeneration(pid) → { status:'idle'|'running'|'paused'|'done'|'error', jobId, kind, way, provider, model, agent,
                       step:{ name, label_ko, index(1부터), total, received }, steps[{ name, label_ko, status:'todo'|'running'|'done'|'error', attempts }],
                       startedAt, endedAt, error:{ title, body, actions:['resume'|'connect'|'paste'|'key'|'billing'|'link'], link? }, wait, notes, elsewhere }
chatPrompt(pid, { request, reference }) → string              // 쓰던 AI 창에 붙일 글(교재 원본을 첨부하라는 안내 포함)
acceptChatAnswer(pid, text|File, { target? }) → { ok, site, meta, problems:string[], issues, continuePrompt? }  // target: 수정 요청의 고칠 곳('all'|섹션 id). 잘리면 이어 붙임
editSite(pid, { target:'all'|sectionId, request, way:'key'|'local', provider, model, agent }) → jobId   // chatEditPrompt(pid, { target, request })로 쓰던 AI 창
runInspect(pid) → issues[]                                    // 조립 + inspect + 숨은 틀 inspectRendered(issue.key 붙음). 연수는 바꾸지 않음
fixIssues(pid, keys|ids, { way, provider, model, agent }) → jobId | ''   // 섹션이 정해지지 않은 문제뿐이면 '' → 화면이 수정 요청에 채움
bridgeStatus() → { agents[] } | null                           // 내 PC 연결 프로그램
assembleProject(p, { site, meta, target:'preview'|'zip'|'hosted', prev, extra, materials })  // 미리보기·검수·배포가 함께 쓰는 조립 한 곳
```
- 생성 쪽은 저장한 뒤 창에 `lecpage:gen-saved`({ pid, at })를 보냄 → 연수 화면(Project.jsx)은 기다리던 자동 저장을 마저 쓰고 다시 읽음(단계 화면은 새로 그리지 않음). 생성 쪽은 화면을 모름.
- 작업 중에는 목록·미리보기 창이 없음(진행 단계만). 만들기 단계 이름은 실제 파이프라인 그대로(교재 읽고 설계하기 → 디자인 정하기 → 섹션 만들기 n/N → 조립하고 검수하기 → (검수에서 찾은 곳 고치기)).
- 먼저 해보기는 같은 파이프라인을 `way:'demo'`로 돌림: 대표 레퍼런스(data-lab)의 교재 PDF를 실제로 읽고, AI 답 자리만 그 사이트에서 떼어 낸 글(`lib/gen/demo-answers.js`)로 채움(어디로도 보내지 않음).
