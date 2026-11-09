# lecpage 아키텍처와 계약(Contracts)

이 문서는 lecpage를 만드는 모든 작업자(사람·AI)가 같은 약속을 지키도록 정한 기준입니다. 코드를 쓰기 전에 읽고, 약속을 바꿔야 하면 이 문서를 먼저 고칩니다.

## 0. 한 줄 요약

연수 교재와 연수 정보 → **연수 설계도(blueprint JSON)** → 엔진이 **정적 연수 사이트**(HTML·CSS·JS 파일 묶음)로 조립 → 어디든 배포(GitHub Pages, Cloudflare, Vercel, Netlify, S3, 개인 서버, USB). 실시간 기능은 **어댑터**로 붙입니다(브라우저만, Supabase, Google Sheets, Cloudflare/자체 서버 HTTP).

## 1. 저장소 구조

```
lecpage/
├─ skills/lecpage/            ← Agent Skill 패키지(자체 완결). `npx skills add yoorrard/lecpage`
│  ├─ SKILL.md
│  ├─ references/             ← skill이 필요할 때 읽는 문서(인터뷰, 모듈, 디자인, 운영, 배포…)
│  ├─ engine/                 ← 단일 소스 엔진. Node와 브라우저(앱) 모두에서 import
│  │  ├─ src/                 ← ESM. 의존성 없음(vendor/ 제외)
│  │  │  ├─ schema/           ← blueprint.schema.json, 상수
│  │  │  ├─ validate.js       ← 검증·자동 보정(normalize)
│  │  │  ├─ decide/           ← 유형·운영·디자인·효과 결정 규칙
│  │  │  ├─ design/           ← 프리셋, 토큰→CSS, 글꼴, fx-catalog.js
│  │  │  ├─ render/           ← 문자열 템플릿 렌더러(모듈별)
│  │  │  ├─ ingest/           ← PPTX·DOCX·HWPX·PDF 해석(브라우저+Node)
│  │  │  ├─ prompt/           ← AI 프롬프트 팩, JSON 추출, 제공자 호출
│  │  │  └─ build.js          ← blueprint → 파일 묶음
│  │  ├─ runtime/             ← 생성 사이트에 복사되는 클래식 스크립트(빌드 도구 없음)
│  │  │  ├─ lecpage.css · lecpage.js · console.js · screen.js
│  │  │  ├─ fx/               ← 효과 레지스트리(core.js, fx.css, effects/*.js)
│  │  │  └─ live/             ← 실시간 어댑터(core.js, local.js, http.js, supabase.js, sheets.js)
│  │  ├─ vendor/              ← 작은 MIT 라이브러리(예: fflate)
│  │  └─ test/                ← node:test
│  ├─ scripts/                ← CLI(lecpage.mjs), 파이썬 보조(ingest.py), render_slides.sh
│  ├─ backends/               ← supabase/, apps-script/, cloudflare/, node-server/
│  ├─ templates/deploy/       ← 호스팅별 설정 파일
│  └─ examples/               ← 견본 설계도(참고 사이트 A·B 등)
├─ app/                       ← lecpage 웹앱(Vite, 정적 배포). 엔진을 상대 경로로 import
├─ docs/                      ← 기획서, 아키텍처, 운영, 조사 자료
└─ .github/workflows/         ← CI, Pages 배포
```

원칙
- **엔진은 skill 폴더 안에 하나만** 둡니다. 앱은 `../skills/lecpage/engine/src/...`를 import합니다. 복사본을 만들지 않습니다.
- `engine/src`는 **순수 ESM, 외부 의존성 없음**. 필요한 작은 라이브러리는 `engine/vendor/`에 MIT 원본을 넣고 출처를 적습니다.
- `engine/runtime`은 **클래식 스크립트(IIFE)**. `file://`로 열어도 동작해야 하므로 ES 모듈·빌드 도구를 쓰지 않습니다. 전역은 `window.LecPage`, `window.LecFX`, `window.LecLive` 세 개만 씁니다.
- 생성 사이트가 실행 중에 부르는 외부 주소는 **jsDelivr(cdn.jsdelivr.net)의 버전 고정 URL**과 사용자가 고른 실시간 백엔드뿐입니다. 학교망 대비로 모든 외부 스크립트는 "실패해도 화면이 깨지지 않게" 씁니다.
- 화면에 들어가는 모든 문자열은 렌더러에서 **이스케이프**합니다. 링크는 `http:`/`https:`/`mailto:`/`#`만 허용합니다. AI가 만든 HTML은 받지 않습니다.

## 2. 연수 설계도(blueprint) v1

전체 스키마: `skills/lecpage/engine/src/schema/blueprint.schema.json`. 요점만 적습니다.

```jsonc
{
  "version": 1,
  "meta": { "title": "", "subtitle": "", "organizer": "", "date": "2026-11-04", "start": "15:10", "end": "16:40",
            "venue": "", "mode": "offline|online|hybrid", "joinUrl": "", "shortUrl": "", "lang": "ko",
            "admin": { "kind": "school|official|conference|student", "completionRate": 90, "hours": 1.5 },
            "sessions": [ { "no": 1, "date": "", "start": "", "end": "", "title": "" } ] },
  "audience": { "type": "teachers-elementary", "size": 28, "level": "beginner|intermediate|advanced",
                "devices": ["laptop","chromebook","tablet","phone"], "network": "good|slow|restricted",
                "blocked": [], "projector": true, "minor": false },
  "archetype": { "primary": "story|lab|live|course", "mix": ["story","lab"] },
  "design": { "preset": "night-story", "mood": ["warm","emotional"], "theme": "auto|light|dark",
              "motion": 2, "accent": "#ff6a4d", "fonts": { "display": "", "body": "" },
              "signature": "tone-journey", "graphic": "perspective-grid", "effects": { "<slot>": "<fx-id>" } },
  "instructors": [ { "name": "", "role": "", "org": "", "photo": "", "bio": "", "email": "", "showEmail": true,
                     "tags": [], "links": [ { "label": "", "url": "" } ], "timeline": [ { "group": "", "items": [ { "text": "", "year": "" } ] } ] } ],
  "sections": [ { "id": "hero", "type": "hero", "nav": "처음", "...": "모듈별 필드" } ],
  "live": { "provider": "none|local|supabase|sheets|http", "url": "", "anonKey": "", "code": "AB12CD",
            "features": ["qa","help","progress","board","poll","chat","attendance","reactions"], "anonymous": true },
  "privacy": { "collect": ["nickname"], "retentionDays": 30, "consent": true, "processors": [] },
  "deploy": { "target": "github-pages|cloudflare|vercel|netlify|firebase|s3|server|zip", "base": "/" },
  "sources": [ { "id": "deck1", "name": "교재.pptx", "pages": 124 } ]
}
```

### 2.1 섹션(모듈) 타입
| type | 필드 요약 |
|---|---|
| `hero` | eyebrow, title, subtitle, ctas[{label,href}], meta[{label,value}] |
| `glance` | items[{value,label,note}] (한눈에 보기) |
| `message` | text, note, style: statement\|formula\|quote, parts[] (formula일 때) |
| `steps5` | title, items[{word,desc}] (핵심 단계·키워드 나열) |
| `outline` | title, items[{part,title,desc,tags[],target(섹션id 또는 deck:쪽)}] |
| `schedule` | items[{start,end,title,desc,part}] |
| `readiness` | items[{label,detail,url}], checks[{name,url}] (접속 진단) |
| `deck` | slides[{src,page,title,text,tools[]}], download{href,size,label}, notice |
| `stations` | layout: sidebar\|tabs, items[{id,name,title,tag,desc,steps[],prompts[{title,text}],images[{src,caption}],links[{label,url}],outcome,note,source{pages[]}}] |
| `tools` | items[{name,url,desc,pages[],icon}] |
| `prompts` | items[{title,text,tags[]}] |
| `qa` | anonymous (live 필요) |
| `board` | categories[{id,label}], allowFiles, maxFiles, moderation (live 필요, 없으면 외부 링크) |
| `poll` | items[{id,question,kind: choice\|word\|scale,options[]}] |
| `quiz` | items[{q,options[],answer,explain}] |
| `materials` | items[{title,desc,href,kind,size}], notice |
| `instructor` | (top-level instructors 사용) |
| `survey` | url, qr, questions[{q,kind,options[]}] |
| `closing` | lead, text, thanks |
| `faq` · `glossary` | items[{q,a}] · items[{term,desc}] |
| `video` · `gallery` | items[{title,url,thumb}] · items[{src,caption}] |
| `sessions` | items[{no,date,title,desc,status,links[]}] (과정형 차시) |
| `speakers` | items[{name,role,org,photo,talk,time}] (라이브형) |
| `reflection` | prompts[] (나의 기록·다짐, 내려받기) |
| `attendance` | (live 필요) 입실·퇴실 |
| `text` | md (제한된 마크다운: 굵게, 기울임, 링크, 목록, 문단) |

모든 섹션 공통: `id`, `type`, `title?`, `nav?`(메뉴 이름, 없으면 메뉴에 안 나옴), `tone?`(night\|dawn\|day — 톤 여정용), `source?{file,pages[]}`.

## 3. 디자인 토큰(CSS 변수) — 생성 사이트

프리셋은 아래 변수를 채웁니다. 런타임 CSS와 효과는 **이 변수만** 씁니다(색 하드코딩 금지).

```
--background --foreground --card --card-foreground --muted --muted-foreground
--primary --primary-foreground --secondary --secondary-foreground
--accent --accent-2 --accent-3 --border --ring --surface-2
--success --warning --danger
--radius --radius-sm --radius-lg --border-w --shadow
--font-sans --font-display --font-mono
--ease-out --ease-in-out --dur-1 --dur-2 --dur-3 --dur-4 --dur-5 --motion-scale
--hero-from --hero-to  (히어로 배경 그라데이션 두 끝)
```
테마: `<html data-theme="light|dark">`. 프리셋이 두 테마 값을 모두 정의합니다.

## 4. 효과(FX) 레지스트리 계약

- 파일: `engine/runtime/fx/core.js`(레지스트리), `engine/runtime/fx/effects/<id>.js`(효과 1개당 1파일), `engine/runtime/fx/fx.css`.
- 메타데이터: `engine/src/design/fx-catalog.js`가 `export const FX = [...]`로 모든 효과의 정보를 내보냅니다. 결정 규칙과 앱 갤러리가 이것을 씁니다.

```js
// effects/split-reveal.js
LecFX.define('split-reveal', {
  level: 2,                          // 1 차분 · 2 보통 · 3 화려
  libs: [],                          // 필요 시 jsDelivr 버전 고정 URL. 예: 'https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/gsap.min.js'
  init(el, opts, ctx) {              // 요소 하나에 적용. 정리 함수를 돌려줄 수 있음
    // ctx.reduced      동작 줄이기(true면 최종 상태만 보여 주고 끝)
    // ctx.level        사이트 최대 강도(0~3). 효과 level이 더 크면 core가 init을 부르지 않음
    // ctx.lowPower     저사양 추정(코어 수·메모리·절약 모드)
    // ctx.load(url)    스크립트 지연 로드(Promise). 실패해도 reject 대신 false
    // ctx.visible(el, cb, {once, threshold})  화면에 들어올 때
    // ctx.token(name)  CSS 변수 값 읽기
    // ctx.onPause(cb)  사용자가 '움직임 멈춤'을 눌렀을 때
  }
});
```
- 적용 방법: 렌더러가 `data-fx="split-reveal"`(옵션은 `data-fx-opts='{"stagger":40}'`)를 붙입니다. `LecFX.start()`가 문서를 훑어 init합니다.
- **쉬는 상태가 완성 상태**여야 합니다. JS가 실패해도 글은 보이고, `opacity:0`으로 숨긴 채 기다리지 않습니다(진입 애니메이션은 JS가 시작할 때 클래스를 붙여서 처리).
- 슬롯(slot): 결정 규칙이 슬롯마다 효과를 고릅니다.
  `hero.title` `hero.graphic` `hero.cta` `section.title` `section.enter` `divider` `cards` `list` `numbers` `message` `schedule` `gallery` `closing.title` `closing.graphic` `cursor` `scroll` `progress` `celebrate`

## 5. 실시간(Live) 어댑터 계약

`engine/runtime/live/core.js`가 `window.LecLive`를 만들고, 어댑터가 등록합니다.

```js
LecLive.register('http', function factory(config) { return adapter; });
const live = LecLive.create(config);   // config = blueprint.live (+ 실행 중 입력한 adminKey)
```
어댑터 메서드(모두 Promise, 실패 시 throw 대신 `{error}`도 허용하지 않음 — throw하고 core가 잡음):
```
connect()                 → { mode: 'realtime'|'polling'|'local' }
join({nickname,name,school,consent}) → { id, token }   // 참가자. 토큰은 localStorage에 저장
list(col, {since})        → docs[]
add(col, doc)             → doc
update(col, id, patch)    → doc        // 본인 문서 또는 관리자
remove(col, id)           → true       // 관리자
vote(questionId)          → { votes }
getState() / setState(patch)  → state  // setState는 관리자
subscribe(handler)        → unsubscribe   handler({ type:'add'|'update'|'remove'|'state'|'reaction', col, doc })
react(emoji)              → true       // 저장하지 않는 방송
upload(file)              → { url, name, type, size }
exportCsv(kind)           → string     // 관리자
purge()                   → true       // 관리자, 연수 데이터 전부 삭제
status                    'connecting'|'live'|'polling'|'offline'
```
컬렉션과 필드
| col | 필드 |
|---|---|
| participants | id, nickname, name?, school?, consentAt, createdAt |
| attendance | by, kind: in\|out, at |
| progress | by, station, status: doing\|done\|stuck, at  (by+station 기준 덮어쓰기) |
| help | by, nickname, station, seat, message, status: open\|claimed\|done, assignee |
| questions | text, nickname?, anonymous, votes, status: open\|answered\|hidden, pinned |
| posts | kind, text, nickname, files[{url,name,type,size}], license, likes, hidden |
| polls | question, kind, options[], open (관리자) |
| answers | poll, by, value |
| survey | by, answers{} |
| chat | by, nickname, text |
상태(state): `{ step, slide, follow, timer:{endsAt,label,running}, notice:{text,level}, openPoll, updatedAt }`

공통: 모든 문서에 `id`, `createdAt`. 서버는 길이 제한(질문 500자, 글 1000자, 별명 20자)과 간단한 속도 제한을 둡니다. 관리자 인증은 **관리자 키**(배포 때 만들고 강사만 앎). 서버에는 키의 SHA-256만 저장합니다.

### 5.1 HTTP 프로토콜 v1 (Cloudflare Worker와 Node 자체 서버가 같이 구현)
```
POST   /api/:code/join                     {nickname,name?,school?,consent} → {id, token}
GET    /api/:code/snapshot?since=<ms>      → {state, questions[], posts[], help[], progress[], polls[], answers[], chat[], now}
GET    /api/:code/:col?since=<ms>          → docs[]
POST   /api/:code/:col                     (x-lec-token) → doc
PATCH  /api/:code/:col/:id                 (x-lec-token 또는 x-lec-admin) → doc
DELETE /api/:code/:col/:id                 (x-lec-admin) → {ok}
POST   /api/:code/questions/:id/vote       (x-lec-token) → {votes}
GET    /api/:code/state  ·  PUT /api/:code/state (x-lec-admin)
POST   /api/:code/react                    {emoji} → {ok}
POST   /api/:code/upload                   (multipart, x-lec-token) → {url,...}
GET    /api/:code/export.csv?kind=attendance|progress|questions|survey (x-lec-admin)
DELETE /api/:code                          (x-lec-admin) 전부 삭제
POST   /api/:code/init                     {adminKeyHash, settings} (최초 1회, 서버 설정 토큰 필요)
실시간: GET /api/:code/ws (WebSocket) → 서버가 {type,col,doc} 전송
       GET /api/:code/events (SSE)      → 같은 메시지
대체:   snapshot?since 폴링(5~10초)
```
클라이언트(http 어댑터)는 WebSocket → SSE → 폴링 순서로 시도하고, 4초 안에 연결이 안 되면 다음 방식으로 넘어갑니다.

## 6. 빌드 결과(생성 사이트) 파일
```
index.html        참가자 화면(내용이 JS 없이도 모두 보임)
console.html      강사 콘솔(관리자 키 입력)
screen.html       프로젝터 화면(큰 QR·질문·투표·타이머)
check.html        접속 진단
privacy.html      개인정보 처리 안내(수집할 때만)
assets/lecpage.css · theme.css · lecpage.js · fx.js · live.js · site.json
assets/slides/*.webp · assets/media/*
DESIGN.md · 운영안내.md
```

## 7. 작업 규칙
- 한국어 UI 문구는 짧고 평이하게. 버튼은 동작을 그대로("복사", "완료 체크").
- 접근성: 키보드 조작, 포커스 표시, 대비 4.5:1, `prefers-reduced-motion`, 5초 넘게 움직이면 멈춤 버튼.
- 성능: 참가자 첫 화면 JS·CSS 합계 200KB 안팎(라이브러리 지연 로드 제외).
- 테스트: `npm test`(= `node --test "skills/lecpage/engine/test/*.test.mjs"`)와 Playwright 스모크 테스트.
- 커밋·푸시는 통합 담당만 합니다. 병렬 작업자는 자기 디렉터리에만 씁니다.
