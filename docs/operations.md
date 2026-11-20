# lecpage 웹앱 운영 안내 (운영자용)

lecpage 웹앱을 올리고 지키는 사람을 위한 문서입니다. 기준일 2026-11-15. 운영자 유영재, 문의 hello@lecpage.com.
**원칙: 알림이 오지 않으면 할 일 없음.** 바로 배포 서버의 하루 점검(§10)이 놓치기 쉬운 일을 웹훅 한 통으로 모아 알리고, 월요일마다 '주간 점검'이 오면 알림 길도 살아 있다는 뜻입니다. 장애 때는 §13, 대시보드에서만 되는 일은 §14.
근거: [2026-11 점검 결정 기록](research/2026-11-review.md) · [호스팅 조사](research/hosting.md) · [앱 운영 조사](research/app-operations.md).

## 0. 지금 켜진 것

`main`에 push하면 아래 '자동'이 모두 다시 배포됩니다(결과: Cloudflare Worker의 **Deployments**, GitHub **Actions**). 그래서 push 전에 시험을 모두 통과시킵니다.

| 서비스 | 주소 | 배포 방법 | 비용 |
|---|---|---|---|
| 웹앱(Worker `lecpage`, 정적 자산) | https://lecpage.com | 자동: Workers Builds(저장소 맨 위) | 0원 |
| 웹앱 예비 주소(GitHub Pages) | https://yoorrard.github.io/lecpage/ | 자동: Actions `pages.yml` | 0원 |
| 바로 배포 서버(Worker `lecpage-sites`) | https://lecpage-sites.lecpage.workers.dev | 자동: Workers Builds(root `hosting`) | 0원(무료 요금제, `PLAN` free) |
| 바로 배포 사이트 보기(Pages `lecpage-view`) | `https://s-<id>.lecpage-view.pages.dev` | 서버가 배포마다 올림. 마지막 배포 뒤 60일 보관 | 0원 |
| 관리 화면(Worker `lecpage-admin`) | https://lecpage-admin.lecpage.workers.dev/admin/ | `npm run setup`이 배포. 자동 배포는 Workers Builds 연결 한 번(§14), 그 전에는 바꿀 때 `npm run deploy:admin`. Cloudflare Access, 메일 일회용 번호 | 0원(Zero Trust Free) |
| 도메인 `lecpage.com` | Cloudflare Registrar | 자동 갱신 | 연 $11.17 |
| 문의 메일 `hello@lecpage.com` | Email Routing → 운영자 Gmail | — | 0원 |

## 1. 결정 요약

| 항목 | 결정 | 이유 |
|---|---|---|
| 구조 | **로컬 우선 정적 PWA**. 쪽 그림 그리기·사이트 조립·검수·미리보기·ZIP 만들기를 브라우저에서(교재 읽기와 사이트 쓰기는 사용자가 고른 AI가 하고, 교재 원본은 브라우저에서 그 AI 회사로 바로 감) | 서버가 없으면 운영비·장애·개인정보 책임이 사라짐 |
| 호스팅 | **Cloudflare Workers 정적 자산**, GitHub 연결(Workers Builds)로 자동 배포. 저장소 맨 위 [`wrangler.jsonc`](../wrangler.jsonc) | 정적 요청 무료·무제한, 상업 이용 가능, `_headers` 적용, 한도에서 과금 대신 오류. Cloudflare가 새 프로젝트는 Pages보다 Workers로 시작하라고 안내 |
| 도메인 | **lecpage.com**(Cloudflare Registrar, 연 $11.17, 갱신도 같은 값. 2026-11-14 등록) | DNS 작업 없음. Workers 내 도메인은 어차피 Cloudflare 영역이 필요. 2026-11-09 현재 후보 모두 미등록 → 빨리 등록 |
| 미러 | **GitHub Pages**(`https://yoorrard.github.io/lecpage/`), [`.github/workflows/pages.yml`](../.github/workflows/pages.yml)로 자동 | 이미 연결됨, 0원, Cloudflare와 다른 장애 영역. 헤더를 못 바꿔 보안은 약함 → 예비용 |
| 로그인 | **없음** | 계정을 저장하면 운영자가 개인정보처리자가 됨. 필요한 연결(AI·Vercel·GitHub·Netlify)은 사용자 키·토큰을 그 브라우저에서만 씀 |
| 저장 | IndexedDB(프로젝트·이미지) + `.lecpage` 파일 내보내기/열기 + 저장 공간 보호(persist) | 다른 PC로 옮기기, 공용 PC 정리 |
| AI | 사용자 키(BYOK) · 쓰던 AI 창에 복사·붙여넣기 · 내 PC의 Claude Code·Codex(연결 프로그램) · Agent Skill · 먼저 해보기(예시 교재, 키 없음) | 운영자 AI 비용 0. 구독 로그인 재사용은 약관 위반이라 구현하지 않음 |
| 실시간 | **운영자 공용 중계 없음**. 바로 배포 사이트에 딸린 방만 맡음(§10). 강사 소유 백엔드를 쉽게: 클릭만 하는 50명 이하 연수는 Google Sheets(앱 안 안내 + 연결 확인), 가입 가능한 강사는 Deploy to Cloudflare 버튼 | 아래 §2 |
| 생성 사이트 | 기본 공개 범위 "링크"(noindex + robots.txt Disallow). 선택: 공개·암호(AES-GCM, PBKDF2 60만 회). 강사용 파일은 올리는 사이트에서 빠짐 | 교재 저작권, GitHub Pages 무료는 공개 저장소 |
| 분석 | **없음.** Cloudflare Workers 대시보드의 요청 수만 봄 | 쿠키·추적 없음. 처리방침이 단순해짐 |
| 오류 보고 | **GitHub 이슈**로 받음(자동 오류 수집 없음) | 개인정보 없는 운영 |
| 비용 | 월 1천·1만·5만 명 모두 **도메인 값(연 약 $11)뿐** | 아래 §8 |

앱 호스트로 쓰지 않는 곳: **Vercel**(Hobby는 비상업만, 후원·강사료가 얽히면 위반 소지) · **Netlify**(무료 300크레딧/월 하드 한도, 넘으면 계정 전체가 멈춤) · **Firebase Hosting**(월 10GB 넘으면 다음 달 1일까지 꺼짐) · **Deno Deploy**(2027년 4월 무렵 종료 예정) · **Render**(월 5GB 넘으면 그 달 내내 멈춤).

## 2. 공용 실시간 중계를 운영하지 않는 이유

| 이유 | 설명 |
|---|---|
| 개인정보 책임 | 참가자 별명·질문·이름을 운영자 서버에 두면 운영자가 개인정보 처리자(또는 수탁자)가 됩니다. 처리방침, 안전조치, 국외 이전 고지, 유출 신고, 파기 의무가 생깁니다. |
| 무료 한도가 공격 대상 | Workers·Durable Objects 무료 한도(하루 10만 요청)를 모든 연수가 나눠 씁니다. 한 사람이 한도를 다 쓰면 그날 모든 연수가 멈춥니다. |
| 남용·삭제 의무 | 불법·유해 게시물 신고를 받고 지우는 절차(정보통신망법 임시조치)를 운영자가 맡아야 합니다. |
| 비용이 사용자 수에 비례 | 쓰는 사람이 늘면 유료 플랜이 필요해집니다. 결제 수단 없는 운영 원칙과 맞지 않습니다. |

대신 하는 것
- **클릭만 하는 강사 + 50명 이하 → Google Sheets**(앱 안 연결 안내·연결 확인 `?a=ping`), 가입할 수 있는 강사는 **Deploy to Cloudflare** 버튼(`skills/lecpage/backends/cloudflare/README.md`).
- 다시 검토할 때의 최소 통제 목록은 [결정 기록](research/2026-11-review.md) §5.3에 있습니다.
- 바로 배포 서버(§10)를 켜 두었으므로 위 표의 책임을 그 범위에서 집니다. 아무 코드나 받는 공용 중계가 아니라, 그 호스트에 올라온 사이트에 묶인 방만 받고 사이트와 함께 지웁니다.

## 3. Cloudflare 설정 (처음 한 번)

### 3.1 준비
1. https://dash.cloudflare.com/sign-up 로 운영용 계정을 만들고 **2단계 인증**을 켭니다(보안 키나 패스키 권장).
2. 저장소 맨 위에 [`wrangler.jsonc`](../wrangler.jsonc)가 있는지 확인합니다. `main`이 없어서 코드 없는 "정적 자산 전용" Worker입니다. `assets.directory`는 `./app/dist`, `not_found_handling`은 `404-page`(`app/public/404.html`)입니다.

### 3.2 Worker 만들기(Workers Builds)
1. 대시보드 → **Workers & Pages** → **Create application** → **GitHub** → Cloudflare GitHub 앱을 `yoorrard/lecpage` **한 저장소에만** 허용 → 저장소 선택.
2. 설정을 이렇게 넣습니다.

| 칸 | 값 |
|---|---|
| Project / Worker name | `lecpage` (`wrangler.jsonc`의 `name`과 같아야 함) |
| Build command | `npm ci && npm --prefix app ci && npm --prefix app run build` |
| Deploy command | `npx wrangler deploy` (맨 위 `package.json`·`package-lock.json`에 고정한 wrangler 판을 씀. Dependabot이 판 올림·보안 수정을 챙김) |
| Root directory | 비움(저장소 맨 위) |
| 빌드 변수(선택) | `NODE_VERSION=22` (기본 이미지는 Node 24) |

3. **Save and Deploy**. 1~3분 뒤 `https://lecpage.<계정>.workers.dev`에서 열립니다(`preview_urls: false`라 버전별 미리보기 주소는 없음).

### 3.3 빌드 감시 경로
Worker → **Settings → Build → Build watch paths**: 포함 `app/*`, `skills/lecpage/engine/*`(앱이 `@engine`으로 가져옴), `wrangler.jsonc`, `package.json` · 제외 `docs/*`, `skills/lecpage/backends/*`. 파일 변경 0개, 3,000개 넘는 파일·20개 넘는 커밋은 경로와 상관없이 빌드합니다. 무료 빌드는 월 3,000분·동시 1개·한 번에 20분.

### 3.4 켜지 말 것
- **Workers Caching**: 켜면 캐시된 정적 응답도 요금·한도에 들어갑니다.
- **`run_worker_first`**: 그 경로가 하루 10만 요청 한도에 들어가고, 넘으면 429가 납니다.
- 이 둘을 끄고 있으면 정적 요청은 **무료·무제한**이고 한도와 관계없습니다.
- **Web Analytics**(자동 설정): 끕니다. 처리방침에 분석 도구가 없습니다. 앱 HTML의 `no-transform`이 스크립트 끼워 넣기도 막습니다.

### 3.5 내 도메인 연결
1. 도메인을 먼저 삽니다(§5).
2. Worker → **Settings → Domains & Routes → Add → Custom domain** → `lecpage.com`. DNS 레코드와 인증서가 자동으로 생깁니다.
3. 원하면 `www.lecpage.com`도 추가하고 **Rules → Redirect Rules**로 `lecpage.com`에 301.
4. 도메인이 붙으면 `workers.dev` 주소는 꺼도 됩니다(`wrangler.jsonc`의 `workers_dev: false`). 학교 필터가 `workers.dev`를 막는 경우가 있고, Cloudflare도 실제 서비스에는 내 도메인을 권합니다.

### 3.6 확인하기
- `curl -sI https://lecpage.com/ | grep -i -E "content-security|x-frame-options|cross-origin-opener|strict-transport"` → `app/public/_headers`의 값이 보여야 합니다(`frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`, HSTS 1년). GitHub Pages 미러에서는 무시되는 헤더라, 여기서부터 실제로 적용됩니다. 지금 앱은 팝업 로그인이 없어 문제없습니다. 나중에 Google 로그인 같은 팝업을 넣으면 COOP를 `same-origin-allow-popups`로 바꿉니다.
- `https://lecpage.com/cdn-cgi/trace`의 `colo=`로 어느 데이터센터가 응답하는지 봅니다(`ICN`=서울). 한국 통신사에 따라 해외(NRT·HKG·LAX 등)로 가는 일이 있다는 2026년 보고가 있습니다 ⚠️. PWA라 첫 방문만 영향을 받습니다.
- 없는 주소(`/없는-주소`)가 `404.html`을 보여 주는지, 새 배포 뒤 앱을 새로 고치면 바뀐 내용이 보이는지(서비스 워커 갱신) 확인합니다.

### 3.7 되돌리기
- Worker → **Deployments**에서 이전 버전으로 되돌리거나, 저장소에서 문제 커밋을 `git revert`해 다시 배포합니다.
- Cloudflare 전체가 문제면 GitHub Pages 미러 주소를 공지합니다(§4).

## 4. GitHub Pages 미러 (처음 한 번)
1. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 바꿉니다.
2. `main`에 올리면 'Deploy app to GitHub Pages' 워크플로가 `https://yoorrard.github.io/lecpage/`에 올립니다. 처음에는 **Actions** 탭에서 직접 한 번 실행해도 됩니다.
3. 미러는 응답 헤더를 바꿀 수 없어 CSP를 `<meta>`로만 넣습니다(`frame-ancestors`·X-Frame-Options·COOP 없음). 같은 `yoorrard.github.io` 출처를 다른 저장소 사이트와 나눠 씁니다. 그래서 **안내하는 주소는 lecpage.com 하나**로 하고, 미러는 장애 때만 알립니다(월 100GB 권고 한도).

## 5. 도메인 사기 체크리스트
- [ ] Cloudflare 계정 2단계 인증이 켜져 있다.
- [x] **Domain Registration**에서 `lecpage.com` 등록(등록·갱신 $11.17, 결제 수단은 도메인 값에만 씀)과 Worker에 붙이기(§3.5).
- [ ] 등록자 연락처를 정확히 넣는다. WHOIS 공개 정보는 Cloudflare가 가려 줍니다.
- [ ] **자동 갱신**이 켜져 있고, 결제 수단 만료일이 갱신일보다 뒤다. 만료 알림을 받을 메일을 확인한다.
- [ ] **이전 잠금**(transfer lock)이 켜져 있다.
- [x] **Email Routing**을 켜고 `hello@lecpage.com`(문의·보안 신고용)을 운영자 메일로 전달한다. 받기 전용이며 무료입니다. 필요한 DNS 레코드는 자동으로 추가됩니다. 이 주소를 README·SECURITY.md·앱 개인정보 안내에 적는다.
- [ ] (선택) 한국 주소 `lecpage.kr`(가비아 연 약 ₩22,000, 네임서버를 Cloudflare로, 본인 인증 필요할 수 있음)이나 짧은 주소 `lec.page`($10.20, 프리미엄일 수 있음 ⚠️)는 필요해질 때 검토.

## 6. 운영자 보안 점검표
- [ ] **2단계 인증**: GitHub(보안 키·패스키), Cloudflare, 도메인 등록업체(= Cloudflare). 복구 코드를 오프라인에 보관한다.
- [ ] **공동 관리자 1명**을 정해 두고(GitHub 저장소 관리자, Cloudflare 계정 멤버), 권한은 필요한 만큼만.
- [ ] Cloudflare: 앱·서버 배포는 Workers Builds가 자체 토큰을 쓴다. `npm run setup`용 API 토큰은 끝나면 지운다(서버는 Pages 전용 토큰만 씀). Cloudflare GitHub 앱은 이 저장소만 허용.
- [ ] Workers는 **Free 플랜 유지**. 한도에서 오류가 날 뿐 요금이 청구되지 않습니다.
- [x] GitHub `main` **규칙 집합**: 강제 푸시·삭제 금지. PR 필수는 쓰지 않음(main push가 곧 배포라 push 전에 시험 통과).
- [ ] **Dependabot alerts**와 보안 업데이트를 켠다(npm `/app`·`/hosting`·`/skills/lecpage/backends/cloudflare`, Docker `node-server`, GitHub Actions — `.github/dependabot.yml`).
- [x] **Private vulnerability reporting**을 켠다(**Settings → Security**). `SECURITY.md`에 신고 방법과 `hello@lecpage.com`을 적는다.
- [ ] **Secret scanning**과 push protection을 켠다(공개 저장소 무료).
- [ ] Actions 기본 권한은 읽기 전용(**Settings → Actions → Workflow permissions**).
- [ ] 개인정보 안내 페이지(앱 `#/help/privacy`)가 실제 동작(분석 없음, 오류 수집 없음, 사용자 키와 교재 원본은 브라우저에서 AI 회사로 직접, 내 PC 연결 프로그램은 127.0.0.1)과 맞는지 배포 때마다 본다.

## 7. 정기 할 일

정해진 날에 들여다볼 곳을 줄이고, 알림이 오는 일만 합니다. 알림은 모두 같은 웹훅(바로 배포 서버의 `ALERT_WEBHOOK`, 없으면 `REPORT_WEBHOOK`)과 GitHub 알림 메일로 옵니다.

| 언제 | 할 일 |
|---|---|
| 신고 알림('신고 #N')이 오면 | 관리 화면 **신고**에서 내용을 보고 가리거나(임시조치) 지우고 [처리함]. 권리 침해 신고는 지체 없이. 24시간 안에 처리하지 않으면 하루 점검이 날마다 다시 알림 |
| 하루 점검 '확인할 일'이 오면(오전 9시쯤) | 적힌 일만: 처리 안 된 신고 · 가린 지 25일 넘은 사이트(30일 안에 풀거나 지우기) · 지우지 못한 사이트(§13 '지우는 중') · AI 정보 파일 묵음(§12) |
| 월요일 오전 9시쯤 | '주간 점검' 한 줄이 왔는지만 봄. 안 왔으면 관리 화면 맨 위(마지막 점검·웹훅 결과)와 §13 '웹훅이 오지 않음' |
| GitHub 알림 메일이 오면 | '[자동] AI 정보 점검 필요' 이슈는 §12.1 · Dependabot PR(한 달에 한 번, 항목마다 minor·patch 묶음 하나)은 CI(시험·문구 검사·앱 짧은 흐름·audit)가 통과하면 병합 · CI 실패 메일은 그 커밋을 고침 |
| 분기에 한 번 | 메이저 판(Dependabot이 일부러 올리지 않음): `npm outdated --prefix app`으로 보고 하나씩 올려 `npm --prefix app run build`·`node app/scripts/smoke.mjs`·e2e로 확인. pdf.js는 보안 수정 판 이상 |
| 매달 | 답을 마친 지 1년 지난 문의 메일을 메일함·휴지통에서 지우기(처리방침 1·7번. Gmail 필터 `older_than:1y`로 찾으면 빠름) · Cloudflare API 토큰 목록에서 다 쓴 토큰 지우기 |
| 매년 10월 | Node LTS 올리기(CI·워크플로 `node-version`, Workers Builds `NODE_VERSION`, `skills/lecpage/backends/node-server/Dockerfile`·`templates/deploy/server/`의 `node:<판>-alpine`을 한 번에. Node 22는 2027-04-30 수명 끝) · `app/public/.well-known/security.txt`와 `hosting/public/.well-known/security.txt`의 `Expires`를 1년 뒤로 · `lecpage.com` 자동 갱신과 결제 수단 만료일 · 2단계 인증 복구 코드 · [호스팅 조사](research/hosting.md)의 한도·약관(값이 바뀌면 `hosting/src/config.js`·`capacity.js`) |

## 8. 비용

| 월 사용자(MAU) | 앱 전송량(첫 방문 약 3MB, 이후 캐시) | Cloudflare | GitHub Pages 미러 | 합계 |
|---|---|---|---|---|
| 1,000 | 약 3GB | 0원 | 0원 | **도메인 값만**(연 약 $11) |
| 10,000 | 약 30GB | 0원 | 0원 | **도메인 값만** |
| 50,000 | 약 150~180GB | 0원(정적 무제한) | 0원(평소 안 씀. 전부 몰리면 월 100GB 권고 초과) | **도메인 값만** |

- 내 계정에 배포한 사이트와 강사가 연결한 참여 기능은 **강사 본인 계정**이라 운영자 비용이 아닙니다. 바로 배포(§10)는 무료 요금제 안에서만 돌고 붐비면 강사 계정으로 넘겨 0원입니다.
- AI·호스팅·DB는 사용자 각자의 무료 등급이나 구독을 씁니다.

## 9. 다시 검토할 신호
- Cloudflare가 정적 자산 요금·무료 한도를 바꾸거나 Workers Builds 무료 빌드 시간(월 3,000분)에 가까워짐 → 감시 경로를 줄이고, 그래도 안 되면 미러를 기본으로.
- 한국 사용자의 첫 접속이 계속 느리다는 신고가 쌓이고 `colo=`가 대부분 해외 → AWS CloudFront 정액제 Free(월 100GB, 서울 엣지) 같은 대안을 측정해 비교.
- GitHub에서 미러 트래픽 경고 메일이 오거나 후원·유료 기능이 생김 → GitHub Pages 약관(상업 SaaS 금지) 다시 확인.
- 앱에 팝업 로그인(Google 등)을 넣음 → COOP를 `same-origin-allow-popups`로, CSP에 해당 주소 추가.
- 앱 CSP를 더 좁히고 싶음 → 미리보기를 **별도 출처**(다른 등록 도메인)로 옮기는 작업을 시작(결정 기록의 M6).
- 클릭만 하는 강사가 Sheets 연결에서 계속 실패하고 "설치 없는 실시간" 요청이 압도적 → 공용 중계를 다시 검토하되, 결정 기록 §5.3의 통제(서버 발급 방 ID, Turnstile, 하루 상한, 별명만, 자동 삭제, 신고 창구, 법률 검토)를 모두 갖춘 뒤에만.
- 도메인 갱신 값이 바뀜 → 다른 등록업체로 이전 검토.

## 10. 바로 배포 서버 (켜짐)

가입·토큰 없이 [배포하기] 한 번으로 주소가 나오게 하는 서버입니다. 코드 [`hosting/`](../hosting/), 설정·신고 처리·한도·끄기 [`hosting/README.md`](../hosting/README.md).

| 항목 | 지금 |
|---|---|
| 앱에 보이는 곳 | 운영자 주소(lecpage.com·www·예비 주소)에서 연 앱은 빌드 변수 없이 운영 서버를 씀([`app/src/lib/publish-api.js`](../app/src/lib/publish-api.js)). 다른 주소·포크는 `VITE_PUBLISH_API`를 넣어야 보임 |
| 맡는 것 | 사이트 파일(Pages, 사이트마다 `s-<id>` 주소)과 딸린 실시간 방(별명·질문·보드 파일). **마지막 배포 뒤 60일** 보관(방문으로 늘지 않음), 끝나면 그 주소에 '보관 기간이 끝났어요' 안내만 남김. 강사가 앱의 [사이트 내리기]로 지우면 '강사가 사이트를 내렸어요'로 나눔(확인 창에서 지워질 참여 기록 수를 보여 줌). 연수 날이 보관 기간 뒤면 앱 배포 화면이 다시 배포할 때를 알림. 방만 빼려면 `LIVE=off` |
| 운영자 책임 | §1의 "서버 없음"이 이 범위에서 바뀜: 신고 창구(정보통신망법 임시조치, 저작권법 제102·103조), 참여 기록 수탁자(처리방침 9번), 기간 안에서만 보관 |
| 요금제 | `PLAN` free: 하루 몫 45%부터 연수 날짜가 14일 안인 것만, 60%부터 새 사이트는 같은 파일 그대로 강사 계정으로. 오늘 연수·배포한 사이트는 그대로 열림. 유료 전환은 README §4의 4줄(구독 → 두 wrangler 설정에 `PLAN` 커밋 → push → Workers·DO 지출 한도). 유료에서도 하루 예산 100만(월 약 $15 상한)이 기본. 근거 [`scale-2026-11.md`](research/scale-2026-11.md) §5, [`zero-cost-2026-11.md`](research/zero-cost-2026-11.md) |
| 하루 점검 | cron 매일 한국 시간 오전 9시 7분: 처리 안 된 신고(24시간)·가린 지 25일·지우지 못한 사이트(6시간)·AI 정보 파일 묵음(3일)을 웹훅 한 통으로, 월요일엔 주간 요약. 웹훅이 없으면 관리 화면 맨 위에만. 표와 기준 [`hosting/README.md`](../hosting/README.md) §10 |
| 관리 화면 | `lecpage-admin`(§0): 이용량·30일 추이·권하는 행동(처리 안 된 신고 먼저)·신고·팝업 공지·새 배포 멈춤·감사 기록. 근거·보안 검토 [`admin-2026-11.md`](research/admin-2026-11.md) |
| 받는 사이트 | 엔진 템플릿 사이트와 AI가 직접 쓴 사이트(`assets/site.js` 등 사이트 스크립트 포함). 사이트 스크립트는 Pages 보기(사이트마다 다른 출처)에서만 돌고, 이 호스트의 두 번째 주소(`/s/<id>/`)에서는 엔진 스크립트만. 비밀번호 칸·로그인 흉내·바깥으로 보내는 양식·서비스 워커는 올릴 때 거절(앱이 까닭을 그대로 보여 줌). 사이트 쪽 CSP의 연결은 그 사이트의 방만. 규칙 [`hosting/README.md`](../hosting/README.md) §6 |
| CSP로 못 막는 것 | 사이트 스크립트가 입력값을 주소에 붙여 다른 사이트로 이동시키기, 그 사이트의 방에 적어 두었다가 강사 화면에서 읽기. **신고가 오면 먼저 가리기**(사이트·방이 함께 닫힘, 가려 둔 채로 확인) → 피싱·개인정보 수집이 맞으면 지우기. 같은 수법이 되풀이되면 그 모양을 `hosting/src/sitecheck.js` 거절 규칙에 더함(잘못 걸리는 일이 적은 단순한 규칙만) |

## 11. 구글 시트 틀 미리 만들어 두기 (선택)

강사가 구글 시트로 참여 기능을 연결할 때 코드를 붙여 넣는 단계를 없애 줍니다.
1. 운영용 구글 계정으로 새 시트를 만들고 **확장 프로그램 → Apps Script**에 `skills/lecpage/backends/apps-script/Code.gs`를 붙여 넣어 저장합니다(배포는 하지 않습니다).
2. 시트를 **링크가 있는 모든 사용자 · 뷰어**로 공유하고, 주소 끝의 `/edit…`을 `/copy`로 바꾼 주소를 준비합니다.
3. 앱을 빌드할 때 `VITE_SHEET_TEMPLATE`에 그 주소를 넣습니다(GitHub Pages 미러는 저장소 변수 `LECPAGE_SHEET_TEMPLATE`).
- 그러면 앱의 안내가 "시트 사본 만들기 → 웹 앱으로 배포 → 주소 붙여넣기"로 줄어듭니다. `Code.gs`가 바뀌면 틀도 새로 만들어 주소를 바꿉니다.
- 틀에는 자료를 넣지 않습니다. 사본은 강사 계정에 만들어지고 운영자는 볼 수 없습니다.

## 12. AI 정보 매일 갱신 (자동, 2026-11-14부터)

모델 값·출시일·Gemini 무료 등급은 몇 주마다 바뀝니다. 그래서 GitHub Actions의 'AI catalog' 워크플로([`.github/workflows/ai-catalog.yml`](../.github/workflows/ai-catalog.yml))가 **매일 한국 시간 새벽 4시 43분쯤** 공개 목록을 모아 `app/public/ai-catalog.json` 하나만 고쳐 `main`에 올립니다. 앱은 이 파일을 먼저 읽고 OpenRouter 실시간 목록이 오면 덮어씁니다. 근거와 설계: [AI 사실 문서 §7](research/ai-facts-2026-11-14.md).

- **자동으로 바뀌는 것**: `ai-catalog.json`뿐. 값이 바뀌면 커밋하고, 값이 그대로면 '네 출처를 모두 받은 날'(`checked`)만 이틀에 한 번 새로 적어 커밋합니다(날마다 배포가 생기지 않게). 검사(급감·값이 한꺼번에 1/5~5배 밖·앞 판에 있던 추천이 빔·형식)에 하나라도 걸리면 그 파일도 그대로 둡니다.
- **멈춤 감지**: 바로 배포 서버의 하루 점검이 `https://lecpage.com/ai-catalog.json`의 `checked`가 3일 넘게 묵으면 웹훅으로 알립니다(예약이 꺼졌거나 실패가 이어질 때도). 출처를 3일 넘게 다 받지 못하면 이슈에도 '모두 받은 마지막 날(N일 전)'이 사람이 볼 일로 올라옵니다.
- **배포**: 봇 커밋도 Cloudflare Workers Builds가 다시 배포합니다(`app/*` 감시 경로, 하루 1번 이하라 무료 빌드 시간 월 3,000분 중 한 달 60분 안팎). GitHub Actions의 토큰으로 올린 커밋은 다른 워크플로를 깨우지 않아 GitHub Pages 미러는 다음 사람 커밋 때 함께 반영됩니다(미러는 예비용이라 괜찮음).
- **권한**: 저장소 기본 권한이 읽기 전용(§6)이어도, 이 워크플로는 필요한 권한(`contents: write`·`issues: write`)만 스스로 적어 두어 동작합니다.
- **main 규칙**: 지금 규칙(삭제·강제 push 금지)과 맞습니다(빨리 감기로만 올리고, 그사이 main이 바뀌면 다시 얹어 세 번까지). §6처럼 'PR 필수'를 켜면 봇의 바로 올리기가 막히니, 그때는 이 워크플로를 규칙의 예외(우회 목록에 GitHub Actions)로 두거나 끕니다.

### 12.1 이슈 '[자동] AI 정보 점검 필요'가 오면

이슈 본문의 '사람이 볼 일'을 위에서부터 봅니다. 같은 문제가 계속되면 댓글이 다시 달리지 않습니다(다 고친 뒤 이슈를 닫으면 됩니다).

| 이슈 문구 | 뜻 | 할 일 |
|---|---|---|
| 문서·코드에 적힌 모델 이름이 지금 목록에 없어요 | 화면 안내·주석에 적힌 모델이 사라졌거나 이름이 바뀜 | 적힌 파일:줄의 문구를 지금 이름으로. 일부러 옛 이름을 둘 줄에는 `ai-catalog-ok` 주석 |
| … 추천이 바뀌었어요: A → B | 앱이 고르는 모델이 바뀜(앱은 알아서 따라감) | 안내 문구에 옛 추천 이름이 있으면 고침. 그 회사 공식 문서의 권장과 맞는지 한 번 봄 |
| Gemini 무료 등급 목록이 바뀌었어요 | 무료 키로 되는 모델이 늘거나 줄었음 | `ai-guides.jsx`(Gemini 한 줄·무료로 쓸 때)와 `AiConnect.jsx` 무료 키 안내가 맞는지 |
| … 브라우저에서 바로 부를 수 없게 바뀌었어요 | 그 회사 API가 lecpage.com의 CORS 사전 요청을 거절 | 그 회사 키 연결이 안 됨. 공식 문서를 확인하고 `ai.js`(머리글)·안내를 고치거나, 그동안 키 연결 창에서 그 회사를 뒤로 |
| 앱이 여는 주소가 열리지 않아요(404) | 키·결제 화면, 쓰던 AI 창 주소가 바뀜 | `ai.js`의 `PROVIDERS`(keyUrl·billingUrl)·`CHATBOTS` 주소와 키 안내 |
| …을 받지 못했어요(404 등) · 표가 검사에 걸려 앞 판 값을 썼어요 | 출처 주소나 문서 형식이 바뀜 | `scripts/ai-catalog/lib.mjs`의 `SOURCES`·해석 함수를 고치고 `node --test "scripts/ai-catalog/test/*.test.mjs"` |
| 검사에 걸려 …을 바꾸지 않았어요 | 받은 자료가 이상함(급감·값 오류 등). 앱은 앞 판으로 그대로 동작 | '갱신을 거부한 까닭'을 보고, 진짜 변화(예: 회사가 모델을 크게 정리)면 `LIMITS`를 그 판만 풀어 한 번 돌림. 아니면 다음 날 다시 |

'참고' 칸(봇 확인 화면 403, 일시적 연결 실패, 새로 생긴 모델)은 할 일이 아닙니다. 매일 결과는 Actions → AI catalog → 실행 → Summary에서 봅니다.

### 12.2 직접 돌리기·끄기

- 바로 한 번: Actions → **AI catalog** → **Run workflow**. 내 PC에서는 `npm run ai-catalog`(`--dry` 파일을 쓰지 않음, `--no-check` 주소·CORS 점검 건너뜀). 프록시 뒤라면 `NODE_USE_ENV_PROXY=1`.
- 잠깐 끄기: Actions → AI catalog → **⋯ → Disable workflow**. 앱은 마지막 `ai-catalog.json`과 OpenRouter 실시간 목록으로 그대로 동작합니다.
- 아주 끄기: 워크플로 파일을 지웁니다. `ai-catalog.json`을 지워도 앱은 예전처럼 실시간 목록 → 이름 규칙으로 동작합니다.
- 공개 저장소의 예약 실행은 저장소에 60일 동안 활동이 없으면 GitHub가 멈춥니다. 멈추면 Actions에서 다시 켭니다.

## 13. 장애·복구

먼저 사용자 쪽은 이미 버티게 되어 있습니다: 앱은 PWA라 다녀간 사람에게는 캐시로 열리고, 예비 주소 `https://yoorrard.github.io/lecpage/`는 다른 회사(GitHub)라 장애 영역이 다르며, 강사 자료는 강사 브라우저(IndexedDB)와 `.lecpage` 파일에 있어 어디로든 다시 배포할 수 있습니다. 공지는 관리 화면 팝업 공지(앱·강사 화면)나, 그것도 안 되면 GitHub 저장소 README 맨 위·고정 이슈로 합니다.

| 상황 | 사용자에게 보이는 것 | 운영자 할 일 | 공지 문구(예) |
|---|---|---|---|
| Cloudflare 계정 잠금·정지(바로 배포 사이트 신고로 계정 조치 등) | lecpage.com 첫 방문이 안 열림(다녀간 사람은 열림), hello@ 메일이 오지 않음, 바로 배포·관리 화면·Pages 사이트 멈춤 | ① 예비 주소를 README 맨 위·고정 이슈로 공지 ② 문의는 GitHub 이슈, 보안 신고는 Private vulnerability reporting으로 받기 ③ 대시보드 Support로 이의 제기 ④ 강사에게 예비 주소의 '내 계정에 배포'(같은 파일)를 안내. 예방: 바로 배포를 두 번째 계정으로(§14), 알림 'Trust and Safety: New Blocks' | "lecpage.com이 잠시 열리지 않아요. https://yoorrard.github.io/lecpage/ 에서 그대로 쓸 수 있어요. 바로 배포 대신 '내 계정에 배포'를 써 주세요." |
| 도메인 만료·결제 실패 | lecpage.com이 열리지 않음(예비 주소는 열림) | Registrar → Manage domain에서 결제 수단을 고치고 갱신(만료 뒤에도 유예 기간 안에는 되살릴 수 있으나 값이 더 들 수 있음). 예방: 자동 갱신 + 몇 년치 미리 갱신(§14), 10월 점검(§7) | 위와 같음 |
| Pages 프로젝트(`lecpage-view`)가 지워짐·고장 | 바로 배포 사이트 주소가 모두 열리지 않음(두 번째 주소도 Pages에서 가져오므로 같음, 영상·소리만 열림) | `cd hosting && npm run setup -- --skip-deploy`로 프로젝트·토큰을 다시 만듦 → 관리 화면 공지로 강사에게 [다시 배포]를 안내(서버에는 HTML 원본·영상만 있어 혼자 되살릴 수 없음, 강사 앱이 같은 파일을 다시 올림). 프로젝트 이름이 바뀌면 사이트 주소도 바뀌니 QR을 다시 뽑도록 함 | "바로 배포 사이트가 잠시 열리지 않았어요. 앱에서 [다시 배포]를 한 번 눌러 주세요. 주소가 바뀌었으면 QR을 다시 받아 주세요." |
| 바로 배포 Worker를 잘못 배포함 | 앱 배포 화면이 "바로 배포 서버에 지금 닿지 않아요" → 내 계정 배포로 안내. Pages 사이트는 그대로 열림 | Cloudflare → `lecpage-sites` → Deployments에서 앞 판으로 Rollback, 또는 문제 커밋을 `git revert`해 push | 보통 필요 없음 |
| 관리 Worker를 다시 배포해야 함(관리 화면 코드가 바뀜·망가짐) | 운영자만 영향 | Workers Builds를 연결해 두었으면 push만(§14). 아니면 `cd hosting && npm ci && npx wrangler login && npm run deploy:admin`. Access 앱·비밀 값(`ACCESS_AUD`·`ACCESS_EMAILS`)은 다시 배포해도 남음. 화면이 404면 비밀 값이 빠진 것 → `npm run setup -- --skip-deploy` | — |
| GitHub 계정·저장소 문제(잠금·삭제·Actions 정지) | 이미 배포된 앱·서버는 그대로. 새 배포(Workers Builds)·AI 정보 갱신·예비 주소 갱신만 멈춤(하루 점검이 3일 뒤 'AI 정보 파일 묵음'으로 알림) | 내 PC의 최신 clone(또는 미리 만든 다른 곳 미러)을 새 저장소로 push → Cloudflare Workers Builds의 저장소 연결을 바꿈 → Actions 다시 켜기. 공개 저장소의 예약은 60일 무활동이면 꺼지니 Actions에서 다시 켬 | — |
| 지우는 중이 끝나지 않음(하루 점검 '지우지 못한 사이트') | 그 사이트의 lecpage 두 번째 주소·참여 기능은 이미 닫힘, Pages 주소에는 내용이 남아 있을 수 있음 | 관리 화면 사이트 목록 [다시 지우기]. 그래도 남으면 Cloudflare → Workers & Pages → `lecpage-view` → Deployments에서 브랜치 `s-<주소 10자>`의 배포를 모두 지운 뒤 [다시 지우기](이번엔 남은 것이 없어 끝남). Pages 토큰이 만료·삭제됐으면 `npm run setup -- --skip-deploy`로 새로 | — |
| 웹훅이 오지 않음(월요일 주간 점검이 없음, 관리 화면 '웹훅을 보내지 못했어요') | 없음(운영자만 알림을 못 받음) | 메신저에서 웹훅 주소를 새로 만들어 `cd hosting && npx wrangler secret put ALERT_WEBHOOK`(신고도 받으려면 `REPORT_WEBHOOK`). 관리 화면 맨 위 '마지막 점검'이 하루 넘게 그대로면 cron이 멈춘 것 → `lecpage-sites` → Settings → Triggers에 `7 0 * * *`가 있는지 | — |
| 개인정보가 샜다고 의심됨(바로 배포 서버) | — | ① 무엇이·언제·몇 명 몫이 샜는지 확인(감사 기록·Cloudflare 로그) ② [새 배포 멈추기]로 더 받지 않기 ③ 운영자는 수탁자라 처리자(강사·기관)에게 지체 없이 알림: 관리 화면 팝업 공지(앱·강사 화면) ④ 1천 명 이상이거나 외부 침입이면 72시간 안에 개인정보보호위원회·한국인터넷진흥원 신고(개인정보 보호법 제34조) ⑤ 문의는 hello@로 받기 | "바로 배포 서버에서 ○○이 노출됐을 수 있어요(기간·범위). 참가자에게 알릴 내용과 문의처는 …" |

**백업이 필요한 것**(나머지는 다시 만들 수 있거나 백업하지 않기로 함)

| 무엇 | 어디에 | 왜 |
|---|---|---|
| 저장소(코드·문서) | GitHub + 내 PC의 clone, (권함) 다른 곳 무료 '당겨 오기 미러' 하나 | GitHub 계정 문제 때 Workers Builds 저장소만 바꾸면 다시 배포 |
| 2단계 인증 복구 코드(GitHub·Cloudflare·Google) | 오프라인(종이·비밀번호 관리자) | 계정을 잃으면 모든 것이 멈춤. 10월 점검 |
| 알림 웹훅 주소, `ADMIN_KEY` | 비밀번호 관리자(`ADMIN_KEY`는 설정 스크립트가 `~/.lecpage/<계정>/admin-key`에도 둠) | Worker를 다시 켤 때 그대로 넣음(Pages 토큰·Access는 `npm run setup`이 다시 만듦) |
| 바로 배포 사이트 파일 | 백업하지 않음(강사 브라우저·`.lecpage` 파일이 원본, 처리방침상 60일 보관) | 운영자가 사본을 두면 보관 약속이 깨짐 |
| Gate 자료(신고·감사 기록·공지·설정) | 백업하지 않음. 꼭 필요하면 Durable Objects SQLite의 30일 시점 복구(Cloudflare 공식 문서) | 잃어도 사이트·방은 그대로 열림. 신고는 웹훅의 번호·메일로 다시 확인 |

## 14. 대시보드에서만 할 수 있는 일

코드·자동화로 대신할 수 없는 것만 모았습니다. 대부분 한 번이면 끝납니다.

| 무엇을 | 어디서 | 왜 | 언제 |
|---|---|---|---|
| Dependabot alerts·security updates 켜기 | GitHub 저장소 Settings → Advanced Security(Code security) | 취약점 경고와 보안 PR. `dependabot.yml`은 판 올림만 정함 | 한 번 |
| Secret scanning·push protection 켜기 | 같은 곳 | 비밀 값을 실수로 커밋하지 않게 | 한 번 |
| Actions 기본 권한 읽기 전용 | Settings → Actions → General → Workflow permissions | 최소 권한(AI catalog 워크플로는 필요한 권한을 스스로 적음) | 한 번 |
| 앱 Workers Builds 명령 바꾸기 | Cloudflare → Workers & Pages → `lecpage` → Settings → Build | Build `npm ci && npm --prefix app ci && npm --prefix app run build`, Deploy `npx wrangler deploy`: 취약한 wrangler 4.151.3 대신 잠금 파일 판(4.158.0) | 한 번 |
| 관리 Worker를 Workers Builds에 연결 | Workers & Pages → Create → GitHub → `lecpage` | 이름 `lecpage-admin`, Root `hosting`, Build `npm ci && node scripts/gen-admin.mjs`, Deploy `npx wrangler deploy -c wrangler.admin.jsonc`: 관리 화면도 push로 자동 배포 | 한 번 |
| 바로 배포 cron 확인 | `lecpage-sites` → Settings → Triggers | `7 0 * * *`가 보이면 됨(배포하면 `wrangler.jsonc`에서 저절로 들어감) | 첫 배포 뒤 한 번 |
| 알림 켜기: Trust and Safety New Blocks, Pages Deployment failed | Cloudflare → Notifications | 계정·사이트 조치와 Pages 실패를 메일로(모든 요금제) | 한 번 |
| DMARC·DNSSEC | `lecpage.com` → DNS(또는 Email → DMARC Management), DNS → Settings → DNSSEC | 받기 전용 도메인을 사칭한 메일을 막음: `_dmarc` TXT `v=DMARC1; p=reject; adkim=s; aspf=s` | 한 번 |
| 도메인 몇 년치 미리 갱신·결제 수단 | Domain Registration → Manage → Renew | 카드 만료로 도메인을 잃지 않게(총비용 같음) | 몇 년에 한 번 |
| AI catalog를 한 번 직접 실행 | GitHub Actions → AI catalog → Run workflow | 첫 예약 전에 커밋·이슈까지 끝까지 확인 | 한 번 |
| Dependabot PR 정리 | GitHub Pull requests | #4(메이저 넷 묶음)·#5(Node 25) 닫기, #6은 이 저장소가 wrangler 4.158.0으로 올려 대신함(저절로 닫힘) | 한 번 |
| 유료로 올릴 때만: 구독 + 지출 한도 | Billing → Subscriptions, Billing → Spend Management(Workers·Durable Objects) | 비용 상한. 순서는 `hosting/README.md` §4 | 전환 때 한 번 |
| (권함) 바로 배포용 두 번째 Cloudflare 계정 | 새 계정 → `npm run setup` → `app/src/lib/publish-api.js` 주소 한 줄 | 남이 올린 사이트 신고로 계정이 막혀도 앱·메일·도메인은 그대로 | 한 번 |
