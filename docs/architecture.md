# lecpage 아키텍처와 계약(Contracts)

이 문서는 lecpage를 만드는 모든 작업자(사람·AI)가 같은 약속을 지키도록 정한 기준입니다. 코드를 쓰기 전에 읽고, 약속을 바꿔야 하면 이 문서를 먼저 고칩니다. 흐름과 약속 A~D의 자세한 이유는 [AI 중심 개편 설계](plan-ai-first.md)에 있습니다.

## 0. 한 줄 요약

연수 교재 → **AI가 읽고 사이트(HTML·CSS·JS)와 연수 정보(`lecpage.json`)를 씀** → lecpage가 **쪽 그림·강의 기능 키트·조립·검수·배포**를 맡음 → 어디든 배포(바로 배포, GitHub Pages, Cloudflare, Vercel, Netlify, S3, 개인 서버, USB). 실시간 기능은 **어댑터**로 붙입니다(브라우저만, Supabase, Google Sheets, Cloudflare/자체 서버 HTTP).

예전의 템플릿 흐름(교재 → 코드가 감지한 설계도 `blueprint.json` → 프리셋·섹션 렌더러)은 2026-11-20에 지웠습니다. 예전 방식의 `.lecpage` 파일은 열면 "예전 방식으로 만든 연수예요"라고 알리고 교재·연수 정보·배포 정보만 가져와 AI로 새로 만들게 합니다.

## 1. 저장소 구조

```
lecpage/
├─ .claude-plugin/            ← Claude Code 플러그인 마켓플레이스. `/plugin install lecpage --marketplace yoorrard/lecpage`가 skills/lecpage를 설치
├─ skills/lecpage/            ← Agent Skill 패키지(자체 완결). `npx skills add yoorrard/lecpage`
│  ├─ SKILL.md
│  ├─ references/             ← skill이 필요할 때 읽는 문서(kit.md 키트, cli.md 명령, 배포, 디자인 서재, 레퍼런스 사이트 designs/<id>/, 개발용 material-format.md)
│  ├─ engine/                 ← 단일 소스 엔진. Node와 브라우저(앱) 모두에서 import
│  │  ├─ package.json         ← 판(version) 하나의 출처 + "type":"module". src/version.js는 시험이 같은 값인지 확인
│  │  ├─ src/                 ← ESM. 의존성 없음(vendor/ 제외)
│  │  │  ├─ kit/              ← 조립(assemble.js)·보조 쪽(aux-build.js)·키트 위젯(widgets.js)·검수(inspect.js, inspect-rendered.js)·.lecpage v2(project-v2.js)
│  │  │  ├─ render/           ← 보조 쪽(강사·발표·안내문·접속 확인·개인정보) 렌더러(aux-pages.js), 쪽 머리·CSP(shell.js), 이스케이프(html.js), 마크다운(markdown.js)
│  │  │  ├─ design/           ← 보조 쪽 테마 두 가지(presets.js, tokens.js), 글꼴(fonts.js), 색(color.js)
│  │  │  ├─ ingest/           ← PPTX·DOCX·HWP·HWPX·PDF·이미지 읽기(브라우저+Node) → 쪽 그림·쪽 제목, 원본을 못 건넨 교재의 보조 글자
│  │  │  ├─ decide/infra.js   ← 올릴 곳·참여 기능 연결 고르기
│  │  │  ├─ prompt/copy-rules.js ← 앱·고정 문구 검사 규칙(app/scripts/copy-lint.mjs가 씀)
│  │  │  └─ protect.js · font-bundle.js · font-subset.js · zip-write.js · project-file.js · css-prune.js · util.js
│  │  ├─ runtime/             ← 만든 사이트에 복사되는 클래식 스크립트(빌드 도구 없음)
│  │  │  ├─ kit.css           ← 키트 위젯 모양(`.lpk` 안에서만)
│  │  │  ├─ lecpage.css · aux-pages.css · boot.js · lecpage.js · console.js · screen.js · check.js · unlock.js
│  │  │  ├─ live/             ← 실시간 어댑터(core.js, local.js, http.js, supabase.js, sheets.js)
│  │  │  └─ vendor/qrcode.js  ← 만든 사이트의 assets/qr.js
│  │  ├─ vendor/              ← 작은 MIT 라이브러리(fflate) + VENDOR.json(담아 둔 라이브러리·판을 고정한 배포 명령 표, CI가 OSV로 확인)
│  │  ├─ scripts/site-score.mjs ← 만든 사이트 채점(점검용)
│  │  └─ test/                ← node:test
│  ├─ scripts/                ← CLI(lecpage.mjs·kit-cmds.mjs·publish.mjs·studio.mjs), 쪽 그림(render-slides.mjs, 셸 없이), 파이썬 보조(ingest.py)
│  ├─ evals/                  ← skill 평가 문항(evals.json·triggers.json)과 확인 스크립트
│  ├─ backends/               ← supabase/, apps-script/, cloudflare/, node-server/
│  └─ templates/deploy/       ← 호스팅별 설정 파일
├─ app/                       ← lecpage 웹앱(Vite, 정적 배포). 엔진을 상대 경로로 import. AI 생성은 app/src/lib/gen/*
├─ hosting/                   ← 바로 배포 서버(Cloudflare Worker, 선택)
├─ scripts/check-references.mjs ← 레퍼런스 사이트를 Skill 흐름(check)으로 조립·검수(`npm run examples`)
├─ scripts/ai-catalog/        ← AI 모델 값표 매일 갱신(refresh.mjs, 의존성 없음) → app/public/ai-catalog.json
├─ scripts/vendor-audit.mjs   ← skill에 담아 둔 라이브러리·고정한 배포 명령의 알려진 취약점(OSV) 확인(CI)
├─ docs/                      ← 기획서, 아키텍처, 운영, 조사 자료
└─ .github/workflows/         ← CI, Pages 배포, AI 정보 매일 갱신(ai-catalog.yml)
```

원칙
- **엔진은 skill 폴더 안에 하나만** 둡니다. 앱은 `../skills/lecpage/engine/src/...`를 import합니다. 복사본을 만들지 않습니다.
- `engine/src`는 **순수 ESM, 외부 의존성 없음**. 필요한 작은 라이브러리는 `engine/vendor/`에 MIT 원본을 넣고 출처를 적습니다.
- `engine/runtime`은 **클래식 스크립트(IIFE)**. `file://`로 열어도 동작해야 하므로 ES 모듈·빌드 도구를 쓰지 않습니다. 전역은 `window.LecPage`, `window.LecLive`를 씁니다.
- 디자인·글·화면 구성은 **AI가 씁니다**. 코드는 교재를 해석해 사이트 구성을 정하지 않습니다(교재 읽기는 글자·그림·쪽 그림을 AI에게 건네는 데까지).
- 만든 사이트가 실행 중에 부르는 바깥 주소는 버전을 고정한 허용 목록(jsDelivr의 GSAP·Lenis·OGL, 글꼴 CDN)과 강사가 고른 실시간 백엔드뿐입니다. 학교망 대비로 바깥 스크립트는 "실패해도 화면이 깨지지 않게" 씁니다.
- 보조 쪽·키트가 화면에 넣는 모든 문자열은 렌더러에서 **이스케이프**합니다. 링크는 `http:`/`https:`/`mailto:`/`#`만 허용합니다(`util.js` `safeUrl`).

## 2. 사이트 형식과 연수 정보 (약속 A)

AI가 만드는 것은 **사이트 폴더**(`site/index.html`, 그 밖의 쪽, `assets/*`)와 **연수 정보**(`lecpage.json`: 제목·날짜·시간·장소·강사·대상 등) 둘입니다. 형식은 `skills/lecpage/references/kit.md`의 `lecpage.json` 절과 [plan-ai-first.md](plan-ai-first.md) §3이 기준입니다.

- 강사만 정하는 값(참여 기능 연결 `live`의 주소·키·연수 코드, 사이트 주소, 공개 범위)은 AI 결과에서 받지 않습니다. 앱은 프로젝트에, Skill은 `work/lecpage.teacher.json`에 따로 두고 조립 때 `prev`로 넘깁니다.
- 교재는 원본 그대로 + 쪽 그림(`site/material/p-NNN.webp`)으로 건넵니다. 코드가 뽑은 보조 글자는 원본을 건넬 수 없는 교재(PPTX·HWP·HWPX·DOCX의 발표자 노트·그림이 없는 쪽, 키 길에서 원본을 못 보낸 교재)에만 씁니다.
- PDF가 아닌 교재의 쪽 그림은 이 순서로 만듭니다: lecpage 커넥트가 켜져 있으면 그 PC의 PowerPoint·한글·Keynote·Word·LibreOffice로 PDF를 만들어(`scripts/studio-convert.mjs`, `/bridge/convert`) 그 PDF를 원본처럼 건넴 → 없으면 브라우저 안에서 PPTX·DOCX·HWP·HWPX를 그림(`app/src/lib/render-doc.js`: pptx-renderer·docx-preview·snapDOM, 한글은 @rhwp/core. 한글 그리기 도구 본체(WebAssembly 27.9MB)는 배포 한 파일 한도를 넘어 jsDelivr의 고정 판에서 받아 빌드 때 잰 SHA-256과 같을 때만 쓰고, 그래서 앱 CSP에 `'wasm-unsafe-eval'`이 있음) → 그것도 안 되면(예전 형식, 그리기 도구를 못 받은 한글 등) 글자만 보내고 교재 줄에 'PDF로 저장하는 법'을 보여 줌. 그림으로 된 PDF(스캔본)는 경고 없이 원본 그대로 건넵니다(AI가 쪽마다 그림으로 읽음).

## 3. 강의 기능 키트 (약속 B)

사이트는 자리 표시(`data-lp="qa|poll|board|attend|survey|deck|materials|join|share"`, `data-lp-step`)만 넣고, 조립이 실제 기능으로 채웁니다. 목록과 속성은 `references/kit.md`가 기준입니다.

- 키트 위젯은 `.lpk` 안에서만 꾸미고 사이트의 `--lp-accent`·`--lp-ink`·`--lp-paper`·`--lp-font`·`--lp-radius`를 따릅니다(`runtime/kit.css`, 조립이 `assets/kit.css`로).
- 참여 막대(출석·도움 요청·질문·반응)와 '지금' 줄(공지·타이머·투표)은 저절로 붙습니다.
- 보조 쪽(강사·발표·안내문·접속 확인·개인정보)은 사이트 디자인과 따로, 고정 테마 두 가지(밝은 `corporate-clean`, 어두운 `keynote-dark`)에 사이트의 강조색·글꼴을 덮어 그립니다(`kit/aux-build.js`, `design/presets.js`·`tokens.js`).

## 4. 조립·검수 (약속 C)

```js
E.kit.assemble(site, meta, { runtime, preview, target, prev, today, material, materials })
  → { files, warnings, errors, meta, collected, blueprint, csp, report, words, teacher }
E.kit.inspect(files, meta) → issues[]          // 정적 검사
E.kit.inspectRendered({ doc, file }) → issues[] // 그려서 검사(390·1280)
```
- 조립이 하는 일: 인라인 `<script>` → `assets/site.js`, 자리 표시 펼치기, 키트 CSS·런타임·`#lp-data`·`#lp-blueprint`(강사·발표 화면이 읽는 기능 목록), CSP meta·`_headers`, 보조 쪽, 일정 파일(`.ics`), favicon, robots, 쪽 그림 경로 확인, 허용 목록 밖 바깥 스크립트 빼기, 강사 값 지키기.
- 보조 쪽은 연수 정보와 모은 기능(`collected`)으로 보조 쪽 모양(`blueprint`: 이름만 예전과 같고 사람이 쓰는 파일이 아님)을 만들어 `kit/aux-build.js`의 `normAux`·`buildAux`로 그립니다. `lecpage.css`·`aux-pages.css`는 그 사이트의 보조 쪽이 실제로 쓰는 규칙만 남깁니다(`css-prune.js`).
- 검수 결과(`{ id, level, where, message_ko, fix_hint_ko }`)는 사람(앱 화면)과 AI(고치기 요청에 그대로 붙임) 둘 다 읽습니다. Skill은 `lecpage.mjs check work`가 조립 + 정적 검수 + (Playwright가 있으면) 화면 검수를 한 번에 합니다.
- `.lecpage` v2 저장 형식(무압축 ZIP: `project.json { format:'lecpage-project', version:2, kind:'site', … }` + `site/…` + `src/…`)은 `kit/project-v2.js`. 예전(v1) 파일은 `upgradeV1`이 교재·연수 정보만 옮깁니다.

## 5. 실시간(Live) 어댑터 계약

`engine/runtime/live/core.js`가 `window.LecLive`를 만들고, 어댑터가 등록합니다.

```js
LecLive.register('http', function factory(config) { return adapter; });
const live = LecLive.create(config);   // config = 강사 값 live (+ 실행 중 입력한 adminKey)
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
- 강사 화면의 관리자 키 확인은 `useAdminKey(key) → true/false`: 공개 연결을 연 뒤 서버에 한 번만 묻고(틀린 키가 한 번만 세어짐), 맞으면 그 연결에만 씁니다(`setAdminKey`와 달리 저장소에 두지 않음). 키 저장은 강사 화면이 맡음: 이 탭(sessionStorage `lp-admin:<경로>:<코드>`), [이 기기에서 기억하기]를 고르면 localStorage에도, [나가기]가 둘 다 지움. 참가자 화면은 이 키를 읽지 않음.
- 클라이언트가 지키는 규칙(서버 넷도 같은 규칙으로 거절): 한 기기 보내기 속도 `CLIENT_RATE`(넘으면 `rate_limited`, 설정 `throttle:false`면 끔 — 시험·도구용), 강사가 잠근 칸(`ui.lockQa` 새 질문·`ui.lockBoard` 새 보드 글 → `locked` 409, 읽기·쓰기 도우미 `ext.locked`·`ext.lockPatch`), 닫힌 투표(`polls` 문서 `open:false` → `poll_closed`)는 보내기 전에 거절. 대기열에 넣었던 쓰기가 나중에 거절되면 `error` 이벤트(`(err, op)`)와 함께 서버 값으로 다시 맞춤. 받은 문서도 `_maskDoc`이 보이지 않는 글자·방향 바꿈·쌓인 결합 부호를 빼고 길이를 자름. 도우미 `util.hasLink`·`util.linkless`(발표 화면이 주소를 가림)·`util.csvGuard`(받은 CSV를 칸마다 다시 수식 막기).
- 공개 범위: 공개 컬렉션 = questions·posts·polls·answers·chat(+state). 비공개 = participants·attendance·survey·help·progress(관리자만, 참가자 토큰은 **자기 것만** — 도움 요청의 자리·글, 누가 막혔는지는 강사만). answers는 강사가 그 투표 결과를 공개하기 전에는 남의 응답 값을 비우고 `sealed:true`로 내려갑니다(수는 그대로, 신호등 `signal`과 내 응답은 값 그대로). 공개되면 클라이언트(core.js)가 응답을 한 번 다시 읽습니다. questions는 누구에게도 `by`를 주지 않습니다(익명 보장; 내 질문은 클라이언트가 id로 기억). 숨긴 글(questions `status:'hidden'`, posts·chat `hidden:true`)은 비관리자에게 `text:''`(posts는 `files:[]`)로 내려갑니다.
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
- **글 거르기·잠그기(2026-11c, 넷 모두)**: 제어·폭 없는 공백·방향 바꿈·한글 채움(U+3164 등)·태그 문자를 빼고 결합 부호는 한 글자에 둘까지. `state.ui.lockQa`·`lockBoard`가 `true`면 참가자의 새 질문·보드 글을 409 `locked`. CSV 수식 막기는 앞 빈칸·전각 기호(＝＋－＠)도. 아직 없는 연수 코드라도 비공개 모음(명단·출석·설문·도움 요청·실습 진행)은 관리자만(틀린 키가 '빈 명단'으로 통과하지 않게).

## 6. 조립 결과(만든 사이트) 파일
기준은 `engine/src/kit/assemble.js`와 `kit/aux-build.js`입니다.
```
index.html · 그 밖의 쪽   AI가 쓴 참가자 화면(키트 자리 표시가 채워짐)
assets/site.js …         인라인 스크립트를 옮긴 파일(조립이 만든 이름), AI가 쓴 assets/*
screen.html       발표 화면(큰 QR·질문·투표·타이머·도구)
check.html        접속 확인
poster.html       A4 QR 안내문(인쇄용, 참가자 주소·QR만)
console.html      강사 화면(관리자 키 입력). 참여 기능을 쓸 때만
privacy.html      개인정보 처리 안내. 참여 기능을 쓸 때만
_headers          Netlify·Cloudflare용 보안 헤더(강사 화면·발표 화면·안내문 틀 넣기 금지)
robots.txt        access.mode가 public일 때만 Allow, 그 밖에는 Disallow
assets/kit.css · theme.css · lecpage.css · aux-pages.css · boot.js · lecpage.js · screen.js · check.js · qr.js · favicon.svg · event.ics
assets/console.js · live.js      참여 기능을 쓸 때만
assets/unlock.js                 암호 보호(access.mode password)일 때만
assets/slides/*.webp · assets/media/* · assets/files/*
```
- 쪽 머리·CSP는 `render/shell.js`(보조 쪽 `aux-pages.js`가 씀. 참가자 쪽 CSP는 `kit/assemble.js`가 같은 규칙에 AI 쪽 허용 목록을 더해 만듦). CSP `connect-src`는 쪽마다 연결한 참여 기능 서버만(`liveOrigins`: http·바로 배포=그 서버의 https+wss, Supabase=프로젝트 주소, 시트=Apps Script 두 주소, 교실 LAN이면 http+ws), 접속 확인 쪽만 https 전체. LAN이 아니면 `upgrade-insecure-requests`. `_headers`: nosniff·Referrer-Policy·권한 끔(카메라·마이크·위치·결제·USB)·HSTS 1년·검색 제외(`X-Robots-Tag`, 공개 사이트는 강사용 쪽만), 강사·발표 화면·안내문은 틀 넣기 금지, 강사·발표 화면은 COOP(강사 화면이 연 발표 창을 다시 찾을 수 있게 같은 값).
- 보조 쪽은 보조 테마(theme.css·lecpage.css의 `data-*`)와 `assets/aux-pages.css`를 싣습니다. 안내문은 A4 한 장 + 자리 카드 8장(고를 때), 강사 화면 주소·QR은 싣지 않음(참가자 손에 가는 종이). 쪽(`.lp-pst-page`)을 크기 기준(container)으로 cqw 단위라 미리보기와 인쇄가 같은 비율.
- 강사용 파일(`운영안내.md`)은 올리는 사이트에 넣지 않습니다. `assemble()`이 `teacher`로 따로 돌려주고, CLI는 `work/dist-강사용/`에, 앱은 따로 내려받기로 줍니다.
- `access.mode`: `link`(기본, noindex + robots.txt Disallow) · `public` · `password`. `password`면 `protectSite()`가 index·console·screen(있으면 poster) 페이지와 `assets/slides|media/*`를 AES-GCM(PBKDF2-SHA256 60만 회)으로 잠가 `*.enc`로 바꾸고 `assets/unlock.js`를 넣습니다. `check.html`·`privacy.html`은 잠그지 않습니다. 대신 그 두 쪽의 사이트 정보(`lp-data`)에서는 참여 기능 서버 주소·연수 코드·Supabase 키를 빼고(`publicSiteData`), 접속 확인은 서버가 닿는지(`/api/health`)만 봅니다. 주소 끝 `#k=암호`로 자동으로 열립니다.

## 7. 작업 규칙
- 한국어 UI 문구는 짧고 평이하게. 버튼은 동작을 그대로("복사", "완료 체크").
- 접근성: 키보드 조작, 포커스 표시, 대비 4.5:1, `prefers-reduced-motion`, 5초 넘게 움직이면 멈춤 버튼.
- 성능: 참가자 첫 화면이 처음 받는 자기 파일(HTML+CSS+JS, gzip) 200KB 안. `check`의 검수가 크기를 봅니다. QR 코드(`qr.js`)는 공유 창을 열 때 받습니다.
- 테스트: `npm test`(= `node --test "skills/lecpage/engine/test/*.test.mjs"`). CI(`.github/workflows/ci.yml`)는 `npm test` → `npm run examples`(레퍼런스 사이트 조립·검수) → 앱 빌드 → `npm audit`(앱 배포 묶음)를 돌립니다. 브라우저 테스트(`live-browser.test.mjs`)는 Playwright가 있을 때만, Supabase·Cloudflare 테스트는 PostgreSQL·`LEC_CF_URL`이 있을 때만 돌고 없으면 건너뜁니다. 앱 화면 자동 테스트는 아직 없습니다.
- 앱 미리보기 기기 크기: 모니터 1920×1080, 노트북 1536×864, 태블릿 820×1180, 휴대폰 360×780, 맞춤. CLI `check`의 화면 검수는 390·1280으로 봅니다.
- 커밋·푸시는 통합 담당만 합니다. 병렬 작업자는 자기 디렉터리에만 씁니다.

## 8. v1.1에서 더한 계약 (2026-11-11)

### 8.1 올릴 곳 고르기 (`engine/src/decide/infra.js`)
- `HOSTS[id]`: `{ name_ko, cost, app(앱에서 바로 올림), account, limit?: { siteMB, fileMB, files }, cli?, note_ko }`. id: `lecpage`(바로 배포) · `vercel` · `github-pages` · `cloudflare` · `netlify` · `firebase` · `s3` · `server` · `lan` · `zip`. 숫자 근거는 `docs/research/hosting-2026-11.md`.
- `decideHost(input) → { hosts, pick, reasons, warnings }`. 입력: `skill`(`click` 앱 / `set`·`dev` skill), `commercial`, `network`, `infra[]`, `backend`, `previous`(지난번에 올린 곳), `connected[]`(연결해 둔 곳), `instant`(바로 배포를 쓸 수 있음), `keep`, `customDomain`, `siteMB`, `maxFileMB`, `files`. 규칙 순서: 인터넷 없음 → 자체 서버 → 기본(앱 Vercel, skill Cloudflare) → 강사료(Vercel 제외, Cloudflare 먼저) → 내 도메인 → 크기(25MB 넘는 파일이나 파일 수 초과(끌어 놓기 1,000개·명령 20,000개)면 GitHub Pages 먼저, 100MB 넘는 사이트는 Cloudflare 먼저·Vercel 맨 뒤) → 바로 배포 → 지난번에 올린 곳·연결해 둔 곳 먼저.
- `checkHost(host, { bytes, files, maxFile, binaries }) → { ok, errors, warnings }`: 올리기 직전에 그곳의 한도를 확인합니다.
- `TEACHER_STEPS[backend] = { app, skill }`: 참여 기능마다 강사가 직접 할 일 수(어림, 근거는 파일 주석). `decideInfra`는 skill(`set`·`dev`)에서 시트·Supabase가 나오면 이 수로 다시 견줘 가장 적은 곳(보통 Cloudflare 중계, 연결해 둔 곳은 0)을 고르고, 결과에 `teacherSteps`를 담습니다. 앱(`click`)은 같은 함수를 쓰고 순서는 L08·L09 그대로입니다.
- CLI `publish work [--live]`(`skills/lecpage/scripts/publish.mjs`): Cloudflare에 사이트와 중계를 함께 올림. 중계는 `work/live-relay`(백엔드 복사, `ALLOWED_CODES`=연수 코드), 관리자 키는 `work/dist-강사용/관리자-키.txt`만, 사이트는 강사 값(`work/lecpage.teacher.json`) `live`로 다시 조립, 마지막에 `ALLOWED_ORIGINS`=사이트 주소. `handouts <주소>`는 `poster.html`·`screen.html`을 PDF·PNG로.

### 8.2 앱의 배포하기 (`app/src/lib/deploy.js`, `app/src/components/Publish.jsx`)
- 흐름: 사이트 만들기(`buildFiles`) → `checkHost` → 올리기 → 주소 저장 → `probeSite`(사이트의 `assets/favicon.svg`를 그림으로 불러 실제로 열리는지 확인).
- Vercel(`deployVercel`): `GET /v9/projects?limit=1`(토큰 확인) → 같은 이름 프로젝트가 있으면 중단 → 파일별 SHA-1로 `POST /v13/deployments` → `missing_files`면 그 파일만 `POST /v2/files`(`x-vercel-digest`) → 다시 요청 → `GET /v13/deployments/{id}`로 READY 대기 → 새 프로젝트에 `ssoProtection`이 걸려 있으면 `PATCH /v9/projects/{id} {ssoProtection:null}` → 프로젝트 주소(`<이름>.vercel.app`)를 돌려줌. `_headers`는 `vercel.json`의 `headers`로 옮깁니다. 배포별 주소는 쓰지 않습니다.
- GitHub Pages(`deployGitHub`)·Netlify(`deployNetlify`)는 v1.0과 같습니다. 토큰은 연결할 때 확인한 뒤 저장합니다(`deploy-<kind>` 키, '기억하기'를 켜면 WebCrypto로 암호화).
- 바로 배포(`deployInstant`, 선택): 서버 주소가 있고(빌드 변수 `VITE_PUBLISH_API`, 없으면 운영자 앱 주소에서만 운영 서버: `app/src/lib/publish-api.js`) `GET /api/info`가 답할 때만 보입니다. 배포 화면을 열 때 `instantGate`가 `info.capacity`(붐빔 단계)로 바로 배포를 쓸지 정하고, 붐비거나 찼으면 같은 파일 그대로 강사 계정에 배포하는 길로 넘깁니다. `deployInstant`는 기기 표(`device`)와 `caps: ['split']`을 보내고, 그날 참여 기능 방이 찼다는 답(`live.ok === false`)이면 참여 기능을 뺀 파일로 다시 빌드해 사이트만 바로 배포하고 참여 기능은 강사 계정(Cloudflare·Supabase)으로 연결하게 합니다. API 계약은 `hosting/README.md`.
- 프로젝트에 남는 값: `deploy = { target, lastUrl, at, sites:{ <곳>:{url,at} }, vercel:{projectId,name,url}, github:{repo,url}, netlify:{siteId,url,name}, lecpage:{id,key,url,expiresAt}, cloudflare|zip:{url} }`. 배포한 곳마다 주소를 `sites`에 두고, `target`·`lastUrl`은 참가자에게 알릴 대표 주소예요(다른 곳에 다시 배포해도 대표는 그대로, 새로 배포한 곳은 대표가 됨, 화면의 [대표 주소로 쓰기]로 바꿈. QR·강사 화면·QR 안내문이 이 주소를 따름). `.lecpage` 파일로 내보낼 때 `deploy`는 넣지 않습니다.
- `.lecpage` 파일(무압축 ZIP: `project.json` + 자료)의 규칙은 `engine/src/project-file.js` 하나를 앱(`importProjectFile`·`exportProjectFile`)과 skill(`lecpage.mjs app`)이 함께 씁니다. 받는 자료는 `assets/slides|media`(그림·문서)·`assets/files`(자료실, `USER_ASSET`과 같은 규칙)·`src/`(교재 원본)뿐이고, 여는 쪽이 `sanitizeImported`로 실시간 연결·QR 주소를 다시 비웁니다. skill이 만든 파일은 비밀 값(관리자 키·참여 기능 키·사이트 암호)·접속 주소·내 컴퓨터 경로를 담지 않고, `project.origin: 'skill'`로 앱이 첫 안내를 보입니다.

### 8.3 AI로 사이트 만들기 (`app/src/lib/gen/*`)
- 생성 과정과 화면과의 약속은 [plan-ai-first.md](plan-ai-first.md) §6·§15. `live.url`·`live.code`·`live.anonKey`·사이트 주소 등 강사만 정하는 값은 AI 결과에서 받지 않습니다.
- 연결(`AiConnect`): 추천 순서는 구독 계정(lecpage 커넥트: ChatGPT 로그인·Claude Code) → 접힌 '다른 방법'(키 붙여넣기: Claude·OpenAI. 회사 자동 인식, `checkKey`, Codex, Skill). 길마다 처음 연결할 때 한 번 동의를 받아요(`askConsent`). Gemini·OpenRouter 키는 만들기에 쓰지 않습니다(붙여 넣으면 알려 주고 다른 회사로 보내지 않음). 설정의 '연결'에서 미리 해 둘 수 있습니다.
- AI 회사 호출(키 확인·모델 고르기는 `app/src/lib/ai.js`, 생성은 `app/src/lib/gen/providers/*`가 같은 규칙을 씀): 모델은 회사의 목록 API와 OpenRouter 공개 목록의 값·출시일로 고르고 이름을 코드에 박지 않습니다. 오류는 상태 코드와 회사별 오류 코드(code·type·details.error_code)·문구로 가립니다(`classify`). 회사별 사실과 출처는 `docs/research/ai-facts-2026-11-14.md`.
- 모델 값표(`app/src/lib/ai-catalog.js`, 등급·추천 규칙 `rankModels`도 여기): 같은 출처의 `ai-catalog.json`(GitHub Actions가 하루 한 번 `scripts/ai-catalog/refresh.mjs`로 모아 이 파일만 커밋, 검사에 걸리면 그대로) → OpenRouter 실시간 목록이 오면 덮어씀 → 둘 다 없으면 이름 규칙. 값표에는 만들기에 쓰는 두 회사(OpenAI·Claude) 모델만 담고, 이 키로 안 된 모델은 기억해 잠금(`markBlocked`). 어긋난 사실(문서의 모델 이름·주소·CORS)은 자동으로 고치지 않고 이슈로 알림(`docs/operations.md` §12).

### 8.5 자료 올리기 (2026-11-11)
- 자료 파일: 앱이 `assets/files/<이름>`으로 이 브라우저에 두고(자료실 항목의 `href`), 배포할 때만 사이트에 넣습니다. 엔진의 `USER_ASSET`이 `slides|media|files` 폴더와 문서·그림·소리·영상·압축 형식만 받습니다(스크립트·SVG·HTML 금지). 자료실에서 뺀 파일은 다음 배포 때 빠집니다.
- 연수 중 자료 링크: 강사 화면에서 `setState({ ui: { m1…m8: '<https 주소> <이름>' } })`. 서버가 원래 받는 `state.ui`(글 200자, 키 20개)에 담아 백엔드를 바꾸지 않고 다섯 가지 연결 방식에서 모두 동작합니다. 읽기·쓰기는 `LecLive.util.ext.materials / materialAdd / materialRemove`, 참가자 화면은 자료실 아래(없으면 마무리 앞)에 보여 줍니다. https 주소만 받습니다.
- 바로 배포 + 참여 기능: 운영자 서버가 `info.live`를 알리면 앱은 배포할 때 `POST /api/sites/:id/live { code, adminKeyHash, settings }`로 방을 만들고 강사 값 `live`를 `{ provider: 'http', url }`로 맞춥니다. 관리자 키는 앱이 만들어 이 브라우저에만 두고 서버에는 해시만 보냅니다. 개인정보 안내(`privacy.processors`)에 그 서버가 적힙니다.

### 8.6 바로 배포 서버 (`hosting/`, 선택)
운영자가 배포했을 때만 쓰이는 Cloudflare Worker입니다(Durable Objects SQLite, R2·KV 없음). 운영 안내와 전체 계약은 `hosting/README.md`.
- 사이트: `POST /api/sites` → `{id, key, url, expiresAt}` · `POST /api/sites/:id/deploys {files:{경로:{sha256,size}}}` → `{deploy, missing[]}` · `PUT /api/sites/:id/blobs/:sha256` · `POST /api/sites/:id/deploys/:deploy/publish` · `DELETE /api/sites/:id`. 수정 키는 한 번만 내려 주고 해시로 보관합니다.
- 참여 기능: `POST /api/sites/:id/live {code, adminKeyHash, settings}` → `{url, code}`. 방은 `skills/lecpage/backends/cloudflare`의 Room을 그대로 불러 `/live` 아래에 붙였고, 사이트에 묶인 코드만 살아 있습니다. 코드가 다른 사이트와 겹치면 `409 code_taken`(앱이 새 코드로 다시 올림). 사이트가 지워지거나 보관 기간이 끝나면 방과 올린 파일도 지워집니다.
- 안전: 올린 `.js`가 엔진 런타임 파일(또는 그 묶음)과 같으면 런타임, 아니면 사이트가 직접 쓴 스크립트입니다. 사이트 스크립트는 사이트마다 출처가 갈리는 Pages 보기에서만 검사해 받고(worker 보기는 `script_not_allowed`, 런타임을 손댄 것은 `runtime_mismatch`), 모든 사이트가 같이 쓰는 호스트 주소(`/s/<id>/`)로는 내보내지 않습니다. 비밀번호 칸·로그인 흉내·바깥으로 보내는 양식·서비스 워커 등은 올릴 때 `422 unsafe_site`(`src/sitecheck.js`). HTML에는 서버가 정한 CSP를 붙입니다: 사이트 쪽은 `script-src 'self'`+고정 라이브러리, `connect-src`는 그 사이트의 실시간 방 경로만, 보조 쪽(강사·발표·안내문·접속 확인·개인정보)은 예전 규칙. HTML의 `meta refresh`·`base`·바깥 스크립트(고정 라이브러리 제외)는 빼고 보냅니다. 받는 파일 형식은 엔진의 `USER_ASSET`과 같습니다(테스트가 어긋남을 잡음). 자세히 `hosting/README.md` §6.
- 한도(기본): 사이트 40MB·파일 20MB·600개, 보관 기간은 마지막으로 배포한 날부터 30일(Pages 보기 60일. worker 보기는 방문이 있으면 늘어남, 처음 만든 날부터 1년까지), 방 올리기 10MB·방마다 200MB, 새 사이트는 기기 표마다 하루 3개(유료 10, 다시 배포는 세지 않음. 기기 표가 없으면 IP당 시간 6·하루 20).
- 붐빌 때(`src/fair.js`): 단계 `open`·`tight`(연수 날짜가 14일 안인 것만)·`full`(새 사이트·새 방은 같은 파일 그대로 강사 계정으로, `next`·`liveNext`)·`paused`. 앱이 `caps: ['split']`을 보내면 그날 참여 기능 방이 차도 사이트는 받고 참여 기능만 넘깁니다(`live.ok: false`). 오늘 연수·이미 배포한 사이트·다시 배포는 단계와 상관없이 됩니다(`paused`만 다시 배포를 멈춤).
