# lecpage 바로 공개 호스트 (선택)

앱에서 [공개하기]를 누르면 가입·토큰 없이 몇 초 만에 주소가 나오게 해 주는 서버입니다. lecpage 운영자가 **직접 배포했을 때만** 켜지고, 배포하지 않으면 앱에 이 버튼이 보이지 않습니다.

- **켜기: `cd hosting && npm run setup` 한 번**(§2). 토큰 하나를 만들고 운영자 이메일과 (선택) 알림 웹훅만 답하면 배포·비밀 값·사이트 보기·관리 화면까지 켭니다. 다시 돌려도 안전합니다.
- Cloudflare Worker + Durable Objects(SQLite) + (기본) Cloudflare Pages. R2·KV를 쓰지 않아 **무료 요금제, 카드 등록 없이** 돕니다(관리 화면에 쓰는 Zero Trust 첫 가입만 결제 수단 입력, 청구 없음).
- **사이트 보기(`VIEW`)**
  - `pages`(설정 스크립트의 기본): 사이트마다 `https://s-<id>.<프로젝트>.pages.dev/`. 방문은 Pages 정적 요청이라 **Workers 하루 10만 요청에 들지 않아 하루 한도로 사이트가 멈추지 않고**, 사이트마다 출처가 갈립니다. 공개 기간은 **마지막으로 올린 날부터 60일**(방문으로는 늘지 않음).
  - `worker`: 예전 방식. `https://<호스트>/s/<id>/`, 공개 기간 30일이고 방문이 있으면 다시 채움. 방문 하나하나가 하루 한도에 듭니다.
- 사이트에 딸린 실시간 방(질문·보드·투표)은 어느 보기든 이 Worker의 Durable Object가 맡습니다. 강사가 따로 준비할 것이 없습니다(§7, 끄려면 `LIVE=off`).
- 운영자 관리 화면은 **따로 작은 관리 Worker**(`lecpage-admin`)의 workers.dev 주소. 도메인 없이 Cloudflare Access가 운영자 이메일만 들여보냅니다(§11).
- 연수 날짜·인원을 미리 받아 그날 자리가 차면 **만들 때** 알려 줍니다(§4 수용량). 학교망 대비는 §12.
- 조사와 결정 배경: [`docs/research/hosting-2026-11.md`](../docs/research/hosting-2026-11.md) §7.3–7.4, [`docs/research/admin-2026-11.md`](../docs/research/admin-2026-11.md)(관리 화면·무료로 안전하게 열기·보안 검토), [`docs/research/hosting-setup-2026-11.md`](../docs/research/hosting-setup-2026-11.md)(명령 한 번 설정·Pages 보기·수용량·학교망), [`docs/operations.md`](../docs/operations.md) §2·§10.

## 1. 켜기 전에: 운영자가 지게 되는 일

법률 자문이 아닙니다. 켜기 전에 원문을 확인하세요.

| 무엇 | 근거 | 운영자가 할 일 |
|---|---|---|
| 권리 침해 신고(명예훼손·사생활 등) | 정보통신망법 제44조의2 | 신고가 오면 지체 없이 지우거나 **임시조치**(30일 안에서 가려 둠)하고, 신고인과 올린 사람에게 알립니다. 올린 사람의 연락처는 받지 않으므로, 가려진 주소에 뜨는 안내 화면이 알림을 대신합니다. 처리 절차는 호스트 첫 화면(`/`)에 적혀 있습니다. |
| 저작권 침해 신고 | 저작권법 제102조·제103조 | 중단 요구를 받을 창구를 공지하고(신고 화면 `/report`), 요구가 오면 바로 내린 뒤 권리 주장자에게 알립니다. 올린 사람이 소명하면 다시 엽니다. 미리 감시할 의무는 없습니다. |
| 맡게 되는 자료 | 개인정보 보호법 | 사이트 파일(교재 그림, 사진)과 실시간 방 자료(참가자 별명, 질문, 보드에 올린 파일)를 공개 기간 동안 보관합니다. 강사가 모은 자료를 강사를 대신해 보관·처리하는 자리입니다. 기간이 끝나면 자동으로 지우고, 그 전에는 강사가 [지금 내리기]로 지울 수 있습니다. 운영자는 신고를 처리할 때 말고는 열어 보지 않습니다. |
| 앱과 **다른 등록 도메인** | — | 앱은 사용자의 AI 키를 자기 출처에 보관합니다. 남이 올린 HTML을 같은 출처에 두면 그 키가 위험하고, 피싱 신고 한 건으로 앱 도메인까지 브라우저 경고에 걸릴 수 있습니다. `workers.dev` 주소로 시작해도 되지만 앱 도메인의 하위 도메인은 쓰지 마세요. |
| 창구 지키기 | — | 신고를 볼 사람과 주기(`REPORT_WEBHOOK`을 걸어 두면 메신저로 옵니다). Cloudflare 계정은 2단계 인증. |

## 2. 처음 한 번: `npm run setup`

**운영자가 할 일**: 전에는 손으로 12단계(§10·§11: 로그인·배포·ADMIN_KEY·웹훅·허용 앱 주소·도메인 사기와 붙이기·Zero Trust·Access 앱과 정책·AUD와 팀 도메인 비밀 값·WAF 규칙·앱 빌드 변수·확인)였고, 지금은 **3~4단계**입니다.

1. **API 토큰 하나 만들기**(대시보드, 아래 권한 표)
2. **`npm run setup`**(묻는 것: 운영자 이메일, 알림 웹훅. 둘 다 환경 변수로 줄 수 있음)
3. (Zero Trust를 처음 쓰면) 대시보드에서 Zero Trust 가입 한 번 → `npm run setup` 다시(관리 화면만 이어서 켬)
4. 앱 빌드 변수 `VITE_PUBLISH_API`(스크립트가 값과 `gh variable set …` 한 줄을 찍어 줌)

```bash
cd hosting
npm install
CLOUDFLARE_API_TOKEN=<만든 토큰> npm run setup
# 묻지 않고:        CLOUDFLARE_API_TOKEN=… LECPAGE_EMAIL=… LECPAGE_WEBHOOK=none npm run setup -- --yes
# 할 일만 보기:     npm run setup -- --dry-run          (Cloudflare에 아무것도 바꾸지 않음)
# 토큰 없이:        npm run setup -- --login            (브라우저 승인 한 번. Worker 보기로 켜고 관리 화면 Access는 대시보드에서)
# 그 밖:            --domain sites.example.kr · --app-origin https://앱주소 · --view worker · --help
```

**만들 토큰**(대시보드 → 내 프로필 → API 토큰 → 토큰 만들기 → 사용자 지정 토큰. 계정 리소스는 운영 계정 하나, 만료일은 며칠 뒤로)

| 권한 | 쓰는 곳 |
|---|---|
| Account · Workers Scripts · Edit | 바로 공개·관리 Worker 배포, 비밀 값, Worker id |
| Account · Cloudflare Pages · Edit | 보기 프로젝트(`lecpage-view`)와 본 배포(없는 주소 안내 화면) |
| Account · Account API Tokens · Edit | Worker가 쓸 'Pages 올리기 전용' 토큰(계정 소유, Pages Write만) 만들기 |
| Account · Access: Apps and Policies · Edit | 관리 Worker의 Access 앱(운영자 이메일만) |
| Account · Access: Organizations, Identity Providers, and Groups · Read | Access 팀 주소(관리 Worker가 토큰을 다시 확인할 때) |
| Account · Account Settings · Read | 계정 찾기 |
| (내 도메인을 쓸 때만) Zone · Zone · Read, Zone · Zone WAF · Edit, Zone · Workers Routes · Edit | 도메인 붙이기, 속도 제한 규칙 1개 |

설정이 끝나면 이 토큰은 지워도 됩니다(Worker는 따로 만든 Pages 전용 토큰만 씀). 다시 돌릴 때 새로 만들면 됩니다.

**스크립트가 하는 일**(이미 된 것은 건너뜀. 실패하면 멈춘 단계·까닭·다음 할 일을 찍고, 고친 뒤 같은 명령으로 이어 감)

1. 로그인 확인(계정이 여럿이면 `CLOUDFLARE_ACCOUNT_ID`)
2. workers.dev 하위 도메인(없으면 만듦, `--subdomain`)
3. 사이트 보기: Pages 프로젝트 `lecpage-view`(`--project`)와 본 배포(없는 주소 안내 화면)
4. `wrangler deploy`(바로 공개 Worker `lecpage-sites`)
5. 비밀 값: `ADMIN_KEY`(만들어 `~/.lecpage/<계정>/admin-key`에 0600으로만 두고 화면에 찍지 않음), `REPORT_WEBHOOK`(답했으면), `VIEW`·`CF_ACCOUNT_ID`·`PAGES_PROJECT`·`PAGES_HOST`·`PAGES_TOKEN`, `APP_ORIGINS`(`--app-origin`). 보기 설정도 비밀 값이라 `npm run deploy`를 다시 해도 지워지지 않습니다
6. 관리 Worker `lecpage-admin` 배포 → Access 앱(Worker 단위, 도메인 없이 workers.dev 전체, 정책: 운영자 이메일 하나, 세션 24시간) → 관리 Worker 비밀 값 `ACCESS_AUD`·`ACCESS_EMAILS`·`ACCESS_TEAM_DOMAIN`. 이메일은 Cloudflare에만 넣고 저장소·로그·`setup.json`에 남기지 않습니다(화면에는 `o***@…`로 가려서)
7. (선택 `--domain`) Worker 도메인·`PUBLIC_ORIGIN`·WAF 속도 제한 규칙 1개(같은 IP 10초 400건)
8. `/api/info` 확인, 앱 빌드 변수 `VITE_PUBLISH_API=<주소>`와 넣는 곳 안내

- **Zero Trust 첫 가입은 대시보드에서만**: 대시보드 → Zero Trust → 팀 이름 → Free 요금제 → **결제 수단 입력**(무료 요금제도 입력은 받지만 청구하지 않음, 공식 문서 cloudflare-one/setup). 안 했으면 스크립트가 이 한 단계만 안내하고 나머지를 끝냅니다. 그동안 관리 화면은 닫혀 있고(404) curl 관리(§3)는 됩니다.
- **Cloudflare가 최선인가**: 무료로 '서버 쪽 검사(런타임 외 스크립트 금지) + 사이트마다 다른 주소 + 하루 한도와 무관한 보기 + 실시간 방'을 한 계정에서 다 하는 곳은 찾지 못했습니다. Workers Previews는 Worker 하나에 미리보기 100개(무료)까지라 오래된 것부터 지워지고, Pages는 미리보기 배포 개수가 무제한입니다. 근거·위험은 조사 문서.
- 손으로 하던 길(`npx wrangler login` → `npm run deploy` → `npx wrangler secret put …`)도 그대로 됩니다. 관리 Worker는 `npm run deploy:admin`. 앱 주소 허용은 [`wrangler.jsonc`](wrangler.jsonc)의 `ALLOWED_ORIGINS`(또는 비밀 값 `APP_ORIGINS`), 내 도메인은 붙인 뒤 `PUBLIC_ORIGIN`.
- 확인: `curl https://<호스트>/api/info` → `{"ok":true,"view":"pages",…}`
- 자동 배포를 원하면 Workers Builds에 연결합니다. Root directory `hosting`, Deploy command `npm ci && npm run deploy`, 감시 경로 `hosting/*`, `skills/lecpage/engine/runtime/*`, `skills/lecpage/engine/src/build.js`, `skills/lecpage/backends/cloudflare/src/*`.

### 앱에 연결

앱을 빌드할 때 `VITE_PUBLISH_API=https://<호스트>`를 넣습니다. 비어 있으면 앱에 "바로 공개"가 보이지 않습니다.

| 앱을 올리는 곳 | 넣는 곳 |
|---|---|
| GitHub Pages 미러 | 저장소 Settings → Secrets and variables → Actions → **Variables** → `LECPAGE_PUBLISH_API` (`gh variable set LECPAGE_PUBLISH_API --body <주소>`) |
| Cloudflare(Workers Builds) | Worker → Settings → Build → Variables → `VITE_PUBLISH_API` |

앱은 공개할 때 연수 날짜·시작·끝·인원·네트워크(학교망 여부)를 함께 보냅니다(§4 수용량). 서버가 `pages` 보기면 돌려받은 `https://s-<id>.….pages.dev/`로 QR·짧은 주소·카톡 문구를 만들고, '학교망에서 안 열리면' 두 번째 주소(`https://<호스트>/s/<id>/`)를 한 줄 보여 줍니다.

## 3. 신고가 들어오면

신고는 사이트 바닥글의 "신고" 링크나 `https://<호스트>/report`로 들어옵니다. 90일 뒤 지워집니다. 관리 화면(§11)을 켰으면 거기서 같은 일을 누르기만 하면 됩니다(아래 curl과 같은 동작, 감사 기록에 남음).

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
| `VIEW` | (Pages 설정이 다 있으면 `pages`, 아니면 `worker`) | 사이트 보기. 사이트를 만들 때 정해져 바뀌지 않음(나중에 바꿔도 이미 올린 사이트는 그대로 열리고 지울 수 있음) |
| `CF_ACCOUNT_ID` / `PAGES_PROJECT` / `PAGES_TOKEN` / `PAGES_HOST` | (설정 스크립트가 비밀 값으로) | `pages` 보기. 토큰은 계정 소유 'Pages Write'만. `PAGES_HOST`는 프로젝트의 `<이름>.pages.dev`(이름이 겹치면 Cloudflare가 뒤에 글자를 붙임) |
| `SITE_DAYS` / `KEEP_ALIVE` / `MAX_SITE_DAYS` | 30(`pages`: 60) / on / 365 | 공개 기간. 다시 올리면 그날부터 다시 셉니다. `worker` 보기만: 화면을 여는 방문이 있으면(남은 기간이 절반 아래일 때) 다시 채우고, 처음 만든 날부터 365일이 지나면 방문으로는 늘지 않습니다 |
| `POLL_LONG` | off | 참여 기능 런타임이 긴 대기(`?wait=`)를 쓰게 되면 on: 예약 어림이 묻기 비용을 그만큼 낮게 셈 |
| `APP_ORIGINS` | (없음) | `ALLOWED_ORIGINS`에 더할 앱 주소(설정 스크립트 `--app-origin`이 비밀 값으로) |
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
| `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` | (없음) | 관리 화면(§11). 관리 Worker에는 설정 스크립트가 넣음. 바로 공개 Worker에 넣으면 그 안의 `/admin`(경로 Access, 예전 방식)이 열림. 저장소에 적지 말고 비밀 값으로 |
| `ALERT_AT` | `50,60,80,95` | 하루 예산의 몇 %에서 알림을 보낼지 |
| `STATS` / `STATS_DAILY_CAP` | on / 20000 | 앱 익명 이용 합계를 받을지, 항목 하나의 하루 상한 |
| `NOTICE_LINK_HOSTS` | (없음) | 공지 링크가 갈 수 있는 호스트(쉼표). 비우면 https 주소면 됨 |
| 비밀 `ADMIN_KEY`, `REPORT_WEBHOOK`, `ALERT_WEBHOOK`, `ACCESS_EMAILS` | | curl용 관리자 열쇠, 신고 알림, 예산·저장량 알림, (선택) 관리 화면에 들어올 이메일을 Worker가 한 번 더 확인 |

**수용량**(공식 한도 × 측정값. 어림식은 [`src/capacity.js`](src/capacity.js), 2026-11-13 기준)

- 공식 한도: Workers Free 요청 10만/일(한국 시간 오전 9시 초기화, 넘으면 오류 1027). Durable Objects Free 요청 10만/일·duration 13,000 GB-s/일·행 쓰기 10만/일·읽기 500만/일·저장 5GB(넘으면 그 종류 작업만 실패). 정적 자산과 Pages 정적 요청은 무료·무제한(Functions만 셈). Workers Paid 월 $5: Workers 요청 월 1,000만(+100만당 $0.30), DO 요청 월 100만(+100만당 $0.15), DO duration 월 40만 GB-s 포함.
- 측정: 첫 화면 열기 = Worker 요청 6(참가자)·5(강사), 다시 열기 1([admin-2026-11](../docs/research/admin-2026-11.md) §2). 예전 어림 '40명 연수 2천~1만 2천'에서 페이지 몫이 3분의 1~9분의 1로 줄어 **참가자 한 명 25요청**으로 잡음. 웹소켓이 막힌 학교망의 묻기(5초, 빈 응답이 이어지면 10초)는 '50명 2시간 4~7만' → **1분에 5요청**. 긴 대기를 런타임이 쓰면 **1분에 2.4요청**(20초 기다림 + 5초).

40명(강사 화면 2자리 더해 42) 2시간 연수 한 번이 그날 쓰는 Worker 요청:

| | 참여 기능 없음 | 참여 기능, 실시간 연결 됨(묻기 20%) | 참여 기능, 학교망(모두 묻기) | 학교망 + 긴 대기(런타임 반영 뒤) |
|---|---|---|---|---|
| `worker` 보기 | 1,050 | 6,720 | 26,880 | 13,780 |
| `pages` 보기 | **0** | 5,670 | 25,830 | 12,730 |

무료로 감당하는 연수(하루 = 10만 ÷ 위 값, 한 달 = ×30, 참가자 = ×40):

| | 하루 연수(참가자) | 한 달 연수 | 하루 한도에 닿으면 |
|---|---|---|---|
| `worker`, 참여 기능 없음 | 약 95(3,800명) | 약 2,850 | **올라온 사이트까지 모두 멈춤** |
| `worker`, 실시간 연결 됨 | 약 14(560명) | 약 420 | 모두 멈춤 |
| `worker`, 학교망 참여 기능 | 약 3(150명) | 약 110 | 모두 멈춤 |
| `pages`, 참여 기능 없음 | **방문 제한 없음**(새 사이트만 하루 `DAILY_SITE_CAP` 30개) | 새 사이트 900 | 사이트는 열림 |
| `pages`, 실시간 연결 됨 | 약 17(700명) | 약 530 | 사이트는 열림, 참여 기능·새로 올리기만 멈춤 |
| `pages`, 학교망 참여 기능 | 약 3~4(150명), 예약은 2개까지 | 약 115 | 사이트는 열림, 참여 기능만 멈춤 |
| `pages`, 학교망 + 긴 대기 | 약 7(300명), 예약은 5개까지 | 약 235 | 같음. DO duration(긴 대기 방 2시간 ≈ 900 GB-s)으로는 하루 14개라 요청 수가 먼저 참 |
| Workers Paid(`PLAN=paid`) | 하루 한도 없음 | 월 $5 안: 학교망 참여 기능 약 38회(DO 요청 100만이 먼저), 실시간 연결 약 175회, `pages` 참여 기능 없음은 무제한 | 넘는 만큼 학교망 연수 1회 약 1.2센트 |

- **예약형 수용량**: 앱이 공개할 때 보낸 날짜·시간·인원·네트워크로 그날 어림을 쌓아 두고, 그날 어림이 하루 예산의 70%(`BOOK_SHARE`)를 넘으면 **그날이 아니라 만들 때** `rate_limited`(`reason: 'booked'`)로 알려 앱이 그 까닭과 함께 '내 계정에 올리기'로 안내합니다. 오늘 아직 끝나지 않은 예약 연수의 남은 몫만큼 새 일(새 사이트·새 방)을 일찍 멈춰 그 몫을 지킵니다. 관리 화면에 앞으로 7일 예약표.
- DO 행 쓰기는 참가자 글 하나에 4~6줄이라 40명 연수 한 번 1천 줄 안팎이고, 저장은 `pages` 보기에서 HTML 원본·영상·소리만 Durable Object에 둬 거의 차지 않습니다. `worker` 보기는 사이트 파일도 둡니다(기본 상한 4GB = 40MB 사이트 100개).
- 한도에 닿으면 과금되지 않고 그날 남은 시간 동안 그 종류가 실패합니다. `pages` 보기에서는 Worker 한도에 닿아도 **이미 올라온 사이트는 열립니다**. `worker` 보기는 사이트도 열리지 않습니다(오류 1027).
- 누군가 일부러 두드리면 한도가 먼저 소진됩니다. 내 도메인을 붙였다면 WAF 속도 제한 규칙(무료 1개)을 겁니다(`npm run setup -- --domain …`이 1개까지 자동, §10).
- 요청을 줄이는 장치(`worker` 보기, §6 '빠르고 덜 부르게'): 엔진 런타임 스크립트는 정적 사본(`/rt/`)으로 나가 요청 수에 들지 않고, 그 밖의 파일은 주소에 내용 지문(`?v=`)을 붙여 브라우저가 1년 둡니다.
- **유료 전환(Workers Paid 월 $5)**: `worker` 보기는 하루 한도에 닿으면 사이트까지 멈추므로 여러 강사에게 열어 둘 서버면 처음부터 권합니다. `pages` 보기는 사이트가 멈추지 않으므로 참여 기능(특히 학교망 연수)이 많은 날이 이어질 때 권합니다(관리 화면 맨 위 한 줄, §10). 올리면 `PLAN=paid`, `MAX_TOTAL_BYTES`도 그때 올립니다.

## 5. 끄기

- **잠깐 새로 받지 않기**: 관리 화면의 [새 업로드 멈추기](또는 `curl -X POST -H "$A" -H 'content-type: application/json' -d '{"paused":true}' $H/api/admin/uploads`). 새 사이트·다시 올리기·새 방을 받지 않고, 앱은 '내 계정에 올리기'로 안내합니다.
- **새로 받지만 않기**: 앱 빌드 변수(`LECPAGE_PUBLISH_API`, `VITE_PUBLISH_API`)를 비우고 앱을 다시 배포합니다. 이미 올라온 사이트는 공개 기간까지 열려 있다가 지워집니다. 서버에서도 막으려면 `DAILY_SITE_CAP`을 1로 낮춥니다.
- **실시간 방만 끄기**: `LIVE=off`로 다시 배포. `/api/info`에서 `live`가 빠지고 `/live`는 404가 됩니다. 이미 있던 방 자료는 사이트가 지워질 때 함께 지워집니다.
- **완전히 내리기**: `npx wrangler delete -c wrangler.admin.jsonc`, `npx wrangler delete`. Worker와 Durable Object에 담긴 모든 사이트·방·신고가 지워집니다. `pages` 보기 사이트는 Pages 프로젝트 `lecpage-view`도 지웁니다(배포가 100개를 넘으면 프로젝트가 바로 안 지워질 수 있어 `npx wrangler pages deployment delete`로 먼저 지움, 공식 문서 known issues). 강사들에게 미리 알리세요.

## 6. 안전장치

`worker` 보기는 모든 사이트가 한 출처(`/s/<id>/`)를, `pages` 보기도 Pages 프로젝트 하나를 같이 쓰므로, **올린 사람이 쓴 스크립트는 절대 돌지 않게** 두 겹으로 막습니다(두 보기 모두 같은 검사).

1. **받을 때**: `.js`는 내용이 lecpage 엔진 런타임(`skills/lecpage/engine/runtime`) 파일 그대로이거나, 그 파일들을 `\n;\n`로 이은 것일 때만 받습니다. `scripts/gen-runtime.mjs`가 런타임 조각마다 길이·앞머리·SHA-256을 뽑아 `src/runtime-allow.js`를 만들고(배포·시험 때마다), 서버는 올라온 내용을 앞에서부터 조각으로 나눠 해시를 맞춰 봅니다. 올릴 때 한 번, 공개할 때 한 번 더 봅니다. 다르면 `runtime_mismatch`.
2. **내보낼 때**: 모든 HTML에 서버가 정한 CSP를 붙입니다(`script-src 'self'`, `form-action 'none'`, `base-uri 'none'`, `frame-src 'none'` …). 올라온 `_headers`는 쓰지 않습니다. 형식은 확장자 표로만 정하고 `nosniff`를 붙여, `.js`가 아닌 파일은 스크립트로 읽히지 않습니다. SVG는 가둔(sandbox) 채로 내보냅니다.
3. HTML은 내보내면서 `<meta http-equiv="refresh">`, `<base>`, `<object>`, `<embed>`, 바깥 주소의 `<script>`를 빼고 "신고" 링크를 붙입니다.
4. 사이트 주소는 무작위 10자, 수정 열쇠는 무작위 32바이트이고 서버에는 해시만 둡니다. 없는 주소를 두드려도 저장소에는 아무것도 생기지 않습니다.

**앱과 서버의 버전이 다를 때**: 엔진 런타임이 바뀌면 서버를 다시 배포해야 새 앱이 올릴 수 있습니다(같은 저장소에서 같이 배포하면 됩니다). 서버가 먼저 바뀌면, 예전 앱을 띄워 둔 사람은 `runtime_mismatch`를 받고 앱이 "새로 고친 뒤 다시"라고 안내합니다. 이 틈을 없애려면 런타임을 고치기 **전에** `npm run runtime:keep`을 실행해 `runtime-history.json`을 커밋해 두세요. 거기 적힌 예전 판도 받습니다. 보안 문제로 막아야 하는 판은 그 파일에서 지웁니다.

**`pages` 보기에서 더하는 것**
- 받을 때 검사(런타임 대조·크기·형식)를 마친 파일만 **서버가** Pages 직접 올리기 API로 올립니다. 자산 API의 JWT는 앱(브라우저)에 주지 않습니다: Pages가 열쇠와 내용이 맞는지 확인하는지 알 수 없어, 브라우저가 직접 올리면 남의 사이트가 쓰는 파일을 바꿔치기할 수 있기 때문입니다(이 API는 CORS도 열려 있지 않음, 2026-11-13 확인).
- Pages 열쇠는 wrangler와 같은 blake3(base64 + 확장자)입니다([`src/blake3.js`](src/blake3.js), blake3-wasm과 맞춰 시험). 형식(`content-type`)은 확장자 표로 정해 올립니다.
- HTML은 공개할 때 한 번 손봐(위 3번. 신고 링크는 이 호스트의 `/report`, 미리보기 카드 주소는 Pages 주소) 올리고, 응답 머리글은 서버가 만든 `_headers`로만 정합니다(CSP·nosniff·noindex·SVG 가둠·내려받기 형식·강사 화면 틀 막기, Pages 기본 `Access-Control-Allow-Origin: *`는 뗌). `robots.txt`는 호스트 정책으로 바꾸고, `404.html`이 없으면 넣습니다(없으면 Pages가 모든 주소에 첫 화면을 보여 줌). 사이트가 보낸 `_headers`·`_redirects`는 쓰지 않습니다.
- **영상·소리(mp3·m4a·mp4·webm)는 Pages에 올리지 않고** Durable Object에 두어 Worker가 Range(206)까지 맞춰 내보냅니다. Pages·Workers 정적 자산은 Range 요청에 200을 주는데 Safari(아이폰)가 영상을 틀 때 Range가 필요합니다(공식 문서). Pages 주소로 오면 `_redirects`가 `/s/<id>/…`로 넘깁니다.
- 사이트마다 출처(`s-<id>.….pages.dev`)가 갈려 브라우저 저장소를 같이 쓰지 않고, 한 사이트가 피싱 신고로 막혀도 다른 사이트는 그대로입니다.
- 가리기: 그 브랜치에 '가려 둔 사이트' 화면만 배포합니다(지난 배포는 풀 때 다시 쓰려고 둠. 배포마다 생기는 고유 주소 `<해시>.….pages.dev`는 앱·서버가 어디에도 내보내지 않음). 풀기: 마지막 공개 목록으로 다시 배포하고 안내 화면 배포를 지움. 지우기·기간 끝: 그 브랜치 배포를 모두 지움(가장 최근 배포를 못 지우면 '공개 기간이 끝났어요' 화면만 남김). 확실히 내려야 하면 가리지 말고 지우세요.
- 같은 사이트를 이 호스트의 `/s/<id>/`로도 엽니다(학교망에서 pages.dev가 막혔을 때 쓰는 두 번째 주소. Worker가 Pages에서 가져와 같은 머리글로 내보내고, 이 주소로 연 방문은 Worker 요청에 듦).
- 강사 화면에 운영자 공지 띠를 붙이지 않습니다(정적 배포라 보는 때에 끼울 수 없음). 앱 공지는 그대로입니다.

**알아 둘 것**
- CDN에서 라이브러리를 받는 효과 셋(Lenis 부드러운 스크롤, GSAP, OGL)은 CSP에 막혀 기본 동작으로 돌아갑니다. 화면은 깨지지 않습니다.
- **Supabase 실시간**을 쓰는 사이트는 `supabase-js`를 CDN에서 받으므로 기본 설정에서는 연결되지 않습니다. 받아 주려면 `ALLOW_SUPABASE_SDK="1"`: 엔진이 버전까지 고정한 그 파일 하나만 CSP에 더합니다. 이 서버의 실시간 방이나 구글 시트 연결은 그대로 됩니다.
- 암호로 잠근 사이트는 내용이 암호문이라 서버가 3번(HTML 손보기)을 할 수 없습니다. 스크립트는 CSP가 그대로 막지만, 풀린 화면에는 신고 링크가 없습니다(잠금 화면에는 있습니다).
- `worker` 보기에서는 브라우저 저장소(localStorage 등)를 이 호스트의 모든 사이트가 같이 씁니다. 돌 수 있는 스크립트가 엔진 런타임뿐이라 남의 사이트가 마음대로 읽어 갈 수는 없지만, 완전히 나누려면 `pages` 보기를 쓰세요.

**빠르고 덜 부르게**(`worker` 보기. `pages` 보기는 Pages 캐시·ETag가 맡고 요청 수에 들지 않음)
- 엔진 런타임 그대로인 스크립트(boot·lecpage·screen·console·unlock·qr, 참여 기능 묶음)는 `public/rt/<sha256>.js` 정적 사본으로 바꿔 내보냅니다(`scripts/gen-runtime.mjs`가 배포 때 만듦). 정적 자산이라 Worker 요청 수에 들지 않고, 모든 사이트가 브라우저 캐시를 같이 씁니다. 내용이 다르면(손댄 파일·예전 판) 바꾸지 않고 원래대로 사이트에서 내보냅니다.
- HTML이 부르는 사이트 안 파일(CSS·그림·스크립트)에는 `?v=<지문 12자>`를 붙이고, 지문이 맞는 요청은 `Cache-Control: immutable, 1년`. HTML은 `no-cache`(다시 올리면 바로 바뀜)이고 etag에 배포 id를 넣어 304로 답합니다.
- 내 도메인을 붙이면 HTML이 아닌 파일을 Cloudflare 데이터센터 캐시(Cache API)에 10분 둬서 Durable Object를 덜 깨웁니다(workers.dev에서는 동작하지 않음). 그래서 **가린 사이트의 그림·CSS는 이미 캐시에 든 곳에서 10분까지 남을 수 있습니다**(HTML은 바로 451).
- 없는 사이트 주소는 Worker가 1분 기억해 같은 주소를 두드려도 저장소를 깨우지 않습니다.
- 내 도메인에 http로 오면 https로 넘기고, 모든 응답에 HSTS를 붙입니다.

**링크 미리보기 카드**: 카카오톡·슬랙·X·페이스북 미리보기 봇이 `/s/`를 읽게 `robots.txt`에서 열어 두고(검색 로봇은 그대로 막음, 사이트마다 `noindex`), HTML에 `og:url`을 붙입니다. 사이트에 `og:image`가 없으면 첫 화면에서 처음 나오는 큰 그림(8KB 넘는 png·jpg·webp)을 씁니다.

## 7. 실시간 방

`skills/lecpage/backends/cloudflare`의 실시간 서버(HTTP 프로토콜 v1, WebSocket)를 **그대로 가져와** `/live` 아래에 얹었습니다. 사이트는 `live.provider = "http"`, `live.url = "https://<호스트>/live"`로 같은 출처의 방을 씁니다.

- 방은 사이트를 공개할 때 앱이 `POST /api/sites/<id>/live`로 등록합니다(사이트 수정 열쇠로 확인). 등록되지 않은 코드는 404이고 저장소에 아무것도 만들지 않습니다. 설정 토큰은 서버 안에서만 쓰고 밖으로 나가지 않습니다.
- 연수 코드는 호스트 전체에서 하나뿐입니다. 다른 사이트가 쓰는 코드면 `code_taken`(앱이 다른 코드를 고릅니다).
- 강사 화면의 관리자 키는 강사만 압니다(서버에는 해시). 운영자의 `ADMIN_KEY`로는 방을 열 수 없습니다.
- 보드 파일은 R2 없이 방의 SQLite에 1MiB씩 나눠 담습니다(`src/live/bucket.js`). 형식은 내용으로 가려 그림·PDF·MP3·MP4만 받습니다. R2에 두려면 `wrangler.jsonc`의 `r2_buckets` 주석을 풉니다(카드 등록 필요).
- 사이트를 가리면 방도 닫히고, 사이트를 지우거나 공개 기간이 끝나면 방과 올린 파일도 지워집니다. 방 자료는 사이트보다 오래 남지 않습니다.
- 방이 쓰는 저장량도 `MAX_TOTAL_BYTES`에 들어갑니다.
- 보드 파일의 주소는 규칙상 `/api/<코드>/files/<이름>`이라, 이 주소만 `/live` 없이도 받습니다.
- `pages` 보기의 사이트는 다른 출처에서 방을 부릅니다. Pages 사이트 출처(`https://s-<id>.<PAGES_HOST>`)에만 CORS·WebSocket을 열고, 그 밖의 출처는 예전처럼 막습니다.
- **긴 대기(long-poll)**: `GET …/snapshot?since=<커서>&wait=<초>`면 바뀐 것이 없을 때 바뀔 때까지(최대 25초) 기다렸다 답합니다(글이 올라오면 바로). 웹소켓이 막힌 학교망의 묻기를 5초마다 → 바뀔 때나 25초마다로 줄입니다. 대신 기다리는 동안 방(Durable Object)이 깨어 있어 duration을 씁니다(2시간 내내 기다리면 방 하나 약 900 GB-s, 무료 하루 13,000 GB-s). 그래도 무료에서는 요청 수가 먼저 찹니다(§4 표). 런타임이 `wait`를 붙여야 효과가 납니다.
- **묻기 간격 권고**: snapshot 응답에 `X-Lec-Poll-Ms`(무료 요금제에서 하루 예산 50%를 넘으면 10초, 80%를 넘으면 20초). 런타임이 따르면 붐비는 날 요청이 줄어듭니다.
- 304(바뀐 것 없음)는 쓰지 않았습니다: 지금 런타임은 2xx가 아니면 오류로 보고 물러나서, 요청 수는 그대로이고 화면만 '연결 끊김'이 됩니다.

## 8. API

오류는 언제나 `{ "error": { "code", "message_ko" } }`. 코드: `bad_request` `unauthorized` `not_found` `too_large` `too_many_files` `bad_path` `bad_type` `runtime_mismatch` `rate_limited` `full` `blocked` `missing_blobs` `code_taken`.
CORS는 `ALLOWED_ORIGINS`의 출처만. 브라우저가 다른 출처에서 보낸 요청은 403입니다.

| 요청 | 답 |
|---|---|
| `GET /api/info` | `{ ok, v: 1, plan, accepting, paused?, view: 'pages'\|'worker', keepAlive, limits: { maxBytes, maxFileBytes, maxFiles, days }, report, live?: { url, uploads, maxUploadMb } }` |
| `GET /api/status?date=YYYY-MM-DD&site=<id>` | `{ ok, view, plan, live, accepting, paused, budget, today: { date, used, reserved, pct }, day?: { date, trainings, people, est, live, budget, pct, room, ok }, site?: { id, state: 'open'\|'blocked'\|'gone', url, expiresAt, live: { code, state }, booking } }` · 공개 전·연수 전날 점검용, 1분 캐시 |
| `POST /api/sites` `{ title?, booking? }` | `201 { id, key, url, expiresAt, altUrl?, view? }` · `expiresAt`은 밀리초 숫자 · `key`는 이때 한 번만 · `booking: { date, start?, end?, people, network: 'good'\|'slow'\|'restricted', live }`(한국 시간). 그날이 차면 `429 rate_limited` + `reason: 'booked'`, `day` |
| `POST /api/sites/:id/deploys` `{ files: { "<경로>": { sha256, size } }, booking? }` | `{ deploy, missing: [sha256…] }` |
| `PUT /api/sites/:id/blobs/:sha256` (본문 = 파일) | `204` · `pages` 보기는 받으면서 검사한 뒤 Pages에 올림 |
| `POST /api/sites/:id/deploys/:deploy/publish` | `{ url, expiresAt, altUrl?, view? }` · 덜 올렸으면(또는 `pages` 보기에서 Pages가 지운 파일이 있으면) `409 missing_blobs`(+`missing`) → 그 파일만 다시 올리고 한 번 더 |
| `POST /api/sites/:id/live` `{ code, adminKeyHash, settings?: { retentionDays?, uploads?, moderation? } }` | `{ url: "<호스트>/live", code }` |
| `DELETE /api/sites/:id` | `204` |
| `POST /api/report` `{ site, reason, contact? }` | `{ ok: true }` |
| `GET /api/notice?for=app\|teacher` | `{ notices: [{ id, title, body, ends, link?, linkLabel?, linkHost? }] }` · 글자만, 1분 캐시 |
| `POST /api/stats` (본문 글자 `{"e":"open"\|"make"\|"publish","k"?}`, 200바이트까지) | 언제나 `204`. 허용한 앱 주소에서 온 것만, 표에 있는 항목만 그날 숫자에 더함 |
| `GET /api/admin/reports` · `GET /api/admin/sites` · `GET /api/admin/stats` · `POST /api/admin/sites/:id/block` `{ blocked, reason? }` · `DELETE /api/admin/sites/:id` · `POST /api/admin/uploads` `{ paused, reason? }` | `Authorization: Bearer <ADMIN_KEY>`(curl용. 한 일은 감사 기록에 'ADMIN_KEY(curl)'로) |
| `/admin/`, `/admin/api/…` | 관리 화면(§11, 관리 Worker. 바로 공개 Worker에서는 경로 Access를 켰을 때만). Cloudflare Access가 있어야 하고 ADMIN_KEY로는 안 됨 |
| `GET /s/:id/…` | 사이트 파일 · 기간 끝·지움 404 · 가림 451 · `pages` 보기 사이트는 Pages에서 가져와 내보냄(두 번째 주소), 영상·소리는 여기서 |
| `/live/api/<코드>/…` | 실시간 방(HTTP 프로토콜 v1) · `snapshot?since=&wait=` 긴 대기 · 응답 머리글 `X-Lec-Poll-Ms` |

사이트를 고치는 요청에는 `Authorization: Bearer <key>`가 필요합니다. 받는 형식: html css js(런타임만) json webmanifest txt svg png jpg jpeg webp avif gif ico woff2 pdf mp3 m4a mp4 webm, 내려받기 전용 ppt pptx ppsx doc docx xls xlsx hwp hwpx key pages numbers odt odp ods csv md zip, 암호 사이트의 `*.enc`.

## 9. 시험

```bash
cd hosting
npm test                  # 단위 시험 + 통합 시험(로컬 workerd에 실제 엔진 사이트를 올려 봄, 가짜 Access로 관리 화면까지). workerd를 못 띄우면 통합 시험만 건너뜁니다
                          #  + VIEW=pages 통합 시험(흉내 Cloudflare API test/fake-cf.mjs: 직접 올리기·blake3 열쇠·가리기·지우기·긴 대기·예약)
                          #  + 설정 스크립트(흉내 API·흉내 wrangler: 처음·다시·도메인·실패·--dry-run), 관리 Worker(ctx.access·JWT)
npm run check             # wrangler deploy --dry-run (바로 공개 Worker와 관리 Worker 둘 다 묶음만 만들어 봄)
npm run dev               # http://localhost:8787
node test/fake-cf.mjs     # 흉내 Cloudflare(e2e용): http://127.0.0.1:8790, 보기 http://s-<id>.localhost:8790/
```

## 10. 운영자 체크리스트: 무료 요금제로 안전하게 열기

무료 요금제의 약점은 하루 Worker 요청 10만 건(한국 시간 오전 9시 초기화)입니다. `worker` 보기는 다 쓰면 그날 올라온 사이트까지 열리지 않고, `pages` 보기는 사이트는 열리지만 참여 기능 방과 새로 올리기가 멈춥니다. 아래 장치는 그 전에 새 일을 멈추고, 요청을 줄이고, 운영자에게 알립니다. `npm run setup`이 대부분을 켭니다.

| 장치 | 무엇을 막나 | 켜는 법 |
|---|---|---|
| `pages` 보기 | 하루 한도에 닿아도 사이트는 열림(방문이 요청 수에 안 듦) | 설정 스크립트 기본 |
| 연수 예약(그날 70%) | 그날 참여 기능이 멈출 연수를 '만들 때' 내 계정으로 안내 | 기본(앱이 날짜·인원을 보냄) |
| 하루 예산 60%(+ 오늘 예약 연수의 남은 몫)에서 새 사이트·새 방만 멈춤 | 남은 몫을 이미 올라온 연수에 씀 | 기본(PLAN=free) |
| 긴 대기·묻기 간격 권고 | 학교망 묻기 요청(§7) | 서버 기본, 런타임 반영 필요 |
| 런타임 정적 사본·지문 주소·1년 캐시 | `worker` 보기 방문 한 번에 드는 요청 수 | 기본 |
| 예산 85%부터 앱 이용 합계는 Gate를 부르지 않고 버림 | 덜 급한 일이 몫을 쓰는 것 | 기본 |
| 없는 주소 1분 기억, 주소 모양 먼저 검사 | 주소 두드리기로 저장소를 깨우는 것 | 기본 |
| 알림(50·60·80·95%, 저장량 80%) | 모르고 지나가는 것 | 설정 스크립트가 묻는 웹훅(`REPORT_WEBHOOK`, 따로 `ALERT_WEBHOOK`) |
| 새 업로드 멈춤 스위치 | 스팸·이상한 몰림 | 관리 화면 [새 업로드 멈추기] 또는 `POST /api/admin/uploads` |
| WAF 속도 제한 규칙(무료 1개) | 한 IP의 폭주(Worker에 닿기 전에 막아 요청 수에도 안 듦) | 내 도메인이 있을 때 `npm run setup -- --domain …`(1개까지 자동) |
| 두 번째 주소 `/s/<id>/` | 학교망이 pages.dev를 막은 경우(§12) | 기본(내 도메인이면 그 도메인 주소) |

**운영자가 할 일**: ① 토큰 만들기 ② `npm run setup` ③ (처음이면) Zero Trust 가입 후 다시 돌리기 ④ 앱 빌드 변수(§2). 확인: 스크립트 끝의 `/api/info`, 관리 화면의 오늘 요청 수·앞으로 7일 예약표, 알림 웹훅에 시험 글(`ALERT_AT`을 잠깐 `1`로).

**내 도메인(선택)**: 앱과 **다른 등록 도메인**(예: `lecpage-sites.example`)을 Cloudflare에 넣고 `npm run setup -- --domain sites.lecpage-sites.example`. Worker 도메인·`PUBLIC_ORIGIN`·WAF 규칙을 넣습니다. 규칙: 이름 `lecpage 폭주 막기`, 조건 `starts_with(http.request.uri.path, "/s/") or starts_with(http.request.uri.path, "/api/") or starts_with(http.request.uri.path, "/live/")`, 같은 IP 10초에 **400**건 넘으면 Block 10초(무료 요금제에서 고를 수 있는 값). 학교 한 곳(IP 하나)에 40명이 동시에 처음 열어도 300건 안쪽입니다. 강당 큰 연수가 막히면 대시보드에서 600으로 올립니다. Security → Bots의 **Block AI bots**는 켜도 되고, **Bot Fight Mode는 끄세요**(카카오톡 미리보기 봇과 앱의 API 요청이 막힐 수 있음). 도메인이 있으면 `worker` 보기 사이트 파일을 데이터센터 캐시에 10분 둡니다.

**유료 전환 판단 기준**(관리 화면 맨 위 한 줄이 계산)
- 최근 7일 중 **2일 이상** 하루 예산의 50%를 넘었으면 → Workers Paid(월 $5)로 올리고 `PLAN=paid`. `worker` 보기는 사이트가 멈추기 전에, `pages` 보기는 참여 기능·새로 올리기가 멈추기 전에.
- 앞으로 7일 예약표에 '꽉 참'인 날이 한 달에 두 번 넘게 나오면 → 같은 판단(그날 연수가 강사 계정으로 밀려나고 있음).
- 60% 알림(새 사이트를 받지 않음)이 한 달에 두 번 넘게 오면 → 같은 판단.
- 95% 알림이 한 번이라도 오면 → `worker` 보기는 그날 바로 올리기를 권합니다(올라온 사이트가 멈추기 직전). `pages` 보기는 그날 참여 기능이 곧 멈춥니다.
- 폭주가 한 IP에서 오면 WAF 문턱을 낮추고, 여러 곳에서 오면 [새 업로드 멈추기] 뒤 유료 전환을 검토합니다.
- 유료로 올린 뒤에는 관리 화면의 30일 합계로 월 요청 수를 봅니다(Workers 1,000만을 넘으면 100만 건당 $0.30, DO 요청 100만을 넘으면 100만 건당 $0.15).

## 11. 관리 화면(관리 Worker `lecpage-admin`)

운영자만 들어오는 화면입니다. 앱 번들에는 들어가지 않고, 바로 공개 Worker와 따로 배포하는 작은 Worker([`wrangler.admin.jsonc`](wrangler.admin.jsonc), [`src/admin-worker.js`](src/admin-worker.js))가 내보냅니다. 같은 계정의 `lecpage-sites`가 가진 Durable Object(Gate·Site)에 `script_name`으로 묶여 같은 자료를 봅니다.

**켜는 법**: `npm run setup`(§2)이 합니다. 손으로 하려면
1. `npm run deploy:admin`
2. 대시보드 → Workers & Pages → `lecpage-admin` → **Access** → Protect this Worker behind Access → All traffic → 운영자 이메일만(Zero Trust가 처음이면 가입부터. 결제 수단 입력, 청구 없음)
3. `lecpage-admin`에 비밀 값 `ACCESS_AUD`(그 Access 앱의 AUD), `ACCESS_EMAILS`(운영자 이메일), (선택) `ACCESS_TEAM_DOMAIN`(`<팀>.cloudflareaccess.com`)
4. `https://lecpage-admin.<계정>.workers.dev/` → Access 로그인 → 관리 화면

**들어오는 길과 막는 길**
- Access(Worker 단위 앱)가 이 Worker의 workers.dev 주소 **전체**를 지킵니다(도메인 없이). 정책은 운영자 이메일 하나, 세션 24시간. 로그인은 One-time PIN(메일로 받는 일회용 번호)이나 Cloudflare 계정.
- Worker가 한 번 더 확인합니다. `ACCESS_TEAM_DOMAIN`이 있으면 Access 토큰(JWT)의 서명(팀의 공개 열쇠, 1시간 캐시)·발급자·AUD·만료를 확인하고 `ctx.access`의 이메일과도 맞춰 봅니다. 없으면 `ctx.access`(Access가 인증한 요청에만 있음)의 AUD와 이메일을 `ACCESS_EMAILS`와 맞춥니다. 어느 쪽이든 아니면 403, 설정이 없으면 모든 주소가 404입니다.
- 관리 Worker는 정적 자산을 쓰지 않습니다(쓰면 `ctx.access`가 Worker에 오지 않음, 공식 문서). 화면 파일(`public/admin/`)은 배포할 때 `scripts/gen-admin.mjs`가 글자 모듈로 넣습니다.
- curl용 `ADMIN_KEY`는 바로 공개 Worker의 `/api/admin/…`에 그대로(§3). 관리 화면 API(`/admin/api/…`)는 ADMIN_KEY로 열리지 않고, Access 토큰으로 curl 주소가 열리지도 않습니다.
- 내 도메인 + 경로(`/admin`) Access로 바로 공개 Worker 안의 `/admin`을 쓰던 예전 방식도 그대로 됩니다(`ACCESS_TEAM_DOMAIN`·`ACCESS_AUD`를 바로 공개 Worker에 넣었을 때만).
- 상태를 바꾸는 요청은 같은 출처(Origin)·전용 머리글(`x-lecpage-admin`)·JSON만 받습니다. CORS를 열지 않으므로 다른 사이트는 보낼 수 없습니다.
- 화면은 인라인 스크립트 없이(`script-src 'self'`, Trusted Types), 모든 글을 글자(textContent)로만 그립니다. 사이트 제목·신고 내용처럼 남이 쓴 글이 화면에 나와도 실행되지 않습니다.
- 가리기·풀기·지우기·신고 처리·공지·새 업로드 멈춤은 **감사 기록**(누가·언제·무엇을, 최근 2,000개)에 남습니다. curl로 한 일도 'ADMIN_KEY(curl)'로 남습니다.

**보이는 것**: 오늘·30일 요청 수와 하루 예산 대비 %(사이트 파일·참여 기능·API로 나눠, 데이터센터 캐시 적중 수), **앞으로 7일 연수 예약표**(날짜별 연수·참가자·참여 기능 수·요청 어림·예산 %·꽉 참), 새 사이트·공개 수, 살아 있는 사이트·가린 사이트·참여 기능 방 수, 저장량/상한, 신고 대기, 오류(5xx)·429 수, 유료 전환 한 줄(최근 7일 중 50% 넘은 날 수), 앱 익명 이용 합계(앱 열기·만들기 길·올릴 곳 종류, 오늘·7일·30일).

**할 수 있는 것**: 팝업 공지 만들기·고치기·끄기(제목 60자·본문 400자 글자만, 링크는 https 하나, 대상: 앱/공개 사이트 강사 화면, 기간 90일까지), 새 업로드 멈춤·다시 받기, 신고 처리(가리기·풀기·지우기·처리함), 사이트 찾기·가리기·지우기(지울 때 주소 10자를 한 번 더 적음).

사이트 주소는 보기에 맞게(`pages`면 `s-<id>.….pages.dev`) 링크합니다. 공지 대상 '공개 사이트 강사 화면'은 `worker` 보기 사이트에만 붙습니다.

숫자는 바로 공개 Worker 안에서 세어 Gate(Durable Object)의 하루 한 줄에 더합니다(바깥 분석 API·토큰 없음). isolate마다 50건씩 묶어 보내므로 어림이고, 정적 자산(첫 화면·신고 화면·`/rt/`)과 Pages 방문은 세지 않습니다. 하루 숫자는 400일 둡니다.

## 12. 학교망 대비

학교 연수가 많고, 무료에서도 학교망 조건 때문에 사이트를 못 만들거나 연수 당일 접속이 막히는 일을 줄이려는 장치입니다.

- **연수 날짜를 아는 수용량**(§4): 그날 참여 기능이 멈출 만큼 예약이 차면 강사가 사이트를 **만들 때** 그 날짜와 함께 알리고 앱이 '내 계정에 올리기'로 안내합니다. 예약된 연수가 있는 날은 새 일을 일찍 멈춰 그 몫을 지킵니다.
- **상태 API** `GET /api/status?date=&site=`(§8): 앱의 '공개 전 점검'·'연수 전날 점검'이 오늘·그날 남은 몫과 사이트·참여 기능 방 상태를 1분 캐시로 묻습니다(앱에는 `instantStatus()`가 있고, 화면에 붙이는 일은 이어서).
- **웹소켓이 막힌 학교망**: 긴 대기·묻기 간격 권고(§7). 런타임 반영 전에는 40명 2시간에 약 2.6만 요청(무료 하루 3~4회), 반영 뒤 약 1.3만(하루 7회)입니다.
- **pages.dev·workers.dev가 학교 필터에 걸릴 가능성**: 한국 교육청·학교의 유해정보 차단이 `*.pages.dev`·`*.workers.dev`를 어떻게 분류하는지 공개 자료는 찾지 못했습니다(2026-11-13 검색). 보안 업체·통신사 차단은 대개 피싱으로 신고된 **하위 도메인 하나**를 막고(Malwarebytes의 pages.dev 탐지, 통신사 보안 기능 사례), 나라 단위로 `*.pages.dev` 전체를 막은 사례가 있습니다. 두 도메인 모두 피싱에 많이 쓰인다는 보안 업체 보고가 있어 '평판 낮음·새 사이트'로 막는 필터도 있을 수 있습니다. 그래서
  - `pages` 보기는 사이트마다 하위 도메인이라, 한 사이트가 신고로 막혀도 다른 사이트는 그대로입니다(`worker` 보기는 한 주소를 같이 써서 한꺼번에 막힘).
  - **두 번째 주소**: 공개 화면에 `https://<호스트>/s/<id>/`를 한 줄 보여 줍니다. 운영자 도메인(`--domain`)을 붙이면 이 주소가 그 도메인이 되어, pages.dev·workers.dev를 둘 다 막은 학교에서도 열립니다(이 주소로 연 방문은 Worker 요청에 듦).
  - 사이트마다 운영자 도메인의 하위 도메인을 주는 것은 하지 않았습니다: Pages는 와일드카드 사용자 도메인을 못 붙이고(프로젝트당 100개), 다른 길은 인증서·호스트 관리가 유료입니다.
  - 가장 확실한 것은 강사가 연수 전날 그 학교망에서 주소를 한 번 열어 보는 것입니다(앱의 '연수 전날 점검'에 이어서 붙일 일).
