# lecpage 웹앱 운영 안내 (운영자용)

lecpage 웹앱을 올리고 지키는 사람을 위한 문서입니다. 기준일 2026-11-14. 운영자 유영재, 문의 hello@lecpage.com.
근거: [2026-11 점검 결정 기록](research/2026-11-review.md) · [호스팅 조사](research/hosting.md) · [앱 운영 조사](research/app-operations.md).

## 0. 지금 켜진 것

`main`에 push하면 아래 '자동'이 모두 다시 배포됩니다(결과: Cloudflare Worker의 **Deployments**, GitHub **Actions**). 그래서 push 전에 시험을 모두 통과시킵니다.

| 서비스 | 주소 | 배포 방법 | 비용 |
|---|---|---|---|
| 웹앱(Worker `lecpage`, 정적 자산) | https://lecpage.com | 자동: Workers Builds(저장소 맨 위) | 0원 |
| 웹앱 예비 주소(GitHub Pages) | https://yoorrard.github.io/lecpage/ | 자동: Actions `pages.yml` | 0원 |
| 바로 배포 서버(Worker `lecpage-sites`) | https://lecpage-sites.lecpage.workers.dev | 자동: Workers Builds(root `hosting`) | 0원(무료 요금제, `PLAN` free) |
| 바로 배포 사이트 보기(Pages `lecpage-view`) | `https://s-<id>.lecpage-view.pages.dev` | 서버가 배포마다 올림. 마지막 배포 뒤 60일 보관 | 0원 |
| 관리 화면(Worker `lecpage-admin`) | https://lecpage-admin.lecpage.workers.dev/admin/ | `npm run setup`이 배포(바꿀 때 `npm run deploy:admin`). Cloudflare Access, 메일 일회용 번호 | 0원(Zero Trust Free) |
| 도메인 `lecpage.com` | Cloudflare Registrar | 자동 갱신 | 연 $11.17 |
| 문의 메일 `hello@lecpage.com` | Email Routing → 운영자 Gmail | — | 0원 |

## 1. 결정 요약

| 항목 | 결정 | 이유 |
|---|---|---|
| 구조 | **로컬 우선 정적 PWA**. 교재 해석·사이트 조립·ZIP 만들기를 모두 브라우저에서 | 서버가 없으면 운영비·장애·개인정보 책임이 사라짐 |
| 호스팅 | **Cloudflare Workers 정적 자산**, GitHub 연결(Workers Builds)로 자동 배포. 저장소 맨 위 [`wrangler.jsonc`](../wrangler.jsonc) | 정적 요청 무료·무제한, 상업 이용 가능, `_headers` 적용, 한도에서 과금 대신 오류. Cloudflare가 새 프로젝트는 Pages보다 Workers로 시작하라고 안내 |
| 도메인 | **lecpage.com**(Cloudflare Registrar, 연 $11.17, 갱신도 같은 값. 2026-11-14 등록) | DNS 작업 없음. Workers 내 도메인은 어차피 Cloudflare 영역이 필요. 2026-11-09 현재 후보 모두 미등록 → 빨리 등록 |
| 미러 | **GitHub Pages**(`https://yoorrard.github.io/lecpage/`), [`.github/workflows/pages.yml`](../.github/workflows/pages.yml)로 자동 | 이미 연결됨, 0원, Cloudflare와 다른 장애 영역. 헤더를 못 바꿔 보안은 약함 → 예비용 |
| 로그인 | **없음** | 계정을 저장하면 운영자가 개인정보처리자가 됨. 필요한 연결(AI·Vercel·GitHub·Netlify)은 사용자 키·토큰을 그 브라우저에서만 씀 |
| 저장 | IndexedDB(프로젝트·이미지) + `.lecpage` 파일 내보내기/열기 + 저장 공간 보호(persist) | 다른 PC로 옮기기, 공용 PC 정리 |
| AI | 사용자 키(BYOK) · 쓰던 AI에 복사·붙여넣기 · Agent Skill · AI 없는 초안 | 운영자 AI 비용 0. 구독 로그인 재사용은 약관 위반이라 구현하지 않음 |
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
| Build command | `npm --prefix app ci && npm --prefix app run build` |
| Deploy command | `npx wrangler@4.151.3 deploy` |
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
- [ ] 개인정보 안내 페이지(앱 `#/help/privacy`)가 실제 동작(분석 없음, 오류 수집 없음, 사용자 키는 브라우저에서 AI 회사로 직접)과 맞는지 배포 때마다 본다.

## 7. 정기 할 일

| 주기 | 할 일 |
|---|---|
| 매일 | 신고 알림(웹훅) 확인 → 관리 화면 **신고**에서 가리거나(임시조치) 지우고 [처리함]. 권리 침해 신고는 지체 없이 |
| 매주 | 가린 사이트는 가린 날부터 30일 안에 풀거나 지우기 · 관리 화면 맨 위 '권하는 행동'(유료 전환·상한)과 오류(5xx) · GitHub 이슈(진단 정보에 참가자 개인정보·교재를 붙이지 않게) · Dependabot PR(lockfile 기준, pdf.js는 보안 수정 판 이상) |
| 매달 | 답을 마친 지 1년 지난 문의 메일을 메일함·휴지통에서 지우기(처리방침 1·7번) · Cloudflare API 토큰 목록에서 다 쓴 토큰 지우기 |
| 매년 | `lecpage.com` 자동 갱신 켜짐과 결제 수단 만료일(갱신일보다 뒤) · 2단계 인증 복구 코드 · [호스팅 조사](research/hosting.md)의 한도·약관 다시 보기(6개월마다면 더 좋음) |

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
| 맡는 것 | 사이트 파일(Pages, 사이트마다 `s-<id>` 주소)과 딸린 실시간 방(별명·질문·보드 파일). **마지막 배포 뒤 60일** 보관(방문으로 늘지 않음), 끝나면 그 주소에 '보관 기간이 끝났어요' 안내만 남김. 방만 빼려면 `LIVE=off` |
| 운영자 책임 | §1의 "서버 없음"이 이 범위에서 바뀜: 신고 창구(정보통신망법 임시조치, 저작권법 제102·103조), 참여 기록 수탁자(처리방침 9번), 기간 안에서만 보관 |
| 요금제 | `PLAN` free: 하루 몫 45%부터 연수 날짜가 14일 안인 것만, 60%부터 새 사이트는 같은 파일 그대로 강사 계정으로. 오늘 연수·배포한 사이트는 그대로 열림. 유료 전환은 README §4의 3줄(구독 → 두 wrangler 설정에 `PLAN` 커밋 → push). 근거 [`scale-2026-11.md`](research/scale-2026-11.md) §5, [`zero-cost-2026-11.md`](research/zero-cost-2026-11.md) |
| 관리 화면 | `lecpage-admin`(§0): 이용량·30일 추이·권하는 행동(처리 안 된 신고 먼저)·신고·팝업 공지·새 배포 멈춤·감사 기록. 근거·보안 검토 [`admin-2026-11.md`](research/admin-2026-11.md) |

## 11. 구글 시트 틀 미리 만들어 두기 (선택)

강사가 구글 시트로 참여 기능을 연결할 때 코드를 붙여 넣는 단계를 없애 줍니다.
1. 운영용 구글 계정으로 새 시트를 만들고 **확장 프로그램 → Apps Script**에 `skills/lecpage/backends/apps-script/Code.gs`를 붙여 넣어 저장합니다(배포는 하지 않습니다).
2. 시트를 **링크가 있는 모든 사용자 · 뷰어**로 공유하고, 주소 끝의 `/edit…`을 `/copy`로 바꾼 주소를 준비합니다.
3. 앱을 빌드할 때 `VITE_SHEET_TEMPLATE`에 그 주소를 넣습니다(GitHub Pages 미러는 저장소 변수 `LECPAGE_SHEET_TEMPLATE`).
- 그러면 앱의 안내가 "시트 사본 만들기 → 웹 앱으로 배포 → 주소 붙여넣기"로 줄어듭니다. `Code.gs`가 바뀌면 틀도 새로 만들어 주소를 바꿉니다.
- 틀에는 자료를 넣지 않습니다. 사본은 강사 계정에 만들어지고 운영자는 볼 수 없습니다.
