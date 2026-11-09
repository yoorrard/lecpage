# 호스팅·실시간 백엔드 조사 노트

- 조사일: **2026-11-09**. 각 공식 페이지를 직접 내려받아(curl) 확인했습니다. 웹 검색으로만 확인한 값은 "2차 출처", 확인 못 한 값은 ⚠️.
- 이 노트의 결론은 `skills/lecpage/references/infra-decision.md`(결정 규칙)와 `references/deploy/*.md`(따라 하기)에 반영했습니다.
- 가격·한도는 자주 바뀝니다. 6개월마다 다시 확인하세요(확인일을 이 파일 맨 위에 갱신).

---

## 1. 한눈에 비교 — 정적 호스팅

| 서비스 | 무료 범위 | 주요 한도 | 상업 이용 | 내 도메인 | HTTPS | 한국 체감 속도(메모) | 설정 난이도 | 데이터 위치 |
|---|---|---|---|---|---|---|---|---|
| **GitHub Pages** | 0원 | 사이트 1GB, 월 100GB(소프트), 시간당 10빌드(Actions 예외), 배포 10분 제한, 무료는 공개 저장소 | 온라인 사업·상업 SaaS 금지 | ✓ | ✓ 자동 | 양호 ⚠️(CDN 경로 미확인) | ★★ | 미국 회사, 글로벌 CDN |
| **Cloudflare Workers 정적 자산** | 0원 | 정적 요청 **무료·무제한**, 2만 파일, 25MiB/파일, `_headers` 100규칙 | 가능 | ✓ | ✓ 자동 | 서울 PoP 있음. 통신사별로 해외 경유 가능 ⚠️ | ★★(CLI) | 글로벌 |
| **Cloudflare Pages** | 0원 | 끌어 놓기 1,000파일, Wrangler 2만, 25MiB/파일, 월 500빌드, 프로젝트 100개, 도메인 100개/프로젝트 | 가능 | ✓ | ✓ 자동 | 위와 같음 | ★(끌어 놓기) | 글로벌 |
| **Netlify** | 월 300크레딧(하드 한도) | 배포 15, 전송 GB당 20, 1만 요청당 2크레딧. 소진 시 **계정 전체 정지**. 새 프로젝트는 비공개로 시작 | 가능 | ✓ | ✓ 자동 | ⚠️ | ★(Drop) | 글로벌 |
| **Vercel Hobby** | 0원 | 전송 100GB, CDN 요청 100만, 함수 100만, 초과 시 30일 대기 | **비상업 개인만** | ✓ | ✓ 자동 | 서울(icn1) 지역 있음 ⚠️ | ★★ | 글로벌 |
| **Firebase Hosting(Spark)** | 0원 | 저장 10GB, **전송 360MB/일** | 가능 | ✓ | ✓ 자동 | ⚠️ | ★★★(CLI) | 글로벌 |
| **AWS S3+CloudFront** | CloudFront 종량제 상시 무료 월 1TB(+요청 1천만: 2차 출처 ⚠️) / 정액 Free 플랜 $0(요청 100만·100GB·S3 5GB) | 신규 계정 무료 플랜 6개월 | 가능 | ✓(ACM us-east-1) | ✓ | 서울 엣지 다수(재확인 안 함 ⚠️) | ★★★ | 원본 S3 리전 선택(서울 가능) |
| **AWS Amplify Hosting** | 신규 계정 크레딧 | 전송 GB당 $0.15, 저장 $0.023/GB-월, ZIP 5GB | 가능 | ✓ | ✓ | CloudFront 기반 | ★★(끌어 놓기) | 리전 선택 |
| **Azure Static Web Apps(Free)** | 0원 | 월 100GB, 환경당 250MB(합계 500MB), 1.5만 파일, 도메인 2개 | 가능 | ✓ | ✓ | ⚠️ | ★★ | 글로벌 배포 |
| **Render(정적)** | Hobby 0원 | 대역폭 월 5GB 포함, 초과 시(결제수단 없으면) 정지 | 가능 | ✓ | ✓ | 싱가포르가 가장 가까움 ⚠️ | ★★ | 글로벌 CDN |
| **Surge** | 0원 | 프로젝트 450MB·10,100파일, 게시 속도 제한, 대역폭 과금 없음 | 가능 | ✓(무료에 포함) | ✓ | ⚠️ | ★★(CLI) | ⚠️ |
| **Tiiny.host 류** | 무료 1개 | 업로드 3MB·7일 등(출처마다 다름) ⚠️ | 유료 유도 | 유료 | ✓ | ⚠️ | ★ | ⚠️ |
| **Google Cloud Run** | 요청 200만·vCPU 18만초·메모리 36만 GiB초/월(요청 기반) | 결제 계정 필수 | 가능 | ✓ | ✓ | 서울 리전 있음 ⚠️ | ★★★★ | 리전 선택 |
| **네이버 클라우드 Object Storage** | 없음(종량) | 웹사이트 엔드포인트 **HTTP만**, HTTPS·도메인은 Global Edge 연동 | 가능 | ✓(Edge) | Edge로 | 국내 | ★★★ | **국내** |
| **카페24·가비아 웹호스팅** | 유료(저가) ⚠️ | 트래픽 한도 상품별 ⚠️, 보통 Docker·WebSocket 불가 | 가능 | ✓ | 상품별 | 국내 | ★★(FTP) | 국내 |
| **학교·교육청 서버** | 기관 | 업로드 권한·승인 | 기관 규정 | 기관 | 기관 | 교내 최상 | IT 담당 | **교내** |
| **VPS·내 서버(Caddy)** | 서버비 | 서버 성능 | 가능 | ✓ | ✓ 자동 | 위치에 따름 | ★★★ | 직접 선택 |
| **Synology NAS** | 기존 장비 | 회선 업로드 속도, 포트 | 가능 | DDNS | Let's Encrypt | 교내/가정 | ★★★ | **소유 장비** |
| **강사 노트북(LAN)** | 0원 | 공유기 동시 접속 | — | — | http | 교실 최상 | ★★ | **교실 안** |
| **USB·ZIP** | 0원 | 실시간 불가 | — | — | — | — | ★ | 배포물 |

## 2. 한눈에 비교 — 실시간 백엔드

| 서비스 | 무료 범위 | 실시간 방식 | 실패 지점 | 상업 | 데이터 위치 | lecpage 어댑터 |
|---|---|---|---|---|---|---|
| **Supabase Free** | 활성 프로젝트 2개, DB 500MB, 파일 1GB, 전송 5GB, MAU 5만, 실시간 동시 200·초당 100 메시지·월 200만 메시지·메시지 256KB, Edge Functions 50만 | WebSocket(Realtime) | 7일 저활동 정지(1년 안 복구), 익명 로그인 **IP당 30/시**(설정 가능), 메시지는 **받는 사람마다** 셈 | 가능 | **서울(ap-northeast-2)** 선택 가능 | `supabase` |
| **Google Apps Script + Sheets** | 무료(구글 계정) | HTTPS 폴링 | 사용자당 **동시 실행 30**, 실행당 6분, URL Fetch 2만/일, 트리거 90분/일, 속성 저장 500KB | 개인 계정 약관 ⚠️ | 구글 인프라(국가 지정 불가) | `sheets` |
| **Cloudflare Workers + Durable Objects(무료)** | Workers 요청 10만/일, DO 요청 10만/일·13,000GB-s/일, SQLite 행 읽기 500만/일·쓰기 10만/일·저장 5GB(객체당 1GB) | WebSocket(하이버네이션)·SSE·폴링 | 일일 한도(오류 1027), 00:00 UTC=09:00 KST 초기화, 들어오는 WS 메시지 20:1 | 가능 | 첫 요청 근처 데이터센터, 관할 지정은 EU·FedRAMP만 | `http` |
| **node-server(Docker)** | 서버 비용 | WebSocket·SSE·폴링 | 서버 다운 | 가능 | **직접 선택** | `http` |
| Firebase RTDB/Firestore(Spark) | RTDB 동시 100·저장 1GB·10GB/월, Firestore 읽기 5만/일·쓰기 2만/일, **Storage는 Blaze 필수** | WebSocket | 일일 한도, Storage 불가 | 가능 | 리전 선택 | 없음 |
| PocketBase | 오픈소스 | SSE | 1.0 전, 하위 호환 미보장 | 가능 | 직접 | 없음 |
| Appwrite Cloud Free | ⚠️ 세부 한도 미정리 | WebSocket | 한도 도달 시 프로젝트 동결(콘솔 읽기 전용) | ⚠️ | ⚠️ | 없음 |
| Convex Free | 함수 호출 100만/월 등 | WebSocket | ⚠️ | ⚠️ | 데이터 리전 선택(유료?) ⚠️ | 없음 |
| Vercel Functions WebSocket | Hobby 함수 최대 300초 | WebSocket(공개 베타) | 5분마다 끊김, 인스턴스 고정 | 비상업 | — | 비권장 |
| Render Free 웹 서비스 | 750시간/월 | WebSocket | 15분 무요청 시 잠듦·파일 삭제 | 가능 | 싱가포르 등 | 비권장 |
| Koyeb Free | 조직당 1개, 512MB·0.1 vCPU·2GB, 프랑크푸르트/워싱턴만, 1시간 무요청 시 0으로 축소, 볼륨 불가 | WebSocket | 한국에서 멂, 데이터 비영속 | ⚠️ | 독일/미국 | 비권장 |
| Fly.io | 체험 $1(7일), 256MB 상시 $2.19/30일 | WebSocket | 유료 | 가능 | 도쿄(nrt) 등 | `http`(node-server) |
| Railway | 체험 $5(1회), Free 월 $1, Hobby $5/월 | WebSocket | 크레딧 | 가능 | 싱가포르 등 ⚠️ | `http`(node-server) |
| AWS Lightsail | VM $5(IPv4)/$3.5(IPv6 전용), 컨테이너 Nano $7(500GB 전송) | WebSocket(VM) | 유료 | 가능 | **서울** | `http`(node-server) |
| AWS App Runner | — | — | **2026년 신규 고객 받지 않음**(기존 고객만, ECS Express Mode 권장) | — | — | 비권장 |

## 3. 수치 계산 메모

- 사이트 크기: 슬라이드 WebP 1장 150KB × 120장 ≈ 18MB + 나머지 2MB ≈ 20MB.
- 40명 × 3회 × 20MB = 2.4GB/회. → GitHub(월 100GB), Cloudflare(무제한), Vercel(100GB), Azure(100GB) 여유. Netlify는 48크레딧+배포. Render 정적 월 5GB면 2회 연수로 소진. Firebase Spark는 하루 360MB라 불가.
- Supabase 메시지(받는 사람마다 1개): 참가자 40 + 강사 화면 2. 상태 방송 1번 = 41~43개. 초당 100 한도 → 초당 방송 2번이 한계. 반응(이모지)은 묶어서 보내야 함(어댑터 설계 요구사항).
- Supabase 익명 로그인: 학교는 NAT 하나 → 시간당 30명. **연수 전 대시보드에서 한도 상향**(Auth → Rate Limits). 또는 익명 로그인 없이 RPC로 참가 토큰 발급.
- Cloudflare 폴링 시 요청: 40명 × 12회/분(5초) × 90분 = 43,200 → 무료 10만/일 안. 150명이면 162,000 → 초과 → 폴링 15초 이상 또는 WS/SSE 필수.
- DO 실행 시간: 128MB 고정 과금. 연결 유지(하이버네이션 불가 상태) 2시간 = 7,200초 × 0.125GB = 900GB-s (한도 13,000/일). WebSocket 하이버네이션이면 쉬는 동안 0.
- Apps Script 동시 실행: 40명 × (1/10초) × 0.7초 ≈ 2.8 동시 → 한도 30에 여유. 120명·5초면 ≈ 17, 쓰기 잠금(LockService) 대기까지 생각하면 위험.

## 4. 서비스별 메모와 출처

### GitHub Pages
- 공개 저장소(무료), 1GB, 월 100GB 소프트, 시간당 10빌드(사용자 Actions 워크플로는 예외), 배포 10분 타임아웃, 429 속도 제한 가능. "온라인 사업·전자상거래·상업 SaaS용 무료 호스팅"으로 사용 금지. 비밀번호·카드 번호 같은 민감 거래 금지.
- 응답 헤더 변경 불가 → CSP는 `<meta>`.
- 웹 업로드: 파일당 25MiB, 한 번에 100개.
- 공식 워크플로 예시 액션: checkout@v6, configure-pages@v5, upload-pages-artifact@v4, deploy-pages@v4. 권한 `pages: write`, `id-token: write`.
- 출처: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits · https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages · https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository

### Cloudflare
- Workers Free: 요청 10만/일, 호출당 CPU 10ms, 정적 자산 요청 무료·무제한, WebSocket 연결은 요청 1개, 메시지는 Worker 요청으로 세지 않음. 초과 시 오류 1027, 자정 UTC 초기화.
- Durable Objects Free: SQLite 백엔드만. 요청 10만/일(HTTP·RPC·WS 메시지·알람 포함), 실행 13,000GB-s/일, 들어오는 WS 메시지 20:1, 나가는 메시지·프로토콜 ping 무료, 하이버네이션 가능 상태면 실행 시간 미과금. SQLite: 행 읽기 500만/일, 쓰기 10만/일, 저장 5GB(계정), 객체당 1GB(무료). 클래스 100개. 받는 WS 메시지 최대 32MiB.
- SQLite 저장 과금은 2026-01부터 시작(유료 플랜 기준).
- DO 위치: 처음 요청 근처. 관할(jurisdiction)은 `eu`, `fedramp`만. 위치 힌트는 최선 노력.
- Pages: 끌어 놓기 1,000파일/25MiB, Wrangler 2만, 끌어 놓기 프로젝트는 Git 연결로 전환 불가, 빌드 월 500, 프로젝트 100, 도메인 100/프로젝트, `_headers` 100규칙·줄당 2,000자, `_redirects` 2,100개.
- Workers 정적 자산: `assets.directory`, `not_found_handling`, `html_handling`(기본 auto-trailing-slash: `/file.html` → `/file` 307), `.assetsignore`, `_headers`는 Worker 코드가 만든 응답에는 적용되지 않음.
- Quick Tunnel(trycloudflare): 시험용, 가동 보장 없음, 동시 요청 200, **SSE 미지원**.
- 출처: https://developers.cloudflare.com/workers/platform/pricing/ · https://developers.cloudflare.com/workers/platform/limits/ · https://developers.cloudflare.com/durable-objects/platform/limits/ · https://developers.cloudflare.com/durable-objects/reference/data-location/ · https://developers.cloudflare.com/pages/platform/limits/ · https://developers.cloudflare.com/pages/get-started/direct-upload/ · https://developers.cloudflare.com/workers/static-assets/ · https://developers.cloudflare.com/workers/static-assets/headers/ · https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/ · https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/

### Supabase
- Free: MAU 5만, DB 500MB, 공유 CPU·RAM 500MB, 전송 5GB(+캐시 5GB), 파일 1GB, "1주 비활성 시 정지, 활성 프로젝트 2개"(정지된 것은 개수에서 빠짐). 정지 약 1주 전 경고 메일, 대시보드에서 1년 안 복구.
- Realtime Free: 동시 피크 연결 200, 월 메시지 200만, 메시지 최대 256KB, 초당 메시지 100, 초당 채널 참가 100, 연결당 채널 100, Presence 초당 20. 메시지는 "보낸 1 + 받은 클라이언트 수"로 셈. 초당 한도 넘으면 연결 끊김(supabase-js가 자동 재연결).
- Auth: 익명 로그인 기본 **시간당 30회/IP**(버킷 용량=설정값), 관리 API·대시보드에서 변경 가능.
- 서울 리전: `ap-northeast-2`.
- 출처: https://supabase.com/pricing · https://supabase.com/docs/guides/realtime/limits · https://supabase.com/docs/guides/realtime/pricing · https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages · https://supabase.com/docs/guides/auth/rate-limits · https://supabase.com/docs/guides/platform/project-pausing · https://supabase.com/docs/guides/platform/regions

### Google Apps Script
- 소비자·Workspace 공통: 스크립트 실행 6분, 사용자당 동시 실행 30, 스크립트당 동시 1,000, 트리거 20개/사용자/스크립트, 속성 값 9KB·저장 500KB. 일일: URL Fetch 2만(소비자)/10만(Workspace), 트리거 실행 90분/6시간, 속성 읽기·쓰기 5만/50만.
- "모든 한도는 예고 없이 바뀔 수 있음."
- 학교 Workspace 관리자가 외부 공개 웹 앱 배포를 막을 수 있음 ⚠️(관리 정책 의존).
- 출처: https://developers.google.com/apps-script/guides/services/quotas

### Vercel
- Hobby: 비상업 개인용. 전송 100GB, Origin 10GB, CDN 요청 100만, Active CPU 4시간, 함수 호출 100만, 프로젝트 200, 함수 최대 300초. 초과 시 대부분 30일 대기.
- 상업 이용 정의: 프로젝트 제작 관련자 누구든 금전적 이득(결제, 상품·서비스 광고, 사이트 제작·호스팅 대가, 광고 게재 등). 기부 요청은 예외. → 강사료 받는 연수의 사이트는 회색지대로 판단.
- WebSocket: 함수에서 공개 베타, 최대 실행 시간이 되면 연결 종료.
- 출처: https://vercel.com/docs/plans/hobby · https://vercel.com/docs/limits/fair-use-guidelines · https://vercel.com/docs/limits · https://vercel.com/docs/functions/websockets · https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections

### Netlify
- 2025-09-04 이후 신규 계정은 크레딧 요금제. Free 300크레딧/월 하드 한도(추가 구매 불가), Personal 1,000, Pro 3,000~.
- 운영 배포 15, 컴퓨팅 GB-시간당 10, 전송 GB당 20, 요청 1만당 2, 폼 제출 무료.
- 크레딧 소진 시 모든 프로젝트 정지("Site not available"), 새 배포 불가.
- 새 프로젝트는 비공개로 시작해 공개를 선택해야 함(가격 페이지 문구).
- 계정 없는 배포(`--allow-anonymous`)는 1시간 안에 claim.
- 출처: https://www.netlify.com/pricing/ · https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/ · https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/ · https://docs.netlify.com/deploy/create-deploys/

### Firebase
- Spark: Hosting 저장 10GB, 전송 360MB/일, 도메인·SSL ✓. RTDB 동시 100·1GB·10GB/월. Firestore 1GiB·읽기 5만/일·쓰기 2만/일·삭제 2만/일·전송 10GiB/월.
- Cloud Storage for Firebase: Spark 프로젝트는 기본 버킷 포함 접근 불가 → Blaze 필수(무료 사용량은 Blaze에서도 유지).
- 출처: https://firebase.google.com/pricing · https://firebase.google.com/docs/hosting/usage-quotas-pricing · https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024

### AWS
- 2025-07-15 이후 신규 계정: 가입 시 $100 + 활동으로 최대 $100 추가 크레딧, Free 플랜은 6개월 또는 크레딧 소진 시 계정 종료(유료 전환 전 과금 없음). 30여 개 서비스는 상시 무료 한도.
- CloudFront 종량제: 상시 무료 "월 1TB 인터넷 전송" 확인. 요청 1천만·함수 200만은 2차 출처 ⚠️. 정액제(flat-rate) Free $0/월: 요청 100만, 전송 100GB, S3 5GB 크레딧, WAF 규칙 5개, 초과 요금 없음. (무료 플랜 계정은 정액제 가입 불가라는 2차 출처 ⚠️)
- Amplify: 빌드 분당 $0.01, 저장 $0.023/GB-월, 전송 $0.15/GB, SSR 요청 100만당 $0.30. Git 없이 ZIP 끌어 놓기 배포(최대 5GB).
- Lightsail: VM $5부터(IPv6 전용 $3.5부터), 컨테이너 Nano $7(0.25 vCPU·512MB)·Micro $10, 컨테이너 서비스당 전송 500GB.
- App Runner: 신규 고객 받지 않음(공식 문서), ECS Express Mode 권장. 마감일 2026-04-30은 2차 출처.
- 출처: https://aws.amazon.com/free/ · https://aws.amazon.com/cloudfront/pricing/ · https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/ · https://aws.amazon.com/amplify/pricing/ · https://docs.aws.amazon.com/amplify/latest/userguide/manual-deploys.html · https://aws.amazon.com/lightsail/pricing/ · https://aws.amazon.com/apprunner/pricing/ · https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html
- 2차 출처(CloudFront): https://costbench.com/software/cdn-edge/aws-cloudfront/free-plan/ · https://cloudburn.io/blog/amazon-cloudfront-pricing

### Azure Static Web Apps
- Free: 전송 월 100GB(Free의 초과 요금 칸은 비어 있음 → 초과 시 동작 ⚠️, Standard는 GB당 $0.20), 앱 10개(구독당), 미리보기 환경 3, 저장 합계 500MB·환경당 250MB, 파일 15,000, 도메인 2.
- 출처: https://learn.microsoft.com/en-us/azure/static-web-apps/quotas · https://azure.microsoft.com/en-us/pricing/details/app-service/static/

### Google Cloud Run
- 요청 기반 과금 무료: vCPU 18만초, 메모리 36만 GiB초, 요청 200만/월(us-central1 기준 금액 할인 방식). 인스턴스 기반: vCPU 24만초, 메모리 45만 GiB초.
- WebSocket은 요청 타임아웃(최대 60분) 적용 → 재연결 필요. 파일 시스템은 휘발성 → node-server 데이터 보관에 부적합(외부 저장소 필요).
- 출처: https://cloud.google.com/run/pricing · https://cloud.google.com/run/docs/triggering/websockets

### Render
- Hobby $0(+컴퓨팅), 서비스 25개, **대역폭 월 5GB 포함**(Pro 25GB). 정적 사이트 무료.
- Free 웹 서비스: 15분 무요청 시 잠듦(약 1분 기동), 휘발성 파일 시스템, 디스크 불가, 월 750시간, 대역폭 소진 시 결제수단 없으면 정지. Free Postgres는 30일 뒤 만료.
- 출처: https://render.com/docs/free · https://render.com/pricing

### Fly.io
- 플랫폼 월 기본료 없음. 체험 $1(7일). 256MB 상시 $2.19/30일, 512MB $3.69. 공유 IPv4 무료, 전용 IPv4 $2/월. 인증서 10개 무료. 아시아 전송 $0.04/GB.
- 출처: https://fly.io/docs/about/pricing/ · https://fly.io/docs/about/free-trial/

### Railway
- Trial 1회 $5, Free 월 $1 크레딧(서비스당 RAM 0.5GB·1 vCPU·볼륨 0.5GB), Hobby $5/월, Pro $20/월.
- 출처: https://docs.railway.com/reference/pricing/plans

### Koyeb
- Free 인스턴스: 조직당 1개, 512MB·0.1 vCPU·2GB SSD, 프랑크푸르트 또는 워싱턴 DC만, 워커·자동 확장·볼륨 불가, 1시간 무요청 시 0으로 축소.
- 출처: https://www.koyeb.com/docs/reference/instances · https://www.koyeb.com/pricing

### Surge
- Free: 프로젝트·도메인 무제한, 내 도메인 인증서 자동, 최근 100개 리비전 롤백, 대역폭 과금 없음. 프로젝트 450MB·10,100파일. 게시 제한(15분/일): 도메인당 30/200, 계정당 60/500. 헤더·리다이렉트(ROUTER)는 Pro($30/월).
- 출처: https://surge.sh/pricing

### Tiiny.host
- 공식 가격 페이지가 스크립트로만 그려져 확인 못 함 ⚠️. 2차 출처: 무료 1개 프로젝트, 업로드 3MB(PDF 0.5MB), 월 방문 5,000 또는 대역폭 5GB, 7일 만료 등 서로 다름.
- 출처(2차): https://helpdesk.tiiny.host/en/article/visitor-limits-file-upload-limits-bandwidth-limits-explained-1ihflbr · https://bootstrap.build/articles/tiiny-host-alternatives/

### 국내
- 네이버 클라우드 Object Storage: 종량 과금(저장+요청+전송), 정적 웹사이트 엔드포인트는 HTTP만(HTTPS 접속 시 403), HTTPS·내 도메인은 Global Edge 연동, 원본이 NCP Object Storage면 Object Storage 아웃바운드 무과금. 무료 제공량 확인 못 함 ⚠️.
  - https://guide.ncloud-docs.com/docs/ncloudstorage-webhosting · https://www.ncloud.com/product/contentDelivery/globalEdge · https://www.ncloud.com/charge
- 카페24: 2026년 일부 상품(퀵서버호스팅, biz 도메인) 가격 인상 보도. 웹호스팅 절약형 가격·트래픽은 공식 페이지가 스크립트로 그려져 확인 못 함 ⚠️. https://hosting.cafe24.com · https://v.daum.net/v/20260506145325997
- 가비아: 확인 못 함 ⚠️.
- 학교·교육청: 학교 홈페이지 CMS는 임의 HTML·JS 업로드를 막는 경우가 대부분 ⚠️(기관별). 게시판 첨부로 ZIP 배포 + 외부 호스팅 링크가 현실적.

### 자체 호스팅 도구
- PocketBase: SQLite 내장, 실시간 구독, 단일 실행 파일. "1.0 전까지 하위 호환 보장 안 함, 운영 환경 비권장" 문구. https://pocketbase.io/docs/
- Appwrite Cloud Free: 한도 도달 시 프로젝트 동결·콘솔 읽기 전용. https://appwrite.io/pricing
- Convex: Free & Starter 함수 호출 100만/월(초과 100만당 $2.20). https://www.convex.dev/pricing
- Synology Container Manager: DSM 7.2+ "프로젝트"로 compose 실행, 역방향 프록시의 사용자 지정 머리글에 WebSocket 항목. 공식 도움말 본문은 스크립트로 그려져 2차 출처로 확인 ⚠️. https://kb.synology.com/en-global/DSM/help/ContainerManager/docker_desc · https://mariushosting.com/synology-some-docker-containers-need-websocket/ · https://www.wundertech.net/container-manager-on-a-synology-nas/

### 단축 URL·QR
- goo.gl: 2018년 신규 중단, 2025-08-25 이후 활동 없던 링크 중단·활발한 링크는 유지(2025-08-01 공지 변경). https://9to5google.com/guides/goo-gl · https://developers.googleblog.com/2018/03/transitioning-google-url-shortener.html
- 네이버 me2.do: 일반 등록 2016년 종료, API 등록 2024-11/12 중단, 기존 링크 2026-09-30 이후 중단 예정(나무위키 단일 출처 ⚠️). naver.me는 네이버 내부 서비스 전용. https://namu.moe/w/%EB%8B%A8%EC%B6%95%20URL
- 국내 단축 서비스 목록(vo.la, han.gl 등): https://github.com/738/awesome-url-shortener (운영 상태 ⚠️)

## 5. 확인하지 못한 것(⚠️ 목록)
1. CloudFront 종량제 상시 무료의 "요청 1천만·함수 200만"(공식 페이지 본문에서 1TB만 확인), 정액 Free 플랜과 무료 플랜 계정 호환성.
2. App Runner 신규 중단 날짜(2026-04-30)는 2차 출처. 공식 문서는 "신규 받지 않음"만.
3. Netlify Drop(웹)의 1시간 claim 규칙 — CLI 익명 배포 문서로 유추.
4. Fly.io 서울 리전 유무, Railway 아시아 리전 이름.
5. Lightsail 컨테이너 서비스 공개 엔드포인트의 WebSocket 지원, 영구 저장 없음의 영향.
6. 한국 통신사별 Cloudflare·Fastly(GitHub Pages)·Netlify 경로와 실제 지연 → **check.html로 현장 측정**하도록 설계.
7. Tiiny.host, 카페24·가비아 웹호스팅의 현재 가격·한도.
8. 국내 단축 URL 서비스(vo.la, han.gl)의 운영 상태, 네이버 me2.do 기존 링크 중단일.
9. 학교 Workspace 관리 계정에서 Apps Script 웹 앱 "모든 사용자" 배포 허용 여부(학교마다 다름).
10. Cloudflare Registrar의 `.kr` 지원 여부.
11. Synology Container Manager 지원 모델·메뉴 이름(공식 도움말 본문 미확인).
12. Supabase 어댑터가 WebSocket 차단 시 폴링으로 전환하는지(백엔드 구현 확인 필요).
