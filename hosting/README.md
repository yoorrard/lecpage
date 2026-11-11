# lecpage 바로 공개 호스트 (선택)

앱에서 [공개하기]를 누르면 가입·토큰 없이 몇 초 만에 주소가 나오게 해 주는 서버입니다. lecpage 운영자가 **직접 배포했을 때만** 켜지고, 배포하지 않으면 앱에 이 버튼이 보이지 않습니다.

- Cloudflare Worker 하나 + Durable Objects(SQLite 저장). R2·KV를 쓰지 않아 **무료 요금제, 카드 등록 없이** 돕니다.
- 사이트는 `https://<호스트>/s/<id>/`로 열리고, **공개 기간**(마지막으로 올린 날부터 30일)이 지나면 파일까지 지워집니다.
- 사이트에 딸린 실시간 방(질문·보드·투표)도 같은 서버가 맡습니다. 강사가 따로 준비할 것이 없습니다(§7, 끄려면 `LIVE=off`).
- 조사와 결정 배경: [`docs/research/hosting-2026-11.md`](../docs/research/hosting-2026-11.md) §7.3–7.4, [`docs/operations.md`](../docs/operations.md) §2·§10.

## 1. 켜기 전에: 운영자가 지게 되는 일

법률 자문이 아닙니다. 켜기 전에 원문을 확인하세요.

| 무엇 | 근거 | 운영자가 할 일 |
|---|---|---|
| 권리 침해 신고(명예훼손·사생활 등) | 정보통신망법 제44조의2 | 신고가 오면 지체 없이 지우거나 **임시조치**(30일 안에서 가려 둠)하고, 신고인과 올린 사람에게 알립니다. 올린 사람의 연락처는 받지 않으므로, 가려진 주소에 뜨는 안내 화면이 알림을 대신합니다. 처리 절차는 호스트 첫 화면(`/`)에 적혀 있습니다. |
| 저작권 침해 신고 | 저작권법 제102조·제103조 | 중단 요구를 받을 창구를 공지하고(신고 화면 `/report`), 요구가 오면 바로 내린 뒤 권리 주장자에게 알립니다. 올린 사람이 소명하면 다시 엽니다. 미리 감시할 의무는 없습니다. |
| 맡게 되는 자료 | 개인정보 보호법 | 사이트 파일(교재 그림, 사진)과 실시간 방 자료(참가자 별명, 질문, 보드에 올린 파일)를 공개 기간 동안 보관합니다. 강사가 모은 자료를 강사를 대신해 보관·처리하는 자리입니다. 기간이 끝나면 자동으로 지우고, 그 전에는 강사가 [지금 내리기]로 지울 수 있습니다. 운영자는 신고를 처리할 때 말고는 열어 보지 않습니다. |
| 앱과 **다른 등록 도메인** | — | 앱은 사용자의 AI 키를 자기 출처에 보관합니다. 남이 올린 HTML을 같은 출처에 두면 그 키가 위험하고, 피싱 신고 한 건으로 앱 도메인까지 브라우저 경고에 걸릴 수 있습니다. `workers.dev` 주소로 시작해도 되지만 앱 도메인의 하위 도메인은 쓰지 마세요. |
| 창구 지키기 | — | 신고를 볼 사람과 주기(`REPORT_WEBHOOK`을 걸어 두면 메신저로 옵니다). Cloudflare 계정은 2단계 인증. |

## 2. 처음 한 번

```bash
cd hosting
npm install
npx wrangler login                 # 운영용 Cloudflare 계정
npm run deploy                     # https://lecpage-sites.<계정>.workers.dev 가 나옵니다

# 관리자 열쇠(신고 목록 보기, 가리기, 지우기). 넣지 않으면 관리 주소는 404입니다.
ADMIN_KEY=$(openssl rand -hex 32); echo "$ADMIN_KEY"     # 안전한 곳에 적어 둡니다
printf '%s' "$ADMIN_KEY" | npx wrangler secret put ADMIN_KEY

# (선택) 신고가 오면 알림 받기: Slack·Discord 웹훅 주소
npx wrangler secret put REPORT_WEBHOOK
```

- **앱 주소 허용**: [`wrangler.jsonc`](wrangler.jsonc)의 `ALLOWED_ORIGINS`에 앱 주소를 쉼표로 적고 다시 `npm run deploy`. 기본값은 GitHub Pages 미러와 로컬 개발 주소입니다. 앱을 `https://lecpage.com`에 올렸다면 그 주소를 더합니다.
- **내 도메인**: 대시보드 → Worker → Settings → Domains & Routes → Custom domain. 붙인 뒤 `PUBLIC_ORIGIN`에 그 주소를 적으면 돌려주는 주소가 고정됩니다.
- 확인: `curl https://<호스트>/api/info` → `{"ok":true,…}`
- 자동 배포를 원하면 Workers Builds에 연결합니다. Root directory `hosting`, Deploy command `npm ci && npm run deploy`, 감시 경로 `hosting/*`, `skills/lecpage/engine/runtime/*`, `skills/lecpage/engine/src/build.js`, `skills/lecpage/backends/cloudflare/src/*`.

### 앱에 연결

앱을 빌드할 때 `VITE_PUBLISH_API=https://<호스트>`를 넣습니다. 비어 있으면 앱에 "바로 공개"가 보이지 않습니다.

| 앱을 올리는 곳 | 넣는 곳 |
|---|---|
| GitHub Pages 미러 | 저장소 Settings → Secrets and variables → Actions → **Variables** → `LECPAGE_PUBLISH_API` |
| Cloudflare(Workers Builds) | Worker → Settings → Build → Variables → `VITE_PUBLISH_API` |

## 3. 신고가 들어오면

신고는 사이트 바닥글의 "신고" 링크나 `https://<호스트>/report`로 들어옵니다. 90일 뒤 지워집니다.

```bash
H=https://<호스트>; A="authorization: Bearer $ADMIN_KEY"

curl -s -H "$A" $H/api/admin/reports                     # 신고 목록(새것부터)
curl -s -H "$A" $H/api/admin/sites                       # 사이트 목록, 저장량

# 확인하는 동안 가리기(사이트는 451 안내 화면, 딸린 실시간 방도 닫힘). 풀 때는 false
curl -s -X POST -H "$A" -H 'content-type: application/json' \
  -d '{"blocked":true,"reason":"저작권 신고 확인 중"}' $H/api/admin/sites/<id>/block

curl -s -X DELETE -H "$A" $H/api/admin/sites/<id>         # 지우기(파일·실시간 방까지, 되돌릴 수 없음)
```

가려 둔 사이트도 공개 기간이 끝나면 지워집니다. 가린 날부터 30일을 넘기지 않게 그 안에 풀거나 지우세요.

## 4. 한도와 비용

모두 `wrangler.jsonc`의 `vars`(또는 대시보드 변수)로 바꿉니다.

| 변수 | 기본 | 뜻 |
|---|---|---|
| `MAX_BYTES` / `MAX_FILE_BYTES` / `MAX_FILES` | 40MB / 20MB / 600 | 사이트 하나, 파일 하나, 파일 수 |
| `PLAN` | `free` | 요금제. `paid`로 두면 아래 `DAILY_*` 기본값이 300 / 300 / 0(예산 끔)으로 바뀝니다. Workers Paid로 올린 뒤에 바꾸세요 |
| `SITE_DAYS` / `KEEP_ALIVE` / `MAX_SITE_DAYS` | 30 / on / 365 | 공개 기간. 다시 올리면 그날부터 다시 세고, 화면을 여는 방문이 있으면(남은 기간이 절반 아래일 때) 다시 채웁니다. 처음 만든 날부터 365일이 지나면 방문으로는 늘지 않습니다 |
| `DAILY_REQUEST_BUDGET` | 100000 | 하루 요청 예산(무료 요금제 한도). 60%를 쓰면 새 사이트·새 방을 받지 않고(`rate_limited`), 남은 몫은 이미 올라온 사이트의 방문에 씁니다. `/api/info`의 `accepting`이 false가 되고 앱은 '내 계정에 올리기'로 안내합니다. 0이면 끔 |
| `SITES_PER_HOUR` / `SITES_PER_DAY` | 6 / 20 | 같은 IP에서 새 사이트(학교는 IP 하나를 같이 씁니다) |
| `DAILY_SITE_CAP` / `DAILY_ROOM_CAP` | 30 / 30 (`paid`: 300 / 300) | 하루에 새로 만드는 사이트, 실시간 방(전체). 차면 API가 `rate_limited`(저장 공간이 차면 `full`)로 답하고 앱은 '내 계정에 올리기'로 안내합니다 |
| `MAX_TOTAL_BYTES` | 4GB | 전체 저장량(사이트 + 실시간 방). 넘으면 새로 받지 않습니다(`full`) |
| `DEPLOYS_PER_HOUR` | 30 | 사이트 하나를 다시 올리는 횟수 |
| `REPORTS_PER_HOUR` / `DAILY_REPORT_CAP` / `REPORT_KEEP` / `REPORT_DAYS` | 5 / 200 / 500 / 90 | 신고: IP당, 하루 전체, 보관 수, 보관일 |
| `LIVE` / `LIVE_UPLOADS` | on / on | 실시간 방, 보드 파일 올리기 |
| `LIVE_MAX_UPLOAD_MB` / `LIVE_ROOM_MB` | 10 / 200 | 보드 파일 하나, 방 하나의 파일 합계 |
| `LIVE_MAX_PARTICIPANTS` / `LIVE_SOCKETS_PER_IP` | 300 / 500 | 방 하나의 참가자, 한 IP의 실시간 연결 |
| `ALLOWED_ORIGINS` | Pages 미러, localhost | 이 서버를 부를 수 있는 앱 주소 |
| `PUBLIC_ORIGIN` | (요청 주소) | 내 도메인을 붙였을 때 돌려줄 주소 |
| `ALLOW_SUPABASE_SDK` | (꺼짐) | §6 참고 |
| 비밀 `ADMIN_KEY`, `REPORT_WEBHOOK` | | 관리자 열쇠, 신고 알림 주소 |

**무료 요금제에서 어디까지 되나** (하루 한도는 한국 시간 오전 9시에 초기화)

| 한도 | 이 서버에서 쓰이는 곳 | 어림 |
|---|---|---|
| Worker 요청 10만/일 | 사이트 파일 하나 = 요청 하나, API, 실시간 방의 쓰기·읽기. 안내·신고 화면은 세지 않음 | 40명 연수 한 번에 2천~1만 2천(교재 그림이 많을수록 많음) → 하루 8~40회 |
| DO 저장 5GB | 사이트 파일, 방 자료 | 기본 상한 4GB = 40MB 사이트 100개, 보통(0.5MB) 사이트는 수천 개 |
| DO 쓰기 10만 행/일 | 올리는 파일 하나에 한 줄쯤, 참가자 글 하나에 4~6줄 | 150파일 사이트 500번, 또는 40명 실시간 연수 15~20회 |
| DO 읽기 500만 행/일 | 파일 요청 하나에 1~2줄 | 요청 한도가 먼저 찹니다 |
| CPU 10ms/요청 | Worker는 길만 정하고 검사·저장은 Durable Object가 합니다 | — |

- 한도에 닿으면 과금되지 않고 **그날 남은 시간 동안 오류**가 납니다. 요청 한도면 올라온 사이트도 열리지 않습니다(오류 1027). 쓰기 한도면 새로 올리기와 실시간 참여가 실패하고, 이미 올라온 사이트는 열립니다. 저장량이 차면 API가 `full`로 답합니다.
- WebSocket이 막힌 학교망에서는 실시간 방이 5초마다 묻는 방식으로 바뀝니다. 50명이 2시간이면 4~7만 요청이라 그것만으로 하루 한도에 가깝습니다.
- 누군가 일부러 두드리면 한도가 먼저 소진됩니다. 내 도메인을 붙였다면 대시보드의 WAF 속도 제한 규칙(무료 1개)을 `/s/*`, `/api/*`에 걸어 두세요.
- **멈추지 않게 하려면 Workers Paid(월 $5 정액)**: 무료 요금제는 하루 한도에 닿으면 그날 올라온 사이트가 모두 멈춥니다(강사에게 가장 나쁜 일). 여러 강사에게 열어 둘 서버라면 처음부터 Workers Paid로 올리고 `PLAN=paid`로 두세요. 월 1,000만 요청과 5,000만 행 쓰기가 포함되고, 넘는 만큼만 100만 요청당 $0.30, 저장은 5GB 뒤 GB당 $0.20입니다(40명 연수 1,000번쯤이 포함분 안). `MAX_TOTAL_BYTES`도 그때 올립니다. 무료로 둘 때는 `PLAN=free` 그대로: 예산의 60%에서 새 사이트를 받지 않고, 앱은 바로 공개를 첫째로 권하지 않으며 '본 연수는 내 계정에'라고 안내합니다.

## 5. 끄기

- **새로 받지만 않기**: 앱 빌드 변수(`LECPAGE_PUBLISH_API`, `VITE_PUBLISH_API`)를 비우고 앱을 다시 배포합니다. 이미 올라온 사이트는 공개 기간까지 열려 있다가 지워집니다. 서버에서도 막으려면 `DAILY_SITE_CAP`을 1로 낮춥니다.
- **실시간 방만 끄기**: `LIVE=off`로 다시 배포. `/api/info`에서 `live`가 빠지고 `/live`는 404가 됩니다. 이미 있던 방 자료는 사이트가 지워질 때 함께 지워집니다.
- **완전히 내리기**: `npx wrangler delete`. Worker와 Durable Object에 담긴 모든 사이트·방·신고가 지워집니다. 강사들에게 미리 알리세요.

## 6. 안전장치

모든 사이트가 한 출처(`/s/<id>/`)를 같이 쓰므로, **올린 사람이 쓴 스크립트는 절대 돌지 않게** 두 겹으로 막습니다.

1. **받을 때**: `.js`는 내용이 lecpage 엔진 런타임(`skills/lecpage/engine/runtime`) 파일 그대로이거나, 그 파일들을 `\n;\n`로 이은 것일 때만 받습니다. `scripts/gen-runtime.mjs`가 런타임 조각마다 길이·앞머리·SHA-256을 뽑아 `src/runtime-allow.js`를 만들고(배포·시험 때마다), 서버는 올라온 내용을 앞에서부터 조각으로 나눠 해시를 맞춰 봅니다. 올릴 때 한 번, 공개할 때 한 번 더 봅니다. 다르면 `runtime_mismatch`.
2. **내보낼 때**: 모든 HTML에 서버가 정한 CSP를 붙입니다(`script-src 'self'`, `form-action 'none'`, `base-uri 'none'`, `frame-src 'none'` …). 올라온 `_headers`는 쓰지 않습니다. 형식은 확장자 표로만 정하고 `nosniff`를 붙여, `.js`가 아닌 파일은 스크립트로 읽히지 않습니다. SVG는 가둔(sandbox) 채로 내보냅니다.
3. HTML은 내보내면서 `<meta http-equiv="refresh">`, `<base>`, `<object>`, `<embed>`, 바깥 주소의 `<script>`를 빼고 "신고" 링크를 붙입니다.
4. 사이트 주소는 무작위 10자, 수정 열쇠는 무작위 32바이트이고 서버에는 해시만 둡니다. 없는 주소를 두드려도 저장소에는 아무것도 생기지 않습니다.

**앱과 서버의 버전이 다를 때**: 엔진 런타임이 바뀌면 서버를 다시 배포해야 새 앱이 올릴 수 있습니다(같은 저장소에서 같이 배포하면 됩니다). 서버가 먼저 바뀌면, 예전 앱을 띄워 둔 사람은 `runtime_mismatch`를 받고 앱이 "새로 고친 뒤 다시"라고 안내합니다. 이 틈을 없애려면 런타임을 고치기 **전에** `npm run runtime:keep`을 실행해 `runtime-history.json`을 커밋해 두세요. 거기 적힌 예전 판도 받습니다. 보안 문제로 막아야 하는 판은 그 파일에서 지웁니다.

**알아 둘 것**
- CDN에서 라이브러리를 받는 효과 셋(Lenis 부드러운 스크롤, GSAP, OGL)은 CSP에 막혀 기본 동작으로 돌아갑니다. 화면은 깨지지 않습니다.
- **Supabase 실시간**을 쓰는 사이트는 `supabase-js`를 CDN에서 받으므로 기본 설정에서는 연결되지 않습니다. 받아 주려면 `ALLOW_SUPABASE_SDK="1"`: 엔진이 버전까지 고정한 그 파일 하나만 CSP에 더합니다. 이 서버의 실시간 방이나 구글 시트 연결은 그대로 됩니다.
- 암호로 잠근 사이트는 내용이 암호문이라 서버가 3번(HTML 손보기)을 할 수 없습니다. 스크립트는 CSP가 그대로 막지만, 풀린 화면에는 신고 링크가 없습니다(잠금 화면에는 있습니다).
- 브라우저 저장소(localStorage 등)는 이 호스트의 모든 사이트가 같이 씁니다. 돌 수 있는 스크립트가 엔진 런타임뿐이라 남의 사이트가 마음대로 읽어 갈 수는 없지만, 완전히 나누려면 사이트마다 하위 도메인을 주는 구조로 바꿔야 합니다.

## 7. 실시간 방

`skills/lecpage/backends/cloudflare`의 실시간 서버(HTTP 프로토콜 v1, WebSocket)를 **그대로 가져와** `/live` 아래에 얹었습니다. 사이트는 `live.provider = "http"`, `live.url = "https://<호스트>/live"`로 같은 출처의 방을 씁니다.

- 방은 사이트를 공개할 때 앱이 `POST /api/sites/<id>/live`로 등록합니다(사이트 수정 열쇠로 확인). 등록되지 않은 코드는 404이고 저장소에 아무것도 만들지 않습니다. 설정 토큰은 서버 안에서만 쓰고 밖으로 나가지 않습니다.
- 연수 코드는 호스트 전체에서 하나뿐입니다. 다른 사이트가 쓰는 코드면 `code_taken`(앱이 다른 코드를 고릅니다).
- 강사 화면의 관리자 키는 강사만 압니다(서버에는 해시). 운영자의 `ADMIN_KEY`로는 방을 열 수 없습니다.
- 보드 파일은 R2 없이 방의 SQLite에 1MiB씩 나눠 담습니다(`src/live/bucket.js`). 형식은 내용으로 가려 그림·PDF·MP3·MP4만 받습니다. R2에 두려면 `wrangler.jsonc`의 `r2_buckets` 주석을 풉니다(카드 등록 필요).
- 사이트를 가리면 방도 닫히고, 사이트를 지우거나 공개 기간이 끝나면 방과 올린 파일도 지워집니다. 방 자료는 사이트보다 오래 남지 않습니다.
- 방이 쓰는 저장량도 `MAX_TOTAL_BYTES`에 들어갑니다.
- 보드 파일의 주소는 규칙상 `/api/<코드>/files/<이름>`이라, 이 주소만 `/live` 없이도 받습니다.

## 8. API

오류는 언제나 `{ "error": { "code", "message_ko" } }`. 코드: `bad_request` `unauthorized` `not_found` `too_large` `too_many_files` `bad_path` `bad_type` `runtime_mismatch` `rate_limited` `full` `blocked` `missing_blobs` `code_taken`.
CORS는 `ALLOWED_ORIGINS`의 출처만. 브라우저가 다른 출처에서 보낸 요청은 403입니다.

| 요청 | 답 |
|---|---|
| `GET /api/info` | `{ ok, v: 1, limits: { maxBytes, maxFileBytes, maxFiles, days }, report, live?: { url, uploads, maxUploadMb } }` |
| `POST /api/sites` `{ title? }` | `201 { id, key, url, expiresAt }` · `expiresAt`은 밀리초 숫자 · `key`는 이때 한 번만 |
| `POST /api/sites/:id/deploys` `{ files: { "<경로>": { sha256, size } } }` | `{ deploy, missing: [sha256…] }` |
| `PUT /api/sites/:id/blobs/:sha256` (본문 = 파일) | `204` |
| `POST /api/sites/:id/deploys/:deploy/publish` | `{ url, expiresAt }` · 덜 올렸으면 `409 missing_blobs`(+`missing`) |
| `POST /api/sites/:id/live` `{ code, adminKeyHash, settings?: { retentionDays?, uploads?, moderation? } }` | `{ url: "<호스트>/live", code }` |
| `DELETE /api/sites/:id` | `204` |
| `POST /api/report` `{ site, reason, contact? }` | `{ ok: true }` |
| `GET /api/admin/reports` · `GET /api/admin/sites` · `POST /api/admin/sites/:id/block` `{ blocked, reason? }` · `DELETE /api/admin/sites/:id` | `Authorization: Bearer <ADMIN_KEY>` |
| `GET /s/:id/…` | 사이트 파일 · 기간 끝·지움 404 · 가림 451 |
| `/live/api/<코드>/…` | 실시간 방(HTTP 프로토콜 v1) |

사이트를 고치는 요청에는 `Authorization: Bearer <key>`가 필요합니다. 받는 형식: html css js(런타임만) json webmanifest txt svg png jpg jpeg webp avif gif ico woff2 pdf mp3 m4a mp4 webm, 내려받기 전용 ppt pptx ppsx doc docx xls xlsx hwp hwpx key pages numbers odt odp ods csv md zip, 암호 사이트의 `*.enc`.

## 9. 시험

```bash
cd hosting
npm test                  # 단위 시험 + 통합 시험(로컬 workerd에 실제 엔진 사이트를 올려 봄). workerd를 못 띄우면 통합 시험만 건너뜁니다
npm run check             # wrangler deploy --dry-run (묶음만 만들어 봄)
npm run dev               # http://localhost:8787
```
