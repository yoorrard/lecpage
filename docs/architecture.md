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
│  │  │  ├─ schema/           ← 섹션 정의·상수(sections.js)
│  │  │  ├─ validate.js       ← 검증·자동 보정(normalize)
│  │  │  ├─ decide/           ← 유형·운영·디자인·효과 결정 규칙
│  │  │  ├─ design/           ← 프리셋, 토큰→CSS, 글꼴, fx-catalog.js
│  │  │  ├─ render/           ← 문자열 템플릿 렌더러(모듈별)
│  │  │  ├─ ingest/           ← PPTX·DOCX·HWPX·PDF 해석(브라우저+Node)
│  │  │  ├─ prompt/           ← AI 프롬프트 팩, JSON 추출, 수정 요청(review). AI 제공자 호출은 앱(app/src/lib/ai.js)
│  │  │  └─ build.js          ← blueprint → 파일 묶음
│  │  ├─ runtime/             ← 생성 사이트에 복사되는 클래식 스크립트(빌드 도구 없음)
│  │  │  ├─ lecpage.css · boot.js · lecpage.js · console.js · screen.js · unlock.js
│  │  │  ├─ fx/               ← 효과 레지스트리(core.js, fx.css, effects/*.js)
│  │  │  └─ live/             ← 실시간 어댑터(core.js, local.js, http.js, supabase.js, sheets.js)
│  │  ├─ vendor/              ← 작은 MIT 라이브러리(예: fflate)
│  │  └─ test/                ← node:test
│  ├─ scripts/                ← CLI(lecpage.mjs), 파이썬 보조(ingest.py), render_slides.sh
│  ├─ backends/               ← supabase/, apps-script/, cloudflare/, node-server/
│  ├─ templates/deploy/       ← 호스팅별 설정 파일
│  └─ examples/               ← 예시 설계도(강의형 sel-story, 실습형 data-lab)
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

따로 JSON 스키마 파일은 없습니다. 기준은 `engine/src/validate.js`(검증·자동 보정)와 `engine/src/schema/sections.js`(섹션 정의)이고, 여기에는 요점만 적습니다.

```jsonc
{
  "version": 1,
  "meta": { "title": "", "subtitle": "", "organizer": "", "date": "2026-11-04", "start": "15:10", "end": "16:40",
            "venue": "", "mode": "offline|online|hybrid", "joinUrl": "", "shortUrl": "", "contact": "", "lang": "ko",
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
            "features": ["qa","help","progress","board","poll","attendance","reactions","signal"], "anonymous": true,
            "uploads": true },  // uploads(선택): 서버가 보드 파일을 받는지. 없으면 sheets만 false(시트에서 파일 올리기를 켜야 함)
  "privacy": { "collect": ["nickname"], "retentionDays": 30, "consent": true, "processors": [] },
  "deploy": { "target": "github-pages|cloudflare|vercel|netlify|firebase|s3|server|zip", "base": "/" },
  "sources": [ { "id": "deck1", "name": "교재.pptx", "pages": 124 } ]
}
```

### 2.1 섹션(모듈) 타입
| type | 필드 요약 |
|---|---|
| `hero` | eyebrow, title, subtitle, ctas[{label,href}], meta[{label,value}] |
| `goals` | items[] (연수 목표 2~4개), who (대상). 직무연수면 이수 기준 줄 자동 |
| `glance` | items[{value,label,note}] (한눈에 보기) |
| `message` | text, note, style: statement\|formula\|quote, parts[] (formula일 때) |
| `steps5` | title, items[{word,desc}] (핵심 단계·키워드 나열) |
| `outline` | title, items[{part,title,desc,tags[],target(섹션id 또는 deck:쪽)}] |
| `schedule` | items[{start,end,title,desc,part}] |
| `readiness` | items[{label,detail,url}], checks[{name,url}] (접속 확인) |
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
| `sessions` | items[{no,date,title,desc,status,links[]}] (과정형 차시, status를 비우면 날짜로 마침·오늘·다음 자동) |
| `followup` | items[{title,desc,url,kind: recording\|community\|next\|read\|link}], completion (연수 후 안내. 끝난 뒤 첫 화면 아래로) |
| `speakers` | items[{name,role,org,photo,talk,time}] (행사형) |
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

#### 5.0 보완 규칙 (실시간 구현에서 확정, 2026-11)
위 계약은 그대로 지키고, 아래를 덧붙입니다. 화면 코드(lecpage.js·console.js·screen.js)는 위 메서드만 써도 동작합니다.

- **`LecLive.create(config)`가 돌려주는 것은 어댑터를 감싼 클라이언트**입니다. 메서드 이름·인자는 위 계약과 같고(`connect … purge`, `status`), 다음이 더 있습니다.
  `on('status'|'change'|'reaction'|'error'|'queue'|'join', cb)` · `onChange(col|'state'|'*', cb(docs, change))` · `store(col, {visible, mine})` · `get(col,id)` · `state` · `me()` · `mine(col)` · `voted(id)` · `like(postId) → {likes}` · `isAdmin()` · `setAdminKey(key)` · `checkAdmin() → boolean` · `sync(full)` · `now()`(서버 시각 보정) · `leave()`(공용 PC에서 참가 정보 지우기) · `close()`.
  전역: `LecLive.on('status', cb)`, `LecLive.store(col)`, `LecLive.onChange(col, cb)`는 마지막으로 만든 클라이언트를 가리킵니다. `LecLive.mask(text)`, `LecLive.limits`, `LecLive.emojis`, `LecLive.util`.
- config: `{provider, url, anonKey, code, adminKey?, pollMs?, transports?: ['ws','sse','poll'], identity?: 'local'|'session', profanity?: true|false|{words,extra,allow}, nickname?, maxUploadMb?}`. `role` 등 모르는 키는 무시합니다.
- 클라이언트가 하는 일: 재시도(네트워크·5xx·429만, 지수 백오프), 참가 정보(`{id, token, nickname}`만) localStorage 저장(try/catch), 끊긴 동안의 쓰기 대기열(localStorage, 최대 100개, 다시 연결되면 순서대로, `cid`로 중복 방지), 낙관적 표시(`_pending: true`), id 기준 병합과 `updatedAt` 비교(오래된 것 무시), 길이 자르기, 욕설 가리기(보낼 때·받을 때). 토큰이 무효(401 `invalid_token`)면 같은 별명으로 다시 참가해 한 번 더 시도합니다.
- **어댑터 factory는 `factory(config, ctx)`** 입니다. `ctx = {token(), me(), adminKey(), cursor(), emit(evt), storage, util, error}`. 어댑터는 `subscribe(handler)`로 받은 handler(=`ctx.emit`)에 위 이벤트 외에 `{type:'status', status, mode}`, `{type:'resync', full?}`(클라이언트가 커서 이후를 다시 읽음, 결과 Promise `{changes, error}`), `{type:'hello', now}`, `{type:'reset'}`(모두 지움 → 전체 다시 읽기)를 보낼 수 있습니다. 클라이언트가 핸들러에 넘기는 이벤트 종류에도 `'reset'`이 더해집니다.
- 선택 메서드: `snapshot({since, admin}) → {state, <col>[]…, removed:[{col,id}], now, time?, full}` (있으면 한 번에 동기화, 없으면 `list`를 컬렉션마다 부름) · `like(id)` · `checkAdmin()` · `setAdmin(key)` · `close()`.
- **커서(`since`/`now`)는 불투명한 값**입니다. http·local·sheets는 서버의 단조 증가 ms 도장, supabase는 정수 `rev`. 모든 문서에 `updatedAt`이 있고 커서는 `updatedAt`(또는 rev) 기준이며, 지운 문서는 `removed`(tombstone)로 알립니다.
- 공개 범위: 공개 컬렉션 = questions·posts·help·progress·polls·answers·chat(+state). 비공개 = participants·attendance·survey(관리자만, 참가자 토큰은 **자기 것만**). questions는 누구에게도 `by`를 주지 않습니다(익명 보장; 내 질문은 클라이언트가 id로 기억). 숨긴 글(questions `status:'hidden'`, posts·chat `hidden:true`)은 비관리자에게 `text:''`(posts는 `files:[]`)로 내려갑니다.
- 덮어쓰기 키: progress(by+station), answers(poll+by), survey(by), attendance(by+kind). answers의 `value`는 글자·숫자 또는 그 배열(최대 5개, 워드클라우드). 서버에 같은 id의 `polls` 문서가 있고 `open:false`면 409 `poll_closed`(설계도에만 있는 투표 id도 받음).
- 문서에 `cid`(클라이언트 작업 id, 40자 이하)를 넣으면 같은 참가자·같은 cid의 재전송은 같은 문서를 돌려줍니다.
- 상태 `setState`: 얕은 병합, `timer`·`notice`는 통째로 교체, `null`이면 지움. 상태에 `timer.remaining`(일시정지 남은 ms)과 `ui:{키: 글자|숫자|불}`(콘솔·프로젝터 부가 설정, 20개까지, `null`이면 그 키 삭제)를 더했습니다. 모르는 키는 버립니다.
- 반응 `react(emoji)`는 허용 목록(`LecLive.emojis`: 👍 ❤️ 👏 🎉 😂 😮 🤔 🙏 🔥 💯 🙌 😢 ✅ ❓ 💡)만 받고, 서버가 0.4~2초씩 모아 `{type:'reaction', doc:{emoji, count}}`로 보냅니다.
- 오류: 어댑터는 `LecLive.error(code, message, {status, retryAfter})`를 throw합니다. `code`는 `too_long`, `required`, `invalid_type`, `invalid_value`, `consent_required`, `invalid_token`(401), `admin_required`(401/403), `forbidden`(403), `not_found`·`unknown_training`·`unknown_collection`(404), `poll_closed`·`hidden`(409), `too_large`(413), `unsupported_type`(415), `rate_limited`(429), `uploads_disabled`(503) 등이고 `message`는 한국어 안내입니다.
- 업로드: 이미지(PNG·JPG·GIF·WEBP)·PDF·MP3·MP4, 기본 20MB(설정 가능). 형식은 서버가 **파일 내용(매직 바이트)** 으로 판정하고 SVG·HTML은 받지 않습니다.
- 백엔드별 실시간 방식: http = WebSocket(Hibernation)·SSE·폴링, supabase = 공개 Broadcast 채널 `lec:<코드>`(콘솔은 `lec:<코드>:adm`)의 **2초 간격 '틱'** 을 받고 rev 이후 행을 RLS로 읽음(무료 플랜 초당 100메시지 대비), sheets = 7초 폴링, local = BroadcastChannel(+storage 이벤트).

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

#### 5.1.1 프로토콜 v1 보완(구현과 테스트 기준: `backends/node-server/lib/protocol.js` = `backends/cloudflare/src/protocol.js`)
- 연수 코드: 영문·숫자로 시작하는 `[A-Z0-9_-]` 3~40자, 대소문자 구분 없음(서버가 대문자로 바꿈).
- `snapshot` 응답: `{state, <공개 컬렉션>[], removed:[{col,id}], now, since, full}`. `since`는 **초과(>)** 비교이고 `now`는 서버가 이번 응답용으로 확보한 단조 증가 도장이라 다음 `since`로 그대로 쓰면 빠짐·중복이 없습니다. `x-lec-admin`이 맞으면 participants·attendance·survey도 들어오고, `x-lec-token`이 있으면 자기 attendance·survey와 `me:{id,nickname}`가 들어옵니다. 채팅은 최근 500개까지.
- `GET /api/:code/participants|attendance|survey`: 관리자는 전부, 토큰은 자기 것만, 둘 다 없으면 401.
- 추가: `POST /api/:code/posts/:id/like` (x-lec-token) → `{likes}` · `GET /api/:code/files/:name`(올린 파일, `nosniff`·CSP·Range 지원) · `GET /api/health` → `{ok, protocol:1}`.
- `vote`·`like`는 참가자당 1번이며 다시 부르면 `{votes, already:true}`(멱등). `PUT /api/:code/state`는 PATCH·POST도 받습니다.
- 헤더 값은 Latin-1만 가능하므로 **`x-lec-admin`·`x-lec-setup`은 `encodeURIComponent`로 인코딩**해 보냅니다(서버가 디코딩, ASCII 값은 그대로 통과). 토큰(`x-lec-token`)은 base64url.
- 오류 본문: `{error, message, ...}` + HTTP 상태(5.0 목록), 429에는 `Retry-After`.
- `init`: 헤더 `x-lec-setup: <설정 토큰>`(서버의 `SETUP_TOKEN`/`LEC_SETUP_TOKEN`), 본문 `{adminKeyHash, settings:{retentionDays, maxUploadMb, uploads, title}}`. 이미 키가 있는 코드를 다시 init하려면 지금 관리자 키(`x-lec-admin`)가 필요합니다. 서버에 기본 관리자 키(`ADMIN_KEY`/`LEC_ADMIN_KEY`)가 있으면 등록 없이 모든 코드가 첫 쓰기 때 자동으로 생깁니다(한 강사용 서버).
- `upload`: multipart의 `file` 필드, 또는 원본 바이트 + `x-lec-filename`(URL 인코딩). 응답 `url`은 `/api/<코드>/files/<임의24hex>.<확장자>`(어댑터가 절대 주소로 바꿈).
- `export.csv`: kind에 participants·posts·help·chat·answers 추가. UTF-8 BOM(엑셀), 수식 주입 방지(`= + - @`로 시작하면 `'` 붙임), 시각은 Asia/Seoul.
- `DELETE /api/:code`: 문서·투표·상태·파일을 지우고 연결된 모두에게 `{type:'reset'}`을 보냅니다(관리자 키 등록은 남음). 보관 기간(기본 30일, 마지막 쓰기 기준)이 지나면 서버가 연수를 통째로 지웁니다.
- WebSocket: 연결되면 서버가 `{type:'hello', now, mode:'ws'}`. 클라이언트는 25초마다 텍스트 `ping` → `pong`(Cloudflare는 객체를 깨우지 않고 자동 응답). 관리자는 `{type:'auth', admin}`을 보내 `{type:'auth', ok}`를 받으면 비공개 컬렉션 이벤트(전체 문서)도 받습니다. 공개 연결은 공개용으로 걸러진 문서만 받습니다.
- SSE: `retry: 3000`, 2KB 패딩, 첫 메시지 `hello`, 20초마다 `{type:'ping'}`. SSE로는 비공개 컬렉션 이벤트를 보내지 않습니다(관리자 화면은 15초마다 다시 읽음).
- 폴링: 기본 5초, 변화가 없으면 최대 10~15초, 숨긴 탭 30초, 오류 시 최대 60초까지 늘림. 실시간이 끊기면 지수 백오프+지터로 다시 연결하고 매번 `since` 이후를 다시 읽으며, 폴링 중에도 3분마다 실시간 연결을 다시 시도합니다. 같은 방식이 30초 안에 3번 끊기면 그 탭에서는 10분 동안 건너뜁니다.

#### 5.1.2 보안 보강(2026-11, 프로토콜 v1과 호환)
- **관리자 키**: 12자 미만이거나 예시 값(`change-me…` 등)이면 서버가 켜지지 않거나(node) 503으로 답합니다(Cloudflare). 틀린 키는 (코드, IP)당 10분 10번·IP당 20번을 넘으면 정답 키까지 429(`Retry-After`). WebSocket 인증은 3번 틀리면 끊습니다.
- **올린 파일**: 보이는 게시물이 쓰는 동안에만 제공합니다. 숨기면 바로 404, 지우기·전부 삭제·보관 기간 만료·쓰이지 않은 업로드는 파일까지 지웁니다. `Cache-Control: private, max-age=300`. 게시물 `files`에는 **이 서버가 받은 그 참가자의 업로드 주소만** 받습니다(외부 URL은 400).
- **설정**: `init`의 `settings`에 `uploads`(false면 `/upload`·`posts.files` 거절)와 `moderation`(새 게시물은 숨김 상태로, 강사가 보이기). 앱은 `board.allowFiles`·만 14세 미만·`board.moderation`을 그대로 넘깁니다.
- **투표**: 닫힌 투표의 답은 고칠 수 없습니다(409). 공개 `answers`·`progress`·`help`에는 `by` 대신 `mine` 표시만.
- **IP**: `X-Forwarded-For`는 믿지 않습니다. 프록시 뒤라면 `LEC_TRUSTED_PROXIES=<홉 수>`로 오른쪽에서 읽습니다. 읽기는 IP당 분당 6,000(부드러운 제한), 방 하나 참가자·연결 수, 새 코드 수에 상한.
- **방 만들기(Cloudflare)**: 모르는 코드로 읽기만 하면 저장소를 만들지 않습니다. 빈 방은 알람 때 지웁니다.
- **별명**: '강사'·'운영자'·'admin'·'lecpage'는 참가자가 쓸 수 없습니다.
- **Supabase**: 파일 버킷은 비공개, 1시간짜리 서명 주소로 제공. 지운 파일은 휴지통 표에 모았다가 콘솔이 연결될 때 Storage API로 지웁니다. 공개 Broadcast 내용(반응 수·다시 읽기 신호)은 믿지 않고 다시 읽습니다(비공개 채널은 로그인 사용자가 필요해 쓰지 않음).
- **Apps Script**: `setup()`이 연수 코드를 고정하고 다른 코드는 거절. 파일은 게시물이 보일 때만 '링크 공유', 지우면 휴지통.

## 6. 빌드 결과(생성 사이트) 파일
기준은 `engine/src/build.js`입니다.
```
index.html        참가자 화면(내용이 JS 없이도 모두 보임)
screen.html       발표 화면(큰 QR·질문·투표·타이머·도구)
check.html        접속 확인
poster.html       A4 QR 안내문(인쇄용) + 강사 카드
console.html      강사 화면(관리자 키 입력). 참여 기능을 쓸 때만
privacy.html      개인정보 처리 안내. 참여 기능을 쓸 때만
_headers          Netlify·Cloudflare용 보안 헤더(강사 화면·발표 화면·안내문 틀 넣기 금지)
robots.txt        access.mode가 public일 때만 Allow, 그 밖에는 Disallow
assets/theme.css · lecpage.css · boot.js · lecpage.js · screen.js · qr.js · favicon.svg
assets/console.js · live.js      참여 기능을 쓸 때만
assets/fx.js · fx.css            효과를 쓸 때만
assets/unlock.js                 암호 보호(access.mode password)일 때만
assets/slides/*.webp · assets/media/*
```
- 강사용 파일(`DESIGN.md` · `운영안내.md` · `lecpage.blueprint.json`)은 올리는 사이트에 넣지 않습니다. `build()`가 `teacher`로 따로 돌려주고, CLI는 `<out>-강사용/`에, 앱은 따로 내려받기로 줍니다.
- `access.mode`: `link`(기본, noindex + robots.txt Disallow) · `public` · `password`. `password`면 `protectSite()`가 index·console·screen(있으면 poster) 페이지와 `assets/slides|media/*`를 AES-GCM(PBKDF2-SHA256 60만 회)으로 잠가 `*.enc`로 바꾸고 `assets/unlock.js`를 넣습니다. `check.html`·`privacy.html`은 잠그지 않습니다. 주소 끝 `#k=암호`로 자동으로 열립니다.

## 7. 작업 규칙
- 한국어 UI 문구는 짧고 평이하게. 버튼은 동작을 그대로("복사", "완료 체크").
- 접근성: 키보드 조작, 포커스 표시, 대비 4.5:1, `prefers-reduced-motion`, 5초 넘게 움직이면 멈춤 버튼.
- 성능: 참가자 첫 화면이 처음 받는 자기 파일(HTML+CSS+JS, gzip) 200KB 안. `qa`가 '첫 화면 nKB'로 알려 줍니다(예시 2종 90KB 안팎). QR 코드(`qr.js`)는 공유 창을 열 때 받습니다.
- 테스트: `npm test`(= `node --test "skills/lecpage/engine/test/*.test.mjs"`). CI(`.github/workflows/ci.yml`)는 `npm test` → `npm run examples`(예시 빌드) → 앱 빌드 → `npm audit`(앱 배포 묶음)를 돌립니다. 브라우저 테스트(`live-browser.test.mjs`)는 Playwright가 있을 때만, Supabase·Cloudflare 테스트는 PostgreSQL·`LEC_CF_URL`이 있을 때만 돌고 없으면 건너뜁니다. 앱 화면 자동 테스트는 아직 없습니다.
- 앱 미리보기 기기 크기: 모니터 1920×1080, 노트북 1536×864, 태블릿 820×1180, 휴대폰 360×780, 맞춤. CLI `qa`도 휴대폰 360×780·태블릿 820×1180·PC 1280으로 봅니다.
- 커밋·푸시는 통합 담당만 합니다. 병렬 작업자는 자기 디렉터리에만 씁니다.

## 8. v1.1에서 더한 계약 (2026-11-11)

### 8.1 올릴 곳 고르기 (`engine/src/decide/infra.js`)
- `HOSTS[id]`: `{ name_ko, cost, app(앱에서 바로 올림), account, limit?: { siteMB, fileMB, files }, cli?, note_ko }`. id: `lecpage`(바로 공개) · `vercel` · `github-pages` · `cloudflare` · `netlify` · `firebase` · `s3` · `server` · `lan` · `zip`. 숫자 근거는 `docs/research/hosting-2026-11.md`.
- `decideHost(input) → { hosts, pick, reasons, warnings }`. 입력: `skill`(`click` 앱 / `set`·`dev` skill), `commercial`, `network`, `infra[]`, `backend`, `previous`(지난번에 올린 곳), `connected[]`(연결해 둔 곳), `instant`(바로 공개를 쓸 수 있음), `keep`, `customDomain`, `siteMB`, `maxFileMB`, `files`. 규칙 순서: 인터넷 없음 → 자체 서버 → 기본(앱 Vercel, skill Cloudflare) → 강사료(Vercel 제외, Cloudflare 먼저) → 내 도메인 → 크기(25MB 넘는 파일이나 파일 수 초과(끌어 놓기 1,000개·명령 20,000개)면 GitHub Pages 먼저, 100MB 넘는 사이트는 Cloudflare 먼저·Vercel 맨 뒤) → 바로 공개 → 지난번에 올린 곳·연결해 둔 곳 먼저.
- `checkHost(host, { bytes, files, maxFile, binaries }) → { ok, errors, warnings }`: 올리기 직전에 그곳의 한도를 확인합니다.

### 8.2 앱의 공개하기 (`app/src/lib/deploy.js`, `app/src/components/Publish.jsx`)
- 흐름: 사이트 만들기(`buildFiles`) → `checkHost` → 올리기 → 주소 저장 → `probeSite`(사이트의 `assets/favicon.svg`를 그림으로 불러 실제로 열리는지 확인).
- Vercel(`deployVercel`): `GET /v9/projects?limit=1`(토큰 확인) → 같은 이름 프로젝트가 있으면 중단 → 파일별 SHA-1로 `POST /v13/deployments` → `missing_files`면 그 파일만 `POST /v2/files`(`x-vercel-digest`) → 다시 요청 → `GET /v13/deployments/{id}`로 READY 대기 → 새 프로젝트에 `ssoProtection`이 걸려 있으면 `PATCH /v9/projects/{id} {ssoProtection:null}` → 프로젝트 주소(`<이름>.vercel.app`)를 돌려줌. `_headers`는 `vercel.json`의 `headers`로 옮깁니다. 배포별 주소는 쓰지 않습니다.
- GitHub Pages(`deployGitHub`)·Netlify(`deployNetlify`)는 v1.0과 같습니다. 토큰은 연결할 때 확인한 뒤 저장합니다(`deploy-<kind>` 키, '기억하기'를 켜면 WebCrypto로 암호화).
- 바로 공개(`deployInstant`, 선택): 빌드 변수 `VITE_PUBLISH_API`가 있고 `GET /api/info`가 답할 때만 보입니다. API 계약은 `hosting/README.md`.
- 프로젝트에 남는 값: `deploy = { target, lastUrl, at, vercel:{projectId,name,url}, github:{repo,url}, netlify:{siteId,url,name}, lecpage:{id,key,url,expiresAt}, cloudflare|zip:{url} }`. `.lecpage` 파일로 내보낼 때 `deploy`는 넣지 않습니다.

### 8.3 AI로 사이트 만들기 (`app/src/lib/ai-job.js`)
- `startMakeJob({ getProject, update })`: 기본 초안이 보이는 상태에서 읽기 → 묻기 → 만들기 단계로 돌고, 끝나면 되돌리기 지점("AI로 만들기 전")을 쌓은 뒤 설계도를 바꿉니다. `live.url`·`live.code`·`live.anonKey`·`meta.siteUrl` 등 강사만 정하는 값은 AI 결과에서 받지 않습니다.
- 연결(`AiConnect`): 키 붙여넣기(Gemini·OpenAI·Claude, 회사 자동 인식, `checkKey`. 한 번에 한 단계씩 안내) · 챗봇 붙여넣기. OpenRouter는 고르는 화면에서 뺐고 저장해 둔 연결만 그대로 동작합니다. 설정의 '연결'에서 미리 해 둘 수 있습니다.

### 8.4 디자인 토큰 내보내기
- `design/color.js` `ramp12(hex) → { light:[12], dark:[12] }`(OKLCH), `design/dtcg.js` `designTokens(design)` → 강사용 파일 `tokens.json`(DTCG 2025.10). 올리는 사이트에는 넣지 않습니다.
- 디자인마다 첫 화면 구성이 다릅니다: `preset.variants.hero`(`cinema`·`worksheet`·`bento`·`poster`·`quiet`·`brief`·`masthead`·`sticker`·`board`·`spec`·`zine`·`invite`), 렌더러는 `render/hero.js`. 글꼴은 `preset.fonts`와 `preset.fontAlts`(주제·분위기에 따라 `chooseFonts`가 고름).

### 8.5 요청 사항·자료 올리기 (2026-11-11)
- 요청 사항: `info.request`(자유 글, 600자). `buildPrompt`가 연수 정보 JSON에서 빼서 "## 강사의 요청 사항" 아래에 따로 적고(규칙 10), `requestHints(text) → { mood[], accent?, theme?, motion?, format? }`가 AI 없는 기본 초안에도 분위기·색·밝기·움직임·형식을 반영합니다. 강사가 따로 고른 값(`info.mood`·`accent`·`motion`·`format`)이 언제나 먼저입니다.
- 자료 파일: 앱이 `assets/files/<이름>`으로 이 브라우저에 두고(자료실 항목의 `href`), 공개할 때만 사이트에 넣습니다. 엔진의 `USER_ASSET`이 `slides|media|files` 폴더와 문서·그림·소리·영상·압축 형식만 받습니다(스크립트·SVG·HTML 금지). 자료실에서 뺀 파일은 다음 공개 때 빠집니다.
- 연수 중 자료 링크: 강사 화면에서 `setState({ ui: { m1…m8: '<https 주소> <이름>' } })`. 서버가 원래 받는 `state.ui`(글 200자, 키 20개)에 담아 백엔드를 바꾸지 않고 다섯 가지 연결 방식에서 모두 동작합니다. 읽기·쓰기는 `LecLive.util.ext.materials / materialAdd / materialRemove`, 참가자 화면은 자료실 아래(없으면 마무리 앞)에 보여 줍니다. https 주소만 받습니다.
- 바로 공개 + 참여 기능: 운영자 서버가 `info.live`를 알리면 앱은 공개할 때 `POST /api/sites/:id/live { code, adminKeyHash, settings }`로 방을 만들고 설계도의 `live`를 `{ provider: 'http', url }`로 맞춥니다. 관리자 키는 앱이 만들어 이 브라우저에만 두고 서버에는 해시만 보냅니다. 개인정보 안내(`privacy.processors`)에 그 서버가 적힙니다.

### 8.6 바로 공개 서버 (`hosting/`, 선택)
운영자가 배포했을 때만 쓰이는 Cloudflare Worker입니다(Durable Objects SQLite, R2·KV 없음). 운영 안내와 전체 계약은 `hosting/README.md`.
- 사이트: `POST /api/sites` → `{id, key, url, expiresAt}` · `POST /api/sites/:id/deploys {files:{경로:{sha256,size}}}` → `{deploy, missing[]}` · `PUT /api/sites/:id/blobs/:sha256` · `POST /api/sites/:id/deploys/:deploy/publish` · `DELETE /api/sites/:id`. 수정 키는 한 번만 내려 주고 해시로 보관합니다.
- 참여 기능: `POST /api/sites/:id/live {code, adminKeyHash, settings}` → `{url, code}`. 방은 `skills/lecpage/backends/cloudflare`의 Room을 그대로 불러 `/live` 아래에 붙였고, 사이트에 묶인 코드만 살아 있습니다. 코드가 다른 사이트와 겹치면 `409 code_taken`(앱이 새 코드로 다시 올림). 사이트가 지워지거나 공개 기간이 끝나면 방과 올린 파일도 지워집니다.
- 안전: 올린 `.js`는 엔진 런타임 파일(또는 그 묶음)과 내용이 같을 때만 받고(`runtime_mismatch`), 모든 응답에 서버가 정한 CSP(`script-src 'self'`)를 붙입니다. HTML의 `meta refresh`·`base`·바깥 스크립트는 빼고 보냅니다. 받는 파일 형식은 엔진의 `USER_ASSET`과 같습니다(테스트가 어긋남을 잡음).
- 한도(기본): 사이트 40MB·파일 20MB·600개, 공개 기간 30일(방문이 있으면 늘어남, 처음 만든 날부터 1년까지), 방 올리기 10MB·방마다 200MB, IP당 새 사이트 시간당 6개.
