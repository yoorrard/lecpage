# 호스팅·배포 재조사 (2026-11-11)

- 조사일 **2026-11-11**. 공식 문서를 직접 내려받아 읽었습니다. CLI는 `--help`와 `--dry-run`까지만 돌렸습니다(wrangler 4.160.0, vercel 65.14.0, netlify-cli, gh 2.89.0). **실제 배포와 계정·앱 등록은 하지 않았습니다.**
- ⚠️ = 문서에 없거나 직접 확인하지 못한 것. "2차" = 공식이 아닌 출처. 목록은 §11.
- `hosting.md`(2026-11-09)와 같은 값은 다시 확인만 했습니다. 여기에는 달라진 것과 새로 필요한 것을 적습니다.

## 1. 달라진 것 (hosting.md와 비교)

1. **Netlify는 새 계정에서 바로 공개되지 않습니다.** 2026-07-28 이후 만든 팀은 기본값이 "Private for new projects"이고, API·Drop·CLI 어느 길로 만들어도 같습니다. **Make public**을 눌러야 참가자가 봅니다. 2026-08-19 이후 무료 새 프로젝트에는 "Powered by Netlify" 배지가 붙습니다(끌 수 있음). → 앱의 "Netlify 추천"은 더 맞지 않습니다. ([project visibility](https://docs.netlify.com/manage/security/secure-access-to-sites/project-visibility/) · [badge](https://docs.netlify.com/manage/projects/powered-by-netlify-badge/))
2. **Vercel은 브라우저에서 토큰만으로 배포할 수 있습니다.** `api.vercel.com`이 `access-control-allow-origin: *`로 답합니다(배포·파일 업로드·프로젝트·사용자 엔드포인트 preflight 확인). 순서는 §10.
3. **Cloudflare Drop**(2026-07-08)이 생겼습니다. 계정 없이 폴더·ZIP을 놓으면 `workers.dev` 주소가 생기고 60분 안에 claim해야 남습니다. CLI도 `wrangler deploy --temporary`로 같은 일을 합니다. "Workers에는 끌어 놓기가 없다"는 예전 문장은 새 사이트 만들기에 한해 틀렸습니다. ([changelog](https://developers.cloudflare.com/changelog/post/2026-07-08-cloudflare-drag-and-drop/) · [claim deployments](https://developers.cloudflare.com/workers/platform/claim-deployments/))
4. Cloudflare Pages 끌어 놓기 메뉴 경로가 바뀌었습니다: **Create application → Get started → Drag and drop your files**. ([direct upload](https://developers.cloudflare.com/pages/get-started/direct-upload/), 2026-04-21 갱신)
5. Cloudflare가 **제3자 OAuth 클라이언트**(PKCE, 공개 클라이언트)를 엽니다. 다만 `api.cloudflare.com`에는 여전히 CORS가 없습니다. ([create an OAuth client](https://developers.cloudflare.com/fundamentals/oauth/create-an-oauth-client/), 2026-11-10 갱신)
6. Vercel: 새 프로젝트 기본 보호는 Standard Protection(운영 주소는 공개, 배포별 주소는 Vercel 로그인). All Deployments 보호가 전 요금제 무료가 됐고(2026-09-09) 팀 기본값으로 둘 수 있습니다. "Sign in with Vercel"은 비밀 없는 PKCE를 받지만 API 권한은 비공개 베타입니다.
7. Workers 정적 자산은 `Range` 요청에 `206`이 아니라 전체 파일을 `200`으로 줍니다(Safari 동영상). ([billing and limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), 2026-11-03 갱신) Durable Objects SQLite의 행·BLOB 한도는 8MB입니다.
8. Supabase는 `anon`·`service_role` 키를 **2026년 말까지** 없앤다고 적었습니다. lecpage는 이미 publishable 키를 씁니다. ([API keys](https://supabase.com/docs/guides/api/api-keys))
9. 그대로인 값: GitHub Pages 한도, Cloudflare 정적 요청 무료·무제한, Vercel Hobby 한도, Netlify 300크레딧, Firebase 월 10GB, Azure SWA 250MB, Render 5GB, Supabase 무료 한도, Apps Script 할당량(2026-09-03 갱신본).

## 2. 정적 호스팅 비교 (무료 요금제, 2026-11-11)

| | Vercel Hobby | Cloudflare Pages 끌어 놓기 | Cloudflare Workers 정적 자산 | GitHub Pages | Netlify Free |
|---|---|---|---|---|---|
| 기본 주소 | `이름.vercel.app` | `이름.pages.dev` | `이름.<계정>.workers.dev` | `<계정>.github.io/<저장소>/` | `이름.netlify.app` |
| 크기·파일 수 | 올리는 합계 100MB, 15,000개(CLI 문서 기준) | 1,000개, 파일당 25MiB | 20,000개, 파일당 25MiB | 사이트 1GB, 파일 100MiB | ZIP 25,000개(크기 한도는 문서에 없음 ⚠️) |
| 전송·요청 | 월 100GB, CDN 요청 100만 | 무제한 | 무제한 | 월 100GB(권고) | 크레딧: GB당 20, 1만 요청당 2 |
| 배포 횟수 | 하루 100회, 파일 업로드 하루 5,000개 | 한도 문서에 없음 ⚠️(Git 빌드는 월 500) | 한도 문서에 없음 | 시간당 10빌드(권고) | 1회 15크레딧, API 분당 3·하루 100 |
| 넘으면 | 대개 30일 대기 | — | — | 메일 안내·429 | **계정의 모든 사이트 정지** |
| 상업 이용 | **비상업 개인만** | 가능 | 가능 | 온라인 사업·상업 SaaS 금지 | 가능 |
| 새 계정에서 바로 공개 | ✓(운영 주소) | ✓ | ✓ | ✓(저장소도 공개) | **✗ Make public 필요** |
| 명령어 없이 | 앱에서 API, vercel.com/drop | 대시보드 끌어 놓기(ZIP·폴더) | cloudflare.com/drop(새 사이트만) | 앱에서 API | 앱에서 API, app.netlify.com/drop |
| 다시 올려도 같은 주소 | ✓ | ✓ | CLI ✓, Drop ⚠️ | ✓ | ✓ |
| 내 도메인·HTTPS | ✓(프로젝트당 50)·자동 | ✓(하위 도메인은 CNAME만)·자동 | ✓(Cloudflare 영역 필요)·자동 | ✓·자동 | ✓·자동 |
| 응답 헤더 | `vercel.json`의 `headers` | `_headers`(100규칙) | `_headers`(100규칙) | 불가(CSP는 meta) | `_headers` |
| 브라우저에서 API 호출 | ✓ | ✗(CORS 없음) | ✗ | ✓ | ✓ |

`robots.txt`와 `<meta name="robots">`는 어디서나 그대로 동작합니다. Vercel은 미리 보기와 배포별 주소에 `X-Robots-Tag: noindex`를 붙이고 운영 주소에는 붙이지 않습니다([environments](https://vercel.com/docs/deployments/environments)).

출처: [Vercel limits](https://vercel.com/docs/limits) · [Hobby](https://vercel.com/docs/plans/hobby) · [fair use](https://vercel.com/docs/limits/fair-use-guidelines) · [Pages limits](https://developers.cloudflare.com/pages/platform/limits/) · [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) · [large files](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github) · [Netlify credits](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/) · [Netlify API](https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/)

## 3. 서비스별 메모

### 3.1 Vercel
- **한도**: 전송 월 100GB, CDN 요청 월 100만, 프로젝트 200개, 배포 하루 100회, 파일 업로드 하루 5,000개(`api-upload-free`), 올리는 파일 합계 100MB, 프로젝트당 도메인 50개. 넘으면 "대부분 30일 뒤에 다시 쓸 수 있음". 정적 파일만 올리는 배포는 빌드로 세지 않습니다.
- **약관**: Hobby는 비상업 개인 용도만. 상업 이용의 정의는 "제작에 관여한 누구든 금전적 이득을 얻는 배포"이고 예로 결제, 상품·서비스 광고, **사이트 제작·호스팅의 대가**, 광고가 있습니다. 기부 요청은 예외. 애매하면 지원팀에 물으라고 적혀 있습니다. 강사료를 받는 연수는 여전히 회색입니다.
- **주소**: 운영 주소는 `<프로젝트>.vercel.app`(이름이 이미 쓰이면 `<프로젝트>-<팀>.vercel.app` 등). 항상 최신 운영 배포를 가리키므로 같은 `name`으로 다시 올리면 주소가 그대로입니다. 배포마다 생기는 `<프로젝트>-<해시>-<팀>.vercel.app`는 그 판만 가리킵니다. ([generated URLs](https://vercel.com/docs/deployments/generated-urls) · [quickstart](https://vercel.com/docs/platforms/multi-project-platforms/quickstart))
- **보호 기본값**: "새 프로젝트는 Standard Protection + Vercel Authentication으로 시작한다(팀 기본값을 바꾸지 않았다면). 미리 보기는 Vercel 로그인이 필요하고 운영 도메인은 공개로 남는다." 팀 기본값은 All Deployments·Standard·None 중에서 고를 수 있어서, All Deployments로 둔 팀은 운영 주소에도 로그인 창이 뜹니다. 끄려면 프로젝트 **Settings → Deployment Protection**, API로는 `PATCH /v9/projects/{이름}`에 `{"ssoProtection": null}`. 끄면 예전 배포 주소도 모두 공개됩니다. Hobby에는 암호 보호가 없습니다. ([deployment protection](https://vercel.com/docs/deployment-protection) · [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication) · [changelog 2026-01-13](https://vercel.com/changelog/set-team-wide-defaults-for-deployment-protection) · [2026-09-09](https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan))
- **토큰**: https://vercel.com/account/tokens → 이름 → **Scope**(Full Account 또는 팀 → All Projects/프로젝트 하나) → **Expiration** → **Create**. 값은 `vcp_`로 시작하고 한 번만 보입니다. 팀·프로젝트 범위 토큰은 `teamId`가 필요 없고, Full Account 토큰은 `teamId`를 안 주면 기본 팀으로 갑니다. 가입은 이메일(6자리 코드) 또는 GitHub·GitLab·Bitbucket. ([access tokens](https://vercel.com/kb/guide/how-do-i-use-a-vercel-api-access-token) · [accounts](https://vercel.com/docs/accounts))
- **명령어 없이**: https://vercel.com/drop 에 파일·폴더·ZIP. 로그인하면 팀과 프로젝트 이름을 고르고 **Deploy**. 고칠 때는 대시보드의 그 프로젝트 위에 폴더를 놓으면 새 운영 배포가 됩니다(Git 연결이 없는 프로젝트). 계정 없이 올리면 임시 주소이고 **Claim Project**를 눌러야 남습니다(파일당 100MB, 합계 1GB, 만료 시간은 화면에 표시). ([Drop](https://vercel.com/docs/drop))
- **헤더**: `_headers`는 읽지 않습니다. 사이트 맨 위 `vercel.json`의 `headers`로 넣습니다(skill 템플릿 `templates/deploy/vercel/vercel.json` 그대로).
- **실시간**: 함수에서 WebSocket이 되지만 함수 최대 실행 시간(Hobby 300초)에 끊기고 연결이 인스턴스 하나에 묶입니다. 상태를 둘 곳도 없습니다. 실시간 백엔드로는 쓰지 않습니다. ([WebSockets](https://vercel.com/docs/functions/websockets))

### 3.2 Cloudflare
- **Pages와 Workers**: Pages 문서 첫머리가 "Workers가 Pages 용도의 대부분을 지원하고 기능이 더 많다. 새 프로젝트는 Workers로 시작하라"입니다(2026-08-25 갱신). Pages 종료 일정은 없고 새 프로젝트도 만들어집니다.
- **대시보드 끌어 놓기는 Pages만**: Workers & Pages → Create application → Get started → Drag and drop your files → 프로젝트 이름 → ZIP 또는 폴더 → Deploy site. 고칠 때는 프로젝트의 **Create a new deployment**. 1,000개·파일당 25MiB. 끌어 놓기 프로젝트는 나중에 Git 연결로 못 바꿉니다. Workers 대시보드의 Create application에는 템플릿과 Git 가져오기만 있습니다. ([Workers dashboard](https://developers.cloudflare.com/workers/get-started/dashboard/), 2026-06-25 갱신)
- **Cloudflare Drop**: https://www.cloudflare.com/drop/ 에 폴더·ZIP·HTML 한 장. `workers.dev` 주소가 바로 생기고 **60분 안에 Claim**(가입·이메일 인증)하지 않으면 계정째 지워집니다. 임시 계정 한도는 1,000개·**파일당 5MiB**. claim한 뒤 같은 주소에 브라우저로 다시 올리는 방법은 문서에 없습니다 ⚠️(wrangler로는 됩니다).
- **CLI**: `wrangler deploy --assets <폴더> --name <이름> --compatibility-date <날짜>`는 설정 파일 없이, 대화 없이 됩니다(dry-run으로 확인). 인증은 `CLOUDFLARE_API_TOKEN`+`CLOUDFLARE_ACCOUNT_ID`. 로그인이 없으면 `--temporary`(4.102.0 이상).
- **한도**: 정적 자산 요청은 무료·무제한. Worker 코드가 도는 요청만 하루 10만(무료). `workers.dev`는 "개인·취미용" 취급이고 Browser Integrity Check를 끌 수 없습니다. Worker에 내 도메인을 붙이려면 도메인이 Cloudflare 영역이어야 하고, Pages는 하위 도메인이면 CNAME만으로 됩니다.
- **브라우저에서 API**: `api.cloudflare.com/client/v4`는 preflight에 CORS 헤더 없이 404/400을 줍니다(Pages·토큰 확인·임시 계정 엔드포인트 확인). 임시 계정 REST API도 "백엔드에서만 부르라"고 적혀 있습니다.
- 출처: [Pages](https://developers.cloudflare.com/pages/) · [direct upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) · [wrangler deploy](https://developers.cloudflare.com/workers/wrangler/commands/workers/#deploy) · [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/) · [static assets headers](https://developers.cloudflare.com/workers/static-assets/headers/) · https://www.cloudflare.com/drop/llms.txt

### 3.3 GitHub Pages
- 한도는 그대로: 사이트 1GB, 월 100GB(권고), 시간당 10빌드(권고), 배포 10분 제한. 무료 계정은 **공개 저장소만**. 비공개 게시는 Enterprise Cloud 조직만 됩니다. ([plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans))
- 금지 문구는 "온라인 사업, 전자상거래, 또는 상거래나 상업 SaaS 제공이 주목적인 사이트의 무료 호스팅"입니다. 연수 자료 사이트는 여기에 해당할 가능성이 낮지만 판단은 사용자 몫입니다.
- **fine-grained 토큰 권한**: `POST /user/repos`는 Administration 쓰기, 파일 올리기(git blobs·trees·commits·refs)는 Contents 쓰기, `POST /repos/{owner}/{repo}/pages`는 Pages 쓰기 + Administration 쓰기. 앱의 미리 채운 주소(`administration=write&contents=write&pages=write`)와 맞습니다. 주소로 채울 수 있는 것은 `name`·`description`·`target_name`·`expires_in`(1~366 또는 `none`)·권한뿐이고, **Repository access**는 주소로 못 정합니다. ([permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens) · [URL parameters](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#pre-filling-fine-grained-personal-access-token-details-using-url-parameters))
- 브랜치에서 게시할 때 "관리자 권한과 **인증된 이메일**이 있는 사람이 올려야" 게시됩니다. 갓 가입한 계정이 막히는 지점입니다.
- API 2차 제한: 동시 100, "콘텐츠를 만드는 요청은 대체로 분당 80·**시간당 500**". 앱은 그림마다 blob을 하나씩 만들므로 그림이 450장을 넘으면 걸릴 수 있습니다 ⚠️(blob 생성이 이 제한에 드는지는 문서에 없음). ([rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api))

### 3.4 Netlify
- 300크레딧/월(하드 한도): 운영 배포 15, 전송 GB당 20, 1만 요청당 2. 다 쓰면 모든 프로젝트가 "Site not available". 다시 올릴 때마다 15크레딧이라 한 달 20번이 끝입니다.
- **비공개 기본**: §1의 1. 비공개 프로젝트는 팀 사람만 보고(무료·Personal은 소유자만), 다른 사람에게는 "권한 없음" 화면이 나옵니다. 공개 전환은 프로젝트의 **Make public** 또는 Project configuration → General → Visitor access → Project visibility. 팀 기본값은 Team settings → General → Visitor access → Default project visibility. API로 공개로 바꾸는 방법은 문서와 OpenAPI에 없습니다 ⚠️.
- 토큰: User settings → Applications → Personal access tokens → **New access token** → 이름 → **Expiration** → **Generate token**. 주소 `https://app.netlify.com/user/applications#personal-access-tokens`는 맞습니다.
- Drop: 계정 없이 올리면 1시간 안에 claim. claim 전에는 비밀번호로 잠겨 있고(CLI 소스에 고정 문구), 익명 배포는 하루 한도가 있습니다. claim하면 팀의 기본 공개 범위를 따릅니다(새 팀은 비공개).

### 3.5 그 밖 (다시 확인만)
- Firebase Hosting Spark: 저장 10GB, 전송 월 10GB, 넘으면 다음 달까지 꺼짐(문서 2026-11-10). CLI 필수.
- Azure Static Web Apps Free: 월 100GB, 앱당 250MB, 파일 15,000개, 도메인 2개. "개인 프로젝트용".
- Render 정적 사이트: 무료, Hobby 대역폭 월 5GB, Git 연결 필수.

## 4. 요즘 어디를 많이 쓰나

| 조사 | Cloudflare | Vercel | GitHub Pages | Netlify |
|---|---|---|---|---|
| Stack Overflow 2026(10-06 공개, 클라우드 문항 10,889명, 지난 1년 사용) | 24.6% | 10.7% | 항목 없음 | 5.6% |
| Stack Overflow 2025(2차 인용) | 20.1% | 10.6% | — | 5.9% |
| State of JS 2025(써 본 적 있음, 10,704명) | 3,041명(28%) | 4,703명(44%) | 4,541명(42%) | 3,180명(30%) |
| State of JS 2024(11,056명) | 2,299명(21%) | 4,430명(40%) | 4,146명(38%) | 3,131명(28%) |

Netlify는 제자리이거나 줄고, Cloudflare가 가장 빨리 늘었습니다. Vercel과 GitHub Pages는 JS 개발자 사이에서 AWS 다음입니다. 같은 SO 2026에서 Supabase는 6.9%, Firebase는 11.1%. Netlify 쪽 변화는 2025-09 크레딧 요금제, 2026-07 비공개 기본, 2026-08 배지입니다.
출처: [SO 2026 요약 기사](https://virtualizationreview.com/articles/2026/10/06/stack-overflow-survey-aws-leads-cloud-usage-azure-and-google-nearly-tied.aspx) · [State of JS 2025](https://2025.stateofjs.com/en-US/other-tools/) · [2024](https://2024.stateofjs.com/en-US/other-tools/)

## 5. 한국 망

- 2024-05: 국내 통신사 DNS에서 `*.vercel.app`이 열리지 않는다는 보고(LG 쪽으로 보고됨, 내 도메인을 붙이면 열림). 그 전에는 `r2.cloudflarestorage.com`이 막힌 적이 있습니다. 커뮤니티 글이 전부이고 공식 설명과 해소 시점은 없습니다 ⚠️. ([GeekNews](https://news.hada.io/topic?id=14759))
- 교육청·학교망이 `*.vercel.app`·`*.pages.dev`·`*.workers.dev`·`*.github.io`·`*.netlify.app`·`script.google.com`·`*.supabase.co`를 막는다는 공개 자료는 찾지 못했습니다 ⚠️. 학교마다 다르므로 지금처럼 `check.html`로 현장에서 확인하고, 막히면 내 도메인을 붙이는 길을 안내합니다.
- 기본 주소가 통째로 막히는 일은 실제로 있었으므로, 연수 전날 참가자 망에서 주소를 한 번 열어 보라는 안내는 호스팅과 무관하게 필요합니다.

## 6. 실시간 백엔드 (다시 확인)

| | 무료 범위 | 달라진 점 |
|---|---|---|
| **Supabase** | 활성 프로젝트 2개, DB 500MB, 파일 1GB, 전송 5GB(+캐시 5GB), 실시간 동시 200·초당 100메시지·월 200만, 방송 페이로드 256KB. 7일 저활동 정지(1주 전 메일, 1년 안 복구). 서울 `ap-northeast-2` | 키 이름: publishable(`sb_publishable_…`)·secret. `anon`·`service_role`은 2026년 말 폐지 예고 |
| **Apps Script** | 사용자당 동시 실행 30, 실행당 6분, URL Fetch 2만/일, 트리거 90분/일, 속성 500KB | 없음. 배포는 Deploy → New deployment → 톱니 → Web app. Gmail 계정이 올린 스크립트는 본인에게도 "확인되지 않은 앱" 화면이 나옴(앱의 안내 문구와 일치) |
| **Cloudflare DO** | Workers 요청 10만/일, DO 요청 10만/일·13,000GB-s/일, SQLite 읽기 500만 행/일·쓰기 10만 행/일·저장 5GB(객체당 1GB), 들어오는 WS 메시지 20:1, 쉬는 연결은 과금 없음 | Deploy to Cloudflare 버튼은 저장소를 **사용자의 GitHub/GitLab 계정에 복사**하므로 GitHub 계정이 필요 |
| Vercel 함수 | — | 실시간 서버로 쓸 수 없음(§3.1) |

흔한 조합은 Vercel·GitHub Pages·Cloudflare(정적) + Supabase(실시간)이고, Cloudflare는 정적과 실시간을 한 계정에 둘 수 있습니다. 인원 기준(시트 50명, Supabase 100명, 그 위 Cloudflare)은 바꿀 근거가 없습니다.
출처: [Supabase pricing](https://supabase.com/pricing) · [realtime limits](https://supabase.com/docs/guides/realtime/limits) · [pausing](https://supabase.com/docs/guides/platform/project-pausing) · [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas) · [web apps](https://developers.google.com/apps-script/guides/web) · [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) · [deploy buttons](https://developers.cloudflare.com/workers/platform/deploy-buttons/)

## 7. 앱 안에서 바로 공개하기

운영자 서버가 없는 지금, 브라우저만으로 한두 번에 끝나는 길이 있는지 봤습니다.

### 7.1 토큰 붙여 넣기 대신 로그인

| 서비스 | 비밀 없이 브라우저만으로 | 사실 |
|---|---|---|
| **Netlify** | **됨**(암시적 승인) | 현행 API 문서가 OAuth를 안내하며 2016년 글을 그대로 가리킴: `https://app.netlify.com/authorize?response_type=token&client_id=…&redirect_uri=…&state=…` → `#access_token=…`. "서버 코드 없는 단일 페이지 앱에서 쓸 수 있다". 앱 등록은 https://app.netlify.com/applications (User settings → Applications → OAuth). 지키는 장치는 등록해 둔 Redirect URI 하나뿐(그 주소로만 돌려보냄). 범위 구분은 없고 계정 전체 권한, 수명은 문서에 없음 ⚠️. 실제 동작은 시험하지 않음 ⚠️ |
| **Vercel** | 로그인은 됨, **배포는 아직 안 됨** | Sign in with Vercel은 클라이언트 인증 `none` + PKCE(S256)를 받고 토큰 엔드포인트(`api.vercel.com/login/oauth/token`)에 CORS가 있음. 액세스 토큰 1시간, 갱신 토큰 30일. 그러나 "API 요청·팀 자원 권한은 비공개 베타"라 Deployments 쓰기 권한을 일반 앱이 못 받음. 앱 등록: 팀 Settings → Apps → Create |
| **GitHub** | 안 됨(작은 중계 필요) | 웹 흐름은 PKCE를 받지만 `client_secret`이 필수. 문서는 공개 클라이언트면 비밀을 코드에 넣고 PKCE를 쓰라고 하면서도, 인증 엔드포인트는 "CORS preflight를 지원하지 않는다"고 적음. 기기 흐름은 비밀이 필요 없지만 같은 호스트(`github.com/login/…`). → `POST /login/oauth/access_token` 하나(기기 흐름이면 `/login/device/code`까지 둘)를 넘겨 주는 상태 없는 중계가 있으면 됨. OAuth 앱 토큰으로 Pages를 켜려면 `repo` 범위(비공개 저장소까지)가 필요 |
| **Cloudflare** | 로그인은 될 수 있음, 업로드는 중계 필요 | OAuth 클라이언트: Manage Account → OAuth clients → Create client. 브라우저 앱은 Authorization Code + PKCE, 토큰 인증 `none`. 누구나 쓰게 하려면(public) 클라이언트 주소의 도메인 소유를 TXT로 인증해야 함. API에 CORS가 없어 업로드 호출은 중계를 거쳐야 함. 필요한 scope 이름은 확인 못 함 ⚠️ |

미리 채운 토큰 주소: GitHub fine-grained는 지원(§3.3). GitHub classic의 `?scopes=…&description=…`은 널리 쓰이지만 현행 문서에 없습니다 ⚠️. Vercel과 Netlify 토큰 화면에는 미리 채우는 주소가 없습니다.

출처: [Netlify API 인증](https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/#authentication) · [Netlify OAuth 글](https://www.netlify.com/blog/2016/10/10/integrating-with-netlify-oauth2/) · [Sign in with Vercel](https://vercel.com/docs/sign-in-with-vercel) · [scopes](https://vercel.com/docs/sign-in-with-vercel/scopes-and-permissions) · [GitHub OAuth](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) · [best practices](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/best-practices-for-creating-an-oauth-app) · [Cloudflare OAuth](https://developers.cloudflare.com/fundamentals/oauth/integrate-with-cloudflare/)

### 7.2 계정 없이 올리기

| 서비스 | 방법 | 남는 조건 | 한도 | 학교에서 쓸 만한가 |
|---|---|---|---|---|
| Cloudflare Drop | 웹(끌어 놓기), `wrangler deploy --temporary`. REST는 백엔드 전용 | 60분 안에 claim, 아니면 삭제 | 1,000개, 파일당 5MiB | 미리 보기용. claim에 가입 필요 |
| Vercel Drop | 웹, `vercel deploy --temporary` | 화면에 나오는 시간 안에 claim | 파일당 100MB, 합계 1GB | 미리 보기용 |
| Netlify Drop | 웹, `netlify deploy --allow-anonymous` | 1시간 안에 claim | 하루 한도 있음 | claim 전에는 비밀번호로 잠겨 참가자가 못 봄 |
| here.now 등 새 서비스 | API | 익명 24시간(2차) | 2차 출처마다 다름 ⚠️ | 작은 회사, 약관·지속성 확인 안 됨 → 쓰지 않음 |
| tiiny.host | 웹(API는 유료) | — | 무료 3MB·1개(2차) | 용량이 안 됨 |
| GitHub Gist 등 우회 | — | — | — | 계정이 필요하고 원래 용도가 아님 → 쓰지 않음 |

셋 다 "지금 보고, 가입해서 보관"입니다. 계정 없이 연수 당일까지 남는 주소는 없습니다.

- 익명 배포 API는 둘 다 문서 밖입니다. Vercel CLI는 `POST /v1/anonymous/projects`로 임시 토큰을 받고(CLI 소스로 확인, CORS preflight는 통과), Netlify CLI는 OpenAPI에 없는 `/api/v1/drop/*`를 씁니다. 만료와 IP당 한도를 모르고(학교는 공인 IP 하나를 같이 씁니다) 언제든 바뀔 수 있으므로 여기에 기능을 얹지 않습니다 ⚠️.
- Vercel의 "Claim Deployments"는 제3자 서비스용입니다. 운영자 토큰으로 **운영자 팀에** 배포한 뒤 `POST /projects/{이름}/transfer-request`로 코드(24시간)를 받아 `https://vercel.com/claim-deployment?code=…&returnUrl=…`을 사용자에게 줍니다. 운영자 토큰을 숨길 서버가 필요하고, 넘겨받기 전까지는 운영자 팀이 호스팅합니다(Hobby로는 약관상 안 됨). ([claim deployments](https://vercel.com/docs/deployments/claim-deployments))

### 7.3 운영자가 대신 올려 주기 (lecpage Worker 하나가 `…/s/<id>/`로 제공)

Cloudflare 숫자(2026-11-11):

| 항목 | 무료 | Workers Paid(월 $5) |
|---|---|---|
| Worker 요청 | 하루 10만, 넘으면 오류 1027 | 월 1,000만 포함, 100만당 $0.30 |
| CPU | 요청당 10ms | 월 3,000만 ms 포함, 요청당 기본 30초(최대 5분) |
| 요청 본문 | 100MB(Cloudflare 요금제 기준, Free·Pro) | 같음 |
| 정적 자산(Worker에 같이 올린 파일) | 요청 무료·무제한 | 같음 |
| KV | 읽기 10만/일, **쓰기 1,000/일**, 1GB, 값 25MiB | 읽기 1,000만/월 등 |
| DO SQLite | 읽기 500만 행/일, 쓰기 10만 행/일, **합계 5GB**, 객체당 1GB, 행·BLOB 8MB | 월 250억/5,000만 행 포함, 5GB 포함 후 GB당 $0.20 |
| R2 | 10GB, A 100만·B 1,000만/월, 전송 무료. **가입(checkout) 필요** | GB당 $0.015, A 100만당 $4.50, B $0.36 |

- 한 Worker에 정적 자산과 코드를 같이 둘 수 있습니다. 자산과 맞는 주소는 코드를 돌리지 않고 무료로 나가고, 나머지만 코드로 갑니다. `run_worker_first`로 지정한 경로는 항상 코드를 거치며 무료 한도를 넘으면 429입니다. ([binding](https://developers.cloudflare.com/workers/static-assets/binding/))
- 캐시: Cache API는 **내 도메인에 붙은 Worker에서만** 동작합니다(`workers.dev`에서는 효과 없음). 새 "Workers Caching"은 Worker를 돌리지 않고 답하지만 **요청은 똑같이 셉니다**. 요청을 줄이려면 고정 파일은 정적 자산으로, 강사 파일은 R2에 내 도메인을 붙여 CDN으로 내보내야 합니다(`r2.dev` 주소는 시험용이라 속도 제한이 걸림). ([Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) · [Workers Caching](https://developers.cloudflare.com/workers/cache/) · [R2 limits](https://developers.cloudflare.com/r2/platform/limits/))
- 어림: 강사 1만 명/년, 사이트 20MB·150파일, 40명이 3번씩 보면 연수 한 번에 요청 약 1.8만. 전부 Worker를 거치면 월 평균 1,500만 요청 → Paid $5 + 초과 $1.5, R2 저장(90일 보관이면 약 50GB) $0.6, B 작업 $1.8 → **월 $9 안팎**. 무료만으로는 저장 5GB(사이트 250개)와 하루 10만 요청(연수 5~6회)에서 막힙니다.
- 한국에서의 `workers.dev`·내 도메인 접속 품질은 자료가 없습니다 ⚠️(§5).

운영자가 지게 되는 일(법률 자문 아님 ⚠️):
1. **정보통신망법 제44조의2**: 권리 침해를 주장하는 사람이 삭제를 요청하면 지체 없이 삭제·임시조치하고 신청인과 올린 사람에게 알려야 합니다. 판단이 어렵거나 다툼이 예상되면 30일 안에서 접근을 막는 임시조치를 할 수 있습니다. 조치의 내용과 절차는 약관에 미리 적어 두어야 합니다(제5항, 원문 대조 못 함 ⚠️). ([법령](https://www.law.go.kr/법령/정보통신망이용촉진및정보보호등에관한법률/제44조의2), [해설 2차](https://www.lawtimes.co.kr/news/166260))
2. **저작권법 제102조①3호**(저장 서비스 면책): 반복 침해자 계정 해지 방침, 표준 기술조치 수용, 침해로 직접 돈을 벌지 않을 것, 침해를 알면 즉시 중단, **중단 요구를 받을 사람을 지정해 공지**. 제102조③에 따라 미리 감시할 의무는 없습니다. ([제102조](https://www.law.go.kr/법령/저작권법/제102조))
3. **저작권법 제103조**: 중단 요구를 받으면 즉시 내리고 권리 주장자와 올린 사람에게 알립니다. 올린 사람이 소명하면 재개 예정일을 알리고 다시 올립니다. ([제103조](https://www.law.go.kr/법령/저작권법/제103조))
4. 교재에 출판사 교과서 그림과 학생 사진이 흔합니다. 운영자가 그 파일을 보관하면 개인정보를 맡아 처리하는 위치가 됩니다(`docs/operations.md` §2가 실시간 중계에 대해 적은 이유와 같습니다).
5. 한 도메인 아래 남의 HTML을 올려 주면 피싱 한 건으로 도메인 전체가 브라우저 경고에 걸릴 수 있습니다. 앱 도메인과 다른 등록 도메인이 필요하고, 임의 HTML·JS 대신 "고정된 lecpage 런타임 + 강사의 설계도·그림"만 받는 구조여야 위험이 내려갑니다.

### 7.4 순위와 권고

| 길 | 처음 공개까지 | 필요한 계정 | 남는 기간 | 운영자 위험 | 운영자 비용(1만 명/년) | 지금 가능 |
|---|---|---|---|---|---|---|
| A. 운영자 호스팅 | 1번 | 없음 | 운영자가 정함 | **큼**(§7.3) | 월 $9 안팎 + 신고 처리 | 새로 만들어야 함 |
| B. Vercel 토큰(브라우저 직접) | 가입 + 토큰(4~5동작), 다음부터 1번 | Vercel | 계속 | 없음 | 0 | **됨** |
| C. Vercel 로그인(PKCE) | 2번 | Vercel | 계속 | 없음 | 0 | 베타가 풀려야 함 |
| D. Netlify 로그인(암시적 승인) | 2번 + Make public | Netlify | 크레딧 안에서 | 없음 | 0 | 문서상 됨 ⚠️ |
| E. Cloudflare 로그인 + 상태 없는 중계 | 2번 | Cloudflare | 계속, 상업 가능 | 작음(토큰이 중계를 지나감) | 0(무료 한도 안) | 확인 필요 ⚠️ |
| F. GitHub 로그인 + 중계 | 2번 | GitHub | 계속 | 작음 | 0 | 중계 필요, `repo` 범위 |
| G. Cloudflare ZIP 끌어 놓기 | 가입 + 5동작 | Cloudflare | 계속 | 없음 | 0 | 됨 |
| H. GitHub 토큰 | 가입 + 토큰 | GitHub | 계속(저장소 공개) | 없음 | 0 | 됨 |

권고:
- **앱 기본 버튼은 B(Vercel)**. 지금 검증된 길 가운데 동작 수가 가장 적고, 새 계정도 바로 공개되고, 원본이 공개 저장소에 올라가지 않습니다. 버튼 아래에 "강사료를 받는 연수면 Cloudflare나 GitHub Pages를 고르세요" 한 줄을 둡니다.
- **"다른 방법"**: GitHub Pages(토큰) → Cloudflare(ZIP 끌어 놓기, Drop 링크) → Netlify(이미 쓰는 분) → 파일로 받기.
- **한두 번에 끝내려면** 순서는 C(Vercel에 베타 신청) → E(작은 Worker 하나, 내용은 저장하지 않음) 입니다. D는 싸게 붙일 수 있지만 공개 전환이 한 번 더 들고 Netlify 자체가 약해졌습니다.
- **A는 기본으로 두지 않습니다.** 계정 없는 1번 공개는 A뿐이지만 `operations.md`의 "운영자는 데이터를 맡지 않는다"를 뒤집고 신고 창구를 계속 지켜야 합니다. 넣는다면 기한 있는 미리 보기 링크(예: 14일)로, §7.3의 5번 구조와 약관·신고 주소를 갖춘 뒤에.
- **skill은 Cloudflare Workers 정적 자산(wrangler)을 먼저** 씁니다. 상업 이용 가능, 요청 무제한, `_headers` 그대로, 계정이 없어도 `--temporary`로 먼저 띄울 수 있습니다.

## 8. 결정 규칙

### 8.1 앱(브라우저만) — 정적 호스팅
위에서부터 처음 맞는 줄이 "추천"입니다.

| # | 조건 | 추천 | 까닭 |
|---|---|---|---|
| A1 | 가장 큰 파일 > 25MiB | GitHub Pages(파일 100MiB, 사이트 900MB까지). 그보다 크면 원본을 빼라고 안내 | Cloudflare 25MiB, Vercel 합계 100MB |
| A2 | 사이트 > 100MB | Cloudflare ZIP 끌어 놓기(파일 1,000개 이하) → 아니면 GitHub Pages | Vercel Hobby 업로드 100MB |
| A3 | 대가를 받는 연수 | Cloudflare ZIP 끌어 놓기. 다음은 GitHub Pages | Vercel Hobby는 비상업만 |
| A4 | 학교망이 기본 주소를 막음, 또는 내 도메인을 쓸 것 | Cloudflare Pages(하위 도메인 CNAME) | 도메인 연결이 가장 쉬움 |
| A5 | 그 밖 | **Vercel**(토큰) | §7.4 |

순서 조정: GitHub 계정만 있으면 GitHub Pages를 두 번째로 올립니다. Netlify는 이미 토큰을 저장해 둔 사용자에게만 위로 올립니다.

경고(맞는 것 모두):
- Vercel: 사이트 > 100MB 막음 / 파일 > 4,000개 경고(업로드 하루 5,000) / `인원 × 파일 수 × 3 > 80만` 경고(CDN 요청 월 100만) / 대가를 받는 연수 경고.
- Cloudflare 끌어 놓기: 파일 > 1,000개 또는 파일 > 25MiB 막음. Drop은 파일 > 5MiB도 막음.
- GitHub Pages: 사이트 > 900MB, 파일 > 100MiB 막음 / 공개 범위가 암호가 아니면 "저장소가 공개돼요" / 그림 > 450장 경고(§3.3).
- Netlify: `전송GB×20 + 배포×15 > 250` 경고 / 2026-07-28 이후 가입이면 "Make public을 눌러야 열려요".
- 암호 보호는 https에서만 → ZIP·USB에는 쓰지 않음(기존 G24).

### 8.2 skill(셸 있음) — 정적 호스팅

| # | 조건 | 고름 |
|---|---|---|
| S1 | 인터넷 없음 | 노트북(LAN) 또는 ZIP |
| S2 | 실시간이 node-server | 같은 서버 |
| S3 | 기관 AWS·Azure 계정 + 설정 가능 | S3+CloudFront / Azure SWA |
| S4 | 그 밖 | **Cloudflare Workers 정적 자산**. 로그인·토큰이 없고 1,000개·파일당 5MiB 안이면 `--temporary`로 띄우고 claim 주소를 강사에게 줌(60분) |
| S5 | 강사가 Vercel을 쓰거나 `VERCEL_TOKEN`이 있음, 대가 없는 연수 | Vercel |
| S6 | `gh` 로그인돼 있고 공개 저장소가 괜찮음 | GitHub Pages |
| S7 | Netlify를 이미 씀 | Netlify(새 팀이면 Make public 안내) |

대화 없이 도는 한 줄(모두 `--help`로 플래그 확인, wrangler는 `--dry-run`까지):
```bash
# Cloudflare Workers 정적 자산 (토큰: "Edit Cloudflare Workers" 템플릿)
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npx wrangler@4 deploy --assets ./dist --name lec-20261111 --compatibility-date 2026-11-11
# 계정이 아직 없을 때(60분 안에 claim)
npx wrangler@4 deploy --assets ./dist --name lec-20261111 --compatibility-date 2026-11-11 --temporary
# Cloudflare Pages (pages.dev 주소를 유지할 때)
npx wrangler@4 pages project create lec-20261111 --production-branch main
npx wrangler@4 pages deploy ./dist --project-name lec-20261111 --branch main
# Vercel (stdout이 배포 주소. 운영 주소는 https://lec-20261111.vercel.app)
VERCEL_TOKEN=… npx vercel@latest deploy ./dist --prod --yes --project lec-20261111 --create-if-missing   # 팀이 여럿이면 --scope <팀>
npx vercel@latest deploy ./dist --temporary          # 계정 없이
# GitHub Pages
cd dist && git init -b main && git add -A && git commit -m site \
  && GH_TOKEN=… gh repo create lec-20261111 --public --source=. --push \
  && gh api -X POST "repos/{owner}/{repo}/pages" -f 'source[branch]=main' -f 'source[path]=/'
# Netlify (다음부터는 --site <Project ID>)
NETLIFY_AUTH_TOKEN=… npx netlify-cli deploy --dir dist --prod --no-build --site-name lec-20261111
```
Vercel에는 `dist/` 맨 위에 `vercel.json`을, Cloudflare·Netlify에는 `_headers`를 둡니다.

### 8.3 실시간
지금 규칙(L01~L10)을 그대로 둡니다. 덧붙일 것 둘:
- Deploy to Cloudflare 버튼은 GitHub(또는 GitLab) 계정도 있어야 합니다 → G23 안내에 추가.
- 정적 호스팅이 Vercel·GitHub Pages여도 실시간은 Sheets·Supabase·cf-relay 그대로입니다(Vercel 안에 두지 않음).

## 9. 화면 문구

**Vercel 토큰**
1. [Vercel](https://vercel.com/signup)에 가입해요(이메일이나 GitHub 계정).
2. [토큰 페이지](https://vercel.com/account/tokens)에서 이름에 `lecpage`를 적고 **Scope**는 내 팀, **Expiration**을 고른 다음 **Create**를 눌러요.
3. 나온 토큰(`vcp_…`)을 복사해 아래에 붙여 넣어요. 토큰은 한 번만 보여요.
4. [주소 만들기]를 눌러요.
- 버튼 아래 한 줄: "Vercel 무료는 비상업 개인 용도예요. 강사료를 받는 연수면 Cloudflare나 GitHub Pages를 고르세요."
- 로그인 창이 뜨는 경우: "Vercel 프로젝트의 Settings → Deployment Protection에서 Vercel Authentication을 꺼 주세요."

**Cloudflare에 ZIP 올리기**
1. [Cloudflare](https://dash.cloudflare.com/sign-up)에 가입해요.
2. 왼쪽 **Workers & Pages** → **Create application** → **Get started** → **Drag and drop your files**.
3. 프로젝트 이름을 적어요. 주소가 `이름.pages.dev`가 돼요.
4. 받은 ZIP을 그대로 끌어다 놓고 **Deploy site**를 눌러요.
5. 고칠 때는 프로젝트에서 **Create a new deployment**를 누르고 새 ZIP을 놓아요. 주소는 그대로예요.
- 가입 없이 먼저 보려면: "[Cloudflare Drop](https://www.cloudflare.com/drop/)에 ZIP을 놓으면 주소가 바로 생겨요. 60분 안에 **Claim**을 눌러 가입해야 남아요."

**지금 앱에서 고칠 문구** (`Share.jsx`)
| 지금 | 문제 | 바꿀 말 |
|---|---|---|
| "Netlify로 주소 만들기 **추천**" | 새 계정은 비공개로 시작, 배지, 다시 올릴 때마다 15크레딧 | 추천 표시를 Vercel로 옮기고 Netlify는 "다른 방법"으로 |
| Netlify 3단계 "아래에 붙여 넣고 [주소 만들기]를 눌러요." | 올려도 참가자가 못 봄(2026-07-28 이후 팀) | 4단계 추가: "올린 뒤 Netlify 프로젝트 화면에서 **Make public**을 눌러요." |
| Netlify 2단계 "New access token → 이름 lecpage → Generate token" | Expiration 선택이 빠짐 | "**New access token** → 이름 lecpage → **Expiration** 고르기 → **Generate token**" |
| "무료 · 다시 올려도 같은 주소" (Netlify) | 맞지만 횟수 제한이 있음 | "무료(한 달 20번쯤) · 다시 올려도 같은 주소" |
| GitHub "맨 아래 Generate token을 눌러요. 권한은 미리 채워져 있어요." | Repository access는 주소로 못 채움 ⚠️ | "**Repository access**를 **All repositories**로 고르고 맨 아래 **Generate token**을 눌러요. 권한은 미리 채워져 있어요." |
| GitHub "처음에는 1~2분(길면 10분) 뒤 열려요" | 이메일 인증 전이면 게시되지 않음 | 뒤에 "GitHub 이메일 인증을 마친 계정이어야 해요." |
| ZIP 목록 "Cloudflare: 압축 푼 폴더를 끌어다 놓아요." | ZIP도 됨, 경로가 바뀜 | "Cloudflare: ZIP을 그대로 끌어다 놓아요(파일 1,000개까지)." |
| ZIP 목록 "Netlify Drop: 계정 없이 끌어다 놓아요. 1시간 안에 계정을 연결해야 해요." | 연결 전에는 비밀번호로 잠겨 있고, 새 계정은 연결 뒤에도 비공개 | "Netlify Drop: 1시간 안에 계정을 연결하고 **Make public**을 눌러야 참가자가 봐요." |

`deploy.js`의 `GITHUB_TOKEN_URL`, `NETLIFY_TOKEN_URL`은 지금 문서와 맞습니다.

## 10. Vercel API 배포 순서 (브라우저 구현용)

문서·OpenAPI·공식 CLI 소스(`@vercel/client`)·preflight로 확인했습니다. 끝까지 실행해 보지는 않았습니다 ⚠️.

공통: `Authorization: Bearer <토큰>`. Full Account 토큰으로 특정 팀에 올릴 때만 모든 주소에 `?teamId=…`. preflight가 허용하는 요청 헤더는 `Authorization, Accept, Content-Type`(+ `/v2/files`는 `x-vercel-digest`)뿐입니다. CLI가 쓰는 `x-now-size`는 보내지 않습니다.

1. (선택) `GET /v9/projects?limit=1` → 토큰 확인. 실패는 `403 {error:{code:"forbidden", invalidToken:true}}`. 팀 범위 토큰은 사용자 자원(`/v2/user`)이 막힐 수 있어 프로젝트 목록으로 확인합니다 ⚠️.
2. 파일마다 SHA-1(16진수)과 바이트 수를 구합니다(`crypto.subtle.digest('SHA-1', …)`). `vercel.json`을 넣고 `_headers`는 뺍니다.
3. `POST /v13/deployments?skipAutoDetectionConfirmation=1`
   ```json
   { "name": "lec-20261111", "target": "production",
     "projectSettings": { "framework": null },
     "files": [ { "file": "index.html", "sha": "<sha1>", "size": 1234 } ] }
   ```
   - `200` → 배포 객체(`id`, `readyState`, `alias`, `aliasAssigned`). 프로젝트가 없으면 이때 만들어집니다.
   - `400 {error:{code:"missing_files", missing:["<sha1>", …]}}` → 4로.
4. 빠진 파일만 `POST /v2/files`, 헤더 `Content-Type: application/octet-stream`, `x-vercel-digest: <sha1>`, 본문은 파일 바이트. `200`이면 끝. 5~10개씩 동시에, 5xx와 네트워크 오류만 다시 시도. 끝나면 3을 다시 부릅니다. 다음 배포부터는 바뀐 파일만 올라갑니다.
5. `GET /v13/deployments/{id}`를 2초마다. `readyState === "READY"`이고 `aliasAssigned`가 참이면 완료. `ERROR`·`CANCELED`면 `errorMessage`를 보여 줍니다. 5분에서 멈춥니다. 정적 파일은 보통 몇 초입니다.
6. 주소: `alias` 가운데 `.vercel.app`으로 끝나는 것. `name.vercel.app`이 있으면 그것, 없으면(이름이 이미 쓰임) 가장 짧은 것. `url`(배포별 주소)은 참가자에게 주지 않습니다.
7. 공개 확인: `GET /v9/projects/{name}`의 `ssoProtection`. `{deploymentType:"all"}`이면 운영 주소에도 로그인 창이 뜨므로 사용자에게 알리고, 동의하면 `PATCH /v9/projects/{name}`에 `{"ssoProtection":{"deploymentType":"all_except_custom_domains"}}`(또는 `null`).
8. 다시 올리기: 같은 `name`으로 2~6. 운영 주소가 새 배포로 옮겨 갑니다.

오류: `401/403 forbidden`(토큰 틀림·만료·범위 밖), `402`(결제 문제), `404 not_found`(팀·프로젝트), `409`(프로젝트 이전 중), `429 rate_limited`(하루 100배포·5,000업로드), `400 bad_request`(이름: 소문자·숫자·`.`·`_`·`-`, 100자, `---` 금지), 업로드 `400`(해시·크기 불일치), `aliasError`.

인라인(`{file, data, encoding:"base64"|"utf-8"}`)은 "작은 파일"용이고 한도가 문서에 없습니다. CLI는 HTML·MD 10개·5MB 이하일 때만, Vercel MCP 도구는 300개·파일당 3MiB·합계 4MiB까지만 씁니다. 그림이 있는 사이트는 4의 업로드 방식만 씁니다.

출처: [create deployment](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment) · [upload files](https://vercel.com/docs/rest-api/deployments/upload-deployment-files) · [errors](https://vercel.com/docs/rest-api/reference/errors) · [openapi.json](https://vercel.com/openapi.json) · [CLI upload.ts](https://github.com/vercel/vercel/blob/main/packages/client/src/upload.ts)

## 11. 확인 못 한 것

1. Vercel: 새 Hobby 계정에서 `이름.vercel.app`이 로그인 없이 열리는지 **실제 배포로는** 보지 않았습니다(문서 두 곳이 "운영 도메인은 공개"라고 하지만, 플랫폼용 문서는 "팀 기본값에 따라 `*.vercel.app`에 로그인 창이 뜰 수 있다"고 적습니다). §10의 7을 넣고 한 번 실제로 올려 확인해야 합니다.
2. Vercel: `/v2/files`의 파일당 크기 한도, 인라인 한도, API 업로드에도 합계 100MB가 그대로 적용되는지, 가입 때 구글 로그인·전화 인증 여부.
3. Vercel: 강사료를 받는 연수가 "상업 이용"인지(지원팀 답이 있어야 확정). Sign in with Vercel API 권한이 언제 열리는지. 익명 배포 API의 만료·한도.
4. Netlify: 암시적 승인의 실제 동작과 토큰 수명, API로 공개 전환·배지 끄기가 되는지, 사이트 크기 한도.
5. GitHub: `github.com/login/oauth/*`·`/login/device/code` 응답의 CORS(이 조사 환경의 프록시가 github.com 요청을 가로채 시험하지 못함), 토큰 템플릿 주소에서 Repository access의 기본값, blob 생성이 시간당 500 제한에 드는지.
6. Cloudflare: 대시보드 글자는 문서 기준(직접 보지 않음). Drop으로 만든 사이트를 브라우저에서 같은 주소로 다시 올리는 방법, Pages 끌어 놓기 횟수 한도, OAuth로 Workers에 올릴 때 필요한 scope와 OAuth 토큰에 대한 API CORS, R2 가입에 카드가 필수인지(문서는 "checkout"만).
7. 한국: 통신사 DNS의 `*.vercel.app` 차단이 지금도 있는지, 교육청·학교망 차단 목록, `workers.dev` 접속 품질.
8. 법: 조문은 국가법령정보센터 화면이 스크립트로 그려져 2차 출처로 대조했습니다(저작권법 시행 2026-10-29, 정보통신망법 시행 2026-10-02 판). 부가통신사업 신고, 청소년 보호책임자 같은 다른 의무는 보지 않았습니다.
9. Supabase 옛 키 폐지의 정확한 날짜("2026년 말"로만 적혀 있음).
10. here.now·tiiny.host·Stack Overflow 2025 수치는 2차 출처입니다.
